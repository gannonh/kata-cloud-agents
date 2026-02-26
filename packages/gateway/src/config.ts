import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import type { GatewayConfig } from './types.js';

const EnvSchema = z.object({
  GATEWAY_PORT: z.coerce.number().int().positive().default(3001),
  GATEWAY_ALLOWED_ORIGINS: z.string().default('http://localhost:1420,http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().min(1).default('kata.sid'),
  REDIS_URL: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
});

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  if (env === process.env) {
    loadEnv();
  }

  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid gateway configuration:\n${missing}`);
  }
  const parsed = result.data;
  return {
    port: parsed.GATEWAY_PORT,
    allowedOrigins: parsed.GATEWAY_ALLOWED_ORIGINS.split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    redisUrl: parsed.REDIS_URL,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: parsed.RATE_LIMIT_MAX_REQUESTS,
  };
}
