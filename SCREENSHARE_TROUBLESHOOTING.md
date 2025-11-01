# Screen Share Troubleshooting Guide

## Issue: Screen Share Opens But Does Not Share

This document addresses the issue where the screen share dialog opens, but the screen is not actually shared with other participants.

## Root Cause Analysis

Based on LiveKit documentation and common issues, this problem typically occurs when:

1. **Track is created but not published**: The browser allows access to the screen, but the track fails to publish to the LiveKit room
2. **Permission denied after selection**: User selects a screen/window/tab, but browser denies access
3. **Track creation succeeds but publishing fails**: Silent failure during the publish step

## Implementation Review

Your current implementation uses `ControlBar` from `@livekit/components-react`, which handles screen sharing via the `useTrackToggle` hook. This internally calls `setScreenShareEnabled(true)`, which should both:
- Create the screen track via browser's `getDisplayMedia()` API
- Automatically publish it to the room

## Common Causes & Solutions

### 1. Check Participant Permissions

Verify that participants have `canPublish` permission in their access token:

```typescript
// From your connection-details API (already set correctly):
const grant: VideoGrant = {
  room: roomName,
  roomJoin: true,
  canPublish: true,  // ✅ This is set
  canPublishData: true,
  canSubscribe: true,
};
```

### 2. Browser Compatibility Issues

Some browsers have restrictions on screen sharing:

- **Chrome/Edge**: Requires HTTPS (except localhost)
- **Firefox**: May require specific permission prompts
- **Safari**: Limited support for screen sharing

**Check**: Open browser console and look for errors when clicking screen share button.

### 3. Track Not Being Published

The LiveKit `setScreenShareEnabled(true)` method should handle both creation and publishing. However, if there's an issue, you can manually publish:

```typescript
// Manual approach (if ControlBar fails):
const tracks = await room.localParticipant.createScreenTracks({
  audio: false, // Set to true if you want to share audio
});

tracks.forEach((track) => {
  room.localParticipant.publishTrack(track);
});
```

### 4. Error Handling

Your code already has error handlers for `MediaDevicesError`, which should catch screen share errors. Check the browser console for:

- `NotReadableError`: Screen capture failed
- `NotAllowedError`: Permission denied
- `NotFoundError`: Screen source not found

## Debugging Steps

### Step 1: Add Detailed Logging

Add this to your room connection code to track screen share events:

```typescript
// Add event listeners to track screen share lifecycle
room.on(RoomEvent.LocalTrackPublished, (publication) => {
  console.log('[ScreenShare] Track published:', {
    source: publication.source,
    kind: publication.kind,
    trackSid: publication.trackSid,
  });
});

room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
  console.log('[ScreenShare] Track unpublished:', {
    source: publication.source,
    trackSid: publication.trackSid,
  });
});

room.on(RoomEvent.TrackPublished, (publication, participant) => {
  if (publication.source === Track.Source.ScreenShare) {
    console.log('[ScreenShare] Remote track published by:', participant.identity);
  }
});
```

### Step 2: Check Track State

After enabling screen share, verify the track exists:

```typescript
// Check if screen share track was created
const screenSharePublication = room.localParticipant
  .getTrackPublication(Track.Source.ScreenShare);

if (screenSharePublication) {
  console.log('[ScreenShare] Track found:', {
    isSubscribed: !!screenSharePublication.track,
    isMuted: screenSharePublication.isMuted,
    dimensions: screenSharePublication.dimensions,
  });
} else {
  console.error('[ScreenShare] No screen share track found after enabling');
}
```

### Step 3: Verify Browser Permissions

Check if the browser actually granted screen capture permission:

```typescript
// Check media device permissions
navigator.permissions.query({ name: 'display-capture' as PermissionName }).then(result => {
  console.log('[ScreenShare] Display capture permission:', result.state);
  // Should be 'granted' after successful share
});
```

## LiveKit Documentation References

From the official LiveKit docs:

1. **Screen Sharing Guide**: https://docs.livekit.io/home/client/tracks/screenshare/
2. **Key Method**: `await room.localParticipant.setScreenShareEnabled(true);`
3. **Alternative Method** (for audio sharing):
   ```typescript
   const tracks = await localParticipant.createScreenTracks({
     audio: true,
   });
   tracks.forEach((track) => {
     localParticipant.publishTrack(track);
   });
   ```

## Recommended Fix

Add comprehensive logging and error handling to your screen share implementation. Here's what to add to your `PageClientImpl.tsx`:

```typescript
// In VideoConferenceComponent, add screen share event listeners
React.useEffect(() => {
  if (!room) return;

  const onLocalTrackPublished = (publication: TrackPublication) => {
    if (publication.source === Track.Source.ScreenShare) {
      console.log('[ScreenShare] ✅ Successfully published screen share track');
      toast.success('Screen sharing started', {
        duration: 3000,
        position: 'top-center',
      });
    }
  };

  const onLocalTrackUnpublished = (publication: TrackPublication) => {
    if (publication.source === Track.Source.ScreenShare) {
      console.log('[ScreenShare] ❌ Screen share track unpublished');
    }
  };

  const onMediaDevicesError = (error: Error) => {
    if (error.message.includes('screen') || error.message.includes('display')) {
      console.error('[ScreenShare] Error:', error);
      toast.error('Failed to start screen sharing. Please check permissions.', {
        duration: 5000,
        position: 'top-center',
      });
    }
  };

  room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
  room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
  room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

  return () => {
    room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
  };
}, [room]);
```

## Testing Checklist

- [ ] Test in Chrome (recommended for best compatibility)
- [ ] Test on HTTPS (required for screen sharing)
- [ ] Check browser console for errors
- [ ] Verify track appears in `room.localParticipant.videoTrackPublications`
- [ ] Confirm other participants see the screen share
- [ ] Test with audio sharing disabled first (simpler case)
- [ ] Test selecting different sources (entire screen, window, tab)

## Additional Notes

- The `ControlBar` component from LiveKit should handle everything automatically
- If the issue persists, try manually implementing screen share toggle using `useTrackToggle` hook
- Ensure your LiveKit server is properly configured and accessible
- Check network tab for any failed WebRTC connection attempts

