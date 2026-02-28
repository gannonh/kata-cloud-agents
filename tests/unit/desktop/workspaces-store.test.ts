import { beforeEach, describe, expect, test } from 'vitest';

import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';
import {
  resetWorkspacesStore,
  setWorkspaceClient,
  useWorkspacesStore,
} from '../../../apps/desktop/src/store/workspaces';

describe('useWorkspacesStore', () => {
  beforeEach(() => {
    setWorkspaceClient(createMemoryWorkspaceClient());
    resetWorkspacesStore();
  });

  test('load fetches workspaces into state', async () => {
    await useWorkspacesStore.getState().load();
    expect(Array.isArray(useWorkspacesStore.getState().workspaces)).toBe(true);
  });

  test('createLocal appends and sets active workspace', async () => {
    await useWorkspacesStore
      .getState()
      .createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
    const state = useWorkspacesStore.getState();
    expect(state.workspaces.length).toBe(1);
    expect(state.activeWorkspaceId).toBe(state.workspaces[0]?.id ?? null);
  });
});
