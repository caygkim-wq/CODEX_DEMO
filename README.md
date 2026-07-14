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
- 서버 API 연결을 위한 `submissionEndpoint` 설정 지점

## 실제 운영 접수 연결

현재 GitHub Pages는 정적 호스팅이므로 신청 데이터를 중앙에서 받는 서버 API가 필요합니다. API 주소가 준비되면 `index.html`의 `script.js` 앞에 다음 설정을 추가합니다.

```html
<script>
  window.SERVICE_CONFIG = {
    submissionEndpoint: 'https://your-api.example.com/leads'
  };
</script>
<script src="script.js"></script>
```

서버는 다음 JSON을 받을 수 있어야 합니다.

```json
{
  "id": "lead_...",
  "type": "inquiry 또는 diagnosis",
  "createdAt": "2026-07-15T00:00:00.000Z",
  "data": {}
}
```

계약자료 파일 자체를 실제 서버로 업로드하려면 별도의 파일 업로드 API와 저장소 연결이 필요합니다. 현재 정적 사이트에서는 파일명·크기·형식 정보만 신청 데이터에 포함합니다.
