# Chat Toggle Fix - LiveKit v2

## Problem
The chat toggle button was not working properly. The keyboard shortcut (Cmd/Ctrl+Shift+C) and potentially the UI button were not toggling the chat panel.

## Root Cause
The `KeyboardShortcuts.tsx` component was not using the proper LiveKit v2 API for toggling chat. It was missing the `useChatToggle` hook which is the recommended way to control chat visibility in LiveKit Components React v2.

## Solution

### Updated `lib/KeyboardShortcuts.tsx`

**BEFORE:**
```tsx
import React from 'react';
import { Track } from 'livekit-client';
import { useTrackToggle } from '@livekit/components-react';

export function KeyboardShortcuts() {
  const { toggle: toggleMic } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCamera } = useTrackToggle({ source: Track.Source.Camera });

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      // Toggle microphone: Cmd/Ctrl-A
      if (toggleMic && event.key === 'A' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleMic();
      }

      // Toggle camera: Cmd/Ctrl-V
      if (event.key === 'V' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleCamera();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleMic, toggleCamera]);

  return null;
}
```

**AFTER:**
```tsx
import React from 'react';
import { Track } from 'livekit-client';
import { useTrackToggle, useChatToggle } from '@livekit/components-react';

export function KeyboardShortcuts() {
  const { toggle: toggleMic } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCamera } = useTrackToggle({ source: Track.Source.Camera });
  const chatToggle = useChatToggle({ props: {} });

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      // Toggle microphone: Cmd/Ctrl-A
      if (toggleMic && event.key === 'A' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleMic();
      }

      // Toggle camera: Cmd/Ctrl-V
      if (event.key === 'V' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggleCamera();
      }

      // Toggle chat: Cmd/Ctrl-Shift-C
      if (event.key === 'C' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        chatToggle.mergedProps.onClick?.();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleMic, toggleCamera, chatToggle]);

  return null;
}
```

## Key Changes

1. **Added `useChatToggle` hook import** from `@livekit/components-react`
2. **Initialized the hook** with required props: `const chatToggle = useChatToggle({ props: {} });`
3. **Added keyboard shortcut handler** for Cmd/Ctrl+Shift+C that calls `chatToggle.mergedProps.onClick?.()`
4. **Added `chatToggle` to the effect dependencies** to ensure proper cleanup and updates

## How useChatToggle Works

The `useChatToggle` hook:
- Returns an object with `mergedProps` that contains all the necessary props for a chat toggle button
- Depends on the `LayoutContext` which is provided by the `VideoConference` component
- Manages the state of the chat panel (`open`/`closed`)
- Provides the `onClick` handler that properly toggles the chat state

### Return Value Structure
```typescript
{
  mergedProps: {
    className: string;
    onClick: () => void;
    'aria-pressed': string;
    'data-lk-unread-msgs': string;
  }
}
```

## Testing

To test the fix:

1. **Start the development server** (if not already running)
2. **Join a room** on `http://localhost:3001/rooms/[roomName]`
3. **Test the keyboard shortcut**: Press `Cmd+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux)
   - Chat panel should slide in from the right
   - Press the shortcut again to close it
4. **Test the UI button**: Click the chat button in the control bar
   - Should have the same toggle behavior
5. **Verify persistence**: The chat state should persist as you interact with it

## Related Files

- ✅ `lib/KeyboardShortcuts.tsx` - Updated with `useChatToggle` hook
- ✅ `styles/modern-theme.css` - Chat button styles already present (blue theme)
- ✅ `app/rooms/[roomName]/PageClientImpl.tsx` - Uses `KeyboardShortcuts` component
- ✅ `app/custom/VideoConferenceClientImpl.tsx` - Uses `KeyboardShortcuts` component

## Reference Documentation

- [useChatToggle Hook](https://docs.livekit.io/reference/components/react/hook/usechattoggle/)
- [Chat Component](https://docs.livekit.io/reference/components/react/component/chat/)
- [Text Streams (Chat Data)](https://docs.livekit.io/home/client/data/text-streams/)

## Notes

- The chat toggle button is automatically rendered by the `VideoConference` component
- No additional UI components need to be added
- The `LayoutContext` is automatically provided by `VideoConference`
- Chat messages use the E2EE encoders/decoders when encryption is enabled

