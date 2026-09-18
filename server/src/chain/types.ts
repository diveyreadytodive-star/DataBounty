import type { BountyState, BountySummary, ObjectId, ReviewerGrantSummary, SuiAddress, SubmissionState, SubmissionSummary } from '../api/types.js';

// The published Bounty ABI exposes policy_revision as observed metadata. The
// app does not claim to track grant revisions because &Bounty grant/revoke
// cannot safely mutate a caller supplied revision under the fixed ABI.
export interface ChainBounty extends BountySummary { submissionIds: ObjectId[]; policyRevision: string; }
export interface ChainSubmission extends SubmissionSummary { reviewerGrants: ReviewerGrantSummary[]; }
export interface ChainGateway { readBounty(id: ObjectId): Promise<ChainBounty>; readSubmission(id: ObjectId): Promise<ChainSubmission>; listBounties(): Promise<ChainBounty[]>; health(): Promise<boolean>; }
export function reviewerGrantAllows(submission: ChainSubmission, reviewer: SuiAddress, now = Date.now()): boolean {
  return submission.reviewerGrants.some((grant) => grant.reviewer === reviewer && !grant.revoked && BigInt(grant.expiresAtMs) > BigInt(now));
}
export function isTerminalBounty(state: BountyState): boolean { return state === 'PAID' || state === 'EXPIRED_REFUNDED'; }
export function isTerminalSubmission(state: SubmissionState): boolean { return state === 'REJECTED' || state === 'ACCEPTED' || state === 'ABANDONED'; }
