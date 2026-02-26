import { z } from 'zod';

export const TeamRoleSchema = z.enum(['admin', 'member', 'viewer']);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  createdAt: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid(),
  role: TeamRoleSchema,
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().min(1),
  keyHash: z.string().min(1),
  prefix: z.string().min(1),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;
