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
        exec(
          command,
          { cwd, timeout, env: { ...process.env, ...ctx.env, PWD: cwd } },
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
