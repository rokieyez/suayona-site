/* 첫화면 마을 — 언패킹처럼 재질과 소품이 촘촘한 아이소메트릭 도트 마을.
   농장 방과 같은 2:1 규칙(칸 48×24, 빛은 왼쪽 위). 전부 코드로 그린다 — 그림 파일이 없다.
   밖으로는 Village.render 하나만 낸다. 놀이(숨은 친구·심은 꽃·이젤·날씨)는 pages/index.js 가 이 위에 얹는다. */
const Village = (() => {
let NIGHT = false;                            // 밤이면 창에 불이 켜지고 가로등이 켜진다
let LIT_P = 0.6;                              // 밤에 불 켜진 창의 비율 — 첫화면의 시계가 시각으로 정한다
const LIGHTS = [];                            // 밤에 빛나는 자리 — 첫화면 코드가 덮개 뒤에 빛을 얹는다
const HITS = [];                              // 누를 수 있는 물건들의 화면 자리
/* 아이소메트릭 기본기 (2판). 농장 방과 같은 2:1 규칙.
   세상 좌표: x 는 화면 오른쪽아래로, y 는 왼쪽아래로, z 는 위로. 한 칸 = TW×TH 도트.
   빛은 왼쪽 위 — 윗면이 가장 밝고, 왼쪽아래를 보는 면(L)이 중간, 오른쪽아래(R)가 가장 어둡다. */
const TW = 48, TH = 24, S = TW / 2;
let ORG = { x: 0, y: 0 };                       // 세상 (0,0,0) 이 놓이는 도트 자리
function proj(wx, wy, wz){ return [ORG.x + (wx - wy) * S, ORG.y + (wx + wy) * (S / 2) - (wz || 0)]; }
function shade(hex, d){
  const n = parseInt(hex.slice(1), 16), r = Math.max(0, Math.min(255, (n >> 16) + d)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d)), b = Math.max(0, Math.min(255, (n & 255) + d));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function mix(a, b, t){
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const r = Math.round(((A >> 16) & 255) * (1 - t) + ((B >> 16) & 255) * t);
  const g = Math.round(((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t);
  const c = Math.round((A & 255) * (1 - t) + (B & 255) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + c).toString(16).slice(1);
}
// 자리에 따라 늘 같은 값이 나오는 잡음 — 질감을 줄 때 쓴다
function hash(x, y, s){
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + ((s || 0) | 0) * 1274126177;
  h = (h ^ (h >>> 13)) * 1103515245; h = h ^ (h >>> 16);
  return ((h >>> 0) % 10007) / 10007;
}
// 다각형을 도트 단위로 채운다. 도트의 한가운데가 안에 있으면 칠한다. colorAt(x,y) 가 null 이면 비운다.
function polyFill(q, pts, colorAt){
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const n = pts.length;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++){
    const cy = y + 0.5;
    // 이 줄과 만나는 변의 x 를 모아 짝지어 채운다
    const xs = [];
    for (let i = 0; i < n; i++){
      const a = pts[i], b = pts[(i + 1) % n];
      if ((a[1] <= cy) !== (b[1] <= cy)) xs.push(a[0] + (cy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    xs.sort((p, r) => p - r);
    for (let k = 0; k + 1 < xs.length; k += 2){
      for (let x = Math.floor(xs[k] + 0.5); x + 0.5 < xs[k + 1]; x++){
        const c = colorAt ? colorAt(x, y) : null;
        if (c) q(x, y, 1, 1, c);
      }
    }
  }
}
/* 평행사변형 한 면. P0 에서 U 방향으로 ulen, V 방향으로 vlen 만큼.
   tex(u, v) 는 면 좌표 — u 는 U 를 따라 몇 도트, v 는 V 를 따라 몇 도트. */
function quad(q, P0, U, V, ulen, vlen, tex){
  const pts = [P0, [P0[0] + U[0] * ulen, P0[1] + U[1] * ulen],
               [P0[0] + U[0] * ulen + V[0] * vlen, P0[1] + U[1] * ulen + V[1] * vlen],
               [P0[0] + V[0] * vlen, P0[1] + V[1] * vlen]];
  const det = U[0] * V[1] - U[1] * V[0];
  polyFill(q, pts, (x, y) => {
    const dx = x + 0.5 - P0[0], dy = y + 0.5 - P0[1];
    const u = (dx * V[1] - dy * V[0]) / det, v = (U[0] * dy - U[1] * dx) / det;
    return tex(Math.floor(u), Math.floor(v), x, y);
  });
}
// 벽면 좌표계. L 면은 왼쪽 모서리에서 앞 모서리로, R 면은 앞 모서리에서 오른쪽 모서리로 u 가 간다. v 는 아래로.
const UL = [1, 0.5], UR = [1, -0.5], VD = [0, 1];
/* 세상 상자 (wx, wy, wz) 에서 w×d 칸, 높이 h 도트. 세 면을 tex 로 칠한다.
   texL(u,v), texR(u,v), texT(u,v) 에서 u,v 는 그 면의 도트 좌표. 없으면 그 면은 건너뛴다. */
function box(q, wx, wy, wz, w, d, h, texL, texR, texT){
  const ew = w * S, ed = d * S;
  const back = proj(wx, wy, wz + h), left = proj(wx, wy + d, wz + h), front = proj(wx + w, wy + d, wz + h);
  if (h > 0 && texL) quad(q, left, UL, VD, ew, h, texL);
  if (h > 0 && texR) quad(q, front, UR, VD, ed, h, texR);
  if (texT) quad(q, back, UL, [-1, 0.5], ew, ed, texT);   // 윗면: u 는 x 축(오른아래), v 는 y 축(왼아래)
  return { back, left, front, right: proj(wx + w, wy, wz + h), ew, ed };
}
// 면 위에 무엇을 얹을 때 — 같은 평면의 (u0,v0) 에서 uw×vh 만큼
function onL(q, wx, wy, wz, w, d, h, u0, v0, uw, vh, tex){
  const P = proj(wx, wy + d, wz + h);
  quad(q, [P[0] + u0, P[1] + u0 * 0.5 + v0], UL, VD, uw, vh, tex);
}
function onR(q, wx, wy, wz, w, d, h, u0, v0, uw, vh, tex){
  const P = proj(wx + w, wy + d, wz + h);
  quad(q, [P[0] + u0, P[1] - u0 * 0.5 + v0], UR, VD, uw, vh, tex);
}
/* 원기둥. 바닥 타원의 한가운데 (cx, cy), 반지름 R 도트, 높이 h.
   tex(a, v) — a 는 왼쪽(0)에서 오른쪽(1)까지 둘레 자리, v 는 위에서 몇 도트. */
function cylinder(q, cx, cy, R, h, tex, topCol){
  for (let x = -R; x < R; x++){
    const f = Math.sqrt(Math.max(0, 1 - ((x + 0.5) / R) ** 2)) * (R / 2);
    const y0 = Math.round(cy - h + f), y1 = Math.round(cy + f);
    const a = (x + R + 0.5) / (2 * R);
    for (let y = y0; y < y1; y++){ const c = tex(a, y - y0, x, y); if (c) q(cx + x, y, 1, 1, c); }
  }
  if (topCol) ellipse(q, cx, cy - h, R, R / 2, topCol);
}
function ellipse(q, cx, cy, rx, ry, colorAt){
  for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++){
    const t = (y + 0.5 - cy) / ry; if (Math.abs(t) >= 1) continue;
    const hw = rx * Math.sqrt(1 - t * t);
    for (let x = Math.floor(cx - hw + 0.5); x + 0.5 < cx + hw; x++){
      const c = typeof colorAt === 'function' ? colorAt(x, y) : colorAt;
      if (c) q(x, y, 1, 1, c);
    }
  }
}
/* 원뿔 지붕. 바닥 타원 한가운데 (cx, cy), 반지름 R, 높이 h. tex(a, v, x, y) — a 는 왼(0)~오른(1), v 는 꼭대기에서 몇 도트. */
function cone(q, cx, cy, R, h, tex){
  const ay = cy - h;
  for (let x = -R; x < R; x++){
    const t = Math.abs(x + 0.5) / R;
    const yTop = Math.round(ay + t * h), f = Math.sqrt(Math.max(0, 1 - t * t)) * (R / 2);
    const yBot = Math.round(cy + f);
    const a = (x + R + 0.5) / (2 * R);
    for (let y = yTop; y < yBot; y++){ const c = tex(a, y - ay, x, y); if (c) q(cx + x, y, 1, 1, c); }
  }
}
// 문자열 스프라이트 (pixel.js 와 같은 형식). '.' 은 비움.
function spr(q, x, y, rows, pal){
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++){
    const ch = rows[r][c]; if (ch === '.' || ch === ' ') continue;
    const col = pal[ch]; if (col) q(x + c, y + r, 1, 1, col);
  }
}

// 아무 다각형이나 면 좌표계 (P0, U, V) 로 칠한다 — 지붕 경사면처럼 사다리꼴·삼각형일 때
function polyUV(q, pts, P0, U, V, tex){
  const det = U[0] * V[1] - U[1] * V[0];
  polyFill(q, pts, (x, y) => {
    const dx = x + 0.5 - P0[0], dy = y + 0.5 - P0[1];
    const u = (dx * V[1] - dy * V[0]) / det, v = (U[0] * dy - U[1] * dx) / det;
    return tex(Math.floor(u), Math.floor(v), x, y);
  });
}
// 두 점 사이에 한 도트씩 (브레젠험)
function lineDots(q, a, b, c){
  let x0 = Math.round(a[0]), y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]), y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 4000; n++){
    q(x0, y0, 1, 1, typeof c === 'function' ? c(x0, y0) : c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy){ err += dy; x0 += sx; }
    if (e2 <= dx){ err += dx; y0 += sy; }
  }
}

/* 재질. 전부 면 좌표 (u, v) 를 받아 색을 돌려주는 함수다. u 는 오른쪽, v 는 아래.
   언패킹처럼 보이려면 한 재질에 명도 4~5단계, 이음매, 잔 얼룩이 있어야 한다. */
const M = {};
M.pick = (arr, t) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(t * arr.length)))];
// 벽돌 — 4도트 한 켜(벽돌 3 + 줄눈 1), 벽돌 길이 8, 한 켜 걸러 반 칸씩 어긋난다
M.brick = (pal, seed, lit) => (u, v) => {
  const row = Math.floor(v / 4), off = row % 2 ? 4 : 0;
  if (v % 4 === 3) return pal.m;
  const uu = u + off, col = Math.floor(uu / 8);
  if (uu % 8 === 7) return pal.m;
  let c = M.pick(pal.a, hash(col, row, seed));
  if (v % 4 === 0 && uu % 8 === 0) c = shade(c, 10);          // 벽돌 왼쪽 위 모서리 반짝
  if (hash(u, v, seed + 7) < 0.06) c = shade(c, -8);           // 잔 얼룩
  return lit ? shade(c, lit) : c;
};
// 성벽 돌 — 켜 높이 6, 돌 길이 8~13, 줄눈은 어둡고 한 줄. 아래로 갈수록 이끼
M.stone = (pal, seed, lit, H) => (u, v) => {
  const row = Math.floor(v / 6);
  if (v % 6 === 5) return pal.m;
  // 켜마다 돌 길이가 다르다 — 그 켜의 잡음으로 마디를 정한다
  let x = -Math.floor(hash(row, 1, seed) * 9), k = 0;
  while (x + 8 + Math.floor(hash(row, k + 2, seed) * 5) <= u){ x += 8 + Math.floor(hash(row, k + 2, seed) * 5); k++; }
  const len = 8 + Math.floor(hash(row, k + 2, seed) * 5);
  if (u === x + len - 1) return pal.m;
  let c = M.pick(pal.a, hash(k, row, seed + 3));
  if (v % 6 === 0) c = shade(c, 8);                           // 돌 윗면 빛
  if (u === x) c = shade(c, 6);
  if (v % 6 === 4) c = shade(c, -6);                          // 아래 그늘
  if (hash(u, v, seed + 9) < 0.05) c = shade(c, -10);
  if (H && v > H - 14 && hash(u, v, seed + 11) < (v - (H - 14)) / 40) c = pal.moss;   // 밑동 이끼
  return lit ? shade(c, lit) : c;
};
// 회벽 — 잔 잡음과 밑동 얼룩
M.plaster = (pal, seed, lit, H) => (u, v) => {
  let c = pal.a;
  const n = hash(u, v, seed);
  if (n < 0.08) c = pal.b; else if (n > 0.96) c = shade(pal.a, 6);
  if (H && v > H - 6) c = pal.base || shade(pal.a, -26);       // 굽도리(돌 띠)
  else if (H && v > H - 10 && hash(u, v, seed + 5) < (v - (H - 10)) / 8) c = pal.c;
  return lit ? shade(c, lit) : c;
};
// 목재 뼈대(반목조) — 회벽 위에 진한 기둥·보·빗대
M.timber = (base, pal, W, H, bay, diag, seed) => (u, v) => {
  const beam = (u % bay < 2) || v < 2 || v >= H - 2 || (v >= Math.floor(H / 2) - 1 && v < Math.floor(H / 2) + 1) || u >= W - 2;
  const b = Math.floor(u / bay), bu = u % bay, bv = v < H / 2 ? v : v - Math.floor(H / 2), bh = Math.floor(H / 2);
  const dg = diag && diag[b % diag.length] && Math.abs((bu - 2) - (bv * (bay - 2) / bh)) < 1.2;
  if (beam || dg){
    let c = pal.beam;
    if (u % bay === 0 || v === 0 || (v === Math.floor(H / 2) - 1)) c = pal.beamHi;
    if (hash(u, v, seed) < 0.1) c = shade(c, -8);
    return c;
  }
  return base(u, v);
};
// 널빤지 — 가로. 5도트 한 장, 마지막 줄이 틈
M.planks = (pal, seed, lit, vertical) => (u, v) => {
  const a = vertical ? u : v, b = vertical ? v : u;
  const row = Math.floor(a / 5);
  if (a % 5 === 4) return pal.gap;
  let c = M.pick(pal.a, hash(row, Math.floor(b / 40), seed));
  if (a % 5 === 0) c = shade(c, 10);
  if (hash(b, row, seed + 1) < 0.12 && a % 5 === 2) c = shade(c, -10);   // 나뭇결
  if ((b + row * 7) % 23 === 0 && a % 5 === 1) c = shade(c, -18);        // 옹이·못
  return lit ? shade(c, lit) : c;
};
// 기와 — 4줄 한 단, 한 단 걸러 어긋난다. 단마다 위 그림자, 이음매, 왼쪽 위 반짝
M.tile = (pal, seed, lit) => (u, v) => {
  const row = Math.floor(v / 4), r = v % 4, off = row % 2 ? 3 : 0, uu = u + off;
  if (r === 0) return pal.edge;
  if (uu % 7 === 0) return pal.joint;
  let c = M.pick(pal.a, hash(Math.floor(uu / 7), row, seed));
  if (r === 1 && uu % 7 === 1) c = shade(c, 14);
  if (r === 3) c = shade(c, -8);
  return lit ? shade(c, lit) : c;
};
// 슬레이트 — 3줄 한 단, 5도트 폭. 어둡고 푸르스름
M.slate = (pal, seed, lit) => (u, v) => {
  const row = Math.floor(v / 3), r = v % 3, off = row % 2 ? 2 : 0, uu = u + off;
  if (r === 0) return pal.edge;
  if (uu % 5 === 0) return pal.joint;
  let c = M.pick(pal.a, hash(Math.floor(uu / 5), row, seed));
  if (r === 1 && uu % 5 === 1) c = shade(c, 10);
  return lit ? shade(c, lit) : c;
};
// 초가·짚 — 가로 결, 두 색이 섞인다
M.thatch = (pal, seed, lit) => (u, v) => {
  const n = hash(Math.floor(u / 2), v, seed), n2 = hash(u, Math.floor(v / 3), seed + 2);
  let c = n < 0.35 ? pal.a[0] : n < 0.75 ? pal.a[1] : pal.a[2];
  if (n2 < 0.08) c = pal.dark;
  if (v % 9 === 0 && n > 0.3) c = shade(c, -14);
  return lit ? shade(c, lit) : c;
};
// 천막 천 — 세로 줄무늬, 줄무늬마다 살짝 굴곡
M.canvas = (cols, w, seed, lit) => (u, v) => {
  const k = Math.floor(u / w) % cols.length, p = u % w;
  let c = cols[k];
  if (p === 0) c = shade(c, -12); else if (p === 1) c = shade(c, 8);
  if (hash(u, v, seed) < 0.03) c = shade(c, -6);
  return lit ? shade(c, lit) : c;
};
// 유리창 — 틀, 유리, 살, 반사. w×h 전체를 쓴다
M.window = (o) => {
  const w = o.w, h = o.h, fr = o.frame || '#f3eadb', frD = shade(fr, -50), gl = o.glass || '#9cc6dc';
  return (u, v) => {
    if (u < 0 || v < 0 || u >= w || v >= h) return null;
    if (o.arch){                                                  // 위가 둥근 창
      const r = w / 2, cx = u + 0.5 - r, cy = v + 0.5 - r;
      if (v < r && cx * cx + cy * cy > r * r) return null;
      if (v < r && cx * cx + cy * cy > (r - 1) * (r - 1)) return fr;
    }
    if (u === 0 || u === w - 1 || v === 0) return fr;
    if (v === h - 1) return frD;                                   // 틀 아래는 그늘
    if (o.mullion !== false && (u === Math.floor(w / 2) || (o.transom && v === Math.floor(h / 2)))) return frD;
    if (o.mullion !== false && (u === Math.floor(w / 2) - 1 || (o.transom && v === Math.floor(h / 2) - 1))) return fr;
    if (o.curtain && v < 4 && (u + v) % 3 !== 0) return o.curtain;   // 커튼 자락
    if (o.lit) return (u + v) % 5 === 0 ? shade(o.lit, 20) : o.lit;
    const d = u - v;                                                 // 비스듬한 반사
    if (d >= w - 5 && d <= w - 3) return shade(gl, 40);
    if (u + v < 4) return shade(gl, 26);
    if (u > w - 4 && v > h - 5) return shade(gl, -24);
    if (v > h - 3) return shade(gl, -12);
    return gl;
  };
};
// 문 — 틀, 판자 두 칸, 손잡이. 아치 선택
M.door = (o) => {
  const w = o.w, h = o.h, fr = o.frame || '#e8dcc8', wd = o.wood || '#6b4a30';
  return (u, v) => {
    if (u < 0 || v < 0 || u >= w || v >= h) return null;
    if (o.arch){ const r = w / 2, cx = u + 0.5 - r, cy = v + 0.5 - r; if (v < r && cx * cx + cy * cy > r * r) return null;
                 if (v < r && cx * cx + cy * cy > (r - 1.2) * (r - 1.2)) return fr; }
    if (u === 0 || u === w - 1 || v === 0) return fr;
    if (o.glass && v < h * 0.45 && u > 1 && u < w - 2 && v > 1) return (u - v) % 6 === 0 ? shade(o.glass, 30) : o.glass;
    const inset = (u >= 2 && u <= w - 3 && ((v >= 2 && v <= Math.floor(h / 2) - 1) || (v >= Math.floor(h / 2) + 1 && v <= h - 3)));
    if (inset && (u === 2 || v === 2 || v === Math.floor(h / 2) + 1)) return shade(wd, -22);
    if (inset && (u === w - 3 || v === Math.floor(h / 2) - 1 || v === h - 3)) return shade(wd, 14);
    if (u === w - 3 && v === Math.floor(h / 2)) return '#ffd166';         // 손잡이
    if (v === h - 1) return shade(wd, -30);
    let c = wd; if (u % 4 === 3) c = shade(wd, -8);
    return c;
  };
};
// 창턱·화분 — 창 아래에 얹는다. w 는 창 너비
M.sill = (w, col) => (u, v) => (u < -1 || u > w) ? null : v === 0 ? (col || '#efe4d2') : v === 1 ? shade(col || '#efe4d2', -40) : null;
M.flowerBox = (w, seed) => (u, v) => {
  if (u < -1 || u > w) return null;
  if (v === 0) return (u + seed) % 3 === 0 ? '#e85d75' : (u + seed) % 3 === 1 ? '#ffd166' : '#5fa85c';
  if (v === 1) return '#6fb567';
  if (v === 2 || v === 3) return u === -1 ? '#a97b4f' : u === w ? '#6f4a2c' : v === 2 ? '#8f6a42' : '#7a5636';
  return null;
};
// 간판 — 나무 판에 밝은 띠
M.sign = (w, h, col) => (u, v) => {
  if (u < 0 || v < 0 || u >= w || v >= h) return null;
  if (u === 0 || v === 0) return shade(col, 22);
  if (u === w - 1 || v === h - 1) return shade(col, -36);
  return col;
};

