import { serve } from '@hono/node-server';
import { createGatewayApp } from './app.js';
import { loadGatewayConfig } from './config.js';
import { createRealtimeWsServer } from './realtime/ws-server.js';

const config = loadGatewayConfig();

const logger = {
  info: (meta: Record<string, unknown>, message: string) => console.log(message, meta),
  error: (meta: Record<string, unknown>, message: string) => console.error(message, meta),
};

// Stub adapters reject all credentials — wire real adapters before production use
logger.error({}, 'gateway started with stub auth adapters; all authenticated requests will be rejected');

const app = createGatewayApp(config, {
  logger,
  apiKeyAuth: {
    validateApiKey: async () => null,
  },
  sessionStore: {
    getSession: async () => null,
  },
  now: () => new Date(),
});

const server = serve({ fetch: app.fetch, port: config.port });
const realtimeWs = createRealtimeWsServer({
  server,
  path: '/ws',
  config,
  deps: {
    logger,
    apiKeyAuth: {
      validateApiKey: async () => null,
    },
    sessionStore: {
      getSession: async () => null,
    },
    channelAccess: {
      resolveSpecTeamId: async () => null,
      resolveAgentTeamId: async () => null,
    },
    now: () => new Date(),
  },
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, 'shutting down gateway server');
  try {
    await realtimeWs.close();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    process.exit(0);
  } catch (err) {
    logger.error({ err, signal }, 'failed graceful shutdown');
    process.exit(1);
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

console.log(`gateway listening on :${config.port}`);
