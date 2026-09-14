# DataBounty 합성 데모 자료

이 폴더의 자료는 DataBounty의 공개 시연 전용 합성 데이터입니다. 실제 개인정보, 피해자 정보, 비공개 사업 자료, salt, key, session을 포함하지 않습니다.

`phishing-case.md`는 요청자가 게시한 `한국어 피싱 문자 분류 학습용 사례 1건` 과제에 제출할 수 있는 공개 샘플입니다. 브라우저에서 이 파일을 선택하면 DataBounty가 내용을 암호화한 뒤 Walrus에 저장하고, AI 검토는 과제 스키마와 정확한 제출 원문만 사용합니다.

권장 시연 순서:

1. 요청자가 과제 스키마와 Testnet SUI 보상을 예치합니다.
2. 기여자가 `phishing-case.md`를 선택해 Submission을 예약하고 암호화·저장·확정합니다.
3. 요청자가 `/api/agents`에서 제공된 reviewer 주소에 정확한 제출 읽기 권한을 부여합니다.
4. AI 검토 카드에서 필수 필드, 명백한 중복 후보, 원문의 정확한 UTF-8 byte citation을 확인합니다.
5. 요청자가 직접 승인할 때만 정확한 Submission의 contributor에게 보상이 지급됩니다.

모든 데모 입력은 합성 데이터입니다. 등록 과정에서 생성되는 salt, 복호화 key, session, reviewer private key는 공개하거나 저장소에 커밋하지 않습니다.
