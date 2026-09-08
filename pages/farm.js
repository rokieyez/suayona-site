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
let sprk = 'sprinkler';                // 놓을 스프링클러 — 보통 것과 좋은 것
let grab = null, grabClick = false;
// 재배치 중일 때만 가구를 들거나 놓을 수 있다. 구경하다 잘못 눌러 가구가 가방으로 들어가곤 했다.
let arrange = false;
// 이 창이 「어느 날」로 열려 있는지. 자정을 넘기거나 폰에서 화면만 되살아나면
// 부팅이 다시 안 돌아서 아침이 오지 않았다 — rollIfNewDay() 가 이걸 보고 하루를 연다.
let dayOpen = '';
const now = () => Date.now();

// ---------- 저장 ----------
// 행동은 전부 act() 를 지난다. 서버가 -1(다른 아이가 먼저 씀)을 주면 새 농장 위에 같은 행동을 다시 한다.
let saveTimer = 0, saving = false, dirty = false;
function clone(o){ return JSON.parse(JSON.stringify(o)); }

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
/* 놀이 코드(가게·집 조작·도감·저장 + 심기·거두기·사기 같은 규칙)는 로그인한 사람만
   받는다 — 손님은 그림만 보므로 gzip 48KB(화면 28 + 규칙 19)를 안 받는다. 고전 스크립트라 이 파일의 최상위 let/const 를 그대로 나눠 쓴다
   (같은 전역 렉시컬 환경이다). 다만 이 파일이 먼저 다 돌아야 하므로, 저기 있는 함수는
   loadPlay() 를 기다린 뒤에만 부를 수 있다.
   ?v 는 배포가 어긋나도 새 farm.js 가 새 짝을 받게 하는 표식이다 — 짝을 고칠 때 같이 올린다. */
const PLAY_V = '3';
let playing = null;
function loadPlay(){
  if (playing) return playing;
  const one = src => new Promise((ok, no) => {
    const el = document.createElement('script');
    el.src = src + '?v=' + PLAY_V;
    el.onload = () => ok(true);
    el.onerror = () => no(new Error('놀이 코드를 못 받았어요'));
    document.head.appendChild(el);
  });
  // 규칙이 먼저, 화면이 그 뒤. 규칙 쪽이 FARM 에 till·buy… 를 얹은 다음이라야 한다.
  playing = one('/farm-rules-play.js').then(() => one('/pages/farm-play.js'));
  return playing;
}
async function boot(){
  try { await bootInner(); }
  catch (e) {
    $('#gate').hidden = false;
    $('#gateWho').textContent = '지금은 서버에 닿지 않아요. 신호가 돌아오면 다시 열어 주세요.';
    initReveal();
  }
}
/* 진짜 하늘 받아 오기 — 대한민국 서울 자양동. 열쇠 없이 좌표만 주면 되는 open-meteo 를 쓴다.
   지난 사흘과 앞으로 사흘을 함께 받는다: 지난 날은 하루가 늦게 열렸을 때, 앞날은 일기예보에 쓴다.
   신호가 없거나 4초가 넘으면 그냥 포기한다 — 그러면 규칙이 날짜로 날씨를 지어낸다. */
const SKY_KEEP = 'suayona.farm.sky';
/* 담아 둔 것의 판. 받아 오는 것이 늘면 올린다 — 안 그러면 해 시각을 넣기 전에 담긴 것이
   그날 내내 그대로 쓰여서, 새로 넣은 값만 하루 종일 비어 있다. */
