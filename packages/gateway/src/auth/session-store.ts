import Redis from 'ioredis';
import type { SessionStoreAdapter } from '../types.js';

export function createRedisSessionStore(redisUrl: string): SessionStoreAdapter {
  const redis = new Redis(redisUrl, { lazyConnect: true });

  return {
    async getSession(sessionId: string) {
      if (redis.status === 'wait') {
        await redis.connect();
      }
      const raw = await redis.get(`session:${sessionId}`);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as { userId: string; teamId: string; expiresAt: string };
    },
  };
}
