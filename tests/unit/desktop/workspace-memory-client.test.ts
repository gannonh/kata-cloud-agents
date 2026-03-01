import { describe, expect, test } from 'vitest';

import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';

describe('workspace memory client', () => {
  test('creates and lists workspaces', async () => {
    const client = createMemoryWorkspaceClient();
    await client.createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
    const all = await client.list();
    expect(all).toHaveLength(1);
  });

  test('tracks active workspace', async () => {
    const client = createMemoryWorkspaceClient();
    const ws = await client.createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
    await client.setActive(ws.id);
    expect(await client.getActiveId()).toBe(ws.id);
  });

  test('creates github workspaces and uses provided branch/base refs', async () => {
    const client = createMemoryWorkspaceClient();
    const ws = await client.createGitHub({
      repoUrl: 'https://github.com/org/repo',
      workspaceName: 'KAT-154 GH',
      branchName: 'workspace/custom-branch',
      baseRef: 'origin/main',
    });

    expect(ws.sourceType).toBe('github');
    expect(ws.branch).toBe('workspace/custom-branch');
    expect(ws.baseRef).toBe('origin/main');
  });

  test('creates new github repo workspace from repository name', async () => {
    const client = createMemoryWorkspaceClient();
    const ws = await client.createNewGitHub({
      repositoryName: 'kat-154-created',
      workspaceName: 'KAT-154 Created',
      cloneRootPath: '/tmp/repos',
    });

    expect(ws.sourceType).toBe('github');
    expect(ws.source).toBe('https://github.com/me/kat-154-created');
    expect(ws.repoRootPath).toBe('/tmp/repos/kat-154-created');
  });

  test('supports seeded state defaults', async () => {
    const client = createMemoryWorkspaceClient({
      activeWorkspaceId: 'ws_seed',
      workspaces: [
        {
          id: 'ws_seed',
          name: 'Seed',
          sourceType: 'local',
          source: '/tmp/repo',
          repoRootPath: '/tmp/repo',
          worktreePath: '/tmp/repo.worktrees/seed',
          branch: 'workspace/seed-ws',
          status: 'ready',
          createdAt: '2026-02-28T00:00:00.000Z',
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
      ],
    });

    expect((await client.list()).length).toBe(1);
    expect(await client.getActiveId()).toBe('ws_seed');
  });

  test('archives and removes workspaces', async () => {
    const client = createMemoryWorkspaceClient();
    const ws = await client.createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });

    await client.archive(ws.id);
    const archived = await client.list();
    expect(archived[0]?.status).toBe('archived');
    expect(await client.getActiveId()).toBeNull();

    await client.remove(ws.id, false);
    expect(await client.list()).toHaveLength(0);
  });

  test('clears active workspace when removing active entry directly', async () => {
    const client = createMemoryWorkspaceClient();
    const ws = await client.createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
    expect(await client.getActiveId()).toBe(ws.id);

    await client.remove(ws.id, true);
    expect(await client.getActiveId()).toBeNull();
  });

  test('throws for invalid github URL and missing ids', async () => {
    const client = createMemoryWorkspaceClient();
    await expect(
      client.createGitHub({
        repoUrl: 'https://gitlab.com/org/repo',
        workspaceName: 'KAT-154 GH',
      }),
    ).rejects.toThrow(/github\.com/i);
    await expect(client.setActive('missing')).rejects.toThrow(/not found/i);
    await expect(client.archive('missing')).rejects.toThrow(/not found/i);
    await expect(client.remove('missing', false)).rejects.toThrow(/not found/i);
  });

  test('handles slug/id fallbacks when input and runtime entropy are minimal', async () => {
    const originalCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
      });

      const client = createMemoryWorkspaceClient();
      const ws = await client.createLocal({
        repoPath: '/tmp/repo',
        workspaceName: '***',
      });

      expect(ws.branch).toMatch(/^workspace\/workspace-/);
      expect(ws.worktreePath).toContain('/workspace');
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });
});
