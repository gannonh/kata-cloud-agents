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
