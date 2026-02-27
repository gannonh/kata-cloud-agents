import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVersionStore } from '../../../apps/desktop/src/store/versions';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  useVersionStore.getState().reset();
  mockFetch.mockReset();
});

describe('useVersionStore', () => {
  it('starts with empty state', () => {
    const state = useVersionStore.getState();
    expect(state.versions).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.loading).toBe(false);
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

  it('restoreVersion calls POST and refreshes list', async () => {
    const specId = 'spec-1';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'v3', versionNumber: 3 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [], total: 0 }) });

    await useVersionStore.getState().restoreVersion(specId, 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
