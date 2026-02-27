import { z } from 'zod';

export const ActorTypeSchema = z.enum(['user', 'agent']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const SpecVersionSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  content: z.record(z.string(), z.unknown()),
  actorId: z.string().uuid(),
  actorType: ActorTypeSchema,
  changeSummary: z.string(),
  createdAt: z.string().datetime(),
});
export type SpecVersion = z.infer<typeof SpecVersionSchema>;

export const CreateVersionInputSchema = z.object({
  content: z.record(z.string(), z.unknown()),
  changeSummary: z.string().default(''),
});
export type CreateVersionInput = z.infer<typeof CreateVersionInputSchema>;

export const DiffEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['added', 'removed', 'changed']),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
});
export type DiffEntry = z.infer<typeof DiffEntrySchema>;

export const VersionListResponseSchema = z.object({
  items: z.array(SpecVersionSchema),
  total: z.number().int().nonnegative(),
});
export type VersionListResponse = z.infer<typeof VersionListResponseSchema>;
