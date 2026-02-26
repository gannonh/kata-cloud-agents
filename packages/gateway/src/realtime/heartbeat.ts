import type { RealtimeHub } from './hub.js';

export type HeartbeatSweepOptions = {
  now: () => number;
  timeoutMs: number;
  closeCode: number;
  closeReason: string;
};

export function runHeartbeatSweep(hub: RealtimeHub, options: HeartbeatSweepOptions) {
  const nowMs = options.now();
  for (const state of hub.listStates()) {
    if (nowMs - state.lastPongAt > options.timeoutMs) {
      try {
        state.connection.close(options.closeCode, options.closeReason);
      } catch {
        // Ignore close errors and continue sweep; connection is still removed below.
      } finally {
        hub.removeConnection(state.connection.id);
      }
      continue;
    }
    try {
      state.connection.ping();
    } catch {
      hub.removeConnection(state.connection.id);
    }
  }
}
