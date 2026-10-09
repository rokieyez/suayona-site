// pages/room-hd-furn.js — 스테이지2(오로라 농장부터) 집 안 가구 고화소 그림, 뒤 절반 kind(mobile ~ xmas). 앞 절반은 room-hd.js.
// 북유럽 통나무집의 아늑한 가구 — 따뜻한 나무·털·니트, 빨강·크림·숲초록. 칠은 farm-hd.js 처럼 그러데이션 + INK 테두리.
// 약속: ROOMHD.furn[kind](g, C) — g 는 도트 단위로 키워 둔 캔버스, C = { f, F, kind, c, rot, E, D, H, P(ax, ay, up), CX, CY, t, lit, night, tone, shade, mix, INK }.
//   P 는 paintFurniture 와 같은 아이소 좌표(ax → 오른쪽 아래, ay → 왼쪽 아래). 보이는 면은 앞(ay 끝)·오른쪽(ax 끝)·윗면.
//   늘 낮 빛깔로 그린다(밤 누르기는 ROOMHD 가 source-atop 으로). light() 안은 lit 겹에서도 그린다 — 불·화면·전구.
(function(){
  'use strict';
  const RH = window.ROOMHD = window.ROOMHD || { furn: {}, wall: {} };
  const TAU = Math.PI * 2;
  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

  // ---------- 붓 묶음 — 가구 하나 그릴 때마다 C 로 만든다 ----------
  function kit(g, C){
    let off = !!C.lit;
    const P = C.P, sh = C.shade;
    const T = c => c;                                                      // 밤 누르기는 ROOMHD 가 다 그린 뒤 한 번에 얹는다 — 늘 낮 빛깔로
    const pth = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
    const ink = w => { g.strokeStyle = C.INK; g.lineWidth = w === true ? 0.5 : w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
    const fill = f => { g.fillStyle = typeof f === 'string' ? T(f) : f; g.fill(); };
    const K = { g, C, P, sh, T };
    K.lg = (x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), T(c))); return gr; };
    K.rg = (x, y, r, cols) => { const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(0.1, r)); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), T(c))); return gr; };
    K.poly = (pts, f, w) => { if (off) return; pth(pts); if (f) fill(f); if (w) ink(w); };
    K.ov = (x, y, rx, ry, f, w, rot) => { if (off) return; g.beginPath(); g.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), rot || 0, 0, TAU); if (f) fill(f); if (w) ink(w); };
    // 부드러운 공 — 왼쪽 위에서 빛이 온다
    K.ball = (x, y, rx, ry, c, w, rot) => K.ov(x, y, rx, ry, K.rg(x - rx * 0.35, y - ry * 0.45, Math.max(rx, ry) * 1.5, [sh(c, 0.3), c, sh(c, -0.3)]), w, rot);
    K.ln = (a, b, c, w) => { if (off) return; g.strokeStyle = T(c); g.lineWidth = w || 0.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
    K.curve = (pts, c, w) => { if (off) return; g.strokeStyle = T(c); g.lineWidth = w || 0.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
    K.glow = (x, y, r, rgb, a) => { if (off) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    // 빛나는 부분 — lit 겹에서도 그리고, 밤에도 눌리지 않는다
    K.light = fn => { const o = off; off = false; fn(); off = o; };
    // 아이소 상자: 앞면(ay+eh)·오른쪽 면(ax+ew)·윗면. o = { f, r, t(면 칠), top:false, w(테두리) }
    K.box = (ax, ay, ew, eh, z0, h, c, o) => {
      o = o || {}; const z1 = z0 + h, w = o.w === undefined ? 0.5 : o.w;
      const a = P(ax, ay + eh, z1), b = P(ax, ay + eh, z0), d = P(ax + ew, ay, z1), e = P(ax + ew, ay, z0);
      K.poly([P(ax, ay + eh, z0), P(ax + ew, ay + eh, z0), P(ax + ew, ay + eh, z1), P(ax, ay + eh, z1)], o.f || K.lg(0, a[1], 0, b[1], [sh(c, 0.08), sh(c, -0.1)]), w);
      K.poly([P(ax + ew, ay + eh, z0), P(ax + ew, ay, z0), P(ax + ew, ay, z1), P(ax + ew, ay + eh, z1)], o.r || K.lg(0, d[1], 0, e[1], [sh(c, -0.2), sh(c, -0.34)]), w);
      if (o.top !== false) K.poly([P(ax, ay, z1), P(ax + ew, ay, z1), P(ax + ew, ay + eh, z1), P(ax, ay + eh, z1)], o.t || sh(c, 0.16), w);
    };
    K.fF = (ax0, ax1, ay, z0, z1, f, w) => K.poly([P(ax0, ay, z0), P(ax1, ay, z0), P(ax1, ay, z1), P(ax0, ay, z1)], f, w);   // 앞면(ay 일정) 위 네모
    K.fR = (ay0, ay1, ax, z0, z1, f, w) => K.poly([P(ax, ay0, z0), P(ax, ay1, z0), P(ax, ay1, z1), P(ax, ay0, z1)], f, w);   // 오른쪽 면(ax 일정) 위 네모
    K.top = (ax, ay, ew, eh, z, f, w) => K.poly([P(ax, ay, z), P(ax + ew, ay, z), P(ax + ew, ay + eh, z), P(ax, ay + eh, z)], f, w);
    K.rr = (x, y, w, h, r, f, wd) => { if (off) return; r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); if (f) fill(f); if (wd) ink(wd); };
    K.iel = (cx, cy, rx, ry, z, n) => { const o = []; n = n || 28; for (let i = 0; i < n; i++){ const a = i / n * TAU; o.push(P(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z)); } return o; };
    // 둥근 기둥(원통) — 아이소 원은 가로 √2·r, 세로 r/√2
    K.cyl = (ax, ay, r, z0, h, c, w, topC) => {
      if (off) return; const b = P(ax, ay, z0), t = P(ax, ay, z0 + h), rx = r * 1.414, ry = r * 0.707; w = w === undefined ? 0.5 : w;
      g.beginPath(); g.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI); g.lineTo(t[0] - rx, t[1]); g.ellipse(t[0], t[1], rx, ry, 0, Math.PI, TAU); g.closePath();
      fill(K.lg(b[0] - rx, 0, b[0] + rx, 0, [sh(c, 0.12), sh(c, 0.02), sh(c, -0.3)])); if (w) ink(w);
      K.ov(t[0], t[1], rx, ry, topC || sh(c, 0.18), w);
    };
    // 발밑 그림자 — 두 겹, 닿은 자리가 짙다
    K.shadow = (k) => { if (off) return; k = k || 1; K.top(0.5, 0.5, C.E - 1, C.D - 1, 0, 'rgba(26,18,10,' + (0.1 * k) + ')'); K.top(3, 3, C.E - 6, C.D - 6, 0, 'rgba(26,18,10,' + (0.12 * k) + ')'); };
    K.blob = (x, y, rx, ry, k) => { if (off) return; K.ov(x, y, rx, ry, K.rg(x, y, Math.max(rx, ry), ['rgba(26,18,10,' + (0.28 * (k || 1)) + ')', 'rgba(26,18,10,0)'])); };
    // 방향이 있는 가구 — 길이 u · 깊이 v. 가로로 길면 u = ax, 세로로 길면 u = ay. 한 칸짜리는 돌림(rot)으로 앞을 바꾼다
    const hz = !C.P || C.E > C.D || (C.E === C.D && C.rot % 2 === 0);
    K.O = {
      hz, L: hz ? C.E : C.D, W: hz ? C.D : C.E,
      p: (u, v, z) => hz ? P(u, v, z) : P(v, u, z),
      box: (u, v, lu, lv, z0, h, c, o) => hz ? K.box(u, v, lu, lv, z0, h, c, o) : K.box(v, u, lv, lu, z0, h, c, o),
      front: (u0, u1, v, z0, z1, f, w) => hz ? K.fF(u0, u1, v, z0, z1, f, w) : K.fR(u0, u1, v, z0, z1, f, w),
      end: (v0, v1, u, z0, z1, f, w) => hz ? K.fR(v0, v1, u, z0, z1, f, w) : K.fF(v0, v1, u, z0, z1, f, w),
      top: (u, v, lu, lv, z, f, w) => hz ? K.top(u, v, lu, lv, z, f, w) : K.top(v, u, lv, lu, z, f, w),
      cyl: (u, v, r, z0, h, c, w, tc) => hz ? K.cyl(u, v, r, z0, h, c, w, tc) : K.cyl(v, u, r, z0, h, c, w, tc),
      iel: (cu, cv, ru, rv, z, n) => hz ? K.iel(cu, cv, ru, rv, z, n) : K.iel(cv, cu, rv, ru, z, n),
    };
    return K;
  }
  const def = (kind, fn) => { RH.furn[kind] = fn; };

  // ---------- 니트·민속 무늬 조각 ----------
  // 북유럽 여덟 꽃잎 별(셀부 별)을 화면에 — 니트·방석·이불 무늬
  function selbu(K, x, y, r, c){ for (let i = 0; i < 8; i++){ const a = i * TAU / 8; K.ov(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.32, r * 0.42, r * 0.16, c, 0, a); } K.ov(x, y, r * 0.18, r * 0.12, c); }
  // 하트 — 민속 가구 파낸 자리
  function heart(K, x, y, s, c, w){ K.poly([[x, y + s * 0.9], [x - s, y - s * 0.05], [x - s * 0.95, y - s * 0.6], [x - s * 0.5, y - s * 0.85], [x, y - s * 0.45], [x + s * 0.5, y - s * 0.85], [x + s * 0.95, y - s * 0.6], [x + s, y - s * 0.05]], c, w); }
  // 앞에서 본 화분(위가 넓은 사다리꼴 + 테) — 바닥 가운데 x, 바닥 y
  function pot(K, x, y, wTop, wBot, h, c, rim){
    K.blob(x, y, wTop * 0.75, 3, 1);
    K.poly([[x - wTop, y - h], [x + wTop, y - h], [x + wBot, y], [x - wBot, y]], K.lg(x - wTop, 0, x + wTop, 0, [K.sh(c, 0.15), c, K.sh(c, -0.3)]), 0.5);
    K.poly([[x - wTop - 1, y - h - 2.2], [x + wTop + 1, y - h - 2.2], [x + wTop + 1, y - h + 0.6], [x - wTop - 1, y - h + 0.6]], K.lg(0, y - h - 2, 0, y - h, [K.sh(rim || c, 0.2), K.sh(rim || c, -0.1)]), 0.5);
    K.ov(x, y - h - 2.2, wTop + 0.6, 1.1, '#5a3c28');
  }
  // 잎 하나(끝이 뾰족한 타원) — 앞에서
  function leaf(K, x, y, len, wd, ang, c, w){ const ca = Math.cos(ang), sa = Math.sin(ang), tip = [x + ca * len, y + sa * len], m = [x + ca * len * 0.5, y + sa * len * 0.5], nx = -sa * wd, ny = ca * wd;
    if (K.C.lit) return; const g = K.g; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(m[0] + nx, m[1] + ny, tip[0], tip[1]); g.quadraticCurveTo(m[0] - nx, m[1] - ny, x, y); g.closePath();
    g.fillStyle = K.lg(m[0] + nx, m[1] + ny, m[0] - nx, m[1] - ny, [K.sh(c, 0.22), K.sh(c, -0.18)]); g.fill(); if (w !== 0){ g.strokeStyle = K.C.INK; g.lineWidth = w || 0.4; g.stroke(); }
    K.ln([x, y], [m[0] * 0.3 + tip[0] * 0.7, m[1] * 0.3 + tip[1] * 0.7], K.sh(c, -0.3), 0.3); }

  // ================= 깔개 =================
  // rug1 넝마 줄무늬 러그(트라스마타) · rug2 꽃 니트 러그 · rug3 땋은 동그란 러그
  def('rug', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, z = 1;
    if (C.lit) return;
    if (C.f === 'rug3'){
      const cols = [K.sh(c, -0.25), '#fff6e9', c, '#e8574f', K.sh(c, 0.2), '#fff6e9', c];
      K.poly(K.iel(C.E / 2 + 0.6, C.D / 2 + 0.6, C.E / 2 - 0.6, C.D / 2 - 0.6, 0, 40), 'rgba(26,18,10,.14)');
      cols.forEach((col, i) => { const k = 1 - i * 0.13; K.poly(K.iel(C.E / 2, C.D / 2, (C.E / 2 - 1) * k, (C.D / 2 - 1) * k, z, 40), col, i ? 0.25 : 0.5); });
      for (let i = 0; i < 5; i++){ const k = 0.94 - i * 0.13; K.iel(C.E / 2, C.D / 2, (C.E / 2 - 1) * k, (C.D / 2 - 1) * k, z, 22).forEach((p, j) => { if (j % 2) K.ov(p[0], p[1], 0.7, 0.35, 'rgba(255,255,255,.28)'); }); }   // 땋은 결
      return;
    }
    O.box(2, 1, L - 4, W - 2, 0, z, c, { w: 0.5 });
    if (C.f === 'rug2'){
      O.top(2, 1, L - 4, W - 2, z, '#fff6e9', 0.4); O.top(4, 3, L - 8, W - 6, z, c, 0.3);
      for (let u = 4; u < L - 4; u += 3) { const p = O.p(u + 1.5, 2, z); K.ov(p[0], p[1], 0.6, 0.3, '#e8574f'); const q = O.p(u + 1.5, W - 2, z); K.ov(q[0], q[1], 0.6, 0.3, '#e8574f'); }
      for (let u = 9; u < L - 6; u += 12){ const p = O.p(u, W / 2, z); selbu(K, p[0], p[1], 4.4, '#fff6e9'); K.ov(p[0], p[1], 0.9, 0.5, '#e8574f'); }
    } else {
      const band = ['#fff6e9', c, '#e8574f', c, '#5d8fb8', c, '#fff6e9', c];
      let u = 2, i = 0; while (u < L - 2){ const wd = Math.min(L - 2 - u, i % 2 ? 4 : 2); O.top(u, 1, wd, W - 2, z, band[i % band.length]); u += wd; i++; }
      for (let k = 0; k < 40; k++){ const p = O.p(3 + hash(k * 7 + 1) * (L - 6), 2 + hash(k * 13 + 5) * (W - 4), z); K.ov(p[0], p[1], 0.5, 0.25, 'rgba(255,255,255,.22)'); }   // 넝마 결
      O.top(2, 1, L - 4, W - 2, z, null, 0.5);
    }
    for (let v = 2; v < W - 1; v += 1.5){ [[2, -1.6], [L - 2, 1.6]].forEach(([u, d]) => K.ln(O.p(u, v, z), O.p(u + d, v, 0.3), '#efe2c8', 0.4)); }   // 술
  });

  // ================= 탁자 · 소파 · 피아노 · 책상 · 텔레비전 =================
  // 농가 식탁 — 두툼한 상판, 깎은 다리, 빨간 체크 러너에 코코아와 시나몬 빵
  def('table', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, HH = 24;
    K.shadow();
    [[4, 4], [L - 4, 4], [4, W - 4], [L - 4, W - 4]].forEach(([u, v]) => { O.cyl(u, v, 1.4, 0, HH - 4, K.sh(c, -0.25)); const m = O.p(u, v, HH * 0.45); K.ov(m[0], m[1], 2.3, 1.1, K.sh(c, -0.1), 0.4); });
    O.box(0, 0, L, W, HH - 4, 4, c, { t: K.lg(0, O.p(0, 0, HH)[1], 0, O.p(L, W, HH)[1], [K.sh(c, 0.26), K.sh(c, 0.08)]) });
    for (let u = 6; u < L - 3; u += 7) K.ln(O.p(u, 0.6, HH), O.p(u + 2, W - 0.6, HH), K.sh(c, -0.06), 0.25);   // 나뭇결
    const rv = W / 2 - 4; O.top(1, rv, L - 2, 8, HH + 0.2, '#fff6e9', 0.35);
    for (let u = 1; u < L - 1; u += 2) for (let v = 0; v < 8; v += 2) if (((u - 1) / 2 + v / 2) % 2 === 0) O.top(u, rv + v, 2, 2, HH + 0.25, '#d9483f');
    O.front(1, L - 1, rv + 8, HH - 1.5, HH + 0.2, '#d9483f', 0.3);
    // 코코아 잔 — 흰 점박이 빨간 잔
    const m = O.p(L * 0.3, W / 2, HH); O.cyl(L * 0.3, W / 2, 2.2, HH, 4.5, '#d9483f', 0.45, '#6a3c26');
    [-1.4, 1.2].forEach(d => K.ov(m[0] + d, m[1] - 2, 0.5, 0.5, '#fff6e9'));
    K.curve([[m[0] + 3, m[1] - 3.4], [m[0] + 4.6, m[1] - 2.6], [m[0] + 3, m[1] - 1.2]], '#b83a33', 0.8);
    // 빵 접시
    const pl = O.p(L * 0.68, W / 2, HH); K.ov(pl[0], pl[1] + 0.3, 5.2, 2.6, '#ffffff', 0.4); K.ov(pl[0], pl[1], 3.8, 1.8, '#eef2f6');
    K.ball(pl[0] - 1, pl[1] - 1, 2.4, 1.6, '#d89a52', 0.4); K.ball(pl[0] + 1.6, pl[1] - 0.4, 2.1, 1.4, '#cf8e48', 0.4);
    K.curve([[pl[0] - 2.2, pl[1] - 1.2], [pl[0] - 1, pl[1] - 1.9], [pl[0] + 0.2, pl[1] - 1.1]], '#8a5226', 0.35);
  });

  // 아늑한 소파 — 등받이는 뒤에, 팔걸이 둘, 니트 담요와 셀부 별 쿠션
  def('sofa', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, AW = 6, BD = 7;
    K.shadow();
    [[3, 3], [L - 3, 3], [3, W - 3], [L - 3, W - 3]].forEach(([u, v]) => O.cyl(u, v, 1.1, 0, 4, '#6f4a2c'));
    O.box(0, 0, L, W, 3.5, 7, K.sh(c, -0.12));                                        // 밑동
    O.box(0, 0, L, BD, 10, 18, c, { t: K.sh(c, 0.12) });                              // 등받이
    const sw = (L - AW * 2) / 2;
    for (let n = 0; n < 2; n++){ const u0 = AW + n * sw; O.box(u0 + 0.3, BD, sw - 0.6, W - BD - 1, 10, 5, c, { t: K.sh(c, 0.18) });   // 앉는 방석
      const s = O.p(u0 + sw / 2, BD + (W - BD) / 2, 15.2); K.ov(s[0], s[1], sw * 0.5, 1.2, 'rgba(255,255,255,.14)'); }
    [0, L - AW].forEach((u, i) => { O.box(u, 0, AW, W, 10, 11, i ? K.sh(c, -0.06) : c, { t: K.sh(c, 0.2) }); const t = O.p(u + AW / 2, W / 2, 21); K.ov(t[0], t[1], 3.8, 1.2, 'rgba(255,255,255,.12)'); });
    // 쿠션 둘 — 등받이에 기대 놓았다
    [[AW + 5, '#fff6e9', '#d9483f'], [L - AW - 6, '#3f7d5c', '#fff6e9']].forEach(([u, bg, fg]) => { const p = O.p(u, BD + 1.5, 21); K.poly([[p[0] - 5, p[1] - 4], [p[0] + 5, p[1] - 5], [p[0] + 5.5, p[1] + 4], [p[0] - 4.5, p[1] + 5]], K.lg(p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5, [K.sh(bg, 0.15), K.sh(bg, -0.15)]), 0.5); selbu(K, p[0] + 0.4, p[1], 3.4, fg); });
    // 니트 담요 — 오른쪽 팔걸이에 걸쳐 앞으로 늘어진다
    const a = O.p(L - AW - 1, BD + 1, 21.4), b = O.p(L, BD + 1, 21.4), d = O.p(L, W - 1, 21.4), e = O.p(L - AW - 1, W - 1, 21.4), f2 = O.p(L - AW - 1, W, 9), f3 = O.p(L, W, 9);
    K.poly([a, b, d, e], '#f4ead6', 0.45); K.poly([e, d, f3, f2], K.lg(0, e[1], 0, f2[1], ['#efe2c8', '#d8c8a8']), 0.45);
    for (let k = 1; k < 4; k++){ const m0 = [e[0] + (d[0] - e[0]) * k / 4, e[1] + (d[1] - e[1]) * k / 4], m1 = [f2[0] + (f3[0] - f2[0]) * k / 4, f2[1] + (f3[1] - f2[1]) * k / 4]; K.ln(m0, m1, '#c9b48e', 0.6); }   // 꽈배기 결
    K.ln([(e[0] + f2[0]) / 2, (e[1] + f2[1]) / 2], [(d[0] + f3[0]) / 2, (d[1] + f3[1]) / 2], '#d9483f', 0.9);
  });

  // 업라이트 피아노 — 건반 받침, 악보, 위에 작은 화분과 액자
  def('piano', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, BD = Math.min(12, W - 8);
    K.shadow();
    [[2, BD + 5], [L - 2, BD + 5]].forEach(([u, v]) => O.cyl(u, v, 1.1, 0, 20, K.sh(c, 0.05)));        // 앞다리
    O.box(0, 0, L, BD, 0, 44, c, { t: K.sh(c, 0.2) });                                               // 몸통
    O.front(3, L - 3, BD, 4, 18, K.sh(c, 0.06), 0.4); O.front(5, L - 5, BD, 6, 16, K.sh(c, -0.08), 0.3);   // 아래 판
    O.front(3, L - 3, BD, 28, 42, K.sh(c, 0.1), 0.4);                                                // 위 판
    for (let u = 6; u < L - 5; u += 10){ const p = O.p(u + 2, BD, 37); K.ov(p[0], p[1], 2.2, 2.2, K.sh(c, -0.12)); }
    O.box(1, BD, L - 2, 6, 21, 3, K.sh(c, 0.04));                                                     // 건반 받침
    O.top(2, BD + 0.5, L - 4, 4.5, 24.05, '#fffaf2', 0.3);
    for (let u = 2; u < L - 2; u += 2) K.ln(O.p(u, BD + 0.5, 24.1), O.p(u, BD + 5, 24.1), '#c9c2b4', 0.2);
    for (let u = 3; u < L - 3; u += 2){ if ([1, 4].indexOf(Math.round((u - 3) / 2) % 7) >= 0) continue; O.top(u + 0.8, BD + 0.5, 1, 2.6, 24.4, '#2a2a2a'); }
    O.box(4, BD - 1, L - 8, 1, 26, 8, K.sh(c, -0.04));                                                // 악보대
    const s = O.p(L / 2, BD, 29); K.poly([[s[0] - 6, s[1] - 1], [s[0], s[1] - 1.5], [s[0], s[1] + 6], [s[0] - 6, s[1] + 6.5]], '#fffdf6', 0.35); K.poly([[s[0], s[1] - 1.5], [s[0] + 6, s[1] - 1], [s[0] + 6, s[1] + 6.5], [s[0], s[1] + 6]], '#f4efe2', 0.35);
    for (let k = 0; k < 3; k++){ K.ln([s[0] - 5, s[1] + 1 + k * 1.8], [s[0] - 1, s[1] + 0.8 + k * 1.8], '#8a8070', 0.25); K.ln([s[0] + 1, s[1] + 0.8 + k * 1.8], [s[0] + 5, s[1] + 1 + k * 1.8], '#8a8070', 0.25); }
    O.top(0, 0, L, BD, 44, null, 0.5);
    // 위에 — 작은 화분과 사진 액자
    const pp = O.p(L * 0.25, BD / 2, 44); pot(K, pp[0], pp[1], 2.6, 2, 4, '#fff6e9', '#e8574f'); K.ball(pp[0], pp[1] - 8, 3.6, 3, '#4f9a58', 0.4);
    const fr = O.p(L * 0.68, BD / 2, 44); K.poly([[fr[0] - 3.5, fr[1] - 8], [fr[0] + 3.5, fr[1] - 8], [fr[0] + 3.5, fr[1]], [fr[0] - 3.5, fr[1]]], '#c79b6d', 0.45); K.poly([[fr[0] - 2.3, fr[1] - 6.8], [fr[0] + 2.3, fr[1] - 6.8], [fr[0] + 2.3, fr[1] - 1.2], [fr[0] - 2.3, fr[1] - 1.2]], K.lg(0, fr[1] - 7, 0, fr[1], ['#a8d4ee', '#8fc98a']));
  });

  // 컴퓨터 책상 — 자작나무 책상, 둥근 모니터, 자판, 코코아 잔, 탁상 화분
  def('pcdesk', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, HH = 30;
    K.shadow();
    [[2.5, 2.5], [L - 2.5, 2.5], [2.5, W - 2.5], [L - 2.5, W - 2.5]].forEach(([u, v]) => O.box(u - 1.2, v - 1.2, 2.4, 2.4, 0, HH - 3, K.sh(c, -0.2)));
    O.box(L - 13, 2, 10, W - 4, 4, HH - 8, K.sh(c, 0.04));                                           // 서랍 칸
    [8, 16].forEach(z => { O.front(L - 12, L - 4, W - 2, z - 3, z + 3, K.sh(c, 0.12), 0.35); const k = O.p(L - 8, W - 2, z); K.ov(k[0], k[1], 1.1, 0.6, '#d9483f', 0.3); });
    O.box(3, 3, 9, Math.min(12, W - 6), 0, 22, '#4a505a');                                            // 본체
    const lp = O.p(3 + 9, 3 + Math.min(12, W - 6) - 2, 16); K.light(() => K.ov(lp[0], lp[1], 0.8, 0.8, '#8fd9f0'));
    O.box(0, 0, L, W, HH - 3, 3, c, { t: K.lg(0, O.p(0, 0, HH)[1], 0, O.p(L, W, HH)[1], [K.sh(c, 0.28), K.sh(c, 0.1)]) });
    // 모니터
    const mu = L * 0.4, mw = Math.min(20, L * 0.46);
    O.box(mu - 3, 2, 6, 3, HH, 1, '#4a505a'); O.box(mu - 1, 2.5, 2, 1.5, HH + 1, 6, '#3a3f47', { w: 0.3 });
    O.box(mu - mw / 2, 1.5, mw, 2.5, HH + 6, 16, '#f2ece0', { t: '#fffaf2' });
    K.light(() => O.front(mu - mw / 2 + 1.5, mu + mw / 2 - 1.5, 4, HH + 8, HH + 20.5, K.lg(0, O.p(0, 4, HH + 20)[1], 0, O.p(0, 4, HH + 8)[1], ['#bfeaff', '#7cc4ea']), 0.3));
    K.light(() => { const s = O.p(mu - mw / 2 + 4, 4, HH + 18); K.poly([[s[0], s[1]], [s[0] + 3, s[1] + 1.5], [s[0] + 3, s[1] + 4], [s[0], s[1] + 2.5]], 'rgba(255,255,255,.45)'); });
    // 자판 · 마우스
    const kv = Math.max(6, W - 9);
    O.box(mu - 8, kv, 16, 4, HH, 0.8, '#e8e2d6', { w: 0.35 });
    for (let u = mu - 7; u < mu + 7.5; u += 1.6) for (let v = 0; v < 3; v++) O.top(u, kv + 0.5 + v * 1.1, 1.1, 0.8, HH + 0.85, '#fffdf8');
    const ms = O.p(mu + 11, kv + 2, HH); K.ball(ms[0], ms[1] - 0.6, 1.6, 1, '#fffdf8', 0.35);
    // 잔 · 화분
    O.cyl(L - 5, W - 6, 2, HH, 4.5, '#3f7d5c', 0.45, '#6a3c26');
    const pp = O.p(L - 6, 5, HH); pot(K, pp[0], pp[1], 2.4, 1.8, 3.6, '#fff6e9'); [[-0.5, -2.2], [0, -1.6], [0.6, -1]].forEach(([d, a]) => leaf(K, pp[0] + d, pp[1] - 5.5, 5, 1.5, a, '#4f9a58'));
  });

  // 텔레비전 — 자작나무 낮은 장, 뜨개 바구니, 둥근 옛날 텔레비전(화면이 빛난다)
  def('tv', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, BH = 14;
    K.shadow();
    [[3, 3], [L - 3, 3], [3, W - 3], [L - 3, W - 3]].forEach(([u, v]) => O.cyl(u, v, 0.9, 0, 3, '#8a5f3a'));
    O.box(0, 1, L, W - 2, 3, BH - 3, '#d8b48a', { t: '#ecd2ac' });
    O.front(2, L / 2 - 1, W - 1, 5, BH - 1.5, '#e4c49a', 0.35); O.front(L / 2 + 1, L - 2, W - 1, 5, BH - 1.5, '#e4c49a', 0.35);
    [L / 2 - 3, L / 2 + 3].forEach(u => { const k = O.p(u, W - 1, 9); K.ov(k[0], k[1], 0.9, 0.9, '#8a5f3a', 0.3); });
    // 텔레비전 몸통
    const tu = L / 2, tw = Math.min(26, L - 10), td = Math.min(12, W - 6), tz = BH, th = 18;
    O.box(tu - tw / 2, (W - td) / 2 - 1, tw, td, tz + 1, th, c, { t: K.sh(c, 0.2) });
    O.box(tu - 4, W / 2 - 2, 8, 4, tz, 1, '#2a2a30', { w: 0.3 });
    const fv = (W - td) / 2 - 1 + td;
    O.front(tu - tw / 2 + 1, tu + tw / 2 - 1, fv, tz + 2, tz + th - 1, K.sh(c, 0.12), 0.35);
    K.light(() => O.front(tu - tw / 2 + 2.5, tu + tw / 2 - 7, fv, tz + 3.5, tz + th - 2.5, K.lg(0, O.p(0, fv, tz + th)[1], 0, O.p(0, fv, tz)[1], ['#e8f6ff', '#9fd8f0', '#6fb8e0']), 0.3));
    K.light(() => { const s = O.p(tu - tw / 2 + 4, fv, tz + th - 4); K.ov(s[0] + 2, s[1] + 1, 2.4, 1, 'rgba(255,255,255,.55)', 0, 0.45); });
    [tz + 12, tz + 7].forEach(z => { const k = O.p(tu + tw / 2 - 4, fv, z); K.ov(k[0], k[1], 1.2, 1.2, '#d8b48a', 0.3); });
    const an = O.p(tu, W / 2, tz + th + 1); K.ln(an, [an[0] - 6, an[1] - 8], '#8a8f96', 0.5); K.ln(an, [an[0] + 5, an[1] - 9], '#8a8f96', 0.5); K.ov(an[0], an[1], 2, 1.1, '#5a5a62', 0.35);
  });

  // ================= 수납 =================
  // 책장 — 위에 왕관 장식, 칸마다 책·인형·작은 화분
  def('shelf', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, HT = Math.min(62, C.H - 4), dp = Math.min(W, 12), v0 = 0;
    K.shadow();
    O.box(0, v0, L, dp, 0, HT, c, { t: K.sh(c, 0.2) });
    O.front(1.6, L - 1.6, dp, 3, HT - 3, K.sh(c, -0.42), 0.35);                                        // 안쪽 그늘
    const bc = ['#d9483f', '#5d8fb8', '#f2c14e', '#3f7d5c', '#fff6e9', '#c96a8a'];
    const rows = 4, rh = (HT - 6) / rows;
    for (let r = 0; r < rows; r++){
      const z = 3 + r * rh; O.box(1.6, 1, L - 3.2, dp - 1, z - 1, 1, K.sh(c, 0.06), { w: 0.3 });
      if (r === 1){ const p = O.p(L * 0.35, dp - 2, z); pot(K, p[0], p[1], 2.4, 1.8, 3.4, '#e8574f'); [[-2.4], [-1.6], [-0.9]].forEach(([a], i) => leaf(K, p[0], p[1] - 5.4, 4.5, 1.3, a - 0.1 * i, '#4f9a58')); const b = O.p(L * 0.75, dp - 2, z); K.ball(b[0], b[1] - 3, 2.4, 2.6, '#c79b6d', 0.4); K.ov(b[0] - 1.8, b[1] - 5.6, 1, 1, '#a97b4f', 0.3); K.ov(b[0] + 1.8, b[1] - 5.6, 1, 1, '#a97b4f', 0.3); continue; }
      let u = 2.2; let i = r * 3;
      while (u < L - 3){ const bw = 1.6 + hash(i * 3 + r) * 1.2, bh = rh * (0.62 + hash(i * 7 + r) * 0.28), col = bc[i % bc.length]; if (u + bw > L - 2) break;
        O.box(u, dp - 4.5, bw, 3.5, z, bh, col, { w: 0.3 }); O.front(u + 0.2, u + bw - 0.2, dp - 1, z + bh * 0.6, z + bh * 0.68, '#fff6e9'); u += bw + 0.15; i++; }
    }
    O.box(-0.6, v0 - 0.4, L + 1.2, dp + 0.8, HT, 2, K.sh(c, 0.1));                                    // 갓
    const cr = O.p(L / 2, v0 + 0.5, HT + 2); heart(K, cr[0], cr[1] - 3, 2.6, K.sh(c, 0.1), 0.45);     // 꼭대기 하트
  });

  // 옷장 — 민속 꽃 그림(로제말링) 두 문, 하트 구멍, 둥근 갓
  def('wardrobe', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, HT = Math.min(70, C.H - 6), dp = Math.min(W, 14);
    K.shadow();
    O.box(0, 0, L, dp, 0, 5, K.sh(c, -0.25));
    O.box(0.6, 0.4, L - 1.2, dp - 0.8, 5, HT - 5, c, { t: K.sh(c, 0.2) });
    const fv = dp - 0.4;
    [[1.6, L / 2 - 0.3], [L / 2 + 0.3, L - 1.6]].forEach(([a, b], i) => {
      O.front(a, b, fv, 8, HT - 4, K.sh(c, 0.1), 0.4); O.front(a + 1.2, b - 1.2, fv, 10, HT - 6, '#fff3e0', 0.3);
      const m = O.p((a + b) / 2, fv, HT * 0.55); selbu(K, m[0], m[1], 3.4, i ? '#3f7d5c' : '#d9483f'); K.ov(m[0], m[1], 0.8, 0.8, '#f2c14e');
      const h = O.p((a + b) / 2, fv, HT - 9); heart(K, h[0], h[1], 1.5, '#4a2e1c', 0.3);
      [[-2.2, 6], [2.2, 6]].forEach(([d, dz]) => { const v = O.p((a + b) / 2 + d * 0.5, fv, 14 + dz); leaf(K, v[0], v[1], 3.2, 1.1, d < 0 ? -2.3 : -0.8, '#3f7d5c', 0.3); });
      const k = O.p(i ? a + 1.6 : b - 1.6, fv, HT * 0.45); K.ov(k[0], k[1], 0.9, 0.9, '#f2c14e', 0.3);
    });
    O.box(-0.6, -0.4, L + 1.2, dp + 0.8, HT, 2.4, K.sh(c, 0.06));
    const cr = O.p(L / 2, dp / 2, HT + 2.4); K.poly([[cr[0] - 7, cr[1]], [cr[0] - 4, cr[1] - 4], [cr[0], cr[1] - 5.5], [cr[0] + 4, cr[1] - 4], [cr[0] + 7, cr[1]]], K.sh(c, 0.12), 0.45);
  });

  // 장난감 상자 — 빨간 칠에 민속 꽃, 뚜껑을 열면 장난감이 삐져나온다
  def('toybox', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, HT = 12;
    K.shadow();
    O.box(1, 2, L - 2, W - 3, 0, HT, c, { t: K.sh(c, -0.45) });
    O.front(2.5, L - 2.5, W - 1, 2, HT - 2, K.sh(c, 0.1), 0.35);
    const m = O.p(L / 2, W - 1, HT / 2); selbu(K, m[0], m[1], 3.6, '#fff6e9'); K.ov(m[0], m[1], 0.8, 0.8, '#f2c14e');
    [[3, '#3f7d5c'], [L - 3, '#3f7d5c']].forEach(([u, col]) => { const p = O.p(u, W - 1, HT / 2); K.ov(p[0], p[1], 1, 1, col, 0.3); });
    // 안에서 삐져나온 것 — 공·곰 귀·블록
    const a = O.p(L * 0.35, W * 0.45, HT); K.ball(a[0], a[1] - 1.5, 3, 3, '#5d8fb8', 0.45); K.curve([[a[0] - 2.6, a[1] - 2], [a[0], a[1] - 0.6], [a[0] + 2.8, a[1] - 1.6]], '#fff6e9', 0.6);
    const b = O.p(L * 0.68, W * 0.5, HT); K.ball(b[0], b[1] - 2.4, 2.8, 2.6, '#c79b6d', 0.45); K.ov(b[0] - 2, b[1] - 4.6, 1.1, 1.1, '#a97b4f', 0.3); K.ov(b[0] + 2, b[1] - 4.6, 1.1, 1.1, '#a97b4f', 0.3);
    K.ov(b[0] - 0.9, b[1] - 2.8, 0.35, 0.35, '#3a2a20'); K.ov(b[0] + 0.9, b[1] - 2.8, 0.35, 0.35, '#3a2a20');
    O.box(L * 0.45, W * 0.6, 3, 3, HT - 1, 3, '#f2c14e', { w: 0.35 });
    // 열린 뚜껑 — 뒤로 젖혀 섰다
    O.box(0.6, 0.5, L - 1.2, 1.4, HT, 9, K.sh(c, 0.04), { t: K.sh(c, 0.2) });
    O.front(2, L - 2, 1.9, HT + 2, HT + 7, K.sh(c, 0.14), 0.3);
  });

  // ================= 불 · 물 · 빛 =================
  // 주물 장작 난로 — 다리 넷, 유리문 안에 불, 연통, 위에 주전자
  def('stove', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = '#3a3434', t = C.t || 0, HT = 26;
    K.shadow();
    O.top(-0.5, -0.5, L + 1, W + 1, 0.2, '#b9aa9c', 0.4);                                           // 불막이 돌판
    [[4, 4], [L - 4, 4], [4, W - 4], [L - 4, W - 4]].forEach(([u, v]) => O.box(u - 1, v - 1, 2, 2, 0, 5, c, { w: 0.35 }));
    O.box(2, 2, L - 4, W - 4, 5, HT - 5, c, { t: '#4a4444' });
    O.box(1.4, 1.4, L - 2.8, W - 2.8, HT, 2, '#4a4444');
    const fv = W - 2;
    O.front(5, L - 5, fv, 8, HT - 4, '#2a2424', 0.4);
    const fl = 0.85 + 0.15 * Math.sin(t / 110) + 0.08 * Math.sin(t / 43);
    K.light(() => {
      O.front(6, L - 6, fv, 9, HT - 5, K.lg(0, O.p(0, fv, HT - 5)[1], 0, O.p(0, fv, 9)[1], ['#3a1a10', '#ff8c2e', '#ffd166']));
      const b = O.p(L / 2, fv, 10); [[-3, 0.8], [0, 1], [3, 0.75]].forEach(([d, k], i) => { const hh = 8 * k * (fl + 0.06 * Math.sin(t / 70 + i * 2)); K.poly([[b[0] + d - 2.2, b[1]], [b[0] + d, b[1] - hh], [b[0] + d + 2.2, b[1]]], '#ffb347'); K.poly([[b[0] + d - 1.1, b[1]], [b[0] + d, b[1] - hh * 0.55], [b[0] + d + 1.1, b[1]]], '#fff3c0'); });
      K.ov(b[0], b[1] + 0.3, 5, 1, '#ff6a2a');
    });
    O.front(5, L - 5, fv, 8, HT - 4, null, 0.5); O.front(L / 2 - 0.3, L / 2 + 0.3, fv, 8, HT - 4, '#2a2424');
    const hd = O.p(L - 5.5, fv, HT - 8); K.ov(hd[0], hd[1], 1, 1.6, '#8a8f96', 0.3);
    // 연통
    O.cyl(L * 0.3, W * 0.35, 2.4, HT + 2, Math.max(8, C.H - HT - 6), '#2e2a2a');
    // 주전자
    const k = O.p(L * 0.68, W * 0.6, HT + 2); K.ball(k[0], k[1] - 2.6, 3.6, 2.8, '#d9483f', 0.45); K.ov(k[0], k[1] - 5, 1.4, 0.6, '#b83a33', 0.3);
    K.curve([[k[0] + 3, k[1] - 2.6], [k[0] + 5.5, k[1] - 4.6]], '#b83a33', 1); K.curve([[k[0] - 2.6, k[1] - 4.6], [k[0], k[1] - 7.4], [k[0] + 2.6, k[1] - 4.6]], '#3a3434', 0.6);
  });

  // 무쇠 장작 난로(오로라 농장) — 높은 검은 몸통, 큰 유리문 안에 자작나무 장작이 탄다(불꽃이 일렁임). 옆면엔 전나무 돋을새김,
  //   위엔 구리 커피 주전자, 연통은 올라가다 꺾여 벽으로 들어간다. 앞 오른쪽엔 자작나무 장작 바구니. lit 이면 불·바닥 불빛만
  def('woodstove', (g, C) => {
    const K = kit(g, C), O = K.O, p = O.p, t = C.t || 0, IR = '#2c2828', IR2 = '#3e3838';
    const u0 = 2.5, u1 = 15.5, v0 = 2.5, v1 = 14, zb = 4, zt = 33;                       // 몸통
    const du0 = u0 + 2, du1 = u1 - 2, dz0 = zb + 6.5, dz1 = zt - 6, dw = du1 - du0, dh = dz1 - dz0;   // 앞 유리문
    const fp = (s, z) => p(du0 + s, v1, dz0 + z);                                         // 유리문 안 평평한 좌표(s 가로, z 위로)
    const fire = () => {
      K.glow(...p((du0 + du1) / 2, v1 + 6, 0), 16, '255,150,60', 0.22 + 0.05 * Math.sin(t / 90));     // 문 앞 바닥에 떨어지는 불빛
      const win = [fp(0, 0), fp(dw, 0), fp(dw, dh), fp(0, dh)];
      g.save(); g.beginPath(); win.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.clip();
      const a = fp(dw / 2, dh), b = fp(dw / 2, 0);
      g.fillStyle = K.lg(0, a[1] - 4, 0, b[1] + 4, ['#1e0c08', '#6a2410', '#e8641e']); g.fillRect(a[0] - 16, a[1] - 10, 32, b[1] - a[1] + 20);
      g.fillStyle = K.rg(b[0], b[1] - 2, 9, ['rgba(255,214,120,.9)', 'rgba(255,120,40,.35)', 'rgba(255,90,30,0)']); g.fillRect(b[0] - 12, b[1] - 14, 24, 16);
      // 장작 둘 — 겉이 탄 자작나무, 밑이 벌겋다
      [[0.6, 1.4, dw - 0.8, 2.4], [1.2, 3.6, dw - 1.6, 2.2]].forEach(([s0, z0, s1, z1]) => { const l0 = fp(s0, z0), l1 = fp(s1, z1);
        K.curve([l0, l1], '#1a0e0a', 2.8); K.curve([l0, l1], '#4a2618', 1.8); K.curve([[l0[0], l0[1] + 0.9], [l1[0], l1[1] + 0.9]], '#ff7a2a', 0.5); K.ov(l1[0], l1[1], 0.9, 1.2, '#c9a070'); });
      // 불꽃 — 혀 다섯이 따로 흔들린다
      for (let i = 0; i < 5; i++){
        const s = 1.4 + i * (dw - 2.8) / 4, fh = 7 + 3.4 * Math.sin(t / 130 + i * 1.9) + 1.6 * Math.sin(t / 47 + i) - Math.abs(i - 2) * 1.2, sw = 1.4 * Math.sin(t / 90 + i * 2.3), bw = 1.8 + (i % 2) * 0.6;
        const [bx, by] = fp(s, 3.4);
        g.beginPath(); g.moveTo(bx - bw, by); g.bezierCurveTo(bx - bw, by - fh * 0.5, bx + sw - 0.5, by - fh * 0.8, bx + sw, by - fh); g.bezierCurveTo(bx + sw + 0.5, by - fh * 0.8, bx + bw, by - fh * 0.5, bx + bw, by); g.closePath();
        g.fillStyle = K.lg(0, by - fh, 0, by, ['rgba(255,236,160,.85)', '#ffa42e', '#ff5a1a']); g.fill();
        g.beginPath(); g.moveTo(bx - bw * 0.45, by); g.quadraticCurveTo(bx + sw * 0.6, by - fh * 0.75, bx + sw * 0.5, by - fh * 0.62); g.quadraticCurveTo(bx + bw * 0.45, by - fh * 0.3, bx + bw * 0.45, by); g.closePath();
        g.fillStyle = 'rgba(255,248,210,.85)'; g.fill();
      }
      for (let i = 0; i < 4; i++){ const e = fp(1 + hash(i + 3) * (dw - 2), 4 + ((t / 70 + i * 3.1) % 8)); K.ov(e[0] + Math.sin(t / 200 + i) * 0.6, e[1], 0.3, 0.3, '#ffd27a'); }   // 불티
      for (let i = 0; i < 7; i++){ const e = fp(0.6 + i * (dw - 1.2) / 6, 0.8); K.ov(e[0], e[1], 0.9, 0.55, i % 2 ? '#ff6a1a' : '#ffb84a'); }   // 숯불
      g.restore();
    };
    if (C.lit){ K.light(fire); return; }
    K.shadow();
    // 불막이 판 — 짙은 점판암 네 장
    O.top(0.5, 0.5, 18, 17, 0.4, '#5e5a58', 0.45);
    O.top(0.5, 0.5, 9, 8.5, 0.45, '#6a6664'); O.top(9.5, 9, 9, 8.5, 0.45, '#6a6664');
    K.ln(p(9.5, 0.5, 0.45), p(9.5, 17.5, 0.45), '#3e3a38', 0.3); K.ln(p(0.5, 9, 0.45), p(18.5, 9, 0.45), '#3e3a38', 0.3);
    // 굽은 다리 넷
    [[u0 + 1.4, v0 + 1.4], [u1 - 1.4, v0 + 1.4], [u0 + 1.4, v1 - 1.4], [u1 - 1.4, v1 - 1.4]].forEach(([u, v]) => { O.box(u - 1.2, v - 1.2, 2.4, 2.4, 0.4, zb - 0.4, IR, { w: 0.35 }); const f = p(u, v, 0.6); K.ov(f[0], f[1], 1.9, 0.9, IR2, 0.3); });
    O.box(u0 - 0.5, v0 - 0.5, u1 - u0 + 1, v1 - v0 + 1, zb, 2.4, IR2, { w: 0.4 });                        // 밑 띠
    O.box(u0, v0, u1 - u0, v1 - v0, zb + 2.4, zt - zb - 2.4, IR, { t: IR2 });
    O.front(u0 + 0.5, u0 + 1.3, v1, zb + 3, zt - 1, 'rgba(255,255,255,.07)');                             // 무쇠 윤
    O.box(u0 - 0.9, v0 - 0.9, u1 - u0 + 1.8, v1 - v0 + 1.8, zt, 1.6, IR2, { t: '#4c4646', w: 0.45 });    // 윗판
    O.box(u0 - 0.3, v0 - 0.3, u1 - u0 + 0.6, v1 - v0 + 0.6, zt + 1.6, 0.8, IR, { w: 0.35 });
    // 옆면 — 돋을새김 틀에 전나무와 별
    const tv = (v0 + v1) / 2;
    O.end(v0 + 1.4, v1 - 1.4, u1, zb + 4.5, zt - 2.5, null, 0.35);
    for (let k = 0; k < 3; k++){ const zA = zt - 6 - k * 5.2, hw = 1.8 + k * 1.1; K.poly([p(u1, tv, zA), p(u1, tv + hw, zA - 6), p(u1, tv - hw, zA - 6)], '#3c3535', 0.3); K.ln(p(u1, tv, zA), p(u1, tv + hw, zA - 6), '#5a5252', 0.3); }
    K.poly([p(u1, tv - 0.5, zb + 7.6), p(u1, tv + 0.5, zb + 7.6), p(u1, tv + 0.5, zb + 5.4), p(u1, tv - 0.5, zb + 5.4)], '#3c3535', 0.3);
    const st = p(u1, tv, zt - 4.6); K.ov(st[0], st[1], 0.7, 0.7, '#5a5252');
    // 앞 — 재 서랍, 공기 미닫이, 문틀
    O.front(du0, du1, v1, zb + 2.8, zb + 5.2, '#1e1a1a', 0.35); const kn = p((du0 + du1) / 2, v1, zb + 4); K.ov(kn[0], kn[1], 0.8, 0.5, '#8a8f96', 0.25);
    O.front(du0 - 1, du1 + 1, v1, dz0 - 1, dz1 + 1, IR2, 0.45);
    fire();
    K.poly([fp(0.6, dh - 0.4), fp(2.6, dh - 0.4), fp(0.6, dh - 4.6)], 'rgba(255,255,255,.14)');               // 유리 비침
    K.poly([fp(3.4, dh - 0.4), fp(4.4, dh - 0.4), fp(0.6, dh - 6.8), fp(0.6, dh - 5.4)], 'rgba(255,255,255,.08)');
    O.front(du0, du1, v1, dz0, dz1, null, 0.5);
    O.front(du0 - 1, du1 + 1, v1, dz1 + 1.6, dz1 + 2.6, '#1e1a1a', 0.3);                                       // 공기 틈
    [dz0 + 1.5, dz1 - 1.5].forEach(z => { const h = p(du0 - 0.5, v1, z); K.ov(h[0], h[1], 0.5, 0.9, '#5a5656', 0.25); });   // 경첩
    for (let k = 0; k < 5; k++){ const s = p(du1 + 0.5, v1, dz0 + dh * 0.35 + k * 0.9); K.ov(s[0], s[1], 0.8, 0.4, k % 2 ? '#c8ccd2' : '#8a8f96', 0.2); }   // 용수철 손잡이
    // 연통 — 올라가다 꺾여 벽으로
    const pu = (u0 + u1) / 2 + 1.5, pv = v0 + 3.6, zE = Math.max(zt + 14, Math.min(60, C.H - 10));
    O.cyl(pu, pv, 3, zt + 2.4, 1.6, IR2, 0.4);
    O.cyl(pu, pv, 2.5, zt + 4, zE - zt - 4, '#262222', 0.45, '#262222');
    const dm = p(pu, pv, zt + 13); K.ln([dm[0] - 4.2, dm[1] - 0.6], [dm[0] + 3.4, dm[1] + 1], '#4c4646', 0.7); K.ov(dm[0] - 4.4, dm[1] - 0.7, 0.8, 0.8, '#8a8f96', 0.25);   // 바람막이 손잡이
    const pe = p(pu, pv, zE), pw = p(pu, pv - 7, zE + 3.5);
    K.curve([pe, pw], 'rgba(22,30,48,.72)', 6.4); K.curve([pe, pw], '#2a2626', 5.4); K.curve([[pe[0] - 1, pe[1] - 1.6], [pw[0] - 1, pw[1] - 1.6]], '#4a4444', 0.8);
    K.ov(pe[0], pe[1] - 0.6, 3.6, 2.6, '#2a2626'); K.ov(pw[0], pw[1], 2.4, 3.6, '#3e3838', 0.4);             // 꺾인 마디·벽 테
    // 위 — 무쇠 받침에 구리 커피 주전자, 김
    const cp = p(u0 + 3.6, v1 - 3.4, zt + 2.4);
    K.ov(cp[0], cp[1], 3.6, 1.6, '#1e1a1a');
    K.poly([[cp[0] - 3.2, cp[1]], [cp[0] + 3.2, cp[1]], [cp[0] + 2, cp[1] - 5.6], [cp[0] - 2, cp[1] - 5.6]], K.lg(cp[0] - 3, 0, cp[0] + 3, 0, ['#f0a868', '#c87a3a', '#8a4a20']), 0.45);
    K.ov(cp[0], cp[1] - 5.6, 2, 0.7, '#e09050', 0.35); K.ov(cp[0], cp[1] - 6.5, 0.7, 0.6, '#2a2626', 0.25);
    K.curve([[cp[0] + 2.4, cp[1] - 2], [cp[0] + 4.6, cp[1] - 4.2], [cp[0] + 5, cp[1] - 5.6]], '#a8602c', 0.9);
    K.curve([[cp[0] - 2.2, cp[1] - 4.8], [cp[0] - 4.4, cp[1] - 3.6], [cp[0] - 3, cp[1] - 1]], '#2a2626', 0.7);
    K.ln([cp[0] - 1.6, cp[1] - 4.4], [cp[0] - 1.2, cp[1] - 1], 'rgba(255,240,210,.55)', 0.5);
    for (let k = 0; k < 3; k++){ const ph = ((t / 1800 + k / 3) % 1), sx = cp[0] + 5.4 + Math.sin(ph * 5 + k) * 1.2, sy = cp[1] - 6.4 - ph * 8;   // 김 — 몽글몽글 올라가며 옅어진다
      K.ov(sx, sy, 0.9 + ph * 1.4, 0.7 + ph * 1, 'rgba(255,255,255,' + (0.38 * (1 - ph)).toFixed(2) + ')'); }
    // 장작 바구니 — 버들 바구니에 자작나무 장작
    const bu = 20.4, bv = 15.2, br = 3.4;
    O.cyl(bu, bv, br, 0.2, 7.2, '#b07c40', 0.45, '#4a3020');
    for (let z = 1.4; z < 7; z += 1.5) K.curve(Array.from({ length: 9 }, (_, i) => { const a = -Math.PI / 4 + i * Math.PI / 8; return p(bu + Math.cos(a) * br * 1.01, bv + Math.sin(a) * br * 1.01, z); }), '#7a5028', 0.35);
    for (let i = 0; i < 6; i++){ const a = -Math.PI / 4 + (i + 0.5) * Math.PI / 6; K.ln(p(bu + Math.cos(a) * br, bv + Math.sin(a) * br, 0.4), p(bu + Math.cos(a) * br, bv + Math.sin(a) * br, 7), 'rgba(90,56,26,.45)', 0.3); }
    [[-1.3, -1.1, -0.25, -0.35], [0.9, -1.3, 0.2, -0.4], [-0.7, 0.7, -0.35, 0.15], [1.2, 0.8, 0.3, 0.2]].forEach(([du, dv, lu, lv], i) => {
      const a = p(bu + du, bv + dv, 4), b = p(bu + du + lu * 3, bv + dv + lv * 3, 13.6 - i * 1.1);
      K.curve([a, b], 'rgba(22,30,48,.72)', 2.6); K.curve([a, b], '#efe8da', 1.9);
      for (let k = 1; k < 4; k++){ const m = [a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4]; K.ln([m[0] - 0.9, m[1] + 0.2 * (k % 2)], [m[0] + 0.3, m[1] - 0.1], '#2a2420', 0.45); }
      K.ov(b[0], b[1], 1, 0.65, '#e2b884', 0.35); K.ov(b[0], b[1], 0.45, 0.3, '#b88850');
    });
  });

  // 어항 — 나무 받침, 물빛 그러데이션, 물풀·조약돌, 헤엄치는 물고기, 거품
  def('tank', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, t = C.t || 0, SB = 12, TH = 20;
    K.shadow();
    O.box(1, 1, L - 2, W - 2, 0, SB, '#c79b6d', { t: '#ddb88c' });
    O.front(2.5, L - 2.5, W - 1, 2, SB - 2, '#d8ad7e', 0.35); const kb = O.p(L / 2, W - 1, SB / 2); K.ov(kb[0], kb[1], 0.9, 0.9, '#8a5f3a', 0.3);
    const z0 = SB, z1 = SB + TH;
    // 물 — 뒤판·옆판을 먼저, 안의 것, 앞 유리는 맨 나중
    const wa = C.lit ? 0.22 : 0.75;                                                // lit 겹은 물빛만 얇게 — 안의 물고기가 비쳐야 한다
    K.light(() => { O.end(2, W - 2, L - 2, z0, z1 - 2, K.lg(0, O.p(L, 2, z1)[1], 0, O.p(L, 2, z0)[1], ['rgba(170,225,250,' + wa + ')', 'rgba(70,150,210,' + wa + ')'])); if (C.lit) O.front(2, L - 2, W - 2, z0, z1 - 2, 'rgba(150,215,245,' + wa + ')'); else O.front(2, L - 2, W - 2, z0, z1 - 2, K.lg(0, O.p(0, W, z1)[1], 0, O.p(0, W, z0)[1], ['rgba(170,225,250,0.7)', 'rgba(80,160,220,0.78)'])); });
    if (!C.lit){
      O.top(2, 2, L - 4, W - 4, z0 + 2, '#e3cf9a'); O.front(2, L - 2, W - 2, z0, z0 + 2, '#d4bb82');
      [[5, W - 5, '#9a9aa6'], [L - 6, W - 4, '#c9b9a4'], [L / 2, W - 3.5, '#7f8a9a']].forEach(([u, v, col]) => { const p = O.p(u, v, z0 + 2); K.ball(p[0], p[1] - 0.6, 1.6, 1, col, 0.3); });
      [[5, 5, 0], [L - 5, 6, 1.5], [7, W - 6, 3]].forEach(([u, v, ph]) => { const p = O.p(u, v, z0 + 2); for (let k = 0; k < 3; k++){ const sw = Math.sin(t / 600 + ph + k) * 1.2; K.curve([[p[0] + k - 1, p[1]], [p[0] + k - 1 + sw, p[1] - 6], [p[0] + k - 1 - sw * 0.5, p[1] - 11 - k]], k % 2 ? '#3f9a5a' : '#5db86a', 1); } });
      [0, 1].forEach(i => { const ph = t / 1800 + i * 3.1, u = L / 2 + Math.sin(ph) * (L / 2 - 6), v = W / 2 + Math.cos(ph * 0.8) * 2, p = O.p(u, v, z0 + 8 + i * 5), dir = Math.cos(ph) > 0 ? 1 : -1, col = i ? '#ffd166' : '#ff8c2e';
        K.ball(p[0], p[1], 2.2, 1.4, col, 0.35); K.poly([[p[0] - dir * 1.8, p[1]], [p[0] - dir * 3.8, p[1] - 1.6], [p[0] - dir * 3.8, p[1] + 1.6]], col, 0.35); K.ov(p[0] + dir * 1, p[1] - 0.3, 0.35, 0.35, '#1c1c24'); });
      for (let i = 0; i < 4; i++){ const k = ((t / 1400 + i * 0.27) % 1), p = O.p(L - 5, 5, z0 + 3 + k * (TH - 6)); K.ov(p[0] + Math.sin(k * 9) * 0.6, p[1], 0.6 + k * 0.3, 0.6 + k * 0.3, 'rgba(255,255,255,.7)'); }
    }
    K.light(() => { O.top(2, 2, L - 4, W - 4, z1 - 2, 'rgba(200,240,255,' + (C.lit ? 0.25 : 0.55) + ')'); const s = O.p(4, W - 2, z1 - 4); K.poly([[s[0], s[1]], [s[0] + 2, s[1] + 1], [s[0] + 2, s[1] + 8], [s[0], s[1] + 7]], 'rgba(255,255,255,.4)'); });
    if (!C.lit){ O.box(1, 1, L - 2, W - 2, z0, TH, null, { f: 'rgba(0,0,0,0)', r: 'rgba(0,0,0,0)', top: false, w: 0.45 }); O.box(0.6, 0.6, L - 1.2, W - 1.2, z1, 2, '#3f7d5c'); O.top(3, 3, L - 6, W - 6, z1 + 2.05, '#2f6448'); }
  });

  // 별 프로젝터 — 별 구멍이 뚫린 둥근 갓이 은은히 빛나고, 둘레 바닥에 별빛이 떨어진다
  def('nightsky', (g, C) => {
    const K = kit(g, C), c = C.c, t = C.t || 0, x = C.CX, y = C.CY, br = 0.82 + 0.18 * Math.sin(t / 1400);
    if (!C.lit) K.blob(x, y, 9, 3.6);
    K.poly([[x - 7, y], [x + 7, y], [x + 5, y - 5], [x - 5, y - 5]], K.lg(x - 7, 0, x + 7, 0, ['#ecd2ac', '#c79b6d', '#8a5f3a']), 0.5);   // 나무 받침
    K.ov(x, y, 7, 2.2, '#b98a5e', 0.45);
    K.ov(x, y - 5, 5.6, 1.8, '#d8b48a', 0.4);
    K.light(() => { K.glow(x, y - 13, 16 * br, '255,240,190', 0.22); });
    K.ball(x, y - 12, 8.6, 8, c, 0.5);
    K.light(() => { for (let i = 0; i < 9; i++){ const a = -2.7 + i * 0.32, rr = 4 + (i % 3) * 1.7, px = x + Math.cos(a) * rr * 1.2, py = y - 12 + Math.sin(a) * rr * 0.9 + 2; const s = 0.7 + (i % 2) * 0.3; K.poly([[px, py - s * 1.6], [px + s * 0.5, py - s * 0.5], [px + s * 1.6, py], [px + s * 0.5, py + s * 0.5], [px, py + s * 1.6], [px - s * 0.5, py + s * 0.5], [px - s * 1.6, py], [px - s * 0.5, py - s * 0.5]], 'rgba(255,243,192,' + (0.6 + 0.4 * br) + ')'); } });
    K.ov(x - 3, y - 16.5, 2.6, 1.4, 'rgba(255,255,255,.35)');
    K.light(() => { [[-15, -2], [13, -6], [-11, 5], [16, 4], [-3, -26], [7, -24]].forEach(([dx, dy], i) => { const s = (0.8 + 0.3 * Math.sin(t / 500 + i)) * br; K.ov(x + dx, y + dy, s, s * (dy > -10 ? 0.5 : 1), 'rgba(255,243,192,.85)'); }); });
  });

  // 호박 등 — 짚 방석 위에, 파낸 얼굴이 빛난다
  def('pumpkin', (g, C) => {
    const K = kit(g, C), c = C.c, t = C.t || 0, x = C.CX, y = C.CY, fl = 0.85 + 0.15 * Math.sin(t / 90);
    if (!C.lit){ K.blob(x, y, 11, 4); K.ov(x, y - 0.5, 11, 3.6, '#d8b86a', 0.45); for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; K.ln([x + Math.cos(a) * 7, y - 0.5 + Math.sin(a) * 2.2], [x + Math.cos(a) * 11, y - 0.5 + Math.sin(a) * 3.6], '#b8984e', 0.3); } }
    [[-6, 0.8], [6, 0.8], [-3, 1], [3, 1], [0, 1.05]].forEach(([d, k]) => K.ball(x + d, y - 9, 5.4 * k, 9 * (0.92 + k * 0.08), c, 0.5));
    K.light(() => {
      const fc = 'rgba(255,' + Math.round(200 + 30 * fl) + ',110,1)';
      K.poly([[x - 6, y - 12], [x - 2.5, y - 11.5], [x - 4.5, y - 15]], fc); K.poly([[x + 6, y - 12], [x + 2.5, y - 11.5], [x + 4.5, y - 15]], fc);
      K.poly([[x - 5.5, y - 7], [x - 3, y - 5], [x - 1.5, y - 6.4], [x, y - 4.6], [x + 1.5, y - 6.4], [x + 3, y - 5], [x + 5.5, y - 7], [x + 3, y - 3.4], [x - 3, y - 3.4]], fc);
    });
    K.poly([[x - 1, y - 17.5], [x + 1.4, y - 17.5], [x + 2.4, y - 21], [x + 0.6, y - 21.4]], '#5a7a3a', 0.4); leaf(K, x + 1.5, y - 18, 5, 1.6, -0.4, '#4f9a48', 0.35);
    K.curve([[x - 1, y - 18.5], [x - 4, y - 21], [x - 2, y - 23]], '#4f9a48', 0.5);
  });

  // 겨울 나무 — 뜨개 바구니 화분에 전나무, 빨간 공·짚 별 장식, 반짝이 전구, 꼭대기 금별
  def('xmas', (g, C) => {
    const K = kit(g, C), c = C.c, t = C.t || 0, x = C.CX, y = C.CY, top = y - Math.min(C.H, 66);
    if (!C.lit) K.blob(x, y, 11, 4);
    K.poly([[x - 6.5, y - 9], [x + 6.5, y - 9], [x + 5.5, y], [x - 5.5, y]], K.lg(x - 6, 0, x + 6, 0, ['#f4ead6', '#e2d2b4', '#b8a684']), 0.5);   // 뜨개 바구니
    for (let k = 0; k < 3; k++) K.curve([[x - 6, y - 7 + k * 2.6], [x - 2, y - 6.2 + k * 2.6], [x + 2, y - 7 + k * 2.6], [x + 6, y - 6.2 + k * 2.6]], '#c9b48e', 0.4);
    K.ov(x, y - 9, 6.6, 1.6, '#e2d2b4', 0.45);
    K.poly([[x - 1.2, y - 9], [x + 1.2, y - 9], [x + 1.2, y - 14], [x - 1.2, y - 14]], '#6a4a36');
    const tiers = 4, H = y - 12 - top - 4;
    for (let i = 0; i < tiers; i++){
      const yb = y - 12 - i * H / tiers * 0.82, yt = yb - H / tiers * 1.45, hw = 13 - i * 2.8;
      const pts = [[x, yt]]; for (let k = 0; k <= 8; k++){ const f = k / 8; pts.push([x + hw - f * hw * 2, yb + (k % 2 ? 0.8 : -0.6) - Math.sin(f * Math.PI) * 1.2]); }
      pts.splice(1, 0); K.poly([[x, yt]].concat(pts.slice(1)), K.lg(x - hw, 0, x + hw, 0, [C.shade(c, 0.22), c, C.shade(c, -0.35)]), 0.5);
      K.poly([[x, yt], [x - hw * 0.45, yb - 2], [x - hw * 0.15, yb - 3]], 'rgba(255,255,255,.12)');
      if (!C.lit){ K.curve([[x - hw * 0.8, yb - 1.6], [x, yb - 0.4 - 1.2], [x + hw * 0.8, yb - 2.6]], '#f2e6cc', 0.45); }   // 짚 줄
    }
    if (!C.lit){ [[-6, -18, '#d9483f'], [5, -24, '#d9483f'], [-3, -32, '#5d8fb8'], [4, -40, '#d9483f'], [-1, -48, '#f2c14e']].forEach(([dx, dy, col]) => K.ball(x + dx, y + dy, 1.6, 1.6, col, 0.3));
      [[2, -16], [-6, -29], [6, -34]].forEach(([dx, dy]) => { const s = 1.6, px = x + dx, py = y + dy; K.ln([px - s, py], [px + s, py], '#e8c870', 0.4); K.ln([px, py - s], [px, py + s], '#e8c870', 0.4); K.ln([px - s * 0.7, py - s * 0.7], [px + s * 0.7, py + s * 0.7], '#e8c870', 0.4); K.ln([px - s * 0.7, py + s * 0.7], [px + s * 0.7, py - s * 0.7], '#e8c870', 0.4); }); }
    K.light(() => { [[-9, -14], [-1, -13], [8, -15], [-5, -23], [3, -21], [-7, -27], [7, -29], [0, -31], [-4, -38], [4, -44], [-2, -42], [2, -50]].forEach(([dx, dy], i) => { const on = 0.55 + 0.45 * Math.abs(Math.sin(t / 420 + i * 1.3)); K.glow(x + dx, y + dy, 2.6, '255,220,130', 0.5 * on); K.ov(x + dx, y + dy, 0.8, 0.8, i % 3 ? '#ffe9a8' : '#fff6d0'); });
      const sy = top + 5, s = 4; K.glow(x, sy, 10, '255,217,121', 0.35); const st = []; for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.45 : s; st.push([x + Math.cos(a) * r, sy + Math.sin(a) * r]); } K.poly(st, '#ffd979', 0.45); });
  });

  // ================= 놀 것 =================
  // 놀이 텐트 — 맞배 천막, 앞쪽 끝에 젖혀 묶은 문, 깃발 줄
  def('tent', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, HT = Math.min(42, C.H - 6), p = O.p;
    K.shadow();
    O.top(0.5, 0.5, L - 1, W - 1, 0.4, '#e8dcc8', 0.4);                                              // 바닥 매트
    const vm = W / 2, a0 = p(1, vm, HT), a1 = p(L - 1, vm, HT), f0 = p(1, W, 0), f1 = p(L - 1, W, 0), b1 = p(L - 1, 0, 0);
    // 앞쪽 비탈 — 세로 줄무늬(c 와 크림)
    const n = 6; for (let i = 0; i < n; i++){ const u0 = 1 + (L - 2) * i / n, u1 = 1 + (L - 2) * (i + 1) / n; K.poly([p(u0, vm, HT), p(u1, vm, HT), p(u1, W, 0), p(u0, W, 0)], i % 2 ? '#fff6e9' : c, 0.3); }
    K.poly([p(1, vm, HT), p(L - 1, vm, HT), p(L - 1, W, 0), p(1, W, 0)], K.lg(0, a0[1], 0, f0[1], ['rgba(255,255,255,.12)', 'rgba(0,0,0,.12)']), 0.5);
    // 끝 박공 — 안이 어둡고 문을 양쪽으로 젖혔다
    const eg = [a1, f1, b1]; K.poly(eg, C.shade(c, -0.15), 0.5);
    const m = p(L - 1, vm, 0), dh = p(L - 1, vm, HT * 0.82);
    K.poly([dh, p(L - 1, vm + W * 0.32, 0), p(L - 1, vm - W * 0.32, 0)], '#4a3a2e', 0.4);
    K.light(() => { if (C.night) [0, 1, 2].forEach(i => K.ov(m[0] + (i - 1) * 3, m[1] - 4 - i, 0.6, 0.6, '#ffe9a8')); });
    K.poly([dh, p(L - 1, vm + W * 0.32, 0), p(L - 1, vm + W * 0.5, 0)], '#fff6e9', 0.4); K.poly([dh, p(L - 1, vm - W * 0.32, 0), p(L - 1, vm - W * 0.5, 0)], '#fff6e9', 0.4);
    const tie = p(L - 1, vm - W * 0.4, HT * 0.3); K.ov(tie[0], tie[1], 1, 0.7, '#d9483f', 0.3);
    // 장대 끝이 꼭대기에서 엇갈린다
    [a0, a1].forEach(a => { K.ln(a, [a[0] - 2.5, a[1] - 4], '#8a5f3a', 0.9); K.ln(a, [a[0] + 2.5, a[1] - 4], '#8a5f3a', 0.9); });
    K.ln(a0, a1, '#8a5f3a', 0.7);
    // 깃발 줄
    const fl = ['#d9483f', '#f2c14e', '#3f7d5c', '#5d8fb8', '#fff6e9'];
    for (let i = 0; i < 7; i++){ const u = 2 + (L - 4) * i / 6, s = p(u, vm + (W / 2) * 0.35, HT * 0.62 - Math.sin(i / 6 * Math.PI) * 2); K.poly([[s[0] - 1.3, s[1]], [s[0] + 1.3, s[1] + 0.6], [s[0] + 0.2, s[1] + 3.2]], fl[i % 5], 0.3); }
    K.curve(Array.from({ length: 7 }, (_, i) => p(2 + (L - 4) * i / 6, vm + (W / 2) * 0.35, HT * 0.62 - Math.sin(i / 6 * Math.PI) * 2 + 0.2)), '#8a7b6e', 0.3);
  });

  // 미끄럼틀 — 나무 사다리와 발판, 둥근 테 미끄럼판
  def('slide', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, PZ = Math.min(26, C.H - 14), v0 = 3, v1 = W - 3;
    K.shadow();
    [[2, v0], [2, v1], [10, v0], [10, v1]].forEach(([u, v]) => O.box(u - 1, v - 1, 2, 2, 0, PZ + (u < 5 ? 12 : 0), '#c79b6d', { w: 0.35 }));
    for (let i = 1; i < 5; i++) O.box(0.8, v0, 1.6, v1 - v0, PZ * i / 5 - 0.6, 1.2, '#ddb88c', { w: 0.3 });   // 사다리 칸
    O.box(1, v0 - 1, 10, v1 - v0 + 2, PZ, 2, '#d8ad7e');                                                // 발판
    [v0 - 1, v1 + 1].forEach(v => { K.ln(O.p(1, v, PZ + 2), O.p(1, v, PZ + 12), '#c79b6d', 0.9); K.ln(O.p(1, v, PZ + 9), O.p(11, v, PZ + 9), '#c79b6d', 0.9); });
    // 미끄럼판 — 경사면, 양 옆 테
    const u0 = 11, u1 = L - 2, zs = z => z;
    const sl = (u, v, dz) => O.p(u, v, (u <= u0 ? PZ : u >= u1 - 4 ? 1.5 : PZ - (PZ - 1.5) * Math.pow((u - u0) / (u1 - 4 - u0), 0.9)) + (dz || 0));
    const N = 12, top0 = [], top1 = [], bot1 = [];
    for (let i = 0; i <= N; i++){ const u = u0 + (u1 - u0) * i / N; top0.push(sl(u, v0, 1.6)); top1.push(sl(u, v1, 1.6)); bot1.push(sl(u, v1, -1)); }
    K.poly(top0.concat(top1.slice().reverse()), K.lg(top0[0][0], 0, top0[N][0], 0, [C.shade(c, 0.2), c]), 0.4);
    for (let i = 0; i <= N; i++){ const u = u0 + (u1 - u0) * i / N; top0[i] = sl(u, v0 + 1, 0.6); top1[i] = sl(u, v1 - 1, 0.6); }
    K.poly(top0.concat(top1.slice().reverse()), K.lg(0, 0, 0, 1, [C.shade(c, 0.32), C.shade(c, 0.22)]));
    K.poly(top1.map((p, i) => sl(u0 + (u1 - u0) * i / N, v1, 1.6)).concat(bot1.slice().reverse()), C.shade(c, -0.22), 0.4);   // 앞 테 옆면
    K.curve(Array.from({ length: N + 1 }, (_, i) => sl(u0 + (u1 - u0) * i / N, v1, 1.6)), '#fff6e9', 0.5);
    const e = O.p(u1, v1, 0), e2 = O.p(u1, v0, 0); K.ln(e, O.p(u1, v1, 1.5), '#8a5f3a', 0.6); K.ln(e2, O.p(u1, v0, 1.5), '#8a5f3a', 0.6);
    void zs;
  });

  // 나무 썰매 — 앞이 말려 올라간 날, 빨간 앉는 널, 초록 체크 담요
  def('sled', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = C.c, p = O.p;
    K.shadow(0.8);
    [3, W - 3].forEach(v => {
      const run = []; for (let i = 0; i <= 10; i++){ const u = 3 + (L - 10) * i / 10; run.push(p(u, v, 0.6)); } for (let i = 0; i <= 8; i++){ const a = i / 8 * Math.PI * 1.1; run.push(p(L - 7 + Math.sin(a) * 4, v, 4 - Math.cos(a) * 4 + 0.6)); }
      K.curve(run, '#2a221b', 1.6); K.curve(run, '#5e3a20', 1);
      [8, L / 2, L - 12].forEach(u => K.ln(p(u, v, 0.8), p(u, v, 7), '#8a5a34', 1));
    });
    for (let u = 5; u < L - 10; u += 4.4) O.box(u, 1.5, 3.6, W - 3, 7, 1.6, c, { t: C.shade(c, 0.14), w: 0.35 });
    O.box(L / 2 - 8, 3, 16, W - 6, 8.6, 3, '#fffaf2', { w: 0.4 });
    for (let u = L / 2 - 7; u < L / 2 + 8; u += 3) O.top(u, 3, 1.2, W - 6, 11.65, '#3f7d5c');
    for (let v = 4; v < W - 3; v += 3) O.top(L / 2 - 8, v, 16, 1.2, 11.7, 'rgba(63,125,92,.75)');
    K.curve([p(L - 4, 3, 7.5), p(L + 1, W / 2, 10), p(L - 4, W - 3, 7.5)], '#c9a24a', 0.5);              // 끄는 줄
  });

  // 흔들목마 — 달라 호스처럼 민속 꽃 안장, 빨간 갈기, 둥근 흔들 다리
  def('rocker', (g, C) => {
    const K = kit(g, C), c = C.c, t = C.t || 0, x = C.CX, y = C.CY, rk = Math.sin(t / 900) * 0.04;
    if (!C.lit) K.blob(x, y, 13, 3.6);
    const g2 = g; if (!C.lit){ g2.save(); g2.translate(x, y); g2.rotate(rk); g2.translate(-x, -y); }
    K.curve([[x - 15, y - 6], [x - 8, y - 1.2], [x, y], [x + 8, y - 1.2], [x + 15, y - 6]], '#6f4a2c', 3); K.curve([[x - 15, y - 6], [x - 8, y - 1.2], [x, y], [x + 8, y - 1.2], [x + 15, y - 6]], '#a97b4f', 1.8);
    [[-8, -2], [-4, -1], [5, -1], [9, -2]].forEach(([dx, dy]) => K.poly([[x + dx - 1, y + dy], [x + dx + 1, y + dy], [x + dx + (dx < 0 ? 1.5 : -0.5), y - 12], [x + dx + (dx < 0 ? -0.5 : -2.5), y - 12]], C.shade(c, -0.1), 0.4));
    K.ball(x - 1, y - 15, 11, 5.4, c, 0.5);                                                                // 몸통
    K.poly([[x - 11, y - 16], [x - 15, y - 13], [x - 14.5, y - 11.5], [x - 10.5, y - 14.5]], '#d9483f', 0.4);   // 꼬리
    K.poly([[x + 6, y - 18], [x + 9, y - 28], [x + 12, y - 30], [x + 15, y - 27.5], [x + 16, y - 24], [x + 13, y - 23], [x + 11, y - 17]], K.lg(x + 6, y - 30, x + 16, y - 17, [C.shade(c, 0.25), c, C.shade(c, -0.2)]), 0.5);   // 목과 머리
    K.poly([[x + 8.5, y - 27], [x + 10, y - 33], [x + 11.6, y - 29.6]], c, 0.4);                           // 귀
    K.poly([[x + 6.5, y - 18], [x + 8.5, y - 28.5], [x + 10.5, y - 30.5], [x + 9, y - 26], [x + 8.5, y - 19]], '#d9483f', 0.4);   // 갈기
    K.ov(x + 12.6, y - 26.6, 0.7, 0.7, '#3a2a20'); K.ov(x + 15, y - 24.6, 0.9, 0.6, '#e8949a');
    K.curve([[x + 9, y - 25], [x + 13, y - 23.6], [x + 15.6, y - 24.4]], '#3f7d5c', 0.6);                 // 굴레
    K.poly([[x - 5, y - 20], [x + 3, y - 20], [x + 4, y - 14], [x - 6, y - 14]], '#3f7d5c', 0.4);           // 안장 — 민속 꽃
    selbu(K, x - 1, y - 17, 2.6, '#fff6e9'); K.ov(x - 1, y - 17, 0.6, 0.6, '#f2c14e');
    K.curve([[x - 9, y - 13], [x - 5, y - 11.6], [x - 1, y - 12.4]], '#fff6e9', 0.5); K.curve([[x + 3, y - 12.4], [x + 7, y - 11.6], [x + 9, y - 13]], '#fff6e9', 0.5);
    if (!C.lit) g2.restore();
  });

  // 뜨개 담요 흔들의자(오로라 농장) — 소나무 흔들의자(살 등받이, 하트 파낸 머리판, 둥근 흔들 다리). 셀부 별 뜨개 담요가
  //   머리판에 걸쳐 앉는 자리까지 늘어지고, 크림 쿠션 하나. 발치엔 털실 공과 바늘. 등은 v 작은 쪽(벽 쪽), 천천히 흔들린다
  def('rockchair', (g, C) => {
    const K = kit(g, C), p = K.O.p, t = C.t || 0, W0 = '#b47c48', WD = '#6e4428', RED = '#c9463f', CR = '#f4ead6', GR = '#3f7d5c';
    if (C.lit) return;
    const stick = (a, b, w, col) => { K.curve([a, b], 'rgba(22,30,48,.72)', w + 0.8); K.curve([a, b], col || W0, w); K.curve([[a[0] - w * 0.2, a[1]], [b[0] - w * 0.2, b[1]]], 'rgba(255,240,210,.35)', w * 0.3); };
    K.blob(C.CX, C.CY + 1, 15, 5);
    const pv = p(12, 12, 0); g.save(); g.translate(pv[0], pv[1]); g.rotate(Math.sin(t / 1100) * 0.03); g.translate(-pv[0], -pv[1]);
    // 흔들 다리 — 두 끝이 들린 활
    [5.5, 18.5].forEach(u => { const run = Array.from({ length: 17 }, (_, i) => { const v = -0.5 + 25 * i / 16; return p(u, v, 0.4 + Math.pow((v - 12) / 12.5, 2) * 3.4); });
      K.curve(run, 'rgba(22,30,48,.72)', 2.6); K.curve(run, WD, 1.8); K.curve(run.map(q => [q[0], q[1] - 0.5]), W0, 0.6); });
    // 뒷기둥 둘 — 뒤로 조금 누웠다, 위에 깎은 꼭지
    const post = u => { stick(p(u, 7.6, 1.6), p(u, 4.4, 41), 1.7); const f = p(u, 4.3, 42.4); K.ball(f[0], f[1], 1.3, 1.5, W0, 0.35); };
    post(6); post(18);
    // 등받이 살 다섯과 머리판(하트)
    for (let k = 0; k < 5; k++){ const u = 8.2 + k * 1.9; stick(p(u, 7, 17.5), p(u, 5.1, 34.5), 0.75); }
    const crest = [p(6, 5, 33.6), p(18, 5, 33.6), p(18, 4.6, 38.6), p(15, 4.5, 39.8), p(12, 4.45, 40.4), p(9, 4.5, 39.8), p(6, 4.6, 38.6)];
    K.poly(crest, K.lg(0, crest[4][1], 0, crest[0][1], [K.sh(W0, 0.2), W0, K.sh(W0, -0.15)]), 0.5);
    // 뜨개 담요 — 머리판에서 등받이 앞으로 늘어져 앉는 자리에 눕는다
    const A = p(6.3, 4.9, 39.4), B = p(17.7, 4.8, 39.2), Bb = p(17.6, 7.3, 18.2), Ab = p(6.2, 7.4, 18.2);
    const bq = (s, h) => { const tp = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s], bt = [Ab[0] + (Bb[0] - Ab[0]) * s, Ab[1] + (Bb[1] - Ab[1]) * s]; return [tp[0] + (bt[0] - tp[0]) * h + Math.sin(s * 9) * 0.3 * h, tp[1] + (bt[1] - tp[1]) * h]; };
    const edge = (h0, h1) => [...Array.from({ length: 9 }, (_, i) => bq(i / 8, h0)), ...Array.from({ length: 9 }, (_, i) => bq(1 - i / 8, h1))];
    // 앉는 자리 — 소나무 판 위에 붉은 방석
    K.O.box(5, 6.5, 14, 12.2, 14.4, 2.2, W0, { t: K.sh(W0, 0.16), w: 0.45 });
    K.O.box(6, 7.4, 12, 10.4, 16.6, 1.6, RED, { t: K.lg(0, p(6, 7.4, 18.2)[1], 0, p(18, 17.8, 18.2)[1], [K.sh(RED, 0.18), K.sh(RED, -0.05)]), w: 0.4 });
    const ss = p(13.5, 14.4, 18.25); selbu(K, ss[0], ss[1], 2.6, CR);
    K.poly(edge(0, 1), K.lg(A[0], A[1], Ab[0], Ab[1], [K.sh(RED, 0.1), RED, K.sh(RED, -0.12)]), 0.45);
    // 줄무늬 띠 — 크림·초록, 사이에 셀부 별
    [[0.1, 0.2, CR], [0.8, 0.9, CR], [0.24, 0.28, GR], [0.72, 0.76, GR]].forEach(([h0, h1, col]) => K.poly(edge(h0, h1), col));
    for (let i = 0; i < 9; i++){ const q = bq((i + 0.5) / 9, 0.15); K.ov(q[0], q[1], 0.45, 0.45, RED); const r2 = bq((i + 0.5) / 9, 0.85); K.ov(r2[0], r2[1], 0.45, 0.45, RED); }
    [0.2, 0.5, 0.8].forEach((s, i) => { const q = bq(s, 0.5); selbu(K, q[0], q[1], 2.9, CR); K.ov(q[0], q[1], 0.5, 0.5, i === 1 ? GR : '#f2c14e'); });
    for (let i = 0; i < 4; i++){ const s = 0.12 + i * 0.25; K.curve([bq(s, 0.02), bq(s + 0.03, 0.5), bq(s - 0.02, 0.98)], 'rgba(60,10,10,.18)', 0.7); }   // 늘어진 주름
    K.curve([A, bq(0.5, -0.02), B], K.sh(RED, -0.25), 2.2); K.curve([[A[0], A[1] - 0.6], [B[0], B[1] - 0.6]], K.sh(RED, 0.25), 0.6);   // 머리판에 걸친 둘레
    const S1 = p(6.2, 11.6, 18.3), S2 = p(17.6, 11, 18.3);
    K.poly([Ab, Bb, S2, S1], K.lg(0, Ab[1], 0, S1[1], [K.sh(RED, -0.18), K.sh(RED, 0.05)]), 0.4);
    K.poly([[Ab[0] + (S1[0] - Ab[0]) * 0.6, Ab[1] + (S1[1] - Ab[1]) * 0.6], [Bb[0] + (S2[0] - Bb[0]) * 0.6, Bb[1] + (S2[1] - Bb[1]) * 0.6], [Bb[0] + (S2[0] - Bb[0]) * 0.8, Bb[1] + (S2[1] - Bb[1]) * 0.8], [Ab[0] + (S1[0] - Ab[0]) * 0.8, Ab[1] + (S1[1] - Ab[1]) * 0.8]], CR);
    for (let i = 0; i <= 10; i++){ const q = [S1[0] + (S2[0] - S1[0]) * i / 10, S1[1] + (S2[1] - S1[1]) * i / 10]; K.ln(q, [q[0] - 0.2, q[1] + 1.3], '#efd9c4', 0.5); }   // 술
    // 기대 놓은 쿠션 — 크림에 빨간 하트
    const cu = p(14.6, 8.8, 22.6), cq = [[cu[0] - 3.4, cu[1] - 3.2], [cu[0] + 3, cu[1] - 4], [cu[0] + 3.6, cu[1] + 3], [cu[0] - 2.8, cu[1] + 3.8]];
    K.poly(cq, K.lg(cq[0][0], cq[0][1], cq[2][0], cq[2][1], ['#fffaf0', CR, '#d8c8a8']), 0.45);
    cq.forEach(q => K.ov(q[0], q[1], 0.7, 0.7, CR, 0.3));
    heart(K, cu[0] + 0.1, cu[1] - 0.1, 1.5, RED); K.ln([cu[0] - 2.4, cu[1] + 2.6], [cu[0] + 2.6, cu[1] + 2], 'rgba(120,90,60,.25)', 0.4);
    // 앞다리·팔걸이 — 맨 앞이라 마지막에
    [6, 18].forEach(u => { stick(p(u, 17.6, 1.4), p(u, 17.6, 14.6), 1.5); stick(p(u, 17.4, 16.6), p(u, 17.2, 24.6), 1.1);
      stick(p(u, 6.2, 25.6), p(u, 18.6, 24.6), 1.6); const e = p(u, 18.8, 24.6); K.ball(e[0], e[1], 1.3, 1, W0, 0.35); });
    stick(p(6, 17.6, 6.5), p(18, 17.6, 6.5), 0.8);                                                       // 앞 가로대
    g.restore();
    // 발치 — 털실 공과 뜨개바늘
    const y = p(21.6, 21.6, 0); K.blob(y[0], y[1] + 0.4, 3, 1);
    K.ball(y[0], y[1] - 2.2, 2.5, 2.3, '#5d8fb8', 0.4);
    for (let k = 0; k < 4; k++) K.curve([[y[0] - 2.1, y[1] - 3 + k], [y[0], y[1] - 1.8 + k * 0.6], [y[0] + 2.1, y[1] - 3.2 + k]], 'rgba(255,255,255,.3)', 0.3);
    K.curve([[y[0] - 2, y[1] - 1.4], [y[0] - 5, y[1] - 0.4], [y[0] - 7, y[1] - 1.6]], '#5d8fb8', 0.5);
    K.ln([y[0] - 1, y[1] - 6], [y[0] + 1.6, y[1] - 0.6], '#d8c09a', 0.5); K.ln([y[0] + 1.2, y[1] - 6.2], [y[0] - 0.6, y[1] - 0.8], '#d8c09a', 0.5);
    K.ov(y[0] - 1, y[1] - 6.1, 0.5, 0.5, RED); K.ov(y[0] + 1.2, y[1] - 6.3, 0.5, 0.5, RED);
  });

  // 트로피 — 나무 받침 위 금잔, 빨간 리본, 반짝
  def('trophy', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY;
    if (!C.lit) K.blob(x, y, 9, 3.4);
    K.poly([[x - 7, y - 6], [x + 7, y - 6], [x + 8, y], [x - 8, y]], K.lg(x - 8, 0, x + 8, 0, ['#a97b4f', '#6f4a2c', '#4a2e1c']), 0.5); K.ov(x, y - 6, 7, 1.6, '#8a5f3a', 0.45);
    K.poly([[x - 4, y - 2.8], [x + 4, y - 2.8], [x + 4, y - 4.8], [x - 4, y - 4.8]], '#e8c870', 0.3);
    K.poly([[x - 2, y - 7], [x + 2, y - 7], [x + 1, y - 13], [x - 1, y - 13]], K.lg(x - 2, 0, x + 2, 0, [C.shade(c, 0.2), C.shade(c, -0.3)]), 0.45);
    K.ov(x, y - 7.4, 3.4, 1, C.shade(c, -0.15), 0.4);
    [-1, 1].forEach(s => K.curve([[x + s * 6, y - 23], [x + s * 10, y - 22], [x + s * 9.5, y - 17], [x + s * 4, y - 15]], C.shade(c, -0.15), 1.4));
    K.poly([[x - 7, y - 25], [x + 7, y - 25], [x + 5.5, y - 17], [x + 2, y - 13.5], [x - 2, y - 13.5], [x - 5.5, y - 17]], K.lg(x - 7, 0, x + 7, 0, [C.shade(c, 0.35), c, C.shade(c, -0.32)]), 0.5);
    K.ov(x, y - 25, 7, 1.8, C.shade(c, -0.3), 0.45); K.ov(x, y - 25.2, 5.6, 1.2, C.shade(c, -0.45));
    const s = 2.2; K.poly([[x, y - 22.6 - s], [x + s * 0.35, y - 22.6 - s * 0.3], [x + s, y - 22.6], [x + s * 0.35, y - 22.6 + s * 0.3], [x, y - 22.6 + s], [x - s * 0.35, y - 22.6 + s * 0.3], [x - s, y - 22.6], [x - s * 0.35, y - 22.6 - s * 0.3]], '#fff6d0');   // 별 새김
    K.poly([[x - 2, y - 16], [x + 2, y - 16], [x + 2.6, y - 11], [x + 0.4, y - 12.6], [x - 0.4, y - 12.6], [x - 2.6, y - 11]], '#d9483f', 0.35);
    K.poly([[x - 5, y - 24], [x - 3.6, y - 24], [x - 4.2, y - 16.5], [x - 5, y - 18]], 'rgba(255,255,255,.45)');
    if (!C.lit){ const sx = x + 8, sy = y - 28; K.poly([[sx, sy - 3], [sx + 0.8, sy - 0.8], [sx + 3, sy], [sx + 0.8, sy + 0.8], [sx, sy + 3], [sx - 0.8, sy + 0.8], [sx - 3, sy], [sx - 0.8, sy - 0.8]], '#fffbe6', 0.3); }
  });

  // ================= 인형 =================
  // 토끼 인형 — 긴 귀, 분홍 귀 안, 빨간 니트 목도리
  def('rabbit', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY, pk = '#ffc0cf', ink = '#3a3226';
    if (C.lit) return;
    K.blob(x, y, 10, 3.4);
    [[-4, -0.18], [4, 0.22]].forEach(([d, a]) => { K.ball(x + d + a * 10, y - 33, 2.8, 8, c, 0.5, a); K.ov(x + d + a * 10, y - 32.5, 1.3, 5.6, pk, 0, a); });
    K.ball(x - 6.5, y - 4, 3.6, 2.6, c, 0.45); K.ball(x + 6.5, y - 4, 3.6, 2.6, c, 0.45);               // 발
    K.ball(x, y - 9, 8, 8, c, 0.5);                                                                        // 몸
    K.ball(x + 8, y - 6, 2.4, 2.4, '#ffffff', 0.4);                                                         // 꼬리
    K.ov(x, y - 8, 4.4, 4.6, C.mix ? C.mix(c, '#ffffff', 0.5) : '#ffffff');
    K.ball(x - 7, y - 11, 2.4, 3.6, c, 0.45, 0.4); K.ball(x + 7, y - 11, 2.4, 3.6, c, 0.45, -0.4);         // 팔
    K.ball(x, y - 21, 8.6, 7.4, c, 0.5);                                                                   // 머리
    K.poly([[x - 7.5, y - 16], [x + 7.5, y - 16], [x + 7, y - 13.4], [x - 7, y - 13.4]], '#d9483f', 0.4);   // 목도리
    K.poly([[x + 3, y - 14], [x + 6, y - 14], [x + 6.5, y - 8], [x + 3.5, y - 8.6]], '#c23a32', 0.4);
    for (let i = 0; i < 4; i++) K.ln([x - 6 + i * 3.4, y - 15.6], [x - 5.2 + i * 3.4, y - 13.8], '#fff6e9', 0.4);
    K.ov(x - 3.2, y - 21.5, 1.1, 1.5, ink); K.ov(x + 3.2, y - 21.5, 1.1, 1.5, ink);
    K.ov(x - 2.8, y - 22, 0.4, 0.45, '#ffffff'); K.ov(x + 3.6, y - 22, 0.4, 0.45, '#ffffff');
    K.ov(x - 5.6, y - 19, 1.6, 0.9, 'rgba(255,140,160,.55)'); K.ov(x + 5.6, y - 19, 1.6, 0.9, 'rgba(255,140,160,.55)');
    K.poly([[x - 0.9, y - 19.4], [x + 0.9, y - 19.4], [x, y - 18.4]], '#e8849a'); K.curve([[x - 1.2, y - 17.6], [x, y - 18.2], [x + 1.2, y - 17.6]], ink, 0.35);
  });

  // 상그렐라 인형 — 동그란 흰 새, 크게 벌린 노란 부리, 빨간 털모자
  def('sangre', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY, bk = '#ffc94d', ink = '#3a3226';
    if (C.lit) return;
    K.blob(x, y, 11, 3.6);
    K.ball(x - 4, y - 1.4, 2.6, 1.4, '#ffb347', 0.4); K.ball(x + 4, y - 1.4, 2.6, 1.4, '#ffb347', 0.4);   // 발
    K.ball(x, y - 13, 12, 12, c, 0.55);
    K.ov(x, y - 7, 9, 4.6, 'rgba(120,130,170,.12)');
    K.ball(x + 11, y - 12, 3, 5, C.shade(c, -0.08), 0.45, -0.4); K.ball(x - 11, y - 12, 3, 5, C.shade(c, -0.08), 0.45, 0.4);   // 날개
    K.ov(x - 4.6, y - 16, 1.3, 2, ink); K.ov(x + 4.6, y - 16, 1.3, 2, ink); K.ov(x - 4.2, y - 16.7, 0.45, 0.6, '#ffffff'); K.ov(x + 5, y - 16.7, 0.45, 0.6, '#ffffff');
    K.poly([[x - 4, y - 13], [x + 4, y - 13], [x + 2.6, y - 10.6], [x - 2.6, y - 10.6]], bk, 0.45);       // 윗부리
    K.poly([[x - 2.6, y - 10.6], [x + 2.6, y - 10.6], [x + 1.6, y - 8], [x - 1.6, y - 8]], C.shade(bk, -0.2), 0.45);   // 아랫부리
    K.poly([[x - 2, y - 10.6], [x + 2, y - 10.6], [x + 1.2, y - 9.4], [x - 1.2, y - 9.4]], '#c94a4a');
    K.ov(x - 7.4, y - 12.6, 1.8, 1, 'rgba(255,140,160,.5)'); K.ov(x + 7.4, y - 12.6, 1.8, 1, 'rgba(255,140,160,.5)');
    K.poly([[x - 7, y - 22], [x + 7, y - 22], [x + 4.5, y - 27.5], [x, y - 29], [x - 4.5, y - 27.5]], K.lg(x - 7, 0, x + 7, 0, ['#e8574f', '#d9483f', '#a8322c']), 0.45);   // 털모자
    K.poly([[x - 7.5, y - 23.4], [x + 7.5, y - 23.4], [x + 7.5, y - 21], [x - 7.5, y - 21]], '#fff6e9', 0.4);
    K.ball(x, y - 29.5, 2, 2, '#fff6e9', 0.4);
  });

  // ================= 화분 · 꽃 =================
  // 화분 — 뜨개 바구니 화분에 둥근 잎 화초(필레아·몬스테라 느낌)
  def('plant', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY;
    if (C.lit) return;
    K.blob(x, y, 9, 3.4);
    [[-0.6, 13], [-1.5, 12], [-2.3, 13], [-2.9, 11], [-0.2, 10], [-1.1, 14], [-2, 14]].forEach(([a, l], i) => { K.curve([[x, y - 11], [x + Math.cos(a) * l * 0.6, y - 11 + Math.sin(a) * l * 0.6]], C.shade(c, -0.3), 0.5); K.ball(x + Math.cos(a) * l, y - 11 + Math.sin(a) * l, 3.6 - i * 0.12, 3, i % 2 ? c : C.shade(c, 0.1), 0.4); });
    K.poly([[x - 6.5, y - 11], [x + 6.5, y - 11], [x + 5.5, y], [x - 5.5, y]], K.lg(x - 6, 0, x + 6, 0, ['#f4ead6', '#dcc9a6', '#b8a07a']), 0.5);
    for (let k = 0; k < 4; k++) K.curve([[x - 6, y - 9 + k * 2.4], [x - 2, y - 8.2 + k * 2.4], [x + 2, y - 9 + k * 2.4], [x + 6, y - 8.2 + k * 2.4]], '#b8a07a', 0.35);
    K.ov(x, y - 11, 6.6, 1.5, '#dcc9a6', 0.45);
  });

  // 꽃병 — 청록 도자기에 튤립과 유칼립투스
  def('vase', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY;
    if (C.lit) return;
    K.blob(x, y, 7, 2.8);
    [[-0.5, '#3f7d5c'], [0.4, '#4f9a58'], [-0.15, '#3f7d5c']].forEach(([a, col], i) => K.curve([[x, y - 13], [x + a * 6, y - 20 - i * 2], [x + a * 9, y - 24 - i * 2]], col, 0.7));
    [[-2.6, -1.5], [3.6, -1.1], [-4, -2], [4.5, -2.3]].forEach(([d, a]) => leaf(K, x + d * 0.4, y - 17 + Math.abs(d) * 0.4, 4.2, 1.6, a, '#8fb8a0', 0.3));   // 유칼립투스
    [[-4.5, -24, '#e8574f'], [1.2, -27, '#ffb7d5'], [-1, -21, '#fff3a0']].forEach(([dx, dy, col]) => { K.ball(x + dx, y + dy, 2.4, 2.8, col, 0.4); K.ln([x + dx, y + dy - 2.8], [x + dx, y + dy - 0.6], C.shade(col, -0.25), 0.4); });
    K.poly([[x - 2, y - 13], [x + 2, y - 13], [x + 2.4, y - 11], [x + 5, y - 6], [x + 4, y], [x - 4, y], [x - 5, y - 6], [x - 2.4, y - 11]], K.lg(x - 5, 0, x + 5, 0, [C.shade(c, 0.3), c, C.shade(c, -0.32)]), 0.5);
    K.ov(x, y - 13, 2.2, 0.8, C.shade(c, -0.35), 0.4);
    K.curve([[x - 4.4, y - 5], [x, y - 4], [x + 4.4, y - 5]], '#fff6e9', 0.6); K.curve([[x - 4, y - 3], [x, y - 2], [x + 4, y - 3]], '#fff6e9', 0.4);
    K.ov(x - 2.4, y - 7, 0.7, 2, 'rgba(255,255,255,.4)');
  });

  // 장미 화분 — 하늘색 법랑 화분, 겹겹이 말린 장미 셋
  def('rose', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY;
    if (C.lit) return;
    [[0, -22], [-5, -17], [5, -15]].forEach(([dx, dy]) => K.curve([[x, y - 10], [x + dx * 0.6, y + dy * 0.6 - 2], [x + dx, y + dy]], '#4f9a48', 0.6));
    [[-3, -15, -2.6], [3.5, -13, -0.5], [0, -19, -1.8], [-6, -12, -2.9], [6, -11, -0.2]].forEach(([dx, dy, a]) => leaf(K, x + dx * 0.6, y + dy * 0.9, 4, 1.6, a, '#5da05a', 0.3));
    const rosy = (rx, ry, r) => { K.ball(rx, ry, r, r * 0.9, c, 0.45); for (let k = 0; k < 3; k++){ const rr = r * (0.75 - k * 0.22); K.curve([[rx - rr, ry - rr * 0.1], [rx - rr * 0.4, ry - rr * 0.8], [rx + rr * 0.5, ry - rr * 0.6], [rx + rr * 0.7, ry + rr * 0.1], [rx, ry + rr * 0.5]], C.shade(c, -0.32), 0.4); } K.ov(rx - r * 0.35, ry - r * 0.45, r * 0.3, r * 0.18, 'rgba(255,255,255,.35)'); };
    rosy(x, y - 23, 3.8); rosy(x - 5.5, y - 18, 3); rosy(x + 5.5, y - 16, 3.2);
    K.blob(x, y, 7.5, 2.8);
    K.poly([[x - 6, y - 10], [x + 6, y - 10], [x + 5, y], [x - 5, y]], K.lg(x - 6, 0, x + 6, 0, ['#c8e6f7', '#8ec9ee', '#5f9ec6']), 0.5);
    K.ov(x, y - 10, 6.4, 1.4, '#e2f2fb', 0.45); K.ov(x, y - 10, 5, 0.9, '#6a4a36');
    [[-2.6, -6], [1.4, -4.4], [3.4, -7]].forEach(([dx, dy]) => K.ov(x + dx, y + dy, 0.8, 0.8, '#ffffff'));
  });

  // 해바라기 화분 — 테라코타 화분, 큰 꽃 한 송이, 잎 둘
  def('sunflower', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY, fy = y - Math.min(C.H, 58) + 13;
    if (C.lit) return;
    K.curve([[x, y - 10], [x + 0.6, (y + fy) / 2], [x, fy + 4]], '#4f9a48', 1.3);
    leaf(K, x, y - 18, 7, 2.6, -2.7, '#5da05a', 0.35); leaf(K, x + 0.4, y - 25, 7, 2.6, -0.35, '#5da05a', 0.35);
    pot(K, x, y, 6, 4.6, 9, '#c97a5a', '#e09a76');
    for (let i = 0; i < 14; i++){ const a = i / 14 * TAU; K.ball(x + Math.cos(a) * 6.6, fy + Math.sin(a) * 6.2, 2.4, 1.3, i % 2 ? C.shade(c, -0.1) : c, 0.35, a); }
    K.ball(x, fy, 4.6, 4.4, '#7a4a28', 0.45);
    for (let i = 0; i < 14; i++){ const a = i * 2.4, r = Math.sqrt(i) * 1.1; K.ov(x + Math.cos(a) * r, fy + Math.sin(a) * r, 0.4, 0.4, '#4a2c16'); }
    K.ov(x - 1.5, fy - 1.6, 1.4, 0.8, 'rgba(255,220,150,.35)');
  });

  // 올리브 나무 — 흰 화분에 파란 띠, 비틀린 줄기, 은초록 잎, 까만 열매
  def('olive', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY, top = y - Math.min(C.H, 52);
    if (C.lit) return;
    K.curve([[x, y - 12], [x - 1.5, y - 20], [x + 1.5, y - 27], [x - 1, top + 18]], '#7a6450', 2.2); K.curve([[x + 1, y - 22], [x + 6, top + 17]], '#7a6450', 1.3); K.curve([[x - 1, y - 25], [x - 6, top + 15]], '#7a6450', 1.1);
    K.curve([[x - 0.6, y - 12], [x - 2, y - 20], [x + 0.8, y - 27]], '#9a8470', 0.6);
    [[-6, 12, 7.4], [6, 9, 7], [0, 6, 8], [-2, 15, 6], [4, 15, 6]].forEach(([dx, dy, r], i) => { K.ball(x + dx, top + dy, r, r * 0.72, i % 2 ? C.shade(c, -0.08) : c, 0.45); for (let k = 0; k < 6; k++){ const a = hash(i * 9 + k) * TAU; leaf(K, x + dx + Math.cos(a) * r * 0.5, top + dy + Math.sin(a) * r * 0.3, 3, 0.8, a, C.shade(c, 0.2), 0); } });
    [[-7, 15], [5, 12], [-1, 9], [7, 17], [-4, 19]].forEach(([dx, dy]) => K.ball(x + dx, top + dy, 1, 1.2, '#3e2f4a', 0.25));
    K.blob(x, y, 8, 3);
    K.poly([[x - 6.5, y - 12], [x + 6.5, y - 12], [x + 5.5, y], [x - 5.5, y]], K.lg(x - 6, 0, x + 6, 0, ['#ffffff', '#f4f1ea', '#c9c3b6']), 0.5);
    K.poly([[x - 6.2, y - 8.6], [x + 6.2, y - 8.6], [x + 6, y - 6.6], [x - 6, y - 6.6]], '#2f6fb0');
    K.ov(x, y - 12, 7, 1.6, '#fbfaf6', 0.45); K.ov(x, y - 12, 5.6, 1, '#6a4a36');
  });

  // 벚꽃 가지 — 흰 도자기 병에 꽂은 꽃가지
  def('sakura', (g, C) => {
    const K = kit(g, C), c = C.c, x = C.CX, y = C.CY;
    if (C.lit) return;
    const br = [[[x, y - 12], [x - 2, y - 24], [x - 8, y - 34]], [[x, y - 12], [x + 3, y - 26], [x + 9, y - 36]], [[x - 1, y - 22], [x - 9, y - 26]], [[x + 2, y - 24], [x + 10, y - 26]], [[x, y - 14], [x + 1, y - 30], [x, y - 40]]];
    br.forEach(b => { K.curve(b, '#4a3024', 1); K.curve(b, '#6f4a2c', 0.5); });
    const fl = [[-8, -34], [9, -36], [-9, -26], [10, -26], [0, -40], [-4, -30], [5, -31], [-2, -36], [3, -22], [-6, -21], [7, -30]];
    fl.forEach(([dx, dy], i) => { const px = x + dx, py = y + dy, r = 2 + (i % 3) * 0.4; for (let k = 0; k < 5; k++){ const a = k * TAU / 5 + i; K.ov(px + Math.cos(a) * r * 0.6, py + Math.sin(a) * r * 0.6, r * 0.55, r * 0.55, k % 2 ? c : C.shade(c, 0.25)); } K.ov(px, py, 0.6, 0.6, '#e8574f'); });
    K.blob(x, y, 6.5, 2.6);
    K.poly([[x - 2, y - 12], [x + 2, y - 12], [x + 4.6, y - 8], [x + 4.6, y - 2], [x + 3, y], [x - 3, y], [x - 4.6, y - 2], [x - 4.6, y - 8]], K.lg(x - 5, 0, x + 5, 0, ['#ffffff', '#eef2f4', '#b9c6ce']), 0.5);
    K.ov(x, y - 12, 2.4, 0.8, '#c9d4da', 0.4); K.curve([[x - 3, y - 6], [x - 1, y - 7.4], [x + 1, y - 6], [x + 3, y - 7.2]], '#5d8fb8', 0.45);
  });
  // ================= 벽에 거는 것 — 평평한 칸 x 0..40, y 0..58 (ROOMHD 가 벽 기울기대로 붙인다) =================
  // ================= 사막 오아시스(모로코 리아드) 가구 넷 — 2026-10-09 =================
  // 민트 차 상 — 둥근 놋쟁반 탁자(나무 여섯모 다리), 위에 은빛 찻주전자와 금테 유리잔 넷, 민트 잎. 김이 오른다(FURN_ANIM)
  def('teaset', (g, C) => {
    const K = kit(g, C), P = C.P, t = C.t || 0, cx = C.E / 2, cy = C.D / 2;
    if (C.lit) return;
    K.shadow();
    // 여섯모 다리 받침 — 나무 판 셋, 아치 구멍
    const legs = []; for (let i = 0; i < 6; i++){ const a = (i + 0.5) / 6 * TAU; legs.push([cx + Math.cos(a) * 8, cy + Math.sin(a) * 8]); }
    for (let i = 0; i < 6; i++){ const a = legs[i], b = legs[(i + 1) % 6]; if ((a[1] + b[1]) / 2 < cy - 1 && (a[0] + b[0]) / 2 < cx + 1) continue;
      K.poly([P(a[0], a[1], 0), P(b[0], b[1], 0), P(b[0], b[1], 14), P(a[0], a[1], 14)], K.lg(0, P(a[0], a[1], 14)[1], 0, P(a[0], a[1], 0)[1], ['#8a5030', '#5a3018']), 0.5);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], q = P(m[0], m[1], 0); K.poly([[q[0] - 2, q[1]], [q[0] - 2, q[1] - 5], [q[0], q[1] - 7.5], [q[0] + 2, q[1] - 5], [q[0] + 2, q[1]]], '#2a1408'); }
    // 놋쟁반 — 두꺼운 테, 새김 무늬
    const rim = K.iel(cx, cy, 11, 11, 15), tray = K.iel(cx, cy, 10, 10, 15.6);
    K.poly(K.iel(cx, cy, 11, 11, 14), '#9a6a20', 0.5); K.poly(rim, K.lg(0, P(cx, cy - 11, 15)[1], 0, P(cx, cy + 11, 15)[1], ['#f2d07a', '#d0a040', '#a87818']), 0.5);
    K.poly(tray, K.lg(0, P(cx, cy - 10, 15)[1], 0, P(cx, cy + 10, 15)[1], ['#e8c060', '#c89a30']));
    for (let i = 0; i < 8; i++){ const a = i / 8 * TAU, p0 = P(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, 15.6), p1 = P(cx + Math.cos(a) * 8.5, cy + Math.sin(a) * 8.5, 15.6); K.ln(p0, p1, 'rgba(120,80,20,.4)', 0.35); }
    K.poly(K.iel(cx, cy, 3, 3, 15.6, 16), 'rgba(120,80,20,.3)');
    // 유리잔 넷 — 금테, 민트 차 빛
    [[-6, -2], [-2, 5], [5, 4], [3, -6]].forEach(([dx, dy], i) => { const b = P(cx + dx, cy + dy, 15.6), h = 4.4;
      K.poly([[b[0] - 1.5, b[1]], [b[0] + 1.5, b[1]], [b[0] + 2, b[1] - h], [b[0] - 2, b[1] - h]], K.lg(b[0] - 2, 0, b[0] + 2, 0, ['rgba(200,230,170,.8)', 'rgba(120,170,80,.85)', 'rgba(90,140,60,.85)']), 0.4);
      K.ov(b[0], b[1] - h, 2, 0.7, 'rgba(230,245,210,.9)', 0.35); K.ln([b[0] - 1.8, b[1] - h + 1.2], [b[0] + 1.8, b[1] - h + 1.2], '#e8b040', 0.6);
      K.ln([b[0] - 0.9, b[1] - 0.6], [b[0] - 1.2, b[1] - h + 1.8], 'rgba(255,255,255,.6)', 0.4); });
    // 찻주전자 — 은빛 둥근 몸, 긴 주둥이, 뾰족 뚜껑
    const tp = P(cx + 1, cy + 0.5, 15.6), x = tp[0], y = tp[1];
    K.ball(x, y - 5, 5, 4.6, '#d8dce4', 0.5);
    K.poly([[x + 4, y - 5], [x + 9.5, y - 10], [x + 10.4, y - 9.4], [x + 5, y - 3]], K.lg(x + 4, 0, x + 10, 0, ['#e8ecf2', '#a8b0bc']), 0.45);
    g.beginPath(); g.ellipse(x - 5.6, y - 5.5, 2.2, 3, 0, Math.PI * 0.5, Math.PI * 1.5); g.strokeStyle = '#8a92a0'; g.lineWidth = 0.9; g.stroke();
    K.ov(x, y - 9.4, 2.6, 1, '#c0c6d0', 0.4); K.poly([[x - 1.8, y - 9.6], [x, y - 14], [x + 1.8, y - 9.6]], K.lg(0, y - 14, 0, y - 9.5, ['#f0f2f6', '#a0a8b4']), 0.4); K.ov(x, y - 14.4, 0.8, 0.8, '#e8b040', 0.3);
    K.ov(x - 1.6, y - 7, 1.4, 1, 'rgba(255,255,255,.7)');
    // 민트 잎 한 줌
    const mp = P(cx - 5, cy + 6.5, 15.6); for (let i = 0; i < 5; i++){ const a = -Math.PI / 2 + (i - 2) * 0.55; K.ov(mp[0] + Math.cos(a) * 1.8, mp[1] - 1 + Math.sin(a) * 1.4, 1.4, 0.7, i % 2 ? '#4aa048' : '#6ac060', 0.3, a); }
    // 김
    for (let i = 0; i < 3; i++){ const k = ((t / 1800) + i / 3) % 1; K.ov(x + 10 + Math.sin(k * 6 + i) * 1.4, y - 11 - k * 9, 1 + k * 1.8, 0.8 + k * 1.2, 'rgba(255,255,255,' + (0.5 * (1 - k)).toFixed(2) + ')'); }
  });
  // 베르베르 양탄자 — 크림 바탕에 붉은·쪽빛 마름모 줄, 양 끝 술
  def('kilim', (g, C) => {
    const K = kit(g, C), O = K.O, p = O.p, L = O.L, W = O.W;
    if (C.lit) return;
    const u0 = 3, u1 = L - 3, v0 = 3, v1 = W - 3, z = 0.6;
    K.poly([p(u0, v0, 0), p(u1, v0, 0), p(u1, v1, 0), p(u0, v1, 0)], 'rgba(26,18,10,.12)');
    K.poly([p(u0, v0, z), p(u1, v0, z), p(u1, v1, z), p(u0, v1, z)], '#f2e2c4', 0.5);
    K.poly([p(u0 + 1.5, v0 + 1.5, z), p(u1 - 1.5, v0 + 1.5, z), p(u1 - 1.5, v1 - 1.5, z), p(u0 + 1.5, v1 - 1.5, z)], '#b0302a');
    K.poly([p(u0 + 3, v0 + 3, z), p(u1 - 3, v0 + 3, z), p(u1 - 3, v1 - 3, z), p(u0 + 3, v1 - 3, z)], '#f2e2c4');
    const n = Math.max(3, Math.round((u1 - u0 - 6) / 9)), vm = (v0 + v1) / 2, hv = (v1 - v0 - 6) / 2 - 1;
    for (let i = 0; i < n; i++){ const um = u0 + 3 + (u1 - u0 - 6) * (i + 0.5) / n, hu = (u1 - u0 - 6) / n / 2 - 0.4, c = i % 2 ? '#2f4f9a' : '#b0302a';
      K.poly([p(um, vm - hv, z), p(um + hu, vm, z), p(um, vm + hv, z), p(um - hu, vm, z)], c);
      K.poly([p(um, vm - hv * 0.45, z), p(um + hu * 0.45, vm, z), p(um, vm + hv * 0.45, z), p(um - hu * 0.45, vm, z)], '#e8b040'); }
    for (let k = 0; k < 2; k++){ const v = k ? v1 - 2.2 : v0 + 2.2; for (let i = 0; i < 12; i++){ const u = u0 + 2 + (u1 - u0 - 4) * i / 11, a = p(u, v, z); K.ov(a[0], a[1], 0.45, 0.45, '#2f4f9a'); } }
    [u0, u1].forEach((u, k) => { for (let i = 0; i <= 8; i++){ const v = v0 + (v1 - v0) * i / 8, a = p(u, v, z), b = p(u + (k ? 1.8 : -1.8), v, z); K.ln(a, b, '#e8d8b8', 0.45); } });
  });
  // 가죽 방석(푸프) — 둥근 낮은 가죽 쿠션, 위에 별 수 놓고 옆에 아치 무늬
  def('pouf', (g, C) => {
    const K = kit(g, C), P = C.P, cx = C.E / 2, cy = C.D / 2, c = C.c || '#c87a3a';
    if (C.lit) return;
    const b = P(cx, cy, 0), t = P(cx, cy, 13), rx = 9 * 1.414, ry = 9 * 0.707;
    K.blob(b[0] + 1, b[1] + 1, rx + 1, ry + 1.4);
    g.beginPath(); g.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI); g.bezierCurveTo(t[0] - rx - 1.6, b[1] - 6, t[0] - rx - 0.6, t[1] + 2, t[0] - rx + 0.6, t[1]); g.ellipse(t[0], t[1], rx - 0.6, ry - 0.3, 0, Math.PI, TAU); g.bezierCurveTo(t[0] + rx + 0.6, t[1] + 2, t[0] + rx + 1.6, b[1] - 6, b[0] + rx, b[1]); g.closePath();
    g.fillStyle = K.lg(b[0] - rx, 0, b[0] + rx, 0, [C.shade(c, 0.18), c, C.shade(c, -0.3)]); g.fill(); g.strokeStyle = C.INK; g.lineWidth = 0.5; g.stroke();
    for (let i = 0; i < 5; i++){ const f = -0.8 + i * 0.4, x = b[0] + f * rx, y = b[1] - 6.5 + Math.sqrt(1 - f * f) * ry; K.poly([[x - 2, y + 3], [x - 2, y - 1], [x, y - 3], [x + 2, y - 1], [x + 2, y + 3]], null, 0); g.strokeStyle = '#7a3a18'; g.lineWidth = 0.6; g.stroke(); }
    K.ov(t[0], t[1], rx - 0.6, ry - 0.3, K.rg(t[0] - 3, t[1] - 1.5, rx, [C.shade(c, 0.32), C.shade(c, 0.08)]), 0.5);
    g.save(); g.translate(t[0], t[1]); g.scale(1, 0.5); g.fillStyle = '#f2d080'; for (let i = 0; i < 8; i++){ g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(1.2, -2.4); g.lineTo(0, -5.4); g.lineTo(-1.2, -2.4); g.closePath(); g.fill(); } g.restore();
    K.ov(t[0], t[1], 1.2, 0.6, '#7a3a18');
  });

  const defW = (kind, fn) => { RH.wall[kind] = fn; };
  // 못과 걸이줄
  function hang(K, cx, top, half){ K.ln([cx, top + 1], [cx - half, top + 6], '#8a7b6e', 0.45); K.ln([cx, top + 1], [cx + half, top + 6], '#8a7b6e', 0.45); K.ov(cx, top + 1, 1.1, 1.1, '#6f6257', 0.3); }
  // 나무 액자 — 바깥 테(그러데이션) · 매트 · 안쪽 자리 [x, y, w, h] 를 돌려준다
  function frame(K, x, y, w, h, wood, mat){ const sh = K.sh;
    K.rr(x + 0.8, y + 1.2, w, h, 1.2, 'rgba(26,18,10,.22)');
    K.rr(x, y, w, h, 1.2, K.lg(x, y, x + w, y + h, [sh(wood, 0.25), wood, sh(wood, -0.3)]), 0.55);
    K.rr(x + 2.2, y + 2.2, w - 4.4, h - 4.4, 0.4, mat || '#fbf4e6', 0.35);
    return [x + 4, y + 4, w - 8, h - 8]; }
  const glass = (K, a) => { K.poly([[a[0], a[1]], [a[0] + a[2] * 0.35, a[1]], [a[0], a[1] + a[3] * 0.45]], 'rgba(255,255,255,.18)'); };
  const star5 = (K, x, y, r, f, w, rot) => { const pts = []; for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + (rot || 0) + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } K.poly(pts, f, w); };

  // 커튼 창문 — 흰 칠 창틀 십자살, 창밖은 낮이면 눈 언덕과 전나무, 밤이면 오로라. 레이스 단 커튼, 창턱에 촛불과 화분
  defW('window', (g, C) => {
    const K = kit(g, C), c = C.c, sh = K.sh, dark = (C.phase || 0) >= 2 || C.night;
    if (C.lit) return;
    K.rr(5, 8, 30, 38, 1, '#f4efe4', 0.55);
    const gx = 8, gy = 11, gw = 24, gh = 32;
    K.poly([[gx, gy], [gx + gw, gy], [gx + gw, gy + gh], [gx, gy + gh]], K.lg(0, gy, 0, gy + gh, dark ? ['#0b1a3c', '#123a5a', '#1d5a6e'] : ['#7fb4e0', '#b9dcf2', '#e8f4fb']));
    if (dark){ [[11, 14], [27, 13], [20, 16], [14, 22], [29, 20], [24, 12]].forEach(([x, y]) => K.ov(x, y, 0.35, 0.35, '#eaf2ff'));
      K.curve([[gx, 27], [14, 22], [20, 25], [26, 19], [gx + gw, 22]], 'rgba(120,255,190,.55)', 3); K.curve([[gx, 24], [15, 20], [22, 22], [gx + gw, 17]], 'rgba(90,220,255,.35)', 1.6);
      K.ov(28, 15, 1.6, 1.6, '#eef3ff'); K.ov(28.7, 14.6, 1.3, 1.4, '#0f2448'); }
    else { K.ov(13, 16, 2.4, 2.4, '#fffaf0'); K.ov(24, 15, 3, 1.2, '#ffffff'); K.ov(27, 14.4, 2, 1, '#ffffff'); }
    const hill = dark ? ['#5b6f9f', '#3e5288'] : ['#ffffff', '#d4e3f2'];
    K.poly([[gx, 36], [14, 32], [22, 34], [28, 31], [gx + gw, 33], [gx + gw, gy + gh], [gx, gy + gh]], K.lg(0, 31, 0, gy + gh, hill));
    [[12, 34, 4.5], [26, 32.5, 5.5], [30, 34, 3.5]].forEach(([x, y, h]) => { K.poly([[x, y - h], [x + h * 0.45, y], [x - h * 0.45, y]], dark ? '#163a3c' : '#2f6b5c'); K.poly([[x, y - h], [x + h * 0.2, y - h * 0.55], [x - h * 0.2, y - h * 0.55]], dark ? '#8fa3cf' : '#ffffff'); });
    K.rr(gx + gw / 2 - 0.8, gy, 1.6, gh, 0.3, '#f4efe4', 0.3); K.rr(gx, gy + gh / 2 - 0.8, gw, 1.6, 0.3, '#f4efe4', 0.3);
    K.poly([[gx + 1, gy + 1], [gx + 7, gy + 1], [gx + 1, gy + 9]], 'rgba(255,255,255,.2)');
    K.poly([[gx, gy + gh], [gx + 4, gy + gh - 2], [gx + 9, gy + gh - 1], [gx + 9, gy + gh]], 'rgba(255,255,255,.8)');   // 창 귀퉁이 서리
    K.rr(5, 8, 30, 38, 1, null, 0.55);
    K.rr(3, 45, 34, 3, 0.8, K.lg(0, 45, 0, 48, ['#fbf7ee', '#d8ccb6']), 0.5);                             // 창턱
    // 창턱 위 — 촛불과 작은 화분
    K.rr(9, 40, 3, 5, 0.6, '#fff6e9', 0.35); K.glow(10.5, 38.6, 4, '255,210,120', 0.35);
    K.ov(10.5, 38.8, 0.9, 1.6, '#ffcf6a'); K.ov(10.5, 39.2, 0.45, 0.9, '#fff6d0');
    pot(K, 29, 45, 2.6, 2, 3.4, '#d9483f'); K.ball(29, 39.5, 3, 2.6, '#4f9a58', 0.35);
    // 커튼봉과 두 폭 커튼 — 위는 주름, 아래는 묶어 젖혔다
    K.rr(1, 6, 38, 2.2, 1, K.lg(0, 6, 0, 8, ['#c79b6d', '#8a5f3a']), 0.45); K.ov(1.5, 7.1, 1.6, 1.6, '#a97b4f', 0.35); K.ov(38.5, 7.1, 1.6, 1.6, '#a97b4f', 0.35);
    [[1, 1], [39, -1]].forEach(([x0, s]) => {
      const pts = [[x0, 8], [x0 + s * 9, 8], [x0 + s * 7.5, 26], [x0 + s * 3, 32], [x0 + s * 5, 48], [x0, 48]];
      K.poly(pts, K.lg(x0, 0, x0 + s * 9, 0, [sh(c, -0.12), sh(c, 0.12), c, sh(c, -0.2)]), 0.5);
      for (let k = 1; k < 4; k++) K.curve([[x0 + s * k * 2.2, 8.5], [x0 + s * k * 1.9, 24], [x0 + s * k * 0.9, 31], [x0 + s * k * 1.3, 47.5]], sh(c, -0.22), 0.35);
      K.rr(Math.min(x0 + s * 1, x0 + s * 6.5), 29.6, 5.5, 2.2, 1, '#d9483f', 0.35);                         // 묶은 끈
      for (let y = 9; y < 47; y += 2.2) K.ov(x0 + s * (y < 26 ? 9 - (y - 8) / 18 * 1.5 : y < 32 ? 7.5 - (y - 26) * 0.75 : 3 + (y - 32) / 16 * 2), y, 0.7, 0.7, '#ffffff');   // 레이스 단
    });
  });

  // 포스터 — 테이프로 붙인 그림: 오로라 밤하늘 아래 순록 한 마리
  defW('poster', (g, C) => {
    const K = kit(g, C), c = C.c, sh = K.sh;
    if (C.lit) return;
    K.rr(6.8, 8.8, 27, 39, 0.4, 'rgba(26,18,10,.2)');
    K.rr(6, 8, 27, 39, 0.4, '#fffaf0', 0.45);
    const x = 8, y = 10, w = 23, h = 27;
    K.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], K.lg(0, y, 0, y + h, [sh(c, -0.55), sh(c, -0.25), c]));
    K.curve([[x, y + 13], [x + 6, y + 9], [x + 12, y + 12], [x + w, y + 7]], 'rgba(160,255,200,.7)', 2.4);
    [[x + 3, y + 3], [x + 17, y + 2], [x + 11, y + 5], [x + 20, y + 10]].forEach(([a, b]) => star5(K, a, b, 1, '#fff6d0'));
    K.ov(x + 18, y + 5, 2.2, 2.2, '#fff6d0');
    K.poly([[x, y + h], [x, y + 20], [x + 7, y + 16], [x + 13, y + 20], [x + 18, y + 15], [x + w, y + 19], [x + w, y + h]], '#f4f8ff');
    const rx = x + 11, ry = y + 22, rd = '#8a5f3a';                                                       // 순록
    K.ball(rx, ry, 4.4, 2.4, rd, 0.4); [[-3, 0], [-1.5, 0.3], [1.8, 0.3], [3.2, 0]].forEach(([d, e]) => K.ln([rx + d, ry + 1.5], [rx + d + e, ry + 5], rd, 0.8));
    K.poly([[rx + 3, ry - 1], [rx + 5, ry - 4], [rx + 7.5, ry - 3.2], [rx + 6, ry - 1.6], [rx + 4.4, ry + 0.6]], rd, 0.35);
    K.ov(rx + 7.6, ry - 3, 0.7, 0.7, '#e8574f');
    K.curve([[rx + 5, ry - 4], [rx + 4, ry - 7], [rx + 2.6, ry - 8]], '#5e3a20', 0.5); K.curve([[rx + 4.4, ry - 6], [rx + 5.8, ry - 7.4]], '#5e3a20', 0.45); K.curve([[rx + 6, ry - 4], [rx + 7, ry - 7], [rx + 8.6, ry - 8]], '#5e3a20', 0.5);
    K.rr(9, 39.5, 15, 1.8, 0.6, '#3a3226'); K.rr(9, 43, 10, 1.4, 0.6, sh(c, -0.3)); heart(K, 28, 42.5, 1.7, '#e8574f');
    [[4.6, 6.6, -0.5], [29.6, 6.6, 0.5], [4.6, 44.6, 0.5], [29.6, 44.6, -0.5]].forEach(([a, b, r]) => { g.save(); g.translate(a + 2.4, b + 1.2); g.rotate(r); K.rr(-2.6, -1, 5.2, 2, 0.3, 'rgba(255,248,220,.75)'); g.restore(); });
  });

  // 내 그림 액자 — 일기에 그린 도트 그림을 그대로 담는다(그림만은 도트가 맞다)
  defW('mypic', (g, C) => {
    const K = kit(g, C), c = C.c;
    if (C.lit) return;
    hang(K, 20, 2, 10);
    const a = frame(K, 1, 8, 38, 41, '#8a5f3a', c);
    K.rr(a[0] - 0.4, a[1] - 0.4, a[2] + 0.8, a[3] + 0.8, 0.2, C.PAD_BG || '#fffaf2', 0.3);
    const cells = C.cells, PAD = C.PAD || [];
    if (cells && cells.n){ const n = cells.n, s = Math.min(a[2], a[3]) / n, ox = a[0] + (a[2] - s * n) / 2, oy = a[1] + (a[3] - s * n) / 2;
      for (let i = 0; i < cells.length; i++){ if (cells[i] < 0 || !PAD[cells[i]]) continue; g.fillStyle = PAD[cells[i]]; g.fillRect(ox + (i % n) * s - 0.02, oy + Math.floor(i / n) * s - 0.02, s + 0.04, s + 0.04); } }
    glass(K, a);
  });

  // 무지개 — 펠트 무지개 반원, 양 끝 구름, 위에 걸이줄
  defW('rainbow', (g, C) => {
    const K = kit(g, C), sh = K.sh;
    if (C.lit) return;
    const rc = ['#e8848a', '#f2a65e', '#f2d066', '#8fc98a', '#7fb4e0', '#a998d8'], cx = 20, cy = 40;
    K.ln([cx, 4], [cx, 14], '#8a7b6e', 0.4); K.ov(cx, 4, 1, 1, '#6f6257', 0.3);
    if (!C.lit){ g.lineCap = 'butt'; rc.forEach((col, i) => { const r = 17 - i * 2.6; g.beginPath(); g.arc(cx, cy, r, Math.PI, TAU); g.strokeStyle = 'rgba(40,26,20,.55)'; g.lineWidth = 2.9; g.stroke(); g.strokeStyle = col; g.lineWidth = 2.3; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 0.5; g.beginPath(); g.arc(cx, cy, r + 0.6, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }); }
    [[4.5, 41], [35.5, 41]].forEach(([x, y]) => { K.ball(x - 2.6, y + 0.6, 3, 2.4, '#ffffff', 0.4); K.ball(x + 2.6, y + 0.6, 3, 2.4, '#ffffff', 0.4); K.ball(x, y - 1.4, 3.4, 3, '#ffffff', 0.4); K.ov(x, y + 2.2, 4.8, 0.8, sh('#dfeaf2', 0)); });
  });

  // 족자 — 비단 테에 먹 산수와 붉은 해, 위아래 축
  defW('scroll', (g, C) => {
    const K = kit(g, C), c = C.c;
    if (C.lit) return;
    K.ln([20, 1.5], [12, 5.5], '#6f6257', 0.5); K.ln([20, 1.5], [28, 5.5], '#6f6257', 0.5); K.ov(20, 1.5, 1, 1, '#6f6257', 0.3);
    K.rr(8.8, 8.6, 23, 47, 0.3, 'rgba(26,18,10,.18)');
    K.rr(10, 7.4, 20, 47, 0.2, K.lg(10, 0, 30, 0, ['#c9b48a', '#b8a27a', '#9d875f']), 0.4);
    K.poly([[13, 12], [27, 12], [27, 49], [13, 49]], K.lg(0, 12, 0, 49, [c, C.mix ? C.mix(c, '#d8ccb0', 0.4) : c]), 0.3);
    K.ov(22, 18, 2.4, 2.4, '#d9483f');
    K.poly([[13, 36], [16, 29], [18, 31], [21, 25], [25, 32], [27, 30], [27, 38], [13, 38]], 'rgba(90,90,100,.55)');
    K.poly([[13, 40], [17, 34], [20, 37], [23, 33], [27, 38], [27, 41], [13, 41]], 'rgba(50,50,60,.7)');
    K.curve([[14, 43], [18, 42.4], [22, 43.2], [26, 42.6]], 'rgba(120,130,140,.5)', 0.4);
    K.ln([17, 44.5], [17, 47.5], '#2e2622', 0.7); K.ln([15.8, 45.4], [18.2, 45.4], '#2e2622', 0.5); K.ln([23, 44], [22.4, 47.6], '#2e2622', 0.7); K.rr(24.6, 46, 1.6, 1.6, 0.2, '#c94a3a');
    K.rr(8, 5, 24, 3, 1.2, K.lg(0, 5, 0, 8, ['#7a5640', '#4a3020']), 0.45);
    K.rr(8, 53.6, 24, 3, 1.2, K.lg(0, 53.6, 0, 56.6, ['#7a5640', '#4a3020']), 0.45); K.ov(7, 55.1, 1.4, 1.6, '#3a2618', 0.3); K.ov(33, 55.1, 1.4, 1.6, '#3a2618', 0.3);
  });

  // 별 조명 — 두 줄로 늘어진 전선에 종이별 전구
  defW('stars', (g, C) => {
    const K = kit(g, C), c = C.c, t = C.t || 0;
    const rows = [[11, 6, 4, 3.6], [31, 5, 7, 2.8]];
    rows.forEach(([y0, n, x0, dip], r) => {
      const pt = k => { const x = x0 + k * (40 - x0 * 2) / (n - 1), f = (x - 2) / 36; return [x, y0 + Math.sin(f * Math.PI) * dip]; };
      if (!C.lit) K.curve(Array.from({ length: 21 }, (_, i) => { const x = 2 + i * 1.8, f = i / 20; return [x, y0 + Math.sin(f * Math.PI) * dip - 1.5]; }), '#6f6257', 0.45);
      for (let k = 0; k < n; k++){ const [x, y] = pt(k), on = 0.72 + 0.28 * Math.abs(Math.sin(t / 420 + k + r * 2)), rr = r ? 2.4 : 2.8;
        if (!C.lit) K.ln([x, y - 1.5], [x, y + 1.6], '#6f6257', 0.35);
        K.light(() => { K.glow(x, y + 4.6, rr * 2.4, '255,230,128', 0.35 * on); star5(K, x, y + 4.6, rr, C.lit ? '#ffe680' : c, 0.4, k * 0.2); star5(K, x, y + 4.8, rr * 0.45, '#fff6d0'); });
      }
    });
  });

  // 고래 그림 — 나무 액자에 수채 고래 한 마리, 물을 뿜는다
  defW('whale', (g, C) => {
    const K = kit(g, C), c = C.c;
    if (C.lit) return;
    hang(K, 20, 2, 9);
    const a = frame(K, 3, 8, 34, 34, '#6f4a2c'), [x, y, w, h] = a;
    K.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], K.lg(0, y, 0, y + h, ['#dff1fb', '#bfe2f5']));
    K.ov(x + w - 6, y + 4, 3.6, 1.3, '#ffffff'); K.ov(x + w - 3.6, y + 3.4, 2.4, 1.1, '#ffffff');
    K.poly([[x, y + h * 0.66], [x + w, y + h * 0.62], [x + w, y + h], [x, y + h]], K.lg(0, y + h * 0.6, 0, y + h, [C.shade(c, 0.25), C.shade(c, -0.2)]));
    for (let k = 0; k < 3; k++) K.curve([[x + 2, y + h * 0.75 + k * 2.4], [x + 7, y + h * 0.73 + k * 2.4], [x + 12, y + h * 0.76 + k * 2.4]], 'rgba(255,255,255,.45)', 0.4);
    const wx = x + w * 0.45, wy = y + h * 0.56, wc = '#3a5a86';
    K.poly([[wx + 7, wy], [wx + 11, wy - 1.6], [wx + 13.5, wy - 5], [wx + 12, wy - 1], [wx + 14, wy + 1.4], [wx + 10.5, wy + 0.6], [wx + 7, wy + 2.6]], wc, 0.4);   // 꼬리
    K.ball(wx, wy, 9, 5.4, wc, 0.45);
    K.poly([[wx - 8.6, wy + 0.6], [wx + 7, wy + 0.6], [wx + 5, wy + 4], [wx - 1, wy + 5.4], [wx - 6.4, wy + 3.8]], '#dfeaf6');
    for (let k = 0; k < 4; k++) K.ln([wx - 6 + k * 2.6, wy + 1.4], [wx - 6.4 + k * 2.6, wy + 4], '#b8c8dc', 0.3);
    K.ov(wx - 5.4, wy - 1.4, 0.8, 0.8, '#1c2c44'); K.ov(wx - 5.2, wy - 1.7, 0.3, 0.3, '#ffffff'); K.ov(wx - 3.4, wy + 0.2, 1.3, 0.7, 'rgba(255,140,160,.5)');
    K.ball(wx + 1, wy + 3.6, 2.6, 1.2, '#2c4a70', 0.35, 0.5);
    K.curve([[wx - 1, wy - 5], [wx - 1, wy - 8]], '#ffffff', 0.8); K.curve([[wx - 1, wy - 8], [wx - 3.6, wy - 9.6], [wx - 4.6, wy - 8]], '#ffffff', 0.7); K.curve([[wx - 1, wy - 8], [wx + 1.6, wy - 9.6], [wx + 2.6, wy - 8]], '#ffffff', 0.7);
    glass(K, a);
  });

  // 벽 조명 — 놋쇠 팔에 천 갓, 아래로 따뜻한 빛이 벽에 번진다
  defW('wlight', (g, C) => {
    const K = kit(g, C), c = C.c;
    K.light(() => { K.glow(20, 30, 22, '255,225,150', 0.38); K.poly([[12, 26], [28, 26], [34, 46], [6, 46]], K.lg(0, 26, 0, 46, ['rgba(255,233,168,.45)', 'rgba(255,233,168,0)'])); });
    if (!C.lit){
      K.rr(17.6, 4, 4.8, 8, 1.6, K.lg(17.6, 0, 22.4, 0, ['#d8b46a', '#a8843a']), 0.4);
      K.curve([[20, 9], [20, 13], [21, 15]], '#b8944a', 1.2);
      K.ov(20, 16.6, 1.8, 1, '#a8843a', 0.35);
    }
    K.light(() => { K.ov(20, 26, 7.5, 2, '#fff3c0'); K.ov(20, 27.6, 1.8, 1.8, '#fff9e0'); });
    if (!C.lit){
      K.poly([[14.5, 16], [25.5, 16], [29, 26], [11, 26]], K.lg(11, 0, 29, 0, [C.shade(c, 0.2), c, C.shade(c, -0.25)]), 0.5);
      for (let k = 1; k < 6; k++){ const f = k / 6; K.ln([14.5 + 11 * f, 16.3], [11 + 18 * f, 25.7], C.shade(c, -0.12), 0.35); }
      K.ov(20, 16, 5.5, 0.9, C.shade(c, 0.3), 0.4); K.ov(20, 26, 9, 1.4, null, 0.5);
      K.rr(11, 25.2, 18, 1.2, 0.5, '#d9483f');                                                             // 갓 아래 빨간 테
    }
  });

  // 세계 지도 — 위아래 나무 봉, 바다 위 대륙, 꽂아 둔 핀과 점선 길
  defW('worldmap', (g, C) => {
    const K = kit(g, C), c = C.c;
    if (C.lit) return;
    K.ln([20, 3], [6, 8], '#8a7b6e', 0.45); K.ln([20, 3], [34, 8], '#8a7b6e', 0.45); K.ov(20, 3, 1, 1, '#6f6257', 0.3);
    K.rr(4.8, 10.8, 31, 32, 0.3, 'rgba(26,18,10,.18)');
    K.poly([[4, 10], [36, 10], [36, 42], [4, 42]], K.lg(0, 10, 0, 42, ['#e8f5fb', '#cfe8f4']), 0.4);
    for (let y = 15; y < 41; y += 6) K.ln([4.5, y], [35.5, y], 'rgba(120,170,200,.35)', 0.25);
    for (let x = 9; x < 36; x += 7) K.ln([x, 10.5], [x, 41.5], 'rgba(120,170,200,.25)', 0.25);
    const land = [[[8, 15], [15, 14], [17, 18], [14, 22], [15, 26], [11, 25], [9, 20]], [[13, 28], [17, 28], [18, 33], [15, 38], [13, 34]], [[20, 14], [30, 13], [34, 16], [32, 21], [27, 22], [24, 20], [21, 19]], [[22, 23], [27, 24], [27, 31], [24, 34], [22, 29]], [[29, 31], [34, 30], [34, 35], [30, 35]]];
    land.forEach(pts => K.poly(pts, K.lg(0, 12, 0, 38, [C.shade(c, 0.15), C.shade(c, -0.15)]), 0.4));
    K.ov(31, 40, 4, 0.8, '#ffffff', 0.25); K.ov(10, 11.6, 3, 0.7, '#ffffff', 0.25);                      // 극지 얼음
    g.setLineDash && g.setLineDash([0.8, 0.8]); K.curve([[12, 18], [19, 15], [25, 17]], '#d9483f', 0.4); g.setLineDash && g.setLineDash([]);
    [[12, 18, '#d9483f'], [25, 17, '#d9483f'], [15, 32, '#f2c14e']].forEach(([x, y, col]) => { K.ln([x, y], [x + 0.6, y - 2.2], '#6f6257', 0.3); K.ball(x + 0.6, y - 2.6, 0.9, 0.9, col, 0.25); });
    K.rr(2, 7.6, 36, 2.8, 1.3, K.lg(0, 7.6, 0, 10.4, ['#a97b4f', '#6f4a2c']), 0.45); K.rr(2, 41.6, 36, 2.8, 1.3, K.lg(0, 41.6, 0, 44.4, ['#a97b4f', '#6f4a2c']), 0.45);
  });

  // 겨울 화환 — 전나무 잎 고리, 빨간 열매와 솔방울, 나무 별, 큰 리본
  defW('wreath', (g, C) => {
    const K = kit(g, C), c = C.c, cx = 20, cy = 32, R0 = 12;
    if (C.lit) return;
    K.ov(cx + 0.8, cy + 1.2, R0 + 3, R0 + 3, 'rgba(26,18,10,.16)');
    K.ov(cx, cy, R0 + 3, R0 + 3, '#2f5f30', 0.5); K.ov(cx, cy, R0 - 3.4, R0 - 3.4, null, 0.5);
    const lc = ['#3f7d3c', '#4f9a58', '#356b34', '#5aa864'];
    for (let i = 0; i < 46; i++){ const a = i / 46 * TAU + hash(i) * 0.2, r = R0 + (hash(i * 3) - 0.5) * 4; leaf(K, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.4, 0.9, a + 2 + hash(i * 5), lc[i % 4], 0); }
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(cx, cy, R0 - 3.6, R0 - 3.6, 0, 0, TAU); g.fill(); g.restore();
    [[-0.4, 1], [0.9, 1], [2.2, 0.9], [3.6, 1], [4.6, 1]].forEach(([a, k], i) => { const x = cx + Math.cos(a) * R0, y = cy + Math.sin(a) * R0; if (i % 2){ K.ball(x, y, 1.6, 2.2, '#8a5f3a', 0.3, a); for (let s = -1; s <= 1; s++) K.ln([x - 1.2, y + s * 0.8], [x + 1.2, y + s * 0.8], '#5e3a20', 0.25); } else [[0, 0], [1.4, 0.8], [-0.6, 1.4]].forEach(([dx, dy]) => K.ball(x + dx, y + dy, 1.1 * k, 1.1 * k, '#d9483f', 0.3)); });
    star5(K, cx + Math.cos(1.6) * R0, cy + Math.sin(1.6) * R0 + 0.6, 2.6, '#e8c870', 0.35);
    // 리본
    K.poly([[cx, 21], [cx - 6.5, 16.5], [cx - 7, 23.5]], K.lg(cx - 7, 0, cx, 0, [C.shade(c, 0.15), C.shade(c, -0.2)]), 0.45);
    K.poly([[cx, 21], [cx + 6.5, 16.5], [cx + 7, 23.5]], K.lg(cx, 0, cx + 7, 0, [C.shade(c, -0.05), C.shade(c, -0.3)]), 0.45);
    K.poly([[cx - 1, 22], [cx - 4.6, 30], [cx - 2.6, 29.4], [cx - 2, 31]], C.shade(c, -0.15), 0.4); K.poly([[cx + 1, 22], [cx + 4.6, 30], [cx + 2.6, 29.4], [cx + 2, 31]], C.shade(c, -0.25), 0.4);
    K.rr(cx - 1.8, 19.4, 3.6, 3.4, 1, C.shade(c, 0.1), 0.4);
    K.ln([cx, 4], [cx, 19], '#d9483f', 0.6); K.ov(cx, 4, 1, 1, '#6f6257', 0.3);
  });

  // 벽 선반 — 나무 널과 받침 둘, 책·작은 화분·촛불·달라 목마
  defW('wshelf', (g, C) => {
    const K = kit(g, C), c = C.c, sh = K.sh;
    if (C.lit) return;
    [[9], [29]].forEach(([x]) => K.poly([[x - 1.2, 30], [x + 1.2, 30], [x + 1.2, 31], [x - 2.8, 38], [x - 3.6, 38], [x - 1.2, 31]].map(p => [p[0] + 1.5, p[1]]), K.lg(0, 30, 0, 38, [sh(c, -0.05), sh(c, -0.35)]), 0.4));
    // 책 셋
    [[6, 15, 3, '#d9483f'], [9.2, 17, 2.6, '#5d8fb8'], [12, 14, 3, '#f2c14e']].forEach(([x, y, w, col]) => { K.rr(x, y, w, 26 - y, 0.4, K.lg(x, 0, x + w, 0, [sh(col, 0.2), col, sh(col, -0.25)]), 0.4); K.ln([x + 0.4, y + 2], [x + w - 0.4, y + 2], '#fff6e9', 0.4); K.ln([x + 0.4, 24], [x + w - 0.4, 24], '#fff6e9', 0.4); });
    g.save(); g.translate(16.2, 26); g.rotate(-0.28); K.rr(-1.4, -10, 2.8, 10, 0.4, '#3f7d5c', 0.4); g.restore();
    // 달라 목마
    const hx = 22.5, hy = 26; K.poly([[hx - 3.4, hy], [hx - 3, hy - 4.5], [hx + 1.6, hy - 4.5], [hx + 2, hy - 8], [hx + 3.8, hy - 8.4], [hx + 4.4, hy - 6.4], [hx + 3.2, hy - 6.2], [hx + 3, hy - 3.6], [hx + 2.6, hy]], K.lg(hx - 3, 0, hx + 4, 0, ['#e8574f', '#c23a32']), 0.4);
    K.curve([[hx - 2, hy - 4], [hx, hy - 3.2], [hx + 2, hy - 4]], '#f2c14e', 0.4); K.ov(hx - 0.4, hy - 3.6, 0.7, 0.7, '#3f7d5c');
    // 화분 · 촛불
    pot(K, 29.5, 26, 2.6, 2, 3.6, '#fff6e9', '#5d8fb8'); [[-2.3], [-1.6], [-0.9]].forEach(([a], i) => leaf(K, 29.5, 21, 4.4, 1.4, a + i * 0.05, '#4f9a58', 0.3));
    K.rr(33.6, 21, 2.6, 5, 0.6, '#fff6e9', 0.35); K.ov(34.9, 19.6, 0.8, 1.4, '#ffcf6a'); K.ov(34.9, 20, 0.4, 0.7, '#fff6d0');
    K.rr(3, 26, 34, 3.4, 0.8, K.lg(0, 26, 0, 29.4, [sh(c, 0.25), c, sh(c, -0.25)]), 0.5);
    K.ln([4, 26.6], [36, 26.6], sh(c, 0.4), 0.3);
  });

  // 별 모빌 — 천장 고리에 나무 고리, 실 끝에 별·달·구름이 흔들린다(별은 밤에 은은히)
  defW('mobile', (g, C) => {
    const K = kit(g, C), t = C.t || 0, mc = ['#ffd166', '#ff8fb8', '#8fd9c8', '#a9c8ff', '#c9a8ff'];
    if (!C.lit){ K.ln([20, 0], [20, 8], '#c9b9a4', 0.4); K.ov(20, 1, 1.4, 1.4, '#8a7b6e', 0.3); K.ln([20, 8], [8, 12], '#c9b9a4', 0.3); K.ln([20, 8], [32, 12], '#c9b9a4', 0.3); }
    const items = [[6, 14, 0], [13, 22, 1], [20, 17, 2], [27, 23, 3], [34, 15, 4]];
    items.forEach(([x, len, i]) => { const sw = Math.sin(t / 1600 + i) * 0.6, y = 13 + len;
      if (!C.lit) K.ln([x, 12.4], [x + sw, y - 3], '#c9b9a4', 0.3);
      if (i % 2 === 0) K.light(() => { if (C.lit) K.glow(x + sw, y, 6, '255,209,102', 0.3); star5(K, x + sw, y, 3.2, mc[i], 0.4, sw * 0.3); star5(K, x + sw - 0.4, y - 0.4, 1.2, '#fff6d0'); });
      else if (!C.lit){ if (i === 1){ K.ball(x + sw, y, 3.2, 3.2, mc[i], 0.4); g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(x + sw + 1.8, y - 1, 2.6, 2.8, 0, 0, TAU); g.fill(); g.restore(); }
        else { K.ball(x + sw - 1.8, y + 0.6, 2.2, 1.8, mc[i], 0.4); K.ball(x + sw + 1.8, y + 0.6, 2.2, 1.8, mc[i], 0.4); K.ball(x + sw, y - 0.8, 2.6, 2.4, mc[i], 0.4); } }
    });
    if (!C.lit){ g.strokeStyle = '#8a6a4a'; g.lineWidth = 1.1; g.beginPath(); g.ellipse(20, 12.4, 15, 1.8, 0, 0, TAU); g.stroke(); g.strokeStyle = '#c79b6d'; g.lineWidth = 0.5; g.stroke(); }
  });

  // ================= 단풍(캐나다 오두막)·밀림(아마존 나무집)·사바나(케냐 사파리 롯지) 가구 열둘 — 2026-10-09 =================
  const mleaf = (K, x, y, r, c, rot) => { const pts = []; for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5 + (rot || 0), rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9]); } K.poly(pts, c, 0.35); };
  // 체크무늬 소파 — 빨강·검정 버펄로 체크 천, 통나무 팔걸이, 단풍잎 쿠션
  def('plaidsofa', (g, C) => {
    const K = kit(g, C), O = K.O, { L, W } = O, c = '#b8302a', AW = 6, BD = 7;
    if (C.lit) return;
    K.shadow();
    [[3, 3], [L - 3, 3], [3, W - 3], [L - 3, W - 3]].forEach(([u, v]) => O.cyl ? O.cyl(u, v, 1.2, 0, 4, '#6a4428') : 0);
    O.box(0, 0, L, W, 3.5, 7, '#7a4a2a');
    O.box(0, 0, L, BD, 10, 18, c, { t: K.sh(c, 0.12) });
    const sw = (L - AW * 2) / 2;
    for (let n = 0; n < 2; n++){ const u0 = AW + n * sw; O.box(u0 + 0.3, BD, sw - 0.6, W - BD - 1, 10, 5, c, { t: K.sh(c, 0.16) });
      for (let k = 1; k < 4; k++){ K.ln(O.p(u0 + 0.3 + (sw - 0.6) * k / 4, BD, 15.1), O.p(u0 + 0.3 + (sw - 0.6) * k / 4, W - 1, 15.1), 'rgba(20,10,10,.45)', 1); K.ln(O.p(u0 + 0.3, BD + (W - BD - 1) * k / 4, 15.1), O.p(u0 + sw - 0.3, BD + (W - BD - 1) * k / 4, 15.1), 'rgba(20,10,10,.45)', 1); } }
    for (let k = 1; k < 8; k++){ const u = L * k / 8; K.ln(O.p(u, BD, 10.5), O.p(u, BD, 27.5), 'rgba(20,10,10,.4)', 1.1); }
    [13, 18, 23].forEach(z => K.ln(O.p(0.5, BD, z), O.p(L - 0.5, BD, z), 'rgba(20,10,10,.4)', 1.1));
    [0, L - AW].forEach(u => { O.box(u, 0, AW, W, 10, 11, '#a0703e', { t: '#c8945a' }); const e = O.p(u + AW / 2, W, 15); K.ov(e[0], e[1], 2.4, 2.6, '#e8c890', 0.4); K.ov(e[0], e[1], 1.2, 1.3, '#b88a58'); });
    const cp = O.p(AW + 5, BD + 1.5, 21); K.poly([[cp[0] - 5, cp[1] - 4], [cp[0] + 5, cp[1] - 5], [cp[0] + 5.5, cp[1] + 4], [cp[0] - 4.5, cp[1] + 5]], '#f4ead6', 0.5); mleaf(K, cp[0] + 0.4, cp[1], 3.4, '#d8402a');
  });
  // 단풍잎 깔개 — 커다란 단풍잎 모양 양탄자, 잎맥 수
  def('leafrug', (g, C) => {
    const K = kit(g, C), O = K.O, p = O.p, L = O.L, W = O.W, z = 0.6, cu = L / 2, cv = W / 2, R = Math.min(L, W) / 2 - 1.5;
    if (C.lit) return;
    const pts = []; for (let i = 0; i < 22; i++){ const a = i / 22 * TAU, k = i % 2 ? 0.55 : (i % 4 === 0 ? 1 : 0.85); pts.push(p(cu + Math.cos(a) * R * k * (L / W > 1.4 ? 1.7 : 1), cv + Math.sin(a) * R * k, z)); }
    g.save(); g.translate(0.8, 1); K.poly(pts, 'rgba(40,22,12,.2)'); g.restore();
    K.poly(pts, K.lg(pts[11][0], pts[11][1], pts[0][0], pts[0][1], ['#f8a040', '#e8602a', '#c83a1a']), 0.5);
    for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; K.ln(p(cu, cv, z), p(cu + Math.cos(a) * R * 0.9 * (L / W > 1.4 ? 1.7 : 1), cv + Math.sin(a) * R * 0.9, z), '#8a2a10', 0.6); }
    K.ov(p(cu, cv, z)[0], p(cu, cv, z)[1], 1.4, 0.8, '#8a2a10');
  });
  // 시럽 병 선반 — 나무 선반 세 칸에 호박빛 메이플 시럽 병과 단풍잎 상표
  def('syrupshelf', (g, C) => {
    const K = kit(g, C), x = C.CX, y = C.CY, wd = '#a0703e';
    if (C.lit) return;
    K.blob(x, y, 10, 3.4);
    K.poly([[x - 10, y], [x - 10, y - 40], [x + 10, y - 40], [x + 10, y]], K.lg(x - 10, 0, x + 10, 0, [K.sh(wd, 0.12), wd, K.sh(wd, -0.25)]), 0.5);
    K.poly([[x - 8.4, y - 2], [x - 8.4, y - 38], [x + 8.4, y - 38], [x + 8.4, y - 2]], '#5a3a24');
    [[-2, '#c8781e'], [-15, '#d8902a'], [-28, '#b8681a']].forEach(([dy, col], r) => {
      K.poly([[x - 9.6, y + dy], [x + 9.6, y + dy], [x + 9.6, y + dy - 1.6], [x - 9.6, y + dy - 1.6]], '#c8945a', 0.4);
      for (let i = 0; i < 3; i++){ const bx = x - 5.6 + i * 5.6, by = y + dy - 1.6; K.poly([[bx - 2, by], [bx + 2, by], [bx + 2, by - 6.4], [bx + 0.8, by - 8], [bx + 0.8, by - 9.6], [bx - 0.8, by - 9.6], [bx - 0.8, by - 8], [bx - 2, by - 6.4]], K.lg(bx - 2, 0, bx + 2, 0, [K.sh(col, 0.25), col, K.sh(col, -0.25)]), 0.4);
        K.poly([[bx - 1.6, by - 1.4], [bx + 1.6, by - 1.4], [bx + 1.6, by - 4.6], [bx - 1.6, by - 4.6]], '#f4ead6'); mleaf(K, bx, by - 3, 1.3, '#d8302a', r * 0.3); K.ov(bx - 0.9, by - 5.6, 0.4, 1, 'rgba(255,255,255,.5)'); }
    });
  });
  // 단풍잎 등 — 벽에 거는 단풍잎 모양 종이 등, 밤이면 주홍빛
  defW('leaflamp', (g, C) => {
    const K = kit(g, C), x = 20, y = 28;
    K.light(() => { if (C.lit) K.glow(x, y, 24, '255,160,80', 0.5); mleaf(K, x, y, 13, C.lit ? '#ffb060' : '#e8702a'); mleaf(K, x, y, 8, C.lit ? '#ffd890' : '#f8a040'); });
    if (C.lit) return;
    hang(K, 20, 2.5, 0); K.ln([20, 3], [20, y - 12], '#8a7b6e', 0.45);
    for (let i = 0; i < 5; i++){ const a = -Math.PI / 2 + i * TAU / 5; K.ln([x, y], [x + Math.cos(a) * 11, y + Math.sin(a) * 10], 'rgba(120,40,10,.5)', 0.4); }
    K.ln([x, y + 8], [x, y + 14], '#6a4428', 0.8);
  });
  // 등나무 흔들의자 — 둥근 공 모양 등나무 의자, 초록 방석
  def('rattan', (g, C) => {
    const K = kit(g, C), x = C.CX, y = C.CY, t = C.t || 0, rt = '#c8a060';
    if (C.lit) return;
    K.blob(x, y, 10, 3.6);
    K.ln([x, y - 2], [x, y - 40], '#6a4a2a', 1.2); K.ov(x, y - 1, 6, 1.6, '#8a6a3a', 0.4);
    g.save(); g.translate(x, y - 40); g.rotate(Math.sin(t / 1300) * 0.04); g.translate(-x, -(y - 40));
    K.ov(x, y - 22, 11, 12, K.rg(x - 3, y - 26, 16, [K.sh(rt, 0.25), rt, K.sh(rt, -0.35)]), 0.5);
    for (let i = -4; i <= 4; i++) K.curve([[x + i * 2.4, y - 33], [x + i * 2.8, y - 22], [x + i * 2.4, y - 11]], 'rgba(110,70,20,.45)', 0.4);
    for (let j = 0; j < 6; j++) K.curve([[x - 10, y - 30 + j * 3.6], [x, y - 31 + j * 3.6], [x + 10, y - 30 + j * 3.6]], 'rgba(110,70,20,.35)', 0.35);
    K.ov(x + 1, y - 19, 8, 6, '#5a3a20'); K.ov(x + 1, y - 16, 7, 4, K.lg(x - 6, 0, x + 8, 0, ['#4aa048', '#2a7a34']), 0.4);
    g.restore();
  });
  // 몬스테라 화분 — 구멍 난 큰 잎, 짚 바구니 화분
  def('monstera', (g, C) => {
    const K = kit(g, C), x = C.CX, y = C.CY;
    if (C.lit) return;
    K.blob(x, y, 9, 3.4);
    [[-2.4, 16, 6], [-1.2, 18, 7], [-0.5, 15, 6.4], [-1.9, 12, 5.4], [-0.1, 11, 5]].forEach(([a, l, r], i) => {
      const lx = x + Math.cos(a) * l, ly = y - 12 + Math.sin(a) * l; K.curve([[x, y - 11], [x + Math.cos(a) * l * 0.5, y - 14 + Math.sin(a) * l * 0.5], [lx, ly]], '#2a6a2a', 0.6);
      K.ov(lx, ly, r, r * 0.8, K.lg(lx - r, ly - r, lx + r, ly + r, ['#4aa048', '#2a7a34', '#1a5a24']), 0.45, a + Math.PI / 2);
      for (let k = 0; k < 3; k++) K.ov(lx + Math.cos(a + 1.6) * (k - 1) * r * 0.45, ly + Math.sin(a + 1.6) * (k - 1) * r * 0.45, 0.7, 0.5, '#1a4a1e');
      K.ln([lx - Math.cos(a) * r * 0.8, ly - Math.sin(a) * r * 0.8], [lx + Math.cos(a) * r * 0.8, ly + Math.sin(a) * r * 0.8], 'rgba(150,210,120,.6)', 0.35); });
    K.poly([[x - 6.5, y - 11], [x + 6.5, y - 11], [x + 5.5, y], [x - 5.5, y]], K.lg(x - 6, 0, x + 6, 0, ['#e8d098', '#c8a868', '#a08048']), 0.5);
    for (let k = 0; k < 4; k++) K.curve([[x - 6, y - 9 + k * 2.4], [x, y - 8 + k * 2.4], [x + 6, y - 9 + k * 2.4]], '#8a6a38', 0.35);
    K.ov(x, y - 11, 6.6, 1.5, '#c8a868', 0.45);
  });
  // 짚 깔개 — 야자잎을 엮은 네모 깔개, 가장자리 초록·빨강 줄
  def('weaverug', (g, C) => {
    const K = kit(g, C), O = K.O, p = O.p, L = O.L, W = O.W, u0 = 3, u1 = L - 3, v0 = 3, v1 = W - 3, z = 0.6;
    if (C.lit) return;
    K.poly([p(u0, v0, 0), p(u1, v0, 0), p(u1, v1, 0), p(u0, v1, 0)], 'rgba(26,18,10,.12)');
    K.poly([p(u0, v0, z), p(u1, v0, z), p(u1, v1, z), p(u0, v1, z)], '#d8b870', 0.5);
    for (let u = u0 + 1.5; u < u1; u += 1.6) K.ln(p(u, v0, z), p(u, v1, z), 'rgba(140,100,40,.35)', 0.4);
    for (let v = v0 + 1.5; v < v1; v += 1.6) K.ln(p(u0, v, z), p(u1, v, z), 'rgba(255,240,200,.25)', 0.4);
    [[v0 + 1.6, '#2a8a3a'], [v1 - 1.6, '#c83a2a']].forEach(([v, c]) => K.poly([p(u0, v - 0.6, z), p(u1, v - 0.6, z), p(u1, v + 0.6, z), p(u0, v + 0.6, z)], c));
  });
  // 앵무새 등 — 벽 고리에 앉은 앵무새 모양 등, 배가 노랗게 빛난다
  defW('parrotlamp', (g, C) => {
    const K = kit(g, C), x = 20, y = 30;
    if (!C.lit){ hang(K, 20, 2.5, 0); K.ln([20, 3], [20, 12], '#8a7b6e', 0.45); K.ln([11, 13], [29, 13], '#8a6040', 1.4); }
    K.light(() => { if (C.lit) K.glow(x, y + 2, 22, '255,210,120', 0.45); K.ov(x, y + 2, 5, 7, C.lit ? '#ffe0a0' : '#f0c020', C.lit ? 0 : 0.4); });
    if (C.lit) return;
    K.poly([[x - 5, y - 3], [x - 9, y + 16], [x - 6, y + 17], [x - 2, y + 4]], '#2a6ae8', 0.4); K.poly([[x + 5, y - 3], [x + 9, y + 12], [x + 6, y + 13], [x + 2, y + 4]], '#2a6ae8', 0.4);
    K.ball(x, y - 6, 5, 5, '#e8302a', 0.45); K.ov(x + 1.6, y - 6, 1.8, 1.6, '#fff4ec'); K.ov(x + 1.8, y - 6.4, 0.6, 0.6, '#2a2a2a');
    K.poly([[x + 4, y - 7], [x + 7.4, y - 5.6], [x + 4.6, y - 3.6]], '#3a3a3a', 0.3);
    K.poly([[x - 1, y + 9], [x - 3, y + 22], [x + 1, y + 22], [x + 1, y + 9]], '#e8302a', 0.4);
    [[-2, 13], [2, 13]].forEach(([dx]) => K.ln([x + dx, y + 8], [x + dx, 13.5], '#7a7a80', 0.6));
  });
  // 캉가 천 깔개 — 주황 바탕에 검정·빨강 테두리, 가운데 둥근 무늬와 술
  def('kanga', (g, C) => {
    const K = kit(g, C), O = K.O, p = O.p, L = O.L, W = O.W, u0 = 3, u1 = L - 3, v0 = 3, v1 = W - 3, z = 0.6;
    if (C.lit) return;
    K.poly([p(u0, v0, 0), p(u1, v0, 0), p(u1, v1, 0), p(u0, v1, 0)], 'rgba(26,18,10,.12)');
    K.poly([p(u0, v0, z), p(u1, v0, z), p(u1, v1, z), p(u0, v1, z)], '#1a1a1a', 0.5);
    K.poly([p(u0 + 1.4, v0 + 1.4, z), p(u1 - 1.4, v0 + 1.4, z), p(u1 - 1.4, v1 - 1.4, z), p(u0 + 1.4, v1 - 1.4, z)], '#c82a2a');
    K.poly([p(u0 + 2.8, v0 + 2.8, z), p(u1 - 2.8, v0 + 2.8, z), p(u1 - 2.8, v1 - 2.8, z), p(u0 + 2.8, v1 - 2.8, z)], '#f08a20');
    const c = p((u0 + u1) / 2, (v0 + v1) / 2, z); K.ov(c[0], c[1], 7, 3.4, '#1a1a1a'); K.ov(c[0], c[1], 5, 2.4, '#f0c020'); K.ov(c[0], c[1], 2.4, 1.2, '#c82a2a');
    for (let i = 0; i < 10; i++){ const u = u0 + 4 + (u1 - u0 - 8) * i / 9; [v0 + 4.4, v1 - 4.4].forEach(v => { const a = p(u, v, z); K.ov(a[0], a[1], 0.6, 0.4, '#1a1a1a'); }); }
    [u0, u1].forEach((u, k) => { for (let i = 0; i <= 8; i++){ const v = v0 + (v1 - v0) * i / 8; K.ln(p(u, v, z), p(u + (k ? 1.8 : -1.8), v, z), '#c82a2a', 0.45); } });
  });
  // 북 의자 — 통나무를 깎은 북 모양 의자, 가죽 덮개와 끈
  def('drumstool', (g, C) => {
    const K = kit(g, C), x = C.CX, y = C.CY, wd = '#8a5a3a';
    if (C.lit) return;
    K.blob(x, y, 9, 3.4);
    K.poly([[x - 8, y - 1], [x - 6, y - 10], [x - 8, y - 18], [x + 8, y - 18], [x + 6, y - 10], [x + 8, y - 1]], K.lg(x - 8, 0, x + 8, 0, [K.sh(wd, 0.2), wd, K.sh(wd, -0.3)]), 0.5);
    K.ov(x, y - 1, 8, 2.6, K.sh(wd, -0.2), 0.4);
    for (let i = -3; i <= 3; i++){ K.ln([x + i * 2.2, y - 17], [x + i * 1.6, y - 10], '#e8d8b0', 0.5); K.ln([x + i * 1.6, y - 10], [x + i * 2.2, y - 2], '#e8d8b0', 0.5); }
    K.ov(x, y - 18, 8, 2.6, K.lg(x - 8, 0, x + 8, 0, ['#f4e2c0', '#d8c098']), 0.5);
    [[-3, '#c82a2a'], [0, '#f0c020'], [3, '#2a6ae8']].forEach(([dx, c]) => K.ov(x + dx, y - 10, 0.9, 1.1, c, 0.3));
  });
  // 나무 기린 조각 — 키 큰 나무 기린 장식, 얼룩 무늬를 새겼다
  def('woodgiraffe', (g, C) => {
    const K = kit(g, C), x = C.CX, y = C.CY, wd = '#d8a040', dk = '#8a5a2a';
    if (C.lit) return;
    K.blob(x, y, 8, 3);
    K.poly([[x - 6, y], [x + 6, y], [x + 6, y - 2.4], [x - 6, y - 2.4]], '#6a4428', 0.4);
    [[-3.4], [-1.4], [1.4], [3.4]].forEach(([dx]) => K.poly([[x + dx - 0.6, y - 2.4], [x + dx + 0.6, y - 2.4], [x + dx + 0.6, y - 13], [x + dx - 0.6, y - 13]], wd, 0.35));
    K.ov(x, y - 15, 6, 3.4, K.lg(x - 6, 0, x + 6, 0, [K.sh(wd, 0.2), wd, K.sh(wd, -0.25)]), 0.45);
    K.poly([[x + 3, y - 16], [x + 7, y - 38], [x + 9, y - 37.6], [x + 6, y - 15]], K.lg(x + 3, 0, x + 9, 0, [K.sh(wd, 0.15), wd]), 0.45);
    K.ov(x + 9, y - 39, 3.4, 2, wd, 0.45); K.ov(x + 11, y - 38.4, 0.4, 0.4, '#2a1a10');
    [[x + 7.4, y - 42.4], [x + 9.4, y - 42.6]].forEach(([hx, hy]) => { K.ln([hx, hy + 2], [hx, hy], dk, 0.7); K.ov(hx, hy, 0.7, 0.7, dk); });
    [[-3, -15], [0.6, -16.4], [3, -14.4], [6, -22], [7, -29], [7.6, -34]].forEach(([dx, dy]) => K.ov(x + dx, y + dy, 1.2, 0.9, dk));
  });
  // 구슬 등 — 마사이 구슬을 꿴 둥근 등, 밤이면 알록달록 빛 점
  defW('beadlamp', (g, C) => {
    const K = kit(g, C), x = 20, y = 30, cols = ['#c82a2a', '#2a6ae8', '#f0c020', '#1a8a3a', '#ffffff'];
    if (!C.lit){ hang(K, 20, 2.5, 0); K.ln([20, 3], [20, y - 9], '#8a7b6e', 0.45); }
    K.light(() => { if (C.lit) K.glow(x, y, 22, '255,200,130', 0.45); K.ov(x, y, 8, 9, C.lit ? '#ffd890' : '#e8c890', C.lit ? 0 : 0.45); });
    if (C.lit) return;
    for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++){ const a = i / 9 * Math.PI - Math.PI / 2 + 0.2, rr = 8 - Math.abs(r - 2) * 1.2; K.ov(x + Math.cos(a) * rr * (i % 2 ? 1 : -1) * 0.9, y - 6 + r * 3, 0.8, 0.8, cols[(r + i) % 5]); }
    for (let k = -3; k <= 3; k++) K.ln([x + k * 1.2, y + 9], [x + k * 1.6, y + 15], cols[(k + 3) % 5], 0.6);
  });
})();
