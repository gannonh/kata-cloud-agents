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
});
