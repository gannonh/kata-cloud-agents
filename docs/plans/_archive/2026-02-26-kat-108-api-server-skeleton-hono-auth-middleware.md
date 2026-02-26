# KAT-108 API Server Skeleton (Hono) with Auth Middleware Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `packages/gateway` as a runnable Hono API skeleton with health checks, middleware stack, protected route groups, OpenAPI generation, and Redis-backed session auth that fails closed.

**Architecture:** Implement a testable `createGatewayApp(config, deps)` factory with explicit middleware composition and dependency-injected auth adapters. Keep gateway persistence-agnostic so it can run in parallel with KAT-106 by avoiding `@kata/db` imports and SQL assumptions. Use OpenAPIHono route definitions for typed contracts and automatic OpenAPI JSON generation.

**Tech Stack:** TypeScript 5.8, Hono, @hono/node-server, @hono/zod-openapi, Zod, ioredis, Vitest 3.2, pnpm workspaces

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

### Task 1: Gateway Package Tooling Baseline

**Files:**
- Modify: `packages/gateway/package.json`
- Create: `packages/gateway/tsconfig.json`
- Create: `packages/gateway/vitest.config.ts`
- Create: `packages/gateway/src/index.ts`
- Create: `tests/scaffold/gateway-package.test.mjs`

**Step 1: Write the failing test**

Create `tests/scaffold/gateway-package.test.mjs`:

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/gateway/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/gateway');
assert.equal(pkg.type, 'module');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.scripts.dev, 'dev script missing');

assert.ok(pkg.dependencies.hono, 'hono dependency missing');
assert.ok(pkg.dependencies.ioredis, 'ioredis dependency missing');
assert.ok(pkg.dependencies.zod, 'zod dependency missing');
assert.ok(pkg.dependencies['@hono/zod-openapi'], '@hono/zod-openapi dependency missing');

assert.ok(fs.existsSync('packages/gateway/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/gateway/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/gateway/src/index.ts'), 'src/index.ts missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/gateway-package.test.mjs`  
Expected: FAIL with missing scripts/dependencies/files.

**Step 3: Write minimal implementation**

Install dependencies:

Run: `pnpm --filter @kata/gateway add hono @hono/node-server @hono/zod-openapi zod ioredis dotenv`  
Run: `pnpm --filter @kata/gateway add -D vitest tsx @types/node`

Replace `packages/gateway/package.json` with:

```json
{
  "name": "@kata/gateway",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc --build",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "@hono/zod-openapi": "^0.16.4",
    "dotenv": "^16.4.5",
    "hono": "^4.6.10",
    "ioredis": "^5.4.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.19.3",
    "vitest": "^3.2.4"
  }
}
```

Create `packages/gateway/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
```

Create `packages/gateway/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

Create `packages/gateway/src/index.ts`:

```typescript
export * from './app.js';
export * from './config.js';
export * from './types.js';
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/gateway-package.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/package.json packages/gateway/tsconfig.json packages/gateway/vitest.config.ts packages/gateway/src/index.ts tests/scaffold/gateway-package.test.mjs pnpm-lock.yaml
git commit -m "feat(gateway): bootstrap package tooling and deps"
```

### Task 2: App Factory, Health Endpoint, and Global Error Envelope

**Files:**
- Create: `packages/gateway/src/types.ts`
- Create: `packages/gateway/src/config.ts`
- Create: `packages/gateway/src/app.ts`
- Create: `packages/gateway/src/server.ts`
- Create: `packages/gateway/src/middleware/request-context.ts`
- Create: `packages/gateway/src/middleware/error-handler.ts`
- Create: `packages/gateway/src/middleware/request-logger.ts`
- Create: `packages/gateway/src/routes/health.ts`
- Create: `packages/gateway/src/__tests__/health-and-errors.test.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/health-and-errors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createGatewayApp } from '../app.js';

const baseConfig = {
  port: 3001,
  allowedOrigins: ['http://localhost:1420'],
  sessionCookieName: 'kata.sid',
  sessionCookieSecret: 'test-secret',
  redisUrl: 'redis://localhost:6379',
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 60,
};

