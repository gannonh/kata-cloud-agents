import { SpecSchema } from '@kata/shared';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

let cached: JsonSchemaObject | null = null;

export function getSpecJsonSchema(): JsonSchemaObject {
  if (cached) return cached;

  const generated = zodToJsonSchema(SpecSchema.strict() as never, { name: 'KataSpec' }) as JsonSchemaObject;
  if (generated.type === 'object' && generated.properties) {
    cached = generated;
    return cached;
  }

  const definitions = generated.definitions as Record<string, JsonSchemaObject> | undefined;
  const fromDefinitions = definitions?.KataSpec;
  if (fromDefinitions?.type === 'object' && fromDefinitions.properties) {
    cached = fromDefinitions;
    return cached;
  }

  cached = z.toJSONSchema(SpecSchema.strict()) as JsonSchemaObject;
  return cached;
}
