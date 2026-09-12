/* 지뢰찾기 — 마을 밭에서 지뢰를 피해 땅을 여는 놀이.
 *
 * 규칙은 나무위키 「지뢰찾기」를 그대로 따랐다:
 *   · 난이도 초급 9×9 지뢰 10 · 중급 16×16 지뢰 40 · 고급 30×16 지뢰 99
 *   · 첫 칸에는 지뢰가 생기지 않는다(윈도 비스타 이후 방식). 여기서는 둘레 여덟 칸까지
 *     비워서 첫 클릭이 늘 넓게 열리게 했다 — 아이가 첫 수부터 찍기를 하지 않게.
 *   · 오른쪽 단추 한 번이면 깃발, 두 번이면 물음표, 세 번이면 빈 칸.
 *   · 숫자 칸 둘레에 깃발을 수만큼 꽂았으면 그 숫자에서 「화음(chord)」으로 둘레를 한꺼번에
 *     연다(두 번 누르기·왼쪽+오른쪽·Shift+클릭·가운데 단추). 깃발이 틀렸으면 그대로 끝난다.
 *   · 끝나면 이 판의 3BV(깃발 없이 깨는 데 드는 최소 클릭 수)를 알려 준다.
 *
 * 그림은 첫 화면 마을이 레퍼런스다. 마을과 같은 잔디 다섯 색과 흙 색, 같은 자리 잡음(hash),
 * 그리고 왼쪽 위에서 오는 빛(윗면·왼면이 밝고 아랫면·오른면이 어둡다)을 그대로 쓴다.
 * 숫자는 글꼴 대신 3×5 도트로 직접 찍는다 — 칸 크기가 어떻든 흐려지지 않는다.
 */

buildChrome('games');   // 머리글의 「게임」 자리에 있는 놀이다

// ---------- 난이도 ----------
const MINE_LEVELS = {
  easy:   { name: '초급', cols: 9,  rows: 9,  mines: 10 },
  mid:    { name: '중급', cols: 16, rows: 16, mines: 40 },
  hard:   { name: '고급', cols: 30, rows: 16, mines: 99 },
};
const MINE_ORDER = ['easy', 'mid', 'hard'];
const TILE = 14;                       // 칸 하나가 도트 몇 알인지
const BEST_KEY = 'sy.mine.best.';

// ---------- 도트 숫자 (3×5) ----------
const MD = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '..#', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
};
// 숫자 색 — 흔한 지뢰찾기 색을 사이트 팔레트 쪽으로 당겨 왔다(종이색 위에서 읽히게)
const MC = { 1: '#2f6fd0', 2: '#2f8f4a', 3: '#c03a4b', 4: '#6a4fb5',
             5: '#a0562c', 6: '#1f8f95', 7: '#2f2a24', 8: '#6f6558' };

// 마을에서 그대로 가져온 색과 잡음
const GRASS = ['#7db663', '#74ad5b', '#86bf6c', '#6da456', '#80b868'];
const DIRT  = ['#b89468', '#ae8a5e', '#a48058', '#b28e62'];
function mhash(x, y, s){
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + ((s || 0) | 0) * 1274126177;
  h = (h ^ (h >>> 13)) * 1103515245; h = h ^ (h >>> 16);
  return ((h >>> 0) % 10007) / 10007;
}
function mshade(hex, d){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + d));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d));
  const b = Math.max(0, Math.min(255, (n & 255) + d));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ---------- 판 ----------
let lv = 'easy';
let cols = 9, rows = 9, mines = 10;
let mine = [], near = [], state = [];     // state: 0 닫힘 · 1 열림 · 2 깃발 · 3 물음표
let laid = false, dead = false, won = false, opened = 0, boomAt = -1;
let t0 = 0, tick = 0, secs = 0, bv = 0;
let cur = 0;                              // 열쇠판 커서
let flagMode = false;
let dot = 3, CS = TILE * 3;               // 도트 한 알 크기, 칸 크기(화면 픽셀)

const mCv = () => document.getElementById('mineBoard');

function reset(keepLevel){
  const L = MINE_LEVELS[lv];
  cols = L.cols; rows = L.rows; mines = L.mines;
  const n = cols * rows;
  mine = new Uint8Array(n); near = new Uint8Array(n); state = new Uint8Array(n);
  laid = false; dead = false; won = false; opened = 0; boomAt = -1; secs = 0; bv = 0;
  cur = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  clearInterval(tick); tick = 0;
  if (!keepLevel) flagMode = false;
  sizeBoard();
  paint();
  hud();
  say('아무 칸이나 눌러 시작해요 — 첫 칸에는 지뢰가 없어요');
}

