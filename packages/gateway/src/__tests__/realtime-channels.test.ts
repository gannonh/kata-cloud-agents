import { describe, expect, it } from 'vitest';
import { authorizeChannel } from '../realtime/channels.js';

const principal = { type: 'session_user', teamId: 'team-1', userId: 'u1' } as const;

const access = {
  resolveSpecTeamId: async (specId: string) => (specId === 'spec-1' ? 'team-1' : null),
  resolveAgentTeamId: async (agentId: string) => (agentId === 'agent-1' ? 'team-1' : null),
};

describe('channel authorization', () => {
  it('allows matching team channel', async () => {
    await expect(authorizeChannel('team:team-1', principal, access)).resolves.toEqual({ ok: true });
  });

  it('rejects foreign team channel', async () => {
    await expect(authorizeChannel('team:team-2', principal, access)).resolves.toEqual({ ok: false });
  });

  it('allows spec channel in same team', async () => {
    await expect(authorizeChannel('spec:spec-1', principal, access)).resolves.toEqual({ ok: true });
  });

  it('rejects invalid channel format', async () => {
    await expect(authorizeChannel('bogus', principal, access)).resolves.toEqual({ ok: false });
  });
});
