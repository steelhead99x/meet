# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A LiveKit-based video conferencing application built with Next.js 14 and React 18. The app features end-to-end encryption (E2EE), advanced virtual backgrounds with MediaPipe segmentation, and a Zoom-like Picture-in-Picture window during screen sharing.

## Essential Commands

### Development
```bash
pnpm dev              # Start dev server at http://localhost:3000/meet
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Auto-fix ESLint errors
pnpm test             # Run Vitest tests
pnpm format:check     # Check Prettier formatting
pnpm format:write     # Auto-format with Prettier
```

### Testing Individual Files
```bash
# Run specific test file
pnpm test lib/getLiveKitURL.test.ts
```

## Architecture

### Next.js App Router Structure

The app uses Next.js 14's app directory with the following key routes:

- `/meet` - Home page (app/page.tsx)
- `/rooms/[roomName]` - Dynamic room pages (app/rooms/[roomName]/page.tsx)
- `/custom` - Custom connection page (app/custom/page.tsx)
- `/api/connection-details` - Token generation endpoint (enforces single room: "Ruha Meetup")
- `/api/e2ee-key` - E2EE key management
- `/api/record/start` & `/api/record/stop` - Recording endpoints

### Video Processing Pipeline

The app has a sophisticated video background processing system:

1. **Background Processors** (lib/processors/):
   - `MediaPipeImageSegmenterProcessor.ts` - Enhanced segmentation using MediaPipe's Image Segmenter API (better than default Selfie Segmentation)
   - Supports blur, gradient, and image backgrounds
   - Multi-quality levels: low, medium, high, ultra

2. **Mask Processing** (lib/maskProcessor.ts):
   - Post-processing algorithms for enhanced person detection
   - Confidence thresholding to reduce false positives
   - Morphological operations (erosion/dilation) for noise removal
   - Connected component analysis to isolate main person
   - Temporal smoothing between frames

3. **Blur Configuration** (lib/BlurConfig.ts):
   - Quality presets: low (35px), medium (50px), high (85px), ultra (120px)
   - Device capability detection for optimal processor selection
   - Custom segmentation settings for fine-tuned control
   - Edge refinement with feathering and temporal smoothing

4. **Processing Flow**:
   - User selects background effect in CameraSettings.tsx or CustomPreJoin.tsx
   - Processor loads (with privacy overlay via ProcessorLoadingContext.tsx)
   - MediaPipe segments person from background using selected quality level
   - Enhanced person detection post-processes the mask
   - Effect applied (blur/virtual background) with edge refinement
   - Temporal smoothing prevents flickering

### E2EE Implementation

End-to-end encryption setup follows a specific order to avoid race conditions:

1. **Key Setup** (app/custom/VideoConferenceClientImpl.tsx:48-156):
   - `useSetupE2EE` hook manages worker and passphrase
   - Key must be set on `keyProvider` BEFORE creating Room
   - Room created with E2EE config in `roomOptions`
   - `setE2EEEnabled(true)` called before connecting
   - Key reasserted after connection to ensure worker picks up keys

2. **Critical Ordering**:
   ```typescript
   // Correct order:
   await keyProvider.setKey(passphrase);  // 1. Set key first
   const room = new Room(roomOptions);    // 2. Create room with E2EE config
   await room.setE2EEEnabled(true);       // 3. Enable E2EE
   await room.connect(url, token);        // 4. Connect
   await keyProvider.setKey(passphrase);  // 5. Reassert for worker
   ```

### Picture-in-Picture Implementation

The app has TWO PIP implementations for different use cases:

1. **BrowserWindowPIP.tsx** (Zoom-like behavior):
   - Uses Document Picture-in-Picture API (Chrome 116+)
   - Opens separate always-on-top window during screen sharing
   - Shows all participant videos
   - Automatically closes when screen share stops

2. **ScreenSharePIP.tsx** (fallback):
   - Uses traditional Video PIP API
   - Shows only screen share content
   - Browser compatibility fallback

### Component Architecture

Key UI components in lib/:

- **CustomPreJoin.tsx** - Pre-join screen with background effects, device validation
- **CameraSettings.tsx** - In-room camera controls and background effects
- **ProcessorLoadingContext.tsx** - Global state for processor loading (privacy overlay)
- **ProcessorLoadingOverlay.tsx** - Full-screen privacy overlay during processor changes
- **KeyboardShortcuts.tsx** - Hotkeys (m=mic, v=camera, s=screen, c=chat)
- **ReconnectionBanner.tsx** - UI feedback during connection issues
- **ConnectionQualityIndicator.tsx** & **ConnectionQualityTooltip.tsx** - Network quality feedback
- **CarouselNavigation.tsx** - Navigate between participant videos

