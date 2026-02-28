import { invoke as defaultInvoke } from '@tauri-apps/api/core';
import { z } from 'zod';

import { WorkspaceSchema } from '../../types/workspace';
import type {
  CreateGitHubWorkspaceInput,
  CreateLocalWorkspaceInput,
  WorkspaceClient,
} from './types';

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const WorkspaceListSchema = z.array(WorkspaceSchema);

export function createTauriWorkspaceClient(
  invokeFn: InvokeFn = defaultInvoke,
): WorkspaceClient {
  return {
    list: async () => WorkspaceListSchema.parse(await invokeFn('workspace_list')),
    createLocal: async (input: CreateLocalWorkspaceInput) =>
      WorkspaceSchema.parse(await invokeFn('workspace_create_local', { input })),
    createGitHub: async (input: CreateGitHubWorkspaceInput) =>
      WorkspaceSchema.parse(await invokeFn('workspace_create_github', { input })),
    setActive: async (id: string) => {
      await invokeFn('workspace_set_active', { id });
    },
    getActiveId: async () =>
      z.string().nullable().parse(await invokeFn('workspace_get_active_id')),
    archive: async (id: string) => {
      await invokeFn('workspace_archive', { id });
    },
    remove: async (id: string, removeFiles: boolean) => {
      await invokeFn('workspace_delete', { id, removeFiles });
    },
  };
}
