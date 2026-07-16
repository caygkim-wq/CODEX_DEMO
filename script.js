const workflowData = [
  { number: '01', title: '계약자료 등록', description: '계약서·공고문·과업지시서·특수조건을 업로드하면, 서비스가 계약의 기본정보와 문서 요건을 읽습니다.', list: ['계약자료 한 번에 업로드', '업체·기관·금액·기간 자동 추출'], file: '계약서_○○시청.pdf' },
  { number: '02', title: '필요서류 진단', description: '공종과 발주기관, 계약 조건을 기준으로 이번 계약에 필요한 제출서류와 제출 순서를 정리합니다.', list: ['기관·공종별 필수 서류 추천', '누락 가능성이 있는 항목 표시'], file: '필요서류_체크리스트.xlsx' },
  { number: '03', title: '기관 양식 작성', description: '한 번 입력한 표준 데이터를 기관별 HWPX·DOCX·XLSX 양식에 맞춰 자동으로 반영합니다.', list: ['같은 의미의 항목 자동 매핑', '착공·준공·검수·청구 문서 생성'], file: '○○시청_착공계.hwpx' },
  { number: '04', title: '누락·오류 검토', description: '제출 전 문서 간 불일치와 보증·정산·사진·완납증명 등 누락 항목을 확인합니다.', list: ['제출 전 체크리스트 검토', '담당자 보완 요청 대응 지원'], file: '제출전_최종검토.pdf' },
  { number: '05', title: '준공·청구 패키지', description: '검수 완료 후 대금청구에 필요한 서류를 한 번에 묶고, 계약이력과 제출문서를 관리합니다.', list: ['청구·하자·완납 자료 패키지', '문서 버전과 제출 이력 관리'], file: '대금청구_패키지.zip' }
];

const SUPABASE_URL = 'https://dwjrzgcfmfxsfxujlemt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IUtesnHyo5QAhYR0o1LatQ_-h9Z7LIJ';
const EMAIL_ENDPOINT = 'https://formsubmit.co/ajax/ca.ygkim@gmail.com';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;

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
  return { id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: form.dataset.formType, createdAt: new Date().toISOString(), data };
}

function setFormMessage(form, message, kind = '') {
  const messageElement = form.querySelector('.form-note');
  messageElement.textContent = message;
  messageElement.className = `form-note ${kind}`.trim();
}

function toSupabaseRecord(submission) {
  const data = submission.data;
  return {
    intake_type: submission.type,
    auth_user_id: currentUser?.id || null,
    company_name: data.company || '',
    manager_name: data.manager || null,
    customer_email: data.email || null,
    phone: data.phone || '',
    service: data.service || null,
    message: data.message || null,
    industry: data.industry || null,
    agency: data.agency || null,
    contract_stage: data.stage || null,
    contract_amount: data.amount || null,
    contact_method: data.contactMethod || null,
    contract_file_name: data.contractFile?.name || null,
    contract_file_size: data.contractFile?.size || null,
    contract_file_type: data.contractFile?.type || null,
    created_at: submission.createdAt,
  };
}

async function saveToSupabase(submission) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(toSupabaseRecord(submission)),
  });
  if (!response.ok) throw new Error(`Supabase insert failed: ${response.status}`);
}

async function sendEmail(submission) {
  const data = submission.data;
  const emailPayload = {
    _subject: submission.type === 'diagnosis' ? '[조달서류 AI 매니저] 계약 1건 진단 신청' : '[조달서류 AI 매니저] 일반 문의',
    _template: 'table',
    신청유형: submission.type === 'diagnosis' ? '계약 1건 진단' : '일반 문의',
    접수일시: submission.createdAt,
    ...data,
  };
  const response = await fetch(EMAIL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(emailPayload),
  });
  if (!response.ok) throw new Error(`Email submission failed: ${response.status}`);
}

