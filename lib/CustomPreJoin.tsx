import React from 'react';
import { Track, LocalVideoTrack } from 'livekit-client';
import {
  TrackToggle,
  usePreviewDevice,
  usePreviewTracks,
  MediaDeviceMenu,
  VideoTrack,
  LocalUserChoices,
} from '@livekit/components-react';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';
import { BackgroundProcessor } from '@livekit/track-processors';
import { getBlurConfig, getRecommendedBlurQuality, CustomSegmentationSettings } from './BlurConfig';
import { detectDeviceCapabilities } from './client-utils';

export interface CustomPreJoinProps {
  defaults?: Partial<LocalUserChoices>;
  onSubmit?: (values: LocalUserChoices) => void;
  onValidate?: (values: LocalUserChoices) => boolean;
  onError?: (error: Error) => void;
}

export function CustomPreJoin({
  defaults,
  onSubmit,
  onValidate,
  onError,
}: CustomPreJoinProps) {
  // Load saved preferences
  const savedPrefs = React.useMemo(() => loadUserPreferences(), []);
  
  const [username, setUsername] = React.useState(
    defaults?.username ?? savedPrefs.username ?? ''
  );
  const [videoEnabled, setVideoEnabled] = React.useState(
    defaults?.videoEnabled ?? savedPrefs.videoEnabled ?? true
  );
  const [audioEnabled, setAudioEnabled] = React.useState(
    defaults?.audioEnabled ?? savedPrefs.audioEnabled ?? true
  );

  // Validate that saved devices are still available
  const [validatedDeviceIds, setValidatedDeviceIds] = React.useState<{
    video?: string;
    audio?: string;
  }>({
    video: savedPrefs.videoDeviceId,
    audio: savedPrefs.audioDeviceId,
  });

  // Validate devices on mount
  React.useEffect(() => {
    const validateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        let videoIdValid = !savedPrefs.videoDeviceId;
        let audioIdValid = !savedPrefs.audioDeviceId;
        
        if (savedPrefs.videoDeviceId) {
          videoIdValid = videoDevices.some(d => d.deviceId === savedPrefs.videoDeviceId);
          if (!videoIdValid) {
            console.log('[CustomPreJoin] Saved video device not found, will use default');
            saveUserPreferences({ videoDeviceId: undefined });
          }
        }
        
        if (savedPrefs.audioDeviceId) {
          audioIdValid = audioDevices.some(d => d.deviceId === savedPrefs.audioDeviceId);
          if (!audioIdValid) {
            console.log('[CustomPreJoin] Saved audio device not found, will use default');
            saveUserPreferences({ audioDeviceId: undefined });
          }
        }
        
        setValidatedDeviceIds({
          video: videoIdValid ? savedPrefs.videoDeviceId : undefined,
          audio: audioIdValid ? savedPrefs.audioDeviceId : undefined,
        });
      } catch (error) {
        console.error('[CustomPreJoin] Error validating devices:', error);
        // Clear invalid devices
        setValidatedDeviceIds({ video: undefined, audio: undefined });
      }
    };
    
    validateDevices();
  }, [savedPrefs.audioDeviceId, savedPrefs.videoDeviceId]);

  const tracks = usePreviewTracks(
    {
      audio: audioEnabled ? { deviceId: validatedDeviceIds.audio } : false,
      video: videoEnabled ? { deviceId: validatedDeviceIds.video } : false,
    },
    onError,
  );

  const videoEl = React.useRef<HTMLVideoElement>(null);
  const videoTrack = tracks?.filter((t) => t.kind === Track.Kind.Video)[0];
  const blurProcessorRef = React.useRef<any>(null);
  const blurAppliedRef = React.useRef(false);

  // Initialize and save default settings on first mount (preview stage)
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
        console.log('[CustomPreJoin] First visit - saved default preferences including blur:', prefs);
      }
    }
  }, []);

  // Apply blur to preview track IMMEDIATELY before displaying
  React.useEffect(() => {
    const applyPreviewBlur = async () => {
      if (!videoTrack || blurAppliedRef.current) return;
      
      // Check if user has blur enabled (default is blur)
      const backgroundType = savedPrefs.backgroundType || 'blur';
      
      if (backgroundType === 'blur' && videoTrack instanceof LocalVideoTrack) {
        try {
          // Verify track is in valid state
          const mediaStreamTrack = videoTrack.mediaStreamTrack;
          if (!mediaStreamTrack) {
            console.warn('[CustomPreJoin] MediaStreamTrack is null, cannot apply blur');
            return;
          }
          
          if (mediaStreamTrack.readyState !== 'live') {
            console.warn('[CustomPreJoin] MediaStreamTrack is not live (state:', mediaStreamTrack.readyState, '), skipping blur');
            return;
          }
          
          // Determine blur quality
          const blurQuality = savedPrefs.blurQuality || 
            getRecommendedBlurQuality(detectDeviceCapabilities());
          
          // Check if user has custom segmentation settings
          const useCustom = savedPrefs.useCustomSegmentation || false;
          const customSettings = savedPrefs.customSegmentation || null;
          
          const config = getBlurConfig(blurQuality, useCustom ? customSettings : null);
          console.log('[CustomPreJoin] Applying blur to preview with quality:', blurQuality, 
                      useCustom ? '(custom settings)' : '');
          
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
          
          // Create and apply blur processor
          blurProcessorRef.current = BackgroundProcessor({
            blurRadius: config.blurRadius,
            segmenterOptions: {
              delegate: config.segmenterOptions.delegate,
            },
          }, 'background-blur');
          
          // Restore console.warn after a delay to catch initialization warnings
          setTimeout(() => {
            console.warn = originalWarn;
          }, 1000);
          
          // Final check before applying
          if (mediaStreamTrack.readyState !== 'live') {
            console.warn('[CustomPreJoin] Stream state changed before applying blur');
            return;
          }
          
          await videoTrack.setProcessor(blurProcessorRef.current);
          blurAppliedRef.current = true;
          console.log('[CustomPreJoin] Blur applied to preview track');
        } catch (error) {
          if (error instanceof DOMException && error.name === 'InvalidStateError') {
            console.warn('[CustomPreJoin] Stream closed while applying blur to preview:', error.message);
          } else {
            console.error('[CustomPreJoin] Error applying blur to preview:', error);
          }
        }
      }
    };

    applyPreviewBlur();

    return () => {
      // Cleanup blur processor
      if (videoTrack instanceof LocalVideoTrack && blurProcessorRef.current) {
        const mediaStreamTrack = videoTrack.mediaStreamTrack;
        if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
          videoTrack.stopProcessor().catch(err => {
            if (err instanceof DOMException && err.name === 'InvalidStateError') {
              console.warn('[CustomPreJoin] Stream closed while stopping preview processor');
            } else {
              console.warn('[CustomPreJoin] Error stopping preview processor:', err);
            }
          });
        }
        blurAppliedRef.current = false;
      }
    };
  }, [videoTrack, savedPrefs.backgroundType, savedPrefs.blurQuality, savedPrefs.useCustomSegmentation, savedPrefs.customSegmentation]);

  React.useEffect(() => {
    if (videoEl.current && videoTrack) {
      videoTrack.attach(videoEl.current);
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  // Save video/audio toggle preferences in real-time
  React.useEffect(() => {
    saveUserPreferences({ videoEnabled, audioEnabled });
  }, [videoEnabled, audioEnabled]);

  // Save device changes in real-time
  React.useEffect(() => {
    if (tracks) {
      const videoDeviceId = tracks.find((t) => t.kind === Track.Kind.Video)?.mediaStreamTrack.getSettings().deviceId;
      const audioDeviceId = tracks.find((t) => t.kind === Track.Kind.Audio)?.mediaStreamTrack.getSettings().deviceId;
      
      if (videoDeviceId || audioDeviceId) {
        saveUserPreferences({
          videoDeviceId,
          audioDeviceId,
        });
      }
    }
  }, [tracks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const videoDeviceId = tracks?.find((t) => t.kind === Track.Kind.Video)?.mediaStreamTrack.getSettings().deviceId;
    const audioDeviceId = tracks?.find((t) => t.kind === Track.Kind.Audio)?.mediaStreamTrack.getSettings().deviceId;
    
    const values: LocalUserChoices = {
      username,
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
    };

    if (onValidate && !onValidate(values)) {
      return;
    }

    // Save ALL preferences when user joins, including background settings
    // This ensures first-time users have their default blur settings saved
    const currentPrefs = loadUserPreferences();
    saveUserPreferences({
      username,
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
      // Preserve existing background settings (including defaults like blur)
      backgroundType: currentPrefs.backgroundType,
      backgroundPath: currentPrefs.backgroundPath,
      blurQuality: currentPrefs.blurQuality,
      useCustomSegmentation: currentPrefs.useCustomSegmentation,
      customSegmentation: currentPrefs.customSegmentation,
      noiseFilterEnabled: currentPrefs.noiseFilterEnabled,
    });
    
    console.log('[CustomPreJoin] Saved complete user preferences:', currentPrefs);

    onSubmit?.(values);
  };

  return (
    <div className="lk-prejoin" style={{ maxWidth: '500px', width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Video Preview */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden' }}>
          {videoEnabled && videoTrack ? (
            <video
              ref={videoEl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.3" />
                <path d="M4 20c0-4 3-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              </svg>
            </div>
          )}
        </div>

        {/* Device Controls */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {/* Microphone */}
          <div className="lk-button-group">
            <button
              type="button"
              className="lk-button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              aria-label="Toggle microphone"
              data-lk-source="microphone"
              data-lk-enabled={audioEnabled}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {audioEnabled ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 10V12C5 15.866 8.134 19 12 19C15.866 19 19 15.866 19 12V10M12 19V22M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 10V12C5 15.866 8.134 19 12 19C15.866 19 19 15.866 19 12V10M12 19V22M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 2L22 22" stroke="red" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="audioinput">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </MediaDeviceMenu>
            </div>
          </div>

          {/* Camera */}
          <div className="lk-button-group">
            <button
              type="button"
              className="lk-button"
              onClick={() => setVideoEnabled(!videoEnabled)}
              aria-label="Toggle camera"
              data-lk-source="camera"
              data-lk-enabled={videoEnabled}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {videoEnabled ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 10L22 7V17L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 10L22 7V17L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 2L22 22" stroke="red" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu kind="videoinput">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </MediaDeviceMenu>
            </div>
          </div>
        </div>

        {/* Username Input */}
        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'white',
            fontSize: '15px',
          }}
        />

        {/* Join Button */}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Join Room
        </button>
      </form>
    </div>
  );
}

