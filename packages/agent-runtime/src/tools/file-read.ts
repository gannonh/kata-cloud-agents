import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
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

export function createFileReadTool(ctx: WorkspaceContext): AgentTool {
  return {
    name: 'file_read',
    description: 'Read the contents of a file within the workspace',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to workspace root' }),
      encoding: Type.Optional(Type.String({ description: 'File encoding', default: 'utf-8' })),
    }),
    async execute(params) {
      const filePath = params.path as string;
      const encoding = (params.encoding as BufferEncoding) ?? 'utf-8';

      const resolved = resolveSafe(ctx.rootDir, filePath);
      if (!resolved) {
        return {
          content: `Path "${filePath}" resolves outside workspace root`,
          metadata: {},
          isError: true,
        };
      }

      try {
        const content = await readFile(resolved, encoding);
        return {
          content,
          metadata: { path: resolved, bytes: Buffer.byteLength(content) },
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Failed to read file: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
