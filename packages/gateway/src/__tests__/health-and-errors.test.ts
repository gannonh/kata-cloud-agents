import { describe, expect, it } from 'vitest';
import { createGatewayApp } from '../app.js';

const baseConfig = {
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

const deps = {
  logger: {
    info: () => {},
    error: () => {},
  },
  apiKeyAuth: {
    validateApiKey: async () => null,
  },
  sessionStore: {
    getSession: async () => null,
  },
  now: () => new Date('2026-02-26T00:00:00.000Z'),
};

describe('gateway app basics', () => {
  it('returns health status', async () => {
    const app = createGatewayApp(baseConfig, deps);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  it('returns requestId on unknown route', async () => {
    const app = createGatewayApp(baseConfig, deps);
    const res = await app.request('/missing');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBeTruthy();
  });
});
