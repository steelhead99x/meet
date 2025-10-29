'use client';

import React from 'react';
import { Chat } from '@livekit/components-react';
import styles from '../styles/ChatPanel.module.css';

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messageFormatter?: (message: string) => React.ReactNode;
}

/**
 * Responsive Chat Panel component that works across desktop, tablet, and mobile devices
 * 
 * Features:
 * - Slides in from the right on desktop/tablet
 * - Full-screen on mobile devices (< 768px)
 * - Dismissible with close button or backdrop click
 * - Responsive sizing and layout
 */
export function ChatPanel({
  isOpen,
  onClose,
  messageFormatter,
}: ChatPanelProps) {
  // Close on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent scroll on body when chat is open on mobile
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={styles.backdrop}
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close chat"
      />

      {/* Chat Panel */}
      <div className={styles.chatPanel} role="complementary" aria-label="Chat panel">
        {/* Header */}
        <div className={styles.chatHeader}>
          <h2 className={styles.chatTitle}>Messages</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close chat"
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat Component - Using LiveKit v2 native chat API */}
        <div className={styles.chatContent}>
          <Chat
            messageFormatter={messageFormatter}
          />
        </div>
      </div>
    </>
  );
}

