# Segmentation Settings Testing Guide

## Quick Test Checklist

### ✅ Basic Functionality

1. **Access Advanced Settings**
   - [ ] Open Settings Menu
   - [ ] Navigate to "Advanced Segmentation Settings" section
   - [ ] Verify section appears below "Background Blur Quality"

2. **Enable Custom Segmentation**
   - [ ] Toggle "Custom Segmentation" checkbox
   - [ ] Verify sliders and controls appear
   - [ ] Check that default values are shown

3. **Blur Strength Slider**
   - [ ] Drag slider from minimum (10) to maximum (100)
   - [ ] Verify blur changes in real-time on video preview
   - [ ] Check value display updates correctly
   - [ ] Confirm blur increases as value increases

4. **Edge Quality Slider**
   - [ ] Drag slider from 0% to 100%
   - [ ] Verify edge smoothness changes
   - [ ] At 0%: Edges should be sharper
   - [ ] At 100%: Edges should be softer/feathered

5. **Toggle Controls**
   - [ ] Toggle Edge Refinement on/off
   - [ ] Toggle Temporal Smoothing on/off
   - [ ] Toggle GPU Acceleration on/off
   - [ ] Verify video updates after each toggle

6. **Reset Functionality**
   - [ ] Make several custom adjustments
   - [ ] Click "Reset to [Quality] Preset" button
   - [ ] Verify settings return to preset values

### ✅ Persistence Testing

1. **Settings Persistence**
   - [ ] Enable custom segmentation
   - [ ] Adjust sliders to specific values
   - [ ] Refresh the page
   - [ ] Verify custom settings are preserved
   - [ ] Check "Custom Segmentation" is still enabled

2. **Cross-Session Persistence**
   - [ ] Set custom values
   - [ ] Close browser completely
   - [ ] Reopen and join meeting
   - [ ] Verify custom settings persist

### ✅ Integration Testing

1. **Preset Interaction**
   - [ ] Enable custom segmentation
   - [ ] Change blur quality preset (Low/Medium/High/Ultra)
   - [ ] Verify custom mode stays enabled
   - [ ] Click reset and verify it uses new preset values

2. **Background Type Changes**
   - [ ] Set custom segmentation values
   - [ ] Switch to "None" background
   - [ ] Switch back to "Blur"
   - [ ] Verify custom settings are still applied

3. **Pre-Join Preview**
   - [ ] Set custom segmentation values in Settings
   - [ ] Leave and rejoin meeting
   - [ ] Verify pre-join preview uses custom settings

### ✅ Visual Quality Testing

Test these scenarios with custom settings:

1. **Well-Lit Environment**
   - Settings to try:
     - Blur Strength: 40-50
     - Edge Quality: 25-35%
     - Edge Refinement: Off
     - Temporal Smoothing: Off
   - Expected result: Clean, sharp segmentation

2. **Poor Lighting**
   - Settings to try:
     - Blur Strength: 70-80
     - Edge Quality: 50-70%
     - Edge Refinement: On
     - Temporal Smoothing: On
   - Expected result: Smoother edges, less flickering

3. **Complex Background**
   - Settings to try:
     - Blur Strength: 80-90
     - Edge Quality: 40-60%
     - Edge Refinement: On
   - Expected result: Strong background separation

4. **Movement Test**
   - Settings to try:
     - Temporal Smoothing: On
     - Edge Quality: 50%+
   - Actions:
     - Wave hands
     - Turn head
     - Stand up/sit down
   - Expected result: Stable edges, minimal flickering

### ✅ Performance Testing

1. **Low-End Device**
   - [ ] Set blur strength to 90+
   - [ ] Enable all toggles
   - [ ] Monitor for frame drops or lag
   - [ ] Try disabling GPU acceleration if issues occur

2. **High-End Device**
   - [ ] Set blur strength to maximum
   - [ ] Enable all features
   - [ ] Verify smooth performance

3. **CPU Usage**
   - [ ] Enable custom segmentation
   - [ ] Set high blur strength
   - [ ] Monitor system CPU/GPU usage
   - [ ] Adjust settings to optimize

### ✅ Edge Cases

1. **Extreme Values**
   - [ ] Set blur strength to minimum (10)
   - [ ] Set blur strength to maximum (100)
   - [ ] Set edge quality to 0%
   - [ ] Set edge quality to 100%
   - [ ] Verify no crashes or visual artifacts

2. **Rapid Changes**
   - [ ] Rapidly drag sliders back and forth
   - [ ] Toggle switches on/off repeatedly
   - [ ] Verify smooth updates without lag

3. **Multiple Toggles**
   - [ ] Test all combinations of toggle states
   - [ ] Verify each combination works properly

### ✅ Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (if applicable)

### ✅ UI/UX Testing

1. **Slider Usability**
   - [ ] Sliders are easy to drag
   - [ ] Value displays are clear and readable
   - [ ] Labels are descriptive
   - [ ] Range indicators (min/max) are helpful

2. **Visual Feedback**
   - [ ] Changes apply immediately
   - [ ] No jarring transitions
   - [ ] Smooth video updates

