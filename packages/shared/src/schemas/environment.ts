import { z } from 'zod';

export const EnvironmentStateSchema = z.enum([
  'provisioning',
  'ready',
  'running',
  'stopped',
  'terminated',
  'error',
]);
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

export const VmConfigSchema = z.object({
  image: z.string().min(1),
  cpu: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  diskGb: z.number().int().positive(),
  gpu: z.boolean().optional(),
});
export type VmConfig = z.infer<typeof VmConfigSchema>;

export const ResourceLimitsSchema = z.object({
  maxCpu: z.number().int().positive(),
  maxMemoryMb: z.number().int().positive(),
  maxDiskGb: z.number().int().positive(),
  timeoutSeconds: z.number().int().positive(),
});
export type ResourceLimits = z.infer<typeof ResourceLimitsSchema>;

export const NetworkPolicySchema = z.object({
  allowInternet: z.boolean(),
  allowedHosts: z.array(z.string()).optional(),
  allowedPorts: z.array(z.number().int().min(1).max(65535)).optional(),
});
export type NetworkPolicy = z.infer<typeof NetworkPolicySchema>;

export const EnvironmentSchema = z
  .object({
    id: z.string().uuid(),
    config: VmConfigSchema,
    state: EnvironmentStateSchema,
    resourceLimits: ResourceLimitsSchema,
    networkPolicy: NetworkPolicySchema,
  })
  .refine((e) => e.config.cpu <= e.resourceLimits.maxCpu, {
    message: 'config.cpu exceeds resourceLimits.maxCpu',
  })
  .refine((e) => e.config.memoryMb <= e.resourceLimits.maxMemoryMb, {
    message: 'config.memoryMb exceeds resourceLimits.maxMemoryMb',
  })
  .refine((e) => e.config.diskGb <= e.resourceLimits.maxDiskGb, {
    message: 'config.diskGb exceeds resourceLimits.maxDiskGb',
  });
export type Environment = z.infer<typeof EnvironmentSchema>;
