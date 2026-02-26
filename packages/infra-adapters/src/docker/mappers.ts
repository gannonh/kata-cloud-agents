import type { Environment, LogEntry, Snapshot } from '../types.js';

type ContainerInspectLike = {
  Created?: string;
  State?: {
    Running?: boolean;
  };
  Config?: {
    Image?: string;
    Labels?: Record<string, string | undefined>;
  };
};

export function mapContainerToEnvironment(
  envId: string,
  imageFallback: string,
  inspect: ContainerInspectLike,
  now: Date,
): Environment {
  return {
    id: envId,
    image: inspect.Config?.Image ?? imageFallback,
    state: inspect.State?.Running ? 'running' : 'ready',
    createdAt: inspect.Created ?? now.toISOString(),
  };
}

export function mapSnapshot(envId: string, imageId: string, tag: string, now: Date): Snapshot {
  return {
    id: `${envId}:${now.getTime()}`,
    envId,
    imageId,
    tag,
    createdAt: now.toISOString(),
  };
}

export function mapLogEntry(envId: string, source: 'stdout' | 'stderr', line: string, now: Date): LogEntry {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      envId,
      source,
      timestamp: now.toISOString(),
      message: '',
    };
  }

  const split = trimmed.indexOf(' ');
  const maybeTs = split === -1 ? trimmed : trimmed.slice(0, split);
  const maybeMsg = split === -1 ? '' : trimmed.slice(split + 1);
  const parsed = Date.parse(maybeTs);

  if (Number.isNaN(parsed)) {
    return {
      envId,
      source,
      timestamp: now.toISOString(),
      message: trimmed,
    };
  }

  return {
    envId,
    source,
    timestamp: new Date(parsed).toISOString(),
    message: maybeMsg,
  };
}
