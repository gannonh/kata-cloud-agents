import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { jsonError } from './error-handler.js';
import { resolvePrincipal } from '../auth/resolve-principal.js';
import type { GatewayConfig, GatewayDeps } from '../types.js';

export function authMiddleware(config: GatewayConfig, deps: GatewayDeps): MiddlewareHandler {
  return async (c, next) => {
    const result = await resolvePrincipal(
      {
        apiKey: c.req.header('x-api-key') ?? null,
        sessionId: getCookie(c, config.sessionCookieName) ?? null,
      },
      deps,
    );

    if (!result.ok) {
      return jsonError(c, result.status, result.code, result.message);
    }

    c.set('principal', result.principal);
    return next();
  };
}
