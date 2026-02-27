import { execFileSync } from 'node:child_process';
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
          execFileSync('git', ['add', '-A'], { cwd: ctx.rootDir });
        } else if (files && files.length > 0) {
          execFileSync('git', ['add', '--', ...files], { cwd: ctx.rootDir });
        }

        const result = execFileSync('git', ['commit', '-F', '-'], {
          cwd: ctx.rootDir,
          encoding: 'utf-8',
          input: message,
        });

        const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
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
