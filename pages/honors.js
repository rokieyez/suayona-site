// honors.html 의 페이지 스크립트 — 업적 전시실.
// 싣는 순서: supabase → pixel → common → 이 파일.
/* 학교·학원에서 받은 상장, 차근차근 올라간 급수, 처음 해낸 일을 아이마다 모아 전시한다(2026-09-14).
   모험단 보물 저장고와는 따로다 — 게임 보상과 잇지 않는다(상을 받는 일이 게임 점수가 되지 않게).
   · 누구나 본다. 사진에는 이름·학교·반이 찍혀 있기 쉬워서, 부모가 올릴 때 가릴 곳을 네모로 골라
     모자이크한 사본만 올린다. 원본은 브라우저 밖으로 안 나간다 — 캔버스에서 다시 구우므로 EXIF(찍은 곳)도 빠진다.
   · 방은 모험단 방과 같은 아이소메트릭 틀(400×260, 칸 56×28). 오른쪽 벽은 상장 액자,
     왼쪽 벽은 급수 사다리, 바닥 진열대는 메달·트로피와 처음 해낸 것.
   · 학년도(3월 시작)로 나눈다. 생년월일은 가족만 읽는 표라 「몇 학년」 대신 「2026학년도」로 적는다.
   더한 것(2026-09-14 저녁):
   · 학년도마다 벽지·양탄자 무늬가 바뀐다(shellCv 의 yr). 한 해치를 도트 카드 한 장으로 굽거나(yearCard) A4 로 뽑는다(printSheet).
   · 급수 사다리의 빈 윗칸에 아이가 「다음 목표」를 적는다(honor_goals). 그 단계가 올라오면 이룬 것이 된다.
   · 손님이 자랑마다 박수를 남긴다(honor_claps, 방명록 도장과 같은 홍수 방지). 한 브라우저에서 한 자랑에 한 번.
   · 아이가 제 자랑에 그날의 소감 목소리를 붙인다(honor_voice). 목소리 일기와 같은 녹음기·폴더.
   · 아이가 진열대 천 색·조명 색을 고른다(honor_prefs). */

buildChrome('honors');
const lightbox = createLightbox();

const KIDS = ['sua', 'yona'];
const KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3' };   // 모험단 주인공 색과 같다
const KIND_NAME = { title: '직함', award: '상장·메달', level: '급수', first: '처음 해낸 것' };
// 직함 아이콘 — 어깨띠·역대 줄·홈 카드에 같이 쓴다
const ICON_NAME = { crown: '왕관', star: '별', book: '책', spoon: '숟가락', flag: '깃발', note: '음표', ball: '공', heart: '하트' };
const ICONS = {
  crown: ['g.....g', 'g.g.g.g', 'gg.g.gg', 'ggggggg', 'gyyyyyg', 'ggggggg'],
  star:  ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.'],
  book:  ['bbbbbbb', 'bwwwwwb', 'bwbbbwb', 'bwwwwwb', 'bwbbwwb', 'bbbbbbb'],
  spoon: ['..www..', '..www..', '...w...', '...w...', '...w...', '...w...'],
  flag:  ['r......', 'rrrrrr.', 'rrrrrrr', 'rrrrrr.', 'r......', 'r......'],
  note:  ['....y..', '....yy.', '....y.y', '....y..', '..yyy..', '..yyy..'],
  ball:  ['.ggggg.', 'gwggggg', 'gggwggg', 'gggggwg', 'gggggg.', '.ggggg.'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
};
const IPAL = { g: '#ffd979', y: '#fffaf2', b: '#3a63b0', w: '#fffaf2', r: '#ff8a9a' };
function drawIcon(g, name, x, y, sc, over){
  const a = ICONS[name] || ICONS.star;
  for (let r = 0; r < a.length; r++) for (let c = 0; c < a[r].length; c++){ const ch = a[r][c]; if (ch === '.') continue; g.fillStyle = (over && over[ch]) || IPAL[ch]; g.fillRect(x + c * sc, y + r * sc, sc, sc); }
}
const LOOK = {
  paper:  { name: '상장 액자', kind: 'award' },
  medal:  { name: '메달',     kind: 'award' },
  trophy: { name: '트로피',   kind: 'award' },
  piano:  { name: '건반 이름표', kind: 'level' },
  badge:  { name: '인증 배지', kind: 'level' },
  star:   { name: '별 기념패', kind: 'first' },
  sash:   { name: '어깨띠',   kind: 'title' },
};
const LEVEL_COLOR = '#57b98a';               // 색을 안 고른 급수
const PHOTO_DIM = 2000;                      // 올리는 사진의 긴 변
const PHOTO_LIMIT = Math.round(1.5 * 1024 * 1024);   // 눌러 크게 볼 사진은 1.5MB 안으로 줄여 올린다
const THUMB_LONG = 400;

const CLOTH = { cream: '#f1e3c6', red: '#c0392b', blue: '#3a63b0', green: '#3f9a63', purple: '#7a4fa8', night: '#2f3242' };
const CLOTH_NAME = { cream: '크림', red: '빨강 벨벳', blue: '파랑', green: '초록', purple: '보라', night: '까만 밤' };
const LAMP = { warm: [255, 230, 170], white: [235, 240, 255], pink: [255, 190, 215], mint: [190, 245, 220] };
const LAMP_NAME = { warm: '따뜻한 노랑', white: '하얀 빛', pink: '분홍', mint: '민트' };

// kid·year 는 「지금 다루는 구역」이다. 두 아이의 방을 위아래로 다 그리므로(2026-09-14 저녁, 탭을 없앴다)
// 구역마다 withKid() 로 잠깐 바꿔 놓고 그린다. 모달은 열 때의 아이를 붙잡아 둔다 — 다른 방을 훑기만 해도 kid 가 바뀐다.
let rows = [], kid = 'sua', year = 'all', missing = false;
const yearOf = { sua: 'all', yona: 'all' };
// 시간대 — 창밖과 전등이 따라 바뀐다(농장의 계절처럼). ?phase=day|dusk|night 로 미리 볼 수 있다.
function dayPhase(){
  const q = new URLSearchParams(location.search).get('phase');
  if (q === 'day' || q === 'dusk' || q === 'night') return q;
  const h = new Date().getHours();
  return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
}
const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function withKid(k, fn){ const pk = kid, py = year; kid = k; year = yearOf[k]; try { return fn(); } finally { kid = pk; year = py; } }
let goals = [], claps = {}, prefs = {};   // 다음 목표 · 박수 수 · 진열대 꾸밈
let wantItem = Number(new URLSearchParams(location.search).get('item')) || 0;   // ?item= 으로 들어오면 그것부터 연다
{
  const q = new URLSearchParams(location.search);
  if (KIDS.includes(q.get('who')) && /^\d{4}$/.test(q.get('year') || '')) yearOf[q.get('who')] = q.get('year');
}

// ---------- 작은 셈 ----------
function schoolYear(d){ const p = String(d || '').split('-').map(Number); return p[1] >= 3 ? p[0] : p[0] - 1; }
function fmtDate(d){ const p = String(d || '').split('-'); return p.length === 3 ? p[0] + '.' + Number(p[1]) + '.' + Number(p[2]) : ''; }
function todayStr(){ const d = new Date(), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
function mineOf(k){ return rows.filter(r => r.who === k || r.who === 'both'); }
function yearsOf(list){ return [...new Set(list.map(r => schoolYear(r.got_on)))].sort((a, b) => b - a); }
function inYear(list){ return year === 'all' ? list : list.filter(r => schoolYear(r.got_on) === Number(year)); }
function sayOf(r, k){ return k === 'sua' ? r.say_sua : r.say_yona; }
function lookOf(r){ return LOOK[r.look] && LOOK[r.look].kind === r.kind ? r.look : ({ award: 'paper', level: 'piano', first: 'star', title: 'sash' })[r.kind] || 'paper'; }
function itemColor(r){ return /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : r.kind === 'level' ? LEVEL_COLOR : KID_COLOR[kid]; }
function pathOfUrl(u){ const m = String(u || '').split('/object/public/' + MEDIA_BUCKET + '/'); return m.length === 2 ? decodeURIComponent(m[1].split('?')[0]) : null; }
function captionOf(r){
  const s = sayOf(r, kid);
  if (r.kind === 'title') return r.title + (r.org ? ' · ' + r.org : '') + ' · ' + fmtDate(r.got_on) + ' ~ ' + fmtDate(r.until) + (isCurrent(r) ? ' · 임기 중' : ' · 임기 끝') + (s ? ' — “' + s + '”' : '');
  return (r.kind === 'level' ? r.track + ' · ' : '') + r.title + (r.kind === 'level' && r.step ? ' (' + r.step + '단계)' : '') +
    (r.org ? ' · ' + r.org : '') + ' · ' + fmtDate(r.got_on) + (s ? ' — “' + s + '”' : '');
}
// 직함 — 임기(got_on ~ until). 오늘이 그 안이면 「지금」, 지났으면 「역대」
function isCurrent(r){ const t = todayStr(); return r.kind === 'title' && !!r.until && r.got_on <= t && t <= r.until; }
function daysBetween(a, b){ const p = x => { const q = String(x).split('-').map(Number); return Date.UTC(q[0], q[1] - 1, q[2]); }; return Math.round((p(b) - p(a)) / 86400000); }
function termOf(r){
  const total = Math.max(1, daysBetween(r.got_on, r.until)), gone = Math.max(0, Math.min(total, daysBetween(r.got_on, todayStr())));
  return { total, gone, frac: gone / total, monthsIn: Math.floor(gone / 30.4) + 1, monthsLeft: Math.max(0, Math.ceil((total - gone) / 30.4)) };
}
function untilDefault(got){ const y = schoolYear(got || todayStr()) + 1; return y + '-02-' + (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? '29' : '28'); }
function say(t, k){ const el = $('#museumMsg-' + (k || kid)); if (el) el.textContent = t || ''; }
function canEditKid(k){ return isAdmin || (isChild && !!me && me.author_key === k); }   // 부모거나 그 아이 자신
function prefOf(k){ return Object.assign({ cloth: 'cream', lamp: 'warm' }, prefs[k] || {}); }
function goalOf(k, track){ return goals.find(g => g.who === k && g.track === track) || null; }
function goalDone(g, top){ return !!g && top >= g.step; }
function roomYear(){ return year === 'all' ? schoolYear(todayStr()) : Number(year); }
function clapKey(id){ return 'honor_clap:' + id; }
function clapped(id){ try { return localStorage.getItem(clapKey(id)) === '1'; } catch (e) { return false; } }

// ---------- 불러오기 ----------
async function load(){
  // 표 넷(honors·goals·prefs·박수 수)을 honor_board() 한 번으로 받는다 — 전엔 왕복 4번
  const { data, error } = await sb.rpc('honor_board');
  if (error){
    // 함수·표가 아직 없으면(서버 쪽 준비 전) 빈 전시관 대신 그렇다고 말한다
    missing = /honor_board|honors|42P01|42883|PGRST20[25]|schema cache/i.test((error.code || '') + ' ' + (error.message || ''));
    rows = [];
    if (!missing) say('불러오지 못했어요: ' + readableError(error));
  } else {
    missing = false;
    takeBoard(data);
  }
  // 메뉴 「업적 전시실」의 새 자랑 점 — 여기까지 본 것을 적어 두면 점이 사라진다(common.js markNewHonors)
  try {
    const latest = rows.reduce((m, r) => r.created_at > m ? r.created_at : m, '');
    localStorage.setItem('honors_seen', latest);
    sessionStorage.setItem('honors_latest', JSON.stringify({ at: Date.now(), latest }));
  } catch (e) { /* 저장이 막힌 브라우저 — 점이 남을 뿐이다 */ }
  render();
  if (wantItem){
    const r = rows.find(x => x.id === wantItem);
    wantItem = 0;
    if (r){
      const k = r.who === 'both' ? 'sua' : r.who;
      yearOf[k] = 'all'; render();
      const sec = document.querySelector('.honor-room[data-kid="' + k + '"]');
      if (sec) sec.scrollIntoView({ block: 'start' });
      withKid(k, () => openItem(r));
    }
  }
}

// 곁표들 — 하나가 없거나 막혀도 전시실은 그려진다
// honor_board() 가 준 한 덩이를 나눠 담는다. 서버가 got_on·id 내림차순으로 준다.
function takeBoard(b){
  b = b || {};
  rows = Array.isArray(b.honors) ? b.honors : [];
  goals = Array.isArray(b.goals) ? b.goals : [];
  claps = {}; Object.keys(b.claps || {}).forEach(id => { claps[id] = Number(b.claps[id]) || 0; });
  prefs = {}; (Array.isArray(b.prefs) ? b.prefs : []).forEach(x => { prefs[x.who] = x; });
}

// ---------- 도트 그림 ----------
const HPAL = { k: '#2a2118', G: '#b9812c', g: '#e0a93b', y: '#ffd979', Y: '#fff0b8', r: '#d4504a', R: '#8f302c',
  b: '#3a63b0', w: '#fffaf2', I: '#9aa4b2', n: '#7a4f2d', N: '#5a3a22' };
const OBJ_ART = {
  paper: [
    '................', '.GGGGGGGGGGGGGG.', '.GwwwwwwwwwwwwG.', '.GwwIIIIIIIIwwG.',
    '.GwwwwwwwwwwwwG.', '.GwIIIIIIIIIIwG.', '.GwIIIIIIIIwwwG.', '.GwIIIIIIIIIIwG.',
    '.GwIIIIIwwwwwwG.', '.GwwwwwwwwwrrwG.', '.GwwwwwwwwrRrwG.', '.GwwwwwwwwwrrwG.',
    '.GGGGGGGGGGGGGG.', '................', '................', '................',
  ],
  medal: [
    '...rrr....bbb...', '....rrr..bbb....', '.....rrrbbb.....', '......rrbb......',
    '.......GG.......', '.....GGGGGG.....', '....GggggggG....', '...GggyyyyggG...',
    '...GgyyYYyygG...', '...GgyYYYYygG...', '...GgyyYYyygG...', '...GggyyyyggG...',
    '....GggggggG....', '.....GGGGGG.....', '................', '................',
  ],
  trophy: [
    '................', '...GGGGGGGGGG...', '.G.GgyyyyyygG.G.', 'G..GgyYyyyygG..G',
    'G..GgyYyyyygG..G', '.G.GgyyyyyygG.G.', '..GGggyyyyggGG..', '....GggyyggG....',
    '.....GggggG.....', '......GggG......', '.......gG.......', '.......gG.......',
    '.....GGggGG.....', '....nnnnnnnn....', '....NNNNNNNN....', '................',
  ],
  star: [
    '.......gg.......', '......gyyg......', '......gYyg......', '.gggggyYyyggggg.',
    '..gyyyYYyyyyyg..', '...gyyYyyyyyg...', '....gyyyyyyg....', '....gyyyyyyg....',
    '...gyyyggyyyg...', '...gyyg..gyyg...', '..gyg......gyg..', '..gg........gg..',
    '................', '....rrrrrrrr....', '....RRRRRRRR....', '................',
  ],
  badge: [
    '................', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kwIIIIIIIIwk..',
    '..kwwwwwwwwwwk..', '..kwIIIIIwwwwk..', '..kwwwwwwwwwwk..', '..kwIIIIwwhhwk..',
    '..kwwwwwwhHhwk..', '..kwwwwwwwhhwk..', '..kkkkkkkkkkkk..', '..........hh....',
    '.........h..h...', '................', '................', '................',
  ],
  sash: [                                                           // 비스듬한 어깨띠
    '................', 'kk..............', 'khhk............', 'khhhhk..........',
    '.khhhhhk........', '..khhHhhhk......', '...khhhHhhhk....', '....khhhhHhhk...',
    '.....khhhhhHhk..', '......khhhhhhhk.', '.......khhhhhhkk', '........khhhhk..',
    '.........khhk...', '..........kk....', '................', '................',
  ],
  piano: [                                                          // 건반 위에 단계 색 음표
    '...........h....', '...........h....', '...........h....', '.........hhh....',
    '........hHhh....', '.........hh.....', '................', '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.', '.kwkwkwwkwkwkwk.', '.kwkwkwwkwkwkwk.', '.kwwwwwwwwwwwwk.',
    '.kwIwIwIwIwIwIk.', '.kkkkkkkkkkkkkk.', '................', '................',
  ],
};
function shade(hex, d){
  const n = parseInt(String(hex).slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, v + d)));
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
}
function drawArt(g, art, x, y, s, color){
  const dark = shade(color, -44);
  for (let r = 0; r < art.length; r++) for (let c = 0; c < art[r].length; c++){
    const ch = art[r][c]; if (ch === '.') continue;
    g.fillStyle = ch === 'h' ? color : ch === 'H' ? dark : HPAL[ch];
    g.fillRect(x + c * s, y + r * s, s, s);
  }
}
function drawArtOut(g, art, x, y, s, color){
  g.fillStyle = '#2a2118';
  for (let r = 0; r < art.length; r++) for (let c = 0; c < art[r].length; c++){
    if (art[r][c] === '.') continue;
    g.fillRect(x + (c - 1) * s, y + r * s, s, s); g.fillRect(x + (c + 1) * s, y + r * s, s, s);
    g.fillRect(x + c * s, y + (r - 1) * s, s, s); g.fillRect(x + c * s, y + (r + 1) * s, s, s);
  }
  drawArt(g, art, x, y, s, color);
}

