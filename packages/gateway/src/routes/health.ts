import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { GatewayEnv } from '../types.js';

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['system'],
  responses: {
    200: {
      description: 'Gateway health',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

export function registerHealthRoute(app: OpenAPIHono<GatewayEnv>) {
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' }));
}
