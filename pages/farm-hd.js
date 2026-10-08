// pages/farm-hd.js — 스테이지2 농장(오로라부터)의 고화소 그림. 2026-10-08 로키즈: 「도트 아이소와 다른 고화소 그래픽, 라이프퀘스트 수준」.
// 라이프퀘스트(hero-walk.js)처럼 캔버스 경로·그러데이션·빛 번짐으로 부드럽게 칠한다. 도트를 늘리지 않으니 화면 픽셀(DPR)대로 또렷하다.
// 지금은 시험 장면 — 하늘(오로라)·먼 산·얼음 바다·섬 절벽·눈 땅·돌길·전나무·서리 나무·가로등·수아·연아. 톤이 정해지면 farm.js 에 잇는다.
// 겹(뒤→앞): 하늘·별·달 · 오로라 · 먼 산 두 겹 · 얼음 바다(유빙·오로라 비침) · 섬 절벽(땅켜·눈 처마·고드름) · 눈 땅(마름모 결·눈더미·반짝임)
//   · 돌길 · 깊이순(나무·가로등·아이) · 가로등 빛 · 눈송이 · 비네트
(function(){
  'use strict';
  const TAU = Math.PI * 2, TW = 64, TH = 32;                             // 칸 마름모(논리 단위) — 도트 농장의 두 배 가까이
  const INK = 'rgba(22,30,48,.78)';
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ 0x5bd1e995);

  // 밤·낮 빛깔. 밤이 오로라 농장의 얼굴이고, 낮은 옅은 극지 하늘
  const LOOK = {
    night: { sky: ['#050a1e', '#0b1a3c', '#123a5a', '#1d5a6e'], star: true, aurora: 1, moon: true,
      far: '#1b2c52', far2: '#24406a', snowcap: 'rgba(200,225,255,.85)', sea: ['#0a1a34', '#06101f'], floe: ['#5d7cae', '#3e5a8a'],
      snow: ['#8197c6', '#5b6f9f'], snowHi: 'rgba(200,225,255,.13)', snowLo: 'rgba(20,30,70,.10)', drift: ['#a3b7e0', '#5e72a2'],
      cliff: ['#3a4766', '#2c3654', '#222a44', '#181e34'], stone: ['#6e7896', '#66708e', '#77809c', '#5f6886'],
      fir: ['#1f4a4a', '#163a3c', '#0f2a2e'], firSnow: ['#d4e2fa', '#9fb3dc'], frost: ['#9fc2e6', '#7aa3d0', '#d6e8fb'], trunk: ['#5a4038', '#3e2c28'],
      glow: 1, haze: 'rgba(40,90,130,', tint: null },
    day: { sky: ['#6fa6d8', '#9ccbe8', '#cfe6f3', '#f2f6f8'], star: false, aurora: 0.12, moon: false,
      far: '#a6bfd8', far2: '#8aa8c8', snowcap: 'rgba(255,255,255,.95)', sea: ['#7fb0d4', '#4f86b4'], floe: ['#f4f9ff', '#c8dcef'],
      snow: ['#f6faff', '#dbe7f4'], snowHi: 'rgba(255,255,255,.4)', snowLo: 'rgba(90,120,170,.07)', drift: ['#ffffff', '#b9cce4'],
      cliff: ['#7c8aa4', '#66748f', '#535f78', '#3f4860'], stone: ['#c9cfdb', '#bec5d3', '#d4d9e3', '#b3bbcb'],
      fir: ['#2f6b5c', '#22564a', '#174238'], firSnow: ['#ffffff', '#cddcef'], frost: ['#d8ebfa', '#b4d2ee', '#ffffff'], trunk: ['#7a5a48', '#5a4034'],
      glow: 0, haze: 'rgba(220,236,248,', tint: null },
  };

  function mount(cv, opts){
    opts = opts || {};
    const COLS = opts.cols || 26, ROWS = opts.rows || 20;
    const g = cv.getContext('2d');
    const IW = (COLS + ROWS) * TW / 2, IHt = (COLS + ROWS) * TH / 2, SKY = 230, CLIFF = 130;
    let LW = 0, LH = 0, K = 1, DPR = 1, OX = 0, OY = 0, t = 0, raf = 0, last = 0;
    const tod = () => opts.tod || ((h => h < 6 || h >= 18.5 ? 'night' : 'day')(new Date().getHours()));
    const P = (u, v, z) => [OX + (u - v) * TW / 2, OY + (u + v) * TH / 2 - (z || 0)];

    function layout(){
      const r = cv.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      const Wd = Math.round(w * DPR), Hd = Math.round(h * DPR);
      if (cv.width !== Wd || cv.height !== Hd){ cv.width = Wd; cv.height = Hd; }
      K = Math.min(w / (IW + 60), h / (SKY + IHt + CLIFF + 70));
      LW = w / K; LH = h / K;
      OX = LW / 2 - (COLS - ROWS) * TW / 4; OY = (LH - (SKY + IHt + CLIFF)) / 2 + SKY;
    }

    // ---------- 붓 ----------
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const poly = (pts, c) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (c){ g.fillStyle = c; g.fill(); } };
    const oval = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };
    const lin = (y0, y1, cols) => { const gr = g.createLinearGradient(0, y0, 0, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
    const glow = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + a + ')'); gr.addColorStop(1, c + '0)'); R(x - r, y - r, r * 2, r * 2, gr); };
    const horizon = () => OY - 28;

    // ① 하늘 · 별 · 달
    function sky(L){
      R(0, 0, LW, LH, lin(0, horizon(), L.sky));
      if (L.star) for (let i = 0; i < 140; i++){
        const x = hash(i * 7 + 1) * LW, y = hash(i * 11 + 3) * horizon() * 0.95, a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + hash(i) * 1.2) + i)), s = hash(i * 5) < 0.12 ? 1.8 : 1.1;
        R(x, y, s, s, 'rgba(235,245,255,' + a.toFixed(2) + ')');
        if (i % 13 === 0){ R(x - 2.5, y + s / 2 - 0.25, 5 + s, 0.5, 'rgba(235,245,255,' + (a * 0.5).toFixed(2) + ')'); R(x + s / 2 - 0.25, y - 2.5, 0.5, 5 + s, 'rgba(235,245,255,' + (a * 0.5).toFixed(2) + ')'); }
      }
      if (L.moon){ const x = LW * 0.84, y = horizon() * 0.22; glow(x, y, 70, 'rgba(210,230,255,', 0.35); oval(x, y, 15, 15, '#eef3ff'); oval(x + 5, y - 3, 13, 14, L.sky[0]); }
      else { const x = LW * 0.2, y = horizon() * 0.62; glow(x, y, 110, 'rgba(255,246,220,', 0.6); oval(x, y, 16, 16, '#fffaf0'); }
    }
    // ② 오로라 — 세로 빛 띠를 물결 따라 촘촘히 세운다. 띠 하나는 한 번 구운 그러데이션 막대를 늘여 붙여 매 장면 값이 싸다
    const curtainMemo = {};
    function curtain(col){
      if (curtainMemo[col]) return curtainMemo[col];
      const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(' + col + ',0)'); gr.addColorStop(0.55, 'rgba(' + col + ',.28)'); gr.addColorStop(0.9, 'rgba(' + col + ',.85)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      x.fillStyle = gr; x.fillRect(0, 0, 4, 128); return (curtainMemo[col] = c);
    }
    const RIBBONS = [
      { col: '120,255,190', y: 0.46, amp: 34, f: 0.0042, sp: 0.16, tall: 150, sd: 1.2 },
      { col: '90,220,255', y: 0.34, amp: 26, f: 0.0058, sp: -0.11, tall: 120, sd: 3.7 },
      { col: '200,130,255', y: 0.22, amp: 22, f: 0.0035, sp: 0.08, tall: 100, sd: 6.1 },
    ];
    function auroraAt(y0, flip, a){
      g.save(); g.globalCompositeOperation = 'lighter';
      RIBBONS.forEach(rb => {
        const im = curtain(rb.col), hy = horizon();
        for (let x = -4; x < LW + 4; x += 3){
          const base = hy * rb.y + rb.amp * Math.sin(x * rb.f + t * rb.sp + rb.sd) + rb.amp * 0.4 * Math.sin(x * rb.f * 2.6 - t * rb.sp * 1.7);
          const k = 0.5 + 0.5 * Math.sin(x * 0.011 + t * 0.6 + rb.sd) * Math.sin(x * 0.0037 - t * 0.23);
          if (k < 0.08) continue;
          const tall = rb.tall * (0.7 + 0.5 * k);
          g.globalAlpha = a * k;
          if (!flip) g.drawImage(im, x, base - tall, 3.4, tall);
          else { const yy = y0 + (y0 - base) * 0.25; g.save(); g.translate(0, yy); g.scale(1, -0.25); g.drawImage(im, x, -tall, 3.4, tall); g.restore(); }
        }
      });
      g.restore();
    }
    // ③ 먼 산 — 뾰족한 극지 산맥 두 겹, 봉우리에 눈
    // 봉우리는 |sin| 을 뒤집어 뾰족하게 — 둥근 물결이 아니라 산맥으로 읽힌다
    const peak = x => 1 - Math.abs(Math.sin(x));
    const ridgeY = (x, base, amp, f, sd) => base - amp * (0.15 + 0.55 * Math.pow(peak(x * f + sd), 1.6) + 0.3 * Math.pow(peak(x * f * 2.7 + sd * 1.7), 2) + 0.06 * Math.sin(x * f * 9 + sd));
    function ridge(base, amp, f, sd, fill, cap){
      g.beginPath(); g.moveTo(0, LH); for (let x = 0; x <= LW + 6; x += 4) g.lineTo(x, ridgeY(x, base, amp, f, sd)); g.lineTo(LW, LH); g.closePath(); g.fillStyle = fill; g.fill();
      g.save(); g.clip(); g.fillStyle = cap; g.beginPath();
      for (let x = 0; x <= LW + 6; x += 4){ const y = ridgeY(x, base, amp, f, sd); g.lineTo(x, y + Math.max(0, base - amp * 0.4 - y) * (0.42 + 0.12 * Math.sin(x * 0.13 + sd))); }   // 높은 봉우리일수록 눈이 깊다
      for (let x = LW + 6; x >= 0; x -= 4) g.lineTo(x, ridgeY(x, base, amp, f, sd) - 4);
      g.closePath(); g.fill(); g.restore();
    }
    // ④ 얼음 바다 — 섬 아래 끝까지. 유빙과 오로라 비침
    function sea(L){
      const y0 = horizon();
      R(0, y0, LW, LH - y0, lin(y0, LH, L.sea));
      if (L.aurora > 0.5) auroraAt(y0, true, 0.35);
      R(0, y0, LW, 1.2, L.glow ? 'rgba(160,230,220,.35)' : 'rgba(255,255,255,.7)');
      for (let i = 0; i < 46; i++){
        const yy = y0 + 6 + Math.pow(hash(i * 3 + 7), 1.6) * (LH - y0), s = 0.4 + (yy - y0) / (LH - y0) * 1.4;
        const x = hash(i * 13 + 2) * LW + Math.sin(t * 0.2 + i) * 2, w = (14 + hash(i) * 30) * s, h = w * 0.32;
        g.save(); g.translate(x, yy);
        poly([[-w * 0.5, 0], [-w * 0.2, -h * 0.5], [w * 0.35, -h * 0.4], [w * 0.5, h * 0.05], [w * 0.1, h * 0.5], [-w * 0.35, h * 0.35]], L.floe[1]);
        poly([[-w * 0.5, -2 * s], [-w * 0.2, -h * 0.5 - 2 * s], [w * 0.35, -h * 0.4 - 2 * s], [w * 0.5, h * 0.05 - 2 * s], [w * 0.1, h * 0.5 - 2 * s], [-w * 0.35, h * 0.35 - 2 * s]], L.floe[0]);
        g.restore();
      }
    }
    // ⑤ 섬 절벽 — 앞 두 면(왼쪽 아래·오른쪽 아래). 땅켜 띠 → 뾰족한 밑동 → 눈 처마와 고드름
    function cliff(L){
      const lc = P(0, ROWS), bc = P(COLS, ROWS), rc = P(COLS, 0);
      const face = (a, b, shade) => {
        for (let i = 0; i < 4; i++){
          const d0 = CLIFF * i / 4, d1 = CLIFF * (i + 1) / 4 + 1;
          poly([[a[0], a[1] + d0], [b[0], b[1] + d0], [b[0], b[1] + d1], [a[0], a[1] + d1]], L.cliff[i]);
        }
        g.fillStyle = 'rgba(0,0,0,' + shade + ')'; poly([[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + CLIFF], [a[0], a[1] + CLIFF]]); g.fill();
        // 바위 결 — 비스듬한 금
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.2; g.beginPath();
        for (let i = 0; i < 40; i++){ const f = hash(i * 9 + (shade > 0.1 ? 3 : 0)), x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 18 + hash(i * 5) * (CLIFF - 30); g.moveTo(x, y); g.lineTo(x + 8, y + 5); }
        g.stroke();
        // 밑동 — 뾰족뾰족 줄어드는 바위
        g.fillStyle = L.cliff[3]; g.beginPath(); g.moveTo(a[0], a[1] + CLIFF);
        const n = 22; for (let i = 0; i <= n; i++){ const f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + CLIFF; g.lineTo(x, y + (i % 2 ? 6 : 16 + hash(i * 7 + shade * 100) * 26)); }
        g.lineTo(b[0], b[1] + CLIFF); g.closePath(); g.fill();
      };
      face(lc, bc, 0); face(bc, rc, 0.18);
      // 눈 처마 — 둥글게 넘친 눈 + 고드름
      const eave = (a, b) => {
        g.fillStyle = L.drift[0]; g.beginPath(); g.moveTo(a[0], a[1] - 2);
        const n = 30; for (let i = 0; i <= n; i++){ const f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f; g.lineTo(x, y + 7 + Math.sin(i * 1.7) * 2.5 + hash(i * 3) * 3); }
        g.lineTo(b[0], b[1] - 2); g.closePath(); g.fill();
        g.fillStyle = L.glow ? 'rgba(190,230,255,.75)' : 'rgba(220,240,255,.9)';
        for (let i = 0; i < 26; i++){ const f = (i + hash(i * 11)) / 26, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 8, l = 6 + hash(i * 17) * 14; poly([[x - 1.8, y], [x + 1.8, y], [x, y + l]]); g.fill(); }
      };
      eave(lc, bc); eave(bc, rc);
    }
    // ⑥ 눈 땅 — 마름모 결(밝은·어두운 묶음) · 눈더미 · 마른 풀 · 반짝임
    const PATH = new Set();
    for (let u = 0; u < COLS; u++) PATH.add(u + ',' + 11);              // 섬을 가로지르는 돌길(u 방향)
    for (let v = 3; v < 11; v++) PATH.add(8 + ',' + v);                  // 집 자리(앞쪽 왼편)에서 내려오는 갈림길
    const isPath = (u, v) => PATH.has(u + ',' + v);
    function diamond(path, u, v, a){ a = 0.5 - (a || 0); let p = P(u + 0.5 - a, v + 0.5 - a); path.moveTo(p[0], p[1]); p = P(u + 0.5 + a, v + 0.5 - a); path.lineTo(p[0], p[1]); p = P(u + 0.5 + a, v + 0.5 + a); path.lineTo(p[0], p[1]); p = P(u + 0.5 - a, v + 0.5 + a); path.lineTo(p[0], p[1]); path.closePath(); }
    function ground(L){
      const tc = P(0, 0), rc = P(COLS, 0), bc = P(COLS, ROWS), lc = P(0, ROWS);
      g.save(); poly([tc, rc, bc, lc]); g.clip();
      R(lc[0], tc[1], rc[0] - lc[0], bc[1] - tc[1], lin(tc[1], bc[1], L.snow));
      const lite = new Path2D(), dark = new Path2D(), tufts = new Path2D(), stones = L.stone.map(() => new Path2D()), hi = new Path2D(), lo = new Path2D(), dust = new Path2D();
      for (let u = 0; u < COLS; u++) for (let v = 0; v < ROWS; v++){
        if (isPath(u, v)){
          diamond(stones[Math.floor(h2(u * 5 + 3, v + 40) * 4)], u, v, 0.05);
          const a = 0.45, l = P(u + 0.5 - a, v + 0.5 + a), tp = P(u + 0.5 - a, v + 0.5 - a), r = P(u + 0.5 + a, v + 0.5 - a), b = P(u + 0.5 + a, v + 0.5 + a);
          hi.moveTo(l[0], l[1]); hi.lineTo(tp[0], tp[1]); hi.lineTo(r[0], r[1]); lo.moveTo(r[0], r[1]); lo.lineTo(b[0], b[1]); lo.lineTo(l[0], l[1]);
          if (h2(u, v + 77) < 0.4){ const m = P(u + 0.3 + h2(u, v) * 0.4, v + 0.5); dust.moveTo(m[0] + 7, m[1]); dust.ellipse(m[0], m[1], 7, 2.6, 0, 0, TAU); }
          continue;
        }
        const h = h2(u, v);
        if (h < 0.28) diamond(lite, u, v, 0.03); else if (h > 0.74) diamond(dark, u, v, 0.03);
        const d = h2(u * 3 + 1, v * 7 + 2);
        if (d < 0.14){ const p = P(u + 0.3 + h2(u, v + 3) * 0.4, v + 0.3 + h2(u + 3, v) * 0.4); for (let k = -2; k <= 2; k++){ tufts.moveTo(p[0] + k * 1.6, p[1]); tufts.lineTo(p[0] + k * 3.2, p[1] - 6 - (2 - Math.abs(k)) * 2.5); } }
      }
      g.fillStyle = L.snowHi; g.fill(lite); g.fillStyle = L.snowLo; g.fill(dark);
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.7; g.stroke(lite);
      g.strokeStyle = L.glow ? 'rgba(120,110,90,.7)' : 'rgba(150,130,90,.8)'; g.lineWidth = 1.1; g.lineCap = 'round'; g.stroke(tufts);
      // 길 — 바닥 그늘 띠 위에 돌 마름모
      const pathBed = new Path2D(); PATH.forEach(k => { const [u, v] = k.split(',').map(Number); diamond(pathBed, u, v, -0.06); });
      g.fillStyle = L.glow ? 'rgba(30,40,70,.45)' : 'rgba(110,120,140,.45)'; g.fill(pathBed);
      stones.forEach((p, i) => { g.fillStyle = L.stone[i]; g.fill(p); });
      g.lineWidth = 1.1; g.strokeStyle = 'rgba(255,255,255,.5)'; g.stroke(hi); g.strokeStyle = 'rgba(30,40,70,.35)'; g.stroke(lo);
      g.fillStyle = L.drift[0]; g.globalAlpha = 0.75; g.fill(dust); g.globalAlpha = 1;
      // 눈더미 — 둥근 언덕(그늘 아래 한 겹)
      for (let i = 0; i < 34; i++){
        const u = hash(i * 31 + 5) * COLS, v = hash(i * 17 + 9) * ROWS; if (isPath(Math.floor(u), Math.floor(v)) || isPath(Math.floor(u), Math.floor(v) + 1) || isPath(Math.floor(u), Math.floor(v) - 1)) continue;
        const p = P(u, v), w = 14 + hash(i) * 22;
        oval(p[0] + 2, p[1] + 2, w, w * 0.34, L.snowLo); oval(p[0], p[1], w, w * 0.36, L.drift[0]); oval(p[0] - w * 0.25, p[1] - w * 0.12, w * 0.5, w * 0.14, 'rgba(255,255,255,.55)');
      }
      // 섬 가장자리 — 뒤 두 변에 옅은 빛(오로라가 비친 눈)
      if (L.glow){ g.strokeStyle = 'rgba(140,255,210,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(lc[0], lc[1]); g.lineTo(tc[0], tc[1]); g.lineTo(rc[0], rc[1]); g.stroke(); }
      // 반짝이는 눈 알갱이
      for (let i = 0; i < 90; i++){ const p = P(hash(i * 7 + 2) * COLS, hash(i * 3 + 8) * ROWS), a = Math.max(0, Math.sin(t * (1 + hash(i) * 2) + i * 2.3)); if (a < 0.6) continue; R(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6, 'rgba(255,255,255,' + ((a - 0.6) * 2.4).toFixed(2) + ')'); }
      g.restore();
    }

    // ---------- 선 것들 ----------
    // 전나무 — 층마다 그늘 반쪽 + 위에 눈. s = 크기
    function fir(x, y, s, L, sd){
      oval(x + 4 * s, y + 1, 18 * s, 6 * s, 'rgba(20,30,60,.22)');
      R(x - 3 * s, y - 12 * s, 6 * s, 13 * s, L.trunk[1]);
      const tiers = 4, top = y - 92 * s;
      for (let i = 0; i < tiers; i++){
        const yb = y - 10 * s - i * 19 * s, w = (30 - i * 6.5) * s, ht = 34 * s, yt = yb - ht;
        poly([[x, yt], [x + w, yb], [x + w * 0.3, yb + 3 * s], [x - w * 0.4, yb + 2 * s], [x - w, yb]], L.fir[0]);
        poly([[x, yt], [x + w, yb], [x + w * 0.3, yb + 3 * s], [x + w * 0.1, yb]], L.fir[2]);
        g.strokeStyle = INK; g.lineWidth = 1.1; poly([[x, yt], [x + w, yb], [x + w * 0.3, yb + 3 * s], [x - w * 0.4, yb + 2 * s], [x - w, yb]]); g.stroke();
        // 눈 — 층 윗부분을 물결로 덮는다
        const sy = yt + ht * 0.55;
        g.fillStyle = L.firSnow[0]; g.beginPath(); g.moveTo(x, yt + 1);
        g.lineTo(x + w * 0.55, sy); for (let k = 4; k >= -4; k--) g.lineTo(x + w * 0.55 * k / 4, sy + (k % 2 ? 4 : -1) * s + hash(sd * 13 + i * 7 + k) * 3 * s);
        g.closePath(); g.fill();
        g.fillStyle = L.firSnow[1]; g.beginPath(); g.moveTo(x + 1, yt + 2); g.lineTo(x + w * 0.55, sy); g.lineTo(x + w * 0.2, sy + 2 * s); g.closePath(); g.fill();
      }
      oval(x, top + 4 * s, 4 * s, 3 * s, L.firSnow[0]);
    }
    // 서리 나무 — 둥근 잎 뭉치(라이프퀘스트 둥근 나무)에 서리 빛깔
    function frostTree(x, y, s, L, sd){
      oval(x + 5 * s, y + 1, 20 * s, 7 * s, 'rgba(20,30,60,.22)');
      g.fillStyle = L.trunk[0]; poly([[x - 3 * s, y], [x + 3 * s, y], [x + 2 * s, y - 34 * s], [x - 2 * s, y - 34 * s]]); g.fill();
      g.strokeStyle = L.trunk[0]; g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(x, y - 24 * s); g.lineTo(x + 9 * s, y - 34 * s); g.stroke();
      const B = [[-12, -44, 15], [10, -46, 14], [0, -58, 16], [-4, -40, 13], [12, -36, 11]];
      B.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s + 1.5, b[2] * s + 1.5, INK));
      B.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s, L.frost[1]));
      B.forEach(b => oval(x + (b[0] - 3) * s, y + (b[1] - 3) * s, b[2] * s * 0.72, b[2] * s * 0.68, L.frost[0]));
      B.forEach((b, i) => oval(x + (b[0] - 6) * s, y + (b[1] - 7) * s, b[2] * s * 0.32, b[2] * s * 0.22, L.frost[2]));
      if (L.glow) for (let i = 0; i < 5; i++){ const a = Math.max(0, Math.sin(t * 2 + sd * 3 + i * 1.7)); oval(x + (hash(sd + i) - 0.5) * 34 * s, y - (38 + hash(sd * 3 + i) * 22) * s, 1.4, 1.4, 'rgba(255,255,255,' + a.toFixed(2) + ')'); }
    }
    // 가로등 — 쇠 기둥, 위에 등. 빛 번짐은 맨 나중에 한꺼번에(lampGlow)
    function lamp(x, y, L){
      oval(x, y + 1, 9, 3.5, 'rgba(20,30,60,.3)');
      poly([[x - 6, y], [x + 6, y], [x + 4, y - 6], [x - 4, y - 6]], '#3a3f52');
      R(x - 1.6, y - 52, 3.2, 47, '#454b60'); R(x - 1.6, y - 52, 1.2, 47, '#646b84');
      poly([[x - 8, y - 66], [x + 8, y - 66], [x + 5, y - 52], [x - 5, y - 52]], '#2f3446');
      poly([[x - 5.5, y - 64], [x + 5.5, y - 64], [x + 3.6, y - 54], [x - 3.6, y - 54]], L.glow ? '#ffe7a4' : '#e9eef6');
      poly([[x - 10, y - 66], [x, y - 74], [x + 10, y - 66]], '#2f3446'); oval(x, y - 69, 7, 2.6, L.firSnow[0]);
    }
    function lampGlow(x, y){
      g.save(); g.globalCompositeOperation = 'lighter';
      glow(x, y - 59, 52, 'rgba(255,214,140,', 0.6);
      g.translate(x, y); g.scale(1, 0.5); glow(0, 0, 96, 'rgba(255,190,110,', 0.42); g.restore();
    }
    // 아이 — 라이프퀘스트 걷기 그림(앞옆 서기 칸). 발끝이 (x, y)
    const ATLAS = {
      sua:  { src: '/pages/hero-sua.png?v=1005a',  w: 166, h: 231, foot: 228, cx: 83, tall: 220 },
      yona: { src: '/pages/hero-yona.png?v=1005a', w: 144, h: 229, foot: 226, cx: 72, tall: 220 },
    };
    const imgs = {};
    function kid(k, x, y, flip, tall){
      const A = ATLAS[k]; let im = imgs[k]; if (!im){ im = imgs[k] = new Image(); im.src = A.src; }
      oval(x, y + 1, tall * 0.2, tall * 0.07, 'rgba(20,30,60,.3)');
      if (!im.complete || !im.naturalWidth) return;
      const sc = tall / A.tall, bob = STILL ? 0 : Math.sin(t * 2.4 + (k === 'sua' ? 0 : 1.3)) * 0.8;
      g.save(); g.translate(x, y + bob * 0); if (flip) g.scale(-1, 1);
      g.drawImage(im, 0, A.h, A.w, A.h, -A.cx * sc, -A.foot * sc - Math.abs(bob), A.w * sc, A.h * sc);
      g.restore();
    }

    // 무엇이 어디 섰는지 — 칸 (u, v) 가운데. 집·가게 자리(앞 왼쪽, 뒤 오른쪽)는 비워 둔다
    const THINGS = [];
    (function plant(){
      const free = (u, v) => !isPath(u, v) && !isPath(u, v - 1) && !isPath(u, v + 1) && !(u < 6 && v < 5) && !(u > 18 && v < 4) && !(u >= 6 && u <= 16 && v >= 3 && v <= 9);
      for (let i = 0; i < 400 && THINGS.length < 46; i++){
        const u = Math.floor(hash(i * 41 + 3) * COLS), v = Math.floor(hash(i * 23 + 11) * ROWS);
        if (!free(u, v) || THINGS.some(o => Math.abs(o.u - u - 0.5) < 1.6 && Math.abs(o.v - v - 0.5) < 1.6)) continue;
        const edge = u < 3 || v < 3 || u > COLS - 4 || v > ROWS - 4;
        if (!edge && hash(i * 7) < 0.55) continue;                      // 가운데는 성기게, 가장자리는 숲처럼
        THINGS.push({ kind: hash(i * 13) < 0.68 ? 'fir' : 'frost', u: u + 0.5, v: v + 0.5, s: 0.75 + hash(i * 3) * 0.5, sd: i });
      }
      [[3, 12.5], [9, 12.5], [15, 12.5], [21, 12.5], [9.5, 6]].forEach(p => THINGS.push({ kind: 'lamp', u: p[0], v: p[1] }));
      THINGS.push({ kind: 'kid', k: 'sua', u: 12.4, v: 11.6, tall: 64 }, { kind: 'kid', k: 'yona', u: 11.2, v: 11.4, tall: 58 });
    })();

    // 눈송이 — 화면 기준
    const flakes = Array.from({ length: 120 }, (_, i) => ({ x: hash(i * 3 + 1), y: hash(i * 7 + 2), s: 0.6 + hash(i * 11) * 1.4, ph: hash(i) * TAU }));

    function draw(){
      const L = LOOK[tod()];
      g.setTransform(DPR * K, 0, 0, DPR * K, 0, 0);
      sky(L);
      if (L.aurora) auroraAt(0, false, L.aurora);
      const hy = horizon();
      ridge(hy - 6, 150, 0.0065, 1.3, L.far, L.snowcap);
      ridge(hy + 2, 80, 0.012, 4.2, L.far2, L.snowcap);
      g.fillStyle = lin(hy - 60, hy + 4, [L.haze + '0)', L.haze + '.45)']); g.fillRect(0, hy - 60, LW, 64);
      sea(L);
      cliff(L);
      ground(L);
      const list = THINGS.slice().sort((a, b) => (a.u + a.v) - (b.u + b.v));
      list.forEach(o => {
        const p = P(o.u, o.v);
        if (o.kind === 'fir') fir(p[0], p[1], o.s, L, o.sd);
        else if (o.kind === 'frost') frostTree(p[0], p[1], o.s, L, o.sd);
        else if (o.kind === 'lamp') lamp(p[0], p[1], L);
        else kid(o.k, p[0], p[1], o.k === 'yona', o.tall);
      });
      if (L.glow) list.forEach(o => { if (o.kind === 'lamp'){ const p = P(o.u, o.v); lampGlow(p[0], p[1]); } });
      // 눈송이
      g.fillStyle = 'rgba(255,255,255,.85)';
      flakes.forEach(f => { const x = ((f.x * LW + Math.sin(t * 0.7 + f.ph) * 14 - t * 6 * f.s) % LW + LW) % LW, y = ((f.y * LH + t * 18 * f.s) % LH + LH) % LH; g.beginPath(); g.arc(x, y, f.s, 0, TAU); g.fill(); });
      // 비네트
      const vg = g.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.35, LW / 2, LH / 2, Math.max(LW, LH) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,20,0)'); vg.addColorStop(1, L.glow ? 'rgba(0,0,20,.5)' : 'rgba(40,60,90,.18)'); R(0, 0, LW, LH, vg);
    }
    function loop(now){
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;                                        // 30장/초면 넉넉하다
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now; if (!STILL) t += dt;
      draw();
    }
    layout(); window.addEventListener('resize', layout);
    if (STILL){ draw(); setInterval(draw, 2000); } else raf = requestAnimationFrame(loop);
    return { stop(){ cancelAnimationFrame(raf); }, set(o){ Object.assign(opts, o); } };
  }
  window.FARMHD = { mount };
})();
