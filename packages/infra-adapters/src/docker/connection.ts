import Docker from 'dockerode';
import { InfraAdapterError } from '../errors.js';

export function isLocalDockerHost(host: string | undefined): boolean {
  if (!host) return true;
  return host.startsWith('unix://') || host.startsWith('npipe://');
}

export function createLocalDockerClient(): Docker {
  const host = process.env.DOCKER_HOST;

  if (!isLocalDockerHost(host)) {
    throw new InfraAdapterError('DOCKER_UNAVAILABLE', 'M1 only supports local Docker daemon', { host });
  }

  if (!host) {
    return new Docker();
  }

  if (host.startsWith('unix://')) {
    return new Docker({ socketPath: host.slice('unix://'.length) });
  }

  if (host.startsWith('npipe://')) {
    return new Docker({ socketPath: host.slice('npipe://'.length) });
  }

  return new Docker();
}
