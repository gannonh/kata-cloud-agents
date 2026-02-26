import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../types.js';

export function requestLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const fallbackStartedAtMs = Date.now();
    try {
      await next();
    } finally {
      const startedAtFromContext = c.get('startedAtMs');
      const startedAtMs =
        typeof startedAtFromContext === 'number' && Number.isFinite(startedAtFromContext)
          ? startedAtFromContext
          : fallbackStartedAtMs;

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
    }
  };
}
