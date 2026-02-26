import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from '../transitions.js';
import { SpecTransitionError } from '../errors.js';

describe('spec status transitions', () => {
  it('allows only the M1 forward edges', () => {
    expect(canTransition('draft', 'approved')).toBe(true);
    expect(canTransition('approved', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'verifying')).toBe(true);
    expect(canTransition('verifying', 'done')).toBe(true);
    expect(canTransition('verifying', 'failed')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('draft', 'done')).toBe(false);
    expect(() => assertTransition('draft', 'done')).toThrow(SpecTransitionError);
  });
});
