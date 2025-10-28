# Design System - Artist-Space Meet

## 🎨 Color Palette

### Primary Colors
```css
/* Primary Action (Join, Send, Share) */
--primary-start: #3b82f6;  /* Blue 500 */
--primary-end: #1d4ed8;    /* Blue 700 */

/* Danger (Leave, Error, Muted) */
--danger-start: #dc2626;   /* Red 600 */
--danger-end: #991b1b;     /* Red 800 */

/* Warning (Reconnecting) */
--warning: #f59e0b;        /* Amber 500 */
--warning-dark: #d97706;   /* Amber 600 */

/* Success (Speaking, Connected) */
--success: #22c55e;        /* Green 500 */
```

### Neutral Colors
```css
/* Backgrounds */
--bg-dark: #070707;                    /* Base background */
--bg-glass: rgba(255, 255, 255, 0.12); /* Glassmorphism */
--bg-elevated: rgba(255, 255, 255, 0.15);
--bg-overlay: rgba(0, 0, 0, 0.85);     /* Modals */

/* Borders */
--border-subtle: rgba(255, 255, 255, 0.08);
--border-normal: rgba(255, 255, 255, 0.15);
--border-strong: rgba(255, 255, 255, 0.25);

/* Text */
--text-primary: rgba(255, 255, 255, 1);
--text-secondary: rgba(255, 255, 255, 0.8);
--text-tertiary: rgba(255, 255, 255, 0.6);
```

---

## 📐 Spacing Scale

```css
/* Consistent spacing throughout the app */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 20px;
--space-2xl: 24px;
--space-3xl: 32px;
--space-4xl: 40px;
```

### Usage Examples:
- **Gap between buttons:** 12px (md)
- **Padding in cards:** 16-24px (lg-2xl)
- **Control bar padding:** 20-24px (xl-2xl)
- **Section margins:** 16-20px (lg-xl)

---

## 🔲 Border Radius

```css
/* Rounded corners for different elements */
--radius-sm: 8px;      /* Small elements, badges */
--radius-md: 12px;     /* Buttons, inputs */
--radius-lg: 16px;     /* Cards, tiles */
--radius-xl: 20px;     /* Panels, modals */
--radius-2xl: 24px;    /* Hero sections */
--radius-full: 50%;    /* Circular buttons */
```

### Usage Guide:
| Element | Radius |
|---------|--------|
| Text buttons | 12px |
| Icon buttons (mic/cam) | 50% (circle) |
| Video tiles | 16px |
| Settings panel | 20px |
| Pre-join screen | 24px |
| Chat messages | 12px |
| Input fields | 10-12px |

---

## 🎭 Shadows

### Layer System
```css
/* Subtle - Resting state */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);

/* Medium - Default elevation */
--shadow-md: 0 8px 32px rgba(0, 0, 0, 0.4);

/* Large - Hover state */
--shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.5);

/* Extra Large - Modal overlays */
--shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.6);
```

### Colored Shadows (Accent Buttons)
```css
/* Primary action shadow */
box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);

/* Danger action shadow */
box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
```

---

## ✨ Glassmorphism

