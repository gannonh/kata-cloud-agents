import YAML from 'yaml';
import type { Spec } from '@kata/shared';
import { validateSpec, type ValidationIssue } from './validate.js';

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: 'parse'; message: string }
  | {
      ok: false;
      kind: 'validation';
      message: string;
      issues: ValidationIssue[];
    };

export function parseSpecYaml(input: string): ParseResult<Spec> {
  let data: unknown;
  try {
    data = YAML.parse(input);
  } catch (error) {
    return {
      ok: false,
      kind: 'parse',
      message: error instanceof Error ? error.message : 'Failed to parse YAML',
    };
  }

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
}

export { validateSpec } from './validate.js';
