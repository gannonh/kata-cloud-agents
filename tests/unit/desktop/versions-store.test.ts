import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVersionStore } from '../../../apps/desktop/src/store/versions';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  useVersionStore.getState().reset();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useVersionStore', () => {
  it('starts with empty state', () => {
    const state = useVersionStore.getState();
    expect(state.versions).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.selectedVersion).toBeNull();
    expect(state.diffResult).toBeNull();
  });

  it('fetchVersions populates versions list', async () => {
    const specId = 'spec-1';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          id: 'v1',
          specId,
          versionNumber: 1,
          content: {},
          actorId: 'a',
          actorType: 'user',
          changeSummary: 'Init',
          createdAt: '2026-01-01T00:00:00Z',
        }],
        total: 1,
      }),
    });

    await useVersionStore.getState().fetchVersions(specId);
    const state = useVersionStore.getState();
    expect(state.versions).toHaveLength(1);
    expect(state.total).toBe(1);
    expect(state.loading).toBe(false);
  });

  it('fetchDiff populates diffResult', async () => {
    const specId = 'spec-1';
    const diffEntries = [{ path: 'title', type: 'changed', oldValue: 'a', newValue: 'b' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => diffEntries });

    await useVersionStore.getState().fetchDiff(specId, 1, 2);
    expect(useVersionStore.getState().diffResult).toEqual(diffEntries);
  });

  it('fetchVersion populates selectedVersion', async () => {
    const specId = 'spec-1';
    const version = {
      id: 'v2',
      specId,
      versionNumber: 2,
      content: {},
      actorId: 'agent-1',
      actorType: 'agent' as const,
      changeSummary: 'Second version',
      createdAt: '2026-01-02T00:00:00Z',
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => version });

    await useVersionStore.getState().fetchVersion(specId, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/specs/spec-1/versions/2');
    expect(useVersionStore.getState().selectedVersion).toEqual(version);
  });

  it('restoreVersion calls POST and refreshes list', async () => {
    const specId = 'spec-1';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'v3', versionNumber: 3 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], total: 0 }) });

    await useVersionStore.getState().restoreVersion(specId, 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      `/api/specs/${specId}/versions/1/restore`,
      { method: 'POST' },
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `/api/specs/${specId}/versions?limit=50&offset=0`,
    );
  });

  it('stores errors and always clears loading on non-ok responses', async () => {
    const specId = 'spec-1';
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    await useVersionStore.getState().fetchVersions(specId);
    const state = useVersionStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Request failed with status 500');
  });

  it('ignores stale diff responses and keeps latest diff', async () => {
    const specId = 'spec-1';
    let resolveFirst: (() => void) | null = null;
    let resolveSecond: (() => void) | null = null;

    mockFetch
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirst = () => resolve({
          ok: true,
          json: async () => [{ path: 'title', type: 'changed', oldValue: 'first', newValue: 'old' }],
        });
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSecond = () => resolve({
          ok: true,
          json: async () => [{ path: 'title', type: 'changed', oldValue: 'new', newValue: 'latest' }],
        });
      }));

    const first = useVersionStore.getState().fetchDiff(specId, 1, 2);
    const second = useVersionStore.getState().fetchDiff(specId, 2, 3);

    resolveSecond?.();
    await second;
    expect(useVersionStore.getState().diffResult).toEqual([
      { path: 'title', type: 'changed', oldValue: 'new', newValue: 'latest' },
    ]);

    resolveFirst?.();
    await first;
    expect(useVersionStore.getState().diffResult).toEqual([
      { path: 'title', type: 'changed', oldValue: 'new', newValue: 'latest' },
    ]);
  });
});
