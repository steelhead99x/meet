# Quick Test Guide - Screen Share PIP Window

## 🚀 How to Test the New Feature

### Prerequisites
- **Chrome browser** version 116 or higher
- Two browser windows/tabs (to simulate multiple participants)

### Step-by-Step Test

#### 1. Start the Application

```bash
cd /Users/kdoug0116/Documents/cursor/meet
npm run dev
```

Wait for the server to start, then open: `http://localhost:3000`

#### 2. Join a Meeting

**First Window (You):**
1. Navigate to `http://localhost:3000`
2. Enter your name (e.g., "Test User 1")
3. Enable your camera and microphone
4. Click "Join Room"

**Second Window (Simulated Participant):**
1. Open a new Chrome window/tab
2. Navigate to the same room URL
3. Enter a different name (e.g., "Test User 2")
4. Enable camera
5. Click "Join Room"

#### 3. Test the Screen Share PIP

**In the First Window:**

1. **Click the Screen Share button** (usually in the bottom toolbar)
2. **Select a screen/window/tab to share** in the Chrome dialog
3. **Click "Share"**

**✨ EXPECTED BEHAVIOR:**
- A **new always-on-top window** should open immediately
- The window shows **participant videos** (including Test User 2)
- Window header shows: **"Participants (2)"** and **"SCREEN SHARING"** badge
- The window has a **dark theme** with a clean interface

#### 4. Verify Always-On-Top Behavior

**With the PIP window open:**
1. **Open other applications** (like a text editor, browser, etc.)
2. **Click on those applications** to bring them to focus
3. **The PIP window should STAY ON TOP** of everything

This is the Zoom-like behavior! 🎉

#### 5. Test Window Controls

- **Move the window**: Click and drag anywhere on the window
- **Resize the window**: Drag from corners or edges
- **Participants should always be visible** in a responsive grid

#### 6. Stop Screen Sharing

**In the First Window:**
1. **Click the Screen Share button again** (or click "Stop Sharing")

**✨ EXPECTED BEHAVIOR:**
- The **PIP window closes automatically**
- You're back to the normal meeting view

### 🔍 What to Look For

#### Success Indicators ✅
- [ ] PIP window opens when screen sharing starts
- [ ] Window stays on top of all applications
- [ ] Shows all participants with cameras on
- [ ] Window can be moved and resized
- [ ] Window closes when screen sharing stops
- [ ] Clean, professional UI

#### Console Messages
Open DevTools (F12) and look for these logs:

```
[BrowserWindowPIP] Opening PIP window
[BrowserWindowPIP] PIP window closed
```

### 🧪 Additional Test Scenarios

#### Test 3+ Participants
1. Open a third browser window/tab
2. Join the same room as "Test User 3"
3. Start screen sharing from any window
4. The PIP should show all 3 participants in a grid

#### Test with Cameras Off
1. Have one participant turn off their camera
2. Start screen sharing
3. PIP should only show participants with cameras on

#### Test Browser Compatibility

**Chrome 116+** ✅
```bash
# Check Chrome version
chrome://version
```

**Firefox** ❌
- Open the app in Firefox
- Start screen sharing
- PIP window should NOT appear (graceful degradation)
- Check console for: "Document Picture-in-Picture API not supported"

### 🐛 Troubleshooting Test Issues

#### PIP Window Doesn't Open

**Check browser version:**
```javascript
// In DevTools console:
'documentPictureInPicture' in window
// Should return: true (in Chrome 116+)
```

**Check console for errors:**
- Open DevTools (F12)
- Go to Console tab
- Look for error messages starting with `[BrowserWindowPIP]`

#### Window Doesn't Stay on Top

**This might happen if:**
- You're not using Chrome 116+
- Your OS has special window management settings
- Enterprise/managed browser policies block PIP

**Try:**
1. Update Chrome to the latest version
2. Test on a different computer
3. Check if PIP windows work in other sites (e.g., YouTube PIP)

#### No Styles in PIP Window

**If the PIP window looks unstyled:**
1. Check DevTools console for CSS errors
2. Verify stylesheets are loading
3. This is rare - the component copies all styles automatically

### 📊 Visual Comparison

#### Before (Old ScreenSharePIP)
```
┌──────────────────────────────┐
│    Main Browser Window       │
│                              │
│  ┌─────────────────┐        │
│  │ Overlay PIP     │        │ ← Could be covered
│  │ (inside window) │        │    by shared content
│  └─────────────────┘        │
│                              │
└──────────────────────────────┘
```

#### After (New BrowserWindowPIP)
```
┌──────────────────────────────┐ ┌──────────────┐
│    Main Browser Window       │ │  PIP Window  │ ← Always on top!
│                              │ │  (separate)  │
│  (Screen sharing content)    │ │              │
│                              │ │  👤 User 1   │
│                              │ │  👤 User 2   │
└──────────────────────────────┘ └──────────────┘
                                   ^ Stays above
                                     everything!
```

### 🎯 Expected User Experience

**User starts screen sharing:**
1. Clicks share button → Instant PIP window opens
2. Selects screen to share → Window stays open
3. Shares presentation → Participants always visible
4. Stops sharing → Window closes automatically

**Zero configuration. Just works!** 🎉

### 📝 Test Checklist

- [ ] Application builds successfully (`npm run build`)
- [ ] Development server starts (`npm run dev`)
- [ ] Can join a meeting
- [ ] Can start screen sharing
- [ ] PIP window opens automatically
- [ ] Window shows participants correctly
- [ ] Window stays on top of all apps
- [ ] Can move/resize window
- [ ] Window closes when sharing stops
- [ ] No console errors
- [ ] Works with multiple participants
- [ ] Graceful degradation in Firefox/Safari

### 🎉 Success!

If all tests pass, you now have a **professional Zoom-like screen sharing experience** in your LiveKit meeting application!

---

**Need Help?**
- See `BROWSER_WINDOW_PIP.md` for technical details
- See `SCREENSHARE_PIP_GUIDE.md` for user documentation
- See `IMPLEMENTATION_SUMMARY.md` for implementation overview

