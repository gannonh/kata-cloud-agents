import { execFileSync } from 'node:child_process';
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
        const gitArgs = ['diff'];
        if (staged) gitArgs.push('--staged');
        if (ref) gitArgs.push(ref);
        if (path) gitArgs.push('--', path);

        const output = execFileSync('git', gitArgs, {
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
