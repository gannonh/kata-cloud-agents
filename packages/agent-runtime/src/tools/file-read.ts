import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { Type } from '@sinclair/typebox';
import type { AgentTool, WorkspaceContext } from '../types.js';

const ALLOWED_ENCODINGS = new Set<BufferEncoding>([
  'utf8',
  'utf-8',
  'ascii',
  'latin1',
  'binary',
  'base64',
  'base64url',
  'hex',
  'ucs2',
  'ucs-2',
  'utf16le',
  'utf-16le',
]);

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
      const encodingInput = typeof params.encoding === 'string' ? params.encoding : 'utf-8';

      if (!ALLOWED_ENCODINGS.has(encodingInput as BufferEncoding)) {
        return {
          content: `Unsupported encoding "${encodingInput}"`,
          metadata: {},
          isError: true,
        };
      }
      const encoding = encodingInput as BufferEncoding;

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
        const resolvedPath = await realpath(resolved);
        if (!isWithinWorkspace(workspaceRoot, resolvedPath)) {
          return {
            content: `Path "${filePath}" resolves outside workspace root`,
            metadata: {},
            isError: true,
          };
        }

        const content = await readFile(resolvedPath, encoding);
        return {
          content,
          metadata: { path: resolvedPath, bytes: Buffer.byteLength(content) },
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Failed to read file: ${message}`, metadata: {}, isError: true };
      }
    },
  };
}
