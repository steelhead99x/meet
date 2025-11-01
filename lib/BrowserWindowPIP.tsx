'use client';

import React from 'react';
import { Track } from 'livekit-client';
import {
  useLocalParticipant,
  useTracks,
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

  // Check browser compatibility on mount
  React.useEffect(() => {
    const hasAPI = 'documentPictureInPicture' in window;
    console.log('[BrowserWindowPIP] 🔍 Component mounted');
    console.log('[BrowserWindowPIP] Browser support:', {
      hasDocumentPiPAPI: hasAPI,
      userAgent: navigator.userAgent,
    });
    if (!hasAPI) {
      console.warn('[BrowserWindowPIP] ⚠️  Document Picture-in-Picture not supported');
      console.warn('[BrowserWindowPIP] Please use Chrome 116+, Edge 116+, or similar');
    }
  }, []);
  
  // Get all tracks including screen shares
  const allTracks = useTracks([
    Track.Source.Camera,
    Track.Source.ScreenShare,
  ]);
  
  // Check if local participant is sharing screen
  const screenShareTracks = React.useMemo(() => {
    const tracks = allTracks.filter(track =>
      track.source === Track.Source.ScreenShare &&
      track.participant?.identity === localParticipant?.identity
    );
    console.log('[BrowserWindowPIP] Screen share tracks:', tracks.length, tracks);
    return tracks;
  }, [allTracks, localParticipant?.identity]);

  const isLocalScreenSharing = screenShareTracks.length > 0;

  // Debug logging
  React.useEffect(() => {
    console.log('[BrowserWindowPIP] State:', {
      isLocalScreenSharing,
      screenShareTracksCount: screenShareTracks.length,
      allTracksCount: allTracks.length,
      hasDocPiP: 'documentPictureInPicture' in window,
      hasPipWindow: !!pipWindow
    });
  }, [isLocalScreenSharing, screenShareTracks.length, allTracks.length, pipWindow]);

  // Get camera tracks (not screen shares) for the PIP view
  const cameraTracks = React.useMemo(() => {
    try {
      const tracks = allTracks.filter(track =>
        track.source === Track.Source.Camera &&
        track.publication &&
        track.participant
      );
      console.log('[BrowserWindowPIP] Camera tracks for PiP:', tracks.length, tracks);
      return tracks;
    } catch (error) {
      console.error('[BrowserWindowPIP] Error filtering camera tracks:', error);
      return [];
    }
  }, [allTracks]);

  // Open/close PIP window based on screen share status
  React.useEffect(() => {
    const openPIPWindow = async () => {
      // Check if Document Picture-in-Picture API is available
      if (!('documentPictureInPicture' in window)) {
        console.warn('[BrowserWindowPIP] Document Picture-in-Picture API not supported in this browser');
        console.warn('[BrowserWindowPIP] Requires Chrome 116+, Edge 116+, or similar Chromium-based browser');
        return;
      }

      try {
        console.log('[BrowserWindowPIP] 🎬 Opening PIP window...');
        console.log('[BrowserWindowPIP] API available:', window.documentPictureInPicture);

        // @ts-ignore - Document PiP API
        const pipWindowInstance = await window.documentPictureInPicture.requestWindow({
          width: 500,
          height: 400,
          disallowReturnToOpener: false,
        });

        console.log('[BrowserWindowPIP] ✅ PIP window created successfully!');

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
        console.error('[BrowserWindowPIP] ❌ Error opening PIP window:', error);
        if (error instanceof Error) {
          console.error('[BrowserWindowPIP] Error details:', error.message, error.stack);
        }
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
      console.log('[BrowserWindowPIP] 📺 Screen sharing started - waiting before opening PIP window');
      // Small delay to let screen share stabilize before opening PiP window
      // This prevents the browser from canceling screen share when PiP opens
      const timer = setTimeout(() => {
        console.log('[BrowserWindowPIP] Opening PIP window now');
        openPIPWindow();
      }, 500); // 500ms delay

      return () => clearTimeout(timer);
    } else if (!isLocalScreenSharing && pipWindow) {
      console.log('[BrowserWindowPIP] 🛑 Screen sharing stopped - closing PIP window');
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

// Separate component for PIP window content - uses direct video elements
// to avoid React context issues across separate windows
function PIPWindowContent({
  cameraTracks,
  isLocalScreenSharing
}: {
  cameraTracks: any[];
  isLocalScreenSharing: boolean;
}) {
  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const attachedTracksRef = React.useRef<Map<string, { track: any; element: HTMLVideoElement }>>(new Map());

  // Attach/detach tracks when cameraTracks change
  React.useEffect(() => {
    // If screen sharing stops, detach all tracks from PIP window (but keep them in main window)
    if (!isLocalScreenSharing) {
      console.log('[PIPWindowContent] Screen sharing stopped - detaching tracks from PIP window');
      attachedTracksRef.current.forEach((attached, participantId) => {
        console.log('[PIPWindowContent] Detaching track from PIP window for:', participantId);
        try {
          // Only detach from this specific video element (PIP window)
          // This ensures tracks remain attached to main browser window
          attached.track.detach(attached.element);
        } catch (error) {
          console.warn('[PIPWindowContent] Error detaching track:', error);
        }
      });
      attachedTracksRef.current.clear();
      return;
    }

    console.log('[PIPWindowContent] Rendering with:', {
      cameraTracks: cameraTracks.length,
      isLocalScreenSharing,
      tracks: cameraTracks.map(t => ({
        participant: t.participant?.identity,
        source: t.source,
      }))
    });

    // Attach tracks to video elements
    cameraTracks.forEach((trackRef) => {
      const videoEl = videoRefs.current.get(trackRef.participant.identity);
      if (videoEl && trackRef.publication?.track) {
        const participantId = trackRef.participant.identity;
        // Only attach if not already attached to this element
        if (!attachedTracksRef.current.has(participantId)) {
          console.log('[PIPWindowContent] Attaching track for:', participantId);
          trackRef.publication.track.attach(videoEl);
          attachedTracksRef.current.set(participantId, {
            track: trackRef.publication.track,
            element: videoEl,
          });
        }
      }
    });

    // Remove tracks that are no longer in the list
    const currentParticipantIds = new Set(cameraTracks.map(t => t.participant.identity));
    attachedTracksRef.current.forEach((attached, participantId) => {
      if (!currentParticipantIds.has(participantId)) {
        console.log('[PIPWindowContent] Detaching track (no longer in list) for:', participantId);
        try {
          attached.track.detach(attached.element);
        } catch (error) {
          console.warn('[PIPWindowContent] Error detaching track:', error);
        }
        attachedTracksRef.current.delete(participantId);
      }
    });
  }, [cameraTracks, isLocalScreenSharing]);

  // Cleanup: detach tracks ONLY when component actually unmounts (window closes)
  // This ensures tracks stay attached to main window video elements
  React.useEffect(() => {
    return () => {
      // Only detach when component is actually unmounting (PIP window closing)
      console.log('[PIPWindowContent] Component unmounting - detaching all tracks from PIP window');
      attachedTracksRef.current.forEach((attached, participantId) => {
        // Only detach from this specific video element (PIP window)
        // This prevents detaching from video elements in the main browser window
        console.log('[PIPWindowContent] Detaching track from PIP window for:', participantId);
        try {
          attached.track.detach(attached.element);
        } catch (error) {
          console.warn('[PIPWindowContent] Error detaching track:', error);
        }
      });
      attachedTracksRef.current.clear();
      videoRefs.current.clear();
    };
  }, []); // Only run cleanup on unmount

  if (!isLocalScreenSharing) {
    console.log('[PIPWindowContent] Not rendering - screen sharing is off');
    // Don't return null - instead return empty div to maintain component structure
    // The window should be closing anyway, but this prevents issues if it's still open
    return <div style={{ display: 'none' }} />;
  }

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
            cameraTracks.map((trackRef) => {
              const participantName = trackRef.participant?.identity || trackRef.participant?.name || 'Unknown';

              return (
                <div key={trackRef.participant.identity} className="pip-window-participant">
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current.set(trackRef.participant.identity, el);
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={trackRef.participant?.isLocal}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      backgroundColor: '#000',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}>
                    {participantName}
                  </div>
                </div>
              );
            })
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

