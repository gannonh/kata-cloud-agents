# KAT-115: Single-Agent Coordinator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the agent runtime infrastructure (LLM adapter, tool registry, conversation loop) and coordinator agent that reads a spec, decomposes it into tasks, and dispatches an executor sub-agent per task.

**Architecture:** `packages/agent-runtime/` provides core infrastructure (pi-ai LLM wrapper, tool registry with TypeBox/AJV validation, async generator conversation loop, typed event stream). `agents/coordinator/` uses the runtime to orchestrate a plan-then-execute flow with an executor sub-agent per task.

**Tech Stack:** @mariozechner/pi-ai, @sinclair/typebox, ajv, Vitest, TypeScript

---

### Task 1: Scaffold agent-runtime package

**Files:**
- Modify: `packages/agent-runtime/package.json`
- Create: `packages/agent-runtime/tsconfig.json`
- Create: `packages/agent-runtime/vitest.config.ts`
- Create: `packages/agent-runtime/src/index.ts`
- Create: `packages/agent-runtime/src/types.ts`

**Step 1: Update package.json with dependencies and scripts**

Replace `packages/agent-runtime/package.json`:

```json
{
  "name": "@kata/agent-runtime",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@kata/shared": "workspace:*",
    "@mariozechner/pi-ai": "^0.55.1",
    "@sinclair/typebox": "^0.34.41",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2",
    "vitest": "^3.2.4"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/agent-runtime/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

**Step 3: Create vitest.config.ts**

Create `packages/agent-runtime/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

**Step 4: Create core type definitions**

Create `packages/agent-runtime/src/types.ts`:

```typescript
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
  | { type: 'tool_result'; toolName: string; content: string; metadata: Record<string, unknown> }
  | { type: 'turn_end'; turnNumber: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; finalMessage: string; totalUsage: TokenUsage };

export interface LoopConfig {
  systemPrompt: string;
  userMessage: string;
  tools: AgentTool[];
  modelConfig: { provider: string; model: string; temperature?: number; maxTokens?: number };
  maxTurns?: number;
  signal?: AbortSignal;
}
```

**Step 5: Create index.ts with placeholder export**

Create `packages/agent-runtime/src/index.ts`:

```typescript
export * from './types.js';
```

**Step 6: Install dependencies and verify build**

Run: `cd /Users/gannonhall/dev/kata/kata-cloud-agents && pnpm install && cd packages/agent-runtime && pnpm typecheck`
Expected: PASS (types compile)

**Step 7: Commit**

```bash
git add packages/agent-runtime/
git commit -m "feat(agent-runtime): scaffold package with types, deps, and build config"
```

---

### Task 2: Implement LLM adapter

**Files:**
- Create: `packages/agent-runtime/src/llm/adapter.ts`
- Create: `packages/agent-runtime/src/__tests__/llm-adapter.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/agent-runtime/src/__tests__/llm-adapter.test.ts`:

```typescript
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
import { completeSimple, streamSimple } from '@mariozechner/pi-ai';

const mockCompleteSimple = vi.mocked(completeSimple);
const mockStreamSimple = vi.mocked(streamSimple);

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
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agent-runtime && pnpm test`
Expected: FAIL - module not found

**Step 3: Implement the adapter**

Create `packages/agent-runtime/src/llm/adapter.ts`:

```typescript
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
```

**Step 4: Add export to index.ts**

In `packages/agent-runtime/src/index.ts`, add:

```typescript
export * from './types.js';
export { createLLMAdapter } from './llm/adapter.js';
export type { LLMAdapter, ChatMessage } from './llm/adapter.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/agent-runtime && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/agent-runtime/src/llm/ packages/agent-runtime/src/__tests__/llm-adapter.test.ts packages/agent-runtime/src/index.ts
git commit -m "feat(agent-runtime): implement LLM adapter wrapping pi-ai"
```

---

### Task 3: Implement tool registry

**Files:**
- Create: `packages/agent-runtime/src/tools/registry.ts`
- Create: `packages/agent-runtime/src/__tests__/tool-registry.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/agent-runtime/src/__tests__/tool-registry.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agent-runtime && pnpm test`
Expected: FAIL - module not found

**Step 3: Implement the registry**

Create `packages/agent-runtime/src/tools/registry.ts`:

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { AgentTool, ToolResult } from '../types.js';

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  list(): Array<{ name: string; description: string; parameters: unknown }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not registered`);
    }

    const validate = this.ajv.compile(tool.parameters);
    if (!validate(params)) {
      const errors =
        validate.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ') ?? 'unknown';
      return { content: `Parameter validation failed: ${errors}`, metadata: {}, isError: true };
    }

    try {
      return await tool.execute(params, signal);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: `Tool execution error: ${message}`, metadata: {}, isError: true };
    }
  }
}
```

**Step 4: Add export**

In `packages/agent-runtime/src/index.ts`, add:

```typescript
export * from './types.js';
export { createLLMAdapter } from './llm/adapter.js';
export type { LLMAdapter, ChatMessage } from './llm/adapter.js';
export { ToolRegistry } from './tools/registry.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/agent-runtime && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/agent-runtime/src/tools/registry.ts packages/agent-runtime/src/__tests__/tool-registry.test.ts packages/agent-runtime/src/index.ts
git commit -m "feat(agent-runtime): implement tool registry with TypeBox/AJV validation"
```

---

### Task 4: Implement file tools (shell_exec, file_read, file_write)

