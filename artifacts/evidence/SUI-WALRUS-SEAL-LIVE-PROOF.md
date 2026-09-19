# Live Sui × Walrus × Seal proof

This evidence was gathered from the real Sui Testnet event stream and the configured Walrus Testnet aggregator. It contains no plaintext, private key, API key, wallet signature, salt, or decrypted case content.

## 1. Sui Testnet

| Event | Transaction |
| --- | --- |
| `SubmissionReserved` | [`HWsY1oy9…Mkt7T`](https://suiscan.xyz/testnet/tx/HWsY1oy9RZVyAJEsM8YvVWs9oMbF65DHCQiAdFwMkt7T) |
| `SubmissionFinalized` | [`9uf4wZcj…WpWe`](https://suiscan.xyz/testnet/tx/9uf4wZcjRcM9VFmtU778Atu8VR2QK8Z6Aka1pAuEWpWe) |
| `ReviewerReadGranted` | [`HcAvLYUU…zrtt`](https://suiscan.xyz/testnet/tx/HcAvLYUU5X1p4RMHeSLSdf2HWYAip1ZE78F1C5tyzrtt) |
| `SubmissionApproved` / payout | [`9aDuBYce…YcaR`](https://suiscan.xyz/testnet/tx/9aDuBYceNVdKUDLdZNcq54eCB6K6WZCLVZu18TYLYcaR) |
| Bounty | [`0x040467…a2bd4`](https://suiscan.xyz/testnet/object/0x040467c0954dae110f222af8ca37aa3a67b4a6160454e4a42ff38bffc8ba2bd4) |
| Submission | [`0xa32ff1…31af6`](https://suiscan.xyz/testnet/object/0xa32ff16c3708e47511583b1548af38917a77cbc7c3bef82be7a3024fa9b31af6) |

The finalized Submission recorded Walrus blob metadata and changed to `READY` in the live workflow.

## 2. Walrus Testnet

| Evidence | Value |
| --- | --- |
| Blob ID | `EDoj9-ETZbZ10_wlSCTFB3Kl7py-KuDb6Qc1h9byq9c` |
| Aggregator readback | HTTP `200`, `1,163` ciphertext bytes |
| Storage end epoch | `529` |
| On-chain SHA-256 | `c79e02c871072c54afc5af15127dfd03a0ca63ba54b4ac5a56b3ab81676e7361` |
| Readback SHA-256 | `c79e02c871072c54afc5af15127dfd03a0ca63ba54b4ac5a56b3ab81676e7361` |
| Result | exact match |

The Walrus blob contains ciphertext only. The aggregator readback hash exactly equals the digest emitted by `SubmissionFinalized` on Sui.

## 3. Seal

The downloaded Walrus ciphertext was parsed with `@mysten/seal` as an `EncryptedObject`.

| Header field | Verified value |
| --- | --- |
| Seal package ID | DataBounty Testnet package |
| Seal identity | `bountyId || submissionId` (64 bytes) |
| Threshold | `1` |
| Key server object | `0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98` |

This proves that the stored Walrus payload is a Seal encrypted object cryptographically bound to this exact Sui Bounty and Submission.

## 4. Authorized AI review and payout

The requester granted the configured reviewer an exact, time-limited read on Sui. With that grant, the server decrypted the selected Seal capsule and ran a real Groq review using `openai/gpt-oss-20b`.

| Review evidence | Result |
| --- | --- |
| Recommendation | `RECOMMEND_ACCEPT` |
| Required fields | `message`, `scam_type`, `red_flags`, `redacted_source_note` all `PRESENT` |
| Exact citation | selected submission UTF-8 bytes `0–747`, verified against the decrypted source |
| Payout transaction | `9aDuBYceNVdKUDLdZNcq54eCB6K6WZCLVZu18TYLYcaR` |
| Terminal state | Bounty `PAID`; Submission `ACCEPTED` |
| Recipient | contributor `0x3974b9…d14af2` |

The payout transaction was signed by the requester wallet, not the AI. The Move contract transferred the Testnet escrow exactly once and revoked reviewer access as part of terminal settlement.

## 5. Fresh Seal denial after payout

After terminal settlement, the server downloaded the same ciphertext from Walrus and created a new reviewer Seal session for the exact same Bounty and Submission. The Seal key server rejected that new key request with:

`User does not have access to one or more of the requested keys`

No plaintext or key material was emitted. This is the expected post-approval result: the prior reviewer grant cannot authorize a new decrypt after `SubmissionApproved` has revoked it on Sui.

## 6. Expired Bounty refund

The separate expired, empty Bounty was refunded by its requester through the Testnet UI flow.

| Evidence | Value |
| --- | --- |
| Bounty | [`0x0f0ce…018c4`](https://suiscan.xyz/testnet/object/0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4) |
| Refund transaction | [`ANznJg8A…KkMM`](https://suiscan.xyz/testnet/tx/ANznJg8AmDmSJwrRkZyELZ4XVeM2NzrGXqidSPfpKkMM) |
| Event | `BountyRefunded` |
| Terminal state | `EXPIRED_REFUNDED` |
| Remaining escrow | `0 MIST` |

## 7. Deployed Testnet application

The deployed Lighthouse app is available at [databounty-wine.vercel.app](https://databounty-wine.vercel.app). It provides wallet authentication, Bounty creation, encrypted contribution, reviewer grant, AI Review, and requester-signed payout routes for the configured Sui Testnet environment. Server secrets, plaintext submissions, salts, and decryption keys are not included in the browser bundle or this repository.

## 8. Separate-wallet Testnet settlement

A second live settlement used separate requester and contributor addresses.

| Role or event | Evidence |
| --- | --- |
| Requester | `0x3974b9…d14af2` |
| Contributor | `0xeefc56…de021e` |
| Bounty creation | [`C6z2nuBY…cQQ9`](https://suiscan.xyz/testnet/tx/C6z2nuBYT74JaNNyZSjvMu3R1pcTnBjYF7MHKpRGcQQ9) |
| Accepted encrypted submission | [`0x7c37bd…6584f`](https://suiscan.xyz/testnet/object/0x7c37bd085f4b5f6708f572fb40aa9bb4f5af861818d46f93b0b9fd353876584f) |
| Walrus finalization | [`4y3UgTZB…FDg8`](https://suiscan.xyz/testnet/tx/4y3UgTZBng7dcLPhn5AagvATbyspgyWhvnDZfBh4FDg8) |
| Requester-signed payout | [`73SZwma8…BhFj`](https://suiscan.xyz/testnet/tx/73SZwma8mbsZ4ZK3rozBbva4CugEKEePjcyivxwCBhFj) |
| Terminal state | Bounty `PAID`; accepted Submission `ACCEPTED` |

This second run independently proves that a contributor address distinct from the requester can reserve, finalize encrypted Walrus data, and receive the Testnet escrow. The first run remains the recorded Groq review and fresh Seal-denial proof.

## Boundary

This packet proves live **Sui reservation/finalization**, **Walrus publish/readback**, **Seal encryption binding**, **time-limited reviewer grant**, **Groq review with exact source citation**, **requester-signed Testnet payout**, **fresh post-payout Seal denial**, and a separate **expiry refund**. A second complete run or a verified backup recording remains to be recorded.

See the exact machine-readable values in [`sui-walrus-seal-live-2026-09-18.json`](./sui-walrus-seal-live-2026-09-18.json).
