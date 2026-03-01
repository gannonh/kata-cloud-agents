import {
  deriveWorkspaceBranchName,
  isGitHubRepoUrl,
  type Workspace,
} from '../../types/workspace';
import type {
  CreateGitHubWorkspaceInput,
  CreateLocalWorkspaceInput,
  CreateNewGitHubWorkspaceInput,
  GitHubRepoOption,
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

function parseRepositoryInput(repositoryName: string): {
  owner: string;
  repo: string;
  url: string;
} {
  const normalized = repositoryName.trim().replace(/\.git$/i, '');
  if (!normalized) {
    throw new Error('Repository name is required');
  }

  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0 || segments.length > 2) {
    throw new Error('Repository name must be "<name>" or "<owner>/<name>"');
  }

  const [owner, repo] = segments.length === 2 ? segments : ['me', segments[0]];

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
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
  return { ...workspace };
}

export function createMemoryWorkspaceClient(
  initialState: Partial<MemoryWorkspaceState> = {},
): WorkspaceClient {
  const state: MemoryWorkspaceState = {
    activeWorkspaceId: initialState.activeWorkspaceId ?? null,
    workspaces: (initialState.workspaces ?? []).map((ws) => ({ ...ws })),
  };

  return {
    list: async () => state.workspaces.map((workspace) => ({ ...workspace })),
    listGitHubRepos: async (query?: string) => {
      const candidates = new Map<string, GitHubRepoOption>();
      for (const workspace of state.workspaces) {
        if (workspace.sourceType !== 'github') {
          continue;
        }
        let nameWithOwner = workspace.source;
        try {
          const parsed = new URL(workspace.source);
          nameWithOwner = parsed.pathname.replace(/^\/+/, '').replace(/\.git$/i, '');
        } catch {
          // Keep best-effort source fallback for memory mode.
        }

        candidates.set(workspace.source, {
          nameWithOwner,
          url: workspace.source,
          isPrivate: true,
          updatedAt: workspace.updatedAt,
        });
      }

      const fallback: GitHubRepoOption = {
        nameWithOwner: 'org/repo',
        url: 'https://github.com/org/repo',
        isPrivate: true,
        updatedAt: new Date().toISOString(),
      };
      if (!candidates.size) {
        candidates.set(fallback.url, fallback);
      }

      const normalizedQuery = query?.trim().toLowerCase();
      const list = [...candidates.values()];
      if (!normalizedQuery) {
        return list.slice(0, 20);
      }

      return list
        .filter((repo) => {
          const haystack = `${repo.nameWithOwner} ${repo.url}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
        .slice(0, 20);
    },
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
      const parsedUrl = new URL(input.repoUrl);
      const repoPath = parsedUrl.pathname.replace(/^\/+/, '').replace(/\.git$/i, '');
      const ownerRepo = repoPath.replace('/', '__');
      const root = input.cloneRootPath?.trim() || '/tmp/repo-cache';
      const cachePath = `${root}/${ownerRepo}`;
      const workspace = upsertWorkspace(state, {
        sourceType: 'github',
        source: input.repoUrl,
        repoRootPath: cachePath,
        worktreePath: `${cachePath}.worktrees/${slug}`,
        workspaceName: input.workspaceName,
        branchName: input.branchName,
        baseRef: input.baseRef,
      });
      state.activeWorkspaceId = workspace.id;
      return workspace;
    },
    createNewGitHub: async (input: CreateNewGitHubWorkspaceInput) => {
      const parsed = parseRepositoryInput(input.repositoryName);
      const slug = toWorkspaceSlug(parsed.repo);
      const root = input.cloneRootPath?.trim() || '/tmp/repos';
      const workspace = upsertWorkspace(state, {
        sourceType: 'github',
        source: parsed.url,
        repoRootPath: `${root}/${parsed.repo}`,
        worktreePath: `${root}/${parsed.repo}.worktrees/${slug}`,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove: async (id: string, _removeFiles: boolean) => {
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
