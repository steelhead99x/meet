import React from 'react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import { TrackToggle } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { isLowPowerDevice } from './client-utils';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';

export function MicrophoneSettings() {
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

  React.useEffect(() => {
    // Load saved preference or enable Krisp by default on non-low power devices
    const prefs = loadUserPreferences();
    const shouldEnable = prefs.noiseFilterEnabled !== undefined 
      ? prefs.noiseFilterEnabled 
      : !isLowPowerDevice();
    
    setNoiseFilterEnabled(shouldEnable);
    console.log('[MicrophoneSettings] Noise filter enabled:', shouldEnable);
  }, [setNoiseFilterEnabled]);

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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
