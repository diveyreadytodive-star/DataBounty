import type { ErrorCode } from './api/types.js';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const fail = {
  invalid: (message = 'Request has an invalid shape') => new ApiError('INVALID_REQUEST', message),
  unauthenticated: () => new ApiError('UNAUTHENTICATED', 'Authentication is required', 401),
  forbidden: (message = 'This wallet is not allowed to perform this action') => new ApiError('FORBIDDEN', message, 403),
  chain: () => new ApiError('CHAIN_UNAVAILABLE', 'Live Sui state could not be verified', 503, true),
  storage: () => new ApiError('STORAGE_UNAVAILABLE', 'Walrus storage could not be verified', 503, true),
  model: (message = 'The configured AI model is unavailable') => new ApiError('MODEL_UNAVAILABLE', message, 503, true)
};
