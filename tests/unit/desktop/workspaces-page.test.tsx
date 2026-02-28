import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';

import { Workspaces } from '../../../apps/desktop/src/pages/Workspaces';
import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';
import {
  getWorkspaceClient,
  resetWorkspacesStore,
  setWorkspaceClient,
} from '../../../apps/desktop/src/store/workspaces';
import type { WorkspaceClient } from '../../../apps/desktop/src/services/workspaces/types';

describe('Workspaces page', () => {
  beforeEach(() => {
    setWorkspaceClient(createMemoryWorkspaceClient());
    resetWorkspacesStore();
  });

  test('supports local workspace creation form', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.type(
      screen.getByLabelText(/local repository path/i),
      '/tmp/repo',
    );
    await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByText(/^KAT-154$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/workspace name/i)).toHaveValue('');
  });

  test('shows initial empty state', async () => {
    render(<Workspaces />);
    expect(await screen.findByText(/no workspaces yet/i)).toBeInTheDocument();
  });

  test('validates required local and github form fields', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.type(screen.getByLabelText(/local repository path/i), '/tmp/repo');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));
    expect(await screen.findByText(/workspace name is required/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/local repository path/i));
    await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));
    expect(await screen.findByText(/local repository path is required/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /github repository/i }));
    await user.click(screen.getByRole('button', { name: /create workspace/i }));
    expect(await screen.findByText(/github repository url is required/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /local repository/i }));
    expect(screen.getByLabelText(/local repository path/i)).toBeInTheDocument();
  });

  test('validates github URL mode', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.click(screen.getByRole('radio', { name: /github repository/i }));
    await user.type(
      screen.getByLabelText(/github repository url/i),
      'https://gitlab.com/org/repo',
    );
    await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154 GH');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(
      await screen.findByText(/github.com repositories are supported/i),
    ).toBeInTheDocument();
  });

  test('supports github workspace creation with optional branch metadata', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.click(screen.getByRole('radio', { name: /github repository/i }));
    await user.type(
      screen.getByLabelText(/github repository url/i),
      'https://github.com/org/repo',
    );
    await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154 GH Success');
    await user.type(screen.getByLabelText(/branch name/i), 'workspace/manual-branch');
    await user.type(screen.getByLabelText(/base ref/i), 'origin/main');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByText(/^KAT-154 GH Success$/i)).toBeInTheDocument();
  });

  test('supports github workspace creation without optional branch metadata', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.click(screen.getByRole('radio', { name: /github repository/i }));
    await user.type(
      screen.getByLabelText(/github repository url/i),
      'https://github.com/org/repo',
    );
    await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154 GH Minimal');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByText(/^KAT-154 GH Minimal$/i)).toBeInTheDocument();
  });

  test('supports archive and remove actions for created workspace', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.type(
      screen.getByLabelText(/local repository path/i),
      '/tmp/repo',
    );
    await user.type(screen.getByLabelText(/workspace name/i), 'KAT-154 Actions');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByText(/^KAT-154 Actions$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /archive/i }));
    expect(await screen.findByText(/archived/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.queryByText(/^KAT-154 Actions$/i)).not.toBeInTheDocument();
  });

  test('shows backend creation errors and loading state', async () => {
    let resolveCreate: ((value: unknown) => void) | null = null;
    const delayedClient: WorkspaceClient = {
      ...getWorkspaceClient(),
      createLocal: () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    };
    setWorkspaceClient(delayedClient);
    resetWorkspacesStore();

    const user = userEvent.setup();
    render(<Workspaces />);

    await user.type(screen.getByLabelText(/local repository path/i), '/tmp/repo');
    await user.type(screen.getByLabelText(/workspace name/i), 'Loading Workspace');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
    resolveCreate?.({
      id: 'ws_loading',
      name: 'Loading Workspace',
      sourceType: 'local',
      source: '/tmp/repo',
      repoRootPath: '/tmp/repo',
      worktreePath: '/tmp/repo.worktrees/loading',
      branch: 'workspace/loading-ws',
      status: 'ready',
      createdAt: '2026-02-28T00:00:00.000Z',
      updatedAt: '2026-02-28T00:00:00.000Z',
    });
    expect(await screen.findByText(/^Loading Workspace$/)).toBeInTheDocument();
  });

  test('renders store errors from failed create', async () => {
    const failingClient: WorkspaceClient = {
      ...getWorkspaceClient(),
      createLocal: async () => {
        throw new Error('backend exploded');
      },
    };
    setWorkspaceClient(failingClient);
    resetWorkspacesStore();

    const user = userEvent.setup();
    render(<Workspaces />);

    await user.type(screen.getByLabelText(/local repository path/i), '/tmp/repo');
    await user.type(screen.getByLabelText(/workspace name/i), 'Broken Workspace');
    await user.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/backend exploded/i);
  });

  test('allows setting an inactive workspace as active', async () => {
    const seededClient = createMemoryWorkspaceClient({
      activeWorkspaceId: 'ws_2',
      workspaces: [
        {
          id: 'ws_1',
          name: 'Workspace One',
          sourceType: 'local',
          source: '/tmp/repo',
          repoRootPath: '/tmp/repo',
          worktreePath: '/tmp/repo.worktrees/one',
          branch: 'workspace/one',
          status: 'ready',
          createdAt: '2026-02-28T00:00:00.000Z',
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
        {
          id: 'ws_2',
          name: 'Workspace Two',
          sourceType: 'local',
          source: '/tmp/repo',
          repoRootPath: '/tmp/repo',
          worktreePath: '/tmp/repo.worktrees/two',
          branch: 'workspace/two',
          status: 'ready',
          createdAt: '2026-02-28T00:00:00.000Z',
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
      ],
    });

    setWorkspaceClient(seededClient);
    resetWorkspacesStore();
    render(<Workspaces />);

    const row = (await screen.findAllByRole('listitem')).find((item) =>
      within(item).queryByText(/^Workspace One$/),
    );
    if (!row) {
      throw new Error('Workspace One row not found');
    }

    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: /set active/i }));
    expect(within(row).getByRole('button', { name: /active/i })).toBeInTheDocument();
  });
});
