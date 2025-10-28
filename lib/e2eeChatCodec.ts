import type { MessageDecoder, MessageEncoder, ChatMessage, ReceivedChatMessage } from '@livekit/components-react';

// Define legacy chat message types based on LiveKit's internal types
interface LegacyChatMessage extends ChatMessage {
  ignoreLegacy?: boolean;
}

interface LegacyReceivedChatMessage extends ReceivedChatMessage {
  ignoreLegacy?: boolean;
}

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
  const fallbackEncoder: MessageEncoder = (message: LegacyChatMessage) => {
    return new TextEncoder().encode(message.message);
  };
  // Note: LiveKit's MessageEncoder type is synchronous, but E2EE encryption is async
  // This implementation falls back to unencrypted messages for now
  // TODO: Implement proper E2EE for chat messages using LiveKit's new chat API
  return fallbackEncoder;
}

export function createE2EEMessageDecoder(worker?: Worker, participantIdentity?: string): MessageDecoder {
  const fallbackDecoder: MessageDecoder = (payload: Uint8Array): LegacyReceivedChatMessage => {
    const message = new TextDecoder().decode(payload);
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      message,
    };
  };
  // Note: LiveKit's MessageDecoder type is synchronous, but E2EE decryption is async
  // This implementation falls back to unencrypted messages for now
  // TODO: Implement proper E2EE for chat messages using LiveKit's new chat API
  return fallbackDecoder;
}


