# DataBounty Testnet deployment

현재 DataBounty Move package의 Testnet 배포 기록입니다. 이 파일의 package ID만 앱과 서버 설정에 사용합니다.

| 항목 | 값 |
| --- | --- |
| Network | Sui Testnet |
| Package | `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa` |
| Module | `databounty::databounty` |
| Publish transaction | `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia` |
| Package object digest | `7rZwiYNiYJi5yYWJgHenF8kf41cbJXHoaYsTzmYNEU7Y` |
| Published epoch / checkpoint | `1221` / `383282141` |
| Source verification | succeeded |

Set the same package ID in both runtime surfaces:

```dotenv
DATABOUNTY_PACKAGE_ID=0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa
VITE_DATABOUNTY_PACKAGE_ID=0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa
```

Verify source from the repository root:

```sh
SSL_CERT_FILE=/etc/ssl/cert.pem sui client verify-source contracts
```

The verification command succeeded for this deployment. The upgrade capability is intentionally not printed here; do not place capability IDs, private keys, API keys, cookies, or wallet signatures in public documentation.

Current live escrow evidence:

| Item | Value |
| --- | --- |
| Bounty | `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4` |
| Create transaction | `9nTbj2uoGH1sLbKhYeWTaNGUNrPEBpFrQXLKrbqrYwok` |
| Reward | `10,000,000 MIST` (`0.01` Testnet SUI) |
| Observed state | `OPEN` |

This proves deployment and `create_bounty` escrow only. It does not prove contributor submission, reviewer access, AI review, payout, refund, or revocation; those require separate live transactions and evidence.
