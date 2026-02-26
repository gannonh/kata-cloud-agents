import { SpecSchema, type Spec } from '@kata/shared';
import { z } from 'zod';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: Array<{ path: string; message: string; code: string }> };

const StrictSpecSchema = SpecSchema.strict();

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
