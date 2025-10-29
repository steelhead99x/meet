'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { useLocalParticipant, useTracks } from '@livekit/components-react';

/**
 * ScreenSharePIP Component
 * 
 * Monitors screen share status and automatically puts the browser into a
 * Picture-in-Picture style floating window when screen sharing is active.
 * Window is sized at 480p (854x480) in 16:9 aspect ratio and stays on top.
 */
export function ScreenSharePIP() {
  const { localParticipant } = useLocalParticipant();
  const [isPIPMode, setIsPIPMode] = React.useState(false);
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  
  // Check if local participant is sharing screen
  const isLocalScreenSharing = React.useMemo(() => {
    if (!localParticipant) return false;
    
    const screenTrack = Array.from(localParticipant.trackPublications.values()).find(
      (pub) => pub.source === Track.Source.ScreenShare
    );
    
    return screenTrack !== undefined && screenTrack.track !== undefined;
  }, [localParticipant, screenShareTracks]);

  React.useEffect(() => {
    if (isLocalScreenSharing && !isPIPMode) {
      // Enter PIP mode
      enterPIPMode();
      setIsPIPMode(true);
    } else if (!isLocalScreenSharing && isPIPMode) {
      // Exit PIP mode
      exitPIPMode();
      setIsPIPMode(false);
    }
  }, [isLocalScreenSharing, isPIPMode]);

  const enterPIPMode = () => {
    // Add PIP mode class to body for styling
    document.body.classList.add('pip-mode');
    
    // Try to resize window if running in Electron or as a PWA with window management
    if (typeof window !== 'undefined') {
      // 480p at 16:9 = 854x480
      const pipWidth = 854;
      const pipHeight = 480;
      
      // Position in bottom-right corner with some padding
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const padding = 20;
      
      const left = screenWidth - pipWidth - padding;
      const top = screenHeight - pipHeight - padding - 100; // Extra space for taskbar
      
      try {
        // Attempt to resize and reposition window
        window.resizeTo(pipWidth, pipHeight);
        window.moveTo(left, top);
        
        // Request always-on-top behavior (works in some environments)
        if ((window as any).electronAPI?.setAlwaysOnTop) {
          (window as any).electronAPI.setAlwaysOnTop(true);
        }
      } catch (e) {
        console.log('Window manipulation not available in this environment');
      }
    }
  };

  const exitPIPMode = () => {
    // Remove PIP mode class
    document.body.classList.remove('pip-mode');
    
    // Restore window size
    if (typeof window !== 'undefined') {
      try {
        // Restore to a reasonable default size
        window.resizeTo(1280, 720);
        
        // Center the window
        const left = (window.screen.width - 1280) / 2;
        const top = (window.screen.height - 720) / 2;
        window.moveTo(left, top);
        
        if ((window as any).electronAPI?.setAlwaysOnTop) {
          (window as any).electronAPI.setAlwaysOnTop(false);
        }
      } catch (e) {
        console.log('Window manipulation not available in this environment');
      }
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (isPIPMode) {
        exitPIPMode();
      }
    };
  }, [isPIPMode]);

  return null; // This component doesn't render anything visible
}

