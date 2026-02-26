import { isIP } from 'node:net';
import type { MiddlewareHandler } from 'hono';
import { jsonError } from './error-handler.js';

function normalizeIp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return isIP(trimmed) ? trimmed : null;
}

export function createRateLimitMiddleware(windowMs: number, maxRequests: number): MiddlewareHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.max(windowMs, 1000));
  cleanupInterval.unref();

  return async (c, next) => {
    const now = Date.now();
    const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0];
    const ip = normalizeIp(forwardedFor) ?? normalizeIp(c.req.header('x-real-ip')) ?? 'unknown';
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
