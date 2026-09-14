# DataBounty 데모 스크립트

상태: 실제 escrow까지 완료, contributor·AI·payout/refund 브라우저 시연은 대기 중
데모 데이터: 합성 한국어 피싱 문자 사례만 사용
목표: 요청자 승인에만 정확한 제출본의 Testnet SUI 보상이 한 번 지급되는 과정을 보여준다.

## 녹화 전 준비

- `npm run setup:local-ai`를 한 번 실행하고 `npm run start:local-ai`로 local Qwen server를 시작합니다.
- `.env`에는 `AI_PROVIDER=mlx-local`, `AI_BASE_URL=http://127.0.0.1:8092/v1`, `AI_MODEL=mlx-community/Qwen3-1.7B-4bit`를 설정합니다. 비밀값은 화면에 보이지 않게 합니다.
- Groq 전환은 현재 비활성입니다. 필요할 때 노출된 키를 먼저 교체하고, 새 키를 로컬 `.env` 또는 Vercel의 서버 secret에 넣은 뒤 `AI_PROVIDER=openai-compatible`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`을 설정합니다. `GROQ_*`나 키를 `VITE_*`로 복사하지 않고 브라우저에 노출하지 않습니다.
- 다른 터미널에서 `npm run build && npm start`를 실행하고 `http://127.0.0.1:3000`을 엽니다.
- 요청자 A와 기여자 B를 서로 다른 Sui Testnet 지갑으로 준비합니다. Bounty `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4`는 A가 만든 현재 demo Bounty입니다.
- 서버를 현재 build로 재시작한 뒤 Slush personal-message와 Bounty load를 같은 브라우저 세션에서 끝까지 리허설합니다. 이 browser-auth E2E는 아직 증명되지 않았습니다.
- Slush popup의 서명은 사용자가 직접 확인합니다. personal-message는 로그인용이며 자금을 이동하지 않습니다. transaction은 action·recipient·amount을 먼저 확인합니다.
- private key, API key, cookie, signature, plaintext 파일 전체, 개인 정보, 지갑 잔액을 촬영하지 않습니다.

## 0:00–0:20 — 문제와 역할

화면: DataBounty 첫 화면, Sui Testnet network, package readiness.

> AI 팀은 필요한 사례를 모으지만, 중복되거나 형식이 맞지 않는 자료에 보상을 쓰기 쉽습니다. DataBounty는 사례를 암호화해 받고, AI가 근거를 정리하며, 사람이 승인한 정확한 제출본에만 Testnet SUI를 지급합니다.

강조할 경계: AI는 송금하지 않으며, 검토 결과는 권고입니다.

## 0:20–0:45 — 요청자 보상 escrow

화면: 현재 생성된 Bounty 상세.

- package `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa`
- Bounty `0x0f0ce45bc348bec4e7a2cd740b79ad6c9987c9cbb90413de0bcf6a58a7b018c4`
- reward `10,000,000 MIST` (`0.01` Testnet SUI), state `OPEN`
- create transaction `9nTbj2uoGH1sLbKhYeWTaNGUNrPEBpFrQXLKrbqrYwok`

> 이 보상은 요청자 지갑이 만든 shared Bounty에 예치됐습니다. 아직 기여자에게 지급되지 않았고, 현재 상태는 OPEN입니다.

`Sign in for reviews`를 누르고 Slush에서 personal-message에 서명한 뒤 같은 브라우저 세션에서 Bounty를 불러옵니다. 서버 재시작 뒤 이 두 단계를 연속으로 성공해야 녹화를 시작합니다.

## 0:45–1:20 — 기여자의 암호화된 사례 제출

화면: B 지갑에서 public task spec과 contributor submission form.

합성 사례에는 `message`, `scam_type`, `red_flags`, `redacted_source_note`를 넣습니다. 공개 task spec 외의 실제 피해 정보는 사용하지 않습니다.

1. `.txt` 또는 `.md` 파일을 선택합니다.
2. `Reserve Submission` transaction을 서명하고 resulting Submission ID를 입력합니다.
3. `Encrypt, publish, finalize`를 실행합니다.
4. `READY`, Walrus blob ID, ciphertext digest, storage end epoch를 보여줍니다.

> 브라우저는 이 Bounty와 정확한 Submission ID에 묶어 원문을 Seal로 암호화합니다. Walrus에는 암호문만 저장하고, readback digest가 일치할 때만 READY가 됩니다.

## 1:20–1:50 — AI 검토는 추천만 한다

화면: A 지갑에서 READY Submission 상세와 reviewer access.

1. configured reviewer wallet에 만료 시각을 정해 `Grant exact read`를 서명합니다.
2. AI review를 실행합니다.
3. `recommendation`, required-field checklist, duplicate candidate, 정확한 UTF-8 byte citations를 표시합니다.

> 서버는 task spec과 이 정확한 READY 제출본의 Sui binding·Seal access·commitment를 확인한 뒤에만 local Qwen에 검토를 요청합니다. AI는 제출의 진실성이나 저작권을 판정하지 않고, 누락 필드·명백한 텍스트 중복·인용 근거만 정리합니다.

## 1:50–2:20 — 요청자의 승인과 단 한 번의 지급

화면: 요청자의 review card, 원문 열람, `Approve and pay exact contributor` button, Slush transaction details.

1. 요청자가 AI의 추천을 검토하고 원문을 확인합니다.
2. 요청자가 직접 approval transaction을 서명합니다.
3. Bounty가 `PAID`, selected Submission이 `ACCEPTED`가 된 것을 보여줍니다.
4. transaction event와 B 지갑의 수령을 확인합니다.

> AI가 아니라 요청자만 이 transaction을 서명합니다. Move는 승인한 Submission의 contributor에게 Bounty escrow 전액을 한 번 지급하고, 같은 Bounty를 다시 지급할 수 없게 합니다.

## 2:20–2:35 — 환불과 revoke 경계

별도 만료 Bounty를 준비해 `Refund after deadline` transaction을 보여줍니다. `EXPIRED_REFUNDED`와 requester 수령을 확인합니다. READY 제출이 있는 Bounty는 open cancellation이 막힌다는 점도 설명합니다.

reviewer grant를 revoke한 뒤, 새로운 Seal session의 key request가 거절되는 것을 보여줍니다.

> 환불 가능 시점은 화면 타이머가 아니라 Sui Clock으로 확인합니다. 접근 회수는 이미 봤던 원문을 지우지 않지만, 상태 반영 뒤 새 key 요청은 막습니다.

## 녹화 전 완료 확인표

- [ ] 서버 재시작 뒤 requester personal-message 인증과 같은 브라우저 세션의 Bounty load 완료
- [ ] contributor reserve/finalize transaction과 READY Submission 기록
- [ ] Walrus ciphertext readback digest 일치
- [ ] authorized reviewer AI의 검토 카드와 valid exact citation
- [ ] requester 승인 transaction, `PAID`, contributor 수령
- [ ] 별도 Bounty의 deadline refund transaction과 `EXPIRED_REFUNDED`
- [ ] reviewer revoke 후 fresh Seal key request 거절
- [ ] 모든 사례가 합성 자료이며 비밀·원문·개인 정보가 캡처에 없음

현재는 첫 escrow 행만 실제 완료 증거가 있습니다. 나머지 체크가 끝나기 전에는 완성된 end-to-end 데모라고 소개하지 않습니다.
