import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur, BackgroundProcessor, VirtualBackground, ProcessorWrapper } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track, ParticipantEvent, LocalVideoTrack } from 'livekit-client';
import { detectDeviceCapabilities } from './client-utils';
import { getBlurConfig, getRecommendedBlurQuality, BlurQuality } from './BlurConfig';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';
import {
  saveCustomBackground,
  getAllCustomBackgrounds,
  deleteCustomBackground,
  getTotalStorageUsed,
  formatBytes,
  CustomBackground,
} from './customBackgrounds';
import { waitForProcessorWithFallback } from './videoProcessorUtils';
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
  
  // Detect device capabilities and determine recommended blur quality
  const [blurQuality, setBlurQuality] = React.useState<BlurQuality>(() => {
    if (typeof window === 'undefined') return 'medium';
    
    const prefs = loadUserPreferences();
    
    // Use saved blur quality if available
    if (prefs.blurQuality && ['low', 'medium', 'high', 'ultra'].includes(prefs.blurQuality)) {
      return prefs.blurQuality;
    }
    
    // Auto-detect based on device capabilities
    const capabilities = detectDeviceCapabilities();
    const recommended = getRecommendedBlurQuality(capabilities);
    console.log('[BlurConfig] Device capabilities:', capabilities);
    console.log('[BlurConfig] Recommended blur quality:', recommended);
    return recommended;
  });

  // Cache processor instances to avoid recreating them
  // Map blur quality to processor instance
  const processorCacheRef = React.useRef<{
    blur?: Map<BlurQuality, ProcessorWrapper<Record<string, unknown>>>;
    virtualBackground?: Map<string, ProcessorWrapper<Record<string, unknown>>>;
  }>({
    blur: new Map(),
    virtualBackground: new Map(),
  });

  // Track the currently applied processor configuration to avoid reapplying the same one
  const currentProcessorRef = React.useRef<{
    type: BackgroundType;
    path: string | null;
    quality: BlurQuality | null;
    customSettings: string | null; // JSON stringified custom settings for comparison
  }>({ type: 'none', path: null, quality: null, customSettings: null });

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  // Track custom segmentation settings
  const [useCustomSegmentation, setUseCustomSegmentation] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const prefs = loadUserPreferences();
    return prefs.useCustomSegmentation || false;
  });

  const [customSegmentation, setCustomSegmentation] = React.useState<any>(() => {
    if (typeof window === 'undefined') return null;
    const prefs = loadUserPreferences();
    return prefs.customSegmentation || null;
  });

  // Initialize and save default settings on first mount
  // This ensures first-time users have blur settings saved to localStorage
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      // Check if this is first time (no saved preferences)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('livekit-user-preferences') : null;
      if (!stored) {
        // First time - save all default settings including blur
        const prefs = loadUserPreferences();
        saveUserPreferences({
          backgroundType: prefs.backgroundType,
          backgroundPath: prefs.backgroundPath,
          blurQuality: prefs.blurQuality,
          useCustomSegmentation: prefs.useCustomSegmentation,
          customSegmentation: prefs.customSegmentation,
          videoEnabled: prefs.videoEnabled,
          audioEnabled: prefs.audioEnabled,
          noiseFilterEnabled: prefs.noiseFilterEnabled,
        });
        console.log('[CameraSettings] First visit - saved default preferences including blur:', prefs);
      }
    }
  }, []);

  // Expose blur quality and custom segmentation setters for SettingsMenu
  React.useEffect(() => {
    window.__setBlurQuality = (quality: BlurQuality) => {
      setBlurQuality(quality);
      saveUserPreferences({ blurQuality: quality });
      console.log('[BlurConfig] Blur quality changed to:', quality);
    };
    window.__getBlurQuality = () => blurQuality;
    
    window.__setUseCustomSegmentation = (use: boolean) => {
      setUseCustomSegmentation(use);
      saveUserPreferences({ useCustomSegmentation: use });
      console.log('[BlurConfig] Use custom segmentation:', use);
    };
    window.__getUseCustomSegmentation = () => useCustomSegmentation;
    
    window.__setCustomSegmentation = (settings: any) => {
      setCustomSegmentation(settings);
      saveUserPreferences({ customSegmentation: settings });
      console.log('[BlurConfig] Custom segmentation updated:', settings);
    };
    window.__getCustomSegmentation = () => customSegmentation;
    
    return () => {
      delete window.__setBlurQuality;
      delete window.__getBlurQuality;
      delete window.__setUseCustomSegmentation;
      delete window.__getUseCustomSegmentation;
      delete window.__setCustomSegmentation;
      delete window.__getCustomSegmentation;
    };
  }, [blurQuality, useCustomSegmentation, customSegmentation]);

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
    // Track if this effect is still active
    let isEffectActive = true;
    
    const track = cameraTrack?.track;
    
    // Only process if track exists, is local, and is in 'live' state
    if (!isLocalTrack(track) || track.mediaStreamTrack?.readyState !== 'live') {
      return;
    }

    // Check if we're already using this processor configuration
    const currentPath = selectedCustomBgId || virtualBackgroundImagePath;
    const customSettingsStr = useCustomSegmentation && customSegmentation 
      ? JSON.stringify(customSegmentation) 
      : null;
    
    if (
      currentProcessorRef.current.type === backgroundType &&
      currentProcessorRef.current.path === currentPath &&
      currentProcessorRef.current.quality === blurQuality &&
      currentProcessorRef.current.customSettings === customSettingsStr
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
        
        // Suppress MediaPipe initialization warnings
        // MediaPipe logs benign OpenGL warnings during WebGL context initialization
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => {
          const message = args.join(' ');
          // Filter out MediaPipe OpenGL warnings
          if (message.includes('OpenGL error checking') || 
              message.includes('gl_context.cc')) {
            return; // Suppress this specific warning
          }
          originalWarn.apply(console, args);
        };
        
        // Restore console.warn after processor initialization
        const restoreConsoleWarn = () => {
          setTimeout(() => {
            console.warn = originalWarn;
          }, 1000);
        };
        
        // No longer need to restore/unmute since we don't mute anymore
        // Keeping this function as a no-op to avoid changing all call sites
        const restoreVideoTrack = async () => {
          // Track is never muted, so no need to unmute
        };

        if (backgroundType === 'blur') {
          // Track state was already validated - proceed with applying blur
          
          // Get advanced blur configuration - use custom settings if enabled
          const config = getBlurConfig(
            blurQuality, 
            useCustomSegmentation ? customSegmentation : null
          );
          
          const cacheKey = useCustomSegmentation && customSegmentation
            ? `custom-${JSON.stringify(customSegmentation)}`
            : blurQuality;
          
          // Check effect is still active before creating processor
          if (!isEffectActive) {
            console.log('[CameraSettings] Effect cancelled before blur processor creation');
            await restoreVideoTrack();
            return;
          }
          
          // CRITICAL FIX: Always create a FRESH processor when quality changes
          // DO NOT reuse cached processors - they have stale state that causes issues
          // DO NOT call stopProcessor() first - it closes the stream and causes black screen
          // LiveKit's setProcessor() will handle stopping the old processor internally
          console.log(`[CameraSettings] Creating fresh blur processor for quality:`, blurQuality, config);
          
          const blurProcessor = BackgroundProcessor({
            blurRadius: config.blurRadius,
            segmenterOptions: {
              delegate: config.segmenterOptions.delegate,
            },
          }, 'background-blur');
          
          // Update cache with new processor (for reference only, not reused)
          processorCacheRef.current.blur?.set(cacheKey as any, blurProcessor);
          
          // Check effect is still active and track is still valid after processor creation
          if (!isEffectActive || !isLocalTrack(track)) {
            console.log('[CameraSettings] Effect cancelled or track invalid after blur processor creation');
            restoreConsoleWarn();
            await restoreVideoTrack();
            return;
          }
          
          // CRITICAL: Final track state check right before setProcessor
          // The track can end at any time, so we check immediately before the call
          const finalMediaStreamTrack = track.mediaStreamTrack;
          if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
            console.warn('[CameraSettings] Track ended before setProcessor (state:', finalMediaStreamTrack?.readyState, '), aborting blur application');
            restoreConsoleWarn();
            await restoreVideoTrack();
            return;
          }
          
          try {
            // setProcessor() handles stopping the old processor internally without closing the stream
            await track.setProcessor(blurProcessor);
            
            // Check effect is still active after setProcessor
            if (!isEffectActive) {
              console.log('[CameraSettings] Effect cancelled after setProcessor');
              restoreConsoleWarn();
              await restoreVideoTrack();
              return;
            }
            
            // Wait for processor to actually start outputting processed frames
            // This detects when the blur is ready instead of using fixed timeouts
            console.log('[CameraSettings] Detecting when blur processor is ready...');
            try {
              await waitForProcessorWithFallback(track as LocalVideoTrack, 100);
            } catch (waitError) {
              console.warn('[CameraSettings] Error waiting for blur processor ready:', waitError);
            }
            
            // Final check before marking as complete
            if (!isEffectActive) {
              console.log('[CameraSettings] Effect cancelled during processor initialization');
              restoreConsoleWarn();
              await restoreVideoTrack();
              return;
            }
            
            currentProcessorRef.current = { 
              type: 'blur', 
              path: null, 
              quality: blurQuality,
              customSettings: customSettingsStr
            };
            console.log('[CameraSettings] Blur processor applied successfully, stream remains active');
            restoreConsoleWarn();
            
            // Unmute track now that blur is ready
            await restoreVideoTrack();
          } catch (processorError) {
            restoreConsoleWarn();
            await restoreVideoTrack(); // Always restore video on error
            
            // Handle specific error cases
            if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream closed while applying blur processor:', processorError.message);
              return;
            } else if (processorError instanceof TypeError && 
                       (processorError.message.includes('Input track cannot be ended') ||
                        processorError.message.includes('MediaStreamTrackProcessor'))) {
              console.warn('[CameraSettings] Track ended before processor could be applied:', processorError.message);
              return;
            }
            throw processorError; // Re-throw other errors
          }
          
        } else if ((backgroundType === 'image' || backgroundType === 'gradient') && virtualBackgroundImagePath) {
          // Track state was already validated - proceed with applying virtual background
          
          // Generate cache key
          const cacheKey = `${backgroundType}:${virtualBackgroundImagePath}`;
          
          // Always create fresh virtual background processor to avoid state issues
          let imagePath = virtualBackgroundImagePath;
          
          // For gradient, generate the canvas data URL
          if (backgroundType === 'gradient') {
            imagePath = createGradientCanvas(virtualBackgroundImagePath);
          }
          
          console.log('[CameraSettings] Creating fresh virtual background processor');
          const virtualBgProcessor = VirtualBackground(imagePath, {
            delegate: 'GPU',
          });
          processorCacheRef.current.virtualBackground?.set(cacheKey, virtualBgProcessor);
          
          // CRITICAL: Final track state check right before setProcessor
          const finalMediaStreamTrack = track.mediaStreamTrack;
          if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
            console.warn('[CameraSettings] Track ended before setProcessor (state:', finalMediaStreamTrack?.readyState, '), aborting virtual background');
            restoreConsoleWarn();
            await restoreVideoTrack();
            return;
          }
          
          try {
            // setProcessor() handles stopping the old processor internally
            await track.setProcessor(virtualBgProcessor);
            
            // Wait for processor to actually start outputting processed frames
            console.log('[CameraSettings] Detecting when virtual background is ready...');
            try {
              await waitForProcessorWithFallback(track as LocalVideoTrack, 100);
            } catch (waitError) {
              console.warn('[CameraSettings] Error waiting for virtual background ready:', waitError);
            }
            
            currentProcessorRef.current = { type: backgroundType, path: virtualBackgroundImagePath, quality: null, customSettings: null };
            console.log('[CameraSettings] Virtual background applied successfully, stream remains active');
            restoreConsoleWarn();
            
            // Unmute track now that effect is ready
            await restoreVideoTrack();
          } catch (processorError) {
            restoreConsoleWarn();
            await restoreVideoTrack(); // Always restore video on error
            
            // Handle specific error cases
            if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
              console.warn('[CameraSettings] Stream closed while applying virtual background:', processorError.message);
              return;
            } else if (processorError instanceof TypeError && 
                       (processorError.message.includes('Input track cannot be ended') ||
                        processorError.message.includes('MediaStreamTrackProcessor'))) {
              console.warn('[CameraSettings] Track ended before virtual background could be applied:', processorError.message);
              return;
            }
            throw processorError; // Re-throw other errors
          }
          
        } else if ((backgroundType === 'custom-video' || backgroundType === 'custom-image') && selectedCustomBgId) {
          // Track state was already validated - proceed with applying custom background
          
          // Handle custom backgrounds from IndexedDB
          const customBg = customBackgrounds.find(bg => bg.id === selectedCustomBgId);
          if (customBg) {
            const cacheKey = `custom:${selectedCustomBgId}`;
            
            // Always create fresh custom background processor to avoid state issues
            // Create object URL from blob
            const blobUrl = URL.createObjectURL(customBg.data);
            
            console.log('[CameraSettings] Creating fresh custom background processor:', customBg.name);
            const virtualBgProcessor = VirtualBackground(blobUrl, {
              delegate: 'GPU',
            });
            processorCacheRef.current.virtualBackground?.set(cacheKey, virtualBgProcessor);
            
            // CRITICAL: Final track state check right before setProcessor
            const finalMediaStreamTrack = track.mediaStreamTrack;
            if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
              console.warn('[CameraSettings] Track ended before setProcessor (state:', finalMediaStreamTrack?.readyState, '), aborting custom background');
              restoreConsoleWarn();
              await restoreVideoTrack();
              return;
            }
            
            try {
              // setProcessor() handles stopping the old processor internally
              await track.setProcessor(virtualBgProcessor);
              
              // Wait for processor to actually start outputting processed frames
              console.log('[CameraSettings] Detecting when custom background is ready...');
              try {
                await waitForProcessorWithFallback(track as LocalVideoTrack, 100);
              } catch (waitError) {
                console.warn('[CameraSettings] Error waiting for custom background ready:', waitError);
              }
              
              currentProcessorRef.current = { type: backgroundType, path: selectedCustomBgId, quality: null, customSettings: null };
              console.log('[CameraSettings] Custom background applied successfully, stream remains active:', customBg.name);
              restoreConsoleWarn();
              
              // Unmute track now that effect is ready
              await restoreVideoTrack();
            } catch (processorError) {
              restoreConsoleWarn();
              await restoreVideoTrack(); // Always restore video on error
              
              // Handle specific error cases
              if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
                console.warn('[CameraSettings] Stream closed while applying custom background:', processorError.message);
                return;
              } else if (processorError instanceof TypeError && 
                         (processorError.message.includes('Input track cannot be ended') ||
                          processorError.message.includes('MediaStreamTrackProcessor'))) {
                console.warn('[CameraSettings] Track ended before custom background could be applied:', processorError.message);
                return;
              }
              throw processorError; // Re-throw other errors
            }
          }
          
        } else {
          // No effect - stop processor
          // Check stream state before stopping processor
          if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
            try {
              await track.stopProcessor();
              currentProcessorRef.current = { type: 'none', path: null, quality: null, customSettings: null };
              console.log('[CameraSettings] Processor stopped successfully');
              restoreConsoleWarn();
              
              // Unmute track since no effect is being applied
              await restoreVideoTrack();
            } catch (stopError) {
              restoreConsoleWarn();
              await restoreVideoTrack(); // Always restore video even on error
              if (stopError instanceof DOMException && stopError.name === 'InvalidStateError') {
                console.warn('[CameraSettings] Stream closed while stopping processor:', stopError.message);
              } else {
                console.error('[CameraSettings] Error stopping processor:', stopError);
              }
            }
          } else {
            console.warn('[CameraSettings] Cannot stop processor - stream is not live');
            currentProcessorRef.current = { type: 'none', path: null, quality: null, customSettings: null };
            restoreConsoleWarn();
            await restoreVideoTrack(); // Always restore video
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

    // Apply immediately - no debounce to prevent background exposure
    applyProcessor();
    
    // Cleanup function to cancel ongoing operations
    return () => {
      isEffectActive = false;
    };
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, blurQuality, selectedCustomBgId, customBackgrounds, useCustomSegmentation, customSegmentation]);

  // Cleanup processors on unmount
  React.useEffect(() => {
    return () => {
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
      
      // Clear processor cache
      processorCacheRef.current = {
        blur: new Map(),
        virtualBackground: new Map(),
      };
      currentProcessorRef.current = { type: 'none', path: null, quality: null, customSettings: null };
    };
  }, [cameraTrack]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ position: 'relative' }}>
        {camTrackRef ? (
          <VideoTrack
            style={{
              maxHeight: '280px',
              objectFit: 'contain',
              objectPosition: 'right',
              transform: 'scaleX(-1)',
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
              transform: 'scaleX(-1)',
            }}
            autoPlay
            playsInline
          />
        )}
        
        {/* Loading overlay when applying processor */}
        {isApplyingProcessor && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 10,
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(255, 255, 255, 0.2)',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              Applying effect...
            </div>
          </div>
        )}
      </div>

      <section className="lk-button-group">
        <TrackToggle aria-label="Toggle camera" source={Track.Source.Camera} />
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
          
          {/* Upload button with direct file input */}
          <label
            className="lk-button lk-button-visual"
            aria-label="Upload custom background"
            style={{
              border: '2px dashed rgba(255, 255, 255, 0.3)',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '8px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.6 : 1,
              position: 'relative',
            }}
          >
            {isUploading ? (
              <div style={{ fontSize: '10px', textAlign: 'center' }}>
                Uploading...
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: '10px', marginTop: '4px' }}>
                  Upload
                </div>
              </>
            )}
            
            {/* Direct file input that captures clicks */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg"
              onChange={handleFileUpload}
              disabled={isUploading}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                zIndex: 1,
              }}
              onClick={(e) => {
                console.log('[CameraSettings] File input clicked directly');
                e.stopPropagation();
              }}
            />
          </label>
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
