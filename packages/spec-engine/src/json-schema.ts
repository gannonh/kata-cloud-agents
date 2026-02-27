import { SpecSchema } from '@kata/shared';
import { z } from 'zod';

type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

let cached: JsonSchemaObject | null = null;
const StrictSpecSchema = SpecSchema.strict();

export function getSpecJsonSchema(): JsonSchemaObject {
  if (cached) return cached;

  cached = z.toJSONSchema(StrictSpecSchema) as JsonSchemaObject;
  return cached;
}
