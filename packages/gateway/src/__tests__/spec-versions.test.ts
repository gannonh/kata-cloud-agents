import { describe, expect, it, vi } from 'vitest';
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
          id: 'v1-id',
          specId,
          versionNumber: 1,
          content: { title: 'old' },
          actorId,
          actorType: 'user',
          changeSummary: '',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'v2-id',
          specId,
          versionNumber: 2,
          content: { title: 'new' },
          actorId,
          actorType: 'user',
          changeSummary: '',
          createdAt: new Date(),
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
        id: 'v1-id',
        specId,
        versionNumber: 1,
        content: { title: 'original' },
        actorId,
        actorType: 'user' as const,
        changeSummary: 'First',
        createdAt: new Date(),
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

describe('team isolation', () => {
  it('returns 404 when spec belongs to another team', async () => {
    const store = makeVersionStore({
      getSpec: vi.fn(async () => ({ id: specId, teamId: 'other-team', content: {} })),
    });
    const app = createGatewayApp(makeConfig(), makeDeps({ versionStore: store }));
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions`));
    expect(res.status).toBe(404);
  });
});

describe('missing version store', () => {
  it('returns 500 when version store dependency is not configured', async () => {
    const { versionStore: _ignored, ...depsWithoutStore } = makeDeps();
    const app = createGatewayApp(makeConfig(), depsWithoutStore);
    const res = await app.request(authedRequest(`/api/specs/${specId}/versions`));
    expect(res.status).toBe(500);
  });
});
