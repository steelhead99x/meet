/**
 * Advanced Mask Processing for Enhanced Person Detection
 * 
 * This module provides post-processing algorithms for segmentation masks
 * to reduce false detection of background objects and improve person detection quality.
 * 
 * Techniques implemented:
 * - Confidence-based thresholding
 * - Morphological operations (erosion/dilation) for noise removal
 * - Connected component analysis to isolate the main person
 * - Mask area filtering to remove tiny false detections
 */

/**
 * Process a segmentation mask with enhanced person detection algorithms
 * This improves person detection and reduces false positives from background objects
 * 
 * @deprecated This function is no longer used - LiveKit's built-in processors handle this
 * @param maskData - The segmentation mask ImageData (grayscale, 0-255)
 * @param config - Enhanced person detection configuration
 * @returns Processed mask with reduced false detections
 */
export function processEnhancedPersonMask(
  maskData: ImageData,
  config: any
): ImageData {
  // Stub implementation - no longer used
  return maskData;

  const { width, height } = maskData;
  const data = new Uint8ClampedArray(maskData.data);
  
  // Step 1: Apply confidence threshold to remove low-confidence detections
  applyConfidenceThreshold(data, config.confidenceThreshold);
  
  // Step 2: Apply morphological operations to remove noise
  if (config.morphologyEnabled) {
    // Erosion removes small noise and thin protrusions
    const eroded = morphologicalErosion(data, width, height, config.morphologyKernelSize);
    // Dilation restores the main object to approximately original size
    const dilated = morphologicalDilation(eroded, width, height, config.morphologyKernelSize);
    data.set(dilated);
  }
  
  // Step 3: Keep only the largest connected component (the main person)
  if (config.keepLargestComponentOnly) {
    keepLargestComponent(data, width, height);
  }
  
  // Step 4: Filter out masks that are too small (likely false detections)
  const maskArea = calculateMaskArea(data);
  const totalArea = width * height;
  const maskRatio = maskArea / totalArea;
  
  if (maskRatio < config.minMaskAreaRatio) {
    // Mask is too small, likely a false detection - clear it
    console.log(`[MaskProcessor] Mask too small (${(maskRatio * 100).toFixed(1)}% < ${(config.minMaskAreaRatio * 100).toFixed(1)}%), clearing`);
    data.fill(0);
  }
  
  // Create new ImageData with processed mask
  const processed = new ImageData(width, height);
  processed.data.set(data);
  
  return processed;
}

/**
 * Apply confidence threshold to mask
 * Values below threshold are set to 0, values above are set to 255
 */
function applyConfidenceThreshold(data: Uint8ClampedArray, threshold: number): void {
  const thresholdValue = threshold * 255;
  
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i];
    if (value < thresholdValue) {
      // Below threshold - not confident, set to background
      data[i] = data[i + 1] = data[i + 2] = 0;
    } else {
      // Above threshold - confident, set to foreground
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
    data[i + 3] = 255; // Alpha channel
  }
}

/**
 * Morphological erosion - removes small noise and thin features
 * Shrinks the foreground regions
 */
function morphologicalErosion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernelSize: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Check if all pixels in the kernel neighborhood are foreground
      let allForeground = true;
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const nx = x + kx;
          const ny = y + ky;
          
          // Skip out of bounds
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            allForeground = false;
            continue;
          }
          
          const nidx = (ny * width + nx) * 4;
          if (data[nidx] < 128) {
            allForeground = false;
            break;
          }
        }
        if (!allForeground) break;
      }
      
      // Set pixel value based on kernel check
      const value = allForeground ? 255 : 0;
      result[idx] = result[idx + 1] = result[idx + 2] = value;
      result[idx + 3] = 255;
    }
  }
  
  return result;
}

/**
 * Morphological dilation - expands foreground regions
 * Restores size after erosion and fills small holes
 */
