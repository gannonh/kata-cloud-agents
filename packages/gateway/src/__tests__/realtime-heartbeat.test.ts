import { describe, expect, it, vi } from 'vitest';
import { createRealtimeHub } from '../realtime/hub.js';
import { runHeartbeatSweep } from '../realtime/heartbeat.js';

describe('realtime heartbeat', () => {
  it('sends ping for healthy connections', () => {
    const hub = createRealtimeHub(() => 1_000);
    const ping = vi.fn();
    const close = vi.fn();
    hub.addConnection({ id: 'a', send: vi.fn(), close, ping });

    runHeartbeatSweep(hub, {
      now: () => 5_000,
      timeoutMs: 30_000,
      closeCode: 4001,
      closeReason: 'heartbeat timeout',
    });

    expect(ping).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('closes stale connections', () => {
    const hub = createRealtimeHub(() => 1_000);
    const close = vi.fn();
    hub.addConnection({ id: 'a', send: vi.fn(), close, ping: vi.fn() });

    runHeartbeatSweep(hub, {
      now: () => 40_000,
      timeoutMs: 30_000,
      closeCode: 4001,
      closeReason: 'heartbeat timeout',
    });

    expect(close).toHaveBeenCalledWith(4001, 'heartbeat timeout');
  });
});
