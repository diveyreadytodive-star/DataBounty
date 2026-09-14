# DataBounty implementation brief for Luna

작성: 2026-09-14 · 상태: implementation contract · 설계 감독: Terra · 구현: Luna

Implement a new package module `<DATABOUNTY_PACKAGE_ID>::databounty::databounty`. `DATABOUNTY_PACKAGE_ID` must be explicit in app/server configuration after deployment. Disable chain actions when it is absent; do not fall back to the current DraftProof package.

## Fixed Move ABI

```move
public entry fun create_bounty(public_task_spec: vector<u8>, deadline_ms: u64, reward: Coin<SUI>, clock: &Clock, ctx: &mut TxContext)
public entry fun reserve_submission(bounty: &mut Bounty, content_commitment: vector<u8>, clock: &Clock, ctx: &mut TxContext)
public entry fun finalize_submission(bounty: &mut Bounty, submission: &mut Submission, blob_id: vector<u8>, ciphertext_digest: vector<u8>, storage_end_epoch: u64, clock: &Clock, ctx: &mut TxContext)
public entry fun abandon_submission(bounty: &Bounty, submission: &mut Submission, clock: &Clock, ctx: &mut TxContext)
public entry fun grant_reviewer_read(bounty: &Bounty, submission: &mut Submission, reviewer: address, expires_at_ms: u64, clock: &Clock, ctx: &mut TxContext)
public entry fun revoke_reviewer_read(bounty: &Bounty, submission: &mut Submission, reviewer: address, clock: &Clock, ctx: &mut TxContext)
public entry fun reject_submission(bounty: &mut Bounty, submission: &mut Submission, clock: &Clock, ctx: &mut TxContext)
public entry fun approve_submission_and_pay(bounty: &mut Bounty, submission: &mut Submission, clock: &Clock, ctx: &mut TxContext)
public entry fun cancel_open_bounty(bounty: &mut Bounty, clock: &Clock, ctx: &mut TxContext)
public entry fun refund_expired_bounty(bounty: &mut Bounty, clock: &Clock, ctx: &mut TxContext)
entry fun seal_approve(identity: vector<u8>, bounty: &Bounty, submission: &Submission, clock: &Clock, ctx: &TxContext)
```

`reserve_submission` emits the newly created Submission ID; the browser extracts it from the confirmed wallet transaction before creating the identity and bundle. `content_commitment` and `ciphertext_digest` are exactly 32 bytes. `approve_submission_and_pay` takes no recipient/amount and transfers the entire balance to `submission.contributor`; it revokes reviewer access atomically. `refund_expired_bounty` is allowed with READY candidates after expiry. Define and test small bounds for public-spec bytes, Bounty submissions, and reviewer grants before coding; they are not specified by the goal.

## Shared API types

```ts
type BountyState = 'OPEN' | 'REVIEWING' | 'PAID' | 'EXPIRED_REFUNDED';
type SubmissionState = 'RESERVED' | 'READY' | 'REJECTED' | 'ACCEPTED' | 'ABANDONED';
type ReviewRecommendation = 'RECOMMEND_ACCEPT' | 'RECOMMEND_REJECT' | 'NEEDS_HUMAN_REVIEW';

interface BountySummary { id: ObjectId; requester: SuiAddress; publicTaskSpec: string; rewardMist: string; deadlineMs: string; state: BountyState; acceptedSubmissionId: ObjectId | null; readySubmissionCount: number; checkpoint: string; }
interface SubmissionSummary { id: ObjectId; bountyId: ObjectId; contributor: SuiAddress; contentCommitment: Sha256Hex; state: SubmissionState; blobId: WalrusBlobId | null; ciphertextDigest: Sha256Hex | null; storageEndEpoch: string | null; reservedAtMs: string; finalizedAtMs: string | null; }
interface ReviewCitation { submissionId: ObjectId; quote: string; startByte: number; endByte: number; }
interface ReviewResponse { requestId: string; recommendation: ReviewRecommendation; checklist: { field: string; status: 'PRESENT' | 'MISSING' | 'UNCLEAR'; citationIds: number[] }[]; duplicateCandidates: { submissionId: ObjectId; verdict: 'NONE' | 'POSSIBLE'; citationIds: number[] }[]; citations: ReviewCitation[]; provider: string; model: string; completedAt: string; }
```

