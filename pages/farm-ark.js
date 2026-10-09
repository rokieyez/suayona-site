// pages/farm-ark.js — 메인 목표 「수아연아의 방주」 그림(2026-10-09 로키즈).
// 방주 농장(먹구름이 몰려오는 메소포타미아 들판, 한가운데 열 단계로 지어지는 방주)과 무지개 농장(물 빠진 새 땅, 아라랏 산 위의 방주, 무지개).
// pages/farm-hd.js 의 붓(FARMHD.kit)으로 칠하고, FARMHD.addFarm 으로 하늘·섬·나무·건물 자리를 끼운다. 좌표는 농장 도트 단위(칸 마름모 40×20).
// 장면(하나님의 음성·입장·대홍수·새 땅 도착)은 같은 붓으로 이 파일 아래쪽에 있다.
(function(){
  'use strict';
  const HD = window.FARMHD; if (!HD || !HD.kit) return;
  const K = HD.kit, TAU = Math.PI * 2, STILL = K.STILL, INK = K.INK;
  const { R, poly, oval, lin, vgrad, glow, line, q, box, roof, foot, ovI, curve, look, tone, shade, mix, hash, h2 } = K;
  const G = () => K.ctx();
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const horizon = E => E.top + 34;
  const arkOf = E => E.ark || { step: 0, k: 1 };

  // ================= 빛깔 =================
  // 방주 농장 — 푸른 들판과 진흙 벼랑. 하늘은 방주가 지어질수록 먹구름이 짙어진다(backdrop)
  const LOOK_ARK = {
    day: { sky: ['#6b8fb6', '#9ab8d0', '#cfdbe0', '#efe8cf'], star: false, aurora: 0, moon: false, dry: true,
      far: '#7f9c7a', far2: '#6a8a62', snowcap: 'rgba(0,0,0,0)', sea: ['#8fae6a', '#5f8046'], floe: ['#9ab870', '#7a9a58'],
      snow: ['#a8c672', '#88a858'], snowHi: 'rgba(255,255,220,.2)', snowLo: 'rgba(40,70,20,.12)', drift: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
      cliff: ['#8a6a48', '#74583c', '#5e4630', '#463424'], stone: ['#cdbd9c', '#c0ae8c', '#d8caac', '#b4a282'],
      fir: ['#2f5a3a', '#244a30', '#1a3a26'], firSnow: ['#4a7a4a', '#3a6a3a'], frost: ['#7aa060', '#5a8a48', '#a0c080'], trunk: ['#7a5a3a', '#5a4028'],
      glow: 0, haze: 'rgba(214,222,206,', shadow: 'rgba(40,50,20,.24)', win: '#5a7a9a', ice: ['#4aa0c8', '#2a78a8', '#ffffff'], sand: ['#a8c672', '#88a858'] },
    night: { sky: ['#070b1e', '#121a3a', '#22304e', '#3a4658'], star: true, aurora: 0, moon: true, dry: true,
      far: '#26324a', far2: '#2e3c50', snowcap: 'rgba(0,0,0,0)', sea: ['#2c3a3a', '#1a2626'], floe: ['#34443e', '#28362f'],
      snow: ['#4a5e46', '#3a4c38'], snowHi: 'rgba(200,220,255,.06)', snowLo: 'rgba(0,10,30,.18)', drift: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
      cliff: ['#4a3e3c', '#3c3234', '#30282c', '#221c22'], stone: ['#6a6a72', '#62626a', '#72727a', '#5a5a62'],
      fir: ['#1a3a2c', '#142e24', '#0e221a'], firSnow: ['#2a4a38', '#22402e'], frost: ['#3a5a40', '#2e4e36', '#4a6a4a'], trunk: ['#4a3a30', '#382a24'],
      glow: 1, haze: 'rgba(40,60,90,', shadow: 'rgba(0,6,20,.34)', win: '#ffd98a', ice: ['#2a4a7a', '#163058', '#a0b8e0'], sand: ['#4a5e46', '#3a4c38'] },
  };
  // 무지개 농장 — 비 갠 뒤의 맑고 싱싱한 초록, 젖은 흙 벼랑
  const LOOK_NEW = {
    day: Object.assign({}, LOOK_ARK.day, { sky: ['#5fa8e6', '#8ccaf0', '#cbe8f6', '#f3f8e8'], far: '#8ab4a8', far2: '#76a48a',
      sea: ['#9ccc70', '#6aa850'], floe: ['#aad67e', '#86b85e'], snow: ['#9cd06a', '#7cb852'], snowHi: 'rgba(255,255,230,.24)',
      cliff: ['#7a5a40', '#644834', '#4e3828', '#3a2a1e'], stone: ['#cfc8b4', '#c4bca6', '#dad4c2', '#b8b09a'], fir: ['#2f6a3e', '#245a32', '#1a4a28'],
      haze: 'rgba(230,240,236,', shadow: 'rgba(30,60,30,.2)', sand: ['#9cd06a', '#7cb852'] }),
    night: Object.assign({}, LOOK_ARK.night, { sky: ['#060c24', '#10204a', '#1e3a5e', '#2c4a5e'], sea: ['#24402e', '#162a1e'], snow: ['#3e5a3a', '#30482e'] }),
  };

  // ================= 방주 농장 — 하늘 =================
  // 먹구름 덩어리 — 둥근 뭉치 여럿. 아래는 어둡고 위는 빛을 받는다
  function cloudMass(x, y, w, h, dark, lite, sd){
    for (let i = 0; i < 7; i++){ const f = i / 6, cx = x - w / 2 + w * f, cy = y - Math.sin(f * Math.PI) * h * 0.45 + (hash(sd + i) - 0.5) * h * 0.2, r = h * (0.42 + 0.3 * Math.sin(f * Math.PI) + hash(sd * 3 + i) * 0.12);
      oval(cx, cy + r * 0.2, r * 1.2, r * 0.8, dark); oval(cx - r * 0.2, cy - r * 0.15, r, r * 0.66, lite); }
  }
  /* 먹구름 짙기 0~1. 2026-10-09 로키즈 「방주 농장은 기본이 약간 비가 올 날씨처럼」 — 첫날부터 0.42(낮게 깔린 잿빛 구름·습한 안개),
     방주를 지을수록 짙어져 7단계쯤부터 빗방울, 9단계부터 번개 */
  function storm(E){ const A = arkOf(E); return 0.42 + 0.58 * clamp01((A.step + (A.k < 1 ? A.k - 1 : 0)) / 10); }
  function arkBackdrop(E){
    const L = look(E), hy = horizon(E), t = E.t, s = storm(E), gx = G();
    // 먹구름이 짙을수록 하늘이 잿빛으로
    const sky = L.sky.map((c, i) => mix(c, E.night ? '#0a0e1a' : ['#3e4656', '#59606c', '#7a7e84', '#9a9886'][i], s * 0.62));
    R(0, 0, E.w, hy + 2, vgrad(0, hy, sky));
    if (E.night && s < 0.8) for (let i = 0; i < 90; i++){ const x = hash(i * 7 + 1) * E.w, y = hash(i * 11 + 3) * hy * 0.9, a = (0.3 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash(i)) + i))) * (1 - s); R(x, y, 0.8, 0.8, 'rgba(235,240,255,' + a.toFixed(2) + ')'); }
    if (!E.night){ const x = E.w * 0.2, y = hy * 0.5; glow(x, y, 64, 'rgba(255,246,220,', 0.55 * (1 - s)); oval(x, y, 8, 8, mix('#fffaf0', '#c8c8c0', s)); }
    else { const x = E.w * 0.82, y = hy * 0.26; glow(x, y, 30, 'rgba(210,225,255,', 0.3 * (1 - s)); oval(x, y, 6.5, 6.5, mix('#eef3ff', '#5a6070', s)); }
    // 먼 언덕 두 겹과 지구라트·성벽 그림자(옛 메소포타미아 도시)
    const hill = (base, amp, f, sd, col) => { gx.beginPath(); gx.moveTo(0, base + 6); for (let x = 0; x <= E.w + 3; x += 3) gx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(x * f + sd)) * (0.7 + 0.3 * Math.sin(x * f * 0.31 + sd * 2))); gx.lineTo(E.w, base + 6); gx.closePath(); gx.fillStyle = col; gx.fill(); };
    hill(hy + 2, 26, 0.009, 1.1, mix(L.far, '#4a5058', s * 0.5));
    const zx = E.w * 0.66, zb = hy - 2, zc = mix(E.night ? '#2a3044' : '#a89a80', '#50545c', s * 0.5);
    [[46, 8], [34, 8], [22, 8], [12, 7]].forEach(([w, h], i) => { const y0 = zb - [0, 8, 16, 24][i]; R(zx - w / 2, y0 - h, w, h, shade(zc, -i * 0.04)); R(zx - 1.5, y0 - h, 3, h, shade(zc, 0.12)); });
    R(zx + 30, zb - 6, 44, 6, zc); for (let i = 0; i < 8; i++) R(zx + 31 + i * 5.4, zb - 8, 2.6, 2.2, zc);
    hill(hy + 4, 14, 0.019, 3.7, mix(L.far2, '#3e4a44', s * 0.5));
    R(0, hy - 24, E.w, 27, vgrad(hy - 24, hy + 3, [L.haze + '0)', L.haze + (0.35 + s * 0.2).toFixed(2) + ')']));
    // 먹구름 — 단계가 오를수록 수가 늘고 낮게 깔린다. 바람에 천천히 흘러간다
    const nC = Math.round(3 + s * 11), dark = E.night ? 'rgba(14,18,30,' : 'rgba(58,62,74,', lite = E.night ? 'rgba(40,46,64,' : 'rgba(150,154,164,';
    for (let i = 0; i < nC; i++){
      const w = 90 + hash(i * 5) * 120, y = 14 + hash(i * 7 + 2) * (hy * (0.35 + s * 0.4)), sp = 2 + hash(i) * 3;
      const x = ((hash(i * 13) * (E.w + w * 2) + t * sp) % (E.w + w * 2)) - w;
      const a = (0.35 + 0.55 * s) * (0.7 + 0.3 * hash(i * 3));
      cloudMass(x, y, w, 26 + hash(i * 9) * 20, dark + a.toFixed(2) + ')', lite + (a * 0.8).toFixed(2) + ')', i * 17);
    }
    // 번개 — 방주를 거의 다 지으면(9단계부터) 먼 데서 가끔 번쩍
    if (s >= 0.93 && !STILL){
      const cyc = Math.floor(t / 5.3), ph = t / 5.3 - cyc;
      if (ph < 0.06){
        const x0 = E.w * (0.15 + hash(cyc) * 0.7), gx2 = G();
        R(0, 0, E.w, hy, 'rgba(230,236,255,' + (0.28 * (1 - ph / 0.06)).toFixed(2) + ')');
        gx2.strokeStyle = 'rgba(255,255,240,.95)'; gx2.lineWidth = 1.4; gx2.beginPath(); let x = x0, y = 20; gx2.moveTo(x, y);
        for (let k = 0; k < 7; k++){ x += (hash(cyc * 7 + k) - 0.5) * 18; y += (hy - 30) / 7; gx2.lineTo(x, y); } gx2.stroke();
      }
    }
    // 섬 아래 들판 — 밭뙈기 조각보와 유프라테스 강물이 반짝인다
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea.map(c => mix(c, '#4a5048', s * 0.35))));
    for (let i = 0; i < 40; i++){ const y = hy + 4 + Math.pow(hash(i * 3 + 7), 1.3) * (E.h - hy), x = hash(i * 13 + 2) * E.w, w = 12 + hash(i) * 30, k = (y - hy) / (E.h - hy);
      poly([[x - w, y], [x, y - 3 - 4 * k], [x + w, y], [x, y + 3 + 4 * k]], i % 3 ? 'rgba(120,150,70,.25)' : 'rgba(200,180,110,.22)'); }
    gx.strokeStyle = E.night ? 'rgba(120,150,190,.35)' : mix('#9fd0e8', '#7a8a96', s); gx.lineWidth = 5; gx.lineCap = 'round'; gx.beginPath();
    gx.moveTo(-10, hy + 30); gx.bezierCurveTo(E.w * 0.3, hy + 10, E.w * 0.45, E.h * 0.9, E.w + 10, E.h * 0.7); gx.stroke();
    gx.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - s)).toFixed(2) + ')'; gx.lineWidth = 1.2; gx.stroke();
  }
  // ================= 방주 농장 — 섬 =================
  function cliffFaces(E, seed){
    const L = look(E), D2 = E.cliff, C = E.cols, Rw = E.rows, lc = q(0, Rw, 0), bc = q(C, Rw, 0), rc = q(C, 0, 0), gx = G();
    const face = (a, b, sh, sd) => {
      for (let i = 0; i < 4; i++){ const d0 = D2 * i / 4, d1 = D2 * (i + 1) / 4 + 0.6; poly([[a[0], a[1] + d0], [b[0], b[1] + d0], [b[0], b[1] + d1], [a[0], a[1] + d1]], L.cliff[i]); }
      poly([[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + D2], [a[0], a[1] + D2]], 'rgba(0,0,0,' + sh + ')');
      gx.strokeStyle = E.night ? 'rgba(255,255,255,.05)' : 'rgba(255,230,190,.16)'; gx.lineWidth = 0.7; gx.beginPath();   // 흙켜
      for (let k = 1; k < 7; k++){ const d = D2 * k / 7 + 1.5 * Math.sin(k * 1.7 + sd); gx.moveTo(a[0], a[1] + d); for (let f = 0; f <= 1.0001; f += 0.05) gx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + d + 1.2 * Math.sin(f * 26 + k)); }
      gx.stroke();
      // 뿌리·돌멩이
      for (let i = 0; i < 26; i++){ const f = hash(i * 9 + sd + seed), x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + 6 + hash(i * 5 + sd) * (D2 - 14); oval(x, y, 1.6 + hash(i) * 1.6, 1, E.night ? 'rgba(120,110,100,.3)' : 'rgba(210,190,160,.45)'); }
      gx.fillStyle = L.cliff[3]; gx.beginPath(); gx.moveTo(a[0], a[1] + D2);
      for (let i = 0; i <= 24; i++){ const f = i / 24, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f + D2; gx.lineTo(x, y + (i % 2 ? 4 : 10 + hash(i * 7 + sd) * 16)); }
      gx.lineTo(b[0], b[1] + D2); gx.closePath(); gx.fill();
    };
    face(lc, bc, 0, 0); face(bc, rc, 0.18, 3);
  }
  function grassIsland(E, paths, busy, o){
    const L = look(E), C = E.cols, Rw = E.rows, tc = q(0, 0, 0), rc = q(C, 0, 0), bc = q(C, Rw, 0), lc = q(0, Rw, 0), gx = G();
    cliffFaces(E, o.seed || 0);
    gx.save(); poly([tc, rc, bc, lc]); gx.clip();
    R(lc[0], tc[1], rc[0] - lc[0], bc[1] - tc[1], vgrad(tc[1], bc[1], L.snow));
    const lite = new Path2D(), dark = new Path2D(), K2 = K.diamond;
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){ if (paths.has(u + ',' + v)) continue; const h = h2(u, v); if (h < 0.26) K2(lite, u, v, 0.03); else if (h > 0.76) K2(dark, u, v, 0.03); }
    gx.fillStyle = L.snowHi; gx.fill(lite); gx.fillStyle = L.snowLo; gx.fill(dark);
    const tufts = new Path2D(), flowers = [];
    for (let u = 0; u < C; u++) for (let v = 0; v < Rw; v++){
      if (paths.has(u + ',' + v) || busy(u, v)) continue; const d = h2(u * 3 + 1, v * 7 + 2); if (d >= 0.42) continue;
      const p = q(u + 0.25 + h2(u, v + 3) * 0.5, v + 0.25 + h2(u + 3, v) * 0.5, 0);
      if (d < 0.25){ for (let j = -2; j <= 2; j++){ tufts.moveTo(p[0] + j, p[1]); tufts.lineTo(p[0] + j * 2.2, p[1] - 4 - (2 - Math.abs(j)) * 1.5); } }
      else if (d < 0.33) flowers.push([p[0], p[1], o.flowers[Math.floor(h2(u, v + 9) * o.flowers.length)]]);
      else if (o.puddles && d < 0.36){ oval(p[0], p[1], 9, 3, E.night ? 'rgba(60,80,120,.45)' : 'rgba(150,200,235,.7)'); oval(p[0] - 2, p[1] - 0.6, 4, 0.8, 'rgba(255,255,255,.5)'); }
      else { oval(p[0], p[1], 2, 1.1, tone(E, '#8a7a5a')); oval(p[0] + 3, p[1] + 1, 1.2, 0.7, tone(E, '#a09070')); }
    }
    gx.strokeStyle = tone(E, o.tuft || '#4f7a34'); gx.lineWidth = 0.7; gx.lineCap = 'round'; gx.stroke(tufts);
    flowers.forEach(([x, y, c]) => { line([x, y], [x, y - 3], tone(E, '#4a7a34'), 0.5); oval(x, y - 3.4, 1.3, 1.1, tone(E, c)); oval(x, y - 3.5, 0.45, 0.45, '#fff6c0'); });
    K.stones(E, paths);
    gx.restore();
    // 풀 턱 — 가장자리로 풀이 늘어진다
    const lip = (a, b, sd) => { gx.fillStyle = L.snow[1]; gx.beginPath(); gx.moveTo(a[0], a[1] - 1); K.along(a, b, 44, (x, y, i) => gx.lineTo(x, y + 2.5 + 2 * Math.abs(Math.sin(i * 1.3 + sd)) + (i % 5 === 2 ? 4 : 0))); gx.lineTo(b[0], b[1] - 1); gx.closePath(); gx.fill(); };
    lip(lc, bc, 0); lip(bc, rc, 4);
  }
  // ================= 나무·바위 =================
  // 잣나무(고페르 나무, 창세기 6:14) — 불꽃처럼 곧게 솟은 짙은 사이프러스
  function gopher(E, x, y, s, sd){
    const L = look(E), gx = G(); s *= 0.9;
    oval(x + 5 * s, y + 1, 12 * s, 4 * s, L.shadow);
    R(x - 1.6 * s, y - 8 * s, 3.2 * s, 9 * s, tone(E, '#6a4a30'));
    const h = (58 + hash(sd) * 16) * s, w = 9 * s;
    const body = []; for (let i = 0; i <= 12; i++){ const f = i / 12, r = w * Math.sin(Math.pow(f, 0.7) * Math.PI) * (1 - f * 0.25); body.push([x - r + Math.sin(f * 9 + sd) * 0.6, y - 6 * s - h * (1 - f)]); }
    const right = body.map(([bx, by]) => [2 * x - bx, by]).reverse();
    poly(body.concat(right), vgrad(y - h, y, [tone(E, '#3a6a3e'), tone(E, '#1e3e26')]), true);
    gx.save(); poly(body.concat(right)); gx.clip();
    for (let i = 0; i < 14; i++){ const yy = y - 8 * s - hash(sd * 3 + i) * h * 0.9, xx = x - w * 0.8 + hash(sd * 7 + i) * w * 1.2; oval(xx, yy, 3 * s, 1.6 * s, tone(E, i % 2 ? '#4f8a4e' : '#2c5434')); }
    R(x, y - h, w * 1.5, h, 'rgba(0,20,10,.18)');
    gx.restore();
  }
  // 백향목 — 층층이 펼친 넓은 가지
  function cedar(E, x, y, s, sd){
    const L = look(E); s *= 0.85;
    oval(x + 6 * s, y + 1, 20 * s, 6 * s, L.shadow);
    poly([[x - 3 * s, y], [x + 3 * s, y], [x + 2 * s, y - 40 * s], [x - 2 * s, y - 40 * s]], tone(E, '#6a4a30'), true);
    for (let i = 0; i < 4; i++){ const yy = y - 18 * s - i * 11 * s, w = (26 - i * 5) * s;
      poly([[x - w, yy + 2 * s], [x - w * 0.6, yy - 5 * s], [x + w * 0.5, yy - 6 * s], [x + w, yy + 1 * s], [x + w * 0.2, yy + 4 * s]], tone(E, i % 2 ? '#3a6a40' : '#2f5a36'), true);
      poly([[x - w * 0.6, yy - 5 * s], [x + w * 0.5, yy - 6 * s], [x + w * 0.2, yy - 2 * s], [x - w * 0.4, yy - 2 * s]], tone(E, '#5a9258')); }
  }
  function freshStump(E, x, y){
    const L = look(E);
    oval(x + 2, y + 1, 9, 3, L.shadow);
    poly([[x - 4, y], [x + 4, y], [x + 3.4, y - 6], [x - 3.4, y - 6]], tone(E, '#6a4a30'), true);
    oval(x, y - 6, 3.4, 1.4, tone(E, '#e8c890')); oval(x, y - 6, 1.6, 0.6, tone(E, '#c8a070'));
    for (let i = 0; i < 6; i++) oval(x - 8 + hash(i * 3 + x) * 16, y + 1 - hash(i * 7) * 2, 1.2, 0.5, tone(E, '#e0c08a'));   // 나무 부스러기
  }
  function limestone(E, x, y, ready){
    const L = look(E), s = ready ? 1 : 0.45, c = tone(E, '#bcae94');
    oval(x + 2, y + 1.5, 14 * s, 4.5 * s, L.shadow);
    poly([[x - 13 * s, y], [x - 12 * s, y - 9 * s], [x - 4 * s, y - 14 * s], [x + 7 * s, y - 13 * s], [x + 13 * s, y - 5 * s], [x + 12 * s, y]], vgrad(y - 14 * s, y, [shade(c, 0.15), shade(c, -0.22)]), true);
    poly([[x + 1 * s, y - 13.5 * s], [x + 7 * s, y - 13 * s], [x + 13 * s, y - 5 * s], [x + 12 * s, y], [x + 3 * s, y]], 'rgba(60,40,20,.16)');
    if (ready){ oval(x - 6, y - 10, 4, 1.6, tone(E, '#6a9a4a')); oval(x - 3, y - 11, 2.6, 1.2, tone(E, '#8aba5a')); }   // 이끼
  }
  function shrub(E, x, y, ready, sd, berry){
    const L = look(E), Bs = [[-6, -6, 8], [5, -7, 8], [0, -11, 8]];
    oval(x + 2, y + 1, 14, 4.5, L.shadow);
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2] + 0.8, b[2] * 0.85 + 0.8, INK));
    Bs.forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.85, tone(E, '#4f7a3a')));
    [[-8, -9, 4], [3, -11, 4], [-2, -15, 4]].forEach(b => oval(x + b[0], y + b[1], b[2], b[2] * 0.5, tone(E, '#7aa856')));
    if (ready) for (let i = 0; i < 7; i++){ const bx = x - 9 + hash(sd * 7 + i) * 18, by = y - 3 - hash(sd * 3 + i) * 8; oval(bx, by, 1.5, 1.6, tone(E, berry)); oval(bx - 0.4, by - 0.5, 0.5, 0.5, 'rgba(255,255,255,.7)'); }
  }
  function strawPile(E, x, y, ready){
    const L = look(E);
    oval(x + 2, y + 1, 13, 4, L.shadow);
    if (!ready){ oval(x, y - 1, 8, 2.6, tone(E, '#c8b070')); return; }
    oval(x, y - 4, 11, 6, tone(E, '#d8c080')); oval(x - 2, y - 7, 8, 4, tone(E, '#e8d498'));
    for (let i = 0; i < 9; i++){ const a = hash(i * 3) * Math.PI; line([x - 8 + i * 2, y - 2], [x - 8 + i * 2 + Math.cos(a) * 3, y - 6 - Math.sin(a) * 3], tone(E, '#b89a50'), 0.5); }
  }
  function arkNode(E, kind, x, y, ready, seed){
    if (kind === 'tree'){ if (!ready) return freshStump(E, x, y); return hash(seed * 7 + 1) < 0.7 ? gopher(E, x, y, 0.95 + hash(seed) * 0.25, seed) : cedar(E, x, y, 0.9 + hash(seed) * 0.2, seed); }
    if (kind === 'rock') return limestone(E, x, y, ready);
    if (kind === 'snow') return strawPile(E, x, y, ready);
    return shrub(E, x, y, ready, seed, '#7a3a9a');
  }
  // 비 — 방주를 거의 다 지으면(8단계부터) 보슬비, 다 지으면 굵어진다
  function arkWeather(E){
    const s = storm(E), gx = G(); if (STILL) return;
    // 비 오기 전의 습한 안개 — 섬 위로 옅게 흘러간다
    for (let i = 0; i < 5; i++){ const y = E.h * (0.25 + i * 0.13), x = ((E.t * (6 + i * 2) + hash(i) * E.w) % (E.w + 400)) - 200; oval(x, y, 180, 16, E.night ? 'rgba(80,90,110,.08)' : 'rgba(225,230,235,' + (0.08 + s * 0.06).toFixed(2) + ')'); }
    if (s < 0.82) return;
    const n = Math.round((s - 0.78) * 300), t = E.t;
    gx.strokeStyle = E.night ? 'rgba(170,190,230,.35)' : 'rgba(220,230,245,.55)'; gx.lineWidth = 0.6; gx.beginPath();
    for (let i = 0; i < n; i++){ const x = ((hash(i * 3 + 1) * E.w - t * 40) % E.w + E.w) % E.w, y = ((hash(i * 7 + 2) * E.h + t * 240 * (0.7 + hash(i) * 0.6)) % E.h + E.h) % E.h; gx.moveTo(x, y); gx.lineTo(x - 2.2, y + 9); }
    gx.stroke();
  }
  // 역청 덩어리 — 까맣게 반들거리는 덩이, 작은 공기 방울이 올라온다(낮에 줍는 것)
  function pitchLump(E, x, y, t){
    oval(x + 1, y + 0.6, 6.5, 2, 'rgba(20,20,10,.3)');
    const gx = G(); gx.beginPath(); gx.moveTo(x - 6, y); gx.quadraticCurveTo(x - 6, y - 5, x - 1, y - 6); gx.quadraticCurveTo(x + 6, y - 6.5, x + 6, y - 1); gx.quadraticCurveTo(x + 5, y + 1.4, x, y + 1.2); gx.quadraticCurveTo(x - 5, y + 1.2, x - 6, y); gx.closePath();
    gx.fillStyle = lin(x - 6, y - 6, x + 6, y + 1, ['#5a4a3e', '#241c18', '#120e0c']); gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.5; gx.stroke();
    oval(x - 2.4, y - 4, 2.2, 0.9, 'rgba(255,255,255,.45)');
    const k = STILL ? 0.5 : (t * 0.7 + x * 0.01) % 1;
    oval(x + 2, y - 5 - k * 4, 0.9 + k * 0.6, 0.9 + k * 0.6, 'rgba(90,80,70,' + (0.8 * (1 - k)).toFixed(2) + ')');
    const s = Math.pow(Math.max(0, Math.sin(t * 2.1 + x * 0.3)), 3) * 2.4;
    if (s > 0.3){ gx.fillStyle = 'rgba(255,255,240,.9)'; gx.beginPath(); gx.moveTo(x - 1, y - 7 - s); gx.lineTo(x - 0.6, y - 7); gx.lineTo(x - 1, y - 7 + s); gx.lineTo(x - 1.4, y - 7); gx.closePath(); gx.fill(); }
  }
  // 올리브 — 은빛 잎 두 장과 열매 셋(무지개 농장에서 줍는 것)
  function oliveSprig(E, x, y, t){
    oval(x + 1, y + 0.6, 6, 1.8, 'rgba(30,50,20,.25)');
    const gx = G(), lf = (a, c) => { gx.save(); gx.translate(x, y - 3); gx.rotate(a); gx.beginPath(); gx.ellipse(4, 0, 4.4, 1.4, 0, 0, TAU); gx.fillStyle = c; gx.fill(); gx.strokeStyle = INK; gx.lineWidth = 0.4; gx.stroke(); gx.restore(); };
    line([x - 4, y - 1], [x + 3, y - 5], '#6a5030', 0.7);
    lf(-0.5, '#9ab88a'); lf(-2.4, '#7a9a6a'); lf(0.4, '#b0c8a0');
    [[-1, -2], [1.4, -1.2], [0.2, 0]].forEach(([a, b]) => { ovI(x + a, y + b, 1.6, 1.3, '#4a5a2a'); oval(x + a - 0.4, y + b - 0.4, 0.4, 0.4, 'rgba(255,255,255,.6)'); });
    const s = Math.pow(Math.max(0, Math.sin(t * 2.3 + x * 0.3)), 3) * 2.4;
    if (s > 0.3){ gx.fillStyle = 'rgba(255,255,240,.9)'; gx.beginPath(); gx.moveTo(x + 4, y - 9 - s); gx.lineTo(x + 4.4, y - 9); gx.lineTo(x + 4, y - 9 + s); gx.lineTo(x + 3.6, y - 9); gx.closePath(); gx.fill(); }
  }

  // ================= 방주 =================
  /* 방주 터 b(18×7 칸) 안에 길이 방향을 u 로 눕힌 배. 창세기 6:15 의 300:50:30 을 아이 그림에 맞게 눌렀다.
     배 옆모습: hw(u) 너비가 끝으로 갈수록 좁고, 바닥(zb)은 끝이 들리고(rocker), 뱃전(zt)은 끝이 조금 높다(sheer).
     A.step = 다 지은 단계 수(0~10), A.k = 막 지은 단계가 지어지는 중이면 0→1(연출), 아니면 1 */
  function hullOf(b){ const uA = b.x + 1.2, uB = b.x + b.w - 1.0; return { uA, uB, L: uB - uA, vc: b.y + 3.3, Wh: 2.0, H: 50 }; }
  const eOf = (Hl, u) => Math.min(1, Math.abs(2 * (u - Hl.uA) / Hl.L - 1));
  const hw = (Hl, u) => Hl.Wh * (1 - 0.45 * Math.pow(eOf(Hl, u), 4));
  const zb = (Hl, u) => 3 + 13 * Math.pow(eOf(Hl, u), 3);
  const zt = (Hl, u) => Hl.H + 7 * Math.pow(eOf(Hl, u), 3);
  const WOOD = '#c99862', WOOD_DK = '#9a6a3e', RIB = '#b07a48', PITCH = '#3b2e28', PITCH_HI = '#6a5848';
  // 배 옆면 한 띠 — sgn +1 = 앞(보이는) 면, -1 = 뒤 면(안쪽에서 보인다). z 는 아래·위 비율(0 = 바닥, 1 = 뱃전)
  function hullBand(Hl, sgn, f0, f1, u0, u1, fill, ink){
    const n = 40, top = [], bot = [];
    for (let i = 0; i <= n; i++){ const u = u0 + (u1 - u0) * i / n, v = Hl.vc + sgn * hw(Hl, u), a = zb(Hl, u), c = zt(Hl, u); top.push(q(u, v, a + (c - a) * f1)); bot.push(q(u, v, a + (c - a) * f0)); }
    poly(top.concat(bot.reverse()), fill, ink);
  }
  // 뱃전을 따라 그은 줄 — 판자 이음매
  function hullLine(Hl, sgn, f, u0, u1, c, w){
    const gx = G(); gx.strokeStyle = c; gx.lineWidth = w; gx.beginPath();
    for (let i = 0; i <= 40; i++){ const u = u0 + (u1 - u0) * i / 40, v = Hl.vc + sgn * hw(Hl, u), a = zb(Hl, u), p = q(u, v, a + (zt(Hl, u) - a) * f); if (i) gx.lineTo(p[0], p[1]); else gx.moveTo(p[0], p[1]); }
    gx.stroke();
  }
  // 이물(오른쪽 앞 끝, u = uB) — 좁은 끝판
  function bowFace(Hl, f1, col){
    const u = Hl.uB, h = hw(Hl, u), a = zb(Hl, u), c = a + (zt(Hl, u) - a) * f1;
    poly([q(u, Hl.vc + h, a), q(u, Hl.vc - h, a), q(u, Hl.vc - h, c), q(u, Hl.vc + h, c)], col, true);
  }
  function rib(E, Hl, u, half, f){
    const h = hw(Hl, u), a = zb(Hl, u), c = a + (zt(Hl, u) - a) * f, gx = G();
    const pts = half < 0 ? [[-1, c], [-0.85, a + 8], [-0.45, a + 2], [0, a]] : [[0, a], [0.45, a + 2], [0.85, a + 8], [1, c]];
    gx.lineCap = 'round'; gx.lineJoin = 'round';
    [[INK, 2.6], [tone(E, RIB), 1.6]].forEach(([col, w]) => { gx.strokeStyle = col; gx.lineWidth = w; gx.beginPath(); pts.forEach(([k, z], i) => { const p = q(u, Hl.vc + k * h, z); if (i) gx.lineTo(p[0], p[1]); else gx.moveTo(p[0], p[1]); }); gx.stroke(); });
  }
  const NRIB = 15;
  const ribU = (Hl, i) => Hl.uA + Hl.L * (i + 0.5) / NRIB;
  function scaffold(E, Hl, upto){
    const v = Hl.vc + Hl.Wh + 0.55, col = tone(E, '#a07a4a'), gx = G();
    for (let i = 0; i <= 7; i++){ const u = Hl.uA + 0.4 + i * (Hl.L - 0.8) / 7, a = q(u, v, 0), b2 = q(u, v, upto); line(a, b2, INK, 2); line(a, b2, col, 1.2); }
    [14, 28, 42].filter(z => z < upto).forEach(z => { const a = q(Hl.uA + 0.2, v, z), b2 = q(Hl.uB - 0.2, v, z); line(a, b2, INK, 2.4); line(a, b2, tone(E, '#c8a070'), 1.5); });
    // 사다리
    const u = Hl.uA + Hl.L * 0.18, l0 = q(u, v + 0.3, 0), l1 = q(u + 0.5, v - 0.1, Math.min(upto, 30)), l2 = q(u + 0.4, v + 0.3, 0), l3 = q(u + 0.9, v - 0.1, Math.min(upto, 30));
    line(l0, l1, col, 0.9); line(l2, l3, col, 0.9);
    for (let k = 1; k < 8; k++){ const f = k / 8; line([l0[0] + (l1[0] - l0[0]) * f, l0[1] + (l1[1] - l0[1]) * f], [l2[0] + (l3[0] - l2[0]) * f, l2[1] + (l3[1] - l2[1]) * f], col, 0.7); }
    if (E.night){ const p = q(Hl.uA + Hl.L * 0.5, v, 30); oval(p[0], p[1] - 3, 1.6, 2.2, '#ffcf7a'); E.lamp(p[0], p[1] - 3, 30, '#ffb860'); }
    gx.lineCap = 'round';
  }
  // 나무 더미 — 잘라 둔 통나무와 판자
  function lumber(E, u, v){
    const c = tone(E, '#8a6040');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++){ const p = q(u + j * 0.32 + i * 0.16, v, 2.6 + i * 4.4); ovI(p[0], p[1], 2.4, 2.2, tone(E, '#d8b080')); oval(p[0], p[1], 1, 0.9, tone(E, '#b88a58')); }
    box(u - 0.1, v - 0.7, u + 1.3, v - 0.1, 0, 2.6, c, { top: tone(E, '#c89a62') });
  }
  function arkThing(E, b){
    const A = arkOf(E), st = A.step, k = A.k == null ? 1 : A.k, Hl = hullOf(b), gx = G(), L = look(E);
    // 단계 i(0 터 다지기 … 9 양식 싣기)를 얼마나 그리나 — 앞 단계는 다(1), 막 지은 단계(st = i + 1)는 k 만큼, 뒤 단계는 0
    const part = i => st > i + 1 ? 1 : st === i + 1 ? k : 0;
    const pitched = part(6), wood = tone(E, WOOD), woodDk = tone(E, WOOD_DK), pc = tone(E, PITCH);
    // 0 — 빈 터: 말뚝과 노끈, 방주 팻말, 통나무 더미
    if (part(0) < 1){
      const a = 1 - part(0);
      gx.save(); gx.globalAlpha = Math.max(0.15, a);
      const c0 = [[Hl.uA - 0.3, Hl.vc - Hl.Wh - 0.2], [Hl.uB + 0.3, Hl.vc - Hl.Wh - 0.2], [Hl.uB + 0.3, Hl.vc + Hl.Wh + 0.2], [Hl.uA - 0.3, Hl.vc + Hl.Wh + 0.2]];
      K.poly3(c0.map(p => [p[0], p[1], 0]), 'rgba(150,120,70,.28)');                       // 풀을 걷어 낸 자리
      // 배 모양으로 박은 말뚝과 노끈 — 「여기에 방주가 선다」
      const pegs = []; for (let i = 0; i <= 16; i++){ const u = Hl.uA + Hl.L * i / 16; pegs.push([u, Hl.vc + hw(Hl, u)]); } for (let i = 16; i >= 0; i--){ const u = Hl.uA + Hl.L * i / 16; pegs.push([u, Hl.vc - hw(Hl, u)]); }
      gx.strokeStyle = tone(E, '#fff4cc'); gx.lineWidth = 1.1; gx.setLineDash([3, 2]); gx.beginPath(); pegs.forEach((p, i) => { const s2 = q(p[0], p[1], 4); if (i) gx.lineTo(s2[0], s2[1]); else gx.moveTo(s2[0], s2[1]); }); gx.closePath(); gx.stroke(); gx.setLineDash([]);
      pegs.forEach((p, i) => { if (i % 2) return; const a0 = q(p[0], p[1], 0), a1 = q(p[0], p[1], 7); line(a0, a1, INK, 2.2); line(a0, a1, tone(E, '#c09060'), 1.3); });
      // 팻말 「방주 터」
      const sp = q(Hl.uA + Hl.L * 0.5, Hl.vc + Hl.Wh + 1.2, 0), sp1 = [sp[0], sp[1] - 16];
      line(sp, sp1, INK, 2.2); line(sp, sp1, tone(E, '#8a6040'), 1.3);
      poly([[sp1[0] - 13, sp1[1] - 9], [sp1[0] + 13, sp1[1] - 9], [sp1[0] + 13, sp1[1] + 1], [sp1[0] - 13, sp1[1] + 1]], tone(E, '#e8c890'), true);
      gx.fillStyle = tone(E, '#5a3a20'); gx.font = '700 6px sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText('방주 터', sp1[0], sp1[1] - 3.8);
      gx.restore();
    }
    // 1 — 터 다지기: 다진 흙과 받침돌 줄
    const p1 = part(0);
    if (p1 > 0){
      gx.save(); gx.globalAlpha = Math.min(1, p1 * 1.6);
      K.poly3([[Hl.uA - 0.6, Hl.vc - Hl.Wh - 0.4, 0], [Hl.uB + 0.6, Hl.vc - Hl.Wh - 0.4, 0], [Hl.uB + 0.6, Hl.vc + Hl.Wh + 0.9, 0], [Hl.uA - 0.6, Hl.vc + Hl.Wh + 0.9, 0]], tone(E, '#b89a6a'));
      for (let i = 0; i < 40; i++){ const p = q(Hl.uA - 0.4 + hash(i * 3 + b.x) * (Hl.L + 0.8), Hl.vc - Hl.Wh + hash(i * 7) * (Hl.Wh * 2 + 0.9), 0); oval(p[0], p[1], 2, 0.6, 'rgba(120,90,50,.25)'); }
      gx.restore();
      const n = 9, show = Math.ceil(n * Math.min(1, p1));
      for (let i = 0; i < show; i++){ const u = Hl.uA + 0.4 + i * (Hl.L - 0.8) / (n - 1), lift = i === show - 1 && p1 < 1 ? (1 - (p1 * n - i)) * 10 : 0; box(u - 0.35, Hl.vc - 0.45, u + 0.35, Hl.vc + 0.45, lift, lift + Math.max(3, zb(Hl, u) - 1), tone(E, '#a8a090'), { top: tone(E, '#c8c0b0') }); }
    }
    // 뒤 판자(안쪽 면) — 앞 판자 높이만큼(안이 들여다보인다)
    const plank = (part(3) + part(4) + part(5)) / 3;
    const roofed = part(7);
    if (plank > 0 && roofed < 1){ hullBand(Hl, -1, 0, plank, Hl.uA, Hl.uB, tone(E, shade(pitched >= 1 ? PITCH : WOOD, -0.32)), true); }
    // 2 — 용골
    const p2 = part(1);
    if (p2 > 0){
      const u1 = Hl.uA + Hl.L * p2, n = 30, top = [], bot = [];
      for (let i = 0; i <= n; i++){ const u = Hl.uA + (u1 - Hl.uA) * i / n; top.push(q(u, Hl.vc + 0.22, zb(Hl, u) + 3.6)); bot.push(q(u, Hl.vc + 0.22, zb(Hl, u) - 0.6)); }
      poly(top.concat(bot.reverse()), vgrad(top[0][1] - 4, top[0][1] + 4, [tone(E, '#d8a870'), tone(E, '#8a5a34')]), true);
      if (p2 >= 1){ [Hl.uA, Hl.uB].forEach(u => { const a = q(u, Hl.vc, zb(Hl, u)), c = q(u, Hl.vc, zt(Hl, u) + 4); line(a, c, INK, 3); line(a, c, tone(E, RIB), 2); }); }   // 이물·고물 기둥
    }
    // 3 — 갈빗대(뒤 반쪽), 4~6 층 바닥
    const p3 = part(2), nr = p3 >= 1 ? NRIB : Math.ceil(NRIB * p3);
    if (roofed < 1) for (let i = 0; i < nr; i++) rib(E, Hl, ribU(Hl, i), -1, 1);
    if (roofed < 1) [1 / 3, 2 / 3].forEach((f, j) => {
      if (plank < f) return;
      const n = 30, fr = [], bk = [];
      for (let i = 0; i <= n; i++){ const u = Hl.uA + 0.2 + (Hl.L - 0.4) * i / n, a = zb(Hl, u), z = a + (zt(Hl, u) - a) * f, h = hw(Hl, u) * 0.96; fr.push(q(u, Hl.vc + h, z)); bk.push(q(u, Hl.vc - h, z)); }
      poly(fr.concat(bk.reverse()), tone(E, j ? '#b88a58' : '#a87a4a'), true);
      // 가운데층 — 동물 칸 칸막이(5단계)
      if (j === 0 && st >= 5) for (let i = 1; i < 9; i++){ const u = Hl.uA + Hl.L * i / 9, a = zb(Hl, u), z = a + (zt(Hl, u) - a) * f, h = hw(Hl, u) * 0.9; poly([q(u, Hl.vc - h, z), q(u, Hl.vc + h * 0.2, z), q(u, Hl.vc + h * 0.2, z + 6), q(u, Hl.vc - h, z + 6)], tone(E, '#c89a62'), 0.4); }
    });
    if (roofed < 1) for (let i = 0; i < nr; i++){ const u = ribU(Hl, i); rib(E, Hl, u, 1, Math.max(plank, 1)); }
    // 4~6 — 앞 판자. 7 — 역청이 이물 쪽에서 고물 쪽으로 번진다
    if (plank > 0){
      hullBand(Hl, 1, 0, plank, Hl.uA, Hl.uB, vgrad(q(Hl.uA, Hl.vc, Hl.H)[1] - 10, q(Hl.uA, Hl.vc, 0)[1] + 20, [shade(wood, 0.08), woodDk]), true);
      if (pitched > 0){ const u1 = Hl.uA + Hl.L * pitched; hullBand(Hl, 1, 0, plank, Hl.uA, u1, vgrad(q(Hl.uA, Hl.vc, Hl.H)[1] - 10, q(Hl.uA, Hl.vc, 0)[1] + 20, [tone(E, PITCH_HI), pc]), true);
        if (pitched < 1){ const p = q(u1, Hl.vc + hw(Hl, u1), (zb(Hl, u1) + zt(Hl, u1) * plank) / 2); oval(p[0], p[1], 2.2, 6, tone(E, '#241c18')); } }
      for (let j = 1; j < 12; j++){ const f = j / 12; if (f < plank) hullLine(Hl, 1, f, Hl.uA, Hl.uB, pitched >= 1 ? 'rgba(255,240,220,.13)' : 'rgba(80,40,10,.32)', 0.5); }
      for (let i = 0; i < 26; i++){ const u = Hl.uA + Hl.L * hash(i * 5 + 3), f = Math.floor(hash(i * 9) * 11) / 12; if (f + 1 / 12 > plank) continue; const v = Hl.vc + hw(Hl, u), a = zb(Hl, u), c = zt(Hl, u); line(q(u, v, a + (c - a) * f), q(u, v, a + (c - a) * (f + 1 / 12)), 'rgba(60,30,10,.3)', 0.5); }
      bowFace(Hl, plank, tone(E, shade(pitched >= 1 ? PITCH : WOOD, -0.18)));
      if (pitched >= 1) hullLine(Hl, 1, plank * 0.97, Hl.uA, Hl.uB, 'rgba(255,240,220,.3)', 0.8);   // 역청 반들거림
    }
    // 8 — 갑판·지붕집·한 규빗 창(창세기 6:16). 이물 쪽에서부터 덮어 간다
    if (roofed > 0){
      const n = 30, fr = [], bk = [];
      for (let i = 0; i <= n; i++){ const u = Hl.uA + Hl.L * i / n; fr.push(q(u, Hl.vc + hw(Hl, u), zt(Hl, u))); bk.push(q(u, Hl.vc - hw(Hl, u), zt(Hl, u))); }
      poly(fr.concat(bk.slice().reverse()), tone(E, '#8a6a4a'), true);
      const h0 = Hl.uA + Hl.L * 0.14, h1 = h0 + (Hl.L * 0.72) * roofed, v0 = Hl.vc - Hl.Wh * 0.6, v1 = Hl.vc + Hl.Wh * 0.6, z0 = Hl.H + 1, z1 = Hl.H + 17;
      box(h0, v0, h1, v1, z0, z1 - 5, wood);                                  // 지붕집은 밝은 잣나무 판자
      // 창 — 지붕 바로 아래 한 줄로 트인 틈, 기둥이 받친다
      K.poly3([[h0, v1, z1 - 5], [h1, v1, z1 - 5], [h1, v1, z1], [h0, v1, z1]], E.night ? '#ffd98a' : tone(E, '#2a2420'));
      K.poly3([[h1, v1, z1 - 5], [h1, v0, z1 - 5], [h1, v0, z1], [h1, v1, z1]], E.night ? '#e8b860' : tone(E, '#1a1614'));
      for (let i = 0; i <= 12; i++){ const u = h0 + (h1 - h0) * i / 12; line(q(u, v1, z1 - 5), q(u, v1, z1), tone(E, '#7a5a3a'), 1); }
      for (let j = 1; j < 3; j++) line(q(h0, v1, z0 + j * 4), q(h1, v1, z0 + j * 4), 'rgba(90,50,20,.35)', 0.5);   // 판자 이음
      if (E.night) for (let i = 1; i < 6; i++){ const p = q(h0 + (h1 - h0) * i / 6, v1, z1 - 1.5); E.lamp(p[0], p[1], 20, '#ffcf7a'); }
      roof(E, { u0: h0, v0, u1: h1, v1, H: z1 }, { ridge: 'u', rise: 14, col: '#a0482c', gable: '#c99862', eave: 0.35, snow: false });   // 붉은 너와 지붕
    }
    // 9 — 옆문과 오르막 다리. 다리가 천천히 내려온다
    const p9 = part(8);
    if (p9 > 0){
      const du = Hl.uA + Hl.L * 0.42, dw = 1.5, dv = Hl.vc + hw(Hl, du + dw / 2), dz = zb(Hl, du) + (zt(Hl, du) - zb(Hl, du)) * 0.34, dh = 15;
      K.poly3([[du - 0.08, dv + 0.02, dz - 1], [du + dw + 0.08, dv + 0.02, dz - 1], [du + dw + 0.08, dv + 0.02, dz + dh + 1.4], [du - 0.08, dv + 0.02, dz + dh + 1.4]], tone(E, '#2a201a'), true);
      K.poly3([[du, dv + 0.03, dz], [du + dw, dv + 0.03, dz], [du + dw, dv + 0.03, dz + dh], [du, dv + 0.03, dz + dh]], E.night ? '#ffcf7a' : tone(E, '#1e1814'));
      if (E.night){ const p = q(du + dw / 2, dv, dz + dh / 2); E.lamp(p[0], p[1], 36, '#ffcf7a'); }
      const ang = p9, endV = dv + 0.1 + 2.3 * ang, endZ = dz * (1 - ang);
      K.poly3([[du, dv + 0.05, dz], [du + dw, dv + 0.05, dz], [du + dw, endV, endZ], [du, endV, endZ]], tone(E, '#b08458'), true);
      for (let i = 1; i < 8; i++){ const f = i / 8; line(q(du, dv + (endV - dv) * f, dz + (endZ - dz) * f), q(du + dw, dv + (endV - dv) * f, dz + (endZ - dz) * f), tone(E, '#7a5434'), 0.6); }
    }
    // 10 — 양식과 깃발: 곡식 자루·항아리가 문 앞에 쌓이고 지붕 끝에 깃발
    const p10 = part(9);
    if (p10 > 0){
      const du = Hl.uA + Hl.L * 0.42, v = Hl.vc + Hl.Wh + 2.6, items = [[-1.6, 0.1, 's'], [-1.1, 0.5, 'j'], [-0.5, 0.2, 's'], [2.2, 0.3, 'j'], [2.7, 0.0, 's'], [3.2, 0.5, 's'], [-1.4, -0.4, 'j'], [2.9, -0.4, 'j']];
      items.slice(0, Math.ceil(items.length * p10)).forEach(([a, c, kd], i) => {
        const p = q(du + a, v + c, 0);
        if (kd === 's'){ ovI(p[0], p[1] - 4, 4.4, 4.6, tone(E, i % 2 ? '#d8c08a' : '#c8aa70')); line([p[0] - 1.6, p[1] - 8.4], [p[0] + 1.6, p[1] - 8.4], tone(E, '#7a5a30'), 0.8); }
        else { ovI(p[0], p[1] - 4.4, 3.4, 4.6, tone(E, '#c06a3a')); oval(p[0], p[1] - 8.8, 2, 0.8, tone(E, '#8a4a2a')); line([p[0] - 3, p[1] - 4], [p[0] + 3, p[1] - 4], 'rgba(255,230,190,.5)', 0.5); }
      });
      if (p10 >= 1) [Hl.uA + 0.6, Hl.uB - 0.6].forEach((u, i) => { const a = q(u, Hl.vc, zt(Hl, u)), c = q(u, Hl.vc, zt(Hl, u) + 22); line(a, c, INK, 1.4); line(a, c, tone(E, '#8a6a4a'), 0.8);
        const w = 10, t = STILL ? 0 : E.t; const fl = [[c[0], c[1]], [c[0] + w, c[1] + 2 + Math.sin(t * 3 + i) * 1.4], [c[0] + w * 0.8, c[1] + 4.4], [c[0] + w, c[1] + 7 + Math.sin(t * 3 + 1 + i) * 1.4], [c[0], c[1] + 6]]; poly(fl, tone(E, i ? '#3f6ea0' : '#e8b040'), true); });
    }
    // 짓는 동안 — 비계, 나무 더미, 역청 솥
    if (st >= 1 && st <= 8) scaffold(E, Hl, Math.min(48, 10 + plank * 40 + (st >= 3 ? 10 : 0)));
    if (st <= 8) lumber(E, b.x + 0.4, b.y + b.h - 0.6);
    if (st >= 6 && st <= 7){ const p = q(b.x + b.w - 1.4, b.y + b.h - 0.8, 0); ovI(p[0], p[1] - 4, 5, 3.6, tone(E, '#2a2420')); oval(p[0], p[1] - 7, 4.2, 1.2, '#140e0c'); if (!STILL) for (let i = 0; i < 3; i++){ const kk = (E.t * 0.4 + i / 3) % 1; oval(p[0] + Math.sin(kk * 6 + i) * 2, p[1] - 9 - kk * 12, 2 + kk * 3, 1.4 + kk * 2, 'rgba(120,120,120,' + (0.4 * (1 - kk)).toFixed(2) + ')'); } }
    if (L.dry && st >= 10 && E.night){ const p = q(Hl.uA + Hl.L * 0.42, Hl.vc + Hl.Wh + 2, 0); E.lamp(p[0], p[1], 44, '#ffcf7a'); }
  }
  // 짓는 중 연출(매 장) — 막 지은 단계가 올라가는 동안 흙먼지와 망치 불꽃
  function arkLive(E, b){
    const A = arkOf(E); if (A.k >= 1 || STILL) return;
    const Hl = hullOf(b), t = E.t, k = A.k;
    const u = Hl.uA + Hl.L * (A.step === 2 || A.step === 7 || A.step === 8 ? k : 0.2 + 0.6 * hash(Math.floor(t * 3))), p = q(u, Hl.vc + Hl.Wh, 18 + 10 * Math.sin(t * 3));
    for (let i = 0; i < 6; i++){ const f = (t * 0.8 + i / 6) % 1; oval(p[0] + (hash(i) - 0.5) * 30, p[1] + 20 - f * 18, 4 + f * 8, 2 + f * 4, 'rgba(210,190,150,' + (0.45 * (1 - f)).toFixed(2) + ')'); }
    const s = Math.pow(Math.max(0, Math.sin(t * 9)), 6) * 4;
    if (s > 0.5){ const gx = G(); gx.fillStyle = 'rgba(255,240,170,.95)'; gx.beginPath(); gx.moveTo(p[0], p[1] - s); gx.lineTo(p[0] + s * 0.4, p[1]); gx.lineTo(p[0], p[1] + s); gx.lineTo(p[0] - s * 0.4, p[1]); gx.closePath(); gx.fill(); }
  }

  // ================= 무지개 농장 =================
  // 작은 방주 — 아라랏 산 위에 쉬는 모습(배경)·도착 장면에 쓴다. (x, y) = 바닥 가운데, s = 크기
  function miniArk(x, y, s, col, roofc, tilt){
    const gx = G(); gx.save(); gx.translate(x, y); gx.rotate(tilt || 0); gx.scale(s, s);
    poly([[-46, -14], [46, -14], [40, -2], [30, 4], [-30, 4], [-40, -2]], col, 1);
    for (let i = 1; i < 4; i++) line([-44 + i * 1.5, -14 + i * 4.5], [44 - i * 1.5, -14 + i * 4.5], 'rgba(255,240,220,.18)', 0.6);
    poly([[-30, -14], [30, -14], [30, -22], [-30, -22]], shade(col, 0.1), 1);
    R(-28, -21, 56, 2.4, '#1a1410');
    poly([[-34, -22], [34, -22], [26, -32], [-26, -32]], roofc, 1);
    gx.restore();
  }
  function newBackdrop(E){
    const L = look(E), hy = horizon(E), t = E.t, gx = G();
    R(0, 0, E.w, hy + 2, vgrad(0, hy, L.sky));
    if (E.night){ for (let i = 0; i < 120; i++){ const x = hash(i * 7 + 1) * E.w, y = hash(i * 11 + 3) * hy * 0.9, a = 0.35 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash(i)) + i)); R(x, y, 0.8, 0.8, 'rgba(235,240,255,' + a.toFixed(2) + ')'); } const x = E.w * 0.18, y = hy * 0.28; glow(x, y, 30, 'rgba(210,225,255,', 0.35); oval(x, y, 7, 7, '#eef3ff'); }
    else { const x = E.w * 0.14, y = hy * 0.4; glow(x, y, 70, 'rgba(255,248,220,', 0.7); oval(x, y, 9, 9, '#fffbea'); }
    // 무지개(창세기 9:13) — 낮엔 또렷하게, 밤엔 달무지개처럼 옅게
    const cx = E.w * 0.44, cy = hy + 60, rr = Math.min(E.w * 0.42, 300), cols = ['#ff5a5a', '#ff9a3a', '#ffe04a', '#5ad06a', '#4aa8ff', '#5a6ae8', '#a86ae8'];
    gx.save(); gx.globalAlpha = E.night ? 0.12 : 0.55; gx.lineWidth = 5;
    cols.forEach((c, i) => { gx.strokeStyle = c; gx.beginPath(); gx.arc(cx, cy, rr - i * 5, Math.PI * 1.05, Math.PI * 1.95); gx.stroke(); });
    gx.restore();
    // 구름 몇 송이 — 비 갠 하늘
    for (let i = 0; i < 5; i++){ const w = 60 + hash(i * 5) * 60, x = ((hash(i * 13) * (E.w + w * 2) + t * (1.5 + hash(i))) % (E.w + w * 2)) - w, y = 18 + hash(i * 7) * hy * 0.4; cloudMass(x, y, w, 18, E.night ? 'rgba(40,50,80,.45)' : 'rgba(220,230,240,.85)', E.night ? 'rgba(70,80,110,.45)' : 'rgba(255,255,255,.95)', i * 11); }
    // 아라랏 산 — 두 봉우리, 눈 덮인 꼭대기. 큰 봉우리 어깨에 방주가 쉰다(창세기 8:4)
    const mx = E.w * 0.74, base = hy + 4, peak = (x0, w, h, col, snow) => { poly([[x0 - w, base], [x0 - w * 0.15, base - h], [x0, base - h - 4], [x0 + w * 0.2, base - h + 2], [x0 + w, base]], col); poly([[x0 - w * 0.3, base - h * 0.7], [x0 - w * 0.15, base - h], [x0, base - h - 4], [x0 + w * 0.2, base - h + 2], [x0 + w * 0.34, base - h * 0.66], [x0 + w * 0.1, base - h * 0.74], [x0 - w * 0.08, base - h * 0.62]], snow); };
    peak(mx - 120, 70, 70, E.night ? '#2e3a50' : '#8aa0b4', E.night ? '#7a8aa8' : '#f4f8fc');
    peak(mx, 140, 132, E.night ? '#28344a' : '#7a92a8', E.night ? '#8a9ab8' : '#ffffff');
    miniArk(mx + 40, base - 74, 0.5, E.night ? '#2a201c' : '#4a3a30', E.night ? '#3a2e28' : '#6a5040', -0.08);
    const hill = (b0, amp, f, sd, col) => { gx.beginPath(); gx.moveTo(0, b0 + 6); for (let x = 0; x <= E.w + 3; x += 3) gx.lineTo(x, b0 - amp * (0.55 + 0.45 * Math.sin(x * f + sd))); gx.lineTo(E.w, b0 + 6); gx.closePath(); gx.fillStyle = col; gx.fill(); };
    hill(hy + 3, 20, 0.012, 2.1, L.far); hill(hy + 4, 11, 0.023, 5.2, L.far2);
    R(0, hy - 20, E.w, 23, vgrad(hy - 20, hy + 3, [L.haze + '0)', L.haze + '.4)']));
    // 아래 — 아직 물이 남은 골짜기: 초록 들판 사이 물웅덩이가 하늘을 비춘다
    R(0, hy, E.w, E.h - hy, vgrad(hy, E.h, L.sea));
    for (let i = 0; i < 26; i++){ const y = hy + 6 + Math.pow(hash(i * 3 + 7), 1.3) * (E.h - hy), x = hash(i * 13 + 2) * E.w, w = 10 + hash(i) * 34, k = (y - hy) / (E.h - hy);
      oval(x, y, w, 2 + 4 * k, E.night ? 'rgba(60,90,140,.4)' : 'rgba(150,205,240,.75)'); oval(x - w * 0.3, y - 0.6, w * 0.3, 0.8, 'rgba(255,255,255,.45)'); }
    // 비둘기 한 마리가 천천히 난다
    if (!E.night){ const x = ((t * 14) % (E.w + 60)) - 30, y = hy * 0.5 + Math.sin(t * 0.8) * 10; dove(x, y, 1, t); }
  }
  function dove(x, y, s, t){
    const f = STILL ? 0.5 : Math.sin(t * 9), gx = G(); gx.save(); gx.translate(x, y); gx.scale(s, s);
    oval(0, 0, 4.2, 2, '#ffffff'); oval(3.6, -1, 1.8, 1.6, '#ffffff'); oval(4.3, -1.2, 0.35, 0.35, '#2a2a2a'); poly([[5.4, -0.9], [6.6, -0.6], [5.4, -0.3]], '#e8a040');
    poly([[-1, -0.6], [2, -0.6], [0, -5 * f - 1]], '#f0f4f8', 0.4); poly([[-4, 0], [-6.4, -1.4], [-6, 1]], '#eef2f6');
    gx.restore();
  }
  // 올리브 나무 — 꼬인 은회색 줄기, 은빛 초록 잎 덩이
  function oliveTree(E, x, y, s, sd){
    const L = look(E), gx = G(); s *= 0.85;
    oval(x + 5 * s, y + 1, 20 * s, 6 * s, L.shadow);
    gx.strokeStyle = INK; gx.lineWidth = 6 * s; gx.lineCap = 'round'; gx.beginPath(); gx.moveTo(x, y); gx.bezierCurveTo(x - 6 * s, y - 12 * s, x + 6 * s, y - 20 * s, x - 2 * s, y - 30 * s); gx.stroke();
    gx.strokeStyle = tone(E, '#8a8070'); gx.lineWidth = 4.6 * s; gx.stroke();
    gx.strokeStyle = tone(E, '#a89e8a'); gx.lineWidth = 1.2 * s; gx.beginPath(); gx.moveTo(x - 1, y - 2); gx.bezierCurveTo(x - 6 * s, y - 13 * s, x + 5 * s, y - 20 * s, x - 2.6 * s, y - 29 * s); gx.stroke();
    const Bs = [[-12, -36, 12], [9, -38, 12], [-1, -48, 13], [-4, -32, 10], [12, -30, 9], [-14, -28, 8]];
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s + 0.8, b[2] * s * 0.8 + 0.8, INK));
    Bs.forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s * 0.8, tone(E, '#6a8a5a')));
    Bs.forEach(b => oval(x + (b[0] - 3) * s, y + (b[1] - 3) * s, b[2] * s * 0.66, b[2] * s * 0.5, tone(E, '#9ab88a')));
    for (let i = 0; i < 9; i++){ const bx = x + (hash(sd * 7 + i) - 0.5) * 30 * s, by = y - (28 + hash(sd * 3 + i) * 20) * s; oval(bx, by, 1.3, 1.1, tone(E, '#3a4a22')); }
  }
  function youngPine(E, x, y, s){
    const L = look(E); s *= 0.7;
    oval(x + 3 * s, y + 1, 12 * s, 4 * s, L.shadow);
    R(x - 2 * s, y - 10 * s, 4 * s, 10 * s, tone(E, '#6a4a30'));
    for (let i = 0; i < 3; i++){ const yb = y - 8 * s - i * 14 * s, w = (20 - i * 5) * s; poly([[x, yb - 24 * s], [x + w, yb], [x - w, yb]], tone(E, i % 2 ? '#2f6a3e' : '#3a7a48'), true); poly([[x, yb - 24 * s], [x + w, yb], [x + w * 0.2, yb]], 'rgba(0,30,10,.2)'); }
  }
  function mossRock(E, x, y, ready){ limestone(E, x, y, ready); if (ready){ oval(x + 4, y - 8, 3, 1.2, tone(E, '#7ab85a')); } }
  function newNode(E, kind, x, y, ready, seed){
    if (kind === 'tree'){ if (!ready) return freshStump(E, x, y); return hash(seed * 5 + 2) < 0.6 ? oliveTree(E, x, y, 0.95 + hash(seed) * 0.2, seed) : youngPine(E, x, y, 1 + hash(seed) * 0.3); }
    if (kind === 'rock') return mossRock(E, x, y, ready);
    if (kind === 'snow') return strawPile(E, x, y, ready);
    return shrub(E, x, y, ready, seed, '#f4f0ff');
  }
  // 무지개 농장 날씨 — 젖은 땅에 반짝이는 물방울, 낮엔 나비 둘
  function newWeather(E){
    if (STILL) return;
    for (let i = 0; i < 26; i++){ const p = q(hash(i * 7 + 2) * E.cols, hash(i * 3 + 8) * E.rows, 0), a = Math.max(0, Math.sin(E.t * (1 + hash(i) * 2) + i * 2.3)); if (a > 0.75) R(p[0], p[1], 1, 1, 'rgba(255,255,255,' + ((a - 0.75) * 3.6).toFixed(2) + ')'); }
    if (!E.night) for (let i = 0; i < 2; i++){ const u = E.cols * (0.3 + 0.4 * hash(i)) + Math.sin(E.t * 0.3 + i * 3) * 4, v = E.rows * (0.4 + 0.3 * hash(i + 5)) + Math.cos(E.t * 0.27 + i) * 3, p = q(u, v, 22 + Math.sin(E.t * 2 + i) * 4), f = Math.abs(Math.sin(E.t * 10 + i)); oval(p[0] - 1.6 * f, p[1], 1.6 * f, 1.4, i ? '#ffcf3a' : '#ff8fb8'); oval(p[0] + 1.6 * f, p[1], 1.6 * f, 1.4, i ? '#ffcf3a' : '#ff8fb8'); }
  }
  // 무지개 농장 바닥 — 연못(맑은 물, 수련), 목장(풀)
  const greenFloor = {
    pond: (E, b) => {
      const cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), r1 = q(b.x + b.w - 0.2, cv, 0), r2 = q(cu, b.y + b.h - 0.2, 0), gx = G();
      const rx = Math.hypot(r1[0] - c[0], r1[1] - c[1]) * 0.98, ry = Math.abs(r2[1] - c[1]) + rx * 0.2;
      gx.save(); gx.translate(c[0], c[1]);
      oval(0, 1.4, rx + 4, ry + 3, tone(E, '#6a5a3a')); oval(0, 0, rx + 2, ry + 1.6, tone(E, '#8ab060'));
      oval(0, 0.5, rx, ry, lin(-rx, -ry, rx, ry, E.night ? ['#2a4a7a', '#163058'] : ['#7ac8e8', '#3a90c0']));
      oval(0, -ry * 0.2, rx * 0.8, ry * 0.5, E.night ? 'rgba(160,190,255,.12)' : 'rgba(255,255,255,.22)');
      [[-0.38, 0.25], [0.42, -0.25], [0.15, 0.45]].forEach(([fx, fy], i) => { const x = fx * rx, y = fy * ry; ovI(x, y, 4.2, 2, tone(E, '#4a9a4a')); if (i !== 2) oval(x - 1, y - 2, 1.6, 1.2, tone(E, i ? '#f4a0c0' : '#ffffff')); });
      gx.restore();
    },
    pasture: (E, b) => {
      K.poly3([[b.x + 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + 0.1, 0], [b.x + b.w - 0.1, b.y + b.h - 0.1, 0], [b.x + 0.1, b.y + b.h - 0.1, 0]], E.night ? 'rgba(0,20,10,.18)' : 'rgba(60,110,30,.14)');
      for (let i = 0; i < 26; i++){ const p = q(b.x + 0.3 + hash(i * 3 + b.x) * (b.w - 0.6), b.y + 0.3 + hash(i * 7 + b.y) * (b.h - 0.6), 0); line([p[0] - 2, p[1]], [p[0] + 2, p[1] - 0.6], tone(E, '#d8c070'), 0.5); }
    },
  };

  // ---------- 새 땅 여섯(LAND_STEPS) ----------
  const LT = {};
  // 감사의 제단(창세기 8:20) — 돌을 둥글게 쌓고 위에 작은 불, 연기가 곧게 오른다
  LT.altar = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), x = c[0], y = c[1];
    foot(E, b.x + b.w / 2, b.y + b.h / 2 + 0.1, 0.9, 0.5);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 7 - r; i++){ const a = (i / (7 - r)) * TAU + r * 0.4, rx = 16 - r * 3.4, px = x + Math.cos(a) * rx, py = y - r * 5 + Math.sin(a) * rx * 0.45; if (Math.sin(a) < -0.2 && r < 3) continue; ovI(px, py - 2, 4.2 - r * 0.4, 3, tone(E, (i + r) % 2 ? '#c8bca4' : '#a8a08c')); }
    oval(x, y - 19, 10, 4, tone(E, '#d8ccb0')); oval(x, y - 19.4, 7, 2.6, tone(E, '#5a4a3a'));
  };
  LT.altarLive = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), x = c[0], y = c[1] - 20, t = STILL ? 0 : E.t;
    for (let i = 0; i < 3; i++){ const f = 0.7 + 0.3 * Math.sin(t * 9 + i * 2); poly([[x - 4 + i * 3, y], [x - 2 + i * 3, y - 7 * f], [x + i * 3, y]], i === 1 ? '#ffe070' : '#ff8a30'); }
    for (let i = 0; i < 6; i++){ const k = (t * 0.25 + i / 6) % 1; oval(x + Math.sin(k * 5 + i) * 2, y - 10 - k * 46, 2.4 + k * 5, 2 + k * 3, 'rgba(235,235,240,' + (0.5 * (1 - k)).toFixed(2) + ')'); }
    E.lamp(x, y - 2, E.night ? 36 : 18, '#ffb050');
  };
  // 무지개 언덕 — 일곱 빛깔 꽃밭이 줄줄이 덮인 둥근 언덕, 가운데 무지개 아치
  LT.rainbowhill = (E, b) => {
    const cols = ['#ff5a5a', '#ff9a3a', '#ffe04a', '#5ad06a', '#4aa8ff', '#5a6ae8', '#a86ae8'];
    foot(E, b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2);
    const mound = []; for (let i = 0; i <= 20; i++){ const a = i / 20 * TAU; mound.push(q(b.x + b.w / 2 + Math.cos(a) * (b.w / 2 - 0.2), b.y + b.h / 2 + Math.sin(a) * (b.h / 2 - 0.2), 4 + 3 * Math.max(0, -Math.sin(a)))); }
    poly(mound, tone(E, '#7ab850'), true);
    cols.forEach((c, i) => { for (let j = 0; j < 10; j++){ const u = b.x + 0.6 + j * (b.w - 1.2) / 9, v = b.y + 0.5 + i * (b.h - 1) / 6, p = q(u, v, 5); oval(p[0], p[1] - 1.4, 1.6, 1.2, tone(E, c)); oval(p[0] - 0.5, p[1] - 1.8, 0.5, 0.4, 'rgba(255,255,255,.6)'); } });
    const p = q(b.x + b.w / 2, b.y + b.h / 2, 6), gx = G();
    gx.lineCap = 'butt'; cols.forEach((c, i) => { gx.strokeStyle = tone(E, c); gx.lineWidth = 2.2; gx.beginPath(); gx.arc(p[0], p[1], 26 - i * 2.2, Math.PI, 0); gx.stroke(); });
    gx.strokeStyle = INK; gx.lineWidth = 0.6; gx.beginPath(); gx.arc(p[0], p[1], 27.1, Math.PI, 0); gx.stroke(); gx.beginPath(); gx.arc(p[0], p[1], 26 - 6 * 2.2 - 1.1, Math.PI, 0); gx.stroke();
    [[-27, 0], [27, 0]].forEach(([dx]) => { ovI(p[0] + dx * 0.96, p[1], 3, 1.6, tone(E, '#f4f0e0')); });
  };
  // 첫 포도원(창세기 9:20) — 말뚝 줄에 감긴 덩굴과 보랏빛 송이
  LT.vineyard = (E, b) => {
    for (let r = 0; r < 3; r++){
      const v = b.y + 0.5 + r;
      K.poly3([[b.x + 0.1, v - 0.2, 0], [b.x + b.w - 0.1, v - 0.2, 0], [b.x + b.w - 0.1, v + 0.25, 0], [b.x + 0.1, v + 0.25, 0]], tone(E, '#7a5a3a'));
      const posts = []; for (let i = 0; i <= 5; i++) posts.push(b.x + 0.3 + i * (b.w - 0.6) / 5);
      posts.forEach(u => { const a = q(u, v, 0), c = q(u, v, 14); line(a, c, INK, 1.8); line(a, c, tone(E, '#a07a4a'), 1); });
      line(q(posts[0], v, 12), q(posts[5], v, 12), tone(E, '#d8c8a0'), 0.5);
      for (let i = 0; i < 12; i++){ const u = b.x + 0.4 + i * (b.w - 0.8) / 11, p = q(u, v, 9 + Math.sin(i * 1.7 + r) * 2); ovI(p[0], p[1], 3.6, 2.6, tone(E, i % 2 ? '#4f8a3e' : '#3a7034')); if ((i + r) % 3 === 0){ for (let k = 0; k < 5; k++) oval(p[0] - 1 + (k % 2), p[1] + 2 + Math.floor(k / 2) * 1.3, 0.9, 0.9, tone(E, '#6a3a8a')); } }
    }
  };
  // 비둘기 집 — 흰 회벽 둥근 탑, 구멍 줄, 꼭대기 원뿔 지붕
  LT.dovecote = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), x = c[0], y = c[1], gx = G();
    foot(E, b.x + b.w / 2, b.y + b.h / 2, 0.8, 0.5);
    const wc = tone(E, '#f4f0e6'), h = 36;
    R(x - 11, y - h, 22, h, lin(x - 11, 0, x + 11, 0, [shade(wc, 0.05), shade(wc, -0.2)]));
    oval(x, y, 11, 5, shade(wc, -0.2)); gx.strokeStyle = INK; gx.lineWidth = 0.7; gx.strokeRect(x - 11, y - h, 22, h);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++){ const px = x - 7 + i * 4.6, py = y - 10 - r * 6.5; oval(px, py, 1.4, 1.6, tone(E, '#3a3028')); R(px - 2, py + 1.6, 4, 0.8, tone(E, '#c8b8a0')); }
    oval(x, y - h, 11, 5, tone(E, '#e8e2d4'));
    poly([[x - 13, y - h], [x, y - h - 18], [x + 13, y - h]], tone(E, '#b85a3a'), true);
    poly([[x, y - h - 18], [x + 13, y - h], [x + 3, y - h]], 'rgba(0,0,0,.18)');
  };
  LT.dovecoteLive = (E, b) => {
    const c = q(b.x + b.w / 2, b.y + b.h / 2, 0), t = STILL ? 0 : E.t;
    for (let i = 0; i < 3; i++){ const a = t * (0.8 + i * 0.2) + i * 2.1, r = 16 + i * 6; dove(c[0] + Math.cos(a) * r, c[1] - 52 - i * 6 + Math.sin(a * 2) * 4, 0.9, t + i); }
  };
  // 올리브 동산 — 올리브 나무 넷과 낮은 돌담
  LT.olivegrove = (E, b) => {
    K.poly3([[b.x, b.y + b.h - 0.15, 0], [b.x + b.w, b.y + b.h - 0.15, 0], [b.x + b.w, b.y + b.h, 0], [b.x, b.y + b.h, 0]], tone(E, '#b8a888'));
    [[0.9, 0.8], [2.9, 0.7], [1.6, 2.0], [3.3, 2.1]].forEach(([du, dv], i) => { const p = q(b.x + du, b.y + dv, 0); oliveTree(E, p[0], p[1], 0.9 + (i % 2) * 0.12, i * 13 + 5); });
    for (let i = 0; i < 9; i++){ const p = q(b.x + 0.2 + i * (b.w - 0.4) / 8, b.y + b.h - 0.08, 0); ovI(p[0], p[1] - 1.6, 2.6, 1.8, tone(E, i % 2 ? '#c8bca4' : '#b0a68e')); }
  };
  // 새 마을 우물 광장 — 돌 바닥 광장, 가운데 지붕 얹은 우물, 양쪽 등잔 기둥
  LT.wellsquare = (E, b) => {
    const cells = new Set(); for (let u = b.x; u < b.x + b.w; u++) for (let v = b.y; v < b.y + b.h; v++) cells.add(u + ',' + v);
    K.stones(E, cells);
    const cu = b.x + b.w / 2, cv = b.y + b.h / 2, c = q(cu, cv, 0), x = c[0], y = c[1];
    oval(x + 2, y + 2, 20, 8, look(E).shadow);
    // 우물 둘레 — 둥근 돌 테
    for (let i = 0; i < 14; i++){ const a = i / 14 * TAU; if (Math.sin(a) < -0.3) continue; ovI(x + Math.cos(a) * 14, y - 4 + Math.sin(a) * 6, 3.6, 3, tone(E, i % 2 ? '#c8bca4' : '#b4a88e')); }
    oval(x, y - 7, 13, 5.2, tone(E, '#d8ccb0')); oval(x, y - 7, 10, 3.8, E.night ? '#162848' : tone(E, '#2a5a8a')); oval(x - 3, y - 8, 4, 1, 'rgba(255,255,255,.35)');
    [[-12, 0], [12, 0]].forEach(([dx]) => { const a = [x + dx, y - 6], c2 = [x + dx, y - 34]; line(a, c2, INK, 2.6); line(a, c2, tone(E, '#8a6a4a'), 1.6); });
    poly([[x - 18, y - 32], [x, y - 44], [x + 18, y - 32], [x, y - 26]], tone(E, '#b85a3a'), true);
    line([x - 12, y - 24], [x + 12, y - 24], tone(E, '#6a4a30'), 1.2); line([x, y - 24], [x, y - 14], tone(E, '#c8b890'), 0.5); ovI(x, y - 12, 2.4, 2, tone(E, '#8a6a4a'));
    [[b.x + 0.4, b.y + b.h - 0.4], [b.x + b.w - 0.4, b.y + 0.4]].forEach(([u, v]) => { const a = q(u, v, 0), c2 = q(u, v, 26); line(a, c2, INK, 2); line(a, c2, tone(E, '#5a4a3a'), 1.2); ovI(c2[0], c2[1] - 2, 2.6, 3.2, E.night ? '#ffcf7a' : tone(E, '#e8d8a0')); if (E.night) E.lamp(c2[0], c2[1] - 2, 30, '#ffcf7a'); });
    // 벤치 둘
    [[b.x + 0.5, b.y + 1.4], [b.x + 2.4, b.y + b.h - 0.6]].forEach(([u, v]) => box(u, v, u + 1, v + 0.3, 0, 4, tone(E, '#a07a50')));
  };

  // ================= 농장 붙이기 =================
  HD.addFarm('ark', { look: LOOK_ARK, nightTint: '#141a3a', dz: true,
    backdrop: arkBackdrop, island: (E, p, b) => grassIsland(E, p, b, { seed: 3, flowers: ['#ff8fa8', '#ffe070', '#ffffff', '#c8a0ff'] }),
    sparkle: () => {}, node: arkNode, weather: arkWeather, pick: (E, x, y, t) => pitchLump(E, x, y, t),
    thing: { ark: (E, b) => arkThing(E, b) }, live: { ark: (E, b) => arkLive(E, b) } });
  HD.addFarm('newland', { look: LOOK_NEW, nightTint: '#142048',
    backdrop: newBackdrop, island: (E, p, b) => grassIsland(E, p, b, { seed: 7, puddles: true, tuft: '#3f7a2e', flowers: ['#ff5a5a', '#ff9a3a', '#ffe04a', '#5ad06a', '#4aa8ff', '#a86ae8', '#ffffff'] }),
    sparkle: () => {}, node: newNode, weather: newWeather, pick: (E, x, y, t) => oliveSprig(E, x, y, t),
    floor: greenFloor,
    thing: { altar: LT.altar, rainbowhill: LT.rainbowhill, vineyard: LT.vineyard, dovecote: LT.dovecote, olivegrove: LT.olivegrove, wellsquare: LT.wellsquare },
    live: { altar: LT.altarLive, dovecote: LT.dovecoteLive } });
  // 장면 쪽(아래 farm-ark-scenes.js)이 쓰는 그림
  HD.ark = { hullOf, arkThing, miniArk, dove, oliveTree, gopher, cloudMass, LOOK_ARK, LOOK_NEW };
})();
