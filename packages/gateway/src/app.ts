import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { jsonError } from './middleware/error-handler.js';
import { requestContextMiddleware } from './middleware/request-context.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { registerHealthRoute } from './routes/health.js';
import type { GatewayConfig, GatewayDeps } from './types.js';

export function createGatewayApp(config: GatewayConfig, deps: GatewayDeps) {
  const app = new OpenAPIHono();

  app.use('*', requestContextMiddleware);
  app.use('*', cors({ origin: config.allowedOrigins, credentials: true }));
  app.use('*', requestLoggerMiddleware(deps.logger));

  registerHealthRoute(app);

  app.notFound((c) => jsonError(c, 404, 'NOT_FOUND', 'Route not found'));
  app.onError((err, c) => {
    deps.logger.error({ err }, 'unhandled gateway error');
    return jsonError(c, 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Kata Gateway API',
      version: '0.1.0',
    },
  });

  return app;
}
