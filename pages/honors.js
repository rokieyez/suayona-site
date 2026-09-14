// honors.html 의 페이지 스크립트 — 자랑 저장고.
// 싣는 순서: supabase → pixel → common → 이 파일.
/* 학교·학원에서 받은 상장, 차근차근 올라간 급수, 처음 해낸 일을 아이마다 모아 전시한다(2026-09-14).
   모험단 보물 저장고와는 따로다 — 게임 보상과 잇지 않는다(상을 받는 일이 게임 점수가 되지 않게).
   · 누구나 본다. 사진에는 이름·학교·반이 찍혀 있기 쉬워서, 부모가 올릴 때 가릴 곳을 네모로 골라
     모자이크한 사본만 올린다. 원본은 브라우저 밖으로 안 나간다 — 캔버스에서 다시 구우므로 EXIF(찍은 곳)도 빠진다.
   · 방은 모험단 방과 같은 아이소메트릭 틀(400×260, 칸 56×28). 오른쪽 벽은 상장 액자,
     왼쪽 벽은 급수 사다리, 바닥 진열대는 메달·트로피와 처음 해낸 것.
   · 학년도(3월 시작)로 나눈다. 생년월일은 가족만 읽는 표라 「몇 학년」 대신 「2026학년도」로 적는다. */

buildChrome('honors');
const lightbox = createLightbox();

const KIDS = ['sua', 'yona'];
const KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3' };   // 모험단 주인공 색과 같다
const KIND_NAME = { award: '상장·메달', level: '급수', first: '처음 해낸 것' };
const LOOK = {
  paper:  { name: '상장 액자', kind: 'award' },
  medal:  { name: '메달',     kind: 'award' },
  trophy: { name: '트로피',   kind: 'award' },
  belt:   { name: '띠',       kind: 'level' },
  badge:  { name: '인증 배지', kind: 'level' },
  star:   { name: '별 기념패', kind: 'first' },
};
const LEVEL_COLOR = '#57b98a';               // 색을 안 고른 급수
const PHOTO_DIM = 2000;                      // 올리는 사진의 긴 변
const PHOTO_LIMIT = 3 * 1024 * 1024;
const THUMB_LONG = 400;

let rows = [], kid = 'sua', year = 'all', missing = false;
let wantItem = Number(new URLSearchParams(location.search).get('item')) || 0;   // ?item= 으로 들어오면 그것부터 연다
{
  const q = new URLSearchParams(location.search);
  if (KIDS.includes(q.get('who'))) kid = q.get('who');
  if (/^\d{4}$/.test(q.get('year') || '')) year = q.get('year');
}

