import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../app.js';

function makeApp() {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  const app = createGatewayApp(
    {
      port: 3001,
      allowedOrigins: ['http://localhost:1420'],
      sessionCookieName: 'kata.sid',
      sessionCookieSecret: 'test-secret',
      redisUrl: 'redis://localhost:6379',
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 2,
    },
    {
      logger,
      apiKeyAuth: {
        validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
      },
      sessionStore: {
        getSession: async () => null,
      },
      now: () => new Date('2026-02-26T00:00:00.000Z'),
    },
  );

  return { app, logger };
}

describe('rate limit + cors + logging', () => {
  it('enforces rate limit on protected routes', async () => {
    const { app } = makeApp();
    const headers = {
      'x-api-key': 'kat_test_1',
      'x-forwarded-for': '10.0.0.5',
    };

    expect((await app.request('/api/specs', { headers })).status).toBe(200);
    expect((await app.request('/api/specs', { headers })).status).toBe(200);

    const blocked = await app.request('/api/specs', { headers });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('derives distinct buckets from x-real-ip when x-forwarded-for is missing', async () => {
    const { app } = makeApp();
    const clientOneHeaders = {
      'x-api-key': 'kat_test_1',
      'x-real-ip': '10.0.0.5',
    };
    const clientTwoHeaders = {
      'x-api-key': 'kat_test_1',
      'x-real-ip': '10.0.0.6',
    };

    expect((await app.request('/api/specs', { headers: clientOneHeaders })).status).toBe(200);
    expect((await app.request('/api/specs', { headers: clientOneHeaders })).status).toBe(200);
    expect((await app.request('/api/specs', { headers: clientTwoHeaders })).status).toBe(200);
    expect((await app.request('/api/specs', { headers: clientTwoHeaders })).status).toBe(200);

    const blockedClientOne = await app.request('/api/specs', { headers: clientOneHeaders });
    const allowedClientTwo = await app.request('/api/specs', { headers: clientTwoHeaders });

    expect(blockedClientOne.status).toBe(429);
    expect(allowedClientTwo.status).toBe(429);
  });

  it('sets allow-origin header for allowed origins', async () => {
    const { app } = makeApp();
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:1420' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:1420');
  });

  it('emits request logs', async () => {
    const { app, logger } = makeApp();
    await app.request('/health');
    expect(logger.info).toHaveBeenCalled();
  });
});