// 첫 칸과 그 둘레를 뺀 자리에 지뢰를 흩는다. 뺄 자리가 지뢰보다 많으면 첫 칸만 뺀다.
function layMines(first){
  const safe = {};
  const around = neighbors(first).concat([first]);
  if (cols * rows - around.length >= mines) around.forEach(i => { safe[i] = 1; });
  else safe[first] = 1;
  let left = mines, n = cols * rows;
  while (left > 0){
    const i = Math.floor(Math.random() * n);
    if (mine[i] || safe[i]) continue;
    mine[i] = 1; left--;
  }
  for (let i = 0; i < n; i++) near[i] = mine[i] ? 0 : neighbors(i).reduce((a, j) => a + mine[j], 0);
  bv = count3BV();
  laid = true;
  t0 = Date.now();
  tick = setInterval(() => { if (!dead && !won){ secs = Math.floor((Date.now() - t0) / 1000); hud(); } }, 500);
}

function neighbors(i){
  const x = i % cols, y = (i / cols) | 0, out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) out.push(ny * cols + nx);
  }
  return out;
}

/* 3BV — 깃발을 하나도 안 쓰고 깰 때 눌러야 하는 최소 칸 수.
   빈 칸 덩어리(숫자 0끼리 이어진 것) 하나에 1, 그 덩어리에 닿지 않는 숫자 칸마다 1. */
function count3BV(){
  const n = cols * rows, seen = new Uint8Array(n), edge = new Uint8Array(n);
  let v = 0;
  for (let i = 0; i < n; i++){
    if (mine[i] || near[i] || seen[i]) continue;
    v++;
    const st = [i]; seen[i] = 1;
    while (st.length){
      const k = st.pop();
      neighbors(k).forEach(j => {
        if (mine[j]) return;
        edge[j] = 1;                                   // 덩어리에 닿는 숫자 칸
        if (!near[j] && !seen[j]){ seen[j] = 1; st.push(j); }
      });
    }
  }
  for (let i = 0; i < n; i++) if (!mine[i] && near[i] && !edge[i]) v++;
  return v;
}

// ---------- 여는 손 ----------
function openAt(i){
  if (dead || won || state[i] === 1 || state[i] === 2) return;
  if (!laid) layMines(i);
  if (mine[i]){ boom(i); return; }
  const st = [i];
  while (st.length){
    const k = st.pop();
    if (state[k] === 1 || state[k] === 2) continue;
    state[k] = 1; opened++;
    if (!near[k]) neighbors(k).forEach(j => { if (state[j] !== 1 && state[j] !== 2) st.push(j); });
  }
  checkWin();
}
function chordAt(i){
  if (dead || won || state[i] !== 1 || !near[i]) return;
  const nb = neighbors(i);
  const flags = nb.filter(j => state[j] === 2).length;
  if (flags !== near[i]) return;
  nb.forEach(j => { if (state[j] === 0 || state[j] === 3) openAt(j); });
}
function markAt(i){
  if (dead || won || state[i] === 1) return;
  state[i] = state[i] === 0 ? 2 : state[i] === 2 ? 3 : 0;   // 빈칸 → 깃발 → 물음표 → 빈칸
  hud();
}
function boom(i){
  dead = true; boomAt = i; clearInterval(tick);
  say('지뢰를 밟았어요 — 다시 해볼까요?', '이 판은 최소 ' + bv + '번만 눌러도 깰 수 있었어요 (3BV)');
}
function checkWin(){
  if (opened !== cols * rows - mines) return;
  won = true; clearInterval(tick);
  secs = laid ? Math.floor((Date.now() - t0) / 1000) : 0;
  // 다 맞혔으면 남은 지뢰 칸에는 깃발을 대신 꽂아 준다 — 판이 깔끔하게 끝난다
  for (let i = 0; i < mine.length; i++) if (mine[i]) state[i] = 2;
  const key = BEST_KEY + lv;
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  const 신기록 = !best || secs < best;
  if (신기록) { try { localStorage.setItem(key, String(secs)); } catch (e) { /* 위와 같다 */ } }
  say('다 찾았어요! ' + secs + '초' + (신기록 ? ' — 새 기록이에요!' : ''),
      '이 판은 최소 ' + bv + '번 눌러야 하는 판이었어요 (3BV)');
  sfxSafe('fanfare');
  hud();
}