/* 건물 조립. 벽 상자 + 지붕 + 창·문·굴뚝. 세상 좌표는 칸 단위, 높이는 도트. */
const B = {};
const CAM = [1, 1, 1];                                   // 카메라 쪽 — 이쪽을 보는 면만 보인다
B.visible = N => N[0] * CAM[0] + N[1] * CAM[1] + N[2] * CAM[2] > 0;
// 벽 네 면 중 보이는 두 면. bx = {x,y,z,w,d,h}
B.walls = (q, bx, texL, texR) => box(q, bx.x, bx.y, bx.z, bx.w, bx.d, bx.h, texL, texR, null);
B.slab = (q, bx, top, lf, rt) => box(q, bx.x, bx.y, bx.z, bx.w, bx.d, bx.h, () => lf, () => rt, () => top);
// 처마 밑 그늘 — 벽 맨 위 몇 줄을 반투명으로 어둡게
B.eaveShadow = (q, bx, rows) => {
  const t = (u, v) => 'rgba(40,26,14,' + (0.30 - v * (0.30 / rows)).toFixed(2) + ')';
  onL(q, bx.x, bx.y, bx.z, bx.w, bx.d, bx.h, 0, 0, bx.w * S, rows, t);
  onR(q, bx.x, bx.y, bx.z, bx.w, bx.d, bx.h, 0, 0, bx.d * S, rows, t);
};
// 면 위의 물건 — side 'L' 또는 'R', (u,v) 는 그 면에서의 자리, tex 는 (0,0) 기준
B.on = (q, side, bx, u, v, w, h, tex) => (side === 'L' ? onL : onR)(q, bx.x, bx.y, bx.z, bx.w, bx.d, bx.h, u, v, w, h, tex);
// 창 — 창턱과 화분까지
B.win = (q, side, bx, u, v, w, h, o) => {
  o = o || {};
  // 밤에는 창의 일부에 불이 켜진다 — 몇 집인지는 LIT_P(시각), 어느 창인지는 자리로 정해 늘 같다
  if (NIGHT && !o.lit && o.night !== false && hash(Math.round(bx.x * 10) + u, Math.round(bx.y * 10) + v, 77) < LIT_P)
    o = Object.assign({}, o, { lit: o.glass && o.glass < '#5' ? '#d9a44a' : '#ffd77a' });
  B.on(q, side, bx, u, v, w, h, M.window(Object.assign({ w, h }, o)));
  if (o.lit) LIGHTS.push(Object.assign(B.faceCenter(side, bx, u + w / 2, v + h / 2), { r: Math.max(w, h) * 1.3, c: o.lit }));
  if (o.flowers) B.on(q, side, bx, u - 1, v + h - 2, w + 2, 4, (uu, vv) => M.flowerBox(w, o.flowers)(uu - 1, vv));
  else if (o.sill !== false) B.on(q, side, bx, u - 1, v + h, w + 2, 2, (uu, vv) => M.sill(w, o.sillCol)(uu - 1, vv));
  if (o.shutters){
    const sh = (uu, vv) => vv < 0 || vv >= h ? null : (uu === 0 || uu === 3) ? shade(o.shutters, -30) : (vv % 3 === 2 ? shade(o.shutters, -18) : o.shutters);
    B.on(q, side, bx, u - 4, v, 4, h, sh); B.on(q, side, bx, u + w, v, 4, h, sh);
  }
};
// 면 위 (u,v) 의 화면 자리
B.faceCenter = (side, bx, u, v) => {
  const P0 = side === 'L' ? proj(bx.x, bx.y + bx.d, bx.z + bx.h) : proj(bx.x + bx.w, bx.y + bx.d, bx.z + bx.h);
  return { x: P0[0] + u, y: P0[1] + (side === 'L' ? 1 : -1) * u * 0.5 + v };
};
B.door = (q, side, bx, u, v, w, h, o) => {
  B.on(q, side, bx, u, v, w, h, M.door(Object.assign({ w, h }, o || {})));
  // 문턱 돌
  B.on(q, side, bx, u - 1, v + h, w + 2, 2, (uu, vv) => vv === 0 ? '#d9cdb8' : '#9c8f7a');
};
/* 지붕. o = { x0,y0,x1,y1 (처마 사각형, 세상), ze, zr, axis:'x'|'y', at, r0, r1, tex(face, lit) → (u,v)→색, cap:[밝,어둠] }
   face 는 py(왼앞) px(오른앞) my(뒤) mx(왼뒤). 뒤쪽 면은 지붕이 완만할 때만 보인다. */
B.roof = (q, o) => {
  const dz = o.zr - o.ze, faces = [];
  const mk = (name, eA, eB, rA, rB, along) => {
    // 바깥 법선 — 처마→마루 벡터와 처마 방향의 외적. z 가 위를 보게 뒤집는다
    const up = along === 'x' ? [0, rA[1] - eA[1], dz / S] : [rA[0] - eA[0], 0, dz / S];
    const a = along === 'x' ? [1, 0, 0] : [0, 1, 0];
    let N = [a[1] * up[2] - a[2] * up[1], a[2] * up[0] - a[0] * up[2], a[0] * up[1] - a[1] * up[0]];
    if (N[2] < 0) N = N.map(k => -k);
    if (!B.visible(N)) return;
    const pts = [proj(eA[0], eA[1], o.ze), proj(eB[0], eB[1], o.ze)];
    const ra = proj(rA[0], rA[1], o.zr), rb = proj(rB[0], rB[1], o.zr);
    if (rA[0] !== rB[0] || rA[1] !== rB[1]) pts.push(rb); pts.push(ra);
    const ex = pts[1][0] - pts[0][0], ey = pts[1][1] - pts[0][1], el = Math.abs(ex) || 1;
    const U = [ex / el, ey / el];
    const Vt = along === 'x' ? [ (eA[1] - rA[1]) * S, (rA[1] - eA[1]) * (S / 2) - dz ]
                             : [ (rA[0] - eA[0]) * S, (rA[0] - eA[0]) * (S / 2) - dz ];
    const rows = Math.max(1, Math.abs(Vt[1]));
    const V = [Vt[0] / rows, Vt[1] / rows];
    const tex = o.tex(name);
    faces.push({ name, pts, P0: pts[0], U, V, rows, tex, order: name === 'py' || name === 'px' ? 1 : 0 });
  };
  const { x0, y0, x1, y1 } = o;
  if (o.axis === 'x'){
    const ry = o.at, r0 = [o.r0, ry], r1 = [o.r1, ry];
    mk('my', [x0, y0], [x1, y0], r0, r1, 'x');
    mk('py', [x0, y1], [x1, y1], r0, r1, 'x');
    if (o.r0 > x0) mk('mx', [x0, y1], [x0, y0], r0, r0, 'y');
    if (o.r1 < x1) mk('px', [x1, y0], [x1, y1], r1, r1, 'y');
  } else {
    const rx = o.at, r0 = [rx, o.r0], r1 = [rx, o.r1];
    mk('mx', [x0, y1], [x0, y0], r1, r0, 'y');
    mk('px', [x1, y0], [x1, y1], r0, r1, 'y');
    if (o.r0 > y0) mk('my', [x0, y0], [x1, y0], r0, r0, 'x');
    if (o.r1 < y1) mk('py', [x0, y1], [x1, y1], r1, r1, 'x');
  }
  faces.sort((a, b) => a.order - b.order);
  faces.forEach(f => polyUV(q, f.pts, f.P0, f.U, f.V, (u, v) => f.tex(u, f.rows - 1 - v)));
  // 용마루 — 두 줄, 위는 밝고 아래는 어둡다
  const cap = o.cap || ['#e6d2b8', '#6b4a3a'];
  const A = o.axis === 'x' ? proj(o.r0, o.at, o.zr) : proj(o.at, o.r0, o.zr);
  const Bp = o.axis === 'x' ? proj(o.r1, o.at, o.zr) : proj(o.at, o.r1, o.zr);
  if (A[0] !== Bp[0]){
    const len = Math.abs(Bp[0] - A[0]), U = [(Bp[0] - A[0]) / len, (Bp[1] - A[1]) / len];
    quad(q, [Math.min(A[0], Bp[0]), A[0] < Bp[0] ? A[1] - 1 : Bp[1] - 1], [1, U[1] * Math.sign(U[0])], [0, 1], len, 2, (u, v) => v === 0 ? cap[0] : cap[1]);
  } else q(A[0] - 1, Math.min(A[1], Bp[1]) - 1, 2, 2, cap[0]);
  // 추녀마루 — 마루 끝에서 처마 모서리로 밝은 선 (모임지붕일 때)
  // 추녀마루는 은은하게 — 밝은 선을 그으면 기둥처럼 보인다
  const hipCol = o.hip || mix(cap[0], cap[1], 0.55);
  const hipLine = (r, e) => lineDots(q, proj(r[0], r[1], o.zr), proj(e[0], e[1], o.ze), hipCol);
  if (o.axis === 'x'){
    if (o.r1 < x1){ hipLine([o.r1, o.at], [x1, y1]); hipLine([o.r1, o.at], [x1, y0]); }
    if (o.r0 > x0) hipLine([o.r0, o.at], [x0, y1]);
  } else {
    if (o.r1 < y1){ hipLine([o.at, o.r1], [x1, y1]); hipLine([o.at, o.r1], [x0, y1]); }
    if (o.r0 > y0) hipLine([o.at, o.r0], [x1, y0]);
  }
};
// 벽 상자에 맞춘 지붕 — 모임(hip) 또는 박공(gable). over 는 처마 내밈(칸), rise 는 마루 높이(도트), drop 은 처마가 벽보다 얼마나 낮은지
B.roofFor = (q, bx, o) => {
  const over = o.over == null ? 0.22 : o.over, drop = o.drop == null ? 3 : o.drop;
  const axis = o.axis || (bx.w >= bx.d ? 'x' : 'y');
  const hip = o.type === 'hip';
  const R = { x0: bx.x - over, y0: bx.y - over, x1: bx.x + bx.w + over, y1: bx.y + bx.d + over,
              ze: bx.z + bx.h - drop, zr: bx.z + bx.h + o.rise, axis, tex: o.tex, cap: o.cap };
  if (axis === 'x'){ R.at = bx.y + bx.d / 2; R.r0 = hip ? bx.x + bx.d / 2 : R.x0; R.r1 = hip ? bx.x + bx.w - bx.d / 2 : R.x1; }
  else { R.at = bx.x + bx.w / 2; R.r0 = hip ? bx.y + bx.w / 2 : R.y0; R.r1 = hip ? bx.y + bx.d - bx.w / 2 : R.y1; }
  if (o.ridgeInset){ R.r0 += o.ridgeInset; R.r1 -= o.ridgeInset; }
  B.roof(q, R);
  return R;
};
// 박공 벽 — 지붕이 박공이면 보이는 면 위에 삼각형을 채운다 (지붕보다 먼저)
B.gable = (q, bx, o, tex) => {
  const axis = o.axis || (bx.w >= bx.d ? 'x' : 'y'), zw = bx.z + bx.h, zr = zw + o.rise;
  if (axis === 'x'){                                   // +x 면(R)에 삼각형
    const P = proj(bx.x + bx.w, bx.y + bx.d, zw);
    polyUV(q, [P, proj(bx.x + bx.w, bx.y, zw), proj(bx.x + bx.w, bx.y + bx.d / 2, zr)], P, UR, VD, (u, v) => tex(u, v + o.rise));
  } else {                                             // +y 면(L)에 삼각형
    const P = proj(bx.x, bx.y + bx.d, zw);
    polyUV(q, [P, proj(bx.x + bx.w, bx.y + bx.d, zw), proj(bx.x + bx.w / 2, bx.y + bx.d, zr)], P, UL, VD, (u, v) => tex(u, v + o.rise));
  }
};
// 굴뚝 — 지붕 위 벽돌 기둥과 갓
B.chimney = (q, x, y, zb, h, pal) => {
  const w = 0.28, d = 0.28;
  const bp = pal || { a: ['#a8664f', '#9a5a45', '#8d5040'], m: '#c9b39a' };
  box(q, x, y, zb, w, d, h, M.brick(bp, 3), M.brick(bp, 3, -28), () => '#6a5a50');
  box(q, x - 0.05, y - 0.05, zb + h, w + 0.1, d + 0.1, 2, () => '#8a7c70', () => '#6a5e54', () => '#a89a8c');
  const T = proj(x + w / 2, y + d / 2, zb + h + 2);
  q(T[0] - 2, T[1] - 2, 4, 2, '#3a3230'); q(T[0] - 1, T[1] - 3, 2, 1, '#5a5250');
};
// 차양 — 벽에서 바깥으로 비스듬히 내민 줄무늬 천. side 'L' 만 (앞왼쪽 벽)
B.awning = (q, bx, u, w, v, cols, depth) => {
  depth = depth || 7;
  const P = proj(bx.x, bx.y + bx.d, bx.z + bx.h);
  const P0 = [P[0] + u, P[1] + u * 0.5 + v];
  // 바깥(+y)으로 나가며 아래로 처진다: 한 줄에 (-1, +0.5) 로 나가고 0.6 씩 더 내려간다
  quad(q, P0, UL, [-1, 1.1], w, depth, M.canvas(cols, 4, 5));
  // 물결 가장자리
  for (let i = 0; i < w; i += 4) q(P0[0] + i - depth, P0[1] + Math.floor(i / 2) + Math.round(depth * 1.1) + 1, 3, 1, shade(cols[(Math.floor(i / 4)) % cols.length], -30));
};

/* 소품. 대부분 앞에서 본 그림이고 (X, Y) 는 바닥에 닿는 한가운데 도트. */
const P = {};
/* 잎 덩어리 — 타원 여러 개를 합친 뒤 왼쪽 위 빛으로 5단계 명암을 주고, 잎 뭉치 잡음을 얹는다.
   blobs: [[cx, cy, rx, ry]...], pal: 밝은 것부터 5색 */
