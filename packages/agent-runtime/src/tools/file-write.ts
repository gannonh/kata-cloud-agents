import { writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

function resolveSafe(rootDir: string, filePath: string): string | null {
  const resolved = resolve(rootDir, filePath);
  const rel = relative(rootDir, resolved);
  if (rel.startsWith('..') || resolve(rootDir, rel) !== resolved) {
    return null;
  }
  return resolved;
}

function isWithinWorkspace(rootDir: string, candidate: string): boolean {
  const rel = relative(rootDir, candidate);
  return rel !== '..' && !rel.startsWith(`..${sep}`);
}

export function createFileWriteTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'file_write',
    description: 'Write content to a file within the workspace',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to workspace root' }),
      content: Type.String({ description: 'Content to write' }),
      createDirs: Type.Optional(
        Type.Boolean({ description: 'Create parent directories if needed', default: false }),
      ),
    }),
    async execute(params) {
      const filePath = params.path as string;
      const content = params.content as string;
      const createDirs = (params.createDirs as boolean) ?? false;

      const resolved = resolveSafe(ctx.rootDir, filePath);
      if (!resolved) {
        return {
          content: `Path "${filePath}" resolves outside workspace root`,
          metadata: {},
          isError: true,
        };
      }

      try {
        const workspaceRoot = await realpath(ctx.rootDir);

        if (createDirs) {
          await mkdir(dirname(resolved), { recursive: true });
        }

        const resolvedDir = await realpath(dirname(resolved));
        if (!isWithinWorkspace(workspaceRoot, resolvedDir)) {
          return {
            content: `Path "${filePath}" resolves outside workspace root`,
            metadata: {},
            isError: true,
          };
        }

        try {
          const stat = await lstat(resolved);
          if (stat.isSymbolicLink()) {
            return {
              content: `Refusing to write through symlink: "${filePath}"`,
              metadata: {},
              isError: true,
            };
          }
        } catch {
          // Ignore missing file; writing a new file is allowed.
        }

        await writeFile(resolved, content, 'utf-8');
        return {
          content: `Written ${Buffer.byteLength(content)} bytes to ${filePath}`,
          metadata: { path: resolved, bytes: Buffer.byteLength(content) },
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Failed to write file: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
