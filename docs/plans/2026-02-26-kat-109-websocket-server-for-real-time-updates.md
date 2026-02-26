# KAT-109 WebSocket Server for Real-Time Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add authenticated native WebSocket realtime support to `@kata/gateway` with channel subscriptions, heartbeat, and required event types, plus a shared reconnecting client package consumed by web/desktop/mobile.

**Architecture:** Keep realtime in-process within `packages/gateway` for M0 delivery speed. Introduce a modular realtime layer (`protocol`, `auth`, `channels`, `hub`, `heartbeat`, `ws-server`) so Redis pub/sub can replace the in-memory hub later without API breakage. Add a separate `@kata/realtime-client` workspace package with reconnect/resubscribe semantics and lightweight app wiring.

**Tech Stack:** TypeScript 5.8, Hono, Node HTTP server, `ws`, Zod, Vitest 3.2, pnpm workspaces

---

Execution discipline references: `@test-driven-development`, `@verification-before-completion`, `@committing-changes`

### Task 1: Gateway Realtime Config + Dependencies Baseline

**Files:**
- Modify: `packages/gateway/package.json`
- Modify: `packages/gateway/src/config.ts`
- Modify: `packages/gateway/src/types.ts`
- Modify: `packages/gateway/src/server.ts`
- Test: `packages/gateway/src/__tests__/realtime-config.test.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/realtime-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadGatewayConfig } from '../config.js';

describe('realtime config', () => {
  it('loads websocket defaults', () => {
    const config = loadGatewayConfig({
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(config.wsHeartbeatIntervalMs).toBe(15_000);
    expect(config.wsHeartbeatTimeoutMs).toBe(30_000);
    expect(config.wsMaxSubscriptionsPerConnection).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/realtime-config.test.ts`  
Expected: FAIL because websocket config fields do not exist.

**Step 3: Write minimal implementation**

- Add `ws` dependency and `@types/ws` dev dependency in `packages/gateway/package.json`.
- Extend config schema in `packages/gateway/src/config.ts`:
  - `WS_HEARTBEAT_INTERVAL_MS` default `15000`
  - `WS_HEARTBEAT_TIMEOUT_MS` default `30000`
  - `WS_MAX_SUBSCRIPTIONS_PER_CONNECTION` default `100`
- Extend `GatewayConfig` in `packages/gateway/src/types.ts` with those fields.
- Return those fields from `loadGatewayConfig`.
- Update `packages/gateway/src/server.ts` stub wiring to compile with new deps/config.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/realtime-config.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/package.json packages/gateway/src/config.ts packages/gateway/src/types.ts packages/gateway/src/server.ts packages/gateway/src/__tests__/realtime-config.test.ts pnpm-lock.yaml
git commit -m "feat(gateway): add websocket config and ws dependency"
```

### Task 2: Protocol Envelope and Message Validation

**Files:**
- Create: `packages/gateway/src/realtime/protocol.ts`
- Create: `packages/gateway/src/__tests__/realtime-protocol.test.ts`
- Modify: `packages/gateway/src/index.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/realtime-protocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { OutboundMessageSchema, InboundCommandSchema } from '../realtime/protocol.js';

describe('realtime protocol', () => {
  it('accepts required outbound event types', () => {
    const base = {
      timestamp: '2026-02-26T00:00:00.000Z',
      eventId: 'evt_1',
      encoding: 'json',
      payload: {},
    };

    expect(OutboundMessageSchema.parse({ ...base, type: 'agent_status_changed' }).type).toBe('agent_status_changed');
    expect(OutboundMessageSchema.parse({ ...base, type: 'log_entry' }).type).toBe('log_entry');
    expect(OutboundMessageSchema.parse({ ...base, type: 'spec_updated' }).type).toBe('spec_updated');
    expect(OutboundMessageSchema.parse({ ...base, type: 'task_completed' }).type).toBe('task_completed');
    expect(OutboundMessageSchema.parse({ ...base, type: 'blocker_raised' }).type).toBe('blocker_raised');
  });

  it('accepts subscribe command', () => {
    const cmd = InboundCommandSchema.parse({ type: 'subscribe', channel: 'team:t1' });
    expect(cmd.type).toBe('subscribe');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/realtime-protocol.test.ts`  
Expected: FAIL because protocol module does not exist.

**Step 3: Write minimal implementation**

Create `packages/gateway/src/realtime/protocol.ts` with Zod schemas:

```ts
import { z } from 'zod';

export const OutboundTypeSchema = z.enum([
  'agent_status_changed',
  'log_entry',
  'spec_updated',
  'task_completed',
  'blocker_raised',
  'subscribed',
  'unsubscribed',
  'error',
  'pong',
]);

export const OutboundMessageSchema = z.object({
  type: OutboundTypeSchema,
  channel: z.string().optional(),
  timestamp: z.string(),
  eventId: z.string(),
  encoding: z.literal('json'),
  payload: z.unknown(),
});

export const InboundCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), channel: z.string() }),
  z.object({ type: z.literal('unsubscribe'), channel: z.string() }),
  z.object({ type: z.literal('ping') }),
]);
```

Export from `packages/gateway/src/index.ts`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/realtime-protocol.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/realtime/protocol.ts packages/gateway/src/__tests__/realtime-protocol.test.ts packages/gateway/src/index.ts
git commit -m "feat(gateway): add websocket protocol schemas"
```

