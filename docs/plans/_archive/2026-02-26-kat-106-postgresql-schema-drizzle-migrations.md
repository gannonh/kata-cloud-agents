# KAT-106 PostgreSQL Schema + Drizzle Migrations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `packages/db` with a production-grade Drizzle PostgreSQL schema, initial migrations, and local Docker Compose services for Postgres + Redis.

**Architecture:** Keep `packages/db` as the sole owner of persistence schema and migration history. Define tables and enums in Drizzle first, generate immutable SQL migrations, and validate both schema contracts and migration artifacts with automated tests. Add local infra and smoke checks so downstream tickets can depend on a reproducible database baseline.

**Tech Stack:** TypeScript 5.8, Drizzle ORM, Drizzle Kit, PostgreSQL 16, Redis 7, Vitest 3.2, Node.js 22, pnpm workspaces, Docker Compose

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

### Task 1: DB Package Tooling Baseline

**Files:**
- Modify: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/src/index.ts`
- Test: `tests/scaffold/db-package.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/db-package.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/db/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/db');
assert.equal(pkg.type, 'module');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.scripts['db:generate'], 'db:generate script missing');
assert.ok(pkg.scripts['db:migrate'], 'db:migrate script missing');
assert.ok(pkg.dependencies['drizzle-orm'], 'drizzle-orm dependency missing');
assert.ok(pkg.dependencies['pg'], 'pg dependency missing');
assert.ok(pkg.devDependencies['drizzle-kit'], 'drizzle-kit devDependency missing');

assert.ok(fs.existsSync('packages/db/tsconfig.json'), 'packages/db/tsconfig.json missing');
assert.ok(fs.existsSync('packages/db/vitest.config.ts'), 'packages/db/vitest.config.ts missing');
assert.ok(fs.existsSync('packages/db/src/index.ts'), 'packages/db/src/index.ts missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/db-package.test.mjs`  
Expected: FAIL with missing scripts/dependencies/config files.

**Step 3: Write minimal implementation**

Install dependencies:

Run: `pnpm --filter @kata/db add drizzle-orm pg dotenv`  
Run: `pnpm --filter @kata/db add -D drizzle-kit vitest tsx @types/node`

Replace `packages/db/package.json` with:

```json
{
  "name": "@kata/db",
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
    "build": "tsc --build",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/migrate.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "drizzle-orm": "^0.40.0",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "drizzle-kit": "^0.30.6",
    "tsx": "^4.19.3",
    "vitest": "^3.2.4"
  }
}
```

Create `packages/db/tsconfig.json`:

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

Create `packages/db/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

Create `packages/db/src/index.ts`:

```typescript
export * from './schema.js';
export * from './client.js';
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/db-package.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/vitest.config.ts packages/db/src/index.ts tests/scaffold/db-package.test.mjs pnpm-lock.yaml
git commit -m "feat(db): bootstrap drizzle package tooling"
```

### Task 2: Implement Drizzle Schema for Core Tables

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/src/__tests__/schema-contract.test.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Write the failing test**

Create `packages/db/src/__tests__/schema-contract.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  teamRoleEnum,
  specStatusEnum,
  agentRunStatusEnum,
  taskStatusEnum,
  users,
  teams,
  teamMembers,
  specs,
  specVersions,
  agentRuns,
  tasks,
  artifacts,
  auditLog,
  apiKeys,
} from '../schema.js';

describe('db enums', () => {
  it('defines expected enum values', () => {
    expect(teamRoleEnum.enumValues).toEqual(['admin', 'member', 'viewer']);
    expect(specStatusEnum.enumValues).toEqual(['draft', 'active', 'paused', 'completed', 'archived']);
    expect(agentRunStatusEnum.enumValues).toEqual(['queued', 'running', 'completed', 'failed', 'cancelled']);
    expect(taskStatusEnum.enumValues).toEqual(['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']);
  });
});