// ---------- 아이소메트릭 틀 ----------
/* 2026-09-14 저녁: 방을 두 배로 키웠다(400×260 → 640×420, 바닥 6×4 → 12×6칸). 아이들이 상을 많이 받아서
   상장 8 → 16(코르크판 12 + 액자 4), 바닥 8 → 16(유리 진열장 8 + 받침대 8), 급수 사다리 3 → 4.
   그림은 「Unpacking」류 아이소메트릭 도트를 참고했다 — 창문·커튼·코르크판·유리 진열장·화분·전등을 넣고,
   벽에 위아래 명암, 바닥에 창빛, 물건마다 윤곽과 그늘을 더했다. 칸(56×28)과 도트 크기는 모험단 방과 같다. */
// 캔버스는 방 테두리에 딱 맞춘다(512×396) — 검은 여백을 두지 않고 배경은 비워 둔다. 할머니 휴대폰에서 방이 최대한 크게 보이게(2026-09-14 밤).
const RW = 512, RH = 396, TW = 56, TH = 28, NI = 12, NJ = 6, FX = 172, FY = 154, WALLH = 136;
const CORNER = { x: FX, y: FY - TH / 2 }, WTOP = CORNER.y - WALLH;
const LWr = NI * (TW / 2), LWl = NJ * (TW / 2);
function tileXY(i, j){ return { x: FX + (i - j) * (TW / 2), y: FY + (i + j) * (TH / 2) }; }
// 벽 위의 자리 (u: 모서리에서 벽을 따라, v: 천장에서 아래로). d 는 벽에서 방 안쪽으로 나온 칸 수 — 가구 앞면
function wallXY(side, u, v, d){
  const k = d || 0;
  return side ? { x: CORNER.x + u - k * 28, y: WTOP + v + u / 2 + k * 14 } : { x: CORNER.x - u - 2 + k * 28, y: WTOP + v + u / 2 + k * 14 };
}
function prand(k){ let h = 2166136261; for (let i = 0; i < k.length; i++){ h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }
function isoTile(g, cx, cy, color, inset){
  const half = TW / 2 - (inset || 0);
  g.fillStyle = color;
  for (let k = 0; k < TH / 2; k++){
    const hw = (k < TH / 4 ? (k + 1) : (TH / 2 - k)) * 4 - (inset || 0);
    if (hw <= 0) continue;
    const hh = Math.min(hw, half);
    g.fillRect(Math.round(cx - hh), Math.round(cy - TH / 2 + k * 2), Math.round(hh * 2), 2);
  }
}
function isoTopD(g, cx, cy, hw, hh, col){
  g.fillStyle = col;
  for (let k = -hh; k < hh; k++){
    const w = Math.round(hw * (1 - Math.abs(k + 0.5) / hh));
    if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + k), w * 2, 1);
  }
}
function isoBandD(g, cx, cy, hw, hh, H, left, right, up){
  const base = cy - (up || 0);
  for (let dx = -hw; dx < hw; dx++){
    const edge = base + Math.round((hw - Math.abs(dx)) * (hh / hw));
    g.fillStyle = dx < 0 ? left : right;
    g.fillRect(Math.round(cx + dx), Math.round(edge - H), 1, H);
  }
}
function isoBoxD(g, cx, cy, hw, hh, H, top, left, right, up){
  isoBandD(g, cx, cy, hw, hh, H, left, right, up);
  isoTopD(g, cx, cy - (up || 0) - H, hw, hh, top);
}
// 벽면(또는 벽과 나란한 가구 앞면)에 붙은 네모 — 한 칸 폭 기둥을 벽 기울기대로 이어 붙인다
function wallRect(g, side, u, v, w, h, c, d){
  g.fillStyle = c;
  for (let du = 0; du < w; du++){ const p = wallXY(side, u + du, v, d); g.fillRect(Math.round(p.x), Math.round(p.y), 1, h); }
}
// 벽과 나란한 가구의 윗면 — u 구간 × 깊이(d0..d1) 평행사변형
function faceTop(g, side, u0, u1, v, d0, d1, c){
  g.fillStyle = c;
  const steps = Math.round((d1 - d0) * 28);
  for (let u = u0; u < u1; u++) for (let k = 0; k <= steps; k++){ const p = wallXY(side, u, v, d0 + k / 28); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
}
// 가구의 옆면(끝면) — u 한 자리에서 깊이 방향으로 펼친 면
function faceEnd(g, side, u, v, h, d0, d1, c){
  g.fillStyle = c;
  const steps = Math.round((d1 - d0) * 28);
  for (let k = 0; k <= steps; k++){ const p = wallXY(side, u, v, d0 + k / 28); g.fillRect(Math.round(p.x), Math.round(p.y), 1, h); }
}
// 벽면에 붙인 도트 그림 — 한 칸씩 벽 기울기대로 찍는다(왼쪽 벽은 거울처럼 뒤집히지만 건반·배지는 좌우가 거의 같다)
function wallArt(g, side, u, v, art, color, d){
  const dark = shade(color, -44);
  for (let r = 0; r < art.length; r++) for (let c = 0; c < art[r].length; c++){
    const ch = art[r][c]; if (ch === '.') continue;
    const p = wallXY(side, u + c, v + r, d);
    g.fillStyle = ch === 'h' ? color : ch === 'H' ? dark : HPAL[ch];
    g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
}
// 벽 물건의 누르는 자리(대략 네모) — 기울어진 만큼 아래로 늘린다
function wallHit(side, u, v, w, h, d){
  const a = wallXY(side, u, v, d), b = wallXY(side, u + w, v, d);
  return side ? { x0: a.x - 2, x1: b.x + 2, y0: a.y - 3, y1: b.y + h + 3 } : { x0: b.x - 2, x1: a.x + 3, y0: a.y - 3, y1: b.y + h + 3 };
}

// ---- 자리 ----
// 오른쪽 벽: 코르크판(12장 핀) + 금테 액자 4 · 유리 진열장(두 칸 × 4) — 왼쪽 벽: 창문 + 급수 사다리 4 — 바닥: 받침대 8
// 코르크판은 v 18 부터 — 위 띠(v 6~15)에 처음 해낸 것 별자리가 걸린다
const CORK = { u: 12, v: 18, w: 168, h: 70 };
const PINS = [0, 1, 2].flatMap(r => [0, 1, 2, 3].map(c => ({ u: CORK.u + 8 + c * 40, v: CORK.v + 3 + r * 22 })));
const PIN_W = 32, PIN_H = 20;
const FRAMES = [192, 228, 264, 300].map(u => ({ u, v: 14 }));
const FRAME_W = 30, FRAME_H = 22;
// 유리 진열장 — 깊이 반 칸(d 0.5). 한 칸이면 앞 아랫선이 벽 밑선보다 14px 내려가 바닥에 파묻힌 듯 보였다(부모가 잡음).
const SC = { u0: 196, u1: 292, v0: 62, v1: WALLH - 2, d: 0.5 };
const SC_SHELF = [SC.v0 + 3, SC.v0 + 37];                              // 두 칸의 윗선(칸 높이 32)
const SC_SLOTS = SC_SHELF.flatMap(v => [0, 1, 2, 3].map(q => ({ u: SC.u0 + 8 + q * 22, v: v + 14 })));
const WIN = { u: 10, v: 12, w: 56, h: 66 };
const LADDERS = [78, 102, 126, 150], LAD_V = 10, LAD_H = 78, LAD_W = 22;
const STANDS = [];
[[1.0, 1.5], [2.4, 1.5], [3.8, 1.5], [5.2, 1.5], [4.2, 4.5], [5.6, 4.5], [7.0, 4.5], [8.4, 4.5]]
  .forEach(([i, j]) => { const p = tileXY(i, j); STANDS.push({ x: Math.round(p.x), y: Math.round(p.y) }); });

// 학년도마다 벽지 무늬와 색조, 양탄자 무늬가 바뀐다 — 해를 넘겨 보는 재미
const WALLPAPERS = [
  { name: '민무늬', tint: '#e8dcc4' },
  { name: '세로줄', tint: '#e2e0cc' },
  { name: '물방울', tint: '#ecd9ce' },
  { name: '마름모', tint: '#dbe3cf' },
];
function wallDeco(style, u, v){
  if (style === 1) return u % 12 < 2 ? -9 : 0;
  if (style === 2) return (u % 14 === 6 || u % 14 === 8) && (v % 14 === 6 || v % 14 === 8) ? -6 : 0;
  if (style === 3){ const a = (u >> 1) % 8, b = (v >> 1) % 8; return (a === b || a + b === 7) ? -8 : 0; }
  return 0;
}
const PLANT = [
  '.......gg.......', '......gGGg......', '.....gGGGGg.....', '..gg.gGGgGg.gg..', '.gGGgGGgggGgGGg.', 'gGGGGGgGgGgGGGGg',
  '.gGGgGGgGgGGgGg.', '..ggGGGGGGGGgg..', '....gGGgggGg....', '.....gggggg.....', '......nNNn......', '.....nNNNNn.....',
  '.....nnnnnn.....', '.....nNNNNn.....', '.....nNNNNn.....', '......nnnn......',
];
const PPAL = { g: '#2f7a3e', G: '#5cb85c', n: '#a0522d', N: '#c8794a' };
function drawPlant(g, x, y){
  isoTile(g, x + 3, y + 8, 'rgba(40,24,10,.22)', 14);
  for (let r = 0; r < PLANT.length; r++) for (let c = 0; c < PLANT[r].length; c++){
    const ch = PLANT[r][c]; if (ch === '.') continue;
    g.fillStyle = '#1f2a1a'; g.fillRect(x + c * 2 - 1, y + r * 2 - 1, 4, 4);
  }
  for (let r = 0; r < PLANT.length; r++) for (let c = 0; c < PLANT[r].length; c++){
    const ch = PLANT[r][c]; if (ch === '.') continue;
    g.fillStyle = PPAL[ch]; g.fillRect(x + c * 2, y + r * 2, 2, 2);
  }
}
function drawFloorLamp(g, x, y, color){
  isoTile(g, x + 2, y + 2, 'rgba(40,24,10,.22)', 16);
  isoBoxD(g, x, y, 7, 4, 3, '#3a3634', '#2a2624', '#1c1a18', 0);
  g.fillStyle = '#4a4542'; g.fillRect(x - 1, y - 62, 2, 60);
  g.fillStyle = '#6b6562'; g.fillRect(x - 1, y - 62, 1, 60);
  for (let k = 0; k < 16; k++){ g.fillStyle = k % 4 === 0 ? shade(color, -30) : shade(color, k < 4 ? 20 : 0); g.fillRect(x - 8 - (k >> 1), y - 80 + k, 16 + k, 1); }
  g.fillStyle = '#2a2118'; g.fillRect(x - 16, y - 64, 32, 1);
}

// 껍데기(벽·창문·코르크판·진열장 몸통·마루·양탄자·화분)는 아이 색·학년도마다 한 번만 굽는다
const shells = {};
function shellCv(color, yr){
  const phase = dayPhase(), key = color + ':' + yr + ':' + phase;
  if (shells[key]) return shells[key];
  const style = ((yr % 4) + 4) % 4, paper = WALLPAPERS[style];
  const c = document.createElement('canvas');
  c.width = RW * 2; c.height = RH * 2;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(2, 0, 0, 2, 0, 0);
  // 벽 — 위는 밝고 아래로 갈수록 살짝 어둡다. 왼쪽 벽은 빛을 등진다
  [1, 0].forEach(side => {
    const len = side ? LWr : LWl, dim = side ? 0 : -16;
    for (let u = 0; u < len; u++) for (let v = 0; v < WALLH; v++){
      let base, d = 0;
      if (v < 4) base = v < 2 ? '#f6efe0' : '#d9c9a8';                                     // 천장 몰딩
      else if (v < 6) base = '#8a6440';
      else if (v < 96){ base = paper.tint; d = Math.round((prand('p' + side + ':' + (u >> 3) + ':' + (v >> 3)) - 0.5) * 6) + wallDeco(style, u, v) + Math.round(6 - v / 8); }   // 벽지
      else if (v < 100) base = v < 98 ? '#dcb27a' : '#9c6c42';                             // 징두리 윗몰딩
      else if (v >= WALLH - 6) base = '#4e3220';                                            // 굽도리
      else if (u % 28 < 2 || v === 100 || v === WALLH - 8) base = '#7d5434';                // 널 판 테
      else { base = '#a8764a'; d = (u >> 1) % 7 === 0 ? -6 : (u % 28 > 24 ? 6 : 0); }
      const p = wallXY(side, u, v);
      g.fillStyle = shade(base, d + dim); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  });
  for (let i = 0; i < 14; i++){                                                            // 모서리 그늘
    const a = (0.18 * (1 - i / 14)).toFixed(3);
    for (let v = 0; v < WALLH; v++){
      const pr = wallXY(1, i, v), pl = wallXY(0, i, v);
      g.fillStyle = 'rgba(40,24,10,' + a + ')';
      g.fillRect(Math.round(pr.x), Math.round(pr.y), 1, 1); g.fillRect(Math.round(pl.x), Math.round(pl.y), 1, 1);
    }
  }
  // 왼쪽 벽 — 창문과 커튼(아이 색)
  const W = WIN;
  wallRect(g, 0, W.u - 3, W.v - 3, W.w + 6, W.h + 6, '#f4ecd8');                           // 창틀
  wallRect(g, 0, W.u - 3, W.v - 3, W.w + 6, 1, '#fffaf0');
  // 하늘 — 낮은 파랑(위로 갈수록 짙다), 저녁은 주황→보라, 밤은 남색에 별과 달
  const SKY = { day: [[120, 178, 230], [210, 233, 245]], dusk: [[90, 60, 120], [255, 150, 90]], night: [[10, 16, 44], [30, 40, 80]] }[phase];
  for (let u = 0; u < W.w; u++) for (let v = 0; v < W.h; v++){
    const t = v / W.h, r = Math.round(SKY[0][0] + (SKY[1][0] - SKY[0][0]) * t), gg = Math.round(SKY[0][1] + (SKY[1][1] - SKY[0][1]) * t), b = Math.round(SKY[0][2] + (SKY[1][2] - SKY[0][2]) * t);
    const p = wallXY(0, W.u + u, W.v + v);
    g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  if (phase === 'night'){
    for (let n = 0; n < 26; n++){ const su = 3 + Math.floor(prand('sx' + n) * (W.w - 6)), sv = 3 + Math.floor(prand('sy' + n) * (W.h - 26)); wallRect(g, 0, W.u + su, W.v + sv, 1, 1, prand('sb' + n) < 0.3 ? '#ffffff' : '#c9d6ff'); }
    wallRect(g, 0, W.u + 38, W.v + 10, 8, 8, '#fff3c4'); wallRect(g, 0, W.u + 40, W.v + 9, 4, 1, '#fff3c4'); wallRect(g, 0, W.u + 40, W.v + 18, 4, 1, '#fff3c4');   // 달
    wallRect(g, 0, W.u + 37, W.v + 12, 1, 4, '#fff3c4'); wallRect(g, 0, W.u + 46, W.v + 12, 1, 4, '#fff3c4');
    wallRect(g, 0, W.u + 42, W.v + 12, 3, 3, '#f0e4b0');
  } else [[8, 14, 14], [30, 30, 18], [12, 44, 10]].forEach(([cu, cv, w]) => {              // 구름(저녁엔 분홍빛)
    const c1 = phase === 'dusk' ? '#ffd0c0' : '#ffffff', c2 = phase === 'dusk' ? '#f7c2b8' : '#f2f7ff', c3 = phase === 'dusk' ? '#e9b0b0' : '#e8f0fb';
    for (let k = 0; k < 3; k++) wallRect(g, 0, W.u + cu + k * 2, W.v + cv - k * 2, w - k * 4, 2 + (k === 1 ? 2 : 0), k === 2 ? c1 : c2);
    wallRect(g, 0, W.u + cu - 2, W.v + cv + 2, w + 4, 3, c3);
  });
  const tree = phase === 'day' ? ['#5e8b3f', '#4b7332'] : phase === 'dusk' ? ['#4a6a34', '#3a5528'] : ['#22342a', '#1a2a20'];
  wallRect(g, 0, W.u + 4, W.v + W.h - 10, 12, 10, tree[0]); wallRect(g, 0, W.u + 2, W.v + W.h - 6, 16, 6, tree[1]);   // 창밖 나무
  wallRect(g, 0, W.u + 28, W.v, 2, W.h, '#e9e0c9'); wallRect(g, 0, W.u, W.v + 32, W.w, 2, '#e9e0c9');                    // 창살
  wallRect(g, 0, W.u + 2, W.v + 2, 1, 20, 'rgba(255,255,255,.55)');                                                        // 유리 반사
  wallRect(g, 0, W.u - 5, W.v + W.h + 3, W.w + 10, 4, '#e2d4b6'); wallRect(g, 0, W.u - 5, W.v + W.h + 7, W.w + 10, 1, '#8a6440');   // 창턱
  wallRect(g, 0, W.u - 8, W.v - 8, W.w + 16, 2, '#6e4a2a'); wallRect(g, 0, W.u - 10, W.v - 9, 3, 4, '#c8962e'); wallRect(g, 0, W.u + W.w + 5, W.v - 9, 3, 4, '#c8962e');   // 커튼 봉
  [W.u - 7, W.u + W.w - 7].forEach(cu => {                                                 // 커튼 — 주름은 세로 명암
    for (let k = 0; k < 14; k++){ const f = k % 4; wallRect(g, 0, cu + k, W.v - 6, 1, W.h + 12, shade(color, f === 0 ? -34 : f === 2 ? 18 : -6)); }
    wallRect(g, 0, cu, W.v - 6, 14, 1, shade(color, 30));
    wallRect(g, 0, cu + 2, W.v + 30, 10, 3, shade(color, -50)); wallRect(g, 0, cu + 3, W.v + 30, 8, 1, '#ffd979');   // 묶는 끈
  });
  // 오른쪽 벽 — 코르크판
  wallRect(g, 1, CORK.u + 3, CORK.v + 3, CORK.w, CORK.h, 'rgba(40,24,10,.25)');
  wallRect(g, 1, CORK.u - 3, CORK.v - 3, CORK.w + 6, CORK.h + 6, '#6e4526');
  wallRect(g, 1, CORK.u - 3, CORK.v - 3, CORK.w + 6, 1, '#a07048');
  for (let u = 0; u < CORK.w; u++) for (let v = 0; v < CORK.h; v++){
    const n = prand('c' + u + ':' + v), p = wallXY(1, CORK.u + u, CORK.v + v);
    g.fillStyle = n < 0.12 ? '#b8905c' : n < 0.24 ? '#d9b07a' : '#caa068'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  // 오른쪽 벽 앞 — 유리 진열장 몸통 (물건과 유리는 살아서 그린다)
  const sc = SC, wood = '#8a5a34';
  faceTop(g, 1, sc.u0 - 3, sc.u1 + 6, WALLH, sc.d, sc.d + 0.3, 'rgba(40,24,10,.22)');        // 바닥에 깔리는 그림자
  faceTop(g, 1, sc.u0 - 3, sc.u1 + 3, sc.v0 - 2, 0, sc.d, 'rgba(40,24,10,.2)');
  // 옆면은 벽을 따라 멀리 있는 쪽(u1)이 보인다 — u0 쪽 옆면은 앞면 뒤에 숨는다(처음엔 u0 쪽만 그려서 옆이 뚫려 보였다)
  faceEnd(g, 1, sc.u1 + 2, sc.v0 - 2, sc.v1 - sc.v0 + 2, 0, sc.d, shade(wood, -40));
  faceEnd(g, 1, sc.u1 + 2, sc.v0 - 2, 1, 0, sc.d, shade(wood, -10));
  faceTop(g, 1, sc.u0 - 3, sc.u1 + 3, sc.v0 - 2, 0, sc.d, shade(wood, 26));
  faceTop(g, 1, sc.u0 - 3, sc.u1 + 3, sc.v0 - 2, sc.d - 0.06, sc.d, shade(wood, 50));
  wallRect(g, 1, sc.u0 - 3, sc.v0 - 2, sc.u1 - sc.u0 + 6, sc.v1 - sc.v0 + 2, shade(wood, -18), sc.d);     // 앞 틀
  wallRect(g, 1, sc.u0, sc.v0 + 1, sc.u1 - sc.u0, sc.v1 - sc.v0 - 5, '#d9c39c', sc.d);                    // 속 등판(밝은 나무)
  for (let u = 0; u < sc.u1 - sc.u0; u += 2) wallRect(g, 1, sc.u0 + u, sc.v0 + 1, 1, sc.v1 - sc.v0 - 5, 'rgba(120,80,40,.10)', sc.d);
  SC_SHELF.forEach(v => wallRect(g, 1, sc.u0, v + 30, sc.u1 - sc.u0, 2, shade(wood, -6), sc.d));            // 선반 판
  SC_SHELF.forEach(v => wallRect(g, 1, sc.u0, v + 32, sc.u1 - sc.u0, 1, shade(wood, -40), sc.d));
  wallRect(g, 1, sc.u0 - 3, sc.v1 - 4, sc.u1 - sc.u0 + 6, 4, shade(wood, -46), sc.d);                        // 밑단
  // 바닥 — 쪽마루. 결과 옹이, 판 이음
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++){
    const p = tileXY(i, j);
    isoTile(g, p.x, p.y, '#5a3a20', 0);
    const t = Math.floor(prand('f' + i + ':' + j) * 3) - 1;
    isoTile(g, p.x, p.y, shade((i + j) % 2 ? '#c99a62' : '#b8864f', t * 5 - j * 2), 1);
    g.fillStyle = shade('#a87644', -j * 2);
    g.fillRect(Math.round(p.x - 14), Math.round(p.y - 3), 12, 1); g.fillRect(Math.round(p.x + 2), Math.round(p.y + 2), 12, 1);
    if (prand('k' + i + ':' + j) < 0.18){ g.fillStyle = '#8a5a34'; g.fillRect(Math.round(p.x + (prand('kx' + i + j) - 0.5) * 20), Math.round(p.y + (prand('ky' + i + j) - 0.5) * 8), 2, 1); }
  }
  // 창빛 — 창을 바닥에 투영한 평행사변형. 바닥 좌표(i, j)로 판정해서 타일 격자를 따라 눕는다.
  // 창은 왼쪽 벽 u = W.u..W.u+W.w 에 있으니 j 는 그 범위(u/28), 빛은 방 안쪽(i)으로 들어오며 해가 비껴서 j 가 i 를 따라 밀린다.
  // 창살 자리(세로 창살 j, 가로 창살 i)에는 그늘 줄. (처음엔 화면 가로 띠를 쌓아서 바닥에 안 붙어 보였다 — 부모가 잡았다.)
  if (phase !== 'night'){                                                                  // 밤엔 창빛이 없다
    const j0 = W.u / 28, j1 = (W.u + W.w) / 28, jm = (W.u + 29) / 28, i0 = 0.12, i1 = 2.3, im = 1.25, skew = 0.32;
    const tint = phase === 'dusk' ? '255,200,150,' : '255,240,200,', gain = phase === 'dusk' ? 0.6 : 1;
    const box = [tileXY(i0, j0), tileXY(i1, j0 + i1 * skew), tileXY(i1, j1 + i1 * skew), tileXY(i0, j1)];
    const x0 = Math.floor(Math.min(...box.map(p => p.x))), x1 = Math.ceil(Math.max(...box.map(p => p.x)));
    const y0 = Math.floor(Math.min(...box.map(p => p.y))), y1 = Math.ceil(Math.max(...box.map(p => p.y)));
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2){
      const cx = x + 1, cy = y + 1;
      const i = ((cx - FX) / 28 + (cy - FY) / 14) / 2, j = ((cy - FY) / 14 - (cx - FX) / 28) / 2 - i * skew;
      if (i < i0 || i >= i1 || j < j0 || j >= j1) continue;
      const bar = Math.abs(j - jm) < 0.05 || Math.abs(i - im) < 0.05;
      const a = (bar ? 0.04 : 0.16) * gain * (1 - (i - i0) / (i1 - i0) * 0.55);
      g.fillStyle = 'rgba(' + tint + a.toFixed(3) + ')'; g.fillRect(x, y, 2, 2);
    }
    g.restore();
  }
  // 아이 색 양탄자 — 학년도 무늬
  const rug = tileXY(5.9, 3.1);
  for (let k = -27; k <= 27; k++){
    const hw = Math.round((1 - Math.abs(k) / 28) * 108);
    if (hw <= 0) continue;
    const edge = Math.abs(k) > 22;
    g.fillStyle = edge ? shade(color, -50) : shade(color, -18);
    g.fillRect(Math.round(rug.x - hw), Math.round(rug.y + k * 2), hw * 2, 2);
    if (edge) continue;
    if (style === 1 && k % 4 === 0){ g.fillStyle = shade(color, 10); g.fillRect(Math.round(rug.x - hw + 8), Math.round(rug.y + k * 2), hw * 2 - 16, 2); }
    if (style === 2) for (let x = -hw + 10; x < hw - 8; x += 14) if ((k + (x >> 2)) % 6 === 0){ g.fillStyle = shade(color, 22); g.fillRect(Math.round(rug.x + x), Math.round(rug.y + k * 2), 4, 2); }
    if (style === 3 && Math.abs(k) < 16){ const hw3 = Math.round((1 - Math.abs(k) / 16) * 60); g.fillStyle = (k & 2) ? shade(color, 8) : shade(color, -4); g.fillRect(Math.round(rug.x - hw3), Math.round(rug.y + k * 2), hw3 * 2, 2); }
    if (Math.abs(k) < 10){ const hw2 = Math.round((1 - Math.abs(k) / 10) * 40); g.fillStyle = shade(color, 16); g.fillRect(Math.round(rug.x - hw2), Math.round(rug.y + k * 2), hw2 * 2, 2); }
  }
  const pl = tileXY(0.6, 4.9); drawPlant(g, Math.round(pl.x - 16), Math.round(pl.y - 30));
  const lp = tileXY(11.2, 0.8); drawFloorLamp(g, Math.round(lp.x), Math.round(lp.y), phase === 'day' ? color : shade(color, 40));   // 저녁·밤엔 전등이 켜진다
  if (phase !== 'day'){                                                                    // 방 전체가 살짝 어둑해진다
    g.fillStyle = phase === 'dusk' ? 'rgba(90,40,20,.10)' : 'rgba(16,20,60,.22)';
    g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, RW, RH); g.globalCompositeOperation = 'source-over';
  }
  shells[key] = c;
  return c;
}
function drawFrame(g, f, n){
  const fc = ['#c8962e', '#8a5a34', '#b9bec7', '#c8962e'][n % 4];            // 금 · 나무 · 은 · 금 테
  wallRect(g, 1, f.u + 14, f.v - 4, 2, 4, '#5a4a3a');                        // 거는 줄
  wallRect(g, 1, f.u + 2, f.v + 2, FRAME_W, FRAME_H, 'rgba(40,24,10,.25)');  // 그림자
  wallRect(g, 1, f.u, f.v, FRAME_W, FRAME_H, shade(fc, -46));
  wallRect(g, 1, f.u + 2, f.v + 2, FRAME_W - 4, FRAME_H - 4, fc);
  wallRect(g, 1, f.u + 2, f.v + 2, FRAME_W - 4, 1, shade(fc, 30));
  wallRect(g, 1, f.u + 4, f.v + 4, FRAME_W - 8, FRAME_H - 8, '#fffaf0');   // 종이
  wallRect(g, 1, f.u + 10, f.v + 6, 10, 2, '#c8962e');                       // 제목 띠
  wallRect(g, 1, f.u + 6, f.v + 10, 18, 1, '#c9bca8');
  wallRect(g, 1, f.u + 6, f.v + 12, 18, 1, '#c9bca8');
  wallRect(g, 1, f.u + 6, f.v + 14, 10, 1, '#c9bca8');
  wallRect(g, 1, f.u + 18, f.v + 13, 4, 4, '#d4504a');                       // 붉은 도장
}
// 코르크판에 핀으로 꽂은 상장
function drawPinned(g, s, n){
  const pin = ['#d4504a', '#3a63b0', '#57b98a', '#ffd979'][n % 4];
  wallRect(g, 1, s.u + 2, s.v + 2, PIN_W, PIN_H, 'rgba(40,24,10,.28)');
  wallRect(g, 1, s.u, s.v, PIN_W, PIN_H, '#fffaf0');
  wallRect(g, 1, s.u, s.v + PIN_H - 1, PIN_W, 1, '#e4d9c3');
  wallRect(g, 1, s.u + 10, s.v + 4, 12, 2, '#c8962e');
  wallRect(g, 1, s.u + 5, s.v + 8, 22, 1, '#c9bca8'); wallRect(g, 1, s.u + 5, s.v + 10, 22, 1, '#c9bca8'); wallRect(g, 1, s.u + 5, s.v + 12, 14, 1, '#c9bca8');
  wallRect(g, 1, s.u + 23, s.v + 13, 4, 4, '#d4504a');
  wallRect(g, 1, s.u + PIN_W / 2 - 2, s.v - 1, 4, 3, shade(pin, -30)); wallRect(g, 1, s.u + PIN_W / 2 - 2, s.v - 1, 4, 1, shade(pin, 30)); wallRect(g, 1, s.u + PIN_W / 2 - 1, s.v - 1, 2, 2, pin);
}
function ladderTracks(all){
  // 급수는 쌓이는 것이라, 고른 학년도의 끝(다음 해 2월)까지 오른 곳을 보여 준다
  const end = year === 'all' ? '9999-12-31' : (Number(year) + 1) + '-02-31';
  const map = {};
  all.filter(r => r.kind === 'level' && r.track && r.got_on <= end).forEach(r => { (map[r.track] = map[r.track] || []).push(r); });
  return Object.keys(map).map(t => {
    const rs = map[t].slice().sort((a, b) => (a.step || 0) - (b.step || 0) || (a.got_on < b.got_on ? -1 : 1));
    return { track: t, rows: rs, top: Math.max(...rs.map(x => x.step || 1)), last: rs.reduce((m, x) => x.got_on > m ? x.got_on : m, '') };
  }).sort((a, b) => a.last < b.last ? 1 : -1);
}
function drawLadder(g, u, t){
  wallRect(g, 0, u + 2, LAD_V + 2, LAD_W, LAD_H, 'rgba(40,24,10,.22)');
  wallRect(g, 0, u, LAD_V, LAD_W, LAD_H, '#e7d4b0');
  wallRect(g, 0, u, LAD_V, 2, LAD_H, '#7a4f2d');
  wallRect(g, 0, u + LAD_W - 2, LAD_V, 2, LAD_H, '#7a4f2d');
  wallRect(g, 0, u, LAD_V, LAD_W, 3, '#5a3a22');
  wallRect(g, 0, u, LAD_V + LAD_H - 2, LAD_W, 2, '#5a3a22');
  // 아직 못 이룬 다음 목표가 있으면 그 칸까지 보이게 창을 한 칸 올린다
  const goal = goalOf(kid, t.track), pending = goal && !goalDone(goal, t.top) ? goal : null;
  const reach = pending ? Math.max(t.top, pending.step) : t.top;
  const n = Math.min(10, Math.max(7, reach)), first = Math.max(1, reach - n + 1);
  let col = LEVEL_COLOR;
  t.rows.forEach(x => { if ((x.step || 1) < first && x.color) col = x.color; });
  for (let k = 0; k < n; k++){
    const no = first + k, rec = t.rows.filter(x => (x.step || 1) === no && x.color).pop();
    if (rec) col = rec.color;
    const vy = LAD_V + LAD_H - 9 - k * 6, got = no <= t.top;
    wallRect(g, 0, u + 3, vy, LAD_W - 6, 4, got ? col : '#cdbd9f');
    if (got) wallRect(g, 0, u + 3, vy, LAD_W - 6, 1, shade(col, 34));
    if (no === t.top){ wallRect(g, 0, u - 2, vy - 3, 4, 4, '#ffd979'); wallRect(g, 0, u - 2, vy - 3, 2, 2, '#fff0b8'); }
    if (pending && no === pending.step){                              // 목표 칸 — 아이 색 깃발
      wallRect(g, 0, u + 3, vy, LAD_W - 6, 4, shade(KID_COLOR[kid], 40));
      wallRect(g, 0, u - 6, vy - 4, 2, 9, '#5a3a22');
      wallRect(g, 0, u - 12, vy - 4, 6, 4, KID_COLOR[kid]);
      wallRect(g, 0, u - 12, vy - 4, 6, 1, shade(KID_COLOR[kid], 40));
    }
  }
  // 징두리 판의 이름표 — 지금 단계의 건반 이름표나 배지. 이게 없으면 사다리가 문이나 책장으로 읽혔다
  const last = t.rows.filter(x => (x.step || 1) === t.top).pop() || t.rows[t.rows.length - 1];
  wallRect(g, 0, u + 1, 102, LAD_W - 2, 20, '#ead6b1');
  wallRect(g, 0, u + 1, 102, LAD_W - 2, 1, '#fff3da');
  wallRect(g, 0, u + 1, 121, LAD_W - 2, 1, '#6e4526');
  wallArt(g, 0, u + 3, 104, OBJ_ART[lookOf(last)] || OBJ_ART.piano, itemColor(last));
}
function drawStand(g, x, y, r){
  const look = lookOf(r), color = itemColor(r), cloth = CLOTH[prefOf(kid).cloth] || CLOTH.cream;
  isoTile(g, x + 2, y + 3, 'rgba(40,24,10,.3)', 10);
  isoBoxD(g, x, y, 12, 6, 14, cloth, shade(cloth, -22), shade(cloth, -50), 0);
  isoBandD(g, x, y, 12, 6, 2, '#8a5a34', '#6e4526', 12);
  isoBandD(g, x, y, 12, 6, 1, '#4e3220', '#3d2717', 0);
  if (look === 'star') isoTopD(g, x, y - 14, 8, 4, '#b8423c');
  drawArtOut(g, OBJ_ART[look] || OBJ_ART.star, x - 8, y - 32, 1, color);
  if (look === 'medal' || look === 'badge'){                       // 유리 덮개
    isoBandD(g, x, y, 11, 5, 22, 'rgba(210,235,255,.16)', 'rgba(180,215,245,.12)', 14);
    isoTopD(g, x, y - 36, 11, 5, 'rgba(225,242,255,.22)');
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 9, y - 30, 1, 12);
  }
}
// 진열장 물건 — 앞면(d=1)에 벽 기울기대로 세운다
function drawShowcaseItem(g, s, r){
  const art = OBJ_ART[lookOf(r)] || OBJ_ART.star;
  wallRect(g, 1, s.u + 1, s.v + 15, 16, 2, 'rgba(40,24,10,.3)', SC.d);
  for (let rr = 0; rr < art.length; rr++) for (let c = 0; c < art[rr].length; c++){       // 윤곽
    if (art[rr][c] === '.') continue;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dc, dr]) => { const p = wallXY(1, s.u + c + dc, s.v + rr + dr, SC.d); g.fillStyle = '#2a2118'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); });
  }
  wallArt(g, 1, s.u, s.v, art, itemColor(r), SC.d);
}
function drawShowcaseGlass(g){
  const w = SC.u1 - SC.u0, h = SC.v1 - SC.v0 - 5;
  wallRect(g, 1, SC.u0, SC.v0 + 1, w, h, 'rgba(210,235,255,.14)', SC.d);
  wallRect(g, 1, SC.u0 + 4, SC.v0 + 3, 2, h - 6, 'rgba(255,255,255,.35)', SC.d);
  wallRect(g, 1, SC.u0 + 8, SC.v0 + 3, 1, h - 6, 'rgba(255,255,255,.2)', SC.d);
  wallRect(g, 1, SC.u0 + w / 2 - 1, SC.v0 + 1, 2, h, 'rgba(120,80,40,.35)', SC.d);          // 문 사이 틀
  wallRect(g, 1, SC.u0 + w / 2 - 4, SC.v0 + 30, 2, 4, '#c8962e', SC.d); wallRect(g, 1, SC.u0 + w / 2 + 2, SC.v0 + 30, 2, 4, '#c8962e', SC.d);   // 손잡이
}
// ---------- 어깨띠 — 지금 맡은 직함 ----------
/* 방 위에 아이 색 어깨띠와 금박 글씨. 그 아래 임기 막대(시작 ~ 끝, 오늘 위치, 몇 개월째).
   직함이 둘이면 나란히(막대도 둘), 셋 이상이면 띠만. 임기가 끝나면 여기서 사라지고 벽의 역대 줄로 간다. */
