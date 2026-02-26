# KAT-105: Core TypeScript Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Define and publish shared TypeScript types with Zod schemas in `packages/shared/` that all other packages depend on.

**Architecture:** Each domain concept gets its own schema file exporting Zod schemas and inferred TS types. A barrel export re-exports everything from `packages/shared/src/index.ts`. The package builds with `tsc --build` (composite project references already configured) and tests with vitest.

**Tech Stack:** TypeScript 5.8, Zod 3.24, Vitest 3.2, pnpm workspaces, turbo

**Downstream consumers:** KAT-106 (Drizzle DB schema) uses these types for table alignment. KAT-108 (Hono API) uses the Zod schemas for OpenAPI generation and request validation.

---

### Task 1: Package Setup

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas/index.ts`

**Step 1: Install zod in the shared package**

Run: `pnpm --filter @kata/shared add zod`

**Step 2: Install vitest as dev dependency**

Run: `pnpm --filter @kata/shared add -D vitest`

**Step 3: Update package.json with build/test scripts and exports**

Replace `packages/shared/package.json` with:

```json
{
  "name": "@kata/shared",
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
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

Note: `pnpm add` already wrote the deps. Manually verify the versions match then update scripts and exports fields.

**Step 4: Update tsconfig.json to exclude tests from build**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
```

**Step 5: Create vitest config**

Create `packages/shared/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

**Step 6: Create placeholder barrel exports**

Create `packages/shared/src/schemas/index.ts`:

```typescript
// Schema barrel export — each schema module re-exported here
```

Create `packages/shared/src/index.ts`:

```typescript
export * from './schemas/index.js';
```

**Step 7: Verify build works**

Run: `cd packages/shared && pnpm build`
Expected: Compiles with no errors, creates `dist/` with `.js` and `.d.ts` files.

**Step 8: Verify test runner works**

Run: `cd packages/shared && pnpm test`
Expected: vitest runs, finds no tests, exits 0.

**Step 9: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): configure package build, test, and zod dependency

KAT-105"
```

---

### Task 2: Auth Types (User, Team, TeamMember, ApiKey)

**Files:**
- Create: `packages/shared/src/schemas/auth.ts`
- Create: `packages/shared/src/__tests__/auth.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  UserSchema,
  TeamSchema,
  TeamMemberSchema,
  ApiKeySchema,
  TeamRoleSchema,
} from '../schemas/auth.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('UserSchema', () => {
  const valid = { id: uuid, email: 'a@b.com', name: 'Alice', createdAt: now };

  it('parses valid user', () => {
    expect(UserSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid email', () => {
    expect(() => UserSchema.parse({ ...valid, email: 'bad' })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => UserSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects missing id', () => {
    const { id: _, ...rest } = valid;
    expect(() => UserSchema.parse(rest)).toThrow();
  });
});

