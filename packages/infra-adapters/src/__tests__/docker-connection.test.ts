import { describe, expect, it } from 'vitest';
import { isLocalDockerHost } from '../docker/connection.js';

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
