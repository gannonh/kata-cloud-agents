import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Spec, ModelConfig } from '@kata/shared';
import type { AgentEvent, TokenUsage } from '@kata/agent-runtime';

const zeroUsage: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: { input: 0, output: 0, total: 0 },
};

const uuid = '00000000-0000-4000-8000-000000000001';
const now = '2026-02-27T00:00:00.000Z';

const testSpec: Spec = {
  id: uuid,
  teamId: uuid,
  title: 'Test feature',
  status: 'approved',
  meta: { version: 1, createdAt: now, updatedAt: now },
  intent: 'Build a test feature',
  constraints: ['Must be fast'],
  verification: { criteria: ['Tests pass'] },
  taskIds: [],
  decisions: [],
  blockers: [],
  createdBy: uuid,
};

const testModelConfig: ModelConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
};

vi.mock('@kata/agent-runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@kata/agent-runtime')>();
  return {
    ...original,
    createLLMAdapter: vi.fn(() => ({ complete: vi.fn() })),
    agentLoop: vi.fn(),
  };
});

import { agentLoop } from '@kata/agent-runtime';
import { runCoordinator } from '../coordinator.js';

const mockAgentLoop = vi.mocked(agentLoop);

function makeAsyncGen(events: AgentEvent[]): AsyncGenerator<AgentEvent> {
  return (async function* () {
    yield* events;
  })();
}

async function collectEvents(spec: Spec, config: ModelConfig): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of runCoordinator({
    spec,
    modelConfig: config,
    workspaceDir: '/tmp',
  })) {
    events.push(event);
  }
  return events;
}

describe('runCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs planning phase and produces tasks then executes them', async () => {
    const taskJson = JSON.stringify([
      { title: 'Create migration', description: 'Add column', dependsOn: [] },
    ]);

    mockAgentLoop
      .mockReturnValueOnce(
        makeAsyncGen([
          { type: 'turn_start', turnNumber: 1 },
          { type: 'llm_end', message: '', usage: zeroUsage },
          { type: 'done', finalMessage: taskJson, totalUsage: zeroUsage },
        ]),
      )
      .mockReturnValueOnce(
        makeAsyncGen([
          { type: 'turn_start', turnNumber: 1 },
          { type: 'llm_end', message: '', usage: zeroUsage },
          { type: 'done', finalMessage: 'Task completed.', totalUsage: zeroUsage },
        ]),
      );

    const events = await collectEvents(testSpec, testModelConfig);
    const types = events.map((e) => e.type);

    expect(types).toContain('turn_start');
    expect(types).toContain('done');
    expect(mockAgentLoop).toHaveBeenCalledTimes(2);
  });

  it('handles planning phase that returns invalid JSON', async () => {
    mockAgentLoop.mockReturnValueOnce(
      makeAsyncGen([
        { type: 'done', finalMessage: 'not valid json at all', totalUsage: zeroUsage },
      ]),
    );

    const events = await collectEvents(testSpec, testModelConfig);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
  });

  it('handles empty task list', async () => {
    mockAgentLoop.mockReturnValueOnce(
      makeAsyncGen([{ type: 'done', finalMessage: '[]', totalUsage: zeroUsage }]),
    );

    const events = await collectEvents(testSpec, testModelConfig);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
  });

  it('executes tasks in dependency order', async () => {
    const taskJson = JSON.stringify([
      { title: 'Task A', description: 'First', dependsOn: [] },
      { title: 'Task B', description: 'Depends on A', dependsOn: [0] },
    ]);

    mockAgentLoop
      .mockReturnValueOnce(
        makeAsyncGen([{ type: 'done', finalMessage: taskJson, totalUsage: zeroUsage }]),
      )
      .mockReturnValueOnce(
        makeAsyncGen([{ type: 'done', finalMessage: 'A done.', totalUsage: zeroUsage }]),
      )
      .mockReturnValueOnce(
        makeAsyncGen([{ type: 'done', finalMessage: 'B done.', totalUsage: zeroUsage }]),
      );

    const events = await collectEvents(testSpec, testModelConfig);

    expect(mockAgentLoop).toHaveBeenCalledTimes(3);
    expect(events.filter((e) => e.type === 'done')).toHaveLength(3);
  });
});
