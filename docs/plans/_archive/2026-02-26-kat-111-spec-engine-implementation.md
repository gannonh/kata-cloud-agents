# KAT-111 Spec Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `@kata/spec-engine` as a pure library for strict YAML spec parsing/validation, canonical serialization, lifecycle transitions, and JSON Schema export.

**Architecture:** Keep schema/type ownership in `@kata/shared` and implement all YAML + transition + export behavior in `@kata/spec-engine` with zero runtime coupling to infra/dispatcher packages. Use strict validation (no unknown keys) and deterministic serialization for repeatable outputs and editor integration.

**Tech Stack:** TypeScript 5.8, Vitest 3.2, Zod 4, YAML parser (`yaml`), pnpm workspaces, turbo

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

### Task 1: Bootstrap `@kata/spec-engine` Tooling

**Files:**
- Modify: `packages/spec-engine/package.json`
- Create: `packages/spec-engine/tsconfig.json`
- Create: `packages/spec-engine/vitest.config.ts`
- Create: `packages/spec-engine/src/index.ts`
- Test: `tests/scaffold/spec-engine-package.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/spec-engine-package.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/spec-engine/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/spec-engine');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.dependencies['@kata/shared'], '@kata/shared dependency missing');
assert.ok(pkg.dependencies['yaml'], 'yaml dependency missing');
assert.ok(fs.existsSync('packages/spec-engine/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/spec-engine/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/spec-engine/src/index.ts'), 'index.ts missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/spec-engine-package.test.mjs`  
Expected: FAIL with missing dependencies/files.

**Step 3: Write minimal implementation**

Run:

```bash
pnpm --filter @kata/spec-engine add @kata/shared@workspace:* yaml zod
pnpm --filter @kata/spec-engine add -D vitest @types/node typescript
```

Replace `packages/spec-engine/package.json` with:

```json
{
  "name": "@kata/spec-engine",
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
    "test": "vitest run"
  },
  "dependencies": {
    "@kata/shared": "workspace:*",
    "yaml": "^2.8.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2",
    "vitest": "^3.2.4"
  }
}
```

Create `packages/spec-engine/tsconfig.json`:

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
  "include": ["src"]
}
```

Create `packages/spec-engine/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

Create `packages/spec-engine/src/index.ts`:

```typescript
export {};
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/spec-engine-package.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/scaffold/spec-engine-package.test.mjs packages/spec-engine/package.json packages/spec-engine/tsconfig.json packages/spec-engine/vitest.config.ts packages/spec-engine/src/index.ts pnpm-lock.yaml
git commit -m "feat(spec-engine): bootstrap package tooling"
```

### Task 2: Align Shared Spec Statuses to M1 Lifecycle

**Files:**
- Modify: `packages/shared/src/schemas/spec.ts`
- Modify: `packages/shared/src/__tests__/spec.test.ts`

**Step 1: Write the failing test**

Update `packages/shared/src/__tests__/spec.test.ts` status expectations to:

```typescript
for (const s of ['draft', 'approved', 'in_progress', 'verifying', 'done', 'failed']) {
  expect(SpecStatusSchema.parse(s)).toBe(s);
}
```

Also add:

```typescript
it('rejects legacy status values', () => {
  for (const s of ['active', 'paused', 'completed', 'archived']) {
    expect(() => SpecStatusSchema.parse(s)).toThrow();
  }
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/shared test -- src/__tests__/spec.test.ts`  
Expected: FAIL because schema still uses legacy statuses.

**Step 3: Write minimal implementation**

In `packages/shared/src/schemas/spec.ts`, replace status enum with:

```typescript
export const SpecStatusSchema = z.enum(['draft', 'approved', 'in_progress', 'verifying', 'done', 'failed']);
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/shared test -- src/__tests__/spec.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/spec.ts packages/shared/src/__tests__/spec.test.ts
git commit -m "feat(shared): adopt M1 spec status lifecycle"
```

### Task 3: Implement Transition Guards in Spec Engine

**Files:**
- Create: `packages/spec-engine/src/transitions.ts`
- Create: `packages/spec-engine/src/errors.ts`
- Create: `packages/spec-engine/src/__tests__/transitions.test.ts`
- Modify: `packages/spec-engine/src/index.ts`

**Step 1: Write the failing test**

Create `packages/spec-engine/src/__tests__/transitions.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from '../transitions.js';
import { SpecTransitionError } from '../errors.js';

describe('spec status transitions', () => {
  it('allows only the M1 forward edges', () => {
    expect(canTransition('draft', 'approved')).toBe(true);
    expect(canTransition('approved', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'verifying')).toBe(true);
    expect(canTransition('verifying', 'done')).toBe(true);
    expect(canTransition('verifying', 'failed')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('draft', 'done')).toBe(false);
    expect(() => assertTransition('draft', 'done')).toThrow(SpecTransitionError);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/transitions.test.ts`  
Expected: FAIL due to missing modules.

**Step 3: Write minimal implementation**

Create `packages/spec-engine/src/errors.ts`:

