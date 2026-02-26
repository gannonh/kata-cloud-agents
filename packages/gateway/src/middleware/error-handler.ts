import type { Context } from 'hono';

export function jsonError(c: Context, status: number, code: string, message: string) {
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
