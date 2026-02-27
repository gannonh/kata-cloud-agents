export type ActorType = 'user' | 'agent';

export interface SpecVersion {
  id: string;
  specId: string;
  versionNumber: number;
  content: Record<string, unknown>;
  actorId: string;
  actorType: ActorType;
  changeSummary: string;
  createdAt: string;
}

export interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface VersionListResponse {
  items: SpecVersion[];
  total: number;
}
