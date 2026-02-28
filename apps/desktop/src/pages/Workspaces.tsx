import { type FormEvent, useEffect, useState } from 'react';
import { homeDir } from '@tauri-apps/api/path';

import { hasTauriRuntime } from '../services/workspaces';
import { pickDirectory } from '../services/system/dialog';
import { isGitHubRepoUrl } from '../types/workspace';
import { getWorkspaceClient, useWorkspacesStore } from '../store/workspaces';
import type { Workspace } from '../types/workspace';
import type { GitHubRepoOption } from '../services/workspaces/types';

type WorkspaceAction = 'clone' | null;

function deriveNameFromRepoPath(repoPath: string): string {
  const sanitized = repoPath.trim().replace(/\/+$/, '');
  const segment = sanitized.split('/').pop() ?? '';
  return segment.trim() || 'Workspace';
}

function deriveNameFromRepoUrl(repoUrl: string): string {
  try {
    const parsed = new URL(repoUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).at(-1) ?? '';
    const withoutGitSuffix = lastSegment.replace(/\.git$/i, '');
    return withoutGitSuffix || 'Workspace';
  } catch {
    return 'Workspace';
  }
}

function buildDefaultCloneLocation(home: string): string {
  const normalizedHome = home.trim().replace(/[\\/]+$/, '');
  return `${normalizedHome}/kata/repos`;
}

