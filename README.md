# 조달서류 AI 매니저 웹사이트

사업계획서 기반의 서비스 소개 웹사이트입니다.

## 현재 포함된 기능

- 반응형 서비스 소개 페이지
- 일반 문의 접수 폼
- 계약 1건 진단 신청 폼
- 업종·발주기관·계약단계·계약금액 입력
- 계약자료 파일 선택 및 10MB 제한
- 개인정보 수집 동의 체크
- 신청 데이터의 브라우저 임시 저장
- FormSubmit AJAX를 통한 이메일 접수 연결

## 이메일 접수 방식

현재 신청 폼은 `ca.ygkim@gmail.com`으로 JSON 이메일을 보내도록 연결되어 있습니다. FormSubmit은 첫 실제 제출 전에 수신 이메일에서 활성화 확인을 요구할 수 있습니다.

다른 접수 서버를 사용하려면 `script.js`의 `SUBMISSION_ENDPOINT` 값을 교체합니다.

```html
<script>
  window.SERVICE_CONFIG = {
    submissionEndpoint: 'https://your-api.example.com/leads'
  };
</script>
<script src="script.js"></script>
```

서버는 다음 JSON 형태를 받을 수 있어야 합니다.

```json
{
  "id": "lead_...",
  "type": "inquiry 또는 diagnosis",
  "createdAt": "2026-07-15T00:00:00.000Z",
  "data": {}
}
```

계약자료 파일 자체를 실제 서버로 업로드하려면 별도의 파일 업로드 API와 저장소 연결이 필요합니다. 현재 정적 사이트에서는 파일명·크기·형식 정보만 신청 데이터에 포함합니다.
