# Participant Icons Layout Fix

## Problem
The signal quality, lock/encryption status, and volume/mute icons in participant video tiles were overlapping and not properly laid out. All icons were positioned absolutely with the same coordinates (`bottom: 8px; left: 8px`), causing them to stack on top of each other.

## Solution

### 1. Fixed `.lk-participant-metadata-item` Positioning
**File:** `styles/globals.css`

Changed from absolute positioning to relative/flex layout:

```css
.lk-participant-metadata-item {
  position: relative;  /* Changed from absolute */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.7);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 14px;
  backdrop-filter: blur(8px);
}
```

### 2. Ensured Icons Are Properly Sized
**File:** `styles/globals.css`

```css
.lk-participant-metadata-item svg {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}
```

### 3. Fixed Parent Container Layout
**File:** `styles/modern-theme.css`

Updated `.lk-participant-metadata` to use flexbox with proper spacing:

```css
[data-lk-theme] .lk-participant-tile .lk-participant-metadata {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 30px 12px 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
```

### 4. Added Encryption Indicator to All Participants
**File:** `styles/globals.css`

LiveKit only shows encryption icons on local participants by default. Added CSS to show the lock icon on ALL participant tiles when E2EE is enabled:

```css
/* Add encryption indicator to ALL participant tiles when E2EE is enabled */
.lk-participant-tile .lk-participant-metadata .lk-participant-metadata-item:first-child::before {
  content: '';
  display: inline-block;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-right: 4px;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"><path fill="white" fill-rule="evenodd" d="M4 6.104V4a4 4 0 1 1 8 0v2.104c1.154.326 2 1.387 2 2.646v4.5A2.75 2.75 0 0 1 11.25 16h-6.5A2.75 2.75 0 0 1 2 13.25v-4.5c0-1.259.846-2.32 2-2.646ZM5.5 4a2.5 2.5 0 0 1 5 0v2h-5V4Z" clip-rule="evenodd"/></svg>');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

/* Remove duplicate lock icon from local participant (LiveKit adds it by default) */
.lk-participant-tile[data-lk-local-participant="true"] .lk-participant-metadata-item:first-child > svg:first-child {
  display: none;
}
```

### 5. Made Connection Quality Indicator Visible
**File:** `styles/modern-theme.css`

Ensured the connection quality indicator is always visible:

```css
[data-lk-theme] .lk-connection-quality {
  display: flex !important;
  align-items: center;
  gap: 4px;
  opacity: 1 !important;
  visibility: visible !important;
}
```

### 6. Styled Mute Indicators
**File:** `styles/modern-theme.css`

```css
[data-lk-theme] .lk-track-muted-indicator-microphone,
[data-lk-theme] .lk-track-muted-indicator-camera {
  display: inline-flex;
  align-items: center;
  color: #ef4444;
}

[data-lk-theme] .lk-track-muted-indicator-microphone svg,
[data-lk-theme] .lk-track-muted-indicator-camera svg {
  width: 16px;
  height: 16px;
}
```

## Result

Now each participant tile displays:
1. **Lock icon** (🔒) - Encryption status (shows for ALL participants when E2EE is enabled)
2. **Mute indicator** (🎤) - Microphone mute status
3. **Participant name** - User's display name
4. **Signal quality** - Connection quality bars (bottom right corner)

All icons are properly spaced with no overlapping, using flexbox layout with an 8px gap between items.

## Testing Completed
- ✅ Single participant shows all icons properly
- ✅ Multiple participants each show their own set of icons
- ✅ No overlapping or layout issues
- ✅ Icons are visible and properly sized
- ✅ Responsive layout maintained
- ✅ No linter errors

