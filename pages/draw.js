// draw.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('draw');
// 배포 직후 10분은 옛 common.js 와 짝이 될 수 있어 없으면 열쇠 그대로 둔다.
const NM = k => (typeof heroName === 'function' ? heroName(k) : k);

// 사이트가 실제로 쓰는 색에서 골랐다. 아무 색이나 다 주면 그린 그림이 이 사이트의
// 그림처럼 안 보인다 — 칸이 적을수록 색을 좁혀 주는 편이 결과가 낫다.
// 표 자체는 pixel.js 에 있다 — 첫 화면이 걸린 그림을 그릴 때 같은 표를 읽어야 해서.
const PALETTE = DRAW_PALETTE;
const EMPTY = -1;

const board = $('#board');
const bctx = board.getContext('2d');
bctx.imageSmoothingEnabled = false;

let N = 16;                       // 한 변의 칸 수
let cells = new Array(N * N).fill(EMPTY);
let color = 4;                    // 코랄부터 시작
let history = [];

const CELL = () => board.width / N;

function paintBoard(){
  const c = CELL();
  bctx.fillStyle = '#fffaf2';
  bctx.fillRect(0, 0, board.width, board.height);
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === EMPTY) continue;
    bctx.fillStyle = PALETTE[cells[i]];
    bctx.fillRect((i % N) * c, Math.floor(i / N) * c, c, c);
  }
  // 격자선. 칸이 많아질수록 옅게 — 32칸에서 진하면 그림보다 선이 먼저 보인다.
  bctx.fillStyle = 'rgba(47,42,36,' + (N <= 16 ? 0.16 : N <= 24 ? 0.12 : 0.09) + ')';
  for (let i = 1; i < N; i++) {
    bctx.fillRect(Math.round(i * c), 0, 1, board.height);
    bctx.fillRect(0, Math.round(i * c), board.width, 1);
  }
}

function pushHistory(){
  history.push(cells.slice());
  if (history.length > 40) history.shift();   // 40번이면 충분하고, 그 이상은 메모리만 먹는다
}

function cellAt(e){
  const r = board.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * N);
  const y = Math.floor((e.clientY - r.top) / r.height * N);
  if (x < 0 || y < 0 || x >= N || y >= N) return -1;
  return y * N + x;
}

let painting = false, lastCell = -1;

function put(i){
  if (i < 0 || cells[i] === color) return;
  cells[i] = color;
  paintBoard();
}

board.addEventListener('pointerdown', e => {
  pushHistory();
  painting = true;
  // 손가락이 판 밖으로 나가도 계속 그려지게 붙잡아 둔다.
  // 붙잡기는 실패할 수 있으므로(이미 놓인 포인터 등) 그리기보다 뒤에 둔다 —
  // 앞에 두면 여기서 걸릴 때 한 칸도 안 칠해진다.
  try { board.setPointerCapture(e.pointerId); } catch (err) { /* 이미 놓인 포인터면 실패한다 — 붙잡기는 덤이다 */ }
  lastCell = cellAt(e);
  put(lastCell);
});
board.addEventListener('pointermove', e => {
  if (!painting) return;
  const i = cellAt(e);
  if (i === lastCell) return;      // 같은 칸을 계속 다시 칠하지 않게
  lastCell = i;
  put(i);
});
const stop = () => { painting = false; lastCell = -1; };
board.addEventListener('pointerup', stop);
board.addEventListener('pointercancel', stop);

// ---------- 색 고르기 ----------
function buildSwatches(){
  const wrap = $('#swatches');
  wrap.innerHTML = '';
  PALETTE.forEach((hex, i) => {
    const b = document.createElement('button');
    b.className = 'sw' + (i === color ? ' on' : '');
    b.style.background = hex;
    b.setAttribute('aria-label', '색 ' + (i + 1));
    b.addEventListener('click', () => { color = i; syncSwatches(); });
    wrap.appendChild(b);
  });
}
function syncSwatches(){
  $$('#swatches .sw').forEach((b, i) => b.classList.toggle('on', i === color));
  $('#eraser').classList.toggle('on', color === EMPTY);
}
$('#eraser').addEventListener('click', () => { color = EMPTY; syncSwatches(); });