P.foliage = (q, blobs, pal, seed, opt) => {
  opt = opt || {};
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  blobs.forEach(b => { x0 = Math.min(x0, b[0] - b[2]); x1 = Math.max(x1, b[0] + b[2]); y0 = Math.min(y0, b[1] - b[3]); y1 = Math.max(y1, b[1] + b[3]); });
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++){
    let best = -1;
    for (const b of blobs){
      const nx = (x + 0.5 - b[0]) / b[2], ny = (y + 0.5 - b[1]) / b[3], r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      // 공처럼 — 왼쪽 위가 밝다. 가장자리로 갈수록 어둡다
      const l = 0.62 - nx * 0.30 - ny * 0.42 - r2 * 0.28;
      best = Math.max(best, l);
    }
    if (best < 0) continue;
    const clump = hash(x >> 2, y >> 2, seed) - 0.5, fine = hash(x, y, seed + 1) - 0.5;
    let t = (1 - best) * 1.25 + clump * 0.55 + fine * 0.28 + (opt.bias || 0);
    const idx = Math.max(0, Math.min(pal.length - 1, Math.round(t * (pal.length - 1))));
    q(x, y, 1, 1, pal[idx]);
  }
};
P.TREE_PAL = ['#b9e08a', '#8fcb6d', '#6cb457', '#4f9747', '#3a7a3a', '#2c5f30'];
P.PINE_PAL = ['#8fc98a', '#5fa66a', '#437f52', '#2f6540', '#224d33'];
P.BLOSSOM_PAL = ['#ffe4ec', '#ffc3d6', '#f7a2bd', '#e88aa6', '#c9698a'];
// 줄기 — 껍질 결, 오른쪽이 어둡다
P.trunk = (q, X, Y, w, h, pal) => {
  pal = pal || ['#a67a52', '#8d6440', '#70502f', '#4e3722'];
  for (let y = 0; y < h; y++){
    const ww = w + (y > h * 0.75 ? Math.round((y - h * 0.75) / (h * 0.25) * 2) : 0);
    for (let x = 0; x < ww; x++){
      const t = x / ww;
      let c = t < 0.2 ? pal[0] : t < 0.55 ? pal[1] : t < 0.8 ? pal[2] : pal[3];
      if (hash(x, y >> 1, 3) < 0.15) c = shade(c, -14);
      if (y % 7 === 3 && hash(x, y, 4) < 0.4) c = shade(c, -10);
      q(X - Math.floor(ww / 2) + x, Y - h + y, 1, 1, c);
    }
  }
};
// 둥근 나무. size 1(작은)~3(큰)
P.tree = (q, X, Y, size, seed, pal) => {
  pal = pal || P.TREE_PAL;
  const s = 8 + size * 5, th = 10 + size * 5;
  P.trunk(q, X, Y, 3 + size, th + 4);
  // 가지 두 개
  q(X - 3, Y - th - 2, 3, 2, '#70502f'); q(X + 1, Y - th - 5, 3, 2, '#70502f');
  const cy = Y - th - s * 0.55;
  const blobs = [[X - s * 0.45, cy + s * 0.15, s * 0.6, s * 0.5], [X + s * 0.5, cy + s * 0.2, s * 0.55, s * 0.48],
                 [X, cy - s * 0.35, s * 0.62, s * 0.5], [X, cy + s * 0.1, s * 0.85, s * 0.62], [X + s * 0.15, cy - s * 0.05, s * 0.5, s * 0.45]];
  P.foliage(q, blobs, pal, seed);
  // 잎 사이로 보이는 빛 몇 점
  for (let i = 0; i < 4 + size * 2; i++){ const a = hash(i, 1, seed) * 6.28, r = hash(i, 2, seed) * s * 0.7; q(Math.round(X + Math.cos(a) * r * 1.2), Math.round(cy + Math.sin(a) * r * 0.8), 2, 1, pal[0]); }
  // 그림자
  P.shadow(q, X, Y, s * 0.9, 3);
};
// 그림자는 테두리 겹이 아니라 땅에 찍어야 접시처럼 보이지 않는다 — SHADOW_Q 가 있으면 거기에
let SHADOW_Q = null;
P.shadow = (q, X, Y, rx, ry) => ellipse(SHADOW_Q || q, X, Y - 1, rx, ry, 'rgba(30,40,20,0.22)');
// 침엽수 — 세 층
P.pine = (q, X, Y, size, seed) => {
  const pal = P.PINE_PAL, h = 26 + size * 8, w = 10 + size * 3;
  P.trunk(q, X, Y, 3, 8);
  for (let k = 2; k >= 0; k--){
    const top = Y - h + k * (h * 0.24), base = top + h * 0.42, hw = w * (0.55 + k * 0.25);
    for (let y = Math.round(top); y < Math.round(base); y++){
      const t = (y - top) / (base - top), half = Math.max(1, Math.round(hw * t));
      for (let x = -half; x <= half; x++){
        const nx = x / half, l = 0.65 - nx * 0.35 - t * 0.3 + (hash(x, y, seed) - 0.5) * 0.3;
        const idx = Math.max(0, Math.min(pal.length - 1, Math.round((1 - l) * (pal.length - 1))));
        q(X + x, y, 1, 1, pal[idx]);
      }
    }
  }
  P.shadow(q, X, Y, w, 3);
};
P.bush = (q, X, Y, w, seed, pal) => {
  pal = pal || P.TREE_PAL;
  P.foliage(q, [[X - w * 0.3, Y - w * 0.32, w * 0.42, w * 0.32], [X + w * 0.3, Y - w * 0.3, w * 0.4, w * 0.3], [X, Y - w * 0.45, w * 0.45, w * 0.36]], pal, seed, { bias: 0.15 });
  P.shadow(q, X, Y, w * 0.5, 2);
};
// 산울타리 — 세상 상자에 잎 재질
P.hedge = (q, x, y, w, d, h, seed) => {
  const pal = ['#8fcb6d', '#6cb457', '#4f9747', '#3a7a3a'];
  const tex = lit => (u, v) => { const n = hash(u >> 1, v >> 1, seed) * 0.6 + hash(u, v, seed + 1) * 0.4; let c = pal[Math.min(3, Math.floor(n * 3.4))]; return shade(c, lit); };
  box(q, x, y, 0, w, d, h, tex(0), tex(-26), tex(18));
};
// 울타리 — (x0,y0) 에서 축을 따라 len 칸. axis 'x'|'y'
P.fence = (q, x0, y0, len, axis, col) => {
  col = col || '#b98a5e';
  const dark = shade(col, -40), hi = shade(col, 18);
  const n = Math.round(len * 2);
  const at = i => axis === 'x' ? proj(x0 + i / 2, y0, 0) : proj(x0, y0 + i / 2, 0);
  // 가로대 두 개 — 기둥보다 먼저 (기둥이 앞에 온다)
  for (let i = 0; i < n; i++){
    const a = at(i), b = at(i + 1), dir = axis === 'x' ? 1 : -1;
    const L = Math.abs(b[0] - a[0]);
    for (const hgt of [5, 10]){
      for (let k = 0; k < L; k++){ const xx = a[0] + k * dir, yy = a[1] + Math.floor(k / 2) - hgt; q(xx, yy - 1, 1, 2, shade(col, -8)); q(xx, yy - 1, 1, 1, hi); }
    }
  }
  for (let i = 0; i <= n; i++){
    const a = at(i);
    q(a[0] - 1, a[1] - 14, 3, 14, col); q(a[0] + 1, a[1] - 14, 1, 14, dark); q(a[0] - 1, a[1] - 15, 3, 1, hi); q(a[0] - 1, a[1] - 1, 3, 1, dark);
  }
};
// 가로등 — 쇠기둥, 유리등, 받침
P.lamp = (q, X, Y, on) => {
  const iron = '#2e3a3a', ironHi = '#4a5a58';
  q(X - 3, Y - 3, 6, 3, '#6a6a66'); q(X - 3, Y - 4, 6, 1, '#8c8c86');
  q(X - 1, Y - 30, 2, 27, iron); q(X - 1, Y - 30, 1, 27, ironHi);
  q(X - 2, Y - 33, 4, 3, iron);
  // 등갓
  q(X - 4, Y - 44, 8, 2, iron); q(X - 5, Y - 42, 10, 1, iron);
  const gl = on ? '#ffd77a' : '#dfe8ee';
  q(X - 4, Y - 41, 8, 8, gl); q(X - 4, Y - 41, 1, 8, iron); q(X + 3, Y - 41, 1, 8, iron);
  q(X - 3, Y - 40, 2, 2, on ? '#fff3c4' : '#f4f8fb');
  q(X - 4, Y - 33, 8, 1, iron); q(X - 1, Y - 46, 2, 2, iron);
  if (on){ ellipse(q, X, Y - 37, 9, 6, (x, y) => (x + y) % 2 ? null : 'rgba(255,215,120,0.18)'); LIGHTS.push({ x: X, y: Y - 37, r: 30, c: '#ffd77a' }); }
};
// 벤치 — 나무 널과 쇠다리
P.bench = (q, X, Y) => {
  const w = 22, wood = '#b98a5e', iron = '#3a3a3a';
  q(X - w / 2 + 2, Y - 3, 2, 3, iron); q(X + w / 2 - 4, Y - 3, 2, 3, iron);
  for (let i = 0; i < 3; i++){ q(X - w / 2, Y - 6 - i * 3, w, 2, i === 1 ? shade(wood, -10) : wood); q(X - w / 2, Y - 6 - i * 3, w, 1, shade(wood, 16)); }
  q(X - w / 2 + 1, Y - 12, 2, 6, iron); q(X + w / 2 - 3, Y - 12, 2, 6, iron);
  for (let i = 0; i < 2; i++){ q(X - w / 2, Y - 16 - i * 3, w, 2, wood); q(X - w / 2, Y - 16 - i * 3, w, 1, shade(wood, 16)); }
  q(X - w / 2 + 1, Y - 19, 2, 8, iron); q(X + w / 2 - 3, Y - 19, 2, 8, iron);
};
// 우체통 — 빨간 원기둥
P.pillarBox = (q, X, Y) => {
  cylinder(q, X, Y, 4, 13, (a, v) => { const c = a < 0.3 ? '#ff6b62' : a < 0.65 ? '#e04f47' : '#b53a34'; return v === 6 || v === 7 ? shade(c, -50) : v === 3 && a > 0.2 && a < 0.7 ? '#2a2622' : c; });
  ellipse(q, X, Y - 13, 5, 2.5, '#2a2622'); ellipse(q, X, Y - 14, 4, 2, '#3c3834'); q(X - 1, Y - 16, 2, 2, '#2a2622');
};
// 술통
P.barrel = (q, X, Y) => {
  cylinder(q, X, Y, 4, 9, (a, v) => { const k = Math.floor(a * 6); let c = ['#c8a072', '#b88e60', '#a47c50', '#8f6a42', '#7a5636', '#6a4a30'][k]; if (v === 2 || v === 6) c = '#5a5652'; if (v === 1 || v === 5) c = '#8a8680'; return c; });
  ellipse(q, X, Y - 9, 4, 2, '#8f6a42'); ellipse(q, X, Y - 9.5, 3, 1.5, '#a47c50');
};
P.crate = (q, x, y, w) => {
  const pal = { a: ['#c8a072', '#b88e60', '#a47c50'], gap: '#6a4a30' };
  box(q, x, y, 0, w, w, w * S * 0.9, M.planks(pal, 2, 0, true), M.planks(pal, 3, -26, true), M.planks(pal, 4, 16));
};
// 우물 — 돌 원기둥, 기둥 둘, 작은 기와 지붕, 두레박
P.well = (q, X, Y) => {
  const stP = { a: ['#c9c2b4', '#b3aa9b', '#9c9385'], m: '#7a7268', moss: '#7f9a5a' }, st = M.stone(stP, 8, 0, 12);
  cylinder(q, X, Y, 9, 12, (a, v) => { const c = st(Math.round(Math.acos(1 - 2 * a) / Math.PI * 30), v); return c === stP.m ? c : shade(c, a < 0.5 ? 8 : -22); });
  ellipse(q, X, Y - 12, 9, 4.5, '#8a8276'); ellipse(q, X, Y - 12, 6, 3, '#1f2a30');
  q(X - 8, Y - 34, 2, 22, '#8d6440'); q(X + 6, Y - 34, 2, 22, '#70502f');
  q(X - 1, Y - 24, 2, 8, '#5a4a3a'); q(X - 3, Y - 18, 6, 4, '#8a8276');            // 두레박
  q(X - 8, Y - 29, 16, 1, '#4e3722');
  for (let i = 0; i < 6; i++){ q(X - 12 + i, Y - 34 - i, 24 - 2 * i, 1, i % 2 ? '#a55340' : '#c9705a'); }
  q(X - 12, Y - 33, 24, 1, '#7c3a2c');
};
// 분수 — 돌 물받이, 물, 가운데 기둥과 윗접시
P.fountain = (q, X, Y) => {
  const st = ['#d3cbbd', '#bfb6a6', '#a69d8e', '#8f8677'];
  cylinder(q, X, Y, 20, 8, (a, v) => { let c = a < 0.35 ? st[1] : a < 0.7 ? st[2] : st[3]; if (v === 0) c = st[0]; if (v === 7) c = shade(c, -14); if (hash(Math.round(a * 60), v, 5) < 0.06) c = shade(c, -10); return c; });
  ellipse(q, X, Y - 8, 20, 10, st[0]);
  ellipse(q, X, Y - 8, 17, 8.5, (x, y) => { const n = hash(x, y, 9); return (x + y) % 7 === 0 ? '#8ec7e8' : n < 0.08 ? '#bfe4f4' : '#5fa8d3'; });
  cylinder(q, X, Y - 10, 4, 14, (a, v) => a < 0.5 ? st[1] : st[3]);
  cylinder(q, X, Y - 24, 10, 3, (a, v) => a < 0.5 ? st[1] : st[3]);
  ellipse(q, X, Y - 27, 10, 5, st[0]); ellipse(q, X, Y - 27, 8, 4, '#7fbfe0');
  cylinder(q, X, Y - 28, 2, 6, (a) => a < 0.5 ? st[1] : st[3]);
  // 물줄기
  for (let i = 0; i < 14; i++){ const t = i / 14; q(Math.round(X - 2 - t * 9), Math.round(Y - 34 - Math.sin(t * 3.14) * 10 + t * 8), 1, 1, i % 2 ? '#bfe4f4' : '#e8f6fb'); q(Math.round(X + 2 + t * 9), Math.round(Y - 34 - Math.sin(t * 3.14) * 10 + t * 8), 1, 1, i % 2 ? '#bfe4f4' : '#e8f6fb'); }
  q(X - 1, Y - 40, 2, 6, '#e8f6fb');
};
// 팻말 — 기둥에 화살표 판 둘
P.signpost = (q, X, Y) => {
  q(X - 2, Y - 34, 4, 34, '#8d6440'); q(X + 1, Y - 34, 1, 34, '#4e3722'); q(X - 2, Y - 35, 4, 1, '#a67a52');
  const board = (y, w, col, dir) => { for (let i = 0; i < w; i++){ const tip = dir > 0 ? i > w - 4 ? (i - (w - 4)) : 0 : i < 3 ? 3 - i : 0; q(X - (dir > 0 ? 3 : w - 3) + i, y + tip, 1, 7 - tip * 2, col); q(X - (dir > 0 ? 3 : w - 3) + i, y + tip, 1, 1, shade(col, 26)); } };
  board(Y - 31, 22, '#ffd166', 1); board(Y - 21, 20, '#8fd9c8', -1);
  q(X - 1, Y - 3, 3, 3, '#6a5a4a');
};
// 이젤 — 그림 한 장
P.easel = (q, X, Y) => {
  const wd = '#a67a52';
  q(X - 8, Y - 26, 2, 26, wd); q(X + 6, Y - 26, 2, 26, wd); q(X - 1, Y - 24, 2, 12, shade(wd, -30));
  q(X - 9, Y - 12, 18, 2, wd);
  q(X - 10, Y - 30, 20, 17, '#fff6e9'); q(X - 10, Y - 30, 20, 1, '#e0d4c0'); q(X + 9, Y - 30, 1, 17, '#d8ccb6');
  // 그림 — 언덕과 해
  q(X - 8, Y - 28, 16, 13, '#a8d8f2'); q(X - 8, Y - 20, 16, 5, '#6fb567'); q(X - 8, Y - 18, 16, 3, '#559b50');
  q(X + 2, Y - 26, 4, 4, '#ffd166'); q(X - 5, Y - 21, 3, 3, '#ff8fb8'); q(X + 1, Y - 19, 2, 2, '#ff8fb8');
};
// 허수아비
P.scarecrow = (q, X, Y) => {
  q(X - 1, Y - 30, 2, 30, '#8d6440'); q(X - 9, Y - 22, 18, 2, '#8d6440');
  q(X - 6, Y - 23, 12, 10, '#5aa9e6'); q(X - 6, Y - 23, 12, 1, '#7fbfe0'); q(X - 2, Y - 13, 4, 6, '#ffd166');
  q(X - 10, Y - 23, 4, 2, '#e8c46a'); q(X + 6, Y - 23, 4, 2, '#e8c46a');
  q(X - 4, Y - 31, 8, 8, '#f2d29a'); q(X - 2, Y - 29, 1, 1, '#2a2622'); q(X + 1, Y - 29, 1, 1, '#2a2622'); q(X - 1, Y - 26, 2, 1, '#c96a4a');
  q(X - 7, Y - 33, 14, 2, '#c9a05a'); q(X - 4, Y - 38, 8, 5, '#c9a05a'); q(X - 4, Y - 35, 8, 1, '#b04a3c');
  for (let i = -2; i < 3; i++) q(X + i * 2, Y - 13 + Math.abs(i), 1, 3, '#e8c46a');
};
// 만국기 — 두 점 사이에 처진 줄과 삼각 깃발
P.bunting = (q, a, b, cols) => {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
  let prev = null;
  for (let i = 0; i <= n; i++){
    const t = i / n, sag = Math.sin(t * Math.PI) * 6;
    const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t + sag);
    if (prev) lineDots(q, prev, [x, y], '#5a4a3a');
    prev = [x, y];
    if (i < n){ const c = cols[i % cols.length]; q(x - 1, y + 1, 4, 2, c); q(x, y + 3, 2, 1, c); q(x, y + 4, 1, 1, shade(c, -30)); }
  }
};
// 꽃·풀 — 땅에 직접
P.flower = (q, X, Y, col) => { q(X, Y - 2, 1, 2, '#4f9747'); q(X - 1, Y - 3, 3, 1, col); q(X, Y - 4, 1, 1, col); q(X, Y - 3, 1, 1, shade(col, 40)); };
P.tuft = (q, X, Y, col) => { q(X - 1, Y - 2, 1, 2, col); q(X + 1, Y - 3, 1, 3, col); q(X, Y - 1, 1, 1, col); };
P.rock = (q, X, Y, w) => { ellipse(q, X, Y - w * 0.25, w * 0.5, w * 0.3, (x, y) => { const nx = (x - X) / w, ny = (y - Y + w * 0.25) / w; return nx + ny < -0.15 ? '#c2bab0' : nx + ny < 0.1 ? '#a49c92' : '#857d75'; }); };
// 고양이 — 옆모습, 앉아 있음
P.cat = (q, X, Y, col) => {
  col = col || '#f2a65a'; const d = shade(col, -40);
  q(X - 5, Y - 6, 9, 6, col); q(X - 5, Y - 6, 9, 1, shade(col, 16)); q(X + 3, Y - 10, 5, 6, col);
  q(X + 3, Y - 12, 2, 2, col); q(X + 6, Y - 12, 2, 2, col); q(X + 4, Y - 8, 1, 1, '#2a2622'); q(X + 7, Y - 8, 1, 1, '#2a2622');
  q(X - 8, Y - 3, 3, 1, col); q(X - 9, Y - 5, 2, 3, col); q(X - 3, Y - 3, 4, 1, d); q(X + 5, Y - 5, 1, 1, '#e07070');
};
// 오리
P.duck = (q, X, Y) => { q(X - 4, Y - 5, 8, 4, '#fff6e9'); q(X - 4, Y - 5, 8, 1, '#ffffff'); q(X + 2, Y - 9, 4, 5, '#fff6e9'); q(X + 5, Y - 7, 3, 2, '#f7b733'); q(X + 3, Y - 8, 1, 1, '#2a2622'); q(X - 5, Y - 6, 2, 2, '#e8dcc8'); q(X - 2, Y - 1, 2, 1, '#f7b733'); q(X + 1, Y - 1, 2, 1, '#f7b733'); };
// 자전거 — 벽에 기대 놓은 옆모습
P.bike = (q, X, Y) => {
  const fr = '#3f6fb5', tire = '#2a2622';
  const wheel = (cx) => { ellipse(q, cx, Y - 6, 6, 6, (x, y) => { const r = Math.hypot(x + 0.5 - cx, y + 0.5 - (Y - 6)); return r > 5 ? tire : r > 4.2 ? '#8a8a86' : ((x + y) % 3 === 0 ? '#8a8a86' : null); }); };
  wheel(X - 8); wheel(X + 8);
  lineDots(q, [X - 8, Y - 6], [X - 2, Y - 14], fr); lineDots(q, [X - 2, Y - 14], [X + 5, Y - 14], fr); lineDots(q, [X + 5, Y - 14], [X + 8, Y - 6], fr);
  lineDots(q, [X - 2, Y - 14], [X + 1, Y - 6], fr); lineDots(q, [X + 1, Y - 6], [X + 5, Y - 14], fr); lineDots(q, [X + 1, Y - 6], [X + 8, Y - 6], fr);
  q(X - 4, Y - 16, 4, 2, '#5a4a3a'); q(X + 5, Y - 17, 3, 2, '#2a2622'); q(X + 6, Y - 16, 1, 3, fr);
};
// 빨랫줄 — 두 기둥 사이 옷가지
P.laundry = (q, a, b) => {
  q(a[0] - 1, a[1] - 26, 2, 26, '#8d6440'); q(b[0] - 1, b[1] - 26, 2, 26, '#8d6440');
  const n = Math.round(Math.abs(b[0] - a[0]) / 1);
  const cols = ['#ffffff', '#ffd9d0', '#8fd9c8', '#ffd166', '#c9a8ff'];
  for (let i = 0; i <= n; i++){ const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - 24 + Math.sin(t * Math.PI) * 2; q(Math.round(x), Math.round(y), 1, 1, '#5a4a3a'); }
  for (let k = 0; k < 4; k++){ const t = 0.15 + k * 0.22, x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t - 24 + Math.sin(t * Math.PI) * 2); const c = cols[k % cols.length]; q(x - 3, y + 1, 7, 6 + (k % 2) * 2, c); q(x - 3, y + 1, 7, 1, shade(c, -20)); q(x + 3, y + 1, 1, 6 + (k % 2) * 2, shade(c, -18)); }
};
// 나무 다리 — 도랑 위 널판
// along: 건너는 방향. 'x' 면 x 축을 따라(난간이 y 양끝), 'y' 면 y 축을 따라(난간이 x 양끝).
// 널판은 건너는 방향과 직각으로 깐다.
P.bridge = (q, x, y, w, d, along) => {
  const pal = { a: ['#c8a072', '#b88e60', '#a47c50'], gap: '#6a4a30' };
  const y_ = along === 'y';
  box(q, x, y, 2, w, d, 3, M.planks(pal, 1, -10, true), M.planks(pal, 1, -30, true), M.planks(pal, 2, 6, !y_));
  if (y_){ P.fence(q, x, y, d, 'y', '#a47c50'); P.fence(q, x + w, y, d, 'y', '#a47c50'); }
  else { P.fence(q, x, y, w, 'x', '#a47c50'); P.fence(q, x, y + d, w, 'x', '#a47c50'); }
};

