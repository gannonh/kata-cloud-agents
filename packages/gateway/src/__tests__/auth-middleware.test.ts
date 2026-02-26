import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../app.js';

function makeConfig() {
  return {
    port: 3001,
    allowedOrigins: ['http://localhost:1420'],
    sessionCookieName: 'kata.sid',
    sessionCookieSecret: 'test-secret',
    redisUrl: 'redis://localhost:6379',
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
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
