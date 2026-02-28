import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Workspaces } from '../../../apps/desktop/src/pages/Workspaces';
import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';
import { pickDirectory } from '../../../apps/desktop/src/services/system/dialog';
import {
  resetWorkspacesStore,
  setWorkspaceClient,
} from '../../../apps/desktop/src/store/workspaces';

vi.mock('../../../apps/desktop/src/services/system/dialog', () => ({
  pickDirectory: vi.fn(),
}));

const pickDirectoryMock = vi.mocked(pickDirectory);

describe('Workspaces page', () => {
  beforeEach(() => {
    pickDirectoryMock.mockReset();
    setWorkspaceClient(createMemoryWorkspaceClient());
    resetWorkspacesStore();
  });

  test('renders three add repository actions', async () => {
    render(<Workspaces />);

    expect(screen.getByRole('button', { name: /local repo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clone remote/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new/i })).toBeInTheDocument();
    expect(await screen.findByText(/no workspaces yet/i)).toBeInTheDocument();
  });

  test('supports local repo creation from local action', async () => {
    const user = userEvent.setup();
    pickDirectoryMock.mockResolvedValueOnce('/tmp/repo');
    render(<Workspaces />);

    await user.click(screen.getByRole('button', { name: /local repo/i }));

    expect(await screen.findByText(/^repo$/i)).toBeInTheDocument();
  });

  test('supports remote clone action', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.click(screen.getByRole('button', { name: /clone remote/i }));
    await user.type(
      screen.getByLabelText(/github repository url/i),
      'https://github.com/org/repo',
    );
    const cloneUrlInput = screen.getByLabelText(/github repository url/i);
    const cloneForm = cloneUrlInput.closest('form');
    if (!cloneForm) {
      throw new Error('clone form not found');
    }
    await user.clear(screen.getByLabelText(/repo location/i));
    await user.type(screen.getByLabelText(/repo location/i), '/tmp/repos');
    await user.click(within(cloneForm).getByRole('button', { name: /add cloned repo/i }));

    expect(await screen.findByText(/^repo$/i)).toBeInTheDocument();
  });

  test('validates clone action github url', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.click(screen.getByRole('button', { name: /clone remote/i }));
    await user.type(
      screen.getByLabelText(/github repository url/i),
      'https://gitlab.com/org/repo',
    );
    const cloneUrlInput = screen.getByLabelText(/github repository url/i);
    const cloneForm = cloneUrlInput.closest('form');
    if (!cloneForm) {
      throw new Error('clone form not found');
    }
    await user.click(within(cloneForm).getByRole('button', { name: /add cloned repo/i }));

    expect(
      await screen.findByText(/github.com repositories are supported/i),
    ).toBeInTheDocument();
  });

  test('shows create new flow message for this first step', async () => {
    const user = userEvent.setup();
    render(<Workspaces />);

    await user.click(screen.getByRole('button', { name: /create new/i }));
    expect(
      await screen.findByText(/create new repository flow is next/i),
    ).toBeInTheDocument();
  });

  test('supports archive and remove on existing list', async () => {
    const user = userEvent.setup();
    pickDirectoryMock.mockResolvedValueOnce('/tmp/kat-154-actions');
    render(<Workspaces />);

    await user.click(screen.getByRole('button', { name: /local repo/i }));
    expect(await screen.findByText(/^kat-154-actions$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /archive/i }));
    expect(await screen.findByText(/archived/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.queryByText(/^kat-154-actions$/i)).not.toBeInTheDocument();
  });
});
