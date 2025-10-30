# Video Quality Freeze & Black Screen Fix

## Problem
When changing video quality settings (blur quality) from one preset to another (e.g., high to ultra, medium to low), two critical issues occurred:
1. **Black Screen**: Video would go black and stay black unless you manually restarted the camera
2. **Browser Freezing**: In some cases, the browser would freeze or become unresponsive

## Root Cause
Two issues were causing this problem:

### 1. Calling stopProcessor() Closes the Stream (PRIMARY ISSUE - Black Screen)
In `CameraSettings.tsx`, the initial "fix" of calling `track.stopProcessor()` before applying a new processor was **wrong** because:
- `stopProcessor()` **closes the media stream entirely**
- After the stream is closed, trying to apply a new processor fails with: `InvalidStateError: Stream closed`
- This leaves the camera track in a closed state, causing the black screen
- The error logs show: `"error when trying to pipe InvalidStateError: Stream closed"`

Additionally, reusing cached processors caused stale state issues.

### 2. No Debouncing on Quality Changes (SECONDARY ISSUE - Freezing)
In `SettingsMenu.tsx`, the `handleBlurQualityChange` function was calling `window.__setBlurQuality(quality)` immediately, causing rapid processor updates that could overwhelm the camera track.

## Solution
Applied a two-part fix addressing both root causes:

### Part 1: Let LiveKit Handle Processor Transitions (PRIMARY FIX - Fixes Black Screen)
**File: `lib/CameraSettings.tsx`**
- **DO NOT call `stopProcessor()` manually** - it closes the stream and causes `InvalidStateError: Stream closed`
- **Create fresh processors**: Always create new processor instances instead of reusing cached ones (cached processors have stale state)
- **Let LiveKit handle the transition**: Just call `setProcessor()` with the new processor - LiveKit will stop the old one internally WITHOUT closing the stream
- **Applied to all background types**: Blur, virtual backgrounds, and custom backgrounds
- **Extensive logging**: Added console logs to track processor lifecycle

Key changes in the blur application code:
```typescript
// CRITICAL FIX: Always create a FRESH processor when quality changes
// DO NOT reuse cached processors - they have stale state
// DO NOT call stopProcessor() first - it closes the stream!
// LiveKit's setProcessor() will handle stopping the old processor internally

const blurProcessor = BackgroundProcessor({...}, 'background-blur');

// This single call handles everything: stops old processor, applies new one
await track.setProcessor(blurProcessor);
```

### Part 2: Debouncing to Prevent Rapid Changes (SECONDARY FIX - Prevents Freezing)
**File: `lib/SettingsMenu.tsx`**
- Modified `handleBlurQualityChange` to use debouncing with 300ms delay
- This prevents rapid processor updates when users click quickly between presets
- The UI updates immediately for responsiveness, but the actual processor change is delayed
- Added visual "Applying changes..." indicator with spinning animation
- Updated Pro Tip text to mention smooth application

**File: `styles/globals.css`**
- Added `@keyframes spin` animation for the loading indicator
- Includes both standard and webkit-prefixed versions for browser compatibility

### Debounce Timing
- **Blur Quality Presets**: 300ms (user clicks a button, waits briefly)
- **Advanced Segmentation Sliders**: 500ms (user drags a slider, needs more time)

The shorter delay for presets is appropriate because:
- Users typically click once and wait
- Preset changes are intentional, not continuous like slider dragging
- 300ms feels responsive while still preventing freezing

## Why This Fix Works

### The Black Screen Issue
The black screen occurred because:
1. User clicks new quality preset (e.g., "Ultra")
2. Code called `track.stopProcessor()` to stop the old processor
3. **`stopProcessor()` closed the media stream entirely** (this is the bug!)
4. Code tried to apply new processor with `track.setProcessor(newProcessor)`
5. Error: `InvalidStateError: Stream closed` - can't pipe to a closed stream
6. Camera track is now in a closed state and shows black screen

**Solution**: **DON'T call `stopProcessor()` manually**. Instead, just call `setProcessor()` with a fresh processor - LiveKit handles stopping the old one internally WITHOUT closing the stream.

### The Freezing Issue
Freezing occurred because:
1. User rapidly clicks multiple quality presets
2. Each click immediately triggered a processor change
3. Multiple processor changes queued up simultaneously
4. Browser became overwhelmed processing all changes at once

