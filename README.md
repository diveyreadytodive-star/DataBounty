# DataBounty

**암호화된 데이터 기여를 사람이 승인한 뒤 정확한 제출본에만 Testnet SUI를 지급하는 검수 서비스.**

요청자가 공개 과제와 보상을 올리면 기여자는 사례를 브라우저에서 암호화해 제출합니다. AI는 과제 기준, 누락 항목, 명백한 텍스트 중복 후보와 원문 인용을 검토 카드로 만들고, 요청자가 최종 판단합니다. AI는 자금을 움직이지 않습니다.

## 현재 검증 상태

기준일: 2026-09-14 KST. 이 표는 DataBounty의 현재 네트워크 증거만 다룹니다.

| 항목 | 상태 | 증거 |
| --- | --- | --- |
| Move package 배포 | 완료 | Testnet package `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa` |
| 배포 거래·source verification | 완료 | `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia` · verify-source 성공 |
| 보상 escrow 생성 | 완료 | Bounty `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4` |
| Bounty 생성 거래 | 완료 | `9nTbj2uoGH1sLbKhYeWTaNGUNrPEBpFrQXLKrbqrYwok` |
| Bounty 상태·보상 | 완료 | `OPEN` · `10,000,000 MIST` (`0.01` Testnet SUI) |
| 자동 검증 | 완료 | app 9, server 12, Move 22 테스트 및 typecheck/lint/build 통과 |
| 요청자 브라우저 인증 | 미검증 | 서버 재시작 뒤 Slush personal-message와 Bounty load를 같은 브라우저에서 끝까지 확인할 E2E 증거 필요 |
| 기여자 암호화 제출·AI 검토·지급·환불 | 미완료 | 실제 서명과 새 네트워크 증거 필요 |

상세 증거와 미완료 범위는 [검증 기록](artifacts/verification.md), 시연 순서는 [데모 스크립트](docs/DEMO-SCRIPT.md), 제출 문안은 [SUBMISSION](docs/SUBMISSION.md), package 배포 정보는 [DEPLOYMENT](contracts/DEPLOYMENT.md)를 참고하세요.

## 공개 정적 미리보기 범위

Vercel 공개 미리보기 URL은 아직 배포 전입니다. 배포가 확인되면 이 문서에 검증된 URL을 추가합니다.

그 미리보기는 DataBounty의 **정적 UI, 구조 설명, 그리고 이미 기록된 Testnet package·escrow 증거를 읽어 보는 공개 화면**입니다. 서버나 비밀 설정을 포함하지 않으며, 방문자의 지갑이나 데이터를 사용하지 않습니다.

따라서 공개 미리보기는 live API, 지갑 인증, 기여자 제출, Walrus·Seal 처리, AI 검토, reviewer 권한 부여·회수, payout, refund 또는 콘테스트 제출을 제공하거나 증명하지 않습니다. 실제 통합의 현재 증거와 E2E 한계는 [검증 기록](artifacts/verification.md)을 기준으로 합니다.

## 데모 과제

모든 데모 입력은 합성 자료입니다. 초기 시연은 `한국어 피싱 문자 분류 학습용 사례 1건`을 사용하며, 공개 스키마는 `message`, `scam_type`, `red_flags`, `redacted_source_note`입니다.

DataBounty는 자료의 진실성, 저작권, 학습 적법성, AI 생성 여부를 자동으로 증명하지 않습니다. AI는 공개된 수용 기준 안에서 형식·텍스트 중복·근거만 보조하고, 요청자가 원문과 검토 카드를 보고 승인 책임을 집니다.

## 동작 흐름

1. 요청자가 Sui Testnet에서 과제, 마감, 보상을 입력해 `Bounty`에 SUI를 예치합니다.
2. 기여자가 UTF-8 `.txt` 또는 `.md` 사례를 준비합니다. 브라우저는 `BCS(bounty_id, submission_id)`에 묶어 Seal로 암호화합니다.
3. 암호문만 Walrus에 저장하고 readback digest가 일치하면 `Submission`을 `READY`로 확정합니다.
4. 요청자는 특정 READY 제출본에 한정해 reviewer delegate의 읽기 권한을 부여합니다.
5. 서버는 현재 Sui 상태·bounty/submission binding·Seal 접근·plaintext commitment를 확인한 뒤 task spec과 허용된 제출본만 모델에 보냅니다. 응답은 recommendation, checklist, duplicateCandidates, exact UTF-8 citations를 포함합니다.
6. 요청자만 `approve_submission_and_pay`를 서명할 수 있습니다. Move는 승인한 정확한 `submission_id`의 contributor에게 escrow 전액을 한 번 지급합니다.

MVP는 한 Bounty당 한 최종 수상 제출과 한 번의 전액 지급만 지원합니다. 여러 수상자와 분할 지급은 범위 밖입니다.

