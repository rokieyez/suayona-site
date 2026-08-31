// 모든 페이지가 함께 쓰는 공통 코드 — 헤더/푸터, 로그인, 이미지 업로드, 스크롤 효과.

// 들어올 때 주소 뒤에 붙어 있던 것을 그대로 적어 둔다.
// supabase-js 는 클라이언트를 만드는 순간 주소 뒤(#access_token=... 또는 #error=...)를
// 읽고 지워 버린다. 그래서 그 뒤에 보면 이미 없다 — 지워지기 전에 챙겨 둬야 한다.
const INITIAL_HASH = location.hash;

// 비밀번호 재설정 메일의 링크는 Supabase 에 적어 둔 Site URL 로 떨어진다.
// 그게 어느 페이지든(대개 첫 화면) 비밀번호 바꾸는 화면으로 옮겨 준다.
if (/[#&]type=recovery/.test(INITIAL_HASH) && !/\/reset\.html$/.test(location.pathname)) {
  location.replace('/reset.html' + INITIAL_HASH);
}

const SB_URL = 'https://ifiemaypzjwdrljmmkgb.supabase.co';
const SB_KEY = 'sb_publishable_uhn46d4RFI5DeIUjtz3IRA_U9X8iPZj';
const sb = supabase.createClient(SB_URL, SB_KEY);

// 사진은 이 버킷에 올라감 (부모로 로그인했을 때만 쓸 수 있도록 정책이 걸려 있음)
const MEDIA_BUCKET = 'event-images';        // 작품·일기·일정 사진, 목소리
const GALLERY_BUCKET = 'gallery-uploads';   // 이벤트 갤러리에 올린 사진·영상
// 사진은 이 용량을 넘을 때만 압축함 (넘지 않으면 원본 그대로 올라감).
// 3MB 로 잡아 두면 요즘 휴대폰 사진(보통 4~5MB)이 거의 다 걸려서 긴 변 2400px 로
// 줄어든다. 화면에서는 차이가 안 보이는데 무료 저장공간(1GB)은 두 배 넘게 간다.
const IMAGE_LIMIT = 3 * 1024 * 1024;         // 갤러리·일기장 사진
const PORTFOLIO_IMAGE_LIMIT = 10 * 1024 * 1024;  // 작품은 화질이 중요해서 10MB
const VIDEO_LIMIT = 100 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 카카오 지도 불러오기
//
// 이 열쇠는 숨기는 값이 아니다. 카카오의 JavaScript 키는 페이지 소스에 그대로
// 들어가라고 만든 것이고, 등록해 둔 도메인(www.suayona.com)이 아니면 동작하지 않는다.
// 밖으로 나가면 안 되는 것은 REST API 키와 Admin 키 쪽이다 — 그 둘은 여기 없다.
//
// 꾸러미가 무거워서 미리 받지 않는다. 지도를 실제로 그릴 때(이벤트 목록의 지도 띠),
// 장소를 실제로 물어볼 때(관리 화면) 그때 한 번만 받아 온다.
// 서비스가 꺼져 있거나 도메인이 안 맞으면 여기서 실패하고, 부른 쪽이 조용히 접는다.
// ---------------------------------------------------------------------------
const KAKAO_JS_KEY = '4d0e9436c2a93d4222d355d33ce5045d';

let _kakaoReady = null;
function loadKakaoMaps(){
  if (_kakaoReady) return _kakaoReady;
  _kakaoReady = new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) return resolve(true);
    const sc = document.createElement('script');
    // 부르는 곳마다 꾸러미 목록이 다르면 주소가 갈려 두 번 받게 된다 — 늘 같은 주소로 부른다.
    sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + KAKAO_JS_KEY +
             '&libraries=services&autoload=false';
    sc.onload = () => window.kakao.maps.load(() => resolve(true));
    sc.onerror = () => reject(new Error('카카오 지도를 불러오지 못했습니다'));
    document.head.appendChild(sc);
  });
  return _kakaoReady;
}

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// 모아보기(year.html)는 여기 없다. 포트폴리오의 연도 버튼 옆에서 들어간다 —
// "2026년 작품"과 "2026년 모아보기"가 메뉴에 나란히 있으면 무엇이 다른지 알기 어렵고,
// 연도를 이미 고른 자리에서 넘어가면 저쪽에서 다시 고를 필요도 없다.
// 소개는 메뉴에서 뺐다 — 첫 화면에서 아이들을 눌러 이름을 보는 쪽이 더 재미있어서.
// about.html 은 그대로 남아 있으니 주소를 아는 사람은 계속 볼 수 있다.
const MENU = [
  { href: '/',              label: '홈',        key: 'home' },
  { href: '/portfolio.html',label: '포트폴리오', key: 'portfolio' },
  { href: '/board.html',    label: '일기장',    key: 'board' },
  { href: '/event/',        label: '이벤트',    key: 'event' },
  { href: '/contact.html',  label: '편지쓰기',  key: 'contact' },
];

// 로그인한 가족에게만 보이는 곳. 메뉴 목록에 섞지 않고 헤더에 아이콘 단추로 따로 둔다 —
// 공개 메뉴와 성격이 다르고, 자주 여는 곳이라 햄버거 안에 숨기면 매번 두 번 눌러야 한다.
const PRIVATE_LINK = { href: '/time.html', icon: '🗓️', label: '시간표', key: 'time' };

let ACTIVE_KEY = null;

// ---------- 헤더 / 푸터 ----------
function buildChrome(activeKey){
  ACTIVE_KEY = activeKey;
  const header = document.createElement('header');
  header.className = 'site';
  header.id = 'siteHeader';
  header.innerHTML =
    '<a class="logo" href="/">' +
      '<canvas id="logoCanvas" width="36" height="36"></canvas>' +
      '<span class="logo-text pixel">수아랑 연아랑</span>' +
    '</a>' +
    '<div class="hdr-right">' +
      '<nav id="nav">' +
        MENU.map(m =>
          '<a href="' + m.href + '"' +
          (m.external ? ' target="_blank" rel="noopener"' : '') +
          (m.key === activeKey ? ' class="active"' : '') +
          '>' + m.label + '</a>'
        ).join('') +
      '</nav>' +
      '<button class="hdr-auth" id="hdrAuth" aria-label="로그인">로그인</button>' +
      '<a class="hdr-icon' + (PRIVATE_LINK.key === activeKey ? ' active' : '') + '"' +
        ' id="hdrTime" href="' + PRIVATE_LINK.href + '" hidden' +
        ' title="' + PRIVATE_LINK.label + '" aria-label="' + PRIVATE_LINK.label + '">' +
        PRIVATE_LINK.icon + '</a>' +
      '<button class="menu-toggle pixel" id="menuToggle" aria-label="메뉴 열기">☰</button>' +
    '</div>';
  document.body.prepend(header);
  buildAuthModal();

  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML =
    '<a class="foot-link" href="https://www.youtube.com/@sooayeonatv" target="_blank" rel="noopener"' +
      ' aria-label="수아연아TV 유튜브 채널" title="수아연아TV 유튜브 채널">' +
      '<canvas id="footYoutube" width="42" height="33"></canvas>' +
    '</a>' +
    '<div class="pixel" style="margin-top:8px;">수아연아TV</div>' +
    '<div>© 2026 suayona.com</div>';
  document.body.appendChild(footer);

  // 홈·소개처럼 로그인 확인을 하지 않는 페이지에서도 비공개 메뉴는 나와야 한다.
  // getSession 은 저장된 토큰만 읽으므로 서버를 부르지 않는다.
  sb.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    isLoggedIn = true;
    syncPrivateMenu();
    syncAuthButton();
  }).catch(() => {});

  // 로고 하트 · 푸터 유튜브 아이콘 도트 찍기
  if (typeof SPRITES !== 'undefined') {
    const lc = $('#logoCanvas').getContext('2d');
    lc.imageSmoothingEnabled = false;
    drawSprite(lc, SPRITES.heart, 1, 3, 5);
    const yc = $('#footYoutube').getContext('2d');
    yc.imageSmoothingEnabled = false;
    drawSprite(yc, SPRITES.youtube, 0, 0, 3);
  }

  // 모바일 메뉴
  const nav = $('#nav');
  const toggle = $('#menuToggle');
  toggle.addEventListener('click', e => { e.stopPropagation(); nav.classList.toggle('open'); });
  nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });

  // 메뉴 밖 아무 곳이나 누르면 닫히도록 (ESC 로도 닫힘)
  document.addEventListener('click', e => {
    if (!nav.classList.contains('open')) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    nav.classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') nav.classList.remove('open');
  });

  // 아래로 스크롤하면 헤더 숨김.
  // 헤더 아래에 따라붙는 것(이벤트 페이지의 날짜 탭 등)이 있어서, 숨은 사실을 body 에도 남긴다.
  // 안 그러면 그것들이 헤더가 있던 자리에 그대로 떠 있어 그 틈으로 내용이 지나간다.
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const hide = y > 200 && y > last;
    header.classList.toggle('hidden', hide);
    document.body.classList.toggle('header-hidden', hide);
    last = y;
  }, {passive:true});
}

// ---------- 스크롤 등장 ----------
function initReveal(){
  const items = $$('.reveal');
  if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const delay = (Array.from(items).indexOf(en.target) % 3) * 90;
      setTimeout(() => en.target.classList.add('in'), delay);
      io.unobserve(en.target);
    });
  }, { threshold:0.12, rootMargin:'0px 0px -60px 0px' });
  items.forEach(i => io.observe(i));
}
// 나중에 만들어진 요소도 등장 효과를 받도록
function revealNow(el){ requestAnimationFrame(() => el.classList.add('in')); }

