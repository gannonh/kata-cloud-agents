import { describe, it, expect } from 'vitest';
import {
  EnvironmentSchema,
  EnvironmentStateSchema,
  VmConfigSchema,
  ResourceLimitsSchema,
  NetworkPolicySchema,
} from '../schemas/environment.js';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('EnvironmentStateSchema', () => {
  it('accepts all states', () => {
    for (const s of ['provisioning', 'ready', 'running', 'stopped', 'terminated', 'error']) {
      expect(EnvironmentStateSchema.parse(s)).toBe(s);
    }
  });
});

describe('VmConfigSchema', () => {
  it('parses valid config', () => {
    const c = { image: 'ubuntu:22.04', cpu: 2, memoryMb: 4096, diskGb: 20 };
    expect(VmConfigSchema.parse(c)).toEqual(c);
  });

  it('parses with optional gpu', () => {
    const c = { image: 'ubuntu:22.04', cpu: 4, memoryMb: 8192, diskGb: 50, gpu: true };
    expect(VmConfigSchema.parse(c)).toEqual(c);
  });

  it('rejects non-positive cpu', () => {
    expect(() => VmConfigSchema.parse({ image: 'x', cpu: 0, memoryMb: 1, diskGb: 1 })).toThrow();
  });
});

describe('ResourceLimitsSchema', () => {
  it('parses valid limits', () => {
    const l = { maxCpu: 8, maxMemoryMb: 16384, maxDiskGb: 100, timeoutSeconds: 3600 };
    expect(ResourceLimitsSchema.parse(l)).toEqual(l);
  });
});

describe('NetworkPolicySchema', () => {
  it('parses minimal policy', () => {
    const p = { allowInternet: false };
    expect(NetworkPolicySchema.parse(p)).toEqual(p);
  });

  it('parses with optional hosts and ports', () => {
    const p = { allowInternet: true, allowedHosts: ['api.example.com'], allowedPorts: [443] };
    expect(NetworkPolicySchema.parse(p)).toEqual(p);
  });
});

describe('EnvironmentSchema', () => {
  const valid = {
    id: uuid,
    config: { image: 'ubuntu:22.04', cpu: 2, memoryMb: 4096, diskGb: 20 },
    state: 'ready' as const,
    resourceLimits: { maxCpu: 8, maxMemoryMb: 16384, maxDiskGb: 100, timeoutSeconds: 3600 },
    networkPolicy: { allowInternet: false },
  };

  it('parses valid environment', () => {
    expect(EnvironmentSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid state', () => {
    expect(() => EnvironmentSchema.parse({ ...valid, state: 'booting' })).toThrow();
  });
});
