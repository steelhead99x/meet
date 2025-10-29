# Connection Quality Tooltip Implementation

## Overview

This implementation adds an enhanced hover tooltip to the connection quality signal bars displayed on participant video tiles in the video conference. When users hover over the signal indicator, they see detailed live statistics that determine the connection quality level.

## Features

- **Hover Tooltip**: Shows detailed connection statistics when hovering over the signal bar (🟢🟡🟠🔴)
- **Live Statistics**: Displays real-time data including:
  - Video bitrate (kbps)
  - Audio bitrate (kbps)
  - Video packet loss
  - Audio packet loss
  - Video jitter (ms)
  - Audio jitter (ms)
  - Last update timestamp
- **60-Second Refresh**: Statistics automatically refresh every 60 seconds while the tooltip is visible
- **Visual Feedback**: High packet loss values (>10 packets) are highlighted in red

## Implementation Details

### 1. ConnectionQualityIndicator Component (`lib/ConnectionQualityIndicator.tsx`)

This component displays the connection quality icon and manages the tooltip with live statistics.

**Key Features:**
- Uses LiveKit's `useConnectionQualityIndicator` hook to get the quality level
- Fetches detailed statistics from participant tracks and WebRTC stats
- Shows tooltip on hover with formatted statistics
- Auto-refreshes data every 60 seconds when tooltip is visible
- Displays quality levels: Excellent (🟢), Good (🟡), Poor (🟠), Connection Issues (🔴)

**Statistics Sources:**
- **Bitrate**: Retrieved from `track.currentBitrate` for each track
- **Packet Loss & Jitter**: Retrieved from WebRTC's `RTCStats` API via `track.receiver.getStats()`

### 2. ConnectionQualityEnhancer Component (`lib/ConnectionQualityEnhancer.tsx`)

This component automatically enhances all connection quality indicators in the VideoConference component.

**How It Works:**
1. Uses a `MutationObserver` to watch for new participant tiles being added to the DOM
2. Finds all existing connection quality indicators using the `.lk-connection-quality` class
3. Replaces LiveKit's default indicators with our custom `ConnectionQualityIndicator` component
4. Maintains React roots for each enhanced indicator for proper cleanup
5. Automatically re-enhances when participants join or leave

**Integration Points:**
- Added to both `/app/rooms/[roomName]/PageClientImpl.tsx` and `/app/custom/VideoConferenceClientImpl.tsx`
- Placed within the `RoomContext.Provider` to access room and participant data
- Runs as a side-effect component (renders nothing itself)

### 3. CSS Enhancements (`styles/globals.css`)

Added styles to ensure tooltips display properly:
- Set `overflow: visible` on participant tiles and metadata containers
- Added z-index layering to ensure tooltips appear above other elements
- Positioned connection quality indicators with relative positioning for tooltip anchoring

## User Experience

1. **Default View**: Users see the standard colored signal indicator (🟢🟡🟠🔴) on each participant's video tile
2. **Hover Interaction**: When hovering over the indicator, a dark tooltip appears above it showing detailed statistics
3. **Live Updates**: While hovering, statistics refresh every 60 seconds automatically
4. **Visual Clarity**: 
   - Tooltip has a clean, modern design with semi-transparent black background
   - Statistics are organized in a grid layout for easy reading
   - High packet loss is highlighted in red for quick identification
   - Timestamp shows when statistics were last updated

## Technical Notes

### Performance Considerations
- Statistics are only fetched when the tooltip is visible (on hover)
- Refresh interval is 60 seconds to balance freshness with performance
- React roots are properly cleaned up when components unmount
- MutationObserver is optimized to only watch for relevant DOM changes

### Browser Compatibility
- Uses standard WebRTC APIs available in all modern browsers
- RTCStats fallback: If WebRTC stats are unavailable, component gracefully handles the absence
- ReactDOM.createRoot is used for concurrent mode compatibility

### Limitations
- Some statistics (jitter, packet loss) may not be available for all track types or in all browsers
- Statistics reflect the most recent data from WebRTC; there may be a slight delay
- Local participant's own connection quality may have limited stats depending on the browser

## Testing

To test the implementation:

1. Start the development server: `npm run dev` or `pnpm dev`
2. Join a video conference room with at least 2 participants
3. Hover over the signal indicator (🟢🟡🟠🔴) on any participant's video tile
4. Verify that the tooltip appears showing detailed statistics
5. Wait 60 seconds while hovering to verify auto-refresh
6. Test with different network conditions to see quality levels change

## Future Enhancements

Potential improvements:
- Add historical graphs showing connection quality over time
- Display bandwidth and resolution information
- Add controls to manually adjust video quality based on stats
- Show network latency/round-trip time (RTT)
- Add export functionality to save statistics logs

