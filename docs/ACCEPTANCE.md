# DataBounty acceptance and evidence matrix

작성: 2026-09-14 · 상태: Luna implementation gate · 기준: `GOAL-PROMPT.md`, `docs/ARCHITECTURE.md`

All demonstrations use synthetic phishing text. Mocks, simulations, or unit tests cannot replace a row requiring live Testnet, Walrus, Seal, model, or browser evidence. Evidence must never contain plaintext, salts, filenames, session cookies, private keys, or provider credentials.

| ID | Requirement | Automated proof | Required live evidence |
|---|---|---|---|
| D01 | requester creates future-deadline Bounty with nonzero Testnet SUI escrow | Move rejects zero reward/invalid spec/deadline | create transaction, new Bounty ID, object reward/deadline |
| D02 | contributor reserves, encrypts, publishes, readbacks, and finalizes one <=200 KiB synthetic submission | BCS/commitment/UTF-8/size and lifecycle tests | reservation + READY transaction, Walrus blob/digest/end epoch |
| D03 | identity is exact `BCS(bounty_id, submission_id)` | browser/server/Move 64-byte golden vector; swapped/truncated/modified failures | ciphertext header plus fresh authorized decrypt for exact pair |
| D04 | requester/contributor/active reviewer access only | Seal permission matrix and server provider-call-zero denial tests | fresh unauthorized key request denied; authorized requester/reviewer success |
| D05 | requester review reads only selected READY target and same-requester selected ACCEPTED comparisons | chain state, grant, parent, digest/bundle validation tests | configured local reviewer returns actual review for exact IDs |
| D06 | AI output has recommendation/checklist/duplicates and exact UTF-8 citations | malformed/range/ambiguous citation fixtures fail closed | review card with human-checkable synthetic citations/provider/model |
| D07 | AI, contributor, and arbitrary wallet cannot pay escrow | no-payout-route test and Move unauthorized payment tests | chain failure attempts with no state or balance movement |
| D08 | requester can reject without payout | Move sender/state tests | REJECTED transaction; escrow unchanged; fresh reviewer denial |
| D09 | requester approves exactly one READY Submission and pays full escrow once | exact-parent/nonrequester/paid-again/substitution Move tests | approval transaction, accepted ID, contributor receipt, second payout failure |
| D10 | pre-deadline cancellation fails if READY exists | ready-count and Clock-boundary Move tests | failed cancel after READY, no reward movement |
| D11 | deadline refund is requester-only and terminal | `now < deadline`, `now == deadline`, PAID/refunded tests | separate expiry/refund Bounty and post-refund deny |
| D12 | no plaintext/salt/filename/key/review body in DB/logs | DB schema and logger-capture tests, secret scan | redacted post-run DB/log inspection |
| D13 | requester/contributor browser workflow is usable and wallet-signed | transaction-builder/component tests | two wallet sessions: create, submit, review, reject/approve or refund; mobile core controls |

## Required Move invariants

1. Bounty reward exits once only as contributor payout or requester refund.
2. Approval checks requester sender, exact parent, READY Submission, nonterminal Bounty, and deadline before mutation.
3. `accepted_submission_id` equals the one ACCEPTED Submission for a PAID Bounty.
4. Contributor alone reserves/finalizes/abandons; requester alone grants/revokes/rejects/approves/refunds.
5. READY metadata and commitment are immutable; terminal Submission states never re-enter READY.
6. reserve/finalize require `now < deadline`; expiry refund permits `now >= deadline`; UI time is never authority.
7. pre-deadline cancellation requires `ready_submission_count == 0`, with count/state updated atomically on READY entry/exit.
8. Seal approval checks canonical 64-byte identity, current Bounty/Submission relation, state, and exact grant.
9. AI recommendation/status/retry has no Move side effect and cannot create a payment transaction.

## Test and live-evidence checklist

| Layer | Minimum scope |
|---|---|
| Move | escrow creation, lifecycle sender guards, parent substitution, Clock boundaries, reviewer grant/revoke, Seal matrix, one-time payout, cancel/refund |
| Browser | BCS identity/bundle vectors, commitment, UTF-8/size, transaction argument order, ciphertext-only recovery |
| Server | requester/contributor auth, live rereads, Walrus digest, Seal/bundle mismatch, comparison scope, provider capture, citations, idempotency, log/DB redaction, absence of payout API |
| Integration | real Testnet package/source verification, Walrus ciphertext readback, fresh Seal allow/deny, actual configured model review, real payout and separate refund |
| Browser E2E | requester and contributor sessions, every wallet-signing action, error states, mobile reachability |

`artifacts/verification.md` may be updated only after the above evidence exists. Each final item records public package/Bounty/Submission/transaction/blob identifiers, statuses, commands, and limits; it must not expose the protected data listed above. Current DraftProof evidence does not satisfy D01–D13.
