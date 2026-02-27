import type { LLMAdapter } from './llm/adapter.js';
import type { ToolRegistry } from './tools/registry.js';
import type { AgentEvent, LoopConfig, TokenUsage } from './types.js';

const DEFAULT_MAX_TURNS = 25;

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    total: a.total + b.total,
    cost: {
      input: a.cost.input + b.cost.input,
      output: a.cost.output + b.cost.output,
      total: a.cost.total + b.cost.total,
    },
  };
}

const ZERO_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: { input: 0, output: 0, total: 0 },
};

export async function* agentLoop(
  config: LoopConfig,
  adapter: LLMAdapter,
  registry: ToolRegistry,
): AsyncGenerator<AgentEvent> {
  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
  let totalUsage = { ...ZERO_USAGE, cost: { ...ZERO_USAGE.cost } };
  const messages: Array<{
    role: string;
    content: string;
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
  }> = [{ role: 'user', content: config.userMessage }];

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (config.signal?.aborted) {
      yield { type: 'error', message: 'Aborted', recoverable: false };
      return;
    }

    yield { type: 'turn_start', turnNumber: turn };
    yield { type: 'llm_start', model: config.modelConfig.model };

    const response = await adapter.complete(
      config.systemPrompt,
      messages,
      config.tools as never[],
      config.signal,
    );

    totalUsage = addUsage(totalUsage, response.usage);
    yield { type: 'llm_end', message: response.text, usage: response.usage };

    if (response.toolCalls.length === 0) {
      yield { type: 'turn_end', turnNumber: turn };
      yield { type: 'done', finalMessage: response.text, totalUsage };
      return;
    }

    messages.push({ role: 'assistant', content: response.text });

    for (const toolCall of response.toolCalls) {
      yield { type: 'tool_call', toolName: toolCall.name, params: toolCall.arguments };

      const result = await registry.execute(toolCall.name, toolCall.arguments, config.signal);

      yield {
        type: 'tool_result',
        toolName: toolCall.name,
        content: result.content,
        metadata: result.metadata,
      };

      messages.push({
        role: 'toolResult',
        content: result.content,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        isError: result.isError,
      });
    }

    yield { type: 'turn_end', turnNumber: turn };

    if (config.signal?.aborted) {
      yield { type: 'error', message: 'Aborted after tool execution', recoverable: false };
      return;
    }
  }

  yield { type: 'error', message: `Max turns (${maxTurns}) reached`, recoverable: false };
}