```typescript
import type { SpecStatus } from '@kata/shared';

export class SpecTransitionError extends Error {
  constructor(
    public readonly from: SpecStatus,
    public readonly to: SpecStatus,
    public readonly allowedNext: readonly SpecStatus[],
  ) {
    super(`Invalid spec transition: ${from} -> ${to}. Allowed: ${allowedNext.join(', ') || 'none'}`);
    this.name = 'SpecTransitionError';
  }
}
```

Create `packages/spec-engine/src/transitions.ts`:

```typescript
import type { SpecStatus } from '@kata/shared';
import { SpecTransitionError } from './errors.js';

const MATRIX: Record<SpecStatus, readonly SpecStatus[]> = {
  draft: ['approved'],
  approved: ['in_progress'],
  in_progress: ['verifying'],
  verifying: ['done', 'failed'],
  done: [],
  failed: [],
};

export function canTransition(from: SpecStatus, to: SpecStatus): boolean {
  return MATRIX[from].includes(to);
}

export function assertTransition(from: SpecStatus, to: SpecStatus): void {
  if (!canTransition(from, to)) throw new SpecTransitionError(from, to, MATRIX[from]);
}
```

Update `packages/spec-engine/src/index.ts`:

```typescript
export * from './errors.js';
export * from './transitions.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/transitions.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/spec-engine/src/errors.ts packages/spec-engine/src/transitions.ts packages/spec-engine/src/__tests__/transitions.test.ts packages/spec-engine/src/index.ts
git commit -m "feat(spec-engine): add status transition guard API"
```

### Task 4: Implement Strict YAML Parse + Validate APIs

**Files:**
- Create: `packages/spec-engine/src/parse.ts`
- Create: `packages/spec-engine/src/validate.ts`
- Create: `packages/spec-engine/src/__tests__/parse-validate.test.ts`
- Modify: `packages/spec-engine/src/index.ts`

**Step 1: Write the failing test**

Create `packages/spec-engine/src/__tests__/parse-validate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { parseSpecYaml, validateSpec } from '../parse.js';

const validYaml = `
id: 550e8400-e29b-41d4-a716-446655440000
teamId: 550e8400-e29b-41d4-a716-446655440000
title: Test Spec
status: draft
meta:
  version: 1
  createdAt: 2026-02-26T00:00:00.000Z
  updatedAt: 2026-02-26T00:00:00.000Z
intent: Build feature
constraints:
  - Keep API stable
verification:
  criteria:
    - Unit tests pass
taskIds: []
decisions: []
blockers: []
createdBy: 550e8400-e29b-41d4-a716-446655440000
`;

describe('parse + validate', () => {
  it('parses and validates valid yaml', () => {
    const parsed = parseSpecYaml(validYaml);
    expect(parsed.ok).toBe(true);
  });

  it('rejects unknown top-level fields', () => {
    const withUnknown = `${validYaml}\nextraField: nope\n`;
    const parsed = parseSpecYaml(withUnknown);
    expect(parsed.ok).toBe(false);
  });

  it('rejects malformed yaml', () => {
    const parsed = parseSpecYaml('meta: [');
    expect(parsed.ok).toBe(false);
  });

  it('validateSpec rejects non-object input', () => {
    const result = validateSpec('nope');
    expect(result.ok).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/parse-validate.test.ts`  
Expected: FAIL due to missing parse/validate exports.

**Step 3: Write minimal implementation**

Create `packages/spec-engine/src/validate.ts`:

```typescript
import { SpecSchema, type Spec } from '@kata/shared';
import { z } from 'zod';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: Array<{ path: string; message: string; code: string }> };

const StrictSpecSchema = SpecSchema.strict();

export function validateSpec(input: unknown): ValidationResult<Spec> {
  const result = StrictSpecSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    })),
  };
}

export type SpecValidationError = z.ZodError;
```

Create `packages/spec-engine/src/parse.ts`:

```typescript
import YAML from 'yaml';
import type { Spec } from '@kata/shared';
import { validateSpec, type ValidationResult } from './validate.js';

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: 'parse' | 'validation'; message: string; issues?: ValidationResult<T> extends { ok: false } ? never : never };

export function parseSpecYaml(input: string): { ok: true; value: Spec } | { ok: false; kind: 'parse' | 'validation'; message: string; issues?: Array<{ path: string; message: string; code: string }> } {
  try {
    const data = YAML.parse(input);
    const validation = validateSpec(data);
    if (!validation.ok) {
      return { ok: false, kind: 'validation', message: 'Spec validation failed', issues: validation.issues };
    }

    return { ok: true, value: validation.value };
  } catch (error) {
    return {
      ok: false,
      kind: 'parse',
      message: error instanceof Error ? error.message : 'Failed to parse YAML',
    };
  }
}
```

Update `packages/spec-engine/src/index.ts`:

```typescript
export * from './errors.js';
export * from './transitions.js';
export * from './parse.js';
export * from './validate.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/parse-validate.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/spec-engine/src/parse.ts packages/spec-engine/src/validate.ts packages/spec-engine/src/__tests__/parse-validate.test.ts packages/spec-engine/src/index.ts
git commit -m "feat(spec-engine): add strict yaml parse and validation API"
```

