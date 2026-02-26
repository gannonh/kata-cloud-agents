import type { AuthPrincipal, ChannelAccessAdapter } from '../types.js';

export type RealtimeChannel =
  | { kind: 'team'; id: string }
  | { kind: 'spec'; id: string }
  | { kind: 'agent'; id: string };

export function parseChannel(value: string): RealtimeChannel | null {
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':').trim();
  if (!id) {
    return null;
  }

  if (kind === 'team' || kind === 'spec' || kind === 'agent') {
    return { kind, id };
  }

  return null;
}

export async function authorizeChannel(
  rawChannel: string,
  principal: AuthPrincipal,
  access: ChannelAccessAdapter,
): Promise<{ ok: boolean }> {
  const parsed = parseChannel(rawChannel);
  if (!parsed) {
    return { ok: false };
  }

  if (parsed.kind === 'team') {
    return { ok: parsed.id === principal.teamId };
  }

  try {
    const teamId =
      parsed.kind === 'spec'
        ? await access.resolveSpecTeamId(parsed.id)
        : await access.resolveAgentTeamId(parsed.id);
    return { ok: Boolean(teamId && teamId === principal.teamId) };
  } catch {
    return { ok: false };
  }
}
