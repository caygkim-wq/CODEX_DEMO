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

-- 고객·관리자 대시보드용 프로필과 권한
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  email text,
  full_name text,
  phone text,
  company_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, company_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'company_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant select on public.leads to authenticated;

drop policy if exists "Customers can read own leads" on public.leads;
create policy "Customers can read own leads"
  on public.leads
  for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "Admins can read all leads" on public.leads;
create policy "Admins can read all leads"
  on public.leads
  for select
  to authenticated
  using (public.is_admin());

-- 관리자 계정 생성 후 아래 문장을 실행하세요. 관리자 이메일: ca.ygkim@gmail.com
-- update public.profiles
-- set role = 'admin', email = 'ca.ygkim@gmail.com'
-- where id = (select id from auth.users where email = 'ca.ygkim@gmail.com');
