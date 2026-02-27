import { describe, expect, it, vi } from 'vitest';
import { Type } from '@sinclair/typebox';
import { ToolRegistry } from '../tools/registry.js';
import type { AgentTool } from '../types.js';

function makeTool(name: string, overrides: Partial<AgentTool> = {}): AgentTool {
  return {
    name,
    description: `Test tool: ${name}`,
    parameters: Type.Object({ input: Type.String() }),
    execute: vi.fn(async () => ({ content: 'done', metadata: {}, isError: false })),
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  it('registers and lists tools', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('tool_a'));
    registry.register(makeTool('tool_b'));

    const tools = registry.list();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(['tool_a', 'tool_b']);
  });

  it('rejects duplicate tool names', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('tool_a'));
    expect(() => registry.register(makeTool('tool_a'))).toThrow(/already registered/);
  });

  it('executes a registered tool with valid params', async () => {
    const executeFn = vi.fn(async () => ({
      content: 'result',
      metadata: { bytes: 42 },
      isError: false,
    }));
    const registry = new ToolRegistry();
    registry.register(makeTool('tool_a', { execute: executeFn }));

    const result = await registry.execute('tool_a', { input: 'hello' });

    expect(result.content).toBe('result');
    expect(result.metadata).toEqual({ bytes: 42 });
    expect(result.isError).toBe(false);
    expect(executeFn).toHaveBeenCalledWith({ input: 'hello' }, undefined);
  });

  it('rejects execution of unregistered tool', async () => {
    const registry = new ToolRegistry();
    await expect(registry.execute('nonexistent', {})).rejects.toThrow(/not registered/);
  });

  it('validates params against schema and rejects invalid', async () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('tool_a'));

    const result = await registry.execute('tool_a', { input: 123 });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/validation/i);
  });

  it('catches tool execution errors and returns error result', async () => {
    const registry = new ToolRegistry();
    registry.register(
      makeTool('tool_a', {
        execute: vi.fn(async () => {
          throw new Error('disk full');
        }),
      }),
    );

    const result = await registry.execute('tool_a', { input: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('disk full');
  });

  it('passes abort signal to tool execute', async () => {
    const executeFn = vi.fn(
      async (_params: Record<string, unknown>, signal?: AbortSignal) => {
        return { content: `aborted: ${signal?.aborted}`, metadata: {}, isError: false };
      },
    );
    const registry = new ToolRegistry();
    registry.register(makeTool('tool_a', { execute: executeFn }));

    const controller = new AbortController();
    await registry.execute('tool_a', { input: 'test' }, controller.signal);

    expect(executeFn).toHaveBeenCalledWith({ input: 'test' }, controller.signal);
  });

  it('list() returns tool definitions for LLM consumption', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('tool_a'));

    const defs = registry.list();
    expect(defs[0]).toEqual({
      name: 'tool_a',
      description: 'Test tool: tool_a',
      parameters: expect.objectContaining({ type: 'object' }),
    });
  });
});
