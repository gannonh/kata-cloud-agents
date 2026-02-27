# KAT-113: Spec Versioning System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add immutable version tracking to specs with create/list/get/diff/restore API endpoints, structured field-level diffing, and a desktop UI for browsing version history.

**Architecture:** Versioning logic lives in gateway route handlers (`packages/gateway/`). The spec-engine stays pure (no DB dependency). New columns added to the existing `spec_versions` table via Drizzle migration. Desktop UI adds version history sidebar and diff view components.

**Tech Stack:** Drizzle ORM, Hono + @hono/zod-openapi, Zod, Vitest, React, Zustand, Tailwind CSS, React Router

---

### Task 1: Extend spec_versions DB schema

**Files:**
- Modify: `packages/db/src/schema.ts:63-76` (specVersions table)
- Modify: `packages/db/src/__tests__/schema-contract.test.ts:51-53` (column assertions)

**Step 1: Write the failing test**

In `packages/db/src/__tests__/schema-contract.test.ts`, update the specVersions column assertion:

```typescript
expect(cols(specVersions)).toEqual(
  expect.arrayContaining(['id', 'specId', 'versionNumber', 'content', 'actorId', 'actorType', 'changeSummary', 'createdAt']),
);
```

**Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm test`
Expected: FAIL - missing `actorId`, `actorType`, `changeSummary` columns

**Step 3: Update the Drizzle schema**

In `packages/db/src/schema.ts`, replace the `specVersions` table definition:

```typescript
export const actorTypeEnum = pgEnum('actor_type', ['user', 'agent']);

export const specVersions = pgTable(
  'spec_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    actorId: uuid('actor_id').notNull(),
    actorType: actorTypeEnum('actor_type').notNull(),
    changeSummary: text('change_summary').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('spec_versions_spec_id_version_number_key').on(table.specId, table.versionNumber),
    index('spec_versions_spec_id_idx').on(table.specId),
  ],
);
```

Add `integer` to the `drizzle-orm/pg-core` import at the top of the file.

Also add to the enum test in `schema-contract.test.ts`:

```typescript
expect(actorTypeEnum.enumValues).toEqual(['user', 'agent']);
```

**Step 4: Run test to verify it passes**

Run: `cd packages/db && pnpm test`
Expected: PASS

**Step 5: Generate Drizzle migration**

Run: `cd packages/db && DATABASE_URL=postgresql://placeholder pnpm drizzle-kit generate`

Review the generated SQL migration file in `packages/db/drizzle/`. It should add `actor_type` enum, alter `version_number` to integer, and add the three new columns.

**Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/__tests__/schema-contract.test.ts packages/db/drizzle/
git commit -m "feat(db): add actor_id, actor_type, change_summary to spec_versions"
```

---

### Task 2: Add shared Zod schemas for versioning types

**Files:**
- Create: `packages/shared/src/schemas/spec-version.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Create: `packages/shared/src/__tests__/spec-version.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/spec-version.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  DiffEntrySchema,
  SpecVersionSchema,
  CreateVersionInputSchema,
  VersionListResponseSchema,
} from '../schemas/spec-version.js';

const uuid = '00000000-0000-4000-8000-000000000001';
const now = '2026-02-27T00:00:00.000Z';

describe('SpecVersionSchema', () => {
  const valid = {
    id: uuid,
    specId: uuid,
    versionNumber: 1,
    content: { title: 'test' },
    actorId: uuid,
    actorType: 'user' as const,
    changeSummary: 'Initial version',
    createdAt: now,
  };

  it('parses valid version', () => {
    expect(SpecVersionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects versionNumber < 1', () => {
    expect(() => SpecVersionSchema.parse({ ...valid, versionNumber: 0 })).toThrow();
  });

  it('rejects invalid actorType', () => {
    expect(() => SpecVersionSchema.parse({ ...valid, actorType: 'bot' })).toThrow();
  });
});

describe('CreateVersionInputSchema', () => {
  it('parses valid input', () => {
    const input = { content: { title: 'test' }, changeSummary: 'Updated title' };
    expect(CreateVersionInputSchema.parse(input)).toEqual(input);
  });

  it('defaults changeSummary to empty string', () => {
    const result = CreateVersionInputSchema.parse({ content: { title: 'test' } });
    expect(result.changeSummary).toBe('');
  });
});

describe('DiffEntrySchema', () => {
  it('parses changed entry', () => {
    const entry = { path: 'title', type: 'changed' as const, oldValue: 'a', newValue: 'b' };
    expect(DiffEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses added entry without oldValue', () => {
    const entry = { path: 'constraints.3', type: 'added' as const, newValue: 'new rule' };
    expect(DiffEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses removed entry without newValue', () => {
    const entry = { path: 'blockers.0', type: 'removed' as const, oldValue: { id: uuid } };
    expect(DiffEntrySchema.parse(entry)).toEqual(entry);
  });
});

describe('VersionListResponseSchema', () => {
  it('parses response with items and total', () => {
    const response = { items: [], total: 0 };
    expect(VersionListResponseSchema.parse(response)).toEqual(response);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL - module not found

**Step 3: Create the schemas**

Create `packages/shared/src/schemas/spec-version.ts`:

```typescript
import { z } from 'zod';