function morphologicalDilation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernelSize: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Check if any pixel in the kernel neighborhood is foreground
      let anyForeground = false;
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const nx = x + kx;
          const ny = y + ky;
          
          // Skip out of bounds
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue;
          }
          
          const nidx = (ny * width + nx) * 4;
          if (data[nidx] >= 128) {
            anyForeground = true;
            break;
          }
        }
        if (anyForeground) break;
      }
      
      // Set pixel value based on kernel check
      const value = anyForeground ? 255 : 0;
      result[idx] = result[idx + 1] = result[idx + 2] = value;
      result[idx + 3] = 255;
    }
  }
  
  return result;
}

/**
 * Keep only the largest connected component in the mask
 * This isolates the main person and removes disconnected background objects
 */
function keepLargestComponent(data: Uint8ClampedArray, width: number, height: number): void {
  const visited = new Uint8Array(width * height);
  let largestComponentSize = 0;
  let largestComponentPixels: number[] = [];
  
  // Find all connected components using flood fill
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const visitIdx = y * width + x;
      
      // Skip if already visited or is background
      if (visited[visitIdx] || data[idx] < 128) {
        continue;
      }
      
      // Flood fill to find connected component
      const componentPixels = floodFill(data, visited, x, y, width, height);
      
      // Track the largest component
      if (componentPixels.length > largestComponentSize) {
        largestComponentSize = componentPixels.length;
        largestComponentPixels = componentPixels;
      }
    }
  }
  
  // Clear all pixels
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = 0;
    data[i + 3] = 255;
  }
  
  // Restore only the largest component
  for (const pixelIdx of largestComponentPixels) {
    const idx = pixelIdx * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = 255;
    data[idx + 3] = 255;
  }
  
  // Reduced logging - only log occasionally to avoid console spam
  if (Math.random() < 0.03) { // Log ~3% of frames
    console.log(`[MaskProcessor] Kept largest component: ${largestComponentSize} pixels`);
  }
}

/**
 * Flood fill algorithm to find connected components
 */
function floodFill(
  data: Uint8ClampedArray,
  visited: Uint8Array,
  startX: number,
  startY: number,
  width: number,
  height: number
): number[] {
  const pixels: number[] = [];
  const queue: [number, number][] = [[startX, startY]];
  
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const visitIdx = y * width + x;
    
    // Skip if out of bounds or already visited
    if (x < 0 || x >= width || y < 0 || y >= height || visited[visitIdx]) {
      continue;
    }
    
    const idx = (y * width + x) * 4;
    
    // Skip if background
    if (data[idx] < 128) {
      continue;
    }
    
    // Mark as visited and add to component
    visited[visitIdx] = 1;
    pixels.push(visitIdx);
    
    // Add neighbors to queue (4-connectivity)
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }
  
  return pixels;
}

/**
 * Calculate the total mask area (number of foreground pixels)
 */
function calculateMaskArea(data: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= 128) {
      count++;
    }
  }
  return count;
}

/**
 * Create a custom background processor that applies enhanced person detection
 * This wraps the standard LiveKit processor with additional mask processing
 * 
 * Note: This is a conceptual implementation. In practice, LiveKit's BackgroundProcessor
 * doesn't expose direct mask manipulation, so these algorithms would need to be
 * integrated at a lower level or through a custom processor implementation.
 */
export function createEnhancedBackgroundProcessor(
  standardProcessor: any,
  config: BlurConfig['enhancedPersonDetection']
): any {
  // This would require extending or wrapping the LiveKit processor
  // For now, we document the approach for future integration
  console.log('[MaskProcessor] Enhanced person detection config:', config);
  return standardProcessor;
}

/**
 * Get a human-readable summary of enhanced person detection settings
 */
export function getEnhancedDetectionSummary(config: BlurConfig['enhancedPersonDetection']): string {
  if (!config || !config.enabled) {
    return 'Standard person detection';
  }
  
  const features: string[] = [];
  features.push(`${(config.confidenceThreshold * 100).toFixed(0)}% confidence threshold`);
  
  if (config.morphologyEnabled) {
    features.push(`noise removal (kernel: ${config.morphologyKernelSize}px)`);
  }
  
  if (config.keepLargestComponentOnly) {
    features.push('single person focus');
  }
  
  features.push(`min area: ${(config.minMaskAreaRatio * 100).toFixed(1)}%`);
  
  return `Enhanced detection: ${features.join(', ')}`;
}

