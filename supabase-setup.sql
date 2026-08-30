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

-- ---------------------------------------------------------------------------
-- 작은 사본(썸네일)
--
-- 격자는 손톱만 한 칸인데 원본을 통째로 내려받고 있었다. 1855px 짜리 작품 사진을
-- 264px 칸에, 2400px 짜리 갤러리 사진을 81px 칸에 그리느라 한 장에 1~3MB 가 나갔다.
-- 갤러리를 한 번 끝까지 내리면 180MB, 무료 플랜의 월 전송량 5GB 로는 스물몇 번이면
-- 동난다.
--
-- 그래서 올릴 때 긴 변 400px 짜리 사본을 나란히 올려 두고(같은 경로에 .thumb.jpg),
-- 그 주소를 여기에 담는다. 격자는 이것만 쓰고, 원본은 눌러서 크게 볼 때만 받는다.
-- 실측: 3,496KB -> 32KB (0.9%).
-- 사본이 없으면 화면은 원본으로 물러나므로, 예전 자료도 그대로 보인다.
-- ---------------------------------------------------------------------------
alter table works         add column if not exists thumb_url text;
alter table gallery_media add column if not exists thumb_url text;

-- ---------------------------------------------------------------------------
-- 갤러리에 누구나 올릴 수 있던 구멍 막기
--
-- 화면의 올리기 단추는 진작 관리자에게만 보였지만 서버는 한 번도 막힌 적이 없었다.
-- 브라우저 콘솔만 열면 낯선 사람이 아이들 갤러리에 사진을 올릴 수 있었고,
-- 저장공간(1GB)도 그렇게 채울 수 있었다.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can insert gallery_media" on gallery_media;
create policy "authenticated can insert gallery_media"
  on gallery_media for insert to authenticated with check (true);

drop policy if exists "anyone can upload to gallery bucket" on storage.objects;
create policy "authenticated can upload to gallery bucket"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-uploads');

-- 사본을 다시 만들 때 같은 자리에 덮어써야 해서 update 도 필요하다 (원래 없었음)
drop policy if exists "authenticated can update gallery bucket" on storage.objects;
create policy "authenticated can update gallery bucket"
  on storage.objects for update to authenticated
  using (bucket_id = 'gallery-uploads')
  with check (bucket_id = 'gallery-uploads');

-- ---------------------------------------------------------------------------
-- 아이 목소리
--
-- 작품 설명을 글로 적는 quote 칸은 작품 23개 중 0개가 채워졌다. 올릴 때만 쓸 수 있고,
-- 그때는 사진 정리에 바쁘고, 아이가 한 말이 떠오르는 건 나중이라서.
-- 말로 하면 부담이 훨씬 적다 — "이건 뭐 그린 거야?" 하고 물어 그 대답을 그대로 담는다.
--
-- 브라우저에서 바로 녹음해 저장소에 올리고(suayona/voice/), 주소를 여기 적는다.
-- 최대 60초, opus 로 30초에 100KB 안팎이라 작품 전부에 붙여도 몇 MB 수준이다.
-- 작품 사진과 같은 곳에 두므로 공개 범위도 작품과 같다.
-- ---------------------------------------------------------------------------
alter table works add column if not exists audio_url text;
alter table works add column if not exists audio_secs smallint;

-- ---------------------------------------------------------------------------
-- 이벤트 쪽 쓰기를 부모로 좁힘
--
-- 작품·일기·시간표는 처음부터 my_role() = 'parent' 로 잠겨 있었는데,
-- 이벤트 쪽 네 표만 "로그인했으면 누구나"로 남아 있었다.
-- 화면에서는 아이에게 단추를 숨겨 왔지만 데이터베이스는 열려 있어서,
-- 아이 계정으로 부르면 갤러리 사진이 지워지고 일정이 고쳐졌다(직접 시험해 확인).
--
-- 단추를 숨긴 것과 못 하게 막은 것은 다르다. 여기서 실제로 막는다. 읽기는 그대로 둔다.
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated can write events" on public.events;
create policy "parent writes events" on public.events
  for all to authenticated
  using (my_role() = 'parent') with check (my_role() = 'parent');