const SKY_V = 2;
function skyFromCode(code, wind){
  if (code >= 95) return 'storm';                                        // 천둥
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (wind >= 28) return 'wind';                                         // 하루 최대 바람 28km/h 넘으면 바람 부는 날
  return 'sun';
}
// 담아 둔 것을 그 자리에서 읽는다(안 기다린다). 하루치는 아침에 정해지면 그대로 간다 —
// 낮에 다시 물어 날씨가 바뀌면 이미 준 물이 헛것이 된다.
function keptSky(){
  try {
    const kept = JSON.parse(localStorage.getItem(SKY_KEEP) || 'null');
    if (kept && kept.v === SKY_V && kept.day === R.dayKey(now()) && kept.map) return { map: kept.map, sun: kept.sun || {} };
  } catch (e) { /* 담아 둔 게 깨졌으면 없는 셈 친다 */ }
  return null;
}
function useSky(s){
  if (!s || !R.setSky) return false;
  R.setSky(s.map);
  if (R.setSun) R.setSun(s.sun);
  return true;
}
async function loadSky(){
  const today = R.dayKey(now());
  const kept = keptSky();
  if (kept) return kept;
  const at = R.SKY_AT || { lat: 37.5340, lng: 127.0823 };
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + at.lat + '&longitude=' + at.lng +
    '&daily=weather_code,wind_speed_10m_max,sunrise,sunset&timezone=Asia%2FSeoul&past_days=3&forecast_days=4';
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    const j = await res.json();
    const d = j && j.daily;
    if (!d || !d.time || !d.weather_code) return null;
    const map = {}, sun = {};
    // "2026-09-07T06:12" 에서 시각만 실수로 뽑는다
    const hourOf = t => { const m = /T(\d\d):(\d\d)/.exec(t || ''); return m ? Number(m[1]) + Number(m[2]) / 60 : 0; };
    d.time.forEach((day, i) => {
      map[day] = skyFromCode(d.weather_code[i], (d.wind_speed_10m_max && d.wind_speed_10m_max[i]) || 0);
      if (d.sunrise && d.sunset) sun[day] = { rise: hourOf(d.sunrise[i]), set: hourOf(d.sunset[i]) };
    });
    const got = { map: map, sun: sun };
    try { localStorage.setItem(SKY_KEEP, JSON.stringify({ v: SKY_V, day: today, map: map, sun: sun })); } catch (e) { /* 자리가 없어도 오늘 날씨는 이미 손에 있다 */ }
    return got;
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}
async function bootInner(){
  // supabase 스크립트가 안 내려온 채(전파 없음·차단) 손님 화면을 그리면 「아직 시작 전」처럼 보여서 속는다.
  if (sb.offline) throw new Error('offline');
  await refreshAuth();
  key = isChild && me && R.NAME[me.author_key] ? me.author_key : null;
  if (!key){
    /* 손님·부모 — 요약(farm_cards)과 그림거리(farm_peek)를 나란히 부른다.
       차례로 부르면 그림이 요약을 다 기다렸다 시작해서, 실제 주소에서 재 보니
       요약 470ms 가 끝난 뒤에야 그림 67ms 가 떠났다. 둘은 서로 아무 상관이 없다. */
    /* 손님 화면도 진짜 하늘을 쓴다. 안 넣으면 규칙이 날짜로 날씨를 지어내서, 맑은 날에도
       손님 화면에 비가 내렸다(2026-09-07 확인: 진짜는 맑음인데 그림은 비).
       그렇다고 그림을 붙잡지는 않는다 — 담아 둔 것은 그 자리에서 넣고(공짜), 없어서
       받아 와야 할 때는 안 기다린다. 날씨는 판마다 다시 읽으므로 늦게 와도 다음 판에 든다. */
    const sky = R.setSky ? loadSky() : null;
    useSky(keptSky());
    const [cards, peek] = await Promise.all([sb.rpc('farm_cards'), sb.rpc('farm_peek')]);
    renderGate((cards && cards.data) || {});
    renderPeekArt(peek);
    if (sky) sky.then(useSky).catch(() => { /* 못 받아 오면 규칙이 날짜로 지어낸다 */ });
    if (isAdmin){ await loadPlay(); await renderTune(); }
    $('#gate').hidden = false;
    initReveal();
    return;
  }
  /* 세이브와 모험단 기록은 서로 안 기다려도 된다 — 나란히 부른다.
     원정 씨앗은 모험단 저장에서 「지금까지 몇 개 주웠나」 한 숫자만 받는다.
     세이브 통째로(1~2KB)가 아니라 그 칸만 골라 받는다 — data->expo->seedsEver. */
  const play = loadPlay();               // 놀이 코드도 자료와 나란히 받는다 — 기다림이 겹치지 않게
  const [ok, fr, ex, skyMap] = await Promise.all([
    loadRows(),
    sb.rpc('quest_facts', { p_who: key }),
    sb.from('quest_saves').select('n:data->expo->seedsEver').eq('who', key).maybeSingle(),
    R.setSky ? loadSky() : null,          // 배포 어긋남 대비: 옛 farm-rules.js 면 그냥 건너뛴다
  ]);
  if (!ok) throw new Error('load');
  await play;                            // 여기서부터는 놀이 코드의 함수를 부른다
  // 하루를 열기 전에 넣어야 한다 — 비 온 날 밭이 젖는 것도 이 표를 보고 정해진다.
  // 아이 쪽은 여기서 기다리는 게 맞다. daily() 가 이 값을 보고 물을 준다.
  useSky(skyMap);
  facts = fr.data || {};
  expoSeedsEver = (ex && ex.data && Number(ex.data.n)) || 0;
  // 하루 시작 — 계절·동물·비·까마귀·기운·비료·선물. 전부 하루 한 번만 되게 짜여 있어서,
  // 다른 아이와 겹쳐 다시 하게 되어도 두 번 받지 않는다.
  const r = daily(W, M);
  dayOpen = R.dayKey(now());
  tickAll();
  if (r.ok){ pending.push(daily); dirty = true; persist(); }
  $('#game').hidden = false;
  $('#lead').textContent = NAME[key] + '의 농장 — ' + NAME[R.OTHER[key]] + '와 함께 가꿔요';
  $('#lead').hidden = false;
  wireUI();
  renderAll();
  initReveal();
  setInterval(() => { rollIfNewDay(); tickAll(); syncTop(); }, 30000);   // 그림은 움직이는 루프가 그린다
  startLoop($('#farmCanvas'));
}
let expoSeedsEver = 0;                 // 모험단 원정에서 지금까지 주워 온 씨앗 수
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
function renderPeekArt(res){
  const { data, error } = res || {};
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



// ---------- 도구 ----------
const TOOLS = [
  { id: 'hand', icon: '👋', name: '손',        sub: '거두기 · 줍기 · 열기' },
  { id: 'hoe',  icon: '⛏️', name: '괭이',      sub: () => '한 번에 ' + R.toolN(M, 'hoe') + '칸' },
  { id: 'can',  icon: '💧', name: '물뿌리개',  sub: () => '한 번에 ' + R.toolN(M, 'can') + '칸' },
  { id: 'seed', icon: '🌱', name: '씨앗',      sub: () => seed ? R.CROPS[seed].name : '골라요' },
  { id: 'fert', icon: '🧪', name: '비료',      sub: () => (M.inv.fert || 0) + '개' },
  { id: 'pull', icon: '🪴', name: '뽑기',      sub: '시든 것 · 그만 키우기' },
  { id: 'sprk', icon: '⛲', name: '스프링클러',
    sub: () => ((M.inv.sprinkler || 0) + (M.inv.sprinkler2 || 0)) + '개',
    when: () => (M.inv.sprinkler || 0) > 0 || (M.inv.sprinkler2 || 0) > 0 || Object.keys(W.sprinklers || {}).length > 0 },
];

// ---------- 지도 ----------
// 어디에 무엇이 있는지는 규칙(R.PLACE + world.layout)이 안다.
// 화면은 자리를 받아 그리기만 한다 — 그래야 아이들이 옮겨도 그림과 누르기가 어긋나지 않는다.
function spot(id){ return R.spotOf(W, id); }
function here(id){ return R.thingHere(W, id); }
function inSpot(id, tx, ty){ const b = spot(id); return here(id) && b && tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; }
function inBox(b, tx, ty){ return b && tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; }

// ---------- 그리기 바탕 ----------
let ctx = null;
/* ---- 외곽선 ----
   스타듀 밸리 그림이 또렷한 큰 까닭은 물건마다 어두운 테가 둘려 있어서다. 테가 없으면
   초록 잎이 초록 풀 위에 놓였을 때 서로 녹아 버린다.
   그리는 함수를 하나하나 고쳐 테를 그리는 대신, 같은 그림을 네 방향으로 한 도트씩 밀어
   어두운 색으로 먼저 찍고 그 위에 제 색으로 찍는다 — 픽셀 그림에서 쓰는 흔한 방법이고,
   px 를 지나는 그림이면 무엇이든(작물·나무·집) 함수를 안 건드리고 테가 둘린다.
   그림자와 유리처럼 비치는 색(#RRGGBBAA·rgba)은 테로 찍지 않는다 — 찍으면 검은 덩어리가 된다. */
let inkPass = null, pxOff = null;
const INK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
// 새까만 테는 만화가 된다. 물건 색보다 아주 어두운 갈색·풀색이라야 그림으로 읽힌다.
const INK = { crop: '#2c3a22', tree: '#241a12', build: '#2a2018', beast: '#2b2119' };
/* 나무와 바위는 매 프레임 그린다. 테를 두르면 다섯 번씩 그리게 되어 한 프레임이
   0.6ms 에서 3.1ms 로 늘었다. 그림이 바뀌는 조건은 계절·벤 자리인지·바람에 기운 정도
   셋뿐이라, 그걸 열쇠로 작은 캔버스에 담아 두고 다음부터는 얹기만 한다. */
const dotBuf = {};
function cachedDraw(key, x0, y0, w, h, draw){
  let c = dotBuf[key];
  if (!c){
    c = document.createElement('canvas');
    c.width = Math.ceil(w * S) + 2; c.height = Math.ceil(h * S) + 2;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const keepCtx = ctx, keepOff = pxOff;
    ctx = g; pxOff = { x: -x0, y: -y0 };
    draw();
    ctx = keepCtx; pxOff = keepOff;
    dotBuf[key] = c;
  }
  ctx.drawImage(c, Math.round(x0 * S), Math.round(y0 * S));
}
function withInk(ink, draw){
  for (let i = 0; i < INK_DIRS.length; i++){ inkPass = { c: ink, dx: INK_DIRS[i][0], dy: INK_DIRS[i][1] }; draw(); }
  inkPass = null;
  draw();
}
function pxMap(x, y, w, h, c){
  if (inkPass){
    if (typeof c !== 'string' || c.charAt(0) !== '#' || c.length > 7) return;   // 비치는 색은 테가 안 된다
    x += inkPass.dx; y += inkPass.dy; c = inkPass.c;
  }
  if (pxOff){ x += pxOff.x; y += pxOff.y; }
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
/* 네 방향 다 두른다. 예전에는 위를 빼고 0.4로 옅게 둘렀는데, 그러면 풀 위에 선 동물이
   배경에 녹는다 — 스타듀 밸리 그림이 또렷한 건 테가 사방으로 또렷하기 때문이다.
   담아 두는 그림이라 방향을 늘려도 매 프레임 값은 그대로다. */
const OUT_DIRS = [[-1, 0], [1, 0], [0, 1], [0, -1]];
function outlined(id, rows, pal, flip, s){
  const k = id + '|' + s + (flip ? '|f' : '');
  let c = spriteBuf[k];
  if (c) return c;
  const w = rows[0].length, h = rows.length;
  c = document.createElement('canvas');
  c.width = (w + 2) * s; c.height = (h + 2) * s;                 // 위아래로 한 도트씩 테가 는다
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  // 네 방향을 반투명한 색으로 그대로 겹치면 겹친 자리만 두 배로 진해지므로,
  // 먼저 불투명한 실루엣을 하나 만들고 그것을 통째로 얹는다.
  // 완전한 검정은 만화가 되고, 조금 비치는 짙은 갈색이라야 그림으로 앉는다.
  const sil = {}; for (const key in pal) sil[key] = '#241c14';
  const tmp = document.createElement('canvas'); tmp.width = c.width; tmp.height = c.height;
  const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
  for (let i = 0; i < OUT_DIRS.length; i++) drawArt(tg, rows, (1 + OUT_DIRS[i][0]) * s, (1 + OUT_DIRS[i][1]) * s, s, sil, flip);
  g.globalAlpha = 0.78; g.drawImage(tmp, 0, 0); g.globalAlpha = 1;
  drawArt(g, rows, s, s, s, pal, flip);
  spriteBuf[k] = c;
  return c;
}
// 지도 좌표(도트)로, 테두리째 붙인다. k 는 크기 배수 — 새끼는 3분의 2로 그린다.
function artOut(id, rows, mx, my, pal, flip, k){
  k = k || 1;
  ctx.drawImage(outlined(id + (k === 1 ? '' : '@' + k), rows, pal, flip, S * k), Math.round((mx - 1) * S), Math.round((my - 1) * S));
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
  // 1600 으로 막아 두면 넓은 화면(920 CSS px × dpr 2 = 1840)에서 담아 둔 그림을 늘려 그리게 되어
  // 도트 하나가 2픽셀이 됐다 3픽셀이 됐다 한다. 2048 까지 열어 두면 그 자리에서 1:1 로 떨어진다.
  if (want > 2048) want = 2048;                        // 너무 크면 겹을 담아 두는 값이 든다
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
/* SKY 표에 박혀 있는 해 뜨고 지는 시각. 표를 이 두 점에 맞춰 늘였다 줄였다 한다. */
const SUN_REF = { rise: 7.0, set: 19.0 };
/* 진짜 시각을 SKY 표의 시각으로 옮긴다. 밤 → 낮 → 밤 세 도막을 각각 늘리므로
   해 뜨는 순간과 지는 순간이 늘 표의 같은 자리(노을 빛)에 놓인다.
   시각을 못 받아 왔으면 그대로 둔다 — 지금까지처럼 일곱 시에 밝아진다. */
function skyHour(h){
  const s = R.sunOf ? R.sunOf(R.dayKey(now())) : null;
  if (!s) return h;
  if (h < s.rise) return h / s.rise * SUN_REF.rise;
  if (h < s.set) return SUN_REF.rise + (h - s.rise) / (s.set - s.rise) * (SUN_REF.set - SUN_REF.rise);
  return SUN_REF.set + (h - s.set) / (24 - s.set) * (24 - SUN_REF.set);
}
function dayLight(){
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  return lightAt(skyHour(h));
}
function lightAt(h){
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1].h <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = Math.max(0, Math.min(1, (h - a.h) / (b.h - a.h || 1)));
  const dark = a.dark + (b.dark - a.dark) * t;
  return { hour: h, dark: dark, tint: mix(a.c, b.c, t), lift: mix(a.lift, b.lift, t), lamp: dark > 0.16 };
}

// ---------- 색 ----------
// 계절마다 풀·흙·꽃 색을 여러 단계로 둔다. 단계가 많을수록 도트가 덜 밋밋하다.
/* 땅 색. 예전에는 네 단계의 밝기 폭이 255 중 30(12%)뿐이라, 도트를 아무리 잘게 뿌려도
   「초록 벽」으로 보였다 — 색이 서로 거의 같으면 결이 안 보인다. 폭을 세 배 가까이 벌리고
   가장 어두운 단계는 그늘, 가장 밝은 단계는 빛 받은 자리로 뜻을 줬다.
   ink 는 외곽선 색 — 풀포기·돌·꽃에 두르면 배경에서 떨어져 나와 물체로 읽힌다. */
const GROUND = {
  spring: { g: ['#aee0a2', '#9fd696', '#8ec98a', '#7ab97c'], tuft: ['#6fb567', '#5da05a'], ink: '#24513a',
            dry: '#cbbd8c', bloom: ['#ffb7d5', '#fff3a0', '#ffffff', '#c9a8ff', '#ff9aa2'], rock: '#c2bab0' },
  summer: { g: ['#9bd685', '#8bcb7b', '#7abd72', '#68ad68'], tuft: ['#579e54', '#468a46'], ink: '#1c4a31',
            dry: '#c8b184', bloom: ['#ffd166', '#ff9ec4', '#ffffff', '#ffe066'], rock: '#c2bab0' },
  autumn: { g: ['#ddcb87', '#d0bd7c', '#c2ad70', '#b29d64'], tuft: ['#9c8a4f', '#87763f'], ink: '#4a3822',
            dry: '#b49a6a', bloom: ['#e8874a', '#d9603c', '#f2c14e', '#c96b3a'], rock: '#bfb5a8' },
  winter: { g: ['#f7fbfc', '#ecf3f6', '#e0e9ee', '#d2dee5'], tuft: ['#c8d6dc', '#b3c3cb'], ink: '#6d8798',
            dry: '#d5dee1', bloom: ['#ffffff', '#eaf6ff'], rock: '#cdd6da' },
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
// 짧은 머리 — 연아. 첫화면 히어로(pixel.js)의 버섯 단발·가운데 가르마를 그대로 옮겼다.
const KID_SHORT = {
  down: [
    '..........kkkkkkk...........', '........kkhhhhhhhkk.........', '......kkhhhhhHhhhhhkk.......', '.....khhhHHdHHHHdHhhhk......',
    '....khhHHHHdHHHHdHHHhhk.....', '...khhhhhhhdhhhhdhhhhhhk....', '..khhhhhhhhdhhhhdhhhhhhhk...', '..khhhhhhhfdffffdhhhhhhhk...',
    '.khhhhhhfffdffffdffhhhhhhk..', '.khhhhhffffdffffdfffhhhhhk..', 'khhhhhhffffdffffdfffhhhhhhk.', 'khhhhhfffffffffffffffhhhhhk.',
    'khhhhhfffffffffffffffhhhhhk.', 'khhhhhfffewffffffewffhhhhhhk', 'khhhhhfffeeffffffeeffhhhhhhk', 'khhhhhfffeeffffffeeffhhhhhhk',
    'khhhhhfffffffffffffffhhhhhhk', 'khhhhhfppffffffffffpphhhhhhk', 'khhhhhfppfffmffmfffpphhhhhhk', 'kddddddffffffmmfffffdddddddk',
    'kdddddFFFFFFFFFFFFFFFFdddddk', '.kkkkkFnnnnnnnnnnnnnnFkkkkk.', '.....kcnnnnnnnnnnnnnnck.....', '.....kccCCCECCCCECCCcck.....',
    '.....kcccccEccccEccccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....',
    '.....kssnnCCCCCCCCnnssk.....', '.....kssnnnnnnnnnnnnssk.....', '......kkVVVVVVVVVVVVkk......', '.......kvvvvvkkvvvvvk.......',
    '.......kvvvvvkkvvvvvk.......', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  side: [
    '..........kkkkkkk...........', '........kkhhhhhhhkk.........', '......kkhhhhhHhhhhhkk.......', '.....khhhHHHHHHHHHhhhk......',
    'kkkkkhhHHHHHHHHHHHHHhhk.....', 'hhhhhhhhhhhhhhhhhhhhhhhk....', 'hhhhhhhhhhhhhhhhhhhhhhhhk...', 'hHHHhhhhhhhhhfffffffhhhhk...',
    'hHHHhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhfffffffffffhhhhk.', 'hHHHhhhhhhhfffffffffffhhhhk.',
    'hHHHhhhhhhhffffffffffffhhhk.', 'hHHHhhhhhhhfffffewfffffhhhhk', 'hHHHhhhhhhhfffffeefffffhhhhk', 'hHHHhhhhhhhfffffeefffffhhhhk',
    'hHHHhhhhhhhffffffffffFfhhhhk', 'hHHHhhhhhhhffffffffppffhhhhk', 'hhhhhhhhhhhffffffmmppfhhhhhk', 'dddddddddddfffffffffffdddddk',
    'dddddddddddFFFFFFFFFFFdddddk', 'kkkkkkknnnnnnnnnnnnnnFkkkkk.', '.....kcnnnnnnnnnnnnnnck.....', '.....kccCCCECCCCECCCcck.....',
    '.....kcccccEccccEccccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....',
    '.....kssnnCCCCCCCCnnssk.....', '.....kssnnnnnnnnnnnnssk.....', '......kkVVVVVVVVVVVVkk......', '.......kvvvvvkkvvvvvk.......',
    '.......kvvvvvkkvvvvvk.......', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  up: [
    '..........kkkkkkk...........', '........kkhhhhhhhkk.........', '......kkhhhhhHhhhhhkk.......', '.....khhhHHHHHHHHHhhhk......',
    '....khhHHHHHHHHHHHHHhhk.....', '...khhhhhhhhhhhhhhhhhhhk....', '..khhhhhhhHHHHHHHhhhhhhhk...', '..khhhhhhHHHHHHHHHhhhhhhk...',
    '.khhhhhhHHHHHHHHHHHhhhhhhk..', '.khhhhhhHHHHHHHHHHHhhhhhhk..', 'khhhhhhhHHHHHHHHHHHhhhhhhhk.', 'khhhhhhhHHHHHHHHHHHhhhhhhhk.',
    'khhhhhhhHHHHHHHHHHHhhhhhhhk.', 'khhhhhhhHHHHHHHHHHHhhhhhhhhk', 'khhhhhhhHHHHHHHHHHHhhhhhhhhk', 'khhhhhhhHHHHHHHHHHHhhhhhhhhk',
    'khhhhhhhhHHHHHHHHHhhhhhhhhhk', 'khhhhhhhhhHHHHHHHhhhhhhhhhhk', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk',
    'kddddddddddddddddddddddddddk', 'kddddddnnnnnnnnnnnnnnddddddk', '.kkkkkcnnnnnnnnnnnnnnckkkkk.', '.....kcnnnnnnnnnnnnnnck.....',
    '.....kcccccccccccccccck.....', '.....kccccCCCCCCCCcccck.....', '.....kccccCCCCCCCCcccck.....', '.....kccccCCCCCCCCcccck.....',
    '.....kssnnnnnnnnnnnnssk.....', '.....kssnnnnnnnnnnnnssk.....', '......kkVVVVVVVVVVVVkk......', '.......kvvvvvkkvvvvvk.......',
    '.......kvvvvvkkvvvvvk.......', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
};
// 긴 머리 — 수아. 히어로처럼 머리가 어깨 너머로 흘러내려 몸을 감싼다.
const KID_LONG = {
  down: [
    '........kkhhhhhhhkk.........', '......kkhhhhhhhhhhhkk.......', '.....khhhhhhhhhhhhhhhk......', '....khhhhhhhhHhhhhhhhhk.....',
    '...khhhhhHHHHHHHHHhhhhhk....', '...khhhHHHHHHHHHHHHHhhhk....', '..khhhhhhhhhhhhhhhhhhhhhk...', '.khhhhhhhhfffffffhhhhhhhhk..',
    '.khhhhhhfffffffffffhhhhhhk..', '.khhhhhfffffffffffffhhhhhk..', 'khhhhhhfffffffffffffhhhhhhk.', 'khhhhhfffffffffffffffhhhhhk.',
    'khhhhhfffffffffffffffhhhhhk.', 'khhhhhfffewffffffewffhhhhhk.', 'khhhhhfffeeffffffeeffhhhhhhk', 'khhhhhfffeeffffffeeffhhhhhhk',
    'khHHhhfffffffffffffffhhhHHhk', 'khHHhhfppffffffffffpphhhHHhk', 'khHHhhfppfffmffmfffpphhhHHhk', 'khHHhhhffffffmmfffffhhhhHHhk',
    'khHHhhFFFFFFFFFFFFFFFFhhHHhk', 'khHHhhFFFFFFFFFFFFFFFFhhHHhk', 'khHHhhEEEEEEEEEEEEEEEEhhHHhk', 'khHHhhCCCCCCCCCCCCCCCChhHHhk',
    'khHHhhcccccccccccccccchhHHhk', 'khHHhhcccccccccccccccchhHHhk', 'khHHhhCCCCCCCCCCCCCCCChhHHhk', 'khHHhhCCCCCCCCCCCCCCCChhHHhk',
    'khhhhdssccccccccccccssdhhhhk', 'khhhhkssccccccccccccsskhhhhk', 'kddddkkkVVVVVVVVVVVVkkkddddk', 'kddddk.kvvvvvkkvvvvvk.kddddk',
    '.kkkk..kvvvvvkkvvvvvk..kkkk.', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  side: [
    '........kkhhhhhhhkk.........', '......kkhhhhhhhhhhhkk.......', '.....khhhhhhhhhhhhhhhk......', '....khhhhhhhhHhhhhhhhhk.....',
    '...khhhhhHHHHHHHHHhhhhhk....', 'kkkkhhhHHHHHHHHHHHHHhhhk....', 'hhhhhhhhhhhhhhhhhhhhhhhhk...', 'hhhhhhhhhhhhhfffffffhhhhhk..',
    'hhhhhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhfffffffffffhhhhk.', 'hHHHhhhhhhhfffffffffffhhhhk.',
    'hHHHhhhhhhhffffffffffffhhhk.', 'hHHHhhhhhhhfffffewfffffhhhk.', 'hHHHhhhhhhhfffffeefffffhhhhk', 'hHHHhhhhhhhfffffeefffffhhhhk',
    'hHHHhhhhhhhffffffffffFfhHHhk', 'hHHHhhhhhhhffffffffppffhHHhk', 'hHHHhhhhhhhffffffmmppfhhHHhk', 'hHHHhhhhhhhfffffffffffhhHHhk',
    'hHHHhhhhhhhFFFFFFFFFFFhhHHhk', 'hHHHhhhhhhhFFFFFFFFFFFhhHHhk', 'hHHHhhEEEEEEEEEEEEEEEEhhHHhk', 'hHHHhhCCCCCCCCCCCCCCCChhHHhk',
    'hHHHhhcccccccccccccccchhHHhk', 'hHHHhhcccccccccccccccchhHHhk', 'hHHHhhCCCCCCCCCCCCCCCChhHHhk', 'hHHHhhCCCCCCCCCCCCCCCChhHHhk',
    'hhhhhdssccccccccccccssdhhhhk', 'hhhhhhssccccccccccccsskhhhhk', 'ddddddddVVVVVVVVVVVVkkkddddk', 'ddddddddvvvvvkkvvvvvk.kddddk',
    'kkkkkkkkvvvvvkkvvvvvk..kkkk.', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  up: [
    '........kkhhhhhhhkk.........', '......kkhhhhhhhhhhhkk.......', '.....khhhhhhhhhhhhhhhk......', '....khhhhhhhhHhhhhhhhhk.....',
    '...khhhhhHHHHHHHHHhhhhhk....', '...khhhHHHHHHHHHHHHHhhhk....', '..khhhhhhhhhhhhhhhhhhhhhk...', '.khhhhhhhhhhhhhhhhhhhhhhhk..',
    '.khhhhhhhhhhhhhhhhhhhhhhhk..', '.khhhhhhhhhhhhhhhhhhhhhhhk..', 'khhhhhhhhhhhhhhhhhhhhhhhhhk.', 'khhhhhhhhhhhhhhhhhhhhhhhhhk.',
    'khhhhhhhhhhhhhhhhhhhhhhhhhk.', 'khhhhhhhhhhhhhhhhhhhhhhhhhk.', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk',
    'khHHhhhhhhHHHHHHHhhhhhhhHHhk', 'khHHhhhhhhHHHHHHHhhhhhhhHHhk', 'khHHhhhhhHHHHHHHHHhhhhhhHHhk', 'khHHhhhhhHHHHHHHHHhhhhhhHHhk',
    'khHHhhhhhHHHHHHHHHhhhhhhHHhk', 'khHHhhhhhHHHHHHHHHhhhhhhHHhk', 'khHHhhcchHHHHHHHHHhhcchhHHhk', 'khHHhhcchHHHHHHHHHhhcchhHHhk',
    'khHHhhcchHHHHHHHHHhhcchhHHhk', 'khHHhhcchHHHHHHHHHhhcchhHHhk', 'khHHhhcchhHHHHHHHhhhcchhHHhk', 'khHHhhcchhHHHHHHHhhhcchhHHhk',
    'khhhhhsshhhhHHHhhhhhsshhhhhk', 'khhhhdsshhhhhhhhhhhhssdhhhhk', 'kdddddddVVVVVVVVVVVVdddddddk', 'kdddddddvvvvvkkvvvvvdddddddk',
    '.kkkkkkkvvvvvkkvvvvvkkkkkkk.', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
};


function kidSet(base){
  return {
    down: [base.down, walkFrame(base.down, '.......kssssk..kssssk.......', '.......kbbbbk..kbbbbk.......')],
    side: [base.side, walkFrame(base.side, '.......kssssk..kssssk.......', '.......kbbbbk..kbbbbk.......')],
    up:   [base.up,   walkFrame(base.up,   '.......kssssk..kssssk.......', '.......kbbbbk..kbbbbk.......')],
  };
}
const KIDART = { sua: kidSet(KID_LONG), yona: kidSet(KID_SHORT) };
const KID = KIDART.yona;                       // 방 그림 등에서 기본으로 쓰는 것
const KIDPAL = {
  // 메인 첫화면 캐릭터와 같은 색을 쓴다.
  // 수아 — 진갈색 긴 머리, 빨강·흰 줄무늬 상의, 남색 반바지, 주황 신발
  sua:  { k: '#3a3226', h: '#3f2d23', H: '#634a37', d: '#2b1e17', f: '#fbdcc4', F: '#eec3a2', e: '#3a3226', w: '#ffffff',
          m: '#c9333f', p: '#ffb0b8', c: '#ea2027', C: '#fdfdfd', n: '#c2151b', E: '#ffffff',
          s: '#fbdcc4', v: '#2e3a54', V: '#41506e', b: '#e8912f', B: '#c47320' },
  // 연아 — 적갈색 단발, 노란 후드(흰 끈), 남색 반바지, 주황 신발
  yona: { k: '#3a3226', h: '#a0562c', H: '#bd6c3a', d: '#77401f', f: '#fbdcc4', F: '#eec3a2', e: '#3a3226', w: '#ffffff',
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
  /* 흰오리(북경오리). 예전에는 머리가 초록인 청둥오리였다.
     머리를 몸과 다른 흰색으로 칠했더니 흰 모자를 쓴 것처럼 보여서, 머리도 몸과 같은
     흰색(b)으로 이어 붙였다 — 흰오리는 머리와 몸이 원래 한 색이고, 어디가 머리인지는
     눈과 부리가 알려 준다. 꼭대기만 순백(w)으로 빛을 받고, 턱밑 한 칸만 크림색 그늘(B).
     부리는 노랑(k)에 아랫면만 짙은 노랑(K). */
  duck: { w: 24, art: [
    '...............wwww.....', '..............wwwwwb....', '.............wwwwwwbb...', '............wwwwwwbbbb..',
    '............wwwwwbbbeek.', '............wwwwbbbbeekk', '...tt.......bwwbbbbbkkkk', '..tttt......bbwbbbbBKKK.',
    '.tbbbbbbbbbbbbbbbbbb....', 'ttbbbbbbbbbbbbbbbbbb....', 'ttbbbbbbbbbbbbbbbbbb....', '.tbbbbbbbbbbbbbbbbbb....',
    '..BBbbbbbbbbbbbbbbBB....', '...BbbbbbbbbbbbbbbB.....', '....BBBBBBBBBBBBBB......', '.....BBBBBBBBBBBB.......',
    '......ll....ll..........', '......ll....ll..........', '.....llll...lllll.......', '.....llll....llll.......',
  ], pal: { b: '#fffdf6', B: '#ded7c6', w: '#ffffff', k: '#ffd23f', K: '#dda429', e: '#26241f', l: '#ff9f2e', t: '#f6f0e6' } },
  /* 젖소. 예전 것은 흰 덩이에 검은 네모 하나, 분홍 판때기 주둥이, 다리 둘이라
     소로 안 보였다. 소답게 보이게 하는 것은 네 가지다 — **귀**, **콧구멍 있는 작은 주둥이**,
     **모양이 제각각인 얼룩**, **네 다리와 굽**. 뿔은 상아색, 귀 안쪽은 살구색으로 두어
     흰 몸에서 떨어져 나오게 했다. */
  cow: { w: 32, art: [
    '.........................k...k..', '........................kkk.kkk.', '........................kkk.kkk.', '......................hhhssshhh.',
    '.....bbbb.........EEEhhhhssshhh.', '...bbssssssbb.....EEhhhhhhsshhh.', '..bbbssssssbbbbbbbbbhhhheehhhhh.', '.bbbbbssssbbbbbbbbbbhhhheehhhhh.',
    '.bbbbbbbbbbbbbbbbbbbhhhhhhhhhhh.', '.bbbbbbbbbbbbbbbbbbbhhhhhhhhhhh.', '.bbbbbbsssssssbbbbbbhhhnnnnnnn..', '.bbbbbsssssssssbbbbb.hhnnennen..',
    '..bbbbsssssssssbbbbb..hnnnnnnn..', '..bbbbbsssssssbbbbbb...nnnnnn...', '.BBbbbbbbbbbbbbbbbbBB...........', '..BbbbbbbbbbbbbbbbbB............',
    '...BBBBBBBBBBBBBBBB.............', '....BBBBBBBBBBBBBB..............', '........uuu.....................', '........uuu.....................',
    '....ll.ll....ll.ll..............', '....ll.ll....ll.ll..............', '....LL.LL....LL.LL..............', '....LL.LL....LL.LL..............',
  ], pal: { b: '#fffaf2', B: '#ded5c6', h: '#fffaf2', s: '#2f2a22', k: '#cbb88c', e: '#3a3226',
            E: '#f2c9c2', n: '#ffb3a7', u: '#ffc4c4', l: '#ebe3d6', L: '#3a3226' } },
  /* 양. 예전 것은 얼굴이 새까맣고(서퍽종) 눈만 하얘서, 흰 털뭉치에 검은 구멍이 뚫린 것처럼
     보였다. 우리 그림책의 양은 그런 얼굴이 아니다 — 얼굴은 크림색, 눈은 까맣고 동그랗게,
     코는 분홍, 귀는 옆으로 늘어뜨리고, 이마에는 앞머리처럼 털 한 줌.
     털은 매끈한 타원이 아니라 위 가장자리를 울퉁불퉁하게 하고 곱슬 자국을 흩뿌려야
     「양털」로 읽힌다. 다리도 검은 막대에서 크림색 다리에 검은 굽으로 바꿨다. */
  sheep: { w: 28, art: [
    '............................', '...ww.www.www.ww............', '..www.wwwwww.wwwww..........', '.wwwwwwwwwwwwwwwwww.........',
    'wwWWwwwwwwwWWwwwwww.........', '.wwwwwwWwwwwwwwWWwww........', 'wwwwWWwwwwwwWwwwwwwwWfffff..', '.wwwwwwwwWWwwwwwwWwwfffffff.',
    'wwWwwwWwwwwwwWWwwwwwfffeefff', '.wwwwWWwwwwwwwwwWwwwfffeefff', 'wwwWwwwwwwWWwwwwwwwpppfffFFF', '.wwwwwwWWwwwwwWwwwwpp.ffFnnF',
    'wwWWwwwwwwwWwwwwWWwwp..FFFF.', '.wwwwwWwwwwwwWWwwww.....FFF.', '..wwwwwwwWwwwwwwwww.........', '..WWWWWWWWWWWWWWWW..........',
    '...WWWWWWWWWWWWWW...........', '....WWWWWWWWWWWW............', '....ll.ll..ll.ll............', '....ll.ll..ll.ll............',
    '....ll.ll..ll.ll............', '....ll.ll..ll.ll............', '....LL.LL..LL.LL............', '....LL.LL..LL.LL............',
  ], pal: { w: '#fdfaf5', W: '#e6ded2', f: '#f4e0c4', F: '#dcc39d', e: '#3d332a',
            n: '#e8a9a2', p: '#e8b6ad', l: '#e0cdb2', L: '#4a4038' } },
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
// 글자 씨앗을 숫자 하나로 접는다 — 결마다 자리가 달라지되 셈은 한 번뿐이다
const seedMemo = {};
function strSeed(s){
  if (seedMemo[s] !== undefined) return seedMemo[s];
  let h = 2166136261;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (seedMemo[s] = h | 0);
}
function grainy(x, y, w, h, col, kind, salt){
  x = Math.round(x); y = Math.round(y);
  if (kind === 'wood'){
    // 나뭇결은 한 도트 폭으로 — 두 도트짜리 띠는 32도트 안에서 열여섯 줄밖에 안 되어 널빤지가 아니라 줄무늬로 보였다
    const sn = strSeed(salt);
    for (let i = 0; i < w; i++){
      const v = hash2(i, 0, sn);
      if (v > 0.80) px(x + i, y, 1, h, shade(col, -13));
      else if (v > 0.72) px(x + i, y, 1, h, shade(col, -6));
      else if (v < 0.14) px(x + i, y, 1, h, shade(col, 10));
    }
  } else {
    const sn = strSeed(salt);
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++){
      const v = hash2(x + i, y + j, sn);
      if (v > 0.82) px(x + i, y + j, 1, 1, shade(col, 10));
      else if (v > 0.74) px(x + i, y + j, 1, 1, shade(col, 5));
      else if (v < 0.16) px(x + i, y + j, 1, 1, shade(col, -11));
      else if (v < 0.24) px(x + i, y + j, 1, 1, shade(col, -5));
    }
  }
}
// 얼룩을 한 겹만 쓰면 바둑판처럼 각이 진다. 성긴 겹과 촘촘한 겹을 섞으면 훨씬 자연스럽다.
function noise2b(x, y, a, b, salt){ return noise2(x, y, a, salt) * 0.62 + noise2(x, y, b, salt + '~') * 0.38; }
/* 도트 하나하나에 부르는 난수. R.prand 는 글자를 이어 붙여 셈하므로 잘게 뿌릴 때는
   한 겹 굽는 데만 수십 밀리초가 든다 — 여기서는 정수 셈만 쓴다.
   자리로만 정해지므로 결과는 늘 같고, 손님 화면과 로그인 화면이 똑같이 나온다. */
function hash2(x, y, s){
  // x 와 y 를 XOR 로 섞으면 x^y 가 대각선을 따라 같은 값이 되어, 나무 잎에 빗금 무늬가 생겼다.
  // 서로 다른 소수를 곱해 더한 다음 섞으면 그 대칭이 없어진다.
  let h = Math.imul(x | 0, 0x27d4eb2d) + Math.imul(y | 0, 0x165667b1) + Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// 칸 크기를 sc 로 묶은 얼룩. noise2 와 같은 자리에 쓰되 셈이 훨씬 싸다.
const noise2i = (x, y, sc, s) => hash2(Math.floor(x / sc), Math.floor(y / sc), s);
function drawGround(season){
  const P = GROUND[season], Wp = COLS * T, Hp = ROWS * T;
  // 1) 큰 얼룩 — 칸 경계를 넘어 이어지게. 이게 없으면 열여섯 칸짜리 바둑판이 눈에 띈다.
  px(0, 0, Wp, Hp, P.g[1]);
  // 얼룩 칸을 여덟 도트에서 네 도트로 줄였다 — 같은 넓이에 얼룩이 네 배라 「초록 벽」이 덜하다
  /* 한때 네 도트 칸에 네 단계로 잘게 나눴더니 무늬가 아니라 자글거림이 됐다 — 칸을 여덟
     도트로 되돌리고 성긴 겹에 무게를 실어 넓고 부드러운 얼룩만 남긴다.
     가장 어두운 단계(g[3])는 바닥에 안 쓴다. 그건 풀포기 몫이다. */
  for (let y = 0; y < Hp; y += 8) for (let x = 0; x < Wp; x += 8){
    const v = noise2i(x, y, 64, 11) * 0.62 + noise2i(x, y, 28, 22) * 0.26 + noise2i(x, y, 13, 33) * 0.12;
    const gi = Math.min(2, Math.floor(v * 3));
    if (gi !== 1) px(x, y, 8, 8, P.g[gi]);          // 바탕이 이미 g[1] 이라 그 칸은 건너뛴다
  }
  /* 2) 잔 알갱이 — 아주 성글게. 도트마다 뿌리면 결이 아니라 「모래」가 되어 화면이 자글거린다.
     스타듀 밸리의 잔디도 바닥은 거의 민무늬고, 눈에 드는 것은 풀포기 쪽이다. */
  for (let y = 0; y < Hp; y += 4) for (let x = 0; x < Wp; x += 4){
    const r = hash2(x, y, 55);
    if (r > 0.93) px(x, y, 2, 2, P.g[0]);
    else if (r < 0.05) px(x + 2, y + 2, 2, 2, P.g[2]);
  }
  // 3) 칸마다 풀포기·조약돌·꽃
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++){
    const X = tx * T, Y = ty * T, r0 = R.prand('g' + tx + '_' + ty);
    const n = r0 < 0.5 ? 3 : r0 < 0.85 ? 2 : 1;
    for (let i = 0; i < n; i++){
      const rr = R.prand('t' + tx + '_' + ty + '_' + i);
      const gx = X + 2 + Math.floor(rr * (T - 8)), gy = Y + 4 + Math.floor(R.prand('u' + tx + '_' + ty + '_' + i) * (T - 12));
      const c = P.tuft[i % 2];
      /* 손으로 그린 잎(테 두른 5×7 글자판)으로 바꿔 봤다가 되돌렸다 — 테 두른 잎이 칸마다
         서니 풀밭이 지저분했다. 테는 나무·작물·동물·집처럼 「하나씩 눈에 드는 것」에만 둔다. */
      px(gx, gy + 2, 2, 6, c); px(gx + 2, gy, 2, 8, shade(c, 14)); px(gx + 4, gy + 4, 2, 4, shade(c, -10));
    }
    // 조약돌 — 외곽선을 두르고 빛을 왼쪽 위에 얹으면 「회색 네모」가 아니라 돌이 된다
    if (r0 > 0.93){
      px(X + 11, Y + 17, 10, 8, P.ink);
      px(X + 12, Y + 18, 8, 5, P.rock);
      px(X + 12, Y + 18, 5, 2, shade(P.rock, 22));
      px(X + 13, Y + 21, 7, 2, shade(P.rock, -26));
    }
    const bloomP = season === 'spring' ? 0.2 : season === 'summer' ? 0.14 : season === 'autumn' ? 0.07 : 0;
    if (R.prand('f' + tx + '_' + ty) < bloomP){
      const c = P.bloom[Math.floor(R.prand('fc' + tx + '_' + ty) * P.bloom.length)];
      const fx = X + 8 + Math.floor(R.prand('fx' + tx + '_' + ty) * 14), fy = Y + 10 + Math.floor(R.prand('fy' + tx + '_' + ty) * 12);
      px(fx, fy + 4, 2, 6, P.tuft[1]); px(fx + 2, fy + 5, 1, 4, P.ink);      // 줄기와 그 그늘
      px(fx - 1, fy - 1, 4, 2, P.ink); px(fx - 3, fy + 1, 8, 2, P.ink); px(fx - 1, fy + 3, 4, 4, P.ink);
      px(fx, fy, 2, 2, c); px(fx - 2, fy + 2, 6, 2, c); px(fx, fy + 4, 2, 2, c);
      px(fx, fy + 2, 2, 2, '#fff6c0'); px(fx, fy + 2, 1, 1, '#ffffff');
    }
    if (season === 'autumn' && R.prand('l' + tx + '_' + ty) < 0.16){
      const lx = X + 6 + Math.floor(R.prand('lx' + tx + '_' + ty) * 18), ly = Y + 6 + Math.floor(R.prand('ly' + tx + '_' + ty) * 18);
      const c = ['#d9603c', '#e8874a', '#c9a227'][Math.floor(R.prand('lc' + tx + '_' + ty) * 3)];
      px(lx, ly, 4, 2, c); px(lx + 2, ly + 2, 2, 2, shade(c, -26));
    }
    if (season === 'winter' && R.prand('w' + tx + '_' + ty) < 0.25){
      px(X + 4 + Math.floor(R.prand('wx' + tx + '_' + ty) * 18), Y + 8 + Math.floor(R.prand('wy' + tx + '_' + ty) * 16), 6, 4, '#ffffff');
    }
    // 떨어진 잔가지 — 나무 밑동 색이라 풀 위에서 눈에 띈다
    if (R.prand('tw' + tx + '_' + ty) > 0.93){
      const wx = X + 6 + Math.floor(R.prand('twx' + tx + '_' + ty) * 16), wy = Y + 10 + Math.floor(R.prand('twy' + tx + '_' + ty) * 14);
      px(wx, wy, 10, 2, WOOD.dark); px(wx + 2, wy - 2, 4, 2, WOOD.dark); px(wx, wy, 6, 2, WOOD.low);
    }
  }
  /* 4) 칸을 넘는 큰 무늬 — 다녀서 흙이 드러난 자리와 클로버가 몰려 난 자리.
     칸 단위 잔무늬만 있으면 지도가 어디를 봐도 한결같아서, 넓게 보면 초록 벽처럼 보인다.
     가장자리는 잡음으로 갉아 내야 원이 아니라 자연스러운 얼룩이 된다. */
  const patch = (cx, cy, rx, ry, seed, paint) => {
    for (let y = Math.max(0, cy - ry); y < Math.min(Hp, cy + ry); y += 1)
      for (let x = Math.max(0, cx - rx); x < Math.min(Wp, cx + rx); x += 1){
        const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
        if (d < 0.5 + noise2i(x, y, 20, seed) * 0.7) paint(x, y, d);
      }
  };
  [[3.4, 6.6, 1.9, 1.2], [12.8, 3.4, 1.6, 1.0], [7.6, 14.4, 2.2, 1.1], [16.4, 12.8, 1.7, 1.3]]
    .forEach((w, i) => patch(w[0] * T, w[1] * T, w[2] * T, w[3] * T, 101 + i, (x, y, d) => {
      if (d > 0.55 && hash2(x, y, 66) > 0.45) return;          // 가장자리는 성글게 흩어진다
      const r = hash2(x, y, 77);
      if (r > 0.9925){ px(x, y, 4, 2, P.rock); px(x, y + 2, 4, 2, shade(P.rock, -22)); return; }   // 드러난 조약돌
      if (r > 0.985 && season !== 'winter'){ px(x, y, 2, 5, P.tuft[1]); px(x + 2, y - 2, 2, 7, P.tuft[0]); return; }  // 뚫고 난 풀
      px(x, y, 1, 1, r > 0.92 ? shade(P.dry, -12) : r < 0.08 ? shade(P.dry, 9) : P.dry);
    }));
  if (season !== 'winter') [[5.6, 3.0, 1.6, 1.1], [15.6, 7.8, 2.0, 1.3], [10.4, 15.0, 1.8, 1.0], [1.6, 13.4, 1.4, 1.0]]
    .forEach((w, i) => patch(w[0] * T, w[1] * T, w[2] * T, w[3] * T, 201 + i, (x, y, d) => {
      if (d > 0.5 && hash2(x, y, 88) > 0.4) return;
      const r = hash2(x, y, 99);
      if (r > 0.66) px(x, y, 1, 1, shade(P.tuft[0], r > 0.9 ? 14 : -12));   // 클로버 잎
    }));
}
// 흙길 — 집 앞에서 밭까지, 그리고 목장까지
function drawPath(season){
  const c = season === 'winter' ? ['#dcd6c8', '#cfc7b6', '#e6e0d3'] : ['#e0cfa8', '#d2bf95', '#ece0bf'];
  const edge = season === 'winter' ? '#c6bfae' : '#c2ac7e';        // 밟혀 다져진 가장자리
  const P = GROUND[season];
  /* 길은 먼저 「어느 칸을 지나는가」만 모아 두고, 그다음에 칸마다 이웃을 보고 그린다.
     전에는 칸마다 가로 띠(y+8..y+24)만 깔아서, 세로로 내려가는 길은 띠 사이가 벌어져
     토막토막 끊겨 보였다. 이웃이 있는 쪽으로 끝까지 채우면 모퉁이까지 이어진다. */
  const cells = new Set();
  const lay = (x0, y0, x1, y1) => {
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0, y = y0, guard = 0;
    while (guard++ < 200){
      cells.add(x + ',' + y);
      if (x === x1 && y === y1) break;
      if (x !== x1) x += dx; else y += dy;
    }
  };
  // 집 문에서 나와 건물 사이를 지나 아래로, 그리고 가로로 길게.
  // 건물 밑으로 지나가면 길이 끊겨 보여서 빈 칸만 골라 잇는다.
  const hs = spot('house'), row = R.FIELD.y0 + R.FIELD.h + 1;
  const way = [[hs.x + 2, hs.y + hs.h], [hs.x + 2, hs.y + hs.h + 2], [4, hs.y + hs.h + 2], [4, row], [COLS - 6, row]];
  for (let i = 1; i < way.length; i++) lay(way[i - 1][0], way[i - 1][1], way[i][0], way[i][1]);

  const has = (x, y) => cells.has(x + ',' + y);
  cells.forEach(k => {
    const [x, y] = k.split(',').map(Number), X = x * T, Y = y * T;
    const up = has(x, y - 1), dn = has(x, y + 1), lf = has(x - 1, y), rt = has(x + 1, y);
    // 이웃이 없는 쪽은 가장자리를 칸마다 조금씩 들쭉날쭉하게 — 자로 잰 띠처럼 보이지 않게
    const j = (t, a) => a + Math.round(R.prand(t + x + '_' + y) * 4);
    const x0 = lf || rt ? 0 : j('pl', 5), x1 = lf || rt ? T : T - j('pr', 5);
    const y0 = up || dn ? 0 : j('pt', 5), y1 = up || dn ? T : T - j('pb', 5);
    px(X + x0, Y + y0, x1 - x0, y1 - y0, c[0]);
    // 가장자리 — 흙과 풀이 서로 물리게 한 도트씩 섞는다. 두 도트씩 섞던 것보다
    // 이가 두 배로 촘촘해져 경계가 톱니가 아니라 부스러진 흙처럼 보인다.
    for (let i = 0; i < T; i++){
      const r = hash2(X + i, Y, 141 + (x & 7) * 8 + (y & 7));
      const d = r > 0.72 ? 2 : 1;                                  // 들쭉날쭉한 깊이
      if (!up && r > 0.42 && X + i >= X + x0 && X + i < X + x1) px(X + i, Y + y0 - d, 1, d, edge);
      if (!dn && r < 0.58 && X + i >= X + x0 && X + i < X + x1) px(X + i, Y + y1, 1, d, edge);
      if (!lf && r > 0.5 && Y + i >= Y + y0 && Y + i < Y + y1) px(X + x0 - d, Y + i, d, 1, edge);
      if (!rt && r < 0.5 && Y + i >= Y + y0 && Y + i < Y + y1) px(X + x1, Y + i, d, 1, edge);
    }
    // 수레바퀴 자국 — 지나는 방향으로 두 줄. 아래에 밝은 한 도트를 깔아 파인 홈으로 읽히게.
    if (lf || rt){ px(X, Y + 12, T, 2, c[1]); px(X, Y + 14, T, 1, c[2]); px(X, Y + 20, T, 2, c[1]); px(X, Y + 22, T, 1, c[2]); }
    if (up || dn){ px(X + 12, Y, 2, T, c[1]); px(X + 14, Y, 1, T, c[2]); px(X + 20, Y, 2, T, c[1]); px(X + 22, Y, 1, T, c[2]); }
    // 자갈과 잔 알갱이 — 수를 늘리고 크기를 줄였다
    for (let i = 0; i < 22; i++){
      const rr = R.prand('p' + x + '_' + y + '_' + i), r2 = R.prand('q' + x + '_' + y + '_' + i);
      const gx = X + x0 + Math.floor(rr * Math.max(2, x1 - x0 - 4)), gy = Y + y0 + Math.floor(r2 * Math.max(2, y1 - y0 - 2));
      if (rr > 0.94){ px(gx, gy, 4, 2, P.rock); px(gx + 1, gy, 2, 1, shade(P.rock, 16)); px(gx, gy + 2, 4, 1, shade(P.rock, -22)); }
      else if (rr > 0.6) px(gx, gy, 2, 1, c[1]);
      else px(gx, gy, 1, 1, c[rr > 0.3 ? 2 : 1]);
    }
    // 밟혀도 살아남은 풀 한 포기
    if (R.prand('pg' + x + '_' + y) > 0.7 && season !== 'winter'){
      const gx = X + x0 + 4 + Math.floor(R.prand('pgx' + x + '_' + y) * 12), gy = Y + y0 + 6 + Math.floor(R.prand('pgy' + x + '_' + y) * 10);
      px(gx, gy + 2, 2, 5, P.tuft[1]); px(gx + 2, gy, 2, 7, P.tuft[0]);
    }
  });
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
  for (let dy = 0; dy < T; dy += 2) for (let dx = 0; dx < T; dx += 2){
    const v = noise2i(X + dx, Y + dy, 14, 121) * 0.62 + noise2i(X + dx, Y + dy, 6, 122) * 0.38;
    if (v > 0.68) px(X + dx, Y + dy, 2, 2, shade(S3[0], 14));
    else if (v > 0.58) px(X + dx, Y + dy, 2, 2, shade(S3[0], 7));
    else if (v < 0.26) px(X + dx, Y + dy, 2, 2, shade(S3[0], -14));
    else if (v < 0.36) px(X + dx, Y + dy, 2, 2, shade(S3[0], -7));
  }
  // 흙알 — 성글게. 도트마다 뿌리면 흙이 아니라 소금을 뿌린 것처럼 보인다.
  for (let dy = 1; dy < T; dy += 4) for (let dx = 1; dx < T; dx += 4){
    const r = hash2(X + dx, Y + dy, 131);
    if (r > 0.88) px(X + dx, Y + dy, 1, 1, shade(S3[0], 16));
    else if (r < 0.12) px(X + dx, Y + dy, 1, 1, shade(S3[0], -16));
  }
  // 칸 위쪽 밝은 선은 통으로 그으면 칸마다 밝은 줄이 생겨 바둑판이 된다 — 흩뿌린다
  ditherRow(X, Y, T, shade(S3[0], 15), 0.6, Y);
  // 고랑 — 갈아 놓은 결. 골 밑에 그늘을 흩뿌리면 파인 자국처럼 읽힌다
  for (let i = 4; i < T - 2; i += 6){
    px(X + 2, Y + i - 1, T - 4, 1, shade(S3[0], 24));      // 이랑 마루에 얹힌 빛 — 골이 파인 게 아니라 흙이 솟은 것으로 읽힌다
    px(X + 2, Y + i, T - 4, 2, S3[2]);
    px(X + 2, Y + i + 2, T - 4, 2, S3[1]);
    ditherRow(X + 2, Y + i + 4, T - 4, shade(S3[0], -13), 0.42, Y + i);
  }
  // 흙덩이 넷 — 고른 줄무늬만 있으면 흙이 아니라 골판지로 보인다
  for (let i = 0; i < 9; i++){
    const cx = X + 3 + Math.floor(R.prand('cl' + id + i) * (T - 8)), cy = Y + 3 + Math.floor(R.prand('cm' + id + i) * (T - 8));
    px(cx, cy + 1, 3, 1, shade(S3[0], -24)); px(cx + 1, cy, 2, 1, shade(S3[0], -14)); px(cx + 1, cy, 1, 1, shade(S3[0], 16));
  }
  // 물을 준 흙에는 젖은 윤이 두 줄
  if (wet){ px(X + 5, Y + 7, 6, 1, shade(S3[0], 26)); px(X + T - 14, Y + T - 11, 7, 1, shade(S3[0], 26)); }
  // 흙 알갱이와 잔돌
  for (let i = 0; i < 14; i++){
    const rr = R.prand('s' + id + i), r2 = R.prand('z' + id + i);
    const gx = X + 2 + Math.floor(rr * (T - 6)), gy = Y + 2 + Math.floor(r2 * (T - 6));
    if (i < 2){ px(gx, gy, 4, 2, shade(S3[0], -22)); px(gx + 1, gy - 1, 2, 1, shade(S3[0], 20)); }
    else px(gx, gy, 1, 1, shade(S3[0], rr > .5 ? 19 : -17));
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
// 테를 두르는 동안에는 같은 그림을 다섯 번 그리므로 등불도 다섯 번 모인다 — 마지막 한 번만 센다
function lamp(x, y, r, c){ if (inkPass) return; lamps.push({ x, y, r, c: c || '#ffcf7a' }); }
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
  // 못머리 — 널이 이어지는 자리마다 두 점. 널이 벽지가 아니라 판자로 읽힌다.
  for (let i = 12; i < w; i += 22) for (let j = 3; j < h - 2; j += 16){
    px(X + i - 3, Y + j, 1, 1, shade(base, -34)); px(X + i + 4, Y + j, 1, 1, shade(base, -34));
  }
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
    /* 기왓장 — 네 줄이 한 단이다. 단 아래에 그늘을 깔고 다음 단 윗머리를 밝게 두면
       평평한 색띠가 아니라 겹쳐 인 장으로 읽힌다. 단마다 반 장씩 어긋나게 이음매를 둔다.
       예전에는 열여섯 도트마다 어두운 네모를 찍었는데, 줄이 맞아서 격자무늬로 보였다. */
    if (i % 4 === 3){ px(rowX, Y + i + 1, rowW, 1, shade(base, -34)); px(rowX, Y + i, rowW, 1, shade(base, 14)); }
    const off = (Math.floor(i / 4) % 2) * 7;
    for (let j = off; j < rowW; j += 14) px(rowX + j, Y + i, 1, 2, shade(base, -30));
  }
  px(X - h + 2, Y + h, w + h * 2 - 4, 4, shade(base, -36));
  px(X - h + 3, Y + h + 4, w + h * 2 - 6, 1, '#00000022');                      // 처마 밑 그늘
  px(X, Y, w, 2, shade(base, 30));
  px(X + 2, Y, w - 4, 1, shade(base, 46));                                      // 용마루
}
function window4(X, Y, w, h, on){
  px(X - 2, Y - 2, w + 4, h + 4, WOOD.dark);
  px(X - 2, Y - 2, w + 4, 1, WOOD.mid);                              // 창틀 윗면 빛
  px(X, Y, w, h, on ? '#ffd98a' : '#8fc7e0');
  px(X, Y, w, Math.max(2, h / 3), on ? '#ffeec0' : '#bfe4f7');
  // 유리에 비친 하늘 — 비스듬한 줄 하나면 유리로 읽힌다. 불이 켜지면 대신 커튼이 보인다.
  if (on){ px(X + 1, Y + 1, 3, h - 2, '#ffb9a0'); px(X + w - 4, Y + 1, 3, h - 2, '#ffb9a0'); }
  else for (let i = 0; i < h; i++) px(X + 1 + Math.round((h - i) * 0.7), Y + i, 2, 1, '#eaf6ff');
  px(X + w / 2 - 1, Y, 2, h, WOOD.dark); px(X, Y + h / 2 - 1, w, 2, WOOD.dark);
  px(X - 4, Y + h + 2, w + 8, 2, WOOD.low); px(X - 4, Y + h + 2, w + 8, 1, WOOD.hi);   // 창턱
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
  /* 여기서부터는 「집으로 보이게 하는 잔것」이다. 벽·지붕·문만 있으면 상자에 삼각형을
     얹은 것으로 보인다. 모서리 기둥·처마 그늘·문지방이 있어야 지은 집으로 읽힌다. */
  px(X + 10, Y + 32, 4, h - 56, WOOD.low); px(X + 10, Y + 32, 2, h - 56, WOOD.mid);      // 모서리 기둥 왼쪽
  px(X + w - 14, Y + 32, 4, h - 56, WOOD.low); px(X + w - 12, Y + 32, 2, h - 56, WOOD.dark);
  px(X + 10, Y + 32, w - 20, 3, '#00000018');                                            // 처마 밑 그늘
  px(X + 12, Y + h - 34, w - 24, 2, WOOD.low);                                           // 허리 띠장
  // 문지방과 발판
  px(dx - 4, Y + h - 6, 28, 6, STONE.mid); px(dx - 4, Y + h - 6, 28, 2, STONE.hi);
  px(dx + 1, Y + h - 4, 18, 3, '#b08a63'); px(dx + 3, Y + h - 4, 14, 1, '#c9a37c');
  px(dx + 2, Y + h - 50, 16, 2, WOOD.dark);                                              // 문 위 인방
  // 창 밑 꽃상자 둘
  [X + 24, X + w - 44].forEach(wx => {
    px(wx - 4, Y + 64, 28, 8, WOOD.low); px(wx - 4, Y + 64, 28, 2, WOOD.hi); px(wx - 4, Y + 70, 28, 2, WOOD.line);
    for (let i = 0; i < 24; i += 6){ px(wx - 2 + i, Y + 60, 4, 5, '#5fa155'); px(wx - 1 + i, Y + 58, 2, 3, i % 12 ? '#ff9ec4' : '#ffe066'); }
  });
  // 문 옆 등 — 밤에는 켠다. 처음엔 벽 한가운데에 큼직하게 달았더니 흰 네모 한 장으로만 보였다.
  px(dx + 27, Y + h - 60, 2, 6, WOOD.dark); px(dx + 24, Y + h - 55, 8, 2, WOOD.dark);
  px(dx + 25, Y + h - 53, 6, 7, night ? '#ffd98a' : '#cfd6da');
  px(dx + 25, Y + h - 53, 6, 1, night ? '#fff0c0' : '#e8eef0');
  px(dx + 24, Y + h - 46, 8, 2, WOOD.dark);
  if (night) lamp(dx + 28, Y + h - 50, 26);
  // 굴뚝에 벽돌 결과 갓
  px(X + w - 42, Y - 8, 18, 5, STONE.dark); px(X + w - 42, Y - 8, 18, 2, STONE.mid);
  for (let i = 0; i < 16; i += 5) px(X + w - 40 + i, Y + 0, 1, 14, STONE.dark);
  px(X + w - 40, Y + 6, 14, 1, STONE.dark);
}
function drawMail(){
  const b = spot('mail'), X = b.x * T, Y = b.y * T;
  px(X + 14, Y + 28, 4, 4, '#00000020');
  px(X + 14, Y + 12, 4, 18, WOOD.dark);
  px(X + 6, Y + 4, 20, 14, '#e0736e'); px(X + 6, Y + 4, 20, 2, '#f28f88'); px(X + 6, Y + 16, 20, 2, '#a94b4a');
  px(X + 8, Y + 8, 16, 6, '#fff1e2');
  px(X + 24, Y + 6, 4, 8, '#ffd166');
  px(X + 6, Y + 4, 2, 14, '#f7a8a2'); px(X + 6, Y + 4, 20, 1, '#ffc4bd');     // 통 왼쪽 빛과 윗면
  px(X + 14, Y + 13, 4, 18, WOOD.line);                                        // 기둥 결
  px(X + 10, Y + 28, 12, 3, '#6f9a5e');                                        // 기둥 밑 풀
  if (key && (W.mail[key] || []).length){
    px(X + 24, Y + 2, 4, 12, '#ff5a4a'); px(X + 24, Y + 2, 4, 4, '#ff8f80');
    px(X + 9, Y + 2, 14, 5, '#fff6e9'); px(X + 9, Y + 2, 14, 1, '#ffffff'); px(X + 12, Y + 4, 8, 1, '#c9b9a2');   // 삐져나온 편지
  }
}
function drawBoard(){
  const b = spot('board'), X = b.x * T, Y = b.y * T;
  px(X + 8, Y + 30, 16, 2, '#00000020');
  px(X + 8, Y + 18, 4, 14, WOOD.dark); px(X + 20, Y + 18, 4, 14, WOOD.dark);
  px(X + 4, Y + 2, 24, 20, WOOD.low); px(X + 4, Y + 2, 24, 2, WOOD.hi);
  px(X + 6, Y + 4, 20, 16, '#fff6e9');
  px(X + 8, Y + 6, 14, 2, '#8a7a63'); px(X + 8, Y + 10, 10, 2, '#8a7a63'); px(X + 8, Y + 14, 12, 2, '#8a7a63');
  px(X + 22, Y + 12, 4, 6, '#ff9ec4');
  px(X + 7, Y + 5, 10, 8, '#fffdf6'); px(X + 7, Y + 5, 10, 1, '#ffffff');      // 핀으로 꽂은 쪽지
  px(X + 9, Y + 8, 6, 1, '#8a7a63'); px(X + 9, Y + 10, 4, 1, '#8a7a63');
  px(X + 14, Y + 11, 3, 2, '#e8dcc4');                                          // 말린 귀퉁이
  px(X + 11, Y + 4, 2, 2, '#e05545'); px(X + 23, Y + 11, 2, 2, '#4a7fb5');      // 압정 둘
  px(X + 8, Y + 18, 4, 14, WOOD.line); px(X + 20, Y + 18, 4, 14, WOOD.line);    // 기둥 결
  px(X + 4, Y + 20, 24, 2, WOOD.dark);                                          // 판 밑 그늘
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
  goods.forEach((c, i) => {
    const gx = X + 14 + i * 17;
    px(gx - 2, Y + 20, 16, 12, WOOD.dark); px(gx - 1, Y + 21, 14, 2, WOOD.hi);            // 담은 광주리
    px(gx, Y + 22, 12, 10, c); px(gx, Y + 22, 12, 2, shade(c, 26)); px(gx + 8, Y + 28, 4, 4, shade(c, -28));
    px(gx + 2, Y + 23, 3, 2, shade(c, 40));                                                // 윤
    px(gx - 2, Y + 32, 16, 2, WOOD.line);
    px(gx + 3, Y + 34, 7, 4, '#fff6e9'); px(gx + 4, Y + 35, 5, 1, '#8a7a63');              // 값 쪽지
  });
  // 차양 아래 물결 자락 — 곧게 자르면 천이 아니라 판으로 보인다
  for (let i = 0; i < w - 8; i += 8){ px(X + 4 + i, Y + 18, 4, 3, '#f2857a'); px(X + 8 + i, Y + 18, 4, 2, '#fff6e9'); }
  px(X + 4, Y + 6, w - 8, 1, '#ffffff');
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
  // 물에 비친 하늘과 테두리 그늘
  px(X + 10, Y + 17, 5, 2, '#bfe4f7'); px(X + 8, Y + 20, 16, 2, '#3f7fb5');
  // 두레박과 줄, 손잡이
  px(X + 15, Y + 8, 1, 6, '#8a7a63');
  px(X + 12, Y + 12, 8, 7, WOOD.low); px(X + 12, Y + 12, 8, 2, WOOD.hi); px(X + 12, Y + 17, 8, 2, WOOD.line);
  px(X + 25, Y + 5, 4, 2, '#7d7269'); px(X + 27, Y + 5, 2, 6, '#7d7269');
  // 돌 틈의 이끼
  px(X + 5, Y + 24, 5, 3, '#6f9a5e'); px(X + 20, Y + 26, 6, 2, '#6f9a5e');
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
  // 지붕 유리를 받치는 살 — 유리 지붕은 기와와 달리 뼈대가 보여야 유리로 읽힌다
  for (let i = 0; i < w - 24; i += 20) px(X + 12 + i, Y + 8, 2, 16, '#8fc7e0');
  px(X + 6, Y + 22, w - 12, 3, '#a9d3e8'); px(X + 6, Y + 22, w - 12, 1, '#eaf6ff');
  px(X + w / 2 - 14, Y + 2, 28, 5, '#cfe6f2'); px(X + w / 2 - 14, Y + 2, 28, 1, '#ffffff');   // 용마루 환기창
  px(X + w / 2 - 12, Y + 4, 24, 1, '#8fc7e0');
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
  // 문 — 손잡이와 문틀. 들어갈 데가 없으면 유리 상자로만 보인다.
  /* 문도 유리라 안이 비쳐야 한다. 처음엔 옅은 판으로 채웠더니 선반의 화분을
     통째로 가려 유리집이 아니라 파란 문짝 하나로 보였다. 틀만 두른다. */
  const gdx = X + w / 2 - 13;
  px(gdx, Y + 30, 26, 2, '#eaf6ff'); px(gdx, Y + 32, 26, 1, '#7d9aa8');
  px(gdx, Y + 30, 2, h - 46, '#cfe6f2'); px(gdx + 24, Y + 30, 2, h - 46, '#8fc7e0');
  px(gdx + 12, Y + 30, 2, h - 46, '#8fc7e0');
  px(gdx, Y + h - 18, 26, 2, '#8fc7e0');
  px(gdx + 15, Y + h - 34, 3, 6, '#5f7d8a'); px(gdx + 8, Y + h - 34, 3, 6, '#5f7d8a');
  // 유리에 맺힌 김 — 아래쪽 모서리에 뽀얀 얼룩
  for (let i = 0; i < w - 20; i += 7) px(X + 10 + i, Y + h - 26 + (i % 3), 4, 4, '#ffffff30');
  px(X + 12, Y + 26, 3, h - 42, '#ffffff55');
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
  // 드나드는 발판 — 닭이 오르내리는 널에 미끄럼 막이 다섯
  px(X + w / 2 - 10, Y + h - 8, 20, 10, WOOD.low); px(X + w / 2 - 10, Y + h - 8, 20, 2, WOOD.hi);
  for (let i = 0; i < 10; i += 3) px(X + w / 2 - 10, Y + h - 6 + i * 0.8, 20, 1, WOOD.line);
  // 문 위 차양과 알 놓는 칸
  px(X + w / 2 - 12, Y + h - 34, 24, 3, WOOD.dark); px(X + w / 2 - 12, Y + h - 34, 24, 1, WOOD.mid);
  px(X + 8, Y + h - 22, 14, 12, WOOD.low); px(X + 8, Y + h - 22, 14, 2, WOOD.hi); px(X + 10, Y + h - 18, 10, 6, '#e0c268');
  px(X + 12, Y + h - 16, 4, 3, '#fff6e9'); px(X + 16, Y + h - 15, 3, 2, '#fff6e9');
  // 홰 — 벽에 가로지른 막대
  px(X + w - 26, Y + h - 20, 18, 2, WOOD.dark);
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
  // 큰 문에 대각 버팀목과 돌쩌귀 — 널만 세워 두면 문이 아니라 판이다
  for (let i = 0; i < 18; i++){ px(dx + 5 + i, Y + h - 43 + i * 2, 2, 2, shade(WOOD.mid, -26)); px(dx + dw - 7 - i, Y + h - 43 + i * 2, 2, 2, shade(WOOD.mid, -26)); }
  [10, 30].forEach(o => { px(dx + 3, Y + h - 46 + o, 8, 3, '#6f6a63'); px(dx + dw - 11, Y + h - 46 + o, 8, 3, '#6f6a63'); });
  px(dx + dw / 2 - 6, Y + h - 26, 5, 3, '#6f6a63'); px(dx + dw / 2 + 1, Y + h - 26, 5, 3, '#6f6a63');
  // 다락 창
  px(X + w / 2 - 8, Y + 16, 16, 14, WOOD.line); px(X + w / 2 - 6, Y + 18, 12, 10, night ? '#ffd98a' : '#4b3527');
  px(X + w / 2 - 6, Y + 24, 12, 4, '#e0c268'); px(X + w / 2 - 4, Y + 26, 3, 3, '#f2da8a');   // 다락에 쌓인 건초
  px(X + w / 2 - 10, Y + 30, 20, 3, WOOD.mid); px(X + w / 2 - 10, Y + 30, 20, 1, WOOD.hi);   // 다락 도르래 받침
  px(X + w / 2 - 1, Y + 33, 2, 5, '#6f6a63'); px(X + w / 2 - 3, Y + 38, 6, 4, WOOD.dark);
  // 지붕 꼭대기 바람개비
  px(X + w / 2 - 1, Y - 8, 2, 12, '#5a544d'); px(X + w / 2 - 7, Y - 6, 14, 2, '#5a544d');
  px(X + w / 2 + 3, Y - 10, 6, 6, '#3a3226'); px(X + w / 2 + 4, Y - 9, 4, 2, '#6f6a63');
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
  px(X + 12, Y + 26, 10, 4, '#241d17');                                   // 안쪽 어둠이 아래로 갈수록 짙다
  px(X + 6, Y + 14, 4, 5, '#fff6e9'); px(X + 6, Y + 14, 4, 1, '#ffffff'); // 이름표
  px(X + 24, Y + 25, 7, 5, '#8fb5cf'); px(X + 24, Y + 25, 7, 1, '#bfe0f0');  // 밥그릇
  px(X + 25, Y + 27, 5, 2, '#5a86a8');
  px(X + 1, Y + 27, 6, 2, '#f2ece0'); px(X + 0, Y + 26, 2, 4, '#f2ece0'); px(X + 6, Y + 26, 2, 4, '#f2ece0');  // 뼈다귀
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
  px(X + 10, Y + 28, 14, 3, WOOD.low); px(X + 10, Y + 28, 14, 1, WOOD.hi);      // 드나드는 발판
  px(X + 4, Y + 30, 4, 4, WOOD.dark); px(X + 24, Y + 30, 4, 4, WOOD.dark);      // 받침 다리
  px(X + 6, Y + 4, 20, 1, '#fff0c8');
  // 벌 셋 — 몸 두 도트에 날개 한 도트
  [[2, 2], [26, 10], [8, 0]].forEach((q, i) => {
    px(X + q[0], Y + q[1], 2, 2, '#3a2f26'); px(X + q[0], Y + q[1], 1, 1, '#ffd166');
    px(X + q[0] + (i % 2 ? -1 : 2), Y + q[1] - 1, 1, 1, '#ffffff88');
  });
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
  // 소매 끝으로 삐져나온 짚
  px(X + 2, Y + 17, 4, 2, '#e0c268'); px(X + 1, Y + 15, 3, 2, '#f2da8a'); px(X + 2, Y + 20, 3, 2, '#c9a94e');
  px(X + 26, Y + 17, 4, 2, '#e0c268'); px(X + 28, Y + 15, 3, 2, '#f2da8a'); px(X + 27, Y + 20, 3, 2, '#c9a94e');
  px(X + 13, Y + 27, 6, 3, '#e0c268'); px(X + 14, Y + 29, 4, 2, '#c9a94e');
  // 기운 자국과 단추
  px(X + 18, Y + 20, 5, 4, '#8a5cc7'); px(X + 18, Y + 20, 5, 1, '#a479dd');
  px(X + 12, Y + 19, 2, 2, '#3a3226'); px(X + 12, Y + 24, 2, 2, '#3a3226');
  // 팔에 앉은 새 — 허수아비가 무섭지 않다는 농담
  px(X + 22, Y + 9, 5, 4, '#7d9aa8'); px(X + 22, Y + 9, 5, 1, '#a8c4d4');
  px(X + 26, Y + 8, 3, 3, '#7d9aa8'); px(X + 28, Y + 9, 2, 1, '#ffb43d'); px(X + 27, Y + 8, 1, 1, '#2b2620');
  px(X + 20, Y + 10, 3, 2, '#5a7a8a');
}
// 아직 안 지은 자리 — 네 귀퉁이에 말뚝을 박고 노끈을 둘러 두었다.
// 전에는 옅은 회색 점선 상자였는데, 화면에 그늘진 네모가 떠 있는 것처럼 보였다.
function ghost(X, Y, w, h){
  for (let i = 0; i < w; i += 10) for (let j = 0; j < h; j += 10) px(X + i + 4, Y + j + 4, 4, 4, '#00000010');
  // 노끈 — 두 도트 긋고 두 도트 쉬며 두른다
  for (let i = 4; i < w - 6; i += 4){ px(X + i, Y + 5, 2, 2, '#e8dcc8'); px(X + i, Y + h - 7, 2, 2, '#e8dcc8'); }
  for (let j = 4; j < h - 6; j += 4){ px(X + 5, Y + j, 2, 2, '#e8dcc8'); px(X + w - 7, Y + j, 2, 2, '#e8dcc8'); }
  [[X + 2, Y + 2], [X + w - 8, Y + 2], [X + 2, Y + h - 12], [X + w - 8, Y + h - 12]].forEach(([sx, sy]) => {
    px(sx + 1, sy + 10, 4, 2, '#00000022');                       // 말뚝 그림자
    px(sx, sy, 4, 11, WOOD.dark); px(sx, sy, 2, 11, WOOD.mid); px(sx - 1, sy - 2, 6, 2, WOOD.hi);
  });
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
  if (d.sign){
    // 나무 팻말. 글자는 도트로 못 쓰니 하트 하나 — 「우리 농장」이라는 뜻
    const b = spot('sign'), X = b.x * T, Y = b.y * T;
    px(X + 10, Y + 28, 12, 2, '#00000022');
    px(X + 14, Y + 14, 4, 16, WOOD.dark); px(X + 14, Y + 14, 2, 16, WOOD.low);
    px(X + 4, Y + 4, 24, 12, WOOD.mid); grainy(X + 4, Y + 4, 24, 12, WOOD.mid, 'wood', 'sg');
    px(X + 4, Y + 4, 24, 2, WOOD.hi); px(X + 4, Y + 14, 24, 2, WOOD.dark);
    px(X + 4, Y + 4, 2, 12, WOOD.dark); px(X + 26, Y + 4, 2, 12, WOOD.dark);
    px(X + 12, Y + 7, 2, 2, '#e8506a'); px(X + 18, Y + 7, 2, 2, '#e8506a');
    px(X + 10, Y + 9, 12, 2, '#e8506a'); px(X + 12, Y + 11, 8, 2, '#e8506a'); px(X + 14, Y + 13, 4, 1, '#e8506a');
  }
  if (d.flowerbed){
    const b = spot('flowerbed'), X = b.x * T, Y = b.y * T, w = b.w * T;
    px(X + 4, Y + 28, w - 8, 2, '#00000022');
    px(X + 2, Y + 12, w - 4, 16, WOOD.low); grainy(X + 2, Y + 12, w - 4, 16, WOOD.low, 'wood', 'fb');   // 나무 상자
    px(X + 2, Y + 12, w - 4, 2, WOOD.hi); px(X + 2, Y + 26, w - 4, 2, WOOD.dark);
    px(X + 4, Y + 14, w - 8, 8, season === 'winter' ? '#f0f6fb' : '#6b4a32');                            // 흙 · 겨울엔 눈
    if (season !== 'winter'){
      const cs = season === 'spring' ? ['#ffb7d5', '#fff3a0', '#ffffff', '#c9a8ff', '#ff8fb0']
        : season === 'summer' ? ['#ff6b6b', '#ffd24d', '#ff9f43', '#f8f0a0', '#ff6b6b']
        : ['#e8874a', '#f2c14e', '#d9603c', '#c9a8ff', '#b5651d'];
      for (let i = 0; i < 7; i++){
        const fx = X + 5 + i * 8, up = 2 + Math.floor(R.prand('fw' + i) * 5);
        px(fx + 2, Y + 14 - up + 4, 2, up + 2, '#5f9c55');
        const c = cs[i % cs.length];
        px(fx + 2, Y + 10 - up, 2, 2, c); px(fx, Y + 12 - up, 6, 2, c); px(fx + 2, Y + 14 - up, 2, 2, c);
        px(fx + 2, Y + 12 - up, 2, 2, shade(c, 40));
      }
    } else { px(X + 8, Y + 12, 6, 3, '#ffffff'); px(X + w - 18, Y + 11, 8, 3, '#ffffff'); }
  }
  if (d.clothesline){
    // 기둥만 바탕에. 줄과 빨래는 바람에 흔들리니 움직이는 겹에서 그린다.
    const b = spot('clothesline'), X = b.x * T, Y = b.y * T, w = b.w * T;
    px(X + 4, Y + 28, 8, 2, '#00000022'); px(X + w - 12, Y + 28, 8, 2, '#00000022');
    px(X + 6, Y + 4, 4, 26, WOOD.dark); px(X + 6, Y + 4, 2, 26, WOOD.low);
    px(X + w - 10, Y + 4, 4, 26, WOOD.dark); px(X + w - 10, Y + 4, 2, 26, WOOD.low);
    px(X + 4, Y + 2, 8, 3, WOOD.mid); px(X + w - 12, Y + 2, 8, 3, WOOD.mid);
  }
  if (d.birdhouse){
    const b = spot('birdhouse'), X = b.x * T, Y = b.y * T;
    px(X + 12, Y + 28, 8, 2, '#00000022');
    px(X + 15, Y + 14, 2, 16, WOOD.dark);
    px(X + 8, Y + 6, 16, 10, '#e8b06a'); px(X + 8, Y + 6, 16, 2, '#f5cf8f'); px(X + 8, Y + 14, 16, 2, '#b8813f');
    px(X + 6, Y + 2, 20, 4, '#c94f4f'); px(X + 8, Y, 16, 2, '#c94f4f'); px(X + 6, Y + 2, 20, 1, '#e8756f');    // 지붕
    px(X + 14, Y + 8, 4, 4, '#3a2a1e'); px(X + 13, Y + 13, 6, 1, WOOD.dark);                                    // 구멍 · 횃대
  }
  if (d.flag){
    const b = spot('flag'), X = b.x * T, Y = b.y * T;
    px(X + 12, Y + 30, 8, 2, '#00000022');
    px(X + 14, Y + 2, 3, 30, '#8a8a8a'); px(X + 14, Y + 2, 1, 30, '#c4c4c4');
    px(X + 13, Y, 5, 3, '#ffd25a');
  }
  if (d.wagon){
    const b = spot('wagon'), X = b.x * T, Y = b.y * T, w = b.w * T;
    px(X + 4, Y + 28, w - 8, 2, '#00000022');
    px(X + 6, Y + 10, w - 12, 14, WOOD.mid); grainy(X + 6, Y + 10, w - 12, 14, WOOD.mid, 'wood', 'wg');   // 짐칸
    px(X + 6, Y + 10, w - 12, 2, WOOD.hi); px(X + 6, Y + 22, w - 12, 2, WOOD.dark);
    for (let i = 0; i < w - 12; i += 10) px(X + 6 + i, Y + 10, 2, 14, WOOD.dark);
    px(X + 2, Y + 16, 6, 2, WOOD.dark);                                                                    // 손잡이
    [X + 12, X + w - 18].forEach(wx => { px(wx, Y + 20, 8, 8, '#3a2a1e'); px(wx + 2, Y + 22, 4, 4, '#8a7a63'); });   // 바퀴
    if (season === 'autumn'){
      [[10, '#f28c28'], [22, '#e0761c'], [34, '#f28c28']].forEach(([ox, c]) => { px(X + ox, Y + 4, 10, 8, c); px(X + ox + 2, Y + 4, 6, 2, shade(c, 36)); px(X + ox + 4, Y + 2, 2, 2, '#5f9c55'); });
    } else if (season === 'winter'){ px(X + 8, Y + 6, w - 16, 5, '#ffffff'); px(X + 10, Y + 4, w - 20, 2, '#ffffff'); }
    else { px(X + 8, Y + 4, w - 16, 7, '#e8c46a'); px(X + 10, Y + 2, w - 20, 2, '#f2d98a'); grainy(X + 8, Y + 4, w - 16, 7, '#e8c46a', 'wood', 'hay'); }   // 건초
  }
  if (d.windmill){
    // 탑만 바탕에. 날개는 움직이는 겹에서 돈다.
    const b = spot('windmill'), X = b.x * T, Y = b.y * T, w = b.w * T, h = b.h * T;
    px(X + 12, Y + h - 6, w - 24, 4, '#00000022');
    px(X + 18, Y + 16, w - 36, h - 20, STONE.mid); grainy(X + 18, Y + 16, w - 36, h - 20, STONE.mid, 'stone', 'wm');
    px(X + 18, Y + 16, 3, h - 20, STONE.hi); px(X + w - 21, Y + 16, 3, h - 20, STONE.low);
    px(X + 14, Y + 8, w - 28, 10, '#c94f4f'); px(X + 16, Y + 4, w - 32, 4, '#c94f4f'); px(X + 14, Y + 8, w - 28, 2, '#e8756f');   // 지붕
    px(X + w / 2 - 4, Y + h - 18, 8, 14, WOOD.dark); px(X + w / 2 - 4, Y + h - 18, 8, 2, WOOD.low);                          // 문
    px(X + w / 2 - 6, Y + 22, 12, 6, WOOD.dark);                                                                              // 창
    px(X + w / 2 - 4, Y + 23, 8, 4, night ? '#ffe9a8' : '#8fd0f0');
    if (night) lamp(X + w / 2, Y + 25, 16, '#ffc46a');
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
      /* 밝은 데와 중간 사이를 흩뿌려 섞는다. 넉 도트씩 섞으면 그 띠가 줄마다 조금씩 밀려
         덩이 셋이 겹칠 때 빗금 무늬로 보였다 — 두 도트로 줄이고 성글게 흩뿌린다. */
      if (lit + 4 <= ww) ditherRow(x0 + 2 + lit, cy + r, 2, hi, 0.34, r, P);
    }
    const sh = Math.round(ww * (t - 0.45) * 0.9);
    if (sh > 2){
      px(x0 + ww - sh, cy + r, sh, 2, lo);
      if (ww - sh - 2 >= 0) ditherRow(x0 + ww - sh - 2, cy + r, 2, lo, 0.34, r, P);
    }
  }
}
/* 잎 덩이 하나 — 둥근 뭉치. 잎갓 둘레에 얹어 실루엣을 울퉁불퉁하게 만든다.
   덩이 셋만 겹치면 가장자리가 매끈해서 나무가 초록 공으로 보였다. */
function leafClump(cx, cy, r, col, hi){
  for (let dy = -r; dy <= r; dy++){
    const ww = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2);
    if (ww < 2) continue;
    px(cx - ww / 2, cy + dy, ww, 1, col);
  }
  if (hi) px(cx - r + 1, cy - r + 1, Math.max(2, r - 1), 2, hi);
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
    // 뿌리 — 밑동에서 땅으로 퍼지는 두 가닥. 나무가 땅에 꽂힌 막대처럼 안 보인다.
    px(X + 2, Y + 29, 6, 3, WOOD.dark); px(X + 2, Y + 29, 4, 1, WOOD.low);
    px(X + 24, Y + 29, 6, 3, WOOD.dark); px(X + 24, Y + 30, 4, 1, WOOD.line);
    // 껍질 결 — 짧은 세로 금 여섯
    for (let i = 0; i < 6; i++) px(X + 11 + (i % 3) * 4, Y + 7 + i * 4, 1, 3, WOOD.line);
    // 가지
    px(X + 4, Y + 8, 8, 2, WOOD.dark); px(X + 20, Y + 12, 8, 2, WOOD.dark);
    px(X + 2, Y + 6, 4, 2, WOOD.line); px(X + 26, Y + 10, 4, 2, WOOD.line);
    const L = season === 'autumn' ? ['#f0a95c', '#dd7b3f', '#b85a2c']
            : season === 'winter' ? ['#b8ccbe', '#9db4a5', '#7d9488']
            : ['#8ad07a', '#63ad57', '#417c3d'];
    const s = sway;
    /* 잎갓 — 먼저 둘레에 잎 덩이 여덟을 얹고 그 위에 큰 덩이를 덮는다.
       순서가 반대면 덩이가 잎갓 위에 뜬 동그라미로 보인다. 이렇게 두면 덩이는
       가장자리로만 삐져나와 실루엣을 울퉁불퉁하게 만든다. */
    [[-18, -18, 7], [-4, -24, 8], [12, -20, 7], [23, -7, 6],
     [-24, -4, 6], [-14, 10, 6], [3, 13, 7], [17, 8, 6]]
      .forEach(([qx, qy, r], i) => leafClump(X + 16 + qx + s, Y - 8 + qy, r, i < 4 ? L[1] : L[2], null));
    // 잎갓 — 큰 덩이 하나에 작은 덩이 둘을 겹쳐 둥글게
    blob(X + 16 + s, Y - 28, 48, 40, L[1], L[0], L[2], 't' + N.x);
    blob(X + 4 + s, Y - 18, 24, 22, L[1], L[0], L[2], 'u' + N.x);
    blob(X + 28 + s, Y - 20, 24, 24, L[1], L[0], L[2], 'v' + N.x);

    // 잎 결
    for (let i = 0; i < 9; i++){
      const rx = Math.round((R.prand('lx' + N.x + i) - 0.5) * 36), ry = Math.round(R.prand('ly' + N.x + i) * 34);
      px(X + 16 + rx + s, Y - 26 + ry, 4, 2, i % 2 ? L[2] : L[0]);
    }
    // 잎갓 아래로 처진 잎 넷 — 아래쪽 실루엣을 마저 흐트러뜨린다
    [[-20, 4], [-8, 10], [6, 11], [18, 5]].forEach((q, i) => {
      px(X + 16 + q[0] + s, Y + 2 + q[1], 5, 3, L[2]);
      px(X + 16 + q[0] + s, Y + 2 + q[1], 3, 2, i % 2 ? L[1] : L[0]);
    });
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
    // 면과 면 사이를 흩뿌려 섞는다 — 색 단이 계단처럼 끊겨 보이던 자리다
    ditherRow(X + 8, Y + 13, 16, STONE.mid, 0.5, 1); ditherRow(X + 6, Y + 19, 20, STONE.dark, 0.4, 3);
    // 금 하나와 이끼 — 돌이 회색 덩어리로만 보이지 않게
    px(X + 14, Y + 8, 1, 10, STONE.line); px(X + 15, Y + 13, 1, 6, STONE.line);
    px(X + 6, Y + 10, 6, 3, '#6f9a5e'); px(X + 6, Y + 10, 4, 1, '#8dbb78');
    px(X + 20, Y + 22, 5, 2, '#6f9a5e');
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
let walkers = null, beasts = null, dolls = null, curWind = 0.6;
/* 말풍선. 아이·인형·동물을 누르면 한마디가 머리 위에 떴다가 사라진다.
   말은 놀이 쪽(farm-play.js 의 speak)이 고르고, 여기는 자리와 그림만 맡는다.
   한 사람에 한 개 — 같은 아이를 다시 누르면 앞 말이 바뀐다. */
let bubbles = [];
const BUBBLE_INK = '#3a3226', BUBBLE_BG = '#fffaf2', BUBBLE_MAX_W = 104;   // 말풍선 폭 상한(도트)
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
  // 방에 놓인 인형이 바뀌면 다시 세운다
  const dsig = walkers.map(w => dollsOf(w.who).join('+')).join('|');
  if (!dolls || dolls.sig !== dsig){
    dolls = { sig: dsig, list: [] };
    walkers.forEach((w, wi) => dollsOf(w.who).forEach((kind, di) => {
      dolls.list.push({ kind: kind, wi: wi, di: di, x: w.x, y: w.y, flip: false, phase: Math.random() * 6, moving: false });
    }));
  }
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
  const dollSp = 26 * dt / 1000;
  if (dolls) dolls.list.forEach(d => {
    const w = walkers[d.wi]; if (!w) return;
    const back = Math.min(w.trail.length - 1, 30 + d.di * 12);      // 강아지(14)보다 뒤에서
    const q = back >= 0 ? w.trail[w.trail.length - 1 - back] : { x: w.x, y: w.y };
    const tx = q.x + (d.di % 2 ? 15 : -15), ty = q.y + 5;
    const dx = tx - d.x, dy = ty - d.y, dd = Math.sqrt(dx * dx + dy * dy);
    if (dd < 9){ d.moving = false; return; }
    d.x += dx / dd * dollSp; d.y += dy / dd * dollSp; d.moving = true; d.phase += dollSp / 5.2;
    if (Math.abs(dx) > 0.8) d.flip = dx < 0;
  });
}
function drawWalker(w, t){
  const A = KIDART[w.who] || KIDART.yona, set = A[w.dir] || A.down, f = w.moving ? (Math.floor(w.phase) % 2) : 0;
  const bob = w.moving ? 0 : (Math.sin(t / 900 + w.phase) > 0.8 ? 2 : 0);
  footShade(w.x, w.y - 2, 22);
  const fl = w.dir === 'side' ? w.flip : false;
  artOut(w.who + w.dir + f, set[f], Math.round(w.x - 14), Math.round(w.y - 38 + bob), KIDPAL[w.who], fl);
}
/* 방에 놓아 둔 인형이 농장까지 따라 나온다. 소개 페이지에 「좋아하는 것 — 레샤, 상그렐라」라고
   적혀 있는데 정작 농장에서는 방에 놓는 가구일 뿐이었다. 강아지가 아이 발자국을 따라 걷는
   코드를 그대로 쓰되, 더 뒤에서 종종 따라온다. */
const DOLLS = {
  fox: { w: 16, art: [
    '.pp..........pp.', 'pppp........pppp', 'pcpp.pppppp.ppcp', 'pcppppppppppppcp',
    '.pcppppppppppcp.', '..ppcccppcccpp..', '..pceecppceecp..', '..pceecppceecp..',
    '..pccccppccccp..', '...ccccnncccc...', '....cccnnccc....', '....pppppppp....',
    '..pppccccccppp..', '..pppccccccppp..', '..pppccccccppp..', '....pppppppp....',
    '....ppp..ppp....', '....ppp..ppp....',
  ], pal: { p: '#f0cfc9', c: '#f9f2e8', e: '#2b2622', n: '#9c5b2a' } },
  sangre: { w: 16, art: [
    '......bbbb......', '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbbb..', '.bbbbbbbbbbbbbb.', '.bbbeebbbbeebbb.', '.bbbeebbbbeesss.',
    '.bbbbbbkkbbbsss.', '.bbbbbbKKbbbsss.', '..bbbbbbbbbbsss.', '..ssssssssssss..',
    '...ssssssssss...', '.....ssssss.....', '....KK....KK....', '....KK....KK....',
  ], pal: { b: '#fff6e9', s: '#e6d9c4', e: '#3a3226', k: '#ffc94d', K: '#d9a72e' } },
};
// 그 아이가 제 방에 놓아 둔 인형들 (거실 것은 둘이 함께 쓰는 것이라 안 따라 나온다)
function dollsOf(who){
  const P = (W.house && W.house[who]) || {};
  const out = [];
  Object.keys(P).forEach(k => { const f = P[k] && P[k].f; if (DOLLS[f] && out.indexOf(f) < 0) out.push(f); });
  return out;
}
function drawDoll(d, t){
  const D = DOLLS[d.kind]; if (!D) return;
  const bob = d.moving ? (Math.floor(d.phase) % 2) : (Math.sin(t / 1000 + d.phase) > 0.75 ? 1 : 0);
  footShade(d.x, d.y - 2, D.w - 5);
  artOut('doll' + d.kind, D.art, Math.round(d.x - D.w / 2), Math.round(d.y - D.art.length + bob), D.pal, d.flip);
}
function bubbleAt(id, x, y, text, t){
  bubbles = bubbles.filter(o => o.id !== id);
  bubbles.push({ id, x, y, text, at: t, until: t + 2400 + text.length * 70 });
}
// 글을 도트 폭에 맞춰 줄로 나눈다 — 한글은 글자 사이 어디서든 끊어도 읽힌다
function bubbleLines(text, maxW){
  const out = []; let line = '';
  for (const ch of text){
    if (ctx.measureText(line + ch).width / S > maxW && line){
      const sp = line.lastIndexOf(' ');                       // 띄어쓰기가 있으면 거기서 — 「해바라기 어/때」가 안 되게
      if (sp > 0){ out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
      else { out.push(line); line = ch; }
    } else line += ch;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}
function drawBubbles(t){
  if (!bubbles.length) return;
  bubbles = bubbles.filter(o => o.until > t);
  ctx.font = 'bold ' + Math.round(8 * S) + "px 'Suayona Dot', 'Suayona Sans', system-ui, sans-serif";
  ctx.textBaseline = 'top';
  const placed = [];                                     // 나란히 선 둘의 말풍선이 겹치면 뒤 것을 위로 올린다
  bubbles.forEach(o => {
    const lines = bubbleLines(o.text, BUBBLE_MAX_W - 8);
    const lw = Math.max(...lines.map(l => ctx.measureText(l).width / S));
    const w = Math.ceil(lw) + 8, h = lines.length * 10 + 6;
    // 튀어나오는 첫 순간 조금 아래서 올라오고, 끝날 때 옅어진다
    const in_ = Math.min(1, (t - o.at) / 140), out = Math.min(1, (o.until - t) / 320);
    const x = Math.round(Math.max(2, Math.min(COLS * T - w - 2, o.x - w / 2)));
    let y = Math.round(Math.max(2, o.y - h - 5 + (1 - in_) * 3));
    placed.forEach(b => { if (x < b.x + b.w && x + w > b.x && y < b.y + b.h + 6 && y + h > b.y) y = Math.max(2, b.y - h - 3); });
    placed.push({ x, y, w, h });
    ctx.globalAlpha = Math.min(in_, out);
    px(x + 1, y, w - 2, h, BUBBLE_INK); px(x, y + 1, w, h - 2, BUBBLE_INK);           // 테(모서리 한 도트 깎음)
    px(x + 1, y + 1, w - 2, h - 2, BUBBLE_BG);
    const tx = Math.round(Math.max(x + 4, Math.min(x + w - 8, o.x - 2)));              // 꼬리는 말하는 이를 가리킨다
    px(tx - 1, y + h - 1, 6, 1, BUBBLE_BG); px(tx - 2, y + h - 1, 8, 1, BUBBLE_INK); px(tx - 1, y + h - 1, 6, 1, BUBBLE_BG);
    px(tx, y + h, 4, 2, BUBBLE_BG); px(tx - 1, y + h, 1, 2, BUBBLE_INK); px(tx + 4, y + h, 1, 2, BUBBLE_INK);
    px(tx + 1, y + h + 2, 2, 2, BUBBLE_BG); px(tx, y + h + 2, 1, 2, BUBBLE_INK); px(tx + 3, y + h + 2, 1, 2, BUBBLE_INK);
    px(tx + 1, y + h + 4, 2, 1, BUBBLE_INK);
    ctx.fillStyle = BUBBLE_INK;
    lines.forEach((l, i) => ctx.fillText(l, Math.round((x + 4) * S), Math.round((y + 4 + i * 10) * S)));
    ctx.globalAlpha = 1;
  });
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
// good 이면 좋은 스프링클러 — 놋쇠가 아니라 은빛이고, 물줄기가 여덟 갈래로 더 멀리 간다.
// 밭에서 둘을 한눈에 가려야 해서 색과 갈래 수를 둘 다 바꿨다(색만으로는 작아서 안 보인다).
function drawSprinkler(X, Y, t, good){
  const cx = X + T / 2, base = Y + T - 6;
  const INK = '#2b2620';
  const BRASS = good
    ? { a: '#c9d6e0', b: '#e8f2f8', c: '#b0c2d0', d: '#dfeaf2' }
    : { a: '#c79a4e', b: '#e8c274', c: '#b9924a', d: '#e6c274' };
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
  px(cx - 8, base - 21, 16, 3, BRASS.a);
  px(cx - 8, base - 21, 16, 1, BRASS.b);
  px(cx - 6, base - 26, 12, 5, INK);
  px(cx - 5, base - 25, 10, 4, BRASS.c);
  px(cx - 5, base - 25, 10, 1, BRASS.d);
  px(cx - 2, base - 29, 4, 4, INK);
  px(cx - 1, base - 28, 2, 3, good ? '#cfe0ec' : '#d9b463');
  // 물줄기 — 한 바퀴 도는 데 2.4초. 좋은 것은 여덟 갈래로 더 멀리 뿌린다.
  const spin = (t % 2400) / 2400 * Math.PI * 2;
  const arms = good ? 8 : 4;
  for (let i = 0; i < arms; i++){
    const a = spin + i * Math.PI * 2 / arms;
    // 앞뒤로 곧장 뻗은 줄기는 기둥에 그대로 겹쳐 지저분해진다 — 옆으로 벌어진 것만 그린다
    if (Math.abs(Math.cos(a)) < 0.36) continue;
    // 머리에서 나와 땅으로 떨어지는 길 — 멀어질수록 낮아지고, 앞뒤로도 조금 벌어진다
    for (let d = 1; d <= (good ? 5 : 4); d++){
      const r = 4 + d * (good ? 5 : 4);
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
  if (d.clothesline){
    // 줄과 빨래 셋 — 바람이 셀수록 더 크게, 빨래마다 조금씩 다르게 흔들린다
    const b = spot('clothesline'), X = b.x * T, Y = b.y * T, w = b.w * T;
    px(X + 10, Y + 6, w - 20, 1, '#6b5d4a');
    [['#ffb7d5', 10, 8], ['#5aa9e6', 8, 10], ['#ffffff', 9, 7]].forEach(([c, cw2, ch2], i) => {
      const sx = X + 12 + i * 12, a = Math.round(Math.sin(t / (520 + i * 90) + i) * (1 + curWind * 0.9));
      px(sx, Y + 7, cw2, 2, '#c9c1b0');                                        // 집게
      px(sx + a, Y + 9, cw2, ch2, c); px(sx + a, Y + 9, cw2, 2, shade(c, 28)); px(sx + a + cw2 - 2, Y + 11, 2, ch2 - 2, shade(c, -30));
    });
  }
  if (d.birdhouse){
    // 새는 가끔 온다 — 스무 초에 열두 초쯤 횃대에 앉아 있다
    const b = spot('birdhouse'), X = b.x * T, Y = b.y * T;
    const cyc = (t / 1000) % 20;
    if (cyc < 12 && L.dark < 0.5){
      const hop = Math.sin(t / 260) > 0.6 ? 1 : 0, fl = Math.sin(t / 3000) > 0;
      const bx = X + 15 + (fl ? 3 : 0), by = Y + 8 - hop;
      px(bx - 1, by + 1, 5, 3, '#5aa9e6'); px(bx + (fl ? -1 : 3), by, 3, 3, '#7dc2ea');   // 몸 · 머리
      px(bx + (fl ? -2 : 5), by + 1, 1, 1, '#ffb347');                                    // 부리
      px(bx + (fl ? 4 : -1), by + 2, 2, 2, '#4f8fc4');                                    // 꼬리
    }
  }
  if (d.flag){
    // 깃발 — 줄마다 조금씩 어긋나게 그리면 천이 흐르는 것처럼 보인다
    const b = spot('flag'), X = b.x * T, Y = b.y * T;
    const k = 0.6 + curWind * 0.5;
    for (let r = 0; r < 10; r++){
      const off = Math.round(Math.sin(t / 240 + r * 0.55) * k);
      px(X + 17 + off, Y + 3 + r, 12 - Math.floor(r / 4), 1, r < 5 ? '#ffb7d5' : '#fff3a0');
    }
  }
  if (d.windmill){
    // 날개 넷. 바람이 셀수록 빨리 돈다 — 네모 조각을 각도 따라 늘어놓아 도트 느낌을 지킨다
    const b = spot('windmill'), X = b.x * T, Y = b.y * T, w = b.w * T;
    const cx = X + w / 2, cy = Y + 14, ang = t / (2600 / (0.6 + curWind * 0.55));
    for (let i = 0; i < 4; i++){
      const a = ang + i * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
      for (let s2 = 4; s2 <= 22; s2 += 3){
        const bw = s2 > 8 ? 4 : 2;
        px(Math.round(cx + dx * s2 - bw / 2), Math.round(cy + dy * s2 - bw / 2), bw, bw, s2 > 8 ? '#f5efe0' : WOOD.dark);
        if (s2 > 8) px(Math.round(cx + dx * s2 - bw / 2), Math.round(cy + dy * s2 - bw / 2), bw, 1, WOOD.low);
      }
    }
    px(cx - 2, cy - 2, 4, 4, WOOD.dark); px(cx - 1, cy - 1, 2, 2, '#c4c4c4');
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
function dropLayers(){ Object.keys(layers).forEach(k => { layers[k].sig = null; }); Object.keys(spriteBuf).forEach(k => { delete spriteBuf[k]; }); Object.keys(furnCache).forEach(k => { delete furnCache[k]; }); Object.keys(dotBuf).forEach(k => { delete dotBuf[k]; }); }
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
    // 지은 것마다 테를 두른다. 울타리와 바닥 꾸밈은 빼고 — 넓게 깔린 것에 테를 두르면 격자가 보인다.
    withInk(INK.build, () => { drawHouse(L.lamp); drawMail(); drawBoard(); drawStall(cal); });
    withInk(INK.build, () => { drawWell(L.lamp); drawGreenhouse(L.lamp); drawCoop(L.lamp); drawBarn(L.lamp); drawPethouse(L.lamp); });
    withInk(INK.build, () => { drawHive(); drawScarecrow(); });
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
      withInk(INK.crop, () => drawCrop(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, null, sway(q.x, q.y)));
    });
    open.forEach(id => { const p = W.plots[id]; if (p && p.giant && p.pairOf && id < p.pairOf){ const q = R.parseId(id); withInk(INK.crop, () => drawGiant(id, p, sway(q.x, q.y))); } });
  });
  // 1~3 은 거의 안 바뀌니 한 장으로 합쳐 두고, 자주 바뀌는 작물만 따로 얹는다.
  // 이러면 매 프레임 전면 그림을 세 번만 얹는다 (뒤·작물·앞).
  paintShade(cw, ch);
  g.drawImage(composeBack(cw, ch, ['ground', 'shade', 'built', 'field']), 0, 0);
  g.drawImage(layers.crops.cv, 0, 0);
  // 5 살아 있는 것 — 나무까지 함께 아래에 있는 것부터. 그래야 아이가 나무 뒤로 지나간다.
  ctx = g;
  const cast = [];
  // 그림 상자는 재서 잡았다 — 칸 왼쪽 위에서 왼 -17 · 위 -39 · 오른 47 · 아래 34 안에 다 든다
  Object.keys(R.NODES).forEach(n => {
    const N = R.NODES[n];
    cast.push({ y: N.y * T + 30, go: () => {
      const sway = Math.round(Math.sin(t / 900 + N.x) * (curWind + 0.8));
      const ready = W && M ? R.nodeReady(W, M, n, now()) : true;
      cachedDraw(n + '|' + season + '|' + (ready ? 1 : 0) + '|' + sway, N.x * T - 22, N.y * T - 44, 74, 84,
        () => withInk(INK.tree, () => drawNode(n, season, t)));
    } });
  });
  Object.keys(W.sprinklers || {}).forEach(id => {
    const q = R.parseId(id), good = (W.sprinklers[id] || {}).k === 'good';
    cast.push({ y: q.y * T + 30, go: () => drawSprinkler(q.x * T, q.y * T, t, good) });
  });
  if (R.peddlerHere(W, now())) cast.push({ y: R.PEDDLER.y * T + 30, go: () => drawPeddler(t) });
  if (walkers) walkers.forEach(w => cast.push({ y: w.y, go: () => drawWalker(w, t) }));
  if (beasts) beasts.list.forEach(a => cast.push({ y: a.y, go: () => drawBeast(a, t) }));
  if (dolls) dolls.list.forEach(d => cast.push({ y: d.y, go: () => drawDoll(d, t) }));
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
  drawBubbles(t);
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
// 누른 자리를 도트 좌표로 — 칸이 아니라 그림 위 어디를 눌렀는지 봐야 할 때(캐릭터)
function pixAt(clientX, clientY){
  const cv = liveCv || $('#farmCanvas'), r = cv.getBoundingClientRect();
  const w = r.width || cv.width, h = r.height || cv.height;
  return { x: (clientX - r.left) / w * cv.width / S, y: (clientY - r.top) / h * cv.height / S };
}
function plotAtTile(tx, ty){
  const F = R.FIELD;
  if (tx < F.x0 || ty < F.y0 || tx >= F.x0 + F.w || ty >= F.y0 + F.h) return null;
  return tx + ',' + ty;
}
function nodeAt(tx, ty){ return Object.keys(R.NODES).find(n => R.NODES[n].x === tx && R.NODES[n].y === ty) || null; }
function built(id){ return !!(W.buildings[id] && W.buildings[id].done); }
/* ---------- 끌어서 이어 하기 ----------
   스타듀밸리처럼 누른 채 밭 위를 지나가면 지나간 칸마다 이어서 한다. 톡 누르는 것은
   예전 그대로다 — 끌지 않았으면 아무것도 안 하고 click 이 하던 일을 그대로 한다.
   끌 때는 도구가 세 칸·아홉 칸짜리라도 한 칸씩만 한다. 아홉 칸짜리로 끌면 기운이
   순식간에 바닥나고, 지나가지도 않은 칸이 갈려서 「내가 뭘 한 건지」를 못 읽는다.
   폰에서는 가로로 끌어야 한다(#farmCanvas 의 touch-action:pan-y) — 세로로 끄는 것은
   화면을 내리는 손짓으로 남겨 뒀다. 밭 한 줄은 어차피 가로다. */
const SWEEP_TOOLS = { hoe: 1, can: 1, seed: 1, fert: 1, hand: 1 };
const SWEEP_MSG = { hoe: '땅을 갈았어요', can: '물을 줬어요', seed: '씨앗을 심었어요',
                    fert: '비료를 줬어요', hand: '거뒀어요' };
let sweep = null, sweepClick = false, sweepSfxAt = 0;



/* 행상인 창. 세 자리는 날짜로 정해지므로 둘이 같은 물건을 본다.
   하나씩 각자 한 번만 살 수 있다 — 한 사람이 싹쓸이하면 다른 하나가 서운하다. */

// ---------- 탭 ----------
/* 지도에서 집·가게·닭장을 누르면 그에 맞는 판이 열리지만, 판은 지도 한참 아래에 있어
   아이는 아무 일도 안 일어난 줄 안다. 지도에서 온 것이면 그 판까지 데려간다.
   탭 단추로 온 것이면 이미 그 자리이므로 화면을 흔들지 않는다. */
/* 탭 줄이 화면 맨 위에 오도록 내린다. 머리글은 붙박이라 그만큼 빼 두지 않으면 첫 줄을 덮는다.
   「움직임 줄이기」를 켠 사람에게는 미끄러뜨리지 않고 한 번에 옮긴다. */

/* 가게에서 가구를 고를 때는 색 네모 말고 실제 그림을 보여 준다. 도트 배수를 1로
   낮춰 그린 뒤 그대로 붙인다 — 카드 폭 안에 대개 제 크기로 들어간다. */


const SHOP_TABS = [['seed', '🌱 씨앗'], ['tool', '🔧 도구·밭·재료'], ['animal', '🐔 동물'], ['furn', '🛋️ 가구'], ['deco', '🌼 꾸미기'], ['recipe', '📜 요리법']];

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
  // 거실 커튼은 나무색(#c98f63)이었다 — 창틀·기둥과 같은 색이라 천이 아니라 덧문으로 보였다.
  return { wall: '#fff1da', wall2: '#f6e2c1', trim: '#d9b784', rail: '#c9a26d', motif: 'stripe', dot: '#e8c98a', cur: '#9db98f',
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
let litLayer = null;                   // 밤에 불 켜진 부분만 모으는 겹 — 방 크기대로 다시 쓴다
// 벽을 나눈 자리 — 벽 꼭대기에서 내려온 거리(도트)
const W_MOULD = 6, W_RAIL = 66, W_WAIN = 70, W_BASE = 98;
const WALL_KINDS = { frame: 1, poster: 1, clock: 1, mirror: 1, window: 1, stars: 1, mypic: 1,
                     board: 1, garland: 1, wshelf: 1, rainbow: 1,
                     heightbar: 1, worldmap: 1, mobile: 1, wreath: 1,
                     whale: 1, wlight: 1, medalcase: 1 };
/* 옛 세이브에만 남은 규칙 — 벽에 거는 것을 바닥 칸에 두고 어느 벽인지 어림하던 방법.
   지금은 벽 격자('w,벽,칸,단')에 걸므로, fixWorld 가 아직 못 옮긴 것만 이 길로 그린다. */
function wallSlot(Rm, x, y){
  return (y <= x) ? { side: 1, at: x, len: Rm.w } : { side: -1, at: y, len: Rm.h };
}
/* 규칙 파일이 아직 옛것일 수 있다 — 두 파일 다 max-age=600 이라 배포 직후 십 분쯤은
   한쪽만 새것일 수 있다. 그동안에는 벽 격자가 없는 것처럼 굴러가게 둔다(옛 그림 자리 그대로). */
// 손님도 방을 보므로 손님 몫 규칙에 있는 이름만 본다 — hang 은 놀이 쪽에 있어 여기서 보면 안 된다
const HAS_WALLGRID = () => !!(R.parseWall && R.wallCols && R.hungCol);
const WALL_PITCH = () => R.WALL_PITCH || 44;
const WALL_DROP = 12;              // 아래 단은 열두 도트 내려 건다
const WALL_ROW_SPLIT = 34;         // 벽을 누른 자리가 이보다 아래면 아래 단
// 벽 한 면의 가로 길이(도트)와, 격자 칸 하나의 왼쪽 끝
function wallLenOf(Rm, side){ return (side ? Rm.w : Rm.h) * (TW / 2); }
/* 이 농장에서 방이 지금 몇 칸인가. 넓히기 전에는 R.ROOMS 를 곧바로 읽었는데,
   이제 넓힌 몫이 world 에 있으므로 크기를 묻는 자리는 전부 여기를 지난다.
   (배포 어긋남 대비: 옛 farm-rules.js 면 처음 크기를 그대로 쓴다) */
const RM = r => (R.roomBox ? R.roomBox(W, r) : R.ROOMS[r]);
// 벽 칸 수도 마찬가지 — 새 규칙은 world 를 먼저 받는다
function wallColsOf(r, side){ return R.roomBox ? R.wallCols(W, r, side) : R.wallCols(r, side); }
function wallU(len, cols, col){
  const pitch = WALL_PITCH();
  const pad = Math.max(0, Math.floor((len - cols * pitch) / 2 / 2) * 2);
  return pad + col * pitch;
}
/* 벽면을 도트로 칠하는 붓. u 는 벽을 따라 간 거리(짝수), v 는 벽 꼭대기에서 내려온 거리.
   비스듬한 벽이 2도트마다 1도트씩 내려간다. side 1=오른쪽 벽, 0=왼쪽 벽. */
function wallPaint(g, Rm, side){
  const ox = isoOx(Rm), q = dotFill(g);
  return (u, v, uw, vh, c) => {
    const u0 = Math.floor(u / 2) * 2;
    for (let i = 0; i < uw; i += 2){
      const uu = u0 + i;
      if (uu < 0) continue;
      if (side) q(ox + uu, uu / 2 + v, 2, vh, c);
      else q(ox - uu - 2, (uu + 2) / 2 + v, 2, vh, c);
    }
  };
}
/* 그 칸이 붙박이 창(오른쪽 벽)이나 거실 문(왼쪽 벽)을 가리나.
   막지는 않는다 — 아이가 자리를 보고 고르는 것이고, 언제든 옮길 수 있다. 알려만 준다. */
function wallCovers(rm, side, col){
  const Rm = RM(rm), len = wallLenOf(Rm, side);
  const u = wallU(len, wallColsOf(rm, side), col);
  if (side){
    const wu = Math.max(6, Math.floor((len / 2 - 30) / 2) * 2);
    return u + 40 > wu - 18 && u < wu + 78;
  }
  if (rm === 'living'){
    const du = Math.max(6, Math.floor((len - 44) / 2 / 2) * 2);
    return u + 40 > du - 2 && u < du + 42;
  }
  return false;
}
/* 벽에 거는 것. 가로 40 · 세로 6~58 안에 그린다 — 전에는 32×40 이라 그림이 굵었다.
   벽이 2도트마다 한 도트씩 내려가므로 가로 자리와 폭은 늘 짝수로 잡는다.
   세로는 1도트까지 쓸 수 있어서, 테와 매트와 반사는 거기서 벌어 온다. */
/* 훈장 걸이에 걸 훈장 — 그 방 주인의 것. 거실은 둘의 것을 합친다.
   자매의 줄(other)도 이미 읽어 두었으므로 둘 다 그릴 수 있다. 손님 화면에서는 빈 걸이가 된다. */
function medalsOf(room){
  const mine = (M && M.medals) || [], oth = (other && other.medals) || [];
  if (room === 'living') return Array.from(new Set(mine.concat(oth)));
  if (key && room === R.OTHER[key]) return oth;
  return mine;
}
/* 그림 일기(pages/board.js)에 그린 도트 그림을 액자에 담는다. 색표의 정본은 pixel.js 의
   DRAW_PALETTE 이고, 일기장이 그 값을 한 벌 베껴 두었다. 농장도 pixel.js 를 안 싣기 때문에
   여기 또 한 벌 둔다 — 색을 고칠 때는 세 곳(pixel.js · board.js · 여기)을 같이 고친다. */
const PAD_PALETTE = [
  '#2f2a24', '#6f6558', '#a2988a', '#ffffff',
  '#ff7f8a', '#ff9aa2', '#ffb7d5', '#c0392b',
  '#e8912f', '#ffd979', '#fff3a0', '#f7b733',
  '#6cc7b3', '#8fd9c8', '#6fb567', '#3f7d3c',
  '#8ec9ee', '#5aa9e6', '#2e3a54', '#b9a3d6',
  '#c79b6d', '#8a5f3a', '#fbdcc4', '#ffe0c4',
];
const PAD_BG = '#fffaf2', PAD_EMPTY = -1;
// 가게 카드에는 아직 담긴 그림이 없다 — 대신 본보기 하나를 넣어 둔다(해·집·풀밭)
const PAD_SAMPLE = '.................999.............999.............999...................................................777............77777..........7777777..........lllll...........l3l3l...........lllll...........ll0ll...........ll0ll.....eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
/* 한 변이 16·24·32 인 그림을 다 받는다 — 일기의 그림판은 16칸이고 도트 그리기는
   셋 중에 고른다. 담는 방식은 같아서 길이만 보고 한 변을 알아낸다. */
function padDecode(str){
  const n = R.picSide ? R.picSide(str) : (str && str.length === 256 ? 16 : 0);
  if (!n) return null;
  const cells = Array.from(str).map(ch => {
    if (ch === '.') return PAD_EMPTY;
    const v = parseInt(ch, 36);
    return (v >= 0 && v < PAD_PALETTE.length) ? v : PAD_EMPTY;
  });
  cells.n = n;
  return cells;
}
function paintWallItem(wall, u, f, P, room, pic){
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
    case 'mypic': {                                                  // 내 그림 액자 — 일기에 그린 그림이 들어간다
      const cells = padDecode(pic) || padDecode(PAD_SAMPLE);
      /* 종이는 32도트다. 16칸이면 한 칸이 두 도트로 꽉 차고, 24·32칸이면 한 도트씩
         놓고 가운데에 앉힌다 — 32를 24로 나누면 칸마다 폭이 달라져 그림이 일그러진다. */
      const cn = cells.n, cpx = cn === 16 ? 2 : 1, cw = cn * cpx, co = Math.round((32 - cw) / 2);
      hang(20, 3, 9);
      w(1, 8, 38, 40, '#5a3c26');                                    // 바깥 테
      w(1, 8, 38, 2, '#a97b4f'); w(1, 46, 38, 2, '#3f2a1a');
      w(1, 8, 2, 40, '#8a5f3a'); w(37, 8, 2, 40, '#3f2a1a');
      w(3, 10, 34, 36, c);                                           // 안쪽 테
      w(3, 10, 34, 2, shade(c, 18)); w(3, 44, 34, 2, shade(c, -18));
      w(4, 12, 32, 32, PAD_BG);                                      // 그림 종이 — 한 칸이 두 도트다
      for (let i = 0; i < cells.length; i++){
        if (cells[i] === PAD_EMPTY) continue;
        w(4 + co + (i % cn) * cpx, 12 + co + Math.floor(i / cn) * cpx, cpx, cpx, PAD_PALETTE[cells[i]] || PAD_BG);
      }
      for (let i = 0; i < 10; i += 2) w(4 + i, 12 + i, 2, 4, 'rgba(255,255,255,0.20)');    // 유리 반사
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
    case 'medalcase': {                                               // 훈장 걸이 — 받은 훈장이 하나씩 채워진다
      const got = medalsOf(room);
      hang(20, 3, 9);
      w(4, 6, 32, 46, '#4a3524');                                     // 바깥 테
      w(4, 6, 32, 2, '#6f4e33');
      w(6, 8, 28, 42, '#3f3a52');                                     // 안쪽 융 (y 8~50)
      w(6, 8, 28, 1, '#524b68');
      /* 훈장 열둘을 4×3 으로. 지름을 6으로 잡았더니 옆것과 딱 붙어 한 줄 막대로 보였다 —
         4로 줄이고 자리는 6칸씩 띄워 사이에 두 도트가 남게 했다. */
      R.MEDALS.forEach((Md, i) => {
        const cx = 8 + (i % 4) * 6, cy = 11 + Math.floor(i / 4) * 13;
        if (got.indexOf(Md.id) < 0){ w(cx + 1, cy + 2, 2, 2, '#2e2a3c'); return; }   // 아직 못 받은 자리 — 빈 못
        w(cx + 1, cy, 2, 1, shade(Md.col, -34));
        w(cx, cy + 1, 4, 4, Md.col);
        w(cx, cy + 1, 4, 1, shade(Md.col, 26));
        w(cx + 1, cy + 5, 2, 1, shade(Md.col, -34));
        w(cx, cy + 6, 2, 3, '#c9333f'); w(cx + 2, cy + 6, 2, 3, '#e0736e');          // 리본
      });
      // 받은 수를 밑에 눈금으로 — 글자를 못 쓰니 칸으로 센다
      for (let i = 0; i < R.MEDALS.length; i++){
        w(6 + i * 2, 47, 2, 1, i < got.length ? '#ffd25a' : '#2e2a3c');
      }
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
  const Rm = RM(r), P = roomPal(r);
  const A = roomArt(Rm), ox = isoOx(Rm);
  const LW = Rm.w * (TW / 2), LH = Rm.h * (TW / 2);          // 두 벽의 가로 길이
  const q = dotFill(g);
  /* 벽면 좌표를 화면으로 옮긴다. u 는 벽을 따라 간 거리(가로 도트, 짝수),
     v 는 벽 꼭대기에서 내려온 거리. 비스듬한 벽이 2도트마다 1도트씩 내려간다. */
  const wallR = wallPaint(g, Rm, 1), wallL = wallPaint(g, Rm, 0);
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
    /* 도배지 이음매 — 마흔여덟 도트마다 한 폭. 벽지가 한 장의 큰 무늬가 아니라
       여러 폭을 이어 바른 것으로 읽힌다. 아주 옅게 — 눈에 띄면 줄무늬가 된다. */
    for (let u = 48; u < len; u += 48){
      wall(u - 2, W_MOULD, 2, W_RAIL - W_MOULD, 'rgba(24,16,8,0.05)');
      wall(u, W_MOULD, 2, W_RAIL - W_MOULD, 'rgba(255,255,255,0.05)');
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
  /* 두 벽이 만나는 모서리 — 빛이 덜 드는 자리다. 안 넣으면 두 색면이 선 하나로
     딱 갈려서 종이를 접어 세운 것처럼 보인다. 모서리에서 멀어질수록 옅어진다. */
  for (let i = 0; i < 26; i += 2){
    const a = (0.16 * (1 - i / 26)).toFixed(3);
    wallR(i, 0, 2, WALLH, 'rgba(26,18,10,' + a + ')');
    wallL(i, 0, 2, WALLH, 'rgba(26,18,10,' + a + ')');
  }
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
  /* 창밖 — 하늘과 들판만 있으면 색종이 두 장이다. 먼 언덕 둘과 나무 하나, 새 두 마리를
     넣으면 「밖」이 된다. 먼 것일수록 옅게(공기원근법). */
  for (let i = 0; i < 22; i += 2){
    const hgt = Math.round(5 - Math.abs(i - 10) * 0.35);
    if (hgt > 0) wallR(wu + 4 + i, wv + wh - 12 - hgt, 2, hgt, '#a8c8a0');
  }
  for (let i = 0; i < 26; i += 2){
    const hgt = Math.round(7 - Math.abs(i - 12) * 0.42);
    if (hgt > 0) wallR(wu + 28 + i, wv + wh - 12 - hgt, 2, hgt, '#8fb98a');
  }
  wallR(wu + 14, wv + wh - 18, 2, 6, '#7a5230');                                // 먼 나무
  wallR(wu + 10, wv + wh - 24, 10, 7, '#6fa869'); wallR(wu + 12, wv + wh - 24, 6, 2, '#8cc487');
  [[44, 10], [50, 13]].forEach(([bx, by]) => {                                  // 새 두 마리
    wallR(wu + bx, wv + by, 2, 1, '#6f7a86'); wallR(wu + bx + 2, wv + by - 1, 2, 1, '#6f7a86');
  });
  // 유리에 비스듬히 비치는 빛 — 창이 유리라는 걸 알려 주는 가장 싼 표시
  for (let i = 0; i < 10; i += 2) wallR(wu + 6 + i, wv + 4 + i, 2, 10, 'rgba(255,255,255,0.30)');
  for (let i = 0; i < 6; i += 2) wallR(wu + 16 + i, wv + 4 + i, 2, 8, 'rgba(255,255,255,0.22)');
  wallR(wu + Math.floor(ww / 4) * 2 - 2, wv, 4, wh, '#c79b6d'); wallR(wu, wv + 18, ww, 4, '#c79b6d');
  wallR(wu - 8, wv + wh + 4, ww + 16, 4, '#a97b4f'); wallR(wu - 8, wv + wh + 4, ww + 16, 2, '#d6a878');
  /* 커튼 — 전에는 색 띠에 가로줄만 그어서 널판처럼 보였다.
     세로 주름(밝고 어두운 골이 번갈아), 묶어 둔 자리에서 좁아지는 허리, 물결진 아랫단,
     그리고 위를 가리는 주름 가리개까지 넣어야 천으로 읽힌다. */
  [wu - 16, wu + ww + 2].forEach((cx, i) => {
    const top = wv - 8, hgt = wh + 18, tie = top + Math.round(hgt * 0.55);
    for (let u = 0; u < 14; u += 2){
      // 묶은 자리에서 안쪽으로 오므라든다
      const fold = (u / 2 + (i ? 1 : 0)) % 3;
      const c2 = fold === 0 ? shade(P.cur, 22) : fold === 1 ? P.cur : shade(P.cur, -24);
      for (let v = top; v < top + hgt; v++){
        const pinch = Math.abs(v - tie) < 8 ? (i ? 1 : -1) * (8 - Math.abs(v - tie)) / 4 : 0;
        const hem = v > top + hgt - 6 ? Math.round(Math.sin((u + v) * 0.9) * 2) : 0;   // 물결진 아랫단
        if (v > top + hgt - 6 + hem) continue;
        wallR(cx + u + Math.round(pinch), v, 2, 1, c2);
      }
    }
    wallR(cx + (i ? 0 : 2), tie - 2, 12, 4, shade(P.cur, -34));                        // 묶은 띠
    wallR(cx + (i ? 0 : 2), tie - 2, 12, 1, shade(P.cur, 12));
  });
  wallR(wu - 20, wv - 12, ww + 40, 4, '#8a6a4a');                                      // 커튼봉
  for (let u = 0; u < ww + 40; u += 6){                                                // 봉에 걸린 주름 가리개
    wallR(wu - 20 + u, wv - 8, 4, 5, P.cur);
    wallR(wu - 20 + u, wv - 8, 2, 5, shade(P.cur, 20));
    wallR(wu - 20 + u + 2, wv - 3, 2, 2, shade(P.cur, -26));
  }
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
  /* 벽에 건 가구 — 이제 벽 격자('w,벽,칸,단')에 건다. 예전에는 바닥 칸에 걸어 두고
     그 칸에서 벽자리를 어림했다(그래서 훈장 걸이를 억지로 왼쪽 벽에 붙여 두는 예외가
     있었다). 아이가 자리를 골라 거니 그 예외는 없앴다. */
  (wallItems || []).forEach(it => {
    const wl = it.side ? wallR : wallL, len = it.side ? LW : LH;
    const u = it.col == null
      ? Math.min(Math.max(0, it.at * (TW / 2) - 8), len - 42)          // 아직 안 옮겨진 옛 세이브
      : wallU(len, wallColsOf(r, it.side), it.col);
    const dv = it.row ? WALL_DROP : 0;
    // 벽에서 살짝 떠 있게 — 그림자를 한 벌 먼저 깐다. 안 그러면 벽지에 인쇄된 것처럼 보인다
    paintWallItem((uu, v, uw, vh) => wl(uu + 2, v + dv + 3, uw, vh, 'rgba(26,18,10,0.16)'), u, it.f, P, r, it.pic);
    paintWallItem((uu, v, uw, vh, c) => wl(uu, v + dv, uw, vh, c), u, it.f, P, r, it.pic);
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
      // 옹이 — 널 하나에 어쩌다 하나. 결만 있으면 마루가 줄무늬 천처럼 보인다
      if (v > 0.985){
        const ky = y + 3;
        if (ky >= t0 && ky + 1 < t1){
          q(cx, ky, 2, 2, shade(col, -34)); q(cx - 2, ky, 2, 1, shade(col, -20)); q(cx + 2, ky + 1, 2, 1, shade(col, -20));
        }
      }
    }
  }
  // 널 이음매 — 왼쪽아래로 흐르는 짧은 금. 줄마다 어긋나게 둔다.
  const inFloor = (x, y) => {
    const a = (x - ox) / TW, b = (y - WALLH) / TH, tx = b + a, ty = b - a;
    return tx >= 0 && ty >= 0 && tx < Rm.w && ty < Rm.h;
  };
  /* 벽 밑 그늘 — 걸레받이가 바닥에 닿는 자리. 빛이 안 드는 좁은 띠 하나면 벽과 바닥이
     맞물려 보인다. 없으면 바닥이 벽 뒤로 그냥 이어진 것처럼 떠 보였다. */
  for (let i = 0; i < 10; i += 2){
    const a = (0.14 * (1 - i / 10)).toFixed(3), c2 = 'rgba(26,18,10,' + a + ')';
    for (let u = 0; u < LW; u += 2){ const y2 = WALLH + u / 2 + i; if (inFloor(ox + u + 1, y2 + 1)) q(ox + u, y2, 2, 2, c2); }
    for (let u = 0; u < LH; u += 2){ const y2 = WALLH + (u + 2) / 2 + i; if (inFloor(ox - u - 1, y2 + 1)) q(ox - u - 2, y2, 2, 2, c2); }
  }
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
    // 창살 그림자 — 볕 안에 십자로 어두운 띠가 눕는다. 볕이 「창을 지나 왔다」는 표시다.
    const barU = Math.floor(ww / 4) * 2 - 2;                       // 세로 창살 자리
    for (let s2 = 0; s2 < dep; s2++){
      const far = 1 - s2 / dep;
      const barS = s2 >= Math.round(dep * 0.34) && s2 < Math.round(dep * 0.42);   // 가로 창살 그림자
      for (let u = 0; u < ww; u += 2){
        const edge = Math.min(1, Math.min(u, ww - 2 - u) / 12);    // 가장자리는 옅게 — 자로 그은 듯한 네모가 안 되게
        const bar = (u >= barU && u < barU + 4) || barS;
        const a2 = far * edge * (bar ? 0.07 : 0.34);
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
/* 방 안에서 빛을 내는 가구. c 는 빛 색(그 가구의 불빛 색), r 은 번지는 반지름(도트),
   dy 는 빛의 가운데를 발자국 가운데에서 얼마나 올릴지, flick 은 흔들림의 갈래.
   밤에는 방을 통째로 어둡게 물들이므로(grade) 불빛도 같이 죽는다 — 그래서 물들인 뒤에
   (1) 색깔대로 빛을 번지게 얹고 (2) 가구에서 빛나는 부분만 다시 그린다. */
const ROOM_LIGHT = {
  lamp:     { c: '#ffe9a8', r: 54, dy: -16 },
  fire:     { c: '#ff9a3a', r: 76, dy: -16, flick: 'fire' },
  stove:    { c: '#ff9a3a', r: 56, dy: -14, flick: 'fire' },
  xmas:     { c: '#ffd979', r: 54, dy: -16, flick: 'twinkle' },
  pumpkin:  { c: '#ff8c3a', r: 44, dy: -10, flick: 'fire' },
  nightsky: { c: '#8f9fe6', r: 78, dy: -6,  flick: 'breathe' },
  tank:     { c: '#8ec9ee', r: 40, dy: -10, flick: 'breathe' },
  tv:       { c: '#bfe8ff', r: 46, dy: -14, flick: 'tv' },
  stars:    { c: '#ffe680', r: 54, wall: true, flick: 'twinkle' },
  wlight:   { c: '#ffe9a8', r: 50, wall: true },
  mobile:   { c: '#ffd166', r: 28, wall: true, flick: 'breathe' },
};
// 그 가구에서 「빛나는 색」들. 그리는 코드가 shade() 로 만든 변형까지 같이 넣어 둔다.
const LIT_BASE = {
  lamp: ['#ffe9a8', '#fff3c0', '#ffd979'], fire: ['#ff8c2e', '#ffd166', '#fff3c0'], stove: ['#ff8c2e', '#ffd166'],
  xmas: ['#ffd979', '#f2707d', '#5aa9e6', '#ffd166'], nightsky: ['#fff3c0'], tank: ['#8fd0f0', '#5aa9e6'],
  tv: ['#9fd8f0', '#e8f6ff'], stars: ['#ffe680', '#fff6d0'], wlight: ['#ffe9a8', '#fff3c0', '#ffd979'],
  mobile: ['#ffd166', '#ff8fb8', '#8fd9c8', '#a9c8ff', '#c9a8ff', '#ffffff'],
};
const litSets = {};
function litSet(kind){
  if (litSets[kind]) return litSets[kind];
  const set = new Set();
  (LIT_BASE[kind] || []).forEach(c => { set.add(c); [22, 24, 26, 14, -10, -12, -18, -30, -34].forEach(k => set.add(shade(c, k))); });
  return (litSets[kind] = set);
}
// 호박 등은 거꾸로다 — 파 놓은 얼굴 구멍이 빛난다
function litColor(kind, col){
  if (kind === 'pumpkin') return col === '#3a2a20' ? '#ffd166' : null;
  if (typeof col !== 'string') return null;
  if (col.indexOf('rgba(') === 0) return (kind === 'tank' && col.indexOf('150,215,245') > 0) || (kind === 'wlight' && col.indexOf('255,225,150') > 0) ? col : null;
  if (!litSet(kind).has(col)) return null;
  if (kind === 'tank') return col === '#8fd0f0' ? 'rgba(143,208,240,0.55)' : 'rgba(90,169,230,0.55)';   // 유리는 비쳐야 한다
  return col;
}
function flickOf(kind, t){
  const f = (ROOM_LIGHT[kind] || {}).flick;
  if (f === 'fire') return 0.78 + 0.14 * Math.sin(t / 90) + 0.08 * Math.sin(t / 37);
  if (f === 'twinkle') return 0.72 + 0.28 * Math.abs(Math.sin(t / 420));
  if (f === 'breathe') return 0.8 + 0.2 * Math.sin(t / 1400);
  if (f === 'tv') return Math.sin(t / 130) > 0 ? 1 : 0.78;
  return 1;
}
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
function furnBitmap(f, rot, A, t, lit){
  const bw = Math.round(A.w * HS), bh = Math.round(A.h * HS);
  const anim = FURN_ANIM[R.FURNITURE[f].kind];
  const key = f + '|' + (rot % 2) + '|' + HS + (lit ? '|lit' : '');
  if (!anim){
    const hit = furnCache[key];
    if (hit && hit.width === bw && hit.height === bh) return hit;
  }
  const cv = anim ? (furnBuf || (furnBuf = document.createElement('canvas'))) : document.createElement('canvas');
  if (cv.width !== bw || cv.height !== bh){ cv.width = bw; cv.height = bh; }
  const b = cv.getContext('2d'); b.imageSmoothingEnabled = false;
  b.clearRect(0, 0, bw, bh);
  paintFurniture(b, f, rot, A, t, lit);
  if (lit){ if (!anim) furnCache[key] = cv; return cv; }          // 빛나는 부분만 — 테는 두르지 않는다
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
function drawFurnItem(g, f, rot, Rm, tx, ty, t, lit){
  const F = R.FURNITURE[f]; if (!F) return;
  const A = furnArt(f, rot), bm = furnBitmap(f, rot, A, t, lit);
  g.save(); g.imageSmoothingEnabled = false;
  g.drawImage(bm, Math.round((isoX(Rm, tx, ty) - A.EH - 1) * HS), Math.round((isoY(tx, ty) - A.H - 1) * HS));
  g.restore();
}
/* 가구 그리기. 발자국 마름모의 뒤 꼭짓점이 (A.EH, A.H) 에 온다.
   자리는 칸 방향으로 적는다 — ax 는 오른쪽아래로, ay 는 왼쪽아래로 간 가로 도트. */
function paintFurniture(g, f, rot, A, t, lit){
  const F = R.FURNITURE[f], c = F.c;
  MAT = FURN_MAT[F.kind] || 'wood';                            // 이 가구를 칠하는 동안의 재질
  MATSEED = f;
  const hi = shade(c, 24), lo = shade(c, -18), dk = shade(c, -36);
  // lit 이면 빛나는 색만 찍는다 — 같은 그리기 코드를 두 번 쓰되 두 번째는 거른다
  /* lit 이면 빛나는 색만 찍고, 나머지는 그 자리를 **지운다**(destination-out). 그래야 뚜껑·받침이
     가리던 유리가 겹 위에서 뚫고 나오지 않는다 — 어항이 앞뒤 없이 통째로 빛나던 까닭이 이것이었다. */
  const q0 = dotFill(g);
  const q = lit ? ((x, y, w, h, col) => {
    const lc = litColor(F.kind, col);
    if (lc){ q0(x, y, w, h, lc); return; }
    g.save(); g.globalCompositeOperation = 'destination-out'; q0(x, y, w, h, '#000000'); g.restore();
  }) : q0;
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
    case 'fox': {                                                        // 레샤 인형 — 실물 사진을 보고
      /* 앞선 사진은 엎드려 눌린 모습이라 납작하게 그렸는데, 제품 사진을 보니 **서 있는**
         인형이었다. 머리가 크고 몸이 작은 꼴, 바깥으로 벌어진 커다란 귀 둘, 그리고
         정수리에서 이마 한가운데를 타고 내려와 코에서 끝나는 **분홍 줄** —
         흰 얼굴이 그 줄을 사이에 두고 좌우로 갈렸다가 코 아래에서 다시 만난다.
         분홍은 한 가지만 쓴다(귀·머리·몸·팔·다리), 그늘도 안 넣는다. */
      const pink = '#f0cfc9', cream = '#f9f2e8';
      const ink = '#2b2622', nose = '#9c5b2a';
      const rows = (list, col) => list.forEach(([y, x, w]) => oq(x, y, w, 1, col));
      // 좌우 대칭인 것은 한 번만 적고 뒤집어 그린다
      const both = (list, col) => { rows(list, col); rows(list.map(([y, x, w]) => [y, 32 - x - w, w]), col); };

      // 귀 둘 — 크고 바깥으로 벌어졌다. 겉은 분홍, 안쪽에 크림색 심.
      both([[0, 3, 4], [1, 2, 6], [2, 1, 7], [3, 1, 8], [4, 0, 9], [5, 0, 9],
            [6, 0, 9], [7, 1, 9], [8, 2, 8], [9, 3, 7], [10, 5, 5], [11, 7, 3]], pink);
      both([[3, 3, 3], [4, 2, 5], [5, 2, 5], [6, 2, 5], [7, 3, 5], [8, 4, 4], [9, 5, 3]], cream);

      // 팔 둘과 다리 둘 — 머리·몸보다 먼저 (뒤에 놓인다)
      both([[20, 5, 4], [21, 4, 5], [22, 4, 5], [23, 4, 5], [24, 4, 5], [25, 5, 4], [26, 5, 4]], pink);
      both([[28, 10, 5], [29, 10, 5], [30, 10, 5], [31, 10, 5]], pink);

      // 몸 — 분홍, 앞가슴에 크림색 배
      rows([[20, 9, 14], [21, 8, 16], [22, 8, 16], [23, 8, 16],
            [24, 8, 16], [25, 8, 16], [26, 9, 14], [27, 9, 14]], pink);
      rows([[21, 12, 8], [22, 11, 10], [23, 11, 10], [24, 11, 10], [25, 12, 8], [26, 13, 6]], cream);

      // 머리 — 몸보다 크고 위가 둥글다
      rows([[3, 13, 6], [4, 11, 10], [5, 9, 14], [6, 8, 16], [7, 7, 18], [8, 6, 20],
            [9, 5, 22], [10, 5, 22], [11, 4, 24], [12, 4, 24], [13, 4, 24], [14, 4, 24],
            [15, 4, 24], [16, 4, 24], [17, 5, 22], [18, 6, 20], [19, 8, 16]], pink);

      // 흰 얼굴 — 분홍 줄을 사이에 두고 좌우로 갈렸다가 코 아래에서 다시 만난다.
      // 얼굴을 아래쪽에만 두어야 이마의 분홍 줄이 정수리까지 길게 이어져 보인다.
      both([[8, 7, 4], [9, 6, 6], [10, 6, 7], [11, 5, 8],
            [12, 5, 8], [13, 5, 8], [14, 5, 8], [15, 5, 8], [16, 5, 8]], cream);
      rows([[17, 6, 20], [18, 7, 18], [19, 9, 14]], cream);

      // 작고 까만 눈 둘
      both([[13, 9, 2], [14, 8, 4], [15, 9, 2]], ink);
      // 코 — 정수리에서 내려온 분홍 줄이 여기서 끝난다
      rows([[16, 14, 4], [17, 13, 6], [18, 14, 4]], nose);
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
  const Rm = RM(r);
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
  const Rm = RM(r); if (!Rm) return;
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
  // 끌고 있는 것 — 바닥 것과 벽에 건 것을 따로 본다. 제자리에는 안 그리고 끄는 자리에만 그린다.
  const held = grab && !grab.wall && grab.moved && room === r ? grab : null;
  const heldW = grab && grab.wall && grab.moved && room === r ? grab : null;
  Object.keys(P).forEach(k => {
    if (heldW && heldW.k === k) return;
    const it = P[k], F = R.FURNITURE[it.f]; if (!F) return;
    const q = HAS_WALLGRID() ? R.parseWall(k) : null;
    if (q){ wallItems.push({ f: it.f, side: q.side, col: q.col, row: q.row, k: k }); return; }
    const p = k.split(',').map(Number);
    if (WALL_KINDS[F.kind]){                                   // 아직 안 옮겨진 옛 세이브
      const sl = wallSlot(Rm, p[0], p[1]);
      wallItems.push({ f: it.f, side: sl.side > 0 ? 1 : 0, col: null, at: sl.at, row: 0, k: k });
      return;
    }
    floorItems.push({ f: it.f, r: it.r || 0, x: p[0], y: p[1] });
  });
  // 벽에 건 것은 바탕에 함께 굽는다 — 매 칸마다 계단을 쌓느라 프레임이 무거워진다
  wallItems.sort((a, b) => (a.side - b.side) || ((a.col == null ? a.at : a.col) - (b.col == null ? b.at : b.col)));
  const wsig = wallItems.map(i => i.f + '@' + i.k).join('|');
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
  /* 밤이면 「불 켜진 부분」을 따로 한 겹(litLayer)에 모은다. 벽 것 → 바닥 것 → 아이·고양이 순서로,
     빛나는 가구는 빛나는 색만 그리고 그 앞에 오는 것들은 같은 자리를 지운다(destination-out).
     그래서 물들인 뒤 이 겹을 얹어도 앞에 선 것이 뒤의 불빛을 가린다 — 어항이 탁자를 뚫고 보이지 않는다. */
  const glow = [], night = L.dark > 0.12;
  let lg = null;
  if (night){
    if (!litLayer) litLayer = document.createElement('canvas');
    if (litLayer.width !== cw || litLayer.height !== ch){ litLayer.width = cw; litLayer.height = ch; }
    lg = litLayer.getContext('2d'); lg.imageSmoothingEnabled = false; lg.clearRect(0, 0, cw, ch);
  }
  let litUsed = false;
  if (lg){
    const wlR = wallPaint(lg, Rm, 1), wlL = wallPaint(lg, Rm, 0), Pw = roomPal(r);
    wallItems.forEach(it => {
      const kind = R.FURNITURE[it.f].kind, LT = ROOM_LIGHT[kind];
      const len = wallLenOf(Rm, it.side);
      const u0 = it.col == null ? Math.min(Math.max(0, it.at * (TW / 2) - 8), len - 42) : wallU(len, wallColsOf(r, it.side), it.col);
      const wl = it.side ? wlR : wlL, dv = it.row ? WALL_DROP : 0;
      if (LT && LT.wall){
        const u = u0 + 20;
        glow.push({ x: (ox + (it.side ? u : -u)) * HS, y: (u / 2 + 30 + dv) * HS, r: LT.r * HS, c: LT.c, kind });
        lg.save(); lg.globalAlpha = 0.55 + 0.45 * flickOf(kind, t);
        paintWallItem((uu, v, uw, vh, c) => {
          const lc = litColor(kind, c);
          if (lc){ wl(uu, v + dv, uw, vh, lc); return; }
          lg.save(); lg.globalCompositeOperation = 'destination-out'; wl(uu, v + dv, uw, vh, '#000000'); lg.restore();
        }, u0, it.f, Pw, r, it.pic);
        lg.restore(); litUsed = true;
      } else if (litUsed){
        lg.save(); lg.globalCompositeOperation = 'destination-out';
        paintWallItem((uu, v, uw, vh) => wl(uu, v + dv, uw, vh, '#000000'), u0, it.f, Pw, r, it.pic);
        lg.restore();
      }
    });
  }
  floorItems.sort((a, b) => (a.x + a.y) - (b.x + b.y) || (a.x - b.x)).forEach(it => {
    if (held && it.x === held.fx && it.y === held.fy) return;
    drawFurnItem(g, it.f, it.r, Rm, it.x, it.y, t);
    if (!lg) return;
    const kind = R.FURNITURE[it.f].kind, LT = ROOM_LIGHT[kind];
    if (LT && !LT.wall){
      glow.push({ x: isoX(Rm, it.x, it.y) * HS, y: (isoY(it.x, it.y) + LT.dy) * HS, r: LT.r * HS, c: LT.c, kind });
      lg.save(); lg.globalAlpha = 0.55 + 0.45 * flickOf(kind, t);
      drawFurnItem(lg, it.f, it.r, Rm, it.x, it.y, t, true);
      lg.restore(); litUsed = true;
    } else if (litUsed){
      lg.save(); lg.globalCompositeOperation = 'destination-out';
      drawFurnItem(lg, it.f, it.r, Rm, it.x, it.y, t);
      lg.restore();
    }
  });
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
    const kb = outlined(who + 'room' + (blink ? 1 : 0), rows, KIDPAL[who], false, HS), kxp = Math.round((kx - 15) * HS), kyp = Math.round((ky - 40) * HS);
    g.drawImage(kb, kxp, kyp);
    if (lg && litUsed){ lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.drawImage(kb, kxp, kyp); lg.restore(); }
  }
  const cat = floorItems.find(i => R.FURNITURE[i.f].kind === 'catbed');
  if (cat){
    const wag = Math.sin(t / 700) > 0 ? 0 : 2;
    const cb = outlined('bcat', BEAST.cat.art, BEAST.cat.pal, false, HS), cxp = Math.round((isoX(Rm, cat.x, cat.y) - 14) * HS), cyp = Math.round((isoY(cat.x, cat.y) - 4 - wag) * HS);
    g.drawImage(cb, cxp, cyp);
    if (lg && litUsed){ lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.drawImage(cb, cxp, cyp); lg.restore(); }
  }
  ctx = keep2;
  // 빛 — 방도 농장과 같은 표로 물들인다. 안쪽은 조금 덜 어둡게.
  if (L.dark > 0.06) grade(g, cw, ch, L, 0.82);
  if (L.dark > 0.12 && glow.length){
    // 빛 번짐 — 가구마다 제 불빛 색으로. 불은 흔들리고, 별은 깜박이고, 프로젝터는 숨 쉰다.
    g.save(); g.globalCompositeOperation = 'lighter';
    const power = Math.min(1, L.dark * 1.9);
    const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(2) + ')'; };
    glow.forEach(l => {
      const k = power * flickOf(l.kind, t);
      const rg = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      rg.addColorStop(0, hexA(l.c, k * 0.55)); rg.addColorStop(0.5, hexA(l.c, k * 0.2)); rg.addColorStop(1, hexA(l.c, 0));
      g.fillStyle = rg; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    });
    g.restore();
    // 가구의 빛나는 부분 — 앞뒤 순서대로 모아 둔 겹을 한 장으로 얹는다
    if (litUsed) g.drawImage(litLayer, 0, 0);
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
  /* 벽에 거는 것을 골랐으면 벽 격자를 보여 준다 — 어디에 걸리는지 눈으로 고르게.
     초록은 빈 자리, 빨강은 이미 걸린 자리, 노랑은 창이나 문을 가리는 자리다. */
  const wallShow = heldW ? heldW.f : (furnPick && R.FURNITURE[furnPick] && R.FURNITURE[furnPick].wall ? furnPick : null);
  if (tab === 'house' && arrange && wallShow && HAS_WALLGRID()){
    const rows = R.wallRowsFor(wallShow);
    [0, 1].forEach(side => {
      const paint = wallPaint(g, Rm, side), len = wallLenOf(Rm, side), cols = wallColsOf(room, side);
      for (let c = 0; c < cols; c++){
        const u = wallU(len, cols, c);
        const taken = heldW && heldW.k === R.hungCol(W, room, side, c) ? null : R.hungCol(W, room, side, c);
        const col2 = taken ? 'rgba(255,143,143,0.75)' : wallCovers(room, side, c) ? 'rgba(255,209,102,0.75)' : 'rgba(143,217,143,0.8)';
        // 빈 칸에는 위·아래 두 단을 다 보여 준다. 이미 걸린 칸은 걸린 높이 하나만.
        const shown = taken ? [(R.parseWall(taken) || { row: 0 }).row] : (rows > 1 ? [0, 1] : [0]);
        shown.forEach(row => {
          const dv = row ? WALL_DROP : 0;
          paint(u, 4 + dv, 40, 2, col2); paint(u, 56 + dv, 40, 2, col2);
          paint(u, 4 + dv, 2, 54, col2); paint(u + 38, 4 + dv, 2, 54, col2);
        });
      }
    });
  }
  /* 끌고 있는 벽 물건 — 원래 자리는 옅게, 놓일 자리는 또렷하게. 바닥 가구와 같은 규칙이다. */
  if (heldW && HAS_WALLGRID()){
    const box = (side, col, row, c2) => {
      const paint = wallPaint(g, Rm, side), len = wallLenOf(Rm, side);
      const u = wallU(len, wallColsOf(r, side), col), dv = row ? WALL_DROP : 0;
      paint(u, 4 + dv, 40, 2, c2); paint(u, 56 + dv, 40, 2, c2);
      paint(u, 4 + dv, 2, 54, c2); paint(u + 38, 4 + dv, 2, 54, c2);
      return { u: u, dv: dv, paint: paint };
    };
    box(heldW.fside, heldW.fcol, heldW.frow, 'rgba(255,255,255,0.45)');
    const t2 = box(heldW.side, heldW.col, heldW.row, heldW.ok ? 'rgba(143,217,143,0.9)' : 'rgba(255,143,143,0.9)');
    g.save(); g.globalAlpha = heldW.ok ? 0.9 : 0.4;
    paintWallItem((uu, v, uw, vh, c2) => t2.paint(uu, v + t2.dv, uw, vh, c2), t2.u, heldW.f, roomPal(r), r, heldW.pic);
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
/* 가구 집어 끌기. 재배치 중에 놓인 가구를 누른 채 끌면 그 칸으로 옮긴다.
   끌지 않고 그냥 누르면 예전대로 가방에 들어간다 — 누르는 것과 끄는 것을 손이 알아서 고른다. */
/* 벽을 누르면 벽 격자에 걸거나 걸린 것을 집는다. 바닥과 같은 규칙이다 —
   누른 자리에 있으면 가방으로, 비었으면 고른 것을 건다. */
/* 일기에 그린 도트 그림 목록 — 한 판에 여러 번 걸 수 있으니 표는 한 번만 읽는다.
   「같이」로 쓴 일기의 그림도 제 그림으로 친다. */
let myPics = null;


/* 가계도. 새끼는 태어날 때 어미의 id 를 안고 나오므로(mom), 그것만으로 나무가 선다.
   새끼를 본 적이 없으면 칸 자체를 감춘다 — 빈 상자는 뭘 해야 하는지 알려 주지 못한다. */


/* 훈장. 조건이 찬 것은 초록 테로 눈에 띄게 하고, 받고 나면 금테로 남는다.
   받기를 눌러야 동전이 오므로 「받았다」는 실감이 생긴다. */

/* ---------- 오늘의 농장 한 장 ----------
   지금 화면을 그대로 한 장으로 뜬다. 위에 날짜·계절·날씨를 적은 띠를 얹어
   나중에 봐도 언제의 농장인지 알 수 있게 한다. 농장 그림에는 바깥 그림이 한 장도
   섞이지 않으므로 캔버스가 더럽혀지지 않는다 — toBlob 이 그대로 된다. */
const SNAP_DOT = 2;                 // 한 장은 도트 하나를 두 픽셀로 — 도트 그림은 이만하면 또렷하다

/* 축제 시상식. 우편함에 조용히 상이 들어가면 「받았다」는 느낌이 없다 —
   트로피를 한 번 크게 보여 주고, 둘이 각각 얼마를 냈는지 이름을 적어 준다. */

boot();

