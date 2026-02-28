import { afterEach, describe, expect, test, vi } from 'vitest';

const memoryFactory = vi.fn(() => ({ kind: 'memory' }));
const tauriFactory = vi.fn(() => ({ kind: 'tauri' }));

vi.mock('../../../apps/desktop/src/services/workspaces/memory-client', () => ({
  createMemoryWorkspaceClient: memoryFactory,
}));

vi.mock('../../../apps/desktop/src/services/workspaces/tauri-client', () => ({
  createTauriWorkspaceClient: tauriFactory,
}));

describe('workspace service index', () => {
  afterEach(() => {
    delete (globalThis as { __TAURI__?: unknown }).__TAURI__;
    delete (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    memoryFactory.mockClear();
    tauriFactory.mockClear();
    vi.resetModules();
  });

  test('detects tauri runtime from __TAURI__', async () => {
    (globalThis as { __TAURI__?: unknown }).__TAURI__ = {};
    const module = await import('../../../apps/desktop/src/services/workspaces/index');

    expect(module.hasTauriRuntime()).toBe(true);
  });

  test('detects tauri runtime from __TAURI_INTERNALS__', async () => {
    (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const module = await import('../../../apps/desktop/src/services/workspaces/index');

    expect(module.hasTauriRuntime()).toBe(true);
  });

  test('defaults to non-tauri runtime when globals are absent', async () => {
    const module = await import('../../../apps/desktop/src/services/workspaces/index');
    expect(module.hasTauriRuntime()).toBe(false);
  });

  test('creates memory or tauri clients based on runtime flag', async () => {
    const module = await import('../../../apps/desktop/src/services/workspaces/index');

    expect(module.createWorkspaceClient(false)).toEqual({ kind: 'memory' });
    expect(module.createWorkspaceClient(true)).toEqual({ kind: 'tauri' });
    expect(memoryFactory).toHaveBeenCalled();
    expect(tauriFactory).toHaveBeenCalled();
  });
});