// ---------- 계기판 ----------
function say(msg, sub){
  const el = document.getElementById('mMsg');
  if (el) el.innerHTML = escapeHTML(msg) + (sub ? '<span class="sub">' + escapeHTML(sub) + '</span>' : '');
}
function hud(){
  const flags = state.reduce((a, s) => a + (s === 2 ? 1 : 0), 0);
  const left = document.getElementById('mLeft'), time = document.getElementById('mTime');
  if (left) left.textContent = Math.max(-99, mines - flags);
  if (time) time.textContent = secs;
  const b = document.getElementById('mBest');
  if (b){
    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY + lv)) || 0; } catch (e) { /* 저장이 막힌 브라우저 — 없이도 돌아간다 */ }
    b.textContent = best ? MINE_LEVELS[lv].name + ' 최고 기록 ' + best + '초' : '';
  }
}

// ---------- 그림 ----------
// 칸 하나는 14×14 도트다. 칸마다 매번 도트를 찍으면 고급 판(480칸)에서 화면이 끈다 —
// 종류마다 한 번만 구워 두고 붙이기만 한다(마을·농장이 쓰는 것과 같은 수법).
let baked = null, bakedKey = '';
function tileCanvas(){
  const c = document.createElement('canvas');
  c.width = CS; c.height = CS;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g, q: (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * dot, y * dot, w * dot, h * dot); } };
}
// 잔디 블록 — 마을 잔디 다섯 색에 같은 자리 잡음. 빛은 왼쪽 위.
function bakeClosed(v){
  const { c, q } = tileCanvas();
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++){
    let col = GRASS[Math.floor(mhash(x >> 1, y >> 1, v + 1) * GRASS.length)];
    if (mhash(x >> 2, y >> 2, v + 9) < 0.3) col = mshade(col, -7);
    q(x, y, 1, 1, col);
  }
  for (let x = 0; x < TILE; x++){ q(x, 0, 1, 1, 'rgba(255,255,255,.34)'); q(x, TILE - 2, 1, 2, 'rgba(47,42,36,.30)'); }
  for (let y = 0; y < TILE; y++){ q(0, y, 1, 1, 'rgba(255,255,255,.22)'); q(TILE - 2, y, 2, 1, 'rgba(47,42,36,.22)'); }
  // 마을처럼 소품을 조금 — 네 판에 한 판꼴로 꽃, 한 판꼴로 돌
  if (v === 1){ q(5, 6, 1, 1, '#ff8fc0'); q(6, 5, 1, 1, '#ffb7d5'); q(6, 6, 1, 1, '#fff3a0'); q(7, 6, 1, 1, '#ffb7d5'); q(6, 7, 1, 2, '#559b50'); }
  if (v === 2){ q(8, 8, 3, 2, '#a49c92'); q(8, 8, 3, 1, '#c2bab0'); q(9, 10, 2, 1, '#857d75'); }
  if (v === 3){ q(4, 9, 2, 1, '#6fb567'); q(3, 10, 4, 1, '#559b50'); }
  return c;
}
// 파 놓은 흙 — 마을 밭 마당과 같은 색. 가장자리는 파인 것처럼 안쪽이 그늘진다.
function bakeOpen(v){
  const { c, q } = tileCanvas();
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++){
    let col = DIRT[Math.floor(mhash(x >> 1, y >> 1, v + 21) * DIRT.length)];
    const n = mhash(x, y, v + 31);
    if (n < 0.05) col = '#8a6a48';
    else if (n > 0.96) col = '#d3b58a';
    q(x, y, 1, 1, col);
  }
  for (let x = 0; x < TILE; x++){ q(x, 0, 1, 1, 'rgba(47,42,36,.26)'); q(x, TILE - 1, 1, 1, 'rgba(255,255,255,.16)'); }
  for (let y = 0; y < TILE; y++){ q(0, y, 1, 1, 'rgba(47,42,36,.20)'); q(TILE - 1, y, 1, 1, 'rgba(255,255,255,.12)'); }
  return c;
}
// 3×5 도트 글자를 칸 가운데에 두 배 크기로
function stamp(q, pat, col, ox, oy){
  for (let y = 0; y < pat.length; y++) for (let x = 0; x < pat[y].length; x++)
    if (pat[y][x] === '#') q(ox + x * 2, oy + y * 2, 2, 2, col);
}
function bakeNum(n){
  const { c, q } = tileCanvas();
  stamp(q, MD[n], MC[n] || '#2f2a24', 4, 2);
  return c;
}
function bakeQuestion(){
  const { c, q } = tileCanvas();
  stamp(q, MD['?'], '#5c5448', 4, 2);
  return c;
}
// 깃발 — 마을 울타리와 같은 나무색 기둥에 코랄 깃발
function bakeFlag(){
  const { c, q } = tileCanvas();
  q(6, 2, 1, 9, '#8a5f3a'); q(6, 2, 1, 1, '#c79b6d');
  q(4, 10, 5, 1, '#6b4a2c'); q(3, 11, 7, 1, '#4f3722');
  q(7, 2, 4, 1, '#c03a4b'); q(7, 3, 4, 1, '#ff7f8a'); q(7, 4, 3, 1, '#ff7f8a'); q(7, 5, 2, 1, '#c03a4b');
  return c;
}
// 지뢰 — 까만 알에 왼쪽 위 빛, 사방 뿔, 위에 심지
function bakeMine(kind){
  const { c, q } = tileCanvas();
  if (kind === 'boom'){                                  // 밟은 자리는 불꽃 위에
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++)
      q(x, y, 1, 1, (x + y) % 2 ? '#ff8c2e' : '#ffb04a');
  }
  const ink = '#2f2a24';
  q(5, 3, 4, 1, ink); q(4, 4, 6, 1, ink);
  q(3, 5, 8, 4, ink); q(4, 9, 6, 1, ink); q(5, 10, 4, 1, ink);
  q(6, 1, 1, 2, ink); q(6, 11, 1, 2, ink); q(1, 6, 2, 1, ink); q(11, 6, 2, 1, ink);
  q(3, 3, 1, 1, ink); q(10, 10, 1, 1, ink); q(10, 3, 1, 1, ink); q(3, 10, 1, 1, ink);
  q(5, 5, 2, 1, '#8a8378'); q(5, 6, 1, 1, '#6f6558');    // 빛
  q(8, 2, 1, 1, '#a97b4f'); q(9, 1, 1, 1, '#ffd84d');    // 심지와 불똥
  if (kind === 'wrong'){ for (let i = 0; i < 9; i++){ q(3 + i, 3 + i, 1, 1, '#c03a4b'); q(11 - i, 3 + i, 1, 1, '#c03a4b'); } }
  return c;
}
// 이긴 판에서는 지뢰 자리에 마을 꽃이 핀다
function bakeFlower(){
  const { c, g } = tileCanvas();
  const s = Math.max(1, Math.floor(TILE * dot / 7));
  drawSprite(g, SPRITES.flower, Math.floor((CS - 5 * s) / 2), Math.floor((CS - 6 * s) / 2), s);
  return c;
}
function bakeCursor(){
  const { c, q } = tileCanvas();
  for (let i = 0; i < TILE; i++){
    if (i % 3 !== 2){ q(i, 0, 1, 1, '#2f2a24'); q(i, TILE - 1, 1, 1, '#2f2a24'); q(0, i, 1, 1, '#2f2a24'); q(TILE - 1, i, 1, 1, '#2f2a24'); }
  }
  return c;
}
function bake(){
  const key = CS + 'x' + dot;
  if (baked && bakedKey === key) return baked;
  bakedKey = key;
  baked = {
    closed: [0, 1, 2, 3].map(bakeClosed),
    open: [0, 1, 2, 3].map(bakeOpen),
    num: [null].concat([1, 2, 3, 4, 5, 6, 7, 8].map(bakeNum)),
    q: bakeQuestion(), flag: bakeFlag(),
    mine: bakeMine('plain'), boom: bakeMine('boom'), wrong: bakeMine('wrong'),
    flower: bakeFlower(), cursor: bakeCursor(),
  };
  return baked;
}

