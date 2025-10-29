'use client';

import React from 'react';
import styles from '../styles/KeyboardShortcutsHelp.module.css';

export function KeyboardShortcutsHelp() {
  const [isVisible, setIsVisible] = React.useState(false);

  // Memoize the event handler to prevent re-creating on every render
  const handleKeyPress = React.useCallback((event: KeyboardEvent) => {
    // Show shortcuts help with Shift + ?
    if (event.key === '?' && event.shiftKey) {
      event.preventDefault();
      setIsVisible((prev) => !prev);
    }
    // Hide with Escape
    if (event.key === 'Escape' && isVisible) {
      event.preventDefault();
      setIsVisible(false);
    }
  }, [isVisible]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  if (!isVisible) {
    return (
      <button
        className={styles.helpButton}
        onClick={() => setIsVisible(true)}
        aria-label="Show keyboard shortcuts"
        title="Show keyboard shortcuts (Shift + ?)"
      >
        ?
      </button>
    );
  }

  return (
    <div className={styles.overlay} onClick={() => setIsVisible(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button
            className={styles.closeButton}
            onClick={() => setIsVisible(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className={styles.content}>
          <div className={styles.shortcut}>
            <kbd>Cmd/Ctrl</kbd> + <kbd>A</kbd>
            <span>Toggle Microphone</span>
          </div>
          <div className={styles.shortcut}>
            <kbd>Cmd/Ctrl</kbd> + <kbd>V</kbd>
            <span>Toggle Camera</span>
          </div>
          <div className={styles.shortcut}>
            <kbd>Shift</kbd> + <kbd>?</kbd>
            <span>Show/Hide This Help</span>
          </div>
        </div>
        <div className={styles.footer}>
          <p>Press <kbd>Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}

