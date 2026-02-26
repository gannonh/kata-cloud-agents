import { z } from 'zod';

export const TaskStatusSchema = z.enum(['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  agentRunId: z.string().uuid().optional(),
  title: z.string().min(1),
  status: TaskStatusSchema,
  dependsOn: z.array(z.string().uuid()),
  result: z.record(z.string(), z.unknown()).optional(),
});
export type Task = z.infer<typeof TaskSchema>;
