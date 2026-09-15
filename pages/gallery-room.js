// portfolio.html 의 미술관 방 — 제목 아래 아이소메트릭 방에 수아·연아의 작품이 함께 걸린다(2026-09-15 부모 요청).
// 업적 전시실(honors.js)과 같은 틀(512×484, 칸 56×28, 벽 224)이지만 따로 산다 — honors.js 의 함수는
// 최상위 선언이라 여기서 못 가져오고, 공유 파일로 빼면 캐시된 옛 honors.js 의 const 와 부딪힌다(kid-art.js 때 겪음).
// 그래서 필요한 원시 함수(칸 좌표·벽 좌표·상자·벽 네모)는 여기에 다시 적었다. 밖으로는 window.GALLERY 만 내놓는다.
//   GALLERY.render(list, open, { year }) — list: 보이는 작품(거르개 적용), open(i): i번째 작품을 크게 연다, year: 연도 거르개('all' 또는 '2026').
// 벽에는 사진 작품의 작은 그림(thumb_url)을 액자에 넣어 건다 — 큰 액자 3(가로형 우선) + 작은 액자 24(오른쪽 벽 16 + 왼쪽 벽 8).
// 가장 새 작품 하나는 방 앞 이젤에 크게. 영상은 바닥의 텔레비전(섬네일이 4초마다 바뀌고, 누르면 그 영상). 두 아이가 같이 걸어 다닌다.
// 2026-09-15 밤 열 가지 더(부모 「전부 진행해」): ① 액자 이름표에 제목·작가·날짜 ② 아이가 새 작품 앞으로 걸어가 안내 ③ 텔레비전에 영상 섬네일
// ④ 연도를 바꾸면 방이 옆으로 밀리며 그 해의 벽지·양탄자로 ⑤ 관람객 도트 ⑥ 저녁·밤 조명 ⑦ 이름표 옆 작가 얼굴 ⑧ 가로형 그림을 큰 액자에
// ⑨ 27칸을 넘으면 마지막 네 칸을 날마다 바꿔 건다 ⑩ 박수(work_claps) — 큰 화면에서 치고, 방에서는 수와 리본으로 보인다.
// 2026-09-15 밤 열 가지 더(부모 「전부진행」): ⓐ 박수 1등 「이달의 그림」 받침대 ⓑ 관람객이 큰 액자 앞에 오래 서고 리본 작품엔 손뼉 ⓒ 관람객 넷(어른·아이·할머니·강아지)
// ⓓ 텔레비전을 누르면 방 안에 작은 재생기 ⓔ 부모 편집 모드(액자 끌어 바꿔 걸기 → works.wall_slot) ⓕ (연도 도장 — 부모 요청으로 뺌) ⓖ 밤엔 관객 대신 경비 아저씨가 손전등을 들고 한 바퀴
// ⓗ 「같이」 이름표의 두 얼굴 사이 하트 ⓘ 방 사진 저장·나누기 ⓙ (DB) 박수 시각 잠금·안 쓰는 함수 정리
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const RW = 512, RH = 484, TW = 56, TH = 28, NI = 12, NJ = 6, FX = 172, FY = 242, WALLH = 224;   // 벽 136 → 224(액자 두 줄 44씩, 2026-09-15 부모 요청). 바꾸면 portfolio.html 의 canvas height·aspect-ratio 도
  const CORNER = { x: FX, y: FY - TH / 2 }, WTOP = CORNER.y - WALLH;
  const LWr = NI * (TW / 2), LWl = NJ * (TW / 2);
  const KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3', together: '#ffd979' };
  const KID_NAME = { sua: '수아', yona: '연아', together: '같이' };
  const KID_HAIR = { sua: '#3f2d23', yona: '#a0562c' };
  const KIDS = ['sua', 'yona'];
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const INK = '#2a2118', FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  // 해마다 벽지·양탄자가 바뀐다(④). 전체 보기는 올해 것
  const THEMES = [{ wall: '#efe8da', rug: '#8e2f3a' }, { wall: '#e9e8e0', rug: '#2f4a7a' }, { wall: '#efe3df', rug: '#3f7a4a' }, { wall: '#e6ebe0', rug: '#6a3f8a' }];
  const themeIdx = y => ((Number(y === 'all' ? new Date().getFullYear() : y) || 0) % 4 + 4) % 4;

  // ---------- 원시 그리기 (honors.js 와 같은 식) ----------
  function shade(hex, d){
    const n = parseInt(String(hex).slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, v + d)));
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }
  function prand(k){ let h = 2166136261; for (let i = 0; i < k.length; i++){ h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }
  function tileXY(i, j){ return { x: FX + (i - j) * (TW / 2), y: FY + (i + j) * (TH / 2) }; }
  function wallXY(side, u, v, d){
    const k = d || 0;
    return side ? { x: CORNER.x + u - k * 28, y: WTOP + v + u / 2 + k * 14 } : { x: CORNER.x - u - 2 + k * 28, y: WTOP + v + u / 2 + k * 14 };
  }
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
    for (let k = -hh; k < hh; k++){ const w = Math.round(hw * (1 - Math.abs(k + 0.5) / hh)); if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + k), w * 2, 1); }
  }
  function isoBandD(g, cx, cy, hw, hh, H, left, right, up){
    const base = cy - (up || 0);
    for (let dx = -hw; dx < hw; dx++){ const edge = base + Math.round((hw - Math.abs(dx)) * (hh / hw)); g.fillStyle = dx < 0 ? left : right; g.fillRect(Math.round(cx + dx), Math.round(edge - H), 1, H); }
  }
  function isoBoxD(g, cx, cy, hw, hh, H, top, left, right, up){ isoBandD(g, cx, cy, hw, hh, H, left, right, up); isoTopD(g, cx, cy - (up || 0) - H, hw, hh, top); }
  function wallRect(g, side, u, v, w, h, c, d){
    g.fillStyle = c;
    for (let du = 0; du < w; du++){ const p = wallXY(side, u + du, v, d); g.fillRect(Math.round(p.x), Math.round(p.y), 1, h); }
  }
  function wallHit(side, u, v, w, h, d){
    const a = wallXY(side, u, v, d), b = wallXY(side, u + w, v, d);
    return side ? { x0: a.x - 2, x1: b.x + 2, y0: a.y - 3, y1: b.y + h + 3 } : { x0: b.x - 2, x1: a.x + 3, y0: a.y - 3, y1: b.y + h + 3 };
  }
  // 벽에 붙인 사진 — 한 칸 폭씩 벽 기울기대로 잘라 붙인다(src 는 2배 크기의 작은 캔버스)
  function wallImage(g, side, u, v, w, h, src){
    for (let du = 0; du < w; du++){
      const p = wallXY(side, u + du, v), sx = side ? du : w - 1 - du;   // 왼쪽 벽은 u 가 화면 왼쪽으로 가니 사진이 뒤집히지 않게
      g.drawImage(src, sx * 2, 0, 2, h * 2, Math.round(p.x), Math.round(p.y), 1, h);
    }
  }
  // 벽면에 기운 글자 — 오른쪽 벽(side 1)은 오른쪽으로 갈수록 내려가고, 왼쪽 벽은 올라간다
  function wallText(g, side, u, v, text, font, col, align){
    const p = wallXY(side, u, v), dir = side ? 1 : -1;
    g.save(); g.transform(1, dir / 2, 0, 1, 0, 0);
    g.font = font; g.fillStyle = col; g.textBaseline = 'top'; g.textAlign = align || 'left';
    g.fillText(text, p.x, p.y - dir * p.x / 2); g.restore();
  }
  // 벽과 나란한 면(가구) — dir 1 은 오른쪽 벽 방향, -1 은 왼쪽 벽 방향
  function slantRect(g, x, y, w, h, dir, col){ g.fillStyle = col; for (let du = 0; du < w; du++) g.fillRect(Math.round(x + du), Math.round(y + du * dir / 2), 1, h); }
  function slantImage(g, x, y, w, h, dir, src){ for (let du = 0; du < w; du++) g.drawImage(src, du * 2, 0, 2, h * 2, Math.round(x + du), Math.round(y + du * dir / 2), 1, h); }
  function slantText(g, text, x, y, dir, font, col, align){
    g.save(); g.transform(1, dir / 2, 0, 1, 0, 0);
    g.font = font; g.fillStyle = col; g.textBaseline = 'top'; g.textAlign = align || 'left';
    g.fillText(text, x, y - dir * x / 2); g.restore();
  }
  function dayPhase(){
    const q = new URLSearchParams(location.search).get('phase');
    if (q === 'day' || q === 'dusk' || q === 'night') return q;
    const h = new Date().getHours();
    return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
  }
  const short = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const todayStr = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const dayNum = () => Math.floor(Date.now() / 86400000 + new Date().getTimezoneOffset() / -1440);
  const PLANT = [
    '.......gg.......', '......gGGg......', '.....gGGGGg.....', '..gg.gGGgGg.gg..', '.gGGgGGgggGgGGg.', 'gGGGGGgGgGgGGGGg',
    '.gGGgGGgGgGGgGg.', '..ggGGGGGGGGgg..', '....gGGgggGg....', '.....gggggg.....', '......nNNn......', '.....nNNNNn.....',
    '.....nnnnnn.....', '.....nNNNNn.....', '.....nNNNNn.....', '......nnnn......',
  ];
  const PPAL = { g: '#2f7a3e', G: '#5cb85c', n: '#a0522d', N: '#c8794a' };
  function drawPlant(g, x, y){
    isoTile(g, x + 3, y + 8, 'rgba(40,24,10,.22)', 14);
    for (let r = 0; r < PLANT.length; r++) for (let c = 0; c < PLANT[r].length; c++){ if (PLANT[r][c] === '.') continue; g.fillStyle = '#1f2a1a'; g.fillRect(x + c * 2 - 1, y + r * 2 - 1, 4, 4); }
    for (let r = 0; r < PLANT.length; r++) for (let c = 0; c < PLANT[r].length; c++){ const ch = PLANT[r][c]; if (ch === '.') continue; g.fillStyle = PPAL[ch]; g.fillRect(x + c * 2, y + r * 2, 2, 2); }
  }

  // ---------- 자리 ----------
  // 액자: 작은 액자(사진 36×26)는 칸 간격 52·줄 간격 44. 큰 액자(사진 88×70)는 작은 액자 2×2 칸을 차지한다 — 2026-09-15 부모가 세 곳을 골랐다:
  // 왼쪽 벽 위 모서리에서 먼 쪽(1~2칸, 0~1줄), 오른쪽 벽 가운데(1~2칸, 1~2줄), 오른쪽 벽 아래 오른쪽(4~5칸, 2~3줄). 나머지는 작은 액자 24칸 — 모두 27칸.
  // 채우는 차례: 큰 액자 셋(이젤 다음으로 새 가로형 작품)부터, 그다음 작은 액자를 오른쪽 벽 윗줄부터.
  const FW = 36, FH = 26, ROWS = [14, 58, 102, 146];
  const ru = c => 18 + c * 52, lu = c => 16 + c * 50;
  const BIG = [{ side: 0, c: 1, r: 0 }, { side: 1, c: 1, r: 1 }, { side: 1, c: 4, r: 2 }];   // 왼쪽 벽은 모서리에서 먼 두 칸(u 가 모서리에서 멀어지는 쪽)
  const SLOTS = BIG.map(b => ({ side: b.side, u: (b.side ? ru : lu)(b.c), v: ROWS[b.r], w: (b.side ? 52 : 50) + FW, h: 44 + FH, big: true }));
  const covered = (side, c, r) => BIG.some(b => b.side === side && c >= b.c && c <= b.c + 1 && r >= b.r && r <= b.r + 1);
  ROWS.forEach((v, r) => {
    for (let c = 0; c < 6; c++) if (!covered(1, c, r)) SLOTS.push({ side: 1, u: ru(c), v, w: FW, h: FH });
    for (let c = 0; c < 3; c++) if (!covered(0, c, r)) SLOTS.push({ side: 0, u: lu(c), v, w: FW, h: FH });
  });
  const ROTATE = 4;                                                      // ⑨ 넘치면 마지막 네 칸을 날마다 바꿔 건다
  const EASEL = tileXY(9.7, 4.3), TV = tileXY(1.0, 4.7), BENCH = tileXY(6.0, 3.4), PLANT_AT = tileXY(0.55, 0.55);   // 텔레비전은 왼쪽 벽에 붙여서(1.7 → 1.0, 2026-09-15 부모 요청)
  const PLINTH = tileXY(4.6, 5.55);                                      // ⓐ 이달의 그림 받침대 — 방 앞쪽 가운데 왼편
  const GREET_SPOT = { i: 8.6, j: 4.9 };                                 // ② 이젤 앞에 서는 자리(이젤이 오른쪽에 보인다)
  const WALK_BOX = { i0: 0.3, i1: 10.9, j0: 0.9, j1: 5.1 };
  const WALK_BLOCK = [{ i: 5.1, j: 3.4, r: 1.05 }, { i: 6.9, j: 3.4, r: 1.05 }, { i: 9.7, j: 4.3, r: 1.1 }, { i: 1.0, j: 4.7, r: 1.35 }, { i: 0.55, j: 0.55, r: 1.1 }, { i: 4.6, j: 5.55, r: 0.9 }];

  // ---------- 상태 ----------
  let list = [], openFn = null, year = 'all', images = [], videos = [], easelW = null, hung = [], hits = [], hoverKey = null, focusKey = null;
  let claps = {}, clapsState = 'idle', clapsTotal = 0, overflowNote = '';
  let tvIdx = 0, tvTimer = null;
  let admin = false, editMode = false, drag = null, capturing = false, tvPlaying = null;   // ⓔ ⓘ ⓓ
  const TV_MAX = 8;                                                    // 텔레비전이 돌려 보여 주는 영상 수(가장 새 것부터)

  // ---------- 껍데기 — 벽·바닥·양탄자·화분(연도 무늬·시간대마다 한 번) ----------
  const shells = {};
  function shellCv(){
    const phase = dayPhase(), th = THEMES[themeIdx(year)], key = phase + ':' + themeIdx(year);
    if (shells[key]) return shells[key];
    const c = document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
    const night = phase !== 'day';
    [1, 0].forEach(side => {
      const len = side ? LWr : LWl, dim = side ? 0 : -14;
      for (let u = side ? 0 : -1; u < len; u++) for (let v = 0; v < WALLH; v++){
        let base, d = 0;
        if (v < 3) base = '#f8f3e8';                                                        // 천장 몰딩
        else if (v < 5) base = '#cdbfa6';
        else if (v < 8) base = '#3a3634';                                                   // 조명 레일
        else if (v >= WALLH - 5) base = '#4a4038';                                          // 굽도리
        else if (v === WALLH - 6) base = '#8a7a68';
        else { base = th.wall; d = Math.round((prand('w' + side + ':' + (u >> 3) + ':' + (v >> 3)) - 0.5) * 4) + Math.round(5 - v * 9 / WALLH); }   // 미술관 벽(연도 색)
        const p = wallXY(side, u, v);
        g.fillStyle = shade(base, d + dim); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      // 레일의 조명 — 윗줄 액자 자리마다 하나, 아래로 빛. 저녁·밤엔 훨씬 또렷하다(⑥)
      SLOTS.filter(s => s.side === side && s.v === ROWS[0]).forEach(s => {
        const cu = s.u + s.w / 2, gain = night ? 0.5 : 0.24;
        wallRect(g, side, cu - 3, 6, 6, 4, '#2a2624'); wallRect(g, side, cu - 2, 9, 4, 1, night ? '#fff3c4' : '#ffe9a8');
        if (night){ wallRect(g, side, cu - 4, 8, 8, 3, 'rgba(255,240,180,.35)'); }
        for (let v = 10; v < WALLH - 8; v++){ const hw = Math.min(30, 4 + (v - 10) * 0.55); g.fillStyle = 'rgba(255,240,200,' + (gain * (1 - (v - 10) / WALLH)).toFixed(3) + ')'; for (let du = -hw; du < hw; du++){ const p = wallXY(side, cu + du, v); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); } }
      });
    });
    for (let i = 0; i < 14; i++){                                                            // 모서리 그늘
      const a = (0.16 * (1 - i / 14)).toFixed(3);
      for (let v = 0; v < WALLH; v++){
        const pr = wallXY(1, i, v), pl = wallXY(0, i, v);
        g.fillStyle = 'rgba(40,24,10,' + a + ')';
        g.fillRect(Math.round(pr.x), Math.round(pr.y), 1, 1); g.fillRect(Math.round(pl.x), Math.round(pl.y), 1, 1);
        if (i === 0){ const pc = wallXY(0, -1, v); g.fillRect(Math.round(pc.x), Math.round(pc.y), 1, 1); }
      }
    }
    // 바닥 — 밝은 쪽마루
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++){
      const p = tileXY(i, j);
      isoTile(g, p.x, p.y, '#8a6a48', 0);
      const t = Math.floor(prand('f' + i + ':' + j) * 3) - 1;
      isoTile(g, p.x, p.y, shade((i + j) % 2 ? '#dcc09a' : '#cfb088', t * 4 - j * 2), 1);
      g.fillStyle = shade('#c3a274', -j * 2);
      g.fillRect(Math.round(p.x - 14), Math.round(p.y - 3), 12, 1); g.fillRect(Math.round(p.x + 2), Math.round(p.y + 2), 12, 1);
    }
    // 가운데 양탄자(연도 색)
    const rug = tileXY(6.0, 3.1), RC = th.rug;
    for (let k = -25; k <= 25; k++){
      const hw = Math.round((1 - Math.abs(k) / 26) * 100); if (hw <= 0) continue;
      const edge = Math.abs(k) > 21;
      g.fillStyle = edge ? shade(RC, -40) : shade(RC, k % 6 === 0 ? -8 : 0);
      g.fillRect(Math.round(rug.x - hw), Math.round(rug.y + k * 2), hw * 2, 2);
      if (!edge && Math.abs(k) < 8){ const hw2 = Math.round((1 - Math.abs(k) / 8) * 30); g.fillStyle = shade(RC, 14); g.fillRect(Math.round(rug.x - hw2), Math.round(rug.y + k * 2), hw2 * 2, 2); }
    }
    drawPlant(g, Math.round(PLANT_AT.x - 16), Math.round(PLANT_AT.y - 30));
    if (night){ g.fillStyle = phase === 'dusk' ? 'rgba(90,40,20,.12)' : 'rgba(16,20,60,.26)'; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, RW, RH); g.globalCompositeOperation = 'source-over'; }
    return (shells[key] = c);
  }

  // ---------- 작품 사진 — 작은 캔버스로 미리 줄여 둔다(그대로 줄이면 도트가 튄다) ----------
  const thumbs = {}, aspectOf = {};                                      // id|w×h → { cv, ok } · id → 가로/세로
  let onThumb = null;
  function loadInto(cv, url, cors, done){
    const g = cv.getContext('2d'), img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      const s = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);        // 꽉 채우고 가운데를 남긴다
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      done(img.naturalWidth / img.naturalHeight);
    };
    img.src = url;
  }
  function thumbOf(w, W, H){
    const key = w.id + '|' + W + 'x' + H;
    if (thumbs[key]) return thumbs[key];
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const g = cv.getContext('2d'), col = KID_COLOR[w.author] || KID_COLOR.together;
    g.fillStyle = shade(col, 60); g.fillRect(0, 0, cv.width, cv.height);                   // 받는 동안은 옅은 아이 색
    g.fillStyle = shade(col, 10); g.fillRect(W - 6, H - 6, 12, 12);
    const t = (thumbs[key] = { cv, ok: false });
    const url = w.thumb_url || w.media_url;
    if (url) loadInto(cv, url, true, ar => { t.ok = true; aspectOf[w.id] = ar; if (onThumb) onThumb(); });
    return t;
  }
  // 유튜브 섬네일(③) — i.ytimg.com 은 CORS 헤더가 없어 crossOrigin 없이 받는다. 캔버스가 「더럽혀져」 픽셀은 못 읽지만 이 방은 픽셀을 읽지 않는다
  const tvThumbs = {};
  function tvThumbOf(w, W, H){
    const key = w.id + '|' + W + 'x' + H;
    if (tvThumbs[key]) return tvThumbs[key];
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const t = (tvThumbs[key] = { cv, ok: false });
    const id = typeof youtubeId === 'function' ? youtubeId(w.media_url) : '';
    const off = /[?&]tv=off\b/.test(location.search);                  // 시험용 — 섬네일이 캔버스를 더럽히면 그림을 못 뽑는다
    if (id && !off) loadInto(cv, 'https://i.ytimg.com/vi_webp/' + id + '/mqdefault.webp', false, () => { t.ok = true; draw(); });
    return t;
  }

  // ---------- 벽 층 — 액자와 사진(작품 목록·받은 사진 수·박수가 바뀔 때만) ----------
  let wallCv = null, wallKey = '';
  function frameColor(w){ return KID_COLOR[w.author] || KID_COLOR.together; }
  // 이름표 옆 작가 얼굴(⑦) — 머리 4×2 + 얼굴 4×2 + 눈 둘. 「같이」는 둘 다
  function drawFace(g, side, u, v, k){
    wallRect(g, side, u, v, 4, 2, KID_HAIR[k]); wallRect(g, side, u, v + 2, 4, 2, '#fbdcc4');
    wallRect(g, side, u + 1, v + 2, 1, 1, INK); wallRect(g, side, u + 3, v + 2, 1, 1, INK);
  }
  function drawFrameAt(g, s, w){
    const c = frameColor(w), W = s.w, H = s.h, t = thumbOf(w, W, H), b = s.big ? 2 : 0;    // 큰 액자는 테가 두 도트 더 두껍고 금테가 한 줄 더
    wallRect(g, s.side, s.u + 3, s.v + 3, W + 6 + b, H + 6 + b, 'rgba(40,24,10,.22)');       // 그림자
    wallRect(g, s.side, s.u - 3 - b, s.v - 3 - b, W + 6 + b * 2, H + 6 + b * 2, INK);
    wallRect(g, s.side, s.u - 2 - b, s.v - 2 - b, W + 4 + b * 2, H + 4 + b * 2, shade(c, -30));
    wallRect(g, s.side, s.u - 1 - b, s.v - 1 - b, W + 2 + b * 2, H + 2 + b * 2, c);
    wallRect(g, s.side, s.u - 1 - b, s.v - 1 - b, W + 2 + b * 2, 1, shade(c, 40));
    if (s.big){ wallRect(g, s.side, s.u - 1, s.v - 1, W + 2, H + 2, '#c9a24a'); wallRect(g, s.side, s.u - 1, s.v - 1, W + 2, 1, '#f0d78a'); }   // 안쪽 금테
    wallImage(g, s.side, s.u, s.v, W, H, t.cv);
    const pv = s.v + H + 6 + b;                                                              // 이름표 — 얼굴 + 제목 줄
    wallRect(g, s.side, s.u + 2, pv, W - 4, 6, '#e6dccb'); wallRect(g, s.side, s.u + 2, pv + 5, W - 4, 1, '#a09484');
    if (w.author === 'together'){                                                           // ⓗ 두 얼굴 사이 하트
      drawFace(g, s.side, s.u + 1, pv + 1, 'sua'); drawFace(g, s.side, s.u + 10, pv + 1, 'yona');
      wallRect(g, s.side, s.u + 6, pv + 1, 1, 1, '#d4504a'); wallRect(g, s.side, s.u + 8, pv + 1, 1, 1, '#d4504a');
      wallRect(g, s.side, s.u + 6, pv + 2, 3, 1, '#d4504a'); wallRect(g, s.side, s.u + 7, pv + 3, 1, 1, '#a83a34');
    }
    else drawFace(g, s.side, s.u + 3, pv + 1, KID_HAIR[w.author] ? w.author : 'sua');
    const tw = Math.max(6, Math.min(W - 18 - (w.author === 'together' ? 5 : 0), (w.title || '').length * 3));
    wallRect(g, s.side, s.u + (w.author === 'together' ? 15 : 9), pv + 2, tw, 1, '#6f6558');
    const n = claps[w.id] || 0;                                                             // ⑩ 박수 다섯부터 리본
    if (n >= 5){
      const rx = s.u + W - 6 + b, ry = s.v - 6 - b;
      wallRect(g, s.side, rx - 1, ry - 1, 8, 8, INK); wallRect(g, s.side, rx, ry, 6, 6, n >= 20 ? '#e0a93b' : '#d4504a');
      wallRect(g, s.side, rx + 1, ry + 6, 2, 5, n >= 20 ? '#b9812c' : '#a83a34'); wallRect(g, s.side, rx + 3, ry + 6, 2, 4, n >= 20 ? '#b9812c' : '#a83a34');
      wallRect(g, s.side, rx + 2, ry + 2, 2, 2, '#fff3c4');
    }
  }
  function bakeWall(){
    const key = hung.map((w, n) => w ? w.id + ':' + (thumbOf(w, SLOTS[n].w, SLOTS[n].h).ok ? 1 : 0) + ':' + (claps[w.id] || 0) : '-').join(',');
    if (wallCv && key === wallKey) return wallCv;
    wallKey = key;
    const c = wallCv || document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
    hits = hits.filter(h => !h.slot);
    SLOTS.forEach((s, n) => {
      const w = hung[n];
      if (w){ drawFrameAt(g, s, w); hits.push(Object.assign({ w, slot: true, s }, wallHit(s.side, s.u - 5, s.v - 5, s.w + 10, s.h + 18, 0))); return; }
      const col = 'rgba(110,90,70,.22)';                                                    // 빈 자리 — 점선 테
      for (let d = 0; d < s.w + 4; d += 6){ wallRect(g, s.side, s.u - 2 + d, s.v - 2, 2, 1, col); wallRect(g, s.side, s.u - 2 + d, s.v + s.h + 1, 2, 1, col); }
      for (let d = 0; d < s.h + 4; d += 5){ wallRect(g, s.side, s.u - 2, s.v - 2 + d, 1, 2, col); wallRect(g, s.side, s.u + s.w + 1, s.v - 2 + d, 1, 2, col); }
    });
    return (wallCv = c);
  }
  // 이름표 크게(①) — 누르거나 마우스를 올린 액자 아래에 제목·작가·날짜·박수
  function captionLines(w){ return [short(w.title || '작품', 18), (KID_NAME[w.author] || '같이') + (w.made_on ? ' · ' + w.made_on.slice(0, 7).replace('-', '.') : '') + (claps[w.id] ? ' · 👏 ' + claps[w.id] : '')]; }
  function drawPlaque(g, h){
    const w = h.w, [l1, l2] = captionLines(w);
    g.font = '800 8px ' + FONT; const w1 = g.measureText(l1).width; g.font = '700 7px ' + FONT; const w2 = g.measureText(l2).width;
    const pw = Math.round(Math.max(w1, w2)) + 10, ph = 22;
    if (h.s){
      const s = h.s, u = s.u + s.w / 2 - pw / 2, v = s.v + s.h + 13 + (s.big ? 2 : 0);
      wallRect(g, s.side, u - 1, v - 1, pw + 2, ph + 2, INK); wallRect(g, s.side, u, v, pw, ph, '#fff8ea'); wallRect(g, s.side, u, v, pw, 1, '#ffffff');
      const tu = s.side ? u + 5 : u + pw - 5;                                              // 왼쪽 벽은 u 가 클수록 화면 왼쪽이라, 큰 u 에서 오른쪽으로 써 나간다
      wallText(g, s.side, tu, v + 3, l1, '800 8px ' + FONT, INK, 'left');
      wallText(g, s.side, tu, v + 13, l2, '700 7px ' + FONT, '#6f6558', 'left');
    } else {                                                                                // 이젤 — 판 아래, 오른쪽 벽 방향으로 기운 이름표
      const x = Math.round(EASEL.x) - pw / 2, y = Math.round(EASEL.y) - 18;
      slantRect(g, x - 1, y - 1, pw + 2, ph + 2, 1, INK); slantRect(g, x, y, pw, ph, 1, '#fff8ea');
      slantText(g, l1, x + 5, y + 3, 1, '800 8px ' + FONT, INK); slantText(g, l2, x + 5, y + 13, 1, '700 7px ' + FONT, '#6f6558');
    }
  }

  // ---------- 바닥 물건 — 의자·이젤·텔레비전(아이와 앞뒤를 맞춰 살아서 그린다) ----------
  function drawBench(g){
    const x = Math.round(BENCH.x), y = Math.round(BENCH.y);
    isoTopD(g, x + 2, y + 3, 40, 20, 'rgba(40,24,10,.22)');
    isoBoxD(g, x, y, 30, 15, 9, '#4a3b30', '#3a2d24', '#2b2119', 0);                        // 받침(짙은 나무)
    isoBoxD(g, x, y, 36, 18, 5, '#8a7561', '#5e4d3f', '#4a3c31', 9);                        // 앉는 판
    isoBoxD(g, x, y, 33, 16, 5, '#b8433f', '#8a2f2c', '#6e2422', 14);                       // 방석
    isoTopD(g, x, y - 19, 28, 14, '#c9524e');
  }
  // 이젤 — 오른쪽 벽과 나란히 선 A자 이젤. 금테 액자, 앞 받침대, 뒤로 뻗은 다리, 바닥 그림자(2026-09-15 부모 요청: 사선·고급스럽게)
  function drawEasel(g){
    const x = Math.round(EASEL.x), y = Math.round(EASEL.y), W = 46, H = 34, dir = 1;
    const x0 = x - W / 2, yb = du => y - 30 + (du - W / 2) / 2;                              // 판 아랫선(기울어진다)
    isoTopD(g, x + 4, y + 2, 26, 9, 'rgba(40,24,10,.22)');
    const wood = '#7a5230', woodD = '#4e3220', woodL = '#a8783f';
    { const top = yb(W / 2) - H + 4, foot = y - 6;                                           // 뒷다리 — 판 뒤 경첩에서 벽 쪽으로 물러나 선다(판에 가려진 부분은 안 보인다)
      for (let k = 0; top + k <= foot; k++){ const dx = Math.round(k / (foot - top) * 12); g.fillStyle = wood; g.fillRect(x + 2 + dx, top + k, 2, 1); g.fillStyle = woodD; g.fillRect(x + 3 + dx, top + k, 1, 1); }
      g.fillStyle = woodD; g.fillRect(x + 13, foot, 4, 2); }
    [[6, -1], [W - 6, 1]].forEach(([du, sp]) => {                                            // 앞다리 둘 — 아래로 갈수록 바깥으로 벌어진다
      const top = yb(du) - H - 6, foot = y + (du - W / 2) / 2 + 2;
      for (let k = 0; top + k < foot; k++){ const dx = Math.round(k / (foot - top) * 3) * sp; g.fillStyle = wood; g.fillRect(x0 + du + dx, top + k, 2, 1); g.fillStyle = woodL; g.fillRect(x0 + du + dx, top + k, 1, 1); }
      g.fillStyle = woodD; g.fillRect(x0 + du + sp * 3 - 1, Math.round(foot) - 1, 4, 2);
    });
    if (!easelW){ slantRect(g, x0, yb(0) - H, W, H, dir, '#f4ecdc'); slantRect(g, x0, yb(0) - H, W, 1, dir, '#ffffff'); return; }
    const c = frameColor(easelW), t = thumbOf(easelW, W, H), fy = yb(0) - H;
    for (let k = 1; k <= 3; k++) slantRect(g, x0 - 4 - k, fy - 4 - k / 2, 1, H + 8, dir, k === 3 ? '#5a4520' : '#8a6a2a');   // 왼쪽 끝 두께
    slantRect(g, x0 - 5, fy - 5, W + 10, H + 10, dir, INK);
    slantRect(g, x0 - 4, fy - 4, W + 8, H + 8, dir, '#c9a24a');
    slantRect(g, x0 - 4, fy - 4, W + 8, 1, dir, '#f0d78a'); slantRect(g, x0 - 4, fy + H + 2, W + 8, 2, dir, '#8a6a2a');
    slantRect(g, x0 - 2, fy - 2, W + 4, H + 4, dir, '#fff8ea');
    slantRect(g, x0 - 1, fy - 1, W + 2, H + 2, dir, shade(c, -10));
    slantImage(g, x0, fy, W, H, dir, t.cv);
    for (let k = 0; k < 3; k++) slantRect(g, x0 - 6 + k, yb(0) + 3 + k / 2, W + 12, 1, dir, woodL);   // 앞 받침대
    slantRect(g, x0 - 3, yb(0) + 4.5, W + 12, 3, dir, wood); slantRect(g, x0 - 3, yb(0) + 7.5, W + 12, 1, dir, woodD);
    const tx = x0 + W - 8, ty = fy - 12 + (W - 8) / 2;                                       // NEW 꼬리표
    slantRect(g, tx - 1, ty - 1, 18, 9, dir, INK); slantRect(g, tx, ty, 16, 7, dir, '#ffd979');
    slantText(g, 'NEW', tx + 2, ty + 1, dir, '800 6px ' + FONT, INK);
    const n = claps[easelW.id] || 0;
    if (n >= 5){ slantRect(g, x0 - 8, fy - 8 - 4, 8, 8, dir, INK); slantRect(g, x0 - 7, fy - 7 - 3.5, 6, 6, dir, n >= 20 ? '#e0a93b' : '#d4504a'); slantRect(g, x0 - 6, fy - 1 - 3, 4, 5, dir, n >= 20 ? '#b9812c' : '#a83a34'); }
  }
  // 텔레비전(③ 섬네일, 부모 요청: 더 크게·최신식) — 왼쪽 벽과 나란한 얇은 16:9 화면, 가느다란 받침, 낮고 매끈한 검은 장
  const TVW = 60, TVH = 34;
  function drawTV(g){
    const x = Math.round(TV.x), y = Math.round(TV.y), dir = -1, W = TVW, H = TVH, night = dayPhase() !== 'day';
    isoTopD(g, x + 2, y + 3, 30, 15, 'rgba(40,24,10,.24)');
    isoBoxD(g, x, y, 26, 13, 9, '#3a3634', '#242220', '#1a1816', 0);                        // 낮은 검은 장
    isoTopD(g, x, y - 9, 25, 12, '#4a4542'); isoTopD(g, x, y - 9, 22, 10, '#3f3a37');
    slantRect(g, x - 24, y + 2, 10, 5, 1, '#2a2624'); slantRect(g, x - 12, y - 4, 10, 5, 1, '#2a2624');   // 앞면 서랍 둘
    slantRect(g, x - 20, y + 4, 3, 1, 1, '#8a8480'); slantRect(g, x - 8, y - 2, 3, 1, 1, '#8a8480');
    isoTopD(g, x, y - 10, 9, 3, '#1c1a18'); isoTopD(g, x, y - 11, 8, 2, '#5a5652');           // 납작한 받침
    g.fillStyle = '#2a2624'; g.fillRect(x - 1, y - 18, 2, 8);                                // 가는 목
    const bx = x - W / 2, by = du => y - 20 - H + du * dir / 2 + (W / 2) / 2;               // 몸통 윗선(왼쪽 벽 방향)
    slantRect(g, bx + W, by(W), 1, H, dir, '#141210'); slantRect(g, bx + W + 1, by(W) + 0.5, 1, H, dir, '#0c0b0a');   // 얇은 두께
    slantRect(g, bx - 1, by(0) - 1, W + 2, H + 2, dir, INK);
    slantRect(g, bx, by(0), W, H, dir, '#1c1a18');                                           // 얇은 베젤
    const sx = bx + 1, sy = by(0) + 1, SW = W - 2, SH = H - 3, cur = videos[tvIdx % Math.max(1, videos.length)];
    const th = cur ? tvThumbOf(cur, SW, SH) : null;
    if (th && th.ok && !capturing) slantImage(g, sx, sy, SW, SH, dir, th.cv);         // ⓘ 사진으로 뽑을 때는 섬네일을 빼야 캔버스가 안 더럽혀진다
    else { slantRect(g, sx, sy, SW, SH, dir, '#16233a'); for (let du = 0; du < SW; du++){ const p = du / SW; slantRect(g, sx + du, sy, 1, Math.round(3 + (1 - p) * 8), dir, p < 0.35 ? '#2f4a66' : '#22384f'); } }
    if (videos.length){
      const px = sx + 3, py = sy + SH - 9 + 3 * dir / 2;                                     // ▶ 작게 왼쪽 아래
      slantRect(g, px - 1, py - 1 + (0) , 9, 9, dir, 'rgba(0,0,0,.55)');
      for (let k = 0; k < 6; k++){ const hgt = 7 - k; slantRect(g, px + 1 + k, py + 3.5 - hgt / 2 + (1 + k) * dir / 2 * 0, 1, hgt, dir, '#fffaf0'); }
      slantText(g, tvPlaying ? '재생 중' : '영상 ' + videos.length, sx + SW - 2, sy + SH - 9 + (SW - 2) * dir / 2, dir, '800 6px ' + FONT, tvPlaying ? '#7fd08a' : '#ffd979', 'right');
    }
    slantRect(g, bx + W / 2 - 1, by(W / 2) + H - 1, 2, 1, dir, videos.length ? '#7fd08a' : '#6b6562');   // 켜짐 불빛
    if (night && videos.length){ g.save(); g.globalCompositeOperation = 'lighter'; isoTopD(g, x - 8, y + 8, 30, 12, 'rgba(120,170,255,.14)'); g.restore(); }   // 밤엔 화면 빛이 바닥에(⑥)
  }

  // ⓐ 이달의 그림 — 박수를 가장 많이 받은 사진 작품을 대리석 받침대 위 작은 금테 액자에. 박수가 하나도 없으면 안 보인다
  function topWork(){
    let best = null, bn = 0;
    images.forEach(w => { const n = claps[w.id] || 0; if (n > bn){ bn = n; best = w; } });
    return best;
  }
  function drawPlinth(g){
    const w = topWork(); if (!w) return;
    const x = Math.round(PLINTH.x), y = Math.round(PLINTH.y), dir = 1, W = 26, H = 19;
    isoTopD(g, x + 2, y + 3, 20, 10, 'rgba(40,24,10,.22)');
    isoBoxD(g, x, y, 16, 8, 24, '#ece6da', '#cfc6b6', '#b8ae9c', 0);                        // 대리석 기둥
    isoBoxD(g, x, y, 18, 9, 3, '#f6f1e6', '#d8cfbf', '#c2b8a6', 24);                        // 윗판
    for (let k = 0; k < 3; k++){ g.fillStyle = 'rgba(120,100,80,.25)'; g.fillRect(x - 12 + k * 9, y - 14 + k * 3, 6, 1); }   // 결
    const x0 = x - W / 2, yb = du => y - 28 + (du - W / 2) / 2, fy = yb(0) - H;             // 오른쪽 벽 방향으로 기운 작은 액자
    slantRect(g, x0 - 3, fy - 3, W + 6, H + 6, dir, INK); slantRect(g, x0 - 2, fy - 2, W + 4, H + 4, dir, '#c9a24a'); slantRect(g, x0 - 2, fy - 2, W + 4, 1, dir, '#f0d78a');
    slantRect(g, x0 - 1, fy - 1, W + 2, H + 2, dir, '#fff8ea');
    slantImage(g, x0, fy, W, H, dir, thumbOf(w, W, H).cv);
    slantRect(g, x0 - 2, yb(0) + 1, W + 4, 2, dir, '#8a6a2a');                              // 받침 턱
    const n = claps[w.id] || 0;                                                             // 금 리본
    slantRect(g, x0 + W - 4, fy - 6, 8, 8, dir, INK); slantRect(g, x0 + W - 3, fy - 5, 6, 6, dir, '#e0a93b'); slantRect(g, x0 + W - 2, fy + 1, 4, 4, dir, '#b9812c');
    slantRect(g, x - 15, y - 9, 30, 8, dir, INK); slantRect(g, x - 14, y - 8, 28, 6, dir, '#fff3c4');   // 「이달의 그림」 명패
    slantText(g, '이달의 그림 ' + n, x - 13, y - 7, dir, '800 5px ' + FONT, INK);
  }

  // ---------- 걷는 두 아이 (honors.js 의 산책 코드와 같은 식) ----------
  const WALK_SPEED = 0.9, walkers = {};
  const walkBlocked = (i, j) => WALK_BLOCK.some(b => (i - b.i) * (i - b.i) + (j - b.j) * (j - b.j) < b.r * b.r);
  function walkFree(){
    for (let n = 0; n < 40; n++){
      const i = WALK_BOX.i0 + Math.random() * (WALK_BOX.i1 - WALK_BOX.i0), j = WALK_BOX.j0 + Math.random() * (WALK_BOX.j1 - WALK_BOX.j0);
      if (!walkBlocked(i, j)) return { i, j };
    }
    return { i: 3.5, j: 2 };
  }
  function walkClear(a, b){
    const n = Math.ceil(Math.hypot(b.i - a.i, b.j - a.j) / 0.1);
    for (let s = 1; s <= n; s++) if (walkBlocked(a.i + (b.i - a.i) * s / n, a.j + (b.j - a.j) * s / n)) return false;
    return true;
  }
  // 길 찾기 — 곧게 가거나, 방 안 길목 몇 곳을 한두 번 거쳐 간다(가구를 빙 돌아서)
  const WAYPOINTS = [{ i: 6.2, j: 5.0 }, { i: 3.4, j: 4.6 }, { i: 9.6, j: 2.0 }, { i: 3.2, j: 1.8 }, { i: 6.4, j: 1.4 }, { i: 8.8, j: 5.0 }];
  function pathTo(from, to){
    if (walkClear(from, to)) return [to];
    for (const m of WAYPOINTS) if (!walkBlocked(m.i, m.j) && walkClear(from, m) && walkClear(m, to)) return [m, to];
    for (const a of WAYPOINTS) for (const b of WAYPOINTS) if (a !== b && !walkBlocked(a.i, a.j) && !walkBlocked(b.i, b.j) && walkClear(from, a) && walkClear(a, b) && walkClear(b, to)) return [a, b, to];
    return [];
  }
  function walkerOf(k){
    if (!walkers[k]){ const s = walkFree(); walkers[k] = { i: s.i, j: s.j, ti: s.i, tj: s.j, wait: 600 + (k === 'yona' ? 1700 : 0), dir: 'down', flip: false, moving: false, phase: 0 }; }
    return walkers[k];
  }
  function walkKey(w){ const p = tileXY(w.i, w.j); return Math.round(p.x) + ',' + Math.round(p.y) + w.dir + w.flip + (w.moving ? Math.floor(w.phase) % 2 : 0); }
  // 한 걸음 — 그림이 달라졌으면 true. plan(거쳐 갈 자리들)·after(닿으면 돌아서서 할 말)는 안내(②)용
  function stepWalker(k, dt){
    const w = walkerOf(k), other = walkers[k === 'sua' ? 'yona' : 'sua'];
    if (w.wait > 0){ w.wait -= dt; if (w.moving){ w.moving = false; return true; } return false; }
    const di = w.ti - w.i, dj = w.tj - w.j, d = Math.hypot(di, dj);
    if (d < 0.02){
      if (w.plan && w.plan.length){ const p = w.plan.shift(); w.ti = p.i; w.tj = p.j; return false; }
      if (w.after){
        const a = w.after; w.after = null; w.plan = null;
        w.moving = false; w.dir = a.dir; w.flip = !!a.flip; w.wait = a.hold;
        kidSay(k, a.say, a.hold); if (a.done) a.done();
        return true;
      }
      for (let n = 0; n < 16; n++){
        const s = walkFree();
        if (Math.hypot(s.i - w.i, s.j - w.j) > 1.2 && walkClear(w, s) && (!other || Math.hypot(s.i - other.i, s.j - other.j) > 1.3)){ w.ti = s.i; w.tj = s.j; break; }
      }
      const changed = w.moving || w.dir !== 'down';
      w.moving = false; w.dir = 'down'; w.flip = false; w.wait = 1400 + Math.random() * 3600;
      return changed;
    }
    const before = walkKey(w), step = Math.min(d, WALK_SPEED * dt / 1000);
    w.i += di / d * step; w.j += dj / d * step; w.moving = true; w.phase += dt / 260;
    const sx = (di - dj) * TW / 2, sy = (di + dj) * TH / 2;
    if (Math.abs(sx) > Math.abs(sy) * 1.15){ w.dir = 'side'; w.flip = sx < 0; } else w.dir = sy > 0 ? 'down' : 'up';
    return walkKey(w) !== before;
  }
  function walkerSpot(k){
    if (typeof KIDART === 'undefined' || !KIDART[k]) return null;
    const w = walkerOf(k), p = tileXY(w.i, w.j);
    return { x: Math.round(p.x), y: Math.round(p.y), w };
  }
  const kidBuf = {};
  function kidSprite(k, dir, f, flip, phase){
    const key = [k, dir, f, flip ? 1 : 0, phase].join('|');
    if (kidBuf[key]) return kidBuf[key];
    const rows = KIDART[k][dir][f], pal = KIDPAL[k], W = rows[0].length, H = rows.length;
    const paint = (g, ox, oy, one) => {
      for (let r = 0; r < H; r++) for (let x = 0; x < W; x++){ const ch = rows[r][x]; if (ch === '.') continue; g.fillStyle = one || pal[ch] || '#000'; g.fillRect(((flip ? W - 1 - x : x) + 1 + ox) * 2, (r + 1 + oy) * 2, 2, 2); }
    };
    const c = document.createElement('canvas'); c.width = (W + 2) * 2; c.height = (H + 2) * 2;
    const g = c.getContext('2d'), sil = document.createElement('canvas'); sil.width = c.width; sil.height = c.height;
    const sg = sil.getContext('2d');
    [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => paint(sg, ox, oy, '#241c14'));
    g.globalAlpha = 0.78; g.drawImage(sil, 0, 0); g.globalAlpha = 1;
    paint(g, 0, 0);
    if (phase !== 'day'){ g.globalCompositeOperation = 'source-atop'; g.fillStyle = phase === 'dusk' ? 'rgba(90,40,20,.12)' : 'rgba(16,20,60,.26)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; }
    return (kidBuf[key] = c);
  }
  function drawWalker(g, k, s){
    const w = s.w, f = w.moving ? Math.floor(w.phase) % 2 : 0;
    isoTopD(g, s.x, s.y, 10, 4, 'rgba(40,24,10,.24)');
    const c = kidSprite(k, w.dir, f, w.dir === 'side' && w.flip, dayPhase());
    g.drawImage(c, s.x - 15, s.y - 39, c.width / 2, c.height / 2);
  }
  // 말풍선 — 아이를 누르면 제 작품 수를 말한다
  const bubbleOf = { sua: null, yona: null }, bubbleTimer = {}, talkTurn = { sua: 0, yona: 0 };
  const BUB_FONT = '800 13px ' + FONT;
  function kidSay(k, text, ms){
    bubbleOf[k] = { text }; clearTimeout(bubbleTimer[k]);
    bubbleTimer[k] = setTimeout(() => { bubbleOf[k] = null; draw(); }, ms || 3000 + text.length * 70);
    draw();
  }
  function bubbleLines(g, text, maxW){
    const out = [];
    String(text).split('\n').forEach(para => { let line = ''; for (const ch of para){ if (line && g.measureText(line + ch).width > maxW){ out.push(line); line = ch === ' ' ? '' : ch; } else line += ch; } if (line) out.push(line); });
    if (out.length > 4){ out.length = 4; out[3] = out[3].slice(0, -1) + '…'; }
    return out;
  }
  function drawBubble(g, cx, tipY, text){
    g.save(); g.font = BUB_FONT; g.textBaseline = 'top'; g.textAlign = 'left';
    const lines = bubbleLines(g, text, 156);
    const w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + 12, h = lines.length * 16 + 8;
    const x = Math.round(Math.max(2, Math.min(RW - w - 2, cx - w / 2))), y = Math.round(Math.max(2, tipY - h - 6)), BG = '#fffaf0';
    g.fillStyle = INK; g.fillRect(x + 2, y, w - 4, h); g.fillRect(x, y + 2, w, h - 4);
    g.fillStyle = BG; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    const tx = Math.round(Math.max(x + 6, Math.min(x + w - 12, cx - 3)));
    g.fillStyle = INK; g.fillRect(tx - 2, y + h - 2, 10, 2); g.fillRect(tx, y + h, 6, 2); g.fillRect(tx + 2, y + h + 2, 2, 2);
    g.fillStyle = BG; g.fillRect(tx, y + h - 2, 6, 2); g.fillRect(tx + 2, y + h, 2, 2);
    g.fillStyle = INK; lines.forEach((l, i) => g.fillText(l, x + 6, y + 5 + i * 16));
    g.restore();
  }
  function kidTalk(k){
    const mine = list.filter(w => w.author === k), both = list.filter(w => w.author === 'together');
    const nI = mine.filter(w => w.media_type !== 'youtube').length, nV = mine.filter(w => w.media_type === 'youtube').length;
    const lines = ['우리 미술관에 온 걸 환영해요!', nI ? '내 그림이 ' + nI + '장 걸려 있어요!' : '다음 그림을 그리는 중이에요!', nV ? '내 영상도 ' + nV + '개 있어요!' : '벽의 그림을 눌러 보세요!', both.length ? '같이 만든 것도 ' + both.length + '개예요!' : (k === 'sua' ? '연아 그림도 봐 주세요!' : '언니 그림도 봐 주세요!')];
    const w = walkerOf(k); w.wait = Math.max(w.wait, 3200); w.moving = false; w.dir = 'down'; w.flip = false; w.ti = w.i; w.tj = w.j; w.plan = null; w.after = null;
    const text = lines[talkTurn[k]++ % lines.length];
    kidSay(k, text); say(KID_NAME[k] + ': ' + text);                   // 방 아래 글줄에도 — 할머니가 읽기 쉽게
  }
  // ② 새 작품 안내 — 방이 처음 보일 때, 30일 안에 만든 가장 새 작품(이젤)의 작가가 그 앞으로 걸어가 말한다. 이 브라우저에서 한 번 알린 것은 다시 안 알린다
  let greeted = false;
  function greetNew(){
    greeted = true;
    const w = easelW; if (!w) return;
    const on = String(w.made_on || w.created_at || '').slice(0, 10); if (!on) return;
    if ((Date.parse(todayStr()) - Date.parse(on)) / 86400000 > 30) return;
    const key = 'gallery_greet';
    try { if (localStorage.getItem(key) === String(w.id)) return; } catch (e) { /* 못 읽으면 올 때마다 알린다 */ }
    const k = KID_HAIR[w.author] ? w.author : 'sua', wk = walkerOf(k);
    const text = (w.author === k ? '이번엔 이걸 그렸어요!' : (w.author === 'together' ? '같이 만든 거예요!' : KID_NAME[w.author] + '가 그렸어요!')) + '\n— ' + short(w.title, 16);
    const done = () => { try { localStorage.setItem(key, String(w.id)); } catch (e) { /* 다음에 또 알린다 */ } say(KID_NAME[k] + ': ' + text.replace('\n', ' ')); };
    wk.after = { dir: 'side', flip: false, say: text, hold: 4500, done };
    wk.plan = STILL ? [] : pathTo(wk, GREET_SPOT);
    if (!wk.plan.length){ wk.i = GREET_SPOT.i; wk.j = GREET_SPOT.j; }   // 길을 못 찾으면 그 자리에 선다
    wk.ti = wk.i; wk.tj = wk.j; wk.wait = 0;
    if (STILL) stepWalker(k, 16);
  }

  // ---------- ⑤ 관람객 — 액자 앞에 서서 고개를 끄덕이고 다음 그림으로 옮겨 간다. 수는 박수 수에 따라 하나에서 셋 ----------
  const VIS_PAL = [
    { hat: '#3a3a4a', band: '#6c6c80', coat: '#5a7fb5', coatDark: '#3e5f90', pants: '#2e3a54' },
    { hat: '#8a3a3a', band: '#c46a5a', coat: '#b56a5a', coatDark: '#8f4b3e', pants: '#3a2e2e' },
    { hat: '#4a6a3a', band: '#8ab070', coat: '#6aa07a', coatDark: '#4a7d5a', pants: '#2e3a2e' },
    { hat: '#1f2a44', band: '#c9a24a', coat: '#2b3a5e', coatDark: '#1c2740', pants: '#1c2233' },   // ⓖ 경비 아저씨 제복
  ];
  const VIS_ENTER = { i: 10.9, j: 5.4 };
  const visitors = [];
  let nextVisitorAt = 0;
  const visBuf = {};
  // ⓒ 관람객 넷 — 모두 아이(28×38)와 같은 격자. 어른(모자·외투), 아이(작게), 할머니(쪽머리·긴 치마·지팡이), 강아지(네 발·꼬리)
  const VIS_ROWS = {
    adult: [
      '.........kkkkkkkkkk.........',
      '........khhhhhhhhhhk........',
      '.......khhhhhhhhhhhhk.......',
      '.......khhhhHhhhhhhhk.......',
      '.......khhhhhhhhhhhhk.......',
      '....kkkkbbbbbbbbbbbbkkkk....',
      '...khhhhhhhhhhhhhhhhhhhhk...',
      '...khhhhhhhhhhhhhhhhhhhhk...',
      '....kkkkkffffffffffkkkkk....',
      '........kffffffffffk........',
      '........kffffffffffk........',
      '........kffeeffeeffk........',
      '........kffeeffeeffk........',
      '........kffffffffffk........',
      '........kfffffmmffffk.......',
      '.........kffffffffk.........',
      '......kkkCCCCCCCCCCkkk......',
      '.....kccCCcccccccccCCcck....',
      '....kcccccccccCcccccccccck..',
      '....kcccccccccCcccccccccck..',
      '....kccccccccccccccccccccck.',
      '....kccccccccccCccccccccck..',
      '....kccccccccccccccccccccck.',
      '....kcckcccccccCccccccckcck.',
      '....kcckccccccccccccccckcck.',
      '....kcckcccccccCccccccckcck.',
      '....kcckccccccccccccccckcck.',
      '....kffkcccccccCccccccckffk.',
      '....kffkccccccccccccccckffk.',
      '.....kk.kccccccccccccck.kk..',
      '........kppppppppppppk......',
      '........kppppppkppppppk.....',
      '........kpppppkkkpppppk.....',
      '........kpppppk.kpppppk.....',
      '........kpppppk.kpppppk.....',
      '........kpppppk.kpppppk.....',
      '.......ksssssssksssssssk....',
      '.......kkkkkkkkkkkkkkkkk....',
    ],
    child: [
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '..........kkkkkkkk..........',
      '.........khhhhhhhhk.........',
      '........khhhhhhhhhhk........',
      '........khhhhhhhhhhk........',
      '........khffffffffhk........',
      '........kffffffffffk........',
      '........kffeeffeeffk........',
      '........kffffffffffk........',
      '........kffffmmffffk........',
      '.........kffffffffk.........',
      '.......kkkcccccccckkk.......',
      '......kccccccccccccccck.....',
      '......kcckccccccccckcck.....',
      '......kcckccccccccckcck.....',
      '......kcckccccCcccckcck.....',
      '......kffkccccccccckffk.....',
      '.......kkkccccCcccckkk......',
      '.........kcccccccck.........',
      '.........kpppppppppk........',
      '.........kpppkkpppppk.......',
      '.........kpppk.kpppk........',
      '.........kpppk.kpppk........',
      '.........kpppk.kpppk........',
      '.........kpppk.kpppk........',
      '.........kpppk.kpppk........',
      '........ksssssksssssk.......',
      '........kkkkkkkkkkkkk.......',
      '............................',
    ],
    grandma: [
      '............................',
      '............................',
      '..........kkkkkkkk..........',
      '.........khhhhhhhhk.........',
      '........khhhhhhhhhhk........',
      '.......khhhhhhhhhhhhk.......',
      '.......khhhhhhhhhhhhk.......',
      '.......khhhhhhhhhhhhk.......',
      '........khhffffffhhk........',
      '........khffffffffhk........',
      '........kffffffffffk........',
      '........kfkeekkeekfk........',
      '........kffeeffeeffk........',
      '........kffffffffffk........',
      '........kfffffmmffffk.......',
      '.........kffffffffk.........',
      '......kkkCCCCCCCCCCkkk......',
      '.....kccCCcccccccccCCcck....',
      '....kcccccccccCcccccccccck..',
      '....kcccccccccCcccccccccck..',
      '....kccccccccccccccccccccnk.',
      '....kcccccccccCccccccccckn..',
      '....kccccccccccccccccccckn..',
      '....kcckcccccccCccccccckcnk.',
      '....kcckccccccccccccccckcn..',
      '....kffkcccccccCccccccckfn..',
      '....kffkccccccccccccccckfn..',
      '.....kk.kccccccccccccck.kn..',
      '........kccccccccccccck..n..',
      '........kccccccccccccck..n..',
      '........kccccccccccccck..n..',
      '........kccccccccccccck..n..',
      '.......kccccccccccccccck.n..',
      '.......kccccccccccccccck.n..',
      '.......kkkkkkkkkkkkkkkkk.n..',
      '........kpppppk.kpppppk..n..',
      '.......ksssssssksssssssk.n..',
      '.......kkkkkkkkkkkkkkkkk.kk.',
    ],
    dog: [
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '............................',
      '..kkk.......................',
      '.kcccck....................k',
      '.kccccckkkkk..............kn',
      '.kcceccccccck............kn.',
      '.kccccccccccck..........kn..',
      '.kkcccccccccckkkkkkkkkkkkn..',
      '..kmcccccccccccccccccccccck.',
      '..kkkkccccccccccccccccccccck',
      '.....kccccccccccccccccccccck',
      '.....kccccccccccccccccccccck',
      '.....kccccccccccccccccccccck',
      '.....kkccccccccccccccccccck.',
      '......kccckkkkkkkkkkkkcccck.',
      '......kccck..........kccck..',
      '......kccck..........kccck..',
      '......ksssk..........ksssk..',
      '......kkkkk..........kkkkk..',
    ],
  };
  const VIS_KINDS = ['adult', 'child', 'grandma', 'dog'];
  // ⓑ 손뼉 포즈 — 어른·아이·할머니의 팔을 떼어 머리 옆으로 올린다. sp 1 이면 손이 벌어진 쪽(두 포즈를 번갈아 그리면 손뼉)
  function armsUp(rows, sp){
    const R = rows.map(r => r.split(''));
    const armRows = [], hasArm = R.findIndex(r => r[7] === 'k' && r[5] === 'c');            // 팔이 붙은 첫 줄(어른 17·아이 22)
    if (hasArm < 0) return rows;
    for (let r = hasArm; r < R.length; r++){ if (R[r][7] === 'k' || R[r][6] === 'k'){ for (const c of [4, 5, 6]) if (R[r][c] !== '.' && R[r][7] !== '.') { R[r][c] = '.'; } for (const c of [24, 25, 26]) if (R[r][23] === 'k' || R[r][22] === 'k') R[r][c] = '.'; armRows.push(r); } else break; }
    const top = Math.max(2, hasArm - 8);
    for (let r = top + 3; r < hasArm + 1; r++){ R[r][4 - sp] = 'k'; R[r][5 - sp] = 'c'; R[r][6 - sp] = 'c'; R[r][7 - sp] = R[r][7 - sp] === '.' ? 'k' : R[r][7 - sp]; R[r][24 + sp] = 'c'; R[r][25 + sp] = 'c'; R[r][26 + sp] = 'k'; R[r][23 + sp] = R[r][23 + sp] === '.' ? 'k' : R[r][23 + sp]; }
    for (let r = top; r < top + 3; r++){ R[r][4 - sp] = 'k'; R[r][5 - sp] = 'f'; R[r][6 - sp] = 'f'; R[r][7 - sp] = R[r][7 - sp] === '.' ? 'k' : R[r][7 - sp]; R[r][24 + sp] = 'f'; R[r][25 + sp] = 'f'; R[r][26 + sp] = 'k'; R[r][23 + sp] = R[r][23 + sp] === '.' ? 'k' : R[r][23 + sp]; }
    R[top - 1][4 - sp] = 'k'; R[top - 1][5 - sp] = 'k'; R[top - 1][6 - sp] = 'k'; R[top - 1][24 + sp] = 'k'; R[top - 1][25 + sp] = 'k'; R[top - 1][26 + sp] = 'k';
    return R.map(r => r.join(''));
  }
  function visitorSprite(n, flip, kind, pose){
    kind = kind || 'adult';
    const key = [n, flip ? 1 : 0, kind, pose || ''].join('|');
    if (visBuf[key]) return visBuf[key];
    const P = VIS_PAL[n % VIS_PAL.length];
    let rows = VIS_ROWS[kind] || VIS_ROWS.adult;
    if (pose === 'clap0' || pose === 'clap1'){ if (kind === 'dog'){ rows = rows.map((r, i) => i >= 22 && i <= 26 ? r.replace(/n/g, pose === 'clap0' ? 'n' : '.') : r); } else rows = armsUp(rows, pose === 'clap1' ? 1 : 0); }
    const hair = kind === 'grandma' ? '#d8d2c8' : kind === 'child' ? '#5a3a22' : P.hat;
    const pal = { h: hair, H: P.band, b: P.band, f: '#f2d3b8', e: '#2a2622', m: kind === 'dog' ? '#2a2622' : '#b06a5a', c: kind === 'dog' ? '#b98a5a' : P.coat, C: P.coatDark, p: P.pants, s: '#2a2622', n: kind === 'dog' ? '#b98a5a' : '#6b4a2a', k: '#241c14' };
    const W = 28, H = rows.length;
    const c = document.createElement('canvas'); c.width = (W + 2) * 2; c.height = (H + 2) * 2;
    const g = c.getContext('2d');
    const paint = (ox, oy, one) => { for (let r = 0; r < H; r++) for (let x = 0; x < W; x++){ const ch = rows[r][x]; if (ch === '.') continue; g.fillStyle = one || pal[ch] || '#000'; g.fillRect(((flip ? W - 1 - x : x) + 1 + ox) * 2, (r + 1 + oy) * 2, 2, 2); } };
    g.globalAlpha = 0.78; [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => paint(ox, oy, '#241c14')); g.globalAlpha = 1; paint(0, 0);
    return (visBuf[key] = c);
  }
  function visitorTarget(){
    const idx = hung.map((w, n) => w ? n : -1).filter(n => n >= 0);
    if (!idx.length) return null;
    const n = idx[Math.floor(Math.random() * idx.length)], s = SLOTS[n], cu = (s.u + s.w / 2) / 28;
    const spot = s.side ? { i: Math.max(WALK_BOX.i0 + 0.3, Math.min(WALK_BOX.i1 - 0.3, cu)), j: 1.0 } : { i: 1.0, j: Math.max(WALK_BOX.j0 + 0.2, Math.min(WALK_BOX.j1, cu)) };
    if (walkBlocked(spot.i, spot.j)) return null;
    spot.big = !!s.big; spot.ribbon = (claps[hung[n].id] || 0) >= 5;                        // ⓑ 큰 액자면 오래, 리본이 달렸으면 손뼉
    return spot;
  }
  function visitorCount(){ return dayPhase() === 'night' ? 0 : 1 + (clapsTotal >= 10 ? 1 : 0) + (clapsTotal >= 30 ? 1 : 0); }   // ⓖ 밤엔 아무도 안 온다
  const holdFor = p => (2500 + Math.random() * 3500) * (p.big ? 1.7 : 1);
  function stepVisitors(dt, now){
    if (STILL) return false;
    let changed = false;
    if (visitors.length < visitorCount() && now >= nextVisitorAt && hung.some(Boolean)){
      const n = visitors.length + Math.floor(now / 1000) % 3, kind = VIS_KINDS[(n + Math.floor(now / 7000)) % VIS_KINDS.length];   // ⓒ 종류는 돌아가며
      visitors.push({ n, kind, i: VIS_ENTER.i, j: VIS_ENTER.j, ti: VIS_ENTER.i, tj: VIS_ENTER.j, seen: 0, wait: 0, nod: 0, flip: false, leaving: false, phase: 0, big: false, clap: false });
      nextVisitorAt = now + 9000 + Math.random() * 12000; changed = true;
    }
    for (let v = visitors.length - 1; v >= 0; v--){
      const p = visitors[v];
      if (dayPhase() === 'night' && !p.leaving){ p.leaving = true; p.wait = 0; p.ti = VIS_ENTER.i; p.tj = VIS_ENTER.j; }   // ⓖ 밤이 되면 나간다
      if (p.wait > 0){ p.wait -= dt; const nod = Math.floor(now / (p.clap ? 300 : 500)) % 2; if (nod !== p.nod){ p.nod = nod; changed = true; } continue; }
      const di = p.ti - p.i, dj = p.tj - p.j, d = Math.hypot(di, dj);
      if (d < 0.02){
        if (p.leaving){ visitors.splice(v, 1); changed = true; continue; }
        if (p.seen >= 3){ p.leaving = true; p.ti = VIS_ENTER.i; p.tj = VIS_ENTER.j; continue; }
        if (p.seen > 0 || p.arrived){ p.wait = holdFor(p); p.seen++; p.arrived = false; continue; }
        const t = visitorTarget(); if (!t){ p.leaving = true; p.ti = VIS_ENTER.i; p.tj = VIS_ENTER.j; continue; }
        p.ti = t.i; p.tj = t.j; p.arrived = true; p.big = t.big; p.clap = t.ribbon;
      } else {
        const step = Math.min(d, 0.7 * dt / 1000); p.i += di / d * step; p.j += dj / d * step; p.phase += dt / 260;
        p.flip = (di - dj) < 0; changed = true;
        if (Math.hypot(p.ti - p.i, p.tj - p.j) < 0.02 && p.arrived){ p.wait = holdFor(p); p.seen++; p.arrived = false; }
      }
    }
    return changed;
  }
  function drawVisitor(g, p){
    const t = tileXY(p.i, p.j), x = Math.round(t.x), y = Math.round(t.y), bob = p.wait > 0 ? p.nod : (Math.floor(p.phase) % 2);
    isoTopD(g, x, y, 10, 4, 'rgba(40,24,10,.24)');
    const pose = p.wait > 0 && p.clap ? 'clap' + p.nod : '';                              // ⓑ 리본 달린 작품 앞에서는 손뼉(두 포즈를 번갈아)
    const c = visitorSprite(p.n, p.flip, p.kind, pose);
    g.drawImage(c, x - 15, y - 39 - (p.wait > 0 && !p.clap ? 0 : bob), c.width / 2, c.height / 2);   // 아이와 같은 자리 셈(30×40)
  }
  // ⓖ 밤의 경비 아저씨 — 관객 대신 손전등을 들고 길목을 차례로 돈다. 불빛은 가는 쪽 바닥에 타원으로
  let guard = null;
  function stepGuard(dt){
    if (dayPhase() !== 'night' || STILL){ if (guard){ guard = null; return true; } return false; }
    if (!guard){ const m = WAYPOINTS[0]; guard = { i: VIS_ENTER.i, j: VIS_ENTER.j, ti: m.i, tj: m.j, at: 0, wait: 0, flip: false, phase: 0 }; return true; }
    const p = guard;
    if (p.wait > 0){ p.wait -= dt; return false; }
    const di = p.ti - p.i, dj = p.tj - p.j, d = Math.hypot(di, dj);
    if (d < 0.02){ p.at = (p.at + 1) % WAYPOINTS.length; const m = WAYPOINTS[p.at]; p.ti = m.i; p.tj = m.j; p.wait = 900 + Math.random() * 1500; return false; }
    const step = Math.min(d, 0.45 * dt / 1000); p.i += di / d * step; p.j += dj / d * step; p.phase += dt / 300; p.flip = (di - dj) < 0;
    return true;
  }
  function drawGuard(g){
    const p = guard, t = tileXY(p.i, p.j), x = Math.round(t.x), y = Math.round(t.y), bob = p.wait > 0 ? 0 : Math.floor(p.phase) % 2;
    const fx = p.flip ? -1 : 1;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) isoTopD(g, x + fx * (26 + k * 10), y + 10 + k * 3, 14 + k * 9, 6 + k * 3, 'rgba(255,230,150,' + (0.30 - k * 0.06).toFixed(2) + ')');   // 손전등 빛 — 밤 어둠(0.26) 위에서 보이려면 이 정도는 돼야 한다
    g.restore();
    isoTopD(g, x, y, 10, 4, 'rgba(40,24,10,.3)');
    const c = visitorSprite(3, p.flip, 'adult', '');
    g.drawImage(c, x - 15, y - 39 - bob, c.width / 2, c.height / 2);
    g.fillStyle = '#d9d2c4'; g.fillRect(x + fx * 12 - 1, y - 14 - bob, 3, 2); g.fillStyle = '#fff3c4'; g.fillRect(x + fx * 14 - (fx < 0 ? 1 : 0), y - 14 - bob, 1, 2);   // 손전등
  }

  // ---------- 한 장 그리기 (④ 연도 바꿈은 옆으로 밀리는 장면 전환) ----------
  const sceneCv = document.createElement('canvas'); sceneCv.width = RW * 2; sceneCv.height = RH * 2;
  let slide = null;                                                      // { from: 캔버스, dir, t0 }
  function cvOf(){ return $('#galleryCv'); }
  function drawScene(g){
    g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, RW, RH);
    g.drawImage(shellCv(), 0, 0, RW, RH);
    g.drawImage(bakeWall(), 0, 0, RW, RH);
    const floor = [{ y: BENCH.y, f: () => drawBench(g) }, { y: EASEL.y, f: () => drawEasel(g) }, { y: TV.y, f: () => drawTV(g) }, { y: PLINTH.y, f: () => drawPlinth(g) }];
    if (guard){ const t = tileXY(guard.i, guard.j); floor.push({ y: t.y - 1, f: () => drawGuard(g) }); }
    const spots = {};
    KIDS.forEach(k => { const s = walkerSpot(k); if (s){ spots[k] = s; floor.push({ y: s.y, f: () => drawWalker(g, k, s) }); } });
    visitors.forEach(p => { const t = tileXY(p.i, p.j); floor.push({ y: t.y - 1, f: () => drawVisitor(g, p) }); });
    floor.sort((a, b) => a.y - b.y).forEach(o => o.f());
    const fk = focusKey || hoverKey;
    if (fk){ const h = hits.find(x => hitKey(x) === fk); if (h && h.w) drawPlaque(g, h); }   // 노란 테두리는 뺐다(2026-09-15) — 이름표만으로 어느 작품인지 충분하다
    KIDS.forEach(k => { const b = bubbleOf[k], s = spots[k]; if (b && s) drawBubble(g, s.x, s.y - 42, b.text); });
    if (editMode && !capturing){                                                            // ⓔ 편집 모드 — 칸마다 점선, 끌고 있는 액자는 손끝에
      SLOTS.forEach((s, n) => { const col = drag && drag.over === n ? '#ffd979' : 'rgba(255,217,121,.55)'; for (let d = 0; d < s.w + 8; d += 4) wallRect(g, s.side, s.u - 4 + d, s.v - 4, 2, 1, col); for (let d = 0; d < s.h + 8; d += 4) wallRect(g, s.side, s.u - 4, s.v - 4 + d, 1, 2, col); });
      if (drag && drag.moved){ const t = thumbOf(drag.w, 36, 26); g.globalAlpha = 0.85; g.fillStyle = INK; g.fillRect(Math.round(drag.x) - 20, Math.round(drag.y) - 15, 40, 30); g.drawImage(t.cv, Math.round(drag.x) - 18, Math.round(drag.y) - 13, 36, 26); g.globalAlpha = 1; }
    }
  }
  function draw(){
    const cv = cvOf(); if (!cv) return;
    drawScene(sceneCv.getContext('2d'));
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (slide){
      const p = Math.min(1, (performance.now() - slide.t0) / 450), e = 1 - Math.pow(1 - p, 3), off = Math.round(cv.width * e);
      g.drawImage(slide.from, -slide.dir * off, 0); g.drawImage(sceneCv, slide.dir * (cv.width - off), 0);
      if (p >= 1) slide = null; else requestAnimationFrame(draw);
    } else g.drawImage(sceneCv, 0, 0);
  }
  const hitKey = h => h.kid ? 'kid:' + h.kid : h.w ? 'w' + h.w.id : h.tv ? 'tv' : 'x';
  function hitAt(e){
    const cv = cvOf(), rc = cv.getBoundingClientRect(); if (!rc.width) return null;
    const x = (e.clientX - rc.left) / rc.width * RW, y = (e.clientY - rc.top) / rc.height * RH;
    for (const k of KIDS){ const s = walkerSpot(k); if (s && x >= s.x - 14 && x < s.x + 14 && y >= s.y - 40 && y < s.y + 3) return { kid: k, x0: s.x - 14, x1: s.x + 14, y0: s.y - 40, y1: s.y + 3 }; }
    const area = h => (h.x1 - h.x0) * (h.y1 - h.y0);
    return hits.filter(h => x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1).sort((a, b) => (b.front || 0) - (a.front || 0) || area(a) - area(b))[0] || null;
  }
  function captionOf(w){ return captionLines(w).join(' · '); }
  function say(t){ const el = $('#galleryMsg'); if (el) el.textContent = t || overflowNote; }
  function describe(h){ return !h ? '' : h.kid ? KID_NAME[h.kid] + '를 누르면 이야기해요' : h.w ? captionOf(h.w) + (h.easel ? ' · 가장 새 작품' : h.plinth ? ' · 이달의 그림' : '') + (editMode && h.slot ? ' · 끌어서 옮기기' : ' · 누르면 크게') : h.tv ? '영상 ' + videos.length + '개 · 누르면 방 안에서 재생' : ''; }
  // ⓔ 빈 칸도 놓을 자리가 된다 — 액자 hit 은 걸린 칸에만 있으니 빈 칸은 자리 상자로 찾는다
  function slotUnder(x, y){
    for (let n = 0; n < SLOTS.length; n++){ const s = SLOTS[n], b = wallHit(s.side, s.u - 5, s.v - 5, s.w + 10, s.h + 18, 0); if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return n; }
    return -1;
  }
  function saveSlot(w, slot){
    w.wall_slot = slot;
    if (typeof sb === 'undefined') return Promise.resolve(false);
    return sb.from('works').update({ wall_slot: slot }).eq('id', w.id).select('id').then(res => !res.error && res.data && res.data.length > 0).catch(() => false);   // RLS 에 막히면 줄이 0 — 오류 없이 실패한다
  }
  function moveSlot(w, from, to){
    const other = hung[to];
    hung[to] = w; hung[from] = other || null;
    const jobs = [saveSlot(w, to)]; if (other) jobs.push(saveSlot(other, from));
    hung.forEach((x, n) => { if (x && x.wall_slot === undefined) x.wall_slot = null; });
    wallKey = ''; draw();
    Promise.all(jobs).then(ok => say(ok.every(Boolean) ? '바꿔 걸었어요 · 저장됨' : '바꿔 걸었지만 저장이 안 됐어요 — 부모 계정인지 확인해 주세요'));
  }
  function setEdit(on){
    editMode = !!on && admin; drag = null;
    const cv = cvOf(); if (cv) cv.style.touchAction = editMode ? 'none' : 'manipulation';
    const b = $('#galleryEdit'); if (b) b.classList.toggle('on', editMode);
    say(editMode ? '액자를 끌어서 다른 칸에 놓으세요 · 다 됐으면 「배치 끝」' : '');
    draw();
  }
  // ⓓ 텔레비전 재생기 — 캔버스 위 텔레비전 자리에 작은 유튜브 재생기를 띄운다. 다시 누르거나 ✕ 로 끈다
  function tvToggle(w){
    const stage = $('#galleryRoom .museum-stage'); if (!stage) return;
    let box = $('#galleryTv');
    if (box && (!w || tvPlaying === w)){ box.remove(); tvPlaying = null; draw(); say(''); return; }
    const id = w && typeof youtubeId === 'function' ? youtubeId(w.media_url) : ''; if (!id) return;
    if (!box){ box = document.createElement('div'); box.id = 'galleryTv'; box.className = 'tv-player'; stage.appendChild(box); }
    box.style.left = ((TV.x - 60) / RW * 100) + '%'; box.style.top = ((TV.y - 96) / RH * 100) + '%';
    box.innerHTML = (typeof youtubeEmbedHTML === 'function' ? youtubeEmbedHTML(id, w.title, true) : '') + '<button type="button" class="tv-x" aria-label="재생기 닫기">✕</button>';
    box.querySelector('.tv-x').addEventListener('click', () => tvToggle(null));
    tvPlaying = w; draw(); say('텔레비전에서 「' + short(w.title, 20) + '」 재생 중 · ✕ 로 끄기');
  }
  // ⓘ 방 사진 — 텔레비전 섬네일만 빼고(캔버스를 더럽히는 유일한 것) 새 캔버스에 그려 PNG 로. 나눌 수 있는 폰이면 나누기, 아니면 내려받기
  function snapshot(){
    const c = document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2;
    capturing = true; try { drawScene(c.getContext('2d')); } finally { capturing = false; }
    const name = 'suayona-gallery-' + todayStr() + '.png';
    return new Promise(res => c.toBlob(blob => {
      if (!blob){ say('사진을 만들지 못했어요'); return res(false); }
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: '수아랑 연아랑 미술관' }).then(() => res(true)).catch(() => res(false));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000); say('방 사진을 내려받았어요'); res(true);
    }, 'image/png'));
  }
  function renderTools(){
    const box = $('#galleryTools'); if (!box) return;
    box.innerHTML = '<button type="button" class="dot-btn small" id="gallerySnap">📷 방 사진</button>' + (admin ? ' <button type="button" class="dot-btn small" id="galleryEdit">🖼 벽 배치 바꾸기</button>' : '');
    $('#gallerySnap').addEventListener('click', () => { snapshot(); });
    const eb = $('#galleryEdit'); if (eb) eb.addEventListener('click', () => { setEdit(!editMode); eb.textContent = editMode ? '✔ 배치 끝' : '🖼 벽 배치 바꾸기'; });
  }
  let wired = false;
  function wire(){
    const cv = cvOf(); if (!cv || wired) return; wired = true;
    cv.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const h = hitAt(e), key = h ? hitKey(h) : null;
      cv.style.cursor = h ? 'pointer' : 'default';
      if (key !== hoverKey){ hoverKey = key; draw(); say(describe(h)); }
    });
    cv.addEventListener('pointerleave', () => { if (hoverKey){ hoverKey = null; draw(); say(''); } });
    cv.addEventListener('click', e => {
      const h = hitAt(e); if (!h){ if (focusKey){ focusKey = null; draw(); say(''); } return; }
      if (h.kid){ kidTalk(h.kid); return; }
      const key = hitKey(h);
      if (editMode && h.slot) return;                                                       // ⓔ 편집 모드에선 누르기 대신 끌기
      if (h.tv){ tvToggle(videos[tvIdx % Math.max(1, videos.length)]); return; }           // ⓓ 텔레비전 → 방 안 작은 재생기
      if (e.pointerType !== 'mouse' && h.w && focusKey !== key){ focusKey = key; draw(); say(describe(h)); return; }   // 손가락: 한 번 누르면 이름표, 한 번 더 누르면 열기
      const w = h.w; if (!w || !openFn) return;
      const i = list.indexOf(w); if (i >= 0) openFn(i);
    });
    // ⓔ 끌어서 바꿔 걸기 — 부모가 편집 모드를 켰을 때만. 손가락으로도 끌 수 있게 그동안은 touch-action 을 끈다
    cv.addEventListener('pointerdown', e => {
      if (!editMode) return;
      const h = hitAt(e); if (!h || !h.slot) return;
      const rc = cv.getBoundingClientRect();
      drag = { w: h.w, from: SLOTS.indexOf(h.s), x: (e.clientX - rc.left) / rc.width * RW, y: (e.clientY - rc.top) / rc.height * RH, over: -1, moved: false, id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 잡지 못해도 마우스는 따라온다 */ }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const rc = cv.getBoundingClientRect(); drag.x = (e.clientX - rc.left) / rc.width * RW; drag.y = (e.clientY - rc.top) / rc.height * RH; drag.moved = true;
      const h = hits.filter(x => x.slot && drag.x >= x.x0 && drag.x < x.x1 && drag.y >= x.y0 && drag.y < x.y1)[0];
      drag.over = h ? SLOTS.indexOf(h.s) : slotUnder(drag.x, drag.y);
      draw();
    });
    const endDrag = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      if (d.moved && d.over >= 0 && d.over !== d.from) moveSlot(d.w, d.from, d.over); else draw();
    };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('keydown', e => { if (e.key === 'Enter' && easelW && openFn){ const i = list.indexOf(easelW); if (i >= 0) openFn(i); } });
  }

  // ---------- 보일 때만 걷는다 ----------
  let seen = true, seenAt = 0, lastTick = 0, lastDraw = 0;
  function tick(now, dt){                                                // 한 장 — 시험에서도 부른다(숨은 창은 rAF 가 안 돈다)
    if (!greeted && hits.length) greetNew();
    let moved = false; KIDS.forEach(k => { if (stepWalker(k, dt)) moved = true; });
    if (stepVisitors(dt, now)) moved = true;
    if (stepGuard(dt)) moved = true;
    if (moved && now - lastDraw >= 40){ draw(); lastDraw = now; }
    return moved;
  }
  function loop(now){
    requestAnimationFrame(loop);
    try {
      const dt = Math.min(100, lastTick ? now - lastTick : 16); lastTick = now;
      if (now - seenAt >= 400){ seenAt = now; const cv = cvOf(), rc = cv && !cv.closest('[hidden]') && cv.getBoundingClientRect(); seen = !!rc && rc.width > 0 && rc.bottom > -60 && rc.top < (window.innerHeight || 800) + 60; }
      if (!seen || document.hidden || !list.length) return;
      tick(now, dt);
    } catch (e) { /* 한 장 건너뛴다 */ }
  }
  let looping = false;

  // ---------- ⑩ 박수 — work_claps 표(없으면 조용히 끈다) ----------
  function loadClaps(){
    if (clapsState !== 'idle' || typeof sb === 'undefined') return;
    clapsState = 'loading';
    sb.rpc('work_clap_counts').then(res => {
      if (res.error){ clapsState = 'off'; return; }
      claps = {}; clapsTotal = 0;
      (res.data || []).forEach(r => { claps[r.work_id] = Number(r.n) || 0; clapsTotal += claps[r.work_id]; });
      clapsState = 'on'; wallKey = ''; draw();
    }).catch(() => { clapsState = 'off'; });
  }
  function clapped(id, n){ claps[id] = n; clapsTotal = Object.values(claps).reduce((a, b) => a + b, 0); wallKey = ''; draw(); }

  // ---------- ⑧⑨ 어느 작품을 어느 칸에 — 가로형은 큰 액자로, 넘치면 마지막 네 칸은 날마다 바꿔 건다 ----------
  function layout(){
    const rest = images.slice(1), bigs = [], small = [];
    rest.forEach(w => { const ar = aspectOf[w.id]; if (bigs.length < BIG.length && (ar === undefined || ar >= 1.15)) bigs.push(w); else small.push(w); });
    while (bigs.length < BIG.length && small.length) bigs.push(small.shift());
    const cap = SLOTS.length, pinned = new Array(cap).fill(null);                            // ⓔ 부모가 칸을 정한 작품(wall_slot)은 그 칸에 먼저
    const ordered = bigs.concat(small).filter(w => { const k = w.wall_slot; if (Number.isInteger(k) && k >= 0 && k < cap && !pinned[k]){ pinned[k] = w; return false; } return true; });
    overflowNote = '';
    const free = cap - pinned.filter(Boolean).length;
    let queue;
    if (ordered.length > free){
      const head = ordered.slice(0, free - ROTATE), tail = ordered.slice(free - ROTATE), shift = dayNum() % tail.length;
      const today = tail.slice(shift).concat(tail.slice(0, shift)).slice(0, ROTATE);
      overflowNote = '벽 ' + cap + '칸이 다 차서 오늘은 ' + ROTATE + '장을 바꿔 걸었어요 · 나머지 ' + (ordered.length - free) + '장은 아래 목록에 있어요';
      queue = head.concat(today);
    } else queue = ordered.slice();
    hung = pinned.map(w => w || queue.shift() || null);
  }

  // ---------- 바깥에서 부르는 것 ----------
  function render(visibleList, open, opts){
    const box = $('#galleryRoom'); if (!box) return;
    const newYear = (opts && opts.year) || 'all', cv = cvOf();
    if (list.length && newYear !== year && cv && !STILL){                   // ④ 연도가 바뀌면 옛 장면을 잡아 두고 옆으로 민다
      const from = document.createElement('canvas'); from.width = cv.width; from.height = cv.height; from.getContext('2d').drawImage(sceneCv, 0, 0);
      const ord = y => y === 'all' ? 9999 : Number(y);
      slide = { from, dir: ord(newYear) > ord(year) ? 1 : -1, t0: performance.now() };
    }
    year = newYear; list = Array.isArray(visibleList) ? visibleList : []; openFn = open;
    admin = !!(opts && opts.admin);
    if (!admin && editMode) setEdit(false);
    if (tvPlaying && !list.includes(tvPlaying)) tvToggle(null);
    images = list.filter(w => w.media_type !== 'youtube' && w.media_type !== 'video' && (w.thumb_url || w.media_url));
    videos = list.filter(w => w.media_type === 'youtube');
    box.hidden = !images.length && !videos.length;
    if (box.hidden) return;
    easelW = images[0] || null;
    layout();
    focusKey = null; greeted = false;
    hits = hits.filter(h => h.slot === undefined && !h.easel && !h.tv);
    if (easelW) hits.push({ w: easelW, easel: true, front: 2, x0: EASEL.x - 30, x1: EASEL.x + 30, y0: EASEL.y - 86, y1: EASEL.y + 8 });
    if (videos.length) hits.push({ tv: true, front: 2, x0: TV.x - 34, x1: TV.x + 34, y0: TV.y - 62, y1: TV.y + 14 });
    wallKey = '';                                                        // 목록이 바뀌었으니 다시 굽는다
    onThumb = () => { const before = hung.map(w => w && w.id).join(','); layout(); if (hung.map(w => w && w.id).join(',') !== before) wallKey = ''; wallKey = ''; draw(); };
    clearInterval(tvTimer); tvIdx = 0;
    // 텔레비전은 새 영상 8개만 돌린다 — 17개를 다 돌리면 섬네일 17장(약 200KB)을 받는다(2026-09-15 마무리작업). 누르면 지금 화면의 영상이 열린다
    const tvN = Math.min(videos.length, TV_MAX);
    if (tvN > 1 && !STILL) tvTimer = setInterval(() => { if (seen && !document.hidden){ tvIdx = (tvIdx + 1) % tvN; draw(); } }, 4000);
    if (cv){ cv.style.aspectRatio = RW + ' / ' + RH; cv.tabIndex = 0; }
    wire(); renderTools(); say(''); draw(); loadClaps();
    if (!STILL && !looping){ looping = true; requestAnimationFrame(loop); }
  }
  window.GALLERY = { render, draw, clapped, claps: () => claps, clapsOn: () => clapsState === 'on', _hits: () => hits, _walkers: walkers, _visitors: visitors, _hung: () => hung, _aspect: aspectOf,
    _tick: tick, _focus: k => { focusKey = k; draw(); }, _slide: () => slide, _bubbles: bubbleOf, _setClaps: m => { claps = m; clapsTotal = Object.values(m).reduce((a, b) => a + b, 0); wallKey = ''; draw(); },
    _guard: () => guard, _edit: setEdit, _move: moveSlot, _tv: tvToggle, _snap: snapshot, _top: topWork, _sprite: visitorSprite, _slotUnder: slotUnder };
})();
