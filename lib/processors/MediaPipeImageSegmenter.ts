/**
 * Enhanced MediaPipe Image Segmenter Processor
 * 
 * This is an upgraded segmentation processor that uses MediaPipe's newer
 * Image Segmenter API instead of the older Selfie Segmentation.
 * 
 * Benefits over current LiveKit processor:
 * - Multi-class segmentation (hair, face, body, clothes separated)
 * - Better edge detection
 * - Improved accuracy on complex backgrounds
 * - Can integrate with our enhanced person detection algorithms
 */

import { processEnhancedPersonMask } from '../maskProcessor';
import { BlurConfig } from '../BlurConfig';

// Note: Install with: npm install @mediapipe/tasks-vision
// import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

interface ProcessorConfig {
  blurRadius: number;
  delegate: 'GPU' | 'CPU';
  enhancedPersonDetection?: BlurConfig['enhancedPersonDetection'];
  temporalSmoothingAlpha?: number; // Custom temporal smoothing factor (0.5-0.9)
}

export class MediaPipeImageSegmenterProcessor {
  private segmenter: any = null; // ImageSegmenter type
  private initialized: boolean = false;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private config: ProcessorConfig;
  
  // Temporal smoothing with buffer reuse to prevent memory leaks
  private previousMask: ImageData | null = null;
  private smoothedMaskBuffer: ImageData | null = null; // Reused buffer
  private frameCount: number = 0;
  private maxBufferSize: number = 640 * 480 * 4; // Maximum buffer size (640x480 RGBA)
  
  constructor(config: ProcessorConfig) {
    this.config = config;
    this.canvas = new OffscreenCanvas(640, 480);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }
  
  /**
   * Initialize the MediaPipe Image Segmenter
   * This downloads the WASM runtime and model (~3MB)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[MediaPipeImageSegmenter] Already initialized, skipping...');
      return;
    }

    try {
      console.log('[MediaPipeImageSegmenter] 🔄 Starting initialization...');
      console.log('[MediaPipeImageSegmenter] Delegate:', this.config.delegate);
      console.log('[MediaPipeImageSegmenter] Blur radius:', this.config.blurRadius);

      // Dynamic import to avoid loading if not used
      console.log('[MediaPipeImageSegmenter] Loading @mediapipe/tasks-vision module...');
      const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
      console.log('[MediaPipeImageSegmenter] ✅ Module loaded successfully');

      // Initialize WASM runtime
      console.log('[MediaPipeImageSegmenter] Loading WASM runtime from CDN...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      console.log('[MediaPipeImageSegmenter] ✅ WASM runtime loaded');

      // Create segmenter with multiclass model
      console.log('[MediaPipeImageSegmenter] Creating segmenter with multiclass model...');
      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          // This model provides multiple categories:
          // 0 = background
          // 1 = hair
          // 2 = body-skin
          // 3 = face-skin
          // 4 = clothes
          // 5 = others (person)
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
          delegate: this.config.delegate,
        },
        outputCategoryMask: true,
        outputConfidenceMasks: false,
        runningMode: 'VIDEO',
      });

      this.initialized = true;
      console.log('[MediaPipeImageSegmenter] ✅✅✅ Initialized successfully');
      console.log('[MediaPipeImageSegmenter] Ready to process frames with enhanced person detection');
    } catch (error) {
      console.error('[MediaPipeImageSegmenter] ❌❌❌ Initialization failed:', error);
      console.error('[MediaPipeImageSegmenter] Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      this.initialized = false;
      throw error;
    }
  }
  
  /**
   * Process a video frame with segmentation and blur
   */
  async processFrame(inputFrame: VideoFrame): Promise<VideoFrame> {
    if (!this.initialized) {
      console.log('[MediaPipeImageSegmenter] Not initialized, initializing now...');
      await this.initialize();
    }

    const startTime = performance.now();
    this.frameCount++;

    try {
      // Step 1: Run segmentation
      const segmentationResult = this.segmenter.segmentForVideo(
        inputFrame,
        Date.now()
      );

      // Step 2: Convert category mask to binary person mask
      // Categories 1-5 are all "person" (hair, skin, clothes, etc.)
      let personMask = this.convertToPersonMask(
        segmentationResult.categoryMask,
        inputFrame.displayWidth,
        inputFrame.displayHeight
      );

      // Step 3: Apply enhanced person detection if enabled
      if (this.config.enhancedPersonDetection?.enabled) {
        personMask = processEnhancedPersonMask(
          personMask,
          this.config.enhancedPersonDetection
        );
      }

      // Step 4: Apply temporal smoothing
      personMask = this.applyTemporalSmoothing(personMask);

      // Step 5: Apply blur to background
      const outputFrame = this.applyBlurToBackground(
        inputFrame,
        personMask,
        this.config.blurRadius
      );

      const processingTime = performance.now() - startTime;

      // Log performance every 30 frames (about once per second at 30fps)
      if (this.frameCount === 1) {
        console.log(`[MediaPipeImageSegmenter] ✅ First frame processed successfully in ${processingTime.toFixed(1)}ms`);
      } else if (this.frameCount % 30 === 0) {
        console.log(`[MediaPipeImageSegmenter] Frame ${this.frameCount}: ${processingTime.toFixed(1)}ms`);
      }

      return outputFrame;
    } catch (error) {
      console.error('[MediaPipeImageSegmenter] ❌ Frame processing error:', error);
      if (this.frameCount <= 5) {
        console.error('[MediaPipeImageSegmenter] Error details:', {
          message: (error as Error).message,
          frameCount: this.frameCount,
          initialized: this.initialized,
        });
      }
      // Return original frame on error to avoid black screen
      return inputFrame;
    }
  }
  
