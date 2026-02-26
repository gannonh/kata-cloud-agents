export type Logger = {
  info: (meta: Record<string, unknown>, message: string) => void;
  error: (meta: Record<string, unknown>, message: string) => void;
};

export type ErrorCode =
  | 'INVALID_API_KEY'
  | 'AUTH_REQUIRED'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'HTTP_ERROR';

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

export type AuthResolution =
  | { ok: true; principal: AuthPrincipal }
  | {
      ok: false;
      status: 401 | 503;
      code: 'INVALID_API_KEY' | 'AUTH_REQUIRED' | 'INVALID_SESSION' | 'SESSION_EXPIRED' | 'AUTH_SERVICE_UNAVAILABLE';
      message: string;
    };

export type ApiKeyIdentity = Omit<ApiKeyPrincipal, 'type'>;

export type SessionData = {
  userId: string;
  teamId: string;
  expiresAt: string;
};

export type ApiKeyAuthAdapter = {
  validateApiKey: (rawKey: string) => Promise<ApiKeyIdentity | null>;
};

export type SessionStoreAdapter = {
  getSession: (sessionId: string) => Promise<SessionData | null>;
};

export type ChannelAccessAdapter = {
  resolveSpecTeamId: (specId: string) => Promise<string | null>;
  resolveAgentTeamId: (agentId: string) => Promise<string | null>;
};

export type GatewayConfig = {
  port: number;
  allowedOrigins: string[];
  sessionCookieName: string;
  redisUrl: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  wsHeartbeatIntervalMs: number;
  wsHeartbeatTimeoutMs: number;
  wsMaxSubscriptionsPerConnection: number;
};

export type GatewayDeps = {
  logger: Logger;
  apiKeyAuth: ApiKeyAuthAdapter;
  sessionStore: SessionStoreAdapter;
  channelAccess?: ChannelAccessAdapter;
  now: () => Date;
};

export type GatewayVars = {
  requestId: string;
  startedAtMs: number;
  principal?: AuthPrincipal;
};

export type GatewayEnv = { Variables: GatewayVars };
