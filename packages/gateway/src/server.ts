import { serve } from '@hono/node-server';
import { createGatewayApp } from './app.js';
import { loadGatewayConfig } from './config.js';

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

serve({ fetch: app.fetch, port: config.port });
console.log(`gateway listening on :${config.port}`);
