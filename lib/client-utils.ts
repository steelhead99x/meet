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
 * Detects if the current device has limited CPU resources.
 * Uses hardware concurrency (CPU cores) to determine low-power status.
 * 
 * @returns true if device has fewer than 6 CPU cores
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
