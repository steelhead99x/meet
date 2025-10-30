# Advanced Segmentation Settings - UI Guide

## Visual Layout

```
┌──────────────────────────────────────────────────────────────┐
│                     SETTINGS MENU                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Media Devices  │  Recording  │                      │   │
│  │    (active)                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    CAMERA                             │   │
│  │  ┌─────────────────────────────────────────────┐     │   │
│  │  │        [Video Preview Window]                │     │   │
│  │  │        (Shows live camera feed)              │     │   │
│  │  └─────────────────────────────────────────────┘     │   │
│  │                                                        │   │
│  │  Camera Toggle    [▼]                                │   │
│  │                                                        │   │
│  │  Background Effects  [?]                              │   │
│  │  ┌────┬────┬────┬────┬────┬────┬────┬────┐          │   │
│  │  │None│Blur│Grad│Grad│Grad│Img │Img │ +  │          │   │
│  │  └────┴────┴────┴────┴────┴────┴────┴────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          BACKGROUND BLUR QUALITY                      │   │
│  │                                                        │   │
│  │  📊 Device Info                                        │   │
│  │     CPU: 8 cores  |  Memory: 16 GB                   │   │
│  │     GPU: ✓ Available  |  Power Level: HIGH           │   │
│  │                                                        │   │
│  │  ┌────────┬────────┬────────┬────────┐              │   │
│  │  │  Low   │ Medium │  High  │ Ultra  │              │   │
│  │  │  [  ]  │  [✓]   │  [  ]  │  [  ]  │              │   │
│  │  └────────┴────────┴────────┴────────┘              │   │
│  │                                                        │   │
│  │  💡 Pro Tip                                           │   │
│  │  Higher quality = stronger blur + smoother edges     │   │
│  │  Your device: MEDIUM power                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      ADVANCED SEGMENTATION SETTINGS    ← NEW!        │   │
│  │                                                        │   │
│  │  Custom Segmentation                         [☑ ON]  │   │
│  │  Fine-tune blur settings for your lighting           │   │
│  │                                                        │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ 🎚️ Blur Strength                          50  │   │   │
│  │  │ ●════════════════════○══════════                │   │   │
│  │  │ Light (10)                        Strong (100)  │   │   │
│  │  │ ℹ️ Higher values = stronger background blur    │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                        │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ 🎚️ Edge Quality (Feather)               30%  │   │   │
│  │  │ ●══════════○═══════════════════════            │   │   │
│  │  │ Sharp (0%)                         Soft (100%) │   │   │
│  │  │ ℹ️ Increase if you see jagged edges           │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                        │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ Edge Refinement                         [☑]   │   │   │
│  │  │ Advanced edge smoothing post-processing       │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                        │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ Temporal Smoothing                      [☑]   │   │   │
│  │  │ Reduces flickering between frames             │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                        │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │ GPU Acceleration                        [☑]   │   │   │
│  │  │ Use GPU for better performance                │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                        │   │
│  │  [ Reset to Medium Preset ]                          │   │
│  │                                                        │   │
│  │  💡 Optimization Tips                                │   │
│  │  • Increase Edge Quality for jagged outlines        │   │
│  │  • Enable Temporal Smoothing to reduce flickering   │   │
│  │  • Lower Blur Strength for performance              │   │
│  │  • Good lighting helps segmentation accuracy        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   MICROPHONE                          │   │
│  │  ...                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│                                                      [Close] │
└──────────────────────────────────────────────────────────────┘
```

## UI Element Details

### 1. Custom Segmentation Toggle
```
┌─────────────────────────────────────────────────┐
│ Custom Segmentation                      [☑]   │
│ Fine-tune blur settings for your lighting      │
└─────────────────────────────────────────────────┘
```
- **Location**: Top of Advanced Segmentation Settings section
- **Type**: Checkbox toggle
- **States**: 
  - ☐ OFF: Advanced controls hidden
  - ☑ ON: Advanced controls visible
- **Default**: OFF

### 2. Blur Strength Slider
```
🎚️ Blur Strength                              50
●════════════════════○══════════════════════════
Light (10)                          Strong (100)
ℹ️ Higher values = stronger background blur
```
- **Range**: 10 to 100
- **Step**: 5
- **Default**: Based on current preset (35 for Medium)
- **Visual**: Blue accent color for active thumb
- **Updates**: Real-time as you drag

### 3. Edge Quality Slider
```
🎚️ Edge Quality (Feather)                    30%
●══════════○═══════════════════════════════════
Sharp (0%)                          Soft (100%)
ℹ️ Increase if you see jagged edges
```
- **Range**: 0% to 100%
- **Step**: 5%
- **Default**: Based on current preset (20% for Medium)
- **Visual**: Blue accent color for active thumb
- **Updates**: Real-time as you drag

### 4. Advanced Toggle Options
```
┌─────────────────────────────────────────────────┐
│ Edge Refinement                          [☑]   │
│ Advanced edge smoothing post-processing        │
└─────────────────────────────────────────────────┘
```
- **Style**: Card-like with subtle background
- **Layout**: Label on left, checkbox on right
- **States**: Checked/Unchecked
- **Hover**: Slight highlight on hover

### 5. Reset Button
```
┌─────────────────────────────────────────────────┐
│         Reset to Medium Preset                  │
└─────────────────────────────────────────────────┘
```
- **Style**: Full-width button
- **Function**: Resets all values to current quality preset
- **Visual**: Subtle border, transparent background
- **Hover**: Slight opacity change