**Files:**
- Create: `packages/agent-runtime/src/tools/shell-exec.ts`
- Create: `packages/agent-runtime/src/tools/file-read.ts`
- Create: `packages/agent-runtime/src/tools/file-write.ts`
- Create: `packages/agent-runtime/src/__tests__/file-tools.test.ts`

**Step 1: Write the failing tests**

Create `packages/agent-runtime/src/__tests__/file-tools.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createShellExecTool } from '../tools/shell-exec.js';
import { createFileReadTool } from '../tools/file-read.js';
import { createFileWriteTool } from '../tools/file-write.js';
import type { WorkspaceContext } from '../types.js';

let workDir: string;
let ctx: WorkspaceContext;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'kata-tools-'));
  ctx = { rootDir: workDir };
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('shell_exec', () => {
  it('runs a command and returns stdout', async () => {
    const tool = createShellExecTool(ctx);
    const result = await tool.execute({ command: 'echo hello' });
    expect(result.content).toContain('hello');
    expect(result.isError).toBe(false);
  });

  it('returns error for failed command', async () => {
    const tool = createShellExecTool(ctx);
    const result = await tool.execute({ command: 'exit 1' });
    expect(result.isError).toBe(true);
    expect(result.metadata).toHaveProperty('exitCode', 1);
  });

  it('respects timeout', async () => {
    const tool = createShellExecTool(ctx);
    const result = await tool.execute({ command: 'sleep 10', timeout: 500 });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/timeout|killed/i);
  });

  it('uses workspace root as default cwd', async () => {
    const tool = createShellExecTool(ctx);
    const result = await tool.execute({ command: 'pwd' });
    expect(result.content.trim()).toBe(workDir);
  });
});

describe('file_read', () => {
  it('reads an existing file', async () => {
    await writeFile(join(workDir, 'test.txt'), 'hello content');
    const tool = createFileReadTool(ctx);
    const result = await tool.execute({ path: 'test.txt' });
    expect(result.content).toBe('hello content');
    expect(result.isError).toBe(false);
  });

  it('returns error for nonexistent file', async () => {
    const tool = createFileReadTool(ctx);
    const result = await tool.execute({ path: 'missing.txt' });
    expect(result.isError).toBe(true);
  });

  it('rejects path traversal', async () => {
    const tool = createFileReadTool(ctx);
    const result = await tool.execute({ path: '../../etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/outside workspace/i);
  });
});

describe('file_write', () => {
  it('writes content to a file', async () => {
    const tool = createFileWriteTool(ctx);
    const result = await tool.execute({ path: 'output.txt', content: 'written' });
    expect(result.isError).toBe(false);

    const contents = await readFile(join(workDir, 'output.txt'), 'utf-8');
    expect(contents).toBe('written');
  });

  it('creates directories when createDirs is true', async () => {
    const tool = createFileWriteTool(ctx);
    const result = await tool.execute({
      path: 'deep/nested/file.txt',
      content: 'hi',
      createDirs: true,
    });
    expect(result.isError).toBe(false);

    const contents = await readFile(join(workDir, 'deep/nested/file.txt'), 'utf-8');
    expect(contents).toBe('hi');
  });

  it('rejects path traversal', async () => {
    const tool = createFileWriteTool(ctx);
    const result = await tool.execute({ path: '../outside.txt', content: 'bad' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/outside workspace/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agent-runtime && pnpm test`
Expected: FAIL - modules not found

**Step 3: Implement shell_exec**

Create `packages/agent-runtime/src/tools/shell-exec.ts`:

```typescript
import { exec } from 'node:child_process';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

const DEFAULT_TIMEOUT = 30_000;

const BLOCKED_COMMANDS = ['rm -rf /', 'mkfs', 'dd if=/dev/zero', ':(){:|:&};:'];

export function createShellExecTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'shell_exec',
    description: 'Execute a shell command in the workspace directory',
    parameters: Type.Object({
      command: Type.String({ description: 'The shell command to execute' }),
      cwd: Type.Optional(Type.String({ description: 'Working directory (relative to workspace)' })),
      timeout: Type.Optional(
        Type.Number({ description: 'Timeout in milliseconds', default: DEFAULT_TIMEOUT }),
      ),
    }),
    async execute(params) {
      const command = params.command as string;
      const timeout = (params.timeout as number) ?? DEFAULT_TIMEOUT;
      const cwd = params.cwd ? `${ctx.rootDir}/${params.cwd}` : ctx.rootDir;

      if (BLOCKED_COMMANDS.some((blocked) => command.includes(blocked))) {
        return { content: 'Command blocked for safety', metadata: {}, isError: true };
      }

      return new Promise((resolve) => {
        exec(command, { cwd, timeout, env: { ...process.env, ...ctx.env } }, (error, stdout, stderr) => {
          if (error) {
            const exitCode = error.code ?? 1;
            const killed = error.killed ?? false;
            const output = killed
              ? `Command killed (timeout after ${timeout}ms)`
              : `${stdout}\n${stderr}`.trim();
            resolve({
              content: output || error.message,
              metadata: { exitCode, killed },
              isError: true,
            });
            return;
          }
          resolve({
            content: `${stdout}${stderr}`.trim(),
            metadata: { exitCode: 0 },
            isError: false,
          });
        });
      });
    },
  };
}
```

**Step 4: Implement file_read**

