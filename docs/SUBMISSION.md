# DataBounty 제출 문안

상태: 실제 package 배포와 보상 escrow까지 검증됨. contributor 제출, AI review, payout/refund browser E2E는 진행 중이며 제출 전 새 증거로 갱신해야 함.

## 이름과 한 줄 소개

**DataBounty — Encrypted data contribution with human-approved Sui payout.**

데이터 요청자가 Testnet SUI 보상을 예치하면 기여자가 암호화한 사례를 제출하고, AI가 근거를 검토한 뒤 요청자가 승인한 정확한 제출 Version에만 보상이 지급되는 서비스입니다.

## 문제

소규모 AI·연구 팀은 특정 형식의 희소 사례가 필요하지만, 하나씩 받은 자료의 형식·중복·근거를 검토한 뒤에야 보상할 수 있습니다. 일반 업로드 방식에서는 누가 무엇을 언제 제출했는지와 어떤 자료를 승인했는지가 흐려지고, 원문을 넓게 공유해야 할 수 있습니다.

## 해결

DataBounty는 공개 과제와 보상 escrow, 암호화된 제출, AI 검토 카드, 인간 승인과 지급을 하나의 짧은 흐름에 연결합니다.

1. 요청자가 과제 스키마·마감·보상을 설정하고 Sui Testnet Bounty에 SUI를 예치합니다.
2. 기여자가 사례를 브라우저에서 Seal로 암호화해 Walrus에 올리고, readback을 거쳐 exact Submission을 `READY`로 만듭니다.
3. 요청자가 특정 Submission에 reviewer 권한을 부여하면 AI가 과제 기준, 누락 항목, 명백한 텍스트 중복 후보와 원문 인용을 구조화합니다.
4. 요청자가 검토를 보고 승인하면 Sui Move가 정확한 contributor에게 escrow 전액을 한 번 지급합니다.
5. 미승인 Bounty는 deadline 뒤 요청자가 환불할 수 있습니다.

초기 데모는 합성 `한국어 피싱 문자 분류 학습용 사례 1건`을 사용합니다. 공개 스키마는 `message`, `scam_type`, `red_flags`, `redacted_source_note`입니다.

## 왜 Sui, Walrus, Seal, AI인가

- **Sui Move:** `Bounty` reward escrow, requester-only approval, exact Submission binding, one-time payout, Clock 기반 refund를 상태 전이로 강제합니다.
- **Walrus + Seal:** Walrus에는 암호문만 두고, Seal은 `BCS(bounty_id, submission_id)`와 현재 온체인 권한을 확인해 요청자·허용 reviewer에게만 새 복호화 key를 제공합니다.
- **AI:** 사람이 읽어야 할 검토 근거를 줄입니다. recommendation, field checklist, duplicate candidate, exact UTF-8 citation을 만들지만 송금·웹 도구·지갑·임의 파일을 호출하지 않습니다.

## 현재 구현 및 네트워크 증거

2026-09-14 KST 기준:

- DataBounty package `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa`를 Sui Testnet에 배포했습니다.
- publish transaction은 `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia`이며, on-chain source verification이 성공했습니다.
- 요청자가 `0.01` Testnet SUI (`10,000,000 MIST`)를 Bounty `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4`에 예치했습니다.
- create transaction `9nTbj2uoGH1sLbKhYeWTaNGUNrPEBpFrQXLKrbqrYwok` 이후 Bounty는 `OPEN`으로 확인됐습니다.
- app 9, server 12, Move 22 테스트와 typecheck, lint, build가 통과했습니다. server 테스트에는 real Ed25519와 default verifier 인증 회귀가 포함됩니다.

현재 서버 재시작 뒤 Slush requester personal-message와 같은 브라우저 세션의 Bounty load가 아직 end-to-end로 증명되지 않았습니다. 그 후 contributor submission, Walrus/Seal live proof, AI review exact citation, approval payout, deadline refund, revoke 후 fresh Seal denial을 같은 Testnet 흐름에서 추가 검증해야 합니다. 이 항목들은 아직 완료라고 주장하지 않습니다.

## 신뢰와 한계

DataBounty는 자료의 진실성, 저작권, 라이선스, 학습 적법성, 독창성, AI 생성 여부를 자동 보증하지 않습니다. AI recommendation은 지급 근거가 아니며 요청자가 최종 판단합니다.

Seal revoke는 새 key 요청을 제한합니다. 이미 열린 평문, 다운로드, 스크린샷, AI 입력은 회수할 수 없습니다. Walrus blob은 공개적으로 발견될 수 있으므로 암호문만 보관합니다. Testnet SUI는 실제 현금 보상이 아닙니다.

MVP는 한 Bounty당 한 수상자·한 번의 전액 지급입니다. 여러 수상자, 분할 지급, 자동 지급, 실제 금융 보상, OCR·외부 크롤링·실시간 중복 검색은 범위 밖입니다.
