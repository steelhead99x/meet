# Screen Share Picture-in-Picture (PIP) Mode

## Overview

When a user starts screen sharing, a floating Picture-in-Picture overlay automatically appears showing all participant video feeds. This allows the presenter to see everyone's reactions and video while presenting their screen in the main view.

## Features

### Automatic Activation
- PIP overlay automatically appears when the local participant starts screen sharing
- PIP overlay automatically disappears when screen sharing stops
- No manual intervention required

### PIP Overlay Specifications
- **Default Size**: 480px wide (up to 854px max for 480p)
- **Aspect Ratio**: 16:9 (content area maintains aspect ratio)
- **Position**: Starts at top-left (20px, 20px), fully draggable
- **Behavior**: Always-on-top floating overlay within the browser
- **Draggable**: Click and drag the header to reposition anywhere
- **Stays in Bounds**: Automatically constrained to viewport

### Overlay Design
The PIP overlay includes:

1. **Drag Handle**:
   - Blue header bar with "PARTICIPANTS" label
   - Drag icon (⋮⋮) indicating it's movable
   - Grab cursor when hovering

2. **Video Grid**:
   - Responsive grid layout (1-3 columns based on participant count)
   - 16:9 aspect ratio for each participant tile
   - Compact participant names and metadata
   - Smooth scrolling if many participants

3. **Visual Polish**:
   - Semi-transparent dark background with backdrop blur
   - Blue glowing border
   - Smooth shadow that intensifies on hover
   - Fade-in animation on appearance

## Technical Implementation

### Components

#### `ScreenSharePIP.tsx`
Core functionality:
- Monitors local participant's screen sharing status using `useLocalParticipant()` and `useTracks()`
- Filters camera tracks (excluding screen shares) for the PIP display
- Implements drag-and-drop functionality for repositioning
- Automatically shows/hides overlay based on screen share state
- Renders participant tiles using LiveKit's `ParticipantTile` component

Key features:
```typescript
// Detect local screen sharing by filtering useTracks result
const screenShareTracks = React.useMemo(() => {
  return allTracks.filter(track => 
    track.source === Track.Source.ScreenShare &&
    track.participant?.identity === localParticipant?.identity
  );
}, [allTracks, localParticipant?.identity]);

const isLocalScreenSharing = screenShareTracks.length > 0;

// Track filtering - show only camera feeds
const cameraTracks = allTracks.filter(track => track.source === Track.Source.Camera);

// Drag functionality with boundary detection
const [position, setPosition] = useState({ x: 20, y: 20 });
const [isDragging, setIsDragging] = useState(false);

// Keeps PIP within viewport bounds
const maxX = window.innerWidth - pipRef.current?.offsetWidth;
const maxY = window.innerHeight - pipRef.current?.offsetHeight;
```

#### `ScreenSharePIP.css`
- Floating overlay with `position: fixed` and high `z-index: 10000`
- Responsive grid that adapts to participant count (1-3 columns)
- CSS `:has()` selector for dynamic grid layouts
- Compact participant metadata with smaller fonts (10px)
- Custom scrollbar styling for overflow
- Backdrop blur and shadows for visual depth

### Integration Points

The `ScreenSharePIP` component is integrated into:
- `/app/rooms/[roomName]/PageClientImpl.tsx` (main room page)
- `/app/custom/VideoConferenceClientImpl.tsx` (custom implementation)

Both files include the component within the `RoomContext.Provider` to ensure it has access to room state and track information.

### Layout Behavior

When screen sharing is active:
1. **Main View**: Shows the screen share in the primary layout (LiveKit's focus layout handles this automatically)
2. **PIP Overlay**: Floats on top showing all camera feeds from participants
3. **Concurrent Display**: Both the screen share and participant videos are visible simultaneously

## Usage

### For Users

1. **Start Screen Sharing**:
   - Click the screen share button in the control bar
   - Or use keyboard shortcut: Cmd/Ctrl + S
   - A floating PIP overlay automatically appears in the top-left corner

2. **View Participants While Presenting**:
   - The PIP overlay shows all participants with cameras enabled
   - Participant names and status are visible
   - Grid layout adjusts automatically based on participant count

3. **Reposition the PIP Overlay**:
   - Click and hold the blue header bar
   - Drag to any position on screen
   - Release to drop in place
   - PIP stays within viewport bounds automatically

4. **Stop Screen Sharing**:
   - Click the screen share button again
   - Or use keyboard shortcut: Cmd/Ctrl + S
   - The PIP overlay automatically disappears

### For Developers

To customize the PIP behavior:

1. **Adjust Default Size**:
   Edit `styles/ScreenSharePIP.css`:
   ```css
   .screenshare-pip-container {
     width: 480px;      /* Default width */
     max-width: 854px;  /* Max width (480p at 16:9) */
     min-width: 320px;  /* Minimum width */
   }
   ```

2. **Modify Initial Position**:
   Edit `lib/ScreenSharePIP.tsx`:
   ```typescript
   const [position, setPosition] = useState({ x: 20, y: 20 });
   ```

3. **Customize Grid Layout**:
   Edit `styles/ScreenSharePIP.css` grid rules:
   ```css
   .pip-grid:has(.pip-participant:nth-child(5)),
   .pip-grid:has(.pip-participant:nth-child(6)) {
     grid-template-columns: repeat(3, 1fr);
   }
   ```

4. **Change Visual Styling**:
   - Border colors, shadows, backdrop blur in `.screenshare-pip-container`
   - Participant tile sizing in `.pip-participant`
   - Font sizes and metadata display in `.pip-participant .lk-participant-name`

## Limitations

1. **CSS :has() Support**: Requires modern browsers (Chrome 105+, Safari 15.4+, Firefox 121+)
2. **Participant Count**: Grid optimized for 1-9 participants; more will scroll vertically
3. **Touch Devices**: Drag functionality uses mouse events; touch support can be added
4. **Screen Share Source**: Only shows camera feeds in PIP, not other screen shares

## Future Enhancements

Potential improvements:
- **Resizable PIP**: Add corner/edge handles to resize the overlay
- **Minimize/Expand**: Collapse to a small icon when not needed
- **Touch Support**: Add touch event handlers for mobile/tablet dragging
- **User Preferences**: Remember size and position across sessions
- **Keyboard Shortcuts**: Toggle PIP visibility independently of screen share
- **Multiple Layouts**: Switch between grid, row, or stack layouts
- **Floating Chat**: Option to include chat messages in the PIP overlay