const deps = {
  logger: {
    info: () => {},
    error: () => {},
  },
  apiKeyAuth: {
    validateApiKey: async () => null,
  },
  sessionStore: {
    getSession: async () => null,
  },
  now: () => new Date('2026-02-26T00:00:00.000Z'),
};

describe('gateway app basics', () => {
  it('returns health status', async () => {
    const app = createGatewayApp(baseConfig, deps);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  it('returns requestId on unknown route', async () => {
    const app = createGatewayApp(baseConfig, deps);
    const res = await app.request('/missing');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test`  
Expected: FAIL because `createGatewayApp` and middleware files do not exist.

**Step 3: Write minimal implementation**

Create `packages/gateway/src/types.ts`:

```typescript
export type Logger = {
  info: (meta: Record<string, unknown>, message: string) => void;
  error: (meta: Record<string, unknown>, message: string) => void;
};

export type ApiKeyPrincipal = {
  type: 'api_key';
  teamId: string;
  keyId: string;
  scopes?: string[];
};

export type SessionPrincipal = {
  type: 'session_user';
  teamId: string;
  userId: string;
};

export type AuthPrincipal = ApiKeyPrincipal | SessionPrincipal;

export type ApiKeyAuthAdapter = {
  validateApiKey: (rawKey: string) => Promise<{ teamId: string; keyId: string; scopes?: string[] } | null>;
};

export type SessionStoreAdapter = {
  getSession: (sessionId: string) => Promise<{ userId: string; teamId: string; expiresAt: string } | null>;
};

export type GatewayConfig = {
  port: number;
  allowedOrigins: string[];
  sessionCookieName: string;
  sessionCookieSecret: string;
  redisUrl: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
};

export type GatewayDeps = {
  logger: Logger;
  apiKeyAuth: ApiKeyAuthAdapter;
  sessionStore: SessionStoreAdapter;
  now: () => Date;
};
```

Create `packages/gateway/src/config.ts`:

```typescript
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import type { GatewayConfig } from './types.js';

loadEnv();

const EnvSchema = z.object({
  GATEWAY_PORT: z.coerce.number().int().positive().default(3001),
  GATEWAY_ALLOWED_ORIGINS: z.string().default('http://localhost:1420,http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().min(1).default('kata.sid'),
  SESSION_COOKIE_SECRET: z.string().min(1),
  REDIS_URL: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
});

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = EnvSchema.parse(env);
  return {
    port: parsed.GATEWAY_PORT,
    allowedOrigins: parsed.GATEWAY_ALLOWED_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean),
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    sessionCookieSecret: parsed.SESSION_COOKIE_SECRET,
    redisUrl: parsed.REDIS_URL,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: parsed.RATE_LIMIT_MAX_REQUESTS,
  };
}
```

Create `packages/gateway/src/middleware/request-context.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';

export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.set('startedAtMs', Date.now());
  await next();
  c.header('x-request-id', requestId);
};
```

Create `packages/gateway/src/middleware/error-handler.ts`:

```typescript
import type { Context } from 'hono';

export function jsonError(c: Context, status: number, code: string, message: string) {
  return c.json(
    {
      error: {
        code,
        message,
        requestId: c.get('requestId') ?? 'unknown',
      },
    },
    status,
  );
}
```

Create `packages/gateway/src/middleware/request-logger.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../types.js';

export function requestLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const startedAtMs = Number(c.get('startedAtMs') ?? Date.now());
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - startedAtMs,
      },
      'request completed',
    );
  };
}
```

Create `packages/gateway/src/routes/health.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

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

export function registerHealthRoute(app: OpenAPIHono) {
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' }));
}
```

Create `packages/gateway/src/app.ts`:

```typescript
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
```

Create `packages/gateway/src/server.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src packages/gateway/src/__tests__/health-and-errors.test.ts
git commit -m "feat(gateway): add app factory, health endpoint, and global error handling"
```

### Task 3: Auth Middleware with API Key and Redis Session Validation (Fail Closed)

**Files:**
- Create: `packages/gateway/src/auth/session-store.ts`
- Create: `packages/gateway/src/auth/api-key-adapter.ts`
- Create: `packages/gateway/src/middleware/auth.ts`
- Create: `packages/gateway/src/__tests__/auth-middleware.test.ts`
- Modify: `packages/gateway/src/app.ts`
- Modify: `packages/gateway/src/types.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/auth-middleware.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../app.js';

