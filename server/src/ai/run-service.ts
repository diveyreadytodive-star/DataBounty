import type { DuplicateCandidate, ObjectId, ReviewChecklistItem, ReviewCitation, ReviewRequest, ReviewResponse, ReviewStatusResponse, SuiAddress } from '../api/types.js';
import type { ChainBounty, ChainGateway, ChainSubmission } from '../chain/types.js';
import { reviewerGrantAllows } from '../chain/types.js';
import type { SealReader } from '../seal/reader.js';
import { assertEncryptedObjectBinding, contentCommitment } from '../seal/reader.js';
import type { WalrusStorage } from '../storage/walrus.js';
import { ProviderOutcomeUnknownError, type AiProvider, type ReviewProviderOutput } from './provider.js';
import { DraftProofDb } from '../db/database.js';
import { ApiError, fail } from '../errors.js';
import { sha256Bytes } from '../validation.js';

type Loaded = { submission: ChainSubmission; content: Uint8Array };
export function validateComparisonSubmissionIds(targetId: ObjectId, comparisonIds: ObjectId[]): void {
  if (comparisonIds.length > 5 || new Set(comparisonIds).size !== comparisonIds.length || comparisonIds.includes(targetId)) {
    throw fail.invalid('comparisonSubmissionIds must contain at most five unique IDs and exclude the target');
  }
}
export class ReviewService {
  constructor(private readonly db: DraftProofDb, private readonly chain: ChainGateway, private readonly storage: WalrusStorage, private readonly seal: SealReader, private readonly provider: AiProvider, private readonly packageId?: ObjectId) {}
  async run(requester: SuiAddress, bountyId: ObjectId, request: ReviewRequest): Promise<ReviewResponse> {
    const targetId = request.submissionId; const comparisonIds = request.comparisonSubmissionIds;
    // Validate the complete comparison list before reading chain state or
    // touching Seal, Walrus, the database, or the provider.
    validateComparisonSubmissionIds(targetId, comparisonIds);
    const bounty = await this.chain.readBounty(bountyId); if (bounty.requester !== requester) throw fail.forbidden('Only the bounty requester can request a review');
    const run = this.db.createReview(request.requestId, requester, bountyId, targetId, comparisonIds); if (!run) throw new ApiError('DUPLICATE_REQUEST', 'requestId has already been used', 409);
    try {
      const target = await this.checkedTarget(bounty, targetId); const comparisons: ChainSubmission[] = [];
      for (const id of comparisonIds) { const sub = await this.chain.readSubmission(id); const ownerBounty = await this.chain.readBounty(sub.bountyId); if (ownerBounty.requester !== requester || sub.state !== 'ACCEPTED' || sub.bountyId === bountyId) throw fail.forbidden('Comparisons must be ACCEPTED submissions from another bounty owned by the requester'); comparisons.push(sub); }
      const reviewer = this.seal.delegateAddress('reviewer');
      if (!reviewerGrantAllows(target, reviewer) || comparisons.some((sub) => !reviewerGrantAllows(sub, reviewer))) throw new ApiError('ACCESS_REVOKED', 'Reviewer does not have a current exact grant', 403);
      const loadedTarget = await this.readSubmission(bounty, target, reviewer); const comparisonBounties = await Promise.all(comparisons.map((sub) => this.chain.readBounty(sub.bountyId))); const loadedComparisons = await Promise.all(comparisons.map((sub, index) => this.readSubmission(comparisonBounties[index]!, sub, reviewer)));
      const generated = await this.provider.generateReview({ role: 'reviewer', taskSpec: bounty.publicTaskSpec, target: { submissionId: targetId, content: loadedTarget.content }, comparisons: loadedComparisons.map((item) => ({ submissionId: item.submission.id, content: item.content })) });
      this.validateReview(generated, targetId, loadedTarget.content, comparisons, loadedComparisons);
      const response: ReviewResponse = { requestId: request.requestId, recommendation: generated.recommendation, checklist: generated.checklist, duplicateCandidates: generated.duplicateCandidates, citations: generated.citations, provider: this.provider.providerName?.() ?? 'openai-compatible', model: generated.model, completedAt: new Date().toISOString() };
      await this.assertFreshAccess(bountyId, targetId, comparisons, reviewer); const responseHash = sha256Bytes(Buffer.from(JSON.stringify(response), 'utf8')); this.db.updateReview(run.runId, 'SUCCEEDED', null, response.provider, response.model, responseHash); return response;
    } catch (error) {
      if (!(error instanceof ApiError)) { this.db.updateReview(run.runId, 'UNKNOWN', 'MODEL_UNAVAILABLE'); throw new ProviderOutcomeUnknownError(); }
      const status = error.code === 'CANCELLED_ACCESS_CHANGED' ? 'CANCELLED_ACCESS_CHANGED' : error instanceof ProviderOutcomeUnknownError ? 'UNKNOWN' : 'REJECTED'; this.db.updateReview(run.runId, status, error.code); throw error;
    }
  }
  status(requester: SuiAddress, bountyId: ObjectId, requestId: string): ReviewStatusResponse {
    const row = this.db.getReviewByRequest(requestId); if (!row || row.requester !== requester || row.bountyId !== bountyId) throw fail.forbidden();
    return { requestId: row.requestId, status: row.status, requester: row.requester, bountyId: row.bountyId, submissionId: row.submissionId, comparisonSubmissionIds: JSON.parse(row.comparisonSubmissionIdsJson) as ObjectId[], provider: row.provider, model: row.model, responseHash: row.responseHash, createdAt: row.createdAt, updatedAt: row.updatedAt, resultAvailable: false };
  }
  private async checkedTarget(bounty: ChainBounty, id: ObjectId): Promise<ChainSubmission> { const target = await this.chain.readSubmission(id); if (target.bountyId !== bounty.id) throw new ApiError('INVALID_BINDING', 'Submission does not belong to the requested bounty'); if (target.state !== 'READY') throw new ApiError('NOT_READY', 'Only READY submissions can be reviewed'); return target; }
  private async readSubmission(bounty: ChainBounty, submission: ChainSubmission, reviewer: SuiAddress): Promise<Loaded> { if (submission.bountyId !== bounty.id || !submission.blobId || !submission.ciphertextDigest) throw new ApiError('INVALID_BINDING', 'Submission metadata is not bound to its bounty'); if (!reviewerGrantAllows(submission, reviewer)) throw new ApiError('ACCESS_REVOKED', 'Reviewer grant is not current', 403); const ciphertext = await this.storage.read(submission.blobId); if (sha256Bytes(ciphertext) !== submission.ciphertextDigest) throw new ApiError('INTEGRITY_FAILED', 'Ciphertext digest differs from onchain metadata'); if (!this.packageId) throw new ApiError('INVALID_BINDING', 'DataBounty package is not configured', 503); assertEncryptedObjectBinding(ciphertext, this.packageId, bounty.id, submission.id); const bundle = await this.seal.decrypt({ role: 'reviewer', bountyId: bounty.id, submissionId: submission.id, ciphertext }); if (bundle.bountyId !== bounty.id || bundle.submissionId !== submission.id || contentCommitment(bundle.salt, bundle.content) !== submission.contentCommitment) throw new ApiError('INTEGRITY_FAILED', 'Decrypted submission does not match its onchain commitment'); return { submission, content: bundle.content }; }
  private async assertFreshAccess(bountyId: ObjectId, targetId: ObjectId, comparisons: ChainSubmission[], reviewer: SuiAddress): Promise<void> { const target = await this.chain.readSubmission(targetId); if (target.bountyId !== bountyId || target.state !== 'READY' || !reviewerGrantAllows(target, reviewer)) throw new ApiError('CANCELLED_ACCESS_CHANGED', 'Reviewer access changed before the result could be returned', 409); for (const expected of comparisons) { const current = await this.chain.readSubmission(expected.id); if (current.state !== 'ACCEPTED' || !reviewerGrantAllows(current, reviewer)) throw new ApiError('CANCELLED_ACCESS_CHANGED', 'Reviewer access changed before the result could be returned', 409); } }
  private validateReview(generated: ReviewProviderOutput, targetId: ObjectId, targetContent: Uint8Array, comparisons: ChainSubmission[], loadedComparisons: Loaded[]): void {
    const allowed = new Map<ObjectId, Uint8Array>([[targetId, targetContent], ...loadedComparisons.map((s) => [s.submission.id, s.content] as [ObjectId, Uint8Array])]);
    if (!['RECOMMEND_ACCEPT','RECOMMEND_REJECT','NEEDS_HUMAN_REVIEW'].includes(generated.recommendation) || !Array.isArray(generated.checklist) || !Array.isArray(generated.duplicateCandidates) || !Array.isArray(generated.citations) || generated.citations.length === 0) throw new ApiError('INTEGRITY_FAILED', 'AI review output is malformed');
    const citationIds = generated.citations.map((_c, index) => index); const checkIds = (ids: unknown) => Array.isArray(ids) && ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id >= 0 && id < generated.citations.length);
    for (const item of generated.checklist as ReviewChecklistItem[]) { if (!item || Object.keys(item).sort().join(',') !== 'citationIds,field,status' || typeof item.field !== 'string' || !['PRESENT','MISSING','UNCLEAR'].includes(item.status) || !checkIds(item.citationIds)) throw new ApiError('INTEGRITY_FAILED', 'AI checklist is malformed'); }
    for (const item of generated.duplicateCandidates as DuplicateCandidate[]) { if (!item || Object.keys(item).sort().join(',') !== 'citationIds,submissionId,verdict' || !comparisons.some((s) => s.id === item.submissionId) || !['NONE','POSSIBLE'].includes(item.verdict) || !checkIds(item.citationIds)) throw new ApiError('INTEGRITY_FAILED', 'AI duplicate result is malformed'); }
    for (const citation of generated.citations as ReviewCitation[]) { const source = allowed.get(citation.submissionId); if (!citation || Object.keys(citation).sort().join(',') !== 'endByte,quote,startByte,submissionId' || !source || typeof citation.quote !== 'string' || !Number.isSafeInteger(citation.startByte) || !Number.isSafeInteger(citation.endByte) || citation.startByte < 0 || citation.endByte <= citation.startByte || citation.endByte > source.byteLength) throw new ApiError('INTEGRITY_FAILED', 'Citation does not reference an allowed input byte range'); const exact = source.slice(citation.startByte, citation.endByte); if (!Buffer.from(exact).equals(Buffer.from(citation.quote, 'utf8'))) throw new ApiError('INTEGRITY_FAILED', 'Citation quote does not exactly match source UTF-8 bytes'); }
    void citationIds;
  }
}
export { ReviewService as AiRunService };
