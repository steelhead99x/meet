import React from 'react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import { TrackToggle } from '@livekit/components-react';
import { MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { isLowPowerDevice } from './client-utils';

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
    // enable Krisp by default on non-low power devices
    setNoiseFilterEnabled(!isLowPowerDevice());
  }, [setNoiseFilterEnabled]);
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
          <MediaDeviceMenu kind="audioinput" />
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1C12 1 8 5 8 12C8 15 10 18 12 19M12 1C12 1 16 5 16 12C16 15 14 18 12 19M12 1V19M12 19V23M9 23H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {!isNoiseFilterEnabled && (
            <path d="M2 2L22 22" stroke="red" strokeWidth="2.5" strokeLinecap="round"/>
          )}
        </svg>
      </button>
    </div>
  );
}
