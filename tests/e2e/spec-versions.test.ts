import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../../packages/gateway/src/app.js';
import type { VersionStoreAdapter } from '../../packages/gateway/src/types.js';

const specId = '00000000-0000-4000-8000-000000000001';
const teamId = 'team-1';

function makeConfig() {
  return {
    port: 3001,
    allowedOrigins: ['*'],
    sessionCookieName: 'kata.sid',
    redisUrl: 'redis://localhost:6379',
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 1_000,
    wsHeartbeatIntervalMs: 15_000,
    wsHeartbeatTimeoutMs: 30_000,
    wsMaxSubscriptionsPerConnection: 100,
  };
}

function createInMemoryVersionStore(): VersionStoreAdapter {
  const versions: Array<{
    id: string;
    specId: string;
    versionNumber: number;
    content: Record<string, unknown>;
    actorId: string;
    actorType: string;
    changeSummary: string;
    createdAt: Date;
  }> = [];
  let specContent: Record<string, unknown> = { title: 'Original' };
  let idCounter = 0;

  return {
    getSpec: async (id) => (id === specId ? { id, teamId, content: specContent } : null),
    updateSpecContent: async (_id, content) => {
      specContent = content;
    },
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
      items: [...versions]
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .slice(offset, offset + limit),
      total: versions.length,
    }),
    getMaxVersionNumber: async () =>
      (versions.length === 0 ? 0 : Math.max(...versions.map((v) => v.versionNumber))),
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

    const r1 = await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Version 1' }, changeSummary: 'Initial' }),
    }));
    expect(r1.status).toBe(201);
    const v1 = await r1.json();
    expect(v1.versionNumber).toBe(1);

    const r2 = await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Version 2', intent: 'added field' }, changeSummary: 'Added intent' }),
    }));
    expect(r2.status).toBe(201);
    const v2 = await r2.json();
    expect(v2.versionNumber).toBe(2);

    const r3 = await app.request(authedRequest(`/api/specs/${specId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content: { title: 'Version 3', intent: 'updated' }, changeSummary: 'Updated intent' }),
    }));
    expect(r3.status).toBe(201);

    const listRes = await app.request(authedRequest(`/api/specs/${specId}/versions`));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.total).toBe(3);
    expect(list.items[0].versionNumber).toBe(3);

    const diffRes = await app.request(authedRequest(`/api/specs/${specId}/versions/1/diff/2`));
    expect(diffRes.status).toBe(200);
    const diff = await diffRes.json();
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'title', type: 'changed' }),
    ]));

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
    store.getSpec = async () => ({ id: specId, teamId: 'other-team', content: {} });

    const deps = makeDeps(store);
    const app = createGatewayApp(makeConfig(), deps);

    const res = await app.request(authedRequest(`/api/specs/${specId}/versions`));
    expect(res.status).toBe(404);
  });
});

describe('Edge cases (E2E)', () => {
  it('diff returns empty array for identical versions', async () => {
    const store = createInMemoryVersionStore();
    const app = createGatewayApp(makeConfig(), makeDeps(store));

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
