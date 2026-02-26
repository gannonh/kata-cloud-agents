import type { RealtimeHub } from './hub.js';

export type HeartbeatSweepOptions = {
  now: () => number;
  timeoutMs: number;
  closeCode: number;
  closeReason: string;
  logger?: {
    error: (meta: Record<string, unknown>, message: string) => void;
  };
};

export function runHeartbeatSweep(hub: RealtimeHub, options: HeartbeatSweepOptions) {
  const nowMs = options.now();
  for (const state of hub.listStates()) {
    if (nowMs - state.lastPongAt > options.timeoutMs) {
      try {
        state.connection.close(options.closeCode, options.closeReason);
      } catch (err) {
        options.logger?.error(
          { err, connectionId: state.connection.id },
          'failed to close stale realtime connection during heartbeat sweep',
        );
      } finally {
        hub.removeConnection(state.connection.id);
      }
      continue;
    }
    try {
      state.connection.ping();
    } catch (err) {
      options.logger?.error(
        { err, connectionId: state.connection.id },
        'failed to ping realtime connection during heartbeat sweep',
      );
      hub.removeConnection(state.connection.id);
    }
  }
}
