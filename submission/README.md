# Blockthon 2026 — DataBounty 제출 기록

- 상태: **제출 완료** (2026-09-14 사용자 보고)
- 결과 확인: 2026-09-16 본선 진출팀 발표
- 제출 프로젝트: **DataBounty**

## 제출 링크

| 용도 | 링크 |
| --- | --- |
| GitHub repository | https://github.com/diveyreadytodive-star/DataBounty |
| Public UI preview | https://databounty-wine.vercel.app |
| Notion 발표자료 | https://app.notion.com/p/3db43a5370a681448a43f05a8ffa2338?pvs=204 |
| Technical project introduction | [docs/PROJECT-INTRO.md](../docs/PROJECT-INTRO.md) |
| Verification record | [artifacts/verification.md](../artifacts/verification.md) |

## 한 줄 정의

> 데이터가 필요한 팀이 보상을 예치하면, 기여자가 암호화된 사례를 제출하고, AI가 검토 근거를 만들며, 사람이 승인한 정확한 제출본에만 Sui Testnet 보상이 지급되는 데이터 기여 검수 서비스.

## 제출 증거

- Sui Testnet package: `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa`
- publish transaction: `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia`
- Bounty escrow: `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4` · `0.01` Testnet SUI · `OPEN`
- 검증: App 11 · Server 13 · Move 22 tests, typecheck, lint, production build
- Vercel 공개 화면은 안전한 read-only UI preview이며, 지갑·API·업로드·AI review·payout/refund은 의도적으로 비활성화됨

## 폴더 안내

- `docs/`: 아키텍처, 기술 명세, 데모 스크립트, 프로젝트 소개, 제출 문안
- `artifacts/`: Testnet·Vercel 검증 기록
- `demo/`: 공개 가능한 합성 피싱 사례
- `research/`: 대회 분석과 초기 아이디어 탐색 기록
- `contracts/`, `app/`, `server/`: 구현체

## 결과 이후 다음 행동

1. 09-16 본선 진출 결과 확인
2. 진출 시 contributor 제출 → reviewer grant → AI citation → human-approved payout을 리허설
3. 실제 공개 backend는 영속 DB, hosted AI, Vercel server secrets, 공개 도메인 검증 이후에만 전환
