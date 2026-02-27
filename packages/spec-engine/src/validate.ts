import type { Spec } from '@kata/shared';
import { z } from 'zod';
import { StrictSpecSchema } from './spec-schema.js';

export type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

export function validateSpec(input: unknown): ValidationResult<Spec> {
  const result = StrictSpecSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export type SpecValidationError = z.ZodError;
