import {
  deriveWorkspaceBranchName,
  isGitHubRepoUrl,
  type Workspace,
} from '../../types/workspace';
import type {
  CreateGitHubWorkspaceInput,
  CreateLocalWorkspaceInput,
  WorkspaceClient,
} from './types';

interface MemoryWorkspaceState {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
}

function generateWorkspaceId(): string {
  const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const suffix = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 8) ?? fallback;
  return `ws_${suffix}`;
}

function toWorkspaceSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'workspace';
}

function upsertWorkspace(
  state: MemoryWorkspaceState,
  input: {
    sourceType: Workspace['sourceType'];
    source: string;
    repoRootPath: string;
    worktreePath: string;
    workspaceName: string;
    branchName?: string;
    baseRef?: string;
  },
): Workspace {
  const id = generateWorkspaceId();
  const now = new Date().toISOString();
  const branch = input.branchName ?? deriveWorkspaceBranchName(input.workspaceName, id.slice(-4));
  const workspace: Workspace = {
    id,
    name: input.workspaceName,
    sourceType: input.sourceType,
    source: input.source,
    repoRootPath: input.repoRootPath,
    worktreePath: input.worktreePath,
    branch,
    baseRef: input.baseRef,
    status: 'ready',
    createdAt: now,
    updatedAt: now,
  };

  state.workspaces.push(workspace);
  return workspace;
}

export function createMemoryWorkspaceClient(
  initialState: Partial<MemoryWorkspaceState> = {},
): WorkspaceClient {
  const state: MemoryWorkspaceState = {
    activeWorkspaceId: initialState.activeWorkspaceId ?? null,
    workspaces: initialState.workspaces ?? [],
  };

  return {
    list: async () => [...state.workspaces],
    createLocal: async (input: CreateLocalWorkspaceInput) => {
      const slug = toWorkspaceSlug(input.workspaceName);
      const workspace = upsertWorkspace(state, {
        sourceType: 'local',
        source: input.repoPath,
        repoRootPath: input.repoPath,
        worktreePath: `${input.repoPath}.worktrees/${slug}`,
        workspaceName: input.workspaceName,
        branchName: input.branchName,
        baseRef: input.baseRef,
      });
      state.activeWorkspaceId = workspace.id;
      return workspace;
    },
    createGitHub: async (input: CreateGitHubWorkspaceInput) => {
      if (!isGitHubRepoUrl(input.repoUrl)) {
        throw new Error('Only github.com repositories are supported');
      }

      const slug = toWorkspaceSlug(input.workspaceName);
      const workspace = upsertWorkspace(state, {
        sourceType: 'github',
        source: input.repoUrl,
        repoRootPath: `/tmp/repo-cache/${slug}`,
        worktreePath: `/tmp/repo-cache/${slug}.worktrees/${slug}`,
        workspaceName: input.workspaceName,
        branchName: input.branchName,
        baseRef: input.baseRef,
      });
      state.activeWorkspaceId = workspace.id;
      return workspace;
    },
    setActive: async (id: string) => {
      const found = state.workspaces.some((workspace) => workspace.id === id);
      if (!found) {
        throw new Error(`Workspace not found: ${id}`);
      }
      state.activeWorkspaceId = id;
    },
    getActiveId: async () => state.activeWorkspaceId,
    archive: async (id: string) => {
      const workspace = state.workspaces.find((entry) => entry.id === id);
      if (!workspace) {
        throw new Error(`Workspace not found: ${id}`);
      }

      workspace.status = 'archived';
      workspace.updatedAt = new Date().toISOString();
      if (state.activeWorkspaceId === id) {
        state.activeWorkspaceId = null;
      }
    },
    remove: async (id: string) => {
      const next = state.workspaces.filter((workspace) => workspace.id !== id);
      if (next.length === state.workspaces.length) {
        throw new Error(`Workspace not found: ${id}`);
      }

      state.workspaces = next;
      if (state.activeWorkspaceId === id) {
        state.activeWorkspaceId = null;
      }
    },
  };
}
