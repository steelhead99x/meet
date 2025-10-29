# Quick Reference Guide

## CSS Structure

### Z-Index Hierarchy
```
1-99:      Base content
100-199:   Floating buttons & controls
200-299:   Tooltips & popovers
300-399:   Dropdowns & menus
400-499:   Sidebars & panels
500-599:   Backdrops
600-999:   Modals & overlays
```

### File Organization
```
styles/
  ├── globals.css              # Global styles, animations, z-index docs
  ├── modern-theme.css         # LiveKit component theming
  ├── ChatPanel.module.css     # Chat panel (side/full-screen)
  ├── ChatToggleButton.module.css  # Chat toggle button (bottom-right)
  ├── KeyboardShortcutsHelp.module.css  # Help button (bottom-left)
  ├── Debug.module.css         # Debug overlay
  ├── Home.module.css          # Home page
  ├── SettingsMenu.module.css  # Settings menu
  └── hide-videoconference-chat.css  # Hide built-in LiveKit chat
```

### Shared Animations
All animations are now centralized in `globals.css`:
- `fadeIn` - Fade in effect
- `slideDown` - Slide down with fade
- `slideUp` - Slide up with scale

### Component Positioning
- **Chat Toggle Button**: Bottom-right (z-index: 100)
- **Help Button**: Bottom-left (z-index: 100)
- **Chat Panel**: Right side / Full-screen mobile (z-index: 400)
- **Debug Overlay**: Full-screen (z-index: 700)

## Component Props

### ChatPanel
```typescript
interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messageFormatter?: (message: string) => React.ReactNode;
  messageEncoder?: MessageEncoder;
  messageDecoder?: MessageDecoder;
}
```

### ChatToggleButton
```typescript
interface ChatToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}
```

## Keyboard Shortcuts
- `Cmd/Ctrl + A` - Toggle microphone
- `Cmd/Ctrl + V` - Toggle camera
- `Cmd/Ctrl + Shift + C` - Toggle chat
- `Escape` - Close open panels/modals

## Best Practices

### CSS
✅ **DO:**
- Use CSS modules for component-specific styles
- Use `[data-lk-theme]` selector for LiveKit components
- Define z-index using the documented hierarchy
- Use shared animations from globals.css
- Add vendor prefixes for animations

❌ **DON'T:**
- Use `!important` (modern-theme.css uses proper specificity now)
- Hardcode z-index values without checking the hierarchy
- Create duplicate animations
- Use inline styles when CSS modules work

### TypeScript/React
✅ **DO:**
- Remove console.logs before committing
- Use React.useCallback for event handlers
- Use React.useMemo for expensive computations
- Add proper TypeScript types
- Handle loading and error states

❌ **DON'T:**
- Leave debug statements in production code
- Create unused components
- Recreate components unnecessarily
- Use `any` type

## Common Tasks

### Adding a New Floating Button
1. Check z-index hierarchy (use 100-199)
2. Position it to avoid conflicts with existing buttons
3. Add responsive mobile styles
4. Consider touch targets (min 44x44px)

### Adding a New Modal
1. Use z-index: 600 for overlay
2. Add backdrop with z-index: 500
3. Use shared animations from globals.css
4. Handle Escape key for closing
5. Prevent body scroll when open

### Modifying LiveKit Component Styles
1. Edit `styles/modern-theme.css`
2. Use `[data-lk-theme]` selector for specificity
3. Avoid `!important` - increase specificity instead
4. Test on mobile, tablet, and desktop

### Updating Animations
1. Check if animation exists in globals.css
2. If new, add to globals.css with vendor prefixes
3. Use existing animations when possible
4. Document new animations with comments

## File Changes Summary

### Modified Files
- ✅ `styles/globals.css` - Cleaned, added z-index docs, animations
- ✅ `styles/modern-theme.css` - Complete rewrite, 95% less !important
- ✅ `styles/ChatPanel.module.css` - Vendor prefixes, z-index
- ✅ `styles/ChatToggleButton.module.css` - Z-index update
- ✅ `styles/KeyboardShortcutsHelp.module.css` - Position, z-index
- ✅ `styles/Debug.module.css` - Z-index update
- ✅ `lib/ChatPanel.tsx` - Removed debug logs
- ✅ `lib/ChatToggleButton.tsx` - Removed debug logs
- ✅ `app/rooms/[roomName]/PageClientImpl.tsx` - Removed debug logs

### Deleted Files
- 🗑️ `lib/E2EEStatusIndicator.tsx` (unused)
- 🗑️ `lib/ParticipantE2EEIndicator.tsx` (unused)
- 🗑️ `lib/E2EEStatusIndicator.module.css` (unused)

### Kept Files (Important)
- ⚠️ `styles/hide-videoconference-chat.css` - Still needed to hide built-in LiveKit chat

## Running the Project

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Start production
pnpm start

# Lint
pnpm lint

# Format
pnpm format:write
```

## Environment Variables
```bash
NEXT_PUBLIC_CONN_DETAILS_ENDPOINT=/api/connection-details
NEXT_PUBLIC_SHOW_SETTINGS_MENU=true
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record
```

## Testing Checklist

### Desktop
- [ ] Chat panel opens/closes smoothly
- [ ] Help button doesn't overlap chat toggle
- [ ] All animations work properly
- [ ] Settings menu functional
- [ ] Video controls work

### Tablet
- [ ] Responsive layouts work
- [ ] Touch targets are large enough
- [ ] Chat panel is appropriately sized
- [ ] Buttons are accessible

### Mobile
- [ ] Chat goes full-screen
- [ ] Buttons are positioned correctly
- [ ] Keyboard shortcuts work (if applicable)
- [ ] Text labels hide appropriately
- [ ] Safe areas respected (notched devices)

## Troubleshooting

### Issue: Overlapping UI Elements
**Solution:** Check z-index values against the hierarchy in globals.css

### Issue: Animations Not Working
**Solution:** Ensure vendor prefixes are present and globals.css is imported

### Issue: Chat Panel Not Showing
**Solution:** Check ChatPanel isOpen prop and z-index values

### Issue: Styles Not Applying to LiveKit Components
**Solution:** Use `[data-lk-theme]` selector with higher specificity

## Quick Links
- [Code Review Fixes](./CODE_REVIEW_FIXES.md)
- [Further Improvements](./FURTHER_IMPROVEMENTS.md)
- [LiveKit Docs](https://docs.livekit.io/)
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev/)

---

**Last Updated:** October 29, 2025  
**Maintained by:** Development Team

