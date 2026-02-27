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
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { content: `Commit failed: ${errorMessage}`, metadata: {}, isError: true };
      }
    },
  };
}