const SASH_W = 480, SASH_H = 70;
const sashHits = { sua: [], yona: [] };
function drawSash(box, k){
  const cur = mineOf(k).filter(isCurrent).sort((a, b) => a.got_on < b.got_on ? -1 : 1).slice(0, 3);
  box.hidden = !cur.length; sashHits[k] = [];
  if (!cur.length) return;
  const cv = box.querySelector('canvas'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, SASH_W, SASH_H);
  const color = KID_COLOR[k], n = cur.length, slot = SASH_W / n, FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  cur.forEach((r, i) => {
    const cx = slot * i + slot / 2, cy = n === 1 ? 24 : 22, w = n === 1 ? 92 : n === 2 ? 76 : 60, sl = 0.2;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 70); gr.addColorStop(0, 'rgba(255,200,160,.5)'); gr.addColorStop(1, 'rgba(255,200,160,0)');
    g.fillStyle = gr; g.fillRect(cx - 70, cy - 70, 140, 140); g.restore();
    for (let d = -w; d <= w; d++){                                            // 띠 — 왼위에서 오른아래로
      const x = Math.round(cx + d), y = Math.round(cy + d * sl), edge = Math.abs(d) === w;
      g.fillStyle = '#2a2118'; g.fillRect(x, y - 10, 1, 1); g.fillRect(x, y + 9, 1, 1);
      g.fillStyle = edge ? '#2a2118' : shade(color, (d % 6 === 0) ? -14 : 0); g.fillRect(x, y - 9, 1, 18);
      if (!edge){ g.fillStyle = shade(color, 40); g.fillRect(x, y - 8, 1, 1); }
    }
    g.fillStyle = '#2a2118'; g.fillRect(Math.round(cx - w - 8), Math.round(cy - w * sl) - 12, 8, 2); g.fillRect(Math.round(cx + w), Math.round(cy + w * sl) + 8, 8, 2);   // 매듭 끝
    drawIcon(g, r.icon, Math.round(cx - w + 6), Math.round(cy - (w - 9) * sl) - 3, 1, { g: '#fff3c4', y: '#fff', b: '#fff', w: '#3a2410', r: '#fff' });
    g.save(); g.translate(cx, cy); g.rotate(Math.atan(sl));
    g.font = '900 ' + (n === 1 ? 13 : n === 2 ? 12 : 10) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(r.title, 1, 1); g.fillStyle = '#ffd979'; g.fillText(r.title, 0, 0);
    g.restore();
    sashHits[k].push({ r, x0: cx - w - 8, x1: cx + w + 8, y0: cy - w * sl - 12, y1: cy + w * sl + 12 });
    if (n <= 2){                                                                 // 임기 막대
      const t = termOf(r), bw = Math.min(200, slot - 40), bx = Math.round(cx - bw / 2), by = 52;
      g.fillStyle = '#2a2118'; g.fillRect(bx - 1, by - 1, bw + 2, 7);
      g.fillStyle = '#e8dcc4'; g.fillRect(bx, by, bw, 5);
      g.fillStyle = color; g.fillRect(bx, by, Math.round(bw * t.frac), 5);
      const mx = bx + Math.round(bw * t.frac);
      g.fillStyle = '#2a2118'; g.fillRect(mx - 1, by - 4, 3, 13); g.fillStyle = '#ffd979'; g.fillRect(mx, by - 3, 1, 11);
      g.font = '700 8px ' + FONT; g.textBaseline = 'top'; g.fillStyle = '#7a6a58';
      g.textAlign = 'left'; g.fillText(fmtDate(r.got_on), bx, by + 8); g.textAlign = 'right'; g.fillText(fmtDate(r.until), bx + bw, by + 8);
      g.textAlign = 'center'; g.fillStyle = '#2a2118'; g.font = '800 8px ' + FONT;
      g.fillText('오늘 · ' + t.monthsIn + '개월째' + (t.monthsLeft ? ' · ' + t.monthsLeft + '개월 남음' : ' · 마지막 달'), Math.max(bx + 40, Math.min(bx + bw - 40, mx)), by - 14);
    }
  });
  if (!cv.__wired){
    cv.__wired = true;
    const at = e => { const rc = cv.getBoundingClientRect(); if (!rc.width) return null; const x = (e.clientX - rc.left) / rc.width * SASH_W, y = (e.clientY - rc.top) / rc.height * SASH_H; return sashHits[k].find(h => x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1) || null; };
    cv.addEventListener('pointermove', e => { const h = at(e); cv.style.cursor = h ? 'pointer' : 'default'; if (h && e.pointerType === 'mouse') withKid(k, () => say(captionOf(h.r))); });
    cv.addEventListener('click', e => { const h = at(e); if (h) withKid(k, () => openItem(h.r)); });
  }
}

