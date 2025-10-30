# Connection Quality Tooltip Fix

## Problem
The hover tooltips on connection quality indicators were not working properly. Users couldn't see the detailed stats that explain what makes a connection good or bad.

## Solution
Fixed and enhanced both connection quality tooltip implementations with the following improvements:

### 1. **Increased Z-Index** (9999)
- Changed from z-index: 250/1000 to z-index: 9999
- Ensures tooltips appear above all other UI elements
- Prevents them from being hidden behind video tiles or other components

### 2. **Enhanced Visual Design**
- Darker background (rgba(0, 0, 0, 0.95)) for better contrast
- Larger tooltip size (280px-320px) for better readability
- Improved padding and spacing (14px 18px)
- Better box shadow (0 8px 24px) for depth
- Text wrapping enabled for longer explanations

### 3. **Color-Coded Stats**
Stats are now color-coded to instantly show quality:
- **🟢 Green (#4ade80)**: Good quality
- **🟡 Yellow (#fbbf24)**: Fair quality  
- **🔴 Red (#f87171)**: Poor quality

#### Thresholds:
- **Video Bitrate**: Good >1500 kbps, Fair >500 kbps, Poor <500 kbps
- **Audio Bitrate**: Good >64 kbps, Fair >32 kbps, Poor <32 kbps
- **Packet Loss**: Good <10, Fair <50, Poor >50
- **Jitter**: Good <30ms, Fair <100ms, Poor >100ms

### 4. **Added Explanatory Text**
Tooltips now include helpful information:
```
Good connection: High bitrate (video >1500 kbps, audio >64 kbps), 
                 low packet loss (<10), low jitter (<30ms)
Poor connection: Low bitrate, high packet loss (>50), high jitter (>100ms)
```

### 5. **Improved Detection Logic**
- Added more selector patterns to find LiveKit's connection quality indicators
- Enhanced logging for debugging
- Additional retry attempts (4 total) with logging at 100ms, 500ms, 1000ms, and 2000ms
- Better error handling when indicators can't be found

### 6. **Better Error Messages**
- Shows "Unable to fetch stats" when stats can't be loaded
- Provides debug logging to help identify why indicators might not be found
- Logs available CSS classes when indicator detection fails

## What Stats Mean

### Video/Audio Bitrate
- Measures how much data is being transmitted per second
- Higher bitrate = better quality
- Too low indicates network congestion or poor connection

### Packet Loss
- Number of data packets that didn't arrive
- Higher packet loss = choppy video/audio
- Values >50 indicate serious connection issues

### Jitter
- Variation in packet arrival time
- Measured in milliseconds (ms)
- High jitter causes stuttering and lag
- Values >100ms indicate unstable connection

## Files Modified

1. **lib/ConnectionQualityTooltip.tsx**
   - Enhanced tooltip styling and z-index
   - Added color-coded stats
   - Improved selector logic
   - Added explanatory text

2. **lib/ConnectionQualityIndicator.tsx**
   - Enhanced standalone indicator component
   - Added color-coded stats
   - Improved tooltip styling and z-index
   - Added explanatory text

## Testing

To test the fix:

1. Start your development server
2. Join a video conference room
3. Hover over the connection quality indicator (signal bars icon) on any participant tile
4. You should see:
   - A dark tooltip appearing above the indicator
   - Color-coded stats (green/yellow/red)
   - Video/audio bitrate
   - Packet loss counts
   - Jitter measurements (if available)
   - Explanation of what makes a connection good or bad
   - Last updated timestamp

## Debugging

If tooltips still don't appear:

1. Open browser DevTools console
2. Look for logs starting with `[ConnectionQualityTooltip]`
3. Check if participant tiles are being found
4. Check if connection quality indicators are being detected
5. Review the "Available classes" log to see what elements exist in the tiles

The console will show:
```
[ConnectionQualityTooltip] Starting indicator detection
[ConnectionQualityTooltip] Found X participant tiles
[ConnectionQualityTooltip] Found indicator for participant_identity
OR
[ConnectionQualityTooltip] No indicator found for participant_identity Available classes: [...]
```

## Technical Details

### How It Works

1. **ConnectionQualityTooltip** (used in PageClientImpl.tsx):
   - Uses DOM mutation observer to detect participant tiles
   - Finds LiveKit's native connection quality indicators
   - Wraps them with custom tooltip functionality
   - Fetches real-time stats from LiveKit's RTC APIs

2. **ConnectionQualityIndicator** (used by ConnectionQualityEnhancer):
   - Standalone React component
   - Can be used to replace LiveKit's indicators entirely
   - Uses LiveKit's `useConnectionQualityIndicator` hook
   - Fetches stats directly from participant tracks

### Stats Source

Stats are fetched from:
1. **LiveKit Track API**: `track.currentBitrate` for bitrate
2. **WebRTC Stats API**: `RTCRtpReceiver.getStats()` for packet loss and jitter
3. **LiveKit Connection Quality**: Overall quality assessment (Excellent/Good/Poor)

### Browser Compatibility

The tooltip system works with all modern browsers that support:
- WebRTC
- MutationObserver
- ES6+ JavaScript
- CSS transforms and positioning


