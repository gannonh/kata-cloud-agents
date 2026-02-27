import { execFile } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

export function createGitCloneTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'git_clone',
    description: 'Clone a git repository into the workspace',
    parameters: Type.Object({
      url: Type.String({ description: 'Repository URL or local path' }),
      dest: Type.Optional(
        Type.String({ description: 'Destination directory (relative to workspace)' }),
      ),
      branch: Type.Optional(Type.String({ description: 'Branch to clone' })),
      depth: Type.Optional(Type.Number({ description: 'Shallow clone depth', default: 1 })),
    }),
    async execute(params, signal) {
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

      const gitArgs = ['clone'];
      if (depth > 0) gitArgs.push(`--depth=${depth}`);
      if (branch) gitArgs.push('--branch', branch);
      gitArgs.push(url, destPath);

      return new Promise((resolvePromise) => {
        execFile(
          'git',
          gitArgs,
          { cwd: ctx.rootDir, timeout: 120_000, signal },
          (error, _stdout, stderr) => {
            if (error) {
              resolvePromise({
                content: `Clone failed: ${stderr || error.message}`,
                metadata: {},
                isError: true,
              });
              return;
            }
            resolvePromise({
              content: `Cloned ${url} to ${dest}`,
              metadata: { path: destPath },
              isError: false,
            });
          },
        );
      });
    },
  };
}