// 판 크기 — 칸이 너무 작으면 손가락으로 못 누른다. 고급은 좁은 화면에서 옆으로 밀린다.
function sizeBoard(){
  const cv = mCv(); if (!cv) return;
  const box = cv.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const room = Math.max(200, (box.clientWidth || 320) - 2);
  // 도트 두 알까지 줄이면 고급 판이 화면 폭에 딱 들어가지만 칸이 11px 이 된다 —
  // 손가락으로 누르다 지뢰를 밟기 쉬워서, 세 알 밑으로는 줄이지 않고 옆으로 밀리게 둔다.
  dot = Math.max(3, Math.min(5, Math.floor(room * dpr / cols / TILE)));
  CS = TILE * dot;
  const w = cols * CS + 4 * dot, h = rows * CS + 4 * dot;    // 둘레에 나무 테두리 두 도트씩
  cv.width = w; cv.height = h;
  cv.style.width = Math.round(w / dpr) + 'px';
  baked = null;
}
/* 누르고 있는 칸은 살짝 아래로 가라앉는다 — 손끝이 닿았다는 느낌이 나야 한다.
   위로 비는 자리는 그림자로 메우고, 타일은 그만큼 아래를 잘라 그린다(옆 칸을 안 밟게).
   가라앉는 깊이는 도트 한 칸 — 화면이 커져 칸이 커져도 같은 비율로 보인다. */
