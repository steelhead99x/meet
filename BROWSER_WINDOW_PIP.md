# Browser Window Picture-in-Picture Feature

## Overview

This feature creates a **separate always-on-top browser window** that displays all participants when you start screen sharing. This mimics Zoom's behavior where a small participant window stays visible on top of all other applications during screen sharing.

## How It Works

### Technology Used
The feature uses Chrome's **Document Picture-in-Picture API**, which allows web applications to create separate always-on-top windows. This is a relatively new API (Chrome 116+, released August 2023).

### User Experience
1. **Before Screen Sharing**: Normal video conference view
2. **Start Screen Sharing**: A new always-on-top window automatically opens showing all participant video feeds
3. **During Screen Sharing**: 
   - The PIP window stays on top of all applications
   - You can see participants while sharing your screen
   - The window is resizable and movable
   - Shows participant count and "SCREEN SHARING" badge
4. **Stop Screen Sharing**: The PIP window automatically closes

### Features
- ✅ Always-on-top window (stays above all applications)
- ✅ Automatic opening when screen share starts
- ✅ Automatic closing when screen share stops
- ✅ Responsive grid layout for multiple participants
- ✅ Inherits all styles from main application
- ✅ Shows participant count
- ✅ Visual indicator that screen sharing is active

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: Version 116+ (Full support)
- **Brave**: Version 116+ (Full support)
- **Opera**: Version 102+ (Full support)

### Unsupported Browsers
- **Firefox**: Not supported (API not implemented)
- **Safari**: Not supported (API not implemented)

**Fallback Behavior**: If the Document Picture-in-Picture API is not available, the feature gracefully fails and logs a warning to the console. The application continues to work normally without the PIP window.

## Implementation Details

### Component: `BrowserWindowPIP.tsx`

**Location**: `/lib/BrowserWindowPIP.tsx`

**Key Functionality**:
1. **Screen Share Detection**: Monitors local participant's screen share status using LiveKit's track system
2. **Window Management**: Opens/closes PIP window based on screen share state
3. **Content Rendering**: Uses React 18's `createRoot` to render participant grid in the PIP window
4. **Style Copying**: Automatically copies all stylesheets from main window to PIP window
5. **Event Handling**: Properly cleans up React roots and event listeners

### API Usage

```typescript
// Check if API is available
if ('documentPictureInPicture' in window) {
  // Request a PIP window
  const pipWindow = await window.documentPictureInPicture.request({
    width: 500,
    height: 400,
    disallowReturnToOpener: false,
  });
}
```

### Integration Points

The `BrowserWindowPIP` component is integrated in:
- `/app/rooms/[roomName]/PageClientImpl.tsx` (standard room view)
- `/app/custom/VideoConferenceClientImpl.tsx` (custom room view)

It replaces or works alongside the original `ScreenSharePIP` component.

## Customization

### Window Size
Modify the initial window size in `BrowserWindowPIP.tsx`:

```typescript
const pipWindowInstance = await window.documentPictureInPicture.request({
  width: 500,  // Change width
  height: 400, // Change height
  disallowReturnToOpener: false,
});
```

### Styling
Styles are defined in the component itself (in the `style.textContent` section). You can customize:
- Background colors
- Grid layout
- Participant tile appearance
- Header styling

### Grid Layout
The participant grid automatically adjusts based on the number of participants:

```css
.pip-window-grid {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  grid-auto-rows: minmax(150px, 1fr);
}
```

## Troubleshooting

### PIP Window Doesn't Open

**Possible Causes**:
1. **Browser not supported**: Check if you're using Chrome 116+
2. **Permissions**: Some enterprise/managed browsers may block PIP windows
3. **Multiple windows**: PIP API typically allows only one PIP window at a time

**Check Console**: Look for error messages starting with `[BrowserWindowPIP]`

### Styles Not Appearing in PIP Window

The component attempts to copy all stylesheets to the PIP window. If styles are missing:
1. Check if stylesheets are loaded from external domains (may have CORS issues)
2. Verify that inline styles are being copied correctly
3. Add additional styles in the custom `style.textContent` section

### Window Closes Unexpectedly

The PIP window closes when:
- Screen sharing stops
- User manually closes the window
- Main window closes/navigates away

This is expected behavior and matches Zoom's functionality.

## Comparison with Original ScreenSharePIP

| Feature | ScreenSharePIP (Original) | BrowserWindowPIP (New) |
|---------|---------------------------|------------------------|
| Location | Overlay in main window | Separate always-on-top window |
| During screen share | May be covered by shared content | Always visible above all apps |
| Draggable | Yes | Yes (native window dragging) |
| Resizable | Fixed size | Yes (native window resizing) |
| Zoom-like behavior | No | **Yes** ✅ |
| Browser support | All browsers | Chrome 116+ only |

## Future Enhancements

Potential improvements:
1. **User Preferences**: Remember window size and position
2. **Layout Options**: Toggle between grid, list, or carousel view
3. **Controls**: Add mute/unmute buttons directly in PIP window
4. **Window State**: Allow minimizing/maximizing PIP window
5. **Multi-monitor**: Open PIP on specific monitor

## Related Resources

- [Chrome Document PiP Documentation](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)
- [MDN Web Docs - Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)
- [LiveKit Documentation](https://docs.livekit.io/)

## Notes

- This feature enhances the screen sharing experience by keeping participants visible
- It's designed to work seamlessly with LiveKit's video conferencing infrastructure
- The implementation follows React 18 best practices for portal rendering
- Graceful degradation ensures the app works in unsupported browsers

