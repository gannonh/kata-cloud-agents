import { beforeEach, describe, expect, test, vi } from 'vitest';

import { pickDirectory } from '../../../apps/desktop/src/services/system/dialog';

declare global {
  // eslint-disable-next-line no-var
  var __TAURI__: unknown;
  // eslint-disable-next-line no-var
  var __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } | undefined;
}

describe('dialog service', () => {
  beforeEach(() => {
    delete globalThis.__TAURI__;
    delete globalThis.__TAURI_INTERNALS__;
  });

  test('returns null when tauri runtime is unavailable', async () => {
    await expect(pickDirectory('/tmp/repos')).resolves.toBeNull();
  });

  test('invokes tauri command when runtime is available', async () => {
    const invoke = vi.fn(async () => '/tmp/picked');
    globalThis.__TAURI__ = {};
    globalThis.__TAURI_INTERNALS__ = { invoke };

    await expect(pickDirectory('/tmp/repos')).resolves.toBe('/tmp/picked');
    expect(invoke).toHaveBeenCalledWith('workspace_pick_directory', {
      default_path: '/tmp/repos',
    }, undefined);
  });
});