describe('TeamSchema', () => {
  const valid = { id: uuid, name: 'Kata', slug: 'kata', createdAt: now };

  it('parses valid team', () => {
    expect(TeamSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty slug', () => {
    expect(() => TeamSchema.parse({ ...valid, slug: '' })).toThrow();
  });
});

describe('TeamMemberSchema', () => {
  const valid = { userId: uuid, teamId: uuid, role: 'admin' as const };

  it('parses valid member', () => {
    expect(TeamMemberSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid role', () => {
    expect(() => TeamMemberSchema.parse({ ...valid, role: 'superadmin' })).toThrow();
  });
});

describe('TeamRoleSchema', () => {
  it('accepts admin, member, viewer', () => {
    expect(TeamRoleSchema.parse('admin')).toBe('admin');
    expect(TeamRoleSchema.parse('member')).toBe('member');
    expect(TeamRoleSchema.parse('viewer')).toBe('viewer');
  });
});

describe('ApiKeySchema', () => {
  const valid = {
    id: uuid,
    teamId: uuid,
    name: 'CI Key',
    keyHash: 'sha256:abc123',
    prefix: 'kat_',
    createdBy: uuid,
    createdAt: now,
  };

  it('parses valid key', () => {
    expect(ApiKeySchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional expiresAt', () => {
    const withExpiry = { ...valid, expiresAt: now };
    expect(ApiKeySchema.parse(withExpiry)).toEqual(withExpiry);
  });

  it('parses with optional revokedAt', () => {
    const withRevoke = { ...valid, revokedAt: now };
    expect(ApiKeySchema.parse(withRevoke)).toEqual(withRevoke);
  });

  it('rejects missing keyHash', () => {
    const { keyHash: _, ...rest } = valid;
    expect(() => ApiKeySchema.parse(rest)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — cannot resolve `../schemas/auth.js`

**Step 3: Write the implementation**

Create `packages/shared/src/schemas/auth.ts`:

```typescript
import { z } from 'zod';

export const TeamRoleSchema = z.enum(['admin', 'member', 'viewer']);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid(),
  role: TeamRoleSchema,
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().min(1),
  keyHash: z.string().min(1),
  prefix: z.string().min(1),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;
```

**Step 4: Add to barrel export**

Update `packages/shared/src/schemas/index.ts`:

```typescript
export * from './auth.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: All auth tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/auth.ts packages/shared/src/__tests__/auth.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add auth schemas (User, Team, TeamMember, ApiKey)

KAT-105"
```

---

### Task 3: Spec Types

**Files:**
- Create: `packages/shared/src/schemas/spec.ts`
- Create: `packages/shared/src/__tests__/spec.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/spec.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  SpecSchema,
  SpecStatusSchema,
  SpecDecisionSchema,
  SpecBlockerSchema,
  SpecBlockerStatusSchema,
} from '../schemas/spec.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('SpecStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['draft', 'active', 'paused', 'completed', 'archived']) {
      expect(SpecStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid status', () => {
    expect(() => SpecStatusSchema.parse('deleted')).toThrow();
  });
});

describe('SpecDecisionSchema', () => {
  it('parses valid decision', () => {
    const d = { id: uuid, description: 'Use Zod', decidedBy: 'architect', decidedAt: now };
    expect(SpecDecisionSchema.parse(d)).toEqual(d);
  });

  it('parses with optional rationale', () => {
    const d = { id: uuid, description: 'Use Zod', decidedBy: 'architect', decidedAt: now, rationale: 'Type-safe' };
    expect(SpecDecisionSchema.parse(d)).toEqual(d);
  });
});

describe('SpecBlockerSchema', () => {
  it('parses open blocker', () => {
    const b = { id: uuid, description: 'Waiting on API', status: 'open' as const, reportedAt: now };
    expect(SpecBlockerSchema.parse(b)).toEqual(b);
  });

  it('parses resolved blocker with resolvedAt', () => {
    const b = { id: uuid, description: 'Done', status: 'resolved' as const, reportedAt: now, resolvedAt: now };
    expect(SpecBlockerSchema.parse(b)).toEqual(b);
  });
});

describe('SpecBlockerStatusSchema', () => {
  it('accepts open and resolved', () => {
    expect(SpecBlockerStatusSchema.parse('open')).toBe('open');
    expect(SpecBlockerStatusSchema.parse('resolved')).toBe('resolved');
  });
});

describe('SpecSchema', () => {
  const validSpec = {
    id: uuid,
    teamId: uuid,
    title: 'Build login page',
    status: 'draft' as const,
    meta: { version: 1, createdAt: now, updatedAt: now },
    intent: 'Allow users to sign in',
    constraints: ['Must use OAuth', 'Under 200ms response'],
    verification: { criteria: ['Login works with Google'] },
    taskIds: [uuid],
    decisions: [],
    blockers: [],
    createdBy: uuid,
  };

  it('parses valid spec', () => {
    expect(SpecSchema.parse(validSpec)).toEqual(validSpec);
  });

  it('rejects empty title', () => {
    expect(() => SpecSchema.parse({ ...validSpec, title: '' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => SpecSchema.parse({ ...validSpec, status: 'deleted' })).toThrow();
  });

  it('rejects non-positive version', () => {
    expect(() => SpecSchema.parse({ ...validSpec, meta: { ...validSpec.meta, version: 0 } })).toThrow();
  });

  it('accepts optional verification.testPlan', () => {
    const spec = {
      ...validSpec,
      verification: { criteria: ['works'], testPlan: 'run login e2e' },
    };
    expect(SpecSchema.parse(spec).verification.testPlan).toBe('run login e2e');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — cannot resolve `../schemas/spec.js`

**Step 3: Write the implementation**

Create `packages/shared/src/schemas/spec.ts`:

```typescript
import { z } from 'zod';

export const SpecStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);
export type SpecStatus = z.infer<typeof SpecStatusSchema>;

export const SpecMetaSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SpecMeta = z.infer<typeof SpecMetaSchema>;

export const SpecDecisionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  decidedBy: z.string().min(1),
  decidedAt: z.string().datetime(),
  rationale: z.string().optional(),
});
export type SpecDecision = z.infer<typeof SpecDecisionSchema>;

export const SpecBlockerStatusSchema = z.enum(['open', 'resolved']);
export type SpecBlockerStatus = z.infer<typeof SpecBlockerStatusSchema>;

export const SpecBlockerSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  status: SpecBlockerStatusSchema,
  reportedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type SpecBlocker = z.infer<typeof SpecBlockerSchema>;

export const SpecVerificationSchema = z.object({
  criteria: z.array(z.string()),
  testPlan: z.string().optional(),
});
export type SpecVerification = z.infer<typeof SpecVerificationSchema>;

export const SpecSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  title: z.string().min(1),
  status: SpecStatusSchema,
  meta: SpecMetaSchema,
  intent: z.string(),
  constraints: z.array(z.string()),
  verification: SpecVerificationSchema,
  taskIds: z.array(z.string().uuid()),
  decisions: z.array(SpecDecisionSchema),
  blockers: z.array(SpecBlockerSchema),
  createdBy: z.string().uuid(),
});
export type Spec = z.infer<typeof SpecSchema>;
```

**Step 4: Add to barrel export**

Append to `packages/shared/src/schemas/index.ts`:

```typescript
export * from './spec.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: All spec tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/spec.ts packages/shared/src/__tests__/spec.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add Spec schemas (Spec, SpecDecision, SpecBlocker)

KAT-105"
```

---

### Task 4: Agent Types

**Files:**
- Create: `packages/shared/src/schemas/agent.ts`
- Create: `packages/shared/src/__tests__/agent.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  AgentSchema,
  AgentRoleSchema,
  AgentStatusSchema,
  ModelConfigSchema,
} from '../schemas/agent.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('AgentRoleSchema', () => {
  it('accepts coordinator, specialist, verifier', () => {
    for (const r of ['coordinator', 'specialist', 'verifier']) {
      expect(AgentRoleSchema.parse(r)).toBe(r);
    }
  });

  it('rejects invalid role', () => {
    expect(() => AgentRoleSchema.parse('manager')).toThrow();
  });
});

