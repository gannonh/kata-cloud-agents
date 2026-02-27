import type { DiffEntry } from '@kata/shared';

const IGNORED_PATHS = new Set(['meta.updatedAt']);

export function diffSpecs(
  oldContent: Record<string, unknown>,
  newContent: Record<string, unknown>,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  diffRecursive(oldContent, newContent, '', entries);
  return entries;
}

function diffRecursive(
  oldVal: unknown,
  newVal: unknown,
  prefix: string,
  entries: DiffEntry[],
): void {
  if (oldVal === newVal) return;

  if (typeof oldVal !== typeof newVal || oldVal === null || newVal === null) {
    if (!IGNORED_PATHS.has(prefix)) {
      entries.push({ path: prefix, type: 'changed', oldValue: oldVal, newValue: newVal });
    }
    return;
  }

  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    const maxLen = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < maxLen; i++) {
      const path = prefix ? `${prefix}.${i}` : `${i}`;
      if (i >= oldVal.length) {
        entries.push({ path, type: 'added', newValue: newVal[i] });
      } else if (i >= newVal.length) {
        entries.push({ path, type: 'removed', oldValue: oldVal[i] });
      } else {
        diffRecursive(oldVal[i], newVal[i], path, entries);
      }
    }
    return;
  }

  if (typeof oldVal === 'object' && typeof newVal === 'object') {
    const oldObj = oldVal as Record<string, unknown>;
    const newObj = newVal as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (IGNORED_PATHS.has(path)) continue;
      if (!(key in oldObj)) {
        entries.push({ path, type: 'added', newValue: newObj[key] });
      } else if (!(key in newObj)) {
        entries.push({ path, type: 'removed', oldValue: oldObj[key] });
      } else {
        diffRecursive(oldObj[key], newObj[key], path, entries);
      }
    }
    return;
  }

  if (!IGNORED_PATHS.has(prefix)) {
    entries.push({ path: prefix, type: 'changed', oldValue: oldVal, newValue: newVal });
  }
}
