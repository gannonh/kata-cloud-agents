import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeClient } from '../client.js';

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  public readyState = 0;
  public sent: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSING;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  emitOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  emitMessage(data: string) {
    this.onmessage?.({ data });
  }

  emitError(event: unknown = { type: 'error' }) {
    this.onerror?.(event);
  }
}

describe('realtime client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects with backoff after unexpected close', () => {
    const sockets: FakeWebSocket[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      backoff: {
        minMs: 250,
        maxMs: 1_000,
      },
      random: () => 0,
    });

    client.connect();
    expect(sockets).toHaveLength(1);
    sockets[0]?.emitOpen();
    sockets[0]?.close();

    vi.advanceTimersByTime(249);
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('resubscribes after reconnect', () => {
    const sockets: FakeWebSocket[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      backoff: {
        minMs: 250,
        maxMs: 1_000,
      },
      random: () => 0,
    });

    client.subscribe('team:t1', () => {});
    client.connect();
    sockets[0]?.emitOpen();

    expect(sockets[0]?.sent[0]).toContain('"type":"subscribe"');
    expect(sockets[0]?.sent[0]).toContain('"channel":"team:t1"');

    sockets[0]?.close();
    vi.advanceTimersByTime(250);
    sockets[1]?.emitOpen();

    expect(sockets[1]?.sent[0]).toContain('"type":"subscribe"');
    expect(sockets[1]?.sent[0]).toContain('"channel":"team:t1"');
  });

  it('initiates a connection when subscribing while disconnected', () => {
    const sockets: FakeWebSocket[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      random: () => 0,
    });

    client.subscribe('team:t1', () => {});
    expect(sockets).toHaveLength(1);
  });

  it('emits lifecycle events', () => {
    const events: string[] = [];
    const sockets: FakeWebSocket[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      backoff: {
        minMs: 250,
        maxMs: 1_000,
      },
      random: () => 0,
    });

    client.on('connecting', () => events.push('connecting'));
    client.on('connected', () => events.push('connected'));
    client.on('reconnecting', () => events.push('reconnecting'));

    client.connect();
    sockets[0]?.emitOpen();
    sockets[0]?.close();
    vi.advanceTimersByTime(250);

    expect(events).toEqual(['connecting', 'connected', 'reconnecting', 'connecting']);
  });

  it('emits disconnected and suppresses reconnect after manual disconnect', () => {
    const events: string[] = [];
    const sockets: FakeWebSocket[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      backoff: {
        minMs: 250,
        maxMs: 1_000,
      },
      random: () => 0,
    });

    client.on('disconnected', () => events.push('disconnected'));
    client.on('reconnecting', () => events.push('reconnecting'));

    client.connect();
    sockets[0]?.emitOpen();
    client.disconnect();
    vi.advanceTimersByTime(1_000);

    expect(events).toEqual(['disconnected']);
    expect(sockets).toHaveLength(1);
  });

  it('routes inbound channel messages to subscribed handlers', () => {
    const sockets: FakeWebSocket[] = [];
    const handler = vi.fn();
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      random: () => 0,
    });

    client.subscribe('team:t1', handler);
    sockets[0]?.emitOpen();

    sockets[0]?.emitMessage(JSON.stringify({ type: 'spec_updated', channel: 'team:t1', payload: { id: 1 } }));
    sockets[0]?.emitMessage(JSON.stringify({ type: 'spec_updated', channel: 'team:t2', payload: { id: 2 } }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'spec_updated', channel: 'team:t1', payload: { id: 1 } });
  });

  it('sends unsubscribe only when the last handler is removed', () => {
    const sockets: FakeWebSocket[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      random: () => 0,
    });

    const disposeA = client.subscribe('team:t1', () => {});
    const disposeB = client.subscribe('team:t1', () => {});
    sockets[0]?.emitOpen();
    expect(sockets[0]?.sent.filter((entry) => entry.includes('"type":"subscribe"'))).toHaveLength(1);

    disposeA();
    expect(sockets[0]?.sent.filter((entry) => entry.includes('"type":"unsubscribe"'))).toHaveLength(0);

    disposeB();
    expect(sockets[0]?.sent.filter((entry) => entry.includes('"type":"unsubscribe"'))).toHaveLength(1);
  });

  it('emits socket error events with the original event payload', () => {
    const sockets: FakeWebSocket[] = [];
    const errors: unknown[] = [];
    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      random: () => 0,
    });

    client.on('error', (payload) => errors.push(payload));
    client.connect();
    sockets[0]?.emitError({ code: 'ECONNRESET' });

    expect(errors).toEqual([{ message: 'socket error', event: { code: 'ECONNRESET' } }]);
  });

  it('recovers from socket factory errors and retries', () => {
    const failingError = new Error('bad socket url');
    const sockets: FakeWebSocket[] = [];
    const errors: unknown[] = [];
    const createSocket = vi.fn();
    createSocket.mockImplementationOnce(() => {
      throw failingError;
    });
    createSocket.mockImplementation(() => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });

    const client = createRealtimeClient({
      url: 'ws://localhost:3001/ws',
      createSocket,
      backoff: {
        minMs: 250,
        maxMs: 1_000,
      },
      random: () => 0,
    });
    client.on('error', (payload) => errors.push(payload));

    client.connect();
    expect(errors).toContainEqual({ message: 'socket factory failed', error: failingError });

    vi.advanceTimersByTime(250);
    expect(sockets).toHaveLength(1);
  });
});
