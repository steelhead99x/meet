# Blur Quality Tiers - Implementation Guide

## Overview

The blur effect now uses a **tiered approach** for optimal balance between quality and reliability:

- **LOW & MEDIUM** → LiveKit default processor (reliable, fast)
- **HIGH & ULTRA** → MediaPipe Image Segmenter (enhanced quality, better person detection)

## Quality Tier Comparison

| Quality | Processor | Blur | Hardware | Person Detection | Best For |
|---------|-----------|------|----------|------------------|----------|
| **Low** | LiveKit Default | 15px | CPU | Basic | Mobile, weak devices |
| **Medium** | LiveKit Default | 45px | GPU | Basic | Most laptops/tablets |
| **High** | MediaPipe Enhanced | 90px | GPU | Advanced ✨ | Good desktops |
| **Ultra** | MediaPipe Enhanced | 150px | GPU | Advanced ✨ | High-end systems |

## Key Differences

### LiveKit Default (Low/Medium)
✅ **Pros:**
- Extremely reliable
- Fast initialization
- Low memory usage
- Works on all devices
- No external dependencies

❌ **Cons:**
- Basic segmentation
- May include non-person objects in foreground
- Less accurate edge detection

### MediaPipe Enhanced (High/Ultra)
✅ **Pros:**
- **Multi-class segmentation** (hair, face, body, clothes separately)
- **Enhanced person detection** with confidence thresholding
- **Morphological filtering** to remove noise
- **Connected component analysis** to isolate main person
- **Temporal smoothing** to reduce flicker
- Better edge detection, especially for hair

❌ **Cons:**
- ~3MB model download on first use
- Slightly higher initialization time (2-3 seconds)
- More GPU/CPU intensive
- Requires modern browser with WebGL

## Enhanced Person Detection Features

When using HIGH or ULTRA quality, you get:

### 1. **Confidence Thresholding**
- **High**: 0.7 threshold (removes 30% of uncertain detections)
- **Ultra**: 0.75 threshold (removes 25% of uncertain detections)
- Reduces false positives from background objects

### 2. **Morphological Operations**
- **High**: 5x5 kernel
- **Ultra**: 7x7 kernel
- Removes small noise and smooths mask edges

### 3. **Connected Component Analysis**
- Identifies separate regions in the mask
- Keeps only the largest component (main person)
- Filters out small background artifacts

### 4. **Temporal Smoothing**
- Blends current frame with previous frames
- Reduces mask flickering
- Creates smoother transitions

## Testing the Enhanced Quality

### 1. Start the app and join a room

### 2. Try LOW quality first (baseline)
```
Console output:
[CameraSettings] Using LiveKit BackgroundProcessor (blur)
[CameraSettings] Blur radius: 15px
```

### 3. Switch to HIGH quality (MediaPipe Enhanced)
```
Console output:
[CameraSettings] Using MediaPipe Image Segmenter (Enhanced Quality)
[MediaPipe] 🔄 Starting initialization...
[MediaPipe] Loading @mediapipe/tasks-vision module...
[MediaPipe] ✅ Module loaded successfully
[MediaPipe] Loading WASM runtime from CDN...
[MediaPipe] ✅ WASM runtime loaded
[MediaPipe] Creating segmenter with multiclass model...
[MediaPipe] ✅✅✅ Initialized successfully
[BlurConfig] ✅ Enhanced person detection ACTIVE with settings:
  confidenceThreshold: 0.7
  morphologyEnabled: true
  keepLargestComponent: true
[MediaPipeImageSegmenter] ✅ First frame processed successfully in XXms
```

### 4. Watch for performance metrics
```
Every 30 frames (1 second):
[MediaPipeImageSegmenter] Frame 30: 15.3ms
[MediaPipeImageSegmenter] Frame 60: 14.8ms
```

Good performance: **10-20ms per frame**
Acceptable: **20-30ms per frame**
Struggling: **30ms+ per frame** (consider switching to Medium)

## Visual Quality Differences

### What to Look For:

**LOW/MEDIUM (Default):**
- Background is blurred ✓
- You stay in focus ✓
- May occasionally blur edges of your hair
- Background objects might stay in focus if similar to person

