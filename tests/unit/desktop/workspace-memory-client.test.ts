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
});
