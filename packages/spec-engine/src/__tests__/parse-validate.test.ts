import { describe, expect, it } from 'vitest';
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
  });

  it('rejects malformed yaml', () => {
    const parsed = parseSpecYaml('meta: [');
    expect(parsed.ok).toBe(false);
  });

  it('validateSpec rejects non-object input', () => {
    const result = validateSpec('nope');
    expect(result.ok).toBe(false);
  });
});