async function submitLead(form) {
  const file = form.querySelector('input[type="file"]')?.files?.[0];
  if (file && file.size > 10 * 1024 * 1024) {
    setFormMessage(form, '파일 크기는 10MB 이하로 선택해주세요.', 'error');
    return;
  }
  const submission = createSubmission(form);
  const [databaseResult, emailResult] = await Promise.allSettled([saveToSupabase(submission), sendEmail(submission)]);
  if (databaseResult.status === 'fulfilled') {
    setFormMessage(form, emailResult.status === 'fulfilled' ? '신청이 접수되었습니다. 담당자가 연락드리겠습니다.' : '신청이 중앙 접수되었습니다. 이메일 알림은 연결되지 않았지만 접수 내용은 저장되었습니다.', 'success');
    form.reset();
    return;
  }
  if (emailResult.status === 'fulfilled') {
    setFormMessage(form, '이메일로 신청이 접수되었습니다. Supabase 저장은 아직 완료되지 않았습니다.', 'success');
    form.reset();
    return;
  }
  const localSubmissions = JSON.parse(localStorage.getItem('procurementAiLeads') || '[]');
  localSubmissions.push(submission);
  localStorage.setItem('procurementAiLeads', JSON.stringify(localSubmissions));
  setFormMessage(form, '접수 서버 연결에 실패해 신청 내용을 이 브라우저에 임시 저장했습니다.', 'error');
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

const authModal = document.querySelector('#authModal');
const authTrigger = document.querySelector('#authTrigger');
const mobileAuthTrigger = document.querySelector('#mobileAuthTrigger');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const authMessage = document.querySelector('#authMessage');
const authSession = document.querySelector('#authSession');
const authSessionEmail = document.querySelector('#authSessionEmail');
const authTitle = document.querySelector('#authTitle');

const signupForm = document.querySelector('#signupForm');
const companyField = signupForm.querySelector('label:last-of-type');
const fullNameField = document.createElement('label');
fullNameField.innerHTML = '<span>성명</span><input type="text" name="fullName" placeholder="성명을 입력해주세요" required />';
const signupPhoneField = document.createElement('label');
signupPhoneField.innerHTML = '<span>연락처</span><input type="tel" name="phone" placeholder="010-0000-0000" required />';
signupForm.insertBefore(fullNameField, companyField);
signupForm.insertBefore(signupPhoneField, companyField);

function setAuthMessage(message, kind = '') {
  authMessage.textContent = message;
  authMessage.className = `auth-message ${kind}`.trim();
}

function openAuthModal(tab = 'login') {
  authModal.classList.add('open');
  authModal.setAttribute('aria-hidden', 'false');
  setAuthTab(tab);
  document.body.classList.add('modal-open');
}

function closeAuthModal() {
  authModal.classList.remove('open');
  authModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function setAuthTab(tabName) {
  authTabs.forEach((tab) => {
    const active = tab.dataset.authTab === tabName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  authForms.forEach((form) => form.classList.toggle('active', form.dataset.authForm === tabName));
  authTitle.innerHTML = tabName === 'signup' ? '고객 계정을<br /><span>시작하세요.</span>' : '고객 계정으로<br /><span>계약을 관리하세요.</span>';
  setAuthMessage('');
}

function updateAuthUi(user) {
  currentUser = user || null;
  const label = currentUser ? '내 계정' : '고객 로그인';
  authTrigger.querySelector('span').textContent = label;
  mobileAuthTrigger.textContent = label;
  authSession.hidden = !currentUser;
  authForms.forEach((form) => { form.hidden = Boolean(currentUser); });
  if (currentUser) {
    authSessionEmail.textContent = currentUser.email || '로그인 사용자';
    authTitle.innerHTML = '고객 계정으로<br /><span>로그인되었습니다.</span>';
  } else {
    authSessionEmail.textContent = '';
  }
}

authTrigger.addEventListener('click', () => openAuthModal(currentUser ? 'login' : 'login'));
mobileAuthTrigger.addEventListener('click', () => {
  mobileNav.classList.remove('open');
  openAuthModal('login');
});
document.querySelectorAll('[data-auth-close]').forEach((element) => element.addEventListener('click', closeAuthModal));
authTabs.forEach((tab) => tab.addEventListener('click', () => setAuthTab(tab.dataset.authTab)));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAuthModal(); });

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  setAuthMessage('회원가입 처리 중입니다.');
  const { data: result, error } = await supabaseClient.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { full_name: data.fullName, phone: data.phone, company_name: data.company }, emailRedirectTo: 'https://caygkim-wq.github.io/CODEX_DEMO/' },
  });
  if (error) {
    setAuthMessage(error.message, 'error');
    return;
  }
  form.reset();
  setAuthMessage(result.session ? '회원가입이 완료되었습니다.' : '확인 이메일을 발송했습니다. 이메일 확인 후 로그인해주세요.', 'success');
});

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  setAuthMessage('로그인 처리 중입니다.');
  const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email: data.email, password: data.password });
  if (error) {
    setAuthMessage('이메일 또는 비밀번호를 확인해주세요.', 'error');
    return;
  }
  form.reset();
  updateAuthUi(result.user);
  setAuthMessage('로그인되었습니다.', 'success');
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setAuthMessage('로그아웃에 실패했습니다.', 'error');
    return;
  }
  updateAuthUi(null);
  setAuthMessage('로그아웃되었습니다.', 'success');
  setAuthTab('login');
});

supabaseClient.auth.getSession().then(({ data }) => updateAuthUi(data.session?.user || null));
supabaseClient.auth.onAuthStateChange((_event, session) => updateAuthUi(session?.user || null));
