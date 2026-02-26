import { describe, expect, it, vi } from 'vitest';
import { resolvePrincipal } from '../auth/resolve-principal.js';

function makeDeps() {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
    apiKeyAuth: {
      validateApiKey: vi.fn(async (key: string) =>
        key === 'kat_live_1' ? { teamId: 't1', keyId: 'k1' } : null,
      ),
    },
    sessionStore: {
      getSession: vi.fn(async (sessionId: string) =>
        sessionId === 'sid_ok'
          ? { userId: 'u1', teamId: 't1', expiresAt: '2099-01-01T00:00:00.000Z' }
          : null,
      ),
    },
    now: () => new Date('2026-02-26T00:00:00.000Z'),
  };
}

describe('resolvePrincipal', () => {
  it('resolves api key principal', async () => {
    const result = await resolvePrincipal({ apiKey: 'kat_live_1', sessionId: null }, makeDeps());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.principal.type).toBe('api_key');
    }
  });

  it('resolves session principal', async () => {
    const result = await resolvePrincipal({ apiKey: null, sessionId: 'sid_ok' }, makeDeps());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.principal.type).toBe('session_user');
    }
  });

  it('returns auth required with no credentials', async () => {
    const result = await resolvePrincipal({ apiKey: null, sessionId: null }, makeDeps());
    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
    });
  });
});
