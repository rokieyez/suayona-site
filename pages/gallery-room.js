// portfolio.html 의 미술관 방 — 제목 아래 아이소메트릭 방에 수아·연아의 작품이 함께 걸린다(2026-09-15 부모 요청).
// 업적 전시실(honors.js)과 같은 틀(512×396, 칸 56×28, 벽 136)이지만 따로 산다 — honors.js 의 함수는
// 최상위 선언이라 여기서 못 가져오고, 공유 파일로 빼면 캐시된 옛 honors.js 의 const 와 부딪힌다(kid-art.js 때 겪음).
// 그래서 필요한 원시 함수(칸 좌표·벽 좌표·상자·벽 네모)는 여기에 다시 적었다. 밖으로는 window.GALLERY 만 내놓는다.
//   GALLERY.render(list, open) — list: 보이는 작품(거르개 적용), open(i): i번째 작품을 크게 연다.
// 벽에는 사진 작품의 작은 그림(thumb_url)을 액자에 넣어 건다 — 최근 것부터, 오른쪽 벽 12 + 왼쪽 벽 6.
// 가장 새 작품 하나는 방 앞 이젤에 크게. 영상은 바닥의 작은 텔레비전(누르면 가장 새 영상). 두 아이가 같이 걸어 다닌다.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const RW = 512, RH = 396, TW = 56, TH = 28, NI = 12, NJ = 6, FX = 172, FY = 154, WALLH = 136;
  const CORNER = { x: FX, y: FY - TH / 2 }, WTOP = CORNER.y - WALLH;
  const LWr = NI * (TW / 2), LWl = NJ * (TW / 2);
  const KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3', together: '#ffd979' };
  const KID_NAME = { sua: '수아', yona: '연아', together: '같이' };
  const KIDS = ['sua', 'yona'];
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const INK = '#2a2118';

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
  function dayPhase(){
    const q = new URLSearchParams(location.search).get('phase');
    if (q === 'day' || q === 'dusk' || q === 'night') return q;
    const h = new Date().getHours();
    return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
  }
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
  // 액자: 오른쪽 벽 두 줄 × 6, 왼쪽 벽 두 줄 × 3. 사진 36×26 + 테 2 + 검은 윤곽 1
  const FW = 36, FH = 26, ROWS = [14, 58];
  const SLOTS = [];
  ROWS.forEach(v => { for (let n = 0; n < 6; n++) SLOTS.push({ side: 1, u: 18 + n * 52, v }); for (let n = 0; n < 3; n++) SLOTS.push({ side: 0, u: 16 + n * 50, v }); });
  const EASEL = tileXY(9.7, 4.3), TV = tileXY(1.7, 4.7), BENCH = tileXY(6.0, 3.4), PLANT_AT = tileXY(0.55, 0.55);
  const WALK_BOX = { i0: 0.3, i1: 10.9, j0: 0.9, j1: 5.1 };
  const WALK_BLOCK = [{ i: 5.1, j: 3.4, r: 1.05 }, { i: 6.9, j: 3.4, r: 1.05 }, { i: 9.7, j: 4.3, r: 1.1 }, { i: 1.7, j: 4.7, r: 1.1 }, { i: 0.55, j: 0.55, r: 1.1 }];

  // ---------- 껍데기 — 벽·바닥·양탄자·의자·화분(자료와 무관, 시간대마다 한 번) ----------
  const shells = {};
  function shellCv(){
    const phase = dayPhase();
    if (shells[phase]) return shells[phase];
    const c = document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
    [1, 0].forEach(side => {
      const len = side ? LWr : LWl, dim = side ? 0 : -14;
      for (let u = side ? 0 : -1; u < len; u++) for (let v = 0; v < WALLH; v++){
        let base, d = 0;
        if (v < 3) base = '#f8f3e8';                                                        // 천장 몰딩
        else if (v < 5) base = '#cdbfa6';
        else if (v < 8) base = '#3a3634';                                                   // 조명 레일
        else if (v >= WALLH - 5) base = '#4a4038';                                          // 굽도리
        else if (v === WALLH - 6) base = '#8a7a68';
        else { base = '#efe8da'; d = Math.round((prand('w' + side + ':' + (u >> 3) + ':' + (v >> 3)) - 0.5) * 4) + Math.round(5 - v * 9 / WALLH); }   // 미술관 흰 벽
        const p = wallXY(side, u, v);
        g.fillStyle = shade(base, d + dim); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      // 레일의 조명 — 액자 자리마다 하나, 아래로 빛
      SLOTS.filter(s => s.side === side && s.v === ROWS[0]).forEach(s => {
        wallRect(g, side, s.u + FW / 2 - 3, 6, 6, 4, '#2a2624'); wallRect(g, side, s.u + FW / 2 - 2, 9, 4, 1, '#ffe9a8');
        for (let v = 10; v < WALLH - 8; v++){ const hw = Math.min(28, 4 + (v - 10) * 0.55); g.fillStyle = 'rgba(255,240,200,' + (0.26 * (1 - (v - 10) / WALLH)).toFixed(3) + ')'; for (let du = -hw; du < hw; du++){ const p = wallXY(side, s.u + FW / 2 + du, v); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); } }
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
    // 가운데 붉은 양탄자
    const rug = tileXY(6.0, 3.1), RC = '#8e2f3a';
    for (let k = -25; k <= 25; k++){
      const hw = Math.round((1 - Math.abs(k) / 26) * 100); if (hw <= 0) continue;
      const edge = Math.abs(k) > 21;
      g.fillStyle = edge ? shade(RC, -40) : shade(RC, k % 6 === 0 ? -8 : 0);
      g.fillRect(Math.round(rug.x - hw), Math.round(rug.y + k * 2), hw * 2, 2);
      if (!edge && Math.abs(k) < 8){ const hw2 = Math.round((1 - Math.abs(k) / 8) * 30); g.fillStyle = shade(RC, 14); g.fillRect(Math.round(rug.x - hw2), Math.round(rug.y + k * 2), hw2 * 2, 2); }
    }
    drawPlant(g, Math.round(PLANT_AT.x - 16), Math.round(PLANT_AT.y - 30));
    if (phase !== 'day'){ g.fillStyle = phase === 'dusk' ? 'rgba(90,40,20,.10)' : 'rgba(16,20,60,.20)'; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, RW, RH); g.globalCompositeOperation = 'source-over'; }
    return (shells[phase] = c);
  }

  // ---------- 작품 사진 — 작은 캔버스로 미리 줄여 둔다(그대로 줄이면 도트가 튄다) ----------
  const thumbs = {};                                                     // id|w×h → { cv, ok }
  let onThumb = null;
  function thumbOf(w, W, H){
    const key = w.id + '|' + W + 'x' + H;
    if (thumbs[key]) return thumbs[key];
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const g = cv.getContext('2d'), col = KID_COLOR[w.author] || KID_COLOR.together;
    g.fillStyle = shade(col, 60); g.fillRect(0, 0, cv.width, cv.height);                   // 받는 동안은 옅은 아이 색
    g.fillStyle = shade(col, 10); g.fillRect(W - 6, H - 6, 12, 12);
    const t = (thumbs[key] = { cv, ok: false });
    const url = w.thumb_url || w.media_url;
    if (!url) return t;
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.onload = () => {
      const s = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);        // 꽉 채우고 가운데를 남긴다
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      t.ok = true; if (onThumb) onThumb();
    };
    img.src = url;
    return t;
  }

  // ---------- 벽 층 — 액자와 사진(작품 목록·받은 사진 수가 바뀔 때만) ----------
  let hung = [], easelW = null, videos = [], list = [], openFn = null, hits = [], hoverKey = null;
  let wallCv = null, wallKey = '';
  function frameColor(w){ return KID_COLOR[w.author] || KID_COLOR.together; }
  function drawFrameAt(g, s, w){
    const c = frameColor(w), t = thumbOf(w, FW, FH);
    wallRect(g, s.side, s.u + 2, s.v + 2, FW + 6, FH + 6, 'rgba(40,24,10,.22)');            // 그림자
    wallRect(g, s.side, s.u - 3, s.v - 3, FW + 6, FH + 6, INK);
    wallRect(g, s.side, s.u - 2, s.v - 2, FW + 4, FH + 4, shade(c, -30));
    wallRect(g, s.side, s.u - 1, s.v - 1, FW + 2, FH + 2, c);
    wallRect(g, s.side, s.u - 1, s.v - 1, FW + 2, 1, shade(c, 40));
    wallImage(g, s.side, s.u, s.v, FW, FH, t.cv);
    wallRect(g, s.side, s.u + 4, s.v + FH + 6, FW - 8, 4, '#d9cfbf'); wallRect(g, s.side, s.u + 4, s.v + FH + 9, FW - 8, 1, '#a09484');   // 이름표
    wallRect(g, s.side, s.u + 7, s.v + FH + 7, Math.max(6, Math.min(FW - 14, (w.title || '').length * 3)), 1, '#6f6558');
  }
  function bakeWall(){
    const key = hung.map(w => w.id + ':' + (thumbOf(w, FW, FH).ok ? 1 : 0)).join(',');
    if (wallCv && key === wallKey) return wallCv;
    wallKey = key;
    const c = wallCv || document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
    hits = hits.filter(h => !h.slot);
    hung.forEach((w, n) => { const s = SLOTS[n]; drawFrameAt(g, s, w); hits.push(Object.assign({ w, slot: true }, wallHit(s.side, s.u - 3, s.v - 3, FW + 6, FH + 14, 0))); });
    SLOTS.slice(hung.length).forEach(s => {                                                 // 빈 자리 — 점선 테
      const col = 'rgba(110,90,70,.22)';
      for (let d = 0; d < FW + 4; d += 6){ wallRect(g, s.side, s.u - 2 + d, s.v - 2, 2, 1, col); wallRect(g, s.side, s.u - 2 + d, s.v + FH + 1, 2, 1, col); }
      for (let d = 0; d < FH + 4; d += 5){ wallRect(g, s.side, s.u - 2, s.v - 2 + d, 1, 2, col); wallRect(g, s.side, s.u + FW + 1, s.v - 2 + d, 1, 2, col); }
    });
    return (wallCv = c);
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
  function drawEasel(g){
    const x = Math.round(EASEL.x), y = Math.round(EASEL.y), W = 44, H = 34;
    isoTopD(g, x + 2, y + 2, 16, 8, 'rgba(40,24,10,.24)');
    g.fillStyle = '#6e4a2a';
    g.fillRect(x - 13, y - 62, 2, 62); g.fillRect(x + 11, y - 62, 2, 62); g.fillRect(x - 1, y - 30, 2, 26);   // 다리 셋
    g.fillRect(x - 16, y - 34, 32, 2);                                                       // 받침
    if (!easelW) return;
    const c = frameColor(easelW), t = thumbOf(easelW, W, H), bx = x - W / 2, by = y - 36 - H;
    g.fillStyle = 'rgba(40,24,10,.22)'; g.fillRect(bx + 3, by + 3, W + 6, H + 6);
    g.fillStyle = INK; g.fillRect(bx - 3, by - 3, W + 6, H + 6);
    g.fillStyle = c; g.fillRect(bx - 2, by - 2, W + 4, H + 4);
    g.fillStyle = shade(c, 40); g.fillRect(bx - 2, by - 2, W + 4, 1);
    g.drawImage(t.cv, bx, by, W, H);
    g.fillStyle = '#ffd979'; g.fillRect(bx + W - 12, by - 6, 14, 7); g.fillStyle = INK; g.fillRect(bx + W - 12, by - 6, 14, 1); g.fillRect(bx + W - 12, by, 14, 1);
    g.fillStyle = INK; g.font = '800 6px "Suayona Sans", Pretendard, system-ui, sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillText('NEW', bx + W - 10, by - 5);
  }
  function drawTV(g){
    const x = Math.round(TV.x), y = Math.round(TV.y);
    isoTopD(g, x + 2, y + 2, 20, 10, 'rgba(40,24,10,.24)');
    isoBoxD(g, x, y, 18, 9, 10, '#7a5a3a', '#5a4028', '#452f1c', 0);                        // 받침장
    g.fillStyle = INK; g.fillRect(x - 17, y - 40, 34, 26);
    g.fillStyle = '#3a3634'; g.fillRect(x - 16, y - 39, 32, 24);
    g.fillStyle = '#1c2a3a'; g.fillRect(x - 14, y - 37, 28, 20);
    g.fillStyle = '#2f4a66'; g.fillRect(x - 14, y - 37, 28, 6);
    if (videos.length){
      g.fillStyle = '#fffaf0'; for (let k = 0; k < 8; k++) g.fillRect(x - 4, y - 32 + k, k < 4 ? k + 1 : 8 - k, 1);   // ▶
      g.fillStyle = INK; g.font = '800 6px "Suayona Sans", Pretendard, system-ui, sans-serif'; g.textBaseline = 'top'; g.textAlign = 'center';
      g.fillStyle = '#ffd979'; g.fillText('영상 ' + videos.length, x, y - 23);
    }
    g.fillStyle = '#6b6562'; g.fillRect(x - 3, y - 14, 6, 4);
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
  function walkerOf(k){
    if (!walkers[k]){ const s = walkFree(); walkers[k] = { i: s.i, j: s.j, ti: s.i, tj: s.j, wait: 600 + (k === 'yona' ? 1700 : 0), dir: 'down', flip: false, moving: false, phase: 0 }; }
    return walkers[k];
  }
  function walkKey(w){ const p = tileXY(w.i, w.j); return Math.round(p.x) + ',' + Math.round(p.y) + w.dir + w.flip + (w.moving ? Math.floor(w.phase) % 2 : 0); }
  function stepWalker(k, dt){
    const w = walkerOf(k), other = walkers[k === 'sua' ? 'yona' : 'sua'];
    if (w.wait > 0){ w.wait -= dt; if (w.moving){ w.moving = false; return true; } return false; }
    const di = w.ti - w.i, dj = w.tj - w.j, d = Math.hypot(di, dj);
    if (d < 0.02){
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
    if (phase !== 'day'){ g.globalCompositeOperation = 'source-atop'; g.fillStyle = phase === 'dusk' ? 'rgba(90,40,20,.10)' : 'rgba(16,20,60,.20)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; }
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
  const BUB_FONT = '800 13px "Suayona Sans", Pretendard, system-ui, sans-serif';
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
    const w = walkerOf(k); w.wait = Math.max(w.wait, 3200); w.moving = false; w.dir = 'down'; w.flip = false; w.ti = w.i; w.tj = w.j;
    const text = lines[talkTurn[k]++ % lines.length];
    kidSay(k, text); say(KID_NAME[k] + ': ' + text);                   // 방 아래 글줄에도 — 할머니가 읽기 쉽게
  }

  // ---------- 한 장 그리기 ----------
  function cvOf(){ return $('#galleryCv'); }
  function draw(){
    const cv = cvOf(); if (!cv) return;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, RW, RH);
    g.drawImage(shellCv(), 0, 0, RW, RH);
    g.drawImage(bakeWall(), 0, 0, RW, RH);
    const floor = [{ y: BENCH.y, f: () => drawBench(g) }, { y: EASEL.y, f: () => drawEasel(g) }, { y: TV.y, f: () => drawTV(g) }];
    const spots = {};
    KIDS.forEach(k => { const s = walkerSpot(k); if (s){ spots[k] = s; floor.push({ y: s.y, f: () => drawWalker(g, k, s) }); } });
    floor.sort((a, b) => a.y - b.y).forEach(o => o.f());
    if (hoverKey){ const h = hits.find(x => hitKey(x) === hoverKey); if (h){ g.strokeStyle = '#ffd979'; g.lineWidth = 2; g.strokeRect(Math.round(h.x0) + 1, Math.round(h.y0) + 1, Math.round(h.x1 - h.x0) - 2, Math.round(h.y1 - h.y0) - 2); } }
    KIDS.forEach(k => { const b = bubbleOf[k], s = spots[k]; if (b && s) drawBubble(g, s.x, s.y - 42, b.text); });
  }
  const hitKey = h => h.kid ? 'kid:' + h.kid : h.w ? 'w' + h.w.id : h.tv ? 'tv' : 'x';
  function hitAt(e){
    const cv = cvOf(), rc = cv.getBoundingClientRect(); if (!rc.width) return null;
    const x = (e.clientX - rc.left) / rc.width * RW, y = (e.clientY - rc.top) / rc.height * RH;
    for (const k of KIDS){ const s = walkerSpot(k); if (s && x >= s.x - 14 && x < s.x + 14 && y >= s.y - 40 && y < s.y + 3) return { kid: k, x0: s.x - 14, x1: s.x + 14, y0: s.y - 40, y1: s.y + 3 }; }
    const area = h => (h.x1 - h.x0) * (h.y1 - h.y0);
    return hits.filter(h => x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1).sort((a, b) => (b.front || 0) - (a.front || 0) || area(a) - area(b))[0] || null;
  }
  function captionOf(w){ return (w.title || '작품') + ' · ' + (KID_NAME[w.author] || '같이') + (w.made_on ? ' · ' + w.made_on.slice(0, 7).replace('-', '.') : ''); }
  function say(t){ const el = $('#galleryMsg'); if (el) el.textContent = t || ''; }
  let wired = false;
  function wire(){
    const cv = cvOf(); if (!cv || wired) return; wired = true;
    cv.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const h = hitAt(e), key = h ? hitKey(h) : null;
      cv.style.cursor = h ? 'pointer' : 'default';
      if (key !== hoverKey){ hoverKey = key; draw(); say(!h ? '' : h.kid ? KID_NAME[h.kid] + '를 누르면 이야기해요' : h.w ? captionOf(h.w) + (h.easel ? ' · 가장 새 작품' : '') : h.tv ? '영상 ' + videos.length + '개 · 누르면 가장 새 영상' : ''); }
    });
    cv.addEventListener('pointerleave', () => { if (hoverKey){ hoverKey = null; draw(); say(''); } });
    cv.addEventListener('click', e => {
      const h = hitAt(e); if (!h) return;
      if (h.kid){ kidTalk(h.kid); return; }
      const w = h.w || (h.tv ? videos[0] : null); if (!w || !openFn) return;
      const i = list.indexOf(w); if (i >= 0) openFn(i);
    });
    cv.addEventListener('keydown', e => { if (e.key === 'Enter' && hung[0] && openFn){ const i = list.indexOf(hung[0]); if (i >= 0) openFn(i); } });
  }

  // ---------- 보일 때만 걷는다 ----------
  let seen = true, seenAt = 0, lastTick = 0, lastDraw = 0;
  function loop(now){
    requestAnimationFrame(loop);
    try {
      const dt = Math.min(100, lastTick ? now - lastTick : 16); lastTick = now;
      if (now - seenAt >= 400){ seenAt = now; const cv = cvOf(), rc = cv && !cv.closest('[hidden]') && cv.getBoundingClientRect(); seen = !!rc && rc.width > 0 && rc.bottom > -60 && rc.top < (window.innerHeight || 800) + 60; }
      if (!seen || document.hidden || !list.length) return;
      let moved = false; KIDS.forEach(k => { if (stepWalker(k, dt)) moved = true; });
      if (moved && now - lastDraw >= 40){ draw(); lastDraw = now; }
    } catch (e) { /* 한 장 건너뛴다 */ }
  }
  let looping = false;

  // ---------- 바깥에서 부르는 것 ----------
  function render(visibleList, open){
    list = Array.isArray(visibleList) ? visibleList : []; openFn = open;
    const box = $('#galleryRoom'); if (!box) return;
    const images = list.filter(w => w.media_type !== 'youtube' && w.media_type !== 'video' && (w.thumb_url || w.media_url));
    videos = list.filter(w => w.media_type === 'youtube');
    box.hidden = !images.length && !videos.length;
    if (box.hidden) return;
    easelW = images[0] || null;
    hung = images.slice(1, 1 + SLOTS.length);
    hits = hits.filter(h => h.slot === undefined && !h.easel && !h.tv);
    if (easelW) hits.push({ w: easelW, easel: true, front: 2, x0: EASEL.x - 26, x1: EASEL.x + 26, y0: EASEL.y - 76, y1: EASEL.y + 4 });
    if (videos.length) hits.push({ tv: true, front: 2, x0: TV.x - 19, x1: TV.x + 19, y0: TV.y - 42, y1: TV.y + 8 });
    wallKey = '';                                                        // 목록이 바뀌었으니 다시 굽는다
    onThumb = () => { wallKey = ''; draw(); };
    const cv = cvOf(); if (cv){ cv.style.aspectRatio = RW + ' / ' + RH; cv.tabIndex = 0; }
    wire(); draw();
    if (!STILL && !looping){ looping = true; requestAnimationFrame(loop); }
  }
  window.GALLERY = { render, draw, _hits: () => hits, _walkers: walkers };
})();