describe('table exports', () => {
  it('exports all required tables', () => {
    expect(users).toBeDefined();
    expect(teams).toBeDefined();
    expect(teamMembers).toBeDefined();
    expect(specs).toBeDefined();
    expect(specVersions).toBeDefined();
    expect(agentRuns).toBeDefined();
    expect(tasks).toBeDefined();
    expect(artifacts).toBeDefined();
    expect(auditLog).toBeDefined();
    expect(apiKeys).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/db test`  
Expected: FAIL due to missing `schema.ts` exports.

**Step 3: Write minimal implementation**

Create `packages/db/src/schema.ts`:

```typescript
import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const teamRoleEnum = pgEnum('team_role', ['admin', 'member', 'viewer']);
export const specStatusEnum = pgEnum('spec_status', ['draft', 'active', 'paused', 'completed', 'archived']);
export const agentRunStatusEnum = pgEnum('agent_run_status', ['queued', 'running', 'completed', 'failed', 'cancelled']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable(
  'team_members',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.teamId] }),
    index('team_members_team_id_idx').on(table.teamId),
  ],
);

export const specs = pgTable(
  'specs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    status: specStatusEnum('status').notNull().default('draft'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('specs_team_id_idx').on(table.teamId)],
);

export const specVersions = pgTable(
  'spec_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    versionNumber: text('version_number').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('spec_versions_spec_id_version_number_key').on(table.specId, table.versionNumber),
    index('spec_versions_spec_id_idx').on(table.specId),
  ],
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    agentRole: text('agent_role').notNull(),
    status: agentRunStatusEnum('status').notNull().default('queued'),
    environmentId: uuid('environment_id').notNull(),
    model: text('model').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('agent_runs_spec_id_idx').on(table.specId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    status: taskStatusEnum('status').notNull().default('pending'),
    dependsOn: uuid('depends_on').array().notNull().default(sql`ARRAY[]::uuid[]`),
    result: jsonb('result').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('tasks_spec_id_idx').on(table.specId),
    index('tasks_agent_run_id_idx').on(table.agentRunId),
  ],
);

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentRunId: uuid('agent_run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    path: text('path').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [index('artifacts_agent_run_id_idx').on(table.agentRunId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('audit_log_team_id_idx').on(table.teamId)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('api_keys_team_id_idx').on(table.teamId),
    index('api_keys_created_by_idx').on(table.createdBy),
  ],
);

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  specs: many(specs),
  auditEvents: many(auditLog),
  apiKeys: many(apiKeys),
}));
```

Create `packages/db/src/client.ts`:

```typescript
import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new pg.Pool({ connectionString });
export const db = drizzle(pool);
```

Create `packages/db/src/migrate.ts`:

```typescript
import { config as loadEnv } from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

loadEnv();

