'use client';

import { useEffect } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';

/**
 * Marks the local participant's video tile with data-lk-local="true"
 * so it can be styled differently (e.g., metadata at top-left)
 */
export function LocalParticipantMarker() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!room || !localParticipant) return;

    const markLocalTiles = () => {
      // Find all participant tiles
      const tiles = document.querySelectorAll('[data-lk-participant]');
      
      tiles.forEach((tile) => {
        const participantIdentity = tile.getAttribute('data-lk-participant');
        if (participantIdentity === localParticipant.identity) {
          tile.setAttribute('data-lk-local', 'true');
        } else {
          tile.removeAttribute('data-lk-local');
        }
      });
    };

    // Initial marking
    markLocalTiles();

    // Use MutationObserver to handle dynamically added tiles
    const observer = new MutationObserver(() => {
      markLocalTiles();
    });

    // Observe the video conference container for changes
    const videoConference = document.querySelector('[data-lk-theme]');
    if (videoConference) {
      observer.observe(videoConference, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-lk-participant'],
      });
    }

    // Also listen for participant events
    const handleParticipantConnected = () => {
      setTimeout(markLocalTiles, 100); // Small delay to let DOM update
    };

    room.on('participantConnected', handleParticipantConnected);
    room.on('participantDisconnected', handleParticipantConnected);

    return () => {
      observer.disconnect();
      room.off('participantConnected', handleParticipantConnected);
      room.off('participantDisconnected', handleParticipantConnected);
    };
  }, [room, localParticipant]);

  return null; // This component doesn't render anything
}

