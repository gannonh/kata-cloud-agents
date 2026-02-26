import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('desktop realtime bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test('returns cached client on repeated init', async () => {
    const module = await import('../../../apps/desktop/src/realtime');
    const first = module.initRealtime();
    const second = module.initRealtime();

    expect(second).toBe(first);
  });

  test('connect path runs when realtime is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_REALTIME', 'true');

    const wsCtor = vi.fn(function WebSocketStub() {
      return {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
      };
    });
    vi.stubGlobal('WebSocket', wsCtor as unknown as typeof WebSocket);

    const module = await import('../../../apps/desktop/src/realtime');
    module.initRealtime();

    expect(wsCtor).toHaveBeenCalledWith('ws://localhost:3001/ws');
  });
});