// 누를 수 있는 곳 — 그릴 때 함께 적어 둔다
let hits = [], hoverKey = null;
const hitsOf = { sua: [], yona: [] };
// 가장 최근 것의 자리(반짝임) — 그릴 때 적어 둔다
const sparkleOf = { sua: null, yona: null };
let sparklePhase = null;                          // null 이면 안 반짝임, 0..1 이면 그 만큼
// 처음 해낸 것 별자리 — 코르크판 위 벽지 띠(u 22~, v 7~11)에 화환처럼. 순서대로 이어서 하나의 별자리가 된다
// (처음엔 액자 아래 띠였는데, 그 자리는 역대 직함 줄에 내줬다)
const CONST_U0 = 24, CONST_STEP = 20, CONST_MAX = 8;
function constPos(n){ return { u: CONST_U0 + n * CONST_STEP, v: 10 + [0, -1, 1, 0, -1, 1, 0, -1][n % 8] }; }
// 역대 직함 줄 — 오른쪽 벽 액자 아래 띠(u 196~330, v 40~58). 지난 것은 작게, 지금 것은 크게 빛난다
const HALL = { u0: 200, u1: 330, v: 49 };
function drawHallBadge(g, u, v, r, big){
  const R = big ? 8 : 5, c = wallXY(1, u, v);
  const col = big ? '#e0a93b' : '#c8b28a', hi = big ? '#ffd979' : '#ddd0b0';
  for (let y = -R; y <= R; y++){ const hw = Math.round(Math.sqrt(R * R - y * y)); g.fillStyle = '#2a2118'; g.fillRect(Math.round(c.x - hw - 1), Math.round(c.y + y), hw * 2 + 2, 1); }
  for (let y = -R + 1; y <= R - 1; y++){ const hw = Math.round(Math.sqrt((R - 1) * (R - 1) - y * y)); g.fillStyle = y < -R / 2 ? hi : col; g.fillRect(Math.round(c.x - hw), Math.round(c.y + y), hw * 2, 1); }
  drawIcon(g, r.icon, Math.round(c.x - 3), Math.round(c.y - 3), 1, big ? { g: '#fff3c4', y: '#fff', b: '#fff', w: '#3a2410', r: '#fff' } : { g: '#5a3a22', y: '#5a3a22', b: '#5a3a22', w: '#e8dcc4', r: '#5a3a22' });
  return { x0: c.x - R - 2, x1: c.x + R + 2, y0: c.y - R - 2, y1: c.y + R + 2 };
}
function drawConstellation(g, firsts){
  const pts = firsts.map((r, n) => Object.assign({ r }, constPos(n)));
  for (let n = 1; n < pts.length; n++){                                   // 잇는 선 — 벽면 좌표로 보간
    const a = pts[n - 1], b = pts[n], steps = Math.max(Math.abs(b.u - a.u), Math.abs(b.v - a.v));
    for (let k = 0; k <= steps; k += 2){ const p = wallXY(1, a.u + (b.u - a.u) * k / steps, a.v + (b.v - a.v) * k / steps); g.fillStyle = 'rgba(255,225,140,.45)'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  }
  pts.forEach(pt => {
    wallRect(g, 1, pt.u - 2, pt.v, 5, 1, '#ffd979'); wallRect(g, 1, pt.u, pt.v - 2, 1, 5, '#ffd979');
    wallRect(g, 1, pt.u, pt.v, 1, 1, '#fff8dc');
    wallRect(g, 1, pt.u - 1, pt.v - 1, 1, 1, 'rgba(255,217,121,.5)'); wallRect(g, 1, pt.u + 1, pt.v + 1, 1, 1, 'rgba(255,217,121,.5)');
  });
  return pts;
}
function drawSparkle(g, x, y){
  const s = Math.sin(sparklePhase * Math.PI), L = Math.round(2 + 5 * s);
  if (L <= 0) return;
  g.fillStyle = '#ffffff';
  g.fillRect(x - L, y, L * 2 + 1, 1); g.fillRect(x, y - L, 1, L * 2 + 1);
  g.fillStyle = '#ffd979';
  const h = Math.max(1, L >> 1);
  g.fillRect(x - h, y - h, 1, 1); g.fillRect(x + h, y - h, 1, 1); g.fillRect(x - h, y + h, 1, 1); g.fillRect(x + h, y + h, 1, 1);
}
const hitKey = h => h.r ? (h.star ? 's' : h.hall ? 'h' : 'r') + h.r.id : 't' + h.t.track;
function drawMuseum(g, k){
  const color = KID_COLOR[k], all = mineOf(k), list = inYear(all);
  hits = [];
  g.clearRect(0, 0, RW, RH);
  g.drawImage(shellCv(color, roomYear()), 0, 0, RW, RH);
  const lamps = [], newest = list[0] ? list[0].id : null;
  sparkleOf[k] = null;
  const mark = (r, h) => { hits.push(h); if (r.id === newest) sparkleOf[k] = { x: Math.round((h.x0 + h.x1) / 2) + 6, y: Math.round(h.y0) + 4 }; };
  // 오른쪽 벽 — 상장: 최근 넷은 금테 액자에, 그 다음 열둘은 코르크판에 핀으로
  const papers = list.filter(r => r.kind === 'award' && lookOf(r) === 'paper');
  papers.slice(0, FRAMES.length).forEach((r, n) => {
    const f = FRAMES[n];
    drawFrame(g, f, n);
    mark(r, Object.assign({ r }, wallHit(1, f.u, f.v, FRAME_W, FRAME_H, 0)));
  });
  FRAMES.slice(papers.length).forEach(f => {                           // 아직 비어 있는 액자 자리 — 점선 테
    const c = 'rgba(110,70,36,.26)';
    for (let d = 0; d < FRAME_W; d += 6){ wallRect(g, 1, f.u + d, f.v, 2, 1, c); wallRect(g, 1, f.u + d, f.v + FRAME_H - 1, 2, 1, c); }
    for (let d = 0; d < FRAME_H; d += 5){ wallRect(g, 1, f.u, f.v + d, 2, 2, c); wallRect(g, 1, f.u + FRAME_W - 2, f.v + d, 2, 2, c); }
  });
  papers.slice(FRAMES.length, FRAMES.length + PINS.length).forEach((r, n) => {
    const s = PINS[n];
    drawPinned(g, s, n);
    mark(r, Object.assign({ r }, wallHit(1, s.u, s.v, PIN_W, PIN_H, 0)));
  });
  // 왼쪽 벽 — 급수 사다리
  ladderTracks(all).slice(0, LADDERS.length).forEach((t, n) => {
    const u = LADDERS[n];
    drawLadder(g, u, t);
    hits.push(Object.assign({ t }, wallHit(0, u - 2, LAD_V, LAD_W + 4, 112, 0)));
  });
  // 유리 진열장 — 메달·트로피·배지 여덟, 그 뒤는 바닥 받침대로
  const shelfy = list.filter(r => r.kind === 'award' && lookOf(r) !== 'paper');
  const cased = shelfy.slice(0, SC_SLOTS.length);
  cased.forEach((r, n) => {
    const s = SC_SLOTS[n];
    drawShowcaseItem(g, s, r);
    mark(r, Object.assign({ r, front: 1 }, wallHit(1, s.u - 2, s.v - 2, 20, 18, SC.d)));
  });
  drawShowcaseGlass(g);
  // 코르크판 위 띠 — 처음 해낸 것 별자리(받침대에도 있지만, 벽에서는 하나의 별자리로 이어진다)
  drawConstellation(g, list.filter(r => r.kind === 'first').slice(0, CONST_MAX)).forEach(pt => {
    hits.push(Object.assign({ r: pt.r, star: true }, wallHit(1, pt.u - 3, pt.v - 3, 7, 7, 0)));
  });
  // 액자 아래 띠 — 역대 직함. 오래된 것부터 작게, 지금 것은 맨 오른쪽에 크게(학년도 필터와 무관하게 전부)
  const titles = all.filter(r => r.kind === 'title' && r.until).slice().sort((a, b) => a.got_on < b.got_on ? -1 : 1);
  const past = titles.filter(r => !isCurrent(r)).slice(-6), cur = titles.filter(isCurrent);
  let hu = HALL.u0;
  past.forEach(r => { const h = drawHallBadge(g, hu, HALL.v, r, false); hits.push(Object.assign({ r, hall: true }, h)); hu += 16; });
  hu += past.length ? 6 : 0;
  cur.forEach((r, n) => {
    const u = Math.min(HALL.u1 - 10, hu + 8 + n * 22), c = wallXY(1, u, HALL.v);
    lamps.push([c.x, c.y, 22, 0.28]);
    const h = drawHallBadge(g, u, HALL.v, r, true); hits.push(Object.assign({ r, hall: true }, h));
    if (r.id === newest) sparkleOf[k] = { x: Math.round(c.x) + 8, y: Math.round(c.y) - 8 };
  });
  SC_SHELF.forEach(v => { const p = wallXY(1, SC.u0 + (SC.u1 - SC.u0) / 2, v + 10, SC.d); lamps.push([p.x, p.y, 46, 0.14]); });
  // 바닥 받침대 — 처음 해낸 것과 진열장에 못 들어간 메달·트로피
  const floor = list.filter(r => r.kind === 'first').concat(shelfy.slice(SC_SLOTS.length)).slice(0, STANDS.length);
  STANDS.map((p, n) => ({ p, r: floor[n] })).sort((a, b) => a.p.y - b.p.y).forEach(({ p, r }) => {
    if (!r){ isoTile(g, p.x, p.y, 'rgba(255,250,235,.07)', 12); return; }
    drawStand(g, p.x, p.y, r);
    mark(r, { r, x0: p.x - 15, x1: p.x + 15, y0: p.y - 40, y1: p.y + 8, front: p.y });
    lamps.push([p.x, p.y - 26, r.id === newest ? 44 : 24, r.id === newest ? 0.34 : 0.16]);
  });
  g.save();
  g.globalCompositeOperation = 'lighter';
  const lc = LAMP[prefOf(k).lamp] || LAMP.warm;                       // 아이가 고른 조명 색
  const ph = dayPhase(), lp = tileXY(11.2, 0.8); lamps.push([lp.x, lp.y - 72, ph === 'day' ? 40 : 70, ph === 'day' ? 0.10 : ph === 'dusk' ? 0.34 : 0.46]);
  lamps.forEach(L => {
    const grd = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], L[2]);
    grd.addColorStop(0, 'rgba(' + lc.join(',') + ',' + L[3] + ')');
    grd.addColorStop(1, 'rgba(' + lc.join(',') + ',0)');
    g.fillStyle = grd; g.fillRect(L[0] - L[2], L[1] - L[2], L[2] * 2, L[2] * 2);
  });
  g.restore();
  if (sparklePhase !== null && sparkleOf[k]) drawSparkle(g, sparkleOf[k].x, sparkleOf[k].y);
  hitsOf[k] = hits;
  const hv = hits.find(h => k + ':' + hitKey(h) === hoverKey);
  if (hv){
    g.strokeStyle = 'rgba(255,217,121,.95)'; g.lineWidth = 1;
    g.strokeRect(Math.round(hv.x0) + 0.5, Math.round(hv.y0) + 0.5, Math.round(hv.x1 - hv.x0), Math.round(hv.y1 - hv.y0));
  }
}
function drawRoom(k){
  const cv = $('#museum-' + (k || kid)); if (!cv) return;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(2, 0, 0, 2, 0, 0);
  withKid(k || kid, () => drawMuseum(g, k || kid));
}
function hitAt(e, k){
  const rc = $('#museum-' + k).getBoundingClientRect();
  if (!rc.width) return null;
  const x = (e.clientX - rc.left) / rc.width * RW, y = (e.clientY - rc.top) / rc.height * RH;
  // 앞에 그린 진열대가 이긴다
  return (hitsOf[k] || []).filter(h => x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1).sort((a, b) => (b.front || 0) - (a.front || 0))[0] || null;
}
// 마우스로 훑으면 누를 수 있는 것에 테가 둘리고 이름이 먼저 보인다(손가락에는 훑기가 없으니 누르기만)
function wireCanvas(cv, k){
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const h = hitAt(e, k), key = h ? k + ':' + hitKey(h) : null;
    if (key === hoverKey) return;
    hoverKey = key;
    cv.style.cursor = h ? 'pointer' : 'default';
    withKid(k, () => { if (h) say(h.r ? captionOf(h.r) : ladderCaption(h.t)); drawRoom(k); });
  });
  cv.addEventListener('pointerleave', () => { if (hoverKey){ hoverKey = null; drawRoom(k); } });
  cv.addEventListener('click', e => withKid(k, () => {
    const h = hitAt(e, k);
    if (!h){ say(''); return; }
    if (h.r){ openItem(h.r); return; }
    const shots = h.t.rows.filter(r => r.photo_url).slice().reverse();
    say(ladderCaption(h.t) + ' · ' + h.t.rows.map(r => r.title).join(' → '));
    if (shots.length) lightbox.open(shots.map(r => ({ media_url: r.photo_url, media_type: 'image', caption: captionOf(r) })), 0);
  }));
}
function ladderCaption(t){
  const g = goalOf(kid, t.track);
  return '🪜 ' + t.track + ' — 지금 ' + t.top + '단계' + (g ? (goalDone(g, t.top) ? ' · 🎯 목표 「' + g.goal + '」 이뤘어요!' : ' · 🎯 다음 목표 「' + g.goal + '」') : '');
}
// 한 가지 자랑을 바로 여는 주소 — 할머니께 「이거 봐요」 하고 보낼 수 있게
async function copyLink(r){
  const url = location.origin + location.pathname + '?who=' + (r.who === 'both' ? kid : r.who) + '&item=' + r.id;
  try { await navigator.clipboard.writeText(url); say('🔗 링크를 복사했어요 — ' + r.title); }
  catch (e) { say('🔗 ' + url); }
}
function openItem(r){
  const cap = captionOf(r);
  say(cap + (r.photo_url ? '' : ' — 사진은 아직 없어요'));
  if (r.photo_url) lightbox.open([{ media_url: r.photo_url, media_type: 'image', caption: cap }], 0);
}

