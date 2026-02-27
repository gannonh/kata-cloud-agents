import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createRealtimeWsServer } from '../realtime/ws-server.js';

function waitForEvent(
  socket: WebSocket,
  predicate: (payload: unknown) => boolean,
  timeoutMs = 5_000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeListener('message', onMessage);
      reject(new Error('timed out waiting for websocket message'));
    }, timeoutMs);

    function onMessage(data: WebSocket.RawData) {
      try {
        const parsed = JSON.parse(data.toString());
        if (!predicate(parsed)) {
          return;
        }
        clearTimeout(timeout);
        socket.removeListener('message', onMessage);
        resolve(parsed);
      } catch {
        // Ignore non-JSON frames for this test.
      }
    }

    socket.on('message', onMessage);
  });
}

describe('ws server integration', () => {
  const disposers: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    for (const dispose of disposers.splice(0).reverse()) {
      await dispose();
    }
  });

  it('authenticates, subscribes, receives published event, and handles ping command', async () => {
    const httpServer = createServer((_, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    disposers.push(
      () =>
        new Promise<void>((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        }),
    );

    const realtime = createRealtimeWsServer({
      server: httpServer,
      path: '/ws',
      config: {
        wsHeartbeatIntervalMs: 15_000,
        wsHeartbeatTimeoutMs: 30_000,
        wsMaxSubscriptionsPerConnection: 100,
        sessionCookieName: 'kata.sid',
      },
      deps: {
        logger: { info: () => {}, error: () => {} },
        apiKeyAuth: {
          validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
        },
        sessionStore: {
          getSession: async () => null,
        },
        now: () => new Date('2026-02-26T00:00:00.000Z'),
      },
    });
    disposers.push(async () => {
      await realtime.close();
    });

    const port = (httpServer.address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { 'x-api-key': 'kat_live_1' },
    });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (err) => reject(err));
    });
    disposers.push(() => ws.close());

    ws.send(JSON.stringify({ type: 'subscribe', channel: 'team:team-1' }));
    await waitForEvent(ws, (msg) => (msg as { type?: string }).type === 'subscribed');

    realtime.publish({
      type: 'spec_updated',
      channel: 'team:team-1',
      timestamp: '2026-02-26T00:00:00.000Z',
      eventId: 'evt_1',
      encoding: 'json',
      payload: { specId: 'spec-1' },
    });
    await waitForEvent(ws, (msg) => (msg as { type?: string }).type === 'spec_updated');

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = (await waitForEvent(ws, (msg) => (msg as { type?: string }).type === 'pong')) as {
      timestamp?: string;
    };
    expect(pong.timestamp).toBe('2026-02-26T00:00:00.000Z');
  });

  it('rejects malformed cookie values without crashing upgrade handling', async () => {
    const httpServer = createServer((_, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    disposers.push(
      () =>
        new Promise<void>((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        }),
    );

    const realtime = createRealtimeWsServer({
      server: httpServer,
      path: '/ws',
      config: {
        wsHeartbeatIntervalMs: 15_000,
        wsHeartbeatTimeoutMs: 30_000,
        wsMaxSubscriptionsPerConnection: 100,
        sessionCookieName: 'kata.sid',
      },
      deps: {
        logger: { info: () => {}, error: () => {} },
        apiKeyAuth: {
          validateApiKey: async () => null,
        },
        sessionStore: {
          getSession: async () => null,
        },
        now: () => new Date('2026-02-26T00:00:00.000Z'),
      },
    });
    disposers.push(async () => {
      await realtime.close();
    });

    const port = (httpServer.address() as AddressInfo).port;
    const status = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: { cookie: 'kata.sid=%E0%A4%A' },
      });
      ws.once('open', () => reject(new Error('expected websocket upgrade to be rejected')));
      ws.once('unexpected-response', (_, response) => resolve(response.statusCode ?? 0));
      ws.once('error', (err) => reject(err));
    });

    expect(status).toBe(401);
  });

  it('does not accept API keys via URL query string', async () => {
    const httpServer = createServer((_, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    disposers.push(
      () =>
        new Promise<void>((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        }),
    );

    const realtime = createRealtimeWsServer({
      server: httpServer,
      path: '/ws',
      config: {
        wsHeartbeatIntervalMs: 15_000,
        wsHeartbeatTimeoutMs: 30_000,
        wsMaxSubscriptionsPerConnection: 100,
        sessionCookieName: 'kata.sid',
      },
      deps: {
        logger: { info: () => {}, error: () => {} },
        apiKeyAuth: {
          validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
        },
        sessionStore: {
          getSession: async () => null,
        },
        now: () => new Date('2026-02-26T00:00:00.000Z'),
      },
    });
    disposers.push(async () => {
      await realtime.close();
    });

    const port = (httpServer.address() as AddressInfo).port;
    const status = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?apiKey=kat_live_1`);
      ws.once('open', () => reject(new Error('expected websocket upgrade to be rejected')));
      ws.once('unexpected-response', (_, response) => resolve(response.statusCode ?? 0));
      ws.once('error', (err) => reject(err));
    });

    expect(status).toBe(401);
  });

  it('rejects unauthorized channel subscriptions with CHANNEL_FORBIDDEN', async () => {
    const httpServer = createServer((_, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    disposers.push(
      () =>
        new Promise<void>((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        }),
    );

    const realtime = createRealtimeWsServer({
      server: httpServer,
      path: '/ws',
      config: {
        wsHeartbeatIntervalMs: 15_000,
        wsHeartbeatTimeoutMs: 30_000,
        wsMaxSubscriptionsPerConnection: 100,
        sessionCookieName: 'kata.sid',
      },
      deps: {
        logger: { info: () => {}, error: () => {} },
        apiKeyAuth: {
          validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
        },
        sessionStore: {
          getSession: async () => null,
        },
        channelAccess: {
          resolveSpecTeamId: async () => 'team-2',
          resolveAgentTeamId: async () => null,
        },
        now: () => new Date('2026-02-26T00:00:00.000Z'),
      },
    });
    disposers.push(async () => {
      await realtime.close();
    });

    const port = (httpServer.address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { 'x-api-key': 'kat_live_1' },
    });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (err) => reject(err));
    });
    disposers.push(() => ws.close());

    ws.send(JSON.stringify({ type: 'subscribe', channel: 'spec:spec-1' }));
    const error = (await waitForEvent(ws, (msg) => (msg as { type?: string }).type === 'error')) as {
      payload?: { code?: string };
    };
    expect(error.payload?.code).toBe('CHANNEL_FORBIDDEN');
  });

  it('enforces max subscriptions per connection', async () => {
    const httpServer = createServer((_, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    disposers.push(
      () =>
        new Promise<void>((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        }),
    );

    const realtime = createRealtimeWsServer({
      server: httpServer,
      path: '/ws',
      config: {
        wsHeartbeatIntervalMs: 15_000,
        wsHeartbeatTimeoutMs: 30_000,
        wsMaxSubscriptionsPerConnection: 1,
        sessionCookieName: 'kata.sid',
      },
      deps: {
        logger: { info: () => {}, error: () => {} },
        apiKeyAuth: {
          validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
        },
        sessionStore: {
          getSession: async () => null,
        },
        channelAccess: {
          resolveSpecTeamId: async (id: string) => (id === 'spec-1' || id === 'spec-2' ? 'team-1' : null),
          resolveAgentTeamId: async () => null,
        },
        now: () => new Date('2026-02-26T00:00:00.000Z'),
      },
    });
    disposers.push(async () => {
      await realtime.close();
    });

    const port = (httpServer.address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { 'x-api-key': 'kat_live_1' },
    });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (err) => reject(err));
    });
    disposers.push(() => ws.close());

    ws.send(JSON.stringify({ type: 'subscribe', channel: 'spec:spec-1' }));
    await waitForEvent(ws, (msg) => (msg as { type?: string }).type === 'subscribed');

    ws.send(JSON.stringify({ type: 'subscribe', channel: 'spec:spec-2' }));
    const error = (await waitForEvent(ws, (msg) => (msg as { type?: string }).type === 'error')) as {
      payload?: { code?: string };
    };
    expect(error.payload?.code).toBe('MAX_SUBSCRIPTIONS_REACHED');
  });
});
