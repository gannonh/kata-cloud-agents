import { z } from 'zod';

export const AgentRoleSchema = z.enum(['coordinator', 'specialist', 'verifier']);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentStatusSchema = z.enum(['idle', 'running', 'paused', 'error', 'terminated']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const ModelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: AgentRoleSchema,
  modelConfig: ModelConfigSchema,
  status: AgentStatusSchema,
});
export type Agent = z.infer<typeof AgentSchema>;
