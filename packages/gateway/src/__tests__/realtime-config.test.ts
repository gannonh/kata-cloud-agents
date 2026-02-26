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
