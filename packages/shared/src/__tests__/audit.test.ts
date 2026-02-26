import { describe, it, expect } from 'vitest';
import { AuditEntrySchema } from '../schemas/audit.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('AuditEntrySchema', () => {
  const valid = {
    id: uuid,
    teamId: uuid,
    action: 'agent.started',
    details: { model: 'claude-sonnet-4-20250514' },
    timestamp: now,
  };

  it('parses valid entry', () => {
    expect(AuditEntrySchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional agentRunId', () => {
    const entry = { ...valid, agentRunId: uuid };
    expect(AuditEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses with empty details', () => {
    const entry = { ...valid, details: {} };
    expect(AuditEntrySchema.parse(entry)).toEqual(entry);
  });

  it('rejects empty action', () => {
    expect(() => AuditEntrySchema.parse({ ...valid, action: '' })).toThrow();
  });
});
