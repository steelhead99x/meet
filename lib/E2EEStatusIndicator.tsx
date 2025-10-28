'use client';

import React from 'react';
import { useRoomContext } from '@livekit/components-react';
import styles from './E2EEStatusIndicator.module.css';
import { RoomEvent } from 'livekit-client';

export function E2EEStatusIndicator() {
  const room = useRoomContext();
  const [isEncrypted, setIsEncrypted] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    if (!room) return;

    // Listen for encryption status changes and initial connected state
    const handleParticipantEncryptionChanged = () => {
      setIsEncrypted(room.isE2EEEnabled);
      console.log('E2EE Status Indicator: updated isE2EEEnabled =', room.isE2EEEnabled);
    };
    const handleConnected = () => {
      setIsEncrypted(room.isE2EEEnabled);
      console.log('E2EE Status Indicator: connected, isE2EEEnabled =', room.isE2EEEnabled);
    };

    room.on(RoomEvent.ParticipantEncryptionStatusChanged, handleParticipantEncryptionChanged);
    room.on(RoomEvent.Connected, handleConnected);

    return () => {
      room.off(RoomEvent.ParticipantEncryptionStatusChanged, handleParticipantEncryptionChanged);
      room.off(RoomEvent.Connected, handleConnected);
    };
  }, [room]);

  if (!isEncrypted) {
    return (
      <div className={styles.container} data-encrypted="false">
        <button
          className={styles.indicator}
          onClick={() => setShowDetails(!showDetails)}
          title="Connection is not encrypted"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            <line x1="12" y1="16" x2="12" y2="18" />
          </svg>
          <span className={styles.text}>Not Encrypted</span>
        </button>
        {showDetails && (
          <div className={styles.details}>
            <p className={styles.detailsTitle}>⚠️ Media Not Encrypted</p>
            <ul className={styles.detailsList}>
              <li>Video: Not encrypted</li>
              <li>Audio: Not encrypted</li>
              <li>Chat: Not encrypted</li>
            </ul>
            <p className={styles.detailsNote}>Join with a secure room link to enable E2EE.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container} data-encrypted="true">
      <button
        className={styles.indicator}
        onClick={() => setShowDetails(!showDetails)}
        title="End-to-end encrypted connection"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <line x1="12" y1="16" x2="12" y2="18" />
        </svg>
        <span className={styles.text}>Encrypted</span>
      </button>
      {showDetails && (
        <div className={styles.details}>
          <p className={styles.detailsTitle}>🔒 End-to-End Encrypted</p>
          <ul className={styles.detailsList}>
            <li>✅ Video: Encrypted (E2EE)</li>
            <li>✅ Audio: Encrypted (E2EE)</li>
            <li>✅ Chat: Encrypted (E2EE)</li>
          </ul>
          <p className={styles.detailsNote}>Only room participants can decrypt your media and chat.</p>
        </div>
      )}
    </div>
  );
}