// ---------- 로그인 ----------
// 로그인한 사람이 부모인지 아이인지. 예전에는 "로그인했으면 관리자"였는데,
// 아이 계정이 생기면서 둘을 갈라야 했다. isAdmin 은 이제 "부모"라는 뜻이다.
let isAdmin = false;     // 부모 (작품·모든 글을 다룰 수 있음)
let isChild = false;     // 아이 (자기 글만, 그것도 확인 전까지만)
let isLoggedIn = false;  // 프로필이 없어도 계정으로 들어와 있으면 참
let me = null;           // { user_id, role, display, author_key }

async function refreshAuth(){
  const { data: { session } } = await sb.auth.getSession();
  me = null; isAdmin = false; isChild = false;
  isLoggedIn = !!session;
  if (!session) { syncPrivateMenu(); syncAuthButton(); return null; }

  const { data } = await sb.from('profiles')
    .select('user_id, role, display, author_key')
    .eq('user_id', session.user.id).maybeSingle();
  me = data || null;
  // 프로필이 없으면 아무 권한도 주지 않는다.
  // 예전엔 "프로필 없으면 부모"로 뒀는데, 그러면 새로 만든 계정이 전부 부모가 된다.
  // 서버 정책은 이미 막고 있어서 실제로 쓰이지는 않지만, 화면에 관리 버튼이 뜬 뒤
  // 눌러야 거절당하는 건 고장난 것과 같다.
  isAdmin = !!me && me.role === 'parent';
  isChild = !!me && me.role === 'child';
  syncPrivateMenu();
  syncAuthButton();
  return session;
}

// 로그인/로그아웃에 맞춰 시간표 단추를 보이고 감춘다.
// 헤더는 로그인 확인보다 먼저 그려지므로, 여기서 뒤늦게 켜는 편이 깜빡임이 없다.
function syncPrivateMenu(){
  const btn = document.getElementById('hdrTime');
  if (!btn) return;
  btn.hidden = !isLoggedIn;
  btn.classList.toggle('active', PRIVATE_LINK.key === ACTIVE_KEY);
}

// ---------- 헤더의 로그인 단추와 창 ----------
// 로그인 상자는 페이지마다 따로 있었는데, 첫 페이지처럼 상자가 없는 곳에서는
// 들어갈 방법이 아예 없었다. 헤더에 두면 어느 페이지에서든 같은 자리다.
function buildAuthModal(){
  if (document.getElementById('authModal')) return;
  const m = document.createElement('div');
  m.className = 'auth-modal';
  m.id = 'authModal';
  m.hidden = true;
  m.innerHTML =
    '<div class="auth-in dot-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
      '<button class="auth-x" id="authClose" aria-label="닫기">✕</button>' +
      '<h4 id="authTitle">로그인</h4>' +
      '<div id="authBody"></div>' +
    '</div>';
  document.body.appendChild(m);

  document.getElementById('hdrAuth').addEventListener('click', openAuthModal);
  document.getElementById('authClose').addEventListener('click', closeAuthModal);
  m.addEventListener('click', e => { if (e.target === m) closeAuthModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !m.hidden) closeAuthModal();
  });
}

function syncAuthButton(){
  const b = document.getElementById('hdrAuth');
  if (!b) return;
  b.textContent = isLoggedIn ? (me ? me.display : '내 계정') : '로그인';
  b.classList.toggle('in', isLoggedIn);
  b.setAttribute('aria-label', isLoggedIn ? '내 계정' : '로그인');
}

async function openAuthModal(){
  // 첫 페이지처럼 로그인 확인을 미룬 곳에서는 여기서 한 번만 확인한다
  if (isLoggedIn && !me) { await refreshAuth(); }

  const body = document.getElementById('authBody');
  body.innerHTML = '';
  if (isLoggedIn) {
    document.getElementById('authTitle').textContent = '내 계정';
    const name = me ? me.display + (isChild ? ' (아이)' : '') : '이 계정';
    body.innerHTML =
      '<p class="auth-who">' + escapeHTML(name) + '(으)로 들어와 있어요.</p>' +
      '<button class="dot-btn primary" id="authOut" style="width:100%;">로그아웃</button>';
    document.getElementById('authOut').addEventListener('click', async () => {
      await sb.auth.signOut();
      location.reload();      // 페이지마다 로그인 여부에 따라 보이는 게 달라서 새로 그린다
    });
  } else {
    document.getElementById('authTitle').textContent = '로그인';
    mountLoginBox(body, () => location.reload());
  }

  document.getElementById('authModal').hidden = false;
  const first = body.querySelector('input');
  if (first) setTimeout(() => first.focus(), 40);
}

function closeAuthModal(){
  const m = document.getElementById('authModal');
  if (m) m.hidden = true;
}

// 관리자 로그인 상자를 만들어 지정한 위치에 넣음.
// onChange(isAdmin) 는 로그인/로그아웃 직후에 호출됨.
function mountLoginBox(container, onChange){
  const box = document.createElement('div');
  box.className = 'login-box dot-card';
  box.innerHTML =
    '<div class="inner">' +
      '<label class="field">이메일</label><input type="email" class="lgEmail" autocomplete="username">' +
      '<label class="field">비밀번호</label><input type="password" class="lgPw" autocomplete="current-password">' +
      '<button class="dot-btn primary lgBtn" style="width:100%; margin-top:16px;">로그인</button>' +
      '<div class="msg lgMsg"></div>' +
    '</div>';
  container.appendChild(box);

  // 비밀번호 칸에서 엔터를 치면 그대로 들어가지도록 (모바일 자판의 '완료' 도 이걸 탄다)
  box.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); box.querySelector('.lgBtn').click(); }
    }));

  // 이 자리를 매번 다시 찾지 않는다. className 을 통째로 갈아끼우면서 lgMsg 라는
  // 표식까지 지워 버렸던 탓에, 한 번 실패하면 다음 누름부터 단추가 먹통이 됐다.
  const msg = box.querySelector('.lgMsg');

  box.querySelector('.lgBtn').addEventListener('click', async () => {
    msg.className = 'msg lgMsg'; msg.textContent = '로그인 중...';
    const { error } = await sb.auth.signInWithPassword({
      email: box.querySelector('.lgEmail').value.trim(),
      password: box.querySelector('.lgPw').value,
    });
    if (error) { msg.className = 'msg lgMsg err'; msg.textContent = '로그인 실패: ' + error.message; return; }
    msg.textContent = '';
    await refreshAuth();
    onChange(isAdmin);
  });
  return box;
}

// ---------- 이미지 압축 + 업로드 ----------
async function compressImage(file, maxBytes){
  if (!file.type || !file.type.startsWith('image/')) return file;
  if (file.size <= maxBytes) return file;

  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej; im.src = url;
    });
  } catch (e) { URL.revokeObjectURL(url); return file; }

  let w = img.naturalWidth, h = img.naturalHeight;
  const maxDim = 2400;
  if (Math.max(w, h) > maxDim) {
    const sc = maxDim / Math.max(w, h);
    w = Math.round(w * sc); h = Math.round(h * sc);
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const draw = () => { canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h); };

  let q = 0.9;
  draw();
  let blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  while (blob && blob.size > maxBytes && q > 0.4) {
    q -= 0.1;
    blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  }
  while (blob && blob.size > maxBytes && Math.min(w, h) > 500) {
    w = Math.round(w * 0.85); h = Math.round(h * 0.85);
    draw();
    blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  }
  URL.revokeObjectURL(url);
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type:'image/jpeg' });
}

// ---------- 작은 사본(썸네일) ----------
// 격자는 손톱만 한 칸인데 원본을 통째로 받고 있었다. 1855px 짜리 사진을 264px 칸에
// 그리느라 사진 한 장에 1~2MB 가 나갔다. 올릴 때 긴 변 400px 사본을 같이 만들어 두고,
// 격자는 그것만 쓴다. 원본은 눌러서 크게 볼 때만 받는다.
const THUMB_DIM = 400;
const THUMB_Q = 0.72;

function loadImage(src){
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('사진을 읽지 못했어요'));
    im.src = src;
  });
}

// 남의 출처에 있는 사진을 canvas 로 다루는 방법.
//
// <img crossOrigin="anonymous"> 로 바로 읽는 길이 짧지만, 그 사진이 이미 평범한
// <img> 로 화면에 떠서 브라우저 캐시에 들어가 있으면 브라우저(특히 사파리)가
// 캐시에 든 CORS 표시 없는 응답을 그대로 돌려준다. 그러면 캔버스가 오염되고
// toBlob 이 통째로 막힌다 — 한 장이 아니라 전부 실패한다.
//
// 그래서 fetch 로 바이트를 먼저 받아 온다. 내 손에 든 blob 에서 만든 주소는
// 같은 출처라, 캐시가 어떻든 오염될 일이 없다.
async function loadImageFromUrl(url){
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('내려받기 실패 (HTTP ' + res.status + ')');
  const src = URL.createObjectURL(await res.blob());
  try {
    const img = await loadImage(src);
    return { img, done: () => URL.revokeObjectURL(src) };
  } catch (e) {
    URL.revokeObjectURL(src);
    throw e;
  }
}

// 원본이 이미 400px 보다 작으면 사본을 만들지 않는다 (null 을 돌려줌)
async function makeThumbBlob(img){
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (!long || long <= THUMB_DIM) return null;
  const sc = THUMB_DIM / long;
  const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', THUMB_Q));
}

