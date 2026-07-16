-- 조달서류 AI 매니저 신청 접수 테이블
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  intake_type text not null check (intake_type in ('inquiry', 'diagnosis')),
  company_name text not null,
  manager_name text,
  customer_email text,
  phone text not null,
  service text,
  message text,
  industry text,
  agency text,
  contract_stage text,
  contract_amount text,
  contact_method text,
  contract_file_name text,
  contract_file_size bigint,
  contract_file_type text,
  status text not null default 'new' check (status in ('new', 'contacted', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.leads add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table public.leads enable row level security;

drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads"
  on public.leads
  for insert
  to anon
  with check (auth_user_id is null);

drop policy if exists "Authenticated users can create own leads" on public.leads;
create policy "Authenticated users can create own leads"
  on public.leads
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());

-- 일반 방문자는 신청 내용을 조회·수정·삭제할 수 없습니다.
revoke select, update, delete on public.leads from anon;
grant insert on public.leads to anon;
grant insert on public.leads to authenticated;
