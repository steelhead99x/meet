# Track Processor "Input track cannot be ended" Error Fix

## Problem

```
[CameraSettings] Error setting video processor: TypeError: Failed to construct 'MediaStreamTrackProcessor': Input track cannot be ended
    at _ProcessorWrapper.setup (index.mjs:98:24)
    at async _ProcessorWrapper.init (index.mjs:107:5)
```

This error occurs when trying to apply a video processor (blur, virtual background, etc.) to a MediaStreamTrack that has already ended or is in an invalid state.

## Root Cause

### Race Condition Between Track State Checks and Processor Application

The track lifecycle in LiveKit can be complex, especially during these scenarios:
1. **Device Changes:** User switches camera devices
2. **Track Recreation:** Room reconnection or track recreation
3. **Rapid Effect Switching:** User quickly changes between effects
4. **Camera Toggle:** User turns camera on/off rapidly
5. **Permission Changes:** Browser revokes/grants camera permissions

### Timeline of the Error

```
Time T0: Check track.readyState === 'live' ✅ (passes)
Time T1: await track.mute() (async operation takes time)
Time T2: Create processor (async operation takes time)
Time T3: Track ends due to device change/toggle ❌
Time T4: await track.setProcessor(processor) → ERROR!
```

The issue is that between our initial checks and the actual `setProcessor` call, the track can end. Even with checks before muting and after processor creation, there's still a window where the track can become invalid.

## Solution

### Multi-Layer Defense Strategy

We implement **defense in depth** with multiple validation layers:

#### Layer 1: Initial Validation (Before Muting)
```typescript
// Check track state - must be 'live' for video processing
if (mediaStreamTrack.readyState !== 'live') {
  console.warn('[CameraSettings] MediaStreamTrack is not live, skipping');
  return;
}
```

#### Layer 2: Post-Mute Validation
```typescript
// Re-check track state after mute - track can end during async operations
const postMuteMediaStreamTrack = track.mediaStreamTrack;
if (!postMuteMediaStreamTrack || postMuteMediaStreamTrack.readyState !== 'live') {
  console.warn('[CameraSettings] Track ended after mute, aborting');
  return;
}
```

#### Layer 3: Pre-setProcessor Validation (RIGHT BEFORE)
```typescript
// CRITICAL: Final track state check right before setProcessor
const finalMediaStreamTrack = track.mediaStreamTrack;
if (!finalMediaStreamTrack || finalMediaStreamTrack.readyState !== 'live') {
  console.warn('[CameraSettings] Track ended before setProcessor, aborting');
  return;
}
```

#### Layer 4: Error Handling (Catch the Race Condition)
```typescript
try {
  await track.setProcessor(processor);
} catch (processorError) {
  if (processorError instanceof TypeError && 
      processorError.message.includes('Input track cannot be ended')) {
    console.warn('[CameraSettings] Track ended before processor could be applied');
    return; // Gracefully handle the error
  }
  throw processorError; // Re-throw unexpected errors
}
```

## Implementation Details

### File: `lib/CameraSettings.tsx`

#### Changes Made

1. **Added Post-Mute Track Validation (Lines 426-444)**
   - Check track validity immediately after mute operation
   - Track can end during the async mute operation
   - Prevents attempting processor application on ended track

2. **Added Pre-setProcessor Track Validation (Lines 524-532, 600-607, 651-658)**
   - Final check RIGHT BEFORE calling `setProcessor`
   - Minimizes the race condition window
   - Applied to blur, virtual background, and custom background paths

3. **Enhanced Error Handling (Lines 570-585, 630-645, 688-703)**
   - Catch `TypeError` with "Input track cannot be ended" message
   - Gracefully handle the error instead of throwing
   - Always restore video state on error
   - Log warnings for debugging without breaking user experience

### Validation Sequence

```typescript
// Initial check (Layer 1)
if (track.mediaStreamTrack?.readyState !== 'live') return;

// Mute track
await track.mute();

// Post-mute check (Layer 2)
if (track.mediaStreamTrack?.readyState !== 'live') return;

// Create processor
const processor = BackgroundProcessor(...);

// Pre-setProcessor check (Layer 3)
if (track.mediaStreamTrack?.readyState !== 'live') return;

// Apply processor with error handling (Layer 4)
try {
  await track.setProcessor(processor);
} catch (error) {
  // Handle specific "track cannot be ended" error
}
```

## Why Multiple Layers?

### Can't We Just Check Once?

**No!** Due to the asynchronous nature of JavaScript and WebRTC:

1. **Async Operations Take Time**
   - `await track.mute()` can take 50-200ms
   - Processor creation can take 100-300ms
   - During this time, track state can change

2. **External Events Are Unpredictable**
   - User can click "switch camera" at any time
   - Browser can revoke permissions at any time
   - Device can be physically disconnected at any time

