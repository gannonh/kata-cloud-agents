import { serve } from '@hono/node-server';
import { createGatewayApp } from './app.js';
import { loadGatewayConfig } from './config.js';

const config = loadGatewayConfig();

const app = createGatewayApp(config, {
  logger: {
    info: (meta, message) => console.log(message, meta),
    error: (meta, message) => console.error(message, meta),
  },
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
