import Redis from 'ioredis';
import { z } from 'zod';
import type { SessionStoreAdapter } from '../types.js';

const SessionSchema = z.object({
  userId: z.string().min(1),
  teamId: z.string().min(1),
  expiresAt: z.string().min(1),
});

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
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(raw);
      } catch {
        return null;
      }

      const parsedSession = SessionSchema.safeParse(parsedRaw);
      if (!parsedSession.success) {
        return null;
      }

      const expiresAtMs = Date.parse(parsedSession.data.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        return null;
      }

      return parsedSession.data;
    },
  };
}
