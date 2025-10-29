'use client';

import React from 'react';
import styles from '../styles/ChatToggleButton.module.css';

export interface ChatToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Floating chat toggle button
 * Positioned in the bottom-right corner of the screen
 * Shows notification badge for unread messages (future enhancement)
 */
export function ChatToggleButton({ isOpen, onToggle }: ChatToggleButtonProps) {
  console.log('🔵 ChatToggleButton RENDERING', { isOpen });
  
  return (
    <button
      onClick={onToggle}
      className={`${styles.chatToggle} ${isOpen ? styles.active : ''}`}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      aria-pressed={isOpen}
      type="button"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className={styles.label}>Chat</span>
    </button>
  );
}