export const ActorTypeSchema = z.enum(['user', 'agent']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const SpecVersionSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  content: z.record(z.unknown()),
  actorId: z.string().uuid(),
  actorType: ActorTypeSchema,
  changeSummary: z.string(),
  createdAt: z.string().datetime(),
});
export type SpecVersion = z.infer<typeof SpecVersionSchema>;

export const CreateVersionInputSchema = z.object({
  content: z.record(z.unknown()),
  changeSummary: z.string().default(''),
});
export type CreateVersionInput = z.infer<typeof CreateVersionInputSchema>;

export const DiffEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['added', 'removed', 'changed']),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
});
export type DiffEntry = z.infer<typeof DiffEntrySchema>;

export const VersionListResponseSchema = z.object({
  items: z.array(SpecVersionSchema),
  total: z.number().int().nonnegative(),
});
export type VersionListResponse = z.infer<typeof VersionListResponseSchema>;
```

**Step 4: Add export to index**

In `packages/shared/src/schemas/index.ts`, add:

```typescript
export * from './spec-version.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/spec-version.ts packages/shared/src/schemas/index.ts packages/shared/src/__tests__/spec-version.test.ts
git commit -m "feat(shared): add Zod schemas for spec versioning types"
```

---

### Task 3: Implement structured diff logic

**Files:**
- Create: `packages/gateway/src/versioning/diff.ts`
- Create: `packages/gateway/src/__tests__/diff.test.ts`

**Step 1: Write the failing tests**

Create `packages/gateway/src/__tests__/diff.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { diffSpecs } from '../versioning/diff.js';

describe('diffSpecs', () => {
  it('returns empty array for identical objects', () => {
    const obj = { title: 'test', intent: 'do stuff' };
    expect(diffSpecs(obj, obj)).toEqual([]);
  });

  it('detects changed primitive field', () => {
    const old = { title: 'old title', intent: 'same' };
    const next = { title: 'new title', intent: 'same' };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'title', type: 'changed', oldValue: 'old title', newValue: 'new title' },
    ]);
  });

  it('detects added array element', () => {
    const old = { constraints: ['a', 'b'] };
    const next = { constraints: ['a', 'b', 'c'] };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'constraints.2', type: 'added', newValue: 'c' },
    ]);
  });

  it('detects removed array element', () => {
    const old = { constraints: ['a', 'b', 'c'] };
    const next = { constraints: ['a', 'b'] };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'constraints.2', type: 'removed', oldValue: 'c' },
    ]);
  });

  it('detects changed array element', () => {
    const old = { constraints: ['a', 'b'] };
    const next = { constraints: ['a', 'x'] };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'constraints.1', type: 'changed', oldValue: 'b', newValue: 'x' },
    ]);
  });

  it('recurses into nested objects', () => {
    const old = { verification: { criteria: ['test1'], testPlan: 'plan A' } };
    const next = { verification: { criteria: ['test1'], testPlan: 'plan B' } };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'verification.testPlan', type: 'changed', oldValue: 'plan A', newValue: 'plan B' },
    ]);
  });

  it('detects added top-level field', () => {
    const old = { title: 'test' };
    const next = { title: 'test', intent: 'new field' };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'intent', type: 'added', newValue: 'new field' },
    ]);
  });

  it('detects removed top-level field', () => {
    const old = { title: 'test', intent: 'old' };
    const next = { title: 'test' };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'intent', type: 'removed', oldValue: 'old' },
    ]);
  });

  it('ignores meta.updatedAt changes', () => {
    const old = { meta: { version: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' } };
    const next = { meta: { version: 1, createdAt: '2026-01-01', updatedAt: '2026-02-01' } };
    expect(diffSpecs(old, next)).toEqual([]);
  });

  it('handles multiple changes across fields', () => {
    const old = { title: 'a', intent: 'x', constraints: ['c1'] };
    const next = { title: 'b', intent: 'x', constraints: ['c1', 'c2'] };
    const result = diffSpecs(old, next);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      { path: 'title', type: 'changed', oldValue: 'a', newValue: 'b' },
      { path: 'constraints.1', type: 'added', newValue: 'c2' },
    ]));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/gateway && pnpm test`
Expected: FAIL - module not found

**Step 3: Implement diffSpecs**

Create `packages/gateway/src/versioning/diff.ts`:

```typescript
import type { DiffEntry } from '@kata/shared';

const IGNORED_PATHS = new Set(['meta.updatedAt']);

export function diffSpecs(
  oldContent: Record<string, unknown>,
  newContent: Record<string, unknown>,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  diffRecursive(oldContent, newContent, '', entries);
  return entries;
}

function diffRecursive(
  oldVal: unknown,
  newVal: unknown,
  prefix: string,
  entries: DiffEntry[],
): void {
  if (oldVal === newVal) return;
  if (typeof oldVal !== typeof newVal || oldVal === null || newVal === null) {
    if (!IGNORED_PATHS.has(prefix)) {
      entries.push({ path: prefix, type: 'changed', oldValue: oldVal, newValue: newVal });
    }
    return;
  }

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const maxLen = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < maxLen; i++) {
      const path = prefix ? `${prefix}.${i}` : `${i}`;
      if (i >= oldVal.length) {
        entries.push({ path, type: 'added', newValue: newVal[i] });
      } else if (i >= newVal.length) {
        entries.push({ path, type: 'removed', oldValue: oldVal[i] });
      } else {
        diffRecursive(oldVal[i], newVal[i], path, entries);
      }
    }
    return;
  }

  if (typeof oldVal === 'object' && typeof newVal === 'object') {
    const oldObj = oldVal as Record<string, unknown>;
    const newObj = newVal as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (IGNORED_PATHS.has(path)) continue;
      if (!(key in oldObj)) {
        entries.push({ path, type: 'added', newValue: newObj[key] });
      } else if (!(key in newObj)) {
        entries.push({ path, type: 'removed', oldValue: oldObj[key] });
      } else {
        diffRecursive(oldObj[key], newObj[key], path, entries);
      }
    }
    return;
  }

  // Primitives that differ
  if (!IGNORED_PATHS.has(prefix)) {
    entries.push({ path: prefix, type: 'changed', oldValue: oldVal, newValue: newVal });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/gateway && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/gateway/src/versioning/diff.ts packages/gateway/src/__tests__/diff.test.ts
git commit -m "feat(gateway): add structured spec diff logic"
```

---

### Task 4: Implement version API routes

**Files:**
- Modify: `packages/gateway/src/routes/specs.ts` (replace placeholder with real routes)
- Modify: `packages/gateway/src/types.ts` (add VALIDATION_ERROR to ErrorCode, add VersionStore to deps)
- Modify: `packages/gateway/src/app.ts` (no changes needed if registerSpecsRoutes signature stays the same)
- Create: `packages/gateway/src/__tests__/spec-versions.test.ts`

This is the largest task. It builds the five API endpoints. Each endpoint follows the same `createRoute()` + `app.openapi()` pattern used by existing routes.

**Step 1: Add VersionStore adapter type**

In `packages/gateway/src/types.ts`, add `VALIDATION_ERROR` to `ErrorCode`:

```typescript
export type ErrorCode =
  | 'INVALID_API_KEY'
  | 'AUTH_REQUIRED'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'HTTP_ERROR'
  | 'VALIDATION_ERROR';
```

Add the `VersionStore` adapter interface and update `GatewayDeps`:

```typescript
export type VersionStoreAdapter = {
  getSpec: (specId: string) => Promise<{ id: string; teamId: string; content: Record<string, unknown> } | null>;
  updateSpecContent: (specId: string, content: Record<string, unknown>) => Promise<void>;
  createVersion: (data: {
    specId: string;
    versionNumber: number;
    content: Record<string, unknown>;
    actorId: string;
    actorType: 'user' | 'agent';
    changeSummary: string;
  }) => Promise<{ id: string; specId: string; versionNumber: number; content: Record<string, unknown>; actorId: string; actorType: string; changeSummary: string; createdAt: Date }>;
  getVersion: (specId: string, versionNumber: number) => Promise<{ id: string; specId: string; versionNumber: number; content: Record<string, unknown>; actorId: string; actorType: string; changeSummary: string; createdAt: Date } | null>;
  listVersions: (specId: string, limit: number, offset: number) => Promise<{ items: Array<{ id: string; specId: string; versionNumber: number; content: Record<string, unknown>; actorId: string; actorType: string; changeSummary: string; createdAt: Date }>; total: number }>;
  getMaxVersionNumber: (specId: string) => Promise<number>;
};

export type GatewayDeps = {
  logger: Logger;
  apiKeyAuth: ApiKeyAuthAdapter;
  sessionStore: SessionStoreAdapter;
  channelAccess?: ChannelAccessAdapter;
  versionStore?: VersionStoreAdapter;
  now: () => Date;
};
```

**Step 2: Write the failing tests**

Create `packages/gateway/src/__tests__/spec-versions.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createGatewayApp } from '../app.js';
import type { VersionStoreAdapter } from '../types.js';

