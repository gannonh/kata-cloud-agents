import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import Docker from 'dockerode';
import { createLocalDockerClient } from './connection.js';
import { mapContainerToEnvironment, mapLogEntry, mapSnapshot } from './mappers.js';
import { assertM1NetworkPolicy } from './policy.js';
import { InfraAdapterError } from '../errors.js';
import type { EnvConfig, Environment, ExecResult, InfraAdapter, LogEntry, Snapshot } from '../index.js';

type DockerClient = {
  createContainer: (options: Docker.ContainerCreateOptions) => Promise<Docker.Container>;
  getContainer: (id: string) => Docker.Container;
  createVolume: (options: Docker.VolumeCreateOptions) => Promise<Docker.VolumeCreateResponse>;
  getVolume: (name: string) => Docker.Volume;
  getImage: (name: string) => Docker.Image;
  pull: (repoTag: string, options?: Record<string, never>) => Promise<NodeJS.ReadableStream>;
  modem: {
    followProgress?: (stream: NodeJS.ReadableStream, done: (err?: unknown) => void) => void;
    demuxStream?: (
      stream: NodeJS.ReadableStream,
      stdout: NodeJS.WritableStream,
      stderr: NodeJS.WritableStream,
    ) => void;
  };
};

type DockerError = Error & { statusCode?: number };

type DockerContainerInspect = {
  Created?: string;
  State?: {
    Running?: boolean;
  };
  Config?: {
    Image?: string;
    Labels?: Record<string, string | undefined>;
  };
};

type DockerInfraAdapterOptions = {
  docker?: DockerClient;
  idGenerator?: () => string;
  now?: () => Date;
};

const DEFAULT_MOUNT_PATH = '/workspace';

export class DockerInfraAdapter implements InfraAdapter {
  private readonly docker: DockerClient;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;

