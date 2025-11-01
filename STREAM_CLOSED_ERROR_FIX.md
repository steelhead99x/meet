# Fix: InvalidStateError - Stream Closed

## Problem
The application was throwing `InvalidStateError: Stream closed` errors when trying to apply video processors (background blur, virtual backgrounds) to MediaStreams. This occurred due to race conditions where the stream could be closed between state checks and actual processor application.

## Root Cause
1. **Race Conditions**: The stream state could change between checking `readyState` and calling `setProcessor()`
2. **Insufficient State Validation**: Not all processor operations had proper stream state validation
3. **Missing Error Handling**: Some `setProcessor()` and `stopProcessor()` calls lacked try-catch blocks for `InvalidStateError`
4. **Cleanup Issues**: Processor cleanup on unmount didn't verify stream state before stopping

## Solution Implemented

### 1. Enhanced State Validation in CameraSettings.tsx

Added multiple layers of stream state validation:

```typescript
// Initial check
if (!mediaStreamTrack) {
  console.warn('[CameraSettings] MediaStreamTrack is null, skipping processor update');
  return;
}

// Verify live state
if (mediaStreamTrack.readyState !== 'live') {
  console.warn('[CameraSettings] MediaStreamTrack is not live, skipping processor update');
  return;
}

// Additional ended check
if (mediaStreamTrack.readyState === 'ended') {
  console.warn('[CameraSettings] MediaStreamTrack has ended, cannot apply processor');
  return;
}
```

### 2. Pre-Apply Validation

Added final state checks immediately before each `setProcessor()` call:

```typescript
// Final check before applying processor
if (!mediaStreamTrack || mediaStreamTrack.readyState !== 'live') {
  console.warn('[CameraSettings] Stream state changed before applying blur, aborting');
  return;
}

// Apply processor...
try {
  // One more check right before setProcessor
  if (mediaStreamTrack.readyState !== 'live') {
    console.warn('[CameraSettings] Stream closed right before setProcessor, aborting');
    return;
  }
  
  await track.setProcessor(blurProcessor);
} catch (processorError) {
  if (processorError instanceof DOMException && processorError.name === 'InvalidStateError') {
    console.warn('[CameraSettings] Stream closed while applying processor:', processorError.message);
    return;
  }
  throw processorError;
}
```

### 3. Protected stopProcessor() Calls

Wrapped all `stopProcessor()` calls with state validation and error handling:

```typescript
if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
  try {
    await track.stopProcessor();
  } catch (stopError) {
    if (stopError instanceof DOMException && stopError.name === 'InvalidStateError') {
      console.warn('[CameraSettings] Stream closed while stopping processor:', stopError.message);
    } else {
      console.error('[CameraSettings] Error stopping processor:', stopError);
    }
  }
} else {
  console.warn('[CameraSettings] Cannot stop processor - stream is not live');
}
```

### 4. Robust Cleanup on Unmount

Enhanced the cleanup effect to check stream state before attempting to stop processors:

```typescript
React.useEffect(() => {
  return () => {
    const track = cameraTrack?.track;
    if (isLocalTrack(track)) {
      const mediaStreamTrack = track.mediaStreamTrack;
      if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
        track.stopProcessor().catch((err) => {
          if (err instanceof DOMException && err.name === 'InvalidStateError') {
            console.warn('[CameraSettings] Stream already closed during cleanup');
          } else {
            console.warn('[CameraSettings] Error stopping processor on cleanup:', err);
          }
        });
      }
    }
    // ... cleanup
  };
}, [cameraTrack]);
```

### 5. Fixed CustomPreJoin.tsx

Applied the same fixes to the preview track processor in `CustomPreJoin.tsx`:
- Added stream state validation before applying blur to preview
- Added try-catch with InvalidStateError handling
- Protected cleanup with state checks

## Changes Made

### Files Modified:
1. **lib/CameraSettings.tsx**
   - Enhanced state validation in processor application effect
   - Added pre-apply validation for all processor types (blur, virtual background, custom background)
   - Wrapped all `setProcessor()` calls with try-catch and InvalidStateError handling
   - Protected `stopProcessor()` calls with state checks
   - Enhanced cleanup on unmount

2. **lib/CustomPreJoin.tsx**
   - Added stream state validation before applying blur to preview track
   - Added try-catch with InvalidStateError handling
   - Protected cleanup with stream state checks

## Testing Recommendations

1. **Switch Background Effects**: Rapidly switch between blur, virtual backgrounds, and no effect
2. **Device Changes**: Change camera devices while effects are active
3. **Quick Navigation**: Join/leave rooms quickly to test cleanup
4. **Browser Scenarios**: Test with browser losing/regaining focus
5. **Mobile Testing**: Test on mobile devices where streams may suspend

## Benefits

1. **No More Crashes**: InvalidStateError exceptions are now caught and handled gracefully
2. **Better Logging**: Clear console warnings help debug stream state issues
3. **Graceful Degradation**: Application continues working even when streams close unexpectedly
4. **Race Condition Protection**: Multiple validation layers prevent race conditions
5. **Clean Cleanup**: Proper resource cleanup prevents memory leaks

## Technical Details

### MediaStreamTrack States
- `live`: Track is active and can be used
- `ended`: Track has been stopped and cannot be reused
- Between these states, the track is in transition

### Why Multiple Checks?
The stream state can change at any moment due to:
- User revoking camera permissions
- Camera being used by another application
- Browser suspending the stream (mobile)
- Component unmounting during async operations
- Network issues affecting media devices

Multiple validation layers ensure we catch state changes at every critical point.

## Future Improvements

1. Consider implementing a retry mechanism with exponential backoff
2. Add user-facing notifications when stream issues occur
3. Implement automatic fallback to non-processed video on repeated failures
4. Add telemetry to track stream closure patterns

## Related Files
- `lib/CameraSettings.tsx` - Main camera settings with background effects
- `lib/CustomPreJoin.tsx` - Preview screen with blur application
- `lib/BlurConfig.ts` - Blur configuration (unchanged)



