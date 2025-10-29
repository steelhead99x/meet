'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { useTrackToggle } from '@livekit/components-react';

export interface KeyboardShortcutsProps {
  onToggleChat?: () => void;
}

export function KeyboardShortcuts({ onToggleChat }: KeyboardShortcutsProps) {
  const { toggle: toggleMic } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCamera } = useTrackToggle({ source: Track.Source.Camera });

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      // Toggle microphone: Cmd/Ctrl-A
      if (toggleMic && event.key === 'A' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleMic();
      }

      // Toggle camera: Cmd/Ctrl-V
      if (event.key === 'V' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleCamera();
      }

      // Toggle chat: Cmd/Ctrl-Shift-C
      if (event.key === 'C' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        if (onToggleChat) {
          onToggleChat();
        }
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleMic, toggleCamera, onToggleChat]);

  return null;
}
