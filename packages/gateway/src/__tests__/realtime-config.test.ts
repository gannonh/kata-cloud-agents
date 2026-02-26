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

  it('rejects timeout values that are not greater than interval', () => {
    expect(() =>
      loadGatewayConfig({
        REDIS_URL: 'redis://localhost:6379',
        WS_HEARTBEAT_INTERVAL_MS: '15000',
        WS_HEARTBEAT_TIMEOUT_MS: '15000',
      }),
    ).toThrow(/WS_HEARTBEAT_TIMEOUT_MS/);
  });
});
