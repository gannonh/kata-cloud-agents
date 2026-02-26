import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { jsonError } from './error-handler.js';
import type { GatewayConfig, GatewayDeps } from '../types.js';

export function authMiddleware(config: GatewayConfig, deps: GatewayDeps): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = c.req.header('x-api-key');
    if (apiKey) {
      try {
        const keyPrincipal = await deps.apiKeyAuth.validateApiKey(apiKey);
        if (!keyPrincipal) {
          return jsonError(c, 401, 'INVALID_API_KEY', 'Invalid API key');
        }
        c.set('principal', { type: 'api_key', ...keyPrincipal });
        return next();
      } catch (err) {
        deps.logger.error({ err }, 'api key auth error');
        return jsonError(c, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication service unavailable');
      }
    }

    const sessionId = getCookie(c, config.sessionCookieName);
    if (!sessionId) {
      return jsonError(c, 401, 'AUTH_REQUIRED', 'Authentication required');
    }

    try {
      const session = await deps.sessionStore.getSession(sessionId);
      if (!session) {
        return jsonError(c, 401, 'INVALID_SESSION', 'Invalid session');
      }
      const expiresAtMs = Date.parse(session.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= deps.now().getTime()) {
        return jsonError(c, 401, 'SESSION_EXPIRED', 'Session expired');
      }
      c.set('principal', {
        type: 'session_user',
        teamId: session.teamId,
        userId: session.userId,
      });
      return next();
    } catch (err) {
      deps.logger.error({ err, sessionId }, 'session auth error');
      return jsonError(c, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Authentication service unavailable');
    }
  };
}
