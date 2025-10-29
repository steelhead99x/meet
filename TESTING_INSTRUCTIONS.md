# 🧪 Testing Instructions - LiveKit Blinking & Overlay Fixes

## Pre-Test Setup

1. **Start your development server:**
   ```bash
   npm run dev
   # or
   pnpm dev
   # or
   yarn dev
   ```

2. **Open multiple browser windows:**
   - Window 1: `http://localhost:3000/rooms/test-room`
   - Window 2: `http://localhost:3000/rooms/test-room` (incognito/private)
   - This simulates multiple participants

---

## ✅ Test Suite

### Test 1: Video Blinking Fix - Camera Toggle
**Steps:**
1. Join a room with camera enabled
2. Click the camera button 5-10 times rapidly
3. Observe the video feed

**✅ Success Criteria:**
- Video stays visible throughout toggling
- No black screen flashes
- No brief "blinking" of video elements
- Smooth transitions only (fade in/out is OK)

**❌ Failure Indicators:**
- Video disappears completely between toggles
- Black screen flashes
- Video element visibly "pops" in and out

---

### Test 2: Video Blinking Fix - Microphone Toggle
**Steps:**
1. Join a room with microphone enabled
2. Click the microphone button 5-10 times rapidly
3. Watch the video feed (should not blink)

**✅ Success Criteria:**
- Video remains stable
- Only microphone icon changes
- No video remounting

**❌ Failure Indicators:**
- Video flashes when toggling mic
- Participant tile reloads

---

### Test 3: Video Blinking Fix - Screen Share
**Steps:**
1. Join a room with 2 participants
2. Participant 1: Click "Share Screen" button
3. Share entire screen or window
4. Stop screen share
5. Repeat 2-3 times

**✅ Success Criteria:**
- Smooth transition to focus layout
- No blinking of participant videos
- Screen share appears/disappears cleanly
- No black flashes

**❌ Failure Indicators:**
- Participant videos blink during layout change
- Screen share video flashes on start/stop
- Video tiles reload

---

### Test 4: Overlay Alignment - Visual Inspection
**Steps:**
1. Join a room with camera enabled
2. Open browser DevTools (F12)
3. Select the participant tile in Elements tab
4. Look for any elements with "overlay" in the class name
5. Inspect the computed styles

**✅ Success Criteria:**
- Overlay covers entire tile (no gaps at bottom)
- CSS shows:
  - `inset: 0` or `top/right/bottom/left: 0`
  - `width: 100%`
  - `height: 100%`
  - `margin: 0`
  - `padding: 0`
  - `box-sizing: border-box`

**❌ Failure Indicators:**
- Gap at bottom of tile (even 1px)
- Overlay not aligned to edges
- Scrollbars visible

---

### Test 5: Overlay Alignment - Different Resolutions
**Steps:**
1. Open DevTools → Device Toolbar (Ctrl+Shift+M)
2. Test these resolutions:
   - 1920x1080 (Full HD)
   - 1366x768 (Laptop)
   - 768x1024 (iPad)
   - 375x812 (iPhone)

**✅ Success Criteria:**
- Overlays cover tiles fully at all resolutions
- No gaps or misalignments
- Video stays centered

**❌ Failure Indicators:**
- Gaps appear at specific resolutions
- Overlay size doesn't match tile

---

### Test 6: Performance - React DevTools Profiler
**Steps:**
1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Click "Start profiling"
4. Toggle camera on/off 3 times
5. Stop profiling
6. Examine the flame graph

**✅ Success Criteria:**
- VideoConference component shows **1-2 renders** per toggle
- No "Remounted" labels in profiler
- Minimal child component updates

**❌ Failure Indicators:**
- VideoConference shows **5+ renders** per toggle
- "Remounted" labels visible
- Entire component tree re-renders

---

### Test 7: Keyboard Shortcuts Stability
**Steps:**
1. Join a room
2. Press `Cmd/Ctrl + A` (toggle mic) 5 times rapidly
3. Press `Cmd/Ctrl + V` (toggle camera) 5 times rapidly
4. Watch for video blinking

**✅ Success Criteria:**
- Keyboard shortcuts work instantly
- Video doesn't blink
- No lag or delay

**❌ Failure Indicators:**
- Shortcuts trigger video remounts
- Delayed response
- Video flashes

---

### Test 8: E2EE Encryption Stability
**Steps:**
1. Join room with E2EE enabled (check the checkbox)
2. Wait for "🔒 End-to-end encryption enabled" toast
3. Toggle camera/mic multiple times
4. Share screen

**✅ Success Criteria:**
- E2EE indicator stays visible
- No video blinking
- Encryption doesn't cause remounts

