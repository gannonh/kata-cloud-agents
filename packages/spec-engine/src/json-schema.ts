import { z } from 'zod';
import { StrictSpecSchema } from './spec-schema.js';

type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

let cached: JsonSchemaObject | null = null;

export function getSpecJsonSchema(): JsonSchemaObject {
  if (cached) return cached;

  cached = z.toJSONSchema(StrictSpecSchema) as JsonSchemaObject;
  return cached;
}
