import { describe, it, expect } from 'vitest';
import {
  SpecSchema,
  SpecStatusSchema,
  SpecDecisionSchema,
  SpecBlockerSchema,
  SpecBlockerStatusSchema,
} from '../schemas/spec.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('SpecStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['draft', 'active', 'paused', 'completed', 'archived']) {
      expect(SpecStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid status', () => {
    expect(() => SpecStatusSchema.parse('deleted')).toThrow();
  });
});

describe('SpecDecisionSchema', () => {
  it('parses valid decision', () => {
    const d = { id: uuid, description: 'Use Zod', decidedBy: 'architect', decidedAt: now };
    expect(SpecDecisionSchema.parse(d)).toEqual(d);
  });

  it('parses with optional rationale', () => {
    const d = { id: uuid, description: 'Use Zod', decidedBy: 'architect', decidedAt: now, rationale: 'Type-safe' };
    expect(SpecDecisionSchema.parse(d)).toEqual(d);
  });
});

describe('SpecBlockerSchema', () => {
  it('parses open blocker', () => {
    const b = { id: uuid, description: 'Waiting on API', status: 'open' as const, reportedAt: now };
    expect(SpecBlockerSchema.parse(b)).toEqual(b);
  });

  it('parses resolved blocker with resolvedAt', () => {
    const b = { id: uuid, description: 'Done', status: 'resolved' as const, reportedAt: now, resolvedAt: now };
    expect(SpecBlockerSchema.parse(b)).toEqual(b);
  });

  it('rejects resolved blocker without resolvedAt', () => {
    expect(() =>
      SpecBlockerSchema.parse({ id: uuid, description: 'Done', status: 'resolved', reportedAt: now }),
    ).toThrow();
  });

  it('rejects open blocker with resolvedAt', () => {
    expect(() =>
      SpecBlockerSchema.parse({ id: uuid, description: 'X', status: 'open', reportedAt: now, resolvedAt: now }),
    ).toThrow();
  });
});

describe('SpecBlockerStatusSchema', () => {
  it('accepts open and resolved', () => {
    expect(SpecBlockerStatusSchema.parse('open')).toBe('open');
    expect(SpecBlockerStatusSchema.parse('resolved')).toBe('resolved');
  });
});

describe('SpecSchema', () => {
  const validSpec = {
    id: uuid,
    teamId: uuid,
    title: 'Build login page',
    status: 'draft' as const,
    meta: { version: 1, createdAt: now, updatedAt: now },
    intent: 'Allow users to sign in',
    constraints: ['Must use OAuth', 'Under 200ms response'],
    verification: { criteria: ['Login works with Google'] },
    taskIds: [uuid],
    decisions: [],
    blockers: [],
    createdBy: uuid,
  };

  it('parses valid spec', () => {
    expect(SpecSchema.parse(validSpec)).toEqual(validSpec);
  });

  it('rejects empty title', () => {
    expect(() => SpecSchema.parse({ ...validSpec, title: '' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => SpecSchema.parse({ ...validSpec, status: 'deleted' })).toThrow();
  });

  it('rejects non-positive version', () => {
    expect(() => SpecSchema.parse({ ...validSpec, meta: { ...validSpec.meta, version: 0 } })).toThrow();
  });

  it('accepts optional verification.testPlan', () => {
    const spec = {
      ...validSpec,
      verification: { criteria: ['works'], testPlan: 'run login e2e' },
    };
    expect(SpecSchema.parse(spec).verification.testPlan).toBe('run login e2e');
  });

  it('rejects empty intent', () => {
    expect(() => SpecSchema.parse({ ...validSpec, intent: '' })).toThrow();
  });

  it('rejects empty constraint item', () => {
    expect(() => SpecSchema.parse({ ...validSpec, constraints: ['valid', ''] })).toThrow();
  });

  it('rejects empty verification criteria item', () => {
    expect(() =>
      SpecSchema.parse({ ...validSpec, verification: { criteria: [''] } }),
    ).toThrow();
  });

  it('rejects empty rationale in decision', () => {
    const d = { id: uuid, description: 'Use Zod', decidedBy: 'arch', decidedAt: now, rationale: '' };
    expect(() => SpecDecisionSchema.parse(d)).toThrow();
  });

  it('rejects updatedAt before createdAt in meta', () => {
    expect(() =>
      SpecSchema.parse({
        ...validSpec,
        meta: { version: 1, createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      }),
    ).toThrow();
  });

  it('parses spec with populated decisions and blockers', () => {
    const spec = {
      ...validSpec,
      decisions: [{ id: uuid, description: 'Use Zod', decidedBy: 'arch', decidedAt: now }],
      blockers: [{ id: uuid, description: 'Pending API', status: 'open' as const, reportedAt: now }],
    };
    const parsed = SpecSchema.parse(spec);
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.blockers).toHaveLength(1);
  });
});