// 원본 옆에 나란히 올린다: ".../abc.jpg" -> ".../abc.thumb.jpg"
async function uploadThumbAt(bucket, path, blob){
  const tp = path.replace(/\.\w+$/, '') + '.thumb.jpg';

  // 잘 되고 있는 '작품 올리기'와 똑같은 모양으로 부른다.
  // 원래는 upsert:true 에 맨 blob 을 넘겼는데, 그 둘 다 여기서만 쓰던 방식이었다.
  // upsert 는 파일이 이미 있는지 보려고 덮어쓰기 경로를 타는데, 이 저장소에는
  // 읽기 정책이 따로 없어서 그 길에서 걸린다.
  const file = new File([blob], tp.split('/').pop(), { type: 'image/jpeg' });
  const { error } = await sb.storage.from(bucket).upload(tp, file);

  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error('사본 올리기 실패: ' + error.message);
  }
  // 이미 있다면 앞선 시도에서 파일만 올라가고 주소를 못 적은 것이다. 실패가 아니다.
  return sb.storage.from(bucket).getPublicUrl(tp).data.publicUrl;
}

// 서버가 돌려주는 영어 원문은 무슨 말인지 알 수 없다. 실제로 마주칠 만한 것만 옮긴다.
function readableError(e){
  const m = (e && e.message) || String(e);
  if (/row-level security|permission|not authorized/i.test(m))
    return '권한이 없어요 (로그인이 풀렸는지 확인해 주세요) — ' + m;
  if (/Failed to fetch|NetworkError|HTTP 4|HTTP 5/i.test(m))
    return '사진을 내려받지 못했어요 (' + m + ')';
  if (/tainted|SecurityError/i.test(m))
    return '브라우저가 사진 읽기를 막았어요. 새로고침한 뒤 다시 눌러주세요.';
  return m;
}

// 공개 주소에서 버킷 안 경로만 되돌림
//   ".../object/public/<버킷>/<경로>" -> "<경로>"
function pathFromPublicUrl(bucket, url){
  const tail = String(url).split('/object/public/' + bucket + '/')[1];
  return tail ? decodeURIComponent(tail.split('?')[0]) : null;
}

// ---------------------------------------------------------------------------
// 지운 뒤 저장소 치우기
//
// 지금까지는 줄만 지우고 사진 파일은 저장소에 그대로 남겨 왔다. 화면에서는 사라지니
// 눈치채기 어려운데, 무료 용량이 1GB뿐이라 지울수록 자리만 잃는 셈이었다.
// (점검해 보니 아무도 안 쓰는 파일이 39개 79MB 쌓여 있었다.)
//
// 반드시 줄을 먼저 지우고 파일을 나중에 치운다. 순서를 바꾸면 줄 지우기가 실패했을 때
// 사진 없는 줄이 남아 화면이 깨진다. 이쪽이 실패하면 파일만 남을 뿐 화면은 멀쩡하다.
// ---------------------------------------------------------------------------
async function removeStored(bucket, urls){
  const paths = [];
  for (const u of (Array.isArray(urls) ? urls : [urls])) {
    if (!u) continue;
    const path = pathFromPublicUrl(bucket, u);      // 다른 버킷 주소면 null 이라 걸러진다
    if (path && !paths.includes(path)) paths.push(path);
  }
  if (!paths.length) return 0;
  const { error } = await sb.storage.from(bucket).remove(paths);
  if (error) { console.warn('저장소 정리 실패:', error.message, paths); return 0; }
  return paths.length;
}

// ---------------------------------------------------------------------------
// 아무도 안 쓰는 파일 찾기
//
// 예전 삭제들이 줄만 지우고 파일을 남겨 둔 탓에 쌓인 것들을 치우기 위한 도구.
// 파일을 지우는 일이라 되돌릴 수 없다. 그래서 확실하지 않으면 무조건 남기는 쪽으로 만들었다:
//   · 표를 하나라도 다 못 읽으면 아예 그만둔다 (반만 읽고 지우면 멀쩡한 사진이 날아간다)
//   · 올린 지 한 시간이 안 된 파일은 건드리지 않는다 (올리는 중일 수 있다)
// ---------------------------------------------------------------------------
const CLEANUP_BUCKETS = ['event-images', 'gallery-uploads'];
const CLEANUP_MIN_AGE_MS = 60 * 60 * 1000;

