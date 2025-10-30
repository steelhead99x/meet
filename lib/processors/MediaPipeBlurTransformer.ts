/**
 * MediaPipe Blur Transformer for LiveKit
 *
 * Implements LiveKit's VideoTransformer interface to provide enhanced blur
 * using MediaPipe's Image Segmenter for better person detection.
 */

import { processEnhancedPersonMask } from '../maskProcessor';
import { BlurConfig } from '../BlurConfig';

interface MediaPipeBlurOptions {
  blurRadius: number;
  delegate: 'GPU' | 'CPU';
  enhancedPersonDetection?: BlurConfig['enhancedPersonDetection'];
  temporalSmoothingAlpha?: number;
}

export default class MediaPipeBlurTransformer {
  private segmenter: any = null;
  private initialized: boolean = false;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private options: MediaPipeBlurOptions;

  // Temporal smoothing buffers
  private previousMask: ImageData | null = null;
  private smoothedMaskBuffer: ImageData | null = null;
  private frameCount: number = 0;

  constructor(options: MediaPipeBlurOptions) {
    this.options = options;
    this.canvas = new OffscreenCanvas(640, 480);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }

  /**
   * Init method - required by LiveKit interface
   * Called by LiveKit before processing starts
   */
  async init(): Promise<void> {
    console.log('[MediaPipeBlurTransformer] init() called');
    // Initialization happens lazily in transform()
    // This allows the processor to be created quickly without blocking
  }

  /**
   * Restart method - required by LiveKit interface
   * Called when the processor needs to be restarted
   */
  async restart(): Promise<void> {
    console.log('[MediaPipeBlurTransformer] restart() called');
    // Reset state
    this.frameCount = 0;
    this.previousMask = null;
    this.smoothedMaskBuffer = null;
  }

