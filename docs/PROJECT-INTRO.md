# DataBounty

**AI가 검토 근거를 만들고, 사람이 승인한 정확한 암호화 제출본에만 Sui 보상이 지급되는 데이터 기여 검수 서비스입니다.**

## 문제와 사용자

소규모 AI·연구 팀은 필요한 형식의 희소 사례를 모으기 어렵습니다. 받은 자료가 과제 형식에 맞는지, 이미 승인한 자료와 명백히 중복되는지, 어떤 근거로 보상할지를 확인하기 전에 보상을 지급하면 비용과 책임이 커집니다.

DataBounty의 요청자는 과제와 보상을 여는 팀이고, 기여자는 사례를 제출하는 사람이며, 최종 검토자는 AI 추천을 참고해 지급을 직접 승인하는 요청자입니다. 초기 데모는 실제 개인정보 없이 합성 한국어 피싱 문자 분류 사례를 사용합니다.

## 사용자 흐름

1. **과제와 보상 예치** — 요청자가 공개 제출 스키마, 마감, Testnet SUI 보상을 입력해 `Bounty` escrow를 만듭니다.
2. **암호화된 사례 제출** — 기여자가 UTF-8 텍스트 사례를 브라우저에서 Seal로 암호화하고 Walrus에 저장합니다. readback digest가 맞으면 그 정확한 `Submission`이 `READY`가 됩니다.
3. **AI 검토** — 요청자가 허용한 reviewer가 task spec과 exact Submission만 읽어 필수 항목, 명백한 텍스트 중복 후보, 정확한 UTF-8 인용을 구조화합니다.
4. **사람 승인과 지급** — 요청자가 원문과 검토 근거를 확인해 승인하면 Move가 그 Submission의 contributor에게 escrow 전액을 한 번 지급합니다. 미승인 Bounty는 규칙상 마감 뒤 환불할 수 있습니다.

## 각 기술이 필요한 이유

- **Sui Move**는 보상 escrow, requester-only approval, exact Submission binding, 한 번의 지급, Clock 기반 환불을 상태 전이로 강제합니다. AI와 서버에는 payout 권한이 없습니다.
- **Walrus**는 암호문 저장과 재조회 검증을 제공합니다. 공개적으로 발견될 수 있으므로 원문은 저장하지 않습니다.
- **Seal**은 `BCS(bounty_id, submission_id)`에 묶인 ciphertext의 새 복호화 key를 현재 온체인 권한에 따라 요청자와 허용된 reviewer에게만 제공합니다.
- **AI**는 자료의 진실성·저작권·적법성을 판정하지 않습니다. 공개 task spec 안에서 형식, 명백한 텍스트 중복, 인용 근거를 정리해 사람이 판단할 수 있게 돕습니다.

## 현재 Testnet 증거

- DataBounty package: `0xf7923bd34625af96c40e27187371f231fca6bca7d25d244fe72244ec9a89b0aa`
- Publish transaction: `Bs8bzmXu7urPZ9ufyimLmBEqt7gLo9fZDa95yUEv9yia`
- On-chain source verification: succeeded
- Live settled Bounty: `0x040467c0954dae110f222af8ca37aa3a67b4a6160454e4a42ff38bffc8ba2bd4`
- Live accepted Submission: `0xa32ff16c3708e47511583b1548af38917a77cbc7c3bef82be7a3024fa9b31af6`
- Walrus blob/readback: `EDoj9-ETZbZ10_wlSCTFB3Kl7py-KuDb6Qc1h9byq9c`, exact 1,163-byte digest match
- Groq review: `openai/gpt-oss-20b`, `RECOMMEND_ACCEPT`, validated UTF-8 citation `0–747`
- Payout: `9aDuBYceNVdKUDLdZNcq54eCB6K6WZCLVZu18TYLYcaR`; Bounty `PAID`, Submission `ACCEPTED`
- Fresh post-payout reviewer Seal key request: denied
- Automated verification: app·server·Move tests, typecheck, lint, and production build passed

## 운영 Testnet 앱

공식 앱은 [https://databounty-wine.vercel.app](https://databounty-wine.vercel.app)입니다. 지갑 연결, 브라우저 인증, 바운티 생성, 암호화 제출, reviewer grant, AI Review, 요청자 지급 흐름을 Testnet에서 제공합니다.

운영 앱의 작동 여부와 별개로, 실제 Testnet 증거는 아래 transaction·object·Walrus blob 식별자와 live evidence packet으로 검증합니다. 서버 비밀값, 원문, salt, 복호화 key, 서명은 배포 앱과 저장소에 포함하지 않습니다.

## 현재 한계

실제 Testnet flow는 escrow, encrypted submission, Walrus readback, Seal reviewer access, Groq review, requester payout, payout 후 fresh Seal denial까지 검증됐습니다. 별도 requester·contributor 지갑 간 지급과 별도 만료 Bounty의 refund도 기록했습니다.

원문·파일명·salt·키·세션은 체인과 일반 metadata DB에 저장하지 않습니다. Seal revoke는 새 key 요청을 막지만 이미 열람·다운로드·모델 입력으로 전달된 평문을 회수하지는 못합니다. Testnet SUI는 실제 현금 보상이 아닙니다. 현재 MVP는 텍스트 사례를 대상으로 하며, 자산별 템플릿과 Finalist Lock은 다음 단계입니다.