function makeConfig() {
  return {
    port: 3001,
    allowedOrigins: ['http://localhost:1420'],
    sessionCookieName: 'kata.sid',
    redisUrl: 'redis://localhost:6379',
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
    wsHeartbeatIntervalMs: 15_000,
    wsHeartbeatTimeoutMs: 30_000,
    wsMaxSubscriptionsPerConnection: 100,
  };
}

const specId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const teamId = 'team-1';

function makeVersionStore(overrides: Partial<VersionStoreAdapter> = {}): VersionStoreAdapter {
  return {
    getSpec: vi.fn(async () => ({ id: specId, teamId, content: { title: 'test' } })),
    updateSpecContent: vi.fn(async () => {}),
    createVersion: vi.fn(async (data) => ({
      id: '00000000-0000-4000-8000-000000000099',
      ...data,
      createdAt: new Date('2026-02-27T00:00:00.000Z'),
    })),
    getVersion: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000099',
      specId,
      versionNumber: 1,
      content: { title: 'test' },
      actorId,
      actorType: 'user',
      changeSummary: 'Initial',
      createdAt: new Date('2026-02-27T00:00:00.000Z'),
    })),
    listVersions: vi.fn(async () => ({
      items: [],
      total: 0,
    })),
    getMaxVersionNumber: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeDeps(overrides = {}) {
  return {
    logger: { info: () => {}, error: () => {} },
    apiKeyAuth: {
      validateApiKey: vi.fn(async () => ({ teamId, keyId: 'key-1' })),
    },
    sessionStore: { getSession: vi.fn(async () => null) },
    versionStore: makeVersionStore(),
    now: () => new Date('2026-02-27T00:00:00.000Z'),
    ...overrides,
  };
}

function authedRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'x-api-key': 'kat_live_123', ...init.headers },
  });
}

