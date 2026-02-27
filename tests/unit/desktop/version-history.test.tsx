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

  it('calls onCompare for non-latest versions', () => {
    const onCompare = vi.fn();
    render(
      <VersionHistory
        versions={mockVersions}
        onSelectVersion={() => {}}
        onCompare={onCompare}
        onRestore={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(onCompare).toHaveBeenCalledWith(1, 2);
  });

  it('renders fallback summary and day-based relative time', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    render(
      <VersionHistory
        versions={[{
          ...mockVersions[0],
          id: 'v4',
          versionNumber: 4,
          changeSummary: '',
          createdAt: '2026-02-27T12:00:00Z',
        }]}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText('No summary')).toBeInTheDocument();
    expect(screen.getByText('2d ago')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders minute and just-now relative time labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    render(
      <VersionHistory
        versions={[
          {
            ...mockVersions[0],
            id: 'v5',
            versionNumber: 5,
            createdAt: '2026-03-01T11:30:00Z',
          },
          {
            ...mockVersions[1],
            id: 'v6',
            versionNumber: 6,
            createdAt: '2026-03-01T12:00:00Z',
          },
        ]}
        onSelectVersion={() => {}}
        onCompare={() => {}}
        onRestore={() => {}}
      />,
    );
    expect(screen.getByText('30m ago')).toBeInTheDocument();
    expect(screen.getByText('just now')).toBeInTheDocument();
    vi.useRealTimers();
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
