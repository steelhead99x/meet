# Button Fixes - Quick Reference

## Immediate Fixes Needed

### 1. MicrophoneSettings.tsx - Button Text Overflow

**Current (Line 45-52):**
```tsx
<button
  className="lk-button"
  onClick={() => setNoiseFilterEnabled(!isNoiseFilterEnabled)}
  disabled={isNoiseFilterPending}
  aria-pressed={isNoiseFilterEnabled}
>
  {isNoiseFilterEnabled ? 'Disable' : 'Enable'} Enhanced Noise Cancellation
</button>
```

**Fix:**
```tsx
<button
  className="lk-button"
  onClick={() => setNoiseFilterEnabled(!isNoiseFilterEnabled)}
  disabled={isNoiseFilterPending}
  aria-pressed={isNoiseFilterEnabled}
  style={{ 
    maxWidth: '220px',
    whiteSpace: 'normal',
    textAlign: 'center',
    lineHeight: '1.3',
    height: 'auto',
    minHeight: '44px'
  }}
>
  {isNoiseFilterEnabled ? 'Disable' : 'Enable'} Noise Cancellation
</button>
```

---

### 2. CameraSettings.tsx - Background Button Sizing

**Current "None" Button (Line 292-302):**
```tsx
<button
  onClick={() => selectBackground('none')}
  className="lk-button"
  aria-pressed={backgroundType === 'none'}
  style={{
    border: backgroundType === 'none' ? '2px solid #0090ff' : '1px solid #d1d1d1',
    minWidth: '80px',
  }}
>
  None
</button>
```

**Fix:**
```tsx
<button
  onClick={() => selectBackground('none')}
  className="lk-button"
  aria-pressed={backgroundType === 'none'}
  style={{
    border: backgroundType === 'none' ? '2px solid #0090ff' : '2px solid #d1d1d1',
    width: '80px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
  None
</button>
```

**Current "Blur" Button (Line 304-341):**
```tsx
<button
  onClick={() => selectBackground('blur')}
  className="lk-button"
  aria-pressed={backgroundType === 'blur'}
  style={{
    border: backgroundType === 'blur' ? '2px solid #0090ff' : '1px solid #d1d1d1',
    minWidth: '80px',
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
    height: '60px',
  }}
>
  <div style={{...blur effect divs...}} />
  <span style={{...}} >Blur</span>
</button>
```

**Fix:**
```tsx
<button
  onClick={() => selectBackground('blur')}
  className="lk-button"
  aria-label="Blur background effect"
  aria-pressed={backgroundType === 'blur'}
  style={{
    border: backgroundType === 'blur' ? '2px solid #0090ff' : '2px solid #d1d1d1',
    width: '80px',
    height: '60px',
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
  }}
>
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#e0e0e0',
      filter: 'blur(8px)',
      zIndex: 0,
    }}
  />
  <span
    style={{
      position: 'relative',
      zIndex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      color: 'white',
    }}
  >
    Blur
  </span>
</button>
```

**All Gradient/Image Buttons (Line 343+):**
```tsx
// Change all from:
border: isSelected ? '2px solid #0090ff' : '1px solid #d1d1d1'

// To:
border: isSelected ? '2px solid #0090ff' : '2px solid transparent'
```

---

### 3. SettingsMenu.tsx - Recording Button

**Current (Line 137-139):**
```tsx
<button disabled={processingRecRequest} onClick={() => toggleRoomRecording()}>
  {isRecording ? 'Stop' : 'Start'} Recording
</button>
```

**Fix:**
```tsx
<button 
  className="lk-button"
  disabled={processingRecRequest} 
  onClick={() => toggleRoomRecording()}
  style={{
    background: isRecording ? '#dc2626' : '#3b82f6',
    border: 'none',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '10px',
    fontWeight: 600,
    cursor: processingRecRequest ? 'not-allowed' : 'pointer',
    opacity: processingRecRequest ? 0.6 : 1,
  }}
>
  {isRecording ? 'Stop' : 'Start'} Recording
</button>
```

---

### 4. Home.module.css - Start Button Padding

**Current (Line 77-78):**
```css
.startButton {
  font-size: 1.25rem;
  padding: 1rem 3rem !important;
  /* ... */
}
```

**Fix:**
```css
.startButton {
  font-size: 1.125rem; /* 18px instead of 20px */
  padding: 14px 32px !important; /* Align with 8px grid */
  /* ... */
}
```

---

## CSS Variables to Add

**Add to `styles/modern-theme.css` at the top:**

```css
:root {
  /* Button Heights */
  --btn-height-sm: 32px;
  --btn-height-md: 44px;
  --btn-height-lg: 52px;
  
  /* Button Padding */
  --btn-padding-sm: 8px 12px;
  --btn-padding-md: 12px 20px;
  --btn-padding-lg: 16px 32px;
  
  /* Typography */
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  
  /* Spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  
  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-full: 50%;
}
```

---

## New Button Classes to Add

**Add to `styles/modern-theme.css` after line 38:**

```css
/* Button Size Variants */
[data-lk-theme] .lk-button-sm {
  padding: var(--btn-padding-sm);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
  min-height: var(--btn-height-sm);
}

[data-lk-theme] .lk-button-md {
  padding: var(--btn-padding-md);
  font-size: var(--font-size-base);
  border-radius: var(--radius-lg);
  min-height: var(--btn-height-md);
}

[data-lk-theme] .lk-button-lg {
  padding: var(--btn-padding-lg);
  font-size: var(--font-size-lg);
  border-radius: var(--radius-xl);
  min-height: var(--btn-height-lg);
}

/* Prevent text overflow */
[data-lk-theme] .lk-button {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Allow wrapping for specific buttons */
[data-lk-theme] .lk-button-wrap {
  white-space: normal;
  text-align: center;
  line-height: 1.3;
  height: auto;
}

/* Visual/Icon buttons with fixed aspect ratio */
[data-lk-theme] .lk-button-visual {
  width: 80px;
  height: 60px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
```

---

## Responsive Updates Needed

**Add to `styles/modern-theme.css` in mobile section:**

```css
@media (max-width: 640px) {
  /* Add new breakpoint for large phones */
  [data-lk-theme] .lk-button-visual {
    width: 70px;
    height: 52px;
  }
  
  [data-lk-theme] .lk-button {
    font-size: var(--font-size-sm);
  }
}

@media (max-width: 480px) {
  [data-lk-theme] .lk-button-visual {
    width: 60px;
    height: 45px;
  }
  
  [data-lk-theme] .lk-button-visual span {
    font-size: 10px !important;
  }
}
```

---

## Testing Commands

After making changes:

```bash
# Test on different screen sizes
# Open developer tools and test at:
# - 320px (small phone)
# - 375px (iPhone SE)
# - 390px (iPhone 12)
# - 768px (iPad)
# - 1024px (iPad landscape)
# - 1280px (small laptop)
```

**Check These Specific Areas:**
1. Settings Menu → Camera → Background Effects grid
2. Settings Menu → Microphone → Noise cancellation button
3. Settings Menu → Recording → Start/Stop button
4. Home page → Start Meeting button
5. Control bar → All buttons at various widths

---

## Priority Order

1. **Fix MicrophoneSettings button** (5 min) - Most visible issue
2. **Fix CameraSettings borders** (10 min) - Prevents layout shift
3. **Fix SettingsMenu recording button** (5 min) - Missing styling
4. **Add CSS variables** (10 min) - Foundation for consistency
5. **Update Home button padding** (2 min) - Quick alignment
6. **Add responsive breakpoints** (10 min) - Mobile support

**Total Time: ~42 minutes for critical fixes**

