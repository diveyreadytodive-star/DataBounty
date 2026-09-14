export type SuiNetwork = 'testnet';
export type SuiAddress = `0x${string}`;
export type ObjectId = `0x${string}`;
export type TransactionDigest = string;
export type WalrusBlobId = string;
export type Sha256Hex = string;
export type AgentRole = 'reviewer';
export type BountyState = 'OPEN' | 'REVIEWING' | 'PAID' | 'EXPIRED_REFUNDED';
export type SubmissionState = 'RESERVED' | 'READY' | 'REJECTED' | 'ACCEPTED' | 'ABANDONED';
export type ReviewRecommendation = 'RECOMMEND_ACCEPT' | 'RECOMMEND_REJECT' | 'NEEDS_HUMAN_REVIEW';
export type ReviewFieldStatus = 'PRESENT' | 'MISSING' | 'UNCLEAR';
export type ReviewStatus = 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'UNKNOWN' | 'CANCELLED_ACCESS_CHANGED';
export type DependencyStatus = 'ok' | 'degraded' | 'blocked';

export type ErrorCode =
  | 'INVALID_REQUEST' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NETWORK_MISMATCH'
  | 'NOT_READY' | 'ACCESS_EXPIRED' | 'ACCESS_REVOKED' | 'INVALID_BINDING'
  | 'INTEGRITY_FAILED' | 'PAYLOAD_TOO_LARGE' | 'DUPLICATE_REQUEST'
  | 'CHAIN_UNAVAILABLE' | 'STORAGE_UNAVAILABLE' | 'MODEL_UNAVAILABLE'
  | 'UNSUPPORTED_OPERATION' | 'RESULT_NOT_REPLAYABLE' | 'CANCELLED_ACCESS_CHANGED';

export interface ApiErrorResponse { error: { code: ErrorCode; message: string; retryable: boolean; requestId?: string }; }
export interface AuthChallengeRequest { address: SuiAddress; }
export interface AuthChallengeResponse { challengeId: string; message: string; network: 'testnet'; expiresAt: string; }
export interface AuthVerifyRequest { challengeId: string; message: string; signature: string; }
export interface AuthVerifyResponse { address: SuiAddress; network: 'testnet'; expiresAt: string; }
/** Public reviewer metadata. The address is nullable when the server is not configured for AI review. */
export interface AgentDescriptor { role: AgentRole; displayName: string; delegateAddress: SuiAddress | null; }
/** Revision is diagnostic chain metadata only; authorization uses reviewer, expiry, and revoked. */
export interface ReviewerGrantSummary { reviewer: SuiAddress; expiresAtMs: string; revoked: boolean; grantRevision: string; }
export interface BountySummary { id: ObjectId; requester: SuiAddress; publicTaskSpec: string; rewardMist: string; deadlineMs: string; state: BountyState; acceptedSubmissionId: ObjectId | null; readySubmissionCount: number; checkpoint: string; }
export interface SubmissionSummary { id: ObjectId; bountyId: ObjectId; contributor: SuiAddress; contentCommitment: Sha256Hex; state: SubmissionState; blobId: WalrusBlobId | null; ciphertextDigest: Sha256Hex | null; storageEndEpoch: string | null; reservedAtMs: string; finalizedAtMs: string | null; }
export interface BountyResponse { bounty: BountySummary; submissions: SubmissionSummary[]; }
export interface StoragePublishRequest { bountyId: ObjectId; submissionId: ObjectId; ciphertextBase64: string; ciphertextDigest: Sha256Hex; }
export interface StoragePublishResponse { bountyId: ObjectId; submissionId: ObjectId; blobId: WalrusBlobId; ciphertextDigest: Sha256Hex; storageEndEpoch: string; publisherReceipt: string; verifiedDownloadAt: string; }
export interface ReviewRequest { requestId: string; submissionId: ObjectId; comparisonSubmissionIds: ObjectId[]; }
export interface ReviewCitation { submissionId: ObjectId; quote: string; startByte: number; endByte: number; }
export interface ReviewChecklistItem { field: string; status: ReviewFieldStatus; citationIds: number[]; }
export interface DuplicateCandidate { submissionId: ObjectId; verdict: 'NONE' | 'POSSIBLE'; citationIds: number[]; }
export interface ReviewResponse { requestId: string; recommendation: ReviewRecommendation; checklist: ReviewChecklistItem[]; duplicateCandidates: DuplicateCandidate[]; citations: ReviewCitation[]; provider: string; model: string; completedAt: string; }
export interface ReviewStatusResponse { requestId: string; status: ReviewStatus; requester: SuiAddress; bountyId: ObjectId; submissionId: ObjectId; comparisonSubmissionIds: ObjectId[]; provider: string | null; model: string | null; responseHash: Sha256Hex | null; createdAt: string; updatedAt: string; resultAvailable: false; }
export interface HealthResponse { status: DependencyStatus; network: 'testnet'; packageConfigured: boolean; dependencies: { sqlite: DependencyStatus; sui: DependencyStatus; seal: DependencyStatus; walrusPublisher: DependencyStatus; walrusAggregator: DependencyStatus; ai: DependencyStatus; }; }
