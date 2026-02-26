export type Logger = {
  info: (meta: Record<string, unknown>, message: string) => void;
  error: (meta: Record<string, unknown>, message: string) => void;
};

export type ApiKeyPrincipal = {
  type: 'api_key';
  teamId: string;
  keyId: string;
  scopes?: string[];
};

export type SessionPrincipal = {
  type: 'session_user';
  teamId: string;
  userId: string;
};

export type AuthPrincipal = ApiKeyPrincipal | SessionPrincipal;

export type ApiKeyAuthAdapter = {
  validateApiKey: (rawKey: string) => Promise<{ teamId: string; keyId: string; scopes?: string[] } | null>;
};

export type SessionStoreAdapter = {
  getSession: (sessionId: string) => Promise<{ userId: string; teamId: string; expiresAt: string } | null>;
};

export type GatewayConfig = {
  port: number;
  allowedOrigins: string[];
  sessionCookieName: string;
  sessionCookieSecret: string;
  redisUrl: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
};

export type GatewayDeps = {
  logger: Logger;
  apiKeyAuth: ApiKeyAuthAdapter;
  sessionStore: SessionStoreAdapter;
  now: () => Date;
};
