/**
 * Advanced Blur Configuration Module
 * 
 * This module provides sophisticated background blur configurations optimized for
 * different device capabilities. It includes:
 * - High-quality mode with advanced edge smoothing
 * - Medium-quality mode for balanced performance
 * - Low-quality mode for resource-constrained devices
 * - Custom canvas-based edge refinement
 */

import { BackgroundOptions } from '@livekit/track-processors';
import { DeviceCapabilities } from './client-utils';

/**
 * Blur quality mode options
 */
export type BlurQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Configuration for blur processor
 */
export interface BlurConfig {
  /** Blur radius in pixels - higher values create stronger blur */
  blurRadius: number;
  /** Which segmentation processor to use */
  processorType?: 'livekit-default' | 'mediapipe-image' | 'mediapipe-image-segmenter' | 'modnet';
  /** Segmentation options for MediaPipe */
  segmenterOptions: {
    /** GPU or CPU delegation */
    delegate: 'GPU' | 'CPU';
    /**
     * Use a custom high-quality person segmentation model
     * This can significantly improve person detection accuracy
     */
    modelAssetPath?: string;
    /** Output category mask for multi-class segmentation (hair, body, face, clothes) */
    outputCategoryMask?: boolean;
    /** Output confidence masks for each category */
    outputConfidenceMasks?: boolean;
  };
  /** Edge refinement settings */
  edgeRefinement: {
    /** Enable edge smoothing post-processing */
    enabled: boolean;
    /** Feather amount for edge softening (0-1) */
    featherAmount: number;
    /** Enable temporal smoothing between frames */
    temporalSmoothing: boolean;
    /** Temporal smoothing factor (0-1) - higher = more smoothing */
    temporalSmoothingFactor?: number;
  };
  /** Enhanced person detection settings */
  enhancedPersonDetection?: {
    /** Enable enhanced person detection mode */
    enabled: boolean;
    /** Minimum confidence threshold (0-1) - higher values reduce false positives */
    confidenceThreshold: number;
    /** Remove small isolated regions (noise reduction) */
    morphologyEnabled: boolean;
    /** Size of morphology kernel for noise removal */
    morphologyKernelSize: number;
    /** Keep only the largest connected component (the main person) */
    keepLargestComponentOnly: boolean;
    /** Minimum mask area ratio to be considered valid (0-1) */
    minMaskAreaRatio: number;
    /** Enable temporal consistency to reduce flicker */
    temporalConsistency?: boolean;
  };
}

/**
 * Custom adjustable segmentation settings
 * These override preset values when user wants fine control
 */
export interface CustomSegmentationSettings {
  /** Custom blur radius (10-100) */
  blurRadius: number;
  /** Edge feather amount (0-1) - higher = softer edges */
  edgeFeather: number;
  /** Enable temporal smoothing to reduce flickering */
  temporalSmoothing: boolean;
  /** Use GPU acceleration (recommended) */
  useGPU: boolean;
  /** Enable edge refinement post-processing */
  enableEdgeRefinement: boolean;
  /** 
   * Use enhanced person segmentation model
   * Significantly improves person detection and reduces false positives
   * from background objects
   */
  useEnhancedPersonModel: boolean;
  
  /** 
   * MediaPipe Image Segmenter specific settings 
   * These only apply when using MediaPipe processor (High/Ultra quality)
   */
  mediaPipeSettings?: {
    /** Confidence threshold for person detection (0.5-0.95) - higher = stricter */
    confidenceThreshold: number;
    /** Enable morphology to remove noise (recommended) */
    morphologyEnabled: boolean;
    /** Morphology kernel size (3-9) - larger removes more noise */
    morphologyKernelSize: number;
    /** Keep only the largest person detected */
    keepLargestComponentOnly: boolean;
    /** Minimum mask area ratio (0.01-0.1) - filters out tiny detections */
    minMaskAreaRatio: number;
    /** Temporal smoothing alpha (0.5-0.9) - higher = more smoothing */
    temporalSmoothingAlpha: number;
  };
}

/**
 * Preset configurations for different quality levels
 */
