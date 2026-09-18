# Lighthouse Testnet live evidence

Captured: `2026-09-18T03:50:48.850Z`
Network: **Sui Testnet**

## Verified Sui evidence

| Evidence | Value |
| --- | --- |
| Package | `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa` |
| Task object | `0xf2a91801c114cc0071cb897176d699a4f02b698dd782aad877a67ea0cd0615ab` |
| Task type | `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa::databounty::Bounty` |
| Create transaction | `Ao4s9mDpJsgZGMD9CagFXXots8yfiUckfRfjRkiXEmRB` |
| Event | `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa::databounty::BountyCreated` |

- [View Task object on Sui Testnet explorer](https://suiscan.xyz/testnet/object/0xf2a91801c114cc0071cb897176d699a4f02b698dd782aad877a67ea0cd0615ab)
- [View create transaction on Sui Testnet explorer](https://suiscan.xyz/testnet/tx/Ao4s9mDpJsgZGMD9CagFXXots8yfiUckfRfjRkiXEmRB)

The raw chain response is stored in [`testnet-live-2026-09-18.json`](./testnet-live-2026-09-18.json). It contains the object fields, Sui transaction effects, changed objects, and emitted events captured directly from the Testnet full node.

The current local dependency snapshot is stored in [`runtime-health-2026-09-18.json`](./runtime-health-2026-09-18.json). It confirms reachable Sui, Seal, Walrus publisher, Walrus aggregator, and AI services, but is not itself a storage or access-control proof.

## Walrus and Seal status

**Not yet proven live.** A live contributor upload has not completed, so this packet does not claim a Walrus blob, aggregator readback, or Seal reviewer grant. The required evidence after submission is:

1. `blobId` and `storageEndEpoch` from Walrus publisher.
2. Aggregator readback with a SHA-256 digest matching Sui `ciphertextDigest`.
3. `READY` Submission object on Sui.
4. Exact reviewer grant and successful authorized Seal decrypt; then revoke/denial evidence.

This distinction is intentional: server health proves endpoint reachability, not a completed live storage/access-control flow.

## Live Sui × Walrus × Seal proof

A later live contributor flow completed `SubmissionReserved` and `SubmissionFinalized`. The encrypted Walrus blob was read back from the testnet aggregator and matched the on-chain SHA-256 digest. Seal parsed it as an encrypted object bound to the exact Bounty and Submission. See [`SUI-WALRUS-SEAL-LIVE-PROOF.md`](./SUI-WALRUS-SEAL-LIVE-PROOF.md).
