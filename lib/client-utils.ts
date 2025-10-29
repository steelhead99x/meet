/**
 * Encodes a passphrase for safe URL transmission.
 * Used for E2EE passphrase encoding in URL hash.
 * 
 * @param passphrase - The passphrase to encode
 * @returns URL-encoded passphrase string
 */
export function encodePassphrase(passphrase: string): string {
  return encodeURIComponent(passphrase);
}

/**
 * Decodes a passphrase from URL encoding.
 * Used for E2EE passphrase decoding from URL hash.
 * 
 * @param base64String - The encoded passphrase string
 * @returns Decoded passphrase string
 */
export function decodePassphrase(base64String: string): string {
  return decodeURIComponent(base64String);
}

/**
 * Generates a random room ID in the format: xxxx-xxxx.
 * Used for creating unique room identifiers.
 * 
 * @returns Random room ID string (e.g., "a3f4-k2j9")
 */
export function generateRoomId(): string {
  return `${randomString(4)}-${randomString(4)}`;
}

/**
 * Generates a random alphanumeric string of specified length.
 * 
 * @param length - The desired length of the random string
 * @returns Random string containing lowercase letters and numbers
 */
export function randomString(length: number): string {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Device capability information
 */
export interface DeviceCapabilities {
  /** Number of logical CPU cores */
  cpuCores: number;
  /** Estimated device memory in GB (if available) */
  deviceMemoryGB: number | null;
  /** Whether the device has GPU acceleration available */
  hasGPU: boolean;
  /** Device type classification */
  deviceType: 'mobile' | 'tablet' | 'desktop';
  /** Overall power classification */
  powerLevel: 'low' | 'medium' | 'high';
}

/**
 * Detects comprehensive device capabilities including CPU, GPU, memory, and device type.
 * This provides detailed information for adaptive performance optimization.
 * 
 * @returns DeviceCapabilities object with detailed device information
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  // CPU cores detection
  const cpuCores = navigator.hardwareConcurrency || 4; // Default to 4 if unavailable
  
  // Memory detection (Chrome only feature)
  // @ts-ignore - deviceMemory is not in standard TS types
  const deviceMemoryGB = navigator.deviceMemory || null;
  
  // GPU detection - check for WebGL support as a proxy for GPU capability
  let hasGPU = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    hasGPU = !!gl;
  } catch (e) {
    hasGPU = false;
  }
  
  // Device type detection based on screen size and user agent
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipod|android.*mobile/.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)/.test(userAgent);
  
  if (isMobile) {
    deviceType = 'mobile';
  } else if (isTablet) {
    deviceType = 'tablet';
  } else {
    deviceType = 'desktop';
  }
  
  // Determine overall power level
  let powerLevel: 'low' | 'medium' | 'high' = 'medium';
  
  // High power: Desktop with 8+ cores, GPU, and 8GB+ RAM
  if (deviceType === 'desktop' && cpuCores >= 8 && hasGPU && (deviceMemoryGB === null || deviceMemoryGB >= 8)) {
    powerLevel = 'high';
  }
  // Low power: Mobile devices, or any device with <4 cores or <4GB RAM
  else if (deviceType === 'mobile' || cpuCores < 4 || (deviceMemoryGB !== null && deviceMemoryGB < 4)) {
    powerLevel = 'low';
  }
  // Medium power: Everything else (tablets, laptops, mid-range desktops)
  else {
    powerLevel = 'medium';
  }
  
  return {
    cpuCores,
    deviceMemoryGB,
    hasGPU,
    deviceType,
    powerLevel,
  };
}

/**
 * Detects if the current device has limited CPU resources.
 * Uses hardware concurrency (CPU cores) to determine low-power status.
 * 
 * @returns true if device has fewer than 6 CPU cores
 * @deprecated Use detectDeviceCapabilities() for more comprehensive detection
 */
export function isLowPowerDevice(): boolean {
  return navigator.hardwareConcurrency < 6;
}

/**
 * Checks if the app is running on the LiveKit Meet staging environment.
 * 
 * @returns true if running on meet.staging.livekit.io
 */
export function isMeetStaging(): boolean {
  return new URL(location.origin).host === 'meet.staging.livekit.io';
}
