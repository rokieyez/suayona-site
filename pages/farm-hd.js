// pages/farm-hd.js — 스테이지2 농장(오로라부터)의 고화소 그림. 2026-10-08 로키즈: 「도트 아이소와 다른 고화소 그래픽, 라이프퀘스트 수준」.
// 라이프퀘스트(hero-walk.js)처럼 캔버스 경로·그러데이션·빛 번짐으로 부드럽게 칠한다. 도트를 늘리지 않으니 화면 픽셀대로 또렷하다.
// 좌표는 농장(farm.js)의 도트 단위 그대로다 — 칸 마름모 40×20, E.P(u, v, z) 가 칸 → 도트. farm.js 는 ctx 를 S 배 키워 놓고 부른다.
// E(환경): { P, cols, rows, top, cliff, w, h, night, t(초), lamp(x, y, r, c), chimney(x, y) }
// 겹(뒤→앞): backdrop(하늘·오로라·먼 산·얼음 바다, 매 장) · island(절벽·눈 땅·돌길, 담아 둠) · floor(연못·꽃길·목장 바닥) · thing(건물·꾸미개·나무, 담아 둠) · live(움직이는 것, 매 장)
(function(){
  'use strict';
  const TAU = Math.PI * 2;
  const INK = 'rgba(22,30,48,.72)', LW = 0.7;                           // 테두리 — 도트 0.7 이면 화면에서 2px 안팎
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ 0x5bd1e995);

  // ---------- 빛깔 ----------
  // 밤이 오로라 농장의 얼굴이고, 낮은 옅은 극지 하늘. 건물 빛깔은 낮 것 하나만 두고 밤에는 쪽빛으로 눌러(tone) 쓴다
  const LOOK = {
    night: { sky: ['#050a1e', '#0b1a3c', '#123a5a', '#1d5a6e'], star: true, aurora: 1, moon: true,
      far: '#1b2c52', far2: '#24406a', snowcap: 'rgba(200,225,255,.85)', sea: ['#0a1a34', '#06101f'], floe: ['#5d7cae', '#3e5a8a'],
      snow: ['#8197c6', '#5b6f9f'], snowHi: 'rgba(200,225,255,.13)', snowLo: 'rgba(20,30,70,.10)', drift: ['#a3b7e0', '#5e72a2'],
      cliff: ['#3a4766', '#2c3654', '#222a44', '#181e34'], stone: ['#6e7896', '#66708e', '#77809c', '#5f6886'],
      fir: ['#1f4a4a', '#163a3c', '#0f2a2e'], firSnow: ['#c4d4f2', '#8fa3cf'], frost: ['#9fc2e6', '#7aa3d0', '#d6e8fb'], trunk: ['#5a4038', '#3e2c28'],
      glow: 1, haze: 'rgba(40,90,130,', shadow: 'rgba(10,16,40,.32)', win: '#ffd98a', ice: ['#5f86b8', '#3f5f92', '#a8c8ec'] },
    day: { sky: ['#6fa6d8', '#9ccbe8', '#cfe6f3', '#f2f6f8'], star: false, aurora: 0.12, moon: false,
      far: '#a6bfd8', far2: '#8aa8c8', snowcap: 'rgba(255,255,255,.95)', sea: ['#7fb0d4', '#4f86b4'], floe: ['#f4f9ff', '#c8dcef'],
      snow: ['#f6faff', '#dbe7f4'], snowHi: 'rgba(255,255,255,.4)', snowLo: 'rgba(90,120,170,.07)', drift: ['#ffffff', '#b9cce4'],
      cliff: ['#7c8aa4', '#66748f', '#535f78', '#3f4860'], stone: ['#c9cfdb', '#bec5d3', '#d4d9e3', '#b3bbcb'],
      fir: ['#2f6b5c', '#22564a', '#174238'], firSnow: ['#ffffff', '#cddcef'], frost: ['#d8ebfa', '#b4d2ee', '#ffffff'], trunk: ['#7a5a48', '#5a4034'],
      glow: 0, haze: 'rgba(220,236,248,', shadow: 'rgba(60,90,140,.2)', win: '#9cc4e4', ice: ['#bfe0f6', '#8fbfe4', '#ffffff'] },
  };
  const look = E => E.night ? LOOK.night : LOOK.day;
  const rgb = c => { const v = parseInt(c.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  function mix(a, b, k){ const A = rgb(a), B = rgb(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join(''); }
  const shade = (c, k) => c[0] !== '#' ? c : k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k);
  const toneMemo = {};
  const tone = (E, c) => E.night ? (toneMemo[c] || (toneMemo[c] = mix(c, '#14204a', 0.48))) : c;

  // ---------- 붓 ----------
  let g = null;                                                          // 지금 칠하는 캔버스(부를 때마다 받는다)
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const path = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  const poly = (pts, c, ink) => { path(pts); if (c){ g.fillStyle = c; g.fill(); } if (ink){ g.strokeStyle = INK; g.lineWidth = ink === true ? LW : ink; g.lineJoin = 'round'; g.stroke(); } };
  const oval = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); g.fill(); };
  const lin = (x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
  const vgrad = (y0, y1, cols) => lin(0, y0, 0, y1, cols);
  const glow = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + a + ')'); gr.addColorStop(1, c + '0)'); R(x - r, y - r, r * 2, r * 2, gr); };
  const line = (a, b, c, w) => { g.strokeStyle = c; g.lineWidth = w || LW; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };

  // ---------- 아이소 상자 · 지붕 ----------
  // 칸 좌표 세 개짜리 점 [u, v, z] 를 도트로
  let P3 = null;
  const q = (u, v, z) => P3(u, v, z);
  const poly3 = (pts, c, ink) => poly(pts.map(p => q(p[0], p[1], p[2])), c, ink);
  // 앞 두 면(앞 = v1 쪽, 오른쪽 = u1 쪽)과 윗면. 면 빛깔은 위가 밝은 그러데이션
  function box(u0, v0, u1, v1, z0, z1, col, o){
    o = o || {};
    const L = [[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], Rt = [[u1, v1, z0], [u1, v0, z0], [u1, v0, z1], [u1, v1, z1]];
    const a = q(u0, v1, z1), b = q(u0, v1, z0);
    poly3(L, o.left || vgrad(a[1], b[1], [shade(col, 0.08), shade(col, -0.08)]));
    const c = q(u1, v0, z1), d = q(u1, v0, z0);
    poly3(Rt, o.right || vgrad(c[1], d[1], [shade(col, -0.2), shade(col, -0.32)]));
    if (o.top !== false) poly3([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], o.top || shade(col, 0.16));
    if (o.ink !== false){ poly3(L, null, true); poly3(Rt, null, true); if (o.top !== false) poly3([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], null, true); }
  }
  // 면 위에 붙이는 네모(창·문). side 'L' = 앞면(v1, u 를 따라 a), 'R' = 오른쪽 면(u1, v1 에서 v0 쪽으로 a)
  function onFace(G, side, a0, a1, z0, z1, col, ink){
    const pts = side === 'L' ? [[G.u0 + a0, G.v1, z0], [G.u0 + a1, G.v1, z0], [G.u0 + a1, G.v1, z1], [G.u0 + a0, G.v1, z1]]
                             : [[G.u1, G.v1 - a0, z0], [G.u1, G.v1 - a1, z0], [G.u1, G.v1 - a1, z1], [G.u1, G.v1 - a0, z1]];
    poly3(pts, col, ink);
  }
  const faceAt = (G, side, a, z) => side === 'L' ? q(G.u0 + a, G.v1, z) : q(G.u1, G.v1 - a, z);
  // 통나무 벽 — 면을 따라 둥근 통나무 줄, 모서리에 통나무 끝 동그라미
  function logWalls(E, G, col){
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, col), { top: false });
    const dk = tone(E, shade(col, -0.3)), hi = tone(E, shade(col, 0.22));
    for (let z = 3.5; z < G.H; z += 3.5){
      line(q(G.u0, G.v1, z), q(G.u1, G.v1, z), dk, 0.6); line(q(G.u0, G.v1, z + 1.1), q(G.u1, G.v1, z + 1.1), hi, 0.4);
      line(q(G.u1, G.v1, z), q(G.u1, G.v0, z), dk, 0.6);
      const e = q(G.u1, G.v1, z - 1.75); oval(e[0], e[1], 1.9, 1.6, tone(E, '#d8b088')); oval(e[0], e[1], 0.8, 0.7, tone(E, '#a87850'));
    }
  }
  // 창 — 흰 틀, 십자 살, 아래턱에 눈. 밤이면 따뜻한 불빛과 빛 번짐
  function win(E, G, side, a, w, z, h){
    const Lk = look(E);
    onFace(G, side, a - 0.05, a + w + 0.05, z - 1.2, z + h + 1.2, tone(E, '#f2ece0'), true);
    onFace(G, side, a, a + w, z, z + h, E.night ? Lk.win : '#6f9ec4');
    if (!E.night) onFace(G, side, a + w * 0.08, a + w * 0.35, z + h * 0.55, z + h * 0.9, 'rgba(255,255,255,.55)');
    onFace(G, side, a + w / 2 - 0.02, a + w / 2 + 0.02, z, z + h, tone(E, '#f2ece0'));
    onFace(G, side, a, a + w, z + h / 2 - 0.5, z + h / 2 + 0.5, tone(E, '#f2ece0'));
    onFace(G, side, a - 0.08, a + w + 0.08, z - 2.6, z - 1, Lk.drift[0]);
    if (E.night){ const c = faceAt(G, side, a + w / 2, z + h / 2); E.lamp(c[0], c[1], 22, '#ffcf7a'); }
  }
  function door(E, G, side, a, w, h, col){
    onFace(G, side, a - 0.05, a + w + 0.05, 0, h + 1.2, tone(E, '#3e2c24'), true);
    onFace(G, side, a, a + w, 0, h, tone(E, col));
    for (let k = 1; k < 3; k++) onFace(G, side, a + w * k / 3 - 0.01, a + w * k / 3 + 0.01, 0, h, tone(E, shade(col, -0.25)));
    const k = faceAt(G, side, a + w * 0.8, h * 0.45); oval(k[0], k[1], 0.9, 0.9, '#e8c070');
  }
  // 박공지붕 + 눈. ridge 'u' = 용마루가 u 를 따라(앞으로 비탈, 오른쪽에 박공) · 'v' = v 를 따라(오른쪽으로 비탈, 앞에 박공)
  function roof(E, G, o){
    const Lk = look(E), e = o.eave || 0.25, H = G.H, Hr = H + o.rise, col = tone(E, o.col), gable = tone(E, o.gable || o.col);
    const snowOn = o.snow !== false;
    if (o.ridge === 'u'){
      const vm = (G.v0 + G.v1) / 2;
      poly3([[G.u0 - e, G.v0 - e, H - 1], [G.u1 + e, G.v0 - e, H - 1], [G.u1 + e, vm, Hr], [G.u0 - e, vm, Hr]], shade(col, -0.35), true);
      poly3([[G.u1, G.v0, H], [G.u1, G.v1, H], [G.u1, vm, Hr]], gable, true);
      if (o.mid) o.mid(vm);
      const F = [[G.u0 - e, vm, Hr], [G.u1 + e, vm, Hr], [G.u1 + e, G.v1 + e, H - 1], [G.u0 - e, G.v1 + e, H - 1]];
      const a = q(G.u0 - e, vm, Hr), b = q(G.u0 - e, G.v1 + e, H - 1);
      poly3(F, vgrad(a[1], b[1], [shade(col, 0.1), shade(col, -0.12)]), true);
      if (snowOn){
        // 눈 — 용마루부터 처마 위까지 두툼하게, 처마 끝은 둥글게 넘친다
        const n = 14, top = [], bot = [];
        for (let i = 0; i <= n; i++){ const u = G.u0 - e + (G.u1 - G.u0 + 2 * e) * i / n; top.push(q(u, vm, Hr + 1.4)); const sag = 0.06 + 0.05 * Math.sin(i * 1.9 + G.u0); bot.push(q(u, G.v1 + e - sag, H + 0.2 - 1.2 * Math.sin(i * 2.3))); }
        path(top.concat(bot.reverse())); g.fillStyle = vgrad(top[0][1], bot[0][1] + 2, [Lk.drift[0], shade(Lk.drift[0], -0.06)]); g.fill(); g.strokeStyle = 'rgba(60,80,130,.35)'; g.lineWidth = 0.5; g.stroke();
        for (let i = 0; i < 9; i++){ const u = G.u0 - e + (G.u1 - G.u0 + 2 * e) * (i + 0.5) / 9, p = q(u, G.v1 + e, H - 0.5); poly([[p[0] - 0.9, p[1]], [p[0] + 0.9, p[1]], [p[0], p[1] + 2 + hash(i * 7 + G.u0 * 3) * 4]], 'rgba(210,235,255,.85)'); }
        const g0 = q(G.u1 + e, vm, Hr + 1.2), g1 = q(G.u1 + e, G.v1 + e, H - 0.5), g2 = q(G.u1 + e, G.v0 - e, H - 0.5);
        g.strokeStyle = Lk.drift[0]; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(g2[0], g2[1]); g.lineTo(g0[0], g0[1]); g.lineTo(g1[0], g1[1]); g.stroke();
      }
    } else {
      const um = (G.u0 + G.u1) / 2;
      poly3([[um, G.v0 - e, Hr], [um, G.v1 + e, Hr], [G.u0 - e, G.v1 + e, H - 1], [G.u0 - e, G.v0 - e, H - 1]], shade(col, -0.1), true);
      poly3([[G.u0, G.v1, H], [G.u1, G.v1, H], [um, G.v1, Hr]], gable, true);
      if (o.mid) o.mid(um);
      const F = [[um, G.v0 - e, Hr], [um, G.v1 + e, Hr], [G.u1 + e, G.v1 + e, H - 1], [G.u1 + e, G.v0 - e, H - 1]];
      const a = q(um, G.v0 - e, Hr), b = q(G.u1 + e, G.v0 - e, H - 1);
      poly3(F, lin(a[0], a[1], b[0], b[1], [shade(col, -0.18), shade(col, -0.34)]), true);
      if (snowOn){
        const n = 12, top = [], bot = [];
        for (let i = 0; i <= n; i++){ const v = G.v0 - e + (G.v1 - G.v0 + 2 * e) * i / n; top.push(q(um, v, Hr + 1.4)); bot.push(q(G.u1 + e - 0.08 - 0.05 * Math.sin(i * 1.7), v, H + 0.2 - 1.2 * Math.sin(i * 2.1))); }
        path(top.concat(bot.reverse())); g.fillStyle = shade(Lk.drift[0], -0.1); g.fill(); g.strokeStyle = 'rgba(60,80,130,.35)'; g.lineWidth = 0.5; g.stroke();
        const s0 = q(G.u0 - e, G.v1 + e, H - 0.5), s1 = q(um, G.v1 + e, Hr + 1.2), s2 = q(G.u1 + e, G.v1 + e, H - 0.5);
        g.strokeStyle = Lk.drift[0]; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.lineTo(s2[0], s2[1]); g.stroke();
        for (let i = 0; i < 7; i++){ const v = G.v0 - e + (G.v1 - G.v0 + 2 * e) * (i + 0.5) / 7, p = q(G.u1 + e, v, H - 0.5); poly([[p[0] - 0.9, p[1]], [p[0] + 0.9, p[1]], [p[0], p[1] + 2 + hash(i * 5 + G.v0 * 3) * 4]], 'rgba(210,235,255,.85)'); }
      }
    }
  }
  // 바닥 그림자 — 발밑 타원(칸 단위)
  function foot(E, u, v, ru, rv){ const c = q(u, v, 0), r = q(u + ru, v, 0), d = q(u, v + rv, 0); g.save(); g.translate(c[0] + 1.5, c[1] + 1); g.beginPath(); g.ellipse(0, 0, Math.hypot(r[0] - c[0], r[1] - c[1]) * 1.1 + 2, Math.abs(d[1] - c[1]) + 2, 0, 0, TAU); g.fillStyle = look(E).shadow; g.fill(); g.restore(); }
  function footBox(E, G){ poly3([[G.u0 + 0.1, G.v0 + 0.15, 0], [G.u1 + 0.32, G.v0 + 0.15, 0], [G.u1 + 0.32, G.v1 + 0.3, 0], [G.u0 + 0.1, G.v1 + 0.3, 0]], look(E).shadow); }
  const geo = (b, ins, H) => ({ u0: b.x + ins, v0: b.y + ins, u1: b.x + b.w - ins, v1: b.y + b.h - ins, H });
  // 기둥 하나(둥근 막대)
  function post(E, u, v, z0, z1, col, r){ const a = q(u, v, z0), b = q(u, v, z1); r = r || 1.1; R(a[0] - r, b[1], r * 2, a[1] - b[1], tone(E, col)); R(a[0] - r, b[1], r * 0.7, a[1] - b[1], tone(E, shade(col, 0.25))); g.strokeStyle = INK; g.lineWidth = 0.5; g.strokeRect(a[0] - r, b[1], r * 2, a[1] - b[1]); }
  // 눈 덮인 둥근 뭉치(눈더미)
  function lump(x, y, w, h, c0, c1){ oval(x, y, w, h, c1); oval(x - w * 0.12, y - h * 0.18, w * 0.86, h * 0.8, c0); oval(x - w * 0.35, y - h * 0.45, w * 0.35, h * 0.22, 'rgba(255,255,255,.5)'); }

  // ================= 배경 =================
  const horizon = E => E.top + 34;
  // 오로라 — 세로 빛 띠를 물결 따라 촘촘히 세운다. 띠 하나는 한 번 구운 그러데이션 막대를 늘여 붙여 매 장 값이 싸다
  const curtainMemo = {};
  function curtain(col){
    if (curtainMemo[col]) return curtainMemo[col];
    const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(' + col + ',0)'); gr.addColorStop(0.55, 'rgba(' + col + ',.28)'); gr.addColorStop(0.9, 'rgba(' + col + ',.85)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 4, 128); return (curtainMemo[col] = c);
  }
  const RIBBONS = [
    { col: '120,255,190', y: 0.58, amp: 16, f: 0.0068, sp: 0.16, tall: 70, sd: 1.2 },
    { col: '90,220,255', y: 0.42, amp: 12, f: 0.009, sp: -0.11, tall: 56, sd: 3.7 },
    { col: '200,130,255', y: 0.27, amp: 10, f: 0.0055, sp: 0.08, tall: 46, sd: 6.1 },
  ];
  function aurora(E, a, refl){
    const hy = horizon(E), t = E.t;
    g.save(); g.globalCompositeOperation = 'lighter';
    RIBBONS.forEach(rb => {
      const im = curtain(rb.col);
      for (let x = -2; x < E.w + 2; x += 2){
        const base = hy * rb.y + rb.amp * Math.sin(x * rb.f + t * rb.sp + rb.sd) + rb.amp * 0.4 * Math.sin(x * rb.f * 2.6 - t * rb.sp * 1.7);
        const k = 0.5 + 0.5 * Math.sin(x * 0.018 + t * 0.6 + rb.sd) * Math.sin(x * 0.006 - t * 0.23);
        if (k < 0.08) continue;
        const tall = rb.tall * (0.7 + 0.5 * k);
        g.globalAlpha = a * k;
        if (!refl) g.drawImage(im, x, base - tall, 2.3, tall);
        else { g.save(); g.translate(0, hy + (hy - base) * 0.3); g.scale(1, -0.3); g.drawImage(im, x, -tall, 2.3, tall); g.restore(); }
      }
    });
    g.restore();
  }
  // 먼 산 — 봉우리는 |sin| 을 뒤집어 뾰족하게, 높은 봉우리일수록 눈이 깊다
  const peak = x => 1 - Math.abs(Math.sin(x));
  const ridgeY = (x, base, amp, f, sd) => base - amp * (0.15 + 0.55 * Math.pow(peak(x * f + sd), 1.6) + 0.3 * Math.pow(peak(x * f * 2.7 + sd * 1.7), 2) + 0.06 * Math.sin(x * f * 9 + sd));
  function ridge(E, base, amp, f, sd, fill, cap){
    g.beginPath(); g.moveTo(0, base + 4); for (let x = 0; x <= E.w + 3; x += 2) g.lineTo(x, ridgeY(x, base, amp, f, sd)); g.lineTo(E.w, base + 4); g.closePath(); g.fillStyle = fill; g.fill();
    g.save(); g.clip(); g.fillStyle = cap; g.beginPath();
    for (let x = 0; x <= E.w + 3; x += 2){ const y = ridgeY(x, base, amp, f, sd); g.lineTo(x, y + Math.max(0, base - amp * 0.4 - y) * (0.42 + 0.12 * Math.sin(x * 0.2 + sd))); }
    for (let x = E.w + 3; x >= 0; x -= 2) g.lineTo(x, ridgeY(x, base, amp, f, sd) - 3);
    g.closePath(); g.fill(); g.restore();
  }
  function backdrop(gg, E){
    g = gg; P3 = (u, v, z) => E.P(u, v, z);
    const L = look(E), hy = horizon(E), t = E.t;
    R(0, 0, E.w, hy + 2, vgrad(0, hy, L.sky));
    if (L.star) for (let i = 0; i < 110; i++){
      const x = hash(i * 7 + 1) * E.w, y = hash(i * 11 + 3) * hy * 0.92, a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + hash(i) * 1.2) + i)), s = hash(i * 5) < 0.12 ? 1.1 : 0.7;
      R(x, y, s, s, 'rgba(235,245,255,' + a.toFixed(2) + ')');
      if (i % 13 === 0){ R(x - 1.6, y + s / 2 - 0.15, 3.2 + s, 0.3, 'rgba(235,245,255,' + (a * 0.5).toFixed(2) + ')'); R(x + s / 2 - 0.15, y - 1.6, 0.3, 3.2 + s, 'rgba(235,245,255,' + (a * 0.5).toFixed(2) + ')'); }
    }
    if (L.moon){ const x = E.w * 0.86, y = hy * 0.24; glow(x, y, 34, 'rgba(210,230,255,', 0.35); oval(x, y, 7.5, 7.5, '#eef3ff'); oval(x + 2.6, y - 1.5, 6.6, 7, L.sky[0]); }
    else { const x = E.w * 0.16, y = hy * 0.55; glow(x, y, 56, 'rgba(255,246,220,', 0.6); oval(x, y, 8, 8, '#fffaf0'); }
    aurora(E, L.aurora, false);
    ridge(E, hy - 3, 74, 0.011, 1.3, L.far, L.snowcap);
    ridge(E, hy + 1, 40, 0.02, 4.2, L.far2, L.snowcap);
    R(0, hy - 30, E.w, 33, vgrad(hy - 30, hy + 3, [L.haze + '0)', L.haze + '.45)']));
    // 얼음 바다 — 섬 아래 끝까지. 유빙과 오로라 비침
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea));
    if (L.aurora > 0.5) aurora(E, 0.35, true);
    R(0, hy, E.w, 0.7, L.glow ? 'rgba(160,230,220,.35)' : 'rgba(255,255,255,.7)');
    for (let i = 0; i < 40; i++){
      const yy = hy + 4 + Math.pow(hash(i * 3 + 7), 1.6) * (E.h - hy), s = 0.4 + (yy - hy) / (E.h - hy) * 1.2;
      const x = hash(i * 13 + 2) * E.w + Math.sin(t * 0.2 + i) * 1.2, w = (8 + hash(i) * 18) * s, h = w * 0.32;
      const F = d => [[x - w * 0.5, yy + d], [x - w * 0.2, yy - h * 0.5 + d], [x + w * 0.35, yy - h * 0.4 + d], [x + w * 0.5, yy + h * 0.05 + d], [x + w * 0.1, yy + h * 0.5 + d], [x - w * 0.35, yy + h * 0.35 + d]];
      poly(F(0), L.floe[1]); poly(F(-1.2 * s), L.floe[0]);
    }
  }

  // ================= 섬 =================
  function cliff(E){
    const L = look(E), D = E.cliff, lc = q(0, E.rows, 0), bc = q(E.cols, E.rows, 0), rc = q(E.cols, 0, 0);
    const face = (a, b, sh, seed) => {
      for (let i = 0; i < 4; i++){ const d0 = D * i / 4, d1 = D * (i + 1) / 4 + 0.6; poly([[a[0], a[1] + d0], [b[0], b[1] + d0], [b[0], b[1] + d1], [a[0], a[1] + d1]], L.cliff[i]); }
      poly([[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + D], [a[0], a[1] + D]], 'rgba(0,0,0,' + sh + ')');
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 0.7; g.beginPath();
      for (let i = 0; i < 46; i++){ const f = hash(i * 9 + seed), x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 10 + hash(i * 5 + seed) * (D - 18); g.moveTo(x, y); g.lineTo(x + 5, y + 3); }
      g.stroke();
      g.fillStyle = L.cliff[3]; g.beginPath(); g.moveTo(a[0], a[1] + D);
      const n = 24; for (let i = 0; i <= n; i++){ const f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + D; g.lineTo(x, y + (i % 2 ? 4 : 10 + hash(i * 7 + seed) * 16)); }
      g.lineTo(b[0], b[1] + D); g.closePath(); g.fill();
    };
    face(lc, bc, 0, 0); face(bc, rc, 0.18, 3);
    const eave = (a, b, seed) => {
      g.fillStyle = L.drift[0]; g.beginPath(); g.moveTo(a[0], a[1] - 1.2);
      const n = 34; for (let i = 0; i <= n; i++){ const f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f; g.lineTo(x, y + 4 + Math.sin(i * 1.7 + seed) * 1.5 + hash(i * 3 + seed) * 2); }
      g.lineTo(b[0], b[1] - 1.2); g.closePath(); g.fill();
      g.fillStyle = L.glow ? 'rgba(190,230,255,.75)' : 'rgba(220,240,255,.9)';
      for (let i = 0; i < 30; i++){ const f = (i + hash(i * 11 + seed)) / 30, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 5, l = 4 + hash(i * 17 + seed) * 9; poly([[x - 1.1, y], [x + 1.1, y], [x, y + l]]); g.fill(); }
    };
    eave(lc, bc, 0); eave(bc, rc, 5);
  }
  function diamond(p2, u, v, a){ a = 0.5 - (a || 0); let p = q(u + 0.5 - a, v + 0.5 - a); p2.moveTo(p[0], p[1]); p = q(u + 0.5 + a, v + 0.5 - a); p2.lineTo(p[0], p[1]); p = q(u + 0.5 + a, v + 0.5 + a); p2.lineTo(p[0], p[1]); p = q(u + 0.5 - a, v + 0.5 + a); p2.lineTo(p[0], p[1]); p2.closePath(); }
  // 길(돌 마름모)을 칸 묶음(Set 'x,y')으로 깐다 — 섬 길과 꽃길이 같이 쓴다
  function stones(E, cells){
    const L = look(E), bed = new Path2D(), st = L.stone.map(() => new Path2D()), hi = new Path2D(), lo = new Path2D(), dust = new Path2D();
    cells.forEach(k => {
      const [u, v] = k.split(',').map(Number);
      diamond(bed, u, v, -0.05); diamond(st[Math.floor(h2(u * 5 + 3, v + 40) * 4)], u, v, 0.06);
      const a = 0.44, l = q(u + 0.5 - a, v + 0.5 + a), tp = q(u + 0.5 - a, v + 0.5 - a), r = q(u + 0.5 + a, v + 0.5 - a), b = q(u + 0.5 + a, v + 0.5 + a);
      hi.moveTo(l[0], l[1]); hi.lineTo(tp[0], tp[1]); hi.lineTo(r[0], r[1]); lo.moveTo(r[0], r[1]); lo.lineTo(b[0], b[1]); lo.lineTo(l[0], l[1]);
      if (h2(u, v + 77) < 0.4){ const m = q(u + 0.3 + h2(u, v) * 0.4, v + 0.5); dust.moveTo(m[0] + 4.5, m[1]); dust.ellipse(m[0], m[1], 4.5, 1.6, 0, 0, TAU); }
    });
    g.fillStyle = L.glow ? 'rgba(30,40,70,.45)' : 'rgba(110,120,140,.45)'; g.fill(bed);
    st.forEach((p, i) => { g.fillStyle = L.stone[i]; g.fill(p); });
    g.lineWidth = 0.7; g.strokeStyle = 'rgba(255,255,255,.5)'; g.stroke(hi); g.strokeStyle = 'rgba(30,40,70,.35)'; g.stroke(lo);
    g.fillStyle = L.drift[0]; g.globalAlpha = 0.75; g.fill(dust); g.globalAlpha = 1;
  }
  // 섬 — 절벽 · 눈 땅 · 길. paths = Set('x,y'), busy(u, v) = 밭·건물 자리라 눈더미·풀을 놓지 않을 칸
  function island(gg, E, paths, busy){
    g = gg; P3 = (u, v, z) => E.P(u, v, z);
    const L = look(E), C = E.cols, Rw = E.rows, tc = q(0, 0, 0), rc = q(C, 0, 0), bc = q(C, Rw, 0), lc = q(0, Rw, 0);
    cliff(E);
    g.save(); poly([tc, rc, bc, lc]); g.clip();
    R(lc[0], tc[1], rc[0] - lc[0], bc[1] - tc[1], vgrad(tc[1], bc[1], L.snow));
    const lite = new Path2D(), dark = new Path2D(), tufts = new Path2D();
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){
      if (paths.has(u + ',' + v)) continue;
      const h = h2(u, v);
      if (h < 0.28) diamond(lite, u, v, 0.03); else if (h > 0.74) diamond(dark, u, v, 0.03);
      const d = h2(u * 3 + 1, v * 7 + 2);
      if (d < 0.12 && !busy(u, v)){ const p = q(u + 0.3 + h2(u, v + 3) * 0.4, v + 0.3 + h2(u + 3, v) * 0.4); for (let k = -2; k <= 2; k++){ tufts.moveTo(p[0] + k, p[1]); tufts.lineTo(p[0] + k * 2, p[1] - 4 - (2 - Math.abs(k)) * 1.6); } }
    }
    g.fillStyle = L.snowHi; g.fill(lite); g.fillStyle = L.snowLo; g.fill(dark);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.45; g.stroke(lite);
    g.strokeStyle = L.glow ? 'rgba(120,110,90,.7)' : 'rgba(150,130,90,.8)'; g.lineWidth = 0.7; g.lineCap = 'round'; g.stroke(tufts);
    stones(E, paths);
    for (let i = 0; i < 60; i++){
      const u = hash(i * 31 + 5) * C, v = hash(i * 17 + 9) * Rw, fu = Math.floor(u), fv = Math.floor(v);
      if (paths.has(fu + ',' + fv) || busy(fu, fv) || busy(fu, fv - 1) || busy(fu - 1, fv)) continue;
      const p = q(u, v, 0), w = 8 + hash(i) * 14;
      oval(p[0] + 1.2, p[1] + 1.2, w, w * 0.34, L.snowLo); oval(p[0], p[1], w, w * 0.36, L.drift[0]); oval(p[0] - w * 0.25, p[1] - w * 0.12, w * 0.5, w * 0.14, 'rgba(255,255,255,.55)');
    }
    if (L.glow){ g.strokeStyle = 'rgba(140,255,210,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(lc[0], lc[1]); g.lineTo(tc[0], tc[1]); g.lineTo(rc[0], rc[1]); g.stroke(); }
    g.restore();
  }
  // 반짝이는 눈 알갱이 — 매 장(섬 겹 위에)
  function sparkle(gg, E){
    g = gg; P3 = (u, v, z) => E.P(u, v, z);
    for (let i = 0; i < 70; i++){ const p = q(hash(i * 7 + 2) * E.cols, hash(i * 3 + 8) * E.rows, 0), a = Math.max(0, Math.sin(E.t * (1 + hash(i) * 2) + i * 2.3)); if (a < 0.6) continue; R(p[0] - 0.5, p[1] - 0.5, 1, 1, 'rgba(255,255,255,' + ((a - 0.6) * 2.4).toFixed(2) + ')'); }
  }

  // ================= 나무·바위 =================
  // 전나무 — 층마다 그늘 반쪽 + 위에 눈. s = 1 이면 키 57도트
  function fir(E, x, y, s, sd){
    const L = look(E); s *= 0.62;
    oval(x + 3 * s, y + 1, 18 * s, 6 * s, L.shadow);
    R(x - 3 * s, y - 12 * s, 6 * s, 13 * s, L.trunk[1]);
    for (let i = 0; i < 4; i++){
      const yb = y - 10 * s - i * 19 * s, w = (30 - i * 6.5) * s, ht = 34 * s, yt = yb - ht;
      const body = [[x, yt], [x + w, yb], [x + w * 0.3, yb + 3 * s], [x - w * 0.4, yb + 2 * s], [x - w, yb]];
      poly(body, L.fir[0]); poly([[x, yt], [x + w, yb], [x + w * 0.3, yb + 3 * s], [x + w * 0.1, yb]], L.fir[2]); poly(body, null, true);
      const sy = yt + ht * 0.55;
      g.fillStyle = L.firSnow[0]; g.beginPath(); g.moveTo(x, yt + 0.6);
      g.lineTo(x + w * 0.55, sy); for (let k = 4; k >= -4; k--) g.lineTo(x + w * 0.55 * k / 4, sy + (k % 2 ? 4 : -1) * s + hash(sd * 13 + i * 7 + k) * 3 * s);
      g.closePath(); g.fill();
      g.fillStyle = L.firSnow[1]; g.beginPath(); g.moveTo(x + 0.6, yt + 1.2); g.lineTo(x + w * 0.55, sy); g.lineTo(x + w * 0.2, sy + 2 * s); g.closePath(); g.fill();
    }
    oval(x, y - 88 * s, 4 * s, 3 * s, L.firSnow[0]);
  }
  // 서리 나무 — 둥근 잎 뭉치(라이프퀘스트 둥근 나무)에 서리 빛깔
  function frostTree(E, x, y, s){
    const L = look(E); s *= 0.62;
    oval(x + 4 * s, y + 1, 20 * s, 7 * s, L.shadow);
    poly([[x - 3 * s, y], [x + 3 * s, y], [x + 2 * s, y - 34 * s], [x - 2 * s, y - 34 * s]], L.trunk[0]);
    g.strokeStyle = L.trunk[0]; g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(x, y - 24 * s); g.lineTo(x + 9 * s, y - 34 * s); g.stroke();
    const Bs = [[-12, -44, 15], [10, -46, 14], [0, -58, 16], [-4, -40, 13], [12, -36, 11]];
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s + 0.9, b[2] * s + 0.9, INK));
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s, L.frost[1]));
    Bs.forEach(b => oval(x + (b[0] - 3) * s, y + (b[1] - 3) * s, b[2] * s * 0.72, b[2] * s * 0.68, L.frost[0]));
    Bs.forEach(b => oval(x + (b[0] - 6) * s, y + (b[1] - 7) * s, b[2] * s * 0.32, b[2] * s * 0.22, L.frost[2]));
  }
  function stump(E, x, y){
    const L = look(E), s = 0.62;
    oval(x + 2, y + 1, 12 * s, 4 * s, L.shadow);
    poly([[x - 7 * s, y], [x + 7 * s, y], [x + 6 * s, y - 9 * s], [x - 6 * s, y - 9 * s]], L.trunk[0], true);
    oval(x, y - 9 * s, 6 * s, 2.6 * s, tone(E, '#d8b088')); oval(x, y - 9 * s, 3 * s, 1.2 * s, tone(E, '#b88a5c'));
    oval(x - 1, y - 11 * s, 5 * s, 1.8 * s, L.drift[0]);
  }
  // 바위 — 둥근 화강암 덩이에 눈모자. small 이면 깬 뒤 부스러기
  function rock(E, x, y, s, small){
    const L = look(E), c = tone(E, '#8c93a3'); s = (s || 1) * (small ? 0.45 : 1);
    oval(x + 2, y + 1, 15 * s, 5 * s, L.shadow);
    const pts = [[x - 14 * s, y], [x - 12 * s, y - 9 * s], [x - 5 * s, y - 15 * s], [x + 6 * s, y - 14 * s], [x + 13 * s, y - 6 * s], [x + 14 * s, y]];
    poly(pts, vgrad(y - 15 * s, y, [shade(c, 0.12), shade(c, -0.25)]), true);
    poly([[x + 1 * s, y - 14.5 * s], [x + 6 * s, y - 14 * s], [x + 13 * s, y - 6 * s], [x + 14 * s, y], [x + 4 * s, y]], 'rgba(0,0,30,.18)');
    if (!small){ poly([[x - 12 * s, y - 8 * s], [x - 5 * s, y - 15.5 * s], [x + 6 * s, y - 14.5 * s], [x + 11 * s, y - 8 * s], [x + 4 * s, y - 10 * s], [x - 3 * s, y - 9 * s]], L.drift[0]); line([x - 2 * s, y - 5 * s], [x + 3 * s, y - 2 * s], 'rgba(0,0,30,.3)', 0.5); }
  }
  // 덤불 — 눈 덮인 둥근 덤불, 열매(빨간 월귤)
  function bush(E, x, y, ready, sd){
    const L = look(E), Bs = [[-6, -6, 8], [5, -7, 8], [0, -11, 8]];
    oval(x + 2, y + 1, 14, 4.5, L.shadow);
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2] + 0.8, b[2] * 0.85 + 0.8, INK));
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.85, L.fir[1]));
    [[-6, -8, 6], [4, -9, 6], [0, -14, 6]].forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.5, L.firSnow[0]));
    if (ready) for (let i = 0; i < 7; i++){ const bx = x - 9 + hash(sd * 7 + i) * 18, by = y - 3 - hash(sd * 3 + i) * 8; oval(bx, by, 1.4, 1.4, E.night ? '#b8304a' : '#e8344a'); oval(bx - 0.4, by - 0.4, 0.5, 0.5, 'rgba(255,255,255,.7)'); }
  }
  // 눈더미(겨울 채집) — 눈덩이 셋
  function snowpile(E, x, y, ready){
    const L = look(E);
    oval(x + 2, y + 1, 13, 4, L.shadow);
    if (!ready){ oval(x, y - 1, 9, 3, L.drift[0]); return; }
    lump(x - 4, y - 3, 8, 5, L.drift[0], L.drift[1]); lump(x + 5, y - 2, 6, 4, L.drift[0], L.drift[1]); lump(x, y - 8, 6, 5, L.drift[0], L.drift[1]);
  }
  // 채집 자리·풍경 — kind: tree(전나무/서리 나무는 seed 로) · rock · bush · snow
  function node(gg, E, kind, u, v, ready, seed){
    g = gg; P3 = (uu, vv, z) => E.P(uu, vv, z);
    const p = q(u + 0.5, v + 0.6, 0);
    if (kind === 'tree'){ if (!ready) return stump(E, p[0], p[1]); return hash(seed * 7 + 1) < 0.65 ? fir(E, p[0], p[1], 0.95 + hash(seed) * 0.25, seed) : frostTree(E, p[0], p[1], 0.85 + hash(seed) * 0.2); }
    if (kind === 'rock') return rock(E, p[0], p[1], 0.85, !ready);
    if (kind === 'snow') return snowpile(E, p[0], p[1], ready);
    return bush(E, p[0], p[1], ready, seed);
  }

  // ================= 건물 =================
  const WOOD = '#8a5a3c', LOG = '#9a6a44', FALU = '#a3352b', TRIM = '#f2ece0', ROOF = '#4a3a3c';
  const B = {};
  // 집 — 통나무 오두막: 돌 기단, 앞에 창 둘과 문, 박공에 다락창, 돌 굴뚝, 문 위 등
  B.house = (E, b, night) => {
    const G = geo(b, 0.2, 30), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0;
    footBox(E, G);
    box(G.u0 - 0.05, G.v0 - 0.05, G.u1 + 0.05, G.v1 + 0.05, 0, 5, tone(E, '#7d8494'));
    for (let a = 0.1; a < lenL; a += 0.35) line(q(G.u0 + a, G.v1 + 0.05, 0.5), q(G.u0 + a + 0.05, G.v1 + 0.05, 4.5), 'rgba(0,0,30,.25)', 0.5);
    g.save(); g.translate(0, -5);
    logWalls(E, G, LOG);
    win(E, G, 'L', 0.35, 0.7, 9, 11); win(E, G, 'L', lenL - 1.05, 0.7, 9, 11); win(E, G, 'R', lenR / 2 - 0.35, 0.7, 9, 11);
    door(E, G, 'L', lenL / 2 - 0.3, 0.6, 18, '#6a4430');
    const cu = G.u0 + 0.6, cv = G.v0 + 0.5;
    roof(E, G, { ridge: 'u', rise: 22, col: ROOF, gable: LOG, eave: 0.3, mid: () => {
      win(E, G, 'R', lenR / 2 - 0.22, 0.44, G.H + 3, 7);
      box(cu - 0.25, cv - 0.25, cu + 0.25, cv + 0.25, G.H + 6, G.H + 34, tone(E, '#7d8494'));
      const top = q(cu, cv, G.H + 34); oval(top[0], top[1] - 0.5, 6, 2.2, look(E).drift[0]);
      E.chimney(top[0], top[1] - 6);
    } });
    const lp = faceAt(G, 'L', lenL / 2 + 0.42, 19);
    oval(lp[0], lp[1] + 2, 1.8, 2.2, night ? '#ffe7a4' : '#e9eef6'); if (night) E.lamp(lp[0], lp[1] + 2, 30, '#ffcf7a');
    g.restore();
  };
  // 가게 — 나무 노점: 빨강·흰 줄무늬 차양, 뒤 선반, 앞 계산대. part 'back' | 'front' (사이에 가게 아저씨가 선다)
  B.stall = (E, b, night, part) => {
    const G = geo(b, 0.15, 0), u0 = G.u0, u1 = G.u1, v0 = G.v0, v1 = G.v1;
    if (part !== 'front'){
      footBox(E, G);
      box(u0, v0, u1, v0 + 0.25, 0, 30, tone(E, WOOD), { top: false });
      for (let z = 10; z < 28; z += 9) box(u0 + 0.05, v0 + 0.25, u1 - 0.05, v0 + 0.55, z, z + 1.5, tone(E, '#6a4430'));
      ['#e8a040', '#d9533e', '#f2d06a', '#8fbf6a', '#e8a040'].forEach((c, i) => {
        const p = q(u0 + 0.3 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 11.5); oval(p[0], p[1] - 1.5, 2, 1.8, tone(E, c));
        const p2 = q(u0 + 0.45 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 20.5); oval(p2[0], p2[1] - 1.5, 2, 1.8, tone(E, ['#c86a8a', '#f2d06a', '#6a9ad0', '#e8a040', '#d9533e'][i]));
      });
      post(E, u0 + 0.05, v0 + 0.1, 0, 60, WOOD); post(E, u1 - 0.05, v0 + 0.1, 0, 60, WOOD);
      return;
    }
    post(E, u0 + 0.05, v1 - 0.1, 0, 54, WOOD); post(E, u1 - 0.05, v1 - 0.1, 0, 54, WOOD);
    box(u0 + 0.1, v1 - 0.55, u1 - 0.1, v1 - 0.1, 0, 12, tone(E, '#b07a50'));
    for (let a = 0.2; a < u1 - u0 - 0.2; a += 0.25) line(q(u0 + 0.1 + a, v1 - 0.1, 0.5), q(u0 + 0.1 + a, v1 - 0.1, 11.5), 'rgba(60,30,10,.35)', 0.4);
    [[0.35, '#e8a040'], [0.95, '#d9533e'], [1.55, '#8fbf6a']].forEach(([a, c]) => {
      if (u0 + a > u1 - 0.3) return;
      box(u0 + a, v1 - 0.5, u0 + a + 0.4, v1 - 0.2, 12, 15, tone(E, '#8a5a3c'));
      const p = q(u0 + a + 0.2, v1 - 0.35, 15.5); for (let k = -1; k <= 1; k++) oval(p[0] + k * 2.2, p[1] - 0.6, 1.4, 1.2, tone(E, c));
    });
    // 차양 — 앞으로 기운 줄무늬 천, 끝은 물결. 아저씨(키 54)가 안에 서도 머리가 안 가리게 높이 단다(2026-10-09)
    const n = 8, zt = 62, zb = 55, va = v0 - 0.05, vb = v1 + 0.3;
    for (let i = 0; i < n; i++){
      const a0 = u0 - 0.15 + (u1 - u0 + 0.3) * i / n, a1 = u0 - 0.15 + (u1 - u0 + 0.3) * (i + 1) / n;
      poly3([[a0, va, zt], [a1, va, zt], [a1, vb, zb], [a0, vb, zb]], tone(E, i % 2 ? TRIM : '#d9433e'));
    }
    poly3([[u0 - 0.15, va, zt], [u1 + 0.15, va, zt], [u1 + 0.15, vb, zb], [u0 - 0.15, vb, zb]], null, true);
    for (let i = 0; i < n; i++){ const a = u0 - 0.15 + (u1 - u0 + 0.3) * (i + 0.5) / n, p = q(a, vb, zb); oval(p[0], p[1] + 0.8, 2.6, 2, tone(E, i % 2 ? TRIM : '#d9433e')); }
    poly3([[u0 - 0.1, va, zt + 1], [u1 + 0.1, va, zt + 1], [u1 + 0.1, va + (vb - va) * 0.6, zt - 2.4], [u0 - 0.1, va + (vb - va) * 0.6, zt - 2.4]], look(E).drift[0]);
    if (night){ const p = q((u0 + u1) / 2, vb, zb - 2); oval(p[0], p[1] + 3, 1.6, 2, '#ffe7a4'); E.lamp(p[0], p[1] + 3, 34, '#ffcf7a'); }
  };
  // 닭장 — 작은 팔루 빨강 집, 흰 테, 경사로
  B.coop = (E, b) => {
    const G = geo(b, 0.25, 18), lenL = G.u1 - G.u0;
    footBox(E, G);
    post(E, G.u0 + 0.05, G.v1 - 0.05, 0, 5, '#5a4034'); post(E, G.u1 - 0.05, G.v1 - 0.05, 0, 5, '#5a4034');
    g.save(); g.translate(0, -5);
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, FALU), { top: false });
    for (let a = 0.12; a < lenL; a += 0.16) line(q(G.u0 + a, G.v1, 0.3), q(G.u0 + a, G.v1, G.H - 0.3), 'rgba(40,0,0,.25)', 0.35);
    onFace(G, 'L', 0, 0.06, 0, G.H, tone(E, TRIM)); onFace(G, 'L', lenL - 0.06, lenL, 0, G.H, tone(E, TRIM));
    onFace(G, 'L', lenL / 2 - 0.2, lenL / 2 + 0.2, 0, 9, tone(E, '#3a2420'), true);
    win(E, G, 'R', 0.4, 0.4, 8, 6);
    roof(E, G, { ridge: 'u', rise: 12, col: ROOF, gable: FALU, eave: 0.18 });
    g.restore();
    poly3([[G.u0 + lenL / 2 - 0.18, G.v1 + 0.6, 0], [G.u0 + lenL / 2 + 0.18, G.v1 + 0.6, 0], [G.u0 + lenL / 2 + 0.18, G.v1, 5], [G.u0 + lenL / 2 - 0.18, G.v1, 5]], tone(E, '#b07a50'), true);
  };
  // 외양간 — 큰 팔루 빨강 헛간, 흰 X 문, 둥근 박공창, 지붕 꼭대기 풍향계
  B.barn = (E, b) => {
    const G = geo(b, 0.15, 30), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0;
    footBox(E, G);
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, FALU), { top: false });
    for (let a = 0.12; a < lenR; a += 0.18) line(q(G.u1, G.v1 - a, 0.3), q(G.u1, G.v1 - a, G.H - 0.3), 'rgba(40,0,0,.25)', 0.35);
    for (let a = 0.12; a < lenL; a += 0.18) line(q(G.u0 + a, G.v1, 0.3), q(G.u0 + a, G.v1, G.H - 0.3), 'rgba(40,0,0,.2)', 0.35);
    [0, lenL - 0.07].forEach(a => onFace(G, 'L', a, a + 0.07, 0, G.H, tone(E, TRIM)));
    const da = lenL / 2 - 0.5;
    onFace(G, 'L', da, da + 1, 0, 20, tone(E, FALU), true);
    [[da, da + 1, 0, 1.4], [da, da + 1, 18.6, 20], [da, da + 0.07, 0, 20], [da + 0.93, da + 1, 0, 20], [da + 0.47, da + 0.53, 0, 20]].forEach(r => onFace(G, 'L', r[0], r[1], r[2], r[3], tone(E, TRIM)));
    [[0.05, 0.48], [0.52, 0.95]].forEach(([a, c]) => { line(faceAt(G, 'L', da + a, 1), faceAt(G, 'L', da + c, 19), tone(E, TRIM), 1); line(faceAt(G, 'L', da + c, 1), faceAt(G, 'L', da + a, 19), tone(E, TRIM), 1); });
    win(E, G, 'R', 0.4, 0.55, 14, 9); win(E, G, 'R', lenR - 0.95, 0.55, 14, 9);
    const um = (G.u0 + G.u1) / 2;
    roof(E, G, { ridge: 'v', rise: 20, col: ROOF, gable: FALU, eave: 0.28, mid: () => {
      const c = q(um, G.v1, G.H + 9); oval(c[0], c[1], 4, 4, tone(E, TRIM)); oval(c[0], c[1], 3, 3, E.night ? look(E).win : '#3a2420');
    } });
    const t0 = q(um, (G.v0 + G.v1) / 2, G.H + 21); line(t0, [t0[0], t0[1] - 9], tone(E, '#3a3f52'), 0.7);
    poly([[t0[0] - 4, t0[1] - 8], [t0[0] + 3, t0[1] - 8], [t0[0] + 5, t0[1] - 6.5], [t0[0] + 3, t0[1] - 5], [t0[0] - 4, t0[1] - 5]], tone(E, '#3a3f52'));
  };
  // 온실 — 유리벽, 안에 초록 잎과 따뜻한 빛
  B.greenhouse = (E, b, night) => {
    const G = geo(b, 0.18, 22), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0;
    footBox(E, G);
    box(G.u0, G.v0, G.u1, G.v1, 0, 4, tone(E, '#7d8494'));
    g.save(); g.translate(0, -4);
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, '#cfe6ee', { top: false, left: night ? 'rgba(255,214,140,.55)' : 'rgba(190,226,240,.6)', right: night ? 'rgba(230,180,110,.5)' : 'rgba(150,196,220,.6)', ink: false });
    for (let a = 0.2; a < lenL; a += 0.45){ const p = q(G.u0 + a, G.v1 - 0.3, 2); oval(p[0], p[1] - 4, 4, 4, tone(E, '#4f9a5a')); oval(p[0] - 1, p[1] - 6, 2.4, 2, tone(E, '#7cc070')); if (hash(Math.round(a * 90)) > 0.5) oval(p[0] + 1.5, p[1] - 4, 1, 1, '#e8546a'); }
    for (let a = 0; a <= lenL + 0.01; a += lenL / 6) onFace(G, 'L', a - 0.025, a + 0.025, 0, G.H, tone(E, '#e8eef2'));
    for (let a = 0; a <= lenR + 0.01; a += lenR / 4) onFace(G, 'R', a - 0.025, a + 0.025, 0, G.H, tone(E, '#c8d2da'));
    onFace(G, 'L', 0, lenL, G.H / 2 - 0.4, G.H / 2 + 0.4, tone(E, '#e8eef2'));
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, '#000000', { top: false, left: 'rgba(0,0,0,0)', right: 'rgba(0,0,0,0)' });
    roof(E, G, { ridge: 'u', rise: 12, col: '#bcd8e6', gable: '#cfe6ee', eave: 0.08 });
    if (night){ const c = q((G.u0 + G.u1) / 2, G.v1, 10); E.lamp(c[0], c[1], 48, '#ffcf7a'); }
    g.restore();
  };
  // 반려동물 집 — 작은 개집, 둥근 문, 하트 팻말
  B.pethouse = (E, b) => {
    const G = geo(b, 0.18, 12);
    footBox(E, G);
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, '#c08a5c'), { top: false });
    const c = faceAt(G, 'L', (G.u1 - G.u0) / 2, 4.5); oval(c[0], c[1], 3, 4.5, tone(E, '#2a1c18')); R(c[0] - 3, c[1], 6, 4.5, tone(E, '#2a1c18'));
    roof(E, G, { ridge: 'u', rise: 8, col: FALU, gable: '#c08a5c', eave: 0.12 });
  };
  // 우물 — 돌 둥근 통, 나무 지붕, 도르래
  B.well = (E, b) => {
    const c = q(b.x + 0.5, b.y + 0.5, 0), L = look(E), top = c[1] - 9;
    oval(c[0] + 2, c[1] + 1, 13, 5, L.shadow);
    oval(c[0], c[1], 10, 4, tone(E, '#6c7282')); R(c[0] - 10, top, 20, 9, vgrad(top, c[1], [tone(E, '#9aa0ae'), tone(E, '#6c7282')]));
    for (let k = 0; k < 3; k++) line([c[0] - 10, top + 3 * k + 2], [c[0] + 10, top + 3 * k + 2], 'rgba(0,0,30,.25)', 0.4);
    oval(c[0], top, 10, 4, tone(E, '#b0b6c2')); oval(c[0], top, 7.5, 2.8, E.night ? '#0a1430' : '#2a4a6a');
    g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.ellipse(c[0], top, 10, 4, 0, 0, TAU); g.stroke(); g.strokeRect(c[0] - 10, top, 20, c[1] - top);
    R(c[0] - 9, top - 20, 1.6, 20, tone(E, WOOD)); R(c[0] + 7.4, top - 20, 1.6, 20, tone(E, WOOD));
    line([c[0] - 8, top - 14], [c[0] + 8, top - 14], tone(E, '#5a4034'), 1); oval(c[0], top - 14, 1.6, 1.6, tone(E, '#3a3f52'));
    line([c[0], top - 14], [c[0], top - 6], tone(E, '#d8c8a0'), 0.4); R(c[0] - 1.5, top - 6, 3, 3, tone(E, WOOD));
    poly([[c[0] - 13, top - 18], [c[0], top - 26], [c[0] + 13, top - 18], [c[0] + 13, top - 16.5], [c[0], top - 24.5], [c[0] - 13, top - 16.5]], tone(E, ROOF), true);
    poly([[c[0] - 13, top - 18.6], [c[0], top - 26.6], [c[0] + 13, top - 18.6], [c[0], top - 23]], L.drift[0]);
  };
  // 벌통 — 하얀 층층 상자, 짚 덮개에 눈
  B.hive = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.5, L = look(E);
    foot(E, cu, cv, 0.3, 0.3);
    post(E, cu - 0.2, cv + 0.2, 0, 4, '#5a4034', 0.6); post(E, cu + 0.2, cv + 0.2, 0, 4, '#5a4034', 0.6);
    for (let k = 0; k < 3; k++) box(cu - 0.28, cv - 0.28, cu + 0.28, cv + 0.28, 4 + k * 6, 9.6 + k * 6, tone(E, k % 2 ? '#e8dcc0' : '#f2ead2'), { top: k === 2 ? undefined : false });
    box(cu - 0.34, cv - 0.34, cu + 0.34, cv + 0.34, 22, 24.5, tone(E, '#c8a868'));
    const p = q(cu, cv, 24.5); oval(p[0], p[1] - 0.5, 9, 3.4, L.drift[0]);
    const d = q(cu - 0.1, cv + 0.28, 6); R(d[0] - 2, d[1] - 1, 4, 1.4, tone(E, '#3a2a20'));
  };
  // 허수아비 — 털모자·목도리 두른 허수아비
  B.scarecrow = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 2, y + 1, 9, 3, L.shadow);
    R(x - 0.8, y - 28, 1.6, 28, tone(E, WOOD)); R(x - 11, y - 22, 22, 1.6, tone(E, WOOD));
    poly([[x - 8, y - 23], [x + 8, y - 23], [x + 6, y - 9], [x - 6, y - 9]], tone(E, '#3f6ea0'), true);
    oval(x, y - 29, 5.5, 5.5, tone(E, '#e8d4a0')); g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.arc(x, y - 29, 5.5, 0, TAU); g.stroke();
    oval(x - 2, y - 29.5, 0.8, 0.8, '#2a2020'); oval(x + 2, y - 29.5, 0.8, 0.8, '#2a2020'); g.strokeStyle = '#2a2020'; g.lineWidth = 0.5; g.beginPath(); g.arc(x, y - 28, 2, 0.2, Math.PI - 0.2); g.stroke();
    poly([[x - 6, y - 31], [x + 6, y - 31], [x + 4.5, y - 37], [x, y - 39], [x - 4.5, y - 37]], tone(E, '#d9433e'), true); oval(x, y - 39.5, 2, 2, tone(E, TRIM)); R(x - 6.4, y - 32, 12.8, 2.2, tone(E, TRIM));
    R(x - 6, y - 24.5, 12, 2.4, tone(E, '#f2c040')); R(x + 2, y - 24.5, 2.4, 7, tone(E, '#f2c040'));
    oval(x - 8, y - 23.5, 3, 1.4, L.drift[0]); oval(x + 7, y - 23.5, 3, 1.4, L.drift[0]);
  };
  // 우편함 — 빨간 통 위 눈, 나무 기둥, 노란 깃
  B.mail = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 6, 2, L.shadow);
    R(x - 0.9, y - 16, 1.8, 16, tone(E, WOOD));
    R(x - 5, y - 22, 10, 7, tone(E, '#d9433e')); oval(x, y - 22, 5, 2.4, tone(E, '#e8564e')); g.strokeStyle = INK; g.lineWidth = LW; g.strokeRect(x - 5, y - 22, 10, 7);
    R(x - 3, y - 19.5, 6, 0.8, 'rgba(0,0,0,.4)'); R(x + 5, y - 24, 0.8, 5, tone(E, '#f2c040')); R(x + 5, y - 24, 3, 2, tone(E, '#f2c040'));
    oval(x, y - 23.5, 5.5, 1.8, L.drift[0]);
  };
  // 게시판 — 나무판에 쪽지, 위에 작은 지붕과 눈
  B.board = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 10, 3, L.shadow);
    R(x - 9, y - 22, 1.6, 22, tone(E, WOOD)); R(x + 7.4, y - 22, 1.6, 22, tone(E, WOOD));
    R(x - 8, y - 20, 16, 11, tone(E, '#c08a5c')); g.strokeStyle = INK; g.lineWidth = LW; g.strokeRect(x - 8, y - 20, 16, 11);
    [['#fff6c8', -6, -18.5], ['#ffd8e0', -1, -18], ['#d8ecff', 3, -18.6], ['#e0f4d8', -4, -14]].forEach(([c, dx, dy]) => { R(x + dx, y + dy, 4, 3.8, tone(E, c)); R(x + dx + 1.6, y + dy - 0.4, 0.8, 0.8, '#d9433e'); });
    poly([[x - 11, y - 21], [x, y - 26], [x + 11, y - 21]], tone(E, ROOF), true); poly([[x - 11, y - 21.6], [x, y - 26.6], [x + 11, y - 21.6], [x, y - 24]], L.drift[0]);
  };
  // 목장 뒤 울타리 — 앞 울타리는 fence 로 따로(동물이 그 뒤로 간다)
  B.pasture = (E, b) => { fenceRun(E, b.x, b.y, b.x + b.w, b.y); fenceRun(E, b.x, b.y, b.x, b.y + b.h); };
  function fenceRun(E, ua, va, ub, vb){
    const n = Math.max(1, Math.round(Math.hypot(ub - ua, vb - va) * 1.5));
    for (let i = 0; i <= n; i++) post(E, ua + (ub - ua) * i / n, va + (vb - va) * i / n, 0, 11, '#7a5a48', 0.8);
    [5, 9].forEach(z => { line(q(ua, va, z), q(ub, vb, z), tone(E, '#9a6a44'), 1.4); line(q(ua, va, z + 0.5), q(ub, vb, z + 0.5), tone(E, '#c08a5c'), 0.5); });
    for (let i = 0; i <= n; i++){ const p = q(ua + (ub - ua) * i / n, va + (vb - va) * i / n, 11); oval(p[0], p[1], 1.4, 0.9, look(E).drift[0]); }
  }
  // 울타리 한 토막 — farm.js 의 isoFenceSeg 자리
  function fence(gg, E, ua, va, ub, vb){ g = gg; P3 = (u, v, z) => E.P(u, v, z); fenceRun(E, ua, va, ub, vb); }

  // ================= 꾸미개 =================
  const D = {};
  // 분수 — 겨울이라 얼어붙은 분수: 돌 수반, 가운데 얼음 기둥과 고드름
  D.fountain = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), L = look(E), top = c[1] - 7;
    oval(c[0] + 2, c[1] + 2, 30, 12, L.shadow);
    oval(c[0], c[1], 27, 11, tone(E, '#6c7282')); R(c[0] - 27, top, 54, 7, vgrad(top, c[1], [tone(E, '#a8aebb'), tone(E, '#7a8090')]));
    oval(c[0], top, 27, 11, tone(E, '#b8bec8')); oval(c[0], top, 23, 9, L.ice[1]); oval(c[0] - 4, top - 1.5, 14, 4.5, L.ice[0]);
    g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.ellipse(c[0], top, 27, 11, 0, 0, TAU); g.stroke();
    R(c[0] - 3, top - 16, 6, 16, vgrad(top - 16, top, [tone(E, '#b8bec8'), tone(E, '#7a8090')]));
    oval(c[0], top - 16, 9, 3.6, tone(E, '#b8bec8')); oval(c[0], top - 16, 7, 2.6, L.ice[1]);
    poly([[c[0] - 2.5, top - 17], [c[0] + 2.5, top - 17], [c[0] + 1, top - 30], [c[0], top - 33], [c[0] - 1, top - 30]], L.ice[2]);
    for (let i = 0; i < 9; i++){ const a = i / 9 * TAU, x = c[0] + Math.cos(a) * 8.5, y = top - 16 + Math.sin(a) * 3.2; if (Math.sin(a) < -0.2) continue; poly([[x - 0.8, y], [x + 0.8, y], [x, y + 3 + hash(i) * 4]], L.ice[2]); }
    oval(c[0] - 14, top - 1, 6, 2, L.drift[0]); oval(c[0] + 12, top + 3, 7, 2.2, L.drift[0]);
  };
  // 별 동상 — 얼음을 깎은 큰 별
  D.statue = (E, b) => {
    const p = q(b.x + 0.5, b.y + 1, 0), x = p[0], y = p[1], L = look(E), cy = y - 34, r = 13;
    oval(x + 2, y + 1, 12, 4, L.shadow);
    box(b.x + 0.15, b.y + 0.55, b.x + 0.85, b.y + 1.45, 0, 10, tone(E, '#8c93a3'));
    R(x - 1.2, cy + 5, 2.4, y - 10 - cy - 3, L.ice[1]);
    g.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath();
    g.fillStyle = lin(x - r, cy - r, x + r, cy + r, [L.ice[2], L.ice[0], L.ice[1]]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    oval(x - 3, cy - 4, 2.4, 1.4, 'rgba(255,255,255,.8)');
    if (E.night) E.lamp(x, cy, 30, '#9fe6ff');
  };
  // 등불 — 쇠 가로등, 위에 눈
  D.lantern = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 7, 2.4, L.shadow);
    poly([[x - 5, y], [x + 5, y], [x + 4, y - 4], [x - 4, y - 4]], tone(E, '#3a3f52'));
    R(x - 1.2, y - 30, 2.4, 27, tone(E, '#454b60')); R(x - 1.2, y - 30, 0.8, 27, tone(E, '#646b84'));
    poly([[x - 5, y - 40], [x + 5, y - 40], [x + 3.4, y - 30], [x - 3.4, y - 30]], tone(E, '#2f3446'));
    poly([[x - 3.6, y - 39], [x + 3.6, y - 39], [x + 2.4, y - 31.5], [x - 2.4, y - 31.5]], E.night ? '#ffe7a4' : '#e9eef6');
    poly([[x - 6.5, y - 40], [x, y - 45], [x + 6.5, y - 40]], tone(E, '#2f3446')); oval(x, y - 42, 4.5, 1.6, L.drift[0]);
    if (E.night) E.lamp(x, y - 35, 44, '#ffcf7a');
  };
  // 벤치 — 나무 벤치, 앉는 판에 눈
  D.bench = (E, b) => {
    const u0 = b.x + 0.2, u1 = b.x + b.w - 0.2, v = b.y + 0.5, L = look(E);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.2);
    [u0 + 0.1, u1 - 0.1].forEach(u => post(E, u, v + 0.1, 0, 7, '#3a3f52', 0.7));
    box(u0, v - 0.2, u1, v - 0.12, 8, 16, tone(E, '#9a6a44'));
    box(u0, v - 0.15, u1, v + 0.15, 6, 8, tone(E, '#b07a50'));
    poly3([[u0 + 0.05, v - 0.12, 8.3], [u1 - 0.05, v - 0.12, 8.3], [u1 - 0.05, v + 0.13, 8.3], [u0 + 0.05, v + 0.13, 8.3]], L.drift[0]);
    line(q(u0, v - 0.16, 16.5), q(u1, v - 0.16, 16.5), L.drift[0], 1.6);
  };
  // 그네 — 쇠 틀(자리는 live 가 흔든다)
  D.swing = (E, b) => {
    const u0 = b.x + 0.25, u1 = b.x + b.w - 0.25, v = b.y + b.h / 2, L = look(E);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2 + 0.2, 0.5);
    [[u0, v - 0.45], [u0, v + 0.45], [u1, v - 0.45], [u1, v + 0.45]].forEach(([u, vv]) => line(q(u, vv, 0), q(u, v, 36), tone(E, '#3a3f52'), 1.4));
    line(q(u0, v, 36), q(u1, v, 36), tone(E, '#3a3f52'), 1.8); line(q(u0, v, 36.6), q(u1, v, 36.6), L.drift[0], 1.2);
  };
  D.swingLive = (E, b) => {
    const u0 = b.x + 0.25, u1 = b.x + b.w - 0.25, v = b.y + b.h / 2, sw = STILL ? 0 : Math.sin(E.t * 1.6) * 0.18;
    [0.35, 0.65].forEach(f => {
      const u = u0 + (u1 - u0) * f, top0 = q(u - 0.12, v, 36), top1 = q(u + 0.12, v, 36), s0 = q(u - 0.12, v + sw, 9), s1 = q(u + 0.12, v + sw, 9);
      line(top0, s0, 'rgba(60,60,70,.9)', 0.5); line(top1, s1, 'rgba(60,60,70,.9)', 0.5);
      poly([[s0[0] - 1, s0[1]], [s1[0] + 1, s1[1]], [s1[0] + 1, s1[1] + 1.6], [s0[0] - 1, s0[1] + 1.6]], tone(E, '#b07a50'), true);
    });
  };
  // 장미 아치 → 눈 덮인 덩굴 아치, 꼬마전구
  D.arch = (E, b) => {
    const u0 = b.x + 0.2, u1 = b.x + b.w - 0.2, v = b.y + 0.5, L = look(E), pts = [];
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.2);
    for (let i = 0; i <= 16; i++){ const a = Math.PI * i / 16; pts.push(q(u0 + (u1 - u0) * (1 - Math.cos(a)) / 2, v, 22 + Math.sin(a) * 14)); }
    [u0, u1].forEach(u => line(q(u, v, 0), q(u, v, 22), tone(E, '#3a5a4a'), 2.6));
    g.strokeStyle = tone(E, '#3a5a4a'); g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    pts.forEach((p, i) => { if (i % 2) oval(p[0], p[1] - 1, 2.6, 1.6, L.drift[0]); });
    for (let i = 0; i < 14; i++){
      const p = i < 4 ? q(u0, v, 3 + i * 5) : i > 9 ? q(u1, v, 3 + (13 - i) * 5) : pts[Math.round((i - 4) / 5 * 16)];
      oval(p[0] + 1.6, p[1] + 1, 0.9, 0.9, ['#ffd24d', '#ff7f8a', '#6cc7f3', '#9fe68a'][i % 4]); if (E.night && i % 3 === 0) E.lamp(p[0], p[1], 8, '#ffe0a0');
    }
  };
  // 모래놀이터 → 눈놀이터: 나무 틀 안 눈밭, 눈 성과 삽
  D.sandbox = (E, b) => {
    const L = look(E), u0 = b.x + 0.12, u1 = b.x + b.w - 0.12, v0 = b.y + 0.12, v1 = b.y + b.h - 0.12, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    footBox(E, { u0, v0, u1, v1 });
    box(u0, v0, u1, v1, 0, 4, tone(E, '#9a6a44'), { top: false });
    poly3([[u0 + 0.1, v0 + 0.1, 4], [u1 - 0.1, v0 + 0.1, 4], [u1 - 0.1, v1 - 0.1, 4], [u0 + 0.1, v1 - 0.1, 4]], L.drift[0]);
    box(cu - 0.35, cv - 0.35, cu + 0.35, cv + 0.35, 4, 12, L.drift[0], { left: shade(L.drift[0], -0.05), right: L.drift[1] });
    [[-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]].forEach(([du, dv]) => { const t = q(cu + du, cv + dv, 12); R(t[0] - 1.6, t[1] - 4, 3.2, 4, L.drift[0]); g.strokeStyle = 'rgba(60,80,130,.4)'; g.lineWidth = 0.4; g.strokeRect(t[0] - 1.6, t[1] - 4, 3.2, 4); });
    const t = q(cu, cv, 16); line(t, [t[0], t[1] - 6], '#5a4034', 0.5); poly([[t[0], t[1] - 6], [t[0] + 4, t[1] - 5], [t[0], t[1] - 4]], '#d9433e');
    const s = q(u1 - 0.3, v1 - 0.25, 4); line([s[0] - 3, s[1] - 7], [s[0] + 1, s[1]], tone(E, '#5a4034'), 0.8); poly([[s[0], s[1] - 1], [s[0] + 3, s[1]], [s[0] + 2.4, s[1] + 2], [s[0] - 0.6, s[1] + 1]], tone(E, '#3f8ad0'));
  };
  // 모닥불 — 돌 고리, 장작(불꽃은 live)
  D.firepit = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x, y, 11, 4.5, 'rgba(30,20,20,.35)');
    for (let i = 0; i < 9; i++){ const a = i / 9 * TAU, sx = x + Math.cos(a) * 9, sy = y + Math.sin(a) * 3.6; oval(sx, sy, 2.6, 1.8, tone(E, '#7a8090')); oval(sx - 0.5, sy - 0.8, 1.6, 0.8, L.drift[0]); }
    line([x - 5, y + 1], [x + 4, y - 2], tone(E, '#5a4034'), 2); line([x - 4, y - 2], [x + 5, y + 1], tone(E, '#6a4a3a'), 2);
  };
  D.firepitLive = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1] - 1, t = STILL ? 0 : E.t;
    g.save(); g.globalCompositeOperation = 'lighter';
    glow(x, y - 5, 22, 'rgba(255,150,60,', E.night ? 0.55 : 0.25);
    for (let i = 0; i < 3; i++){
      const h = 9 + Math.sin(t * 9 + i * 2) * 2.5 - i * 2, w = 4 - i;
      g.fillStyle = ['rgba(255,120,40,.9)', 'rgba(255,190,70,.9)', 'rgba(255,240,170,.95)'][i];
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w, y - h * 0.6, x + Math.sin(t * 7 + i) * 1.2, y - h); g.quadraticCurveTo(x + w, y - h * 0.6, x + w, y); g.closePath(); g.fill();
    }
    g.restore();
  };
  // 농장 팻말 — 나무 팻말 「수아연아」
  D.sign = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 7, 2.4, L.shadow);
    R(x - 0.9, y - 16, 1.8, 16, tone(E, WOOD));
    poly([[x - 10, y - 22], [x + 8, y - 22], [x + 11, y - 18.5], [x + 8, y - 15], [x - 10, y - 15]], tone(E, '#c08a5c'), true);
    g.fillStyle = tone(E, '#4a2c20'); g.font = '700 4px "Suayona Sans", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('수아연아', x - 0.5, y - 18.4);
    oval(x - 1, y - 22.4, 9.5, 1.5, L.drift[0]);
  };
  // 빨랫줄 — 두 기둥 사이 털옷·벙어리장갑·목도리
  D.clothesline = (E, b) => {
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, v = b.y + 0.5, L = look(E);
    [u0, u1].forEach(u => post(E, u, v, 0, 26, WOOD, 0.8));
    const a = q(u0, v, 25), c = q(u1, v, 25), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 3];
    g.strokeStyle = 'rgba(230,230,230,.8)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], c[0], c[1]); g.stroke();
    [[0.22, '#d9433e', 0], [0.48, '#3f6ea0', 1], [0.7, '#f2c040', 2]].forEach(([f, col, k]) => {
      const x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f + Math.sin(f * Math.PI) * 3;
      if (k === 0){ poly([[x - 4, y], [x + 4, y], [x + 6, y + 3], [x + 4, y + 3.5], [x + 3.4, y + 9], [x - 3.4, y + 9], [x - 4, y + 3.5], [x - 6, y + 3]], tone(E, col), true); R(x - 3.4, y + 5, 6.8, 1, tone(E, TRIM)); }
      else if (k === 1) [-2.2, 2.2].forEach(dx => { oval(x + dx, y + 3.4, 1.8, 3, tone(E, col)); oval(x + dx + 1.6, y + 2, 0.8, 1.2, tone(E, col)); });
      else { R(x - 1.5, y, 3, 11, tone(E, col)); for (let k2 = 0; k2 < 3; k2++) R(x - 1.5, y + 2 + k2 * 3, 3, 0.8, tone(E, '#d9433e')); }
    });
    [u0, u1].forEach(u => { const p = q(u, v, 26); oval(p[0], p[1], 1.6, 1, L.drift[0]); });
  };
  // 꽃밭 → 겨울 화분대: 상자에 빨간 겨울베리와 작은 전나무 묘목
  D.flowerbed = (E, b) => {
    const u0 = b.x + 0.12, u1 = b.x + b.w - 0.12, v0 = b.y + 0.2, v1 = b.y + b.h - 0.2, L = look(E);
    footBox(E, { u0, v0, u1, v1 });
    box(u0, v0, u1, v1, 0, 6, tone(E, '#9a6a44'));
    for (let i = 0; i < 4; i++){
      const p = q(u0 + 0.25 + i * (u1 - u0 - 0.5) / 3, (v0 + v1) / 2, 6);
      if (i % 2){ poly([[p[0], p[1] - 10], [p[0] + 3.4, p[1]], [p[0] - 3.4, p[1]]], L.fir[0], true); poly([[p[0], p[1] - 10], [p[0] + 2, p[1] - 5], [p[0] - 2, p[1] - 5]], L.firSnow[0]); }
      else { oval(p[0], p[1] - 3, 4, 3, L.fir[1]); for (let k = 0; k < 4; k++) oval(p[0] - 2.4 + k * 1.6, p[1] - 4 + (k % 2) * 1.4, 1, 1, '#e8344a'); }
    }
  };
  // 새집 — 기둥 위 작은 새집, 지붕에 눈, 노란 박새
  D.birdhouse = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 6, 2, L.shadow);
    R(x - 0.9, y - 24, 1.8, 24, tone(E, WOOD));
    R(x - 4.5, y - 33, 9, 9, tone(E, '#c08a5c')); g.strokeStyle = INK; g.lineWidth = LW; g.strokeRect(x - 4.5, y - 33, 9, 9);
    oval(x, y - 29, 1.6, 1.6, '#2a1c18');
    poly([[x - 6.5, y - 32], [x, y - 38], [x + 6.5, y - 32]], tone(E, FALU), true); poly([[x - 6.5, y - 32.6], [x, y - 38.6], [x + 6.5, y - 32.6], [x, y - 36]], L.drift[0]);
    oval(x + 6, y - 24.5, 2.4, 1.8, tone(E, '#f2c040')); oval(x + 7.4, y - 25.8, 1.4, 1.3, '#2a2a3a'); oval(x + 7.7, y - 26, 0.35, 0.35, '#ffffff');
  };
  // 깃발 — 장대(천은 live 가 펄럭인다)
  D.flag = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 6, 2, L.shadow); oval(x, y, 4, 1.6, tone(E, '#7a8090'));
    R(x - 0.6, y - 44, 1.2, 44, tone(E, '#c8ccd6')); oval(x, y - 44.5, 1.3, 1.3, '#f2c040');
  };
  // 북유럽 십자 깃발이 펄럭인다
  D.flagLive = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0] + 0.6, y = p[1] - 43, t = STILL ? 0 : E.t, W = 16, H = 10;
    const at = (f, k) => [x + W * f, y + H * k + Math.sin(t * 4 - f * 5) * 1.4 * f];
    const top = [], bot = [];
    for (let i = 0; i <= 8; i++){ top.push(at(i / 8, 0)); bot.push(at(i / 8, 1)); }
    path(top.concat(bot.reverse())); g.fillStyle = tone(E, '#3f6ea0'); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.5; g.stroke();
    g.strokeStyle = tone(E, '#f2c040'); g.lineWidth = 1.8; g.beginPath();
    for (let i = 0; i <= 8; i++){ const pp = at(i / 8, 0.5); if (i) g.lineTo(pp[0], pp[1]); else g.moveTo(pp[0], pp[1]); }
    const s0 = at(0.32, 0), s1 = at(0.32, 1); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.stroke();
  };
  // 수레 → 장작 썰매
  D.wagon = (E, b) => {
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, v = b.y + 0.5, L = look(E);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.25);
    [v - 0.2, v + 0.2].forEach(vv => { const a = q(u0, vv, 0), c = q(u1, vv, 0), d = q(u1 + 0.18, vv, 4); g.strokeStyle = tone(E, '#3a3f52'); g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.quadraticCurveTo(d[0] + 1, c[1], d[0], d[1]); g.stroke(); });
    box(u0 + 0.05, v - 0.28, u1 - 0.1, v + 0.28, 3, 9, tone(E, '#b07a50'));
    for (let i = 0; i < 6; i++){ const p = q(u0 + 0.25 + (i % 3) * 0.35, v - 0.1 + (i > 2 ? 0.2 : 0), 10 + (i > 2 ? 0 : 3)); oval(p[0], p[1], 2.6, 1.8, tone(E, '#8a5a3c')); oval(p[0] + 1.2, p[1], 1.4, 1.4, tone(E, '#d8b088')); }
    const p = q((u0 + u1) / 2, v, 15); oval(p[0], p[1], 8, 2.4, L.drift[0]);
  };
  // 풍차 — 하얀 돌 탑, 빨간 지붕(날개는 live)
  D.windmill = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), L = look(E), x = c[0], y = c[1];
    oval(x + 3, y + 1.5, 22, 8, L.shadow);
    poly([[x - 13, y], [x + 13, y], [x + 9, y - 46], [x - 9, y - 46]], vgrad(y - 46, y, [tone(E, '#f2ece0'), tone(E, '#cfc6b4')]), true);
    poly([[x + 2, y], [x + 13, y], [x + 9, y - 46], [x + 1.5, y - 46]], 'rgba(0,0,40,.14)');
    R(x - 3, y - 12, 6, 12, tone(E, '#6a4430')); g.strokeStyle = INK; g.lineWidth = LW; g.strokeRect(x - 3, y - 12, 6, 12);
    R(x - 2, y - 30, 4, 6, E.night ? L.win : '#6f9ec4'); if (E.night) E.lamp(x, y - 27, 20, '#ffcf7a');
    poly([[x - 11, y - 45], [x, y - 60], [x + 11, y - 45]], tone(E, FALU), true);
    poly([[x - 11, y - 45.6], [x, y - 60.6], [x + 11, y - 45.6], [x, y - 54]], L.drift[0]);
  };
  D.windmillLive = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), x = c[0] + 1, y = c[1] - 44, a0 = STILL ? 0.3 : E.t * 0.9;
    for (let i = 0; i < 4; i++){
      const a = a0 + i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), Lb = 26, wd = 5;
      const p = (r, s) => [x + ca * r - sa * s, y + sa * r + ca * s];
      line(p(0, 0), p(Lb, 0), tone(E, '#5a4034'), 1.2);
      poly([p(6, 0.6), p(Lb, 0.6), p(Lb, wd), p(6, wd)], 'rgba(242,236,224,.92)', 0.5);
      for (let k = 1; k < 4; k++) line(p(6 + k * 5, 0.6), p(6 + k * 5, wd), 'rgba(90,64,52,.6)', 0.35);
    }
    oval(x, y, 2.2, 2.2, tone(E, '#3a3f52'));
  };
  // ---- 오로라 농장 꾸미개 셋 ----
  // 이글루 — 눈 벽돌 반구, 앞에 굴 입구, 밤이면 안에서 불빛이 샌다
  D.igloo = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), L = look(E), x = c[0], y = c[1] + 2, r = 24;
    oval(x + 3, y + 1, r + 4, r * 0.42, L.shadow);
    g.beginPath(); g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI); g.ellipse(x, y, r, r * 0.95, 0, Math.PI, TAU); g.closePath();
    g.fillStyle = lin(x - r, y - r, x + r, y, [L.drift[0], L.drift[0], L.drift[1]]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(80,100,150,.35)'; g.lineWidth = 0.5;
    for (let k = 1; k < 5; k++){ const yy = y - k * r * 0.19; g.beginPath(); g.moveTo(x - r, yy); g.quadraticCurveTo(x, yy + 6, x + r, yy); g.stroke();
      for (let j = -4; j <= 4; j++){ const xx = x + j * r / 4.5 + (k % 2) * r / 9; g.beginPath(); g.moveTo(xx, yy + 3); g.lineTo(xx, yy + 3 - r * 0.19); g.stroke(); } }
    g.restore();
    const ex = x + 4, ey = y + 4;
    g.beginPath(); g.ellipse(ex, ey, 8.5, 9, 0, Math.PI, TAU); g.lineTo(ex + 8.5, ey + 3); g.lineTo(ex - 8.5, ey + 3); g.closePath(); g.fillStyle = shade(L.drift[0], -0.04); g.fill(); g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(ex, ey + 1, 5, 6.5, 0, Math.PI, TAU); g.lineTo(ex + 5, ey + 3); g.lineTo(ex - 5, ey + 3); g.closePath(); g.fillStyle = E.night ? '#ffc870' : '#2a3450'; g.fill();
    if (E.night) E.lamp(ex, ey - 2, 36, '#ffbf6a');
  };
  // 썰매 — 빨간 나무 썰매, 앞이 둥글게 말린 금빛 날, 체크 담요와 선물
  D.sled = (E, b) => {
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, v = b.y + 0.5;
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.25);
    [v - 0.22, v + 0.22].forEach(vv => { const a = q(u0, vv, 0), c = q(u1, vv, 0), d = q(u1 + 0.1, vv, 9); g.strokeStyle = tone(E, '#c8a040'); g.lineWidth = 1.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0] - 1, a[1] - 1.5); g.lineTo(c[0], c[1]); g.bezierCurveTo(c[0] + 5, c[1], d[0] + 4, d[1] + 2, d[0], d[1]); g.stroke();
      [0.25, 0.75].forEach(f => line(q(u0 + (u1 - u0) * f, vv, 0), q(u0 + (u1 - u0) * f, vv, 4), tone(E, '#c8a040'), 0.8)); });
    box(u0 + 0.05, v - 0.3, u1 - 0.05, v + 0.3, 4, 7, tone(E, '#c8323a'));
    box(u0 + 0.05, v - 0.3, u0 + 0.22, v + 0.3, 7, 15, tone(E, '#c8323a'));
    poly3([[u0 + 0.3, v - 0.28, 7.2], [u1 - 0.2, v - 0.28, 7.2], [u1 - 0.2, v + 0.3, 7.2], [u0 + 0.3, v + 0.3, 7.2]], tone(E, '#e8dcc0'));
    for (let a = u0 + 0.35; a < u1 - 0.2; a += 0.18) line(q(a, v + 0.3, 7.2), q(a, v - 0.28, 7.2), 'rgba(200,60,60,.6)', 0.6);
    const g0 = q(u1 - 0.3, v, 8); R(g0[0] - 3, g0[1] - 5, 6, 5, tone(E, '#3f8a5a')); R(g0[0] - 0.4, g0[1] - 5, 0.8, 5, tone(E, '#d9433e')); R(g0[0] - 3, g0[1] - 3, 6, 0.8, tone(E, '#d9433e'));
  };
  // 얼음낚시 구멍 — 얼음판에 둥근 구멍, 낚싯대와 생선 담은 양동이
  D.icefish = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x, y, 13, 5.5, L.ice[1]); oval(x - 2, y - 1, 9, 3.2, L.ice[0]);
    oval(x + 1, y + 0.5, 5, 2, E.night ? '#06102a' : '#1a3a5a'); oval(x + 1, y - 0.2, 5, 1.5, 'rgba(255,255,255,.18)');
    line([x - 9, y + 2], [x + 3, y - 18], tone(E, '#8a5a3c'), 0.9); line([x + 3, y - 18], [x + 1.5, y + 0.5], 'rgba(230,230,230,.8)', 0.3);
    R(x + 6, y - 7, 6, 6, tone(E, '#7a8090')); oval(x + 9, y - 7, 3, 1.1, tone(E, '#9aa0ae')); oval(x + 9, y - 7.2, 2.2, 0.7, '#3f6ea0');
    oval(x + 8.4, y - 8.6, 2.6, 1, tone(E, '#e8a050')); poly([[x + 10.8, y - 8.6], [x + 12.4, y - 9.6], [x + 12.4, y - 7.6]], tone(E, '#e8a050'));
  };

  // ---- 앞 농장에서 「추억」으로 들고 온 꾸미개 15종(2026-10-09) — 오로라 눈 섬에 맞게 눈을 얹어 다시 그린다 ----
  // 바닷가: 등대·야자수·닻·고깃배·파라솔 · 화산: 흑요석 돌탑·용암 폭포·장작더미·우유통·용뿔 나팔 · 꽃구름: 자판기·붉은 북다리·대나무 물통·잉어 깃발·지장보살
  D.lighthouse = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.5, 0), x = p[0], y = p[1], L = look(E), top = y - 52;
    oval(x + 2, y + 1, 11, 4, L.shadow);
    poly([[x - 8, y], [x + 8, y], [x + 5, top], [x - 5, top]], vgrad(top, y, [tone(E, '#f6f2ea'), tone(E, '#d8d2c6')]), true);
    for (let k = 0; k < 3; k++){ const y0 = y - 8 - k * 15, w0 = 8 - (k * 15 + 8) / 52 * 3, w1 = 8 - (k * 15 + 15) / 52 * 3; poly([[x - w0, y0], [x + w0, y0], [x + w1, y0 - 7], [x - w1, y0 - 7]], tone(E, '#d9433e')); }
    poly([[x + 1, y], [x + 8, y], [x + 5, top], [x + 0.5, top]], 'rgba(0,0,40,.14)');
    R(x - 7, top - 2, 14, 2.4, tone(E, '#3a3f52'));
    R(x - 4, top - 9, 8, 7, E.night ? '#ffe7a4' : 'rgba(200,230,250,.9)'); g.strokeStyle = INK; g.lineWidth = LW; g.strokeRect(x - 4, top - 9, 8, 7);
    poly([[x - 5.5, top - 9], [x, top - 15], [x + 5.5, top - 9]], tone(E, '#d9433e'), true); oval(x, top - 11, 4, 1.4, L.drift[0]);
    if (E.night) E.lamp(x, top - 5, 40, '#ffe08a');
  };
  D.palm = (E, b) => {                                                   // 야자수 — 눈 섬에선 화분에 담아 털옷을 입혔다
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 2, y + 1, 9, 3, L.shadow);
    poly([[x - 6, y], [x + 6, y], [x + 7, y - 7], [x - 7, y - 7]], tone(E, '#c8683a'), true);
    g.strokeStyle = tone(E, '#9a6a44'); g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 7); g.quadraticCurveTo(x - 3, y - 20, x + 2, y - 32); g.stroke();
    for (let k = 0; k < 5; k++) line([x - 2.4 + k * 0.4, y - 12 - k * 4], [x + 1.6 + k * 0.4, y - 13 - k * 4], tone(E, '#7a5034'), 0.5);
    R(x - 3, y - 18, 5, 3, tone(E, '#d9433e'));                           // 목도리
    for (let i = 0; i < 6; i++){ const a = -Math.PI / 2 + (i - 2.5) * 0.55, tx = x + 2 + Math.cos(a) * 14, ty = y - 32 + Math.sin(a) * 6 + 7;
      g.fillStyle = L.fir[1]; g.beginPath(); g.moveTo(x + 2, y - 32); g.quadraticCurveTo((x + 2 + tx) / 2, ty - 7, tx, ty); g.quadraticCurveTo((x + 2 + tx) / 2, ty - 3, x + 2, y - 31); g.fill(); }
    oval(x + 2, y - 34, 6, 1.6, L.drift[0]);
  };
  D.anchor = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E), c = tone(E, '#4a5266');
    oval(x + 1, y + 1, 9, 3, L.shadow);
    line([x, y - 2], [x, y - 22], c, 2.2); line([x - 5, y - 18], [x + 5, y - 18], c, 1.8);
    g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y - 9, 7, 0.2, Math.PI - 0.2); g.stroke();
    g.beginPath(); g.arc(x, y - 24, 2.4, 0, TAU); g.stroke();
    poly([[x - 8, y - 9], [x - 5, y - 7], [x - 7, y - 4]], c); poly([[x + 8, y - 9], [x + 5, y - 7], [x + 7, y - 4]], c);
    oval(x, y - 26.5, 2.4, 0.9, L.drift[0]); oval(x - 3, y - 18.8, 2, 0.7, L.drift[0]);
  };
  D.boat = (E, b) => {                                                   // 고깃배 — 얼음 위에 끌어 올려 둔 작은 배
    const u0 = b.x + 0.1, u1 = b.x + b.w - 0.1, v = b.y + 0.5, L = look(E);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.3);
    poly3([[u0, v - 0.3, 6], [u1 - 0.3, v - 0.3, 6], [u1 + 0.1, v, 7], [u1 - 0.3, v + 0.3, 6], [u0, v + 0.3, 6]], tone(E, '#3f6ea0'));
    poly3([[u0, v + 0.3, 6], [u1 - 0.3, v + 0.3, 6], [u1 + 0.1, v, 7], [u1 - 0.2, v + 0.15, 1], [u0 + 0.15, v + 0.2, 1]], tone(E, '#2f5888'), true);
    line(q(u0 + 0.1, v + 0.3, 4.6), q(u1 - 0.3, v + 0.3, 4.6), tone(E, TRIM), 0.8);
    poly3([[u0 + 0.1, v - 0.22, 6.2], [u1 - 0.35, v - 0.22, 6.2], [u1 - 0.35, v + 0.22, 6.2], [u0 + 0.1, v + 0.22, 6.2]], L.drift[0]);
  };
  D.parasol = (E, b) => {                                                // 파라솔 — 접어서 눈을 맞고 섰다
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1, y + 1, 6, 2, L.shadow); oval(x, y, 3.5, 1.4, tone(E, '#7a8090'));
    R(x - 0.5, y - 34, 1, 34, tone(E, '#c8ccd6'));
    poly([[x, y - 34], [x + 4, y - 22], [x + 2, y - 12], [x - 2, y - 12], [x - 4, y - 22]], tone(E, '#d9433e'), true);
    poly([[x, y - 34], [x + 1.6, y - 22], [x + 0.8, y - 12], [x - 0.8, y - 12], [x - 1.6, y - 22]], tone(E, TRIM));
    oval(x, y - 33, 2.6, 1.2, L.drift[0]);
  };
  D.cairn = (E, b) => {                                                  // 흑요석 돌탑 — 새긴 무늬가 밤에 빛난다
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 2, y + 1, 10, 3.5, L.shadow);
    [[0, 10, 4.5], [0.5, 8, 3.8], [-0.5, 6.5, 3.4], [0.4, 5, 3]].reduce((yy, [dx, w, h]) => { oval(x + dx, yy - h, w, h, tone(E, '#2a2630')); oval(x + dx - w * 0.3, yy - h * 1.4, w * 0.4, h * 0.3, 'rgba(255,255,255,.25)'); g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.ellipse(x + dx, yy - h, w, h, 0, 0, TAU); g.stroke(); return yy - h * 1.7; }, y);
    [[-3, -4], [2, -10], [-1, -15]].forEach(([dx, dy]) => oval(x + dx, y + dy, 1.2, 0.7, E.night ? '#ffb040' : '#c86a2a'));
    oval(x + 0.4, y - 23, 3, 1.2, L.drift[0]);
    if (E.night) E.lamp(x, y - 10, 18, '#ff9a4a');
  };
  D.waterfall = (E, b) => {                                              // 용암 폭포 → 얼어붙은 폭포: 바위 틈에서 흘러내리다 굳은 얼음
    const L = look(E), cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), x = c[0], y = c[1];
    oval(x + 3, y + 2, 26, 9, L.shadow);
    poly([[x - 24, y], [x - 20, y - 22], [x - 8, y - 36], [x + 10, y - 34], [x + 22, y - 18], [x + 24, y]], vgrad(y - 36, y, [tone(E, '#7a8090'), tone(E, '#4a5266')]), true);
    poly([[x - 21, y - 21], [x - 8, y - 37], [x + 10, y - 35], [x + 20, y - 22], [x + 6, y - 28], [x - 6, y - 26]], L.drift[0]);
    poly([[x - 6, y - 30], [x + 6, y - 30], [x + 9, y - 2], [x - 9, y - 2]], lin(x - 9, 0, x + 9, 0, [L.ice[1], L.ice[2], L.ice[0]]));
    for (let i = 0; i < 6; i++) line([x - 5 + i * 2, y - 29], [x - 7 + i * 2.8, y - 3], 'rgba(255,255,255,.45)', 0.4);
    oval(x, y, 14, 4.5, L.ice[0]); oval(x - 3, y - 1, 7, 1.8, 'rgba(255,255,255,.6)');
  };
  D.woodpile = (E, b) => {
    const u0 = b.x + 0.12, u1 = b.x + b.w - 0.12, v = b.y + 0.5, L = look(E);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.3);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++){ const p = q(u0 + 0.12 + (i + r * 0.5) * (u1 - u0 - 0.24) / 6, v + 0.3, 2.6 + r * 4.6); oval(p[0], p[1], 2.6, 2.3, tone(E, '#8a5a3c')); oval(p[0], p[1], 1.8, 1.6, tone(E, '#d8b088')); oval(p[0], p[1], 0.7, 0.6, tone(E, '#a87850')); }
    const p = q((u0 + u1) / 2, v + 0.2, 15); oval(p[0], p[1], 14, 2.6, L.drift[0]);
  };
  D.milkcans = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.55, 0), L = look(E);
    oval(p[0] + 2, p[1] + 1, 10, 3, L.shadow);
    [[-4, 0, 1], [4, 1, 0.9]].forEach(([dx, dy, s]) => { const x = p[0] + dx, y = p[1] + dy, h = 13 * s, w = 3.6 * s;
      R(x - w, y - h, w * 2, h, lin(x - w, 0, x + w, 0, [tone(E, '#e8ecf2'), tone(E, '#9aa0ae')])); oval(x, y - h, w, w * 0.4, tone(E, '#c8ccd6')); R(x - w * 0.5, y - h - 3, w, 3, tone(E, '#b8bec8')); oval(x, y - h - 3, w * 0.7, w * 0.3, L.drift[0]); g.strokeStyle = INK; g.lineWidth = 0.5; g.strokeRect(x - w, y - h, w * 2, h); });
  };
  D.alphorn = (E, b) => {                                                // 용뿔 나팔 — 받침에 걸친 긴 나무 나팔
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, v = b.y + 0.5, a = q(u0, v, 14), c = q(u1, v, 2);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.2);
    post(E, u0 + 0.1, v, 0, 13, '#5a4034', 0.6);
    g.strokeStyle = tone(E, '#9a6a44'); g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 4, c[0] - 3, c[1]); g.stroke();
    g.strokeStyle = tone(E, '#d9433e'); g.lineWidth = 0.8; [0.3, 0.55].forEach(f => { const x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f + 2; g.beginPath(); g.moveTo(x, y - 1.6); g.lineTo(x, y + 1.6); g.stroke(); });
    oval(c[0], c[1] - 1, 4.4, 4, tone(E, '#7a5034')); oval(c[0] + 0.6, c[1] - 1, 3, 2.8, tone(E, '#3a2420'));
  };
  D.balloon = (E, b) => {                                                // 음료 자판기 두 대 — 눈 처마, 밤에 환하다
    const L = look(E);
    [[b.x + 0.15, '#d9433e'], [b.x + 1.05, '#3f6ea0']].forEach(([u, col]) => {
      const G = { u0: u, v0: b.y + 0.7, u1: u + 0.8, v1: b.y + 1.3, H: 30 };
      footBox(E, G); box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, col));
      onFace(G, 'L', 0.08, 0.72, 12, 27, E.night ? '#fff6d8' : '#e8f2fa', true);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++){ const pp = faceAt(G, 'L', 0.16 + k * 0.15, 15 + r * 4.4); R(pp[0] - 0.9, pp[1] - 2.4, 1.8, 2.4, ['#f2c040', '#8fbf6a', '#d9433e', '#6a9ad0'][(k + r) % 4]); }
      onFace(G, 'L', 0.2, 0.6, 3, 7, tone(E, '#2a2a3a'));
      const tp = q((G.u0 + G.u1) / 2, (G.v0 + G.v1) / 2, G.H); oval(tp[0], tp[1], 8, 2.6, L.drift[0]);
      if (E.night){ const c = faceAt(G, 'L', 0.4, 20); E.lamp(c[0], c[1], 30, '#f0f4ff'); }
    });
  };
  D.skybridge = (E, b) => {                                              // 붉은 북다리 — 얼어붙은 개울 위 반달 다리
    const u0 = b.x + 0.05, u1 = b.x + b.w - 0.05, v = b.y + 0.5, L = look(E), arc = (dv, z) => { const pts = []; for (let i = 0; i <= 16; i++){ const f = i / 16; pts.push(q(u0 + (u1 - u0) * f, v + dv, z + Math.sin(f * Math.PI) * 12)); } return pts; };
    const s0 = q(u0, v - 0.5, 0), s1 = q(u1, v - 0.5, 0), s2 = q(u1, v + 0.5, 0), s3 = q(u0, v + 0.5, 0); poly([s0, s1, s2, s3], L.ice[1]);
    const back = arc(-0.32, 1), front = arc(0.32, 1);
    path(back.concat(front.slice().reverse())); g.fillStyle = tone(E, '#b8302a'); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    path(front.concat(arc(0.32, -2).reverse())); g.fillStyle = tone(E, '#8a2420'); g.fill();
    const rail = arc(0.32, 7); g.strokeStyle = tone(E, '#d9433e'); g.lineWidth = 1.2; g.beginPath(); rail.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    for (let i = 0; i <= 16; i += 4){ line(front[i], rail[i], tone(E, '#d9433e'), 1); oval(rail[i][0], rail[i][1] - 0.8, 1.6, 0.8, L.drift[0]); }
    const top = arc(0, 1.6); g.strokeStyle = L.drift[0]; g.lineWidth = 2.2; g.beginPath(); top.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  };
  D.shishi = (E, b) => {                                                 // 대나무 물통 — 겨울이라 고드름이 맺혔다
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x, y, 10, 4, tone(E, '#6c7282')); oval(x, y - 1, 7, 2.6, L.ice[1]);
    line([x - 7, y - 4], [x - 7, y - 16], tone(E, '#7a8a4a'), 1.4); line([x - 9, y - 12], [x + 6, y - 7], tone(E, '#9ab06a'), 2.4);
    oval(x + 6, y - 7, 1.4, 1.2, tone(E, '#5a6a3a'));
    poly([[x + 5, y - 6], [x + 7, y - 6], [x + 6, y - 1]], L.ice[2]);
    oval(x - 4, y - 0.5, 3, 1.4, tone(E, '#8c93a3')); oval(x - 4, y - 1.4, 2.4, 0.8, L.drift[0]);
  };
  D.koinobori = (E, b) => {                                              // 잉어 깃발 — 장대(잉어는 live)
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1, y + 1, 6, 2, L.shadow); line([x, y], [x, y - 48], tone(E, '#c8b878'), 1.4); oval(x, y - 49, 1.6, 1.6, '#f2c040');
  };
  D.koinoboriLive = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0] + 0.8, t = STILL ? 0 : E.t;
    [['#d9433e', 44, 18], ['#3f6ea0', 33, 15], ['#f2a0b8', 24, 12]].forEach(([c, dy, len], k) => {
      const y = p[1] - dy, pts = [], low = [];
      for (let i = 0; i <= 6; i++){ const f = i / 6, w = Math.sin(t * 3.4 - f * 4 + k) * 1.6 * f, h = 3.2 * (1 - f * 0.45); pts.push([x + len * f, y + w - h]); low.push([x + len * f, y + w + h]); }
      path(pts.concat(low.reverse())); g.fillStyle = tone(E, c); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.4; g.stroke();
      oval(x + 3, y - 0.6, 1.4, 1.4, '#ffffff'); oval(x + 3.2, y - 0.6, 0.6, 0.6, '#1a1a2a');
    });
  };
  D.toro = (E, b) => {                                                   // 지장보살 — 빨간 턱받이와 털모자, 밤엔 촛불
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 7, 2.4, L.shadow);
    box(b.x + 0.25, b.y + 0.35, b.x + 0.75, b.y + 0.85, 0, 4, tone(E, '#8c93a3'));
    oval(x, y - 10, 5, 6.5, tone(E, '#a8aebb')); oval(x, y - 19, 4.2, 4.2, tone(E, '#b8bec8'));
    g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.ellipse(x, y - 10, 5, 6.5, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y - 19, 4.2, 0, TAU); g.stroke();
    poly([[x - 4.6, y - 15.5], [x + 4.6, y - 15.5], [x, y - 10]], tone(E, '#d9433e'));
    poly([[x - 4.4, y - 21], [x + 4.4, y - 21], [x + 3, y - 25], [x, y - 26.5], [x - 3, y - 25]], tone(E, '#d9433e')); oval(x, y - 27, 1.4, 1.4, tone(E, TRIM));
    g.strokeStyle = '#3a3a4a'; g.lineWidth = 0.5; g.beginPath(); g.arc(x - 1.5, y - 19, 0.9, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(x + 1.5, y - 19, 0.9, 0.2, Math.PI - 0.2); g.stroke();
    if (E.night){ R(x + 5, y - 5, 1.4, 4, '#f2ece0'); oval(x + 5.7, y - 6, 0.9, 1.4, '#ffd06a'); E.lamp(x + 5.7, y - 6, 16, '#ffcf7a'); }
  };

  // ---------- 바닥 ----------
  const F = {};
  // 연못 → 꽁꽁 언 연못: 얼음판에 금, 가장자리 눈 둔덕
  F.pond = (E, b) => {
    const L = look(E), cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), r1 = q(b.x + b.w - 0.2, cv, 0), r2 = q(cu, b.y + b.h - 0.2, 0);
    const rx = Math.hypot(r1[0] - c[0], r1[1] - c[1]) * 0.98, ry = Math.abs(r2[1] - c[1]) + rx * 0.2;
    oval(c[0], c[1] + 1, rx + 3, ry + 2, L.drift[1]); oval(c[0], c[1], rx + 2, ry + 1.4, L.drift[0]);
    oval(c[0], c[1] + 0.6, rx, ry, L.ice[1]);
    oval(c[0] - rx * 0.12, c[1] - ry * 0.12, rx * 0.8, ry * 0.7, L.ice[0]);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.4; g.beginPath();
    for (let i = 0; i < 6; i++){ const a = hash(i * 9 + b.x) * TAU, x0 = c[0] + Math.cos(a) * rx * 0.2, y0 = c[1] + Math.sin(a) * ry * 0.2; g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * rx * 0.5, y0 + Math.sin(a) * ry * 0.5 + 1); g.lineTo(x0 + Math.cos(a + 0.3) * rx * 0.7, y0 + Math.sin(a + 0.3) * ry * 0.7); }
    g.stroke();
    oval(c[0] - rx * 0.35, c[1] - ry * 0.3, rx * 0.2, ry * 0.08, 'rgba(255,255,255,.6)');
  };
  // 꽃길 → 돌길(섬 길과 같은 돌)
  F.path = (E, b) => { const cells = new Set(); for (let u = b.x; u < b.x + b.w; u++) for (let v = b.y; v < b.y + b.h; v++) cells.add(u + ',' + v); stones(E, cells); };
  // 목장 바닥 — 밟혀 다져진 눈, 짚 흩어짐
  F.pasture = (E, b) => {
    const L = look(E);
    poly3([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + b.h - 0.1, 0], [b.x + 0.1, b.y + b.h - 0.1, 0]], L.snowLo);
    for (let i = 0; i < 26; i++){ const p = q(b.x + 0.3 + hash(i * 3 + b.x) * (b.w - 0.6), b.y + 0.3 + hash(i * 7 + b.y) * (b.h - 0.6), 0); line([p[0] - 2, p[1]], [p[0] + 2, p[1] - 0.6], tone(E, '#d8b860'), 0.5); }
  };

  // ---------- 아이 — 라이프퀘스트 걷기 그림 ----------
  // hip·cut 은 hero-walk.js 와 같다 — 앞옆(SW) 서기 칸을 몸통·두 다리로 가르는 줄(엉덩이 줄, 다리 가르는 선의 [엉덩이 쪽, 발 쪽] 열)
  const ATLAS = {
    sua:  { src: '/pages/hero-sua.png?v=1005a',  w: 166, h: 231, foot: 228, cx: 83, tall: 220, hip: 179, cut: [78, 70] },
    yona: { src: '/pages/hero-yona.png?v=1005a', w: 144, h: 229, foot: 226, cx: 72, tall: 220, hip: 177, cut: [68, 61] },
  };
  const imgs = {}, legParts = {};
  const ROW = { S: [0, false], SW: [1, false], W: [2, false], NW: [3, false], N: [4, false], SE: [1, true], E: [2, true], NE: [3, true] };
  const LEG_SWING = 13, LEG_LIFT = 8;
  // 원본 걷기 칸은 늘 같은 다리가 앞이라(hero-walk.js 2026-10-05) 앞옆으로 걸을 때는 서기 칸을 잘라 다리를 엉덩이에서 서로 반대로 흔든다
  function partsOf(k, im){
    if (legParts[k]) return legParts[k];
    const A = ATLAS[k], top = A.hip - 3, cut = fn => { const c = document.createElement('canvas'); c.width = A.w; c.height = A.h; const x = c.getContext('2d'); x.beginPath(); fn(x); x.clip(); x.drawImage(im, 0, A.h, A.w, A.h, 0, 0, A.w, A.h); return c; };
    return (legParts[k] = {
      body: cut(x => x.rect(0, 0, A.w, A.hip + 1)),
      far: cut(x => { x.moveTo(0, top); x.lineTo(A.cut[0], top); x.lineTo(A.cut[1], A.h); x.lineTo(0, A.h); }),
      near: cut(x => { x.moveTo(A.cut[0], top); x.lineTo(A.w, top); x.lineTo(A.w, A.h); x.lineTo(A.cut[1], A.h); }),
    });
  }
  function leg(Pt, A, which, th){
    const len = A.foot - A.hip, sw = Math.sin(th), up = Math.max(0, Math.cos(th)) * LEG_LIFT;
    g.save(); g.translate(0, A.hip); g.transform(1, 0, -sw * LEG_SWING / len, 1 - up / len, 0, 0); g.drawImage(Pt[which], 0, -A.hip); g.restore();
  }
  // 발끝이 (x, y). dir 은 여덟 방향(S·SW·…), frame 0 = 서기, 1~4 = 걷기(앞옆·뒤옆은 다리를 흔들고, 나머지는 시트의 걷기 칸). 그림이 아직 안 왔으면 false
  function kid(gg, k, x, y, dir, frame, tall){
    g = gg;
    const A = ATLAS[k]; if (!A) return false;
    let im = imgs[k]; if (!im){ im = imgs[k] = new Image(); im.decoding = 'async'; im.src = A.src; }
    if (!im.complete || !im.naturalWidth) return false;
    const r = ROW[dir] || ROW.S, sc = tall / A.tall, swing = frame > 0 && r[0] === 1;
    oval(x, y + 0.5, tall * 0.2, tall * 0.07, 'rgba(10,16,40,.3)');
    g.save(); g.translate(x, y - (swing && frame % 2 ? 0.6 : 0)); if (r[1]) g.scale(-1, 1);
    if (swing){
      const Pt = partsOf(k, im), th = (frame - 1) / 4 * TAU + 0.6;
      g.scale(sc, sc); g.translate(-A.cx, -A.foot);
      leg(Pt, A, 'far', th); leg(Pt, A, 'near', th + Math.PI); g.drawImage(Pt.body, 0, 0);
    } else g.drawImage(im, frame * A.w, r[0] * A.h, A.w, A.h, -A.cx * sc, -A.foot * sc, A.w * sc, A.h * sc);
    g.restore();
    return true;
  }

  // ---------- 바깥에 내놓는 것 ----------
  const LIVE = { swing: D.swingLive, firepit: D.firepitLive, flag: D.flagLive, windmill: D.windmillLive, koinobori: D.koinoboriLive };
  function thing(gg, E, id, b, night, part){ g = gg; P3 = (u, v, z) => E.P(u, v, z); const f = B[id] || D[id]; if (!f) return false; f(E, b, night, part); return true; }
  function floor(gg, E, id, b){ g = gg; P3 = (u, v, z) => E.P(u, v, z); const f = F[id]; if (!f) return false; f(E, b); return true; }
  function live(gg, E, id, b){ g = gg; P3 = (u, v, z) => E.P(u, v, z); const f = LIVE[id]; if (f) f(E, b); return !!f; }
  const has = id => !!(B[id] || D[id]);
  const hasLive = id => !!LIVE[id];
  // 내리는 눈 — 화면 기준
  const flakes = Array.from({ length: 90 }, (_, i) => ({ x: hash(i * 3 + 1), y: hash(i * 7 + 2), s: 0.35 + hash(i * 11) * 0.8, ph: hash(i) * TAU }));
  function snowfall(gg, E){
    g = gg; g.fillStyle = 'rgba(255,255,255,.85)';
    flakes.forEach(f => { const x = ((f.x * E.w + Math.sin(E.t * 0.7 + f.ph) * 8 - E.t * 3.5 * f.s) % E.w + E.w) % E.w, y = ((f.y * E.h + E.t * 11 * f.s) % E.h + E.h) % E.h; g.beginPath(); g.arc(x, y, f.s, 0, TAU); g.fill(); });
  }

  // ================= 시험 장면(_aurora-test.html) =================
  // 농장과 같은 그림을 로그인 없이 본다 — 건물·꾸미개를 모두 한 섬에 늘어놓는다
  function mount(cv, opts){
    opts = opts || {};
    const COLS = 26, ROWS = 20, IT = 40, IH = 20, TOP = 108, CLIFF = 72, AW = (COLS + ROWS) * IT / 2, AH = TOP + (COLS + ROWS) * IH / 2 + CLIFF + 12, OX = ROWS * IT / 2;
    const g2 = cv.getContext('2d'), lamps = [], t0 = performance.now();
    let K = 1, DPR = 1, last = 0;
    const E = { P: (u, v, z) => [OX + (u - v) * IT / 2, TOP + (u + v) * IH / 2 - (z || 0)], cols: COLS, rows: ROWS, top: TOP, cliff: CLIFF, w: AW, h: AH, night: true, t: 0,
      lamp: (x, y, r, c) => lamps.push({ x, y, r, c: c || '#ffcf7a' }), chimney: () => {} };
    const paths = new Set(); for (let u = 4; u < 22; u++) paths.add(u + ',14'); for (let v = 3; v < 14; v++) paths.add('4,' + v);
    const PLACED = [
      ['house', 0, 0, 4, 3], ['stall', 22, 0, 3, 2], ['mail', 4, 1, 1, 1], ['board', 5, 0, 1, 1], ['coop', 0, 4, 2, 2], ['pethouse', 2, 4, 1, 1], ['well', 6, 3, 1, 1], ['hive', 7, 1, 1, 1],
      ['greenhouse', 16, 1, 4, 3], ['barn', 20, 4, 3, 3], ['scarecrow', 12, 9, 1, 1], ['pasture', 15, 15, 6, 4], ['fountain', 9, 4, 2, 2], ['statue', 12, 1, 1, 2], ['lantern', 5, 13, 1, 1],
      ['bench', 8, 12, 2, 1], ['swing', 1, 9, 2, 2], ['arch', 10, 15, 2, 1], ['sandbox', 6, 16, 2, 2], ['firepit', 13, 12, 1, 1], ['sign', 3, 3, 1, 1], ['clothesline', 1, 13, 2, 1],
      ['flowerbed', 9, 9, 2, 1], ['birdhouse', 14, 4, 1, 1], ['flag', 24, 3, 1, 1], ['wagon', 18, 12, 2, 1], ['windmill', 23, 9, 2, 2], ['igloo', 1, 16, 2, 2], ['sled', 10, 18, 2, 1], ['icefish', 14, 9, 1, 1],
    ].concat(opts.set === 'memory' ? [['lighthouse', 8, 1, 1, 1], ['palm', 10, 1, 1, 1], ['anchor', 13, 6, 1, 1], ['boat', 16, 9, 2, 1], ['parasol', 12, 11, 1, 1], ['cairn', 20, 10, 1, 1], ['waterfall', 2, 6, 2, 2], ['woodpile', 6, 10, 2, 1],
      ['milkcans', 22, 13, 1, 1], ['alphorn', 17, 17, 2, 1], ['balloon', 23, 15, 2, 2], ['skybridge', 13, 17, 2, 1], ['shishi', 3, 15, 1, 1], ['koinobori', 25, 7, 1, 1], ['toro', 8, 18, 1, 1]] : [])
      .filter((a, i, all) => opts.set !== 'memory' || i >= all.length - 15 || ['house', 'stall'].includes(a[0]))
      .map(a => ({ id: a[0], b: { x: a[1], y: a[2], w: a[3], h: a[4] } }));
    const FLOORS = [['pond', { x: 6, y: 6, w: 4, h: 3 }], ['path', { x: 12, y: 6, w: 3, h: 1 }], ['pasture', { x: 15, y: 15, w: 6, h: 4 }]];
    const NODES = [['tree', 0, 7], ['tree', 3, 7], ['tree', 0, 18], ['tree', 4, 18], ['tree', 25, 13], ['tree', 25, 17], ['tree', 22, 18], ['rock', 21, 10], ['rock', 12, 3], ['bush', 3, 11], ['bush', 24, 15], ['snow', 8, 15]];
    const busy = (u, v) => PLACED.some(o => u >= o.b.x && u < o.b.x + o.b.w && v >= o.b.y && v < o.b.y + o.b.h);
    function layout(){
      const r = cv.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
      DPR = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
      K = Math.min(w / AW, h / AH);
    }
    function draw(){
      E.night = opts.tod ? opts.tod === 'night' : ((h => h < 6 || h >= 18.5)(new Date().getHours()));
      E.t = STILL ? 0 : (performance.now() - t0) / 1000; lamps.length = 0;
      const r = cv.getBoundingClientRect();
      g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillStyle = look(E).sea[1]; g2.fillRect(0, 0, cv.width, cv.height);
      g2.setTransform(DPR * K, 0, 0, DPR * K, (r.width - AW * K) / 2 * DPR, (r.height - AH * K) / 2 * DPR);
      backdrop(g2, E);
      island(g2, E, paths, busy);
      sparkle(g2, E);
      FLOORS.forEach(([id, b]) => floor(g2, E, id, b));
      const cast = PLACED.map(o => ({ d: o.id === 'pasture' ? o.b.x + o.b.y + 0.3 : o.b.x + o.b.w / 2 + o.b.y + o.b.h / 2, go: () => {
        if (o.id === 'stall'){ thing(g2, E, 'stall', o.b, E.night, 'back'); thing(g2, E, 'stall', o.b, E.night, 'front'); } else thing(g2, E, o.id, o.b, E.night);
        live(g2, E, o.id, o.b);
      } }));
      NODES.forEach(([k, x, y], i) => cast.push({ d: x + y + 1, go: () => node(g2, E, k, x, y, true, i) }));
      { const u = 6 + (E.t * 0.8) % 14, fr = 1 + Math.floor(E.t * 6) % 4; cast.push({ d: u + 14.5, go: () => { const p = E.P(u, 14.5); kid(g2, 'sua', p[0], p[1], 'SE', fr, 46); } }); }   // 걸어가는 수아 — 다리 흔들기 시험
      cast.push({ d: 26, go: () => { const p = E.P(11.6, 14.4); kid(g2, 'yona', p[0], p[1], 'S', 0, 42); } });
      cast.sort((a, b) => a.d - b.d).forEach(c => c.go());
      fence(g2, E, 15, 19, 21, 19); fence(g2, E, 21, 15, 21, 19);
      if (E.night){ g2.save(); g2.globalCompositeOperation = 'lighter'; lamps.forEach(l => { const gr = g2.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, l.c + '80'); gr.addColorStop(0.45, l.c + '30'); gr.addColorStop(1, l.c + '00'); g2.fillStyle = gr; g2.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }); g2.restore(); }
      snowfall(g2, E);
    }
    function loop(now){ requestAnimationFrame(loop); if (now - last < 50) return; last = now; draw(); }
    layout(); window.addEventListener('resize', layout);
    requestAnimationFrame(loop);
  }

  window.FARMHD = { backdrop, island, sparkle, node, thing, floor, live, fence, kid, snowfall, has, hasLive, look, mount };
})();
