import type { MessageDecoder, MessageEncoder } from '@livekit/components-react';

type WorkerWithListener = Worker & { __e2eeChatListenerAttached?: boolean };

type PendingRequest = {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
};

const workerPendingMap: WeakMap<Worker, Map<string, PendingRequest>> = new WeakMap();

function ensureWorkerListener(worker: WorkerWithListener) {
  if (worker.__e2eeChatListenerAttached) return;
  const pending = new Map<string, PendingRequest>();
  workerPendingMap.set(worker, pending);
  worker.addEventListener('message', (ev: MessageEvent) => {
    const { kind, data } = ev.data || {};
    if (!data || !data.uuid) return;
    const map = workerPendingMap.get(worker);
    const entry = map?.get(data.uuid);
    if (!entry) return;
    map?.delete(data.uuid);
    if (kind === 'encryptDataResponse' || kind === 'decryptDataResponse') {
      entry.resolve(data);
    } else {
      entry.reject(new Error('Unexpected worker response'));
    }
  });
  worker.__e2eeChatListenerAttached = true;
}

function postWorkerRequest<T = any>(
  worker: Worker,
  kind: 'encryptDataRequest' | 'decryptDataRequest',
  data: Record<string, any>,
): Promise<T> {
  ensureWorkerListener(worker as WorkerWithListener);
  const uuid = crypto.randomUUID();
  const map = workerPendingMap.get(worker)!;
  return new Promise<T>((resolve, reject) => {
    map.set(uuid, { resolve, reject });
    worker.postMessage({ kind, data: { ...data, uuid } });
  });
}

function toBase64(u8: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    const sub = u8.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub) as any);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createE2EEMessageEncoder(worker?: Worker, participantIdentity?: string): MessageEncoder {
  const fallbackEncoder: MessageEncoder = async (message: string) => {
    return new TextEncoder().encode(message);
  };
  if (!worker) return fallbackEncoder;

  return async (message: string) => {
    try {
      const payload = new TextEncoder().encode(message);
      const resp = await postWorkerRequest<{ payload: Uint8Array; iv: Uint8Array; keyIndex: number; uuid: string }>(
        worker,
        'encryptDataRequest',
        { payload, participantIdentity },
      );

      const envelope = {
        v: 1,
        alg: 'LK-E2EE',
        iv: toBase64(resp.iv),
        kx: resp.keyIndex,
        p: toBase64(resp.payload),
      };
      const json = JSON.stringify(envelope);
      return new TextEncoder().encode(json);
    } catch (err) {
      // fall back to plain text on any failure
      return fallbackEncoder(message);
    }
  };
}

export function createE2EEMessageDecoder(worker?: Worker, participantIdentity?: string): MessageDecoder {
  const fallbackDecoder: MessageDecoder = async (payload: Uint8Array) => {
    return new TextDecoder().decode(payload);
  };
  if (!worker) return fallbackDecoder;

  return async (payload: Uint8Array) => {
    try {
      const text = new TextDecoder().decode(payload);
      const obj = JSON.parse(text);
      if (obj && obj.alg === 'LK-E2EE' && obj.v === 1 && obj.iv && obj.p) {
        const encrypted = fromBase64(obj.p);
        const iv = fromBase64(obj.iv);
        const keyIndex = typeof obj.kx === 'number' ? obj.kx : undefined;

        const resp = await postWorkerRequest<{ payload: Uint8Array; uuid: string }>(
          worker,
          'decryptDataRequest',
          { payload: encrypted, iv, keyIndex, participantIdentity },
        );
        return new TextDecoder().decode(resp.payload);
      }
      // Not our envelope, treat as plaintext
      return text;
    } catch {
      // If JSON parse fails, assume plaintext string
      return new TextDecoder().decode(payload);
    }
  };
}