// ---------- 화면 ----------
// 두 아이의 방을 위아래로 — 수아 아래에 연아. 구역마다 학년도 탭·방·도구·목록이 따로 있다.
function syncUrl(){
  const q = new URLSearchParams(location.search);
  q.delete('who'); q.delete('year'); q.delete('item');
  history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
}
function buildRoom(k){
  const sec = document.createElement('section');
  sec.className = 'honor-room ' + k; sec.dataset.kid = k;
  sec.innerHTML =
    '<div class="year-nav" role="group" aria-label="' + heroName(k) + ' 학년도"><button type="button" class="dot-btn small yPrev" aria-label="앞 학년도">◀</button><span class="year-label"></span><button type="button" class="dot-btn small yNext" aria-label="뒤 학년도">▶</button></div>' +
    '<div class="museum-card">' +
      '<h2 class="room-title"></h2>' +
      '<p class="sub room-sub"></p>' +
      '<div class="title-sash" hidden><canvas class="sash-cv" width="960" height="140" aria-label="지금 맡은 직함"></canvas></div>' +
      '<div class="museum-stage"><canvas class="museum" id="museum-' + k + '" width="1024" height="792"' +
        ' aria-label="' + heroName(k) + '의 업적 전시실. 오른쪽 벽에 상장 액자와 코르크판, 유리 진열장에 메달·트로피, 왼쪽 벽에 급수 사다리, 바닥 받침대에 처음 해낸 일이 있어요. 누르면 사진이 열려요."></canvas></div>' +
      '<p class="museum-msg" id="museumMsg-' + k + '" aria-live="polite"></p>' +
      '<div class="room-tools"></div>' +
      '<p class="room-paper"></p>' +
    '</div>' +
    '<div class="honor-list"></div>';
  // 비율은 스크립트가 직접 박는다 — HTML 만 옛것이 캐시되면 다른 비율 상자에 들어가 찌그러졌다(2026-09-14 밤, 폰에서 봄)
  const cv = sec.querySelector('canvas');
  cv.style.aspectRatio = RW + ' / ' + RH;
  wireCanvas(cv, k);
  return sec;
}
function render(){
  const note = $('#honorNote');
  note.hidden = !missing;
  note.textContent = missing ? '업적 전시실을 준비하는 중이에요. 곧 열려요.' : '';
  $('#adminBar').hidden = !isAdmin || missing;
  const box = $('#rooms');
  KIDS.forEach(k => {
    let sec = box.querySelector('.honor-room[data-kid="' + k + '"]');
    if (!sec){ sec = buildRoom(k); box.appendChild(sec); }
    withKid(k, () => renderRoom(sec, k));
  });
  syncUrl();
}
function renderRoom(sec, k){
  const q = sel => sec.querySelector(sel);
  const ys = yearsOf(mineOf(k));
  if (year !== 'all' && !ys.includes(Number(year))) year = yearOf[k] = 'all';
  // ◀ ▶ 로 학년도를 넘긴다 — 넘길 때 벽지가 바뀌는 게 탭보다 잘 보인다. 차례: 옛 학년도 → 새 학년도 → 전체
  const opts = ys.slice().reverse().map(String).concat('all'), at = Math.max(0, opts.indexOf(String(year)));
  const yn = q('.year-nav'); yn.hidden = ys.length < 1;
  q('.year-label').textContent = year === 'all' ? '전체' : year + '학년도';
  const go = d => { yearOf[k] = opts[(at + d + opts.length) % opts.length]; say('', k); render(); };
  q('.yPrev').onclick = () => go(-1); q('.yNext').onclick = () => go(1);
  const list = inYear(mineOf(k));
  const nA = list.filter(r => r.kind === 'award').length, nF = list.filter(r => r.kind === 'first').length;
  const nT = ladderTracks(mineOf(k)).length;
  q('.room-title').textContent = heroName(k) + '의 업적 전시실' + (year === 'all' ? '' : ' · ' + year + '학년도');
  // 셈은 한 줄, 안내는 그 아래 줄 — 폰에서 「액자…」가 어중간하게 접혔다
  q('.room-sub').innerHTML = '🏅 상장·메달 ' + nA + ' · 🪜 급수 ' + nT + '가지 · ⭐ 처음 해낸 것 ' + nF + '<br>액자·사다리·진열대를 누르면 사진이 열려요';
  const tools = q('.room-tools'); tools.innerHTML = '';
  if (!missing && list.length){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dot-btn small';
    b.textContent = '🖼 ' + (year === 'all' ? '전체' : year + '학년도') + ' 카드'; b.addEventListener('click', () => withKid(k, () => openYearCard(list)));
    tools.appendChild(b);
  }
  if (!missing && canEditKid(k)){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dot-btn small';
    b.textContent = '🎨 진열대 꾸미기'; b.addEventListener('click', () => withKid(k, openDecor));
    tools.appendChild(b);
  }
  q('.room-paper').textContent = missing ? '' : roomYear() + '학년도 벽지 · ' + WALLPAPERS[((roomYear() % 4) + 4) % 4].name;
  drawSash(q('.title-sash'), k);
  drawRoom(k);
  renderList(list, q('.honor-list'), k);
}
function renderList(list, box, k){
  box.innerHTML = '';
  if (missing) return;
  if (!list.length){
    const p = document.createElement('p'); p.className = 'honor-empty';
    p.textContent = year === 'all' ? heroName(k) + '의 자랑이 아직 없어요.' : year + '학년도에는 아직 없어요.';
    box.appendChild(p); return;
  }
  ['title', 'award', 'level', 'first'].forEach(kd => {
    const part = list.filter(r => r.kind === kd);
    if (!part.length) return;
    const sec = document.createElement('div'); sec.className = 'honor-group';
    const h = document.createElement('h3'); h.textContent = KIND_NAME[kd] + ' ';
    const n = document.createElement('span'); n.textContent = part.length; h.appendChild(n);
    if (kd === 'level'){
      // 급수는 종목끼리 모아 높은 단계부터 — 「피아노: 바이엘 → 체르니 100」이 한눈에
      const byTrack = {};
      part.forEach(r => { (byTrack[r.track] = byTrack[r.track] || []).push(r); });
      sec.appendChild(h);
      Object.keys(byTrack).forEach(t => {
        const rs = byTrack[t].slice().sort((a, b) => (b.step || 0) - (a.step || 0));
        const sub = document.createElement('p'); sub.className = 'track-head';
        sub.textContent = '🪜 ' + t + ' — 지금 ' + rs[0].title + (rs[0].step ? ' (' + rs[0].step + '단계)' : '') +
          (rs.length > 1 ? ' · ' + rs.slice().reverse().map(r => r.title).join(' → ') : '');
        // 다음 목표 — 아이가 적어 둔 것. 그 단계가 올라오면 「이뤘어요」
        const top = mineOf(k).filter(r => r.kind === 'level' && r.track === t).reduce((m, r) => Math.max(m, r.step || 1), 0);
        const g = goalOf(k, t), goalP = document.createElement('p'); goalP.className = 'goal-line';
        goalP.textContent = g ? (goalDone(g, top) ? '🎯 목표 「' + g.goal + '」 이뤘어요! ' : '🎯 다음 목표: ' + g.goal + ' (' + g.step + '단계) ') : (canEditKid(k) ? '🎯 다음 목표를 아직 안 정했어요 ' : '');
        if (canEditKid(k)){
          const gb = document.createElement('button'); gb.type = 'button'; gb.className = 'goal-btn';
          gb.textContent = g ? (goalDone(g, top) ? '새 목표 정하기' : '목표 고치기') : '목표 정하기';
          gb.addEventListener('click', () => withKid(k, () => openGoal(t, top, g && !goalDone(g, top) ? g : null)));
          goalP.appendChild(gb);
        }
        const grid = document.createElement('div'); grid.className = 'honor-grid';
        rs.forEach(r => grid.appendChild(cardOf(r, k)));
        sec.append(sub);
        if (goalP.textContent) sec.append(goalP);
        sec.append(grid);
      });
      box.appendChild(sec);
      return;
    }
    const grid = document.createElement('div'); grid.className = 'honor-grid';
    part.forEach(r => grid.appendChild(cardOf(r, k)));
    sec.append(h, grid); box.appendChild(sec);
  });
}
function cardOf(r, k){
  const el = document.createElement('div'); el.className = 'dot-card honor-card';
  const pic = document.createElement('button');
  pic.type = 'button'; pic.className = 'pic'; pic.setAttribute('aria-label', r.title + ' 크게 보기');
  if (r.thumb_url || r.photo_url){ const im = document.createElement('img'); im.loading = 'lazy'; im.alt = ''; im.src = r.thumb_url || r.photo_url; pic.appendChild(im); }
  const cv = document.createElement('canvas'); cv.width = 36; cv.height = 36; cv.className = 'mark';
  const cg = cv.getContext('2d'); cg.imageSmoothingEnabled = false;
  drawArtOut(cg, OBJ_ART[lookOf(r)] || OBJ_ART.star, 2, 2, 2, r.kind === 'title' ? KID_COLOR[k] : itemColor(r));
  if (r.kind === 'title') drawIcon(cg, r.icon, 20, 4, 2);
  pic.appendChild(cv);
  pic.addEventListener('click', () => withKid(k, () => openItem(r)));
  const body = document.createElement('div'); body.className = 'txt';
  const b = document.createElement('b'); b.textContent = (r.kind === 'level' ? r.track + ' ' : '') + r.title;
  const sm = document.createElement('small');
  sm.textContent = r.kind === 'title'
    ? [r.org, fmtDate(r.got_on) + ' ~ ' + fmtDate(r.until), isCurrent(r) ? '임기 중' : '임기 끝', r.who === 'both' ? '둘이 함께' : ''].filter(Boolean).join(' · ')
    : [r.kind === 'level' && r.step ? r.step + '단계' : '', r.org, fmtDate(r.got_on), r.who === 'both' ? '둘이 함께' : ''].filter(Boolean).join(' · ');
  if (r.kind === 'title' && isCurrent(r)) el.classList.add('now');
  body.append(b, sm);
  const s = sayOf(r, k);
  if (s){ const p = document.createElement('p'); p.className = 'say'; p.textContent = '“' + s + '”'; body.appendChild(p); }
  if (r.audio_url){                                                  // 그날의 소감 목소리
    const vb = document.createElement('div'); vb.className = 'honor-voice';
    mountVoice(vb, r.audio_url, r.audio_secs, isAdmin ? { table: 'honors', id: r.id } : null);
    body.appendChild(vb);
  }
  const acts = document.createElement('div'); acts.className = 'acts';
  const act = (t, fn, cls) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = t; if (cls) x.className = cls; x.addEventListener('click', () => withKid(k, fn)); acts.appendChild(x); return x; };
  const mine = isChild && me && me.author_key === k && (r.who === k || r.who === 'both');
  const n = claps[r.id] || 0, did = clapped(r.id);
  const cb = act('👏 ' + (n ? n : '박수'), () => clap(r, cb), 'clap' + (did ? ' did' : ''));
  cb.disabled = did; cb.title = did ? '이 자랑에는 박수를 보냈어요' : '박수 보내기';
  act('🔗 링크', () => copyLink(r));
  if (isAdmin) act('✎ 고치기', () => openForm(r));
  if (mine) act('💬 한마디', () => openSay(r));
  if (mine || isAdmin) act(r.audio_url ? '🎙 목소리 바꾸기' : '🎙 목소리', () => openVoice(r));
  if (acts.children.length) body.appendChild(acts);
  el.append(pic, body);
  return el;
}