### Performance Optimizations

1. **Device Capability Detection** (lib/client-utils.ts):
   - Detects CPU cores, GPU capabilities
   - Auto-selects optimal blur quality
   - Prevents high-quality processing on low-end devices

2. **Low CPU Optimizer** (lib/usePerformanceOptimizer.ts):
   - Monitors performance metrics
   - Dynamically adjusts video quality if CPU stressed

3. **Processor Management**:
   - Lazy loading of MediaPipe models
   - Proper cleanup to prevent memory leaks
   - Temporal smoothing reduces processing frequency

### User Preferences

The app persists user settings in localStorage (lib/userPreferences.ts):
- Username
- Audio/video enabled state
- Selected devices
- Background effect type and settings
- Blur quality level
- Custom segmentation parameters

## Important Technical Details

### Single Room Enforcement

The app enforces a single room name "Ruha Meetup" in app/api/connection-details/route.ts:37-40. To allow multiple rooms, remove this check.

### MediaPipe Integration

The app uses MediaPipe's Image Segmenter (not Selfie Segmentation) for better quality:
- Multi-class segmentation (hair, face, body, clothes)
- Better edge detection especially for hair
- Improved accuracy on complex backgrounds
- See SEGMENTATION_UPGRADE_GUIDE.md for implementation details

### Background Effect Loading

When applying background effects, the app shows a privacy overlay to prevent video flashing:
1. `setIsApplyingProcessor(true)` in ProcessorLoadingContext
2. ProcessorLoadingOverlay covers video with solid color
3. Processor loads and applies effect
4. `setIsApplyingProcessor(false)` removes overlay

### Track Lifecycle Management

Important patterns to avoid memory leaks:
- Always cleanup processors in useEffect cleanup functions
- Use `waitForProcessorWithFallback` (lib/videoProcessorUtils.ts) for robust processor application
- Prevent duplicate processor applications with refs
- Let LiveKit handle track cleanup automatically on disconnect

### Environment Variables

Required:
- `LIVEKIT_URL` - WebSocket URL (wss://...)
- `LIVEKIT_API_KEY` - API key
- `LIVEKIT_API_SECRET` - API secret

Optional:
- `NEXT_PUBLIC_SHOW_SETTINGS_MENU` - Show advanced settings (default: false)
- `NEXT_PUBLIC_CONN_DETAILS_ENDPOINT` - Custom connection endpoint

## Testing Strategy

The app uses Vitest for testing. Example test file: lib/getLiveKitURL.test.ts

When writing tests:
- Place test files next to source files with `.test.ts` extension
- Use `pnpm test` to run all tests
- Use `pnpm test <file>` to run specific test

## Common Development Patterns

### Adding New Background Effects

1. Update background type in CameraSettings.tsx or CustomPreJoin.tsx
2. Create processor or use existing VirtualBackground
3. Apply with `waitForProcessorWithFallback`
4. Save to user preferences
5. Ensure proper cleanup

### Modifying Segmentation Quality

1. Update BLUR_PRESETS in lib/BlurConfig.ts
2. Adjust blur radius, delegate (CPU/GPU), enhanced person detection settings
3. Test on various devices
4. Consider adding to device capability detection

### Adding Custom Processors

See lib/processors/MediaPipeImageSegmenter.ts as reference:
1. Implement `processFrame(frame: VideoFrame): Promise<VideoFrame>`
2. Implement `destroy()` for cleanup
3. Handle initialization and model loading
4. Integrate with BlurConfig processorType selection

## Known Issues and Workarounds

See documentation files for detailed fixes:
- BACKGROUND_EFFECT_FIX.md - Background effect switching issues
- BLUR_DEFAULT_IMPLEMENTATION.md - Default blur behavior
- PREJOIN_FIX.md - Pre-join screen issues
- TRACK_ENDED_FIX.md - Track lifecycle issues
- MEDIAPIPE_WARNING_FIX.md - MediaPipe initialization warnings

## Package Manager

This project uses **pnpm** (v10.18.2). Always use pnpm for consistency (not npm or yarn).
