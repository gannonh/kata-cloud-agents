import { describe, expect, it } from 'vitest';
import { diffSpecs } from '../versioning/diff.js';

describe('diffSpecs', () => {
  it('returns empty array for identical objects', () => {
    const obj = { title: 'test', intent: 'do stuff' };
    expect(diffSpecs(obj, obj)).toEqual([]);
  });

  it('detects changed primitive field', () => {
    const old = { title: 'old title', intent: 'same' };
    const next = { title: 'new title', intent: 'same' };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'title', type: 'changed', oldValue: 'old title', newValue: 'new title' },
    ]);
  });

  it('detects added array element', () => {
    const old = { constraints: ['a', 'b'] };
    const next = { constraints: ['a', 'b', 'c'] };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'constraints.2', type: 'added', newValue: 'c' },
    ]);
  });

  it('detects removed array element', () => {
    const old = { constraints: ['a', 'b', 'c'] };
    const next = { constraints: ['a', 'b'] };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'constraints.2', type: 'removed', oldValue: 'c' },
    ]);
  });

  it('detects changed array element', () => {
    const old = { constraints: ['a', 'b'] };
    const next = { constraints: ['a', 'x'] };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'constraints.1', type: 'changed', oldValue: 'b', newValue: 'x' },
    ]);
  });

  it('recurses into nested objects', () => {
    const old = { verification: { criteria: ['test1'], testPlan: 'plan A' } };
    const next = { verification: { criteria: ['test1'], testPlan: 'plan B' } };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'verification.testPlan', type: 'changed', oldValue: 'plan A', newValue: 'plan B' },
    ]);
  });

  it('detects added top-level field', () => {
    const old = { title: 'test' };
    const next = { title: 'test', intent: 'new field' };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'intent', type: 'added', newValue: 'new field' },
    ]);
  });

  it('detects removed top-level field', () => {
    const old = { title: 'test', intent: 'old' };
    const next = { title: 'test' };
    expect(diffSpecs(old, next)).toEqual([
      { path: 'intent', type: 'removed', oldValue: 'old' },
    ]);
  });

  it('ignores meta.updatedAt changes', () => {
    const old = { meta: { version: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' } };
    const next = { meta: { version: 1, createdAt: '2026-01-01', updatedAt: '2026-02-01' } };
    expect(diffSpecs(old, next)).toEqual([]);
  });

  it('handles multiple changes across fields', () => {
    const old = { title: 'a', intent: 'x', constraints: ['c1'] };
    const next = { title: 'b', intent: 'x', constraints: ['c1', 'c2'] };
    const result = diffSpecs(old, next);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      { path: 'title', type: 'changed', oldValue: 'a', newValue: 'b' },
      { path: 'constraints.1', type: 'added', newValue: 'c2' },
    ]));
  });
});
