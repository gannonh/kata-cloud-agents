# KAT-115: Single-Agent Coordinator - Design

**Date:** 2026-02-27
**Status:** Approved
**Milestone:** M1: Spec Engine + Single Agent
**Blocked by:** KAT-111 (Done)
**Blocks:** KAT-116 (Agent dispatch pipeline)

## Overview

Build the agent runtime infrastructure and coordinator agent. The runtime provides LLM abstraction (via pi-ai), a tool registry, a conversation loop, and a structured event stream. The coordinator reads a spec, explores the codebase, decomposes work into tasks, then dispatches an executor sub-agent per task.

## Key Decisions

- **LLM layer:** Adopt `@mariozechner/pi-ai` for multi-provider LLM abstraction + streaming. Build our own agent loop (~200 LOC) on top. Do not adopt `pi-agent-core` (avoid v0.x churn).
- **Agent model:** Coordinator plans + Executor executes. Both have full tool access. Coordinator uses tools to explore the codebase during planning. Executor receives one task at a time.
- **Tools:** All 6 first-class tools with typed parameters: shell_exec, file_read, file_write, git_clone, git_commit, git_diff.
- **Execution:** Coordinator explores via tools, decomposes into tasks, then dispatches executor sub-agent per task in dependency order.
- **Events:** Structured event stream (typed discriminated union). Maps to WebSocket broadcast for UI integration.

## Package Structure

### packages/agent-runtime/

Core infrastructure, no business logic.

- `src/llm/adapter.ts` - Wraps pi-ai's `streamSimple()`/`completeSimple()`. Resolves `ModelConfig` to pi-ai `Model`. Returns `LLMResponse` with assistant message, tool calls, usage stats, stop reason.
- `src/tools/registry.ts` - Register, validate (AJV + TypeBox), and execute tools. Each tool returns `{ content: string, metadata: Record<string, unknown> }`.
- `src/loop.ts` - `agentLoop()` async generator: system prompt -> user message -> tool calls -> response -> repeat. Terminates on: no tool calls, max turns, or abort signal.
- `src/events.ts` - `AgentEvent` discriminated union for progress reporting.
- `src/tools/` - 6 built-in tool implementations.

Dependencies: `@mariozechner/pi-ai`, `@sinclair/typebox`, `ajv`

### agents/coordinator/

Coordinator role using the runtime.

- `src/coordinator.ts` - Orchestration: plan phase (explore + decompose) then execute phase (dispatch executor per task).
- `src/executor.ts` - Executor role config: task-scoped system prompt, same tool set, returns `TaskResult`.
- `src/prompts/` - System prompt templates for coordinator and executor roles.

Dependencies: `@kata/agent-runtime`, `@kata/spec-engine`, `@kata/shared`

## Agent Runtime Core

### LLM Adapter

Wraps pi-ai for provider-agnostic LLM calls. Accepts `ModelConfig` from `@kata/shared` (provider, model, temperature, maxTokens). Resolves to pi-ai `Model` via `getModel(provider, model)`. API keys resolved from environment variables per provider.

### Tool Registry

- `register(tool)` - Register with name, description, TypeBox parameter schema, execute function
- `execute(name, params, signal?)` - Validate params, execute, return ToolResult
- `list()` - Returns tool definitions for LLM tool_use parameter
- Tools receive `WorkspaceContext` (root directory, env vars) at registration time

### Conversation Loop

```typescript
async function* agentLoop(config: LoopConfig): AsyncGenerator<AgentEvent>
```

Config: system prompt, tools, model config, max turns, abort signal. Each iteration sends messages to LLM, executes tool calls, yields events, appends results, repeats. The caller drives the loop via the async generator.

### Event Types

```typescript
type AgentEvent =
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'llm_start'; model: string }
  | { type: 'llm_chunk'; delta: string }
  | { type: 'llm_end'; message: string; usage: TokenUsage }
  | { type: 'tool_call'; toolName: string; params: unknown }
  | { type: 'tool_result'; toolName: string; content: string; metadata: Record<string, unknown> }
  | { type: 'turn_end'; turnNumber: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; finalMessage: string; totalUsage: TokenUsage }
```

## Tool Implementations

All tools in `packages/agent-runtime/src/tools/`. Each exports a factory function returning an `AgentTool`.

| Tool | Params | Safety |
|---|---|---|
| shell_exec | command, cwd?, timeout? | Command blocklist, 30s default timeout |
| file_read | path, encoding? | Path must be within workspace root |
| file_write | path, content, createDirs? | Path within workspace root |
| git_clone | url, dest?, branch?, depth? | Shallow default (depth=1), dest within workspace |
| git_commit | message, files?, all? | No force operations, no amend |
| git_diff | path?, staged?, ref? | Read-only |

All tools enforce workspace sandboxing. Path traversal outside the workspace root is rejected.

## Coordinator Agent

### Phase 1 - Plan

Coordinator receives parsed Spec as initial user message. System prompt instructs it to:
1. Explore the codebase using file_read and shell_exec
2. Produce a structured task decomposition

Output: array of Task objects with titles, descriptions, dependency ordering, acceptance criteria.

### Phase 2 - Execute

For each task in dependency order, the coordinator spawns an Executor sub-agent:
- Executor receives task-scoped system prompt ("You are executing task N of M: {task.title}")
- Same tool set as coordinator
- Works until completion or failure
- Returns TaskResult with status, artifacts, decisions

After all tasks complete (or on failure), the coordinator serializes the updated spec via `serializeSpec()`. The caller (gateway dispatch pipeline, KAT-116) persists the result.

### Public API

```typescript
async function* runCoordinator(config: {
  spec: Spec;
  modelConfig: ModelConfig;
  workspaceDir: string;
  abortSignal?: AbortSignal;
}): AsyncGenerator<AgentEvent>
```

Events include `phase: 'plan' | 'execute'` and `taskIndex` during execution.

## Testing Strategy

### Unit Tests

- **LLM adapter:** Mock pi-ai. Test message formatting, tool call extraction, token aggregation, error handling.
- **Tool registry:** Register/execute, parameter validation, workspace path sandboxing.
- **Individual tools:** Each against temp directory. Path traversal, command injection, git ops against temp repo.
- **Conversation loop:** Mock LLM. Turn progression, tool cycling, max turns, abort, event ordering.

### Integration Tests

- **Planning phase:** Mock LLM returns task list. Verify tasks created with correct dependencies.
- **Execution phase:** Mock LLM tool calls for executor. Verify dependency-order execution.
- **Full flow:** Mock LLM for both phases. Spec in -> tasks decomposed -> executed -> spec out.

### E2E Tests

- **Live LLM call** (CI-gated behind API key): Simple spec -> coordinator -> task list + execution attempt. Timeout and cost cap.
- **Tool safety:** Path traversal, command injection, oversized output. All rejected.
