// event/e/preview.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

// 실제 부산여행 사진입니다 (작은 사본).
const B = 'https://ifiemaypzjwdrljmmkgb.supabase.co/storage/v1/object/public/gallery-uploads/2026-08-busan/';
const P = {
  p1:B+'1788102857106-wypc63-9924.thumb.jpg', p2:B+'1788102855703-4z7i1w-9934.thumb.jpg',
  p3:B+'1788102853185-5dv9pl-9954.thumb.jpg', p4:B+'1788102853962-zawpp6-9957.thumb.jpg',
  p5:B+'1788102851188-1qi3a5-9981.thumb.jpg', p6:B+'1788102846346-r5p0bt-10039.thumb.jpg',
};

// 일부러 여러 모양을 섞었습니다 — 어느 하나에서만 예뻐 보이면 시안이 아니라서.
const DAYS = {
  d1: { label:'8/5 수', head:'8월 5일 수요일', items:[
    { time:'08:30', title:'아침', shots:['p1'], meta:'08:27' },
    { time:'13:00', title:'감천문화마을', shots:['p2','p6'], meta:'13:05',
      detail:'골목마다 담벼락 색이 달라서 한참을 돌아다녔다.\n연아가 계단을 세다가 중간에 놓쳤고, 수아는 끝까지 세더니 백여든두 개라고 했다.' },
    { time:'17:30', title:'숙소에서 쉬는 중', detail:'둘 다 뻗었다. 사진 찍을 정신이 없었음.', shots:[] },
    { time:'20:00 - 20:30', title:'국밥', shots:['p4','p5','p3'], meta:'20:13' },
  ]},
  d2: { label:'8/6 목', head:'8월 6일 목요일', items:[
    { time:'11:00', title:'오전', shots:['p6'], meta:'11:02' },
    { time:'12:00 - 12:30', title:'점심 무렵', shots:['p5','p1','p2','p3'], meta:'12:14', now:true },
  ]},
  d3: { label:'8/7 금', head:'8월 7일 금요일', items:[
    { time:'12:30', title:'이재모 피자', shots:['p3','p4'], meta:'12:31' },
    { time:'17:30', title:'방탈출', shots:['p1'], meta:'17:28' },
  ]},
  gal:{ label:'📷 갤러리', head:'사진 모아보기' },
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function shotsHTML(it){
  const n = it.shots ? it.shots.length : 0;
  if (!n) return '';
  const many = n > 1;
  // 홀수면 첫 장을 두 칸에 걸쳐 크게 — 남는 칸 없이 채워지고 대표 사진이 생깁니다
  const lead = many && n % 2 === 1;
  return '<div class="shots' + (many ? ' many' : '') + '">' +
    it.shots.map((k, i) =>
      '<span class="shot' + (lead && i === 0 ? ' lead' : '') + '">' +
        '<img src="' + P[k] + '" alt="" loading="lazy">' +
        (i === 0 && it.meta ? '<span class="meta">2026.08.05 ' + esc(it.meta) + '</span>' : '') +
      '</span>').join('') + '</div>';
}

function renderDay(key){
  const day = DAYS[key];
  const isGal = key === 'gal';
  document.getElementById('rail').classList.toggle('hidden', isGal);
  document.getElementById('gal').classList.toggle('hidden', !isGal);

  const count = isGal ? 12 : day.items.length;
  const shots = isGal ? 0 : day.items.reduce((n, i) => n + (i.shots ? i.shots.length : 0), 0);
  document.getElementById('dayhead').innerHTML =
    '<span>' + esc(day.head) + '</span><span class="daycount">' +
    (isGal ? '사진 ' + count + '장' : count + '가지 · 사진 ' + shots + '장') + '</span>';

  if (isGal) {
    const all = ['p1','p2','p3','p4','p5','p6','p3','p1','p5','p2','p6','p4'];
    document.getElementById('gal').innerHTML =
      all.map(k => '<img src="' + P[k] + '" alt="" loading="lazy">').join('');
    return;
  }

  document.getElementById('rail').innerHTML = day.items.map(it =>
    '<div class="item' + (it.now ? ' now' : '') + '">' +
      '<div class="line">' +
        '<span class="time">' + esc(it.time) + '</span>' +
        (it.now ? '<span class="nowtag">지금</span>' : '') +
        '<h3 class="title">' + esc(it.title) + '</h3>' +
      '</div>' +
      (it.detail ? '<p class="detail">' + esc(it.detail) + '</p>' : '') +
      shotsHTML(it) +
    '</div>').join('');
}

function renderTabs(active){
  document.getElementById('tabs').innerHTML = Object.keys(DAYS).map(k =>
    '<button class="tab' + (k === active ? ' on' : '') + '" data-d="' + k + '">' +
      esc(DAYS[k].label) + '</button>').join('');
  document.querySelectorAll('.tab').forEach(b =>
    b.addEventListener('click', () => { renderTabs(b.dataset.d); renderDay(b.dataset.d); }));
}

const NOTES = {
  now:  '지금 모습입니다. 둥근 모서리, 부드러운 그림자, 초록 강조색 — 다른 페이지와 결이 다릅니다. ' +
        '시각(08:30)이 초록 작은 글씨라 눈에 잘 안 들어오고, 사진이 한 장씩 세로로만 쌓입니다.',
  card: '<b>카드안 2차.</b> 사진이 여럿이면 두 칸으로 놓고, 날짜 탭은 위에 붙여 두고, ' +
        '끝난 여행의 진행률 막대는 뺐습니다. 시각은 딱지로 만들어 카드에서 제일 먼저 보이게 했습니다.<br>' +
        '탭을 눌러 <b>사진 없는 일정 · 긴 설명 · 사진 넉 장 · 진행 중 표시 · 갤러리</b>까지 확인해 보세요.',
};

// ---------- 라이트박스 (포트폴리오와 같은 동작) ----------
let lbList = [], lbAt = 0;
const lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg'),
      lbCap = document.getElementById('lbCap'),
      lbPrev = document.getElementById('lbPrev'), lbNext = document.getElementById('lbNext');

function lbRender(){
  const it = lbList[lbAt];
  if (!it) return;
  lbImg.src = it.url;
  const pos = lbList.length > 1 ? '  (' + (lbAt + 1) + ' / ' + lbList.length + ')' : '';
  lbCap.textContent = (it.cap || '') + pos;
  const many = lbList.length > 1;
  lbPrev.hidden = !many; lbNext.hidden = !many;
  lb.scrollTop = 0;                      // 넘길 때마다 맨 위부터
}
function lbOpen(list, i){
  lbList = list; lbAt = i;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbRender();
}
function lbClose(){
  lb.classList.remove('open');
  document.body.style.overflow = '';
}
function lbGo(d){ lbAt = (lbAt + d + lbList.length) % lbList.length; lbRender(); }

lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
document.getElementById('lbClose').addEventListener('click', lbClose);
lbPrev.addEventListener('click', e => { e.stopPropagation(); lbGo(-1); });
lbNext.addEventListener('click', e => { e.stopPropagation(); lbGo(1); });
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') lbClose();
  else if (e.key === 'ArrowLeft') lbGo(-1);
  else if (e.key === 'ArrowRight') lbGo(1);
});
// 손가락으로 좌우 쓸기
let sx = 0, sy = 0, tracking = false;
lb.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) { tracking = false; return; }
  sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
}, {passive:true});
lb.addEventListener('touchend', e => {
  if (!tracking) return;
  tracking = false;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbGo(dx < 0 ? 1 : -1);
}, {passive:true});

// 갤러리·일정 사진 아무 곳이나 눌러 열기
document.getElementById('gal').addEventListener('click', e => {
  const img = e.target.closest('img'); if (!img) return;
  const all = [...document.querySelectorAll('#gal img')].map(x => ({ url:x.src, cap:'사진 모아보기' }));
  lbOpen(all, all.findIndex(x => x.url === img.src));
});
document.getElementById('rail').addEventListener('click', e => {
  const img = e.target.closest('.shots img'); if (!img) return;
  const all = [...document.querySelectorAll('#rail .shots img')].map(x => ({
    url:x.src, cap:(x.closest('.item').querySelector('.title')||{}).textContent || '' }));
  lbOpen(all, all.findIndex(x => x === img) >= 0 ? [...document.querySelectorAll('#rail .shots img')].indexOf(img) : 0);
});

function setMode(m){
  document.body.dataset.mode = m;
  document.querySelectorAll('.picker button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  document.getElementById('note').innerHTML = NOTES[m];
}
document.querySelectorAll('.picker button').forEach(b =>
  b.addEventListener('click', () => setMode(b.dataset.m)));

renderTabs('d1');
renderDay('d1');
setMode('card');
