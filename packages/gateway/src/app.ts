import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { authMiddleware } from './middleware/auth.js';
import { jsonError } from './middleware/error-handler.js';
import { createRateLimitMiddleware } from './middleware/rate-limit.js';
import { requestContextMiddleware } from './middleware/request-context.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { registerAgentsRoutes } from './routes/agents.js';
import { registerArtifactsRoutes } from './routes/artifacts.js';
import { registerHealthRoute } from './routes/health.js';
import { registerSpecsRoutes } from './routes/specs.js';
import { registerTeamsRoutes } from './routes/teams.js';
import type { GatewayConfig, GatewayDeps, GatewayVars } from './types.js';

export function createGatewayApp(config: GatewayConfig, deps: GatewayDeps) {
  const app = new OpenAPIHono<{ Variables: GatewayVars }>();

  app.use('*', requestContextMiddleware);
  app.use('*', cors({ origin: config.allowedOrigins, credentials: true }));
  app.use('*', requestLoggerMiddleware(deps.logger));
  app.use('/api/*', createRateLimitMiddleware(config.rateLimitWindowMs, config.rateLimitMaxRequests));
  app.use('/api/*', authMiddleware(config, deps));

  registerHealthRoute(app);
  registerSpecsRoutes(app);
  registerAgentsRoutes(app);
  registerTeamsRoutes(app);
  registerArtifactsRoutes(app);

  app.notFound((c) => jsonError(c, 404, 'NOT_FOUND', 'Route not found'));
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      deps.logger.error({ err, status: err.status }, 'http exception');
      return jsonError(c, err.status as ContentfulStatusCode, 'HTTP_ERROR', err.message);
    }
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
