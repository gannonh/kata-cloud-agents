import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { GatewayEnv } from '../types.js';

const AgentsListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  message: z.literal('Not implemented yet'),
});

const route = createRoute({
  method: 'get',
  path: '/api/agents',
  tags: ['agents'],
  responses: {
    200: {
      description: 'List agents placeholder',
      content: { 'application/json': { schema: AgentsListSchema } },
    },
  },
});

export function registerAgentsRoutes(app: OpenAPIHono<GatewayEnv>) {
  app.openapi(route, (c) => c.json({ items: [], message: 'Not implemented yet' }));
}
