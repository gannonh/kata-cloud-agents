import { createMemoryWorkspaceClient } from './memory-client';
import { createTauriWorkspaceClient } from './tauri-client';
import type { WorkspaceClient } from './types';

function hasTauriRuntime(): boolean {
  const globalObject = globalThis as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(globalObject.__TAURI__ || globalObject.__TAURI_INTERNALS__);
}

export function createWorkspaceClient(): WorkspaceClient {
  if (hasTauriRuntime()) {
    return createTauriWorkspaceClient();
  }

  return createMemoryWorkspaceClient();
}

export const workspaceClient = createWorkspaceClient();
