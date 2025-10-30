# Video Quality - Quick Reference

## What Was Changed?

### ✅ Increased Video Bitrates
- **Standard mode**: 1.5 Mbps → **2 Mbps** (+33%)
- **HQ mode**: 1.5 Mbps → **3 Mbps** (+100%)

### ✅ Enhanced Resolution Settings
- **Standard**: Explicit 1280x720 @ 30fps
- **HQ**: Explicit 1920x1080 @ 30fps

### ✅ Better Simulcast Layers
- **Standard**: h720, h360, h180 (was h540, h216)
- **HQ**: h1080, h720, h360 (was h1080, h720)

### ✅ HDR-Like Video Filters
```css
brightness(1.08) contrast(1.12) saturate(1.15)
```
- +8% brighter for better visibility
- +12% more contrast for depth
- +15% more saturated for vibrant tones

### ✅ Image Rendering Optimization
- Crisp edges on standard displays
- Auto-optimization on retina/HiDPI displays

## Testing Checklist

- [ ] Start a video call with 2+ participants
- [ ] Check video clarity and sharpness
- [ ] Verify skin tones look natural and vibrant
- [ ] Test in different lighting (bright/dim)
- [ ] Monitor CPU usage (should be similar)
- [ ] Check network bandwidth (will be higher)
- [ ] Test on mobile devices
- [ ] Verify low-bandwidth fallback works

## Quick Adjustments

### Make videos even brighter:
```css
/* In styles/globals.css */
filter: brightness(1.12) contrast(1.12) saturate(1.15);
```

### Make videos more vibrant:
```css
filter: brightness(1.08) contrast(1.15) saturate(1.20);
```

### Subtle, natural look:
```css
filter: brightness(1.05) contrast(1.08) saturate(1.10);
```

### Increase bitrate further:
```typescript
// In PageClientImpl.tsx
maxBitrate: 2_500_000, // 2.5 Mbps
```

## URL Parameters

Test different quality modes:
- Standard: `http://localhost:3000/rooms/myroom`
- High Quality: `http://localhost:3000/rooms/myroom?hq=true`

## Expected Results

✓ Noticeably clearer video quality  
✓ Better facial detail and texture  
✓ More vibrant, natural skin tones  
✓ Improved visibility in dim lighting  
✓ Professional, broadcast-like appearance  
✓ Minimal performance impact  

## Bandwidth Impact

| Mode | Before | After | Users Affected |
|------|--------|-------|----------------|
| Standard | ~1.5 Mbps | ~2 Mbps | All users |
| HQ | ~1.5 Mbps | ~3 Mbps | Users with ?hq=true |

Most modern connections can easily handle these increases.

## Rollback Instructions

If needed, revert these files:
1. `app/rooms/[roomName]/PageClientImpl.tsx`
2. `app/custom/VideoConferenceClientImpl.tsx`
3. `styles/globals.css`

See git history for previous versions.