function makeConfig() {
  return {
    port: 3001,
    allowedOrigins: ['http://localhost:1420'],
    sessionCookieName: 'kata.sid',
    sessionCookieSecret: 'test-secret',
    redisUrl: 'redis://localhost:6379',
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createGatewayApp>[1]> = {}) {
  return {
    logger: {
      info: () => {},
      error: () => {},
    },
    apiKeyAuth: {
      validateApiKey: vi.fn(async () => null),
    },
    sessionStore: {
      getSession: vi.fn(async () => null),
    },
    now: () => new Date('2026-02-26T00:00:00.000Z'),
    ...overrides,
  };
}

describe('auth middleware', () => {
  it('returns 401 on protected route without credentials', async () => {
    const app = createGatewayApp(makeConfig(), makeDeps());
    const res = await app.request('/api/teams');
    expect(res.status).toBe(401);
  });

  it('accepts valid API key', async () => {
    const deps = makeDeps({
      apiKeyAuth: {
        validateApiKey: vi.fn(async () => ({ teamId: 'team-1', keyId: 'key-1' })),
      },
    });
    const app = createGatewayApp(makeConfig(), deps);
    const res = await app.request('/api/teams', {
      headers: { 'x-api-key': 'kat_live_123' },
    });
    expect(res.status).toBe(200);
  });

  it('fails closed when session store throws', async () => {
    const deps = makeDeps({
      sessionStore: {
        getSession: vi.fn(async () => {
          throw new Error('redis down');
        }),
      },
    });
    const app = createGatewayApp(makeConfig(), deps);
    const res = await app.request('/api/teams', {
      headers: { cookie: 'kata.sid=sid-123' },
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_SERVICE_UNAVAILABLE');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test`  
Expected: FAIL due to missing auth middleware and protected routes.

**Step 3: Write minimal implementation**

Create `packages/gateway/src/middleware/auth.ts`:

```typescript
import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { jsonError } from './error-handler.js';
import type { GatewayConfig, GatewayDeps } from '../types.js';

export function authMiddleware(config: GatewayConfig, deps: GatewayDeps): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = c.req.header('x-api-key');
    if (apiKey) {
      const keyPrincipal = await deps.apiKeyAuth.validateApiKey(apiKey);
      if (!keyPrincipal) {
        return jsonError(c, 401, 'INVALID_API_KEY', 'Invalid API key');
      }
      c.set('principal', { type: 'api_key', ...keyPrincipal });
      return next();
    }

    const sessionId = getCookie(c, config.sessionCookieName);
    if (!sessionId) {
      return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    try {
      const session = await deps.sessionStore.getSession(sessionId);
      if (!session) {
        return jsonError(c, 401, 'INVALID_SESSION', 'Invalid session');
      }
      c.set('principal', {
        type: 'session_user',
        teamId: session.teamId,
        userId: session.userId,
      });
      return next();
    } catch {
      return jsonError(c, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication service unavailable');
    }
  };
}
```

Create `packages/gateway/src/auth/api-key-adapter.ts`:

```typescript
import type { ApiKeyAuthAdapter } from '../types.js';

export function createInMemoryApiKeyAdapter(keys: Record<string, { teamId: string; keyId: string }>): ApiKeyAuthAdapter {
  return {
    async validateApiKey(rawKey: string) {
      return keys[rawKey] ?? null;
    },
  };
}
```

Create `packages/gateway/src/auth/session-store.ts`:

```typescript
import Redis from 'ioredis';
import type { SessionStoreAdapter } from '../types.js';

export function createRedisSessionStore(redisUrl: string): SessionStoreAdapter {
  const redis = new Redis(redisUrl, { lazyConnect: true });

  return {
    async getSession(sessionId: string) {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      const raw = await redis.get(`session:${sessionId}`);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as { userId: string; teamId: string; expiresAt: string };
    },
  };
}
```

Modify `packages/gateway/src/types.ts` to add Hono context vars:

```typescript
export type GatewayVars = {
  requestId: string;
  startedAtMs: number;
  principal?: AuthPrincipal;
};
```

Modify `packages/gateway/src/app.ts`:
- Apply `authMiddleware` to `/api/*` routes.
- Add temporary protected route `GET /api/teams` returning `{ ok: true }`.

```typescript
app.use('/api/*', authMiddleware(config, deps));
app.get('/api/teams', (c) => c.json({ ok: true }));
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/auth packages/gateway/src/middleware/auth.ts packages/gateway/src/app.ts packages/gateway/src/types.ts packages/gateway/src/__tests__/auth-middleware.test.ts
git commit -m "feat(gateway): add api key and redis session auth middleware"
```

### Task 4: Route Groups + OpenAPI for Specs, Agents, Teams, Artifacts

**Files:**
- Create: `packages/gateway/src/routes/specs.ts`
- Create: `packages/gateway/src/routes/agents.ts`
- Create: `packages/gateway/src/routes/teams.ts`
- Create: `packages/gateway/src/routes/artifacts.ts`
- Modify: `packages/gateway/src/app.ts`
- Create: `packages/gateway/src/__tests__/openapi-and-routes.test.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/openapi-and-routes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createGatewayApp } from '../app.js';

const config = {
  port: 3001,
  allowedOrigins: ['http://localhost:1420'],
  sessionCookieName: 'kata.sid',
  sessionCookieSecret: 'test-secret',
  redisUrl: 'redis://localhost:6379',
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 60,
};

const deps = {
  logger: { info: () => {}, error: () => {} },
  apiKeyAuth: {
    validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
  },
  sessionStore: {
    getSession: async () => null,
  },
  now: () => new Date('2026-02-26T00:00:00.000Z'),
};

describe('openapi and route groups', () => {
  it('serves openapi json', async () => {
    const app = createGatewayApp(config, deps);
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.0.0');
    expect(body.paths['/api/specs']).toBeDefined();
    expect(body.paths['/api/agents']).toBeDefined();
    expect(body.paths['/api/teams']).toBeDefined();
    expect(body.paths['/api/artifacts']).toBeDefined();
  });

  it('allows api-key-authenticated access to all route groups', async () => {
    const app = createGatewayApp(config, deps);
    const headers = { 'x-api-key': 'kat_test_1' };

    const specs = await app.request('/api/specs', { headers });
    const agents = await app.request('/api/agents', { headers });
    const teams = await app.request('/api/teams', { headers });
    const artifacts = await app.request('/api/artifacts', { headers });

    expect(specs.status).toBe(200);
    expect(agents.status).toBe(200);
    expect(teams.status).toBe(200);
    expect(artifacts.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test`  
Expected: FAIL due to missing route group registration/OpenAPI paths.

**Step 3: Write minimal implementation**

Create `packages/gateway/src/routes/specs.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const SpecsListSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string() })),
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
```

Create similar route modules for `agents.ts`, `teams.ts`, and `artifacts.ts` with `GET /api/<group>` and placeholder schemas.

Modify `packages/gateway/src/app.ts`:

```typescript
import { registerSpecsRoutes } from './routes/specs.js';
import { registerAgentsRoutes } from './routes/agents.js';
import { registerTeamsRoutes } from './routes/teams.js';
import { registerArtifactsRoutes } from './routes/artifacts.js';

registerSpecsRoutes(app);
registerAgentsRoutes(app);
registerTeamsRoutes(app);
registerArtifactsRoutes(app);
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/routes packages/gateway/src/app.ts packages/gateway/src/__tests__/openapi-and-routes.test.ts
git commit -m "feat(gateway): add protected api route groups with openapi schemas"
```

### Task 5: Basic Rate Limiting + CORS Config Verification + Logging Assertions

**Files:**
- Create: `packages/gateway/src/middleware/rate-limit.ts`
- Modify: `packages/gateway/src/app.ts`
- Create: `packages/gateway/src/__tests__/rate-limit-and-cors.test.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/rate-limit-and-cors.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../app.js';

function makeApp() {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  const app = createGatewayApp(
    {
      port: 3001,
      allowedOrigins: ['http://localhost:1420'],
      sessionCookieName: 'kata.sid',
      sessionCookieSecret: 'test-secret',
      redisUrl: 'redis://localhost:6379',
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 2,
    },
    {
      logger,
      apiKeyAuth: {
        validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
      },
      sessionStore: {
        getSession: async () => null,
      },
      now: () => new Date('2026-02-26T00:00:00.000Z'),
    },
  );

  return { app, logger };
}

describe('rate limit + cors + logging', () => {
  it('enforces rate limit on protected routes', async () => {
    const { app } = makeApp();
    const headers = {
      'x-api-key': 'kat_test_1',
      'x-forwarded-for': '10.0.0.5',
    };

    expect((await app.request('/api/specs', { headers })).status).toBe(200);
    expect((await app.request('/api/specs', { headers })).status).toBe(200);

    const blocked = await app.request('/api/specs', { headers });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('sets allow-origin header for allowed origins', async () => {
    const { app } = makeApp();
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:1420' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:1420');
  });

  it('emits request logs', async () => {
    const { app, logger } = makeApp();
    await app.request('/health');
    expect(logger.info).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test`  
Expected: FAIL due to missing rate limiter middleware and keying behavior.

**Step 3: Write minimal implementation**

Create `packages/gateway/src/middleware/rate-limit.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';
import { jsonError } from './error-handler.js';

export function createRateLimitMiddleware(windowMs: number, maxRequests: number): MiddlewareHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const now = Date.now();
    const ip = c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `${ip}:${c.req.path}`;

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return jsonError(c, 429, 'RATE_LIMITED', 'Too many requests');
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}
```

Modify `packages/gateway/src/app.ts` to apply middleware before auth:

```typescript
import { createRateLimitMiddleware } from './middleware/rate-limit.js';

app.use('/api/*', createRateLimitMiddleware(config.rateLimitWindowMs, config.rateLimitMaxRequests));
app.use('/api/*', authMiddleware(config, deps));
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/middleware/rate-limit.ts packages/gateway/src/app.ts packages/gateway/src/__tests__/rate-limit-and-cors.test.ts
git commit -m "feat(gateway): add basic rate limiting and middleware validations"
```

### Task 6: Environment Template and Verification Evidence

**Files:**
- Create: `packages/gateway/.env.example`
- Create: `docs/verification/kat-108-gateway-skeleton.md`

**Step 1: Write the failing scaffold assertion**

Append to `tests/scaffold/gateway-package.test.mjs`:

```javascript
assert.ok(fs.existsSync('packages/gateway/.env.example'), '.env example missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/gateway-package.test.mjs`  
Expected: FAIL for missing `.env.example`.

**Step 3: Write minimal implementation**

Create `packages/gateway/.env.example`:

```bash
GATEWAY_PORT=3001
GATEWAY_ALLOWED_ORIGINS=http://localhost:1420,http://localhost:5173
SESSION_COOKIE_NAME=kata.sid
SESSION_COOKIE_SECRET=replace-me-with-long-random-secret
REDIS_URL=redis://localhost:6379
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

Create `docs/verification/kat-108-gateway-skeleton.md` template:

```markdown
# KAT-108 Verification

- [ ] gateway package tooling baseline verified
- [ ] health and global error handling validated
- [ ] auth middleware validated (api key + redis session fail-closed)
- [ ] route group placeholders + OpenAPI generation validated
- [ ] rate limiting + CORS + logging behavior validated
- [ ] typecheck and tests passing
```

**Step 4: Run full verification**

Run: `node tests/scaffold/gateway-package.test.mjs`  
Run: `pnpm --filter @kata/gateway typecheck`  
Run: `pnpm --filter @kata/gateway test`

Expected: all PASS.

Then update `docs/verification/kat-108-gateway-skeleton.md` with completed checklist + command output summary.

**Step 5: Commit**

```bash
git add packages/gateway/.env.example tests/scaffold/gateway-package.test.mjs docs/verification/kat-108-gateway-skeleton.md
git commit -m "docs(verification): record KAT-108 gateway skeleton evidence"
```

## Parallel Track Guardrails (KAT-108 vs KAT-106)

Enforce the following during execution:
- Do not modify files under `packages/db/`.
- Do not add `@kata/db` dependency to `packages/gateway/package.json`.
- Keep auth persistence behind `ApiKeyAuthAdapter` and `SessionStoreAdapter` interfaces.
- Redis session lookup is required for protected route session auth; unavailable Redis returns deterministic fail-closed response.
