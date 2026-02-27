import { describe, expect, it, vi } from 'vitest';
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
});
