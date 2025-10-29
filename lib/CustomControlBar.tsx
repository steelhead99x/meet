import React from 'react';
import { Track } from 'livekit-client';
import {
  TrackToggle,
  useLocalParticipant,
  usePersistentUserChoices,
  MediaDeviceMenu,
  useRoomContext,
  ChatToggle,
  DisconnectButton,
} from '@livekit/components-react';
import { SettingsMenu } from './SettingsMenu';

const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true';

export function CustomControlBar() {
  const room = useRoomContext();
  const { microphoneTrack, cameraTrack } = useLocalParticipant();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const handleScreenShare = async () => {
    try {
      if (room.localParticipant.isScreenShareEnabled) {
        await room.localParticipant.setScreenShareEnabled(false);
      } else {
        await room.localParticipant.setScreenShareEnabled(true);
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  return (
    <div className="lk-control-bar">
      {/* Microphone with dropdown */}
      <div className="lk-button-group">
        <TrackToggle source={Track.Source.Microphone} />
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </MediaDeviceMenu>
        </div>
      </div>

      {/* Camera with dropdown */}
      <div className="lk-button-group">
        <TrackToggle source={Track.Source.Camera} />
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </MediaDeviceMenu>
        </div>
      </div>

      {/* Screen Share */}
      <TrackToggle
        source={Track.Source.ScreenShare}
        captureOptions={{ audio: true, selfBrowserSurface: 'exclude' }}
      />

      {/* Chat Toggle */}
      <ChatToggle />

      {/* Settings */}
      {SHOW_SETTINGS_MENU && (
        <button
          className="lk-button lk-settings-menu-toggle"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-label="Settings"
          aria-pressed={isSettingsOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Disconnect/Leave */}
      <DisconnectButton />

      {/* Settings Modal */}
      {isSettingsOpen && SHOW_SETTINGS_MENU && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsSettingsOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SettingsMenu onClose={() => setIsSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

