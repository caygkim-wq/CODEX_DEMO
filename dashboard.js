const SUPABASE_URL = 'https://dwjrzgcfmfxsfxujlemt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IUtesnHyo5QAhYR0o1LatQ_-h9Z7LIJ';
const CONTRACT_DOCUMENT_BUCKET = 'contract-documents';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const customerMenu = [
  ['home', '홈'], ['contracts', '내 계약'], ['diagnosis', '진단 신청'], ['files', '서류함'],
  ['requests', '보완 요청'], ['inquiries', '문의'], ['account', '내 계정'],
];
const adminMenu = [
  ['home', '홈'], ['inbox', '접수함'], ['customers', '고객 관리'], ['contracts', '계약·진단'],
  ['review', '서류 검토'], ['inquiries', '문의 관리'], ['settings', '설정'],
];
const content = document.querySelector('#dashboardContent');
const nav = document.querySelector('#dashboardNav');
const userEmail = document.querySelector('#userEmail');
const userInitial = document.querySelector('#userInitial');
const pageTitle = document.querySelector('#pageTitle');
const roleBadge = document.querySelector('#roleBadge');
let currentUser = null;
let currentRole = 'customer';
let leads = [];
let profiles = [];

content.addEventListener('click', (event) => {
  const detailButton = event.target.closest('[data-lead-detail]');
  if (detailButton) openLeadDetail(detailButton.dataset.leadDetail);
});

function authHeaders(token) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(new Date(value));
}

