'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { useTrackToggle } from '@livekit/components-react';
import { useMaybeLayoutContext } from '@livekit/components-react';

export function KeyboardShortcuts() {
  const { toggle: toggleMic } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCamera } = useTrackToggle({ source: Track.Source.Camera });
  const layoutContext = useMaybeLayoutContext();

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

      // Toggle chat: Cmd/Ctrl-C
      if (event.key === 'c' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        if (layoutContext?.widget.dispatch) {
          const currentShowChat = layoutContext.widget.state?.showChat ?? false;
          layoutContext.widget.dispatch({
            msg: 'show_chat',
            visible: !currentShowChat,
          });
        }
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleMic, toggleCamera, layoutContext]);

  return null;
}
