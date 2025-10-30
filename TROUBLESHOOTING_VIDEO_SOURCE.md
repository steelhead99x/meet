# Troubleshooting: "Could not start video source" Error

## Common Causes

The "Could not start video source" error typically occurs due to camera/microphone device access issues and is **not related to the PIP feature**. Here are the most common causes:

### 1. Browser Permissions Not Granted

**Solution:**
- Click the camera/microphone icons in your browser's address bar
- Make sure permissions are set to "Allow"
- Try refreshing the page after granting permissions

**Chrome:**
- Go to `chrome://settings/content/camera` and `chrome://settings/content/microphone`
- Make sure your site is allowed

**Firefox:**
- Click the lock icon in the address bar
- Check camera and microphone permissions

**Safari:**
- Safari > Settings > Websites > Camera/Microphone
- Allow access for your site

### 2. Camera/Microphone In Use by Another Application

**Solution:**
- Close other applications that might be using the camera (Zoom, Teams, Skype, etc.)
- Close other browser tabs that are using the camera
- Restart your browser

**Check on Mac:**
```bash
lsof | grep "AppleCamera"
```

**Check on Windows:**
- Open Task Manager
- Look for applications using camera/microphone

### 3. No Camera/Microphone Available

**Solution:**
- Make sure your camera and microphone are properly connected
- Try a different USB port if using external devices
- Check Device Manager (Windows) or System Preferences (Mac) to verify devices are recognized

### 4. HTTPS Required

**Solution:**
- Camera/microphone access requires HTTPS in modern browsers (except localhost)
- Make sure you're accessing via `https://` or `localhost`

### 5. Browser Version

**Solution:**
- Update to the latest version of your browser
- LiveKit requires modern browser features

## Testing the Camera

To test if the issue is with your setup or the application:

1. **Test in browser directly:**
   - Go to https://webrtc.github.io/samples/src/content/getusermedia/gum/
   - This will test basic camera access

2. **Check browser console:**
   - Open Developer Tools (F12)
   - Check the Console tab for specific error messages
   - Look for permission denial errors

## PIP Feature Specific

The Picture-in-Picture feature only activates **after** you successfully join a meeting and start screen sharing. If you're getting the video source error:

1. **It happens BEFORE screen sharing** - during initial camera setup
2. **PIP is not the cause** - the error is preventing you from joining the meeting
3. **Fix camera access first** - follow the steps above

## Development Environment

If you're testing locally:

1. **Make sure dev server is running:**
   ```bash
   npm run dev
   ```

2. **Access via localhost:**
   - Use `http://localhost:3000` (HTTPS not required for localhost)
   - Don't use your IP address (e.g., 192.168.x.x) as it requires HTTPS

3. **Check for port conflicts:**
   ```bash
   lsof -i :3000  # Mac/Linux
   netstat -ano | findstr :3000  # Windows
   ```

## Debugging Steps

1. **Open browser console** (F12)
2. **Look for specific errors:**
   ```
   NotAllowedError: Permission denied
   NotFoundError: No camera found
   NotReadableError: Camera in use
   ```
3. **Grant permissions** when prompted
4. **Try incognito/private mode** to rule out extension conflicts
5. **Test with a different browser**

## Still Having Issues?

If you've tried all the above and still get the error:

1. **Check LiveKit connection:**
   - Make sure LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are set correctly
   - Verify the LiveKit server is accessible

2. **Check environment variables:**
   ```bash
   # In your project directory
   cat .env.local
   ```

3. **Look for network issues:**
   - Check if your firewall is blocking WebRTC
   - Try from a different network

4. **Review recent changes:**
   - If this worked before, what changed?
   - Try reverting recent code changes

## Testing PIP Without Your Camera

If you want to test the PIP feature without fixing your camera:

1. Join with video disabled
2. Have another participant join with video enabled  
3. Start screen sharing
4. The PIP overlay should show the other participant's video

This proves the PIP feature works independently of your local camera.