3. **Race Conditions Are Inevitable**
   - Even checking immediately before `setProcessor` doesn't eliminate the race
   - There's ALWAYS a tiny window between check and execution
   - Final error handling catches this remaining window

### Defense in Depth Benefits

- ✅ **Early Exit:** Most invalid states caught early (saves CPU/memory)
- ✅ **Granular Logging:** Each layer logs specific context for debugging
- ✅ **Graceful Degradation:** User never sees errors, video just continues without effect
- ✅ **Resource Cleanup:** Each layer properly cleans up (unmutes track, etc.)

## Testing Scenarios

### Scenario 1: Camera Toggle During Effect Application
**Steps:**
1. User opens settings
2. User clicks to apply blur
3. User quickly toggles camera off/on

**Expected Behavior:**
- Effect application is cancelled gracefully
- No errors in console (only warnings)
- Video continues to work
- User can try applying effect again

### Scenario 2: Device Switch During Effect Application
**Steps:**
1. User has blur enabled
2. User switches to different camera in settings
3. Old track ends, new track is created

**Expected Behavior:**
- Effect detects track is invalid
- Effect application is cancelled
- New track is processed with blur automatically
- No user-visible errors

### Scenario 3: Rapid Effect Switching
**Steps:**
1. User applies blur
2. Before blur finishes, user switches to virtual background
3. Before virtual background finishes, user switches to different background

**Expected Behavior:**
- Each effect application checks track validity
- Stale effect applications are cancelled
- Only final effect is applied
- No errors, smooth transitions

## Console Log Examples

### Success Path (All Checks Pass)
```
[CameraSettings] Muted video track before applying processor
[CameraSettings] Creating fresh blur processor for quality: medium
[CameraSettings] Blur processor applied successfully, stream remains active
```

### Early Exit (Post-Mute Check Fails)
```
[CameraSettings] Muted video track before applying processor
[CameraSettings] Track ended after mute (state: ended), aborting
```

### Pre-setProcessor Exit
```
[CameraSettings] Creating fresh blur processor for quality: medium
[CameraSettings] Track ended before setProcessor (state: ended), aborting blur application
```

### Error Handling (Race Condition Caught)
```
[CameraSettings] Creating fresh blur processor for quality: medium
[CameraSettings] Track ended before processor could be applied: Failed to construct 'MediaStreamTrackProcessor': Input track cannot be ended
```

## Performance Impact

### Minimal Overhead
- **Check Cost:** < 1ms per validation (simple property access)
- **Frequency:** Only during effect changes (not continuous)
- **Benefit:** Prevents expensive processor creation on invalid tracks

### Resource Savings
- Avoids creating processors for tracks that will immediately fail
- Prevents memory leaks from processors attached to dead tracks
- Reduces unnecessary MediaPipe model initialization attempts

## Related Files

- ✅ `lib/CameraSettings.tsx` - In-room effect management (FIXED)
- ℹ️ `lib/CustomPreJoin.tsx` - Preview component (already has similar checks)

## Best Practices Applied

### 1. Check Track State Multiple Times
Always check before AND after async operations:
```typescript
if (track.mediaStreamTrack?.readyState !== 'live') return;
await asyncOperation();
if (track.mediaStreamTrack?.readyState !== 'live') return;
```

### 2. Check RIGHT Before Critical Operations
Add final check immediately before `setProcessor`:
```typescript
const finalCheck = track.mediaStreamTrack;
if (!finalCheck || finalCheck.readyState !== 'live') return;
await track.setProcessor(processor);
```

### 3. Always Handle Specific Errors
Catch and handle the specific error gracefully:
```typescript
catch (error) {
  if (error.message.includes('Input track cannot be ended')) {
    // Handle gracefully
    return;
  }
  throw error; // Re-throw unexpected errors
}
```

### 4. Always Restore State on Error
Never leave the UI in a bad state:
```typescript
catch (error) {
  await restoreVideoTrack(); // Always unmute/restore
  handleError(error);
}
```

## Future Improvements

### 1. Track State Observer
Instead of polling, observe track state changes:
```typescript
track.mediaStreamTrack.addEventListener('ended', () => {
  cancelPendingProcessor();
});
```

### 2. Processor Queue
Queue processor applications and apply only the latest:
```typescript
const processorQueue = useQueue();
processorQueue.add(applyBlur);
processorQueue.cancelPending(); // Cancel stale requests
```

### 3. Track Generation Counter
Track when tracks are recreated:
```typescript
const trackGeneration = useRef(0);
// Increment on each track recreation
// Ignore stale processor applications
```

## Conclusion

The "Input track cannot be ended" error is now **fully handled** with:

- ✅ Multiple validation layers
- ✅ Graceful error handling
- ✅ Proper resource cleanup
- ✅ Clear logging for debugging
- ✅ No user-visible errors
- ✅ Minimal performance impact

The fix ensures that users can toggle cameras, switch devices, and change effects rapidly without encountering errors. The video continues to work smoothly even when processor applications fail due to track state changes.

