import { describe, expect, it, vi } from 'vitest';
import { agentLoop } from '../loop.js';
import type { AgentEvent, LoopConfig, LLMResponse, TokenUsage } from '../types.js';
import type { LLMAdapter } from '../llm/adapter.js';
import { ToolRegistry } from '../tools/registry.js';
import { Type } from '@sinclair/typebox';

const zeroUsage: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: { input: 0, output: 0, total: 0 },
};

function makeMockAdapter(responses: LLMResponse[]): LLMAdapter {
  let callIndex = 0;
  return {
    complete: vi.fn(async () => {
      if (callIndex >= responses.length) throw new Error('No more mock responses');
      return responses[callIndex++];
    }),
  };
}

async function collectEvents(
  config: LoopConfig,
  adapter: LLMAdapter,
  registry: ToolRegistry,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agentLoop(config, adapter, registry)) {
    events.push(event);
  }
  return events;
}

describe('agentLoop', () => {
  it('completes in one turn when LLM returns no tool calls', async () => {
    const adapter = makeMockAdapter([
      { text: 'Hello!', toolCalls: [], usage: zeroUsage, stopReason: 'stop' },
    ]);
    const registry = new ToolRegistry();
    const config: LoopConfig = {
      systemPrompt: 'You are helpful.',
      userMessage: 'Hi',
      tools: [],
      modelConfig: { provider: 'anthropic', model: 'test' },
    };

    const events = await collectEvents(config, adapter, registry);
    const types = events.map((e) => e.type);

    expect(types).toContain('turn_start');
    expect(types).toContain('llm_end');
    expect(types).toContain('done');
    expect(events.find((e) => e.type === 'done')).toHaveProperty('finalMessage', 'Hello!');
  });

  it('executes tool calls and continues the loop', async () => {
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'echo', arguments: { input: 'test' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
      { text: 'Done with tools.', toolCalls: [], usage: zeroUsage, stopReason: 'stop' },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo input',
      parameters: Type.Object({ input: Type.String() }),
      execute: vi.fn(async (params) => ({
        content: `echoed: ${(params as Record<string, string>).input}`,
        metadata: {},
        isError: false,
      })),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Use echo',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
    };

    const events = await collectEvents(config, adapter, registry);
    const types = events.map((e) => e.type);

    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types.filter((t) => t === 'turn_start')).toHaveLength(2);
    expect(events.find((e) => e.type === 'done')).toHaveProperty(
      'finalMessage',
      'Done with tools.',
    );
  });

  it('stops at maxTurns', async () => {
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'echo', arguments: { input: 'a' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
      {
        text: '',
        toolCalls: [{ id: 'tc-2', name: 'echo', arguments: { input: 'b' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
      {
        text: '',
        toolCalls: [{ id: 'tc-3', name: 'echo', arguments: { input: 'c' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo',
      parameters: Type.Object({ input: Type.String() }),
      execute: vi.fn(async () => ({ content: 'ok', metadata: {}, isError: false })),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Loop forever',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
      maxTurns: 2,
    };

    const events = await collectEvents(config, adapter, registry);
    const turnStarts = events.filter((e) => e.type === 'turn_start');

    expect(turnStarts.length).toBeLessThanOrEqual(2);
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('handles abort signal', async () => {
    const controller = new AbortController();
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'slow', arguments: {} }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'slow',
      description: 'Slow tool',
      parameters: Type.Object({}),
      execute: vi.fn(async () => {
        controller.abort();
        return { content: 'done', metadata: {}, isError: false };
      }),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Run slow',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
      signal: controller.signal,
    };

    const events = await collectEvents(config, adapter, registry);
    const lastEvent = events[events.length - 1];

    expect(lastEvent.type === 'error' || lastEvent.type === 'done').toBe(true);
  });

  it('aggregates token usage across turns', async () => {
    const usage1: TokenUsage = {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      total: 15,
      cost: { input: 0.01, output: 0.005, total: 0.015 },
    };
    const usage2: TokenUsage = {
      input: 20,
      output: 10,
      cacheRead: 0,
      cacheWrite: 0,
      total: 30,
      cost: { input: 0.02, output: 0.01, total: 0.03 },
    };
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'echo', arguments: { input: 'a' } }],
        usage: usage1,
        stopReason: 'toolUse',
      },
      { text: 'Final', toolCalls: [], usage: usage2, stopReason: 'stop' },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo',
      parameters: Type.Object({ input: Type.String() }),
      execute: vi.fn(async () => ({ content: 'ok', metadata: {}, isError: false })),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Test',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
    };

    const events = await collectEvents(config, adapter, registry);
    const doneEvent = events.find((e) => e.type === 'done') as Extract<
      AgentEvent,
      { type: 'done' }
    >;

    expect(doneEvent.totalUsage.total).toBe(45);
    expect(doneEvent.totalUsage.cost.total).toBeCloseTo(0.045);
  });
});