describe('POST /api/specs/:specId/versions', () => {
  it('creates a version and returns it', async () => {
    const app = createGatewayApp(makeConfig(), makeDeps());
    const res = await app.request(
      authedRequest(`/api/specs/${specId}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { title: 'updated' }, changeSummary: 'Updated title' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.versionNumber).toBe(1);
    expect(body.changeSummary).toBe('Updated title');
  });

  it('returns 404 for nonexistent spec', async () => {
    const store = makeVersionStore({ getSpec: vi.fn(async () => null) });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(
      authedRequest(`/api/specs/${specId}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { title: 'x' }, changeSummary: '' }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const app = createGatewayApp(makeConfig(), makeDeps());
    const res = await app.request(`/api/specs/${specId}/versions`, { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/specs/:specId/versions', () => {
  it('lists versions with pagination', async () => {
    const store = makeVersionStore({
      listVersions: vi.fn(async () => ({
        items: [{
          id: '00000000-0000-4000-8000-000000000099',
          specId,
          versionNumber: 1,
          content: { title: 'test' },
          actorId,
          actorType: 'user',
          changeSummary: 'Init',
          createdAt: new Date('2026-02-27T00:00:00.000Z'),
        }],
        total: 1,
      })),
    });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions?limit=10&offset=0`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

describe('GET /api/specs/:specId/versions/:versionNumber', () => {
  it('returns a single version', async () => {
    const app = createGatewayApp(makeConfig(), makeDeps());
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions/1`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versionNumber).toBe(1);
  });

  it('returns 404 for nonexistent version', async () => {
    const store = makeVersionStore({ getVersion: vi.fn(async () => null) });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions/999`));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/specs/:specId/versions/:v1/diff/:v2', () => {
  it('returns structured diff between two versions', async () => {
    const store = makeVersionStore({
      getVersion: vi.fn()
        .mockResolvedValueOnce({
          id: 'v1-id', specId, versionNumber: 1,
          content: { title: 'old' }, actorId, actorType: 'user',
          changeSummary: '', createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'v2-id', specId, versionNumber: 2,
          content: { title: 'new' }, actorId, actorType: 'user',
          changeSummary: '', createdAt: new Date(),
        }),
    });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions/1/diff/2`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { path: 'title', type: 'changed', oldValue: 'old', newValue: 'new' },
    ]);
  });

  it('returns 404 if either version missing', async () => {
    const store = makeVersionStore({
      getVersion: vi.fn().mockResolvedValueOnce(null),
    });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions/1/diff/2`));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/specs/:specId/versions/:versionNumber/restore', () => {
  it('creates a new version with restored content', async () => {
    const store = makeVersionStore({
      getVersion: vi.fn(async () => ({
        id: 'v1-id', specId, versionNumber: 1,
        content: { title: 'original' }, actorId, actorType: 'user' as const,
        changeSummary: 'First', createdAt: new Date(),
      })),
      getMaxVersionNumber: vi.fn(async () => 3),
    });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(
      authedRequest(`/api/specs/${specId}/versions/1/restore`, { method: 'POST' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.versionNumber).toBe(4);
    expect(body.changeSummary).toBe('Restored from version 1');
  });

  it('returns 404 for nonexistent version', async () => {
    const store = makeVersionStore({ getVersion: vi.fn(async () => null) });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(
      authedRequest(`/api/specs/${specId}/versions/999/restore`, { method: 'POST' }),
    );
    expect(res.status).toBe(404);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd packages/gateway && pnpm test`
Expected: FAIL - routes not implemented

**Step 4: Implement the route handlers**

Replace `packages/gateway/src/routes/specs.ts` with the full implementation. The route file should:

1. Define Zod schemas for request params/body/query and response types using `@hono/zod-openapi`
2. Create five `createRoute()` definitions (one per endpoint)
3. In `registerSpecsRoutes(app)`, register each route with `app.openapi(route, handler)`
4. Each handler:
   - Extracts the authenticated principal from `c.get('principal')`
   - Derives `actorId` and `actorType` from the principal (`session_user` -> `{ actorId: userId, actorType: 'user' }`, `api_key` -> `{ actorId: keyId, actorType: 'agent' }`)
   - Calls `versionStore` methods from `c.get()` or passed via closure
   - Returns JSON responses with appropriate status codes
   - Uses `jsonError()` for error responses

The `versionStore` should be accessible via the app's dependency injection. Since the current pattern passes deps to middleware factories, add `versionStore` access via a middleware that sets it on the context, or access it via closure in `registerSpecsRoutes`.

Update the function signature:

```typescript
export function registerSpecsRoutes(app: OpenAPIHono<GatewayEnv>, deps: GatewayDeps) {
```

And update `packages/gateway/src/app.ts` to pass `deps`:

```typescript
registerSpecsRoutes(app, deps);
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/gateway && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/gateway/src/routes/specs.ts packages/gateway/src/types.ts packages/gateway/src/app.ts packages/gateway/src/__tests__/spec-versions.test.ts
git commit -m "feat(gateway): add spec version CRUD, diff, and restore endpoints"
```

---

### Task 5: Desktop UI - Version history store

**Files:**
- Create: `apps/desktop/src/store/versions.ts`
- Create: `tests/unit/desktop/versions-store.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/desktop/versions-store.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useVersionStore } from '../../../apps/desktop/src/store/versions';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  useVersionStore.getState().reset();
  mockFetch.mockReset();
});

describe('useVersionStore', () => {
  it('starts with empty state', () => {
    const state = useVersionStore.getState();
    expect(state.versions).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.selectedVersion).toBeNull();
    expect(state.diffResult).toBeNull();
  });

  it('fetchVersions populates versions list', async () => {
    const specId = 'spec-1';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'v1', specId, versionNumber: 1, content: {}, actorId: 'a', actorType: 'user', changeSummary: 'Init', createdAt: '2026-01-01T00:00:00Z' }],
        total: 1,
      }),
    });

    await useVersionStore.getState().fetchVersions(specId);
    const state = useVersionStore.getState();
    expect(state.versions).toHaveLength(1);
    expect(state.total).toBe(1);
    expect(state.loading).toBe(false);
  });

  it('fetchDiff populates diffResult', async () => {
    const specId = 'spec-1';
    const diffEntries = [{ path: 'title', type: 'changed', oldValue: 'a', newValue: 'b' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => diffEntries });

    await useVersionStore.getState().fetchDiff(specId, 1, 2);
    expect(useVersionStore.getState().diffResult).toEqual(diffEntries);
  });

  it('restoreVersion calls POST and refreshes list', async () => {
    const specId = 'spec-1';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'v3', versionNumber: 3 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], total: 0 }) });

    await useVersionStore.getState().restoreVersion(specId, 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/desktop/versions-store.test.ts`
Expected: FAIL - module not found

**Step 3: Implement the store**

Create `apps/desktop/src/store/versions.ts`:

```typescript
import { create } from 'zustand';

interface SpecVersion {
  id: string;
  specId: string;
  versionNumber: number;
  content: Record<string, unknown>;
  actorId: string;
  actorType: 'user' | 'agent';
  changeSummary: string;
  createdAt: string;
}

interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

interface VersionState {
  versions: SpecVersion[];
  total: number;
  loading: boolean;
  selectedVersion: SpecVersion | null;
  diffResult: DiffEntry[] | null;
  fetchVersions: (specId: string, limit?: number, offset?: number) => Promise<void>;
  fetchVersion: (specId: string, versionNumber: number) => Promise<void>;
  fetchDiff: (specId: string, v1: number, v2: number) => Promise<void>;
  restoreVersion: (specId: string, versionNumber: number) => Promise<void>;
  reset: () => void;
}

const API_BASE = '/api/specs';

export const useVersionStore = create<VersionState>()((set, get) => ({
  versions: [],
  total: 0,
  loading: false,
  selectedVersion: null,
  diffResult: null,

  fetchVersions: async (specId, limit = 50, offset = 0) => {
    set({ loading: true });
    const res = await fetch(`${API_BASE}/${specId}/versions?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    set({ versions: data.items, total: data.total, loading: false });
  },

  fetchVersion: async (specId, versionNumber) => {
    set({ loading: true });
    const res = await fetch(`${API_BASE}/${specId}/versions/${versionNumber}`);
    const data = await res.json();
    set({ selectedVersion: data, loading: false });
  },

  fetchDiff: async (specId, v1, v2) => {
    set({ loading: true });
    const res = await fetch(`${API_BASE}/${specId}/versions/${v1}/diff/${v2}`);
    const data = await res.json();
    set({ diffResult: data, loading: false });
  },

  restoreVersion: async (specId, versionNumber) => {
    set({ loading: true });
    await fetch(`${API_BASE}/${specId}/versions/${versionNumber}/restore`, { method: 'POST' });
    await get().fetchVersions(specId);
    set({ loading: false });
  },

  reset: () => set({ versions: [], total: 0, loading: false, selectedVersion: null, diffResult: null }),
}));
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/desktop/versions-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/store/versions.ts tests/unit/desktop/versions-store.test.ts
git commit -m "feat(desktop): add Zustand store for spec version management"
```

---

### Task 6: Desktop UI - Version history sidebar component

**Files:**
- Create: `apps/desktop/src/components/VersionHistory.tsx`
- Create: `tests/unit/desktop/version-history.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/desktop/version-history.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionHistory } from '../../../apps/desktop/src/components/VersionHistory';

const mockVersions = [
  {
    id: 'v2', specId: 'spec-1', versionNumber: 2,
    content: {}, actorId: 'user-1', actorType: 'user' as const,
    changeSummary: 'Updated constraints', createdAt: '2026-02-27T12:00:00Z',
  },
  {
    id: 'v1', specId: 'spec-1', versionNumber: 1,
    content: {}, actorId: 'agent-1', actorType: 'agent' as const,
    changeSummary: 'Initial version', createdAt: '2026-02-27T00:00:00Z',
  },
];

describe('VersionHistory', () => {
  it('renders version list', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('Updated constraints')).toBeDefined();
    expect(screen.getByText('Initial version')).toBeDefined();
  });

  it('shows actor type badges', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText('user')).toBeDefined();
    expect(screen.getByText('agent')).toBeDefined();
  });

  it('calls onSelectVersion when clicking a version', () => {
    const onSelect = vi.fn();
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={onSelect}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('v2'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('calls onRestore when clicking restore button', () => {
    const onRestore = vi.fn();
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={onRestore}
      />,
    );
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    fireEvent.click(restoreButtons[0]);
    expect(onRestore).toHaveBeenCalledWith(2);
  });

  it('renders empty state when no versions', () => {
    render(
      <VersionHistory
        versions={[]}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText(/no versions/i)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/desktop/version-history.test.tsx`
Expected: FAIL - module not found

**Step 3: Implement the component**

Create `apps/desktop/src/components/VersionHistory.tsx`:

```tsx
interface SpecVersion {
  id: string;
  specId: string;
  versionNumber: number;
  content: Record<string, unknown>;
  actorId: string;
  actorType: 'user' | 'agent';
  changeSummary: string;
  createdAt: string;
}

interface VersionHistoryProps {
  versions: SpecVersion[];
  onSelectVersion: (versionNumber: number) => void;
  onCompare: (v1: number, v2: number) => void;
  onRestore: (versionNumber: number) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function VersionHistory({ versions, onSelectVersion, onCompare, onRestore }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-400">
        No versions yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Version History</h3>
      {versions.map((version, index) => (
        <div
          key={version.id}
          className="rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-slate-500 transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
              onClick={() => onSelectVersion(version.versionNumber)}
            >
              v{version.versionNumber}
            </button>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              version.actorType === 'agent'
                ? 'bg-purple-900 text-purple-300'
                : 'bg-blue-900 text-blue-300'
            }`}>
              {version.actorType}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            {version.changeSummary || 'No summary'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{formatRelativeTime(version.createdAt)}</span>
            <div className="flex gap-1">
              {index < versions.length - 1 && (
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-700"
                  onClick={() => onCompare(versions[index + 1].versionNumber, version.versionNumber)}
                >
                  Compare
                </button>
              )}
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-700"
                onClick={() => onRestore(version.versionNumber)}
                aria-label={`Restore version ${version.versionNumber}`}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/desktop/version-history.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/components/VersionHistory.tsx tests/unit/desktop/version-history.test.tsx
git commit -m "feat(desktop): add version history sidebar component"
```

---

### Task 7: Desktop UI - Diff view component

**Files:**
- Create: `apps/desktop/src/components/DiffView.tsx`
- Create: `tests/unit/desktop/diff-view.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/desktop/diff-view.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffView } from '../../../apps/desktop/src/components/DiffView';

describe('DiffView', () => {
  it('renders changed entries with old and new values', () => {
    const entries = [
      { path: 'title', type: 'changed' as const, oldValue: 'Old Title', newValue: 'New Title' },
    ];
    render(<DiffView entries={entries} fromVersion={1} toVersion={2} />);
    expect(screen.getByText('title')).toBeDefined();
    expect(screen.getByText('"Old Title"')).toBeDefined();
    expect(screen.getByText('"New Title"')).toBeDefined();
  });

  it('renders added entries', () => {
    const entries = [
      { path: 'constraints.2', type: 'added' as const, newValue: 'new constraint' },
    ];
    render(<DiffView entries={entries} fromVersion={1} toVersion={2} />);
    expect(screen.getByText('constraints.2')).toBeDefined();
    expect(screen.getByText(/added/i)).toBeDefined();
  });

  it('renders removed entries', () => {
    const entries = [
      { path: 'blockers.0', type: 'removed' as const, oldValue: { id: '123', description: 'stale' } },
    ];
    render(<DiffView entries={entries} fromVersion={1} toVersion={2} />);
    expect(screen.getByText('blockers.0')).toBeDefined();
    expect(screen.getByText(/removed/i)).toBeDefined();
  });

  it('renders empty state for no differences', () => {
    render(<DiffView entries={[]} fromVersion={1} toVersion={2} />);
    expect(screen.getByText(/no differences/i)).toBeDefined();
  });

  it('shows version comparison header', () => {
    render(<DiffView entries={[]} fromVersion={1} toVersion={2} />);
    expect(screen.getByText(/v1.*v2/i)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/desktop/diff-view.test.tsx`
Expected: FAIL - module not found

**Step 3: Implement the component**

Create `apps/desktop/src/components/DiffView.tsx`:

```tsx
interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

interface DiffViewProps {
  entries: DiffEntry[];
  fromVersion: number;
  toVersion: number;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  return JSON.stringify(value, null, 2);
}

export function DiffView({ entries, fromVersion, toVersion }: DiffViewProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">
        Comparing v{fromVersion} to v{toVersion}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No differences found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.path}
              className={`rounded-lg border p-3 text-sm ${
                entry.type === 'added'
                  ? 'border-green-800 bg-green-950'
                  : entry.type === 'removed'
                    ? 'border-red-800 bg-red-950'
                    : 'border-yellow-800 bg-yellow-950'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <code className="text-xs font-mono text-slate-300">{entry.path}</code>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  entry.type === 'added'
                    ? 'bg-green-900 text-green-300'
                    : entry.type === 'removed'
                      ? 'bg-red-900 text-red-300'
                      : 'bg-yellow-900 text-yellow-300'
                }`}>
                  {entry.type}
                </span>
              </div>
              <div className="font-mono text-xs">
                {entry.oldValue !== undefined && (
                  <div className="text-red-400">
                    <span className="text-red-600 mr-1">-</span>
                    {formatValue(entry.oldValue)}
                  </div>
                )}
                {entry.newValue !== undefined && (
                  <div className="text-green-400">
                    <span className="text-green-600 mr-1">+</span>
                    {formatValue(entry.newValue)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/desktop/diff-view.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/components/DiffView.tsx tests/unit/desktop/diff-view.test.tsx
git commit -m "feat(desktop): add structured diff view component"
```

---

### Task 8: Wire up Specs page with version history

**Files:**
- Modify: `apps/desktop/src/pages/Specs.tsx`
- Modify: `apps/desktop/src/routes.ts` (add spec detail route)
- Modify: `apps/desktop/src/App.tsx` (no changes needed, routes auto-registered)
- Create: `tests/unit/desktop/specs-page.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/desktop/specs-page.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpecDetail } from '../../../apps/desktop/src/pages/SpecDetail';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SpecDetail', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
  });

  it('renders version history panel', async () => {
    render(
      <MemoryRouter initialEntries={['/specs/spec-1']}>
        <Routes>
          <Route path="/specs/:specId" element={<SpecDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Version History')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/desktop/specs-page.test.tsx`
Expected: FAIL - module not found

**Step 3: Create SpecDetail page and update routes**

Create `apps/desktop/src/pages/SpecDetail.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { VersionHistory } from '../components/VersionHistory';
import { DiffView } from '../components/DiffView';
import { useVersionStore } from '../store/versions';

export function SpecDetail() {
  const { specId } = useParams<{ specId: string }>();
  const { versions, total, loading, diffResult, fetchVersions, fetchDiff, restoreVersion, reset } = useVersionStore();
  const [diffRange, setDiffRange] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (specId) {
      fetchVersions(specId);
    }
    return () => reset();
  }, [specId, fetchVersions, reset]);

  const handleCompare = (v1: number, v2: number) => {
    if (!specId) return;
    setDiffRange({ from: v1, to: v2 });
    fetchDiff(specId, v1, v2);
  };

  const handleRestore = async (versionNumber: number) => {
    if (!specId) return;
    await restoreVersion(specId, versionNumber);
    setDiffRange(null);
  };

  const handleSelectVersion = (versionNumber: number) => {
    // Select version for viewing - extend later with full content display
  };

  if (!specId) return null;

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold">Spec Detail</h1>
        {diffRange && diffResult && (
          <DiffView entries={diffResult} fromVersion={diffRange.from} toVersion={diffRange.to} />
        )}
      </div>
      <div className="w-80 border-l border-slate-700 overflow-y-auto">
        <VersionHistory
          versions={versions}
          onSelectVersion={handleSelectVersion}
          onCompare={handleCompare}
          onRestore={handleRestore}
        />
      </div>
    </div>
  );
}
```

Add the route in `apps/desktop/src/routes.ts` - add import and route entry:

```typescript
import { SpecDetail } from './pages/SpecDetail';

// Add to routes array after the /specs entry:
{ path: '/specs/:specId', label: 'Spec Detail', icon: FileText, component: SpecDetail },
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/desktop/specs-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/pages/SpecDetail.tsx apps/desktop/src/routes.ts tests/unit/desktop/specs-page.test.tsx
git commit -m "feat(desktop): wire up spec detail page with version history and diff view"
```

---

### Task 9: E2E tests - API lifecycle

**Files:**
- Create: `tests/e2e/spec-versions.test.ts`

**Step 1: Write E2E tests**

Create `tests/e2e/spec-versions.test.ts`. These tests exercise the full version lifecycle through the API:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createGatewayApp } from '../../packages/gateway/src/app.js';
import type { VersionStoreAdapter } from '../../packages/gateway/src/types.js';

/**
 * E2E-style integration tests for the spec version lifecycle.
 * Uses an in-memory VersionStore to simulate the full flow
 * without requiring a database connection.
 */

const specId = '00000000-0000-4000-8000-000000000001';
const teamId = 'team-1';

function makeConfig() {
  return {
    port: 3001,
    allowedOrigins: ['*'],
    sessionCookieName: 'kata.sid',
    redisUrl: 'redis://localhost:6379',
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 1000,
    wsHeartbeatIntervalMs: 15_000,
    wsHeartbeatTimeoutMs: 30_000,
    wsMaxSubscriptionsPerConnection: 100,
  };
}

function createInMemoryVersionStore(): VersionStoreAdapter {
  const versions: Array<{
    id: string; specId: string; versionNumber: number;
    content: Record<string, unknown>; actorId: string; actorType: string;
    changeSummary: string; createdAt: Date;
  }> = [];
  let specContent: Record<string, unknown> = { title: 'Original' };
  let idCounter = 0;

  return {
    getSpec: async (id) => id === specId ? { id, teamId, content: specContent } : null,
    updateSpecContent: async (_id, content) => { specContent = content; },
    createVersion: async (data) => {
      const version = {
        id: `version-${++idCounter}`,
        ...data,
        createdAt: new Date(),
      };
      versions.push(version);
      specContent = data.content;
      return version;
    },
    getVersion: async (_specId, versionNumber) =>
      versions.find((v) => v.versionNumber === versionNumber) ?? null,
    listVersions: async (_specId, limit, offset) => ({
      items: versions
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .slice(offset, offset + limit),
      total: versions.length,
    }),
    getMaxVersionNumber: async () =>
      versions.length === 0 ? 0 : Math.max(...versions.map((v) => v.versionNumber)),
  };
}

function makeDeps(versionStore: VersionStoreAdapter) {
  return {
    logger: { info: () => {}, error: () => {} },
    apiKeyAuth: {
      validateApiKey: vi.fn(async () => ({ teamId, keyId: 'key-1' })),
    },
    sessionStore: { getSession: vi.fn(async () => null) },
    versionStore,
    now: () => new Date('2026-02-27T00:00:00.000Z'),
  };
}

function authedRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'x-api-key': 'kat_live_123', 'content-type': 'application/json', ...init.headers },
  });
}

describe('Spec version lifecycle (E2E)', () => {
  it('create -> list -> diff -> restore full flow', async () => {
    const store = createInMemoryVersionStore();
    const app = createGatewayApp(makeConfig(), makeDeps(store));

    // Create version 1
    const r1 = await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Version 1' }, changeSummary: 'Initial' }),
    }));
    expect(r1.status).toBe(201);
    const v1 = await r1.json();
    expect(v1.versionNumber).toBe(1);

    // Create version 2
    const r2 = await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Version 2', intent: 'added field' }, changeSummary: 'Added intent' }),
    }));
    expect(r2.status).toBe(201);
    const v2 = await r2.json();
    expect(v2.versionNumber).toBe(2);

    // Create version 3
    const r3 = await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Version 3', intent: 'updated' }, changeSummary: 'Updated intent' }),
    }));
    expect(r3.status).toBe(201);

    // List versions - should show 3, newest first
    const listRes = await app.request(authedRequest(`/api/specs/${specId}/versions`));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.total).toBe(3);
    expect(list.items[0].versionNumber).toBe(3);

    // Diff v1 vs v2
    const diffRes = await app.request(authedRequest(`/api/specs/${specId}/versions/1/diff/2`));
    expect(diffRes.status).toBe(200);
    const diff = await diffRes.json();
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'title', type: 'changed' }),
    ]));

    // Restore version 1
    const restoreRes = await app.request(authedRequest(`/api/specs/${specId}/versions/1/restore`, {
      method: 'POST',
    }));
    expect(restoreRes.status).toBe(201);
    const restored = await restoreRes.json();
    expect(restored.versionNumber).toBe(4);
    expect(restored.changeSummary).toBe('Restored from version 1');
    expect(restored.content).toEqual({ title: 'Version 1' });
  });
});