// 버킷 안의 파일을 모두 훑는다. 폴더가 두 겹까지 있어서(suayona/works) 재귀로 내려간다.
async function listAllFiles(bucket, prefix, out){
  out = out || [];
  const { data, error } = await sb.storage.from(bucket)
    .list(prefix || '', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(bucket + ' 파일 목록을 읽지 못했어요: ' + error.message);
  for (const f of (data || [])) {
    const full = prefix ? prefix + '/' + f.name : f.name;
    if (f.id) out.push({ path: full, size: (f.metadata && f.metadata.size) || 0, at: f.created_at });
    else await listAllFiles(bucket, full, out);      // 폴더면 한 겹 더 내려간다
  }
  return out;
}

// 표를 통째로 읽되, 다 읽었는지 반드시 확인한다.
// 서버가 줄 수를 제한해 반만 돌려주면 나머지가 "안 쓰는 파일"로 보여 진짜 사진이 지워진다.
async function selectAllRows(table, cols){
  const { data, error, count } = await sb.from(table).select(cols, { count: 'exact' });
  if (error) throw new Error(table + ' 을 읽지 못했어요: ' + error.message);
  const rows = data || [];
  if (count != null && rows.length < count)
    throw new Error(table + ' 을 다 읽지 못했어요 (' + rows.length + '/' + count + '). 안전을 위해 그만둡니다.');
  return rows;
}

// 지금 쓰이고 있는 파일 경로를 버킷별로 모은다
async function collectUsedPaths(){
  const used = {};
  CLEANUP_BUCKETS.forEach(b => used[b] = new Set());
  const add = url => {
    if (!url) return;
    for (const b of CLEANUP_BUCKETS) {
      const path = pathFromPublicUrl(b, url);
      if (path) { used[b].add(path); return; }
    }
  };

  const [works, posts, events, gallery] = await Promise.all([
    selectAllRows('works',         'media_url, thumb_url, audio_url'),
    selectAllRows('posts',         'image_url, thumb_url, extra_images'),
    selectAllRows('events',        'image_url, thumb_url, extra_images'),
    selectAllRows('gallery_media', 'media_url, thumb_url'),
  ]);
  works.forEach(w => { add(w.media_url); add(w.thumb_url); add(w.audio_url); });
  posts.forEach(x => { add(x.image_url); add(x.thumb_url); urlsIn(x.extra_images).forEach(add); });
  events.forEach(x => { add(x.image_url); add(x.thumb_url); urlsIn(x.extra_images).forEach(add); });
  gallery.forEach(g => { add(g.media_url); add(g.thumb_url); });
  return used;
}

// 안 쓰는 파일 목록. 지우지는 않는다 — 먼저 보여주고 확인을 받기 위해.
async function findUnusedFiles(){
  // 부모가 아니면 표를 반만 읽게 된다(비공개 글은 안 보임). 반만 읽고 지우면 멀쩡한 사진이 날아간다.
  if (!isAdmin) throw new Error('부모로 로그인했을 때만 쓸 수 있어요.');
  const used = await collectUsedPaths();
  const cutoff = Date.now() - CLEANUP_MIN_AGE_MS;
  const found = [];
  let bytes = 0, tooNew = 0;
  for (const bucket of CLEANUP_BUCKETS) {
    const all = await listAllFiles(bucket);
    // 목록 권한이 없으면 오류 없이 빈 배열이 온다. 그걸 "파일이 없다"로 읽으면 안 된다.
    if (!all.length) throw new Error(bucket + ' 의 파일 목록이 비어 있어요. 권한을 확인해 주세요.');
    for (const f of all) {
      if (used[bucket].has(f.path)) continue;
      if (f.at && new Date(f.at).getTime() > cutoff) { tooNew++; continue; }
      found.push({ bucket, path: f.path, size: f.size });
      bytes += f.size;
    }
  }
  return { found, bytes, tooNew };
}

async function removeUnusedFiles(found, onStep){
  let gone = 0;
  for (const bucket of CLEANUP_BUCKETS) {
    const paths = found.filter(f => f.bucket === bucket).map(f => f.path);
    for (let i = 0; i < paths.length; i += 50) {          // 한 번에 너무 많이 보내지 않는다
      const chunk = paths.slice(i, i + 50);
      const { error } = await sb.storage.from(bucket).remove(chunk);
      if (error) throw new Error('치우지 못했어요: ' + error.message);
      gone += chunk.length;
      if (onStep) onStep(gone, found.length);
    }
  }
  return gone;
}

function mbLabel(bytes){ return (bytes / 1048576).toFixed(1) + ' MB'; }

// {url, thumb} 를 담은 목록(extra_images 등)에서 주소만 한 줄로 뽑음
function urlsIn(list){
  return (Array.isArray(list) ? list : [])
    .flatMap(x => x ? [x.url, x.thumb] : [])
    .filter(Boolean);
}

// 파일 하나에서 사본을 만들어 올림. 실패해도 던지지 않는다 —
// 사본이 없으면 화면이 원본으로 물러날 뿐이라, 업로드 자체를 막을 이유가 없다.
async function makeAndUploadThumb(bucket, path, file){
  const src = URL.createObjectURL(file);
  try {
    const blob = await makeThumbBlob(await loadImage(src));
    if (!blob) return null;
    return await uploadThumbAt(bucket, path, blob);
  } catch (e) {
    console.error('썸네일 만들기 실패:', e);
    return null;                      // 사본이 없으면 화면은 원본으로 물러난다
  } finally { URL.revokeObjectURL(src); }
}

// ---------------------------------------------------------------------------
// 유튜브 영상
//
// 영상은 유튜브가 들고 있고 우리는 주소만 적어 둔다 — 저장공간을 한 칸도 안 쓴다.
// 사진이 벌써 무료 한도(1GB)의 4분의 1을 먹은 걸 생각하면 이게 작지 않다.
//
// 열쇠(API 키)도 필요 없다. 미리보기 그림은 주소만으로 받고, 제목과 채널 이름은
// oEmbed 로 물어본다. 열쇠를 쓰면 그 열쇠가 페이지 소스에 그대로 실려야 해서
// 애초에 못 쓸 길이기도 하다.
// ---------------------------------------------------------------------------

// 붙여넣은 주소에서 영상 번호(11글자)만 꺼낸다.
// 일반 주소 · youtu.be 짧은 주소 · Shorts · embed 를 다 받는다.
// 유튜브가 아닌 곳은 빈 값을 돌려준다 — evil-youtube.com 같은 흉내에 안 속게
// 점 앞까지 맞춰서 본다.
function youtubeId(raw){
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;               // 번호만 붙여넣은 경우
  let u;
  try { u = new URL(s.startsWith('http') ? s : 'https://' + s); } catch (e) { return ''; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return '';
  const pick = v => (/^[\w-]{11}$/.test(v || '') ? v : '');
  if (u.hostname.endsWith('youtu.be')) return pick(u.pathname.slice(1, 12));
  const v = pick((u.searchParams.get('v') || '').slice(0, 11));
  if (v) return v;
  const m = u.pathname.match(/\/(shorts|embed|v|live)\/([\w-]{11})/);
  return m ? m[2] : '';
}

// 저장할 때는 늘 같은 모양으로 — 나중에 같은 영상인지 견주기 쉽게
function youtubeUrl(id){ return 'https://www.youtube.com/watch?v=' + id; }

// 미리보기 그림. 유튜브가 주는 것 중 골라야 한다:
//   maxresdefault  1280x720  16:9 — 높은 화질로 찍은 영상에만 있다
//   mqdefault       320x180  16:9 — 늘 있다
// hqdefault(480x360)는 늘 있지만 4:3 이라 위아래에 검은 띠가 들어 있다.
// 네모 칸에 맞춰 자르면 그 띠가 그대로 보여서 안 쓴다.
//
// 없는 그림을 물으면 유튜브는 404 를 주지 않는다. 200 과 함께 120x90 짜리
// 회색 판을 준다. 그래서 onerror 만 걸어 두면 아무 일도 안 일어나고, 그 회색 판이
// 칸에 늘어난 채로 남는다. 실제로 그렇게 됐다 — 크기를 보고 갈아 끼운다.
function youtubeThumbHTML(id, alt, cls){
  const small = 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg';
  const swap = "this.onload=null; this.onerror=null; this.src='" + small + "';";
  return '<img' + (cls ? ' class="' + cls + '"' : '') +
    ' src="https://img.youtube.com/vi/' + id + '/maxresdefault.jpg" loading="lazy"' +
    ' onload="if(this.naturalWidth<200){' + swap + '}"' +
    ' onerror="' + swap + '"' +
    ' alt="' + escapeHTML(alt || '') + '">';
}

// 재생기. 쿠키를 안 심는 주소로 띄우고, 목록에서는 안 부른다 —
// 영상마다 재생기를 미리 얹으면 페이지가 눈에 띄게 무거워진다.
function youtubeEmbedHTML(id, title, autoplay){
  return '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0' +
    (autoplay ? '&autoplay=1' : '') + '"' +
    ' title="' + escapeHTML(title || '영상') + '" loading="lazy" allowfullscreen' +
    ' allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"' +
    ' referrerpolicy="strict-origin-when-cross-origin"></iframe>';
}

// 글 안에 홀로 놓인 유튜브 주소를 찾아낸다.
// 한 줄을 통째로 차지하고 있을 때만 "이걸 보여 달라"는 뜻으로 읽는다.
// 문장 속에 섞인 주소는 그냥 둔다 — "이 주소 참고하세요" 같은 줄이
// 갑자기 커다란 영상 칸으로 부풀면 곤란하다.
function pullYoutubeLines(text){
  const ids = [], rest = [];
  String(text || '').replace(/\r\n/g, '\n').split('\n').forEach(line => {
    const one = line.trim();
    const id = (one && !/\s/.test(one)) ? youtubeId(one) : '';
    if (id) { if (!ids.includes(id)) ids.push(id); }
    else rest.push(line);
  });
  return { ids, text: rest.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

// 미리보기 그림만 놓고, 누르면 그 자리에서 재생기로 바뀐다.
// 하루에 영상이 여럿 붙는 날도 있어서, 미리 다 얹어 두면 그 날짜 탭이 눈에 띄게 무겁다.
function youtubeCardHTML(id, label){
  return '<button type="button" class="yt-card" data-yt="' + escapeHTML(id) + '" aria-label="영상 재생">' +
    youtubeThumbHTML(id, label || '영상') +
    '<span class="yt-play"></span><span class="yt-mark">▶ 영상</span>' +
    '</button>';
}

// 재생기를 다시 그림 카드로 되돌린다.
// 유튜브 재생기는 담긴 상자를 display:none 으로 숨겨도 소리가 계속 나온다 —
// 화면에서 사라지게만 하면 배경에서 노래만 남는다. 실제로 그렇게 됐다.
// 그래서 가리는 쪽이 아니라 떼어 내는 쪽으로 멈춘다. 카드로 되돌려 두면
// 다시 돌아왔을 때 누르는 것으로 이어 볼 수 있다.
function stopYoutubeIn(root){
  if (!root) return;
  root.querySelectorAll('.yt-frame').forEach(frame => {
    const f = frame.querySelector('iframe');
    const m = f && String(f.src).match(/\/embed\/([\w-]{11})/);
    if (m) frame.outerHTML = youtubeCardHTML(m[1]);
    else frame.remove();
  });
}

// 영상 칸은 어느 페이지에서 나오든 같은 방식으로 열린다.
// 페이지마다 따로 걸면 새 자리를 만들 때 빼먹기 쉬워서 문서에 한 번만 건다.
document.addEventListener('click', e => {
  const card = e.target.closest && e.target.closest('.yt-card');
  if (!card || !card.dataset.yt) return;
  e.preventDefault();
  const box = document.createElement('div');
  box.className = 'yt-frame';
  box.innerHTML = youtubeEmbedHTML(card.dataset.yt, '영상', true);
  card.replaceWith(box);
});

// 제목과 채널 이름을 물어본다. 없는 영상·비공개 영상이면 400 을 주므로
// 저장하기 전에 걸러낼 수 있다. 그물이 끊겨 못 물어본 것과 구분해서 돌려준다.
async function youtubeInfo(id){
  try {
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent(youtubeUrl(id)));
    if (res.status === 400 || res.status === 404) return { ok:false, gone:true };
    if (!res.ok) return { ok:false, gone:false };
    const j = await res.json();
    return { ok:true, title: j.title || '', channel: j.author_name || '' };
  } catch (e) { return { ok:false, gone:false }; }
}

// ---------------------------------------------------------------------------
// 이벤트 갤러리에 파일 넣기
//
// 사진을 받는 자리가 두 군데다 — 이벤트 안의 갤러리, 그리고 이벤트 목록의
// "사진 골라서 바로 만들기". 넣는 절차(압축 → 저장 → 작은 사본 → 줄 추가)는
// 똑같아서 한 벌만 둔다. 버킷 이름이나 압축 기준이 바뀔 때 한 군데만 고치면 된다.
//
// EXIF 는 부르는 쪽이 이미 읽어 둔 것을 넘겨받는다 — 한쪽은 중복을 거르려고,
// 한쪽은 날짜 범위를 정하려고 어차피 먼저 읽기 때문에 여기서 또 읽을 이유가 없다.
// compressImageToLimit 은 event/compress.js 에 있다(갤러리를 쓰는 두 페이지가 함께 부름).
// ---------------------------------------------------------------------------
function validateGalleryFile(file){
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) return { ok:false, reason: file.name + ' — 사진/영상 파일만 올릴 수 있어요.' };
  // 사진은 크기 제한 없이 받고 5MB로 자동 압축함. 영상만 100MB 상한을 그대로 둠.
  if (isVideo && file.size > VIDEO_LIMIT) {
    return { ok:false, reason: file.name + ' — 영상 파일은 ' + (VIDEO_LIMIT/1024/1024) + 'MB를 넘을 수 없어요.' };
  }
  return { ok:true, isVideo };
}

// meta: { isVideo, taken_at, location_name } — 부르는 쪽이 읽어 둔 EXIF
async function putGalleryFile(eventSlug, file, meta){
  const isVideo = !!(meta && meta.isVideo);
  const uploadFile = isVideo ? file : await compressImageToLimit(file, IMAGE_LIMIT);
  const path = eventSlug + '/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '-' +
    uploadFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const { error: upErr } = await sb.storage.from(GALLERY_BUCKET).upload(path, uploadFile);
  if (upErr) throw upErr;
  const { data: pub } = sb.storage.from(GALLERY_BUCKET).getPublicUrl(path);
  // 격자에 쓸 작은 사본. 없어도 화면은 원본으로 물러나므로 실패해도 넘어간다.
  const thumb_url = isVideo ? null : await makeAndUploadThumb(GALLERY_BUCKET, path, uploadFile);
  const { error: insErr } = await sb.from('gallery_media').insert({
    event_id: eventSlug, media_url: pub.publicUrl, media_type: isVideo ? 'video' : 'image',
    taken_at: (meta && meta.taken_at) || null,
    location_name: (meta && meta.location_name) || null,
    thumb_url,
  });
  if (insErr) throw insErr;
}

// 이미 올라가 있는 사진들의 사본을 뒤늦게 만들어 준다.
// rows: [{id, url}] · save(id, thumbUrl) 로 각 줄을 갱신
//
// 실패를 세기만 하면 무엇이 잘못됐는지 알 길이 없다. 첫 번째 이유를 들고 나온다.
async function backfillThumbs(bucket, rows, save, onStep){
  let made = 0, skipped = 0, failed = 0, why = '';
  for (let i = 0; i < rows.length; i++) {
    if (onStep) onStep(i + 1, rows.length, made, failed);
    let handle = null;
    try {
      const path = pathFromPublicUrl(bucket, rows[i].url);
      if (!path) throw new Error('주소에서 파일 경로를 못 찾았어요');

      handle = await loadImageFromUrl(rows[i].url);
      const blob = await makeThumbBlob(handle.img);
      if (!blob) { skipped++; continue; }        // 원본이 이미 작음

      const tu = await uploadThumbAt(bucket, path, blob);
      const { error } = await save(rows[i].id, tu) || {};
      if (error) throw new Error('자리 표시 저장 실패: ' + error.message);
      made++;
    } catch (e) {
      failed++;
      if (!why) why = readableError(e);
      console.error('사본 만들기 실패', rows[i].url, e);
    } finally {
      if (handle) handle.done();
    }
  }
  return { made, skipped, failed, why };
}

// ---------- 목소리 녹음 ----------
// 브라우저마다 받아 주는 소리 형식이 다르다. 사파리는 webm 을 못 만들고 mp4 로 준다.
// 그래서 물어보고 되는 것을 쓴다. 확장자도 거기 맞춰야 나중에 재생이 된다.
const AUDIO_TYPES = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm',             ext: 'webm' },
  { mime: 'audio/mp4',              ext: 'm4a'  },
  { mime: 'audio/mpeg',             ext: 'mp3'  },
];
const VOICE_MAX_SECS = 60;

function pickAudioType(){
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of AUDIO_TYPES) {
    try { if (MediaRecorder.isTypeSupported(t.mime)) return t; } catch (e) {}
  }
  return { mime: '', ext: 'webm' };     // 브라우저 기본값에 맡김
}

