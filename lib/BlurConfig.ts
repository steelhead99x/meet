/**
 * Simple Blur Configuration Module
 * 
 * This module provides basic background blur configuration using LiveKit's built-in processors.
 */

/**
 * Blur quality mode options (kept for backwards compatibility with settings)
 */
export type BlurQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Simple blur configuration - uses LiveKit's BackgroundProcessor directly
 */
export interface BlurConfig {
  blurRadius: number;
}

/**
 * Stub type for backwards compatibility with SettingsMenu
 * @deprecated Custom segmentation settings are no longer supported
 */
export interface CustomSegmentationSettings {
  blurRadius: number;
  edgeFeather: number;
  temporalSmoothing: boolean;
  useGPU: boolean;
  enableEdgeRefinement: boolean;
  useEnhancedPersonModel: boolean;
  mediaPipeSettings?: {
    confidenceThreshold: number;
    morphologyEnabled: boolean;
    morphologyKernelSize: number;
    keepLargestComponentOnly: boolean;
    minMaskAreaRatio: number;
    temporalSmoothingAlpha: number;
  };
}

/**
 * Simple blur radius values based on quality
 */
const BLUR_RADIUS: Record<BlurQuality, number> = {
  low: 10,
  medium: 15,
  high: 25,
  ultra: 40,
};

/**
 * Gets a simple blur configuration
 */
export function getBlurConfig(quality: BlurQuality = 'medium'): BlurConfig {
  return {
    blurRadius: BLUR_RADIUS[quality],
  };
}

/**
 * Gets a human-readable description of a blur quality level
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
 * Gets performance impact estimate (stub for backwards compatibility)
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

/**
 * Creates custom settings from preset (stub for backwards compatibility)
 */
export function customSettingsFromPreset(quality: BlurQuality): CustomSegmentationSettings {
  return {
    blurRadius: BLUR_RADIUS[quality],
    edgeFeather: 0.25,
    temporalSmoothing: true,
    useGPU: true,
    enableEdgeRefinement: false,
    useEnhancedPersonModel: false,
  };
}

/**
 * Default custom settings (stub for backwards compatibility)
 */
const DEFAULT_CUSTOM_SETTINGS: CustomSegmentationSettings = {
  blurRadius: 15,
  edgeFeather: 0.25,
  temporalSmoothing: true,
  useGPU: true,
  enableEdgeRefinement: false,
  useEnhancedPersonModel: false,
};

/**
 * Gets default custom settings (stub for backwards compatibility)
 */
export function getDefaultCustomSettings(): CustomSegmentationSettings {
  return { ...DEFAULT_CUSTOM_SETTINGS };
}
