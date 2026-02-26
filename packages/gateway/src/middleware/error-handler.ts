import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '../types.js';

export function jsonError(c: Context, status: ContentfulStatusCode, code: ErrorCode, message: string) {
  return c.json(
    {
      error: {
        code,
        message,
        requestId: c.get('requestId') ?? 'unknown',
      },
    },
    status,
  );
}
