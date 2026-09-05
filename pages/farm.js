// farm.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('farm');

// 규칙은 farm-rules.js 에 있다. 여기는 그림과 순서만.
const R = FARM;
let S = 3;                                     // 지도 한 픽셀 = 화면 몇 픽셀 — fitPixelCanvas 가 정한다
const T = 32;                                  // 한 칸 = 32도트. 예전에는 16이었다 — 자리가 두 배가 되어 결을 넣을 수 있다.
const COLS = R.GRID.w, ROWS = R.GRID.h;   // 지도 크기는 규칙이 정한다
const NAME = R.NAME;

let key = null, W = null, M = null, REV = 0, TUNE = R.fixTune(null), other = null, facts = {};
let Mbase = null;                              // 마지막으로 서버에 올라간 내 줄 — 겹쳤을 때 여기서 다시 한다
let pending = [];                              // 아직 안 올라간 행동들
let tool = 'hand', seed = null, tab = 'bag', shopTab = 'seed', room = 'living', furnPick = null;
let furnRot = 0, rotMode = false;      // 가구를 놓을 각도 · 놓인 것을 돌리는 중인가
// 끌어 옮기는 중인 가구. 누른 채 끌면 여기 담기고, 손을 떼면 그 칸으로 옮긴다.
let grab = null, grabClick = false;
// 재배치 중일 때만 가구를 들거나 놓을 수 있다. 구경하다 잘못 눌러 가구가 가방으로 들어가곤 했다.
let arrange = false;
const now = () => Date.now();

// ---------- 저장 ----------
// 행동은 전부 act() 를 지난다. 서버가 -1(다른 아이가 먼저 씀)을 주면 새 농장 위에 같은 행동을 다시 한다.
let saveTimer = 0, saving = false, dirty = false;
function persist(){ clearTimeout(saveTimer); saveTimer = setTimeout(commit, 600); }
async function commit(){
  if (!key || saving) return;
  saving = true; dirty = false;
  try {
    for (let tries = 0; tries < 3; tries++){
      const { data, error } = await sb.rpc('farm_commit', { p_world: W, p_rev: REV, p_mine: M });
      if (error){
        // 인터넷이 끊긴 것이면 행동은 그대로 두고 조금 뒤에 다시 올린다. 돌아오면 저절로.
        const off = !navigator.onLine || error.offline || /fetch|network|load failed/i.test(error.message || '');
        flash(off ? '지금은 인터넷에 닿지 않아요. 한 일은 기억해 두었다가 연결되면 올려요' : '저장하지 못했어요: ' + readableError(error), true);
        if (off){ clearTimeout(saveTimer); saveTimer = setTimeout(commit, 15000); }
        break;
      }
      if (data >= 0){ REV = data; Mbase = clone(M); pending = []; break; }
      // 겹쳤다 — 다시 읽고, 못 올라간 행동을 새 농장 위에서 다시.
      const fresh = await loadRows();
      if (!fresh) break;
      const redo = pending.slice(); pending = [];
      M = clone(Mbase);
      let dropped = 0;
      redo.forEach(fn => { try { const r = fn(W, M); if (r && r.ok) pending.push(fn); else dropped++; } catch (e) { dropped++; } });
      if (dropped) flash(NAME[R.OTHER[key]] + '가 먼저 움직여서 ' + dropped + '가지는 되돌렸어요', true);
      renderAll();
    }
  } finally { saving = false; if (dirty) persist(); }
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
document.addEventListener('visibilitychange', () => { if (document.hidden && (saveTimer || dirty)){ clearTimeout(saveTimer); commit(); } });
window.addEventListener('online', () => { if (pending.length){ clearTimeout(saveTimer); commit(); } });

function act(fn, quiet){
  const r = fn(W, M);
  if (!quiet) flash(r.msg, !r.ok);
  if (r.ok){ pending.push(fn); dirty = true; persist(); renderAll(); }
  return r;
}
function flash(html, bad){ const el = $('#fmsg'); el.innerHTML = html || ''; el.classList.toggle('bad', !!bad); }

// ---------- 시작 ----------
async function loadRows(){
  const { data, error } = await sb.from('farm_saves').select('who, data, rev');
  if (error){ flash('서버에 닿지 않아요: ' + readableError(error), true); return false; }
  const rows = data || [];
  const farm = rows.find(r => r.who === 'farm');
  W = R.fixWorld(farm ? farm.data : null, now()); REV = farm ? farm.rev : 0;
  const t = rows.find(r => r.who === 'tune'); TUNE = R.fixTune(t ? t.data : null);
  W.seasonLen = TUNE.seasonLen;
  const mine = rows.find(r => r.who === key);
  if (!Mbase){ M = R.fixMine(mine ? mine.data : null, key); Mbase = clone(M); }
  const o = rows.find(r => r.who === R.OTHER[key]); other = o ? R.fixMine(o.data, R.OTHER[key]) : null;
  return true;
}
async function boot(){
  try { await bootInner(); }
  catch (e) {
    $('#gate').hidden = false;
    $('#gateWho').textContent = '지금은 서버에 닿지 않아요. 신호가 돌아오면 다시 열어 주세요.';
    initReveal();
  }
}
async function bootInner(){
  // supabase 스크립트가 안 내려온 채(전파 없음·차단) 손님 화면을 그리면 「아직 시작 전」처럼 보여서 속는다.
  if (sb.offline) throw new Error('offline');
  await refreshAuth();
  key = isChild && me && R.NAME[me.author_key] ? me.author_key : null;
  if (!key){
    // 손님·부모 — 요약만 주는 함수를 부른다. 가족이면 표를 직접 읽어 조금 더 보여 준다.
    const { data } = await sb.rpc('farm_cards');
    renderGate(data || {});
    await renderPeekArt();
    if (isAdmin) await renderTune();
    $('#gate').hidden = false;
    initReveal();
    return;
  }
  if (!(await loadRows())) throw new Error('load');
  const fr = await sb.rpc('quest_facts', { p_who: key });
  facts = fr.data || {};
  // 하루 시작 — 계절·동물·비·까마귀·기운·비료·선물. 전부 하루 한 번만 되게 짜여 있어서,
  // 다른 아이와 겹쳐 다시 하게 되어도 두 번 받지 않는다.
  const r = daily(W, M);
  tickAll();
  if (r.ok){ pending.push(daily); dirty = true; persist(); }
  $('#game').hidden = false;
  $('#lead').textContent = NAME[key] + '의 농장 — ' + NAME[R.OTHER[key]] + '와 함께 가꿔요';
  $('#lead').hidden = false;
  wireUI();
  renderAll();
  initReveal();
  setInterval(() => { tickAll(); syncTop(); }, 30000);   // 그림은 움직이는 루프가 그린다
  startLoop($('#farmCanvas'));
}
function daily(w, m){
  const today = R.dayKey(now());
  let changed = false;
  if (w.dayKey !== today){
    w.dayKey = today;
    const notes = R.newDay(w, m, now());
    if (notes.length) notice(notes.join(' · '));
    changed = true;
  }
  if (R.refreshEnergy(w, m, now())) changed = true;
  const fert = R.fertFromDiaries(m, facts.diaries || 0);
  if (fert) { notice('일기 덕분에 비료 ' + fert + '개가 생겼어요'); changed = true; }
  const g = R.claimParentGift(m, TUNE);
  if (g){ notice('부모님이 ' + g.coins + ' 동전을 보냈어요' + (g.note ? ' — "' + escapeHTML(g.note) + '"' : '')); changed = true; }
  if (m.lastPlay !== today){ R.markPlayed(m, now()); changed = true; }
  return { ok: changed };
}
function notice(html){ const n = $('#notice'); n.hidden = false; n.innerHTML = html; }
function tickAll(){ Object.keys(W.plots).forEach(id => R.tickPlot(W.plots[id], now(), id[0] === 'g')); }

// ---------- 손님 화면 ----------
function renderGate(c){
  const cal = c.started ? R.calendar({ started: c.started, seasonLen: c.seasonLen }, now()) : null;
  const peek = $('#peek');
  peek.innerHTML = [
    ['계절', cal ? R.SEASON_ICON[cal.season] + ' ' + R.SEASON_NAME[cal.season] + ' ' + cal.year + '년째' : '아직 시작 전'],
    ['자라는 작물', (c.crops || 0) + '개'],
    ['동물', (c.animals || 0) + '마리'],
    ['지은 것', ((c.buildings || []).length + (c.decor || []).length) + '개'],
  ].map(x => '<div>' + x[0] + '<b>' + x[1] + '</b></div>').join('');
  const box = $('#heroes'); box.innerHTML = '';
  ['sua', 'yona'].forEach(k => {
    const s = c[k];
    const card = document.createElement('div'); card.className = 'dot-card hero-card';
    const cv = document.createElement('canvas'); cv.width = 42; cv.height = 40;
    cv.getContext('2d').imageSmoothingEnabled = false;
    drawSprite(cv.getContext('2d'), SPRITES[k], 0, 0, 1);
    card.appendChild(cv);
    const d = document.createElement('div');
    d.innerHTML = '<div class="nm">' + NAME[k] + '</div><div class="lv">' + (s ? '농장 레벨 ' + R.levelOf(s.lv) + ' · 도감 ' + s.dex + '칸' : '아직 농장에 오지 않았어요') + '</div>';
    card.appendChild(d); box.appendChild(card);
  });
  // 로그인한 어른에게는 「로그인하면 열려요」도 그 설명도 필요 없다 — 줄바꿈까지 함께 감춘다
  if (isLoggedIn) $('#gateWho').hidden = true;
}
// 손님에게 보여 줄 그림 — 농장 한 장과 집 안 세 칸. 우편·일지는 빼고 받는다.
async function renderPeekArt(){
  const { data, error } = await sb.rpc('farm_peek');
  if (error || !data) return;                    // 아직 농장이 없으면 그림도 없다
  W = R.fixWorld(data, now());
  M = R.fixMine(null, 'sua');                    // 나무·바위 차례는 아이마다 달라서, 손님에겐 그냥 서 있는 모습으로
  tickAll();
  $('#peekArt').hidden = false;
  startLoop($('#peekFarm'));
  [['living', '#peekLiving'], ['sua', '#peekSua'], ['yona', '#peekYona']].forEach(([r, sel]) => {
    drawRoom($(sel), r);                         // 크기는 방 그림이 스스로 맞춘다
  });
}
async function renderTune(){
  const card = $('#tuneCard'); card.hidden = false;
  const { data } = await sb.from('farm_saves').select('who, data').eq('who', 'tune');
  TUNE = R.fixTune(data && data[0] ? data[0].data : null);
  $('#tLen').value = TUNE.seasonLen; $('#tLenV').textContent = TUNE.seasonLen + '일';
  $('#tLen').addEventListener('input', () => { $('#tLenV').textContent = $('#tLen').value + '일'; });
  $('#tSave').addEventListener('click', async () => {
    const t = clone(TUNE); t.seasonLen = Number($('#tLen').value);
    const coins = Number($('#tGiftCoins').value) || 0;
    if (coins > 0){ t.gift = t.gift || {}; t.gift[$('#tGiftWho').value] = { id: 'g' + Date.now(), coins: Math.min(1000, coins), note: $('#tGiftNote').value.trim() }; }
    const { data: rows, error } = await sb.from('farm_saves').upsert({ who: 'tune', data: t }, { onConflict: 'who' }).select('who');
    $('#tMsg').textContent = error ? '저장하지 못했어요: ' + readableError(error) : (!rows || !rows.length) ? '저장되지 않았어요. 부모로 로그인했는지 확인해 주세요.' : '저장했어요' + (coins > 0 ? ' · 선물은 다음에 열 때 받아요' : '');
    if (!error && rows && rows.length){ TUNE = t; $('#tGiftCoins').value = ''; $('#tGiftNote').value = ''; }   // 같은 봉투를 또 만들지 않게 칸을 비운다
  });
  await renderUndo();
  $('#tReset').addEventListener('click', async () => {
    if (!confirm('농장과 두 아이의 가방을 모두 지울까요? 되돌릴 수 없어요.')) return;
    if (!confirm('정말요? 지은 건물과 가구도 다 사라져요.')) return;
    const { data: rows, error } = await sb.from('farm_saves').delete().in('who', ['farm', 'sua', 'yona']).select('who');
    $('#tMsg').textContent = error ? '지우지 못했어요: ' + readableError(error) : '지웠어요 (' + ((rows || []).length) + '줄)';
  });
}

// 되돌릴 것이 있는지 물어보고 단추를 켠다. 세이브 알맹이는 받지 않는다 —
// farm_restore_info 는 「누구 것이 언제 것인지」만 준다.
async function renderUndo(){
  const box = $('#tUndo'), btn = $('#tUndoBtn'), when = $('#tUndoWhen');
  if (!box) return;
  const { data, error } = await sb.rpc('farm_restore_info');
  if (error) return;                                   // 옛 서버면 그냥 안 보여 준다
  box.hidden = false;
  const 밭 = (data || []).find(r => r.who === 'farm');
  const 있음 = !!(밭 && 밭.has_prev);
  btn.disabled = !있음;
  when.textContent = 있음
    ? formatDate(밭.prev_day) + ' 아침 것이 있어요'
    : '되돌릴 것이 아직 없어요';
  btn.addEventListener('click', async () => {
    if (!confirm('농장을 그날 아침으로 되돌릴까요? 그 뒤에 심고 판 것은 사라져요.')) return;
    btn.disabled = true;
    $('#tMsg').textContent = '되돌리는 중…';
    const { data: ok, error: err } = await sb.rpc('farm_restore');
    if (err){ btn.disabled = false; $('#tMsg').textContent = '안 됐어요: ' + readableError(err); return; }
    $('#tMsg').textContent = ok
      ? '되돌렸어요. 아이가 다시 열면 그날 아침 농장이에요.'
      : '되돌릴 것이 없었어요.';
  });
}

// ---------- 위쪽 띠 ----------
function syncTop(){
  const cal = R.calendar(W, now()), wk = R.weatherOf(R.dayKey(now()), cal.season);
  // 때는 농장 그림과 같은 시계를 본다 — 화면이 어두운데 「낮」이라고 적히면 어긋난다
  const L = dayLight(), h = L.hour;
  const when = h < 5 ? '한밤' : h < 7 ? '새벽' : h < 11 ? '아침' : h < 16 ? '낮' : h < 18.5 ? '해질참' : h < 20.5 ? '저녁' : '밤';
  const night = L.dark > 0.16;
  $('#cSeason').textContent = R.SEASON_ICON[cal.season] + ' ' + R.SEASON_NAME[cal.season] + ' ' + cal.dayOfSeason + '/' + cal.len + '일 · ' + cal.year + '년째';
  const cw = $('#cWeather'); cw.textContent = R.WEATHER[wk].icon + ' ' + R.WEATHER[wk].name + ' · ' + when + (cal.lastDay ? ' · 축제!' : '');
  cw.classList.toggle('night', night);
  const mx = R.maxEnergy(W, M);
  $('#enFill').style.width = Math.round(100 * M.energy / mx) + '%'; $('#enText').textContent = M.energy + '/' + mx;
  $('#coins').textContent = M.coins;
  const lv = R.levelOf(M.xp), a = R.xpForLevel(lv), b = R.xpForLevel(lv + 1);
  $('#lv').textContent = lv; $('#xpFill').style.width = Math.round(100 * (M.xp - a) / (b - a)) + '%';
  const n = (W.mail[key] || []).length; $('#mailN').hidden = !n; $('#mailN').textContent = n;
  const waiting = duoWaiting(); $('#duoN').hidden = !waiting; $('#duoN').textContent = waiting;
}
// 둘이서 탭에 「내 차례」가 몇 개인지 — 자매가 낸 건물, 잡아당길 큰 작물, 쓰다듬을 동물.
function duoWaiting(){
  let n = 0;
  Object.keys(R.BUILDINGS).forEach(b => { const s = R.buildState(W, b); if (!s.done && s[R.OTHER[key]] && !s[key]) n++; });
  Object.keys(W.plots).forEach(id => { const p = W.plots[id]; if (p.giant && p.pulls && p.pulls.indexOf(R.OTHER[key]) >= 0 && p.pulls.indexOf(key) < 0) n++; });
  (W.animals || []).forEach(a => { if (a.petDay === R.dayKey(now()) && (a.pet || []).indexOf(R.OTHER[key]) >= 0 && a.pet.indexOf(key) < 0) n++; });
  return n;
}

// ---------- 도구 ----------
const TOOLS = [
  { id: 'hand', icon: '👋', name: '손',        sub: '거두기 · 줍기 · 열기' },
  { id: 'hoe',  icon: '⛏️', name: '괭이',      sub: () => '한 번에 ' + R.toolN(M, 'hoe') + '칸' },
  { id: 'can',  icon: '💧', name: '물뿌리개',  sub: () => '한 번에 ' + R.toolN(M, 'can') + '칸' },
  { id: 'seed', icon: '🌱', name: '씨앗',      sub: () => seed ? R.CROPS[seed].name : '골라요' },
  { id: 'fert', icon: '🧪', name: '비료',      sub: () => (M.inv.fert || 0) + '개' },
  { id: 'pull', icon: '🪴', name: '뽑기',      sub: '시든 것 · 그만 키우기' },
  { id: 'sprk', icon: '⛲', name: '스프링클러', sub: () => (M.inv.sprinkler || 0) + '개',
    when: () => (M.inv.sprinkler || 0) > 0 || Object.keys(W.sprinklers || {}).length > 0 },
];
function renderTools(){
  const box = $('#tools'); box.innerHTML = '';
  TOOLS.forEach(t => {
    if (t.when && !t.when()){ if (tool === t.id) tool = 'hand'; return; }
    const b = document.createElement('button'); b.type = 'button';
    b.className = tool === t.id ? 'on' : '';
    b.innerHTML = t.icon + ' ' + t.name + '<small>' + (typeof t.sub === 'function' ? t.sub() : t.sub) + '</small>';
    b.addEventListener('click', () => { tool = t.id; sfx('prop'); renderTools(); });
    box.appendChild(b);
  });
  const sr = $('#seedRow'); sr.hidden = tool !== 'seed';
  if (tool === 'seed'){
    sr.innerHTML = '';
    const have = Object.keys(M.inv).filter(k => k.startsWith('seed:') && M.inv[k] > 0);
    if (!have.length){ sr.innerHTML = '<span class="none">씨앗이 없어요. 가게에서 사거나 자매에게 받아요.</span>'; seed = null; }
    if (seed && have.indexOf('seed:' + seed) < 0) seed = have.length ? have[0].slice(5) : null;
    if (!seed && have.length) seed = have[0].slice(5);
    have.forEach(k => {
      const c = k.slice(5), b = document.createElement('button'); b.type = 'button';
      b.className = seed === c ? 'on' : '';
      const cv = cropIcon(c); b.appendChild(cv);
      b.appendChild(document.createTextNode(R.CROPS[c].name + ' ' + M.inv[k]));
      b.addEventListener('click', () => { seed = c; renderTools(); });
      sr.appendChild(b);
    });
  }
  $('#fhint').textContent = hintFor();
}
function hintFor(){
  const cal = R.calendar(W, now());
  if (tool === 'hoe') return '밭의 풀밭을 눌러 땅을 갈아요. 기운 1.';
  if (tool === 'can') return '갈아 둔 땅을 눌러 물을 줘요. 스무 시간 촉촉해요. 비 오는 날은 안 줘도 돼요.';
  if (tool === 'seed') return seed ? R.CROPS[seed].name + ' — ' + R.CROPS[seed].hours + '시간이면 자라요. ' + (R.CROPS[seed].season.indexOf(cal.season) >= 0 || R.CROPS[seed].hardy ? '지금 심을 수 있어요.' : '지금은 ' + R.SEASON_NAME[cal.season] + '이라 밭에서는 안 자라요(온실은 돼요).') : '';
  if (tool === 'fert') return '비료는 일기를 쓰면 하나씩 생겨요. 1.5배 빨리 자라요.';
  if (tool === 'pull') return '시든 작물이나 그만 키울 작물을 뽑아요. 큰 작물은 짝도 같이 뽑혀요.';
  if (tool === 'sprk') return '밭의 빈 칸을 눌러 놓아요. 아침마다 둘레 네 칸에 물을 줘요. 놓은 칸을 다시 누르면 걷어요.';
  return '다 자란 작물·나무·바위·동물·집·우편함·게시판·가게를 눌러요.';
}

// ---------- 지도 ----------
// 어디에 무엇이 있는지는 규칙(R.PLACE + world.layout)이 안다.
// 화면은 자리를 받아 그리기만 한다 — 그래야 아이들이 옮겨도 그림과 누르기가 어긋나지 않는다.
function spot(id){ return R.spotOf(W, id); }
function here(id){ return R.thingHere(W, id); }
function inSpot(id, tx, ty){ const b = spot(id); return here(id) && b && tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; }
function inBox(b, tx, ty){ return b && tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; }

// ---------- 그리기 바탕 ----------
let ctx = null;
function pxMap(x, y, w, h, c){
  // 자리와 크기를 따로 반올림하면 이웃한 네모 사이에 틈이 생기거나 겹친다.
  // 양쪽 가장자리를 각각 반올림해 두면 배수가 1.5배 같은 값이어도 딱 맞물린다.
  const x0 = Math.round(x * S), y0 = Math.round(y * S);
  ctx.fillStyle = c;
  ctx.fillRect(x0, y0, Math.max(1, Math.round((x + w) * S) - x0), Math.max(1, Math.round((y + h) * S) - y0));
}
const px = (x, y, w, h, c) => pxMap(x, y, w, h, c);
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
// 문자 한 개 = 도트 한 개. 팔레트를 갈아 끼워 같은 그림을 수아·연아 색으로 쓴다.
function drawArt(g, artRows, X, Y, s, pal, flip){
  const w = artRows[0].length;
  for (let r = 0; r < artRows.length; r++){
    const line = artRows[r];
    for (let c = 0; c < line.length; c++){
      const ch = line[c]; if (ch === '.') continue;
      const col = pal[ch]; if (!col) continue;
      const cc = flip ? w - 1 - c : c;
      const x0 = Math.round(X + cc * s), y0 = Math.round(Y + r * s);
      g.fillStyle = col;
      g.fillRect(x0, y0, Math.max(1, Math.round(X + (cc + 1) * s) - x0), Math.max(1, Math.round(Y + (r + 1) * s) - y0));
    }
  }
}
// 지도 좌표(도트)로 그린다
function art(rows, mx, my, pal, flip){ drawArt(ctx, rows, mx * S, my * S, S, pal, flip); }
// 캔버스가 그림 크기의 몇 배인지. 아직 화면에 안 붙어 크기가 엉뚱하면 기본 배수로 맞춘다.
function pixScale(cv, artW, artH, fallback){
  const k = cv.width / artW;
  if (k >= 0.6 && k <= 8 && Math.abs(cv.height / artH - k) < 0.02) return k;
  cv.width = Math.round(artW * fallback); cv.height = Math.round(artH * fallback);
  return fallback;
}

// ---------- 테두리 두른 그림 ----------
// 사람과 짐승은 풀밭과 색이 비슷해 자꾸 묻힌다. 실루엣을 한 도트 어둡게 두르면
// 어느 배경 위에서도 형태가 또렷하게 갈린다.
// 다만 매 장마다 다섯 번 그리면 네모 수가 다섯 배가 되므로,
// 한 번 그려 작은 캔버스에 담아 두고 그 다음부터는 갖다 붙이기만 한다.
const spriteBuf = {};
const OUT_DIRS = [[-1, 0], [1, 0], [0, 1]];        // 위는 두르지 않는다 — 머리가 부어 보인다
function outlined(id, rows, pal, flip, s){
  const k = id + '|' + s + (flip ? '|f' : '');
  let c = spriteBuf[k];
  if (c) return c;
  const w = rows[0].length, h = rows.length;
  c = document.createElement('canvas');
  c.width = (w + 2) * s; c.height = (h + 1) * s;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  // 테두리는 불투명한 선이 아니라 비치는 그늘이다. 진하게 두르면 머리가 부어 보이고
  // 스티커를 붙인 것처럼 뜬다 — 0.4 정도면 형태만 갈라 주고 굵기는 눈에 안 띈다.
  // 세 방향을 반투명한 색으로 그대로 겹치면 겹친 자리만 두 배로 진해지므로,
  // 먼저 불투명한 실루엣을 하나 만들고 그것을 통째로 옅게 얹는다.
  const sil = {}; for (const key in pal) sil[key] = '#26201a';
  const tmp = document.createElement('canvas'); tmp.width = c.width; tmp.height = c.height;
  const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
  for (let i = 0; i < OUT_DIRS.length; i++) drawArt(tg, rows, (1 + OUT_DIRS[i][0]) * s, OUT_DIRS[i][1] * s, s, sil, flip);
  g.globalAlpha = 0.4; g.drawImage(tmp, 0, 0); g.globalAlpha = 1;
  drawArt(g, rows, s, 0, s, pal, flip);
  spriteBuf[k] = c;
  return c;
}
// 지도 좌표(도트)로, 테두리째 붙인다. k 는 크기 배수 — 새끼는 3분의 2로 그린다.
function artOut(id, rows, mx, my, pal, flip, k){
  k = k || 1;
  ctx.drawImage(outlined(id + (k === 1 ? '' : '@' + k), rows, pal, flip, S * k), Math.round((mx - 1) * S), Math.round(my * S));
}
// 발밑 그림자 — 한 단이 아니라 가운데가 진한 세 단이면 바닥에 붙어 보인다
function footShade(cx, y, w){
  px(cx - w / 2 + 2, y - 2, w - 4, 2, '#00000016');
  px(cx - w / 2, y, w, 2, '#00000024');
  px(cx - w / 2 + 4, y + 2, w - 8, 2, '#00000014');
}

// ---------- 도트 크기 맞추기 ----------
// 지금까지는 캔버스 뒷면을 960x768 로 고정해 두고 CSS 가 늘였다 줄였다 했다.
// 그러면 도트 하나가 5.6픽셀 같은 어중간한 크기가 되어, 어떤 줄은 5픽셀 어떤 줄은 6픽셀로
// 나뉜다. 눈에는 선이 굵었다 얇았다 하는 자글거림으로 보인다.
// 뒷면을 「그림 크기 x 정수」로만 잡고 CSS 크기도 그에 맞춰 박으면 모든 도트가 똑같아진다.
function fitPixelCanvas(cv, artW, artH, maxK){
  const host = cv.parentElement;                       // .stage / .house-stage
  const outer = host && host.parentElement;
  let avail = (outer && outer.clientWidth) || (host && host.clientWidth) || 0;
  if (host){
    const hs = getComputedStyle(host);
    avail -= (parseFloat(hs.borderLeftWidth) || 0) + (parseFloat(hs.borderRightWidth) || 0);
    // max-width 는 px 로 적힌 것만 본다 (100% 는 parseFloat 하면 100 이 되어 버린다)
    if (/px$/.test(hs.maxWidth)){ const mx = parseFloat(hs.maxWidth); if (mx && avail > mx) avail = mx; }
  }
  if (!(avail > 0)) return false;                      // 아직 화면에 붙지 않았다
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let want = avail * dpr;
  if (want > 1600) want = 1600;                        // 너무 크면 겹을 담아 두는 값이 든다
  let k = Math.floor(want / artW);
  // 도트 하나가 화면에서 네 픽셀보다 크면 배수가 어중간할 때 자글거림이 눈에 띈다 — 정수로 못 박는다.
  // 그보다 작으면 어중간해도 안 보이므로 폭을 꽉 채우는 쪽이 낫다.
  if (k >= 4) k = Math.min(maxK || 8, k);
  else k = Math.max(0.75, want / artW);
  const w = Math.round(artW * k), h = Math.round(artH * k);
  const cw = w / dpr;
  cv.style.width = cw + 'px';
  cv.style.height = (h / dpr) + 'px';
  if (cv.width === w && cv.height === h) return false;
  cv.width = w; cv.height = h;
  return true;
}

// ---------- 하루의 빛 ----------
// 진짜 시계를 본다. 새벽·아침·낮·노을·밤이 이어지도록 사이 값을 섞는다.
// 하루의 빛을 색보정 표로 둔다.
// 곱하기 한 겹만 쓰면 낮이든 노을이든 화면 전체가 똑같이 탁해진다.
// 어두운 쪽은 곱하기(c)로 눌러 물들이고, 밝은 쪽은 스크린(lift)으로 따로 들어 올린다.
// 그래야 노을이 「전부 주황」이 아니라 「밝은 데가 주황, 그늘은 보라」가 된다.
// lift 가 검정이면 아무 일도 안 하므로 한낮에는 두 번째 칠을 아예 건너뛴다.
const SKY = [
  { h: 0,    dark: .60, c: '#141a46', lift: '#080d22' },
  { h: 4.2,  dark: .56, c: '#1d2050', lift: '#091027' },
  { h: 5.6,  dark: .40, c: '#4a3670', lift: '#110d2a' },
  { h: 6.6,  dark: .22, c: '#c06a86', lift: '#180a20' },
  { h: 7.4,  dark: .12, c: '#ffb478', lift: '#2a1604' },
  { h: 9.0,  dark: .03, c: '#ffe6b0', lift: '#120c00' },
  { h: 12,   dark: 0,   c: '#ffffff', lift: '#000000' },
  { h: 16,   dark: .02, c: '#fff4d2', lift: '#100a00' },
  { h: 17.6, dark: .08, c: '#ffcf96', lift: '#241202' },
  { h: 18.6, dark: .20, c: '#ff9a68', lift: '#3a1a04' },
  { h: 19.4, dark: .34, c: '#d1667e', lift: '#300e22' },
  { h: 20.2, dark: .46, c: '#6b4a86', lift: '#140c28' },
  { h: 21.2, dark: .56, c: '#2a2a63', lift: '#0a1028' },
  { h: 22.5, dark: .60, c: '#141a46', lift: '#080d22' },
  { h: 24,   dark: .60, c: '#141a46', lift: '#080d22' },
];
function dayLight(){
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  return lightAt(h);
}
function lightAt(h){
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1].h <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = Math.max(0, Math.min(1, (h - a.h) / (b.h - a.h || 1)));
  const dark = a.dark + (b.dark - a.dark) * t;
  return { hour: h, dark: dark, tint: mix(a.c, b.c, t), lift: mix(a.lift, b.lift, t), lamp: dark > 0.16 };
}

// ---------- 색 ----------
// 계절마다 풀·흙·꽃 색을 여러 단계로 둔다. 단계가 많을수록 도트가 덜 밋밋하다.
const GROUND = {
  spring: { g: ['#a9dca1', '#9fd69a', '#94cf90', '#88c786'], tuft: ['#6fb567', '#5da05a'], dry: '#cbbd8c', bloom: ['#ffb7d5', '#fff3a0', '#ffffff', '#c9a8ff', '#ff9aa2'], rock: '#c2bab0' },
  summer: { g: ['#93d189', '#88c980', '#7cc077', '#6fb56d'], tuft: ['#579e54', '#468a46'], dry: '#c8b184', bloom: ['#ffd166', '#ff9ec4', '#ffffff', '#ffe066'], rock: '#c2bab0' },
  autumn: { g: ['#d5c68a', '#cbbb7e', '#c0af73', '#b3a267'], tuft: ['#9c8a4f', '#87763f'], dry: '#b49a6a', bloom: ['#e8874a', '#d9603c', '#f2c14e', '#c96b3a'], rock: '#bfb5a8' },
  winter: { g: ['#f2f7f8', '#eaf1f4', '#e1eaee', '#d7e2e8'], tuft: ['#c8d6dc', '#b3c3cb'], dry: '#d5dee1', bloom: ['#ffffff', '#eaf6ff'], rock: '#cdd6da' },
};
const SOIL = { wet: ['#6d4c30', '#7d5a3c', '#5a3f28'], dry: ['#b5885c', '#c49a6d', '#9f7550'] };
const WOOD = { hi: '#d6a878', mid: '#c79b6d', low: '#a97b4f', dark: '#8a5f3a', line: '#6f4a2c' };
const STONE = { hi: '#d5cec5', mid: '#c2bab0', low: '#a49c92', dark: '#857d75', line: '#665f59' };

// ---------- 스프라이트 ----------
// 아이들 — 앞·옆·뒤 세 방향, 걸음 두 장. 팔레트만 갈아 끼우면 수아·연아가 된다.
// 아이들 — 앞·옆·뒤 세 방향, 걸음 두 장. 머리 모양은 둘이 다르고, 색표만 갈아 끼우면 옷이 바뀐다.
// 걸음 두 번째 장은 손으로 또 적지 않고 첫 장을 한 도트 내려앉혀 만든다.
function walkFrame(rows, legA, legB){
  // 걸음 두 번째 장 — 몸을 두 도트 내려앉히고 다리 네 줄만 갈아 끼운다
  const pad = '.'.repeat(rows[0].length);
  const out = [pad, pad].concat(rows.slice(0, rows.length - 2));
  out[out.length - 4] = legA; out[out.length - 3] = legA;
  out[out.length - 2] = legB; out[out.length - 1] = legB.replace(/b/g, 'B');
  return out;
}
// 짧은 머리 — 연아
const KID_SHORT = {
  down: [
    '.....kkhhhhhhhhhhkk.....', '....khhHHHHHHHHHHhhk....', '...khhHHHHHHHHHHHHhhk...', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHhHHHHhHHHHhhk..', '..khhHHHHhHHHHhHHHHhhk..', '..khhffffhffffhffffhhk..', '..khhffffffffffffffhhk..',
    '..khhffffffffffffffhhk..', '..khhffweffffffewffhhk..', '..khhffeeffffffeeffhhk..', '..khhffeeffffffeeffhhk..',
    '..khhffffffffffffffhhk..', '...kffppffmmmmffppffk...', '...kfffffffmmfffffffk...', '....kkFFffffffffFFkk....',
    '.....kkkffffffffkkk.....', '...kkccCCCCCCCCCCcckk...', '..kssccccccEcEcccccssk..', '..kssccccccEcEcccccssk..',
    '..kssccccccEcEcccccssk..', '..kssccccccccccccccssk..', '..kssccccccccccccccssk..', '..kssnnnnnnnnnnnnnnssk..',
    '...kkkVVVVVVVVVVVVkkk...', '.....kvvvvvvvvvvvvk.....', '.....kvvvvvVVvvvvvk.....', '.....kvvvvvVVvvvvvk.....',
    '......kkssskkssskk......', '......kbbbbkkbbbbk......', '......kbbbbkkbbbbk......', '......kBBBBkkBBBBk......',
  ],
  side: [
    '......kkhhhhhhhhkk......', '.....khhHHHHHHHHhhk.....', '....khhHHHHHHHHHHhhk....', '...khhHHHHHHHHHHHHhhk...',
    '...khhHHHHHHHHHHHHhhk...', '...khhHHHHHHHHHHHHhhk...', '...khhhhhhhhhhhhhhhhk...', '...khhhffffffffffffhk...',
    '...khhhffffffffffffhk...', '...khhhffffffffweffhk...', '...khhhffffffffeeffhk...', '...khhhfffffffffffffk...',
    '...khhhffffppffffffFk...', '....khhhfffffffmmmhk....', '....khhhfffffffmmfhk....', '.....kkhhhFFFFffhkk.....',
    '......kkkhhhffhkkkk.....', '.....kccccccccccccck....', '.....kccccccEccsssck....', '.....kccccccEccsssck....',
    '.....kccccccEccsssck....', '.....kcccccccccsssck....', '.....kcccccccccsssck....', '.....knnnnnnnnnsssnk....',
    '......kVVVVVVVVVVVk.....', '......kvvvvvvvvvvvk.....', '......kvvvvvvvvvvvk.....', '......kvvvvvvvvvvvk.....',
    '.......kkksssssskk......', '........kbbbbbbbbk......', '........kbbbbbbbbk......', '........kBBBBBBBBk......',
  ],
  up: [
    '.....kkhhhhhhhhhhkk.....', '....khhHHHHHHHHHHhhk....', '...khhHHHHHHHHHHHHhhk...', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '...khhHHHHHHHHHHHHhhk...', '...khhhhhhhhhhhhhhhhk...', '....kkhhhhhhhhhhhhkk....',
    '.....kkkhhhhhhhhkkk.....', '...kkccCCCCCCCCCCcckk...', '..kssccccccEcEcccccssk..', '..kssccccccEcEcccccssk..',
    '..kssccccccEcEcccccssk..', '..kssccccccccccccccssk..', '..kssccccccccccccccssk..', '..kssnnnnnnnnnnnnnnssk..',
    '...kkkVVVVVVVVVVVVkkk...', '.....kvvvvvvvvvvvvk.....', '.....kvvvvvVVvvvvvk.....', '.....kvvvvvVVvvvvvk.....',
    '......kkssskkssskk......', '......kbbbbkkbbbbk......', '......kbbbbkkbbbbk......', '......kBBBBkkBBBBk......',
  ],
};
const KID_LONG = {
  down: [
    '.....kkhhhhhhhhhhkk.....', '....khhHHHHHHHHHHhhk....', '...khhHHHHHHHHHHHHhhk...', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhffffffffffffffhhk..',
    '..khhffffffffffffffhhk..', '..khhffweffffffewffhhk..', '..khhffeeffffffeeffhhk..', '..khhffeeffffffeeffhhk..',
    '..khhffffffmmffffffhhk..', '..kkffppfffmmfffppffkk..', '.khHfffffffmmfffffffHhk.', '.khHkkFFffffffffFFkkHhk.',
    '.khHkkkkffffffffkkkkHhk.', '.khHkCCCCCCCCCCCCCCkHhk.', '.khHsCCCCCCCCCCCCCCsHhk.', '.khHsccccccccccccccsHhk.',
    '.khHsCCCCCCCCCCCCCCsHhk.', '..khsccccccccccccccshk..', '..khsCCCCCCCCCCCCCCshk..', '..khsccccccccccccccshk..',
    '...khkVVVVVVVVVVVVkhk...', '....kkvvvvvvvvvvvvkk....', '.....kvvvvvVVvvvvvk.....', '.....kvvvvvVVvvvvvk.....',
    '......kkssskkssskk......', '......kbbbbkkbbbbk......', '......kbbbbkkbbbbk......', '......kBBBBkkBBBBk......',
  ],
  side: [
    '......kkhhhhhhhhkk......', '.....khhHHHHHHHHhhk.....', '....khhHHHHHHHHHHhhk....', '...khhHHHHHHHHHHHHhhk...',
    '...khhHHHHHHHHHHHHhhk...', '...khhHHHHHHHHHHHHhhk...', '...khhhhhhhhhhhhhhhhk...', '...khhhffffffffffffhk...',
    '...khhhffffffffffffhk...', '...khhhffffffffweffhk...', '...khhhffffffffeeffhk...', '...khhhfffffffffffffk...',
    '...khhhffffppffffffFk...', '...kkhhhfffffffmmmhk....', '..khHHhhfffffffmmfhk....', '..khHHhhhhFFFFffhkk.....',
    '..khHHhkkhhhffhkkkk.....', '..khHHhCCCCCCCCCCCCk....', '..khHHhCCCCCCCCsssCk....', '..khHHhccccccccsssck....',
    '..khHHhCCCCCCCCsssCk....', '..khHHhccccccccsssck....', '..khHHhCCCCCCCCsssCk....', '..khHHhccccccccsssck....',
    '..khHHhVVVVVVVVVVVk.....', '..khHHhvvvvvvvvvvvk.....', '...khhhvvvvvvvvvvvk.....', '....kkkvvvvvvvvvvvk.....',
    '.......kkksssssskk......', '........kbbbbbbbbk......', '........kbbbbbbbbk......', '........kBBBBBBBBk......',
  ],
  up: [
    '.....kkhhhhhhhhhhkk.....', '....khhHHHHHHHHHHhhk....', '...khhHHHHHHHHHHHHhhk...', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..', '..khhHHHHHHHHHHHHHHhhk..',
    '..khhHHHHHHHHHHHHHHhhk..', '..kkhhHHHHHHHHHHHHhhkk..', '.khHhhhhhhhhhhhhhhhhHhk.', '.khHkkhhhhhhhhhhhhkkHhk.',
    '.khHkkkkhhhhhhhhkkkkHhk.', '.khHkCCCCCCCCCCCCCCkHhk.', '.khHsCCCCCCCCCCCCCCsHhk.', '.khHsccccccccccccccsHhk.',
    '.khHsCCCCCCCCCCCCCCsHhk.', '..khsccccccccccccccshk..', '..khsCCCCCCCCCCCCCCshk..', '..khsccccccccccccccshk..',
    '...khkVVVVVVVVVVVVkhk...', '....kkvvvvvvvvvvvvkk....', '.....kvvvvvVVvvvvvk.....', '.....kvvvvvVVvvvvvk.....',
    '......kkssskkssskk......', '......kbbbbkkbbbbk......', '......kbbbbkkbbbbk......', '......kBBBBkkBBBBk......',
  ],
};


function kidSet(base){
  return {
    down: [base.down, walkFrame(base.down, '.....ksssk....ksssk.....', '....kbbbbk....kbbbbk....')],
    side: [base.side, walkFrame(base.side, '.......ksssk.ksssk......', '......kbbbbkkbbbbk......')],
    up:   [base.up,   walkFrame(base.up,   '.....ksssk....ksssk.....', '....kbbbbk....kbbbbk....')],
  };
}
const KIDART = { sua: kidSet(KID_LONG), yona: kidSet(KID_SHORT) };
const KID = KIDART.yona;                       // 방 그림 등에서 기본으로 쓰는 것
const KIDPAL = {
  // 메인 첫화면 캐릭터와 같은 색을 쓴다.
  // 수아 — 진갈색 긴 머리, 빨강·흰 줄무늬 상의, 남색 반바지, 주황 신발
  sua:  { k: '#3a3226', h: '#3f2d23', H: '#55402f', f: '#fbdcc4', F: '#eec3a2', e: '#3a3226', w: '#ffffff',
          m: '#c9333f', p: '#ffb0b8', c: '#ea2027', C: '#fdfdfd', n: '#c2151b', E: '#ffffff',
          s: '#fbdcc4', v: '#2e3a54', V: '#41506e', b: '#e8912f', B: '#c47320' },
  // 연아 — 적갈색 단발, 노란 후드(흰 끈), 남색 반바지, 주황 신발
  yona: { k: '#3a3226', h: '#a0562c', H: '#bd6c3a', f: '#fbdcc4', F: '#eec3a2', e: '#3a3226', w: '#ffffff',
          m: '#c9333f', p: '#ffb0b8', c: '#ffe66d', C: '#fff3ae', n: '#ffc94d', E: '#ffffff',
          s: '#fbdcc4', v: '#2e3a54', V: '#41506e', b: '#e8912f', B: '#c47320' },
};

// 동물 — 종마다 그림 한 장과 색표 하나.
const BEAST = {
  chicken: { w: 24, art: [
    '.................rr.....', '................rrrr....', '...............rrrrr....', '..............rrrrrr....',
    '.............bbbbbbbb...', '............bbbbbbbbbb..', '...tt......bbbbbbbbbeek.', '..tttt....bbbbbbbbbbeekk',
    '.tbbbbbbbbbbbbbbbbbbkkkk', 'ttbbbbbbbbbbbbbbbbbbkkk.', 'ttbbbbbbbbbbbbbbbbbbbb..', '.tbbbbbbbbbbbbbbbbbbbb..',
    '..BBbbbbbbbbbbbbbbbbBB..', '...BbbbbbbbbbbbbbbbbB...', '....BBBBBBBBBBBBBBBB....', '.....BBBBBBBBBBBBBB.....',
    '......ll......ll........', '......ll......ll........', '.....llll....llll.......', '.....llll....llll.......',
  ], pal: { b: '#fffaf2', B: '#e3d9c8', r: '#ff5a4a', k: '#ff9f2e', e: '#3a3226', l: '#ffb43d', t: '#efe8db' } },
  duck: { w: 24, art: [
    '...............hhhh.....', '..............hhhhhh....', '.............hhhhhhhh...', '............hhhhhhhhhh..',
    '............hhhhhhhheek.', '............hhhhhhhheekk', '...tt.......hhhhhhhhkkkk', '..tttt......hhhhhhhhkkk.',
    '.tbbbbbbbbbbbbbbbbhh....', 'ttbbbbbbbbbbbbbbbbhh....', 'ttbbbbbbbbbbbbbbbbbb....', '.tbbbbbbbbbbbbbbbbbb....',
    '..BBbbbbbbbbbbbbbbBB....', '...BbbbbbbbbbbbbbbB.....', '....BBBBBBBBBBBBBB......', '.....BBBBBBBBBBBB.......',
    '......ll....ll..........', '......ll....ll..........', '.....llll...lllll.......', '.....llll....llll.......',
  ], pal: { b: '#fffdf6', B: '#ded7c6', h: '#2f7d5e', k: '#ffb43d', e: '#26241f', l: '#ff9f2e', t: '#f3ece0' } },
  cow: { w: 32, art: [
    '................................', '............................kk..', '.......................hhhhhkk..', '......................hhhhhhkk..',
    '.....ssss............hhhhhhhhh..', '....ssssss..........hhhhhhhhhh..', '...bbbbbbbbbbbbbbbbbhhhheehhhh..', '..bbbbbbbbbbbbbbbbbbhhhheehhhh..',
    '.bbbbbbbbbbbbbbbbbbbhhhhhhhhhh..', 'bbbbbbbbbbbbbbbbbbbbhhhhhhhhh...', 'bbbbbbssssssbbbbbbbbnnnnnnnn....', 'bbbbbbssssssbbbbbbbbnnnnnnnn....',
    'bbbbbbssssssbbbbbbbbnnnnnnnn....', 'bbbbbbssssssbbbbbbbbnnnnnnn.....', 'BBbbbbbbbbbbbbbbbbBB............', '.BbbbbbbbbbbbbbbbbB.............',
    '..BBBBBBBBBBBBBBBB..............', '...BBBBBBBBBBBBBB...............', '....uu..uu......................', '....uu..........................',
    '....ll..........................', '....ll......ll..................', '...llll....llll.................', '...llll....llll.................',
  ], pal: { b: '#fffaf2', B: '#ded5c6', s: '#3a3226', h: '#fffaf2', k: '#c79b6d', e: '#3a3226', n: '#ffb3a7', u: '#ffc4c4', l: '#3a3226' } },
  sheep: { w: 28, art: [
    '.....wwwwwwwwwwww...........', '....wwwwwwwwwwwwww..........', '...wwwwwwwwwwwwwwww.........', '..wwwwwwwwwwwwwwwwww........',
    '.wwwwwwwwwwwwwwwwwwwhhhhh...', 'wwwwwwwwwwwwwwwwwwwwhhhhhh..', 'wwwwwwwwwwwwwwwwwwwwhheehhh.', 'wwwwwwwwwwwwwwwwwwwwhheehhhh',
    'wwwwwwwwwwwwwwwwwwwwhhhhhhhh', 'wwwwwwwwwwwwwwwwwwwwhhhhhhh.', 'wwwwwwwwwwwwwwwwwwww..hhhh..', '.wwwwwwwwwwwwwwwwww....hh...',
    '..WWWWWWWWWWWWWWWW..........', '...WWWWWWWWWWWWWW...........', '....WWWWWWWWWWWW............', '....WWWWWWWWWWW.............',
    '....ll......ll..............', '....ll......ll..............', '....ll......ll..............', '....ll......ll..............',
    '...llll....llll.............', '...llll....llll.............', '............................', '............................',
  ], pal: { w: '#fbf7f1', W: '#e0d9cf', h: '#4a4038', e: '#fff6e9', l: '#4a4038' } },
  pig: { w: 28, art: [
    '............................', '............................', '...........pppppppp....hh...', '..........pppppppppp..hhhh..',
    '.....pppppppppppppppppppppp.', '....pppppppppppppppppppppppp', '...pppppppppppppppppppppppnn', '..ppppppppppppppppppppppppnn',
    '.pppppppppppppppppppppeeppnn', 'ppppppppppppppppppppppeeppnn', 'ppppppppppppppppppppppppppnn', 'ppppppppppppppppppppppppppnn',
    'PPppppppppppppppppppppppppPP', '.PppppppppppppppppppppppppP.', '..PPPPPPPPPPPPPPPPPPPPPPPP..', '...PPPPPPPPPPPPPPPPPPPPPP...',
    '....ll......ll....ll........', '....ll......ll....ll........', '....ll......ll....ll........', '....ll......ll....ll........',
    '...llll....llll...lllll.....', '...llll....llll....llll.....',
  ], pal: { p: '#f7b0c0', P: '#e090a4', n: '#d4718c', e: '#3a3226', h: '#eda0b2', l: '#e090a4' } },
  rabbit: { w: 20, art: [
    '....................', '....aa........aa....', '....aa........aa....', '....aa........aa....',
    '....aaa......aaa....', '....aaaa....aaaa....', '....bbbbbbbbbbbb....', '....bbbbbbbbbbbb....',
    '...bbbbbbbbbbbbbb...', '..bbbbbbbbbbbbbbbb..', '..bbbbeebbbbeebbbb..', '..bbbbeebbbbeebbbb..',
    '..bbbbbbnnnnbbbbbb..', '..bbbbbbnnnnbbbbbb..', '.bbbbbbbbbbbbbbbbbb.', 'bbbbbbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbbbbbb', '.bbbbbbbbbbbbbbbbbb.', '..BBbbbbbbbbbbbbBB..', '...BbbbbbbbbbbbbB...',
    '....BBBBBBBBBBBB....', '....BBBBBBBBBBBB....', '....ll........ll....', '....................',
  ], pal: { a: '#f6efe6', b: '#fdf8f1', B: '#ded5c8', e: '#c96a86', n: '#ffb3c4', l: '#e0d7c9' } },
  dog: { w: 26, art: [
    '...................aa.....', '..................aaaa....', '..................aaaaa...', '..tt..............aaaaaa..',
    '.tttt......ddddddddddddd..', '.ttttt....dddddddddddddd..', '..ddddddddddddddddddddeen.', '..ddddddddddddddddddddeenn',
    '.dddddddddddddddddddddddnn', 'ddddddddddddddddddddddddn.', 'dddddddddddddddddddddddd..', 'ddddddddddddddddddddddd...',
    'DDddddddddddddddddddDD....', '.DddddddddddddddddddD.....', '..DDDDDDDDDDDDDDDDDD......', '...DDDDDDDDDDDDDDDD.......',
    '....ll....ll....ll........', '....ll....ll....ll........', '....ll....ll....ll........', '....ll....ll....ll........',
    '...llll...lll...lllll.....', '...llll....ll....llll.....',
  ], pal: { d: '#e0b076', D: '#c4915a', a: '#a97b4f', t: '#e0b076', e: '#3a3226', n: '#4a3a30', l: '#c4915a' } },
  cat: { w: 24, art: [
    '........................', '....aa..........aa......', '...aaa..........aaa.....', '..aaaa..........aaaa....',
    '..cccccccccccccccccc....', '..cccccccccccccccccc....', '..cceecccccceecccccc....', '..cceecccccceecccccc..tt',
    '..ccccccnncccccccccc..tt', '..ccccccnncccccccccc..tt', '.ccccccccccccccccccccctt', 'cccccccccccccccccccccct.',
    'cccccccccccccccccccccc..', 'cccccccccccccccccccccc..', 'CCccccccccccccccccccCC..', '.CccccccccccccccccccC...',
    '..CCCCCCCCCCCCCCCCCC....', '...CCCCCCCCCCCCCCCC.....', '....ll....ll....ll......', '....ll....ll....ll......',
    '...lll....lll...lll.....', '...ll......ll....ll.....',
  ], pal: { c: '#8b8f9c', C: '#6f7382', a: '#6f7382', e: '#ffd166', n: '#ffb3c4', t: '#8b8f9c', l: '#6f7382' } },
};
// 가게 아저씨 — 파란 캡에 흰 셔츠, 초록 앞치마.
// 예전에는 살색 네모 하나에 점 두 개가 전부라 기괴해 보였다.
const SHOPKEEP = [
  '.....kkcccccckk.....', '....kccCCCCCCcck....', '...kccCCCCCCCCcck...', '..kkcCCCCCcccccckk..',
  '.kcCCCCCCCCCCCCCCck.', '.kchhffffffffffhhck.', '..khhffffffffffhhk..', '..khhffffffffffhhk..',
  '..khhfweffffewfhhk..', '..khhfeeffffeefhhk..', '..khppffffffffpphk..', '..khhffffFFffffhhk..',
  '...kffffmmmmffffk...', '...kfffffmmfffffk...', '...kFFffffffffFFk...', '...kkkkkFFffkkkkk...',
  '..kssssssssssssssk..', '.kssssAAAAAAAAssssk.', '.kssssaaaaaaaassssk.', '.kssssAAaaaaAAssssk.',
  '.kssssaaaaaaaassssk.', '.kssssaaaaaaaassssk.', '.kssssaaaaaaaassssk.', '.kssssaaaaaaaassssk.',
];
const SHOPPAL = { k: '#3a3226', c: '#4a7fb5', C: '#6a9fd0', f: '#fbdcc4', F: '#eec3a2', h: '#6b4a2c',
                  e: '#3a3226', w: '#ffffff', m: '#c9333f', p: '#ffb0b8', s: '#f2ece0',
                  a: '#4f9a5a', A: '#69b573' };
// 행상인은 가게 아저씨와 같은 그림에 색만 갈아 끼운다 — 보라 외투에 붉은 목도리
const PEDPAL = { k: '#2b2620', c: '#7a5cb5', C: '#9b7bd4', f: '#f6d3b4', F: '#e3b48f', h: '#4a3524',
                 e: '#2b2620', w: '#ffffff', m: '#c9333f', p: '#f0a6ae', s: '#e8dcc8',
                 a: '#8a5cc7', A: '#a479dd' };
/* 수레를 끌고 온 행상인. 이레에 두 번쯤 와서, 온 날에만 그린다.
   줄무늬 덮개와 둥근 바퀴로 가게 좌판과 구별한다 — 네모 바퀴는 탁자 다리로 읽혔다.
   가게 아저씨 그림은 좌판에 가릴 몫이라 다리가 없다. 그대로 쓰면 허리에서 잘려 보이므로
   외투 자락과 신을 아래에 덧그린다. */
function drawPeddler(t){
  const b = R.PEDDLER, X = b.x * T, Y = b.y * T, G = Y + T;      // G: 바닥 줄
  const bob = Math.sin(t / 900) > 0.6 ? 1 : 0;
  px(X + 2, G - 4, 76, 4, '#00000018');
  // 둥근 바퀴 둘
  const wheel = (wx, wy) => {
    px(wx + 3, wy, 6, 2, '#3a2f22'); px(wx + 1, wy + 2, 10, 2, '#3a2f22');
    px(wx, wy + 4, 12, 2, '#3a2f22'); px(wx + 1, wy + 6, 10, 2, '#3a2f22');
    px(wx + 3, wy + 8, 6, 2, '#3a2f22'); px(wx + 4, wy + 3, 4, 4, '#9b8a6d');
  };
  wheel(X + 6, G - 12); wheel(X + 38, G - 12);
  // 짐칸
  px(X + 2, G - 22, 54, 10, WOOD.dark);
  px(X + 2, G - 22, 54, 3, WOOD.mid);
  px(X + 2, G - 13, 54, 2, '#5a3f26');
  // 줄무늬 덮개
  px(X + 4, G - 38, 50, 16, '#fff6e9');
  for (let i = 0; i < 50; i += 14) px(X + 4 + i, G - 38, 7, 16, '#8a5cc7');
  px(X + 2, G - 40, 54, 4, '#5f3f96');
  // 손잡이
  px(X + 56, G - 20, 10, 3, WOOD.low);
  // 행상인 — 수레 오른쪽. 자락과 신을 붙여 바닥에 세운다
  px(X + 62, G - 10 - bob, 16, 6, '#7a5cb5');
  px(X + 63, G - 4, 5, 4, '#3a2f22'); px(X + 72, G - 4, 5, 4, '#3a2f22');
  art(SHOPKEEP, X + 60, G - 30 - bob, PEDPAL, true);
  px(X + 60, G - 32 - bob, 20, 3, '#5f3f96');     // 챙
}
function beastW(kind){ return (BEAST[kind] || BEAST.chicken).w; }
// 도감·카드에서도 쓰는 그림. s 는 도트 한 개의 크기.
function drawAnimalAt(g, kind, X, Y, s, flip, k){
  const B = BEAST[kind] || BEAST.chicken;
  if (!k || k === 1){ drawArt(g, B.art, X * s, Y * s, s, B.pal, flip); return; }
  // 새끼는 작게. 발이 같은 줄에 놓이도록 아래로 밀고 가로는 가운데를 맞춘다
  drawArt(g, B.art, (X + B.art[0].length * (1 - k) / 2) * s, (Y + B.art.length * (1 - k)) * s, s * k, B.pal, flip);
}

// ---------- 풀밭 ----------
// 칸마다 조금씩 다른 초록을 깔고, 그 위에 풀포기·조약돌·꽃을 흩뿌린다.
// 같은 자리는 늘 같은 무늬가 나오도록 좌표로 난수를 만든다.
function noise2(x, y, sc, salt){ return R.prand(salt + Math.floor(x / sc) + '_' + Math.floor(y / sc)); }
/* 겉면에 결 한 겹 — 첫화면 마을처럼 같은 색이라도 돌은 얼룩지고 나무는 세로로 흐른다.
   자리는 늘 같은 값에서 나오니 프레임마다 어른거리지 않는다. */
function grainy(x, y, w, h, col, kind, salt){
  x = Math.round(x); y = Math.round(y);
  if (kind === 'wood'){
    for (let i = 0; i < w; i += 2){
      const v = R.prand(salt + '|' + i);
      if (v > 0.76) px(x + i, y, 2, h, shade(col, -11));
      else if (v < 0.18) px(x + i, y, 2, h, shade(col, 9));
    }
  } else {
    for (let i = 0; i < w; i += 2) for (let j = 0; j < h; j += 2){
      const v = noise2(x + i, y + j, 2, salt);
      if (v > 0.78) px(x + i, y + j, 2, 2, shade(col, 9));
      else if (v < 0.20) px(x + i, y + j, 2, 2, shade(col, -10));
    }
  }
}
// 얼룩을 한 겹만 쓰면 바둑판처럼 각이 진다. 성긴 겹과 촘촘한 겹을 섞으면 훨씬 자연스럽다.
function noise2b(x, y, a, b, salt){ return noise2(x, y, a, salt) * 0.62 + noise2(x, y, b, salt + '~') * 0.38; }
function drawGround(season){
  const P = GROUND[season], Wp = COLS * T, Hp = ROWS * T;
  // 1) 큰 얼룩 — 칸 경계를 넘어 이어지게. 이게 없으면 열여섯 칸짜리 바둑판이 눈에 띈다.
  px(0, 0, Wp, Hp, P.g[1]);
  for (let y = 0; y < Hp; y += 8) for (let x = 0; x < Wp; x += 8){
    const v = noise2(x, y, 54, 'a') * 0.55 + noise2(x, y, 22, 'b') * 0.3 + noise2(x, y, 10, 'c') * 0.15;
    px(x, y, 8, 8, P.g[Math.min(3, Math.floor(v * 4))]);
  }
  // 2) 잔 알갱이 — 한 도트짜리. 가까이 보면 결이 산다.
  for (let y = 0; y < Hp; y += 4) for (let x = 0; x < Wp; x += 4){
    const r = R.prand('k' + x + '_' + y);
    if (r > 0.86) px(x, y, 2, 2, P.g[r > 0.94 ? 0 : 3]);
  }
  // 3) 칸마다 풀포기·조약돌·꽃
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++){
    const X = tx * T, Y = ty * T, r0 = R.prand('g' + tx + '_' + ty);
    const n = r0 < 0.5 ? 3 : r0 < 0.85 ? 2 : 1;
    for (let i = 0; i < n; i++){
      const rr = R.prand('t' + tx + '_' + ty + '_' + i);
      const gx = X + 2 + Math.floor(rr * (T - 8)), gy = Y + 4 + Math.floor(R.prand('u' + tx + '_' + ty + '_' + i) * (T - 12));
      const c = P.tuft[i % 2];
      px(gx, gy + 2, 2, 6, c); px(gx + 2, gy, 2, 8, shade(c, 14)); px(gx + 4, gy + 4, 2, 4, shade(c, -10));
    }
    if (r0 > 0.93){ px(X + 12, Y + 18, 8, 4, P.rock); px(X + 12, Y + 18, 6, 2, shade(P.rock, 20)); px(X + 12, Y + 22, 8, 2, shade(P.rock, -22)); }
    const bloomP = season === 'spring' ? 0.2 : season === 'summer' ? 0.14 : season === 'autumn' ? 0.07 : 0;
    if (R.prand('f' + tx + '_' + ty) < bloomP){
      const c = P.bloom[Math.floor(R.prand('fc' + tx + '_' + ty) * P.bloom.length)];
      const fx = X + 8 + Math.floor(R.prand('fx' + tx + '_' + ty) * 14), fy = Y + 10 + Math.floor(R.prand('fy' + tx + '_' + ty) * 12);
      px(fx, fy + 4, 2, 6, P.tuft[1]);
      px(fx, fy, 2, 2, c); px(fx - 2, fy + 2, 6, 2, c); px(fx, fy + 4, 2, 2, c);
      px(fx, fy + 2, 2, 2, '#fff6c0');
    }
    if (season === 'autumn' && R.prand('l' + tx + '_' + ty) < 0.16){
      const lx = X + 6 + Math.floor(R.prand('lx' + tx + '_' + ty) * 18), ly = Y + 6 + Math.floor(R.prand('ly' + tx + '_' + ty) * 18);
      const c = ['#d9603c', '#e8874a', '#c9a227'][Math.floor(R.prand('lc' + tx + '_' + ty) * 3)];
      px(lx, ly, 4, 2, c); px(lx + 2, ly + 2, 2, 2, shade(c, -26));
    }
    if (season === 'winter' && R.prand('w' + tx + '_' + ty) < 0.25){
      px(X + 4 + Math.floor(R.prand('wx' + tx + '_' + ty) * 18), Y + 8 + Math.floor(R.prand('wy' + tx + '_' + ty) * 16), 6, 4, '#ffffff');
    }
  }
}
// 흙길 — 집 앞에서 밭까지, 그리고 목장까지
function drawPath(season){
  const c = season === 'winter' ? ['#dcd6c8', '#cfc7b6', '#e6e0d3'] : ['#e0cfa8', '#d2bf95', '#ece0bf'];
  const lay = (x0, y0, x1, y1) => {
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0, y = y0, guard = 0;
    while (guard++ < 200){
      const X = x * T, Y = y * T;
      px(X, Y + 8, T, 16, c[0]);
      for (let i = 0; i < 12; i++){
        const rr = R.prand('p' + x + '_' + y + '_' + i);
        px(X + Math.floor(rr * (T - 8)), Y + 8 + Math.floor(R.prand('q' + x + '_' + y + '_' + i) * 14), 4, 2, c[rr > 0.5 ? 1 : 2]);
      }
      if (x === x1 && y === y1) break;
      if (x !== x1) x += dx; else y += dy;
    }
  };
  // 집 문에서 나와 건물 사이를 지나 아래로, 그리고 가로로 길게.
  // 건물 밑으로 지나가면 길이 끊겨 보여서 빈 칸만 골라 잇는다.
  const h = spot('house'), row = R.FIELD.y0 + R.FIELD.h + 1;
  const way = [[h.x + 2, h.y + h.h], [h.x + 2, h.y + h.h + 2], [4, h.y + h.h + 2], [4, row], [COLS - 6, row]];
  for (let i = 1; i < way.length; i++) lay(way[i - 1][0], way[i - 1][1], way[i][0], way[i][1]);
}

// ---------- 밭 ----------
function drawFieldFrame(){
  const E = R.EXPANSIONS[Math.min(W.expand || 0, R.EXPANSIONS.length - 1)];
  const fx = R.FIELD.x0 * T, fy = R.FIELD.y0 * T, fw = E.w * T, fh = E.h * T;
  // 아직 못 연 땅은 점선으로만
  const nextE = R.EXPANSIONS[(W.expand || 0) + 1];
  if (nextE) for (let y = 0; y < nextE.h; y++) for (let x = 0; x < nextE.w; x++){
    if (x < E.w && y < E.h) continue;
    const X = (R.FIELD.x0 + x) * T, Y = (R.FIELD.y0 + y) * T;
    for (let i = 0; i < T; i += 8){ px(X + i, Y, 4, 2, '#00000022'); px(X, Y + i, 2, 4, '#00000022'); }
  }
  // 울타리 — 기둥과 가로대 두 줄
  const post = (X, Y) => { px(X, Y - 12, 4, 16, WOOD.dark); px(X, Y - 12, 2, 16, WOOD.mid); px(X, Y - 14, 4, 2, WOOD.hi); };
  px(fx - 2, fy - 8, fw + 4, 2, WOOD.mid); px(fx - 2, fy - 2, fw + 4, 2, WOOD.low);
  px(fx - 2, fy + fh + 2, fw + 4, 2, WOOD.mid); px(fx - 2, fy + fh + 8, fw + 4, 2, WOOD.low);
  px(fx - 8, fy - 2, 2, fh + 4, WOOD.mid); px(fx - 2, fy - 2, 2, fh + 4, WOOD.low);
  px(fx + fw + 2, fy - 2, 2, fh + 4, WOOD.mid); px(fx + fw + 8, fy - 2, 2, fh + 4, WOOD.low);
  for (let i = 0; i <= fw; i += T){ post(fx + i - 2, fy); post(fx + i - 2, fy + fh + 12); }
  for (let i = 0; i <= fh; i += T){ post(fx - 6, fy + i + 12); post(fx + fw + 4, fy + i + 12); }
}
function drawPlot(id, p, gh){
  const { x, y } = R.parseId(id);
  const X = x * T, Y = y * T;
  if (!p || !p.tilled) return;
  const wet = R.wetNow(p, now(), gh), S3 = wet ? SOIL.wet : SOIL.dry;
  px(X, Y, T, T, S3[0]);
  // 흙 얼룩 — 칸 경계를 넘어 이어지는 큰 무늬라 밭 전체가 한 장의 흙처럼 보인다.
  // 좌표로 난수를 만들므로 칸 크기가 바뀌어도 무늬는 그대로 이어진다.
  for (let dy = 0; dy < T; dy += 4) for (let dx = 0; dx < T; dx += 4){
    const v = noise2b(X + dx, Y + dy, 14, 6, 'so');
    if (v > 0.64) px(X + dx, Y + dy, 4, 4, shade(S3[0], 13));
    else if (v < 0.3) px(X + dx, Y + dy, 4, 4, shade(S3[0], -13));
  }
  // 칸 위쪽 밝은 선은 통으로 그으면 칸마다 밝은 줄이 생겨 바둑판이 된다 — 흩뿌린다
  ditherRow(X, Y, T, shade(S3[0], 15), 0.6, Y);
  // 고랑 — 갈아 놓은 결. 골 밑에 그늘을 흩뿌리면 파인 자국처럼 읽힌다
  for (let i = 4; i < T - 2; i += 6){
    px(X + 2, Y + i, T - 4, 2, S3[2]);
    px(X + 2, Y + i + 2, T - 4, 2, S3[1]);
    ditherRow(X + 2, Y + i + 4, T - 4, shade(S3[0], -13), 0.42, Y + i);
  }
  // 흙 알갱이와 잔돌
  for (let i = 0; i < 7; i++){
    const rr = R.prand('s' + id + i), r2 = R.prand('z' + id + i);
    const gx = X + 2 + Math.floor(rr * (T - 6)), gy = Y + 2 + Math.floor(r2 * (T - 6));
    if (i < 2){ px(gx, gy, 4, 2, shade(S3[0], -22)); px(gx, gy - 2, 2, 2, shade(S3[0], 20)); }
    else px(gx, gy, 2, 2, shade(S3[0], rr > .5 ? 18 : -16));
  }
  if (wet){ px(X + 6, Y + 8, 4, 2, '#7fbfe066'); px(X + T - 12, Y + T - 10, 4, 2, '#7fbfe066'); }
  if (p.fert){ px(X + 4, Y + T - 6, 4, 2, '#e8dcae'); px(X + T - 10, Y + 6, 4, 2, '#e8dcae'); px(X + 14, Y + T - 12, 2, 2, '#e8dcae'); }
}
// ---------- 작물 ----------
// 잎은 세 단계(밝은 쪽·본색·그늘), 열매도 세 단계로 찍는다. sway 는 바람에 흔들리는 정도.
function drawCrop(X, Y, crop, stage, wilted, P, sway){
  const px = P || pxMap;
  const C = R.CROPS[crop];
  const leaf = wilted ? '#a08a5a' : C.leaf;
  const hi = wilted ? '#b9a271' : shade(leaf, 26), dk = wilted ? '#7a6a44' : shade(leaf, -32), stem = wilted ? '#7a6a44' : shade(leaf, -46);
  const fruit = C.fruit, fhi = shade(fruit, 30), fdk = shade(fruit, -34);
  const s = sway || 0;
  const cx = X + 16, base = Y + 28;
  if (wilted){ px(cx - 2, base - 10, 2, 10, stem); px(cx - 6, base - 6, 6, 2, leaf); px(cx + 2, base - 4, 6, 2, dk); px(cx - 8, base - 2, 16, 2, '#00000018'); return; }
  px(cx - 8, base, 18, 2, '#00000016');                       // 그림자
  if (stage === 0){ px(cx - 2, base - 4, 4, 4, leaf); px(cx - 2, base - 4, 2, 2, hi); px(cx - 4, base - 6, 2, 2, leaf); px(cx + 2, base - 6, 2, 2, dk); return; }
  if (stage === 1){ px(cx, base - 10, 2, 10, stem); px(cx - 4, base - 8, 4, 2, leaf); px(cx - 4, base - 10, 2, 2, hi); px(cx + 2, base - 10, 4, 2, leaf); px(cx + 4, base - 8, 2, 2, dk); return; }
  if (stage === 2){
    px(cx, base - 14, 2, 14, stem);
    px(cx - 6 + s, base - 10, 6, 2, leaf); px(cx - 6 + s, base - 12, 4, 2, hi); px(cx + 2 + s, base - 12, 6, 2, leaf); px(cx + 6 + s, base - 10, 2, 2, dk);
    px(cx - 4, base - 6, 4, 2, leaf); px(cx + 2, base - 8, 4, 2, dk);
    return;
  }
  const sh = C.shape;
  if (sh === 'root'){
    // 잎은 부챗살처럼 펼친다 — 네모난 덩어리로 보이지 않게
    px(cx - 2, base - 14, 4, 14, stem);
    [[-14, -8], [-8, -16], [-2, -20], [6, -16], [10, -8]].forEach((q, i) => {
      const c = i % 2 ? leaf : hi;
      px(cx + q[0] + s, base + q[1], 6, 10, c);
      px(cx + q[0] + s, base + q[1], 4, 4, hi);
      px(cx + q[0] + s + 2, base + q[1] + 6, 4, 4, dk);
    });
    if (stage === 4){
      px(cx - 6, base - 4, 14, 8, fruit); px(cx - 4, base + 4, 10, 2, fruit);
      px(cx - 6, base - 4, 6, 4, fhi); px(cx + 2, base, 6, 4, fdk);
      px(cx - 2, base + 6, 4, 2, shade(fruit, -50));
    }
  } else if (sh === 'head'){
    // 배추·양배추 — 겉잎이 감싸고 속이 차오른다
    blob(cx + s, base - 18, 24, 18, leaf, hi, dk, 'h' + crop, px);
    px(cx - 12 + s, base - 8, 6, 6, dk); px(cx + 8 + s, base - 10, 6, 6, dk);
    if (stage === 4){
      blob(cx + s, base - 24, 26, 24, fruit, fhi, fdk, 'i' + crop, px);
      px(cx - 2 + s, base - 22, 2, 18, shade(fruit, -18)); px(cx + 4 + s, base - 20, 2, 14, shade(fruit, -18));
      px(cx - 12 + s, base - 6, 8, 6, leaf); px(cx + 6 + s, base - 8, 8, 6, dk);
    }
  } else if (sh === 'bush'){
    px(cx - 10 + s, base - 14, 22, 14, leaf); px(cx - 8 + s, base - 18, 18, 4, leaf);
    px(cx - 8 + s, base - 18, 8, 2, hi); px(cx - 10 + s, base - 12, 4, 4, hi);
    px(cx + 6 + s, base - 16, 4, 12, dk); px(cx - 10 + s, base - 4, 6, 2, dk); px(cx + 4 + s, base - 2, 6, 2, dk);
    if (stage === 4){
      const spots = [[-6, -12], [2, -16], [0, -6], [6, -10], [-8, -6]];
      spots.forEach(([a, b], i) => { px(cx + a + s, base + b, 4, 4, fruit); px(cx + a + s, base + b, 2, 2, fhi); px(cx + a + 2 + s, base + b + 2, 2, 2, fdk); });
    }
  } else if (sh === 'tall'){
    px(cx, base - 26, 2, 26, stem); px(cx + 2, base - 26, 2, 26, shade(stem, -14));
    [[-10, -20], [2, -16], [-8, -10], [2, -8], [-8, -24]].forEach(([a, b], i) => {
      const q = i % 2 ? s : -s;
      px(cx + a + q, base + b, 10, 2, i % 2 ? leaf : hi); px(cx + a + q, base + b + 2, 8, 2, dk);
    });
    px(cx - 2 + s, base - 30, 8, 4, leaf); px(cx - 2 + s, base - 30, 4, 2, hi);
    if (stage === 4){ px(cx + 2, base - 22, 6, 12, fruit); px(cx + 2, base - 24, 6, 2, fhi); px(cx + 2, base - 22, 2, 10, fhi); px(cx + 6, base - 18, 2, 8, fdk); px(cx + 4, base - 24, 2, 2, hi); }
  } else if (sh === 'vine'){
    px(cx - 2, base - 26, 2, 26, '#8a5f3a'); px(cx, base - 26, 2, 26, '#6f4a2c');
    [[-10, -22], [2, -18], [-10, -12], [2, -8], [-6, -26]].forEach(([a, b], i) => {
      const q = i % 2 ? s : -s;
      px(cx + a + q, base + b, 8, 2, leaf); px(cx + a + q, base + b - 2, 4, 2, hi); px(cx + a + q + 2, base + b + 2, 4, 2, dk);
    });
    if (stage === 4){
      [[-10, -18], [4, -14], [-8, -8], [2, -24]].forEach(([a, b]) => { px(cx + a, base + b, 6, 6, fruit); px(cx + a, base + b, 2, 2, fhi); px(cx + a + 4, base + b + 4, 2, 2, fdk); });
    }
  } else if (sh === 'flower'){
    px(cx + Math.round(s / 2), base - 20, 2, 20, stem);
    px(cx - 6 + s, base - 12, 6, 2, leaf); px(cx - 6 + s, base - 14, 4, 2, hi); px(cx + 2 + s, base - 10, 6, 2, leaf); px(cx + 6 + s, base - 8, 2, 2, dk);
    if (stage === 4){
      const fx = cx + s, fy = base - 14;
      px(fx - 6, fy + 4, 14, 8, fruit); px(fx - 4, fy + 2, 10, 2, fruit); px(fx - 4, fy + 12, 10, 2, fruit);
      px(fx - 6, fy + 4, 6, 4, fhi); px(fx + 2, fy + 8, 6, 4, fdk);
      px(fx - 2, fy + 6, 4, 4, '#ffe06e'); px(fx - 2, fy + 6, 2, 2, '#fff3c0');
    } else { px(cx + s, base - 24, 4, 6, leaf); px(cx + s, base - 24, 2, 2, hi); }
  } else if (sh === 'melon'){
    px(cx - 14 + s, base - 6, 28, 4, leaf); px(cx - 14 + s, base - 6, 10, 2, hi);
    px(cx - 12 + s, base - 12, 8, 6, leaf); px(cx + 4 + s, base - 14, 8, 6, leaf); px(cx + 4 + s, base - 14, 4, 2, hi);
    px(cx - 2, base - 8, 4, 2, dk);
    if (stage === 4){
      px(cx - 8, base - 16, 18, 16, fruit); px(cx - 6, base - 18, 14, 2, fruit); px(cx - 6, base + 0, 14, 2, fruit);
      px(cx - 6, base - 16, 6, 6, fhi); px(cx + 4, base - 8, 4, 8, fdk);
      px(cx - 2, base - 18, 2, 4, '#6f4a2c'); px(cx - 2, base - 16, 2, 16, shade(fruit, -14)); px(cx + 2, base - 14, 2, 12, shade(fruit, -14));
    }
  }
}
function drawGiant(id, p, sway){
  const a = R.parseId(id), b = R.parseId(p.pairOf);
  const X = Math.min(a.x, b.x) * T, Y = Math.min(a.y, b.y) * T;
  const w = (Math.abs(a.x - b.x) + 1) * T, hgt = (Math.abs(a.y - b.y) + 1) * T;
  const C = R.CROPS[p.crop], st = R.stageOf(p), s = sway || 0;
  const leaf = C.leaf, hi = shade(leaf, 24), dk = shade(leaf, -30);
  const fruit = C.fruit, fhi = shade(fruit, 30), fdk = shade(fruit, -34);
  const cx = X + w / 2, base = Y + hgt - 2;
  px(X + 4, base - 2, w - 8, 2, '#00000020');
  px(X + 6 + s, base - 8, w - 12, 4, leaf); px(X + 6 + s, base - 8, 12, 2, hi);
  px(X + 10 + s, base - 16, 12, 8, leaf); px(X + w - 22 + s, base - 18, 12, 8, leaf); px(X + w - 22 + s, base - 18, 6, 2, hi);
  if (st >= 4){
    const r = Math.min(w, hgt) / 2 - 2;
    px(cx - r, base - r * 1.7, r * 2, r * 1.7, fruit);
    px(cx - r + 4, base - r * 1.7 - 4, r * 2 - 8, 4, fruit);
    px(cx - r + 4, base - r * 1.6, 8, r * 0.9, fhi);
    px(cx + r - 12, base - r * 1.3, 6, r, fdk);
    px(cx - 2, base - r * 1.7 - 10, 4, 8, '#6f4a2c'); px(cx - 6, base - r * 1.7 - 8, 6, 2, dk);
  } else if (st >= 2){ px(cx - 10, base - 20, 20, 16, shade(leaf, -12)); px(cx - 10, base - 20, 8, 4, leaf); }
  if (p.pulls && p.pulls.length) p.pulls.forEach((who, i) => { const c = who === 'sua' ? '#ff7f8a' : '#6cc7b3'; px(X + 6 + i * 20, Y + 6, 12, 12, c); px(X + 6 + i * 20, Y + 6, 6, 4, shade(c, 26)); });
}

// ---------- 흩뿌려 섞기 ----------
// 색을 하나 더 만드는 대신 두 색을 규칙적으로 번갈아 찍으면 눈이 중간 색으로 읽는다.
// 도트 그림에서 단을 늘리는 가장 싼 방법이고, 담아 두는 겹 안에서만 쓰므로
// 매 장 드는 값은 없다. 순서표(BAYER)를 쓰면 얼룩이 뭉치지 않고 고르게 퍼진다.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ditherRow(X, Y, w, c, amt, row, P){
  const put = P || pxMap;
  const th = Math.round(Math.max(0, Math.min(1, amt)) * 16);
  if (th <= 0) return;
  const r4 = ((row % 4) + 4) % 4;
  for (let x = 0; x < w; x++){
    if (BAYER[r4 * 4 + (((X + x) % 4) + 4) % 4] < th) put(X + x, Y, 1, 1, c);
  }
}
function ditherRect(X, Y, w, h, c, amt, P){
  for (let y = 0; y < h; y++) ditherRow(X, Y + y, w, c, amt, Y + y, P);
}

// ---------- 건물 ----------
// 밤에 불이 켜지는 자리는 여기에 모아 둔다. 바탕을 그릴 때 채우고, 어두워지면 그 위에 빛을 얹는다.
let lamps = [];
function lamp(x, y, r, c){ lamps.push({ x, y, r, c: c || '#ffcf7a' }); }
// 널빤지 벽 — 같은 색을 통으로 칠하지 않고 판자 결과 못 자국을 넣는다.
function planks(X, Y, w, h, base){
  px(X, Y, w, h, base);
  // 아래로 갈수록 조금씩 어둡게 — 벽이 판판한 색종이처럼 보이지 않는다
  for (let y = 0; y < h; y++){
    const t = h > 1 ? y / (h - 1) : 0;
    if (t > 0.3) ditherRow(X, Y + y, w, shade(base, -12), (t - 0.3) * 1.1, Y + y);
  }
  for (let i = 0; i < h; i += 8){ px(X, Y + i, w, 2, shade(base, 12)); px(X, Y + i + 6, w, 2, shade(base, -16)); }
  for (let i = 12; i < w; i += 22) px(X + i, Y, 2, h, shade(base, -22));
}
// 지붕 — 기와를 한 줄씩 어긋나게
function roof(X, Y, w, h, base){
  // 다섯 단. 위는 하늘을 보아 밝고 처마로 갈수록 어둡다. 단과 단 사이는 흩뿌려 섞어
  // 줄무늬처럼 끊기지 않게 한다.
  const tone = d => shade(base, 20 - d * 12);
  for (let i = 0; i < h; i++){
    const t = h > 1 ? i / (h - 1) : 0;
    const lv = t * 4, k = Math.min(3, Math.floor(lv)), f = lv - k;
    const rowX = X - i, rowW = w + i * 2;
    px(rowX, Y + i, rowW, 2, tone(k));
    if (f > 0.04) ditherRow(rowX, Y + i, rowW, tone(k + 1), f, i);
    if (i % 2) ditherRow(rowX, Y + i, rowW, shade(base, -22), 0.4, i + 4);      // 기와 결
    for (let j = (i % 2) * 8; j < rowW; j += 16) px(rowX + j, Y + i, 2, 2, shade(base, -32));
  }
  px(X - h + 2, Y + h, w + h * 2 - 4, 4, shade(base, -36));
  px(X, Y, w, 2, shade(base, 30));
}
function window4(X, Y, w, h, on){
  px(X - 2, Y - 2, w + 4, h + 4, WOOD.dark);
  px(X, Y, w, h, on ? '#ffd98a' : '#8fc7e0');
  px(X, Y, w, Math.max(2, h / 3), on ? '#ffeec0' : '#bfe4f7');
  px(X + w / 2 - 1, Y, 2, h, WOOD.dark); px(X, Y + h / 2 - 1, w, 2, WOOD.dark);
  if (on) lamp(X + w / 2, Y + h / 2, 24);
}
function drawHouse(night){
  const b = spot('house'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
  px(X + 6, Y + h - 6, w - 12, 6, '#00000018');
  // 돌 기단
  px(X + 8, Y + h - 24, w - 16, 20, STONE.mid);
  for (let i = 0; i < w - 16; i += 14){ px(X + 8 + i, Y + h - 24, 2, 20, STONE.low); px(X + 8 + i + 4, Y + h - 16, 8, 2, STONE.hi); }
  // 벽
  planks(X + 10, Y + 32, w - 20, h - 52, '#f6ddc9');
  px(X + 10, Y + 32, w - 20, 2, '#fff1e2');
  px(X + 10, Y + h - 24, w - 20, 2, WOOD.line);
  // 지붕
  roof(X + 16, Y + 8, w - 32, 26, '#e0736e');
  px(X + 16, Y + 4, w - 32, 6, '#c95a58');
  // 굴뚝
  px(X + w - 40, Y - 4, 14, 20, STONE.low); px(X + w - 40, Y - 4, 14, 4, STONE.hi); px(X + w - 38, Y + 2, 10, 2, STONE.dark);
  // 문
  const dx = X + w / 2 - 10;
  px(dx - 2, Y + h - 50, 24, 50, WOOD.line);
  px(dx, Y + h - 48, 20, 48, WOOD.mid);
  for (let i = 0; i < 48; i += 10) px(dx, Y + h - 48 + i, 20, 2, WOOD.low);
  px(dx + 14, Y + h - 28, 4, 4, '#ffd166');
  px(dx, Y + h - 48, 2, 48, WOOD.hi);
  // 창문 둘
  window4(X + 24, Y + 44, 20, 18, night);
  window4(X + w - 44, Y + 44, 20, 18, night);
  // 화분
  px(X + 12, Y + h - 16, 10, 12, '#c97a5a'); px(X + 12, Y + h - 18, 10, 2, '#e09a76'); px(X + 14, Y + h - 26, 6, 8, '#6fb567'); px(X + 16, Y + h - 30, 4, 4, '#ff9ec4');
}
function drawMail(){
  const b = spot('mail'), X = b.x * T, Y = b.y * T;
  px(X + 14, Y + 28, 4, 4, '#00000020');
  px(X + 14, Y + 12, 4, 18, WOOD.dark);
  px(X + 6, Y + 4, 20, 14, '#e0736e'); px(X + 6, Y + 4, 20, 2, '#f28f88'); px(X + 6, Y + 16, 20, 2, '#a94b4a');
  px(X + 8, Y + 8, 16, 6, '#fff1e2');
  px(X + 24, Y + 6, 4, 8, '#ffd166');
  if (key && (W.mail[key] || []).length){ px(X + 24, Y + 2, 4, 12, '#ff5a4a'); px(X + 24, Y + 2, 4, 4, '#ff8f80'); }
}
function drawBoard(){
  const b = spot('board'), X = b.x * T, Y = b.y * T;
  px(X + 8, Y + 30, 16, 2, '#00000020');
  px(X + 8, Y + 18, 4, 14, WOOD.dark); px(X + 20, Y + 18, 4, 14, WOOD.dark);
  px(X + 4, Y + 2, 24, 20, WOOD.low); px(X + 4, Y + 2, 24, 2, WOOD.hi);
  px(X + 6, Y + 4, 20, 16, '#fff6e9');
  px(X + 8, Y + 6, 14, 2, '#8a7a63'); px(X + 8, Y + 10, 10, 2, '#8a7a63'); px(X + 8, Y + 14, 12, 2, '#8a7a63');
  px(X + 22, Y + 12, 4, 6, '#ff9ec4');
}
function drawStall(cal){
  const b = spot('stall'), X = b.x * T, Y = b.y * T, w = b.w * T;
  px(X + 6, Y + b.h * T - 6, w - 12, 6, '#00000018');
  // 차양
  // 줄무늬가 차양 밖으로 삐져나가지 않게 바탕을 먼저 깔고 그 위에 빨간 줄만 얹는다
  px(X + 4, Y + 6, w - 8, 12, '#fff6e9');
  for (let i = 0; i < w - 8; i += 16) px(X + 4 + i, Y + 6, Math.min(8, w - 8 - i), 12, '#f2857a');
  px(X + 4, Y + 4, w - 8, 4, '#c95a58');
  for (let i = 0; i < w - 8; i += 8) px(X + 4 + i, Y + 18, 4, 2, '#c95a58');
  // 좌판
  planks(X + 8, Y + 20, w - 16, 16, WOOD.mid);
  px(X + 6, Y + 36, w - 12, 6, WOOD.dark); px(X + 6, Y + 36, w - 12, 2, WOOD.hi);
  px(X + 12, Y + 42, 4, 20, WOOD.dark); px(X + w - 16, Y + 42, 4, 20, WOOD.dark);
  // 좌판 위 물건 — 계절 색으로
  const goods = { spring: ['#ff5c6b', '#ffe066', '#8fd66c'], summer: ['#3f9a4b', '#ff5a4a', '#ffcf3d'], autumn: ['#ff9a2e', '#8a5cc7', '#e8f2c0'], winter: ['#eef8ff', '#4fa653', '#e8f4ee'] }[cal.season];
  goods.forEach((c, i) => { const gx = X + 14 + i * 17; px(gx, Y + 22, 12, 10, c); px(gx, Y + 22, 12, 2, shade(c, 26)); px(gx + 8, Y + 28, 4, 4, shade(c, -28)); });
  // 가게 아저씨 — 좌판에 기대선 모습. 어깨 아래는 좌판에 가린다.
  art(SHOPKEEP, X + w - 32, Y + 18, SHOPPAL, false);
}
function drawWell(night){
  const b = spot('well'), X = b.x * T, Y = b.y * T;
  if (!here('well')){ ghost(X, Y, T, T); return; }
  px(X + 4, Y + 28, 24, 4, '#00000018');
  px(X + 4, Y + 14, 24, 16, STONE.mid);
  for (let i = 0; i < 24; i += 8){ px(X + 4 + i, Y + 14, 2, 16, STONE.low); }
  px(X + 4, Y + 14, 24, 2, STONE.hi);
  px(X + 8, Y + 16, 16, 6, '#4f9ad6'); px(X + 8, Y + 16, 16, 2, '#8fd0f0');
  px(X + 6, Y + 2, 4, 14, WOOD.dark); px(X + 22, Y + 2, 4, 14, WOOD.dark);
  px(X + 4, Y - 2, 24, 6, '#e0736e'); px(X + 4, Y - 2, 24, 2, '#f28f88');
  px(X + 14, Y + 6, 4, 6, WOOD.low);
}
function drawGreenhouse(night){
  const b = spot('greenhouse'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
  if (!here('greenhouse')){ ghost(X, Y, w, h); return; }
  px(X + 8, Y + h - 6, w - 16, 6, '#00000018');
  // 유리벽
  px(X + 8, Y + 24, w - 16, h - 36, '#c3e6f6');
  for (let i = 0; i < w - 16; i += 18) px(X + 8 + i, Y + 24, 2, h - 36, '#8fc7e0');
  for (let i = 0; i < h - 36; i += 20) px(X + 8, Y + 24 + i, w - 16, 2, '#8fc7e0');
  // 유리 반사
  px(X + 16, Y + 28, 6, h - 48, '#eaf6ff'); px(X + 40, Y + 32, 4, h - 56, '#ffffff88');
  // 지붕
  roof(X + 12, Y + 8, w - 24, 16, '#dff0f8');
  px(X + 12, Y + 6, w - 24, 4, '#a9d3e8');
  // 안 — 화분 줄과 자라는 것들이 유리 너머로 비친다
  const shelfY = Y + h - 40;
  px(X + 12, shelfY, w - 24, 6, WOOD.low); px(X + 12, shelfY, w - 24, 2, WOOD.hi);
  for (let i = 0; i < 4; i++){
    const gx = X + 18 + i * 26;
    px(gx, shelfY - 10, 14, 10, '#c97a5a'); px(gx, shelfY - 12, 14, 2, '#e09a76');   // 화분
    blob(gx + 6, shelfY - 26, 18, 16, ['#5da05a', '#4f9a58', '#6aab5e', '#57a06b'][i], '#8ad07a', '#3c7a44', 'gh' + i);
    if (i % 2) px(gx + 4, shelfY - 24, 4, 4, '#ff9ec4'); else px(gx + 8, shelfY - 22, 4, 4, '#ffd166');
  }
  // 세로 골조
  for (let i = 0; i <= w - 16; i += Math.round((w - 16) / 4)) px(X + 8 + i, Y + 24, 4, h - 36, '#a9d3e8');
  px(X + 8, Y + h - 16, w - 16, 4, '#8fc7e0');
  if (night) lamp(X + w / 2, Y + h / 2 + 8, 26, '#cfeccf');
}
function drawCoop(night){
  const b = spot('coop'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
  if (!here('coop')){ ghost(X, Y, w, h); return; }
  px(X + 6, Y + h - 6, w - 12, 6, '#00000018');
  planks(X + 6, Y + 24, w - 12, h - 32, '#f0d3a4');
  roof(X + 10, Y + 8, w - 20, 18, '#e0736e');
  px(X + w / 2 - 8, Y + h - 32, 16, 24, WOOD.dark); px(X + w / 2 - 6, Y + h - 30, 12, 22, '#4b3527');
  window4(X + 10, Y + 32, 12, 10, night);
  px(X + w - 22, Y + 32, 12, 12, WOOD.low); px(X + w - 22, Y + 32, 12, 2, WOOD.hi);
  px(X + w / 2 - 16, Y + 2, 4, 10, WOOD.dark); px(X + w / 2 - 20, Y + 0, 12, 4, '#ff5a4a');
}
function drawBarn(night){
  const b = spot('barn'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
  if (!here('barn')){ ghost(X, Y, w, h); return; }
  px(X + 8, Y + h - 6, w - 16, 6, '#00000018');
  planks(X + 8, Y + 32, w - 16, h - 40, '#cf5450');
  px(X + 8, Y + 32, w - 16, 2, '#e8736e');
  roof(X + 14, Y + 10, w - 28, 24, '#8a3a36');
  // 흰 테두리 무늬
  px(X + 12, Y + 36, w - 24, 4, '#fff1e2');
  px(X + 12, Y + 36, 4, h - 44, '#fff1e2'); px(X + w - 16, Y + 36, 4, h - 44, '#fff1e2');
  // 큰 문
  const dw = 36, dx = X + w / 2 - dw / 2;
  px(dx, Y + h - 48, dw, 44, '#fff1e2');
  px(dx + 4, Y + h - 44, dw - 8, 40, WOOD.mid);
  for (let i = 0; i < 40; i += 8) px(dx + 4, Y + h - 44 + i, dw - 8, 2, WOOD.low);
  px(dx + dw / 2 - 2, Y + h - 44, 4, 40, '#fff1e2');
  // 다락 창
  px(X + w / 2 - 8, Y + 16, 16, 14, WOOD.line); px(X + w / 2 - 6, Y + 18, 12, 10, night ? '#ffd98a' : '#4b3527');
  if (night) lamp(X + w / 2, Y + 22, 28);
  if (night) window4(X + 20, Y + 48, 14, 12, true); else window4(X + 20, Y + 48, 14, 12, false);
}
function drawPethouse(night){
  const b = spot('pethouse'), X = b.x * T, Y = b.y * T;
  if (!here('pethouse')){ ghost(X, Y, T, T); return; }
  px(X + 4, Y + 28, 24, 4, '#00000018');
  px(X + 4, Y + 12, 24, 18, WOOD.mid); px(X + 4, Y + 12, 24, 2, WOOD.hi);
  for (let i = 0; i < 18; i += 6) px(X + 4, Y + 12 + i, 24, 2, WOOD.low);
  roof(X + 6, Y + 2, 20, 10, '#5aa9e6');
  px(X + 12, Y + 18, 10, 12, '#3a2f26');
  px(X + 10, Y + 16, 14, 2, WOOD.dark);
  if (night) lamp(X + 16, Y + 22, 20);
}
// 목장 — 울타리 친 풀밭. 여물통과 물통, 진창 하나.
function drawPasture(season){
  const b = spot('pasture'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
  if (!here('pasture')){ ghost(X, Y, w, h); return; }
  // 안쪽 풀은 조금 더 진하게 — 여기가 목장이라는 게 한눈에
  const P = GROUND[season];
  px(X + 4, Y + 4, w - 8, h - 8, shade(P.g[2], -8));
  // 밟혀 풀이 눕고 흙이 드러난 자리 — 얼룩을 좌표 난수로 깔아 밋밋함을 없앤다
  for (let dy = 4; dy < h - 4; dy += 4) for (let dx = 4; dx < w - 4; dx += 4){
    const v = noise2b(X + dx, Y + dy, 14, 6, 'pg');
    if (v > 0.7) px(X + dx, Y + dy, 4, 4, shade(P.g[1], -6));
    else if (v < 0.24) px(X + dx, Y + dy, 4, 4, mix(shade(P.g[2], -18), P.dry, 0.35));
  }
  // 짐승이 다니는 길 — 가운데가 닳아 흙빛
  for (let dx = 12; dx < w - 12; dx += 4){
    const wob = Math.round(Math.sin(dx / 18) * 8 + Math.sin(dx / 7) * 3);
    const road = mix(shade(P.g[2], -22), '#836448', 0.7);
    ditherRow(X + dx, Y + h / 2 + wob, 4, road, 0.6, dx);
    ditherRow(X + dx, Y + h / 2 + wob + 4, 4, road, 0.3, dx + 2);
  }
  for (let i = 0; i < 90; i++){
    const rr = R.prand('pa' + i), r2 = R.prand('pb' + i);
    px(X + 6 + Math.floor(rr * (w - 14)), Y + 6 + Math.floor(r2 * (h - 14)), 2, 4, P.tuft[i % 2]);
  }
  // 울타리
  const post = (px1, py1) => { px(px1, py1 - 16, 4, 20, WOOD.dark); px(px1, py1 - 16, 2, 20, WOOD.mid); px(px1, py1 - 18, 4, 2, WOOD.hi); };
  px(X + 2, Y + 2, w - 4, 2, WOOD.mid); px(X + 2, Y + 8, w - 4, 2, WOOD.low);
  px(X + 2, Y + h - 10, w - 4, 2, WOOD.mid); px(X + 2, Y + h - 4, w - 4, 2, WOOD.low);
  px(X + 2, Y + 2, 2, h - 4, WOOD.mid); px(X + 8, Y + 2, 2, h - 4, WOOD.low);
  px(X + w - 4, Y + 2, 2, h - 4, WOOD.mid); px(X + w - 10, Y + 2, 2, h - 4, WOOD.low);
  for (let i = 0; i < w; i += T){ post(X + i, Y + 12); post(X + i, Y + h - 2); }
  for (let i = T; i < h - T; i += T){ post(X + 2, Y + i); post(X + w - 6, Y + i); }
  // 문 — 아래쪽 가운데를 비워 둔다
  px(X + w / 2 - 16, Y + h - 12, 32, 12, shade(P.g[2], -8));
  // 여물통
  px(X + 12, Y + h - 44, 32, 12, WOOD.low); px(X + 12, Y + h - 44, 32, 2, WOOD.hi); px(X + 14, Y + h - 40, 28, 6, '#c9a227'); px(X + 16, Y + h - 40, 10, 2, '#e8c94e');
  // 물통
  px(X + w - 36, Y + h - 40, 20, 16, STONE.mid); px(X + w - 36, Y + h - 40, 20, 2, STONE.hi); px(X + w - 34, Y + h - 36, 16, 8, '#4f9ad6'); px(X + w - 34, Y + h - 36, 16, 2, '#8fd0f0');
  // 진창
  px(X + 16, Y + 24, 28, 14, '#8a6a4a'); px(X + 20, Y + 26, 20, 8, '#6f5238');
  // 건초 더미
  px(X + w - 40, Y + 20, 24, 18, '#e0c268'); px(X + w - 40, Y + 20, 24, 2, '#f2da8a');
  for (let i = 0; i < 24; i += 6) px(X + w - 40 + i, Y + 22, 2, 16, '#c9a94e');
}
function drawHive(){
  const b = spot('hive'), X = b.x * T, Y = b.y * T;
  if (!here('hive')){ ghost(X, Y, T, T); return; }
  px(X + 6, Y + 28, 20, 4, '#00000018');
  px(X + 6, Y + 6, 20, 22, '#f2c96b');
  for (let i = 0; i < 22; i += 6){ px(X + 6, Y + 6 + i, 20, 2, '#c99f47'); px(X + 6, Y + 8 + i, 20, 2, '#ffdd8f'); }
  px(X + 4, Y + 4, 24, 4, '#c99f47'); px(X + 4, Y + 4, 24, 2, '#ffe3a0');
  px(X + 14, Y + 24, 6, 4, '#3a2f26');
  if (W.buildings.hive && W.buildings.hive.honey){ px(X + 22, Y + 0, 8, 8, '#ffb43d'); px(X + 22, Y + 0, 4, 4, '#ffe08a'); }
}
function drawScarecrow(){
  if (!here('scarecrow')) return;
  const b = spot('scarecrow'), X = b.x * T, Y = b.y * T;
  px(X + 10, Y + 30, 12, 2, '#00000020');
  px(X + 14, Y + 10, 4, 22, WOOD.dark);
  px(X + 4, Y + 14, 24, 4, WOOD.low); px(X + 4, Y + 14, 24, 2, WOOD.hi);
  px(X + 8, Y + 16, 16, 12, '#c96b3a'); px(X + 8, Y + 16, 16, 2, '#e08a52');
  px(X + 10, Y + 4, 12, 10, '#f2da8a'); px(X + 10, Y + 4, 12, 2, '#fff0b8');
  px(X + 8, Y + 2, 16, 4, WOOD.mid); px(X + 6, Y + 4, 20, 2, WOOD.low);
  px(X + 12, Y + 8, 2, 2, '#3a3226'); px(X + 18, Y + 8, 2, 2, '#3a3226'); px(X + 14, Y + 12, 4, 2, '#c9646b');
}
function ghost(X, Y, w, h){
  for (let i = 0; i < w; i += 10) for (let j = 0; j < h; j += 10) px(X + i + 4, Y + j + 4, 4, 4, '#00000014');
  px(X + 4, Y + 4, w - 8, 2, '#00000018'); px(X + 4, Y + h - 6, w - 8, 2, '#00000018');
  px(X + 4, Y + 4, 2, h - 8, '#00000018'); px(X + w - 6, Y + 4, 2, h - 8, '#00000018');
}
// ---------- 꾸미개 ----------
function drawDecor(season, night){
  const d = W.decor || {};
  if (d.path){
    const b = spot('path'), Y = b.y * T;
    for (let x = 0; x < b.w; x++){
      const X = (b.x + x) * T;
      const pc = season === 'winter' ? '#dcd6c8' : '#e6d7b5';
      px(X, Y + 10, T, 14, pc);
      grainy(X, Y + 10, T, 14, pc, 'stone', 'ph' + x);
      (season === 'winter' ? ['#ffffff', '#eaf6ff'] : season === 'autumn' ? ['#e8874a', '#f2c14e', '#d9603c', '#c9a8ff'] : ['#ffb7d5', '#fff3a0', '#ffffff', '#c9a8ff']).forEach((c, i) => {
        const fx = X + 4 + i * 8, fy = Y + 8 + (i % 2) * 12;
        px(fx, fy + 4, 2, 4, '#6fb567'); px(fx, fy, 2, 2, c); px(fx - 2, fy + 2, 6, 2, c); px(fx, fy + 4, 2, 2, c);
      });
    }
  }
  if (d.pond){
    const b = spot('pond'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    const ice = season === 'winter';
    px(X + 4, Y + 8, w - 8, h - 16, ice ? '#a9c9d9' : '#3f86c4');
    px(X + 8, Y + 12, w - 16, h - 24, ice ? '#d3e6ef' : '#5aa9e6');
    px(X + 12, Y + 16, w - 28, 6, ice ? '#f0f8fc' : '#8fd0f0');
    // 돌 테두리
    for (let i = 0; i < w - 8; i += 12){
      px(X + 4 + i, Y + 4, 10, 6, STONE.mid); grainy(X + 4 + i, Y + 4, 10, 6, STONE.mid, 'stone', 'pk' + i);
      px(X + 4 + i, Y + 4, 10, 2, STONE.hi);
      px(X + 4 + i, Y + h - 12, 10, 6, STONE.low); grainy(X + 4 + i, Y + h - 12, 10, 6, STONE.low, 'stone', 'pl' + i);
    }
    // 잔물결 — 물이 한 덩어리로 안 보이게
    if (!ice) for (let i = 12; i < w - 20; i += 14) for (let j = 14; j < h - 22; j += 10)
      if (noise2(X + i, Y + j, 3, 'pw') > 0.55) px(X + i, Y + j, 8, 2, '#7dc2ea');
    if (ice){ px(X + 14, Y + 24, 18, 2, '#ffffff'); px(X + 24, Y + 18, 2, 14, '#ffffff'); px(X + 32, Y + 32, 12, 2, '#eaf6ff'); }
    else { px(X + 16, Y + h - 28, 12, 8, '#4f9a58'); px(X + 18, Y + h - 30, 6, 2, '#6fb567'); px(X + 20, Y + h - 34, 6, 6, '#ff9ec4'); }
  }
  if (d.fountain){
    const b = spot('fountain'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    px(X + 6, Y + h - 8, w - 12, 4, '#00000018');
    px(X + 6, Y + h - 32, w - 12, 26, STONE.mid);
    grainy(X + 6, Y + h - 32, w - 12, 26, STONE.mid, 'stone', 'fn');
    for (let i = 0; i < w - 12; i += 12) px(X + 6 + i, Y + h - 32, 2, 26, STONE.low);
    px(X + 6, Y + h - 32, w - 12, 2, STONE.hi);
    px(X + 10, Y + h - 28, w - 20, 16, '#4f9ad6'); px(X + 10, Y + h - 28, w - 20, 4, '#8fd0f0');
    px(X + w / 2 - 4, Y + 12, 8, 28, STONE.low); px(X + w / 2 - 4, Y + 12, 4, 28, STONE.hi);
    px(X + w / 2 - 10, Y + 8, 20, 6, STONE.mid); px(X + w / 2 - 10, Y + 8, 20, 2, STONE.hi);
    if (night) lamp(X + w / 2, Y + h - 20, 20, '#9ed6ff');
  }
  if (d.lantern){
    const b = spot('lantern'), X = b.x * T, Y = b.y * T;
    px(X + 12, Y + 30, 8, 2, '#00000022');
    px(X + 14, Y + 14, 4, 16, WOOD.dark); px(X + 14, Y + 14, 2, 16, WOOD.low);
    px(X + 8, Y + 4, 16, 12, '#e8574f'); px(X + 8, Y + 4, 16, 2, '#ff8a80'); px(X + 8, Y + 14, 16, 2, '#a83a36');
    px(X + 12, Y + 8, 8, 4, '#ffe9a8');
    px(X + 10, Y + 2, 12, 2, WOOD.dark); px(X + 10, Y + 16, 12, 2, WOOD.dark);
    if (night) lamp(X + 16, Y + 10, 26, '#ffc46a');
  }
  if (d.bench){
    const b = spot('bench'), X = b.x * T, Y = b.y * T, w = b.w * T;
    px(X + 6, Y + 28, w - 12, 2, '#00000022');
    px(X + 6, Y + 6, w - 12, 4, WOOD.mid); grainy(X + 6, Y + 6, w - 12, 4, WOOD.mid, 'wood', 'bn1');
    px(X + 6, Y + 12, w - 12, 4, WOOD.low); grainy(X + 6, Y + 12, w - 12, 4, WOOD.low, 'wood', 'bn2');   // 등받이
    px(X + 6, Y + 18, w - 12, 6, WOOD.mid); grainy(X + 6, Y + 18, w - 12, 6, WOOD.mid, 'wood', 'bn3');
    px(X + 6, Y + 18, w - 12, 2, WOOD.hi);        // 앉는 자리
    px(X + 8, Y + 6, 4, 22, WOOD.dark); px(X + w - 12, Y + 6, 4, 22, WOOD.dark);
    px(X + 14, Y + 24, 4, 6, WOOD.dark); px(X + w - 18, Y + 24, 4, 6, WOOD.dark);
  }
  if (d.swing){
    // 기둥만 바탕에. 흔들리는 자리는 움직이는 겹에서 그린다.
    const b = spot('swing'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    px(X + 6, Y + h - 6, w - 12, 4, '#00000022');
    px(X + 6, Y + 8, 6, h - 12, WOOD.dark); px(X + 6, Y + 8, 2, h - 12, WOOD.low);
    px(X + w - 12, Y + 8, 6, h - 12, WOOD.dark); px(X + w - 12, Y + 8, 2, h - 12, WOOD.low);
    px(X + 4, Y + 6, w - 8, 6, WOOD.mid); px(X + 4, Y + 6, w - 8, 2, WOOD.hi);
    px(X + 2, Y + 4, w - 4, 2, WOOD.low);
  }
  if (d.arch){
    const b = spot('arch'), X = b.x * T, Y = b.y * T, w = b.w * T;
    px(X + 6, Y + 30, w - 12, 2, '#00000022');
    px(X + 6, Y + 8, 4, 24, '#6f8f5a'); px(X + w - 10, Y + 8, 4, 24, '#6f8f5a');
    px(X + 6, Y + 4, w - 12, 6, '#6f8f5a'); px(X + 8, Y + 2, w - 16, 4, '#7fa066');
    for (let i = 0; i < 7; i++){
      const rx = X + 6 + Math.floor(R.prand('ar' + i) * (w - 12)), ry = Y + 2 + Math.floor(R.prand('as' + i) * 26);
      const c = i % 3 === 0 ? '#ffd6e6' : '#e8506a';
      px(rx, ry, 6, 6, c); px(rx, ry, 4, 2, shade(c, 26)); px(rx + 4, ry + 4, 2, 2, shade(c, -34));
    }
  }
  if (d.sandbox){
    const b = spot('sandbox'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    px(X + 4, Y + 6, w - 8, h - 12, '#e8d3a0');                                 // 모래
    grainy(X + 4, Y + 6, w - 8, h - 12, '#e8d3a0', 'stone', 'sb');
    for (let i = 0; i < w - 8; i += 12){                                        // 나무 테두리
      px(X + 4 + i, Y + 4, 12, 4, WOOD.mid); grainy(X + 4 + i, Y + 4, 12, 4, WOOD.mid, 'wood', 'sb1' + i);
      px(X + 4 + i, Y + h - 10, 12, 4, WOOD.low); grainy(X + 4 + i, Y + h - 10, 12, 4, WOOD.low, 'wood', 'sb2' + i);
    }
    px(X + 4, Y + 4, 4, h - 10, WOOD.low); px(X + w - 8, Y + 4, 4, h - 10, WOOD.low);
    px(X + 12, Y + h - 26, 12, 12, '#f2c14e');                                  // 쌓아 둔 모래성
    px(X + 12, Y + h - 28, 12, 3, '#ffd979'); px(X + 16, Y + h - 32, 4, 5, '#f2c14e');
    px(X + w - 22, Y + h - 22, 8, 6, '#5aa9e6'); px(X + w - 22, Y + h - 24, 8, 2, '#8fd0f0');   // 양동이
    px(X + w - 12, Y + h - 26, 2, 10, '#e8574f'); px(X + w - 14, Y + h - 28, 6, 3, '#e8574f'); // 삽
  }
  if (d.firepit){
    const b = spot('firepit'), X = b.x * T, Y = b.y * T;
    px(X + 6, Y + 22, 20, 4, '#00000022');
    for (let i = 0; i < 6; i++){                                                // 둘러놓은 돌
      const th = i / 6 * 6.283;
      const sx = X + 14 + Math.round(Math.cos(th) * 10), sy = Y + 16 + Math.round(Math.sin(th) * 6);
      px(sx, sy, 6, 5, STONE.mid); px(sx, sy, 6, 2, STONE.hi);
      grainy(sx, sy, 6, 5, STONE.mid, 'stone', 'fp' + i);
    }
    px(X + 10, Y + 14, 12, 5, '#4a3428');                                       // 재
    px(X + 11, Y + 9, 4, 9, WOOD.dark); px(X + 15, Y + 11, 8, 4, WOOD.low);     // 장작
    if (night) lamp(X + 16, Y + 14, 30, '#ffb055');
  }
  if (d.statue){
    const b = spot('statue'), X = b.x * T, Y = b.y * T, h = b.h * T;
    px(X + 4, Y + h - 6, 24, 4, '#00000018');
    px(X + 4, Y + h - 20, 24, 16, STONE.mid); px(X + 4, Y + h - 20, 24, 2, STONE.hi); px(X + 6, Y + h - 10, 20, 2, STONE.low);
    px(X + 10, Y + h - 44, 12, 24, STONE.low); px(X + 10, Y + h - 44, 4, 24, STONE.mid);
    const sx = X + 16, sy = Y + h - 60;
    px(sx - 2, sy, 6, 18, '#ffd979'); px(sx - 8, sy + 6, 18, 6, '#ffd979');
    px(sx - 6, sy + 2, 4, 4, '#ffe9a8'); px(sx + 4, sy + 10, 4, 4, '#e8b74a');
    if (night) lamp(sx, sy + 8, 22, '#ffe6a0');
  }
}
// 둥근 잎 덩어리 — 줄마다 너비를 달리해 네모로 보이지 않게 한다.
// 왼쪽 위는 빛을 받고 오른쪽 아래는 그늘이 진다. 도트 그림에서 이 두 줄이 입체를 만든다.
function blob(cx, cy, w, h, mid, hi, lo, seed, P){
  const px = P || pxMap;
  for (let r = 0; r < h; r++){
    const t = (r + 0.5) / h;
    const k = Math.sin(Math.PI * Math.pow(t, 0.8));
    let ww = Math.max(4, Math.round(w * (0.3 + 0.7 * k)));
    ww += Math.round((R.prand((seed || 'b') + r) - 0.5) * 4.8);   // 가장자리를 조금 울퉁불퉁하게
    const x0 = Math.round(cx - ww / 2);
    px(x0, cy + r, ww, 2, mid);
    const lit = Math.round(ww * (0.5 - t * 0.42));
    if (lit > 2 && t < 0.6){
      px(x0 + 2, cy + r, lit, 2, hi);
      // 밝은 데와 중간 사이를 두 도트쯤 흩뿌려 섞으면 단 경계가 안 보인다
      if (lit + 6 <= ww) ditherRow(x0 + 2 + lit, cy + r, 4, hi, 0.5, r, P);
    }
    const sh = Math.round(ww * (t - 0.45) * 0.9);
    if (sh > 2){
      px(x0 + ww - sh, cy + r, sh, 2, lo);
      if (ww - sh - 4 >= 0) ditherRow(x0 + ww - sh - 4, cy + r, 4, lo, 0.5, r, P);
    }
  }
}
// ---------- 나무·바위 ----------
function drawNode(n, season, t){
  const N = R.NODES[n], X = N.x * T, Y = N.y * T;
  const ready = W && M ? R.nodeReady(W, M, n, now()) : true;
  const sway = Math.round(Math.sin(t / 900 + N.x) * (curWind + 0.8));
  if (N.kind === 'tree'){
    footShade(X + 16, Y + 30, 26);
    if (!ready){
      // 벤 자리 — 그루터기와 나이테
      px(X + 8, Y + 18, 16, 14, WOOD.dark); px(X + 8, Y + 18, 6, 14, WOOD.low);
      px(X + 6, Y + 14, 20, 6, WOOD.mid); px(X + 6, Y + 14, 20, 2, WOOD.hi);
      px(X + 12, Y + 16, 8, 2, WOOD.low); px(X + 14, Y + 16, 4, 2, WOOD.line);
      return;
    }
    // 줄기 — 밑동이 넓고 위로 갈수록 좁다
    px(X + 6, Y + 26, 20, 6, WOOD.dark); px(X + 6, Y + 26, 8, 2, WOOD.low);
    px(X + 10, Y + 16, 12, 16, WOOD.dark); px(X + 10, Y + 16, 4, 16, WOOD.low);
    px(X + 12, Y + 4, 8, 16, WOOD.dark); px(X + 12, Y + 4, 2, 16, WOOD.low);
    px(X + 18, Y + 10, 2, 20, WOOD.line); px(X + 14, Y + 20, 2, 6, WOOD.line);
    // 가지
    px(X + 4, Y + 8, 8, 2, WOOD.dark); px(X + 20, Y + 12, 8, 2, WOOD.dark);
    const L = season === 'autumn' ? ['#f0a95c', '#dd7b3f', '#b85a2c']
            : season === 'winter' ? ['#b8ccbe', '#9db4a5', '#7d9488']
            : ['#8ad07a', '#63ad57', '#417c3d'];
    const s = sway;
    // 잎갓 — 큰 덩이 하나에 작은 덩이 둘을 겹쳐 둥글게
    blob(X + 16 + s, Y - 28, 48, 40, L[1], L[0], L[2], 't' + N.x);
    blob(X + 4 + s, Y - 18, 24, 22, L[1], L[0], L[2], 'u' + N.x);
    blob(X + 28 + s, Y - 20, 24, 24, L[1], L[0], L[2], 'v' + N.x);

    // 잎 결
    for (let i = 0; i < 9; i++){
      const rx = Math.round((R.prand('lx' + N.x + i) - 0.5) * 36), ry = Math.round(R.prand('ly' + N.x + i) * 34);
      px(X + 16 + rx + s, Y - 26 + ry, 4, 2, i % 2 ? L[2] : L[0]);
    }
    if (season === 'spring'){ [[-12, 4], [8, 2], [16, 16], [-6, 22], [2, 10]].forEach((q, i) => { const c = i % 2 ? '#ffd6e6' : '#ffb7d5'; px(X + 16 + q[0] + s, Y - 26 + q[1], 4, 4, c); px(X + 16 + q[0] + s, Y - 26 + q[1], 2, 2, '#fff2f7'); }); }
    if (season === 'summer'){ [[-10, 10], [10, 6], [0, 20]].forEach(q => { px(X + 16 + q[0] + s, Y - 26 + q[1], 4, 4, '#e8324a'); px(X + 16 + q[0] + s, Y - 26 + q[1], 2, 2, '#ff8a94'); }); }
    if (season === 'winter'){ px(X + 2 + s, Y - 26, 28, 4, '#ffffff'); px(X - 4 + s, Y - 16, 12, 2, '#f2f9ff'); px(X + 26 + s, Y - 18, 12, 2, '#f2f9ff'); }
    return;
  }
  if (N.kind === 'rock'){
    px(X + 6, Y + 28, 20, 2, '#00000020');
    if (!ready){ px(X + 10, Y + 22, 14, 6, STONE.low); px(X + 10, Y + 22, 10, 2, STONE.mid); return; }
    px(X + 4, Y + 12, 24, 16, STONE.low);
    px(X + 8, Y + 6, 16, 8, STONE.mid); px(X + 8, Y + 6, 10, 4, STONE.hi);
    px(X + 4, Y + 20, 10, 6, STONE.dark); px(X + 20, Y + 16, 6, 10, STONE.dark);
    px(X + 12, Y + 14, 6, 4, STONE.hi);
    px(X + 4, Y + 26, 24, 2, STONE.line);
    return;
  }
  if (N.kind === 'bush'){
    if (N.season.indexOf(season) < 0) return;
    px(X + 6, Y + 30, 20, 2, '#00000020');
    const s = Math.round(sway / 2);
    blob(X + 16 + s, Y + 6, 30, 26, '#3f7d3c', '#5fa155', '#2b5c2c', 'bs');
    for (let i = 0; i < 5; i++) px(X + 6 + s + Math.floor(R.prand('bl' + i) * 20), Y + 10 + Math.floor(R.prand('bm' + i) * 18), 4, 2, i % 2 ? '#5fa155' : '#2b5c2c');
    if (ready){ [[8, 16], [18, 12], [12, 24], [22, 20]].forEach(q => { px(X + q[0] + s, Y + q[1], 4, 4, '#e83a4a'); px(X + q[0] + s, Y + q[1], 2, 2, '#ff8a94'); px(X + q[0] + s + 2, Y + q[1] + 2, 2, 2, '#a81f30'); }); }
    return;
  }
  if (N.kind === 'snow'){
    if (season !== 'winter' || !ready) return;
    px(X + 6, Y + 28, 20, 2, '#00000018');
    px(X + 6, Y + 16, 20, 12, '#ffffff'); px(X + 10, Y + 8, 12, 10, '#f7fbff');
    px(X + 6, Y + 16, 20, 2, '#ffffff'); px(X + 8, Y + 24, 16, 2, '#dbe8ef');
    px(X + 12, Y + 12, 2, 2, '#3a3226'); px(X + 18, Y + 12, 2, 2, '#3a3226'); px(X + 14, Y + 16, 4, 2, '#ff8c2e');
  }
}

// ---------- 움직임 ----------
// 아이와 동물은 저마다 갈 곳을 하나 정해 그리로 걸어간다. 닿으면 잠깐 쉬었다가 새로 정한다.
// 자리는 규칙이 아니라 화면의 것이다 — 세이브에 적지 않는다.
let walkers = null, beasts = null, curWind = 0.6;
function walkableTile(tx, ty){
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS - 1) return false;   // 맨 아랫줄은 앞쪽 수풀에 가린다
  const FB = R.FIELD_BOX;
  if (tx >= FB.x && tx < FB.x + FB.w && ty >= FB.y && ty < FB.y + FB.h) return false;
  for (let i = 0; i < R.PLACE_IDS.length; i++){
    const id = R.PLACE_IDS[i];
    if (id === 'path' || !here(id)) continue;
    const b = spot(id);
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  for (const n in R.NODES){ const N = R.NODES[n]; if (N.x === tx && N.y === ty) return false; }
  return true;
}
function nearestWalkable(tx, ty){
  if (walkableTile(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r < 8; r++){
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (walkableTile(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
    }
  }
  return { x: 5, y: ROWS - 3 };
}
function someTile(){
  for (let i = 0; i < 60; i++){
    const tx = Math.floor(Math.random() * COLS), ty = Math.floor(Math.random() * ROWS);
    if (walkableTile(tx, ty)) return { x: tx, y: ty };
  }
  return { x: 5, y: ROWS - 3 };
}
// 갈 수 있는 칸을 미리 표로 만들어 둔다. 건물을 옮기거나 새로 지으면 다시 만든다.
let walkGrid = null, walkSig = '';
function ensureWalkGrid(){
  const sig = JSON.stringify(W.layout || {}) + Object.keys(W.buildings).filter(b => W.buildings[b].done).sort().join('') + (W.expand || 0) + Object.keys(W.decor || {}).sort().join('');
  if (walkGrid && walkSig === sig) return;
  walkSig = sig; walkGrid = [];
  for (let y = 0; y < ROWS; y++){ const row = []; for (let x = 0; x < COLS; x++) row.push(walkableTile(x, y)); walkGrid.push(row); }
}
// 너비 우선 — 240칸짜리 지도라서 넉넉하다. 건물을 뚫고 지나가지 않는다.
function pathFind(sx, sy, tx, ty){
  ensureWalkGrid();
  if (sx < 0 || sy < 0 || sx >= COLS || sy >= ROWS) return null;
  if (!walkGrid[ty] || !walkGrid[ty][tx]) return null;
  const idx = (x, y) => y * COLS + x;
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  const q = [[sx, sy]]; seen[idx(sx, sy)] = 1;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let head = 0; head < q.length; head++){
    const cx = q[head][0], cy = q[head][1];
    if (cx === tx && cy === ty) break;
    for (let d = 0; d < 4; d++){
      const nx = cx + D[d][0], ny = cy + D[d][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (!walkGrid[ny][nx] || seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1; prev[idx(nx, ny)] = idx(cx, cy); q.push([nx, ny]);
    }
  }
  if (!seen[idx(tx, ty)]) return null;
  const out = []; let cur = idx(tx, ty);
  while (cur !== idx(sx, sy) && cur >= 0){ out.unshift({ x: cur % COLS, y: Math.floor(cur / COLS) }); cur = prev[cur]; }
  return out;
}
// 동물이 노는 마당 — 목장이 있으면 목장 안, 없으면 집 앞 한 뼘.
function yardOf(kind){
  const need = R.ANIMALS[kind].need;
  if (need === 'pethouse') return null;                       // 강아지·고양이는 아이를 따라다닌다
  if (need === 'pasture' || (here('pasture') && need === 'barn')){
    const b = spot('pasture');
    return { x: b.x * T + 16, y: b.y * T + 20, w: b.w * T - 32, h: b.h * T - 40 };
  }
  return { home: spot(need) };     // 우리 둘레의 빈 칸에서 논다
}
// 건물 둘레에서 갈 수 있는 칸 하나 — 지붕 위에 서 있지 않도록
function nearTile(home, reach){
  const cand = [];
  for (let dy = -reach; dy <= home.h + reach; dy++) for (let dx = -reach; dx <= home.w + reach; dx++){
    const tx = home.x + dx, ty = home.y + dy;
    if (walkableTile(tx, ty)) cand.push({ x: tx * T + 16, y: ty * T + 24 });
  }
  return cand.length ? cand[Math.floor(Math.random() * cand.length)] : { x: home.x * T + 16, y: (home.y + home.h) * T + 24 };
}
function yardPoint(kind){
  const y = yardOf(kind);
  if (!y) return null;
  if (y.home) return nearTile(y.home, 2);
  return { x: y.x + Math.random() * y.w, y: y.y + Math.random() * y.h };
}
function inYard(y, p){ return { x: Math.max(y.x, Math.min(y.x + y.w, p.x)), y: Math.max(y.y, Math.min(y.y + y.h, p.y)) }; }
function ensureActors(){
  if (!walkers){
    const h = spot('house');
    walkers = ['sua', 'yona'].map((who, i) => {
      const t0 = nearestWalkable(h.x + 1 + i * 2, h.y + h.h);
      return { who, x: t0.x * T + 16, y: t0.y * T + 24, wait: 400 * i, dir: 'down', flip: false, moving: false, phase: i * 2, path: null, step: 0, trail: [] };
    });
    walkers.forEach(w => { w.path = null; w.step = 0; });
  }
  const list = W.animals || [];
  const ids = list.map(a => a.id).join(',');
  if (!beasts || beasts.ids !== ids){
    beasts = { ids, list: list.map((a, i) => {
      const p = yardPoint(a.kind) || { x: T * 4, y: T * 9 };
      return { id: a.id, kind: a.kind, x: p.x, y: p.y, tx: p.x, ty: p.y, wait: i * 300, flip: Math.random() < .5, phase: Math.random() * 6, moving: false };
    }) };
  }
}
function stepActors(dt, t){
  const kidSp = 26 * dt / 1000;
  walkers.forEach(w => {
    if (w.wait > 0){ w.wait -= dt; w.moving = false; return; }
    if (!w.path || w.step >= w.path.length){
      const from = nearestWalkable(Math.floor(w.x / T), Math.floor(w.y / T));
      if (!walkableTile(Math.floor(w.x / T), Math.floor(w.y / T))){ w.x = from.x * T + 16; w.y = from.y * T + 24; }
      const p = someTile();
      w.path = pathFind(from.x, from.y, p.x, p.y);
      w.step = 0; w.moving = false;
      w.wait = w.path && w.path.length ? 400 + Math.random() * 2400 : 500;
      return;
    }
    const g = w.path[w.step], gx = g.x * T + 16, gy = g.y * T + 24;
    const dx = gx - w.x, dy = gy - w.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 4){ w.x = gx; w.y = gy; w.step++; return; }
    w.x += dx / d * kidSp; w.y += dy / d * kidSp; w.moving = true; w.phase += kidSp / 6.4;
    if (Math.abs(dx) > Math.abs(dy) * 1.15){ w.dir = 'side'; w.flip = dx < 0; }
    else w.dir = dy > 0 ? 'down' : 'up';
    w.trail.push({ x: w.x, y: w.y });
    if (w.trail.length > 60) w.trail.shift();
  });
  const sp = 12 * dt / 1000;
  beasts.list.forEach((a, i) => {
    const pet = R.ANIMALS[a.kind].need === 'pethouse';
    if (pet){
      // 아이가 지나온 자국을 따라 걷는다 — 그래야 밭이나 지붕을 가로지르지 않는다
      const w = walkers[i % walkers.length];
      const back = Math.min(w.trail.length - 1, 14);
      const q = back >= 0 ? w.trail[w.trail.length - 1 - back] : { x: w.x, y: w.y };
      a.tx = q.x + (i % 2 ? 14 : -14); a.ty = q.y + 4;
    } else if (a.wait > 0){ a.wait -= dt; a.moving = false; return; }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < (pet ? 12 : 4)){
      if (!pet){
        const q = yardPoint(a.kind);
        if (q){ a.tx = q.x; a.ty = q.y; }
        a.wait = 900 + Math.random() * 4200;
      }
      a.moving = false; return;
    }
    const s = pet ? sp * 2.1 : sp;
    a.x += dx / d * s; a.y += dy / d * s; a.moving = true; a.phase += s / 4.8;
    if (Math.abs(dx) > 0.8) a.flip = dx < 0;
  });
}
function drawWalker(w, t){
  const A = KIDART[w.who] || KIDART.yona, set = A[w.dir] || A.down, f = w.moving ? (Math.floor(w.phase) % 2) : 0;
  const bob = w.moving ? 0 : (Math.sin(t / 900 + w.phase) > 0.8 ? 2 : 0);
  footShade(w.x, w.y - 2, 22);
  const fl = w.dir === 'side' ? w.flip : false;
  artOut(w.who + w.dir + f, set[f], Math.round(w.x - 12), Math.round(w.y - 32 + bob), KIDPAL[w.who], fl);
}
const BABY_K = 2 / 3;      // 새끼는 어른의 3분의 2 크기
function drawBeast(a, t){
  const B = BEAST[a.kind] || BEAST.chicken;
  const rec = (W.animals || []).find(x => x.id === a.id);
  const k = rec && rec.baby ? BABY_K : 1;
  const hgt = B.art.length * k, bw = B.w * k;
  const bob = a.moving ? (Math.floor(a.phase) % 2) * 2 : (Math.sin(t / 1100 + a.phase) > 0.7 ? 2 : 0);
  footShade(a.x, a.y - 2, bw - 2);
  artOut('b' + a.kind, B.art, Math.round(a.x - bw / 2), Math.round(a.y - hgt + bob), B.pal, a.flip, k);
  if (rec && rec.ready){
    const by = a.y - hgt - 12 + Math.round(Math.sin(t / 400) * 2.4);
    px(a.x - 4, by, 10, 10, '#ffe066'); px(a.x - 4, by, 6, 4, '#fff3b8'); px(a.x - 6, by + 2, 2, 6, '#e8b74a'); px(a.x + 6, by + 2, 2, 6, '#e8b74a');
  }
}

/* 스프링클러. 쇠기둥에 놋쇠 머리를 얹고 네 갈래 물줄기가 돌아간다.
   흙과 색이 겹치지 않게 기둥은 회색 쇠로, 머리는 진한 놋쇠로 두고 둘레에 짙은 선을 두른다.
   물방울은 각도로 자리를 잡으므로 칸 크기가 달라져도 같은 모양이 나온다. */
function drawSprinkler(X, Y, t){
  const cx = X + T / 2, base = Y + T - 6;
  const INK = '#2b2620';
  // 젖은 흙 자국과 그림자
  px(cx - 11, base - 1, 22, 4, '#00000018');
  px(cx - 8, base - 1, 16, 3, '#5d4a35');
  // 받침
  px(cx - 8, base - 4, 16, 4, INK);
  px(cx - 7, base - 4, 14, 2, '#8d8880');
  // 쇠기둥
  px(cx - 4, base - 18, 8, 14, INK);
  px(cx - 3, base - 18, 6, 14, '#a9a49a');
  px(cx - 3, base - 18, 2, 14, '#d5cec5');
  px(cx + 1, base - 18, 2, 14, '#7b756d');
  // 놋쇠 머리 — 아래가 넓은 종 모양
  px(cx - 9, base - 22, 18, 5, INK);
  px(cx - 8, base - 21, 16, 3, '#c79a4e');
  px(cx - 8, base - 21, 16, 1, '#e8c274');
  px(cx - 6, base - 26, 12, 5, INK);
  px(cx - 5, base - 25, 10, 4, '#b9924a');
  px(cx - 5, base - 25, 10, 1, '#e6c274');
  px(cx - 2, base - 29, 4, 4, INK);
  px(cx - 1, base - 28, 2, 3, '#d9b463');
  // 네 갈래 물줄기 — 한 바퀴 도는 데 2.4초
  const spin = (t % 2400) / 2400 * Math.PI * 2;
  for (let i = 0; i < 4; i++){
    const a = spin + i * Math.PI / 2;
    // 앞뒤로 곧장 뻗은 줄기는 기둥에 그대로 겹쳐 지저분해진다 — 옆으로 벌어진 것만 그린다
    if (Math.abs(Math.cos(a)) < 0.36) continue;
    // 머리에서 나와 땅으로 떨어지는 길 — 멀어질수록 낮아지고, 앞뒤로도 조금 벌어진다
    for (let d = 1; d <= 4; d++){
      const r = 4 + d * 4;
      const hgt = Math.max(0, 20 - d * 5) + Math.round(Math.sin(Math.PI * d / 5) * 3);
      const dx = Math.round(Math.cos(a) * r * 1.15), dy = Math.round(Math.sin(a) * r * 0.32);
      const c = d === 1 ? '#eaf6ff' : d >= 4 ? '#6fb3e0' : '#a8d7f5';
      px(cx + dx - 1, base - 4 - hgt + dy, 2, 2, c);
    }
  }
}

// 그네는 바람을 타고, 등불은 조금씩 흔들린다 — 움직이는 겹에서 그린다.
function drawDecorLive(season, t, L){
  const d = W.decor || {};
  if (d.swing){
    const b = spot('swing'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    const a = Math.sin(t / 1150) * (5 + curWind);
    const cx = X + w / 2 + a, top = Y + 12, seatY = Y + h - 12;
    px(cx - 6, top, 2, seatY - top, '#8a7a63'); px(cx + 6, top, 2, seatY - top, '#8a7a63');
    px(cx - 10, seatY, 20, 4, WOOD.mid); px(cx - 10, seatY, 20, 2, WOOD.hi);
    px(cx - 10, seatY + 4, 20, 2, WOOD.dark);
  }
  if (d.firepit && L.dark > 0.14){
    // 불꽃만 프레임마다 — 나머지 모닥불은 바탕에 구워져 있다
    const b = spot('firepit'), X = b.x * T, Y = b.y * T;
    const f = Math.sin(t / 150) > 0 ? 3 : 0, f2 = Math.sin(t / 210) > 0 ? 2 : 0;
    px(X + 11, Y + 10 - f, 10, 6, '#ff8c2e');                                   // 위로 갈수록 좁아지는 불꽃
    px(X + 12, Y + 6 - f, 8, 5, '#ff8c2e');
    px(X + 13, Y + 3 - f2, 6, 4, '#ffa94d');
    px(X + 14, Y + 7 - f2, 4, 8, '#ffd166');
    px(X + 15, Y + 11, 2, 4, '#fff3c0');
    ctx.globalAlpha = 0.5; px(X + 10, Y + 2 - f, 3, 3, '#ffb055'); px(X + 20, Y + 4 - f2, 3, 3, '#ffb055'); ctx.globalAlpha = 1;
  }
  if (d.lantern && L.dark > 0.16){
    const b = spot('lantern'), X = b.x * T, Y = b.y * T;
    const f = Math.sin(t / 190) > 0 ? 2 : 0;
    px(X + 12, Y + 8 - f, 8, 6, '#fff3c0'); px(X + 14, Y + 6 - f, 4, 2, '#ffffff');
  }
}
// ---------- 작은 것들 ----------
/* 반딧불이. 여름·가을 밤에만 나고, 보이는 마릿수가 곧 오늘 더 잡을 수 있는 마릿수다 —
   보이면 잡을 수 있다는 약속이 지켜져야 아이가 헛손질을 안 한다. */
let flies = [], fliesKey = '';
function syncFlies(){
  const on = W && M && R.fireflyNight(W, now());
  const k = (W ? R.dayKey(now()) : '') + '|' + on;
  if (fliesKey !== k){ fliesKey = k; flies = []; }
  const n = on ? R.fireflyLeft(M, now()) : 0;
  while (flies.length > n) flies.pop();
  while (flies.length < n) flies.push({ sx: Math.random(), sy: Math.random(), ph: Math.random() * 10 });
}
function drawFireflies(t){
  syncFlies();
  const Wp = COLS * T, Hp = ROWS * T;
  flies.forEach(f => {
    f.x = (f.sx * Wp + Math.sin(t / 1500 + f.ph * 1.3) * 36 + Wp) % Wp;
    f.y = (f.sy * Hp + Math.cos(t / 1900 + f.ph * 2.1) * 26 + Hp) % Hp;
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 700 + f.ph * 1.7));
    ctx.globalAlpha = a * 0.5; px(f.x - 3, f.y - 3, 10, 10, '#9bea6e');
    ctx.globalAlpha = a; px(f.x, f.y, 4, 4, '#ffe66d'); px(f.x + 1, f.y + 1, 2, 2, '#ffffff');
    ctx.globalAlpha = 1;
  });
}
function flyAt(tx, ty){
  const px0 = tx * T + T / 2, py0 = ty * T + T / 2;
  let best = -1, bd = 24;
  flies.forEach((f, i) => { const d = Math.hypot(f.x - px0, f.y - py0); if (d < bd){ bd = d; best = i; } });
  return best;
}
function drawCritters(season, t, L){
  const Wp = COLS * T, Hp = ROWS * T;
  if (L.dark > 0.34) return;      // 밤에는 반딧불이만 난다 — drawFireflies 가 따로 그린다
  if (season === 'winter') return;
  // 나비 — 봄여름, 잠자리 — 가을
  const n = season === 'autumn' ? 3 : 5;
  const wing = season === 'autumn' ? ['#ffd166', '#e8a33d'] : ['#fff1a8', '#ffb7d5'];
  for (let i = 0; i < n; i++){
    const sx = R.prand('bf' + i), sy = R.prand('bg' + i);
    const x = (sx * Wp + Math.sin(t / 2600 + i * 2) * 92 + t / 23) % Wp;
    const y = sy * Hp + Math.sin(t / 800 + i * 3) * 18;
    const up = Math.sin(t / 110 + i) > 0;
    const c = wing[i % 2];
    px(x, y, 2, 4, '#5a4a3a');
    if (up){ px(x - 4, y - 2, 4, 4, c); px(x + 2, y - 2, 4, 4, c); }
    else { px(x - 6, y, 6, 2, c); px(x + 2, y, 6, 2, c); }
  }
  // 새 — 이따금 위쪽을 가로지른다
  const ph = (t / 60) % 900;
  if (ph < 260){
    const bx = ph * 3.2 - 40, by = 24 + Math.sin(ph / 26) * 10;
    [0, 1].forEach(k => {
      const x = bx - k * 32, y = by + k * 10;
      const flap = Math.sin(t / 130 + k) > 0;
      px(x, y, 4, 2, '#4a4a55');
      if (flap){ px(x - 6, y - 2, 6, 2, '#4a4a55'); px(x + 4, y - 2, 6, 2, '#4a4a55'); }
      else { px(x - 6, y + 2, 6, 2, '#4a4a55'); px(x + 4, y + 2, 6, 2, '#4a4a55'); }
    });
  }
}
// 굴뚝 연기 — 집은 늘 사람이 사는 것처럼
function drawSmoke(t){
  const b = spot('house'), X = b.x * T + b.w * T - 34, Y = b.y * T - 4;
  for (let i = 0; i < 5; i++){
    const ph = ((t / 24) + i * 90) % 450;
    const y = Y - ph / 4.5, sz = 4 + ph / 95;
    const x = X + Math.sin(ph / 55 + i) * (4 + ph / 50);
    ctx.globalAlpha = Math.max(0, 0.42 - ph / 1100);
    px(x, y, sz, sz, '#f0ece6');
    ctx.globalAlpha = 1;
  }
}
// ---------- 날씨 ----------
function drawWeather(wk, season, t, cv){
  const Wp = COLS * T, Hp = ROWS * T;
  if (wk === 'rain' || wk === 'storm'){
    // 비 오는 날은 온 세상이 조금 푸르고 어둡다 — 빗줄기만으로는 비처럼 안 보인다
    ctx.fillStyle = wk === 'storm' ? 'rgba(60,74,110,.24)' : 'rgba(84,116,158,.15)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const n = wk === 'storm' ? 190 : 140, len = wk === 'storm' ? 18 : 14;
    for (let i = 0; i < n; i++){
      const sx = R.prand('r' + i), sy = R.prand('rr' + i);
      const y = (sy * Hp + t * (wk === 'storm' ? 1.24 : 0.92)) % Hp;
      const x = (sx * Wp + y * 0.3) % Wp;
      ctx.globalAlpha = 0.75; px(x, y, 2, len, '#dff1ff');
      ctx.globalAlpha = 0.35; px(x + 2, y + 2, 2, len - 4, '#a8d8f5');
      ctx.globalAlpha = 1;
    }
    // 땅에 튀는 물방울
    for (let i = 0; i < 34; i++){
      const sx = R.prand('sp' + i), sy = R.prand('sq' + i);
      const ph = ((t / 340) + sx * 9) % 1;
      if (ph < 0.4){
        const x = sx * Wp, y = sy * Hp;
        ctx.globalAlpha = 0.62 - ph;
        px(x - 4 - ph * 6, y, 4, 2, '#eaf6ff'); px(x + 2 + ph * 6, y, 4, 2, '#eaf6ff'); px(x, y - 2 - ph * 4, 2, 2, '#eaf6ff');
        ctx.globalAlpha = 1;
      }
    }
  }
  if (wk === 'snow'){
    ctx.fillStyle = 'rgba(206,224,238,.13)'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 120; i++){
      const sx = R.prand('s' + i), sy = R.prand('ss' + i), sz = sx > 0.78 ? 6 : sx > 0.42 ? 4 : 2;
      const y = (sy * Hp + t * (0.056 + sz * 0.016) + sx * 60) % Hp;
      const x = (sx * Wp + Math.sin(t / 1100 + i * 1.7) * (10 + sz * 4) + Wp) % Wp;
      ctx.globalAlpha = sz === 2 ? 0.6 : 0.92;
      px(x, y, sz, sz, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
  if (wk === 'wind'){
    const leaf = season === 'autumn' ? ['#e8874a', '#d9603c', '#c9a227', '#a8552c'] : season === 'winter' ? ['#eef8ff', '#dbe8ef'] : ['#ffb7d5', '#fff3a0', '#a9dca1', '#ffffff'];
    for (let i = 0; i < 40; i++){
      const sx = R.prand('w' + i), sy = R.prand('ww' + i);
      const x = (sx * Wp + t * (0.22 + sx * 0.16)) % Wp;
      const y = sy * Hp + Math.sin(t / 380 + i * 2) * 30;
      const c = leaf[i % leaf.length];
      const spin = Math.sin(t / 200 + i) > 0;
      if (spin){ px(x, y, 6, 2, c); px(x + 2, y + 2, 4, 2, shade(c, -24)); }
      else { px(x, y, 2, 6, c); px(x + 2, y + 2, 2, 4, shade(c, -24)); }
    }
    // 바람 자국 — 가로로 스치는 흰 선
    for (let i = 0; i < 5; i++){
      const ph = ((t / 12) + i * 220) % 1400;
      if (ph > 420) continue;
      const y = R.prand('wl' + i) * Hp, x = ph * 2 - 80;
      ctx.globalAlpha = 0.3 - ph / 1800;
      px(x, y, 52, 2, '#ffffff'); px(x + 16, y + 4, 32, 2, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
  if (wk === 'storm'){
    const ph = t % 7600;
    if (ph < 70 || (ph > 130 && ph < 190)){ ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(0, 0, cv.width, cv.height); }
  }
}
// ---------- 배치 바꾸기 ----------
let placeMode = false, placePick = null;
function outlineBox(b, c){
  const X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
  px(X, Y, w, 2, c); px(X, Y + h - 2, w, 2, c); px(X, Y, 2, h, c); px(X + w - 2, Y, 2, h, c);
  px(X + 2, Y + 2, w - 4, 2, c); px(X + 2, Y + h - 4, w - 4, 2, c);
}
/* ---------- 낚시 손맛 ----------
   찌가 왔다 갔다 하는 것을 칸 안에서 멈추면 귀한 것이 문다. 모험단의 타이밍 바와 같은 규칙.
   여는 시각(openAt)을 따로 두는 까닭은 모험단에서 겪은 그대로다 — 연못을 누른 그 손짓이
   그대로 이어져 들어와 저절로 당겨졌다. 「움직임 줄이기」를 켠 사람에게는 바가 안 도니
   바 없이 보통 손맛으로 친다. */
const FISH_GRACE = 300, FISH_ZONE = 26, FISH_SPAN = 1200, FISH_LIMIT = 3800;
let fishing = null;
function fishOpen(){ return !!fishing && !fishing.done && performance.now() >= fishing.openAt; }
function fishMarker(t){ const p = (Math.max(0, t - fishing.t0) % FISH_SPAN) / FISH_SPAN; return p < 0.5 ? p * 200 : (1 - p) * 200; }
function startFishing(){
  if (fishing) return;
  if (R.fishLeft(M, now()) <= 0){ flash('오늘은 많이 잡았어요. 내일 또 와요', true); return; }
  // 기운은 미리 본다 — 한 판 다 하고 나서 「기운이 없어요」 하면 억울하다
  if ((M.energy || 0) < R.COST.fish){ flash('기운이 없어요', true); return; }
  if (STILL){ doFish('good'); return; }
  const open = performance.now() + FISH_GRACE;
  fishing = { t0: open, openAt: open, center: 26 + Math.random() * 48, done: false };
  sfx('drip'); flash('찌가 움직여요 — <b>칸 안에서 톡!</b>');
  setTimeout(() => { if (fishing && !fishing.done) finishFishing('miss'); }, FISH_GRACE + FISH_LIMIT);
}
function finishFishing(force){
  if (!fishing || fishing.done) return;
  fishing.done = true;
  const pos = fishMarker(performance.now()), d = Math.abs(pos - fishing.center);
  const g = force || (d <= FISH_ZONE / 4 ? 'perfect' : d <= FISH_ZONE / 2 ? 'good' : 'miss');
  fishing.pos = pos; fishing.grade = g;
  sfx(g === 'perfect' ? 'sparkle' : g === 'miss' ? 'thud' : 'pop');
  setTimeout(() => { fishing = null; doFish(g); }, 420);
}
function doFish(g){
  const r = act((w, m) => R.fish(w, m, now(), g));
  if (r.ok){
    sfx(r.rare ? 'fanfare' : r.junk ? 'thud' : 'pop');
    const head = g === 'perfect' ? '<b>딱 맞췄어요!</b> ' : g === 'miss' ? '늦었어요… ' : '';
    flash(head + r.msg + ' <span style="color:var(--ink-soft);font-weight:700;">(오늘 ' + R.fishLeft(M, now()) + '번 남음)</span>');
  }
}
// 연못 위에 뜨는 바. 글씨는 안 쓴다 — 농장은 도트만으로 말한다.
function drawFishBar(t){
  if (!fishing) return;
  const b = spot('pond');
  const bw = 116, bh = 10;
  // 연못이 화면 구석에 있으면 바가 잘린다 — 안쪽으로 밀어 넣는다
  const bx = Math.max(6, Math.min(COLS * T - bw - 6, Math.round(b.x * T + b.w * T / 2 - bw / 2)));
  const by = Math.max(6, Math.round(b.y * T - 22));
  const ready = !fishing.done && performance.now() < fishing.openAt;
  px(bx - 3, by - 3, bw + 6, bh + 6, '#2f2a24');
  px(bx, by, bw, bh, '#fff6e9');
  const zx = bx + Math.round((fishing.center - FISH_ZONE / 2) / 100 * bw), zw = Math.round(FISH_ZONE / 100 * bw);
  px(zx, by, zw, bh, '#ffd979');
  px(zx + Math.round(zw / 4), by, Math.round(zw / 2), bh, '#ff7f8a');
  const pos = fishing.done ? fishing.pos : fishMarker(performance.now());
  px(bx + Math.round(pos / 100 * bw) - 1, by - 3, 3, bh + 6, ready ? '#8a7b6e' : '#2f2a24');
  if (fishing.done){                                    // 결과를 한 번 반짝인다
    const c = fishing.grade === 'perfect' ? '#ffd979' : fishing.grade === 'miss' ? '#8a7b6e' : '#8fd0c0';
    if (Math.floor(t / 110) % 2) px(bx - 3, by - 3, bw + 6, bh + 6, c);
  }
}

function drawPlaceOverlay(t){
  if (!placeMode) return;
  ctx.globalAlpha = 0.5;
  for (let x = 0; x <= COLS; x++) px(x * T, 0, 2, ROWS * T, '#ffffff');
  for (let y = 0; y <= ROWS; y++) px(0, y * T, COLS * T, 2, '#ffffff');
  ctx.globalAlpha = 1;
  const FB = R.FIELD_BOX;
  ctx.globalAlpha = 0.22; px(FB.x * T, FB.y * T, FB.w * T, FB.h * T, '#ff5a4a'); ctx.globalAlpha = 1;
  R.PLACE_IDS.forEach(id => {
    if (!here(id)) return;
    const b = spot(id);
    if (id === placePick){ const blink = Math.sin(t / 180) > 0; outlineBox(b, blink ? '#ffe066' : '#ffffff'); }
    else outlineBox(b, R.PLACE[id].move ? '#7fe0a8' : '#ff9aa2');
  });
  Object.keys(R.NODES).forEach(n => { const N = R.NODES[n]; ctx.globalAlpha = 0.3; px(N.x * T, N.y * T, T, T, '#ff5a4a'); ctx.globalAlpha = 1; });
}

// ---------- 그림 겹 ----------
// 겹을 나누는 까닭은 화질이 아니라 「다시 안 그려도 되는 것을 안 그리려고」다.
// 매 프레임 바뀌는 것을 굳이 따로 두면 합치는 비용만 늘 뿐이라서,
// 아래 아홉 겹 가운데 다섯 겹만 캔버스에 담아 두고 표(sig)가 바뀔 때만 다시 그린다.
//
//   1 땅          담아 둠 — 계절이 바뀔 때만
//   2 지은 것      담아 둠 — 짓거나 옮기거나 밤이 될 때만
//   3 밭           담아 둠 — 갈고 물 주고 비료 줄 때만
//   4 작물         담아 둠 — 자라거나 바람 단계가 바뀔 때만
//   5 살아 있는 것  매번 — 아이·동물·나무를 아래에 있는 것부터
//   6 앞겹         담아 둠 — 목장과 밭의 앞 울타리 (동물이 울타리 뒤로 간다)
//   7 작은 것·날씨  매번
//   8 빛무리       담아 둠 — 등불 자리와 어둠 단계가 바뀔 때만
//   9 물들임       매번 — 네모 두 번이라 담아 둘 것도 없다
const layers = {};
function layerCv(name, w, h){
  let L = layers[name];
  if (!L) L = layers[name] = { cv: document.createElement('canvas'), sig: null };
  if (L.cv.width !== w || L.cv.height !== h){ L.cv.width = w; L.cv.height = h; L.sig = null; }
  return L;
}
// 표가 그대로면 그려 둔 것을 그냥 돌려준다
function paintLayer(name, w, h, sig, fn){
  const L = layerCv(name, w, h);
  if (L.sig !== sig){
    L.sig = sig;
    const g = L.cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    const keep = ctx; ctx = g; fn(g); ctx = keep;
  }
  return L.cv;
}
function dropLayers(){ Object.keys(layers).forEach(k => { layers[k].sig = null; }); Object.keys(spriteBuf).forEach(k => { delete spriteBuf[k]; }); Object.keys(furnCache).forEach(k => { delete furnCache[k]; }); }
// 담아 둔 겹 넷을 한 장으로 미리 합쳐 둔다.
// 겹을 나눈 값은 「다시 안 그리는 것」에 있지 「매번 여러 장을 얹는 것」에 있지 않다 —
// 캔버스가 GPU 를 못 쓸 때는 전면 한 장 얹는 데만 0.28ms 가 든다.
function composeBack(cw, ch, parts){
  let sig = '';
  for (let i = 0; i < parts.length; i++) sig += (layers[parts[i]] ? layers[parts[i]].sig : '-') + '#';
  const L = layerCv('back', cw, ch);
  if (L.sig !== sig){
    L.sig = sig;
    const g = L.cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cw, ch);
    for (let i = 0; i < parts.length; i++) if (layers[parts[i]]) g.drawImage(layers[parts[i]].cv, 0, 0);
  }
  return L.cv;
}
// 지은 것들의 실루엣을 오른쪽 아래로 밀어 어둡게 깔면 건물이 땅에 붙어 보인다.
// 건물마다 그림자를 따로 그리는 대신 겹 하나로 한 번에 끝낸다 — 매 장 드는 값은 없다.
function paintShade(cw, ch){
  const src = layers.built, L = layerCv('shade', cw, ch);
  const sig = src ? src.sig : '-';
  if (L.sig !== sig){
    L.sig = sig;
    const g = L.cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, ch);
    if (src){
      g.drawImage(src.cv, Math.round(2 * S), Math.round(3 * S));
      g.globalCompositeOperation = 'source-in';       // 실루엣만 남긴다
      g.fillStyle = 'rgba(24,36,18,0.16)';
      g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'source-over';
    }
  }
  return L.cv;
}
// ---- 겹마다의 표 ----
function sigGround(season, wk){ return season + '|' + wk; }
function sigBuilt(cal, night){
  let s = cal.season + '|' + (night ? 'n' : 'd') + '|' + (W.expand || 0);
  Object.keys(R.BUILDINGS).forEach(b => { if (W.buildings[b] && W.buildings[b].done) s += b; });
  s += '|' + Object.keys(W.decor || {}).sort().join(',') + '|' + JSON.stringify(W.layout || {});
  s += '|' + ((W.buildings.hive && W.buildings.hive.honey) || 0) + '|' + (key ? (W.mail[key] || []).length : 0);
  return s;
}
function sigField(){
  const n = now();
  let s = (W.expand || 0) + '|';
  R.plotIds(W, 'field').forEach(id => { const p = W.plots[id]; s += p && p.tilled ? (R.wetNow(p, n, false) ? 'W' : 'T') + (p.fert ? 'f' : '') : '.'; });
  return s;
}
function sigCrops(windStep){
  let s = windStep + '|' + curWind.toFixed(2) + '|';
  R.plotIds(W, 'field').forEach(id => { const p = W.plots[id]; s += p && p.crop ? p.crop.charAt(0) + R.stageOf(p) + (p.wilted ? 'x' : '') + (p.giant ? 'G' : '') : '.'; });
  return s;
}
function sigFront(season){ return season + '|' + JSON.stringify(W.layout || {}) + '|' + (W.expand || 0) + '|' + (W.buildings.pasture && W.buildings.pasture.done ? 1 : 0); }
function sigGlow(dark){ return Math.round(dark * 20) + '|' + lamps.map(l => l.x + ',' + l.y + ',' + l.r + l.c).join(';'); }

// ---- 겹 6: 앞겹 ----
// 목장과 밭의 「가까운 쪽」 울타리는 아이와 동물보다 앞에 있어야
// 울타리 안에 든 것처럼 보인다. 뒤쪽 울타리는 2번 겹에 그대로 둔다.
function drawFront(season){
  if (here('pasture')){
    const b = spot('pasture'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    // 가운데는 드나드는 문이라 비워 둔다 — 겹은 비어 있는 채로 시작하니 안 그리면 그만이다
    const gx0 = X + w / 2 - 16, gx1 = X + w / 2 + 16;
    const rail = (x0, x1) => { if (x1 <= x0) return; px(x0, Y + h - 10, x1 - x0, 2, WOOD.mid); px(x0, Y + h - 4, x1 - x0, 2, WOOD.low); };
    rail(X + 2, gx0); rail(gx1, X + w - 2);
    for (let i = 0; i < w; i += T){
      const px1 = X + i;
      if (px1 + 4 > gx0 && px1 < gx1) continue;
      px(px1, Y + h - 18, 4, 20, WOOD.dark); px(px1, Y + h - 18, 2, 20, WOOD.mid); px(px1, Y + h - 20, 4, 2, WOOD.hi);
    }
    px(gx0 - 4, Y + h - 22, 4, 24, WOOD.dark); px(gx1, Y + h - 22, 4, 24, WOOD.dark);   // 문기둥
  }
  const E = R.EXPANSIONS[Math.min(W.expand || 0, R.EXPANSIONS.length - 1)];
  const fx = R.FIELD.x0 * T, fy = R.FIELD.y0 * T, fw = E.w * T, fh = E.h * T;
  px(fx - 2, fy + fh + 2, fw + 4, 2, WOOD.mid); px(fx - 2, fy + fh + 8, fw + 4, 2, WOOD.low);
  for (let i = 0; i <= fw; i += T){ px(fx + i - 2, fy + fh, 4, 16, WOOD.dark); px(fx + i - 2, fy + fh, 2, 16, WOOD.mid); px(fx + i - 2, fy + fh - 2, 4, 2, WOOD.hi); }
  drawFrontGrass(season);
}
// 화면 맨 아래를 두르는 앞쪽 수풀. 눈에서 가장 가까우니 가장 진하고, 아이가 그 사이로 지나간다.
// 풀포기는 늘 같은 자리에 나도록 좌표로 난수를 만든다 — 담아 두는 겹이라 흔들리지도 않는다.
function drawFrontGrass(season){
  const Wp = COLS * T, base = ROWS * T;
  const C = season === 'autumn' ? ['#8a6a2e', '#6f5424', '#54401b', '#a8853c']
          : season === 'winter' ? ['#7f9a8c', '#67806f', '#4e6356', '#9db4a5']
          : ['#3f7d3c', '#336633', '#264d27', '#4f9a48'];
  // 1) 바닥에 깔리는 그늘 — 수풀이 화면 밖에서 이어져 오는 느낌
  for (let i = 0; i < 4; i++) px(0, base - 8 + i * 2, Wp, 2, 'rgba(0,0,0,' + (0.05 + i * 0.03).toFixed(3) + ')');
  // 2) 풀포기 — 세 겹으로 겹쳐 심는다. 뒤가 연하고 앞이 진하다.
  const bands = [{ n: 120, h: [10, 20], c: 3, y: 6 }, { n: 100, h: [12, 24], c: 0, y: 2 }, { n: 80, h: [16, 28], c: 2, y: 0 }];
  bands.forEach((B, bi) => {
    for (let i = 0; i < B.n; i++){
      const r1 = R.prand('fgx' + bi + '_' + i), r2 = R.prand('fgh' + bi + '_' + i), r3 = R.prand('fgb' + bi + '_' + i);
      const x = Math.floor(r1 * (Wp + 16)) - 8;
      const h = Math.round(B.h[0] + r2 * (B.h[1] - B.h[0]));
      const y0 = base - h + B.y;
      const c = C[B.c], cd = C[2], cl = C[3];
      // 잎 세 갈래
      px(x, y0 + 4, 2, h - 4, c); px(x, y0 + 4, 2, 4, cl);
      px(x + 2, y0, 2, h, c);
      px(x + 4, y0 + 6, 2, h - 6, r3 > 0.5 ? cd : c);
      if (r3 > 0.62){ px(x - 2, y0 + 10, 2, h - 10, cd); px(x + 6, y0 + 12, 2, h - 12, cd); }
      if (r3 > 0.88 && season !== 'winter'){                       // 이따금 들꽃
        const fc = ['#ffb7d5', '#fff3a0', '#ffffff', '#c9a8ff'][Math.floor(R.prand('fgf' + bi + '_' + i) * 4)];
        px(x, y0 - 2, 2, 2, fc); px(x - 2, y0, 6, 2, fc); px(x, y0 + 2, 2, 2, fc);
      }
      if (season === 'winter' && r3 > 0.5) px(x, y0 - 2, 6, 2, '#f2f9ff');
    }
  });
  // 3) 맨 앞 실루엣 — 가장 진한 잎 몇 장
  for (let i = 0; i < 16; i++){
    const r1 = R.prand('fsx' + i), r2 = R.prand('fsh' + i);
    const x = Math.floor(r1 * (Wp + 20)) - 10, h = Math.round(18 + r2 * 14);
    blob(x, base - h, 16, h, C[2], C[1], C[2], 'fs' + i);
  }
}
// ---- 겹 8: 빛무리 ----
function drawGlow(g, dark){
  if (!lamps.length) return;
  const power = Math.min(1, dark * 1.7);
  g.globalCompositeOperation = 'source-over';
  lamps.forEach(l => {
    const rg = g.createRadialGradient(l.x * S, l.y * S, 0, l.x * S, l.y * S, l.r * S);
    const c = l.c;
    rg.addColorStop(0, c + Math.round(power * 150).toString(16).padStart(2, '0'));
    rg.addColorStop(0.45, c + Math.round(power * 60).toString(16).padStart(2, '0'));
    rg.addColorStop(1, c + '00');
    g.fillStyle = rg;
    g.fillRect((l.x - l.r) * S, (l.y - l.r) * S, l.r * 2 * S, l.r * 2 * S);
  });
}
// ---- 한 장 그리기 ----
function drawFarm(cvIn, tms){
  const cv = cvIn || $('#farmCanvas');
  if (!cv || !W) return;
  const t = tms == null ? (window.performance ? performance.now() : Date.now()) : tms;
  const cal = R.calendar(W, now()), season = cal.season, wk = R.weatherOf(R.dayKey(now()), season);
  const L = dayLight();
  if (fitPixelCanvas(cv, COLS * T, ROWS * T, 5)) dropLayers();
  S = pixScale(cv, COLS * T, ROWS * T, 1.5);
  const cw = cv.width, ch = cv.height;
  curWind = wk === 'wind' ? 4.8 : wk === 'storm' ? 3.8 : wk === 'rain' ? 2.0 : 1.1;
  // 바람은 0.11초 단위로만 센다. 흔들리는 폭이 어차피 한두 도트라 눈에는 그대로인데,
  // 작물 겹을 다시 그리는 횟수는 절반이 된다.
  const windStep = Math.round(t / 110) * 110;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cw, ch);

  // 1 땅
  paintLayer('ground', cw, ch, sigGround(season, wk), () => { drawGround(season); drawPath(season); });
  // 2 지은 것 (등불 자리는 여기서 모인다)
  paintLayer('built', cw, ch, sigBuilt(cal, L.lamp), () => {
    lamps = [];
    drawPasture(season);
    drawDecor(season, L.lamp);
    drawHouse(L.lamp); drawMail(); drawBoard(); drawStall(cal);
    drawWell(L.lamp); drawGreenhouse(L.lamp); drawCoop(L.lamp); drawBarn(L.lamp); drawPethouse(L.lamp);
    drawHive(); drawScarecrow();
  });
  // 3 밭
  paintLayer('field', cw, ch, sigField(), () => {
    drawFieldFrame();
    R.plotIds(W, 'field').forEach(id => drawPlot(id, W.plots[id], false));
  });
  // 4 작물
  paintLayer('crops', cw, ch, sigCrops(windStep), () => {
    const open = R.plotIds(W, 'field');
    const sway = (x, y) => Math.round(Math.sin(windStep / 640 + x * 0.7 + y * 0.4) * curWind);
    open.forEach(id => {
      const p = W.plots[id]; if (!p || !p.crop || p.giant) return;
      const q = R.parseId(id);
      drawCrop(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, null, sway(q.x, q.y));
    });
    open.forEach(id => { const p = W.plots[id]; if (p && p.giant && p.pairOf && id < p.pairOf){ const q = R.parseId(id); drawGiant(id, p, sway(q.x, q.y)); } });
  });
  // 1~3 은 거의 안 바뀌니 한 장으로 합쳐 두고, 자주 바뀌는 작물만 따로 얹는다.
  // 이러면 매 프레임 전면 그림을 세 번만 얹는다 (뒤·작물·앞).
  paintShade(cw, ch);
  g.drawImage(composeBack(cw, ch, ['ground', 'shade', 'built', 'field']), 0, 0);
  g.drawImage(layers.crops.cv, 0, 0);
  // 5 살아 있는 것 — 나무까지 함께 아래에 있는 것부터. 그래야 아이가 나무 뒤로 지나간다.
  ctx = g;
  const cast = [];
  Object.keys(R.NODES).forEach(n => { const N = R.NODES[n]; cast.push({ y: N.y * T + 30, go: () => drawNode(n, season, t) }); });
  Object.keys(W.sprinklers || {}).forEach(id => { const q = R.parseId(id); cast.push({ y: q.y * T + 30, go: () => drawSprinkler(q.x * T, q.y * T, t) }); });
  if (R.peddlerHere(W, now())) cast.push({ y: R.PEDDLER.y * T + 30, go: () => drawPeddler(t) });
  if (walkers) walkers.forEach(w => cast.push({ y: w.y, go: () => drawWalker(w, t) }));
  if (beasts) beasts.list.forEach(a => cast.push({ y: a.y, go: () => drawBeast(a, t) }));
  cast.sort((a, b) => a.y - b.y).forEach(c => c.go());
  // 6 앞겹
  g.drawImage(paintLayer('front', cw, ch, sigFront(season), () => drawFront(season)), 0, 0);
  // 7 작은 것과 날씨
  ctx = g;
  drawDecorLive(season, t, L);
  drawSmoke(t);
  drawCritters(season, t, L);
  drawWeather(wk, season, t, cv);
  // 9 색보정 — 아래 색을 봐야 해서 담아 둘 수 없다. 전면 칠 두 번이라 싸다.
  grade(g, cw, ch, L);
  // 8 빛무리 — 미리 만들어 둔 겹을 얹기만 한다
  if (L.lamp && lamps.length){
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(paintLayer('glow', cw, ch, sigGlow(L.dark), gg => drawGlow(gg, L.dark)), 0, 0);
    g.restore();
  }
  ctx = g;
  drawFireflies(t);
  drawPlaceOverlay(t);
  drawFishBar(t);
}
// 어두운 쪽은 눌러 물들이고(곱하기), 밝은 쪽은 들어 올린다(스크린).
function grade(g, cw, ch, L, k){
  const s = k == null ? 1 : k;
  if (L.dark > 0.02){
    g.save(); g.globalCompositeOperation = 'multiply';
    g.globalAlpha = Math.min(0.94, L.dark * 1.28) * s;
    g.fillStyle = L.tint; g.fillRect(0, 0, cw, ch); g.restore();
  }
  if (L.lift && L.lift !== '#000000'){
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = s;
    g.fillStyle = L.lift; g.fillRect(0, 0, cw, ch); g.restore();
  }
}
// ---------- 움직이는 그림 ----------
// 창이 숨겨져 있거나 「움직임 줄이기」를 켠 사람에게는 한 장만 그린다.
let rafId = 0, lastTs = 0, liveCv = null;
const STILL = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(ts){
  rafId = requestAnimationFrame(loop);
  if (!liveCv || !W || document.hidden){ lastTs = ts; return; }
  const dt = ts - lastTs;
  if (dt < 55) return;
  lastTs = ts;
  ensureActors();
  stepActors(Math.min(150, dt), ts);
  drawFarm(liveCv, ts);
  // 집 탭이 열려 있으면 방도 함께 — 불꽃과 먼지와 아이가 움직인다
  if (tab === 'house' && key && !$('#tab-house').hidden) drawRoom($('#houseCanvas'), room, ts);
}
function startLoop(cv){
  liveCv = cv;
  ensureActors();
  drawFarm(cv);                                  // 첫 장은 바로 — 빈 화면이 잠깐 보이지 않게
  if (STILL) return;
  if (!rafId) rafId = requestAnimationFrame(loop);
}

// ---------- 누르기 ----------
function tileAt(clientX, clientY){
  const cv = liveCv || $('#farmCanvas'), r = cv.getBoundingClientRect();
  const w = r.width || cv.width, h = r.height || cv.height;
  const x = (clientX - r.left) / w * cv.width / S, y = (clientY - r.top) / h * cv.height / S;
  return { tx: Math.floor(x / T), ty: Math.floor(y / T) };
}
function plotAtTile(tx, ty){
  const F = R.FIELD;
  if (tx < F.x0 || ty < F.y0 || tx >= F.x0 + F.w || ty >= F.y0 + F.h) return null;
  return tx + ',' + ty;
}
function nodeAt(tx, ty){ return Object.keys(R.NODES).find(n => R.NODES[n].x === tx && R.NODES[n].y === ty) || null; }
function built(id){ return !!(W.buildings[id] && W.buildings[id].done); }
function onFarmTap(e){
  if (fishing){ if (fishOpen()) finishFishing(); return; }   // 찌가 떠 있으면 어디를 눌러도 당긴다
  const { tx, ty } = tileAt(e.clientX, e.clientY);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  if (placeMode){ onPlaceTap(tx, ty); return; }
  // 반딧불이는 무엇 위를 날든 먼저 잡힌다 — 밭 위에 있다고 놓치면 아이가 답답하다
  const fi = flyAt(tx, ty);
  if (fi >= 0){
    // 누른 그 마리를 먼저 지운다. act 가 다시 그리면서 마릿수를 맞추므로,
    // 뒤에 지우면 애먼 마리까지 사라진다. 못 잡았으면 syncFlies 가 도로 채운다.
    flies.splice(fi, 1);
    const r = act((w, m) => R.catchFirefly(w, m, now()));
    if (r.ok) sfx('sparkle');
    return;
  }
  const id = plotAtTile(tx, ty);
  if (id){ onPlot(id); return; }
  const n = nodeAt(tx, ty);
  if (n){ const r = act((w, m) => R.gather(w, m, n, now())); if (r.ok) sfx(R.NODES[n].kind === 'tree' ? 'thud' : R.NODES[n].kind === 'rock' ? 'prop' : 'pop'); return; }
  if (inSpot('house', tx, ty)){ openTab('house'); sfx('house'); return; }
  if (inSpot('mail', tx, ty)){ openMail(); return; }
  if (inSpot('board', tx, ty)){ openTab('duo'); return; }
  if (inSpot('stall', tx, ty)){ openTab('shop'); return; }
  if (inSpot('hive', tx, ty)){ const r = act((w, m) => R.takeHoney(w, m)); if (r.ok) sfx('sparkle'); return; }
  if (inSpot('greenhouse', tx, ty)){ if (built('greenhouse')) openGreenhouse(); else flash('온실 터예요. 둘이서 탭에서 같이 지어요'); return; }
  if (inSpot('well', tx, ty)){ flash(built('well') ? '우물이에요. 물뿌리개를 키울 수 있어요' : '우물 터예요. 둘이서 탭에서 같이 지어요'); return; }
  if (inSpot('pond', tx, ty)){ startFishing(); return; }
  if (R.peddlerHere(W, now()) && inBox({ x: R.PEDDLER.x, y: R.PEDDLER.y, w: R.PEDDLER.w + 1, h: R.PEDDLER.h }, tx, ty)){ openPeddler(); sfx('prop'); return; }
  if (inSpot('firepit', tx, ty)){ const r = act((w, m) => R.fireSit(w, m, now())); if (r.ok) sfx(r.both ? 'fanfare' : 'purr'); return; }
  if (inSpot('bench', tx, ty) || inSpot('swing', tx, ty)){ flash('쉬는 자리예요. 앉으면 기분이 좋아져요'); return; }
  // 동물이 있는 곳은 어디를 눌러도 동물 카드로
  if (['coop', 'barn', 'pasture', 'pethouse'].some(b => inSpot(b, tx, ty))){ openTab('duo'); return; }
  const near = (W.animals || []).some(a => { const b = beasts && beasts.list.find(x => x.id === a.id); return b && Math.abs(b.x - (tx * T + 8)) < 14 && Math.abs(b.y - (ty * T + 12)) < 16; });
  if (near){ openTab('duo'); return; }
  // 안 지은 건물 터를 누르면 무엇이 들어설 자리인지 알려 준다
  const site = ['pasture', 'barn', 'coop', 'pethouse', 'scarecrow'].find(b => inSpot(b, tx, ty));
  if (site) flash(R.BUILDINGS[site].name + ' 터예요. 둘이서 탭에서 같이 지어요');
}
// ---------- 배치 바꾸기 ----------
function togglePlace(){
  placeMode = !placeMode; placePick = null;
  $('#placeBtn').classList.toggle('on', placeMode);
  $('#placeBar').hidden = !placeMode;
  flash(placeMode ? '옮길 것을 눌러요. 초록 테두리는 옮길 수 있는 것, 빨강은 못 옮기는 것이에요' : '');
  dropLayers(); if (STILL) drawFarm(liveCv);
}
function onPlaceTap(tx, ty){
  if (!placePick){
    const id = R.PLACE_IDS.find(i => here(i) && inSpot(i, tx, ty));
    if (!id){ flash('옮길 것을 눌러요', true); return; }
    if (!R.PLACE[id].move){ flash(R.PLACE[id].name + '은 옮길 수 없어요', true); return; }
    placePick = id; sfx('prop');
    flash('<b>' + R.PLACE[id].name + '</b>을 들었어요. 놓을 곳을 눌러요');
    return;
  }
  const P = R.PLACE[placePick];
  const nx = tx - Math.floor(P.w / 2), ny = ty - Math.floor(P.h / 2);
  const r = act((w, m) => R.moveThing(w, m, placePick, nx, ny));
  if (r.ok){ placePick = null; sfx('thud'); dropLayers(); }
}
function onPlot(id){
  if (!R.plotOpen(W, id)){ const nx = R.EXPANSIONS[(W.expand || 0) + 1]; flash(nx ? '아직 닫힌 땅이에요. 가게에서 밭을 넓혀요 (' + nx.cost + ' 동전, 레벨 ' + nx.lv + ')' : '여기는 밭이 아니에요'); return; }
  const gh = id[0] === 'g';
  if (tool === 'hoe'){ multi(id, R.toolN(M, 'hoe'), (w, m, t) => R.till(w, m, t, now()), '땅을 갈았어요'); return; }
  if (tool === 'can'){ if (gh){ flash('온실은 물을 안 줘도 돼요'); return; } multi(id, R.toolN(M, 'can'), (w, m, t) => R.water(w, m, t, now()), '물을 줬어요'); return; }
  if (tool === 'seed'){ if (!seed){ flash('씨앗을 먼저 골라요', true); return; } const c = seed; const r = act((w, m) => R.plant(w, m, id, c, now())); if (r.ok){ sfx(r.joined ? 'fanfare' : 'plant'); renderTools(); } return; }
  if (tool === 'fert'){ const r = act((w, m) => R.fertilize(w, m, id, now())); if (r.ok) sfx('pop'); renderTools(); return; }
  if (tool === 'pull'){ const p = W.plots[id]; if (p && p.crop && !p.wilted && !confirm(R.CROPS[p.crop].name + '을 정말 뽑을까요?')) return; act((w, m) => R.clear(w, m, id)); return; }
  if (tool === 'sprk'){
    const on = (W.sprinklers || {})[id];
    const r = act((w, m) => on ? R.pullSprinkler(w, m, id) : R.putSprinkler(w, m, id));
    if (r.ok) sfx('pop');
    renderTools(); return;
  }
  // 손
  const p = W.plots[id];
  if (p && p.crop){
    R.tickPlot(p, now(), gh);
    if (p.wilted || R.ripe(p)){ const r = act((w, m) => R.harvest(w, m, id, now())); if (r.ok) sfx(r.giant ? 'fanfare' : r.waiting ? 'prop' : 'pop'); return; }
    const C = R.CROPS[p.crop];
    // 지금까지 돌본 만큼의 별 — 물을 다 주면 하나 더, 비료까지 주면 반짝 작물이 된다
    const st = R.starOf(p, gh), need = R.careNeed(p);
    const stars = '★'.repeat(st) + '☆'.repeat(3 - st);
    flash(C.name + (p.giant ? '(큰 것)' : '') + ' <b>' + stars + '</b> — ' + Math.ceil(R.hoursLeft(p, now())) + '시간 더. '
      + (R.wetNow(p, now(), gh) ? '촉촉해요' : '<b>물이 말랐어요</b>')
      + (st < 3 ? ' · ' + (!gh && (p.care || 0) < need ? '물 ' + (need - (p.care || 0)) + '번 더' : '비료를 주면 반짝!') : ' · <b>반짝 작물이 돼요</b>')
      + (p.by !== key ? ' · ' + NAME[p.by] + '가 심었어요' : ''));
    return;
  }
  if ((W.sprinklers || {})[id]){ flash('스프링클러예요. 아침마다 둘레 네 칸에 물을 줘요'); return; }
  flash(p && p.tilled ? '갈아 둔 땅이에요. 씨앗을 골라 심어요' : '괭이로 갈면 심을 수 있어요');
}
// 도구가 여러 칸을 다루면 하나라도 되면 성공으로 친다. 실패 이유는 마지막 것만.
function multi(id, n, fn, okMsg){
  const targets = R.toolTargets(id, n).filter(t => R.plotOpen(W, t));
  let done = 0, last = null;
  targets.forEach(t => { const r = act((w, m) => fn(w, m, t), true); if (r.ok) done++; else last = r.msg; });
  if (done){ flash(okMsg + (done > 1 ? ' (' + done + '칸)' : '')); sfx(tool === 'can' ? 'drip' : 'thud'); }
  else flash(last || '안 됐어요', true);
  renderTools();
}
// 온실 — 같은 그리기로 12칸짜리 작은 지도를 띄운다.
function openGreenhouse(){
  // 농장 배수는 2.5배 같은 소수일 수 있다. 온실 창은 작으니 정수배로 따로 잡는다.
  const gs = Math.max(1, Math.min(3, Math.round(S)));
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">온실</h3><p class="msg" style="margin:0 0 8px;">어느 계절 씨앗이든 자라고 물도 필요 없어요. 지금 든 도구로 칸을 눌러요.</p>' +
    '<div class="stage"><canvas id="ghCanvas" width="' + (R.GH.w * T * gs) + '" height="' + (R.GH.h * T * gs) + '"></canvas></div><div class="fmsg" id="ghMsg"></div>' +
    '<div class="modal-actions"><button type="button" class="dot-btn small" id="ghClose">닫기</button></div>';
  $('#modal').hidden = false;
  const draw = () => {
    const cv = $('#ghCanvas'); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const keep = ctx, keepS = S; ctx = g; S = gs;
    for (let y = 0; y < R.GH.h; y++) for (let x = 0; x < R.GH.w; x++){ px(x * T, y * T, T, T, (x + y) % 2 ? '#d8ecd0' : '#cfe6c6'); }
    R.plotIds(W, 'gh').forEach(id => drawPlot(id, W.plots[id], true));
    // 작물은 밭 그림과 마찬가지로 흙 위에 따로 얹는다
    R.plotIds(W, 'gh').forEach(id => {
      const p = W.plots[id]; if (!p || !p.crop || p.giant) return;
      const q = R.parseId(id);
      drawCrop(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, null, 0);
    });
    R.plotIds(W, 'gh').forEach(id => { const p = W.plots[id]; if (p && p.giant && p.pairOf && id < p.pairOf) drawGiant(id, p, 0); });
    ctx = keep; S = keepS;
  };
  draw();
  $('#ghCanvas').addEventListener('click', e => {
    const cv = $('#ghCanvas'), r = cv.getBoundingClientRect(); const w = r.width || cv.width, h = r.height || cv.height;
    const tx = Math.floor((e.clientX - r.left) / w * cv.width / gs / T), ty = Math.floor((e.clientY - r.top) / h * cv.height / gs / T);
    if (tx < 0 || ty < 0 || tx >= R.GH.w || ty >= R.GH.h) return;
    onPlot('g' + tx + ',' + ty); draw(); $('#ghMsg').innerHTML = $('#fmsg').innerHTML;
  });
  $('#ghClose').addEventListener('click', closeModal);
}
function closeModal(){ $('#modal').hidden = true; }

// ---------- 우편함 ----------
function openMail(){
  const box = W.mail[key] || [];
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">우편함</h3>' + (box.length ? box.map(g =>
    '<div class="mailrow"><b>' + (g.id === 'coins' ? '🪙 ' + g.n + ' 동전' : escapeHTML(R.itemName(g.id)) + ' ' + g.n + '개') + '</b>' +
    '<span class="from">' + (g.from === 'festival' ? '축제' : g.from === 'board' ? '게시판' : NAME[g.from] || '') + (g.note ? ' · "' + escapeHTML(g.note) + '"' : '') + '</span></div>').join('') :
    '<p class="msg">비었어요. ' + NAME[R.OTHER[key]] + '가 선물을 보내면 여기로 와요.</p>') +
    '<div class="modal-actions">' + (box.length ? '<button type="button" class="dot-btn small primary" id="mailTake">다 받기</button>' : '') + '<button type="button" class="dot-btn small" id="mailClose">닫기</button></div>';
  $('#modal').hidden = false;
  $('#mailClose').addEventListener('click', closeModal);
  const t = $('#mailTake'); if (t) t.addEventListener('click', () => { const r = act((w, m) => R.openMail(w, m)); if (r.ok) sfx('fanfare'); closeModal(); });
}

/* 행상인 창. 세 자리는 날짜로 정해지므로 둘이 같은 물건을 본다.
   하나씩 각자 한 번만 살 수 있다 — 한 사람이 싹쓸이하면 다른 하나가 서운하다. */
function openPeddler(){
  const stock = R.peddlerStock(W, now());
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">🛒 행상인</h3><p class="sub">이레에 두 번쯤 와요. 오늘 물건은 셋, 둘이 하나씩 살 수 있어요.</p>'
    + '<div id="pedRows"></div><div class="modal-actions"><button type="button" class="dot-btn small" id="pedClose">닫기</button></div>';
  const rows = $('#pedRows');
  stock.forEach(it => {
    const got = R.peddlerGot(M, now(), it.slot);
    const d = document.createElement('div'); d.className = 'mailrow';
    d.innerHTML = '<b>' + escapeHTML(R.itemName(it.id)) + (it.n > 1 ? ' ' + it.n + '개' : '') + '</b>'
      + '<span class="from">' + escapeHTML(it.desc) + '</span>';
    const b = btn(got ? '샀어요' : '🪙 ' + it.cost, 'sm buy', () => {
      const r = act((w, m) => R.buy(w, m, 'ped:' + it.slot, now()));
      if (r.ok) sfx(r.box ? 'fanfare' : 'pop');
      openPeddler();
    }, got || M.coins < it.cost);
    b.style.marginLeft = 'auto';
    d.appendChild(b); rows.appendChild(d);
  });
  $('#modal').hidden = false;
  $('#pedClose').addEventListener('click', closeModal);
}

// ---------- 탭 ----------
function openTab(t){ tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); ['bag', 'shop', 'house', 'duo', 'dex'].forEach(k => { $('#tab-' + k).hidden = k !== t; }); renderTab(); }
function renderTab(){ if (tab === 'bag') renderBag(); else if (tab === 'shop') renderShop(); else if (tab === 'house') renderHouse(); else if (tab === 'duo') renderDuo(); else renderDex(); }
function renderAll(){ syncTop(); renderTools(); drawFarm(); renderTab(); }

// 작은 그림 — 작물은 밭 그림을, 물건은 색 네모를.
function cropIcon(c){
  // 한 칸이 32도트가 되었으니 아이콘도 32x32 에 한 도트 한 픽셀로 그린다
  const cv = document.createElement('canvas'); cv.width = T; cv.height = T;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#e6d7b5'; g.fillRect(0, 0, T, T);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  drawCrop(0, 0, c, 4, false, P);
  return cv;
}
function itemIcon(id){
  const [k, v] = id.split(':');
  if (k === 'gold'){                                    // 반짝 작물 — 같은 그림에 금테와 반짝임을 두른다
    const cv = cropIcon(v), g = cv.getContext('2d');
    g.fillStyle = '#ffd979'; g.fillRect(0, 0, 32, 2); g.fillRect(0, 30, 32, 2); g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32);
    g.fillStyle = '#fff6c0'; g.fillRect(24, 4, 2, 2); g.fillRect(22, 6, 6, 2); g.fillRect(24, 8, 2, 2);
    return cv;
  }
  if (k === 'crop' || k === 'seed' || k === 'giant') { const cv = cropIcon(v); if (k === 'seed'){ const g = cv.getContext('2d'); g.fillStyle = '#fff6e9cc'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#8a5f3a'; g.fillRect(10, 12, 4, 6); g.fillRect(18, 10, 4, 6); g.fillRect(14, 18, 4, 6); } return cv; }
  if (k === 'fish'){
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * 2, y * 2, w * 2, h * 2); };
    P(0, 0, 16, 16, '#bfe4f7'); P(0, 0, 16, 5, '#d7eefb');
    const F = R.FISH[v] || { c: '#a9c4d6' };
    if (v === 'boot'){ P(4, 6, 6, 8, F.c); P(4, 12, 9, 2, shade(F.c, -22)); P(5, 5, 4, 2, shade(F.c, 20)); }
    else {
      P(3, 6, 9, 5, F.c); P(3, 7, 7, 2, shade(F.c, 26)); P(6, 9, 6, 2, shade(F.c, -26));
      P(11, 5, 3, 2, F.c); P(11, 10, 3, 2, F.c); P(12, 6, 2, 5, shade(F.c, -18));
      P(2, 7, 1, 1, '#2a2a2a'); P(5, 5, 3, 1, shade(F.c, 30));
    }
    return cv;
  }
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; const g = cv.getContext('2d');
  const col = { egg: '#fff6e9', bigegg: '#ffe9a8', milk: '#ffffff', goldmilk: '#ffd979', wool: '#f7f3ee', honey: '#f7b733', berry: '#ff5c6b', wood: '#a97b4f', stone: '#a49c92', fert: '#8a5f3a', snowball: '#eef8ff', sprinkler: '#b9924a', firefly: '#ffe66d' }[id] || (k === 'dish' ? '#ffb3a7' : k === 'f' ? R.FURNITURE[v].c : '#ddd');
  g.fillStyle = '#e6d7b5'; g.fillRect(0, 0, 32, 32); g.fillStyle = col; g.fillRect(8, 8, 16, 16); g.fillStyle = '#3a3226'; g.fillRect(8, 8, 16, 2); g.fillRect(8, 22, 16, 2); g.fillRect(8, 8, 2, 16); g.fillRect(22, 8, 2, 16);
  return cv;
}
/* 가게에서 가구를 고를 때는 색 네모 말고 실제 그림을 보여 준다. 도트 배수를 1로
   낮춰 그린 뒤 그대로 붙인다 — 카드 폭 안에 대개 제 크기로 들어간다. */
function furnPreview(f){
  const wrap = document.createElement('div'); wrap.className = 'fprev';
  const keep = HS; HS = 1;
  try {
    const F = R.FURNITURE[f];
    const cv = document.createElement('canvas');
    if (WALL_KINDS[F.kind]){
      cv.width = 42; cv.height = 54;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      paintWallItem((u, v, uw, vh, c) => { g.fillStyle = c; g.fillRect(u + 1, v - 4, Math.max(1, uw), Math.max(1, vh)); }, 0, f, roomPal('sua'));
    } else {
      const A = furnArt(f, 0), bm = furnBitmap(f, 0, A, 0);
      cv.width = bm.width; cv.height = bm.height;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(bm, 0, 0);
    }
    wrap.appendChild(cv);
  } catch (e){ /* 그림이 없어도 카드는 나와야 한다 */ }
  HS = keep;
  return wrap;
}
function itemCard(id, n, actions, cls){
  const d = document.createElement('div'); d.className = 'item' + (cls ? ' ' + cls : '');
  const nm = document.createElement('div'); nm.className = 'nm'; nm.appendChild(itemIcon(id));
  nm.appendChild(document.createTextNode(R.itemName(id)));
  if (n != null){ const c = document.createElement('span'); c.className = 'cnt'; c.textContent = '×' + n; nm.appendChild(c); }
  d.appendChild(nm);
  return d;
}
function btn(label, cls, fn, disabled){ const b = document.createElement('button'); b.type = 'button'; b.className = cls || ''; b.innerHTML = label; b.disabled = !!disabled; b.addEventListener('click', fn); return b; }

function renderBag(){
  const mi = R.missionOf(W, M, now());
  const mbox = $('#mission'); mbox.className = 'mission' + (mi.done ? ' done' : '');
  mbox.innerHTML = '<b>오늘의 할 일</b> ' + mi.m.text + ' — ' + Math.min(mi.got, mi.m.n) + '/' + mi.m.n + (mi.done ? ' · 받았어요' : mi.got >= mi.m.n ? ' <button type="button" class="sm" id="missionTake">🪙 ' + mi.m.coins + ' 받기</button>' : ' (🪙 ' + mi.m.coins + ')');
  const mt = $('#missionTake'); if (mt) mt.addEventListener('click', () => { act((w, m) => { if (!m.day || m.day.key !== R.dayKey(now()) || m.day.missionDone) return { ok: false, msg: '이미 받았어요' }; m.day.missionDone = true; m.coins += mi.m.coins; return { ok: true, msg: '🪙 ' + mi.m.coins + ' 받았어요' }; }); sfx('fanfare'); });
  $('#priceMult').textContent = '×' + R.priceMult(W, now()).toFixed(1);
  $('#hotCrop').textContent = W.hot && R.CROPS[W.hot] ? R.CROPS[W.hot].name + ' ×1.5' : '-';
  const box = $('#bag'); box.innerHTML = '';
  const ids = Object.keys(M.inv).filter(k => M.inv[k] > 0).sort();
  $('#bagCount').textContent = ids.length ? ids.length + '가지' : '';
  if (!ids.length){ box.innerHTML = '<p class="sub">비었어요. 밭에서 거두거나 나무를 베어 와요.</p>'; return; }
  ids.forEach(id => {
    const n = M.inv[id], price = R.sellPrice(id, W, now()), food = R.foodOf(id);
    const card = itemCard(id, n, null, W.hot && id === 'crop:' + W.hot ? 'hot' : '');
    const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = (price ? '🪙 ' + price + '개당' : '팔지 않아요') + (food ? ' · ⚡ ' + food : ''); card.appendChild(pr);
    const a = document.createElement('div'); a.className = 'act';
    if (price){ a.appendChild(btn('팔기', 'sell', () => { act((w, m) => R.sell(w, m, id, 1, now())); sfx('pop'); })); if (n > 1) a.appendChild(btn('다 팔기', 'sell', () => { const k = n; act((w, m) => R.sell(w, m, id, k, now())); sfx('pop'); })); }
    if (food) a.appendChild(btn('먹기', '', () => act((w, m) => R.eat(w, m, id, now()))));
    if (id.startsWith('f:')) a.appendChild(btn('집에 놓기', '', () => { furnPick = id.slice(2); openTab('house'); }));
    a.appendChild(btn('선물', '', () => giftDialog(id, n)));
    card.appendChild(a); box.appendChild(card);
  });
}
function giftDialog(id, have){
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">' + NAME[R.OTHER[key]] + '에게 보내기</h3><p class="msg" style="margin:0;">' + escapeHTML(R.itemName(id)) + ' — ' + have + '개 있어요</p>' +
    '<input type="number" id="gN" aria-label="보낼 개수" min="1" max="' + have + '" value="1"><input type="text" id="gNote" maxlength="40" placeholder="한 마디 (선택)">' +
    '<div class="modal-actions"><button type="button" class="dot-btn small" id="gCancel">취소</button><button type="button" class="dot-btn small primary" id="gGo">보내기</button></div>';
  $('#modal').hidden = false;
  $('#gCancel').addEventListener('click', closeModal);
  $('#gGo').addEventListener('click', () => { const n = Math.max(1, Math.min(have, Number($('#gN').value) || 1)), note = $('#gNote').value; const r = act((w, m) => R.sendGift(w, m, id, n, note, now())); if (r.ok) sfx('sparkle'); closeModal(); });
}

const SHOP_TABS = [['seed', '🌱 씨앗'], ['tool', '🔧 도구·밭'], ['animal', '🐔 동물'], ['furn', '🛋️ 가구'], ['deco', '🌼 꾸미기'], ['recipe', '📜 요리법']];
function renderShop(){
  const st = $('#shoptabs'); st.innerHTML = '';
  SHOP_TABS.forEach(([k, l]) => st.appendChild(btn(l, shopTab === k ? 'on' : '', () => { shopTab = k; renderShop(); })));
  const box = $('#shop'); box.innerHTML = '';
  const cal = R.calendar(W, now()), lv = R.levelOf(M.xp);
  const buyBtn = (id, cost, ok) => btn('🪙 ' + cost, 'buy', () => { const r = act((w, m) => R.buy(w, m, id, now())); if (r.ok) sfx(r.animal ? 'fanfare' : 'pop'); if (r.animal) nameDialog(r.animal); renderShop(); }, !ok);
  if (shopTab === 'seed'){
    const gh = built('greenhouse');
    $('#shopSub').innerHTML = R.SEASON_NAME[cal.season] + ' 씨앗. 흐린 것은 <b>' + NAME[R.OTHER[key]] + '의 가게</b>에만 있어요 — 선물로 받아요. 다음 계절(' + R.SEASON_NAME[R.nextSeason(cal.season)] + ') 씨앗은 ' + (gh ? '지금도 살 수 있어요 — 온실에서 자라요.' : '구경만 해요 — 그 계절이 오면 살 수 있어요.');
    const list = R.CROP_IDS.filter(c => R.CROPS[c].seed > 0 && (R.CROPS[c].season.indexOf(cal.season) >= 0 || R.CROPS[c].season.indexOf(R.nextSeason(cal.season)) >= 0));
    list.forEach(c => {
      const C = R.CROPS[c], mineHalf = !C.half || C.half === key, lvOk = (C.lv || 1) <= lv, inSeason = C.season.indexOf(cal.season) >= 0;
      // 지금 심을 수 없는 씨앗은 사지 못한다 — 온실이 있으면 아무 때나 자라니 그때만 열린다
      const seasonOk = inSeason || C.hardy || gh;
      const card = itemCard('seed:' + c, M.inv['seed:' + c] || 0, null, (!mineHalf || !lvOk || !seasonOk ? 'locked' : '') + (W.hot === c ? ' hot' : ''));
      const pr = document.createElement('div'); pr.className = 'pr';
      pr.innerHTML = C.hours + '시간 · 🪙 ' + C.sell + (C.yield > 1 ? '×' + C.yield : '') + (C.regrow ? ' · 또 열려요' : '') + (C.giant ? ' · <b>둘이 나란히 심으면 큰 것</b>' : '') + (C.flower ? ' · 꽃' : '') +
        (!inSeason ? '<br>' + (gh ? '온실에서만 자라요 · ' : R.SEASON_NAME[cal.season] + '에는 못 사요 · ') + C.season.map(s => R.SEASON_NAME[s]).join('·') + '에 심어요' : '') +
        (!lvOk ? '<br>레벨 ' + C.lv + '부터' : '') + (!mineHalf ? '<br>' + NAME[C.half] + '의 가게' : '');
      card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('seed:' + c, C.seed, mineHalf && lvOk && seasonOk && M.coins >= C.seed)); card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'tool'){
    $('#shopSub').textContent = '도구가 좋아지면 한 번에 여러 칸. 밭은 넓힐수록 칸이 늘어요.';
    Object.keys(R.TOOLS).forEach(t => {
      const Tt = R.TOOLS[t], cur = M.tools[t] || 0, nx = Tt.levels[cur + 1];
      const card = document.createElement('div'); card.className = 'item';
      card.innerHTML = '<div class="nm">' + Tt.icon + ' ' + Tt.name + ' ' + (cur + 1) + '단계</div><div class="pr">지금 한 번에 ' + Tt.levels[cur].n + '칸' + (nx ? ' → ' + nx.n + '칸' + (nx.need ? ' (' + R.BUILDINGS[nx.need].name + ' 필요)' : '') : ' · 최고예요') + '</div>';
      if (nx){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('tool:' + t, nx.cost, M.coins >= nx.cost && (!nx.need || built(nx.need)))); card.appendChild(a); }
      box.appendChild(card);
    });
    const nxE = R.EXPANSIONS[(W.expand || 0) + 1];
    const card = document.createElement('div'); card.className = 'item';
    card.innerHTML = '<div class="nm">🟫 밭 넓히기</div><div class="pr">지금 ' + R.EXPANSIONS[W.expand || 0].w + '×' + R.EXPANSIONS[W.expand || 0].h + (nxE ? ' → ' + nxE.w + '×' + nxE.h + ' · 레벨 ' + nxE.lv + '부터' : ' · 제일 넓어요') + '</div>';
    if (nxE){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('expand:1', nxE.cost, M.coins >= nxE.cost && lv >= nxE.lv)); card.appendChild(a); }
    box.appendChild(card);
    const sp = document.createElement('div'); sp.className = 'item';
    sp.innerHTML = '<div class="nm">⛲ ' + R.SPRINKLER.name + '</div><div class="pr">밭 한 칸을 차지하고, 아침마다 둘레 네 칸에 물을 줘요 · 레벨 ' + R.SPRINKLER.lv + '부터 · 가진 것 ' + (M.inv.sprinkler || 0) + '개</div>';
    const spa = document.createElement('div'); spa.className = 'act'; spa.appendChild(buyBtn('sprinkler:1', R.SPRINKLER.cost, M.coins >= R.SPRINKLER.cost && lv >= R.SPRINKLER.lv)); sp.appendChild(spa); box.appendChild(sp);
    const fc = document.createElement('div'); fc.className = 'item'; fc.innerHTML = '<div class="nm">🧪 비료</div><div class="pr">1.5배 빨리. 일기를 쓰면 공짜로 하나</div>';
    const fa = document.createElement('div'); fa.className = 'act'; fa.appendChild(buyBtn('fert:1', 30, M.coins >= 30)); fc.appendChild(fa); box.appendChild(fc);
  } else if (shopTab === 'animal'){
    $('#shopSub').textContent = '닭장·외양간을 먼저 지어요(둘이서 탭). 한 곳에 네 마리까지.';
    Object.keys(R.ANIMALS).forEach(k => {
      const A = R.ANIMALS[k], ok = built(A.need);
      const card = document.createElement('div'); card.className = 'item' + (ok ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; cv.getContext('2d').imageSmoothingEnabled = false; drawAnimalAt(cv.getContext('2d'), k, 4, 5, 1);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.appendChild(cv); nm.appendChild(document.createTextNode(A.name)); card.appendChild(nm);
      const what = A.product ? R.itemName(A.product) + (A.every > 1 ? ' ' + A.every + '일마다' : ' 날마다')
                             : A.find.map(f => R.itemName(f)).join('·') + ' 중 하나를 날마다 물어 와요';
      const pr = document.createElement('div'); pr.className = 'pr';
      pr.textContent = what + (A.best ? ' · 마음 ' + R.LOVE_FOR_BEST + '이면 ' + R.itemName(A.best) : '') + ' · 마음 ' + R.LOVE_FOR_BABY + '이면 새끼를 봐요' + (ok ? '' : ' · ' + R.BUILDINGS[A.need].name + ' 필요');
      card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('animal:' + k, A.cost, ok && M.coins >= A.cost)); card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'furn'){
    $('#shopSub').textContent = '사면 가방에 들어와요. 집 탭에서 놓아요. 좋은 침대는 기운을 늘려 줘요.';
    // 쉰 가지가 넘으니 싼 것부터 세운다 — 아이가 가진 돈으로 살 수 있는 것이 먼저 보인다
    const furnList = Object.keys(R.FURNITURE).filter(f => !R.FURNITURE[f].rare && R.FURNITURE[f].cost > 0);
    furnList.sort((a, b) => R.FURNITURE[a].cost - R.FURNITURE[b].cost);
    furnList.forEach(f => {
      const Fu = R.FURNITURE[f], seasonOk = !Fu.season || Fu.season === cal.season;
      const card = itemCard('f:' + f, M.inv['f:' + f] || 0, null, seasonOk ? '' : 'locked');
      card.insertBefore(furnPreview(f), card.firstChild);
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = '아늑함 +' + Fu.cozy + (Fu.energy ? ' · 기운 +' + Fu.energy : '') + (Fu.wall ? ' · 벽에 걸어요' : Fu.w > 1 ? ' · ' + Fu.w + '칸' : '') + (Fu.season ? ' · ' + R.SEASON_NAME[Fu.season] + '에만' : ''); card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('f:' + f, Fu.cost, seasonOk && M.coins >= Fu.cost)); card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'deco'){
    $('#shopSub').textContent = '농장에 놓는 것. 혼자 사도 돼요 — 둘의 농장에 남아요.';
    Object.keys(R.DECOR).forEach(d => {
      const Dc = R.DECOR[d], have = W.decor && W.decor[d];
      const card = document.createElement('div'); card.className = 'item' + (have ? ' locked' : '');
      card.innerHTML = '<div class="nm">' + Dc.icon + ' ' + Dc.name + '</div><div class="pr">' + (Dc.desc || '') + (have ? ' · ' + NAME[have.by] + '가 놓았어요' : ' · 레벨 ' + Dc.lv + '부터') + '</div>';
      if (!have){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('deco:' + d, Dc.cost, M.coins >= Dc.cost && lv >= Dc.lv)); card.appendChild(a); }
      box.appendChild(card);
    });
  } else {
    $('#shopSub').textContent = '요리법을 알면 부엌에서 만들 수 있어요. 요리는 비싸게 팔리고 기운도 많이 돌려줘요.';
    Object.keys(R.DISHES).forEach(d => {
      const Dd = R.DISHES[d], know = M.recipes.indexOf(d) >= 0, lvOk = Dd.lv <= lv;
      const card = itemCard('dish:' + d, null, null, know || !lvOk ? 'locked' : '');
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = Object.keys(Dd.need).map(k => R.itemName(k) + ' ' + Dd.need[k]).join(' + ') + ' · 🪙 ' + Dd.sell + ' · ⚡ ' + Dd.food + (know ? ' · 알아요' : !lvOk ? ' · 레벨 ' + Dd.lv + '부터' : ''); card.appendChild(pr);
      if (!know && lvOk){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('recipe:' + d, Dd.sell, M.coins >= Dd.sell)); card.appendChild(a); }
      box.appendChild(card);
    });
  }
}
function nameDialog(a){
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">' + R.ANIMALS[a.kind].name + '의 이름</h3><input type="text" id="aName" maxlength="8" placeholder="예: 꼬꼬">' +
    '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="aGo">정했어요</button></div>';
  $('#modal').hidden = false;
  $('#aGo').addEventListener('click', () => { const nm = $('#aName').value; if (nm.trim()) act((w, m) => R.rename(w, m, a.id, nm)); closeModal(); });
}

// ---------- 집 ----------
// ---------- 집 안 ----------
// 농장과 같은 방식으로 두 겹으로 그린다. 벽지와 마루는 뒤 캔버스에 한 번,
// 가구와 아이와 빛은 그 위에 매번. 가구는 작은 버퍼에 그린 뒤 돌려서 붙이므로
// 그림을 네 방향으로 따로 그릴 필요가 없다.
let HS = 3;                                        // 방도 정수배로 — fitPixelCanvas 가 정한다
/* 방은 아이소메트릭(2:1)으로 그린다. 칸 하나가 가로 48 · 세로 24 도트인 마름모다.
   전에는 위에서 내려다본 바닥에 옆에서 본 아이를 세워 두어 시점이 둘로 갈렸다.
   벽 두 면과 비스듬한 바닥을 함께 그리면 아이·가구·바닥이 한 시점으로 모인다. */
const TW = 48, TH = 24;                            // 칸 하나의 가로·세로(도트)
const WALLH = 104;                                 // 벽 높이(도트)
// 뒤 구석은 왼쪽 끝에서 방 깊이만큼 떨어진 자리에 온다
function isoOx(Rm){ return Rm.h * (TW / 2); }
// 칸 (x,y) 마름모의 뒤 꼭짓점
function isoX(Rm, x, y){ return (Rm.h + x - y) * (TW / 2); }
function isoY(x, y){ return WALLH + (x + y) * (TH / 2); }
function roomArt(Rm){ return { w: (Rm.w + Rm.h) * (TW / 2), h: WALLH + (Rm.w + Rm.h) * (TH / 2) }; }
// 화면 도트 → 칸. 마름모 경계를 정확히 가른다.
function dotTile(Rm, px, py){
  const a = (px - isoOx(Rm)) / TW, b = (py - WALLH) / TH;
  return { tx: Math.floor(b + a), ty: Math.floor(b - a) };
}
/* 아이소메트릭 면을 도트로 채우는 세 가지. 캔버스 path 로 채우면 비스듬한 가장자리를
   부드럽게 뭉개 버려 도트 그림이 망가진다 — 2도트마다 1도트씩 내려가는 계단을 손으로 쌓는다.
   ew 는 오른쪽아래 방향, eh 는 왼쪽아래 방향의 가로 반지름(도트). (cx,cy) 는 뒤 꼭짓점. */
/* 도트 하나를 화면에 채운다. HS 가 2.083 처럼 소수일 때 폭을 round(w*HS) 로 잡으면
   여섯 기둥마다 1픽셀이 비어 캔버스가 비친다 — 왼쪽 끝과 오른쪽 끝을 따로 반올림해 잇는다. */
function dotFill(g){
  return (x, y, w, h, c) => {
    const x0 = Math.round(x * HS), y0 = Math.round(y * HS);
    g.fillStyle = c;
    g.fillRect(x0, y0, Math.max(1, Math.round((x + w) * HS) - x0), Math.max(1, Math.round((y + h) * HS) - y0));
  };
}
function isoEven(v){ return Math.max(2, Math.floor(v / 2) * 2); }
/* ---- 면의 결 ----
   첫화면 마을은 같은 색이라도 나무에 나뭇결이, 돌에 얼룩이, 천에 짜임이 있어서
   커다란 색 덩어리로 보이지 않는다. 방과 가구도 같게 한다.
   MAT 은 지금 칠하는 면의 재질이다 — 가구마다 한 번 정하고, 유리·쇠처럼 다른 면만 그때그때 바꾼다.
   MATSEED 는 같은 가구가 늘 같은 결을 갖게 하는 씨앗. 결과 모서리 빛은 색이 '#' 일 때만 얹는다
   (발밑 그림자처럼 반투명한 면에 얹으면 얼룩이 진다). */
let MAT = 'plain', MATSEED = 'x';
const isHex = c => typeof c === 'string' && c.charCodeAt(0) === 35;
// 윗면 한 줄에 결을 얹는다. j 는 뒤 꼭짓점에서 내려온 줄 번호
function texTop(q, cx, cy, j, xL, xR, col, H){
  if (MAT === 'wood'){
    for (let x = xL; x < xR; x += 2){
      const v = R.prand('wt' + MATSEED + ((x - j * 2) >> 2));       // 결이 오른쪽아래로 흐른다
      if (v > 0.82) q(cx + x, cy + j, 2, 1, shade(col, -15));
      else if (v < 0.14) q(cx + x, cy + j, 2, 1, shade(col, 11));
    }
  } else if (MAT === 'cloth'){
    if (j % 3 === 0) for (let x = xL + (j % 6 ? 0 : 2); x < xR; x += 6) q(cx + x, cy + j, 2, 1, shade(col, 10));
  } else if (MAT === 'stone'){
    for (let x = xL; x < xR; x += 4){
      const v = R.prand('st' + MATSEED + (x >> 2) + '_' + (j >> 1));
      if (v > 0.68) q(cx + x, cy + j, 4, 1, shade(col, v > 0.88 ? 13 : -13));
    }
  } else if (MAT === 'metal' || MAT === 'glass'){
    if (j === Math.round(H * 0.34)) q(cx + xL, cy + j, xR - xL, 1, shade(col, 20));
  }
}
// 옆면 기둥 하나에 결을 얹는다. i 는 몇 번째 기둥인가
function texSide(q, x, y, hgt, col, i){
  if (MAT === 'wood'){
    const v = R.prand('ws' + MATSEED + i);
    if (v > 0.72) q(x, y, 2, hgt, shade(col, -12));
    else if (v < 0.16) q(x, y, 2, hgt, shade(col, 9));
  } else if (MAT === 'cloth'){
    for (let z = 2; z < hgt; z += 4) if ((i + z) % 8 < 4) q(x, y + z, 2, 1, shade(col, 8));
  } else if (MAT === 'metal' || MAT === 'glass'){
    if (i === 2 || i === 6) q(x, y, 2, hgt, shade(col, 22));        // 세로로 길게 반짝
  } else if (MAT === 'stone'){
    for (let z = 0; z < hgt; z += 3){
      const v = R.prand('ss' + MATSEED + i + '_' + z);
      if (v > 0.72) q(x, y + z, 2, 3, shade(col, v > 0.9 ? 12 : -13));
    }
  }
}
function isoTop(q, cx, cy, ew, eh, col){
  ew = isoEven(ew); eh = isoEven(eh);
  const H = (ew + eh) / 2, fine = isHex(col) && ew >= 8 && eh >= 8;
  for (let j = 0; j < H; j++){
    const xL = j < eh / 2 ? -2 * j - 2 : 2 * j - 2 * eh;
    const xR = j < ew / 2 ?  2 * j + 2 : 2 * ew - 2 * j;
    if (xR <= xL) continue;
    q(cx + xL, cy + j, xR - xL, 1, col);
    if (!fine) continue;
    if (MAT !== 'plain') texTop(q, cx, cy, j, xL, xR, col, H);
    // 위쪽 두 모서리는 빛을 받는다 — 한 줄만 밝게 두면 면이 서로 떨어져 보인다
    if (j < eh / 2) q(cx + xL, cy + j, 2, 1, shade(col, 15));
    if (j < ew / 2) q(cx + xR - 2, cy + j, 2, 1, shade(col, 15));
  }
}
function isoSideL(q, cx, cy, ew, eh, hgt, col){     // 왼쪽아래를 보는 옆면
  ew = isoEven(ew); eh = isoEven(eh);
  const fine = isHex(col) && hgt >= 6;
  for (let i = 0; i < ew; i += 2){
    const x = cx - eh + i, y = cy + eh / 2 + i / 2;
    q(x, y, 2, hgt, col);
    if (!fine) continue;
    if (MAT !== 'plain') texSide(q, x, y, hgt, col, i);
    q(x, y, 2, 1, shade(col, 14));                  // 윗모서리 빛
    q(x, y + hgt - 2, 2, 2, shade(col, -13));       // 바닥에 닿는 쪽은 어둡다
  }
}
function isoSideR(q, cx, cy, ew, eh, hgt, col){     // 오른쪽아래를 보는 옆면
  ew = isoEven(ew); eh = isoEven(eh);
  const fine = isHex(col) && hgt >= 6;
  for (let i = 0; i < eh; i += 2){
    const x = cx + ew - i - 2, y = cy + ew / 2 + (i + 2) / 2;
    q(x, y, 2, hgt, col);
    if (!fine) continue;
    if (MAT !== 'plain') texSide(q, x, y, hgt, col, i);
    q(x, y, 2, 1, shade(col, 12));
    q(x, y + hgt - 2, 2, 2, shade(col, -13));
  }
}
function isoBox(q, cx, cy, ew, eh, hgt, top, lf, rt){
  if (hgt > 0){ isoSideL(q, cx, cy, ew, eh, hgt, lf); isoSideR(q, cx, cy, ew, eh, hgt, rt); }
  isoTop(q, cx, cy, ew, eh, top);
}
function roomPal(r){
  if (r === 'sua') return { wall: '#ffdfe6', wall2: '#ffd0da', trim: '#e79fb0', rail: '#d98ea1', motif: 'heart', dot: '#ff9ec4', cur: '#f2879f',
                            wain: '#f6e3e6', wainL: '#fff2f4', base: '#c98a98', floor: ['#c9a074', '#b78d61', '#d7b28a', '#a67c55'] };
  if (r === 'yona') return { wall: '#dbf3ec', wall2: '#c8e9df', trim: '#8ecbba', rail: '#79bba8', motif: 'star', dot: '#ffd85c', cur: '#69b8a2',
                            wain: '#e6f5f0', wainL: '#f3fbf8', base: '#7fae9e', floor: ['#c9a074', '#b78d61', '#d7b28a', '#a67c55'] };
  return { wall: '#fff1da', wall2: '#f6e2c1', trim: '#d9b784', rail: '#c9a26d', motif: 'stripe', dot: '#e8c98a', cur: '#c98f63',
           wain: '#f2e3c9', wainL: '#fbf1de', base: '#b08d5f', floor: ['#b78d63', '#a67c55', '#c69c72', '#966d4a'] };
}
// 창밖 하늘 — 농장과 같은 시계를 본다
function skyColors(L){
  if (L.dark > 0.42) return { top: '#141a46', bot: '#2b2f66', star: true };
  if (L.dark > 0.2)  return { top: '#6b4a86', bot: '#d1667e', star: false };
  if (L.dark > 0.08) return { top: '#ffb478', bot: '#ffe6b0', star: false };
  return { top: '#8ec9ee', bot: '#cfe9fa', star: false };
}
let houseBg = null, houseSig = '';
// 벽을 나눈 자리 — 벽 꼭대기에서 내려온 거리(도트)
const W_MOULD = 6, W_RAIL = 66, W_WAIN = 70, W_BASE = 98;
const WALL_KINDS = { frame: 1, poster: 1, clock: 1, mirror: 1, window: 1, stars: 1,
                     board: 1, garland: 1, wshelf: 1, rainbow: 1,
                     heightbar: 1, worldmap: 1, mobile: 1, wreath: 1,
                     whale: 1, wlight: 1 };
/* 벽에 거는 것은 어느 벽에 붙나. 칸에서 뒤로 물러났을 때 더 가까운 벽에 건다.
   (y 쪽이 가까우면 오른쪽 벽, x 쪽이 가까우면 왼쪽 벽) */
function wallSlot(Rm, x, y){
  return (y <= x) ? { side: 1, at: x, len: Rm.w } : { side: -1, at: y, len: Rm.h };
}
/* 벽에 거는 것. 가로 40 · 세로 6~58 안에 그린다 — 전에는 32×40 이라 그림이 굵었다.
   벽이 2도트마다 한 도트씩 내려가므로 가로 자리와 폭은 늘 짝수로 잡는다.
   세로는 1도트까지 쓸 수 있어서, 테와 매트와 반사는 거기서 벌어 온다. */
function paintWallItem(wall, u, f, P){
  const F = R.FURNITURE[f], c = F.c;
  const hi = shade(c, 24);
  const w = (x, y, ww, hh, col) => wall(u + x, y, ww, hh, col);
  // 못 하나와 걸이줄 — 벽에 걸려 있다는 표시
  const hang = (cx, top, half) => {
    w(cx - 1, top, 2, 2, '#6f6257');
    w(cx - half, top + 2, 2, 3, '#8a7b6e'); w(cx + half - 2, top + 2, 2, 3, '#8a7b6e');
  };
  switch (F.kind){
    case 'frame': {
      hang(20, 5, 8);
      w(6, 10, 28, 30, '#5a3c26');                                   // 바깥 테
      w(6, 10, 28, 2, '#a97b4f'); w(6, 38, 28, 2, '#3f2a1a');
      w(6, 10, 2, 30, '#8a5f3a'); w(32, 10, 2, 30, '#3f2a1a');
      w(8, 12, 24, 26, '#c79b6d');                                   // 안쪽 테
      w(8, 12, 24, 2, '#e0b98e'); w(8, 36, 24, 2, '#a3784c');
      w(10, 14, 20, 22, '#fff6e9');                                  // 매트
      w(10, 14, 20, 1, '#e8dcc8'); w(10, 35, 20, 1, '#e8dcc8');
      w(12, 16, 16, 18, c);                                          // 그림 — 하늘
      w(12, 26, 16, 8, '#7fbf6f');                                   // 언덕
      w(12, 26, 16, 1, '#9ad189'); w(12, 30, 16, 1, '#6aa85e');
      w(22, 18, 6, 6, '#ffd979'); w(24, 19, 2, 2, '#fff3c0');        // 해
      w(16, 26, 2, 6, '#8a5f3a');                                    // 나무
      w(12, 21, 10, 6, '#4f9a58'); w(14, 20, 6, 2, '#6fb567');
      for (let i = 0; i < 10; i += 2) w(12 + i, 16 + i, 2, 4, 'rgba(255,255,255,0.20)');   // 유리 반사
      w(12, 34, 16, 1, 'rgba(26,18,10,0.20)');
      break;
    }
    case 'poster': {
      w(6, 8, 28, 40, '#fff6e9');                                    // 종이
      w(6, 8, 28, 1, '#ffffff'); w(6, 47, 28, 1, '#e0d4c0');
      w(8, 10, 24, 36, c);                                           // 인쇄된 바탕
      w(8, 10, 24, 1, hi);
      w(10, 12, 20, 16, shade(c, 30));                               // 그림 자리
      w(10, 22, 20, 6, shade(c, -14));
      w(14, 15, 6, 6, '#fff3c0'); w(22, 17, 4, 4, '#ffffff');
      w(10, 32, 20, 2, '#3a3226'); w(10, 36, 14, 2, '#3a3226');      // 글줄
      w(10, 40, 8, 2, '#3a3226'); w(20, 40, 6, 2, shade(c, -30));
      [[6, 8], [28, 8], [6, 44], [28, 44]].forEach(pp => {           // 네 귀퉁이 테이프
        w(pp[0], pp[1], 6, 4, 'rgba(255,255,255,0.55)');
        w(pp[0], pp[1], 6, 1, 'rgba(255,255,255,0.85)');
      });
      w(8, 46, 24, 1, 'rgba(26,18,10,0.18)');                        // 종이가 살짝 뜬 그림자
      break;
    }
    case 'clock': {
      hang(20, 5, 0);
      w(8, 8, 24, 24, '#6f4a2c');                                    // 나무 테
      w(10, 7, 20, 1, '#a97b4f'); w(8, 8, 24, 1, '#a97b4f'); w(8, 31, 24, 1, '#4f3320');
      w(6, 12, 2, 16, '#6f4a2c'); w(32, 12, 2, 16, '#6f4a2c');
      w(10, 10, 20, 20, c);                                          // 시계판
      w(10, 10, 20, 1, shade(c, 22)); w(10, 29, 20, 1, shade(c, -18));
      [[18, 11], [18, 28], [11, 19], [27, 19]].forEach(pp => w(pp[0], pp[1], 4, 2, '#3a3226'));   // 12·6·9·3
      [[13, 13], [25, 13], [13, 25], [25, 25]].forEach(pp => w(pp[0], pp[1], 2, 2, '#8a7b6e'));
      w(19, 15, 2, 6, '#3a3226');                                    // 긴바늘
      w(20, 20, 5, 2, '#3a3226');                                    // 짧은바늘
      w(18, 19, 4, 4, '#c9646b'); w(19, 20, 2, 2, '#e88a90');        // 가운데 못
      w(18, 32, 4, 10, '#8a5f3a'); w(16, 42, 8, 6, '#ffd166');       // 추
      w(17, 43, 2, 4, '#fff0b8');
      break;
    }
    case 'mirror': {
      hang(20, 5, 0);
      w(8, 8, 24, 40, '#c79b6d');                                    // 테
      w(8, 8, 24, 2, '#e0b98e'); w(8, 46, 24, 2, '#a3784c');
      w(8, 8, 2, 40, '#e0b98e'); w(30, 8, 2, 40, '#a3784c');
      w(10, 10, 20, 36, '#8a7b6e');                                  // 은테
      w(12, 12, 16, 32, c);                                          // 유리
      w(12, 12, 16, 12, shade(c, 22));                               // 비친 벽
      w(12, 34, 16, 10, shade(c, -14));
      for (let i = 0; i < 12; i += 2) w(14 + i, 14 + i, 2, 8, 'rgba(255,255,255,0.32)');   // 비스듬한 빛
      for (let i = 0; i < 6; i += 2) w(22 + i, 30 + i, 2, 5, 'rgba(255,255,255,0.22)');
      w(16, 4, 8, 5, '#c79b6d'); w(18, 3, 4, 2, '#e0b98e');          // 머리 장식
      break;
    }
    case 'stars': {                                                   // 별 조명 — 줄에 매달린 작은 별들
      w(2, 10, 36, 1, '#8a7b6e');
      for (let i = 0; i < 6; i++){
        const x = 4 + i * 6, dip = (i % 2 ? 6 : 2), y = 12 + dip;
        w(x + 2, 11, 1, dip, '#8a7b6e');
        w(x + 2, y, 2, 8, c); w(x, y + 3, 6, 2, c);                  // 별 하나
        w(x + 2, y + 2, 2, 4, '#fff6d0');
        w(x, y + 5, 2, 2, shade(c, -18)); w(x + 4, y + 5, 2, 2, shade(c, -18));
      }
      w(2, 30, 36, 1, '#8a7b6e');
      for (let i = 0; i < 5; i++){
        const x = 7 + i * 6, dip = (i % 2 ? 3 : 7), y = 32 + dip;
        w(x + 2, 31, 1, dip, '#8a7b6e');
        w(x + 2, y, 2, 8, shade(c, -10)); w(x, y + 3, 6, 2, shade(c, -10));
        w(x + 2, y + 2, 2, 4, '#fff6d0');
      }
      break;
    }
    case 'board': {                                                   // 칠판
      w(4, 8, 32, 34, '#8a5f3a');                                     // 나무 테
      w(4, 8, 32, 2, '#b9885a'); w(4, 40, 32, 2, '#6f4a2c');
      w(4, 8, 2, 34, '#a97b4f'); w(34, 8, 2, 34, '#6f4a2c');
      w(6, 10, 28, 30, c);                                            // 칠판
      w(6, 10, 28, 1, shade(c, 14));
      w(8, 13, 18, 2, '#fff6e9'); w(8, 18, 24, 2, '#fff6e9');         // 분필 글씨
      w(8, 23, 14, 2, '#fff6e9'); w(8, 28, 20, 2, '#e8f0d8');
      w(24, 24, 8, 8, '#ffd166'); w(26, 26, 4, 4, '#fff3c0');         // 그려 둔 해
      w(4, 42, 32, 4, '#c79b6d'); w(4, 42, 32, 1, '#e0b98e');         // 분필 받침
      w(8, 43, 6, 2, '#ffffff'); w(16, 43, 4, 2, '#ffd6e6'); w(24, 43, 4, 2, '#c9dce8');
      w(6, 40, 28, 1, 'rgba(26,18,10,0.25)');
      break;
    }
    case 'garland': {                                                 // 사진 줄 두 줄
      const pc = ['#ffd166', '#8fd9c8', '#ffb7d5', '#a9c8ff', '#ff9f8f'];
      for (let row = 0; row < 2; row++){
        const y0 = 10 + row * 22, n = 4 + row;
        for (let i = 0; i < 38; i += 2)                               // 늘어진 줄
          w(i, y0 + Math.round(Math.sin(i / 38 * 3.14) * 3), 2, 1, '#8a6a4a');
        for (let i = 0; i < n; i++){
          const x = 4 + i * (30 / n) * (n === 4 ? 1 : 0.9), X = Math.round(x / 2) * 2;
          const dip = Math.round(Math.sin((X + 1) / 38 * 3.14) * 3);
          w(X + 2, y0 + dip, 2, 3, '#c9b9a4');                        // 집게
          w(X, y0 + dip + 3, 8, 10, '#fff6e9');                       // 사진
          w(X + 1, y0 + dip + 4, 6, 6, pc[(i + row) % 5]);
          w(X + 1, y0 + dip + 11, 6, 1, '#e0d4c0');
        }
      }
      break;
    }
    case 'wshelf': {                                                  // 벽 선반
      w(4, 26, 32, 4, c);                                             // 널
      w(4, 26, 32, 1, shade(c, 26)); w(4, 29, 32, 1, shade(c, -34));
      w(8, 30, 4, 6, shade(c, -20)); w(28, 30, 4, 6, shade(c, -20));  // 받침 두 개
      w(8, 30, 2, 6, shade(c, -6)); w(28, 30, 2, 6, shade(c, -6));
      w(6, 14, 4, 12, '#f2707d'); w(6, 14, 2, 12, '#ff8f96');         // 세워 둔 책 셋
      w(10, 16, 4, 10, '#5aa9e6'); w(10, 16, 2, 10, '#8ecdf5');
      w(14, 12, 4, 14, '#ffd166'); w(14, 12, 2, 14, '#ffe6a8');
      w(20, 20, 8, 6, '#6cc7b3'); w(20, 20, 8, 1, '#8fd9c8');         // 화분
      w(22, 14, 4, 6, '#4f9a58'); w(20, 15, 8, 3, '#6fb567');
      w(30, 20, 6, 6, '#fff6e9'); w(30, 20, 6, 1, '#ffffff');         // 컵
      w(35, 22, 2, 2, '#e8dcc8');
      w(4, 30, 32, 1, 'rgba(26,18,10,0.22)');
      break;
    }
    case 'rainbow': {                                                 // 무지개 — 가운데가 가장 높은 반원
      const rc = ['#ff8fb8', '#ffb26b', '#ffe066', '#8fd98f', '#7fc4f0', '#b79ae8'];
      for (let x = 0; x < 40; x += 2){
        const t2 = (x - 19) / 19, dip = Math.round(16 * t2 * t2);
        rc.forEach((col, i) => w(x, 12 + dip + i * 3, 2, 3, col));
      }
      [[0, 34], [30, 34]].forEach(pp => {                             // 양 끝 구름
        w(pp[0], pp[1], 10, 6, '#ffffff');
        w(pp[0] + 2, pp[1] - 3, 6, 4, '#ffffff');
        w(pp[0], pp[1] + 5, 10, 1, '#dfeaf2');
      });
      break;
    }
    case 'heightbar': {                                               // 키 재기 자
      w(14, 8, 10, 46, '#f7ecdd');
      w(14, 8, 2, 46, '#e6d8c2'); w(22, 8, 2, 46, '#e0d0b6');
      for (let v = 12; v < 52; v += 3){
        const big = (v - 12) % 12 === 0;
        w(16, v, big ? 8 : 4, 1, big ? '#6f6257' : '#a09383');
      }
      w(12, 5, 14, 4, c); w(12, 5, 14, 1, shade(c, 24));              // 위아래 마개
      w(12, 53, 14, 4, shade(c, -18));
      w(10, 22, 18, 2, '#e8574f'); w(28, 20, 6, 5, '#e8574f');        // 수아 눈금
      w(29, 21, 4, 3, '#ffd6d0');
      w(10, 36, 18, 2, '#5aa9e6'); w(4, 34, 6, 5, '#5aa9e6');         // 연아 눈금
      w(5, 35, 4, 3, '#d6ecff');
      break;
    }
    case 'worldmap': {
      w(2, 8, 36, 3, '#6f4a2c'); w(2, 8, 36, 1, '#a97b4f');           // 위 봉
      w(4, 11, 32, 32, '#8a6a4a');                                    // 테
      w(6, 13, 28, 28, '#dff0f8');                                    // 바다
      w(6, 13, 28, 1, '#f2fbff'); w(6, 40, 28, 1, '#c9dce8');
      for (let v = 16; v < 40; v += 6) w(6, v, 28, 1, '#cfe6f2');     // 위도선
      w(8, 18, 10, 8, c); w(10, 16, 6, 3, c);                         // 대륙들
      w(20, 15, 8, 6, c); w(28, 18, 6, 5, c);
      w(22, 26, 8, 8, c); w(10, 30, 8, 6, c); w(24, 36, 6, 3, c);
      w(14, 21, 2, 2, shade(c, -26)); w(26, 28, 2, 2, shade(c, -26));
      w(24, 17, 2, 2, '#e8574f'); w(12, 32, 2, 2, '#e8574f');         // 꽂아 둔 핀
      w(2, 43, 36, 3, '#6f4a2c'); w(2, 45, 36, 1, '#4f3320');         // 아래 봉
      break;
    }
    case 'mobile': {
      const mc = ['#ffd166', '#ff8fb8', '#8fd9c8', '#a9c8ff', '#c9a8ff'];
      w(18, 6, 4, 4, '#8a7b6e');                                      // 천장 고리
      w(19, 10, 2, 4, '#c9b9a4');
      w(4, 14, 32, 2, '#8a6a4a'); w(4, 14, 32, 1, '#a97b4f');         // 가로대
      w(2, 13, 4, 3, '#8a6a4a'); w(34, 13, 4, 3, '#8a6a4a');
      [4, 12, 20, 28, 34].forEach((x, i) => {
        const dl = 6 + (i % 3) * 6;
        w(x + 1, 16, 1, dl, '#c9b9a4');                               // 실
        if (i % 2 === 0){                                             // 별
          w(x, 16 + dl, 4, 8, mc[i]); w(x - 2, 16 + dl + 3, 8, 2, mc[i]);
          w(x + 1, 16 + dl + 2, 2, 3, '#ffffff');
        } else {                                                      // 구름과 달
          w(x - 1, 16 + dl + 1, 8, 5, mc[i]); w(x + 1, 16 + dl - 1, 4, 3, mc[i]);
          w(x, 16 + dl + 2, 3, 2, '#ffffff');
        }
      });
      break;
    }
    case 'wreath': {
      const lc = ['#3f7d3c', '#4f9a58', '#356b34', '#2f5f30'];
      for (let i = 0; i < 30; i++){                                   // 촘촘하게 두른 잎
        const th = i / 30 * 6.283;
        const x = 18 + Math.round(Math.cos(th) * 14 / 2) * 2, y = 30 + Math.round(Math.sin(th) * 14);
        w(x, y, 6, 5, lc[i % 4]);
        w(x + 1, y + 1, 2, 2, shade(lc[i % 4], 18));
      }
      [[8, 22], [28, 26], [16, 42], [26, 16], [10, 36]].forEach(pp => {   // 열매
        w(pp[0], pp[1], 4, 4, '#e8574f'); w(pp[0], pp[1], 2, 2, '#ff8a80');
      });
      w(14, 10, 10, 6, c); w(14, 10, 10, 2, shade(c, 24));            // 리본
      w(10, 12, 6, 4, shade(c, -12)); w(24, 12, 6, 4, shade(c, -12));
      w(16, 16, 3, 8, shade(c, -18)); w(22, 16, 3, 8, shade(c, -18));  // 늘어뜨린 끈
      break;
    }
    case 'whale': {                                                   // 고래 그림 — 옆에서 본 고래 한 마리
      hang(20, 3, 9);
      w(4, 8, 32, 34, '#3f2a1a');                                     // 바깥 테
      w(4, 8, 32, 2, '#8a5f3a'); w(4, 40, 32, 2, '#2a1c12');
      w(4, 8, 2, 34, '#6f4a2c'); w(34, 8, 2, 34, '#2a1c12');
      w(6, 10, 28, 30, '#e8dcc8');                                    // 매트
      w(8, 12, 24, 26, '#cfeaf8');                                    // 하늘
      w(24, 12, 8, 3, '#ffffff');                                     // 구름
      const wc = '#3a5a86', wl = '#6e93c2', wb = '#dfeaf6', ink = '#1c2c44';
      w(16, 11, 2, 5, wb);                                            // 물줄기
      w(14, 10, 6, 2, '#ffffff'); w(12, 11, 2, 2, '#ffffff'); w(20, 11, 2, 2, '#ffffff');
      w(24, 21, 4, 3, wc);                                            // 꼬리 자루
      w(28, 17, 4, 5, wc); w(28, 25, 4, 5, wc); w(28, 22, 2, 3, wc);  // 꼬리 두 갈래 — 사이가 V 로 파인다
      // 몸통 — 줄마다 폭을 달리해 통통한 타원으로
      w(14, 16, 6, 1, wc); w(12, 17, 10, 1, wc); w(10, 18, 14, 1, wc);
      w(8, 19, 16, 1, wc); w(8, 20, 18, 1, wc);
      w(8, 21, 18, 1, wc); w(8, 22, 18, 1, wc); w(8, 23, 18, 1, wc); w(8, 24, 18, 1, wc);
      w(10, 25, 16, 1, wc); w(12, 26, 12, 1, wc); w(14, 27, 8, 1, wc); w(16, 28, 4, 1, wc);
      w(10, 18, 14, 1, wl); w(12, 17, 10, 1, wl);                     // 등에 닿는 빛
      w(12, 26, 10, 1, wb); w(14, 27, 6, 1, wb);                      // 밝은 배
      w(8, 24, 8, 1, ink);                                            // 입선
      w(10, 21, 2, 2, '#ffffff'); w(10, 21, 1, 1, ink);               // 눈
      w(14, 25, 6, 4, '#2c4a70'); w(14, 25, 6, 1, '#48699a');         // 가슴지느러미
      w(8, 30, 24, 8, c);                                             // 바다
      w(8, 30, 24, 1, '#a8dcf4');
      w(12, 29, 10, 1, '#ffffff');                                    // 물을 가르며 이는 흰 거품
      for (let v = 33; v < 38; v += 3) w(8, v, 24, 1, shade(c, -20));  // 잔물결
      for (let i = 0; i < 10; i += 2) w(8 + i, 12 + i, 2, 4, 'rgba(255,255,255,0.20)');   // 유리 반사
      break;
    }
    case 'wlight': {                                                  // 벽 조명 — 따뜻한 불빛이 벽에 번진다
      // 벽에 번지는 빛부터 — 뒤에 깔아야 등이 위에 온다
      for (let i = 0; i < 7; i++){
        const half = 4 + i * 2;
        w(20 - half, 20 + i * 4, half * 2, 4, 'rgba(255,225,150,' + (0.20 - i * 0.026).toFixed(3) + ')');
      }
      w(18, 4, 4, 12, '#8a7b6e'); w(18, 4, 2, 12, '#a9998a');          // 벽에 붙은 대
      w(14, 14, 12, 3, '#6f6257'); w(14, 14, 12, 1, '#8a7b6e');        // 팔
      w(10, 16, 20, 3, shade(c, -30));                                 // 갓의 테
      w(8, 17, 24, 10, c);                                             // 갓
      w(8, 17, 24, 3, shade(c, 22));
      for (let x = 10; x < 30; x += 4) w(x, 20, 2, 7, shade(c, -12));  // 갓의 주름
      w(8, 26, 24, 2, shade(c, -34));
      w(12, 28, 16, 3, '#fff3c0'); w(14, 31, 12, 2, '#ffe9a8');        // 새어 나오는 빛
      w(16, 33, 8, 2, '#ffd979');
      break;
    }
    default: {                                                        // 커튼 창문
      w(6, 10, 28, 36, '#8a6a4a');                                    // 창틀 바깥
      w(8, 12, 24, 32, '#c79b6d');
      w(10, 14, 20, 28, '#8ec9ee');                                    // 유리 — 하늘
      w(10, 14, 20, 12, '#bfe4f7');
      w(10, 34, 20, 8, '#7fbf6f');                                     // 창밖 들판
      w(10, 34, 20, 1, '#9ad189');
      w(12, 18, 8, 3, '#ffffff'); w(16, 16, 6, 2, '#ffffff');          // 구름
      w(22, 24, 6, 2, '#ffffff');
      w(18, 14, 4, 28, '#c79b6d'); w(10, 26, 20, 3, '#c79b6d');        // 창살
      w(18, 14, 2, 28, '#dcb488'); w(10, 26, 20, 1, '#dcb488');
      for (let i = 0; i < 10; i += 2) w(10 + i, 14 + i, 2, 5, 'rgba(255,255,255,0.28)');   // 유리 반사
      w(4, 46, 32, 4, '#a97b4f'); w(4, 46, 32, 1, '#d6a878');          // 창턱
      w(2, 8, 36, 4, '#8a6a4a'); w(2, 8, 36, 1, '#a97b4f');            // 커튼봉
      [2, 30].forEach((x, i) => {                                      // 커튼 두 폭
        w(x, 10, 8, 38, c);
        w(x + (i ? 4 : 0), 10, 4, 38, shade(c, 18));
        w(x + (i ? 0 : 6), 10, 2, 38, shade(c, -28));
        for (let v = 13; v < 46; v += 5) w(x + 2, v, 4, 1, shade(c, -14));
      });
      w(6, 44, 4, 4, '#6cc7b3'); w(6, 42, 4, 2, '#4f9a58');            // 창턱 위 화분
      break;
    }
  }
}
function drawRoomShell(g, r, L, wallItems){
  const Rm = R.ROOMS[r], P = roomPal(r);
  const A = roomArt(Rm), ox = isoOx(Rm);
  const LW = Rm.w * (TW / 2), LH = Rm.h * (TW / 2);          // 두 벽의 가로 길이
  const q = dotFill(g);
  /* 벽면 좌표를 화면으로 옮긴다. u 는 벽을 따라 간 거리(가로 도트, 짝수),
     v 는 벽 꼭대기에서 내려온 거리. 비스듬한 벽이 2도트마다 1도트씩 내려간다. */
  const wallAt = side => (u, v, uw, vh, c) => {
    const u0 = Math.floor(u / 2) * 2;
    for (let i = 0; i < uw; i += 2){
      const uu = u0 + i;
      if (uu < 0) continue;
      if (side > 0) q(ox + uu, uu / 2 + v, 2, vh, c);
      else q(ox - uu - 2, (uu + 2) / 2 + v, 2, vh, c);
    }
  };
  const wallR = wallAt(1), wallL = wallAt(-1);
  // 벽지 한 면. k 는 밝기 — 왼쪽 벽은 빛을 등져 조금 어둡다.
  const paper = (wall, len, k) => {
    const wc = shade(P.wall, k), w2 = shade(P.wall2, k), dc = shade(P.dot, k);
    wall(0, 0, len, WALLH, wc);
    for (let u = 0; u < len; u += 12) wall(u, W_MOULD, 2, W_RAIL - W_MOULD, w2);
    for (let v = W_MOULD; v < W_RAIL; v += 6) wall(0, v, len, 2, shade(wc, -4));
    for (let u = 8; u + 12 < len; u += 28) for (let v = W_MOULD + 8; v < W_RAIL - 14; v += 18){
      const mx = u + (((u / 28) | 0) % 2 ? 8 : 0);
      if (mx + 12 >= len) continue;
      if (P.motif === 'heart'){ wall(mx, v + 2, 4, 4, dc); wall(mx + 6, v + 2, 4, 4, dc); wall(mx + 2, v + 6, 6, 2, dc); wall(mx + 4, v + 8, 2, 2, dc); }
      else if (P.motif === 'star'){ wall(mx + 4, v, 2, 10, dc); wall(mx, v + 4, 10, 2, dc); wall(mx + 2, v + 2, 6, 6, dc); }
      else { wall(mx, v, 2, 12, dc); wall(mx + 6, v + 4, 2, 12, dc); }
    }
    wall(0, 0, len, W_MOULD, shade(P.trim, k));                                  // 위쪽 몰딩
    wall(0, 0, len, 2, shade(P.trim, k + 26)); wall(0, W_MOULD - 2, len, 2, shade(P.trim, k - 22));
    wall(0, W_RAIL, len, W_WAIN - W_RAIL, shade(P.rail, k));                     // 허리 몰딩
    wall(0, W_RAIL, len, 2, shade(P.rail, k + 24));
    wall(0, W_WAIN, len, W_BASE - W_WAIN, shade(P.wain, k));                     // 아래 널판
    for (let u = 0; u < len; u += 18){
      wall(u, W_WAIN, 2, W_BASE - W_WAIN, shade(P.wain, k - 16));
      wall(u + 2, W_WAIN + 2, 6, W_BASE - W_WAIN - 4, shade(P.wainL, k));
    }
    wall(0, W_BASE, len, WALLH - W_BASE, shade(P.base, k));                      // 걸레받이
    wall(0, WALLH - 2, len, 2, shade(P.base, k - 26));
    /* 종이 올 — 첫화면 마을의 재질과 같은 생각이다. 없으면 벽이 커다란 색면 한 장으로 보인다.
       자리는 prand 로 정하니 늘 같고, 벽지를 바꿔도 결은 그대로다. */
    for (let u = 0; u < len; u += 2) for (let v = 2; v < WALLH - 2; v += 2){
      const g2 = R.prand('wp' + r + k + u + '_' + v);
      if (g2 > 0.94) wall(u, v, 2, 2, 'rgba(255,255,255,0.055)');
      else if (g2 < 0.055) wall(u, v, 2, 2, 'rgba(24,16,8,0.04)');
    }
    // 아래로 갈수록 조금 어둡다 — 벽에 높이가 생긴다
    for (let v = W_MOULD; v < WALLH; v += 2)
      wall(0, v, len, 2, 'rgba(22,15,8,' + (0.055 * (v - W_MOULD) / (WALLH - W_MOULD)).toFixed(3) + ')');
  };
  paper(wallR, LW, 0);
  paper(wallL, LH, -9);
  // 두 벽이 만나는 구석 — 한 줄 밝게 세워 두면 모서리가 선다
  q(ox - 2, 0, 2, WALLH, 'rgba(255,250,235,0.14)');
  q(ox, 0, 2, WALLH, 'rgba(28,20,12,0.06)');
  // 창문 — 오른쪽 벽 한가운데. 밖은 지금 시각의 하늘.
  const S2 = skyColors(L), wu = Math.max(6, Math.floor((LW / 2 - 30) / 2) * 2), wv = 14, ww = 60, wh = 42;
  wallR(wu - 4, wv - 4, ww + 8, wh + 10, '#8a6a4a');
  wallR(wu - 2, wv - 2, ww + 4, wh + 6, '#c79b6d');
  wallR(wu, wv, ww, wh, S2.bot);
  wallR(wu, wv, ww, Math.round(wh * 0.5), S2.top);
  if (S2.star){
    [[8, 6], [22, 12], [36, 6], [50, 14], [16, 22], [44, 24]].forEach(p => wallR(wu + p[0], wv + p[1], 2, 2, '#fff6c0'));
    wallR(wu + 42, wv + 6, 8, 8, '#fff3c0'); wallR(wu + 44, wv + 6, 4, 2, '#ffe9a8');
  } else {
    wallR(wu + 8, wv + 8, 16, 6, '#ffffff'); wallR(wu + 12, wv + 6, 10, 2, '#ffffff');
    wallR(wu + 38, wv + 16, 14, 4, '#ffffff');
  }
  wallR(wu, wv + wh - 12, ww, 12, '#7fbf6f'); wallR(wu, wv + wh - 12, ww, 2, '#9ad189');
  // 유리에 비스듬히 비치는 빛 — 창이 유리라는 걸 알려 주는 가장 싼 표시
  for (let i = 0; i < 10; i += 2) wallR(wu + 6 + i, wv + 4 + i, 2, 10, 'rgba(255,255,255,0.30)');
  for (let i = 0; i < 6; i += 2) wallR(wu + 16 + i, wv + 4 + i, 2, 8, 'rgba(255,255,255,0.22)');
  wallR(wu + Math.floor(ww / 4) * 2 - 2, wv, 4, wh, '#c79b6d'); wallR(wu, wv + 18, ww, 4, '#c79b6d');
  wallR(wu - 8, wv + wh + 4, ww + 16, 4, '#a97b4f'); wallR(wu - 8, wv + wh + 4, ww + 16, 2, '#d6a878');
  [wu - 16, wu + ww + 2].forEach((cx, i) => {                                    // 커튼
    wallR(cx, wv - 8, 14, wh + 18, P.cur);
    wallR(cx + (i ? 8 : 0), wv - 8, 6, wh + 18, shade(P.cur, 20));
    wallR(cx + (i ? 0 : 12), wv - 8, 2, wh + 18, shade(P.cur, -26));
    for (let v = wv - 6; v < wv + wh + 8; v += 8) wallR(cx + 2, v, 10, 2, shade(P.cur, -16));
  });
  wallR(wu - 20, wv - 12, ww + 40, 4, '#8a6a4a');
  // 거실에는 왼쪽 벽에 밖으로 나가는 문이 하나
  if (r === 'living'){
    const du = Math.max(6, Math.floor((LH - 44) / 2 / 2) * 2), dw = 40, dv = W_MOULD + 4, dh = WALLH - dv - 6;
    wallL(du - 2, dv - 2, dw + 4, dh + 2, '#7a5230');
    wallL(du, dv, dw, dh, '#a97b4f');
    for (let i = 0; i < dh; i += 10) wallL(du, dv + i, dw, 2, '#96693f');
    // 나뭇결 — 세로로 흐르는 가는 줄
    for (let i = 0; i < dw; i += 2){
      const g3 = R.prand('dr' + i);
      if (g3 > 0.78) wallL(du + i, dv, 2, dh, '#9d7046');
      else if (g3 < 0.16) wallL(du + i, dv, 2, dh, '#b98a5e');
    }
    [8, 40].forEach(o2 => {                                                    // 파인 패널 두 짝
      wallL(du + 4, dv + o2, dw - 8, 24, '#8a5f3a');
      wallL(du + 4, dv + o2, dw - 8, 2, '#6f4a2c');                            // 위는 그늘
      wallL(du + 6, dv + o2 + 2, dw - 12, 20, '#b9885a');
      wallL(du + 6, dv + o2 + 20, dw - 12, 2, '#a37146');                      // 아래는 빛
    });
    wallL(du + dw - 8, dv + Math.round(dh / 2), 4, 4, '#ffd166');
    wallL(du + dw - 8, dv + Math.round(dh / 2), 2, 2, '#fff0b8');
    wallL(du, dv, 2, dh, '#c79b6d');
    wallL(du - 2, dv + dh, dw + 4, 2, 'rgba(26,18,10,0.22)');                  // 문 밑 틈
  }
  // 벽에 건 가구
  (wallItems || []).forEach(it => {
    const s = wallSlot(Rm, it.x, it.y);
    const wl = s.side > 0 ? wallR : wallL;
    const len = (s.side > 0 ? LW : LH);
    const u = Math.min(Math.max(0, s.at * (TW / 2) - 8), len - 42);   // 그림이 40 도트로 넓어졌다
    // 벽에서 살짝 떠 있게 — 그림자를 한 벌 먼저 깐다. 안 그러면 벽지에 인쇄된 것처럼 보인다
    paintWallItem((uu, v, uw, vh) => wl(uu + 2, v + 3, uw, vh, 'rgba(26,18,10,0.16)'), u, it.f, P);
    paintWallItem(wl, u, it.f, P);
  });
  // 마루 — 널이 오른쪽아래로 흐른다. 널 하나가 세로 8도트, 한 칸에 세 줄.
  const BX = Rm.w * (TW / 2), FBY = WALLH + (Rm.w + Rm.h) * (TH / 2), LY = WALLH + Rm.h * (TH / 2);
  for (let cx = 0; cx < A.w; cx += 2){
    const yTop = cx < ox ? WALLH + (ox - cx) / 2 : WALLH + (cx - ox) / 2;
    const yBot = cx < BX ? LY + cx / 2 : FBY - (cx - BX) / 2;
    const base = WALLH + (cx - ox) / 2;
    let k = Math.floor((yTop - base) / 8);
    for (let y = base + k * 8; y < yBot; y += 8, k++){
      const t0 = Math.max(y, yTop), t1 = Math.min(y + 8, yBot);
      if (t1 <= t0) continue;
      const col = P.floor[Math.floor(R.prand('fp' + r + k) * 4)];
      q(cx, t0, 2, t1 - t0, col);
      if (y >= yTop) q(cx, y, 2, 1, shade(col, 9));
      if (y + 7 < yBot && y + 7 >= yTop) q(cx, y + 7, 2, 1, shade(col, -15));
      const v = R.prand('fg' + r + k + '_' + cx);
      if (v > 0.6){ const gy = y + 2 + (Math.floor(v * 31) % 4); if (gy >= t0 && gy < t1) q(cx, gy, 2, 1, shade(col, v > 0.87 ? 10 : -9)); }
    }
  }
  // 널 이음매 — 왼쪽아래로 흐르는 짧은 금. 줄마다 어긋나게 둔다.
  const inFloor = (x, y) => {
    const a = (x - ox) / TW, b = (y - WALLH) / TH, tx = b + a, ty = b - a;
    return tx >= 0 && ty >= 0 && tx < Rm.w && ty < Rm.h;
  };
  for (let k = 0; k < Rm.h * 3; k++){
    const col = P.floor[Math.floor(R.prand('fp' + r + k) * 4)], jc = shade(col, -26);
    for (let m = 0; m < Rm.w; m++){
      const jx = m + (k % 3) / 3, X = ox + jx * TW / 2 - 8 * k, Y = WALLH + jx * TH / 2 + 4 * k;
      for (let i = 0; i < 8; i++){
        const px2 = X - 2 * i - 2, py2 = Y + i;
        if (inFloor(px2 + 1, py2 + 0.5)) q(px2, py2, 2, 1, jc);
      }
    }
  }
  /* 창으로 든 볕 — 낮에만. 창 너비만큼의 빛이 오른쪽 벽에서 방 안쪽으로 비스듬히 눕는다.
     첫화면 마을에서 가로등이 땅을 물들이는 것과 같은 몫이다 — 빛이 어디서 오는지 눈에 보인다. */
  if (L.dark < 0.16){
    const dep = 44;
    for (let s2 = 0; s2 < dep; s2++){
      const far = 1 - s2 / dep;
      for (let u = 0; u < ww; u += 2){
        const edge = Math.min(1, Math.min(u, ww - 2 - u) / 12);    // 가장자리는 옅게 — 자로 그은 듯한 네모가 안 되게
        const a2 = far * edge * 0.30;
        if (a2 < 0.02) continue;
        const x = ox + wu + u - 2 * s2, y = WALLH + (wu + u) / 2 + s2;
        if (inFloor(x + 1, y + 0.5)) q(x, y, 2, 1, 'rgba(255,238,178,' + a2.toFixed(3) + ')');
      }
    }
  }
  // 두 벽이 만나는 구석은 볕이 안 든다 — 바닥 쪽으로 옅게 번지는 그늘
  for (let s2 = 0; s2 < 26; s2++){
    const al = ((1 - s2 / 26) * 0.09).toFixed(3);
    for (let i = 0; i < 10; i += 2){
      const x = ox - i - 2 + s2 * 0, y = WALLH + (i + 2) / 2 + s2;
      if (inFloor(x + 1, y + 0.5)) q(x, y, 2, 1, 'rgba(24,16,8,' + al + ')');
      const x2 = ox + i, y2 = WALLH + i / 2 + s2;
      if (inFloor(x2 + 1, y2 + 0.5)) q(x2, y2, 2, 1, 'rgba(24,16,8,' + al + ')');
    }
  }
  // 벽 밑 그림자 — 벽선을 따라 다섯 단으로 옅어진다
  for (let d = 0; d < 5; d++){
    const al = 'rgba(0,0,0,' + (0.13 - d * 0.026).toFixed(3) + ')';
    for (let i = 0; i < LW; i += 2) q(ox + i, WALLH + i / 2 + d * 2, 2, 2, al);
    for (let i = 0; i < LH; i += 2) q(ox - i - 2, WALLH + (i + 2) / 2 + d * 2, 2, 2, al);
  }
}
/* 가구 한 점을 버퍼에 그려 담아 둔다. 아이소메트릭에서는 돌리면 발자국의 가로세로가
   바뀌므로 그림 자체를 다시 그린다 — 캔버스를 회전시키면 계단 모양이 흐트러진다. */
let furnBuf = null;
// 불꽃이 흔들리는 것만 매번 다시 그리고, 나머지는 한 번 그려 담아 둔다
const FURN_ANIM = { fire: 1, stove: 1 };
const furnCache = {};
// 가구가 위로 솟는 높이(도트)
const FURN_H = { rug: 2, bed: 24, bunk: 72, table: 28, desk: 32, chair: 38, sofa: 36, piano: 48,
                 cushion: 12, catbed: 20, fire: 58, shelf: 66, tank: 38, stove: 44,
                 lamp: 54, plant: 46, vase: 30, doll: 34, bear: 40, guitar: 56, trophy: 32, xmas: 68,
                 wardrobe: 78, drawer: 36, tv: 46, fridge: 70, toybox: 24, cattower: 74, easel: 56,
                 beanbag: 24, tent: 56, rocker: 42, books: 20, bigplant: 60,
                 sakura: 46, fan: 52, pumpkin: 32,
                 dollhouse: 54, slide: 44, ballpit: 18, hammock: 46, kitchen: 46,
                 blocks: 32, dresser: 46, nightsky: 24,
                 fox: 40, sangre: 34, rabbit: 44, pcdesk: 62, sunflower: 58, rose: 44,
                 bigbear: 80 };
// 가구마다의 재질 — 적지 않은 것은 나무로 친다
const FURN_MAT = {
  rug:'cloth', bed:'cloth', sofa:'cloth', cushion:'cloth', catbed:'cloth', beanbag:'cloth',
  tent:'cloth', cattower:'cloth', lamp:'cloth', doll:'cloth', bear:'cloth',
  stove:'metal', fridge:'metal', trophy:'metal', fan:'metal',
  tank:'glass',
  fire:'stone', pumpkin:'stone',
  piano:'plain', tv:'plain', plant:'plain', bigplant:'plain', sakura:'plain', xmas:'plain',
  vase:'plain', books:'plain', easel:'wood', guitar:'wood',
  ballpit:'plain', hammock:'cloth', kitchen:'plain', blocks:'plain', nightsky:'plain',
  slide:'plain', dollhouse:'wood', dresser:'wood',
  fox:'cloth', sangre:'cloth', rabbit:'cloth', pcdesk:'wood', sunflower:'plain', rose:'plain',
  bigbear:'cloth',
};
function furnArt(f, rot){
  const F = R.FURNITURE[f], b = R.furnBox(f, rot);
  const EW = b.w * (TW / 2), EH = b.h * (TW / 2), H = FURN_H[F.kind] || 32;
  // 테두리가 잘리지 않게 사방으로 한 도트씩 여백을 둔다
  return { EW, EH, H, w: EW + EH + 2, h: H + (EW + EH) / 2 + 2 };
}
function furnBitmap(f, rot, A, t){
  const bw = Math.round(A.w * HS), bh = Math.round(A.h * HS);
  const anim = FURN_ANIM[R.FURNITURE[f].kind];
  const key = f + '|' + (rot % 2) + '|' + HS;
  if (!anim){
    const hit = furnCache[key];
    if (hit && hit.width === bw && hit.height === bh) return hit;
  }
  const cv = anim ? (furnBuf || (furnBuf = document.createElement('canvas'))) : document.createElement('canvas');
  if (cv.width !== bw || cv.height !== bh){ cv.width = bw; cv.height = bh; }
  const b = cv.getContext('2d'); b.imageSmoothingEnabled = false;
  b.clearRect(0, 0, bw, bh);
  paintFurniture(b, f, rot, A, t);
  /* 어두운 테두리 한 도트 — Unpacking 이 또렷하게 읽히는 가장 큰 까닭이다.
     실루엣을 네 방향으로 한 도트씩 밀어 밑에 깔면 가구마다 윤곽이 선다. */
  const ol = document.createElement('canvas'); ol.width = bw; ol.height = bh;
  const og = ol.getContext('2d'); og.imageSmoothingEnabled = false;
  og.drawImage(cv, 0, 0);
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = '#3c2c20'; og.fillRect(0, 0, bw, bh);
  b.globalCompositeOperation = 'destination-over';
  const s1 = Math.max(1, Math.round(HS));
  [[-s1, 0], [s1, 0], [0, -s1], [0, s1], [s1, s1]].forEach(d => b.drawImage(ol, d[0], d[1]));
  b.globalCompositeOperation = 'source-over';
  if (!anim) furnCache[key] = cv;
  return cv;
}
function drawFurnItem(g, f, rot, Rm, tx, ty, t){
  const F = R.FURNITURE[f]; if (!F) return;
  const A = furnArt(f, rot), bm = furnBitmap(f, rot, A, t);
  g.save(); g.imageSmoothingEnabled = false;
  g.drawImage(bm, Math.round((isoX(Rm, tx, ty) - A.EH - 1) * HS), Math.round((isoY(tx, ty) - A.H - 1) * HS));
  g.restore();
}
/* 가구 그리기. 발자국 마름모의 뒤 꼭짓점이 (A.EH, A.H) 에 온다.
   자리는 칸 방향으로 적는다 — ax 는 오른쪽아래로, ay 는 왼쪽아래로 간 가로 도트. */
function paintFurniture(g, f, rot, A, t){
  const F = R.FURNITURE[f], c = F.c;
  MAT = FURN_MAT[F.kind] || 'wood';                            // 이 가구를 칠하는 동안의 재질
  MATSEED = f;
  const hi = shade(c, 24), lo = shade(c, -18), dk = shade(c, -36);
  const q = dotFill(g);
  const OX = A.EH + 1, OY = A.H + 1, E = A.EW, D = A.EH;
  const CX = OX + (E - D) / 2, CY = OY + (E + D) / 4;         // 발자국 한가운데(바닥)
  const P = (ax, ay, up) => [OX + ax - ay, OY + (ax + ay) / 2 - (up || 0)];
  const top = (ax, ay, up, ew, eh, col) => { const p = P(ax, ay, up); isoTop(q, p[0], p[1], ew, eh, col); };
  const box3 = (ax, ay, ew, eh, hh, tc, lc, rc, base) => {
    const p = P(ax, ay, (base || 0) + hh);
    isoBox(q, p[0], p[1], ew, eh, hh, tc, lc, rc);
  };
  const box = (ax, ay, ew, eh, hh, col, base) => box3(ax, ay, ew, eh, hh, shade(col, 22), col, shade(col, -34), base);
  // 앞에서 본 32×32 그림 — 인형처럼 작고 둥근 것은 이쪽이 낫다 (아이 그림과도 시점이 맞는다)
  const oq = (x, y, w, h, col) => q(CX - 16 + x, CY - 32 + y, w, h, col);
  // 발밑 그림자 — 두 겹으로 두면 바닥에 닿은 자리가 더 짙어 물건이 떠 보이지 않는다
  if (F.kind !== 'rug'){
    isoTop(q, OX + 1, OY + 1, Math.max(4, E - 2), Math.max(4, D - 2), 'rgba(26,20,12,0.10)');
    isoTop(q, OX + 5, OY + 3, Math.max(4, E - 10), Math.max(4, D - 10), 'rgba(26,20,12,0.15)');
  }
  switch (F.kind){
    case 'rug': {
      top(0, 0, 2, E, D, lo);
      top(3, 3, 2, E - 6, D - 6, c);
      top(9, 9, 2, E - 18, D - 18, hi);
      if (f === 'rug2'){ for (let a = 10; a < E - 12; a += 16) for (let b2 = 10; b2 < D - 12; b2 += 16) top(a, b2, 2, 6, 6, '#ffffff'); }
      else if (f === 'rug3'){ top(6, 6, 2, E - 12, D - 12, '#ffffff'); top(10, 10, 2, E - 20, D - 20, shade(c, 16)); }
      else { for (let a = 6; a < E - 8; a += 12) top(a, 4, 2, 4, D - 8, shade(c, -14)); }
      break;
    }
    case 'bed': {
      box(0, 0, 4, D, 20, '#7a5230');                                    // 머리판 — 뒤에 있으니 먼저
      box(0, 0, E, D, 11, '#8a5f3a');                                    // 침대틀
      box(3, 3, E - 6, D - 6, 6, '#fff6e9', 11);                         // 요
      box(5, 4, 15, D - 8, 6, '#ffffff', 17);                            // 베개
      box(21, 4, E - 25, D - 8, 8, c, 17);                               // 이불
      for (let a = 27; a < E - 8; a += 12) top(a, 4, 25, 3, D - 8, shade(c, -13));
      if (f === 'bed3'){ top(25, 8, 25, 8, 8, '#ffffff'); top(E - 16, 12, 25, 6, 6, '#ffffff'); }
      break;
    }
    case 'bunk': {
      box(0, 0, 5, 5, 70, '#8a5f3a'); box(E - 6, 0, 5, 5, 70, '#8a5f3a');   // 기둥
      box(0, D - 6, 5, 5, 70, '#8a5f3a'); box(E - 6, D - 6, 5, 5, 70, '#8a5f3a');
      box(0, 0, E, D, 6, '#8a5f3a', 4); box(3, 3, E - 6, D - 6, 5, '#fff6e9', 10);
      box(4, 4, 14, D - 8, 5, '#ffffff', 15); box(20, 4, E - 24, D - 8, 6, c, 15);
      box(0, 0, E, D, 6, '#8a5f3a', 40); box(3, 3, E - 6, D - 6, 5, '#fff6e9', 46);
      box(4, 4, 14, D - 8, 5, '#ffffff', 51); box(20, 4, E - 24, D - 8, 6, c, 51);
      for (let z = 10; z < 44; z += 8) box(E - 8, D - 4, 6, 3, 2, '#c79b6d', z);  // 사다리
      break;
    }
    case 'table': case 'desk': {
      const HH = F.kind === 'desk' ? 30 : 26, tt = 5;
      box(3, 3, 5, 5, HH - tt, dk); box(E - 8, 3, 5, 5, HH - tt, dk);
      box(3, D - 8, 5, 5, HH - tt, dk); box(E - 8, D - 8, 5, 5, HH - tt, dk);
      box(0, 0, E, D, tt, c, HH - tt);
      if (F.kind === 'desk'){
        box3(E - 20, 4, 16, D - 8, HH - tt - 4, shade(c, 8), shade(c, -14), shade(c, -30), 0);
        top(E - 18, 6, HH - tt - 4, 12, D - 12, shade(c, -6));
        box(6, 6, 12, 10, 6, '#fff6e9', HH); box(7, 7, 10, 8, 2, '#a9bcd0', HH + 6);
        box(8, D - 16, 8, 8, 7, '#ff8fb8', HH);
      } else {
        box(E / 2 - 6, D / 2 - 6, 12, 12, 9, '#ffffff', HH);
        top(E / 2 - 4, D / 2 - 4, HH + 15, 8, 8, '#ff8fb8');
        box(E / 2 - 3, D / 2 - 3, 6, 6, 5, '#6fb567', HH + 9);
      }
      break;
    }
    case 'chair': {
      box(3, 3, 4, 4, 18, dk); box(E - 7, 3, 4, 4, 18, dk);
      box(3, D - 7, 4, 4, 18, dk); box(E - 7, D - 7, 4, 4, 18, dk);
      box(2, 2, E - 4, D - 4, 5, c, 18);
      box3(2, 2, 4, D - 4, 15, shade(c, 16), shade(c, -10), shade(c, -28), 23);   // 등받이
      break;
    }
    case 'sofa': {
      const AW = 7;                                                       // 팔걸이 두께
      MAT = 'wood';                                                       // 나무 다리 넷
      box(3, 3, 4, 4, 5, '#6f4a2c'); box(E - 7, 3, 4, 4, 5, '#6f4a2c');
      box(3, D - 7, 4, 4, 5, '#6f4a2c'); box(E - 7, D - 7, 4, 4, 5, '#6f4a2c');
      MAT = 'cloth';
      box(0, 0, E, D, 9, shade(c, -16), 4);                               // 밑동
      // 앉는 방석 둘 — 사이를 벌리고 위를 부풀린다
      const sw = Math.max(8, isoEven((E - AW * 2 - 4) / 2));
      for (let n = 0; n < 2; n++){
        const a0 = AW + n * (sw + 4);
        box(a0, AW, sw, D - AW * 2, 7, c, 13);
        top(a0 + 2, AW + 2, 20, sw - 4, D - AW * 2 - 4, shade(c, 13));
      }
      box3(0, 0, 8, D, 26, shade(c, 10), shade(c, -6), shade(c, -28), 13); // 등받이
      for (let n = 0; n < 2; n++)                                         // 등 쿠션 둘
        box(1, AW + 1 + n * isoEven((D - AW * 2) / 2), 6, isoEven((D - AW * 2) / 2) - 2, 4, shade(c, 8), 26);
      box(0, 0, E, AW, 15, shade(c, 2), 13);                              // 팔걸이 — 왼쪽
      top(1, 1, 28, E - 2, AW - 2, shade(c, 16));
      box(0, D - AW, E, AW, 15, shade(c, -12), 13);                       // 팔걸이 — 오른쪽
      top(1, D - AW + 1, 28, E - 2, AW - 2, shade(c, 2));
      break;
    }
    case 'piano': {
      box(0, 0, E, D, 34, c);
      box3(0, 0, E, D - 12, 8, shade(c, 26), shade(c, 6), shade(c, -14), 34);      // 뚜껑
      box(2, D - 12, E - 4, 9, 4, '#fffaf2', 30);                                  // 건반
      for (let a = 4; a < E - 6; a += 5) top(a, D - 11, 34, 3, 7, '#2a2a2a');
      box(4, 4, 4, 4, 6, dk); box(E - 8, 4, 4, 4, 6, dk);
      break;
    }
    case 'cushion': {
      box3(1, 1, E - 2, D - 2, 9, hi, c, shade(c, -22));
      top(4, 4, 11, E - 8, D - 8, shade(c, 12));                          // 부푼 가운데
      top(8, 8, 12, E - 16, D - 16, shade(c, 20));
      for (let a = 3; a < E - 4; a += 5) top(a, 2, 9, 2, 2, shade(c, -16));  // 가장자리 시접
      top(E / 2 - 2, D / 2 - 2, 13, 4, 4, shade(c, -34));                 // 가운데 단추
      break;
    }
    case 'catbed': {
      box(0, 0, E, D, 10, lo);
      box(0, 0, E, 6, 9, c, 10); box(0, D - 6, E, 6, 9, shade(c, -12), 10);   // 두툼한 테두리
      box(0, 0, 6, D, 9, shade(c, 10), 10); box(E - 6, 0, 6, D, 9, shade(c, -20), 10);
      top(6, 6, 12, E - 12, D - 12, shade(c, -30));                       // 안쪽 그늘
      top(8, 8, 13, E - 16, D - 16, '#fff6e9');                           // 깔아 둔 방석
      top(11, 11, 14, E - 22, D - 22, '#ffffff');
      break;
    }
    case 'fire': {
      box(0, 0, E, D, 52, '#9c8d80');
      for (let z = 4; z < 48; z += 8) for (let a = ((z / 8) | 0) % 2 ? 4 : 12; a < E - 8; a += 16) box(a, D - 3, 12, 2, 6, '#8a7b6e', z);
      box(6, D - 4, E - 12, 4, 34, '#2a221b', 4);                                  // 아궁이
      box(10, D - 5, E - 20, 4, 6, '#8a5f3a', 6); box(14, D - 5, E - 28, 4, 5, '#6f4a2c', 12);
      const fl = t ? (Math.sin(t / 170) > 0 ? 3 : 0) : 0;
      box(E / 2 - 7, D - 5, 14, 4, 13 + fl, '#ff8c2e', 10);
      box(E / 2 - 4, D - 5, 8, 4, 10 + fl, '#ffd166', 16);
      box(E / 2 - 2, D - 5, 4, 4, 6 + fl, '#fff3c0', 22);
      box(0, 0, E, D, 5, '#b9aa9c', 52);                                           // 선반
      break;
    }
    case 'shelf': {
      box(0, 0, E, D, 62, c);
      for (let z = 8; z < 60; z += 16){
        box(2, D - 3, E - 4, 3, 3, shade(c, -42), z);                              // 칸 선반
        const bc = ['#f2707d', '#5aa9e6', '#ffd166', '#6cc7b3', '#ffb7d5'];
        for (let a = 4; a < E - 6; a += 5) box(a, D - 4, 4, 3, 9 + (a % 3) * 2, bc[(a + z) % 5], z + 3);
      }
      box(0, 0, E, D, 4, shade(c, 26), 62);
      break;
    }
    case 'tank': {
      box(0, 0, E, D, 5, '#3a3226');                                               // 받침
      box3(2, 2, E - 4, D - 4, 24, 'rgba(150,215,245,0.55)', '#8fd0f0', '#5aa9e6', 5);
      box(4, 4, E - 8, D - 8, 3, '#c9a86a', 5);                                    // 모래
      box(6, D - 10, 6, 5, 8, '#6fb567', 8); box(E - 14, D - 8, 5, 4, 6, '#5da05a', 8);
      box(E / 2 - 4, D - 8, 7, 4, 4, '#ff8c2e', 16);
      box(0, 0, E, D, 4, '#3a3226', 29);                                           // 뚜껑
      break;
    }
    case 'stove': {
      box(0, 0, E, D, 34, c);
      box(4, D - 4, E - 8, 4, 18, '#2a221b', 8);
      const fl2 = t ? (Math.sin(t / 160) > 0 ? 3 : 0) : 0;
      box(E / 2 - 5, D - 5, 10, 4, 9 + fl2, '#ff8c2e', 10);
      box(E / 2 - 3, D - 5, 6, 4, 6 + fl2, '#ffd166', 14);
      box(0, 0, E, D, 4, shade(c, 24), 34);
      box(E / 2 - 3, D / 2 - 3, 6, 6, 6, '#8a7b6e', 38);                           // 연통
      break;
    }
    /* ---- 나중에 늘린 것들 ----
       상자 앞면을 꾸밀 때는 발자국 앞 가장자리(ay = D - 2)에 얇은 판을 하나 더 세운다.
       그 판의 왼쪽 옆면이 곧 가구의 앞면이 된다. */
    case 'wardrobe': {
      box(0, 0, E, D, 8, shade(c, -32));                                         // 굽
      box(1, 1, E - 2, D - 2, 62, c, 8);                                         // 몸통
      box(3, D - 3, E - 6, 3, 54, shade(c, -20), 12);                            // 문 두 짝
      box(E / 2 - 1, D - 3, 2, 3, 54, shade(c, -46), 12);                        // 가운데 틈
      box(E / 2 - 7, D - 3, 3, 3, 5, '#ffd166', 36); box(E / 2 + 4, D - 3, 3, 3, 5, '#ffd166', 36);
      box(0, 0, E, D, 6, shade(c, 24), 70);                                      // 갓
      break;
    }
    case 'drawer': {
      box(0, 0, E, D, 30, c);
      for (let z = 3; z < 27; z += 9){
        box(3, D - 2, E - 6, 2, 7, shade(c, 12), z);
        box(E / 2 - 4, D - 2, 8, 2, 2, shade(c, -34), z + 4);                    // 손잡이
      }
      box(0, 0, E, D, 5, shade(c, 22), 30);
      break;
    }
    case 'tv': {
      box(2, 2, E - 4, D - 4, 12, '#8a6a4a');                                    // 받침대
      box(4, 3, E - 8, 3, 3, '#6f4a2c', 4);                                      // 아래 칸
      box(E / 2 - 3, D / 2 - 3, 6, 6, 6, '#5a5a62', 12);                         // 목
      box(4, D / 2 - 3, E - 8, 5, 26, c, 18);                                    // 몸통
      box(6, D / 2 - 1, E - 12, 2, 21, '#9fd8f0', 21);                           // 화면
      box(7, D / 2 - 1, E - 20, 2, 6, '#e8f6ff', 33);                            // 비치는 빛
      break;
    }
    case 'fridge': {
      box(0, 0, E, D, 64, c);
      box(2, D - 2, E - 4, 2, 58, shade(c, 10), 3);
      box(2, D - 2, E - 4, 2, 2, shade(c, -22), 42);                             // 냉동칸 선
      box(E - 9, D - 2, 3, 2, 10, '#a9b7c0', 46); box(E - 9, D - 2, 3, 2, 10, '#a9b7c0', 24);
      box(4, D - 2, 5, 2, 4, '#ffb7d5', 50);                                      // 붙여 놓은 자석
      box(0, 0, E, D, 4, shade(c, 16), 64);
      break;
    }
    case 'toybox': {
      box(0, 0, E, D, 13, c);
      top(3, 3, 13, E - 6, D - 6, shade(c, -38));
      box(0, 0, E, 5, 5, shade(c, 16), 13); box(0, D - 5, E, 5, 5, shade(c, -6), 13);
      box(0, 0, 5, D, 5, shade(c, 22), 13); box(E - 5, 0, 5, D, 5, shade(c, -20), 13);
      box(6, 6, 7, 7, 7, '#5aa9e6', 11); box(12, 11, 6, 6, 6, '#ffd166', 11);     // 삐져나온 장난감
      break;
    }
    case 'cattower': {
      box(0, 0, E, D, 7, shade(c, -20));                                          // 바닥판
      box(E / 2 - 5, D / 2 - 5, 10, 10, 20, '#c9b393', 7);                        // 기둥
      for (let z = 9; z < 25; z += 4) box(E / 2 - 5, D / 2 - 5, 10, 10, 2, '#b09978', z);  // 감아 놓은 끈
      box(1, 1, E - 2, D - 2, 20, c, 27);                                         // 고양이 집
      box(5, D - 3, 12, 3, 13, '#4a3d30', 31);                                    // 들어가는 구멍
      box(E / 2 - 4, D / 2 - 4, 8, 8, 10, '#c9b393', 47);
      box(2, 2, E - 4, D - 4, 6, shade(c, 12), 57);                               // 꼭대기 판
      top(6, 6, 63, E - 12, D - 12, shade(c, -16));                               // 방석
      box(E - 9, D - 7, 4, 4, 4, '#f2707d', 66);                                  // 방울
      break;
    }
    case 'beanbag': {
      box(0, 0, E, D, 7, shade(c, -14));
      box(2, 2, E - 4, D - 4, 6, c, 7);
      box(5, 5, E - 10, D - 10, 5, shade(c, 13), 13);
      top(8, 8, 18, E - 16, D - 16, shade(c, 22));
      top(11, 11, 18, E - 22, D - 22, shade(c, 30));                      // 푹 꺼진 가운데
      for (let a = 5; a < E - 6; a += 7) top(a, 3, 7, 2, D - 6, shade(c, -9));   // 이음매
      break;
    }
    case 'tent': {
      box(0, 0, E, D, 5, shade(c, -22));                                          // 바닥천
      for (let i = 0; i < 4; i++){
        const fx = 2 + i * (E - 12) / 8, fy = 2 + i * (D - 8) / 8;
        box(fx, fy, E - fx * 2, D - fy * 2, 13, i % 2 ? shade(c, -8) : c, 5 + i * 12);
      }
      box(E / 2 - 5, D - 3, 10, 3, 26, '#5a4632', 5);                             // 들어가는 곳
      box(E / 2 - 2, D / 2 - 2, 4, 4, 6, '#f2707d', 53);                          // 꼭대기 깃발
      break;
    }
    case 'books': {
      const bc = ['#5aa9e6', '#f2707d', '#ffd166', '#6cc7b3'];
      for (let i = 0; i < 4; i++){
        const a0 = 3 + (i % 2) * 3, b0 = 3 + ((i + 1) % 2) * 3;
        box(a0, b0, E - 12, D - 12, 4, bc[i], i * 4);
        top(a0 + 2, b0 + 2, i * 4 + 4, E - 16, D - 16, '#fff6e9');        // 책장 — 위에서 보면 종이가 보인다
        box(a0, b0, 3, D - 12, 4, shade(bc[i], -28), i * 4);              // 책등
      }
      break;
    }
    case 'bigplant': {
      box(4, 4, E - 8, D - 8, 6, '#a45f45');
      box3(6, 6, E - 12, D - 12, 14, '#e09a76', '#c97a5a', '#a45f45', 6);
      top(8, 8, 20, E - 16, D - 16, '#6a4a36');                                   // 흙
      blob(CX, CY - 56, 26, 30, c, shade(c, 26), shade(c, -30), 'bp', q);
      break;
    }
    /* ---- 놀 것들 ---- */
    case 'dollhouse': {
      box(2, 2, E - 4, D - 4, 4, '#c79b6d');                                   // 받침
      box(3, 3, E - 6, D - 6, 15, c, 4);                                       // 아래층
      box(5, D - 4, 5, 3, 9, '#f7e2c8', 7); box(E - 10, D - 4, 5, 3, 9, '#f7e2c8', 7);   // 아래층 창 둘
      box(3, 3, E - 6, D - 6, 13, shade(c, 10), 19);                           // 위층
      box(6, D - 4, 5, 3, 8, '#f7e2c8', 22); box(E - 11, D - 4, 5, 3, 8, '#f7e2c8', 22);
      for (let i = 0; i < 5; i++)                                              // 지붕 — 계단으로 좁아진다
        box(2 + i * 2, 2 + i * 2, E - 4 - i * 4, D - 4 - i * 4, 3, i % 2 ? '#c9524e' : '#d9605c', 32 + i * 3);
      box(E / 2 - 2, D / 2 - 2, 4, 4, 4, '#ffd166', 47);                       // 꼭대기 깃발
      break;
    }
    case 'slide': {
      MAT = 'wood';
      for (let i = 0; i < 4; i++) box(2, 3 + i * 4, 7, 4, 8 + i * 7, '#c79b6d');   // 오르는 계단
      box(2, 3, 7, D - 6, 3, '#a97b4f', 29);                                       // 꼭대기 발판
      MAT = 'plain';
      box(9, 4, 4, D - 8, 24, shade(c, -18), 6);                                   // 미끄럼틀 옆벽
      for (let i = 0; i < 8; i++)                                                  // 미끄러지는 판
        box(12 + i * 4, 5, 5, D - 10, 3, shade(c, i % 2 ? 0 : 9), 28 - i * 3);
      box(E - 12, 4, 10, D - 8, 3, shade(c, -12), 4);                              // 내려오는 끝
      break;
    }
    case 'ballpit': {
      box(0, 0, E, D, 11, shade(c, -20));                                       // 통
      top(4, 4, 11, E - 8, D - 8, shade(c, -36));                               // 안쪽 그늘
      // 테두리는 네 면만 — 통째로 덮으면 안에 든 공이 안 보인다
      box(0, 0, E, 5, 4, c, 11); box(0, D - 5, E, 5, 4, shade(c, -10), 11);
      box(0, 0, 5, D, 4, shade(c, 12), 11); box(E - 5, 0, 5, D, 4, shade(c, -18), 11);
      const bp = ['#f2707d', '#ffd166', '#5aa9e6', '#6cc7b3', '#ffb7d5'];
      for (let i = 0; i < 16; i++){                                             // 공 열여섯 — 테두리보다 나중에 그려 위로 올라온다
        const a2 = 5 + Math.floor(R.prand('bp' + i) * (E - 16)), b2 = 5 + Math.floor(R.prand('bq' + i) * (D - 16));
        box(a2, b2, 6, 6, 6, bp[i % 5], 8 + (i % 3) * 2);
      }
      break;
    }
    case 'hammock': {
      MAT = 'wood';
      box(2, D / 2 - 3, 6, 6, 38, '#a97b4f'); box(E - 8, D / 2 - 3, 6, 6, 38, '#a97b4f');   // 기둥 둘
      MAT = 'cloth';
      const seg = Math.max(4, isoEven((E - 18) / 7));
      for (let i = 0; i < 7; i++){                                              // 축 늘어진 그물
        const dip = Math.round(13 - Math.abs(i - 3) * 3.6);
        box(9 + i * seg, 4, seg, D - 8, 3, i % 2 ? c : shade(c, -11), 15 + dip);
      }
      box(10, 6, 7, D - 12, 4, '#fff6e9', 26);                                  // 베개
      break;
    }
    case 'kitchen': {
      box(0, 0, E, D, 24, c);                                                   // 몸통
      box(2, D - 3, E - 4, 3, 9, shade(c, -22), 4);                             // 문 두 짝
      box(E / 2 - 1, D - 3, 2, 3, 9, shade(c, -42), 4);
      box(0, 0, E, D, 4, '#f2e6d6', 24);                                        // 상판
      top(3, 4, 28, 8, 8, '#a9b7c0'); top(5, 6, 28, 4, 4, '#8f9ba4');           // 싱크
      box(E - 11, 4, 6, 6, 3, '#3a3a42', 28);                                   // 화구
      box(E - 10, 5, 4, 4, 1, '#e8574f', 31);
      box(1, 1, E - 2, 3, 15, shade(c, 8), 28);                                 // 뒷판
      box(4, 2, 4, 2, 3, '#ffd166', 36); box(11, 2, 4, 2, 3, '#8fd9c8', 36);    // 걸어 둔 냄비
      break;
    }
    case 'blocks': {
      const kc = ['#f2707d', '#5aa9e6', '#ffd166', '#6cc7b3', '#c9a8ff'];
      [[2, 2, 11], [11, 4, 8], [4, 11, 8], [8, 6, 8], [10, 10, 6]].forEach((b2, i) => {
        box(b2[0], b2[1], b2[2], b2[2], 6, kc[i % 5], i * 5);
        top(b2[0] + 2, b2[1] + 2, i * 5 + 6, b2[2] - 4, b2[2] - 4, shade(kc[i % 5], 20));   // 위에 파인 자리
      });
      break;
    }
    case 'dresser': {
      box(0, 0, E, D, 20, c);                                                   // 몸통
      for (let z = 3; z < 18; z += 7){
        box(3, D - 2, E - 6, 2, 5, shade(c, 12), z);
        box(E / 2 - 3, D - 2, 6, 2, 2, shade(c, -34), z + 3);                   // 손잡이
      }
      box(0, 0, E, D, 4, shade(c, 20), 20);                                     // 상판
      MAT = 'plain';
      box(2, 1, E - 4, 3, 18, shade(c, -12), 24);                               // 거울 틀
      box(4, 1, E - 8, 2, 14, '#dff0f8', 26);                                   // 거울
      box(5, 1, 4, 2, 9, '#ffffff', 29);
      box(E - 9, D - 7, 4, 4, 4, '#ff8fb8', 24);                                // 올려 둔 향수
      break;
    }
    case 'nightsky': {
      box(4, 4, E - 8, D - 8, 5, '#4a4a55');                                    // 받침
      box(6, 6, E - 12, D - 12, 11, c, 5);                                      // 몸통
      top(7, 7, 16, E - 14, D - 14, shade(c, 24));
      box(E / 2 - 3, D / 2 - 3, 6, 6, 4, '#fff3c0', 16);                        // 빛나는 구멍
      [[2, 5, 20], [E - 6, 3, 23], [5, D - 4, 18], [E - 4, D - 7, 21]].forEach(pp =>
        top(pp[0], pp[1], pp[2], 2, 2, '#fff3c0'));                             // 새어 나온 별
      break;
    }
    // ---- 앞에서 본 작은 것들 ----
    case 'lamp':
      oq(14, 12, 4, 18, '#8a5f3a'); oq(14, 12, 2, 18, '#a97b4f');         // 기둥
      oq(9, 27, 14, 3, '#6f4a2c'); oq(9, 27, 14, 1, '#a97b4f');           // 받침
      oq(7, 3, 18, 11, c);                                                // 갓 — 위가 좁은 사다리꼴
      oq(6, 6, 20, 8, c); oq(8, 2, 16, 2, shade(c, 26));
      oq(6, 6, 3, 8, shade(c, 22)); oq(23, 6, 3, 8, shade(c, -24));
      for (let i = 8; i < 24; i += 4) oq(i, 4, 1, 10, shade(c, -12));     // 갓의 주름
      oq(6, 14, 20, 2, shade(c, -30));
      oq(9, 16, 14, 3, '#fff3c0'); oq(11, 19, 10, 2, '#ffe9a8');          // 새어 나오는 빛
      oq(13, 21, 6, 2, '#ffd979');
      break;
    case 'plant':
      oq(8, 18, 16, 12, '#c97a5a'); oq(8, 16, 16, 4, '#e09a76'); oq(8, 28, 16, 2, '#a45f45');
      blob(CX, CY - 32 + 2, 22, 16, c, shade(c, 26), shade(c, -30), 'pl' + f, (x, y, w, h, col) => q(x, y, w, h, col));
      oq(14, 16, 4, 4, shade(c, -34));
      break;
    case 'vase':
      oq(12, 16, 8, 12, c); oq(10, 22, 12, 8, shade(c, -18)); oq(12, 16, 4, 12, shade(c, 26));
      oq(8, 6, 6, 6, '#ffb7d5'); oq(18, 4, 6, 6, '#fff3a0'); oq(12, 10, 8, 2, '#6fb567'); oq(14, 10, 2, 8, '#5da05a');
      break;
    case 'doll':
      oq(10, 4, 12, 10, '#ffe3c9'); oq(8, 2, 16, 6, c);
      oq(12, 8, 2, 2, '#3a2a20'); oq(18, 8, 2, 2, '#3a2a20'); oq(14, 12, 4, 2, '#c9646b');
      oq(8, 14, 16, 12, '#f2707d'); oq(6, 16, 4, 8, '#ffe3c9'); oq(22, 16, 4, 8, '#ffe3c9');
      oq(10, 26, 4, 6, '#8a5f3a'); oq(18, 26, 4, 6, '#8a5f3a');
      break;
    case 'bear':
      oq(6, 2, 6, 6, lo); oq(20, 2, 6, 6, lo);
      oq(8, 4, 16, 12, c); oq(8, 4, 16, 4, hi);
      oq(12, 10, 2, 2, '#3a2a20'); oq(18, 10, 2, 2, '#3a2a20'); oq(14, 12, 4, 4, '#6f4a2c');
      oq(8, 16, 16, 14, c); oq(10, 18, 12, 8, hi);
      oq(4, 18, 6, 6, lo); oq(22, 18, 6, 6, lo); oq(8, 28, 6, 4, lo); oq(18, 28, 6, 4, lo);
      break;
    case 'bigbear': {                                                    // 엄청 큰 곰인형 — 두 칸을 차지하는 큰 아이
      // 48×64 앞모습 — 인형이 크면 32칸으로는 얼굴이 다 안 들어간다
      const bq = (x, y, w2, h2, col) => q(CX - 24 + x, CY - 64 + y, w2, h2, col);
      const ink = '#3a2a20', hi2 = shade(c, 22), lo2 = shade(c, -18), pad = '#e8bfa0';
      bq(4, 2, 14, 4, lo2); bq(2, 6, 18, 7, lo2); bq(4, 13, 14, 3, lo2);         // 왼쪽 귀
      bq(6, 5, 10, 7, pad);
      bq(30, 2, 14, 4, lo2); bq(28, 6, 18, 7, lo2); bq(30, 13, 14, 3, lo2);      // 오른쪽 귀
      bq(32, 5, 10, 7, pad);
      bq(16, 4, 16, 2, c); bq(13, 6, 22, 3, c); bq(11, 9, 26, 4, c);             // 머리
      bq(10, 13, 28, 10, c); bq(11, 23, 26, 4, c); bq(13, 27, 22, 3, c);
      bq(16, 30, 16, 2, c);
      bq(11, 9, 26, 4, hi2); bq(13, 6, 22, 3, hi2);                              // 이마의 빛
      bq(14, 15, 4, 5, ink); bq(30, 15, 4, 5, ink);                              // 눈
      bq(15, 16, 2, 2, '#ffffff'); bq(31, 16, 2, 2, '#ffffff');
      bq(17, 20, 14, 9, pad); bq(18, 19, 12, 2, pad);                            // 주둥이
      bq(21, 20, 6, 4, ink); bq(22, 21, 4, 2, '#5a4030');                        // 코
      bq(23, 24, 2, 3, ink); bq(19, 26, 4, 1, ink); bq(25, 26, 4, 1, ink);       // 입
      bq(12, 30, 24, 4, c); bq(9, 34, 30, 20, c);                                // 몸
      bq(11, 54, 26, 6, c); bq(14, 60, 20, 4, c);
      bq(14, 36, 20, 18, hi2); bq(16, 34, 16, 3, hi2);                           // 밝은 배
      bq(2, 33, 10, 18, lo2); bq(3, 51, 8, 4, lo2);                              // 팔 둘
      bq(36, 33, 10, 18, lo2); bq(37, 51, 8, 4, lo2);
      bq(4, 46, 6, 5, pad); bq(38, 46, 6, 5, pad);                              // 손바닥
      bq(7, 52, 13, 12, lo2); bq(28, 52, 13, 12, lo2);                           // 다리 둘
      bq(9, 55, 8, 7, pad); bq(31, 55, 8, 7, pad);                               // 발바닥
      [[10, 56], [14, 56], [12, 59]].forEach(([x, y]) => bq(x, y, 3, 3, shade(pad, -22)));
      [[32, 56], [36, 56], [34, 59]].forEach(([x, y]) => bq(x, y, 3, 3, shade(pad, -22)));
      bq(14, 30, 20, 4, '#f2707d'); bq(14, 30, 20, 1, '#ff9aa2');                // 목에 맨 리본
      bq(20, 28, 8, 7, '#f2707d'); bq(21, 29, 6, 5, '#ff9aa2'); bq(23, 30, 2, 3, '#d9505f');
      break;
    }
    case 'fox': {                                                        // 레샤 인형 — 첫화면의 분홍 여우
      const wh = '#ffffff', ink = '#3a3226';
      oq(0, 19, 9, 6, c); oq(0, 20, 4, 5, '#5a3a24');                    // 꼬리 — 끝만 갈색
      oq(7, 2, 4, 3, c); oq(6, 4, 6, 5, c);                              // 귀 — 여우답게 낮고 넓은 세모
      oq(21, 2, 4, 3, c); oq(20, 4, 6, 5, c);
      oq(8, 5, 2, 3, '#ffd9e2'); oq(22, 5, 2, 3, '#ffd9e2');
      oq(6, 7, 20, 12, c); oq(6, 7, 20, 3, shade(c, 18));                // 머리
      oq(9, 11, 14, 8, wh);                                              // 흰 얼굴
      oq(11, 12, 2, 3, ink); oq(19, 12, 2, 3, ink);                      // 눈
      oq(11, 12, 1, 1, wh); oq(19, 12, 1, 1, wh);                        // 눈에 빛
      oq(15, 15, 2, 2, ink); oq(14, 17, 4, 1, ink);                      // 코와 입
      oq(7, 15, 2, 2, '#ff8fb0'); oq(23, 15, 2, 2, '#ff8fb0');           // 볼
      oq(8, 19, 16, 10, wh); oq(8, 19, 16, 3, c);                        // 몸
      oq(10, 23, 12, 1, shade(wh, -14));                                 // 봉제선
      oq(4, 20, 5, 7, c); oq(23, 20, 5, 7, c);                           // 팔
      oq(9, 28, 6, 4, wh); oq(17, 28, 6, 4, wh);                         // 발
      break;
    }
    case 'sangre': {                                                     // 상그렐라 인형 — 굴러다니는 그 얼굴
      const sh = shade(c, -12), bk = '#ffc94d', ink = '#3a3226';
      oq(11, 3, 10, 2, c); oq(8, 5, 16, 2, c); oq(6, 7, 20, 3, c);       // 동그란 몸
      oq(4, 10, 24, 12, c); oq(6, 22, 20, 3, c); oq(8, 25, 16, 2, c); oq(11, 27, 10, 2, c);
      oq(4, 18, 24, 4, sh); oq(8, 25, 16, 2, sh);                        // 아래쪽 그늘
      oq(6, 9, 4, 4, '#ffffff');                                         // 빛
      oq(9, 11, 3, 5, ink); oq(20, 11, 3, 5, ink);                       // 눈
      oq(13, 16, 6, 3, bk); oq(14, 19, 4, 1, ink);                       // 벌린 윗부리
      oq(13, 20, 6, 3, shade(bk, -20));                                  // 아랫부리
      oq(24, 13, 4, 7, sh); oq(24, 13, 4, 2, c);                         // 날개
      break;
    }
    case 'rabbit': {                                                     // 토끼 인형
      const pk = '#ffc0cf', ink = '#3a3226';
      oq(9, 0, 5, 12, c); oq(18, 0, 5, 12, c);                           // 긴 귀
      oq(10, 2, 3, 8, pk); oq(19, 2, 3, 8, pk);
      oq(7, 10, 18, 12, c); oq(7, 10, 18, 3, shade(c, 14));              // 머리
      oq(11, 14, 2, 3, ink); oq(19, 14, 2, 3, ink);
      oq(11, 14, 1, 1, '#ffffff'); oq(19, 14, 1, 1, '#ffffff');
      oq(15, 17, 2, 2, pk); oq(14, 19, 4, 1, ink);                       // 코와 입
      oq(8, 22, 16, 8, c); oq(10, 23, 12, 4, shade(c, 12));              // 몸
      oq(5, 23, 4, 6, c); oq(23, 23, 4, 6, c);                           // 팔
      oq(8, 29, 7, 3, c); oq(17, 29, 7, 3, c);                           // 발
      oq(24, 24, 4, 4, '#ffffff');                                       // 동그란 꼬리
      break;
    }
    case 'pcdesk': {                                                     // 컴퓨터 책상
      const HH = 30, tt = 4;
      // 돌리면 상판이 세로로 눕는다 — 위에 올리는 것은 상판 크기에 맞춰 잡는다
      const mw = Math.max(10, Math.round(E * 0.46)), mx = Math.round(E * 0.14);
      const kw = Math.max(8, Math.round(E * 0.36)), kx = Math.round(E * 0.52);
      const ky = Math.max(3, D - 16);
      box(3, 3, 5, 5, HH - tt, dk); box(E - 8, 3, 5, 5, HH - tt, dk);    // 다리 넷
      box(3, D - 8, 5, 5, HH - tt, dk); box(E - 8, D - 8, 5, 5, HH - tt, dk);
      box(4, Math.max(4, D - 15), Math.min(11, E - 8), 11, 22, '#454b54');   // 책상 밑 본체
      box3(4, Math.min(D - 4, Math.max(4, D - 15) + 11), 8, 1, 3, '#8fd9f0', '#8fd9f0', '#6fb8d8', 12);
      box(0, 0, E, D, tt, c, HH - tt);                                   // 상판
      box3(mx + 3, 2, mw - 6, 4, 2, '#4a505a', '#3a3f47', '#2f343b', HH);        // 모니터 받침
      box3(mx + Math.round(mw / 2) - 2, 3, 4, 2, 6, '#4a505a', '#3a3f47', '#2f343b', HH + 2);   // 목
      box3(mx, 1, mw, 4, 20, '#2f343b', '#3a3f47', '#262a30', HH + 8);           // 몸통
      box3(mx + 2, 4, mw - 4, 1, 15, '#a8e2f6', '#bfeaff', '#8fd0e8', HH + 11);  // 화면 — 앞면이 우리를 본다
      top(mx + 2, 4, HH + 26, mw - 4, 1, '#dff4ff');                             // 화면 위쪽 빛
      top(kx, ky, HH, kw, 9, '#3a3f47');                                         // 자판
      for (let a2 = kx + 2; a2 < kx + kw - 2; a2 += 3) top(a2, ky + 2, HH + 1, 2, 5, '#c9d2da');
      top(Math.min(E - 6, kx + kw + 2), ky + 3, HH, 5, 5, '#e3e9ee');            // 마우스
      box(E - 11, Math.max(5, D - 11), 6, 6, 9, '#f2857a', HH);                  // 컵
      top(E - 10, Math.max(6, D - 10), HH + 9, 4, 4, '#8a5f3a');
      break;
    }
    case 'sunflower': {                                                  // 해바라기 화분
      oq(9, 22, 14, 10, '#c97a5a'); oq(9, 20, 14, 4, '#e09a76'); oq(9, 30, 14, 2, '#a45f45');
      oq(11, 21, 10, 2, '#8a5f3a');                                      // 흙
      oq(15, 14, 2, 8, '#4f9a48'); oq(15, 14, 1, 8, '#6fb567');          // 줄기
      oq(8, 16, 7, 3, '#5da05a'); oq(7, 17, 2, 2, '#4f9a48');            // 잎 둘
      oq(17, 18, 7, 3, '#5da05a'); oq(23, 19, 2, 2, '#4f9a48');
      for (let i = 0; i < 12; i++){                                      // 꽃잎 열둘 — 하나씩 떨어뜨려 놓는다
        const ang = i * Math.PI / 6;
        const px2 = Math.round(16 + Math.cos(ang) * 9) - 2, py2 = Math.round(9 + Math.sin(ang) * 8) - 2;
        oq(px2, py2, 5, 5, i % 2 ? shade(c, -14) : c);
        oq(px2 + 1, py2, 3, 1, shade(c, 24));
      }
      oq(10, 4, 12, 10, shade(c, -18)); oq(11, 3, 10, 12, shade(c, -18));  // 씨자리 테
      oq(11, 4, 10, 10, '#8a5f3a'); oq(12, 5, 8, 8, '#6f4a2c');
      for (let x = 12; x < 20; x += 2) for (let y = 5; y < 12; y += 2) oq(x + (y / 2 % 2 ? 1 : 0), y, 1, 1, '#523524');
      break;
    }
    case 'rose': {                                                       // 장미 화분
      oq(10, 23, 12, 9, '#8ec9ee'); oq(10, 21, 12, 4, '#b6ddf3'); oq(10, 30, 12, 2, '#6fa8cc');
      oq(15, 10, 2, 12, '#4f9a48'); oq(11, 13, 2, 8, '#4f9a48'); oq(19, 15, 2, 6, '#4f9a48');   // 줄기 셋
      oq(8, 17, 5, 3, '#5da05a'); oq(19, 19, 5, 3, '#5da05a'); oq(13, 20, 5, 3, '#5da05a');     // 잎
      const rosy = (x, y, n) => {                                       // 겹겹이 말린 꽃 한 송이 (n×n)
        oq(x + 1, y, n - 2, 1, shade(c, -20));                           // 네 귀퉁이를 깎아 동그랗게
        oq(x, y + 1, n, n - 2, c);
        oq(x + 1, y + n - 1, n - 2, 1, shade(c, -20));
        oq(x, y + 1, 1, n - 2, shade(c, -20)); oq(x + n - 1, y + 1, 1, n - 2, shade(c, -20));
        oq(x + 1, y + 1, n - 2, 2, shade(c, 20));                        // 위쪽 빛
        oq(x + 2, y + 3, n - 4, n - 6, shade(c, -24));                   // 가운데 말린 자리
        oq(x + 3, y + 4, n - 6, 1, shade(c, 12));
      };
      rosy(11, 2, 9); rosy(6, 9, 7); rosy(18, 11, 7);
      break;
    }
    case 'guitar': {                                                     // 기타 — 머리부터 몸통까지 길쭉하게
      const wd = '#6f4a2c', dkw = '#3a2f26';
      oq(11, -17, 10, 7, dkw);                                           // 머리 (줄감개가 붙는 판)
      oq(12, -16, 8, 5, '#4a3a2c');
      [[9, -15], [9, -12], [21, -15], [21, -12]].forEach(([x, y]) => oq(x, y, 2, 2, '#d8c8a8'));   // 줄감개 넷
      oq(13, -10, 6, 1, '#e8dcc8');                                      // 너트
      oq(13, -10, 6, 18, '#4a3a2c');                                     // 목 (지판)
      oq(13, -10, 1, 18, wd); oq(18, -10, 1, 18, '#2b231c');
      for (let y = -7; y < 7; y += 3) oq(13, y, 6, 1, '#c9b28a');        // 프렛
      oq(10, 6, 12, 2, c); oq(8, 8, 16, 4, c);                           // 몸통 — 위 볼록
      oq(9, 12, 14, 2, c);                                               // 허리
      oq(6, 14, 20, 10, c); oq(8, 24, 16, 3, c); oq(10, 27, 12, 2, c);   // 아래 볼록
      oq(8, 8, 16, 2, shade(c, 26)); oq(6, 14, 20, 3, shade(c, 24));     // 위쪽 빛
      oq(8, 25, 16, 2, shade(c, -24)); oq(10, 27, 12, 2, shade(c, -32)); // 아래 그늘
      oq(6, 16, 2, 7, shade(c, -14)); oq(24, 16, 2, 7, shade(c, -14));   // 옆구리
      oq(13, 15, 6, 6, dkw); oq(14, 16, 4, 4, '#241c16');                // 사운드홀
      oq(11, 13, 10, 1, shade(c, -34)); oq(11, 22, 10, 1, shade(c, -34));// 홀 둘레 무늬
      oq(12, 23, 8, 2, dkw);                                             // 브리지
      oq(14, -9, 1, 33, '#f2e6cc'); oq(17, -9, 1, 33, '#c9b28a');        // 줄 — 두 가닥만 굵게 (넷을 다 그리면 지판이 하얘진다)
      break;
    }
    case 'trophy':
      oq(8, 24, 16, 8, '#8a5f3a'); oq(8, 24, 16, 2, '#a97b4f');
      oq(14, 18, 4, 6, shade(c, -20));
      oq(8, 4, 16, 12, c); oq(8, 4, 16, 4, shade(c, 30)); oq(10, 14, 12, 4, shade(c, -20));
      oq(4, 6, 4, 6, c); oq(24, 6, 4, 6, c);
      break;
    case 'xmas':
      oq(14, 26, 4, 6, '#8a5f3a');
      blob(CX, CY - 32 + 16, 26, 12, c, shade(c, 26), shade(c, -30), 'x1', (x, y, w, h, col) => q(x, y, w, h, col));
      blob(CX, CY - 32 + 8, 20, 10, c, shade(c, 26), shade(c, -30), 'x2', (x, y, w, h, col) => q(x, y, w, h, col));
      blob(CX, CY - 32 + 2, 12, 8, c, shade(c, 26), shade(c, -30), 'x3', (x, y, w, h, col) => q(x, y, w, h, col));
      oq(14, 0, 4, 4, '#ffd979'); oq(10, 12, 4, 4, '#f2707d'); oq(20, 18, 4, 4, '#5aa9e6'); oq(12, 22, 4, 4, '#ffd166');
      break;
    case 'easel':
      oq(6, 26, 4, 6, '#a97b4f'); oq(22, 26, 4, 6, '#a97b4f');
      oq(9, 4, 4, 24, c); oq(19, 4, 4, 24, c);
      oq(6, 8, 20, 16, '#fff6e9'); oq(6, 8, 20, 2, '#e8dcc8');
      oq(9, 12, 6, 6, '#ff8fb8'); oq(17, 14, 6, 4, '#6fb567'); oq(9, 20, 14, 2, '#5aa9e6');
      oq(7, 23, 18, 3, shade(c, -22));
      break;
    case 'rocker':
      oq(4, 26, 24, 4, '#a97b4f'); oq(2, 23, 4, 4, '#a97b4f'); oq(26, 23, 4, 4, '#a97b4f');
      oq(8, 20, 4, 7, '#c79b6d'); oq(19, 20, 4, 7, '#c79b6d');
      oq(6, 12, 20, 9, c); oq(6, 12, 20, 3, shade(c, 22));
      oq(19, 4, 10, 10, c); oq(19, 4, 10, 3, shade(c, 22));
      oq(25, 8, 2, 2, '#3a2a20'); oq(20, 2, 7, 3, '#e8574f'); oq(15, 6, 5, 8, '#e8574f');
      oq(8, 14, 11, 2, '#ffd166');
      break;
    case 'sakura':
      oq(11, 20, 10, 12, '#dfe8ee'); oq(11, 20, 4, 12, '#ffffff'); oq(10, 18, 12, 3, '#c3ced6');
      oq(15, 6, 2, 14, '#8a5f3a'); oq(9, 10, 8, 2, '#8a5f3a'); oq(17, 8, 7, 2, '#8a5f3a');
      [[6, 6], [10, 3], [20, 3], [24, 6], [7, 13], [22, 11], [14, 1]].forEach(pp => {
        oq(pp[0], pp[1], 5, 4, c); oq(pp[0] + 1, pp[1] + 1, 2, 2, '#ffffff');
      });
      break;
    case 'fan':
      oq(9, 28, 14, 4, '#b9c4cc'); oq(10, 29, 12, 2, '#8d99a3');                  // 받침
      oq(14, 17, 4, 12, '#c3ced6'); oq(14, 17, 2, 12, '#e3ebf0');                 // 기둥
      oq(7, 2, 18, 16, shade(c, -26)); oq(8, 3, 16, 14, '#8d99a3');               // 망
      oq(10, 5, 12, 10, shade(c, 6));
      oq(15, 4, 3, 7, '#ffffff'); oq(18, 11, 6, 3, '#eef4f7'); oq(8, 11, 6, 3, '#dbe4ea');  // 날개 셋
      oq(14, 9, 4, 4, '#7f8f99');                                                 // 가운데
      oq(8, 3, 16, 2, '#eef4f7');
      break;
    case 'pumpkin':
      oq(4, 14, 24, 15, c); oq(6, 12, 20, 19, c); oq(4, 17, 24, 12, shade(c, -16));
      oq(6, 12, 20, 4, shade(c, 22)); oq(9, 13, 3, 16, shade(c, 14));
      oq(14, 8, 4, 6, '#5da05a'); oq(18, 8, 4, 2, '#6fb567');
      oq(10, 18, 4, 4, '#3a2a20'); oq(18, 18, 4, 4, '#3a2a20');
      oq(12, 24, 8, 3, '#3a2a20'); oq(14, 22, 4, 2, '#3a2a20');
      break;
    default:
      box(2, 2, E - 4, D - 4, 20, c);
  }
  /* 마무리 — 해가 왼쪽 앞에 있다고 보고 아래를 눌러 준다.
     source-atop 이라 가구가 그려진 자리에만 얹히고 빈 자리는 그대로 둔다. */
  g.save(); g.globalCompositeOperation = 'source-atop';
  q(0, A.h - 5, A.w, 3, 'rgba(28,20,12,0.06)');
  q(0, A.h - 2, A.w, 2, 'rgba(28,20,12,0.11)');
  g.restore();
}
// 방 안의 아이 — 제 방에는 저마다, 거실에는 나
function roomKid(r){
  if (r === 'living') return key || 'sua';
  return R.ROOMS[r].owner;
}
function freeTile(r, prefer){
  const Rm = R.ROOMS[r];
  for (const p of prefer) if (!R.occupied(W, r, p[0], p[1])) return p;
  for (let y = Rm.h - 1; y >= 0; y--) for (let x = 0; x < Rm.w; x++) if (!R.occupied(W, r, x, y)) return [x, y];
  return [0, Rm.h - 1];
}
/* 방 그림은 한 번만 그린다. 그런데 아직 화면에 붙기 전이면 칸 너비를 못 재어
   fitPixelCanvas 가 물러서고, 낮은 배수(HS=2)에 그대로 머문다 — 실제로 거실이
   576픽셀로 굳어 있었고 제 크기는 960픽셀이었다. 화면 픽셀의 예순 퍼센트만 채운 셈이라
   도트가 뭉개져 보였다. 칸 크기가 잡히거나 바뀌면 그때 다시 그린다. */
function watchRoomCanvas(cv, r){
  if (cv.__roomWatch || !window.ResizeObserver) return;
  const host = cv.parentElement;
  if (!host) return;
  let last = 0;
  cv.__roomWatch = new ResizeObserver(() => {
    const w = host.clientWidth;
    if (!w || w === last) return;                // 같은 너비로 두 번 그리지 않는다
    last = w;
    drawRoom(cv, r);
  });
  cv.__roomWatch.observe(host);
}

function drawRoom(cv, r, tms){
  if (!cv || !W) return;
  const t = tms == null ? (window.performance ? performance.now() : Date.now()) : tms;
  const Rm = R.ROOMS[r]; if (!Rm) return;
  const A = roomArt(Rm), ox = isoOx(Rm), aw = A.w, ah = A.h;
  watchRoomCanvas(cv, r);
  const 전너비 = cv.width;
  fitPixelCanvas(cv, aw, ah, 6);
  /* 자리를 못 잡아 물러섰으면 잠시 뒤에 다시 잰다. 크기 관찰자만 믿으면 그것이
     안 도는 자리(숨어 있는 창 따위)에서 낮은 배수로 굳는다. 몇 번만 해 보고 그만둔다. */
  if (cv.width === 전너비 && cv.width < aw * 2){
    const 시도 = (cv.__roomTry = (cv.__roomTry || 0) + 1);
    if (시도 <= 12) setTimeout(() => drawRoom(cv, r), 60 * 시도);
  } else {
    cv.__roomTry = 0;
  }
  HS = pixScale(cv, aw, ah, 2);
  const cw = cv.width, ch = cv.height;
  const L = dayLight();
  // 놓인 것을 벽에 거는 것과 바닥에 두는 것으로 나눈다
  const P = R.placed(W, r), wallItems = [], floorItems = [];
  Object.keys(P).forEach(k => {
    const p = k.split(',').map(Number), it = P[k];
    const F = R.FURNITURE[it.f]; if (!F) return;
    (WALL_KINDS[F.kind] ? wallItems : floorItems).push({ f: it.f, r: it.r || 0, x: p[0], y: p[1] });
  });
  // 벽에 건 것은 바탕에 함께 굽는다 — 매 칸마다 계단을 쌓느라 프레임이 무거워진다
  wallItems.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const wsig = wallItems.map(i => i.f + i.x + ',' + i.y).join('|');
  if (!houseBg) houseBg = document.createElement('canvas');
  const sig = r + '|' + cw + 'x' + ch + '|' + (L.dark > 0.42 ? 'n' : L.dark > 0.2 ? 'e' : L.dark > 0.08 ? 'd' : 'l') + '|' + wsig;
  if (houseBg.width !== cw || houseBg.height !== ch){ houseBg.width = cw; houseBg.height = ch; houseSig = ''; }
  if (sig !== houseSig){
    houseSig = sig;
    const bg = houseBg.getContext('2d'); bg.imageSmoothingEnabled = false;
    bg.clearRect(0, 0, cw, ch);
    const keep = ctx; ctx = bg;
    drawRoomShell(bg, r, L, wallItems);
    ctx = keep;
  }
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cw, ch); g.drawImage(houseBg, 0, 0);
  // 바닥에 둔 것 — 뒤(x+y 가 작은 쪽)부터 그려야 앞뒤가 맞다
  const glow = [];
  const held = grab && grab.moved && room === r ? grab : null;      // 끌고 있는 것은 제자리에 안 그린다
  floorItems.sort((a, b) => (a.x + a.y) - (b.x + b.y) || (a.x - b.x)).forEach(it => {
    if (held && it.x === held.fx && it.y === held.fy) return;
    drawFurnItem(g, it.f, it.r, Rm, it.x, it.y, t);
    const kind = R.FURNITURE[it.f].kind;
    if (kind === 'lamp' || kind === 'fire' || kind === 'stove' || kind === 'xmas')
      glow.push({ x: isoX(Rm, it.x, it.y) * HS, y: (isoY(it.x, it.y) - 16) * HS, r: (kind === 'fire' ? 76 : 54) * HS });
  });
  wallItems.forEach(it => { if (R.FURNITURE[it.f].kind === 'stars'){
    const s = wallSlot(Rm, it.x, it.y);
    glow.push({ x: (ox + s.side * (s.at * (TW / 2) + 12)) * HS, y: (s.at * (TW / 2) / 2 + 34) * HS, r: 54 * HS });
  } });
  // 아이와 고양이 — 앞에서 본 그림이라 레퍼런스처럼 방과 섞여도 어색하지 않다
  const keep2 = ctx; ctx = g;
  const who = roomKid(r);
  if (who){
    const sp = freeTile(r, [[Math.floor(Rm.w / 2), Rm.h - 1], [1, Rm.h - 1], [Rm.w - 2, Rm.h - 1]]);
    const A2 = KIDART[who] || KIDART.yona;
    const blink = (Math.floor(t / 220) % 22) === 0;
    const bob = Math.sin(t / 900) > 0.75 ? 2 : 0;
    const kx = isoX(Rm, sp[0], sp[1]), ky = isoY(sp[0], sp[1]) + TH / 2 + bob;
    isoTop(dotFill(g), kx, ky - 6, 14, 14, 'rgba(26,20,12,0.20)');
    const rows = blink ? A2.down[1] : A2.down[0];
    g.drawImage(outlined(who + 'room' + (blink ? 1 : 0), rows, KIDPAL[who], false, HS), Math.round((kx - 14) * HS), Math.round((ky - 34) * HS));
  }
  const cat = floorItems.find(i => R.FURNITURE[i.f].kind === 'catbed');
  if (cat){
    const wag = Math.sin(t / 700) > 0 ? 0 : 2;
    g.drawImage(outlined('bcat', BEAST.cat.art, BEAST.cat.pal, false, HS),
      Math.round((isoX(Rm, cat.x, cat.y) - 14) * HS), Math.round((isoY(cat.x, cat.y) - 4 - wag) * HS));
  }
  ctx = keep2;
  // 빛 — 방도 농장과 같은 표로 물들인다. 안쪽은 조금 덜 어둡게.
  if (L.dark > 0.06) grade(g, cw, ch, L, 0.82);
  if (L.dark > 0.12 && glow.length){
    g.save(); g.globalCompositeOperation = 'lighter';
    const power = Math.min(1, L.dark * 1.9);
    glow.forEach(l => {
      const rg = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      rg.addColorStop(0, 'rgba(255,206,122,' + (power * 0.55).toFixed(2) + ')');
      rg.addColorStop(0.5, 'rgba(255,190,110,' + (power * 0.2).toFixed(2) + ')');
      rg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = rg; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    });
    g.restore();
  }
  // 낮에는 창으로 빛이 비스듬히 들어온다 — 먼지가 반짝
  if (L.dark < 0.12){
    const LW = Rm.w * (TW / 2), wu = Math.max(6, Math.floor((LW / 2 - 30) / 2) * 2);
    const wcx = ox + wu + 30, wcy = (wu + 30) / 2 + 35;
    g.save();
    g.beginPath();                                   // 바닥 마름모 밖으로는 새지 않게
    g.moveTo(ox * HS, WALLH * HS);
    g.lineTo((ox + Rm.w * (TW / 2)) * HS, (WALLH + Rm.w * (TH / 2)) * HS);
    g.lineTo((Rm.w * (TW / 2)) * HS, (WALLH + (Rm.w + Rm.h) * (TH / 2)) * HS);
    g.lineTo(0, (WALLH + Rm.h * (TH / 2)) * HS);
    g.closePath(); g.clip();
    g.globalAlpha = 0.13; g.fillStyle = '#fff6c0';
    g.beginPath();
    g.moveTo((wcx - 30) * HS, (wcy - 20) * HS); g.lineTo((wcx + 30) * HS, (wcy + 10) * HS);
    g.lineTo((wcx + 30 - 210) * HS, (wcy + 10 + 118) * HS); g.lineTo((wcx - 30 - 160) * HS, (wcy - 20 + 88) * HS);
    g.closePath(); g.fill();
    g.restore();
    for (let i = 0; i < 10; i++){
      const ph = ((t / 26) + i * 90) % 620;
      const dx = (wcx - 6 - ph * 0.30 + R.prand('du' + i) * 46) * HS;
      const dy = (wcy - 12 + ph * 0.16 + R.prand('dv' + i) * 26) * HS;
      if (dy > ch || dx < 0) continue;
      g.globalAlpha = 0.5 - ph / 1400; g.fillStyle = '#fff6c0';
      g.fillRect(Math.round(dx), Math.round(dy), HS, HS); g.globalAlpha = 1;
    }
  }
  /* 끌어 옮기는 중 — 원래 자리에는 자국만, 손끝 칸에는 옮길 모습을 미리 보여 준다.
     놓을 수 있으면 초록, 안 되면 빨강. 아이가 손을 떼기 전에 알 수 있어야 한다. */
  if (held){
    const dot2 = (x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x * HS), Math.round(y * HS), Math.max(1, Math.round(2 * HS)), Math.max(1, Math.round(HS))); };
    const b = R.furnBox(held.f, held.r), EW = b.w * (TW / 2), EH = b.h * (TW / 2);
    const mark = (x0, y0, col) => {
      const X = isoX(Rm, x0, y0), Y = isoY(x0, y0);
      for (let i = 0; i < EW; i += 2){ dot2(X + i, Y + i / 2, col); dot2(X - EH + i, Y + EH / 2 + i / 2, col); }
      for (let i = 0; i < EH; i += 2){ dot2(X - i - 2, Y + (i + 2) / 2, col); dot2(X + EW - i - 2, Y + EW / 2 + (i + 2) / 2, col); }
    };
    g.save(); g.globalAlpha = 0.45; mark(held.fx, held.fy, '#ffffff'); g.restore();
    g.save(); g.globalAlpha = 0.85; mark(held.tx, held.ty, held.ok ? '#8fd98f' : '#ff8f8f'); g.restore();
    g.save(); g.globalAlpha = held.ok ? 0.9 : 0.4;
    drawFurnItem(g, held.f, held.r, Rm, held.tx, held.ty, t);
    g.restore();
  }
  // 가구를 놓거나 돌릴 때는 칸을 보여 준다 — 마름모 격자다
  if (tab === 'house' && (arrange || furnPick || rotMode)){
    const dot = (x, y) => g.fillRect(Math.round(x * HS), Math.round(y * HS), Math.max(1, Math.round(2 * HS)), Math.max(1, Math.round(HS)));
    g.save(); g.globalAlpha = 0.34; g.fillStyle = '#ffffff';
    for (let y = 0; y <= Rm.h; y++){
      const X = isoX(Rm, 0, y), Y = isoY(0, y);
      for (let i = 0; i < Rm.w * (TW / 2); i += 2) dot(X + i, Y + i / 2);
    }
    for (let x = 0; x <= Rm.w; x++){
      const X = isoX(Rm, x, 0), Y = isoY(x, 0);
      for (let i = 0; i < Rm.h * (TW / 2); i += 2) dot(X - i - 2, Y + (i + 2) / 2);
    }
    g.restore();
    if (rotMode){
      g.save(); g.globalAlpha = 0.7; g.fillStyle = '#ffd166';
      floorItems.forEach(it => {
        const b = R.furnBox(it.f, it.r), X = isoX(Rm, it.x, it.y), Y = isoY(it.x, it.y);
        const EW = b.w * (TW / 2), EH = b.h * (TW / 2);
        for (let i = 0; i < EW; i += 2){ dot(X + i, Y + i / 2); dot(X - EH + i, Y + EH / 2 + i / 2); }
        for (let i = 0; i < EH; i += 2){ dot(X - i - 2, Y + (i + 2) / 2); dot(X + EW - i - 2, Y + EW / 2 + (i + 2) / 2); }
      });
      g.restore();
    }
  }
}
function renderHouse(){
  const rb = $('#rooms'); rb.innerHTML = '';
  Object.keys(R.ROOMS).forEach(r => rb.appendChild(btn(R.ROOMS[r].name, room === r ? 'on' : '', () => { room = r; rotMode = false; arrange = false; furnPick = null; houseSig = ''; renderHouse(); })));
  const cz = R.cozyOf(W), lvl = R.cozyLevel(W), nxt = R.COZY_LEVELS[lvl + 1];
  $('#cozy').innerHTML = '아늑함 <span class="hearts">' + '♥'.repeat(lvl) + '♡'.repeat(Math.max(0, 5 - lvl)) + '</span> ' + cz + (nxt ? ' / ' + nxt : '') + ' · 기운 최대 ' + R.maxEnergy(W, M);
  const Rm = R.ROOMS[room];
  const hcv = $('#houseCanvas');
  hcv.style.touchAction = arrange ? 'none' : '';   // 재배치 중엔 끌어도 화면이 안 따라 움직인다
  drawRoom(hcv, room);
  const mineRoom = !Rm.owner || Rm.owner === key;
  const dirName = ['↑ 처음', '→ 오른쪽', '↓ 뒤로', '← 왼쪽'][furnRot];
  $('#houseHint').innerHTML = !mineRoom ? NAME[Rm.owner] + '의 방이에요. 구경만 해요.'
    : !arrange ? '<b>재배치</b>를 누르면 가구를 놓거나 가방에 넣을 수 있어요.'
    : rotMode ? '<b>돌리기</b> 중이에요. 놓인 가구를 누르면 90도씩 돌아가요. 다시 누르면 끝나요.'
    : furnPick ? '<b>' + R.FURNITURE[furnPick].name + '</b>을 놓을 자리를 눌러요 (' + dirName + '). 놓인 가구를 누르면 가방에 들어가요.'
    : '놓인 가구는 <b>끌어서</b> 옮겨요. 그냥 누르면 가방에 들어가요. 가방의 가구를 고르면 놓을 수 있어요.';
  const fb = $('#furn'); fb.innerHTML = '';
  if (mineRoom){
    // 재배치 — 이걸 누른 뒤에만 들고 놓고 돌릴 수 있다. 끝내면 들고 있던 것도 내려놓는다
    const ab = btn(arrange ? '✅ 재배치 끝' : '🔧 재배치', arrange ? 'on' : '', () => {
      arrange = !arrange;
      if (!arrange){ furnPick = null; rotMode = false; }
      renderHouse();
    });
    ab.classList.add('rotbtn'); fb.appendChild(ab);
  }
  if (mineRoom && arrange){
    // 돌리기 — 들고 있으면 놓을 각도를, 아니면 놓인 것을 돌리는 모드를 바꾼다
    const rb = btn('🔄 ' + (furnPick ? '돌려서 놓기 ' + dirName : rotMode ? '돌리기 끝' : '돌리기'), rotMode ? 'on' : '', () => {
      if (furnPick) furnRot = (furnRot + 1) % 4;
      else rotMode = !rotMode;
      renderHouse();
    });
    rb.classList.add('rotbtn'); fb.appendChild(rb);
    Object.keys(M.inv).filter(k => k.startsWith('f:') && M.inv[k] > 0).forEach(k => {
      const f = k.slice(2), b = btn('', furnPick === f ? 'on' : '', () => { furnPick = furnPick === f ? null : f; rotMode = false; renderHouse(); });
      b.appendChild(itemIcon(k)); b.appendChild(document.createTextNode(R.FURNITURE[f].name + ' ×' + M.inv[k])); fb.appendChild(b);
    });
  }
  if (furnPick && !(M.inv['f:' + furnPick] > 0)) furnPick = null;
  // 부엌
  const kb = $('#kitchen'); kb.innerHTML = '';
  if (built('kitchen')){
    kb.innerHTML = '<h3 class="pixel" style="margin-top:14px;">부엌</h3><p class="sub">아는 요리만 나와요. 요리법은 가게에서.</p>';
    const grid = document.createElement('div'); grid.className = 'items';
    M.recipes.forEach(d => {
      const Dd = R.DISHES[d], ok = R.canCook(M, d);
      const card = itemCard('dish:' + d, M.inv['dish:' + d] || 0, null, ok ? '' : 'locked');
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = Object.keys(Dd.need).map(k => R.itemName(k) + ' ' + Dd.need[k] + '(' + R.countOf(M, k) + ')').join(' + '); card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(btn('만들기', 'buy', () => { const r = act((w, m) => R.cook(w, m, d, now())); if (r.ok) sfx('sparkle'); }, !ok)); card.appendChild(a); grid.appendChild(card);
    });
    kb.appendChild(grid);
  } else {
    kb.innerHTML = '<p class="sub" style="margin-top:12px;">부엌은 둘이서 탭에서 같이 지어요. 지으면 여기서 요리할 수 있어요.</p>';
  }
}
// 화면 자리 → 방의 칸. 마름모 격자라 x,y 를 따로 나누면 안 되고 두 축을 함께 되돌린다
function houseTileAt(e){
  const cv = $('#houseCanvas'), r = cv.getBoundingClientRect(); const w = r.width || cv.width, h = r.height || cv.height;
  const Rm = R.ROOMS[room];
  const x = (e.clientX - r.left) / w * cv.width / HS, y = (e.clientY - r.top) / h * cv.height / HS;
  const T2 = dotTile(Rm, x, y);
  return { x, y, tx: T2.tx, ty: T2.ty, Rm };
}
// 지금 끌고 있는 것을 그 자리에 놓을 수 있나 — 방 밖으로 나가거나 다른 가구와 겹치면 안 된다
function grabFits(){
  const Rm = R.ROOMS[room], b = R.furnBox(grab.f, grab.r);
  if (grab.tx < 0 || grab.ty < 0 || grab.tx + b.w > Rm.w || grab.ty + b.h > Rm.h) return false;
  for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++){
    const o = R.occupied(W, room, grab.tx + i, grab.ty + j);
    if (o && o !== grab.k) return false;
  }
  return true;
}
/* 가구 집어 끌기. 재배치 중에 놓인 가구를 누른 채 끌면 그 칸으로 옮긴다.
   끌지 않고 그냥 누르면 예전대로 가방에 들어간다 — 누르는 것과 끄는 것을 손이 알아서 고른다. */
function onHouseDown(e){
  if (tab !== 'house' || !arrange || rotMode || furnPick) return;
  const Rm = R.ROOMS[room];
  if (Rm.owner && Rm.owner !== key) return;             // 남의 방은 못 만진다
  const p = houseTileAt(e);
  if (p.tx < 0 || p.ty < 0 || p.tx >= Rm.w || p.ty >= Rm.h) return;
  const k = R.occupied(W, room, p.tx, p.ty); if (!k) return;
  const it = R.placed(W, room)[k];
  if (!it || R.FURNITURE[it.f].wall) return;            // 벽에 건 것은 안 끈다
  const parts = k.split(',').map(Number);
  grab = { k, f: it.f, r: it.r || 0, fx: parts[0], fy: parts[1],
           ox: p.tx - parts[0], oy: p.ty - parts[1], tx: parts[0], ty: parts[1],
           sx: e.clientX, sy: e.clientY, moved: false, ok: true };
  try { $('#houseCanvas').setPointerCapture(e.pointerId); } catch (err) { /* 붙잡기는 덤이다 */ }
}
function onHouseMove(e){
  if (!grab) return;
  // 몇 도트 안 움직였으면 아직 「누른 것」이다 — 손가락은 조금씩 떨린다
  if (!grab.moved && Math.abs(e.clientX - grab.sx) < 6 && Math.abs(e.clientY - grab.sy) < 6) return;
  grab.moved = true;
  const p = houseTileAt(e);
  grab.tx = p.tx - grab.ox; grab.ty = p.ty - grab.oy;
  grab.ok = grabFits();
}
function onHouseUp(){
  if (!grab) return;
  const gg = grab; grab = null;
  if (!gg.moved) return;                                 // 끌지 않았으면 뒤따라 오는 click 이 맡는다
  grabClick = true;                                      // 끌고 난 뒤의 click 은 삼킨다
  if (gg.tx === gg.fx && gg.ty === gg.fy){ renderHouse(); return; }
  const r2 = act((w2, m) => R.moveFurn(w2, m, room, gg.k, gg.tx, gg.ty));
  if (r2.ok) sfx('plant');
  renderHouse();
}
function onHouseTap(e){
  if (grabClick){ grabClick = false; return; }
  const p = houseTileAt(e), Rm = p.Rm, tx = p.tx, ty = p.ty, y = p.y;
  if (tx < 0 || ty < 0 || tx >= Rm.w || ty >= Rm.h){
    if (y < WALLH) flash('벽이에요. 가구는 바닥에 놓아요');
    return;
  }
  const occ = R.occupied(W, room, tx, ty);
  // 재배치 중이 아니면 구경만 — 가구가 가방으로 들어가 버리지 않는다
  if (!arrange){
    const Rm2 = R.ROOMS[room];
    if (!Rm2.owner || Rm2.owner === key) flash('재배치를 누르면 가구를 끌어 옮길 수 있어요');
    return;
  }
  if (rotMode){
    if (!occ){ flash('돌릴 가구를 눌러요', true); return; }
    const r2 = act((w2, m) => R.rotateFurn(w2, m, room, occ));
    if (r2.ok) sfx('prop');
    renderHouse(); return;
  }
  if (occ){ const r2 = act((w2, m) => R.pickUp(w2, m, room, occ)); if (r2.ok){ sfx('prop'); furnPick = null; } renderHouse(); return; }
  if (furnPick){
    const f = furnPick, rr = furnRot;
    const r2 = act((w2, m) => R.place(w2, m, room, f, tx, ty, rr));
    if (r2.ok) sfx('plant');
    if (!(M.inv['f:' + f] > 0)) furnPick = null;
    renderHouse(); return;
  }
  flash('가방의 가구를 먼저 골라요');
}

// ---------- 둘이서 ----------
function renderDuo(){
  const lv = R.levelOf(M.xp), o = R.OTHER[key];
  const bb = $('#builds'); bb.innerHTML = '';
  Object.keys(R.BUILDINGS).forEach(id => {
    const B = R.BUILDINGS[id], s = R.buildState(W, id);
    const d = document.createElement('div'); d.className = 'build' + (s.done ? ' done' : '');
    const need = Object.keys(B.each).map(k => (k === 'coins' ? '🪙 ' : R.itemName(k) + ' ') + B.each[k] + (k === 'coins' ? '' : '(' + (M.inv[k] || 0) + ')')).join(' · ');
    d.innerHTML = '<div class="nm">' + B.icon + ' ' + B.name + (s.done ? ' · 다 지었어요' : lv < B.lv ? ' · 레벨 ' + B.lv + '부터' : '') + '</div><div>' + B.desc + '</div>' +
      '<div class="who"><span class="' + (s.sua ? 'paid' : '') + '">수아' + (s.sua ? ' ✓' : '') + '</span><span class="' + (s.yona ? 'paid' : '') + '">연아' + (s.yona ? ' ✓' : '') + '</span></div>' +
      (s.done ? '' : '<div class="need">각자 ' + need + '</div>');
    if (!s.done && !s[key]){ const b = btn(s[o] ? '내 몫 내기 — ' + NAME[o] + '가 기다려요!' : '내 몫 내기', 'sm', () => { const r = act((w, m) => R.contribute(w, m, id, now())); if (r.ok) sfx(r.built ? 'fanfare' : 'pop'); }, lv < B.lv || !R.canPay(M, B.each)); b.style.marginTop = '6px'; d.appendChild(b); }
    bb.appendChild(d);
  });
  // 주문
  const ob = $('#orders'); ob.innerHTML = '';
  R.ordersOf(W, now()).forEach(od => {
    const p = R.orderProgress(W, od), C = R.CROPS[od.crop], have = R.countOf(M, 'crop:' + od.crop);
    const d = document.createElement('div'); d.className = 'order' + (p.done ? ' done' : '');
    d.innerHTML = '<b>' + C.name + ' ' + od.n + '개</b><span class="pb"><i style="width:' + Math.round(100 * p.got / od.n) + '%"></i></span><span>' + p.got + '/' + od.n + ' · 🪙 ' + od.reward + (od.rareSeed ? ' + 별씨앗' : '') + '</span>' +
      (Object.keys(p.by || {}).length ? '<span class="sub" style="margin:0;flex-basis:100%;">' + Object.keys(p.by).map(k => NAME[k] + ' ' + p.by[k]).join(' · ') + '</span>' : '');
    if (!p.done) d.appendChild(btn('보태기 (' + have + '개 있음)', 'sm', () => { const n = Math.min(have, od.n - p.got); act((w, m) => R.fillOrder(w, m, od, n, now())); sfx('pop'); }, !have));
    ob.appendChild(d);
  });
  // 축제
  const cal = R.calendar(W, now()), F = R.FESTIVALS[cal.season], fk = R.festivalKey(W, now()), fs = W.festival[fk];
  const fb = $('#fest');
  const openNow = R.festivalOpen(W, now());
  fb.innerHTML = '<b class="t">' + F.icon + ' ' + F.name + '</b> — ' + F.desc + '<br>' + (fs && fs.done ? '이번 ' + R.SEASON_NAME[cal.season] + ' 축제는 상을 받았어요 🏆' : openNow ? '지금 열렸어요! ' + (fs ? fs.score : 0) + '/' + F.n : R.SEASON_NAME[cal.season] + ' ' + (cal.len - 1) + '일째부터 열려요 (' + Math.max(0, cal.len - 1 - cal.dayOfSeason) + '일 뒤). 미리 모아 둬요.') +
    (fs && !fs.done && Object.keys(fs.by || {}).length ? '<br><span class="sub">' + Object.keys(fs.by).map(k => NAME[k] + ' ' + fs.by[k]).join(' · ') + '</span>' : '');
  if (openNow && !(fs && fs.done)){
    const wrap = document.createElement('div'); wrap.className = 'act'; wrap.style.marginTop = '6px';
    Object.keys(M.inv).filter(id => M.inv[id] > 0 && R.festivalWorth(cal.season, id, W, now()) > 0).forEach(id => wrap.appendChild(btn(R.itemName(id) + ' ' + M.inv[id] + '개 내기', 'sm', () => { const n = M.inv[id]; const r = act((w, m) => R.donate(w, m, id, n, now())); if (r.ok) sfx(r.won ? 'fanfare' : 'pop'); })));
    if (!wrap.children.length) wrap.innerHTML = '<span class="sub">낼 것이 가방에 없어요</span>';
    fb.appendChild(wrap);
  }
  // 동물
  const ab = $('#animals'); ab.innerHTML = '';
  if (!W.animals.length) ab.innerHTML = '<p class="sub">아직 동물이 없어요. 닭장을 지으면 가게에서 닭을 살 수 있어요.</p>';
  const today = R.dayKey(now());
  W.animals.forEach(a => {
    const d = document.createElement('div'); d.className = 'animal';
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; cv.getContext('2d').imageSmoothingEnabled = false; drawAnimalAt(cv.getContext('2d'), a.kind, 4, 5, 1, false, a.baby ? 2 / 3 : 1); d.appendChild(cv);
    const info = document.createElement('div');
    const petted = a.petDay === today ? (a.pet || []) : [];
    // 새끼는 아직 알을 못 낳는다. 며칠 더 돌보면 어른이 되는지 알려 준다.
    const grow = a.baby ? Math.max(1, R.BABY_DAYS - R.daysBetween(a.born, today)) : 0;
    info.innerHTML = '<span class="nm">' + escapeHTML(a.name) + '</span> ' + (a.baby ? '<span class="baby">🐣 아기</span> ' : '') + '<span class="love">' + '♥'.repeat(a.love || 0) + '♡'.repeat(10 - (a.love || 0)) + '</span><br><span class="sub" style="margin:0;">' + (a.fedDay === today ? '밥 먹었어요' : '<b>배고파요</b>') + ' · 쓰다듬기 ' + (petted.length ? petted.map(k => NAME[k]).join('·') : '아직') + (a.baby ? ' · <b>' + grow + '일</b> 뒤 어른이 돼요' : '') + (a.ready ? ' · <b>' + escapeHTML(R.ee(R.itemName(a.ready))) + '</b> 있어요' : '') + '</span>';
    d.appendChild(info);
    const act2 = document.createElement('div'); act2.className = 'act';
    act2.appendChild(btn('🍚 밥', 'sm', () => act((w, m) => R.feed(w, m, a.id, now())), a.fedDay === today));
    act2.appendChild(btn('🤚 쓰다듬기', 'sm', () => { const r = act((w, m) => R.pet(w, m, a.id, now())); if (r.love) sfx('purr'); }, petted.indexOf(key) >= 0));
    if (a.ready) act2.appendChild(btn('줍기', 'sm buy', () => { act((w, m) => R.collect(w, m, a.id, now())); sfx('pop'); }));
    act2.appendChild(btn('✏️', 'sm', () => nameDialog(a)));
    d.appendChild(act2); ab.appendChild(d);
  });
}

// ---------- 도감 ----------
function renderDex(){
  const box = $('#dex'); box.innerHTML = '';
  const all = R.CROP_IDS.map(c => ['crop:' + c, c]).concat(R.CROP_IDS.filter(c => R.CROPS[c].giant).map(c => ['giant:' + c, 'giant:' + c]))
    .concat(['egg', 'bigegg', 'milk', 'goldmilk', 'wool', 'honey', 'firefly'].map(k => [k, k]))
    .concat(R.FISH_IDS.map(f => ['fish:' + f, 'fish:' + f])).concat(Object.keys(R.DISHES).map(d => ['dish:' + d, 'dish:' + d]));
  let got = 0, gold = 0;
  all.forEach(([id, dexKey]) => {
    const have = M.dex.indexOf(dexKey) >= 0; if (have) got++;
    // 반짝 작물은 따로 칸을 만들지 않고, 그 작물 칸에 금테와 별을 얹는다
    const shiny = id.slice(0, 5) === 'crop:' && M.dex.indexOf('gold:' + id.slice(5)) >= 0;
    if (shiny) gold++;
    const d = document.createElement('div'); d.className = have ? (shiny ? 'gold' : '') : 'no';
    d.appendChild(itemIcon(shiny ? 'gold:' + id.slice(5) : id));
    d.appendChild(document.createTextNode(have ? R.itemName(id) : '???'));
    if (shiny){ const sp = document.createElement('span'); sp.className = 'sp'; sp.textContent = '★★★'; d.appendChild(sp); }
    box.appendChild(d);
  });
  $('#dexCount').textContent = got + '/' + all.length + (gold ? ' · 반짝 ' + gold : '');
  const st = M.stats || {};
  $('#stats').innerHTML = [['거둔 작물', st.harvested], ['물 준 횟수', st.watered], ['심은 씨앗', st.planted], ['판 물건', st.sold], ['보낸 선물', st.gifted], ['만든 요리', st.cooked], ['모은 재료', st.gathered], ['낚은 물고기', st.fished], ['잡은 반딧불이', st.caught], ['온 날', (M.playDays || []).length + '일']].map(x => '<div>' + x[0] + '<b>' + (x[1] || 0) + '</b></div>').join('');
  renderMedals();
  $('#logs').innerHTML = (W.log || []).slice(0, 12).map(l => '<li><b>' + formatDate(l.t) + '</b> ' + escapeHTML(l.text).replace(/&lt;b&gt;|&lt;\/b&gt;/g, '') + '</li>').join('') || '<li>아직 일지가 없어요</li>';
}

/* 훈장. 조건이 찬 것은 초록 테로 눈에 띄게 하고, 받고 나면 금테로 남는다.
   받기를 눌러야 동전이 오므로 「받았다」는 실감이 생긴다. */
function renderMedals(){
  const box = $('#medals'); if (!box) return;
  box.innerHTML = '';
  const list = R.medalState(W, M);
  list.forEach(m => {
    const d = document.createElement('div');
    d.className = m.got ? 'got' : m.ready ? 'can' : 'no';
    d.innerHTML = '<span class="ic">' + m.icon + '</span><span><b>' + escapeHTML(m.name) + '</b><br>'
      + escapeHTML(m.got ? '받았어요' : m.desc) + '</span>';
    if (!m.got && m.ready){
      d.appendChild(btn('받기 🪙' + m.coins, 'sm buy', () => {
        const r = act((w, mm) => R.claimMedal(w, mm, m.id, now()));
        if (r.ok) sfx('fanfare');
      }));
    }
    box.appendChild(d);
  });
  $('#medalCount').textContent = list.filter(m => m.got).length + '/' + list.length;
}

/* ---------- 오늘의 농장 한 장 ----------
   지금 화면을 그대로 한 장으로 뜬다. 위에 날짜·계절·날씨를 적은 띠를 얹어
   나중에 봐도 언제의 농장인지 알 수 있게 한다. 농장 그림에는 바깥 그림이 한 장도
   섞이지 않으므로 캔버스가 더럽혀지지 않는다 — toBlob 이 그대로 된다. */
function snapCanvas(){
  const src = liveCv || $('#farmCanvas');
  const BAR = Math.round(src.width * 0.062), PAD = Math.round(src.width * 0.012);
  const o = document.createElement('canvas');
  o.width = src.width + PAD * 2; o.height = src.height + BAR + PAD * 2;
  const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#fff6e9'; g.fillRect(0, 0, o.width, o.height);
  g.drawImage(src, PAD, BAR + PAD);
  const cal = R.calendar(W, now()), wk = R.weatherOf(R.dayKey(now()), cal.season);
  const WNAME = { sun: '맑음', cloud: '흐림', rain: '비', storm: '비바람', wind: '바람', snow: '눈' };
  g.fillStyle = '#3a3226';
  g.font = '700 ' + Math.round(BAR * 0.46) + 'px "Galmuri11", system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('수아연아 농장 · ' + R.dayKey(now()), PAD + 4, PAD + BAR * 0.5);
  const right = R.SEASON_ICON[cal.season] + ' ' + R.SEASON_NAME[cal.season] + ' ' + cal.year + '년째 · '
    + (WNAME[wk] || wk) + ' · Lv ' + R.levelOf(M.xp);
  g.textAlign = 'right';
  g.fillText(right, o.width - PAD - 4, PAD + BAR * 0.5);
  g.textAlign = 'left';
  g.fillStyle = '#3a3226'; g.fillRect(0, BAR + PAD - 3, o.width, 3);
  return o;
}
function openSnap(){
  if (!W || !M){ flash('농장을 먼저 열어요', true); return; }
  drawFarm(liveCv || $('#farmCanvas'));
  const cv = snapCanvas();
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">📷 오늘의 농장 한 장</h3>'
    + '<p class="sub">지금 이 순간의 농장이에요. 작품으로 내면 부모님이 보고 전시실에 걸어 줘요.</p>'
    + '<div class="snapwrap" id="snapWrap"></div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="snapSend">🖼 작품으로 내기</button>'
    + '<button type="button" class="dot-btn small" id="snapClose">닫기</button></div>';
  $('#snapWrap').appendChild(cv);
  $('#modal').hidden = false;
  $('#snapClose').addEventListener('click', closeModal);
  $('#snapSend').addEventListener('click', () => sendSnap(cv, $('#snapSend')));
}
async function sendSnap(cv, b){
  b.disabled = true; b.textContent = '내는 중…';
  try {
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('그림을 만들지 못했어요');
    const path = 'suayona/farm/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.png';
    const up = await sb.storage.from('event-images').upload(path, blob, { contentType: 'image/png', upsert: false });
    if (up.error) throw up.error;
    const { data: pub } = sb.storage.from('event-images').getPublicUrl(path);
    const { data: { user } } = await sb.auth.getUser();
    const cal = R.calendar(W, now());
    const { error } = await sb.from('works').insert({
      title: '오늘의 농장 · ' + R.SEASON_NAME[cal.season] + ' ' + cal.year + '년째',
      quote: R.dayKey(now()) + '의 수아연아 농장',
      author: key,
      media_type: 'image',
      media_url: pub.publicUrl,
      made_on: new Date().toISOString().slice(0, 10),
      status: 'pending',
      written_by: user.id,
    });
    if (error) throw error;
    b.textContent = '냈어요!';
    flash('오늘의 농장을 작품으로 냈어요. 부모님이 보고 전시실에 걸어 줘요');
    setTimeout(closeModal, 900);
  } catch (e) {
    b.disabled = false; b.textContent = '🖼 작품으로 내기';
    flash('내지 못했어요: ' + readableError(e), true);
  }
}

// ---------- 배선 ----------
function wireUI(){
  $('#farmCanvas').addEventListener('click', onFarmTap);
  const hc = $('#houseCanvas');
  hc.addEventListener('click', onHouseTap);
  hc.addEventListener('pointerdown', onHouseDown);
  hc.addEventListener('pointermove', onHouseMove);
  hc.addEventListener('pointerup', onHouseUp);
  hc.addEventListener('pointercancel', () => { grab = null; });
  // 창 크기가 바뀌면 도트 배수가 달라질 수 있다 — 겹을 버리고 다시 그린다
  let fitT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(fitT);
    fitT = setTimeout(() => { dropLayers(); houseSig = ''; if (liveCv) drawFarm(liveCv); if (tab === 'house') drawRoom($('#houseCanvas'), room); }, 160);
  });
  document.querySelectorAll('#tabs button[data-tab]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
  $('#placeBtn').addEventListener('click', togglePlace);
  $('#snapBtn').addEventListener('click', openSnap);
  $('#placeReset').addEventListener('click', () => { if (!confirm('배치를 처음으로 되돌릴까요?')) return; act(w => R.resetLayout(w)); placePick = null; dropLayers(); });
  $('#mailBtn').addEventListener('click', openMail);
  $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
boot();