  /**
   * Convert MediaPipe's category mask to binary person mask
   * Categories 1-5 are all person-related
   */
  private convertToPersonMask(
    categoryMask: any,
    width: number,
    height: number
  ): ImageData {
    const mask = new ImageData(width, height);
    const data = mask.data;
    
    // categoryMask is a Uint8Array where each pixel is a category ID (0-5)
    const categories = categoryMask.getAsUint8Array();
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      // Categories 1-5 are person (hair=1, body-skin=2, face-skin=3, clothes=4, others=5)
      // Category 0 is background
      const isPerson = category > 0 ? 255 : 0;
      
      const pixelIndex = i * 4;
      data[pixelIndex] = isPerson;     // R
      data[pixelIndex + 1] = isPerson; // G
      data[pixelIndex + 2] = isPerson; // B
      data[pixelIndex + 3] = 255;      // A
    }
    
    return mask;
  }
  
  /**
   * Apply temporal smoothing to reduce flickering
   * Uses exponential moving average (IIR filter)
   * OPTIMIZED: Reuses buffers to prevent memory leaks
   */
  private applyTemporalSmoothing(currentMask: ImageData): ImageData {
    // First frame - initialize buffers
    if (!this.previousMask) {
      // Create a copy for previousMask (don't reference currentMask directly)
      this.previousMask = new ImageData(
        new Uint8ClampedArray(currentMask.data),
        currentMask.width,
        currentMask.height
      );
      return currentMask;
    }

    // Check if mask dimensions changed (resolution change)
    const currentSize = currentMask.data.length;
    if (
      this.previousMask.width !== currentMask.width ||
      this.previousMask.height !== currentMask.height
    ) {
      console.log('[MediaPipeImageSegmenter] Mask size changed, resetting temporal smoothing buffers');
      // Reset buffers on size change
      this.previousMask = new ImageData(
        new Uint8ClampedArray(currentMask.data),
        currentMask.width,
        currentMask.height
      );
      this.smoothedMaskBuffer = null;
      return currentMask;
    }

    // Reuse or create smoothed buffer
    if (
      !this.smoothedMaskBuffer ||
      this.smoothedMaskBuffer.width !== currentMask.width ||
      this.smoothedMaskBuffer.height !== currentMask.height
    ) {
      this.smoothedMaskBuffer = new ImageData(currentMask.width, currentMask.height);
    }

    const current = currentMask.data;
    const previous = this.previousMask.data;
    const output = this.smoothedMaskBuffer.data;

    // IIR filter: output = alpha * current + (1 - alpha) * previous
    // This smooths out rapid changes while staying responsive
    // Use custom alpha if provided, otherwise default to 0.7
    const alpha = this.config.temporalSmoothingAlpha ?? 0.7;

    // Process in chunks for better performance
    for (let i = 0; i < current.length; i += 4) {
      const value = current[i] * alpha + previous[i] * (1 - alpha);
      output[i] = value;
      output[i + 1] = value;
      output[i + 2] = value;
      output[i + 3] = 255;
    }

    // Update previous mask by copying data (reuse ImageData object)
    this.previousMask.data.set(output);

    return this.smoothedMaskBuffer;
  }
  
  /**
   * Apply Gaussian blur to background using the person mask
   */
  private applyBlurToBackground(
    inputFrame: VideoFrame,
    mask: ImageData,
    blurRadius: number
  ): VideoFrame {
    const width = inputFrame.displayWidth;
    const height = inputFrame.displayHeight;

    if (this.frameCount === 1) {
      console.log('[MediaPipeImageSegmenter] applyBlurToBackground called:', {
        width,
        height,
        blurRadius,
        canvasSize: `${this.canvas.width}x${this.canvas.height}`,
      });
    }

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      console.log('[MediaPipeImageSegmenter] Canvas resized to:', `${width}x${height}`);
    }

    // Draw original frame
    this.ctx.drawImage(inputFrame, 0, 0, width, height);
    const originalImage = this.ctx.getImageData(0, 0, width, height);

    // CRITICAL: Check if filter is supported on OffscreenCanvas
    if (this.frameCount === 1) {
      console.log('[MediaPipeImageSegmenter] Checking filter support:', {
        hasFilterProperty: 'filter' in this.ctx,
        currentFilter: this.ctx.filter,
      });
    }

    // Create blurred version using CSS filter
    this.ctx.filter = `blur(${blurRadius}px)`;

    if (this.frameCount === 1) {
      console.log('[MediaPipeImageSegmenter] Filter set to:', this.ctx.filter);
    }

    this.ctx.drawImage(inputFrame, 0, 0, width, height);
    this.ctx.filter = 'none';
    const blurredImage = this.ctx.getImageData(0, 0, width, height);

    if (this.frameCount === 1) {
      console.log('[MediaPipeImageSegmenter] Checking if blur was applied...');
      // Check if blur was actually applied by comparing pixels
      let diffCount = 0;
      for (let i = 0; i < 100; i += 4) {
        if (Math.abs(originalImage.data[i] - blurredImage.data[i]) > 1) diffCount++;
      }
      console.log('[MediaPipeImageSegmenter] Pixel differences detected:', diffCount, '/ 25 samples');

      if (diffCount === 0) {
        console.warn('[MediaPipeImageSegmenter] ⚠️  WARNING: No pixel differences detected! Filter may not be supported on OffscreenCanvas');
        console.warn('[MediaPipeImageSegmenter] This browser may not support CSS filters on OffscreenCanvas');
      }
    }
    
    // Composite: use original where person is, blurred for background
    const output = this.ctx.createImageData(width, height);
    const maskData = mask.data;
    const originalData = originalImage.data;
    const blurredData = blurredImage.data;
    const outputData = output.data;
    
    for (let i = 0; i < maskData.length; i += 4) {
      const maskValue = maskData[i] / 255; // 0 = background, 1 = person
      
      // Linear interpolation between blurred and original
      outputData[i] = blurredData[i] * (1 - maskValue) + originalData[i] * maskValue;
      outputData[i + 1] = blurredData[i + 1] * (1 - maskValue) + originalData[i + 1] * maskValue;
      outputData[i + 2] = blurredData[i + 2] * (1 - maskValue) + originalData[i + 2] * maskValue;
      outputData[i + 3] = 255;
    }
    
    // Put composited image back on canvas
    this.ctx.putImageData(output, 0, 0);

    // Create new VideoFrame from canvas with proper options
    // CRITICAL: Must include all VideoFrame properties for proper playback
    try {
      const newFrame = new VideoFrame(this.canvas, {
        timestamp: inputFrame.timestamp,
        duration: inputFrame.duration ?? undefined,
      });

      if (this.frameCount === 1) {
        console.log('[MediaPipeImageSegmenter] VideoFrame created successfully:', {
          timestamp: newFrame.timestamp,
          displayWidth: newFrame.displayWidth,
          displayHeight: newFrame.displayHeight,
          format: newFrame.format,
        });
      }

      // CRITICAL: Close input frame to prevent memory leak
      inputFrame.close();

      return newFrame;
    } catch (error) {
      console.error('[MediaPipeImageSegmenter] ❌ Failed to create VideoFrame from canvas:', error);
      // If frame creation fails, return original (don't close it)
      return inputFrame;
    }
  }
  
  /**
   * Cleanup resources
   * CRITICAL: Clear all buffers to prevent memory leaks
   */
  async destroy(): Promise<void> {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
    this.initialized = false;

    // CRITICAL: Clear temporal smoothing buffers to prevent memory leaks
    this.previousMask = null;
    this.smoothedMaskBuffer = null;
    this.frameCount = 0;

    console.log('[MediaPipeImageSegmenter] Destroyed and buffers cleared');
  }
}

/**
 * Factory function to create processor compatible with LiveKit
 */
export function createMediaPipeImageSegmenter(config: BlurConfig): MediaPipeImageSegmenterProcessor {
  return new MediaPipeImageSegmenterProcessor({
    blurRadius: config.blurRadius,
    delegate: config.segmenterOptions.delegate,
    enhancedPersonDetection: config.enhancedPersonDetection,
  });
}

