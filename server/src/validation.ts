import { createHash } from 'node:crypto';
import { ApiError, fail } from './errors.js';
import type { ObjectId, Sha256Hex, SuiAddress } from './api/types.js';

const OBJECT_ID = /^0x[0-9a-f]{64}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail.invalid();
  return value as Record<string, unknown>;
}

export function requireExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const received = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (received.length !== expected.length || received.some((key, index) => key !== expected[index])) {
    throw fail.invalid('Unknown or missing request fields');
  }
}

export function nonEmptyString(value: unknown, field: string, maxBytes?: number): string {
  if (typeof value !== 'string' || value.length === 0 || (maxBytes !== undefined && Buffer.byteLength(value, 'utf8') > maxBytes)) {
    throw new ApiError(maxBytes !== undefined ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST', `${field} is invalid`);
  }
  return value;
}

export function objectId(value: unknown, field = 'objectId'): ObjectId {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) throw fail.invalid(`${field} must be a lowercase 32-byte Sui object ID`);
  return value as ObjectId;
}

export function address(value: unknown, field = 'address'): SuiAddress { return objectId(value, field) as SuiAddress; }

export function sha256(value: unknown, field = 'digest'): Sha256Hex {
  if (typeof value !== 'string' || !SHA256.test(value)) throw fail.invalid(`${field} must be a lowercase SHA-256 hex digest`);
  return value as Sha256Hex;
}

export function sha256Bytes(value: Uint8Array): Sha256Hex { return createHash('sha256').update(value).digest('hex') as Sha256Hex; }

export function base64(value: unknown, field: string, maxBytes: number): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw fail.invalid(`${field} must be base64`);
  const decoded = Buffer.from(value, 'base64');
  if (decoded.byteLength === 0 || decoded.byteLength > maxBytes || decoded.toString('base64') !== value) throw new ApiError('PAYLOAD_TOO_LARGE', `${field} is too large or malformed`);
  return decoded;
}

export function oneOf<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw fail.invalid(`${field} is invalid`);
  return value as T;
}
