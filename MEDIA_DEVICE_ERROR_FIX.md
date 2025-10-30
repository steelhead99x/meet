# Media Device Error Handling Fix

## Problem

The application was experiencing several media device-related errors:

1. **Camera Timeout Error**: `AbortError: Timeout starting video source` - occurred when a previously saved camera deviceId was no longer available (e.g., external webcam unplugged)
2. **Screen Share Error**: `NotReadableError: Could not start video source` - occurred when screen sharing failed due to permissions or device conflicts
3. **Generic Error Messages**: Errors weren't providing helpful context to users about what went wrong

## Root Causes

### 1. Invalid Device IDs
- User preferences stored camera/microphone deviceIds in localStorage
- When devices were disconnected or changed, these IDs became invalid
- LiveKit would attempt to start the device with an invalid ID and timeout

### 2. Poor Error Handling
- All errors were treated the same way
- Users weren't given actionable information about what went wrong
- No retry logic for recoverable errors

## Solutions Implemented

### 1. Device Validation in PreJoin (`lib/CustomPreJoin.tsx`)

Added device validation before attempting to initialize camera/microphone:

```typescript
// Validate that saved devices are still available
React.useEffect(() => {
  const validateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      let videoIdValid = !savedPrefs.videoDeviceId;
      let audioIdValid = !savedPrefs.audioDeviceId;
      
      if (savedPrefs.videoDeviceId) {
        videoIdValid = videoDevices.some(d => d.deviceId === savedPrefs.videoDeviceId);
        if (!videoIdValid) {
          console.log('[CustomPreJoin] Saved video device not found, will use default');
          saveUserPreferences({ videoDeviceId: undefined });
        }
      }
      
      if (savedPrefs.audioDeviceId) {
        audioIdValid = audioDevices.some(d => d.deviceId === savedPrefs.audioDeviceId);
        if (!audioIdValid) {
          console.log('[CustomPreJoin] Saved audio device not found, will use default');
          saveUserPreferences({ audioDeviceId: undefined });
        }
      }
      
      setValidatedDeviceIds({
        video: videoIdValid ? savedPrefs.videoDeviceId : undefined,
        audio: audioIdValid ? savedPrefs.audioDeviceId : undefined,
      });
    } catch (error) {
      console.error('[CustomPreJoin] Error validating devices:', error);
      setValidatedDeviceIds({ video: undefined, audio: undefined });
    }
  };
  
  validateDevices();
}, []);
```

**Benefits**:
- Invalid device IDs are detected and cleared before attempting to use them
- Falls back to default devices automatically
- Prevents timeout errors in the PreJoin phase

### 2. Enhanced Error Messages (`app/rooms/[roomName]/PageClientImpl.tsx`)

Implemented specific error handling based on error type:

```typescript
handleError: (error: Error | unknown) => {
  const errorMessage = error instanceof Error && error.message 
    ? error.message 
    : 'An unexpected error occurred';
  const errorName = error instanceof Error ? error.name : '';
  
  // Provide better error messages based on error type
  if (errorName === 'NotReadableError') {
    // NotReadableError typically occurs with screen sharing or when device is in use
    toast.error('Could not access media device. It may be in use by another application or tab.', {
      duration: 7000,
      position: 'top-center',
    });
  } else if (errorMessage.includes('Could not start video source') || 
             errorMessage.includes('Timeout starting video source') ||
             (error instanceof Error && error.name === 'AbortError')) {
    toast.error('Camera or screen share failed to start. Please check permissions and try again.', {
      duration: 7000,
      position: 'top-center',
    });
  } else if (errorName === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
    toast.error('Permission denied. Please allow camera/microphone access and try again.', {
      duration: 6000,
      position: 'top-center',
    });
  } else if (errorName === 'NotFoundError') {
    toast.error('Camera or microphone not found. Please check your device connections.', {
      duration: 6000,
      position: 'top-center',
    });
  } else {
    toast.error(`Encountered an unexpected error: ${errorMessage}`, {
      duration: 5000,
      position: 'top-center',
    });
  }
}
```

