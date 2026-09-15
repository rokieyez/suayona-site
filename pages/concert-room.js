// portfolio.html 의 연주회장 방 — 작품전시실 옆 탭(2026-09-15 부모 요청).
// 전시실 방(gallery-room.js)과 같은 틀(512×484, 칸 56×28, 벽 224)이라 탭을 바꿔도 크기가 그대로다.
// 영상 작품(유튜브)이 한 편씩 무대에 오른다: 그 영상의 작가가 객석에서 일어나 무대 계단을 올라
// 피아노 앞에 앉고(음악이 아닌 영상은 마이크 앞에 선다), 조명이 어두워지며 연주, 끝나면 일어나 인사하고
// 객석이 박수·환호(소리는 그 자리에서 만든다) — 다시 자리로 돌아가면 다음 영상.
// 박수는 작품 박수(work_claps)를 그대로 쓴다. 수는 전시실 방(GALLERY.claps)과 같은 것을 읽고, 치면 둘 다 오른다.
// 층: ① 벽·바닥·커튼·무대(한 번 굽기) ② 피아노·마이크·계단(한 번 굽기) ③ 화면 섬네일 ④ 의자·사람(깊이 순)
//     ⑤ 객석 어둠·스포트라이트·화면 빛 ⑥ 음표·먼지·꽃가루 ⑦ 말풍선·이름표. 밖으로는 window.CONCERT 만 내놓는다.
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const RW = 512, RH = 484, WALLH = 224, OX = 172, OY = 228, NA = 12, NB = 6;
  const INK = '#2a2118', FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const KID_NAME = { sua: '수아', yona: '연아', together: '수아·연아' };
  const KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3', together: '#ffd979' };

  // 바닥 좌표 (a: 오른쪽 벽을 따라 0~12, b: 왼쪽 벽을 따라 0~6, h: 바닥에서 위로) → 화면
  const P = (a, b, h) => [OX + (a - b) * 28, OY + (a + b) * 14 - (h || 0)];
  function poly(g, pts, col){ g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); g.fill(); }
  function line(g, p, q, col, w){ g.strokeStyle = col; g.lineWidth = w || 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
  // 바닥 네모 상자 — 보이는 두 옆면(b 쪽·a 쪽)과 윗면
  function box(g, a0, a1, b0, b1, h0, h, top, left, right){
    poly(g, [P(a0, b1, h0), P(a1, b1, h0), P(a1, b1, h0 + h), P(a0, b1, h0 + h)], left);
    poly(g, [P(a1, b0, h0), P(a1, b1, h0), P(a1, b1, h0 + h), P(a1, b0, h0 + h)], right);
    poly(g, [P(a0, b0, h0 + h), P(a1, b0, h0 + h), P(a1, b1, h0 + h), P(a0, b1, h0 + h)], top);
  }
  // 바닥 다각형을 세운 기둥(피아노 몸통) — 보는 쪽을 향한 옆면만 그린다. pts 는 시계 방향 [a,b]
  function prism(g, pts, h0, h1, top, sideA, sideB){
    const faces = [];
    for (let k = 0; k < pts.length; k++){
      const p = pts[k], q = pts[(k + 1) % pts.length], na = q[1] - p[1], nb = -(q[0] - p[0]);   // 바깥 법선
      if (na + nb <= 0) continue;                                                            // 화면 아래(보는 쪽)를 향한 면만
      faces.push({ p, q, d: p[0] + p[1] + q[0] + q[1], col: na > nb ? sideB : sideA });
    }
    faces.sort((x, y) => x.d - y.d).forEach(f => poly(g, [P(f.p[0], f.p[1], h0), P(f.q[0], f.q[1], h0), P(f.q[0], f.q[1], h1), P(f.p[0], f.p[1], h1)], f.col));
    poly(g, pts.map(p => P(p[0], p[1], h1)), top);
  }
  // 벽 — 오른쪽 벽(b=0) 은 a 를, 왼쪽 벽(a=0) 은 b 를 따라간다. v: 바닥에서 위로
  const rwall = (g, a0, a1, v0, v1, col) => poly(g, [P(a0, 0, v1), P(a1, 0, v1), P(a1, 0, v0), P(a0, 0, v0)], col);
  const lwall = (g, b0, b1, v0, v1, col) => poly(g, [P(0, b0, v1), P(0, b1, v1), P(0, b1, v0), P(0, b0, v0)], col);
  // 벽에 붙인 글·그림 — 벽 기울기(1/2)로 눕힌다
  function wallDo(g, side, fn){ g.save(); g.transform(1, side ? 0.5 : -0.5, 0, 1, OX, OY); fn(); g.restore(); }
  function rtext(g, t, a, v, font, col, align){ wallDo(g, 1, () => { g.font = font; g.fillStyle = col; g.textAlign = align || 'left'; g.fillText(t, a * 28, -v); }); }
  function ltext(g, t, b, v, font, col, align){ wallDo(g, 0, () => { g.font = font; g.fillStyle = col; g.textAlign = align || 'left'; g.fillText(t, -b * 28, -v); }); }
  const short = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  function prand(k){ let h = 2166136261; for (let i = 0; i < k.length; i++){ h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }
  const layer = () => { const c = document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2; const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false; return { c, g }; };

  // ---------- 무대 배치 ----------
  const STAGE = { a1: 6.2, b1: 3.0, h: 16 };                              // 뒤 모서리 무대(높이 16)
  const STAIRS = { a0: 5.35, a1: 6.2, b0: 3.0, b1: 3.66 };                // 무대 앞 오른쪽 계단(세 칸)
  const PIANO_AT = { a: 1.55, b: 0.3 };
  const PIANO = [[0, 2.0], [0, 0.12], [0.22, 0], [0.62, 0.12], [1.0, 0.48], [1.32, 0.98], [1.52, 1.42], [1.56, 2.0]].map(p => [PIANO_AT.a + p[0], PIANO_AT.b + p[1]]).reverse();
  const BENCH = { a0: 1.78, a1: 2.98, b0: 2.5, b1: 2.86 };
  const MIC = { a: 4.55, b: 2.55 };
  const SEAT_ROWS = [4.25, 5.3];                                           // 객석 두 줄(사람이 앉는 b)
  const SEAT_A = [0.9, 1.75, 2.6, 3.45, 4.3, 6.55, 7.4, 8.25, 9.1, 9.95, 10.8];   // 통로 a 4.8~6.1
  const HOME = { sua: { row: 0, a: 4.3 }, yona: { row: 0, a: 6.55 } };     // 두 아이 자리 — 통로 옆
  const LANE_B = 3.82;                                                     // 무대와 첫 줄 사이 길
  const SCREEN = { a0: 6.9, a1: 11.55, v0: 96, v1: 170 };                  // 오른쪽 벽 화면
  const MUSIC = /쇼팽|연습곡|에튀드|etude|sonatina|소나티나|피아노|piano|자작곡|콩쿠르|연주|chopin|곡\b|노래|song/i;
  function floorH(a, b){
    if (a <= STAGE.a1 + 0.001 && b <= STAGE.b1 + 0.001) return STAGE.h;
    if (a >= STAIRS.a0 - 0.05 && a <= STAIRS.a1 + 0.05 && b > STAIRS.b0 && b < STAIRS.b1) return Math.round(STAGE.h * (STAIRS.b1 - b) / (STAIRS.b1 - STAIRS.b0));
    return 0;
  }

  // ---------- ① 벽·바닥·커튼·무대 — 한 번 굽는다 ----------
  let shellCache = null;
  function shell(){
    if (shellCache) return shellCache;
    const { c, g } = layer();
    // 벽지 — 짙은 자두색 줄무늬, 아래는 나무 판벽, 위는 몰딩
    rwall(g, 0, NA, 0, WALLH, '#6e3b4a'); lwall(g, 0, NB, 0, WALLH, '#5f3240');
    for (let a = 0; a < NA; a += 0.25) if (Math.round(a * 4) % 2) rwall(g, a, a + 0.07, 64, WALLH - 14, '#7a4454');
    for (let b = 0; b < NB; b += 0.25) if (Math.round(b * 4) % 2) lwall(g, b, b + 0.07, 64, WALLH - 14, '#6a3947');
    [[rwall, NA], [lwall, NB]].forEach(([f, n], side) => {
      f(g, 0, n, 0, 64, side ? '#6b4428' : '#5c3a22');                                      // 판벽
      for (let x = 0.15; x < n - 0.3; x += 1.2){ f(g, x, x + 1.0, 10, 54, side ? '#7a5030' : '#6a4428'); f(g, x, x + 1.0, 53, 54, side ? '#9a6a40' : '#8a5a36'); f(g, x, x + 1.0, 10, 11, '#4a2e1a'); }
      f(g, 0, n, 62, 68, '#c9a24a'); f(g, 0, n, 67, 68, '#8a6a2a'); f(g, 0, n, 62, 63, '#f0d78a');   // 금색 띠
      f(g, 0, n, 0, 5, '#3a2416');
      f(g, 0, n, WALLH - 14, WALLH, '#f1e6d2'); f(g, 0, n, WALLH - 14, WALLH - 12, '#c9b896'); f(g, 0, n, WALLH - 4, WALLH - 3, '#ffffff');   // 몰딩
      f(g, 0, n, WALLH - 24, WALLH - 19, '#2a2624');                                        // 조명 레일
    });
    // 바닥 — 객석은 붉은 카펫(마름모 무늬), 통로는 금테 두른 긴 카펫
    for (let a = 0; a < NA; a++) for (let b = 0; b < NB; b++){
      poly(g, [P(a, b), P(a + 1, b), P(a + 1, b + 1), P(a, b + 1)], (a + b) % 2 ? '#7a2833' : '#72242f');
      poly(g, [P(a + 0.5, b + 0.2), P(a + 0.8, b + 0.5), P(a + 0.5, b + 0.8), P(a + 0.2, b + 0.5)], (a + b) % 2 ? '#8a3440' : '#842f3b');
      poly(g, [P(a + 0.5, b + 0.42), P(a + 0.58, b + 0.5), P(a + 0.5, b + 0.58), P(a + 0.42, b + 0.5)], '#c9a24a');
    }
    poly(g, [P(4.85, 3.0), P(6.05, 3.0), P(6.05, NB), P(4.85, NB)], '#3d2a4a');
    poly(g, [P(4.95, 3.0), P(5.02, 3.0), P(5.02, NB), P(4.95, NB)], '#c9a24a'); poly(g, [P(5.88, 3.0), P(5.95, 3.0), P(5.95, NB), P(5.88, NB)], '#c9a24a');
    for (let b = 3.3; b < NB; b += 0.6) poly(g, [P(5.45, b), P(5.6, b + 0.15), P(5.45, b + 0.3), P(5.3, b + 0.15)], '#6a4a80');
    // 무대 뒤 커튼 — 주름마다 빛과 그늘(사인 곡선), 아래 금술
    const curtain = (side, len) => {
      for (let px = 0; px < len * 28; px++){
        const fold = Math.sin(px / 9 * Math.PI), col = fold > 0.55 ? '#b8404f' : fold > 0 ? '#9a3040' : fold > -0.6 ? '#82263a' : '#621a2a';
        const x = side ? OX + px : OX - px - 1, y = OY + px / 2;
        g.fillStyle = col; g.fillRect(x, y - (WALLH - 26), 1, WALLH - 26);
        g.fillStyle = px % 3 ? '#c9a24a' : '#8a6a2a'; g.fillRect(x, y - 3 - (px % 2), 1, 3);
      }
    };
    curtain(1, STAGE.a1 + 0.2); curtain(0, STAGE.b1 + 0.2);
    // 휘장(금빛 물결 테) — 두 벽 모두
    [[rwall, STAGE.a1 + 0.2, 1], [lwall, STAGE.b1 + 0.2, 0]].forEach(([f, n, side]) => {
      f(g, 0, n, WALLH - 40, WALLH - 24, '#8e2f3a');
      for (let x = 0; x < n; x += 0.5){ f(g, x, x + 0.5, WALLH - 44, WALLH - 40, '#8e2f3a'); f(g, x + 0.1, x + 0.4, WALLH - 47, WALLH - 44, '#8e2f3a'); f(g, x + 0.22, x + 0.28, WALLH - 50, WALLH - 47, '#c9a24a'); }
      f(g, 0, n, WALLH - 26, WALLH - 24, '#f0d78a'); f(g, 0, n, WALLH - 41, WALLH - 40, '#c9a24a');
      (side ? rtext : ltext)(g, side ? '♪  수아랑 연아랑 연주회  ♪' : '', side ? 0.6 : 0.3, WALLH - 37, '800 9px ' + FONT, '#f0d78a');
    });
    // 무대 — 앞면은 짙은 판재에 금테, 윗면은 결 있는 마루
    box(g, 0, STAGE.a1, 0, STAGE.b1, 0, STAGE.h, '#a8743f', '#4a2e1a', '#3a2414');
    for (let a = 0.4; a < STAGE.a1; a += 0.4) line(g, P(a, 0, STAGE.h), P(a, STAGE.b1, STAGE.h), (a * 10) % 8 < 4 ? '#96652f' : '#b88450', 1);
    for (let a = 0.2; a < STAGE.a1; a += 0.8) for (let b = 0.3; b < STAGE.b1; b += 1.1){ const p = P(a + (b % 0.8), b, STAGE.h); g.fillStyle = '#7a5230'; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); }
    for (let a = 0.3; a < STAGE.a1 - 0.3; a += 1.0) poly(g, [P(a, STAGE.b1, 3), P(a + 0.8, STAGE.b1, 3), P(a + 0.8, STAGE.b1, 12), P(a, STAGE.b1, 12)], '#5a3a22');
    line(g, P(0, STAGE.b1, STAGE.h), P(STAGE.a1, STAGE.b1, STAGE.h), '#f0d78a'); line(g, P(STAGE.a1, 0, STAGE.h), P(STAGE.a1, STAGE.b1, STAGE.h), '#c9a24a');
    // 계단 세 칸
    for (let k = 0; k < 3; k++){
      const b0 = STAIRS.b0 + (STAIRS.b1 - STAIRS.b0) * k / 3, h = STAGE.h * (3 - k) / 3;
      box(g, STAIRS.a0, STAIRS.a1, b0, STAIRS.b1, 0, h, '#b88450', '#5a3a22', '#4a2e1a');
      line(g, P(STAIRS.a0, b0 + (STAIRS.b1 - STAIRS.b0) / 3, h), P(STAIRS.a1, b0 + (STAIRS.b1 - STAIRS.b0) / 3, h), '#f0d78a');
    }
    // 화면 틀(그림은 ③ 에서) — 금테 두 겹
    rwall(g, SCREEN.a0 - 0.22, SCREEN.a1 + 0.22, SCREEN.v0 - 8, SCREEN.v1 + 8, '#2a1c10');
    rwall(g, SCREEN.a0 - 0.16, SCREEN.a1 + 0.16, SCREEN.v0 - 5, SCREEN.v1 + 5, '#c9a24a');
    rwall(g, SCREEN.a0 - 0.16, SCREEN.a1 + 0.16, SCREEN.v1 + 4, SCREEN.v1 + 5, '#f0d78a');
    rwall(g, SCREEN.a0 - 0.05, SCREEN.a1 + 0.05, SCREEN.v0 - 2, SCREEN.v1 + 2, '#1a1410');
    // 벽 등(브래킷 조명) — 오른쪽 벽 화면 양옆·왼쪽 벽 객석 쪽
    [[1, 6.62], [1, 11.85], [0, 5.95]].forEach(([side, x]) => {
      const f = side ? rwall : lwall;
      f(g, x - 0.06, x + 0.06, 112, 128, '#8a6a2a'); f(g, x - 0.14, x + 0.14, 128, 140, '#f5e3b0'); f(g, x - 0.1, x + 0.1, 140, 144, '#c9a24a');
    });
    // 왼쪽 벽: 나가는 문과 초록 비상구 표시
    lwall(g, 4.55, 5.55, 0, 74, '#2a1c10'); lwall(g, 4.6, 5.5, 0, 70, '#6e4a2e');
    lwall(g, 4.68, 5.02, 8, 62, '#7e5636'); lwall(g, 5.08, 5.42, 8, 62, '#7e5636'); lwall(g, 4.98, 5.04, 32, 38, '#e0c070');
    lwall(g, 4.72, 5.38, 80, 92, '#1f7a3e'); ltext(g, '나가는 곳', 5.33, 83, '800 7px ' + FONT, '#e8ffe8');
    return (shellCache = c);
  }

  // ---------- ② 피아노·의자·스피커 — 한 번 굽는다(사람이 뒤로 지나가지 않는 것만) ----------
  let propsCache = null;
  function props(){
    if (propsCache) return propsCache;
    const { c, g } = layer(), S = STAGE.h;
    // 그랜드피아노 — 다리 셋, 몸통(윤 나는 검정), 건반, 보면대, 페달, 45도로 연 뚜껑과 받침대
    [[1.7, 2.12], [2.95, 2.12], [2.1, 0.45]].forEach(([a, b]) => { box(g, a - 0.06, a + 0.06, b - 0.06, b + 0.06, S, 16, '#1c1a18', '#0c0b0a', '#141210'); poly(g, [P(a - 0.07, b + 0.06, S), P(a + 0.07, b + 0.06, S), P(a + 0.07, b + 0.06, S + 2), P(a - 0.07, b + 0.06, S + 2)], '#c9a24a'); });
    box(g, 2.2, 2.44, 1.92, 2.1, S, 14, '#1c1a18', '#0c0b0a', '#141210');
    g.fillStyle = '#e0c070'; [2.25, 2.32, 2.39].forEach(a => { const p = P(a, 2.12, S + 2); g.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1); });
    prism(g, PIANO, S + 16, S + 27, '#24211f', '#0e0d0c', '#171514');
    line(g, P(PIANO_AT.a, PIANO_AT.b + 2.0, S + 27), P(PIANO_AT.a + 1.56, PIANO_AT.b + 2.0, S + 27), '#5a5652');   // 윤 나는 앞 모서리
    box(g, PIANO_AT.a + 0.04, PIANO_AT.a + 1.52, 2.3, 2.56, S + 21, 4, '#f4ecdc', '#2a2624', '#1c1a18');            // 건반
    for (let a = PIANO_AT.a + 0.1; a < PIANO_AT.a + 1.48; a += 0.1){ const p = P(a, 2.3, S + 25), q = P(a, 2.43, S + 25); if (Math.round(a * 10) % 7 !== 2 && Math.round(a * 10) % 7 !== 6) line(g, p, q, '#1c1a18'); }
    box(g, PIANO_AT.a - 0.04, PIANO_AT.a + 0.06, 2.28, 2.58, S + 20, 8, '#2a2624', '#141210', '#1c1a18'); box(g, PIANO_AT.a + 1.5, PIANO_AT.a + 1.6, 2.28, 2.58, S + 20, 8, '#2a2624', '#141210', '#1c1a18');
    poly(g, [P(1.95, 2.02, S + 27), P(2.95, 2.02, S + 27), P(2.95, 1.92, S + 39), P(1.95, 1.92, S + 39)], '#141210');          // 보면대
    poly(g, [P(2.1, 1.99, S + 29), P(2.8, 1.99, S + 29), P(2.8, 1.93, S + 37), P(2.1, 1.93, S + 37)], '#f4ecdc');             // 악보
    for (let k = 0; k < 3; k++) line(g, P(2.18, 1.97 - k * 0.015, S + 31 + k * 2), P(2.72, 1.97 - k * 0.015, S + 31 + k * 2), '#8a8480');
    const lidH = (a) => S + 27 + (a - PIANO_AT.a) * 22;
    const lid = PIANO.map(p => P(p[0], p[1], lidH(p[0])));
    line(g, P(2.75, 1.0, S + 27), P(2.75, 1.0, lidH(2.75) - 1), '#8a8480');                                               // 받침대
    poly(g, lid, '#2e2a27'); poly(g, lid.map(p => [p[0] + 0.5, p[1] + 1.5]).slice(0, 4), 'rgba(255,255,255,.05)');
    for (let k = 0; k < PIANO.length - 1; k++){ const p = PIANO[k], q = PIANO[k + 1]; if (p[0] > PIANO_AT.a + 0.8 || q[0] > PIANO_AT.a + 0.8) line(g, P(p[0], p[1], lidH(p[0])), P(q[0], q[1], lidH(q[0])), '#6b6562'); }
    // 피아노 의자(벨벳 방석, 단추 셋)
    box(g, BENCH.a0, BENCH.a1, BENCH.b0, BENCH.b1, S, 9, '#3a2616', '#2a1a0e', '#1f130a');
    box(g, BENCH.a0 + 0.03, BENCH.a1 - 0.03, BENCH.b0 + 0.02, BENCH.b1 - 0.02, S + 9, 3, '#9a3040', '#6e2230', '#5a1a26');
    [2.08, 2.38, 2.68].forEach(a => { const p = P(a, 2.68, S + 12); g.fillStyle = '#c9a24a'; g.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); });
    // 무대 뒤 스피커와 왼쪽 앞 화분
    box(g, 5.25, 5.9, 0.12, 0.62, S, 40, '#2a2624', '#1c1a18', '#141210');
    [[S + 30, 5], [S + 14, 7]].forEach(([h, r]) => { const p = P(5.575, 0.62, h); g.fillStyle = '#0c0b0a'; g.beginPath(); g.ellipse(p[0] - 7, p[1] + 3, r, r * 0.9, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a3634'; g.beginPath(); g.ellipse(p[0] - 7, p[1] + 3, r * 0.45, r * 0.4, 0, 0, Math.PI * 2); g.fill(); });
    box(g, 0.2, 0.62, 2.3, 2.72, S, 12, '#c8794a', '#8a4a2a', '#a0562c');
    const pl = P(0.41, 2.51, S + 12);
    [[-10, -22, '#2f7a3e'], [8, -26, '#3f8a4a'], [-4, -34, '#5cb85c'], [12, -14, '#2f7a3e'], [-14, -10, '#3f8a4a'], [2, -18, '#4a9a52']].forEach(([dx, dy, col]) => { g.fillStyle = INK; g.beginPath(); g.ellipse(pl[0] + dx, pl[1] + dy, 8, 4, dx / 20, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(pl[0] + dx, pl[1] + dy, 7, 3, dx / 20, 0, Math.PI * 2); g.fill(); });
    // 발 조명 전구(빛은 ⑤)
    for (let a = 0.5; a < 5.2; a += 0.75){ const p = P(a, STAGE.b1, STAGE.h); g.fillStyle = '#2a2624'; g.fillRect(Math.round(p[0]) - 3, Math.round(p[1]) - 2, 6, 3); g.fillStyle = '#f5e3b0'; g.fillRect(Math.round(p[0]) - 2, Math.round(p[1]) - 3, 4, 2); }
    return (propsCache = c);
  }

  // ---------- 사람 도트 — 아이 그림(kid-art.js)을 그대로, 객석 손님은 같은 틀에 색만 바꿔서 ----------
  const spriteBuf = {};
  function sprite(base, pal, dir, f, flip, cut, key){
    const id = [key, dir, f, flip ? 1 : 0, cut || 0].join('|');
    if (spriteBuf[id]) return spriteBuf[id];
    const art = window.KIDART && window.KIDART[base]; if (!art) return null;
    let rows = art[dir][f]; if (cut) rows = rows.slice(0, cut);
    const W = rows[0].length, H = rows.length;
    const paint = (g, ox, oy, one) => { for (let r = 0; r < H; r++) for (let x = 0; x < W; x++){ const ch = rows[r][x]; if (ch === '.') continue; g.fillStyle = one || pal[ch] || '#000'; g.fillRect(((flip ? W - 1 - x : x) + 1 + ox) * 2, (r + 1 + oy) * 2, 2, 2); } };
    const c = document.createElement('canvas'); c.width = (W + 2) * 2; c.height = (H + 2) * 2;
    const g = c.getContext('2d');
    [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => paint(g, ox, oy, '#241c14'));
    paint(g, 0, 0);
    return (spriteBuf[id] = c);
  }
  const kidPal = k => (window.KIDPAL && window.KIDPAL[k]) || {};
  // 객석 손님 — 머리·옷 색 조합. base 는 머리 모양(sua 긴 머리 · yona 단발)
  const GUESTS = [
    { base: 'yona', h: '#2b1e17', H: '#4a3528', d: '#1a120d', c: '#5b7fbf', C: '#7a9ad0', n: '#3e5f90' },
    { base: 'sua', h: '#d8d2c8', H: '#f0ebe2', d: '#a8a29a', c: '#9b6bbf', C: '#b88ad6', n: '#7a4f9a' },
    { base: 'yona', h: '#5a3a22', H: '#7a5236', d: '#3a2414', c: '#6a8a4a', C: '#8aa86a', n: '#4a6a32' },
    { base: 'sua', h: '#1c1a18', H: '#3a3634', d: '#0c0b0a', c: '#e0a93b', C: '#f0c86a', n: '#b9812c' },
    { base: 'yona', h: '#8a8480', H: '#aaa49e', d: '#5a5652', c: '#2b3a5e', C: '#4a5a80', n: '#1c2740' },
    { base: 'sua', h: '#a0562c', H: '#bd6c3a', d: '#77401f', c: '#e6dccb', C: '#fff8ea', n: '#c9b896' },
    { base: 'yona', h: '#3f2d23', H: '#634a37', d: '#2b1e17', c: '#d4504a', C: '#e8786a', n: '#a83a34' },
    { base: 'sua', h: '#2b2119', H: '#4a3a2e', d: '#1a120d', c: '#3f7a6a', C: '#5a9a88', n: '#2a5a4a' },
  ];
  function guestSprite(n, dir, f, cut){ const G = GUESTS[n % GUESTS.length]; return sprite(G.base, Object.assign({}, kidPal(G.base), G), dir, f, false, cut, 'g' + n); }
  function kidSprite(k, dir, f, flip, cut){ return sprite(k, kidPal(k), dir, f, flip, cut, k); }

  // ---------- 무대에 오르는 두 아이와 객석 ----------
  const WALK = 1.25, KIDS = ['sua', 'yona'];
  const homeSpot = k => ({ a: HOME[k].a, b: SEAT_ROWS[HOME[k].row] });
  const actors = {};
  function actorOf(k){
    if (!actors[k]){ const s = homeSpot(k); actors[k] = { k, a: s.a, b: s.b, seated: true, dir: 'up', flip: false, moving: false, phase: 0, plan: [], onArrive: null, say: null, sayUntil: 0 }; }
    return actors[k];
  }
  const atHome = p => p.seated && Math.hypot(p.a - homeSpot(p.k).a, p.b - homeSpot(p.k).b) < 0.02;
  const guests = [];
  SEAT_ROWS.forEach((b, row) => SEAT_A.forEach(a => {
    if (KIDS.some(k => HOME[k].row === row && Math.abs(HOME[k].a - a) < 0.01)) return;
    if (prand('seat' + row + ':' + a) < 0.24) return;                    // 빈자리도 조금
    guests.push({ row, a, b, n: guests.length, off: prand('off' + a + row) * 360, say: null, sayUntil: 0 });
  }));
  const GUEST_TALK = ['브라보!', '앵콜!', '와아, 멋지다!', '짝짝짝!', '또 들려줘요!', '최고예요!'];

  function stepActor(p, dt){
    if (!p.plan.length) return false;
    const t = p.plan[0], da = t.a - p.a, db = t.b - p.b, d = Math.hypot(da, db);
    if (d < 0.01){
      p.a = t.a; p.b = t.b; p.plan.shift();
      if (!p.plan.length){ p.moving = false; const f = p.onArrive; p.onArrive = null; if (f) f(); }
      return true;
    }
    const s = Math.min(d, WALK * dt / 1000);
    p.a += da / d * s; p.b += db / d * s; p.moving = true; p.seated = false; p.phase += dt / 230;
    const sx = (da - db) * 28, sy = (da + db) * 14;
    if (Math.abs(sx) > Math.abs(sy) * 1.15){ p.dir = 'side'; p.flip = sx < 0; } else { p.dir = sy > 0 ? 'down' : 'up'; p.flip = false; }
    return true;
  }
  // 자리 → 첫 줄 앞 길 → 계단 → 무대 앞 → 피아노 의자(또는 마이크 뒤). 내려올 때는 거꾸로
  const EDGE_B = STAGE.b1 - 0.07, STAIR_A = (STAIRS.a0 + STAIRS.a1) / 2;
  function spotsFor(mode, n){
    if (mode === 'piano') return n > 1 ? [{ a: 2.08, b: 2.7 }, { a: 2.68, b: 2.7 }] : [{ a: 2.38, b: 2.7 }];
    return n > 1 ? [{ a: 4.15, b: 2.25 }, { a: 4.95, b: 2.25 }] : [{ a: MIC.a, b: 2.25 }];
  }
  function approachA(mode, spot){ return mode === 'piano' ? spot.a : spot.a >= MIC.a ? spot.a + 0.42 : spot.a - 0.42; }
  function planUp(k, mode, spot){
    const h = homeSpot(k), ax = approachA(mode, spot);
    const pts = [{ a: h.a, b: LANE_B }, { a: STAIR_A, b: LANE_B }, { a: STAIR_A, b: EDGE_B }, { a: ax, b: EDGE_B }, { a: ax, b: spot.b }];
    if (ax !== spot.a) pts.push({ a: spot.a, b: spot.b });
    return pts;
  }
  function planDown(k, from){
    const h = homeSpot(k);
    return [{ a: from.a, b: EDGE_B }, { a: STAIR_A, b: EDGE_B }, { a: STAIR_A, b: LANE_B }, { a: h.a, b: LANE_B }, { a: h.a, b: h.b }];
  }

  // ---------- 공연 차례 ----------
  // idle(객석 불 켜짐·다음 무대 안내) → up(걸어 올라감) → sit → play(불 어둡게·조명) → bow(인사·박수) → down → rest → 다음 영상
  const DUR = { idle: 1800, sit: 700, play: 15000, bow: 4200, rest: 900 };
  let videos = [], list = [], openFn = null, idx = 0;
  const show = { phase: 'none', t: 0, who: [], mode: 'piano', spots: [], w: null, since: 0 };
  function startShow(){
    if (!videos.length){ show.phase = 'none'; show.w = null; return; }
    const w = videos[idx % videos.length];
    show.w = w; show.mode = MUSIC.test(w.title || '') ? 'piano' : 'mic';
    show.who = w.author === 'together' ? ['sua', 'yona'] : [HOME[w.author] ? w.author : 'sua'];
    show.spots = spotsFor(show.mode, show.who.length);
    setPhase(STILL ? 'play' : 'idle');
    if (STILL) show.who.forEach((k, n) => { const p = actorOf(k), s = show.spots[n]; p.a = s.a; p.b = s.b; p.plan = []; p.seated = show.mode === 'piano'; p.dir = p.seated ? 'up' : 'down'; });
  }
  function setPhase(ph){ show.phase = ph; show.t = 0; onPhase(ph); }
  function onPhase(ph){
    const who = show.who.map(actorOf);
    if (ph === 'up'){
      let left = who.length;
      who.forEach((p, n) => { p.seated = false; p.plan = planUp(p.k, show.mode, show.spots[n]); p.onArrive = () => { p.flip = false; p.seated = show.mode === 'piano'; p.dir = p.seated ? 'up' : 'down'; if (--left === 0) setPhase('sit'); }; });
    } else if (ph === 'play'){
      if (show.mode === 'mic') who.forEach((p, n) => talk(p, n ? '저도 같이 소개할게요!' : '안녕하세요! 제 영상을 소개할게요', 3200));
      emitAt = 0;
    } else if (ph === 'bow'){
      who.forEach((p, n) => { p.seated = false; p.dir = 'down'; p.flip = false; if (show.mode === 'piano') p.plan = [{ a: show.spots[n].a, b: EDGE_B - 0.12 }]; p.onArrive = () => { p.dir = 'down'; }; });
      KIDS.filter(k => !show.who.includes(k)).forEach(k => talk(actorOf(k), k === 'yona' ? '언니 최고!' : '연아 최고!', 3000));
      guests.filter((q, n) => prand('say' + idx + ':' + n) < 0.3).slice(0, 3).forEach((q, n) => { q.say = GUEST_TALK[(idx + n * 2) % GUEST_TALK.length]; q.sayUntil = now() + 2600 + n * 300; });
      applause(3.2, true);
      confetti(60);
    } else if (ph === 'down'){
      let left = who.length;
      who.forEach(p => { p.plan = planDown(p.k, p); p.onArrive = () => { p.seated = true; p.dir = 'up'; if (--left === 0) setPhase('rest'); }; });
    }
  }
  function stepShow(dt){
    if (show.phase === 'none') return false;
    show.t += dt;
    const ph = show.phase, t = show.t;
    if (STILL) return false;
    if (ph === 'idle' && t > DUR.idle) setPhase('up');
    else if (ph === 'sit' && t > DUR.sit) setPhase('play');
    else if (ph === 'play' && (show.pendingBow || (t > DUR.play && !show.live))){ show.pendingBow = false; setPhase('bow'); }   // 진짜 영상을 트는 동안은 끝날 때까지
    else if (ph === 'bow' && t > DUR.bow) setPhase('down');
    else if (ph === 'rest' && t > DUR.rest){ idx = (idx + 1) % videos.length; startShow(); }
    KIDS.forEach(k => stepActor(actorOf(k), dt));
    return true;
  }
  function skipShow(){                                                   // ⏭ 다음 무대 — 아이들을 자리에 앉히고 바로 다음 영상
    closePlayer(false);
    KIDS.forEach(k => { const p = actorOf(k), h = homeSpot(k); Object.assign(p, { a: h.a, b: h.b, plan: [], onArrive: null, seated: true, dir: 'up', moving: false }); });
    idx = (idx + 1) % Math.max(1, videos.length); startShow(); draw();
  }
  const now = () => performance.now();
  function talk(p, text, ms){ p.say = text; p.sayUntil = now() + (ms || 2600); }

  // ---------- ③ 화면 · 벽 안내판 ----------
  const thumbs = {};
  function thumbOf(w){
    if (!w) return null;
    if (thumbs[w.id]) return thumbs[w.id];
    const t = (thumbs[w.id] = { img: new Image(), ok: false });
    const id = typeof youtubeId === 'function' ? youtubeId(w.media_url) : '';
    const off = /[?&]tv=off\b/.test(location.search);                  // 시험용 — 섬네일이 캔버스를 더럽히면 그림을 못 뽑는다
    if (id && !off){ t.img.decoding = 'async'; t.img.onload = () => { t.ok = true; draw(); }; t.img.src = 'https://i.ytimg.com/vi_webp/' + id + '/mqdefault.webp'; }   // 섬네일은 CORS 가 없어 캔버스가 더럽혀지지만 이 방은 픽셀을 안 읽는다
    return t;
  }
  const authorOf = w => KID_NAME[w && w.author] || '수아랑 연아랑';
  function drawScreen(g){
    const w = show.w, th = thumbOf(w), x = SCREEN.a0 * 28, y = -SCREEN.v1, W = (SCREEN.a1 - SCREEN.a0) * 28, H = SCREEN.v1 - SCREEN.v0, ph = show.phase;
    wallDo(g, 1, () => {
      g.fillStyle = '#101826'; g.fillRect(x, y, W, H);
      if (th && th.ok){ g.imageSmoothingEnabled = true; g.drawImage(th.img, x, y, W, H); g.imageSmoothingEnabled = false; }
      else { for (let k = 0; k < W; k += 4){ g.fillStyle = k / W < 0.4 ? '#22384f' : '#1a2a40'; g.fillRect(x + k, y, 4, H * (0.3 + 0.7 * (1 - k / W))); } }
      g.fillStyle = 'rgba(0,0,0,.10)'; for (let k = 0; k < H; k += 2) g.fillRect(x, y + k, W, 1);        // 주사선
      g.textAlign = 'center';
      if (!w){ g.fillStyle = '#9fc3e6'; g.font = '800 10px ' + FONT; g.fillText('이 거르개에는 영상이 없어요', x + W / 2, y + H / 2 + 4); }
      else if (ph === 'idle' || ph === 'up' || ph === 'sit' || ph === 'rest'){
        g.fillStyle = 'rgba(8,10,20,.55)'; g.fillRect(x, y, W, H);
        g.fillStyle = '#ffd979'; g.font = '800 9px ' + FONT; g.fillText('♪ 다음 무대 ♪', x + W / 2, y + H / 2 - 8);
        g.fillStyle = '#fff8ea'; g.font = '800 11px ' + FONT; g.fillText(short(w.title, 14), x + W / 2, y + H / 2 + 8);
        g.fillStyle = '#c9d6e8'; g.font = '700 8px ' + FONT; g.fillText(authorOf(w), x + W / 2, y + H / 2 + 20);
      } else if (ph === 'play'){
        let p = Math.min(1, show.t / DUR.play);
        if (show.live && yt && yt.getDuration){ try { const d = yt.getDuration(); if (d > 0) p = Math.min(1, yt.getCurrentTime() / d); } catch (e) { /* 플레이어가 아직 준비 전 */ } }
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 5, y + H - 8, W - 10, 3);
        g.fillStyle = '#ffd979'; g.fillRect(x + 5, y + H - 8, Math.round((W - 10) * p), 3);
        if (Math.floor(now() / 600) % 2){ g.fillStyle = '#e8453c'; g.fillRect(x + 6, y + 5, 4, 4); }
        g.fillStyle = '#fff8ea'; g.font = '800 7px ' + FONT; g.textAlign = 'left'; g.fillText('상영 중', x + 13, y + 10);
      } else if (ph === 'bow'){
        g.fillStyle = 'rgba(8,10,20,.5)'; g.fillRect(x, y, W, H);
        g.fillStyle = '#ffd979'; g.font = '800 14px ' + FONT; g.fillText('고마워요!', x + W / 2, y + H / 2 + 5);
      }
      if (hoverKey === 'screen' || focusKey === 'screen'){ g.fillStyle = '#ffd979'; g.fillRect(x - 3, y - 3, W + 6, 2); g.fillRect(x - 3, y + H + 1, W + 6, 2); g.fillRect(x - 3, y - 3, 2, H + 6); g.fillRect(x + W + 1, y - 3, 2, H + 6); }
    });
    // 화면 아래 이름표
    if (w){
      rwall(g, SCREEN.a0 + 0.5, SCREEN.a1 - 0.5, SCREEN.v0 - 30, SCREEN.v0 - 12, INK); rwall(g, SCREEN.a0 + 0.54, SCREEN.a1 - 0.54, SCREEN.v0 - 28, SCREEN.v0 - 14, '#fff8ea');
      rtext(g, short(w.title, 16) + ' · ' + authorOf(w), (SCREEN.a0 + SCREEN.a1) / 2, SCREEN.v0 - 25, '800 8px ' + FONT, INK, 'center');
    }
  }
  function drawWallInfo(g){
    // 오늘의 무대(차례표) — 지금 것에 ▶
    lwall(g, 3.35, 5.75, 134, 198, '#2a1c10'); lwall(g, 3.39, 5.71, 137, 195, '#c9a24a'); lwall(g, 3.43, 5.67, 139, 193, '#fff8ea');
    ltext(g, '♪ 오늘의 무대', 5.58, 181, '800 9px ' + FONT, '#8e2f3a');
    for (let n = 0; n < Math.min(3, videos.length); n++){
      const w = videos[(idx + n) % videos.length];
      ltext(g, (n ? '   ' : '▶ ') + short(w.title, 11), 5.58, 167 - n * 10, (n ? '700 ' : '800 ') + '7px ' + FONT, n ? '#6f6558' : INK);
    }
    // 박수판 — 이 무대(연주회장) 박수만 센다
    lwall(g, 3.3, 4.5, 96, 126, '#2a1c10'); lwall(g, 3.35, 4.45, 99, 123, '#1c1a18');
    const on = clapsState === 'on', n = show.w ? (claps[show.w.id] || 0) : 0;
    ltext(g, on ? '박수' : '박수판', 4.38, 113, '800 7px ' + FONT, '#c9a24a');
    ltext(g, on ? String(n) : '준비 중', 3.45, 105, '800 ' + (on ? 11 : 8) + 'px ' + FONT, '#ffd979', 'right');
    if (hoverKey === 'board') lwall(g, 3.3, 4.5, 94, 96, '#ffd979');
  }

  // ---------- ④ 의자·사람·마이크 ----------
  let clapUntil = 0;
  const clapping = off => (show.phase === 'bow' && show.t < DUR.bow - 700) || now() < clapUntil ? 1 + (Math.floor((now() + off) / 160) % 2) : 0;
  function hands(g, x, y, pose){
    const s = pose === 2 ? 2 : 0;
    [[x - 13 - s, y], [x + 8 + s, y]].forEach(([hx, hy]) => { g.fillStyle = '#241c14'; g.fillRect(hx, hy, 5, 5); g.fillStyle = '#fbdcc4'; g.fillRect(hx + 1, hy + 1, 3, 3); });
  }
  function drawChair(g, a, b, q, kid){
    box(g, a - 0.33, a + 0.33, b - 0.12, b + 0.2, 0, 7, '#a83a46', '#5a1a26', '#6e2230');
    if (q || kid){
      const pt = P(a, b, 7), x = Math.round(pt[0]), y = Math.round(pt[1]);
      const c = kid ? kidSprite(kid.k, 'up', 0, false, 28) : guestSprite(q.n, 'up', 0, 28);
      const off = q ? q.off : kid.k === 'sua' ? 90 : 210;
      const nod = show.phase === 'play' && Math.sin((now() + off * 10) / 520) > 0.7 ? 1 : 0;          // 음악에 끄덕
      if (c) g.drawImage(c, x - 15, y - 29 + nod, c.width / 2, c.height / 2);
      const pose = clapping(off); if (pose) hands(g, x, y - 31 - (pose === 2 ? 2 : 0), pose);
    }
    box(g, a - 0.36, a + 0.36, b + 0.2, b + 0.32, 0, 20, '#8e2f3a', '#6e2230', '#5a1a26');
    line(g, P(a - 0.36, b + 0.32, 20), P(a + 0.36, b + 0.32, 20), '#c9a24a');
    box(g, a + 0.33, a + 0.39, b - 0.1, b + 0.2, 0, 11, '#4a2e1a', '#2a1a0e', '#3a2414');
  }
  function actorBase(p){ const bench = p.seated && !atHome(p); return P(p.a, p.b, bench ? STAGE.h + 12 : floorH(p.a, p.b)); }
  function drawActor(g, p){
    const bench = p.seated && !atHome(p), bp = actorBase(p), x = Math.round(bp[0]), y = Math.round(bp[1]);
    if (bench){
      const c = kidSprite(p.k, 'up', 0, false, 28), sway = show.phase === 'play' ? Math.round(Math.sin(now() / 240 + (p.k === 'yona' ? 1.6 : 0)) * 1.2) : 0;
      if (c) g.drawImage(c, x - 15 + sway, y - 29, c.width / 2, c.height / 2);
      return;
    }
    g.fillStyle = 'rgba(20,10,5,.3)'; g.beginPath(); g.ellipse(x, y, 9, 3.5, 0, 0, Math.PI * 2); g.fill();
    let dip = 0;
    if (show.phase === 'bow' && !p.moving){ const t = show.t % 1500; if (t > 450 && t < 1150) dip = 4; }
    const c = kidSprite(p.k, p.dir, p.moving ? Math.floor(p.phase) % 2 : 0, p.dir === 'side' && p.flip);
    if (c) g.drawImage(c, 0, 0, c.width, c.height - dip * 2, x - 15, y - 39 + dip, c.width / 2, c.height / 2 - dip);
  }
  function drawMic(g){
    const b = P(MIC.a, MIC.b, STAGE.h), x = Math.round(b[0]), y = Math.round(b[1]);
    g.fillStyle = '#141210'; g.beginPath(); g.ellipse(x, y, 6, 2.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3634'; g.fillRect(x, y - 30, 1, 30); g.fillStyle = '#8a8480'; g.fillRect(x + 1, y - 30, 1, 30);
    g.fillStyle = '#241c14'; g.fillRect(x - 3, y - 38, 6, 9); g.fillStyle = '#8a8480'; g.fillRect(x - 2, y - 37, 4, 4); g.fillStyle = '#c9c4be'; g.fillRect(x - 1, y - 37, 1, 1);
  }
  function drawDog(g){
    const b = P(5.45, 5.72), x = Math.round(b[0]), y = Math.round(b[1]), wag = clapping(40) ? (Math.floor(now() / 120) % 2) * 2 : 0;
    g.fillStyle = '#241c14'; g.fillRect(x - 9, y - 9, 18, 8); g.fillRect(x + 5, y - 14, 8, 8); g.fillRect(x - 12 - wag, y - 11, 4, 4);
    g.fillStyle = '#b98a5a'; g.fillRect(x - 8, y - 8, 16, 6); g.fillRect(x + 6, y - 13, 6, 6); g.fillRect(x - 11 - wag, y - 10, 3, 2);
    g.fillStyle = '#7a4a2a'; g.fillRect(x + 6, y - 13, 2, 3); g.fillStyle = '#241c14'; g.fillRect(x + 10, y - 11, 1, 1);
  }

  // ---------- ⑤ 조명 — 공연 중엔 객석이 어두워지고, 무대에 스포트라이트 ----------
  let dim = 0.06;
  const lightCv = document.createElement('canvas'); lightCv.width = RW * 2; lightCv.height = RH * 2;
  function stageFocus(){
    const on = show.who.map(actorOf).filter(p => !atHome(p) && floorH(p.a, p.b) === STAGE.h);
    if (!on.length) return { a: 3.0, b: 1.9 };
    return { a: on.reduce((s, p) => s + p.a, 0) / on.length, b: on.reduce((s, p) => s + p.b, 0) / on.length - 0.2 };
  }
  function glow(g, x, y, rx, ry, col){
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
  }
  // 방 테두리(두 벽 + 바닥) — 어둠과 빛이 방 밖(쪽 바탕)으로 새지 않게 자른다
  function roomPath(c){ const pts = [P(0, 0, WALLH), P(NA, 0, WALLH), P(NA, 0, 0), P(NA, NB, 0), P(0, NB, 0), P(0, NB, WALLH)]; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => c.lineTo(q[0], q[1])); c.closePath(); }
  function drawLight(g, dt){
    const target = show.phase === 'play' ? 0.52 : show.phase === 'sit' ? 0.4 : show.phase === 'bow' ? 0.22 : 0.05;
    dim += (target - dim) * Math.min(1, dt / 650);
    const f = stageFocus(), pool = P(f.a, f.b, STAGE.h), s = Math.max(0, Math.min(1, (dim - 0.08) * 2.4));
    const L = lightCv.getContext('2d'); L.setTransform(2, 0, 0, 2, 0, 0); L.clearRect(0, 0, RW, RH);
    L.save(); roomPath(L); L.clip();
    L.fillStyle = 'rgba(14,8,30,' + dim.toFixed(3) + ')'; L.fillRect(0, 0, RW, RH);
    L.globalCompositeOperation = 'destination-out';
    glow(L, pool[0], pool[1] - 16, 78, 44, 'rgba(0,0,0,' + (0.95 * s).toFixed(3) + ')');                      // 무대 조명 자리
    poly(L, [P(SCREEN.a0, 0, SCREEN.v1), P(SCREEN.a1, 0, SCREEN.v1), P(SCREEN.a1, 0, SCREEN.v0), P(SCREEN.a0, 0, SCREEN.v0)], 'rgba(0,0,0,.85)');   // 화면은 제 빛
    [[1, 6.62], [1, 11.85], [0, 5.95]].forEach(([side, v]) => { const p = side ? P(v, 0, 134) : P(0, v, 134); glow(L, p[0], p[1], 14, 14, 'rgba(0,0,0,.9)'); });
    L.globalCompositeOperation = 'source-over'; L.restore();
    g.drawImage(lightCv, 0, 0, RW, RH);
    g.save(); roomPath(g); g.clip(); g.globalCompositeOperation = 'lighter';
    if (s > 0.01){
      const src = [pool[0] + 120, -6], gr = g.createLinearGradient(src[0], src[1], pool[0], pool[1]);
      gr.addColorStop(0, 'rgba(255,240,190,0)'); gr.addColorStop(0.25, 'rgba(255,236,170,' + (0.10 * s).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,226,150,' + (0.20 * s).toFixed(3) + ')');
      poly(g, [[src[0] - 6, src[1]], [src[0] + 6, src[1]], [pool[0] + 62, pool[1] - 6], [pool[0] - 62, pool[1] + 8]], gr);
      glow(g, pool[0], pool[1] - 2, 64, 30, 'rgba(255,222,140,' + (0.30 * s).toFixed(3) + ')');
      for (let a = 0.5; a < 5.2; a += 0.75){ const p = P(a, STAGE.b1, STAGE.h); glow(g, p[0], p[1] - 4, 16, 10, 'rgba(255,210,120,' + (0.16 * s).toFixed(3) + ')'); }
    }
    if (show.phase === 'play'){ const p = P(9.2, 1.4); glow(g, p[0], p[1], 90, 40, 'rgba(110,160,255,' + (0.09 + 0.03 * Math.sin(now() / 400)).toFixed(3) + ')'); }
    [[1, 6.62], [1, 11.85], [0, 5.95]].forEach(([side, v]) => { const p = side ? P(v, 0, 134) : P(0, v, 134); glow(g, p[0], p[1], 20, 20, 'rgba(255,220,150,.10)'); });
    g.restore();
  }

  // ---------- ⑥ 음표·먼지·꽃가루 ----------
  const parts = [];
  let emitAt = 0;
  const NOTE_COL = ['#ffd979', '#fff8ea', '#ffb0b8', '#9fe0d0'];
  function confetti(n){ if (STILL) return; for (let k = 0; k < n; k++) parts.push({ kind: 'conf', x: 40 + Math.random() * 380, y: -10 - Math.random() * 80, vx: (Math.random() - 0.5) * 24, vy: 34 + Math.random() * 30, life: 0, max: 4200, col: ['#ff7f8a', '#6cc7b3', '#ffd979', '#9b6bbf', '#5b7fbf'][k % 5], ph: Math.random() * 6 }); }
  function stepParts(dt){
    if (show.phase === 'play' && !STILL && !show.paused){
      emitAt -= dt;
      if (emitAt <= 0){
        emitAt = show.mode === 'piano' ? 320 + Math.random() * 260 : 900 + Math.random() * 600;
        const src = show.mode === 'piano' ? P(2.2 + Math.random() * 0.9, 1.1, STAGE.h + 46) : P(MIC.a, MIC.b, STAGE.h + 44);
        parts.push({ kind: 'note', x: src[0], y: src[1], vx: -4 - Math.random() * 12, vy: -12 - Math.random() * 9, life: 0, max: 2800, ch: '♪♫♩♬'[Math.floor(Math.random() * 4)], col: NOTE_COL[Math.floor(Math.random() * 4)], ph: Math.random() * 6 });
      }
      if (dim > 0.3 && Math.random() < dt / 90){ const f = stageFocus(), p = P(f.a, f.b, STAGE.h); const k = Math.random(); parts.push({ kind: 'dust', x: p[0] + 120 * (1 - k) + (Math.random() - 0.5) * 60 * k, y: p[1] * k - 6 * (1 - k), vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3, life: 0, max: 2600 }); }
    }
    for (let k = parts.length - 1; k >= 0; k--){
      const q = parts[k]; q.life += dt;
      if (q.life > q.max || q.y > RH + 10){ parts.splice(k, 1); continue; }
      q.x += (q.vx + (q.kind === 'note' ? Math.sin(q.life / 300 + q.ph) * 10 : q.kind === 'conf' ? Math.sin(q.life / 200 + q.ph) * 14 : 0)) * dt / 1000;
      q.y += q.vy * dt / 1000;
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  }
  function drawParts(g){
    g.save(); roomPath(g); g.clip();                                    // 꽃가루가 방 밖(쪽 바탕)으로 안 떨어지게
    parts.forEach(q => {
      const a = Math.max(0, Math.min(1, Math.min(q.life / 250, (q.max - q.life) / 600)));
      g.globalAlpha = a;
      if (q.kind === 'note'){ g.font = '800 12px ' + FONT; g.fillStyle = INK; g.fillText(q.ch, Math.round(q.x) + 1, Math.round(q.y) + 1); g.fillStyle = q.col; g.fillText(q.ch, Math.round(q.x), Math.round(q.y)); }
      else if (q.kind === 'dust'){ g.fillStyle = 'rgba(255,240,200,.8)'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      else { g.fillStyle = q.col; const flat = Math.floor(q.life / 140 + q.ph) % 2; g.fillRect(Math.round(q.x), Math.round(q.y), flat ? 3 : 1, flat ? 1 : 3); }
    });
    g.globalAlpha = 1; g.restore();
  }

  // ---------- ⑦ 말풍선·이름표 ----------
  function bubble(g, cx, tipY, text){
    g.save(); g.font = '800 11px ' + FONT; g.textBaseline = 'top'; g.textAlign = 'left';
    const w = Math.ceil(g.measureText(text).width) + 12, h = 20, x = Math.round(Math.max(2, Math.min(RW - w - 2, cx - w / 2))), y = Math.round(Math.max(2, tipY - h - 6)), BG = '#fffaf0';
    g.fillStyle = INK; g.fillRect(x + 2, y, w - 4, h); g.fillRect(x, y + 2, w, h - 4);
    g.fillStyle = BG; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    const tx = Math.round(Math.max(x + 6, Math.min(x + w - 12, cx - 3)));
    g.fillStyle = INK; g.fillRect(tx - 2, y + h - 2, 10, 2); g.fillRect(tx, y + h, 6, 2); g.fillRect(tx + 2, y + h + 2, 2, 2);
    g.fillStyle = BG; g.fillRect(tx, y + h - 2, 6, 2); g.fillRect(tx + 2, y + h, 2, 2);
    g.fillStyle = INK; g.fillText(text, x + 6, y + 5);
    g.restore();
  }
  function nameTag(g, x, y, k){
    g.save(); g.font = '800 8px ' + FONT; const t = KID_NAME[k], w = Math.ceil(g.measureText(t).width) + 8;
    g.fillStyle = INK; g.fillRect(Math.round(x - w / 2) - 1, y - 1, w + 2, 12); g.fillStyle = KID_COLOR[k]; g.fillRect(Math.round(x - w / 2), y, w, 10);
    g.fillStyle = INK; g.textBaseline = 'top'; g.textAlign = 'center'; g.fillText(t, x, y + 1); g.restore();
  }

  // ---------- 한 장 그리기 ----------
  function drawScene(g, dt){
    g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, RW, RH);
    g.drawImage(shell(), 0, 0, RW, RH);                                  // ①
    drawScreen(g); drawWallInfo(g);                                      // ③
    g.drawImage(props(), 0, 0, RW, RH);                                  // ②
    const items = [], kids = KIDS.map(actorOf);                          // ④ 깊이(a+b) 순
    SEAT_ROWS.forEach((b, row) => SEAT_A.forEach(a => {
      const q = guests.find(x => x.row === row && x.a === a), kid = kids.find(p => atHome(p) && HOME[p.k].row === row && HOME[p.k].a === a);
      items.push({ key: a + b + 0.25, f: () => drawChair(g, a, b, q, kid) });
    }));
    kids.filter(p => !atHome(p)).forEach(p => items.push({ key: p.a + p.b + 0.02, f: () => drawActor(g, p) }));
    items.push({ key: MIC.a + MIC.b, f: () => drawMic(g) }, { key: 5.45 + 5.72, f: () => drawDog(g) });
    items.sort((x, y) => x.key - y.key).forEach(it => it.f());
    drawLight(g, dt);                                                    // ⑤
    drawParts(g);                                                        // ⑥
    const t = now();                                                     // ⑦
    kids.forEach(p => {
      const home = atHome(p), bp = home ? P(p.a, p.b, 7) : actorBase(p), top = home || p.seated ? 32 : 44;
      if (p.say && t < p.sayUntil) bubble(g, bp[0], bp[1] - top, p.say);
      else if (!home && p.moving) nameTag(g, Math.round(bp[0]), Math.round(bp[1]) - 56, p.k);
    });
    guests.forEach(q => { if (q.say && t < q.sayUntil){ const bp = P(q.a, q.b, 7); bubble(g, bp[0], bp[1] - 32, q.say); } });
  }
  function draw(){ const cv = $('#concertCv'); if (!cv || show.phase === 'none' && !videos.length && !list.length) return; drawScene(cv.getContext('2d'), 0); }

  // ---------- ⑧ 박수·환호 소리 — 파일 없이 그 자리에서 만든다 ----------
  // 이 방을 한 번도 안 누른 사람에게는 소리를 안 낸다(heard). 탭을 누르는 것도 누른 것이다. 소리 끄기(sy.mute)는 사이트 전체와 같다
  let AC = null, noiseBuf = null, heard = false;
  function audio(){
    if (!heard || (typeof sfxMuted === 'function' && sfxMuted())) return null;
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      if (!noiseBuf){ noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      return AC;
    } catch (e) { /* 소리는 덤이다 */ return null; }
  }
  function roomVisible(){ const cv = $('#concertCv'); if (!cv || document.hidden) return false; const rc = cv.getBoundingClientRect(); return rc.width > 0 && rc.bottom > 0 && rc.top < (window.innerHeight || 800); }
  // 손뼉 한 번 — 잡음을 짧게 끊어 대역 거르개(손바닥마다 다른 음높이)와 좌우 자리를 준다
  function clapHit(ac, t0, vol, out){
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1900; bp.Q.value = 0.9 + Math.random() * 1.4;
    const g = ac.createGain(), d = 0.035 + Math.random() * 0.05;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t0 + d);
    src.connect(bp); bp.connect(g);
    if (ac.createStereoPanner){ const pn = ac.createStereoPanner(); pn.pan.value = Math.random() * 1.6 - 0.8; g.connect(pn); pn.connect(out); } else g.connect(out);
    src.start(t0, Math.random() * 0.8, d + 0.02);
  }
  function applause(secs, withCheer){
    if (!roomVisible()) return;
    const ac = audio(); if (!ac) return;
    const comp = ac.createDynamicsCompressor(), master = ac.createGain(); master.gain.value = 0.55; comp.connect(master); master.connect(ac.destination);
    const t = ac.currentTime + 0.02;
    for (let p = 0; p < 14; p++){                                        // 열네 사람이 제 박자로 치다가 끝에 잦아든다
      const rate = 3.2 + Math.random() * 2.6, end = secs * (0.7 + Math.random() * 0.3);
      for (let x = Math.random() * 0.35; x < end; x += (0.85 + Math.random() * 0.3) / rate){
        const fade = 1 - Math.max(0, (x - secs * 0.55) / (secs * 0.45));
        clapHit(ac, t + x, 0.22 * fade * (0.6 + Math.random() * 0.4), comp);
      }
    }
    if (withCheer) cheer(ac, t + 0.15, secs, comp);
  }
  // 와아 — 목소리 다섯(톱니파를 모음 거르개 둘에 통과, 올라갔다 내려오는 음높이·떨림)과 밑에 깔리는 웅성거림
  function cheer(ac, t0, secs, out){
    for (let v = 0; v < 5; v++){
      const o = ac.createOscillator(), base = 190 + Math.random() * 230, st = t0 + Math.random() * 0.5, len = 0.7 + Math.random() * 0.9;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.85, st); o.frequency.linearRampToValueAtTime(base * 1.25, st + len * 0.35); o.frequency.linearRampToValueAtTime(base * 0.9, st + len);
      const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5 + Math.random() * 2; vg.gain.value = base * 0.03; vib.connect(vg); vg.connect(o.frequency);
      const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), g = ac.createGain();
      f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 4; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 5;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.10, st + 0.12); g.gain.exponentialRampToValueAtTime(0.001, st + len);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(out);
      o.start(st); vib.start(st); o.stop(st + len + 0.05); vib.stop(st + len + 0.05);
    }
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.7;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.09, t0 + 0.3); g.gain.linearRampToValueAtTime(0.05, t0 + secs * 0.6); g.gain.linearRampToValueAtTime(0.0001, t0 + secs);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t0); src.stop(t0 + secs + 0.1);
  }

  // ---------- 박수 — concert_claps(작품 박수와 따로 센다). 표가 없으면 박수판은 「준비 중」, 소리만 난다 ----------
  let claps = {}, clapsState = 'idle';
  function loadClaps(){
    if (clapsState !== 'idle' || typeof sb === 'undefined') return;
    clapsState = 'loading';
    sb.rpc('concert_clap_counts').then(res => {
      if (res.error){ clapsState = 'off'; renderTools(); draw(); return; }
      claps = {}; (res.data || []).forEach(r => { claps[r.work_id] = Number(r.n) || 0; });
      clapsState = 'on'; renderTools(); draw();
    }).catch(() => { clapsState = 'off'; renderTools(); });
  }
  async function clap(){
    const w = show.w; if (!w) return;
    heard = true; clapUntil = now() + 1700; applause(1.4, true);
    const q = guests[Math.floor(Math.random() * guests.length)]; if (q){ q.say = GUEST_TALK[Math.floor(Math.random() * GUEST_TALK.length)]; q.sayUntil = now() + 1800; }
    draw();
    if (clapsState !== 'on'){ say('박수 소리만 났어요 — 박수판은 아직 준비 중이에요'); return; }
    const key = 'concert_clap_' + w.id;
    let did = false; try { did = !!localStorage.getItem(key); } catch (e) { /* 못 읽으면 다시 칠 수 있다 */ }
    if (did){ say('「' + short(w.title, 14) + '」에는 이미 박수를 쳤어요 — 소리는 얼마든지!'); return; }
    const { error } = await sb.from('concert_claps').insert({ work_id: w.id });
    if (error){ say('지금은 박수를 못 쳤어요: ' + (typeof readableError === 'function' ? readableError(error) : error.message)); return; }
    claps[w.id] = (claps[w.id] || 0) + 1;
    try { localStorage.setItem(key, '1'); } catch (e) { /* 저장이 막혀도 박수는 남았다 */ }
    say('👏 「' + short(w.title, 14) + '」 무대에 박수 ' + claps[w.id] + '번째!'); renderTools(); draw();
  }

  // ---------- 누르기 — 화면(마우스는 누르면 열림, 손가락은 한 번 → 이름표, 한 번 더 → 열림)·박수판·아이·관객·피아노 ----------
  let hoverKey = null, focusKey = null, wired = false, lastPointer = 'mouse';
  function say(t){ const el = $('#concertMsg'); if (el) el.textContent = t || ''; }
  function stateLine(){
    const w = show.w; if (!w) return videos.length ? '' : '이 거르개에는 영상이 없어요 — 거르개를 「전체」로 바꿔 보세요';
    const who = KID_NAME[w.author] || '수아랑 연아랑', t = '「' + short(w.title, 18) + '」';
    return { idle: '다음 무대: ' + t + ' · ' + who, up: who + ' 무대로 나가요 · ' + t, sit: who + ' 준비 중 · ' + t, play: (show.live ? '무대에서 상영 중: ' : show.mode === 'piano' ? '연주 중: ' : '상영 중: ') + t + (show.live ? ' · 끝나면 인사해요' : ' · 화면을 누르면 무대에서 봐요'), bow: '박수! 👏 ' + t, down: who + ' 자리로 돌아가요', rest: '잠시 쉬어요' }[show.phase] || t;
  }
  function hitAt(e){
    const cv = $('#concertCv'), rc = cv.getBoundingClientRect(); if (!rc.width) return null;
    const x = (e.clientX - rc.left) / rc.width * RW, y = (e.clientY - rc.top) / rc.height * RH;
    for (const p of KIDS.map(actorOf)){
      const home = atHome(p), bp = home ? P(p.a, p.b, 7) : actorBase(p), top = home || p.seated ? 30 : 40;
      if (x >= bp[0] - 13 && x < bp[0] + 13 && y >= bp[1] - top && y < bp[1] + 3) return { key: 'kid:' + p.k, kid: p.k };
    }
    for (const q of guests){ const bp = P(q.a, q.b, 7); if (x >= bp[0] - 12 && x < bp[0] + 12 && y >= bp[1] - 30 && y < bp[1] + 2) return { key: 'guest:' + q.n, guest: q }; }
    const lu = x - OX, lb = -lu / 28, lv = OY - lu / 2 - y;                // 왼쪽 벽 좌표
    if (lb >= 3.3 && lb <= 4.5 && lv >= 96 && lv <= 126) return { key: 'board' };
    const ru = x - OX, ra = ru / 28, rv = OY + ru / 2 - y;                 // 오른쪽 벽 좌표
    if (show.w && ra >= SCREEN.a0 && ra <= SCREEN.a1 && rv >= SCREEN.v0 - 30 && rv <= SCREEN.v1) return { key: 'screen' };
    const pc = P(2.35, 1.3, STAGE.h + 30);
    if (Math.abs(x - pc[0]) < 42 && Math.abs(y - pc[1]) < 28) return { key: 'piano' };
    return null;
  }
  function describe(h){
    if (!h) return stateLine();
    if (h.key === 'screen') return '「' + short(show.w.title, 20) + '」 · ' + authorOf(show.w) + (lastPointer === 'mouse' ? ' · 누르면 무대에서 봐요' : ' · 한 번 더 누르면 무대에서 봐요');
    if (h.key === 'board') return '박수판 · 누르면 이 무대에 박수(연주회장 박수는 작품 박수와 따로 세요)';
    if (h.kid) return KID_NAME[h.kid] + ' · 누르면 이야기해요';
    if (h.guest) return '관객 · 누르면 한마디';
    return '피아노 · 눌러 보세요';
  }
  function kidLine(p){
    const on = show.who.includes(p.k) && !atHome(p);
    if (on) return show.phase === 'bow' ? '들어 줘서 고마워요!' : show.mode === 'piano' ? '열심히 연습했어요!' : '끝까지 봐 주세요!';
    const other = show.who.find(k => k !== p.k);
    return other && show.phase !== 'idle' ? '지금은 ' + KID_NAME[other] + ' 차례예요!' : '다음은 제 차례일지도요!';
  }
  function openCurrent(){ const i = show.w ? list.indexOf(show.w) : -1; if (i >= 0 && openFn) openFn(i); }
  function wire(){
    const cv = $('#concertCv'); if (!cv || wired) return; wired = true;
    cv.tabIndex = 0;
    cv.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; heard = true; });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const h = hitAt(e), key = h ? h.key : null;
      cv.style.cursor = h ? 'pointer' : 'default';
      if (key !== hoverKey){ hoverKey = key; say(describe(h)); if (STILL) draw(); }
    });
    cv.addEventListener('pointerleave', () => { if (hoverKey){ hoverKey = null; say(stateLine()); if (STILL) draw(); } });
    cv.addEventListener('click', e => {
      heard = true;
      const h = hitAt(e), touch = lastPointer !== 'mouse';
      if (!h){ if (focusKey){ focusKey = null; draw(); } say(stateLine()); return; }
      if (h.key === 'screen'){
        if (touch && focusKey !== 'screen'){ focusKey = 'screen'; say(describe(h)); draw(); return; }
        focusKey = null; openPlayer(show.w); return;
      }
      focusKey = null;
      if (h.key === 'board'){ clap(); return; }
      if (h.kid){ const p = actorOf(h.kid); talk(p, kidLine(p), 2600); say(KID_NAME[h.kid] + ': ' + p.say); draw(); return; }
      if (h.guest){ h.guest.say = GUEST_TALK[Math.floor(Math.random() * GUEST_TALK.length)]; h.guest.sayUntil = now() + 2200; say('관객: ' + h.guest.say); draw(); return; }
      if (typeof tone === 'function') [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', 0.05, i * 0.09));
      say('피아노 — 무대의 주인공이 곧 앉아요');
    });
    cv.addEventListener('keydown', e => { if (e.key === 'Enter') openPlayer(show.w); });
  }
  function renderTools(){
    const box = $('#concertTools'); if (!box) return;
    const w = show.w, muted = typeof sfxMuted === 'function' && sfxMuted();
    box.innerHTML = (w ? '<button type="button" class="dot-btn small" id="cClap">👏 박수' + (clapsState === 'on' ? ' <b>' + (claps[w.id] || 0) + '</b>' : '') + '</button> ' +
      '<button type="button" class="dot-btn small" id="cOpen">▶ 무대에서 보기</button> ' +
      (videos.length > 1 ? '<button type="button" class="dot-btn small" id="cNext">⏭ 다음 무대</button> ' : '') : '') +
      '<button type="button" class="dot-btn small" id="cSound">' + (muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐') + '</button>';
    const on = (id, f) => { const b = $('#' + id); if (b) b.addEventListener('click', f); };
    on('cClap', () => clap()); on('cOpen', () => openPlayer(show.w)); on('cNext', () => { heard = true; skipShow(); renderTools(); say(stateLine()); });
    on('cSound', () => { if (typeof sfxSetMuted === 'function') sfxSetMuted(!muted); heard = true; renderTools(); if (muted) applause(0.8, false); });
  }

  // ---------- 무대 위 영상 — 화면을 누르면 방 위에 진짜 유튜브 플레이어가 뜨고, 영상이 끝나면 방에서 인사·박수 ----------
  // 캔버스 속 기울어진 화면에서 틀지 않는 이유(2026-09-15 유튜브 규정 확인): 플레이어는 200×200px 이상이어야 하고,
  // 앞에 아무것도 겹치면 안 되며, 문서에 없는 방식으로 바꾸면 안 된다(기울이기 포함). 그래서 똑바로 선 플레이어를
  // 방 위(폰은 방 아래)에 띄우고, 방은 뒤에서 계속 움직인다. 플레이어 코드(iframe_api)는 처음 누를 때만 받는다.
  let yt = null, ytReady = null, playerBox = null, liveW = null;
  function loadYT(){
    if (ytReady) return ytReady;
    ytReady = new Promise((res, rej) => {
      if (window.YT && window.YT.Player) return res(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') try { prev(); } catch (e) { /* 남의 콜백 오류는 넘긴다 */ } res(window.YT); };
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
      sc.onerror = () => { ytReady = null; rej(new Error('유튜브 플레이어를 받지 못했어요')); };
      document.head.appendChild(sc);
    });
    return ytReady;
  }
  function ensureBox(){
    if (playerBox) return playerBox;
    const stage = $('#concertRoom .museum-stage'); if (!stage) return null;
    playerBox = document.createElement('div'); playerBox.className = 'concert-player'; playerBox.hidden = true;
    playerBox.innerHTML = '<div class="cp-bar"><b class="cp-title"></b><button type="button" class="dot-btn small cp-post">게시글로</button>' +
      '<button type="button" class="dot-btn small cp-close" aria-label="영상 닫기">✕ 닫기</button></div><div class="cp-frame"><div id="concertYT"></div></div>';
    stage.appendChild(playerBox);
    playerBox.querySelector('.cp-close').addEventListener('click', () => closePlayer(false));
    playerBox.querySelector('.cp-post').addEventListener('click', () => { const w = liveW; closePlayer(false); const i = w ? list.indexOf(w) : -1; if (i >= 0 && openFn) openFn(i); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && liveW) closePlayer(false); });
    return playerBox;
  }
  async function openPlayer(w){
    if (!w) return;
    const box = ensureBox(), id = typeof youtubeId === 'function' ? youtubeId(w.media_url) : '';
    if (!box || !id){ openCurrent(); return; }
    heard = true;
    if (show.w !== w || !['up', 'sit', 'play'].includes(show.phase)){         // 이 영상의 작가가 아직 무대에 없으면 바로 올라온다
      KIDS.forEach(k => { const p = actorOf(k), h = homeSpot(k); Object.assign(p, { a: h.a, b: h.b, plan: [], onArrive: null, seated: true, dir: 'up', moving: false }); });
      idx = Math.max(0, videos.indexOf(w)); startShow(); if (!STILL) setPhase('up');
    }
    show.live = true; show.paused = false; show.pendingBow = false; liveW = w;
    box.querySelector('.cp-title').textContent = short(w.title, 30) + ' · ' + authorOf(w);
    box.hidden = false; box.classList.remove('rise'); void box.offsetWidth; box.classList.add('rise');
    box.scrollIntoView({ block: 'nearest', behavior: STILL ? 'auto' : 'smooth' });      // 절반 넘게 보여야 자동 재생할 수 있다(규정)
    say('▶ 「' + short(w.title, 20) + '」 — 영상이 끝나면 무대에서 인사해요'); renderTools();
    try {
      const YT = await loadYT();
      if (liveW !== w) return;
      if (yt && yt.loadVideoById){ yt.loadVideoById(id); return; }
      yt = new YT.Player('concertYT', { host: 'https://www.youtube-nocookie.com', videoId: id, width: '100%', height: '100%',
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, origin: location.origin },
        events: { onStateChange: ev => onYT(ev.data) } });
    } catch (e) { closePlayer(false); say('영상 플레이어를 못 열어서 게시글로 열어요'); openCurrent(); }
  }
  function onYT(state){ show.paused = state === 2; if (state === 0) videoEnded(); }   // 0 끝남 · 1 재생 · 2 멈춤
  function videoEnded(){
    if (!liveW) return;
    closePlayer(true);
    if (show.phase === 'play') setPhase('bow'); else show.pendingBow = true;   // 아직 걸어가는 중이면 앉자마자 인사
  }
  function closePlayer(ended){
    if (!playerBox || !liveW) return;
    liveW = null; show.live = false; show.paused = false;
    try { if (yt && yt.stopVideo) yt.stopVideo(); } catch (e) { /* 이미 닫힌 플레이어 */ }
    playerBox.hidden = true;
    if (!ended && show.phase === 'play') show.t = Math.max(show.t, DUR.play - 1500);   // 닫으면 곧 인사하고 다음 무대로
    renderTools(); say(stateLine());
  }

  // ---------- 탭 ----------
  let tabsWired = false;
  function setRoom(room, byUser){
    const rooms = $('#rooms'); if (!rooms) return;
    rooms.dataset.room = room;
    document.querySelectorAll('#roomTabs [data-room]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.room === room)));
    try { const u = new URL(location.href); if (room === 'concert') u.searchParams.set('room', 'concert'); else u.searchParams.delete('room'); history.replaceState(history.state, '', u); } catch (e) { /* 주소를 못 바꿔도 탭은 바뀐다 */ }
    if (room === 'concert'){ if (byUser) heard = true; loadClaps(); draw(); say(stateLine()); }
    else { closePlayer(false); if (window.GALLERY && GALLERY.draw) GALLERY.draw(); }
  }
  function wireTabs(){
    if (tabsWired) return; tabsWired = true;
    document.querySelectorAll('#roomTabs [data-room]').forEach(b => b.addEventListener('click', () => setRoom(b.dataset.room, true)));
    if (new URLSearchParams(location.search).get('room') === 'concert') setRoom('concert', false);
  }

  // ---------- 바깥에서 부르는 것 ----------
  function render(visibleList, open, opts){
    const box = $('#concertRoom'), tabs = $('#roomTabs'); if (!box) return;
    list = Array.isArray(visibleList) ? visibleList : []; openFn = open;
    const vids = list.filter(w => w.media_type === 'youtube');
    const any = !!(opts && opts.anyVideo) || vids.length > 0;
    box.hidden = !any; if (tabs) tabs.hidden = !any;
    if (!any){ setRoom('gallery'); return; }
    const same = vids.length === videos.length && vids.every((w, i) => videos[i] && videos[i].id === w.id);
    videos = vids;
    if (!same){
      closePlayer(false); idx = 0; parts.length = 0;
      KIDS.forEach(k => { const p = actorOf(k), h = homeSpot(k); Object.assign(p, { a: h.a, b: h.b, plan: [], onArrive: null, seated: true, dir: 'up', moving: false, say: null }); });
      startShow();
    }
    wire(); wireTabs(); renderTools(); draw();
    if ($('#rooms') && $('#rooms').dataset.room === 'concert') loadClaps();   // 박수 수는 연주회장을 볼 때만 받는다 — 전시실만 보는 사람은 요청이 없다
    if (!STILL && !looping){ looping = true; requestAnimationFrame(loop); }
  }
  // 보일 때만 돈다 — 탭이 전시실이면(display:none) 너비가 0 이라 멈춘다. 초당 30장
  let looping = false, lastTick = 0, acc = 0, seen = false, seenAt = 0, lastPhase = '', lastW = null;
  function tick(t, dt){                                                  // 한 장 — 시험에서도 부른다(숨은 창은 rAF 가 안 돈다)
    stepShow(dt); stepParts(dt);
    if (show.phase !== lastPhase || show.w !== lastW){
      lastPhase = show.phase;
      if (show.w !== lastW){ lastW = show.w; renderTools(); }
      if (!hoverKey && !focusKey && seen) say(stateLine());
    }
    const cv = $('#concertCv'); if (cv) drawScene(cv.getContext('2d'), dt);
  }
  function loop(t){
    requestAnimationFrame(loop);
    try {
      const dt = Math.min(100, lastTick ? t - lastTick : 16); lastTick = t;
      if (t - seenAt >= 400){ seenAt = t; const cv = $('#concertCv'), rc = cv && !cv.closest('[hidden]') && cv.getBoundingClientRect(); seen = !!rc && rc.width > 0 && rc.bottom > -60 && rc.top < (window.innerHeight || 800) + 60; }
      if (!seen || document.hidden || !videos.length) return;
      acc += dt; if (acc < 33) return;
      tick(t, Math.min(100, acc)); acc = 0;
    } catch (e) { /* 한 장 건너뛴다 */ }
  }
  window.CONCERT = { render, draw, _tick: tick, _show: show, _actors: actors, _guests: guests, _skip: skipShow, _room: setRoom, _clap: clap, _parts: parts, _applause: applause, _hit: hitAt, _claps: () => claps, _state: () => clapsState, _phase: setPhase, _open: openPlayer, _ended: videoEnded, _yt: () => yt, _close: closePlayer };
})();