function sinkPx(){ return Math.max(1, Math.round(dot * 0.8)); }
function paint(){
  const cv = mCv(); if (!cv) return;
  const g = cv.getContext('2d');
  const B = bake(), pad = 2 * dot;
  g.imageSmoothingEnabled = false;
  const pressI = (press && !press.moved && !dead && !won) ? press.i : -1;
  const sink = sinkPx();
  // 한 칸을 그리는 법 — 눌린 칸이면 아래로 밀고 그만큼 아랫단을 자른다
  const put = (img, x, y, dy) => {
    if (!dy){ g.drawImage(img, x, y); return; }
    g.drawImage(img, 0, 0, CS, CS - dy, x, y + dy, CS, CS - dy);
  };
  // 나무 테두리 — 마을 울타리 색
  g.fillStyle = '#8a5f3a'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#c79b6d'; g.fillRect(0, 0, cv.width, dot); g.fillRect(0, 0, dot, cv.height);
  g.fillStyle = '#6b4a2c'; g.fillRect(0, cv.height - dot, cv.width, dot); g.fillRect(cv.width - dot, 0, dot, cv.height);
  for (let i = 0; i < cols * rows; i++){
    const x = pad + (i % cols) * CS, y = pad + (((i / cols) | 0)) * CS;
    const v = Math.floor(mhash(i % cols, (i / cols) | 0, 5) * 4);
    const s = state[i];
    const dy = i === pressI ? sink : 0;
    // 눌려 비는 자리 — 잔디 칸은 그늘진 잔디, 판 칸은 그늘진 흙. 검은 줄이 아니라 흙벽처럼 보이게
    if (dy){ g.fillStyle = s === 1 ? '#7d5f3f' : '#52803f'; g.fillRect(x, y, CS, dy); }
    if (s === 1){
      put(B.open[v], x, y, dy);
      if (near[i]) put(B.num[near[i]], x, y, dy);
    } else {
      put(B.closed[v], x, y, dy);
      if (s === 2 && !(dead && !mine[i])) put(B.flag, x, y, dy);
      if (s === 3) put(B.q, x, y, dy);
    }
    // 끝난 판에서는 지뢰를 보여 준다 — 이겼으면 꽃으로
    if (won && mine[i]) g.drawImage(B.flower, x, y);
    if (dead && mine[i] && s !== 2) g.drawImage(i === boomAt ? B.boom : B.mine, x, y);
    if (dead && !mine[i] && s === 2) g.drawImage(B.wrong, x, y);
  }
  if (!dead && !won && keyMode) g.drawImage(B.cursor, pad + (cur % cols) * CS, pad + (((cur / cols) | 0)) * CS);
}

// ---------- 손과 열쇠판 ----------
let keyMode = false;                      // 열쇠판을 쓰기 시작하면 커서를 보여 준다
let press = null, longT = 0, lastTap = 0, lastCell = -1;

function cellAt(e){
  const cv = mCv(), r = cv.getBoundingClientRect();
  const pad = 2 * dot;
  const x = Math.floor(((e.clientX - r.left) * cv.width / r.width - pad) / CS);
  const y = Math.floor(((e.clientY - r.top) * cv.height / r.height - pad) / CS);
  if (x < 0 || x >= cols || y < 0 || y >= rows) return -1;
  return y * cols + x;
}
function after(){ paint(); hud(); }

