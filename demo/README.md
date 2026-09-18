# Lighthouse AI demo cases

모든 파일은 완전히 합성된 데모 데이터입니다. 실제 개인 정보, 작동 링크, 실제 금융기관 정보가 없습니다.

## Task spec for the demo

```text
한국어 피싱 문자 분류 학습용 사례 1건.
필수 필드: message, scam_type, red_flags, redacted_source_note.
수락 기준:
1. 네 필드가 모두 존재해야 한다.
2. red_flags에는 메시지에서 직접 확인되는 위험 신호가 최소 세 개 있어야 한다.
3. redacted_source_note는 합성·비식별 출처임을 밝혀야 한다.
4. 인용은 제출 원문에 실제 존재하는 문구만 사용한다.
```

## Files and expected demo result

| File | Use | Expected AI result |
|---|---|---|
| `cases/good-phishing-case.md` | 첫 번째 기여 및 승인 | `RECOMMEND_ACCEPT`; 네 필드와 위험 신호를 정확한 인용으로 제시 |
| `cases/bad-missing-fields-case.md` | 누락 검증 | `NEEDS_HUMAN_REVIEW` 또는 `RECOMMEND_REJECT`; `red_flags` 부재를 지적 |
| `cases/duplicate-like-phishing-case.md` | 중복 비교 | `good-phishing-case.md`가 승인된 후 비교 대상으로 선택; `POSSIBLE` 중복 후보와 유사 문구 인용 |

## Live demo sequence

1. Requester가 위 Task spec으로 Task를 만들고 Testnet SUI를 escrow한다.
2. Contributor가 `good-phishing-case.md`를 업로드해 reserve → encrypt → Walrus publish → finalize 한다.
3. Requester가 Seal reviewer 권한을 부여하고 Sonar review를 실행한다.
4. AI의 필드 체크와 정확한 인용을 확인한 뒤 requester가 Sui 지갑으로 승인·지급한다.
5. `bad-missing-fields-case.md`를 업로드해 누락 검증을 보여준다.
6. 마지막으로 `duplicate-like-phishing-case.md`를 `good-phishing-case.md`와 비교한다.