Create `packages/agent-runtime/src/tools/file-read.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

function resolveSafe(rootDir: string, filePath: string): string | null {
  const resolved = resolve(rootDir, filePath);
  const rel = relative(rootDir, resolved);
  if (rel.startsWith('..') || resolve(rootDir, rel) !== resolved) {
    return null;
  }
  return resolved;
}

export function createFileReadTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'file_read',
    description: 'Read the contents of a file within the workspace',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to workspace root' }),
      encoding: Type.Optional(Type.String({ description: 'File encoding', default: 'utf-8' })),
    }),
    async execute(params) {
      const filePath = params.path as string;
      const encoding = (params.encoding as BufferEncoding) ?? 'utf-8';

      const resolved = resolveSafe(ctx.rootDir, filePath);
      if (!resolved) {
        return {
          content: `Path "${filePath}" resolves outside workspace root`,
          metadata: {},
          isError: true,
        };
      }

      try {
        const content = await readFile(resolved, encoding);
        return {
          content,
          metadata: { path: resolved, bytes: Buffer.byteLength(content) },
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Failed to read file: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
```

**Step 5: Implement file_write**

Create `packages/agent-runtime/src/tools/file-write.ts`:

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

function resolveSafe(rootDir: string, filePath: string): string | null {
  const resolved = resolve(rootDir, filePath);
  const rel = relative(rootDir, resolved);
  if (rel.startsWith('..') || resolve(rootDir, rel) !== resolved) {
    return null;
  }
  return resolved;
}