Keep the current personal-message session and same-origin guard. Replace the old Workspace routes with:

| Route | Contract |
|---|---|
| `GET /api/bounties/:bountyId` | live Bounty/submission summaries; requester sees all metadata, contributor only own status; never plaintext |
| `POST /api/storage/publish` | `{ bountyId, submissionId, ciphertextBase64, ciphertextDigest }`; session address must equal live contributor and RESERVED parent match; validates Seal header then Walrus publishes/readbacks |
| `POST /api/bounties/:bountyId/reviews` | `{ requestId, submissionId, comparisonSubmissionIds }`; session requester only; target READY; comparisons ACCEPTED/same requester; live exact reviewer grants required |
| `GET /api/bounties/:bountyId/reviews/:requestId` | metadata status only; completed body is non-replayable |

There is no approval, payout, or server transaction relay API. Wallet-signed browser transactions perform grants, reject, approve-and-pay, cancellation, and refund.

Review sequence is fixed: live state → exact grants → Walrus digest → Seal header → fresh decrypt → bundle IDs/UTF-8/commitment → model → strict citations → live recheck. Store only metadata and response hash; never plaintext, prompt, review body, or provider response in DB/logs.

## Browser wire contract

```ts
type SealIdentityV1 = { bountyId: Uint8Array /*32*/; submissionId: Uint8Array /*32*/ };
type SubmissionBundleV1 = { formatVersion: 1; bountyId: Uint8Array; submissionId: Uint8Array; salt: Uint8Array; content: Uint8Array };
```

`encodeSealIdentity` serializes the two fixed arrays in BCS order and returns 64 bytes. `encodeSubmissionBundle` uses exactly the listed field order and does not include filename/title. Generate the 32-byte salt before `reserve_submission`, because it is required to compute the on-chain `content_commitment`. The reservation transaction then reveals the exact Submission ID; include that ID only when constructing the BCS Seal identity and encrypted submission bundle. IndexedDB may retain only ciphertext/retry receipt under compound Bounty+Submission key; localStorage/IndexedDB must never retain plaintext, salt, or filename.

## Luna execution order

1. Add `contracts/sources/databounty.move` and `contracts/tests/databounty_tests.move`; update `Move.toml`. Do not delete or relabel historical DraftProof source until the new tests pass.
2. Replace types/parsers in `server/src/api/types.ts`, `server/src/chain/types.ts`, and `server/src/chain/live-sui.ts`; unknown old types fail closed.
3. Update `server/src/config.ts`, `server/src/seal/reader.ts`, `server/src/db/database.ts`, `server/src/app.ts`, and `server/src/ai/run-service.ts` together. Replace planner/writer assumptions with one reviewer delegate and remove DraftProof package defaults.
4. Update `app/src/domain.ts`, `app/src/chain/transactions.ts`, `app/src/crypto/{bcs,commitment,seal}.ts`, `app/src/storage/recovery.ts`, `app/src/api/client.ts`, `app/src/features/useDraftProof.ts`, and `app/src/App.tsx` for create/fund, submit, review, reject, approve, cancel, and refund.
5. Run Move/app/server tests, typecheck, lint, build. Then publish new package, set explicit config, verify source, and collect D01–D13 live evidence.

Cross-requester comparisons and deterministic schema/rights validation are out of scope. If funded wallets or current Sui/Walrus/Seal/model credentials are unavailable, report the affected live criteria incomplete while continuing local implementation and tests.
