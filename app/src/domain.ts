import type {
  AgentDescriptor, ApiErrorResponse, BountyResponse, BountyState, DuplicateCandidate, HealthResponse, ObjectId,
  ReviewChecklistItem, ReviewCitation, ReviewRecommendation, ReviewResponse, ReviewStatusResponse, SubmissionState,
  SubmissionSummary, SuiAddress, StoragePublishResponse,
} from '@draftproof/server/api-types';

export type { AgentDescriptor, ApiErrorResponse, BountyResponse, BountyState, DuplicateCandidate, HealthResponse, ObjectId, ReviewChecklistItem, ReviewCitation, ReviewRecommendation, ReviewResponse, ReviewStatusResponse, SubmissionState, SubmissionSummary, SuiAddress, StoragePublishResponse };
export type Bounty = BountyResponse['bounty'];

export const MAX_FILE_BYTES = 200 * 1024;
export const MAX_PUBLIC_TASK_SPEC_BYTES = 16_384;
export const MAX_REVIEW_COMPARISONS = 5;

export function isObjectId(value: string): value is ObjectId { return /^0x[0-9a-f]{64}$/.test(value); }
export function normalizeObjectId(value: string): ObjectId {
  const normalized = value.trim().toLowerCase();
  if (!isObjectId(normalized)) throw new Error('Sui object IDs must be lowercase 0x-prefixed 32-byte hex values.');
  return normalized;
}
export function formatAddress(value: string): string { return value.length < 16 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`; }
export function formatMist(mist: string): string { return `${(Number(BigInt(mist)) / 1_000_000_000).toFixed(4)} SUI`; }
export function isRequester(bounty: Bounty, address: string | undefined): boolean { return Boolean(address && bounty.requester.toLowerCase() === address.toLowerCase()); }
