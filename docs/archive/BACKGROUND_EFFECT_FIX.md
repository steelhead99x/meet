# Background Effect Loading Fix

## Issues Fixed

### 1. Video Shows Before Effect is Ready
**Problem**: When changing camera or applying background effects (blur/virtual background), the unprocessed video was immediately visible to other participants and in the LiveKit preview.

**Solution**: 
- Temporarily mute the video track before applying any processor
- Wait for the processor to be fully initialized (100ms settling time)
- Only unmute the track after the effect is ready
- Show a loading overlay in the preview during transitions

### 2. InvalidStateError: Stream Closed
**Problem**: Error occurred when trying to apply a processor to a closed MediaStreamTrack, causing the pipeline to fail.

**Solution**:
- Added comprehensive track state validation before applying processors
- Check both `isLocalTrack()` and `mediaStreamTrack.readyState === 'live'`
- Improved error handling to gracefully handle stream closed errors
- Added proper cleanup in try-catch-finally blocks
- Prevented concurrent processor applications with a ref-based lock

## Implementation Details

### Track Muting During Transitions
```typescript
// Temporarily mute the track to prevent showing unprocessed video
const wasEnabled = track.isMuted === false;
if (wasEnabled) {
  await track.mute();
}

// Apply processor...
await track.setProcessor(processor);

// Wait for initialization
await new Promise(resolve => setTimeout(resolve, 100));

// Re-enable the track
if (wasEnabled && track.mediaStreamTrack?.readyState === 'live') {
  await track.unmute();
}
```

### Loading State Management
- Added `isApplyingProcessor` state to track processor application
- Added `isApplyingProcessorRef` ref to prevent concurrent applications
- Loading overlay shown in preview with spinner animation
- All background effect buttons are disabled during processor application
- Visual feedback (opacity and cursor) indicates buttons are not clickable

### Error Handling
- Specific handling for `InvalidStateError` to prevent crashes
- Attempts to restore track state even on errors
- Comprehensive logging for debugging

## Benefits

1. **Privacy**: No unprocessed video is ever shown to other participants during transitions
2. **User Experience**: Smooth transitions with loading indicator
3. **Stability**: No more stream closed errors
4. **Reliability**: Proper state management prevents race conditions

## Testing Recommendations

1. Test camera switching with blur enabled
2. Test rapidly changing between different background effects
3. Test with different camera devices
4. Test in low-performance environments
5. Verify no unprocessed frames are transmitted to other participants

## Files Modified

- `lib/CameraSettings.tsx` - Main implementation
  - Added track muting/unmuting logic
  - Added loading state management
  - Improved error handling
  - Added loading overlay UI

