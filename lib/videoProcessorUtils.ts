/**
 * Utility functions for detecting when video processors are ready
 * Instead of using fixed timeouts, these functions actually detect when
 * the processor is outputting processed frames
 */

import { LocalVideoTrack } from 'livekit-client';

export interface ProcessorReadyOptions {
  timeout?: number; // Maximum time to wait (default: 5000ms)
  minFrames?: number; // Minimum frames to detect before considering ready (default: 3)
  frameCheckInterval?: number; // How often to check frames (default: 100ms)
}

const defaultOptions: Required<ProcessorReadyOptions> = {
  timeout: 5000,
  minFrames: 3,
  frameCheckInterval: 100,
};

/**
 * Wait for a video processor to be ready by detecting when it's actually outputting frames
 * This is much better than fixed timeouts because it adapts to device performance
 * 
 * @param track The LocalVideoTrack with a processor applied
 * @param options Configuration options
 * @returns Promise that resolves when processor is ready, or rejects on timeout
 */
export async function waitForProcessorReady(
  track: LocalVideoTrack,
  options: ProcessorReadyOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let framesDetected = 0;
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    
    // Create a temporary video element to monitor frames
    const videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    
    // Track the last frame time to detect when new frames are being produced
    let lastFrameTime = 0;
    let lastFrameCheck = 0;
    
    const cleanup = () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      // Detach and cleanup video element
      track.detach(videoElement);
      videoElement.remove();
    };
    
    const checkFrames = () => {
      try {
        // Check if track is still valid
        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack || mediaStreamTrack.readyState !== 'live') {
          cleanup();
          reject(new Error('Track ended while waiting for processor'));
          return;
        }
        
        // Get current playback time - this increments when frames are being rendered
        const currentTime = videoElement.currentTime;
        const now = Date.now();
        
        // Detect if a new frame has been rendered
        if (currentTime > lastFrameTime && currentTime > 0) {
          // New frame detected!
          framesDetected++;
          lastFrameTime = currentTime;
          lastFrameCheck = now;
          
          console.log(`[ProcessorReady] Frame ${framesDetected} detected (${(now - startTime)}ms elapsed)`);
          
          // Check if we have enough frames to consider processor ready
          if (framesDetected >= opts.minFrames) {
            console.log(`[ProcessorReady] Processor ready after ${framesDetected} frames (${(now - startTime)}ms)`);
            cleanup();
            resolve();
            return;
          }
        }
        
        // Check if we're making progress (frames within reasonable time)
        if (framesDetected > 0 && (now - lastFrameCheck) > 2000) {
          // Haven't seen a new frame in 2 seconds, something might be wrong
          console.warn('[ProcessorReady] No new frames detected for 2 seconds, assuming ready');
          cleanup();
          resolve(); // Resolve anyway to avoid hanging
          return;
        }
      } catch (error) {
        console.error('[ProcessorReady] Error checking frames:', error);
        cleanup();
        reject(error);
      }
    };
    
    // Setup timeout
    timeoutHandle = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      if (framesDetected > 0) {
        // We detected some frames, so processor is probably working
        console.log(`[ProcessorReady] Timeout reached but ${framesDetected} frames detected, considering ready`);
        cleanup();
        resolve();
      } else {
        // No frames detected at all, this might be a problem
        console.warn(`[ProcessorReady] Timeout after ${elapsed}ms with no frames detected`);
        cleanup();
        reject(new Error(`Processor timeout after ${elapsed}ms - no frames detected`));
      }
    }, opts.timeout);
    
    // Attach track to video element
    try {
      track.attach(videoElement);
      
      // Wait a brief moment for video element to initialize
      setTimeout(() => {
        // Start checking for frames
        checkInterval = setInterval(checkFrames, opts.frameCheckInterval);
        console.log('[ProcessorReady] Started monitoring frames...');
      }, 50);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/**
 * Simpler version that just waits for the video element to start playing
 * This is faster but less reliable than frame detection
 * 
 * @param track The LocalVideoTrack to monitor
 * @param timeout Maximum time to wait
 */
export async function waitForTrackPlayback(
  track: LocalVideoTrack,
  timeout: number = 3000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;
    
    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      track.detach(videoElement);
      videoElement.remove();
    };
    
    const handlePlaying = () => {
      if (resolved) return;
      resolved = true;
      console.log('[TrackPlayback] Video started playing');
      cleanup();
      resolve();
    };
    
    const handleTimeUpdate = () => {
      // TimeUpdate fires when frames are being rendered
      if (resolved) return;
      if (videoElement.currentTime > 0) {
        resolved = true;
        console.log('[TrackPlayback] Video frames detected');
        cleanup();
        resolve();
      }
    };
    
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    
    timeoutHandle = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn('[TrackPlayback] Timeout waiting for playback');
      cleanup();
      // Resolve anyway rather than reject - video might still work
      resolve();
    }, timeout);
    
    try {
      track.attach(videoElement);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/**
 * Wait for processor with fallback strategy:
 * 1. Try frame detection (most reliable)
 * 2. Fall back to playback detection if frame detection fails
 * 3. Fall back to minimum wait if both fail
 * 
 * @param track The LocalVideoTrack with processor applied
 * @param minWaitMs Minimum time to wait even if detection succeeds early
 */
export async function waitForProcessorWithFallback(
  track: LocalVideoTrack,
  minWaitMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Try frame detection first (most reliable)
    await waitForProcessorReady(track, {
      timeout: 2000,
      minFrames: 2,
      frameCheckInterval: 50,
    });
  } catch (error) {
    console.warn('[ProcessorFallback] Frame detection failed, trying playback detection:', error);
    
    try {
      // Try simpler playback detection
      await waitForTrackPlayback(track, 1000);
    } catch (error2) {
      console.warn('[ProcessorFallback] Playback detection failed, using minimum wait:', error2);
      // Final fallback: just wait minimum time
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Ensure minimum wait time has elapsed
  const elapsed = Date.now() - startTime;
  if (elapsed < minWaitMs) {
    const remaining = minWaitMs - elapsed;
    console.log(`[ProcessorFallback] Waiting ${remaining}ms more to reach minimum wait time`);
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
  
  const totalElapsed = Date.now() - startTime;
  console.log(`[ProcessorFallback] Processor ready after ${totalElapsed}ms`);
}

