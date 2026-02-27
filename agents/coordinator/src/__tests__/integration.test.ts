import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import type { Spec, ModelConfig } from '@kata/shared';
import type { AgentEvent, TokenUsage, LLMResponse } from '@kata/agent-runtime';

const zeroUsage: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: { input: 0, output: 0, total: 0 },
};

const uuid = '00000000-0000-4000-8000-000000000001';
const now = '2026-02-27T00:00:00.000Z';

const testSpec: Spec = {
  id: uuid,
  teamId: uuid,
  title: 'Create hello.txt',
  status: 'approved',
  meta: { version: 1, createdAt: now, updatedAt: now },
  intent: 'Create a hello.txt file with greeting content',
  constraints: [],
  verification: { criteria: ['hello.txt exists'] },
  taskIds: [],
  decisions: [],
  blockers: [],
  createdBy: uuid,
};

const testModelConfig: ModelConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
};

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'kata-integration-'));
  execSync('git init', { cwd: workDir });
  execSync('git config user.email "test@test.com"', { cwd: workDir });
  execSync('git config user.name "Test"', { cwd: workDir });
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

// Mock the LLM adapter at module level
vi.mock('@kata/agent-runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@kata/agent-runtime')>();
  return {
    ...original,
    createLLMAdapter: vi.fn(),
  };
});

import { createLLMAdapter } from '@kata/agent-runtime';
import { runCoordinator } from '../coordinator.js';

const mockCreateLLMAdapter = vi.mocked(createLLMAdapter);

describe('integration: full lifecycle', () => {
  it('plans tasks then executor creates files', async () => {
    let callCount = 0;
    const mockAdapter = {
      complete: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // Coordinator planning: return task list
          return {
            text: JSON.stringify([
              {
                title: 'Create hello.txt',
                description: 'Write Hello World to hello.txt',
                dependsOn: [],
              },
            ]),
            toolCalls: [],
            usage: zeroUsage,
            stopReason: 'stop' as const,
          } satisfies LLMResponse;
        }
        if (callCount === 2) {
          // Executor: call file_write tool
          return {
            text: '',
            toolCalls: [
              {
                id: 'tc-1',
                name: 'file_write',
                arguments: { path: 'hello.txt', content: 'Hello World' },
              },
            ],
            usage: zeroUsage,
            stopReason: 'toolUse' as const,
          } satisfies LLMResponse;
        }
        // Executor: done after writing file
        return {
          text: 'Created hello.txt with greeting.',
          toolCalls: [],
          usage: zeroUsage,
          stopReason: 'stop' as const,
        } satisfies LLMResponse;
      }),
    };
    mockCreateLLMAdapter.mockReturnValue(mockAdapter);

    const events: AgentEvent[] = [];
    for await (const event of runCoordinator({
      spec: testSpec,
      modelConfig: testModelConfig,
      workspaceDir: workDir,
    })) {
      events.push(event);
    }

    // Verify file was created
    const content = await readFile(join(workDir, 'hello.txt'), 'utf-8');
    expect(content).toBe('Hello World');

    // Verify events include tool_call and done
    const types = events.map((e) => e.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('done');
  });
});

describe('integration: dependency ordering', () => {
  it('executes tasks respecting dependencies', async () => {
    const executionOrder: string[] = [];
    let callCount = 0;

    const mockAdapter = {
      complete: vi.fn(async (systemPrompt: string) => {
        callCount++;
        if (callCount === 1) {
          return {
            text: JSON.stringify([
              { title: 'Task A', description: 'First task', dependsOn: [] },
              { title: 'Task B', description: 'Depends on A', dependsOn: [0] },
              { title: 'Task C', description: 'Depends on A', dependsOn: [0] },
            ]),
            toolCalls: [],
            usage: zeroUsage,
            stopReason: 'stop' as const,
          } satisfies LLMResponse;
        }
        // Extract task name from system prompt
        const match = systemPrompt.match(/task (\d+) of/i);
        if (match) executionOrder.push(`task-${match[1]}`);
        return {
          text: 'Done.',
          toolCalls: [],
          usage: zeroUsage,
          stopReason: 'stop' as const,
        } satisfies LLMResponse;
      }),
    };
    mockCreateLLMAdapter.mockReturnValue(mockAdapter);

    const events: AgentEvent[] = [];
    for await (const event of runCoordinator({
      spec: testSpec,
      modelConfig: testModelConfig,
      workspaceDir: workDir,
    })) {
      events.push(event);
    }

    // Task A (index 0) must execute before B (1) and C (2)
    const aIndex = executionOrder.indexOf('task-1');
    const bIndex = executionOrder.indexOf('task-2');
    const cIndex = executionOrder.indexOf('task-3');
    expect(aIndex).toBeGreaterThanOrEqual(0);
    expect(bIndex).toBeGreaterThanOrEqual(0);
    expect(cIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeLessThan(bIndex);
    expect(aIndex).toBeLessThan(cIndex);
  });
});
