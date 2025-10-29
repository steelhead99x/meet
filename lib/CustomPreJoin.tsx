import React from 'react';
import { Track } from 'livekit-client';
import {
  TrackToggle,
  usePreviewDevice,
  usePreviewTracks,
  MediaDeviceMenu,
  VideoTrack,
  LocalUserChoices,
} from '@livekit/components-react';

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
  const [username, setUsername] = React.useState(defaults?.username ?? '');
  const [videoEnabled, setVideoEnabled] = React.useState(defaults?.videoEnabled ?? true);
  const [audioEnabled, setAudioEnabled] = React.useState(defaults?.audioEnabled ?? true);

  const tracks = usePreviewTracks(
    {
      audio: audioEnabled,
      video: videoEnabled,
    },
    onError,
  );

  const videoEl = React.useRef<HTMLVideoElement>(null);
  const videoTrack = tracks?.filter((t) => t.kind === Track.Kind.Video)[0];

  React.useEffect(() => {
    if (videoEl.current && videoTrack) {
      videoTrack.attach(videoEl.current);
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const values: LocalUserChoices = {
      username,
      videoEnabled,
      audioEnabled,
      videoDeviceId: tracks?.find((t) => t.kind === Track.Kind.Video)?.mediaStreamTrack.getSettings().deviceId,
      audioDeviceId: tracks?.find((t) => t.kind === Track.Kind.Audio)?.mediaStreamTrack.getSettings().deviceId,
    };

    if (onValidate && !onValidate(values)) {
      return;
    }

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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

