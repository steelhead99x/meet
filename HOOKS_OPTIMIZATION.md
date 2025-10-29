# Hooks Optimization Summary

## Problem
The video window was refreshing on every event hook execution, causing flickering and poor user experience. This was caused by unstable hook dependencies triggering unnecessary re-renders and room reconnections.

## Root Causes Identified

### 1. **Unstable Event Handler References**
- Event handlers were created with `useCallback` but still had changing dependencies
- Every time dependencies changed, event listeners were removed and re-added
- This caused the video to refresh unnecessarily

### 2. **Object Reference Dependencies**
- `props.userChoices` is an object that could be recreated on parent re-renders
- Even if values inside remained the same, the object reference changed
- This triggered room recreation effects

### 3. **Redundant Debug Effects**
- Multiple `useEffect` hooks ran on every room state change
- These effects logged the same information repeatedly
- Contributed to performance overhead

### 4. **Large Dependency Arrays**
- Room setup effect had 9+ dependencies
- Any change to any dependency recreated the entire room
- Most changes were unnecessary (e.g., callback reference changes)

## Solutions Implemented

### 1. **Stable Event Handlers with Refs**

**Before:**
```typescript
const handleError = React.useCallback((error: Error) => {
  // handler logic
}, []); // Callback recreated if dependencies change

React.useEffect(() => {
  room.on(RoomEvent.MediaDevicesError, handleError);
  return () => room.off(RoomEvent.MediaDevicesError, handleError);
}, [room, handleError]); // Re-runs when handleError changes
```

**After:**
```typescript
const handlersRef = React.useRef({
  handleError: (error: Error) => {
    // handler logic
  }
});

React.useEffect(() => {
  const onMediaDevicesError = (error: Error) => 
    handlersRef.current.handleError(error);
  
  room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
  return () => room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
}, [room]); // Only re-runs when room changes
```

**Benefits:**
- Event listeners only attach/detach when room instance changes
- Handler logic can be updated without re-attaching listeners
- Prevents video refresh on unrelated state changes

### 2. **Extract Primitive Values from Objects**

**Before:**
```typescript
React.useEffect(() => {
  // Use props.userChoices directly
  const options = {
    deviceId: props.userChoices.videoDeviceId
  };
}, [props.userChoices]); // Triggers on object reference change
```

**After:**
```typescript
const videoDeviceId = props.userChoices.videoDeviceId;
const audioDeviceId = props.userChoices.audioDeviceId;

React.useEffect(() => {
  const options = {
    deviceId: videoDeviceId
  };
}, [videoDeviceId]); // Only triggers on actual value change
```

**Benefits:**
- Effect only runs when actual values change
- Object reference changes don't trigger effect
- Room stays stable across parent re-renders

### 3. **Consolidated Connection Logic**

**Before:**
```typescript
room
  .connect(url, token, options)
  .then(() => room.localParticipant.setCameraEnabled(true))
  .then(() => room.localParticipant.setMicrophoneEnabled(true))
  .catch(handleError); // handleError in dependency array
```

**After:**
```typescript
const connectToRoom = async () => {
  try {
    await room.connect(url, token, options);
    if (videoEnabled) {
      await room.localParticipant.setCameraEnabled(true);
    }
    if (audioEnabled) {
      await room.localParticipant.setMicrophoneEnabled(true);
    }
  } catch (error) {
    handlersRef.current.handleError(error);
  }
};

connectToRoom();
```

**Benefits:**
- Better error handling
- Uses stable handler references
- Clearer async flow
- Includes success logging once instead of repeatedly

### 4. **Removed Redundant Debug Effects**

**Before:**
```typescript
React.useEffect(() => {
  if (lowPowerMode) {
    console.warn('Low power mode enabled');
  }
}, [lowPowerMode]); // Runs every time lowPowerMode changes

React.useEffect(() => {
  if (room) {
    console.log('Room connected:', room.state);
  }
}, [room]); // Runs every time room changes
```

**After:**
```typescript
// Debug logging moved to connection success callback
const connectToRoom = async () => {
  // ... connection logic ...
  console.log('Room connected:', {
    isConnected: room.state,
    localParticipant: room.localParticipant?.identity,
  }); // Logs once on successful connection
};
```

**Benefits:**
- Logging only happens when meaningful (on connection)
- Reduced effect overhead
- Less noise in console

## Files Modified

1. **app/rooms/[roomName]/PageClientImpl.tsx**
   - Optimized event handlers with refs
   - Extracted primitive values from userChoices
   - Consolidated connection logic
   - Removed redundant debug effects

2. **app/custom/VideoConferenceClientImpl.tsx**
   - Applied same event handler optimization
   - Consolidated connection logic
   - Removed redundant debug effects

## Performance Impact

### Before Optimization
- Event handlers re-attached on every state change
- Room could be recreated on parent re-renders
- Multiple effects running on every room update
- Video flickering on hook events

### After Optimization
- Event handlers only re-attach when room instance changes
- Room only recreates when essential config changes
- Minimal effect overhead
- Stable video playback

## Testing Recommendations

1. **Join a room** - Verify no flickering on initial join
2. **Toggle camera/microphone** - Ensure video doesn't refresh
3. **Send/receive messages** - Check for stable video
4. **Participant joins/leaves** - Verify no video disruption
5. **Network reconnection** - Ensure smooth recovery
6. **Device changes** - Test camera/mic switching

## Best Practices Applied

1. ✅ Use refs for handlers that don't need to trigger effects
2. ✅ Extract primitive values from objects for dependencies
3. ✅ Minimize effect dependency arrays
4. ✅ Consolidate related async operations
5. ✅ Move debug logging to appropriate lifecycle points
6. ✅ Use stable references where possible
7. ✅ Guard against redundant effect executions

## Migration Notes

These optimizations are **backward compatible** and don't change the API or user-facing behavior. The improvements are purely internal performance optimizations.

