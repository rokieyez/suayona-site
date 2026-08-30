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

const MENU = [
  { href: '/',              label: '홈',        key: 'home' },
  { href: '/about.html',    label: '소개',      key: 'about' },
  { href: '/portfolio.html',label: '포트폴리오', key: 'portfolio' },
  { href: '/board.html',    label: '일기장',    key: 'board' },
  { href: '/event/',        label: '일정표',    key: 'event' },
  { href: '/contact.html',  label: '편지쓰기',  key: 'contact' },
];

// ---------- 헤더 / 푸터 ----------
function buildChrome(activeKey){
  const header = document.createElement('header');
  header.className = 'site';
  header.id = 'siteHeader';
  header.innerHTML =
    '<a class="logo" href="/">' +
      '<canvas id="logoCanvas" width="36" height="36"></canvas>' +
      '<span class="logo-text pixel">수아랑 연아랑</span>' +
    '</a>' +
    '<button class="menu-toggle pixel" id="menuToggle" aria-label="메뉴 열기">☰</button>' +
    '<nav id="nav">' +
      MENU.map(m =>
        '<a href="' + m.href + '"' +
        (m.external ? ' target="_blank" rel="noopener"' : '') +
        (m.key === activeKey ? ' class="active"' : '') +
        '>' + m.label + '</a>'
      ).join('') +
    '</nav>';
  document.body.prepend(header);

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
let isAdmin = false;
async function refreshAuth(){
  const { data: { session } } = await sb.auth.getSession();
  isAdmin = !!session;
  return session;
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

  box.querySelector('.lgBtn').addEventListener('click', async () => {
    const msg = box.querySelector('.lgMsg');
    msg.className = 'msg'; msg.textContent = '로그인 중...';
    const { error } = await sb.auth.signInWithPassword({
      email: box.querySelector('.lgEmail').value.trim(),
      password: box.querySelector('.lgPw').value,
    });
    if (error) { msg.className = 'msg err'; msg.textContent = '로그인 실패: ' + error.message; return; }
    msg.textContent = '';
    await refreshAuth();
    onChange(isAdmin);
  });
  return box;
}

function mountAdminBar(container, onChange){
  const bar = document.createElement('div');
  bar.className = 'admin-bar';
  bar.innerHTML = '<span>관리자로 로그인됨</span><button class="dot-btn small logoutBtn">로그아웃</button>';
  container.appendChild(bar);
  bar.querySelector('.logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    await refreshAuth();
    onChange(isAdmin);
  });
  return bar;
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
  return { url: data.publicUrl, type: isVideo ? 'video' : 'image' };
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