export const BLUR_PRESETS: Record<BlurQuality, BlurConfig> = {
  /**
   * LOW QUALITY - Mobile and low-power devices
   * - Minimal blur for performance
   * - CPU processing as fallback
   * - Basic edge handling
   * - Uses LiveKit default for reliability
   */
  low: {
    blurRadius: 15,
    processorType: 'livekit-default',
    segmenterOptions: {
      delegate: 'CPU',
    },
    edgeRefinement: {
      enabled: false,
      featherAmount: 0.1,
      temporalSmoothing: false,
    },
    enhancedPersonDetection: {
      enabled: false,
      confidenceThreshold: 0.6,
      morphologyEnabled: false,
      morphologyKernelSize: 3,
      keepLargestComponentOnly: false,
      minMaskAreaRatio: 0.01,
    },
  },

  /**
   * MEDIUM QUALITY - Standard laptops and tablets
   * - Moderate blur with GPU acceleration
   * - Basic edge smoothing
   * - Good balance of quality and performance
   * - Uses LiveKit default for reliability
   */
  medium: {
    blurRadius: 45,
    processorType: 'livekit-default',
    segmenterOptions: {
      delegate: 'GPU',
    },
    edgeRefinement: {
      enabled: false,
      featherAmount: 0.2,
      temporalSmoothing: false,
    },
    enhancedPersonDetection: {
      enabled: false,
      confidenceThreshold: 0.65,
      morphologyEnabled: true,
      morphologyKernelSize: 3,
      keepLargestComponentOnly: false,
      minMaskAreaRatio: 0.01,
    },
  },

  /**
   * HIGH QUALITY - Modern desktops with good GPUs
   * - Strong blur with advanced edge smoothing
   * - GPU-accelerated processing
   * - Enhanced edge refinement
   * - Uses MediaPipe Image Segmenter with ProcessorWrapper
   */
  high: {
    blurRadius: 90,
    processorType: 'livekit-default',
    segmenterOptions: {
      delegate: 'GPU',
    },
    edgeRefinement: {
      enabled: false,
      featherAmount: 0.35,
      temporalSmoothing: false,
    },
    enhancedPersonDetection: {
      enabled: false,
      confidenceThreshold: 0.7,
      morphologyEnabled: true,
      morphologyKernelSize: 5,
      keepLargestComponentOnly: true,
      minMaskAreaRatio: 0.02,
    },
  },

  /**
   * ULTRA QUALITY - High-end desktops with powerful GPUs
   * - Maximum blur for best background separation
   * - Advanced edge processing
   * - Utilizes all available GPU resources
   * - Uses LiveKit default for reliability
   */
  ultra: {
    blurRadius: 150,
    processorType: 'livekit-default',
    segmenterOptions: {
      delegate: 'GPU',
    },
    edgeRefinement: {
      enabled: false,
      featherAmount: 0.35,
      temporalSmoothing: false,
    },
    enhancedPersonDetection: {
      enabled: false,
      confidenceThreshold: 0.7,
      morphologyEnabled: false,
      morphologyKernelSize: 3,
      keepLargestComponentOnly: false,
      minMaskAreaRatio: 0.02,
    },
  },
};

/**
 * Automatically determines the best blur quality based on device capabilities
 * 
 * @param capabilities - Device capabilities from detectDeviceCapabilities()
 * @returns Recommended blur quality level
 */
export function getRecommendedBlurQuality(capabilities: DeviceCapabilities): BlurQuality {
  const { powerLevel, hasGPU, cpuCores, deviceMemoryGB } = capabilities;

  // Ultra quality: High-end desktops with excellent specs
  if (
    powerLevel === 'high' &&
    hasGPU &&
    cpuCores >= 12 &&
    (deviceMemoryGB === null || deviceMemoryGB >= 16)
  ) {
    return 'ultra';
  }

  // High quality: Good desktops and high-end laptops
  if (powerLevel === 'high' || (powerLevel === 'medium' && hasGPU && cpuCores >= 8)) {
    return 'high';
  }

  // Medium quality: Mid-range devices
  if (powerLevel === 'medium' && hasGPU) {
    return 'medium';
  }

  // Low quality: Mobile and low-power devices
  return 'low';
}

