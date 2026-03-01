import { invoke } from '@tauri-apps/api/core';

import { hasTauriRuntime } from '../workspaces';

export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  if (!hasTauriRuntime()) {
    throw new Error('File picker requires the desktop application runtime.');
  }

  return invoke<string | null>('workspace_pick_directory', {
    default_path: defaultPath,
  });
}
