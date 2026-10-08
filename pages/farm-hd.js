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
  /* 사막 오아시스(스테이지2 둘째, 2026-10-09 로키즈 시안 ①) — 모로코·사하라. 낮은 금빛 모래, 밤은 보랏빛 하늘과 은하수.
     drift(눈 모자)는 투명이라 오로라 그림 곳곳의 눈이 저절로 사라진다. dry: 지붕 눈도 안 얹는다 */
  const LOOK_DESERT = {
    night: { sky: ['#0a0c2a', '#1b1f55', '#3a3373', '#7a4f7c'], star: true, aurora: 0, moon: true, dry: true,
      far: '#3a3058', far2: '#5a4a6c', snowcap: 'rgba(0,0,0,0)', sea: ['#4e4260', '#2a2240'], floe: ['#5a4a6c', '#43385a'],
      snow: ['#8a7a8e', '#6c5f7a'], snowHi: 'rgba(255,230,200,.07)', snowLo: 'rgba(20,10,40,.12)', drift: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
      cliff: ['#7a5a6a', '#6a4c60', '#583e54', '#443048'], stone: ['#8a5a62', '#7e525c', '#94646a', '#744a56'],
      fir: ['#2f5a3a', '#244a30', '#1a3a26'], firSnow: ['#4a7a4a', '#3a6a3a'], frost: ['#6a8a5a', '#5a7a4a', '#8aa070'], trunk: ['#6a5048', '#4a3830'],
      glow: 1, haze: 'rgba(90,60,120,', shadow: 'rgba(20,10,40,.32)', win: '#ffd98a', ice: ['#2a4a7a', '#163058', '#a0b8e0'], sand: ['#8a7a8e', '#6c5f7a'] },
    day: { sky: ['#3d8bd8', '#78b6e6', '#cfe2e8', '#f6e2bc'], star: false, aurora: 0, moon: false, dry: true,
      far: '#e6b878', far2: '#efc07e', snowcap: 'rgba(0,0,0,0)', sea: ['#eac58c', '#d9a064'], floe: ['#efc07e', '#dba062'],
      snow: ['#f2d49c', '#e4b97c'], snowHi: 'rgba(255,248,220,.3)', snowLo: 'rgba(180,110,50,.09)', drift: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
      cliff: ['#dca062', '#c98850', '#ae6c3e', '#8e5432'], stone: ['#d98a5e', '#cc7a52', '#e49e72', '#c06c4a'],
      fir: ['#4a8a4a', '#3a7a3e', '#2a6030'], firSnow: ['#6ab05a', '#4a9048'], frost: ['#8ab86a', '#6aa058', '#b0d088'], trunk: ['#8a6040', '#6a4630'],
      glow: 0, haze: 'rgba(250,230,190,', shadow: 'rgba(120,70,30,.22)', win: '#5a86b0', ice: ['#4ad0d0', '#1e8fb0', '#ffffff'], sand: ['#f2d49c', '#e4b97c'] },
  };
  const look = E => (E.farm === 'desert' ? LOOK_DESERT : LOOK)[E.night ? 'night' : 'day'];
  const rgb = c => { const v = parseInt(c.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  function mix(a, b, k){ const A = rgb(a), B = rgb(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join(''); }
  const shade = (c, k) => c[0] !== '#' ? c : k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k);
  const toneMemo = {};
  // 밤 누르기 — 오로라는 쪽빛, 사막은 보랏빛 밤
  const tone = (E, c) => { if (!E.night || c[0] !== '#') return c; const k = (E.farm === 'desert' ? 'd' : '') + c; return toneMemo[k] || (toneMemo[k] = mix(c, E.farm === 'desert' ? '#1d1a4e' : '#14204a', 0.48)); };

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
    const snowOn = o.snow !== false && !Lk.dry;
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
  // 작은 지붕(게시판·우물·새집) — 고드름 없이 보이는 비탈 윗부분만 눈으로 덮는다(사막은 drift 가 투명이라 안 보인다)
  function smallRoof(E, G, o){
    roof(E, G, Object.assign({ snow: false }, o));
    const e = o.eave || 0.25, H = G.H, Hr = H + o.rise, s = look(E).drift[0], f = 0.55, zf = Hr - (Hr - H + 1) * f + 0.5;
    if (o.ridge === 'u'){ const vm = (G.v0 + G.v1) / 2, vf = vm + (G.v1 + e - vm) * f; poly3([[G.u0 - e, vm, Hr + 0.7], [G.u1 + e, vm, Hr + 0.7], [G.u1 + e, vf, zf], [G.u0 - e, vf, zf]], s); }
    else { const um = (G.u0 + G.u1) / 2, uf = um + (G.u1 + e - um) * f; poly3([[um, G.v0 - e, Hr + 0.7], [um, G.v1 + e, Hr + 0.7], [uf, G.v1 + e, zf], [uf, G.v0 - e, zf]], s); }
  }
  // 바닥 그림자 — 발밑 타원(칸 단위)
  function foot(E, u, v, ru, rv){ const c = q(u, v, 0), r = q(u + ru, v, 0), d = q(u, v + rv, 0); g.save(); g.translate(c[0] + 1.5, c[1] + 1); g.beginPath(); g.ellipse(0, 0, Math.hypot(r[0] - c[0], r[1] - c[1]) * 1.1 + 2, Math.abs(d[1] - c[1]) + 2, 0, 0, TAU); g.fillStyle = look(E).shadow; g.fill(); g.restore(); }
  function footBox(E, G){ poly3([[G.u0 + 0.1, G.v0 + 0.15, 0], [G.u1 + 0.32, G.v0 + 0.15, 0], [G.u1 + 0.32, G.v1 + 0.3, 0], [G.u0 + 0.1, G.v1 + 0.3, 0]], look(E).shadow); }
  const geo = (b, ins, H) => ({ u0: b.x + ins, v0: b.y + ins, u1: b.x + b.w - ins, v1: b.y + b.h - ins, H });
  // 기둥 하나(둥근 막대)
  function post(E, u, v, z0, z1, col, r){ const a = q(u, v, z0), b = q(u, v, z1); r = r || 1.1; R(a[0] - r, b[1], r * 2, a[1] - b[1], tone(E, col)); R(a[0] - r, b[1], r * 0.7, a[1] - b[1], tone(E, shade(col, 0.25))); g.strokeStyle = INK; g.lineWidth = 0.5; g.strokeRect(a[0] - r, b[1], r * 2, a[1] - b[1]); }
  // 세운 판 — o(도트) 를 축으로 화면을 기울여, 안에서 그린 납작한 그림이 u 축(앞면) 또는 v 축(오른쪽 면)을 따라 서게 한다
  function upright(o, axis, fn){
    const a = q(0, 0, 0), b = axis === 'u' ? q(1, 0, 0) : q(0, 1, 0), k = (b[1] - a[1]) / (b[0] - a[0]);
    g.save(); g.translate(o[0], o[1]); g.transform(1, k, 0, 1, 0, 0); g.translate(-o[0], -o[1]); fn(); g.restore();
  }
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
    if (E.farm === 'desert') return desertBackdrop(E);
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
    if (E.farm === 'desert') return desertIsland(E, paths, busy);
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
    if (E.farm === 'desert'){ if (E.night) for (let i = 0; i < 30; i++){ const p = q(hash(i * 7 + 2) * E.cols, hash(i * 3 + 8) * E.rows, 0), a = Math.max(0, Math.sin(E.t * (1 + hash(i) * 2) + i * 2.3)); if (a > 0.7) R(p[0], p[1], 1, 1, 'rgba(255,230,180,' + ((a - 0.7) * 3).toFixed(2) + ')'); } return; }
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
    if (E.farm === 'desert') return desertNode(E, kind, p[0], p[1], ready, seed);
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
      post(E, u0 + 0.05, v0 + 0.1, 0, 78, WOOD); post(E, u1 - 0.05, v0 + 0.1, 0, 78, WOOD);
      return;
    }
    post(E, u0 + 0.05, v1 - 0.1, 0, 71, WOOD); post(E, u1 - 0.05, v1 - 0.1, 0, 71, WOOD);
    box(u0 + 0.1, v1 - 0.55, u1 - 0.1, v1 - 0.1, 0, 12, tone(E, '#b07a50'));
    for (let a = 0.2; a < u1 - u0 - 0.2; a += 0.25) line(q(u0 + 0.1 + a, v1 - 0.1, 0.5), q(u0 + 0.1 + a, v1 - 0.1, 11.5), 'rgba(60,30,10,.35)', 0.4);
    [[0.35, '#e8a040'], [0.95, '#d9533e'], [1.55, '#8fbf6a']].forEach(([a, c]) => {
      if (u0 + a > u1 - 0.3) return;
      box(u0 + a, v1 - 0.5, u0 + a + 0.4, v1 - 0.2, 12, 15, tone(E, '#8a5a3c'));
      const p = q(u0 + a + 0.2, v1 - 0.35, 15.5); for (let k = -1; k <= 1; k++) oval(p[0] + k * 2.2, p[1] - 0.6, 1.4, 1.2, tone(E, c));
    });
    // 차양 — 앞으로 기운 줄무늬 천, 끝은 물결. 아저씨(키 54)가 안에 서도 머리가 안 가리게 높이 단다(2026-10-09)
    // 2026-10-09 로키즈 「털모자 아저씨 얼굴 보이게 차양을 반만 걷어」 — 차양은 뒤쪽 절반만 펴고, 앞 끝은 둘둘 말아 올린 천 뭉치
    // 2026-10-09 도트 아저씨로 바꾼 뒤 「기둥부분이 어색」 — 반만 펴면 앞 기둥 끝이 허공에 떴다. 다 펴서 앞 기둥 위에 얹고,
    // 비스듬히 내려다보는 눈에 아저씨 얼굴이 안 가리게 기둥째 높인다(앞 71 · 뒤 78)
    const n = 8, zt = 79, va = v0 - 0.05, vb = v1 + 0.3, zb = 72;
    for (let i = 0; i < n; i++){
      const a0 = u0 - 0.15 + (u1 - u0 + 0.3) * i / n, a1 = u0 - 0.15 + (u1 - u0 + 0.3) * (i + 1) / n;
      poly3([[a0, va, zt], [a1, va, zt], [a1, vb, zb], [a0, vb, zb]], tone(E, i % 2 ? TRIM : '#d9433e'));
    }
    poly3([[u0 - 0.15, va, zt], [u1 + 0.15, va, zt], [u1 + 0.15, vb, zb], [u0 - 0.15, vb, zb]], null, true);
    { const a = q(u0 - 0.15, vb, zb - 1.6), c = q(u1 + 0.15, vb, zb - 1.6);                    // 말아 올린 천 — 줄무늬 원통
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 4.6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke();
      for (let i = 0; i < n; i++){ const f0 = i / n, f1 = (i + 1) / n; g.strokeStyle = tone(E, i % 2 ? TRIM : '#d9433e'); g.lineWidth = 3.6; g.lineCap = 'butt'; g.beginPath(); g.moveTo(a[0] + (c[0] - a[0]) * f0, a[1] + (c[1] - a[1]) * f0); g.lineTo(a[0] + (c[0] - a[0]) * f1, a[1] + (c[1] - a[1]) * f1); g.stroke(); }
      line([a[0], a[1] - 1], [c[0], c[1] - 1], 'rgba(255,255,255,.35)', 0.7);
      [0.2, 0.8].forEach(f => { const x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f; line([x, y - 2.4], [x, y + 2.4], tone(E, '#8a5a3c'), 0.8); });   // 묶은 끈
    }
    poly3([[u0 - 0.1, va, zt + 1], [u1 + 0.1, va, zt + 1], [u1 + 0.1, va + (vb - va) * 0.7, zt - 1.5], [u0 - 0.1, va + (vb - va) * 0.7, zt - 1.5]], look(E).drift[0]);
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
  // 우물 — 돌 둥근 통, 두 기둥 위 박공지붕, 도르래와 두레박
  B.well = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.5, c = q(cu, cv, 0), L = look(E), top = c[1] - 9;
    oval(c[0] + 2, c[1] + 1, 13, 6, L.shadow);
    oval(c[0], c[1], 10, 5, tone(E, '#6c7282')); R(c[0] - 10, top, 20, 9, vgrad(top, c[1], [tone(E, '#9aa0ae'), tone(E, '#6c7282')]));
    for (let k = 0; k < 3; k++){ g.strokeStyle = 'rgba(0,0,30,.25)'; g.lineWidth = 0.4; g.beginPath(); g.ellipse(c[0], top + 3 * k + 2, 10, 5, 0, 0.15, Math.PI - 0.15); g.stroke(); }
    oval(c[0], top, 10, 5, tone(E, '#b0b6c2')); oval(c[0], top, 7.5, 3.6, E.night ? '#0a1430' : '#2a4a6a');
    g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.ellipse(c[0], top, 10, 5, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(c[0], c[1], 10, 5, 0, 0, Math.PI); g.moveTo(c[0] - 10, top); g.lineTo(c[0] - 10, c[1]); g.moveTo(c[0] + 10, top); g.lineTo(c[0] + 10, c[1]); g.stroke();
    box(cu - 0.33, cv - 0.035, cu - 0.26, cv + 0.035, 9, 28, tone(E, WOOD));
    const a = q(cu - 0.3, cv, 22), d = q(cu + 0.3, cv, 22), m = q(cu, cv, 22);
    line(a, d, tone(E, '#5a4034'), 1.2); oval(m[0], m[1], 1.8, 1.8, tone(E, '#3a3f52'));
    const bk = q(cu, cv, 14); line(m, [bk[0], bk[1] - 2], tone(E, '#d8c8a0'), 0.4);
    box(cu - 0.06, cv - 0.06, cu + 0.06, cv + 0.06, 12, 15, tone(E, WOOD));
    box(cu + 0.26, cv - 0.035, cu + 0.33, cv + 0.035, 9, 28, tone(E, WOOD));
    smallRoof(E, { u0: cu - 0.42, v0: cv - 0.22, u1: cu + 0.42, v1: cv + 0.22, H: 28 }, { ridge: 'u', rise: 6, col: ROOF, gable: WOOD, eave: 0.03 });
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
  // 허수아비 — 기둥·가로대에 입힌 셔츠(상자), 둥근 짚 머리, 털모자(사막은 쪽빛 터번)
  B.scarecrow = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.55, L = look(E), shirt = tone(E, '#3f6ea0'), wood = tone(E, WOOD), straw = tone(E, '#e8c860'), yel = tone(E, '#f2c040');
    foot(E, cu, cv, 0.38, 0.15);
    box(cu - 0.035, cv - 0.035, cu + 0.035, cv + 0.035, 0, 29, wood);                 // 기둥
    box(cu - 0.45, cv - 0.025, cu + 0.45, cv + 0.025, 20, 21.4, wood);                // 가로대 — u 를 따라
    [-0.42, 0.42].forEach(du => { const s = q(cu + du, cv, 19.5); for (let i = -2; i <= 2; i++) line(s, [s[0] + du * 6 + i * 0.6, s[1] + 2.6 + Math.abs(i) * 0.4], straw, 0.6); });
    box(cu - 0.4, cv - 0.07, cu - 0.19, cv + 0.07, 17.5, 22.5, shirt);              // 왼소매
    const T = { u0: cu - 0.19, v0: cv - 0.1, u1: cu + 0.19, v1: cv + 0.1 };
    for (let i = 0; i < 6; i++){ const s = q(T.u0 + 0.04 + i * 0.06, T.v1, 8.5); line(s, [s[0] + (i % 2 ? 0.6 : -0.6), s[1] + 3], straw, 0.6); }
    box(T.u0, T.v0, T.u1, T.v1, 8, 23, shirt);                                        // 몸통
    onFace(T, 'L', 0.06, 0.15, 11, 14.5, tone(E, '#c8a868'), 0.3);                    // 덧댄 천
    line(q(T.u0, T.v1, 11.5), q(T.u1, T.v1, 11.5), tone(E, '#c8a868'), 0.8); line(q(T.u1, T.v1, 11.5), q(T.u1, T.v0, 11.5), tone(E, '#a88848'), 0.8);   // 새끼줄 허리띠
    box(cu + 0.19, cv - 0.07, cu + 0.4, cv + 0.07, 17.5, 22.5, shirt);              // 오른소매
    box(cu - 0.12, cv - 0.08, cu + 0.12, cv + 0.08, 22.5, 25, yel);                  // 목도리
    onFace({ u0: cu - 0.12, v1: cv + 0.08 }, 'L', 0.14, 0.2, 16.5, 23, yel, 0.3);
    const h = q(cu, cv, 30), hx = h[0], hy = h[1];
    const gr = g.createRadialGradient(hx - 2, hy - 2, 0.5, hx, hy, 6); gr.addColorStop(0, tone(E, '#f4e2b4')); gr.addColorStop(1, tone(E, '#c8aa70'));
    g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 5.5, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    const f = [hx - 1.6, hy + 1];                                                    // 얼굴은 앞(v 쪽, 화면 왼쪽 아래)을 본다
    oval(f[0] - 1.7, f[1] - 1.6, 0.8, 0.8, '#2a2020'); oval(f[0] + 1.5, f[1] - 0.4, 0.8, 0.8, '#2a2020');
    g.strokeStyle = '#2a2020'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(f[0] - 1.8, f[1] + 0.6); g.quadraticCurveTo(f[0] - 0.2, f[1] + 2.2, f[0] + 1.4, f[1] + 1.4); g.stroke();
    if (E.farm === 'desert'){                                                        // 사막 — 쪽빛 터번
      oval(hx, hy - 3.6, 6.4, 3.2, tone(E, '#2f4f9a')); oval(hx - 0.6, hy - 5.4, 5, 2.6, tone(E, '#3f62b0')); oval(hx - 0.3, hy - 7, 3.2, 1.6, tone(E, '#4a72c4'));
      line([hx - 5, hy - 3], [hx + 5, hy - 5.6], tone(E, '#22386e'), 0.6); line([hx + 5.4, hy - 3], [hx + 7, hy + 3], tone(E, '#2f4f9a'), 1.6);
    } else {
      const red = tone(E, '#d9433e');
      poly([[hx - 4.6, hy - 4], [hx + 4.6, hy - 4], [hx + 1.4, hy - 11.5], [hx - 0.6, hy - 12]], lin(hx - 4, 0, hx + 4, 0, [shade(red, 0.12), shade(red, -0.2)]), true);
      oval(hx, hy - 4, 6.4, 2.6, tone(E, TRIM)); g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.ellipse(hx, hy - 4, 6.4, 2.6, 0, 0, TAU); g.stroke();
      oval(hx + 0.4, hy - 12.4, 2, 2, tone(E, TRIM));
    }
    [-0.3, 0.3].forEach(du => { const s = q(cu + du, cv, 22.6); oval(s[0], s[1], 2.8, 1.2, L.drift[0]); });
  };
  // 우편함 — 둥근 지붕 빨간 통(앞이 v 쪽), 옆에 노란 깃, 나무 기둥
  B.mail = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.55, L = look(E), red = tone(E, '#d9433e');
    foot(E, cu, cv, 0.18, 0.28);
    box(cu - 0.035, cv - 0.035, cu + 0.035, cv + 0.035, 0, 15, tone(E, WOOD));
    const u0 = cu - 0.12, u1 = cu + 0.12, v0 = cv - 0.26, v1 = cv + 0.2, z0 = 15, z1 = 19.5, r = (u1 - u0) / 2;
    const arc = v => { const pts = []; for (let i = 0; i <= 10; i++){ const a = Math.PI * i / 10; pts.push(q(cu - Math.cos(a) * r, v, z1 + Math.sin(a) * 4)); } return pts; };
    box(u0, v0, u1, v1, z0, z1, red, { top: false });
    const back = arc(v0), front = arc(v1), t0 = q(cu, v0, z1 + 4), t1 = q(cu, v1, z1 + 4);
    path(back.concat(front.slice().reverse())); g.fillStyle = lin(t0[0], t0[1], t0[0] + 6, t0[1] + 4, [shade(red, 0.18), shade(red, -0.12)]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    path(front.concat([q(u1, v1, z0), q(u0, v1, z0)])); g.fillStyle = shade(red, 0.04); g.fill(); g.stroke();
    path(front.slice(2, 9).map(p => [p[0], p[1] + 1.2]).concat([q(u1 - 0.04, v1, z0 + 1.2), q(u0 + 0.04, v1, z0 + 1.2)])); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.4; g.stroke();   // 앞 뚜껑 금
    const k = q(cu, v1, z1 - 0.5); oval(k[0], k[1], 0.8, 0.8, tone(E, '#f2c040'));
    box(u1, v0 + 0.08, u1 + 0.02, v0 + 0.11, z0 + 1, z1 + 6, tone(E, '#f2c040'));
    box(u1, v0 + 0.11, u1 + 0.02, v0 + 0.25, z1 + 3, z1 + 6, tone(E, '#f2c040'));
    g.strokeStyle = L.drift[0]; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(t0[0], t0[1] - 0.6); g.lineTo(t1[0], t1[1] - 0.6); g.stroke();
  };
  // 게시판 — 두 기둥 사이 나무판(앞이 v 쪽)에 쪽지, 위에 작은 박공지붕
  B.board = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.55, wood = tone(E, WOOD);
    foot(E, cu, cv, 0.45, 0.15);
    [cu - 0.38, cu + 0.38].forEach(u => box(u - 0.035, cv - 0.035, u + 0.035, cv + 0.035, 0, 23, wood));
    const G = { u0: cu - 0.35, v0: cv - 0.03, u1: cu + 0.35, v1: cv + 0.03 };
    box(G.u0, G.v0, G.u1, G.v1, 9, 21, tone(E, '#c08a5c'));
    [['#fff6c8', 0.05, 16.4, 0.18], ['#ffd8e0', 0.27, 16.9, 0.16], ['#d8ecff', 0.47, 16.2, 0.17], ['#e0f4d8', 0.1, 10.6, 0.19], ['#fff6c8', 0.38, 11, 0.2]].forEach(([c, a, z, w]) => {
      onFace(G, 'L', a, a + w, z, z + 3.8, tone(E, c), 0.3);
      for (let l = 0; l < 2; l++) line(faceAt(G, 'L', a + 0.03, z + 1.2 + l * 1.2), faceAt(G, 'L', a + w - 0.04, z + 1.2 + l * 1.2), 'rgba(80,60,50,.4)', 0.3);
      const pin = faceAt(G, 'L', a + w / 2, z + 3.3); oval(pin[0], pin[1], 0.7, 0.7, '#d9433e');
    });
    smallRoof(E, { u0: cu - 0.44, v0: cv - 0.1, u1: cu + 0.44, v1: cv + 0.1, H: 23 }, { ridge: 'u', rise: 4, col: ROOF, gable: WOOD, eave: 0.03 });
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
    const star = (dx, dy, fill) => { g.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + dx + Math.cos(a) * rr, cy + dy + Math.sin(a) * rr); } g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke(); };
    const th = q(0, -0.12, 0), o = q(0, 0, 0);                                    // 두께 — v 뒤쪽으로 한 겹
    upright([x, cy], 'u', () => { star(th[0] - o[0], th[1] - o[1], L.ice[1]); star(0, 0, lin(x - r, cy - r, x + r, cy + r, [L.ice[2], L.ice[0], L.ice[1]])); oval(x - 3, cy - 4, 2.4, 1.4, 'rgba(255,255,255,.8)'); });
    if (E.night) E.lamp(x, cy, 30, '#9fe6ff');
  };
  // 등불 — 쇠 가로등, 위에 눈
  D.lantern = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 7, 2.4, L.shadow);
    const cu = b.x + 0.5, cv = b.y + 0.6, iron = tone(E, '#2f3446'), glass = E.night ? '#ffe7a4' : '#e9eef6';
    box(cu - 0.13, cv - 0.13, cu + 0.13, cv + 0.13, 0, 3, tone(E, '#3a3f52'));
    post(E, cu, cv, 3, 30, '#454b60', 1.2);
    const G = { u0: cu - 0.11, v0: cv - 0.11, u1: cu + 0.11, v1: cv + 0.11 };
    box(G.u0, G.v0, G.u1, G.v1, 29, 30.5, iron);
    box(G.u0, G.v0, G.u1, G.v1, 30.5, 39, iron, { top: false });
    onFace(G, 'L', 0.03, 0.19, 31.5, 38, glass); onFace(G, 'R', 0.03, 0.19, 31.5, 38, E.night ? glass : '#c8d0dc');
    const ap = [cu, cv, 44.5], e = 0.04;
    poly3([[G.u0 - e, G.v1 + e, 39], [G.u1 + e, G.v1 + e, 39], ap], tone(E, '#3a4058'), true);
    poly3([[G.u1 + e, G.v1 + e, 39], [G.u1 + e, G.v0 - e, 39], ap], tone(E, '#22263a'), true);
    const tp = q(cu, cv, 42); oval(tp[0], tp[1], 3.6, 1.4, L.drift[0]);
    if (E.night){ const c = q(cu, cv, 35); E.lamp(c[0], c[1], 44, '#ffcf7a'); }
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
  // 농장 팻말 — 기둥 앞에 화살표 나무판(앞이 v 쪽), 글씨는 판에 붙여 쓴다
  D.sign = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.55, L = look(E), plank = tone(E, '#c08a5c');
    foot(E, cu, cv, 0.32, 0.12);
    box(cu - 0.035, cv - 0.035, cu + 0.035, cv + 0.035, 0, 23, tone(E, WOOD));
    const u0 = cu - 0.46, u1 = cu + 0.3, tip = cu + 0.43, v0 = cv + 0.035, v1 = cv + 0.09, zb = 14.5, zt = 21.5, zm = (zb + zt) / 2;
    poly3([[u1, v0, zb], [tip, v0, zm], [tip, v1, zm], [u1, v1, zb]], shade(plank, -0.3), true);
    poly3([[u0, v0, zt], [u1, v0, zt], [tip, v0, zm], [tip, v1, zm], [u1, v1, zt], [u0, v1, zt]], shade(plank, 0.18), true);
    const a = q(u0, v1, zt), c = q(u0, v1, zb);
    poly3([[u0, v1, zb], [u1, v1, zb], [tip, v1, zm], [u1, v1, zt], [u0, v1, zt]], vgrad(a[1], c[1], [shade(plank, 0.06), shade(plank, -0.1)]), true);
    for (let k = 1; k < 3; k++) line(q(u0 + 0.02, v1, zb + k * 2.4), q(u1, v1, zb + k * 2.4), 'rgba(90,50,30,.22)', 0.3);
    const o = q((u0 + u1) / 2 + 0.02, v1, zm + 0.2);
    upright(o, 'u', () => { g.fillStyle = tone(E, '#4a2c20'); g.font = '700 3.6px "Suayona Sans", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('수아연아', o[0], o[1]); });
    poly3([[u0 + 0.02, v0, zt + 0.4], [u1, v0, zt + 0.4], [u1, v1, zt + 0.4], [u0 + 0.02, v1, zt + 0.4]], L.drift[0]);
  };
  // 빨랫줄 — 두 기둥 사이 털옷·벙어리장갑·목도리
  D.clothesline = (E, b) => {
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, v = b.y + 0.5, L = look(E);
    [u0, u1].forEach(u => post(E, u, v, 0, 26, WOOD, 0.8));
    const a = q(u0, v, 25), c = q(u1, v, 25), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 3];
    g.strokeStyle = 'rgba(230,230,230,.8)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], c[0], c[1]); g.stroke();
    [[0.22, '#d9433e', 0], [0.48, '#3f6ea0', 1], [0.7, '#f2c040', 2]].forEach(([f, col, k]) => {
      const x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f + Math.sin(f * Math.PI) * 3;
      upright([x, y], 'u', () => {
      if (k === 0){ poly([[x - 4, y], [x + 4, y], [x + 6, y + 3], [x + 4, y + 3.5], [x + 3.4, y + 9], [x - 3.4, y + 9], [x - 4, y + 3.5], [x - 6, y + 3]], tone(E, col), true); R(x - 3.4, y + 5, 6.8, 1, tone(E, TRIM)); }
      else if (k === 1) [-2.2, 2.2].forEach(dx => { oval(x + dx, y + 3.4, 1.8, 3, tone(E, col)); oval(x + dx + 1.6, y + 2, 0.8, 1.2, tone(E, col)); });
      else { R(x - 1.5, y, 3, 11, tone(E, col)); for (let k2 = 0; k2 < 3; k2++) R(x - 1.5, y + 2 + k2 * 3, 3, 0.8, tone(E, '#d9433e')); }
      });
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
  // 새집 — 기둥 위 작은 상자 집(박공이 앞 v 쪽), 동그란 구멍과 횃대, 노란 박새
  D.birdhouse = (E, b) => {
    const cu = b.x + 0.5, cv = b.y + 0.55;
    foot(E, cu, cv, 0.2, 0.12);
    box(cu - 0.035, cv - 0.035, cu + 0.035, cv + 0.035, 0, 24, tone(E, WOOD));
    box(cu - 0.2, cv - 0.18, cu + 0.2, cv + 0.18, 23, 24, tone(E, WOOD));
    const G = { u0: cu - 0.15, v0: cv - 0.14, u1: cu + 0.15, v1: cv + 0.14, H: 32 };
    box(G.u0, G.v0, G.u1, G.v1, 24, 32, tone(E, '#c08a5c'), { top: false });
    smallRoof(E, G, { ridge: 'v', rise: 5, col: FALU, gable: '#c08a5c', eave: 0.05 });
    const h = faceAt(G, 'L', 0.15, 29.5); oval(h[0], h[1], 1.6, 1.6, '#2a1c18');
    const p0 = faceAt(G, 'L', 0.15, 26.5), p1 = q(cu, G.v1 + 0.12, 26.5); line(p0, p1, tone(E, '#5a4034'), 0.8);
    const s = q(G.u1 + 0.06, cv + 0.05, 24);                                       // 받침판 모서리에 앉은 박새
    oval(s[0], s[1] - 1.6, 2.4, 1.8, tone(E, '#f2c040')); oval(s[0] - 1.6, s[1] - 2.9, 1.4, 1.3, '#2a2a3a'); oval(s[0] - 1.9, s[1] - 3.1, 0.35, 0.35, '#ffffff');
    line([s[0] + 2, s[1] - 1.6], [s[0] + 3.6, s[1] - 2.4], tone(E, '#6a7a8a'), 0.8);
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
    const dz = E.farm === 'desert';                                       // 사막은 사프란 바탕에 쪽빛 띠 하나(십자 없음)
    upright([x, y], 'u', () => {
    path(top.concat(bot.reverse())); g.fillStyle = tone(E, dz ? '#e8a030' : '#3f6ea0'); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.5; g.stroke();
    g.strokeStyle = tone(E, dz ? '#2f4f9a' : '#f2c040'); g.lineWidth = dz ? 2.4 : 1.8; g.beginPath();
    for (let i = 0; i <= 8; i++){ const pp = at(i / 8, 0.5); if (i) g.lineTo(pp[0], pp[1]); else g.moveTo(pp[0], pp[1]); }
    if (!dz){ const s0 = at(0.32, 0), s1 = at(0.32, 1); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); } g.stroke();
    });
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
  // ---- 둥근 탑(아이소) — 2026-10-09 로키즈 「풍차·등대가 아이소메트릭이 아닌 듯」. 밑면·윗면이 타원(가로:세로 2:1), 왼쪽이 밝고 오른쪽이 그늘 ----
  // (x, y) = 밑면 가운데, r0·r1 = 밑·위 반지름, h = 높이(도트). bands = [[z0, z1, 빛깔]] 둥글게 휜 띠
  const rAt = (r0, r1, h, z) => r0 + (r1 - r0) * z / h;
  function towerPath(x, y, r0, r1, h){ g.beginPath(); g.moveTo(x - r0, y); g.ellipse(x, y, r0, r0 / 2, 0, Math.PI, 0, true); g.lineTo(x + r1, y - h); g.ellipse(x, y - h, r1, r1 / 2, 0, 0, -Math.PI, true); g.closePath(); }
  function tower(E, x, y, r0, r1, h, col, bands){
    towerPath(x, y, r0, r1, h); g.fillStyle = lin(x - r0, 0, x + r0, 0, [shade(col, 0.12), col, shade(col, -0.18), shade(col, -0.34)]); g.fill();
    if (bands){ g.save(); towerPath(x, y, r0, r1, h); g.clip(); bands.forEach(([z0, z1, c]) => {
      const a = rAt(r0, r1, h, z0), b2 = rAt(r0, r1, h, z1);
      g.beginPath(); g.moveTo(x - a, y - z0); g.ellipse(x, y - z0, a, a / 2, 0, Math.PI, 0, true); g.lineTo(x + b2, y - z1); g.ellipse(x, y - z1, b2, b2 / 2, 0, 0, Math.PI, false); g.closePath();
      g.fillStyle = lin(x - r0, 0, x + r0, 0, [shade(c, 0.1), c, shade(c, -0.2), shade(c, -0.36)]); g.fill(); }); g.restore(); }
    towerPath(x, y, r0, r1, h); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
  }
  // 탑 앞면(보는 쪽으로 조금 오른쪽) 위의 점 — 문·창을 타원 둘레에 붙인다. f = -1(왼 끝)~1(오른 끝)
  const onTower = (x, y, r0, r1, h, z, f) => { const r = rAt(r0, r1, h, z); return [x + r * f, y - z + r / 2 * Math.sqrt(Math.max(0, 1 - f * f))]; };
  function towerWin(E, x, y, r0, r1, h, z, f, w, hh, col){ const p = onTower(x, y, r0, r1, h, z, f), sq = Math.sqrt(Math.max(0.2, 1 - f * f)); R(p[0] - w / 2 * sq - 0.8, p[1] - hh - 0.8, w * sq + 1.6, hh + 1.6, tone(E, '#f2ece0')); R(p[0] - w / 2 * sq, p[1] - hh, w * sq, hh, col); g.strokeStyle = INK; g.lineWidth = 0.5; g.strokeRect(p[0] - w / 2 * sq - 0.8, p[1] - hh - 0.8, w * sq + 1.6, hh + 1.6); return p; }
  // 원뿔 지붕 — 밑면 타원 + 꼭짓점, 위쪽에 눈
  function cone(E, x, y, r, h, col){
    const L = look(E);
    g.beginPath(); g.moveTo(x - r, y); g.ellipse(x, y, r, r / 2, 0, Math.PI, 0, true); g.lineTo(x, y - h); g.closePath();
    g.fillStyle = lin(x - r, 0, x + r, 0, [shade(col, 0.12), col, shade(col, -0.3)]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    g.save(); g.clip(); g.beginPath(); g.moveTo(x, y - h - 1); g.lineTo(x - r * 0.7, y - h * 0.3); for (let i = 0; i <= 6; i++) g.lineTo(x - r * 0.7 + r * 1.4 * i / 6, y - h * 0.3 + (i % 2 ? 2.5 : 0) + r * 0.25 * Math.sin(i / 6 * Math.PI)); g.closePath(); g.fillStyle = L.drift[0]; g.fill(); g.restore();
  }
  // 풍차 — 하얀 둥근 돌 탑, 빨간 원뿔 지붕(날개는 live — 동남(+u)을 보는 면에서 돈다)
  D.windmill = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), L = look(E), x = c[0], y = c[1], r0 = 13, r1 = 9.5, h = 44;
    oval(x + 4, y + 2, 20, 8, L.shadow);
    tower(E, x, y, r0, r1, h, tone(E, '#efe8da'), [[0, 4, tone(E, '#9aa0ae')]]);
    for (let z = 8; z < h - 4; z += 6) for (let k = 0; k < 4; k++){ const f = -0.8 + k * 0.5 + ((z / 6) % 2) * 0.25, p = onTower(x, y, r0, r1, h, z, f); line([p[0] - 1.2, p[1]], [p[0] + 1.2, p[1]], 'rgba(120,100,80,.25)', 0.5); }
    const d = onTower(x, y, r0, r1, h, 0, 0.35), sq = Math.sqrt(1 - 0.35 * 0.35);
    g.beginPath(); g.moveTo(d[0] - 3 * sq, d[1]); g.lineTo(d[0] - 3 * sq, d[1] - 9); g.ellipse(d[0], d[1] - 9, 3 * sq, 3, 0, Math.PI, 0); g.lineTo(d[0] + 3 * sq, d[1]); g.closePath(); g.fillStyle = tone(E, '#6a4430'); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.5; g.stroke();
    const w = towerWin(E, x, y, r0, r1, h, 26, 0.3, 4, 6, E.night ? L.win : '#6f9ec4'); if (E.night) E.lamp(w[0], w[1] - 3, 20, '#ffcf7a');
    oval(x, y - h, r1, r1 / 2, tone(E, '#d8d0c0'));
    cone(E, x, y - h + 1, r1 + 2.5, 17, tone(E, FALU));
  };
  D.windmillLive = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), hub = [c[0] + 8, c[1] - 40], a0 = STILL ? 0.3 : E.t * 0.9;
    const V = [-0.894, 0.447];                                            // 날개 면 = v 축과 z 축이 이루는 면(동남을 본다)
    const P = (a, r, s) => { const ca = Math.cos(a), sa = Math.sin(a), m = ca * r - sa * s, n = sa * r + ca * s; return [hub[0] + m * V[0], hub[1] + m * V[1] - n]; };
    line([c[0] + 3, c[1] - 41.5], hub, tone(E, '#5a4034'), 1.6);         // 굴대
    for (let i = 0; i < 4; i++){
      const a = a0 + i * Math.PI / 2, Lb = 26, wd = 5;
      line(P(a, 0, 0), P(a, Lb, 0), tone(E, '#5a4034'), 1.1);
      poly([P(a, 6, 0.6), P(a, Lb, 0.6), P(a, Lb, wd), P(a, 6, wd)], 'rgba(242,236,224,.92)', 0.5);
      for (let k = 1; k < 4; k++) line(P(a, 6 + k * 5, 0.6), P(a, 6 + k * 5, wd), 'rgba(90,64,52,.6)', 0.35);
    }
    oval(hub[0], hub[1], 2, 2.2, tone(E, '#3a3f52'));
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

  // ---- 오로라 농장 꾸미개 넷 더(2026-10-09) — 사우나 오두막 · 사미 천막과 모닥불 · 얼음 순록 조각 · 산타 우체국 우체통 ----
  // 사우나 — 핀란드식 작은 통나무 오두막: 돌 기단, 앞 박공 아래 문과 「SAUNA」 판, 옆 작은 창, 쇠 연통(김은 live),
  // 앞 데크에 나무 물통과 국자(키울루), 문 옆에 자작나무 잎 다발(비흐타)과 등, 오른쪽 벽에 기댄 장작 더미
  const SAUNA_LOG = '#86583a', SAUNA_RISE = 14, SAUNA_EAVE = 0.22;
  const saunaGeo = b => geo(b, 0.32, 22);
  // 연통 밑동(도트) — 오른쪽 지붕 비탈 위. 그림과 김(live)이 같이 쓴다. 벽을 기단 높이(3)만큼 올려 그리니 z 에 3 을 더한다
  function saunaPipe(b){
    const G = saunaGeo(b), um = (G.u0 + G.u1) / 2, ue = G.u1 + SAUNA_EAVE, u = um + (ue - um) * 0.42;
    const p = q(u, G.v0 + 0.36, G.H + SAUNA_RISE - (u - um) / (ue - um) * (SAUNA_RISE + 1) + 3);
    return { x: p[0], y: p[1], h: 13 };
  }
  D.sauna = (E, b) => {
    const G = saunaGeo(b), L = look(E), lenL = G.u1 - G.u0, WD = tone(E, '#b07a50');
    footBox(E, G);
    box(G.u0 - 0.04, G.v0 - 0.04, G.u1 + 0.04, G.v1 + 0.04, 0, 3, tone(E, '#7d8494'));                       // 돌 기단
    for (let a = 0.1; a < lenL; a += 0.27) line(q(G.u0 + a, G.v1 + 0.04, 0.4), q(G.u0 + a + 0.04, G.v1 + 0.04, 2.6), 'rgba(0,0,30,.25)', 0.45);
    box(G.u0 + 0.1, G.v1 + 0.04, G.u1 - 0.1, G.v1 + 0.32, 0, 3, WD);                                           // 앞 데크
    for (let k = 1; k < 3; k++){ const v = G.v1 + 0.04 + 0.28 * k / 3; line(q(G.u0 + 0.1, v, 3), q(G.u1 - 0.1, v, 3), 'rgba(60,30,10,.35)', 0.4); }
    poly3([[G.u0 + 0.12, G.v1 + 0.2, 3.05], [G.u0 + 0.42, G.v1 + 0.18, 3.05], [G.u0 + 0.36, G.v1 + 0.31, 3.05], [G.u0 + 0.12, G.v1 + 0.31, 3.05]], L.drift[0]);   // 데크 구석 눈
    g.save(); g.translate(0, -3);
    logWalls(E, G, SAUNA_LOG);
    door(E, G, 'L', lenL / 2 - 0.2, 0.4, 15, '#5a3a28');
    win(E, G, 'R', 0.3, 0.36, 9, 6);
    // 비흐타 — 못에 건 자작나무 잎 다발, 끈으로 묶은 손잡이
    { const h = faceAt(G, 'L', 0.22, 15.5); line(h, [h[0], h[1] + 2.5], tone(E, '#d8c8a0'), 0.4); line([h[0], h[1] + 2.4], [h[0] + 0.3, h[1] + 5], tone(E, '#8a6a4a'), 0.9);
      for (let i = 0; i < 9; i++){ const a = (hash(i * 5 + 1) - 0.5) * 1.6, rr = 1.1 + hash(i * 3) * 0.5; g.fillStyle = tone(E, i % 3 ? '#5f8a3a' : '#86b04e'); g.beginPath(); g.ellipse(h[0] + 0.3 + Math.sin(a) * (1.4 + i * 0.18), h[1] + 5.2 + i * 0.75, rr, rr * 0.5, a + 1.2, 0, TAU); g.fill(); }
      line([h[0] - 0.6, h[1] + 4.6], [h[0] + 1.2, h[1] + 4.4], tone(E, '#d9433e'), 0.5); }
    // 문 옆 등 — 쇠 팔에 매단 네모 등
    { const p = faceAt(G, 'L', lenL / 2 + 0.33, 15.5); line(p, [p[0] + 1.5, p[1] - 0.6], tone(E, '#3a3f52'), 0.5);
      R(p[0] + 0.3, p[1] - 0.4, 2.6, 3.6, tone(E, '#2f3446')); R(p[0] + 0.7, p[1], 1.8, 2.8, E.night ? '#ffe7a4' : '#d6e2ee');
      poly([[p[0], p[1] - 0.4], [p[0] + 1.6, p[1] - 1.8], [p[0] + 3.2, p[1] - 0.4]], tone(E, '#2f3446'));
      if (E.night) E.lamp(p[0] + 1.6, p[1] + 1.4, 26, '#ffcf7a'); }
    // 문 위 판 「SAUNA」 — 면 결(u 방향)을 따라 기울여 쓴다(박공은 비탈 처마에 가려 판 자리가 없다)
    { onFace(G, 'L', lenL / 2 - 0.34, lenL / 2 + 0.34, 16.6, 20.6, tone(E, '#d8b088'), true);
      const c = faceAt(G, 'L', lenL / 2, 18.6);
      g.save(); g.translate(c[0], c[1]); g.transform(1, 0.5, 0, 1, 0, 0);
      g.fillStyle = tone(E, '#4a2c20'); g.font = '700 2.9px "Suayona Sans", Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SAUNA', 0, 0.15);
      g.restore(); }
    roof(E, G, { ridge: 'v', rise: SAUNA_RISE, col: '#3e3436', gable: SAUNA_LOG, eave: SAUNA_EAVE });
    g.restore();
    // 쇠 연통 — 밑에 눈 둔덕, 꼭대기에 눈 얹은 갓
    { const P = saunaPipe(b);
      tower(E, P.x, P.y, 1.7, 1.7, P.h, tone(E, '#4a5064'));
      oval(P.x, P.y - 4, 2.1, 1, tone(E, '#6a7088'));
      oval(P.x - 0.3, P.y + 0.4, 3.8, 1.6, L.drift[0]);
      [-1.4, 1.4].forEach(dx => line([P.x + dx, P.y - P.h], [P.x + dx * 1.3, P.y - P.h - 1.4], tone(E, '#3a3f52'), 0.4));
      cone(E, P.x, P.y - P.h - 1.2, 3.2, 2.8, tone(E, '#3a3f52')); }
    // 장작 더미 — 오른쪽 벽 뒤쪽 절반에 통나무 끝이 보이게 쌓고 눈을 얹는다
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++){
      const p = q(G.u1 + 0.17, G.v0 + 0.1 + k * 0.16 + r * 0.08, 1.8 + r * 3.1);
      oval(p[0], p[1], 1.75, 1.6, tone(E, '#6a4a3a')); oval(p[0], p[1], 1.2, 1.08, tone(E, '#d8b088')); oval(p[0], p[1], 0.45, 0.4, tone(E, '#a87850'));
    }
    { const p = q(G.u1 + 0.17, G.v0 + 0.3, 10.6); oval(p[0], p[1], 5.6, 1.6, L.drift[0]); oval(p[0] - 1.4, p[1] - 0.5, 2.4, 0.6, 'rgba(255,255,255,.5)'); }
    // 키울루 — 데크 위 나무 물통(쇠 테 둘), 국자
    { const p = q(G.u1 - 0.32, G.v1 + 0.18, 3), x = p[0], y = p[1];
      poly([[x - 2.6, y - 4.6], [x + 2.6, y - 4.6], [x + 2, y], [x - 2, y]], lin(x - 2.6, 0, x + 2.6, 0, [tone(E, '#d8a870'), tone(E, '#a87850')]), 0.5);
      [-3.6, -1.2].forEach(dy => line([x - 2.4 + (dy + 4.6) * 0.12, y + dy], [x + 2.4 - (dy + 4.6) * 0.12, y + dy], tone(E, '#4a5064'), 0.5));
      oval(x, y - 4.6, 2.6, 0.9, tone(E, '#8a5a3c')); oval(x, y - 4.5, 2, 0.6, E.night ? '#2a4a7a' : '#5a9ad0');
      line([x + 0.6, y - 4.4], [x + 4.2, y - 9.2], tone(E, '#8a5a3c'), 0.6); oval(x + 0.2, y - 4.2, 1, 0.5, tone(E, '#a87850')); }
    // 눈 둔덕 — 기단 앞 모서리
    { const a = q(G.u0 - 0.04, G.v1 + 0.06, 0), c = q(G.u1 + 0.06, G.v1 + 0.04, 0); lump(a[0] + 1, a[1], 5, 2, L.drift[0], L.drift[1]); lump(c[0], c[1] - 1, 3.6, 1.6, L.drift[0], L.drift[1]); }
  };
  // 사우나 김 — 연통에서 몽글몽글 피어오르다 바람에 오른쪽으로 흩어진다
  D.saunaLive = (E, b) => {
    const P = saunaPipe(b), t = STILL ? 0 : E.t, top = P.y - P.h - 4, c = E.night ? '205,214,238' : '196,208,228';
    for (let i = 0; i < 7; i++){
      const ph = (t * 0.26 + i / 7) % 1, x = P.x + Math.sin(ph * 5 + i) * 1.3 + ph * ph * 10, y = top - ph * 30, r = 1.5 + ph * 5.5;
      const a = (1 - ph) * Math.min(1, ph / 0.12) * 0.5;
      oval(x, y, r, r * 0.82, 'rgba(' + c + ',' + a.toFixed(3) + ')'); oval(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.4, 'rgba(255,255,255,' + (a * 0.6).toFixed(3) + ')');
    }
  };

  // 사미 천막(라부) — 장대 끝이 위로 부채처럼 삐져나온 원뿔 천막, 아래에 사미 무늬 띠(파랑 바탕에 빨강·노랑 마름모),
  // 앞오른쪽 문은 천을 걷어 끈으로 묶었다. 왼쪽에 기댄 나무 스키, 앞에 돌 두른 모닥불·검은 커피 주전자, 통나무 의자 둘(순록 가죽)
  const LAVVU = { u: 0.55, v: 0.75, r: 21, h: 40, apex: 44 };
  const lavvuFire = b => q(b.x + 1.8, b.y + 1.2, 0);
  D.lavvu = (E, b) => {
    const T = q(b.x + LAVVU.u, b.y + LAVVU.v, 0), x = T[0], y = T[1], L = look(E), r0 = LAVVU.r, r1 = LAVVU.r * (1 - LAVVU.h / LAVVU.apex), H = LAVVU.h;
    const onT = (z, f) => onTower(x, y, r0, r1, H, z, f), CAN = tone(E, '#d6cab0'), BLUE = tone(E, '#2f5aa8'), RED = tone(E, '#d9433e'), YEL = tone(E, '#f2c040');
    oval(x + 4, y + 2, r0 + 6, r0 * 0.5 + 2, L.shadow);
    // 천막 몸 — 둥근 탑 붓(tower)에 위 반지름을 작게 주면 원뿔, 띠는 몸을 따라 휜다
    tower(E, x, y, r0, r1, H, CAN, [[4.6, 6, YEL], [6, 12.4, BLUE], [12.4, 13.8, RED], [27, 28.2, RED], [28.2, 29.6, BLUE]]);
    for (let f = -0.72; f < 0.8; f += 0.36) line(onT(0.6, f), onT(H - 2, f * 0.6), 'rgba(80,60,40,.22)', 0.45);   // 천 이음매
    for (let f = -0.9; f <= 0.91; f += 0.15){                                                       // 띠 무늬 — 마름모와 흰 점
      const p = onT(9.2, f), s = Math.sqrt(Math.max(0.05, 1 - f * f));
      poly([[p[0] - 1.7 * s, p[1]], [p[0], p[1] - 2.1], [p[0] + 1.7 * s, p[1]], [p[0], p[1] + 2.1]], Math.round(f / 0.15) % 2 ? RED : YEL);
      const d = onT(9.2, f + 0.075); if (f < 0.85) oval(d[0], d[1], 0.45 * s, 0.45, tone(E, '#f6f2ea'));
    }
    for (let f = -0.85; f <= 0.86; f += 0.17){ const p = onT(28.6, f), s = Math.sqrt(Math.max(0.05, 1 - f * f)); oval(p[0], p[1], 0.5 * s, 0.5, YEL); }
    // 문 — 앞오른쪽 아치 구멍, 안은 낮엔 어둡고 밤엔 불빛
    const dp = [onT(0, 0.24), onT(9, 0.26), onT(15.5, 0.32), onT(19.5, 0.41), onT(19.5, 0.48), onT(15.5, 0.57), onT(9, 0.62), onT(0, 0.65)];
    poly(dp, E.night ? vgrad(dp[3][1], dp[0][1], ['#8a4a2a', '#ffc070', '#ffd88a']) : vgrad(dp[3][1], dp[0][1], ['#1c1218', '#3e2a22']), true);
    { const m = onT(1.5, 0.45); oval(m[0], m[1], 4, 1.2, E.night ? 'rgba(150,70,30,.6)' : tone(E, '#8a7864')); }    // 바닥에 깐 순록 가죽
    if (E.night){ const c = onT(8, 0.45); E.lamp(c[0], c[1], 30, '#ffb860'); }
    // 걷어 올린 문 천 — 오른쪽으로 접어 끈으로 묶었다
    poly([dp[4], dp[5], dp[6], dp[7], onT(0, 0.82), onT(7, 0.8), onT(15, 0.66)], lin(dp[5][0], 0, onT(0, 0.82)[0], 0, [shade(CAN, 0.1), shade(CAN, -0.15)]), true);
    poly([onT(6, 0.64), onT(6, 0.81), onT(11.5, 0.75), onT(11.5, 0.62)], BLUE);
    line(onT(5, 0.66), onT(14, 0.6), 'rgba(80,60,40,.3)', 0.4);
    { const a = onT(9, 0.6), c = onT(9.5, 0.84); line(a, c, tone(E, '#6a4a3a'), 0.7); oval(c[0], c[1], 0.8, 0.8, tone(E, '#6a4a3a')); line(c, [c[0] + 0.6, c[1] + 2.4], tone(E, '#6a4a3a'), 0.5); }
    // 연기 구멍과 장대 — 묶은 자리 위로 부채처럼 벌어진다
    { const tp = q(b.x + LAVVU.u, b.y + LAVVU.v, H); oval(tp[0], tp[1], r1 + 0.6, (r1 + 0.6) / 2, '#1c1418');
      for (let i = 0; i < 7; i++){
        const k = i - 3, a = [tp[0] - k * 0.5, tp[1] + 1.5], c = [tp[0] + k * 2.3 + (hash(i * 7 + 3) - 0.5) * 1.6, tp[1] - 10 - hash(i * 3 + 1) * 3 + Math.abs(k) * 1.6];
        line(a, c, INK, 1.7); line(a, c, tone(E, i % 2 ? '#8a6a4a' : '#9a7a54'), 0.95);
      }
      line([tp[0] - 2.4, tp[1] - 1.2], [tp[0] + 2.4, tp[1] - 0.4], tone(E, '#5a4034'), 0.7); line([tp[0] - 2.2, tp[1] - 0.2], [tp[0] + 2.2, tp[1] - 1.5], tone(E, '#5a4034'), 0.6); }
    // 왼쪽에 기댄 나무 스키 한 벌과 스키 막대
    for (let k = 0; k < 2; k++){
      const a = [x - 20 + k * 2.6, y + 5 + k * 0.6], c = [x - 12.5 + k * 2.4, y - 23 + k * 0.8], tip = [c[0] + 1.6, c[1] - 1.6];
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 2.3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.quadraticCurveTo(c[0] + 0.2, c[1] - 1.2, tip[0], tip[1]); g.stroke();
      g.strokeStyle = tone(E, '#b5763e'); g.lineWidth = 1.4; g.stroke();
      line([a[0] + 0.2, a[1] - 0.6], [c[0] + 0.2, c[1] - 0.6], tone(E, '#d8a060'), 0.35);
      const m = [a[0] + (c[0] - a[0]) * 0.45, a[1] + (c[1] - a[1]) * 0.45]; R(m[0] - 1.1, m[1] - 1, 2.2, 2, tone(E, '#3a2a24'));   // 묶개
      oval(c[0] - 0.2, c[1] + 2, 1.1, 0.6, L.drift[0]);
    }
    line([x - 15.5, y + 7.5], [x - 9, y - 18], tone(E, '#5a6070'), 0.6); line([x - 14.5, y + 7.9], [x - 7.8, y - 17.4], tone(E, '#5a6070'), 0.6);
    g.strokeStyle = tone(E, '#5a6070'); g.lineWidth = 0.45; g.beginPath(); g.ellipse(x - 15.1, y + 5.2, 1.6, 0.6, 0, 0, TAU); g.stroke();
    // 천막 밑 눈 둔덕
    lump(x - 17, y + 4.5, 7, 2.5, L.drift[0], L.drift[1]); lump(x + 19, y + 2.5, 4.6, 1.9, L.drift[0], L.drift[1]); lump(x - 6, y + 10.6, 4.4, 1.6, L.drift[0], L.drift[1]);
    // 그루터기 의자(불 뒤) — 나이테와 눈
    { const s = q(b.x + 1.7, b.y + 0.48, 0); tower(E, s[0], s[1], 3.5, 3.2, 6.5, tone(E, '#7a5236'));
      for (let k = -1; k <= 1; k++){ const p = onTower(s[0], s[1], 3.5, 3.2, 6.5, 1, k * 0.5); line(p, [p[0] + 0.2, p[1] - 5], 'rgba(40,20,10,.3)', 0.35); }
      oval(s[0], s[1] - 6.5, 3.2, 1.6, tone(E, '#d8b088')); g.strokeStyle = tone(E, '#a87850'); g.lineWidth = 0.3; g.beginPath(); g.ellipse(s[0], s[1] - 6.5, 2, 1, 0, 0, TAU); g.stroke();
      oval(s[0] - 0.9, s[1] - 6.9, 1.8, 0.8, L.drift[0]); }
    // 모닥불 자리 — 눈 얹은 돌 고리, 재, 엇갈린 장작과 숯불, 오른쪽 넓적 돌 위에 검은 커피 주전자
    { const F = lavvuFire(b), fx = F[0], fy = F[1];
      oval(fx, fy, 11.5, 4.8, 'rgba(30,20,20,.35)'); oval(fx, fy - 0.3, 7, 2.6, tone(E, '#3a3436'));
      for (let i = 0; i < 11; i++){ const a = i / 11 * TAU + 0.2, sx = fx + Math.cos(a) * 9.2, sy = fy + Math.sin(a) * 3.8, w = 2.4 + hash(i * 9) * 0.8;
        if (Math.sin(a) > 0) continue; oval(sx, sy, w, 1.8, tone(E, '#7a8090')); oval(sx - 0.5, sy - 0.8, w * 0.6, 0.8, L.drift[0]); }
      line([fx - 5.5, fy + 1], [fx + 4.5, fy - 2.4], tone(E, '#4a3028'), 2.2); line([fx - 4.5, fy - 2.2], [fx + 5.5, fy + 0.8], tone(E, '#5a4034'), 2.2);
      line([fx - 1, fy + 1.5], [fx + 1.5, fy - 3], tone(E, '#6a4a3a'), 1.8);
      [[-2, 0.4], [1.5, -0.6], [3, 0.6], [-3.5, -0.8]].forEach(([dx, dy]) => oval(fx + dx, fy + dy, 0.8, 0.5, E.night ? '#ff8a3a' : '#c8582a'));
      for (let i = 0; i < 11; i++){ const a = i / 11 * TAU + 0.2, sx = fx + Math.cos(a) * 9.2, sy = fy + Math.sin(a) * 3.8, w = 2.4 + hash(i * 9) * 0.8;
        if (Math.sin(a) <= 0) continue; oval(sx, sy, w, 1.8, tone(E, '#7a8090')); oval(sx - 0.5, sy - 0.8, w * 0.6, 0.8, L.drift[0]); g.strokeStyle = 'rgba(22,30,48,.35)'; g.lineWidth = 0.35; g.beginPath(); g.ellipse(sx, sy, w, 1.8, 0, 0, TAU); g.stroke(); }
      const kx = fx + 9.5, ky = fy - 1.5, KT = tone(E, '#2a2a34');                             // 커피 주전자(쿡사 대신 핀란드식 검은 주전자)
      oval(kx, ky + 0.6, 3.6, 1.4, tone(E, '#8c93a3'));
      poly([[kx - 2.4, ky], [kx + 2.4, ky], [kx + 1.6, ky - 5.5], [kx - 1.6, ky - 5.5]], lin(kx - 2.4, 0, kx + 2.4, 0, [tone(E, '#4a4a58'), KT]), 0.5);
      poly([[kx - 1.8, ky - 2.2], [kx - 4.6, ky - 5.6], [kx - 4.2, ky - 6], [kx - 1.6, ky - 3.6]], KT, 0.4);
      oval(kx, ky - 5.6, 1.7, 0.6, tone(E, '#4a4a58')); oval(kx, ky - 6.3, 0.6, 0.5, KT);
      g.strokeStyle = KT; g.lineWidth = 0.5; g.beginPath(); g.ellipse(kx, ky - 5.8, 2.2, 2.4, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      oval(kx - 0.9, ky - 3.8, 0.4, 1.2, 'rgba(255,255,255,.25)'); }
    // 통나무 의자(앞) — 눕힌 통나무에 순록 가죽을 걸쳤다
    { const a = q(b.x + 0.95, b.y + 1.86, 2.4), c = q(b.x + 1.62, b.y + 1.86, 2.4);
      foot(E, b.x + 1.28, b.y + 1.86, 0.36, 0.1);
      g.lineCap = 'round'; line(a, c, INK, 5.6); line(a, c, tone(E, '#8a5a3c'), 4.6); line([a[0], a[1] - 1.4], [c[0], c[1] - 1.4], tone(E, '#a87a54'), 1);
      oval(c[0], c[1], 2.2, 2.4, tone(E, '#d8b088')); g.strokeStyle = tone(E, '#a87850'); g.lineWidth = 0.3; g.beginPath(); g.ellipse(c[0], c[1], 1.2, 1.3, 0, 0, TAU); g.stroke(); g.strokeStyle = INK; g.lineWidth = 0.5; g.beginPath(); g.ellipse(c[0], c[1], 2.2, 2.4, 0, 0, TAU); g.stroke();
      const m0 = [a[0] + (c[0] - a[0]) * 0.24, a[1] + (c[1] - a[1]) * 0.24], m1 = [a[0] + (c[0] - a[0]) * 0.68, a[1] + (c[1] - a[1]) * 0.68], hide = [[m0[0] - 0.4, m0[1] - 3], [m1[0] + 0.4, m1[1] - 3]];
      for (let i = 0; i <= 8; i++){ const f = i / 8; hide.push([m1[0] + (m0[0] - m1[0]) * f, m1[1] + (m0[1] - m1[1]) * f + 4 + (i % 2 ? 1.3 : 0)]); }
      poly(hide, tone(E, '#b8a68a'), 0.5);                                                          // 순록 가죽 — 갈색 털, 위는 밝게, 흰 배 털
      g.fillStyle = tone(E, '#ddd0b8'); g.beginPath(); g.moveTo(m0[0] - 0.4, m0[1] - 3); g.quadraticCurveTo((m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2 - 4.2, m1[0] + 0.4, m1[1] - 3); g.lineTo(m1[0] + 0.2, m1[1] - 1); g.lineTo(m0[0] - 0.2, m0[1] - 1); g.closePath(); g.fill();
      poly([[m0[0] + 2, m0[1] + 1.2], [m0[0] + 5, m0[1] + 2.6], [m0[0] + 4.4, m0[1] + 4.8], [m0[0] + 2.2, m0[1] + 3.8]], tone(E, '#f4ede0'));
      for (let i = 0; i < 6; i++){ const f = (i + 0.5) / 6, px = m0[0] + (m1[0] - m0[0]) * f, py = m0[1] + (m1[1] - m0[1]) * f; line([px, py - 2.4], [px + 0.4, py - 0.8], 'rgba(255,255,255,.35)', 0.3); line([px + 0.3, py + 1.6], [px + 0.5, py + 3.4], 'rgba(60,40,30,.3)', 0.3); }
      oval(c[0] - 1, c[1] - 2.8, 2, 0.6, L.drift[0]); }
  };
  // 라부 모닥불 — 겹 불꽃이 일렁이고 불티가 오른다. 밤엔 불빛이 번지고 천막 꼭대기에서 옅은 연기
  D.lavvuLive = (E, b) => {
    const F = lavvuFire(b), x = F[0], y = F[1] - 1, t = STILL ? 0 : E.t, T = q(b.x + LAVVU.u, b.y + LAVVU.v, LAVVU.h + 6);
    for (let i = 0; i < 4; i++){                                                                 // 연기 구멍 연기
      const ph = (t * 0.18 + i / 4) % 1, r = 2 + ph * 6;
      oval(T[0] + Math.sin(ph * 4 + i) * 1.5 + ph * 6, T[1] - 6 - ph * 22, r, r * 0.8, 'rgba(' + (E.night ? '150,160,190' : '210,214,224') + ',' + ((1 - ph) * Math.min(1, ph / 0.15) * 0.3).toFixed(3) + ')');
    }
    g.save();
    if (E.night){ g.globalCompositeOperation = 'lighter'; glow(x, y - 4, 28 + Math.sin(t * 7) * 2, 'rgba(255,140,50,', 0.5); g.globalCompositeOperation = 'source-over'; }
    else glow(x, y - 3, 16, 'rgba(255,170,90,', 0.25);
    for (let i = 0; i < 4; i++){
      const h = 13 + Math.sin(t * 9 + i * 2) * 3 - i * 2.6, w = 5.4 - i * 1.25, sx = Math.sin(t * 6 + i * 1.7) * 1.4;
      g.fillStyle = ['rgba(230,80,30,.85)', 'rgba(255,130,40,.9)', 'rgba(255,195,80,.9)', 'rgba(255,245,190,.95)'][i];
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 1.05, y - h * 0.55, x + sx, y - h); g.quadraticCurveTo(x + w * 1.05, y - h * 0.55, x + w, y); g.closePath(); g.fill();
    }
    { const h = 8 + Math.sin(t * 11) * 2.5; g.fillStyle = 'rgba(255,150,50,.75)'; g.beginPath(); g.moveTo(x + 1.5, y); g.quadraticCurveTo(x + 4.5, y - h * 0.5, x + 4 + Math.sin(t * 8) * 1.2, y - h); g.quadraticCurveTo(x + 2, y - h * 0.4, x - 1, y); g.closePath(); g.fill(); }
    for (let i = 0; i < 6; i++){
      const ph = (t * 0.8 + i / 6) % 1, sx = x + Math.sin(i * 2.1 + t * 3) * 3 * ph + (hash(i * 5) - 0.5) * 5, sy = y - 8 - ph * 26;
      R(sx - 0.4, sy - 0.4, 0.8, 0.8, (E.night ? 'rgba(255,200,120,' : 'rgba(240,120,40,') + ((1 - ph) * 0.95).toFixed(3) + ')');
    }
    g.restore();
    if (E.night) E.lamp(x, y - 6, 46 + Math.sin(t * 9) * 3, '#ff9a4a');
  };

  // 얼음 조각상 — 눈 벽돌 받침 위에 반투명 얼음으로 깎은 순록. 오로라 빛 어른거림은 live
  // 순록 둘레를 한 경로로 — 모든 조각을 시계 방향으로 이어 붙여 겹친 자리가 비지 않게 한다. (x, y) = 받침 윗면 가운데, 순록은 왼쪽을 본다
  function deerBody(x, y){
    const cw = pts => { let s = 0; pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; s += p[0] * n[1] - n[0] * p[1]; }); return s < 0 ? pts.slice().reverse() : pts; };
    const P = pts => cw(pts).forEach((p, i) => i ? g.lineTo(x + p[0], y + p[1]) : g.moveTo(x + p[0], y + p[1]));
    const O = (cx, cy, rx, ry, rot) => { rot = rot || 0; g.moveTo(x + cx + rx * Math.cos(rot), y + cy + rx * Math.sin(rot)); g.ellipse(x + cx, y + cy, rx, ry, rot, 0, TAU); };
    O(1, -15, 10, 6, -0.05); O(7.4, -15.6, 4.6, 5); O(-5.2, -15.2, 5.2, 5.8);                      // 몸·엉덩이·가슴
    P([[-9.8, -25], [-5.8, -24.4], [-2, -16], [-8.8, -12.6]]);                                     // 목
    O(-10.7, -25, 3.5, 2.7, -0.25); O(-14, -23.4, 2.4, 1.8, 0.2);                                // 머리·주둥이
    P([[-8.8, -26.8], [-5.4, -28.4], [-7.2, -25.4]]);                                              // 귀
    P([[-9.4, -16], [-4.4, -15], [-5.4, -9.6], [-6.6, -11.4], [-7.8, -9.8], [-9, -12]]);           // 목 아래 갈기
    [[-6.6, 0], [-3.4, 0.5]].forEach(([lx, lean]) => P([[lx - 1.7, -12], [lx + 1.6, -12], [lx + 0.9 + lean * 0.5, -6], [lx + 1 + lean, -1.2], [lx + 1.5 + lean, 0], [lx - 1.1 + lean, 0], [lx - 0.8 + lean, -1.2], [lx - 1 + lean * 0.5, -6]]));   // 앞다리
    [[4.6, -0.4], [7.8, 0]].forEach(([lx, lean]) => P([[lx - 1.8, -12.5], [lx + 2.2, -12.5], [lx + 2, -7.4], [lx + 1 + lean, -1.2], [lx + 1.5 + lean, 0], [lx - 1.1 + lean, 0], [lx - 0.8 + lean, -1.2], [lx + 0.4, -6.2]]));   // 뒷다리(무릎이 뒤로 꺾인다)
    O(11.6, -17.6, 1.8, 1.2, -0.5);                                                                // 꼬리
  }
  // 뿔 — near 가 보는 쪽(앞) 뿔. 가지 친 줄기를 선으로
  function deerAntler(x, y, near){
    const M = (a, c) => { g.moveTo(x + a, y + c); }, Lt = (a, c) => g.lineTo(x + a, y + c), Qt = (a, c, e, f) => g.quadraticCurveTo(x + a, y + c, x + e, y + f);
    if (near){ M(-9.8, -26.8); Qt(-7, -34, -2.5, -38.5); M(-7.6, -32); Lt(-8.8, -36.6); M(-5.2, -36); Lt(-5.6, -40.6); M(-2.5, -38.5); Lt(-0.2, -40.6); M(-2.5, -38.5); Lt(-1.6, -42.2); M(-9.4, -28.2); Qt(-12, -29.6, -13.8, -28); }
    else { M(-11, -26.8); Qt(-11.6, -34.5, -8.4, -39.6); M(-11.1, -31.6); Lt(-13.8, -34.8); M(-9.6, -37); Lt(-11.6, -41.2); M(-8.4, -39.6); Lt(-6.6, -42.8); }
  }
  const deerTop = b => q(b.x + 0.5, b.y + 0.52, 8);
  D.icesculpt = (E, b) => {
    const L = look(E), c = deerTop(b), x = c[0], y = c[1], ICE = L.ice;
    const g0 = q(b.x + 0.5, b.y + 0.52, 0); oval(g0[0] + 2.5, g0[1] + 1.5, 15, 5, L.shadow);
    // 받침 — 눈 벽돌을 깎은 네모 받침, 앞에 끌 자국, 윗면은 다진 눈
    box(b.x + 0.2, b.y + 0.22, b.x + 0.8, b.y + 0.82, 0, 8, tone(E, '#b8dcf6'), { top: L.drift[0] });
    for (let i = 0; i < 5; i++){ const a = 0.08 + i * 0.11; line(q(b.x + 0.2 + a, b.y + 0.82, 1.5 + hash(i) * 2), q(b.x + 0.24 + a, b.y + 0.82, 3.5 + hash(i) * 2.5), 'rgba(90,130,180,.35)', 0.4); }
    line(q(b.x + 0.2, b.y + 0.82, 6.6), q(b.x + 0.8, b.y + 0.82, 6.6), 'rgba(255,255,255,.55)', 0.5);
    // 뒤 뿔 → 몸 → 앞 뿔
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); deerAntler(x, y, false); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke(); g.strokeStyle = ICE[1]; g.lineWidth = 1.1; g.stroke();
    g.beginPath(); deerBody(x, y); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = lin(x - 14, y - 30, x + 10, y, [ICE[2], ICE[0], ICE[1]]); g.fill();
    // 얼음 속 — 깊은 데는 짙게, 깎은 면은 흰 줄, 등에 빛줄
    g.save(); g.beginPath(); deerBody(x, y); g.clip();
    oval(x + 1, y - 11.2, 11, 3.4, E.night ? 'rgba(30,60,120,.35)' : 'rgba(70,120,180,.25)');
    oval(x - 4, y - 17, 3.2, 2.2, 'rgba(255,255,255,.35)'); oval(x + 5, y - 14, 2.4, 1.5, 'rgba(255,255,255,.25)');
    [[-3, -19.5, 1, -11.5], [3, -20, 5.5, -12], [-7.8, -22, -4.5, -16], [6.5, -19, 10, -14]].forEach(([a0, b0, a1, b1]) => line([x + a0, y + b0], [x + a1, y + b1], 'rgba(255,255,255,.5)', 0.4));
    [[-7.2, -6], [-4, -5.4], [4.2, -5], [7.4, -6]].forEach(([a, c]) => line([x + a, y + c], [x + a + 0.3, y + c - 4], 'rgba(255,255,255,.45)', 0.35));
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - 4.5, y - 20); g.quadraticCurveTo(x + 2, y - 21.6, x + 9.5, y - 19.6); g.stroke();
    oval(x - 11.6, y - 26.4, 1.2, 0.5, 'rgba(255,255,255,.7)');
    line([x - 11.8, y - 25.4], [x - 10.8, y - 25.2], 'rgba(30,60,110,.7)', 0.5);                     // 깎은 눈
    g.beginPath(); deerAntler(x, y, true); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke(); g.strokeStyle = ICE[0]; g.lineWidth = 1.2; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.4; g.stroke();
    // 받침 둘레 눈과 얼음 부스러기, 놓고 간 끌 하나
    lump(g0[0] - 11, g0[1] + 1, 4, 1.6, L.drift[0], L.drift[1]);
    [[-6, 4.6], [7, 4], [9.5, 2.2]].forEach(([dx, dy], i) => poly([[g0[0] + dx, g0[1] + dy], [g0[0] + dx + 1.2, g0[1] + dy - 1.2], [g0[0] + dx + 2, g0[1] + dy + 0.2]], i % 2 ? ICE[2] : ICE[0], 0.3));
    line([g0[0] + 8, g0[1] + 6], [g0[0] + 12, g0[1] + 4.2], tone(E, '#8a5a3c'), 1.1); line([g0[0] + 12, g0[1] + 4.2], [g0[0] + 14.2, g0[1] + 3.3], tone(E, '#9aa0ae'), 0.8);
  };
  // 오로라 빛 어른거림 — 초록·보라가 몸을 비스듬히 천천히 훑고, 뿔 끝과 등에 반짝임
  D.icesculptLive = (E, b) => {
    const c = deerTop(b), x = c[0], y = c[1], t = STILL ? 0 : E.t, k = 0.5 + 0.5 * Math.sin(t * 0.7);
    const col = mix('#3cf0a0', '#a070ff', k), col2 = mix('#a070ff', '#3cd0f0', k), A = E.night ? 0.55 : 0.32;
    const band = (cc, s, a) => { const rr = rgb(cc).join(','), gr = g.createLinearGradient(x - 22 + s, y - 40, x + 6 + s, y - 2); gr.addColorStop(0, 'rgba(' + rr + ',0)'); gr.addColorStop(0.5, 'rgba(' + rr + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rr + ',0)'); return gr; };
    g.save();
    // 몸에 물든 빛 — 보통 칠하기로 빛깔을 입히고(더하기만 하면 흰 얼음이 하얗게 날아간다), 가는 빛줄만 더한다
    g.save(); g.beginPath(); deerBody(x, y); g.clip();
    R(x - 18, y - 34, 32, 36, band(col, Math.sin(t * 0.45) * 12, A)); R(x - 18, y - 34, 32, 36, band(col2, Math.sin(t * 0.45 + 2.4) * 12, A * 0.8));
    g.globalCompositeOperation = 'lighter'; R(x - 18, y - 34, 32, 36, band('#ffffff', Math.sin(t * 0.3 + 1) * 16, 0.25));
    g.restore(); g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineWidth = 1.1;
    g.beginPath(); deerAntler(x, y, false); deerAntler(x, y, true); g.strokeStyle = 'rgba(' + rgb(col).join(',') + ',' + (A * 0.9).toFixed(2) + ')'; g.stroke();
    [[-1.6, -42.2], [-13.8, -28], [-6.6, -42.8], [6, -20.5], [-15.2, -23.4]].forEach(([dx, dy], i) => {
      const a = Math.pow(Math.max(0, Math.sin(t * 1.3 + i * 2.1)), 6); if (a < 0.05) return;
      const s = 1.2 + a * 1.6, px = x + dx, py = y + dy; g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      g.beginPath(); g.moveTo(px, py - s); g.quadraticCurveTo(px, py, px + s, py); g.quadraticCurveTo(px, py, px, py + s); g.quadraticCurveTo(px, py, px - s, py); g.quadraticCurveTo(px, py, px, py - s); g.fill();
    });
    g.restore();
    if (E.night) E.lamp(x - 2, y - 18, 28, col);
  };

  // 산타 우체국 우체통 — 로바니에미 산타 마을 우체국풍 빨간 둥근 기둥. 돔 지붕에 눈, 금빛 띠·꼭지·우편 나팔,
  // 투입구에 꽂힌 편지 한 통, 수거 시각 판, 눈 위에 호랑가시 잎
  D.santapost = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E), RED = tone(E, '#c8323a'), GOLD = tone(E, '#e8bf5a'), r = 6.6, h = 25, y0 = y - 3.5, top = y0 - h;
    const onB = (z, f) => onTower(x, y0, r, r, h, z, f);
    const strip = (z0, z1, f0, f1) => { const pts = []; for (let i = 0; i <= 6; i++) pts.push(onB(z1, f0 + (f1 - f0) * i / 6)); for (let i = 6; i >= 0; i--) pts.push(onB(z0, f0 + (f1 - f0) * i / 6)); return pts; };
    oval(x + 2.5, y + 1.2, 12, 4.4, L.shadow);
    tower(E, x, y, 8.4, 8, 3.5, tone(E, '#3a3f52'));                                                // 쇠 받침
    oval(x, y0, 8, 4, tone(E, '#545a70'));
    tower(E, x, y0, r, r, h, RED, [[1, 2.2, GOLD], [h - 4.2, h - 2.4, GOLD]]);
    // 아래 문 — 둥근 몸에 붙은 테, 가운데 금빛 우편 나팔, 열쇠 구멍
    poly(strip(2.6, 11.6, -0.55, 0.55), null, 0.45);
    poly(strip(3.2, 11, -0.47, 0.47), 'rgba(255,255,255,.06)');
    { const k = onB(4.6, 0.38); oval(k[0], k[1], 0.55, 0.55, GOLD); R(k[0] - 0.2, k[1], 0.4, 0.9, GOLD); }
    { const c = onB(7.2, -0.05); g.strokeStyle = GOLD; g.lineWidth = 0.75; g.beginPath(); g.arc(c[0], c[1], 1.9, 0, TAU); g.stroke();
      poly([[c[0] + 1.6, c[1] - 0.7], [c[0] + 3.8, c[1] - 2], [c[0] + 3.8, c[1] + 1.6], [c[0] + 1.6, c[1] + 0.6]], GOLD);
      line([c[0] - 1.8, c[1] + 0.3], [c[0] - 3.4, c[1] - 0.8], GOLD, 0.6); oval(c[0] - 3.5, c[1] - 0.9, 0.5, 0.5, GOLD); }
    // 수거 시각 판 — 크림빛 판에 글줄 둘
    poly(strip(12.6, 15, -0.32, 0.32), tone(E, '#f2ece0'), 0.4);
    [13.5, 14.2].forEach(z => line(onB(z, -0.22), onB(z, 0.2), 'rgba(80,20,30,.6)', 0.3));
    // 투입구 — 금테 안 검은 틈, 편지 한 통이 꽂혀 있다
    poly(strip(16, 18.8, -0.5, 0.5), GOLD, 0.45);
    poly(strip(16.7, 18.1, -0.42, 0.42), '#1a1420');
    { const s0 = onB(17.6, -0.18), s1 = onB(17.6, 0.16);
      poly([[s0[0], s0[1]], [s1[0], s1[1]], [s1[0] + 0.7, s1[1] - 4.6], [s0[0] + 0.5, s0[1] - 5]], tone(E, '#fbf8f0'), 0.4);
      line([s0[0] + 0.5, s0[1] - 5], [(s0[0] + s1[0]) / 2 + 0.6, (s0[1] + s1[1]) / 2 - 3.2], 'rgba(120,110,100,.5)', 0.3); line([(s0[0] + s1[0]) / 2 + 0.6, (s0[1] + s1[1]) / 2 - 3.2], [s1[0] + 0.7, s1[1] - 4.6], 'rgba(120,110,100,.5)', 0.3);
      R(s1[0] - 0.9, s1[1] - 3.6, 1, 1.2, tone(E, '#d9433e')); }
    // 돔 지붕 — 둥근 붉은 갓, 밑에 금테
    g.beginPath(); g.moveTo(x - r, top); g.ellipse(x, top, r, r * 0.95, 0, Math.PI, TAU); g.ellipse(x, top, r, r / 2, 0, 0, Math.PI); g.closePath();
    { const gr = g.createRadialGradient(x - r * 0.4, top - r * 0.55, 0.5, x, top - r * 0.2, r * 1.3); gr.addColorStop(0, shade(RED, 0.3)); gr.addColorStop(0.5, RED); gr.addColorStop(1, shade(RED, -0.35)); g.fillStyle = gr; }
    g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    g.strokeStyle = GOLD; g.lineWidth = 1.3; g.beginPath(); g.ellipse(x, top + 0.2, r + 0.3, r / 2 + 0.2, 0, 0.05, Math.PI - 0.05); g.stroke();
    line([x - r * 0.75, top + r * 0.33 + 0.2], [x - r * 0.25, top + r * 0.47 + 0.2], 'rgba(255,255,255,.5)', 0.4);
    // 돔에 얹힌 눈 — 아래 끝이 울퉁불퉁, 앞으로 녹아 흐른 덩이
    { const pts = [];
      for (let i = 0; i <= 10; i++){ const a = Math.PI + 0.14 + (Math.PI - 0.28) * i / 10; pts.push([x + Math.cos(a) * (r + 0.9), top - 0.2 + Math.sin(a) * (r * 0.95 + 1.3)]); }
      for (let i = 0; i <= 8; i++){ const xx = x + r * 0.96 - i * (r * 1.92 / 8); pts.push([xx, top - r * 0.38 + Math.sin(i * 1.9) * 0.9 + (i % 2 ? 0.9 : 0)]); }
      poly(pts, L.drift[0]); g.strokeStyle = 'rgba(60,80,130,.35)'; g.lineWidth = 0.5; g.stroke();
      oval(x - 3.6, top - r * 0.3, 1.2, 1.6, L.drift[0]); oval(x + 2.2, top - r * 0.28, 1, 1.3, L.drift[0]);
      oval(x - 2.4, top - r * 0.82, 2.2, 0.7, 'rgba(255,255,255,.65)'); }
    // 금 꼭지와 호랑가시
    R(x - 0.45, top - r * 0.95 - 3.4, 0.9, 3.4, GOLD); oval(x, top - r * 0.95 - 4, 1.6, 1.6, GOLD); oval(x - 0.5, top - r * 0.95 - 4.5, 0.6, 0.5, 'rgba(255,255,255,.7)');
    g.strokeStyle = INK; g.lineWidth = 0.4; g.beginPath(); g.arc(x, top - r * 0.95 - 4, 1.6, 0, TAU); g.stroke();
    { const hx = x + 3, hy = top - r * 0.62; [[-0.5, -1.6], [0.6, 1.5]].forEach(([rot, dx]) => { g.fillStyle = tone(E, '#2f7a4a'); g.beginPath(); g.ellipse(hx + dx, hy, 2, 0.85, rot, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.3; g.stroke(); });
      [[-0.6, -0.4], [0.5, -0.6], [0, 0.3]].forEach(([dx, dy]) => { oval(hx + dx, hy + dy - 0.4, 0.75, 0.75, tone(E, '#e0303a')); oval(hx + dx - 0.25, hy + dy - 0.65, 0.25, 0.25, 'rgba(255,255,255,.7)'); }); }
    // 밑동 눈
    lump(x - 7.5, y + 1.6, 4.4, 1.8, L.drift[0], L.drift[1]); lump(x + 7, y + 2.4, 3.4, 1.5, L.drift[0], L.drift[1]);
    if (E.night){ const s = onB(17.4, 0); E.lamp(s[0], s[1], 12, '#ffdf8a'); }
  };

  // ---- 앞 농장에서 「추억」으로 들고 온 꾸미개 15종(2026-10-09) — 오로라 눈 섬에 맞게 눈을 얹어 다시 그린다 ----
  // 바닷가: 등대·야자수·닻·고깃배·파라솔 · 화산: 흑요석 돌탑·용암 폭포·장작더미·우유통·용뿔 나팔 · 꽃구름: 자판기·붉은 북다리·대나무 물통·잉어 깃발·지장보살
  D.lighthouse = (E, b) => {                                             // 등대 — 빨강·흰 띠 둥근 탑, 난간 두른 등실, 둥근 지붕
    const p = q(b.x + 0.5, b.y + 0.5, 0), x = p[0], y = p[1], L = look(E), r0 = 8.5, r1 = 5.5, h = 48;
    oval(x + 3, y + 1.5, 12, 5, L.shadow);
    tower(E, x, y, r0, r1, h, tone(E, '#f6f2ea'), [[6, 14, tone(E, '#d9433e')], [22, 30, tone(E, '#d9433e')], [38, 46, tone(E, '#d9433e')]]);
    const d = onTower(x, y, r0, r1, h, 0, 0.3); R(d[0] - 2, d[1] - 7, 4, 7, tone(E, '#3a3f52'));
    oval(x, y - h, 8, 4, tone(E, '#3a3f52')); oval(x, y - h - 0.8, 8, 4, tone(E, '#545a70'));     // 난간 바닥
    tower(E, x, y - h - 1, 4.6, 4.6, 8, E.night ? '#ffe7a4' : '#bcdcf0');                        // 유리 등실
    for (let k = -1; k <= 1; k++){ const pp = onTower(x, y - h - 1, 4.6, 4.6, 8, 0, k * 0.6); line(pp, [pp[0], pp[1] - 8], tone(E, '#3a3f52'), 0.5); }
    g.strokeStyle = tone(E, '#3a3f52'); g.lineWidth = 0.6; g.beginPath(); g.ellipse(x, y - h - 4, 8, 4, 0, 0, Math.PI); g.stroke();   // 앞 난간
    cone(E, x, y - h - 9, 5.6, 7, tone(E, '#d9433e')); oval(x, y - h - 16.5, 1, 1, tone(E, '#3a3f52'));
    if (E.night) E.lamp(x, y - h - 5, 40, '#ffe08a');
  };
  D.palm = (E, b) => {                                                   // 야자수 — 눈 섬에선 화분에 담아 털옷을 입혔다
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 2, y + 1, 9, 3, L.shadow);
    const pot = tone(E, '#c8683a');
    oval(x, y, 5.6, 2.6, shade(pot, -0.25)); poly([[x - 5.6, y], [x + 5.6, y], [x + 7, y - 7], [x - 7, y - 7]], lin(x - 7, 0, x + 7, 0, [shade(pot, 0.12), shade(pot, -0.22)]));
    g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x - 5.6, y); g.ellipse(x, y, 5.6, 2.6, 0, Math.PI, 0, true); g.lineTo(x + 7, y - 7); g.stroke();
    oval(x, y - 7, 7, 3.2, shade(pot, 0.2)); oval(x, y - 7, 5.6, 2.4, tone(E, '#5a3a28')); g.beginPath(); g.ellipse(x, y - 7, 7, 3.2, 0, 0, TAU); g.stroke();
    g.strokeStyle = tone(E, '#9a6a44'); g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 7); g.quadraticCurveTo(x - 3, y - 20, x + 2, y - 32); g.stroke();
    for (let k = 0; k < 5; k++) line([x - 2.4 + k * 0.4, y - 12 - k * 4], [x + 1.6 + k * 0.4, y - 13 - k * 4], tone(E, '#7a5034'), 0.5);
    R(x - 3, y - 18, 5, 3, tone(E, '#d9433e'));                           // 목도리
    for (let i = 0; i < 6; i++){ const a = -Math.PI / 2 + (i - 2.5) * 0.55, tx = x + 2 + Math.cos(a) * 14, ty = y - 32 + Math.sin(a) * 6 + 7;
      g.fillStyle = L.fir[1]; g.beginPath(); g.moveTo(x + 2, y - 32); g.quadraticCurveTo((x + 2 + tx) / 2, ty - 7, tx, ty); g.quadraticCurveTo((x + 2 + tx) / 2, ty - 3, x + 2, y - 31); g.fill(); }
    oval(x + 2, y - 34, 6, 1.6, L.drift[0]);
  };
  D.anchor = (E, b) => {                                                 // 닻 — u 축 판에 세우고 뒤로 한 겹 두께
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E), th = q(0, -0.1, 0), o = q(0, 0, 0);
    oval(x + 1, y + 1, 9, 3.6, L.shadow);
    const draw = (dx, dy, c) => {
      line([x + dx, y + dy - 2], [x + dx, y + dy - 22], c, 2.2); line([x + dx - 5, y + dy - 18], [x + dx + 5, y + dy - 18], c, 1.8);
      g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.arc(x + dx, y + dy - 9, 7, 0.2, Math.PI - 0.2); g.stroke();
      g.beginPath(); g.arc(x + dx, y + dy - 24, 2.4, 0, TAU); g.stroke();
      poly([[x + dx - 8, y + dy - 9], [x + dx - 5, y + dy - 7], [x + dx - 7, y + dy - 4]], c); poly([[x + dx + 8, y + dy - 9], [x + dx + 5, y + dy - 7], [x + dx + 7, y + dy - 4]], c);
    };
    box(b.x + 0.32, b.y + 0.42, b.x + 0.68, b.y + 0.68, 0, 2, tone(E, '#7a8090'));
    upright([x, y], 'u', () => { draw(th[0] - o[0], th[1] - o[1], tone(E, '#2e3444')); draw(0, 0, tone(E, '#4a5266')); line([x - 0.5, y - 4], [x - 0.5, y - 21], 'rgba(255,255,255,.18)', 0.6); });
    const s = q(b.x + 0.5, b.y + 0.5, 26); oval(s[0], s[1], 2.4, 0.9, L.drift[0]);
  };
  D.boat = (E, b) => {                                                   // 고깃배 — 얼음 위에 끌어 올려 둔 작은 배
    const u0 = b.x + 0.1, u1 = b.x + b.w - 0.1, v = b.y + 0.5, L = look(E);
    foot(E, (u0 + u1) / 2, v, (u1 - u0) / 2, 0.3);
    poly3([[u0, v - 0.3, 6], [u1 - 0.3, v - 0.3, 6], [u1 + 0.1, v, 7], [u1 - 0.3, v + 0.3, 6], [u0, v + 0.3, 6]], tone(E, '#3f6ea0'));
    poly3([[u0, v + 0.3, 6], [u1 - 0.3, v + 0.3, 6], [u1 + 0.1, v, 7], [u1 - 0.2, v + 0.15, 1], [u0 + 0.15, v + 0.2, 1]], tone(E, '#2f5888'), true);
    line(q(u0 + 0.1, v + 0.3, 4.6), q(u1 - 0.3, v + 0.3, 4.6), tone(E, TRIM), 0.8);
    poly3([[u0 + 0.1, v - 0.22, 6.2], [u1 - 0.35, v - 0.22, 6.2], [u1 - 0.35, v + 0.22, 6.2], [u0 + 0.1, v + 0.22, 6.2]], L.drift[0]);
  };
  D.parasol = (E, b) => {                                                // 파라솔 — 접어 묶은 우산(둥근 뿔), 무거운 받침
    const p = q(b.x + 0.5, b.y + 0.55, 0), x = p[0], y = p[1], L = look(E), red = tone(E, '#d9433e');
    oval(x + 1.5, y + 1, 7, 3, L.shadow);
    oval(x, y, 4.2, 2.1, tone(E, '#5c6272')); R(x - 4.2, y - 2.4, 8.4, 2.4, tone(E, '#7a8090')); oval(x, y - 2.4, 4.2, 2.1, tone(E, '#9aa0ae'));
    R(x - 0.5, y - 36, 1, 34, tone(E, '#c8ccd6'));
    path([[x, y - 35], [x - 4.4, y - 22], [x - 1.4, y - 12.5], [x + 1.4, y - 12.5], [x + 4.4, y - 22]]);
    g.fillStyle = lin(x - 4.4, 0, x + 4.4, 0, [shade(red, 0.16), shade(red, -0.26)]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    poly([[x, y - 35], [x - 2.6, y - 21.8], [x - 1, y - 12.6], [x - 0.2, y - 12.6], [x - 1.1, y - 21.4]], tone(E, TRIM));
    poly([[x, y - 35], [x + 2.2, y - 21.6], [x + 1, y - 12.6], [x + 0.6, y - 12.6], [x + 1.4, y - 21.5]], 'rgba(0,0,0,.12)');
    g.strokeStyle = tone(E, '#7a1e1a'); g.lineWidth = 0.9; g.beginPath(); g.ellipse(x, y - 20.5, 3.9, 1.3, 0, 0.1, Math.PI - 0.1); g.stroke();
    oval(x, y - 34, 2.6, 1.1, L.drift[0]);
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
    upright([x, p[1] - 34], 'u', () => [['#d9433e', 44, 18], ['#3f6ea0', 33, 15], ['#f2a0b8', 24, 12]].forEach(([c, dy, len], k) => {
      const y = p[1] - dy, pts = [], low = [];
      for (let i = 0; i <= 6; i++){ const f = i / 6, w = Math.sin(t * 3.4 - f * 4 + k) * 1.6 * f, h = 3.2 * (1 - f * 0.45); pts.push([x + len * f, y + w - h]); low.push([x + len * f, y + w + h]); }
      path(pts.concat(low.reverse())); g.fillStyle = tone(E, c); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.4; g.stroke();
      oval(x + 3, y - 0.6, 1.4, 1.4, '#ffffff'); oval(x + 3.2, y - 0.6, 0.6, 0.6, '#1a1a2a');
    }));
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

  // ================= 사막 오아시스(2026-10-09, 시안 _farm6-test.html ①) =================
  // 하늘·모래 언덕·섬·대추야자·카스바 집·시장 노점·흙벽 외양간·닭장·오아시스 연못. 나머지 건물·꾸미개는 오로라 그림에서 눈만 빠진 채(drift 투명)
  const ovI = (x, y, rx, ry, c) => { oval(x, y, rx, ry, c); g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); g.stroke(); };
  const curve = (pts, c, w) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++){ const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } const Lp = pts[pts.length - 1]; g.lineTo(Lp[0], Lp[1]); g.stroke(); };
  const along = (a, b, n, fn) => { for (let i = 0; i <= n; i++){ const f = i / n; fn(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, i, f); } };
  const SAND = '#dfa268';                                                // 흙벽 빛
  function desertBackdrop(E){
    const L = look(E), hy = horizon(E), t = E.t;
    R(0, 0, E.w, hy + 2, vgrad(0, hy, L.sky));
    if (E.night){
      // 은하수 띠 + 별 + 금빛 초승달
      g.save(); g.translate(E.w * 0.5, hy * 0.5); g.rotate(-0.35); const mw = g.createLinearGradient(0, -40, 0, 40); mw.addColorStop(0, 'rgba(180,160,255,0)'); mw.addColorStop(0.5, 'rgba(200,180,255,.16)'); mw.addColorStop(1, 'rgba(180,160,255,0)'); g.fillStyle = mw; g.fillRect(-E.w, -40, E.w * 2, 80); g.restore();
      for (let i = 0; i < 160; i++){ const x = hash(i * 7 + 1) * E.w, y = hash(i * 11 + 3) * hy * 0.95, a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + hash(i)) + i)), s = hash(i * 5) < 0.1 ? 1.2 : 0.7; R(x, y, s, s, 'rgba(255,245,225,' + a.toFixed(2) + ')'); }
      const x = E.w * 0.8, y = hy * 0.3; glow(x, y, 40, 'rgba(255,220,150,', 0.3); oval(x, y, 9, 9, '#ffe7b0'); oval(x + 3.4, y - 2, 8, 8.4, L.sky[1]);
    } else { const x = E.w * 0.78, y = hy * 0.42; glow(x, y, 70, 'rgba(255,240,200,', 0.75); oval(x, y, 9, 9, '#fffbe8'); }
    // 피라미드 셋 — 밝은 면·그늘 면, 돌 켜
    [[150, 56], [218, 38], [96, 26]].forEach(([x, h]) => { const b = hy + 2; poly([[x - h * 1.1, b], [x, b - h], [x + h * 0.3, b]], tone(E, '#ecc282')); poly([[x + h * 0.3, b], [x, b - h], [x + h * 1.1, b]], tone(E, '#b9834e')); for (let i = 1; i < 6; i++){ const y = b - h * i / 6; line([x - h * 1.1 * (1 - i / 6), y], [x + h * 1.1 * (1 - i / 6), y], 'rgba(120,70,30,.18)', 0.5); } });
    const dune = (base, amp, f, sd, col) => { g.beginPath(); g.moveTo(0, base + 6); for (let x = 0; x <= E.w + 2; x += 3) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * f + sd)) * (0.7 + 0.3 * Math.sin(x * f * 0.37 + sd * 2))); g.lineTo(E.w, base + 6); g.closePath(); g.fillStyle = col; g.fill(); };
    dune(hy + 2, 22, 0.012, 1.5, L.far); dune(hy + 3, 14, 0.021, 4.1, L.far2);
    // 낙타 행렬 실루엣 — 아주 천천히 지나간다
    for (let i = 0; i < 4; i++){ const x = ((E.w * 0.6 + t * 1.2 + i * 15) % (E.w + 80)) - 40, y = hy - 4 - i * 0.6, c = E.night ? 'rgba(30,20,50,.8)' : 'rgba(120,70,40,.55)'; oval(x, y - 4, 5, 2.4, c); oval(x - 1, y - 6.4, 1.8, 1.6, c); R(x + 4, y - 9, 1.2, 5, c); oval(x + 5.4, y - 9, 2, 1, c); [-3.5, -1, 2, 3.8].forEach(d => R(x + d, y - 3, 0.7, 4, c)); }
    // 섬 아래 모래 벌판 — 물결 자국
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea));
    for (let i = 0; i < 46; i++){ const y = hy + 5 + Math.pow(hash(i * 3 + 7), 1.4) * (E.h - hy), x = hash(i * 13 + 2) * E.w, w = 10 + hash(i) * 26; curve([[x - w, y], [x, y - 2.5], [x + w, y]], E.night ? 'rgba(160,140,200,.2)' : 'rgba(255,240,210,.5)', 0.8); curve([[x - w, y + 1.4], [x, y - 1], [x + w, y + 1.4]], E.night ? 'rgba(20,10,40,.25)' : 'rgba(170,100,50,.25)', 0.7); }
  }
  function desertIsland(E, paths, busy){
    const L = look(E), C = E.cols, Rw = E.rows, D2 = E.cliff, tc = q(0, 0, 0), rc = q(C, 0, 0), bc = q(C, Rw, 0), lc = q(0, Rw, 0);
    const face = (a, b, sh, seed) => {
      for (let i = 0; i < 4; i++){ const d0 = D2 * i / 4, d1 = D2 * (i + 1) / 4 + 0.6; poly([[a[0], a[1] + d0], [b[0], b[1] + d0], [b[0], b[1] + d1], [a[0], a[1] + d1]], L.cliff[i]); }
      poly([[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + D2], [a[0], a[1] + D2]], 'rgba(0,0,0,' + sh + ')');
      g.strokeStyle = E.night ? 'rgba(255,220,220,.07)' : 'rgba(255,230,190,.28)'; g.lineWidth = 0.8; g.beginPath();   // 사암 결
      for (let k = 1; k < 8; k++){ const d = D2 * k / 8 + 2 * Math.sin(k * 2.1); g.moveTo(a[0], a[1] + d); for (let f = 0; f <= 1.0001; f += 0.05) g.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + d + 1.6 * Math.sin(f * 30 + k)); }
      g.stroke();
      g.fillStyle = L.cliff[3]; g.beginPath(); g.moveTo(a[0], a[1] + D2);
      const n = 24; for (let i = 0; i <= n; i++){ const f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + D2; g.lineTo(x, y + (i % 2 ? 4 : 10 + hash(i * 7 + seed) * 16)); }
      g.lineTo(b[0], b[1] + D2); g.closePath(); g.fill();
    };
    face(lc, bc, 0, 0); face(bc, rc, 0.18, 3);
    g.save(); poly([tc, rc, bc, lc]); g.clip();
    R(lc[0], tc[1], rc[0] - lc[0], bc[1] - tc[1], vgrad(tc[1], bc[1], L.snow));
    const lite = new Path2D(), dark = new Path2D();
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){ if (paths.has(u + ',' + v)) continue; const h = h2(u, v); if (h < 0.28) diamond(lite, u, v, 0.03); else if (h > 0.74) diamond(dark, u, v, 0.03); }
    g.fillStyle = L.snowHi; g.fill(lite); g.fillStyle = L.snowLo; g.fill(dark);
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){
      if (paths.has(u + ',' + v) || busy(u, v)) continue; const d = h2(u * 3 + 1, v * 7 + 2); if (d >= 0.3) continue;
      const p = q(u + 0.25 + h2(u, v + 3) * 0.5, v + 0.25 + h2(u + 3, v) * 0.5, 0), k = d / 0.3;
      if (k < 0.45){ curve([[p[0] - 7, p[1]], [p[0], p[1] - 2], [p[0] + 7, p[1]]], E.night ? 'rgba(220,200,255,.14)' : 'rgba(255,250,230,.6)', 0.8); curve([[p[0] - 6, p[1] + 1.2], [p[0], p[1] - 0.8], [p[0] + 6, p[1] + 1.2]], E.night ? 'rgba(20,10,40,.2)' : 'rgba(180,110,50,.22)', 0.6); }
      else if (k < 0.7){ oval(p[0], p[1], 2, 1.2, tone(E, '#b8875a')); oval(p[0] + 3, p[1] + 1, 1.3, 0.8, tone(E, '#a07048')); }
      else { g.strokeStyle = tone(E, '#9a8a4a'); g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); for (let j = -2; j <= 2; j++){ g.moveTo(p[0] + j, p[1]); g.lineTo(p[0] + j * 2.4, p[1] - 4 - (2 - Math.abs(j)) * 1.4); } g.stroke(); }
    }
    stones(E, paths);
    g.restore();
    // 모래가 가장자리로 흘러내린다
    const lip = (a, b, seed) => { g.fillStyle = L.snow[0]; g.beginPath(); g.moveTo(a[0], a[1] - 1); along(a, b, 40, (x, y, i) => g.lineTo(x, y + 3 + 2.2 * Math.abs(Math.sin(i * 0.9 + seed)) + (i % 7 === 3 ? 6 : 0))); g.lineTo(b[0], b[1] - 1); g.closePath(); g.fill(); };
    lip(lc, bc, 0); lip(bc, rc, 5);
  }
  // 대추야자 — 마디진 줄기가 휘고, 꼭대기에 늘어진 잎과 대추 송이
  function datePalm(E, x, y, s, sd){
    const L = look(E); s *= 0.95; oval(x + 6, y + 1.5, 16 * s, 5 * s, L.shadow);
    const lean = (hash(sd) - 0.5) * 18 * s, top = [x + lean, y - 62 * s];
    for (let i = 0; i < 12; i++){ const f = i / 12, f2 = (i + 1) / 12, cx = x + lean * f * f, cy = y - 62 * s * f, cx2 = x + lean * f2 * f2, cy2 = y - 62 * s * f2, w = (4.2 - 1.4 * f) * s;
      poly([[cx - w, cy], [cx + w, cy], [cx2 + w * 0.92, cy2], [cx2 - w * 0.92, cy2]], tone(E, i % 2 ? '#a07450' : '#8a6040')); line([cx - w, cy], [cx + w, cy - 1], tone(E, '#6a4630'), 0.6); }
    for (let i = 0; i < 9; i++){ const a = -Math.PI / 2 + (i - 4) * 0.42 + (hash(sd * 3 + i) - 0.5) * 0.2, len = (30 + hash(sd + i) * 8) * s, droop = 14 * s * (0.6 + Math.abs(i - 4) / 4);
      const ex = top[0] + Math.cos(a) * len * 1.2, ey = top[1] + Math.sin(a) * len * 0.5 + droop, mx = top[0] + Math.cos(a) * len * 0.6, my = top[1] + Math.sin(a) * len * 0.5 - 4 * s;
      g.fillStyle = tone(E, i % 3 ? '#3f8a3e' : '#2f7034'); g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(mx, my - 4 * s, ex, ey); g.quadraticCurveTo(mx, my + 3 * s, top[0], top[1] + 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.5; g.stroke();
      g.strokeStyle = tone(E, '#6fb35a'); g.lineWidth = 0.6; g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(mx, my - 1, ex, ey); g.stroke();
      g.strokeStyle = tone(E, '#2a5a2c'); g.lineWidth = 0.5; g.beginPath(); for (let k = 2; k < 9; k++){ const t = k / 9, px = (1 - t) * (1 - t) * top[0] + 2 * t * (1 - t) * mx + t * t * ex, py = (1 - t) * (1 - t) * top[1] + 2 * t * (1 - t) * my + t * t * ey; g.moveTo(px, py); g.lineTo(px + (hash(k + i) - 0.5) * 2, py + 3.5 * s); } g.stroke(); }
    for (let i = 0; i < 6; i++) oval(top[0] - 4 * s + (i % 3) * 3 * s, top[1] + 4 * s + Math.floor(i / 3) * 2.5 * s, 1.6 * s, 1.6 * s, tone(E, i % 2 ? '#d07a2a' : '#b85a22'));
  }
  // 채집 자리 — 나무는 대추야자(베면 그루터기), 바위는 붉은 사암, 덤불은 대추나무 덤불(빨간 열매), 겨울 더미는 모래 둔덕
  function desertNode(E, kind, x, y, ready, seed){
    const L = look(E);
    if (kind === 'tree'){
      if (!ready){ oval(x + 2, y + 1, 10, 3.4, L.shadow); poly([[x - 4, y], [x + 4, y], [x + 3.4, y - 7], [x - 3.4, y - 7]], tone(E, '#8a6040'), true); oval(x, y - 7, 3.4, 1.4, tone(E, '#d8b088')); return; }
      return datePalm(E, x, y, 0.95 + hash(seed) * 0.2, seed);
    }
    if (kind === 'rock'){
      const s = ready ? 1 : 0.45, c = tone(E, '#c88a58'); oval(x + 2, y + 1.5, 14 * s, 4.5 * s, L.shadow);
      poly([[x - 13 * s, y], [x - 11 * s, y - 10 * s], [x - 3 * s, y - 14 * s], [x + 8 * s, y - 12 * s], [x + 13 * s, y - 4 * s], [x + 12 * s, y]], vgrad(y - 14 * s, y, [shade(c, 0.15), shade(c, -0.2)]), true);
      poly([[x + 1 * s, y - 13.5 * s], [x + 8 * s, y - 12 * s], [x + 13 * s, y - 4 * s], [x + 12 * s, y], [x + 3 * s, y]], 'rgba(90,30,10,.18)');
      if (ready) [[-9, -6], [-4, -9], [3, -5]].forEach(([dx, dy]) => line([x + dx, y + dy], [x + dx + 6, y + dy + 0.6], 'rgba(255,230,190,.35)', 0.6));
      return;
    }
    if (kind === 'snow'){                                                // 모래 둔덕 — 겨울엔 모래 속 조개껍데기
      oval(x + 2, y + 1, 13, 4, L.shadow); oval(x, y - 1, ready ? 12 : 8, ready ? 5 : 3, tone(E, '#f0cf96'));
      if (ready){ oval(x - 2, y - 3, 8, 3, tone(E, '#f8e0b0')); oval(x + 4, y - 2, 2, 1.4, tone(E, '#fff0e0')); oval(x - 4, y - 1, 1.6, 1, tone(E, '#f4c8b0')); }
      return;
    }
    // 대추나무 덤불 — 둥근 회녹색 잎 뭉치, 빨간 대추
    const Bs = [[-6, -6, 8], [5, -7, 8], [0, -11, 8]];
    oval(x + 2, y + 1, 14, 4.5, L.shadow);
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2] + 0.8, b[2] * 0.85 + 0.8, INK));
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.85, tone(E, '#6a8a4a')));
    [[-8, -9, 4], [3, -11, 4], [-2, -15, 4]].forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.5, tone(E, '#8aaa62')));
    if (ready) for (let i = 0; i < 7; i++){ const bx = x - 9 + hash(seed * 7 + i) * 18, by = y - 3 - hash(seed * 3 + i) * 8; oval(bx, by, 1.5, 1.7, tone(E, '#c0302a')); oval(bx - 0.4, by - 0.5, 0.5, 0.5, 'rgba(255,255,255,.7)'); }
  }
  // 흙벽 창 — 위가 둥근 아치, 나무 살. 밤이면 불빛
  function archWin(E, G, side, a, w, z, h){
    const pts = []; for (let i = 0; i <= 8; i++){ const f = i / 8, ang = Math.PI * f; pts.push([a + w / 2 - Math.cos(ang) * w / 2, z + h + Math.sin(ang) * w * 6]); }
    const P = (aa, zz) => faceAt(G, side, aa, zz);
    const frame = [P(a - 0.06, z - 1)].concat(pts.map(([aa, zz]) => P(aa < a + w / 2 ? aa - 0.06 : aa + 0.06, zz + 1)), [P(a + w + 0.06, z - 1)]);
    poly(frame, tone(E, '#f4e6cc'), true);
    poly([P(a, z)].concat(pts.map(([aa, zz]) => P(aa, zz)), [P(a + w, z)]), E.night ? look(E).win : tone(E, '#4a6e96'));
    for (let k = 1; k < 3; k++) line(P(a + w * k / 3, z), P(a + w * k / 3, z + h + w * 5), tone(E, '#6a4028'), 0.5);
    if (E.night){ const c = P(a + w / 2, z + h / 2); E.lamp(c[0], c[1], 22, '#ffcf7a'); }
  }
  // 말굽 아치 문 — 파란 칠, 놋 못
  function archDoor(E, G, side, a, w, h, col){
    const P = (aa, zz) => faceAt(G, side, aa, zz), arc = (i0, i1, sc) => { const o = []; for (let i = 0; i <= 10; i++){ const f = i / 10, ang = Math.PI * (1.15 - 1.3 * f); o.push(P(a + w / 2 + Math.cos(ang) * w / 2 * sc, h + Math.sin(ang) * w * 7 * sc)); } return o; };
    poly([P(a - 0.08, 0)].concat(arc(0, 10, 1.18), [P(a + w + 0.08, 0)]), tone(E, '#f4e6cc'), true);
    poly([P(a, 0)].concat(arc(0, 10, 1), [P(a + w, 0)]), tone(E, col));
    line(P(a + w / 2, 0), P(a + w / 2, h + w * 6), tone(E, shade(col, -0.3)), 0.5);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++){ const p = P(a + w * (0.25 + k * 0.5), 2.5 + j * h / 4.5); oval(p[0], p[1], 0.55, 0.55, tone(E, '#e8c070')); }
  }
  // 성가퀴 — 지붕 둘레 톱니
  function crenel(E, G, H, col){
    const nL = Math.round((G.u1 - G.u0) / 0.42), nR = Math.round((G.v1 - G.v0) / 0.42), top = tone(E, shade(col, 0.2));
    poly3([[G.u0, G.v0, H], [G.u1, G.v0, H], [G.u1, G.v1, H], [G.u0, G.v1, H]], tone(E, shade(col, -0.05)), true);
    for (let i = 0; i < nL; i += 2){ const a = G.u0 + (G.u1 - G.u0) * i / nL; box(a, G.v1 - 0.16, Math.min(G.u1, a + (G.u1 - G.u0) / nL), G.v1, H, H + 4, tone(E, col), { top }); }
    for (let i = 0; i < nR; i += 2){ const a = G.v1 - (G.v1 - G.v0) * i / nR; box(G.u1 - 0.16, Math.max(G.v0, a - (G.v1 - G.v0) / nR), G.u1, a, H, H + 4, tone(E, col), { top }); }
  }
  // ---------- 사막 꾸미개 넷(2026-10-09) ----------
  // 베르베르 천막 — 짙은 줄무늬 천 지붕(뒤가 높다), 앞에 붉은 양탄자와 방석 셋, 안에 매단 놋 등
  D.berber = (E, b) => {
    const u0 = b.x + 0.2, v0 = b.y + 0.2, u1 = b.x + b.w - 0.2, v1 = b.y + b.h - 0.35;
    foot(E, (u0 + u1) / 2, (v0 + v1) / 2 + 0.2, (u1 - u0) / 2, 0.7);
    poly3([[u0, v1 + 0.05, 0], [u1, v1 + 0.05, 0], [u1, v1 + 0.3, 0], [u0, v1 + 0.3, 0]], tone(E, '#b02a2a'), true);
    for (let i = 0; i < 5; i++){ const a = u0 + 0.2 + i * (u1 - u0 - 0.4) / 5; poly3([[a, v1 + 0.1, 0], [a + 0.25, v1 + 0.1, 0], [a + 0.25, v1 + 0.25, 0], [a, v1 + 0.25, 0]], tone(E, i % 2 ? '#e8b040' : '#2f4f9a')); }
    box(u0, v0, u1, v0 + 0.08, 0, 15, tone(E, '#5a3a2a'), { top: false });                            // 뒤 천 벽
    [[u0 + 0.5, '#e05a3a'], [(u0 + u1) / 2, '#e8b040'], [u1 - 0.5, '#3a6ab0']].forEach(([u, c]) => { const p = q(u, v1 - 0.25, 0); ovalI2(p[0], p[1] - 1.6, 4, 2.2, tone(E, c)); line([p[0] - 3, p[1] - 2], [p[0] + 3, p[1] - 1.4], 'rgba(255,255,255,.3)', 0.5); });
    const lp = q((u0 + u1) / 2, (v0 + v1) / 2, 12); line([lp[0], lp[1] - 5], lp, tone(E, '#3a2a20'), 0.5); ovalI2(lp[0], lp[1] + 2, 2, 2.6, E.night ? '#ffcf7a' : tone(E, '#c89a40')); if (E.night) E.lamp(lp[0], lp[1] + 2, 32, '#ffb860');
    [[u0, v1], [u1, v1], [(u0 + u1) / 2, v1]].forEach(([u, v]) => line(q(u, v, 0), q(u, v, 12), tone(E, '#6a4a30'), 1.2));
    const e = 0.2;
    poly3([[u0 - e, v0, 20], [u1 + e, v0, 20], [u1 + e + 0.1, v1 + 0.05, 12], [u0 - e - 0.1, v1 + 0.05, 12]], tone(E, '#4a3028'), true);
    for (let i = 1; i < 9; i++){ const f = i / 9; line(q(u0 - e + (u1 - u0 + 2 * e) * f, v0, 20), q(u0 - e - 0.1 + (u1 - u0 + 2 * e + 0.2) * f, v1 + 0.05, 12), tone(E, i % 2 ? '#e8d0a0' : '#a03a2a'), 1.1); }
    poly3([[u1 + e + 0.1, v1 + 0.05, 12], [u1 + e, v0, 20], [u1, v0, 0], [u1, v1, 0]], tone(E, '#3a2420'), true);
    for (let i = 0; i < 7; i++){ const p = q(u0 - e - 0.1 + (u1 - u0 + 2 * e + 0.2) * (i + 0.5) / 7, v1 + 0.05, 12); poly([[p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] + 2.2]], tone(E, '#e8b040')); }   // 술 장식
  };
  // 모자이크 분수 — 팔각 돌 수반에 파란·흰 별무늬 타일, 가운데 물줄기(live)
  D.zellige = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), x = c[0], y = c[1], L = look(E), rx = 30, ry = 14, h = 8;
    oval(x + 3, y + 3, rx + 4, ry + 3, L.shadow);
    const ring = (r1, r2, z) => { const o = []; for (let i = 0; i < 8; i++){ const a = (i + 0.5) / 8 * TAU; o.push([x + Math.cos(a) * r1, y - z + Math.sin(a) * r2]); } return o; };
    const top = ring(rx, ry, h), bot = ring(rx, ry, 0);
    for (let i = 0; i < 8; i++){ const j = (i + 1) % 8; if (top[i][1] + top[j][1] < 2 * (y - h)) continue;
      poly([top[i], top[j], bot[j], bot[i]], tone(E, i % 2 ? '#f4f0e6' : '#e8e2d4'), true);
      const m = [(top[i][0] + top[j][0] + bot[i][0] + bot[j][0]) / 4, (top[i][1] + top[j][1] + bot[i][1] + bot[j][1]) / 4];
      poly([[m[0], m[1] - 3], [m[0] + 2.4, m[1]], [m[0], m[1] + 3], [m[0] - 2.4, m[1]]], tone(E, i % 2 ? '#2f6fb0' : '#1a8a8a')); oval(m[0], m[1], 0.8, 0.8, tone(E, '#e8b040')); }
    poly(top, tone(E, '#d8d0c0'), true); poly(ring(rx - 3.5, ry - 1.8, h), E.night ? '#1e3e6e' : tone(E, '#3ab8d8'));
    oval(x - 6, y - h - 2, 10, 2.4, 'rgba(255,255,255,.22)');
    // 가운데 기둥과 위 접시
    R(x - 2.4, y - h - 14, 4.8, 14, tone(E, '#f4f0e6')); g.strokeStyle = INK; g.lineWidth = 0.5; g.strokeRect(x - 2.4, y - h - 14, 4.8, 14);
    for (let k = 0; k < 3; k++) R(x - 2.4, y - h - 12 + k * 4, 4.8, 1.2, tone(E, '#2f6fb0'));
    ovalI2(x, y - h - 15, 9, 3.4, tone(E, '#e8e2d4')); oval(x, y - h - 15.4, 7, 2.4, E.night ? '#2a4e8a' : tone(E, '#5ac8e8'));
  };
  D.zelligeLive = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), x = c[0], y = c[1] - 8 - 15, t = STILL ? 0 : E.t;
    g.strokeStyle = E.night ? 'rgba(170,210,255,.6)' : 'rgba(220,245,255,.9)'; g.lineWidth = 1.1; g.lineCap = 'round';
    for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.3, dx = Math.cos(a), dy = Math.sin(a) * 0.45; g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + dx * 6, y - 11, x + dx * 12, y + 4 + dy * 4); g.stroke(); }
    R(x - 0.8, y - 12, 1.6, 7, 'rgba(255,255,255,.85)');
    for (let i = 0; i < 6; i++){ const a = i / 6 * TAU + 0.3, k = (t * 1.4 + i * 0.17) % 1; oval(x + Math.cos(a) * 12, y + 4 + Math.sin(a) * 2 + 8, 1.4 + k * 3, 0.6 + k, 'rgba(255,255,255,' + (0.5 * (1 - k)).toFixed(2) + ')'); }
    if (E.night) E.lamp(x, y + 6, 26, '#9ad8ff');
  };
  // 요술 램프 — 돌 받침 위 금빛 램프, 주둥이에서 반짝이는 연기
  D.genielamp = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E);
    oval(x + 1.5, y + 1, 8, 2.6, L.shadow);
    box(b.x + 0.25, b.y + 0.3, b.x + 0.75, b.y + 0.8, 0, 9, tone(E, '#d8b088'), { top: tone(E, '#b02a2a') });
    const ly = y - 13;
    g.beginPath(); g.moveTo(x - 6, ly); g.quadraticCurveTo(x - 6, ly - 6, x, ly - 6); g.quadraticCurveTo(x + 5, ly - 6, x + 6, ly - 3); g.lineTo(x + 12, ly - 6); g.lineTo(x + 12.5, ly - 5); g.quadraticCurveTo(x + 7, ly + 0.5, x + 3, ly + 1); g.lineTo(x - 4, ly + 1); g.closePath();
    g.fillStyle = lin(x - 6, ly - 6, x + 6, ly + 1, [tone(E, '#fff0a0'), tone(E, '#e8b030'), tone(E, '#a87010')]); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.6; g.stroke();
    g.beginPath(); g.ellipse(x - 7.5, ly - 2.5, 2.4, 3, 0, Math.PI * 0.4, Math.PI * 1.6); g.strokeStyle = tone(E, '#c89030'); g.lineWidth = 1.2; g.stroke();
    oval(x - 0.5, ly - 6.8, 3, 1.2, tone(E, '#e8b030')); oval(x - 0.5, ly - 8.3, 1, 1.3, tone(E, '#fff0a0'));
    oval(x - 2.5, ly - 4, 1.6, 0.8, 'rgba(255,255,255,.6)');
    if (E.night){ E.lamp(x, ly - 3, 22, '#ffd060'); }
  };
  D.genielampLive = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0] + 12.5, y = p[1] - 19, t = STILL ? 0 : E.t;
    for (let i = 0; i < 5; i++){ const k = (t * 0.35 + i / 5) % 1, px = x + Math.sin(k * 6 + i) * 3 + k * 4, py = y - k * 22, r = 1.5 + k * 3.5; oval(px, py, r, r * 0.8, 'rgba(200,170,255,' + (0.45 * (1 - k)).toFixed(2) + ')'); }
    const s = Math.pow(Math.max(0, Math.sin(t * 2.2)), 4) * 2.6; if (s > 0.3){ g.fillStyle = 'rgba(255,250,210,.95)'; g.beginPath(); g.moveTo(x, y - 8 - s); g.lineTo(x + s * 0.4, y - 8); g.lineTo(x, y - 8 + s); g.lineTo(x - s * 0.4, y - 8); g.closePath(); g.fill(); }
  };
  // 별 망원경 — 나무 세 다리 위 놋쇠 통, 하늘을 비스듬히 본다
  D.telescope = (E, b) => {
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0], y = p[1], L = look(E), top = [x, y - 20];
    oval(x + 1.5, y + 1, 9, 2.8, L.shadow);
    [[-7, 1], [7, 1], [1, 3.5]].forEach(([dx, dy]) => line(top, [x + dx, y + dy], tone(E, '#7a5030'), 1.5));
    g.save(); g.translate(top[0], top[1] - 2); g.rotate(-0.55);
    R(-12, -2.6, 22, 5.2, lin(0, -2.6, 0, 2.6, [tone(E, '#f8e0a0'), tone(E, '#d8a840'), tone(E, '#8a6020')])); g.strokeStyle = INK; g.lineWidth = 0.5; g.strokeRect(-12, -2.6, 22, 5.2);
    R(10, -3.4, 4, 6.8, tone(E, '#b88a30')); g.strokeRect(10, -3.4, 4, 6.8); R(-15, -1.6, 3, 3.2, tone(E, '#6a4a20'));
    [-6, 2].forEach(k => R(k, -2.6, 1.2, 5.2, tone(E, '#a87a28')));
    oval(14, 0, 0.8, 3.2, E.night ? '#a0c8ff' : '#3a5a8a');
    g.restore();
    oval(top[0], top[1] - 2, 2, 2, tone(E, '#5a3a1a'));
  };
  // 사막 장미 돌 — 모래 위에 꽃잎처럼 겹친 붉은 모래 결정(낮에 줍는 것). 햇살에 끝이 반짝
  function sandRose(x, y, t){
    oval(x + 1, y + 0.6, 6, 1.8, 'rgba(120,70,30,.25)');
    const pet = (cx, cy, w, h, a, c1, c2) => { g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 0.8, -h, 0, -h * 1.05); g.quadraticCurveTo(w * 0.8, -h, w, 0); g.quadraticCurveTo(0, h * 0.25, -w, 0); g.fillStyle = lin(0, -h, 0, 0, [c1, c2]); g.fill(); g.strokeStyle = 'rgba(90,40,20,.7)'; g.lineWidth = 0.45; g.stroke(); g.restore(); };
    [[-3.6, -1, 2.6, 3.4, -0.6], [3.6, -1, 2.6, 3.4, 0.6], [0, -1.6, 2.8, 4, 0], [-2, -3.4, 2.2, 3.4, -0.35], [2.2, -3.6, 2.2, 3.2, 0.4], [0, -4.6, 2, 3.6, 0.05]].forEach(([dx, dy, w, h, a], i) => pet(x + dx, y + dy, w, h, a, i % 2 ? '#f6d2b0' : '#f0c098', i % 2 ? '#c88058' : '#b86a48'));
    const s = Math.pow(Math.max(0, Math.sin(t * 2.4 + x * 0.3)), 3) * 2.8;
    if (s > 0.3){ const px = x + 1.5, py = y - 8; g.fillStyle = 'rgba(255,255,240,.95)'; g.beginPath(); g.moveTo(px, py - s); g.quadraticCurveTo(px, py, px + s, py); g.quadraticCurveTo(px, py, px, py + s); g.quadraticCurveTo(px, py, px - s, py); g.quadraticCurveTo(px, py, px, py - s); g.fill(); }
  }
  const ovalI2 = (x, y, rx, ry, c) => ovI(x, y, rx, ry, c);
  const DB = {};
  // 집 — 흙벽 카스바: 평지붕 성가퀴, 들보 끝, 말굽 아치 파란 문, 뒤 모서리 탑, 문 옆 용설란 화분
  DB.house = (E, b, night) => {
    const G = geo(b, 0.25, 30), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, c = tone(E, SAND);
    footBox(E, G);
    // 탑 — 뒤 모서리(먼저 그려 앞 벽이 덮는다)
    const t = q(G.u0 + 0.45, G.v0 + 0.45, 0), r0 = 9, r1 = 8, h = 48;
    tower(E, t[0], t[1], r0, r1, h, c);
    for (let i = 0; i < 4; i++){ const p = onTower(t[0], t[1], r0, r1, h, h, -0.75 + i * 0.5); R(p[0] - 1.6, p[1] - 4, 3.2, 4, tone(E, shade(SAND, 0.12))); }
    { const w = onTower(t[0], t[1], r0, r1, h, 36, 0.3); R(w[0] - 1.6, w[1] - 6, 3.2, 6, night ? look(E).win : tone(E, '#4a6a8a')); if (night) E.lamp(w[0], w[1] - 3, 18, '#ffcf7a'); }
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, SAND, { top: false, left: vgrad(q(G.u0, G.v1, G.H)[1], q(G.u0, G.v1, 0)[1], [tone(E, shade(SAND, 0.1)), tone(E, shade(SAND, -0.06))]), right: vgrad(q(G.u1, G.v0, G.H)[1], q(G.u1, G.v0, 0)[1], [tone(E, shade(SAND, -0.18)), tone(E, shade(SAND, -0.3))]) });
    // 흙벽 얼룩·밑동 붉은 띠
    onFace(G, 'L', 0, lenL, 0, 3, tone(E, '#c47a48')); onFace(G, 'R', 0, lenR, 0, 3, tone(E, '#a8643a'));
    for (let i = 0; i < 6; i++){ const p = q(G.u0 + 0.35 + i * (lenL - 0.5) / 5, G.v1, G.H - 4); oval(p[0], p[1], 1.1, 1.1, tone(E, '#6a4028')); }
    for (let i = 0; i < 3; i++){ const p = q(G.u1, G.v1 - 0.4 - i * (lenR - 0.6) / 2, G.H - 4); oval(p[0], p[1], 1, 1, tone(E, '#5a3420')); }
    crenel(E, G, G.H, SAND);
    archDoor(E, G, 'L', lenL / 2 - 0.4, 0.8, 13, '#2f6fb0');
    archWin(E, G, 'L', 0.35, 0.55, 12, 6); archWin(E, G, 'L', lenL - 0.9, 0.55, 12, 6); archWin(E, G, 'R', lenR / 2 - 0.3, 0.6, 12, 6);
    // 문 위 놋 등
    const lp = faceAt(G, 'L', lenL / 2 + 0.55, 20); line([lp[0], lp[1] - 3], lp, tone(E, '#3a2a20'), 0.5);
    poly([[lp[0] - 1.8, lp[1]], [lp[0] + 1.8, lp[1]], [lp[0] + 1.2, lp[1] + 4], [lp[0] - 1.2, lp[1] + 4]], night ? '#ffd27a' : tone(E, '#c8963a'), true); if (night) E.lamp(lp[0], lp[1] + 2, 30, '#ffc070');
    // 용설란 화분
    const pp = q(G.u0 + lenL / 2 + 0.85, G.v1 + 0.25, 0); ovI(pp[0], pp[1] - 3, 3.6, 4, tone(E, '#b8602e')); for (let i = 0; i < 7; i++){ const a = -Math.PI / 2 + (i - 3) * 0.38; poly([[pp[0] - 1, pp[1] - 6], [pp[0] + Math.cos(a) * 9, pp[1] - 6 + Math.sin(a) * 9], [pp[0] + 1, pp[1] - 6]], tone(E, '#5a9a74')); }
  };
  // 가게 — 시장 노점: 쪽빛·모래 줄무늬 차양, 향신료 산, 매달린 놋 등. part 'back' | 'front'(사이에 가게 아저씨)
  DB.stall = (E, b, night, part) => {
    const G = geo(b, 0.15, 0), u0 = G.u0, u1 = G.u1, v0 = G.v0, v1 = G.v1;
    if (part !== 'front'){
      footBox(E, G);
      box(u0, v0, u1, v0 + 0.25, 0, 30, tone(E, '#9a6240'), { top: false });
      // 뒤 선반 — 양탄자 두루마리와 놋 주전자
      for (let z = 10; z < 28; z += 9) box(u0 + 0.05, v0 + 0.25, u1 - 0.05, v0 + 0.55, z, z + 1.5, tone(E, '#6a4430'));
      ['#b02a2a', '#2f4f9a', '#e8b040', '#3a8a5a', '#b02a2a'].forEach((cc, i) => { const p = q(u0 + 0.3 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 11.5); oval(p[0], p[1] - 2, 3, 2, tone(E, cc)); oval(p[0] + 1.6, p[1] - 2, 1, 1.6, tone(E, shade(cc, -0.3)));
        const p2 = q(u0 + 0.45 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 20.5); poly([[p2[0] - 1.6, p2[1]], [p2[0] + 1.6, p2[1]], [p2[0] + 1, p2[1] - 3.4], [p2[0] - 1, p2[1] - 3.4]], tone(E, '#c8963a')); line([p2[0] + 1.4, p2[1] - 2.6], [p2[0] + 3, p2[1] - 3.6], tone(E, '#c8963a'), 0.6); });
      post(E, u0 + 0.05, v0 + 0.1, 0, 78, '#6a4028'); post(E, u1 - 0.05, v0 + 0.1, 0, 78, '#6a4028');
      return;
    }
    post(E, u0 + 0.05, v1 - 0.1, 0, 71, '#6a4028'); post(E, u1 - 0.05, v1 - 0.1, 0, 71, '#6a4028');
    box(u0 + 0.1, v1 - 0.55, u1 - 0.1, v1 - 0.1, 0, 12, tone(E, '#b07a50'));
    onFace({ u0: u0 + 0.1, u1: u1 - 0.1, v0: v1 - 0.55, v1: v1 - 0.1 }, 'L', 0, u1 - u0 - 0.2, 3, 8, tone(E, '#b02a2a'));                          // 앞에 건 양탄자
    for (let a = 0.15; a < u1 - u0 - 0.3; a += 0.3) onFace({ u0: u0 + 0.1, u1: u1 - 0.1, v0: v1 - 0.55, v1: v1 - 0.1 }, 'L', a, a + 0.14, 4.5, 6.5, tone(E, a % 0.6 < 0.3 ? '#e8b040' : '#2f4f9a'));
    // 향신료 산 — 사프란·파프리카·쿠민·강황
    [[0.3, '#d8a020'], [0.75, '#c0402a'], [1.2, '#7a8a30'], [1.65, '#e07a2a']].forEach(([a, cc]) => {
      if (u0 + a > u1 - 0.3) return; const p = q(u0 + a + 0.15, v1 - 0.33, 12); ovI(p[0], p[1], 4, 1.6, tone(E, '#8a5a3c'));
      poly([[p[0] - 3.4, p[1]], [p[0], p[1] - 6], [p[0] + 3.4, p[1]]], tone(E, cc), true); oval(p[0] - 1, p[1] - 3.5, 1, 0.7, 'rgba(255,255,255,.35)'); });
    // 차양 — 앞으로 기운 줄무늬 천(오로라 노점과 같은 높이 — 아저씨 얼굴이 보이게)
    const n = 8, zt = 79, va = v0 - 0.05, vb = v1 + 0.3, zb = 72;
    for (let i = 0; i < n; i++){ const a0 = u0 - 0.15 + (u1 - u0 + 0.3) * i / n, a1 = u0 - 0.15 + (u1 - u0 + 0.3) * (i + 1) / n; poly3([[a0, va, zt], [a1, va, zt], [a1, vb, zb], [a0, vb, zb]], tone(E, i % 2 ? '#f2e2c0' : '#2f4f9a')); }
    poly3([[u0 - 0.15, va, zt], [u1 + 0.15, va, zt], [u1 + 0.15, vb, zb], [u0 - 0.15, vb, zb]], null, true);
    for (let i = 0; i < n; i++){ const p = q(u0 - 0.15 + (u1 - u0 + 0.3) * (i + 0.5) / n, vb, zb); g.beginPath(); g.arc(p[0], p[1], 2.4, 0, Math.PI); g.fillStyle = tone(E, i % 2 ? '#f2e2c0' : '#2f4f9a'); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.4; g.stroke(); }
    [u0 + 0.25, u1 - 0.25].forEach(u => { const p = q(u, vb - 0.05, zb - 3); line([p[0], p[1] - 4], p, tone(E, '#3a2a20'), 0.5); poly([[p[0] - 2.2, p[1]], [p[0] + 2.2, p[1]], [p[0] + 1.4, p[1] + 5], [p[0] - 1.4, p[1] + 5]], night ? '#ffcf7a' : tone(E, '#c89a40'), true); poly([[p[0] - 1.2, p[1]], [p[0], p[1] - 2.4], [p[0] + 1.2, p[1]]], tone(E, '#a07020')); if (night) E.lamp(p[0], p[1] + 2.5, 28, '#ffb860'); });
  };
  // 외양간 — 흙벽 큰 헛간: 야자 들보 평지붕에 차양, 나무 큰 문(아치), 둥근 환기창
  DB.barn = (E, b) => {
    const G = geo(b, 0.15, 30), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, col = '#d2925c';
    footBox(E, G);
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, col), { top: false });
    onFace(G, 'L', 0, lenL, 0, 3, tone(E, '#b0703e')); onFace(G, 'R', 0, lenR, 0, 3, tone(E, '#965c32'));
    for (let i = 0; i < 7; i++){ const p = q(G.u0 + 0.25 + i * (lenL - 0.4) / 6, G.v1, G.H - 3); oval(p[0], p[1], 1.1, 1.1, tone(E, '#6a4028')); }
    crenel(E, G, G.H, col);
    // 큰 나무 문 — 위가 둥근 두 짝, 가로 띠
    const da = lenL / 2 - 0.55, P = (aa, zz) => faceAt(G, 'L', aa, zz), arc = []; for (let i = 0; i <= 10; i++){ const ang = Math.PI * i / 10; arc.push(P(da + 0.55 - Math.cos(ang) * 0.55, 17 + Math.sin(ang) * 6)); }
    poly([P(da - 0.08, 0)].concat(arc.map(p => p), [P(da + 1.18, 0)]), tone(E, '#f4e6cc'), true);
    poly([P(da, 0)].concat(arc, [P(da + 1.1, 0)]), tone(E, '#7a4a2a'));
    line(P(da + 0.55, 0), P(da + 0.55, 23), tone(E, '#4a2a18'), 0.7); [5, 13].forEach(z => line(P(da, z), P(da + 1.1, z), tone(E, '#5a3420'), 0.8));
    for (let i = 1; i < 6; i++) line(P(da + 0.1 + i * 0.16, 0.5), P(da + 0.1 + i * 0.16, 15), 'rgba(40,20,10,.3)', 0.4);
    archWin(E, G, 'R', 0.45, 0.55, 14, 5); archWin(E, G, 'R', lenR - 1, 0.55, 14, 5);
    // 앞 차양 — 야자 잎 지붕을 장대 둘이 받친다
    const vf = G.v1 + 0.55; post(E, G.u0 + 0.3, vf, 0, 22, '#6a4028', 0.9); post(E, G.u1 - 0.3, vf, 0, 22, '#6a4028', 0.9);
    poly3([[G.u0 + 0.1, G.v1, 26], [G.u1 - 0.1, G.v1, 26], [G.u1 - 0.1, vf + 0.15, 21], [G.u0 + 0.1, vf + 0.15, 21]], tone(E, '#c8a050'), true);
    for (let i = 0; i < 18; i++){ const u = G.u0 + 0.15 + (lenL - 0.3) * i / 17; line(q(u, G.v1, 26), q(u + 0.03, vf + 0.15, 20.4 - (i % 2) * 1.4), tone(E, i % 2 ? '#a08038' : '#d8b060'), 0.6); }
    // 지붕 위 물 항아리
    const jp = q(G.u0 + 0.6, G.v0 + 0.6, G.H); ovI(jp[0], jp[1] - 4, 4, 4.4, tone(E, '#b8602e')); oval(jp[0], jp[1] - 8.2, 1.8, 0.8, tone(E, '#5a2a18'));
  };
  // 닭장 — 흙벽 작은 집, 짚 얹은 지붕, 둥근 구멍, 경사로
  DB.coop = (E, b) => {
    const G = geo(b, 0.25, 16), lenL = G.u1 - G.u0, col = '#e0aa70';
    footBox(E, G);
    box(G.u0, G.v0, G.u1, G.v1, 0, G.H, tone(E, col), { top: false });
    onFace(G, 'L', 0, lenL, 0, 2.4, tone(E, '#b8783e'));
    const d = faceAt(G, 'L', lenL / 2, 5); ovI(d[0], d[1] - 1, 2.6, 3.4, tone(E, '#3a2420')); R(d[0] - 2.6, d[1] - 1, 5.2, 4, tone(E, '#3a2420'));
    archWin(E, G, 'R', 0.35, 0.45, 8, 3);
    // 짚 지붕 — 둥글게 부푼 덮개
    const e = 0.2, ps = [[G.u0 - e, G.v1 + e], [G.u1 + e, G.v1 + e], [G.u1 + e, G.v0 - e], [G.u0 - e, G.v0 - e]].map(([u, v]) => q(u, v, G.H)), tp = q((G.u0 + G.u1) / 2, (G.v0 + G.v1) / 2, G.H + 12);
    poly([ps[0], ps[1], tp], tone(E, '#d8b060'), true); poly([ps[1], ps[2], tp], tone(E, '#b89040'), true);
    g.strokeStyle = 'rgba(110,70,20,.4)'; g.lineWidth = 0.5; g.beginPath(); for (let k = 1; k < 8; k++){ const f = k / 8; [[ps[0], ps[1]], [ps[1], ps[2]]].forEach(([A, Bq]) => { g.moveTo(A[0] + (Bq[0] - A[0]) * f, A[1] + (Bq[1] - A[1]) * f); g.lineTo(tp[0], tp[1]); }); } g.stroke();
    g.fillStyle = tone(E, '#c8a050'); g.beginPath(); g.moveTo(ps[0][0], ps[0][1]); for (let k = 0; k <= 16; k++){ const A = k <= 8 ? ps[0] : ps[1], Bq = k <= 8 ? ps[1] : ps[2], f = k <= 8 ? k / 8 : k / 8 - 1; g.lineTo(A[0] + (Bq[0] - A[0]) * f, A[1] + (Bq[1] - A[1]) * f + (k % 2 ? 3 : 1)); } g.lineTo(ps[2][0], ps[2][1]); g.closePath(); g.fill();
    poly3([[G.u0 + lenL / 2 - 0.18, G.v1 + 0.6, 0], [G.u0 + lenL / 2 + 0.18, G.v1 + 0.6, 0], [G.u0 + lenL / 2 + 0.18, G.v1, 3], [G.u0 + lenL / 2 - 0.18, G.v1, 3]], tone(E, '#b07a50'), true);
  };
  const DF = {};
  // 연못 → 오아시스: 모래 둔덕, 청록 물, 갈대, 연잎, 물결
  DF.pond = (E, b) => {
    const cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), r1 = q(b.x + b.w - 0.2, cv, 0), r2 = q(cu, b.y + b.h - 0.2, 0);
    const rx = Math.hypot(r1[0] - c[0], r1[1] - c[1]) * 0.98, ry = Math.abs(r2[1] - c[1]) + rx * 0.2;
    g.save(); g.translate(c[0], c[1]);
    oval(0, 1.4, rx + 4, ry + 3, tone(E, '#c79a62')); oval(0, 0, rx + 2, ry + 1.6, tone(E, '#ecca92'));
    oval(0, 0.5, rx, ry, lin(-rx, -ry, rx, ry, E.night ? ['#2a4a7a', '#163058'] : ['#4ad0d0', '#1e8fb0']));
    oval(0, -ry * 0.2, rx * 0.8, ry * 0.5, E.night ? 'rgba(160,190,255,.12)' : 'rgba(255,255,255,.18)');
    if (E.night) oval(rx * 0.25, -ry * 0.1, 4, 1.4, 'rgba(255,231,176,.6)');
    for (let i = 0; i < 4; i++){ const x = -rx * 0.55 + i * rx * 0.35 + Math.sin(E.t * 0.6 + i) * 1.5, y = -ry * 0.3 + (i % 2) * ry * 0.45; curve([[x - 4, y], [x, y - 1], [x + 4, y]], 'rgba(255,255,255,.35)', 0.6); }
    [[-0.38, 0.25], [0.42, -0.25], [0.15, 0.45]].forEach(([fx, fy], i) => { const x = fx * rx, y = fy * ry; ovI(x, y, 4.2, 2, tone(E, '#4a9a4a')); poly([[x, y], [x + 4, y - 1], [x + 4, y + 1]], E.night ? '#264a7a' : '#2aa0b8'); if (i === 1) oval(x - 1, y - 2, 1.6, 1.2, tone(E, '#f4a0c0')); });
    [[-rx * 0.97, -ry * 0.1], [-rx * 0.88, ry * 0.3], [rx * 0.9, ry * 0.2]].forEach(([x, y]) => { for (let k = 0; k < 6; k++){ const a = -Math.PI / 2 + (k - 2.5) * 0.18; curve([[x + k, y], [x + k + Math.cos(a) * 6, y + Math.sin(a) * 8], [x + k + Math.cos(a) * 10, y + Math.sin(a) * 15]], tone(E, '#5a8a3a'), 0.9); } oval(x + 3, y - 15, 1, 3, tone(E, '#7a4a2a')); });
    g.restore();
  };
  // 목장 바닥 — 다져진 모래, 마른 짚
  DF.pasture = (E, b) => {
    poly3([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + b.h - 0.1, 0], [b.x + 0.1, b.y + b.h - 0.1, 0]], E.night ? 'rgba(30,20,50,.18)' : 'rgba(170,100,50,.14)');
    for (let i = 0; i < 26; i++){ const p = q(b.x + 0.3 + hash(i * 3 + b.x) * (b.w - 0.6), b.y + 0.3 + hash(i * 7 + b.y) * (b.h - 0.6), 0); line([p[0] - 2, p[1]], [p[0] + 2, p[1] - 0.6], tone(E, '#c8a050'), 0.5); }
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
    // 농장·방 캔버스는 도트용으로 부드럽게 줄이기를 꺼 둔다 — 큰 그림을 그대로 줄이면 눈 줄이 빠져 찌그러진다(2026-10-09 로키즈 「연아 눈」)
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.translate(x, y - (swing && frame % 2 ? 0.6 : 0)); if (r[1]) g.scale(-1, 1);
    if (swing){
      const Pt = partsOf(k, im), th = (frame - 1) / 4 * TAU + 0.6;
      g.scale(sc, sc); g.translate(-A.cx, -A.foot);
      leg(Pt, A, 'far', th); leg(Pt, A, 'near', th + Math.PI); g.drawImage(Pt.body, 0, 0);
    } else g.drawImage(im, frame * A.w, r[0] * A.h, A.w, A.h, -A.cx * sc, -A.foot * sc, A.w * sc, A.h * sc);
    g.restore();
    return true;
  }

  // ---------- 바깥에 내놓는 것 ----------
  const LIVE = { zellige: D.zelligeLive, genielamp: D.genielampLive, swing: D.swingLive, firepit: D.firepitLive, flag: D.flagLive, windmill: D.windmillLive, koinobori: D.koinoboriLive, sauna: D.saunaLive, lavvu: D.lavvuLive, icesculpt: D.icesculptLive };
  function thing(gg, E, id, b, night, part){ g = gg; P3 = (u, v, z) => E.P(u, v, z); const f = (E.farm === 'desert' && DB[id]) || B[id] || D[id]; if (!f) return false; f(E, b, night, part); return true; }
  function floor(gg, E, id, b){ g = gg; P3 = (u, v, z) => E.P(u, v, z); const f = (E.farm === 'desert' && DF[id]) || F[id]; if (!f) return false; f(E, b); return true; }
  function live(gg, E, id, b){ g = gg; P3 = (u, v, z) => E.P(u, v, z); const f = LIVE[id]; if (f) f(E, b); return !!f; }
  const has = id => !!(B[id] || D[id]);
  const hasLive = id => !!LIVE[id];
  // 내리는 눈 — 화면 기준
  const flakes = Array.from({ length: 90 }, (_, i) => ({ x: hash(i * 3 + 1), y: hash(i * 7 + 2), s: 0.35 + hash(i * 11) * 0.8, ph: hash(i) * TAU }));
  function snowfall(gg, E){
    g = gg; if (E.farm === 'desert') return;                             // 사막엔 눈이 안 온다 g.fillStyle = 'rgba(255,255,255,.85)';
    flakes.forEach(f => { const x = ((f.x * E.w + Math.sin(E.t * 0.7 + f.ph) * 8 - E.t * 3.5 * f.s) % E.w + E.w) % E.w, y = ((f.y * E.h + E.t * 11 * f.s) % E.h + E.h) % E.h; g.beginPath(); g.arc(x, y, f.s, 0, TAU); g.fill(); });
  }

  // ---------- 빛 조각 — 땅에서 살짝 떠 반짝이는 오로라 결정(줍는 물건, 2026-10-09) ----------
  // (x, y) = 바닥 한 점(도트), t = 초. 큰 결정 하나와 양옆 작은 결정 둘, 둘레 빛 번짐, 끝 반짝임, 둘레를 도는 빛 알갱이. 빛을 내는 것이라 밤에도 누르지 않는다
  function crystal(x, y, w, h, lean, cl, cr){
    const top = [x + lean, y - h], l = [x - w, y - h * 0.32], bot = [x - lean * 0.3, y + h * 0.42], r = [x + w, y - h * 0.28], mid = [x + lean * 0.4, y - h * 0.15];
    poly([top, l, bot, mid], lin(top[0], top[1], bot[0], bot[1], cl)); poly([top, mid, bot, r], lin(top[0], top[1], bot[0], bot[1], cr));
    poly([top, l, mid], 'rgba(255,255,255,.35)');
    path([top, l, bot, r]); g.strokeStyle = 'rgba(16,40,70,.75)'; g.lineWidth = 0.5; g.lineJoin = 'round'; g.stroke();
    line([top[0] - w * 0.35, top[1] + h * 0.3], [bot[0] - w * 0.3, bot[1] - h * 0.3], 'rgba(255,255,255,.7)', 0.35);
  }
  function shard(gg, E, x, y, t){
    g = gg; t = STILL ? 0 : t;
    if (E.farm === 'desert') return sandRose(x, y, t);
    const bob = Math.sin(t * 2.2 + x * 0.13) * 1.1, cy = y - 8.5 - bob, k = 0.5 + 0.5 * Math.sin(t * 0.9 + y * 0.07);
    const col = mix('#6affc0', '#b58cff', k), cc = 'rgba(' + rgb(col).join(',') + ',';
    oval(x, y, 4 - bob * 0.4, 1.4, 'rgba(10,16,40,.22)');
    if (E.night){ g.save(); g.globalCompositeOperation = 'lighter'; glow(x, y, 8, cc, 0.3); glow(x, cy - 1, 12, cc, 0.36); g.restore(); }
    else { glow(x, y, 7, cc, 0.3); glow(x, cy - 1, 11, cc, 0.28); }
    const motes = [0, 1, 2].map(i => { const a = t * 1.6 + i * TAU / 3; return { x: x + Math.cos(a) * 7, y: cy + 1 + Math.sin(a) * 2.4, front: Math.sin(a) > 0, a: 0.5 + 0.4 * Math.sin(t * 3 + i) }; });
    const mote = m => { g.save(); g.globalCompositeOperation = 'lighter'; oval(m.x, m.y, 1.6, 1.6, cc + (m.a * 0.35).toFixed(2) + ')'); oval(m.x, m.y, 0.55, 0.55, 'rgba(255,255,255,' + m.a.toFixed(2) + ')'); g.restore(); };
    motes.filter(m => !m.front).forEach(mote);
    crystal(x - 3.3, cy + 2.4, 1.6, 4.6, -1.3, ['#f4ecff', '#c4a0ff', '#7a5ae0'], ['#c8a8ff', '#8a64e8', '#5a3ab8']);
    crystal(x + 3.1, cy + 2.8, 1.5, 4, 1.1, ['#eafffa', '#7af0e0', '#3ab8d0'], ['#9ae8ff', '#3a9ad8', '#2a6ab0']);
    crystal(x, cy, 2.6, 7, 0.3, ['#f2fff8', '#7affd0', '#4ac8e8'], [mix('#9ae8ff', '#c8a8ff', k), mix('#4a9ae0', '#8a64e8', k), '#5a4ac0']);
    motes.filter(m => m.front).forEach(mote);
    const s = Math.pow(Math.max(0, Math.sin(t * 2.6 + x * 0.3)), 3) * 3.2;
    if (s > 0.3){ const px = x + 0.3, py = cy - 7; g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.moveTo(px, py - s); g.quadraticCurveTo(px, py, px + s, py); g.quadraticCurveTo(px, py, px, py + s); g.quadraticCurveTo(px, py, px - s, py); g.quadraticCurveTo(px, py, px, py - s); g.fill(); }
    if (E.night && E.lamp) E.lamp(x, cy, 24, col);
  }

  // ================= 시험 장면(_aurora-test.html) =================
  // 농장과 같은 그림을 로그인 없이 본다 — 건물·꾸미개를 모두 한 섬에 늘어놓는다
  function mount(cv, opts){
    opts = opts || {};
    const COLS = 26, ROWS = 20, IT = 40, IH = 20, TOP = 108, CLIFF = 72, AW = (COLS + ROWS) * IT / 2, AH = TOP + (COLS + ROWS) * IH / 2 + CLIFF + 12, OX = ROWS * IT / 2;
    const g2 = cv.getContext('2d'), lamps = [], t0 = performance.now();
    let K = 1, DPR = 1, last = 0;
    const E = { P: (u, v, z) => [OX + (u - v) * IT / 2, TOP + (u + v) * IH / 2 - (z || 0)], cols: COLS, rows: ROWS, top: TOP, cliff: CLIFF, w: AW, h: AH, night: true, t: 0, farm: opts.farm || 'aurora',
      lamp: (x, y, r, c) => lamps.push({ x, y, r, c: c || '#ffcf7a' }), chimney: () => {} };
    const paths = new Set(); for (let u = 4; u < 22; u++) paths.add(u + ',14'); for (let v = 3; v < 14; v++) paths.add('4,' + v);
    const PLACED = [
      ['house', 0, 0, 4, 3], ['stall', 22, 0, 3, 2], ['mail', 4, 1, 1, 1], ['board', 5, 0, 1, 1], ['coop', 0, 4, 2, 2], ['pethouse', 2, 4, 1, 1], ['well', 6, 3, 1, 1], ['hive', 7, 1, 1, 1],
      ['greenhouse', 16, 1, 4, 3], ['barn', 20, 4, 3, 3], ['scarecrow', 12, 9, 1, 1], ['pasture', 15, 15, 6, 4], ['fountain', 9, 4, 2, 2], ['statue', 12, 1, 1, 2], ['lantern', 5, 13, 1, 1],
      ['bench', 8, 12, 2, 1], ['swing', 1, 9, 2, 2], ['arch', 10, 15, 2, 1], ['sandbox', 6, 16, 2, 2], ['firepit', 13, 12, 1, 1], ['sign', 3, 3, 1, 1], ['clothesline', 1, 13, 2, 1],
      ['flowerbed', 9, 9, 2, 1], ['birdhouse', 14, 4, 1, 1], ['flag', 24, 3, 1, 1], ['wagon', 18, 12, 2, 1], ['windmill', 23, 9, 2, 2], ['igloo', 1, 16, 2, 2], ['sled', 10, 18, 2, 1], ['icefish', 14, 9, 1, 1],
      ['sauna', 16, 7, 2, 2], ['lavvu', 17, 9, 2, 2], ['icesculpt', 7, 10, 1, 1], ['santapost', 11, 7, 1, 1],
    ].concat(opts.set === 'memory' ? [['lighthouse', 8, 1, 1, 1], ['palm', 10, 1, 1, 1], ['anchor', 13, 6, 1, 1], ['boat', 16, 9, 2, 1], ['parasol', 12, 11, 1, 1], ['cairn', 20, 10, 1, 1], ['waterfall', 2, 6, 2, 2], ['woodpile', 6, 10, 2, 1],
      ['milkcans', 22, 13, 1, 1], ['alphorn', 17, 17, 2, 1], ['balloon', 23, 15, 2, 2], ['skybridge', 13, 17, 2, 1], ['shishi', 3, 15, 1, 1], ['koinobori', 25, 7, 1, 1], ['toro', 8, 18, 1, 1]] : [])
      .filter((a, i, all) => opts.set !== 'memory' || i >= all.length - 15 || ['house', 'stall'].includes(a[0]))
      .filter(a => opts.farm !== 'desert' || ['igloo', 'sled', 'icefish', 'sauna', 'lavvu', 'icesculpt', 'santapost'].indexOf(a[0]) < 0)
      .concat(opts.farm === 'desert' ? [['zellige', 1, 16, 2, 2], ['berber', 16, 7, 3, 2], ['genielamp', 11, 7, 1, 1], ['telescope', 7, 10, 1, 1]] : [])
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
      [[13.5, 8.5], [15.5, 11.5], [9.5, 13.3], [3.5, 5.5], [20.6, 8.4]].forEach(([u, v]) => cast.push({ d: u + v, go: () => { const p = E.P(u, v); shard(g2, E, p[0], p[1], E.t); } }));   // 빛 조각
      cast.sort((a, b) => a.d - b.d).forEach(c => c.go());
      fence(g2, E, 15, 19, 21, 19); fence(g2, E, 21, 15, 21, 19);
      if (E.night){ g2.save(); g2.globalCompositeOperation = 'lighter'; lamps.forEach(l => { const gr = g2.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, l.c + '80'); gr.addColorStop(0.45, l.c + '30'); gr.addColorStop(1, l.c + '00'); g2.fillStyle = gr; g2.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }); g2.restore(); }
      snowfall(g2, E);
    }
    function loop(now){ requestAnimationFrame(loop); if (now - last < 50) return; last = now; draw(); }
    layout(); window.addEventListener('resize', layout);
    requestAnimationFrame(loop);
  }

  window.FARMHD = { backdrop, island, sparkle, node, thing, floor, live, fence, kid, snowfall, shard, has, hasLive, look, mount };
})();