/**
 * Gets the blur configuration for a specific quality level
 * 
 * @param quality - Desired blur quality level
 * @param customSettings - Optional custom settings to override preset
 * @returns Complete blur configuration
 */
export function getBlurConfig(quality: BlurQuality, customSettings?: CustomSegmentationSettings | null): BlurConfig {
  const preset = { ...BLUR_PRESETS[quality] };
  
  // Apply custom settings if provided
  if (customSettings) {
    const config: BlurConfig = {
      blurRadius: customSettings.blurRadius,
      processorType: preset.processorType, // Inherit from preset
      segmenterOptions: {
        delegate: customSettings.useGPU ? 'GPU' : 'CPU',
      },
      edgeRefinement: {
        enabled: customSettings.enableEdgeRefinement,
        featherAmount: customSettings.edgeFeather,
        temporalSmoothing: customSettings.temporalSmoothing,
      },
    };
    
    // Add enhanced person detection if enabled
    if (customSettings.useEnhancedPersonModel && customSettings.mediaPipeSettings) {
      // Use custom MediaPipe settings if provided
      const mp = customSettings.mediaPipeSettings;
      config.enhancedPersonDetection = {
        enabled: true,
        confidenceThreshold: mp.confidenceThreshold,
        morphologyEnabled: mp.morphologyEnabled,
        morphologyKernelSize: mp.morphologyKernelSize,
        keepLargestComponentOnly: mp.keepLargestComponentOnly,
        minMaskAreaRatio: mp.minMaskAreaRatio,
      };
    } else if (customSettings.useEnhancedPersonModel) {
      // Use default enhanced settings if MediaPipe settings not specified
      config.enhancedPersonDetection = {
        enabled: true,
        confidenceThreshold: 0.7,
        morphologyEnabled: true,
        morphologyKernelSize: 5,
        keepLargestComponentOnly: true,
        minMaskAreaRatio: 0.02,
      };
    } else {
      config.enhancedPersonDetection = {
        enabled: false,
        confidenceThreshold: 0.5,
        morphologyEnabled: false,
        morphologyKernelSize: 3,
        keepLargestComponentOnly: false,
        minMaskAreaRatio: 0.01,
      };
    }
    
    return config;
  }
  
  return preset;
}

/**
 * Creates custom segmentation settings from a quality preset
 * Useful as a starting point for user customization
 */
export function customSettingsFromPreset(quality: BlurQuality): CustomSegmentationSettings {
  const preset = BLUR_PRESETS[quality];
  return {
    blurRadius: preset.blurRadius,
    edgeFeather: preset.edgeRefinement.featherAmount,
    temporalSmoothing: preset.edgeRefinement.temporalSmoothing,
    useGPU: preset.segmenterOptions.delegate === 'GPU',
    enableEdgeRefinement: preset.edgeRefinement.enabled,
    useEnhancedPersonModel: true, // Enable by default for better person detection
    mediaPipeSettings: preset.enhancedPersonDetection ? {
      confidenceThreshold: preset.enhancedPersonDetection.confidenceThreshold,
      morphologyEnabled: preset.enhancedPersonDetection.morphologyEnabled,
      morphologyKernelSize: preset.enhancedPersonDetection.morphologyKernelSize,
      keepLargestComponentOnly: preset.enhancedPersonDetection.keepLargestComponentOnly,
      minMaskAreaRatio: preset.enhancedPersonDetection.minMaskAreaRatio,
      temporalSmoothingAlpha: 0.7, // Default temporal smoothing
    } : undefined,
  };
}

/**
 * Gets default custom segmentation settings
 */
export function getDefaultCustomSettings(): CustomSegmentationSettings {
  return {
    blurRadius: 35,
    edgeFeather: 0.25,
    temporalSmoothing: true,
    useGPU: true,
    enableEdgeRefinement: true,
    useEnhancedPersonModel: true, // Enable by default for better person detection
    mediaPipeSettings: {
      confidenceThreshold: 0.7,
      morphologyEnabled: true,
      morphologyKernelSize: 5,
      keepLargestComponentOnly: true,
      minMaskAreaRatio: 0.02,
      temporalSmoothingAlpha: 0.7,
    },
  };
}

