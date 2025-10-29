'use client';

import React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import styles from './E2EEStatusIndicator.module.css';

export function ParticipantE2EEIndicator({ participant }: { participant: Participant }) {
  const room = useRoomContext();
  const [isEncrypted, setIsEncrypted] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    if (!room) return;

    // Check if this participant's tracks are encrypted
    const updateEncryptionStatus = () => {
      const encrypted = room.isE2EEEnabled;
      setIsEncrypted(encrypted);
    };

    updateEncryptionStatus();

    // Listen for encryption status changes
    const handleEncryptionChanged = () => {
      updateEncryptionStatus();
    };

    room.on('participantEncryptionStatusChanged' as any, handleEncryptionChanged);
    room.on('encryptionStateChanged' as any, handleEncryptionChanged);

    return () => {
      room.off('participantEncryptionStatusChanged' as any, handleEncryptionChanged);
      room.off('encryptionStateChanged' as any, handleEncryptionChanged);
    };
  }, [room, participant]);

  if (!isEncrypted) {
    return (
      <div className={styles.container} data-encrypted="false">
        <button
          className={styles.indicator}
          onClick={() => setShowDetails(!showDetails)}
          title="Not encrypted"
        >
          <svg
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
        </button>
        {showDetails && (
          <div className={styles.details}>
            <p className={styles.detailsTitle}>⚠️ Not Encrypted</p>
            <p className={styles.detailsNote}>This participant&apos;s media is not encrypted.</p>
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
        title="End-to-end encrypted"
      >
        <svg
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
      </button>
      {showDetails && (
        <div className={styles.details}>
          <p className={styles.detailsTitle}>🔒 Encrypted</p>
          <p className={styles.detailsNote}>This participant&apos;s media is end-to-end encrypted.</p>
        </div>
      )}
    </div>
  );
}

