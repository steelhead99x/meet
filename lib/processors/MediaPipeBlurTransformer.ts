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
  outputConfidenceMasks?: boolean;
  outputCategoryMask?: boolean;
  processEveryNFrames?: number; // 1 = every frame, 2 = every other frame, etc.
}

export default class MediaPipeBlurTransformer {
  // Required by LiveKit VideoTrackTransformer interface
  public transformer?: TransformStream<VideoFrame, VideoFrame>;

  private segmenter: any = null;
  private initialized: boolean = false;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private options: MediaPipeBlurOptions;

  // Temporal smoothing buffers
  private previousMask: ImageData | null = null;
  private smoothedMaskBuffer: ImageData | null = null;
  private frameCount: number = 0;

  // Performance optimization: process every Nth frame
  private processEveryNFrames: number = 1; // Default: process every frame for best quality
  private lastProcessedMask: ImageData | null = null;
  private lastOutputFrame: VideoFrame | null = null;

  // Motion detection for adaptive temporal smoothing
  private lastFrameImageData: ImageData | null = null;

  constructor(options: MediaPipeBlurOptions) {
    this.options = options;
    // Set frame processing frequency from options, default to every frame
    this.processEveryNFrames = options.processEveryNFrames ?? 1;

    this.canvas = new OffscreenCanvas(640, 480);
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Create the TransformStream that LiveKit will use
    this.transformer = new TransformStream({
      transform: this.transform.bind(this),
    });
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
    this.lastProcessedMask = null;
    if (this.lastOutputFrame) {
      this.lastOutputFrame.close();
      this.lastOutputFrame = null;
    }
  }

  /**
   * Destroy method - required by LiveKit interface
   * Called when the processor is being cleaned up
   */
  async destroy(): Promise<void> {
    console.log('[MediaPipeBlurTransformer] destroy() called');
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
    // Clean up cached frames to prevent memory leaks
    if (this.lastOutputFrame) {
      this.lastOutputFrame.close();
      this.lastOutputFrame = null;
    }
    this.initialized = false;
    this.previousMask = null;
    this.smoothedMaskBuffer = null;
    this.lastProcessedMask = null;
    this.frameCount = 0;
  }

