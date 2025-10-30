# Carousel Navigation Implementation

## Overview
The participant carousel (visible during screen sharing in focus layout mode) has been enhanced with left/right arrow overlays for easier navigation, replacing the traditional horizontal scrollbar.

## Implementation Details

### Components Created

#### 1. `lib/CarouselNavigation.tsx`
A client-side React component that:
- Dynamically detects the LiveKit carousel element when it appears
- Monitors scroll position to show/hide arrow buttons intelligently
- Provides smooth scrolling navigation (80% of visible width per click)
- Automatically handles DOM changes (new participants joining/leaving)
- Only renders when carousel needs scrolling (multiple participants)

**Key Features:**
- Uses MutationObserver to detect carousel dynamically
- ResizeObserver to handle layout changes
- Scroll event listeners for real-time button state updates
- Smooth scrolling behavior
- Accessible with proper ARIA labels

#### 2. `styles/CarouselNavigation.module.css`
Custom styling for navigation arrows:
- Circular buttons with glass-morphism effect
- Positioned strategically outside carousel bounds
- Hover and active states for better UX
- Responsive positioning for mobile devices
- High z-index (20) to appear above carousel (z-index: 10)

### CSS Updates

#### `styles/modern-theme.css`
Updated carousel styling to:
- Hide scrollbar while maintaining scroll functionality
- Support smooth scroll behavior
- Cross-browser scrollbar hiding (Firefox, Chrome, Safari, Edge)

**Changes:**
```css
[data-lk-theme] .lk-focus-layout > .lk-carousel {
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scroll-behavior: smooth !important;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* Hide scrollbar for Chrome, Safari and Opera */
[data-lk-theme] .lk-focus-layout > .lk-carousel::-webkit-scrollbar {
  display: none;
}
```

### Integration

The `CarouselNavigation` component has been added to both room implementations:

1. **`app/rooms/[roomName]/PageClientImpl.tsx`**
2. **`app/custom/VideoConferenceClientImpl.tsx`**

Placed alongside other UI enhancement components like:
- `ScreenSharePIP`
- `ConnectionQualityTooltip`
- `ReconnectionBanner`

## User Experience

### Desktop
- Arrow buttons appear on left and right sides of the carousel
- Left arrow: positioned to the left of the carousel
- Right arrow: positioned near the right edge of the screen
- Buttons only show when scrolling is possible in that direction
- Hover effect: slight scale and increased opacity
- Click to scroll 80% of visible width

### Mobile
- Smaller arrow buttons (32px vs 40px)
- Adjusted positioning for mobile carousel size
- Responsive to screen size changes

### Smart Button Visibility
- Both arrows hidden when all participants fit in view
- Left arrow only when scrolled from start
- Right arrow only when more content exists to the right
- Both arrows when in middle of scroll range

## Technical Architecture

### Lifecycle
1. Component mounts and searches for carousel element
2. If not found, sets up MutationObserver to detect when it appears
3. Once found, attaches scroll and resize listeners
4. Monitors scroll position to update button states
5. Cleans up all observers and listeners on unmount

### Event Handling
- **Scroll Events**: Update button visibility based on scroll position
- **Resize Events**: Recalculate button visibility on window resize
- **ResizeObserver**: Detects carousel size changes (participants joining/leaving)

### Performance
- Efficient event listeners with proper cleanup
- Observers disconnect when no longer needed
- Conditional rendering (null when not needed)
- Smooth CSS transitions

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Scrollbar hiding works across all major browsers
- Smooth scrolling behavior supported
- Fallback for older browsers (functional but may show scrollbar)

## Future Enhancements
Possible improvements:
- Keyboard navigation (arrow keys)
- Touch swipe gestures on mobile
- Pagination indicators (dots)
- Auto-scroll on new participant join
- Configurable scroll amount

## Testing
To test the carousel navigation:
1. Start a video call with 2+ participants
2. Have one participant share their screen
3. Observe the participant carousel in bottom-right corner
4. Click left/right arrows to navigate between participants
5. Add/remove participants to test dynamic behavior
6. Resize window to test responsive positioning