/**
 * Custom edge refinement processor
 * This creates a smoother transition at the edges of the segmentation mask
 * 
 * Note: This is a conceptual implementation. Actual edge refinement would need
 * to be integrated with the LiveKit BackgroundProcessor or applied as a 
 * post-processing step in a custom processor.
 */
export class EdgeRefinementProcessor {
  private previousMask: ImageData | null = null;
  private config: BlurConfig['edgeRefinement'];

  constructor(config: BlurConfig['edgeRefinement']) {
    this.config = config;
  }

  /**
   * Applies edge refinement to a segmentation mask
   * 
   * @param mask - The segmentation mask to refine
   * @returns Refined mask with smoother edges
   */
  refineMask(mask: ImageData): ImageData {
    if (!this.config.enabled) {
      return mask;
    }

    const refined = new ImageData(mask.width, mask.height);
    const data = mask.data;
    const refinedData = refined.data;

    // Apply Gaussian-like smoothing to edges
    const kernelSize = Math.max(3, Math.floor(this.config.featherAmount * 20));
    
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        const idx = (y * mask.width + x) * 4;
        
        // Sample surrounding pixels for smoothing
        let sum = 0;
        let count = 0;
        
        for (let ky = -kernelSize; ky <= kernelSize; ky++) {
          for (let kx = -kernelSize; kx <= kernelSize; kx++) {
            const sx = x + kx;
            const sy = y + ky;
            
            if (sx >= 0 && sx < mask.width && sy >= 0 && sy < mask.height) {
              const sidx = (sy * mask.width + sx) * 4;
              const dist = Math.sqrt(kx * kx + ky * ky);
              const weight = Math.exp(-(dist * dist) / (2 * kernelSize * kernelSize));
              
              sum += data[sidx] * weight;
              count += weight;
            }
          }
        }
        
        const smoothed = sum / count;
        
        // Apply temporal smoothing if enabled
        let finalValue = smoothed;
        if (this.config.temporalSmoothing && this.previousMask) {
          const prevValue = this.previousMask.data[idx];
          // Blend with previous frame (70% current, 30% previous)
          finalValue = smoothed * 0.7 + prevValue * 0.3;
        }
        
        refinedData[idx] = finalValue;
        refinedData[idx + 1] = finalValue;
        refinedData[idx + 2] = finalValue;
        refinedData[idx + 3] = 255;
      }
    }

    // Store for next frame
    if (this.config.temporalSmoothing) {
      this.previousMask = refined;
    }

    return refined;
  }

  /**
   * Resets the temporal smoothing buffer
   */
  reset(): void {
    this.previousMask = null;
  }
}

/**
 * Gets a human-readable description of a blur quality level
 * 
 * @param quality - Blur quality level
 * @returns Description string
 */
export function getBlurQualityDescription(quality: BlurQuality): string {
  const descriptions: Record<BlurQuality, string> = {
    low: 'Low Quality - Best for mobile devices and slower connections',
    medium: 'Medium Quality - Balanced performance and quality',
    high: 'High Quality - Enhanced blur with smooth edges',
    ultra: 'Ultra Quality - Maximum quality for high-end systems',
  };
  return descriptions[quality];
}

/**
 * Estimates the performance impact of a blur quality level
 * 
 * @param quality - Blur quality level
 * @returns Performance impact description
 */
export function getPerformanceImpact(quality: BlurQuality): {
  cpuUsage: 'low' | 'medium' | 'high' | 'very-high';
  gpuUsage: 'low' | 'medium' | 'high' | 'very-high';
  memoryUsage: 'low' | 'medium' | 'high';
} {
  const impacts = {
    low: { cpuUsage: 'low' as const, gpuUsage: 'low' as const, memoryUsage: 'low' as const },
    medium: { cpuUsage: 'medium' as const, gpuUsage: 'medium' as const, memoryUsage: 'medium' as const },
    high: { cpuUsage: 'high' as const, gpuUsage: 'high' as const, memoryUsage: 'high' as const },
    ultra: { cpuUsage: 'very-high' as const, gpuUsage: 'very-high' as const, memoryUsage: 'high' as const },
  };
  return impacts[quality];
}

