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
      state.connection.close(options.closeCode, options.closeReason);
      hub.removeConnection(state.connection.id);
      continue;
    }
    state.connection.ping();
  }
}
