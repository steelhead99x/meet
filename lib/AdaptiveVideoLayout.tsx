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
  isTrackReference,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { loadUserPreferences, saveUserPreferences } from './userPreferences';

/**
 * Helper function to check if a track should show a placeholder
 * Returns true if the track is muted or doesn't have a video stream
 */
function shouldShowPlaceholder(
  trackRef: TrackReference | undefined,
  participant?: Participant
): boolean {
  if (!trackRef) return true;
  
  // Primary check: Use participant's camera track publication if available
  if (participant) {
    // Find camera track publication (not screen share)
    const cameraPub = Array.from(participant.videoTrackPublications.values()).find(
      (pub) => pub.source === Track.Source.Camera
    );
    
    if (!cameraPub) {
      // No camera publication exists - show placeholder
      return true;
    }
    
    // Check if camera is muted or has no track
    if (cameraPub.isMuted || !cameraPub.track) {
      return true;
    }
  }
  
  // Secondary check: Check if trackRef has a publication property (for remote tracks)
  const publication = (trackRef as any).publication;
  if (publication) {
    if (publication.isMuted || !publication.track) {
      return true;
    }
  } else {
    // If trackRef has no publication, it's a manually created placeholder
    // Show placeholder if participant has no video track publications
    if (!participant || participant.videoTrackPublications.size === 0) {
      return true;
    }
  }
  
  // Final fallback: If TrackReference was created without a real track
  if (!publication && !participant?.videoTrackPublications.size) {
    return true;
  }
  
  return false;
}

/**
 * Placeholder component for participants with video disabled
 */
function VideoPlaceholder({
  participant,
  size = 'normal',
}: {
  participant: Participant;
  size?: 'small' | 'normal';
}) {
  // Get initials from participant name or identity
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = participant.name || participant.identity;
  const initials = getInitials(displayName);

  return (
    <div
      className="lk-participant-placeholder"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)',
        width: '100%',
        height: '100%',
      }}
    >
      {/* Avatar circle with initials */}
      <div
        style={{
          width: size === 'small' ? '48px' : '80px',
          height: size === 'small' ? '48px' : '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size === 'small' ? '18px' : '32px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        {initials}
      </div>
      
      {/* Camera off icon indicator */}
      <div
        style={{
          marginTop: size === 'small' ? '4px' : '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: size === 'small' ? '10px' : '12px',
        }}
      >
        <svg
          width={size === 'small' ? '12' : '16'}
          height={size === 'small' ? '12' : '16'}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <line x1="12" y1="17" x2="12" y2="17" />
        </svg>
      </div>
    </div>
  );
}

