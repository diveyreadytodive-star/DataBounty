# Lighthouse Demo Day runbook — 2–3 minutes

## Live proof already prepared

- Package: `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa`
- Live Bounty: `0x040467c0954dae110f222af8ca37aa3a67b4a6160454e4a42ff38bffc8ba2bd4`
- Live Submission: `0xa32ff16c3708e47511583b1548af38917a77cbc7c3bef82be7a3024fa9b31af6`
- Reserve transaction: `HWsY1oy9RZVyAJEsM8YvVWs9oMbF65DHCQiAdFwMkt7T`
- Finalize transaction: `9uf4wZcjRcM9VFmtU778Atu8VR2QK8Z6Aka1pAuEWpWe`
- Reviewer grant transaction: `HcAvLYUU5X1p4RMHeSLSdf2HWYAip1ZE78F1C5tyzrtt`
- Payout transaction: `9aDuBYceNVdKUDLdZNcq54eCB6K6WZCLVZu18TYLYcaR`
- Walrus blob: `EDoj9-ETZbZ10_wlSCTFB3Kl7py-KuDb6Qc1h9byq9c`
- Readback: 1,163 ciphertext bytes; SHA-256 matches the on-chain event digest
- Fresh post-payout Seal key request: denied with `User does not have access to one or more of the requested keys`
- Separate expiry refund: `ANznJg8AmDmSJwrRkZyELZ4XVeM2NzrGXqidSPfpKkMM`; Bounty `EXPIRED_REFUNDED`, escrow `0 MIST`
- Separate requester/contributor payout: requester `0x3974…4af2` → contributor `0xeefc…021e`; payout `73SZwma8mbsZ4ZK3rozBbva4CugEKEePjcyivxwCBhFj`

See [`artifacts/evidence/SUI-WALRUS-SEAL-LIVE-PROOF.md`](../artifacts/evidence/SUI-WALRUS-SEAL-LIVE-PROOF.md).

## 0:00–0:25 — Problem and live Task

> Teams need rare cases, but paying simply for uploads invites incomplete or duplicated data. Lighthouse makes a Task public, accepts a sealed case, checks evidence, and lets the requester approve exactly one Testnet payout.

Show the public Task board, open the live `PAID` Task, then select the ACCEPTED Submission.

## 0:25–0:55 — Prove Sui + Walrus + Seal

Show the Submission fields: `ACCEPTED`, Walrus blob ID, ciphertext digest, and end epoch.

> This is not a mock storage label. The Sui finalization transaction records the Walrus blob and digest. We read the encrypted blob back from the Walrus aggregator and verified the exact same SHA-256 hash. The payload parses as a Seal object bound to this Task and Submission.

Open the evidence document or Sui explorer links if network is slow.

## 0:55–1:35 — Reviewer grant and Groq review

1. Show the grant transaction and its exact reviewer address.
2. Open AI review and show `groq / openai/gpt-oss-20b`, `RECOMMEND_ACCEPT`, the checklist, and bytes `0–747` citation.

> The AI has no payout key. It reads only after the requester grants exact, time-limited Seal access. Every citation must exactly match the submitted bytes or the server rejects the model output.

## 1:35–2:05 — Human approval and payout

1. Show `SubmissionApproved` transaction `9aDuBYce…YcaR`.
2. Show Bounty `PAID`, Submission `ACCEPTED`, and contributor receipt in Slush activity.

> The human wallet, not AI, performs the only payout transaction. The Move contract sends the escrow once and makes the Bounty terminal.

## 2:05–2:25 — Access boundary

Use the post-approval terminal state. A fresh reviewer decrypt attempt against the same Walrus ciphertext was denied by Seal.

> Revocation cannot erase an already seen plaintext, but it blocks new Seal sessions after the policy change.

## Backup path

If a wallet or network popup is slow, use `artifacts/evidence/SUI-WALRUS-SEAL-LIVE-PROOF.md`, the Sui explorer links, and [`artifacts/screenshots/lighthouse-public-preview-2026-09-18.png`](../artifacts/screenshots/lighthouse-public-preview-2026-09-18.png). They show verified reservation, finalization, Walrus readback, Seal binding, reviewer grant, Groq review, payout, and the post-payout fresh Seal denial.

## Known live-demo limit

The completed live run used the same Testnet wallet for requester and contributor roles. It proves the contract and integrations but does not substitute for a separate-wallet rehearsal. Before Demo Day, run one short second pass with a distinct contributor wallet if time allows.
