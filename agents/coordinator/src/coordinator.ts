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
  return parsed.map((task, index) => {
    if (!task || typeof task !== 'object') {
      throw new Error(`Task ${index} must be an object`);
    }

    const taskObject = task as Record<string, unknown>;
    const title = taskObject.title;
    const description = taskObject.description;

    if (typeof title !== 'string' || typeof description !== 'string') {
      throw new Error('Each task must have title and description strings');
    }

    const rawDependsOn = Array.isArray(taskObject.dependsOn) ? taskObject.dependsOn : [];
    const dependsOn: number[] = [];
    const seenDependencies = new Set<number>();

    for (const dep of rawDependsOn) {
      if (!Number.isInteger(dep)) {
        throw new Error(`Task ${index} has non-integer dependency`);
      }

      const depIndex = dep as number;
      if (depIndex < 0 || depIndex >= parsed.length) {
        throw new Error(`Task ${index} has out-of-range dependency ${depIndex}`);
      }
      if (depIndex === index) {
        throw new Error(`Task ${index} cannot depend on itself`);
      }

      if (!seenDependencies.has(depIndex)) {
        seenDependencies.add(depIndex);
        dependsOn.push(depIndex);
      }
    }

    return { title, description, dependsOn };
  });
}

function topologicalOrder(tasks: PlannedTask[]): number[] {
  const visited = new Set<number>();
  const visiting = new Set<number>();
  const order: number[] = [];

  function visit(i: number) {
    if (visited.has(i)) return;
    if (visiting.has(i)) {
      throw new Error(`Circular dependency detected at task ${i}`);
    }

    visiting.add(i);
    for (const dep of tasks[i].dependsOn) {
      visit(dep);
    }
    visiting.delete(i);
    visited.add(i);
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
  let planningCompleted = false;
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
      planningCompleted = true;
    }
  }

  if (!planningCompleted) {
    yield {
      type: 'error',
      message: 'Planner did not complete; cannot parse tasks',
      recoverable: false,
    };
    return;
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
  let order: number[];
  try {
    order = topologicalOrder(tasks);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: 'error', message: `Invalid task dependencies: ${message}`, recoverable: false };
    return;
  }

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