**Benefits**:
- Users receive specific, actionable error messages
- Different error types are handled appropriately
- Better UX with helpful guidance on how to resolve issues

### 3. Camera Fallback with Retry Logic

Added retry logic when camera fails with a specific deviceId:

```typescript
if (videoEnabled) {
  try {
    await room.localParticipant.setCameraEnabled(true);
  } catch (error) {
    console.error('Failed to enable camera with selected device:', error);
    
    // If camera fails (likely due to invalid deviceId), try with default device
    if (videoDeviceId) {
      console.log('Retrying camera with default device...');
      try {
        // Clear the problematic deviceId from localStorage
        const { saveUserPreferences } = await import('@/lib/userPreferences');
        saveUserPreferences({ videoDeviceId: undefined });
        
        // Recreate room without specific deviceId
        const roomOptions = room.options;
        if (roomOptions.videoCaptureDefaults) {
          roomOptions.videoCaptureDefaults.deviceId = undefined;
        }
        
        // Try enabling camera again (LiveKit will use default device)
        await room.localParticipant.setCameraEnabled(true);
        
        toast.success('Switched to default camera', {
          duration: 3000,
          position: 'top-center',
        });
      } catch (retryError) {
        console.error('Failed to enable camera with default device:', retryError);
        toast.error('Camera could not be started. Please check permissions.', {
          duration: 5000,
          position: 'top-center',
        });
      }
    }
  }
}
```

**Benefits**:
- Automatically retries with default device if saved device fails
- Clears invalid device IDs from storage
- Provides user feedback on the fallback
- Gracefully degrades if default device also fails

### 4. Individual Track Error Handling

Separated error handling for microphone and camera:

```typescript
if (audioEnabled) {
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
  } catch (error) {
    console.error('Failed to enable microphone:', error);
    toast.error('Could not enable microphone', {
      duration: 4000,
      position: 'top-center',
    });
  }
}

if (videoEnabled) {
  try {
    await room.localParticipant.setCameraEnabled(true);
  } catch (error) {
    // Handle error with retry logic...
  }
}
```

**Benefits**:
- Microphone failures don't prevent camera from working (and vice versa)
- More granular error reporting
- Better user experience when only one device fails

## Error Types Handled

| Error Name | Cause | User Message |
|------------|-------|--------------|
| `NotReadableError` | Device in use by another app/tab | "Could not access media device. It may be in use by another application or tab." |
| `AbortError` | Device timeout (invalid deviceId) | "Camera or screen share failed to start. Please check permissions and try again." |
| `NotAllowedError` | Permission denied by user | "Permission denied. Please allow camera/microphone access and try again." |
| `NotFoundError` | Device not found/disconnected | "Camera or microphone not found. Please check your device connections." |
| Timeout messages | Device unresponsive | "Camera or screen share failed to start. Please check permissions and try again." |

## Testing Recommendations

### Test Case 1: Invalid Saved Device ID
1. Join a room with an external webcam
2. Exit the room
3. Disconnect the webcam
4. Try to join the room again
5. **Expected**: Should automatically fall back to default camera

### Test Case 2: Screen Share Permission Denied
1. Join a room
2. Click screen share
3. Cancel the permission dialog
4. **Expected**: Should show user-friendly error message

### Test Case 3: Device In Use
1. Open the camera in another application
2. Try to join the room
3. **Expected**: Should show "device in use" error message

### Test Case 4: No Devices Available
1. Disable/disconnect all cameras
2. Try to join the room
3. **Expected**: Should show "device not found" error

## Files Modified

1. `/app/rooms/[roomName]/PageClientImpl.tsx` - Enhanced error handling and retry logic
2. `/app/custom/VideoConferenceClientImpl.tsx` - Enhanced error handling
3. `/lib/CustomPreJoin.tsx` - Device validation before initialization

## Future Improvements

1. **Device Change Detection**: Listen for `devicechange` events and update UI when devices are connected/disconnected
2. **Automatic Recovery**: If a device becomes available again, automatically switch to it
3. **Device Selection UI**: Allow users to easily switch devices mid-call if their preferred device becomes available
4. **Error Analytics**: Track error types and frequencies to identify common issues

