// pages/farm-wild.js — 단풍·밀림·사바나 농장 그림(2026-10-09 로키즈 「오로라와 사막 사이에 농장 셋」).
// 오로라 눈 섬에서 남쪽으로 내려가며 점점 따뜻해지다 사막에 닿는다:
//   단풍 농장 — 캐나다 단풍 골짜기. 빨강·주황·노랑 숲, 호수, 통나무 오두막(오로라 그림에서 눈만 뺌), 시럽 양동이
//   밀림 농장 — 아마존 밀림. 안개 낀 둥근 산과 폭포, 덩굴 나무와 야자, 기둥 위 초가집, 날마다 지나가는 스콜
//   사바나 농장 — 케냐 초원. 킬리만자로와 노을, 아카시아·바오밥, 둥근 흙집, 지평선을 걷는 기린·코끼리 그림자
// pages/farm-hd.js 의 붓(FARMHD.kit)으로 칠하고 FARMHD.addFarm 으로 하늘·섬·나무·건물을 끼운다. 좌표는 농장 도트 단위(칸 마름모 40×20).
// 꾸미개는 추억으로 뒤 농장까지 따라가니 농장별(EXT)이 아니라 공용 그림판(kit.D)에 넣는다.
(function(){
  'use strict';
  const HD = window.FARMHD; if (!HD || !HD.kit) return;
  const K = HD.kit, TAU = Math.PI * 2, STILL = K.STILL, INK = K.INK;
  const { R, poly, oval, lin, vgrad, glow, line, q, box, roof, foot, footBox, geo, post, ovI, curve, along, onFace, faceAt, look, tone, shade, mix, hash, h2 } = K;
  const G = () => K.ctx();
  const horizon = E => E.top + 34;
  const lerp = (a, b, k) => a + (b - a) * k;

  // ================= 빛깔 =================
  // 공통 틀 — 눈(drift)은 투명이라 오로라 그림 곳곳의 눈이 사라지고, dry 라 지붕 눈도 안 얹는다
  const NOSNOW = { snowcap: 'rgba(0,0,0,0)', drift: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], aurora: 0, dry: true };
  const LOOK_MAPLE = {
    day: Object.assign({}, NOSNOW, { sky: ['#5d9bd6', '#8cc0e6', '#cfe4ef', '#f4ead8'], star: false, moon: false,
      far: '#8aa0b8', far2: '#7a8aa0', sea: ['#6aa8d0', '#3a78a8'], floe: ['#8ac0e0', '#5a98c0'],
      snow: ['#b8b264', '#94904a'], snowHi: 'rgba(255,240,190,.22)', snowLo: 'rgba(90,60,20,.1)',
      cliff: ['#8a6a4a', '#6e5440', '#5a4436', '#44342a'], stone: ['#c8bca8', '#bcb09c', '#d4cab8', '#b0a490'],
      fir: ['#2f5a44', '#244a38', '#1a3a2c'], firSnow: ['#3a6a50', '#2e5a42'], frost: ['#e8702a', '#c8401a', '#ffb050'], trunk: ['#6a4a34', '#4e3626'],
      glow: 0, haze: 'rgba(236,228,214,', shadow: 'rgba(70,50,30,.24)', win: '#6f9ec4', ice: ['#6aa8d0', '#3a78a8', '#ffffff'], sand: ['#b8b264', '#94904a'] }),
    night: Object.assign({}, NOSNOW, { sky: ['#070b22', '#141c40', '#2a2a50', '#4a3a50'], star: true, moon: true,
      far: '#262c48', far2: '#2e3450', sea: ['#1a2a48', '#0e1830'], floe: ['#2a3a5a', '#1e2c48'],
      snow: ['#56563e', '#444632'], snowHi: 'rgba(255,230,200,.06)', snowLo: 'rgba(0,0,20,.16)',
      cliff: ['#46384a', '#3a2e40', '#2e2434', '#221a28'], stone: ['#6a6a76', '#62626e', '#72727e', '#5a5a66'],
      fir: ['#1a3a30', '#142e26', '#0e221c'], firSnow: ['#22463a', '#1a3a2e'], frost: ['#a85030', '#883020', '#c87a40'], trunk: ['#4a3a30', '#382a24'],
      glow: 1, haze: 'rgba(60,60,100,', shadow: 'rgba(0,6,20,.34)', win: '#ffd98a', ice: ['#2a4a7a', '#163058', '#a0b8e0'], sand: ['#56563e', '#444632'] }),
  };
  const LOOK_JUNGLE = {
    day: Object.assign({}, NOSNOW, { sky: ['#3a8ab8', '#6ab0c8', '#b0d8c8', '#d8ecc8'], star: false, moon: false,
      far: '#2f6a4a', far2: '#1f5a36', sea: ['#1e5a2a', '#0e3a18'], floe: ['#2f7a34', '#1a5a24'],
      snow: ['#2f7a30', '#1c5a22'], snowHi: 'rgba(180,240,120,.12)', snowLo: 'rgba(0,30,0,.18)',
      cliff: ['#a85a3a', '#8a4a30', '#6e3a28', '#522c20'], stone: ['#a8a088', '#9a927a', '#b4ac94', '#8e8670'],
      fir: ['#1e5a2e', '#144a24', '#0c3a1a'], firSnow: ['#2a6a36', '#1e5a2e'], frost: ['#2a7a30', '#1a5a24', '#4a9a40'], trunk: ['#6a4a30', '#4a3420'],
      glow: 0, haze: 'rgba(200,230,206,', shadow: 'rgba(0,30,0,.32)', win: '#5a86a0', ice: ['#3ab0b0', '#1a8090', '#ffffff'], sand: ['#5aa84a', '#3f8a38'] }),
    night: Object.assign({}, NOSNOW, { sky: ['#040c1a', '#0a1c30', '#123040', '#1a3a40'], star: true, moon: true,
      far: '#14302a', far2: '#102a22', sea: ['#0e2a1a', '#081c10'], floe: ['#163a24', '#102c1a'],
      snow: ['#284a2a', '#1e3a20'], snowHi: 'rgba(180,255,200,.05)', snowLo: 'rgba(0,10,0,.2)',
      cliff: ['#4a2e2a', '#3c2422', '#2e1c1c', '#221416'], stone: ['#56584e', '#4e5046', '#5e6056', '#46483e'],
      fir: ['#123a22', '#0e2e1a', '#082214'], firSnow: ['#18462a', '#123a22'], frost: ['#1a4a26', '#123a1e', '#2a5a32'], trunk: ['#3a2e24', '#2a2018'],
      glow: 1, haze: 'rgba(40,80,70,', shadow: 'rgba(0,10,10,.36)', win: '#ffd98a', ice: ['#1a4a5a', '#0e3040', '#80c0c0'], sand: ['#284a2a', '#1e3a20'] }),
  };
  const LOOK_SAVANNA = {
    day: Object.assign({}, NOSNOW, { sky: ['#5a98d0', '#9cc4dc', '#f0d8a8', '#f8c088'], star: false, moon: false,
      far: '#b8906a', far2: '#c8a070', sea: ['#d8b468', '#c09450'], floe: ['#e0c078', '#c8a058'],
      snow: ['#dcc46e', '#c4a654'], snowHi: 'rgba(255,248,210,.24)', snowLo: 'rgba(140,90,30,.1)',
      cliff: ['#c0703e', '#a85e34', '#8a4a2a', '#6a3820'], stone: ['#d8a878', '#cc9a6a', '#e2b688', '#c08c5e'],
      fir: ['#5a7a3a', '#4a6a30', '#3a5a26'], firSnow: ['#6a8a44', '#5a7a3a'], frost: ['#7a9a4a', '#5a7a3a', '#a8c070'], trunk: ['#7a5a40', '#5a4030'],
      glow: 0, haze: 'rgba(250,226,190,', shadow: 'rgba(110,60,20,.24)', win: '#5a86b0', ice: ['#5ab0c8', '#2a88a8', '#ffffff'], sand: ['#dcc46e', '#c4a654'] }),
    night: Object.assign({}, NOSNOW, { sky: ['#06081e', '#12163a', '#2a2448', '#4a3448'], star: true, moon: true,
      far: '#2a2438', far2: '#342a40', sea: ['#3a3432', '#2a2422'], floe: ['#463e38', '#36302c'],
      snow: ['#6a5e40', '#554a32'], snowHi: 'rgba(255,230,190,.06)', snowLo: 'rgba(10,0,20,.16)',
      cliff: ['#5a3a3a', '#4a2e30', '#3a2428', '#2a1a20'], stone: ['#76666a', '#6e5e62', '#7e6e72', '#665a5e'],
      fir: ['#2a3a24', '#22301c', '#1a2616'], firSnow: ['#34442c', '#2a3a24'], frost: ['#3a4a2a', '#2e3e22', '#4a5a34'], trunk: ['#4a3a30', '#382a24'],
      glow: 1, haze: 'rgba(80,60,90,', shadow: 'rgba(10,0,20,.34)', win: '#ffd98a', ice: ['#2a4a7a', '#163058', '#a0b8e0'], sand: ['#6a5e40', '#554a32'] }),
  };

  // ================= 공통 붓 =================
  // 별·달·해
  function stars(E, n, hy, col){ for (let i = 0; i < n; i++){ const x = hash(i * 7 + 1) * E.w, y = hash(i * 11 + 3) * hy * 0.92, a = 0.3 + 0.65 * Math.abs(Math.sin(E.t * (0.4 + hash(i)) + i)), s = hash(i * 5) < 0.1 ? 1.2 : 0.7; R(x, y, s, s, (col || 'rgba(240,245,255,') + a.toFixed(2) + ')'); } }
  function moon(E, x, y, r, sky){ glow(x, y, r * 4.4, 'rgba(220,230,255,', 0.32); oval(x, y, r, r, '#f2f4ff'); if (sky) oval(x + r * 0.42, y - r * 0.22, r * 0.9, r * 0.94, sky); }
  function sun(E, x, y, r, c){ glow(x, y, r * 8, c || 'rgba(255,246,220,', 0.6); oval(x, y, r, r, '#fffaf0'); }
  // 뭉게구름 — 둥근 뭉치 여럿, 아래는 그늘
  function puff(x, y, w, h, lite, dark){
    for (let i = 0; i < 6; i++){ const f = i / 5, cx = x - w / 2 + w * f, r = h * (0.5 + 0.35 * Math.sin(f * Math.PI)); oval(cx, y + r * 0.25, r * 1.15, r * 0.6, dark); }
    for (let i = 0; i < 6; i++){ const f = i / 5, cx = x - w / 2 + w * f, r = h * (0.5 + 0.35 * Math.sin(f * Math.PI)); oval(cx, y - r * 0.1, r, r * 0.7, lite); }
  }
  // 물결 언덕 — base 에서 위로 amp 만큼 출렁
  function hill(E, base, amp, f, sd, col, round){
    const gx = G(); gx.beginPath(); gx.moveTo(0, base + 8);
    for (let x = 0; x <= E.w + 3; x += 3){ const k = round ? Math.pow(Math.abs(Math.sin(x * f + sd)), 0.6) : 0.55 + 0.45 * Math.sin(x * f + sd); gx.lineTo(x, base - amp * k * (0.75 + 0.25 * Math.sin(x * f * 0.37 + sd * 2))); }
    gx.lineTo(E.w, base + 8); gx.closePath(); gx.fillStyle = col; gx.fill();
  }
  const hillY = (x, base, amp, f, sd, round) => base - amp * (round ? Math.pow(Math.abs(Math.sin(x * f + sd)), 0.6) : 0.55 + 0.45 * Math.sin(x * f + sd)) * (0.75 + 0.25 * Math.sin(x * f * 0.37 + sd * 2));
  // 섬 옆구리 — 흙켜와 뿌리, 아래 끝은 들쭉날쭉
  function cliffFaces(E, seed){
    const L = look(E), D2 = E.cliff, C = E.cols, Rw = E.rows, lc = q(0, Rw, 0), bc = q(C, Rw, 0), rc = q(C, 0, 0), gx = G();
    const face = (a, b, sh, sd) => {
      for (let i = 0; i < 4; i++){ const d0 = D2 * i / 4, d1 = D2 * (i + 1) / 4 + 0.6; poly([[a[0], a[1] + d0], [b[0], b[1] + d0], [b[0], b[1] + d1], [a[0], a[1] + d1]], L.cliff[i]); }
      poly([[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + D2], [a[0], a[1] + D2]], 'rgba(0,0,0,' + sh + ')');
      gx.strokeStyle = E.night ? 'rgba(255,255,255,.05)' : 'rgba(255,230,190,.16)'; gx.lineWidth = 0.7; gx.beginPath();
      for (let k = 1; k < 7; k++){ const d = D2 * k / 7 + 1.5 * Math.sin(k * 1.7 + sd); gx.moveTo(a[0], a[1] + d); for (let f = 0; f <= 1.0001; f += 0.05) gx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + d + 1.2 * Math.sin(f * 26 + k)); }
      gx.stroke();
      for (let i = 0; i < 26; i++){ const f = hash(i * 9 + sd + seed), x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 6 + hash(i * 5 + sd) * (D2 - 14); oval(x, y, 1.6 + hash(i) * 1.6, 1, E.night ? 'rgba(120,110,100,.3)' : 'rgba(210,190,160,.45)'); }
      gx.fillStyle = L.cliff[3]; gx.beginPath(); gx.moveTo(a[0], a[1] + D2);
      for (let i = 0; i <= 24; i++){ const f = i / 24, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + D2; gx.lineTo(x, y + (i % 2 ? 4 : 10 + hash(i * 7 + sd) * 16)); }
      gx.lineTo(b[0], b[1] + D2); gx.closePath(); gx.fill();
    };
    face(lc, bc, 0, 0); face(bc, rc, 0.18, 3);
  }
  /* 섬 땅 — 바탕 빛깔 · 밝고 어두운 칸 · 풀 포기 · 농장마다 땅에 흩어진 것(o.deco(u, v, p, d)) · 돌길 · 풀 턱.
     paths = Set('x,y') 돌길, busy(u, v) = 밭·건물 자리 */
  function groundIsland(E, paths, busy, o){
    const L = look(E), C = E.cols, Rw = E.rows, tc = q(0, 0, 0), rc = q(C, 0, 0), bc = q(C, Rw, 0), lc = q(0, Rw, 0), gx = G();
    cliffFaces(E, o.seed || 0);
    if (o.hang) o.hang(lc, bc, rc);
    gx.save(); poly([tc, rc, bc, lc]); gx.clip();
    R(lc[0], tc[1], rc[0] - lc[0], bc[1] - tc[1], vgrad(tc[1], bc[1], L.snow));
    const lite = new Path2D(), dark = new Path2D(), D3 = K.diamond;
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){ if (paths.has(u + ',' + v)) continue; const h = h2(u, v); if (h < 0.26) D3(lite, u, v, 0.03); else if (h > 0.76) D3(dark, u, v, 0.03); }
    gx.fillStyle = L.snowHi; gx.fill(lite); gx.fillStyle = L.snowLo; gx.fill(dark);
    const tufts = new Path2D();
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){
      if (paths.has(u + ',' + v) || busy(u, v)) continue;
      const d = h2(u * 3 + 1, v * 7 + 2), p = q(u + 0.25 + h2(u, v + 3) * 0.5, v + 0.25 + h2(u + 3, v) * 0.5, 0);
      if (d < (o.tuftN || 0.25)){ const tl = o.tall || 4; for (let j = -2; j <= 2; j++){ tufts.moveTo(p[0] + j, p[1]); tufts.lineTo(p[0] + j * 2.2, p[1] - tl - (2 - Math.abs(j)) * 1.5); } }
      else if (o.deco) o.deco(u, v, p, d);
    }
    gx.strokeStyle = tone(E, o.tuft || '#4f7a34'); gx.lineWidth = 0.7; gx.lineCap = 'round'; gx.stroke(tufts);
    K.stones(E, paths);
    if (o.after) o.after(paths, busy);
    gx.restore();
    const lip = (a, b, sd) => { gx.fillStyle = L.snow[1]; gx.beginPath(); gx.moveTo(a[0], a[1] - 1); along(a, b, 44, (x, y, i) => gx.lineTo(x, y + 2.5 + 2 * Math.abs(Math.sin(i * 1.3 + sd)) + (i % 5 === 2 ? 4 : 0))); gx.lineTo(b[0], b[1] - 1); gx.closePath(); gx.fill(); };
    lip(lc, bc, 0); lip(bc, rc, 4);
  }
  // 그루터기(벤 나무)
  function freshStump(E, x, y, wood){
    oval(x + 2, y + 1, 9, 3, look(E).shadow);
    poly([[x - 4, y], [x + 4, y], [x + 3.4, y - 6], [x - 3.4, y - 6]], tone(E, wood || '#6a4a30'), true);
    oval(x, y - 6, 3.4, 1.4, tone(E, '#e8c890')); oval(x, y - 6, 1.6, 0.6, tone(E, '#c8a070'));
    for (let i = 0; i < 6; i++) oval(x - 8 + hash(i * 3 + x) * 16, y + 1 - hash(i * 7) * 2, 1.2, 0.5, tone(E, '#e0c08a'));
  }
  // 둥근 잎 덩이 나무 — 줄기 하나, 잎 뭉치(빛깔 셋), 잎 사이 그늘
  function roundTree(E, x, y, s, sd, cols, o){
    const L = look(E), gx = G(); o = o || {};
    oval(x + 5 * s, y + 1, 20 * s, 6 * s, L.shadow);
    const tr = tone(E, o.trunk || L.trunk[0]);
    poly([[x - 3 * s, y], [x + 3 * s, y], [x + 2 * s, y - 32 * s], [x - 2 * s, y - 32 * s]], tr, true);
    if (o.birch){ for (let i = 0; i < 6; i++){ const yy = y - 4 * s - i * 5 * s; line([x - 2.4 * s, yy], [x - 0.4 * s, yy - 0.6], tone(E, '#2a2a2a'), 0.8); } }
    gx.strokeStyle = tr; gx.lineWidth = 2 * s; gx.lineCap = 'round'; gx.beginPath(); gx.moveTo(x, y - 22 * s); gx.lineTo(x + 9 * s, y - 32 * s); gx.moveTo(x, y - 26 * s); gx.lineTo(x - 8 * s, y - 34 * s); gx.stroke();
    const Bs = o.blobs || [[-12, -42, 13], [10, -44, 13], [0, -56, 15], [-4, -38, 11], [12, -34, 10], [-14, -32, 8]];
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s + 0.9, b[2] * s * 0.86 + 0.9, INK));
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s * 0.86, tone(E, cols[1])));
    Bs.forEach(b => oval(x + (b[0] - 3) * s, y + (b[1] - 3) * s, b[2] * s * 0.72, b[2] * s * 0.62, tone(E, cols[0])));
    Bs.forEach(b => oval(x + (b[0] - 6) * s, y + (b[1] - 7) * s, b[2] * s * 0.3, b[2] * s * 0.2, tone(E, cols[2])));
    if (o.dots) for (let i = 0; i < 14; i++){ const bx = x + (hash(sd * 7 + i) - 0.5) * 34 * s, by = y - (30 + hash(sd * 3 + i) * 30) * s; oval(bx, by, 1.6 * s, 1.2 * s, tone(E, o.dots[i % o.dots.length])); }
  }

  // ================= 단풍 농장 =================
  const AUTUMN = [['#ffb050', '#e8702a', '#ffe0a0'], ['#f05a3a', '#c8301a', '#ffb090'], ['#f8d050', '#e0a020', '#fff0b0'], ['#e8803a', '#b8501e', '#ffc080']];
  function mapleBackdrop(E){
    const L = look(E), hy = horizon(E), t = E.t, gx = G();
    R(0, 0, E.w, hy + 2, vgrad(0, hy, L.sky));
    if (E.night){ stars(E, 120, hy); moon(E, E.w * 0.8, hy * 0.28, 7, L.sky[0]); }
    else {
      sun(E, E.w * 0.2, hy * 0.42, 8);
      for (let i = 0; i < 4; i++){ const w = 70 + hash(i * 5) * 60, x = ((hash(i * 13) * (E.w + w * 2) + t * (1.2 + hash(i))) % (E.w + w * 2)) - w; puff(x, 22 + hash(i * 7) * hy * 0.3, w, 16, 'rgba(255,255,255,.9)', 'rgba(210,220,235,.8)'); }
      // 기러기 떼 — 남쪽으로 V 자를 그리며 간다
      const gx0 = ((t * 9) % (E.w + 140)) - 70, gy = hy * 0.3 + Math.sin(t * 0.3) * 6;
      for (let i = -3; i <= 3; i++){ const x = gx0 - Math.abs(i) * 7, y = gy + i * 4.2, f = STILL ? 0.5 : Math.sin(t * 6 + i); gx.strokeStyle = 'rgba(40,40,50,.7)'; gx.lineWidth = 0.8; gx.beginPath(); gx.moveTo(x - 3, y - f * 1.6); gx.lineTo(x, y); gx.lineTo(x + 3, y - f * 1.6); gx.stroke(); }
    }
    // 먼 산 — 푸른 바위산, 꼭대기에 첫눈
    const ridge = (base, amp, f, sd, col, cap) => { gx.beginPath(); gx.moveTo(0, base + 4); for (let x = 0; x <= E.w + 3; x += 3) gx.lineTo(x, base - amp * (0.3 + 0.7 * Math.pow(1 - Math.abs(Math.sin(x * f + sd)), 1.5))); gx.lineTo(E.w, base + 4); gx.closePath(); gx.fillStyle = col; gx.fill();
      // 첫눈 — 봉우리 꼭대기만 덮고 아래 끝은 물결
      if (cap){ gx.save(); gx.clip(); gx.beginPath(); gx.moveTo(0, 0); for (let x = 0; x <= E.w + 3; x += 3) gx.lineTo(x, base - amp * (0.8 - 0.05 * Math.sin(x * 0.4 + sd))); gx.lineTo(E.w + 3, 0); gx.closePath(); gx.fillStyle = cap; gx.fill(); gx.restore(); } };
    ridge(hy - 6, 70, 0.012, 0.8, L.far, E.night ? 'rgba(180,190,220,.4)' : 'rgba(255,255,255,.9)');
    // 단풍 든 언덕 둘 — 언덕을 칠하고 꼭대기를 따라 빨강·주황·노랑·초록 나무 덩이를 촘촘히
    [[hy - 2, 30, 0.017, 2.3, 0], [hy + 3, 18, 0.028, 5.1, 1]].forEach(([base, amp, f, sd, k]) => {
      hill(E, base, amp, f, sd, tone(E, k ? '#8a5a2a' : '#7a5a3a'));
      for (let x = -4; x < E.w + 6; x += k ? 5 : 6.5){
        const y = hillY(x, base, amp, f, sd), c = hash(Math.floor(x) * 3 + k * 99), col = c < 0.18 ? '#3a6a44' : AUTUMN[Math.floor(c * 4)][k ? 1 : 0];
        oval(x, y + 1, k ? 4.6 : 3.8, k ? 4 : 3.2, mix(tone(E, col), L.far, k ? 0.15 : 0.35));
        oval(x + 2, y + 6, k ? 4 : 3.4, 3.4, mix(tone(E, col), '#3a2a20', 0.35));
      }
    });
    R(0, hy - 18, E.w, 21, vgrad(hy - 18, hy + 3, [L.haze + '0)', L.haze + '.35)']));
    // 아래 호수 — 단풍 빛이 물에 비친다
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea));
    for (let i = 0; i < 60; i++){ const x = hash(i * 13 + 2) * E.w, y = hy + 4 + Math.pow(hash(i * 3 + 7), 1.4) * (E.h - hy) * 0.6, w = 6 + hash(i) * 16, c = AUTUMN[i % 4][0];
      R(x, y, w, 1.2, E.night ? 'rgba(120,90,80,.15)' : mix(c, L.sea[0], 0.55)); }
    for (let i = 0; i < 30; i++){ const x = hash(i * 17) * E.w + Math.sin(t * 0.4 + i) * 2, y = hy + 8 + hash(i * 5 + 1) * (E.h - hy); R(x, y, 4 + hash(i) * 8, 0.7, E.night ? 'rgba(200,210,255,.12)' : 'rgba(255,255,255,.4)'); }
    if (E.night){ const x = E.w * 0.8; for (let i = 0; i < 8; i++) R(x - 6 + Math.sin(t + i) * 2, hy + 6 + i * 6, 12 - i, 1, 'rgba(240,240,255,' + (0.4 - i * 0.04).toFixed(2) + ')'); }
  }
  // 섬 땅에 흩어진 것 — 단풍잎(빨강·주황·노랑)과 버섯
  function leafAt(x, y, a, s, c){ const gx = G(); gx.save(); gx.translate(x, y); gx.rotate(a); gx.scale(s, s); gx.beginPath(); for (let i = 0; i < 5; i++){ const an = -Math.PI / 2 + i * TAU / 5, r = i % 2 ? 2.2 : 3; gx.lineTo(Math.cos(an) * r, Math.sin(an) * r * 0.7); gx.lineTo(Math.cos(an + 0.6) * 1.2, Math.sin(an + 0.6) * 0.9); } gx.closePath(); gx.fillStyle = c; gx.fill(); gx.restore(); }
  function mapleIsland(E, paths, busy){
    groundIsland(E, paths, busy, { seed: 11, tuft: '#7a7a34', deco: (u, v, p, d) => {
      if (d < 0.5){ for (let k = 0; k < 3; k++){ const c = AUTUMN[Math.floor(h2(u * 5 + k, v) * 4)][Math.floor(h2(u, v * 3 + k) * 2)]; leafAt(p[0] + (h2(u + k, v) - 0.5) * 16, p[1] + (h2(u, v + k) - 0.5) * 6, h2(u * 7, v + k) * TAU, 0.9, tone(E, c)); } }
      else if (d < 0.53){ oval(p[0], p[1] - 1.6, 2.4, 1.4, tone(E, '#d8402a')); R(p[0] - 0.5, p[1] - 1.4, 1, 1.6, tone(E, '#f4ecd8')); oval(p[0] - 0.8, p[1] - 2, 0.5, 0.4, '#ffffff'); }
    }, after: (pp) => { pp.forEach(k => { const [u, v] = k.split(',').map(Number); if (h2(u, v + 31) < 0.45){ const p = q(u + h2(u, v) * 0.8 + 0.1, v + 0.5, 0); leafAt(p[0], p[1], h2(v, u) * 6, 0.8, tone(E, AUTUMN[(u + v) % 4][1])); } }); } });
  }
  function mapleTree(E, x, y, s, sd){ const c = AUTUMN[Math.floor(hash(sd * 3 + 5) * 4)]; roundTree(E, x, y, s * 0.62, sd, c); }
  function birch(E, x, y, s, sd){ roundTree(E, x, y, s * 0.55, sd, AUTUMN[2], { trunk: '#f0ece0', birch: true, blobs: [[-8, -46, 10], [7, -48, 10], [0, -60, 11], [-3, -40, 9], [9, -38, 8]] }); }
  function sumac(E, x, y, ready, sd){
    const L = look(E), Bs = [[-6, -6, 8], [5, -7, 8], [0, -11, 8]];
    oval(x + 2, y + 1, 14, 4.5, L.shadow);
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2] + 0.8, b[2] * 0.85 + 0.8, INK));
    Bs.forEach((b, i) => oval(x + b[0], y + b[1], b[2], b[2] * 0.85, tone(E, i % 2 ? '#c8401a' : '#e06a2a')));
    [[-8, -9, 4], [3, -11, 4], [-2, -15, 4]].forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.5, tone(E, '#f8a050')));
    if (ready) for (let i = 0; i < 7; i++){ const bx = x - 9 + hash(sd * 7 + i) * 18, by = y - 3 - hash(sd * 3 + i) * 8; oval(bx, by, 1.5, 1.6, tone(E, '#4a3aa0')); oval(bx - 0.4, by - 0.5, 0.5, 0.5, 'rgba(255,255,255,.7)'); }   // 블루베리
  }
  function leafHeap(E, x, y, ready){
    oval(x + 2, y + 1, 13, 4, look(E).shadow);
    if (!ready){ for (let k = 0; k < 6; k++) leafAt(x - 6 + k * 2.4, y - 1 + (k % 2), k, 0.8, tone(E, AUTUMN[k % 4][1])); return; }
    oval(x, y - 3, 11, 5.6, tone(E, '#c8601e')); oval(x - 1, y - 5, 8, 3.6, tone(E, '#e8802a'));
    for (let k = 0; k < 18; k++) leafAt(x - 9 + hash(k * 3) * 18, y - 1 - hash(k * 7) * 8, hash(k) * 6, 0.85, tone(E, AUTUMN[k % 4][k % 2]));
  }
  function mapleNode(E, kind, x, y, ready, seed){
    if (kind === 'tree'){ if (!ready) return freshStump(E, x, y); const h = hash(seed * 7 + 1); return h < 0.55 ? mapleTree(E, x, y, 0.95 + hash(seed) * 0.25, seed) : h < 0.75 ? birch(E, x, y, 1 + hash(seed) * 0.2, seed) : K.fir(E, x, y, 0.95 + hash(seed) * 0.2, seed); }
    if (kind === 'rock'){ K.rock(E, x, y, 0.85, !ready); if (ready){ oval(x - 5, y - 11, 4, 1.4, tone(E, '#6a8a44')); oval(x - 1, y - 12, 2.4, 1, tone(E, '#8aaa5a')); leafAt(x + 4, y - 9, 1, 0.9, tone(E, '#e8502a')); } return; }
    if (kind === 'snow') return leafHeap(E, x, y, ready);
    return sumac(E, x, y, ready, seed);
  }
  // 떨어지는 단풍잎 — 흔들리며 내려온다
  const LEAVES = Array.from({ length: 22 }, (_, i) => ({ x: hash(i * 3 + 1), y: hash(i * 7 + 2), s: 0.6 + hash(i * 5) * 0.6, ph: hash(i * 11) * 6, c: AUTUMN[i % 4][i % 2] }));
  function mapleWeather(E){
    if (STILL) return;
    LEAVES.forEach(f => { const x = ((f.x * E.w + Math.sin(E.t * 0.8 + f.ph) * 14 + E.t * 6 * f.s) % E.w + E.w) % E.w, y = ((f.y * E.h + E.t * 9 * f.s) % E.h + E.h) % E.h; leafAt(x, y, E.t * 1.5 * f.s + f.ph, 0.9 + f.s * 0.5, tone(E, f.c)); });
  }
  // 메이플 시럽 양동이 — 낮에 단풍나무 아래 놓인 양철 양동이, 호박빛 시럽이 반짝
  function syrupPail(E, x, y, t){
    oval(x + 1, y + 0.6, 6.5, 2, 'rgba(40,30,10,.3)');
    const gx = G(); gx.beginPath(); gx.moveTo(x - 4.6, y - 8); gx.lineTo(x + 4.6, y - 8); gx.lineTo(x + 3.8, y); gx.lineTo(x - 3.8, y); gx.closePath(); gx.fillStyle = lin(x - 5, 0, x + 5, 0, ['#e8eef4', '#b8c2cc', '#7a8490']); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.5; gx.stroke();
    line([x - 4.4, y - 5], [x + 4.3, y - 5], 'rgba(60,70,80,.4)', 0.5);
    oval(x, y - 8, 4.6, 1.5, '#5a3a14'); oval(x, y - 8.1, 4, 1.1, '#c8781e'); oval(x - 1.2, y - 8.4, 1.4, 0.4, 'rgba(255,230,160,.8)');
    gx.strokeStyle = '#6a7480'; gx.lineWidth = 0.6; gx.beginPath(); gx.arc(x, y - 8, 4.4, Math.PI * 1.05, Math.PI * 1.95); gx.stroke();
    leafAt(x + 3.6, y - 1.4, 0.4, 1.1, '#e8402a');
    const s = Math.pow(Math.max(0, Math.sin(t * 2.2 + x * 0.3)), 3) * 2.6;
    if (s > 0.3){ gx.fillStyle = 'rgba(255,250,220,.95)'; gx.beginPath(); gx.moveTo(x - 1, y - 12 - s); gx.lineTo(x - 0.6, y - 12); gx.lineTo(x - 1, y - 12 + s); gx.lineTo(x - 1.4, y - 12); gx.closePath(); gx.fill(); }
  }
  // 바닥 — 호수 같은 연못(떠 있는 단풍잎·갈대), 목장(마른 풀)
  const mapleFloor = {
    pond: (E, b) => {
      const cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), r1 = q(b.x + b.w - 0.2, cv, 0), r2 = q(cu, b.y + b.h - 0.2, 0), gx = G();
      const rx = Math.hypot(r1[0] - c[0], r1[1] - c[1]) * 0.98, ry = Math.abs(r2[1] - c[1]) + rx * 0.2;
      gx.save(); gx.translate(c[0], c[1]);
      oval(0, 1.4, rx + 4, ry + 3, tone(E, '#7a6a4a')); oval(0, 0, rx + 2, ry + 1.6, tone(E, '#a8a060'));
      oval(0, 0.5, rx, ry, lin(-rx, -ry, rx, ry, E.night ? ['#2a4a7a', '#163058'] : ['#7ab8e0', '#3a78a8']));
      oval(0, -ry * 0.2, rx * 0.8, ry * 0.5, E.night ? 'rgba(160,190,255,.12)' : 'rgba(255,255,255,.2)');
      for (let i = 0; i < 7; i++){ const a = hash(i * 3 + b.x) * TAU, rr = 0.2 + hash(i * 7) * 0.6, x = Math.cos(a) * rx * rr + Math.sin(E.t * 0.3 + i) * 1.2, y = Math.sin(a) * ry * rr; leafAt(x, y, a + E.t * 0.1, 1, tone(E, AUTUMN[i % 4][1])); }
      [[-rx * 0.95, 0], [rx * 0.85, ry * 0.3]].forEach(([x, y]) => { for (let k = 0; k < 5; k++){ const a = -Math.PI / 2 + (k - 2) * 0.2; curve([[x + k, y], [x + k + Math.cos(a) * 5, y + Math.sin(a) * 8], [x + k + Math.cos(a) * 8, y + Math.sin(a) * 14]], tone(E, '#8a7a3a'), 0.9); } oval(x + 2, y - 13, 1, 3, tone(E, '#6a4a2a')); });
      gx.restore();
    },
    pasture: (E, b) => {
      K.poly3([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + b.h - 0.1, 0], [b.x + 0.1, b.y + b.h - 0.1, 0]], E.night ? 'rgba(0,10,20,.18)' : 'rgba(120,90,30,.12)');
      for (let i = 0; i < 20; i++){ const p = q(b.x + 0.3 + hash(i * 3 + b.x) * (b.w - 0.6), b.y + 0.3 + hash(i * 7 + b.y) * (b.h - 0.6), 0); leafAt(p[0], p[1], i, 0.8, tone(E, AUTUMN[i % 4][1])); }
    },
  };
  // 캐나다 깃발 — 빨강·흰·빨강, 가운데 단풍잎
  function mapleFlag(E, b){ flagCloth(E, b, (at, W2) => {
    const gx = G(); [[0, 0.25, '#d8202a'], [0.25, 0.75, '#ffffff'], [0.75, 1, '#d8202a']].forEach(([f0, f1, c]) => { const pts = []; for (let i = 0; i <= 4; i++) pts.push(at(f0 + (f1 - f0) * i / 4, 0)); for (let i = 4; i >= 0; i--) pts.push(at(f0 + (f1 - f0) * i / 4, 1)); poly(pts, tone(E, c)); });
    const c = at(0.5, 0.5); leafAt(c[0], c[1] + 0.3, 0, 1.25, tone(E, '#d8202a'));
    gx.strokeStyle = INK; gx.lineWidth = 0.5; const o = []; for (let i = 0; i <= 8; i++) o.push(at(i / 8, 0)); for (let i = 8; i >= 0; i--) o.push(at(i / 8, 1)); poly(o, null, 0.5);
  }); }
  // 깃발 천 공통 — 깃대 위에서 바람에 펄럭인다. draw(at(f 가로 0~1, k 세로 0~1), W)
  function flagCloth(E, b, draw){
    const p = q(b.x + 0.5, b.y + 0.6, 0), x = p[0] + 0.6, y = p[1] - 43, t = STILL ? 0 : E.t, W2 = 17, H2 = 11;
    const at = (f, k) => [x + W2 * f, y + H2 * k + Math.sin(t * 4 - f * 5) * 1.4 * f];
    K.upright([x, y], 'u', () => draw(at, W2));
  }

  // ---------- 단풍 꾸미개 ----------
  const W = {};
  // 시럽 오두막 — 통나무 오두막, 빨간 양철 지붕, 김 나는 굴뚝, 앞에 시럽 통과 양동이 줄
  W.sugarshack = (E, b, night) => {
    const G2 = geo(b, 0.3, 20), lenL = G2.u1 - G2.u0;
    footBox(E, G2);
    K.logWalls(E, G2, '#9a6a44');
    K.door(E, G2, 'L', lenL / 2 - 0.25, 0.5, 14, '#6a4430');
    const lw = faceAt(G2, 'R', (G2.v1 - G2.v0) / 2, 9); R(lw[0] - 2.6, lw[1] - 5, 5.2, 5, night ? look(E).win : tone(E, '#4a6a8a'));
    if (night) E.lamp(lw[0], lw[1] - 2.5, 22, '#ffcf7a');
    roof(E, G2, { ridge: 'u', rise: 12, col: '#b8402a', gable: '#9a6a44', eave: 0.3, snow: false, mid: (vm) => {
      const cu = G2.u0 + lenL * 0.7; box(cu - 0.18, vm - 0.18, cu + 0.18, vm + 0.18, G2.H + 4, G2.H + 22, tone(E, '#7d8494'));
      const tp = q(cu, vm, G2.H + 22); E.chimney(tp[0], tp[1] - 4);
    } });
    for (let i = 1; i < 6; i++) line(q(G2.u0 - 0.3 + i * (lenL + 0.6) / 6, G2.v1 + 0.3, G2.H - 1), q(G2.u0 - 0.3 + i * (lenL + 0.6) / 6, (G2.v0 + G2.v1) / 2, G2.H + 12), 'rgba(255,220,200,.25)', 0.5);   // 양철 골
    // 시럽 통과 양동이
    const bp = q(G2.u1 + 0.25, G2.v1 + 0.15, 0); ovI(bp[0], bp[1] - 5, 4, 5.4, tone(E, '#a87040')); [-2.6, 0, 2.6].forEach(dy => line([bp[0] - 4, bp[1] - 5 + dy], [bp[0] + 4, bp[1] - 5 + dy], tone(E, '#5a5a62'), 0.7));
    [0.2, 0.8, 1.4].forEach((a, i) => { const p = q(G2.u0 + a, G2.v1 + 0.45, 0); poly([[p[0] - 2.2, p[1] - 5], [p[0] + 2.2, p[1] - 5], [p[0] + 1.8, p[1]], [p[0] - 1.8, p[1]]], tone(E, i % 2 ? '#c8d0d8' : '#b0b8c4'), true); oval(p[0], p[1] - 5, 2.2, 0.7, tone(E, '#c8781e')); });
  };
  W.sugarshackLive = (E, b) => {   // 굴뚝 김 — 달콤한 시럽 냄새
    if (STILL) return; const G2 = geo(b, 0.3, 20), cu = G2.u0 + (G2.u1 - G2.u0) * 0.7, tp = q(cu, (G2.v0 + G2.v1) / 2, G2.H + 22);
    for (let i = 0; i < 5; i++){ const k = (E.t * 0.3 + i / 5) % 1; oval(tp[0] + Math.sin(k * 5 + i) * 3 + k * 6, tp[1] - 4 - k * 30, 2.6 + k * 5, 2 + k * 3.4, 'rgba(250,245,240,' + (0.55 * (1 - k)).toFixed(2) + ')'); }
  };
  // 빨간 카누 — 나무 받침 둘 위에 엎어 둔 카누, 노 하나 기대 놓음
  W.canoe = (E, b) => {
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, vc = b.y + 0.5, gx = G();
    foot(E, (u0 + u1) / 2, vc, 0.9, 0.3);
    [u0 + 0.35, u1 - 0.35].forEach(u => { box(u - 0.06, vc - 0.3, u + 0.06, vc + 0.3, 0, 6, tone(E, '#8a6040')); });
    const top = [], bot = [];
    for (let i = 0; i <= 20; i++){ const f = i / 20, u = lerp(u0, u1, f), w = 0.28 * Math.sin(f * Math.PI), z = 6 + 3 * Math.sin(f * Math.PI) + 3 * Math.pow(Math.abs(f - 0.5) * 2, 4); top.push(q(u, vc, z + 1.5)); bot.push(q(u, vc + w, z - 2)); }
    poly(top.concat(bot.slice().reverse()), lin(top[0][0], top[0][1] - 6, top[0][0], top[0][1] + 4, [tone(E, '#e8483a'), tone(E, '#a82a20')]), true);
    gx.strokeStyle = 'rgba(255,230,210,.5)'; gx.lineWidth = 0.6; gx.beginPath(); top.forEach((p, i) => i ? gx.lineTo(p[0], p[1] + 1) : gx.moveTo(p[0], p[1] + 1)); gx.stroke();
    const pa = q(u1 - 0.3, vc + 0.35, 0), pb = q(u1 - 0.1, vc + 0.25, 13); line(pa, pb, INK, 1.8); line(pa, pb, tone(E, '#c8a070'), 1); ovI(pa[0], pa[1] - 2, 1.4, 3, tone(E, '#c8a070'));
  };
  // 낙엽 더미 — 갈퀴를 기대 둔 폭신한 더미
  W.leafpile = (E, b) => {
    const c = q(b.x + 0.5, b.y + 0.55, 0), x = c[0], y = c[1];
    foot(E, b.x + 0.5, b.y + 0.55, 0.42, 0.3);
    oval(x, y - 4, 13, 7, tone(E, '#b8501e')); oval(x - 1, y - 7, 10, 5, tone(E, '#e0702a')); oval(x - 2, y - 9.5, 6, 3, tone(E, '#f8a040'));
    for (let k = 0; k < 26; k++) leafAt(x - 11 + hash(k * 3) * 22, y - 1 - hash(k * 7) * 12, hash(k) * 6, 0.9, tone(E, AUTUMN[k % 4][k % 2]));
    line([x + 8, y + 1], [x + 15, y - 20], INK, 1.8); line([x + 8, y + 1], [x + 15, y - 20], tone(E, '#c8a070'), 1);
    for (let i = 0; i < 6; i++) line([x + 5 + i * 1.3, y + 3 - i * 0.4], [x + 6 + i * 1.3, y - 0.4 - i * 0.4], tone(E, '#7a7a80'), 0.6);
  };
  // 호박 등불 — 웃는 얼굴 호박 셋, 밤이면 안에서 촛불
  W.jacklight = (E, b, night) => {
    const c = q(b.x + 0.5, b.y + 0.55, 0), x = c[0], y = c[1];
    foot(E, b.x + 0.5, b.y + 0.55, 0.4, 0.28);
    [[-6, 0, 6.4], [6, 0.6, 5.6], [0, -8, 5.2]].forEach(([dx, dy, r], i) => {
      const px = x + dx, py = y + dy - r * 0.8;
      for (let k = -1; k <= 1; k++) ovI(px + k * r * 0.42, py, r * 0.52, r * 0.82, tone(E, k ? '#e8781e' : '#f89030'));
      R(px - 0.6, py - r * 0.9, 1.2, 2.4, tone(E, '#5a7a3a'));
      const fc = night ? '#ffd860' : tone(E, '#3a2010');
      poly([[px - r * 0.42, py - r * 0.18], [px - r * 0.22, py - r * 0.42], [px - r * 0.04, py - r * 0.18]], fc); poly([[px + r * 0.04, py - r * 0.18], [px + r * 0.24, py - r * 0.42], [px + r * 0.42, py - r * 0.18]], fc);
      const gx = G(); gx.beginPath(); gx.moveTo(px - r * 0.42, py + r * 0.12); gx.quadraticCurveTo(px, py + r * 0.62, px + r * 0.42, py + r * 0.12); gx.quadraticCurveTo(px, py + r * 0.34, px - r * 0.42, py + r * 0.12); gx.fillStyle = fc; gx.fill();
      if (night) E.lamp(px, py, 20, '#ffb040');
    });
  };

  // ================= 밀림 농장 =================
  function jungleBackdrop(E){
    const L = look(E), hy = horizon(E), t = E.t;
    R(0, 0, E.w, hy + 2, vgrad(0, hy, L.sky));
    if (E.night){ stars(E, 90, hy); moon(E, E.w * 0.78, hy * 0.26, 6.5, L.sky[0]); }
    else {
      sun(E, E.w * 0.82, hy * 0.36, 8, 'rgba(255,250,225,');
      for (let i = 0; i < 4; i++){ const w = 90 + hash(i * 5) * 80, x = ((hash(i * 13) * (E.w + w * 2) + t * (1.5 + hash(i))) % (E.w + w * 2)) - w; puff(x, 26 + hash(i * 7) * hy * 0.28, w, 22, 'rgba(255,255,255,.92)', 'rgba(200,220,225,.85)'); }
    }
    // 먼 둥근 산 세 겹 — 겹 사이 안개
    const far = [[hy - 10, 64, 0.011, 0.6, mix(L.far, L.sky[2], 0.45)], [hy - 4, 46, 0.018, 2.4, mix(L.far, L.sky[2], 0.2)], [hy + 2, 28, 0.03, 4.1, L.far2]];
    far.forEach(([base, amp, f, sd, col], i) => {
      hill(E, base, amp, f, sd, col, true);
      if (i === 0){   // 가장 높은 산마루에서 떨어지는 폭포 — 물줄기와 물보라
        let fx = E.w * 0.1; for (let x = E.w * 0.06; x < E.w * 0.4; x += 4) if (hillY(x, base, amp, f, sd, true) < hillY(fx, base, amp, f, sd, true)) fx = x;
        const top = hillY(fx, base, amp, f, sd, true) + 4;
        R(fx - 3, top, 6, base - top + 6, vgrad(top, base + 6, [E.night ? 'rgba(170,200,230,.5)' : 'rgba(255,255,255,.95)', E.night ? 'rgba(120,150,190,.4)' : 'rgba(210,235,245,.85)']));
        for (let k = 0; k < 6; k++){ const yy = top + ((t * 30 + k * 12) % (base - top + 6)); R(fx - 2.4 + (k % 3), yy, 1, 5, 'rgba(255,255,255,.7)'); }
        for (let k = 0; k < 5; k++) oval(fx + (k - 2) * 4, base + 4 + Math.sin(t * 2 + k) * 1, 6, 3, E.night ? 'rgba(160,190,220,.25)' : 'rgba(255,255,255,.55)');
      }
      R(0, base - 10, E.w, 14, vgrad(base - 10, base + 4, [L.haze + '0)', L.haze + (0.3 + i * 0.05).toFixed(2) + ')']));
      // 산마루를 따라 우뚝 솟은 나무 머리
      for (let x = (i * 7) % 11; x < E.w; x += 11 + i * 3){ const y = hillY(x, base, amp, f, sd, true); oval(x, y - 1, 4 + i, 3 + i * 0.6, shade(col, 0.06)); }
    });
    // 아래 — 끝없는 밀림 숲 지붕, 안개가 흘러간다
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea));
    for (let r = 0; r < 14; r++){ const y = hy + 4 + r * r * 1.6, sz = 4 + r * 1.3; for (let x = (r * 13) % (sz * 2); x < E.w + sz; x += sz * 1.3){ const c = hash(Math.floor(x) * 7 + r) < 0.14 ? '#3f8a3a' : hash(Math.floor(x) + r * 31) < 0.5 ? L.floe[0] : L.floe[1]; oval(x, y + Math.sin(x * 0.3) * 1.5, sz, sz * 0.62, tone(E, c)); oval(x - sz * 0.3, y - sz * 0.2, sz * 0.4, sz * 0.24, E.night ? 'rgba(255,255,255,.04)' : 'rgba(255,255,220,.18)'); } }
    for (let i = 0; i < 4; i++){ const y = hy + 16 + i * 26, x = ((t * (4 + i) + hash(i) * E.w) % (E.w + 300)) - 150; oval(x, y, 160, 9, E.night ? 'rgba(120,160,150,.08)' : 'rgba(240,250,245,.32)'); }
    // 금강앵무 둘이 숲 위를 난다
    if (!E.night) for (let i = 0; i < 2; i++){ const x = ((t * (16 + i * 5) + i * 200) % (E.w + 80)) - 40, y = hy - 30 + i * 22 + Math.sin(t * 0.9 + i) * 8, f = STILL ? 0.5 : Math.sin(t * 8 + i); oval(x, y, 3.6, 1.6, i ? '#2a6ae8' : '#e8302a'); poly([[x - 1, y], [x + 1.6, y], [x, y - 4 * f - 0.6]], i ? '#f0c020' : '#2a6ae8'); line([x - 3.4, y], [x - 9, y + 1.6], i ? '#2a6ae8' : '#e8302a', 1.2); }
  }
  // 섬 땅 — 고사리·작은 꽃(헬리코니아·난초)·떨어진 잎
  function fern(x, y, s, c){ const gx = G(); for (let k = 0; k < 5; k++){ const a = -Math.PI / 2 + (k - 2) * 0.55; gx.strokeStyle = c; gx.lineWidth = 0.9; gx.beginPath(); gx.moveTo(x, y); gx.quadraticCurveTo(x + Math.cos(a) * 5 * s, y + Math.sin(a) * 6 * s - 1, x + Math.cos(a) * 9 * s, y + Math.sin(a) * 6 * s + 2); gx.stroke(); for (let j = 1; j < 5; j++){ const f = j / 5, px = x + Math.cos(a) * 9 * s * f, py = y + Math.sin(a) * 6 * s * f - Math.sin(f * Math.PI) * 1.5; line([px, py], [px + 1.2, py - 1.4], c, 0.6); line([px, py], [px - 1.2, py - 1.2], c, 0.6); } } }
  function jungleIsland(E, paths, busy){
    groundIsland(E, paths, busy, { seed: 23, tuft: '#164a1c', tuftN: 0.2, hang: (lc, bc, rc) => jungleVines(E, lc, bc, rc),
      after: (pp, bz) => { for (let u = 0; u < E.cols; u++) [E.rows - 1].forEach(v => { if (!bz(u, v) && !pp.has(u + ',' + v) && h2(u, v * 3) < 0.7){ const p = q(u + 0.5, v + 0.8, 0); fern(p[0], p[1], 1.4, tone(E, '#1a5a22')); monsteraLeaf(E, p[0] + 4, p[1] + 1, h2(u, v)); } });
        for (let v = 0; v < E.rows; v++) if (!bz(E.cols - 1, v) && !pp.has((E.cols - 1) + ',' + v) && h2(v, 7) < 0.7){ const p = q(E.cols - 0.2, v + 0.5, 0); fern(p[0], p[1], 1.4, tone(E, '#1a5a22')); } },
      deco: (u, v, p, d) => {
      if (d < 0.3) fern(p[0], p[1], 0.9 + h2(u, v) * 0.5, tone(E, h2(v, u) < 0.5 ? '#2a7a2e' : '#1a5a22'));
      else if (d < 0.36) monsteraLeaf(E, p[0], p[1], h2(u * 3, v));
      else if (d < 0.42){ const c = h2(u + 9, v) < 0.5 ? '#ff4a7a' : '#ffb020'; line([p[0], p[1]], [p[0], p[1] - 5], tone(E, '#3a7a34'), 0.6); oval(p[0], p[1] - 5.6, 1.6, 1.2, tone(E, c)); oval(p[0] + 1.4, p[1] - 4.4, 1.2, 0.9, tone(E, c)); }
      else if (d < 0.5){ oval(p[0], p[1], 3, 1.2, tone(E, '#5a4a2a')); oval(p[0] + 2, p[1] + 0.6, 2.4, 0.9, tone(E, '#6a5a32')); }
      else if (d < 0.62) fern(p[0], p[1], 0.6, tone(E, '#1e6a26'));
    } });
  }
  // 몬스테라 잎 — 갈라진 큰 잎 하나가 땅에 눕는다
  function monsteraLeaf(E, x, y, k){
    const gx = G(); gx.save(); gx.translate(x, y - 2); gx.rotate(-0.4 + k * 0.8);
    gx.beginPath(); gx.ellipse(0, -3, 5.4, 4, 0, 0, TAU); gx.fillStyle = tone(E, '#1e6a2a'); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.5; gx.stroke();
    gx.strokeStyle = tone(E, '#4a9a40'); gx.lineWidth = 0.5; gx.beginPath(); gx.moveTo(0, 1); gx.lineTo(0, -6.6); gx.stroke();
    gx.fillStyle = tone(E, '#2f7a30'); [-1, 1].forEach(sd => { for (let i = 0; i < 3; i++){ gx.beginPath(); gx.moveTo(sd * 1.4, -5 + i * 2); gx.lineTo(sd * 5.6, -6 + i * 2.6); gx.lineTo(sd * 5, -4.6 + i * 2.6); gx.closePath(); gx.fill(); } });
    gx.restore();
  }
  // 섬 옆구리로 늘어진 덩굴과 잎 — 밀림 섬은 벼랑까지 초록이 넘친다
  function jungleVines(E, lc, bc, rc){
    const D2 = E.cliff, gx = G();
    [[lc, bc, 0], [bc, rc, 5]].forEach(([a, b, sd]) => { for (let i = 0; i < 34; i++){ const f = (i + hash(i * 3 + sd)) / 34, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 2, len = 10 + hash(i * 7 + sd) * D2 * 0.55;
      gx.strokeStyle = tone(E, i % 2 ? '#1e5a26' : '#2a6a2e'); gx.lineWidth = 1; gx.beginPath(); gx.moveTo(x, y); gx.quadraticCurveTo(x + Math.sin(i) * 3, y + len * 0.5, x + Math.sin(i * 1.7) * 2, y + len); gx.stroke();
      for (let k = 1; k < 5; k++){ const yy = y + len * k / 5, xx = x + Math.sin(i * 1.7) * 2 * k / 5; oval(xx + (k % 2 ? 1.6 : -1.6), yy, 1.8, 1.1, tone(E, k % 2 ? '#2f7a34' : '#1e6a2a')); } } });
  }
  // 덩굴 나무 — 넓은 잎 지붕, 판자 뿌리, 늘어진 덩굴
  function kapok(E, x, y, s, sd){
    const L = look(E), gx = G(); s *= 0.86;
    oval(x + 6 * s, y + 1, 24 * s, 7 * s, L.shadow);
    const tr = tone(E, '#8a7a5a');
    poly([[x - 4 * s, y], [x + 4 * s, y], [x + 2.6 * s, y - 40 * s], [x - 2.6 * s, y - 40 * s]], tr, true);
    [[-1, 9], [1, 8], [-0.3, 6]].forEach(([d, w]) => poly([[x + d * 2 * s, y - 10 * s], [x + d * w * s, y + 0.5], [x + d * 2 * s, y + 0.5]], tone(E, '#7a6a4a'), true));   // 판자 뿌리
    const Bs = [[-20, -48, 16], [18, -50, 16], [0, -60, 18], [-8, -44, 14], [10, -42, 13], [-24, -38, 10], [24, -38, 10], [-6, -66, 11], [8, -64, 11]];
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s + 0.9, b[2] * s * 0.7 + 0.9, INK));
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s * 0.7, tone(E, '#164a1e')));
    Bs.forEach(b => oval(x + (b[0] - 3) * s, y + (b[1] - 3) * s, b[2] * s * 0.7, b[2] * s * 0.48, tone(E, '#22682a')));
    Bs.forEach(b => oval(x + (b[0] - 6) * s, y + (b[1] - 6) * s, b[2] * s * 0.28, b[2] * s * 0.16, tone(E, '#4a9a3e')));
    for (let i = 0; i < 18; i++){ const lx = x + (hash(sd * 11 + i) - 0.5) * 44 * s, ly = y - (34 + hash(sd * 13 + i) * 28) * s; oval(lx, ly, 2.6 * s, 1.4 * s, tone(E, i % 3 ? '#1e5a26' : '#3a8a34')); }   // 잎 결
    gx.strokeStyle = tone(E, '#2a6a26'); gx.lineWidth = 0.8;   // 늘어진 덩굴
    for (let i = 0; i < 5; i++){ const vx = x + (hash(sd * 5 + i) - 0.5) * 34 * s, vy = y - 40 * s, len = (14 + hash(sd + i * 3) * 14) * s; gx.beginPath(); gx.moveTo(vx, vy); gx.quadraticCurveTo(vx + 2, vy + len * 0.5, vx - 1, vy + len); gx.stroke(); oval(vx - 1, vy + len, 1.4, 1, tone(E, '#4aa048')); }
    if (hash(sd * 9) < 0.5){ const fx = x + (hash(sd * 13) - 0.5) * 20 * s, fy = y - 44 * s; oval(fx, fy, 2, 1.6, tone(E, '#ff4a8a')); oval(fx + 1.6, fy + 0.6, 1.6, 1.2, tone(E, '#ff7aa8')); }   // 난초
  }
  // 코코야자 — 휜 줄기, 깃털 잎, 코코넛
  function coconutPalm(E, x, y, s, sd){
    const L = look(E), gx = G(); s *= 0.9;
    oval(x + 8, y + 1.5, 16 * s, 5 * s, L.shadow);
    const lean = (hash(sd) < 0.5 ? -1 : 1) * (10 + hash(sd * 3) * 12) * s, H2 = 64 * s, top = [x + lean, y - H2];
    for (let i = 0; i < 14; i++){ const f = i / 14, f2 = (i + 1) / 14, cx = x + lean * Math.pow(f, 1.6), cy = y - H2 * f, cx2 = x + lean * Math.pow(f2, 1.6), cy2 = y - H2 * f2, w = (3.6 - 1.2 * f) * s;
      poly([[cx - w, cy], [cx + w, cy], [cx2 + w * 0.94, cy2], [cx2 - w * 0.94, cy2]], tone(E, i % 2 ? '#b09070' : '#98785a')); line([cx - w, cy], [cx + w, cy - 0.6], tone(E, '#6a5038'), 0.5); }
    for (let i = 0; i < 8; i++){ const a = -Math.PI / 2 + (i - 3.5) * 0.48, len = (28 + hash(sd + i) * 8) * s, droop = 16 * s * (0.5 + Math.abs(i - 3.5) / 3.5);
      const ex = top[0] + Math.cos(a) * len * 1.25, ey = top[1] + Math.sin(a) * len * 0.45 + droop, mx = top[0] + Math.cos(a) * len * 0.6, my = top[1] + Math.sin(a) * len * 0.45 - 5 * s;
      gx.strokeStyle = tone(E, '#2a6a2a'); gx.lineWidth = 0.9; gx.beginPath(); gx.moveTo(top[0], top[1]); gx.quadraticCurveTo(mx, my, ex, ey); gx.stroke();
      for (let k = 1; k < 10; k++){ const tt = k / 10, px = (1 - tt) * (1 - tt) * top[0] + 2 * tt * (1 - tt) * mx + tt * tt * ex, py = (1 - tt) * (1 - tt) * top[1] + 2 * tt * (1 - tt) * my + tt * tt * ey, l = 5 * s * Math.sin(tt * Math.PI) + 1.2;
        line([px, py], [px + Math.cos(a + 1.3) * l, py + Math.abs(Math.sin(a + 1.3)) * l + 1.2], tone(E, k % 2 ? '#3a8a34' : '#4aa040'), 1.1); line([px, py], [px + Math.cos(a - 1.3) * l, py + Math.abs(Math.sin(a - 1.3)) * l + 1.2], tone(E, k % 2 ? '#2f7a2e' : '#3a8a34'), 1.1); } }
    [[-2, 3], [2, 3.4], [0, 5]].forEach(([dx, dy]) => ovI(top[0] + dx * s, top[1] + dy * s, 2 * s, 2 * s, tone(E, '#6a4a2a')));
  }
  function mossBoulder(E, x, y, ready){
    const L = look(E), s = ready ? 1 : 0.45, c = tone(E, '#7a7a6a');
    oval(x + 2, y + 1.5, 14 * s, 4.5 * s, L.shadow);
    poly([[x - 13 * s, y], [x - 12 * s, y - 9 * s], [x - 4 * s, y - 14 * s], [x + 7 * s, y - 13 * s], [x + 13 * s, y - 5 * s], [x + 12 * s, y]], vgrad(y - 14 * s, y, [shade(c, 0.15), shade(c, -0.25)]), true);
    if (ready){ poly([[x - 12 * s, y - 8 * s], [x - 4 * s, y - 14.4 * s], [x + 7 * s, y - 13.4 * s], [x + 10 * s, y - 9 * s], [x + 2, y - 9], [x - 6, y - 7]], tone(E, '#4a8a3a')); for (let i = 0; i < 6; i++) oval(x - 8 + i * 3, y - 10 - (i % 2) * 2, 2, 1.2, tone(E, '#6ab04a')); fern(x + 10, y, 0.7, tone(E, '#3f8a3a')); }
  }
  function heliconia(E, x, y, ready, sd){
    const L = look(E), gx = G();
    oval(x + 2, y + 1, 14, 4.5, L.shadow);
    for (let i = 0; i < 6; i++){ const a = -Math.PI / 2 + (i - 2.5) * 0.4, l = 14 + hash(sd + i) * 5; gx.save(); gx.translate(x, y); gx.rotate(a + Math.PI / 2); gx.beginPath(); gx.ellipse(0, -l / 2, 3.2, l / 2, 0, 0, TAU); gx.fillStyle = tone(E, i % 2 ? '#3a8a3a' : '#2a7030'); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.5; gx.stroke(); gx.strokeStyle = tone(E, '#6ab04a'); gx.lineWidth = 0.5; gx.beginPath(); gx.moveTo(0, 0); gx.lineTo(0, -l + 1); gx.stroke(); gx.restore(); }
    if (ready) for (let i = 0; i < 3; i++){ const bx = x - 6 + i * 6, by = y - 12 - (i % 2) * 4; for (let k = 0; k < 4; k++) poly([[bx, by + k * 2.4], [bx + (k % 2 ? 3.4 : -3.4), by + k * 2.4 + 1], [bx, by + k * 2.4 + 2]], tone(E, k % 2 ? '#ffc020' : '#e8302a'), 0.4); }
  }
  function coconutPile(E, x, y, ready){
    oval(x + 2, y + 1, 12, 3.6, look(E).shadow);
    const n = ready ? 5 : 2;
    for (let i = 0; i < n; i++){ const px = x - 5 + (i % 3) * 5, py = y - 2 - Math.floor(i / 3) * 4; ovI(px, py, 3, 2.7, tone(E, '#6a4a2a')); oval(px - 1, py - 1, 0.8, 0.6, 'rgba(255,255,255,.3)'); }
    if (ready) fern(x + 8, y, 0.6, tone(E, '#3f8a3a'));
  }
  function jungleNode(E, kind, x, y, ready, seed){
    if (kind === 'tree'){ if (!ready) return freshStump(E, x, y, '#7a6a4a'); return hash(seed * 7 + 1) < 0.7 ? kapok(E, x, y, 0.95 + hash(seed) * 0.25, seed) : coconutPalm(E, x, y, 0.95 + hash(seed) * 0.2, seed); }
    if (kind === 'rock') return mossBoulder(E, x, y, ready);
    if (kind === 'snow') return coconutPile(E, x, y, ready);
    return heliconia(E, x, y, ready, seed);
  }
  /* 밀림 날씨 — 안개, 낮엔 푸른 모르포 나비, 밤엔 반딧불이. 「스콜」 — 이 분(分) 동안 가끔 굵은 소나기가 지나간다 */
  function jungleWeather(E){
    if (STILL) return; const gx = G(), t = E.t;
    for (let i = 0; i < 4; i++){ const y = E.h * (0.3 + i * 0.15), x = ((t * (5 + i * 2) + hash(i) * E.w) % (E.w + 400)) - 200; oval(x, y, 190, 14, E.night ? 'rgba(80,120,110,.07)' : 'rgba(235,248,240,.1)'); }
    if (E.night) for (let i = 0; i < 18; i++){ const p = q(E.cols * hash(i * 3) + Math.sin(t * 0.4 + i) * 1.5, E.rows * hash(i * 7 + 1) + Math.cos(t * 0.3 + i) * 1.2, 10 + Math.sin(t + i) * 5), a = Math.max(0, Math.sin(t * 2 + i * 1.7)); if (a > 0.2){ glow(p[0], p[1], 5, 'rgba(200,255,120,', 0.4 * a); oval(p[0], p[1], 0.8, 0.8, 'rgba(240,255,190,' + a.toFixed(2) + ')'); } }
    else for (let i = 0; i < 3; i++){ const u = E.cols * (0.2 + 0.6 * hash(i * 9)) + Math.sin(t * 0.25 + i * 3) * 5, v = E.rows * (0.3 + 0.4 * hash(i * 5 + 2)) + Math.cos(t * 0.2 + i) * 4, p = q(u, v, 20 + Math.sin(t * 1.6 + i) * 6), f = Math.abs(Math.sin(t * 9 + i)); oval(p[0] - 2 * f, p[1], 2 * f, 1.8, '#2a6ae8'); oval(p[0] + 2 * f, p[1], 2 * f, 1.8, '#3a8aff'); oval(p[0], p[1], 0.5, 1.2, '#1a1a2a'); }
    const ph = (t % 75) / 75;   // 일흔다섯 초에 열 초쯤 소나기
    if (ph < 0.14){ const k = Math.sin(ph / 0.14 * Math.PI), n = Math.round(160 * k);
      R(0, 0, E.w, E.h, 'rgba(60,80,90,' + (0.12 * k).toFixed(2) + ')');
      gx.strokeStyle = E.night ? 'rgba(170,200,220,.35)' : 'rgba(225,240,250,.6)'; gx.lineWidth = 0.7; gx.beginPath();
      for (let i = 0; i < n; i++){ const x = ((hash(i * 3 + 1) * E.w - t * 50) % E.w + E.w) % E.w, y = ((hash(i * 7 + 2) * E.h + t * 300 * (0.7 + hash(i) * 0.6)) % E.h + E.h) % E.h; gx.moveTo(x, y); gx.lineTo(x - 2.6, y + 10); }
      gx.stroke(); }
  }
  // 망고 — 붉게 익은 망고 하나와 잎
  function mangoFruit(E, x, y, t){
    oval(x + 1, y + 0.6, 6, 1.8, 'rgba(30,40,10,.3)');
    const gx = G(); gx.save(); gx.translate(x, y - 4); gx.rotate(-0.4); gx.beginPath(); gx.ellipse(0, 0, 5, 3.6, 0, 0, TAU);
    gx.fillStyle = lin(-5, -3, 5, 3, ['#ffd040', '#ff8a20', '#e8402a']); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.5; gx.stroke(); oval(-1.6, -1.4, 1.6, 0.8, 'rgba(255,255,255,.5)'); gx.restore();
    gx.save(); gx.translate(x + 3, y - 7); gx.rotate(-0.9); gx.beginPath(); gx.ellipse(3, 0, 3.6, 1.3, 0, 0, TAU); gx.fillStyle = '#3a8a3a'; gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.4; gx.stroke(); gx.restore();
    const s = Math.pow(Math.max(0, Math.sin(t * 2.3 + x * 0.3)), 3) * 2.4;
    if (s > 0.3){ gx.fillStyle = 'rgba(255,255,230,.95)'; gx.beginPath(); gx.moveTo(x - 2, y - 10 - s); gx.lineTo(x - 1.6, y - 10); gx.lineTo(x - 2, y - 10 + s); gx.lineTo(x - 2.4, y - 10); gx.closePath(); gx.fill(); }
  }
  const jungleFloor = {
    pond: (E, b) => {   // 수련이 뜬 청록 늪
      const cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), r1 = q(b.x + b.w - 0.2, cv, 0), r2 = q(cu, b.y + b.h - 0.2, 0), gx = G();
      const rx = Math.hypot(r1[0] - c[0], r1[1] - c[1]) * 0.98, ry = Math.abs(r2[1] - c[1]) + rx * 0.2;
      gx.save(); gx.translate(c[0], c[1]);
      oval(0, 1.4, rx + 4, ry + 3, tone(E, '#5a4a2a')); oval(0, 0, rx + 2, ry + 1.6, tone(E, '#4a8a3a'));
      oval(0, 0.5, rx, ry, lin(-rx, -ry, rx, ry, E.night ? ['#1a4a4a', '#0e3030'] : ['#4ab8a8', '#1a7a7a']));
      oval(0, -ry * 0.2, rx * 0.8, ry * 0.5, E.night ? 'rgba(160,220,200,.1)' : 'rgba(255,255,255,.18)');
      [[-0.4, 0.2, 5], [0.38, -0.2, 6], [0.1, 0.42, 4.4], [-0.1, -0.35, 3.6]].forEach(([fx, fy, r], i) => { const x = fx * rx, y = fy * ry; ovI(x, y, r, r * 0.45, tone(E, '#3a9a4a')); poly([[x, y], [x + r, y - 0.6], [x + r, y + 0.6]], E.night ? '#164040' : '#2a9a9a'); if (i < 2) { oval(x - 1, y - 2, 1.8, 1.4, tone(E, i ? '#ff8ab8' : '#ffffff')); oval(x - 1, y - 2.4, 0.8, 0.6, tone(E, '#ffe060')); } });
      gx.restore();
    },
    pasture: (E, b) => {
      K.poly3([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + b.h - 0.1, 0], [b.x + 0.1, b.y + b.h - 0.1, 0]], E.night ? 'rgba(0,20,10,.18)' : 'rgba(40,90,20,.14)');
      for (let i = 0; i < 12; i++){ const p = q(b.x + 0.3 + hash(i * 3 + b.x) * (b.w - 0.6), b.y + 0.3 + hash(i * 7 + b.y) * (b.h - 0.6), 0); fern(p[0], p[1], 0.5, tone(E, '#3a8a34')); }
    },
  };
  // 브라질 깃발 — 초록 바탕, 노란 마름모, 파란 동그라미
  function jungleFlag(E, b){ flagCloth(E, b, (at) => {
    const o = []; for (let i = 0; i <= 8; i++) o.push(at(i / 8, 0)); for (let i = 8; i >= 0; i--) o.push(at(i / 8, 1));
    poly(o, tone(E, '#1a9a4a'), 0.5);
    poly([at(0.08, 0.5), at(0.5, 0.1), at(0.92, 0.5), at(0.5, 0.9)], tone(E, '#ffd020'));
    const c = at(0.5, 0.5); oval(c[0], c[1], 3, 3, tone(E, '#1a3a9a')); line([c[0] - 2.8, c[1] - 0.4], [c[0] + 2.8, c[1] + 0.6], '#ffffff', 0.6);
  }); }
  // ---------- 밀림 집·가게 ----------
  // 초가 지붕(사방으로 비탈) — 야자잎·짚을 엮은 두툼한 지붕, 처마 끝이 들쭉날쭉
  function thatchHip(E, G2, o){
    const e = o.eave || 0.45, H2 = G2.H, Hr = H2 + o.rise, r = o.ridge == null ? 0.3 : o.ridge, col = tone(E, o.col || '#c8a050'), gx = G();
    const u0 = G2.u0 - e, u1 = G2.u1 + e, v0 = G2.v0 - e, v1 = G2.v1 + e, vm = (G2.v0 + G2.v1) / 2, ua = G2.u0 + (G2.u1 - G2.u0) * r, ub = G2.u1 - (G2.u1 - G2.u0) * r;
    const a = q(u0, v0, H2 - 2), b = q(u1, v0, H2 - 2), c = q(u1, v1, H2 - 2), d = q(u0, v1, H2 - 2), ra = q(ua, vm, Hr), rb = q(ub, vm, Hr);
    poly([a, b, rb, ra], shade(col, -0.36), true);                              // 뒤
    poly([b, c, rb], lin(b[0], b[1], c[0], c[1], [shade(col, -0.24), shade(col, -0.34)]), true);   // 오른쪽
    poly([d, c, rb, ra], vgrad(ra[1], d[1], [shade(col, 0.12), shade(col, -0.1)]), true);          // 앞
    gx.strokeStyle = 'rgba(90,60,20,.38)'; gx.lineWidth = 0.55; gx.beginPath();
    for (let k = 1; k < 16; k++){ const f = k / 16, top = [ra[0] + (rb[0] - ra[0]) * f, ra[1] + (rb[1] - ra[1]) * f], bot = [d[0] + (c[0] - d[0]) * f, d[1] + (c[1] - d[1]) * f]; gx.moveTo(top[0], top[1]); gx.lineTo(bot[0], bot[1] + 1); }
    for (let k = 1; k < 6; k++){ const f = k / 6, p1 = [rb[0] + (b[0] - rb[0]) * f, rb[1] + (b[1] - rb[1]) * f], p2 = [rb[0] + (c[0] - rb[0]) * f, rb[1] + (c[1] - rb[1]) * f]; gx.moveTo(p1[0], p1[1]); gx.lineTo(p2[0], p2[1]); }
    gx.stroke();
    gx.fillStyle = shade(col, -0.06); gx.beginPath(); gx.moveTo(d[0], d[1]); for (let i = 0; i <= 24; i++){ const f = i / 24, x = d[0] + (c[0] - d[0]) * f, y = d[1] + (c[1] - d[1]) * f; gx.lineTo(x, y + (i % 2 ? 2 : 4 + hash(i * 3 + G2.u0) * 2)); } for (let i = 0; i <= 10; i++){ const f = i / 10, x = c[0] + (b[0] - c[0]) * f, y = c[1] + (b[1] - c[1]) * f; gx.lineTo(x, y + (i % 2 ? 2 : 4)); } gx.lineTo(b[0], b[1]); gx.lineTo(c[0], c[1]); gx.lineTo(d[0], d[1]); gx.closePath(); gx.fill();
    line(ra, rb, tone(E, shade(o.col || '#c8a050', -0.4)), 2.2);
  }
  // 기둥 위 대나무 집 — 여섯 기둥 받침, 대나무 벽, 엮은 덧문, 앞 계단과 난간, 초가 지붕
  W.jungleHouse = (E, b, night) => {
    const G2 = geo(b, 0.3, 0), lenL = G2.u1 - G2.u0, lenR = G2.v1 - G2.v0, Z0 = 10;
    footBox(E, G2);
    [[G2.u0 + 0.1, G2.v0 + 0.1], [G2.u1 - 0.1, G2.v0 + 0.1], [G2.u0 + 0.1, G2.v1 - 0.1], [G2.u1 - 0.1, G2.v1 - 0.1], [(G2.u0 + G2.u1) / 2, G2.v1 - 0.1], [G2.u1 - 0.1, (G2.v0 + G2.v1) / 2]].forEach(([u, v]) => post(E, u, v, 0, Z0, '#7a5a3a', 1.2));
    box(G2.u0 - 0.1, G2.v0 - 0.1, G2.u1 + 0.1, G2.v1 + 0.45, Z0 - 2, Z0, tone(E, '#a07a4a'), { top: tone(E, '#c09a62') });   // 마루(앞 툇마루)
    const wall = '#d8c08a';
    // 벽 — 대나무 세로 살
    const Zb = Z0, Zt = Z0 + 22;
    K.poly3([[G2.u0, G2.v1, Zb], [G2.u1, G2.v1, Zb], [G2.u1, G2.v1, Zt], [G2.u0, G2.v1, Zt]], vgrad(q(G2.u0, G2.v1, Zt)[1], q(G2.u0, G2.v1, Zb)[1], [tone(E, shade(wall, 0.08)), tone(E, shade(wall, -0.08))]), true);
    K.poly3([[G2.u1, G2.v1, Zb], [G2.u1, G2.v0, Zb], [G2.u1, G2.v0, Zt], [G2.u1, G2.v1, Zt]], tone(E, shade(wall, -0.24)), true);
    for (let a = 0.12; a < lenL; a += 0.16) line(q(G2.u0 + a, G2.v1, Zb + 0.5), q(G2.u0 + a, G2.v1, Zt - 0.5), 'rgba(120,90,40,.35)', 0.5);
    for (let a = 0.12; a < lenR; a += 0.16) line(q(G2.u1, G2.v1 - a, Zb + 0.5), q(G2.u1, G2.v1 - a, Zt - 0.5), 'rgba(80,60,20,.35)', 0.5);
    [Zb + 7, Zb + 15].forEach(z => { line(q(G2.u0, G2.v1, z), q(G2.u1, G2.v1, z), tone(E, '#8a6a3a'), 1); line(q(G2.u1, G2.v1, z), q(G2.u1, G2.v0, z), tone(E, '#6a4a2a'), 1); });
    // 문과 창(엮은 덧문을 밀어 올렸다)
    const dA = lenL / 2 - 0.3; onFace(G2, 'L', dA, dA + 0.6, Zb, Zb + 15, night ? '#ffcf7a' : tone(E, '#3a2a1a'), true);
    if (night){ const c = faceAt(G2, 'L', dA + 0.3, Zb + 8); E.lamp(c[0], c[1], 32, '#ffcf7a'); }
    [[0.35, 'L'], [lenL - 0.95, 'L'], [lenR / 2 - 0.3, 'R']].forEach(([a, sd]) => { onFace(G2, sd, a, a + 0.6, Zb + 8, Zb + 15, night ? '#ffd98a' : tone(E, '#2a2014'), true); onFace(G2, sd, a - 0.05, a + 0.65, Zb + 15, Zb + 17.5, tone(E, '#b08a4a'), true); if (night){ const c = faceAt(G2, sd, a + 0.3, Zb + 11); E.lamp(c[0], c[1], 20, '#ffcf7a'); } });
    // 앞 계단과 난간
    for (let i = 0; i < 4; i++){ const v = G2.v1 + 0.45 + i * 0.22, z = Z0 - 2 - i * 2.4; box(G2.u0 + dA - 0.05, v, G2.u0 + dA + 0.65, v + 0.22, Math.max(0, z - 1.4), z, tone(E, '#b08a5a')); }
    [G2.u0 + 0.05, G2.u1 - 0.05].forEach(u => post(E, u, G2.v1 + 0.4, Z0, Z0 + 7, '#8a6a3a', 0.6));
    line(q(G2.u0 + 0.05, G2.v1 + 0.4, Z0 + 7), q(G2.u0 + dA - 0.1, G2.v1 + 0.4, Z0 + 7), tone(E, '#8a6a3a'), 1);
    line(q(G2.u0 + dA + 0.7, G2.v1 + 0.4, Z0 + 7), q(G2.u1 - 0.05, G2.v1 + 0.4, Z0 + 7), tone(E, '#8a6a3a'), 1);
    thatchHip(E, { u0: G2.u0, v0: G2.v0, u1: G2.u1, v1: G2.v1, H: Zt }, { rise: 22, col: '#c8a050', eave: 0.5 });
    const cp = q(G2.u0 + lenL * 0.3, (G2.v0 + G2.v1) / 2, Zt + 16); E.chimney(cp[0], cp[1]);
    // 화분 — 몬스테라
    const pp = q(G2.u1 + 0.35, G2.v1 + 0.35, 0); ovI(pp[0], pp[1] - 3, 3.4, 3.6, tone(E, '#b8602e')); for (let i = 0; i < 5; i++){ const a = -Math.PI / 2 + (i - 2) * 0.55; ovI(pp[0] + Math.cos(a) * 6, pp[1] - 7 + Math.sin(a) * 4, 3.2, 2.2, tone(E, '#2a8a3a')); }
  };
  // 과일 노점 — 야자잎 차양, 바나나 송이·망고·파인애플 더미(part 'back' | 'front', 사이에 가게 아저씨)
  W.jungleStall = (E, b, night, part) => {
    const G2 = geo(b, 0.15, 0), u0 = G2.u0, u1 = G2.u1, v0 = G2.v0, v1 = G2.v1;
    if (part !== 'front'){
      footBox(E, G2);
      box(u0, v0, u1, v0 + 0.25, 0, 30, tone(E, '#9a7a4a'), { top: false });
      for (let a = 0.1; a < u1 - u0; a += 0.16) line(q(u0 + a, v0 + 0.25, 0.5), q(u0 + a, v0 + 0.25, 29.5), 'rgba(90,60,20,.35)', 0.5);
      for (let z = 10; z < 28; z += 9) box(u0 + 0.05, v0 + 0.25, u1 - 0.05, v0 + 0.55, z, z + 1.5, tone(E, '#6a4a2a'));
      for (let i = 0; i < 5; i++){ const p = q(u0 + 0.3 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 11.5); for (let k = 0; k < 4; k++) curve([[p[0] - 3 + k * 1.4, p[1] - 4], [p[0] - 2 + k * 1.4, p[1] - 1], [p[0] + k * 1.4, p[1] - 0.6]], tone(E, '#f0c830'), 1.4); const p2 = q(u0 + 0.45 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 20.5); ovI(p2[0], p2[1] - 2, 2.2, 2.6, tone(E, i % 2 ? '#e8a020' : '#d8602a')); }
      post(E, u0 + 0.05, v0 + 0.1, 0, 78, '#7a5a3a'); post(E, u1 - 0.05, v0 + 0.1, 0, 78, '#7a5a3a');
      return;
    }
    post(E, u0 + 0.05, v1 - 0.1, 0, 71, '#7a5a3a'); post(E, u1 - 0.05, v1 - 0.1, 0, 71, '#7a5a3a');
    box(u0 + 0.1, v1 - 0.55, u1 - 0.1, v1 - 0.1, 0, 12, tone(E, '#b08a5a'));
    for (let a = 0.1; a < u1 - u0 - 0.2; a += 0.14) line(q(u0 + 0.1 + a, v1 - 0.1, 0.5), q(u0 + 0.1 + a, v1 - 0.1, 11.5), 'rgba(90,60,20,.35)', 0.5);
    // 과일 더미 — 망고·파인애플·바나나
    [[0.3, 'm'], [0.8, 'p'], [1.3, 'b'], [1.8, 'm']].forEach(([a, k]) => {
      if (u0 + a > u1 - 0.3) return; const p = q(u0 + a + 0.15, v1 - 0.33, 12);
      if (k === 'm') for (let i = 0; i < 5; i++) ovI(p[0] - 3 + (i % 3) * 3, p[1] - 1 - Math.floor(i / 3) * 2.6, 1.8, 1.4, tone(E, i % 2 ? '#ff8a20' : '#e8402a'));
      else if (k === 'p'){ ovI(p[0], p[1] - 3, 2.6, 3.6, tone(E, '#d8a030')); for (let j = 0; j < 4; j++) line([p[0] - 1.6 + j, p[1] - 6.4], [p[0] - 2.4 + j * 1.6, p[1] - 10], tone(E, '#3a8a3a'), 0.9); }
      else for (let i = 0; i < 4; i++) curve([[p[0] - 3 + i * 1.6, p[1] - 4], [p[0] - 2 + i * 1.6, p[1] - 1], [p[0] + i * 1.6, p[1] - 0.6]], tone(E, '#f0c830'), 1.6);
    });
    // 차양 — 야자잎을 엮어 덮은 비탈
    const zt = 79, va = v0 - 0.05, vb = v1 + 0.3, zb = 72, col = tone(E, '#9aa048');
    K.poly3([[u0 - 0.2, va, zt], [u1 + 0.2, va, zt], [u1 + 0.2, vb, zb], [u0 - 0.2, vb, zb]], vgrad(q(u0, va, zt)[1], q(u0, vb, zb)[1], [shade(col, 0.1), shade(col, -0.12)]), true);
    for (let i = 0; i < 14; i++){ const a = u0 - 0.2 + (u1 - u0 + 0.4) * (i + 0.5) / 14, p0 = q(a, va, zt), p1 = q(a, vb, zb); line(p0, [p1[0], p1[1] + 3 + (i % 2) * 2], tone(E, i % 2 ? '#7a8a34' : '#b0b858'), 1.2); }
    if (night){ const p = q((u0 + u1) / 2, vb, zb - 2); oval(p[0], p[1] + 3, 1.6, 2, '#ffe7a4'); E.lamp(p[0], p[1] + 3, 34, '#ffcf7a'); }
  };
  // ---------- 밀림 꾸미개 ----------
  // 나무 위 오두막 — 굵은 나무 기둥 위 마루와 초가 오두막, 줄사다리
  W.treehouse = (E, b, night) => {
    const cu = b.x + b.w / 2, cv = b.y + b.h / 2, base = q(cu, cv, 0);
    foot(E, cu, cv, 0.9, 0.6);
    poly([[base[0] - 6, base[1]], [base[0] + 6, base[1]], [base[0] + 4, base[1] - 40], [base[0] - 4, base[1] - 40]], tone(E, '#8a6a4a'), true);
    [[-1, 10], [1, 9]].forEach(([d, w]) => poly([[base[0] + d * 3, base[1] - 10], [base[0] + d * w, base[1] + 0.5], [base[0] + d * 3, base[1] + 0.5]], tone(E, '#7a5a3a'), true));
    const Gp = { u0: cu - 0.8, v0: cv - 0.7, u1: cu + 0.8, v1: cv + 0.7 };
    box(Gp.u0, Gp.v0, Gp.u1, Gp.v1, 38, 41, tone(E, '#a07a4a'), { top: tone(E, '#c09a62') });
    const Gh = { u0: cu - 0.5, v0: cv - 0.45, u1: cu + 0.5, v1: cv + 0.4, H: 55 };
    box(Gh.u0, Gh.v0, Gh.u1, Gh.v1, 41, 55, tone(E, '#d8c08a'), { top: false });
    onFace({ u0: Gh.u0, v1: Gh.v1 }, 'L', 0.32, 0.68, 41, 50, night ? '#ffcf7a' : tone(E, '#2a2014'), true);
    if (night){ const c = q(cu, Gh.v1, 46); E.lamp(c[0], c[1], 26, '#ffcf7a'); }
    thatchHip(E, Gh, { rise: 14, col: '#c8a050', eave: 0.3, ridge: 0.4 });
    [Gp.u0 + 0.05, Gp.u1 - 0.05].forEach(u => post(E, u, Gp.v1, 41, 46, '#8a6a3a', 0.5)); line(q(Gp.u0 + 0.05, Gp.v1, 46), q(Gp.u1 - 0.05, Gp.v1, 46), tone(E, '#8a6a3a'), 0.8);
    // 줄사다리
    const la = q(cu + 0.55, Gp.v1 + 0.02, 38), lb = q(cu + 0.8, Gp.v1 + 0.02, 38);
    const sw = STILL ? 0 : Math.sin(E.t * 1.2) * 1.2;
    line(la, [la[0] + sw, base[1] + 6], tone(E, '#c8a070'), 0.6); line(lb, [lb[0] + sw, base[1] + 6 - 2], tone(E, '#c8a070'), 0.6);
    for (let k = 1; k < 9; k++){ const f = k / 9; line([la[0] + sw * f, la[1] + (base[1] + 6 - la[1]) * f], [lb[0] + sw * f, lb[1] + (base[1] + 4 - lb[1]) * f], tone(E, '#a07a4a'), 0.8); }
    // 옆으로 뻗은 가지와 잎
    [[-14, -50, 12], [14, -60, 11], [-4, -70, 10]].forEach(([dx, dy, r]) => { oval(base[0] + dx, base[1] + dy, r + 0.8, r * 0.6 + 0.8, INK); oval(base[0] + dx, base[1] + dy, r, r * 0.6, tone(E, '#2a7a34')); oval(base[0] + dx - 3, base[1] + dy - 2, r * 0.6, r * 0.36, tone(E, '#4aa048')); });
  };
  // 출렁다리 — 냇물 위에 덩굴로 엮은 흔들 다리
  W.ropebridge = (E, b) => {
    const u0 = b.x + 0.1, u1 = b.x + b.w - 0.1, vc = b.y + 0.5, gx = G();
    K.poly3([[u0 + 0.3, vc - 0.5, 0], [u1 - 0.3, vc - 0.5, 0], [u1 - 0.3, vc + 0.5, 0], [u0 + 0.3, vc + 0.5, 0]], E.night ? '#163040' : tone(E, '#3a9ab8'));
    for (let i = 0; i < 3; i++){ const p = q(lerp(u0 + 0.5, u1 - 0.5, (i + 0.5) / 3) + Math.sin(E.t + i) * 0.05, vc + (i - 1) * 0.25, 0); R(p[0] - 3, p[1], 6, 0.6, 'rgba(255,255,255,.5)'); }
    [u0, u1].forEach(u => [vc - 0.4, vc + 0.4].forEach(v => post(E, u, v, 0, 14, '#7a5a3a', 0.8)));
    const sag = STILL ? 3 : 3 + Math.sin(E.t * 1.4) * 0.6;
    for (let i = 0; i < 12; i++){ const f = (i + 0.5) / 12, u = lerp(u0, u1, f), z = 6 - sag * Math.sin(f * Math.PI); box(u - 0.06, vc - 0.38, u + 0.06, vc + 0.38, z - 0.8, z, tone(E, i % 2 ? '#b08a5a' : '#a07a4a')); }
    [vc - 0.4, vc + 0.4].forEach(v => { gx.strokeStyle = tone(E, '#5a8a3a'); gx.lineWidth = 0.9; gx.beginPath(); for (let i = 0; i <= 16; i++){ const f = i / 16, p = q(lerp(u0, u1, f), v, 13 - sag * 1.2 * Math.sin(f * Math.PI)); i ? gx.lineTo(p[0], p[1]) : gx.moveTo(p[0], p[1]); } gx.stroke(); });
  };
  // 밀림 해먹 — 짧은 기둥 둘 사이 알록달록 줄무늬 해먹
  W.vinehammock = (E, b) => {
    const u0 = b.x + 0.2, u1 = b.x + b.w - 0.2, vc = b.y + 0.5, sw = STILL ? 0 : Math.sin(E.t * 1.3) * 0.08;
    foot(E, (u0 + u1) / 2, vc, 0.8, 0.3);
    [u0, u1].forEach(u => { post(E, u, vc, 0, 18, '#8a6a4a', 1.2); oval(q(u, vc, 18)[0], q(u, vc, 18)[1], 3, 2, tone(E, '#3a8a3a')); });
    const cols = ['#e8302a', '#f0c020', '#2a9a5a', '#2a6ae8', '#f07a2a'];
    for (let s = 0; s < 5; s++){ const pts = [], pts2 = []; for (let i = 0; i <= 14; i++){ const f = i / 14, u = lerp(u0 + 0.15, u1 - 0.15, f), z = 14 - 9 * Math.sin(f * Math.PI); pts.push(q(u, vc - 0.2 + s * 0.08 + sw * Math.sin(f * Math.PI), z)); pts2.push(q(u, vc - 0.2 + (s + 1) * 0.08 + sw * Math.sin(f * Math.PI), z - 0.3)); } poly(pts.concat(pts2.reverse()), tone(E, cols[s])); }
    [u0, u1].forEach((u, i) => line(q(u, vc, 15), q(lerp(u0 + 0.15, u1 - 0.15, i), vc, 14), tone(E, '#d8c08a'), 0.6));
  };
  // 삼바 북 — 알록달록 큰 북과 채
  W.samba = (E, b) => {
    const c = q(b.x + 0.5, b.y + 0.55, 0), x = c[0], y = c[1], gx = G();
    foot(E, b.x + 0.5, b.y + 0.55, 0.36, 0.26);
    R(x - 7, y - 16, 14, 14, lin(x - 7, 0, x + 7, 0, [tone(E, '#2a9a5a'), tone(E, '#1a6a3a')])); oval(x, y - 2, 7, 2.6, tone(E, '#1a6a3a'));
    for (let i = 0; i < 4; i++) line([x - 7 + i * 4.6, y - 16], [x - 4.6 + i * 4.6, y - 2], tone(E, '#f0c020'), 0.9);
    R(x - 7, y - 10, 14, 2, tone(E, '#f0c020')); gx.strokeStyle = INK; gx.lineWidth = 0.6; gx.strokeRect(x - 7, y - 16, 14, 14);
    ovI(x, y - 16, 7, 2.6, tone(E, '#f4ecd8')); oval(x - 2, y - 16.6, 2.4, 0.7, 'rgba(255,255,255,.6)');
    line([x + 3, y - 17], [x + 9, y - 23], tone(E, '#8a6040'), 1); ovI(x + 9.4, y - 23.4, 1.4, 1.4, tone(E, '#e8302a'));
  };

  // ================= 사바나 농장 =================
  function savannaBackdrop(E){
    const L = look(E), hy = horizon(E), t = E.t, gx = G();
    R(0, 0, E.w, hy + 2, vgrad(0, hy, L.sky));
    if (E.night){
      gx.save(); gx.translate(E.w * 0.45, hy * 0.45); gx.rotate(-0.4); const mw = gx.createLinearGradient(0, -36, 0, 36); mw.addColorStop(0, 'rgba(200,180,255,0)'); mw.addColorStop(0.5, 'rgba(220,200,255,.14)'); mw.addColorStop(1, 'rgba(200,180,255,0)'); gx.fillStyle = mw; gx.fillRect(-E.w, -36, E.w * 2, 72); gx.restore();
      stars(E, 170, hy, 'rgba(255,245,230,'); moon(E, E.w * 0.2, hy * 0.3, 9);
    } else {
      // 낮게 걸린 큰 해 — 노을빛 번짐
      const x = E.w * 0.7, y = hy * 0.72; glow(x, y, 120, 'rgba(255,200,120,', 0.55); glow(x, y, 40, 'rgba(255,240,200,', 0.8); oval(x, y, 13, 13, '#fff4d8');
      for (let i = 0; i < 3; i++){ const w = 120 + hash(i * 5) * 80, xx = ((hash(i * 13) * (E.w + w * 2) + t * (1 + hash(i))) % (E.w + w * 2)) - w; oval(xx, 20 + i * 18, w * 0.5, 4, 'rgba(255,220,190,.55)'); oval(xx + 20, 22 + i * 18, w * 0.3, 2.4, 'rgba(255,190,150,.45)'); }
    }
    // 킬리만자로 — 평평한 꼭대기에 눈
    const kx = E.w * 0.32, kb = hy + 2, kw = 170, kh = 74, kc = E.night ? '#2a2a44' : mix(L.far, L.sky[2], 0.35);
    poly([[kx - kw, kb], [kx - kw * 0.3, kb - kh * 0.86], [kx - kw * 0.14, kb - kh], [kx + kw * 0.12, kb - kh], [kx + kw * 0.3, kb - kh * 0.84], [kx + kw, kb]], kc);
    poly([[kx - kw * 0.3, kb - kh * 0.86], [kx - kw * 0.14, kb - kh], [kx + kw * 0.12, kb - kh], [kx + kw * 0.3, kb - kh * 0.84], [kx + kw * 0.2, kb - kh * 0.78], [kx + kw * 0.06, kb - kh * 0.86], [kx - kw * 0.08, kb - kh * 0.8], [kx - kw * 0.2, kb - kh * 0.84]], E.night ? '#8a8aa8' : '#fbf6f0');
    hill(E, hy + 3, 10, 0.02, 1.7, E.night ? '#2e2838' : mix(L.far2, L.sky[3], 0.2));
    R(0, hy - 16, E.w, 19, vgrad(hy - 16, hy + 3, [L.haze + '0)', L.haze + '.45)']));
    // 지평선 아카시아 그림자
    const sil = E.night ? '#1a1624' : 'rgba(70,45,30,.85)';
    [0.08, 0.2, 0.52, 0.86, 0.95].forEach((f, i) => { const x = E.w * f, y = hy + 3, s = 0.6 + hash(i) * 0.5; R(x - 0.8, y - 14 * s, 1.6, 14 * s, sil); oval(x, y - 15 * s, 13 * s, 3 * s, sil); oval(x + 3 * s, y - 17 * s, 8 * s, 2.4 * s, sil); });
    // 지평선을 천천히 걷는 기린·코끼리 무리(그림자)
    const walk = ((t * 3) % (E.w + 200)) - 100;
    [[0, 'g'], [16, 'g'], [-30, 'e'], [-48, 'e'], [36, 'g']].forEach(([dx, k], i) => { const x = walk + dx, y = hy + 3, bob = STILL ? 0 : Math.sin(t * 2 + i) * 0.5;
      if (k === 'g'){ R(x - 4, y - 8, 1, 8, sil); R(x + 3, y - 8, 1, 8, sil); oval(x, y - 10 + bob, 5, 2.6, sil); poly([[x + 3, y - 11], [x + 6, y - 22 + bob], [x + 7.6, y - 21.6 + bob], [x + 5, y - 10]], sil); oval(x + 7.6, y - 22.4 + bob, 2, 1.1, sil); }
      else { oval(x, y - 6 + bob, 7, 4.6, sil); R(x - 5, y - 4, 2, 4, sil); R(x + 3, y - 4, 2, 4, sil); oval(x + 6.4, y - 7 + bob, 3, 3, sil); line([x + 8.6, y - 6], [x + 9.6, y - 1], sil, 1.4); } });
    // 아래 — 금빛 풀 평원, 바람에 물결
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea));
    gx.strokeStyle = E.night ? 'rgba(160,140,120,.12)' : 'rgba(255,240,190,.35)'; gx.lineWidth = 0.6; gx.beginPath();
    for (let i = 0; i < 160; i++){ const y = hy + 4 + Math.pow(hash(i * 3 + 7), 1.2) * (E.h - hy), x = hash(i * 13 + 2) * E.w, k = (y - hy) / (E.h - hy), sw = STILL ? 0 : Math.sin(t * 1.4 + x * 0.05) * 1.5 * k; gx.moveTo(x, y); gx.lineTo(x + sw, y - 3 - 5 * k); }
    gx.stroke();
    for (let i = 0; i < 6; i++){ const y = hy + 20 + hash(i * 3) * (E.h - hy - 30), x = hash(i * 11) * E.w, s = 0.4 + (y - hy) / (E.h - hy) * 0.6; R(x - 0.6, y - 10 * s, 1.2, 10 * s, E.night ? '#2a2420' : 'rgba(90,60,40,.7)'); oval(x, y - 10 * s, 10 * s, 2.4 * s, E.night ? '#2a2c22' : 'rgba(110,120,60,.7)'); }
  }
  // 섬 땅 — 키 큰 마른 풀, 붉은 흙 자국, 작은 개미 둑
  function savannaIsland(E, paths, busy){
    groundIsland(E, paths, busy, { seed: 37, tuft: '#a88a3a', tuftN: 0.34, tall: 7, deco: (u, v, p, d) => {
      if (d < 0.44){ oval(p[0], p[1], 6, 2, tone(E, '#c88a50')); oval(p[0] + 2, p[1] + 0.5, 3, 1, tone(E, '#b0703e')); }
      else if (d < 0.46){ poly([[p[0] - 4, p[1]], [p[0] - 1.6, p[1] - 9], [p[0] + 0.6, p[1] - 11], [p[0] + 2, p[1] - 6], [p[0] + 4, p[1]]], tone(E, '#b0683a'), true); oval(p[0] - 0.4, p[1] - 6, 0.8, 1.2, tone(E, '#5a3020')); }
      else if (d < 0.5){ oval(p[0], p[1], 1.6, 1, tone(E, '#a89a88')); oval(p[0] + 2.4, p[1] + 0.4, 1.2, 0.8, tone(E, '#bcae9c')); }
    } });
  }
  // 아카시아 — 납작한 우산 잎, 가늘게 갈라진 줄기
  function acacia(E, x, y, s, sd){
    const L = look(E), gx = G(); s *= 0.8;
    oval(x + 6 * s, y + 1, 26 * s, 6 * s, L.shadow);
    const tr = tone(E, '#6a4a34'); gx.strokeStyle = INK; gx.lineWidth = 4 * s + 1; gx.lineCap = 'round';
    const br = [[x, y, x - 2 * s, y - 22 * s], [x - 2 * s, y - 22 * s, x - 14 * s, y - 36 * s], [x - 2 * s, y - 22 * s, x + 12 * s, y - 38 * s], [x + 4 * s, y - 30 * s, x + 2 * s, y - 40 * s]];
    br.forEach(([a, b2, c, d]) => { gx.beginPath(); gx.moveTo(a, b2); gx.lineTo(c, d); gx.stroke(); });
    gx.strokeStyle = tr; gx.lineWidth = 4 * s; br.forEach(([a, b2, c, d], i) => { gx.lineWidth = (i ? 2.4 : 4) * s; gx.beginPath(); gx.moveTo(a, b2); gx.lineTo(c, d); gx.stroke(); });
    const top = [[-14, -40, 16, 5.6], [10, -42, 18, 6], [0, -46, 14, 5]];
    top.forEach(([dx, dy, rx, ry]) => oval(x + dx * s, y + dy * s, rx * s + 0.9, ry * s + 0.9, INK));
    top.forEach(([dx, dy, rx, ry]) => oval(x + dx * s, y + dy * s, rx * s, ry * s, tone(E, '#6a8a3a')));
    top.forEach(([dx, dy, rx, ry]) => oval(x + (dx - 2) * s, y + (dy - 1.6) * s, rx * s * 0.8, ry * s * 0.5, tone(E, '#8aaa4a')));
    for (let i = 0; i < 10; i++) oval(x + (hash(sd * 3 + i) - 0.5) * 40 * s, y - (40 + hash(sd + i) * 6) * s, 1.4 * s, 0.8 * s, tone(E, '#b8c870'));
  }
  // 바오밥 — 뚱뚱한 술병 줄기, 위에 짧은 가지와 잎, 매달린 열매
  function baobabTree(E, x, y, s, sd){
    const L = look(E), gx = G(); s *= 0.78;
    oval(x + 6 * s, y + 1, 24 * s, 7 * s, L.shadow);
    gx.beginPath(); gx.moveTo(x - 10 * s, y); gx.bezierCurveTo(x - 15 * s, y - 16 * s, x - 9 * s, y - 32 * s, x - 6 * s, y - 40 * s); gx.lineTo(x + 6 * s, y - 40 * s); gx.bezierCurveTo(x + 9 * s, y - 32 * s, x + 15 * s, y - 16 * s, x + 10 * s, y); gx.closePath();
    gx.fillStyle = lin(x - 12 * s, 0, x + 12 * s, 0, [tone(E, '#b8a088'), tone(E, '#9a8270'), tone(E, '#7a6454')]); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.7; gx.stroke();
    for (let i = 0; i < 5; i++) line([x - 7 * s + i * 3.5 * s, y - 2], [x - 5 * s + i * 2.6 * s, y - 36 * s], 'rgba(60,40,30,.25)', 0.5);
    gx.strokeStyle = tone(E, '#8a7262'); gx.lineWidth = 2.4 * s; gx.lineCap = 'round';
    [[-5, -40, -16, -50], [-2, -40, -6, -54], [3, -40, 8, -55], [5, -40, 17, -48]].forEach(([a, b2, c, d]) => { gx.beginPath(); gx.moveTo(x + a * s, y + b2 * s); gx.lineTo(x + c * s, y + d * s); gx.stroke(); });
    [[-16, -51, 7], [-6, -56, 6], [8, -57, 7], [17, -49, 6]].forEach(([dx, dy, r]) => { oval(x + dx * s, y + dy * s, r * s + 0.8, r * s * 0.6 + 0.8, INK); oval(x + dx * s, y + dy * s, r * s, r * s * 0.6, tone(E, '#6a8a3a')); oval(x + (dx - 1.6) * s, y + (dy - 1) * s, r * s * 0.6, r * s * 0.3, tone(E, '#8aaa4a')); });
    for (let i = 0; i < 4; i++){ const fx = x + (-14 + i * 9) * s, fy = y - (46 - (i % 2) * 3) * s; line([fx, fy - 3], [fx, fy], tone(E, '#6a5040'), 0.5); ovI(fx, fy + 2, 1.4 * s + 0.6, 2.4 * s + 0.6, tone(E, '#8a9a5a')); }
  }
  function kopje(E, x, y, ready){
    const L = look(E), s = ready ? 1 : 0.45, c = tone(E, '#c8a080');
    oval(x + 2, y + 1.5, 15 * s, 4.6 * s, L.shadow);
    [[-6, -1, 8, 6], [5, -0.5, 7, 5.4], [0, -8, 6.4, 5.4]].forEach(([dx, dy, rx, ry], i) => { if (!ready && i === 2) return; ovI(x + dx * s, y + dy * s - ry * s * 0.6, rx * s, ry * s, i === 2 ? shade(c, 0.1) : c); oval(x + (dx - 2) * s, y + (dy - ry * 0.9) * s, rx * s * 0.5, ry * s * 0.3, 'rgba(255,240,220,.35)'); });
  }
  function thornBush(E, x, y, ready, sd){
    const L = look(E), gx = G();
    oval(x + 2, y + 1, 14, 4.5, L.shadow);
    gx.strokeStyle = tone(E, '#6a5038'); gx.lineWidth = 0.8;
    for (let i = 0; i < 9; i++){ const a = -Math.PI / 2 + (i - 4) * 0.32, l = 9 + hash(sd + i) * 4; gx.beginPath(); gx.moveTo(x, y); gx.lineTo(x + Math.cos(a) * l * 1.3, y + Math.sin(a) * l); gx.stroke(); }
    [[-6, -8, 6], [5, -9, 6], [0, -13, 6]].forEach(b => { oval(x + b[0], y + b[1], b[2] + 0.6, b[2] * 0.5 + 0.6, INK); oval(x + b[0], y + b[1], b[2], b[2] * 0.5, tone(E, '#7a8a3a')); oval(x + b[0] - 1.6, y + b[1] - 1, b[2] * 0.6, b[2] * 0.24, tone(E, '#a0b058')); });
    if (ready) for (let i = 0; i < 7; i++){ const bx = x - 9 + hash(sd * 7 + i) * 18, by = y - 5 - hash(sd * 3 + i) * 10; oval(bx, by, 1.4, 1.4, tone(E, '#d8302a')); oval(bx - 0.4, by - 0.4, 0.5, 0.5, 'rgba(255,255,255,.7)'); }
  }
  function grassBundle(E, x, y, ready){
    oval(x + 2, y + 1, 12, 3.6, look(E).shadow);
    if (!ready){ oval(x, y - 1, 7, 2.4, tone(E, '#c8a858')); return; }
    for (let i = 0; i < 14; i++){ const a = -Math.PI / 2 + (i - 7) * 0.09; line([x + (i - 7) * 0.6, y], [x + Math.cos(a) * 12 + (i - 7) * 0.3, y + Math.sin(a) * 12], tone(E, i % 2 ? '#d8b860' : '#b89840'), 1); }
    line([x - 4, y - 5], [x + 4, y - 5], tone(E, '#8a5a30'), 1.2);
  }
  function savannaNode(E, kind, x, y, ready, seed){
    if (kind === 'tree'){ if (!ready) return freshStump(E, x, y, '#8a7262'); return hash(seed * 7 + 1) < 0.65 ? acacia(E, x, y, 0.95 + hash(seed) * 0.25, seed) : baobabTree(E, x, y, 0.95 + hash(seed) * 0.2, seed); }
    if (kind === 'rock') return kopje(E, x, y, ready);
    if (kind === 'snow') return grassBundle(E, x, y, ready);
    return thornBush(E, x, y, ready, seed);
  }
  // 사바나 날씨 — 낮엔 떠도는 흙먼지와 독수리, 밤엔 반딧불이 조금
  function savannaWeather(E){
    if (STILL) return; const t = E.t, gx = G();
    if (!E.night){
      for (let i = 0; i < 24; i++){ const x = ((hash(i * 3) * E.w + t * (8 + hash(i) * 10)) % E.w), y = E.h * (0.3 + hash(i * 7) * 0.6) + Math.sin(t + i) * 4; oval(x, y, 1, 1, 'rgba(255,230,180,.45)'); }
      for (let i = 0; i < 2; i++){ const a = t * 0.25 + i * Math.PI, x = E.w * (0.55 + i * 0.15) + Math.cos(a) * 60, y = E.top + 10 + Math.sin(a) * 14, f = Math.sin(t * 2 + i) * 0.5; gx.strokeStyle = 'rgba(50,40,30,.7)'; gx.lineWidth = 1; gx.beginPath(); gx.moveTo(x - 6, y - 1 - f); gx.quadraticCurveTo(x - 3, y - 2, x, y); gx.quadraticCurveTo(x + 3, y - 2, x + 6, y - 1 - f); gx.stroke(); }
    } else for (let i = 0; i < 10; i++){ const p = q(E.cols * hash(i * 3 + 5) + Math.sin(t * 0.3 + i), E.rows * hash(i * 7 + 3) + Math.cos(t * 0.25 + i), 8 + Math.sin(t + i) * 4), a = Math.max(0, Math.sin(t * 1.8 + i * 2)); if (a > 0.3){ glow(p[0], p[1], 4, 'rgba(255,240,140,', 0.35 * a); oval(p[0], p[1], 0.7, 0.7, 'rgba(255,250,200,' + a.toFixed(2) + ')'); } }
  }
  // 바오밥 열매 — 보송보송한 초록빛 갈색 꼬투리
  function baobabPod(E, x, y, t){
    oval(x + 1, y + 0.6, 6, 1.8, 'rgba(80,50,20,.3)');
    const gx = G(); gx.save(); gx.translate(x, y - 3.4); gx.rotate(0.5); gx.beginPath(); gx.ellipse(0, 0, 5.4, 3, 0, 0, TAU); gx.fillStyle = lin(-5, -3, 5, 3, ['#c8c890', '#9a9a62', '#6a6a3e']); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.5; gx.stroke();
    for (let i = 0; i < 10; i++) oval(-4 + hash(i * 3) * 8, -2 + hash(i * 7) * 4, 0.5, 0.5, 'rgba(255,255,230,.5)');
    gx.restore(); line([x - 4, y - 6], [x - 6, y - 9], tone(E, '#6a5040'), 0.8);
    const s = Math.pow(Math.max(0, Math.sin(t * 2.1 + x * 0.3)), 3) * 2.4;
    if (s > 0.3){ gx.fillStyle = 'rgba(255,255,230,.95)'; gx.beginPath(); gx.moveTo(x + 2, y - 9 - s); gx.lineTo(x + 2.4, y - 9); gx.lineTo(x + 2, y - 9 + s); gx.lineTo(x + 1.6, y - 9); gx.closePath(); gx.fill(); }
  }
  const savannaFloor = {
    pond: (E, b) => {   // 흙탕 물웅덩이 — 갈색 둑, 발자국
      const cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), r1 = q(b.x + b.w - 0.2, cv, 0), r2 = q(cu, b.y + b.h - 0.2, 0), gx = G();
      const rx = Math.hypot(r1[0] - c[0], r1[1] - c[1]) * 0.98, ry = Math.abs(r2[1] - c[1]) + rx * 0.2;
      gx.save(); gx.translate(c[0], c[1]);
      oval(0, 1.4, rx + 5, ry + 3.4, tone(E, '#8a5a34')); oval(0, 0, rx + 2.4, ry + 1.8, tone(E, '#b07a48'));
      oval(0, 0.5, rx, ry, lin(-rx, -ry, rx, ry, E.night ? ['#2a3a5a', '#18243a'] : ['#8ab8c8', '#5a8898']));
      oval(0, -ry * 0.2, rx * 0.8, ry * 0.5, E.night ? 'rgba(160,190,255,.1)' : 'rgba(255,240,210,.22)');
      for (let i = 0; i < 6; i++){ const a = hash(i * 5) * TAU, x = Math.cos(a) * (rx + 3), y = Math.sin(a) * (ry + 2); oval(x, y, 1, 0.6, tone(E, '#6a4428')); oval(x + 1.4, y - 0.4, 0.6, 0.4, tone(E, '#6a4428')); }
      gx.restore();
    },
    pasture: (E, b) => {
      K.poly3([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + b.h - 0.1, 0], [b.x + 0.1, b.y + b.h - 0.1, 0]], E.night ? 'rgba(30,20,40,.18)' : 'rgba(170,100,40,.16)');
      for (let i = 0; i < 26; i++){ const p = q(b.x + 0.3 + hash(i * 3 + b.x) * (b.w - 0.6), b.y + 0.3 + hash(i * 7 + b.y) * (b.h - 0.6), 0); line([p[0] - 2, p[1]], [p[0] + 2, p[1] - 0.6], tone(E, '#d8b060'), 0.5); }
    },
  };
  // 케냐 깃발 — 검정·빨강·초록 띠, 사이 흰 줄, 가운데 마사이 방패
  function savannaFlag(E, b){ flagCloth(E, b, (at) => {
    [[0, 0.3, '#1a1a1a'], [0.3, 0.36, '#ffffff'], [0.36, 0.64, '#c82a2a'], [0.64, 0.7, '#ffffff'], [0.7, 1, '#1a8a3a']].forEach(([k0, k1, c]) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push(at(i / 8, k0)); for (let i = 8; i >= 0; i--) pts.push(at(i / 8, k1)); poly(pts, tone(E, c)); });
    const o = []; for (let i = 0; i <= 8; i++) o.push(at(i / 8, 0)); for (let i = 8; i >= 0; i--) o.push(at(i / 8, 1)); poly(o, null, 0.5);
    const c = at(0.5, 0.5); ovI(c[0], c[1], 2.4, 4.6, tone(E, '#c82a2a')); line([c[0], c[1] - 4], [c[0], c[1] + 4], '#ffffff', 0.5); line([c[0] - 4, c[1] - 5], [c[0] + 4, c[1] + 5], '#ffffff', 0.5); line([c[0] + 4, c[1] - 5], [c[0] - 4, c[1] + 5], '#ffffff', 0.5);
  }); }
  // ---------- 사바나 집·가게 ----------
  // 둥근 흙집 — 흙벽 원통에 원뿔 초가 지붕, 문가에 마사이 무늬(빨강·흰 지그재그)
  function roundHut(E, cu, cv, r, H2, rise, night, o){
    o = o || {}; const c = q(cu, cv, 0), rr = q(cu + r, cv, 0), dd = q(cu, cv + r, 0), rx = Math.hypot(rr[0] - c[0], rr[1] - c[1]) * 1.05, ry = Math.abs(dd[1] - c[1]) * 0.98 + 1, x = c[0], y = c[1], gx = G();
    oval(x + 3, y + 2, rx + 4, ry + 2, look(E).shadow);
    const wall = tone(E, o.wall || '#d89a62');
    gx.beginPath(); gx.ellipse(x, y, rx, ry, 0, 0, Math.PI); gx.lineTo(x - rx, y - H2); gx.ellipse(x, y - H2, rx, ry, 0, Math.PI, 0, true); gx.closePath();
    gx.fillStyle = lin(x - rx, 0, x + rx, 0, [shade(wall, 0.1), wall, shade(wall, -0.28)]); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.7; gx.stroke();
    gx.save(); gx.beginPath(); gx.ellipse(x, y, rx, ry, 0, 0, Math.PI); gx.lineTo(x - rx, y - 5); gx.ellipse(x, y - 5, rx, ry, 0, Math.PI, 0, true); gx.closePath(); gx.fillStyle = tone(E, shade(o.wall || '#d89a62', -0.18)); gx.fill(); gx.restore();
    // 지그재그 띠
    gx.strokeStyle = tone(E, '#c82a2a'); gx.lineWidth = 1.2; gx.beginPath(); for (let i = 0; i <= 20; i++){ const a = Math.PI * i / 20, px = x - Math.cos(a) * rx, py = y - H2 * 0.62 + Math.sin(a) * ry + (i % 2 ? -1.4 : 1.4); i ? gx.lineTo(px, py) : gx.moveTo(px, py); } gx.stroke();
    gx.strokeStyle = tone(E, '#fff4e0'); gx.lineWidth = 0.6; gx.beginPath(); for (let i = 0; i <= 20; i++){ const a = Math.PI * i / 20, px = x - Math.cos(a) * rx, py = y - H2 * 0.62 + Math.sin(a) * ry + (i % 2 ? 1 : -1) + 2.6; i ? gx.lineTo(px, py) : gx.moveTo(px, py); } gx.stroke();
    // 문 — 앞(왼쪽 아래) 쪽
    const da = Math.PI * 0.32, dx = x - Math.cos(da) * rx * 0.98, dy = y + Math.sin(da) * ry;
    gx.beginPath(); gx.moveTo(dx - 4, dy); gx.lineTo(dx - 4, dy - H2 * 0.55); gx.quadraticCurveTo(dx, dy - H2 * 0.75, dx + 4, dy - H2 * 0.55); gx.lineTo(dx + 4, dy + 0.5); gx.closePath(); gx.fillStyle = night ? '#ffcf7a' : tone(E, '#3a2418'); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.6; gx.stroke();
    if (night) E.lamp(dx, dy - H2 * 0.3, 30, '#ffcf7a');
    if (o.win){ const wa = Math.PI * 0.72, wx = x - Math.cos(wa) * rx * 0.98, wy = y + Math.sin(wa) * ry - H2 * 0.5; R(wx - 2.4, wy - 3, 4.8, 5, night ? look(E).win : tone(E, '#3a2418')); if (night) E.lamp(wx, wy, 18, '#ffcf7a'); }
    // 원뿔 초가 지붕
    const ex = rx + 6, ey = ry + 3.4, top = [x, y - H2 - rise], col = tone(E, '#c8a050');
    gx.beginPath(); gx.moveTo(x - ex, y - H2 + 2); gx.lineTo(top[0], top[1]); gx.lineTo(x + ex, y - H2 + 2); gx.ellipse(x, y - H2 + 2, ex, ey, 0, 0, Math.PI); gx.closePath();
    gx.fillStyle = lin(x - ex, 0, x + ex, 0, [shade(col, 0.14), col, shade(col, -0.3)]); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.7; gx.stroke();
    gx.strokeStyle = 'rgba(100,70,20,.35)'; gx.lineWidth = 0.5; gx.beginPath(); for (let i = 1; i < 16; i++){ const a = Math.PI * i / 16; gx.moveTo(top[0], top[1]); gx.lineTo(x - Math.cos(a) * ex, y - H2 + 2 + Math.sin(a) * ey); } gx.stroke();
    gx.fillStyle = shade(col, -0.1); gx.beginPath(); for (let i = 0; i <= 30; i++){ const a = Math.PI * i / 30, px = x - Math.cos(a) * ex, py = y - H2 + 2 + Math.sin(a) * ey; gx.lineTo(px, py + (i % 2 ? 1.6 : 3.4)); } for (let i = 30; i >= 0; i--){ const a = Math.PI * i / 30; gx.lineTo(x - Math.cos(a) * ex, y - H2 + 2 + Math.sin(a) * ey - 1); } gx.closePath(); gx.fill();
    oval(top[0], top[1] + 1, 2, 1.2, tone(E, '#8a6030')); line([top[0], top[1] + 1], [top[0], top[1] - 4], tone(E, '#6a4a2a'), 1);
    return top;
  }
  W.savannaHouse = (E, b, night) => {
    const G2 = geo(b, 0.25, 0), cu = (G2.u0 + G2.u1) / 2 + 0.3, cv = (G2.v0 + G2.v1) / 2 + 0.1;
    footBox(E, G2);
    roundHut(E, G2.u0 + 0.75, G2.v0 + 0.7, 0.6, 16, 14, night, { wall: '#c88a52' });   // 뒤 작은 곳간
    const top = roundHut(E, cu, cv, 1.3, 24, 22, night, { win: true });
    E.chimney(top[0] + 2, top[1] + 8);
    // 문 옆 물 항아리와 나무 의자
    const jp = q(G2.u1 - 0.1, G2.v1 + 0.1, 0); ovI(jp[0], jp[1] - 4, 3.6, 4.4, tone(E, '#a0582e')); oval(jp[0], jp[1] - 8.4, 1.6, 0.7, tone(E, '#5a2a18'));
    box(G2.u0 + 0.3, G2.v1 + 0.1, G2.u0 + 0.9, G2.v1 + 0.4, 0, 4, tone(E, '#8a6040'));
  };
  // 공예품 노점 — 캉가 천 차양(빨강·주황·검정), 구슬 목걸이·바구니·박 그릇(part 'back' | 'front')
  W.savannaStall = (E, b, night, part) => {
    const G2 = geo(b, 0.15, 0), u0 = G2.u0, u1 = G2.u1, v0 = G2.v0, v1 = G2.v1;
    if (part !== 'front'){
      footBox(E, G2);
      box(u0, v0, u1, v0 + 0.25, 0, 30, tone(E, '#8a5a3a'), { top: false });
      for (let z = 10; z < 28; z += 9) box(u0 + 0.05, v0 + 0.25, u1 - 0.05, v0 + 0.55, z, z + 1.5, tone(E, '#5a3a24'));
      ['#c82a2a', '#2a6ae8', '#f0c020', '#1a8a3a', '#f07a2a'].forEach((cc, i) => { const p = q(u0 + 0.3 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 11.5); const gx = G(); gx.strokeStyle = tone(E, cc); gx.lineWidth = 1.2; gx.beginPath(); gx.arc(p[0], p[1] - 3, 3, 0.2, Math.PI - 0.2); gx.stroke();
        const p2 = q(u0 + 0.45 + i * (u1 - u0 - 0.6) / 4, v0 + 0.4, 20.5); ovI(p2[0], p2[1] - 2.4, 2.8, 2.4, tone(E, i % 2 ? '#c8a050' : '#a8783a')); line([p2[0] - 2.6, p2[1] - 2.4], [p2[0] + 2.6, p2[1] - 2.4], tone(E, '#6a4020'), 0.5); });
      post(E, u0 + 0.05, v0 + 0.1, 0, 78, '#6a4028'); post(E, u1 - 0.05, v0 + 0.1, 0, 78, '#6a4028');
      return;
    }
    post(E, u0 + 0.05, v1 - 0.1, 0, 71, '#6a4028'); post(E, u1 - 0.05, v1 - 0.1, 0, 71, '#6a4028');
    box(u0 + 0.1, v1 - 0.55, u1 - 0.1, v1 - 0.1, 0, 12, tone(E, '#a07048'));
    onFace({ u0: u0 + 0.1, u1: u1 - 0.1, v0: v1 - 0.55, v1: v1 - 0.1 }, 'L', 0, u1 - u0 - 0.2, 3, 8, tone(E, '#f07a2a'));
    for (let a = 0.12; a < u1 - u0 - 0.3; a += 0.24) onFace({ u0: u0 + 0.1, u1: u1 - 0.1, v0: v1 - 0.55, v1: v1 - 0.1 }, 'L', a, a + 0.1, 3.5, 7.5, tone(E, '#1a1a1a'));
    [[0.3, 'k'], [0.8, 'g'], [1.3, 'k'], [1.8, 'g']].forEach(([a, k], i) => { if (u0 + a > u1 - 0.3) return; const p = q(u0 + a + 0.15, v1 - 0.33, 12);
      if (k === 'k'){ ovI(p[0], p[1] - 2.4, 4, 2.6, tone(E, '#c8a050')); for (let j = 0; j < 4; j++) line([p[0] - 3.4 + j * 2.2, p[1] - 4.4], [p[0] - 2.6 + j * 2.2, p[1] - 0.6], tone(E, j % 2 ? '#c82a2a' : '#1a1a1a'), 0.6); }
      else { ovI(p[0], p[1] - 3, 3, 3.4, tone(E, '#b88040')); oval(p[0], p[1] - 6.2, 1.2, 0.6, tone(E, '#6a4020')); } });
    const n = 8, zt = 79, va = v0 - 0.05, vb = v1 + 0.3, zb = 72, cols = ['#c82a2a', '#f07a2a', '#1a1a1a', '#f0c020'];
    for (let i = 0; i < n; i++){ const a0 = u0 - 0.15 + (u1 - u0 + 0.3) * i / n, a1 = u0 - 0.15 + (u1 - u0 + 0.3) * (i + 1) / n; K.poly3([[a0, va, zt], [a1, va, zt], [a1, vb, zb], [a0, vb, zb]], tone(E, cols[i % 4])); }
    K.poly3([[u0 - 0.15, va, zt], [u1 + 0.15, va, zt], [u1 + 0.15, vb, zb], [u0 - 0.15, vb, zb]], null, true);
    for (let i = 0; i < n * 2; i++){ const p = q(u0 - 0.15 + (u1 - u0 + 0.3) * (i + 0.5) / (n * 2), vb, zb); line(p, [p[0], p[1] + 3], tone(E, cols[i % 4]), 0.6); }   // 술
    if (night){ const p = q((u0 + u1) / 2, vb, zb - 2); oval(p[0], p[1] + 3, 1.6, 2, '#ffe7a4'); E.lamp(p[0], p[1] + 3, 34, '#ffcf7a'); }
  };
  // ---------- 사바나 꾸미개 ----------
  W.waterhole = (E, b) => {   // 물웅덩이 — 갈대, 홍학 둘
    savannaFloor.pond(E, b);
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), gx = G();
    [[-14, -2], [12, 3]].forEach(([dx, dy], i) => { const x = c[0] + dx, y = c[1] + dy, bob = STILL ? 0 : Math.sin(E.t * 1.5 + i) * 0.6;
      line([x, y], [x, y - 10], tone(E, '#e87a8a'), 0.7); line([x + 1, y], [x + 2, y - 5], tone(E, '#e87a8a'), 0.6);
      oval(x + 0.6, y - 12 + bob, 4.4, 2.6, tone(E, '#ff9aa8')); oval(x - 0.6, y - 12.6 + bob, 3, 1.6, tone(E, '#ffb8c0'));
      gx.strokeStyle = tone(E, '#ff9aa8'); gx.lineWidth = 1.2; gx.beginPath(); gx.moveTo(x + 3.6, y - 13 + bob); gx.quadraticCurveTo(x + 7, y - 18, x + 4.4, y - 21 + bob); gx.stroke();
      oval(x + 4.4, y - 21.4 + bob, 1.4, 1.2, tone(E, '#ff9aa8')); poly([[x + 5.6, y - 21.4 + bob], [x + 7.4, y - 20.4 + bob], [x + 5.4, y - 20.6 + bob]], '#2a2a2a'); });
    [[-0.9, -0.5], [0.85, 0.35]].forEach(([fu, fv]) => { const p = q(b.x + b.w / 2 + fu, b.y + b.h / 2 + fv, 0); for (let k = 0; k < 5; k++){ const a = -Math.PI / 2 + (k - 2) * 0.18; curve([[p[0] + k, p[1]], [p[0] + k + Math.cos(a) * 5, p[1] + Math.sin(a) * 8], [p[0] + k + Math.cos(a) * 8, p[1] + Math.sin(a) * 14]], tone(E, '#8a8a3a'), 0.9); } });
  };
  W.safari = (E, b, night) => {   // 사파리 지프 — 초록 몸통, 지붕 짐칸, 뒤 바퀴, 둥근 전조등
    const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, v0 = b.y + 0.2, v1 = b.y + 0.8;
    foot(E, (u0 + u1) / 2, (v0 + v1) / 2, 0.95, 0.4);
    const body = '#5a7a4a';
    [[u0 + 0.35, v1], [u1 - 0.35, v1], [u1 - 0.35, v0]].forEach(([u, v]) => { const p = q(u, v, 3); ovI(p[0], p[1], 3.2, 3.6, tone(E, '#2a2a2a')); oval(p[0], p[1], 1.4, 1.6, tone(E, '#8a8a8a')); });
    box(u0, v0, u1, v1, 3, 10, tone(E, body));
    box(u0 + 0.5, v0 + 0.05, u1 - 0.1, v1 - 0.05, 10, 17, tone(E, shade(body, 0.05)), { top: tone(E, '#6a8a5a') });
    onFace({ u0: u0 + 0.5, u1: u1 - 0.1, v0: v0 + 0.05, v1: v1 - 0.05 }, 'L', 0.1, 0.55, 11, 16, night ? look(E).win : tone(E, '#9ac0d8'), true);
    onFace({ u0: u0 + 0.5, u1: u1 - 0.1, v0: v0 + 0.05, v1: v1 - 0.05 }, 'L', 0.65, 1.1, 11, 16, night ? look(E).win : tone(E, '#9ac0d8'), true);
    box(u0 + 0.6, v0 + 0.1, u1 - 0.2, v1 - 0.1, 17, 18.4, tone(E, '#3a3a3a'));
    box(u0 + 0.8, v0 + 0.2, u0 + 1.2, v1 - 0.2, 18.4, 21, tone(E, '#a07a4a'));   // 짐
    const sp = q(u0 - 0.02, (v0 + v1) / 2, 8); ovI(sp[0], sp[1], 2.6, 3.6, tone(E, '#2a2a2a'));
    const hl = q(u1, v1 - 0.12, 7); oval(hl[0], hl[1], 1.2, 1.4, night ? '#fff0b0' : tone(E, '#e8e8d0')); if (night) E.lamp(hl[0] + 4, hl[1], 26, '#fff0b0');
  };
  W.manyatta = (E, b, night) => { roundHut(E, b.x + b.w / 2, b.y + b.h / 2, 0.75, 16, 14, night, { wall: '#c88a52' }); };
  W.lookout = (E, b, night) => {   // 나무 망루 — 네 기둥, 사다리, 초가 지붕
    const cu = b.x + 0.5, cv = b.y + 0.55, r = 0.3;
    foot(E, cu, cv, 0.4, 0.3);
    [[-r, -r], [r, -r], [-r, r], [r, r]].forEach(([du, dv]) => post(E, cu + du, cv + dv, 0, 40, '#8a6040', 0.9));
    [12, 26].forEach(z => { line(q(cu - r, cv + r, z), q(cu + r, cv + r, z + 6), tone(E, '#8a6040'), 0.8); line(q(cu + r, cv + r, z), q(cu + r, cv - r, z + 6), tone(E, '#7a5030'), 0.8); });
    box(cu - r - 0.1, cv - r - 0.1, cu + r + 0.1, cv + r + 0.1, 38, 40, tone(E, '#a07a4a'), { top: tone(E, '#c09a62') });
    [[-r, r], [r, r], [r, -r]].forEach(([du, dv]) => post(E, cu + du, cv + dv, 40, 50, '#8a6040', 0.6));
    thatchHip(E, { u0: cu - r, v0: cv - r, u1: cu + r, v1: cv + r, H: 50 }, { rise: 10, col: '#c8a050', eave: 0.25, ridge: 0.5 });
    const la = q(cu - r - 0.1, cv + r + 0.5, 0), lb = q(cu - r - 0.1, cv + r, 38), lc = q(cu - r + 0.25, cv + r + 0.5, 0), ld = q(cu - r + 0.25, cv + r, 38);
    line(la, lb, tone(E, '#a07a4a'), 0.8); line(lc, ld, tone(E, '#a07a4a'), 0.8);
    for (let k = 1; k < 10; k++){ const f = k / 10; line([la[0] + (lb[0] - la[0]) * f, la[1] + (lb[1] - la[1]) * f], [lc[0] + (ld[0] - lc[0]) * f, lc[1] + (ld[1] - lc[1]) * f], tone(E, '#a07a4a'), 0.6); }
    if (night){ const p = q(cu, cv, 44); E.lamp(p[0], p[1], 26, '#ffcf7a'); }
  };

  // ================= 농장 붙이기 =================
  Object.assign(K.D, { sugarshack: W.sugarshack, canoe: W.canoe, leafpile: W.leafpile, jacklight: W.jacklight,
    treehouse: W.treehouse, ropebridge: W.ropebridge, vinehammock: W.vinehammock, samba: W.samba,
    waterhole: W.waterhole, safari: W.safari, manyatta: W.manyatta, lookout: W.lookout });
  Object.assign(K.LIVE, { sugarshack: W.sugarshackLive });
  HD.addFarm('maple', { look: LOOK_MAPLE, nightTint: '#1a1840',
    backdrop: mapleBackdrop, island: mapleIsland, sparkle: () => {}, node: mapleNode, weather: mapleWeather, pick: (E, x, y, t) => syrupPail(E, x, y, t),
    floor: mapleFloor, live: { flag: mapleFlag } });
  HD.addFarm('jungle', { look: LOOK_JUNGLE, nightTint: '#0e2a2a',
    backdrop: jungleBackdrop, island: jungleIsland, sparkle: () => {}, node: jungleNode, weather: jungleWeather, pick: (E, x, y, t) => mangoFruit(E, x, y, t),
    floor: jungleFloor, thing: { house: W.jungleHouse, stall: W.jungleStall }, live: { flag: jungleFlag } });
  // 사바나는 외양간·닭장을 사막 흙벽 그림으로(dz) — 흙벽에 짚 지붕이 동아프리카 마을과 닮았다. 집·가게는 둥근 흙집과 캉가 노점
  HD.addFarm('savanna', { look: LOOK_SAVANNA, nightTint: '#1e1638', dz: true,
    backdrop: savannaBackdrop, island: savannaIsland, sparkle: () => {}, node: savannaNode, weather: savannaWeather, pick: (E, x, y, t) => baobabPod(E, x, y, t),
    floor: savannaFloor, thing: { house: W.savannaHouse, stall: W.savannaStall }, live: { flag: savannaFlag } });
  HD.wild = { leafAt, roundHut, thatchHip, AUTUMN };
})();
