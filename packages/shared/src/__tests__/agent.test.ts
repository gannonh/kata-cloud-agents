import { describe, it, expect } from 'vitest';
import {
  AgentSchema,
  AgentRoleSchema,
  AgentStatusSchema,
  ModelConfigSchema,
} from '../schemas/agent.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('AgentRoleSchema', () => {
  it('accepts coordinator, specialist, verifier', () => {
    for (const r of ['coordinator', 'specialist', 'verifier']) {
      expect(AgentRoleSchema.parse(r)).toBe(r);
    }
  });

  it('rejects invalid role', () => {
    expect(() => AgentRoleSchema.parse('manager')).toThrow();
  });
});

describe('AgentStatusSchema', () => {
  it('accepts all statuses', () => {
    for (const s of ['idle', 'running', 'paused', 'error', 'terminated']) {
      expect(AgentStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('ModelConfigSchema', () => {
  it('parses minimal config', () => {
    const c = { provider: 'anthropic', model: 'claude-sonnet-4-20250514' };
    expect(ModelConfigSchema.parse(c)).toEqual(c);
  });

  it('parses with optional fields', () => {
    const c = { provider: 'anthropic', model: 'claude-sonnet-4-20250514', temperature: 0.7, maxTokens: 4096 };
    expect(ModelConfigSchema.parse(c)).toEqual(c);
  });
});

describe('AgentSchema', () => {
  const valid = {
    id: uuid,
    name: 'code-writer',
    role: 'specialist' as const,
    modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    status: 'idle' as const,
  };

  it('parses valid agent', () => {
    expect(AgentSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty name', () => {
    expect(() => AgentSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects invalid role', () => {
    expect(() => AgentSchema.parse({ ...valid, role: 'boss' })).toThrow();
  });
});