3. **Help Text**
   - [ ] Descriptions are clear and helpful
   - [ ] Tips panel provides useful guidance
   - [ ] Pro tips are relevant and actionable

## Common Issues and Solutions

### Issue: Jagged Edges

**Symptoms**: Person's outline appears pixelated or stair-stepped

**Solution**:
1. Increase Edge Quality to 40-60%
2. Enable Edge Refinement
3. Enable Temporal Smoothing

**Test**: Wave hands and check edge smoothness

---

### Issue: Flickering

**Symptoms**: Edge mask jumps or flickers between frames

**Solution**:
1. Enable Temporal Smoothing
2. Increase Edge Quality slightly
3. Improve lighting if possible

**Test**: Stay still and observe edge stability

---

### Issue: Performance Lag

**Symptoms**: Video stutters, low frame rate, high CPU

**Solution**:
1. Reduce Blur Strength to 30-50
2. Disable Edge Refinement
3. Lower Edge Quality to 20-30%
4. Keep GPU Acceleration ON

**Test**: Monitor frame rate and system resources

---

### Issue: GPU Artifacts

**Symptoms**: Visual glitches, strange colors, distortions

**Solution**:
1. Disable GPU Acceleration
2. Try CPU delegation instead
3. Restart browser

**Test**: Check for visual consistency

---

### Issue: Settings Not Persisting

**Symptoms**: Custom settings reset after page reload

**Solution**:
1. Check browser localStorage is not blocked
2. Verify no browser extensions interfering
3. Try incognito/private mode to test

**Test**: Reload page and check settings

---

## Quick Test Scenarios

### Scenario 1: Professional Meeting (5 min)
```
Goal: Test moderate settings for typical use case
Settings:
- Blur Strength: 50
- Edge Quality: 30%
- Edge Refinement: ON
- Temporal Smoothing: ON
- GPU Acceleration: ON

Test Actions:
1. Join meeting
2. Sit normally, talk, make hand gestures
3. Check edge quality and blur strength
4. Verify no performance issues
```

### Scenario 2: Poor Lighting (5 min)
```
Goal: Test aggressive settings for challenging conditions
Settings:
- Blur Strength: 80
- Edge Quality: 60%
- Edge Refinement: ON
- Temporal Smoothing: ON
- GPU Acceleration: ON

Test Actions:
1. Dim your room lighting
2. Join meeting
3. Move around, check edge stability
4. Verify flickering is minimized
```

### Scenario 3: Performance Optimization (5 min)
```
Goal: Test lightweight settings for older devices
Settings:
- Blur Strength: 30
- Edge Quality: 20%
- Edge Refinement: OFF
- Temporal Smoothing: OFF
- GPU Acceleration: ON

Test Actions:
1. Join meeting on older/slower device
2. Monitor CPU/GPU usage
3. Check frame rate stays smooth
4. Verify acceptable blur quality
```

### Scenario 4: Maximum Quality (5 min)
```
Goal: Test highest quality settings
Settings:
- Blur Strength: 100
- Edge Quality: 80%
- Edge Refinement: ON
- Temporal Smoothing: ON
- GPU Acceleration: ON

Test Actions:
1. Use high-end device
2. Ensure excellent lighting
3. Check edge smoothness is pristine
4. Verify strong background separation
```

## Automated Testing Notes

For developers adding automated tests:

```typescript
// Test helper functions
describe('Advanced Segmentation Settings', () => {
  test('should enable custom segmentation', () => {
    // Toggle custom segmentation
    // Verify UI updates
    // Check settings are saved
  });

  test('should adjust blur strength', () => {
    // Set blur strength to various values
    // Verify processor receives correct config
    // Check visual output changes
  });

  test('should persist custom settings', () => {
    // Set custom values
    // Reload page
    // Verify settings restored
  });

  test('should reset to preset values', () => {
    // Enable custom mode
    // Adjust settings
    // Click reset
    // Verify preset values restored
  });
});
```

## Sign-Off Checklist

Before marking feature as complete:

- [ ] All basic functionality tests pass
- [ ] Settings persist correctly
- [ ] Performance is acceptable on target devices
- [ ] UI is intuitive and responsive
- [ ] Documentation is complete
- [ ] Edge cases handled gracefully
- [ ] Browser compatibility verified
- [ ] No console errors or warnings
- [ ] Accessibility considerations met
- [ ] Code review completed

## Feedback Collection

When testing with users, collect feedback on:

1. **Ease of Use**
   - Is the UI intuitive?
   - Are the controls easy to use?
   - Is the help text helpful?

2. **Value**
   - Does custom segmentation improve their experience?
   - Which settings do they adjust most?
   - What additional controls would they want?

3. **Performance**
   - Any lag or stuttering?
   - Does it work well on their device?
   - Are the default values appropriate?

## Reporting Issues

When reporting bugs, include:

1. Device specifications (CPU, GPU, RAM)
2. Browser version
3. Custom settings values used
4. Steps to reproduce
5. Screenshots or screen recording
6. Console error messages (if any)
7. Lighting conditions during test

---

**Last Updated**: October 30, 2025
**Feature Version**: 1.0
**Test Coverage**: Comprehensive

