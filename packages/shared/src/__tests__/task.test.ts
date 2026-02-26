import { describe, it, expect } from 'vitest';
import { TaskSchema, TaskStatusSchema } from '../schemas/task.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('TaskStatusSchema', () => {
  it('accepts all statuses', () => {
    for (const s of ['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']) {
      expect(TaskStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('TaskSchema', () => {
  const valid = {
    id: uuid,
    specId: uuid,
    title: 'Write login component',
    status: 'pending' as const,
    dependsOn: [],
  };

  it('parses valid task', () => {
    expect(TaskSchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional agentRunId', () => {
    const t = { ...valid, agentRunId: uuid };
    expect(TaskSchema.parse(t)).toEqual(t);
  });

  it('parses with optional result', () => {
    const t = { ...valid, result: { output: 'done', exitCode: 0 } };
    expect(TaskSchema.parse(t).result).toEqual({ output: 'done', exitCode: 0 });
  });

  it('parses with dependsOn array', () => {
    const t = { ...valid, dependsOn: [uuid] };
    expect(TaskSchema.parse(t).dependsOn).toEqual([uuid]);
  });

  it('rejects empty title', () => {
    expect(() => TaskSchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('rejects non-object result', () => {
    expect(() => TaskSchema.parse({ ...valid, result: 'string-value' })).toThrow();
  });

  it('rejects array result', () => {
    expect(() => TaskSchema.parse({ ...valid, result: [1, 2, 3] })).toThrow();
  });
});