function canRecordVoice(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
         typeof MediaRecorder !== 'undefined';
}

// 녹음기 하나를 만들어 돌려준다. stop() 을 부르면 blob 을 준다.
// 마이크는 반드시 꺼야 한다 — 안 끄면 브라우저 탭에 녹음 표시가 계속 남는다.
async function startVoiceRecorder(onTick){
  const type = pickAudioType();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream, type.mime ? { mimeType: type.mime } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

  let secs = 0;
  const timer = setInterval(() => {
    secs++;
    if (onTick) onTick(secs);
    if (secs >= VOICE_MAX_SECS) stop();      // 너무 길어지지 않게 저절로 멈춤
  }, 1000);

  const done = new Promise(res => { rec.onstop = () => res(); });
  function stop(){
    if (rec.state !== 'inactive') rec.stop();
    clearInterval(timer);
    stream.getTracks().forEach(t => t.stop());   // 마이크 끄기
  }

  rec.start();
  return {
    ext: type.ext,
    stop: async () => {
      stop();
      await done;
      return { blob: new Blob(chunks, { type: chunks[0] ? chunks[0].type : type.mime }), secs };
    },
    cancel: () => { stop(); },
  };
}

async function uploadVoice(blob, ext){
  const path = 'suayona/voice/' + Date.now() + '-' +
    Math.random().toString(36).slice(2, 8) + '.' + ext;
  const file = new File([blob], path.split('/').pop(), { type: blob.type || 'audio/webm' });
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) throw new Error('목소리 올리기 실패: ' + error.message);
  return sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

function secsLabel(n){
  const s = Math.max(0, Math.round(n || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// folder 예: 'works' / 'posts'
// imageLimit 을 주면 그 용량 기준으로 압축함 (안 주면 기본 5MB)
async function uploadMedia(file, folder, imageLimit){
  const isVideo = file.type.startsWith('video/');
  if (isVideo && file.size > VIDEO_LIMIT) {
    throw new Error('영상은 ' + (VIDEO_LIMIT/1024/1024) + 'MB를 넘을 수 없어요.');
  }
  const upFile = isVideo ? file : await compressImage(file, imageLimit || IMAGE_LIMIT);
  const safe = upFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = 'suayona/' + folder + '/' + Date.now() + '-' +
    Math.random().toString(36).slice(2,8) + '-' + safe;
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, upFile);
  if (error) throw error;
  const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const thumbUrl = isVideo ? null : await makeAndUploadThumb(MEDIA_BUCKET, path, upFile);
  return { url: data.publicUrl, thumbUrl, type: isVideo ? 'video' : 'image' };
}

// ---------- 라이트박스 ----------
// items: [{ media_url, media_type, caption }]
function createLightbox(){
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML =
    '<button class="dot-btn small lightbox-close" aria-label="닫기">✕ 닫기</button>' +
    '<button class="dot-btn small lightbox-play" aria-label="슬라이드쇼">▶ 슬라이드쇼</button>' +
    '<button class="lightbox-nav prev" aria-label="이전">‹</button>' +
    '<button class="lightbox-nav next" aria-label="다음">›</button>' +
    '<img id="lbImg" alt=""><video id="lbVid" controls playsinline style="display:none;"></video>' +
    '<div class="lightbox-cap" id="lbCap"></div>';
  document.body.appendChild(lb);

  let items = [], idx = 0;
  const img = lb.querySelector('#lbImg'), vid = lb.querySelector('#lbVid');
  const cap = lb.querySelector('#lbCap');
  const prev = lb.querySelector('.prev'), next = lb.querySelector('.next');
  const playBtn = lb.querySelector('.lightbox-play');

  // ----- 슬라이드쇼 -----
  // 소파에서 다 같이 볼 때 사진 백 장을 손가락으로 넘기지 않아도 되게.
  // 사진은 4초씩, 영상은 끝까지 틀고 나서 넘어간다. 한 바퀴 돌면 처음부터 다시 —
  // 멈추는 건 보는 사람 몫이다(✕ 나 ⏸).
  const SHOW_MS = 4000;
  let playing = false, showTimer = null;
  function queueNext(){
    clearTimeout(showTimer);
    if (!playing) return;
    const it = items[idx];
    if (it && it.media_type === 'video') {
      vid.onended = () => { vid.onended = null; if (playing) go(1); };
      vid.play().catch(() => {          // 자동재생이 막히면 영상도 사진처럼 시간으로 넘긴다
        showTimer = setTimeout(() => { if (playing) go(1); }, SHOW_MS);
      });
    } else {
      showTimer = setTimeout(() => { if (playing) go(1); }, SHOW_MS);
    }
  }
  function stopShow(){
    playing = false;
    clearTimeout(showTimer);
    vid.onended = null;
    playBtn.textContent = '▶ 슬라이드쇼';
  }
  playBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (playing) { stopShow(); return; }
    playing = true;
    playBtn.textContent = '⏸ 멈추기';
    queueNext();
  });

  function render(){
    const it = items[idx];
    if (!it) return;
    if (it.media_type === 'video') {
      img.style.display = 'none';
      vid.style.display = 'block'; vid.src = it.media_url;
    } else {
      vid.pause(); vid.style.display = 'none';
      img.style.display = 'block'; img.src = it.media_url;
    }
    const pos = items.length > 1 ? '  (' + (idx+1) + ' / ' + items.length + ')' : '';
    cap.textContent = (it.caption || '') + pos;
    const multi = items.length > 1;
    prev.hidden = !multi; next.hidden = !multi;
    playBtn.hidden = !multi;              // 한 장짜리에 슬라이드쇼는 우스우니까
    lb.scrollTop = 0;   // 사진을 넘길 때마다 맨 위부터 보이게
    queueNext();                          // 슬라이드쇼 중이면 다음 장을 예약
  }
  // 사진을 크게 띄우면 뒤로가기 자리를 하나 만들어 둔다. 손전화에서 창을 닫는
  // 몸짓이 곧 뒤로가기라, 그냥 두면 사진 한 장 닫으려다 페이지를 떠나게 된다.
  let pushed = false;

  function open(list, i){
    items = list; idx = i;
    if (!pushed) { history.pushState({ lb:true }, ''); pushed = true; }
    lb.classList.add('open');
    document.body.classList.add('lb-open');   // 헤더를 잠시 숨김
    document.body.style.overflow = 'hidden';
    render();
  }
  // 화면만 정리한다. 뒤로가기 자리는 부르는 쪽이 맡는다.
  function closeView(){
    stopShow();
    lb.classList.remove('open');
    document.body.classList.remove('lb-open');
    document.body.style.overflow = '';
    vid.pause();
  }
  // ✕ · ESC · 바깥 누르기 — 뒤로가기와 같은 길로 닫는다.
  // 그래야 열고 닫을 때마다 자리가 쌓여 뒤로를 여러 번 눌러야 하는 일이 없다.
  function close(){
    if (!lb.classList.contains('open')) return;
    if (pushed) { history.back(); return; }   // 아래 popstate 가 받아서 닫는다
    closeView();
  }
  window.addEventListener('popstate', () => {
    pushed = false;
    if (lb.classList.contains('open')) closeView();
  });
  function go(d){ idx = (idx + d + items.length) % items.length; render(); }

  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  lb.querySelector('.lightbox-close').addEventListener('click', close);
  prev.addEventListener('click', e => { e.stopPropagation(); go(-1); });
  next.addEventListener('click', e => { e.stopPropagation(); go(1); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });

  // 모바일 좌우 스와이프
  let sx = 0, sy = 0, tracking = false;
  lb.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, {passive:true});
  lb.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }, {passive:true});

  return { open, close };
}

// ---------- 날짜 표시 ----------
function formatDate(iso){
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '.' + p(d.getMonth()+1) + '.' + p(d.getDate());
}

