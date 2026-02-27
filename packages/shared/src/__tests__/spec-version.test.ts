import { describe, expect, it } from 'vitest';
import {
  DiffEntrySchema,
  SpecVersionSchema,
  CreateVersionInputSchema,
  VersionListResponseSchema,
} from '../schemas/spec-version.js';

const uuid = '00000000-0000-4000-8000-000000000001';
const now = '2026-02-27T00:00:00.000Z';

describe('SpecVersionSchema', () => {
  const valid = {
    id: uuid,
    specId: uuid,
    versionNumber: 1,
    content: { title: 'test' },
    actorId: uuid,
    actorType: 'user' as const,
    changeSummary: 'Initial version',
    createdAt: now,
  };

  it('parses valid version', () => {
    expect(SpecVersionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects versionNumber < 1', () => {
    expect(() => SpecVersionSchema.parse({ ...valid, versionNumber: 0 })).toThrow();
  });

  it('rejects invalid actorType', () => {
    expect(() => SpecVersionSchema.parse({ ...valid, actorType: 'bot' })).toThrow();
  });
});

describe('CreateVersionInputSchema', () => {
  it('parses valid input', () => {
    const input = { content: { title: 'test' }, changeSummary: 'Updated title' };
    expect(CreateVersionInputSchema.parse(input)).toEqual(input);
  });

  it('defaults changeSummary to empty string', () => {
    const result = CreateVersionInputSchema.parse({ content: { title: 'test' } });
    expect(result.changeSummary).toBe('');
  });
});

describe('DiffEntrySchema', () => {
  it('parses changed entry', () => {
    const entry = { path: 'title', type: 'changed' as const, oldValue: 'a', newValue: 'b' };
    expect(DiffEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses added entry without oldValue', () => {
    const entry = { path: 'constraints.3', type: 'added' as const, newValue: 'new rule' };
    expect(DiffEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses removed entry without newValue', () => {
    const entry = { path: 'blockers.0', type: 'removed' as const, oldValue: { id: uuid } };
    expect(DiffEntrySchema.parse(entry)).toEqual(entry);
  });
});

describe('VersionListResponseSchema', () => {
  it('parses response with items and total', () => {
    const response = { items: [], total: 0 };
    expect(VersionListResponseSchema.parse(response)).toEqual(response);
  });
});
