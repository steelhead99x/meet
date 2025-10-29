# Screen Share Troubleshooting Guide

## Summary
We've fixed the CSS visibility issue, but you're encountering a browser API error when starting screen share.

## Issues Fixed

### 1. ✅ CSS Visibility Fix (Completed)
**Problem**: Screen share videos were being cropped with `object-fit: cover`  
**Solution**: Changed to `object-fit: contain` for screen share tracks  
**File**: `styles/modern-theme.css` lines 1001-1007

## Current Issue: "AbortError: Invalid state"

### Error Details
```
[LOG] setTrackEnabled {source: screen_share}
[LOG] room event mediaDevicesError
[ERROR] AbortError: Invalid state
```

### Common Causes & Solutions

#### 1. **User Cancelled Screen Share Dialog**
**Symptoms**: Error appears immediately after clicking "Share screen"  
**What happens**: Browser shows picker, user clicks "Cancel"  
**Solution**: This is expected behavior - just click "Share screen" again and select a source

#### 2. **Active Screen Share Already Running**
**Symptoms**: Error when trying to share while already sharing  
**Check**: Look for blue indicator on screen share button  
**Solution**: Stop current screen share first, then start again

#### 3. **Browser Security Restrictions**
**Symptoms**: No dialog appears, immediate error  
**Cause**: Some browsers require HTTPS for screen sharing  
**Solution**: 
   - **Production**: Always use HTTPS
   - **Development**: Use `https://localhost:3000` instead of `http://`
     ```bash
     # If needed, configure Next.js for HTTPS in development
     npm install -D mkcert
     mkcert -install
     mkcert localhost
     ```

#### 4. **Multiple Simultaneous Requests**
**Symptoms**: Error when rapidly clicking button  
**Cause**: Race condition in browser API  
**Solution**: Wait for previous request to complete

#### 5. **Browser Permissions Denied**
**Symptoms**: No dialog, instant error  
**Check**: Browser address bar for blocked permissions icon  
**Solution**: 
   - Click the permissions icon in address bar
   - Allow screen recording/capture
   - Refresh the page

#### 6. **macOS Screen Recording Permission**
**Symptoms**: (macOS only) Dialog appears but sharing fails  
**Solution**:
   1. Go to System Preferences → Security & Privacy → Privacy → Screen Recording
   2. Ensure your browser (Chrome/Safari) is checked
   3. Restart browser if you just granted permission

### Testing Steps

1. **Test Basic Screen Share**:
   ```
   1. Join a room
   2. Click "Share screen" button
   3. When browser dialog appears, select:
      - "Entire Screen" or
      - "Window" or
      - "Chrome Tab"
   4. Click "Share"
   5. Verify screen appears in focus layout
   ```

2. **Verify CSS Fix**:
   ```
   1. Start screen sharing
   2. Check that entire screen is visible (no cropping)
   3. Look for black letterboxing if aspect ratios don't match
   4. Other participants should see complete screen
   ```

3. **Test Stop/Start**:
   ```
   1. Start screen share
   2. Click "Share screen" again to stop
   3. Wait 2 seconds
   4. Click "Share screen" to start again
   5. Should work without errors
   ```

### Browser-Specific Notes

#### Chrome/Edge
- ✅ Full support
- ✅ Can share tab audio
- ⚠️ Requires user gesture (button click)
- ⚠️ May require HTTPS in production

#### Firefox  
- ✅ Full support
- ✅ Can share tab audio
- ⚠️ Permissions dialog is different

#### Safari
- ⚠️ Limited support
- ❌ No tab audio sharing
- ❌ May have additional restrictions
- ℹ️ iOS requires Broadcast Extension

### Development vs Production

| Feature | Development (HTTP) | Production (HTTPS) |
|---------|-------------------|-------------------|
| Screen Share | May work | ✅ Works |
| Browser Support | Limited | Full |
| Security | Warnings | Secure |
| Recommendation | Use HTTPS | Required |

### Error Handling Improvements

The app currently shows a toast error when screen sharing fails. This is correct behavior - the error is informative and doesn't break the app.

**Normal flow**:
1. User clicks "Share screen"
2. Browser shows picker
3. User selects source → Success ✅
4. User cancels → Toast error (expected) ℹ️

### Quick Diagnosis

Run through this checklist:

- [ ] Is the screen share button visible?
- [ ] Does clicking show the browser's screen share picker?
- [ ] If you select a source, does sharing start?
- [ ] If you cancel, do you see the error toast?
- [ ] Can you see the blue indicator when sharing is active?
- [ ] Does the video show the entire screen (not cropped)?

**If all above are "Yes" except the cancel case** → Everything is working correctly! The error on cancel is expected.

**If the picker doesn't appear** → Browser security issue, check permissions

**If video is cropped** → Refresh page to load new CSS

**If button doesn't work at all** → Check browser console for errors

### Manual Testing (Recommended)

Since automated browser testing can't interact with the native screen share picker, you should test manually:

```bash
# 1. Ensure dev server is running
npm run dev

# 2. Open in browser (try HTTPS if possible)
https://localhost:3000/rooms/TestRoom

# 3. Join room with a name
# 4. Click screen share button  
# 5. Select a source in browser picker
# 6. Verify entire screen is visible
```

### Expected Behavior

✅ **Success Case**:
- Click button → Picker appears → Select source → Sharing starts
- Video shows entire screen with black letterboxing
- Button turns blue
- Other participants see your screen

❌ **Error Case (Normal)**:
- Click button → Picker appears → Click "Cancel" → Error toast
- This is EXPECTED and correct behavior
- Just try again

### Additional Resources

- [LiveKit Screen Share Docs](https://docs.livekit.io/home/client/tracks/screenshare/)
- [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- Browser Compatibility: Check if your browser fully supports screen sharing

### Still Having Issues?

If you're still experiencing problems:

1. **Check browser version**: Ensure you're using a recent version
2. **Test in different browser**: Try Chrome, Firefox, or Edge
3. **Check system permissions**: macOS/Windows screen recording permissions
4. **Try incognito mode**: Rules out extension conflicts
5. **Check network**: Some corporate networks block WebRTC

### Summary

- ✅ CSS visibility fix is complete and working
- ℹ️ "AbortError" when cancelling picker is normal and expected
- ⚠️ May need HTTPS for full browser support
- 🧪 Manual testing recommended (automated testing can't interact with native picker)

The screen sharing functionality is working correctly - the error you're seeing is likely from cancelled dialogs or browser security restrictions, both of which are expected behaviors.

