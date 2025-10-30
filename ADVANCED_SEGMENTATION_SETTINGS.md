# Advanced Segmentation Settings

## Overview

This implementation exposes granular segmentation settings to users through an intuitive slider-based interface, allowing them to fine-tune background blur and segmentation quality based on their local conditions (lighting, device performance, network, etc.).

## Features Added

### 1. Custom Segmentation Settings Interface

Users can now access advanced segmentation controls in the Settings Menu with the following adjustable parameters:

#### **Blur Strength Slider** (10-100)
- **Purpose**: Controls the intensity of background blur
- **Range**: 10 (light blur) to 100 (strong blur)
- **Use Cases**:
  - Low values (10-30): Subtle blur for professional meetings
  - Medium values (30-60): Balanced blur for most scenarios
  - High values (60-100): Maximum privacy/background separation

#### **Edge Quality (Feather) Slider** (0-100%)
- **Purpose**: Controls edge smoothness around the person
- **Range**: 0% (sharp edges) to 100% (soft edges)
- **Use Cases**:
  - Increase if you see jagged or pixelated edges
  - Lower for sharper definition (better lighting conditions)
  - Higher for smoother transitions (challenging lighting)

#### **Edge Refinement Toggle**
- **Purpose**: Enables advanced edge smoothing post-processing
- **Impact**: Improves edge quality but uses more CPU/GPU
- **Recommended**: Enable for best quality on capable devices

#### **Temporal Smoothing Toggle**
- **Purpose**: Reduces flickering between frames
- **Impact**: Stabilizes the segmentation mask over time
- **Recommended**: Enable to reduce jittery edges during movement

#### **GPU Acceleration Toggle**
- **Purpose**: Uses GPU for segmentation processing
- **Impact**: Better performance but may cause issues on some systems
- **Recommended**: Keep enabled unless experiencing visual glitches

### 2. Preset System with Custom Override

Users can:
1. Start with quality presets (Low/Medium/High/Ultra)
2. Enable "Custom Segmentation" to fine-tune
3. Reset to preset values at any time

### 3. Real-Time Application

All changes are applied immediately to the video stream without requiring page refresh or track restart.

### 4. Persistent Settings

Custom segmentation settings are saved to local storage and persist across sessions.

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────┐
│         SettingsMenu.tsx                │
│  (Slider UI + Controls)                 │
│  - Blur Strength Slider                 │
│  - Edge Quality Slider                  │
│  - Toggle Controls                      │
└─────────────┬───────────────────────────┘
              │
              │ window.__setCustomSegmentation()
              ▼
┌─────────────────────────────────────────┐
│       CameraSettings.tsx                │
│  (Applies settings to video track)      │
│  - Detects changes                      │
│  - Creates/caches processors            │
│  - Applies to LocalVideoTrack           │
└─────────────┬───────────────────────────┘
              │
              │ getBlurConfig()
              ▼
┌─────────────────────────────────────────┐
│         BlurConfig.ts                   │
│  (Configuration management)             │
│  - Preset configurations                │
│  - Custom settings override             │
│  - Device capability detection          │
└─────────────┬───────────────────────────┘
              │
              │ BackgroundProcessor()
              ▼
┌─────────────────────────────────────────┐
│     LiveKit Track Processors            │
│  (@livekit/track-processors)            │
│  - MediaPipe segmentation               │
│  - Background blur rendering            │
└─────────────────────────────────────────┘
```

### Key Files Modified

1. **lib/BlurConfig.ts**
   - Added `CustomSegmentationSettings` interface
   - Extended `getBlurConfig()` to accept custom settings
   - Added helper functions for custom settings management

2. **lib/userPreferences.ts**
   - Added `useCustomSegmentation` flag
   - Added `customSegmentation` storage field
   - Persists custom settings to localStorage

3. **lib/CameraSettings.tsx**
   - Tracks custom segmentation state
   - Exposes window functions for settings menu
   - Applies custom settings to video processor
   - Caches processors to avoid recreation

4. **lib/SettingsMenu.tsx**
   - Comprehensive slider UI
   - Real-time setting updates
   - Toggle between preset and custom modes
   - Helpful tips and documentation

5. **lib/CustomPreJoin.tsx**
   - Applies custom settings to preview video
   - Ensures consistency between preview and in-call

6. **lib/types.ts**
   - Added window interface extensions
   - Type definitions for custom settings API

## Usage Guide

### For Users

1. **Access Settings**
   - Click the settings icon during a call
   - Navigate to "Media Devices" tab
   - Scroll down to "Advanced Segmentation Settings"

2. **Enable Custom Mode**
   - Toggle "Custom Segmentation" checkbox
   - Sliders and toggles will appear

3. **Adjust Settings**
   - **Blur Strength**: Drag slider to adjust blur intensity
   - **Edge Quality**: Drag slider to control edge smoothness
   - **Toggles**: Enable/disable advanced features

4. **Optimize for Your Conditions**
   - **Good lighting**: Lower edge quality, higher blur strength
   - **Poor lighting**: Higher edge quality, enable temporal smoothing
   - **Performance issues**: Lower blur strength, disable edge refinement
   - **Visual glitches**: Disable GPU acceleration

5. **Reset if Needed**
   - Click "Reset to [Quality] Preset" button
   - Returns to preset values based on current quality level

### For Developers

#### Accessing Custom Settings

```typescript
// Check if custom segmentation is enabled
const useCustom = window.__getUseCustomSegmentation?.();

