import type { LifecycleEvent, OutboundCommand, RealtimeClientOptions, SocketLike } from './types.js';

const SOCKET_OPEN = 1;
const SOCKET_CONNECTING = 0;

function withApiKey(url: string, apiKey?: string): string {
  if (!apiKey) return url;
  const target = new URL(url);
  target.searchParams.set('apiKey', apiKey);
  return target.toString();
}

function defaultSocketFactory(url: string): SocketLike {
  if (typeof WebSocket === 'undefined') {
    throw new Error('WebSocket is not available in this runtime');
  }
  return new WebSocket(url) as unknown as SocketLike;
}

export function createRealtimeClient(options: RealtimeClientOptions) {
  const socketFactory = options.createSocket ?? defaultSocketFactory;
  const minMs = options.backoff?.minMs ?? 250;
  const maxMs = options.backoff?.maxMs ?? 10_000;
  const lifecycleHandlers = new Map<LifecycleEvent, Set<(payload?: unknown) => void>>();
  const channelHandlers = new Map<string, Set<(payload: unknown) => void>>();

  let socket: SocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let manuallyClosed = false;

  function emit(event: LifecycleEvent, payload?: unknown) {
    const handlers = lifecycleHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  }

  function isOpen() {
    return socket?.readyState === SOCKET_OPEN;
  }

  function send(command: OutboundCommand) {
    if (!isOpen()) {
      return;
    }
    socket?.send(JSON.stringify(command));
  }

  function replaySubscriptions() {
    for (const channel of channelHandlers.keys()) {
      send({ type: 'subscribe', channel });
    }
  }

  function scheduleReconnect() {
    if (manuallyClosed || reconnectTimer) {
      return;
    }
    const delay = Math.min(maxMs, minMs * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    emit('reconnecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function onMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      emit('error', { message: 'invalid json message' });
      return;
    }
    emit('message', parsed);
    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }
    if ('type' in parsed && parsed.type === 'error') {
      emit('error', parsed);
      return;
    }

    const channel = 'channel' in parsed && typeof parsed.channel === 'string' ? parsed.channel : null;
    if (!channel) {
      return;
    }
    const handlers = channelHandlers.get(channel);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(parsed);
    }
  }

  function attachSocket(nextSocket: SocketLike) {
    socket = nextSocket;
    nextSocket.onopen = () => {
      reconnectAttempt = 0;
      emit('connected');
      replaySubscriptions();
    };
    nextSocket.onmessage = (event) => onMessage(event.data);
    nextSocket.onerror = () => {
      emit('error', { message: 'socket error' });
    };
    nextSocket.onclose = () => {
      socket = null;
      if (manuallyClosed) {
        emit('disconnected');
        return;
      }
      scheduleReconnect();
    };
  }

  function connect() {
    if (socket && (socket.readyState === SOCKET_OPEN || socket.readyState === SOCKET_CONNECTING)) {
      return;
    }
    manuallyClosed = false;
    emit('connecting');
    attachSocket(socketFactory(withApiKey(options.url, options.apiKey)));
  }

  function disconnect() {
    manuallyClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close();
    socket = null;
  }

  function subscribe(channel: string, handler: (payload: unknown) => void) {
    const handlers = channelHandlers.get(channel) ?? new Set<(payload: unknown) => void>();
    const wasEmpty = handlers.size === 0;
    handlers.add(handler);
    channelHandlers.set(channel, handlers);

    if (wasEmpty) {
      send({ type: 'subscribe', channel });
    }

    return () => unsubscribe(channel, handler);
  }

  function unsubscribe(channel: string, handler?: (payload: unknown) => void) {
    const handlers = channelHandlers.get(channel);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size > 0) {
      return;
    }

    channelHandlers.delete(channel);
    send({ type: 'unsubscribe', channel });
  }

  function on(event: LifecycleEvent, handler: (payload?: unknown) => void) {
    const handlers = lifecycleHandlers.get(event) ?? new Set<(payload?: unknown) => void>();
    handlers.add(handler);
    lifecycleHandlers.set(event, handlers);

    return () => {
      const current = lifecycleHandlers.get(event);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        lifecycleHandlers.delete(event);
      }
    };
  }

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    on,
  };
}
