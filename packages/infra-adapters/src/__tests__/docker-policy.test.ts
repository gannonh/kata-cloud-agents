import { describe, expect, it } from 'vitest';
import { assertM1NetworkPolicy } from '../docker/policy.js';
describe('M1 network policy gate', () => {
  it('allows internet on/off without host/port constraints', () => {
    expect(() => assertM1NetworkPolicy({ allowInternet: true })).not.toThrow();
    expect(() => assertM1NetworkPolicy({ allowInternet: false })).not.toThrow();
  });

  it('rejects allowedHosts and allowedPorts in M1', () => {
    try {
      assertM1NetworkPolicy({ allowInternet: true, allowedHosts: ['example.com'] });
      throw new Error('expected allowedHosts policy to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_M1_NETWORK_POLICY',
      });
    }

    try {
      assertM1NetworkPolicy({ allowInternet: true, allowedPorts: [443] });
      throw new Error('expected allowedPorts policy to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_M1_NETWORK_POLICY',
      });
    }
  });
});