**HIGH/ULTRA (Enhanced):**
- Background is MORE blurred ✓✓
- **Better hair edge detection** ✓✓
- **Removes background artifacts** (plants, furniture, etc.)
- **Smoother edges** with less flickering
- **More accurate person isolation**

### Specific Test Scenarios:

1. **Complex Background** (plants, posters, decorations)
   - Medium: May keep some objects in focus
   - High: Should blur everything except you

2. **Hair Detection** (especially curly/frizzy hair)
   - Medium: Hair edges might be blurred
   - High: Better hair boundary detection

3. **Movement**
   - Medium: Mask may flicker slightly
   - High: Temporal smoothing reduces flicker

4. **Edge Cases** (arms extended, sitting/standing)
   - Medium: Basic edge detection
   - High: Better tracking of body boundaries

## Fallback Mechanism

If MediaPipe fails to load (network issues, browser compatibility, etc.), the system automatically falls back to LiveKit default:

```
Console output:
[CameraSettings] ❌ MediaPipe processor creation failed
[CameraSettings] ⚠️  Using LiveKit default processor instead
[CameraSettings] ✅ Fallback processor created
```

**You still get blur**, just with the basic processor instead of enhanced.

## Performance Optimization

### If HIGH/ULTRA is Too Slow:

Check frame processing time in console:
```
[MediaPipeImageSegmenter] Frame 30: 45.2ms  ← Too slow!
```

**Solutions:**
1. Switch to MEDIUM quality (reliable default)
2. Close other browser tabs
3. Check GPU acceleration is enabled in browser
4. Use a different browser (Chrome/Edge perform best)

### Recommended Hardware:

**HIGH Quality:**
- GPU: Intel UHD 630+ or equivalent
- RAM: 8GB+
- CPU: 4+ cores

**ULTRA Quality:**
- GPU: Dedicated graphics (GTX 1060+ / RX 580+)
- RAM: 16GB+
- CPU: 6+ cores

## Browser Compatibility

### Full Support (MediaPipe works):
- ✅ Chrome 94+
- ✅ Edge 94+
- ✅ Opera 80+

### Partial Support (fallback to default):
- ⚠️  Firefox 117+ (may work, test first)
- ⚠️  Safari 15.4+ (WebGL support varies)

### Not Supported:
- ❌ Internet Explorer (use Edge instead)
- ❌ Safari < 15.4

## Troubleshooting

### MediaPipe not loading:

**Check console for:**
```
[MediaPipe] ❌ Failed to initialize MediaPipe
```

**Common causes:**
1. **Network issues** - Model can't download
   - Solution: Check internet connection
   - Fallback: System uses default processor

2. **WebGL not available**
   - Check: Open `chrome://gpu` and look for WebGL errors
   - Solution: Update graphics drivers

3. **Browser not supported**
   - Solution: Try Chrome/Edge

### Poor performance:

**Check:**
```
[MediaPipeImageSegmenter] Frame 30: 50ms+  ← Too slow
```

**Solutions:**
1. Switch to MEDIUM quality
2. Close other tabs/apps
3. Check CPU usage (should be < 70%)
4. Enable hardware acceleration in browser settings

### Fallback working but want enhanced:

If you see fallback messages but want MediaPipe:
1. Clear browser cache
2. Disable ad blockers (may block CDN)
3. Check browser console for specific errors
4. Try incognito/private mode

## Summary

🎯 **The Goal:** Give users the best blur experience based on their hardware

📊 **The Approach:**
- Start everyone on reliable defaults (LOW/MEDIUM)
- Offer enhanced quality (HIGH/ULTRA) for capable devices
- Automatic fallback if enhanced fails

✅ **The Result:**
- **Everyone** gets working blur
- **Power users** get enhanced quality
- **No one** gets a black screen or broken experience

---

## Quick Reference

**Want basic blur that works everywhere?**
→ Use LOW or MEDIUM

**Want best quality and have good hardware?**
→ Use HIGH or ULTRA

**Not sure?**
→ Start with MEDIUM, upgrade to HIGH if it runs smoothly

**Having issues?**
→ Check console for detailed logs and error messages
