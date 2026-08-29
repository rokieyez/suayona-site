// 모든 페이지가 함께 쓰는 공통 코드 — 헤더/푸터, 로그인, 이미지 업로드, 스크롤 효과.

const SB_URL = 'https://ifiemaypzjwdrljmmkgb.supabase.co';
const SB_KEY = 'sb_publishable_uhn46d4RFI5DeIUjtz3IRA_U9X8iPZj';
const sb = supabase.createClient(SB_URL, SB_KEY);

// 사진은 이 버킷에 올라감 (로그인한 사람만 업로드 가능하도록 정책이 걸려 있음)
const MEDIA_BUCKET = 'event-images';
const IMAGE_LIMIT = 5 * 1024 * 1024;   // 5MB로 자동 압축
const VIDEO_LIMIT = 100 * 1024 * 1024;

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const MENU = [
  { href: '/',              label: '홈',        key: 'home' },
  { href: '/about.html',    label: '소개',      key: 'about' },
  { href: '/portfolio.html',label: '포트폴리오', key: 'portfolio' },
  { href: '/board.html',    label: '일기장',    key: 'board' },
  { href: '/event.html',    label: '이벤트',    key: 'event' },
  { href: '/contact.html',  label: '컨택트',    key: 'contact' },
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
    '<canvas id="footHeart" width="28" height="24"></canvas>' +
    '<div class="pixel" style="margin-top:8px;">수아 · 연아</div>' +
    '<div>© 2026 suayona.com</div>';
  document.body.appendChild(footer);

  // 로고/푸터 하트 도트 찍기
  if (typeof SPRITES !== 'undefined') {
    const lc = $('#logoCanvas').getContext('2d');
    lc.imageSmoothingEnabled = false;
    drawSprite(lc, SPRITES.heart, 1, 3, 5);
    const fc = $('#footHeart').getContext('2d');
    fc.imageSmoothingEnabled = false;
    drawSprite(fc, SPRITES.heart, 0, 0, 4);
  }

  // 모바일 메뉴
  const nav = $('#nav');
  $('#menuToggle').addEventListener('click', () => nav.classList.toggle('open'));
  nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });

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
async function uploadMedia(file, folder){
  const isVideo = file.type.startsWith('video/');
  if (isVideo && file.size > VIDEO_LIMIT) {
    throw new Error('영상은 ' + (VIDEO_LIMIT/1024/1024) + 'MB를 넘을 수 없어요.');
  }
  const upFile = isVideo ? file : await compressImage(file, IMAGE_LIMIT);
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
