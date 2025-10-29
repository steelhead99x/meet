'use client';

import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import ReactDOM from 'react-dom/client';
import { ConnectionQualityIndicator } from './ConnectionQualityIndicator';

/**
 * Enhances all connection quality indicators in the VideoConference component
 * by replacing them with our custom ConnectionQualityIndicator that shows
 * detailed statistics on hover.
 * 
 * This component uses a MutationObserver to watch for new participant tiles
 * and replaces their connection quality indicators.
 */
export function ConnectionQualityEnhancer() {
  const room = useRoomContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !room) return;

    // Map to store React roots for cleanup
    const rootsMap = new Map<Element, any>();

    /**
     * Replace LiveKit's default connection quality indicator with our custom one
     */
    const enhanceConnectionQualityIndicators = () => {
      // Find all participant tiles
      const participantTiles = document.querySelectorAll('[data-lk-participant]');
      
      console.log('[ConnectionQualityEnhancer] Found participant tiles:', participantTiles.length);
      
      participantTiles.forEach((tile) => {
        const participantIdentity = tile.getAttribute('data-lk-participant');
        if (!participantIdentity) return;

        // Find the participant object
        let participant: Participant | undefined;
        if (room.localParticipant.identity === participantIdentity) {
          participant = room.localParticipant;
        } else {
          participant = room.remoteParticipants.get(participantIdentity);
        }

        if (!participant) {
          console.log('[ConnectionQualityEnhancer] Participant not found for:', participantIdentity);
          return;
        }

        // Try multiple selectors to find the connection quality indicator
        let connectionQualityEl = 
          tile.querySelector('.lk-connection-quality') ||
          tile.querySelector('[class*="connection-quality"]') ||
          tile.querySelector('[data-lk-connection-quality]');
        
        console.log('[ConnectionQualityEnhancer] Connection quality element:', connectionQualityEl, 'for', participantIdentity);

        if (!connectionQualityEl) {
          // If we can't find the element, log the tile structure for debugging
          console.log('[ConnectionQualityEnhancer] Could not find connection quality element. Tile classes:', tile.className);
          return;
        }

        // Skip if already enhanced
        if (connectionQualityEl.hasAttribute('data-enhanced')) {
          console.log('[ConnectionQualityEnhancer] Already enhanced:', participantIdentity);
          return;
        }

        console.log('[ConnectionQualityEnhancer] Enhancing indicator for:', participantIdentity);

        // Mark as enhanced
        connectionQualityEl.setAttribute('data-enhanced', 'true');

        // Clear existing content
        connectionQualityEl.innerHTML = '';

        // Create a container for our React component
        const container = document.createElement('div');
        container.style.display = 'contents';
        connectionQualityEl.appendChild(container);

        // Render our custom ConnectionQualityIndicator
        try {
          const root = (ReactDOM as any).createRoot(container);
          root.render(<ConnectionQualityIndicator participant={participant} />);
          rootsMap.set(connectionQualityEl, root);
          console.log('[ConnectionQualityEnhancer] Successfully enhanced:', participantIdentity);
        } catch (error) {
          console.error('[ConnectionQualityEnhancer] Failed to enhance connection quality indicator:', error);
        }
      });
    };

    // Initial enhancement with retries to catch elements as they render
    enhanceConnectionQualityIndicators();
    setTimeout(enhanceConnectionQualityIndicators, 100);
    setTimeout(enhanceConnectionQualityIndicators, 300);
    setTimeout(enhanceConnectionQualityIndicators, 1000);

    // Watch for changes in the DOM (new participants joining, etc.)
    const observer = new MutationObserver((mutations) => {
      // Check if any mutations added new participant tiles or modified elements
      const shouldReenhance = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            ((node as Element).hasAttribute('data-lk-participant') ||
              (node as Element).querySelector('[data-lk-participant]') ||
              (node as Element).matches('[class*="connection"]') ||
              (node as Element).querySelector('[class*="connection"]'))
        )
      );

      if (shouldReenhance) {
        setTimeout(enhanceConnectionQualityIndicators, 50);
      }
    });

    // Start observing the document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Re-enhance when participants change
    const handleParticipantChange = () => {
      // Wait a bit for LiveKit to render the participant
      setTimeout(enhanceConnectionQualityIndicators, 100);
      setTimeout(enhanceConnectionQualityIndicators, 300);
    };

    room.on('participantConnected', handleParticipantChange);
    room.on('participantDisconnected', handleParticipantChange);

    return () => {
      observer.disconnect();
      room.off('participantConnected', handleParticipantChange);
      room.off('participantDisconnected', handleParticipantChange);

      // Cleanup React roots
      rootsMap.forEach((root) => {
        try {
          root.unmount();
        } catch (error) {
          // Ignore unmount errors
        }
      });
      rootsMap.clear();
    };
  }, [room, mounted]);

  return null; // This component doesn't render anything itself
}