/* 촘촘한 판에 더 얹는 소품들. props.js 뒤에 싣는다. */
// 풍차 — 돌 몸통, 나무 갓, 날개 넷
P.windmill = (q, wx, wy) => {
  const Pp = proj(wx, wy, 0).map(Math.round), R = 14, H = 52;
  const stP = { a: ['#d9d0c0', '#c7bcaa', '#b3a896', '#a89d8c'], m: '#8a8072', moss: '#7d9457' };
  cylinder(q, Pp[0], Pp[1], R, H, (a, v) => { const ang = Math.acos(1 - 2 * a) / Math.PI; const c = M.stone(stP, 33, 0, H)(Math.round(ang * 44), v); if (c === stP.m) return c; if (Math.abs(ang - 0.5) < 0.1 && v > H - 14) return v > H - 3 ? '#3a2a1e' : (Math.abs(ang - 0.5) < 0.02 ? '#3a2a1e' : '#6b4a30'); if (Math.abs(ang - 0.42) < 0.05 && v > 10 && v < 18) return '#3c4a5a'; return shade(c, a < 0.4 ? 8 : a < 0.7 ? -6 : -28); });
  ellipse(q, Pp[0], Pp[1] - H, R + 2, (R + 2) / 2, (x, y) => y > Pp[1] - H ? '#6a4a30' : '#8d6440');
  cone(q, Pp[0], Pp[1] - H - 1, R + 2, 16, (a, v) => { const r = v % 4; if (r === 0) return '#4e3722'; return shade(['#8d6440', '#7c5838'][Math.floor(v / 4) % 2], a < 0.5 ? 10 : -20); });
  // 날개 — 축은 갓 앞쪽. 격자 살과 천
  const hx = Pp[0] + 4, hy = Pp[1] - H - 4;
  q(hx - 2, hy - 2, 4, 4, '#4e3722');
  [[1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([dx, dy], k) => {
    for (let i = 4; i < 40; i++){ const x = hx + Math.round(dx * i * 0.8), y = hy + Math.round(dy * i * 0.55); q(x, y, 1, 1, '#5a3f2b'); if (i % 4 === 0 && i > 8) for (let j = 1; j <= 5; j++) q(x + (dy > 0 ? -1 : 1) * Math.round(j * 0.6) * (dx > 0 ? 1 : 1), y + (dx > 0 ? -1 : 1) * Math.round(j * 0.9) * (dy > 0 ? 1 : 1) * -1, 1, 1, '#8d6440'); }
    // 천 — 살 옆에 밝은 띠
    for (let i = 10; i < 38; i++){ const x = hx + Math.round(dx * i * 0.8) + (dy > 0 ? 2 : -2), y = hy + Math.round(dy * i * 0.55) + (dx > 0 ? -2 : 2); q(x, y, 2, 1, k % 2 ? '#f1e6d2' : '#e6dbc6'); }
  });
};
// 장터 가판대 — 판자 탁자, 기둥 넷, 줄무늬 차양, 과일 상자
P.stall = (q, wx, wy, cols, seed) => {
  const pal = PLANK_P;
  box(q, wx, wy, 0, 1.0, 0.6, 10, M.planks(pal, 12 + seed, 0), M.planks(pal, 13 + seed, -26, true), M.planks(pal, 14 + seed, 10, true));
  const fruit = [['#e8463a', '#f26a4a'], ['#f2a24f', '#ffd166'], ['#5aa9e6', '#8fd9c8'], ['#8fcb6d', '#4f9747']];
  for (let i = 0; i < 3; i++){
    const cx = wx + 0.08 + i * 0.31, cy = wy + 0.14;
    box(q, cx, cy, 10, 0.26, 0.3, 5, M.planks(pal, 20 + i, -6, true), M.planks(pal, 21 + i, -30, true), () => '#6a4a30');
    for (let k = 0; k < 7; k++){ const fx = cx + 0.03 + hash(k, i, seed) * 0.2, fy = cy + 0.03 + hash(k, i + 9, seed) * 0.24; const Pp = proj(fx, fy, 15).map(Math.round); const f = fruit[(i + seed) % 4]; q(Pp[0], Pp[1], 2, 2, f[0]); q(Pp[0], Pp[1], 1, 1, f[1]); }
  }
  [[wx, wy], [wx + 1.0, wy], [wx, wy + 0.6], [wx + 1.0, wy + 0.6]].forEach(([x, y]) => { const Pp = proj(x, y, 0).map(Math.round); q(Pp[0] - 1, Pp[1] - 30, 2, 30, '#8d6440'); q(Pp[0], Pp[1] - 30, 1, 30, '#5a3f2b'); });
  B.roofFor(q, { x: wx - 0.08, y: wy - 0.08, z: 30, w: 1.16, d: 0.76, h: 0 }, { type: 'gable', rise: 6, over: 0, drop: 0, tex: f => (u, v) => shade(cols[Math.floor(u / 5) % cols.length], lit(f) + (v % 3 === 0 ? -6 : 0)), cap: [shade(cols[0], 20), shade(cols[1], -20)] });
  // 차양 앞 술
  const E = proj(wx - 0.08, wy + 0.68, 30);
  for (let i = 0; i < 1.16 * S; i += 4) q(E[0] + i, E[1] + Math.floor(i / 2) + 1, 3, 2, shade(cols[Math.floor(i / 4) % cols.length], -30));
};
// 손수레 — 바퀴 둘, 상자
P.cart = (q, X, Y) => {
  const wd = '#a67a52';
  q(X - 10, Y - 12, 20, 8, wd); q(X - 10, Y - 12, 20, 1, shade(wd, 18)); q(X - 10, Y - 5, 20, 1, shade(wd, -30));
  for (let i = 0; i < 4; i++) q(X - 9 + i * 5, Y - 11, 1, 6, shade(wd, -14));
  q(X + 10, Y - 10, 8, 2, '#5a3f2b'); q(X + 17, Y - 12, 2, 4, '#5a3f2b');
  ellipse(q, X - 5, Y - 3, 4, 4, (x, y) => Math.hypot(x + 0.5 - (X - 5), y + 0.5 - (Y - 3)) > 3 ? '#2a2622' : (x + y) % 2 ? '#8a8a86' : '#5a5652');
  ellipse(q, X + 5, Y - 3, 4, 4, (x, y) => Math.hypot(x + 0.5 - (X + 5), y + 0.5 - (Y - 3)) > 3 ? '#2a2622' : (x + y) % 2 ? '#8a8a86' : '#5a5652');
  q(X - 8, Y - 19, 7, 7, '#c8a072'); q(X - 8, Y - 19, 7, 1, '#dbb88a'); q(X - 8, Y - 13, 7, 1, '#8f6a42'); q(X, Y - 17, 6, 5, '#b88e60'); q(X + 1, Y - 20, 3, 3, '#e8463a');
};
// 종이등 줄
P.lanterns = (q, a, b, cols) => {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12));
  let prev = null;
  for (let i = 0; i <= n * 3; i++){
    const t = i / (n * 3), sag = Math.sin(t * Math.PI) * 5;
    const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t + sag);
    if (prev) lineDots(q, prev, [x, y], '#5a4a3a'); prev = [x, y];
    if (i % 3 === 1){ const c = cols[Math.floor(i / 3) % cols.length]; q(x, y + 1, 1, 2, '#5a4a3a'); ellipse(q, x, y + 6, 3, 3.5, (px, py) => px < x - 1 ? shade(c, 26) : px > x + 1 ? shade(c, -22) : c); q(x - 1, y + 3, 3, 1, '#3a2a1e'); q(x - 1, y + 9, 3, 1, '#3a2a1e'); }
  }
};
// 지붕창 — 앞 경사면 위에 얹는 작은 집. main 은 벽 상자, rise/over/drop 는 그 지붕 값
P.dormer = (q, main, roof, wx, wd, hh, o) => {
  const ym = main.y + main.d / 2, ye = main.y + main.d + (roof.over == null ? 0.22 : roof.over);
  const zr = main.z + main.h + roof.rise, ze = main.z + main.h - (roof.drop == null ? 3 : roof.drop);
  const zAt = y => zr - (y - ym) / (ye - ym) * (zr - ze);
  const yf = o.yf || (ym + 0.62), yb = yf - 0.4;
  const bx = { x: wx, y: yb, z: Math.round(zAt(yf)), w: wd, d: 0.4, h: hh };
  const texR = (u, v) => (bx.z + bx.h - v < zAt(yf - u / S)) ? null : o.texR(u, v);
  B.walls(q, bx, o.texL, texR);
  B.win(q, 'L', bx, 3, 3, wd * S - 6, hh - 5, { sill: false, curtain: o.curtain, lit: o.lit });
  B.roofFor(q, bx, { type: 'gable', rise: 7, over: 0.08, drop: 1, axis: 'x', tex: o.roofTex, cap: o.cap });
};
// 홈통 — 벽 모서리의 세로 파이프
P.downpipe = (q, side, bx, u) => B.on(q, side, bx, u, -2, 2, bx.h + 2, (uu, vv) => vv % 10 === 4 ? '#3a3632' : uu === 0 ? '#7a726a' : '#5a5652');
// 벽 등 — 쇠 받침에 불 켜진 유리
P.wallLamp = (q, side, bx, u, v) => { LIGHTS.push(Object.assign(B.faceCenter(side, bx, u + 2.5, v + 4.5), { r: 16, c: '#ffd77a' })); return B.on(q, side, bx, u, v, 5, 9, (uu, vv) => vv === 0 ? (uu === 2 ? '#3a3632' : null) : vv === 1 ? '#3a3632' : vv === 8 ? (uu === 2 ? '#3a3632' : null) : (uu === 0 || uu === 4) ? '#3a3632' : (uu === 2 && vv === 4) ? '#fff3c4' : '#ffd77a'); };
// 화분 줄 — 테라코타 화분에 꽃
P.pots = (q, X, Y, n, seed) => { for (let i = 0; i < n; i++){ const x = X + i * 7, c = ['#ff8fb8', '#ffd166', '#ff7f7f', '#c9a8ff', '#ffffff'][(i + seed) % 5]; q(x - 2, Y - 4, 5, 4, '#c97a52'); q(x - 3, Y - 5, 7, 1, '#d98a5e'); q(x - 2, Y - 4, 1, 4, '#e09a6a'); q(x + 2, Y - 4, 1, 4, '#a85f3e'); q(x - 2, Y - 8, 5, 3, '#4f9747'); q(x - 1, Y - 9, 3, 1, '#6cb457'); q(x - 1, Y - 9, 1, 1, c); q(x + 1, Y - 8, 1, 1, c); q(x, Y - 7, 1, 1, shade(c, -20)); } };
// 장작더미 — 벽에 기댄 통나무. L 면(단면)과 R 면(옆)
P.woodpile = (q, wx, wy, w, d, h) => box(q, wx, wy, 0, w, d, h, (u, v) => { const cx = u % 5, cy = v % 5, r = Math.hypot(cx - 2, cy - 2); return r > 2.3 ? '#5a3f2b' : r > 1.5 ? '#a67a52' : r > 0.8 ? '#c99a6a' : '#e0c090'; }, (u, v) => v % 5 === 4 ? '#3a2a1e' : (u + v) % 7 === 0 ? '#6b4a30' : '#8d6440', (u, v) => (u + v) % 5 === 0 ? '#a67a52' : '#8d6440');
P.birdhouse = (q, X, Y) => { q(X - 1, Y - 22, 2, 22, '#8d6440'); q(X - 5, Y - 30, 10, 9, '#e8dcc8'); q(X - 6, Y - 33, 12, 3, '#c9584f'); q(X - 4, Y - 34, 8, 1, '#c9584f'); q(X - 1, Y - 27, 3, 3, '#2a2622'); q(X - 2, Y - 23, 4, 1, '#8d6440'); };
P.trough = (q, wx, wy) => box(q, wx, wy, 0, 0.5, 0.25, 6, M.planks(PLANK_P, 31, -4), M.planks(PLANK_P, 32, -28, true), (u, v) => (u < 1 || v < 1 || u > 10 || v > 4) ? '#8f6a42' : (u + v) % 5 === 0 ? '#8ec7e8' : '#5fa8d3');
P.coop = (q, wx, wy) => {
  const bx = { x: wx, y: wy, z: 0, w: 0.55, d: 0.45, h: 12 };
  B.walls(q, bx, M.planks(PLANK_P, 40, 0, true), M.planks(PLANK_P, 41, -26, true));
  B.on(q, 'L', bx, 3, 4, 5, 8, (u, v) => (u === 0 || u === 4 || v === 0) ? '#5a3f2b' : '#2a2622');
  B.roofFor(q, bx, { type: 'gable', rise: 6, over: 0.1, drop: 1, tex: f => M.slate(TIN_P, 7, lit(f)), cap: ['#b4bcc2', '#4a5258'] });
  const Rp = proj(wx + 0.16, wy + bx.d, 4), Rb = proj(wx + 0.16, wy + bx.d + 0.3, 0);
  lineDots(q, Rp, Rb, '#a67a52'); lineDots(q, [Rp[0] + 3, Rp[1] + 1], [Rb[0] + 3, Rb[1] + 1], '#a67a52');
};
P.beehive = (q, X, Y) => { q(X - 4, Y - 3, 8, 3, '#8d6440'); q(X - 5, Y - 12, 10, 9, '#f6f1e6'); q(X - 5, Y - 9, 10, 1, '#c9bda5'); q(X - 5, Y - 6, 10, 1, '#c9bda5'); q(X - 6, Y - 14, 12, 2, '#d8cbb0'); q(X - 1, Y - 5, 3, 2, '#2a2622'); q(X + 6, Y - 10, 1, 1, '#ffd166'); q(X - 8, Y - 8, 1, 1, '#ffd166'); };
P.lilypad = (q, X, Y, flower) => { ellipse(q, X, Y, 4, 2, (x, y) => (x > X && y < Y) ? null : (x < X - 1 ? '#6fb567' : '#559b50')); if (flower){ q(X - 1, Y - 2, 3, 1, '#ffb7d5'); q(X, Y - 3, 1, 1, '#ffffff'); } };
P.boat = (q, X, Y) => { for (let i = 0; i < 5; i++) q(X - 12 + i, Y - 5 + i, 24 - 2 * i, 1, i === 0 ? '#c8a072' : i < 3 ? '#a47c50' : '#8f6a42'); q(X - 12, Y - 6, 24, 1, '#dbb88a'); q(X - 6, Y - 8, 12, 2, '#8f6a42'); q(X + 2, Y - 14, 1, 8, '#5a3f2b'); q(X + 3, Y - 13, 6, 1, '#5a3f2b'); };
P.pigeon = (q, X, Y) => { q(X - 3, Y - 3, 6, 3, '#9a9aa2'); q(X - 3, Y - 3, 6, 1, '#b8b8c0'); q(X + 2, Y - 5, 3, 3, '#8a8a92'); q(X + 4, Y - 4, 2, 1, '#e0a050'); q(X - 4, Y - 2, 2, 1, '#6a6a72'); q(X - 1, Y, 1, 1, '#e0a050'); q(X + 1, Y, 1, 1, '#e0a050'); };
P.dog = (q, X, Y) => { const c = '#c9915a'; q(X - 7, Y - 8, 12, 6, c); q(X - 7, Y - 8, 12, 1, shade(c, 16)); q(X + 4, Y - 12, 6, 6, c); q(X + 4, Y - 14, 2, 3, shade(c, -20)); q(X + 8, Y - 9, 2, 2, '#2a2622'); q(X + 6, Y - 10, 1, 1, '#2a2622'); q(X - 9, Y - 12, 2, 5, c); q(X - 6, Y - 2, 2, 2, c); q(X - 2, Y - 2, 2, 2, c); q(X + 1, Y - 2, 2, 2, c); q(X + 4, Y - 2, 2, 2, c); q(X - 4, Y - 6, 6, 3, shade(c, 30)); };
// 연 — 몸통(마름모)과 꼬리를 따로 둔다. 꼬리는 위상(ph 0~1)에 따라 물결쳐서, 첫화면이 프레임을 바꿔 가며 띄운다
P.kiteBody = (q, X, Y) => { for (let i = -5; i <= 5; i++){ const w = 5 - Math.abs(i); q(X - w, Y + i, 2 * w + 1, 1, i < 0 ? '#ff6b6b' : '#ffd166'); } q(X, Y - 5, 1, 11, '#3a2a1e'); q(X - 5, Y, 11, 1, '#3a2a1e'); };
P.kiteTail = (q, X, Y, ph) => { for (let i = 0; i < 14; i++){ const px = X + Math.round(Math.sin(i * 0.6 + (ph || 0) * Math.PI * 2) * 2.5), py = Y + 6 + i * 2; q(px, py, 1, 2, '#3a2a1e'); if (i % 4 === 1) q(px - 1, py, 3, 2, i % 8 < 4 ? '#5aa9e6' : '#ff8fb8'); } };
P.kite = (q, X, Y, ph) => { P.kiteBody(q, X, Y); P.kiteTail(q, X, Y, ph); };
P.hotAir = (q, X, Y) => { ellipse(q, X, Y - 14, 7, 8, (x, y) => { const k = Math.floor((x - X + 7) / 3); return ['#e8463a', '#ffd166', '#5aa9e6', '#e8463a', '#ffd166'][k % 5]; }); q(X - 2, Y - 5, 5, 2, '#8d6440'); q(X - 2, Y - 1, 5, 3, '#a67a52'); q(X - 2, Y - 4, 1, 3, '#5a3f2b'); q(X + 2, Y - 4, 1, 3, '#5a3f2b'); };
P.noticeBoard = (q, X, Y) => { q(X - 8, Y - 22, 2, 22, '#8d6440'); q(X + 6, Y - 22, 2, 22, '#8d6440'); q(X - 11, Y - 30, 22, 12, '#5a3f2b'); q(X - 10, Y - 29, 20, 10, '#8fb5a0'); q(X - 8, Y - 27, 5, 6, '#fff6e9'); q(X - 2, Y - 28, 6, 7, '#fff3a0'); q(X + 5, Y - 26, 4, 5, '#ffd9d0'); q(X - 7, Y - 25, 3, 1, '#8a7a66'); q(X - 1, Y - 26, 4, 1, '#8a7a66'); q(X - 1, Y - 24, 4, 1, '#8a7a66'); q(X - 11, Y - 32, 22, 2, '#7a5636'); };
P.bin = (q, X, Y) => { cylinder(q, X, Y, 4, 9, (a, v) => v === 0 ? '#5a6a5a' : a < 0.4 ? '#4f6650' : a < 0.7 ? '#3f5440' : '#2f4030'); ellipse(q, X, Y - 9, 4, 2, '#6a7a6a'); q(X - 2, Y - 10, 4, 1, '#2a2622'); };
P.planter = (q, wx, wy, w, seed) => { box(q, wx, wy, 0, w, 0.28, 5, M.planks(PLANK_P, 50 + seed, 0), M.planks(PLANK_P, 51 + seed, -26, true), () => '#5c4230'); for (let i = 0; i < Math.round(w * 8); i++){ const fx = wx + 0.05 + hash(i, 1, seed) * (w - 0.1), fy = wy + 0.05 + hash(i, 2, seed) * 0.18; const Pp = proj(fx, fy, 5).map(Math.round); P.flower(q, Pp[0], Pp[1], ['#ff8fb8', '#ffd166', '#ff7f7f', '#ffffff', '#c9a8ff'][i % 5]); } };
P.icecream = (q, wx, wy) => { const bx = { x: wx, y: wy, z: 0, w: 0.5, d: 0.35, h: 12 }; B.walls(q, bx, (u, v) => v < 2 ? '#c9584f' : v > 10 ? '#8a8a86' : u % 6 < 3 ? '#fff6e9' : '#ffd9d0', (u, v) => shade(v < 2 ? '#c9584f' : v > 10 ? '#8a8a86' : '#fff6e9', -24)); B.on(q, 'L', bx, 2, 3, 8, 6, (u, v) => (u + v) % 4 === 0 ? '#ff8fb8' : (u + v) % 4 === 2 ? '#8fd9c8' : '#fff6e9'); const Pp = proj(wx + 0.25, wy + 0.18, 12).map(Math.round); q(Pp[0], Pp[1] - 22, 1, 22, '#5a3f2b'); cone(q, Pp[0], Pp[1] - 22, 12, 8, (a, v) => shade(Math.floor(Math.acos(1 - 2 * a) / Math.PI * 8) % 2 ? '#ff8fb8' : '#fff6e9', a < 0.5 ? 6 : -16)); const W0 = proj(wx + 0.05, wy + 0.35, 0).map(Math.round); ellipse(q, W0[0], W0[1] - 3, 3, 3, (x, y) => Math.hypot(x + 0.5 - W0[0], y + 0.5 - (W0[1] - 3)) > 2.2 ? '#2a2622' : '#8a8a86'); };
P.stairs = (q, wx, wy, n, dir) => { for (let i = 0; i < n; i++){ const h = 46 / n; box(q, wx + (dir === 'x' ? i * 0.3 : 0), wy + (dir === 'y' ? i * 0.3 : 0), 0, dir === 'x' ? 0.3 : 0.5, dir === 'y' ? 0.3 : 0.5, Math.round(h * (i + 1)), () => '#a99f8f', () => '#8a8071', () => '#cfc6b6'); } };
P.puddle = (q, X, Y, w) => ellipse(q, X, Y, w, w * 0.45, (x, y) => (x - X) + (y - Y) * 2 < -w * 0.5 ? '#c9dde8' : (x + y) % 5 === 0 ? '#a9c9dc' : '#8fb8d0');
P.manhole = (q, X, Y) => ellipse(q, X, Y, 6, 3, (x, y) => Math.abs(x - X) + Math.abs(y - Y) * 2 > 5 ? '#5a5652' : ((x + y) % 2 ? '#7a726a' : '#6a625a'));
P.stone = (q, X, Y) => ellipse(q, X, Y, 4, 2, (x, y) => (x - X) + (y - Y) < -2 ? '#c2bab0' : '#a49c92');

