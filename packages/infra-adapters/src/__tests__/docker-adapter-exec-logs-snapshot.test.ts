import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { DockerInfraAdapter } from '../docker/docker-infra-adapter.js';

describe('DockerInfraAdapter exec/logs/snapshot', () => {
  it('exec returns exit code, stdout, stderr', async () => {
    const adapter = new DockerInfraAdapter({
      docker: createMockDocker() as never,
    });
    const result = await adapter.exec('env-1', 'echo hi');

    expect(result.exitCode).toBeTypeOf('number');
    expect(result.stdout).toContain('exec-stdout');
    expect(result.stderr).toContain('exec-stderr');
  });

  it('exec fails when Docker does not provide an exit code', async () => {
    const adapter = new DockerInfraAdapter({
      docker: createMockDocker({
        execInspectResult: {},
      }) as never,
    });

    await expect(adapter.exec('env-1', 'echo hi')).rejects.toMatchObject({
      code: 'EXEC_FAILED',
    });
  });

  it('streamLogs yields labeled entries', async () => {
    const adapter = new DockerInfraAdapter({
      docker: createMockDocker() as never,
    });

    const entries = [];
    for await (const entry of adapter.streamLogs('env-1')) {
      entries.push(entry);
      if (entries.length >= 2) break;
    }

    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.source === 'stdout' || e.source === 'stderr')).toBe(true);
  });

  it('streamLogs closes the Docker log stream when iteration ends early', async () => {
    const logStream = new PassThrough();
    const adapter = new DockerInfraAdapter({
      docker: createMockDocker({
        autoEndLogStream: false,
        logStream,
      }) as never,
    });

    const iterator = adapter.streamLogs('env-1')[Symbol.asyncIterator]();
    const first = await iterator.next();

    expect(first.done).toBe(false);
    await iterator.return?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(logStream.destroyed).toBe(true);
  });

  it('snapshot commits container and returns metadata', async () => {
    const adapter = new DockerInfraAdapter({
      docker: createMockDocker() as never,
      now: () => new Date('2026-02-26T00:00:00.000Z'),
    });
    const snap = await adapter.snapshot('env-1');

    expect(snap.envId).toBe('env-1');
    expect(snap.imageId).toBeTruthy();
    expect(snap.tag).toContain('kata-snapshots');
  });

  it('snapshot fails when Docker commit response has no image id', async () => {
    const adapter = new DockerInfraAdapter({
      docker: createMockDocker({
        commitResult: {},
      }) as never,
    });

    await expect(adapter.snapshot('env-1')).rejects.toMatchObject({
      code: 'SNAPSHOT_FAILED',
    });
  });
});

type MockDockerOptions = {
  execInspectResult?: Record<string, unknown>;
  commitResult?: unknown;
  logStream?: PassThrough;
  autoEndLogStream?: boolean;
};

function createMockDocker(options: MockDockerOptions = {}) {
  let demuxCalls = 0;

  const execStream = new PassThrough();
  process.nextTick(() => {
    execStream.end();
  });

  const logStream = options.logStream ?? new PassThrough();
  if (options.autoEndLogStream !== false) {
    process.nextTick(() => {
      logStream.end();
    });
  }

  const execHandle = {
    start: vi.fn().mockResolvedValue(execStream),
    inspect: vi.fn().mockResolvedValue(options.execInspectResult ?? { ExitCode: 0 }),
  };

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
    exec: vi.fn().mockResolvedValue(execHandle),
    logs: vi.fn().mockResolvedValue(logStream),
    commit: vi.fn().mockResolvedValue(options.commitResult ?? { Id: 'sha256:snapshot-1' }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  return {
    getContainer: vi.fn().mockReturnValue(container),
    getVolume: vi.fn().mockReturnValue({
      remove: vi.fn().mockResolvedValue(undefined),
    }),
    getImage: vi.fn().mockReturnValue({
      inspect: vi.fn().mockResolvedValue({}),
    }),
    createContainer: vi.fn().mockResolvedValue(container),
    createVolume: vi.fn().mockResolvedValue({ Name: 'kata-workspace-env-1' }),
    pull: vi.fn().mockResolvedValue(new PassThrough()),
    modem: {
      followProgress: vi.fn((_stream, done: (err?: unknown) => void) => done()),
      demuxStream: vi.fn((_stream, stdout: PassThrough, stderr: PassThrough) => {
        demuxCalls += 1;
        if (demuxCalls === 1) {
          stdout.write('exec-stdout\n');
          stderr.write('exec-stderr\n');
        } else {
          stdout.write('2026-02-26T00:00:01.000Z log-stdout\n');
          stderr.write('2026-02-26T00:00:02.000Z log-stderr\n');
        }
      }),
    },
  };
}
