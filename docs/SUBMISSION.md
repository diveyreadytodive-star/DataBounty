# DataBounty 제출 문안

상태: 실제 Sui Testnet escrow → encrypted submission → Walrus readback → Seal reviewer access → Groq recommendation → requester-signed payout → post-payout fresh Seal denial과 별도 requester/contributor 지급·expiry refund까지 증거가 기록됨.

## 운영 Testnet 앱

공식 앱은 [https://databounty-wine.vercel.app](https://databounty-wine.vercel.app)입니다. 지갑 연결, 바운티 생성, 암호화 제출, reviewer grant, AI recommendation, 요청자 서명 지급을 제공합니다. 실제 동작 증거는 앱 화면이 아니라 transaction·object·Walrus blob 식별자가 담긴 `artifacts/evidence/SUI-WALRUS-SEAL-LIVE-PROOF.md`를 기준으로 합니다.

## 이름과 한 줄 소개

**DataBounty — Encrypted data contribution with human-approved Sui payout.**

데이터 요청자가 Testnet SUI 보상을 예치하면 기여자가 암호화한 사례를 제출하고, AI가 근거를 검토한 뒤 요청자가 승인한 정확한 제출 Version에만 보상이 지급되는 서비스입니다.

## 문제

요청자는 필요한 정보의 조건을 공개하지만, 기여자는 보상 전 원문을 넓게 공유하기 어렵고 요청자는 지급 전 자료를 확인하기 어렵습니다. Lighthouse는 공개 과제, 암호화된 제출, 제한된 검토 권한, 요청자 승인 지급을 연결합니다.

## 해결

DataBounty는 공개 과제와 보상 escrow, 암호화된 제출, AI 검토 카드, 인간 승인과 지급을 하나의 짧은 흐름에 연결합니다.

1. 요청자가 과제 스키마·마감·보상을 설정하고 Sui Testnet Bounty에 SUI를 예치합니다.
2. 기여자가 사례를 브라우저에서 Seal로 암호화해 Walrus에 올리고, readback을 거쳐 exact Submission을 `READY`로 만듭니다.
3. 요청자가 특정 Submission에 reviewer 권한을 부여하면 AI가 승인·거절 권고를 반환합니다. 시스템은 필수 필드명 포함 여부, 원문 바이트 무결성, 비교 대상으로 제공한 사례와의 바이트 완전 일치 여부를 표시합니다.
4. 요청자가 검토를 보고 승인하면 Sui Move가 정확한 contributor에게 escrow 전액을 한 번 지급합니다.
5. 미승인 Bounty는 deadline 뒤 요청자가 환불할 수 있습니다.

초기 데모는 합성 `한국어 피싱 문자 분류 학습용 사례 1건`을 사용합니다. 공개 스키마는 `message`, `scam_type`, `red_flags`, `redacted_source_note`입니다.

## 왜 Sui, Walrus, Seal, AI인가

- **Sui Move:** `Bounty` reward escrow, requester-only approval, exact Submission binding, one-time payout, Clock 기반 refund를 상태 전이로 강제합니다.
- **Walrus + Seal:** Walrus에는 암호문만 두고, Seal은 `BCS(bounty_id, submission_id)`와 현재 온체인 권한을 확인해 요청자·허용 reviewer에게만 새 복호화 key를 제공합니다.
- **AI:** 승인·거절 권고를 반환합니다. 시스템은 필수 필드명 포함 여부와 원문 바이트 무결성을 표시하며, 비교 대상으로 제공한 사례와 바이트 완전 일치 여부만 계산합니다. AI는 송금·웹 도구·지갑·임의 파일을 호출하지 않습니다.

## 현재 구현 및 네트워크 증거

2026-09-18 KST 기준:

- DataBounty package `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa`를 Sui Testnet에 배포했습니다.
- publish transaction은 `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia`이며, on-chain source verification이 성공했습니다.
- 요청자가 `0.01` Testnet SUI (`10,000,000 MIST`)를 Bounty `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4`에 예치했습니다.
- create transaction `9nTbj2uoGH1sLbKhYeWTaNGUNrPEBpFrQXLKrbqrYwok` 이후 Bounty는 `OPEN`으로 확인됐습니다.
- Live Bounty `0x040467c0954dae110f222af8ca37aa3a67b4a6160454e4a42ff38bffc8ba2bd4`와 Submission `0xa32ff16c3708e47511583b1548af38917a77cbc7c3bef82be7a3024fa9b31af6`에서 reserve, finalize, Walrus readback, reviewer grant, Groq review, requester-signed payout을 완료했습니다.
- Walrus blob `EDoj9-ETZbZ10_wlSCTFB3Kl7py-KuDb6Qc1h9byq9c`의 1,163-byte ciphertext SHA-256은 on-chain digest와 일치했습니다.
- Groq `openai/gpt-oss-20b` review는 `RECOMMEND_ACCEPT` 및 exact UTF-8 citation `0–747`을 반환했습니다.
- payout transaction `9aDuBYceNVdKUDLdZNcq54eCB6K6WZCLVZu18TYLYcaR` 뒤 Bounty는 `PAID`, Submission은 `ACCEPTED`입니다. 새 reviewer Seal session은 key-server access denial로 거절됐습니다.
- app 17, server 21, Move 23 테스트와 typecheck, lint, build가 통과했습니다.

별도 만료 Bounty refund도 Testnet에서 확인됐습니다: `ANznJg8AmDmSJwrRkZyELZ4XVeM2NzrGXqidSPfpKkMM`의 `BountyRefunded` 이벤트 뒤 해당 Bounty는 `EXPIRED_REFUNDED`, escrow는 `0 MIST`입니다. Finalist Lock·Claim Window·분쟁 절차는 아직 구현되지 않은 로드맵입니다. 상세한 live identifiers와 제한은 `artifacts/evidence/SUI-WALRUS-SEAL-LIVE-PROOF.md`에 기록합니다.

## 신뢰와 한계

DataBounty는 자료의 진실성, 저작권, 라이선스, 학습 적법성, 독창성, AI 생성 여부를 자동 보증하지 않습니다. AI recommendation은 지급 근거가 아니며 요청자가 최종 판단합니다.

Seal revoke는 새 key 요청을 제한합니다. 이미 열린 평문, 다운로드, 스크린샷, AI 입력은 회수할 수 없습니다. Walrus blob은 공개적으로 발견될 수 있으므로 암호문만 보관합니다. Testnet SUI는 실제 현금 보상이 아닙니다.

MVP는 한 Bounty당 한 수상자·한 번의 전액 지급입니다. 여러 수상자, 분할 지급, 자동 지급, 실제 금융 보상, OCR·외부 크롤링·실시간 중복 검색은 범위 밖입니다.
