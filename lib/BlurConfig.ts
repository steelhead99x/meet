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
 * Blur radius values optimized to prevent jitter
 * Desktop/MacBook uses lower values with CPU for stability
 * Mobile devices can use higher values with GPU
 */
const BLUR_RADIUS: Record<BlurQuality, number> = {
  low: 10,      // Minimal blur for maximum stability
  medium: 15,    // Low blur for desktop stability (reduced from 25)
  high: 20,      // Moderate blur for desktop (reduced from 45)
  ultra: 30,     // Higher blur but still conservative for desktop (reduced from 75)
};

/**
 * Device-specific blur radius values for better performance
 * Desktop/MacBook uses much lower values to prevent jitter
 */
const BLUR_RADIUS_DESKTOP: Record<BlurQuality, number> = {
  low: 10,      // Minimal for stability
  medium: 15,    // Very low to prevent jitter
  high: 20,      // Conservative for smooth performance
  ultra: 25,     // Still conservative to avoid frame drops
};

/**
 * Detects if device is desktop/MacBook (likely to have jitter issues)
 */
function isDesktopDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMac = /macintosh|mac os x/.test(userAgent);
  const isDesktop = !/iphone|ipod|ipad|android/.test(userAgent);
  return isMac || (isDesktop && window.innerWidth > 768);
}

/**
 * Gets a simple blur configuration
 * Uses lower values for desktop/MacBook to prevent jitter
 */
export function getBlurConfig(quality: BlurQuality = 'medium'): BlurConfig {
  const isDesktop = isDesktopDevice();
  const radiusMap = isDesktop ? BLUR_RADIUS_DESKTOP : BLUR_RADIUS;
  return {
    blurRadius: radiusMap[quality],
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
