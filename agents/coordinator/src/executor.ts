import {
  agentLoop,
  type LLMAdapter,
  type ToolRegistry,
  type AgentEvent,
} from '@kata/agent-runtime';
import { buildExecutorPrompt } from './prompts/executor.js';

export interface ExecutorConfig {
  taskTitle: string;
  taskDescription: string;
  taskIndex: number;
  totalTasks: number;
  adapter: LLMAdapter;
  registry: ToolRegistry;
  modelConfig: { provider: string; model: string; temperature?: number; maxTokens?: number };
  signal?: AbortSignal;
}

export async function* runExecutor(config: ExecutorConfig): AsyncGenerator<AgentEvent> {
  const { systemPrompt, userMessage } = buildExecutorPrompt(
    config.taskTitle,
    config.taskDescription,
    config.taskIndex,
    config.totalTasks,
  );

  yield* agentLoop(
    {
      systemPrompt,
      userMessage,
      tools: config.registry.list() as never[],
      modelConfig: config.modelConfig,
      maxTurns: 15,
      signal: config.signal,
    },
    config.adapter,
    config.registry,
  );
}