**❌ Failure Indicators:**
- Video blinks on E2EE initialization
- Frequent reconnections
- Black screens

---

### Test 9: Multiple Participants - Grid Layout
**Steps:**
1. Open 3+ browser windows/tabs
2. Join same room from all windows
3. Enable cameras on all participants
4. Toggle camera on participant 1
5. Observe if OTHER participants' videos blink

**✅ Success Criteria:**
- Only the toggled participant's video changes
- Other participants' videos remain stable
- No grid re-layout blinking

**❌ Failure Indicators:**
- All videos blink when one toggles
- Grid jumps or shifts
- Tiles reload

---

### Test 10: CPU Performance - Background Blur
**Steps:**
1. Join room with camera enabled
2. Open Settings → Camera → Background Effects
3. Enable "Blur" background
4. Toggle camera on/off
5. Watch for increased blinking

**✅ Success Criteria:**
- Video doesn't blink when enabling blur
- Smooth application of blur effect
- Toggle still works without blinking

**❌ Failure Indicators:**
- Video remounts when blur applied
- Black screen during processor change
- Frequent flashing

---

## 📊 Test Results Template

Copy this template to track your testing:

```
## Test Results - [Date]

### Test 1: Camera Toggle
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 2: Microphone Toggle
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 3: Screen Share
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 4: Overlay Inspection
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 5: Multiple Resolutions
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 6: React Profiler
- [ ] Pass / [ ] Fail
- Render count: ___ per toggle
- Notes: _______________________

### Test 7: Keyboard Shortcuts
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 8: E2EE Stability
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 9: Multiple Participants
- [ ] Pass / [ ] Fail
- Notes: _______________________

### Test 10: Background Blur
- [ ] Pass / [ ] Fail
- Notes: _______________________

---

**Overall Status:** [ ] All Pass / [ ] Some Fail / [ ] All Fail
**Tested By:** _______________________
**Browser:** _______________________
**OS:** _______________________
```

---

## 🐛 Debugging Failed Tests

### If Video Still Blinks:

1. **Check Browser Console for Errors:**
   ```
   - Look for errors about track state
   - Check for WebRTC errors
   - Verify no JavaScript exceptions
   ```

2. **Verify Memoization:**
   - Open React DevTools
   - Select VideoConference component
   - Check props → ensure `chatMessageEncoder` and `chatMessageDecoder` references are stable

3. **Check CSS:**
   - Inspect `.lk-participant-tile video`
   - Verify `transform: translateZ(0)` is applied
   - Check `backface-visibility: hidden`

### If Overlay Has Gaps:

1. **Inspect Overlay Element:**
   ```css
   /* Should have these styles: */
   position: absolute;
   inset: 0;
   width: 100%;
   height: 100%;
   box-sizing: border-box;
   margin: 0;
   padding: 0;
   ```

2. **Check Parent Container:**
   - Verify `.lk-participant-tile` has `overflow: hidden`
   - Check `position: relative` on tile

3. **Test Different Overlay Classes:**
   - Try adding class `dark-overlay` manually
   - Inspect computed styles in DevTools

---

## 📸 Expected Visual Results

### ✅ GOOD (No Blinking)
```
Camera Toggle:
[Video visible] → [Slight fade] → [Video visible]
No black screens, no "pop" effects
```

### ❌ BAD (Blinking)
```
Camera Toggle:
[Video visible] → [BLACK SCREEN] → [Video visible]
Noticeable flash or "pop"
```

### ✅ GOOD (Overlay Aligned)
```
Participant Tile:
┌─────────────────┐
│                 │ ← No gaps
│     VIDEO       │
│                 │
└─────────────────┘ ← Overlay covers to edge
```

### ❌ BAD (Overlay Misaligned)
```
Participant Tile:
┌─────────────────┐
│                 │
│     VIDEO       │
│                 │
├─────────────────┤ ← Gap here!
└─────────────────┘
```

---

## 🎯 Success Metrics

**All tests PASS if:**
- ✅ Zero video blinks on camera/mic toggle
- ✅ Zero overlay gaps at any resolution
- ✅ 1-2 renders per action in React Profiler
- ✅ Smooth screen share transitions
- ✅ No console errors
- ✅ GPU acceleration active (check DevTools → Layers)

---

## 📞 Need Help?

If tests fail, check:
1. `LIVEKIT_FIXES_APPLIED.md` - Detailed technical explanation
2. `QUICK_FIX_SUMMARY.md` - Quick reference
3. Browser console for errors
4. React DevTools for component behavior

---

**Happy Testing! 🚀**


