import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const SpecsListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
    }),
  ),
  message: z.literal('Not implemented yet'),
});

const route = createRoute({
  method: 'get',
  path: '/api/specs',
  tags: ['specs'],
  responses: {
    200: {
      description: 'List specs placeholder',
      content: { 'application/json': { schema: SpecsListSchema } },
    },
  },
});

export function registerSpecsRoutes(app: OpenAPIHono) {
  app.openapi(route, (c) => c.json({ items: [], message: 'Not implemented yet' }));
}