function deriveUniqueWorkspaceName(baseName: string, workspaces: Workspace[]): string {
  const normalizedBase = baseName.trim() || 'Workspace';
  const existingNames = new Set(workspaces.map((workspace) => workspace.name.toLowerCase()));

  if (!existingNames.has(normalizedBase.toLowerCase())) {
    return normalizedBase;
  }

  let counter = 2;
  while (existingNames.has(`${normalizedBase} ${counter}`.toLowerCase())) {
    counter += 1;
  }
  return `${normalizedBase} ${counter}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Unexpected error';
}

export function Workspaces() {
  const workspaces = useWorkspacesStore((state) => state.workspaces);
  const isCreating = useWorkspacesStore((state) => state.isCreating);
  const lastError = useWorkspacesStore((state) => state.lastError);
  const load = useWorkspacesStore((state) => state.load);
  const createLocal = useWorkspacesStore((state) => state.createLocal);
  const createGitHub = useWorkspacesStore((state) => state.createGitHub);
  const archive = useWorkspacesStore((state) => state.archive);
  const remove = useWorkspacesStore((state) => state.remove);

  const [action, setAction] = useState<WorkspaceAction>(null);

  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [githubRepoSearchResults, setGithubRepoSearchResults] = useState<GitHubRepoOption[]>([]);
  const [isLoadingGithubRepos, setIsLoadingGithubRepos] = useState(false);
  const [githubRepoSearchError, setGithubRepoSearchError] = useState<string | null>(null);
  const [cloneLocation, setCloneLocation] = useState('');
  const [isPickingLocalRepo, setIsPickingLocalRepo] = useState(false);
  const [isPickingCloneLocation, setIsPickingCloneLocation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cloneLocation.trim()) {
      return;
    }

    void (async () => {
      if (!hasTauriRuntime()) {
        setCloneLocation('/Users/me/kata/repos');
        return;
      }

      try {
        const home = await homeDir();
        setCloneLocation(buildDefaultCloneLocation(home));
      } catch {
        setCloneLocation('/Users/me/kata/repos');
      }
    })();
  }, [cloneLocation]);

  useEffect(() => {
    if (action !== 'clone') {
      return;
    }

    let canceled = false;
    const timer = window.setTimeout(async () => {
      setIsLoadingGithubRepos(true);
      setGithubRepoSearchError(null);
      try {
        const repos = await getWorkspaceClient().listGitHubRepos(githubRepoUrl);
        if (!canceled) {
          setGithubRepoSearchResults(repos);
        }
      } catch (error) {
        if (!canceled) {
          setGithubRepoSearchResults([]);
          setGithubRepoSearchError(toErrorMessage(error));
        }
      } finally {
        if (!canceled) {
          setIsLoadingGithubRepos(false);
        }
      }
    }, 180);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [action, githubRepoUrl]);

  async function onPickLocalRepo() {
    setFormError(null);
    setIsPickingLocalRepo(true);
    try {
      const selectedPath = await pickDirectory();
      if (!selectedPath) {
        return;
      }

      await createLocal({
        repoPath: selectedPath,
        workspaceName: deriveUniqueWorkspaceName(
          deriveNameFromRepoPath(selectedPath),
          workspaces,
        ),
      });
      setAction(null);
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setIsPickingLocalRepo(false);
    }
  }

  async function onPickCloneLocation() {
    setFormError(null);
    setIsPickingCloneLocation(true);
    try {
      const selectedPath = await pickDirectory(cloneLocation.trim() || undefined);
      if (!selectedPath) {
        return;
      }
      setCloneLocation(selectedPath);
    } catch (error) {
      setFormError(toErrorMessage(error));
    } finally {
      setIsPickingCloneLocation(false);
    }
  }

  async function onSubmitClone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!githubRepoUrl.trim()) {
      setFormError('GitHub repository URL is required.');
      return;
    }
    if (!isGitHubRepoUrl(githubRepoUrl.trim())) {
      setFormError('Only github.com repositories are supported.');
      return;
    }
    if (!cloneLocation.trim()) {
      setFormError('Repo location is required.');
      return;
    }

    await createGitHub({
      repoUrl: githubRepoUrl.trim(),
      workspaceName: deriveUniqueWorkspaceName(
        deriveNameFromRepoUrl(githubRepoUrl.trim()),
        workspaces,
      ),
      cloneRootPath: cloneLocation.trim(),
    });

    setGithubRepoUrl('');
    setAction(null);
  }

  function onCreateNewClick() {
    setFormError(
      'Create New repository flow is next. For now use Local Repo or Clone Remote.',
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <p className="mt-2 text-slate-400">
        Create and manage isolated git workspaces for active work.
      </p>

      <div className="mt-6 rounded border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-medium text-slate-200">Add Repository</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onPickLocalRepo()}
            disabled={isCreating || isPickingLocalRepo}
            className="rounded bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
          >
            {isPickingLocalRepo ? 'Opening Finder...' : 'Local Repo'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAction('clone');
              setFormError(null);
              setGithubRepoSearchError(null);
            }}
            className="rounded bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
          >
            Clone Remote
          </button>
          <button
            type="button"
            onClick={onCreateNewClick}
            className="rounded bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
          >
            Create New
          </button>
        </div>

        {action === 'clone' ? (
          <form onSubmit={onSubmitClone} className="mt-4 space-y-4">
            <label className="block text-sm text-slate-200">
              GitHub repository URL
              <input
                value={githubRepoUrl}
                onChange={(event) => setGithubRepoUrl(event.target.value)}
                className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                placeholder="https://github.com/org/repo"
              />
              {isLoadingGithubRepos ? (
                <p className="mt-2 text-xs text-slate-400">Searching your repositories...</p>
              ) : null}
              {githubRepoSearchError ? (
                <p className="mt-2 text-xs text-rose-400">{githubRepoSearchError}</p>
              ) : null}
              {githubRepoSearchResults.length > 0 ? (
                <ul className="mt-2 max-h-56 overflow-auto rounded border border-slate-700 bg-slate-950">
                  {githubRepoSearchResults.map((repo) => (
                    <li key={repo.url}>
                      <button
                        type="button"
                        onClick={() => {
                          setGithubRepoUrl(repo.url);
                          setGithubRepoSearchError(null);
                        }}
                        className="flex w-full flex-col items-start gap-1 border-b border-slate-800 px-3 py-2 text-left last:border-b-0 hover:bg-slate-800/70"
                      >
                        <span className="text-sm text-slate-100">
                          {repo.nameWithOwner}
                          {repo.isPrivate ? ' · private' : ' · public'}
                        </span>
                        <span className="text-xs text-slate-400">{repo.url}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>

            <label className="block text-sm text-slate-200">
              Repo location
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={cloneLocation}
                  onChange={(event) => setCloneLocation(event.target.value)}
                  className="block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                  placeholder="/Users/me/kata/repos"
                />
                <button
                  type="button"
                  onClick={() => void onPickCloneLocation()}
                  disabled={isPickingCloneLocation}
                  className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200"
                >
                  {isPickingCloneLocation ? 'Opening...' : 'Browse'}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={isCreating}
              className="rounded bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Add Cloned Repo'}
            </button>
          </form>
        ) : null}

        {(formError || lastError) && (
          <p role="alert" className="mt-3 text-sm text-rose-400">
            {formError ?? lastError}
          </p>
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-100">Workspace list</h2>
        {workspaces.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No workspaces yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/30 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-100">{workspace.name}</p>
                  <p className="text-xs text-slate-400">
                    {workspace.branch} · {workspace.sourceType} · {workspace.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void archive(workspace.id)}
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(workspace.id, false)}
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
