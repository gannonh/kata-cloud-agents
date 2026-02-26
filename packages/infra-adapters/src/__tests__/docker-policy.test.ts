import { describe, expect, it } from 'vitest';
import { assertM1NetworkPolicy } from '../docker/policy.js';

describe('M1 network policy gate', () => {
  it('allows internet on/off without host/port constraints', () => {
    expect(() => assertM1NetworkPolicy({ allowInternet: true })).not.toThrow();
    expect(() => assertM1NetworkPolicy({ allowInternet: false })).not.toThrow();
  });

  it('rejects allowedHosts and allowedPorts in M1', () => {
    expect(() => assertM1NetworkPolicy({ allowInternet: true, allowedHosts: ['example.com'] })).toThrow();
    expect(() => assertM1NetworkPolicy({ allowInternet: true, allowedPorts: [443] })).toThrow();
  });
});
