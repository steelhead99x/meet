# Screen Share Picture-in-Picture - Quick Guide

## What This Does

When you start screen sharing in Chrome, a **separate always-on-top window** automatically opens showing all meeting participants. This window stays visible above all other applications (including your shared content), exactly like Zoom does.

## Quick Start

### Requirements
- **Chrome, Edge, Brave, or Opera** (version 116+)
- No additional setup needed!

### How to Use

1. **Join a meeting** as normal
2. **Click the screen share button** to start sharing your screen
3. **A PIP window automatically opens** showing all participants
4. **Continue presenting** - the window stays on top of everything
5. **Stop screen sharing** - the window automatically closes

That's it! No configuration needed.

## What You'll See

The PIP window shows:
- ✅ All participant video feeds in a grid
- ✅ Participant count: "Participants (3)"
- ✅ Red badge: "SCREEN SHARING" indicator
- ✅ Clean, modern dark theme

## Window Controls

- **Move**: Click and drag the window anywhere
- **Resize**: Drag from window edges/corners
- **Close**: Window closes automatically when you stop sharing (or close it manually)

## Browser Support

| Browser | Supported | Version |
|---------|-----------|---------|
| Chrome | ✅ Yes | 116+ |
| Edge | ✅ Yes | 116+ |
| Brave | ✅ Yes | 116+ |
| Opera | ✅ Yes | 102+ |
| Firefox | ❌ No | - |
| Safari | ❌ No | - |

**Note**: If you're using an unsupported browser, the feature simply won't activate (screen sharing still works normally).

## Troubleshooting

### The PIP window doesn't open

**Check your browser version**:
1. Click the three dots menu (⋮) in Chrome
2. Go to **Help** → **About Google Chrome**
3. Make sure you're on version 116 or higher

**Try refreshing**:
- Refresh the meeting page and try screen sharing again

### The window is too small/large

**Just resize it!**
- Drag from any corner or edge of the window
- Your preference will be remembered for this session

### I don't see other participants

**Participants need to have their cameras on**:
- If cameras are off, you'll see "No participants with video"
- This is normal - the window shows video feeds only

## Tips

💡 **Position the window where you need it** - It will stay on top even when you're presenting full-screen

💡 **Keep an eye on reactions** - See participant reactions and body language while presenting

💡 **Multi-monitor setup** - Move the PIP window to a secondary monitor for an even better experience

## Technical Details

For developers and technical users who want to understand or customize this feature, see:
- **Full Documentation**: `BROWSER_WINDOW_PIP.md`
- **Component**: `/lib/BrowserWindowPIP.tsx`
- **API Used**: Chrome's Document Picture-in-Picture API

---

**Questions or issues?** Check the full documentation in `BROWSER_WINDOW_PIP.md`

