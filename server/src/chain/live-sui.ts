import { SuiGrpcClient } from '@mysten/sui/grpc';
import type { Config } from '../config.js';
import { ApiError, fail } from '../errors.js';
import { address, objectId, sha256 } from '../validation.js';
import type { BountyState, ObjectId, SubmissionState } from '../api/types.js';
import type { ChainBounty, ChainGateway, ChainSubmission } from './types.js';

type Json = Record<string, unknown>;
const field = (value: unknown): Json => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail.chain(); return value as Json; };
const text = (value: unknown): string => { if (typeof value === 'string') return value; if (typeof value === 'number' || typeof value === 'bigint') return String(value); throw fail.chain(); };
const canonicalBase64 = (value: string): Buffer | null => {
  if (value.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value ? decoded : null;
};
const vectorBytes = (value: unknown): Buffer => {
  if (typeof value === 'string') {
    if (/^[0-9a-f]{64}$/.test(value)) return Buffer.from(value, 'hex');
    const decoded = canonicalBase64(value);
    if (decoded) return decoded;
  }
  if (Array.isArray(value) && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return Buffer.from(value);
  throw fail.chain();
};
const bytes = (value: unknown): string => vectorBytes(value).toString('hex');
const utf8Vector = (value: unknown): string => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(vectorBytes(value)); } catch { throw fail.chain(); }
};
const idFrom = (value: unknown): ObjectId => { if (typeof value === 'string') return objectId(value); const candidate = field(value).id; return objectId(candidate); };
const option = (value: unknown): unknown | null => { if (value === null || value === undefined) return null; if (Array.isArray(value)) return value.length === 0 ? null : value[0]; if (typeof value === 'object' && 'vec' in value) { const vec = field(value).vec; return Array.isArray(vec) && vec.length > 0 ? vec[0] : null; } return value; };
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : (() => { throw fail.chain(); })();

const bountyStates: BountyState[] = ['OPEN', 'REVIEWING', 'PAID', 'EXPIRED_REFUNDED'];
const submissionStates: SubmissionState[] = ['RESERVED', 'READY', 'REJECTED', 'ACCEPTED', 'ABANDONED'];
export function decodeBountySummary(id: ObjectId, values: Json): ChainBounty {
  const state = bountyStates[Number(values.state)];
  if (!state || typeof values.state === 'undefined') throw fail.chain();
  const accepted = option(values.accepted_submission_id);
  const rewardRaw = values.reward ?? values.balance;
  const rewardValue = rewardRaw && typeof rewardRaw === 'object' && !Array.isArray(rewardRaw) ? field(rewardRaw).value : rewardRaw ?? values.reward_mist;
  if (rewardValue === undefined) throw fail.chain();
  return { id, requester: address(values.requester), publicTaskSpec: utf8Vector(values.public_task_spec), rewardMist: text(rewardValue), deadlineMs: text(values.deadline_ms), state, acceptedSubmissionId: accepted === null ? null : idFrom(accepted), readySubmissionCount: Number(text(values.ready_submission_count)), checkpoint: text(values.checkpoint ?? values.policy_revision), submissionIds: list(values.submission_ids).map(idFrom), policyRevision: text(values.policy_revision ?? values.checkpoint) };
}
export function decodeSubmissionSummary(id: ObjectId, values: Json): ChainSubmission {
  const state = submissionStates[Number(values.state)];
  if (!state || typeof values.state === 'undefined') throw fail.chain();
  const blobId = option(values.blob_id); const digest = option(values.ciphertext_digest); const finalized = option(values.finalized_at_ms);
  const grants = list(values.reviewer_grants).map((raw) => { const grant = field(raw); return { reviewer: address(grant.reviewer), expiresAtMs: text(grant.expires_at_ms), revoked: grant.revoked === true, grantRevision: text(grant.grant_revision) }; });
  return { id, bountyId: idFrom(values.bounty_id), contributor: address(values.contributor), contentCommitment: sha256(bytes(values.content_commitment), 'contentCommitment'), state, blobId: blobId === null ? null : utf8Vector(blobId), ciphertextDigest: digest === null ? null : sha256(bytes(digest), 'ciphertextDigest'), storageEndEpoch: option(values.storage_end_epoch) === null ? null : text(option(values.storage_end_epoch)), reservedAtMs: text(values.reserved_at_ms), finalizedAtMs: finalized === null ? null : text(finalized), reviewerGrants: grants };
}

export class LiveSuiGateway implements ChainGateway {
  private readonly client: SuiGrpcClient;
  constructor(private readonly config: Config) { this.client = new SuiGrpcClient({ network: 'testnet', baseUrl: config.suiGrpcUrl }); }
  async health(): Promise<boolean> { try { await this.client.getBalance({ owner: '0x0000000000000000000000000000000000000000000000000000000000000000' }); return true; } catch { return false; } }
  async readBounty(id: ObjectId): Promise<ChainBounty> { return decodeBountySummary(id, await this.objectFields(id, 'Bounty')); }
  async readSubmission(id: ObjectId): Promise<ChainSubmission> { return decodeSubmissionSummary(id, await this.objectFields(id, 'Submission')); }
  private async objectFields(id: ObjectId, expected: 'Bounty' | 'Submission'): Promise<Json> {
    if (!this.config.packageId) throw new ApiError('CHAIN_UNAVAILABLE', 'DataBounty package is not configured', 503);
    try {
      const response = await this.client.getObject({ objectId: id, include: { json: true } });
      const object = response.object as unknown as { type?: unknown; json?: unknown } | undefined;
      if (!object || typeof object.type !== 'string' || object.type !== `${this.config.packageId}::databounty::${expected}`) throw fail.chain();
      return field(object.json);
    } catch (error) { if (error instanceof ApiError) throw error; throw fail.chain(); }
  }
}
