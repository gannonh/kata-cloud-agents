import { describe, expect, it, vi } from 'vitest';
import { parseSpecYaml, validateSpec } from '../parse.js';

const validYaml = `
id: 550e8400-e29b-41d4-a716-446655440000
teamId: 550e8400-e29b-41d4-a716-446655440000
title: Test Spec
status: draft
meta:
  version: 1
  createdAt: 2026-02-26T00:00:00.000Z
  updatedAt: 2026-02-26T00:00:00.000Z
intent: Build feature
constraints:
  - Keep API stable
verification:
  criteria:
    - Unit tests pass
taskIds: []
decisions: []
blockers: []
createdBy: 550e8400-e29b-41d4-a716-446655440000
`;

describe('parse + validate', () => {
  it('parses and validates valid yaml', () => {
    const parsed = parseSpecYaml(validYaml);
    expect(parsed.ok).toBe(true);
  });

  it('rejects unknown top-level fields', () => {
    const withUnknown = `${validYaml}\nextraField: nope\n`;
    const parsed = parseSpecYaml(withUnknown);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.kind).toBe('validation');
  });

  it('rejects unknown nested fields', () => {
    const withUnknownNested = validYaml.replace(
      'verification:\n  criteria:\n    - Unit tests pass\n',
      'verification:\n  criteria:\n    - Unit tests pass\n  extraNestedField: nope\n',
    );
    const parsed = parseSpecYaml(withUnknownNested);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.kind).toBe('validation');
  });

  it('rejects malformed yaml', () => {
    const parsed = parseSpecYaml('meta: [');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.kind).toBe('parse');
  });

  it('validateSpec rejects non-object input', () => {
    const result = validateSpec('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rethrows internal validation exceptions', async () => {
    vi.resetModules();
    vi.doMock('../validate.js', () => ({
      validateSpec: () => {
        throw new Error('internal validation failure');
      },
    }));

    try {
      const { parseSpecYaml: parseWithThrowingValidate } = await import('../parse.js');
      expect(() => parseWithThrowingValidate(validYaml)).toThrow('internal validation failure');
    } finally {
      vi.doUnmock('../validate.js');
      vi.resetModules();
    }
  });
});
