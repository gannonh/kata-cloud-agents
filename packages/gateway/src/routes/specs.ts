import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jsonError } from '../middleware/error-handler.js';
import type { GatewayDeps, GatewayEnv, VersionStoreVersionRecord } from '../types.js';
import { diffSpecs } from '../versioning/diff.js';

const SpecsListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
    }),
  ),
  message: z.literal('Not implemented yet'),
});

const SpecVersionSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  content: z.record(z.unknown()),
  actorId: z.string(),
  actorType: z.enum(['user', 'agent']),
  changeSummary: z.string(),
  createdAt: z.string().datetime(),
});

const DiffEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['added', 'removed', 'changed']),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
});

const VersionListResponseSchema = z.object({
  items: z.array(SpecVersionSchema),
  total: z.number().int().nonnegative(),
});

const CreateVersionBodySchema = z.object({
  content: z.record(z.unknown()),
  changeSummary: z.string().default(''),
});

const specListRoute = createRoute({
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

const createVersionRoute = createRoute({
  method: 'post',
  path: '/api/specs/{specId}/versions',
  tags: ['specs'],
  request: {
    params: z.object({ specId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: CreateVersionBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Version created',
      content: { 'application/json': { schema: SpecVersionSchema } },
    },
  },
});

const listVersionsRoute = createRoute({
  method: 'get',
  path: '/api/specs/{specId}/versions',
  tags: ['specs'],
  request: {
    params: z.object({ specId: z.string().uuid() }),
    query: z.object({
      limit: z.coerce.number().int().positive().max(200).default(50),
      offset: z.coerce.number().int().nonnegative().default(0),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of versions',
      content: { 'application/json': { schema: VersionListResponseSchema } },
    },
  },
});

const getVersionRoute = createRoute({
  method: 'get',
  path: '/api/specs/{specId}/versions/{versionNumber}',
  tags: ['specs'],
  request: {
    params: z.object({
      specId: z.string().uuid(),
      versionNumber: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    200: {
      description: 'Single version',
      content: { 'application/json': { schema: SpecVersionSchema } },
    },
  },
});

const diffVersionsRoute = createRoute({
  method: 'get',
  path: '/api/specs/{specId}/versions/{v1}/diff/{v2}',
  tags: ['specs'],
  request: {
    params: z.object({
      specId: z.string().uuid(),
      v1: z.coerce.number().int().positive(),
      v2: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    200: {
      description: 'Structured diff between versions',
      content: { 'application/json': { schema: z.array(DiffEntrySchema) } },
    },
  },
});

const restoreVersionRoute = createRoute({
  method: 'post',
  path: '/api/specs/{specId}/versions/{versionNumber}/restore',
  tags: ['specs'],
  request: {
    params: z.object({
      specId: z.string().uuid(),
      versionNumber: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    201: {
      description: 'New version created from restored content',
      content: { 'application/json': { schema: SpecVersionSchema } },
    },
  },
});

function normalizeActorType(value: string): 'user' | 'agent' {
  return value === 'agent' ? 'agent' : 'user';
}

function toVersionResponse(version: VersionStoreVersionRecord) {
  return {
    id: version.id,
    specId: version.specId,
    versionNumber: version.versionNumber,
    content: version.content,
    actorId: version.actorId,
    actorType: normalizeActorType(version.actorType),
    changeSummary: version.changeSummary,
    createdAt: version.createdAt.toISOString(),
  };
}

function resolveActor(principal: GatewayEnv['Variables']['principal']) {
  if (!principal) return null;
  if (principal.type === 'session_user') {
    return { actorId: principal.userId, actorType: 'user' as const };
  }
  return { actorId: principal.keyId, actorType: 'agent' as const };
}

export function registerSpecsRoutes(app: OpenAPIHono<GatewayEnv>, deps: GatewayDeps) {
  app.openapi(specListRoute, (c) => c.json({ items: [], message: 'Not implemented yet' }));

  app.openapi(createVersionRoute, async (c) => {
    const store = deps.versionStore;
    if (!store) {
      return jsonError(c, 500, 'INTERNAL_ERROR', 'Version store unavailable');
    }

    const principal = c.get('principal');
    if (!principal) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const { specId } = c.req.valid('param');
    const { content, changeSummary } = c.req.valid('json');

    const spec = await store.getSpec(specId);
    if (!spec || spec.teamId !== principal.teamId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Spec not found');
    }

    const actor = resolveActor(principal);
    if (!actor) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const versionNumber = (await store.getMaxVersionNumber(specId)) + 1;
    const created = await store.createVersion({
      specId,
      versionNumber,
      content,
      actorId: actor.actorId,
      actorType: actor.actorType,
      changeSummary,
    });
    await store.updateSpecContent(specId, content);
    return c.json(toVersionResponse(created), 201);
  });

  app.openapi(listVersionsRoute, async (c) => {
    const store = deps.versionStore;
    if (!store) {
      return jsonError(c, 500, 'INTERNAL_ERROR', 'Version store unavailable');
    }

    const principal = c.get('principal');
    if (!principal) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const { specId } = c.req.valid('param');
    const { limit, offset } = c.req.valid('query');
    const spec = await store.getSpec(specId);
    if (!spec || spec.teamId !== principal.teamId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Spec not found');
    }

    const result = await store.listVersions(specId, limit, offset);
    return c.json(
      {
        items: result.items.map(toVersionResponse),
        total: result.total,
      },
      200,
    );
  });

  app.openapi(getVersionRoute, async (c) => {
    const store = deps.versionStore;
    if (!store) {
      return jsonError(c, 500, 'INTERNAL_ERROR', 'Version store unavailable');
    }

    const principal = c.get('principal');
    if (!principal) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const { specId, versionNumber } = c.req.valid('param');
    const spec = await store.getSpec(specId);
    if (!spec || spec.teamId !== principal.teamId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Spec not found');
    }

    const version = await store.getVersion(specId, versionNumber);
    if (!version) {
      return jsonError(c, 404, 'NOT_FOUND', 'Version not found');
    }

    return c.json(toVersionResponse(version), 200);
  });

  app.openapi(diffVersionsRoute, async (c) => {
    const store = deps.versionStore;
    if (!store) {
      return jsonError(c, 500, 'INTERNAL_ERROR', 'Version store unavailable');
    }

    const principal = c.get('principal');
    if (!principal) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const { specId, v1, v2 } = c.req.valid('param');
    const spec = await store.getSpec(specId);
    if (!spec || spec.teamId !== principal.teamId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Spec not found');
    }

    const [versionOne, versionTwo] = await Promise.all([
      store.getVersion(specId, v1),
      store.getVersion(specId, v2),
    ]);

    if (!versionOne || !versionTwo) {
      return jsonError(c, 404, 'NOT_FOUND', 'Version not found');
    }

    return c.json(diffSpecs(versionOne.content, versionTwo.content), 200);
  });

  app.openapi(restoreVersionRoute, async (c) => {
    const store = deps.versionStore;
    if (!store) {
      return jsonError(c, 500, 'INTERNAL_ERROR', 'Version store unavailable');
    }

    const principal = c.get('principal');
    if (!principal) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const { specId, versionNumber } = c.req.valid('param');
    const spec = await store.getSpec(specId);
    if (!spec || spec.teamId !== principal.teamId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Spec not found');
    }

    const sourceVersion = await store.getVersion(specId, versionNumber);
    if (!sourceVersion) {
      return jsonError(c, 404, 'NOT_FOUND', 'Version not found');
    }

    const actor = resolveActor(principal);
    if (!actor) return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const nextVersion = (await store.getMaxVersionNumber(specId)) + 1;
    const restored = await store.createVersion({
      specId,
      versionNumber: nextVersion,
      content: sourceVersion.content,
      actorId: actor.actorId,
      actorType: actor.actorType,
      changeSummary: `Restored from version ${sourceVersion.versionNumber}`,
    });
    await store.updateSpecContent(specId, sourceVersion.content);
    return c.json(toVersionResponse(restored), 201);
  });
}
