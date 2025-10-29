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
type BackgroundType = 'none' | 'blur' | 'image' | 'gradient';

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
  const [backgroundType, setBackgroundType] = React.useState<BackgroundType>(
    (cameraTrack as LocalTrackPublication)?.track?.getProcessor()?.name === 'background-blur'
      ? 'blur'
      : (cameraTrack as LocalTrackPublication)?.track?.getProcessor()?.name === 'virtual-background'
        ? 'image'
        : 'none',
  );

  const [virtualBackgroundImagePath, setVirtualBackgroundImagePath] = React.useState<string | null>(
    null,
  );

  // Detect device capabilities and determine recommended blur quality
  const [blurQuality, setBlurQuality] = React.useState<BlurQuality>(() => {
    if (typeof window === 'undefined') return 'medium';
    
    // Check for stored preference
    const stored = localStorage.getItem('blurQuality');
    if (stored && ['low', 'medium', 'high', 'ultra'].includes(stored)) {
      return stored as BlurQuality;
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
  }>({ type: 'none', path: null, quality: null });

  // Debounce timer ref
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  // Expose blur quality setter for SettingsMenu
  React.useEffect(() => {
    window.__setBlurQuality = (quality: BlurQuality) => {
      setBlurQuality(quality);
      localStorage.setItem('blurQuality', quality);
      console.log('[BlurConfig] Blur quality changed to:', quality);
    };
    window.__getBlurQuality = () => blurQuality;
    
    return () => {
      delete window.__setBlurQuality;
      delete window.__getBlurQuality;
    };
  }, [blurQuality]);

  const selectBackground = (type: BackgroundType, imagePath?: string) => {
    setBackgroundType(type);
    if ((type === 'image' || type === 'gradient') && imagePath) {
      setVirtualBackgroundImagePath(imagePath);
    } else if (type !== 'image' && type !== 'gradient') {
      setVirtualBackgroundImagePath(null);
    }
  };

  // Effect to apply processors with debouncing and caching
  React.useEffect(() => {
    const track = cameraTrack?.track;
    
    // Only process if track exists, is local, and is in 'live' state
    if (!isLocalTrack(track) || track.mediaStreamTrack?.readyState !== 'live') {
      return;
    }

    // Check if we're already using this processor configuration
    if (
      currentProcessorRef.current.type === backgroundType &&
      currentProcessorRef.current.path === virtualBackgroundImagePath &&
      currentProcessorRef.current.quality === blurQuality
    ) {
      return; // Already applied, skip
    }

    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce processor changes to prevent rapid reapplication
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Re-check track state after debounce delay to prevent race conditions
        if (!isLocalTrack(track) || track.mediaStreamTrack?.readyState !== 'live') {
          console.warn('Track is no longer valid after debounce, skipping processor update');
          return;
        }

        if (backgroundType === 'blur') {
          // Get or create blur processor for current quality level
          let blurProcessor = processorCacheRef.current.blur?.get(blurQuality);
          if (!blurProcessor) {
            // Get advanced blur configuration based on quality level
            const config = getBlurConfig(blurQuality);
            console.log(`[BlurConfig] Creating ${blurQuality} quality blur processor:`, config);
            
            // Create blur processor with quality-specific settings
            blurProcessor = BackgroundProcessor({
              blurRadius: config.blurRadius,
              segmenterOptions: {
                delegate: config.segmenterOptions.delegate,
              },
            }, 'background-blur');
            
            processorCacheRef.current.blur?.set(blurQuality, blurProcessor);
          }
          
          await track.setProcessor(blurProcessor);
          currentProcessorRef.current = { type: 'blur', path: null, quality: blurQuality };
          
        } else if ((backgroundType === 'image' || backgroundType === 'gradient') && virtualBackgroundImagePath) {
          // Generate cache key
          const cacheKey = `${backgroundType}:${virtualBackgroundImagePath}`;
          
          // Get or create virtual background processor
          let virtualBgProcessor = processorCacheRef.current.virtualBackground?.get(cacheKey);
          if (!virtualBgProcessor) {
            let imagePath = virtualBackgroundImagePath;
            
            // For gradient, generate the canvas data URL
            if (backgroundType === 'gradient') {
              imagePath = createGradientCanvas(virtualBackgroundImagePath);
            }
            
            virtualBgProcessor = VirtualBackground(imagePath, {
              delegate: 'GPU',
            });
            processorCacheRef.current.virtualBackground?.set(cacheKey, virtualBgProcessor);
          }
          
          await track.setProcessor(virtualBgProcessor);
          currentProcessorRef.current = { type: backgroundType, path: virtualBackgroundImagePath, quality: null };
          
        } else {
          // No effect - stop processor
          await track.stopProcessor();
          currentProcessorRef.current = { type: 'none', path: null, quality: null };
        }
      } catch (error) {
        // Handle errors gracefully
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('Track is in invalid state, skipping processor update');
        } else {
          console.error('Error setting video processor:', error);
        }
      }
    }, 150); // 150ms debounce - reduced for faster responsiveness and less perceived jitter

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, blurQuality]);

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
      currentProcessorRef.current = { type: 'none', path: null, quality: null };
    };
  }, [cameraTrack]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {camTrackRef && (
        <VideoTrack
          style={{
            maxHeight: '280px',
            objectFit: 'contain',
            objectPosition: 'right',
            transform: 'scaleX(-1)',
          }}
          trackRef={camTrackRef}
        />
      )}

      <section className="lk-button-group">
        <TrackToggle aria-label="Toggle camera" source={Track.Source.Camera} />
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput" />
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
            title="Tips for best results:&#10;• Use good front lighting&#10;• Avoid backlighting&#10;• Keep background simple&#10;• Adjust Edge Quality slider"
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3L21 21M3 21L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative', zIndex: 1 }}>
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
        </div>
      </div>
    </div>
  );
}
