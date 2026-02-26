import { z } from 'zod';
import { AgentRoleSchema } from './agent.js';

export const AgentRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  agentRole: AgentRoleSchema,
  environmentId: z.string().uuid(),
  model: z.string().min(1),
  status: AgentRunStatusSchema,
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;
