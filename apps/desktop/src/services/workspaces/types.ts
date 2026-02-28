import type { Workspace } from '../../types/workspace';

export interface CreateLocalWorkspaceInput {
  repoPath: string;
  workspaceName: string;
  branchName?: string;
  baseRef?: string;
}

export interface CreateGitHubWorkspaceInput {
  repoUrl: string;
  workspaceName: string;
  branchName?: string;
  baseRef?: string;
}

export interface WorkspaceClient {
  list(): Promise<Workspace[]>;
  createLocal(input: CreateLocalWorkspaceInput): Promise<Workspace>;
  createGitHub(input: CreateGitHubWorkspaceInput): Promise<Workspace>;
  setActive(id: string): Promise<void>;
  getActiveId(): Promise<string | null>;
  archive(id: string): Promise<void>;
  remove(id: string, removeFiles: boolean): Promise<void>;
}
