import { z } from 'zod';

export const SpecStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);
export type SpecStatus = z.infer<typeof SpecStatusSchema>;

export const SpecMetaSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SpecMeta = z.infer<typeof SpecMetaSchema>;

export const SpecDecisionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  decidedBy: z.string().min(1),
  decidedAt: z.string().datetime(),
  rationale: z.string().optional(),
});
export type SpecDecision = z.infer<typeof SpecDecisionSchema>;

export const SpecBlockerStatusSchema = z.enum(['open', 'resolved']);
export type SpecBlockerStatus = z.infer<typeof SpecBlockerStatusSchema>;

export const SpecBlockerSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  status: SpecBlockerStatusSchema,
  reportedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type SpecBlocker = z.infer<typeof SpecBlockerSchema>;

export const SpecVerificationSchema = z.object({
  criteria: z.array(z.string()),
  testPlan: z.string().optional(),
});
export type SpecVerification = z.infer<typeof SpecVerificationSchema>;

export const SpecSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  title: z.string().min(1),
  status: SpecStatusSchema,
  meta: SpecMetaSchema,
  intent: z.string(),
  constraints: z.array(z.string()),
  verification: SpecVerificationSchema,
  taskIds: z.array(z.string().uuid()),
  decisions: z.array(SpecDecisionSchema),
  blockers: z.array(SpecBlockerSchema),
  createdBy: z.string().uuid(),
});
export type Spec = z.infer<typeof SpecSchema>;
