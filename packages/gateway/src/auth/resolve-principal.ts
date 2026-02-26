import type { AuthResolution, GatewayDeps } from '../types.js';

/**
 * Resolve request credentials to a principal.
 * API keys take precedence over sessions when both are present.
 */
export async function resolvePrincipal(
  credentials: { apiKey: string | null; sessionId: string | null },
  deps: Pick<GatewayDeps, 'apiKeyAuth' | 'sessionStore' | 'logger' | 'now'>,
): Promise<AuthResolution> {
  const { apiKey, sessionId } = credentials;

  if (apiKey) {
    try {
      const keyPrincipal = await deps.apiKeyAuth.validateApiKey(apiKey);
      if (!keyPrincipal) {
        return {
          ok: false,
          status: 401,
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        };
      }
      return {
        ok: true,
        principal: {
          type: 'api_key',
          ...keyPrincipal,
        },
      };
    } catch (err) {
      deps.logger.error({ err }, 'api key auth error');
      return {
        ok: false,
        status: 503,
        code: 'AUTH_SERVICE_UNAVAILABLE',
        message: 'Authentication service unavailable',
      };
    }
  }

  if (!sessionId) {
    return {
      ok: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    };
  }

  try {
    const session = await deps.sessionStore.getSession(sessionId);
    if (!session) {
      return {
        ok: false,
        status: 401,
        code: 'INVALID_SESSION',
        message: 'Invalid session',
      };
    }

    const expiresAtMs = Date.parse(session.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= deps.now().getTime()) {
      return {
        ok: false,
        status: 401,
        code: 'SESSION_EXPIRED',
        message: 'Session expired',
      };
    }

    return {
      ok: true,
      principal: {
        type: 'session_user',
        teamId: session.teamId,
        userId: session.userId,
      },
    };
  } catch (err) {
    deps.logger.error({ err, sessionId }, 'session auth error');
    return {
      ok: false,
      status: 503,
      code: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'Authentication service unavailable',
    };
  }
}
