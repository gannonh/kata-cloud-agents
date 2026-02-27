import YAML from 'yaml';
import type { Spec } from '@kata/shared';

const ORDER = [
  'id',
  'teamId',
  'title',
  'status',
  'meta',
  'intent',
  'constraints',
  'verification',
  'taskIds',
  'decisions',
  'blockers',
  'createdBy',
] as const satisfies readonly (keyof Spec)[];

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const sortedEntries = Object.entries(object).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(sortedEntries.map(([key, nestedValue]) => [key, canonicalizeValue(nestedValue)]));
  }
  return value;
}

export function serializeSpec(spec: Spec): string {
  const source = spec as Record<string, unknown>;
  const orderedEntries = ORDER
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => [key, canonicalizeValue(source[key])]);
  const orderedKeySet = new Set<string>(ORDER);
  const extraEntries = Object.keys(source)
    .filter((key) => !orderedKeySet.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => [key, canonicalizeValue(source[key])]);
  const canonical = Object.fromEntries([...orderedEntries, ...extraEntries]);

  return YAML.stringify(canonical, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  });
}
