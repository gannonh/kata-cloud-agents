import { describe, it, expect } from 'vitest';
import { AgentRunSchema, AgentRunStatusSchema } from '../schemas/agent-run.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('AgentRunStatusSchema', () => {
  it('accepts all statuses', () => {
    for (const s of ['queued', 'running', 'completed', 'failed', 'cancelled']) {
      expect(AgentRunStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('AgentRunSchema', () => {
  const valid = {
    id: uuid,
    specId: uuid,
    agentRole: 'coordinator' as const,
    environmentId: uuid,
    model: 'claude-sonnet-4-20250514',
    status: 'queued' as const,
  };

  it('parses valid agent run', () => {
    expect(AgentRunSchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional timestamps', () => {
    const run = { ...valid, status: 'completed' as const, startedAt: now, completedAt: now };
    expect(AgentRunSchema.parse(run)).toEqual(run);
  });

  it('rejects invalid agentRole', () => {
    expect(() => AgentRunSchema.parse({ ...valid, agentRole: 'manager' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => AgentRunSchema.parse({ ...valid, status: 'paused' })).toThrow();
  });

  it('rejects running without startedAt', () => {
    expect(() => AgentRunSchema.parse({ ...valid, status: 'running' })).toThrow();
  });

  it('rejects completed without timestamps', () => {
    expect(() => AgentRunSchema.parse({ ...valid, status: 'completed' })).toThrow();
  });

  it('rejects completed with startedAt but no completedAt', () => {
    expect(() =>
      AgentRunSchema.parse({ ...valid, status: 'completed', startedAt: now }),
    ).toThrow();
  });

  it('rejects failed without timestamps', () => {
    expect(() => AgentRunSchema.parse({ ...valid, status: 'failed' })).toThrow();
  });

  it('accepts cancelled without timestamps', () => {
    expect(AgentRunSchema.parse({ ...valid, status: 'cancelled' }).status).toBe('cancelled');
  });

  it('accepts cancelled with startedAt only', () => {
    const run = { ...valid, status: 'cancelled' as const, startedAt: now };
    expect(AgentRunSchema.parse(run).status).toBe('cancelled');
  });

  it('rejects empty model', () => {
    expect(() => AgentRunSchema.parse({ ...valid, model: '' })).toThrow();
  });

  it('rejects malformed datetime in startedAt', () => {
    expect(() =>
      AgentRunSchema.parse({ ...valid, status: 'running', startedAt: 'not-a-date' }),
    ).toThrow();
  });
});
