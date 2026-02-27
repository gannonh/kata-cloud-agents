import type { TSchema } from '@sinclair/typebox';

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost: {
    input: number;
    output: number;
    total: number;
  };
}

export type StopReason = 'stop' | 'maxTokens' | 'toolUse' | 'error' | 'aborted';

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls: LLMToolCall[];
  usage: TokenUsage;
  stopReason: StopReason;
  errorMessage?: string;
}

export interface ToolResult {
  content: string;
  metadata: Record<string, unknown>;
  isError: boolean;
}

export interface AgentTool<TParams extends TSchema = TSchema> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<ToolResult>;
}

export interface WorkspaceContext {
  rootDir: string;
  env?: Record<string, string>;
}

export type AgentEvent =
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'llm_start'; model: string }
  | { type: 'llm_chunk'; delta: string }
  | { type: 'llm_end'; message: string; usage: TokenUsage }
  | { type: 'tool_call'; toolName: string; params: unknown }
  | {
      type: 'tool_result';
      toolName: string;
      content: string;
      metadata: Record<string, unknown>;
    }
  | { type: 'turn_end'; turnNumber: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; finalMessage: string; totalUsage: TokenUsage };

export interface LoopConfig {
  systemPrompt: string;
  userMessage: string;
  tools: AgentTool[];
  modelConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  maxTurns?: number;
  signal?: AbortSignal;
}
