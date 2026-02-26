import type { MiddlewareHandler } from 'hono';
import { jsonError } from './error-handler.js';

export function createRateLimitMiddleware(windowMs: number, maxRequests: number): MiddlewareHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const now = Date.now();
    const ip = c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `${ip}:${c.req.path}`;

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return jsonError(c, 429, 'RATE_LIMITED', 'Too many requests');
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}
