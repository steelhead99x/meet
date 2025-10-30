'use client';

import React from 'react';
import { Track } from 'livekit-client';
import { 
  useLocalParticipant, 
  useTracks,
  ParticipantTile,
  TrackRefContext
} from '@livekit/components-react';
import '@/styles/ScreenSharePIP.css';

/**
 * ScreenSharePIP Component
 * 
 * Creates a floating Picture-in-Picture overlay showing participant videos
 * when screen sharing is active. The overlay is draggable, resizable,
 * and stays on top at 16:9 aspect ratio with max 480p size.
 */
export function ScreenSharePIP() {
  const { localParticipant } = useLocalParticipant();
  const [isPIPVisible, setIsPIPVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const pipRef = React.useRef<HTMLDivElement>(null);
  
  // Get all tracks including screen shares
  const allTracks = useTracks([
    Track.Source.Camera,
    Track.Source.ScreenShare,
  ]);
  
  // Check if local participant is sharing screen
  // We need to check the actual screen share tracks from useTracks to detect changes
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

  // Show/hide PIP based on screen share status
  React.useEffect(() => {
    console.log('[ScreenSharePIP] Screen share status changed:', {
      isLocalScreenSharing,
      screenShareTracksCount: screenShareTracks.length,
      localParticipantIdentity: localParticipant?.identity,
      allTracksCount: allTracks.length
    });
    
    setIsPIPVisible(isLocalScreenSharing);
    
    // Add/remove class to body to hide the main video grid
    if (isLocalScreenSharing) {
      console.log('[ScreenSharePIP] Activating PIP overlay');
      document.body.classList.add('screenshare-pip-active');
    } else {
      console.log('[ScreenSharePIP] Hiding PIP overlay');
      document.body.classList.remove('screenshare-pip-active');
    }
  }, [isLocalScreenSharing, screenShareTracks.length, localParticipant?.identity, allTracks.length]);

  // Mouse down handler for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === pipRef.current || (e.target as HTMLElement).classList.contains('pip-drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  // Mouse move handler for dragging
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - (pipRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (pipRef.current?.offsetHeight || 0);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Log camera tracks for debugging
  React.useEffect(() => {
    if (isPIPVisible) {
      console.log('[ScreenSharePIP] Camera tracks update:', {
        count: cameraTracks.length,
        tracks: cameraTracks.map(t => ({
          participant: t.participant?.identity,
          source: t.source,
          hasPublication: !!t.publication,
        }))
      });
    }
  }, [isPIPVisible, cameraTracks]);

  if (!isPIPVisible) {
    return null;
  }

  return (
    <div
      ref={pipRef}
      className="screenshare-pip-container"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="pip-drag-handle">
        <span className="pip-title">Participants ({cameraTracks.length})</span>
        <span className="pip-drag-icon">⋮⋮</span>
      </div>
      
      <div className="pip-content">
        <div className="pip-grid">
          {cameraTracks.length > 0 ? (
            cameraTracks.map((trackRef) => (
              <div key={trackRef.participant.identity} className="pip-participant">
                <TrackRefContext.Provider value={trackRef}>
                  <ParticipantTile />
                </TrackRefContext.Provider>
              </div>
            ))
          ) : (
            <div className="pip-empty">
              <span>No participants with video</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

