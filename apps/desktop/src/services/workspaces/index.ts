import { createMemoryWorkspaceClient } from './memory-client';
import { createTauriWorkspaceClient } from './tauri-client';
import type { WorkspaceClient } from './types';

export function hasTauriRuntime(): boolean {
  const globalObject = globalThis as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(globalObject.__TAURI__ || globalObject.__TAURI_INTERNALS__);
}

export function createWorkspaceClient(forceTauriRuntime?: boolean): WorkspaceClient {
  if (forceTauriRuntime ?? hasTauriRuntime()) {
    return createTauriWorkspaceClient();
  }

  if (typeof import.meta.env?.VITEST === 'undefined') {
    console.warn(
      '[workspaces] Tauri runtime not detected. Using in-memory client. ' +
        'Workspace operations will not persist.',
    );
  }

  return createMemoryWorkspaceClient();
}

export const workspaceClient = createWorkspaceClient();