### 6. Optimization Tips Panel
```
┌─────────────────────────────────────────────────┐
│ 💡 Optimization Tips                           │
│ • Increase Edge Quality for jagged outlines    │
│ • Enable Temporal Smoothing for flickering     │
│ • Lower Blur Strength for performance          │
│ • Disable GPU if you see visual glitches       │
│ • Good lighting helps segmentation             │
└─────────────────────────────────────────────────┘
```
- **Color**: Green accent with subtle background
- **Border**: 1px green border
- **Content**: Bulleted list of tips
- **Icon**: 💡 light bulb for visibility

## Color Scheme

### Primary Colors
- **Blue Accent**: `#3b82f6` (Primary actions, active states)
- **Blue Light**: `#60a5fa` (Value displays, highlights)
- **Green Accent**: `#10b981` (Tips panel, success states)

### Background Colors
- **Tip Panel**: `rgba(59, 130, 246, 0.1)` (Blue tint)
- **Optimization Panel**: `rgba(16, 185, 129, 0.1)` (Green tint)
- **Toggle Cards**: `rgba(255, 255, 255, 0.03)` (Subtle gray)
- **Section Background**: `rgba(255, 255, 255, 0.05)` (Light gray)

### Text Colors
- **Primary**: White
- **Secondary**: `rgba(255, 255, 255, 0.7)` (70% opacity)
- **Tertiary**: `rgba(255, 255, 255, 0.6)` (60% opacity)

## Responsive Behavior

### Desktop (> 600px)
```
┌─────────────────────────────────────┐
│  Full width sliders                 │
│  All controls visible               │
│  Two-column layout for toggles      │
└─────────────────────────────────────┘
```

### Tablet (400px - 600px)
```
┌──────────────────────────┐
│  Slightly narrower       │
│  Single column toggles   │
│  Full functionality      │
└──────────────────────────┘
```

### Mobile (< 400px)
```
┌────────────────┐
│  Compact view  │
│  Stacked layout│
│  Touch-friendly│
└────────────────┘
```

## Interaction States

### Slider Thumb
- **Idle**: Gray circle, subtle shadow
- **Hover**: Blue tint, slightly larger
- **Active/Dragging**: Bright blue, pronounced shadow
- **Focus**: Blue outline for keyboard navigation

### Checkbox Toggles
- **Unchecked**: Empty square with border
- **Checked**: Checkmark inside, blue background
- **Hover**: Slight scale increase
- **Focus**: Blue outline

### Reset Button
- **Idle**: Transparent with border
- **Hover**: Subtle background tint
- **Active**: Slightly darker background
- **Disabled**: Grayed out, cursor not-allowed

## Animation & Transitions

### Slider Movement
- **Transition**: Smooth CSS transition on value change
- **Duration**: 100ms
- **Easing**: ease-out

### Toggle Expand/Collapse
- **When Enabling**: Smooth height expansion
- **When Disabling**: Smooth height collapse
- **Duration**: 200ms
- **Easing**: ease-in-out

### Value Display Updates
- **Update**: Instant (no delay)
- **Animation**: Number transitions smoothly
- **Color**: Brief blue flash on change

## Accessibility Features

### Keyboard Navigation
- **Tab Order**: Logical top-to-bottom flow
- **Focus Indicators**: Clear blue outlines
- **Shortcuts**: Standard keyboard controls for sliders

### Screen Readers
- **Labels**: Descriptive ARIA labels
- **Values**: Announced on change
- **States**: Toggle states clearly announced

### Touch Targets
- **Minimum Size**: 44x44px for all interactive elements
- **Spacing**: Adequate spacing between controls
- **Feedback**: Visual feedback on tap/touch

## Usage Flow

### First-Time User
1. Opens Settings Menu
2. Sees "Advanced Segmentation Settings" section
3. Reads "Custom Segmentation" description
4. Enables toggle to reveal controls
5. Adjusts sliders, sees immediate feedback
6. Reads optimization tips for guidance
7. Fine-tunes settings based on their environment

### Returning User
1. Opens Settings Menu
2. Custom Segmentation already enabled (if previously set)
3. Sliders show saved values
4. Makes minor adjustments as needed
5. Settings automatically saved

### Power User
1. Quickly navigates to Advanced Segmentation
2. Uses keyboard shortcuts to adjust sliders
3. Rapidly tests different configurations
4. Resets to preset when needed
5. Shares custom values with others (future feature)

## Common Patterns

### Adjusting for Poor Lighting
1. Enable Custom Segmentation
2. Increase Blur Strength → 70-80
3. Increase Edge Quality → 50-60%
4. Enable Edge Refinement
5. Enable Temporal Smoothing
6. Observe improvements in real-time

### Optimizing for Performance
1. Enable Custom Segmentation
2. Reduce Blur Strength → 30-40
3. Reduce Edge Quality → 20-25%
4. Disable Edge Refinement
5. Keep GPU Acceleration ON
6. Monitor performance improvement

### Achieving Maximum Quality
1. Enable Custom Segmentation
2. Increase Blur Strength → 85-95
3. Increase Edge Quality → 70-85%
4. Enable all toggles
5. Ensure good lighting
6. Enjoy pristine segmentation

## Error States

### Invalid Configuration
- **Scenario**: User enters invalid values (shouldn't happen with sliders)
- **Handling**: Clamp to valid range, show brief notification

### Processing Error
- **Scenario**: MediaPipe fails to initialize
- **Handling**: Graceful fallback, show error message, disable custom controls

### Storage Error
- **Scenario**: localStorage unavailable
- **Handling**: Settings work but won't persist, show warning

## Print/Screenshot Friendly

The UI is designed to look good in screenshots and documentation:
- Clear labels and values
- Obvious visual hierarchy
- Self-explanatory controls
- Helpful inline documentation

---

**UI Version**: 1.0
**Last Updated**: October 30, 2025
**Design Language**: Modern, Clean, Accessible




