// pages/farm-hd-people.js — 스테이지2 고화소 사람·인형·행상인 수레, 그리고 스테이지2 로 넘어가는 비행선 장면(2026-10-09).
// farm-hd.js 와 같은 붓(캔버스 경로·그러데이션)으로 칠한다. farm-hd.js 안 함수는 감춰져 있어 필요한 것만 여기 따로 둔다.
// 사람은 라이프퀘스트 아이 그림(hero-*.png)과 어울리게 2~2.5등신 — 큰 머리, 짧은 몸, 진한 테두리. 북쪽 나라 옷(털모자·목도리·두꺼운 외투).
// 좌표는 농장 도트 단위(발끝 = x, y). farm.js 가 hd(fn) 로 ctx 를 S 배 키워 놓고 부른다.
(function(){
  'use strict';
  const TAU = Math.PI * 2;
  const INK = 'rgba(22,30,48,.85)';
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  const rgb = c => { const v = parseInt(c.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * k).toString(16).padStart(2, '0')).join(''); };
  const shade = (c, k) => k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k);
  const toneMemo = {};
  const tone = c => toneMemo[c] || (toneMemo[c] = mix(c, '#14204a', 0.48));   // farm-hd.js 의 밤 빛깔 누르기와 같은 값
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- 붓 ----------
  let g = null;
  const path = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  const ink = w => { g.strokeStyle = INK; g.lineWidth = w || 0.9; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const poly = (pts, c, w) => { path(pts); if (c){ g.fillStyle = c; g.fill(); } if (w) ink(w); };
  const oval = (x, y, rx, ry, c, w) => { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); if (c){ g.fillStyle = c; g.fill(); } if (w) ink(w); };
  const lin = (x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
  const rrect = (x, y, w, h, r, c, lw) => { g.beginPath(); g.roundRect(x, y, w, h, r); if (c){ g.fillStyle = c; g.fill(); } if (lw) ink(lw); };
  const glow = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + a + ')'); gr.addColorStop(1, c + '0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };

  // ================= 사람 =================
  // hat: fur(귀덮개 털모자) · beanie(방울 털실 모자) · hood(털 테 두른 파카 모자)
  const LOOKS = {
    guest: [
      { skin: '#f7cfae', hair: '#3a2a22', hat: 'beanie', hatC: '#d9504a', trim: '#ffffff', coat: '#f0e6d6', scarf: '#d9504a', mitt: '#d9504a', boots: '#6b4a34' },
      { skin: '#eebd96', hair: '#e2b45a', hat: 'fur', hatC: '#3e5f8a', trim: '#f2ece2', coat: '#4f8fb8', scarf: '#f2c94c', mitt: '#f2c94c', boots: '#3e2c24' },
      { skin: '#f7d2b6', hair: '#7a4a2e', hat: 'hood', hatC: '#5aa07a', trim: '#f4ead8', coat: '#5aa07a', scarf: '#f4ead8', mitt: '#e8875e', boots: '#4a3428' },
      { skin: '#d9a47e', hair: '#2a1e1a', hat: 'beanie', hatC: '#8a5cc7', trim: '#f6d0ff', coat: '#3b4a6a', scarf: '#8a5cc7', mitt: '#f6d0ff', boots: '#2e2a30' },
      { skin: '#f9d6bd', hair: '#c46a3a', hat: 'beanie', hatC: '#4fa3d9', trim: '#ffffff', coat: '#e87a8a', scarf: '#ffffff', mitt: '#4fa3d9', boots: '#7a5236' },
      { skin: '#f0c4a0', hair: '#4a3020', hat: 'fur', hatC: '#8a6a4a', trim: '#f4ece0', coat: '#8a3a3a', scarf: '#2f5d8a', mitt: '#2f5d8a', boots: '#3e2c24' },
      { skin: '#f7cfae', hair: '#f0e0b0', hat: 'hood', hatC: '#e0a33a', trim: '#fff6e0', coat: '#e0a33a', scarf: '#3e5f8a', mitt: '#3e5f8a', boots: '#4a3428' },
      { skin: '#e6b48e', hair: '#5a3a28', hat: 'beanie', hatC: '#2f8a6a', trim: '#f2c94c', coat: '#5a6a7a', scarf: '#f2c94c', mitt: '#d9504a', boots: '#3a2f2a' },
    ],
  };
  const GUEST_TALL = [48, 50, 46, 52, 47, 51, 49, 48];
  // 발끝 (x, y). o: { tall, flip(오른쪽을 본다), back(뒷모습), side(3/4 옆), step(0 서기·1~4 걷기), frame(0·1 눈웃음·2 손 흔들기), alpha }
  function person(gg, x, y, L, o){
    g = gg; o = o || {};
    const s = (o.tall || 52) / 52, back = !!o.back, fx = back ? 0 : (o.side ? -2.4 : 0);
    const ph = o.step ? (o.step - 1) / 4 * TAU : 0, sw = o.step ? Math.sin(ph) : 0, bob = o.step ? Math.abs(Math.cos(ph)) * 0.8 : 0;
    g.save(); if (o.alpha != null) g.globalAlpha *= o.alpha;
    oval(x + 1, y + 0.4, 10.5 * s, 3.3 * s, 'rgba(10,16,40,.28)');
    g.translate(x, y - bob * s); g.scale(o.flip ? -s : s, s);
    // 짐 — 등에 멘 봇짐(앞에서는 어깨 너머로 보인다)
    if (L.pack && !back){ rrect(-11, -34, 22, 22, 4, shade(L.pack, -0.1), 0.9); rrect(-12.5, -38, 25, 6, 3, '#c9b48a', 0.9); }
    if (L.hat === 'hood'){ oval(0, -39, 15, 14.5, shade(L.hatC, -0.1), 0.9); }
    // 장화
    const boot = (bx, lift, dx) => { rrect(bx + dx - 3.4, -5.2 - lift, 6.8, 5.4, 2.2, L.boots, 0.9); rrect(bx + dx - 2.6, -4.6 - lift, 2.4, 1.2, 0.6, shade(L.boots, 0.25)); };
    boot(-3.8, o.step ? Math.max(0, sw) * 2 : 0, o.step ? sw * 1.6 : 0);
    boot(3.8, o.step ? Math.max(0, -sw) * 2 : 0, o.step ? -sw * 1.6 : 0);
    // 외투 — 어깨는 좁고 아랫단은 넓게, 털 단
    g.beginPath(); g.moveTo(-7.5, -27); g.quadraticCurveTo(0, -29.5, 7.5, -27); g.quadraticCurveTo(10.5, -18, 11.2, -6.5); g.quadraticCurveTo(0, -3.6, -11.2, -6.5); g.quadraticCurveTo(-10.5, -18, -7.5, -27); g.closePath();
    g.fillStyle = lin(0, -28, 0, -5, [shade(L.coat, 0.12), shade(L.coat, -0.18)]); g.fill(); ink();
    g.beginPath(); g.moveTo(-11.4, -7.6); g.quadraticCurveTo(0, -4.6, 11.4, -7.6); g.lineTo(11.6, -5.4); g.quadraticCurveTo(0, -2.2, -11.6, -5.4); g.closePath(); g.fillStyle = L.trim; g.fill(); ink(0.7);
    if (!back){
      if (L.apron){ rrect(-6 + fx * 0.3, -21, 12, 14.5, 3, L.apron, 0.8); rrect(-3 + fx * 0.3, -15, 6, 4, 1.2, shade(L.apron, -0.12), 0.6); }
      else { g.strokeStyle = shade(L.coat, -0.35); g.lineWidth = 0.7; g.beginPath(); g.moveTo(fx * 0.4, -25); g.lineTo(fx * 0.4, -7); g.stroke(); [-21, -16, -11].forEach(by => oval(fx * 0.4 + 1.6, by, 0.9, 0.9, '#f2e6c8')); }
    } else if (L.pack){ rrect(-9, -30, 18, 20, 4, L.pack, 0.9); rrect(-10.5, -34, 21, 6, 3, '#c9b48a', 0.9); g.strokeStyle = shade(L.pack, -0.3); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-9, -22); g.lineTo(9, -22); g.stroke(); }
    // 팔 — 걸으면 앞뒤로 흔든다. 손 흔들기면 앞쪽 팔(+x)을 머리 곁으로
    const arm = (sd, up) => {
      const sx = sd * 8.2, sy = -24.5, hx = up ? sd * 13 : sd * 10.4 + (o.step ? sd * sw * 1.2 : 0), hy = up ? -37 : -13 + (o.step ? sw * sd * 1.5 : 0);
      g.strokeStyle = INK; g.lineWidth = 6.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = shade(L.coat, sd > 0 ? -0.12 : 0.04); g.lineWidth = 4.8; g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
      oval(hx, hy + (up ? -1 : 1), 2.7, 2.7, L.mitt, 0.8);
    };
    arm(-1, false); arm(1, o.frame === 2 && !back);
    // 목도리 — 감은 띠와 늘어진 끝
    rrect(-9, -30, 18, 5, 2.5, L.scarf, 0.8);
    g.strokeStyle = shade(L.scarf, -0.25); g.lineWidth = 0.6; g.beginPath(); for (let i = -6; i <= 6; i += 3){ g.moveTo(i, -29.6); g.lineTo(i + 1, -25.4); } g.stroke();
    rrect(back ? -6.5 : 2.5, -27, 4.2, 10, 1.6, L.scarf, 0.8);
    g.strokeStyle = shade(L.scarf, 0.4); g.lineWidth = 0.6; g.beginPath(); g.moveTo(back ? -6 : 3, -18.5); g.lineTo(back ? -2.6 : 6.4, -18.5); g.stroke();
    // 머리
    oval(0, -39, 12.4, 11.8, L.skin, 1);
    if (back) oval(0, -38, 12, 10.8, L.hair);
    else {
      g.fillStyle = L.hair; g.beginPath(); g.moveTo(-12.2, -40); g.quadraticCurveTo(-11, -48, 0, -48.5); g.quadraticCurveTo(11, -48, 12.2, -40); g.quadraticCurveTo(6 + fx, -44.5, 0 + fx, -42); g.quadraticCurveTo(-6 + fx, -44.5, -12.2, -40); g.fill();
      const ey = -37;
      if (o.frame === 1){ g.strokeStyle = '#2b2622'; g.lineWidth = 1.1; g.lineCap = 'round'; [-4.4, 4.4].forEach(ex => { g.beginPath(); g.arc(fx + ex, ey + 0.8, 1.7, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }); }
      else [-4.4, 4.4].forEach(ex => { oval(fx + ex, ey, 1.5, 2, '#2b2622'); oval(fx + ex - 0.5, ey - 0.8, 0.55, 0.6, '#ffffff'); });
      [-7.4, 7.4].forEach(ex => oval(fx + ex, ey + 3.6, 2.2, 1.3, 'rgba(240,120,120,.45)'));
      if (L.beard){ g.fillStyle = L.beard; g.beginPath(); g.moveTo(fx - 8, -35); g.quadraticCurveTo(fx - 8, -25, fx, -24.5); g.quadraticCurveTo(fx + 8, -25, fx + 8, -35); g.quadraticCurveTo(fx, -31, fx - 8, -35); g.fill(); ink(0.6); }
      if (L.mustache){ g.fillStyle = L.mustache; [-1, 1].forEach(sd => { g.beginPath(); g.ellipse(fx + sd * 2.2, -33, 2.6, 1.3, sd * 0.25, 0, TAU); g.fill(); }); }
      g.strokeStyle = '#7a3a2a'; g.lineWidth = 0.8; g.beginPath(); g.arc(fx, -32.6 + (L.mustache ? 1.2 : 0), 1.4, 0.2, Math.PI - 0.2); g.stroke();
    }
    // 모자
    if (L.hat === 'fur'){
      g.beginPath(); g.moveTo(-12, -42); g.bezierCurveTo(-12, -55, 12, -55, 12, -42); g.closePath(); g.fillStyle = lin(0, -54, 0, -42, [shade(L.hatC, 0.15), shade(L.hatC, -0.15)]); g.fill(); ink();
      [-1, 1].forEach(sd => rrect(sd * 12.6 - 3, -43, 6, 12.5, 3, L.trim, 0.8));
      g.beginPath(); for (let i = 0; i <= 10; i++){ const xx = -13.4 + i * 2.68; g.arc(xx, -43.2, 1.9, Math.PI, 0); } g.lineTo(13.4, -40.4); g.quadraticCurveTo(0, -38.8, -13.4, -40.4); g.closePath(); g.fillStyle = L.trim; g.fill(); ink(0.7);
    } else if (L.hat === 'beanie'){
      g.beginPath(); g.moveTo(-12.6, -41); g.bezierCurveTo(-12.6, -56, 12.6, -56, 12.6, -41); g.closePath(); g.fillStyle = lin(0, -55, 0, -41, [shade(L.hatC, 0.15), shade(L.hatC, -0.12)]); g.fill(); ink();
      g.strokeStyle = shade(L.hatC, 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-11.5, -47.5); g.quadraticCurveTo(0, -50, 11.5, -47.5); g.stroke();
      rrect(-13, -44.2, 26, 4.4, 2, shade(L.hatC, -0.15), 0.8);
      oval(0, -54.5, 3.6, 3.4, L.trim, 0.8);
    } else if (L.hat === 'hood'){
      g.strokeStyle = INK; g.lineWidth = 5.4; g.beginPath(); g.arc(0, -39, 12.6, Math.PI * 0.9, Math.PI * 2.1); g.stroke();
      g.strokeStyle = L.trim; g.lineWidth = 3.8; g.beginPath(); g.arc(0, -39, 12.6, Math.PI * 0.9, Math.PI * 2.1); g.stroke();
      g.strokeStyle = 'rgba(160,140,110,.5)'; g.lineWidth = 0.6; g.beginPath(); for (let i = 0; i < 14; i++){ const a = Math.PI * (0.92 + i * 0.085); g.moveTo(Math.cos(a) * 11.2, -39 + Math.sin(a) * 11.2); g.lineTo(Math.cos(a) * 14, -39 + Math.sin(a) * 14); } g.stroke();
    }
    g.restore();
    return true;
  }
  // kind: 'guest' 만 남았다 — 가게 아저씨·행상인은 2026-10-09 로키즈 「퀄리티가 낮아」로 스테이지1 도트 그림을 쓴다. n 은 손님 번호(0~7)
  function npc(gg, kind, x, y, o){
    o = Object.assign({}, o);
    if (kind !== 'guest') return false;
    const n = ((o.n | 0) % 8 + 8) % 8; o.tall = o.tall || GUEST_TALL[n];
    return person(gg, x, y, LOOKS.guest[n], o);
  }
  // 여덟 방향(dir8) → 그림 방향
  const facing = d => ({ back: /N/.test(d), flip: /E/.test(d), side: d !== 'S' && d !== 'N' });

  // ================= 인형(방에서 따라 나온 것) =================
  // fox = 분홍 여우 레샤, sangre = 둥근 흰 새 상그렐라. pal 은 farm.js DOLLS 색표. d: 'u'·'v'(앞) · '-u'·'-v'(뒤), u·-v 는 오른쪽을 본다
  function doll(gg, kind, x, y, d, frame, pal){
    g = gg; pal = pal || {};
    const back = d === '-u' || d === '-v', flip = d === 'u' || d === '-v', fx = back ? 0 : -1.4, lift = frame ? 1 : 0;
    g.save(); oval(x + 0.6, y + 0.2, 5.6, 1.9, 'rgba(10,16,40,.26)');
    g.translate(x, y - lift); if (flip) g.scale(-1, 1);
    if (kind === 'fox'){
      const P = pal.p || '#f0cfc9', C = pal.c || '#f9f2e8';
      const tail = () => { g.beginPath(); g.moveTo(3, -4); g.bezierCurveTo(10, -3, 12, -10, 8.5, -13); g.bezierCurveTo(7, -9, 5, -7, 2.5, -7.5); g.closePath(); g.fillStyle = P; g.fill(); ink(0.7); oval(9.2, -11.6, 1.8, 1.8, C); };
      if (!back) tail();
      [-2.4, 2.4].forEach(lx => oval(lx, -1.4, 1.8, 1.5, shade(P, -0.12), 0.6));
      oval(0, -5.6, 5.4, 4.8, lin(0, -10, 0, -1, [shade(P, 0.1), shade(P, -0.12)]), 0.8);
      if (!back) oval(fx * 0.5, -5, 3, 3, C);
      [-1, 1].forEach(sd => { poly([[sd * 2.4, -17.5], [sd * 5.8, -24.5], [sd * 6.4, -16]], P, 0.7); poly([[sd * 3.4, -18], [sd * 5.6, -22.6], [sd * 5.8, -17.2]], C); });
      oval(0, -14.6, 6.6, 5.8, lin(0, -20, 0, -9, [shade(P, 0.12), shade(P, -0.08)]), 0.8);
      if (!back){
        oval(fx, -12.8, 3.6, 2.6, C);
        [-2.5, 2.5].forEach(ex => { oval(fx + ex, -15.4, 0.95, 1.25, pal.e || '#2b2622'); oval(fx + ex - 0.3, -15.9, 0.35, 0.35, '#fff'); });
        oval(fx, -13.6, 0.9, 0.7, pal.n || '#9c5b2a');
        [-4.6, 4.6].forEach(ex => oval(fx + ex, -13.2, 1.2, 0.7, 'rgba(240,120,120,.4)'));
      } else tail();
    } else {
      const B = pal.b || '#fff6e9', Sd = pal.s || '#e6d9c4', K = pal.k || '#ffc94d';
      [-2.4, 2.4].forEach(lx => oval(lx, -0.6, 1.4, 0.9, pal.K || '#d9a72e'));
      oval(0, -7.6, 7, 6.8, lin(0, -14, 0, -1, [shade(B, 0.3), shade(Sd, -0.05)]), 0.8);
      g.beginPath(); g.ellipse(0, -14, 1.2, 2, 0.3, 0, TAU); g.fillStyle = B; g.fill(); ink(0.5);   // 머리 깃
      (back ? [-1, 1] : [1]).forEach(sd => { g.beginPath(); g.ellipse(sd * 5, -7, 2.8, 4, sd * -0.3, 0, TAU); g.fillStyle = Sd; g.fill(); ink(0.6); });
      if (!back){
        [-2.6, 2.6].forEach(ex => { oval(fx + ex, -9.2, 0.95, 1.25, pal.e || '#3a3226'); oval(fx + ex - 0.3, -9.7, 0.35, 0.35, '#fff'); });
        poly([[fx - 1.4, -7.4], [fx + 1.4, -7.4], [fx, -5.4]], K, 0.5);
        [-4.6, 3.8].forEach(ex => oval(fx + ex, -7, 1.2, 0.7, 'rgba(240,120,120,.4)'));
      }
    }
    g.restore();
    return true;
  }

  // ================= 행상인 수레(고화소) =================
  // G = farm.js pedCartGeo(P), C = PED_CART(bed·top·hood 높이와 빛깔). 모양은 도트 수레와 같다 — 나무 짐칸, 보라·크림 반원통 포장, 열린 앞, 등불
  function pedCart(gg, E, G, C){
    g = gg;
    const q = (u, v, z) => E.P(u, v, z), T = c => E.night ? tone(c) : c, len = G.u1 - G.u0, cv = (G.v0 + G.v1) / 2, rv = (G.v1 - G.v0) / 2 + 0.04;
    const wood = T('#9a6a42'), woodDk = T('#6a4428'), woodLo = T('#4e3220');
    const P3 = pts => pts.map(p => q(p[0], p[1], p[2]));
    { const a = q(G.u0 - 0.05, G.v0, 0), b = q(G.u1 + 0.75, G.v0, 0), c = q(G.u1 + 0.75, G.v1 + 0.2, 0), d = q(G.u0 - 0.05, G.v1 + 0.2, 0); poly([a, b, c, d], 'rgba(10,16,40,.26)'); }
    const wheel = (v, a, rim) => {
      const zc = 11, pts = [], inn = [];
      for (let i = 0; i < 28; i++){ const an = i / 28 * TAU; pts.push(q(G.u0 + a + Math.cos(an) * 0.3, v, zc + Math.sin(an) * 11)); inn.push(q(G.u0 + a + Math.cos(an) * 0.22, v, zc + Math.sin(an) * 8)); }
      poly(pts, rim, 0.8); poly(inn, shade(rim, 0.18));
      g.strokeStyle = rim; g.lineWidth = 1; for (let i = 0; i < 4; i++){ const an = i / 4 * Math.PI, A = q(G.u0 + a + Math.cos(an) * 0.22, v, zc + Math.sin(an) * 8), B = q(G.u0 + a - Math.cos(an) * 0.22, v, zc - Math.sin(an) * 8); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
      const h = q(G.u0 + a, v, zc); oval(h[0], h[1], 1.8, 1.8, T('#4a4540'), 0.6); oval(h[0] - 0.4, h[1] - 0.4, 0.6, 0.6, '#d8d2c6');
    };
    const shaft = v => { const A = q(G.u1 - 0.1, v, C.bed + 2), B = q(G.u1 + 0.62, v, 5); g.strokeStyle = INK; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); g.strokeStyle = woodDk; g.lineWidth = 1.6; g.stroke(); };
    [0.32, len - 0.36].forEach(a => wheel(G.v0 - 0.04, a, shade(woodDk, -0.2)));
    shaft(G.v0 + 0.08);
    // 짐칸 — 앞면·오른쪽 면·윗면, 널 이음
    const L = P3([[G.u0, G.v1, C.bed], [G.u1, G.v1, C.bed], [G.u1, G.v1, C.top], [G.u0, G.v1, C.top]]), Rt = P3([[G.u1, G.v1, C.bed], [G.u1, G.v0, C.bed], [G.u1, G.v0, C.top], [G.u1, G.v1, C.top]]);
    poly(L, lin(0, L[2][1], 0, L[0][1], [shade(wood, 0.1), shade(wood, -0.1)]), 0.8); poly(Rt, shade(wood, -0.25), 0.8);
    g.strokeStyle = shade(wood, -0.3); g.lineWidth = 0.5; g.beginPath(); for (let z = C.bed + 2.7; z < C.top; z += 2.7){ const A = q(G.u0, G.v1, z), B = q(G.u1, G.v1, z); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); } g.stroke();
    [0.06, len / 2, len - 0.1].forEach(a => { poly(P3([[G.u0 + a, G.v1, C.bed], [G.u0 + a + 0.06, G.v1, C.bed], [G.u0 + a + 0.06, G.v1, C.top], [G.u0 + a, G.v1, C.top]]), T('#4a4038')); const m = q(G.u0 + a + 0.03, G.v1, C.top - 3); oval(m[0], m[1], 0.5, 0.5, '#e0dcd2'); });
    // 포장 — 뒤 띠부터, u 를 따라 크림·보라 줄. 꼭대기에 눈이 얹혔다
    const at = (u, th, dz) => q(u, cv + rv * Math.cos(th), C.top + (C.hood + (dz || 0)) * Math.sin(th));
    const N = 16, M = 6;
    for (let i = N - 1; i >= 0; i--){
      const a = i / N * Math.PI, b = (i + 1) / N * Math.PI, lit = Math.sin((a + b) / 2) * 0.16 - (i < 3 ? 0.12 : 0) - (i > N - 4 ? 0.1 : 0);
      for (let k = 0; k < M; k++){ const ua = G.u0 + len * k / M, ub = G.u0 + len * (k + 1) / M; poly([at(ua, a), at(ub, a), at(ub, b), at(ua, b)], shade(T(k % 2 ? C.purple : C.cream), lit)); }
    }
    { const pts = []; for (let i = 0; i <= 12; i++) pts.push(at(G.u0 + len * i / 12, 0.42 * Math.PI, 0.6)); for (let i = 12; i >= 0; i--) pts.push(at(G.u0 + len * i / 12, (0.78 + 0.03 * Math.sin(i * 1.7)) * Math.PI, 1.4)); poly(pts, E.night ? '#a3b7e0' : '#f6faff'); g.strokeStyle = 'rgba(60,80,130,.35)'; g.lineWidth = 0.5; g.stroke(); }
    { const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(G.u0, i / 16 * Math.PI)); for (let i = 16; i >= 0; i--) pts.push(at(G.u1, i / 16 * Math.PI)); path(pts); ink(0.8); }
    // 열린 앞 — 어두운 속에 항아리·단지·두루마리
    { const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(G.u1, i / 16 * Math.PI)); poly(pts, '#2a1d2c'); }
    const jar = (u, v, r, h, col) => { const b = q(u, v, C.top), t = q(u, v, C.top + h), w = r * 20; rrect(b[0] - w, t[1], w * 2, b[1] - t[1], w * 0.6, T(col), 0.6); oval(t[0], t[1], w, w * 0.45, shade(T(col), 0.25), 0.5); };
    jar(G.u1 - 0.12, cv - 0.12, 0.09, 9, '#c8643a'); jar(G.u1 - 0.12, cv + 0.14, 0.08, 6, '#4f8fd0');
    { const b = q(G.u1 - 0.14, cv, C.top), t = q(G.u1 - 0.14, cv, C.top + 13); rrect(b[0] - 1.6, t[1], 3.2, b[1] - t[1], 1, T('#d9a93a'), 0.6); }
    [G.u0 + 0.02, G.u1].forEach(u => { const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(u, i / 16 * Math.PI)); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = T(C.rim); g.lineWidth = 1.5; g.stroke(); });
    // 앞 테에 매단 등불
    { const h = q(G.u1 + 0.02, cv + 0.1, C.top + C.hood - 4), x = h[0], y = h[1];
      g.strokeStyle = '#3a2a1f'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 4); g.stroke();
      rrect(x - 2.6, y + 4, 5.2, 7, 1.6, E.night ? '#ffd27a' : '#ffcf5a', 0.7); oval(x, y + 7.5, 1.4, 2.2, '#fff4c0'); rrect(x - 3, y + 3.4, 6, 1.4, 0.6, '#3a2a1f'); rrect(x - 3, y + 10.6, 6, 1.4, 0.6, '#3a2a1f');
      E.lamp(x, y + 8, 22); }
    [0.32, len - 0.36].forEach(a => wheel(G.v1 + 0.04, a, woodDk));
    shaft(G.v1 - 0.08);
    { const A = q(G.u1 + 0.6, G.v0 + 0.08, 6), B = q(G.u1 + 0.6, G.v1 - 0.08, 6); g.strokeStyle = woodLo; g.lineWidth = 1.6; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    return true;
  }

  // ================= 비행선 장면(스테이지1 → 스테이지2) =================
  // 벚꽃 흩날리는 꽃구름 섬에서 비행선이 떠올라 → 구름 바다 위를 날고(저녁 → 밤, 별) → 오로라 아래 북쪽 눈 섬(통나무집 불빛)에 내려앉는다.
  // 화면 480×270 단위로 그리고 캔버스 폭에 맞춰 늘인다. 끝나면 마지막 장면에 멈춘다. 움직임 줄이기면 마지막 장면만.
  const SW = 480, SH = 270, DUR = 7000, LEN = 1100;
  const SKY0 = ['#6c6fb8', '#c98ac0', '#f4a6a8', '#ffd2a0'], SKY1 = ['#050a1e', '#0b1a3c', '#143e60', '#1d5a6e'];
  const camAt = p => LEN * (p < 0.14 ? 0 : p > 0.86 ? 1 : (k => k * k * (3 - 2 * k))((p - 0.14) / 0.72));
  const AUR = [{ c: '120,255,190', y: 70, a: 14, f: 0.016, s: 0.5, h: 70 }, { c: '90,220,255', y: 52, a: 10, f: 0.022, s: -0.4, h: 52 }, { c: '200,130,255', y: 36, a: 8, f: 0.012, s: 0.3, h: 40 }];
  const auroraMemo = {};
  function auroraStrip(c){ if (auroraMemo[c]) return auroraMemo[c]; const cv = document.createElement('canvas'); cv.width = 2; cv.height = 64; const x = cv.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(' + c + ',0)'); gr.addColorStop(0.6, 'rgba(' + c + ',.3)'); gr.addColorStop(0.92, 'rgba(' + c + ',.9)'); gr.addColorStop(1, 'rgba(' + c + ',0)'); x.fillStyle = gr; x.fillRect(0, 0, 2, 64); return (auroraMemo[c] = cv); }
  // 구름 둑 — 크기가 다른 둥근 뭉치를 겹쳐 잇고, 아래는 그늘 한 겹. par 는 흐르는 빠르기(가까울수록 크다)
  function cloudBank(y, amp, par, cam, col, hi, seed, t){
    const sh = cam * par + t * 6 * par, step = 64, k0 = Math.floor(sh / step), off = sh - k0 * step;
    const blobs = dy => { g.beginPath(); g.rect(-10, y + dy, SW + 20, SH - y + 10); for (let i = -1; i < SW / step + 2; i++){ const n = i + k0 + seed * 97, r = 24 + hash(n) * amp + 10, x = i * step - off + (hash(n * 3) - 0.5) * 20, yy = y + dy - hash(n * 5) * 8; g.moveTo(x + r, yy); g.arc(x, yy, r, 0, TAU); } };
    blobs(6); g.fillStyle = col; g.fill();
    blobs(0); g.fillStyle = lin(0, y - 40, 0, y + 30, [hi, col]); g.fill();
  }
  // 떠 있는 섬 — 윗면 타원 + 아래로 좁아지는 바위 층
  function isle(x, y, w, top, rock, seed){
    const d = w * 0.62;
    g.beginPath(); g.moveTo(x - w / 2, y);
    for (let i = 0; i <= 12; i++){ const f = i / 12, xx = x - w / 2 + w * f, dep = Math.sin(f * Math.PI) * d * (0.75 + 0.25 * hash(i * 3 + seed)); g.lineTo(xx, y + dep); }
    g.lineTo(x + w / 2, y); g.closePath();
    g.fillStyle = lin(0, y, 0, y + d, rock); g.fill(); ink(1);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 4; k++){ const yy = y + d * k * 0.18; g.moveTo(x - w * (0.5 - k * 0.08), yy); g.quadraticCurveTo(x, yy + 6, x + w * (0.5 - k * 0.08), yy); } g.stroke();
    oval(x, y, w / 2, w * 0.13, lin(0, y - w * 0.13, 0, y + w * 0.13, top), 1);
  }
  function cherry(x, y, s, t){
    g.strokeStyle = '#6a4434'; g.lineWidth = 3.4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 2 * s, y - 14 * s, x + 2 * s, y - 24 * s); g.moveTo(x, y - 12 * s); g.lineTo(x + 8 * s, y - 20 * s); g.stroke();
    [[-10, -30, 11], [8, -32, 12], [0, -40, 12], [-4, -26, 9], [12, -24, 8]].forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s + 1, b[2] * s + 1, INK));
    [[-10, -30, 11], [8, -32, 12], [0, -40, 12], [-4, -26, 9], [12, -24, 8]].forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s, '#f4a6c4'));
    [[-12, -33, 7], [6, -35, 7], [-2, -43, 7]].forEach(b => oval(x + b[0] * s, y + b[1] * s, b[2] * s, b[2] * s * 0.8, '#ffd0e2'));
  }
  function fir(x, y, s, night){
    const c = night ? ['#1f4a4a', '#0f2a2e'] : ['#2f6b5c', '#174238'], sn = night ? '#c4d4f2' : '#ffffff';
    g.fillStyle = '#4e3428'; g.fillRect(x - 1.6 * s, y - 6 * s, 3.2 * s, 6 * s);
    for (let i = 0; i < 3; i++){ const yb = y - 5 * s - i * 9 * s, w = (13 - i * 3) * s, yt = yb - 15 * s; poly([[x, yt], [x + w, yb], [x - w, yb]], c[0], 0.9); poly([[x, yt], [x + w, yb], [x + w * 0.2, yb]], c[1]); poly([[x, yt + 0.5], [x + w * 0.5, yt + 8 * s], [x, yt + 6.5 * s], [x - w * 0.5, yt + 8 * s]], sn); }
  }
  function cabin(x, y, night, t){
    const wall = night ? '#7a5848' : '#a0704e';
    rrect(x - 26, y - 26, 52, 26, 1, lin(0, y - 26, 0, y, [shade(wall, 0.08), shade(wall, -0.15)]), 1);
    g.strokeStyle = shade(wall, -0.35); g.lineWidth = 0.8; g.beginPath(); for (let yy = y - 21; yy < y; yy += 5){ g.moveTo(x - 26, yy); g.lineTo(x + 26, yy); } g.stroke();
    rrect(x + 14, y - 44, 7, 14, 1, '#6e6a72', 0.9);
    poly([[x - 32, y - 24], [x, y - 48], [x + 32, y - 24]], night ? '#5a3a40' : '#a0464a', 1);
    g.fillStyle = night ? '#c4d4f2' : '#ffffff'; g.beginPath(); g.moveTo(x - 33, y - 23); g.lineTo(x, y - 50); g.lineTo(x + 33, y - 23); g.quadraticCurveTo(x + 20, y - 30, x + 12, y - 28); g.quadraticCurveTo(x, y - 36, x - 14, y - 28); g.quadraticCurveTo(x - 24, y - 30, x - 33, y - 23); g.fill(); ink(0.7);
    rrect(x - 5, y - 16, 10, 16, 1.5, '#5a3a2a', 0.9);
    [-17, 11].forEach(wx => { if (night) glow(x + wx + 3, y - 12, 18, 'rgba(255,207,122,', 0.5); rrect(x + wx, y - 17, 7, 8, 1, night ? '#ffd98a' : '#6f9ec4', 0.8); g.strokeStyle = '#f2ece0'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + wx + 3.5, y - 17); g.lineTo(x + wx + 3.5, y - 9); g.moveTo(x + wx, y - 13); g.lineTo(x + wx + 7, y - 13); g.stroke(); });
    for (let i = 0; i < 4; i++){ const k = ((t * 0.25 + i / 4) % 1), sx = x + 17.5 + Math.sin(k * 6 + i) * 3 + k * 8, sy = y - 46 - k * 26; oval(sx, sy, 3 + k * 5, 2.6 + k * 4, 'rgba(220,230,250,' + (0.45 * (1 - k)).toFixed(2) + ')'); }
  }
  // 비행선 — (x, y) 는 곤돌라 바닥 가운데. 아이·동물·짐은 곤돌라 테 위로 고개만 내민다
  function ship(x, y, tilt, t, night, flying){
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(0.78, 0.78);
    const ey = -66;
    // 밧줄
    g.strokeStyle = '#6a5040'; g.lineWidth = 1; g.beginPath(); [[-34, -20, -44, ey + 22], [34, -20, 44, ey + 22], [-12, -20, -16, ey + 29], [12, -20, 16, ey + 29]].forEach(r => { g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); }); g.stroke();
    // 풍선 몸통 — 크림·분홍 세로 줄, 꼬리 날개
    poly([[-70, ey - 4], [-92, ey - 26], [-84, ey], [-92, ey + 24], [-70, ey + 6]], '#e87a8a', 1.1);
    g.save(); g.beginPath(); g.ellipse(0, ey, 80, 31, 0, 0, TAU); g.clip();
    for (let i = -5; i < 5; i++){ g.fillStyle = i % 2 ? '#fff4ea' : '#f7a8b8'; g.fillRect(i * 17, ey - 32, 17, 64); }
    g.fillStyle = lin(0, ey - 31, 0, ey + 31, ['rgba(255,255,255,.35)', 'rgba(255,255,255,0)', 'rgba(60,30,80,.28)']); g.fillRect(-81, ey - 32, 162, 64);
    oval(-22, ey - 16, 30, 7, 'rgba(255,255,255,.4)');
    g.restore();
    oval(0, ey, 80, 31, null, 1.2);
    rrect(-76, ey - 2, 152, 4, 2, '#d9a93a', 0.8);
    // 하트 문장
    g.fillStyle = '#e8506a'; g.beginPath(); g.moveTo(40, ey + 14); g.bezierCurveTo(28, ey + 4, 32, ey - 10, 40, ey - 3); g.bezierCurveTo(48, ey - 10, 52, ey + 4, 40, ey + 14); g.fill(); ink(0.8);
    // 프로펠러(뒤)
    const sp = flying ? t * 22 : 0;
    rrect(-50, -14, 8, 4, 1.5, '#6a6a72', 0.7);
    [0, Math.PI].forEach(a => { const ry = Math.cos(sp + a) * 9; oval(-52, -12 + ry / 2, 2, Math.abs(ry / 2) + 0.6, '#d8d2c6', 0.6); });
    // 곤돌라 안 — 짐(뒤)·동물·아이
    rrect(-42, -32, 14, 14, 2, '#c08850', 0.9); rrect(-40, -40, 12, 9, 2, '#6aa0d0', 0.9); g.strokeStyle = '#7a5236'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-42, -26); g.lineTo(-28, -26); g.stroke();
    oval(-24, -24, 7, 6.5, '#fbf7f0', 0.9); [-28, -24, -20].forEach(bx => oval(bx, -30, 3, 3, '#ffffff', 0.6)); oval(-22.6, -23, 3.4, 4, '#3a3036'); oval(-21.4, -24, 0.7, 0.7, '#fff');   // 양
    oval(31, -23, 5.6, 5.4, '#ffd84a', 0.9); poly([[36, -24], [39.5, -23], [36, -21.5]], '#f08a3a', 0.5); oval(33, -25, 0.8, 0.9, '#2b2622'); g.fillStyle = '#ffd84a'; g.beginPath(); g.ellipse(30, -29.5, 1, 2, -0.3, 0, TAU); g.fill();   // 병아리
    const kd = window.FARMHD && window.FARMHD.kid, a = kd && kd(g, 'yona', -7, -6, 'SE', 0, 40), b = kd && kd(g, 'sua', 13, -6, 'SE', 0, 44);
    // 곤돌라 — 나무배
    g.beginPath(); g.moveTo(-46, -20); g.lineTo(46, -20); g.quadraticCurveTo(44, -2, 32, 0); g.lineTo(-32, 0); g.quadraticCurveTo(-44, -2, -46, -20); g.closePath();
    g.fillStyle = lin(0, -20, 0, 0, ['#b47a4a', '#7a4a2a']); g.fill(); ink(1.1);
    g.strokeStyle = 'rgba(60,30,10,.45)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-44, -13); g.lineTo(44, -13); g.moveTo(-38, -6); g.lineTo(38, -6); g.stroke();
    rrect(-48, -22.5, 96, 4, 2, '#d9a93a', 0.9);
    // 매단 등불
    if (night) glow(46, -12, 26, 'rgba(255,207,122,', 0.55);
    rrect(43, -16, 6, 8, 2, night ? '#ffd27a' : '#ffcf5a', 0.7);
    g.restore();
    return a && b;
  }
  function airshipFrame(cx, p, t, opts){
    g = cx;
    const night = smooth(0.2, 0.75, p), cam = camAt(p), isNight = night > 0.5;
    // 하늘
    const sky = SKY0.map((c, i) => mix(c, SKY1[i], night));
    g.fillStyle = lin(0, 0, 0, SH, sky); g.fillRect(0, 0, SW, SH);
    if (night < 0.9){ g.globalAlpha = 1 - night; glow(SW * 0.18 - cam * 0.05, 175, 90, 'rgba(255,220,170,', 0.8); oval(SW * 0.18 - cam * 0.05, 170, 16, 16, '#fff2d8'); g.globalAlpha = 1; }
    const sa = smooth(0.32, 0.7, p);
    if (sa > 0) for (let i = 0; i < 90; i++){ const x = ((hash(i * 7 + 1) * SW * 1.4 - cam * 0.04) % SW + SW) % SW, y = hash(i * 11 + 3) * 150, k = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + hash(i) * 1.4) + i)), r = hash(i * 5) < 0.12 ? 1.1 : 0.6; g.fillStyle = 'rgba(235,245,255,' + (sa * k).toFixed(2) + ')'; g.fillRect(x, y, r, r); }
    if (sa > 0){ g.globalAlpha = sa; glow(SW * 0.84, 40, 34, 'rgba(210,230,255,', 0.35); oval(SW * 0.84, 40, 8, 8, '#eef3ff'); oval(SW * 0.84 + 3, 38.4, 7, 7.4, sky[0]); g.globalAlpha = 1; }
    const aa = smooth(0.5, 0.86, p);
    if (aa > 0){
      g.save(); g.globalCompositeOperation = 'lighter';
      AUR.forEach(r => { const im = auroraStrip(r.c); for (let x = 0; x < SW; x += 2){ const k = 0.5 + 0.5 * Math.sin(x * 0.02 + t * 0.7 + r.f * 100) * Math.sin(x * 0.007 - t * 0.25); if (k < 0.1) continue; const base = r.y + r.a * Math.sin(x * r.f + t * r.s) + r.a * 0.4 * Math.sin(x * r.f * 2.6 - t * r.s * 1.6), h = r.h * (0.7 + 0.5 * k); g.globalAlpha = aa * k; g.drawImage(im, x, base - h, 2.2, h); } });
      g.restore();
    }
    // 먼 눈 산(끝 무렵 다가온다)
    const ma = smooth(0.6, 0.85, p);
    if (ma > 0){ g.globalAlpha = ma; g.fillStyle = isNight ? '#1b2c52' : '#a6bfd8'; g.beginPath(); g.moveTo(0, 190); for (let x = 0; x <= SW; x += 4){ const X = x + cam * 0.2; g.lineTo(x, 175 - 40 * Math.pow(1 - Math.abs(Math.sin(X * 0.012 + 1.3)), 1.6) - 14 * Math.pow(1 - Math.abs(Math.sin(X * 0.03)), 2)); } g.lineTo(SW, 190); g.closePath(); g.fill(); g.globalAlpha = 1; }
    // 먼 구름 바다
    const cloudC = mix('#fbe0ec', '#41557e', night), cloudH = mix('#ffffff', '#8aa0c8', night);
    cloudBank(198, 10, 0.3, cam, mix(cloudC, sky[3], 0.3), cloudH, 3, t);
    // 섬 둘
    const ia = Math.max(0, 1 - smooth(0.3, 0.42, p));
    const x0 = 200 - cam, x1 = LEN + 285 - cam;
    if (x0 > -200){
      isle(x0, 186, 300, ['#c9ef9a', '#8fcf6a'], ['#b08a6a', '#6a4a3a'], 1);
      for (let i = 0; i < 26; i++){ const a = hash(i * 13 + 5) * TAU, r = Math.sqrt(hash(i * 7 + 2)); oval(x0 + Math.cos(a) * r * 135, 186 + Math.sin(a) * r * 34, 2.2, 1.2, i % 3 ? '#ffc4dc' : '#ffffff'); }   // 떨어진 꽃잎
      cherry(x0 - 105, 186, 1.05, t); cherry(x0 + 112, 192, 1.15, t); cherry(x0 - 70, 198, 0.8, t);
      g.fillStyle = '#d9504a'; g.fillRect(x0 + 70, 168, 3, 22); g.fillRect(x0 + 90, 168, 3, 22); rrect(x0 + 65, 165, 33, 4, 1.5, '#d9504a', 0.8); g.fillRect(x0 + 68, 172, 27, 2.4);   // 작은 도리이
    }
    if (x1 < SW + 200){
      isle(x1, 188, 320, isNight ? ['#c4d4f2', '#8197c6'] : ['#ffffff', '#dbe7f4'], ['#3a4766', '#181e34'], 5);
      fir(x1 - 150, 186, 1.2, isNight); fir(x1 - 136, 198, 0.9, isNight); fir(x1 + 108, 184, 1.3, isNight); fir(x1 + 128, 196, 0.95, isNight); fir(x1 + 92, 200, 0.75, isNight);
      cabin(x1 - 98, 186, isNight, t);
    }
    // 비행선
    const lift = p < 0.04 ? 0 : p < 0.2 ? (k => k * k * (3 - 2 * k))((p - 0.04) / 0.16) : p < 0.74 ? 1 : 1 - (k => k * k * (3 - 2 * k))(clamp01((p - 0.74) / 0.18));
    const sx = 200 + 100 * smooth(0.7, 0.92, p), ground = lerp(188, 192, smooth(0.5, 0.8, p));
    const sy = lerp(ground, 124, lift) + (lift > 0.5 && !STILL ? Math.sin(t * 2) * 3 * lift : 0);
    const tilt = p < 0.2 && p > 0.04 ? -0.05 * Math.sin((p - 0.04) / 0.16 * Math.PI) : p > 0.74 && p < 0.92 ? 0.05 * Math.sin((p - 0.74) / 0.18 * Math.PI) : 0;
    const kidsOk = ship(sx, sy, tilt, t, isNight, p > 0.03 && p < 0.93);
    // 앞 구름 바다
    cloudBank(256, 8, 1.25, cam, mix('#f6d6e4', '#2c3d66', night), mix('#ffffff', '#6e86b4', night), 9, t);
    // 벚꽃잎(떠날 때) · 눈송이(닿을 때)
    if (ia > 0) for (let i = 0; i < 36; i++){ const k = (t * (0.12 + hash(i) * 0.1) + hash(i * 3)) % 1, x = ((hash(i * 7) * SW * 1.3 - k * 160 - cam * 0.6) % (SW + 40) + SW + 40) % (SW + 40) - 20, y = k * SH; g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.globalAlpha = ia * 0.9; oval(0, 0, 2.6, 1.5, i % 3 ? '#ffc4dc' : '#ffffff'); g.restore(); }
    const fa = smooth(0.7, 0.9, p);
    if (fa > 0){ g.fillStyle = 'rgba(255,255,255,' + (0.8 * fa).toFixed(2) + ')'; for (let i = 0; i < 50; i++){ const x = ((hash(i * 3 + 1) * SW + Math.sin(t * 0.7 + i) * 8) % SW + SW) % SW, y = ((hash(i * 7 + 2) * SH + t * 14 * (0.4 + hash(i * 11))) % SH + SH) % SH; g.beginPath(); g.arc(x, y, 0.5 + hash(i * 11) * 0.9, 0, TAU); g.fill(); } }
    // 큰 제목
    const ta = smooth(0.84, 0.94, p);
    if (ta > 0){
      const sc = 0.6 + 0.4 * (1 - Math.pow(1 - ta, 3)) + (ta < 1 ? Math.sin(ta * Math.PI) * 0.08 : 0), fam = getComputedStyle(document.body).fontFamily;
      g.save(); g.globalAlpha = ta; g.translate(SW / 2, 52); g.scale(sc, sc); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = '900 44px ' + fam; g.lineWidth = 9; g.strokeStyle = '#0b1430'; g.strokeText(opts.title, 0, 0);
      g.fillStyle = lin(-140, -20, 140, 20, ['#7dffc4', '#8ee0ff', '#d7a8ff']); g.fillText(opts.title, 0, 0);
      g.font = '800 17px ' + fam; g.lineWidth = 5; g.strokeText(opts.sub, 0, 34); g.fillStyle = '#ffffff'; g.fillText(opts.sub, 0, 34);
      g.restore();
    }
    return kidsOk;
  }
  // cv 에 장면을 건다. 다 날면 onDone(). 돌려주는 stop() 으로 멈춘다
  function airship(cv, opts){
    opts = Object.assign({ title: '스테이지2 시작!', sub: '🌌 오로라 농장' }, opts);
    const t0 = performance.now(); let dead = false, done = false, tries = 0;
    const frame = () => {
      if (dead || !cv.isConnected) return;
      const DPR = Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, cv.clientWidth), W2 = Math.round(w * DPR), H2 = Math.round(w * DPR * SH / SW);
      if (cv.width !== W2 || cv.height !== H2){ cv.width = W2; cv.height = H2; }
      const c = cv.getContext('2d'), el = performance.now() - t0, p = opts.at != null ? opts.at : STILL ? 1 : Math.min(1, el / DUR);   // at: 시험용 멈춘 자리
      c.setTransform(W2 / SW, 0, 0, H2 / SH, 0, 0); c.imageSmoothingEnabled = true;
      const ok = airshipFrame(c, p, STILL ? 3 : (p < 1 ? el : DUR) / 1000, opts);
      if (p >= 1 && !done){ done = true; if (opts.onDone) opts.onDone(); }
      if (p < 1 || (!ok && tries++ < 60)) requestAnimationFrame(frame);       // 끝난 뒤에도 아이 그림이 늦게 오면 올 때까지 다시 그린다
    };
    frame();
    return { stop: () => { dead = true; } };
  }
  // 이삿날 창 안의 그림 자리 — farm-play.js 의 openArrival 과 아래 시험 주소가 같이 쓴다
  const AIRSHIP_CV = '<canvas id="arriveCv" class="arrive" style="image-rendering:auto;aspect-ratio:16/9;max-width:560px" aria-label="비행선이 구름 바다를 건너 오로라 농장에 내려앉는 그림"></canvas>';

  // ---------- 로그인 없이 보기: farm.html?airship=1 ----------
  if (/[?&]airship=1\b/.test(location.search)) window.addEventListener('load', () => setTimeout(() => {
    const md = document.getElementById('modal'), inner = document.getElementById('modalInner'); if (!md || !inner) return;
    inner.innerHTML = '<h3 class="pixel">✈️ 스테이지2 — 오로라 농장으로!</h3>'
      + '<p class="sub">꽃구름 농장을 떠나 비행선을 타고 구름 바다를 건너 <b>오로라 농장</b>에 내려앉았어요. 여기서부터 <b>스테이지2</b>예요!</p>' + AIRSHIP_CV
      + '<div class="modal-actions"><button type="button" class="dot-btn small" id="airAgain">🔁 다시 보기</button><button type="button" class="dot-btn small primary" id="airClose">닫기</button></div>';
    md.hidden = false;
    let run = airship(document.getElementById('arriveCv'));
    document.getElementById('airAgain').addEventListener('click', () => { run.stop(); run = airship(document.getElementById('arriveCv')); });
    document.getElementById('airClose').addEventListener('click', () => { run.stop(); md.hidden = true; });
  }, 400));

  window.FARMHD = Object.assign(window.FARMHD || {}, { npc, facing, doll, pedCart, airship, AIRSHIP_CV });
})();
