import type { SpecStatus } from '@kata/shared';
import { SpecTransitionError } from './errors.js';

const MATRIX: Record<SpecStatus, readonly SpecStatus[]> = {
  draft: ['approved'],
  approved: ['in_progress'],
  in_progress: ['verifying'],
  verifying: ['done', 'failed'],
  done: [],
  failed: [],
};

export function canTransition(from: SpecStatus, to: SpecStatus): boolean {
  return MATRIX[from].includes(to);
}

export function assertTransition(from: SpecStatus, to: SpecStatus): void {
  if (!canTransition(from, to)) throw new SpecTransitionError(from, to, MATRIX[from]);
}