### Standard Glass Effect
```css
.glass-effect {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

### Dark Glass Effect (Modals)
```css
.glass-dark {
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Hover State
```css
.glass-effect:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}
```

---

## 🎬 Animation System

### Timing Functions
```css
/* Smooth, natural motion */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);

/* Quick snap */
--ease-snap: cubic-bezier(0.4, 0, 1, 1);

/* Bounce effect */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Durations
```css
--duration-fast: 150ms;    /* Quick feedback */
--duration-normal: 300ms;  /* Standard */
--duration-slow: 500ms;    /* Dramatic */
```

### Standard Transitions
```css
/* For most interactive elements */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* For hover effects */
transition: transform 0.3s ease, box-shadow 0.3s ease;

/* For focus effects */
transition: border-color 0.2s ease, box-shadow 0.2s ease;
```

---

## 🔘 Button System

### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}
```

### Danger Button
```css
.btn-danger {
  background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(220, 38, 38, 0.4);
}
```

### Glass Button (Default)
```css
.btn-glass {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  backdrop-filter: blur(12px);
}
```

### Icon Button (Circular)
```css
.btn-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 📝 Typography

### Font Families
```css
/* Primary - System fonts */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;

/* Monospace - Code/technical */
font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;
```

### Font Sizes
```css
--text-xs: 12px;    /* Small labels */
--text-sm: 13px;    /* Secondary text */
--text-base: 14px;  /* Body text */
--text-md: 16px;    /* Important text */
--text-lg: 18px;    /* Headings */
--text-xl: 20px;    /* Large headings */
--text-2xl: 24px;   /* Hero text */
--text-3xl: 30px;   /* Page titles */
```

### Font Weights
```css
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

### Letter Spacing
```css
--tracking-tight: -0.02em;
--tracking-normal: 0;
--tracking-wide: 0.025em;  /* For buttons */
--tracking-wider: 0.05em;  /* For headings */
```

---

## 🎯 Interactive States

### Hover State
```css
.interactive:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
```

### Active/Pressed State
```css
.interactive:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
```

### Focus State (Keyboard)
```css
.interactive:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
}
```

### Disabled State
```css
.interactive:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(50%);
}
```

---

## 🎨 Component Patterns

### Card Pattern
```css
.card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
}

.card:hover {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
}
```

### Input Field Pattern
```css
.input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  transition: all 0.2s ease;
}

.input:focus {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
```

### Badge Pattern
```css
.badge {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
}
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first approach */
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large screens */
```

---

## ♿ Accessibility Guidelines

### Color Contrast
- Text on backgrounds: Minimum 4.5:1 ratio
- Large text (18px+): Minimum 3:1 ratio
- Interactive elements: Clear hover and focus states

### Focus Indicators
- Always visible for keyboard navigation
- Minimum 2px width
- High contrast color (blue: #3b82f6)
- 3px offset from element

### Motion
- Respect `prefers-reduced-motion` for animations
- Provide static alternatives
- Keep animations under 500ms

---

## 🛠️ Usage Examples

### Creating a New Button
```css
.my-button {
  /* Base styles */
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md); /* 12px */
  padding: var(--space-md) var(--space-lg); /* 12px 16px */
  
  /* Typography */
  font-weight: var(--weight-semibold); /* 600 */
  font-size: var(--text-base); /* 14px */
  letter-spacing: var(--tracking-wide); /* 0.025em */
  color: var(--text-primary);
  
  /* Effects */
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s var(--ease-smooth);
}

.my-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

### Creating a Glass Card
```css
.my-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-lg); /* 16px */
  padding: var(--space-xl); /* 20px */
  box-shadow: var(--shadow-md);
}
```

---

## 📦 Quick Reference

| Property | Value | Use Case |
|----------|-------|----------|
| Primary Color | `#3b82f6` | Main actions |
| Danger Color | `#dc2626` | Destructive actions |
| Success Color | `#22c55e` | Positive feedback |
| Warning Color | `#f59e0b` | Alerts |
| Glass BG | `rgba(255,255,255,0.12)` | Overlays |
| Border | `rgba(255,255,255,0.15)` | Separators |
| Blur | `blur(20px)` | Glass effect |
| Radius (btn) | `12px` | Buttons |
| Radius (card) | `16px` | Cards |
| Shadow | `0 8px 32px rgba(0,0,0,0.4)` | Elevation |
| Transition | `0.3s cubic-bezier(0.4,0,0.2,1)` | Smooth |

---

## 🎉 Summary

This design system provides:
✅ Consistent visual language
✅ Reusable patterns
✅ Modern aesthetics
✅ Accessibility compliance
✅ Performance optimization
✅ Cross-browser compatibility

Use these guidelines when creating new components to maintain consistency throughout the app!