export function createFileWriteTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'file_write',
    description: 'Write content to a file within the workspace',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to workspace root' }),
      content: Type.String({ description: 'Content to write' }),
      createDirs: Type.Optional(
        Type.Boolean({ description: 'Create parent directories if needed', default: false }),
      ),
    }),
    async execute(params) {
      const filePath = params.path as string;
      const content = params.content as string;
      const createDirs = (params.createDirs as boolean) ?? false;

      const resolved = resolveSafe(ctx.rootDir, filePath);
      if (!resolved) {
        return {
          content: `Path "${filePath}" resolves outside workspace root`,
          metadata: {},
          isError: true,
        };
      }

      try {
        if (createDirs) {
          await mkdir(dirname(resolved), { recursive: true });
        }
        await writeFile(resolved, content, 'utf-8');
        return {
          content: `Written ${Buffer.byteLength(content)} bytes to ${filePath}`,
          metadata: { path: resolved, bytes: Buffer.byteLength(content) },
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Failed to write file: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/agent-runtime && pnpm test`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/agent-runtime/src/tools/shell-exec.ts packages/agent-runtime/src/tools/file-read.ts packages/agent-runtime/src/tools/file-write.ts packages/agent-runtime/src/__tests__/file-tools.test.ts
git commit -m "feat(agent-runtime): implement shell_exec, file_read, file_write tools"
```

---

### Task 5: Implement git tools (git_clone, git_commit, git_diff)

**Files:**
- Create: `packages/agent-runtime/src/tools/git-clone.ts`
- Create: `packages/agent-runtime/src/tools/git-commit.ts`
- Create: `packages/agent-runtime/src/tools/git-diff.ts`
- Create: `packages/agent-runtime/src/tools/index.ts`
- Create: `packages/agent-runtime/src/__tests__/git-tools.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/agent-runtime/src/__tests__/git-tools.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { createGitCloneTool } from '../tools/git-clone.js';
import { createGitCommitTool } from '../tools/git-commit.js';
import { createGitDiffTool } from '../tools/git-diff.js';
import type { WorkspaceContext } from '../types.js';

let workDir: string;
let ctx: WorkspaceContext;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'kata-git-tools-'));
  ctx = { rootDir: workDir };
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('git_clone', () => {
  it('clones a local bare repo', async () => {
    const bareDir = join(workDir, 'bare.git');
    execSync(`git init --bare "${bareDir}"`);

    const tool = createGitCloneTool(ctx);
    const result = await tool.execute({ url: bareDir, dest: 'cloned' });
    expect(result.isError).toBe(false);
    expect(result.metadata).toHaveProperty('path');
  });

  it('rejects dest outside workspace', async () => {
    const tool = createGitCloneTool(ctx);
    const result = await tool.execute({ url: 'https://example.com/repo', dest: '../../outside' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/outside workspace/i);
  });
});

describe('git_commit', () => {
  it('stages and commits files', async () => {
    execSync('git init', { cwd: workDir });
    execSync('git config user.email "test@test.com"', { cwd: workDir });
    execSync('git config user.name "Test"', { cwd: workDir });
    await writeFile(join(workDir, 'file.txt'), 'content');

    const tool = createGitCommitTool(ctx);
    const result = await tool.execute({ message: 'initial commit', files: ['file.txt'] });
    expect(result.isError).toBe(false);
    expect(result.metadata).toHaveProperty('sha');
  });

  it('stages all with all flag', async () => {
    execSync('git init', { cwd: workDir });
    execSync('git config user.email "test@test.com"', { cwd: workDir });
    execSync('git config user.name "Test"', { cwd: workDir });
    await writeFile(join(workDir, 'a.txt'), 'a');
    await writeFile(join(workDir, 'b.txt'), 'b');

    const tool = createGitCommitTool(ctx);
    const result = await tool.execute({ message: 'commit all', all: true });
    expect(result.isError).toBe(false);
  });
});

describe('git_diff', () => {
  it('shows diff of modified files', async () => {
    execSync('git init', { cwd: workDir });
    execSync('git config user.email "test@test.com"', { cwd: workDir });
    execSync('git config user.name "Test"', { cwd: workDir });
    await writeFile(join(workDir, 'file.txt'), 'original');
    execSync('git add . && git commit -m "init"', { cwd: workDir });
    await writeFile(join(workDir, 'file.txt'), 'modified');

    const tool = createGitDiffTool(ctx);
    const result = await tool.execute({});
    expect(result.content).toContain('modified');
    expect(result.isError).toBe(false);
  });

  it('shows staged diff', async () => {
    execSync('git init', { cwd: workDir });
    execSync('git config user.email "test@test.com"', { cwd: workDir });
    execSync('git config user.name "Test"', { cwd: workDir });
    await writeFile(join(workDir, 'file.txt'), 'original');
    execSync('git add . && git commit -m "init"', { cwd: workDir });
    await writeFile(join(workDir, 'file.txt'), 'staged change');
    execSync('git add .', { cwd: workDir });

    const tool = createGitDiffTool(ctx);
    const result = await tool.execute({ staged: true });
    expect(result.content).toContain('staged change');
    expect(result.isError).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agent-runtime && pnpm test`
Expected: FAIL - modules not found

**Step 3: Implement git_clone**

Create `packages/agent-runtime/src/tools/git-clone.ts`:

```typescript
import { exec } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

export function createGitCloneTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'git_clone',
    description: 'Clone a git repository into the workspace',
    parameters: Type.Object({
      url: Type.String({ description: 'Repository URL or local path' }),
      dest: Type.Optional(Type.String({ description: 'Destination directory (relative to workspace)' })),
      branch: Type.Optional(Type.String({ description: 'Branch to clone' })),
      depth: Type.Optional(Type.Number({ description: 'Shallow clone depth', default: 1 })),
    }),
    async execute(params) {
      const url = params.url as string;
      const dest = (params.dest as string) ?? 'repo';
      const branch = params.branch as string | undefined;
      const depth = (params.depth as number) ?? 1;

      const destPath = resolve(ctx.rootDir, dest);
      const rel = relative(ctx.rootDir, destPath);
      if (rel.startsWith('..')) {
        return {
          content: `Destination "${dest}" resolves outside workspace root`,
          metadata: {},
          isError: true,
        };
      }

      const args = ['git', 'clone'];
      if (depth > 0) args.push(`--depth=${depth}`);
      if (branch) args.push(`--branch=${branch}`);
      args.push(url, destPath);

      return new Promise((resolve) => {
        exec(args.join(' '), { cwd: ctx.rootDir, timeout: 120_000 }, (error, stdout, stderr) => {
          if (error) {
            resolve({
              content: `Clone failed: ${stderr || error.message}`,
              metadata: {},
              isError: true,
            });
            return;
          }
          resolve({
            content: `Cloned ${url} to ${dest}`,
            metadata: { path: destPath },
            isError: false,
          });
        });
      });
    },
  };
}
```

**Step 4: Implement git_commit**

Create `packages/agent-runtime/src/tools/git-commit.ts`:

```typescript
import { execSync } from 'node:child_process';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

export function createGitCommitTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'git_commit',
    description: 'Stage files and create a git commit',
    parameters: Type.Object({
      message: Type.String({ description: 'Commit message' }),
      files: Type.Optional(Type.Array(Type.String(), { description: 'Files to stage' })),
      all: Type.Optional(Type.Boolean({ description: 'Stage all changes', default: false })),
    }),
    async execute(params) {
      const message = params.message as string;
      const files = params.files as string[] | undefined;
      const all = (params.all as boolean) ?? false;

      try {
        if (all) {
          execSync('git add -A', { cwd: ctx.rootDir });
        } else if (files && files.length > 0) {
          execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: ctx.rootDir });
        }

        const result = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
          cwd: ctx.rootDir,
          encoding: 'utf-8',
        });

        const sha = execSync('git rev-parse HEAD', {
          cwd: ctx.rootDir,
          encoding: 'utf-8',
        }).trim();

        return {
          content: result.trim(),
          metadata: { sha },
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Commit failed: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
```

**Step 5: Implement git_diff**

Create `packages/agent-runtime/src/tools/git-diff.ts`:

```typescript
import { execSync } from 'node:child_process';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

export function createGitDiffTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'git_diff',
    description: 'Show git diff of changes in the workspace',
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: 'Specific file or directory to diff' })),
      staged: Type.Optional(Type.Boolean({ description: 'Show staged changes', default: false })),
      ref: Type.Optional(Type.String({ description: 'Compare against a specific ref' })),
    }),
    async execute(params) {
      const path = params.path as string | undefined;
      const staged = (params.staged as boolean) ?? false;
      const ref = params.ref as string | undefined;

      try {
        const args = ['git', 'diff'];
        if (staged) args.push('--staged');
        if (ref) args.push(ref);
        if (path) args.push('--', path);

        const output = execSync(args.join(' '), {
          cwd: ctx.rootDir,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
        });

        return {
          content: output || '(no changes)',
          metadata: {},
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Diff failed: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
```

**Step 6: Create tools barrel export**

Create `packages/agent-runtime/src/tools/index.ts`:

```typescript
export { createShellExecTool } from './shell-exec.js';
export { createFileReadTool } from './file-read.js';
export { createFileWriteTool } from './file-write.js';
export { createGitCloneTool } from './git-clone.js';
export { createGitCommitTool } from './git-commit.js';
export { createGitDiffTool } from './git-diff.js';
```

**Step 7: Update package index.ts**

Replace `packages/agent-runtime/src/index.ts`:

```typescript
export * from './types.js';
export { createLLMAdapter } from './llm/adapter.js';
export type { LLMAdapter, ChatMessage } from './llm/adapter.js';
export { ToolRegistry } from './tools/registry.js';
export {
  createShellExecTool,
  createFileReadTool,
  createFileWriteTool,
  createGitCloneTool,
  createGitCommitTool,
  createGitDiffTool,
} from './tools/index.js';
```

**Step 8: Run tests to verify they pass**

Run: `cd packages/agent-runtime && pnpm test`
Expected: PASS

**Step 9: Commit**

```bash
git add packages/agent-runtime/src/tools/ packages/agent-runtime/src/__tests__/git-tools.test.ts packages/agent-runtime/src/index.ts
git commit -m "feat(agent-runtime): implement git_clone, git_commit, git_diff tools"
```

---

### Task 6: Implement conversation loop

**Files:**
- Create: `packages/agent-runtime/src/loop.ts`
- Create: `packages/agent-runtime/src/__tests__/loop.test.ts`
- Modify: `packages/agent-runtime/src/index.ts`

**Step 1: Write the failing tests**

Create `packages/agent-runtime/src/__tests__/loop.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { agentLoop } from '../loop.js';
import type { AgentEvent, LoopConfig, LLMResponse, TokenUsage } from '../types.js';
import type { LLMAdapter } from '../llm/adapter.js';
import { ToolRegistry } from '../tools/registry.js';
import { Type } from '@sinclair/typebox';

const zeroUsage: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: { input: 0, output: 0, total: 0 },
};

function makeMockAdapter(responses: LLMResponse[]): LLMAdapter {
  let callIndex = 0;
  return {
    complete: vi.fn(async () => {
      if (callIndex >= responses.length) throw new Error('No more mock responses');
      return responses[callIndex++];
    }),
  };
}

async function collectEvents(
  config: LoopConfig,
  adapter: LLMAdapter,
  registry: ToolRegistry,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agentLoop(config, adapter, registry)) {
    events.push(event);
  }
  return events;
}

describe('agentLoop', () => {
  it('completes in one turn when LLM returns no tool calls', async () => {
    const adapter = makeMockAdapter([
      { text: 'Hello!', toolCalls: [], usage: zeroUsage, stopReason: 'stop' },
    ]);
    const registry = new ToolRegistry();
    const config: LoopConfig = {
      systemPrompt: 'You are helpful.',
      userMessage: 'Hi',
      tools: [],
      modelConfig: { provider: 'anthropic', model: 'test' },
    };

    const events = await collectEvents(config, adapter, registry);
    const types = events.map((e) => e.type);

    expect(types).toContain('turn_start');
    expect(types).toContain('llm_end');
    expect(types).toContain('done');
    expect(events.find((e) => e.type === 'done')).toHaveProperty('finalMessage', 'Hello!');
  });

  it('executes tool calls and continues the loop', async () => {
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'echo', arguments: { input: 'test' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
      { text: 'Done with tools.', toolCalls: [], usage: zeroUsage, stopReason: 'stop' },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo input',
      parameters: Type.Object({ input: Type.String() }),
      execute: vi.fn(async (params) => ({
        content: `echoed: ${(params as Record<string, string>).input}`,
        metadata: {},
        isError: false,
      })),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Use echo',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
    };

    const events = await collectEvents(config, adapter, registry);
    const types = events.map((e) => e.type);

    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types.filter((t) => t === 'turn_start')).toHaveLength(2);
    expect(events.find((e) => e.type === 'done')).toHaveProperty(
      'finalMessage',
      'Done with tools.',
    );
  });

  it('stops at maxTurns', async () => {
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'echo', arguments: { input: 'a' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
      {
        text: '',
        toolCalls: [{ id: 'tc-2', name: 'echo', arguments: { input: 'b' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
      {
        text: '',
        toolCalls: [{ id: 'tc-3', name: 'echo', arguments: { input: 'c' } }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo',
      parameters: Type.Object({ input: Type.String() }),
      execute: vi.fn(async () => ({ content: 'ok', metadata: {}, isError: false })),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Loop forever',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
      maxTurns: 2,
    };

    const events = await collectEvents(config, adapter, registry);
    const turnStarts = events.filter((e) => e.type === 'turn_start');

    expect(turnStarts.length).toBeLessThanOrEqual(2);
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('handles abort signal', async () => {
    const controller = new AbortController();
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'slow', arguments: {} }],
        usage: zeroUsage,
        stopReason: 'toolUse',
      },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'slow',
      description: 'Slow tool',
      parameters: Type.Object({}),
      execute: vi.fn(async () => {
        controller.abort();
        return { content: 'done', metadata: {}, isError: false };
      }),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Run slow',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
      signal: controller.signal,
    };

    const events = await collectEvents(config, adapter, registry);
    const lastEvent = events[events.length - 1];

    expect(lastEvent.type === 'error' || lastEvent.type === 'done').toBe(true);
  });

  it('aggregates token usage across turns', async () => {
    const usage1: TokenUsage = {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      total: 15,
      cost: { input: 0.01, output: 0.005, total: 0.015 },
    };
    const usage2: TokenUsage = {
      input: 20,
      output: 10,
      cacheRead: 0,
      cacheWrite: 0,
      total: 30,
      cost: { input: 0.02, output: 0.01, total: 0.03 },
    };
    const adapter = makeMockAdapter([
      {
        text: '',
        toolCalls: [{ id: 'tc-1', name: 'echo', arguments: { input: 'a' } }],
        usage: usage1,
        stopReason: 'toolUse',
      },
      { text: 'Final', toolCalls: [], usage: usage2, stopReason: 'stop' },
    ]);
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo',
      parameters: Type.Object({ input: Type.String() }),
      execute: vi.fn(async () => ({ content: 'ok', metadata: {}, isError: false })),
    });
    const config: LoopConfig = {
      systemPrompt: 'System',
      userMessage: 'Test',
      tools: registry.list() as never[],
      modelConfig: { provider: 'anthropic', model: 'test' },
    };

    const events = await collectEvents(config, adapter, registry);
    const doneEvent = events.find((e) => e.type === 'done') as Extract<
      AgentEvent,
      { type: 'done' }
    >;

    expect(doneEvent.totalUsage.total).toBe(45);
    expect(doneEvent.totalUsage.cost.total).toBeCloseTo(0.045);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/agent-runtime && pnpm test`
Expected: FAIL - module not found

**Step 3: Implement the conversation loop**

Create `packages/agent-runtime/src/loop.ts`:

```typescript
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
```

**Step 4: Add export**

In `packages/agent-runtime/src/index.ts`, add:

```typescript
export { agentLoop } from './loop.js';
```

Full `packages/agent-runtime/src/index.ts` should now be:

```typescript
export * from './types.js';
export { createLLMAdapter } from './llm/adapter.js';
export type { LLMAdapter, ChatMessage } from './llm/adapter.js';
export { ToolRegistry } from './tools/registry.js';
export {
  createShellExecTool,
  createFileReadTool,
  createFileWriteTool,
  createGitCloneTool,
  createGitCommitTool,
  createGitDiffTool,
} from './tools/index.js';
export { agentLoop } from './loop.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/agent-runtime && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/agent-runtime/src/loop.ts packages/agent-runtime/src/__tests__/loop.test.ts packages/agent-runtime/src/index.ts
git commit -m "feat(agent-runtime): implement async generator conversation loop"
```

---

### Task 7: Scaffold coordinator package

**Files:**
- Modify: `agents/coordinator/package.json`
- Create: `agents/coordinator/tsconfig.json`
- Create: `agents/coordinator/vitest.config.ts`
- Create: `agents/coordinator/src/index.ts`
- Create: `agents/coordinator/src/prompts/coordinator.ts`
- Create: `agents/coordinator/src/prompts/executor.ts`

**Step 1: Update package.json**

Replace `agents/coordinator/package.json`:

```json
{
  "name": "@kata/agent-coordinator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@kata/agent-runtime": "workspace:*",
    "@kata/shared": "workspace:*",
    "@kata/spec-engine": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "typescript": "^5.8.2",
    "vitest": "^3.2.4"
  }
}
```

**Step 2: Create tsconfig.json**

Create `agents/coordinator/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

**Step 3: Create vitest.config.ts**

Create `agents/coordinator/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

**Step 4: Create coordinator system prompt**

Create `agents/coordinator/src/prompts/coordinator.ts`:

```typescript
import type { Spec } from '@kata/shared';
import { serializeSpec } from '@kata/spec-engine';

export function buildCoordinatorPrompt(spec: Spec): {
  systemPrompt: string;
  userMessage: string;
} {
  const specYaml = serializeSpec(spec);

  const systemPrompt = `You are a Coordinator agent. Your job is to:

1. Read the spec provided by the user
2. Explore the codebase using file_read and shell_exec to understand the project structure
3. Decompose the spec into concrete, ordered tasks

Output a JSON array of tasks. Each task must have:
- "title": string - a clear, actionable title
- "description": string - what to do, which files to touch
- "dependsOn": number[] - indices of tasks this depends on (0-indexed)

Return ONLY the JSON array, no other text. Example:
[
  { "title": "Create database migration", "description": "Add new column...", "dependsOn": [] },
  { "title": "Update API endpoint", "description": "Modify the handler...", "dependsOn": [0] }
]`;

  const userMessage = `Here is the spec to decompose:\n\n${specYaml}`;

  return { systemPrompt, userMessage };
}
```

**Step 5: Create executor system prompt**

Create `agents/coordinator/src/prompts/executor.ts`:

```typescript
export function buildExecutorPrompt(
  taskTitle: string,
  taskDescription: string,
  taskIndex: number,
  totalTasks: number,
): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `You are an Executor agent. You are executing task ${taskIndex + 1} of ${totalTasks}.

Your job is to complete the task described by the user using the available tools:
- shell_exec: Run shell commands
- file_read: Read files
- file_write: Write files
- git_clone: Clone repositories
- git_commit: Stage and commit changes
- git_diff: View changes

Work methodically:
1. Read relevant files to understand context
2. Make the necessary changes
3. Verify your changes work (run tests if applicable)
4. Commit your changes with a clear message

When done, summarize what you did and any decisions you made.`;

  const userMessage = `Task: ${taskTitle}\n\nDescription: ${taskDescription}`;

  return { systemPrompt, userMessage };
}
```

**Step 6: Create placeholder index.ts**

Create `agents/coordinator/src/index.ts`:

```typescript
export { buildCoordinatorPrompt } from './prompts/coordinator.js';
export { buildExecutorPrompt } from './prompts/executor.js';
```

**Step 7: Install deps and verify**

Run: `pnpm install && cd agents/coordinator && pnpm typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add agents/coordinator/
git commit -m "feat(coordinator): scaffold package with prompt templates"
```

---

### Task 8: Implement coordinator orchestration

**Files:**
- Create: `agents/coordinator/src/coordinator.ts`
- Create: `agents/coordinator/src/executor.ts`
- Create: `agents/coordinator/src/__tests__/coordinator.test.ts`
- Modify: `agents/coordinator/src/index.ts`

**Step 1: Write the failing tests**

Create `agents/coordinator/src/__tests__/coordinator.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Spec, ModelConfig } from '@kata/shared';
import type { AgentEvent, TokenUsage } from '@kata/agent-runtime';

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
  title: 'Test feature',
  status: 'approved',
  meta: { version: 1, createdAt: now, updatedAt: now },
  intent: 'Build a test feature',
  constraints: ['Must be fast'],
  verification: { criteria: ['Tests pass'] },
  taskIds: [],
  decisions: [],
  blockers: [],
  createdBy: uuid,
};

const testModelConfig: ModelConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
};

vi.mock('@kata/agent-runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@kata/agent-runtime')>();
  return {
    ...original,
    createLLMAdapter: vi.fn(() => ({ complete: vi.fn() })),
    agentLoop: vi.fn(),
  };
});

import { agentLoop } from '@kata/agent-runtime';
import { runCoordinator } from '../coordinator.js';

const mockAgentLoop = vi.mocked(agentLoop);

function makeAsyncGen(events: AgentEvent[]): AsyncGenerator<AgentEvent> {
  return (async function* () {
    yield* events;
  })();
}

async function collectEvents(spec: Spec, config: ModelConfig): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of runCoordinator({
    spec,
    modelConfig: config,
    workspaceDir: '/tmp',
  })) {
    events.push(event);
  }
  return events;
}

describe('runCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs planning phase and produces tasks then executes them', async () => {
    const taskJson = JSON.stringify([
      { title: 'Create migration', description: 'Add column', dependsOn: [] },
    ]);

    mockAgentLoop
      .mockReturnValueOnce(
        makeAsyncGen([
          { type: 'turn_start', turnNumber: 1 },
          { type: 'llm_end', message: '', usage: zeroUsage },
          { type: 'done', finalMessage: taskJson, totalUsage: zeroUsage },
        ]),
      )
      .mockReturnValueOnce(
        makeAsyncGen([
          { type: 'turn_start', turnNumber: 1 },
          { type: 'llm_end', message: '', usage: zeroUsage },
          { type: 'done', finalMessage: 'Task completed.', totalUsage: zeroUsage },
        ]),
      );

    const events = await collectEvents(testSpec, testModelConfig);
    const types = events.map((e) => e.type);

    expect(types).toContain('turn_start');
    expect(types).toContain('done');
    expect(mockAgentLoop).toHaveBeenCalledTimes(2);
  });

  it('handles planning phase that returns invalid JSON', async () => {
    mockAgentLoop.mockReturnValueOnce(
      makeAsyncGen([
        { type: 'done', finalMessage: 'not valid json at all', totalUsage: zeroUsage },
      ]),
    );

    const events = await collectEvents(testSpec, testModelConfig);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
  });

  it('handles empty task list', async () => {
    mockAgentLoop.mockReturnValueOnce(
      makeAsyncGen([{ type: 'done', finalMessage: '[]', totalUsage: zeroUsage }]),
    );

    const events = await collectEvents(testSpec, testModelConfig);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
  });

  it('executes tasks in dependency order', async () => {
    const taskJson = JSON.stringify([
      { title: 'Task A', description: 'First', dependsOn: [] },
      { title: 'Task B', description: 'Depends on A', dependsOn: [0] },
    ]);

    mockAgentLoop
      .mockReturnValueOnce(
        makeAsyncGen([{ type: 'done', finalMessage: taskJson, totalUsage: zeroUsage }]),
      )
      .mockReturnValueOnce(
        makeAsyncGen([{ type: 'done', finalMessage: 'A done.', totalUsage: zeroUsage }]),
      )
      .mockReturnValueOnce(
        makeAsyncGen([{ type: 'done', finalMessage: 'B done.', totalUsage: zeroUsage }]),
      );

    const events = await collectEvents(testSpec, testModelConfig);

    expect(mockAgentLoop).toHaveBeenCalledTimes(3);
    expect(events.filter((e) => e.type === 'done')).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd agents/coordinator && pnpm test`
Expected: FAIL - module not found

**Step 3: Implement executor**

Create `agents/coordinator/src/executor.ts`:

```typescript
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
```

**Step 4: Implement coordinator**

Create `agents/coordinator/src/coordinator.ts`:

```typescript
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
```

**Step 5: Update index.ts**

Replace `agents/coordinator/src/index.ts`:

```typescript
export { runCoordinator } from './coordinator.js';
export type { CoordinatorConfig } from './coordinator.js';
export { runExecutor } from './executor.js';
export type { ExecutorConfig } from './executor.js';
export { buildCoordinatorPrompt } from './prompts/coordinator.js';
export { buildExecutorPrompt } from './prompts/executor.js';
```

**Step 6: Run tests to verify they pass**

Run: `cd agents/coordinator && pnpm test`
Expected: PASS

**Step 7: Commit**

```bash
git add agents/coordinator/src/coordinator.ts agents/coordinator/src/executor.ts agents/coordinator/src/__tests__/coordinator.test.ts agents/coordinator/src/index.ts
git commit -m "feat(coordinator): implement plan-then-execute orchestration"
```

---

### Task 9: Integration tests

**Files:**
- Create: `agents/coordinator/src/__tests__/integration.test.ts`

**Step 1: Write integration tests**

Create `agents/coordinator/src/__tests__/integration.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
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
      complete: vi.fn(async (systemPrompt: string, messages: unknown[]) => {
        callCount++;
        if (callCount === 1) {
          // Coordinator planning: return task list
          return {
            text: JSON.stringify([
              { title: 'Create hello.txt', description: 'Write Hello World to hello.txt', dependsOn: [] },
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
            toolCalls: [{
              id: 'tc-1',
              name: 'file_write',
              arguments: { path: 'hello.txt', content: 'Hello World' },
            }],
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
    expect(aIndex).toBeLessThan(bIndex);
    expect(aIndex).toBeLessThan(cIndex);
  });
});
```

**Step 2: Run tests**

Run: `cd agents/coordinator && pnpm test`
Expected: PASS

**Step 3: Commit**

```bash
git add agents/coordinator/src/__tests__/integration.test.ts
git commit -m "test(coordinator): add integration tests for plan-execute lifecycle"
```

---

### Task 10: E2E tests

**Files:**
- Create: `tests/e2e/agent-coordinator.test.ts`

**Step 1: Write E2E tests**

Create `tests/e2e/agent-coordinator.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createFileReadTool,
  createFileWriteTool,
  createShellExecTool,
  type WorkspaceContext,
} from '@kata/agent-runtime';

let workDir: string;
let ctx: WorkspaceContext;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'kata-e2e-'));
  ctx = { rootDir: workDir };
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('Tool safety: path traversal', () => {
  it('file_read rejects path traversal via ../', async () => {
    const tool = createFileReadTool(ctx);
    const result = await tool.execute({ path: '../../../etc/passwd' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/outside workspace/i);
  });

  it('file_write rejects path traversal', async () => {
    const tool = createFileWriteTool(ctx);
    const result = await tool.execute({
      path: '../../../tmp/malicious.txt',
      content: 'hacked',
    });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/outside workspace/i);
  });

  it('file_read rejects absolute path outside workspace', async () => {
    const tool = createFileReadTool(ctx);
    const result = await tool.execute({ path: '/etc/passwd' });
    expect(result.isError).toBe(true);
  });
});

describe('Tool safety: shell_exec', () => {
  it('uses workspace as cwd by default', async () => {
    const tool = createShellExecTool(ctx);
    const result = await tool.execute({ command: 'pwd' });
    expect(result.content.trim()).toBe(workDir);
  });

  it('respects timeout for long-running commands', async () => {
    const tool = createShellExecTool(ctx);
    const result = await tool.execute({ command: 'sleep 30', timeout: 500 });
    expect(result.isError).toBe(true);
  });
});

describe('Tool safety: oversized output', () => {
  it('file_read handles large files', async () => {
    const largeContent = 'x'.repeat(200_000);
    await writeFile(join(workDir, 'large.txt'), largeContent);

    const tool = createFileReadTool(ctx);
    const result = await tool.execute({ path: 'large.txt' });
    expect(result.isError).toBe(false);
    expect(result.content.length).toBe(200_000);
  });
});

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('Live LLM', () => {
  it(
    'coordinator decomposes a trivial spec into tasks',
    async () => {
      const { runCoordinator } = await import('@kata/agent-coordinator');
      const { AgentEvent } = await import('@kata/agent-runtime');

      const events: Array<Record<string, unknown>> = [];
      for await (const event of runCoordinator({
        spec: {
          id: '00000000-0000-4000-8000-000000000099',
          teamId: '00000000-0000-4000-8000-000000000099',
          title: 'Create hello.txt',
          status: 'approved' as const,
          meta: {
            version: 1,
            createdAt: '2026-02-27T00:00:00.000Z',
            updatedAt: '2026-02-27T00:00:00.000Z',
          },
          intent: 'Create a file named hello.txt containing the text Hello World',
          constraints: [],
          verification: { criteria: ['hello.txt contains Hello World'] },
          taskIds: [],
          decisions: [],
          blockers: [],
          createdBy: '00000000-0000-4000-8000-000000000099',
        },
        modelConfig: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        workspaceDir: workDir,
      })) {
        events.push(event as Record<string, unknown>);
      }

      // Verify at least one done event
      expect(events.some((e) => e.type === 'done')).toBe(true);

      // Cost cap
      const doneEvents = events.filter((e) => e.type === 'done');
      for (const done of doneEvents) {
        const usage = done.totalUsage as Record<string, unknown>;
        const cost = usage?.cost as Record<string, number>;
        if (cost) {
          expect(cost.total).toBeLessThan(0.5);
        }
      }
    },
    { timeout: 60_000 },
  );
});
```

**Step 2: Run tests**

Run: `pnpm vitest run tests/e2e/agent-coordinator.test.ts`
Expected: PASS (tool safety tests run, live LLM skipped without API key)

**Step 3: Commit**

```bash
git add tests/e2e/agent-coordinator.test.ts
git commit -m "test(e2e): add agent coordinator safety and live LLM tests"
```

---

### Task 11: Final verification and cleanup

**Step 1: Run full test suite**

Run: `pnpm turbo test`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `pnpm turbo lint`
Expected: No errors. Fix any that appear.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and type errors from agent runtime implementation"
```
