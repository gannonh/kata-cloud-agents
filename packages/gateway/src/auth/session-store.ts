import Redis from 'ioredis';
import { z } from 'zod';
import type { Logger, SessionStoreAdapter } from '../types.js';

const SessionSchema = z.object({
  userId: z.string().min(1),
  teamId: z.string().min(1),
  expiresAt: z.string().min(1),
});

export function createRedisSessionStore(redisUrl: string, logger: Logger): SessionStoreAdapter {
  const redis = new Redis(redisUrl, { lazyConnect: true });
  let connectPromise: Promise<void> | null = null;

  async function ensureConnected() {
    if (redis.status === 'ready') return;
    if (!connectPromise) {
      connectPromise = redis.connect().finally(() => {
        connectPromise = null;
      });
    }
    await connectPromise;
  }

  return {
    async getSession(sessionId: string) {
      await ensureConnected();
      const raw = await redis.get(`session:${sessionId}`);
      if (!raw) {
        return null;
      }
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(raw);
      } catch (err) {
        logger.error({ sessionId, err }, 'session JSON parse failure');
        return null;
      }

      const parsedSession = SessionSchema.safeParse(parsedRaw);
      if (!parsedSession.success) {
        logger.error({ sessionId, issues: parsedSession.error.issues }, 'session schema validation failure');
        return null;
      }

      // Expiry is enforced by auth middleware using the injectable clock
      return parsedSession.data;
    },
  };
}
