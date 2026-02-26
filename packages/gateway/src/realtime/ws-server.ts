import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { resolvePrincipal } from '../auth/resolve-principal.js';
import { authorizeChannel } from './channels.js';
import { runHeartbeatSweep } from './heartbeat.js';
import { createRealtimeHub } from './hub.js';
import { InboundCommandSchema, OutboundMessageSchema, type OutboundMessage, type OutboundType } from './protocol.js';
import type { GatewayConfig, GatewayDeps } from '../types.js';

type RealtimeServerConfig = Pick<
  GatewayConfig,
  'sessionCookieName' | 'wsHeartbeatIntervalMs' | 'wsHeartbeatTimeoutMs' | 'wsMaxSubscriptionsPerConnection'
>;

type RealtimeServerDeps = Pick<
  GatewayDeps,
  'logger' | 'apiKeyAuth' | 'sessionStore' | 'channelAccess' | 'now'
>;

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0] ?? null;
  return null;
}

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const part of cookies) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key !== name) continue;
    const value = valueParts.join('=').trim();
    if (!value) {
      return null;
    }
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function jsonEnvelope(type: OutboundType, payload: unknown, now: () => Date, channel?: string): string {
  return JSON.stringify({
    type,
    channel,
    timestamp: now().toISOString(),
    eventId: crypto.randomUUID(),
    encoding: 'json',
    payload,
  } satisfies OutboundMessage);
}

function writeUpgradeRejection(socket: Duplex, status: number, message: string) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      '\r\n' +
      message,
  );
  socket.destroy();
}

function getApiKey(req: IncomingMessage): string | null {
  const headerKey = readHeaderValue(req.headers['x-api-key']);
  if (headerKey) {
    return headerKey;
  }

  if (!req.url) {
    return null;
  }

  try {
    const parsed = new URL(req.url, 'http://localhost');
    return parsed.searchParams.get('apiKey');
  } catch {
    return null;
  }
}

export function createRealtimeWsServer(input: {
  server: {
    on: (
      event: 'upgrade',
      listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
    ) => unknown;
  };
  path: string;
  config: RealtimeServerConfig;
  deps: RealtimeServerDeps;
}) {
  const wss = new WebSocketServer({ noServer: true });
  const hub = createRealtimeHub(() => input.deps.now().getTime());
  const channelAccess = input.deps.channelAccess ?? {
    resolveSpecTeamId: async () => null,
    resolveAgentTeamId: async () => null,
  };

  function publish(message: OutboundMessage): number {
    const parsed = OutboundMessageSchema.parse(message);
    if (!parsed.channel) {
      return 0;
    }
    return hub.publish(parsed.channel, JSON.stringify(parsed));
  }

  const heartbeatTimer = setInterval(() => {
    runHeartbeatSweep(hub, {
      now: () => input.deps.now().getTime(),
      timeoutMs: input.config.wsHeartbeatTimeoutMs,
      closeCode: 4001,
      closeReason: 'heartbeat timeout',
    });
  }, input.config.wsHeartbeatIntervalMs);
  heartbeatTimer.unref();

  input.server.on('upgrade', async (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '', 'http://localhost').pathname;
    } catch {
      return;
    }

    if (pathname !== input.path) {
      return;
    }

    const authResult = await resolvePrincipal(
      {
        apiKey: getApiKey(req),
        sessionId: getCookie(readHeaderValue(req.headers.cookie), input.config.sessionCookieName),
      },
      input.deps,
    );

    if (!authResult.ok) {
      writeUpgradeRejection(socket, authResult.status, authResult.message);
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const connectionId = crypto.randomUUID();
      hub.addConnection({
        id: connectionId,
        send: (payload: string) => ws.send(payload),
        close: (code: number, reason: string) => ws.close(code, reason),
        ping: () => ws.ping(),
      });

      ws.on('pong', () => {
        hub.markPong(connectionId);
      });

      ws.on('close', () => {
        hub.removeConnection(connectionId);
      });

      ws.on('message', async (raw) => {
        let parsedRaw: unknown;
        try {
          parsedRaw = JSON.parse(raw.toString());
        } catch {
          ws.send(jsonEnvelope('error', { code: 'INVALID_MESSAGE', message: 'Message must be valid JSON' }, input.deps.now));
          return;
        }

        const commandResult = InboundCommandSchema.safeParse(parsedRaw);
        if (!commandResult.success) {
          ws.send(jsonEnvelope('error', { code: 'INVALID_COMMAND', message: 'Unsupported command shape' }, input.deps.now));
          return;
        }
        const command = commandResult.data;

        if (command.type === 'ping') {
          hub.markPong(connectionId);
          ws.send(jsonEnvelope('pong', { ok: true }, input.deps.now));
          return;
        }

        if (command.type === 'subscribe') {
          const count = hub.listStates().find((state) => state.connection.id === connectionId)?.subscriptions.size ?? 0;
          if (count >= input.config.wsMaxSubscriptionsPerConnection) {
            ws.send(
              jsonEnvelope('error', {
                code: 'MAX_SUBSCRIPTIONS_REACHED',
                message: 'Connection has reached max subscriptions',
              }, input.deps.now),
            );
            return;
          }

          const authorization = await authorizeChannel(command.channel, authResult.principal, channelAccess);
          if (!authorization.ok) {
            ws.send(jsonEnvelope('error', { code: 'CHANNEL_FORBIDDEN', message: 'Channel access denied' }, input.deps.now));
            return;
          }
          hub.subscribe(connectionId, command.channel);
          ws.send(jsonEnvelope('subscribed', { channel: command.channel }, input.deps.now, command.channel));
          return;
        }

        if (command.type === 'unsubscribe') {
          const removed = hub.unsubscribe(connectionId, command.channel);
          ws.send(
            jsonEnvelope(
              'unsubscribed',
              { channel: command.channel, removed },
              input.deps.now,
              command.channel,
            ),
          );
          return;
        }

        ws.send(jsonEnvelope('error', { code: 'INVALID_COMMAND', message: 'Unsupported command type' }, input.deps.now));
      });
    });
  });

  async function close() {
    clearInterval(heartbeatTimer);
    await new Promise<void>((resolve, reject) => {
      wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  return {
    publish,
    close,
  };
}