**Solution**: Debounce the changes so only the final selection is applied.

## Testing Recommendations

1. **Basic Quality Change (Tests Black Screen Fix)**
   - Open Settings → Background Blur Quality
   - Click between different quality presets (low → medium → high → ultra)
   - **Expected**: Video stays visible during transitions, no black screen
   - Check console logs for "Stopped previous processor" messages

2. **Rapid Preset Switching (Tests Debouncing)**
   - Rapidly click through multiple quality presets in quick succession
   - **Expected**: Only the final selection is applied
   - **Expected**: No freezing or browser lockup
   - **Expected**: "Applying changes..." indicator appears and disappears

3. **Background Type Switching**
   - Switch between None → Blur → Virtual Background → Blur again
   - **Expected**: Smooth transitions without black screens
   - **Expected**: Each background applies correctly

4. **Combined with Segmentation**
   - Enable Advanced Segmentation Settings
   - Change custom sliders and then switch preset quality
   - **Expected**: Smooth operation without conflicts
   - **Expected**: Video remains visible throughout

5. **Console Monitoring**
   - Open browser dev tools console
   - Change quality settings and watch logs
   - **Expected to see**:
     - "Creating fresh blur processor for quality: [quality]"
     - "Blur processor applied successfully, stream remains active"
   - **Should NOT see**:
     - "Stopped previous processor" (we don't manually stop anymore)
     - "InvalidStateError: Stream closed" (this was the bug!)
     - "error when trying to pipe"

6. **Cross-Browser Testing**
   - Test in Chrome, Firefox, Safari, Edge
   - Verify spinning animation works correctly
   - Verify no console errors

## Benefits

✅ **No More Black Screen**: Video stays visible when changing quality settings  
✅ **No More Stream Closed Errors**: Stream remains active during processor transitions  
✅ **No More Freezing**: Smooth quality changes without browser lockup  
✅ **Proper Processor Lifecycle**: Let LiveKit handle transitions internally (don't call `stopProcessor()`)  
✅ **Fresh Processor Instances**: Always create new processors to avoid stale state  
✅ **Better UX**: Visual feedback during changes with "Applying changes..." indicator  
✅ **Consistent Behavior**: Same pattern used for all background types  
✅ **Performance**: Debouncing prevents excessive processor creation when clicking rapidly  
✅ **Responsive UI**: Local state updates immediately, processor applies after debounce delay  
✅ **Better Debugging**: Extensive console logging for troubleshooting  
✅ **No Manual Stream Management**: LiveKit handles the complexity of switching processors safely  

## Related Fixes
This fix extends the debouncing pattern that was previously implemented for:
- Advanced Segmentation Settings (blur radius, edge quality, etc.)

And adds proper processor lifecycle management that applies to:
- Blur quality presets
- Virtual backgrounds (images and gradients)
- Custom uploaded backgrounds

All background features now provide a smooth, reliable experience without black screens or freezing.

## Key Lessons Learned

### ❌ WRONG: Manually calling stopProcessor()
```typescript
// This causes: InvalidStateError: Stream closed
await track.stopProcessor();  // ❌ Closes the stream!
await track.setProcessor(newProcessor);  // ❌ Fails - stream is closed
```

### ✅ CORRECT: Let LiveKit handle it
```typescript
// LiveKit handles stopping the old processor internally without closing the stream
await track.setProcessor(newProcessor);  // ✅ Works perfectly!
```

### Why stopProcessor() Causes Black Screen
- `stopProcessor()` is designed to **completely tear down** the processor pipeline
- It closes the underlying media stream as part of cleanup
- After the stream is closed, the track is no longer usable
- Attempting to apply a new processor to a closed stream fails silently or with errors
- Result: Black screen that requires manually restarting the camera

### The Correct Approach
- **Always create fresh processor instances** (don't reuse cached ones)
- **Just call `setProcessor()`** with the new processor
- LiveKit's internal implementation will:
  1. Stop the old processor gracefully
  2. Keep the media stream alive
  3. Apply the new processor to the same stream
  4. Handle all the complex state management internally

This is a common mistake when working with LiveKit track processors - the API is designed to handle processor transitions for you!

