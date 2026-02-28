import { describe, expect, test, vi } from 'vitest';

import { createTauriWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/tauri-client';

describe('tauri workspace client', () => {
  function sampleWorkspace() {
    return {
      id: 'ws_1',
      name: 'KAT-154',
      sourceType: 'local',
      source: '/tmp/repo',
      repoRootPath: '/tmp/repo',
      worktreePath: '/tmp/repo.worktrees/kat-154',
      branch: 'workspace/kat-154-ws1',
      baseRef: null,
      status: 'ready',
      createdAt: '2026-02-28T00:00:00.000Z',
      updatedAt: '2026-02-28T00:00:00.000Z',
      lastOpenedAt: null,
    };
  }

  test('maps list command response', async () => {
    const mockInvoke = vi
      .fn()
      .mockResolvedValueOnce([sampleWorkspace()])
      .mockResolvedValueOnce([
        {
          nameWithOwner: 'org/repo',
          url: 'https://github.com/org/repo',
          isPrivate: true,
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
      ]);

    const client = createTauriWorkspaceClient(mockInvoke);
    const list = await client.list();
    const repos = await client.listGitHubRepos('repo');

    expect(mockInvoke).toHaveBeenCalledWith('workspace_list');
    expect(mockInvoke).toHaveBeenCalledWith('workspace_list_github_repos', {
      query: 'repo',
    });
    expect(list[0]?.name).toBe('KAT-154');
    expect(repos[0]?.nameWithOwner).toBe('org/repo');
  });

  test('maps create and lifecycle commands', async () => {
    const mockInvoke = vi
      .fn()
      .mockResolvedValueOnce(sampleWorkspace())
      .mockResolvedValueOnce(sampleWorkspace())
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('ws_1')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const client = createTauriWorkspaceClient(mockInvoke);
    const local = await client.createLocal({
      repoPath: '/tmp/repo',
      workspaceName: 'KAT-154',
    });
    const remote = await client.createGitHub({
      repoUrl: 'https://github.com/org/repo',
      workspaceName: 'KAT-154 GH',
    });
    await client.setActive('ws_1');
    const activeId = await client.getActiveId();
    await client.archive('ws_1');
    await client.remove('ws_1', true);

    expect(local.id).toBe('ws_1');
    expect(remote.id).toBe('ws_1');
    expect(activeId).toBe('ws_1');
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'workspace_create_local', {
      input: { repoPath: '/tmp/repo', workspaceName: 'KAT-154' },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'workspace_create_github', {
      input: { repoUrl: 'https://github.com/org/repo', workspaceName: 'KAT-154 GH' },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'workspace_set_active', { id: 'ws_1' });
    expect(mockInvoke).toHaveBeenNthCalledWith(4, 'workspace_get_active_id');
    expect(mockInvoke).toHaveBeenNthCalledWith(5, 'workspace_archive', { id: 'ws_1' });
    expect(mockInvoke).toHaveBeenNthCalledWith(6, 'workspace_delete', {
      id: 'ws_1',
      removeFiles: true,
    });
  });

  test('throws on invalid payloads', async () => {
    const mockInvoke = vi
      .fn()
      .mockResolvedValueOnce([{ name: 'missing required fields' }])
      .mockResolvedValueOnce([{ url: 123 }])
      .mockResolvedValueOnce(123);
    const client = createTauriWorkspaceClient(mockInvoke);

    await expect(client.list()).rejects.toThrow();
    await expect(client.listGitHubRepos()).rejects.toThrow();
    await expect(client.getActiveId()).rejects.toThrow();
  });

  test('can be constructed with default invoke function', () => {
    const client = createTauriWorkspaceClient();
    expect(typeof client.list).toBe('function');
    expect(typeof client.createLocal).toBe('function');
  });
});
