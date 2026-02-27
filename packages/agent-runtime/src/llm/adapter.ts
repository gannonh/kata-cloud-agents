import { getModel, completeSimple } from '@mariozechner/pi-ai';
import type { LLMResponse, LLMToolCall, TokenUsage, AgentTool } from '../types.js';

export interface ChatMessage {
  role: string;
  content: string;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

export interface LLMAdapter {
  complete: (
    systemPrompt: string,
    messages: ChatMessage[],
    tools?: AgentTool[],
    signal?: AbortSignal,
  ) => Promise<LLMResponse>;
}

function convertMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((msg) => {
    if (msg.role === 'user') {
      return { role: 'user', content: msg.content, timestamp: Date.now() };
    }
    if (msg.role === 'toolResult') {
      return {
        role: 'toolResult',
        toolCallId: msg.toolCallId!,
        toolName: msg.toolName!,
        content: [{ type: 'text', text: msg.content }],
        isError: msg.isError ?? false,
        timestamp: Date.now(),
      };
    }
    return {
      role: 'assistant',
      content: [{ type: 'text', text: msg.content }],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'unknown',
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'stop',
      timestamp: Date.now(),
    };
  });
}

function extractResponse(msg: Record<string, unknown>): LLMResponse {
  let text = '';
  const toolCalls: LLMToolCall[] = [];
  const content = msg.content as Array<Record<string, unknown>>;

  for (const block of content) {
    if (block.type === 'text') {
      text += block.text as string;
    } else if (block.type === 'toolCall') {
      toolCalls.push({
        id: block.id as string,
        name: block.name as string,
        arguments: block.arguments as Record<string, unknown>,
      });
    }
  }

  const rawUsage = msg.usage as Record<string, unknown>;
  const rawCost = rawUsage.cost as Record<string, number>;

  const usage: TokenUsage = {
    input: rawUsage.input as number,
    output: rawUsage.output as number,
    cacheRead: rawUsage.cacheRead as number,
    cacheWrite: rawUsage.cacheWrite as number,
    total: rawUsage.totalTokens as number,
    cost: {
      input: rawCost.input,
      output: rawCost.output,
      total: rawCost.total,
    },
  };

  return {
    text,
    toolCalls,
    usage,
    stopReason: msg.stopReason as LLMResponse['stopReason'],
    errorMessage: msg.errorMessage as string | undefined,
  };
}

function convertTools(
  tools: AgentTool[],
): Array<{ name: string; description: string; parameters: unknown }> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function createLLMAdapter(config: {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}): LLMAdapter {
  const model = getModel(config.provider, config.model);

  return {
    async complete(systemPrompt, messages, tools, signal) {
      const context = {
        systemPrompt,
        messages: convertMessages(messages),
        tools: tools ? convertTools(tools) : undefined,
      };

      const result = await completeSimple(model, context as never, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        signal,
      });

      return extractResponse(result as unknown as Record<string, unknown>);
    },
  };
}
