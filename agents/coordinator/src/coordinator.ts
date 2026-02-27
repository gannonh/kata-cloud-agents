import {
  createLLMAdapter,
  ToolRegistry,
  agentLoop,
  createShellExecTool,
  createFileReadTool,
  createFileWriteTool,
  createGitCloneTool,
  createGitCommitTool,
  createGitDiffTool,
  type AgentEvent,
} from '@kata/agent-runtime';
import type { Spec, ModelConfig } from '@kata/shared';
import { buildCoordinatorPrompt } from './prompts/coordinator.js';
import { runExecutor } from './executor.js';

interface PlannedTask {
  title: string;
  description: string;
  dependsOn: number[];
}

function parseTasks(json: string): PlannedTask[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array of tasks');
  }
  for (const task of parsed) {
    if (typeof task.title !== 'string' || typeof task.description !== 'string') {
      throw new Error('Each task must have title and description strings');
    }
    if (!Array.isArray(task.dependsOn)) {
      task.dependsOn = [];
    }
  }
  return parsed;
}

function topologicalOrder(tasks: PlannedTask[]): number[] {
  const visited = new Set<number>();
  const order: number[] = [];

  function visit(i: number) {
    if (visited.has(i)) return;
    visited.add(i);
    for (const dep of tasks[i].dependsOn) {
      visit(dep);
    }
    order.push(i);
  }

  for (let i = 0; i < tasks.length; i++) {
    visit(i);
  }

  return order;
}

export interface CoordinatorConfig {
  spec: Spec;
  modelConfig: ModelConfig;
  workspaceDir: string;
  abortSignal?: AbortSignal;
}

export async function* runCoordinator(config: CoordinatorConfig): AsyncGenerator<AgentEvent> {
  const adapter = createLLMAdapter({
    provider: config.modelConfig.provider,
    model: config.modelConfig.model,
    temperature: config.modelConfig.temperature,
    maxTokens: config.modelConfig.maxTokens,
  });

  const workspace = { rootDir: config.workspaceDir };
  const registry = new ToolRegistry();
  registry.register(createShellExecTool(workspace));
  registry.register(createFileReadTool(workspace));
  registry.register(createFileWriteTool(workspace));
  registry.register(createGitCloneTool(workspace));
  registry.register(createGitCommitTool(workspace));
  registry.register(createGitDiffTool(workspace));

  // Phase 1: Plan
  const { systemPrompt, userMessage } = buildCoordinatorPrompt(config.spec);

  let planFinalMessage = '';
  for await (const event of agentLoop(
    {
      systemPrompt,
      userMessage,
      tools: registry.list() as never[],
      modelConfig: config.modelConfig,
      maxTurns: 10,
      signal: config.abortSignal,
    },
    adapter,
    registry,
  )) {
    yield event;
    if (event.type === 'done') {
      planFinalMessage = event.finalMessage;
    }
  }

  // Parse task list from planning output
  let tasks: PlannedTask[];
  try {
    tasks = parseTasks(planFinalMessage);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: 'error', message: `Failed to parse task plan: ${message}`, recoverable: false };
    return;
  }

  if (tasks.length === 0) {
    yield { type: 'error', message: 'Planning produced zero tasks', recoverable: false };
    return;
  }

  // Phase 2: Execute in dependency order
  const order = topologicalOrder(tasks);

  for (const taskIndex of order) {
    const task = tasks[taskIndex];

    for await (const event of runExecutor({
      taskTitle: task.title,
      taskDescription: task.description,
      taskIndex,
      totalTasks: tasks.length,
      adapter,
      registry,
      modelConfig: config.modelConfig,
      signal: config.abortSignal,
    })) {
      yield event;
    }
  }
}
