import type { ApiKeyAuthAdapter } from '../types.js';

export function createInMemoryApiKeyAdapter(
  keys: Record<string, { teamId: string; keyId: string }>,
): ApiKeyAuthAdapter {
  const keyMap = new Map(Object.entries(keys));

  return {
    async validateApiKey(rawKey: string) {
      return keyMap.get(rawKey) ?? null;
    },
  };
}
