// pages/farm-hd-life.js — 스테이지2 농장(오로라부터)의 밭·작물·스프링클러·동물 고화소 그림(2026-10-09).
// pages/farm-hd.js 와 같은 붓질(그러데이션, INK 테 0.7, 밤이면 쪽빛으로 누르기)이고, 좌표도 같은 도트 단위(칸 마름모 40×20, E.P(u, v, z) → [x, y])다.
// farm.js 가 hd(fn) 로 ctx 를 S 배 키워 놓고 부른다. window.FARMHD 에 덧붙인다 — plot · ghost · crop · giant · sprinkler · animal
(function(){
  'use strict';
  const HD = window.FARMHD; if (!HD) return;
  const TAU = Math.PI * 2;
  const INK = 'rgba(22,30,48,.72)', LW = 0.7;
  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const rgb = c => { const v = parseInt(c.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  function mix(a, b, k){ const A = rgb(a), B = rgb(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join(''); }
  const shade = (c, k) => k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k);

  // ---------- 붓 ----------
  let g = null, NIGHT = false;
  const toneMemo = {};
  // 밤 — 건물과 같은 쪽빛으로 누른다(식물은 조금 덜 눌러 잎 빛이 남게)
  const tn = c => NIGHT && c[0] === '#' ? (toneMemo[c] || (toneMemo[c] = mix(c, '#14204a', 0.34))) : c;
  const palMemo = {};
  // 잎·열매 빛깔 한 벌 — 밝은 · 가운데 · 어두운 · 깊은
  const pal = c => { const k = c + (NIGHT ? 'n' : 'd'); return palMemo[k] || (palMemo[k] = { hi: tn(shade(c, 0.32)), mid: tn(c), dk: tn(shade(c, -0.26)), deep: tn(shade(c, -0.48)) }); };
  const set = (gg, E) => { g = gg; NIGHT = !!(E && E.night); };
  const ink = w => { g.strokeStyle = INK; g.lineWidth = w || LW; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const oval = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); g.fill(); };
  const ovalI = (x, y, rx, ry, c, w, rot) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); g.fill(); ink(w); };
  const lin = (x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
  const vg = (y0, y1, cols) => lin(0, y0, 0, y1, cols);
  const poly = (pts, c, w) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (c){ g.fillStyle = c; g.fill(); } if (w) ink(w === true ? LW : w); };
  const line = (x0, y0, x1, y1, c, w) => { g.strokeStyle = c; g.lineWidth = w || LW; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const curve = (x0, y0, cx, cy, x1, y1, c, w) => { g.strokeStyle = c; g.lineWidth = w || LW; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); };
  // 줄기 — 테를 먼저 굵게, 그 위에 빛깔
  const stem = (x0, y0, cx, cy, x1, y1, c, w) => { curve(x0, y0, cx, cy, x1, y1, INK, (w || 1) + 0.7); curve(x0, y0, cx, cy, x1, y1, c, w || 1); };
  // 동그란 열매 — 왼쪽 위에서 빛을 받는다
  function ball(x, y, r, P, ry, w){
    ry = ry || r;
    const gr = g.createRadialGradient(x - r * 0.35, y - ry * 0.4, r * 0.1, x, y, Math.max(r, ry) * 1.05);
    gr.addColorStop(0, P.hi); gr.addColorStop(0.55, P.mid); gr.addColorStop(1, P.dk);
    ovalI(x, y, r, ry, gr, w == null ? 0.55 : w);
    oval(x - r * 0.38, y - ry * 0.42, r * 0.28, ry * 0.2, 'rgba(255,255,255,.55)');
  }
  // 잎 — (x, y) 에서 a 쪽(라디안, 0 = 오른쪽, -π/2 = 위)으로 len 만큼. wid 는 반폭, bend 는 끝이 휘는 정도
  function leaf(x, y, a, len, wid, P, o){
    o = o || {};
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, b = o.bend || 0;
    const tx = x + ca * len + nx * b * len, ty = y + sa * len + ny * b * len;
    const mx = x + ca * len * 0.5 + nx * b * len * 0.35, my = y + sa * len * 0.5 + ny * b * len * 0.35, wd = wid * 1.35;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(mx + nx * wd, my + ny * wd, tx, ty); g.quadraticCurveTo(mx - nx * wd, my - ny * wd, x, y); g.closePath();
    const up = ny < 0 ? 1 : -1;                                                  // 위를 보는 쪽이 밝다
    g.fillStyle = lin(mx + nx * wid * up, my + ny * wid * up, mx - nx * wid * up, my - ny * wid * up, [P.hi, P.mid, P.dk]); g.fill();
    ink(o.ink || 0.5);
    if (o.vein !== false) curve(x, y, mx, my, x + (tx - x) * 0.85, y + (ty - y) * 0.85, P.deep, 0.35);
    return [tx, ty];
  }
  // 둥근 잎(넓적한 잎) — 잎자루 끝에 달걀꼴
  function roundLeaf(x, y, r, P, rot, w){ const gr = lin(x - r, y - r, x + r, y + r, [P.hi, P.mid, P.dk]); ovalI(x, y, r, r * 0.78, gr, w || 0.5, rot || 0); curve(x - r * 0.6, y + r * 0.3, x, y, x + r * 0.5, y - r * 0.35, P.deep, 0.3); }
  // 꽃잎 n 장 — 둥글게 돌려 붙인다. squash 로 옆에서 본 꽃은 납작하게
  function petals(x, y, n, len, wid, P, rot, squash){
    for (let i = 0; i < n; i++){
      const a = (rot || 0) + i / n * TAU, ca = Math.cos(a), sa = Math.sin(a) * (squash || 1);
      g.save(); g.translate(x, y); g.beginPath();
      g.ellipse(ca * len * 0.5, sa * len * 0.5, len * 0.55, wid, Math.atan2(sa, ca), 0, TAU);
      g.fillStyle = lin(0, 0, ca * len, sa * len, [P.mid, P.hi]); g.fill(); ink(0.4); g.restore();
    }
  }
  // 반짝 — 십자 빛
  function twinkle(x, y, s, c){ g.fillStyle = c; g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); }
  // 농장 규칙(farm-rules.js 의 FARM) — 최상위 const 라 window 에 안 붙는다
  const RULES = () => typeof FARM !== 'undefined' ? FARM : null;
  const shadowC = () => NIGHT ? 'rgba(10,16,40,.32)' : 'rgba(60,40,30,.22)';

  // ================= 밭 =================
  // 흙 — 눈 섬 위에 돋운 따뜻한 흙 두둑. 마른 흙은 밤색, 물 준 흙은 짙은 흙빛에 물기 반짝
  const SOIL = { dry: ['#d0a072', '#b4845a', '#966a46', '#7a5436'], wet: ['#8a6242', '#6e4c30', '#563a24', '#422c1a'] };
  // 흙은 밤에도 따뜻한 밤빛이 남게 덜 누른다
  const soilMemo = {}, soilTn = c => NIGHT ? (soilMemo[c] || (soilMemo[c] = mix(c, '#1c2448', 0.3))) : c;
  function plot(gg, E, u, v, wet, fert){
    set(gg, E);
    const P = (a, b, z) => E.P(a, b, z), S3 = wet ? SOIL.wet : SOIL.dry, Z = 3, i = 0.03;
    const c = k => soilTn(S3[k]);
    const t0 = P(u + i, v + i, Z), r0 = P(u + 1 - i, v + i, Z), b0 = P(u + 1 - i, v + 1 - i, Z), l0 = P(u + i, v + 1 - i, Z);
    const r1 = P(u + 1 - i, v + i, 0), b1 = P(u + 1 - i, v + 1 - i, 0), l1 = P(u + i, v + 1 - i, 0);
    oval((l1[0] + r1[0]) / 2 + 1.5, b1[1] - 6, 22, 9, shadowC());
    poly([l0, b0, b1, l1], vg(l0[1], l1[1], [c(1), c(2)]), 0.5);                   // 앞 왼쪽 옆면
    poly([b0, r0, r1, b1], vg(r0[1], b1[1], [c(2), c(3)]), 0.5);                   // 오른쪽 옆면
    // 옆면에 박힌 잔돌
    for (let k = 0; k < 4; k++){ const f = 0.15 + k * 0.22, p = P(u + i + (1 - 2 * i) * f, v + 1 - i, 1.4 + hash(u * 7 + v * 3 + k) * 0.8); oval(p[0], p[1], 0.9, 0.5, tn('#b8aa98')); }
    poly([t0, r0, b0, l0], vg(t0[1], b0[1], [c(0), c(1)]), 0.6);                   // 윗면
    g.save(); poly([t0, r0, b0, l0]); g.clip();
    // 고랑 — u 를 따라 흐르는 두둑 줄 다섯. 밝은 등성이와 어두운 골
    for (let k = 0; k < 5; k++){
      const vv = v + 0.13 + k * 0.19, a = P(u - 0.05, vv, Z), b = P(u + 1.05, vv, Z), a2 = P(u - 0.05, vv + 0.07, Z), b2 = P(u + 1.05, vv + 0.07, Z);
      line(a2[0], a2[1], b2[0], b2[1], c(2), 1.6); line(a[0], a[1], b[0], b[1], soilTn(shade(S3[0], 0.18)), 0.9);
    }
    // 흙 알갱이와 거름(크림빛 점)
    for (let k = 0; k < 14; k++){ const p = P(u + 0.08 + hash(u * 31 + v * 17 + k) * 0.84, v + 0.08 + hash(u * 13 + v * 29 + k * 5) * 0.84, Z); oval(p[0], p[1], 0.7, 0.4, k % 2 ? c(3) : soilTn(shade(S3[0], 0.25))); }
    if (fert) for (let k = 0; k < 9; k++){ const p = P(u + 0.1 + hash(u * 5 + v * 41 + k * 3) * 0.8, v + 0.1 + hash(u * 23 + v * 7 + k) * 0.8, Z); oval(p[0], p[1], 0.9, 0.55, tn('#efe2b4')); }
    if (wet){                                                                    // 물기 — 골에 고인 물빛
      for (let k = 0; k < 4; k++){ const p = P(u + 0.2 + hash(u * 3 + v * 11 + k) * 0.6, v + 0.22 + k * 0.19, Z); oval(p[0], p[1], 3.4, 0.7, NIGHT ? 'rgba(150,190,255,.35)' : 'rgba(170,215,240,.55)'); oval(p[0] - 1, p[1] - 0.2, 1.2, 0.3, 'rgba(255,255,255,.6)'); }
    }
    g.restore();
    // 앞 모서리 아래 눈 부스러기 몇 — 눈밭에 판 두둑
    const sn = NIGHT ? '#a3b7e0' : '#ffffff';
    for (let k = 0; k < 3; k++){ const f = hash(u * 9 + v * 5 + k * 7); if (f < 0.45) continue; const p = k < 2 ? P(u + 0.15 + f * 0.7, v + 1.02, 0) : P(u + 1.02, v + 0.2 + f * 0.6, 0); oval(p[0], p[1], 1.4 + f, 0.7, sn); }
  }
  // 다음에 열 땅 — 둥근 점선(눈 위에 줄을 띄워 둔 것처럼)
  function ghost(gg, E, ua, va, ub, vb){
    set(gg, E);
    const a = E.P(ua, va, 0), b = E.P(ub, vb, 0);
    g.save(); g.setLineDash([2.4, 2.6]); g.lineCap = 'round';
    line(a[0], a[1] + 0.6, b[0], b[1] + 0.6, NIGHT ? 'rgba(10,16,40,.35)' : 'rgba(80,100,140,.25)', 1.2);
    line(a[0], a[1], b[0], b[1], NIGHT ? 'rgba(190,220,255,.55)' : 'rgba(255,255,255,.85)', 0.9);
    g.restore();
  }

  // ================= 작물 =================
  // 밑동 (0, 0) 기준, 위가 -y. 한 칸 작물은 키 30도트 안팎(아이가 44도트)
  const ROSE = (n, len, wid, P, spread, o) => { for (let i = 0; i < n; i++){ const f = n === 1 ? 0.5 : i / (n - 1), a = -Math.PI / 2 + (f - 0.5) * (spread || 2.2); leaf(0, 0, a, len * (0.82 + 0.18 * Math.cos((f - 0.5) * 3)), wid, P, Object.assign({ bend: (f - 0.5) * 0.3 }, o)); } };
  // 덤불 — 둥근 잎 뭉치를 아래부터 쌓는다
  function bushMass(P, h, w, seed){
    const pts = [];
    for (let i = 0; i < 9; i++){ const f = i / 8, x = (hash(seed * 7 + i) - 0.5) * w * (1.1 - f * 0.5), y = -2 - f * (h - 4) - hash(seed + i * 3) * 2; pts.push([x, y, 3.4 + (1 - f) * 1.4]); }
    pts.forEach(([x, y, r], i) => roundLeaf(x, y, r, P, (hash(seed + i) - 0.5) * 1.6));
    return pts;
  }
  // 받침대 — 나무 막대(덩굴·토마토)
  function stake(x, top, col){ const c = tn(col || '#b08a5c'); line(x, 1, x, top, INK, 2); line(x, 1, x, top, c, 1.3); line(x - 0.3, 0, x - 0.3, top, tn(shade(col || '#b08a5c', 0.3)), 0.4); }
  // 덩굴 — 받침대를 감고 올라가는 줄기
  function vineUp(h, P, sd){ g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); for (let y = 0; y >= -h; y -= 1) g.lineTo(Math.sin(y * 0.55 + sd) * 2.2, y); g.stroke(); g.strokeStyle = P.dk; g.lineWidth = 0.9; g.stroke(); }

  const CROP = {};
  // ---- 뿌리 ----
  CROP.radish = (C, ripe, k) => {
    ROSE(5, 10, 2.3, C.G, 2.2);
    const r = ripe ? 3.8 : 2.6, y = ripe ? -2.4 : -1.2, F = k.id === 'winterradish' ? pal('#e8f4ee') : C.F;
    g.fillStyle = lin(-r, y - r, r, y + r, [F.hi, F.mid, F.dk]); g.beginPath(); g.ellipse(0, y, r, r * 1.05, 0, Math.PI, TAU); g.lineTo(r * 0.7, 0.8); g.lineTo(-r * 0.7, 0.8); g.closePath(); g.fill(); ink(0.55);
    g.fillStyle = pal('#9cd07a').mid; g.beginPath(); g.ellipse(0, y - r * 0.6, r * 0.75, r * 0.38, 0, 0, TAU); g.fill();      // 햇빛 받은 초록 어깨
    oval(-r * 0.35, y - r * 0.1, r * 0.22, r * 0.5, 'rgba(255,255,255,.5)');
  };
  CROP.winterradish = CROP.radish;
  CROP.carrot = (C, ripe) => {
    // 잎 — 깃털처럼 잘게 갈라진 잎자루 다섯
    for (let i = 0; i < 5; i++){
      const a = -Math.PI / 2 + (i - 2) * 0.38, L = ripe ? 13 : 10, tx = Math.cos(a) * L, ty = Math.sin(a) * L;
      stem(0, -1, tx * 0.4, ty * 0.6, tx, ty, C.G.dk, 0.6);
      for (let j = 1; j <= 4; j++){ const f = j / 5, px = tx * f, py = -1 + (ty + 1) * f; [-1, 1].forEach(sd => leaf(px, py, a + sd * 1.0, 3.2 - f, 0.9, C.G, { vein: false, ink: 0.35 })); }
    }
    const r = ripe ? 3.4 : 2.3;
    g.fillStyle = lin(-r, -r, r, r, [C.F.hi, C.F.mid, C.F.dk]); g.beginPath(); g.ellipse(0, -0.6, r, r * 0.6, 0, Math.PI, TAU); g.lineTo(r * 0.5, 1.5); g.lineTo(0, 2.2); g.lineTo(-r * 0.5, 1.5); g.closePath(); g.fill(); ink(0.55);
    for (let k2 = 0; k2 < 2; k2++) curve(-r * 0.6, -0.4 + k2 * 0.9, 0, k2 * 0.9, r * 0.6, -0.4 + k2 * 0.9, C.F.dk, 0.35);
  };
  CROP.potato = (C, ripe) => {
    if (ripe){ ball(-4.5, 0.2, 2.6, C.F, 2); ball(4.2, 0.6, 2.2, C.F, 1.7); [[-5, -0.3], [-3.6, 0.8], [4.6, 0.3]].forEach(([x, y]) => oval(x, y, 0.35, 0.3, C.F.deep)); }
    stem(0, 0, -1, -6, -2, -10, C.G.dk, 0.8); stem(0, 0, 2, -5, 3, -9, C.G.dk, 0.8);
    bushMass(C.G, 13, 11, 4);
    if (!ripe) [[-2, -12], [3, -11], [0, -14]].forEach(([x, y]) => { petals(x, y, 5, 1.8, 0.8, pal('#e8dcf4'), 0.3); oval(x, y, 0.6, 0.6, tn('#f2c83a')); });
  };
  CROP.sweetpotato = (C, ripe) => {
    if (ripe) [[-4, 0.4], [3.6, 0.8]].forEach(([x, y]) => ball(x, y, 3, C.F, 1.6));
    const heart = (x, y, s, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, s); g.bezierCurveTo(-s * 1.4, 0, -s * 0.8, -s * 1.2, 0, -s * 0.5); g.bezierCurveTo(s * 0.8, -s * 1.2, s * 1.4, 0, 0, s); g.fillStyle = lin(-s, -s, s, s, [C.G.hi, C.G.mid, C.G.dk]); g.fill(); ink(0.5); g.restore(); };
    stem(0, 0, -4, -3, -7, -4, C.G.dk, 0.7); stem(0, 0, 4, -4, 7, -3, C.G.dk, 0.7); stem(0, 0, 0, -6, 1, -11, C.G.dk, 0.7);
    [[-7, -5, -0.6], [7, -4.5, 0.6], [-3, -8, -0.3], [3, -9, 0.3], [1, -12, 0]].forEach(([x, y, r]) => heart(x, y, ripe ? 3.6 : 3, r));
  };
  CROP.onion = (C, ripe) => {
    const r = ripe ? 4 : 2.8;
    ball(0, -r * 0.7, r, C.F, r * 0.85);
    curve(-r * 0.5, -r * 1.2, 0, -r * 0.2, r * 0.4, -r * 0.1, C.F.dk, 0.35);
    [[-0.42, ripe ? 0.35 : 0.1], [0.38, ripe ? -0.3 : -0.1], [-0.12, 0.05], [0.14, -0.05], [-0.7, 0.25]].forEach(([da, b], i) => leaf(0, -r * 1.4, -Math.PI / 2 + da, 15 - i * 1.4, 1, C.G, { bend: b, vein: false }));
  };
  // ---- 포기(잎채소) ----
  CROP.cabbage = (C, ripe, k) => {
    const n = k.id === 'napa', r = ripe ? 5.6 : 4;
    [[-2.6, 0.3], [2.6, -0.3], [-1.9, 0.1], [1.9, -0.1]].forEach(([a, b]) => leaf(0, 0, -Math.PI / 2 + a * 0.45, n ? 9 : 8, n ? 3 : 4, C.G, { bend: b }));
    if (n){
      const ry = ripe ? 9 : 6.5;
      g.fillStyle = lin(-4, -ry * 2, 4, 0, [C.F.hi, C.F.mid, C.G.mid]); g.beginPath(); g.ellipse(0, -ry, 4.2, ry, 0, 0, TAU); g.fill(); ink(0.55);
      [-1, 1].forEach(sd => { g.fillStyle = C.G.mid; g.beginPath(); g.ellipse(sd * 2.4, -ry * 0.8, 2.2, ry * 0.85, sd * 0.12, 0, TAU); g.fill(); ink(0.45); });
      curve(0, -1, 0.4, -ry, 0, -ry * 1.85, 'rgba(255,255,255,.6)', 0.5);
      return;
    }
    ball(0, -r * 0.85, r, C.F, r * 0.85);
    for (let i = -1; i <= 1; i++) curve(i * r * 0.5, -0.4, i * r * 0.2, -r * 1.2, i * r * 0.1, -r * 1.65, C.G.dk, 0.4);
    leaf(-r, -r * 0.4, -0.9, r * 1.2, r * 0.6, C.G, { bend: 0.4, ink: 0.45 }); leaf(r, -r * 0.4, -Math.PI + 0.9, r * 1.2, r * 0.6, C.G, { bend: -0.4, ink: 0.45 });
  };
  CROP.napa = CROP.cabbage;
  CROP.spinach = (C, ripe) => {
    const L = ripe ? 12 : 9;
    for (let i = 0; i < 6; i++){ const a = -Math.PI / 2 + ((i * 3) % 6 / 5 - 0.5) * 1.9, tx = Math.cos(a) * L * 0.45, ty = Math.sin(a) * L * 0.45; stem(0, 0, tx * 0.5, ty * 0.5, tx, ty, C.G.dk, 0.6); roundLeaf(tx + Math.cos(a) * 2.6, ty + Math.sin(a) * 2.6, ripe ? 3.4 : 2.6, C.G, a + Math.PI / 2); }
  };
  CROP.lettuce = (C, ripe) => {
    const s = ripe ? 1 : 0.75, F = C.F;
    [[-6, -2, 4.4], [6, -2, 4.4], [-3.5, -5, 4.2], [3.5, -5, 4.2], [0, -7.5, 4], [0, -3, 4.6]].forEach(([x, y, r], i) => {
      x *= s; y *= s; r *= s;
      g.beginPath(); for (let j = 0; j <= 18; j++){ const a = j / 18 * TAU, rr = r * (1 + 0.12 * Math.sin(j * 3 + i)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75); }
      g.closePath(); g.fillStyle = lin(x - r, y - r, x + r, y + r, [F.hi, i % 2 ? F.mid : C.G.mid, C.G.dk]); g.fill(); ink(0.45);
      curve(x - r * 0.5, y + r * 0.4, x, y, x + r * 0.2, y - r * 0.5, C.G.dk, 0.3);
    });
  };
  CROP.kale = (C, ripe) => {
    const L = ripe ? 15 : 11;
    [[-0.9, -0.25], [-0.45, -0.1], [0, 0], [0.45, 0.1], [0.9, 0.25]].forEach(([a, b]) => {
      const ang = -Math.PI / 2 + a, tip = leaf(0, 0, ang, L * (1 - Math.abs(a) * 0.15), 2.4, C.G, { bend: b });
      for (let j = 1; j <= 4; j++){ const f = j / 5, x = tip[0] * f, y = tip[1] * f, n = [-Math.sin(ang), Math.cos(ang)]; [-1, 1].forEach(sd => oval(x + n[0] * sd * 2.6 * (1.1 - f * 0.4), y + n[1] * sd * 2.6 * (1.1 - f * 0.4), 1.1, 0.9, sd > 0 ? C.G.dk : C.G.hi)); }
    });
  };
  // ---- 덤불 ----
  CROP.strawberry = (C, ripe) => {
    const tri = (x, y, a) => { [-0.6, 0, 0.6].forEach(d => roundLeaf(x + Math.cos(a + d) * 2.6, y + Math.sin(a + d) * 2.6, 2.3, C.G, a + d + Math.PI / 2)); };
    [[-4, -4, -2.3], [4, -4, -0.8], [0, -7, -1.57], [-1, -3, -1.9], [2, -2.5, -1.1]].forEach(([x, y, a]) => { stem(0, 0, x * 0.4, y * 0.6, x, y, C.G.dk, 0.5); tri(x, y, a); });
    const berry = (x, y, s, P) => { g.fillStyle = lin(x - s, y - s, x + s, y + s, [P.hi, P.mid, P.dk]); g.beginPath(); g.moveTo(x, y + s * 1.3); g.bezierCurveTo(x - s * 1.4, y + s * 0.2, x - s * 1.1, y - s, x, y - s * 0.7); g.bezierCurveTo(x + s * 1.1, y - s, x + s * 1.4, y + s * 0.2, x, y + s * 1.3); g.fill(); ink(0.45);
      for (let i = 0; i < 4; i++) oval(x - s * 0.5 + (i % 2) * s, y - s * 0.1 + (i >> 1) * s * 0.6, 0.25, 0.25, tn('#ffe9a0')); leaf(x, y - s * 0.7, -2.2, 1.6, 0.6, C.G, { vein: false, ink: 0.3 }); leaf(x, y - s * 0.7, -0.9, 1.6, 0.6, C.G, { vein: false, ink: 0.3 }); };
    if (ripe) [[-5.5, -0.8], [5, -1.2], [-1.5, -1.4], [2.6, 0.2]].forEach(([x, y]) => berry(x, y, 1.7, C.F));
    else { [[-5, -1], [4.5, -1.5]].forEach(([x, y]) => berry(x, y, 1.3, pal('#cfe6a0'))); [[-2, -8], [2.5, -7]].forEach(([x, y]) => { petals(x, y, 5, 1.8, 0.85, pal('#ffffff'), 0); oval(x, y, 0.6, 0.6, tn('#f2c83a')); }); }
  };
  CROP.tomato = (C, ripe) => {
    stake(3, -21);
    stem(0, 0, 1, -9, 2, -18, C.G.dk, 1);
    const pts = bushMass(C.G, 19, 12, 7);
    curve(2, -6, 3, -6, 3.2, -6, tn('#e8dcae'), 0.5); curve(1.5, -13, 3, -13, 3.2, -13, tn('#e8dcae'), 0.5);
    const F = ripe ? C.F : pal('#9cc860');
    [[-3, -7, 2.4], [2.5, -10, 2.2], [-1.5, -14, 2], [4, -4.5, 2.1]].forEach(([x, y, r]) => { ball(x, y, r, F, r * 0.92); [0, 1.3, 2.6, 3.9, 5.2].forEach(a => line(x, y - r * 0.85, x + Math.cos(a) * 1.3, y - r * 0.85 + Math.sin(a) * 0.6, C.G.dk, 0.5)); });
    if (!ripe) [[-4, -15], [1, -18]].forEach(([x, y]) => { petals(x, y, 5, 1.6, 0.7, pal('#ffe066'), 0.5); });
    return pts;
  };
  CROP.blueberry = (C, ripe) => {
    stem(0, 0, -2, -7, -3, -13, tn('#7a5a44'), 0.9); stem(0, 0, 2, -6, 4, -12, tn('#7a5a44'), 0.9);
    bushMass(C.G, 16, 12, 11);
    const F = ripe ? C.F : pal('#c8d8a0');
    [[-4, -6], [3.5, -8], [-1, -11], [4.5, -3.5], [-4.5, -12]].forEach(([x, y], j) => { for (let i = 0; i < 5; i++){ const bx = x + Math.cos(i * 2.4 + j) * (i ? 1.5 : 0), by = y + Math.sin(i * 2.4 + j) * (i ? 1.2 : 0) + 0.5; ball(bx, by, 1.05, j % 2 && !ripe ? pal('#e8a0b0') : F, 1.05, 0.4); oval(bx + 0.2, by - 0.3, 0.3, 0.2, 'rgba(230,240,255,.55)'); } });
  };
  CROP.pepper = (C, ripe, k) => {
    const egg = k.id === 'eggplant';
    stem(0, 0, 0, -8, 0, -14, C.G.dk, 0.9);
    bushMass(C.G, 15, 11, egg ? 13 : 9);
    const F = ripe ? C.F : egg ? pal('#b48ad8') : pal('#6fb04a');
    const pod = (x, y, L, w, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 1.1, L * 0.7, 0, L); g.quadraticCurveTo(w * 1.1, L * 0.7, w, 0); g.closePath(); g.fillStyle = lin(-w, 0, w, L, [F.hi, F.mid, F.dk]); g.fill(); ink(0.45); oval(-w * 0.35, L * 0.35, w * 0.25, L * 0.25, 'rgba(255,255,255,.45)'); g.fillStyle = C.G.dk; g.beginPath(); g.ellipse(0, 0, w * 1.05, 0.9, 0, 0, TAU); g.fill(); g.restore(); };
    if (egg){
      if (ripe) [[-3.5, -8, 6.5, 2.2, 0.25], [3.5, -9, 6, 2, -0.2]].forEach(a => pod(...a));
      else [[-3, -12], [3, -10]].forEach(([x, y]) => { petals(x, y, 5, 1.8, 0.8, pal('#b07ad8'), 0.2); oval(x, y, 0.5, 0.5, tn('#f2c83a')); });
    } else [[-4.5, -9, 6.5, 1.5, 0.35], [4, -11, 7, 1.5, -0.3], [-0.5, -6, 6, 1.4, 0.05], [5, -5, 5.5, 1.3, -0.45]].forEach(a => pod(...a));
  };
  CROP.eggplant = CROP.pepper;
  // ---- 덩굴 ----
  CROP.pea = (C, ripe, k) => {
    const grape = k.id === 'grape', cuke = k.id === 'cucumber';
    stake(-1, -24, grape ? '#8a6448' : '#c8b070'); if (!grape) { stake(4, -22, '#c8b070'); line(-1, -14, 4, -13, tn('#e8dcae'), 0.4); line(-1, -20, 4, -19, tn('#e8dcae'), 0.4); }
    vineUp(22, C.G, k.u || 0);
    [[-3.5, -6, 2.6], [3, -9, 2.8], [-3, -14, 2.6], [3.5, -17, 2.4], [0, -21, 2.4], [-4, -2, 2.4]].forEach(([x, y, r], i) => {
      if (grape){ const P = C.G; g.beginPath(); [[-0.55, 0.1], [0.55, 0.1], [0, -0.45]].forEach(([a, b]) => { g.moveTo(x + a * r + r * 0.7, y + b * r); g.arc(x + a * r, y + b * r, r * 0.7, 0, TAU); }); g.fillStyle = lin(x - r, y - r, x + r, y + r, [P.hi, P.mid, P.dk]); g.fill(); ink(0.45); g.fill(); curve(x, y + r * 0.5, x, y, x, y - r * 0.6, P.deep, 0.3); }
      else roundLeaf(x, y, cuke ? r * 1.15 : r * 0.9, C.G, (i % 2 ? 0.5 : -0.5));
    });
    if (grape){
      const F = ripe ? C.F : pal('#b8d07a');
      [[-3, -9], [3.5, -13]].forEach(([x, y]) => { stem(x, y - 2, x, y - 1, x, y, C.G.dk, 0.5); [[0, 0], [-1.3, 0.2], [1.3, 0.2], [-0.7, 1.4], [0.7, 1.4], [0, 2.6], [-1.6, 1.4], [1.6, 1.3]].forEach(([dx, dy]) => ball(x + dx, y + dy, 1, F, 1, 0.35)); });
      return;
    }
    if (cuke){
      if (ripe) [[-3, -10, 0.15], [3.5, -6, -0.2]].forEach(([x, y, r]) => { g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = lin(-1.3, 0, 1.3, 0, [C.F.hi, C.F.mid, C.F.dk]); g.beginPath(); g.ellipse(0, 3, 1.3, 4, 0, 0, TAU); g.fill(); ink(0.45); for (let i = 0; i < 4; i++) oval(-0.4 + (i % 2) * 0.8, 0.5 + i * 1.5, 0.25, 0.25, C.F.hi); g.restore(); });
      [[2, -13], [-2.5, -18]].forEach(([x, y]) => { petals(x, y, 5, 1.8, 0.8, pal('#ffd84a'), 0.3); });
      return;
    }
    if (ripe) [[-3.5, -9, 0.3], [3, -12, -0.3], [-2.5, -17, 0.2], [3.5, -5, -0.2]].forEach(([x, y, r]) => { g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = lin(-1.2, 0, 1.2, 0, [C.F.hi, C.F.mid, C.F.dk]); g.beginPath(); g.ellipse(0, 2.4, 1.2, 3.2, 0, 0, TAU); g.fill(); ink(0.45); [0.4, 2.2, 4].forEach(yy => oval(0, yy, 0.6, 0.6, C.F.hi)); g.restore(); });
    else [[-3, -11], [3, -15], [-2, -19]].forEach(([x, y]) => { petals(x, y, 4, 1.7, 0.9, pal('#f6e8f8'), 0.4); oval(x, y, 0.5, 0.5, tn('#e8a0c8')); });
  };
  CROP.grape = CROP.cucumber = CROP.pea;
  // ---- 키 큰 것 ----
  CROP.corn = (C, ripe) => {
    stem(0, 0, 0.6, -14, 0, -30, C.G.mid, 1.6);
    [[-1, -4, 2.6, 13, 0.35], [1, -8, 0.5, 13, -0.35], [-1, -14, 2.4, 12, 0.3], [1, -18, 0.7, 11, -0.3], [-0.5, -24, 2.2, 8, 0.25]].forEach(([s, y, a, L, b]) => leaf(0, y, s < 0 ? -Math.PI + a * 0.25 - 0.5 : -a * 0.25 - 0.1, L, 1.4, C.G, { bend: b }));
    const ear = (x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = lin(-1.8, 0, 1.8, 0, [C.F.hi, C.F.mid, C.F.dk]); g.beginPath(); g.ellipse(0, 0, 1.8, 4.2, 0, 0, TAU); g.fill(); ink(0.45);
      if (ripe) for (let i = 0; i < 6; i++) oval(((i % 2) - 0.5) * 1.4, -3 + i, 0.5, 0.45, C.F.hi);
      [-1, 1].forEach(sd => { g.fillStyle = pal('#9cc87a').mid; g.beginPath(); g.moveTo(0, 4.5); g.quadraticCurveTo(sd * 3, 1, sd * 1.2, ripe ? -2 : -4); g.quadraticCurveTo(sd * 0.6, 1, 0, 4.5); g.fill(); ink(0.4); });
      line(0, -4, 0.5, -6.5, tn(ripe ? '#a87a3a' : '#e8d080'), 0.6); g.restore(); };
    ear(2.2, -15, 0.35); if (ripe) ear(-2, -10, -0.4);
    for (let i = -2; i <= 2; i++) curve(0, -30, i * 1.2, -32, i * 2, -31 + Math.abs(i), tn(ripe ? '#e8c060' : '#c8d890'), 0.6);
  };
  // ---- 박 ----
  function melonFruit(id, x, y, r, F){
    if (id === 'watermelon'){
      ball(x, y, r, F, r * 0.82);
      g.save(); g.beginPath(); g.ellipse(x, y, r, r * 0.82, 0, 0, TAU); g.clip();
      for (let i = -3; i <= 3; i++){ g.strokeStyle = F.deep; g.lineWidth = r * 0.12; g.beginPath(); for (let j = -10; j <= 10; j++){ const yy = y + j / 10 * r, xx = x + i * r * 0.3 * Math.sqrt(1 - (j / 10) * (j / 10)) + Math.sin(j * 1.3 + i) * r * 0.05; j === -10 ? g.moveTo(xx, yy) : g.lineTo(xx, yy); } g.stroke(); }
      g.restore(); oval(x - r * 0.4, y - r * 0.45, r * 0.25, r * 0.14, 'rgba(255,255,255,.4)');
    } else if (id === 'pumpkin'){
      for (let i = 2; i >= -2; i--) ball(x + i * r * 0.32, y, r * (0.62 - Math.abs(i) * 0.06), F, r * 0.78);
      ball(x, y, r * 0.55, F, r * 0.8);
      line(x, y - r * 0.75, x + r * 0.15, y - r * 1.05, tn('#6a7a3a'), 1.4); line(x, y - r * 0.75, x + r * 0.15, y - r * 1.05, tn('#8a9a4a'), 0.7);
    } else {                                                                     // 참외 — 노란 몸에 흰 골
      ball(x, y, r, F, r * 0.68);
      g.save(); g.beginPath(); g.ellipse(x, y, r, r * 0.68, 0, 0, TAU); g.clip();
      for (let i = -2; i <= 2; i++){ g.strokeStyle = 'rgba(255,255,240,.75)'; g.lineWidth = r * 0.1; g.beginPath(); g.ellipse(x, y, r * (1 - Math.abs(i) * 0.3) + 0.01, r * 0.7, 0, i < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, i < 0 ? Math.PI * 1.5 : Math.PI * 0.5); g.stroke(); }
      g.restore();
    }
  }
  CROP.melon = (C, ripe, k) => {
    const vl = (x, y, r) => { g.beginPath(); for (let j = 0; j <= 10; j++){ const a = j / 10 * TAU, rr = r * (j % 2 ? 0.72 : 1); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); } g.closePath(); g.fillStyle = lin(x - r, y - r, x + r, y + r, [C.G.hi, C.G.mid, C.G.dk]); g.fill(); ink(0.45); curve(x - r * 0.6, y, x, y - r * 0.2, x + r * 0.6, y, C.G.deep, 0.3); };
    curve(-11, 1, -3, -3, 11, 0, INK, 1.4); curve(-11, 1, -3, -3, 11, 0, C.G.dk, 0.8);
    [[-8, -2, 4], [7.5, -2.5, 4], [-3, -6, 4.2], [3.5, -7, 4]].forEach(([x, y, r]) => vl(x, y, r));
    if (ripe) melonFruit(k.id, 0, -3.8, k.id === 'melon' ? 5 : 5.8, C.F);
    else { ball(1, -2, 2.2, pal(mix(k.leafC, '#ffffff', 0.25)), 1.8); petals(-5, -6, 5, 1.8, 0.8, pal('#ffd84a'), 0.2); }
  };
  CROP.watermelon = CROP.pumpkin = CROP.melon;
  // ---- 꽃 ----
  // 꽃대와 잎 둘 — 머리 자리 [x, y] 를 돌려준다
  function flowerStalk(C, h, lean){ const hx = lean || 0; stem(0, 0, hx * 0.2, -h * 0.5, hx, -h, C.G.dk, 0.9); leaf(0, -1, -2.1, h * 0.45, 1.6, C.G, { bend: 0.2 }); leaf(0, -2, -1.0, h * 0.4, 1.5, C.G, { bend: -0.2 }); return [hx, -h]; }
  const bud = (x, y, P, s) => { g.fillStyle = lin(x - s, y - s * 2, x + s, y, [P.hi, P.mid, P.dk]); g.beginPath(); g.moveTo(x, y + s * 0.6); g.quadraticCurveTo(x - s * 1.3, y - s * 0.6, x, y - s * 2); g.quadraticCurveTo(x + s * 1.3, y - s * 0.6, x, y + s * 0.6); g.fill(); ink(0.45); };
  CROP.tulip = (C, ripe, k) => {
    const [x, y] = flowerStalk(C, 17, 0.5);
    if (!ripe) return bud(x, y, pal(mix(k.fruitC, k.leafC, 0.45)), 1.8);
    const F = C.F;
    [[-1, -0.25], [1, 0.25], [0, 0]].forEach(([sd, r]) => { g.save(); g.translate(x + sd * 1.5, y); g.rotate(r); g.beginPath(); g.moveTo(0, 1.5); g.quadraticCurveTo(-2.6, 0, -1.6, -3.6); g.quadraticCurveTo(-0.6, -2.4, 0, -4); g.quadraticCurveTo(0.6, -2.4, 1.6, -3.6); g.quadraticCurveTo(2.6, 0, 0, 1.5); g.fillStyle = lin(-2, -4, 2, 1.5, [F.hi, F.mid, F.dk]); g.fill(); ink(0.45); g.restore(); });
  };
  CROP.sunflower = (C, ripe) => {
    stem(0, 0, 1, -14, 1.5, -27, C.G.dk, 1.4);
    [[-8, 9, 3.2, 0.2], [-15, 9, 3, -0.2], [-3, 7, 2.6, 0.3]].forEach(([y, L, w, b], i) => leaf(0.8, y, i % 2 ? -0.5 : -Math.PI + 0.5, L, w, C.G, { bend: b }));
    const x = 2, y = -28;
    if (!ripe){ ball(x, y, 3, C.G, 2.6); for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; line(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.2, x + Math.cos(a) * 3.6, y + Math.sin(a) * 3, C.G.dk, 0.6); } return; }
    petals(x, y, 14, 4.2, 1.2, C.F, 0.1, 0.9); petals(x, y, 14, 3.4, 1, pal(shade('#ffcf3d', 0.15)), 0.33, 0.9);
    const gr = g.createRadialGradient(x - 0.8, y - 0.8, 0.3, x, y, 3); gr.addColorStop(0, tn('#8a5a2a')); gr.addColorStop(1, tn('#4a2c14')); ovalI(x, y, 3, 2.7, gr, 0.5);
    for (let i = 0; i < 10; i++){ const a = i * 2.4, rr = Math.sqrt(i) * 0.8; oval(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.3, 0.3, tn('#c89a4a')); }
  };
  CROP.cosmos = (C, ripe) => {
    const heads = [[-4, -16], [3, -19], [0.5, -12]];
    heads.forEach(([x, y]) => stem(0, 0, x * 0.3, y * 0.5, x, y, C.G.dk, 0.6));
    for (let i = 0; i < 6; i++){ const y = -3 - i * 2.2, sd = i % 2 ? 1 : -1; for (let j = 0; j < 3; j++) line(sd * 0.3, y, sd * (1.5 + j), y - 1.5 + j * 0.6, C.G.mid, 0.45); }
    heads.forEach(([x, y], i) => {
      if (!ripe){ bud(x, y + 1, pal('#d0a0c0'), 1.1); return; }
      const F = i === 1 ? pal('#ffffff') : i === 2 ? pal('#e05a9a') : C.F;
      petals(x, y, 8, 2.8, 1, F, i * 0.2, 0.85); oval(x, y, 0.9, 0.8, tn('#f2c83a')); oval(x - 0.2, y - 0.2, 0.4, 0.35, tn('#ffe890'));
    });
  };
  CROP.snowflower = (C, ripe) => {
    const [x, y] = flowerStalk(C, 18, -0.4);
    if (!ripe) return bud(x, y, pal('#cfe6f2'), 1.6);
    g.save(); g.globalAlpha = NIGHT ? 0.55 : 0.35; const gr = g.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, 'rgba(210,240,255,1)'); gr.addColorStop(1, 'rgba(210,240,255,0)'); g.fillStyle = gr; g.fillRect(x - 9, y - 9, 18, 18); g.restore();
    petals(x, y, 6, 4, 1.1, C.F, -Math.PI / 2, 0.85);
    for (let i = 0; i < 6; i++){ const a = -Math.PI / 2 + i / 6 * TAU; line(x, y, x + Math.cos(a) * 3.4, y + Math.sin(a) * 2.9, tn('#9cc8e8'), 0.4); }
    oval(x, y, 1, 0.9, '#ffffff');
    [[-5, -3], [5, 1], [3, -5]].forEach(([a, b]) => twinkle(x + a, y + b, 1.3, 'rgba(255,255,255,.9)'));
  };
  CROP.daffodil = (C, ripe) => {
    leaf(-0.5, 0, -1.8, 12, 1, C.G, { bend: 0.1, vein: false }); leaf(0.5, 0, -1.3, 11, 1, C.G, { bend: -0.1, vein: false });
    stem(0, 0, 0.5, -10, 1, -18, C.G.dk, 0.8); stem(1, -18, 2, -19, 3, -18.5, C.G.dk, 0.6);
    const x = 4, y = -18;
    if (!ripe) return bud(x, y + 1, pal('#d8d0a0'), 1.3);
    petals(x, y, 6, 3.2, 1.2, C.F, -Math.PI / 2, 0.9);
    g.fillStyle = lin(x, y - 1.5, x + 2.5, y + 1.5, [tn('#ffd060'), tn('#ff9a2a')]); g.beginPath(); g.ellipse(x + 0.6, y, 1.6, 1.5, 0, 0, TAU); g.fill(); ink(0.45);
    oval(x + 1, y, 0.9, 0.85, tn('#e07018'));
  };
  CROP.lily = (C, ripe) => {
    stem(0, 0, 0, -10, 1, -21, C.G.dk, 0.9);
    for (let i = 0; i < 5; i++) leaf(0.2, -4 - i * 3, i % 2 ? -0.6 : -Math.PI + 0.6, 4.2, 0.9, C.G, { bend: 0.2, vein: false });
    const x = 1.5, y = -23;
    if (!ripe) return bud(x, y + 2, pal('#d8e8b8'), 1.5);
    [[-1.2, -0.7], [-0.4, -1.2], [0.5, -1.1], [1.2, -0.6], [0, -0.2]].forEach(([dx, dy]) => leaf(x, y + 1.5, Math.atan2(dy, dx), 6.5, 1.9, C.F, { bend: dx * 0.15, ink: 0.4 }));
    [[-1, -3.4], [0.6, -3.8], [1.8, -3]].forEach(([a, b]) => { line(x, y + 1, x + a, y + b, tn('#a8c060'), 0.35); oval(x + a, y + b, 0.5, 0.35, tn('#d86a2a')); });
  };
  CROP.chrys = (C, ripe) => {
    stem(0, 0, -2, -7, -4, -13, C.G.dk, 0.7); stem(0, 0, 2, -8, 4, -15, C.G.dk, 0.7); stem(0, 0, 0, -10, 0, -18, C.G.dk, 0.7);
    bushMass(C.G, 12, 12, 17);
    [[-4, -14], [4, -16], [0, -19]].forEach(([x, y]) => {
      if (!ripe){ ball(x, y, 1.3, C.G, 1.2); oval(x, y - 0.8, 0.6, 0.5, C.F.mid); return; }
      petals(x, y, 12, 2.6, 0.7, C.F, 0, 0.85); petals(x, y, 9, 1.7, 0.6, pal(shade('#ffcf5c', 0.2)), 0.3, 0.85); oval(x, y, 0.7, 0.6, C.F.dk);
    });
  };
  CROP.camellia = (C, ripe) => {
    line(0, 0, 0, -10, INK, 2); line(0, 0, 0, -10, tn('#6a4a34'), 1.2); line(0, -6, -5, -11, tn('#6a4a34'), 1); line(0, -7, 5, -12, tn('#6a4a34'), 1);
    [[-6, -11, -2.5], [-5, -14, -1.9], [5, -12, -0.6], [6, -15, -1.2], [0, -12, -1.8], [1, -16, -1.4], [-2, -5, -2.7], [2, -6, -0.4], [-3, -16, -1.7]].forEach(([x, y, a]) => { leaf(x, y, a, 4.6, 1.8, C.G, { bend: 0.1 }); oval(x + Math.cos(a) * 2 - 0.4, y + Math.sin(a) * 2 - 0.4, 0.5, 0.3, 'rgba(255,255,255,.55)'); });
    [[-4, -15], [4.5, -11]].forEach(([x, y]) => {
      if (!ripe){ ball(x, y, 1.6, C.G, 1.8); oval(x, y - 1.2, 0.8, 0.6, C.F.mid); return; }
      petals(x, y, 6, 3, 1.5, C.F, 0.2, 0.9); petals(x, y, 5, 1.8, 1, pal(shade('#e8324a', -0.1)), 0.6, 0.9); oval(x, y, 1, 0.9, tn('#ffd84d'));
    });
  };
  CROP.star = (C, ripe) => {
    stem(0, 0, 0, -9, 0, -18, C.G.dk, 0.9); stem(0, -9, -3, -12, -5, -15, C.G.dk, 0.7); stem(0, -10, 3, -12, 5, -13, C.G.dk, 0.7);
    [[-1, -0.5, 6], [1, -0.5, 6], [-0.5, -1, 5], [0.6, -1, 5]].forEach(([dx, dy, l]) => leaf(0, -3, Math.atan2(dy, dx), l, 1.6, C.G, { bend: dx * 0.15 }));
    const heads = [[-7, -18], [1, -22], [6, -15]];
    heads.forEach(([x, y]) => {
      if (!ripe){ ball(x, y, 1.4, C.F, 1.4); return; }
      g.save(); g.globalAlpha = NIGHT ? 0.6 : 0.4; const gr = g.createRadialGradient(x, y, 0, x, y, 7); gr.addColorStop(0, 'rgba(255,240,150,1)'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.fillRect(x - 7, y - 7, 14, 14); g.restore();
      g.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 1.5 : 3.4; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath();
      g.fillStyle = lin(x - 3, y - 3, x + 3, y + 3, ['#fffbe0', '#ffe680', '#f2b830']); g.fill(); ink(0.45); oval(x - 0.8, y - 1, 0.7, 0.5, '#ffffff');
    });
    if (ripe) [[-10, -22], [8, -24], [9, -18]].forEach(([a, b]) => twinkle(a, b, 1.4, 'rgba(255,250,210,.95)'));
  };

  // 어린 포기(2단계) — 모양 무리마다 한 가지
  function young(C, shape){
    if (shape === 'tall'){ stem(0, 0, 0.3, -7, 0, -14, C.G.mid, 1.1); leaf(0, -4, -2.4, 8, 1.2, C.G, { bend: 0.25 }); leaf(0, -7, -0.7, 8, 1.2, C.G, { bend: -0.25 }); leaf(0, -11, -2, 6, 1, C.G, { bend: 0.2 }); }
    else if (shape === 'vine'){ stake(-1, -17, '#c8b070'); vineUp(12, C.G, 0); leaf(0, -4, -2.6, 4, 1.5, C.G); leaf(0, -8, -0.5, 4, 1.5, C.G); leaf(0, -12, -2, 3.6, 1.3, C.G); }
    else if (shape === 'flower'){ stem(0, 0, 0.3, -7, 0, -13, C.G.dk, 0.8); leaf(0, -2, -2.4, 6, 1.6, C.G, { bend: 0.2 }); leaf(0, -5, -0.7, 5, 1.5, C.G, { bend: -0.2 }); bud(0, -12.5, C.G, 1.1); }
    else ROSE(4, 6.5, 1.9, C.G, 2.3);
  }
  const SHAPE_OF = { root: 'radish', head: 'cabbage', bush: 'pepper', vine: 'pea', tall: 'corn', melon: 'melon', flower: 'tulip' };
  // 작물 한 포기. (u, v) 칸, 두둑(z 3) 가운데 조금 앞에 선다. sway 는 꼭대기가 옆으로 비키는 도트
  function cropPaint(id, stage, wilted, C){
    if (wilted){                                                                 // 시든 것 — 꺾여 누운 줄기와 처진 갈잎
      const W = pal('#a08a5a');
      stem(0, 0, -0.5, -5, -1, -8, tn('#7a6a44'), 0.8); stem(-1, -8, -3, -9, -5, -7, tn('#7a6a44'), 0.7);
      leaf(0, -2, Math.PI - 0.3, 6, 1.4, W, { bend: -0.3 }); leaf(0, -4, 0.15, 6, 1.4, W, { bend: 0.35 }); leaf(-4, -7, Math.PI - 0.6, 4, 1.1, W, { bend: -0.3 });
      return;
    }
    if (stage === 0){                                                            // 씨 — 봉긋한 흙, 떡잎 둘
      oval(0, 0.2, 3.2, 1.1, tn('#6e4a30')); oval(-0.4, -0.2, 2.2, 0.6, tn('#9a7050'));
      stem(0, 0, 0, -1, 0, -2.4, C.G.dk, 0.6); leaf(0, -2.4, -2.6, 2.8, 1.1, C.G, { vein: false, ink: 0.4 }); leaf(0, -2.4, -0.55, 2.8, 1.1, C.G, { vein: false, ink: 0.4 });
      return;
    }
    if (stage === 1){ stem(0, 0, 0, -3, 0, -7, C.G.dk, 0.7); leaf(0, -3.5, -2.8, 4.2, 1.4, C.G, { bend: 0.15 }); leaf(0, -4.8, -0.35, 4.2, 1.4, C.G, { bend: -0.15 }); leaf(0, -7, -1.4, 3.2, 1.1, C.G, { vein: false }); return; }
    if (stage === 2) return young(C, C.shape);
    (CROP[id] || CROP[SHAPE_OF[C.shape]] || CROP.radish)(C, stage >= 4, { id, leafC: C.leafC, fruitC: C.fruitC });
  }
  function cropColors(id, wilted){
    const D = (RULES() && RULES().CROPS[id]) || { leaf: '#7fbf6a', fruit: '#ffcf3d', shape: 'head' };
    return { G: pal(wilted ? '#a08a5a' : D.leaf), F: pal(D.fruit), shape: D.shape, leafC: D.leaf, fruitC: D.fruit };
  }
  // 한 포기씩 작은 그림에 담아 둔다(작물 줄은 바람 단계마다 다시 그려지니) — 밑동이 그림의 (30, 50)
  const cropBuf = {};
  let cropBufN = 0;
  function cropSprite(id, stage, wilted, sway, sc){
    const key = id + '|' + stage + '|' + (wilted ? 1 : 0) + '|' + sway + '|' + (NIGHT ? 1 : 0) + '|' + sc;
    let cv = cropBuf[key];
    if (cv) return cv;
    if (++cropBufN > 300){ Object.keys(cropBuf).forEach(k => delete cropBuf[k]); cropBufN = 1; }   // ponytail: 통째 비우기 — 모자라면 LRU
    cv = document.createElement('canvas'); cv.width = Math.ceil(60 * sc); cv.height = Math.ceil(58 * sc);
    const c = cv.getContext('2d'), keep = g;
    c.scale(sc, sc); c.translate(30, 50); g = c;
    try {
      oval(1, 0.6, stage < 2 ? 5 : 9, stage < 2 ? 1.8 : 3, shadowC());
      if (sway) g.transform(1, 0, -sway / 22, 1, 0, 0);                          // 바람 — 밑동은 그대로, 위로 갈수록 비킨다
      g.scale(1.15, 1.15);
      cropPaint(id, stage, wilted, cropColors(id, wilted));
    } finally { g = keep; }
    return (cropBuf[key] = cv);
  }
  function crop(gg, E, u, v, id, stage, wilted, sway){
    set(gg, E);
    const p = E.P(u + 0.5, v + 0.55, 3), sc = Math.round(Math.max(1, Math.abs(gg.getTransform().a) || 1) * 4) / 4;
    gg.drawImage(cropSprite(id, stage, wilted, sway || 0, sc), p[0] - 30, p[1] + 2 - 50, 60, 58);
  }
  // 큰 작물(2×2) — 칸 넷 가운데에 커다란 열매, 둘레에 갈래진 큰 잎. pulls = 함께 당긴 아이들
  function giant(gg, E, cu, cv, id, stage, pulls, sway){
    set(gg, E);
    const p = E.P(cu, cv + 0.1, 3), C = cropColors(id, false);
    g.save(); g.translate(p[0], p[1]);
    oval(2, 1, 34, 11, shadowC());
    if (sway) g.transform(1, 0, -sway / 40, 1, 0, 0);
    try {
      const vl = (x, y, r) => { g.beginPath(); for (let j = 0; j <= 10; j++){ const a = j / 10 * TAU, rr = r * (j % 2 ? 0.7 : 1); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); } g.closePath(); g.fillStyle = lin(x - r, y - r, x + r, y + r, [C.G.hi, C.G.mid, C.G.dk]); g.fill(); ink(0.55); curve(x - r * 0.6, y, x, y - r * 0.25, x + r * 0.6, y, C.G.deep, 0.4); };
      curve(-30, 2, -8, -6, 30, 0, INK, 2); curve(-30, 2, -8, -6, 30, 0, C.G.dk, 1.2);
      [[-24, -2, 7], [24, -3, 7], [-14, -10, 7.5], [14, -11, 7.5], [-28, 3, 5.5], [28, 2, 5.5], [0, -14, 6.5]].forEach(([x, y, r]) => vl(x, y, r));
      if (stage >= 4) melonFruit(id, 0, -13, 17, C.F);
      else if (stage >= 2) ball(0, -7, 8, pal(shade(C.leafC, -0.1)), 6);
    } finally { g.restore(); }
    if (pulls && pulls.length) pulls.forEach((who, i) => { const c = who === 'sua' ? '#ff7f8a' : '#6cc7b3', x = p[0] - 26 + i * 12, y = p[1] - 40; ovalI(x, y, 4.2, 4.2, tn(c), 0.6); oval(x - 1.2, y - 1.4, 1.6, 1.1, 'rgba(255,255,255,.6)'); });
  }

  // ================= 스프링클러 =================
  // 쇠기둥에 종 모양 머리, 물줄기가 돌아간다. good 이면 은빛 머리에 여덟 갈래로 더 멀리
  function sprinkler(gg, E, u, v, t, good){
    set(gg, E);
    const p = E.P(u + 0.5, v + 0.55, 3), x = p[0], y = p[1];
    const M = good ? ['#f2f8fc', '#c9d6e0', '#8a9cac'] : ['#f2d48a', '#c79a4e', '#8a6428'];
    oval(x, y + 0.5, 9, 3.4, NIGHT ? 'rgba(10,20,50,.35)' : 'rgba(40,60,90,.18)');           // 젖은 흙 자국
    oval(x + 1, y + 0.5, 5.5, 1.8, shadowC());
    ovalI(x, y - 0.6, 4.4, 1.8, vg(y - 2.4, y + 1.2, [tn('#b8b2a8'), tn('#6e6a64')]), 0.6);   // 받침
    g.fillStyle = lin(x - 1.6, 0, x + 1.6, 0, [tn('#e8e2da'), tn('#a9a49a'), tn('#6e6a62')]); g.fillRect(x - 1.6, y - 15, 3.2, 14); g.strokeStyle = INK; g.lineWidth = 0.55; g.strokeRect(x - 1.6, y - 15, 3.2, 14);
    // 종 머리
    g.beginPath(); g.moveTo(x - 4.6, y - 14.5); g.quadraticCurveTo(x - 4.2, y - 19.5, x - 1.6, y - 21); g.lineTo(x + 1.6, y - 21); g.quadraticCurveTo(x + 4.2, y - 19.5, x + 4.6, y - 14.5); g.closePath();
    g.fillStyle = lin(x - 4.6, 0, x + 4.6, 0, [tn(M[0]), tn(M[1]), tn(M[2])]); g.fill(); ink(0.6);
    ovalI(x, y - 14.5, 4.6, 1.3, tn(M[2]), 0.5);
    ovalI(x, y - 21.6, 1.4, 1.6, tn(M[1]), 0.5); oval(x - 2.2, y - 18.6, 0.7, 1.6, 'rgba(255,255,255,.7)');
    if (good) twinkle(x + 2.6, y - 21, 1.2, 'rgba(255,255,255,.9)');
    // 물줄기 — 한 바퀴 2.4초. 앞뒤로 곧장 뻗은 줄기는 기둥에 겹치니 옆으로 벌어진 것만
    const spin = (t % 2400) / 2400 * TAU, arms = good ? 8 : 4, n = good ? 6 : 5, reach = good ? 4.6 : 3.8;
    for (let i = 0; i < arms; i++){
      const a = spin + i * TAU / arms, ca = Math.cos(a), sa = Math.sin(a);
      if (Math.abs(ca) < 0.32) continue;
      const at = d => { const r = 3 + d * reach; return [x + ca * r * 1.15, y - 21 + (21 - 4) * Math.pow(d / n, 1.7) - Math.sin(Math.PI * d / n) * 5 + sa * r * 0.32]; };
      g.strokeStyle = NIGHT ? 'rgba(170,210,255,.35)' : 'rgba(200,235,255,.6)'; g.lineWidth = 0.7; g.beginPath(); for (let d = 0; d <= n; d += 0.5){ const q = at(d); d ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
      for (let d = 1; d <= n; d++){ const q = at(d), f = d / n; oval(q[0], q[1], 0.9 - f * 0.2, 0.9 - f * 0.2, f < 0.3 ? 'rgba(240,250,255,.95)' : f > 0.7 ? 'rgba(120,185,230,.85)' : 'rgba(170,215,245,.9)'); }
      const end = at(n); oval(end[0], end[1] + 0.6, 1.6, 0.5, 'rgba(150,200,240,.4)');
    }
  }

  // ================= 동물 =================
  // 옆에서 본 그림을 오른쪽(+u, 화면 오른쪽 아래)을 보게 그리고, 'v'(왼쪽 아래)는 뒤집는다.
  // '-v'(오른쪽 위로 멀어짐)는 뒷모습 — 머리가 몸 뒤로 가고 얼굴은 안 보인다. '-u' 는 그 뒤집음.
  // 발끝이 (0, 0). frame 0 = 서기, 1 = 걸음(다리 엇갈림)
  const EYE = '#2b2622';
  const eye = (x, y, r) => { oval(x, y, r || 0.85, (r || 0.85) * 1.15, EYE); oval(x - 0.25, y - 0.35, (r || 0.85) * 0.38, (r || 0.85) * 0.38, '#ffffff'); };
  const blush = (x, y) => oval(x, y, 1.2, 0.6, 'rgba(255,140,160,.45)');
  // 다리 — 둥근 막대, 아래에 발굽
  function leg(x, y0, w, col, hoof, swing){ const x1 = x + (swing || 0); g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x + w / 2, y0); g.lineTo(x1 + w / 2 * 0.85, -0.2); g.lineTo(x1 - w / 2 * 0.85, -0.2); g.closePath(); g.fillStyle = lin(x - w / 2, 0, x + w / 2, 0, [shade(col, 0.15), col, shade(col, -0.2)]); g.fill(); ink(0.5); if (hoof){ g.fillStyle = hoof; g.fillRect(x1 - w / 2 * 0.85, -1.6, w * 0.85, 1.6); } }
  // 몸통 — 위가 밝은 달걀꼴
  function torso(x, y, rx, ry, cols, rot){ const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.55, ry * 0.2, x, y, Math.max(rx, ry) * 1.1); gr.addColorStop(0, cols[0]); gr.addColorStop(0.6, cols[1]); gr.addColorStop(1, cols[2]); ovalI(x, y, rx, ry, gr, LW, rot || 0); }
  const cols3 = a => a.map(tn);
  // 네발짐승 공통 — o: 몸 길이 반(L)·높이 반(H)·다리(legH, legW), 몸빛, 머리 그림(head(back)), 꼬리(tail(back)), 무늬(pat)
  function quad(o, frame, back){
    const L = o.L, Hh = o.H, by = -o.legH - Hh * 0.75, lc = tn(o.leg), far = tn(shade(o.leg, -0.25)), hoof = o.hoof ? tn(o.hoof) : null;
    const sw = frame ? 1.6 : 0, xs = [L * 0.58, -L * 0.55];
    xs.forEach((x, i) => leg(x + 1.6, by + Hh * 0.3, o.legW, far, hoof, i ? sw : -sw));          // 먼 쪽 다리
    if (back) o.head(true, by);                                                  // 뒷모습 — 머리가 몸 뒤
    if (!back && o.tail) o.tail(false, by);
    torso(0, by, L, Hh, cols3(o.body));
    if (o.pat){ g.save(); g.beginPath(); g.ellipse(0, by, L, Hh, 0, 0, TAU); g.clip(); o.pat(by); g.restore(); }
    xs.forEach((x, i) => leg(x - 0.6, by + Hh * 0.45, o.legW, lc, hoof, i ? -sw : sw));          // 가까운 쪽 다리
    if (back && o.tail) o.tail(true, by);
    if (!back) o.head(false, by);
  }
  // 새 공통 — 몸통, 날개, 머리, 부리, 다리
  function bird(o, frame, back){
    const by = -o.legH - o.H * 0.8, lc = tn(o.leg), sw = frame ? 1.2 : 0;
    [[1, -sw], [-1, sw]].forEach(([k, s]) => { const x = k * o.L * 0.15; line(x, by + o.H * 0.6, x + s, -0.4, INK, o.legW + 0.7); line(x, by + o.H * 0.6, x + s, -0.4, lc, o.legW); line(x + s - 1, 0, x + s + 1.2, 0, lc, 0.7); });
    if (back) o.head(true, by);
    if (o.tail) o.tail(by);
    torso(0, by, o.L, o.H, cols3(o.body), o.rot || -0.12);
    // 날개 — 가까운 쪽
    const W = cols3(o.wing || [o.body[1], o.body[2], shade(o.body[2], -0.15)]);
    g.beginPath(); g.ellipse(-o.L * 0.15, by + 0.3, o.L * 0.62, o.H * 0.62, -0.18, 0, TAU); g.fillStyle = lin(-o.L, by - o.H, o.L * 0.4, by + o.H, W); g.fill(); ink(0.5);
    if (o.wingTip){ g.save(); g.beginPath(); g.ellipse(-o.L * 0.15, by + 0.3, o.L * 0.62, o.H * 0.62, -0.18, 0, TAU); g.clip(); g.fillStyle = tn(o.wingTip); g.fillRect(-o.L * 1.2, by - o.H, o.L * 0.55, o.H * 2); g.restore(); }
    curve(-o.L * 0.55, by + o.H * 0.1, -o.L * 0.1, by + o.H * 0.5, o.L * 0.3, by + o.H * 0.2, tn(shade(o.body[2], -0.15)), 0.4);
    if (!back) o.head(false, by);
  }
  const BEASTS = {};
  BEASTS.chicken = (f, back) => bird({ L: 6.5, H: 5.5, legH: 4, legW: 0.9, leg: '#ffb43d', body: ['#ffffff', '#fffaf2', '#ddd2c0'],
    tail: by => { [[-0.9, 4.5], [-0.6, 5], [-1.2, 4]].forEach(([a, l]) => leaf(-5.5, by - 1, Math.PI + a, l, 1.6, pal('#f6f0e4'), { vein: false })); },
    head: (bk, by) => { const hx = 5, hy = by - 6.5;
      line(3.5, by - 2, hx, hy + 2, INK, 4.2); line(3.5, by - 2, hx, hy + 2, tn('#fffaf2'), 3.4);
      ball(hx, hy, 3.1, pal('#fffaf2'), 3.1, LW);
      [[-1.2, -3.2], [0.2, -3.8], [1.4, -3.2]].forEach(([a, b]) => ovalI(hx + a, hy + b, 1.1, 1.2, tn('#ff5a4a'), 0.4));          // 볏
      if (bk) return;
      poly([[hx + 2.6, hy - 0.8], [hx + 5, hy + 0.1], [hx + 2.6, hy + 1]], tn('#ff9f2e'), 0.45);
      ovalI(hx + 2.4, hy + 2.2, 0.8, 1.2, tn('#ff5a4a'), 0.35); eye(hx + 1.2, hy - 0.6, 0.75);
    } }, f, back);
  BEASTS.duck = (f, back) => bird({ L: 7.5, H: 5, legH: 2.5, legW: 1.1, leg: '#ff9f2e', body: ['#ffffff', '#fbf6ea', '#d6cdba'], rot: -0.05,
    tail: by => poly([[-6.5, by - 1.5], [-9.5, by - 3.6], [-7.2, by + 1]], tn('#ece4d2'), 0.45),
    head: (bk, by) => { const hx = 5.5, hy = by - 6;
      line(4, by - 1.5, hx, hy + 2, INK, 4.4); line(4, by - 1.5, hx, hy + 2, tn('#fdf8ee'), 3.6);
      ball(hx, hy, 3.2, pal('#fffdf6'), 3, LW);
      if (bk) return;
      g.beginPath(); g.moveTo(hx + 2.2, hy - 0.2); g.quadraticCurveTo(hx + 6, hy - 0.6, hx + 5.6, hy + 0.9); g.quadraticCurveTo(hx + 4, hy + 1.6, hx + 2.2, hy + 1.2); g.closePath(); g.fillStyle = tn('#ffc23f'); g.fill(); ink(0.45);
      eye(hx + 1, hy - 0.8, 0.75); blush(hx + 0.4, hy + 1.1);
    } }, f, back);
  BEASTS.gull = (f, back) => bird({ L: 7, H: 4.8, legH: 3.5, legW: 0.9, leg: '#f2b04e', body: ['#ffffff', '#f6f8fa', '#cfd7de'], wing: ['#cbd3da', '#a4b0bb', '#7d8994'], wingTip: '#2f3338',
    tail: by => poly([[-6, by - 1], [-10, by - 2], [-9.5, by + 0.8], [-6, by + 1.2]], tn('#2f3338'), 0.45),
    head: (bk, by) => { const hx = 5.5, hy = by - 5.6;
      line(4, by - 1.5, hx, hy + 2, INK, 4); line(4, by - 1.5, hx, hy + 2, tn('#ffffff'), 3.2);
      ball(hx, hy, 3, pal('#ffffff'), 2.9, LW);
      if (bk) return;
      poly([[hx + 2.4, hy - 0.4], [hx + 6, hy + 0.4], [hx + 5.4, hy + 1.2], [hx + 2.4, hy + 1]], tn('#f5c542'), 0.45); oval(hx + 4.8, hy + 1, 0.5, 0.4, tn('#e0453a'));
      eye(hx + 1, hy - 0.7, 0.7);
    } }, f, back);
  BEASTS.crane = (f, back) => bird({ L: 7, H: 4.6, legH: 15, legW: 0.7, leg: '#3a3a3e', body: ['#ffffff', '#f7f7f3', '#d6d6ce'], rot: -0.08,
    tail: by => { [[-0.4, 5], [-0.1, 5.5], [0.25, 4.6]].forEach(([a, l]) => leaf(-5.5, by, Math.PI + a, l, 1.4, pal('#2a2a2e'), { vein: false })); },
    head: (bk, by) => { const hx = 5, hy = by - 15;
      g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(4, by - 1.5); g.quadraticCurveTo(7.5, by - 8, hx, hy + 1.5); g.stroke(); g.strokeStyle = tn('#2a2a2e'); g.lineWidth = 1.6; g.stroke();
      ball(hx, hy, 2.4, pal('#ffffff'), 2.3, LW); ovalI(hx - 0.2, hy - 2, 1.2, 0.8, tn('#e0303a'), 0.35);
      if (bk) return;
      poly([[hx + 1.8, hy - 0.3], [hx + 7, hy + 0.5], [hx + 1.8, hy + 0.9]], tn('#b8b08a'), 0.4); eye(hx + 0.8, hy - 0.4, 0.6);
    } }, f, back);
  // 얼굴 붙이기 — 머리 동그라미, 귀, 주둥이. o.face 가 나머지
  function headAt(hx, hy, r, cols, bk, o){
    if (o.earsBack) o.earsBack(hx, hy, r);
    const gr = g.createRadialGradient(hx - r * 0.3, hy - r * 0.4, r * 0.2, hx, hy, r * 1.1); gr.addColorStop(0, tn(cols[0])); gr.addColorStop(0.65, tn(cols[1])); gr.addColorStop(1, tn(cols[2]));
    ovalI(hx, hy, r * (o.wide || 1), r, gr, LW);
    if (o.ears) o.ears(hx, hy, r, bk);
    if (!bk && o.face) o.face(hx, hy, r);
  }
  const snout = (x, y, rx, ry, c, nos) => { ovalI(x, y, rx, ry, tn(c), 0.5); if (nos) [-1, 1].forEach(s => oval(x + rx * 0.25 + s * rx * 0.28, y, rx * 0.12, ry * 0.25, tn(shade(c, -0.5)))); };
  const ear = (x, y, w, h, rot, c, inner) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 0.6, -h, 0, -h); g.quadraticCurveTo(w * 0.6, -h, w, 0); g.closePath(); g.fillStyle = tn(c); g.fill(); ink(0.5); if (inner){ g.beginPath(); g.moveTo(-w * 0.5, -0.2); g.quadraticCurveTo(-w * 0.3, -h * 0.75, 0, -h * 0.75); g.quadraticCurveTo(w * 0.3, -h * 0.75, w * 0.5, -0.2); g.closePath(); g.fillStyle = tn(inner); g.fill(); } g.restore(); };
  BEASTS.cow = (f, back) => quad({ L: 14, H: 8, legH: 10, legW: 3, leg: '#f7f2ea', hoof: '#4a3a2e', body: ['#ffffff', '#f5f0e8', '#cfc6b8'],
    pat: by => { [[-7, -2, 4, 3], [3, 2.5, 3.6, 2.6], [8, -4, 2.6, 2.2], [-2, -5.5, 2.4, 1.6]].forEach(([x, y, rx, ry], i) => { g.beginPath(); for (let j = 0; j <= 12; j++){ const a = j / 12 * TAU, rr = 1 + 0.18 * Math.sin(j * 2.3 + i); g.lineTo(x + Math.cos(a) * rx * rr, by + y + Math.sin(a) * ry * rr); } g.fillStyle = tn('#2e2a26'); g.fill(); }); ovalI(-3, by + 7.2, 3, 1.8, tn('#ffb3c1'), 0.45); },
    tail: (bk, by) => { stem(-13.5, by - 3, -16, by + 2, -15.5, by + 8, tn('#f0e8dc'), 0.9); ovalI(-15.5, by + 8.6, 1.2, 1.7, tn('#3a3226'), 0.4); },
    head: (bk, by) => headAt(15, by - 5, 6, ['#ffffff', '#f5f0e8', '#d6cdbf'], bk, {
      ears: (x, y, r) => { ear(x - 4.8, y - 2.5, 1.6, 4, -1.9, '#f5f0e8', '#f2c9c2'); if (!bk) ear(x + 4.6, y - 2.6, 1.6, 4, 1.9, '#f5f0e8', '#f2c9c2'); [-1, 1].forEach(s => { stem(x + s * 2.2, y - r * 0.8, x + s * 3, y - r * 1.2, x + s * 3.2, y - r * 1.4, tn('#e8dcc4'), 1); }); g.save(); g.beginPath(); g.ellipse(x, y, r, r, 0, 0, TAU); g.clip(); oval(x - r * 0.6, y - r * 0.5, r * 0.55, r * 0.5, tn('#2e2a26')); g.restore(); },
      face: (x, y, r) => { snout(x + 2.2, y + r * 0.55, 3.6, 2.4, '#ffc0c8', true); eye(x - 0.6, y - 0.8); eye(x + 3, y - 0.9); blush(x - 2, y + 1.6); } }) }, f, back);
  BEASTS.reindeer = (f, back) => quad({ L: 12.5, H: 7, legH: 11, legW: 2.4, leg: '#7a5436', hoof: '#2e241c', body: ['#c08e60', '#a07048', '#6e4a2c'],
    pat: by => { oval(4, by + 4.5, 9, 3.5, tn('#e8dcc4')); oval(10.5, by - 1, 4, 6, tn('#efe4d0')); },
    tail: (bk, by) => ovalI(-12.6, by - 2.6, 1.8, 1.4, tn('#f6efe2'), 0.45),
    head: (bk, by) => {
      const hx = 14, hy = by - 9;
      g.beginPath(); g.moveTo(8.5, by - 4); g.lineTo(11, by + 2); g.lineTo(hx + 1.5, hy + 3); g.lineTo(hx - 3, hy - 1); g.closePath(); g.fillStyle = tn('#efe4d0'); g.fill(); ink(0.5);      // 크림빛 목털
      // 뿔 — 갈래진 가지 둘
      const antler = (s, dk) => { const c = tn(dk ? '#b89a70' : '#e0caa0'), bx = hx + s * 1.6 - 1, byy = hy - 4.5;
        const br = (x0, y0, x1, y1, cx, cy) => stem(x0, y0, cx, cy, x1, y1, c, 1);
        br(bx, byy, bx - 4 + s * 2, byy - 9, bx - 3 + s, byy - 4); br(bx - 2.6 + s * 1.2, byy - 5, bx - 6 + s * 1.4, byy - 7, bx - 4.5, byy - 5.5); br(bx - 3.2 + s * 1.6, byy - 7.5, bx - 1 + s * 2, byy - 12, bx - 2 + s * 1.8, byy - 10); br(bx - 1.6 + s, byy - 3, bx + 1.6 + s, byy - 6, bx, byy - 5);
      };
      antler(-1, true);
      headAt(hx, hy, 4.6, ['#c89a6a', '#a87a50', '#7a5434'], bk, { wide: 1,
        ears: (x, y) => { ear(x - 4, y - 1.6, 1.4, 4, -1.7, '#a07048', '#e8c8a8'); if (!bk) ear(x + 3.6, y - 2, 1.4, 4, 1.6, '#a07048', '#e8c8a8'); },
        face: (x, y, r) => { g.fillStyle = tn('#d8b088'); g.beginPath(); g.ellipse(x + 2.6, y + r * 0.45, 3.2, 2.2, 0, 0, TAU); g.fill(); ink(0.45); ovalI(x + 4.8, y + r * 0.2, 1.4, 1.1, tn('#3a2a22'), 0.4); oval(x + 4.4, y + r * 0.05, 0.45, 0.3, 'rgba(255,255,255,.6)'); eye(x - 0.2, y - 0.8); eye(x + 2.6, y - 1); blush(x - 1.6, y + 1.4); } });
      antler(1, false);
      if (!bk){ g.strokeStyle = tn('#c8323a'); g.lineWidth = 1.6; g.beginPath(); g.ellipse(hx - 2.5, hy + 4.6, 3.4, 1.4, -0.4, 0, Math.PI); g.stroke(); ball(hx - 2.2, hy + 6.6, 1.3, pal('#f2c040'), 1.3, 0.45); }   // 빨간 목줄과 금방울
    } }, f, back);
  BEASTS.goat = (f, back) => quad({ L: 10, H: 6, legH: 10, legW: 2, leg: '#ece2cf', hoof: '#4a4038', body: ['#fffcf4', '#f1e7d4', '#cdbd9e'],
    tail: (bk, by) => leaf(-9.5, by - 3, -2.4, 3.4, 1, pal('#e6d6ba'), { vein: false }),
    head: (bk, by) => headAt(11.5, by - 7, 4.4, ['#fffcf4', '#f1e7d4', '#d4c4a6'], bk, {
      ears: (x, y, r) => { stem(x - 1, y - r * 0.8, x - 3.6, y - r * 1.8, x - 5, y - r * 1.2, tn('#9a8466'), 1.1); stem(x + 0.6, y - r * 0.9, x - 1.8, y - r * 2, x - 3.4, y - r * 1.5, tn('#b8a282'), 1.1); ear(x - 3.4, y + 0.2, 1.2, 3.6, -2.3, '#e6d6ba'); if (!bk) ear(x + 3.2, y + 0.4, 1.2, 3.6, 2.2, '#e6d6ba'); },
      face: (x, y, r) => { snout(x + 2.4, y + r * 0.5, 2.6, 1.8, '#f2c9b8', true); poly([[x + 1.4, y + r * 0.9], [x + 2.6, y + r * 0.9], [x + 1.6, y + r * 1.6]], tn('#d8c8a8'), 0.4); eye(x - 0.4, y - 0.6, 0.8); eye(x + 2.2, y - 0.8, 0.8); } }) }, f, back);
  BEASTS.sheep = (f, back) => quad({ L: 10, H: 7.5, legH: 6, legW: 2, leg: '#5a5048', hoof: '#1f1a14', body: ['#fffdf6', '#f3ecdc', '#d4c9b2'],
    pat: by => { for (let i = 0; i < 16; i++){ const a = i / 16 * TAU, x = Math.cos(a) * 8, y = by + Math.sin(a) * 5.6; oval(x, y - 0.6, 2.6, 2.2, tn(i % 3 ? '#fffdf6' : '#f6efe0')); g.strokeStyle = tn('#d8ceb8'); g.lineWidth = 0.35; g.beginPath(); g.arc(x, y, 1.6, 0.4, 2.6); g.stroke(); } },
    tail: (bk, by) => ball(-10.4, by - 1.6, 2, pal('#f6efe0'), 2, 0.5),
    head: (bk, by) => headAt(10.5, by - 4, 4.4, ['#fbe8cc', '#f0d6b0', '#d4b48a'], bk, {
      ears: (x, y, r) => { ear(x - 3.8, y + 0.4, 1.3, 3.8, -2.2, '#e0c49a', '#f2c9c2'); if (!bk) ear(x + 3.6, y + 0.6, 1.3, 3.8, 2.2, '#e0c49a', '#f2c9c2'); [[-2, -3.6], [0, -4.4], [2, -3.6], [-0.8, -2.8]].forEach(([a, b]) => ball(x + a, y + b, 1.9, pal('#fffdf6'), 1.7, 0.4)); },
      face: (x, y, r) => { oval(x + 2.4, y + r * 0.55, 1, 0.7, tn('#e8a9a2')); eye(x - 0.4, y - 0.2, 0.8); eye(x + 2.2, y - 0.3, 0.8); blush(x - 1.6, y + 1.6); } }) }, f, back);
  BEASTS.pig = (f, back) => quad({ L: 10.5, H: 7, legH: 4.5, legW: 2.4, leg: '#f2a0b0', hoof: '#c97a8a', body: ['#ffdbe2', '#ffb3c1', '#e48aa0'],
    tail: (bk, by) => { g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(-11.6, by - 2.6, 1.5, 0.3, TAU * 0.85); g.stroke(); g.strokeStyle = tn('#f2a0b0'); g.lineWidth = 0.8; g.stroke(); },
    head: (bk, by) => headAt(10.5, by - 2, 5.2, ['#ffdbe2', '#ffb3c1', '#e88aa0'], bk, {
      ears: (x, y, r) => { ear(x - 2.6, y - r * 0.7, 1.8, 3.4, -0.5, '#f598ad', '#ffc9d4'); if (!bk) ear(x + 2, y - r * 0.8, 1.8, 3.4, 0.6, '#f598ad', '#ffc9d4'); },
      face: (x, y) => { snout(x + 4, y + 1, 2.2, 1.9, '#f598ad', true); eye(x - 0.2, y - 1.2, 0.8); eye(x + 2.4, y - 1.3, 0.8); blush(x - 1.6, y + 1.4); } }) }, f, back);
  BEASTS.dog = (f, back) => quad({ L: 8.5, H: 5, legH: 6, legW: 2, leg: '#d09858', body: ['#f6d29c', '#dca36a', '#b07a44'],
    tail: (bk, by) => { const w = f ? 0.4 : -0.2; stem(-8, by - 2, -11, by - 5 + w * 4, -10.5 + w * 3, by - 9, tn('#dca36a'), 1.6); },
    head: (bk, by) => { headAt(9.5, by - 6, 4.8, ['#f6d29c', '#dca36a', '#b57f48'], bk, {
      ears: (x, y, r) => { const gr = lin(x - 3, y - r, x, y + r, [tn('#a8784a'), tn('#7a4e2c')]); ovalI(x - 2, y + 0.4, 1.8, 3.6, gr, 0.5, 0.3); },   // 늘어진 귀 — 머리 뒤쪽에
      face: (x, y, r) => { snout(x + 3, y + r * 0.45, 2.6, 1.9, '#f6dcb0'); ovalI(x + 5, y + r * 0.2, 1.1, 0.9, tn('#3a2a22'), 0.4); eye(x - 0.2, y - 0.8, 0.85); eye(x + 2.4, y - 1, 0.85); blush(x - 1.6, y + 1.4); } });
      if (!bk){ g.strokeStyle = tn('#e8453c'); g.lineWidth = 1.5; g.beginPath(); g.ellipse(7, by - 2.2, 2.6, 1.2, -0.6, 0, Math.PI); g.stroke(); ball(7.6, by - 0.6, 0.9, pal('#f2c040'), 0.9, 0.35); } } }, f, back);
  BEASTS.cat = (f, back) => quad({ L: 7.5, H: 4.4, legH: 5, legW: 1.7, leg: '#e8a060', body: ['#ffd6a0', '#f2a65a', '#c9803c'],
    pat: by => { for (let i = -2; i <= 2; i++) curve(i * 2.6 - 0.8, by - 4.4, i * 2.6, by - 1.5, i * 2.6 + 0.6, by + 0.5, tn('#c9803c'), 0.9); },
    tail: (bk, by) => { stem(-7, by - 1, -11, by - 2, -10.4, by - 9 + (f ? 1 : 0), tn('#f2a65a'), 1.5); },
    head: (bk, by) => headAt(8.5, by - 5.5, 4.4, ['#ffd6a0', '#f2a65a', '#c9803c'], bk, { wide: 1.08,
      ears: (x, y, r) => { ear(x - 2.6, y - r * 0.7, 1.7, 3.4, -0.35, '#e08a44', '#ffc9d4'); if (!bk) ear(x + 2.4, y - r * 0.75, 1.7, 3.4, 0.4, '#e08a44', '#ffc9d4'); line(x - 1, y - r * 0.95, x - 0.6, y - r * 0.5, tn('#c9803c'), 0.7); },
      face: (x, y, r) => { oval(x + 1.4, y + r * 0.45, 2.4, 1.5, tn('#fff6e9')); poly([[x + 1, y + 0.6], [x + 2, y + 0.6], [x + 1.5, y + 1.2]], tn('#ff9aa8')); eye(x - 0.6, y - 0.6, 0.85); eye(x + 2.4, y - 0.7, 0.85); [-1, 1].forEach(s => { line(x + 3, y + 1 + s * 0.4, x + 6, y + 0.6 + s * 1, 'rgba(255,255,255,.8)', 0.3); }); blush(x - 2, y + 1.4); } }) }, f, back);
  // 토끼 — 다리가 거의 안 보이게 웅크린 둥근 몸, 걸음이면 깡충 들린다
  BEASTS.rabbit = (f, back) => {
    const lift = f ? -1.6 : 0, by = -4.4 + lift, B = ['#ffffff', '#f6f0e6', '#d4cbbd'];
    oval(-2.6, by + 3.6, 3, 1.4, tn('#e8e0d2'));
    if (back) BEASTS.rabbitHead(true, by);
    torso(0, by, 5.8, 4.4, cols3(B));
    ball(-5.6, by - 0.6, 1.8, pal('#ffffff'), 1.8, 0.45);
    ovalI(3.2, by + 3.6, 1.8, 1, tn('#f6f0e6'), 0.45);
    if (!back) BEASTS.rabbitHead(false, by);
  };
  BEASTS.rabbitHead = (bk, by) => headAt(4.6, by - 4.2, 3.6, ['#ffffff', '#f6f0e6', '#d9d0c2'], bk, {
    ears: (x, y, r) => { ear(x - 1.4, y - r * 0.6, 1.3, 6.4, -0.25, '#fbf6ee', '#ffb3c4'); if (!bk) ear(x + 0.8, y - r * 0.7, 1.3, 6.2, 0.15, '#fbf6ee', '#ffb3c4'); },
    face: (x, y, r) => { oval(x + 2.6, y + r * 0.3, 0.6, 0.45, tn('#ff9ab0')); eye(x + 0.2, y - 0.3, 0.75); eye(x + 2, y - 0.4, 0.75); blush(x - 0.8, y + 1.2); } });
  // 맨 위 높이(도트) — 다 되었다는 말풍선을 그 위에 띄운다
  const TOPZ = { chicken: 20, duck: 17, gull: 17, crane: 34, cow: 32, reindeer: 44, goat: 28, sheep: 26, pig: 22, dog: 22, cat: 19, rabbit: 21 };
  const BABY = 2 / 3;
  const beastBuf = {};
  function beastSprite(kind, back, frame, baby, sc){
    const key = kind + '|' + (back ? 1 : 0) + '|' + frame + '|' + (baby ? 1 : 0) + '|' + (NIGHT ? 1 : 0) + '|' + sc;
    let cv = beastBuf[key];
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = Math.ceil(80 * sc); cv.height = Math.ceil(72 * sc);
    const c = cv.getContext('2d'), keep = g;
    c.scale(sc, sc); c.translate(40, 64); if (baby) c.scale(BABY, BABY);
    g = c;
    try { (BEASTS[kind] || BEASTS.chicken)(frame, back); } finally { g = keep; }
    return (beastBuf[key] = cv);
  }
  // 다 되었다는 표시 — 동그란 말풍선 안에 내놓는 것(달걀·우유·털…). 물어 오는 아이(강아지·고양이·갈매기·두루미)는 반짝이는 선물
  function readyBubble(x, y, kind){
    const A = RULES() && RULES().ANIMALS[kind], pr = A && A.product;
    poly([[x - 1.6, y + 5], [x + 1.6, y + 5], [x, y + 8]], '#ffffff', 0.55);
    ovalI(x, y, 6.2, 6, '#ffffff', 0.7); oval(x, y + 5.2, 1.4, 0.6, '#ffffff');
    const P = pal;
    if (pr === 'egg' || pr === 'duckegg') ball(x, y + 0.4, 2.6, P(pr === 'egg' ? '#f6e6c8' : '#cfe8e0'), 3.2, 0.5);
    else if (pr === 'milk'){ g.fillStyle = lin(x - 2.4, 0, x + 2.4, 0, ['#ffffff', '#eef2f6', '#c8d0da']); g.beginPath(); g.moveTo(x - 1.2, y - 3.4); g.lineTo(x + 1.2, y - 3.4); g.lineTo(x + 1.2, y - 2); g.lineTo(x + 2.4, y - 0.6); g.lineTo(x + 2.4, y + 3.6); g.lineTo(x - 2.4, y + 3.6); g.lineTo(x - 2.4, y - 0.6); g.lineTo(x - 1.2, y - 2); g.closePath(); g.fill(); ink(0.5); g.fillStyle = '#5a9ad8'; g.fillRect(x - 1.3, y - 4.2, 2.6, 1.2); g.fillStyle = '#7fb6e8'; g.fillRect(x - 2.4, y + 0.2, 4.8, 1.4); }
    else if (pr === 'wool' || pr === 'angora'){ ball(x, y + 0.3, 3.2, P(pr === 'wool' ? '#f6eedc' : '#fde8ee'), 3, 0.5); g.strokeStyle = pr === 'wool' ? '#d8c8a8' : '#f0b8c8'; g.lineWidth = 0.5; [[-1, -1, 1.6], [1, 0.5, 1.4], [-0.5, 1.4, 1]].forEach(([a, b, r]) => { g.beginPath(); g.arc(x + a, y + b, r, 0.3, 3.6); g.stroke(); }); }
    else if (pr === 'truffle'){ ball(x, y + 0.6, 3, P('#6a4a36'), 2.6, 0.5); [[-1, -0.4], [1, 0.8], [0.2, 1.8]].forEach(([a, b]) => oval(x + a, y + b, 0.4, 0.4, '#3a2a20')); }
    else { g.fillStyle = lin(x - 3, y - 3, x + 3, y + 3, ['#fff3b8', '#ffd84a', '#e8a828']); g.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 1.4 : 3.4; g.lineTo(x + Math.cos(a) * rr, y + 0.4 + Math.sin(a) * rr); } g.closePath(); g.fill(); ink(0.5); }
    twinkle(x + 5, y - 5, 1.4, '#ffe680');
  }
  // 동물 한 마리 — (x, y) 발끝(도트), d = 'u' | 'v' | '-u' | '-v', frame 0·1, lift = 들썩임(도트), ready = 거둘 것이 있음
  function animal(gg, E, kind, x, y, d, frame, baby, lift, ready){
    set(gg, E);
    const sc = Math.max(1, Math.abs(gg.getTransform().a) || 1), back = d === '-u' || d === '-v', flip = d === 'v' || d === '-u', k = baby ? BABY : 1;
    oval(x + 1, y + 0.6, (kind === 'cow' || kind === 'reindeer' ? 13 : kind === 'goat' || kind === 'sheep' || kind === 'pig' ? 10 : 7) * k, (kind === 'cow' || kind === 'reindeer' ? 4.4 : 3.2) * k, shadowC());
    const cv = beastSprite(kind, back, frame ? 1 : 0, baby, Math.round(sc * 4) / 4);
    const px = Math.round(x * sc) / sc, py = Math.round((y - (lift || 0)) * sc) / sc;
    g.save(); g.translate(px, py); if (flip) g.scale(-1, 1);
    g.drawImage(cv, -40, -64, 80, 72);
    g.restore();
    if (ready){ const by = y - (TOPZ[kind] || 22) * k - 9 + Math.sin(E.t * 2.5) * 1.2; readyBubble(x, by, kind); }
  }

  Object.assign(HD, { plot, ghost, crop, giant, sprinkler, animal });
})();
