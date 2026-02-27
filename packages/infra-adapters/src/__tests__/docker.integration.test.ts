import { describe, expect, it } from 'vitest';
import { DockerInfraAdapter } from '../docker/docker-infra-adapter.js';

const enabled = process.env.KATA_DOCKER_E2E === '1';

describe.skipIf(!enabled)('docker integration', () => {
  it('runs full lifecycle against local daemon', async () => {
    const adapter = new DockerInfraAdapter();

    const env = await adapter.provision({ image: 'ubuntu:22.04', networkPolicy: { allowInternet: true } });

    try {
      const exec = await adapter.exec(env.id, 'echo integration-ok');
      const snap = await adapter.snapshot(env.id);

      expect(exec.exitCode).toBe(0);
      expect(exec.stdout).toContain('integration-ok');
      expect(snap.imageId).toBeTruthy();
    } finally {
      await adapter.destroy(env.id);
    }
  }, 120000);
});
