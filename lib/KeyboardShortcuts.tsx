'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { useTrackToggle } from '@livekit/components-react';

export function KeyboardShortcuts() {
  const { toggle: toggleMic } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCamera } = useTrackToggle({ source: Track.Source.Camera });
  const { toggle: toggleScreenShare } = useTrackToggle({ source: Track.Source.ScreenShare });

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

      // Toggle screen share: Cmd/Ctrl-S
      if (toggleScreenShare && event.key === 'S' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleScreenShare();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleMic, toggleCamera, toggleScreenShare]);

  return null;
}
