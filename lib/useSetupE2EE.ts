import React from 'react';
import { ExternalE2EEKeyProvider } from 'livekit-client';
import { decodePassphrase } from './client-utils';

/**
 * Sets up End-to-End Encryption (E2EE) for a LiveKit room.
 * Extracts the E2EE passphrase from the URL hash and creates a Web Worker
 * for encryption/decryption operations.
 * 
 * The passphrase is expected to be in the URL hash (e.g., #passphrase).
 * If no passphrase is present, E2EE will be disabled.
 * 
 * @returns Object containing the E2EE worker and passphrase
 * @returns worker - Web Worker for E2EE operations (undefined if disabled)
 * @returns e2eePassphrase - Decoded passphrase from URL hash (undefined if not present)
 * 
 * @example
 * ```tsx
 * const { worker, e2eePassphrase } = useSetupE2EE();
 * const e2eeEnabled = !!(worker && e2eePassphrase);
 * ```
 */
export function useSetupE2EE(): { worker: Worker | undefined; e2eePassphrase: string | undefined } {
  const e2eePassphrase =
    typeof window !== 'undefined' ? decodePassphrase(location.hash.substring(1)) : undefined;

  const worker: Worker | undefined =
    typeof window !== 'undefined' && e2eePassphrase
      ? new Worker(new URL('livekit-client/e2ee-worker', import.meta.url))
      : undefined;

  return { worker, e2eePassphrase };
}
