import { z } from 'zod';

export const ArtifactTypeSchema = z.enum(['screenshot', 'video', 'test_report', 'diff', 'log', 'file']);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  agentRunId: z.string().uuid(),
  type: ArtifactTypeSchema,
  path: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});
export type Artifact = z.infer<typeof ArtifactSchema>;
