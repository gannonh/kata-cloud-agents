import { describe, expect, it } from 'vitest';
import { loadGatewayConfig } from '../config.js';

describe('loadGatewayConfig', () => {
  it('throws readable error on missing required env vars', () => {
    expect(() => loadGatewayConfig({} as NodeJS.ProcessEnv)).toThrow(
      'Invalid gateway configuration',
    );
  });

  it('returns valid config from complete env', () => {
    const config = loadGatewayConfig({
      REDIS_URL: 'redis://localhost:6379',
    } as NodeJS.ProcessEnv);
    expect(config.port).toBe(3001);
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.sessionCookieName).toBe('kata.sid');
  });
});
