import { afterEach, describe, expect, it, vi } from 'vitest';
import Docker from 'dockerode';
import { createLocalDockerClient, isLocalDockerHost } from '../docker/connection.js';

vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

const originalDockerHost = process.env.DOCKER_HOST;

afterEach(() => {
  if (originalDockerHost === undefined) {
    delete process.env.DOCKER_HOST;
  } else {
    process.env.DOCKER_HOST = originalDockerHost;
  }
  vi.mocked(Docker).mockClear();
});

describe('docker host locality', () => {
  it('accepts local unix and npipe forms', () => {
    expect(isLocalDockerHost(undefined)).toBe(true);
    expect(isLocalDockerHost('unix:///var/run/docker.sock')).toBe(true);
    expect(isLocalDockerHost('npipe:////./pipe/docker_engine')).toBe(true);
  });

  it('rejects remote tcp hosts for M1', () => {
    expect(isLocalDockerHost('tcp://10.0.0.12:2376')).toBe(false);
  });
});

describe('createLocalDockerClient', () => {
  it('throws for remote docker hosts', () => {
    process.env.DOCKER_HOST = 'tcp://10.0.0.12:2376';

    try {
      createLocalDockerClient();
      throw new Error('expected remote DOCKER_HOST to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DOCKER_UNAVAILABLE',
      });
    }
    expect(Docker).not.toHaveBeenCalled();
  });

  it('uses default constructor when docker host is unset', () => {
    delete process.env.DOCKER_HOST;

    createLocalDockerClient();

    expect(Docker).toHaveBeenCalledWith();
  });

  it('maps unix docker hosts to socketPath', () => {
    process.env.DOCKER_HOST = 'unix:///var/run/docker.sock';

    createLocalDockerClient();

    expect(Docker).toHaveBeenCalledWith({
      socketPath: '/var/run/docker.sock',
    });
  });

  it('maps npipe docker hosts to socketPath', () => {
    process.env.DOCKER_HOST = 'npipe:////./pipe/docker_engine';

    createLocalDockerClient();

    expect(Docker).toHaveBeenCalledWith({
      socketPath: '//./pipe/docker_engine',
    });
  });
});
