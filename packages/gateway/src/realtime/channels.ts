import type { AuthPrincipal, ChannelAccessAdapter } from '../types.js';

export type RealtimeChannel =
  | { kind: 'team'; id: string }
  | { kind: 'spec'; id: string }
  | { kind: 'agent'; id: string };

export type ChannelAuthorizationResult =
  | { ok: true }
  | { ok: false; reason: 'FORBIDDEN' | 'INVALID_CHANNEL' | 'UNAVAILABLE' };

export function parseChannel(value: string): RealtimeChannel | null {
  const parts = value.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [kind, rawId] = parts;
  const id = rawId.trim();
  if (!id) {
    return null;
  }

  if (kind === 'team' || kind === 'spec' || kind === 'agent') {
    return { kind, id };
  }

  return null;
}

/**
 * Authorize a channel subscription against the authenticated principal.
 *
 * team:{teamId}: direct team equality check
 * spec:{specId}: resolved via access adapter, then matched to principal team
 * agent:{agentId}: resolved via access adapter, then matched to principal team
 */
export async function authorizeChannel(
  rawChannel: string,
  principal: AuthPrincipal,
  access: ChannelAccessAdapter,
): Promise<ChannelAuthorizationResult> {
  const parsed = parseChannel(rawChannel);
  if (!parsed) {
    return { ok: false, reason: 'INVALID_CHANNEL' };
  }

  if (parsed.kind === 'team') {
    return parsed.id === principal.teamId ? { ok: true } : { ok: false, reason: 'FORBIDDEN' };
  }

  try {
    const teamId =
      parsed.kind === 'spec'
        ? await access.resolveSpecTeamId(parsed.id)
        : await access.resolveAgentTeamId(parsed.id);
    return teamId && teamId === principal.teamId ? { ok: true } : { ok: false, reason: 'FORBIDDEN' };
  } catch {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}
