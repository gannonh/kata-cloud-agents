import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const TeamsListSchema = z.object({
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
  path: '/api/teams',
  tags: ['teams'],
  responses: {
    200: {
      description: 'List teams placeholder',
      content: { 'application/json': { schema: TeamsListSchema } },
    },
  },
});

export function registerTeamsRoutes(app: OpenAPIHono) {
  app.openapi(route, (c) => c.json({ items: [], message: 'Not implemented yet' }));
}
