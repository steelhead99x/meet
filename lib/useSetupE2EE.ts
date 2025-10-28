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
export function useSetupE2EE(): { worker: Worker | undefined; e2eePassphrase: string | undefined; isResolved: boolean } {
  const [e2eePassphrase, setE2eePassphrase] = React.useState<string | undefined>(undefined);
  const [isResolved, setIsResolved] = React.useState<boolean>(false);

  // Resolve passphrase from URL hash first; otherwise fetch a daily key from the server
  React.useEffect(() => {
    let timer: number | undefined;

    const resolvePassphrase = async () => {
      try {
        if (typeof window !== 'undefined') {
          const fromHash = location.hash.substring(1);
          if (fromHash && fromHash.length > 0) {
            setE2eePassphrase(decodePassphrase(fromHash));
            setIsResolved(true);
            return;
          }
        }

        // No URL hash provided; fetch shared daily key that rotates at UTC midnight
        const res = await fetch('/api/e2ee-key');
        if (!res.ok) throw new Error(`Failed to fetch E2EE key: ${res.status}`);
        const data: { passphrase: string; validUntilISO?: string } = await res.json();
        setE2eePassphrase(data.passphrase);
        setIsResolved(true);

        // Schedule a refresh at the server-provided rotation time if present
        if (typeof window !== 'undefined' && data.validUntilISO) {
          const ms = new Date(data.validUntilISO).getTime() - Date.now();
          if (ms > 0 && ms < 36 * 60 * 60 * 1000) {
            timer = window.setTimeout(resolvePassphrase, ms + 1000);
          }
        }
      } catch (err) {
        console.error('E2EE passphrase resolution failed:', err);
        setE2eePassphrase(undefined);
        setIsResolved(true);
      }
    };

    resolvePassphrase();
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  const worker = React.useMemo(() => {
    if (typeof window === 'undefined' || !e2eePassphrase) {
      return undefined;
    }
    try {
      // Load worker from public directory for reliable Next.js compatibility
      return new Worker('/livekit-e2ee-worker.mjs', { type: 'module' });
    } catch (error) {
      console.error('Failed to create E2EE worker:', error);
      return undefined;
    }
  }, [e2eePassphrase]);

  return { worker, e2eePassphrase, isResolved };
}
