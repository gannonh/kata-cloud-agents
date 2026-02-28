import { describe, expect, test, vi } from 'vitest';

import { createTauriWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/tauri-client';

describe('tauri workspace client', () => {
  test('maps list command response', async () => {
    const mockInvoke = vi.fn(async () => [
      {
        id: 'ws_1',
        name: 'KAT-154',
        sourceType: 'local',
        source: '/tmp/repo',
        repoRootPath: '/tmp/repo',
        worktreePath: '/tmp/repo.worktrees/kat-154',
        branch: 'workspace/kat-154-ws1',
        status: 'ready',
        createdAt: '2026-02-28T00:00:00.000Z',
        updatedAt: '2026-02-28T00:00:00.000Z',
      },
    ]);

    const client = createTauriWorkspaceClient(mockInvoke);
    const list = await client.list();

    expect(mockInvoke).toHaveBeenCalledWith('workspace_list');
    expect(list[0]?.name).toBe('KAT-154');
  });
});
