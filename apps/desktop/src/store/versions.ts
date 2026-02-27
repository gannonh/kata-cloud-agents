import { create } from 'zustand';
import type { DiffEntry, SpecVersion, VersionListResponse } from '../types/versioning';

interface VersionState {
  versions: SpecVersion[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedVersion: SpecVersion | null;
  diffResult: DiffEntry[] | null;
  latestDiffRequestId: number;
  fetchVersions: (specId: string, limit?: number, offset?: number) => Promise<void>;
  fetchVersion: (specId: string, versionNumber: number) => Promise<void>;
  fetchDiff: (specId: string, v1: number, v2: number) => Promise<void>;
  restoreVersion: (specId: string, versionNumber: number) => Promise<void>;
  reset: () => void;
}

const API_BASE = '/api/specs';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function ensureOk(res: Response) {
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
}

export const useVersionStore = create<VersionState>()((set, get) => ({
  versions: [],
  total: 0,
  loading: false,
  error: null,
  selectedVersion: null,
  diffResult: null,
  latestDiffRequestId: 0,

  fetchVersions: async (specId, limit = 50, offset = 0) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/${specId}/versions?limit=${limit}&offset=${offset}`);
      ensureOk(res);
      const data = (await res.json()) as VersionListResponse;
      set({ versions: data.items, total: data.total });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  fetchVersion: async (specId, versionNumber) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/${specId}/versions/${versionNumber}`);
      ensureOk(res);
      const data = (await res.json()) as SpecVersion;
      set({ selectedVersion: data });
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  fetchDiff: async (specId, v1, v2) => {
    const requestId = get().latestDiffRequestId + 1;
    set({ loading: true, error: null, latestDiffRequestId: requestId, diffResult: null });
    try {
      const res = await fetch(`${API_BASE}/${specId}/versions/${v1}/diff/${v2}`);
      ensureOk(res);
      const data = (await res.json()) as DiffEntry[];
      set((state) => (state.latestDiffRequestId === requestId ? { diffResult: data } : {}));
    } catch (error) {
      set((state) => (state.latestDiffRequestId === requestId ? { error: toErrorMessage(error) } : {}));
    } finally {
      set((state) => (state.latestDiffRequestId === requestId ? { loading: false } : {}));
    }
  },

  restoreVersion: async (specId, versionNumber) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/${specId}/versions/${versionNumber}/restore`, { method: 'POST' });
      ensureOk(res);
      await get().fetchVersions(specId);
    } catch (error) {
      set({ error: toErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({
    versions: [],
    total: 0,
    loading: false,
    error: null,
    selectedVersion: null,
    diffResult: null,
    latestDiffRequestId: 0,
  }),
}));
