# KAT-114 Docker InfraAdapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `@kata/infra-adapters` with a local-Docker `InfraAdapter` implementation that supports provision, exec, log streaming, snapshot, and destroy for M1.

**Architecture:** Define a strict contract (`InfraAdapter`) plus typed domain/result models first, then implement `DockerInfraAdapter` against dockerode with explicit M1 constraints (local daemon only, no TTY exec, limited network-policy enforcement). Keep orchestration out of scope so KAT-116 can compose this package without reverse coupling.

**Tech Stack:** TypeScript 5.8, Vitest 3.2, dockerode, Node.js streams, pnpm workspaces, turbo

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

### Task 1: Bootstrap `@kata/infra-adapters` Tooling and Package Contract

**Files:**
- Modify: `packages/infra-adapters/package.json`
- Create: `packages/infra-adapters/tsconfig.json`
- Create: `packages/infra-adapters/vitest.config.ts`
- Create: `packages/infra-adapters/src/index.ts`
- Create: `tests/scaffold/infra-adapters-package.test.mjs`

**Step 1: Write the failing test**

```javascript
// tests/scaffold/infra-adapters-package.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/infra-adapters/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/infra-adapters');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.dependencies.dockerode, 'dockerode dependency missing');
assert.equal(pkg.dependencies?.['@kata/spec-engine'], undefined, 'must not depend on spec-engine');
assert.ok(fs.existsSync('packages/infra-adapters/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/infra-adapters/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/infra-adapters/src/index.ts'), 'index file missing');
```

**Step 2: Run test to verify it fails**

Run: `node tests/scaffold/infra-adapters-package.test.mjs`  
Expected: FAIL with missing scripts/files/dependencies.

**Step 3: Write minimal implementation**

Run:

```bash
pnpm --filter @kata/infra-adapters add dockerode
pnpm --filter @kata/infra-adapters add -D @types/node @types/dockerode typescript vitest
```

Replace `packages/infra-adapters/package.json` with:

```json
{
  "name": "@kata/infra-adapters",
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
    "dockerode": "^4.0.9"
  },
  "devDependencies": {
    "@types/dockerode": "^3.3.40",
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2",
    "vitest": "^3.2.4"
  }
}
```

Create `packages/infra-adapters/tsconfig.json`:

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

Create `packages/infra-adapters/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

Create `packages/infra-adapters/src/index.ts`:

```typescript
export {};
```

**Step 4: Run test to verify it passes**

Run: `node tests/scaffold/infra-adapters-package.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/scaffold/infra-adapters-package.test.mjs packages/infra-adapters/package.json packages/infra-adapters/tsconfig.json packages/infra-adapters/vitest.config.ts packages/infra-adapters/src/index.ts pnpm-lock.yaml
git commit -m "feat(infra-adapters): bootstrap package tooling"
```

### Task 2: Define Contract and Domain Types

**Files:**
- Create: `packages/infra-adapters/src/types.ts`
- Create: `packages/infra-adapters/src/infra-adapter.ts`
- Create: `packages/infra-adapters/src/errors.ts`
- Create: `packages/infra-adapters/src/__tests__/contract.test.ts`
- Modify: `packages/infra-adapters/src/index.ts`

**Step 1: Write the failing test**

Create `packages/infra-adapters/src/__tests__/contract.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { InfraAdapter } from '../infra-adapter.js';
import type {
  EnvConfig,
  Environment,
  Snapshot,
  ExecResult,
  LogEntry,
  InfraErrorCode,
} from '../types.js';

