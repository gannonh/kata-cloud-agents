import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SpecDetail } from '../../../apps/desktop/src/pages/SpecDetail';

const storeState = vi.hoisted(() => ({
  versions: [] as Array<{
    id: string;
    specId: string;
    versionNumber: number;
    content: Record<string, unknown>;
    actorId: string;
    actorType: 'user' | 'agent';
    changeSummary: string;
    createdAt: string;
  }>,
  total: 0,
  loading: false,
  selectedVersion: null as null | {
    id: string;
    specId: string;
    versionNumber: number;
    content: Record<string, unknown>;
    actorId: string;
    actorType: 'user' | 'agent';
    changeSummary: string;
    createdAt: string;
  },
  diffResult: null as null | Array<{
    path: string;
    type: 'added' | 'removed' | 'changed';
    oldValue?: unknown;
    newValue?: unknown;
  }>,
  fetchVersions: vi.fn(),
  fetchVersion: vi.fn(),
  fetchDiff: vi.fn(),
  restoreVersion: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('../../../apps/desktop/src/store/versions', () => ({
  useVersionStore: () => storeState,
}));

describe('SpecDetail', () => {
  beforeEach(() => {
    storeState.versions = [];
    storeState.total = 0;
    storeState.loading = false;
    storeState.selectedVersion = null;
    storeState.diffResult = null;
    storeState.fetchVersions.mockReset().mockResolvedValue(undefined);
    storeState.fetchVersion.mockReset().mockResolvedValue(undefined);
    storeState.fetchDiff.mockReset().mockResolvedValue(undefined);
    storeState.restoreVersion.mockReset().mockResolvedValue(undefined);
    storeState.reset.mockReset();
  });

  it('returns null when route has no specId', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/specs']}>
        <Routes>
          <Route path="/specs" element={<SpecDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
    expect(storeState.fetchVersions).not.toHaveBeenCalled();
  });

  it('fetches versions and handles select/compare/restore actions', async () => {
    storeState.versions = [
      {
        id: 'v2',
        specId: 'spec-1',
        versionNumber: 2,
        content: {},
        actorId: 'user-1',
        actorType: 'user',
        changeSummary: 'Update',
        createdAt: '2026-02-27T12:00:00Z',
      },
      {
        id: 'v1',
        specId: 'spec-1',
        versionNumber: 1,
        content: {},
        actorId: 'agent-1',
        actorType: 'agent',
        changeSummary: 'Init',
        createdAt: '2026-02-27T00:00:00Z',
      },
    ];
    storeState.total = 2;
    storeState.selectedVersion = {
      id: 'v2',
      specId: 'spec-1',
      versionNumber: 2,
      content: {},
      actorId: 'user-1',
      actorType: 'user',
      changeSummary: 'Update',
      createdAt: '2026-02-27T12:00:00Z',
    };
    storeState.diffResult = [{ path: 'title', type: 'changed', oldValue: 'old', newValue: 'new' }];

    const { unmount } = render(
      <MemoryRouter initialEntries={['/specs/spec-1']}>
        <Routes>
          <Route path="/specs/:specId" element={<SpecDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(storeState.fetchVersions).toHaveBeenCalledWith('spec-1');
    expect(screen.getByText('2 versions')).toBeInTheDocument();
    expect(screen.getByText('Viewing version v2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'v2' }));
    expect(storeState.fetchVersion).toHaveBeenCalledWith('spec-1', 2);

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(storeState.fetchDiff).toHaveBeenCalledWith('spec-1', 1, 2);
    expect(screen.getByText('Comparing v1 to v2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore version 2' }));
    expect(storeState.restoreVersion).toHaveBeenCalledWith('spec-1', 2);
    await waitFor(() => {
      expect(screen.queryByText('Comparing v1 to v2')).not.toBeInTheDocument();
    });

    unmount();
    expect(storeState.reset).toHaveBeenCalledTimes(1);
  });

  it('renders loading state and hides optional panels when data is absent', () => {
    storeState.loading = true;

    render(
      <MemoryRouter initialEntries={['/specs/spec-1']}>
        <Routes>
          <Route path="/specs/:specId" element={<SpecDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Loading versions…')).toBeInTheDocument();
    expect(screen.queryByText(/Viewing version v/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comparing v/i)).not.toBeInTheDocument();
  });
});