function wire(){
  const cv = mCv(); if (!cv) return;

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const i = cellAt(e); if (i < 0) return;
    keyMode = false;
    press = { i, t: Date.now(), moved: false, btn: e.button, both: e.buttons === 3 };
    paint();                                   // 눌린 칸이 곧바로 내려앉게
    // 길게 누르면 깃발 — 손가락으로 노는 아이에게는 이 길이 오른쪽 단추다
    clearTimeout(longT);
    longT = setTimeout(() => {
      if (press && press.i === i && !press.moved){ markAt(i); press = null; sfxSafe('pop'); after(); }
    }, 420);
  });
  cv.addEventListener('pointermove', e => {
    if (press && !press.moved && cellAt(e) !== press.i){ press.moved = true; paint(); }
  });
  cv.addEventListener('pointercancel', () => { clearTimeout(longT); press = null; paint(); });
  cv.addEventListener('pointerup', e => {
    clearTimeout(longT);
    const p = press; press = null;
    if (!p) return;
    const i = cellAt(e);
    if (i < 0 || i !== p.i || p.moved){ paint(); return; }   // 손을 떼면 칸이 다시 올라온다
    const now = Date.now();
    const dbl = i === lastCell && now - lastTap < 320;
    lastTap = now; lastCell = i;

    if (e.button === 2 || p.btn === 2){ markAt(i); sfxSafe('pop'); after(); return; }
    if (p.both || e.button === 1 || e.shiftKey || (dbl && state[i] === 1)){ chordAt(i); after(); return; }
    if (flagMode){ markAt(i); sfxSafe('pop'); after(); return; }
    if (state[i] === 1){ chordAt(i); after(); return; }    // 열린 숫자를 한 번 눌러도 화음
    openAt(i);
    sfxSafe(dead ? 'thud' : 'plant');
    after();
  });

  cv.addEventListener('keydown', e => {
    const x = cur % cols, y = (cur / cols) | 0;
    let k = cur;
    if (e.key === 'ArrowLeft') k = y * cols + Math.max(0, x - 1);
    else if (e.key === 'ArrowRight') k = y * cols + Math.min(cols - 1, x + 1);
    else if (e.key === 'ArrowUp') k = Math.max(0, y - 1) * cols + x;
    else if (e.key === 'ArrowDown') k = Math.min(rows - 1, y + 1) * cols + x;
    else if (e.key === 'Enter' || e.key === ' '){ if (state[cur] === 1) chordAt(cur); else openAt(cur); }
    else if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') markAt(cur);
    else if (e.key === 'c' || e.key === 'C' || e.key === 'ㅊ') chordAt(cur);
    else return;
    e.preventDefault();
    cur = k; keyMode = true;
    after();
  });

  document.getElementById('mNew').addEventListener('click', () => { reset(true); mCv().focus(); });
  // 소리 끄기 — 첫 화면과 같은 단추를 쓴다(끈 것은 이 기계에 기억된다)
  if (typeof wireSoundButton === 'function') wireSoundButton(document.getElementById('mSound'));
  const fm = document.getElementById('mFlagMode');
  fm.addEventListener('click', () => {
    flagMode = !flagMode;
    fm.classList.toggle('primary', flagMode);
    fm.setAttribute('aria-pressed', flagMode ? 'true' : 'false');
    fm.textContent = flagMode ? '🚩 깃발 모드 (켜짐)' : '🚩 깃발 모드';
  });

  const box = document.getElementById('levels');
  MINE_ORDER.forEach(k => {
    const L = MINE_LEVELS[k];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = k === lv ? 'on' : '';
    b.innerHTML = escapeHTML(L.name) + '<small>' + L.cols + '×' + L.rows + ' · 지뢰 ' + L.mines + '</small>';
    b.addEventListener('click', () => {
      lv = k;
      Array.from(box.children).forEach(c => c.classList.toggle('on', c === b));
      reset(true);
    });
    box.appendChild(b);
  });

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { sizeBoard(); paint(); }, 150); });
}
// 소리는 첫 화면·농장과 같은 것을 쓰되, 없는 판(옛 common.js)과 짝이 되면 조용히 넘긴다
function sfxSafe(k){ try { if (typeof sfx === 'function') sfx(k); } catch (e) { /* 소리는 덤이다 */ } }

wire();
reset();
// 다른 쪽과 같은 등장 효과 — 이걸 안 부르면 .reveal 칸이 opacity:0 그대로 남아 화면이 텅 빈다
initReveal();