describe('Auth boundary (E2E)', () => {
  it('rejects unauthenticated requests on all version endpoints', async () => {
    const store = createInMemoryVersionStore();
    const app = createGatewayApp(makeConfig(), makeDeps(store));

    const endpoints = [
      { method: 'GET', path: `/api/specs/${specId}/versions` },
      { method: 'GET', path: `/api/specs/${specId}/versions/1` },
      { method: 'POST', path: `/api/specs/${specId}/versions` },
      { method: 'GET', path: `/api/specs/${specId}/versions/1/diff/2` },
      { method: 'POST', path: `/api/specs/${specId}/versions/1/restore` },
    ];

    for (const ep of endpoints) {
      const res = await app.request(`http://localhost${ep.path}`, { method: ep.method });
      expect(res.status).toBe(401);
    }
  });
});

describe('Team isolation (E2E)', () => {
  it('returns 404 when spec belongs to different team', async () => {
    const store = createInMemoryVersionStore();
    // Override getSpec to return a spec from a different team
    store.getSpec = async () => ({ id: specId, teamId: 'other-team', content: {} });

    const deps = makeDeps(store);
    const app = createGatewayApp(makeConfig(), deps);

    const res = await app.request(authedRequest(`/api/specs/${specId}/versions`));
    // The handler should check teamId matches principal's teamId
    expect(res.status).toBe(404);
  });
});

