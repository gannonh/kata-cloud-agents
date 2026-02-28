import { FormEvent, useEffect, useState } from 'react';

import { isGitHubRepoUrl } from '../types/workspace';
import { useWorkspacesStore } from '../store/workspaces';

type SourceMode = 'local' | 'github';

export function Workspaces() {
  const workspaces = useWorkspacesStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspacesStore((state) => state.activeWorkspaceId);
  const isCreating = useWorkspacesStore((state) => state.isCreating);
  const lastError = useWorkspacesStore((state) => state.lastError);
  const load = useWorkspacesStore((state) => state.load);
  const createLocal = useWorkspacesStore((state) => state.createLocal);
  const createGitHub = useWorkspacesStore((state) => state.createGitHub);
  const setActive = useWorkspacesStore((state) => state.setActive);
  const archive = useWorkspacesStore((state) => state.archive);
  const remove = useWorkspacesStore((state) => state.remove);

  const [sourceMode, setSourceMode] = useState<SourceMode>('local');
  const [workspaceName, setWorkspaceName] = useState('');
  const [localRepoPath, setLocalRepoPath] = useState('');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [branchName, setBranchName] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!workspaceName.trim()) {
      setFormError('Workspace name is required.');
      return;
    }

    if (sourceMode === 'local') {
      if (!localRepoPath.trim()) {
        setFormError('Local repository path is required.');
        return;
      }

      await createLocal({
        repoPath: localRepoPath.trim(),
        workspaceName: workspaceName.trim(),
        branchName: branchName.trim() || undefined,
        baseRef: baseRef.trim() || undefined,
      });
    } else {
      if (!githubRepoUrl.trim()) {
        setFormError('GitHub repository URL is required.');
        return;
      }
      if (!isGitHubRepoUrl(githubRepoUrl.trim())) {
        setFormError('Only github.com repositories are supported.');
        return;
      }

      await createGitHub({
        repoUrl: githubRepoUrl.trim(),
        workspaceName: workspaceName.trim(),
        branchName: branchName.trim() || undefined,
        baseRef: baseRef.trim() || undefined,
      });
    }

    setBranchName('');
    setBaseRef('');
    setWorkspaceName('');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <p className="mt-2 text-slate-400">
        Create and manage isolated git workspaces for active work.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded border border-slate-800 bg-slate-900/40 p-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-200">Source</legend>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="source-mode"
              checked={sourceMode === 'local'}
              onChange={() => setSourceMode('local')}
            />
            Local repository
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="source-mode"
              checked={sourceMode === 'github'}
              onChange={() => setSourceMode('github')}
            />
            GitHub repository
          </label>
        </fieldset>

        {sourceMode === 'local' ? (
          <label className="block text-sm text-slate-200">
            Local repository path
            <input
              value={localRepoPath}
              onChange={(event) => setLocalRepoPath(event.target.value)}
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder="/Users/me/dev/repo"
            />
          </label>
        ) : (
          <label className="block text-sm text-slate-200">
            GitHub repository URL
            <input
              value={githubRepoUrl}
              onChange={(event) => setGithubRepoUrl(event.target.value)}
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder="https://github.com/org/repo"
            />
          </label>
        )}

        <label className="block text-sm text-slate-200">
          Workspace name
          <input
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="KAT-154 Workspace"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-200">
            Branch name (optional)
            <input
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder="workspace/kat-154"
            />
          </label>

          <label className="block text-sm text-slate-200">
            Base ref (optional)
            <input
              value={baseRef}
              onChange={(event) => setBaseRef(event.target.value)}
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              placeholder="origin/main"
            />
          </label>
        </div>

        {(formError || lastError) && (
          <p role="alert" className="text-sm text-rose-400">
            {formError ?? lastError}
          </p>
        )}

        <button
          type="submit"
          disabled={isCreating}
          className="rounded bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Workspace'}
        </button>
      </form>

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
                    {workspace.branch} · {workspace.sourceType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setActive(workspace.id)}
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                  >
                    {activeWorkspaceId === workspace.id ? 'Active' : 'Set active'}
                  </button>
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