// ---------- 모자이크 편집기 ----------
/* 가릴 곳을 끌어서 네모로 고른다. 화면에는 고른 곳의 테를 그려 보여 주지만, 올리는 사본은
   테 없이 새로 굽는다. 모자이크는 고른 곳을 아주 작게 줄였다가 도트 그대로 키우는 것.
   한 칸은 「사진 긴 변의 1/64(굵게 1/36)」와 「고른 네모 짧은 변의 1/3(굵게 1/2)」 중 큰 쪽이라,
   글줄에 맞춰 네모를 그리면 그 줄이 세 칸 높이로 뭉개진다.
   (처음엔 긴 변 기준만 두고 「이름이 한두 칸으로 뭉개진다」고 적었는데, 96px 글씨는 다섯 칸 높이였다 — 재 보고 고쳤다.) */
function mosaicEditor(stage, onChange){
  let base = null, view = null, regions = [], drag = null, mode = 'mid';
  const norm = d => ({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) });
  function apply(g, r){
    const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
    const w = Math.min(base.width - x, Math.round(r.w)), h = Math.min(base.height - y, Math.round(r.h));
    if (w < 2 || h < 2) return;
    if (r.mode === 'fill'){ g.fillStyle = '#3b332b'; g.fillRect(x, y, w, h); return; }
    const long = Math.max(base.width, base.height), strong = r.mode === 'strong';
    const b = Math.max(6, Math.round(long / (strong ? 36 : 64)), Math.ceil(Math.min(w, h) / (strong ? 2 : 3)));
    const sw = Math.max(1, Math.ceil(w / b)), sh = Math.max(1, Math.ceil(h / b));
    const t = document.createElement('canvas'); t.width = sw; t.height = sh;
    const tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
    tg.drawImage(base, x, y, w, h, 0, 0, sw, sh);
    g.imageSmoothingEnabled = false;
    g.drawImage(t, 0, 0, sw, sh, x, y, w, h);
  }
  function clean(){
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const g = c.getContext('2d'); g.drawImage(base, 0, 0);
    regions.forEach(r => apply(g, r));
    return c;
  }
  function paint(){
    const g = view.getContext('2d');
    g.drawImage(clean(), 0, 0);
    const lw = Math.max(2, Math.round(Math.max(base.width, base.height) / 400));
    g.lineWidth = lw;
    regions.forEach(r => { g.strokeStyle = 'rgba(255,217,121,.9)'; g.strokeRect(r.x, r.y, r.w, r.h); });
    if (drag){ const r = norm(drag); g.fillStyle = 'rgba(255,217,121,.22)'; g.fillRect(r.x, r.y, r.w, r.h); g.strokeStyle = '#ffd979'; g.strokeRect(r.x, r.y, r.w, r.h); }
    if (onChange) onChange(regions.length);
  }
  const pos = e => { const rc = view.getBoundingClientRect(); return { x: (e.clientX - rc.left) / rc.width * view.width, y: (e.clientY - rc.top) / rc.height * view.height }; };
  function setImage(img){
    const long = Math.max(img.naturalWidth, img.naturalHeight), sc = Math.min(1, PHOTO_DIM / long);
    const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
    base = document.createElement('canvas'); base.width = w; base.height = h;
    base.getContext('2d').drawImage(img, 0, 0, w, h);
    view = document.createElement('canvas'); view.width = w; view.height = h; view.className = 'mz-cv';
    view.setAttribute('aria-label', '가릴 곳을 끌어서 네모로 고르는 사진');
    stage.innerHTML = ''; stage.appendChild(view);
    regions = []; drag = null;
    view.addEventListener('pointerdown', e => { e.preventDefault(); try { view.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 되는 브라우저는 그냥 따라간다 */ } const p = pos(e); drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; paint(); });
    view.addEventListener('pointermove', e => { if (!drag) return; const p = pos(e); drag.x1 = p.x; drag.y1 = p.y; paint(); });
    const end = () => { if (!drag) return; const r = norm(drag); drag = null; if (r.w >= 6 && r.h >= 6) regions.push(Object.assign(r, { mode })); paint(); };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
    paint();
  }
  // 한도를 넘어도 막지 않는다 — 화질을 낮추고, 그래도 넘으면 크기를 줄여서 반드시 한도 안에 넣는다
  async function jpeg(c, limit){
    const enc = (cv, q) => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    let cv = c, q = 0.88, blob = await enc(cv, q);
    while (blob && blob.size > limit && q > 0.5){ q -= 0.08; blob = await enc(cv, q); }
    while (blob && blob.size > limit && Math.max(cv.width, cv.height) > 480){
      const t = document.createElement('canvas');
      t.width = Math.max(1, Math.round(cv.width * 0.85)); t.height = Math.max(1, Math.round(cv.height * 0.85));
      const tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
      tg.drawImage(cv, 0, 0, t.width, t.height);
      cv = t; blob = await enc(cv, 0.72);
    }
    return blob;
  }
  return {
    setImage,
    has: () => !!base,
    count: () => regions.length,
    setMode: m => { mode = m; },
    undo: () => { regions.pop(); if (base) paint(); },
    clear: () => { regions = []; if (base) paint(); },
    async blobs(){
      const c = clean();
      const main = await jpeg(c, PHOTO_LIMIT);
      const sc = Math.min(1, THUMB_LONG / Math.max(c.width, c.height));
      const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * sc)); t.height = Math.max(1, Math.round(c.height * sc));
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      const th = await jpeg(t, 200 * 1024);
      return { main, th };
    },
  };
}
async function uploadPhoto(bl){
  const stem = 'suayona/honor/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const path = stem + '.jpg', tpath = stem + '.thumb.jpg';
  const up = await sb.storage.from(MEDIA_BUCKET).upload(path, new File([bl.main], 'honor.jpg', { type: 'image/jpeg' }));
  if (up.error) throw up.error;
  const ut = bl.th ? await sb.storage.from(MEDIA_BUCKET).upload(tpath, new File([bl.th], 'honor.thumb.jpg', { type: 'image/jpeg' })) : { error: true };
  return {
    url: sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl,
    turl: ut.error ? null : sb.storage.from(MEDIA_BUCKET).getPublicUrl(tpath).data.publicUrl,
    paths: ut.error ? [path] : [path, tpath],
  };
}
async function dropFiles(paths){
  const ok = paths.filter(Boolean);
  if (!ok.length) return;
  try { await sb.storage.from(MEDIA_BUCKET).remove(ok); } catch (e) { /* 파일 정리는 못 해도 글은 이미 바뀌었다 */ }
}

