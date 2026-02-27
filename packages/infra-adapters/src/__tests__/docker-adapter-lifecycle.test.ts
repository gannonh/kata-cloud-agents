import { describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { DockerInfraAdapter } from '../docker/docker-infra-adapter.js';

describe('DockerInfraAdapter lifecycle', () => {
  it('provisions and returns environment', async () => {
    const inspect = vi.fn().mockResolvedValue({
      Id: 'container-1',
      Created: '2026-02-26T00:00:00.000Z',
      State: { Running: true },
      Config: {
        Image: 'ubuntu:22.04',
        Labels: {
          'kata.env.id': 'env-1',
          'kata.env.volume': 'kata-workspace-env-1',
        },
      },
    });
    const start = vi.fn().mockResolvedValue(undefined);

    const container = {
      inspect,
      start,
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const docker = {
      getImage: vi.fn().mockReturnValue({
        inspect: vi.fn().mockResolvedValue({}),
      }),
      createVolume: vi.fn().mockResolvedValue({ Name: 'kata-workspace-env-1' }),
      createContainer: vi.fn().mockResolvedValue(container),
      getContainer: vi.fn().mockReturnValue(container),
      getVolume: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue(undefined),
      }),
      modem: {
        followProgress: vi.fn((_stream, done: (err?: unknown) => void) => done()),
        demuxStream: vi.fn(),
      },
      pull: vi.fn(),
    };

    const adapter = new DockerInfraAdapter({
      docker: docker as never,
      idGenerator: () => 'env-1',
    });
    const env = await adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } });

    expect(docker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'kata-env-env-1',
        Image: 'ubuntu:22.04',
      }),
    );
    expect(start).toHaveBeenCalled();
    expect(env.id).toBe('env-1');
    expect(['ready', 'running']).toContain(env.state);
  });

  it('uses bind mounts and no-network mode when internet access is disabled', async () => {
    const inspect = vi.fn().mockResolvedValue({
      Id: 'container-1',
      Created: '2026-02-26T00:00:00.000Z',
      State: { Running: true },
      Config: {
        Image: 'ubuntu:22.04',
        Labels: {
          'kata.env.id': 'env-1',
          'kata.env.volume': '',
        },
      },
    });
    const start = vi.fn().mockResolvedValue(undefined);
    const container = {
      inspect,
      start,
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const docker = {
      getImage: vi.fn().mockReturnValue({
        inspect: vi.fn().mockResolvedValue({}),
      }),
      createVolume: vi.fn(),
      createContainer: vi.fn().mockResolvedValue(container),
      getContainer: vi.fn().mockReturnValue(container),
      getVolume: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue(undefined),
      }),
      modem: {
        followProgress: vi.fn((_stream, done: (err?: unknown) => void) => done()),
        demuxStream: vi.fn(),
      },
      pull: vi.fn(),
    };

    const adapter = new DockerInfraAdapter({
      docker: docker as never,
      idGenerator: () => 'env-1',
    });

    await adapter.provision({
      image: 'ubuntu:22.04',
      hostWorkspacePath: '/tmp/workspace',
      mountPath: '/workspace',
      networkPolicy: { allowInternet: false },
    });

    expect(docker.createVolume).not.toHaveBeenCalled();
    expect(docker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        NetworkDisabled: true,
        HostConfig: expect.objectContaining({
          NetworkMode: 'none',
          Mounts: [
            expect.objectContaining({
              Type: 'bind',
              Source: '/tmp/workspace',
              Target: '/workspace',
            }),
          ],
        }),
        Labels: expect.objectContaining({
          'kata.env.volume': '',
        }),
      }),
    );
    expect(start).toHaveBeenCalled();
  });

  it('destroy is idempotent for missing env', async () => {
    const notFound = Object.assign(new Error('No such container: missing'), { statusCode: 404 });
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFound),
      }),
      getVolume: vi.fn().mockReturnValue({
        remove: vi.fn().mockRejectedValue(Object.assign(new Error('No such volume'), { statusCode: 404 })),
      }),
      modem: {
        followProgress: vi.fn(),
        demuxStream: vi.fn(),
      },
    };

    const adapter = new DockerInfraAdapter({ docker: docker as never });
    await expect(adapter.destroy('missing')).resolves.toBeUndefined();
  });

  it('rolls back managed resources when provision fails after container creation', async () => {
    const removeVolume = vi.fn().mockResolvedValue(undefined);
    const removeContainer = vi.fn().mockResolvedValue(undefined);
    const container = {
      start: vi.fn().mockRejectedValue(new Error('boom')),
      inspect: vi.fn(),
      remove: removeContainer,
    };

    const docker = {
      getImage: vi.fn().mockReturnValue({
        inspect: vi.fn().mockResolvedValue({}),
      }),
      createVolume: vi.fn().mockResolvedValue({ Name: 'kata-workspace-env-1' }),
      createContainer: vi.fn().mockResolvedValue(container),
      getVolume: vi.fn().mockReturnValue({
        remove: removeVolume,
      }),
      modem: {
        followProgress: vi.fn((_stream, done: (err?: unknown) => void) => done()),
        demuxStream: vi.fn(),
      },
      pull: vi.fn(),
    };

    const adapter = new DockerInfraAdapter({
      docker: docker as never,
      idGenerator: () => 'env-1',
    });

    await expect(adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } })).rejects.toMatchObject({
      code: 'PROVISION_FAILED',
    });
    expect(removeContainer).toHaveBeenCalledWith({ force: true });
    expect(docker.getVolume).toHaveBeenCalledWith('kata-workspace-env-1');
    expect(removeVolume).toHaveBeenCalledWith({ force: true });
  });

  it('waits for pull stream completion when followProgress is unavailable', async () => {
    const notFound = Object.assign(new Error('No such image: ubuntu:22.04'), { statusCode: 404 });
    const pullStream = new PassThrough();
    const container = {
      inspect: vi.fn().mockResolvedValue({
        Id: 'container-1',
        Created: '2026-02-26T00:00:00.000Z',
        State: { Running: true },
        Config: {
          Image: 'ubuntu:22.04',
          Labels: {
            'kata.env.id': 'env-1',
            'kata.env.volume': 'kata-workspace-env-1',
          },
        },
      }),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const createContainer = vi.fn().mockResolvedValue(container);

    const docker = {
      getImage: vi.fn().mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFound),
      }),
      pull: vi.fn().mockResolvedValue(pullStream),
      createVolume: vi.fn().mockResolvedValue({ Name: 'kata-workspace-env-1' }),
      createContainer,
      getContainer: vi.fn().mockReturnValue(container),
      getVolume: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue(undefined),
      }),
      modem: {
        demuxStream: vi.fn(),
      },
    };

    const adapter = new DockerInfraAdapter({
      docker: docker as never,
      idGenerator: () => 'env-1',
    });

    const provisionPromise = adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } });
    await new Promise((resolve) => setImmediate(resolve));
    expect(createContainer).not.toHaveBeenCalled();

    pullStream.end();
    await provisionPromise;
    expect(createContainer).toHaveBeenCalled();
  });

  it('includes cleanup errors when rollback fails during provision', async () => {
    const containerCleanupError = new Error('failed to remove container');
    const volumeCleanupError = new Error('failed to remove volume');
    const container = {
      start: vi.fn().mockRejectedValue(new Error('boom')),
      inspect: vi.fn(),
      remove: vi.fn().mockRejectedValue(containerCleanupError),
    };

    const docker = {
      getImage: vi.fn().mockReturnValue({
        inspect: vi.fn().mockResolvedValue({}),
      }),
      createVolume: vi.fn().mockResolvedValue({ Name: 'kata-workspace-env-1' }),
      createContainer: vi.fn().mockResolvedValue(container),
      getVolume: vi.fn().mockReturnValue({
        remove: vi.fn().mockRejectedValue(volumeCleanupError),
      }),
      modem: {
        followProgress: vi.fn((_stream, done: (err?: unknown) => void) => done()),
        demuxStream: vi.fn(),
      },
      pull: vi.fn(),
    };

    const adapter = new DockerInfraAdapter({
      docker: docker as never,
      idGenerator: () => 'env-1',
    });

    await expect(adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } })).rejects.toMatchObject({
      code: 'PROVISION_FAILED',
      details: {
        cleanupErrors: [containerCleanupError, volumeCleanupError],
      },
    });
  });

  it('destroy skips managed volume removal when label is empty', async () => {
    const container = {
      inspect: vi.fn().mockResolvedValue({
        Config: {
          Labels: {
            'kata.env.volume': '',
          },
        },
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const docker = {
      getContainer: vi.fn().mockReturnValue(container),
      getVolume: vi.fn(),
      modem: {
        followProgress: vi.fn(),
        demuxStream: vi.fn(),
      },
    };

    const adapter = new DockerInfraAdapter({ docker: docker as never });
    await adapter.destroy('env-1');

    expect(docker.getVolume).not.toHaveBeenCalled();
  });

  it('does not treat non-resource "no such" messages as not-found', async () => {
    const transportError = Object.assign(new Error('dial tcp: lookup docker.internal: no such host'), {
      statusCode: 500,
    });
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        inspect: vi.fn().mockRejectedValue(transportError),
      }),
      getVolume: vi.fn(),
      modem: {
        followProgress: vi.fn(),
        demuxStream: vi.fn(),
      },
    };

    const adapter = new DockerInfraAdapter({ docker: docker as never });
    await expect(adapter.destroy('env-1')).rejects.toMatchObject({
      code: 'DESTROY_FAILED',
    });
  });
});
