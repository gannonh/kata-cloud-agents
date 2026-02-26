import { describe, expect, expectTypeOf, it } from 'vitest';
import type { InfraAdapter } from '../infra-adapter.js';
import type {
  EnvConfig,
  Environment,
  Snapshot,
  ExecResult,
  LogEntry,
  InfraErrorCode,
} from '../types.js';

describe('infra adapter contract types', () => {
  it('exposes expected error codes', () => {
    const expected: InfraErrorCode[] = [
      'DOCKER_UNAVAILABLE',
      'ENV_NOT_FOUND',
      'UNSUPPORTED_M1_NETWORK_POLICY',
      'PROVISION_FAILED',
      'EXEC_FAILED',
      'SNAPSHOT_FAILED',
      'DESTROY_FAILED',
    ];

    expect(expected).toHaveLength(7);
  });

  it('defines InfraAdapter method signatures', () => {
    type _Contract = InfraAdapter;
    expectTypeOf<EnvConfig>().toMatchTypeOf<object>();
    expectTypeOf<Environment>().toMatchTypeOf<object>();
    expectTypeOf<Snapshot>().toMatchTypeOf<object>();
    expectTypeOf<ExecResult>().toMatchTypeOf<object>();
    expectTypeOf<LogEntry>().toMatchTypeOf<object>();
    expectTypeOf<_Contract>().toMatchTypeOf<object>();
  });
});
