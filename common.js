// 모든 페이지가 함께 쓰는 공통 코드 — 헤더/푸터, 로그인, 이미지 업로드, 스크롤 효과.

const SB_URL = 'https://ifiemaypzjwdrljmmkgb.supabase.co';
const SB_KEY = 'sb_publishable_uhn46d4RFI5DeIUjtz3IRA_U9X8iPZj';
const sb = supabase.createClient(SB_URL, SB_KEY);

// 사진은 이 버킷에 올라감 (로그인한 사람만 업로드 가능하도록 정책이 걸려 있음)
const MEDIA_BUCKET = 'event-images';
// 사진은 이 용량을 넘을 때만 압축함 (넘지 않으면 원본 그대로 올라감)
const IMAGE_LIMIT = 5 * 1024 * 1024;         // 기본 5MB — 일기장 사진
const PORTFOLIO_IMAGE_LIMIT = 10 * 1024 * 1024;  // 작품은 화질이 중요해서 10MB
const VIDEO_LIMIT = 100 * 1024 * 1024;

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// 모아보기(year.html)는 여기 없다. 포트폴리오의 연도 버튼 옆에서 들어간다 —
// "2026년 작품"과 "2026년 모아보기"가 메뉴에 나란히 있으면 무엇이 다른지 알기 어렵고,
// 연도를 이미 고른 자리에서 넘어가면 저쪽에서 다시 고를 필요도 없다.
const MENU = [
  { href: '/',              label: '홈',        key: 'home' },
  { href: '/about.html',    label: '소개',      key: 'about' },
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

  // 아래로 스크롤하면 헤더 숨김
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('hidden', y > 200 && y > last);
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
    '<button class="lightbox-nav prev" aria-label="이전">‹</button>' +
    '<button class="lightbox-nav next" aria-label="다음">›</button>' +
    '<img id="lbImg" alt=""><video id="lbVid" controls playsinline style="display:none;"></video>' +
    '<div class="lightbox-cap" id="lbCap"></div>';
  document.body.appendChild(lb);

  let items = [], idx = 0;
  const img = lb.querySelector('#lbImg'), vid = lb.querySelector('#lbVid');
  const cap = lb.querySelector('#lbCap');
  const prev = lb.querySelector('.prev'), next = lb.querySelector('.next');

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
    lb.scrollTop = 0;   // 사진을 넘길 때마다 맨 위부터 보이게
  }
  function open(list, i){
    items = list; idx = i;
    lb.classList.add('open');
    document.body.classList.add('lb-open');   // 헤더를 잠시 숨김
    document.body.style.overflow = 'hidden';
    render();
  }
  function close(){
    lb.classList.remove('open');
    document.body.classList.remove('lb-open');
    document.body.style.overflow = '';
    vid.pause();
  }
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