/* 수아연아 마을 — 언패킹처럼 재질과 소품이 촘촘한 아이소메트릭 마을. 집 하나가 메뉴 한 칸이다. */
const PW = 14, PD = 12;                       // 땅 칸 수
let SKY = 124;                                // 땅 뒤 꼭짓점의 y — 그릴 때 정한다
const VS = { w: 640, h: 470, orgX: 296, labels: [], frameRects: [] };
let SPR = null;                               // 사이트의 스프라이트 — 그릴 때 받는다
// 화면 도트 → 세상 칸
function unproj(x, y){ const a = (x - ORG.x) / TW, b = (y - ORG.y) / TH; return [b + a, b - a]; }
const inPlot = (tx, ty) => tx >= 0 && ty >= 0 && tx < PW && ty < PD;
// ---------- 땅 종류 ----------
const inR = (tx, ty, x0, y0, x1, y1) => tx >= x0 && tx < x1 && ty >= y0 && ty < y1;
function kindAt(tx, ty){
  if (ty >= 10.8) return 'water';
  if (inR(tx, ty, 8.8, 5.05, 14, 5.6)) return 'moat';                // 해자
  if (inR(tx, ty, 9, 0, 14, 5)) return 'court';                       // 성 안뜰
  if (inR(tx, ty, 5, 3.5, 9, 7.5)) return 'plaza';
  if (inR(tx, ty, 0, 3, 3.2, 4.5)) return 'plaza';                    // 미술관 앞뜰
  if (inR(tx, ty, 3.2, 2.0, 4.4, 10.8)) return 'cobble';               // 서길
  if (inR(tx, ty, 3.2, 2.3, 9, 3.5)) return 'cobble';                  // 북길
  if (inR(tx, ty, 3.2, 7.5, 14, 8.7)) return 'cobble';                 // 남길
  if (inR(tx, ty, 9, 5.6, 12.6, 6.7)) return 'cobble';                 // 성문길
  if (inR(tx, ty, 5, 8.7, 7.4, 10.8)) return 'soil';                   // 밭
  if (inR(tx, ty, 7.4, 8.7, 11.2, 10.8)) return 'dirt';                // 밭 마당
  if (inR(tx, ty, 7.0, 0, 9, 2.3)) return 'garden';                    // 일기장집 뒤뜰
  return 'grass';
}
const GR = ['#7db663', '#74ad5b', '#86bf6c', '#6da456', '#80b868'];
function groundColor(kind, tx, ty, x, y){
  if (kind === 'grass' || kind === 'garden'){
    let c = GR[Math.floor(hash(x >> 1, y >> 1, 1) * GR.length)];
    if (hash(x >> 3, y >> 3, 2) < 0.3) c = shade(c, -7);
    if (kind === 'garden' && hash(x, y, 3) < 0.05) c = '#5f9a4c';
    return c;
  }
  if (kind === 'cobble'){
    const CS = 0.24, row = Math.floor(ty / CS), fx = ((tx / CS + (row % 2 ? 0.5 : 0)) % 1 + 1) % 1, fy = (ty / CS % 1 + 1) % 1, col = Math.floor(tx / CS + (row % 2 ? 0.5 : 0));
    const d = Math.abs(fx - 0.5) + Math.abs(fy - 0.5);
    if (d > 0.44) return hash(col, row, 4) < 0.5 ? '#8a7d6c' : '#7f7263';
    const base = ['#cbbca4', '#bfb097', '#b3a48c', '#c5b59d'][Math.floor(hash(col, row, 5) * 4)];
    if (fx + fy < 0.62) return shade(base, 12);
    if (fx + fy > 1.3) return shade(base, -12);
    return base;
  }
  if (kind === 'plaza' || kind === 'court'){
    const CS = 0.5, col = Math.floor(tx / CS), row = Math.floor(ty / CS), fx = (tx / CS) % 1, fy = (ty / CS) % 1;
    const P0 = kind === 'plaza' ? ['#d9cdb6', '#cfc2aa', '#c6b8a0', '#d3c6ae'] : ['#b9b2a6', '#aea79a', '#a39c90', '#b4ad9f'];
    if (fx < 0.07 || fy < 0.07) return kind === 'plaza' ? '#9c8f7a' : '#7c7569';
    let c = P0[Math.floor(hash(col, row, 6) * 4)];
    if (hash(x, y, 7) < 0.05) c = shade(c, -9);
    if (fx < 0.14 || fy < 0.14) c = shade(c, 8);
    if (kind === 'court' && hash(col, row, 8) < 0.12 && Math.abs(fx - fy) < 0.05) c = '#7c7569';   // 금 간 돌
    return c;
  }
  if (kind === 'dirt'){
    let c = ['#b89468', '#ae8a5e', '#a48058', '#b28e62'][Math.floor(hash(x >> 1, y >> 1, 9) * 4)];
    if (hash(x, y, 10) < 0.04) c = '#8a6a48';
    if (hash(x, y, 11) < 0.02) c = '#d3b58a';
    return c;
  }
  if (kind === 'soil'){
    const f = ((ty - 8.7) / 0.35) % 1;                                  // 이랑
    let c = f < 0.18 ? '#5c4230' : f < 0.5 ? '#7d5a40' : f < 0.8 ? '#8c6748' : '#6a4c36';
    if (hash(x, y, 12) < 0.07) c = shade(c, -12);
    return c;
  }
  if (kind === 'water'){
    const e = ty - 10.8;
    if (e < 0.10) return '#c8b89a';                                     // 물가 흙
    if (e < 0.18) return hash(x, y, 13) < 0.5 ? '#bfe4f4' : '#8ec7e8';
    let c = e < 0.5 ? '#6fb3da' : '#5aa3cf';
    if ((x + y * 2 + Math.floor(hash(x >> 3, y >> 2, 14) * 4)) % 13 < 2) c = '#8ec7e8';
    if (hash(x, y, 15) < 0.015) c = '#dff2fb';
    return c;
  }
  if (kind === 'moat'){
    const e = Math.min(ty - 5.05, 5.6 - ty, tx - 8.8);   // 왼쪽 끝도 돌로 막는다 — 우체국이 가려 주던 자리라 물이 잘려 보였다
    if (e < 0.07) return '#8a7a66';
    let c = e < 0.16 ? '#6fb3da' : '#4a90bf';
    if ((x + y * 2 + Math.floor(hash(x >> 3, y >> 2, 14) * 4)) % 13 < 2) c = '#6fb3da';
    if (hash(x, y, 16) < 0.015) c = '#bfe4f4';
    return c;
  }
  return '#ff00ff';
}
// ---------- 하늘·먼 곳 ----------
function drawSky(q, W, H){
  // 하늘 바탕·해·구름·새는 첫화면 코드가 시간대에 맞춰 그린다 — 여기는 먼 땅만
  // 구름 — 잎 덩어리와 같은 방법, 흰 팔레트
  if (!NIGHT) P.hotAir(q, Math.round(W * 0.94), SKY - 22);
  // 먼 산 세 겹 — 멀수록 하늘에 가깝다
  const ridge = (x0, w, h, y0, col, seed) => {
    for (let i = 0; i < w; i++){
      const t = i / w, k = Math.sin(Math.PI * t) * (0.8 + 0.2 * Math.sin(t * 17 + seed)) + 0.06 * Math.sin(t * 41 + seed * 2);
      const hh = Math.max(0, Math.round(h * k));
      q(x0 + i, y0 - hh, 1, hh + 60, col);
      if (hh > 4 && hash(i, seed, 1) < 0.35) q(x0 + i, y0 - hh, 1, 1, shade(col, 12));
    }
  };
  // 화면 폭에 맞춰 늘어난다
  ridge(Math.round(-0.09 * W), Math.round(0.52 * W), 46, SKY - 6, '#b4c6dc', 1); ridge(Math.round(0.36 * W), Math.round(0.66 * W), 40, SKY - 4, '#b9cadf', 2);
  ridge(Math.round(0.09 * W), Math.round(0.47 * W), 30, SKY, '#a2b7d0', 3); ridge(Math.round(0.52 * W), Math.round(0.59 * W), 26, SKY + 2, '#a6bad2', 4);
  // 남산타워 — 두 번째 능선 위. 아래부터 팔각정 · 콘크리트 기둥 · 전망대 고리 · 빨강흰 줄무늬 안테나
  VS.skyHits = [];
  {
    const lit = typeof NIGHT !== 'undefined' && NIGHT;
    const tx = Math.round(0.325 * W), ty = SKY - 34;                             // 산 꼭대기 — 아래 봉우리를 하나 돋운다
    // 남산 봉우리 — 타워가 설 자리를 다른 능선보다 높게 돋운다
    for (let i = -44; i <= 44; i++){
      const u = Math.abs(i) / 44;
      const hh = Math.max(0, Math.round(20 * Math.pow(Math.cos(u * Math.PI / 2), 1.4) + 1.2 * Math.sin(i * 0.7)));
      const y0 = SKY - 11 - hh;
      q(tx + i, y0, 1, hh + 70, '#9cb1cb');
      if (hh > 3 && hash(i, 7, 1) < 0.3) q(tx + i, y0, 1, 1, shade('#9cb1cb', 12));
    }
    const con = '#dfe7f2', conS = '#c4d0e0', deck = '#cdd8e6', deckS = '#aabbd0';
    const rows = [], row = (y, x0, w, c) => { q(x0, y, w, 1, c); rows.push([y, x0, x0 + w - 1]); };
    // 산 위 건물 — 팔각정과 앞 건물. 아래 두 줄은 산에 묻히는 주춧돌
    for (let i = -2; i < 5; i++) row(ty - i, tx - 10 + Math.max(0, i), 20 - Math.max(0, i) * 2, i <= 0 ? '#b2c1d3' : '#c8d2e0');
    // 기둥 — 위로 갈수록 아주 조금 가늘어진다
    for (let i = 5; i < 30; i++){ const hw = i < 18 ? 3 : 2; row(ty - i, tx - hw, hw * 2 + 1, i % 7 === 3 ? conS : con); }
    // 기둥 중간 고리
    row(ty - 18, tx - 4, 9, deckS); row(ty - 19, tx - 4, 9, deck);
    // 전망대 — 아래 챙, 몸통(창), 위 챙
    row(ty - 30, tx - 8, 17, deckS); row(ty - 31, tx - 8, 17, deck);
    for (let i = 32; i < 38; i++) row(ty - i, tx - 7, 15, i % 2 === 0 ? deck : deckS);
    for (let i = 33; i < 37; i += 2) for (let x = tx - 5; x <= tx + 5; x += 2) q(x, ty - i, 1, 1, lit ? '#ffd77a' : '#8fa5c0');
    row(ty - 38, tx - 6, 13, deckS); row(ty - 39, tx - 5, 11, deck);
    // 목 — 전망대 위 짧은 기둥
    for (let i = 40; i < 45; i++) row(ty - i, tx - 2, 5, con);
    // 안테나 — 빨강흰 줄무늬
    for (let i = 45; i < 55; i++) row(ty - i, tx - 1, 3, Math.floor((i - 45) / 3) % 2 ? '#f2f5f9' : '#d9453f');
    // 첨탑
    for (let i = 55; i < 60; i++) row(ty - i, tx, 1, i > 57 ? '#ffffff' : '#e8ecf2');
    if (lit) LIGHTS.push({ x: tx, y: ty - 34, r: 9, c: '#ffe6a8' });
    VS.skyHits.push({ key: 'nseoul', rows, x: tx, y: ty - 58, w: 17, h: 58 });
  }
  // 롯데타워 — 도시 오른쪽. 같은 줄에 선 건물이라 몸통 색은 뒤쪽 도시 겹과 똑같이 두고,
  // 밤낮은 첫화면의 물들이기에 맡긴다. 꼭대기는 실제 타워처럼 두 갈래로 갈라진다.
  // 밤에는 두 모서리 선과 갈래에 불이 들어온다
  {
    const lit = typeof NIGHT !== 'undefined' && NIGHT;
    const lx = Math.round(0.72 * W), lb = SKY + 12, lh = 100, hw0 = 8;
    const body = '#93a8c2', seam = '#9db1c9';                 // 도시 뒤쪽 겹과 같은 색
    const rows = [];                                          // 줄마다 [y, 왼끝, 오른끝] — 누를 자리
    for (let i = 0; i < lh; i++){
      const t = i / lh, y = lb - i;
      const hw = Math.max(1, Math.round(hw0 * (1 - Math.pow(t, 1.9))));
      const fork = t > 0.82;                                  // 여기부터 두 갈래 — 가운데는 하늘이 보인다
      const edge = lit ? (fork ? '#fff6dc' : '#ffdf9e') : (fork ? '#e2ecf6' : '#c7d6e6');
      if (!fork){
        q(lx - hw, y, hw * 2 + 1, 1, i % 9 === 8 ? seam : body);
        if (hw > 2){ q(lx - hw + 2, y, 1, 1, seam); q(lx + hw - 2, y, 1, 1, seam); }   // 세로 리브
        if (lit && i % 5 === 2 && hw > 2) q(lx - hw + 3, y, 1, 1, '#ffd77a');          // 창불 몇 점
      } else {
        const th = Math.max(1, Math.round(hw * 0.9));         // 갈래 굵기 — 가운데 틈은 좁게
        q(lx - hw, y, th, 1, body); q(lx + hw - th + 1, y, th, 1, body);
        if (i % 3 === 0 && th > 1){ q(lx - hw + th - 1, y, 1, 1, seam); q(lx + hw - th + 1, y, 1, 1, seam); }
      }
      q(lx - hw, y, 1, 1, edge); q(lx + hw, y, 1, 1, edge);   // 두 모서리 선 — 밤에 불이 들어온다
      rows.push([y, lx - hw, lx + hw]);
    }
    if (lit) LIGHTS.push({ x: lx, y: lb - lh + 8, r: 11, c: '#ffe6a8' });
    VS.skyHits.push({ key: 'lotte', rows, x: lx, y: lb - lh + 22, w: hw0 * 2 + 1, h: lh - 22 });
  }
  // 도시 — 두 겹, 창 점
  for (let i = 0; i < Math.ceil(W / 9.4) + 2; i++){
    const bx = -10 + i * 9.4, bh = 6 + Math.round(20 * Math.abs(Math.sin(i * 2.1 + 0.4))), bw = 6 + (i % 3);
    q(Math.round(bx), SKY + 8 - bh, bw, bh + 10, i % 4 === 0 ? '#9db1c9' : '#93a8c2');
    for (let wy = SKY + 10 - bh; wy < SKY + 6; wy += 3) for (let wx = 1; wx < bw - 1; wx += 2) if (hash(i, wy, 5) < 0.5) q(Math.round(bx) + wx, wy, 1, 1, '#c9d7e6');
  }
  for (let i = 0; i < Math.ceil(W / 12) + 3; i++){
    const bx = -20 + i * 12, bh = 4 + Math.round(12 * Math.abs(Math.sin(i * 1.7 + 2))), bw = 8 + (i % 4);
    q(Math.round(bx), SKY + 16 - bh, bw, bh + 6, '#8398b3');
    for (let wy = SKY + 18 - bh; wy < SKY + 14; wy += 3) for (let wx = 1; wx < bw - 1; wx += 2) if (hash(i, wy, 6) < 0.4) q(Math.round(bx) + wx, wy, 1, 1, '#bfcfe0');
  }
  // 그 아래 — 안개 낀 들판. 땅 덩어리 뒤로 깊이만 준다
  // 지평선 아래 — 안개 낀 조각보 밭. 멀수록 하늘빛에 섞인다
  const HZ = SKY + 20;
  for (let y = HZ; y < H; y++){
    const t = (y - HZ) / (H - HZ), band = Math.floor((y - HZ) / 9);
    const bh = hash(band, 1, 77);
    let base = ['#a3bd8e', '#aec08a', '#95b58a', '#b4bd8c', '#8fb287', '#c2c48e'][Math.floor(bh * 6)];
    const nseg = 3 + Math.floor(hash(band, 2, 77) * 4);
    for (let x = 0; x < W; x++){
      const seg = Math.floor((x + band * 37) / (W / nseg));
      let c = hash(band, seg + 5, 78) < 0.4 ? shade(base, Math.floor(hash(band, seg, 79) * 24) - 12) : base;
      c = mix(c, '#7f9d88', t * 0.55);
      c = mix(c, '#c0ced4', Math.max(0, 0.6 - t * 1.5));                       // 안개
      if ((y - HZ) % 9 === 8) c = shade(c, -14);                                  // 밭두렁
      if ((x + band * 37) % Math.floor(W / nseg) === 0) c = shade(c, -12);        // 밭 경계
      q(x, y, 1, 1, c);
    }
  }
  // 나무 줄과 굽이치는 강
  for (let i = 0; i < 140; i++){ const x = Math.round(hash(i, 1, 7) * W), y = HZ + 8 + Math.round(hash(i, 2, 7) * (H - HZ - 8)); const t = (y - HZ) / (H - HZ); const c = mix('#5f8a68', '#c0ced4', Math.max(0, 0.6 - t * 1.5)); q(x, y - 2, 2 + (i % 3), 3, c); q(x + 1, y - 3, 1 + (i % 2), 1, c); }
  let rx = W * 0.78;
  for (let y = HZ + 2; y < H; y++){ const t = (y - HZ) / (H - HZ); rx += Math.sin(y * 0.09) * 1.6 - 0.9; const wdt = 2 + Math.round(t * 5); q(Math.round(rx), y, wdt, 1, mix('#8fc0d8', '#c0ced4', Math.max(0, 0.6 - t * 1.5))); if (y % 5 === 0) q(Math.round(rx) + 1, y, 1, 1, '#e0f0f8'); }
}
// ---------- 땅 덩어리와 절벽 ----------
function drawGround(q){
  const W = VS.w;
  for (let y = SKY; y < SKY + (PW + PD) * (TH / 2) + 1; y++) for (let x = 0; x < W; x++){
    const [tx, ty] = unproj(x + 0.5, y + 0.5);
    if (!inPlot(tx, ty)) continue;
    q(x, y, 1, 1, groundColor(kindAt(tx, ty), tx, ty, x, y));
  }
  // 절벽 — 왼앞(L)과 오른앞(R) 두 면. 위에서부터 풀 뿌리, 흙, 바위 켜
  const cliffTex = lit => (u, v) => {
    let c;
    if (v < 2) c = '#5f9a4c';
    else if (v < 4) c = hash(u, v, 21) < 0.5 ? '#7a5a3c' : '#5f9a4c';
    else if (v < 14){ c = ['#8a6a4a', '#7d5f42', '#70543a'][Math.floor(hash(u >> 1, v >> 1, 22) * 3)]; if (hash(u, v, 23) < 0.06) c = '#a58a68'; }
    else { const k = Math.floor((v - 14) / 6); c = ['#8c8478', '#7f776c', '#736b60', '#67605a', '#5a534d'][Math.min(4, k)]; if (hash(u, v, 24) < 0.05) c = shade(c, 14); if ((v - 14) % 6 === 5 && hash(u >> 2, v, 25) < 0.7) c = shade(c, -16); if (hash(u >> 3, v >> 2, 26) < 0.08) c = shade(c, -10); }
    return shade(c, lit);
  };
  const CH = 40;
  // 물이 있는 자리는 절벽 위쪽이 물빛 — 도랑의 단면
  const waterCut = (tex, isL) => (u, v, x, y) => {
    const wat = isL ? true : u < 1.2 * S;
    if (wat && v < 6) return v < 1 ? '#8ec7e8' : v < 5 ? '#4f97c4' : '#3d7ba6';
    return tex(u, v, x, y);
  };
  const left = proj(0, PD, 0), front = proj(PW, PD, 0);
  quad(q, left, UL, VD, PW * S, CH, waterCut(cliffTex(0), true));
  quad(q, front, UR, VD, PD * S, CH, waterCut(cliffTex(-30), false));
  // 절벽 밑 그늘
  for (let i = 0; i < 12; i++) q(0, front[1] + CH + i, W, 1, 'rgba(20,30,20,' + (0.22 - i * 0.018).toFixed(3) + ')');
}
// 땅 위 잔 무늬 — 꽃, 풀, 돌, 작물
function drawDecals(q){
  for (let tx = 0; tx < PW; tx++) for (let ty = 0; ty < PD; ty++){
    for (let k = 0; k < 7; k++){
      const fx = tx + hash(tx, ty, 30 + k), fy = ty + hash(tx, ty, 40 + k), kind = kindAt(fx, fy);
      const [X, Y] = proj(fx, fy, 0).map(Math.round);
      const r = hash(tx, ty, 50 + k);
      if (kind === 'grass' || kind === 'garden'){
        if (r < 0.28) P.flower(q, X, Y, ['#ff8fb8', '#ffd166', '#ffffff', '#c9a8ff', '#ff7f7f'][Math.floor(hash(tx, ty, 60 + k) * 5)]);
        else if (r < 0.7) P.tuft(q, X, Y, '#4f9747');
        else if (r < 0.76) P.rock(q, X, Y, 4 + Math.round(hash(tx, ty, 70 + k) * 4));
        else if (r < 0.79 && SPR.S.mushroom) spr(q, X - 3, Y - 6, SPR.S.mushroom, SPR.PAL);
      } else if (kind === 'water' && r < 0.25 && fy > 11.0 && fy < 11.9){
        q(X - 1, Y - 3, 1, 3, '#6f8f4a'); q(X + 1, Y - 4, 1, 4, '#5f7f40'); q(X, Y - 1, 1, 1, '#6f8f4a');   // 갈대
      } else if (kind === 'dirt' && r < 0.2) q(X, Y, 2, 1, '#8a6a48');
    }
  }
  // 밭 작물 — 이랑을 따라
  for (let row = 0; row < 6; row++) for (let i = 0; i < 9; i++){
    const tx = 5.15 + i * 0.25, ty = 8.7 + 0.2 + row * 0.35;
    const [X, Y] = proj(tx, ty, 0).map(Math.round);
    const stage = hash(row, i, 80);
    if (row < 3){                                                     // 토마토
      q(X - 1, Y - 5, 3, 5, '#4f9747'); q(X - 2, Y - 4, 1, 2, '#3f7d3c'); q(X + 2, Y - 3, 1, 2, '#3f7d3c');
      if (stage > 0.4) q(X, Y - 3, 2, 2, '#e8463a'); if (stage > 0.7) q(X - 2, Y - 2, 2, 2, '#f26a4a');
    } else if (row < 5){                                              // 배추
      q(X - 2, Y - 3, 5, 3, '#8ccb84'); q(X - 1, Y - 4, 3, 1, '#a8dba0'); q(X - 2, Y - 1, 5, 1, '#6fb567');
    } else {                                                          // 호박
      q(X - 3, Y - 3, 6, 3, '#e8892f'); q(X - 3, Y - 3, 6, 1, '#f2a24f'); q(X - 1, Y - 4, 1, 1, '#5a8a3a'); q(X + 1, Y - 3, 1, 3, '#c9701f');
    }
  }
  // 벚꽃잎, 웅덩이, 맨홀, 디딤돌, 연잎, 물고기, 낙엽
  for (let i = 0; i < 34; i++){ const a = hash(i, 1, 90) * 6.28, r = hash(i, 2, 90) * 0.75; const Pp = proj(8.2 + Math.cos(a) * r, 1.8 + Math.sin(a) * r * 0.8, 0).map(Math.round); if (kindAt(8.2 + Math.cos(a) * r, 1.8 + Math.sin(a) * r * 0.8) !== 'cobble') q(Pp[0], Pp[1], 2, 1, i % 3 ? '#ffc3d6' : '#f7a2bd'); }
  P.puddle(q, ...proj(10.85, 9.3, 0).map(Math.round), 9); P.puddle(q, ...proj(9.05, 10.55, 0).map(Math.round), 6);
  P.manhole(q, ...proj(5.6, 5.4, 0).map(Math.round));
  [[5.4, 1.95], [5.45, 2.15]].forEach(([x, y]) => P.stone(q, ...proj(x, y, 0).map(Math.round)));
  [[2.2, 11.4, 1], [5.0, 11.6, 0], [8.8, 11.3, 1], [11.5, 11.5, 0], [3.0, 11.75, 0]].forEach(([x, y, f]) => P.lilypad(q, ...proj(x, y, 0).map(Math.round), f));
  [[4.2, 11.2], [9.9, 11.4], [7.1, 11.7]].forEach(([x, y]) => { const Pp = proj(x, y, 0).map(Math.round); q(Pp[0], Pp[1], 3, 1, '#f2a24f'); q(Pp[0] + 3, Pp[1] - 1, 1, 1, '#f2a24f'); });
  for (let i = 0; i < 12; i++){ const Pp = proj(0.6 + (hash(i, 1, 91) - 0.5) * 1.2, 9.0 + (hash(i, 2, 91) - 0.3) * 1.0, 0).map(Math.round); q(Pp[0], Pp[1], 2, 1, i % 2 ? '#c9915a' : '#b07a3a'); }
  // 해자 물가 돌
  [[9.3, 5.62], [10.4, 5.62], [12.7, 5.62], [13.5, 5.62]].forEach(([x, y]) => P.stone(q, ...proj(x, y, 0).map(Math.round)));
  // 물가 돌
  [[1.4, 11.0], [6.2, 10.95], [9.6, 11.05], [12.8, 10.9]].forEach(([tx, ty]) => { const [X, Y] = proj(tx, ty, 0).map(Math.round); P.rock(q, X, Y, 6); });
}
// ---------- 팔레트 ----------
const TILE_P = { a: ['#c9705a', '#bd6650', '#b25d48', '#a55340'], edge: '#7c3a2c', joint: '#8f4536' };
const SLATE_P = { a: ['#5f6b7a', '#566270', '#4d5866', '#455060'], edge: '#2f3742', joint: '#3d4653' };
const TIN_P = { a: ['#9aa4ab', '#8e989f', '#838d94', '#78828a'], edge: '#5a636a', joint: '#6b747b' };
const STONE_P = { a: ['#cfc6b6', '#bcb2a2', '#a99f8f', '#978d7e', '#b5aa99'], m: '#6e665c', moss: '#7d9457' };
const PLANK_P = { a: ['#c8a072', '#b88e60', '#a47c50', '#b08a5c'], gap: '#5e4530' };
const lit = f => f === 'px' ? -26 : f === 'my' ? -10 : f === 'mx' ? 8 : 0;
const weather = t => (u, v) => hash(u, v, 99) < 0.02 ? '#7f9a5a' : hash(u >> 1, v >> 1, 98) < 0.04 ? shade(t(u, v), -14) : t(u, v);
const tileTex = P0 => f => weather(M.tile(P0, 4, lit(f)));
const slateTex = f => weather(M.slate(SLATE_P, 2, lit(f)));
// 기둥 모서리 돌(퀸) — 회벽 위에 밝은 돌을 번갈아
const quoin = (base, W, H) => (u, v) => {
  const k = Math.floor(v / 5) % 2, edge = u < 5 || u >= W - 5;
  if (edge && v < H - 6) return k === 0 ? '#e6dbc6' : '#d3c7ae';
  return base(u, v);
};
// ---------- 미술관 (포트폴리오) ----------
function bGallery(q){
  const bx = { x: 0.15, y: 0.15, z: 0, w: 2.7, d: 2.7, h: 58 };
  const W = bx.w * S, D = bx.d * S;
  const plL = M.plaster({ a: '#f3e9d6', b: '#e9dec8', c: '#d9cbb0', base: '#bcb09a' }, 1, 0, bx.h);
  const plR = M.plaster({ a: '#f3e9d6', b: '#e9dec8', c: '#d9cbb0', base: '#bcb09a' }, 1, -26, bx.h);
  const band = (base, W2, shift) => (u, v) => (v === 30 || v === 31) ? shade('#e0d4bc', shift + (v === 31 ? -30 : 0)) : base(u, v);
  B.walls(q, bx, band(quoin(plL, W, bx.h), W, 0), band(quoin(plR, D, bx.h), D, -26));
  // 왼앞 — 아치 창 둘, 가운데 문, 위층 창 셋
  B.win(q, 'L', bx, 6, 32, 10, 22, { arch: 1, sill: true });
  B.win(q, 'L', bx, 48, 32, 10, 22, { arch: 1 });
  B.win(q, 'L', bx, 27, 9, 9, 13, { transom: 1 });
  // 걸린 그림 자리 둘 — draw.html 에서 「액자에 걸기」 한 그림이 들어간다. 그림은 다 그린 뒤 얹는다
  VS.frameRects = [];
  [5, 46].forEach(u => {
    B.on(q, 'L', bx, u, 8, 13, 13, (uu, vv) => (uu === 0 || vv === 0) ? '#e0be6a' : (uu === 12 || vv === 12) ? '#8a6a2a' : (uu === 1 || vv === 1 || uu === 11 || vv === 11) ? '#c9a24a' : '#fff6e9');
    const c = B.faceCenter('L', bx, u + 2, 8 + 2);
    VS.frameRects.push({ x: c.x, y: c.y, w: 9, h: 9, cx: c.x + 4.5, cy: c.y + 2.25 + 4.5 });
  });
  B.door(q, 'L', bx, 26, 34, 12, 24, { arch: 1, wood: '#5a3a2a', glass: '#9cc6dc', frame: '#ece1cc' });
  // 오른앞 — 창과 걸개 그림 둘
  B.win(q, 'R', bx, 8, 32, 10, 22, { arch: 1 }); B.win(q, 'R', bx, 44, 32, 10, 22, { arch: 1 });
  B.win(q, 'R', bx, 8, 9, 9, 13, { transom: 1 }); B.win(q, 'R', bx, 44, 9, 9, 13, { transom: 1 });
  const banner = (col, icon) => (u, v) => {
    if (v === 0) return '#5a4a3a';
    if (u === 0 || u === 7) return shade(col, -30);
    if (v > 30 && (u + v) % 2) return null;                         // 아래 술
    if (icon === 'frame' && u >= 2 && u <= 5 && v >= 10 && v <= 16) return (u === 2 || u === 5 || v === 10 || v === 16) ? '#fff6e9' : '#8fd9c8';
    if (icon === 'star' && Math.abs(u - 3.5) + Math.abs(v - 13) <= 2.5) return '#ffd166';
    return v % 9 === 8 ? shade(col, -10) : col;
  };
  B.on(q, 'R', bx, 22, 6, 8, 34, banner('#f2879f', 'frame'));
  B.on(q, 'R', bx, 34, 6, 8, 34, banner('#5aa9e6', 'star'));
  P.downpipe(q, 'L', bx, 1); P.downpipe(q, 'R', bx, D - 3);
  P.wallLamp(q, 'L', bx, 20, 36); P.wallLamp(q, 'L', bx, 40, 36);
  B.eaveShadow(q, bx, 4);
  const R0 = B.roofFor(q, bx, { type: 'hip', rise: 22, over: 0.25, tex: slateTex, cap: ['#8d97a6', '#2f3742'] });
  // 지붕 한가운데 유리 채광창
  const lt = { x: 1.15, y: 1.15, z: R0.zr - 8, w: 0.7, d: 0.7, h: 12 };
  const glass = sh => (u, v) => (u % 6 === 0 || v === 0 || v === 11) ? '#f4f8fa' : shade((u - v) % 7 === 0 ? '#dff0f7' : '#b9dcec', sh);
  B.walls(q, lt, glass(0), glass(-22));
  B.roofFor(q, lt, { type: 'hip', rise: 6, over: 0.08, drop: 1, tex: f => (u, v) => (u % 6 === 0 || v % 4 === 0) ? '#f4f8fa' : shade('#cfe6f1', lit(f)), cap: ['#f4f8fa', '#9fb8c6'] });
  // 풍향계
  const Wv = proj(1.5, 1.5, R0.zr + 10).map(Math.round);
  q(Wv[0], Wv[1] - 12, 1, 12, '#3a3632'); q(Wv[0] - 4, Wv[1] - 9, 9, 1, '#3a3632'); q(Wv[0] - 5, Wv[1] - 10, 2, 3, '#3a3632'); q(Wv[0] + 3, Wv[1] - 10, 2, 3, '#3a3632');
  q(Wv[0] - 2, Wv[1] - 13, 5, 1, '#e8a03a'); q(Wv[0] + 3, Wv[1] - 14, 1, 3, '#e8a03a'); q(Wv[0] - 3, Wv[1] - 14, 1, 1, '#e8a03a'); q(Wv[0] - 3, Wv[1] - 12, 1, 1, '#e8a03a');
  P.pots(q, ...proj(0.86, 3.48, 0).map(Math.round), 2, 1); P.pots(q, ...proj(2.06, 3.48, 0).map(Math.round), 2, 3);
  // 현관 기둥 둘과 박공 — 문 앞에 선다
  const col = (wx) => { const Pp = proj(wx, 3.0, 0); cylinder(q, Pp[0], Pp[1], 2, 30, (a, v) => v === 0 || v === 29 ? '#e6dbc6' : a < 0.35 ? '#f3e9d6' : a < 0.7 ? '#ddd1bb' : '#bfb39c'); q(Pp[0] - 3, Pp[1] - 33, 6, 3, '#e6dbc6'); q(Pp[0] - 3, Pp[1] - 1, 6, 2, '#cfc3ad'); };
  col(1.05); col(1.95);
  const ent = { x: 0.9, y: 2.85, z: 30, w: 1.2, d: 0.28, h: 5 };
  B.slab(q, ent, '#f0e6d2', '#e2d6bf', '#c3b7a0');
  const T0 = proj(ent.x, ent.y + ent.d, ent.z + ent.h), T1 = proj(ent.x + ent.w, ent.y + ent.d, ent.z + ent.h), Ta = proj(1.5, ent.y + ent.d, ent.z + ent.h + 10);
  polyFill(q, [T0, T1, Ta], (x, y) => '#ede2cc');
  polyFill(q, [[T0[0] + 3, T0[1] + 1], [T1[0] - 3, T1[1] - 1], [Ta[0], Ta[1] + 3]], (x, y) => (x + y) % 3 === 0 ? '#d3c7ae' : '#dccfb6');
  lineDots(q, T0, Ta, '#c3b7a0'); lineDots(q, T1, Ta, '#c3b7a0');
  // 계단 두 단
  B.slab(q, { x: 1.0, y: 2.85, z: 0, w: 1.0, d: 0.32, h: 3 }, '#ddd1bb', '#c9bda5', '#a89c86');
  B.slab(q, { x: 0.94, y: 3.17, z: 0, w: 1.12, d: 0.2, h: 1.5 }, '#d3c7ae', '#c0b49c', '#a0947e');
}
// ---------- 일기장 오두막 (반목조) ----------
function bDiary(q){
  const bx = { x: 4.2, y: 0.2, z: 0, w: 2.5, d: 1.6, h: 34 };
  const W = bx.w * S, D = bx.d * S;
  const plas = sh => M.plaster({ a: '#f6ecd8', b: '#ece0c8', c: '#dccdb0', base: '#b9ad95' }, 2, sh, bx.h);
  const timL = M.timber(plas(0), { beam: '#5a3f2b', beamHi: '#75563b' }, W, bx.h, 12, [1, 0, 0, 1, 0], 3);
  const timR = M.timber(plas(-26), { beam: '#3e2a1b', beamHi: '#55402a' }, D, bx.h, 13, [0, 1, 0], 4);
  B.walls(q, bx, timL, timR);
  B.gable(q, bx, { rise: 24 }, timR);
  B.win(q, 'L', bx, 6, 10, 10, 12, { flowers: 1, curtain: '#ffe6ee' });
  B.win(q, 'L', bx, 44, 10, 10, 12, { lit: '#ffd77a', curtain: '#fff0d0' });
  B.door(q, 'L', bx, 27, 16, 8, 18, { wood: '#7a4f2e' });
  // 문 옆에 펼친 책 간판
  B.on(q, 'L', bx, 37, 8, 10, 8, (u, v) => v === 0 ? (u < 2 ? '#5a4a3a' : null) : u === 4 || u === 5 ? '#c9b9a0' : (v === 1 || v === 7) ? '#d8ccb6' : (v % 2 === 0 && u > 0 && u < 9) ? '#8a7a66' : '#fff6e9');
  B.win(q, 'R', bx, 7, 10, 9, 11, { shutters: '#6b8f5a' });
  B.win(q, 'R', bx, 15, -14, 8, 8, { arch: 1, sill: false });
  P.downpipe(q, 'L', bx, 1); P.wallLamp(q, 'L', bx, 22, 14);
  B.eaveShadow(q, bx, 4);
  P.woodpile(q, 6.72, 0.55, 0.3, 0.7, 12);
  B.roofFor(q, bx, { type: 'gable', rise: 24, over: 0.22, tex: tileTex(TILE_P), cap: ['#e6b9a2', '#6b3a2c'] });
  P.dormer(q, bx, { rise: 24, over: 0.22, drop: 3 }, 4.7, 0.5, 14, { texL: plas(0), texR: plas(-26), roofTex: tileTex(TILE_P), cap: ['#e6b9a2', '#6b3a2c'], curtain: '#ffe6ee' });
  B.chimney(q, 6.1, 0.72, 50, 16);
  P.pots(q, ...proj(5.1, 1.92, 0).map(Math.round), 2, 2); P.pots(q, ...proj(5.75, 1.92, 0).map(Math.round), 1, 4);
  P.barrel(q, ...proj(4.12, 1.95, 0).map(Math.round));
  if (SPR.S.bird){ const b1 = proj(4.9, 1.0, 58).map(Math.round), b2 = proj(6.2, 1.0, 58).map(Math.round); spr(q, b1[0] - 3, b1[1] - 4, SPR.S.bird, SPR.PAL); spr(q, b2[0] - 3, b2[1] - 4, SPR.S.bird, SPR.PAL); }
  // 연기는 여기 그리지 않는다 — 첫화면이 프레임마다 피워 올린다. 굴뚝 아가리 자리만 적어 둔다
  const C0 = proj(6.24, 0.86, 68);
  VS.smoke = { x: C0[0], y: C0[1] };
}
// ---------- 축제 천막 (이벤트) ----------
function bTent(q){
  const C = proj(1.55, 6.1, 0), R = 30, H = 16, CR = 34, CH = 34;
  const stripe = (a, sh) => { const k = Math.floor(Math.acos(1 - 2 * a) / Math.PI * 14); return shade(k % 2 ? '#fff1dc' : '#d9453f', sh); };
  const shadeA = a => a < 0.12 ? -16 : a < 0.4 ? 10 : a < 0.62 ? 0 : a < 0.85 ? -20 : -36;
  cylinder(q, C[0], C[1], R, H, (a, v) => {
    if (a > 0.44 && a < 0.58 && v > 3){ const e = Math.abs(a - 0.51); return e < 0.02 ? '#2a1e1c' : e < 0.05 ? '#3d2b28' : shade('#b8332e', v % 4 === 0 ? -10 : 0); }   // 입구
    return stripe(a, shadeA(a) + (v % 5 === 0 ? -4 : 0));
  });
  // 처마 술 — 어두운 반원 줄
  for (let x = -CR; x < CR; x += 4){ const f = Math.sqrt(Math.max(0, 1 - ((x + 2) / CR) ** 2)) * (CR / 2); q(C[0] + x, Math.round(C[1] - H + f) - 1, 4, 2, '#8e2a26'); q(C[0] + x + 1, Math.round(C[1] - H + f) + 1, 2, 1, '#8e2a26'); }
  cone(q, C[0], C[1] - H, CR, CH, (a, v) => stripe(a, shadeA(a) + (v % 6 === 0 ? -6 : 0)));
  // 꼭대기 장식과 깃발
  q(C[0] - 1, C[1] - H - CH - 14, 2, 14, '#6a5a50'); q(C[0] - 3, C[1] - H - CH - 2, 6, 3, '#ffd166');
  q(C[0] + 1, C[1] - H - CH - 14, 9, 5, '#ffd166'); q(C[0] + 1, C[1] - H - CH - 9, 6, 2, '#e8b84a');
  // 매표소 — 줄무늬 작은 집
  const bx = { x: 2.55, y: 6.85, z: 0, w: 0.5, d: 0.45, h: 22 };
  B.walls(q, bx, M.canvas(['#d9453f', '#fff1dc'], 3, 7, 0), M.canvas(['#d9453f', '#fff1dc'], 3, 7, -26));
  B.on(q, 'L', bx, 2, 6, 8, 9, (u, v) => (u === 0 || u === 7 || v === 0) ? '#5a3a2a' : v === 8 ? '#a67a52' : '#3a2a2a');
  B.on(q, 'L', bx, 1, 1, 10, 4, (u, v) => v === 0 || v === 3 ? '#ffd166' : '#fff6e9');
  B.roofFor(q, bx, { type: 'hip', rise: 5, over: 0.1, drop: 1, tex: f => (u, v) => shade(u % 6 < 3 ? '#d9453f' : '#fff1dc', lit(f)), cap: ['#ffd166', '#8e2a26'] });
  P.lanterns(q, [proj(0.3, 4.75, 0)[0], proj(0.3, 4.75, 0)[1] - 30], [proj(2.9, 4.75, 0)[0], proj(2.9, 4.75, 0)[1] - 30], ['#ff6b6b', '#ffd166', '#ff8fb8', '#8fd9c8']);
  P.icecream(q, 2.85, 5.4);
  const K = [C[0] - 52, C[1] - H - CH - 28];
  // 연은 여기 그리지 않는다 — 첫화면이 바람에 흔들며 프레임마다 그린다. 자리(연 가운데)와 줄 끝(천막 기둥)만 적어 둔다
  VS.kite = { home: { x: K[0], y: K[1] }, anchor: { x: C[0] + 36, y: C[1] - 6 } };
  // 풍선
  const Bb = proj(3.05, 7.3, 0);
  [['#ff6b6b', -6, -40], ['#5aa9e6', 2, -46], ['#ffd166', 8, -38]].forEach(([c, dx, dy]) => { lineDots(q, [Bb[0], Bb[1] - 18], [Bb[0] + dx, Bb[1] + dy + 5], '#6a5a50'); ellipse(q, Bb[0] + dx, Bb[1] + dy, 4, 5, (x, y) => (x - (Bb[0] + dx) < -1 && y - (Bb[1] + dy) < -1) ? shade(c, 40) : c); q(Bb[0] + dx, Bb[1] + dy + 5, 1, 1, shade(c, -30)); });
}
// ---------- 성 (모험단) ----------
function bCastle(q){
  const WH = 46, st = sh => M.stone(STONE_P, 11, sh, WH), flag = (X, Y, col) => { q(X - 1, Y - 18, 2, 18, '#6a5a50'); q(X + 1, Y - 18, 10, 6, col); q(X + 1, Y - 12, 7, 2, shade(col, -30)); };
  const walk = sh => (u, v) => { const c = (u % 8 === 0 || v % 5 === 0) ? '#8a8276' : ['#b9b2a6', '#aea79a', '#b4ad9f'][Math.floor(hash(u >> 3, v >> 2, 12) * 3)]; return shade(c, sh); };
  const merlon = (x, y) => box(q, x, y, WH, 0.22, 0.22, 6, () => '#b5aa99', () => '#8f8577', () => '#cfc6b6');
  const tower = (wx, wy, h, flagCol) => {
    const Pp = proj(wx, wy, 0), R = 13;
    cylinder(q, Pp[0], Pp[1], R, h, (a, v) => {
      const ang = Math.acos(1 - 2 * a) / Math.PI;
      const c = M.stone(STONE_P, 13, 0, h)(Math.round(ang * 52), v);
      if (c === STONE_P.m) return c;
      const sh = a < 0.1 ? -18 : a < 0.42 ? 10 : a < 0.62 ? -2 : a < 0.85 ? -22 : -38;
      // 화살창
      if ((Math.abs(ang - 0.35) < 0.03 || Math.abs(ang - 0.68) < 0.03) && v > 12 && v < 22) return '#241f1c';
      if ((Math.abs(ang - 0.5) < 0.03) && v > 30 && v < 40) return '#241f1c';
      return shade(c, sh);
    });
    // 지붕 밑 돌림띠
    ellipse(q, Pp[0], Pp[1] - h, R + 3, (R + 3) / 2, (x, y) => y > Pp[1] - h ? '#8f8577' : '#a99f8f');
    cone(q, Pp[0], Pp[1] - h - 1, R + 3, 32, (a, v) => {
      const row = Math.floor(v / 3), r = v % 3, off = row % 2 ? 2 : 0, k = Math.floor((a * 44 + off) / 5);
      if (r === 0) return '#2f3742';
      let c = ((a * 44 + off) % 5 < 1) ? '#3d4653' : ['#5f6b7a', '#566270', '#4d5866'][(k + row) % 3];
      return shade(c, a < 0.2 ? -8 : a < 0.5 ? 12 : a < 0.75 ? -6 : -26);
    });
    if (flagCol) flag(Pp[0], Pp[1] - h - 33, flagCol);
  };
  // 뒤쪽 탑 → 뒷벽 → 왼벽
  tower(9.45, 0.45, 62);
  const back = { x: 9, y: 0, z: 0, w: 5, d: 0.5, h: WH }; box(q, back.x, back.y, 0, back.w, back.d, WH, st(0), st(-26), walk(0));
  for (let k = 0; k < 10; k++) merlon(9.14 + k * 0.5, 0.02);
  const leftW = { x: 9, y: 0.5, z: 0, w: 0.5, d: 4.0, h: WH }; box(q, leftW.x, leftW.y, 0, leftW.w, leftW.d, WH, st(0), st(-26), walk(0));
  for (let k = 0; k < 8; k++) merlon(9.02, 0.64 + k * 0.5);
  P.stairs(q, 9.55, 2.2, 4, 'y');
  // 안뜰 — 술통, 상자, 나무
  P.barrel(q, ...proj(10.1, 1.3, 0).map(Math.round)); P.barrel(q, ...proj(10.4, 1.15, 0).map(Math.round));
  P.crate(q, 9.9, 3.3, 0.35);
  P.tree(q, ...proj(9.95, 1.5, 0).map(Math.round), 2, 31);   // 앞벽보다 커야 안뜰에서 보인다
  // 아성 — 큰 사각탑
  const keep = { x: 10.5, y: 0.7, z: 0, w: 2.2, d: 2.2, h: 76 };
  const kst = sh => M.stone(STONE_P, 17, sh, keep.h);
  B.walls(q, keep, kst(0), kst(-26));
  [[8, 16], [38, 16], [8, 40], [38, 40]].forEach(([u, v]) => B.win(q, 'L', keep, u, v, 7, 11, { arch: 1, sill: false, glass: '#3c4a5a', mullion: false }));
  [[10, 16], [36, 16], [23, 40]].forEach(([u, v]) => B.win(q, 'R', keep, u, v, 7, 11, { arch: 1, sill: false, glass: '#2e3a48', mullion: false }));
  B.on(q, 'L', keep, 20, 12, 12, 36, (u, v) => { if (v === 0) return '#6a5a50'; if (v > 30 && (u + v) % 2) return null; if (u === 0 || u === 11) return '#8e2a26'; if (Math.abs(u - 5.5) + Math.abs(v - 16) <= 3.5 && !(Math.abs(u - 5.5) + Math.abs(v - 16) <= 1)) return '#ffd166'; return v % 7 === 6 ? '#b8332e' : '#d9453f'; });
  B.door(q, 'L', keep, 22, 58, 8, 18, { arch: 1, wood: '#5a3a2a', frame: '#bcb2a2' });
  quad(q, proj(keep.x, keep.y + keep.d, keep.h), UL, [-1, 0.5], keep.w * S, keep.d * S, walk(0));
  for (let k = 0; k < 4; k++){ merlon(keep.x + 0.06 + k * 0.55, keep.y + 0.02); merlon(keep.x + 0.02, keep.y + 0.1 + k * 0.55); }
  B.roofFor(q, { x: keep.x + 0.3, y: keep.y + 0.3, z: keep.h, w: keep.w - 0.6, d: keep.d - 0.6, h: 0 }, { type: 'hip', rise: 22, over: 0.04, drop: 0, tex: slateTex, cap: ['#8d97a6', '#2f3742'] });
  for (let k = 0; k < 4; k++){ merlon(keep.x + 0.06 + k * 0.55, keep.y + keep.d - 0.24); merlon(keep.x + keep.w - 0.24, keep.y + 0.1 + k * 0.55); }
  // 아성 모서리 작은 탑
  const Tp = proj(keep.x + keep.w - 0.05, keep.y + keep.d - 0.05, 0);
  cylinder(q, Tp[0], Tp[1], 7, 90, (a, v) => { const ang = Math.acos(1 - 2 * a) / Math.PI; const c = M.stone(STONE_P, 19, 0, 90)(Math.round(ang * 28), v); if (c === STONE_P.m) return c; if (Math.abs(ang - 0.5) < 0.06 && v > 40 && v < 48) return '#241f1c'; return shade(c, a < 0.4 ? 8 : a < 0.7 ? -6 : -30); });
  ellipse(q, Tp[0], Tp[1] - 90, 9, 4.5, (x, y) => y > Tp[1] - 90 ? '#8f8577' : '#a99f8f');
  cone(q, Tp[0], Tp[1] - 91, 9, 18, (a, v) => { const r = v % 3; if (r === 0) return '#2f3742'; return shade(['#5f6b7a', '#566270'][Math.floor(v / 3) % 2], a < 0.5 ? 10 : -22); });
  flag(Tp[0], Tp[1] - 109, '#d9453f');
  // 오른벽 → 오른뒤 탑
  const rightW = { x: 13.5, y: 0.5, z: 0, w: 0.5, d: 4.0, h: WH }; box(q, rightW.x, rightW.y, 0, rightW.w, rightW.d, WH, st(0), (u, v) => (v > 14 && v < 24 && (u % 24 === 12 || u % 24 === 13)) ? '#241f1c' : st(-26)(u, v), walk(0));
  for (let k = 0; k < 8; k++) merlon(13.76, 0.64 + k * 0.5);
  tower(13.55, 0.45, 62);
  // 앞벽 — 담쟁이, 그리고 성문
  const frontW = { x: 9, y: 4.5, z: 0, w: 5, d: 0.5, h: WH };
  box(q, frontW.x, frontW.y, 0, frontW.w, frontW.d, WH, (u, v) => (v > 12 && v < 22 && (u % 30 === 6 || u % 30 === 7)) ? '#241f1c' : st(0)(u, v), st(-26), walk(0));
  for (let k = 0; k < 10; k++) if (k < 4 || k > 6) merlon(9.14 + k * 0.5, 4.52);
  const cloth = col => (u, v) => { if (v === 0) return '#6a5a50'; if (v > 18 && (u + v) % 2) return null; if (u === 0 || u === 7) return shade(col, -30); if (Math.abs(u - 3.5) + Math.abs(v - 9) <= 2.5 && !(Math.abs(u - 3.5) + Math.abs(v - 9) <= 0.8)) return '#ffd166'; return v % 6 === 5 ? shade(col, -12) : col; };
  B.on(q, 'L', frontW, 36, 8, 8, 22, cloth('#3f6fb5')); B.on(q, 'L', frontW, 94, 8, 8, 22, cloth('#d9453f'));
  const Ir = proj(14, 4.2, 0);
  P.foliage(q, [[Ir[0] - 6, Ir[1] - 12, 6, 10], [Ir[0] - 12, Ir[1] - 22, 5, 8]], ['#8fcb6d', '#6cb457', '#4f9747', '#3a7a3a'], 43, { bias: 0.1 });
  P.pigeon(q, ...proj(10.2, 4.5, 52).map(Math.round));
  const I0 = proj(9.6, 5, 0);
  P.foliage(q, [[I0[0] + 4, I0[1] - 14, 7, 12], [I0[0] + 12, I0[1] - 24, 6, 10], [I0[0] - 2, I0[1] - 30, 5, 8], [I0[0] + 8, I0[1] - 6, 9, 6]], ['#8fcb6d', '#6cb457', '#4f9747', '#3a7a3a'], 41, { bias: 0.1 });
  const gate = { x: 11.0, y: 4.3, z: 0, w: 1.2, d: 0.9, h: 58 };
  const gst = sh => M.stone(STONE_P, 23, sh, gate.h);
  const arch = (u, v) => {                                             // 뾰족 아치 문과 쇠창살
    const w = 13, h = 28;
    const inside = (uu, vv) => { const c2 = uu + 0.5 - w / 2; return uu >= 0 && uu < w && vv < h && (vv >= 7 || Math.abs(c2) <= (w / 2) * Math.pow(Math.max(0, vv) / 7, 0.55)); };
    if (!inside(u, v)) return null;
    if (!inside(u - 1, v) || !inside(u + 1, v) || !inside(u, v - 1)) return '#d6cdbd';
    if (!inside(u - 2, v) || !inside(u + 2, v) || !inside(u, v - 2)) return '#a99f8f';
    if (u % 3 === 1 && v > 2) return '#6a625a';
    if (v % 5 === 3) return '#6a625a';
    return v > 24 ? '#2e2824' : '#1a1614';
  };
  B.walls(q, gate, (u, v) => arch(u - 8, v - 30) || gst(0)(u, v), gst(-26));
  B.win(q, 'L', gate, 11, 12, 7, 10, { arch: 1, sill: false, glass: '#3c4a5a', mullion: false });
  quad(q, proj(gate.x, gate.y + gate.d, gate.h), UL, [-1, 0.5], gate.w * S, gate.d * S, walk(0));
  for (let k = 0; k < 3; k++){ box(q, 11.06 + k * 0.4, 4.94, gate.h, 0.22, 0.22, 6, () => '#b5aa99', () => '#8f8577', () => '#cfc6b6'); }
  box(q, 11.06, 4.34, gate.h, 0.22, 0.22, 6, () => '#b5aa99', () => '#8f8577', () => '#cfc6b6');
  box(q, 11.9, 4.34, gate.h, 0.22, 0.22, 6, () => '#b5aa99', () => '#8f8577', () => '#cfc6b6');
  // 뒤 탑들 위 깃발은 없고, 앞 두 탑에만
  tower(9.45, 4.55, 62, '#d9453f'); tower(13.55, 4.55, 62, '#ffd166');
  // 도개교와 쇠사슬, 횃불
  box(q, 11.15, 5.0, 1, 0.9, 0.72, 2, M.planks(PLANK_P, 6, -12, true), M.planks(PLANK_P, 6, -30, true), M.planks(PLANK_P, 7, 4, true));
  lineDots(q, proj(11.15, 5.72, 3), proj(11.15, 5.2, 38), (x, y) => (x + y) % 2 ? '#6a625a' : '#3a3632');
  lineDots(q, proj(12.05, 5.72, 3), proj(12.05, 5.2, 38), (x, y) => (x + y) % 2 ? '#6a625a' : '#3a3632');
  [[10.75, 5.8], [12.45, 5.8]].forEach(([wx, wy]) => { const Pp = proj(wx, wy, 0).map(Math.round); q(Pp[0] - 1, Pp[1] - 14, 2, 14, '#3a3632'); q(Pp[0] - 3, Pp[1] - 17, 6, 3, '#4a4642'); q(Pp[0] - 2, Pp[1] - 21, 4, 4, '#ff9f3a'); q(Pp[0] - 1, Pp[1] - 24, 2, 3, '#ffd166'); q(Pp[0] - 1, Pp[1] - 19, 1, 1, '#ff6b3a'); LIGHTS.push({ x: Pp[0], y: Pp[1] - 21, r: 16, c: '#ffb04a' }); });
}
// ---------- 밭 (농장) ----------
function bGreenhouse(q){
  const bx = { x: 7.6, y: 8.95, z: 0, w: 1.4, d: 1.35, h: 16 };
  const gl = sh => (u, v) => (u % 8 === 0 || v === 0 || v === 8 || v === 15) ? '#f4f8fa' : shade((u - v) % 9 === 0 ? '#e2f1f7' : (u + v) % 11 === 0 ? '#a9d3e4' : '#c3e2ee', sh);
  B.walls(q, bx, gl(0), gl(-18));
  B.door(q, 'L', bx, 12, 2, 8, 14, { wood: '#c3e2ee', frame: '#f4f8fa', glass: '#d9edf5' });
  // 안의 초록이 비친다
  B.on(q, 'L', bx, 1, 9, bx.w * S - 2, 6, (u, v) => hash(u, v, 44) < 0.35 ? 'rgba(90,160,90,0.45)' : null);
  B.roofFor(q, bx, { type: 'gable', rise: 10, over: 0.06, drop: 1, tex: f => (u, v) => (u % 8 === 0 || v % 5 === 0) ? '#f4f8fa' : shade((u - v) % 9 === 0 ? '#e6f3f8' : '#c9e4ee', lit(f)), cap: ['#f4f8fa', '#9fb8c6'] });
}
function bShed(q){
  const bx = { x: 9.4, y: 9.05, z: 0, w: 1.2, d: 0.95, h: 24 };
  B.walls(q, bx, M.planks(PLANK_P, 8, 0), M.planks(PLANK_P, 9, -26, true));
  B.gable(q, bx, { rise: 12 }, M.planks(PLANK_P, 9, -26, true));
  B.door(q, 'L', bx, 3, 6, 9, 18, { wood: '#8f6a42', frame: '#a47c50' });
  B.win(q, 'L', bx, 17, 7, 8, 8, { frame: '#e8dcc8' });
  B.eaveShadow(q, bx, 3);
  B.roofFor(q, bx, { type: 'gable', rise: 12, over: 0.18, tex: f => M.slate(TIN_P, 3, lit(f)), cap: ['#b4bcc2', '#4a5258'] });
  // 벽에 기댄 갈퀴, 건초 더미
  const Rk = proj(10.62, 9.5, 0).map(Math.round);
  q(Rk[0], Rk[1] - 26, 2, 26, '#a67a52'); q(Rk[0] - 3, Rk[1] - 29, 8, 3, '#6a6a66'); for (let i = 0; i < 4; i++) q(Rk[0] - 3 + i * 2, Rk[1] - 26, 1, 3, '#6a6a66');
  const hay = (x, y) => box(q, x, y, 0, 0.36, 0.3, 7, M.thatch({ a: ['#e8c46a', '#d8b358', '#c9a24a'], dark: '#a8823a' }, 4, 0), M.thatch({ a: ['#e8c46a', '#d8b358', '#c9a24a'], dark: '#a8823a' }, 5, -24), M.thatch({ a: ['#e8c46a', '#d8b358', '#c9a24a'], dark: '#a8823a' }, 6, 14));
  hay(9.5, 10.25); hay(9.9, 10.3);
  P.barrel(q, ...proj(9.35, 10.1, 0).map(Math.round));
  P.cart(q, ...proj(10.45, 10.5, 0).map(Math.round));
  P.trough(q, 9.0, 8.72);
  if (SPR.S.cat){ const ct = proj(10.1, 9.55, 30).map(Math.round); spr(q, ct[0] - 5, ct[1] - 7, SPR.S.cat, SPR.PAL); }
}
// ---------- 조립 ----------
// 물건마다 겹을 하나씩 만들어 테두리를 두르고, 앞뒤 순서대로 얹는다
function sortItems(items){
  items.forEach((it, i) => { it.i = i; it.after = []; });
  const scr = it => { const c = [proj(it.x, it.y, 0), proj(it.x + it.w, it.y + it.d, 0), proj(it.x, it.y + it.d, 0), proj(it.x + it.w, it.y, 0), proj(it.x, it.y, it.h), proj(it.x + it.w, it.y, it.h)];
    return { x0: Math.min(...c.map(p => p[0])) - (it.pad || 8), x1: Math.max(...c.map(p => p[0])) + (it.pad || 8), y0: Math.min(...c.map(p => p[1])) - (it.pad || 8), y1: Math.max(...c.map(p => p[1])) + 4 }; };
  items.forEach(it => { it.bb = scr(it); });
  const over = (a, b) => !(a.bb.x1 < b.bb.x0 || b.bb.x1 < a.bb.x0 || a.bb.y1 < b.bb.y0 || b.bb.y1 < a.bb.y0);
  const eps = 0.02;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++){
    const a = items[i], b = items[j];
    if (!over(a, b)) continue;
    let ab;   // a 가 b 뒤인가
    if (a.x + a.w <= b.x + eps || a.y + a.d <= b.y + eps) ab = true;
    else if (b.x + b.w <= a.x + eps || b.y + b.d <= a.y + eps) ab = false;
    else ab = (a.x + a.w + a.y + a.d) <= (b.x + b.w + b.y + b.d);
    if (ab) a.after.push(b); else b.after.push(a);
  }
  const out = [], seen = new Set(), stack = new Set();
  const visit = it => { if (seen.has(it.i)) return; if (stack.has(it.i)) return; stack.add(it.i); (it.before || []).forEach(visit); seen.add(it.i); stack.delete(it.i); out.push(it); };
  items.forEach(it => { it.before = items.filter(o => o.after.includes(it)); });
  items.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(visit);
  return out;
}
VS.draw = function(env){
  const q = env.q, W = VS.w, H = VS.h;
  ORG.x = VS.orgX; ORG.y = SKY;
  drawSky(q, W, H);
  // 하늘에 그린 것은 겹을 거치지 않아 누를 자리 번호가 안 적힌다. 두 타워만 직접 적어 준다
  if (env.mark && VS.skyHits && typeof HITS !== 'undefined') VS.skyHits.forEach(L => {
    HITS.push({ key: L.key, x: L.x, y: L.y, w: L.w, h: L.h });
    L.rows.forEach(([y, x0, x1]) => env.mark(x0, y, x1 - x0 + 1, 1, HITS.length));
  });
  drawGround(q);
  drawDecals(q);
  SHADOW_Q = q;
  const items = [];
  const add = (x, y, w, d, h, draw, pad, key) => items.push({ x, y, w, d, h, draw, pad, key });
  const at = (wx, wy) => proj(wx, wy, 0).map(Math.round);
  // 건물
  add(0.15, 0.15, 2.7, 3.4, 96, bGallery, 16, 'gallery');
  add(4.2, 0.2, 2.5, 1.6, 74, bDiary, 16, 'house');
  add(9, 0, 5, 6.0, 130, bCastle, 20, 'castle');
  add(0.3, 4.8, 2.9, 2.6, 96, bTent, 16, 'tent');
  add(7.6, 8.95, 1.4, 1.35, 30, bGreenhouse, 8, 'greenhouse');
  add(9.4, 9.05, 1.2, 0.95, 42, bShed, 12, 'shed');
  // 미술관 앞뜰 — 조각, 벤치, 가로등
  add(0.5, 3.5, 0.4, 0.4, 30, q2 => { box(q2, 0.5, 3.5, 0, 0.4, 0.4, 10, () => '#a89f91', () => '#8a8071', () => '#cfc6b6'); const T = proj(0.7, 3.7, 10).map(Math.round); q2(T[0] - 1, T[1] - 8, 2, 8, '#8a6a3a'); ellipse(q2, T[0], T[1] - 13, 5, 5, (x, y) => (x - T[0]) + (y - (T[1] - 13)) < -2 ? '#c9a862' : (x - T[0]) + (y - (T[1] - 13)) > 3 ? '#6a4e28' : '#9a7a44'); }, 10);
  add(2.4, 3.9, 0.6, 0.2, 20, q2 => P.bench(q2, ...at(2.7, 4.0)), 12, 'bench');
  add(3.0, 2.2, 0.1, 0.1, 48, q2 => P.lamp(q2, ...at(3.05, 2.25), NIGHT), 12);
  // 일기장집 뒤뜰 — 빨래, 꽃나무
  add(7.2, 0.5, 1.4, 0.2, 30, q2 => P.laundry(q2, at(7.25, 0.6), at(8.55, 0.6)), 8);
  add(7.9, 1.5, 0.6, 0.6, 50, q2 => P.tree(q2, ...at(8.2, 1.8), 2, 7, P.BLOSSOM_PAL), 26, 'tree');
  add(3.4, 0.4, 0.8, 0.8, 70, q2 => P.tree(q2, ...at(3.8, 0.8), 3, 8), 34, 'tree');
  // 광장 — 분수, 벤치, 가로등, 꽃밭, 아이들, 고양이
  add(6.6, 4.9, 0.9, 0.9, 44, q2 => P.fountain(q2, ...at(7.05, 5.35)), 24, 'fountain');
  add(5.3, 3.55, 1.0, 0.6, 40, q2 => P.stall(q2, 5.3, 3.55, ['#d9453f', '#fff1dc'], 1), 12, 'stall');
  add(7.4, 3.55, 1.0, 0.6, 40, q2 => P.stall(q2, 7.4, 3.55, ['#3f6fb5', '#fff1dc'], 2), 12, 'stall');
  add(8.6, 4.5, 0.2, 0.6, 20, q2 => P.bench(q2, ...at(8.75, 4.8)), 12, 'bench');
  add(5.05, 4.4, 0.9, 0.28, 12, q2 => P.planter(q2, 5.05, 4.4, 0.9, 1), 8);
  add(5.05, 5.7, 0.9, 0.28, 12, q2 => P.planter(q2, 5.05, 5.7, 0.9, 2), 8);
  add(5.4, 7.35, 0.2, 0.2, 14, q2 => P.bin(q2, ...at(5.5, 7.45)), 6);
  add(8.55, 7.35, 0.2, 0.2, 14, q2 => P.bin(q2, ...at(8.65, 7.45)), 6);
  [[6.3, 4.7], [7.9, 5.95], [6.9, 4.4]].forEach(([x, y]) => add(x, y, 0.15, 0.1, 8, q2 => P.pigeon(q2, ...at(x + 0.07, y + 0.08)), 4));
  add(0.3, 4.15, 0.4, 0.15, 34, q2 => P.noticeBoard(q2, ...at(0.5, 4.28)), 12);
  add(13.55, 6.05, 0.4, 0.15, 34, q2 => P.noticeBoard(q2, ...at(13.75, 6.18)), 12);   // 성 해자 바로 앞, 풍차보다 뒤 (y 6.0 이상이라야 성보다 앞에 그려진다)
  add(0.0, 3.0, 0.22, 1.4, 10, q2 => P.hedge(q2, 0.0, 3.0, 0.22, 1.4, 10, 5), 4);
  add(7.0, 2.05, 2.0, 0.22, 10, q2 => P.hedge(q2, 7.0, 2.05, 2.0, 0.22, 10, 6), 4);
  add(7.1, 1.2, 0.1, 0.1, 36, q2 => P.birdhouse(q2, ...at(7.15, 1.25)), 8);
  add(3.95, 1.05, 0.15, 0.15, 60, q2 => { if (SPR.S.squirrel){ const Pp = at(4.0, 1.1); spr(q2, Pp[0] - 6, Pp[1] - 62, SPR.S.squirrel, SPR.PAL); } }, 10);
  add(11.6, 9.05, 0.2, 0.2, 16, q2 => P.beehive(q2, ...at(11.7, 9.15)), 8);
  add(11.85, 9.3, 0.2, 0.2, 16, q2 => P.beehive(q2, ...at(11.95, 9.4)), 8);
  add(12.45, 8.75, 1.1, 1.1, 130, q2 => P.windmill(q2, 13.0, 9.3), 44, 'windmill');
  add(1.7, 10.3, 0.6, 0.2, 20, q2 => P.bench(q2, ...at(2.0, 10.4)), 12, 'bench');
  add(3.05, 6.25, 0.1, 0.1, 48, q2 => P.lamp(q2, ...at(3.1, 6.3), NIGHT), 12);
  add(4.55, 7.35, 0.1, 0.1, 48, q2 => P.lamp(q2, ...at(4.6, 7.4), NIGHT), 12);
  add(13.1, 6.8, 0.5, 0.5, 60, q2 => P.tree(q2, ...at(13.35, 7.05), 2, 23), 26, 'tree');
  add(3.0, 11.0, 0.8, 0.5, 16, q2 => P.boat(q2, ...at(1.2, 11.35)), 14, 'boat');
  [[5.15, 3.65], [8.85, 3.65], [8.85, 7.35]].forEach(([x, y], i) => add(x - 0.05, y - 0.05, 0.1, 0.1, 48, q2 => P.lamp(q2, ...at(x, y), NIGHT), 12));   // 앞왼쪽 자리는 (4.55, 7.35) 가로등이 대신한다 — 수아가 그 앞에 선다
  const bed = (x, y, w, d, seed) => add(x, y, w, d, 8, q2 => { box(q2, x, y, 0, w, d, 4, () => '#a89f91', () => '#8a8071', () => '#6f4f38'); for (let i = 0; i < 12; i++){ const fx = x + 0.08 + hash(i, 1, seed) * (w - 0.16), fy = y + 0.08 + hash(i, 2, seed) * (d - 0.16); const Pp = proj(fx, fy, 4).map(Math.round); P.flower(q2, Pp[0], Pp[1], ['#ff8fb8', '#ffd166', '#ff7f7f', '#ffffff', '#c9a8ff'][i % 5]); } }, 6);
  bed(5.3, 6.8, 1.0, 0.4, 3); bed(7.7, 6.8, 1.0, 0.4, 4);
  add(9.0, 7.0, 0.3, 0.3, 12, q2 => { const Pp = at(9.15, 7.15); spr(q2, Pp[0] - 5, Pp[1] - 7, SPR.S.cat, SPR.PAL); }, 6);
  // 우체국 앞 — 우체통, 자전거, 가로등
  add(9.95, 5.65, 0.3, 0.3, 20, q2 => P.pillarBox(q2, ...at(10.1, 5.8)), 6, 'post');   // 해자 앞 포장길 — 예전 자리는 풍차 날개가 덮었다
  add(12.25, 6.6, 0.3, 0.7, 20, q2 => P.bike(q2, ...at(12.4, 7.0)), 10);
  add(12.6, 7.4, 0.1, 0.1, 48, q2 => P.lamp(q2, ...at(12.65, 7.45), NIGHT), 12);
  // 축제 — 만국기 기둥 둘
  add(0.25, 4.7, 0.1, 0.1, 50, q2 => { const Pp = at(0.3, 4.75); q2(Pp[0] - 1, Pp[1] - 40, 2, 40, '#8d6440'); }, 6);
  add(2.85, 4.7, 0.1, 0.1, 50, q2 => { const Pp = at(2.9, 4.75); q2(Pp[0] - 1, Pp[1] - 40, 2, 40, '#8d6440'); }, 6);
  add(0.3, 4.6, 2.6, 0.1, 60, q2 => { const a = at(0.3, 4.75), b = at(2.9, 4.75), c = proj(1.55, 6.1, 0).map(Math.round); c[1] -= 82; P.bunting(q2, [a[0], a[1] - 40], [c[0], c[1]], ['#ff6b6b', '#ffd166', '#5aa9e6', '#8fd9c8', '#ff8fb8']); P.bunting(q2, [c[0], c[1]], [b[0], b[1] - 40], ['#ffd166', '#5aa9e6', '#ff6b6b', '#8fd9c8']); }, 30);
  // 그림·가볼 곳
  add(2.5, 9.3, 0.2, 0.2, 36, q2 => P.signpost(q2, ...at(2.6, 9.45)), 14, 'sign');
  // 밭 — 울타리, 허수아비, 우물, 다리, 오리
  add(4.95, 8.65, 2.5, 0.05, 16, q2 => P.fence(q2, 4.95, 8.65, 2.5, 'x'), 6);
  add(4.95, 8.65, 0.05, 2.1, 16, q2 => P.fence(q2, 4.95, 8.65, 2.1, 'y'), 6);
  add(4.95, 10.7, 2.5, 0.05, 16, q2 => P.fence(q2, 4.95, 10.7, 2.5, 'x'), 6);
  add(6.0, 9.55, 0.3, 0.3, 40, q2 => P.scarecrow(q2, ...at(6.15, 9.7)), 12);
  add(10.9, 9.7, 0.6, 0.6, 38, q2 => P.well(q2, ...at(11.2, 10.0)), 14, 'well');
  // 키 재기 기둥 — 우물 앞. 눈금은 첫화면이 두 아이의 키로 덧그린다
  add(11.8, 9.9, 0.2, 0.2, 52, q2 => {
    const Pp = at(11.9, 10.0), RH = 46;
    P.shadow(q2, Pp[0], Pp[1], 7, 2);
    q2(Pp[0] - 2, Pp[1] - RH, 4, RH, '#c8a978');                 // 기둥
    q2(Pp[0] - 2, Pp[1] - RH, 1, RH, '#e0c396');                 // 왼쪽 밝은 면
    q2(Pp[0] + 1, Pp[1] - RH, 1, RH, '#a2854f');                 // 오른쪽 그늘
    q2(Pp[0] - 3, Pp[1] - RH - 3, 6, 3, '#8a6a3a');              // 머리 갓
    for (let i = 4; i < RH; i += 4){                              // 눈금 — 다섯 칸마다 길게
      const long = i % 20 === 0;
      q2(Pp[0] - 2, Pp[1] - i, long ? 5 : 3, 1, long ? '#3f3a33' : '#6b6259');
    }
    VS.ruler = { x: Pp[0], y: Pp[1], h: RH, cm0: 90, cm1: 180 };  // 90cm 가 밑, 180cm 가 꼭대기
  }, 8, 'ruler');
  add(3.15, 10.62, 1.2, 1.36, 22, q2 => P.bridge(q2, 3.15, 10.62, 1.2, 1.36, 'y'), 10, 'bridge');   // 길 끝에서 강 건너 땅끝까지 — 길 따라 놓으면 진입이 막힌다
  // 나무들
  [[0.6, 9.0, 3, 12], [0.4, 7.9, 1, 17], [8.6, 0.6, 1, 18]].forEach(([x, y, s, seed]) =>
    add(x - 0.3, y - 0.3, 0.6, 0.6, 30 + s * 12, q2 => (s === 1 && seed % 2 ? P.pine : P.tree)(q2, ...at(x, y), s, seed), 18 + s * 8, 'tree'));
  add(13.6, 10.4, 0.5, 0.5, 40, q2 => P.pine(q2, ...at(13.85, 10.65), 1, 19), 20, 'tree');
  add(12.0, 10.0, 0.4, 0.3, 18, q2 => P.bush(q2, ...at(12.2, 10.15), 12, 26), 10);
  add(12.9, 10.45, 0.4, 0.3, 18, q2 => P.bush(q2, ...at(13.1, 10.6), 12, 25), 10);
  add(2.9, 1.95, 0.5, 0.5, 20, q2 => P.bush(q2, ...at(3.15, 2.2), 16, 20), 12);   // 미술관 오른벽 앞 — 발자국이 겹치면 벽 뒤로 정렬돼 안 보인다
  add(9.6, 8.75, 0.5, 0.5, 20, q2 => P.bush(q2, ...at(9.85, 9.0), 14, 21), 12);
  // 앞뒤로 풀어 얹는다
  sortItems(items).forEach(it => {
    const bx0 = Math.max(0, Math.floor(it.bb.x0)) - 1, by0 = Math.max(0, Math.floor(it.bb.y0)) - 1;
    const bw = Math.min(VS.w, Math.ceil(it.bb.x1)) - bx0 + 1, bh = Math.min(VS.h, Math.ceil(it.bb.y1)) - by0 + 1;
    if (bw <= 0 || bh <= 0) return;
    const L = env.layer(bw, bh);
    it.draw((x, y, w2, h2, c) => L.q(x - bx0, y - by0, w2, h2, c));
    const id = it.key ? HITS.length + 1 : 0;   // 1부터 센다 — 0은 「아무것도 없음」. 이름 없는 물건은 0을 적어 뒤의 것을 가린다
    env.blit(L, bx0, by0, '#3a2a1e', id);
    // 말풍선을 띄울 상자는 겹보다 좁게 — 겹의 여백(pad)까지 받으면 옆 잔디 위에 뜬다
    if (it.key){
      const c = [proj(it.x, it.y, 0), proj(it.x + it.w, it.y + it.d, 0), proj(it.x, it.y + it.d, 0), proj(it.x + it.w, it.y, 0), proj(it.x, it.y, it.h), proj(it.x + it.w, it.y, it.h)];
      const x0 = Math.min(...c.map(p => p[0])) - 3, x1 = Math.max(...c.map(p => p[0])) + 3, y0 = Math.min(...c.map(p => p[1])) - 3, y1 = Math.max(...c.map(p => p[1])) + 2;
      HITS.push({ key: it.key, x: (x0 + x1) / 2, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  });
  SHADOW_Q = null;
  VS.labels = [
    { text: '포트폴리오', href: '/portfolio.html', x: 1.5, y: 1.5, z: 78 },
    { text: '이벤트', href: '/event/', x: 1.55, y: 6.1, z: 100 },
    { text: '일기장', href: '/board.html', x: 5.45, y: 1.0, z: 82 },
    { text: '모험단', href: '/quest.html', x: 12.3, y: 1.9, z: 132 },
    { text: '편지쓰기', href: '/contact.html', x: 10.1, y: 5.8, z: 28 },
    { text: '농장', href: '/farm.html', x: 6.5, y: 9.8, z: 12 },    // 낮게 띄운다 — 52 로 띄우면 폰에서 수아를 19px 덮었다
    { text: '그림 그리기', href: '/draw.html', x: 0.7, y: 10.5, z: 40 },
    { text: '가볼 곳', href: '/wish/', x: 3.2, y: 9.45, z: 48 },
  ];
};


// ---------- 소프트웨어 래스터 ----------
// 캔버스가 하는 일 가운데 쓰는 것은 채우기·얹기·테두리뿐이라 이만큼이면 된다.
// 도트마다 fillRect 를 부르면 63만 번이라 데스크톱에서 3.3초가 걸렸고,
// 도트 1:1 배열에 그린 뒤 마지막에 한 번 키우면 0.3초 안팎이다.
const COL = new Map();
function parseColor(c){
  let v = COL.get(c);
  if (v) return v;
  if (c[0] === '#'){
    const n = parseInt(c.slice(1, 7), 16);
    v = [n >> 16, (n >> 8) & 255, n & 255, c.length === 9 ? parseInt(c.slice(7, 9), 16) : 255];
  } else {
    const m = c.match(/rgba?\(([^)]+)\)/);
    const p = m[1].split(',').map(s => parseFloat(s));
    v = [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  COL.set(c, v);
  return v;
}
class Dots {
  constructor(w, h){
    this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4);
    this.ids = null;                            // 누를 자리 판정용 — 도트마다 어느 물건인지 (바탕 래스터만 가진다)
    // 도트 자리는 소수일 수 있다 — 양 끝을 따로 반올림해야 이웃과 틈이 안 생긴다
    this.q = (x, y, w2, h2, c) => { const x0 = Math.round(x), y0 = Math.round(y); this.fill(x0, y0, Math.max(1, Math.round(x + w2) - x0), Math.max(1, Math.round(y + h2) - y0), c); };
  }
  fill(x, y, w, h, c){
    const [r, g, b, a] = parseColor(c);
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    const d = this.d, W = this.w;
    if (a === 255){
      for (let yy = y0; yy < y1; yy++){
        let i = (yy * W + x0) * 4;
        for (let xx = x0; xx < x1; xx++, i += 4){ d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
      }
      return;
    }
    const sa = a / 255;
    for (let yy = y0; yy < y1; yy++){
      let i = (yy * W + x0) * 4;
      for (let xx = x0; xx < x1; xx++, i += 4){
        const da = d[i + 3] / 255, oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        d[i]     = (r * sa + d[i] * da * (1 - sa)) / oa;
        d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
        d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
        d[i + 3] = oa * 255;
      }
    }
  }
  // src 를 (dx, dy) 에 알파 합성한다
  // id 를 주면 그림이 있는 도트마다 그 번호를 적는다 — 나중에 그린 것이 덮어써서 앞뒤 가림이 맞는다
  blit(src, dx, dy, id){
    const s = src.d, d = this.d, ids = id === undefined ? null : this.ids;
    for (let y = 0; y < src.h; y++){
      const ty = y + dy; if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++){
        const tx = x + dx; if (tx < 0 || tx >= this.w) continue;
        const i = (y * src.w + x) * 4, a = s[i + 3];
        if (!a) continue;
        if (ids && a > 40) ids[ty * this.w + tx] = id;
        const j = (ty * this.w + tx) * 4;
        if (a === 255){ d[j] = s[i]; d[j + 1] = s[i + 1]; d[j + 2] = s[i + 2]; d[j + 3] = 255; continue; }
        const sa = a / 255, da = d[j + 3] / 255, oa = sa + da * (1 - sa);
        d[j]     = (s[i] * sa + d[j] * da * (1 - sa)) / oa;
        d[j + 1] = (s[i + 1] * sa + d[j + 1] * da * (1 - sa)) / oa;
        d[j + 2] = (s[i + 2] * sa + d[j + 2] * da * (1 - sa)) / oa;
        d[j + 3] = oa * 255;
      }
    }
  }
  // 실루엣을 네 방향(과 오른아래)으로 한 도트 밀어 어두운 테두리를 두르고, 그 위에 원래 그림을 얹는다
  outline(c){
    const [r, g, b] = parseColor(c);
    const o = new Dots(this.w, this.h), s = this.d, d = o.d;
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++){
      const i = (y * this.w + x) * 4;
      if (s[i + 3] > 40) continue;
      let hit = false;
      for (const [ox, oy] of offs){
        const sx = x - ox, sy = y - oy;
        if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) continue;
        if (s[(sy * this.w + sx) * 4 + 3] > 40){ hit = true; break; }
      }
      if (hit){ d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    }
    o.blit(this, 0, 0);
    return o;
  }
}

// 눈 덮기 — 물건마다 따로 그리지 않는다. 겹을 얹을 때 적어 둔 번호판(ids)에서
// 「위가 비어 있는 물건 도트」를 찾으면 그게 곧 하늘을 보고 있는 면의 꼭대기다.
// 이웃 열과 높이가 비슷하면 평평한 면이라 서너 겹 두껍게, 가파르면 한 겹만 얹는다.
// 하늘에 그린 것(도시·능선)에는 번호가 없어 저절로 빠진다 — 먼 산까지 하얘지면 과하다.
function snowCaps(R, w, h){
  const ids = R.ids;
  const isTop = (x, y) => y >= 2 && ids[y * w + x] && !ids[(y - 1) * w + x] && !ids[(y - 2) * w + x];
  const topY = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) for (let y = 2; y < h; y++) if (isTop(x, y)){ topY[x] = y; break; }
  for (let x = 0; x < w; x++) for (let y = 2; y < h; y++){
    if (!isTop(x, y)) continue;
    const l = x > 0 ? topY[x - 1] : y, r = x < w - 1 ? topY[x + 1] : y;
    const flat = (l < 0 || Math.abs(l - y) <= 1) || (r < 0 || Math.abs(r - y) <= 1);
    const n = flat ? 3 + ((x * 7 + y * 3) % 2) : 1;
    for (let k = 0; k < n; k++){
      if (!ids[(y + k) * w + x]) break;
      R.fill(x, y + k, 1, 1, k === 0 ? '#ffffff' : k === 1 ? '#f6f9ff' : 'rgba(240,246,255,0.8)');
    }
  }
}

// ---------- 밖에서 부르는 문 ----------
/* o = { w, h (도트), hs (도트 한 개의 px), orgX, orgY (땅 뒤 꼭짓점 자리, 도트), night, litP (불 켜진 창 비율 0~1),
         sprites, pal (사이트의 도트 그림), frames: [캔버스|null, 캔버스|null], snow (지붕에 눈), env (시험용) }
   돌려주는 것: 캔버스와, 첫화면 코드가 놀이를 얹는 데 쓰는 자리들(전부 도트 단위). */
function render(o){
  SPR = { S: o.sprites || {}, PAL: o.pal || {} };
  NIGHT = !!o.night; LIT_P = o.litP == null ? 0.6 : o.litP; LIGHTS.length = 0; HITS.length = 0;
  VS.w = Math.max(64, Math.ceil(o.w)); VS.h = Math.max(64, Math.ceil(o.h)); VS.orgX = o.orgX; SKY = o.orgY;
  const hs = o.hs || 1;
  let canvas = null, env = o.env, R = null;
  if (!env){
    R = new Dots(VS.w, VS.h);
    R.ids = new Uint8Array(VS.w * VS.h);
    env = {
      q: R.q,
      layer: (w, h) => new Dots(Math.ceil(w) + 2, Math.ceil(h) + 2),
      blit: (L, x, y, outline, id) => R.blit(outline ? L.outline(outline) : L, Math.round(x), Math.round(y), id),
      // 겹 없이 바로 그린 것(하늘의 타워)에 누를 자리 번호를 적는다
      mark: (x, y, w, h, id) => { for (let yy = Math.max(0, y); yy < Math.min(VS.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(VS.w, x + w); xx++) R.ids[yy * VS.w + xx] = id; },
    };
  }
  VS.draw(env);
  // 눈 오는 날 — 지붕과 나무 꼭대기에 눈이 쌓인다. 물건마다 따로 그리지 않고,
  // 겹을 얹을 때 적어 둔 번호판(ids)으로 열마다 「맨 위 물건 도트」를 찾아 그 위에 흰 점을 놓는다.
  // 하늘에 그린 것(도시·능선)에는 번호가 없어서 저절로 빠진다 — 먼 산까지 하얘지면 과하다.
  if (R && o.snow) snowCaps(R, VS.w, VS.h);
  if (R){
    // 도트 그림을 캔버스에 옮기고 hs 배로 키운다 — 보간을 끄면 도트가 그대로 커진다
    const small = document.createElement('canvas'); small.width = VS.w; small.height = VS.h;
    small.getContext('2d').putImageData(new ImageData(R.d, VS.w, VS.h), 0, 0);
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(VS.w * hs); canvas.height = Math.ceil(VS.h * hs);
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, canvas.width, canvas.height);
    small.width = 0;                            // 옮겼으니 바로 놓아 준다 — 캔버스 기억은 GC 를 기다리지 않는다
    R.d = null;                                 // 도트 배열도. 판정용 번호판(ids)만 남긴다
    env.g = g;                                  // 걸린 그림은 여기에 hs 배로 붙인다
  }
  // 걸린 그림 — 벽면이 2:1 로 기울어 있어서 그림을 세로 기둥으로 잘라 한 도트씩 내려 붙인다
  if (env.g && o.frames) VS.frameRects.forEach((f, i) => {
    const img = o.frames[i]; if (!img) return;
    const g = env.g; g.save(); g.imageSmoothingEnabled = false;
    for (let c = 0; c < f.w; c++){
      const sx = Math.floor(c * img.width / f.w), sw = Math.max(1, Math.floor((c + 1) * img.width / f.w) - sx);
      g.drawImage(img, sx, 0, sw, img.height, Math.round((f.x + c) * hs), Math.round((f.y + Math.floor(c / 2)) * hs), Math.max(1, Math.round((f.x + c + 1) * hs) - Math.round((f.x + c) * hs)), Math.round(f.h * hs));
    }
    g.restore();
  });
  const pt = (x, y, z) => { const p = proj(x, y, z || 0); return { x: p[0], y: p[1] }; };
  const doorP = B.faceCenter('L', { x: 4.2, y: 0.2, z: 0, w: 2.5, d: 1.6, h: 34 }, 27, 16);
  const hits = HITS.slice(), ids = R ? R.ids : null, w = VS.w, h = VS.h;
  // 이 마을의 원점을 붙잡아 둔다 — ORG 는 모듈 변수라, 뒤에 다른 render 가 오면 바뀐다.
  // 첫화면은 한 번에 마을 하나만 쓰지만, 시험 삼아 하나 더 그렸더니 잔디가 해자로 읽혔다.
  const ox = VS.orgX, oy = SKY;
  const unprojHere = (x, y) => { const a = (x - ox) / TW, b = (y - oy) / TH; return [b + a, b - a]; };
  return {
    canvas, hs, w: VS.w, h: VS.h,
    lights: LIGHTS.slice(), hits,
    // 도트 자리에 그려진 물건 — 상자가 아니라 실제로 찍힌 도트로 본다. 없으면 null
    hitAt: (dx, dy) => {
      if (!ids) return null;
      const x = Math.floor(dx), y = Math.floor(dy);
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const i = ids[y * w + x];
      return i ? hits[i - 1] : null;
    },
    labels: VS.labels.map(l => Object.assign({ text: l.text, href: l.href }, pt(l.x, l.y, l.z))),
    // 아이 둘은 서로도, 광장 가로등과도 안 겹치게 왼쪽으로 벌려 세운다 (도트 그림이 한 칸보다 넓다)
    chars: { sua: pt(4.75, 6.95), yona: pt(6.7, 6.6), chick: pt(7.15, 7.3), easel: pt(0.7, 10.5) },   // 이젤은 강가 — 큰 나무 밑에서는 가려졌다
    // 숨는 자리 일곱 곳 — 낮은 물건(벤치·덤불·술통·화단·건초·성벽) 꼭대기보다 넉 도트 아래에 발을 둔다.
    // 위 절반만 그리면 물건 너머로 머리만 내민 것처럼 보인다. 아이·이젤 터치 영역과 꼬리표를 피한 자리다.
    secrets: [[1.9, 9.82], [2.77, 1.81], [3.78, 1.64], [5.35, 6.85], [9.38, 10.04], [8.58, 2.25], [11.94, 9.90]].map(([x, y]) => pt(x, y)),
    frames: VS.frameRects.map(f => ({ x: f.cx, y: f.cy, w: f.w, h: f.h })),
    house: { door: { x: doorP.x, y: doorP.y, w: 8, h: 18 }, foot: pt(5.75, 1.95) },
    kite: VS.kite ? { home: VS.kite.home, anchor: VS.kite.anchor } : null,   // 연 가운데와 줄 끝(도트) — 첫화면이 흔들며 그린다
    smoke: VS.smoke || null,                    // 굴뚝 아가리 — 첫화면이 연기를 피운다
    ruler: VS.ruler || null,                    // 키 재기 기둥 — 첫화면이 두 아이 눈금을 얹는다
    horizon: SKY,
    // 도트 자리 → 땅 칸. 땅 밖이면 kind 가 null
    worldAt: (dx, dy) => { const [tx, ty] = unprojHere(dx, dy); return { tx, ty, kind: inPlot(tx, ty) ? kindAt(tx, ty) : null }; },
    dotAt: (tx, ty) => ({ x: ox + (tx - ty) * TW / 2, y: oy + (tx + ty) * TH / 2 }),
    kindOf: (tx, ty) => inPlot(tx, ty) ? kindAt(tx, ty) : null,
    PW, PD,
  };
}
// ---------- 첫화면이 프레임마다 움직여 그리는 작은 것들 ----------
// 오리와 연. 마을 그림과 같은 코드로 도트 1:1 캔버스를 만들어 준다 — 배율은 첫화면이 맞춘다.
function dotsCanvas(w, h, draw){
  const D = new Dots(w, h); draw(D.q);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(D.d, w, h), 0, 0);
  return c;
}
function sprites(){
  // 오리: 오른쪽을 본다. 기준점 (6, 10) 은 물에 닿는 배 밑 가운데
  const duck = { canvas: dotsCanvas(14, 10, q => P.duck(q, 6, 10)), w: 14, h: 10, ox: 6, oy: 10 };
  // 연: 몸통 가운데가 기준점 (12, 6). 꼬리가 물결치는 위상 12장
  const kite = [];
  for (let i = 0; i < 12; i++) kite.push({ canvas: dotsCanvas(24, 44, q => P.kite(q, 12, 6, i / 12)), w: 24, h: 44, ox: 12, oy: 6 });
  return { duck, kite };
}
return { render, sprites };
})();
if (typeof module !== 'undefined') module.exports = Village;
