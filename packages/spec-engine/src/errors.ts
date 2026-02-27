import type { SpecStatus } from '@kata/shared';

export class SpecTransitionError extends Error {
  constructor(
    public readonly from: SpecStatus,
    public readonly to: SpecStatus,
    public readonly allowedNext: readonly SpecStatus[],
  ) {
    super(`Invalid spec transition: ${from} -> ${to}. Allowed: ${allowedNext.join(', ') || 'none'}`);
    this.name = 'SpecTransitionError';
  }
}
