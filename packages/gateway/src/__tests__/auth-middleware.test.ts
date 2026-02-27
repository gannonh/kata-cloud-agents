import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../app.js';

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

  it('accepts valid session cookie', async () => {
    const deps = makeDeps({
      sessionStore: {
        getSession: vi.fn(async () => ({
          userId: 'user-1',
          teamId: 'team-1',
          expiresAt: '2026-02-27T00:00:00.000Z',
        })),
      },
    });
    const app = createGatewayApp(makeConfig(), deps);
    const res = await app.request('/api/teams', {
      headers: { cookie: 'kata.sid=sid-123' },
    });
    expect(res.status).toBe(200);
  });

  it('rejects expired session cookie', async () => {
    const deps = makeDeps({
      sessionStore: {
        getSession: vi.fn(async () => ({
          userId: 'user-1',
          teamId: 'team-1',
          expiresAt: '2026-02-25T00:00:00.000Z',
        })),
      },
    });
    const app = createGatewayApp(makeConfig(), deps);
    const res = await app.request('/api/teams', {
      headers: { cookie: 'kata.sid=sid-123' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns INVALID_API_KEY for unrecognized key', async () => {
    const app = createGatewayApp(makeConfig(), makeDeps());
    const res = await app.request('/api/teams', {
      headers: { 'x-api-key': 'kat_live_unknown' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_API_KEY');
  });

  it('returns INVALID_SESSION for unrecognized session', async () => {
    const app = createGatewayApp(makeConfig(), makeDeps());
    const res = await app.request('/api/teams', {
      headers: { cookie: 'kata.sid=unknown-session' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SESSION');
  });

  it('prefers API key over session cookie when both present', async () => {
    const deps = makeDeps({
      apiKeyAuth: {
        validateApiKey: vi.fn(async () => ({ teamId: 'api-team', keyId: 'key-1' })),
      },
      sessionStore: {
        getSession: vi.fn(async () => ({
          userId: 'user-1',
          teamId: 'session-team',
          expiresAt: '2026-02-27T00:00:00.000Z',
        })),
      },
    });
    const app = createGatewayApp(makeConfig(), deps);
    const res = await app.request('/api/teams', {
      headers: {
        'x-api-key': 'kat_live_123',
        cookie: 'kata.sid=sid-123',
      },
    });
    expect(res.status).toBe(200);
    expect(deps.apiKeyAuth.validateApiKey).toHaveBeenCalledWith('kat_live_123');
    expect(deps.sessionStore.getSession).not.toHaveBeenCalled();
  });

  it('fails closed when API key adapter throws', async () => {
    const deps = makeDeps({
      apiKeyAuth: {
        validateApiKey: vi.fn(async () => {
          throw new Error('auth backend down');
        }),
      },
    });
    const app = createGatewayApp(makeConfig(), deps);
    const res = await app.request('/api/teams', {
      headers: { 'x-api-key': 'kat_live_123' },
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_SERVICE_UNAVAILABLE');
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