describe('infra adapter contract types', () => {
  it('exposes expected error codes', () => {
    const expected: InfraErrorCode[] = [
      'DOCKER_UNAVAILABLE',
      'ENV_NOT_FOUND',
      'UNSUPPORTED_M1_NETWORK_POLICY',
      'PROVISION_FAILED',
      'EXEC_FAILED',
      'SNAPSHOT_FAILED',
      'DESTROY_FAILED',
    ];

    expect(expected).toHaveLength(7);
  });

  it('defines InfraAdapter method signatures', () => {
    type _Contract = InfraAdapter;
    expectTypeOf<EnvConfig>().toBeObject();
    expectTypeOf<Environment>().toBeObject();
    expectTypeOf<Snapshot>().toBeObject();
    expectTypeOf<ExecResult>().toBeObject();
    expectTypeOf<LogEntry>().toBeObject();
    expectTypeOf<_Contract>().toBeObject();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/contract.test.ts`  
Expected: FAIL due to missing modules/exports.

**Step 3: Write minimal implementation**

Create `packages/infra-adapters/src/types.ts`:

```typescript
export type InfraErrorCode =
  | 'DOCKER_UNAVAILABLE'
  | 'ENV_NOT_FOUND'
  | 'UNSUPPORTED_M1_NETWORK_POLICY'
  | 'PROVISION_FAILED'
  | 'EXEC_FAILED'
  | 'SNAPSHOT_FAILED'
  | 'DESTROY_FAILED';

export type NetworkPolicy = {
  allowInternet: boolean;
  allowedHosts?: string[];
  allowedPorts?: number[];
};

export type EnvConfig = {
  image: string;
  env?: Record<string, string>;
  cpuShares?: number;
  memoryMb?: number;
  mountPath?: string;
  hostWorkspacePath?: string;
  networkPolicy: NetworkPolicy;
};

export type EnvironmentState = 'provisioning' | 'ready' | 'running' | 'terminated' | 'error';

export type Environment = {
  id: string;
  image: string;
  state: EnvironmentState;
  createdAt: string;
};

export type Snapshot = {
  id: string;
  envId: string;
  imageId: string;
  tag: string;
  createdAt: string;
};

export type ExecResult = {
  envId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
};

export type LogEntry = {
  envId: string;
  timestamp: string;
  source: 'stdout' | 'stderr';
  message: string;
};
```

Create `packages/infra-adapters/src/errors.ts`:

```typescript
import type { InfraErrorCode } from './types.js';

export class InfraAdapterError extends Error {
  constructor(
    public readonly code: InfraErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InfraAdapterError';
  }
}
```

Create `packages/infra-adapters/src/infra-adapter.ts`:

```typescript
import type { EnvConfig, Environment, ExecResult, LogEntry, Snapshot } from './types.js';

export interface InfraAdapter {
  provision(config: EnvConfig): Promise<Environment>;
  snapshot(envId: string): Promise<Snapshot>;
  destroy(envId: string): Promise<void>;
  exec(envId: string, command: string): Promise<ExecResult>;
  streamLogs(envId: string): AsyncIterable<LogEntry>;
}
```

Update `packages/infra-adapters/src/index.ts`:

```typescript
export * from './types.js';
export * from './errors.js';
export * from './infra-adapter.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/contract.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/infra-adapters/src/types.ts packages/infra-adapters/src/errors.ts packages/infra-adapters/src/infra-adapter.ts packages/infra-adapters/src/index.ts packages/infra-adapters/src/__tests__/contract.test.ts
git commit -m "feat(infra-adapters): define adapter contract and domain types"
```

### Task 3: Implement Docker Connection + Policy Gate

**Files:**
- Create: `packages/infra-adapters/src/docker/connection.ts`
- Create: `packages/infra-adapters/src/docker/policy.ts`
- Create: `packages/infra-adapters/src/__tests__/docker-policy.test.ts`
- Create: `packages/infra-adapters/src/__tests__/docker-connection.test.ts`

**Step 1: Write the failing tests**

Create `packages/infra-adapters/src/__tests__/docker-policy.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { assertM1NetworkPolicy } from '../docker/policy.js';

describe('M1 network policy gate', () => {
  it('allows internet on/off without host/port constraints', () => {
    expect(() => assertM1NetworkPolicy({ allowInternet: true })).not.toThrow();
    expect(() => assertM1NetworkPolicy({ allowInternet: false })).not.toThrow();
  });

  it('rejects allowedHosts and allowedPorts in M1', () => {
    expect(() => assertM1NetworkPolicy({ allowInternet: true, allowedHosts: ['example.com'] })).toThrow();
    expect(() => assertM1NetworkPolicy({ allowInternet: true, allowedPorts: [443] })).toThrow();
  });
});
```

Create `packages/infra-adapters/src/__tests__/docker-connection.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { isLocalDockerHost } from '../docker/connection.js';

describe('docker host locality', () => {
  it('accepts local unix and npipe forms', () => {
    expect(isLocalDockerHost(undefined)).toBe(true);
    expect(isLocalDockerHost('unix:///var/run/docker.sock')).toBe(true);
    expect(isLocalDockerHost('npipe:////./pipe/docker_engine')).toBe(true);
  });

  it('rejects remote tcp hosts for M1', () => {
    expect(isLocalDockerHost('tcp://10.0.0.12:2376')).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/docker-policy.test.ts src/__tests__/docker-connection.test.ts`  
Expected: FAIL due to missing files.

**Step 3: Write minimal implementation**

Create `packages/infra-adapters/src/docker/policy.ts`:

```typescript
import { InfraAdapterError } from '../errors.js';
import type { NetworkPolicy } from '../types.js';

export function assertM1NetworkPolicy(policy: NetworkPolicy): void {
  if (policy.allowedHosts?.length || policy.allowedPorts?.length) {
    throw new InfraAdapterError(
      'UNSUPPORTED_M1_NETWORK_POLICY',
      'allowedHosts/allowedPorts are not supported in M1',
      { policy },
    );
  }
}
```

Create `packages/infra-adapters/src/docker/connection.ts`:

```typescript
import Docker from 'dockerode';
import { InfraAdapterError } from '../errors.js';

export function isLocalDockerHost(host: string | undefined): boolean {
  if (!host) return true;
  return host.startsWith('unix://') || host.startsWith('npipe://');
}

export function createLocalDockerClient(): Docker {
  const host = process.env.DOCKER_HOST;

  if (!isLocalDockerHost(host)) {
    throw new InfraAdapterError('DOCKER_UNAVAILABLE', 'M1 only supports local Docker daemon', { host });
  }

  return new Docker(host ? { host } : undefined);
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/docker-policy.test.ts src/__tests__/docker-connection.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/infra-adapters/src/docker/policy.ts packages/infra-adapters/src/docker/connection.ts packages/infra-adapters/src/__tests__/docker-policy.test.ts packages/infra-adapters/src/__tests__/docker-connection.test.ts
git commit -m "feat(infra-adapters): add local-daemon and M1 policy guards"
```

### Task 4: Implement `DockerInfraAdapter.provision` and `destroy`

**Files:**
- Create: `packages/infra-adapters/src/docker/docker-infra-adapter.ts`
- Create: `packages/infra-adapters/src/docker/mappers.ts`
- Create: `packages/infra-adapters/src/__tests__/docker-adapter-lifecycle.test.ts`
- Modify: `packages/infra-adapters/src/index.ts`

**Step 1: Write the failing test**

Create `packages/infra-adapters/src/__tests__/docker-adapter-lifecycle.test.ts` using mocked docker client:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { DockerInfraAdapter } from '../docker/docker-infra-adapter.js';

// mock dockerode object graph enough to cover create/start/stop/remove

describe('DockerInfraAdapter lifecycle', () => {
  it('provisions and returns environment', async () => {
    const adapter = new DockerInfraAdapter(/* mocked docker */);
    const env = await adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } });

    expect(env.id).toBeTruthy();
    expect(['ready', 'running']).toContain(env.state);
  });

  it('destroy is idempotent for missing env', async () => {
    const adapter = new DockerInfraAdapter(/* mocked docker */);
    await expect(adapter.destroy('missing')).resolves.toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/docker-adapter-lifecycle.test.ts`  
Expected: FAIL due to missing implementation.

**Step 3: Write minimal implementation**

Implement:
- constructor accepts optional docker client for tests; default uses `createLocalDockerClient`.
- `provision`:
  - validate policy via `assertM1NetworkPolicy`.
  - create/start container with config limits/env/mounts.
  - map to `Environment` via mapper.
- `destroy`:
  - inspect/get container.
  - stop + remove container.
  - remove associated named volume if created by adapter.
  - swallow not-found as success.

Update public exports in `packages/infra-adapters/src/index.ts`:

```typescript
export * from './types.js';
export * from './errors.js';
export * from './infra-adapter.js';
export * from './docker/docker-infra-adapter.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/docker-adapter-lifecycle.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/infra-adapters/src/docker/docker-infra-adapter.ts packages/infra-adapters/src/docker/mappers.ts packages/infra-adapters/src/__tests__/docker-adapter-lifecycle.test.ts packages/infra-adapters/src/index.ts
git commit -m "feat(infra-adapters): implement provision and destroy lifecycle"
```

### Task 5: Implement `exec`, `streamLogs`, and `snapshot`

**Files:**
- Modify: `packages/infra-adapters/src/docker/docker-infra-adapter.ts`
- Create: `packages/infra-adapters/src/__tests__/docker-adapter-exec-logs-snapshot.test.ts`

**Step 1: Write the failing test**

Create `packages/infra-adapters/src/__tests__/docker-adapter-exec-logs-snapshot.test.ts` with docker mocks:

```typescript
import { describe, expect, it } from 'vitest';
import { DockerInfraAdapter } from '../docker/docker-infra-adapter.js';

describe('DockerInfraAdapter exec/logs/snapshot', () => {
  it('exec returns exit code, stdout, stderr', async () => {
    const adapter = new DockerInfraAdapter(/* mocked docker */);
    const result = await adapter.exec('env-1', 'echo hi');

    expect(result.exitCode).toBeTypeOf('number');
    expect(result.stdout).toBeTypeOf('string');
    expect(result.stderr).toBeTypeOf('string');
  });

  it('streamLogs yields labeled entries', async () => {
    const adapter = new DockerInfraAdapter(/* mocked docker */);

    const entries = [];
    for await (const entry of adapter.streamLogs('env-1')) {
      entries.push(entry);
      if (entries.length >= 2) break;
    }

    expect(entries.every((e) => e.source === 'stdout' || e.source === 'stderr')).toBe(true);
  });

  it('snapshot commits container and returns metadata', async () => {
    const adapter = new DockerInfraAdapter(/* mocked docker */);
    const snap = await adapter.snapshot('env-1');

    expect(snap.envId).toBe('env-1');
    expect(snap.imageId).toBeTruthy();
    expect(snap.tag).toContain('kata-snapshots');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/docker-adapter-exec-logs-snapshot.test.ts`  
Expected: FAIL due to missing methods.

**Step 3: Write minimal implementation**

Implement in `docker-infra-adapter.ts`:
- `exec` using Docker exec create/start/inspect path, demux stdout/stderr, capture timing.
- `streamLogs` using container logs stream and async generator that yields normalized entries.
- `snapshot` using container commit with deterministic repo/tag; return `Snapshot`.
- Wrap Docker failures into typed `InfraAdapterError` codes.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/infra-adapters test -- src/__tests__/docker-adapter-exec-logs-snapshot.test.ts`  
Expected: PASS.

Then run full package tests:

Run: `pnpm --filter @kata/infra-adapters test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/infra-adapters/src/docker/docker-infra-adapter.ts packages/infra-adapters/src/__tests__/docker-adapter-exec-logs-snapshot.test.ts
git commit -m "feat(infra-adapters): implement exec logs and snapshot"
```

### Task 6: Add Optional Real-Docker Integration Test and Verification Gates

**Files:**
- Create: `packages/infra-adapters/src/__tests__/docker.integration.test.ts`
- Modify: `packages/infra-adapters/package.json`
- Create: `docs/verification/2026-02-26-kat-114.md`

**Step 1: Write the failing integration test (gated)**

Create `packages/infra-adapters/src/__tests__/docker.integration.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { DockerInfraAdapter } from '../docker/docker-infra-adapter.js';

const enabled = process.env.KATA_DOCKER_E2E === '1';

describe.skipIf(!enabled)('docker integration', () => {
  it('runs full lifecycle against local daemon', async () => {
    const adapter = new DockerInfraAdapter();

    const env = await adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } });
    const exec = await adapter.exec(env.id, 'echo integration-ok');
    const snap = await adapter.snapshot(env.id);

    expect(exec.exitCode).toBe(0);
    expect(exec.stdout).toContain('integration-ok');
    expect(snap.imageId).toBeTruthy();

    await adapter.destroy(env.id);
  });
});
```

**Step 2: Run tests to verify behavior**

Run: `pnpm --filter @kata/infra-adapters test`  
Expected: PASS (integration skipped by default).

If Docker is available locally, run:

Run: `KATA_DOCKER_E2E=1 pnpm --filter @kata/infra-adapters test -- src/__tests__/docker.integration.test.ts`  
Expected: PASS end-to-end.

**Step 3: Write minimal implementation updates**

Add script to `packages/infra-adapters/package.json`:

```json
"test:docker": "KATA_DOCKER_E2E=1 vitest run src/__tests__/docker.integration.test.ts"
```

Create verification note at `docs/verification/2026-02-26-kat-114.md` with:
- executed commands
- pass/fail outcomes
- whether integration test ran or was skipped
- known M1 limitations (remote host + host/port policy)

**Step 4: Run final repo checks**

Run:

```bash
pnpm --filter @kata/infra-adapters test
pnpm --filter @kata/infra-adapters typecheck
pnpm lint
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/infra-adapters/src/__tests__/docker.integration.test.ts packages/infra-adapters/package.json docs/verification/2026-02-26-kat-114.md
git commit -m "test(infra-adapters): add optional local-docker integration verification"
```
