import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { GatewayEnv } from '../types.js';

const ArtifactsListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
    }),
  ),
  message: z.literal('Not implemented yet'),
});

const route = createRoute({
  method: 'get',
  path: '/api/artifacts',
  tags: ['artifacts'],
  responses: {
    200: {
      description: 'List artifacts placeholder',
      content: { 'application/json': { schema: ArtifactsListSchema } },
    },
  },
});

export function registerArtifactsRoutes(app: OpenAPIHono<GatewayEnv>) {
  app.openapi(route, (c) => c.json({ items: [], message: 'Not implemented yet' }));
}