function escapeHTML(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============================================================================
// 글 서식 — 일정표의 커스텀 탭과 일기장이 함께 쓴다.
// 저장되는 것은 글자(마크다운 비슷한 문법)이고, 도구막대는 그 문법을 커서 자리에
// 대신 찍어주는 역할만 한다. 손으로 직접 써도 똑같이 동작한다.
// ============================================================================

// 노트 탭용 서식을 HTML로 변환함. 관리자 화면의 서식 버튼이 넣어주는 문법과 짝이다.
//
//   블록      # 큰제목 / ## 중간제목 / ### 작은제목
//             > 인용문
//             - 글머리 목록      1. 번호 목록
//             ---               구분선
//             칸|칸|칸           표 (연달아 쓴 줄이 한 표, 첫 줄이 머리)
//             ![](주소)          사진
//   글자안     **굵게**  *기울임*  ~~취소선~~  ==형광펜==  [글자](주소)
//
// 빈 줄은 문단·표·목록 구간을 끊는 용도다.

// 한 줄 안의 글자 서식. escapeHTML 을 먼저 걸고 나서 태그를 만들기 때문에,
// 사용자가 <script> 를 적어도 그대로 글자로만 남는다.
function inlineFmt(s){
  let t = escapeHTML(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (m, txt, url) => '<a class="note-link" href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  t = t.replace(/==([^=]+)==/g, '<mark class="note-mark">$1</mark>');
  return t;
}

function renderNoteContent(text){
  if (!text || !text.trim()) return '';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let mode = null; // 'para' | 'table' | 'ul' | 'ol' | 'quote'
  let buf = [];

  function flush(){
    if (!buf.length) { mode = null; return; }
    if (mode === 'table') {
      const rows = buf
        .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()))
        .filter(cells => !cells.every(c => /^:?-{1,}:?$/.test(c))); // 마크다운 구분선(---) 행은 무시
      if (rows.length) {
        const [header, ...body] = rows;
        const thead = '<thead><tr>' + header.map(c => '<th>' + inlineFmt(c) + '</th>').join('') + '</tr></thead>';
        const tbody = body.length
          ? '<tbody>' + body.map(r => '<tr>' + r.map(c => '<td>' + inlineFmt(c) + '</td>').join('') + '</tr>').join('') + '</tbody>'
          : '';
        parts.push('<div class="note-table-wrap"><table class="note-table">' + thead + tbody + '</table></div>');
      }
    } else if (mode === 'ul' || mode === 'ol') {
      const tag = mode === 'ul' ? 'ul' : 'ol';
      parts.push('<' + tag + ' class="note-list">' +
        buf.map(l => '<li>' + inlineFmt(l) + '</li>').join('') + '</' + tag + '>');
    } else if (mode === 'quote') {
      parts.push('<blockquote class="note-quote">' + buf.map(inlineFmt).join('<br>') + '</blockquote>');
    } else if (mode === 'para') {
      parts.push('<p class="note-para">' + buf.map(inlineFmt).join('<br>') + '</p>');
    }
    buf = []; mode = null;
  }

  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) { flush(); return; }

    if (/^-{3,}$/.test(line)) { flush(); parts.push('<hr class="note-hr">'); return; }
    if (line.startsWith('### ')) { flush(); parts.push('<h5 class="note-minorheading">' + inlineFmt(line.slice(4)) + '</h5>'); return; }
    if (line.startsWith('## '))  { flush(); parts.push('<h4 class="note-subheading">' + inlineFmt(line.slice(3)) + '</h4>'); return; }
    if (line.startsWith('# '))   { flush(); parts.push('<h3 class="note-heading">' + inlineFmt(line.slice(2)) + '</h3>'); return; }

    // 유튜브 주소가 한 줄을 통째로 차지하고 있으면 영상 칸으로 바꾼다.
    // 바로 아래 사진 규칙과 같은 자리, 같은 방식이다.
    if (!/\s/.test(line)) {
      const yt = youtubeId(line);
      if (yt) { flush(); parts.push('<div class="note-video">' + youtubeCardHTML(yt) + '</div>'); return; }
    }

    const img = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (img) {
      flush();
      parts.push('<div class="note-img-wrap"><img class="note-img" src="' + escapeHTML(img[2]) +
        '" alt="' + escapeHTML(img[1]) + '" loading="lazy"></div>');
      return;
    }

    let lineMode, body = line;
    if (/^>\s?/.test(line))            { lineMode = 'quote'; body = line.replace(/^>\s?/, ''); }
    else if (/^[-*]\s+/.test(line))    { lineMode = 'ul';    body = line.replace(/^[-*]\s+/, ''); }
    else if (/^\d+[.)]\s+/.test(line)) { lineMode = 'ol';    body = line.replace(/^\d+[.)]\s+/, ''); }
    else if (line.includes('|'))       { lineMode = 'table'; }
    else                               { lineMode = 'para'; }

    if (lineMode !== mode) flush();
    mode = lineMode;
    buf.push(body);
  });
  flush();

  return parts.join('');
}

// ============================================================================
// 글쓰기 도구막대 — 네이버 블로그 편집기처럼 버튼으로 서식을 넣는다.
// 저장되는 것은 여전히 글자(마크다운 비슷한 문법)이고, 버튼은 그 문법을
// 커서 자리에 대신 찍어주는 역할만 한다. 그래서 손으로 직접 써도 그대로 동작한다.
// 아래 문법은 compress.js 의 renderNoteContent 와 짝을 이룬다.
// ============================================================================

// 커서 위치에 넣기 / 선택한 글자를 감싸기
function fmtWrap(ta, before, after, placeholder){
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || placeholder || '';
  ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
  ta.focus();
  ta.selectionStart = s + before.length;
  ta.selectionEnd = s + before.length + sel.length;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}

// 선택한 줄들의 앞에 표시를 붙이거나 뗀다 (제목·목록·인용문용)
function fmtLinePrefix(ta, prefix, numbered){
  const v = ta.value;
  const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let e = v.indexOf('\n', ta.selectionEnd);
  if (e === -1) e = v.length;
  const lines = v.slice(s, e).split('\n');
  // 이미 같은 표시가 붙어 있으면 떼어낸다 (토글)
  const strip = l => l.replace(/^(#{1,3}\s|>\s?|[-*]\s|\d+[.)]\s)/, '');
  const already = lines.every(l => !l.trim() || (numbered ? /^\d+[.)]\s/.test(l) : l.startsWith(prefix)));
  const out = lines.map((l, i) => {
    const bare = strip(l);
    if (!bare.trim()) return l;
    return already ? bare : (numbered ? (i + 1) + '. ' : prefix) + bare;
  });
  ta.value = v.slice(0, s) + out.join('\n') + v.slice(e);
  ta.focus();
  ta.selectionStart = s;
  ta.selectionEnd = s + out.join('\n').length;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}

// 커서가 있는 줄 뒤에 통째로 끼워넣기 (표·구분선용)
function fmtBlock(ta, text){
  const v = ta.value;
  let s = ta.selectionStart;
  const atLineStart = s === 0 || v[s - 1] === '\n';
  const lead = atLineStart ? '' : '\n';
  const chunk = lead + text + '\n';
  ta.value = v.slice(0, s) + chunk + v.slice(s);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = s + chunk.length;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}

// 표 크기를 격자에서 고르는 작은 팝업 (최대 6x6)
function openGridPicker(btn, onPick){
  document.querySelectorAll('.grid-pick').forEach(el => el.remove());
  const box = document.createElement('div');
  box.className = 'grid-pick';
  const cells = document.createElement('div');
  cells.className = 'cells';
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.textContent = '표 크기를 고르세요';
  for (let r = 1; r <= 6; r++) for (let c = 1; c <= 6; c++) {
    const i = document.createElement('i');
    i.dataset.r = r; i.dataset.c = c;
    i.addEventListener('mouseenter', () => {
      cells.querySelectorAll('i').forEach(x =>
        x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c));
      cap.textContent = r + '줄 × ' + c + '칸';
    });
    i.addEventListener('click', () => { onPick(r, c); box.remove(); });
    cells.appendChild(i);
  }
  box.appendChild(cells); box.appendChild(cap);
  document.body.appendChild(box);
  const b = btn.getBoundingClientRect();
  box.style.left = Math.min(b.left, innerWidth - box.offsetWidth - 10) + 'px';
  box.style.top  = (b.bottom + window.scrollY + 6) + 'px';
  setTimeout(() => {
    const close = ev => {
      if (box.contains(ev.target) || ev.target === btn) return;
      box.remove(); document.removeEventListener('click', close);
    };
    document.addEventListener('click', close);
  }, 0);
}

function tableSkeleton(rows, cols){
  const head = Array.from({length:cols}, (_, i) => '제목' + (i + 1)).join(' | ');
  const body = Array.from({length:Math.max(0, rows - 1)},
    () => Array.from({length:cols}, () => '내용').join(' | '));
  return [head, ...body].join('\n');
}

