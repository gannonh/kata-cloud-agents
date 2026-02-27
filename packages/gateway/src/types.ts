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
  | 'HTTP_ERROR'
  | 'VALIDATION_ERROR';

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
      status: 401;
      code: 'INVALID_API_KEY' | 'AUTH_REQUIRED' | 'INVALID_SESSION' | 'SESSION_EXPIRED';
      message: string;
    }
  | {
      ok: false;
      status: 503;
      code: 'AUTH_SERVICE_UNAVAILABLE';
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

export type VersionStoreVersionRecord = {
  id: string;
  specId: string;
  versionNumber: number;
  content: Record<string, unknown>;
  actorId: string;
  actorType: string;
  changeSummary: string;
  createdAt: Date;
};

export type VersionStoreAdapter = {
  getSpec: (specId: string) => Promise<{ id: string; teamId: string; content: Record<string, unknown> } | null>;
  updateSpecContent: (specId: string, content: Record<string, unknown>) => Promise<void>;
  createVersion: (data: {
    specId: string;
    versionNumber: number;
    content: Record<string, unknown>;
    actorId: string;
    actorType: 'user' | 'agent';
    changeSummary: string;
  }) => Promise<VersionStoreVersionRecord>;
  getVersion: (specId: string, versionNumber: number) => Promise<VersionStoreVersionRecord | null>;
  listVersions: (specId: string, limit: number, offset: number) => Promise<{ items: VersionStoreVersionRecord[]; total: number }>;
  getMaxVersionNumber: (specId: string) => Promise<number>;
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
  versionStore?: VersionStoreAdapter;
  now: () => Date;
};

export type GatewayVars = {
  requestId: string;
  startedAtMs: number;
  principal?: AuthPrincipal;
};

export type GatewayEnv = { Variables: GatewayVars };