// ---------- 부모: 올리기 · 고치기 ----------
function openForm(r){
  const v = r || { who: kid, kind: 'award', look: 'paper', title: '', org: '', got_on: todayStr(), track: '', step: null, color: '', say_sua: '', say_yona: '' };
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  const tracks = [...new Set(rows.filter(x => x.kind === 'level').map(x => x.track))];
  overlay.innerHTML =
    '<div class="modal-box dot-card honor-form"><div class="inner">' +
      '<h3>' + (r ? '✎ 자랑 고치기' : '＋ 자랑 올리기') + '</h3>' +
      '<div class="row2">' +
        '<div><label class="field">누구</label><select class="fWho" aria-label="누구"><option value="sua">수아</option><option value="yona">연아</option><option value="both">둘이 함께</option></select></div>' +
        '<div><label class="field">종류</label><select class="fKind" aria-label="종류"><option value="award">상장·메달</option><option value="level">급수</option><option value="first">처음 해낸 것</option><option value="title">직함 (임기가 있는 것)</option></select></div>' +
      '</div>' +
      '<label class="field">모양</label><select class="fLook" aria-label="모양"></select>' +
      '<div class="fLevel">' +
        '<div class="row2">' +
          '<div><label class="field">종목</label><input type="text" class="fTrack" list="honorTracks" maxlength="20" placeholder="예: 피아노" aria-label="종목">' +
            '<datalist id="honorTracks">' + tracks.map(t => '<option value="' + escapeHTML(t) + '">').join('') + '</datalist></div>' +
          '<div><label class="field">몇 번째 단계</label><input type="number" class="fStep" min="1" max="99" aria-label="몇 번째 단계"></div>' +
        '</div>' +
        '<label class="field">단계 색</label><input type="color" class="fColor" aria-label="색">' +
      '</div>' +
      '<div class="fTitleW row2">' +
        '<div><label class="field">아이콘</label><select class="fIcon" aria-label="아이콘">' + Object.keys(ICON_NAME).map(i => '<option value="' + i + '">' + ICON_NAME[i] + '</option>').join('') + '</select></div>' +
        '<div><label class="field">임기 끝</label><input type="date" class="fUntil" aria-label="임기 끝"></div>' +
      '</div>' +
      '<label class="field fTitleL">제목</label><input type="text" class="fTitle" maxlength="60" aria-label="제목">' +
      '<div class="fOrgW"><label class="field">주는 곳 (선택)</label><input type="text" class="fOrg" maxlength="40" aria-label="주는 곳" placeholder="예: 줄넘기 학원"></div>' +
      '<label class="field fDateL">받은 날</label><input type="date" class="fDate" aria-label="받은 날">' +
      '<div class="fSayW-sua"><label class="field">수아의 한마디 (선택)</label><input type="text" class="fSaySua" maxlength="80" aria-label="수아의 한마디"></div>' +
      '<div class="fSayW-yona"><label class="field">연아의 한마디 (선택)</label><input type="text" class="fSayYona" maxlength="80" aria-label="연아의 한마디"></div>' +
      '<label class="field">사진 (선택)</label>' +
      '<div class="photo-now"></div>' +
      '<input type="file" class="fFile" accept="image/*" aria-label="사진 고르기">' +
      '<div class="mosaic" hidden>' +
        '<p class="mz-help">이름·학교·반·선생님 이름처럼 가릴 곳을 <b>끌어서 네모</b>로 골라요. 가린 사본만 올라가고 원본은 이 기기 밖으로 안 나가요.</p>' +
        '<div class="mz-stage"></div>' +
        '<div class="mz-bar">' +
          '<select class="mzMode" aria-label="가리는 방법"><option value="mid">모자이크</option><option value="strong">굵은 모자이크</option><option value="fill">칠해서 가리기</option></select>' +
          '<button type="button" class="dot-btn small mzUndo">↶ 되돌리기</button>' +
          '<button type="button" class="dot-btn small mzClear">모두 지우기</button>' +
          '<span class="mz-count"></span>' +
        '</div>' +
      '</div>' +
      '<p class="msg fMsg" aria-live="polite"></p>' +
      '<div class="modal-actions">' +
        (r ? '<button type="button" class="dot-btn fDel">삭제</button>' : '') +
        '<button type="button" class="dot-btn fCancel">취소</button>' +
        '<button type="button" class="dot-btn primary fSave">저장</button>' +
      '</div>' +
    '</div></div>';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const q = s => overlay.querySelector(s);
  const close = () => { overlay.remove(); document.body.style.overflow = ''; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  q('.fCancel').addEventListener('click', close);

  q('.fWho').value = v.who; q('.fKind').value = v.kind;
  q('.fTitle').value = v.title || ''; q('.fOrg').value = v.org || ''; q('.fDate').value = v.got_on || todayStr();
  q('.fTrack').value = v.track || ''; q('.fStep').value = v.step || ''; q('.fColor').value = /^#[0-9a-f]{6}$/i.test(v.color || '') ? v.color : LEVEL_COLOR;
  q('.fSaySua').value = v.say_sua || ''; q('.fSayYona').value = v.say_yona || '';
  q('.fIcon').value = v.icon || 'crown'; q('.fUntil').value = v.until || '';
  const sync = () => {
    const kd = q('.fKind').value, cur = q('.fLook').value || v.look;
    q('.fLook').innerHTML = Object.keys(LOOK).filter(l => LOOK[l].kind === kd).map(l => '<option value="' + l + '">' + LOOK[l].name + '</option>').join('');
    if (LOOK[cur] && LOOK[cur].kind === kd) q('.fLook').value = cur;
    q('.fLevel').hidden = kd !== 'level';
    q('.fTitleW').hidden = kd !== 'title';
    q('.fOrgW').hidden = kd === 'first';
    q('.fTitleL').textContent = kd === 'level' ? '단계 이름 (예: 체르니 100, 5급)' : kd === 'first' ? '해낸 일 (예: 두발자전거 혼자 타기)' : kd === 'title' ? '직함 (예: 전교회장, 반장)' : '상 이름 (예: 줄넘기 대회 은상)';
    q('.fDateL').textContent = kd === 'title' ? '시작한 날' : '받은 날';
    if (kd === 'title' && !q('.fUntil').value) q('.fUntil').value = untilDefault(q('.fDate').value);   // 임기 끝은 그 학년도 2월 말로 미리
    const w = q('.fWho').value;
    q('.fSayW-sua').hidden = w === 'yona'; q('.fSayW-yona').hidden = w === 'sua';
  };
  q('.fKind').addEventListener('change', sync); q('.fWho').addEventListener('change', sync);
  sync();
  // 새 급수는 그 종목의 다음 단계를 먼저 채워 둔다
  q('.fTrack').addEventListener('change', () => {
    if (r || q('.fStep').value) return;
    const w = q('.fWho').value, t = q('.fTrack').value.trim();
    const same = rows.filter(x => x.kind === 'level' && x.track === t && (x.who === w || x.who === 'both' || w === 'both'));
    if (!same.length) return;
    const top = same.reduce((a, x) => (x.step || 0) > (a.step || 0) ? x : a, same[0]);
    q('.fStep').value = (top.step || 0) + 1;
    if (top.color) q('.fColor').value = top.color;
  });

  // 사진
  const mz = mosaicEditor(q('.mz-stage'), n => { q('.mz-count').textContent = n ? '가린 곳 ' + n + '군데' : '아직 가린 곳이 없어요'; });
  let removePhoto = false;
  const now = q('.photo-now');
  if (r && r.photo_url){
    now.innerHTML = '<img alt="지금 올라가 있는 사진">' +
      '<label><input type="checkbox" class="fNoPhoto"> 사진 빼기</label>' +
      '<button type="button" class="dot-btn small fReMask">이 사진 다시 가리기</button>';
    now.querySelector('img').src = r.thumb_url || r.photo_url;
    now.querySelector('.fNoPhoto').addEventListener('change', e => { removePhoto = e.target.checked; });
    now.querySelector('.fReMask').addEventListener('click', async e => {
      e.target.disabled = true; q('.fMsg').textContent = '사진을 불러오는 중…';
      try {
        const got = await loadImageFromUrl(r.photo_url);
        mz.setImage(got.img); got.done();
        q('.mosaic').hidden = false; q('.fMsg').textContent = '';
      } catch (err) { q('.fMsg').textContent = '사진을 불러오지 못했어요: ' + err.message; e.target.disabled = false; }
    });
  }
  q('.fFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try { mz.setImage(await loadImage(url)); q('.mosaic').hidden = false; q('.fMsg').textContent = ''; }
    catch (err) { q('.fMsg').textContent = '이 파일은 사진으로 읽지 못했어요.'; }
    finally { URL.revokeObjectURL(url); }
  });
  q('.mzMode').addEventListener('change', e => mz.setMode(e.target.value));
  q('.mzUndo').addEventListener('click', () => mz.undo());
  q('.mzClear').addEventListener('click', () => mz.clear());

  q('.fSave').addEventListener('click', async () => {
    const msg = q('.fMsg'), kd = q('.fKind').value, who = q('.fWho').value;
    const title = q('.fTitle').value.trim(), got_on = q('.fDate').value, track = q('.fTrack').value.trim();
    const step = parseInt(q('.fStep').value, 10);
    if (!title){ msg.textContent = '제목을 적어 주세요.'; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(got_on)){ msg.textContent = '받은 날을 골라 주세요.'; return; }
    if (kd === 'level' && !track){ msg.textContent = '급수는 종목을 적어 주세요 (예: 피아노).'; return; }
    if (kd === 'level' && !(step >= 1 && step <= 99)){ msg.textContent = '몇 번째 단계인지 숫자로 적어 주세요.'; return; }
    const until = q('.fUntil').value;
    if (kd === 'title' && !/^\d{4}-\d{2}-\d{2}$/.test(until)){ msg.textContent = '임기가 끝나는 날을 골라 주세요.'; return; }
    if (kd === 'title' && until < got_on){ msg.textContent = '임기 끝이 시작한 날보다 앞이에요.'; return; }
    if (mz.has() && !mz.count() && !confirm('가린 곳 없이 그대로 올릴까요? 이름·학교·반이 보이지 않는지 한 번 더 봐 주세요.')) return;
    const btn = q('.fSave'); btn.disabled = true; msg.textContent = '저장하는 중…';
    let photo = { url: r ? r.photo_url : null, turl: r ? r.thumb_url : null }, fresh = [], drop = [];
    try {
      if (mz.has()){
        const up = await uploadPhoto(await mz.blobs());
        fresh = up.paths; photo = { url: up.url, turl: up.turl };
        if (r) drop = [pathOfUrl(r.photo_url), pathOfUrl(r.thumb_url)];
      } else if (r && removePhoto){
        drop = [pathOfUrl(r.photo_url), pathOfUrl(r.thumb_url)]; photo = { url: null, turl: null };
      }
      const row = {
        who, kind: kd, look: q('.fLook').value, title, org: kd === 'first' ? null : (q('.fOrg').value.trim() || null), got_on,
        track: kd === 'level' ? track : null, step: kd === 'level' ? step : null, color: kd === 'level' ? q('.fColor').value : null,
        icon: kd === 'title' ? q('.fIcon').value : null, until: kd === 'title' ? until : null,
        photo_url: photo.url, thumb_url: photo.turl,
        say_sua: who === 'yona' ? null : (q('.fSaySua').value.trim() || null),
        say_yona: who === 'sua' ? null : (q('.fSayYona').value.trim() || null),
      };
      // 막힌 고치기는 오류 없이 0줄로 끝난다 — 돌려받은 줄 수로 확인한다
      const res = r ? await sb.from('honors').update(row).eq('id', r.id).select('id') : await sb.from('honors').insert(row).select('id');
      if (res.error || !(res.data && res.data.length)) throw res.error || new Error('저장 권한이 없어요');
    } catch (err) {
      await dropFiles(fresh);
      msg.textContent = '저장하지 못했어요: ' + readableError(err);
      btn.disabled = false;
      return;
    }
    await dropFiles(drop);
    close();
    await load();
    say('저장했어요.', who === 'both' ? 'sua' : who);
  });
  if (r) q('.fDel').addEventListener('click', async () => {
    if (!confirm('「' + r.title + '」을(를) 전시실에서 뺄까요? 사진도 함께 지워져요.')) return;
    const res = await sb.from('honors').delete().eq('id', r.id).select('id');
    if (res.error || !(res.data && res.data.length)){ q('.fMsg').textContent = '지우지 못했어요: ' + readableError(res.error || new Error('권한이 없어요')); return; }
    await dropFiles([pathOfUrl(r.photo_url), pathOfUrl(r.thumb_url), pathOfUrl(r.audio_url)]);
    close();
    await load();
    say('전시실에서 뺐어요.', r.who === 'both' ? 'sua' : r.who);
  });
}

// ---------- 아이: 한마디 ----------
function openSay(r){
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.innerHTML =
    '<div class="modal-box dot-card"><div class="inner">' +
      '<h3>💬 한마디</h3>' +
      '<p class="msg" style="margin:0 0 8px;"></p>' +
      '<input type="text" class="sText" maxlength="80" aria-label="한마디" placeholder="받았을 때 기분을 적어 봐요">' +
      '<p class="msg sMsg" aria-live="polite"></p>' +
      '<div class="modal-actions"><button type="button" class="dot-btn sCancel">취소</button><button type="button" class="dot-btn primary sSave">저장</button></div>' +
    '</div></div>';
  document.body.appendChild(overlay);
  const q = s => overlay.querySelector(s);
  q('.msg').textContent = captionOf(Object.assign({}, r, { say_sua: '', say_yona: '' }));
  q('.sText').value = sayOf(r, kid) || '';
  const k = kid;                         // 열 때의 아이
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  q('.sCancel').addEventListener('click', close);
  q('.sSave').addEventListener('click', async () => {
    q('.sSave').disabled = true;
    const { error } = await sb.rpc('honor_say', { p_id: r.id, p_text: q('.sText').value });
    if (error){ q('.sMsg').textContent = '저장하지 못했어요: ' + readableError(error); q('.sSave').disabled = false; return; }
    close();
    await load();
    say('한마디를 남겼어요.', k);
  });
  q('.sText').focus();
}


// ---------- 박수 ----------
// 손님도 누른다. 한 브라우저에서 한 자랑에 한 번 — 서버는 분·시간 단위로 홍수만 막는다.
async function clap(r, btn){
  if (clapped(r.id)) return;
  btn.disabled = true;
  const { error } = await sb.from('honor_claps').insert({ honor_id: r.id });
  if (error){ btn.disabled = false; say('박수를 못 보냈어요: ' + readableError(error)); return; }
  claps[r.id] = (claps[r.id] || 0) + 1;
  try { localStorage.setItem(clapKey(r.id), '1'); } catch (e) { /* 저장이 막힌 브라우저 — 다음에 또 눌러도 서버가 받아 준다 */ }
  btn.textContent = '👏 ' + claps[r.id]; btn.classList.add('did'); btn.title = '이 자랑에는 박수를 보냈어요';
  if (typeof sfx === 'function') sfx('pop');
  say('👏 ' + r.title + '에 박수를 보냈어요!');
}

// ---------- 작은 창 틀 ----------
function smallModal(html){
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.innerHTML = '<div class="modal-box dot-card"><div class="inner">' + html + '</div></div>';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const close = () => { overlay.remove(); document.body.style.overflow = ''; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const q = sel => overlay.querySelector(sel);
  const cancel = q('.mCancel'); if (cancel) cancel.addEventListener('click', close);
  return { q, close, overlay };
}

// ---------- 아이: 다음 목표 ----------
function openGoal(track, top, g){
  const k = kid;                         // 열 때의 아이
  const m = smallModal(
    '<h3>🎯 ' + escapeHTML(track) + ' 다음 목표</h3>' +
    '<p class="msg" style="margin:0 0 8px;">지금 ' + top + '단계예요. 다음 단계에 무엇을 따고 싶은지 적어 두면 사다리 윗칸에 깃발이 걸려요.</p>' +
    '<input type="text" class="gText" maxlength="30" aria-label="다음 목표" placeholder="예: 체르니 100, 6급">' +
    '<div class="row2" style="margin-top:8px;"><div><label class="field">몇 번째 단계</label><input type="number" class="gStep" min="1" max="99" aria-label="몇 번째 단계"></div></div>' +
    '<p class="msg gMsg" aria-live="polite"></p>' +
    '<div class="modal-actions">' + (g ? '<button type="button" class="dot-btn gDel">목표 지우기</button>' : '') +
    '<button type="button" class="dot-btn mCancel">취소</button><button type="button" class="dot-btn primary gSave">저장</button></div>');
  m.q('.gText').value = g ? g.goal : '';
  m.q('.gStep').value = g ? g.step : top + 1;
  m.q('.gSave').addEventListener('click', async () => {
    const goal = m.q('.gText').value.trim(), step = parseInt(m.q('.gStep').value, 10);
    if (!goal){ m.q('.gMsg').textContent = '목표를 적어 주세요.'; return; }
    if (!(step > top && step <= 99)){ m.q('.gMsg').textContent = '지금(' + top + '단계)보다 위여야 해요.'; return; }
    m.q('.gSave').disabled = true;
    const res = await sb.from('honor_goals').upsert({ who: k, track, step, goal, set_on: todayStr() }).select('who');
    if (res.error || !(res.data && res.data.length)){ m.q('.gMsg').textContent = '저장하지 못했어요: ' + readableError(res.error || new Error('권한이 없어요')); m.q('.gSave').disabled = false; return; }
    m.close(); await load(); say('🎯 ' + track + ' 다음 목표 「' + goal + '」 — 깃발을 걸었어요.', k);
  });
  if (g) m.q('.gDel').addEventListener('click', async () => {
    const res = await sb.from('honor_goals').delete().eq('who', k).eq('track', track).select('who');
    if (res.error || !(res.data && res.data.length)){ m.q('.gMsg').textContent = '지우지 못했어요.'; return; }
    m.close(); await load(); say('목표를 지웠어요.', k);
  });
  m.q('.gText').focus();
}

// ---------- 아이: 진열대 꾸미기 ----------
function openDecor(){
  const k = kid, cur = prefOf(k);        // 열 때의 아이
  const sw = (map, names, key, on) => Object.keys(map).map(k =>
    '<button type="button" class="swatch' + (k === on ? ' on' : '') + '" data-' + key + '="' + k + '" aria-label="' + names[k] + '" title="' + names[k] + '"><i style="background:' +
    (key === 'lamp' ? 'rgb(' + map[k].join(',') + ')' : map[k]) + '"></i></button>').join('');
  const m = smallModal(
    '<h3>🎨 진열대 꾸미기</h3>' +
    '<p class="msg" style="margin:0 0 8px;">' + escapeHTML(heroName(k)) + '의 진열대 천 색과 조명 색을 골라요. 방을 보는 모두에게 그렇게 보여요.</p>' +
    '<label class="field">받침대 천</label><div class="swatches">' + sw(CLOTH, CLOTH_NAME, 'cloth', cur.cloth) + '</div>' +
    '<label class="field">조명</label><div class="swatches">' + sw(LAMP, LAMP_NAME, 'lamp', cur.lamp) + '</div>' +
    '<p class="msg dMsg" aria-live="polite"></p>' +
    '<div class="modal-actions"><button type="button" class="dot-btn mCancel">취소</button><button type="button" class="dot-btn primary dSave">저장</button></div>');
  const pick = { cloth: cur.cloth, lamp: cur.lamp };
  m.overlay.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.cloth ? 'cloth' : 'lamp';
    pick[key] = b.dataset[key];
    b.parentElement.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === b));
    prefs[k] = Object.assign({}, prefs[k], { who: k }, pick); drawRoom(k);   // 고르는 대로 방에 미리 비친다
  }));
  const was = prefs[k];
  m.q('.mCancel').addEventListener('click', () => { prefs[k] = was; drawRoom(k); });
  m.q('.dSave').addEventListener('click', async () => {
    m.q('.dSave').disabled = true;
    const res = await sb.from('honor_prefs').upsert({ who: k, cloth: pick.cloth, lamp: pick.lamp }).select('who');
    if (res.error || !(res.data && res.data.length)){ m.q('.dMsg').textContent = '저장하지 못했어요: ' + readableError(res.error || new Error('권한이 없어요')); m.q('.dSave').disabled = false; return; }
    m.close(); await load(); say('🎨 진열대를 ' + CLOTH_NAME[pick.cloth] + ' 천, ' + LAMP_NAME[pick.lamp] + ' 조명으로 꾸몄어요.', k);
  });
}

