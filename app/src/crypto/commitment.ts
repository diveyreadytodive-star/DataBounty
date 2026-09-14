import { bcsU16, bcsVector } from './bcs';
import { concat, fromHex, hex, sha256, utf8 } from './bytes';
import type { ObjectId } from '../domain';

export const COMMITMENT_DOMAIN = 'databounty-content-v1';
export const BUNDLE_VERSION = 1;
export const MAX_CONTENT_BYTES = 200 * 1024;
export interface SubmissionBundleV1 { formatVersion: 1; bountyId: ObjectId; submissionId: ObjectId; salt: Uint8Array; content: Uint8Array; }
function assertFixed(value: Uint8Array, label: string): void { if (value.length !== 32) throw new Error(`${label} must be exactly 32 bytes.`); }
export function assertSubmissionBundle(bundle: SubmissionBundleV1): void {
  if (bundle.formatVersion !== 1) throw new Error('Unsupported DataBounty bundle version.');
  assertFixed(fromHex(bundle.bountyId, 32), 'Bounty ID'); assertFixed(fromHex(bundle.submissionId, 32), 'Submission ID'); assertFixed(bundle.salt, 'Submission salt');
  if (bundle.content.length > MAX_CONTENT_BYTES) throw new Error('Submissions must be 200 KiB or smaller.');
  try { new TextDecoder('utf-8', { fatal: true }).decode(bundle.content); } catch { throw new Error('Submissions must be valid UTF-8.'); }
}
export function encodeSealIdentity(bountyId: ObjectId, submissionId: ObjectId): Uint8Array { return concat(fromHex(bountyId, 32), fromHex(submissionId, 32)); }
export function encodeSubmissionBundle(bundle: SubmissionBundleV1): Uint8Array { assertSubmissionBundle(bundle); return concat(bcsU16(bundle.formatVersion), fromHex(bundle.bountyId, 32), fromHex(bundle.submissionId, 32), bundle.salt, bcsVector(bundle.content)); }
function takeUleb(bytes: Uint8Array, offset: number): [number, number] { let value = 0; let shift = 0; for (let index = offset; index < bytes.length && index < offset + 5; index += 1) { const next = bytes[index]!; value += (next & 0x7f) * 2 ** shift; if ((next & 0x80) === 0) return [value, index + 1]; shift += 7; } throw new Error('Bundle has an invalid BCS length.'); }
function fixed(bytes: Uint8Array, offset: number, size: number): [Uint8Array, number] { const end = offset + size; if (end > bytes.length) throw new Error('Bundle is truncated.'); return [bytes.slice(offset, end), end]; }
function vector(bytes: Uint8Array, offset: number): [Uint8Array, number] { const [length, start] = takeUleb(bytes, offset); const end = start + length; if (end > bytes.length) throw new Error('Bundle is truncated.'); return [bytes.slice(start, end), end]; }
export function decodeSubmissionBundle(bytes: Uint8Array): SubmissionBundleV1 {
  if (bytes.length < 2 || bytes[0] !== 1 || bytes[1] !== 0) throw new Error('Unsupported DataBounty bundle version.');
  let offset = 2; let part: Uint8Array;
  [part, offset] = fixed(bytes, offset, 32); const bountyId = `0x${hex(part)}` as ObjectId;
  [part, offset] = fixed(bytes, offset, 32); const submissionId = `0x${hex(part)}` as ObjectId;
  [part, offset] = fixed(bytes, offset, 32); const salt = part;
  const [content, afterContent] = vector(bytes, offset); offset = afterContent;
  if (offset !== bytes.length) throw new Error('Bundle has trailing bytes.');
  const bundle = { formatVersion: 1 as const, bountyId, submissionId, salt, content }; assertSubmissionBundle(bundle); return bundle;
}
export async function createCommitment(content: Uint8Array, salt: Uint8Array): Promise<{ contentDigest: string; contentCommitment: string }> { assertFixed(salt, 'Submission salt'); if (content.length > MAX_CONTENT_BYTES) throw new Error('Submissions must be 200 KiB or smaller.'); const contentDigest = await sha256(content); const commitment = await sha256(concat(utf8(COMMITMENT_DOMAIN), salt, content)); return { contentDigest: hex(contentDigest), contentCommitment: hex(commitment) }; }
export function randomHex(bytes = 32): string { return hex(crypto.getRandomValues(new Uint8Array(bytes))); }
