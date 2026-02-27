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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
  const content = Array.isArray(msg.content) ? msg.content : [];

  for (const block of content) {
    const contentBlock = asRecord(block);
    if (!contentBlock) continue;

    if (contentBlock.type === 'text' && typeof contentBlock.text === 'string') {
      text += contentBlock.text;
    } else if (
      contentBlock.type === 'toolCall' &&
      typeof contentBlock.id === 'string' &&
      typeof contentBlock.name === 'string'
    ) {
      const args = asRecord(contentBlock.arguments) ?? {};
      toolCalls.push({
        id: contentBlock.id,
        name: contentBlock.name,
        arguments: args,
      });
    }
  }

  const rawUsage = asRecord(msg.usage) ?? {};
  const rawCost = asRecord(rawUsage.cost) ?? {};

  const stopReasonRaw = msg.stopReason;
  const stopReason =
    stopReasonRaw === 'stop' ||
    stopReasonRaw === 'maxTokens' ||
    stopReasonRaw === 'toolUse' ||
    stopReasonRaw === 'error' ||
    stopReasonRaw === 'aborted'
      ? stopReasonRaw
      : 'error';

  const usage: TokenUsage = {
    input: asNumber(rawUsage.input),
    output: asNumber(rawUsage.output),
    cacheRead: asNumber(rawUsage.cacheRead),
    cacheWrite: asNumber(rawUsage.cacheWrite),
    total: asNumber(rawUsage.totalTokens),
    cost: {
      input: asNumber(rawCost.input),
      output: asNumber(rawCost.output),
      total: asNumber(rawCost.total),
    },
  };

  return {
    text,
    toolCalls,
    usage,
    stopReason,
    errorMessage: typeof msg.errorMessage === 'string' ? msg.errorMessage : undefined,
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
  const model = getModel(
    config.provider as Parameters<typeof getModel>[0],
    config.model as Parameters<typeof getModel>[1],
  );

  return {
    async complete(systemPrompt, messages, tools, signal) {
      const context = {
        systemPrompt,
        messages: convertMessages(messages),
        tools: tools ? convertTools(tools) : undefined,
      } as Parameters<typeof completeSimple>[1];

      const result = await completeSimple(model, context, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        signal,
      });

      return extractResponse(asRecord(result) ?? {});
    },
  };
}
