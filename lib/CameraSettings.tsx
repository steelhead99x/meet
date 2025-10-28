import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur, VirtualBackground, ProcessorWrapper } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track, ParticipantEvent } from 'livekit-client';

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

  // Cache processor instances to avoid recreating them
  const processorCacheRef = React.useRef<{
    blur?: ProcessorWrapper<Record<string, unknown>>;
    virtualBackground?: Map<string, ProcessorWrapper<Record<string, unknown>>>;
  }>({
    virtualBackground: new Map(),
  });

  // Track the currently applied processor configuration to avoid reapplying the same one
  const currentProcessorRef = React.useRef<{
    type: BackgroundType;
    path: string | null;
  }>({ type: 'none', path: null });

  // Debounce timer ref
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Track CPU constraint state
  const [cpuConstrained, setCpuConstrained] = React.useState(false);

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  // Monitor CPU constraints and auto-disable effects if needed
  React.useEffect(() => {
    if (!localParticipant) return;

    const handleCpuConstrained = async () => {
      console.warn('CPU constrained detected - disabling background effects');
      setCpuConstrained(true);
      
      // Auto-disable background effects when CPU constrained
      if (backgroundType !== 'none') {
        const track = cameraTrack?.track;
        if (isLocalTrack(track)) {
          try {
            await track.stopProcessor();
            currentProcessorRef.current = { type: 'none', path: null };
          } catch (err) {
            console.error('Failed to stop processor on CPU constraint:', err);
          }
        }
      }
    };

    localParticipant.on(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstrained);

    return () => {
      localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, handleCpuConstrained);
    };
  }, [localParticipant, cameraTrack, backgroundType]);

  const selectBackground = (type: BackgroundType, imagePath?: string) => {
    // Warn if trying to enable effects when CPU constrained
    if (cpuConstrained && type !== 'none') {
      console.warn('CPU constrained - background effects may cause performance issues');
    }
    
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
      currentProcessorRef.current.path === virtualBackgroundImagePath
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
        if (backgroundType === 'blur') {
          // Reuse cached blur processor if available
          let blurProcessor = processorCacheRef.current.blur;
          if (!blurProcessor) {
            // Create and cache blur processor with optimized settings
            blurProcessor = BackgroundBlur(10, { // Reduced from 15 to 10 for better performance
              delegate: 'GPU',
            });
            processorCacheRef.current.blur = blurProcessor;
          }
          
          await track.setProcessor(blurProcessor);
          currentProcessorRef.current = { type: 'blur', path: null };
          
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
          currentProcessorRef.current = { type: backgroundType, path: virtualBackgroundImagePath };
          
        } else {
          // No effect - stop processor
          await track.stopProcessor();
          currentProcessorRef.current = { type: 'none', path: null };
        }
      } catch (error) {
        // Handle errors gracefully
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          console.warn('Track is in invalid state, skipping processor update');
        } else {
          console.error('Error setting video processor:', error);
        }
      }
    }, 300); // 300ms debounce

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath]);

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
        virtualBackground: new Map(),
      };
      currentProcessorRef.current = { type: 'none', path: null };
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
        <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
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
            {cpuConstrained && (
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: '12px',
                  color: '#f59e0b',
                  fontWeight: 'normal',
                }}
                title="CPU constraints detected - effects may impact performance"
              >
                ⚠️ Limited Performance
              </span>
            )}
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
            className="lk-button"
            aria-pressed={backgroundType === 'none'}
            style={{
              border: backgroundType === 'none' ? '2px solid #0090ff' : '1px solid #d1d1d1',
              minWidth: '80px',
            }}
          >
            None
          </button>

          <button
            onClick={() => selectBackground('blur')}
            className="lk-button"
            aria-pressed={backgroundType === 'blur'}
            style={{
              border: backgroundType === 'blur' ? '2px solid #0090ff' : '1px solid #d1d1d1',
              minWidth: '80px',
              backgroundColor: '#f0f0f0',
              position: 'relative',
              overflow: 'hidden',
              height: '60px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#e0e0e0',
                filter: 'blur(8px)',
                zIndex: 0,
              }}
            />
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '2px 5px',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              Blur
            </span>
          </button>

          {GRADIENT_BACKGROUNDS.map((gradientBg) => (
            <button
              key={gradientBg.name}
              onClick={() => selectBackground('gradient', gradientBg.gradient)}
              className="lk-button"
              aria-pressed={
                backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
              }
              style={{
                background: gradientBg.gradient,
                width: '80px',
                height: '60px',
                border:
                  backgroundType === 'gradient' && virtualBackgroundImagePath === gradientBg.gradient
                    ? '2px solid #0090ff'
                    : '1px solid #d1d1d1',
              }}
            >
              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'white',
                }}
              >
                {gradientBg.name}
              </span>
            </button>
          ))}

          {BACKGROUND_IMAGES.map((image) => (
            <button
              key={image.path}
              onClick={() => selectBackground('image', image.path)}
              className="lk-button"
              aria-pressed={
                backgroundType === 'image' && virtualBackgroundImagePath === image.path
              }
              style={{
                backgroundImage: `url(${image.path})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '80px',
                height: '60px',
                border:
                  backgroundType === 'image' && virtualBackgroundImagePath === image.path
                    ? '2px solid #0090ff'
                    : '1px solid #d1d1d1',
              }}
            >
              <span
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                {image.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
