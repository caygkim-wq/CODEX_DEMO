-- 조달서류 AI 매니저 관리자 계정 설정
--
-- 1. 먼저 웹사이트에서 ca.ygkim@gmail.com 주소로 회원가입합니다.
-- 2. 가입 확인 이메일의 링크를 클릭합니다.
-- 3. Supabase SQL Editor에서 supabase-schema.sql을 먼저 실행합니다.
-- 4. 이 파일의 아래 SQL을 실행하면 해당 계정이 관리자 계정으로 전환됩니다.

insert into public.profiles (id, role, email, full_name, phone, company_name)
select
  id,
  'admin',
  email,
  raw_user_meta_data ->> 'full_name',
  raw_user_meta_data ->> 'phone',
  raw_user_meta_data ->> 'company_name'
from auth.users
where email = 'ca.ygkim@gmail.com'
on conflict (id) do update
set role = 'admin';

-- 관리자 지정 결과 확인
select p.id, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'ca.ygkim@gmail.com';