### Task 3: Shared Principal Resolution for HTTP + WebSocket Connect

**Files:**
- Create: `packages/gateway/src/auth/resolve-principal.ts`
- Create: `packages/gateway/src/__tests__/resolve-principal.test.ts`
- Modify: `packages/gateway/src/middleware/auth.ts`
- Modify: `packages/gateway/src/types.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/resolve-principal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolvePrincipal } from '../auth/resolve-principal.js';

const deps = {
  apiKeyAuth: { validateApiKey: async (key: string) => (key === 'kat_live_1' ? { teamId: 't1', keyId: 'k1' } : null) },
  sessionStore: { getSession: async (sid: string) => (sid === 'sid_ok' ? { userId: 'u1', teamId: 't1', expiresAt: '2099-01-01T00:00:00.000Z' } : null) },
  now: () => new Date('2026-02-26T00:00:00.000Z'),
};

describe('resolvePrincipal', () => {
  it('resolves api key principal', async () => {
    const result = await resolvePrincipal({ apiKey: 'kat_live_1', sessionId: null }, deps);
    expect(result.principal?.type).toBe('api_key');
  });

  it('resolves session principal', async () => {
    const result = await resolvePrincipal({ apiKey: null, sessionId: 'sid_ok' }, deps);
    expect(result.principal?.type).toBe('session_user');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/resolve-principal.test.ts`  
Expected: FAIL because resolver does not exist.

**Step 3: Write minimal implementation**

- Implement `resolvePrincipal` to return structured outcome (`principal`, `errorCode`, `status`).
- Reuse this resolver inside `middleware/auth.ts` to avoid auth drift between HTTP and WS.
- Keep fail-closed behavior for adapter exceptions.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/resolve-principal.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/auth/resolve-principal.ts packages/gateway/src/__tests__/resolve-principal.test.ts packages/gateway/src/middleware/auth.ts packages/gateway/src/types.ts
git commit -m "refactor(gateway): share auth principal resolution for ws and http"
```

### Task 4: Channel Parsing + Authorization Gates

**Files:**
- Create: `packages/gateway/src/realtime/channels.ts`
- Create: `packages/gateway/src/__tests__/realtime-channels.test.ts`
- Modify: `packages/gateway/src/types.ts`

**Step 1: Write the failing test**

Create `packages/gateway/src/__tests__/realtime-channels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { authorizeChannel } from '../realtime/channels.js';

const principal = { type: 'session_user', teamId: 'team-1', userId: 'u1' } as const;

const access = {
  resolveSpecTeamId: async (specId: string) => (specId === 'spec-1' ? 'team-1' : null),
  resolveAgentTeamId: async (agentId: string) => (agentId === 'agent-1' ? 'team-1' : null),
};

