export type InfraErrorCode =
  | 'DOCKER_UNAVAILABLE'
  | 'ENV_NOT_FOUND'
  | 'UNSUPPORTED_M1_NETWORK_POLICY'
  | 'PROVISION_FAILED'
  | 'EXEC_FAILED'
  | 'SNAPSHOT_FAILED'
  | 'DESTROY_FAILED';

export type NetworkPolicy = {
  allowInternet: boolean;
  allowedHosts?: string[];
  allowedPorts?: number[];
};

export type EnvConfig = {
  image: string;
  env?: Record<string, string>;
  cpuShares?: number;
  memoryMb?: number;
  mountPath?: string;
  hostWorkspacePath?: string;
  networkPolicy: NetworkPolicy;
};

export type EnvironmentState = 'provisioning' | 'ready' | 'running' | 'terminated' | 'error';

export type Environment = {
  id: string;
  image: string;
  state: EnvironmentState;
  createdAt: string;
};

export type Snapshot = {
  id: string;
  envId: string;
  imageId: string;
  tag: string;
  createdAt: string;
};

export type ExecResult = {
  envId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
};

export type LogEntry = {
  envId: string;
  timestamp: string;
  source: 'stdout' | 'stderr';
  message: string;
};
