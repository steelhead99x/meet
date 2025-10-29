# Testing Guide: User Preferences & Default Blur

## Overview
This guide explains how to test the newly implemented user preferences system and default blur effect.

## Prerequisites
1. Ensure you have the latest code
2. Clean build: `rm -rf .next && npm run build`
3. Start the server: `npm run dev` or `npm start`

## Test Cases

### 1. Default Blur Effect (First Visit)

**Test Steps:**
1. Clear browser local storage:
   - Open DevTools (F12)
   - Go to Application tab > Local Storage
   - Delete the `livekit-user-preferences` key
2. Navigate to the app and enter a room
3. Join with video enabled

**Expected Result:**
- Background blur should be automatically enabled
- Check browser console for: `[CameraSettings] Loaded preferences:`
- Blur quality should be auto-detected based on your device

### 2. Preferences Persistence

**Test Steps:**
1. Join a room with video and audio
2. In camera settings, change background to a gradient or image
3. Toggle noise cancellation on/off
4. Leave the room (or refresh the page)
5. Rejoin the room

**Expected Result:**
- Your background selection should be preserved
- Noise cancellation state should match what you set
- Check local storage for saved preferences:
  ```javascript
  JSON.parse(localStorage.getItem('livekit-user-preferences'))
  ```

### 3. PreJoin Settings Persistence

**Test Steps:**
1. On the prejoin screen:
   - Enter your name
   - Toggle camera on/off
   - Toggle microphone on/off
2. Join the room
3. Leave and come back to the prejoin screen

**Expected Result:**
- Your name should be pre-filled
- Camera/mic toggles should match your last state
- Check console for: `[CustomPreJoin] Saved user preferences:`

### 4. Device Selection Persistence

**Test Steps:**
1. On prejoin or in settings:
   - Select a specific camera from the dropdown
   - Select a specific microphone from the dropdown
2. Leave and rejoin

**Expected Result:**
- The same devices should be selected automatically
- No need to reselect devices

### 5. Blur Quality Settings

**Test Steps:**
1. Join a room with video
2. Open settings menu (if available)
3. Change blur quality (low/medium/high/ultra)
4. Leave and rejoin

**Expected Result:**
- Blur quality setting should be preserved
- Visual quality should match the selected level

## Browser Console Debugging

Check for these log messages to verify functionality:

```javascript
// On page load
[CameraSettings] Loaded preferences: {...}

// When changing background
[CameraSettings] Background changed to: blur

// When changing blur quality
[BlurConfig] Blur quality changed to: medium

// When saving preferences
[UserPreferences] Saved preferences: {...}

// On prejoin
[CustomPreJoin] Saved user preferences: {...}

// For microphone settings
[MicrophoneSettings] Noise filter enabled: true
```

## Inspecting Local Storage

To see what's saved:

```javascript
// In browser console
const prefs = JSON.parse(localStorage.getItem('livekit-user-preferences'));
console.log(prefs);

// Should show something like:
{
  videoEnabled: true,
  audioEnabled: true,
  backgroundType: "blur",
  blurQuality: "medium",
  noiseFilterEnabled: true,
  username: "John Doe",
  videoDeviceId: "abc123...",
  audioDeviceId: "def456..."
}
```

## Testing Default Values

### First-Time User Experience:
- **Background**: Blur (enabled by default)
- **Blur Quality**: Auto-detected based on device
- **Video**: Enabled
- **Audio**: Enabled
- **Noise Filter**: Enabled (on non-low-power devices)

### Returning User Experience:
- All previously saved settings are restored
- No need to reconfigure

## Resetting Preferences

To test from scratch:

```javascript
// In browser console
localStorage.removeItem('livekit-user-preferences');
// Or
clearUserPreferences(); // if available in window scope
```

Then refresh the page to test first-time behavior again.

## Common Issues

### Issue: Blur not appearing by default
**Solution:** Check console for errors, verify browser supports WebGL

### Issue: Preferences not saving
**Solution:** Check if localStorage is blocked (private browsing mode), check console for errors

### Issue: Wrong device selected
**Solution:** Device IDs can change when devices are unplugged/replugged. This is expected behavior.

## Feature Checklist

- [ ] Blur enabled by default on first visit
- [ ] Background settings persist after page reload
- [ ] Device selections persist after page reload
- [ ] Username persists in prejoin
- [ ] Video/audio toggle states persist
- [ ] Noise filter state persists
- [ ] Blur quality persists
- [ ] Settings survive browser restart (as long as localStorage isn't cleared)
- [ ] No console errors related to preferences
- [ ] Build completes successfully

## Performance Notes

The preferences system is lightweight:
- Single localStorage key
- ~1KB of data typical
- No network requests
- Instant load/save
- No impact on video quality
- No impact on connection speed

## Privacy Notes

All preferences are stored **locally** on the user's device:
- Not sent to any server
- Not shared with other users
- Can be cleared anytime by the user
- Follows browser's localStorage policies