drop policy if exists "authenticated can write event_meta" on public.event_meta;
create policy "parent writes event_meta" on public.event_meta
  for all to authenticated
  using (my_role() = 'parent') with check (my_role() = 'parent');

drop policy if exists "authenticated can write custom_tabs" on public.custom_tabs;
create policy "parent writes custom_tabs" on public.custom_tabs
  for all to authenticated
  using (my_role() = 'parent') with check (my_role() = 'parent');

drop policy if exists "authenticated can insert gallery_media" on public.gallery_media;
drop policy if exists "authenticated can update gallery_media" on public.gallery_media;
drop policy if exists "authenticated can delete gallery_media" on public.gallery_media;
create policy "parent writes gallery_media" on public.gallery_media
  for all to authenticated
  using (my_role() = 'parent') with check (my_role() = 'parent');

-- 표를 잠가도 파일 쪽이 열려 있으면 막은 것이 아니다.
-- 줄은 못 지워도 사진 파일 자체는 지울 수 있었다. 두 버킷 모두 부모로 좁힌다.
--
-- select 규칙은 원래 아무것도 없었다. 버킷이 공개라 주소로 보는 것은 되지만
-- 목록을 훑는 것은 아무도 못 했다 — 그것도 오류 없이 빈 목록이 와서 눈치채기 어렵다.
-- 안 쓰는 파일을 찾아 치우려면 부모는 목록을 볼 수 있어야 한다.
drop policy if exists "authenticated can upload event images"       on storage.objects;
drop policy if exists "authenticated can update event images"       on storage.objects;
drop policy if exists "authenticated can delete event images"       on storage.objects;
drop policy if exists "authenticated can upload to gallery bucket"  on storage.objects;
drop policy if exists "authenticated can update gallery bucket"     on storage.objects;
drop policy if exists "authenticated can delete from gallery bucket" on storage.objects;

create policy "parent lists media" on storage.objects
  for select to authenticated
  using (bucket_id in ('event-images','gallery-uploads') and my_role() = 'parent');

create policy "parent uploads media" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('event-images','gallery-uploads') and my_role() = 'parent');

create policy "parent updates media" on storage.objects
  for update to authenticated
  using      (bucket_id in ('event-images','gallery-uploads') and my_role() = 'parent')
  with check (bucket_id in ('event-images','gallery-uploads') and my_role() = 'parent');

create policy "parent deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id in ('event-images','gallery-uploads') and my_role() = 'parent');

-- ---------------------------------------------------------------------------
-- 일기·일정 사진의 작은 사본
--
-- 작품과 갤러리는 이미 사본을 쓰는데 이 둘만 원본을 그대로 내려주고 있었다.
-- 일정 사진은 4000px 를 252px 자리에 — 16배. 일기 사진은 11배.
--
-- 대표 사진의 사본은 thumb_url 에, 추가 사진들은 extra_images 안에 thumb 키로 넣는다.
-- 사진으로 일정을 만들면 갤러리 사진 주소가 그대로 붙으므로, 그때는 갤러리가 이미
-- 가지고 있는 사본 주소를 그대로 물려준다(새로 만들지 않는다).
-- ---------------------------------------------------------------------------
alter table public.posts  add column if not exists thumb_url text;
alter table public.events add column if not exists thumb_url text;

-- profiles 는 "자기 것만 읽기" 라서 부모가 백업을 받아도 세 줄 중 한 줄만 들어왔다.
-- 개수까지 걸러진 채로 오기 때문에 "다 받았나" 확인하는 장치로도 잡히지 않는다.
-- 누가 어떤 역할인지는 부모가 알아야 할 것이고, 그래야 백업도 온전해진다.
create policy "parent reads all profiles" on public.profiles
  for select to authenticated
  using (my_role() = 'parent');
