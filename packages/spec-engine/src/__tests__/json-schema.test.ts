import { describe, expect, it } from 'vitest';
import { getSpecJsonSchema } from '../json-schema.js';

describe('getSpecJsonSchema', () => {
  it('returns object schema with expected core properties', () => {
    const schema = getSpecJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('status');
    expect(schema.properties).toHaveProperty('verification');
  });
});
