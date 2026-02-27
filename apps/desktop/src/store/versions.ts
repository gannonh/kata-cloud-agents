import { create } from 'zustand';

interface SpecVersion {
  id: string;
  specId: string;
  versionNumber: number;
  content: Record<string, unknown>;
  actorId: string;
  actorType: 'user' | 'agent';
  changeSummary: string;
  createdAt: string;
}

interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

interface VersionState {
  versions: SpecVersion[];
  total: number;
  loading: boolean;
  selectedVersion: SpecVersion | null;
  diffResult: DiffEntry[] | null;
  fetchVersions: (specId: string, limit?: number, offset?: number) => Promise<void>;
  fetchVersion: (specId: string, versionNumber: number) => Promise<void>;
  fetchDiff: (specId: string, v1: number, v2: number) => Promise<void>;
  restoreVersion: (specId: string, versionNumber: number) => Promise<void>;
  reset: () => void;
}

const API_BASE = '/api/specs';

export const useVersionStore = create<VersionState>()((set, get) => ({
  versions: [],
  total: 0,
  loading: false,
  selectedVersion: null,
  diffResult: null,

  fetchVersions: async (specId, limit = 50, offset = 0) => {
    set({ loading: true });
    const res = await fetch(`${API_BASE}/${specId}/versions?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    set({ versions: data.items, total: data.total, loading: false });
  },

  fetchVersion: async (specId, versionNumber) => {
    set({ loading: true });
    const res = await fetch(`${API_BASE}/${specId}/versions/${versionNumber}`);
    const data = await res.json();
    set({ selectedVersion: data, loading: false });
  },

  fetchDiff: async (specId, v1, v2) => {
    set({ loading: true });
    const res = await fetch(`${API_BASE}/${specId}/versions/${v1}/diff/${v2}`);
    const data = await res.json();
    set({ diffResult: data, loading: false });
  },

  restoreVersion: async (specId, versionNumber) => {
    set({ loading: true });
    await fetch(`${API_BASE}/${specId}/versions/${versionNumber}/restore`, { method: 'POST' });
    await get().fetchVersions(specId);
    set({ loading: false });
  },

  reset: () => set({
    versions: [],
    total: 0,
    loading: false,
    selectedVersion: null,
    diffResult: null,
  }),
}));
