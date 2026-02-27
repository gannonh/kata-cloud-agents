import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VersionHistory } from '../../../apps/desktop/src/components/VersionHistory';

const mockVersions = [
  {
    id: 'v2',
    specId: 'spec-1',
    versionNumber: 2,
    content: {},
    actorId: 'user-1',
    actorType: 'user' as const,
    changeSummary: 'Updated constraints',
    createdAt: '2026-02-27T12:00:00Z',
  },
  {
    id: 'v1',
    specId: 'spec-1',
    versionNumber: 1,
    content: {},
    actorId: 'agent-1',
    actorType: 'agent' as const,
    changeSummary: 'Initial version',
    createdAt: '2026-02-27T00:00:00Z',
  },
];

describe('VersionHistory', () => {
  it('renders version list', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('Updated constraints')).toBeInTheDocument();
    expect(screen.getByText('Initial version')).toBeInTheDocument();
  });

  it('shows actor type badges', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('agent')).toBeInTheDocument();
  });

  it('calls onSelectVersion when clicking a version', () => {
    const onSelect = vi.fn();
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={onSelect}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('v2'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('calls onRestore when clicking restore button', () => {
    const onRestore = vi.fn();
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={onRestore}
      />,
    );
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
    fireEvent.click(restoreButtons[0]);
    expect(onRestore).toHaveBeenCalledWith(2);
  });

  it('renders empty state when no versions', () => {
    render(
      <VersionHistory
        versions={[]}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText(/no versions/i)).toBeInTheDocument();
  });
});
