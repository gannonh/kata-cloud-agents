import { create } from 'zustand';

import { workspaceClient as defaultWorkspaceClient } from '../services/workspaces';
import type {
  CreateGitHubWorkspaceInput,
  CreateLocalWorkspaceInput,
  WorkspaceClient,
} from '../services/workspaces/types';
import type { Workspace } from '../types/workspace';

interface WorkspacesState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isCreating: boolean;
  lastError: string | null;
  load: () => Promise<void>;
  createLocal: (input: CreateLocalWorkspaceInput) => Promise<void>;
  createGitHub: (input: CreateGitHubWorkspaceInput) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  remove: (id: string, removeFiles: boolean) => Promise<void>;
}

const defaultState = {
  workspaces: [] as Workspace[],
  activeWorkspaceId: null as string | null,
  isCreating: false,
  lastError: null as string | null,
};

let workspaceClient: WorkspaceClient = defaultWorkspaceClient;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    const nestedError = Reflect.get(error, 'error');
    if (typeof nestedError === 'string' && nestedError.trim()) {
      return nestedError;
    }
    if (nestedError && typeof nestedError === 'object') {
      const nestedMessage = Reflect.get(nestedError, 'message');
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage;
      }
    }
  }

  return 'Unexpected error';
}

export const useWorkspacesStore = create<WorkspacesState>()((set) => ({
  ...defaultState,

  load: async () => {
    try {
      const [workspaces, activeWorkspaceId] = await Promise.all([
        workspaceClient.list(),
        workspaceClient.getActiveId(),
      ]);
      set({ workspaces, activeWorkspaceId, lastError: null });
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    }
  },

  createLocal: async (input) => {
    set({ isCreating: true, lastError: null });
    try {
      const workspace = await workspaceClient.createLocal(input);
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
        activeWorkspaceId: workspace.id,
      }));
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    } finally {
      set({ isCreating: false });
    }
  },

  createGitHub: async (input) => {
    set({ isCreating: true, lastError: null });
    try {
      const workspace = await workspaceClient.createGitHub(input);
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
        activeWorkspaceId: workspace.id,
      }));
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    } finally {
      set({ isCreating: false });
    }
  },

  setActive: async (id) => {
    try {
      await workspaceClient.setActive(id);
      set({ activeWorkspaceId: id, lastError: null });
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    }
  },

  archive: async (id) => {
    try {
      await workspaceClient.archive(id);
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === id
            ? { ...workspace, status: 'archived', updatedAt: new Date().toISOString() }
            : workspace,
        ),
        activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
        lastError: null,
      }));
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    }
  },

  remove: async (id, removeFiles) => {
    try {
      await workspaceClient.remove(id, removeFiles);
      set((state) => ({
        workspaces: state.workspaces.filter((workspace) => workspace.id !== id),
        activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
        lastError: null,
      }));
    } catch (error) {
      set({ lastError: toErrorMessage(error) });
    }
  },
}));

export function setWorkspaceClient(client: WorkspaceClient): void {
  workspaceClient = client;
}

export function getWorkspaceClient(): WorkspaceClient {
  return workspaceClient;
}

export function resetWorkspacesStore(): void {
  useWorkspacesStore.setState(defaultState);
}