  constructor(options: DockerInfraAdapterOptions = {}) {
    this.docker = options.docker ?? (createLocalDockerClient() as DockerClient);
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async provision(config: EnvConfig): Promise<Environment> {
    let envId = '';
    let container: Docker.Container | undefined;
    let managedVolumeName: string | undefined;

    try {
      assertM1NetworkPolicy(config.networkPolicy);
      await this.ensureImage(config.image);

      envId = this.idGenerator();
      const mountPath = config.mountPath ?? DEFAULT_MOUNT_PATH;
      const volumeName = `kata-workspace-${envId}`;
      const mounts: Docker.MountSettings[] = [];

      if (config.hostWorkspacePath) {
        mounts.push({
          Type: 'bind',
          Source: config.hostWorkspacePath,
          Target: mountPath,
        });
      } else {
        await this.docker.createVolume({
          Name: volumeName,
          Labels: {
            'kata.env.id': envId,
            'kata.managed': 'true',
          },
        });
        managedVolumeName = volumeName;
        mounts.push({
          Type: 'volume',
          Source: volumeName,
          Target: mountPath,
        });
      }

      container = await this.docker.createContainer({
        name: this.containerName(envId),
        Image: config.image,
        WorkingDir: mountPath,
        Cmd: ['/bin/sh', '-lc', 'while sleep 3600; do :; done'],
        Tty: false,
        Env: this.toDockerEnv(config.env),
        Labels: {
          'kata.env.id': envId,
          'kata.env.volume': config.hostWorkspacePath ? '' : volumeName,
          'kata.managed': 'true',
        },
        NetworkDisabled: !config.networkPolicy.allowInternet,
        HostConfig: {
          CpuShares: config.cpuShares,
          Memory: config.memoryMb ? config.memoryMb * 1024 * 1024 : undefined,
          NetworkMode: config.networkPolicy.allowInternet ? undefined : 'none',
          Mounts: mounts,
        },
      });

      await container.start();
      const inspect = await container.inspect();

      return mapContainerToEnvironment(envId, config.image, inspect, this.now());
    } catch (error) {
      const cleanupErrors = await this.cleanupProvisionResources(container, managedVolumeName);

      if (error instanceof InfraAdapterError) {
        if (cleanupErrors.length === 0) {
          throw error;
        }

        throw new InfraAdapterError(error.code, error.message, { ...(error.details ?? {}), cleanupErrors }, error.cause ?? error);
      }

      const details: Record<string, unknown> = { config };
      if (cleanupErrors.length > 0) {
        details.cleanupErrors = cleanupErrors;
      }

      throw new InfraAdapterError('PROVISION_FAILED', 'Failed to provision Docker environment', details, error);
    }
  }

  async destroy(envId: string): Promise<void> {
    const expectedVolumeName = `kata-workspace-${envId}`;

    try {
      let volumeName = expectedVolumeName;

      try {
        const container = this.docker.getContainer(this.containerName(envId));
        const inspect = (await container.inspect()) as DockerContainerInspect;
        volumeName = inspect.Config?.Labels?.['kata.env.volume'] ?? expectedVolumeName;

        try {
          await container.stop({ t: 0 });
        } catch (error) {
          if (!this.isNotFoundError(error)) {
            throw error;
          }
        }

        await container.remove({ force: true });
      } catch (error) {
        if (!this.isNotFoundError(error)) {
          throw error;
        }
      }

      if (volumeName) {
        try {
          await this.docker.getVolume(volumeName).remove({ force: true });
        } catch (error) {
          if (!this.isNotFoundError(error)) {
            throw error;
          }
        }
      }
    } catch (error) {
      if (error instanceof InfraAdapterError) {
        throw error;
      }

      throw new InfraAdapterError('DESTROY_FAILED', 'Failed to destroy Docker environment', { envId }, error);
    }
  }

  async snapshot(envId: string): Promise<Snapshot> {
    try {
      const { container } = await this.resolveContainer(envId);
      const now = this.now();
      const repo = 'kata-snapshots';
      const tagPart = `${envId}-${now.getTime()}`;
      const commitResult = await container.commit({
        repo,
        tag: tagPart,
      });
      const imageId = this.extractImageId(envId, commitResult);

      return mapSnapshot(envId, imageId, `${repo}:${tagPart}`, now);
    } catch (error) {
      if (error instanceof InfraAdapterError) {
        throw error;
      }

      throw new InfraAdapterError('SNAPSHOT_FAILED', 'Failed to snapshot Docker environment', { envId }, error);
    }
  }

  async exec(envId: string, command: string): Promise<ExecResult> {
    const startedAt = this.now().toISOString();

    try {
      const { container } = await this.resolveContainer(envId);
      const exec = await container.exec({
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        Cmd: ['/bin/sh', '-lc', command],
      });

      const stream = await exec.start({
        Detach: false,
        Tty: false,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      await this.demuxToBuffers(stream, stdoutChunks, stderrChunks);
      const inspect = await exec.inspect();
      const exitCode = inspect.ExitCode;
      if (exitCode == null) {
        throw new InfraAdapterError('EXEC_FAILED', 'Docker exec completed without an exit code', {
          envId,
          command,
          inspect,
        });
      }

      return {
        envId,
        command,
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        startedAt,
        completedAt: this.now().toISOString(),
      };
    } catch (error) {
      if (error instanceof InfraAdapterError) {
        throw error;
      }

      throw new InfraAdapterError('EXEC_FAILED', 'Failed to execute command in Docker environment', { envId, command }, error);
    }
  }

  async *streamLogs(envId: string): AsyncIterable<LogEntry> {
    const queue: LogEntry[] = [];
    const waiters: Array<() => void> = [];
    let done = false;
    let failure: unknown;
    let logsStream: NodeJS.ReadableStream | undefined;

    const push = (entry: LogEntry) => {
      if (done) {
        return;
      }
      queue.push(entry);
      this.notify(waiters);
    };
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      this.notify(waiters);
    };
    const fail = (error: unknown) => {
      if (done) {
        return;
      }
      failure = error;
      done = true;
      this.notify(waiters);
    };

    (async () => {
      try {
        const { container } = await this.resolveContainer(envId);
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          follow: true,
          timestamps: true,
        });
        logsStream = logs;

        if (Buffer.isBuffer(logs)) {
          for (const line of logs.toString('utf8').split(/\r?\n/)) {
            if (!line.trim()) continue;
            push(mapLogEntry(envId, 'stdout', line, this.now()));
          }
          finish();
          return;
        }

        const stdout = new PassThrough();
        const stderr = new PassThrough();
        let stdoutRemainder = '';
        let stderrRemainder = '';

        stdout.on('data', (chunk: Buffer | string) => {
          stdoutRemainder = this.consumeChunkLines(envId, 'stdout', chunk, stdoutRemainder, push);
        });
        stderr.on('data', (chunk: Buffer | string) => {
          stderrRemainder = this.consumeChunkLines(envId, 'stderr', chunk, stderrRemainder, push);
        });

        if (this.docker.modem.demuxStream) {
          this.docker.modem.demuxStream(logs, stdout, stderr);
        } else {
          logs.on('data', (chunk: Buffer | string) => {
            stdoutRemainder = this.consumeChunkLines(envId, 'stdout', chunk, stdoutRemainder, push);
          });
        }

        await this.waitForStreamEnd(logs);

        if (stdoutRemainder.trim()) {
          push(mapLogEntry(envId, 'stdout', stdoutRemainder, this.now()));
        }
        if (stderrRemainder.trim()) {
          push(mapLogEntry(envId, 'stderr', stderrRemainder, this.now()));
        }

        finish();
      } catch (error) {
        if (error instanceof InfraAdapterError) {
          fail(error);
          return;
        }

        fail(new InfraAdapterError('EXEC_FAILED', 'Failed to stream Docker logs', { envId }, error));
      }
    })();

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          const entry = queue.shift();
          if (entry) {
            yield entry;
          }
          continue;
        }

        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });
      }

      if (failure) {
        throw failure;
      }
    } finally {
      done = true;
      this.destroyStream(logsStream);
      this.notify(waiters);
    }
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }

      const pullStream = await this.docker.pull(image, {});

      await new Promise<void>((resolve, reject) => {
        const followProgress = this.docker.modem.followProgress?.bind(this.docker.modem);
        if (!followProgress) {
          this.waitForStreamEnd(pullStream).then(resolve, reject);
          return;
        }

        followProgress(pullStream, (err?: unknown) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }
  }

  private async cleanupProvisionResources(container: Docker.Container | undefined, volumeName: string | undefined): Promise<unknown[]> {
    const cleanupErrors: unknown[] = [];

    if (container) {
      try {
        await container.remove({ force: true });
      } catch (error) {
        if (!this.isNotFoundError(error)) {
          cleanupErrors.push(error);
        }
      }
    }

    if (!volumeName) {
      return cleanupErrors;
    }

    try {
      await this.docker.getVolume(volumeName).remove({ force: true });
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        cleanupErrors.push(error);
      }
    }

    return cleanupErrors;
  }

  private toDockerEnv(env?: Record<string, string>): string[] | undefined {
    if (!env) return undefined;
    return Object.entries(env).map(([key, value]) => `${key}=${value}`);
  }

  private containerName(envId: string): string {
    return `kata-env-${envId}`;
  }

  private async resolveContainer(envId: string): Promise<{ container: Docker.Container; inspect: DockerContainerInspect }> {
    const candidates = [this.containerName(envId), envId];

    for (const candidate of candidates) {
      try {
        const container = this.docker.getContainer(candidate);
        const inspect = (await container.inspect()) as DockerContainerInspect;
        return { container, inspect };
      } catch (error) {
        if (!this.isNotFoundError(error)) {
          throw error;
        }
      }
    }

    throw new InfraAdapterError('ENV_NOT_FOUND', 'Docker environment not found', { envId });
  }

  private extractImageId(envId: string, commitResult: unknown): string {
    if (typeof commitResult === 'string') {
      return commitResult;
    }

    if (typeof commitResult === 'object' && commitResult && 'Id' in commitResult) {
      const id = (commitResult as { Id?: unknown }).Id;
      if (typeof id === 'string') {
        return id;
      }
    }

    throw new InfraAdapterError('SNAPSHOT_FAILED', 'Docker commit response missing image ID', {
      envId,
      commitResult,
    });
  }

  private async demuxToBuffers(
    stream: NodeJS.ReadableStream,
    stdoutChunks: Buffer[],
    stderrChunks: Buffer[],
  ): Promise<void> {
    if (this.docker.modem.demuxStream) {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(Buffer.from(chunk));
      });
      stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(Buffer.from(chunk));
      });

      this.docker.modem.demuxStream(stream, stdout, stderr);
      await this.waitForStreamEnd(stream);
      return;
    }

    stream.on('data', (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    await this.waitForStreamEnd(stream);
  }

  private consumeChunkLines(
    envId: string,
    source: 'stdout' | 'stderr',
    chunk: Buffer | string,
    remainder: string,
    push: (entry: LogEntry) => void,
  ): string {
    const combined = remainder + chunk.toString();
    const lines = combined.split(/\r?\n/);
    const nextRemainder = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      push(mapLogEntry(envId, source, line, this.now()));
    }

    return nextRemainder;
  }

  private async waitForStreamEnd(stream: NodeJS.ReadableStream): Promise<void> {
    const candidate = stream as NodeJS.ReadableStream & {
      readableEnded?: boolean;
      writableFinished?: boolean;
      destroyed?: boolean;
      resume?: () => unknown;
    };

    if (candidate.readableEnded || candidate.writableFinished || candidate.destroyed) {
      return;
    }

    if (typeof candidate.resume === 'function') {
      candidate.resume();
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      stream.once('error', rejectOnce);
      stream.once('end', resolveOnce);
      stream.once('close', resolveOnce);
      stream.once('finish', resolveOnce);
    });
  }

  private notify(waiters: Array<() => void>): void {
    while (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter?.();
    }
  }

  private destroyStream(stream: NodeJS.ReadableStream | undefined): void {
    if (!stream) {
      return;
    }

    const candidate = stream as NodeJS.ReadableStream & {
      destroyed?: boolean;
      destroy?: (error?: Error) => unknown;
    };

    if (!candidate.destroyed && typeof candidate.destroy === 'function') {
      candidate.destroy();
    }
  }

  private isNotFoundError(error: unknown): boolean {
    const err = error as DockerError;
    if (err?.statusCode === 404) return true;
    return /no such (container|volume|image)\b/i.test(err?.message ?? '');
  }
}
