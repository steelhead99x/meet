import React from 'react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import { TrackToggle, useLocalParticipant } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { isLowPowerDevice } from './client-utils';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';

export function MicrophoneSettings() {
  const { localParticipant } = useLocalParticipant();
  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } = useKrispNoiseFilter(
    {
      filterOptions: {
        bufferOverflowMs: 100,
        bufferDropMs: 200,
        quality: isLowPowerDevice() ? 'low' : 'medium',
        onBufferDrop: () => {
          console.warn(
            'krisp buffer dropped, noise filter versions >= 0.3.2 will automatically disable the filter',
          );
        },
      },
    },
  );

  // Check if microphone is currently enabled
  const isMicrophoneEnabled = localParticipant?.isMicrophoneEnabled ?? false;

  // Track if we've initialized Krisp to avoid repeated initialization
  const hasInitializedRef = React.useRef(false);

  // Initialize Krisp: enabled by default regardless of mic state
  React.useEffect(() => {
    if (isNoiseFilterPending) return; // Don't interfere if operation is in progress

    // Initialize Krisp on first mount - enabled by default
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const prefs = loadUserPreferences();
      
      // If no saved preference exists, enable by default (even if mic is muted)
      if (prefs.noiseFilterEnabled === undefined) {
        setNoiseFilterEnabled(true);
        console.log('[MicrophoneSettings] Initializing Krisp to default enabled state (even with muted audio)');
      } else {
        // Respect saved preference
        if (prefs.noiseFilterEnabled !== isNoiseFilterEnabled) {
          setNoiseFilterEnabled(prefs.noiseFilterEnabled);
        }
      }
      return;
    }

    // After initialization, always enable Krisp when microphone is enabled
    if (isMicrophoneEnabled && !isNoiseFilterEnabled) {
      console.log('[MicrophoneSettings] Microphone is enabled, auto-enabling Krisp noise suppression');
      setNoiseFilterEnabled(true);
    }
  }, [isMicrophoneEnabled, isNoiseFilterEnabled, isNoiseFilterPending, setNoiseFilterEnabled]);

  // Save noise filter preference when it changes
  React.useEffect(() => {
    if (!isNoiseFilterPending) {
      saveUserPreferences({ noiseFilterEnabled: isNoiseFilterEnabled });
    }
  }, [isNoiseFilterEnabled, isNoiseFilterPending]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <section className="lk-button-group">
        <TrackToggle aria-label="Toggle microphone" source={Track.Source.Microphone} />
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </MediaDeviceMenu>
        </div>
      </section>

      <button
        className="lk-button"
        onClick={() => setNoiseFilterEnabled(!isNoiseFilterEnabled)}
        disabled={isNoiseFilterPending}
        aria-pressed={isNoiseFilterEnabled}
        aria-label={isNoiseFilterEnabled ? 'Disable Noise Cancellation' : 'Enable Noise Cancellation'}
        style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          minWidth: '48px',
          minHeight: '48px',
          position: 'relative',
          // Visual indication when enabled
          background: isNoiseFilterEnabled ? 'rgba(59, 130, 246, 0.15)' : undefined,
          border: isNoiseFilterEnabled ? '1px solid rgba(59, 130, 246, 0.3)' : undefined,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="9" y="2" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M5 10C5 10 5 14 12 17M19 10C19 10 19 14 12 17M12 17V21M8 21H16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {!isNoiseFilterEnabled && (
            <path d="M2 2L22 22" stroke="red" strokeWidth="2.5" strokeLinecap="round"/>
          )}
        </svg>
      </button>
    </div>
  );
}