// ---------- 목소리: 그날의 소감 ----------
// 목소리 일기의 녹음기를 그대로 쓴다(common.js startVoiceRecorder / uploadVoice).
// 아이는 함수(honor_voice)로 제 것에만 붙이고, 부모는 줄을 바로 고친다.
function openVoice(r){
  const k = kid;                         // 열 때의 아이
  let rec = null, draft = null;
  const m = smallModal(
    '<h3>🎙 ' + escapeHTML(r.title) + '</h3>' +
    '<p class="msg" style="margin:0 0 8px;">받았을 때 기분을 목소리로 남겨요. 60초까지예요.</p>' +
    '<div class="vBox"></div>' +
    '<p class="msg vMsg" aria-live="polite"></p>' +
    '<div class="modal-actions"><button type="button" class="dot-btn mCancel">닫기</button></div>');
  const box = m.q('.vBox'), msg = m.q('.vMsg');
  const stopAll = () => { if (rec){ rec.cancel(); rec = null; } if (draft && draft.url) URL.revokeObjectURL(draft.url); draft = null; };
  m.q('.mCancel').addEventListener('click', stopAll);
  async function put(url, secs){
    if (isAdmin){
      const res = await sb.from('honors').update({ audio_url: url, audio_secs: secs }).eq('id', r.id).select('id');
      if (res.error || !(res.data && res.data.length)) throw res.error || new Error('권한이 없어요');
    } else {
      const { error } = await sb.rpc('honor_voice', { p_id: r.id, p_url: url, p_secs: secs });
      if (error) throw error;
    }
  }
  function paint(){
    let html = '';
    if (draft){
      html = '<audio controls src="' + draft.url + '"></audio><div class="mz-bar">' +
        '<button type="button" class="dot-btn small primary vSave">이걸로 붙이기 (' + secsLabel(draft.secs) + ')</button>' +
        '<button type="button" class="dot-btn small vRedo">다시 녹음</button></div>';
    } else if (rec){
      html = '<p class="rec-line"><span class="rec-dot"></span> 녹음 중 <span class="vTimer">0초</span></p>' +
        '<button type="button" class="dot-btn small primary vStop">■ 멈추기</button>';
    } else {
      html = (r.audio_url ? '<div class="honor-voice vNow"></div>' : '<p class="msg" style="margin:0 0 6px;">아직 붙인 목소리가 없어요.</p>') +
        '<div class="mz-bar"><button type="button" class="dot-btn small primary vRec">● 녹음 시작</button>' +
        (r.audio_url ? '<button type="button" class="dot-btn small vDel">목소리 떼기</button>' : '') + '</div>';
    }
    box.innerHTML = html;
    if (box.querySelector('.vNow')) mountVoice(box.querySelector('.vNow'), r.audio_url, r.audio_secs, null);
    const on = (sel, fn) => { const el = box.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('.vRec', async () => {
      if (!canRecordVoice()){ msg.textContent = '이 브라우저에서는 녹음이 안 돼요.'; return; }
      try {
        rec = await startVoiceRecorder(secs => { const t = box.querySelector('.vTimer'); if (t) t.textContent = secsLabel(secs); if (secs >= VOICE_MAX_SECS) finish(); });
        paint();
      } catch (e) {
        msg.textContent = /NotAllowed|Permission/i.test((e && e.name) + (e && e.message)) ? '마이크를 쓸 수 없어요. 브라우저에서 이 사이트의 마이크 사용을 허용해 주세요.' : '녹음을 시작하지 못했어요: ' + ((e && e.message) || e);
      }
    });
    on('.vStop', finish);
    on('.vRedo', () => { if (draft && draft.url) URL.revokeObjectURL(draft.url); draft = null; paint(); box.querySelector('.vRec').click(); });
    on('.vSave', async () => {
      box.querySelector('.vSave').disabled = true; msg.textContent = '올리는 중…';
      try {
        const url = await uploadVoice(draft.blob, draft.ext);
        await put(url, draft.secs);
        const oldPath = pathOfUrl(r.audio_url);
        if (oldPath) await dropFiles([oldPath]);
        stopAll(); m.close(); await load(); say('🎙 ' + r.title + '에 목소리를 붙였어요.', k);
      } catch (e) { msg.textContent = '붙이지 못했어요: ' + readableError(e); box.querySelector('.vSave').disabled = false; }
    });
    on('.vDel', async () => {
      if (!confirm('이 목소리를 뗄까요?')) return;
      try {
        const oldPath = pathOfUrl(r.audio_url);
        await put(null, null);
        if (oldPath) await dropFiles([oldPath]);
        m.close(); await load(); say('목소리를 뗐어요.', k);
      } catch (e) { msg.textContent = '떼지 못했어요: ' + readableError(e); }
    });
  }
  async function finish(){
    if (!rec) return;
    const cur = rec; rec = null;
    try {
      const { blob, secs } = await cur.stop();
      if (blob && blob.size) draft = { blob, secs: Math.max(1, secs), ext: cur.ext, url: URL.createObjectURL(blob) };
    } catch (e) { /* 아무것도 안 담겼으면 처음 화면으로 */ }
    paint();
  }
  paint();
}

// ---------- 한 해치 모아보기: 도트 카드 · A4 인쇄 ----------
// 카드는 캔버스 한 장(360×480 을 두 배로 굽는다). 인쇄는 숨겨 둔 종이 한 장을 채우고 print() 를 부른다 —
// 화면의 나머지는 @media print 에서 감춘다.
const CARD_W = 360, CARD_H = 480, CARD_COLS = 3, CARD_MAX = 12;
function fitText(g, text, maxW){
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function yearCard(list){
  const c = document.createElement('canvas'); c.width = CARD_W * 2; c.height = CARD_H * 2;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
  const color = KID_COLOR[kid], label = year === 'all' ? '지금까지의 자랑' : year + '학년도 자랑';
  const FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  g.fillStyle = '#fff6e6'; g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = color; g.fillRect(0, 0, CARD_W, 6); g.fillRect(0, CARD_H - 6, CARD_W, 6); g.fillRect(0, 0, 6, CARD_H); g.fillRect(CARD_W - 6, 0, 6, CARD_H);
  g.fillStyle = shade(color, -40);                                    // 안쪽 점선 테
  for (let x = 12; x < CARD_W - 12; x += 6){ g.fillRect(x, 12, 3, 1); g.fillRect(x, CARD_H - 13, 3, 1); }
  for (let y = 12; y < CARD_H - 12; y += 6){ g.fillRect(12, y, 1, 3); g.fillRect(CARD_W - 13, y, 1, 3); }
  g.fillStyle = color; g.fillRect(20, 20, CARD_W - 40, 54);
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '800 17px ' + FONT; g.fillText(heroName(kid) + '의 ' + label, CARD_W / 2, 40);
  const nA = list.filter(r => r.kind === 'award').length, nL = list.filter(r => r.kind === 'level').length, nF = list.filter(r => r.kind === 'first').length;
  g.font = '700 11px ' + FONT; g.fillText('🏅 상장·메달 ' + nA + '   🪜 급수 ' + nL + '   ⭐ 처음 해낸 것 ' + nF, CARD_W / 2, 60);
  // 열둘이 넘으면 가장 최근 열둘을 받은 차례로
  const items = list.slice().sort((a, b) => a.got_on < b.got_on ? -1 : 1).slice(-CARD_MAX);
  const cellW = (CARD_W - 40) / CARD_COLS, cellH = 88, top = 86;
  items.forEach((r, n) => {
    const cx = 20 + (n % CARD_COLS) * cellW + cellW / 2, cy = top + Math.floor(n / CARD_COLS) * cellH;
    g.fillStyle = 'rgba(42,33,24,.06)'; g.fillRect(Math.round(cx - cellW / 2 + 4), cy, Math.round(cellW - 8), cellH - 6);
    drawArtOut(g, OBJ_ART[lookOf(r)] || OBJ_ART.star, Math.round(cx - 24), cy + 6, 3, itemColor(r));
    g.fillStyle = '#2a2118'; g.font = '800 10.5px ' + FONT; g.textAlign = 'center';
    g.fillText(fitText(g, (r.kind === 'level' ? r.track + ' ' : '') + r.title, cellW - 16), cx, cy + 64);
    g.fillStyle = '#7a6a58'; g.font = '700 9px ' + FONT;
    g.fillText(fmtDate(r.got_on) + (r.org ? ' · ' + fitText(g, r.org, 60) : ''), cx, cy + 77);
  });
  if (list.length > CARD_MAX){ g.fillStyle = '#7a6a58'; g.font = '700 10px ' + FONT; g.fillText('… 그리고 앞서 받은 ' + (list.length - CARD_MAX) + '개 더', CARD_W / 2, top + 4 * cellH + 2); }
  g.fillStyle = '#7a6a58'; g.font = '700 9px ' + FONT; g.fillText('www.suayona.com · 업적 전시실 · ' + fmtDate(todayStr()), CARD_W / 2, CARD_H - 24);
  return c;
}
function openYearCard(list){
  const k = kid, y = year, label = y === 'all' ? '지금까지' : y + '학년도';
  const m = smallModal(
    '<h3>🖼 ' + escapeHTML(heroName(kid)) + '의 ' + label + ' 카드</h3>' +
    '<div class="year-card"></div>' +
    '<p class="msg yMsg" aria-live="polite">그림을 길게 누르거나 「그림으로 저장」을 눌러요. 냉장고에 붙이려면 「A4 로 인쇄」.</p>' +
    '<div class="modal-actions"><button type="button" class="dot-btn mCancel">닫기</button>' +
    '<button type="button" class="dot-btn ySave">그림으로 저장</button><button type="button" class="dot-btn primary yPrint">A4 로 인쇄</button></div>');
  m.q('.modal-box').classList.add('year-modal');
  const cv = yearCard(list); m.q('.year-card').appendChild(cv);
  m.q('.ySave').addEventListener('click', () => cv.toBlob(b => {
    if (!b){ m.q('.yMsg').textContent = '그림을 만들지 못했어요.'; return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = 'suayona-' + k + '-' + (y === 'all' ? 'all' : y) + '.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png'));
  m.q('.yPrint').addEventListener('click', () => withKid(k, () => printSheet(list)));
}
function printSheet(list){
  let sheet = $('#printSheet');
  if (!sheet){ sheet = document.createElement('section'); sheet.id = 'printSheet'; document.body.appendChild(sheet); }
  const label = year === 'all' ? '지금까지의 자랑' : year + '학년도 자랑';
  sheet.innerHTML = '';
  const h = document.createElement('h1'); h.textContent = heroName(kid) + '의 ' + label; sheet.appendChild(h);
  const sub = document.createElement('p'); sub.className = 'ps-sub';
  sub.textContent = '수아랑 연아랑 업적 전시실 · ' + fmtDate(todayStr()) + ' 뽑음'; sheet.appendChild(sub);
  ['title', 'award', 'level', 'first'].forEach(kd => {
    const part = list.filter(r => r.kind === kd).slice().sort((a, b) => a.got_on < b.got_on ? -1 : 1);
    if (!part.length) return;
    const h2 = document.createElement('h2'); h2.textContent = KIND_NAME[kd] + ' ' + part.length; sheet.appendChild(h2);
    part.forEach(r => {
      const row = document.createElement('div'); row.className = 'ps-row';
      if (r.thumb_url || r.photo_url){ const im = document.createElement('img'); im.alt = ''; im.src = r.thumb_url || r.photo_url; row.appendChild(im); }
      else { const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48; const cg = cv.getContext('2d'); cg.imageSmoothingEnabled = false; drawArtOut(cg, OBJ_ART[lookOf(r)] || OBJ_ART.star, 0, 0, 3, itemColor(r)); row.appendChild(cv); }
      const t = document.createElement('div');
      const b = document.createElement('b'); b.textContent = (r.kind === 'level' ? r.track + ' ' : '') + r.title + (r.kind === 'level' && r.step ? ' (' + r.step + '단계)' : '');
      const sm = document.createElement('small'); sm.textContent = [r.org, fmtDate(r.got_on) + (r.kind === 'title' ? ' ~ ' + fmtDate(r.until) : ''), r.who === 'both' ? '둘이 함께' : ''].filter(Boolean).join(' · ');
      t.append(b, sm);
      const s = sayOf(r, kid);
      if (s){ const q = document.createElement('p'); q.textContent = '“' + s + '”'; t.appendChild(q); }
      row.appendChild(t); sheet.appendChild(row);
    });
  });
  const imgs = Array.from(sheet.querySelectorAll('img'));
  Promise.all(imgs.map(im => im.complete ? null : new Promise(res => { im.onload = im.onerror = res; }))).then(() => window.print());
}

// ---------- 반짝임 ----------
// 2초마다 0.45초 동안 가장 최근 것에 반짝. 그 동안만 다시 그린다(한 방 1.8ms). 움직임을 줄인 설정이면 안 한다.
function sparkleLoop(){
  const t = performance.now() % 2000, on = t < 450;
  if (on || sparklePhase !== null){
    sparklePhase = on ? t / 450 : null;
    KIDS.forEach(k => { if (sparkleOf[k]) drawRoom(k); });
  }
  requestAnimationFrame(sparkleLoop);
}
if (!STILL) requestAnimationFrame(sparkleLoop);

// ---------- 시작 ----------
$('#addHonor').addEventListener('click', () => withKid('sua', () => openForm(null)));
document.addEventListener('suayona:auth', () => render());
(async function boot(){
  try { await refreshAuth(); } catch (e) { /* 로그인 확인이 안 되면 손님으로 본다 */ }
  await load();
  initReveal();
})();
