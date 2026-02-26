import type { EnvConfig, Environment, ExecResult, LogEntry, Snapshot } from './types.js';

export interface InfraAdapter {
  provision(config: EnvConfig): Promise<Environment>;
  snapshot(envId: string): Promise<Snapshot>;
  destroy(envId: string): Promise<void>;
  exec(envId: string, command: string): Promise<ExecResult>;
  streamLogs(envId: string): AsyncIterable<LogEntry>;
}
