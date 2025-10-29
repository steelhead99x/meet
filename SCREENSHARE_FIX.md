# Screen Share Visibility Fix

## Issue
The screen share window was not fully visible to users when sharing their screen. Parts of the shared content were being cropped, preventing viewers from seeing the complete shared screen.

## Root Cause
The CSS styling for participant tile videos was using `object-fit: cover`, which crops the video to fill the container while maintaining aspect ratio. This works well for camera feeds (where you want to fill the frame), but for screen shares, users need to see the **entire screen content** without any cropping.

## Solution Implemented
Added specific CSS rules in `styles/modern-theme.css` (lines 1001-1007) to use `object-fit: contain` for screen share videos:

```css
/* Screen share video - use contain to show entire screen without cropping */
[data-lk-theme] .lk-participant-tile[data-lk-source="screen_share_video"] video,
[data-lk-theme] .lk-participant-tile[data-lk-source="screen_share"] video,
[data-lk-theme] .lk-focus-layout .lk-participant-tile video {
  object-fit: contain;
  background-color: #000; /* Black background for letterboxing */
}
```

### What This Does:
1. **`object-fit: contain`** - Scales the video to fit within the container while maintaining aspect ratio and showing the entire video (no cropping)
2. **`background-color: #000`** - Adds black letterboxing when the screen share aspect ratio doesn't match the container
3. **Multiple selectors** - Targets screen share videos in different layouts:
   - `[data-lk-source="screen_share_video"]` - Specific screen share video tracks
   - `[data-lk-source="screen_share"]` - General screen share tracks
   - `.lk-focus-layout .lk-participant-tile video` - Videos in the focus layout (which is automatically activated when screen sharing)

## LiveKit Architecture Reference

### Focus Layout
When a participant shares their screen, LiveKit's VideoConference component automatically switches to a "focus layout" which:
- Displays the screen share in a large main area (`.lk-focus-layout > div:first-child`)
- Shows participant thumbnails in a horizontal carousel below (`.lk-focus-layout > div:last-child`, max-height: 140px)
- This layout is defined in `styles/modern-theme.css` lines 1113-1134

### Track Sources
LiveKit uses the `Track.Source` enum to identify different types of video tracks:
- `Track.Source.Camera` - User's camera
- `Track.Source.Microphone` - User's microphone
- `Track.Source.ScreenShare` - Screen share video
- `Track.Source.ScreenShareAudio` - Screen share audio (browser tab audio)

These sources are exposed as `data-lk-source` attributes in the DOM, which we can target with CSS.

## Testing Recommendations

To test this fix:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the app in two browser windows/tabs:**
   - Join the same room from both
   - Use different participant names

3. **Start screen sharing from one participant:**
   - Click the "Share screen" button
   - Select a window, tab, or entire screen
   - Verify the browser prompts for screen share permissions

4. **Verify on both clients:**
   - **Sharer's view:** Should see their screen share in the large focus area with participant thumbnails below
   - **Viewer's view:** Should see the complete shared screen without any cropping
   - Check that the entire screen content is visible
   - Verify black letterboxing appears if aspect ratios don't match

5. **Test different scenarios:**
   - Share a window with unusual aspect ratio (wide/narrow)
   - Share a full screen with different resolution
   - Share a browser tab
   - Test with chat panel open/closed to ensure screen share resizes properly

## Additional Notes

### CSS Object-Fit Values
- `cover` - Fills container, crops to fit (good for faces/camera)
- `contain` - Shows entire video, adds letterboxing if needed (good for screen shares)
- `fill` - Stretches to fill (distorts aspect ratio - not recommended)

### Browser Compatibility
Screen sharing works in modern browsers:
- Chrome/Edge: Full support including tab audio
- Firefox: Full support including tab audio
- Safari: Basic support (iOS requires Broadcast Extension)

### Performance Considerations
The focus layout is already optimized with:
- `overflow: hidden` to prevent layout shifts
- `flex: 1` to take available space efficiently
- `min-height: 0` to allow proper shrinking

## Related Files
- `styles/modern-theme.css` - Main theme and layout styling
- `app/rooms/[roomName]/PageClientImpl.tsx` - VideoConference component usage
- `app/custom/VideoConferenceClientImpl.tsx` - Alternative custom implementation
- `lib/KeyboardShortcuts.tsx` - Keyboard shortcuts (could add screen share toggle)

## Further Improvements (Optional)

Consider these enhancements:

1. **Add keyboard shortcut for screen share:**
   ```typescript
   // In KeyboardShortcuts.tsx
   const { toggle: toggleScreenShare } = useTrackToggle({ 
     source: Track.Source.ScreenShare 
   });
   // Bind to Cmd/Ctrl-S
   ```

2. **Add screen share indicator:**
   - Show a visual indicator when someone is sharing
   - Display "Presenting" badge on the sharer's tile

3. **Optimize screen share quality:**
   ```typescript
   // Configure screen share capture options
   await localParticipant.setScreenShareEnabled(true, {
     video: {
       width: { ideal: 1920 },
       height: { ideal: 1080 },
       frameRate: { ideal: 30 }
     }
   });
   ```

4. **Handle screen share end gracefully:**
   - Detect when user closes screen share dialog
   - Switch back to grid layout automatically
   - Show notification "Screen sharing stopped"

