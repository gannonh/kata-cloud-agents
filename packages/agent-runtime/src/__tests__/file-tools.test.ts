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
