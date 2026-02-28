# Convex Adoption Migration Implementation Plan

**Goal:** Replace the current Postgres/Drizzle scaffold with a Convex-based baseline so future milestone work starts from the adopted data layer.

**Architecture:** Keep `packages/db` as the repo’s data-layer package, but repurpose it from a SQL migration package into the Convex integration boundary. Update test contracts first, then replace package tooling and source files, then remove Postgres-specific infrastructure assumptions, and finally revise project documentation to reflect the new backend direction.

**Tech Stack:** Convex CLI and TypeScript tooling, pnpm workspaces, Vitest, Node.js scripts, existing scaffold tests, repository planning docs.

---

## Implementation Tasks

### Task 1: Rewrite the `@kata/db` Package Contract Around Convex

**Files:**
- Modify: `tests/scaffold/db-package.test.mjs`
- Modify: `packages/db/package.json`
- Create: `packages/db/convex.json`

**Step 1: Write the failing test**

Update `tests/scaffold/db-package.test.mjs` so it enforces the new contract:

- `convex` exists in dependencies or devDependencies
- `db:dev` exists and runs Convex locally
- `db:deploy` exists for deployment
- `db:codegen` exists for generated types
- `drizzle-orm`, `pg`, and `drizzle-kit` are no longer required
- `packages/db/convex.json` exists

```js
assert.ok(pkg.scripts['db:dev'], 'db:dev script missing');
assert.ok(pkg.scripts['db:deploy'], 'db:deploy script missing');
assert.ok(pkg.scripts['db:codegen'], 'db:codegen script missing');
assert.ok(pkg.dependencies.convex || pkg.devDependencies?.convex, 'convex dependency missing');
assert.ok(!pkg.dependencies['drizzle-orm'], 'drizzle-orm should be removed');
assert.ok(!pkg.dependencies.pg, 'pg should be removed');
assert.ok(!pkg.devDependencies['drizzle-kit'], 'drizzle-kit should be removed');
assert.ok(fs.existsSync('packages/db/convex.json'), 'packages/db/convex.json missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/db-package.test.mjs`  
Expected: FAIL with missing Convex scripts or dependency assertions.

**Step 3: Write minimal implementation**

Update `packages/db/package.json`:

- remove `drizzle-orm`, `pg`, and `drizzle-kit`
- add `convex`
- replace SQL-oriented scripts with:
  - `"db:dev": "convex dev --config ./convex.json"`
  - `"db:deploy": "convex deploy --config ./convex.json"`
  - `"db:codegen": "convex codegen --config ./convex.json"`

Create `packages/db/convex.json` with package-local config pointing at the package’s Convex directory.

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/db-package.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/scaffold/db-package.test.mjs packages/db/package.json packages/db/convex.json
git commit -m "refactor(db): replace drizzle package contract with convex"
```

### Task 2: Replace the Package Source Scaffold with Convex Source Files

**Files:**
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/src/__tests__/schema-contract.test.ts`
- Create: `packages/db/convex/schema.ts`
- Create: `packages/db/convex/http.ts`
- Delete: `packages/db/src/migrate.ts`
- Delete: `packages/db/drizzle.config.ts`

**Step 1: Write the failing test**

Update `packages/db/src/__tests__/schema-contract.test.ts` so it stops asserting the package is Drizzle-specific and instead asserts:

- root import remains side-effect free
- package-local Convex schema file exists
- package-local Convex HTTP surface exists
- `packages/db/src/client.ts` exports a Convex client helper instead of creating a `pg.Pool`

Minimal assertion example:

```ts
expect(source).not.toContain('new pg.Pool');
expect(source).not.toContain('drizzle(');
expect(fs.existsSync('packages/db/convex/schema.ts')).toBe(true);
expect(fs.existsSync('packages/db/convex/http.ts')).toBe(true);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/db test`  
Expected: FAIL because the package still contains Postgres/Drizzle implementation.

**Step 3: Write minimal implementation**

Create `packages/db/convex/schema.ts` with the initial Convex table definitions mirroring the current domain entities at a coarse level:

- `users`
- `teams`
- `teamMembers`
- `specs`
- `specVersions`
- `agentRuns`
- `tasks`
- `artifacts`
- `auditLog`
- `apiKeys`

Create `packages/db/convex/http.ts` with the minimal exported Convex HTTP router placeholder.

Rewrite `packages/db/src/client.ts` so it exports Convex client helpers/config values instead of eagerly opening a Postgres connection.

Rewrite `packages/db/src/index.ts` so the package continues to export a stable, side-effect-free public surface for downstream consumers.

Remove `packages/db/src/migrate.ts` and `packages/db/drizzle.config.ts`.

**Step 4: Run test to verify it passes**

Run:
- `pnpm --filter @kata/db test`
- `pnpm --filter @kata/db typecheck`

Expected:
- package tests PASS
- package typecheck PASS

**Step 5: Commit**

```bash
git add packages/db/src/index.ts packages/db/src/client.ts packages/db/src/__tests__/schema-contract.test.ts packages/db/convex/schema.ts packages/db/convex/http.ts
git rm packages/db/src/migrate.ts packages/db/drizzle.config.ts
git commit -m "feat(db): replace postgres client scaffold with convex sources"
```

### Task 3: Remove SQL Migration and Postgres Docker Assumptions

**Files:**
- Modify: `tests/scaffold/db-migration-artifacts.test.mjs`
- Modify: `tests/scaffold/db-compose.test.mjs`
- Modify: `containers/docker-compose.yml`
- Delete: `packages/db/drizzle/`
- Delete: `packages/db/scripts/migration-smoke.mjs`
- Modify: `packages/db/.env.example`