describe('Edge cases (E2E)', () => {
  it('diff returns empty array for identical versions', async () => {
    const store = createInMemoryVersionStore();
    const app = createGatewayApp(makeConfig(), makeDeps(store));

    // Create two identical versions
    await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Same' }, changeSummary: 'v1' }),
    }));
    await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Same' }, changeSummary: 'v2' }),
    }));

    const diffRes = await app.request(authedRequest(`/api/specs/${specId}/versions/1/diff/2`));
    expect(diffRes.status).toBe(200);
    const diff = await diffRes.json();
    expect(diff).toEqual([]);
  });

  it('returns 404 when creating version on nonexistent spec', async () => {
    const store = createInMemoryVersionStore();
    const app = createGatewayApp(makeConfig(), makeDeps(store));

    const res = await app.request(authedRequest('/api/specs/00000000-0000-4000-8000-999999999999/versions', {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'x' }, changeSummary: '' }),
    }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when restoring nonexistent version', async () => {
    const store = createInMemoryVersionStore();
    const app = createGatewayApp(makeConfig(), makeDeps(store));

    const res = await app.request(authedRequest(`/api/specs/${specId}/versions/999/restore`, {
      method: 'POST',
    }));
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run tests**

Run: `pnpm vitest run tests/e2e/spec-versions.test.ts`
Expected: PASS (once Task 4 is complete)

**Step 3: Commit**

```bash
git add tests/e2e/spec-versions.test.ts
git commit -m "test(e2e): add spec version lifecycle, auth boundary, and edge case tests"
```

---

### Task 10: Final verification and cleanup

**Step 1: Run full test suite**

Run: `pnpm turbo test`
Expected: All tests pass across all packages

**Step 2: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: No type errors

**Step 3: Run lint**

Run: `pnpm turbo lint`
Expected: No lint errors. Fix any that appear.

**Step 4: Commit any fixes**

If lint/typecheck required fixes:

```bash
git add -A
git commit -m "fix: address lint and type errors from spec versioning implementation"
```