// 도구막대를 만들어 textarea 바로 위에 붙인다.
// opts.fileInput 이 있으면 "사진" 버튼이 그 입력창을 눌러준다.
function buildFormatBar(ta, opts){
  opts = opts || {};
  const bar = document.createElement('div');
  bar.className = 'fmt-bar';

  const add = (html, title, fn, cls) => {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = html; b.title = title;
    if (cls) b.className = cls;
    b.addEventListener('click', () => fn(b));
    bar.appendChild(b);
    return b;
  };
  const sep = () => { const d = document.createElement('span'); d.className = 'sep'; bar.appendChild(d); };

  add('제목',  '큰제목',      () => fmtLinePrefix(ta, '# '));
  add('소제목', '중간제목',    () => fmtLinePrefix(ta, '## '));
  add('작은',  '작은제목',    () => fmtLinePrefix(ta, '### '));
  sep();
  add('가',    '굵게',        () => fmtWrap(ta, '**', '**', '굵게'), 'b');
  add('가',    '기울임',      () => fmtWrap(ta, '*', '*', '기울임'), 'i');
  add('가',    '취소선',      () => fmtWrap(ta, '~~', '~~', '취소선'), 's');
  add('가',    '형광펜',      () => fmtWrap(ta, '==', '==', '형광펜'), 'hl');
  sep();
  add('❝',     '인용문',      () => fmtLinePrefix(ta, '> '));
  add('• 목록', '글머리 목록', () => fmtLinePrefix(ta, '- '));
  add('1. 목록','번호 목록',   () => fmtLinePrefix(ta, null, true));
  add('―',     '구분선',      () => fmtBlock(ta, '---'));
  sep();
  add('⊞ 표',  '표 만들기',   (b) => openGridPicker(b, (r, c) => fmtBlock(ta, tableSkeleton(r, c))));
  add('🔗 링크','링크 넣기',   () => {
    const url = prompt('링크 주소를 붙여넣으세요', 'https://');
    if (url && /^https?:\/\//.test(url)) fmtWrap(ta, '[', '](' + url + ')', '링크 글자');
  });
  if (opts.fileInput) add('🖼 사진', '사진 올리기', () => opts.fileInput.click());
  sep();

  // 미리보기 — 문법을 외우지 않아도 결과를 바로 확인할 수 있게
  const pv = document.createElement('div');
  pv.className = 'fmt-preview';
  pv.style.display = 'none';
  pv.innerHTML = '<div class="cap">미리보기</div><div class="note-content pvBody"></div>';
  const body = pv.querySelector('.pvBody');
  const refresh = () => {
    if (pv.style.display === 'none') return;
    body.innerHTML = renderNoteContent(ta.value) || '<div class="empty-msg">아직 내용이 없어요</div>';
  };
  const pvBtn = add('👁 미리보기', '작성한 내용이 어떻게 보이는지', (b) => {
    const on = pv.style.display === 'none';
    pv.style.display = on ? 'block' : 'none';
    b.classList.toggle('on', on);
    refresh();
  });
  ta.addEventListener('input', refresh);

  ta.parentNode.insertBefore(bar, ta);
  ta.parentNode.insertBefore(pv, ta.nextSibling);
  return bar;
}

// ============================================================================
// 배경 겹 — 소개 / 포트폴리오 / 일기장 / 편지쓰기
//
// 화면에 고정된 세 겹(먼 하늘·중간 소품·가까운 풀)을 깔고, 스크롤에 따라 서로 다른
// 속도로 아주 조금씩 민다. 이동값은 도트 한 칸(S) 단위로 끊는다 — 첫 페이지 히어로가
// 땅을 밀 때 쓰는 문법(Math.round(scrollY * 0.06 / S) * S)과 같다.
//
// 물리(속도·양자화·상한)는 네 페이지가 공유하는 상수고, 페이지마다 달라지는 것은
// 그림뿐이다. 그래서 넷이 서로 다르면서도 한 사이트로 보인다.
//
// 첫 페이지와 이벤트 페이지는 buildBackdrop 을 호출하지 않으므로 아무 영향이 없다.
// ============================================================================

// 겹마다 스크롤 대비 이동 비율. 히어로의 땅이 0.06 이고, 그 값을 사이에 두고 벌린 것.
const BG_K = { far:0.03, mid:0.09, near:0.18 };
// 이동 상한(px). 겹을 미리 이만큼 아래에 앉혀 두므로 아무리 스크롤해도 빈틈이 안 생긴다.
const BG_RISE = { desktop:{far:48, mid:56, near:64}, mobile:{far:32, mid:40, near:44} };

function buildBackdrop(pageKey){
  const recipe = BACKDROP[pageKey];
  if (!recipe || typeof SPRITES === 'undefined') return;   // 이벤트 페이지 안전장치

  const CREAM = getComputedStyle(document.documentElement)
    .getPropertyValue('--cream').trim() || '#fffaf2';
  const wash = (c, t) => mixHex(c, CREAM, t);
  // 배율은 항상 슬롯 높이에서 역산한다. 절대 px 로 박으면 화면 크기에 따라 소품이 잘린다.
  const fitS = (sp, maxH) => Math.max(2, Math.floor(maxH / sp.length));
  const u = { wash, fitS, washPal, withScene, CREAM };

  const deck = document.createElement('div');
  deck.className = 'bg-deck';
  deck.setAttribute('aria-hidden', 'true');
  const layers = ['far', 'mid', 'near'].map(name => {
    const el = document.createElement('div');
    el.className = 'bg-layer bg-' + name;
    const cv = document.createElement('canvas');
    el.appendChild(cv);
    deck.appendChild(el);
    return { name, el, cv, k: BG_K[name], rise: 0, v: null };
  });
  document.body.appendChild(deck);
  document.body.classList.add('has-backdrop');

  let W = 0, S = 4, slot = {}, lastW = -1;

  function measure(){
    W = window.innerWidth;
    const mob = W < 640;
    S = mob ? 4 : 5;                       // index.html 의 resize() 와 같은 기준
    const rise = mob ? BG_RISE.mobile : BG_RISE.desktop;
    layers.forEach(L => { L.rise = rise[L.name]; });
    slot = {
      far:  mob ? Math.min(Math.round(innerHeight * 0.42), 260)
                : Math.min(Math.round(innerHeight * 0.46), 360),
      mid:  mob ? 104 : 168,
      near: recipe.nearH[mob ? 1 : 0],
    };
    deck.style.setProperty('--bg-far-h',    slot.far  + 'px');
    deck.style.setProperty('--bg-mid-h',    slot.mid  + 'px');
    deck.style.setProperty('--bg-near-h',   slot.near + 'px');
    deck.style.setProperty('--bg-near-rise', rise.near + 'px');
  }

  // 중간 겹 소품이 페이지 제목·설명문 위로 올라오면 안 된다.
  // .section-head 는 카드가 아니라 크림 위 맨살 글자라, 이 사이트에서 유일하게
  // 배경의 보호를 못 받는 텍스트 블록이다. 추측하지 않고 실제로 잰다.
  function placeMid(){
    const sh = document.querySelector('.section-head');
    const bottom = sh ? sh.getBoundingClientRect().bottom + window.scrollY : 240;
    const top = Math.max(slot.far, Math.round(bottom + 24 + (layers[1].rise)));
    deck.style.setProperty('--bg-mid-top', top + 'px');
  }

  function paint(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    layers.forEach(L => {
      const h = slot[L.name];
      L.cv.width = Math.floor(W * dpr); L.cv.height = Math.floor(h * dpr);
      const g = L.cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, h);
      recipe[L.name](g, W, h, S, u);
    });
  }

  // 이동값을 도트 칸으로 끊고 상한을 건다. 상한이 없으면 긴 페이지에서 풀 띠가 허공에 뜬다.
  const q = v => Math.round(v / S) * S;
  function apply(y){
    layers.forEach(L => {
      const v = Math.max(-L.rise, q(-y * L.k));
      if (v !== L.v) { L.v = v; L.el.style.transform = 'translate3d(0,' + v + 'px,0)'; }
    });
  }

  measure(); placeMid(); paint(); lastW = W;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    apply(1e6);                            // 다 올라온 상태로 고정 — 정지화면이 그대로 완성작
  } else {
    apply(window.scrollY);
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { apply(window.scrollY); ticking = false; });
    }, { passive:true });
  }

  // 폭이 실제로 변했을 때만 다시 그린다. iOS 주소창 여닫힘은 세로만 변하므로 그릴 이유가 없다.
  let timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const changed = Math.abs(window.innerWidth - lastW) > 8;
      measure();
      if (changed) { paint(); lastW = W; }
      placeMid();
      if (reduce) apply(1e6); else apply(window.scrollY);
    }, 150);
  });

  // 웹폰트가 늦게 오면 제목 높이가 바뀐다 — 캔버스는 그대로 두고 중간 겹 위치만 다시 잰다.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeMid);
}

