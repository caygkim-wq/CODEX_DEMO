const workflowData = [
  { number: '01', title: '계약자료 등록', description: '계약서·공고문·과업지시서·특수조건을 업로드하면, 서비스가 계약의 기본정보와 문서 요건을 읽습니다.', list: ['계약자료 한 번에 업로드', '업체·기관·금액·기간 자동 추출'], file: '계약서_○○시청.pdf' },
  { number: '02', title: '필요서류 진단', description: '공종과 발주기관, 계약 조건을 기준으로 이번 계약에 필요한 제출서류와 제출 순서를 정리합니다.', list: ['기관·공종별 필수 서류 추천', '누락 가능성이 있는 항목 표시'], file: '필요서류_체크리스트.xlsx' },
  { number: '03', title: '기관 양식 작성', description: '한 번 입력한 표준 데이터를 기관별 HWPX·DOCX·XLSX 양식에 맞춰 자동으로 반영합니다.', list: ['같은 의미의 항목 자동 매핑', '착공·준공·검수·청구 문서 생성'], file: '○○시청_착공계.hwpx' },
  { number: '04', title: '누락·오류 검토', description: '제출 전 문서 간 불일치와 보증·정산·사진·완납증명 등 누락 항목을 확인합니다.', list: ['제출 전 체크리스트 검토', '담당자 보완 요청 대응 지원'], file: '제출전_최종검토.pdf' },
  { number: '05', title: '준공·청구 패키지', description: '검수 완료 후 대금청구에 필요한 서류를 한 번에 묶고, 계약이력과 제출문서를 관리합니다.', list: ['청구·하자·완납 자료 패키지', '문서 버전과 제출 이력 관리'], file: '대금청구_패키지.zip' }
];

const SUBMISSION_ENDPOINT = window.SERVICE_CONFIG?.submissionEndpoint || '';

const tabs = document.querySelectorAll('.workflow-tab');
const stageNumber = document.querySelector('#stageNumber');
const stageTitle = document.querySelector('#stageTitle');
const stageDescription = document.querySelector('#stageDescription');
const stageList = document.querySelector('#stageList');
const stageFile = document.querySelector('#stageFile');

function setWorkflowStep(index) {
  const step = workflowData[index];
  tabs.forEach((tab, i) => {
    const active = i === index;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  [stageNumber, stageTitle, stageDescription, stageFile].forEach((element) => {
    element.classList.remove('fade-in');
    void element.offsetWidth;
    element.classList.add('fade-in');
  });
  stageNumber.textContent = step.number;
  stageTitle.textContent = step.title;
  stageDescription.textContent = step.description;
  stageFile.textContent = step.file;
  stageList.innerHTML = step.list.map((item) => `<li>${item}</li>`).join('');
}

tabs.forEach((tab) => tab.addEventListener('click', () => setWorkflowStep(Number(tab.dataset.step))));

const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
menuToggle.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  mobileNav.setAttribute('aria-hidden', String(!open));
});
mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  mobileNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  mobileNav.setAttribute('aria-hidden', 'true');
}));

const intakeTabs = document.querySelectorAll('.intake-tab');
const intakeForms = document.querySelectorAll('.intake-form');
intakeTabs.forEach((tab) => tab.addEventListener('click', () => {
  const target = tab.dataset.intake;
  intakeTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
  });
  intakeForms.forEach((form) => form.classList.toggle('active', form.dataset.formType === target));
}));

function createSubmission(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const file = form.querySelector('input[type="file"]')?.files?.[0];
  if (file) data.contractFile = { name: file.name, size: file.size, type: file.type };
  delete data.consent;
  return {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: form.dataset.formType,
    createdAt: new Date().toISOString(),
    data,
  };
}

function setFormMessage(form, message, kind = '') {
  const messageElement = form.querySelector('.form-note');
  messageElement.textContent = message;
  messageElement.className = `form-note ${kind}`.trim();
}

async function submitLead(form) {
  const file = form.querySelector('input[type="file"]')?.files?.[0];
  if (file && file.size > 10 * 1024 * 1024) {
    setFormMessage(form, '파일 크기는 10MB 이하로 선택해주세요.', 'error');
    return;
  }

  const submission = createSubmission(form);
  if (SUBMISSION_ENDPOINT) {
    try {
      const response = await fetch(SUBMISSION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!response.ok) throw new Error('Submission failed');
      setFormMessage(form, '신청이 접수되었습니다. 담당자가 연락드리겠습니다.', 'success');
      form.reset();
      return;
    } catch (error) {
      setFormMessage(form, '접수 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }
  }

  const localSubmissions = JSON.parse(localStorage.getItem('procurementAiLeads') || '[]');
  localSubmissions.push(submission);
  localStorage.setItem('procurementAiLeads', JSON.stringify(localSubmissions));
  setFormMessage(form, '신청 내용이 이 브라우저에 임시 저장되었습니다. 운영 접수는 서버 연결 후 활성화됩니다.', 'success');
  form.reset();
}

intakeForms.forEach((form) => form.addEventListener('submit', (event) => {
  event.preventDefault();
  submitLead(form);
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.12 });
document.querySelectorAll('.pain-card,.coverage-card,.target-grid article,.value-strip>div,.quote-callout').forEach((element) => observer.observe(element));