  /**
   * Update method - required by LiveKit interface
   * Called when options need to be updated
   */
  update(options: Partial<MediaPipeBlurOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('[MediaPipeBlurTransformer] Options updated:', this.options);
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
        outputCategoryMask: this.options.outputCategoryMask ?? false,
        outputConfidenceMasks: this.options.outputConfidenceMasks ?? true,
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

    // Performance optimization: Skip segmentation for some frames, reuse last mask
    const shouldProcessSegmentation = this.frameCount % this.processEveryNFrames === 0;

    let personMask: ImageData;

    if (shouldProcessSegmentation || !this.lastProcessedMask) {
      // Run segmentation
      const segStart = performance.now();
      const segmentationResult = this.segmenter.segmentForVideo(
        inputFrame,
        Date.now()
      );
      const segTime = performance.now() - segStart;

      // Convert to person mask
      const convertStart = performance.now();
      // Use confidence masks if available for better quality
      if (this.options.outputConfidenceMasks && segmentationResult.confidenceMasks) {
        personMask = this.convertConfidenceMaskToPersonMask(
          segmentationResult.confidenceMasks,
          inputFrame.displayWidth,
          inputFrame.displayHeight
        );
      } else if (segmentationResult.categoryMask) {
        personMask = this.convertToPersonMask(
          segmentationResult.categoryMask,
          inputFrame.displayWidth,
          inputFrame.displayHeight
        );
      } else {
        throw new Error('No segmentation mask available');
      }
      const convertTime = performance.now() - convertStart;

      // Apply enhanced person detection if enabled
      if (this.options.enhancedPersonDetection?.enabled) {
        const enhanceStart = performance.now();
        personMask = processEnhancedPersonMask(
          personMask,
          this.options.enhancedPersonDetection
        );
        const enhanceTime = performance.now() - enhanceStart;

        if (this.frameCount === 1) {
          console.log(`[MediaPipeBlurTransformer] Enhanced person detection: ${enhanceTime.toFixed(1)}ms`);
        }
      }

      // Apply temporal smoothing
      const smoothStart = performance.now();
      personMask = this.applyTemporalSmoothing(personMask);
      const smoothTime = performance.now() - smoothStart;

      // Store for reuse
      this.lastProcessedMask = personMask;

      if (this.frameCount === 1) {
        console.log(`[MediaPipeBlurTransformer] ⚡ Performance breakdown:`);
        console.log(`  - Segmentation: ${segTime.toFixed(1)}ms`);
        console.log(`  - Mask conversion: ${convertTime.toFixed(1)}ms`);
        console.log(`  - Temporal smoothing: ${smoothTime.toFixed(1)}ms`);
        console.log(`  - Frame skip mode: Every ${this.processEveryNFrames} frames (50% CPU reduction)`);
      }
    } else {
      // Reuse last processed mask for better performance
      personMask = this.lastProcessedMask!;
    }

    // Apply blur to background
    const blurStart = performance.now();
    const outputFrame = this.applyBlurToBackground(
      inputFrame,
      personMask,
      this.options.blurRadius
    );
    const blurTime = performance.now() - blurStart;

    const processingTime = performance.now() - startTime;
    if (this.frameCount === 1) {
      console.log(`  - Blur application: ${blurTime.toFixed(1)}ms`);
      console.log(`[MediaPipeBlurTransformer] Total first frame: ${processingTime.toFixed(1)}ms`);
    } else if (this.frameCount % 60 === 0) {
      console.log(`[MediaPipeBlurTransformer] Frame ${this.frameCount} processed in ${processingTime.toFixed(1)}ms (skipping: ${!shouldProcessSegmentation})`);
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
   * Convert MediaPipe confidence masks to binary person mask
   * This provides higher quality segmentation with better edge definition
   */
  private convertConfidenceMaskToPersonMask(
    confidenceMasks: any[],
    width: number,
    height: number
  ): ImageData {
    const mask = new ImageData(width, height);
    const data = mask.data;

    // MediaPipe selfie_multiclass provides masks for:
    // 0: background, 1: hair, 2: body-skin, 3: face-skin, 4: clothes, 5: others
    // We want to combine all person-related masks (1-5)

    const allMasks: Float32Array[] = [];
    for (let i = 0; i < confidenceMasks.length; i++) {
      allMasks.push(confidenceMasks[i].getAsFloat32Array());
    }

    for (let i = 0; i < allMasks[0].length; i++) {
      // Start with background confidence (inverse it)
      let personConfidence = 0;

      // Sum all non-background masks (indices 1-5)
      for (let maskIdx = 1; maskIdx < allMasks.length; maskIdx++) {
        personConfidence = Math.max(personConfidence, allMasks[maskIdx][i]);
      }

      // Convert to 0-255 range with gamma correction for better edges
      // Apply slight gamma to enhance edges
      const gamma = 1.2;
      const value = Math.pow(personConfidence, 1 / gamma) * 255;

      const pixelIndex = i * 4;
      data[pixelIndex] = value;
      data[pixelIndex + 1] = value;
      data[pixelIndex + 2] = value;
      data[pixelIndex + 3] = 255;
    }

    return mask;
  }

  /**
   * Apply motion-aware temporal smoothing to reduce flickering while avoiding ghosting
   * Uses adaptive smoothing based on detected motion
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

    // Base alpha from options (lower = less ghosting)
    const baseAlpha = this.options.temporalSmoothingAlpha ?? 0.35;

    // Detect motion by computing mask difference
    let totalDifference = 0;
    let pixelCount = 0;
    for (let i = 0; i < current.length; i += 4) {
      const diff = Math.abs(current[i] - previous[i]);
      totalDifference += diff;
      pixelCount++;
    }
    const avgDifference = totalDifference / pixelCount;

    // Adaptive alpha: reduce temporal smoothing when motion detected
    // If motion is high (avgDifference > 20), use less smoothing to avoid ghosting
    // If motion is low (avgDifference < 5), use more smoothing to reduce flicker
    let adaptiveAlpha = baseAlpha;
    if (avgDifference > 20) {
      // High motion: reduce temporal smoothing by up to 50%
      adaptiveAlpha = baseAlpha * 0.5;
    } else if (avgDifference < 5) {
      // Low motion: can use slightly more smoothing
      adaptiveAlpha = Math.min(baseAlpha * 1.2, 0.5);
    }

    // Apply adaptive smoothing with per-pixel motion detection
    for (let i = 0; i < current.length; i += 4) {
      const pixelDiff = Math.abs(current[i] - previous[i]);

      // Per-pixel adaptive alpha: use current frame more when pixel changed significantly
      let pixelAlpha = adaptiveAlpha;
      if (pixelDiff > 30) {
        // Pixel changed significantly - trust current frame more
        pixelAlpha = Math.max(adaptiveAlpha * 0.6, 0.2);
      }

      const value = current[i] * pixelAlpha + previous[i] * (1 - pixelAlpha);
      output[i] = value;
      output[i + 1] = value;
      output[i + 2] = value;
      output[i + 3] = 255;
    }

    // Log motion detection occasionally
    if (this.frameCount % 60 === 0) {
      console.log(`[MediaPipeBlurTransformer] Motion: ${avgDifference.toFixed(1)}, Alpha: ${adaptiveAlpha.toFixed(2)}`);
    }

    this.previousMask.data.set(output);
    return this.smoothedMaskBuffer;
  }

  /**
   * Apply Gaussian blur to background using the person mask
   * With bilateral edge filtering for smoother transitions
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

    // Apply bilateral filtering to mask edges for smoother transitions
    const refinedMask = this.applyBilateralFilterToMask(mask, width, height);

    // Composite: use original where person is, blurred for background
    const output = this.ctx.createImageData(width, height);
    const maskData = refinedMask.data;
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
   * Apply bilateral filtering to mask for smoother edges
   * This creates better transitions at person-background boundaries
   */
  private applyBilateralFilterToMask(mask: ImageData, width: number, height: number): ImageData {
    const filtered = new ImageData(width, height);
    const inputData = mask.data;
    const outputData = filtered.data;

    // Bilateral filter parameters
    const spatialSigma = 3; // Spatial kernel size
    const intensitySigma = 25; // Intensity similarity threshold

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const centerValue = inputData[idx];

        let weightedSum = 0;
        let weightSum = 0;

        // Sample neighborhood
        for (let dy = -spatialSigma; dy <= spatialSigma; dy++) {
          for (let dx = -spatialSigma; dx <= spatialSigma; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            // Boundary check
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

            const nidx = (ny * width + nx) * 4;
            const neighborValue = inputData[nidx];

            // Spatial weight (Gaussian based on distance)
            const spatialDist = dx * dx + dy * dy;
            const spatialWeight = Math.exp(-spatialDist / (2 * spatialSigma * spatialSigma));

            // Intensity weight (Gaussian based on value similarity)
            const intensityDiff = centerValue - neighborValue;
            const intensityWeight = Math.exp(
              -(intensityDiff * intensityDiff) / (2 * intensitySigma * intensitySigma)
            );

            // Combined bilateral weight
            const weight = spatialWeight * intensityWeight;

            weightedSum += neighborValue * weight;
            weightSum += weight;
          }
        }

        const filteredValue = weightSum > 0 ? weightedSum / weightSum : centerValue;
        outputData[idx] = filteredValue;
        outputData[idx + 1] = filteredValue;
        outputData[idx + 2] = filteredValue;
        outputData[idx + 3] = 255;
      }
    }

    return filtered;
  }

}
