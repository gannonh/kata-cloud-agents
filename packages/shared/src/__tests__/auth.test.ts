import { describe, it, expect } from 'vitest';
import {
  UserSchema,
  TeamSchema,
  TeamMemberSchema,
  ApiKeySchema,
  TeamRoleSchema,
} from '../schemas/auth.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const now = '2026-01-01T00:00:00.000Z';

describe('UserSchema', () => {
  const valid = { id: uuid, email: 'a@b.com', name: 'Alice', createdAt: now };

  it('parses valid user', () => {
    expect(UserSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid email', () => {
    expect(() => UserSchema.parse({ ...valid, email: 'bad' })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => UserSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects missing id', () => {
    expect(() => UserSchema.parse({ email: valid.email, name: valid.name, createdAt: valid.createdAt })).toThrow();
  });
});

describe('TeamSchema', () => {
  const valid = { id: uuid, name: 'Kata', slug: 'kata', createdAt: now };

  it('parses valid team', () => {
    expect(TeamSchema.parse(valid)).toEqual(valid);
  });

  it('rejects empty slug', () => {
    expect(() => TeamSchema.parse({ ...valid, slug: '' })).toThrow();
  });

  it('rejects slug with uppercase', () => {
    expect(() => TeamSchema.parse({ ...valid, slug: 'Kata' })).toThrow();
  });

  it('rejects slug with spaces', () => {
    expect(() => TeamSchema.parse({ ...valid, slug: 'my team' })).toThrow();
  });

  it('accepts hyphenated slug', () => {
    expect(TeamSchema.parse({ ...valid, slug: 'my-team' }).slug).toBe('my-team');
  });
});

describe('TeamMemberSchema', () => {
  const valid = { userId: uuid, teamId: uuid, role: 'admin' as const };

  it('parses valid member', () => {
    expect(TeamMemberSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid role', () => {
    expect(() => TeamMemberSchema.parse({ ...valid, role: 'superadmin' })).toThrow();
  });
});

describe('TeamRoleSchema', () => {
  it('accepts admin, member, viewer', () => {
    expect(TeamRoleSchema.parse('admin')).toBe('admin');
    expect(TeamRoleSchema.parse('member')).toBe('member');
    expect(TeamRoleSchema.parse('viewer')).toBe('viewer');
  });
});

describe('ApiKeySchema', () => {
  const valid = {
    id: uuid,
    teamId: uuid,
    name: 'CI Key',
    keyHash: 'sha256:abc123',
    prefix: 'kat_',
    createdBy: uuid,
    createdAt: now,
  };

  it('parses valid key', () => {
    expect(ApiKeySchema.parse(valid)).toEqual(valid);
  });

  it('parses with optional expiresAt', () => {
    const withExpiry = { ...valid, expiresAt: now };
    expect(ApiKeySchema.parse(withExpiry)).toEqual(withExpiry);
  });

  it('parses with optional revokedAt', () => {
    const withRevoke = { ...valid, revokedAt: now };
    expect(ApiKeySchema.parse(withRevoke)).toEqual(withRevoke);
  });

  it('rejects missing keyHash', () => {
    expect(() => ApiKeySchema.parse({
      id: valid.id, teamId: valid.teamId, name: valid.name,
      prefix: valid.prefix, createdBy: valid.createdBy, createdAt: valid.createdAt,
    })).toThrow();
  });
});
