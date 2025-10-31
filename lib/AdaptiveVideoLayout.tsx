/**
 * Adaptive Video Layout Component
 *
 * Provides zoom-like responsive video layout that adapts to:
 * - Participant count
 * - Device orientation (portrait/landscape)
 * - Screen size (mobile/desktop)
 *
 * Features:
 * - PIP layout (one large + one small) for focused viewing
 * - Fill-screen scaling (object-fit: cover) like Zoom
 * - Automatic orientation detection
 * - Persisted layout preferences
 */

'use client';

import React from 'react';
import {
  useTracks,
  VideoTrack,
  useParticipants,
  TrackReference,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';

export function AdaptiveVideoLayout() {
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Filter to get camera tracks only (no screen shares) and ensure they have publications
  const cameraTracks = tracks.filter(
    (track) => track.source === Track.Source.Camera && track.publication
  );

  // State for orientation and layout
  const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>('landscape');
  const [focusedTrackIndex, setFocusedTrackIndex] = React.useState(0);

  // Load preferences
  const preferences = React.useMemo(() => loadUserPreferences(), []);

  // Detect orientation changes
  React.useEffect(() => {
    const updateOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setOrientation(isPortrait ? 'portrait' : 'landscape');
      console.log('[AdaptiveVideoLayout] Orientation changed:', isPortrait ? 'portrait' : 'landscape');
    };

    // Initial orientation
    updateOrientation();

    // Listen for orientation/resize changes
    window.addEventListener('orientationchange', updateOrientation);
    window.addEventListener('resize', updateOrientation);

    return () => {
      window.removeEventListener('orientationchange', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  // Save orientation preference when it changes
  React.useEffect(() => {
    saveUserPreferences({ preferredOrientation: orientation });
  }, [orientation]);

  // Determine layout based on participant count
  const layoutType = React.useMemo(() => {
    const count = cameraTracks.length;
    if (count <= 1) return 'single';
    if (count === 2) return 'pip'; // Picture-in-picture for 2 people
    if (count <= 4) return 'pip'; // PIP works well up to 4 people
    return 'grid'; // Grid for 5+ people
  }, [cameraTracks.length]);

  console.log('[AdaptiveVideoLayout] Rendering', {
    participantCount: participants.length,
    trackCount: cameraTracks.length,
    layoutType,
    orientation,
  });

  // Handle tap to switch focused participant in PIP mode
  const handleTrackClick = (index: number) => {
    if (layoutType === 'pip') {
      setFocusedTrackIndex(index);
      console.log('[AdaptiveVideoLayout] Switched focus to participant', index);
    }
  };

  // Single participant view
  if (layoutType === 'single') {
    const singleTrack = cameraTracks[0];

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
        }}
      >
        {singleTrack ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <VideoTrack
              trackRef={singleTrack}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover', // Fill screen, crop sides if needed (Zoom-like)
              }}
            />
            <ParticipantInfo participant={singleTrack.participant} />
          </div>
        ) : (
          <div style={{ color: 'white', fontSize: '18px' }}>
            Waiting for participants...
          </div>
        )}
      </div>
    );
  }

  // PIP layout (one large + one/more small)
  if (layoutType === 'pip') {
    const focusedTrack = cameraTracks[focusedTrackIndex] || cameraTracks[0];
    const otherTracks = cameraTracks.filter((_, index) => index !== focusedTrackIndex);

    if (!focusedTrack) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
          }}
        >
          <div style={{ color: 'white', fontSize: '18px' }}>
            Waiting for participants...
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          background: '#000',
        }}
      >
        {/* Large focused video */}
        <div
          onClick={() => handleTrackClick(focusedTrackIndex === 0 ? 1 : 0)}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          <VideoTrack
            trackRef={focusedTrack}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover', // Fill screen, faces centered
            }}
          />
          <ParticipantInfo participant={focusedTrack.participant} />
        </div>

        {/* Small PIP videos in corner */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: 'calc(100% - 32px)',
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {otherTracks.map((track, index) => {
            const actualIndex = cameraTracks.indexOf(track);
            return (
              <div
                key={track.participant.identity}
                onClick={() => handleTrackClick(actualIndex)}
                style={{
                  width: orientation === 'portrait' ? '100px' : '160px',
                  height: orientation === 'portrait' ? '133px' : '90px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  position: 'relative',
                  background: '#1a1a1a',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
              >
                <VideoTrack
                  trackRef={track}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <ParticipantInfo participant={track.participant} isSmall />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid layout for 5+ participants
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns:
          orientation === 'portrait'
            ? cameraTracks.length <= 2
              ? '1fr'
              : '1fr 1fr'
            : cameraTracks.length <= 3
            ? `repeat(${cameraTracks.length}, 1fr)`
            : 'repeat(3, 1fr)',
        gridAutoRows: '1fr',
        gap: '8px',
        padding: '8px',
        background: '#000',
      }}
    >
      {cameraTracks.map((track, index) => (
        <div
          key={track.participant.identity}
          onClick={() => handleTrackClick(index)}
          style={{
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#1a1a1a',
            cursor: 'pointer',
          }}
        >
          <VideoTrack
            trackRef={track}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <ParticipantInfo participant={track.participant} />
        </div>
      ))}
    </div>
  );
}

/**
 * Participant name overlay component
 */
function ParticipantInfo({
  participant,
  isSmall = false,
}: {
  participant: Participant;
  isSmall?: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: isSmall ? '4px' : '12px',
        left: isSmall ? '4px' : '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: isSmall ? '2px 6px' : '4px 12px',
        borderRadius: '4px',
        fontSize: isSmall ? '10px' : '14px',
        fontWeight: 500,
        maxWidth: 'calc(100% - 24px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {participant.name || participant.identity}
    </div>
  );
}
