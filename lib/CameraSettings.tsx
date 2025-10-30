import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur, BackgroundProcessor, VirtualBackground, ProcessorWrapper } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track, ParticipantEvent } from 'livekit-client';
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
      try {
        // Re-check track state to prevent race conditions
        if (!isLocalTrack(track) || track.mediaStreamTrack?.readyState !== 'live') {
          console.warn('Track is no longer valid, skipping processor update');
          return;
        }

        if (backgroundType === 'blur') {
          // Get advanced blur configuration - use custom settings if enabled
          const config = getBlurConfig(
            blurQuality, 
            useCustomSegmentation ? customSegmentation : null
          );
          
          const cacheKey = useCustomSegmentation && customSegmentation
            ? `custom-${JSON.stringify(customSegmentation)}`
            : blurQuality;
          
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
          
          // setProcessor() handles stopping the old processor internally without closing the stream
          await track.setProcessor(blurProcessor);
          
          currentProcessorRef.current = { 
            type: 'blur', 
            path: null, 
            quality: blurQuality,
            customSettings: customSettingsStr
          };
          console.log('[CameraSettings] Blur processor applied successfully, stream remains active');
          
        } else if ((backgroundType === 'image' || backgroundType === 'gradient') && virtualBackgroundImagePath) {
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
          
          // setProcessor() handles stopping the old processor internally
          await track.setProcessor(virtualBgProcessor);
          currentProcessorRef.current = { type: backgroundType, path: virtualBackgroundImagePath, quality: null, customSettings: null };
          console.log('[CameraSettings] Virtual background applied successfully, stream remains active');
          
        } else if ((backgroundType === 'custom-video' || backgroundType === 'custom-image') && selectedCustomBgId) {
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
            
            // setProcessor() handles stopping the old processor internally
            await track.setProcessor(virtualBgProcessor);
            currentProcessorRef.current = { type: backgroundType, path: selectedCustomBgId, quality: null, customSettings: null };
            console.log('[CameraSettings] Custom background applied successfully, stream remains active:', customBg.name);
          }
          
        } else {
          // No effect - stop processor
          await track.stopProcessor();
          currentProcessorRef.current = { type: 'none', path: null, quality: null, customSettings: null };
        }
      } catch (error) {
        // Handle errors gracefully
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('Track is in invalid state, skipping processor update');
        } else {
          console.error('Error setting video processor:', error);
        }
      }
    };

    // Apply immediately - no debounce to prevent background exposure
    applyProcessor();
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, blurQuality, selectedCustomBgId, customBackgrounds, useCustomSegmentation, customSegmentation]);

  // Cleanup processors on unmount
  React.useEffect(() => {
    return () => {
      const track = cameraTrack?.track;
      if (isLocalTrack(track)) {
        track.stopProcessor().catch((err) => {
          console.warn('Error stopping processor on cleanup:', err);
        });
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
            onClick={() => selectBackground('none')}
            className="lk-button lk-button-visual"
            aria-label="No background effect"
            aria-pressed={backgroundType === 'none'}
            style={{
              border: backgroundType === 'none' ? '2px solid #3b82f6' : '2px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              minHeight: '60px',
              padding: '0',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 3L21 21M3 21L21 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <button
            onClick={() => selectBackground('blur')}
            className="lk-button lk-button-visual"
            aria-label="Blur background effect"
            aria-pressed={backgroundType === 'blur'}
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
              onClick={() => selectBackground('gradient', gradientBg.gradient)}
              className="lk-button lk-button-visual"
              aria-label={`${gradientBg.name} gradient background`}
              aria-pressed={
                backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
              }
              style={{
                background: gradientBg.gradient,
                border:
                  backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                minWidth: '60px',
                minHeight: '60px',
                padding: '0',
              }}
            >
            </button>
          ))}

          {BACKGROUND_IMAGES.map((image) => (
            <button
              key={image.path}
              onClick={() => selectBackground('image', image.path)}
              className="lk-button lk-button-visual"
              aria-label={`${image.name} background image`}
              aria-pressed={
                backgroundType === 'image' && virtualBackgroundImagePath === image.path
              }
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
                onClick={() => selectBackground(bgType, undefined, customBg.id)}
                className="lk-button lk-button-visual"
                aria-label={`Custom ${customBg.type}: ${customBg.name}`}
                aria-pressed={isSelected}
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
