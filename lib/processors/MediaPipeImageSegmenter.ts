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
  
  // Temporal smoothing
  private previousMask: ImageData | null = null;
  private frameCount: number = 0;
  
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
    if (this.initialized) return;
    
    try {
      console.log('[MediaPipeImageSegmenter] Initializing...');
      
      // Dynamic import to avoid loading if not used
      const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
      
      // Initialize WASM runtime
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      
      // Create segmenter with multiclass model
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
      console.log('[MediaPipeImageSegmenter] ✅ Initialized successfully');
    } catch (error) {
      console.error('[MediaPipeImageSegmenter] ❌ Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Process a video frame with segmentation and blur
   */
  async processFrame(inputFrame: VideoFrame): Promise<VideoFrame> {
    if (!this.initialized) {
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
      if (this.frameCount % 30 === 0) {
        console.log(`[MediaPipeImageSegmenter] Processing time: ${processingTime.toFixed(1)}ms`);
      }
      
      return outputFrame;
    } catch (error) {
      console.error('[MediaPipeImageSegmenter] Frame processing error:', error);
      // Return original frame on error
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
   */
  private applyTemporalSmoothing(currentMask: ImageData): ImageData {
    if (!this.previousMask) {
      this.previousMask = currentMask;
      return currentMask;
    }
    
    const smoothed = new ImageData(currentMask.width, currentMask.height);
    const current = currentMask.data;
    const previous = this.previousMask.data;
    const output = smoothed.data;
    
    // IIR filter: output = alpha * current + (1 - alpha) * previous
    // This smooths out rapid changes while staying responsive
    // Use custom alpha if provided, otherwise default to 0.7
    const alpha = this.config.temporalSmoothingAlpha ?? 0.7;
    
    for (let i = 0; i < current.length; i += 4) {
      const value = current[i] * alpha + previous[i] * (1 - alpha);
      output[i] = value;
      output[i + 1] = value;
      output[i + 2] = value;
      output[i + 3] = 255;
    }
    
    this.previousMask = smoothed;
    return smoothed;
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
      
      // Linear interpolation between blurred and original
      outputData[i] = blurredData[i] * (1 - maskValue) + originalData[i] * maskValue;
      outputData[i + 1] = blurredData[i + 1] * (1 - maskValue) + originalData[i + 1] * maskValue;
      outputData[i + 2] = blurredData[i + 2] * (1 - maskValue) + originalData[i + 2] * maskValue;
      outputData[i + 3] = 255;
    }
    
    // Put composited image back on canvas
    this.ctx.putImageData(output, 0, 0);
    
    // Create new VideoFrame from canvas
    // Note: In real implementation, this would use more efficient methods
    // like transferring to VideoFrame directly
    return new VideoFrame(this.canvas, {
      timestamp: inputFrame.timestamp,
    });
  }
  
  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.segmenter) {
      this.segmenter.close();
      this.segmenter = null;
    }
    this.initialized = false;
    this.previousMask = null;
    console.log('[MediaPipeImageSegmenter] Destroyed');
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

