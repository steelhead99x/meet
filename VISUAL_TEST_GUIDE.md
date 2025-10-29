# Visual Test Guide - Z-Index Fixes

## Quick Verification Steps

### Test 1: Device Menu Dropdown
**Purpose**: Verify microphone/camera device menus appear in front of videos

1. Start or join a video call
2. Click the small dropdown arrow **next to the microphone button**
3. ✅ **PASS**: Menu appears with a dark background, fully visible above all video tiles
4. ❌ **FAIL**: Menu appears behind videos or is partially hidden

**Expected Result**:
```
Menu z-index: 350
Video tiles z-index: 1
Menu should be clearly visible with full opacity
```

### Test 2: Connection Quality Tooltip
**Purpose**: Verify tooltips appear above video tiles

1. Join a call with at least one other participant
2. **Hover** over the connection quality indicator (signal bars icon) on any participant tile
3. ✅ **PASS**: Tooltip appears above the video with connection stats
4. ❌ **FAIL**: Tooltip is clipped, hidden, or appears behind video

**Expected Result**:
```
Tooltip z-index: 250
Video tiles z-index: 1
Tooltip should show bitrate, packet loss, jitter stats
```

### Test 3: Settings Menu
**Purpose**: Verify settings panel appears in front of all content

1. Click the **settings gear icon** in the control bar
2. Settings panel should open with camera, microphone, and blur quality controls
3. ✅ **PASS**: Full settings panel visible, all controls clickable
4. ❌ **FAIL**: Settings panel appears behind videos or partially hidden

**Expected Result**:
```
Settings menu z-index: 500
Video tiles z-index: 1
All buttons and dropdowns in settings should work
```

### Test 4: Multi-Participant Test
**Purpose**: Verify menus work with multiple participants

1. Join a call with **3+ participants** (or open multiple browser tabs)
2. Open the camera device menu dropdown
3. Switch between different devices
4. ✅ **PASS**: Menu stays visible and functional above all video tiles
5. ❌ **FAIL**: Menu flickers, disappears, or goes behind videos

**Expected Result**:
```
Device menu should remain at z-index: 350
All participant tiles should remain at z-index: 1
No z-index conflicts or stacking issues
```

### Test 5: Chat Panel (if enabled)
**Purpose**: Verify chat doesn't conflict with menus

1. Click the **chat icon** to open chat
2. While chat is open, click the microphone dropdown
3. ✅ **PASS**: Dropdown menu appears in front of chat panel
4. ❌ **FAIL**: Menu appears behind chat or is not clickable

**Expected Result**:
```
Chat panel z-index: 400
Device menu z-index: 350 (should appear in front of chat when opened)
```

## Common Issues & Solutions

### Issue: Menu appears behind video
**Cause**: Browser cache may be serving old CSS  
**Solution**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Tooltip doesn't appear
**Cause**: Connection quality component may not be loaded  
**Solution**: Wait a few seconds for stats to populate, then hover again

### Issue: Settings menu partially visible
**Cause**: Settings component may have inline styles overriding CSS  
**Solution**: Inspect element and verify z-index: 500 is applied

## Browser DevTools Inspection

### Check Z-Index Values
1. Open browser DevTools (F12)
2. Select the element (menu, tooltip, etc.)
3. Look at **Computed** tab
4. Search for "z-index"
5. Verify it matches the expected value from the hierarchy

### Expected Z-Index Values
- Video tiles: `1`
- Participant metadata: `2`
- Control bar: `100`
- Button groups: `110`
- Tooltips: `250`
- Device menus: `350`
- Chat panel: `400`
- Settings menu: `500`

### Check Stacking Context
1. In DevTools, inspect the `.lk-video-conference` element
2. Check Computed styles for:
   - `isolation: isolate` ✅
   - `z-index: auto` ✅
3. This creates proper stacking context isolation

## Regression Tests

After any future CSS changes, re-run these tests:

1. ✅ Device menus clickable and visible
2. ✅ Tooltips appear on hover above videos
3. ✅ Settings panel fully functional
4. ✅ Chat doesn't interfere with menus
5. ✅ No visual glitches with 4+ participants

## Automated Testing (Future)

Consider adding Playwright/Cypress tests for:
```javascript
// Example test structure
test('Device menu appears above videos', async () => {
  // 1. Join call
  // 2. Get z-index of video tile
  // 3. Click device menu dropdown
  // 4. Get z-index of menu
  // 5. Assert menu z-index > video z-index
});
```

## Success Criteria

✅ All dropdowns and menus are fully visible  
✅ No clipping or partial obscuring of UI elements  
✅ Tooltips appear correctly on hover  
✅ Settings panel is fully accessible  
✅ No z-index conflicts in any scenario  
✅ Consistent behavior across Chrome, Firefox, Safari  

## Questions?

If you encounter any stacking issues not covered here, check:
1. `ZINDEX_FIX_SUMMARY.md` for technical details
2. Browser console for any CSS errors
3. Computed styles in DevTools to verify z-index values

**Note**: If you modify any component styles in the future, always refer to the z-index hierarchy documented in `/styles/globals.css` to maintain consistency.


