import { InfraAdapterError } from '../errors.js';
import type { NetworkPolicy } from '../types.js';

export function assertM1NetworkPolicy(policy: NetworkPolicy): void {
  if (policy.allowedHosts?.length || policy.allowedPorts?.length) {
    throw new InfraAdapterError(
      'UNSUPPORTED_M1_NETWORK_POLICY',
      'allowedHosts/allowedPorts are not supported in M1',
      { policy },
    );
  }
}