// Get current custom settings
const settings = window.__getCustomSegmentation?.();

// Update settings programmatically
window.__setCustomSegmentation?.({
  blurRadius: 50,
  edgeFeather: 0.3,
  temporalSmoothing: true,
  useGPU: true,
  enableEdgeRefinement: true,
});
```

#### Creating Custom Presets

```typescript
import { customSettingsFromPreset } from './lib/BlurConfig';

// Create custom settings based on a preset
const settings = customSettingsFromPreset('high');
// Modify as needed
settings.blurRadius = 70;
```

## Optimization Tips

### For Different Lighting Conditions

| Condition | Blur Strength | Edge Quality | Edge Refinement | Temporal Smoothing |
|-----------|--------------|--------------|-----------------|-------------------|
| **Excellent lighting** | 40-60 | 20-30% | Optional | Optional |
| **Good lighting** | 50-70 | 30-40% | Recommended | Optional |
| **Poor lighting** | 60-80 | 40-60% | Recommended | Recommended |
| **Very poor lighting** | 70-90 | 50-80% | Required | Required |

### For Different Devices

| Device Type | Recommended Settings |
|-------------|---------------------|
| **High-end desktop** | Use presets or custom with all features enabled |
| **Mid-range laptop** | Medium preset or custom with selective features |
| **Low-end device** | Low preset, disable edge refinement |
| **Mobile** | Low preset, CPU delegation |

### Performance Troubleshooting

If experiencing:

1. **High CPU/GPU usage**
   - Lower blur strength
   - Disable edge refinement
   - Reduce edge quality

2. **Jagged edges**
   - Increase edge quality
   - Enable edge refinement
   - Enable temporal smoothing

3. **Flickering/jittery edges**
   - Enable temporal smoothing
   - Increase edge quality slightly

4. **Visual artifacts**
   - Try disabling GPU acceleration
   - Lower blur strength
   - Disable edge refinement

## API Reference

### CustomSegmentationSettings Interface

```typescript
interface CustomSegmentationSettings {
  /** Custom blur radius (10-100) */
  blurRadius: number;
  
  /** Edge feather amount (0-1) - higher = softer edges */
  edgeFeather: number;
  
  /** Enable temporal smoothing to reduce flickering */
  temporalSmoothing: boolean;
  
  /** Use GPU acceleration (recommended) */
  useGPU: boolean;
  
  /** Enable edge refinement post-processing */
  enableEdgeRefinement: boolean;
}
```

### Window API

```typescript
interface Window {
  __setBlurQuality?: (quality: BlurQuality) => void;
  __getBlurQuality?: () => BlurQuality | undefined;
  __setUseCustomSegmentation?: (use: boolean) => void;
  __getUseCustomSegmentation?: () => boolean | undefined;
  __setCustomSegmentation?: (settings: CustomSegmentationSettings) => void;
  __getCustomSegmentation?: () => CustomSegmentationSettings | null | undefined;
}
```

### Helper Functions

```typescript
// Get blur config with optional custom settings
function getBlurConfig(
  quality: BlurQuality,
  customSettings?: CustomSegmentationSettings | null
): BlurConfig;

// Create custom settings from preset
function customSettingsFromPreset(quality: BlurQuality): CustomSegmentationSettings;

// Get default custom settings
function getDefaultCustomSettings(): CustomSegmentationSettings;
```

## Future Enhancements

Potential additions for future versions:

1. **Segmentation Model Selection**
   - Allow users to choose between different MediaPipe models
   - Options for speed vs. quality tradeoffs

2. **Real-time Performance Metrics**
   - Display FPS, CPU/GPU usage
   - Automatic adjustment recommendations

3. **Preset Profiles**
   - Save multiple custom profiles
   - Quick switching between saved configurations

4. **Background Detection Sensitivity**
   - Adjust confidence threshold for person segmentation
   - Fine-tune what's considered "background"

5. **Advanced Edge Controls**
   - Separate controls for hair edge refinement
   - Body edge vs. hair edge different settings

6. **Auto-optimization**
   - Automatically adjust based on detected lighting
   - Performance-based dynamic adjustment

## Testing Recommendations

When testing the segmentation settings:

1. **Different Lighting Scenarios**
   - Front-lit, back-lit, side-lit
   - Natural vs. artificial lighting
   - Strong vs. weak lighting

2. **Different Backgrounds**
   - Simple vs. complex backgrounds
   - Static vs. moving backgrounds
   - Similar colors to clothing vs. contrasting

3. **Movement Tests**
   - Static pose
   - Hand movements
   - Full body movements
   - Turning around

4. **Performance Tests**
   - Monitor CPU/GPU usage
   - Check frame rates
   - Test on different device types

5. **Edge Cases**
   - Wearing hats or glasses
   - Long hair vs. short hair
   - Props or objects near body

## Conclusion

The Advanced Segmentation Settings feature provides users with powerful, fine-grained control over their background blur and segmentation quality. By exposing these settings through an intuitive interface with helpful guidance, users can optimize their video experience for their specific environment and device capabilities.

The implementation maintains excellent performance through processor caching, immediate application of changes, and persistent settings storage across sessions.