## 권한과 저장 경계

| 주체 | 할 수 있는 일 | 보상 이동 |
| --- | --- | --- |
| 요청자 | 자기 Bounty 생성, 검토 권한 부여·회수, 거절, 승인, 규칙상 환불 | 승인 또는 규칙상 환불만 |
| 기여자 | 자기 사례 예약·암호화·등록, 상태 확인 | 수령만 |
| reviewer AI delegate | 명시적으로 grant된 정확한 READY/ACCEPTED 제출본 읽기 | 불가 |
| 임의 지갑·서버 | 원문·검토 권한·escrow 제어 불가 | 불가 |

Sui에는 공개 과제, 객체 ID, commitment, 암호문 digest, Walrus blob reference, 상태와 이벤트만 기록됩니다. 원문, 파일명, salt, 키, 세션은 체인과 일반 metadata DB에 저장하지 않습니다. Walrus에는 공개적으로 발견 가능한 **암호문만** 저장합니다.

Seal 회수는 현재 상태를 반영한 새 key 요청만 막습니다. 이미 열린 평문, 내려받은 파일, 스크린샷, 모델 입력은 되돌릴 수 없습니다. Testnet SUI는 실제 현금·급여·보험금이 아닙니다.

## 로컬 실행

필요 조건은 Node.js 24 이상, npm 11, Sui Testnet 지갑, 그리고 AI 검토용 reviewer delegate 설정입니다.

```sh
npm ci
cp .env.example .env
npm run setup:local-ai
```

로컬 AI는 gitignored `.runtime/mlx`에 `mlx-lm==0.31.3`과 `mlx-community/Qwen3-1.7B-4bit`를 설치합니다. `.env`에는 다음처럼 설정합니다.

```dotenv
AI_PROVIDER=mlx-local
AI_BASE_URL=http://127.0.0.1:8092/v1
AI_MODEL=mlx-community/Qwen3-1.7B-4bit
```

`AI_API_KEY`는 로컬 provider용 non-empty placeholder여도 됩니다. `REVIEWER_DELEGATE_PRIVATE_KEY`, `COOKIE_SECRET`, `SEAL_API_KEY`, 실제 API 키와 `.env`는 절대 커밋하거나 화면에 표시하지 않습니다. `DATABOUNTY_PACKAGE_ID`와 `VITE_DATABOUNTY_PACKAGE_ID`에는 현재 package ID를 넣습니다.

```sh
# terminal 1
npm run start:local-ai

# terminal 2
npm run build
npm start
```

브라우저에서 `http://127.0.0.1:3000`을 열고 Slush를 Sui Testnet에 연결합니다. `npm start`는 root `.env`를 읽어 앱과 API를 same-origin으로 제공합니다.

## 검증

```sh
npm run typecheck
npm run lint
npm run build
npm test
sui move test --path contracts
SSL_CERT_FILE=/etc/ssl/cert.pem sui client verify-source contracts
```

마지막 기록상 app 테스트 9개, server 테스트 12개, Move 테스트 22개와 typecheck, lint, build가 통과했습니다. 이 자동 검증은 서버 재시작 뒤의 브라우저 지갑 인증과 실제 payout/refund를 대체하지 않습니다.

## 현재 시연을 끝내는 순서

1. 서버를 현재 build로 재시작한 뒤, 요청자 지갑으로 `Sign in for reviews`의 personal-message를 Slush에서 서명하고 같은 브라우저 세션에서 Bounty를 불러옵니다.
2. 별도 기여자 지갑으로 합성 피싱 사례를 reserve → Seal encrypt → Walrus publish/readback → finalize하여 `READY` Submission을 만듭니다.
3. 요청자가 reviewer delegate에 해당 exact Submission 읽기 권한을 부여하고 AI review를 실행해 검토 카드와 citation을 확인합니다.
4. 요청자가 검토 결과와 원문을 보고 `Approve and pay exact contributor`를 서명합니다. 지급 event, Bounty `PAID`, contributor 수령을 확인합니다.
5. 별도 만료 Bounty로 `refund_expired_bounty`도 실행해 refund event와 `EXPIRED_REFUNDED` 상태를 확인합니다.

그 전까지는 “실제 end-to-end payout/refund를 완료했다”고 주장하지 않습니다.

## 구조

```text
app/        React/Vite 지갑 UI, 브라우저 Seal 암호화, Sui 거래 구성
server/     Fastify 인증, metadata-only SQLite, Sui/Walrus/Seal/AI 검토 경계
contracts/  DataBounty Move escrow·Submission lifecycle·Seal 승인 정책
demo/       공개 가능한 합성 입력
docs/       설계, 시연 및 제출 문안
artifacts/  검증 상태와 네트워크 식별자
```