describe('AgentStatusSchema', () => {
  it('accepts all statuses', () => {
    for (const s of ['idle', 'running', 'paused', 'error', 'terminated']) {
      expect(AgentStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('ModelConfigSchema', () => {
  it('parses minimal config', () => {
    const c = { provider: 'anthropic', model: 'claude-sonnet-4-20250514' };
    expect(ModelConfigSchema.parse(c)).toEqual(c);
  });

  it('parses with optional fields', () => {
    const c = { provider: 'anthropic', model: 'claude-sonnet-4-20250514', temperature: 0.7, maxTokens: 4096 };
    expect(ModelConfigSchema.parse(c)).toEqual(c);
  });
});

describe('AgentSchema', () => {
  const valid = {
    id: uuid,
    name: 'code-writer',
    role: 'specialist' as const,
    modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    status: 'idle' as const,
  };

  it('parses valid agent', () => {
    expect(AgentSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty name', () => {
    expect(() => AgentSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects invalid role', () => {
    expect(() => AgentSchema.parse({ ...valid, role: 'boss' })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — cannot resolve `../schemas/agent.js`

**Step 3: Write the implementation**

Create `packages/shared/src/schemas/agent.ts`:

```typescript
import { z } from 'zod';

export const AgentRoleSchema = z.enum(['coordinator', 'specialist', 'verifier']);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentStatusSchema = z.enum(['idle', 'running', 'paused', 'error', 'terminated']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const ModelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: AgentRoleSchema,
  modelConfig: ModelConfigSchema,
  status: AgentStatusSchema,
});
export type Agent = z.infer<typeof AgentSchema>;
```

**Step 4: Add to barrel export**

Append to `packages/shared/src/schemas/index.ts`:

```typescript
export * from './agent.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: All agent tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/agent.ts packages/shared/src/__tests__/agent.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add Agent schemas (Agent, AgentRole, ModelConfig)

KAT-105"
```

---

### Task 5: Environment Types

**Files:**
- Create: `packages/shared/src/schemas/environment.ts`
- Create: `packages/shared/src/__tests__/environment.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/environment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  EnvironmentSchema,
  EnvironmentStateSchema,
  VmConfigSchema,
  ResourceLimitsSchema,
  NetworkPolicySchema,
} from '../schemas/environment.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('EnvironmentStateSchema', () => {
  it('accepts all states', () => {
    for (const s of ['provisioning', 'ready', 'running', 'stopped', 'terminated', 'error']) {
      expect(EnvironmentStateSchema.parse(s)).toBe(s);
    }
  });
});

describe('VmConfigSchema', () => {
  it('parses valid config', () => {
    const c = { image: 'ubuntu:22.04', cpu: 2, memoryMb: 4096, diskGb: 20 };
    expect(VmConfigSchema.parse(c)).toEqual(c);
  });

  it('parses with optional gpu', () => {
    const c = { image: 'ubuntu:22.04', cpu: 4, memoryMb: 8192, diskGb: 50, gpu: true };
    expect(VmConfigSchema.parse(c)).toEqual(c);
  });

  it('rejects non-positive cpu', () => {
    expect(() => VmConfigSchema.parse({ image: 'x', cpu: 0, memoryMb: 1, diskGb: 1 })).toThrow();
  });
});

describe('ResourceLimitsSchema', () => {
  it('parses valid limits', () => {
    const l = { maxCpu: 8, maxMemoryMb: 16384, maxDiskGb: 100, timeoutSeconds: 3600 };
    expect(ResourceLimitsSchema.parse(l)).toEqual(l);
  });
});

describe('NetworkPolicySchema', () => {
  it('parses minimal policy', () => {
    const p = { allowInternet: false };
    expect(NetworkPolicySchema.parse(p)).toEqual(p);
  });

  it('parses with optional hosts and ports', () => {
    const p = { allowInternet: true, allowedHosts: ['api.example.com'], allowedPorts: [443] };
    expect(NetworkPolicySchema.parse(p)).toEqual(p);
  });
});

describe('EnvironmentSchema', () => {
  const valid = {
    id: uuid,
    config: { image: 'ubuntu:22.04', cpu: 2, memoryMb: 4096, diskGb: 20 },
    state: 'ready' as const,
    resourceLimits: { maxCpu: 8, maxMemoryMb: 16384, maxDiskGb: 100, timeoutSeconds: 3600 },
    networkPolicy: { allowInternet: false },
  };

  it('parses valid environment', () => {
    expect(EnvironmentSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid state', () => {
    expect(() => EnvironmentSchema.parse({ ...valid, state: 'booting' })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — cannot resolve `../schemas/environment.js`

**Step 3: Write the implementation**

Create `packages/shared/src/schemas/environment.ts`:

```typescript
import { z } from 'zod';

export const EnvironmentStateSchema = z.enum([
  'provisioning',
  'ready',
  'running',
  'stopped',
  'terminated',
  'error',
]);
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

export const VmConfigSchema = z.object({
  image: z.string().min(1),
  cpu: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  diskGb: z.number().int().positive(),
  gpu: z.boolean().optional(),
});
export type VmConfig = z.infer<typeof VmConfigSchema>;

export const ResourceLimitsSchema = z.object({
  maxCpu: z.number().int().positive(),
  maxMemoryMb: z.number().int().positive(),
  maxDiskGb: z.number().int().positive(),
  timeoutSeconds: z.number().int().positive(),
});
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;

export const NetworkPolicySchema = z.object({
  allowInternet: z.boolean(),
  allowedHosts: z.array(z.string()).optional(),
  allowedPorts: z.array(z.number().int().positive()).optional(),
});
export type NetworkPolicy = z.infer<typeof NetworkPolicySchema>;

export const EnvironmentSchema = z.object({
  id: z.string().uuid(),
  config: VmConfigSchema,
  state: EnvironmentStateSchema,
  resourceLimits: ResourceLimitsSchema,
  networkPolicy: NetworkPolicySchema,
});
export type Environment = z.infer<typeof EnvironmentSchema>;
```

**Step 4: Add to barrel export**

Append to `packages/shared/src/schemas/index.ts`:

```typescript
export * from './environment.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: All environment tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/environment.ts packages/shared/src/__tests__/environment.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add Environment schemas (VmConfig, ResourceLimits, NetworkPolicy)

KAT-105"
```

---

### Task 6: Task and Artifact Types

**Files:**
- Create: `packages/shared/src/schemas/task.ts`
- Create: `packages/shared/src/schemas/artifact.ts`
- Create: `packages/shared/src/__tests__/task.test.ts`
- Create: `packages/shared/src/__tests__/artifact.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing tests**

Create `packages/shared/src/__tests__/task.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TaskSchema, TaskStatusSchema } from '../schemas/task.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('TaskStatusSchema', () => {
  it('accepts all statuses', () => {
    for (const s of ['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']) {
      expect(TaskStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('TaskSchema', () => {
  const valid = {
    id: uuid,
    specId: uuid,
    title: 'Write login component',
    status: 'pending' as const,
    dependsOn: [],
  };

  it('parses valid task', () => {
    expect(TaskSchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional agentRunId', () => {
    const t = { ...valid, agentRunId: uuid };
    expect(TaskSchema.parse(t)).toEqual(t);
  });

  it('parses with optional result', () => {
    const t = { ...valid, result: { output: 'done', exitCode: 0 } };
    expect(TaskSchema.parse(t).result).toEqual({ output: 'done', exitCode: 0 });
  });

  it('parses with dependsOn array', () => {
    const t = { ...valid, dependsOn: [uuid] };
    expect(TaskSchema.parse(t).dependsOn).toEqual([uuid]);
  });

  it('rejects empty title', () => {
    expect(() => TaskSchema.parse({ ...valid, title: '' })).toThrow();
  });
});
```

Create `packages/shared/src/__tests__/artifact.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ArtifactSchema, ArtifactTypeSchema } from '../schemas/artifact.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('ArtifactTypeSchema', () => {
  it('accepts all types', () => {
    for (const t of ['screenshot', 'video', 'test_report', 'diff', 'log', 'file']) {
      expect(ArtifactTypeSchema.parse(t)).toBe(t);
    }
  });
});

describe('ArtifactSchema', () => {
  const valid = {
    id: uuid,
    agentRunId: uuid,
    type: 'screenshot' as const,
    path: '/artifacts/run-1/screenshot.png',
    metadata: {},
  };

  it('parses valid artifact', () => {
    expect(ArtifactSchema.parse(valid)).toEqual(valid);
  });

  it('parses with metadata', () => {
    const a = { ...valid, metadata: { width: 1920, height: 1080 } };
    expect(ArtifactSchema.parse(a).metadata).toEqual({ width: 1920, height: 1080 });
  });

  it('rejects empty path', () => {
    expect(() => ArtifactSchema.parse({ ...valid, path: '' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => ArtifactSchema.parse({ ...valid, type: 'audio' })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — cannot resolve task.js and artifact.js

**Step 3: Write the implementations**

Create `packages/shared/src/schemas/task.ts`:

```typescript
import { z } from 'zod';

export const TaskStatusSchema = z.enum(['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  agentRunId: z.string().uuid().optional(),
  title: z.string().min(1),
  status: TaskStatusSchema,
  dependsOn: z.array(z.string().uuid()),
  result: z.unknown().optional(),
});
export type Task = z.infer<typeof TaskSchema>;
```

Create `packages/shared/src/schemas/artifact.ts`:

```typescript
import { z } from 'zod';

export const ArtifactTypeSchema = z.enum(['screenshot', 'video', 'test_report', 'diff', 'log', 'file']);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  agentRunId: z.string().uuid(),
  type: ArtifactTypeSchema,
  path: z.string().min(1),
  metadata: z.record(z.unknown()),
});
export type Artifact = z.infer<typeof ArtifactSchema>;
```

**Step 4: Add to barrel export**

Append to `packages/shared/src/schemas/index.ts`:

```typescript
export * from './task.js';
export * from './artifact.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: All task and artifact tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/task.ts packages/shared/src/schemas/artifact.ts packages/shared/src/__tests__/task.test.ts packages/shared/src/__tests__/artifact.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add Task and Artifact schemas

KAT-105"
```

---

### Task 7: AgentRun and AuditEntry Types

**Files:**
- Create: `packages/shared/src/schemas/agent-run.ts`
- Create: `packages/shared/src/schemas/audit.ts`
- Create: `packages/shared/src/__tests__/agent-run.test.ts`
- Create: `packages/shared/src/__tests__/audit.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Write the failing tests**

Create `packages/shared/src/__tests__/agent-run.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AgentRunSchema, AgentRunStatusSchema } from '../schemas/agent-run.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('AgentRunStatusSchema', () => {
  it('accepts all statuses', () => {
    for (const s of ['queued', 'running', 'completed', 'failed', 'cancelled']) {
      expect(AgentRunStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('AgentRunSchema', () => {
  const valid = {
    id: uuid,
    specId: uuid,
    agentRole: 'coordinator' as const,
    environmentId: uuid,
    model: 'claude-sonnet-4-20250514',
    status: 'queued' as const,
  };

  it('parses valid agent run', () => {
    expect(AgentRunSchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional timestamps', () => {
    const run = { ...valid, status: 'completed' as const, startedAt: now, completedAt: now };
    expect(AgentRunSchema.parse(run)).toEqual(run);
  });

  it('rejects invalid agentRole', () => {
    expect(() => AgentRunSchema.parse({ ...valid, agentRole: 'manager' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => AgentRunSchema.parse({ ...valid, status: 'paused' })).toThrow();
  });
});
```

Create `packages/shared/src/__tests__/audit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AuditEntrySchema } from '../schemas/audit.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('AuditEntrySchema', () => {
  const valid = {
    id: uuid,
    teamId: uuid,
    action: 'agent.started',
    details: { model: 'claude-sonnet-4-20250514' },
    timestamp: now,
  };

  it('parses valid entry', () => {
    expect(AuditEntrySchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional agentRunId', () => {
    const entry = { ...valid, agentRunId: uuid };
    expect(AuditEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses with empty details', () => {
    const entry = { ...valid, details: {} };
    expect(AuditEntrySchema.parse(entry)).toEqual(entry);
  });

  it('rejects empty action', () => {
    expect(() => AuditEntrySchema.parse({ ...valid, action: '' })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — cannot resolve agent-run.js and audit.js

**Step 3: Write the implementations**

Create `packages/shared/src/schemas/agent-run.ts`:

```typescript
import { z } from 'zod';
import { AgentRoleSchema } from './agent.js';

export const AgentRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  agentRole: AgentRoleSchema,
  environmentId: z.string().uuid(),
  model: z.string().min(1),
  status: AgentRunStatusSchema,
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;
```

Create `packages/shared/src/schemas/audit.ts`:

```typescript
import { z } from 'zod';

export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  agentRunId: z.string().uuid().optional(),
  action: z.string().min(1),
  details: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
```

**Step 4: Add to barrel export**

Append to `packages/shared/src/schemas/index.ts`:

```typescript
export * from './agent-run.js';
export * from './audit.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/shared && pnpm test`
Expected: All agent-run and audit tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/agent-run.ts packages/shared/src/schemas/audit.ts packages/shared/src/__tests__/agent-run.test.ts packages/shared/src/__tests__/audit.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat(shared): add AgentRun and AuditEntry schemas

KAT-105"
```

---

### Task 8: Build Verification and Turbo Integration

**Files:**
- Modify: `packages/shared/src/schemas/index.ts` (final state verification)
- Modify: `packages/shared/src/index.ts` (final state verification)

**Step 1: Verify final barrel export state**

`packages/shared/src/schemas/index.ts` should contain:

```typescript
export * from './auth.js';
export * from './spec.js';
export * from './agent.js';
export * from './environment.js';
export * from './task.js';
export * from './artifact.js';
export * from './agent-run.js';
export * from './audit.js';
```

`packages/shared/src/index.ts` should contain:

```typescript
export * from './schemas/index.js';
```

**Step 2: Run full test suite**

Run: `cd packages/shared && pnpm test`
Expected: All tests pass (auth, spec, agent, environment, task, artifact, agent-run, audit).

**Step 3: Verify build produces dist output**

Run: `cd packages/shared && pnpm build && ls dist/`
Expected: `index.js`, `index.d.ts`, `schemas/` directory with compiled files.

**Step 4: Verify typecheck**

Run: `cd packages/shared && pnpm typecheck`
Expected: No errors.

**Step 5: Run turbo from repo root**

Run: `pnpm test`
Expected: All workspace packages pass, including `@kata/shared`.

Run: `pnpm typecheck`
Expected: All workspace packages pass typecheck.

**Step 6: Verify lint**

Run: `cd packages/shared && pnpm lint`
Expected: No lint errors. If there are lint issues, fix them.

**Step 7: Commit any final fixes**

If any fixes were needed:
```bash
git add packages/shared/
git commit -m "fix(shared): address lint/typecheck issues

KAT-105"
```

---

## Summary

| Task | Schema Files | Types Exported |
|------|-------------|----------------|
| 1 | (setup) | — |
| 2 | `auth.ts` | User, Team, TeamMember, ApiKey, TeamRole |
| 3 | `spec.ts` | Spec, SpecStatus, SpecMeta, SpecDecision, SpecBlocker, SpecBlockerStatus, SpecVerification |
| 4 | `agent.ts` | Agent, AgentRole, AgentStatus, ModelConfig |
| 5 | `environment.ts` | Environment, EnvironmentState, VmConfig, ResourceLimits, NetworkPolicy |
| 6 | `task.ts`, `artifact.ts` | Task, TaskStatus, Artifact, ArtifactType |
| 7 | `agent-run.ts`, `audit.ts` | AgentRun, AgentRunStatus, AuditEntry |
| 8 | (verification) | — |

All types export both Zod schemas (for runtime validation, OpenAPI generation in KAT-108) and inferred TS types (for static typing across the monorepo). The `AgentRoleSchema` is reused by `AgentRunSchema` to keep role values in sync.