describe('channel authorization', () => {
  it('allows matching team channel', async () => {
    await expect(authorizeChannel('team:team-1', principal, access)).resolves.toEqual({ ok: true });
  });

  it('rejects foreign team channel', async () => {
    await expect(authorizeChannel('team:team-2', principal, access)).resolves.toEqual({ ok: false });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/realtime-channels.test.ts`  
Expected: FAIL because channel auth module does not exist.

**Step 3: Write minimal implementation**

- Add channel parser supporting `spec:{id}`, `agent:{id}`, `team:{id}`.
- Add `ChannelAccessAdapter` in `types.ts`:
  - `resolveSpecTeamId(specId)`
  - `resolveAgentTeamId(agentId)`
- Implement `authorizeChannel` with fail-closed semantics.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/realtime-channels.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/realtime/channels.ts packages/gateway/src/__tests__/realtime-channels.test.ts packages/gateway/src/types.ts
git commit -m "feat(gateway): add websocket channel parsing and authz"
```

### Task 5: In-Memory Connection Hub + Heartbeat Lifecycle

**Files:**
- Create: `packages/gateway/src/realtime/hub.ts`
- Create: `packages/gateway/src/realtime/heartbeat.ts`
- Create: `packages/gateway/src/__tests__/realtime-hub.test.ts`
- Create: `packages/gateway/src/__tests__/realtime-heartbeat.test.ts`

**Step 1: Write the failing tests**

Create `packages/gateway/src/__tests__/realtime-hub.test.ts` and `packages/gateway/src/__tests__/realtime-heartbeat.test.ts` with coverage for:
- subscribe/unsubscribe membership
- publish fanout by channel
- heartbeat ping schedule
- stale connection close on timeout

Example assertion shape:

```ts
expect(hub.publish('team:t1', msg)).toBe(2);
expect(conn.close).toHaveBeenCalledWith(expect.any(Number), expect.stringContaining('heartbeat'));
```

**Step 2: Run tests to verify they fail**

Run:
- `pnpm --filter @kata/gateway test -- src/__tests__/realtime-hub.test.ts`
- `pnpm --filter @kata/gateway test -- src/__tests__/realtime-heartbeat.test.ts`

Expected: FAIL because modules do not exist.

**Step 3: Write minimal implementation**

- Implement `createRealtimeHub()` with:
  - connection registry
  - channel membership maps
  - `subscribe`, `unsubscribe`, `publish`, `disconnect`
- Implement heartbeat manager:
  - send ping at `wsHeartbeatIntervalMs`
  - track `lastPongAt`
  - close stale sockets after `wsHeartbeatTimeoutMs`

**Step 4: Run tests to verify they pass**

Run the two commands from Step 2.  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/realtime/hub.ts packages/gateway/src/realtime/heartbeat.ts packages/gateway/src/__tests__/realtime-hub.test.ts packages/gateway/src/__tests__/realtime-heartbeat.test.ts
git commit -m "feat(gateway): add realtime hub and heartbeat manager"
```

### Task 6: Wire Native WebSocket Server into Gateway Runtime

**Files:**
- Create: `packages/gateway/src/realtime/ws-server.ts`
- Create: `packages/gateway/src/__tests__/ws-server.integration.test.ts`
- Modify: `packages/gateway/src/server.ts`
- Modify: `packages/gateway/src/types.ts`
- Modify: `packages/gateway/src/index.ts`

**Step 1: Write the failing integration test**

Create `packages/gateway/src/__tests__/ws-server.integration.test.ts` that:
- starts gateway on an ephemeral port,
- opens a `ws` client with valid auth,
- subscribes to `team:team-1`,
- publishes a message through server publisher,
- asserts message receipt and heartbeat pong.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/ws-server.integration.test.ts`  
Expected: FAIL because WS runtime entrypoint is not wired.

**Step 3: Write minimal implementation**

- Replace bare `serve()` startup with Node HTTP server + `ws` `WebSocketServer({ noServer: true })`.
- Route upgrade requests for `/ws`.
- On connect:
  - resolve principal via shared auth resolver,
  - initialize hub connection state,
  - accept `subscribe`/`unsubscribe`/`ping` commands,
  - publish `subscribed`/`unsubscribed`/`error`/`pong` events.
- Expose a publisher surface from server wiring for required event types.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @kata/gateway test -- src/__tests__/ws-server.integration.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/gateway/src/realtime/ws-server.ts packages/gateway/src/__tests__/ws-server.integration.test.ts packages/gateway/src/server.ts packages/gateway/src/types.ts packages/gateway/src/index.ts
git commit -m "feat(gateway): wire native websocket server with channel subscriptions"
```

### Task 7: Create `@kata/realtime-client` Reconnection Package

**Files:**
- Create: `packages/realtime-client/package.json`
- Create: `packages/realtime-client/tsconfig.json`
- Create: `packages/realtime-client/vitest.config.ts`
- Create: `packages/realtime-client/src/index.ts`
- Create: `packages/realtime-client/src/client.ts`
- Create: `packages/realtime-client/src/types.ts`
- Create: `packages/realtime-client/src/__tests__/client.test.ts`
- Create: `tests/scaffold/realtime-client-package.test.mjs`

**Step 1: Write the failing tests**

- `tests/scaffold/realtime-client-package.test.mjs` to assert package/tooling exists.
- `packages/realtime-client/src/__tests__/client.test.ts` to verify:
  - reconnect backoff progression
  - automatic resubscribe after reconnect
  - lifecycle events emitted in order

**Step 2: Run tests to verify they fail**

Run:
- `node tests/scaffold/realtime-client-package.test.mjs`
- `pnpm --filter @kata/realtime-client test`

Expected: FAIL because package and implementation do not exist.

**Step 3: Write minimal implementation**

- Implement `createRealtimeClient` API:

```ts
const client = createRealtimeClient({ url, apiKey, backoff: { minMs: 250, maxMs: 10_000 } });
client.subscribe('team:team-1', (evt) => {});
client.connect();
```

- Behaviors:
  - exponential backoff + jitter
  - tracked subscriptions for replay on reconnect
  - command serialization (`subscribe`, `unsubscribe`, `ping`)

**Step 4: Run tests to verify they pass**

Run both commands from Step 2.  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/realtime-client tests/scaffold/realtime-client-package.test.mjs pnpm-lock.yaml
git commit -m "feat(realtime-client): add reconnecting websocket client package"
```

### Task 8: Integrate Shared Realtime Client in Web/Desktop/Mobile

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `apps/mobile/package.json`
- Create: `apps/web/src/realtime.ts`
- Create: `apps/desktop/src/realtime.ts`
- Create: `apps/mobile/src/realtime.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/desktop/src/main.tsx`
- Modify: `apps/mobile/src/main.tsx`
- Modify: `tests/unit/apps-smoke.test.tsx`

**Step 1: Write the failing test**

Update `tests/unit/apps-smoke.test.tsx` with a new assertion that each app can import and initialize its realtime bootstrap function without throwing.

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/apps-smoke.test.tsx`  
Expected: FAIL because realtime bootstrap files do not exist.

**Step 3: Write minimal implementation**

- Add `@kata/realtime-client` dependency to each app package.
- Add `src/realtime.ts` per app with guarded bootstrap:
  - build client instance
  - only call `connect()` when `VITE_ENABLE_REALTIME === 'true'`
- Invoke bootstrap from each `main.tsx`.

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/apps-smoke.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/package.json apps/desktop/package.json apps/mobile/package.json apps/web/src/realtime.ts apps/desktop/src/realtime.ts apps/mobile/src/realtime.ts apps/web/src/main.tsx apps/desktop/src/main.tsx apps/mobile/src/main.tsx tests/unit/apps-smoke.test.tsx pnpm-lock.yaml
git commit -m "feat(apps): wire shared realtime client bootstrap"
```

### Task 9: End-to-End Verification + Completion Evidence Draft

**Files:**
- Create: `docs/verification/kat-109-websocket-realtime.md`

**Step 1: Write the verification checklist file (failing by definition until commands run)**

Create checklist sections for:
- gateway realtime tests
- realtime client tests
- app smoke tests
- typecheck

**Step 2: Run verification commands**

Run:
- `pnpm --filter @kata/gateway typecheck`
- `pnpm --filter @kata/gateway test`
- `pnpm --filter @kata/realtime-client typecheck`
- `pnpm --filter @kata/realtime-client test`
- `pnpm test:unit -- tests/unit/apps-smoke.test.tsx`

Expected: PASS for all commands.

**Step 3: Record exact command outputs in verification doc**

Populate pass/fail summary and acceptance mapping evidence.

**Step 4: Run full workspace guardrail**

Run: `pnpm check`  
Expected: PASS (or document any pre-existing unrelated failures explicitly).

**Step 5: Commit**

```bash
git add docs/verification/kat-109-websocket-realtime.md
git commit -m "docs(verification): record KAT-109 websocket evidence"
```
