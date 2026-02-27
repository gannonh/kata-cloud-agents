import type { InfraErrorCode } from './types.js';

export class InfraAdapterError extends Error {
  constructor(
    public readonly code: InfraErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InfraAdapterError';
  }
}
