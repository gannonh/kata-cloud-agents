import type { ApiKeyAuthAdapter } from '../types.js';

export function createInMemoryApiKeyAdapter(
  keys: Record<string, { teamId: string; keyId: string }>,
): ApiKeyAuthAdapter {
  return {
    async validateApiKey(rawKey: string) {
      return keys[rawKey] ?? null;
    },
  };
}
