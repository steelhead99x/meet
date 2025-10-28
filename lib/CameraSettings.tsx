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
import Desk from '../public/background-images/samantha-gades-BlIhVfXbi9s-unsplash.jpg';
import Nature from '../public/background-images/ali-kazal-tbw_KQE3Cbg-unsplash.jpg';

// Background image paths
const BACKGROUND_IMAGES = [
  { name: 'Desk', path: Desk },
  { name: 'Nature', path: Nature },
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

  // Quality setting: higher = smoother edges, less noise/bleed-through (0.0 - 1.0)
  const [edgeSmoothing, setEdgeSmoothing] = React.useState<number>(0.7);

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
        // High-quality blur with better edge detection
        cameraTrack.track?.setProcessor(
          BackgroundBlur(15, {
            // Improved segmentation options for better edge detection
            delegate: 'GPU',
            smoothingLevel: edgeSmoothing, // Higher smoothing for cleaner edges (0-1)
          }),
        );
      } else if (backgroundType === 'image' && virtualBackgroundImagePath) {
        // High-quality virtual background with edge smoothing
        cameraTrack.track?.setProcessor(
          VirtualBackground(virtualBackgroundImagePath, {
            // Improved segmentation options
            delegate: 'GPU',
            smoothingLevel: edgeSmoothing, // Reduces bleed-through and noise
          }),
        );
      } else if (backgroundType === 'gradient' && virtualBackgroundImagePath) {
        // For gradient, we need to create a canvas with the gradient
        const gradientDataUrl = createGradientCanvas(virtualBackgroundImagePath);
        cameraTrack.track?.setProcessor(
          VirtualBackground(gradientDataUrl, {
            // Improved segmentation options
            delegate: 'GPU',
            smoothingLevel: edgeSmoothing, // Reduces bleed-through and noise
          }),
        );
      } else {
        cameraTrack.track?.stopProcessor();
      }
    }
  }, [cameraTrack, backgroundType, virtualBackgroundImagePath, createGradientCanvas, edgeSmoothing]);

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
              key={image.path.src}
              onClick={() => selectBackground('image', image.path.src)}
              className="lk-button"
              aria-pressed={
                backgroundType === 'image' && virtualBackgroundImagePath === image.path.src
              }
              style={{
                backgroundImage: `url(${image.path.src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '80px',
                height: '60px',
                border:
                  backgroundType === 'image' && virtualBackgroundImagePath === image.path.src
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

        {/* Edge Smoothing Quality Slider - only show when background effect is active */}
        {backgroundType !== 'none' && (
          <div style={{ marginTop: '15px', padding: '10px 0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <label
                htmlFor="edge-smoothing"
                style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}
              >
                Edge Quality
              </label>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {Math.round(edgeSmoothing * 100)}%
              </span>
            </div>
            <input
              id="edge-smoothing"
              type="range"
              min="0"
              max="100"
              value={edgeSmoothing * 100}
              onChange={(e) => setEdgeSmoothing(Number(e.target.value) / 100)}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: '#0090ff',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#999',
                marginTop: '4px',
              }}
            >
              <span>Fast</span>
              <span>Quality</span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '8px',
                lineHeight: '1.4',
              }}
            >
              Higher quality reduces noise and bleed-through but uses more CPU
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
