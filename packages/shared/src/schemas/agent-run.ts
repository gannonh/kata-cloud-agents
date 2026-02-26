import { z } from 'zod';
import { AgentRoleSchema } from './agent.js';

export const AgentRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSchema = z
  .object({
    id: z.string().uuid(),
    specId: z.string().uuid(),
    agentRole: AgentRoleSchema,
    environmentId: z.string().uuid(),
    model: z.string().min(1),
    status: AgentRunStatusSchema,
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
  })
  .refine(
    (r) =>
      !['running', 'completed', 'failed'].includes(r.status) ||
      r.startedAt !== undefined,
    { message: 'startedAt required for running, completed, or failed runs' },
  )
  .refine(
    (r) =>
      !['completed', 'failed'].includes(r.status) ||
      r.completedAt !== undefined,
    { message: 'completedAt required for completed or failed runs' },
  );
export type AgentRun = z.infer<typeof AgentRunSchema>;