**Step 1: Write the failing test**

Update `tests/scaffold/db-migration-artifacts.test.mjs` so it no longer expects Drizzle SQL files. Replace those assertions with Convex-oriented expectations:

- `packages/db/convex/` exists
- no `packages/db/drizzle.config.ts`
- no `packages/db/drizzle/` directory

Update `tests/scaffold/db-compose.test.mjs` so it no longer requires a `postgres` service. Keep `redis` only if it is still needed by current milestone work.

```js
assert.ok(fs.existsSync('packages/db/convex'), 'packages/db/convex directory missing');
assert.ok(!fs.existsSync('packages/db/drizzle.config.ts'), 'drizzle config should be removed');
assert.ok(!fs.existsSync('packages/db/drizzle'), 'drizzle directory should be removed');
assert.doesNotMatch(compose, /postgres:/, 'postgres service should be removed');
```

**Step 2: Run test to verify it fails**

Run:
- `node tests/scaffold/db-migration-artifacts.test.mjs`
- `node tests/scaffold/db-compose.test.mjs`

Expected: FAIL while Drizzle artifacts and Postgres service still exist.

**Step 3: Write minimal implementation**

- Delete `packages/db/drizzle/`
- Delete `packages/db/scripts/migration-smoke.mjs`
- Remove the `postgres` service from `containers/docker-compose.yml`
- Keep `redis` if it still supports current gateway/websocket work
- Replace `packages/db/.env.example` with Convex-oriented environment guidance, such as deployment URL or deployment selection variables used by the chosen local workflow

**Step 4: Run test to verify it passes**

Run:
- `node tests/scaffold/db-migration-artifacts.test.mjs`
- `node tests/scaffold/db-compose.test.mjs`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/scaffold/db-migration-artifacts.test.mjs tests/scaffold/db-compose.test.mjs containers/docker-compose.yml packages/db/.env.example
git rm -r packages/db/drizzle packages/db/scripts/migration-smoke.mjs
git commit -m "chore(db): remove postgres migration and compose assumptions"
```

### Task 4: Update Project Docs to Make Convex the New Baseline

**Files:**
- Modify: `docs/PROJECT_PLAN.md`
- Modify: `docs/M1-dependency-graph.mermaid`
- Modify: `docs/plans/2026-02-28-kat-152-convex-adoption-design.md`

**Step 1: Write the failing documentation checklist**

Create a manual checklist and confirm these stale phrases still exist before editing:

- `PostgreSQL`
- `Drizzle`
- `PostgreSQL schema + Drizzle migrations`

Check with:

```bash
rg -n "PostgreSQL|Drizzle|Postgres" docs/PROJECT_PLAN.md docs/M1-dependency-graph.mermaid
```

Expected: one or more matches.

**Step 2: Run the check to verify the stale content exists**

Run: `rg -n "PostgreSQL|Drizzle|Postgres" docs/PROJECT_PLAN.md docs/M1-dependency-graph.mermaid`  
Expected: matches showing the old backend plan.

**Step 3: Write minimal implementation**

Update `docs/PROJECT_PLAN.md`:

- replace PostgreSQL/Drizzle references with Convex
- adjust backend stack wording so persistence, realtime, and API boundaries are consistent with the new direction

Update `docs/M1-dependency-graph.mermaid`:

- rename the `KAT-106` node label so it no longer describes PostgreSQL/Drizzle as the active baseline
- if the graph still needs to preserve history, annotate it as completed historical work rather than active architecture guidance

Update `docs/plans/2026-02-28-kat-152-convex-adoption-design.md` only if implementation details need to reflect what actually landed during the migration ticket.

**Step 4: Run the check to verify it passes**

Run: `rg -n "PostgreSQL schema \\+ Drizzle migrations" docs/PROJECT_PLAN.md docs/M1-dependency-graph.mermaid`  
Expected: no matches for the active baseline phrasing.

**Step 5: Commit**

```bash
git add docs/PROJECT_PLAN.md docs/M1-dependency-graph.mermaid docs/plans/2026-02-28-kat-152-convex-adoption-design.md
git commit -m "docs: update project plan to convex baseline"
```

### Task 5: Regenerate Derived Artifacts and Run Full Verification

**Files:**
- Modify: `docs/M1-dependency-graph.svg`
- Modify: `docs/M1-dependency-graph.png`

**Step 1: Prepare the verification run**

Before regenerating artifacts, confirm the repo changes are staged and no unexpected files were introduced.

Run:

```bash
git status --short
```

Expected: only the planned Convex migration files are modified.

**Step 2: Run the failing or stale-state checks**

Run:

- `node tests/scaffold/db-package.test.mjs`
- `node tests/scaffold/db-migration-artifacts.test.mjs`
- `node tests/scaffold/db-compose.test.mjs`
- `pnpm --filter @kata/db test`
- `pnpm --filter @kata/db typecheck`

Expected before finishing:

- all checks PASS

If the dependency graph exports are stale, regenerate them from the updated Mermaid source using the repo’s preferred export process.

**Step 3: Write minimal implementation**

- Regenerate `docs/M1-dependency-graph.svg`
- Regenerate `docs/M1-dependency-graph.png`
- Fix any remaining naming drift or broken references exposed by the verification run

**Step 4: Run the final repo checks**

Run:

- `pnpm ci:checks`

Expected:

- PASS with no failing scaffold or package tests

**Step 5: Commit**

```bash
git add docs/M1-dependency-graph.svg docs/M1-dependency-graph.png
git commit -m "test: verify convex data layer baseline"
```
