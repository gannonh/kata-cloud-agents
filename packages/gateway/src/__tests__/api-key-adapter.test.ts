import { describe, expect, it } from 'vitest';
import { createInMemoryApiKeyAdapter } from '../auth/api-key-adapter.js';

describe('in-memory api key adapter', () => {
  it('returns configured key details for known keys', async () => {
    const adapter = createInMemoryApiKeyAdapter({
      kat_live_123: { teamId: 'team-1', keyId: 'key-1' },
    });

    await expect(adapter.validateApiKey('kat_live_123')).resolves.toEqual({
      teamId: 'team-1',
      keyId: 'key-1',
    });
  });

  it('rejects prototype-chain key lookups', async () => {
    const adapter = createInMemoryApiKeyAdapter({
      kat_live_123: { teamId: 'team-1', keyId: 'key-1' },
    });

    await expect(adapter.validateApiKey('__proto__')).resolves.toBeNull();
    await expect(adapter.validateApiKey('constructor')).resolves.toBeNull();
  });
});
