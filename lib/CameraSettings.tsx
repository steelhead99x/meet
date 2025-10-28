import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { BackgroundBlur, VirtualBackground } from '@livekit/track-processors';
import { isLocalTrack, LocalTrackPublication, Track } from 'livekit-client';

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

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  const selectBackground = (type: BackgroundType, imagePath?: string) => {
    setBackgroundType(type);
    if ((type === 'image' || type === 'gradient') && imagePath) {
      setVirtualBackgroundImagePath(imagePath);
    } else if (type !== 'image' && type !== 'gradient') {
      setVirtualBackgroundImagePath(null);
    }
  };

  // Helper function to create a canvas with gradient for VirtualBackground
  const createGradientCanvas = React.useCallback((gradient: string): string => {
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
  }, []);

  React.useEffect(() => {
    if (isLocalTrack(cameraTrack?.track)) {
      if (backgroundType === 'blur') {
        // High-quality blur
        cameraTrack.track?.setProcessor(
          BackgroundBlur(15, {
            delegate: 'GPU',
          }),
        );
      } else if (backgroundType === 'image' && virtualBackgroundImagePath) {
        // Virtual background with image
        cameraTrack.track?.setProcessor(
          VirtualBackground(virtualBackgroundImagePath, {
            delegate: 'GPU',
          }),
        );
      } else if (backgroundType === 'gradient' && virtualBackgroundImagePath) {
        // For gradient, we need to create a canvas with the gradient
        const gradientDataUrl = createGradientCanvas(virtualBackgroundImagePath);
        cameraTrack.track?.setProcessor(
          VirtualBackground(gradientDataUrl, {
            delegate: 'GPU',
          }),
        );
      } else {
        cameraTrack.track?.stopProcessor();
      }
    }
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, createGradientCanvas]);

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
          <div style={{ fontWeight: '500' }}>Background Effects</div>
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