// ----- 페이지별 그리기 레시피 -----
// 여기 밖의 것(속도·양자화·상한)은 네 페이지가 공유한다. 여기 안의 것만 페이지마다 다르다.
// 중간 겹의 주인공은 그 페이지의 메뉴 아이콘에서 가져왔다 — 홈 화면의 카드와 짝이 맞는다.
// 씨앗값 5.5 / 3.7 / 8.1 / 2.1 은 첫 페이지 히어로와 같은 값이라 실루엣 리듬이 이어진다.
const BACKDROP = {

  // 소개 — 마을이 보이는 언덕. 사람은 카드 위에, 세상은 뒤에.
  about: {
    nearH: [140, 96],
    far(g, W, H, S, u){
      drawSkyBands(g, W, H, S, [
        { at:0,    color:u.wash(SCENE.sky[2], .66) },
        { at:0.55, color:u.wash(SCENE.sky[3], .66) },
        { at:1,    color:u.wash(SCENE.sky[4], .66) },
      ]);
      const tops = drawHill(g, [{freq:1.6, amp:14, phase:1.2}],
        u.wash(SCENE.hills[1], .68), S, H * 0.58, W, H,
        { tilt: H * 0.05, lit: u.wash(SCENE.hillsLit[1], .68), litRows:1 });
      drawTreeLine(g, tops, S, W,
        u.wash(SCENE.hills[4], .74), u.wash(SCENE.hills[3], .74), 2.1, 0.55);
      // 능선 오른쪽에 집 하나 — 편지쓰기 페이지에서 이 집 앞까지 온다
      const hs = u.fitS(SPRITES.house, H * 0.11);
      drawSprite(g, SPRITES.house, Math.round(W * 0.80 / S) * S,
        Math.round((H * 0.58 - SPRITES.house.length * hs) / S) * S, hs,
        u.washPal(SPRITES.house, .78, u.CREAM));
      groundOut(g, W, H, H - 72, S, u.wash(SCENE.hills[1], .68), u.CREAM);
    },
    mid(g, W, H, S, u){
      const mob = W < 640;
      // 둘이 같이 앉는 자리. 수아·연아 스프라이트는 넣지 않는다 —
      // .person 카드가 이미 원색으로 크게 렌더하고 있어서 겹치면 둘 다 죽는다.
      const bs = u.fitS(SPRITES.bench, H * 0.42);
      drawSprite(g, SPRITES.bench, Math.round(W * 0.05 / S) * S,
        Math.round((H - SPRITES.bench.length * bs) / S) * S, bs,
        u.washPal(SPRITES.bench, .78, u.CREAM));
      if (mob) return;
      const ts = u.fitS(SPRITES.tree, H * 0.45);
      drawSprite(g, SPRITES.tree, Math.round(W * 0.88 / S) * S,
        Math.round((H - SPRITES.tree.length * ts) / S) * S, ts,
        u.washPal(SPRITES.tree, .78, u.CREAM));
    },
    near(g, W, H, S, u){
      const sh = NEAR_SHADES(u);
      drawBushMass(g, -S*4, W + S*4, H * 0.30, H, S, 5.5, sh);
      drawTallGrass(g, -S*2, W + S*2, H * 0.34, S, 3.7, sh, 3);
    },
  },

  // 포트폴리오 — 유일하게 풍경이 아닌 페이지. 갤러리 벽.
  portfolio: {
    nearH: [112, 76],
    far(g, W, H, S, u){
      // 능선을 넣지 않는다 — 작품 격자가 이미 시끄럽고 사용자 사진은 색을 예측할 수 없다
      drawSkyBands(g, W, H, S, [
        { at:0,    color:u.wash(SCENE.sky[1], .66) },
        { at:0.60, color:u.wash(SCENE.sky[3], .66) },
        { at:1,    color:u.CREAM },
      ]);
      groundOut(g, W, H, H - 72, S, u.wash(SCENE.sky[3], .66), u.CREAM);
    },
    mid(g, W, H, S, u){
      const mob = W < 640;
      const lineY = Math.round(H * 0.62 / S) * S;
      g.fillStyle = u.wash(PAL.F, .82);
      g.fillRect(0, lineY, W, S);                       // 벽에 박힌 걸이선
      const fs = u.fitS(SPRITES.frame, H * 0.42);
      const n = mob ? 1 : 3;
      for (let i = 0; i < n; i++) {
        // x 는 흩뜨리되 y 는 선에 맞춘다 — 액자는 흔들리지 않고 벽에 걸려 있어야 한다
        const x = W * (0.04 + i * 0.44) + (prand(i * 3.3) - 0.5) * W * 0.05;
        drawSprite(g, SPRITES.frame, Math.round(x / S) * S,
          Math.round((lineY - SPRITES.frame.length * fs + S) / S) * S, fs,
          u.washPal(SPRITES.frame, .78, u.CREAM));
      }
    },
    near(g, W, H, S, u){
      const sh = NEAR_SHADES(u);
      drawBushMass(g, -S*4, W + S*4, H * 0.55, H, S, 5.5, sh);
      drawTallGrass(g, -S*2, W + S*2, H * 0.60, S, 3.7, sh, 3);
    },
  },

  // 일기장 — 글이 제일 길고 오래 머무는 페이지라 가장 비운다
  board: {
    nearH: [104, 72],
    far(g, W, H, S, u){
      // sky[5] 는 크림과 거의 붙어 있어서, 팔레트를 벗어나지 않고 뒤쪽 구간을 쓰는 것만으로
      // 늦은 오후가 되고 본문 배경색과 자연스럽게 이어진다
      drawSkyBands(g, W, H, S, [
        { at:0,    color:u.wash(SCENE.sky[2], .66) },
        { at:0.55, color:u.wash(SCENE.sky[4], .66) },
        { at:1,    color:u.wash(SCENE.sky[5], .66) },
      ]);
      // drawFluffyCloud 는 색을 인자로 못 받고 SCENE.cloud 를 직접 읽는다 — 반드시 감싼다
      u.withScene({ cloud: {
        hi:    u.wash('#ffffff', .66),
        body:  u.wash(SCENE.cloud.body, .66),
        mid:   u.wash(SCENE.cloud.mid, .66),
        shade: u.wash(SCENE.cloud.shade, .66),
        deep:  u.wash(SCENE.cloud.deep, .66),
      }}, () => {
        drawFluffyCloud(g, W * 0.22, H * 0.30, S * 6, S, 3);
        drawFluffyCloud(g, W * 0.72, H * 0.20, S * 5, S, 17);
      });
      groundOut(g, W, H, H - 72, S, u.wash(SCENE.sky[5], .66), u.CREAM);
    },
    mid(g, W, H, S, u){
      const mob = W < 640;
      const bs = u.fitS(SPRITES.bubble, H * 0.38);
      const put = (sp, xr, s) => drawSprite(g, sp, Math.round(W * xr / S) * S,
        Math.round((H - sp.length * s) / S) * S, s, u.washPal(sp, .78, u.CREAM));
      put(SPRITES.bubble, 0.04, bs);                    // 말풍선이 시간을 두고 떠 있는 느낌
      if (mob) return;
      put(SPRITES.bubble, 0.89, bs);
      put(SPRITES.cloudS, 0.47, u.fitS(SPRITES.cloudS, H * 0.22));
    },
    near(g, W, H, S, u){
      // 벽이 아니라 술처럼 얇은 풀 가장자리. 가장 조용한 페이지.
      drawTallGrass(g, -S*2, W + S*2, H * 0.86, S, 3.7, NEAR_SHADES(u), 4);
    },
  },

  // 모아보기 — 한 해를 훑는 페이지. 일기장과 같은 조용한 톤으로.
  year: {
    nearH: [104, 72],
    far(g, W, H, S, u){ return BACKDROP.board.far(g, W, H, S, u); },
    mid(g, W, H, S, u){ return BACKDROP.board.mid(g, W, H, S, u); },
    near(g, W, H, S, u){ return BACKDROP.board.near(g, W, H, S, u); },
  },

  // 시간표 — 격자가 이미 촘촘해서 배경은 모아보기와 같은 조용한 톤으로 둔다.
  time: {
    nearH: [96, 64],
    far(g, W, H, S, u){ return BACKDROP.board.far(g, W, H, S, u); },
    mid(g, W, H, S, u){ return BACKDROP.board.mid(g, W, H, S, u); },
    near(g, W, H, S, u){ return BACKDROP.board.near(g, W, H, S, u); },
  },

  // 편지쓰기 — 우체국. 폼 한 칸짜리라 스크롤이 거의 없어서, 움직임이 아니라 겹침으로 깊이를 낸다.
  contact: {
    nearH: [168, 112],
    far(g, W, H, S, u){
      drawSkyBands(g, W, H, S, [
        { at:0,    color:u.wash(SCENE.sky[2], .66) },
        { at:0.50, color:u.wash(SCENE.sky[3], .66) },
        { at:1,    color:u.wash(SCENE.sky[4], .66) },
      ]);
      drawHill(g, [{freq:1.2, amp:9, phase:1.5}],
        u.wash(SCENE.hills[2], .68), S, H * 0.60, W, H,
        { tilt: H * 0.04, lit: u.wash(SCENE.hillsLit[2], .68), litRows:1 });
      const bs = u.fitS(SPRITES.bird, H * 0.035);       // 편지를 나르는 쪽
      [[0.30, 0.26], [0.44, 0.20]].forEach(([xr, yr]) =>
        drawSprite(g, SPRITES.bird, Math.round(W * xr / S) * S,
          Math.round(H * yr / S) * S, bs, u.washPal(SPRITES.bird, .80, u.CREAM)));
      groundOut(g, W, H, H - 72, S, u.wash(SCENE.hills[2], .68), u.CREAM);
    },
    mid(g, W, H, S, u){
      const mob = W < 640;
      // 소개 페이지 능선에서 손톱만하게 보이던 그 집. 여기서는 슬롯의 42% 다.
      // 크기와 겹 속도가 같이 벌어지므로 "멀리 보이던 집 앞에 와서 편지를 쓴다"가 읽힌다.
      const hs = u.fitS(SPRITES.house, H * 0.45);
      drawSprite(g, SPRITES.house, Math.round(W * 0.10 / S) * S,
        Math.round((H - SPRITES.house.length * hs) / S) * S, hs,
        u.washPal(SPRITES.house, .78, u.CREAM));
      const ms = u.fitS(SPRITES.mail, H * 0.24);
      const path = mob ? [[0.74, 0.30]] : [[0.90, 0.10], [0.80, 0.34], [0.70, 0.58]];
      path.forEach(([xr, yr]) =>                        // 집을 향해 내려오는 편지들
        drawSprite(g, SPRITES.mail, Math.round(W * xr / S) * S,
          Math.round(H * yr / S) * S, ms, u.washPal(SPRITES.mail, .78, u.CREAM)));
    },
    near(g, W, H, S, u){
      const sh = NEAR_SHADES(u);
      drawBushMass(g, -S*4, W + S*4, H * 0.28, H, S, 5.5, sh);
      drawTallGrass(g, -S*2, W + S*2, H * 0.34, S, 3.7, sh, 2);
      drawTallGrass(g, -S*2, W + S*2, H * 0.98, S, 8.1, sh, 2);
    },
  },
};

// 가까운 겹의 초록 3단. SCENE.bush 는 흰 글자를 받으려고 만든 거의 검정 초록이라,
// 글이 읽히게 물을 빼면 단끼리 뭉개져 버린다. 밝은 쪽 언덕색을 쓰면 명암이 살아남는다.
function NEAR_SHADES(u){
  return [u.wash(SCENE.hills[1], .66), u.wash(SCENE.hills[2], .66), u.wash(SCENE.hills[3], .66)];
}