export function AdaptiveVideoLayout() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Load mirror video preference - reactive to localStorage changes
  const [mirrorVideo, setMirrorVideo] = React.useState(() => {
    const prefs = loadUserPreferences();
    return prefs.mirrorVideo !== undefined ? prefs.mirrorVideo : true;
  });

  // Listen for storage changes to update mirror preference
  React.useEffect(() => {
    const handleStorageChange = () => {
      const prefs = loadUserPreferences();
      setMirrorVideo(prefs.mirrorVideo !== undefined ? prefs.mirrorVideo : true);
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom storage events (for same-tab updates)
    const interval = setInterval(() => {
      const prefs = loadUserPreferences();
      const currentMirror = prefs.mirrorVideo !== undefined ? prefs.mirrorVideo : true;
      setMirrorVideo(prev => {
        if (prev !== currentMirror) {
          return currentMirror;
        }
        return prev;
      });
    }, 500); // Check every 500ms

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Get camera tracks for all participants (including placeholders)
  // When withPlaceholder: true, useTracks returns placeholder tracks for participants without video
  // Order them to match the participants array order for consistent layout
  const cameraTracks: TrackReference[] = React.useMemo(() => {
    // Filter to get all camera tracks (including placeholders)
    const allCameraTracks = tracks.filter(
      (track): track is TrackReference =>
        track.source === Track.Source.Camera &&
        isTrackReference(track) &&
        track.participant !== undefined
    );
    
    // Create a map for quick lookup
    const trackMap = new Map<string, TrackReference>();
    allCameraTracks.forEach((track) => {
      if (track.participant) {
        trackMap.set(track.participant.identity, track);
      }
    });
    
    // Combine all participants - useParticipants() may not include local participant immediately
    // So we merge it with the participants array
    const participantSet = new Map<string, Participant>();
    if (localParticipant) {
      participantSet.set(localParticipant.identity, localParticipant);
    }
    participants.forEach((p) => {
      participantSet.set(p.identity, p);
    });
    const allParticipants = Array.from(participantSet.values());
    
    // Order tracks to match participants array order
    // IMPORTANT: Ensure every participant has a track reference (even if placeholder)
    // This fixes the issue where joining without video shows "Waiting for participants"
    const orderedTracks: TrackReference[] = [];
    allParticipants.forEach((participant) => {
      const track = trackMap.get(participant.identity);
      if (track) {
        orderedTracks.push(track);
      } else {
        // If participant has no track from useTracks, create a placeholder track reference
        // This can happen when a participant joins without video
        const placeholderTrack: TrackReference = {
          participant,
          publication: undefined,
          source: Track.Source.Camera,
        } as TrackReference;
        orderedTracks.push(placeholderTrack);
      }
    });
    
    console.log('[AdaptiveVideoLayout] Camera tracks computed', {
      participantsCount: allParticipants.length,
      tracksCount: orderedTracks.length,
      localParticipantExists: !!localParticipant,
      participantIdentities: allParticipants.map(p => p.identity),
    });
    
    return orderedTracks;
  }, [tracks, participants, localParticipant]);

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

  // Automatically focus on remote participants when they join
  // This ensures remote participants appear as the main video, with local participant in PIP
  React.useEffect(() => {
    if (cameraTracks.length < 2) return; // Only relevant for PIP mode (2+ participants)
    
    // Find the first remote participant's index
    const remoteParticipantIndex = cameraTracks.findIndex(
      (track) => track.participant && track.participant.identity !== localParticipant?.identity
    );
    
    // If we found a remote participant, check if we should auto-focus on them
    if (remoteParticipantIndex !== -1) {
      // Use functional update to avoid dependency on focusedTrackIndex
      setFocusedTrackIndex((currentIndex) => {
        // Check what participant we're currently focused on
        const currentFocusedTrack = cameraTracks[currentIndex];
        const isCurrentlyFocusedLocal = currentFocusedTrack?.participant?.identity === localParticipant?.identity;
        const isCurrentIndexValid = currentIndex >= 0 && currentIndex < cameraTracks.length;
        
        // Auto-switch to remote participant if:
        // 1. We're currently showing local participant, OR
        // 2. Current index is invalid/out of bounds
        if (isCurrentlyFocusedLocal || !isCurrentIndexValid) {
          console.log('[AdaptiveVideoLayout] Auto-focused on remote participant at index', remoteParticipantIndex);
          return remoteParticipantIndex;
        }
        
        // Otherwise, keep current focus (user may have manually switched)
        return currentIndex;
      });
    }
  }, [cameraTracks, localParticipant]);

  // Save orientation preference when it changes
  React.useEffect(() => {
    saveUserPreferences({ preferredOrientation: orientation });
  }, [orientation]);

  // Determine layout based on participant count
  // Use cameraTracks.length to ensure we show layout even when participants have no video
  // (cameraTracks now includes placeholders for all participants)
  const layoutType = React.useMemo(() => {
    const trackCount = cameraTracks.length;
    
    // If no tracks/participants at all, default to single (will show "Waiting for participants")
    if (trackCount === 0) return 'single';
    
    // Use track count for layout determination (tracks now always match participants)
    if (trackCount <= 1) return 'single';
    if (trackCount === 2) return 'pip'; // Picture-in-picture for 2 people
    if (trackCount <= 4) return 'pip'; // PIP works well up to 4 people
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
    // Get participant from track first, then fallback to participants array
    const singleParticipant = singleTrack?.participant || localParticipant || participants[0];

    // Show placeholder if no participant exists yet
    if (!singleParticipant) {
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

    // Always show the participant (with placeholder if no video)
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
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            background: '#1a1a1a',
          }}
        >
          {shouldShowPlaceholder(singleTrack, singleParticipant) ? (
            <VideoPlaceholder participant={singleParticipant} />
          ) : (
            singleTrack && (
              <VideoTrack
                trackRef={singleTrack}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover', // Fill screen, crop sides if needed (Zoom-like)
                  transform: (singleTrack.participant?.identity === localParticipant?.identity && mirrorVideo) 
                    ? 'scaleX(-1)' 
                    : 'none',
                }}
              />
            )
          )}
          <ParticipantInfo 
            participant={singleParticipant} 
            isLocal={localParticipant?.identity === singleParticipant?.identity}
          />
        </div>
      </div>
    );
  }

  // PIP layout (one large + one/more small)
  if (layoutType === 'pip') {
    const focusedTrack = cameraTracks[focusedTrackIndex] || cameraTracks[0];
    const focusedParticipant = focusedTrack?.participant || participants[focusedTrackIndex] || participants[0];
    const otherTracks = cameraTracks.filter((_, index) => index !== focusedTrackIndex);

    if (!focusedTrack || !focusedParticipant) {
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
            background: '#1a1a1a',
          }}
        >
          {shouldShowPlaceholder(focusedTrack, focusedParticipant) ? (
            <VideoPlaceholder participant={focusedParticipant} />
          ) : (
            <VideoTrack
              trackRef={focusedTrack}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover', // Fill screen, faces centered
                transform: (focusedTrack.participant?.identity === localParticipant?.identity && mirrorVideo) 
                  ? 'scaleX(-1)' 
                  : 'none',
              }}
            />
          )}
          <ParticipantInfo 
            participant={focusedParticipant} 
            isLocal={localParticipant?.identity === focusedParticipant?.identity}
          />
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
            const participant = track.participant || participants[actualIndex];
            
            if (!participant) return null;
            
            return (
              <div
                key={participant.identity}
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
                {shouldShowPlaceholder(track, participant) ? (
                  <VideoPlaceholder participant={participant} size="small" />
                ) : (
                  <VideoTrack
                    trackRef={track}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: (track.participant?.identity === localParticipant?.identity && mirrorVideo) 
                        ? 'scaleX(-1)' 
                        : 'none',
                    }}
                  />
                )}
                <ParticipantInfo 
                  participant={participant} 
                  isSmall 
                  isLocal={localParticipant?.identity === participant?.identity}
                />
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
      {cameraTracks.map((track, index) => {
        const participant = track.participant || participants[index];
        
        if (!participant) return null;
        
        return (
          <div
            key={participant.identity}
            onClick={() => handleTrackClick(index)}
            style={{
              position: 'relative',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#1a1a1a',
              cursor: 'pointer',
            }}
          >
            {shouldShowPlaceholder(track, participant) ? (
              <VideoPlaceholder participant={participant} />
            ) : (
              <VideoTrack
                trackRef={track}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: (track.participant?.identity === localParticipant?.identity && mirrorVideo) 
                    ? 'scaleX(-1)' 
                    : 'none',
                }}
              />
            )}
            <ParticipantInfo 
              participant={participant} 
              isLocal={localParticipant?.identity === participant?.identity}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Participant name overlay component
 */
function ParticipantInfo({
  participant,
  isSmall = false,
  isLocal = false,
}: {
  participant: Participant;
  isSmall?: boolean;
  isLocal?: boolean;
}) {
  const room = useRoomContext();
  const isE2EEEnabled = room?.isE2EEEnabled ?? false;

  return (
    <div
      style={{
        position: 'absolute',
        ...(isLocal
          ? {
              top: isSmall ? '4px' : '12px',
              bottom: 'auto',
            }
          : {
              bottom: isSmall ? '4px' : '12px',
              top: 'auto',
            }),
        left: isSmall ? '4px' : '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        maxWidth: 'calc(100% - 24px)',
        pointerEvents: 'none',
      }}
    >
      {/* E2EE Lock Icon */}
      {isE2EEEnabled && (
        <svg
          width={isSmall ? '12' : '16'}
          height={isSmall ? '12' : '16'}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0,
            color: '#22c55e',
          }}
        >
          <path
            d="M12.5 7H12V5C12 2.79086 10.2091 1 8 1C5.79086 1 4 2.79086 4 5V7H3.5C2.67157 7 2 7.67157 2 8.5V13.5C2 14.3284 2.67157 15 3.5 15H12.5C13.3284 15 14 14.3284 14 13.5V8.5C14 7.67157 13.3284 7 12.5 7ZM10 7H6V5C6 3.89543 6.89543 3 8 3C9.10457 3 10 3.89543 10 5V7Z"
            fill="currentColor"
          />
        </svg>
      )}
      {/* Participant Name */}
      <span
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: isSmall ? '2px 6px' : '4px 12px',
          borderRadius: '4px',
          fontSize: isSmall ? '10px' : '14px',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {participant.name || participant.identity}
      </span>
    </div>
  );
}
