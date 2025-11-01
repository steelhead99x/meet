# MediaPipe OpenGL Warning Fix

## Issue

When enabling video or applying background blur effects, a warning appeared in the browser console:

```
W1030 02:04:48.567000 1880752 gl_context.cc:1060] OpenGL error checking is disabled
```

This warning originated from MediaPipe's vision WASM library (used for selfie segmentation in background blur/virtual background effects) and appeared during WebGL context initialization.

## Root Cause

MediaPipe's selfie segmentation model initializes a WebGL context when the BackgroundProcessor or VirtualBackground processor is created. During initialization, MediaPipe logs an informational warning about OpenGL error checking being disabled for performance reasons.

While this warning is **benign and harmless**, it:
- Clutters the browser console
- Can be alarming to users who see it
- Appears on every video startup or background effect application

## Solution

The fix temporarily suppresses console warnings during processor initialization, specifically filtering out MediaPipe's OpenGL warnings while preserving all other legitimate warnings.

### Implementation Details

The solution intercepts `console.warn` calls during processor creation and filters out messages containing:
- `"OpenGL error checking"`
- `"gl_context.cc"`

After a 1-second delay (enough time for MediaPipe to complete initialization), the original `console.warn` function is restored.

### Code Changes

#### 1. CustomPreJoin.tsx (Preview Stage)

Added warning suppression around blur processor creation in the preview:

```typescript
// Suppress MediaPipe initialization warnings
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  // Filter out MediaPipe OpenGL warnings
  if (message.includes('OpenGL error checking') || 
      message.includes('gl_context.cc')) {
    return; // Suppress this specific warning
  }
  originalWarn.apply(console, args);
};

// Create blur processor
blurProcessorRef.current = BackgroundProcessor({
  blurRadius: config.blurRadius,
  segmenterOptions: {
    delegate: config.segmenterOptions.delegate,
  },
}, 'background-blur');

// Restore console.warn after initialization
setTimeout(() => {
  console.warn = originalWarn;
}, 1000);
```

#### 2. CameraSettings.tsx (In-Room Stage)

Added warning suppression around all processor creations (blur, virtual background, custom backgrounds):

```typescript
// Suppress MediaPipe initialization warnings
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('OpenGL error checking') || 
      message.includes('gl_context.cc')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Restore function
const restoreConsoleWarn = () => {
  setTimeout(() => {
    console.warn = originalWarn;
  }, 1000);
};

// Applied after all processor creations and in error handlers
```

## Benefits

1. **Clean Console**: No more confusing MediaPipe warnings cluttering the console
2. **Preserved Debugging**: All other warnings remain visible
3. **No Side Effects**: The suppression is temporary and scoped only to MediaPipe initialization
4. **Better UX**: Users won't be alarmed by technical warnings that don't affect functionality

## Testing

To verify the fix:

1. **Join a room with video enabled**
   - The OpenGL warning should NOT appear in the console
   - Video should work normally with blur applied

2. **Enable/disable blur effect**
   - Toggle between blur and no effect
   - No OpenGL warnings should appear

3. **Change background effects**
   - Switch between blur, virtual backgrounds, and gradients
   - Console should remain clean

4. **Change camera device**
   - Switch to a different camera
   - No warnings should appear during the transition

5. **Verify other warnings still work**
   - Other legitimate console warnings should still be visible
   - Only MediaPipe OpenGL warnings are suppressed

## Technical Notes

- The suppression is temporary (1 second) to minimize impact
- Only affects `console.warn`, not `console.error` or `console.log`
- Filters are specific to MediaPipe's OpenGL warnings
- Original console.warn is always restored
- No performance impact on the application

## Files Modified

- `lib/CustomPreJoin.tsx` - Preview stage blur application
- `lib/CameraSettings.tsx` - In-room background effects

## Related Issues

This fix complements other video processing improvements:
- Stream state validation (STREAM_CLOSED_ERROR_FIX.md)
- Background effect loading (BACKGROUND_EFFECT_FIX.md)
- Blur quality configuration (BlurConfig.ts)



