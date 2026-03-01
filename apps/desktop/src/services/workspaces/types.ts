import type { Workspace } from '../../types/workspace';

export interface GitHubRepoOption {
  nameWithOwner: string;
  url: string;
  isPrivate: boolean;
  updatedAt: string;
}

export interface CreateLocalWorkspaceInput {
  repoPath: string;
  workspaceName: string;
  branchName?: string;
  baseRef?: string;
}

export interface CreateGitHubWorkspaceInput {
  repoUrl: string;
  workspaceName: string;
  cloneRootPath?: string;
  branchName?: string;
  baseRef?: string;
}

export interface CreateNewGitHubWorkspaceInput {
  repositoryName: string;
  workspaceName: string;
  cloneRootPath?: string;
  branchName?: string;
  baseRef?: string;
}

export interface WorkspaceClient {
  list(): Promise<Workspace[]>;
  listGitHubRepos(query?: string): Promise<GitHubRepoOption[]>;
  createLocal(input: CreateLocalWorkspaceInput): Promise<Workspace>;
  createGitHub(input: CreateGitHubWorkspaceInput): Promise<Workspace>;
  createNewGitHub(input: CreateNewGitHubWorkspaceInput): Promise<Workspace>;
  setActive(id: string): Promise<void>;
  getActiveId(): Promise<string | null>;
  archive(id: string): Promise<void>;
  remove(id: string, removeFiles: boolean): Promise<void>;
}
