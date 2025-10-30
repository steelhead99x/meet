'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { 
  useLocalParticipant, 
  useTracks,
  ParticipantTile,
  TrackRefContext
} from '@livekit/components-react';
import { createRoot, Root } from 'react-dom/client';

/**
 * BrowserWindowPIP Component
 * 
 * Creates a separate always-on-top browser window (using Document PiP API) 
 * showing participant videos when screen sharing is active.
 * This mimics Zoom's behavior where a small participant window stays on top
 * during screen sharing.
 */
export function BrowserWindowPIP() {
  const { localParticipant } = useLocalParticipant();
  const [pipWindow, setPipWindow] = React.useState<Window | null>(null);
  const rootRef = React.useRef<Root | null>(null);
  
  // Get all tracks including screen shares
  const allTracks = useTracks([
    Track.Source.Camera,
    Track.Source.ScreenShare,
  ]);
  
  // Check if local participant is sharing screen
  const screenShareTracks = React.useMemo(() => {
    return allTracks.filter(track => 
      track.source === Track.Source.ScreenShare &&
      track.participant?.identity === localParticipant?.identity
    );
  }, [allTracks, localParticipant?.identity]);
  
  const isLocalScreenSharing = screenShareTracks.length > 0;

  // Get camera tracks (not screen shares) for the PIP view
  const cameraTracks = React.useMemo(() => {
    try {
      return allTracks.filter(track => 
        track.source === Track.Source.Camera && 
        track.publication && 
        track.participant
      );
    } catch (error) {
      console.error('Error filtering camera tracks:', error);
      return [];
    }
  }, [allTracks]);

  // Open/close PIP window based on screen share status
  React.useEffect(() => {
    const openPIPWindow = async () => {
      // Check if Document Picture-in-Picture API is available
      if (!('documentPictureInPicture' in window)) {
        console.warn('Document Picture-in-Picture API not supported in this browser');
        return;
      }

      try {
        console.log('[BrowserWindowPIP] Opening PIP window');
        
        // @ts-ignore - Document PiP API is not in TypeScript definitions yet
        const pipWindowInstance = await window.documentPictureInPicture.request({
          width: 500,
          height: 400,
          disallowReturnToOpener: false,
        });

        setPipWindow(pipWindowInstance);

        // Copy stylesheets to the PIP window
        const stylesheets = Array.from(document.styleSheets);
        stylesheets.forEach((stylesheet) => {
          try {
            if (stylesheet.href) {
              const link = pipWindowInstance.document.createElement('link');
              link.rel = 'stylesheet';
              link.href = stylesheet.href;
              pipWindowInstance.document.head.appendChild(link);
            } else if (stylesheet.cssRules) {
              const style = pipWindowInstance.document.createElement('style');
              Array.from(stylesheet.cssRules).forEach((rule) => {
                style.textContent += rule.cssText;
              });
              pipWindowInstance.document.head.appendChild(style);
            }
          } catch (e) {
            console.warn('Could not copy stylesheet:', e);
          }
        });

        // Add custom styles for the PIP window
        const style = pipWindowInstance.document.createElement('style');
        style.textContent = `
          body {
            margin: 0;
            padding: 0;
            background: #1a1a1a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
          }
          .pip-window-container {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          }
          .pip-window-header {
            background: rgba(0, 0, 0, 0.5);
            padding: 12px 16px;
            color: white;
            font-size: 14px;
            font-weight: 600;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .pip-window-title {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .pip-window-badge {
            background: #ef4444;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .pip-window-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            overflow: auto;
          }
          .pip-window-grid {
            display: grid;
            gap: 12px;
            width: 100%;
            height: 100%;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            grid-auto-rows: minmax(150px, 1fr);
          }
          .pip-window-participant {
            background: #2d2d2d;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          }
          .pip-window-empty {
            color: rgba(255, 255, 255, 0.5);
            text-align: center;
            font-size: 14px;
            padding: 40px 20px;
          }
        `;
        pipWindowInstance.document.head.appendChild(style);

        // Create root container
        const container = pipWindowInstance.document.createElement('div');
        container.id = 'pip-root';
        pipWindowInstance.document.body.appendChild(container);

        // Handle window close
        pipWindowInstance.addEventListener('pagehide', () => {
          console.log('[BrowserWindowPIP] PIP window closed');
          setPipWindow(null);
          if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
          }
        });

      } catch (error) {
        console.error('[BrowserWindowPIP] Error opening PIP window:', error);
      }
    };

    const closePIPWindow = () => {
      if (pipWindow) {
        console.log('[BrowserWindowPIP] Closing PIP window');
        pipWindow.close();
        setPipWindow(null);
        if (rootRef.current) {
          rootRef.current.unmount();
          rootRef.current = null;
        }
      }
    };

    if (isLocalScreenSharing && !pipWindow) {
      openPIPWindow();
    } else if (!isLocalScreenSharing && pipWindow) {
      closePIPWindow();
    }

    return () => {
      if (pipWindow) {
        closePIPWindow();
      }
    };
  }, [isLocalScreenSharing, pipWindow]);

  // Render content into PIP window
  React.useEffect(() => {
    if (!pipWindow) return;

    const container = pipWindow.document.getElementById('pip-root');
    if (!container) return;

    // Create or reuse React root
    if (!rootRef.current) {
      rootRef.current = createRoot(container);
    }

    // Render the participant grid
    rootRef.current.render(
      <PIPWindowContent 
        cameraTracks={cameraTracks}
        isLocalScreenSharing={isLocalScreenSharing}
      />
    );
  }, [pipWindow, cameraTracks, isLocalScreenSharing]);

  return null; // This component doesn't render anything in the main window
}

// Separate component for PIP window content
function PIPWindowContent({ 
  cameraTracks, 
  isLocalScreenSharing 
}: { 
  cameraTracks: any[];
  isLocalScreenSharing: boolean;
}) {
  if (!isLocalScreenSharing) return null;

  return (
    <div className="pip-window-container">
      <div className="pip-window-header">
        <div className="pip-window-title">
          <span>Participants ({cameraTracks.length})</span>
          <span className="pip-window-badge">Screen Sharing</span>
        </div>
      </div>
      
      <div className="pip-window-content">
        <div className="pip-window-grid">
          {cameraTracks.length > 0 ? (
            cameraTracks.map((trackRef) => (
              <div key={trackRef.participant.identity} className="pip-window-participant">
                <TrackRefContext.Provider value={trackRef}>
                  <ParticipantTile />
                </TrackRefContext.Provider>
              </div>
            ))
          ) : (
            <div className="pip-window-empty">
              <span>No participants with video</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