// ---------- 작은 셈 ----------
function schoolYear(d){ const p = String(d || '').split('-').map(Number); return p[1] >= 3 ? p[0] : p[0] - 1; }
function fmtDate(d){ const p = String(d || '').split('-'); return p.length === 3 ? p[0] + '.' + Number(p[1]) + '.' + Number(p[2]) : ''; }
function todayStr(){ const d = new Date(), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
function mineOf(k){ return rows.filter(r => r.who === k || r.who === 'both'); }
function yearsOf(list){ return [...new Set(list.map(r => schoolYear(r.got_on)))].sort((a, b) => b - a); }
function inYear(list){ return year === 'all' ? list : list.filter(r => schoolYear(r.got_on) === Number(year)); }
function sayOf(r, k){ return k === 'sua' ? r.say_sua : r.say_yona; }
function lookOf(r){ return LOOK[r.look] && LOOK[r.look].kind === r.kind ? r.look : ({ award: 'paper', level: 'belt', first: 'star' })[r.kind] || 'paper'; }
function itemColor(r){ return /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : r.kind === 'level' ? LEVEL_COLOR : KID_COLOR[kid]; }
function pathOfUrl(u){ const m = String(u || '').split('/object/public/' + MEDIA_BUCKET + '/'); return m.length === 2 ? decodeURIComponent(m[1].split('?')[0]) : null; }
function captionOf(r){
  const s = sayOf(r, kid);
  return (r.kind === 'level' ? r.track + ' · ' : '') + r.title + (r.kind === 'level' && r.step ? ' (' + r.step + '단계)' : '') +
    (r.org ? ' · ' + r.org : '') + ' · ' + fmtDate(r.got_on) + (s ? ' — “' + s + '”' : '');
}
function say(t){ $('#museumMsg').textContent = t || ''; }

// ---------- 불러오기 ----------
async function load(){
  const { data, error } = await sb.from('honors').select('*')
    .order('got_on', { ascending: false }).order('id', { ascending: false });
  if (error){
    // 표가 아직 없으면(서버 쪽 준비 전) 빈 전시관 대신 그렇다고 말한다
    missing = /honors|42P01|PGRST205|schema cache/i.test((error.code || '') + ' ' + (error.message || ''));
    rows = [];
    if (!missing) say('불러오지 못했어요: ' + readableError(error));
  } else {
    missing = false;
    rows = data || [];
  }
  render();
  if (wantItem){
    const r = rows.find(x => x.id === wantItem);
    wantItem = 0;
    if (r){ if (r.who !== 'both') kid = r.who; year = 'all'; render(); openItem(r); }
  }
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
  belt: [
    '................', '................', '................', '.hhhhhhhhhhhhhh.',
    'hHhhhhhhhhhhhhHh', 'hhhhhhhHHhhhhhhh', '.hhhhhhHHhhhhhh.', '......hHHh......',
    '.....hH..Hh.....', '....hH....Hh....', '...hH......Hh...', '...hh......hh...',
    '................', '................', '................', '................',
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

// ---------- 아이소메트릭 틀 (모험단 방과 같은 수) ----------
const RW = 400, RH = 260, TW = 56, TH = 28, FX = 172, FY = 116, WALLH = 96;
const CORNER = { x: FX, y: FY - TH / 2 }, WTOP = CORNER.y - WALLH;
const LWr = 6 * (TW / 2), LWl = 4 * (TW / 2);
function tileXY(i, j){ return { x: FX + (i - j) * (TW / 2), y: FY + (i + j) * (TH / 2) }; }
function wallXY(side, u, v){ return { x: side ? CORNER.x + u : CORNER.x - u - 2, y: WTOP + v + u / 2 }; }
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
// 벽면에 붙은 네모 — 두 칸 폭 기둥을 벽 기울기대로 이어 붙인다
function wallRect(g, side, u, v, w, h, c){
  g.fillStyle = c;
  for (let du = 0; du < w; du += 2){ const p = wallXY(side, u + du, v); g.fillRect(Math.round(p.x), Math.round(p.y), 2, h); }
}

// 벽면에 붙인 도트 그림 — 한 칸씩 벽 기울기대로 찍는다(왼쪽 벽은 거울처럼 뒤집히지만 띠·배지는 좌우가 거의 같다)
function wallArt(g, side, u, v, art, color){
  const dark = shade(color, -44);
  for (let r = 0; r < art.length; r++) for (let c = 0; c < art[r].length; c++){
    const ch = art[r][c]; if (ch === '.') continue;
    const p = wallXY(side, u + c, v + r);
    g.fillStyle = ch === 'h' ? color : ch === 'H' ? dark : HPAL[ch];
    g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
}
// 자리 — 오른쪽 벽 액자 여덟(두 줄), 왼쪽 벽 사다리 셋, 바닥 진열대 여덟
const FRAMES = [10, 36].flatMap(v => [12, 50, 88, 126].map(u => ({ u, v })));
const FRAME_W = 30, FRAME_H = 22;
const LADDERS = [10, 44, 78], LAD_V = 8, LAD_H = 50, LAD_W = 24;
const STANDS = [];
[1.0, 2.5].forEach(j => [0.8, 2.2, 3.6, 5.0].forEach(i => { const p = tileXY(i, j); STANDS.push({ x: Math.round(p.x), y: Math.round(p.y) }); }));

// 껍데기(회벽·나무 징두리·쪽마루·양탄자)는 아이 색마다 한 번만 굽는다
const shells = {};
function shellCv(color){
  if (shells[color]) return shells[color];
  const c = document.createElement('canvas');
  c.width = RW * 2; c.height = RH * 2;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.fillStyle = '#2a2320'; g.fillRect(0, 0, RW, RH);
  [1, 0].forEach(side => {
    const len = side ? LWr : LWl, dim = side ? 0 : -14;          // 왼쪽 벽은 빛을 등진다
    for (let u = 0; u < len; u += 2) for (let v = 0; v < WALLH; v += 2){
      let base, d = 0;
      if (v < 4) base = '#c49565';                                  // 천장 몰딩
      else if (v < 6) base = '#8a6440';
      else if (v < 62){ base = '#efe2c8'; d = Math.round((prand('p' + side + ':' + (u >> 3) + ':' + (v >> 3)) - 0.5) * 8); }   // 회벽
      else if (v < 66) base = v < 64 ? '#d7a870' : '#9c6c42';       // 징두리 윗몰딩
      else if (v >= WALLH - 6) base = '#5e3d24';                    // 굽도리
      else if (u % 28 < 2 || v === 66 || v === WALLH - 8) base = '#7d5434';   // 널 판 테
      else { base = '#a8764a'; d = (u >> 1) % 7 === 0 ? -6 : 0; }
      const p = wallXY(side, u, v);
      g.fillStyle = shade(base, d + dim); g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
  });
  for (let i = 0; i < 10; i += 2){                                  // 모서리 그늘
    const a = (0.16 * (1 - i / 10)).toFixed(3);
    for (let v = 0; v < WALLH; v += 2){
      const pr = wallXY(1, i, v), pl = wallXY(0, i, v);
      g.fillStyle = 'rgba(40,24,10,' + a + ')';
      g.fillRect(Math.round(pr.x), Math.round(pr.y), 2, 2);
      g.fillRect(Math.round(pl.x), Math.round(pl.y), 2, 2);
    }
  }
  for (let j = 0; j <= 3; j++) for (let i = 0; i <= 5; i++){       // 쪽마루
    const p = tileXY(i, j);
    isoTile(g, p.x, p.y, '#6e4a2c', 0);
    const t = Math.floor(prand('f' + i + ':' + j) * 3) - 1;
    isoTile(g, p.x, p.y, shade((i + j) % 2 ? '#c99a62' : '#b8864f', t * 5 - j * 3), 2);
    g.fillStyle = shade('#a87644', -j * 3);
    g.fillRect(Math.round(p.x - 13), Math.round(p.y - 3), 10, 1);
    g.fillRect(Math.round(p.x + 3), Math.round(p.y + 2), 10, 1);
  }
  const rug = tileXY(2.9, 1.75);                                    // 아이 색 양탄자
  for (let k = -19; k <= 19; k++){
    const hw = Math.round((1 - Math.abs(k) / 20) * 76);
    if (hw <= 0) continue;
    const edge = Math.abs(k) > 15;
    g.fillStyle = edge ? shade(color, -50) : shade(color, -18);
    g.fillRect(Math.round(rug.x - hw), Math.round(rug.y + k * 2), hw * 2, 2);
    if (!edge && Math.abs(k) < 8){
      const hw2 = Math.round((1 - Math.abs(k) / 8) * 30);
      g.fillStyle = shade(color, 16);
      g.fillRect(Math.round(rug.x - hw2), Math.round(rug.y + k * 2), hw2 * 2, 2);
    }
  }
  shells[color] = c;
  return c;
}
function drawFrame(g, f, n){
  const fc = ['#c8962e', '#8a5a34', '#b9bec7'][n % 3];            // 금 · 나무 · 은 테
  wallRect(g, 1, f.u + 14, f.v - 4, 2, 4, '#5a4a3a');               // 거는 줄
  wallRect(g, 1, f.u + 2, f.v + 2, FRAME_W, FRAME_H, 'rgba(40,24,10,.22)');   // 그림자
  wallRect(g, 1, f.u, f.v, FRAME_W, FRAME_H, shade(fc, -46));
  wallRect(g, 1, f.u + 2, f.v + 2, FRAME_W - 4, FRAME_H - 4, fc);
  wallRect(g, 1, f.u + 2, f.v + 2, FRAME_W - 4, 1, shade(fc, 30));
  wallRect(g, 1, f.u + 4, f.v + 4, FRAME_W - 8, FRAME_H - 8, '#fffaf0');   // 종이
  wallRect(g, 1, f.u + 10, f.v + 6, 10, 2, '#c8962e');              // 제목 띠
  wallRect(g, 1, f.u + 6, f.v + 10, 18, 1, '#c9bca8');
  wallRect(g, 1, f.u + 6, f.v + 12, 18, 1, '#c9bca8');
  wallRect(g, 1, f.u + 6, f.v + 14, 10, 1, '#c9bca8');
  wallRect(g, 1, f.u + 18, f.v + 13, 4, 4, '#d4504a');              // 붉은 도장
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
  wallRect(g, 0, u, LAD_V, LAD_W, LAD_H, '#e7d4b0');
  wallRect(g, 0, u, LAD_V, 2, LAD_H, '#7a4f2d');
  wallRect(g, 0, u + LAD_W - 2, LAD_V, 2, LAD_H, '#7a4f2d');
  wallRect(g, 0, u, LAD_V, LAD_W, 3, '#5a3a22');
  const n = Math.min(8, Math.max(6, t.top)), first = Math.max(1, t.top - n + 1);
  let col = LEVEL_COLOR;
  t.rows.forEach(x => { if ((x.step || 1) < first && x.color) col = x.color; });
  for (let k = 0; k < n; k++){
    const no = first + k, rec = t.rows.filter(x => (x.step || 1) === no && x.color).pop();
    if (rec) col = rec.color;
    const vy = LAD_V + LAD_H - 7 - k * 6, got = no <= t.top;
    wallRect(g, 0, u + 4, vy, LAD_W - 8, 4, got ? col : '#cdbd9f');
    if (got) wallRect(g, 0, u + 4, vy, LAD_W - 8, 1, shade(col, 34));
    if (no === t.top){ wallRect(g, 0, u - 2, vy - 3, 4, 4, '#ffd979'); wallRect(g, 0, u - 2, vy - 3, 2, 2, '#fff0b8'); }
  }
  // 징두리 판의 이름표 — 지금 단계의 띠나 배지. 이게 없으면 사다리가 문이나 책장으로 읽혔다
  const last = t.rows.filter(x => (x.step || 1) === t.top).pop() || t.rows[t.rows.length - 1];
  wallRect(g, 0, u + 2, 68, LAD_W - 4, 18, '#ead6b1');
  wallRect(g, 0, u + 2, 68, LAD_W - 4, 1, '#fff3da');
  wallRect(g, 0, u + 2, 85, LAD_W - 4, 1, '#6e4526');
  wallArt(g, 0, u + 4, 69, OBJ_ART[lookOf(last)] || OBJ_ART.belt, itemColor(last));
}
function drawStand(g, x, y, r){
  const look = lookOf(r), color = itemColor(r);
  isoTile(g, x + 2, y + 2, 'rgba(60,36,16,.28)', 12);
  isoBoxD(g, x, y, 11, 6, 12, '#f1e3c6', '#dcc7a1', '#b3976c', 0);
  isoBandD(g, x, y, 11, 6, 2, '#8a5a34', '#6e4526', 10);
  if (look === 'star') isoTopD(g, x, y - 12, 8, 4, '#b8423c');
  drawArtOut(g, OBJ_ART[look] || OBJ_ART.star, x - 8, y - 30, 1, color);
  if (look === 'medal' || look === 'badge'){                       // 유리 덮개
    isoBandD(g, x, y, 10, 5, 20, 'rgba(210,235,255,.16)', 'rgba(180,215,245,.12)', 12);
    isoTopD(g, x, y - 32, 10, 5, 'rgba(225,242,255,.22)');
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 8, y - 28, 1, 10);
  }
}
// 누를 수 있는 곳 — 그릴 때 함께 적어 둔다
let hits = [], hoverKey = null;
const hitKey = h => h.r ? 'r' + h.r.id : 't' + h.t.track;
function drawMuseum(g, k){
  const color = KID_COLOR[k], all = mineOf(k), list = inYear(all);
  hits = [];
  g.clearRect(0, 0, RW, RH);
  g.drawImage(shellCv(color), 0, 0, RW, RH);
  const lamps = [];
  // 오른쪽 벽 — 상장 액자
  const papers = list.filter(r => r.kind === 'award' && lookOf(r) === 'paper').slice(0, FRAMES.length);
  papers.forEach((r, n) => {
    const f = FRAMES[n];
    drawFrame(g, f, n);
    const a = wallXY(1, f.u, f.v);
    hits.push({ r, x0: a.x - 2, x1: a.x + FRAME_W + 2, y0: a.y - 5, y1: a.y + FRAME_H + FRAME_W / 2 + 2 });
    const p = wallXY(1, f.u + FRAME_W / 2, f.v - 6);
    lamps.push([p.x, p.y, 30, 0.2]);
  });
  FRAMES.slice(papers.length).forEach(f => {                           // 아직 비어 있는 액자 자리 — 점선 테
    const c = 'rgba(110,70,36,.26)';
    for (let d = 0; d < FRAME_W; d += 6){ wallRect(g, 1, f.u + d, f.v, 2, 1, c); wallRect(g, 1, f.u + d, f.v + FRAME_H - 1, 2, 1, c); }
    for (let d = 0; d < FRAME_H; d += 5){ wallRect(g, 1, f.u, f.v + d, 2, 2, c); wallRect(g, 1, f.u + FRAME_W - 2, f.v + d, 2, 2, c); }
  });
  // 왼쪽 벽 — 급수 사다리
  ladderTracks(all).slice(0, LADDERS.length).forEach((t, n) => {
    const u = LADDERS[n];
    drawLadder(g, u, t);
    const xr = wallXY(0, u, LAD_V).x + 2, xl = wallXY(0, u + LAD_W, LAD_V).x;
    hits.push({ t, x0: xl - 3, x1: xr + 1, y0: WTOP + LAD_V + u / 2 - 4, y1: WTOP + 88 + (u + LAD_W) / 2 });
  });
  // 바닥 — 메달·트로피와 처음 해낸 것
  const floor = list.filter(r => r.kind === 'first' || (r.kind === 'award' && lookOf(r) !== 'paper')).slice(0, STANDS.length);
  const newest = list[0] ? list[0].id : null;
  STANDS.map((p, n) => ({ p, r: floor[n] })).sort((a, b) => a.p.y - b.p.y).forEach(({ p, r }) => {
    if (!r){ isoTile(g, p.x, p.y, 'rgba(255,250,235,.08)', 12); return; }
    drawStand(g, p.x, p.y, r);
    hits.push({ r, x0: p.x - 14, x1: p.x + 14, y0: p.y - 36, y1: p.y + 8, front: p.y });
    lamps.push([p.x, p.y - 24, r.id === newest ? 40 : 22, r.id === newest ? 0.34 : 0.16]);
  });
  g.save();
  g.globalCompositeOperation = 'lighter';
  lamps.forEach(L => {
    const grd = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], L[2]);
    grd.addColorStop(0, 'rgba(255,230,170,' + L[3] + ')');
    grd.addColorStop(1, 'rgba(255,210,140,0)');
    g.fillStyle = grd; g.fillRect(L[0] - L[2], L[1] - L[2], L[2] * 2, L[2] * 2);
  });
  g.restore();
  const vig = g.createRadialGradient(RW / 2, RH / 2, 90, RW / 2, RH / 2, 260);
  vig.addColorStop(0, 'rgba(20,12,6,0)');
  vig.addColorStop(1, 'rgba(20,12,6,0.32)');
  g.fillStyle = vig; g.fillRect(0, 0, RW, RH);
  const hv = hits.find(h => hitKey(h) === hoverKey);
  if (hv){
    g.strokeStyle = 'rgba(255,217,121,.95)'; g.lineWidth = 1;
    g.strokeRect(Math.round(hv.x0) + 0.5, Math.round(hv.y0) + 0.5, Math.round(hv.x1 - hv.x0), Math.round(hv.y1 - hv.y0));
  }
}
function drawRoom(){
  const cv = $('#museum'); if (!cv) return;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(2, 0, 0, 2, 0, 0);
  drawMuseum(g, kid);
}
function hitAt(e){
  const rc = $('#museum').getBoundingClientRect();
  if (!rc.width) return null;
  const x = (e.clientX - rc.left) / rc.width * RW, y = (e.clientY - rc.top) / rc.height * RH;
  // 앞에 그린 진열대가 이긴다
  return hits.filter(h => x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1).sort((a, b) => (b.front || 0) - (a.front || 0))[0] || null;
}
// 마우스로 훑으면 누를 수 있는 것에 테가 둘리고 이름이 먼저 보인다(손가락에는 훑기가 없으니 누르기만)
$('#museum').addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const h = hitAt(e), k = h ? hitKey(h) : null;
  if (k === hoverKey) return;
  hoverKey = k;
  e.currentTarget.style.cursor = h ? 'pointer' : 'default';
  if (h) say(h.r ? captionOf(h.r) : '🪜 ' + h.t.track + ' — 지금 ' + h.t.top + '단계');
  drawRoom();
});
$('#museum').addEventListener('pointerleave', () => { if (hoverKey){ hoverKey = null; drawRoom(); } });
$('#museum').addEventListener('click', e => {
  const h = hitAt(e);
  if (!h){ say(''); return; }
  if (h.r){ openItem(h.r); return; }
  const shots = h.t.rows.filter(r => r.photo_url).slice().reverse();
  say('🪜 ' + h.t.track + ' — 지금 ' + h.t.top + '단계 · ' + h.t.rows.map(r => r.title).join(' → '));
  if (shots.length) lightbox.open(shots.map(r => ({ media_url: r.photo_url, media_type: 'image', caption: captionOf(r) })), 0);
});
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
function syncUrl(){
  const q = new URLSearchParams(location.search);
  q.set('who', kid);
  if (year === 'all') q.delete('year'); else q.set('year', year);
  q.delete('item');
  history.replaceState(history.state, '', location.pathname + '?' + q.toString());
}
function tabBtn(label, on, extra, fn){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'dot-btn small' + (on ? ' on' : '') + (extra ? ' ' + extra : '');
  b.textContent = label; b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.addEventListener('click', fn);
  return b;
}
function render(){
  const note = $('#honorNote');
  note.hidden = !missing;
  note.textContent = missing ? '자랑 저장고를 준비하는 중이에요. 곧 열려요.' : '';
  $('#adminBar').hidden = !isAdmin || missing;
  const kt = $('#kidTabs'); kt.innerHTML = '';
  KIDS.forEach(k => kt.appendChild(tabBtn(heroName(k) + ' ' + mineOf(k).length, k === kid, k, () => { kid = k; year = 'all'; say(''); render(); })));
  const ys = yearsOf(mineOf(kid));
  if (year !== 'all' && !ys.includes(Number(year))) year = 'all';
  const yt = $('#yearTabs'); yt.innerHTML = '';
  yt.hidden = !ys.length;
  ['all'].concat(ys).forEach(y => yt.appendChild(tabBtn(y === 'all' ? '전체' : y + '학년도', String(y) === String(year), '', () => { year = String(y); say(''); render(); })));
  const list = inYear(mineOf(kid));
  const nA = list.filter(r => r.kind === 'award').length, nF = list.filter(r => r.kind === 'first').length;
  const nT = ladderTracks(mineOf(kid)).length;
  $('#roomTitle').textContent = heroName(kid) + '의 자랑 저장고' + (year === 'all' ? '' : ' · ' + year + '학년도');
  $('#roomSub').textContent = '🏅 상장·메달 ' + nA + ' · 🪜 급수 ' + nT + '가지 · ⭐ 처음 해낸 것 ' + nF + ' — 액자·사다리·진열대를 누르면 사진이 열려요';
  drawRoom();
  renderList(list);
  syncUrl();
}
function renderList(list){
  const box = $('#honorList'); box.innerHTML = '';
  if (missing) return;
  if (!list.length){
    const p = document.createElement('p'); p.className = 'honor-empty';
    p.textContent = year === 'all' ? heroName(kid) + '의 자랑이 아직 없어요.' : year + '학년도에는 아직 없어요.';
    box.appendChild(p); return;
  }
  ['award', 'level', 'first'].forEach(kd => {
    const part = list.filter(r => r.kind === kd);
    if (!part.length) return;
    const sec = document.createElement('div'); sec.className = 'honor-group';
    const h = document.createElement('h3'); h.textContent = KIND_NAME[kd] + ' ';
    const n = document.createElement('span'); n.textContent = part.length; h.appendChild(n);
    if (kd === 'level'){
      // 급수는 종목끼리 모아 높은 단계부터 — 「태권도: 노란띠 → 초록띠」가 한눈에
      const byTrack = {};
      part.forEach(r => { (byTrack[r.track] = byTrack[r.track] || []).push(r); });
      sec.appendChild(h);
      Object.keys(byTrack).forEach(t => {
        const rs = byTrack[t].slice().sort((a, b) => (b.step || 0) - (a.step || 0));
        const sub = document.createElement('p'); sub.className = 'track-head';
        sub.textContent = '🪜 ' + t + ' — 지금 ' + rs[0].title + (rs[0].step ? ' (' + rs[0].step + '단계)' : '') +
          (rs.length > 1 ? ' · ' + rs.slice().reverse().map(r => r.title).join(' → ') : '');
        const grid = document.createElement('div'); grid.className = 'honor-grid';
        rs.forEach(r => grid.appendChild(cardOf(r)));
        sec.append(sub, grid);
      });
      box.appendChild(sec);
      return;
    }
    const grid = document.createElement('div'); grid.className = 'honor-grid';
    part.forEach(r => grid.appendChild(cardOf(r)));
    sec.append(h, grid); box.appendChild(sec);
  });
}
function cardOf(r){
  const el = document.createElement('div'); el.className = 'dot-card honor-card';
  const pic = document.createElement('button');
  pic.type = 'button'; pic.className = 'pic'; pic.setAttribute('aria-label', r.title + ' 크게 보기');
  if (r.thumb_url || r.photo_url){ const im = document.createElement('img'); im.loading = 'lazy'; im.alt = ''; im.src = r.thumb_url || r.photo_url; pic.appendChild(im); }
  const cv = document.createElement('canvas'); cv.width = 36; cv.height = 36; cv.className = 'mark';
  const cg = cv.getContext('2d'); cg.imageSmoothingEnabled = false;
  drawArtOut(cg, OBJ_ART[lookOf(r)] || OBJ_ART.star, 2, 2, 2, itemColor(r));
  pic.appendChild(cv);
  pic.addEventListener('click', () => openItem(r));
  const body = document.createElement('div'); body.className = 'txt';
  const b = document.createElement('b'); b.textContent = (r.kind === 'level' ? r.track + ' ' : '') + r.title;
  const sm = document.createElement('small');
  sm.textContent = [r.kind === 'level' && r.step ? r.step + '단계' : '', r.org, fmtDate(r.got_on), r.who === 'both' ? '둘이 함께' : ''].filter(Boolean).join(' · ');
  body.append(b, sm);
  const s = sayOf(r, kid);
  if (s){ const p = document.createElement('p'); p.className = 'say'; p.textContent = '“' + s + '”'; body.appendChild(p); }
  const acts = document.createElement('div'); acts.className = 'acts';
  const act = (t, fn) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = t; x.addEventListener('click', fn); acts.appendChild(x); };
  act('🔗 링크', () => copyLink(r));
  if (isAdmin) act('✎ 고치기', () => openForm(r));
  if (isChild && me && me.author_key === kid && (r.who === kid || r.who === 'both')) act('💬 한마디', () => openSay(r));
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
  async function jpeg(c, limit){
    let q = 0.88, blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    while (blob && blob.size > limit && q > 0.5){ q -= 0.08; blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); }
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
        '<div><label class="field">종류</label><select class="fKind" aria-label="종류"><option value="award">상장·메달</option><option value="level">급수</option><option value="first">처음 해낸 것</option></select></div>' +
      '</div>' +
      '<label class="field">모양</label><select class="fLook" aria-label="모양"></select>' +
      '<div class="fLevel">' +
        '<div class="row2">' +
          '<div><label class="field">종목</label><input type="text" class="fTrack" list="honorTracks" maxlength="20" placeholder="예: 태권도" aria-label="종목">' +
            '<datalist id="honorTracks">' + tracks.map(t => '<option value="' + escapeHTML(t) + '">').join('') + '</datalist></div>' +
          '<div><label class="field">몇 번째 단계</label><input type="number" class="fStep" min="1" max="99" aria-label="몇 번째 단계"></div>' +
        '</div>' +
        '<label class="field">색 (띠·배지)</label><input type="color" class="fColor" aria-label="색">' +
      '</div>' +
      '<label class="field fTitleL">제목</label><input type="text" class="fTitle" maxlength="60" aria-label="제목">' +
      '<div class="fOrgW"><label class="field">주는 곳 (선택)</label><input type="text" class="fOrg" maxlength="40" aria-label="주는 곳" placeholder="예: 줄넘기 학원"></div>' +
      '<label class="field">받은 날</label><input type="date" class="fDate" aria-label="받은 날">' +
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
  const sync = () => {
    const kd = q('.fKind').value, cur = q('.fLook').value || v.look;
    q('.fLook').innerHTML = Object.keys(LOOK).filter(l => LOOK[l].kind === kd).map(l => '<option value="' + l + '">' + LOOK[l].name + '</option>').join('');
    if (LOOK[cur] && LOOK[cur].kind === kd) q('.fLook').value = cur;
    q('.fLevel').hidden = kd !== 'level';
    q('.fOrgW').hidden = kd === 'first';
    q('.fTitleL').textContent = kd === 'level' ? '단계 이름 (예: 노란띠, 5급)' : kd === 'first' ? '해낸 일 (예: 두발자전거 혼자 타기)' : '상 이름 (예: 줄넘기 대회 은상)';
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
    if (kd === 'level' && !track){ msg.textContent = '급수는 종목을 적어 주세요 (예: 태권도).'; return; }
    if (kd === 'level' && !(step >= 1 && step <= 99)){ msg.textContent = '몇 번째 단계인지 숫자로 적어 주세요.'; return; }
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
    if (who !== 'both') kid = who;
    await load();
    say('저장했어요.');
  });
  if (r) q('.fDel').addEventListener('click', async () => {
    if (!confirm('「' + r.title + '」을(를) 저장고에서 뺄까요? 사진도 함께 지워져요.')) return;
    const res = await sb.from('honors').delete().eq('id', r.id).select('id');
    if (res.error || !(res.data && res.data.length)){ q('.fMsg').textContent = '지우지 못했어요: ' + readableError(res.error || new Error('권한이 없어요')); return; }
    await dropFiles([pathOfUrl(r.photo_url), pathOfUrl(r.thumb_url)]);
    close();
    await load();
    say('저장고에서 뺐어요.');
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
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  q('.sCancel').addEventListener('click', close);
  q('.sSave').addEventListener('click', async () => {
    q('.sSave').disabled = true;
    const { error } = await sb.rpc('honor_say', { p_id: r.id, p_text: q('.sText').value });
    if (error){ q('.sMsg').textContent = '저장하지 못했어요: ' + readableError(error); q('.sSave').disabled = false; return; }
    close();
    await load();
    say('한마디를 남겼어요.');
  });
  q('.sText').focus();
}

// ---------- 시작 ----------
$('#addHonor').addEventListener('click', () => openForm(null));
document.addEventListener('suayona:auth', () => render());
(async function boot(){
  try { await refreshAuth(); } catch (e) { /* 로그인 확인이 안 되면 손님으로 본다 */ }
  await load();
  initReveal();
})();
