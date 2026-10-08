// pages/room-hd.js — 스테이지2(오로라~) 집 안 고화소 그림: 방 껍데기(통나무 벽·나무 마루·창·문)와 가구 앞 절반(kind 알파벳 amphora~mirror).
// farm.js 는 방이 HD_FARMS 농장이면(roomHd()) drawRoomShell·paintFurniture·paintWallItem 대신 여기를 부른다. 그리개가 없는 kind 는 옛 도트 그림 그대로.
//
// ================= 가구 그리개 약속(API) — room-hd-furn.js 도 이대로 등록한다 =================
// ■ 바닥 가구  ROOMHD.furn[kind] = function(g, C){ ... }
//   g: 방 배수(HS)만큼 이미 키운 2D 컨텍스트 — 「도트」 단위로 그린다(소수 좌표 OK, 경로·그러데이션으로 부드럽게).
//   C = { f, F, kind, c(F.c), rot(0~3), E, D, H, P(ax, ay, up) → [x, y], CX, CY, t(ms), lit, night, phase(0 낮·1 노을·2 저녁·3 밤),
//         tone(col), shade(col, k -1~1), mix(a, b, k), INK, LW, K(=ROOMHD.kit), room('sua'|'yona'|'living'), seg(s0, s1, t0, t1) }
//     E·D: 발자국 가로(ax — 화면 오른쪽아래)·세로(ay — 왼쪽아래) 도트. 한 칸 = 24. H: 솟는 높이(farm.js FURN_H).
//     P(ax, ay, up): 발자국 뒤 꼭짓점이 (0, 0). 보이는 옆면은 ay = D 쪽(왼쪽 앞 — 밝다)과 ax = E 쪽(오른쪽 앞 — 어둡다). 빛은 왼쪽 앞에서.
//     CX·CY: 발자국 한가운데 바닥. 그릴 틀은 가로 0..E+D+2, 세로 0..H+(E+D)/2+2 — 밖은 잘린다.
//     rot: 그림은 rot % 2 로만 구워 둔다(0·2 같은 그림, 1·3 같은 그림). 2×1 가구는 rot 홀수면 E=24, D=48 — seg(긴 축 s0..s1, 짧은 축 t0..t1) 이
//       [ax0, ay0, ax1, ay1] 을 돌려주니 긴 쪽을 따라 그릴 때 쓴다.
//   lit=true 면 밤에 빛나는 부분(불·전구·화면)만 그린다 — farm.js ROOM_LIGHT 에 있는 kind 만 이렇게 한 번 더 불린다.
//   밤 누르기: 그리개는 늘 낮 빛깔로 그린다. 다 그린 뒤 ROOMHD 가 source-atop 으로 쪽빛을 한 번에 얹는다(lit 그림엔 안 얹음). C.tone 은 같은 누르기를 미리 셈한 빛깔.
//   발밑 그림자·테두리는 그리개가 직접(K.shadow, INK). 도트 테두리·마무리 그늘은 고화소 가구엔 안 얹는다.
//   그림은 f·rot%2·HS·밤 단계별로 한 번 구워 둔다 — 매 장 다시 그리는 것은 farm.js FURN_ANIM(fire·stove)뿐(C.t 로 움직인다).
//   누르기·끌기는 칸으로 고르므로 그림 모양과 상관없다.
// ■ 벽에 거는 것  ROOMHD.wall[kind] = function(g, C){ ... }
//   (WALL_KINDS: frame poster clock mirror window stars mypic board garland wshelf rainbow heightbar worldmap mobile wreath whale wlight medalcase blueplate cuckoo scroll advent)
//   g 는 벽 한 칸에 맞춘 평평한 좌표계(ROOMHD 가 따로 그린 뒤 벽 기울기대로 붙인다): x = 0..40 (보는 사람 기준 왼→오른쪽), y = 0..58 (벽 꼭대기에서 아래로).
//     아래 단(row 1)이면 이미 12 내려 있다. 벽 높이는 104, 위 몰딩 0..6 — 거는 것은 대략 y 3..58 안에. 사방 6 까지는 넘쳐도 안 잘린다.
//     오른쪽 벽·왼쪽 벽 모두 같은 그림이 그대로 붙는다(좌우가 뒤집히지 않는다). 벽에 뜬 그림자는 ROOMHD 가 깐다.
//   C = { f, F, kind, c, side(1 오른쪽 벽·0 왼쪽 벽), room, t, lit, night, phase, tone, shade, mix, INK, LW, K,
//         pic, cells(mypic 그림 칸 배열 — cells.n = 한 변 16·24·32, 값은 PAD 번호, -1 은 빈칸), PAD(빛깔표), PAD_BG, medals(받은 훈장 id), MEDALS(R.MEDALS — {id, col}) }
//   lit=true(stars·wlight·mobile 처럼 ROOM_LIGHT 에 wall:true 인 것만): 빛나는 부분만.
// ■ ROOMHD.kit(=C.K) — 둘이 같이 쓰는 붓. 2D 붓(oval·poly·rr·lin·rad·glow·line·lathe)은 첫 인자가 g, 아이소 붓(box·top·quad·cyl·shadow·face)은 (g, C, …).
//   K.face(g, C, 'L'|'R', ax, ay, ztop) 는 상자 옆면을 평평한 (s, y) 좌표로 바꿔 둔다(그 뒤 g.restore() 꼭). K.lathe 는 항아리·화분 같은 돌림판 모양.
(function(){
  'use strict';
  const TAU = Math.PI * 2;
  const INK = 'rgba(40,26,20,.62)', LW = 0.6;
  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const hs = s => { let h = 7; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h; };
  const rgb = c => { const v = parseInt(c.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  function mix(a, b, k){ const A = rgb(a), B = rgb(b); return '#' + A.map((x, i) => Math.max(0, Math.min(255, Math.round(x + (B[i] - x) * k))).toString(16).padStart(2, '0')).join(''); }
  const shade = (c, k) => (typeof c !== 'string' || c[0] !== '#') ? c : k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k);
  // 밤 단계 — farm.js 방 바탕 sig 와 같은 문턱(0.08·0.2·0.42). 누르기는 쪽빛(#14204a)을 이만큼 얹는다
  const phase = dark => dark > 0.42 ? 3 : dark > 0.2 ? 2 : dark > 0.08 ? 1 : 0;
  const NIGHT = '#14204a', TONE = [0, 0.05, 0.16, 0.3];
  const toneOf = ph => c => (TONE[ph] && typeof c === 'string' && c[0] === '#') ? mix(c, NIGHT, TONE[ph]) : c;
  function toneOver(g, ph){
    if (!TONE[ph]) return;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(20,32,74,' + TONE[ph] + ')'; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
  }

  // ---------- 붓 ----------
  const K = {
    hash, mix, shade,
    oval(g, x, y, rx, ry, c, ink){ g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); if (c){ g.fillStyle = c; g.fill(); } if (ink){ g.strokeStyle = INK; g.lineWidth = ink === true ? LW : ink; g.stroke(); } },
    path(g, pts){ g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); },
    poly(g, pts, c, ink){ K.path(g, pts); if (c){ g.fillStyle = c; g.fill(); } if (ink){ g.strokeStyle = INK; g.lineWidth = ink === true ? LW : ink; g.lineJoin = 'round'; g.stroke(); } },
    rr(g, x, y, w, h, r, c, ink){
      r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      if (c){ g.fillStyle = c; g.fill(); } if (ink){ g.strokeStyle = INK; g.lineWidth = ink === true ? LW : ink; g.stroke(); }
    },
    lin(g, x0, y0, x1, y1, cols){ const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; },
    rad(g, x, y, r, cols){ const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r)); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; },
    // 빛 번짐 — rgbs 는 'rgba(255,200,120,' 처럼 열린 꼴
    glow(g, x, y, r, rgbs, a){ g.fillStyle = K.rad(g, x, y, r, [rgbs + a + ')', rgbs + '0)']); g.fillRect(x - r, y - r, r * 2, r * 2); },
    line(g, a, b, c, w){ g.strokeStyle = c; g.lineWidth = w || LW; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); },
    // 아이소 — 점은 [ax, ay, up]
    quad(g, C, pts, c, ink){ K.poly(g, pts.map(p => C.P(p[0], p[1], p[2])), c, ink); },
    top(g, C, ax0, ay0, ax1, ay1, z, c, ink){ K.quad(g, C, [[ax0, ay0, z], [ax1, ay0, z], [ax1, ay1, z], [ax0, ay1, z]], c, ink); },
    // 상자 — 왼쪽 앞면(ay1)은 밝게, 오른쪽 앞면(ax1)은 어둡게, 윗면은 가장 밝게. o = { top, left, right(빛깔·그러데이션), noTop, ink:false }
    box(g, C, ax0, ay0, ax1, ay1, z0, z1, col, o){
      o = o || {};
      const Lf = [[ax0, ay1, z0], [ax1, ay1, z0], [ax1, ay1, z1], [ax0, ay1, z1]], Rt = [[ax1, ay1, z0], [ax1, ay0, z0], [ax1, ay0, z1], [ax1, ay1, z1]];
      const a = C.P(ax0, ay1, z1), b = C.P(ax0, ay1, z0), c = C.P(ax1, ay0, z1), d = C.P(ax1, ay0, z0);
      K.quad(g, C, Lf, o.left || K.lin(g, 0, a[1], 0, b[1], [shade(col, 0.1), shade(col, -0.08)]));
      K.quad(g, C, Rt, o.right || K.lin(g, 0, c[1], 0, d[1], [shade(col, -0.16), shade(col, -0.3)]));
      if (!o.noTop) K.top(g, C, ax0, ay0, ax1, ay1, z1, o.top || shade(col, 0.18));
      if (o.ink !== false){ K.quad(g, C, Lf, null, true); K.quad(g, C, Rt, null, true); if (!o.noTop) K.top(g, C, ax0, ay0, ax1, ay1, z1, null, true); }
    },
    // 세운 원기둥 — (ax, ay) 바닥 가운데, 반지름 r(도트)
    cyl(g, C, ax, ay, r, z0, z1, col, o){
      o = o || {};
      const b = C.P(ax, ay, z0), t = C.P(ax, ay, z1), ry = r * 0.5;
      g.beginPath(); g.ellipse(b[0], b[1], r, ry, 0, 0, Math.PI); g.lineTo(t[0] - r, t[1]); g.ellipse(t[0], t[1], r, ry, 0, Math.PI, 0, true); g.closePath();
      g.fillStyle = o.side || K.lin(g, t[0] - r, 0, t[0] + r, 0, [shade(col, 0.05), shade(col, 0.22), shade(col, -0.05), shade(col, -0.3)]); g.fill();
      if (o.ink !== false){ g.strokeStyle = INK; g.lineWidth = LW; g.stroke(); }
      if (o.noTop) return;
      K.oval(g, t[0], t[1], r, ry, o.top || shade(col, 0.2), o.ink !== false);
    },
    // 돌림판 그릇(항아리·화분·꽃병) — (x, y) 바닥 가운데, 높이 h, hw(d) = 바닥에서 d 만큼 위의 반폭. fill 없으면 좌우 그러데이션
    lathe(g, x, y, h, hw, col, fill, ink){
      g.beginPath();
      for (let d = 0; d <= h; d += 0.5) g.lineTo(x - hw(d), y - d);
      for (let d = h; d >= 0; d -= 0.5) g.lineTo(x + hw(d), y - d);
      g.closePath(); const w = hw(h * 0.4) + 1;
      g.fillStyle = fill || K.lin(g, x - w, 0, x + w, 0, [shade(col, -0.3), shade(col, 0.18), col, shade(col, -0.38)]); g.fill();
      if (ink !== false){ g.strokeStyle = INK; g.lineWidth = LW; g.stroke(); }
    },
    // 상자 옆면에 평평하게 그리기 — 그 면을 (s, y) 좌표로(y 는 아래로). side 'L' = ay 일정한 면(s 가 ax 를 따라), 'R' = ax 일정한 면(s 가 ay 를 줄이며 — 보는 사람 왼→오른쪽)
    //   (ax, ay, ztop) 이 그 면 왼쪽 위. 쓰고 나면 g.restore()
    face(g, C, side, ax, ay, ztop){ const o = C.P(ax, ay, ztop); g.save(); g.transform(1, side === 'L' ? 0.5 : -0.5, 0, 1, o[0], o[1]); },
    // 발밑 그림자 — 발자국보다 조금 작은 부드러운 마름모꼴 얼룩
    shadow(g, C, k, a){
      k = k == null ? 0.92 : k; const rx = (C.E + C.D) / 2 * k, ry = (C.E + C.D) / 4 * k;
      g.save(); g.translate(C.CX + 1, C.CY + 0.8); g.scale(1, ry / rx);
      g.fillStyle = K.rad(g, 0, 0, rx, ['rgba(40,22,12,' + (a || 0.34) + ')', 'rgba(40,22,12,' + ((a || 0.34) * 0.6) + ')', 'rgba(40,22,12,0)']);
      g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
    },
  };

  const furn = {}, wall = {};

  // ---------- 바닥 가구 붙이기(farm.js paintFurniture 가 부른다) ----------
  // o = { f, F, rot, A(furnArt), t, lit, HS, dark, room }
  function floorItem(g, o){
    const fn = furn[o.F.kind]; if (!fn) return false;
    const A = o.A, OX = A.EH + 1, OY = A.H + 1, E = A.EW, D = A.EH, ph = phase(o.dark || 0);
    const C = { f: o.f, F: o.F, kind: o.F.kind, c: o.F.c, rot: o.rot || 0, E, D, H: A.H, CX: OX + (E - D) / 2, CY: OY + (E + D) / 4,
      P: (ax, ay, up) => [OX + ax - ay, OY + (ax + ay) / 2 - (up || 0)], t: o.t || 0, lit: !!o.lit, night: ph >= 3, phase: ph, room: o.room,
      tone: toneOf(ph), shade, mix, INK, LW, K, seg: (s0, s1, t0, t1) => E >= D ? [s0, t0, s1, t1] : [t0, s0, t1, s1] };
    g.save(); g.scale(o.HS, o.HS); g.lineJoin = 'round'; g.lineCap = 'round';
    try { fn(g, C); } finally { g.restore(); }
    if (!o.lit) toneOver(g, ph);
    return true;
  }

  // ---------- 벽에 거는 것 붙이기 ----------
  // o = { HS, ox, side, u(벽 칸 왼끝 — 구석에서 벽을 따라 간 도트), dv, mode('draw'|'lit'|'cut'), f, F, room, pic, cells, PAD, PAD_BG, medals, MEDALS, dark, t }
  const PADX = 6, WB = 40 + PADX * 2, HB = 64 + PADX * 2;
  let wbuf = null;
  function wallItem(g, o){
    const fn = wall[o.F.kind]; if (!fn) return false;
    const k = o.HS, ph = phase(o.dark || 0);
    if (!wbuf) wbuf = document.createElement('canvas');
    const bw = Math.ceil(WB * k), bh = Math.ceil(HB * k);
    if (wbuf.width !== bw || wbuf.height !== bh){ wbuf.width = bw; wbuf.height = bh; }
    const tx = wbuf.getContext('2d');
    const C = lit => ({ f: o.f, F: o.F, kind: o.F.kind, c: o.F.c, side: o.side, room: o.room, t: o.t || 0, lit, night: ph >= 3, phase: ph, tone: toneOf(ph), shade, mix, INK, LW, K,
      pic: o.pic, cells: o.cells, PAD: o.PAD, PAD_BG: o.PAD_BG, medals: o.medals || [], MEDALS: o.MEDALS || [] });
    const render = lit => {
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, bw, bh);
      tx.save(); tx.scale(k, k); tx.translate(PADX, PADX); tx.lineJoin = 'round'; tx.lineCap = 'round';
      try { fn(tx, C(lit)); } finally { tx.restore(); }
      if (!lit) toneOver(tx, ph);
    };
    g.save(); g.imageSmoothingEnabled = true;
    // 벽 기울기 — 오른쪽 벽은 x 가 늘면 반 도트씩 내려가고, 왼쪽 벽은 구석(오른쪽)으로 갈수록 올라간다
    if (o.side) g.transform(k, k / 2, 0, k, (o.ox + o.u) * k, (o.u / 2 + o.dv) * k);
    else g.transform(k, -k / 2, 0, k, (o.ox - o.u - 40) * k, ((o.u + 40) / 2 + o.dv) * k);
    const put = () => g.drawImage(wbuf, -PADX, -PADX, WB, HB);
    render(false);
    if (o.mode === 'draw' || !o.mode){ g.shadowColor = 'rgba(30,16,8,.32)'; g.shadowBlur = 2.2 * k; g.shadowOffsetX = 1.4 * k; g.shadowOffsetY = 2 * k; put(); }
    else {
      g.globalCompositeOperation = 'destination-out'; put();
      if (o.mode === 'lit'){ g.globalCompositeOperation = 'source-over'; render(true); put(); }
    }
    g.restore();
    return true;
  }

  // ================= 방 껍데기 =================
  // 방마다 빛깔 — farm.js roomPal 과 같은 짜임(벽·널판·무늬·커튼·마루). 수아 분홍·연아 민트·거실 팔루 빨강
  const PAL = {
    sua:    { log: '#d29a66', paint: '#e397a8', paint2: '#ffd9e2', motif: 'tulip', cur: '#f28aa8', cur2: '#ffffff', curPat: 'dot',
              floor: ['#d7a46e', '#cb9661', '#e0ae79', '#c08a58'] },
    yona:   { log: '#c99a68', paint: '#6fb9a5', paint2: '#d4f0e7', motif: 'star', cur: '#5fb39c', cur2: '#fff3c0', curPat: 'star',
              floor: ['#cfa070', '#c19262', '#d9ab7c', '#b78a5c'] },
    living: { log: '#b98250', paint: '#b2473b', paint2: '#f6ecdc', motif: 'heart', cur: '#d24c45', cur2: '#ffffff', curPat: 'check',
              floor: ['#c48c58', '#b77f4d', '#cf9762', '#a97445'] },
  };
  // S = { HS, r, Rm, ox, LW, LH, WALLH, dark, win: { u, v, w, h }, door: null | { u, v, w, h }, t }
  function shell(g, S){
    const pal = PAL[S.r] || PAL.living, ph = phase(S.dark), H = S.WALLH, ox = S.ox;
    g.save(); g.scale(S.HS, S.HS); g.lineJoin = 'round'; g.lineCap = 'round';
    onWall(g, S, 1, () => logWall(g, pal, S.LW, H, 1, S.r));
    onWall(g, S, 0, () => logWall(g, pal, S.LH, H, 0, S.r));
    if (S.win) onWall(g, S, 1, () => winFrame(g, pal, S.win));
    if (S.door) onWall(g, S, 0, () => door(g, S.LH - S.door.u - S.door.w, S.door.v, S.door.w, S.door.h));
    floor(g, S, pal);
    // 두 벽이 만나는 구석 — 세로 그늘 한 줄
    g.fillStyle = K.lin(g, ox - 3, 0, ox + 3, 0, ['rgba(30,16,8,0)', 'rgba(30,16,8,.28)', 'rgba(30,16,8,0)']); g.fillRect(ox - 3, 0, 6, H);
    g.restore();
    toneOver(g, ph);
    // 창밖은 누르지 않는다 — 밤 하늘·오로라는 제 빛깔로
    if (S.win){ g.save(); g.scale(S.HS, S.HS); onWall(g, S, 1, () => winGlass(g, pal, S.win, ph, S.r)); g.restore(); }
  }
  // 벽 한 면을 평평한 좌표(x 0..len, y 0..104)로 — 왼쪽 벽은 구석이 x = len
  function onWall(g, S, side, fn){
    g.save();
    if (side) g.transform(1, 0.5, 0, 1, S.ox, 0); else g.transform(1, -0.5, 0, 1, S.ox - S.LH, S.LH / 2);
    try { fn(); } finally { g.restore(); }
  }
  const LOGS = 5, LOG_TOP = 6, LOG_BOT = 72, RAIL = 76, BASE = 98;
  function logWall(g, pal, len, H, side, room){
    const lh = (LOG_BOT - LOG_TOP) / LOGS, seed = side * 101 + hs(room);
    // 통나무 — 줄마다 빛깔이 조금씩 다르고, 둥글게 보이게 위아래로 어두운 그러데이션
    for (let i = 0; i < LOGS; i++){
      const y0 = LOG_TOP + i * lh, y1 = y0 + lh, b = shade(pal.log, (hash(seed + i * 7) - 0.5) * 0.16);
      g.fillStyle = K.lin(g, 0, y0, 0, y1, [shade(b, -0.42), shade(b, -0.05), shade(b, 0.2), shade(b, 0.08), shade(b, -0.18), shade(b, -0.48)]); g.fillRect(0, y0, len, lh);
      // 나뭇결 — 통나무를 따라 가는 줄
      for (let k = 0; k < len / 7; k++){
        const x = hash(seed * 13 + i * 131 + k) * len, w = 8 + hash(seed + i * 17 + k * 3) * 26, y = y0 + 2.5 + hash(seed + i * 29 + k * 5) * (lh - 5);
        K.line(g, [x, y], [x + w, y + (hash(k + i) - 0.5) * 0.8], hash(k * 7 + i) > 0.5 ? 'rgba(90,50,24,.22)' : 'rgba(255,230,190,.16)', 0.45);
      }
      // 옹이
      for (let k = 0; k < len / 60; k++){
        const x = hash(seed * 7 + i * 53 + k * 11) * len, y = y0 + lh * (0.35 + hash(i + k * 9) * 0.3);
        K.oval(g, x, y, 1.8, 1.1, shade(b, -0.3)); K.oval(g, x, y, 0.8, 0.5, shade(b, -0.5));
      }
      // 통나무 사이 메움(이끼·삼끈)
      g.fillStyle = 'rgba(52,32,20,.75)'; g.fillRect(0, y1 - 0.7, len, 1.4);
      g.fillStyle = 'rgba(160,140,100,.35)'; for (let x = 0; x < len; x += 3) g.fillRect(x + hash(x + i) * 2, y1 - 0.5, 1.2, 0.5);
    }
    // 위 들보
    g.fillStyle = K.lin(g, 0, 0, 0, LOG_TOP, ['#6a4128', '#8a5a38', '#5a3420']); g.fillRect(0, 0, len, LOG_TOP);
    g.fillStyle = K.lin(g, 0, LOG_TOP, 0, LOG_TOP + 6, ['rgba(30,16,8,.35)', 'rgba(30,16,8,0)']); g.fillRect(0, LOG_TOP, len, 6);
    // 허리 띠 — 칠한 나무
    g.fillStyle = K.lin(g, 0, LOG_BOT, 0, RAIL, [shade(pal.paint, 0.25), shade(pal.paint, -0.15)]); g.fillRect(0, LOG_BOT, len, RAIL - LOG_BOT);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, LOG_BOT, len, 0.6);
    // 아래 널판 — 칠한 세로 널, 이음매마다 그늘
    g.fillStyle = K.lin(g, 0, RAIL, 0, BASE, [shade(pal.paint, 0.08), pal.paint, shade(pal.paint, -0.12)]); g.fillRect(0, RAIL, len, BASE - RAIL);
    g.fillStyle = 'rgba(30,16,8,.32)'; g.fillRect(0, RAIL, len, 1.2);
    for (let x = 0; x < len; x += 7){ g.fillStyle = 'rgba(40,20,10,.22)'; g.fillRect(x, RAIL, 0.6, BASE - RAIL); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 0.6, RAIL, 0.6, BASE - RAIL); }
    // 널판에 찍은 무늬(스텐실) — 방마다 다르다
    for (let x = 12; x < len - 6; x += 24) motif(g, pal, x, (RAIL + BASE) / 2);
    // 걸레받이
    g.fillStyle = K.lin(g, 0, BASE, 0, H, ['#7a4c2c', '#5a3620', '#3e2416']); g.fillRect(0, BASE, len, H - BASE);
    g.fillStyle = 'rgba(255,220,180,.25)'; g.fillRect(0, BASE, len, 0.6);
    // 구석 그늘 · 끝 단면 — 오른쪽 벽은 구석이 x = 0, 왼쪽 벽은 x = len
    const cx = side ? 0 : len, dir = side ? 1 : -1;
    g.fillStyle = K.lin(g, cx, 0, cx + dir * 24, 0, ['rgba(30,16,8,.32)', 'rgba(30,16,8,0)']); g.fillRect(Math.min(cx, cx + dir * 24), 0, 24, H);
    const ex = side ? len : 0;                                                    // 벽 끝 — 잘린 통나무 단면
    for (let i = 0; i < LOGS; i++){ const y = LOG_TOP + (i + 0.5) * lh; K.oval(g, ex, y, 1.6, lh * 0.48, '#e2b986'); K.oval(g, ex, y, 0.8, lh * 0.3, '#c8955e'); }
    if (!side){ g.fillStyle = 'rgba(30,20,40,.12)'; g.fillRect(0, 0, len, H); }   // 왼쪽 벽은 빛을 등진다
  }
  function motif(g, pal, x, y){
    const c = pal.paint2, d = shade(pal.paint, -0.25);
    if (pal.motif === 'tulip'){                                                  // 튤립 셋 — 북유럽 장식 그림
      K.line(g, [x, y + 6], [x, y - 1], '#5f8a55', 0.7); K.line(g, [x, y + 4], [x - 4, y + 1], '#5f8a55', 0.6); K.line(g, [x, y + 4], [x + 4, y + 1], '#5f8a55', 0.6);
      K.path(g, [[x - 2.4, y - 5], [x - 1.2, y - 2.6], [x, y - 5.2], [x + 1.2, y - 2.6], [x + 2.4, y - 5], [x + 2.2, y - 1], [x, y], [x - 2.2, y - 1]]); g.fillStyle = c; g.fill();
      K.oval(g, x - 4.6, y + 0.4, 1.6, 1.2, c); K.oval(g, x + 4.6, y + 0.4, 1.6, 1.2, c);
      K.oval(g, x - 9, y + 2, 0.8, 0.8, d); K.oval(g, x + 9, y + 2, 0.8, 0.8, d);
    } else if (pal.motif === 'star'){                                            // 여덟 갈래 북유럽 별
      g.save(); g.translate(x, y); g.fillStyle = c;
      for (let i = 0; i < 8; i++){ g.rotate(TAU / 8); K.path(g, [[0, 0], [1.4, -2.2], [0, -5.4], [-1.4, -2.2]]); g.fill(); }
      g.restore(); K.oval(g, x, y, 0.9, 0.9, d);
    } else {                                                                     // 하트 + 잎
      g.fillStyle = c; g.beginPath(); g.moveTo(x, y + 3.6); g.bezierCurveTo(x - 6, y - 0.5, x - 3, y - 5.5, x, y - 2.2); g.bezierCurveTo(x + 3, y - 5.5, x + 6, y - 0.5, x, y + 3.6); g.fill();
      K.oval(g, x - 7, y + 1, 2, 1, c); K.oval(g, x + 7, y + 1, 2, 1, c); K.oval(g, x, y - 0.6, 0.8, 0.8, d);
    }
  }
  // 창틀·창턱·커튼 — 창유리 안(밖 풍경)은 winGlass
  function winFrame(g, pal, W){
    const x = W.u, y = W.v, w = W.w, h = W.h;
    // 커튼봉 위 주름 가리개 그림자, 흰 칠 창틀
    K.rr(g, x - 5, y - 5, w + 10, h + 9, 1.5, K.lin(g, 0, y - 5, 0, y + h + 4, ['#fbf7ee', '#e6dccb']), true);
    K.rr(g, x - 1.5, y - 1.5, w + 3, h + 3, 0.8, '#cfc3ad');
    // 창턱 — 앞으로 나온 널
    K.rr(g, x - 9, y + h + 3, w + 18, 4.5, 1.2, K.lin(g, 0, y + h + 3, 0, y + h + 7.5, ['#fffaf0', '#d8ccb6']), true);
    g.fillStyle = 'rgba(30,16,8,.25)'; g.fillRect(x - 8, y + h + 7.5, w + 16, 2);
    // 커튼 — 양쪽, 묶은 자리에서 오므라들고 아래로 퍼진다
    [[x - 18, 1], [x + w + 4, -1]].forEach(([cx, s]) => {
      const top = y - 9, tie = y + h * 0.55, bot = y + h + 13, wd = 14, inX = s > 0 ? cx + wd : cx;
      const pts = s > 0
        ? [[cx, top], [cx + wd, top], [cx + wd - 1, tie - 6], [cx + wd - 6, tie], [cx + wd - 2, bot], [cx - 1, bot + 1]]
        : [[cx, top], [cx + wd, top], [cx + wd + 1, bot + 1], [cx + 2, bot], [cx + 6, tie], [cx + 1, tie - 6]];
      g.save(); K.path(g, pts.map(p => [p[0], p[1]])); g.clip();
      const stops = []; for (let i = 0; i <= 8; i++) stops.push(i % 2 ? shade(pal.cur, -0.22) : shade(pal.cur, 0.12));
      g.fillStyle = K.lin(g, cx - 1, 0, cx + wd + 1, 0, stops); g.fillRect(cx - 2, top, wd + 4, bot - top + 2);
      // 무늬 — 수아 물방울, 연아 별, 거실 체크
      g.fillStyle = 'rgba(255,255,255,.55)';
      if (pal.curPat === 'check'){ for (let yy = top; yy < bot; yy += 4) g.fillRect(cx - 2, yy, wd + 4, 1.6); for (let xx = cx; xx < cx + wd; xx += 4) g.fillRect(xx, top, 1.6, bot - top + 2); }
      else for (let yy = top + 3, j = 0; yy < bot; yy += 5, j++) for (let xx = cx + (j % 2 ? 3 : 1); xx < cx + wd; xx += 4.5){
        if (pal.curPat === 'star'){ g.fillStyle = pal.cur2; g.save(); g.translate(xx, yy); for (let i = 0; i < 5; i++){ g.rotate(TAU / 5); g.fillRect(-0.3, -1.3, 0.6, 1.3); } g.restore(); }
        else K.oval(g, xx, yy, 0.8, 0.8, 'rgba(255,255,255,.75)');
      }
      g.fillStyle = K.lin(g, 0, top, 0, bot, ['rgba(255,255,255,.12)', 'rgba(0,0,0,0)', 'rgba(30,16,8,.18)']); g.fillRect(cx - 2, top, wd + 4, bot - top + 2);
      g.restore();
      K.poly(g, pts, null, true);
      K.rr(g, (s > 0 ? inX - 9 : inX - 1), tie - 2, 10, 3.6, 1.6, shade(pal.cur, -0.35), true);   // 묶은 띠
      K.oval(g, s > 0 ? inX - 4 : inX + 4, tie, 1.2, 1.2, '#f2d27a');
    });
    // 커튼봉과 주름 가리개
    K.line(g, [x - 22, y - 10], [x + w + 22, y - 10], '#3a2a22', 1.4);
    K.oval(g, x - 22, y - 10, 1.6, 1.6, '#c9a050', true); K.oval(g, x + w + 22, y - 10, 1.6, 1.6, '#c9a050', true);
    g.beginPath(); g.moveTo(x - 20, y - 12);
    g.lineTo(x + w + 20, y - 12); g.lineTo(x + w + 20, y - 6);
    for (let xx = x + w + 20; xx > x - 20; xx -= 8) g.quadraticCurveTo(xx - 4, y - 2, xx - 8, y - 6);
    g.closePath(); g.fillStyle = K.lin(g, 0, y - 12, 0, y - 2, [shade(pal.cur, 0.15), shade(pal.cur, -0.2)]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
  }
  // 창유리 — 밖 풍경(눈 덮인 전나무, 먼 설산, 밤이면 오로라), 십자 살, 서리, 눈 쌓인 바깥 턱
  const SKY = [['#7db4dc', '#b9dcef', '#e8f4fa'], ['#f2a07e', '#ffc9a0', '#ffe9c8'], ['#3b3770', '#8a5e98', '#d98c96'], ['#040a20', '#0c1e44', '#1a4062']];
  function winGlass(g, pal, W, ph, room){
    const x = W.u, y = W.v, w = W.w, h = W.h, night = ph >= 2, tn = toneOf(ph);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = K.lin(g, 0, y, 0, y + h, SKY[ph]); g.fillRect(x, y, w, h);
    if (night){
      for (let i = 0; i < 26; i++){ const sx = x + hash(i * 3 + 7) * w, sy = y + hash(i * 5 + 1) * h * 0.6; K.oval(g, sx, sy, 0.35 + hash(i) * 0.35, 0.35 + hash(i) * 0.35, 'rgba(240,248,255,' + (0.5 + hash(i * 9) * 0.5).toFixed(2) + ')'); }
      // 오로라 — 세로 빛살을 물결 따라 촘촘히(방마다 조금 다른 물결)
      g.save(); g.globalCompositeOperation = 'lighter';
      const sd = hs(room) % 7, a = ph >= 3 ? 1 : 0.55;
      [['120,255,190', 0.42, 6, 0.09, 16], ['90,220,255', 0.3, 4, 0.13, 12], ['200,130,255', 0.2, 3, 0.07, 9]].forEach(([c, yy, amp, f, tall], j) => {
        for (let xx = x; xx < x + w; xx += 0.8){
          const base = y + h * yy + amp * Math.sin(xx * f + sd + j * 2) + amp * 0.5 * Math.sin(xx * f * 2.7 - sd);
          const k = 0.5 + 0.5 * Math.sin(xx * 0.11 + sd + j) * Math.sin(xx * 0.037 - j);
          if (k < 0.1) continue;
          const tl = tall * (0.7 + 0.5 * k);
          g.fillStyle = K.lin(g, 0, base - tl, 0, base + 2, ['rgba(' + c + ',0)', 'rgba(' + c + ',' + (0.3 * a * k).toFixed(3) + ')', 'rgba(' + c + ',' + (0.85 * a * k).toFixed(3) + ')', 'rgba(' + c + ',0)']);
          g.fillRect(xx, base - tl, 0.9, tl + 2);
        }
      });
      g.restore();
      if (ph >= 3){ K.glow(g, x + w * 0.82, y + h * 0.16, 7, 'rgba(220,235,255,', 0.4); K.oval(g, x + w * 0.82, y + h * 0.16, 2.6, 2.6, '#eef3ff'); K.oval(g, x + w * 0.82 + 1, y + h * 0.16 - 0.6, 2.3, 2.4, SKY[3][1]); }
    } else {
      K.glow(g, x + w * 0.2, y + h * 0.3, 14, ph ? 'rgba(255,220,170,' : 'rgba(255,250,230,', 0.7); K.oval(g, x + w * 0.2, y + h * 0.3, 3.2, 3.2, ph ? '#fff0d0' : '#fffdf4');
      for (let i = 0; i < 3; i++){ const cx = x + w * (0.45 + i * 0.2), cy = y + 5 + i * 3; K.oval(g, cx, cy, 6, 1.6, 'rgba(255,255,255,.7)'); K.oval(g, cx + 2, cy - 1, 3.5, 1.6, 'rgba(255,255,255,.8)'); }
    }
    // 먼 설산
    const far = ['#9fb8d4', '#c99aa2', '#5a5a8a', '#1e3058'][ph], cap = ['#ffffff', '#ffe8dc', '#d8d0ec', '#9fb4dc'][ph], gy = y + h * 0.72;
    g.beginPath(); g.moveTo(x, gy);
    for (let xx = 0; xx <= w; xx += 2) g.lineTo(x + xx, gy - 4 - 9 * Math.pow(1 - Math.abs(Math.sin(xx * 0.07 + 1.3)), 1.6) - 3 * (1 - Math.abs(Math.sin(xx * 0.19))));
    g.lineTo(x + w, gy); g.closePath(); g.fillStyle = far; g.fill();
    g.save(); g.clip(); g.fillStyle = cap; g.fillRect(x, y, w, gy - 10 - y); g.restore();
    // 눈 땅
    const snow = [['#ffffff', '#dce8f4'], ['#fff1e6', '#f0cdbe'], ['#bcb4d8', '#8a86b4'], ['#6a7eb0', '#3e4c80']][ph];
    g.beginPath(); g.moveTo(x, gy - 1); g.quadraticCurveTo(x + w * 0.4, gy - 4, x + w, gy + 1); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fillStyle = K.lin(g, 0, gy - 4, 0, y + h, snow); g.fill();
    // 눈 덮인 전나무
    const fir = ['#2f6b5c', '#4a5a50', '#26404a', '#10283a'][ph], firS = ['#ffffff', '#fff0e8', '#d0cce8', '#8fa3cf'][ph];
    [[0.08, 13], [0.18, 9], [0.66, 11], [0.8, 15], [0.93, 10]].forEach(([fx, th], i) => {
      const bx = x + w * fx, by = gy + 1 + i % 2;
      for (let k = 0; k < 3; k++){
        const ty = by - th + k * th * 0.28, hw = th * (0.22 + k * 0.1);
        K.poly(g, [[bx, ty], [bx + hw, ty + th * 0.4], [bx - hw, ty + th * 0.4]], fir);
        K.poly(g, [[bx, ty], [bx + hw * 0.6, ty + th * 0.22], [bx - hw * 0.7, ty + th * 0.24]], firS);
      }
    });
    // 밤 — 먼 오두막 불빛 하나
    if (night){ K.glow(g, x + w * 0.42, gy + 2, 5, 'rgba(255,200,120,', 0.6); K.oval(g, x + w * 0.42, gy + 2, 0.9, 0.7, '#ffd98a'); }
    // 내리는 눈
    for (let i = 0; i < 22; i++) K.oval(g, x + hash(i * 11 + 2) * w, y + hash(i * 13 + 5) * h, 0.45, 0.45, 'rgba(255,255,255,' + (night ? 0.7 : 0.9) + ')');
    // 서리 — 아래 귀퉁이
    [[x, y + h], [x + w, y + h]].forEach(p => { g.fillStyle = K.rad(g, p[0], p[1], 14, ['rgba(235,245,255,.85)', 'rgba(220,236,250,.35)', 'rgba(220,236,250,0)']); g.fillRect(p[0] - 14, p[1] - 14, 28, 28); });
    // 바깥 턱에 쌓인 눈
    g.beginPath(); g.moveTo(x, y + h); for (let xx = 0; xx <= w; xx += 4) g.lineTo(x + xx, y + h - 2.4 - 1.4 * Math.sin(xx * 0.4 + 1)); g.lineTo(x + w, y + h); g.closePath(); g.fillStyle = night ? '#c8d6f0' : '#ffffff'; g.fill();
    // 유리 반사
    g.fillStyle = 'rgba(255,255,255,' + (night ? 0.06 : 0.18) + ')'; K.path(g, [[x + 6, y], [x + 16, y], [x + 4, y + h], [x - 6, y + h]]); g.fill();
    g.restore();
    // 십자 살
    const bar = tn('#f6f0e2');
    K.rr(g, x + w / 2 - 1.3, y, 2.6, h, 0.5, bar, 0.4); K.rr(g, x, y + h * 0.45 - 1.3, w, 2.6, 0.5, bar, 0.4);
    g.strokeStyle = INK; g.lineWidth = LW; g.strokeRect(x, y, w, h);
  }
  // 거실 문 — 세로 널 문, Z 띠, 검은 쇠 경첩, 하트 구멍
  function door(g, x, y, w, h){
    K.rr(g, x - 3.5, y - 3.5, w + 7, h + 3.5, 1, K.lin(g, 0, y, 0, y + h, ['#7a4c2c', '#5a3620']), true);
    const n = 5, pw = w / n;
    for (let i = 0; i < n; i++){
      const c = shade('#a8743f', (hash(i * 31 + 5) - 0.5) * 0.14);
      g.fillStyle = K.lin(g, x + i * pw, 0, x + (i + 1) * pw, 0, [shade(c, 0.1), c, shade(c, -0.12)]); g.fillRect(x + i * pw, y, pw, h);
      for (let k = 0; k < 4; k++){ const gx = x + i * pw + 1 + hash(i * 9 + k) * (pw - 2); K.line(g, [gx, y + 2], [gx + (hash(k) - 0.5), y + h - 2], 'rgba(90,50,20,.22)', 0.4); }
      g.fillStyle = 'rgba(40,20,10,.4)'; g.fillRect(x + i * pw, y, 0.6, h);
    }
    // 가로 띠 둘과 빗장
    [y + 12, y + h - 16].forEach(yy => { K.rr(g, x + 1, yy, w - 2, 5, 0.8, K.lin(g, 0, yy, 0, yy + 5, ['#b98450', '#87582f']), true); });
    g.save(); g.beginPath(); g.moveTo(x + 3, y + h - 15); g.lineTo(x + w - 3, y + 17); g.lineTo(x + w - 3, y + 22); g.lineTo(x + 3, y + h - 10); g.closePath(); g.fillStyle = '#9a6a3c'; g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke(); g.restore();
    // 쇠 경첩(문 왼쪽에서 뻗는 긴 띠) · 고리 손잡이
    [y + 14.5, y + h - 13.5].forEach(yy => { K.rr(g, x - 1, yy - 1.1, w * 0.62, 2.2, 1, '#2e2a2a'); K.oval(g, x + w * 0.62 - 1, yy, 1.6, 1.6, '#2e2a2a'); for (let k = 0; k < 3; k++) K.oval(g, x + 2 + k * 6, yy, 0.45, 0.45, '#8a8080'); });
    K.oval(g, x + w - 6, y + h * 0.52, 2.2, 2.2, '#2e2a2a'); K.oval(g, x + w - 6, y + h * 0.52 + 3.4, 2.6, 2.6, null, 0.9);
    g.strokeStyle = '#3a3434'; g.lineWidth = 0.8; g.beginPath(); g.arc(x + w - 6, y + h * 0.52 + 3.4, 2.6, 0, TAU); g.stroke();
    // 하트 구멍 — 밖의 빛이 비친다
    const hx = x + w / 2, hy = y + 32;
    g.fillStyle = '#fff2c8'; g.beginPath(); g.moveTo(hx, hy + 3.5); g.bezierCurveTo(hx - 5, hy, hx - 2.6, hy - 4.4, hx, hy - 1.8); g.bezierCurveTo(hx + 2.6, hy - 4.4, hx + 5, hy, hx, hy + 3.5); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.5; g.stroke();
    g.fillStyle = K.lin(g, 0, y + h - 4, 0, y + h, ['rgba(30,16,8,0)', 'rgba(30,16,8,.35)']); g.fillRect(x, y + h - 4, w, 4);
  }
  // 마루 — 칸 좌표(a, b)로 기울여 그린다. 널은 a 를 따라 길게, 한 칸에 세 줄, 이음매는 줄마다 어긋나게
  function floor(g, S, pal){
    const Rm = S.Rm, seed = hs(S.r);
    g.save(); g.transform(S.TW / 2, S.TH / 2, -S.TW / 2, S.TH / 2, S.ox, S.WALLH);
    for (let k = 0; k < Rm.h * 3; k++){
      const b0 = k / 3, b1 = (k + 1) / 3;
      let a = -hash(seed + k * 7) * 1.6, j = 0;
      while (a < Rm.w){
        const len = 1.3 + hash(seed + k * 31 + j * 7) * 1.4, a0 = Math.max(0, a), a1 = Math.min(Rm.w, a + len);
        const c = pal.floor[Math.floor(hash(seed * 3 + k * 13 + j * 5) * 4)];
        g.fillStyle = K.lin(g, 0, b0, 0, b1, [shade(c, 0.1), c, shade(c, -0.1)]); g.fillRect(a0, b0, a1 - a0, b1 - b0);
        // 결 — 널을 따라 가는 줄 몇 개
        for (let s = 0; s < 4; s++){
          const yy = b0 + 0.05 + hash(seed + k * 3 + j * 11 + s) * 0.23, xx = a0 + hash(k * 17 + j * 3 + s * 5) * (a1 - a0) * 0.6;
          g.fillStyle = hash(s + j * 3 + k) > 0.5 ? 'rgba(110,60,25,.16)' : 'rgba(255,235,200,.14)'; g.fillRect(xx, yy, (a1 - a0) * (0.25 + hash(s * 9 + k) * 0.4), 0.012);
        }
        if (hash(seed + k * 41 + j * 23) > 0.86){ const kx = a0 + (a1 - a0) * hash(k + j * 3), ky = b0 + 0.16; g.fillStyle = shade(c, -0.35); g.beginPath(); g.ellipse(kx, ky, 0.05, 0.035, 0, 0, TAU); g.fill(); }
        if (a + len < Rm.w){ g.fillStyle = 'rgba(50,26,12,.5)'; g.fillRect(a1 - 0.012, b0, 0.024, b1 - b0); g.fillStyle = 'rgba(60,40,30,.45)'; g.fillRect(a1 - 0.07, b0 + 0.08, 0.02, 0.02); g.fillRect(a1 - 0.07, b1 - 0.1, 0.02, 0.02); }
        a += len; j++;
      }
      g.fillStyle = 'rgba(50,26,12,.45)'; g.fillRect(0, b1 - 0.01, Rm.w, 0.02);
      g.fillStyle = 'rgba(255,235,200,.12)'; g.fillRect(0, b0 + 0.012, Rm.w, 0.012);
    }
    // 벽 밑 그늘 · 앞쪽은 조금 어둡게
    g.fillStyle = K.lin(g, 0, 0, 0, 0.7, ['rgba(30,16,8,.4)', 'rgba(30,16,8,0)']); g.fillRect(0, 0, Rm.w, 0.7);
    g.fillStyle = K.lin(g, 0, 0, 0.7, 0, ['rgba(30,16,8,.45)', 'rgba(30,16,8,0)']); g.fillRect(0, 0, 0.7, Rm.h);
    g.fillStyle = K.lin(g, 0, 0, Rm.w, Rm.h, ['rgba(255,220,160,.08)', 'rgba(0,0,0,0)', 'rgba(30,16,8,.12)']); g.fillRect(0, 0, Rm.w, Rm.h);
    g.restore();
  }

  // ================= 가구 — 앞 절반(amphora ~ mirror) =================
  const WOOD = '#b98450', WOODD = '#7a4c2c', IRON = '#2e2a2a', CREAM = '#fbf3e4';
  const ACC = { sua: '#f28aa8', yona: '#5fb39c', living: '#d24c45' };            // 방 빛깔 — 방석·이불 띠 따위
  const acc = C => ACC[C.room] || ACC.living;
  // 긴 축(s)·짧은 축(t) 좌표 → 화면. 2×1 가구가 돌아가도 같은 코드로 그린다
  const SP = C => (s, t, z) => C.E >= C.D ? C.P(s, t, z) : C.P(t, s, z);
  const LEN = C => Math.max(C.E, C.D), WID = C => Math.min(C.E, C.D);
  const sbox = (g, C, s0, t0, s1, t1, z0, z1, col, o) => { const b = C.seg(s0, s1, t0, t1); K.box(g, C, b[0], b[1], b[2], b[3], z0, z1, col, o); };
  const scyl = (g, C, s, t, r, z0, z1, col, o) => { const p = C.E >= C.D ? [s, t] : [t, s]; K.cyl(g, C, p[0], p[1], r, z0, z1, col, o); };
  // 긴 면(t = WID) 앞에 평평하게 — 긴 축이 ax 면 'L' 면, ay 면 'R' 면
  const longFace = (g, C, t, z) => C.E >= C.D ? K.face(g, C, 'L', 0, t, z) : K.face(g, C, 'R', t, LEN(C), z);
  const eye = (g, x, y, r) => { K.oval(g, x, y, r, r * 1.15, '#2a1c18'); K.oval(g, x - r * 0.35, y - r * 0.45, r * 0.38, r * 0.38, '#ffffff'); };
  const blush = (g, x, y, r) => K.oval(g, x, y, r, r * 0.6, 'rgba(255,110,130,.35)');

  // 봉제 인형(곰·여우) — 앞에서 본 앉은 모습. o = { col, belly, ear('round'|'fox'), s, scarf, tail }
  function plush(g, C, o){
    const s = o.s || 1, x = C.CX, y = C.CY + 3 * s, col = o.col, hi = shade(col, 0.28), dk = shade(col, -0.28);
    K.shadow(g, C, 0.62 * Math.min(1.4, s));
    const fur = (cx, cy, r) => K.rad(g, cx - r * 0.35, cy - r * 0.45, r * 1.5, [hi, col, dk]);
    if (o.tail){ g.beginPath(); g.moveTo(x + 6 * s, y - 4 * s); g.bezierCurveTo(x + 20 * s, y - 4 * s, x + 20 * s, y - 22 * s, x + 12 * s, y - 26 * s); g.bezierCurveTo(x + 14 * s, y - 16 * s, x + 10 * s, y - 10 * s, x + 4 * s, y - 9 * s); g.closePath(); g.fillStyle = fur(x + 14 * s, y - 14 * s, 10 * s); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke(); K.oval(g, x + 12.5 * s, y - 24 * s, 2.6 * s, 2.4 * s, '#ffffff', true); }
    K.oval(g, x, y - 11 * s, 9.5 * s, 10.5 * s, fur(x, y - 11 * s, 10 * s), true);                     // 몸
    K.oval(g, x, y - 9 * s, 5.6 * s, 6.4 * s, o.belly);
    [-1, 1].forEach(d => { K.oval(g, x + d * 9 * s, y - 13 * s, 3 * s, 5.2 * s, fur(x + d * 9 * s, y - 13 * s, 5 * s), true); });   // 팔
    [-1, 1].forEach(d => { K.oval(g, x + d * 5.5 * s, y - 2.2 * s, 4.2 * s, 3.2 * s, fur(x + d * 5.5 * s, y - 2 * s, 4 * s), true); K.oval(g, x + d * 5.5 * s, y - 1.8 * s, 2.4 * s, 2 * s, o.belly); });
    const hy = y - 27 * s;
    if (o.ear === 'fox') [-1, 1].forEach(d => { K.poly(g, [[x + d * 3 * s, hy - 6 * s], [x + d * 10 * s, hy - 15 * s], [x + d * 9.5 * s, hy - 3 * s]], col, true); K.poly(g, [[x + d * 4.5 * s, hy - 6 * s], [x + d * 9 * s, hy - 12.5 * s], [x + d * 8.6 * s, hy - 4.5 * s]], o.belly); });
    else [-1, 1].forEach(d => { K.oval(g, x + d * 7.5 * s, hy - 6.5 * s, 3.6 * s, 3.6 * s, col, true); K.oval(g, x + d * 7.5 * s, hy - 6.3 * s, 2 * s, 2 * s, o.belly); });
    K.oval(g, x, hy, 10 * s, 8.8 * s, fur(x, hy, 10 * s), true);                                      // 머리
    if (o.ear === 'fox'){ K.path(g, [[x - 9 * s, hy + 1 * s], [x, hy - 2 * s], [x + 9 * s, hy + 1 * s], [x + 5 * s, hy + 7 * s], [x, hy + 8.4 * s], [x - 5 * s, hy + 7 * s]]); g.fillStyle = o.belly; g.fill(); }
    else K.oval(g, x, hy + 3 * s, 4.2 * s, 3.2 * s, o.belly);
    K.oval(g, x, hy + 1.8 * s, 1.5 * s, 1.1 * s, '#3a2620');
    g.strokeStyle = '#3a2620'; g.lineWidth = 0.5 * s; g.beginPath(); g.moveTo(x - 1.6 * s, hy + 4 * s); g.quadraticCurveTo(x, hy + 5.2 * s, x, hy + 3 * s); g.quadraticCurveTo(x, hy + 5.2 * s, x + 1.6 * s, hy + 4 * s); g.stroke();
    eye(g, x - 4 * s, hy - 1.4 * s, 1.15 * s); eye(g, x + 4 * s, hy - 1.4 * s, 1.15 * s);
    blush(g, x - 6.5 * s, hy + 2 * s, 1.6 * s); blush(g, x + 6.5 * s, hy + 2 * s, 1.6 * s);
    if (o.scarf){                                                                                       // 뜨개 목도리
      K.rr(g, x - 8 * s, hy + 6.5 * s, 16 * s, 3.4 * s, 1.6 * s, o.scarf, true);
      K.rr(g, x + 2 * s, hy + 8 * s, 3.4 * s, 8 * s, 1.2 * s, shade(o.scarf, -0.1), true);
      g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) g.fillRect(x - 6.5 * s + i * 4 * s, hy + 7.7 * s, 1.4 * s, 1 * s);
    }
  }
  furn.bear = (g, C) => plush(g, C, { col: C.c, belly: '#f3dfc4', scarf: acc(C) });
  furn.bigbear = (g, C) => plush(g, C, { col: C.c, belly: '#f3dfc4', scarf: '#d24c45', s: 2.05 });
  furn.fox = (g, C) => plush(g, C, { col: C.c, belly: '#fff6f2', ear: 'fox', tail: true, scarf: '#7fc4e8' });

  // 헝겊 인형 — 털실 땋은 머리, 앞치마 원피스
  furn.doll = (g, C) => {
    const x = C.CX, y = C.CY + 3, dress = mix(C.c, '#e8606a', 0.55);
    K.shadow(g, C, 0.55);
    [-1, 1].forEach(d => { K.rr(g, x + d * 3.5 - 1.6, y - 6, 3.2, 6, 1.4, CREAM, true); K.oval(g, x + d * 3.6, y - 0.5, 2.4, 1.6, '#5a3a2a', true); });
    K.poly(g, [[x - 4, y - 21], [x + 4, y - 21], [x + 9, y - 5], [x - 9, y - 5]], K.lin(g, x - 9, 0, x + 9, 0, [shade(dress, 0.1), dress, shade(dress, -0.25)]), true);
    K.poly(g, [[x - 3, y - 17], [x + 3, y - 17], [x + 5, y - 7], [x - 5, y - 7]], '#fffaf0');
    for (let i = 0; i < 3; i++) K.oval(g, x - 2.6 + i * 2.6, y - 6.2, 1.2, 0.8, '#fffaf0');
    [-1, 1].forEach(d => K.rr(g, x + d * 6 - 1.5, y - 20, 3, 9, 1.4, '#ffe0c8', true));
    const hy = y - 27;
    [-1, 1].forEach(d => { for (let k = 0; k < 3; k++) K.oval(g, x + d * 8.6, hy + 3 + k * 3.2, 1.9, 1.9, '#8a4a2a', true); K.oval(g, x + d * 8.6, hy + 12.6, 1.4, 1, acc(C)); });
    K.oval(g, x, hy, 7.5, 7.5, K.rad(g, x - 2, hy - 2, 10, ['#fff0e2', '#ffe0c8', '#f2c4a8']), true);
    K.path(g, [[x - 7.8, hy + 1], [x - 7, hy - 5], [x, hy - 8.4], [x + 7, hy - 5], [x + 7.8, hy + 1], [x + 4, hy - 3], [x, hy - 4.4], [x - 4, hy - 3]]); g.fillStyle = '#9a5634'; g.fill();
    K.oval(g, x - 2.8, hy + 0.6, 0.9, 0.9, '#2a1c18'); K.oval(g, x + 2.8, hy + 0.6, 0.9, 0.9, '#2a1c18');
    blush(g, x - 4.4, hy + 3, 1.4); blush(g, x + 4.4, hy + 3, 1.4);
    g.strokeStyle = '#c0504a'; g.lineWidth = 0.5; g.beginPath(); g.arc(x, hy + 2.6, 1.4, 0.2, Math.PI - 0.2); g.stroke();
  };

  // 암포라 — 테라코타 항아리, 검은 띠에 뇌문(메안드로스)
  furn.amphora = (g, C) => {
    const x = C.CX, y = C.CY + 3, c = C.c, h = 43;
    const hw = d => d < 31 ? 3.5 + 6.6 * Math.pow(Math.sin(Math.PI * Math.min(1, (d + 2) / 35)), 0.9) : d < 40 ? 3.4 : 3.4 + (d - 40) * 0.8;
    K.shadow(g, C, 0.5);
    [-1, 1].forEach(dd => { g.strokeStyle = shade(c, -0.25); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + dd * 3.4, y - 38); g.bezierCurveTo(x + dd * 11, y - 39, x + dd * 12, y - 32, x + dd * 8.4, y - 26); g.stroke(); });
    K.lathe(g, x, y, h, hw, c);
    g.save(); g.beginPath(); for (let d = 0; d <= h; d += 0.5) g.lineTo(x - hw(d), y - d); for (let d = h; d >= 0; d -= 0.5) g.lineTo(x + hw(d), y - d); g.closePath(); g.clip();
    g.fillStyle = '#2e1e18'; g.fillRect(x - 12, y - 24, 24, 9);
    g.fillStyle = c; for (let i = -3; i <= 3; i++){ const mx = x + i * 3.6; g.fillRect(mx - 1.4, y - 22.5, 2.8, 0.8); g.fillRect(mx + 0.6, y - 22.5, 0.8, 4.6); g.fillRect(mx - 0.6, y - 18.7, 2, 0.8); g.fillRect(mx - 0.6, y - 20.6, 0.8, 2.6); }
    g.fillStyle = '#2e1e18'; g.fillRect(x - 12, y - 31, 24, 1.2); g.fillRect(x - 12, y - 6, 24, 1.4);
    g.fillStyle = K.lin(g, x - 10, 0, x + 10, 0, ['rgba(0,0,0,.2)', 'rgba(255,255,255,.18)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.25)']); g.fillRect(x - 12, y - h, 24, h);
    g.restore();
    K.oval(g, x, y - h, 4.2, 1.4, shade(c, -0.35), true);
  };

  // 종이 등(안돈) — 나무 틀에 한지, 밤이면 속에서 노랗게
  furn.andon = (g, C) => {
    const a0 = 6, a1 = 18, z0 = 7, z1 = 46, paper = C.lit ? '#ffe2a8' : '#fbf1da';
    if (!C.lit){ K.shadow(g, C, 0.6); [[a0, a0], [a1, a0], [a1, a1], [a0, a1]].forEach(p => K.cyl(g, C, p[0], p[1], 0.9, 0, z1 + 2, '#5e4130', { noTop: true })); }
    const faceL = [[a0, a1, z0], [a1, a1, z0], [a1, a1, z1], [a0, a1, z1]], faceR = [[a1, a1, z0], [a1, a0, z0], [a1, a0, z1], [a1, a1, z1]];
    [faceL, faceR].forEach((f, i) => {
      const t = C.P(f[0][0], f[0][1], z1), b = C.P(f[0][0], f[0][1], z0);
      K.quad(g, C, f, C.lit ? K.lin(g, 0, t[1], 0, b[1], ['#fff2c8', paper, '#ffcf7a']) : K.lin(g, 0, t[1], 0, b[1], [paper, shade(paper, i ? -0.12 : -0.04)]));
      // 살 — 가로 셋, 세로 하나
      for (let k = 1; k < 4; k++){ const z = z0 + (z1 - z0) * k / 4; K.line(g, C.P(f[0][0], f[0][1], z), C.P(f[1][0], f[1][1], z), C.lit ? 'rgba(120,70,30,.5)' : '#5e4130', 0.5); }
      K.line(g, C.P((f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2, z0), C.P((f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2, z1), C.lit ? 'rgba(120,70,30,.5)' : '#5e4130', 0.5);
      if (!C.lit) K.quad(g, C, f, null, true);
    });
    if (C.lit) return;
    K.box(g, C, a0 - 1, a0 - 1, a1 + 1, a1 + 1, z1, z1 + 2.5, '#5e4130');
    K.box(g, C, a0 - 1, a0 - 1, a1 + 1, a1 + 1, z0 - 2, z0, '#5e4130');
  };

  // 볼풀 — 둥근 테 안에 알록달록 공
  furn.ballpit = (g, C) => {
    const E = C.E, D = C.D, rim = '#7fc4ec';
    K.shadow(g, C, 0.95);
    K.box(g, C, 1, 1, E - 1, D - 1, 0, 13, rim, { top: '#5aa0cc' });
    const COLS = ['#ff7f8a', '#ffd166', '#6cc7b3', '#7fb0f0', '#c49af0', '#ff9f5a', '#ffffff'], balls = [];
    for (let i = 0; i < (E * D) / 14; i++) balls.push([4 + hash(i * 3 + 1) * (E - 8), 4 + hash(i * 5 + 2) * (D - 8), COLS[Math.floor(hash(i * 7) * COLS.length)], hash(i * 11) * 2]);
    balls.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])).forEach(b => {
      const p = C.P(b[0], b[1], 13.5 + b[3]);
      K.oval(g, p[0], p[1], 2.6, 2.6, K.rad(g, p[0] - 0.9, p[1] - 0.9, 3.4, [shade(b[2], 0.45), b[2], shade(b[2], -0.25)]), 0.35);
    });
    // 테 — 흰·파랑 줄무늬 둥근 띠
    const ring = [[1, 1], [E - 1, 1], [E - 1, D - 1], [1, D - 1]];
    for (let i = 0; i < 4; i++){
      const a = ring[i], b = ring[(i + 1) % 4], n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
      for (let k = 0; k < n; k++){ const u0 = k / n, u1 = (k + 1) / n, p0 = C.P(a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, 14), p1 = C.P(a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1, 14); K.line(g, p0, p1, k % 2 ? '#ffffff' : '#4f9ad6', 2.6); }
    }
  };

  // 빈백 — 푹 꺼진 콩주머니
  furn.beanbag = (g, C) => {
    const x = C.CX, y = C.CY, c = C.c;
    K.shadow(g, C, 0.85);
    g.beginPath(); g.moveTo(x - 15, y - 2); g.bezierCurveTo(x - 17, y - 14, x - 8, y - 23, x + 1, y - 22); g.bezierCurveTo(x + 11, y - 21, x + 17, y - 12, x + 15, y - 2); g.bezierCurveTo(x + 10, y + 5, x - 10, y + 5, x - 15, y - 2); g.closePath();
    g.fillStyle = K.rad(g, x - 5, y - 14, 22, [shade(c, 0.3), c, shade(c, -0.3)]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    K.oval(g, x + 1, y - 9, 8.5, 4.2, K.rad(g, x + 2, y - 8, 9, [shade(c, -0.22), shade(c, -0.05)]));
    g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 12, y - 12); g.quadraticCurveTo(x - 4, y - 4, x + 2, y + 3); g.moveTo(x + 13, y - 11); g.quadraticCurveTo(x + 8, y - 4, x + 9, y + 2); g.stroke();
    K.oval(g, x - 7, y - 17, 4, 1.8, 'rgba(255,255,255,.3)');
  };

  // 침대 — bed1 작은 나무 침대, bed2 포근한 퀼트 침대, bed3 구름 머리판
  furn.bed = (g, C) => {
    const L = LEN(C), Wd = WID(C), sp = SP(C), c = C.c, kind = C.f;
    K.shadow(g, C, 0.95);
    const wood = kind === 'bed3' ? '#e8eef6' : kind === 'bed2' ? '#e2b48a' : WOOD;
    // 머리판 — s = 0..2.5 의 세운 판, 위가 둥글다
    const top = t => kind === 'bed3' ? 30 + 3 * Math.abs(Math.sin(t / Wd * Math.PI * 3)) : kind === 'bed2' ? 28 + 6 * Math.sin(t / Wd * Math.PI) : 30;
    const panel = s => { const pts = [sp(s, 0, 0)]; for (let t = 0; t <= Wd; t += 1) pts.push(sp(s, t, top(t))); pts.push(sp(s, Wd, 0)); return pts; };
    K.poly(g, panel(0), shade(wood, -0.25), true);
    const pf = panel(2.5), t0 = sp(2.5, 0, 34), b0 = sp(2.5, 0, 0);
    K.poly(g, pf, K.lin(g, 0, t0[1], 0, b0[1], [shade(wood, 0.15), shade(wood, -0.12)]), true);
    if (kind === 'bed1'){ const h = sp(2.5, Wd / 2, 22); g.fillStyle = shade(wood, -0.4); g.beginPath(); g.moveTo(h[0], h[1] + 2.4); g.bezierCurveTo(h[0] - 3.4, h[1], h[0] - 1.6, h[1] - 3, h[0], h[1] - 1.2); g.bezierCurveTo(h[0] + 1.6, h[1] - 3, h[0] + 3.4, h[1], h[0], h[1] + 2.4); g.fill(); }
    if (kind === 'bed3') for (let t = 3; t < Wd; t += 6){ const p = sp(2.5, t, top(t) - 3); K.oval(g, p[0], p[1], 2.4, 1.6, 'rgba(255,255,255,.7)'); }
    if (kind === 'bed2') for (let t = 4; t < Wd - 2; t += 6){ const p = sp(2.5, t, 18); K.oval(g, p[0], p[1], 1.2, 1.2, acc(C)); }
    [[3, Wd - 0.5], [L - 1, Wd - 0.5]].forEach(p => scyl(g, C, p[0], p[1], 1, 0, 2.4, shade(wood, -0.2), { noTop: true }));
    sbox(g, C, 2.5, 0.5, L - 0.5, Wd - 0.5, 2, 10, wood);                                           // 침대 틀
    sbox(g, C, 3, 1, L - 1, Wd - 1, 10, 14, CREAM, { ink: false });                                   // 매트리스
    // 베개
    sbox(g, C, 3.6, 2.6, 10, Wd - 2.6, 14, 16.8, '#efe8dc', { top: '#ffffff' });
    // 이불 — 두툼하게, 접힌 흰 단
    const q0 = 12;
    sbox(g, C, q0, 0.6, L - 0.6, Wd - 0.6, 7, 16, c, { top: shade(c, 0.12) });
    // 접힌 흰 단 — 윗면 띠와 옆으로 흘러내린 띠
    const fold = [sp(q0, 0.6, 16.05), sp(q0 + 3.5, 0.6, 16.05), sp(q0 + 3.5, Wd - 0.6, 16.05), sp(q0, Wd - 0.6, 16.05)];
    K.poly(g, fold, '#fffaf2', 0.4);
    K.poly(g, [sp(q0, Wd - 0.6, 16.05), sp(q0 + 3.5, Wd - 0.6, 16.05), sp(q0 + 3.5, Wd - 0.6, 7), sp(q0, Wd - 0.6, 7)], '#f2ebe0', 0.4);
    // 무늬
    if (kind === 'bed2') for (let s = q0 + 6; s < L - 2; s += 6) for (let t = 3; t < Wd - 1; t += 6){ const p = sp(s, t, 16); g.fillStyle = shade(c, -0.25); g.beginPath(); g.moveTo(p[0], p[1] + 1.2); g.bezierCurveTo(p[0] - 1.8, p[1], p[0] - 0.8, p[1] - 1.5, p[0], p[1] - 0.5); g.bezierCurveTo(p[0] + 0.8, p[1] - 1.5, p[0] + 1.8, p[1], p[0], p[1] + 1.2); g.fill(); }
    else if (kind === 'bed3') for (let s = q0 + 5; s < L - 2; s += 7) for (let t = 4; t < Wd - 1; t += 8){ const p = sp(s, t, 16); K.oval(g, p[0], p[1], 2.4, 1.1, '#ffffff'); K.oval(g, p[0] + 1.4, p[1] - 0.6, 1.4, 0.9, '#ffffff'); }
    else { const a = sp(L - 8, 0.6, 16), b = sp(L - 8, Wd - 0.6, 16), d = sp(L - 8, Wd - 0.6, 7); K.line(g, a, b, acc(C), 1.6); K.line(g, b, d, acc(C), 1.6); }
    sbox(g, C, L - 2, 0.5, L - 0.2, Wd - 0.5, 0, 15, wood);                                           // 발판
  };

  // 이층 침대 — 기둥 넷, 아래·위 매트리스, 사다리, 위층 난간
  furn.bunk = (g, C) => {
    const L = LEN(C), Wd = WID(C), sp = SP(C), w = WOOD;
    K.shadow(g, C, 0.95);
    const post = (s, t) => scyl(g, C, s, t, 1.5, 0, 70, w);
    post(1.5, 1.5); post(L - 1.5, 1.5);
    const deck = (z, col) => {
      sbox(g, C, 1, 1, L - 1, Wd - 1, z, z + 5, w);
      sbox(g, C, 2, 2, L - 2, Wd - 2, z + 5, z + 9, CREAM, { ink: false });
      sbox(g, C, 2.6, 3.4, 8.6, Wd - 3.4, z + 9, z + 11.4, '#efe8dc', { top: '#ffffff' });
      sbox(g, C, 13, 1.6, L - 2, Wd - 1.6, z + 5, z + 11, col, { top: shade(col, 0.15) });
      K.poly(g, [sp(13, 1.6, z + 11.05), sp(15.5, 1.6, z + 11.05), sp(15.5, Wd - 1.6, z + 11.05), sp(13, Wd - 1.6, z + 11.05)], '#fffaf2', 0.4);
    };
    deck(6, '#f2a6b8'); deck(40, '#8fd0bf');
    post(1.5, Wd - 1.5); post(L - 1.5, Wd - 1.5);
    // 위층 난간 — 앞 긴 면
    [53, 58].forEach(z => sbox(g, C, 1.5, Wd - 2, L - 13, Wd - 1, z, z + 1.6, w));
    for (let s = 6; s < L - 13; s += 6) sbox(g, C, s, Wd - 1.8, s + 1, Wd - 1, 46, 58, w);
    // 사다리
    [L - 11, L - 4].forEach(s => sbox(g, C, s, Wd - 0.6, s + 1.2, Wd + 0.6, 0, 58, shade(w, 0.08)));
    for (let z = 10; z < 56; z += 9) sbox(g, C, L - 11, Wd - 0.2, L - 2.8, Wd + 0.6, z, z + 1.4, shade(w, 0.12));
  };

  // 고양이 집 — 등나무 바구니에 폭신한 방석
  furn.catbed = (g, C) => {
    const x = C.CX, y = C.CY - 1, c = C.c;
    K.shadow(g, C, 0.8);
    K.oval(g, x, y + 1, 15, 8, shade(c, -0.35), true);
    g.beginPath(); g.ellipse(x, y - 4, 15, 8, 0, 0, Math.PI); g.lineTo(x - 15, y + 1); g.ellipse(x, y + 1, 15, 8, 0, Math.PI, 0, true); g.closePath();
    g.fillStyle = K.lin(g, x - 15, 0, x + 15, 0, [shade(c, -0.1), shade(c, 0.12), shade(c, -0.3)]); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.4; for (let a = 0.15; a < Math.PI; a += 0.22){ const px = x + Math.cos(a) * 15; g.beginPath(); g.moveTo(px, y - 4 + Math.sin(a) * 8); g.lineTo(px, y + 1 + Math.sin(a) * 8); g.stroke(); }
    K.oval(g, x, y - 4, 15, 8, K.rad(g, x, y - 6, 15, [shade(c, 0.25), c]), true);
    K.oval(g, x, y - 4.4, 11.4, 5.6, K.rad(g, x - 2, y - 6, 12, ['#fff6f2', '#f6d2cc', '#e8b0aa']), true);
    for (let i = 0; i < 6; i++){ const a = i / 6 * TAU; K.oval(g, x + Math.cos(a) * 6, y - 4.4 + Math.sin(a) * 2.6, 1, 0.6, 'rgba(255,255,255,.6)'); }
  };

  // 고양이 타워 — 삼끈 기둥, 카펫 층, 숨는 집, 매달린 방울
  furn.cattower = (g, C) => {
    const c = C.c, rope = '#c8a46c';
    K.shadow(g, C, 0.9);
    K.box(g, C, 1, 1, 23, 23, 0, 4, c);
    K.box(g, C, 11, 2, 22, 13, 4, 20, shade(c, -0.08));                                                // 숨는 집
    K.face(g, C, 'L', 11, 13, 20); K.oval(g, 5.5, 8, 3.4, 3.8, '#3a2a22', true); g.restore();
    const post = (a, b, z0, z1) => { K.cyl(g, C, a, b, 2.4, z0, z1, rope, { noTop: true }); for (let z = z0 + 1.5; z < z1; z += 1.6){ const p = C.P(a, b, z); K.line(g, [p[0] - 2.3, p[1] + 0.3], [p[0] + 2.3, p[1] - 0.3], 'rgba(110,70,30,.4)', 0.35); } };
    post(6, 7, 4, 70);
    K.box(g, C, 1, 6, 13, 21, 24, 27, c);
    post(16, 16, 20, 46);
    K.box(g, C, 9, 2, 23, 15, 44, 47, c);
    const s = C.P(20, 10, 44), e = [s[0], s[1] + 12]; K.line(g, s, e, '#8a7b6e', 0.4); K.oval(g, e[0], e[1] + 1.6, 1.8, 1.8, K.rad(g, e[0] - 0.6, e[1] + 1, 2.4, ['#ffd0dc', '#f28aa8']), 0.35);
    K.cyl(g, C, 6, 7, 8, 66, 70, c, { top: K.rad(g, C.P(6, 7, 70)[0], C.P(6, 7, 70)[1], 9, [shade(c, 0.3), shade(c, 0.1)]) });
  };

  // 의자 — 북유럽 나무 의자(살 등받이)와 방 빛깔 방석. 짝수 돌림은 등이 오른쪽 벽 쪽(ay 작은 쪽)
  furn.chair = (g, C) => {
    const odd = C.rot % 2, m = (a, b) => odd ? [b, a] : [a, b], w = WOOD;
    const B = (a0, b0, a1, b1, z0, z1, col) => { const p = m(a0, b0), q = m(a1, b1); K.box(g, C, Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), z0, z1, col); };
    K.shadow(g, C, 0.7);
    const legs = [[6, 6], [18, 6], [6, 18], [18, 18]];
    legs.slice(0, 2).forEach(l => { const p = m(l[0], l[1]); K.cyl(g, C, p[0], p[1], 1, 0, 37, w, { noTop: true }); });
    // 등받이 살
    for (let a = 9; a <= 15; a += 3){ const p = m(a, 6); K.cyl(g, C, p[0], p[1], 0.6, 20, 34, shade(w, 0.08), { noTop: true }); }
    B(5, 5, 19, 7, 33, 37.5, w);
    legs.slice(2).forEach(l => { const p = m(l[0], l[1]); K.cyl(g, C, p[0], p[1], 1, 0, 18, w, { noTop: true }); });
    B(4.5, 4.5, 19.5, 19.5, 17, 20, w);
    const p = C.P(...m(12, 13), 21.5); K.oval(g, p[0], p[1], 9.5, 4.6, K.rad(g, p[0] - 2, p[1] - 1.5, 10, [shade(acc(C), 0.3), acc(C), shade(acc(C), -0.25)]), true);
    K.oval(g, p[0], p[1] - 0.3, 0.8, 0.5, shade(acc(C), -0.35));
  };

  // 방석 — 둥글게 부푼 단추 방석, 귀퉁이 술
  furn.cushion = (g, C) => {
    const x = C.CX, y = C.CY - 2, c = C.c;
    K.shadow(g, C, 0.75);
    K.oval(g, x, y + 2, 14, 7, shade(c, -0.3), true);
    K.oval(g, x, y - 1, 14, 7, K.rad(g, x - 4, y - 4, 16, [shade(c, 0.35), c, shade(c, -0.15)]), true);
    g.strokeStyle = shade(c, -0.25); g.lineWidth = 0.45;
    for (let i = 0; i < 8; i++){ const a = i / 8 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * 2, y - 1 + Math.sin(a)); g.quadraticCurveTo(x + Math.cos(a + 0.3) * 8, y - 1 + Math.sin(a + 0.3) * 4, x + Math.cos(a) * 12.5, y - 1 + Math.sin(a) * 6); g.stroke(); }
    K.oval(g, x, y - 1, 1.6, 1, shade(c, -0.4));
    [[-13, 1], [13, 1], [0, 7.2]].forEach(d => { K.line(g, [x + d[0], y + d[1]], [x + d[0] * 1.08, y + d[1] + 3], '#f2c450', 1); K.oval(g, x + d[0] * 1.08, y + d[1] + 3.4, 0.9, 1.2, '#e8a830'); });
  };

  // 책상 — 서랍장 한쪽, 위에 책·연필꽂이·스탠드
  furn.desk = (g, C) => {
    const L = LEN(C), Wd = WID(C), sp = SP(C), w = C.c;
    K.shadow(g, C, 0.95);
    [[2.5, 3.5], [2.5, Wd - 2]].forEach(p => scyl(g, C, p[0], p[1], 1.1, 0, 28, shade(w, -0.1), { noTop: true }));
    sbox(g, C, L - 15, 3, L - 1.5, Wd - 1.5, 0, 28, w);
    longFace(g, C, Wd - 1.5, 28);
    for (let k = 0; k < 3; k++){ const x0 = C.E >= C.D ? L - 14.3 : 1.5 + 0.7, y0 = 1.5 + k * 8.6; K.rr(g, x0, y0, 12.4, 7.4, 0.8, shade(w, 0.06), true); K.rr(g, x0 + 4.2, y0 + 3, 4, 1.4, 0.6, '#c9a050'); }
    g.restore();
    sbox(g, C, 0.5, 1.5, L - 0.5, Wd - 0.5, 28, 31.5, shade(w, 0.08));
    // 위 — 책 둘, 연필꽂이, 공책, 작은 스탠드
    sbox(g, C, 4, 5, 12, 12, 31.5, 33.5, '#5aa9e6'); sbox(g, C, 5, 5.5, 12.5, 11.5, 33.5, 35.2, '#f2707d');
    const pc = sp(L - 6, 6, 31.5); K.cyl(g, C, ...(C.E >= C.D ? [L - 6, 6] : [6, L - 6]), 2.2, 31.5, 37, acc(C));
    ['#ffd166', '#6cc7b3', '#c49af0'].forEach((cc, i) => K.line(g, [pc[0] - 1 + i, pc[1] - 5.5], [pc[0] - 1.6 + i * 1.6, pc[1] - 10], cc, 0.9));
    K.quad(g, C, [[16, 11, 31.6], [26, 10, 31.6], [27, 17, 31.6], [17, 18, 31.6]].map(p => C.E >= C.D ? p : [p[1], p[0], p[2]]), '#ffffff', 0.4);
    for (let k = 0; k < 3; k++){ const a = sp(18, 12.5 + k * 1.5, 31.7), b = sp(25, 11.8 + k * 1.5, 31.7); K.line(g, a, b, 'rgba(90,120,170,.5)', 0.3); }
  };

  // 인형의 집 — 팔루 빨강 작은 집, 흰 창틀, 눈 얹은 지붕
  furn.dollhouse = (g, C) => {
    const wallc = mix(C.c, '#c44a3a', 0.6), roofc = '#4a3a3c';
    K.shadow(g, C, 0.85);
    K.box(g, C, 1, 3, 23, 21, 0, 5, WOOD);
    K.box(g, C, 3, 5, 21, 19, 5, 32, wallc);
    K.face(g, C, 'L', 3, 19, 32);
    [[2.5, 6], [11, 6]].forEach(p => { K.rr(g, p[0], p[1], 5, 6, 0.4, '#fff7e0', true); K.rr(g, p[0] + 0.8, p[1] + 0.8, 3.4, 4.4, 0.2, '#ffd98a'); g.fillStyle = '#ffffff'; g.fillRect(p[0] + 2.3, p[1] + 0.8, 0.5, 4.4); g.fillRect(p[0] + 0.8, p[1] + 2.8, 3.4, 0.5); });
    K.rr(g, 7, 15, 4.6, 12, 0.6, '#ffffff', true); K.rr(g, 7.7, 15.7, 3.2, 11.3, 0.4, '#5a8a6a'); K.oval(g, 10.2, 21.5, 0.4, 0.4, '#f2d27a');
    g.restore();
    K.face(g, C, 'R', 21, 19, 32); K.rr(g, 4.5, 6, 5, 6, 0.4, '#fff7e0', true); K.rr(g, 5.3, 6.8, 3.4, 4.4, 0.2, '#ffd98a'); g.restore();
    // 지붕 — 용마루는 ax 를 따라
    const zr = 46, ze = 30, bm = 12;
    K.quad(g, C, [[2, 3.5, ze], [22, 3.5, ze], [22, bm, zr], [2, bm, zr]], shade(roofc, -0.2), true);
    K.quad(g, C, [[21, 5, 32], [21, 19, 32], [21, bm, zr - 1]], shade(wallc, -0.15), true);
    const a = C.P(2, bm, zr), b = C.P(2, 20.5, ze);
    K.quad(g, C, [[2, bm, zr], [22, bm, zr], [22, 20.5, ze], [2, 20.5, ze]], K.lin(g, 0, a[1], 0, b[1], [shade(roofc, 0.15), roofc]), true);
    K.quad(g, C, [[2, bm, zr + 1], [22, bm, zr + 1], [22, 15, zr - 6], [2, 15, zr - 6]], '#f6faff');
    K.box(g, C, 6, 7, 9, 10, 40, 50, '#8a8890');
  };

  // 서랍장 — 칠한 나무에 장미 그림(로즈말링), 위에 꽃병
  furn.drawer = (g, C) => {
    const w = C.c;
    K.shadow(g, C, 0.8);
    [[4, 6], [20, 6], [4, 19], [20, 19]].forEach(p => K.cyl(g, C, p[0], p[1], 1, 0, 3, WOODD, { noTop: true }));
    K.box(g, C, 2, 4, 22, 20, 3, 34, w);
    K.face(g, C, 'L', 2, 20, 33);
    for (let k = 0; k < 3; k++){ K.rr(g, 1.2, 1.2 + k * 9.8, 17.6, 8.6, 0.8, shade(w, 0.08), true); [5, 14].forEach(x => K.oval(g, x, 5.5 + k * 9.8, 1, 1, '#c9a050', 0.3)); }
    [[9.5, 5.6]].forEach(p => { K.oval(g, p[0], p[1], 2, 1.6, acc(C)); K.oval(g, p[0] - 2.8, p[1] + 0.6, 1.4, 0.7, '#6f9a5a'); K.oval(g, p[0] + 2.8, p[1] + 0.6, 1.4, 0.7, '#6f9a5a'); K.oval(g, p[0], p[1], 0.7, 0.6, '#ffe08a'); });
    g.restore();
    const v = C.P(14, 11, 34); K.lathe(g, v[0], v[1], 7, d => 1.6 + 1.6 * Math.sin(Math.PI * Math.min(1, d / 6)), '#6cc7b3');
    [[-2, -12, '#ff8fa8'], [1.5, -13, '#ffd166'], [0, -10.5, '#ffffff']].forEach(f => { K.line(g, [v[0], v[1] - 6], [v[0] + f[0], v[1] + f[1]], '#5f8a55', 0.4); K.oval(g, v[0] + f[0], v[1] + f[1], 1.5, 1.5, f[2], 0.3); });
    K.box(g, C, 4, 7, 10, 12, 34, 35.5, '#5aa9e6');
  };

  // 화장대 — 다리 넷, 서랍 하나, 세운 타원 거울, 향수병·리본
  furn.dresser = (g, C) => {
    const w = C.c;
    K.shadow(g, C, 0.75);
    const mp = C.P(12, 7.5, 36);
    K.rr(g, mp[0] - 1.2, mp[1] + 6, 2.4, 6, 0.6, shade(w, -0.2));
    K.oval(g, mp[0], mp[1], 7.4, 9.4, K.lin(g, mp[0] - 7, 0, mp[0] + 7, 0, [shade(w, 0.2), shade(w, -0.2)]), true);
    K.oval(g, mp[0], mp[1], 5.6, 7.6, K.lin(g, mp[0] - 5, mp[1] - 7, mp[0] + 5, mp[1] + 7, ['#e8f4fc', '#a9c6dc', '#7f9fba']));
    g.save(); g.beginPath(); g.ellipse(mp[0], mp[1], 5.6, 7.6, 0, 0, TAU); g.clip(); g.fillStyle = 'rgba(255,255,255,.5)'; K.path(g, [[mp[0] - 4, mp[1] - 8], [mp[0] - 1, mp[1] - 8], [mp[0] - 6, mp[1] + 8], [mp[0] - 9, mp[1] + 8]]); g.fill(); g.restore();
    [[3, 6], [21, 6], [3, 20], [21, 20]].forEach(p => K.cyl(g, C, p[0], p[1], 0.9, 0, 22, shade(w, -0.12), { noTop: true }));
    K.box(g, C, 2, 5, 22, 21, 17, 24, w);
    K.face(g, C, 'L', 2, 21, 23); K.rr(g, 4, 1.5, 12, 4.4, 0.6, shade(w, 0.08), true); K.oval(g, 10, 3.7, 0.9, 0.9, '#c9a050'); g.restore();
    const b1 = C.P(6, 15, 24); K.lathe(g, b1[0], b1[1], 4, d => d < 3 ? 1.6 : 0.6, '#f7a8bf'); K.oval(g, b1[0], b1[1] - 4.8, 0.9, 0.9, '#ffd166');
    const b2 = C.P(9, 17, 24); K.lathe(g, b2[0], b2[1], 5, d => d < 3.5 ? 1.2 : 0.5, '#a9c8ff');
    const rb = C.P(17, 15, 24); K.oval(g, rb[0] - 1.6, rb[1] - 0.6, 1.6, 1, acc(C)); K.oval(g, rb[0] + 1.6, rb[1] - 0.6, 1.6, 1, acc(C)); K.oval(g, rb[0], rb[1] - 0.6, 0.7, 0.7, shade(acc(C), -0.3));
  };

  // 이젤 — 세 다리, 캔버스엔 오로라 그림, 다리에 기댄 팔레트
  furn.easel = (g, C) => {
    const w = C.c;
    K.shadow(g, C, 0.7);
    K.line(g, C.P(12, 4, 0), C.P(12, 10, 54), shade(w, -0.2), 1.6);
    K.face(g, C, 'L', 3, 15, 50);
    const W0 = 18, H0 = 22;
    K.rr(g, -0.6, -0.6, W0 + 1.2, H0 + 1.2, 0.4, '#e8dcc6', true);
    g.fillStyle = K.lin(g, 0, 0, 0, H0, ['#0b1a3c', '#1d4a6a', '#2a5a7a']); g.fillRect(0, 0, W0, H0);
    g.save(); g.globalCompositeOperation = 'lighter'; [['120,255,190', 7], ['90,200,255', 10]].forEach(([c, yy]) => { for (let x = 0; x < W0; x += 0.7){ const b = yy + 2.4 * Math.sin(x * 0.45); g.fillStyle = 'rgba(' + c + ',.35)'; g.fillRect(x, b - 5, 0.6, 5); } }); g.restore();
    K.poly(g, [[0, H0 - 5], [5, H0 - 10], [9, H0 - 6], [13, H0 - 11], [18, H0 - 5], [18, H0], [0, H0]], '#e8f0fa');
    K.poly(g, [[0, H0 - 3], [W0, H0 - 4], [W0, H0], [0, H0]], '#c8d8ec');
    for (let i = 0; i < 6; i++) K.oval(g, hash(i * 3) * W0, hash(i * 7) * H0 * 0.5, 0.3, 0.3, '#ffffff');
    g.restore();
    K.line(g, C.P(4, 18, 0), C.P(6, 15, 52), w, 1.6); K.line(g, C.P(20, 18, 0), C.P(18, 15, 52), w, 1.6);
    const tr = C.P(3, 16, 28); const tr2 = C.P(21, 16, 28); K.line(g, tr, tr2, shade(w, -0.1), 2.2);
    const p = C.P(20, 20, 3); g.save(); g.translate(p[0], p[1]); g.rotate(-0.3);
    K.oval(g, 0, -4, 6, 4, '#d9b080', true); K.oval(g, 2.6, -3, 1, 1, '#3a2a22');
    ['#ff6b7a', '#ffd166', '#5aa9e6', '#6cc7b3', '#ffffff'].forEach((c, i) => K.oval(g, -3.6 + i * 1.6, -5.2 + (i % 2) * 1.6, 0.9, 0.8, c));
    g.restore();
  };

  // 선풍기 — 둥근 받침, 대, 철망 안에 날개 셋
  furn.fan = (g, C) => {
    const c = C.c, x = C.CX, cy = C.CY - 40;
    K.shadow(g, C, 0.55);
    K.cyl(g, C, 12, 12, 7, 0, 2.4, c);
    K.cyl(g, C, 12, 12, 1, 2.4, 32, shade(c, -0.1), { noTop: true });
    K.oval(g, x + 1.5, cy + 6, 3.4, 3, shade(c, -0.15), true);
    g.save(); g.translate(x, cy); g.rotate(-0.12); g.scale(0.82, 1);
    K.oval(g, 0, 0, 11, 11, 'rgba(200,220,232,.25)', true);
    for (let i = 0; i < 3; i++){ g.save(); g.rotate(i * TAU / 3 + 0.4); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(3.5, -2, 7, -8, 2, -9.5); g.bezierCurveTo(-1.5, -9, -2, -4, 0, 0); g.fillStyle = 'rgba(127,196,236,.75)'; g.fill(); g.strokeStyle = 'rgba(60,110,150,.6)'; g.lineWidth = 0.4; g.stroke(); g.restore(); }
    K.oval(g, 0, 0, 2.2, 2.2, K.rad(g, -0.6, -0.6, 2.6, ['#ffffff', c, shade(c, -0.25)]), true);
    g.strokeStyle = 'rgba(140,155,165,.9)'; g.lineWidth = 0.35;
    for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 2.4, Math.sin(a) * 2.4); g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); g.stroke(); }
    [5.5, 8.5, 11].forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); });
    g.lineWidth = 0.9; g.strokeStyle = shade(c, -0.15); g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.stroke();
    g.restore();
  };

  // 벽난로 — 돌 쌓은 몸, 나무 선반, 아치 안에 장작불(움직인다). lit 이면 불과 아치 속 빛만
  furn.fire = (g, C) => {
    const L = LEN(C), Wd = WID(C), t = C.t / 1000, front = Wd - 2, AW = 18, AX = (L - AW) / 2, AZ = 24;
    const flames = () => {
      longFace(g, C, front, AZ);
      g.save(); K.path(g, archPts(AX, AW, AZ)); g.clip();
      g.fillStyle = K.rad(g, AX + AW / 2, AZ - 2, 16, ['rgba(255,190,90,.95)', 'rgba(255,120,40,.5)', 'rgba(80,20,10,0)']); g.fillRect(AX, 0, AW, AZ);
      // 장작
      K.rr(g, AX + 3, AZ - 4, AW - 6, 2.6, 1.2, '#5a3020'); K.rr(g, AX + 5, AZ - 5.6, AW - 8, 2.4, 1.2, '#6f3c24');
      for (let i = 0; i < 4; i++){
        const fx = AX + 4.5 + i * 3.2, fh = 9 + 4 * Math.sin(t * 7 + i * 1.7) + 2 * Math.sin(t * 13 + i), sw = 1.6 * Math.sin(t * 5 + i * 2.3), bw = 2.4 + (i % 2);
        g.beginPath(); g.moveTo(fx - bw, AZ - 4); g.bezierCurveTo(fx - bw, AZ - 4 - fh * 0.5, fx + sw - 0.6, AZ - 4 - fh * 0.8, fx + sw, AZ - 4 - fh); g.bezierCurveTo(fx + sw + 0.6, AZ - 4 - fh * 0.8, fx + bw, AZ - 4 - fh * 0.5, fx + bw, AZ - 4); g.closePath();
        g.fillStyle = K.lin(g, 0, AZ - 4 - fh, 0, AZ - 4, ['rgba(255,240,170,.9)', '#ffb030', '#ff6a1a']); g.fill();
      }
      for (let i = 0; i < 5; i++){ const ex = AX + 4 + hash(i) * (AW - 8), ey = AZ - 8 - ((t * 9 + i * 4) % 12); K.oval(g, ex + Math.sin(t * 3 + i) * 1.2, ey, 0.35, 0.35, '#ffd27a'); }
      for (let i = 0; i < 6; i++) K.oval(g, AX + 4 + i * 2, AZ - 2.2, 1, 0.6, i % 2 ? '#ff7a2a' : '#ffb84a');
      g.restore(); g.restore();
    };
    if (C.lit){ flames(); return; }
    K.shadow(g, C, 1);
    sbox(g, C, 0, 0, L, Wd, 0, 2.5, '#8a8890');                                                       // 화덕 바닥돌
    sbox(g, C, 2, 1, L - 2, front, 2.5, 42, '#a8a29a', { top: false });
    // 돌 무늬 — 앞면과 옆면
    const stones = (w, h, seed, dark) => {
      for (let row = 0, y = 0; y < h; row++, y += 5){
        for (let x = -(row % 2) * 3, k = 0; x < w; k++){ const sw = 4.5 + hash(seed + row * 17 + k * 5) * 4, c = shade('#b4aca2', (hash(seed + row * 7 + k) - 0.5) * 0.3 - dark);
          K.rr(g, x + 0.3, y + 0.3, sw - 0.6, 4.4, 1.6, K.lin(g, 0, y, 0, y + 5, [shade(c, 0.15), shade(c, -0.12)])); x += sw; }
      }
    };
    longFace(g, C, front, 42); g.save(); g.beginPath(); g.rect(2, 0, L - 4, 39.5); g.clip(); g.fillStyle = '#6a625a'; g.fillRect(0, 0, L, 40); stones(L, 40, 3, 0); g.restore();
    K.path(g, archPts(AX, AW, AZ).map(p => [p[0], p[1] + 42 - AZ])); g.fillStyle = '#1e1410'; g.fill(); g.strokeStyle = '#4a4440'; g.lineWidth = 1.6; g.stroke();
    g.restore();
    if (C.E >= C.D){ K.face(g, C, 'R', L - 2, front, 42); g.save(); g.beginPath(); g.rect(0, 0, front - 1, 39.5); g.clip(); g.fillStyle = '#5a524c'; g.fillRect(0, 0, front, 40); stones(front, 40, 9, 0.18); g.restore(); g.restore(); }
    else { K.face(g, C, 'L', 1, L - 2, 42); g.save(); g.beginPath(); g.rect(0, 0, front - 1, 39.5); g.clip(); g.fillStyle = '#7a726a'; g.fillRect(0, 0, front, 40); stones(front, 40, 9, -0.05); g.restore(); g.restore(); }
    flames();
    sbox(g, C, 0.5, 0.2, L - 0.5, Wd - 0.6, 40, 44.5, WOOD);                                        // 나무 선반
    // 선반 위 — 촛대 둘, 가운데 작은 전나무 화분
    [[6, 4], [L - 6, 4]].forEach(p => { const q = SP(C)(p[0], p[1], 44.5); K.rr(g, q[0] - 0.8, q[1] - 6, 1.6, 6, 0.6, '#fff6e0', 0.3); K.oval(g, q[0], q[1] - 7, 0.7, 1.2, '#ffcf6a'); });
    const tp = SP(C)(L / 2, 4, 44.5);
    K.lathe(g, tp[0], tp[1], 3.4, () => 2.6, '#c9564a');
    for (let k = 0; k < 3; k++){ const y = tp[1] - 4 - k * 3, hw = 4.4 - k * 1.2; K.poly(g, [[tp[0], y - 4.4], [tp[0] + hw, y], [tp[0] - hw, y]], '#2f6b5c', 0.3); K.oval(g, tp[0] - hw * 0.4, y - 0.6, 0.5, 0.5, '#ffd166'); }
    K.oval(g, tp[0], tp[1] - 14, 0.9, 0.9, '#ffd166');
  };
  const archPts = (x, w, h) => { const pts = [[x, h]]; for (let a = Math.PI; a <= TAU + 0.01; a += 0.2) pts.push([x + w / 2 + Math.cos(a) * w / 2, h - 12 + Math.sin(a) * 8]); pts.push([x + w, h]); return pts; };

  // 순록 털 깔개(오로라 농장) — 다리 넷·목·짧은 꼬리 자리가 삐죽한 가죽 모양. 등줄기는 짙은 밤색, 옆구리로 갈수록 크림빛.
  //   털은 등줄기에서 바깥으로 눕고(끝쪽은 길게), 가장자리에서 삐져나온다. 크림·밤색 얼룩 몇 군데, 목엔 흰 갈기
  furn.furrug = (g, C) => {
    const L = LEN(C), Wd = WID(C), sp = SP(C), cs = L / 2, ct = Wd / 2, a = L / 2 - 3, b = Wd / 2 - 2.4, z = 1.1;
    const bump = (th, c0, w) => { let d = Math.abs(th - c0) % TAU; if (d > Math.PI) d = TAU - d; return Math.exp(-(d * d) / (w * w)); };
    // 가죽 모양 — 반지름에 다리(앞뒤 둘씩)·목·꼬리 혹을 얹고 허리는 잘록하게
    const rad = th => 0.78 + 0.5 * (bump(th, 0.85, 0.17) + bump(th, -0.85, 0.17)) + 0.46 * (bump(th, Math.PI - 0.85, 0.17) + bump(th, Math.PI + 0.85, 0.17))
      + 0.24 * bump(th, Math.PI, 0.17) + 0.14 * bump(th, 0, 0.1) - 0.12 * (bump(th, Math.PI / 2, 0.42) + bump(th, -Math.PI / 2, 0.42)) + (hash(Math.round(th * 30) + 7) - 0.5) * 0.03;
    const N = 180, ring = Array.from({ length: N }, (_, i) => { const th = i / N * TAU, r = rad(th); return [cs + a * r * Math.cos(th), ct + b * r * Math.sin(th), th]; });
    const at = zz => ring.map(q => sp(q[0], q[1], zz));
    // 그림자와 가죽 두께
    g.save(); g.translate(0.8, 1); K.poly(g, at(0), 'rgba(40,22,12,.26)'); g.restore();
    K.poly(g, at(0.2), '#6a4a30');
    const top = at(z), e0 = sp(cs, ct - b * 1.2, z), e1 = sp(cs, ct + b * 1.2, z);
    K.poly(g, top, K.lin(g, e0[0], e0[1], e1[0], e1[1], ['#fbf3e2', '#e2c8a2', '#a07450', '#6a4630', '#a07450', '#e2c8a2', '#fbf3e2']));
    g.save(); K.path(g, top); g.clip();
    // 얼룩 — 크림·밤색, 등줄기 짙은 띠
    for (let i = 0; i < 12; i++){ const s = cs + (hash(i * 5 + 1) * 2 - 1) * a * 0.75, t = ct + (hash(i * 9 + 2) * 2 - 1) * b * 0.8, q = sp(s, t, z), r = 3 + hash(i * 3) * 4.5, cr = i % 3 ? '255,248,232' : '86,56,34';
      g.save(); g.translate(q[0], q[1]); g.scale(1, 0.5); g.fillStyle = K.rad(g, 0, 0, r, ['rgba(' + cr + ',.45)', 'rgba(' + cr + ',0)']); g.fillRect(-r, -r, r * 2, r * 2); g.restore(); }
    const s0 = sp(cs - a * 0.9, ct, z), s1 = sp(cs + a * 0.85, ct, z);
    g.save(); g.globalAlpha = 0.5; K.line(g, s0, s1, '#4a3020', 3.2); g.globalAlpha = 0.6; K.line(g, s0, s1, '#3a2416', 1.4); g.restore();
    // 털 — 짧고 가늘게 촘촘히, 등줄기에서 바깥(끝쪽은 앞뒤)으로 눕는다
    for (let i = 0; i < 1500; i++){
      const s = cs + (hash(i * 3 + 1) * 2 - 1) * a * 1.15, t = ct + (hash(i * 7 + 2) * 2 - 1) * b * 1.2, sd = t >= ct ? 1 : -1, d = Math.min(1, Math.abs(t - ct) / b), ends = Math.max(0, Math.min(1, (Math.abs(s - cs) / a - 0.6) / 0.4));
      const len = 0.7 + hash(i * 11) * 0.8, ds = len * (0.5 * (1 - ends) + Math.sign(s - cs) * 0.9 * ends), dt = sd * len * 0.8 * (1 - ends * 0.6);
      const col = d < 0.18 ? '#3e2818' : d < 0.45 ? '#7a5434' : d < 0.72 ? '#c49a70' : '#f6ecd6';
      g.globalAlpha = 0.35 + hash(i * 13) * 0.35; K.line(g, sp(s, t, z), sp(s + ds, t + dt, z), hash(i * 17) > 0.75 ? shade(col, 0.3) : col, 0.3);
    }
    g.globalAlpha = 1;
    g.restore();
    K.path(g, top); g.strokeStyle = 'rgba(90,60,36,.35)'; g.lineWidth = 0.3; g.stroke();
    // 가장자리 털 — 짧게 삐져나온 끝, 둘레 빛깔을 따른다
    g.globalAlpha = 0.6;
    ring.forEach((q, i) => { if (hash(i + 300) < 0.35) return; const th = q[2] + (hash(i + 500) - 0.5) * 0.5, cx = Math.cos(th), sy = Math.sin(th), l = 0.2 + hash(i + 40) * 0.6;
      K.line(g, sp(q[0] - cx * 0.7, q[1] - sy * 0.6, z), sp(q[0] + cx * l * 1.3, q[1] + sy * l, z), Math.abs(sy) > 0.4 ? '#eadcc2' : '#b89068', 0.28); });
    g.globalAlpha = 1;
    // 목 — 흰 갈기
    for (let i = 0; i < 10; i++){ const t = ct + (hash(i + 90) * 2 - 1) * b * 0.28, s = cs - a * 0.98 + hash(i + 70) * 2.4; K.line(g, sp(s + 1.4, t, z), sp(s - 0.4, t + (t - ct) * 0.15, z), 'rgba(255,250,240,.5)', 0.3); }
  };

  // 냉장고 — 둥근 옛날 냉장고, 손잡이, 아이 그림·자석
  furn.fridge = (g, C) => {
    const c = C.c;
    K.shadow(g, C, 0.8);
    K.box(g, C, 3, 4, 21, 20, 0, 66, c, { top: shade(c, 0.25) });
    K.face(g, C, 'L', 3, 20, 66);
    K.rr(g, 0.8, 1, 16.4, 21, 2, shade(c, 0.1), true); K.rr(g, 0.8, 23, 16.4, 41, 2, shade(c, 0.06), true);
    K.rr(g, 13, 6, 1.6, 10, 0.8, '#c8d0d8', 0.35); K.rr(g, 13, 27, 1.6, 14, 0.8, '#c8d0d8', 0.35);
    K.rr(g, 2.6, 30, 8, 10, 0.3, '#ffffff', 0.35); K.oval(g, 5, 33, 1.6, 1.6, '#ffd166'); K.poly(g, [[3.4, 39], [6, 35], [9.6, 39]], '#6cc7b3'); K.oval(g, 8, 33, 1, 1.4, acc(C));
    K.oval(g, 6.6, 29.6, 1.1, 1.1, '#ff6b7a'); K.oval(g, 4, 48, 1.4, 1.4, '#5aa9e6'); K.oval(g, 9, 52, 1.2, 1.2, '#ffd166');
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(2, 3, 1, 17); g.fillRect(2, 25, 1, 37);
    g.restore();
    const j = C.P(9, 10, 66); K.lathe(g, j[0], j[1], 6, d => d < 5 ? 2.8 : 1.6, '#f2e6d0'); K.oval(g, j[0], j[1] - 6.4, 1.8, 0.8, '#c9946a', 0.3);
  };

  // 기타 — 받침대에 세운 통기타
  furn.guitar = (g, C) => {
    const x = C.CX, y = C.CY + 1, c = C.c;
    K.shadow(g, C, 0.55);
    K.line(g, [x - 6, y + 1], [x - 1, y - 12], '#3a2a22', 1); K.line(g, [x + 6, y + 1], [x + 1, y - 12], '#3a2a22', 1); K.line(g, [x, y - 2], [x, y - 30], '#3a2a22', 0.9);
    g.save(); g.translate(x, y - 4); g.rotate(-0.1);
    const body = () => { g.beginPath(); g.ellipse(0, -8, 8.4, 8, 0, 0, TAU); g.ellipse(0, -19, 6.4, 6, 0, 0, TAU); };
    body(); g.fillStyle = K.rad(g, -3, -14, 16, [shade(c, 0.35), c, shade(c, -0.3)]); g.fill();
    g.strokeStyle = shade(c, -0.5); g.lineWidth = 0.9; g.beginPath(); g.ellipse(0, -8, 8.4, 8, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(0, -19, 6.4, 6, 0, 0, TAU); g.stroke();
    K.oval(g, 0, -14, 2.6, 2.6, '#2a1c14'); g.strokeStyle = '#7a4a2a'; g.lineWidth = 0.5; g.beginPath(); g.arc(0, -14, 3.4, 0, TAU); g.stroke();
    K.rr(g, -3.4, -6.6, 6.8, 1.6, 0.6, '#3a2418');
    K.rr(g, -1.3, -50, 2.6, 36, 0.6, '#5a3a24', 0.4);
    for (let k = 0; k < 7; k++) g.fillRect(-1.3, -46 + k * 4.4, 2.6, 0.3);
    K.rr(g, -2, -55, 4, 6, 1, '#3a2418', 0.4);
    [-1, 1].forEach(d => [0, 2].forEach(k => K.oval(g, d * 2.6, -53.5 + k * 1.8, 0.7, 0.6, '#d8d0c0')));
    g.strokeStyle = 'rgba(240,235,220,.8)'; g.lineWidth = 0.18; for (let k = -1; k <= 1; k += 0.66){ g.beginPath(); g.moveTo(k, -50); g.lineTo(k, -5.8); g.stroke(); }
    g.restore();
  };

  // 해먹 — 두 나무 기둥 사이에 늘어진 줄무늬 천, 끝에 베개
  furn.hammock = (g, C) => {
    const L = LEN(C), Wd = WID(C), sp = SP(C), c = C.c, w = WOOD;
    K.shadow(g, C, 0.95);
    const stand = s => { sbox(g, C, s - 1.4, 1, s + 1.4, Wd - 1, 0, 2.2, w); scyl(g, C, s, Wd / 2, 1.4, 0, 44, w); };
    stand(2.5);
    // 천 — 뒤 끝선과 앞 끝선 사이를 띠로
    const sag = s => 30 - 14 * Math.sin(Math.PI * (s - 8) / (L - 16)), n = 16, back = [], fr = [];
    for (let i = 0; i <= n; i++){ const s = 8 + (L - 16) * i / n; back.push(sp(s, 5, sag(s) + 1.5)); fr.push(sp(s, Wd - 5, sag(s))); }
    [[sp(2.5, Wd / 2, 42), back[0]], [sp(2.5, Wd / 2, 42), fr[0]], [sp(L - 2.5, Wd / 2, 42), back[n]], [sp(L - 2.5, Wd / 2, 42), fr[n]]].forEach(l => K.line(g, l[0], l[1], '#d8c8a8', 0.5));
    for (let i = 0; i < n; i++){ K.poly(g, [back[i], back[i + 1], fr[i + 1], fr[i]], i % 2 ? shade(c, 0.15) : shade(c, -0.08)); }
    K.poly(g, back.concat(fr.slice().reverse()), null, true);
    const lip = []; for (let i = 0; i <= n; i++){ const s = 8 + (L - 16) * i / n; lip.push(sp(s, Wd - 5, sag(s) - 2.2)); }
    K.poly(g, fr.concat(lip.slice().reverse()), shade(c, -0.25), true);
    for (let i = 0; i <= n; i += 2){ const p = lip[i]; K.line(g, p, [p[0], p[1] + 2], '#f2e6c8', 0.5); }
    const pw = sp(11, Wd / 2, sag(11) + 3); K.oval(g, pw[0], pw[1], 5, 2.8, K.rad(g, pw[0] - 1, pw[1] - 1, 6, ['#ffffff', '#f2ece0']), true);
    stand(L - 2.5);
  };

  // 타일 난로(카헬오펜) — 초록 유약 타일, 쇠 아궁이 문(밤이면 불빛), 위 처마
  furn.kachel = (g, C) => {
    const c = C.c, z0 = 4, z1 = 58;
    const door = () => { K.face(g, C, 'L', 4, 20.5, 22); K.rr(g, 5, 0, 8, 10, 1, C.lit ? 'rgba(0,0,0,0)' : IRON, !C.lit); for (let k = 0; k < 3; k++) K.rr(g, 6.4, 2.4 + k * 2.6, 5.2, 1.1, 0.5, C.lit ? '#ffb84a' : '#5a2a1a'); g.restore(); };
    if (C.lit){ door(); return; }
    K.shadow(g, C, 0.9);
    [[4, 4], [20, 4], [4, 20], [20, 20]].forEach(p => K.box(g, C, p[0] - 1.4, p[1] - 1.4, p[0] + 1.4, p[1] + 1.4, 0, z0, '#6a625a'));
    K.box(g, C, 2.5, 2.5, 21.5, 21.5, z0, z1, c);
    const tiles = (side, ax, ay, sh) => {
      K.face(g, C, side, ax, ay, z1);
      for (let r = 0; r < 9; r++) for (let k = 0; k < 3; k++){ const x = k * 6.33, y = r * 6; const cc = shade(c, sh + (hash(r * 7 + k + (side === 'L' ? 0 : 50)) - 0.5) * 0.1);
        K.rr(g, x + 0.35, y + 0.35, 5.6, 5.3, 1.4, K.rad(g, x + 2, y + 2, 6, [shade(cc, 0.3), cc, shade(cc, -0.2)])); K.oval(g, x + 1.8, y + 1.5, 1, 0.5, 'rgba(255,255,255,.55)'); }
      g.restore();
    };
    tiles('L', 2.5, 21.5, 0); tiles('R', 21.5, 21.5, -0.18);
    door();
    K.box(g, C, 1.5, 1.5, 22.5, 22.5, z1, z1 + 3, shade(c, -0.2));
    K.box(g, C, 3.5, 3.5, 20.5, 20.5, z1 + 3, z1 + 7, shade(c, 0.05));
  };

  // 놀이 부엌 — 분홍 찬장, 화구 둘과 냄비, 오븐 창, 수도꼭지
  furn.kitchen = (g, C) => {
    const c = C.c;
    K.shadow(g, C, 0.8);
    K.box(g, C, 2, 5, 22, 8, 30, 46, shade(c, -0.05));                                              // 뒤판
    K.face(g, C, 'L', 2, 8, 46); K.oval(g, 6, 6, 3, 3, '#ffffff', true); K.line(g, [6, 6], [6, 4], '#3a3230', 0.4); K.line(g, [6, 6], [7.4, 6], '#3a3230', 0.4); [12, 15, 18].forEach(x => K.oval(g, x, 6, 1, 1, '#ffd166', 0.3)); g.restore();
    K.box(g, C, 2, 6, 22, 21, 0, 30, c);
    K.face(g, C, 'L', 2, 21, 30);
    K.rr(g, 2, 3, 16, 17, 1.6, shade(c, 0.1), true); K.rr(g, 4.5, 6, 11, 8, 1.4, '#3a3a48'); K.rr(g, 5.5, 7, 4, 3, 0.8, 'rgba(255,255,255,.35)');
    K.rr(g, 5, 4.2, 10, 1.2, 0.6, '#d8d0c8'); [5, 10, 15].forEach(x => K.oval(g, x, 24.5, 1, 1, '#ffffff', 0.3));
    g.restore();
    K.top(g, C, 2, 6, 22, 21, 30.4, '#fbfbf7', true);
    [[8, 11], [16, 16]].forEach(p => { const q = C.P(p[0], p[1], 30.5); K.oval(g, q[0], q[1], 3.6, 1.8, '#3a3a40'); K.oval(g, q[0], q[1], 2.4, 1.2, '#55555c'); });
    K.cyl(g, C, 16, 16, 3, 30.5, 34.5, '#9fb4c8', { top: '#c8d6e2' }); K.line(g, C.P(19, 16, 33.5), C.P(22, 15, 34), '#3a3a40', 0.8);
    const f = C.P(9, 7, 38); K.line(g, f, [f[0], f[1] + 4], '#c8d0d8', 1); K.line(g, f, [f[0] + 2.6, f[1] + 1.4], '#c8d0d8', 1);
  };

  // 고타쓰 — 낮은 탁자에 이불, 위에 귤 바구니와 찻잔
  furn.kotatsu = (g, C) => {
    const L = LEN(C), Wd = WID(C), sp = SP(C), c = C.c;
    K.shadow(g, C, 1);
    sbox(g, C, 0.5, 0.5, L - 0.5, Wd - 0.5, 0, 18, c, { top: shade(c, 0.15) });
    longFace(g, C, Wd - 0.5, 18);
    for (let s = 3; s < L - 2; s += 6) for (let z = 3; z < 17; z += 6){ const x = s + (z % 12 ? 3 : 0); K.oval(g, x, z, 1.2, 1.2, 'rgba(255,255,255,.6)'); K.oval(g, x, z, 0.4, 0.4, '#ffd166'); }
    g.fillStyle = K.lin(g, 0, 14, 0, 18, ['rgba(0,0,0,0)', 'rgba(30,16,8,.2)']); g.fillRect(0, 14, L, 4);
    g.restore();
    sbox(g, C, -0.5, -0.5, L + 0.5, Wd + 0.5, 18, 21, '#c9945e');
    const b = sp(L / 2 - 4, Wd / 2, 21); K.oval(g, b[0], b[1], 6, 3, '#a8743f', true); K.oval(g, b[0], b[1] - 0.6, 5, 2.4, '#7a4c2c');
    [[-2.4, -1.4], [1.6, -1.6], [-0.4, -2.8], [2.8, -0.2], [-3, 0.4]].forEach(o => K.oval(g, b[0] + o[0], b[1] + o[1], 1.9, 1.7, K.rad(g, b[0] + o[0] - 0.6, b[1] + o[1] - 0.6, 2.2, ['#ffc070', '#ff9a2a', '#e07a10']), 0.3));
    K.cyl(g, C, ...(C.E >= C.D ? [L - 8, Wd / 2 + 2] : [Wd / 2 + 2, L - 8]), 2, 21, 24.5, '#e8f0ea', { top: '#7a9a5a' });
  };

  // 램프 — 나무 받침, 가는 대, 주름 천 갓. 밤이면 갓이 빛난다
  furn.lamp = (g, C) => {
    const c = C.c, top = C.P(12, 12, 52), bot = C.P(12, 12, 38);
    const shadeFill = lit => {
      g.beginPath(); g.ellipse(bot[0], bot[1], 10, 4.4, 0, 0, Math.PI); g.lineTo(top[0] - 6, top[1]); g.ellipse(top[0], top[1], 6, 2.6, 0, Math.PI, 0, true); g.closePath();
      g.fillStyle = lit ? K.lin(g, bot[0] - 10, 0, bot[0] + 10, 0, ['#ffe7a0', '#fff8d8', '#ffe7a0', '#ffc860']) : K.lin(g, bot[0] - 10, 0, bot[0] + 10, 0, [shade(c, -0.05), shade(c, 0.25), c, shade(c, -0.3)]); g.fill();
      g.strokeStyle = lit ? 'rgba(200,140,60,.35)' : shade(c, -0.2); g.lineWidth = 0.35;
      for (let k = -4; k <= 4; k++){ g.beginPath(); g.moveTo(top[0] + k * 1.4, top[1] + 1); g.lineTo(bot[0] + k * 2.3, bot[1] + 3.6 - Math.abs(k) * 0.4); g.stroke(); }
    };
    if (C.lit){ K.oval(g, bot[0], bot[1] + 0.5, 9, 3.6, '#fff4c8'); shadeFill(true); return; }
    K.shadow(g, C, 0.55);
    K.cyl(g, C, 12, 12, 6, 0, 2.6, WOODD);
    K.cyl(g, C, 12, 12, 0.8, 2.6, 40, '#c9a050', { noTop: true });
    K.oval(g, bot[0], bot[1] + 0.3, 9, 3.8, '#fff2c0');
    shadeFill(false);
    g.strokeStyle = INK; g.lineWidth = LW; g.beginPath(); g.ellipse(bot[0], bot[1], 10, 4.4, 0, 0, Math.PI); g.lineTo(top[0] - 6, top[1]); g.ellipse(top[0], top[1], 6, 2.6, 0, Math.PI, 0, true); g.closePath(); g.stroke();
    K.oval(g, top[0], top[1], 6, 2.6, shade(c, 0.15), true);
  };

  // 책 더미 — 쌓은 책 넷과 위에 펼친 책
  furn.books = (g, C) => {
    K.shadow(g, C, 0.7);
    const BK = [['#5aa9e6', 3, 5, 19, 19, 0], ['#f2707d', 4, 4, 20, 17, 0], ['#ffd166', 5, 6, 18, 18, 0], ['#6cc7b3', 3.5, 5, 19, 16, 0]];
    let z = 0;
    BK.forEach(b => {
      const h = 3.6; K.box(g, C, b[1], b[2], b[3], b[4], z, z + h, b[0]);
      K.face(g, C, 'L', b[1] + 1.4, b[4], z + h - 0.6); g.fillStyle = CREAM; g.fillRect(0, 0, b[3] - b[1] - 1.4, h - 1.2); g.fillStyle = 'rgba(160,140,110,.5)'; for (let y = 0.6; y < h - 1.2; y += 0.6) g.fillRect(0, y, b[3] - b[1] - 1.4, 0.15); g.restore();
      z += h;
    });
    const o = C.P(12, 11, z); g.save(); g.translate(o[0], o[1]);
    K.poly(g, [[-9, 0], [0, 2.6], [0, -2.4], [-8.6, -4.6]], '#fffaf0', 0.4); K.poly(g, [[9, 0], [0, 2.6], [0, -2.4], [8.6, -4.6]], '#f6efe0', 0.4);
    for (let k = 0; k < 3; k++){ K.line(g, [-7, -2.6 + k * 1.1], [-1.4, -1 + k * 1.1], 'rgba(80,90,120,.45)', 0.3); K.line(g, [1.4, -1 + k * 1.1], [7, -2.6 + k * 1.1], 'rgba(80,90,120,.45)', 0.3); }
    g.restore();
  };

  // 큰 화분 — 흰 도자기 화분에 떡갈고무나무
  furn.bigplant = (g, C) => {
    const x = C.CX, y = C.CY + 2;
    K.shadow(g, C, 0.6);
    K.lathe(g, x, y, 16, d => 6 + d * 0.18, '#f2ece2');
    g.fillStyle = 'rgba(80,110,150,.55)'; g.fillRect(x - 8, y - 11, 16, 1.2);
    K.oval(g, x, y - 16, 8.8, 2.6, '#5a3a24', true);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 16); g.quadraticCurveTo(x - 1, y - 34, x + 1, y - 54); g.stroke();
    const leaves = []; for (let i = 0; i < 15; i++){ const yy = y - 22 - i * 2.4, s = i % 2 ? 1 : -1; leaves.push([x + s * (4 + hash(i * 3) * 4) * (1 - i / 22), yy - hash(i) * 2, s * (0.5 + hash(i * 5) * 0.5), 4.2 + hash(i * 7) * 1.6, i]); }
    leaves.forEach(l => {
      g.save(); g.translate(l[0], l[1]); g.rotate(l[2]);
      g.beginPath(); g.ellipse(0, -l[3], l[3] * 0.62, l[3], 0, 0, TAU); g.fillStyle = K.lin(g, -3, -l[3] * 2, 3, 0, ['#8cc46e', '#4f9e57', '#2f6e3c']); g.fill(); g.strokeStyle = 'rgba(30,60,30,.6)'; g.lineWidth = 0.4; g.stroke();
      K.line(g, [0, 0], [0, -l[3] * 1.8], 'rgba(220,240,180,.5)', 0.3);
      g.restore();
    });
  };

  // 블록 성 — 쌓은 나무 블록, 원통 탑 둘에 고깔 지붕과 깃발
  furn.blocks = (g, C) => {
    K.shadow(g, C, 0.85);
    K.box(g, C, 3, 6, 21, 20, 0, 6, '#5aa9e6');
    K.box(g, C, 4, 7, 11, 19, 6, 14, '#ffd166'); K.box(g, C, 13, 7, 20, 19, 6, 14, '#6cc7b3');
    K.face(g, C, 'L', 4, 19, 14); K.path(g, archPts(1.5, 4, 8)); g.fillStyle = '#3a2a22'; g.fill(); g.restore();
    K.box(g, C, 5, 8, 19, 18, 14, 18, C.c);
    [[6.5, 11], [17.5, 11]].forEach((p, i) => {
      K.cyl(g, C, p[0], p[1], 3.2, 18, 26, i ? '#f2a6c8' : '#c49af0');
      const tp = C.P(p[0], p[1], 26); K.poly(g, [[tp[0] - 3.6, tp[1]], [tp[0], tp[1] - 8], [tp[0] + 3.6, tp[1]]], i ? '#f2707d' : '#5aa9e6', true);
      if (i){ K.line(g, [tp[0], tp[1] - 8], [tp[0], tp[1] - 12], '#5a4a3a', 0.4); K.poly(g, [[tp[0], tp[1] - 12], [tp[0] + 3, tp[1] - 11], [tp[0], tp[1] - 10]], '#ffd166'); }
    });
    for (let a = 8; a < 16; a += 3) K.box(g, C, a, 17, a + 1.6, 18, 18, 20, C.c);
  };

  // ================= 벽에 거는 것 (앞 절반) =================
  // 못과 걸이줄
  const hang = (g, x, top, half) => { if (half) { K.line(g, [x, top], [x - half, top + 5], '#8a7b6e', 0.4); K.line(g, [x, top], [x + half, top + 5], '#8a7b6e', 0.4); } K.oval(g, x, top, 0.9, 0.9, '#5a4a40'); };
  const woodFrame = (g, x, y, w, h, col, t) => {
    K.rr(g, x, y, w, h, 1, K.lin(g, x, y, x + w, y + h, [shade(col, 0.25), col, shade(col, -0.3)]), true);
    K.rr(g, x + t, y + t, w - 2 * t, h - 2 * t, 0.4, shade(col, -0.35));
  };

  wall.frame = (g, C) => {
    hang(g, 20, 4, 8);
    woodFrame(g, 6, 9, 28, 31, '#9a6a3c', 2.4);
    K.rr(g, 8.4, 11.4, 23.2, 26.2, 0.3, '#fff6e9');
    const x = 10.5, y = 13.5, w = 19, h = 22;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = K.lin(g, 0, y, 0, y + h, [shade(C.c, -0.1), shade(C.c, 0.3), '#fff4e0']); g.fillRect(x, y, w, h);
    K.oval(g, x + 13, y + 6, 2.4, 2.4, '#fff8e0');
    K.poly(g, [[x, y + 15], [x + 6, y + 8], [x + 10, y + 13], [x + 14, y + 9], [x + w, y + 15], [x + w, y + h], [x, y + h]], '#8fb0c8');
    K.poly(g, [[x + 4.6, y + 9.6], [x + 6, y + 8], [x + 7.4, y + 9.6]], '#ffffff');
    g.beginPath(); g.moveTo(x, y + 17); g.quadraticCurveTo(x + 10, y + 14, x + w, y + 18); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.fillStyle = '#f4f8fc'; g.fill();
    [[x + 4, y + 18, 5], [x + 7, y + 19, 4], [x + 15, y + 18, 5]].forEach(f => { K.poly(g, [[f[0], f[1] - f[2]], [f[0] + f[2] * 0.4, f[1]], [f[0] - f[2] * 0.4, f[1]]], '#2f6b5c'); K.poly(g, [[f[0], f[1] - f[2]], [f[0] + f[2] * 0.2, f[1] - f[2] * 0.6], [f[0] - f[2] * 0.25, f[1] - f[2] * 0.55]], '#ffffff'); });
    K.rr(g, x + 9, y + 16, 3, 2.4, 0.2, '#a3352b'); K.poly(g, [[x + 8.6, y + 16], [x + 10.5, y + 14.4], [x + 12.4, y + 16]], '#4a3a3c'); K.oval(g, x + 10.5, y + 17.2, 0.5, 0.5, '#ffd98a');
    g.fillStyle = 'rgba(255,255,255,.18)'; K.path(g, [[x, y], [x + 6, y], [x, y + 8]]); g.fill();
    g.restore();
  };

  wall.clock = (g, C) => {
    hang(g, 20, 4, 0);
    K.rr(g, 18.6, 30, 2.8, 12, 0.8, '#7a4c2c', true);
    const sw = Math.sin((C.t || 0) / 500) * 0.2;
    g.save(); g.translate(20, 31); g.rotate(sw); K.line(g, [0, 0], [0, 12], '#c9a050', 0.7); K.oval(g, 0, 14, 3, 3, K.rad(g, -1, 13, 4, ['#fff0b0', '#e8b84a', '#a8781a']), true); g.restore();
    K.oval(g, 20, 19, 12, 12, K.lin(g, 8, 7, 32, 31, ['#b98450', '#7a4c2c']), true);
    K.oval(g, 20, 19, 9.6, 9.6, K.rad(g, 17, 16, 12, ['#ffffff', C.c, shade(C.c, -0.1)]), true);
    for (let i = 0; i < 12; i++){ const a = i / 12 * TAU, r0 = i % 3 ? 8.2 : 7.2; K.line(g, [20 + Math.cos(a) * r0, 19 + Math.sin(a) * r0], [20 + Math.cos(a) * 8.9, 19 + Math.sin(a) * 8.9], '#3a3226', i % 3 ? 0.4 : 0.8); }
    const d = new Date(), hr = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * TAU - Math.PI / 2, mn = d.getMinutes() / 60 * TAU - Math.PI / 2;
    K.line(g, [20, 19], [20 + Math.cos(hr) * 4.6, 19 + Math.sin(hr) * 4.6], '#3a3226', 1);
    K.line(g, [20, 19], [20 + Math.cos(mn) * 7, 19 + Math.sin(mn) * 7], '#3a3226', 0.6);
    K.oval(g, 20, 19, 1, 1, '#c9646b');
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(16.5, 14.5, 4, 2, -0.6, 0, TAU); g.fill();
  };

  wall.mirror = (g, C) => {
    hang(g, 20, 3, 6);
    K.oval(g, 20, 29, 12, 19, K.lin(g, 8, 10, 32, 48, ['#e8c48a', '#b98450', '#7a4c2c']), true);
    for (let i = 0; i < 16; i++){ const a = i / 16 * TAU; K.oval(g, 20 + Math.cos(a) * 10.6, 29 + Math.sin(a) * 17.4, 0.8, 0.8, '#f2d8a8'); }
    K.oval(g, 20, 29, 9.4, 16, K.lin(g, 12, 14, 28, 44, [shade(C.c, 0.4), C.c, shade(C.c, -0.2)]), true);
    g.save(); g.beginPath(); g.ellipse(20, 29, 9.4, 16, 0, 0, TAU); g.clip();
    g.fillStyle = 'rgba(120,80,50,.25)'; g.fillRect(10, 36, 20, 10);
    g.fillStyle = 'rgba(255,255,255,.55)'; K.path(g, [[13, 12], [17, 12], [11, 46], [7, 46]]); g.fill(); K.path(g, [[19, 12], [20.5, 12], [14.5, 46], [13, 46]]); g.fill();
    g.restore();
    K.poly(g, [[16, 10.5], [20, 6.5], [24, 10.5], [20, 12]], '#c9a050', true);
  };

  wall.board = (g, C) => {
    woodFrame(g, 3, 7, 34, 36, '#9a6a3c', 2.2);
    const x = 5.2, y = 9.2, w = 29.6, h = 31.6;
    g.fillStyle = K.rad(g, x + w * 0.4, y + h * 0.4, 26, [shade(C.c, 0.12), C.c, shade(C.c, -0.25)]); g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 6; i++) g.fillRect(x + hash(i) * w * 0.7, y + hash(i * 3) * h, 8, 1.6);
    const chalk = (c, wd) => { g.strokeStyle = c; g.lineWidth = wd || 0.7; g.lineCap = 'round'; };
    chalk('#fffaf0'); g.beginPath(); g.moveTo(8, 14); g.lineTo(10, 12); g.lineTo(12, 14); g.moveTo(8.8, 13.2); g.lineTo(11.2, 13.2); g.moveTo(14, 12); g.lineTo(14, 14.4); g.quadraticCurveTo(16.5, 14.4, 14, 13); g.quadraticCurveTo(16.5, 12, 14, 12); g.moveTo(20, 12.4); g.quadraticCurveTo(17.4, 13, 18.6, 14.6); g.quadraticCurveTo(19.5, 15, 20.4, 14.2); g.stroke();
    chalk('#a8f0c8', 1); g.beginPath(); for (let xx = 8; xx < 31; xx += 1) g.lineTo(xx, 22 + 2 * Math.sin(xx * 0.5)); g.stroke();
    chalk('#c8a8f0', 0.8); g.beginPath(); for (let xx = 9; xx < 30; xx += 1) g.lineTo(xx, 25 + 1.6 * Math.sin(xx * 0.4 + 2)); g.stroke();
    chalk('#fffaf0', 0.7); g.beginPath(); g.moveTo(8, 36); g.lineTo(13, 30); g.lineTo(17, 34); g.lineTo(21, 29); g.lineTo(28, 36); g.stroke();
    g.beginPath(); g.moveTo(22, 36); g.lineTo(22, 32.4); g.lineTo(24.4, 30.6); g.lineTo(26.8, 32.4); g.lineTo(26.8, 36); g.stroke();
    chalk('#ffd8e6', 0.7); g.beginPath(); g.moveTo(30, 13.4); g.bezierCurveTo(27.6, 11.6, 28.6, 10, 30, 11.4); g.bezierCurveTo(31.4, 10, 32.4, 11.6, 30, 13.4); g.stroke();
    K.rr(g, 3, 42, 34, 3.4, 1, K.lin(g, 0, 42, 0, 45.4, ['#d6a878', '#9a6a3c']), true);
    K.rr(g, 8, 41, 5, 1.6, 0.8, '#ffffff'); K.rr(g, 16, 41.2, 3.4, 1.4, 0.7, '#ffd6e6'); K.rr(g, 24, 41.6, 6, 2.4, 0.8, '#c8b8a8');
  };

  wall.garland = (g, C) => {
    const pc = ['#ffd166', '#8fd9c8', '#ffb7d5', '#a9c8ff', '#ff9f8f'];
    for (let row = 0; row < 2; row++){
      const y0 = 9 + row * 23, n = 4 + row, sag = x => y0 + 3.4 * Math.sin(x / 40 * Math.PI);
      g.strokeStyle = '#8a6a4a'; g.lineWidth = 0.45; g.beginPath(); for (let x = 0; x <= 40; x += 1) g.lineTo(x, sag(x)); g.stroke();
      K.oval(g, 0.5, y0, 0.9, 0.9, '#5a4a40'); K.oval(g, 39.5, y0, 0.9, 0.9, '#5a4a40');
      for (let i = 0; i < n; i++){
        const x = 4 + i * (32 / (n - 0.2)), y = sag(x + 4), rot = (hash(i * 7 + row) - 0.5) * 0.3;
        g.save(); g.translate(x + 4, y + 1); g.rotate(rot);
        K.rr(g, -4, 1, 8, 10, 0.4, '#fffdf6', 0.4);
        g.fillStyle = K.lin(g, 0, 2, 0, 9, [shade(pc[(i + row) % 5], 0.3), pc[(i + row) % 5]]); g.fillRect(-3.2, 1.8, 6.4, 6.4);
        K.oval(g, -1, 5.6, 1.4, 1.4, 'rgba(255,255,255,.6)');
        K.rr(g, -0.9, -0.6, 1.8, 3, 0.4, '#c9a074');
        g.restore();
      }
    }
  };

  wall.heightbar = (g, C) => {
    K.rr(g, 13, 4, 12, 52, 2, K.lin(g, 13, 0, 25, 0, ['#fbf3e4', '#efe2c8']), true);
    for (let v = 8; v < 54; v += 2.2){ const big = Math.round((v - 8) / 2.2) % 5 === 0; K.line(g, [15, v], [15 + (big ? 6 : 3), v], big ? '#6f6257' : '#a09383', big ? 0.5 : 0.3); }
    K.rr(g, 12, 2, 14, 3.4, 1.4, C.c, true); K.rr(g, 12, 54.6, 14, 3.4, 1.4, shade(C.c, -0.15), true);
    [[20, '#f28aa8', 1], [33, '#5fb39c', -1]].forEach(([y, c, d]) => {
      K.line(g, [12.5, y], [25.5, y], c, 1);
      const x = d > 0 ? 30.5 : 7.5; K.oval(g, x, y, 4, 4, c, true); K.oval(g, x, y - 0.6, 2, 2, '#fff4f0');
      eye(g, x - 0.8, y - 0.8, 0.35); eye(g, x + 0.8, y - 0.8, 0.35);
    });
  };

  wall.medalcase = (g, C) => {
    hang(g, 20, 2, 9);
    K.rr(g, 4, 6, 32, 46, 1.4, K.lin(g, 4, 6, 36, 52, ['#7a5236', '#4a3524']), true);
    K.rr(g, 6.2, 8.2, 27.6, 41.6, 0.6, K.rad(g, 16, 22, 30, ['#4a4466', '#2e2a42']));
    (C.MEDALS || []).forEach((Md, i) => {
      const cx = 10 + (i % 4) * 6.6, cy = 12 + Math.floor(i / 4) * 9.4;
      if ((C.medals || []).indexOf(Md.id) < 0){ K.oval(g, cx, cy + 3, 0.8, 0.8, '#1e1a2c'); return; }
      K.poly(g, [[cx - 1.6, cy - 1.4], [cx + 1.6, cy - 1.4], [cx + 1.2, cy + 1.4], [cx - 1.2, cy + 1.4]], '#c9333f');
      K.oval(g, cx, cy + 3.6, 2.4, 2.4, K.rad(g, cx - 0.8, cy + 2.8, 3, [shade(Md.col, 0.5), Md.col, shade(Md.col, -0.3)]), 0.3);
      K.oval(g, cx - 0.7, cy + 2.8, 0.6, 0.5, 'rgba(255,255,255,.7)');
    });
    const n = (C.medals || []).length, all = (C.MEDALS || []).length || 1;
    K.rr(g, 7, 47.6, 26, 1.2, 0.6, '#1e1a2c'); if (n) K.rr(g, 7, 47.6, 26 * n / all, 1.2, 0.6, '#ffd25a');
    g.fillStyle = 'rgba(255,255,255,.07)'; K.path(g, [[6.2, 8.2], [16, 8.2], [6.2, 30]]); g.fill();
  };

  wall.blueplate = (g, C) => {
    const plate = (x, y, r) => {
      K.oval(g, x, y, r, r, K.rad(g, x - r * 0.3, y - r * 0.3, r * 1.3, ['#ffffff', '#f2f4f6', '#d8dee6']), true);
      g.strokeStyle = C.c; g.lineWidth = r * 0.12; g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.stroke();
      g.lineWidth = r * 0.04; g.beginPath(); g.arc(x, y, r * 0.66, 0, TAU); g.stroke();
      g.fillStyle = C.c; for (let i = 0; i < 8; i++){ g.save(); g.translate(x, y); g.rotate(i / 8 * TAU); K.oval(g, 0, -r * 0.34, r * 0.1, r * 0.24, C.c); g.restore(); }
      K.oval(g, x, y, r * 0.14, r * 0.14, '#e8b04a');
      for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; K.oval(g, x + Math.cos(a) * r * 0.76, y + Math.sin(a) * r * 0.76, r * 0.05, r * 0.05, C.c); }
      K.oval(g, x, y - r - 0.8, 0.9, 0.9, '#8a8078');
    };
    plate(20, 19, 10.5); plate(9, 42, 6.5); plate(31, 42, 6.5);
  };

  wall.cuckoo = (g, C) => {
    const c = C.c, t = (C.t || 0) / 600;
    // 솔방울 추 — 사슬 둘
    [[16, 50], [24, 54]].forEach(([x, y]) => { K.line(g, [x, 38], [x, y - 4], '#8a7b6e', 0.4); K.oval(g, x, y, 1.8, 3.6, K.lin(g, x - 2, 0, x + 2, 0, ['#8a5a30', '#5a3418']), true); for (let k = -2; k <= 2; k++) K.line(g, [x - 1.6, y + k * 1.2], [x + 1.6, y + k * 1.2 + 0.4], 'rgba(30,16,8,.5)', 0.3); });
    g.save(); g.translate(20, 38); g.rotate(Math.sin(t) * 0.25); K.line(g, [0, 0], [0, 9], '#c9a050', 0.5); K.oval(g, 0, 10, 1.6, 2, '#c9a050', 0.3); g.restore();
    K.rr(g, 9, 18, 22, 21, 1, K.lin(g, 9, 0, 31, 0, [shade(c, 0.2), c, shade(c, -0.25)]), true);
    K.poly(g, [[5, 19.5], [20, 6], [35, 19.5], [33, 21], [20, 9], [7, 21]], '#5e3a20', true);
    for (let i = 0; i < 7; i++){ const x = 8 + i * 4; K.oval(g, x, 19.5 - Math.abs(x - 20) * 0.9 + 1, 2.4, 1.4, i % 2 ? '#4f7a3a' : '#3f6a2e', 0.3); }
    K.rr(g, 16, 10.5, 8, 6, 1, '#3a2618', true); K.oval(g, 20, 13.6, 1.8, 1.6, '#ffd166'); K.poly(g, [[21.6, 13.6], [23.6, 13.2], [21.6, 14.4]], '#ff8c2e');
    K.oval(g, 20, 29, 6.4, 6.4, '#fff6e9', true);
    for (let i = 0; i < 12; i++){ const a = i / 12 * TAU; K.oval(g, 20 + Math.cos(a) * 5.2, 29 + Math.sin(a) * 5.2, 0.35, 0.35, '#3a2618'); }
    K.line(g, [20, 29], [20, 25], '#3a2618', 0.6); K.line(g, [20, 29], [23, 29.6], '#3a2618', 0.8);
    [[10.5, 35], [29.5, 35]].forEach(p => { K.oval(g, p[0], p[1], 1.6, 2.2, '#ffffff', 0.3); K.oval(g, p[0], p[1] + 2.4, 1.4, 1, '#3f6a2e'); });
  };

  // 대림절 별 등(오로라 농장) — 스웨덴·핀란드 창가에 거는 종이 별. 다섯 뿔이 접힌 두 면(빛 받는 면·그늘 면)으로 서고,
  //   뿔마다 오린 구멍(점·마름모) 사이로 속불이 샌다. 못에 건 줄, 아래 금빛 술. lit 이면 번짐·빛나는 종이·구멍만
  wall.advent = (g, C) => {
    const c = C.c || '#d94a3c', x = 20, y = 29, R = 16.5, r = 6.6, lit = C.lit, glowK = 0.85 + 0.15 * Math.sin((C.t || 0) / 1400);
    const at = (k, rr) => { const a = -Math.PI / 2 + k * TAU / 5; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; };
    const tip = k => at(k, R), inn = k => at(k + 0.5, r), lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    const star = [], base = lit ? mix(c, '#ffb468', 0.55) : c;
    for (let k = 0; k < 5; k++) star.push(tip(k), inn(k));
    if (!lit){
      hang(g, 20, 2.5, 0); K.line(g, [20, 2.5], [20, y - R + 0.5], '#8a7b6e', 0.45);
      // 아래 술 — 금실
      const bi = inn(2); K.line(g, bi, [20, 47.5], '#c9a050', 0.45); K.oval(g, 20, 47.8, 1, 1, '#e8b04a', 0.3);
      for (let k = -3; k <= 3; k++) K.line(g, [20 + k * 0.25, 48.6], [20 + k * 0.6, 54.4], k % 2 ? '#c9902a' : '#f2c860', 0.4);
      K.poly(g, star.map(q => [q[0] + 1, q[1] + 1.2]), shade(c, -0.5), true);                              // 종이 두께
    }
    if (lit) K.glow(g, x, y, 25, 'rgba(255,196,120,', 0.5 * glowK);
    else K.glow(g, x, y, 12, 'rgba(255,214,150,', 0.35);
    // 뿔 — 가운데에서 끝으로, 왼쪽 위에서 오는 빛에 따라 두 면 밝기가 다르다
    for (let k = 0; k < 5; k++){
      const T = tip(k), sides = [[inn(k - 1), -1], [inn(k), 1]];
      sides.forEach(([V, sd]) => {
        const m = [(x + T[0] + V[0]) / 3, (y + T[1] + V[1]) / 3], lgt = 0.5 + 0.5 * Math.cos(Math.atan2(m[1] - y, m[0] - x) + Math.PI * 0.75);
        const col = shade(base, lit ? -0.08 + 0.3 * lgt : -0.32 + 0.42 * lgt);
        K.poly(g, [[x, y], V, T], K.lin(g, x, y, T[0], T[1], [lit ? '#fff0c4' : shade(col, 0.22), col, shade(col, -0.08)]));
        // 오린 구멍 — 속불이 샌다
        const hole = lit ? '#fff6d2' : '#ffd79a';
        [[0.42, 0.42, 0.75], [0.62, 0.3, 0.55], [0.8, 0.18, 0.4]].forEach(([f, o, rr]) => { const q = lerp(lerp([x, y], T, f), V, o * 0.5); K.oval(g, q[0], q[1], rr, rr, hole); });
        const dm = lerp(lerp([x, y], T, 0.25), V, 0.35); K.poly(g, [[dm[0], dm[1] - 1.1], [dm[0] + 0.7, dm[1]], [dm[0], dm[1] + 1.1], [dm[0] - 0.7, dm[1]]], hole);
        if (!lit) K.poly(g, [[x, y], V, T], null, 0.3);
      });
      K.line(g, [x, y], T, lit ? 'rgba(255,250,225,.75)' : 'rgba(255,235,210,.45)', 0.4);                // 접힌 등성이
    }
    K.oval(g, x, y, 2.6, 2.6, K.rad(g, x, y, 2.6, [lit ? '#ffffff' : '#fff2d0', 'rgba(255,220,150,0)']));
    if (!lit) K.poly(g, star, null, true);
  };

  // ■ 고양이 집 위에서 몸을 말고 자는 고양이(2026-10-09) — (x, y) 가 방석 한가운데(도트). 숨 쉬듯 부풀고, 꼬리 끝이 까딱, 귀가 가끔 쫑긋, 머리 위로 z
  function cat(g, x, y, t, ph){
    const T = toneOf(ph), s = t / 1000, br = 1 + Math.sin(s * 1.6) * 0.035, body = T('#f2a65a'), dk = T('#c9803c'), lt = T('#ffd29a'), cream = T('#fff2dc');
    K.oval(g, x + 1, y + 1.5, 13, 4, 'rgba(26,20,12,.22)');
    g.save(); g.translate(x, y); g.scale(1, br);
    // 꼬리 — 몸을 빙 둘러 앞으로, 끝만 까딱
    const tip = Math.sin(s * 2.3) > 0.6 ? Math.sin(s * 14) * 1.6 : 0;
    g.strokeStyle = dk; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(8, -3); g.quadraticCurveTo(12, 3, 2, 4.2); g.quadraticCurveTo(-6, 5, -9 + tip, 2); g.stroke();
    g.strokeStyle = body; g.lineWidth = 2.2; g.beginPath(); g.moveTo(8, -3); g.quadraticCurveTo(12, 3, 2, 4.2); g.quadraticCurveTo(-6, 5, -9 + tip, 2); g.stroke();
    // 몸 — 둥근 빵, 등에 줄무늬
    K.oval(g, 1, -4, 10.5, 6.6, K.lin(g, 0, -11, 0, 2, [lt, body, dk]), true);
    g.save(); g.beginPath(); g.ellipse(1, -4, 10.5, 6.6, 0, 0, TAU); g.clip();
    for (let i = 0; i < 4; i++){ g.strokeStyle = dk; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-2 + i * 3.2, -10.5); g.quadraticCurveTo(-1 + i * 3.2, -7, -2.5 + i * 3.2, -4.5); g.stroke(); }
    g.restore();
    // 머리 — 앞발에 턱을 괴고, 눈은 감았다
    const hx = -7, hy = -3.4, ear = Math.sin(s * 0.7) > 0.93 ? -1.2 : 0;
    K.poly(g, [[hx - 4.6, hy - 2], [hx - 4.2, hy - 7.6 + ear], [hx - 1.2, hy - 4]], body, true); K.poly(g, [[hx + 1.4, hy - 4.2], [hx + 4, hy - 7.2], [hx + 4.4, hy - 1.6]], body, true);
    K.poly(g, [[hx - 3.8, hy - 2.6], [hx - 3.6, hy - 6 + ear], [hx - 1.8, hy - 3.8]], T('#ff9aa8'));
    K.oval(g, hx, hy, 5.2, 4.4, K.lin(g, 0, hy - 4, 0, hy + 4, [lt, body]), true);
    K.oval(g, hx + 0.2, hy + 1.8, 2.8, 1.8, cream);
    g.strokeStyle = '#3a2618'; g.lineWidth = 0.55; [-2, 2].forEach(dx => { g.beginPath(); g.arc(hx + dx, hy - 0.4, 1, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); });
    K.oval(g, hx + 0.2, hy + 0.9, 0.6, 0.45, T('#e8707a'));
    K.oval(g, hx - 2.6, hy + 3.8, 2.2, 1.3, cream, true); K.oval(g, hx + 2.2, hy + 4, 2.2, 1.3, cream, true);
    g.restore();
    // z — 몇 초마다 하나씩 떠오른다
    const zp = (s * 0.45) % 1;
    g.save(); g.globalAlpha = Math.max(0, 1 - zp) * 0.85; g.fillStyle = ph >= 3 ? '#cfe0ff' : '#5a6a8a'; g.font = '700 ' + (3 + zp * 2.5).toFixed(1) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('z', x - 10 - zp * 4, y - 12 - zp * 9); g.restore();
  }

  window.ROOMHD = { furn, wall, kit: K, PAL, phase, shell, floorItem, wallItem, cat };
})();
