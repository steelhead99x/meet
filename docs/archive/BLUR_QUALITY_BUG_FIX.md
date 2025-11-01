# Blur Quality Settings Bug Fix

## Problem Identified

The blur quality settings (Low → Medium → High → Ultra) show almost no difference in system activity when switched.

## Root Cause

**Only 2 parameters are actually being passed to LiveKit's BackgroundProcessor:**

```typescript
// Current implementation in CameraSettings.tsx
const blurProcessor = BackgroundProcessor({
  blurRadius: config.blurRadius,           // ✅ Applied
  segmenterOptions: {
    delegate: config.segmenterOptions.delegate,  // ✅ Applied
  },
}, 'background-blur');

// All these are IGNORED: ❌
// - config.edgeRefinement
// - config.enhancedPersonDetection
```

## Why There's No Difference in System Activity

| Quality | Blur Radius | Delegate | Notes |
|---------|-------------|----------|-------|
| Low     | 20px        | CPU      | Only uses CPU |
| Medium  | 35px        | **GPU**  | All GPU modes have similar performance |
| High    | 60px        | **GPU**  | Same GPU path, just different blur radius |
| Ultra   | 80px        | **GPU**  | Same GPU path, just different blur radius |

**The issue:** Medium, High, and Ultra all use GPU with similar system load. The blur radius change (35→60→80) affects visual quality but not significantly the processing load. The heavy work (person segmentation) is identical across all GPU modes.

## What Was Intended vs. What Actually Works

### Intended (from our config):
- ✅ Different blur radii (20, 35, 60, 80)
- ✅ CPU vs GPU delegation
- ❌ Edge refinement (featherAmount, temporal smoothing)
- ❌ Enhanced person detection (confidence threshold, morphology, component analysis)

### What Actually Works:
- ✅ Blur radius changes (visual difference only)
- ✅ CPU vs GPU mode (Low uses CPU, others use GPU)

## Why Enhanced Features Don't Work

LiveKit's `@livekit/track-processors` (v0.6.1) `BackgroundProcessor` **only accepts**:
```typescript
{
  blurRadius: number;
  segmenterOptions: {
    delegate: 'GPU' | 'CPU';
  };
}
```

It does **not** support custom:
- Edge refinement settings
- Enhanced person detection algorithms
- Morphological operations
- Confidence thresholding
- Connected component analysis

These would require a **custom processor implementation** that wraps or extends LiveKit's processor.

## Immediate Fix Options

### Option 1: Make Blur Radius Differences More Dramatic
```typescript
low: { blurRadius: 10 }      // Currently 20
medium: { blurRadius: 40 }   // Currently 35
high: { blurRadius: 80 }     // Currently 60
ultra: { blurRadius: 150 }   // Currently 80 → NEW: Much stronger
```

This would create more visible quality differences, though system activity would still be similar for GPU modes.

### Option 2: Add More CPU/GPU Variation
```typescript
low: { delegate: 'CPU', blurRadius: 20 }
medium: { delegate: 'CPU', blurRadius: 40 }  // Force CPU for variety
high: { delegate: 'GPU', blurRadius: 70 }
ultra: { delegate: 'GPU', blurRadius: 120 }
```

### Option 3: Add Console Warnings (Honest Approach)
```typescript
console.log('[BlurConfig] Applied settings:', {
  blurRadius: config.blurRadius,
  delegate: config.segmenterOptions.delegate,
});

if (config.enhancedPersonDetection?.enabled) {
  console.warn('[BlurConfig] Enhanced person detection configured but not supported by LiveKit processor');
}

if (config.edgeRefinement?.enabled) {
  console.warn('[BlurConfig] Edge refinement configured but not supported by LiveKit processor');
}
```

### Option 4: Update Documentation
Clearly state in the UI that:
- Low/Medium/High/Ultra mainly affect **visual blur strength**
- System activity is primarily determined by CPU vs GPU mode
- Advanced features (Enhanced Person Detection, Edge Refinement) are **planned features** requiring custom processor implementation

## Recommended Solution

**Combine all options:**

1. **Increase blur radius spread** for more visible differences
2. **Add console logging** to show what's actually applied
3. **Update UI** to set accurate expectations
4. **Document limitation** that advanced features need future integration

## Implementation

### Step 1: Update Blur Radius Values
Make the differences more dramatic:

```typescript
low: { blurRadius: 15 }      // Lighter blur for performance
medium: { blurRadius: 45 }   // Moderate blur
high: { blurRadius: 90 }     // Strong blur
ultra: { blurRadius: 150 }   // Very strong blur
```

### Step 2: Add Logging in CameraSettings.tsx
```typescript
const blurProcessor = BackgroundProcessor({
  blurRadius: config.blurRadius,
  segmenterOptions: {
    delegate: config.segmenterOptions.delegate,
  },
}, 'background-blur');

// Log what's actually being applied
console.log(`[BlurConfig] Applied ${blurQuality} quality: ${config.blurRadius}px blur, ${config.segmenterOptions.delegate} processing`);

// Warn about unsupported features
if (config.enhancedPersonDetection?.enabled) {
  console.warn('[BlurConfig] Note: Enhanced person detection is configured but requires custom processor integration');
}
```

### Step 3: Update UI in SettingsMenu
Add notice that advanced features are "planned":

```typescript
<div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '8px' }}>
  ⚠️ Advanced features (Enhanced Person Detection, Edge Refinement) are configured but 
  require custom processor integration. Currently, only blur radius and GPU/CPU mode 
  are actively applied.
</div>
```

## Long-Term Solution

To actually implement the advanced features, we would need to:

1. **Create custom processor** that extends LiveKit's BackgroundProcessor
2. **Intercept segmentation mask** before blur is applied
3. **Apply our mask processing algorithms** from `maskProcessor.ts`
4. **Pass processed mask** to blur stage

This requires either:
- Forking `@livekit/track-processors` 
- Creating a completely custom processor using MediaPipe directly
- Requesting LiveKit to add mask post-processing hooks

## User Impact

**Current State:**
- Users see quality options but experience minimal system impact differences (except Low vs others)
- Advanced features appear to work but don't actually affect processing

**After Fix:**
- Users understand that quality mainly affects visual blur strength
- System activity difference is primarily CPU vs GPU
- Advanced features are clearly marked as "configured but not yet integrated"
- Console logs show exactly what's being applied

## Testing After Fix

1. Switch between Low → Medium → High → Ultra
2. Check console logs for applied settings
3. Verify blur radius visually increases
4. Monitor system activity (should see CPU usage for Low, GPU for others)
5. Confirm warning messages appear for advanced features

