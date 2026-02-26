import type { MiddlewareHandler } from 'hono';

export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.set('startedAtMs', Date.now());
  try {
    await next();
  } finally {
    c.header('x-request-id', requestId);
  }
};
