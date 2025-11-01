import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundProcessor, VirtualBackground } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track, ParticipantEvent, LocalVideoTrack } from 'livekit-client';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';
import {
  saveCustomBackground,
  getAllCustomBackgrounds,
  deleteCustomBackground,
  getTotalStorageUsed,
  formatBytes,
  CustomBackground,
} from './customBackgrounds';
import { useProcessorLoading } from './ProcessorLoadingContext';

// Background image paths (using public URLs to avoid Turbopack static import issues)
const BACKGROUND_IMAGES = [
  { name: 'Desk', path: '/background-images/samantha-gades-BlIhVfXbi9s-unsplash.jpg' },
  { name: 'Nature', path: '/background-images/ali-kazal-tbw_KQE3Cbg-unsplash.jpg' },
];

// Gradient backgrounds - lightweight and modern
const GRADIENT_BACKGROUNDS = [
  {
    name: 'Ocean',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    name: 'Sunset',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    name: 'Forest',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    name: 'Aurora',
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  },
  {
    name: 'Twilight',
    gradient: 'linear-gradient(135deg, #434343 0%, #000000 100%)',
  },
  {
    name: 'Galaxy',
    gradient: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)',
  },
];

// Background options
type BackgroundType = 'none' | 'blur' | 'image' | 'gradient' | 'custom-video' | 'custom-image';

