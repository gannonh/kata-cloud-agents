import { describe, expect, it } from 'vitest';
import { createGatewayApp } from '../app.js';

const config = {
  port: 3001,
  allowedOrigins: ['http://localhost:1420'],
  sessionCookieName: 'kata.sid',
  sessionCookieSecret: 'test-secret',
  redisUrl: 'redis://localhost:6379',
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 60,
};

const deps = {
  logger: { info: () => {}, error: () => {} },
  apiKeyAuth: {
    validateApiKey: async () => ({ teamId: 'team-1', keyId: 'key-1' }),
  },
  sessionStore: {
    getSession: async () => null,
  },
  now: () => new Date('2026-02-26T00:00:00.000Z'),
};

describe('openapi and route groups', () => {
  it('serves openapi json', async () => {
    const app = createGatewayApp(config, deps);
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.0.0');
    expect(body.paths['/api/specs']).toBeDefined();
    expect(body.paths['/api/agents']).toBeDefined();
    expect(body.paths['/api/teams']).toBeDefined();
    expect(body.paths['/api/artifacts']).toBeDefined();
  });

  it('allows api-key-authenticated access to all route groups', async () => {
    const app = createGatewayApp(config, deps);
    const headers = { 'x-api-key': 'kat_test_1' };

    const specs = await app.request('/api/specs', { headers });
    const agents = await app.request('/api/agents', { headers });
    const teams = await app.request('/api/teams', { headers });
    const artifacts = await app.request('/api/artifacts', { headers });

    expect(specs.status).toBe(200);
    expect(agents.status).toBe(200);
    expect(teams.status).toBe(200);
    expect(artifacts.status).toBe(200);
  });
});