await migrate(db, { migrationsFolder: 'drizzle' });
await pool.end();
```

Replace `packages/db/src/index.ts` with:

```typescript
export * from './schema.js';
export * from './client.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/db test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/client.ts packages/db/src/migrate.ts packages/db/src/index.ts packages/db/src/__tests__/schema-contract.test.ts
git commit -m "feat(db): add core drizzle schema and db client"
```

### Task 3: Generate and Validate Initial Migration Artifacts

**Files:**
- Create: `packages/db/drizzle.config.ts`
- Create: `tests/scaffold/db-migration-artifacts.test.mjs`
- Create/Modify: `packages/db/drizzle/*` (generated migration SQL + meta)

**Step 1: Write the failing test**

Create `tests/scaffold/db-migration-artifacts.test.mjs`:

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('packages/db/drizzle.config.ts'), 'drizzle config missing');
assert.ok(fs.existsSync('packages/db/drizzle'), 'drizzle output directory missing');

const files = fs.readdirSync('packages/db/drizzle').filter((f) => f.endsWith('.sql'));
assert.ok(files.length > 0, 'no SQL migration file generated');

const sql = fs.readFileSync(`packages/db/drizzle/${files[0]}`, 'utf8');
for (const table of [
  'users',
  'teams',
  'team_members',
  'specs',
  'spec_versions',
  'agent_runs',
  'tasks',
  'artifacts',
  'audit_log',
  'api_keys',
]) {
  assert.match(sql, new RegExp(`create table\\s+"${table}"`, 'i'), `missing CREATE TABLE for ${table}`);
}
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/db-migration-artifacts.test.mjs`  
Expected: FAIL due to missing config and migration output.

**Step 3: Write minimal implementation**

Create `packages/db/drizzle.config.ts`:

```typescript
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for drizzle-kit');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
```

Run migration generation:

Run: `cd packages/db && DATABASE_URL=postgres://postgres:postgres@localhost:5432/kata pnpm db:generate`

Note: Commit the generated `packages/db/drizzle/*.sql` and `packages/db/drizzle/meta/*` files.

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/db-migration-artifacts.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/db/drizzle.config.ts packages/db/drizzle tests/scaffold/db-migration-artifacts.test.mjs
git commit -m "feat(db): generate initial drizzle migration"
```

### Task 4: Local Postgres + Redis Compose and Migration Smoke Test

**Files:**
- Create: `containers/docker-compose.yml`
- Create: `packages/db/.env.example`
- Create: `packages/db/scripts/migration-smoke.mjs`
- Modify: `packages/db/package.json`
- Test: `tests/scaffold/db-compose.test.mjs`

**Step 1: Write the failing test**

Create `tests/scaffold/db-compose.test.mjs`:

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('containers/docker-compose.yml'), 'compose file missing');
const compose = fs.readFileSync('containers/docker-compose.yml', 'utf8');

assert.match(compose, /postgres:/, 'postgres service missing');
assert.match(compose, /redis:/, 'redis service missing');
assert.match(compose, /5432:5432/, 'postgres port missing');
assert.match(compose, /6379:6379/, 'redis port missing');
assert.match(compose, /healthcheck:/, 'healthcheck missing');

assert.ok(fs.existsSync('packages/db/.env.example'), '.env example missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/db-compose.test.mjs`  
Expected: FAIL due to missing compose/env files.

**Step 3: Write minimal implementation**

Create `containers/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kata
    ports:
      - '5432:5432'
    volumes:
      - kata-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d kata']
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: ['redis-server', '--save', '', '--appendonly', 'no']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 20

volumes:
  kata-postgres-data:
```

Create `packages/db/.env.example`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kata
REDIS_URL=redis://localhost:6379
```

Create `packages/db/scripts/migration-smoke.mjs`:

```javascript
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new pg.Pool({ connectionString });

const expected = [
  'users',
  'teams',
  'team_members',
  'specs',
  'spec_versions',
  'agent_runs',
  'tasks',
  'artifacts',
  'audit_log',
  'api_keys',
];

const result = await pool.query(
  `
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name;
  `,
);

const actual = new Set(result.rows.map((row) => row.table_name));
for (const table of expected) {
  if (!actual.has(table)) {
    throw new Error(`missing table after migration: ${table}`);
  }
}

await pool.end();
console.log('migration smoke check passed');
```

Update `packages/db/package.json` scripts:

```json
{
  "scripts": {
    "db:up": "docker compose -f ../../containers/docker-compose.yml up -d",
    "db:down": "docker compose -f ../../containers/docker-compose.yml down",
    "db:smoke": "node scripts/migration-smoke.mjs"
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `node tests/scaffold/db-compose.test.mjs`  
Expected: PASS.

Run migration smoke sequence:

Run: `cd packages/db && cp .env.example .env && pnpm db:up && pnpm db:migrate && pnpm db:smoke`  
Expected: PASS with `migration smoke check passed`.

Cleanup:

Run: `cd packages/db && pnpm db:down`

**Step 5: Commit**

```bash
git add containers/docker-compose.yml packages/db/.env.example packages/db/scripts/migration-smoke.mjs packages/db/package.json tests/scaffold/db-compose.test.mjs
git commit -m "feat(infra): add local postgres redis compose and migration smoke test"
```

### Task 5: End-to-End Verification and Project Evidence

**Files:**
- Create: `docs/verification/kat-106-postgres-schema.md`

**Step 1: Write the failing verification checklist artifact**

Create `docs/verification/kat-106-postgres-schema.md` with this template:

```markdown
# KAT-106 Verification

- [ ] package tooling baseline verified
- [ ] schema contract tests passing
- [ ] migration artifacts generated and validated
- [ ] compose services boot and healthy
- [ ] migration smoke test passes
```

**Step 2: Run full verification before finalizing**

Run: `node tests/scaffold/db-package.test.mjs`  
Run: `pnpm --filter @kata/db test`  
Run: `node tests/scaffold/db-migration-artifacts.test.mjs`  
Run: `node tests/scaffold/db-compose.test.mjs`  
Run: `pnpm --filter @kata/db typecheck`

Expected: all PASS.

**Step 3: Update verification evidence with actual command output summaries**

Mark checklist complete and add command/date evidence to `docs/verification/kat-106-postgres-schema.md`.

**Step 4: Commit**

```bash
git add docs/verification/kat-106-postgres-schema.md
git commit -m "docs(verification): record KAT-106 schema and migration verification"
```