// ---------- 도구 ----------
$('#undo').addEventListener('click', () => {
  if (!history.length) return;
  cells = history.pop();
  paintBoard();
});
$('#clear').addEventListener('click', () => {
  pushHistory();
  cells = new Array(N * N).fill(EMPTY);
  paintBoard();
});
$$('#sizes button').forEach(b => {
  b.addEventListener('click', () => {
    const n = Number(b.dataset.n);
    if (n === N) return;
    // 칸 수가 바뀌면 옮겨 담을 방법이 마땅치 않다. 지워진다고 미리 말해 두고 확인만 받는다.
    if (cells.some(c => c !== EMPTY) && !confirm('그리던 그림이 지워져요. 칸 수를 바꿀까요?')) return;
    setN(n);
    paintBoard();
  });
});

// ---------- 밑그림 ----------
// 스프라이트 윤곽선을 먹색(0번)으로 깐다. 판보다 크면 들어가는 칸 수로 올린다.
function setN(n){
  N = n; cells = new Array(N * N).fill(EMPTY); history = [];
  $$('#sizes button').forEach(x => x.classList.toggle('on', Number(x.dataset.n) === N));
}
$$('#stencils button').forEach(b => {
  b.addEventListener('click', () => {
    const sp = SPRITES[b.dataset.st];
    if (!sp) return;
    if (cells.some(c => c !== EMPTY) && !confirm('그리던 그림 위에 밑그림을 깔면 지워져요. 계속할까요?')) return;
    const w = sp[0].length, h = sp.length, need = Math.max(w, h) + 2;
    setN([16, 24, 32].find(n => n >= need) || 32);
    const ox = Math.floor((N - w) / 2), oy = Math.floor((N - h) / 2);
    outlineOf(sp).forEach(([x, y]) => { cells[(y + oy) * N + (x + ox)] = 0; });
    paintBoard();
    board.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

// ---------- 첫 화면 액자에 걸기 ----------
$$('[data-hang]').forEach(b => {
  b.addEventListener('click', () => {
    if (!cells.some(c => c !== EMPTY)) { alert('아직 아무것도 안 그렸어요.'); return; }
    try { localStorage.setItem('sy.hang.' + b.dataset.hang, JSON.stringify({ n: N, s: encode(cells) })); }
    catch (e) { alert('저장이 안 됐어요.'); return; }
    if (confirm('걸었어요! 첫 화면에서 볼까요?')) location.href = '/';
  });
});

// ---------- 그림 파일로 저장 ----------
// 격자선 없이, 한 칸을 24px 로 키워 내보낸다. 16칸이면 384px — 폰 배경으로 쓰기에도 충분하다.
function toPNG(list, n){
  const out = document.createElement('canvas');
  const px = 24;
  out.width = out.height = n * px;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#fffaf2';
  g.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < list.length; i++) {
    if (list[i] === EMPTY) continue;
    g.fillStyle = PALETTE[list[i]];
    g.fillRect((i % n) * px, Math.floor(i / n) * px, px, px);
  }
  return out;
}

$('#save').addEventListener('click', () => {
  const a = document.createElement('a');
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
                String(d.getDate()).padStart(2, '0') + '-' +
                String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  a.download = '도트그림-' + stamp + '.png';
  a.href = toPNG(cells, N).toDataURL('image/png');
  a.click();
});

// ---------- 내 그림 (이 브라우저에만) ----------
// 칸 하나를 글자 하나로 적는다. 없는 칸은 '.', 색은 팔레트 번호를 36진수로.
// 32칸이라도 1024자라 localStorage 에 부담이 없다.
const MINE_KEY = 'sy.draw.list';
const MINE_MAX = 12;

const encode = (list) => list.map(c => c === EMPTY ? '.' : c.toString(36)).join('');
const decode = (str) => Array.from(str).map(ch => ch === '.' ? EMPTY : parseInt(ch, 36));

function readMine(){
  try { return JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); } catch (e) { return []; }
}
function writeMine(list){
  try { localStorage.setItem(MINE_KEY, JSON.stringify(list)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
}

$('#keep').addEventListener('click', () => {
  if (!cells.some(c => c !== EMPTY)) { alert('아직 아무것도 안 그렸어요.'); return; }
  const list = readMine();
  list.unshift({ id: Date.now(), n: N, s: encode(cells) });
  writeMine(list.slice(0, MINE_MAX));
  renderMine();
});

function renderMine(){
  const grid = $('#mineGrid');
  const list = readMine();
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = '<p class="empty">아직 담아둔 그림이 없어요.</p>';
    return;
  }
  list.forEach(item => {
    const box = document.createElement('div');
    box.className = 'dot-card mine-item';
    const cv = document.createElement('canvas');
    cv.width = cv.height = item.n;
    const g = cv.getContext('2d');
    const data = decode(item.s);
    g.fillStyle = '#fffaf2'; g.fillRect(0, 0, item.n, item.n);
    for (let i = 0; i < data.length; i++) {
      if (data[i] === EMPTY) continue;
      g.fillStyle = PALETTE[data[i]];
      g.fillRect(i % item.n, Math.floor(i / item.n), 1, 1);
    }
    box.appendChild(cv);

    const row = document.createElement('div');
    row.className = 'row';
    const open = document.createElement('button');
    open.textContent = '이어그리기';
    open.addEventListener('click', () => {
      N = item.n;
      cells = decode(item.s);
      history = [];
      $$('#sizes button').forEach(x => x.classList.toggle('on', Number(x.dataset.n) === N));
      paintBoard();
      board.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '지우기';
    del.addEventListener('click', () => {
      if (!confirm('이 그림을 지울까요?')) return;
      writeMine(readMine().filter(x => x.id !== item.id));
      renderMine();
    });
    row.appendChild(open); row.appendChild(del);
    box.appendChild(row);
    grid.appendChild(box);
  });
}

buildSwatches();
paintBoard();
renderMine();
initReveal();

/* =========================================================================
   오늘의 미션 · 대결 · 이어 그리기
   ========================================================================= */

// ---------- 오늘의 미션 ----------
// 빈 판 앞에서 「뭘 그리지」 로 끝나는 일이 많다. 날짜로 하나 골라 준다 —
// 자매 둘이 같은 날 같은 과제를 받아야 대결이 성립한다.
const MISSIONS = [
  '색 세 가지만 써서 그리기',
  '동그라미를 쓰지 않고 그리기',
  '오늘 먹은 것 그리기',
  '창밖에 보이는 것 그리기',
  '가장 좋아하는 동물 그리기',
  '내 방에 있는 것 하나 그리기',
  '노란색을 꼭 넣어서 그리기',
  '얼굴만 크게 그리기',
  '밤에 보이는 것 그리기',
  '물속에 사는 것 그리기',
  '내 신발 그리기',
  '하늘을 나는 것 그리기',
  '가족 중 한 명 그리기',
  '가장 무서운 것 그리기',
  '이름이 세 글자인 것 그리기',
  '바퀴가 달린 것 그리기',
  '달콤한 것 그리기',
  '내일 하고 싶은 일 그리기',
  '초록색만 써서 그리기',
  '움직이는 것 그리기',
  '아주 작은 것을 크게 그리기',
  '소리가 나는 것 그리기',
  '겨울에 어울리는 것 그리기',
  '내가 키우고 싶은 동물 그리기',
  '학교에 있는 것 그리기',
  '동생(언니)에게 주고 싶은 선물 그리기',
  '반만 그리고 반은 상상하게 두기',
  '글자를 하나 그려 넣기',
  '눈이 세 개인 무언가 그리기',
  '내가 만든 새로운 과일 그리기',
];
const TODAY = (() => { const d = new Date(); const p = n => String(n).padStart(2,'0');
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()); })();
const DAY_SEED = Number(TODAY.replace(/-/g, ''));
const MISSION = MISSIONS[DAY_SEED % MISSIONS.length];
$('#missionText').textContent = MISSION;

// 오늘 미션을 해냈는지는 이 기기에 적어 둔다. 출석 도장과 같은 방식.
const MISSION_KEY = 'sy.mission.' + TODAY;
function markMissionDone(){
  try { localStorage.setItem(MISSION_KEY, '1'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  $('#missionDone').hidden = false;
}
try { if (localStorage.getItem(MISSION_KEY) === '1') $('#missionDone').hidden = false; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

// ---------- 서버에 남기는 그림 ----------
// 여기서부터는 로그인해야 한다. 남는 그림이라 누가 그렸는지가 있어야 하고,
// 정책도 author 를 제 이름으로만 적게 막아 두었다.
let myKey = null;                    // '수아' | '연아' | '부모'

async function syncShareTools(){
  await refreshAuth();
  myKey = me && me.author_key ? me.author_key : null;
  const on = !!myKey;
  $('#shareTools').hidden = !on;
  $('#shareHint').hidden = on;
  if (on) $('#shareWho').textContent = myKey + ' 이름으로 올라가요';
  loadDuel();
  loadRelays();
  renderPend();
  flushQueue(false);          // 지난번에 담아 둔 것이 있으면 지금 올린다
}

function drawnSomething(){ return cells.some(c => c !== EMPTY); }

// ---------- 끊겨도 되는 그리기 ----------
// 그림 한 장은 글자 몇백 자다. 인터넷이 없으면 이 기기에 담아 두었다가
// 신호가 돌아올 때 올린다. 다 그려 놓고 「올리지 못했어요」로 끝나지 않게.
const DRAW_QUEUE_KEY = 'sy.drawQueue';
const DRAW_QUEUE_MAX = 20;

function queued(){
  try { return JSON.parse(localStorage.getItem(DRAW_QUEUE_KEY) || '[]'); }
  catch (e) { return []; }
}
function setQueued(list){
  try { localStorage.setItem(DRAW_QUEUE_KEY, JSON.stringify(list)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  renderPend();
}
function renderPend(){
  const box = $('#drawPend'), n = queued().length;
  if (!box) return;
  box.hidden = !n;
  if (!n) return;
  box.innerHTML = '📦 아직 못 올린 그림 ' + n + '장 — 인터넷이 돌아오면 저절로 올라가요 ' +
    '<button type="button" class="dot-btn small" id="pendGo">지금 올리기</button>';
  $('#pendGo').addEventListener('click', () => flushQueue(true));
}

// 못 닿아서 실패한 것인지, 규칙에 걸려 거절당한 것인지 가른다.
// 거절당한 것을 담아 두면 영영 안 올라가는 짐이 된다.
function looksOffline(error){
  if (!navigator.onLine) return true;
  const m = ((error && error.message) || '') + '';
  return !!(error && error.offline) || /fetch|network|failed to fetch|load failed/i.test(m);
}

let flushing = false;
async function flushQueue(loud){
  const list = queued();
  if (flushing || !list.length) return;
  if (!myKey) return;                       // 로그인해야 올라간다 — 정책이 이름을 본다
  flushing = true;
  let sent = 0;
  try {
    while (list.length) {
      const { error } = await sb.from('doodles').insert(list[0]);
      if (error) {
        if (looksOffline(error)) break;     // 아직 안 닿는다 — 담아 둔 채로 둔다
        list.shift();                       // 거절당한 것은 버린다
        continue;
      }
      list.shift(); sent++;
    }
  } finally {
    flushing = false;
    setQueued(list);
  }
  if (sent) {
    sfx('fanfare');
    loadDuel(); loadRelays();
    if (loud) alert('담아 뒀던 그림 ' + sent + '장을 올렸어요!');
  } else if (loud) {
    alert('아직 인터넷에 닿지 않아요. 그림은 그대로 담겨 있어요.');
  }
}

window.addEventListener('online', () => flushQueue(false));

async function putDoodle(kind, relayOf){
  if (!myKey) { alert('로그인하면 쓸 수 있어요.'); return false; }
  if (!drawnSomething()) { alert('아직 아무것도 안 그렸어요.'); return false; }
  const row = { author: myKey, kind, n: N, cells: encode(cells), theme: MISSION };
  if (relayOf) row.relay_of = relayOf;
  const { error } = await sb.from('doodles').insert(row);
  if (error) {
    if (!looksOffline(error)) { alert('올리지 못했어요: ' + error.message); return false; }
    // 오래 끊겨 있으면 한없이 쌓인다. localStorage 는 한도가 있어서 어느 순간
    // 통째로 저장이 실패한다. 스무 장까지만 담고 그 뒤로는 솔직히 말한다.
    const q = queued();
    if (q.length >= DRAW_QUEUE_MAX) {
      alert('담아 둘 자리가 다 찼어요(' + DRAW_QUEUE_MAX + '장). 인터넷이 돌아온 뒤에 다시 내 주세요.');
      return false;
    }
    setQueued(q.concat([row]));
    markMissionDone();
    alert('인터넷이 없어서 이 그림을 기기에 담아 뒀어요. 연결되면 저절로 올라가요.');
    return false;                            // 아직 서버에 없으니 목록은 안 건드린다
  }
  sfx('fanfare');
  markMissionDone();
  return true;
}

// 이어받아 그리는 중이면 어느 그림에서 왔는지 기억해 둔다
let continuing = null;

$('#toDuel').addEventListener('click', async () => {
  if (await putDoodle('duel', null)) { alert('대결에 냈어요!'); loadDuel(); }
});
// 그린 것을 포트폴리오에 낸다. 일기와 같은 결로 — 아이는 「기다리는 중」으로 내고
// 부모가 전시실에 올린다. 그림은 PNG 로 구워 저장소의 doodle 칸에 넣는다.
$('#toWork').addEventListener('click', async () => {
  if (!myKey){ alert('로그인하면 낼 수 있어요.'); return; }
  if (!drawnSomething()){ alert('아직 아무것도 안 그렸어요.'); return; }
  const 제목 = (prompt('작품 이름을 지어 주세요', '도트 그림') || '').trim();
  if (!제목) return;
  const 한마디 = (prompt('한 마디 남길래요? (안 써도 돼요)', '') || '').trim();

  const btn = $('#toWork');
  btn.disabled = true; btn.textContent = '내는 중…';
  try {
    const blob = await new Promise(r => toPNG(cells, N).toBlob(r, 'image/png'));
    if (!blob) throw new Error('그림을 만들지 못했어요');
    const 이름 = 'suayona/doodle/' + Date.now() + '-' +
                Math.random().toString(36).slice(2, 8) + '.png';
    const up = await sb.storage.from('event-images')
      .upload(이름, blob, { contentType: 'image/png', upsert: false });
    if (up.error) throw up.error;
    const { data: pub } = sb.storage.from('event-images').getPublicUrl(이름);

    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('works').insert({
      title: 제목,
      quote: 한마디 || null,
      author: myKey,
      media_type: 'image',
      media_url: pub.publicUrl,
      made_on: new Date().toISOString().slice(0, 10),
      status: 'pending',
      written_by: user.id,
    });
    if (error) throw error;
    alert('냈어요! 부모님이 보고 전시실에 올려 주면 포트폴리오에 걸려요.');
  } catch (e) {
    alert('내지 못했어요: ' + (typeof readableError === 'function' ? readableError(e) : (e.message || e)));
  } finally {
    btn.disabled = false; btn.textContent = '🖼 작품으로 내기';
  }
});

$('#toRelay').addEventListener('click', async () => {
  const from = continuing;
  if (await putDoodle('relay', from)) {
    continuing = null;
    alert(from ? '이어 그린 그림을 올렸어요!' : '이어 그릴 그림으로 내놓았어요!');
    loadRelays();
  }
});

// ---------- 작은 그림 그리기 ----------
function doodleCanvas(row, px){
  const cv = document.createElement('canvas');
  const n = row.n;
  cv.width = cv.height = n * (px || 6);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#fffaf2'; g.fillRect(0, 0, cv.width, cv.height);
  const list = decode(row.cells), s = (px || 6);
  for (let i = 0; i < list.length; i++) {
    if (list[i] === EMPTY) continue;
    g.fillStyle = PALETTE[list[i]];
    g.fillRect((i % n) * s, Math.floor(i / n) * s, s, s);
  }
  return cv;
}

// ---------- 오늘의 대결 ----------
async function loadDuel(){
  const { data } = await sb.from('doodles')
    .select('id, author, n, cells, theme, created_at')
    .eq('kind', 'duel').eq('made_on', TODAY)
    .order('created_at', { ascending: true });
  const box = $('#duelBox'), grid = $('#duelGrid');
  if (!data || !data.length) { box.hidden = true; return; }
  box.hidden = false;
  $('#duelTheme').textContent = '주제 — ' + (data[0].theme || MISSION);
  grid.innerHTML = '';
  // 한 사람이 여러 번 냈으면 마지막 것만 건다
  const last = new Map();
  data.forEach(r => last.set(r.author, r));
  [...last.values()].forEach(r => {
    const cell = document.createElement('div');
    cell.className = 'duel-cell';
    cell.appendChild(doodleCanvas(r, 6));
    const who = document.createElement('span');
    who.className = 'who pixel'; who.textContent = NM(r.author);
    cell.appendChild(who);
    grid.appendChild(cell);
  });
}

// ---------- 이어 그리기 ----------
async function loadRelays(){
  // 내가 내놓은 것 말고, 아직 내가 이어 그리지 않은 것만 보여 준다.
  const { data } = await sb.from('doodles')
    .select('id, author, n, cells, relay_of, created_at')
    .eq('kind', 'relay')
    .order('created_at', { ascending: false }).limit(12);
  const box = $('#relayBox'), grid = $('#relayGrid');
  if (!data || !data.length) { box.hidden = true; return; }
  // 이미 누가 이어 그린 그림은 목록에서 뺀다 — 이어 그린 쪽이 새 줄이 되므로
  const continued = new Set(data.map(r => r.relay_of).filter(Boolean));
  const open = data.filter(r => !continued.has(r.id) && r.author !== myKey);
  if (!open.length) { box.hidden = true; return; }
  box.hidden = false;
  grid.innerHTML = '';
  open.forEach(r => {
    const cell = document.createElement('div');
    cell.className = 'duel-cell pick';
    cell.appendChild(doodleCanvas(r, 6));
    const who = document.createElement('span');
    who.className = 'who pixel'; who.textContent = NM(r.author) + ' › 이어 그리기';
    cell.appendChild(who);
    cell.addEventListener('click', () => {
      if (drawnSomething() && !confirm('그리던 그림이 지워져요. 이어 그릴까요?')) return;
      setN(r.n);
      cells = decode(r.cells);
      continuing = r.id;
      paintBoard();
      sfx('pop');
      board.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    grid.appendChild(cell);
  });
}

syncShareTools();
