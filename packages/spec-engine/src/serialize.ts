import YAML from 'yaml';
import type { Spec } from '@kata/shared';

const ORDER: Array<keyof Spec> = [
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
];

export function serializeSpec(spec: Spec): string {
  const canonical = Object.fromEntries(ORDER.map((key) => [key, spec[key]]));
  return YAML.stringify(canonical, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  });
}