  /**
   * Initialize the MediaPipe segmenter
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[MediaPipeBlurTransformer] 🔄 Starting initialization...');

      const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
      console.log('[MediaPipeBlurTransformer] ✅ Module loaded');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      console.log('[MediaPipeBlurTransformer] ✅ WASM loaded');

      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
          delegate: this.options.delegate,
        },
        outputCategoryMask: true,
        outputConfidenceMasks: false,
        runningMode: 'VIDEO',
      });

      this.initialized = true;
      console.log('[MediaPipeBlurTransformer] ✅✅✅ Initialized successfully');
    } catch (error) {
      console.error('[MediaPipeBlurTransformer] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Transform method required by LiveKit VideoTransformer
   * This is called for each video frame
   */
  async transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>
  ): Promise<void> {
    try {
      // Initialize on first frame
      if (!this.initialized) {
        await this.initialize();
      }

      this.frameCount++;

      // Process the frame
      const processedFrame = await this.processFrame(frame);

      // Close the input frame to prevent memory leaks
      frame.close();

      // Enqueue the processed frame
      controller.enqueue(processedFrame);

      if (this.frameCount === 1) {
        console.log('[MediaPipeBlurTransformer] ✅ First frame processed and enqueued!');
      } else if (this.frameCount % 30 === 0) {
        console.log(`[MediaPipeBlurTransformer] Processed ${this.frameCount} frames`);
      }

    } catch (error) {
      console.error('[MediaPipeBlurTransformer] ❌ Error in transform:', error);
      // On error, pass through the original frame
      controller.enqueue(frame);
    }
  }

  /**
   * Process a single video frame
   */
  private async processFrame(inputFrame: VideoFrame): Promise<VideoFrame> {
    const startTime = performance.now();

    // Run segmentation
    const segmentationResult = this.segmenter.segmentForVideo(
      inputFrame,
      Date.now()
    );

    // Convert to person mask
    let personMask = this.convertToPersonMask(
      segmentationResult.categoryMask,
      inputFrame.displayWidth,
      inputFrame.displayHeight
    );

    // Apply enhanced person detection if enabled
    if (this.options.enhancedPersonDetection?.enabled) {
      personMask = processEnhancedPersonMask(
        personMask,
        this.options.enhancedPersonDetection
      );
    }

    // Apply temporal smoothing
    personMask = this.applyTemporalSmoothing(personMask);

    // Apply blur to background
    const outputFrame = this.applyBlurToBackground(
      inputFrame,
      personMask,
      this.options.blurRadius
    );

    const processingTime = performance.now() - startTime;
    if (this.frameCount === 1) {
      console.log(`[MediaPipeBlurTransformer] First frame processed in ${processingTime.toFixed(1)}ms`);
    }

    return outputFrame;
  }

  /**
   * Convert MediaPipe category mask to binary person mask
   */
  private convertToPersonMask(
    categoryMask: any,
    width: number,
    height: number
  ): ImageData {
    const mask = new ImageData(width, height);
    const data = mask.data;
    const categories = categoryMask.getAsUint8Array();

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const isPerson = category > 0 ? 255 : 0;

      const pixelIndex = i * 4;
      data[pixelIndex] = isPerson;
      data[pixelIndex + 1] = isPerson;
      data[pixelIndex + 2] = isPerson;
      data[pixelIndex + 3] = 255;
    }

    return mask;
  }

  /**
   * Apply temporal smoothing to reduce flickering
   */
  private applyTemporalSmoothing(currentMask: ImageData): ImageData {
    if (!this.previousMask) {
      this.previousMask = new ImageData(
        new Uint8ClampedArray(currentMask.data),
        currentMask.width,
        currentMask.height
      );
      return currentMask;
    }

    // Check if mask dimensions changed
    if (
      this.previousMask.width !== currentMask.width ||
      this.previousMask.height !== currentMask.height
    ) {
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
    const alpha = this.options.temporalSmoothingAlpha ?? 0.7;

    for (let i = 0; i < current.length; i += 4) {
      const value = current[i] * alpha + previous[i] * (1 - alpha);
      output[i] = value;
      output[i + 1] = value;
      output[i + 2] = value;
      output[i + 3] = 255;
    }

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

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // Draw original frame
    this.ctx.drawImage(inputFrame, 0, 0, width, height);
    const originalImage = this.ctx.getImageData(0, 0, width, height);

    // Create blurred version
    this.ctx.filter = `blur(${blurRadius}px)`;
    this.ctx.drawImage(inputFrame, 0, 0, width, height);
    this.ctx.filter = 'none';
    const blurredImage = this.ctx.getImageData(0, 0, width, height);

    // Composite: use original where person is, blurred for background
    const output = this.ctx.createImageData(width, height);
    const maskData = mask.data;
    const originalData = originalImage.data;
    const blurredData = blurredImage.data;
    const outputData = output.data;

    for (let i = 0; i < maskData.length; i += 4) {
      const maskValue = maskData[i] / 255; // 0 = background, 1 = person

      outputData[i] = blurredData[i] * (1 - maskValue) + originalData[i] * maskValue;
      outputData[i + 1] = blurredData[i + 1] * (1 - maskValue) + originalData[i + 1] * maskValue;
      outputData[i + 2] = blurredData[i + 2] * (1 - maskValue) + originalData[i + 2] * maskValue;
      outputData[i + 3] = 255;
    }

    // Put composited image back on canvas
    this.ctx.putImageData(output, 0, 0);

    // Create new VideoFrame from canvas
    const newFrame = new VideoFrame(this.canvas, {
      timestamp: inputFrame.timestamp,
      duration: inputFrame.duration ?? undefined,
    });

    return newFrame;
  }

  /**
   * Update options - required by LiveKit interface
   */
  update(options: Partial<MediaPipeBlurOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('[MediaPipeBlurTransformer] Options updated:', this.options);
  }

  /**
   * Destroy and cleanup - required by LiveKit interface
   */
  async destroy(): Promise<void> {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
    this.initialized = false;
    this.previousMask = null;
    this.smoothedMaskBuffer = null;
    this.frameCount = 0;
    console.log('[MediaPipeBlurTransformer] Destroyed and buffers cleared');
  }
}
