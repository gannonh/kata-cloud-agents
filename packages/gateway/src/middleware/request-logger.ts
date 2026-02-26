import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../types.js';

export function requestLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const startedAtMs = Number(c.get('startedAtMs') ?? Date.now());
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - startedAtMs,
      },
      'request completed',
    );
  };
}
