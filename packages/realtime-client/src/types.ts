export type LifecycleEvent = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error' | 'message';

export type OutboundCommand =
  | { type: 'subscribe'; channel: string }
  | { type: 'unsubscribe'; channel: string }
  | { type: 'ping' };

export type SocketLike = {
  readyState: 0 | 1 | 2 | 3;
  send: (payload: string) => void;
  close: (code?: number, reason?: string) => void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type RealtimeClientOptions = {
  url: string;
  createSocket?: (url: string) => SocketLike;
  random?: () => number;
  backoff?: {
    minMs?: number;
    maxMs?: number;
  };
};