function statusLabel(status) {
  const labels = { new: ['접수 대기', ''], contacted: ['상담 중', 'warning'], in_progress: ['검토 진행', 'warning'], closed: ['처리 완료', 'success'] };
  return labels[status] || ['확인 필요', ''];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

function renderNav() {
  const menu = currentRole === 'admin' ? adminMenu : customerMenu;
  nav.innerHTML = menu.map(([id, label], index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-view="${id}">${label}</button>`).join('');
  nav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
}

function showView(view) {
  nav.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.dash-section').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
  const active = nav.querySelector(`[data-view="${view}"]`);
  pageTitle.textContent = active?.textContent || (currentRole === 'admin' ? '관리자 대시보드' : '고객 대시보드');
}

function leadRows(items, admin = false) {
  if (!items.length) return '<div class="empty-state"><strong>아직 접수된 내용이 없습니다.</strong>새로운 신청이나 문의가 등록되면 이곳에서 확인할 수 있습니다.</div>';
  return `<div class="lead-list">${items.map((lead) => {
    const [label, kind] = statusLabel(lead.status);
    const title = admin ? `${lead.company_name || '-'} · ${lead.intake_type === 'diagnosis' ? '진단' : '문의'}` : `${lead.intake_type === 'diagnosis' ? '계약 1건 진단' : '일반 문의'}`;
    const canViewDetail = admin || lead.intake_type === 'diagnosis';
    const detailButton = canViewDetail ? `<button class="lead-detail-button" type="button" data-lead-detail="${lead.id}">상세 보기</button>` : '';
    return `<div class="lead-row"><span>${escapeHtml(title)}</span><span><small>${formatDate(lead.created_at)}</small> <b class="status-pill ${kind}">${label}</b>${detailButton}</span></div>`;
  }).join('')}</div>`;
}

function openLeadDetail(leadId) {
  const lead = leads.find((item) => item.id === leadId);
  const canViewLead = currentRole === 'admin' || lead?.auth_user_id === currentUser?.id;
  if (!lead || !canViewLead) return;

  document.querySelector('#leadDetailModal')?.remove();
  const [status, statusKind] = statusLabel(lead.status);
  const values = [
    ['접수 구분', lead.intake_type === 'diagnosis' ? '계약 1건 진단' : '일반 문의'],
    ['접수일', formatDate(lead.created_at)],
    ['회사명', lead.company_name],
    ['담당자', lead.manager_name],
    ['연락처', lead.phone],
    ['이메일', lead.customer_email],
    ['업종', lead.industry],
    ['발주기관', lead.agency],
    ['계약 단계', lead.contract_stage],
    ['계약금액', lead.contract_amount],
    ['희망 연락 방법', lead.contact_method],
  ].filter(([, value]) => value);
  const detailRows = values.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const hasStoredFile = Boolean(lead.contract_file_path);
  const fileArea = lead.contract_file_name
    ? `<div class="detail-file"><div><strong>${escapeHtml(lead.contract_file_name)}</strong><small>${escapeHtml(lead.contract_file_type || '파일 형식 정보 없음')} · ${formatFileSize(lead.contract_file_size)}</small></div>${hasStoredFile ? '<button class="button button-primary" type="button" data-download-document>첨부파일 열기</button>' : '<small class="legacy-file-note">이전 홈페이지 접수 건은 파일명만 기록되어 있어 원본 파일을 열 수 없습니다.</small>'}</div>`
    : '<div class="empty-state"><strong>첨부파일이 없습니다.</strong>신청 시 파일이 제출되지 않았습니다.</div>';
  const message = lead.message ? `<section class="detail-message"><h3>문의 내용</h3><p>${escapeHtml(lead.message)}</p></section>` : '';
  const modal = document.createElement('div');
  modal.id = 'leadDetailModal';
  modal.className = 'lead-detail-modal';
  modal.innerHTML = `<div class="lead-detail-backdrop" data-detail-close></div><section class="lead-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="leadDetailTitle"><button class="lead-detail-close" type="button" data-detail-close aria-label="닫기">×</button><p class="eyebrow blue-text">DIAGNOSIS REQUEST</p><h2 id="leadDetailTitle">${lead.intake_type === 'diagnosis' ? '계약 1건 진단 신청' : '고객 문의'} <span class="status-pill ${statusKind}">${status}</span></h2><div class="detail-grid">${detailRows}</div>${message}<section class="detail-file-section"><h3>첨부 계약자료</h3>${fileArea}<p class="detail-download-status" role="status"></p></section></section>`;
  document.body.append(modal);
  document.body.classList.add('modal-open');
  modal.querySelectorAll('[data-detail-close]').forEach((button) => button.addEventListener('click', () => {
    modal.remove();
    document.body.classList.remove('modal-open');
  }));
  modal.querySelector('[data-download-document]')?.addEventListener('click', () => downloadLeadDocument(lead, modal));
}

async function downloadLeadDocument(lead, modal) {
  const status = modal.querySelector('.detail-download-status');
  status.textContent = '첨부파일을 준비하고 있습니다.';
  const { data, error } = await supabaseClient.storage.from(CONTRACT_DOCUMENT_BUCKET).createSignedUrl(lead.contract_file_path, 60);
  if (error) {
    status.textContent = `첨부파일을 열 수 없습니다. (${error.message})`;
    status.classList.add('error');
    return;
  }
  const link = document.createElement('a');
  link.href = data.signedUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  status.textContent = '첨부파일을 새 창에서 열었습니다.';
}

function profileRows(items) {
  if (!items.length) return '<div class="empty-state"><strong>가입한 고객이 아직 없습니다.</strong>회원가입이 완료된 고객이 이곳에 표시됩니다.</div>';
  return `<div class="data-table-wrap"><table class="data-table customer-table"><thead><tr><th>가입일</th><th>회사명</th><th>성명</th><th>연락처</th><th>이메일</th><th>구분</th></tr></thead><tbody>${items.map((profile) => `<tr><td>${formatDate(profile.created_at)}</td><td>${profile.company_name || '-'}</td><td>${profile.full_name || '-'}</td><td>${profile.phone || '-'}</td><td>${profile.email || '-'}</td><td><b class="status-pill ${profile.role === 'admin' ? 'success' : ''}">${profile.role === 'admin' ? '관리자' : '고객'}</b></td></tr>`).join('')}</tbody></table></div>`;
}

function renderCustomer() {
  const active = leads.filter((lead) => lead.status !== 'closed').length;
  const requests = leads.filter((lead) => lead.status === 'in_progress').length;
  content.innerHTML = `
    <section class="dash-section active" id="view-home">
      <p class="dash-lead">${currentUser.user_metadata?.company_name || '고객사'}님의 계약 서류 진행상황을 한눈에 확인하세요.</p>
      <div class="summary-grid"><div class="summary-card"><small>내 계약·진단</small><strong class="blue">${leads.length}</strong></div><div class="summary-card"><small>진행 중</small><strong class="orange">${active}</strong></div><div class="summary-card"><small>보완 요청</small><strong class="orange">${requests}</strong></div><div class="summary-card"><small>완료</small><strong class="green">${leads.filter((lead) => lead.status === 'closed').length}</strong></div></div>
      <div class="dash-grid"><div class="dash-card"><h2>최근 접수 내역</h2>${leadRows(leads.slice(0, 5))}<div class="action-row"><button class="button button-primary" type="button" data-go="diagnosis">계약 1건 진단 신청</button></div></div><div class="dash-card"><h2>오늘 처리할 일</h2><div class="notice-box">서류를 제출하면 담당자가 확인 후 필요한 보완사항을 안내해드립니다.</div><div class="action-row"><button class="button auth-logout" type="button" data-go="files">서류함 열기</button></div></div></div>
    </section>
    <section class="dash-section" id="view-contracts"><p class="dash-lead">고객님의 계약과 진단 신청 이력을 관리합니다.</p><div class="dash-card"><h2>내 계약·진단 목록</h2>${leadRows(leads)}</div></section>
    <section class="dash-section" id="view-diagnosis"><p class="dash-lead">계약 정보와 자료를 제출하면 담당자가 계약 1건을 기준으로 필요한 서류와 다음 단계를 진단합니다.</p><form class="form-panel dashboard-form" id="dashboardDiagnosisForm"><div class="dashboard-form-grid"><label><span>회사명</span><input type="text" name="company" value="${currentUser.user_metadata?.company_name || ''}" required /></label><label><span>담당자명</span><input type="text" name="manager" value="${currentUser.user_metadata?.full_name || ''}" required /></label><label><span>연락처</span><input type="tel" name="phone" value="${currentUser.user_metadata?.phone || ''}" placeholder="010-0000-0000" required /></label><label><span>업종</span><select name="industry" required><option value="">선택해주세요</option><option>전기공사</option><option>통신공사</option><option>시설물 유지보수</option><option>물품·납품</option><option>일반 용역</option><option>기타</option></select></label><label><span>발주기관</span><input type="text" name="agency" placeholder="예: ○○시청" required /></label><label><span>계약 단계</span><select name="stage"><option>계약체결 전</option><option>착공 준비</option><option>이행 중</option><option>준공·완료 준비</option><option>대금청구 준비</option></select></label><label><span>계약금액</span><input type="text" name="amount" placeholder="예: 48,500,000원" /></label><label><span>희망 연락 방법</span><select name="contactMethod"><option>전화</option><option>문자</option><option>이메일</option></select></label></div><label class="dashboard-file-field"><span>진단용 계약자료</span><input type="file" name="contractFile" accept=".pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls,.zip" required /><small>PDF, HWP/HWPX, Word, Excel, ZIP 파일 · 최대 10MB</small></label><label class="dashboard-consent"><input type="checkbox" name="consent" required /><span>상담 및 계약자료 확인을 위한 개인정보 수집·이용에 동의합니다.</span></label><button class="button button-primary" type="submit">파일 업로드 후 진단 신청</button><p class="dashboard-form-status" role="status"></p></form></section>
    <section class="dash-section" id="view-files"><p class="dash-lead">계약별 제출 서류와 파일 상태를 확인하는 공간입니다.</p><div class="dash-card"><h2>서류함</h2><div class="empty-state"><strong>연결된 서류함을 준비 중입니다.</strong>계약 진단 신청 후 제출 파일이 계약별로 표시됩니다.</div></div></section>
    <section class="dash-section" id="view-requests"><p class="dash-lead">담당자가 요청한 보완사항을 확인하고 자료를 다시 제출합니다.</p><div class="dash-card"><h2>보완 요청</h2>${leadRows(leads.filter((lead) => lead.status === 'in_progress'))}</div></section>
    <section class="dash-section" id="view-inquiries"><p class="dash-lead">문의와 상담 답변을 확인합니다.</p><div class="dash-card"><h2>문의 내역</h2>${leadRows(leads.filter((lead) => lead.intake_type === 'inquiry'))}</div></section>
    <section class="dash-section" id="view-account"><p class="dash-lead">회원정보와 회사정보를 확인합니다.</p><div class="dash-card"><h2>내 계정</h2><div class="status-list"><div class="status-row"><span>이메일</span><strong>${currentUser.email || '-'}</strong></div><div class="status-row"><span>성명</span><strong>${currentUser.user_metadata?.full_name || '-'}</strong></div><div class="status-row"><span>연락처</span><strong>${currentUser.user_metadata?.phone || '-'}</strong></div><div class="status-row"><span>회사명</span><strong>${currentUser.user_metadata?.company_name || '-'}</strong></div></div></div></section>`;
  wireActionButtons();
}

function renderAdmin() {
  const active = leads.filter((lead) => lead.status !== 'closed').length;
  const customerCount = profiles.filter((profile) => profile.role !== 'admin').length;
  content.innerHTML = `
    <section class="dash-section active" id="view-home"><p class="dash-lead">전체 고객 접수와 계약 서류 처리현황을 관리합니다.</p><div class="summary-grid"><div class="summary-card"><small>가입 고객</small><strong class="blue">${customerCount}</strong></div><div class="summary-card"><small>전체 접수</small><strong class="blue">${leads.length}</strong></div><div class="summary-card"><small>신규 접수</small><strong class="orange">${leads.filter((lead) => lead.status === 'new').length}</strong></div><div class="summary-card"><small>처리 완료</small><strong class="green">${leads.filter((lead) => lead.status === 'closed').length}</strong></div></div><div class="dash-grid"><div class="dash-card"><h2>최근 접수</h2>${leadRows(leads.slice(0, 8), true)}</div><div class="dash-card"><h2>운영 안내</h2><div class="notice-box">관리자 권한은 Supabase profiles 테이블에서 role이 admin인 계정에만 부여해야 합니다.</div></div></div></section>
    <section class="dash-section" id="view-inbox"><p class="dash-lead">홈페이지에서 접수된 문의와 진단 신청을 확인합니다.</p><div class="data-table-wrap"><table class="data-table"><thead><tr><th>접수일</th><th>구분</th><th>회사명</th><th>연락처</th><th>상태</th></tr></thead><tbody>${leads.length ? leads.map((lead) => { const [label, kind] = statusLabel(lead.status); return `<tr><td>${formatDate(lead.created_at)}</td><td>${lead.intake_type === 'diagnosis' ? '계약 진단' : '일반 문의'}</td><td>${lead.company_name || '-'}</td><td>${lead.phone || '-'}</td><td><b class="status-pill ${kind}">${label}</b></td></tr>`; }).join('') : '<tr><td colspan="5">접수된 항목이 없습니다.</td></tr>'}</tbody></table></div></section>
    <section class="dash-section" id="view-customers"><p class="dash-lead">회원가입한 고객의 기본정보와 계정 구분을 관리합니다.</p><div class="dash-card"><h2>회원가입 고객 목록 <span class="section-count">${customerCount}명</span></h2>${profileRows(profiles)}</div></section>
    <section class="dash-section" id="view-contracts"><p class="dash-lead">진단 신청을 계약 단위로 관리합니다.</p><div class="dash-card"><h2>계약·진단 목록</h2>${leadRows(leads.filter((lead) => lead.intake_type === 'diagnosis'), true)}</div></section>
    <section class="dash-section" id="view-review"><p class="dash-lead">제출 서류의 검토 결과와 보완 요청을 관리합니다.</p><div class="dash-card"><h2>서류 검토 대기</h2>${leadRows(leads.filter((lead) => lead.intake_type === 'diagnosis' && lead.status !== 'closed'), true)}</div></section>
    <section class="dash-section" id="view-inquiries"><p class="dash-lead">고객 문의에 답변하고 상담 이력을 남깁니다.</p><div class="dash-card"><h2>문의 목록</h2>${leadRows(leads.filter((lead) => lead.intake_type === 'inquiry'), true)}</div></section>
    <section class="dash-section" id="view-settings"><p class="dash-lead">서비스 운영 기준과 관리자 환경을 설정합니다.</p><div class="dash-card"><h2>운영 설정</h2><div class="settings-list"><div class="settings-item"><span><strong>신규 접수 알림</strong><small>새 문의가 들어오면 관리자에게 알림을 보냅니다.</small></span><i class="toggle on"></i></div><div class="settings-item"><span><strong>보완 요청 알림</strong><small>고객에게 보완 요청 상태를 안내합니다.</small></span><i class="toggle on"></i></div><div class="settings-item"><span><strong>서식·체크리스트 관리</strong><small>계약 유형별 검토 기준을 관리합니다.</small></span><i class="toggle"></i></div></div></div></section>`;
}

function wireActionButtons() {
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
  document.querySelector('#dashboardDiagnosisForm')?.addEventListener('submit', submitDashboardDiagnosis);
}

function setDiagnosisStatus(form, message, kind = '') {
  const status = form.querySelector('.dashboard-form-status');
  status.textContent = message;
  status.className = `dashboard-form-status ${kind}`.trim();
}

function createStorageFileName(fileName) {
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'contract_document';
  return `${Date.now()}_${baseName}${extension}`;
}

async function submitDashboardDiagnosis(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const file = form.querySelector('input[name="contractFile"]').files?.[0];
  const allowedExtensions = ['pdf', 'doc', 'docx', 'hwp', 'hwpx', 'xlsx', 'xls', 'zip'];
  const extension = file?.name.split('.').pop()?.toLowerCase();

  if (!file || !allowedExtensions.includes(extension)) {
    setDiagnosisStatus(form, '지원하는 형식의 계약자료를 선택해주세요.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setDiagnosisStatus(form, '파일 크기는 10MB 이하만 업로드할 수 있습니다.', 'error');
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session || !currentUser) {
    setDiagnosisStatus(form, '로그인 상태를 확인할 수 없습니다. 다시 로그인해주세요.', 'error');
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const storagePath = `${currentUser.id}/${createStorageFileName(file.name)}`;
  submitButton.disabled = true;
  setDiagnosisStatus(form, '계약자료를 업로드하고 신청을 접수하는 중입니다.');

  const { data: uploadData, error: uploadError } = await supabaseClient.storage
    .from(CONTRACT_DOCUMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (uploadError) {
    submitButton.disabled = false;
    setDiagnosisStatus(form, `파일 업로드에 실패했습니다. (${uploadError.message})`, 'error');
    return;
  }

  const record = {
    intake_type: 'diagnosis',
    auth_user_id: currentUser.id,
    company_name: data.company,
    manager_name: data.manager,
    customer_email: currentUser.email || null,
    phone: data.phone,
    industry: data.industry,
    agency: data.agency,
    contract_stage: data.stage,
    contract_amount: data.amount || null,
    contact_method: data.contactMethod,
    contract_file_name: file.name,
    contract_file_size: file.size,
    contract_file_type: file.type || null,
    contract_file_path: uploadData.path,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: { ...authHeaders(sessionData.session.access_token), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(record),
  });

  submitButton.disabled = false;
  if (!response.ok) {
    await supabaseClient.storage.from(CONTRACT_DOCUMENT_BUCKET).remove([uploadData.path]);
    setDiagnosisStatus(form, '신청 정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    return;
  }

  form.reset();
  leads = await loadLeads(sessionData.session);
  renderCustomer();
  showView('contracts');
}

async function loadLeads(session) {
  const query = currentRole === 'admin' ? '' : `&auth_user_id=eq.${encodeURIComponent(currentUser.id)}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc${query}`, { headers: authHeaders(session.access_token) });
  if (!response.ok) return [];
  return response.json();
}

async function loadProfiles(session) {
  if (currentRole !== 'admin') return [];
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,full_name,phone,company_name,role,created_at&order=created_at.desc`, { headers: authHeaders(session.access_token) });
  if (!response.ok) return [];
  return response.json();
}

async function initializeDashboard() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = sessionData.session.user;
  userEmail.textContent = currentUser.email || '';
  userInitial.textContent = (currentUser.email || '?').charAt(0).toUpperCase();

  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(currentUser.id)}&select=role`, { headers: authHeaders(sessionData.session.access_token) });
  const currentProfile = profileResponse.ok ? await profileResponse.json() : [];
  currentRole = currentProfile[0]?.role === 'admin' || currentUser.app_metadata?.role === 'admin' ? 'admin' : 'customer';
  roleBadge.textContent = currentRole === 'admin' ? '관리자 포털' : '고객 포털';
  pageTitle.textContent = currentRole === 'admin' ? '관리자 대시보드' : '고객 대시보드';
  leads = await loadLeads(sessionData.session);
  profiles = await loadProfiles(sessionData.session);
  renderNav();
  currentRole === 'admin' ? renderAdmin() : renderCustomer();
}

document.querySelector('#dashboardLogout').addEventListener('click', async () => {
  await supabaseClient.auth.signOut({ scope: 'local' });
  window.location.href = 'index.html';
});

initializeDashboard();
