# DataBounty 검증 기록

검증 기준일: 2026-09-14 KST
네트워크: Sui Testnet. Walrus와 Seal은 실제 contributor 제출 단계에서 다시 확인해야 합니다.
판정: **package 배포와 한 건의 Bounty escrow 생성은 완료. 전체 브라우저 end-to-end 시연은 미완료.**

이 문서는 공개 가능한 객체 ID, transaction digest, 정적 검증 결과만 기록합니다. private key, API key, cookie, signature, 평문, salt, 지갑 잔액은 포함하지 않습니다.

## 공개 정적 미리보기 상태

공식 공개 미리보기 [https://databounty-wine.vercel.app](https://databounty-wine.vercel.app)는 정적 읽기 전용 화면이 로드되는 것을 확인했습니다. 확인한 Vercel deployment는 [https://databounty-5kc0tpywk-momento5.vercel.app](https://databounty-5kc0tpywk-momento5.vercel.app)이고, 연결된 commit은 `5802c96`입니다.

공개 화면은 UI·아키텍처·이 문서의 Testnet 증거를 읽어 보는 정적 미리보기입니다. 지갑 연결·인증, API 호출, 업로드와 submission, AI review, payout, refund, cancel은 비활성화되어 있습니다. Walrus·Seal 처리와 reviewer 권한 변경도 연결하지 않습니다. 따라서 정적 화면의 접근 가능 여부는 live backend 증거가 아니며, 아래 on-chain 증거, 자동 테스트, 또는 미완료 E2E 항목의 상태를 바꾸지 않습니다.

## 1. 현재 Testnet package

| 항목 | 값 |
| --- | --- |
| Product | DataBounty |
| Module | `databounty::databounty` |
| Package ID | `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa` |
| Publish transaction | `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia` |
| Package object digest | `7rZwiYNiYJi5yYWJgHenF8kf41cbJXHoaYsTzmYNEU7Y` |
| Publish epoch / checkpoint | `1221` / `383282141` |
| Source verification | `sui client verify-source contracts` succeeded |

`contracts/published.testnet.json`과 `contracts/Published.toml`은 위 package를 current deployment로 표시합니다. 과거 배포 기록은 이 문서의 증거 범위에 포함하지 않습니다.

## 2. 실제 escrow 생성

| 항목 | 값 |
| --- | --- |
| Bounty object | `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4` |
| Create transaction | `9nTbj2uoGH1sLbKhYeWTaNGUNrPEBpFrQXLKrbqrYwok` |
| Escrow reward | `10,000,000 MIST` (`0.01` Testnet SUI) |
| Observed Bounty state | `OPEN` |

이는 요청자 지갑이 `create_bounty`를 서명해 reward를 `Bounty` 객체에 예치했다는 증거입니다. 아직 Submission, payout, refund transaction은 생성되지 않았습니다.

## 3. 자동 검증

마지막 검증에서 아래 범위가 통과했습니다.

| 대상 | 결과 |
| --- | --- |
| app tests | 9 passed |
| server tests | 12 passed |
| Move tests | 22 passed |
| TypeScript typecheck | passed |
| lint | passed |
| production build | passed |
| on-chain Move source verification | passed |

이 범위는 transaction builder의 fail-closed 구성, Move 권한·상태 전이, API·AI 검토 형식 경계를 검사합니다. server 테스트에는 real Ed25519와 default verifier 인증 회귀도 포함합니다. 그래도 서버 재시작 뒤 실제 지갑 popup을 통한 requester 인증, contributor 업로드, AI review, 지급 또는 환불의 완료 증거는 아닙니다.

## 4. 현재 미완료인 실제 흐름

| 요구 사항 | 상태 | 완료를 증명할 다음 evidence |
| --- | --- | --- |
| 요청자 browser authentication | 미검증 | 현재 서버 재시작 뒤 Slush personal-message signature와 같은 브라우저 세션의 Bounty load 성공 |
| contributor encrypted submission | 미완료 | reserve / finalize transaction, READY Submission object |
| Walrus ciphertext round trip | 미완료 | blob ID, digest, aggregator readback 일치 |
| Seal 접근 제어 | 미완료 | authorized requester/reviewer fresh decrypt와 unauthorized fresh request 거절 |
| AI review | 미완료 | exact READY submission과 task spec에 대한 structured review, valid UTF-8 citations |
| unauthorized payout rejection | 자동 테스트 범위 | actual/simulated third-party transaction failure evidence가 아직 문서화되지 않음 |
| requester payout | 미완료 | approval transaction, `PAID` state, exact contributor 수령 |
| deadline refund | 미완료 | refund transaction, `EXPIRED_REFUNDED` state, requester 수령 |
| reviewer revoke | 미완료 | revoke transaction 뒤 fresh Seal request denial |

## 5. 판단 경계

- AI recommendation은 `RECOMMEND_ACCEPT`, `RECOMMEND_REJECT`, `NEEDS_HUMAN_REVIEW` 중 하나이며, payout 권한이나 자동 실행 경로가 아닙니다.
- `approve_submission_and_pay`와 refund entry function은 requester 서명과 Move 상태·Clock 조건을 요구합니다.
- AI는 요청자의 공개 task spec과 허용된 exact Submission만 평가합니다. 자료의 진실성, 저작권, 적법성, 독창성, AI 생성 여부는 판정하지 않습니다.
- 원문은 Seal 암호문으로 Walrus에 저장됩니다. 이미 복호화되거나 모델 입력으로 전달된 평문은 revoke해도 회수되지 않습니다.
- Testnet SUI는 실제 금전 보상이 아닙니다.

## 6. 재검증 명령

```sh
npm run typecheck
npm run lint
npm run build
npm test
sui move test --path contracts
SSL_CERT_FILE=/etc/ssl/cert.pem sui client verify-source contracts
```

실제 browser E2E를 재개할 때는 [데모 스크립트](../docs/DEMO-SCRIPT.md)의 순서로 전 과정을 기록하고, 새 transaction digest와 object IDs를 이 문서에 추가합니다.
