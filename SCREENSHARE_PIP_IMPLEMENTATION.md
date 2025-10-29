# Screen Share Picture-in-Picture (PIP) Mode

## Overview

When a user starts screen sharing, the browser automatically enters a Picture-in-Picture (PIP) mode to allow the presenter to continue seeing all participants while sharing their screen.

## Features

### Automatic Activation
- PIP mode is automatically enabled when the local participant starts screen sharing
- PIP mode is automatically disabled when screen sharing stops
- No manual intervention required

### Window Specifications
- **Size**: 854x480 pixels (480p resolution)
- **Aspect Ratio**: 16:9
- **Position**: Bottom-right corner of the screen with padding
- **Behavior**: Attempts to set always-on-top (environment dependent)

### UI Optimizations in PIP Mode
When PIP mode is active, the interface adapts to maximize space for participant videos:

1. **Hidden Elements**:
   - Chat panel and toggle button
   - Settings menu
   - Screen share preview (no need to see your own screen share)
   - Non-essential UI controls

2. **Compact Controls**:
   - Smaller control buttons (44px vs 52px)
   - Reduced padding and gaps
   - Compact video grid layout

3. **Visual Indicators**:
   - "PIP MODE - Screen Sharing Active" badge at the top
   - Blue border around the window
   - Smaller but still readable participant names

## Technical Implementation

### Components

#### `ScreenSharePIP.tsx`
- Monitors local participant's screen sharing status
- Uses LiveKit's `useLocalParticipant()` and `useTracks()` hooks
- Automatically triggers window resize and repositioning
- Adds/removes `pip-mode` class to body element

#### `ScreenSharePIP.css`
- Defines all PIP mode styling
- Uses `body.pip-mode` selector for scoped styles
- Handles compact layout and element visibility

### Integration Points

The `ScreenSharePIP` component is integrated into:
- `/app/rooms/[roomName]/PageClientImpl.tsx` (main room page)
- `/app/custom/VideoConferenceClientImpl.tsx` (custom implementation)

Both files include the component within the `RoomContext.Provider` to ensure it has access to room state.

### Browser API Usage

The implementation attempts to use the following window APIs:
```typescript
window.resizeTo(width, height)  // Resize window
window.moveTo(left, top)        // Position window
```

**Note**: These APIs have limited support in modern browsers for security reasons:
- Works in: Electron apps, some PWAs with window management API
- Limited in: Standard browser tabs (requires user gesture or specific permissions)
- Alternative: Users can manually resize and position the window

For enhanced functionality in Electron apps, the component checks for:
```typescript
window.electronAPI?.setAlwaysOnTop(true)
```

## Usage

### For Users

1. **Start Screen Sharing**:
   - Click the screen share button in the control bar
   - Or use keyboard shortcut: Cmd/Ctrl + S
   - The window will automatically resize and reposition

2. **Continue Seeing Participants**:
   - The compact PIP window shows all participants
   - You can see reactions, connection quality, and video feeds
   - The control bar remains accessible

3. **Stop Screen Sharing**:
   - Click the screen share button again
   - Or use keyboard shortcut: Cmd/Ctrl + S
   - The window automatically restores to normal size

### For Developers

To customize the PIP behavior:

1. **Adjust Window Size**:
   Edit `lib/ScreenSharePIP.tsx`:
   ```typescript
   const pipWidth = 854;   // Change width
   const pipHeight = 480;  // Change height
   ```

2. **Modify Positioning**:
   Edit `lib/ScreenSharePIP.tsx`:
   ```typescript
   const padding = 20;  // Distance from screen edges
   ```

3. **Customize UI Elements**:
   Edit `styles/ScreenSharePIP.css` to show/hide different elements or adjust sizing

## Limitations

1. **Browser Restrictions**: Window manipulation APIs may not work in all environments
2. **Manual Fallback**: Users may need to manually resize/position in some browsers
3. **Styling Only**: In restricted environments, only the CSS styling applies (still provides compact view)
4. **Single Screen**: Optimized for single-screen presentations (multi-monitor setups may require manual adjustment)

## Future Enhancements

Potential improvements:
- Draggable window handle for manual repositioning
- User preference for PIP window size and position
- Keyboard shortcuts to toggle PIP mode independently
- Support for multiple screen shares (show other participants' shares in thumbnail)
- Integration with browser Picture-in-Picture API for video elements