### Task 5: Add Deterministic Canonical YAML Serialization

**Files:**
- Create: `packages/spec-engine/src/serialize.ts`
- Create: `packages/spec-engine/src/__tests__/serialize.test.ts`
- Modify: `packages/spec-engine/src/index.ts`

**Step 1: Write the failing test**

Create `packages/spec-engine/src/__tests__/serialize.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { serializeSpec, parseSpecYaml } from '../index.js';

const spec = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  teamId: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Canonical Test',
  status: 'draft',
  meta: { version: 1, createdAt: '2026-02-26T00:00:00.000Z', updatedAt: '2026-02-26T00:00:00.000Z' },
  intent: 'Check deterministic serialization',
  constraints: ['A'],
  verification: { criteria: ['B'] },
  taskIds: [],
  decisions: [],
  blockers: [],
  createdBy: '550e8400-e29b-41d4-a716-446655440000',
} as const;

describe('serializeSpec', () => {
  it('serializes deterministically for same input', () => {
    const a = serializeSpec(spec);
    const b = serializeSpec(spec);
    expect(a).toBe(b);
  });

  it('round-trips through parse', () => {
    const yaml = serializeSpec(spec);
    const parsed = parseSpecYaml(yaml);
    expect(parsed.ok).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/serialize.test.ts`  
Expected: FAIL due to missing `serializeSpec`.

**Step 3: Write minimal implementation**

Create `packages/spec-engine/src/serialize.ts`:

```typescript
import YAML from 'yaml';
import type { Spec } from '@kata/shared';

const ORDER: Array<keyof Spec> = [
  'id',
  'teamId',
  'title',
  'status',
  'meta',
  'intent',
  'constraints',
  'verification',
  'taskIds',
  'decisions',
  'blockers',
  'createdBy',
];

export function serializeSpec(spec: Spec): string {
  const canonical = Object.fromEntries(ORDER.map((k) => [k, spec[k]]));
  return YAML.stringify(canonical, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  });
}
```

Update `packages/spec-engine/src/index.ts`:

```typescript
export * from './errors.js';
export * from './transitions.js';
export * from './parse.js';
export * from './validate.js';
export * from './serialize.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/serialize.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/spec-engine/src/serialize.ts packages/spec-engine/src/__tests__/serialize.test.ts packages/spec-engine/src/index.ts
git commit -m "feat(spec-engine): add canonical yaml serialization"
```

### Task 6: Add JSON Schema Export + Independence Guardrail

**Files:**
- Modify: `packages/spec-engine/package.json`
- Create: `packages/spec-engine/src/json-schema.ts`
- Create: `packages/spec-engine/src/__tests__/json-schema.test.ts`
- Create: `packages/spec-engine/src/__tests__/independence.test.ts`
- Modify: `packages/spec-engine/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/spec-engine/src/__tests__/json-schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getSpecJsonSchema } from '../json-schema.js';

describe('getSpecJsonSchema', () => {
  it('returns object schema with expected core properties', () => {
    const schema = getSpecJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('status');
    expect(schema.properties).toHaveProperty('verification');
  });
});
```

Create `packages/spec-engine/src/__tests__/independence.test.ts`:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package independence', () => {
  it('does not depend on infra-adapters package', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(pkg.dependencies?.['@kata/infra-adapters']).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @kata/spec-engine test -- src/__tests__/json-schema.test.ts src/__tests__/independence.test.ts`  
Expected: FAIL due to missing json-schema module.

**Step 3: Write minimal implementation**

Run: `pnpm --filter @kata/spec-engine add zod-to-json-schema`

Create `packages/spec-engine/src/json-schema.ts`:

```typescript
import { SpecSchema } from '@kata/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';

let cached: ReturnType<typeof zodToJsonSchema> | null = null;

export function getSpecJsonSchema() {
  if (cached) return cached;
  cached = zodToJsonSchema(SpecSchema.strict(), { name: 'KataSpec' });
  return cached;
}
```

Update `packages/spec-engine/src/index.ts`:

```typescript
export * from './errors.js';
export * from './transitions.js';
export * from './parse.js';
export * from './validate.js';
export * from './serialize.js';
export * from './json-schema.js';
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @kata/spec-engine test`  
Expected: PASS for all `@kata/spec-engine` tests.

Then run integration checks:

Run: `pnpm --filter @kata/shared test -- src/__tests__/spec.test.ts`  
Expected: PASS.

Run: `pnpm lint && pnpm typecheck`  
Expected: PASS without new package-boundary violations.

**Step 5: Commit**

```bash
git add packages/spec-engine/package.json packages/spec-engine/src/json-schema.ts packages/spec-engine/src/__tests__/json-schema.test.ts packages/spec-engine/src/__tests__/independence.test.ts packages/spec-engine/src/index.ts pnpm-lock.yaml
git commit -m "feat(spec-engine): export json schema and enforce independence"
```
