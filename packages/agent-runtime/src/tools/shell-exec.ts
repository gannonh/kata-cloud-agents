import { exec } from 'node:child_process';
import { resolve, relative, sep } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

const DEFAULT_TIMEOUT = 30_000;

const BLOCKED_COMMAND_PATTERNS = [
  /\brm\s+-[^\n]*\brf\b[^\n]*\s+\/(\s|$|\*)/i,
  /rm\$\{ifs\}-rf\$\{ifs\}\//i,
  /\bmkfs(\.[\w-]+)?\b/i,
  /\bdd\s+if=\/dev\/zero\b/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
];

function buildExecEnv(cwd: string, ctxEnv?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    PWD: cwd,
  };

  if (process.env.LANG) env.LANG = process.env.LANG;
  if (process.env.LC_ALL) env.LC_ALL = process.env.LC_ALL;
  if (process.env.TERM) env.TERM = process.env.TERM;
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;

  return { ...env, ...(ctxEnv ?? {}) };
}

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
    async execute(params, signal) {
      const command = params.command as string;
      const timeout = (params.timeout as number) ?? DEFAULT_TIMEOUT;
      const cwdInput = typeof params.cwd === 'string' ? params.cwd : '.';
      const cwd = resolve(ctx.rootDir, cwdInput);
      const rel = relative(ctx.rootDir, cwd);

      if (rel === '..' || rel.startsWith(`..${sep}`)) {
        return { content: 'cwd resolves outside workspace root', metadata: {}, isError: true };
      }

      const normalized = command.toLowerCase().replaceAll('${ifs}', ' ');
      if (BLOCKED_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
        return { content: 'Command blocked for safety', metadata: {}, isError: true };
      }

      return new Promise((resolve) => {
        exec(
          command,
          { cwd, timeout, signal, env: buildExecEnv(cwd, ctx.env) },
          (error, stdout, stderr) => {
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
          },
        );
      });
    },
  };
}
