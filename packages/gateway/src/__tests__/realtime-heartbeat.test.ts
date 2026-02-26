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

  it('continues sweep if a ping throws', () => {
    const hub = createRealtimeHub(() => 1_000);
    const logger = { error: vi.fn() };
    const pingA = vi.fn(() => {
      throw new Error('socket error');
    });
    const pingB = vi.fn();
    hub.addConnection({ id: 'a', send: vi.fn(), close: vi.fn(), ping: pingA });
    hub.addConnection({ id: 'b', send: vi.fn(), close: vi.fn(), ping: pingB });

    runHeartbeatSweep(hub, {
      now: () => 5_000,
      timeoutMs: 30_000,
      closeCode: 4001,
      closeReason: 'heartbeat timeout',
      logger,
    });

    expect(pingA).toHaveBeenCalledTimes(1);
    expect(pingB).toHaveBeenCalledTimes(1);
    expect(hub.listStates().map((state) => state.connection.id)).toEqual(['b']);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('removes stale connections even if close throws', () => {
    const hub = createRealtimeHub(() => 1_000);
    const logger = { error: vi.fn() };
    const close = vi.fn(() => {
      throw new Error('close failed');
    });
    hub.addConnection({ id: 'a', send: vi.fn(), close, ping: vi.fn() });

    runHeartbeatSweep(hub, {
      now: () => 40_000,
      timeoutMs: 30_000,
      closeCode: 4001,
      closeReason: 'heartbeat timeout',
      logger,
    });

    expect(close).toHaveBeenCalledWith(4001, 'heartbeat timeout');
    expect(hub.listStates()).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
