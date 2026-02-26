import { describe, expect, it } from 'vitest';
import { serializeSpec, parseSpecYaml } from '../index.js';
import type { Spec } from '@kata/shared';

const spec: Spec = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  teamId: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Canonical Test',
  status: 'draft',
  meta: { version: 1, createdAt: '2026-02-26T00:00:00.000Z', updatedAt: '2026-02-26T00:00:00.000Z' },
  intent: 'Check deterministic serialization',
  constraints: ['A'],
  verification: { criteria: ['B'] },
  taskIds: [],
  decisions: [],
  blockers: [],
  createdBy: '550e8400-e29b-41d4-a716-446655440000',
};

describe('serializeSpec', () => {
  it('serializes deterministically for same input', () => {
    const a = serializeSpec(spec);
    const b = serializeSpec(spec);
    expect(a).toBe(b);
  });

  it('round-trips through parse', () => {
    const yaml = serializeSpec(spec);
    const parsed = parseSpecYaml(yaml);
    expect(parsed.ok).toBe(true);
  });
});
