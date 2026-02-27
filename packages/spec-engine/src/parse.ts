import YAML from 'yaml';
import type { Spec } from '@kata/shared';
import { validateSpec } from './validate.js';

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: 'parse'; message: string }
  | {
      ok: false;
      kind: 'validation';
      message: string;
      issues: Array<{ path: string; message: string; code: string }>;
    };

export function parseSpecYaml(input: string): ParseResult<Spec> {
  try {
    const data = YAML.parse(input);
    const validation = validateSpec(data);
    if (!validation.ok) {
      return {
        ok: false,
        kind: 'validation',
        message: 'Spec validation failed',
        issues: validation.issues,
      };
    }

    return { ok: true, value: validation.value };
  } catch (error) {
    return {
      ok: false,
      kind: 'parse',
      message: error instanceof Error ? error.message : 'Failed to parse YAML',
    };
  }
}

export { validateSpec } from './validate.js';
