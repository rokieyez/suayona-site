-- 수아·연아 메인 사이트용 테이블.
-- 기존 이벤트 사이트와 같은 Supabase 프로젝트의 SQL Editor에서 실행하세요.
-- 사진은 이미 만들어져 있는 'event-images' 버킷을 그대로 씁니다 (새 버킷을 만들 필요 없음).

-- ============================================================
-- 1) 포트폴리오 (작품)
-- ============================================================
create table if not exists works (
  id bigint generated always as identity primary key,
  author text not null default 'together',  -- 'sua' | 'yona' | 'together'
  title text not null,
  description text,
  media_url text not null,
  media_type text not null default 'image',  -- 'image' | 'video'
  made_on date,                              -- 만든 날짜 (선택)
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table works enable row level security;

-- 누구나 볼 수 있음 (공개 전시실)
create policy "public can read works"
  on works for select
  using (true);

-- 추가/수정/삭제는 로그인한 사람만
create policy "authenticated can write works"
  on works for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ============================================================
-- 2) 게시판 (글)
-- ============================================================
create table if not exists posts (
  id bigint generated always as identity primary key,
  author text not null default 'together',   -- 'sua' | 'yona' | 'together'
  title text not null,
  body text,
  image_url text,
  is_public boolean not null default true,   -- false 면 로그인한 사람만 볼 수 있음
  created_at timestamptz default now()
);

alter table posts enable row level security;

-- 공개 글은 누구나, 비공개 글은 로그인한 사람만
create policy "public can read public posts"
  on posts for select
  using (is_public = true or auth.role() = 'authenticated');

create policy "authenticated can write posts"
  on posts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ============================================================
-- 3) 컨택트로 받은 메시지
--    누구나 보낼 수 있고(insert), 읽는 건 로그인한 사람만.
-- ============================================================
create table if not exists messages (
  id bigint generated always as identity primary key,
  name text,
  contact text,          -- 이메일/전화 등 답장받을 곳
  body text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;

-- 방문자는 남기기만 가능
create policy "anyone can insert messages"
  on messages for insert
  with check (true);

-- 읽기/삭제는 로그인한 사람만 (아무나 남의 메시지를 볼 수 없게)
create policy "authenticated can read messages"
  on messages for select
  using (auth.role() = 'authenticated');

create policy "authenticated can delete messages"
  on messages for delete
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 일정 항목에 사진 여러 장
-- 첫 장은 기존처럼 events.image_url 에 남고(예전 데이터·갤러리 질의와 호환),
-- 두 번째 장부터 아래 컬럼에 [{url, taken_at, location_name}] 형태로 쌓임.
-- 이 줄을 실행하기 전까지는 일정마다 사진 1장만 저장됨(관리자 화면에 안내가 뜸).
-- ---------------------------------------------------------------------------
alter table events add column if not exists extra_images jsonb default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 아이 계정과 부모 확인
--
-- 계정을 만들기만 하면 "로그인했으면 무엇이든" 이던 기존 정책 때문에
-- 아이가 남의 글과 작품까지 지울 수 있다. 그래서 역할을 먼저 나눴다.
--
--   profiles.role = 'parent'  전부 다룸
--   profiles.role = 'child'   자기 이름으로, 확인 대기 상태의 글만.
--                             한 번 공개된 글은 아이가 되돌릴 수 없고, 작품은 손대지 못함.
--
-- 아이 계정을 쓰려면 (Supabase 대시보드에서 계정을 만든 뒤):
--   insert into profiles (user_id, role, display, author_key)
--   values ('<수아 계정 uuid>', 'child', '수아', 'sua'),
--          ('<연아 계정 uuid>', 'child', '연아', 'yona');
-- ---------------------------------------------------------------------------

-- ============================================================
-- 4) 아이들 시간표 (/time.html)
--
-- 학교 수업 · 학원 · 그때그때 생기는 일정을 한 테이블에 담는다.
-- 세 가지처럼 보이지만 실제로는 두 종류뿐이라 표를 나누지 않았다.
--
--   매주 오는 것   → weekday 를 채운다 (0=일 … 6=토). 학기는 valid_from/valid_to.
--   하루짜리       → on_date 를 채운다.
--
-- 둘 중 하나만 채워야 하고, 그걸 schedules_one_shape 가 강제한다.
-- kind 는 색 구분용 꼬리표일 뿐이라 별도 표를 두지 않았다.
-- ============================================================
create table if not exists schedules (
  id         bigserial primary key,
  who        text    not null check (who in ('sua','yona','together')),
  kind       text    not null default 'school' check (kind in ('school','academy','other')),
  title      text    not null,
  place      text,
  weekday    smallint check (weekday between 0 and 6),
  on_date    date,
  start_at   time    not null,
  end_at     time,
  valid_from date,
  valid_to   date,
  note       text,
  event_slug text,          -- 나들이로 커지면 일정표 페이지로 이어 붙일 자리
  created_at timestamptz not null default now(),
  constraint schedules_one_shape  check ((weekday is null) <> (on_date is null)),
  constraint schedules_time_order check (end_at is null or end_at > start_at)
);

create index if not exists schedules_weekday_idx on schedules (who, weekday);
create index if not exists schedules_date_idx    on schedules (on_date);

alter table schedules enable row level security;

-- 보기: 로그인한 가족만.
-- 작품이나 일기와 달리 시간표는 "이 아이가 몇 시에 어디 있는지"를 그대로 알려준다.
-- 그래서 이 표만은 공개하지 않고, /time.html 도 검색엔진에서 빼 두었다.
drop policy if exists schedules_read on schedules;
create policy schedules_read on schedules
  for select to authenticated using (true);

-- 고치기: 부모만. 아이는 자기 시간표라도 보기만 한다.
drop policy if exists schedules_write on schedules;
create policy schedules_write on schedules
  for all to authenticated
  using (public.my_role() = 'parent')
  with check (public.my_role() = 'parent');