// Helper function to create a canvas with gradient for VirtualBackground
// Placed outside component to avoid recreation
const createGradientCanvas = (gradient: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Parse gradient string and create gradient
    const gradientObj = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    
    // Extract colors from gradient string (simplified parser)
    if (gradient.includes('linear-gradient')) {
      const colors = gradient.match(/#[0-9a-fA-F]{6}/g);
      if (colors && colors.length >= 2) {
        gradientObj.addColorStop(0, colors[0]);
        gradientObj.addColorStop(1, colors[1]);
      }
    }
    
    ctx.fillStyle = gradientObj;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL();
};

export function CameraSettings() {
  const { cameraTrack, localParticipant } = useLocalParticipant();
  
  // Custom backgrounds state
  const [customBackgrounds, setCustomBackgrounds] = React.useState<CustomBackground[]>([]);
  const [storageUsed, setStorageUsed] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Use shared loading state from context to show overlay in room
  const { isApplyingProcessor, setIsApplyingProcessor } = useProcessorLoading();
  const isApplyingProcessorRef = React.useRef(false);

  // Track blob URLs to prevent memory leaks
  const activeBlobUrlsRef = React.useRef<Set<string>>(new Set());

  // Helper function to revoke blob URLs and prevent memory leaks
  const revokeBlobUrls = React.useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
        console.log('[CameraSettings] Revoked blob URL:', url.substring(0, 50) + '...');
      } catch (error) {
        console.warn('[CameraSettings] Error revoking blob URL:', error);
      }
    });
    activeBlobUrlsRef.current.clear();
  }, []);

  // Track console.warn override timeout to prevent memory leaks
  const consoleWarnTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalConsoleWarnRef = React.useRef<typeof console.warn>(console.warn);

  // Helper function to suppress MediaPipe warnings with proper cleanup
  const suppressMediaPipeWarnings = React.useCallback(() => {
    // Clear any existing timeout
    if (consoleWarnTimeoutRef.current) {
      clearTimeout(consoleWarnTimeoutRef.current);
      consoleWarnTimeoutRef.current = null;
    }

    // Store the current console.warn
    const currentWarn = console.warn;

    // Override console.warn to filter MediaPipe warnings
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      // Filter out MediaPipe OpenGL warnings
      if (message.includes('OpenGL error checking') || message.includes('gl_context.cc')) {
        return; // Suppress this specific warning
      }
      currentWarn.apply(console, args);
    };

    // Return a cleanup function that restores console.warn
    return () => {
      // Clear the timeout if it exists
      if (consoleWarnTimeoutRef.current) {
        clearTimeout(consoleWarnTimeoutRef.current);
        consoleWarnTimeoutRef.current = null;
      }
      // Restore console.warn immediately
      console.warn = currentWarn;
    };
  }, []);

  // Initialize from saved preferences - BLUR ENABLED BY DEFAULT
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>(() => {
    if (typeof window === 'undefined') return 'blur';
    
    const prefs = loadUserPreferences();
    console.log('[CameraSettings] Loaded preferences:', prefs);
    
    // Return saved preference or default to 'blur'
    return prefs.backgroundType || 'blur';
  });

  const [virtualBackgroundImagePath, setVirtualBackgroundImagePath] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    
    const prefs = loadUserPreferences();
    return prefs.backgroundPath || null;
  });
  
  // Custom background ID for tracking which custom background is selected
  const [selectedCustomBgId, setSelectedCustomBgId] = React.useState<string | null>(null);

  // Mirror video preference
  const [mirrorVideo, setMirrorVideo] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const prefs = loadUserPreferences();
    return prefs.mirrorVideo !== undefined ? prefs.mirrorVideo : true;
  });

  // Load custom backgrounds on mount and restore selection
  const loadCustomBackgrounds = React.useCallback(async () => {
    try {
      const backgrounds = await getAllCustomBackgrounds();
      setCustomBackgrounds(backgrounds);
      
      const storage = await getTotalStorageUsed();
      setStorageUsed(storage);
      
      console.log('[CameraSettings] Loaded custom backgrounds:', backgrounds.length);
      
      // Restore custom background selection if saved
      const prefs = loadUserPreferences();
      if ((prefs.backgroundType === 'custom-video' || prefs.backgroundType === 'custom-image') && prefs.backgroundPath) {
        // Check if the custom background still exists
        const customBgExists = backgrounds.some(bg => bg.id === prefs.backgroundPath);
        if (customBgExists) {
          setSelectedCustomBgId(prefs.backgroundPath);
          console.log('[CameraSettings] Restored custom background:', prefs.backgroundPath);
        } else {
          // Custom background was deleted, fallback to blur
          console.warn('[CameraSettings] Saved custom background not found, falling back to blur');
          selectBackground('blur');
        }
      }
    } catch (error) {
      console.error('Failed to load custom backgrounds:', error);
    }
  }, []);
  
  React.useEffect(() => {
    loadCustomBackgrounds();
  }, [loadCustomBackgrounds]);

  // Track the currently applied processor configuration to avoid reapplying the same one
  const currentProcessorRef = React.useRef<{
    type: BackgroundType;
    path: string | null;
  }>({ type: 'none', path: null });

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  // Initialize and save default settings on first mount
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      // Check if this is first time (no saved preferences)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('livekit-user-preferences') : null;
      if (!stored) {
        // First time - save all default settings
        const prefs = loadUserPreferences();
        saveUserPreferences({
          backgroundType: prefs.backgroundType,
          backgroundPath: prefs.backgroundPath,
          videoEnabled: prefs.videoEnabled,
          audioEnabled: prefs.audioEnabled,
          noiseFilterEnabled: prefs.noiseFilterEnabled,
        });
        console.log('[CameraSettings] First visit - saved default preferences:', prefs);
      }
    }
  }, []);

  const selectBackground = (type: BackgroundType, imagePath?: string, customBgId?: string) => {
    setBackgroundType(type);
    
    if ((type === 'image' || type === 'gradient') && imagePath) {
      setVirtualBackgroundImagePath(imagePath);
      setSelectedCustomBgId(null);
      saveUserPreferences({ 
        backgroundType: type, 
        backgroundPath: imagePath 
      });
    } else if ((type === 'custom-video' || type === 'custom-image') && customBgId) {
      // For custom backgrounds, we'll handle the path separately
      setSelectedCustomBgId(customBgId);
      setVirtualBackgroundImagePath(null);
      saveUserPreferences({ 
        backgroundType: type, 
        backgroundPath: customBgId // Store the ID
      });
    } else if (type !== 'image' && type !== 'gradient' && type !== 'custom-video' && type !== 'custom-image') {
      setVirtualBackgroundImagePath(null);
      setSelectedCustomBgId(null);
      saveUserPreferences({ 
        backgroundType: type, 
        backgroundPath: undefined 
      });
    }
    
    console.log('[CameraSettings] Background changed to:', type, imagePath, customBgId);
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[CameraSettings] File input changed');
    const file = event.target.files?.[0];
    
    if (!file) {
      console.log('[CameraSettings] No file selected');
      return;
    }
    
    console.log('[CameraSettings] File selected:', file.name, file.type, file.size);
    setIsUploading(true);
    
    try {
      console.log('[CameraSettings] Saving custom background...');
      const customBg = await saveCustomBackground(file);
      console.log('[CameraSettings] Custom background saved:', customBg);
      
      await loadCustomBackgrounds();
      console.log('[CameraSettings] Custom backgrounds reloaded');
      
      // Auto-select the newly uploaded background
      const bgType = customBg.type === 'video' ? 'custom-video' : 'custom-image';
      selectBackground(bgType, undefined, customBg.id);
      
      console.log('[CameraSettings] Uploaded custom background:', customBg.name);
    } catch (error) {
      console.error('[CameraSettings] Failed to upload custom background:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleDeleteCustomBackground = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this background?')) {
      return;
    }
    
    try {
      await deleteCustomBackground(id);
      await loadCustomBackgrounds();
      
      // If the deleted background was selected, switch to blur
      if (selectedCustomBgId === id) {
        selectBackground('blur');
      }
      
      console.log('[CameraSettings] Deleted custom background:', id);
    } catch (error) {
      console.error('Failed to delete custom background:', error);
      alert('Failed to delete background');
    }
  };

  // Effect to apply processors with caching - IMMEDIATE application for privacy
  React.useEffect(() => {
    console.log('[CameraSettings] 🎬 PROCESSOR EFFECT TRIGGERED');
    console.log('[CameraSettings] Current state: backgroundType=', backgroundType, ', virtualBackgroundImagePath=', virtualBackgroundImagePath, ', selectedCustomBgId=', selectedCustomBgId);

    // Track if this effect is still active
    let isEffectActive = true;

    const track = cameraTrack?.track;

    // Only process if track exists, is local, and is in 'live' state
    if (!isLocalTrack(track) || track.mediaStreamTrack?.readyState !== 'live') {
      console.log('[CameraSettings] ⏭️  Skipping - track not local or not live');
      
      // PRIVACY: If no effect is needed, clear the overlay immediately
      // This prevents the overlay from staying visible if user disabled effects
      if (backgroundType === 'none') {
        isApplyingProcessorRef.current = false;
        setIsApplyingProcessor(false);
        console.log('[CameraSettings] Cleared overlay - no background effect needed');
      }
      return;
    }

    // Log current track dimensions
    const currentDims = track.mediaStreamTrack?.getSettings();
    if (currentDims) {
      console.log('[CameraSettings] 📐 Current track dimensions:', currentDims.width, 'x', currentDims.height);
    }

    // Check if we're already using this processor configuration
    const currentPath = selectedCustomBgId || virtualBackgroundImagePath;

    if (
      currentProcessorRef.current.type === backgroundType &&
      currentProcessorRef.current.path === currentPath
    ) {
      return; // Already applied, skip
    }

    // Apply processor immediately for privacy - no debounce
    const applyProcessor = async () => {
      // Prevent concurrent processor applications
      if (isApplyingProcessorRef.current) {
        console.log('[CameraSettings] Already applying a processor, skipping');
        return;
      }
      
      // Update the processor ref BEFORE starting to prevent re-triggers
      currentProcessorRef.current = {
        type: backgroundType,
        path: currentPath,
      };
      
      try {
        // Re-check track state to prevent race conditions
        if (!isLocalTrack(track)) {
          console.warn('[CameraSettings] Track is not a local track, skipping processor update');
          return;
        }
        
        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack) {
          console.warn('[CameraSettings] MediaStreamTrack is null, skipping processor update');
          return;
        }
        
        // Check readyState - must be 'live' for video processing
        if (mediaStreamTrack.readyState !== 'live') {
          console.warn('[CameraSettings] MediaStreamTrack is not live (state:', mediaStreamTrack.readyState, '), skipping processor update');
          return;
        }
        
        // Mark that we're applying a processor
        isApplyingProcessorRef.current = true;
        setIsApplyingProcessor(true);
        
        // IMPORTANT: Do NOT mute room tracks - it can cause the MediaStreamTrack to end
        // Apply the processor directly while the track is live
        // The processor initialization is fast enough that minimal unprocessed frames are sent
        console.log('[CameraSettings] Applying processor directly to live track (no mute needed)');

        // Suppress MediaPipe initialization warnings with proper cleanup
        const restoreConsoleWarn = suppressMediaPipeWarnings();

        // No longer need to restore/unmute since we don't mute anymore
        // Keeping this function as a no-op to avoid changing all call sites
        const restoreVideoTrack = async () => {
          // Track is never muted, so no need to unmute
        };

        if (backgroundType === 'blur') {
          revokeBlobUrls();

          if (!isEffectActive) {
            return;
          }

          // Use LiveKit's built-in BackgroundProcessor
          const blurProcessor = BackgroundProcessor({
            blurRadius: 15, // Standard blur radius
            segmenterOptions: {
              delegate: 'GPU',
            },
          });

          const finalMediaStreamTrack = track.mediaStreamTrack;
          if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
            restoreConsoleWarn();
            return;
          }
          
          try {
            await track.setProcessor(blurProcessor);
            console.log('[CameraSettings] Blur processor applied successfully');
            restoreConsoleWarn();
          } catch (processorError) {
            restoreConsoleWarn();
            if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream closed while applying blur processor');
              return;
            }
            throw processorError;
          }
        } else if ((backgroundType === 'image' || backgroundType === 'gradient') && virtualBackgroundImagePath) {
          revokeBlobUrls();

          if (!isEffectActive) {
            return;
          }

          let imagePath = virtualBackgroundImagePath;
          
          if (backgroundType === 'gradient') {
            imagePath = createGradientCanvas(virtualBackgroundImagePath);
          }
          
          const virtualBgProcessor = VirtualBackground(imagePath, {
            delegate: 'GPU',
          });

          const finalMediaStreamTrack = track.mediaStreamTrack;
          if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
            restoreConsoleWarn();
            return;
          }
          
          try {
            await track.setProcessor(virtualBgProcessor);
            console.log('[CameraSettings] Virtual background applied successfully');
            restoreConsoleWarn();
          } catch (processorError) {
            restoreConsoleWarn();
            if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream closed while applying virtual background');
              return;
            }
            throw processorError;
          }
          
        } else if ((backgroundType === 'custom-video' || backgroundType === 'custom-image') && selectedCustomBgId) {
          const customBg = customBackgrounds.find(bg => bg.id === selectedCustomBgId);
          if (customBg) {
            revokeBlobUrls();

            if (!isEffectActive) {
              return;
            }

            const blobUrl = URL.createObjectURL(customBg.data);
            activeBlobUrlsRef.current.add(blobUrl);

            const virtualBgProcessor = VirtualBackground(blobUrl, {
              delegate: 'GPU',
            });

            const finalMediaStreamTrack = track.mediaStreamTrack;
            if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
              restoreConsoleWarn();
              return;
            }
            
            try {
              await track.setProcessor(virtualBgProcessor);
              console.log('[CameraSettings] Custom background applied successfully');
              restoreConsoleWarn();
            } catch (processorError) {
              restoreConsoleWarn();
              if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
                console.warn('[CameraSettings] Stream closed while applying custom background');
                return;
              }
              throw processorError;
            }
          }
          
        } else {
          // No effect - stop processor
          revokeBlobUrls();

          if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
            try {
              await track.stopProcessor();
              console.log('[CameraSettings] Processor stopped successfully');
              restoreConsoleWarn();
            } catch (stopError) {
              restoreConsoleWarn();
              if (stopError instanceof DOMException && stopError.name === 'InvalidStateError') {
                console.warn('[CameraSettings] Stream closed while stopping processor');
              } else {
                console.error('[CameraSettings] Error stopping processor:', stopError);
              }
            }
          }
        }
        
      } catch (error) {
        // Handle errors gracefully and always restore video
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('[CameraSettings] Track is in invalid state (stream closed), skipping processor update');
        } else {
          console.error('[CameraSettings] Error setting video processor:', error);
        }
        
        // CRITICAL: Always unmute the video track on error to prevent permanent black screen
        const track = cameraTrack?.track;
        if (isLocalTrack(track) && track.isMuted) {
          const mediaStreamTrack = track.mediaStreamTrack;
          if (mediaStreamTrack?.readyState === 'live') {
            track.unmute().catch(unmuteError => {
              console.warn('[CameraSettings] Error unmuting track after processor error:', unmuteError);
            });
          }
        }
      } finally {
        // Always clear the applying flag
        isApplyingProcessorRef.current = false;
        setIsApplyingProcessor(false);
      }
    };

    applyProcessor();
    
    return () => {
      isEffectActive = false;
    };
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, selectedCustomBgId, customBackgrounds, setIsApplyingProcessor, revokeBlobUrls, suppressMediaPipeWarnings]);

  // Cleanup processors on unmount
  React.useEffect(() => {
    // Copy ref value to avoid stale reference in cleanup
    const originalWarn = originalConsoleWarnRef.current;

    return () => {
      console.log('[CameraSettings] Component unmount - cleaning up processors');
      const track = cameraTrack?.track;
      if (isLocalTrack(track)) {
        // Check if track is still valid before stopping processor
        const mediaStreamTrack = track.mediaStreamTrack;
        if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
          track.stopProcessor().catch((err) => {
            // Silently handle errors during cleanup
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream already closed during cleanup');
            } else {
              console.warn('[CameraSettings] Error stopping processor on cleanup:', err);
            }
          });
        }
      }

      // CRITICAL: Revoke all blob URLs to prevent memory leaks
      revokeBlobUrls();

      // CRITICAL: Clear any pending console.warn restore timeout
      if (consoleWarnTimeoutRef.current) {
        clearTimeout(consoleWarnTimeoutRef.current);
        consoleWarnTimeoutRef.current = null;
      }
      // Restore original console.warn if it was overridden
      console.warn = originalWarn;

      // Clear processor configuration tracking
      currentProcessorRef.current = { type: 'none', path: null };
      console.log('[CameraSettings] Cleanup complete');
    };
  }, [cameraTrack, revokeBlobUrls]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ position: 'relative' }}>
        {camTrackRef ? (
          <VideoTrack
            style={{
              maxHeight: '280px',
              objectFit: 'contain',
              objectPosition: 'right',
              transform: mirrorVideo ? 'scaleX(-1)' : 'none',
              // PRIVACY: Hide video while applying processor (only for blur/background effects)
              visibility: (isApplyingProcessor && backgroundType !== 'none') ? 'hidden' : 'visible'
            }}
            trackRef={camTrackRef}
          />
        ) : (
          <video
            className="lk-participant-media-video"
            data-lk-local-participant="true"
            data-lk-source="camera"
            data-lk-orientation="landscape"
            style={{
              maxHeight: '280px',
              objectFit: 'contain',
              objectPosition: 'right center',
              transform: mirrorVideo ? 'scaleX(-1)' : 'none',
              // PRIVACY: Hide video while applying processor (only for blur/background effects)
              visibility: (isApplyingProcessor && backgroundType !== 'none') ? 'hidden' : 'visible'
            }}
            autoPlay
            playsInline
          />
        )}
        
        {/* Loading overlay while applying processor - PRIVACY PROTECTION */}
        {isApplyingProcessor && backgroundType !== 'none' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#000000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            zIndex: 10,
            borderRadius: '8px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 500, textAlign: 'center' }}>
              Applying effect...
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>

      <section className="lk-button-group">
        <TrackToggle aria-label="Toggle camera" source={Track.Source.Camera} />
        <button
          onClick={() => {
            const newValue = !mirrorVideo;
            setMirrorVideo(newValue);
            saveUserPreferences({ mirrorVideo: newValue });
          }}
          className="lk-button"
          aria-label={mirrorVideo ? "Disable mirror/flip" : "Enable mirror/flip"}
          aria-pressed={mirrorVideo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            border: mirrorVideo ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
            background: mirrorVideo ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.08)',
          }}
          title={mirrorVideo ? "Video is mirrored (like a mirror)" : "Video shows as others see it"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 12H21M3 12L6 9M3 12L6 15M21 12L18 9M21 12L18 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Flip</span>
        </button>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </MediaDeviceMenu>
        </div>
      </section>

      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontWeight: '500' }}>
            Background Effects
          </div>
          <div
            title="Tips for best person detection:&#10;&#10;LIGHTING (Most Important):&#10;• Use bright, even lighting from the front&#10;• Avoid windows or bright lights behind you&#10;• Side lighting can create harsh shadows&#10;&#10;CAMERA POSITION:&#10;• Center yourself in the frame&#10;• Keep 1-2 feet of space above your head&#10;• Position camera at eye level&#10;&#10;BACKGROUND:&#10;• Use simple, uncluttered backgrounds&#10;• Avoid complex patterns or textures&#10;• Keep background objects away from you&#10;• Solid walls work better than shelves&#10;&#10;CLOTHING:&#10;• Wear colors that contrast with background&#10;• Avoid patterns that blend with surroundings&#10;&#10;ADVANCED:&#10;• Enable 'High' or 'Ultra' quality in settings&#10;• Use Settings > Advanced > Custom Segmentation&#10;• Enable temporal smoothing to reduce flicker"
            style={{
              cursor: 'help',
              fontSize: '14px',
              color: '#0090ff',
              fontWeight: 'bold',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid #0090ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => !isApplyingProcessor && selectBackground('none')}
            className="lk-button lk-button-visual"
            aria-label="No background effect"
            aria-pressed={backgroundType === 'none'}
            disabled={isApplyingProcessor}
            style={{
              border: backgroundType === 'none' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '0',
              opacity: isApplyingProcessor ? 0.5 : 1,
              cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 3L21 21M3 21L21 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <button
            onClick={() => !isApplyingProcessor && selectBackground('blur')}
            className="lk-button lk-button-visual"
            aria-label="Blur background effect"
            aria-pressed={backgroundType === 'blur'}
            disabled={isApplyingProcessor}
            style={{
              border: backgroundType === 'blur' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: '#e0e0e0',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '0',
              opacity: isApplyingProcessor ? 0.5 : 1,
              cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#d0d0d0',
                filter: 'blur(12px)',
                zIndex: 0,
              }}
            />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ position: 'relative', zIndex: 1 }}>
              <circle cx="12" cy="12" r="4" fill="#666" opacity="0.3"/>
              <circle cx="8" cy="8" r="3" fill="#999" opacity="0.4"/>
              <circle cx="16" cy="9" r="2.5" fill="#999" opacity="0.4"/>
              <circle cx="9" cy="16" r="2" fill="#999" opacity="0.4"/>
              <circle cx="16" cy="15" r="2.5" fill="#999" opacity="0.4"/>
            </svg>
          </button>

          {GRADIENT_BACKGROUNDS.map((gradientBg) => (
            <button
              key={gradientBg.name}
              onClick={() => !isApplyingProcessor && selectBackground('gradient', gradientBg.gradient)}
              className="lk-button lk-button-visual"
              aria-label={`${gradientBg.name} gradient background`}
              aria-pressed={
                backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
              }
              disabled={isApplyingProcessor}
              style={{
                background: gradientBg.gradient,
                border:
                  backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                minWidth: '60px',
                minHeight: '60px',
                padding: '0',
                opacity: isApplyingProcessor ? 0.5 : 1,
                cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
              }}
            >
            </button>
          ))}

          {BACKGROUND_IMAGES.map((image) => (
            <button
              key={image.path}
              onClick={() => !isApplyingProcessor && selectBackground('image', image.path)}
              className="lk-button lk-button-visual"
              aria-label={`${image.name} background image`}
              aria-pressed={
                backgroundType === 'image' && virtualBackgroundImagePath === image.path
              }
              disabled={isApplyingProcessor}
              style={{
                backgroundImage: `url(${image.path})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border:
                  backgroundType === 'image' && virtualBackgroundImagePath === image.path
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                minWidth: '60px',
                minHeight: '60px',
                padding: '0',
                opacity: isApplyingProcessor ? 0.5 : 1,
                cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
              }}
            >
            </button>
          ))}
          
          {/* Custom uploaded backgrounds */}
          {customBackgrounds.map((customBg) => {
            const bgType = customBg.type === 'video' ? 'custom-video' : 'custom-image';
            const isSelected = selectedCustomBgId === customBg.id;
            
            return (
              <button
                key={customBg.id}
                onClick={() => !isApplyingProcessor && selectBackground(bgType, undefined, customBg.id)}
                className="lk-button lk-button-visual"
                aria-label={`Custom ${customBg.type}: ${customBg.name}`}
                aria-pressed={isSelected}
                disabled={isApplyingProcessor}
                style={{
                  backgroundImage: `url(${customBg.thumbnail})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: isSelected
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                  minWidth: '60px',
                  minHeight: '60px',
                  padding: '0',
                  position: 'relative',
                  opacity: isApplyingProcessor ? 0.5 : 1,
                  cursor: isApplyingProcessor ? 'not-allowed' : 'pointer',
                }}
              >
                {/* Video indicator */}
                {customBg.type === 'video' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '10px',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  >
                    VIDEO
                  </div>
                )}
                
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteCustomBackground(customBg.id, e)}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(220, 38, 38, 0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '0',
                  }}
                  aria-label="Delete custom background"
                  title="Delete"
                >
                  ×
                </button>
              </button>
            );
          })}
          
          {/* Upload button with file input */}
          <button
            type="button"
            className="lk-button lk-button-visual"
            aria-label="Upload custom background"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isUploading && fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            disabled={isUploading}
            title="Upload custom background image or video (max 100MB)"
            style={{
              border: '2px dashed rgba(59, 130, 246, 0.5)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.1))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              borderRadius: '12px',
              padding: '0',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.6 : 1,
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            {isUploading ? (
              <div style={{ fontSize: '11px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.95)', pointerEvents: 'none' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  borderTopColor: '#60a5fa',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 6px',
                }} />
                <span style={{ fontSize: '10px', fontWeight: 500 }}>Uploading...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', pointerEvents: 'none' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: 'rgba(96, 165, 250, 0.9)' }}>
                  <path d="M7 18C4.23858 18 2 15.7614 2 13C2 10.4003 4.01099 8.26756 6.5 8.03302V8C6.5 5.23858 8.73858 3 11.5 3C13.8595 3 15.8291 4.64832 16.381 6.86155C18.8843 7.42648 20.5 9.64141 20.5 12.25C20.5 15.1495 18.1495 17.5 15.25 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 11V21M12 11L9 14M12 11L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.95)', fontWeight: 500 }}>Upload</span>
              </div>
            )}
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg"
              onChange={handleFileUpload}
              disabled={isUploading}
              title="Upload custom background (image or video)"
              aria-label="Upload custom background"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                zIndex: 2,
              }}
            />
          </button>
        </div>
        
        {/* Storage info */}
        {customBackgrounds.length > 0 && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{customBackgrounds.length} custom background{customBackgrounds.length !== 1 ? 's' : ''}</span>
            <span>Storage: {formatBytes(storageUsed)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
