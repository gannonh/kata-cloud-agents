import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
