import { beforeEach, describe, expect, test } from 'vitest';

import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';
import {
  getWorkspaceClient,
  resetWorkspacesStore,
  setWorkspaceClient,
  useWorkspacesStore,
} from '../../../apps/desktop/src/store/workspaces';
import type { WorkspaceClient } from '../../../apps/desktop/src/services/workspaces/types';

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

  test('createGitHub archive and remove lifecycle', async () => {
    const store = useWorkspacesStore.getState();
    await store.createGitHub({
      repoUrl: 'https://github.com/org/repo',
      workspaceName: 'KAT-154 GH',
    });

    const created = useWorkspacesStore.getState().workspaces[0];
    expect(created?.name).toBe('KAT-154 GH');
    if (!created) {
      throw new Error('expected workspace to be created');
    }

    await useWorkspacesStore.getState().archive(created.id);
    expect(
      useWorkspacesStore.getState().workspaces.find((workspace) => workspace.id === created.id)
        ?.status,
    ).toBe('archived');

    await useWorkspacesStore.getState().remove(created.id, false);
    expect(
      useWorkspacesStore.getState().workspaces.find((workspace) => workspace.id === created.id),
    ).toBeUndefined();
  });

  test('createNewGitHub appends and sets active workspace', async () => {
    await useWorkspacesStore.getState().createNewGitHub({
      repositoryName: 'kat-154-created',
      workspaceName: 'kat-154-created',
      cloneRootPath: '/tmp/repos',
    });

    const state = useWorkspacesStore.getState();
    const created = state.workspaces[0];
    expect(created?.name).toBe('kat-154-created');
    expect(state.activeWorkspaceId).toBe(created?.id ?? null);
  });

  test('archiving a non-active workspace preserves active selection', async () => {
    await useWorkspacesStore
      .getState()
      .createLocal({ repoPath: '/tmp/repo', workspaceName: 'Workspace A' });
    const first = useWorkspacesStore.getState().workspaces[0];
    if (!first) {
      throw new Error('expected first workspace');
    }

    await useWorkspacesStore
      .getState()
      .createLocal({ repoPath: '/tmp/repo', workspaceName: 'Workspace B' });
    const activeBefore = useWorkspacesStore.getState().activeWorkspaceId;

    await useWorkspacesStore.getState().archive(first.id);
    const state = useWorkspacesStore.getState();
    expect(state.activeWorkspaceId).toBe(activeBefore);
    expect(state.workspaces.find((workspace) => workspace.id === first.id)?.status).toBe(
      'archived',
    );
  });

  test('stores errors from failing client actions', async () => {
    const failingClient: WorkspaceClient = {
      list: async () => {
        throw new Error('load failed');
      },
      listGitHubRepos: async () => [],
      createLocal: async () => {
        throw new Error('local failed');
      },
      createGitHub: async () => {
        throw new Error('github failed');
      },
      createNewGitHub: async () => {
        throw new Error('github new failed');
      },
      setActive: async () => {
        throw new Error('active failed');
      },
      getActiveId: async () => null,
      archive: async () => {
        throw new Error('archive failed');
      },
      remove: async () => {
        throw new Error('remove failed');
      },
    };

    setWorkspaceClient(failingClient);
    resetWorkspacesStore();

    await useWorkspacesStore.getState().load();
    expect(useWorkspacesStore.getState().lastError).toBe('load failed');

    await useWorkspacesStore
      .getState()
      .createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
    expect(useWorkspacesStore.getState().lastError).toBe('local failed');
    expect(useWorkspacesStore.getState().isCreating).toBe(false);

    await useWorkspacesStore
      .getState()
      .createGitHub({ repoUrl: 'https://github.com/org/repo', workspaceName: 'KAT-154' });
    expect(useWorkspacesStore.getState().lastError).toBe('github failed');
    expect(useWorkspacesStore.getState().isCreating).toBe(false);

    await useWorkspacesStore.getState().createNewGitHub({
      repositoryName: 'kat-154-created',
      workspaceName: 'KAT-154',
      cloneRootPath: '/tmp/repos',
    });
    expect(useWorkspacesStore.getState().lastError).toBe('github new failed');
    expect(useWorkspacesStore.getState().isCreating).toBe(false);

    await useWorkspacesStore.getState().setActive('ws_missing');
    expect(useWorkspacesStore.getState().lastError).toBe('active failed');

    await useWorkspacesStore.getState().archive('ws_missing');
    expect(useWorkspacesStore.getState().lastError).toBe('archive failed');

    await useWorkspacesStore.getState().remove('ws_missing', false);
    expect(useWorkspacesStore.getState().lastError).toBe('remove failed');
  });

  test('handles non-Error throws and exposes current client', async () => {
    const nonErrorClient: WorkspaceClient = {
      list: async () => {
        throw 'boom';
      },
      listGitHubRepos: async () => {
        throw 'boom';
      },
      createLocal: async () => {
        throw 'boom';
      },
      createGitHub: async () => {
        throw 'boom';
      },
      createNewGitHub: async () => {
        throw 'boom';
      },
      setActive: async () => {
        throw 'boom';
      },
      getActiveId: async () => null,
      archive: async () => {
        throw 'boom';
      },
      remove: async () => {
        throw 'boom';
      },
    };

    setWorkspaceClient(nonErrorClient);
    expect(getWorkspaceClient()).toBe(nonErrorClient);
    resetWorkspacesStore();

    await useWorkspacesStore.getState().load();
    expect(useWorkspacesStore.getState().lastError).toBe('boom');
  });

  test('extracts message from object-shaped errors', async () => {
    const objectErrorClient: WorkspaceClient = {
      list: async () => {
        throw { message: 'object message' };
      },
      listGitHubRepos: async () => [],
      createLocal: async () => {
        throw { error: 'top level error field' };
      },
      createGitHub: async () => {
        throw { error: { message: 'nested error message' } };
      },
      createNewGitHub: async () => {
        throw { message: 'new repo object message' };
      },
      setActive: async () => {
        throw {};
      },
      getActiveId: async () => null,
      archive: async () => {
        throw '';
      },
      remove: async () => {
        throw null;
      },
    };

    setWorkspaceClient(objectErrorClient);
    resetWorkspacesStore();

    await useWorkspacesStore.getState().load();
    expect(useWorkspacesStore.getState().lastError).toBe('object message');

    await useWorkspacesStore
      .getState()
      .createLocal({ repoPath: '/tmp/repo', workspaceName: 'KAT-154' });
    expect(useWorkspacesStore.getState().lastError).toBe('top level error field');

    await useWorkspacesStore
      .getState()
      .createGitHub({ repoUrl: 'https://github.com/org/repo', workspaceName: 'KAT-154' });
    expect(useWorkspacesStore.getState().lastError).toBe('nested error message');

    await useWorkspacesStore.getState().createNewGitHub({
      repositoryName: 'kat-154-created',
      workspaceName: 'KAT-154',
      cloneRootPath: '/tmp/repos',
    });
    expect(useWorkspacesStore.getState().lastError).toBe('new repo object message');

    await useWorkspacesStore.getState().setActive('ws_missing');
    expect(useWorkspacesStore.getState().lastError).toBe('Unexpected error');
  });
});
