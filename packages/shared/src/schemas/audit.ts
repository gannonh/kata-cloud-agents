import { z } from 'zod';

export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  agentRunId: z.string().uuid().optional(),
  action: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
