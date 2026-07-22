const SUPABASE_URL = 'https://dwjrzgcfmfxsfxujlemt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IUtesnHyo5QAhYR0o1LatQ_-h9Z7LIJ';
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

function authHeaders(token) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(status) {
  const labels = { new: ['접수 대기', ''], contacted: ['상담 중', 'warning'], in_progress: ['검토 진행', 'warning'], closed: ['처리 완료', 'success'] };
  return labels[status] || ['확인 필요', ''];
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
    return `<div class="lead-row"><span>${admin ? `${lead.company_name || '-'} · ${lead.intake_type === 'diagnosis' ? '진단' : '문의'}` : `${lead.intake_type === 'diagnosis' ? '계약 1건 진단' : '일반 문의'}`}</span><span><small>${formatDate(lead.created_at)}</small> <b class="status-pill ${kind}">${label}</b></span></div>`;
  }).join('')}</div>`;
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
    <section class="dash-section" id="view-diagnosis"><p class="dash-lead">계약서와 기본 정보를 보내주시면 담당자가 1건을 기준으로 진단합니다.</p><div class="form-panel"><div class="notice-box">현재 진단 신청은 홈페이지의 신청 화면과 연결되어 있습니다.</div><div class="action-row"><a class="button button-primary" href="index.html#contact">진단 신청 화면으로 이동</a></div></div></section>
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
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  currentRole = profiles[0]?.role === 'admin' || currentUser.app_metadata?.role === 'admin' ? 'admin' : 'customer';
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
