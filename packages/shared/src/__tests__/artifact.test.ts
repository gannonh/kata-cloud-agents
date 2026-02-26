import { describe, it, expect } from 'vitest';
import { ArtifactSchema, ArtifactTypeSchema } from '../schemas/artifact.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('ArtifactTypeSchema', () => {
  it('accepts all types', () => {
    for (const t of ['screenshot', 'video', 'test_report', 'diff', 'log', 'file']) {
      expect(ArtifactTypeSchema.parse(t)).toBe(t);
    }
  });
});

describe('ArtifactSchema', () => {
  const valid = {
    id: uuid,
    agentRunId: uuid,
    type: 'screenshot' as const,
    path: '/artifacts/run-1/screenshot.png',
    metadata: {},
  };

  it('parses valid artifact', () => {
    expect(ArtifactSchema.parse(valid)).toEqual(valid);
  });

  it('parses with metadata', () => {
    const a = { ...valid, metadata: { width: 1920, height: 1080 } };
    expect(ArtifactSchema.parse(a).metadata).toEqual({ width: 1920, height: 1080 });
  });

  it('rejects empty path', () => {
    expect(() => ArtifactSchema.parse({ ...valid, path: '' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => ArtifactSchema.parse({ ...valid, type: 'audio' })).toThrow();
  });
});
