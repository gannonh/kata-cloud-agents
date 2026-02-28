import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';

import { Workspaces } from '../../../apps/desktop/src/pages/Workspaces';
import { createMemoryWorkspaceClient } from '../../../apps/desktop/src/services/workspaces/memory-client';
import {
  resetWorkspacesStore,
  setWorkspaceClient,
} from '../../../apps/desktop/src/store/workspaces';

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
});
