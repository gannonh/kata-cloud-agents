import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeClient } from '../client.js';

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  public readyState = 0;
  public sent: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  emitOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
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
});
