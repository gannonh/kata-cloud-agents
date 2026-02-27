import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock pi-ai before importing adapter
vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn(() => ({
    provider: 'anthropic',
    api: 'anthropic-messages',
    id: 'claude-sonnet-4-20250514',
  })),
  streamSimple: vi.fn(),
  completeSimple: vi.fn(),
}));

import { createLLMAdapter } from '../llm/adapter.js';
import { completeSimple } from '@mariozechner/pi-ai';

const mockCompleteSimple = vi.mocked(completeSimple);

function makeAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text: 'Hello world' }],
    api: 'anthropic-messages',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    usage: {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 15,
      cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
    },
    stopReason: 'stop' as const,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('createLLMAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('complete() sends messages and returns LLMResponse', async () => {
    mockCompleteSimple.mockResolvedValueOnce(makeAssistantMessage());
    const adapter = createLLMAdapter({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });

    const result = await adapter.complete('You are helpful.', [{ role: 'user', content: 'Hi' }]);

    expect(result.text).toBe('Hello world');
    expect(result.toolCalls).toEqual([]);
    expect(result.stopReason).toBe('stop');
    expect(result.usage.total).toBe(15);
  });

  it('complete() extracts tool calls from response', async () => {
    const msg = makeAssistantMessage({
      content: [
        { type: 'toolCall', id: 'tc-1', name: 'file_read', arguments: { path: '/tmp/test.txt' } },
      ],
      stopReason: 'toolUse',
    });
    mockCompleteSimple.mockResolvedValueOnce(msg);
    const adapter = createLLMAdapter({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });

    const result = await adapter.complete('System', [{ role: 'user', content: 'read a file' }]);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      id: 'tc-1',
      name: 'file_read',
      arguments: { path: '/tmp/test.txt' },
    });
    expect(result.stopReason).toBe('toolUse');
  });

  it('complete() handles mixed text and tool calls', async () => {
    const msg = makeAssistantMessage({
      content: [
        { type: 'text', text: 'Let me read that file.' },
        { type: 'toolCall', id: 'tc-1', name: 'file_read', arguments: { path: '/tmp/x' } },
      ],
      stopReason: 'toolUse',
    });
    mockCompleteSimple.mockResolvedValueOnce(msg);
    const adapter = createLLMAdapter({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });

    const result = await adapter.complete('System', [{ role: 'user', content: 'test' }]);

    expect(result.text).toBe('Let me read that file.');
    expect(result.toolCalls).toHaveLength(1);
  });

  it('complete() handles API errors gracefully', async () => {
    mockCompleteSimple.mockRejectedValueOnce(new Error('API rate limited'));
    const adapter = createLLMAdapter({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });

    await expect(
      adapter.complete('System', [{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('API rate limited');
  });

  it('passes temperature and maxTokens to pi-ai', async () => {
    mockCompleteSimple.mockResolvedValueOnce(makeAssistantMessage());
    const adapter = createLLMAdapter({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.5,
      maxTokens: 1000,
    });

    await adapter.complete('System', [{ role: 'user', content: 'test' }]);

    expect(mockCompleteSimple).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ temperature: 0.5, maxTokens: 1000 }),
    );
  });

  it('defensively parses malformed provider payloads', async () => {
    mockCompleteSimple.mockResolvedValueOnce({
      role: 'assistant',
      content: 'not-an-array',
      usage: null,
      stopReason: 'unexpected',
    } as never);

    const adapter = createLLMAdapter({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    const result = await adapter.complete('System', [{ role: 'user', content: 'test' }]);

    expect(result.text).toBe('');
    expect(result.toolCalls).toEqual([]);
    expect(result.usage.total).toBe(0);
    expect(result.stopReason).toBe('error');
  });
});
