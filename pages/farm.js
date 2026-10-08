// farm.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('farm');

// 규칙은 farm-rules.js 에 있다. 여기는 그림과 순서만.
const R = FARM;
let S = 3;                                     // 지도 한 픽셀 = 화면 몇 픽셀 — fitPixelCanvas 가 정한다
const T = 32;                                  // 한 칸 = 32도트. 예전에는 16이었다 — 자리가 두 배가 되어 결을 넣을 수 있다.
let COLS = R.GRID.w, ROWS = R.GRID.h;     // 지도 크기는 규칙이 정한다 — 농장마다 다르다(syncGrid)
const NAME = R.NAME;

let key = null, W = null, M = null, REV = 0, TUNE = R.fixTune(null), other = null, facts = {};
let Mbase = null;                              // 마지막으로 서버에 올라갔다고 확인된 내 줄
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

function flash(html, bad){
  const el = $('#fmsg'); el.innerHTML = html || ''; el.classList.toggle('bad', !!bad);
  /* 안내 줄은 농장 그림 위에 있어서, 아래쪽 동물·부엌 단추를 누르면 화면 밖에 떴다 —
     아이 눈에는 「눌러도 반응이 없다」. 안내 줄이 안 보이면 화면 아래에 잠깐 띄운다. */
  const r = el.getBoundingClientRect();
  if (!html || (r.bottom > 0 && r.top < window.innerHeight)) return;
  let t = $('#fmsgFloat');
  if (!t){
    t = document.createElement('div'); t.id = 'fmsgFloat'; t.setAttribute('aria-hidden', 'true');
    t.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:60;max-width:calc(100vw - 32px);'
      + 'padding:9px 16px;border-radius:12px;font-size:14px;font-weight:800;line-height:1.5;text-align:center;'
      + 'box-shadow:0 4px 14px rgba(0,0,0,.18);pointer-events:none;transition:opacity .2s;';
    document.body.appendChild(t);
  }
  t.innerHTML = html;
  t.style.background = bad ? '#fff0ee' : '#f4fff0';
  t.style.color = bad ? '#b23a3a' : '#2f6b2a';
  t.style.border = '2px solid ' + (bad ? '#e8a39b' : '#9fd48f');
  t.style.opacity = '1';
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

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
  const fresh = R.fixMine(mine ? mine.data : null, key);
  if (!Mbase){ M = clone(fresh); Mbase = clone(fresh); }
  const o = rows.find(r => r.who === R.OTHER[key]); other = o ? R.fixMine(o.data, R.OTHER[key]) : null;
  // 서버에 있는 내 줄을 돌려준다 — 겹쳤을 때 놀이 코드가 여기서부터 다시 한다
  return { mine: fresh };
}
/* 놀이 코드(가게·집 조작·도감·저장 + 심기·거두기·사기 같은 규칙)는 로그인한 사람만
   받는다 — 손님은 그림만 보므로 gzip 48KB(화면 28 + 규칙 19)를 안 받는다. 고전 스크립트라 이 파일의 최상위 let/const 를 그대로 나눠 쓴다
   (같은 전역 렉시컬 환경이다). 다만 이 파일이 먼저 다 돌아야 하므로, 저기 있는 함수는
   loadPlay() 를 기다린 뒤에만 부를 수 있다.
   ?v 는 배포가 어긋나도 새 farm.js 가 새 짝을 받게 하는 표식이다 — 짝을 고칠 때 같이 올린다. */
const PLAY_V = '22';
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
/* 진짜 하늘 받아 오기 — 서울. 열쇠 없이 좌표만 주면 되는 open-meteo 를 쓴다.
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
  const at = R.SKY_AT || { lat: 37.53, lng: 127.08 };
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
    const spr = SPRITES[k], cv = document.createElement('canvas'); cv.width = spr[0].length; cv.height = spr.length;   // 캔버스는 그림 크기 그대로
    cv.getContext('2d').imageSmoothingEnabled = false;
    drawSprite(cv.getContext('2d'), spr, 0, 0, 1);
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
  // ?farm=seaside|mountain|cloud(또는 0~3) — 아직 이사 안 간 농장도 미리 본다. 손님 그림이라 저장되지 않는다
  const pf = new URLSearchParams(location.search).get('farm');
  if (pf != null){
    const i = R.FARMS.findIndex((f, n) => f.id === pf || String(n) === pf);
    if (i >= 0 && i !== (W.farm || 0)){
      // 밭 모양이 달라 칸 이름이 바뀐다 — 이사할 때(moveFarm)처럼 같은 차례끼리 옮겨 심어 보여 준다
      const from = R.fieldCells(W); W.farm = i;
      const to = R.fieldCells(W), plots = {};
      Object.keys(W.plots || {}).forEach(id => { const k = from.findIndex(c => c.id === id); if (id[0] === 'g') plots[id] = W.plots[id]; else if (to[k]) plots[to[k].id] = W.plots[id]; });
      // 들판에서 옮긴 자리는 들판 것이다 — 이사처럼 비워야 새 농장 처음 자리에 선다(안 비우면 외양간·풍차가 겹쳤다)
      W.plots = plots; W.sprinklers = {}; W.layout = {};
    }
  }
  M = R.fixMine(null, 'sua');                    // 나무·바위 차례는 아이마다 달라서, 손님에겐 그냥 서 있는 모습으로
  tickAll();
  $('#peekArt').hidden = false;
  startLoop($('#peekFarm'));
  // 손님도 옛 농장을 구경한다 — 아이 화면과 같은 띠, 누르면 그림만 바뀐다
  const bar = $('#peekPast');
  const pick = i => { visitAt = i; walkers = null; beasts = null; withView(ensureActors); paintPastBar(bar, pick); drawFarm(liveCv); };
  if (bar) paintPastBar(bar, pick);
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

// ---------- 줌 상태의 손짓 ----------
/* 농장 캔버스는 가로 끌기를 코드가 받는다(touch-action:pan-y pinch-zoom — 밭 이어서 하기).
   그런데 두 손가락으로 벌려 놓은 뒤에는 한 손가락 가로 끌기가 「화면 옮기기」여야 하는데,
   같은 규칙 때문에 브라우저가 못 받아 줌 상태에서 좌우로 움직일 길이 없었다.
   배율이 1을 넘으면 가로 끌기도 브라우저에 돌려준다(manipulation). 그동안 밭 이어서 하기는
   쉬지만 톡 누르기는 그대로 된다. 다시 1로 돌아오면 원래 규칙으로. */
function syncFarmTouch(){
  const cv = document.getElementById('farmCanvas');
  const vv = window.visualViewport;
  if (!cv || !vv) return;
  cv.style.touchAction = vv.scale > 1.02 ? 'manipulation' : '';
}
if (window.visualViewport){
  window.visualViewport.addEventListener('resize', syncFarmTouch);
  syncFarmTouch();
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
// 농장마다 풍경 — 이사 가면 땅 빛깔과 아래 가장자리가 바뀐다(규칙은 farm-rules.js 의 FARMS).
// tint 쪽으로 계절 빛깔을 조금 끌어당기므로 봄·여름·가을·겨울은 그대로 읽힌다.
const FARM_LOOK = {
  // 그리스: 볕에 마른 풀·석회 길·부겐빌레아 / 화산: 잿빛 메마른 땅·검은 화산석·불꽃 꽃 / 일본: 이끼 빛 땅·흰 자갈·진달래
  seaside:  { tint: '#e0c982', amt: 0.62,  dry: '#f1e6c8', rock: '#f7efe4', bloom: ['#e0529a', '#ffffff', '#f27ab8', '#8fb8ff'], front: 'sea' },
  /* 산골은 스위스 풀밭이었다가 2026-10-06 로키즈 「무시무시하고 척박한 용암지대」로 바꿨다.
     ash: 겨울에도 눈 대신 재가 덮인 땅 그대로(계절 빛깔을 거의 다 덮는다) · path: 검붉은 화산재 길 · cracks: 땅에 용암 틈 */
  mountain: { tint: '#4a403d', amt: 0.84, dry: '#5c4d46', rock: '#2a2527', bloom: ['#ff6a1a', '#ffb02e', '#e8321e'], front: 'rocks', pebble: 0.66, bloomX: 0.3,
              ash: true, soot: 0.6, tuft: '#6a5642', path: ['#5e4640', '#4f3a35', '#6e534a'], pathEdge: '#2e2220', cracks: 0.2 },
  /* 일본: 이끼 빛 땅에 회색 돌을 깐 길(이시다타미), 바닥엔 진 벚꽃잎이 소복이(petals — 2026-10-07 로키즈 「농장 바닥엔 분홍 벚꽃들이 많이 쌓여」) */
  cloud:    { tint: '#7fb47a', amt: 0.48, dry: '#e8e4d8', rock: '#d9d6cc', bloom: ['#ff8fb8', '#ffffff', '#ffb7d5', '#c9a8ff'], front: 'cloud', bloomX: 1.2,
              path: ['#bdb8ac', '#aaa498', '#cdc8bd'], pathEdge: '#8a857a', petals: true },
};
function farmLook(){ return (W && R.farmOf && FARM_LOOK[R.farmOf(W).id]) || null; }
const palMemo = {};
function groundPal(season){
  const L = farmLook(), P = GROUND[season];
  if (!L) return P;
  const k = R.farmOf(W).id + season;
  if (palMemo[k]) return palMemo[k];
  const a = season === 'winter' && !L.ash ? L.amt * 0.35 : L.amt, cold = season === 'winter' && !L.ash;
  return (palMemo[k] = Object.assign({}, P, {
    g: P.g.map(c => mix(c, L.tint, a)), tuft: P.tuft.map(c => mix(c, L.tuft || L.tint, L.tuft ? a : a * 0.7)),
    dry: cold ? P.dry : L.dry, rock: cold ? P.rock : L.rock, bloom: cold ? P.bloom : L.bloom,
  }));
}
const SOIL = { wet: ['#6d4c30', '#7d5a3c', '#5a3f28'], dry: ['#b5885c', '#c49a6d', '#9f7550'] };
const WOOD = { hi: '#d6a878', mid: '#c79b6d', low: '#a97b4f', dark: '#8a5f3a', line: '#6f4a2c' };
const STONE = { hi: '#d5cec5', mid: '#c2bab0', low: '#a49c92', dark: '#857d75', line: '#665f59' };

// ---------- 스프라이트 ----------
// 아이 그림(KIDART·KIDPAL·KIDSTEP)은 pages/kid-art.js 에 있다 — 여덟 방향 × (서기 + 걷기 네 장), 크기는 KIDART[k].w·h.
// 여덟 방향 이름 — 화면에서 움직인 쪽(아래가 +y). 가만히 섰으면 앞(S).
const DIR8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
function dir8(x, y){ return x || y ? DIR8[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8] : 'S'; }
// 눈 감은 정면 — 서기 장의 두 눈 네모를 눈 바로 밑 살빛으로 덮고, 맨 아랫줄만 눈의 짙은 색으로 남긴다
function kidBlink(A){
  const rows = A.dirs.S[0].map(r => Array.from(r));
  A.eyes[0].forEach(([x, y, w, h]) => {
    const skin = rows[y + h][x], ink = rows[y + h - 1][x + w - 1];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) rows[yy][xx] = yy === y + h - 1 ? ink : skin;
  });
  return rows.map(r => r.join(''));
}

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
  /* 이삿날 새 식구 셋(2026-09-30) — 바닷가 갈매기, 산골 염소, 꽃구름 두루미.
     갈매기는 흰 머리·잿빛 날개·까만 날개 끝·노란 부리에 빨간 점. 염소는 매끈한 털에 뒤로 휜 뿔과 턱수염.
     두루미는 붉은 정수리·까만 목·흰 몸에 까만 꽁지깃·긴 다리. */
  gull: { w: 24, art: [
    '........................', '...............wwww.....', '..............wwwwwb....', '.............wwwwwwbb...',
    '.............wwwwbebb...', '.............wwwwbbbbkkk', '.............bwwbbbbbkr.', '............bbbbbbbbb...',
    '..KK......bbbbbbbbbbb...', '.KKggggggggggbbbbbbbb...', 'KKgggggggggggggbbbbbb...', '.KKGggggggggggggbbbbb...',
    '..KKGGgggggggggbbbbB....', '....bBGGGGGGGbbbbbB.....', '.....BBbbbbbbbbbBB......', '.......BBBBBBBBB........',
    '..........ll..ll........', '..........ll..ll........', '.........lll.lll........',
  ], pal: { w: '#ffffff', b: '#f7f8fa', B: '#d3dae0', g: '#b9c4ce', G: '#8f9ba6', K: '#2f3338', k: '#f5c542', r: '#e0453a', e: '#26241f', l: '#f2b04e' } },
  goat: { w: 28, art: [
    '.................HH.HH......', '..................HH.HH.....', '...................HH.HH....', '..................hhhhhh....',
    '................aahhhhhhh...', '................aahhhheehh..', '..t..............hhhhhhhhhn.', '.tt..............hhhhhhhhhnn',
    '.tbbbbbbbbbbbbbbbbhhhhhhhhh.', 'bbbbbbbbbbbbbbbbbbbhhhhhh...', 'bbbbbbbbbbbbbbbbbbbbhDDhh...', 'bbbbbbbbbbbbbbbbbbbb.DD.....',
    'bbbbbbbbbbbbbbbbbbbb.DD.....', 'bbbbbbbbbbbbbbbbbbbB..D.....', 'BBbbbbbbbbbbbbbbbbBB........', '.BBBBBBBBBBBBBBBBBB.........',
    '..BBBBBBBBBBBBBBBB..........', '...ll.ll.....ll.ll..........', '...ll.ll.....ll.ll..........', '...ll.ll.....ll.ll..........',
    '...ll.ll.....ll.ll..........', '...LL.LL.....LL.LL..........', '...LL.LL.....LL.LL..........',
  ], pal: { b: '#fbf5ea', B: '#dccfb8', h: '#fbf5ea', H: '#9a8466', a: '#e6d6ba', e: '#3a3226', n: '#f2c0b0', D: '#d8c8a8', t: '#e6d6ba', l: '#ece2cf', L: '#4a4038' } },
  crane: { w: 24, art: [
    '..................rr....', '.................wrrw...', '.................wwekyyy', '.................wkkk...',
    '..................kk....', '..................kk....', '.................kk.....', '.................kk.....',
    '................kk......', '................kk......', '.....wwwwwwwwwwwkk......', '...wwwwwwwwwwwwwwk......',
    '.kkkwwwwwwwwwwwwww......', 'kkkkkwwwwwwwwwwwww......', '.kkkkWwwwwwwwwwwwW......', '..kkkWWwwwwwwwwwWW......',
    '.....WWWWWWWWWWWW.......', '........l....l..........', '........l....l..........', '........l....l..........',
    '........l....l..........', '........l....l..........', '........l....l..........', '.......ll...ll..........',
    '......lll..lll..........',
  ], pal: { w: '#ffffff', W: '#d9d9d2', k: '#2a2a2e', r: '#e0303a', y: '#b8b08a', e: '#26241f', l: '#3a3a3e' } },
};
// 가게 아저씨(파란 캡·흰 셔츠·초록 앞치마)와 행상인(보라 외투·붉은 목도리). 2026-10-02 관객·경비원과 같은 화풍으로 다시 그림(56도트, SW 를 봄).
// 아래 토막은 tools/shopkeep-art.py 가 채운다 — 손으로 고치지 말 것.
// <shopkeep>
const SHOPKEEP = [["..............oooooooo.................", "............oneeeeeecnoon..............", "..........onneeeeeeeeeeepon............", ".........nneeeeeeeeeeeeeeeonn..........", "........nneeeeeeeeeeeeeeeebboo.........", "........nceeeeeeeeeeeeeeeeebbnn........", "........oncceeeeeeeeeeeeeeeebbnn.......", ".......onnaaaaccceeeeeeeeeeebbbn.......", "......nnbeecccaaaaeeeeeeeeebbbbbn......", "....nqbccceeceeeceaaeeeeeeebbbbbn......", "...nnaaaaaaaacceeeccaaceeebbbbbbn......", "...obaaanuupsaaaeeeecaaeebbbbbbbn......", "...noaaqtvvvvvrraceeeeaabbbbbbbbo......", "....nnqvvtvvvvuurraeeeeaaqbbbbbqo......", "......ouurrvvvvuqrraaaaprqqdoonoo......", "......ousxxrvvvrxxxrrrruuvvvvvvqn......", "......nnryyyrrrrxyyyruuvvvvvvvvvn......", ".......ooqryyyyyyyyyysvvvvuuvvvvoo.....", "........oznhyyyyynqqyysuvvrruvvvoq.....", ".......ohzrpyyyyyqnzpyyturyrruuoo......", ".......qyzrpyyyyynozzyyutpyyyruno......", ".......qyytyyyyyyutzzyyussxxyqqq.......", ".......qyyyyyyyyyuuyyyyutrxyyqo........", "........nyyyuuuuyyyyyyytsyyyno.........", ".........ryyysxtyyyyyyyuuqqqq..........", ".........rnnyyyyyyyyyyttqooq...........", "...........qoqqqqxxxqgiqq..............", "............qsiyxxxzzifzzq.............", "..........nnzggzttzzjlfzzhn............", "..........rzzgjzzuzzkjzzzzr............", ".........rzzzjjjgjzflgzzzzhq...........", ".........hzzzgkgggglkfzzzzzo...........", "........qzyzglllllllljzzzzzo...........", "........oxyxslllllllkryxxzzo...........", "........qyyyolllllllryyyyxzq...........", "........qyyyynfgggrohyyyyxq............", ".........qyyyyrjjnyyyyyyyno............", "..........nyyyypqyyyyyyyrq.............", "..........qhyyynoyyyyyoqio.............", "...........onyniiryyyojkkq.............", "...........oqrjkkknqqjkkko.............", "...........okkggggggkkkkko.............", "...........okllglglllkkkoo.............", "...........qqkllkllllkkkoo.............", "...........oqfppklllkkrroo.............", "............ovvvqrqqrrvvvo.............", ".............ovvvvrvvvvvvoo............", ".............ovvvvvovvvvvvo............", "............oorvvvvqvvvvvvo............", "...........oottrqqroqvvvvro............", "..........ootttttttoqrqrqtoo...........", "..........oowtttttoqttttttto...........", "...........owwwwwwotttttttwo...........", "............onoqonowwwwwwwo............", "..................oowwwwqq.............", "...................oooooo.............."], ["...............noononn.................", "............nnneceeccennnn.............", "...........nncceeeeeeeecednn...........", "..........nncccceeeeeeeeeccdn..........", ".........nhceeeeeeecceeeeeeebnn........", ".........ncccceeeeecccceeeeebbnn.......", ".........hcceccceeecccceeeeebbbh.......", "........nooaaaceceececceeeeebbbbn......", "......noohpcceaaaecceeeeeeeebbbbbn.....", ".....nnbccceeeeeaaaceeeeeeeebbbbbn.....", "....oobbaaaacceeceaacceeeeebbbbbbn.....", "....nbaaamqhaacceeeeaacceebbbbbbbn.....", "....nbaanhvvvnraceeeeeacebbbbbbbbn.....", "....noonouvvvvuuaaeceeeaabbbbbbbq......", ".......quutvvvvuuoaacccaarqndbbbn......", ".......ouurovvvvnxxnaaartuuuroqro......", ".......ourxyxovvryoqtuuuvvvvvvvvvq.....", "........qpyyyyrryyyyyruvvvvvvvvvvo.....", "........opyyyyyyyyyyyyyrvvvuuvvvvq.....", "........ooqnyyyyyyyryyyxuvuqquuuq......", "........qqyyyyyyyrronryytusyyruuo......", "........pyyyyyyyyryyyhyytpyxyyoq.......", "........oyyyyyyyyyyyyyyyurxxyyoo.......", "........qpyyywyywyyyyyyytryyyyq........", ".........qyyyywwyyyyyyyyrtyyyo.........", "..........qyyyyyyyyyyyyrtoooq..........", "...........oqyyyyyxxqqstoo.............", ".............qqqrxxxyzigqo.............", "............npjjztxzzfljzzh............", "...........rzzigzutzjljzzzzq...........", "..........nzzjkfzvzzgkgzzzzh...........", "..........pzzgklggggklgzzzzzr..........", ".........nzzzjlkklllllgzzzzzn..........", ".........nxyzgllllllllgyzzzzo..........", ".........qyyyrklllllllrxxxxzq..........", ".........pyyyrllkkkllhyyyyxoq..........", ".........npyyyhhgggnhyyyyyqq...........", "..........rnyyyyronyyyyyynq............", "...........ryyyyqqyyyyyynq.............", "............qyyrqryyyyyrko.............", "............orogiiqrynqjko.............", "............okkgkklqqrikko.............", "............okkkggggkkkkko.............", "............okkklkkkkkkkko.............", "............qnkkkkkkkkklro.............", ".............ourrrpppprpvq.............", ".............qqvvvvnvvvvvoo............", ".............onvvvvrvvvvvvq............", ".............oqrvvvrqvvvvvn............", "............qtttqqqoqovvvrqo...........", "...........ntttttttoorrrqtto...........", "...........owttttttqtttttttq...........", "...........nnwwwwwwnttttttwo...........", ".............ooooonqwwwwwwr............", "...................onwwwwq.............", "....................ooooo.............."], ["...............ooonoon.................", ".............oocceeeecooon.............", "...........noacceeeeeeeeccno...........", "..........nheeeeeeeeeeeeeeeann.........", ".........nneeeeeeeeeeeeeeeeebon........", ".........ncceeeeeeeeeeeeeeeebbnn.......", ".........ncccccceeeeeeeeeeeeebbnn......", "........noqaaaaceceeeeeeeeeeebbbon.....", ".......nnbcceecaaacceeeeeeeebbbbbnn....", "......obceeeeceeecaaeeeeeeeebbbbbno....", ".....obbaaaacceeeeeeaaeeceebbbbbbnn....", "....oabaapuuaaaaeeeeeaaeceebbbbbbno....", "....naaaqtvvvvspaaceeeaaeebbbbbbbnn....", ".....nnoquvvvvvuuaaaececaabbbbbbno.....", ".......ovuuvvvvvuqopaaaaaqrodbbboo.....", ".......ouurqsvvvqxxxrqqruuuuuoqrnn.....", ".......noryyynrvqxyrruuuvvvvvvvvvoo....", "........oohqyyrppyyyyrsvvvvvvvvvvoo....", ".........nnnryyyyyoqnyxxvvvuuuvvvoo....", "........oqzhnyyyyyqonhyxtvuqorvuqo.....", "..oqqo..qyzpryyyyyqqzzyyuunyyyouoo.....", ".qnqnqo.oyystyyyyyttzzyytssxxyqoo......", "qqyyyyrrqyyyyyyyyyttzyyyusxxyyoo.......", "oqyyyyyq.nyyyyuuuyyyyyyytssyypo........", "ooyyyyyr..hyyysxsyyyyyyysuhpyo.........", "qoyyyyyq..nrqyyyyyyyyyyntnqqo..........", ".qqyyyyyrqqqpnorqnxxrrotqo.............", "..qnyyyyhrqzzgkgyxxxzzgfoqr............", "...nyyyyyxzzzjijzttzzjljzzh............", "....ryyyyxzzzjkfzuzzgkgzzzzq...........", ".....nyyyxzzffkjztzzjkgzzzzho..........", "......nyyxzzjjkkggggkkgzzzzzq..........", ".......oqzzzjlllllllllgzzzzzzo.........", ".........nqoolllllllllgzzzzzzo.........", "............qllllllllllgzzzwqq.........", "............olllllllkllprxxyyo.........", "............oljgggggglkkhyyyyqn........", "............olkglllkgllkpyyyynq........", "............olggllllgllloqyyyyp........", "............olggllllglllqqyyyyo........", "............ollgggggklllrqyyyyn........", "............olllklllllllloqrorq........", "............olkllllllllkko.oqo.........", "............oqmklllllkllpo.............", ".............oqssrppprppro.............", "..............qvvvvqvvvvvq.............", "..............ovvvvqvvvvvoo............", "..............qvvvvvqvvvvvo............", ".............ooqvvvvqvvvvvo............", "............qtttrqqoovvvvro............", "...........oqttttttnorrqrtto...........", "...........qqtttttqottttttto...........", "...........oowwwwwwnttttttwo...........", ".............ooooonqwwwwwwq............", "...................ooowwwn.............", "....................oooooo............."]];   // [서기, 눈웃음, 손 흔들기]
const SHOPPAL = {"a": "#071f63", "b": "#0f328c", "c": "#133ba2", "d": "#14153a", "e": "#143da6", "f": "#182e1f", "g": "#193625", "h": "#1b0404", "i": "#1c4f30", "j": "#1d3e2a", "k": "#1d5b35", "l": "#1f6038", "m": "#201315", "n": "#210202", "o": "#250301", "p": "#280905", "q": "#290401", "r": "#2f0703", "s": "#380f08", "t": "#3f1d14", "u": "#542817", "v": "#6b3a21", "w": "#835541", "x": "#e8875e", "y": "#fbbc92", "z": "#fbf9fa"};
const PEDKEEP = [["............ddddccddc..............", "..........dccsssssssfddc...........", ".........ccsssssssssssscc..........", "........cfssssssssssssssocc........", ".......cbsssssssssssssssqofd.......", ".......csssssssssssssssssqqb.......", ".......cssssssssssssssssssoofc.....", ".....cdcdijjjsssssssssssssqqocc....", "....dcessssssjjjsssssssssqqqoqdc...", "...cdqssssssssssjjsssssssqqqqqcc...", "..cconlljljlssssssijssssqqqqqqcc...", "..colljcpprhllssssssjssqqqqqqqcc...", "..ddljfprrrrrpbjlssssjjoqqqqqqcd...", "...cccppmrrrrppfclssssjfcjooood....", ".....cpphcrrrrphxbjlllbprpfcddd....", ".....dpaxxzbrrbxzfhppprrrrrrrrf....", ".....dcazzzzfdezzzxbprrrrrrrrrrc...", "......dfbdzzzzzzzzzzxhrrrpprrrrd...", ".......fyaezzzzzcdfzzxprpfcprrfd...", "......czyeezzzzzffyazzpphzzhppd....", "......dzyezzzzzzmpyzzzpezxzecd.....", "......dzzzzzzzzzppyzzzpaxxzzd......", "......czzzzzrpzzzzzzzzmhzzzfd......", ".......chzzmpkpzzzzzzhhpzzhf.......", "........hazzzzzzzzzzkhpcddd........", ".........dfbhdchxxhkkccdf..........", "..........bvvpfcchvvvvvfdc.........", ".........dfvvvvvvvvvvvfcvvf........", "........dbovvvvvvvvvvfqevvff.......", "........doqibvvvvvcblqqofvvc.......", "........fqoioqllfvvvooqqobvf.......", ".......dqqniooyievvviooqovvb.......", ".......dqniioowoevvgnooqqfdd.......", "......dooqoioooogvgiqoqqod.........", "......cqqqwwgnynlewqooooc..........", "......cbqwwgfqwncfwwqqogd..........", ".......fwwzzzhfhzzjwwoghpd.........", ".......dwazzzadzzzzjwacpppd........", "........dbzzzefzzzzhihppppd........", ".........cbzfalbbzahcppkkpd........", ".........bnfcnwjbfflbpppppd........", "........dooqoqwoooooehppkf.........", "........dqooowiwoooqqndfcd.........", ".......cboooqwbwoooooonlfc.........", ".......dfoooowewooooooolld.........", ".......dfwwwwwawqooooowssc.........", "........ccawwifwwwwwwwwfcc.........", "..........dcdfmcdcdddbpcc..........", "...........fprpppfpppprcc..........", "..........ddcfddffrrrrrdd..........", ".........fcmmmmmmcffddcmmd.........", "........dmmmmmmmfcmmmmmmmd.........", "........cttmtttrfmmmmmmttd.........", ".........dttttttftmmmmtdc..........", "..........ddcddcccttttdd...........", ".................cdcdcc............"], [".............dccccdcc..............", "...........dcssssssssbcc...........", ".........ccbsssssssssssbdc.........", "........ccsssssssssssssssbc........", ".......cdssssssssssssssssqbc.......", ".......dcsssssssssssssssssoqc......", ".......ccsssssssssssssssssooec.....", "......cddijjjsssssssssssssqqocc....", ".....ccfsssssjjjssssssssssoqqqcc...", "....ccssssssssssljssssssssqqqqqc...", "...dcqnjlfljssssssijsssssqqqqqqd...", "..dbqlllpprhjljsssssjsssqqqqqqqd...", "..ccllldprrrrpplsssssjjooqqqqqdd...", "...cdcbrrrrrrrpfejssssjbfdioqod....", ".....dfrmdrrrrpbxhjjljbprppcddd....", ".....cbrxxxhrrrhzbhppprrrrrrrrd....", "......dfxzzzhffzzzxaprrrrrrrrrrd...", "......cczzzzzzzzzzzzharrrpprrrrd...", ".......bchazzzzzzbezzzprpcdprrfd...", "......cdhzhzzzzzbfbbzzpphzzhhpd....", "......fzzzzzzzzzhzzzzzphzzzzcfd....", "......czzzzzzzzzzzzzzzphxxzzfd.....", "......dhzzzzvzvzzzzzzzmhzzzfdd.....", ".......czzzzzvrzzzzzzzfpzzzd.......", "........cazzzzzzzzzzzhpbdcf........", ".........ccdbaeaxxxdmcdfc..........", "..........ccvvdfbahvvvvfdf.........", "..........dvvvvvvvvvvvvfvvf........", ".........cbhvvvvvvvvvhbnevvf.......", "........dfqobfvvvvpfbqqohvvc.......", "........cooqoohlbvvvioooqfvvf......", ".......ddqoiooywovvviqqooavvd......", ".......dcojioowlnvvvioooohvfd......", ".......coooigooonvviooqoobdd.......", ".......cooowiqywoggwqqqoed.........", ".......fqwwjgawlndiwwooocd.........", ".......dawjzzhdbazzwwoofbd.........", ".......cbwzzzzefzzzzjwbpppb........", "........cbzzzzabzzzzjbkpppd........", ".........cczzhlbbzzbcpphtdc........", ".........cbbdjwwlffnnprpppf........", ".........cqooowwooooqfppppd........", ".........boooowgooooooddcc.........", "........ccooowwwwoooooollc.........", "........doooowwfwooooooolcc........", "........dwwwwwwawooooowsssc........", ".........cdawwibwwwwwwwwcc.........", "..........bcddbbddcddcbfc..........", "...........cdpppppfppprpc..........", "..........dcdcfdddcrrrrrcc.........", "..........dmmmmmmfffdddcmdd........", ".........dmmmmmmmfmmmmmmmdc........", ".........dtttttttcmmmmmmtdd........", ".........cftttttdftmmmmtbd.........", "..........cddcdddctttttfc..........", ".................ccdccdc..........."], ["..............dddcccdd.............", "............ccssssssssccc..........", "..........cdssssssssssssac.........", ".........ccssssssssssssssnbc.......", "........ccsssssssssssssssoodc......", "........cbssssssssssssssssqobd.....", "........cbsssssssssssssssssqqdc....", ".......cdfijjisssssssssssssqqocc...", "......ddgsssssjjjsssssssssqqqqqcc..", ".....dsssssssssssjjsssssssqqqqqqc..", "....dqslljjjsssssssijssssqqqqqqqc..", "...dbqllfppfbjjsssssslsssqqqqqqqc..", "...ccjlhprrrrhfllsssssjjqqqqqqqfd..", "....ddcbpprrrrpphhlsssslhchooood...", "......drrfcrrrrpfxbjjllbpppbfdcd...", "......crbxxhbrrbxxfhppprrrrrrrrc...", "......dcbzzzzhcbzzzxbprrrrrrrrrrd..", ".......dcffzzzzzzzzzzhbrrrpprrrrd..", "........fyyezzzzzbdfzzxprpfcprpfd..", ".......dbyybzzzzzffyezzppbzzehpd...", "..cfc..dzyyezzzzzmpyzzzpbzxzzdf....", ".ffaff.czzzzzzzzzppyzzzrfxxzzf.....", "dezzzhffezzzzppzzzzzzzzmbzzzdd.....", "bzzzzzc.hhzzpprpzzzzzzzdpzzbc......", "dzzzzzf..hazzzzzzzzzzzhpfdcf.......", "cazzzzfc..ffcbebcxxhhkhcdd.........", ".dzzzzgwfcccvvpcbfhvvvvvfbd........", ".cfzziwwocohvvvvvvvvvvvbfvhd.......", "..dfiwwwqooavvvvvvvvvvfqcvvcf......", "..cfwwwqooojhbvvvvvffboqqfvvf......", "...cwwoqqoogooolhvvvbnqqonfvdd.....", "....cdooooniqoywnvvvfloqoofvcf.....", ".....ccdfdccoqwjnvvvblqooocdd......", "...........coqqqnvvvnijqqonc.......", "...........bqqywnlllnniqqood.......", "...........cbowlnoqoongoqqobc......", "...........fpcbclbdpfpbnqoqqfd.....", "...........dppttffppppphowwwfc.....", "...........cobtthapcpthbwwwgch.....", "..........cooosolbpprrpcgzzzzc.....", "..........cqqqwwohhrpphfhzzzzbd....", ".........dooqowwoobcdfjjdzzzzbf....", ".........ccooowioooooonlcfzzcd.....", ".........booqqwawoooooolldddf......", ".........fqoqwwewoooooollf.........", ".........ewwwwwawooqoqwssd.........", ".........cdawwiewwwwwwwudc.........", "...........dcfbmfdcfdfpmd..........", "............dpprppfppprrc..........", "...........ddcfddfdrrrrrd..........", "..........dcmmmmmmcffdcfmc.........", ".........dcmmmmmmdmmmmmmmd.........", ".........dbtttttthmmmmmmtd.........", "..........dttttttbtmmmmtcc.........", "...........ccccdcctttttcd..........", ".................dddccd............"]];   // [서기, 눈웃음, 손 흔들기]
const PEDPAL = {"a": "#100203", "b": "#160101", "c": "#1a0000", "d": "#1d0100", "e": "#1d0407", "f": "#200101", "g": "#21031b", "h": "#260302", "i": "#27052d", "j": "#2d093c", "k": "#340d06", "l": "#360d48", "m": "#3a1a12", "n": "#431658", "o": "#4e1b65", "p": "#50210d", "q": "#511e6b", "r": "#5e2d18", "s": "#602b84", "t": "#754731", "u": "#78469e", "v": "#871621", "w": "#995fc8", "x": "#ec8e5f", "y": "#f7d8f9", "z": "#fcbe90"};
// </shopkeep>
/* 가게 아저씨·행상인은 제자리에서 서성인다(2026-10-02 로키즈 「너무 제자리에만 서 있어 어색해」).
   몇 초마다 가게 안 다른 자리로 살짝 옮겨 가고, 멈춰 서면 가끔 눈웃음을 짓거나 손을 흔든다.
   자리는 시각에서 바로 나온다(난수는 칸 번호로) — 들고 있을 상태가 없다. off 는 -1~1, dir 은 옮겨 가는 쪽(+ 면 오른쪽). */
function npcIdle(t, salt){
  if (STILL) return { off: 0, frame: 0, bob: 0, dir: 0 };
  const P = 4800, k = Math.floor(t / P), f = (t % P) / P;
  const at = i => R.prand(salt + i) * 2 - 1, a = at(k - 1), b = at(k);
  const m = Math.min(1, f / 0.22), e = m * m * (3 - 2 * m), moving = m < 1 && Math.abs(b - a) > 0.1;
  const r = R.prand(salt + 'f' + k);
  const frame = moving ? 0 : r > 0.72 && f > 0.4 && f < 0.7 ? 2 : r < 0.3 && f > 0.55 && f < 0.75 ? 1 : 0;   // 2 손 흔들기 · 1 눈웃음
  return { off: a + (b - a) * e, frame, bob: moving && Math.floor(t / 160) % 2 ? 1 : 0, dir: moving ? Math.sign(b - a) : 0 };
}
// 아이소 가게 아저씨 — 가게 그림의 뒤 겹과 앞 겹 사이에 매 장 그린다(drawFarmIso). 그림은 왼쪽 아래를 보고, 오른쪽으로 옮길 땐 뒤집는다.
// 왼쪽 앞에 세운다 — 가운데면 오른쪽 앞 기둥이 몸 한가운데를 지나고 매단 것이 얼굴에 걸린다. 서성임은 ±0.2칸(±4도트)까지만.
function stallKeeperAt(b){ const O = isoGeo(b, 0.18, 0); return { u: O.u0 + (O.u1 - O.u0) * 0.3, v: O.v0 + 0.85 }; }
function drawStallKeeperIso(b, t){
  const s = npcIdle(t, 'shop'), at = stallKeeperAt(b), q = isoP(at.u + s.off * 0.2, at.v), fr = SHOPKEEP[s.frame];
  art(fr, Math.round(q.x) - (fr[0].length >> 1), Math.round(q.y) - 54 - s.bob, SHOPPAL, s.dir > 0);
}
// 들판(2D) 가게 아저씨 — 좌판 오른쪽 끝, 위 28줄(좌판 앞턱 위)만
function drawStallKeeper2D(t){
  const b = spot('stall'), s = npcIdle(t, 'shop'), fr = SHOPKEEP[s.frame];
  art(fr.slice(0, 28), b.x * T + b.w * T - 23 - (fr[0].length >> 1) + Math.round(s.off * 4), b.y * T + 8 - s.bob, SHOPPAL, s.dir > 0);
}
// 가게 그림을 둘로 나눠 그릴 때의 몫 — 'back'(바닥·뒤 살림·뒤 기둥) | 'front'(판대부터 앞) | null(통째, 아저씨는 서 있는 모습)
let stallPart = null;
const VOID_CTX = document.createElement('canvas').getContext('2d');   // 'back' 몫에서 판대부터는 여기에 그려 버린다
/* 수레를 끌고 온 행상인. 이레에 두 번쯤 와서, 온 날에만 그린다.
   줄무늬 덮개와 둥근 바퀴로 가게 좌판과 구별한다 — 네모 바퀴는 탁자 다리로 읽혔다.
   행상인은 발끝까지 있는 56도트 그림(2026-10-02)이라 바닥 줄에 그대로 세운다. 수레 쪽(왼쪽 아래)을 보고 서성인다(npcIdle). */
function drawPeddler(t){
  const b = R.peddlerSpot(W), X = b.x * T, Y = b.y * T, G = Y + T;      // G: 바닥 줄
  px(X + 2, G - 4, 86, 4, '#00000018');
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
  // 행상인 — 수레 오른쪽 손잡이 곁에서 ±6도트 서성인다
  const s = npcIdle(t, 'ped'), fr = PEDKEEP[s.frame];
  art(fr, X + 73 - (fr[0].length >> 1) + Math.round(s.off * 6), G - fr.length - s.bob, PEDPAL, s.dir > 0);
}
/* 아이소 행상인 수레(2026-10-08 로키즈 「아이소메트릭에 맞춰 다시 디자인」) — 평면 그림을 붙이면 섬 위에서 납작한 판때기로 보였다.
   u 쪽으로 긴 나무 짐칸에 보라·크림 줄무늬 포장을 반원통으로 씌우고, 앞(u1)은 열어 물건을 내보인다. 끌채는 앞으로 뻗고 행상인은 그 곁에. */
const PED_CART = { u0: 0.12, u1: 1.5, v0: 0.22, v1: 0.78, bed: 12, top: 20, hood: 26, cream: '#fff6e9', purple: '#8a5cc7', rim: '#5f3f96' };
function pedCartGeo(P){ const C = PED_CART; return { u0: P.x + C.u0, u1: P.x + C.u1, v0: P.y + C.v0, v1: P.y + C.v1 }; }
function pedKeeperAt(P){ const G = pedCartGeo(P); return { u: G.u1 + 0.55, v: G.v0 - 0.2 }; }   // 끌채 건너편 — 앞에 서면 열린 짐칸을 가렸다
// 포장 — u 쪽으로 누운 반원통. θ 는 앞(v1, 0)에서 뒤(v0, π)로. 뒤 띠부터 칠하면 앞 띠가 덮는다
function pedHood(G, z0){
  const C = PED_CART, cv = (G.v0 + G.v1) / 2, rv = (G.v1 - G.v0) / 2 + 0.04, N = 14, M = 6, len = G.u1 - G.u0;
  const at = (u, th) => [u, cv + rv * Math.cos(th), z0 + C.hood * Math.sin(th)];
  for (let i = N - 1; i >= 0; i--){
    const a = i / N * Math.PI, b = (i + 1) / N * Math.PI, lit = Math.round(Math.sin((a + b) / 2) * 14) - (i < 3 ? 8 : 0);
    for (let k = 0; k < M; k++){
      const ua = G.u0 + len * k / M, ub = G.u0 + len * (k + 1) / M;
      poly3([at(ua, a), at(ub, a), at(ub, b), at(ua, b)], shade(k % 2 ? C.purple : C.cream, lit));
    }
  }
  isoSeg(isoP(...at(G.u0, 0)), isoP(...at(G.u1, 0)), C.rim, 2);                                                       // 포장 아랫단
  return { cv, rv, at };
}
function isoPeddlerCart(P){
  const C = PED_CART, G = pedCartGeo(P), len = G.u1 - G.u0, body = WOOD.mid;
  ishadow((G.u0 + G.u1) / 2 + 0.2, (G.v0 + G.v1) / 2, len / 2 + 0.25, 0.4);
  // 바퀴 — 살 여덟 개짜리 큰 바퀴. 건너편 둘은 짐칸보다 먼저 그려 아래쪽만 보인다
  const wheel = (Gf, a, rim, hub) => {
    const ra = 0.3, rz = 11, zc = 11;
    for (let i = 0; i < 40; i++){ const an = i / 40 * Math.PI * 2, q = faceMid(Gf, 'L', a + Math.cos(an) * ra, zc + Math.sin(an) * rz); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 2, rim); }
    for (let i = 0; i < 4; i++){ const an = i / 4 * Math.PI; isoSeg(faceMid(Gf, 'L', a + Math.cos(an) * ra * 0.9, zc + Math.sin(an) * rz * 0.9), faceMid(Gf, 'L', a - Math.cos(an) * ra * 0.9, zc - Math.sin(an) * rz * 0.9), shade(rim, 22), 1); }
    const c = faceMid(Gf, 'L', a, zc), x = Math.round(c.x), y = Math.round(c.y); px(x - 1, y - 2, 3, 5, hub); px(x - 2, y - 1, 5, 3, hub); px(x, y - 1, 1, 1, '#c9c2b4');   // 둥근 굴대 머리
  };
  const back = { u0: G.u0, u1: G.u1, v0: G.v0 - 0.06, v1: G.v0 - 0.02 }, front = { u0: G.u0, u1: G.u1, v0: G.v0, v1: G.v1 + 0.04 };
  [0.32, len - 0.36].forEach(a => wheel(back, a, shade(WOOD.dark, -18), '#3e3a35'));
  // 끌채 둘 — 앞(u1)에서 땅 쪽으로. 건너편 것을 먼저
  const shaft = v => { isoSeg(isoP(G.u1 - 0.1, v, C.bed + 2), isoP(G.u1 + 0.62, v, 5), WOOD.dark, 2); };
  shaft(G.v0 + 0.08);
  // 짐칸 — 나무 상자. 앞면에 널 이음과 쇠 띠
  isoCube(G.u0, G.v0, len, G.v1 - G.v0, C.bed, C.top, shade(body, 14), wallTex(body, 'L', 'wood', 83), shade(body, -28));
  faceRect(G, 'L', 0, len, C.bed, C.bed + 1, shade(body, -30));
  [0.06, len / 2, len - 0.1].forEach(a => { faceRect(G, 'L', a, a + 0.05, C.bed, C.top, shade(body, -36)); const q = faceMid(G, 'L', a + 0.025, C.top - 3); px(Math.round(q.x), Math.round(q.y), 1, 1, '#e0dcd2'); });
  // 포장, 열린 앞쪽 — 속은 어둡고 물건(항아리·두루마리·보따리)이 내다본다
  const H = pedHood(G, C.top);
  { const pts = []; for (let i = 0; i <= 16; i++){ const q = isoP(...H.at(G.u1, i / 16 * Math.PI)); pts.push([q.x, q.y]); } polyFill(pts, '#2a1d2c'); }
  isoDrum(G.u1 - 0.12, H.cv - 0.12, 0.09, C.top, C.top + 9, '#c8643a', '#e08458');                                      // 항아리
  isoDrum(G.u1 - 0.12, H.cv + 0.14, 0.08, C.top, C.top + 6, '#4f8fd0', '#7cb2e6');                                      // 단지
  ibox(G.u1 - 0.2, H.cv - 0.02, 0.14, 0.12, C.top, C.top + 13, '#d9a93a');                                             // 세운 두루마리
  [0, 1].forEach(e => { const u = e ? G.u1 : G.u0 + 0.02; for (let i = 0; i < 16; i++) isoSeg(isoP(...H.at(u, i / 16 * Math.PI)), isoP(...H.at(u, (i + 1) / 16 * Math.PI)), PED_CART.rim, 2); });
  // 앞 테에 매단 등불
  { const q = isoP(G.u1 + 0.02, H.cv + 0.1, C.top + C.hood - 4), x = Math.round(q.x), y = Math.round(q.y);
    px(x, y, 1, 4, '#3a2a1f'); px(x - 2, y + 4, 5, 1, '#3a2a1f'); px(x - 2, y + 5, 5, 6, '#ffcf5a'); px(x - 1, y + 6, 3, 4, '#fff1b0'); px(x - 2, y + 11, 5, 1, '#3a2a1f');
    lamp(x + 0.5, y + 8, 22); }
  [0.32, len - 0.36].forEach(a => wheel(front, a, WOOD.dark, '#4a4540'));
  shaft(G.v1 - 0.08);
  isoSeg(isoP(G.u1 + 0.6, G.v0 + 0.08, 6), isoP(G.u1 + 0.6, G.v1 - 0.08, 6), WOOD.low, 2);                              // 끌채 끝 가로대
}
function drawPeddlerIso(P, t){
  const s = npcIdle(t, 'ped'), at = pedKeeperAt(P), q = isoP(at.u + s.off * 0.15, at.v), fr = PEDKEEP[s.frame];
  art(fr, Math.round(q.x) - (fr[0].length >> 1), Math.round(q.y) - fr.length + 2 - s.bob, PEDPAL, s.dir > 0);
}
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
// 칸을 넘는 큰 무늬 자리(칸 단위 가운데·반지름) — 흙이 드러난 자리와 클로버 자리. 아이소 섬도 같은 자리를 쓴다.
const DRY_PATCH = [[3.4, 6.6, 1.9, 1.2], [12.8, 3.4, 1.6, 1.0], [7.6, 14.4, 2.2, 1.1], [16.4, 12.8, 1.7, 1.3]];
const CLOVER_PATCH = [[5.6, 3.0, 1.6, 1.1], [15.6, 7.8, 2.0, 1.3], [10.4, 15.0, 1.8, 1.0], [1.6, 13.4, 1.4, 1.0]];
function drawGround(season){
  const P = groundPal(season), Wp = COLS * T, Hp = ROWS * T, LK = farmLook() || {};
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
    if (r0 > (LK.pebble || 0.93)){
      px(X + 11, Y + 17, 10, 8, P.ink);
      px(X + 12, Y + 18, 8, 5, P.rock);
      px(X + 12, Y + 18, 5, 2, shade(P.rock, 22));
      px(X + 13, Y + 21, 7, 2, shade(P.rock, -26));
    }
    const bloomP = (season === 'spring' ? 0.2 : season === 'summer' ? 0.14 : season === 'autumn' ? 0.07 : 0) * (LK.bloomX || 1);
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
  DRY_PATCH.forEach((w, i) => patch(w[0] * T, w[1] * T, w[2] * T, w[3] * T, 101 + i, (x, y, d) => {
      if (d > 0.55 && hash2(x, y, 66) > 0.45) return;          // 가장자리는 성글게 흩어진다
      const r = hash2(x, y, 77);
      if (r > 0.9925){ px(x, y, 4, 2, P.rock); px(x, y + 2, 4, 2, shade(P.rock, -22)); return; }   // 드러난 조약돌
      if (r > 0.985 && season !== 'winter'){ px(x, y, 2, 5, P.tuft[1]); px(x + 2, y - 2, 2, 7, P.tuft[0]); return; }  // 뚫고 난 풀
      px(x, y, 1, 1, r > 0.92 ? shade(P.dry, -12) : r < 0.08 ? shade(P.dry, 9) : P.dry);
    }));
  if (season !== 'winter') CLOVER_PATCH.forEach((w, i) => patch(w[0] * T, w[1] * T, w[2] * T, w[3] * T, 201 + i, (x, y, d) => {
      if (d > 0.5 && hash2(x, y, 88) > 0.4) return;
      const r = hash2(x, y, 99);
      if (r > 0.66) px(x, y, 1, 1, shade(P.tuft[0], r > 0.9 ? 14 : -12));   // 클로버 잎
    }));
}
// 흙길 — 집 앞에서 밭까지, 그리고 목장까지
/* 길은 먼저 「어느 칸을 지나는가」만 모아 두고, 그다음에 칸마다 이웃을 보고 그린다.
   전에는 칸마다 가로 띠(y+8..y+24)만 깔아서, 세로로 내려가는 길은 띠 사이가 벌어져
   토막토막 끊겨 보였다. 이웃이 있는 쪽으로 끝까지 채우면 모퉁이까지 이어진다. */
function pathCells(){
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
  return cells;
}
function drawPath(season){
  const c = season === 'winter' ? ['#dcd6c8', '#cfc7b6', '#e6e0d3'] : ['#e0cfa8', '#d2bf95', '#ece0bf'];
  const edge = season === 'winter' ? '#c6bfae' : '#c2ac7e';        // 밟혀 다져진 가장자리
  const P = groundPal(season);
  const cells = pathCells();
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
/* 한 도트 단위로 그린다. 잎은 끝이 뾰족한 날(위쪽 날은 밝게·아래는 그늘·가운데 잎맥), 열매는 왼쪽 위에서
   빛을 받는 타원이다. 예전에는 두 도트 네모를 쌓아 옥수수·포도가 막대와 덩이로 뭉개져 보였다.
   바람(sway)은 높이에 따라 휜다 — 땅에 붙은 데는 그대로, 꼭대기일수록 많이. 지주는 안 흔들린다.
   도트가 많아 한 포기를 그릴 때 드는 값이 크다 — 밭에서는 cropAt 으로 담아 두고 얹기만 한다. */
const noInk = c => c.length === 7 ? c + 'ff' : c;       // 가는 줄(수염·덩굴손·잎자루)은 테를 두르면 까만 줄이 된다
const cropPal = c => ({ mid: c, hi: shade(c, 30), lt: shade(c, 14), dk: shade(c, -30), vein: shade(c, -16) });
const WOOD_STAKE = { mid: '#a87848', hi: '#c89a64', dk: '#6f4a2c' };
function cropPen(put, bend){
  const dot = (x, y, c) => put(Math.round(x + bend(y)), Math.round(y), 1, 1, c);
  const pen = { dot, put };
  pen.line = (x0, y0, x1, y1, c) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
  };
  // 잎 한 장 — (x,y) 에서 (dx,dy) 쪽으로 len, 가장 넓은 데 반폭 w. droop 만큼 끝이 아래로 휜다.
  // o.vein: 잎맥 색(false 면 없음) · o.frill: 가장자리를 오글오글하게(케일·무청)
  pen.leaf = (x, y, dx, dy, len, w, g, droop, o) => {
    o = o || {};
    let m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m, qx = x, qy = y;
    const pts = [];
    for (let t = 0; t <= len; t += 0.5){
      pts.push([qx, qy, ux, uy, t / len]);
      uy += (droop || 0) / (len * 2); m = Math.hypot(ux, uy); ux /= m; uy /= m;
      qx += ux * 0.5; qy += uy * 0.5;
    }
    for (const [ax, ay, vx, vy, f] of pts){
      let nx = -vy, ny = vx;
      if (ny > 0 || (ny === 0 && nx > 0)){ nx = -nx; ny = -ny; }             // n 은 늘 위(빛 받는 쪽)
      let hw = w * Math.pow(Math.sin(Math.PI * (0.06 + f * 0.94)), 0.8);
      if (o.frill) hw += Math.sin(f * len * 2.4) * 0.7 * Math.min(1, hw);
      for (let k = -hw; k <= hw + 0.01; k += 0.5) dot(ax + nx * k, ay + ny * k, k > hw * 0.3 ? g.hi : k < -hw * 0.4 ? g.dk : g.mid);
    }
    const vc = o.vein === undefined ? g.vein : o.vein;
    if (vc && w >= 1.2) for (const [ax, ay, , , f] of pts) if (f > 0.08 && f < 0.8) dot(ax, ay, vc);
  };
  // 열매·덩이 — 오른쪽 아래와 가장자리는 그늘, 왼쪽 위에 윤 한 점. pat(i,j,u,v,c) 로 줄무늬·골을 덧칠한다.
  pen.egg = (x, y, rx, ry, f, pat) => {
    const X0 = Math.ceil(rx), Y0 = Math.ceil(ry);
    for (let j = -Y0; j <= Y0; j++) for (let i = -X0; i <= X0; i++){
      const u = i / rx, v = j / ry, d = u * u + v * v;
      if (d > 1.12) continue;
      const l = (u + v) * 0.7 + d * 0.5;
      let c = l > 0.95 ? f.dk : l < -0.35 ? f.lt : f.mid;
      if (pat) c = pat(i, j, u, v, c, d) || c;
      dot(x + i, y + j, c);
    }
    if (f.hi && rx >= 1.5) dot(x - Math.max(1, Math.round(rx * 0.45)), y - Math.max(1, Math.round(ry * 0.45)), f.hi);
  };
  pen.berry = (x, y, f) => { dot(x, y, f.hi); dot(x + 1, y, f.mid); dot(x, y + 1, f.mid); dot(x + 1, y + 1, f.dk); };
  // 글자 판 — 꽃송이처럼 모양이 딱 정해진 작은 것
  pen.map = (x, y, rows, key) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++){ const c = key[r[i]]; if (c) dot(x + i, y + j, c); } });
  // 지주 — 바람에 안 흔들린다
  pen.stake = (x, top, base, W) => {
    W = W || WOOD_STAKE;
    put(x, top, 1, base - top + 1, W.hi); put(x + 1, top, 1, base - top + 1, W.dk); put(x, top, 2, 1, W.mid);
  };
  return pen;
}
// 호박·수박·참외 열매 — 큰 호박(두 칸)도 같이 쓴다
function melonFruit(k, crop, x, y, rx, ry, F){
  if (crop === 'watermelon') k.egg(x, y, rx, ry, cropPal('#93cf66'), (i, j, u, v, c, d) => d < 0.95 && (((j + Math.round(Math.sin(i * 0.9) * 1.2)) % 3) + 3) % 3 === 0 ? (d > 0.6 ? '#1f4f26' : '#2a6a30') : null);   // 밝은 바탕에 짙은 물결 줄
  else if (crop === 'pumpkin') k.egg(x, y, rx, ry, F, (i, j, u, v, c, d) => d < 0.9 && Math.abs(u) < 0.86 && ((Math.round(i * (1 - v * v * 0.25)) % 3) + 3) % 3 === 0 ? F.dk : null);
  else k.egg(x, y, rx, ry, F, (i, j, u, v, c, d) => d < 0.8 && (((j % 2) + 2) % 2) === 0 && Math.abs(v) < 0.8 ? mix(c, '#fff6d0', 0.55) : null);
  const top = y - Math.round(ry);
  if (crop === 'pumpkin'){ k.dot(x, top - 1, '#7a5a2a'); k.dot(x, top - 2, '#8a6a34'); k.dot(x + 1, top - 3, '#6a4a22'); }
  else k.dot(x - Math.round(rx) + 1, y - 1, '#6f4a2c');
}
const CROP_ART = {
  // ---- 키 큰 것 ----
  corn(k){
    const { cx, base, G, F, dot, line, leaf, egg } = k, top = base - 24;
    for (let y = base; y >= top; y--){                                        // 대 — 두 도트, 마디마다 밝은 띠
      const node = (base - y) % 5 === 4;
      dot(cx, y, node ? G.hi : G.mid); dot(cx + 1, y, node ? G.vein : G.dk);
    }
    leaf(cx, base - 4, -1, -0.8, 12, 1.5, G, 1.7);
    leaf(cx + 1, base - 8, 1, -0.9, 12, 1.5, G, 1.7);
    leaf(cx, base - 12, -1, -1.1, 11, 1.4, G, 1.6);
    leaf(cx + 1, base - 16, 1, -1.2, 10, 1.4, G, 1.6);
    leaf(cx, base - 20, -0.7, -1, 8, 1.2, G, 1.4);
    leaf(cx + 1, base - 22, 0.6, -1, 7, 1.1, G, 1.3);
    const ts = cropPal('#d9c27e');                                            // 개꼬리(수이삭)
    line(cx, top, cx, top - 4, ts.mid); dot(cx, top - 4, ts.hi); dot(cx + 1, top - 1, ts.dk);
    line(cx, top - 2, cx - 3, top - 1, noInk(ts.mid)); line(cx + 1, top - 2, cx + 4, top - 1, noInk(ts.dk));
    line(cx, top - 3, cx - 2, top - 5, noInk(ts.hi)); line(cx + 1, top - 3, cx + 3, top - 5, noInk(ts.mid));
    if (!k.ripe) return;
    const hx = cx + 4, hy = base - 13, H = cropPal('#b9d68e');                // 이삭 — 껍질이 벌어져 알이 보인다
    egg(hx, hy, 2.4, 5, H);
    for (let j = -5; j <= 1; j++) for (let i = -1; i <= 1; i++){
      if (j === -5 && i !== 0) continue;
      dot(hx + i, hy + j, i === 1 ? F.dk : ((i + j) & 1) ? F.mid : F.hi);
    }
    leaf(hx - 1, hy + 4, -0.3, -1, 6, 1, H, 0, { vein: false });
    leaf(hx + 2, hy + 4, 0.35, -1, 5, 1, H, 0, { vein: false });
    line(hx, hy - 6, hx + 2, hy - 9, noInk('#a8642e')); line(hx - 1, hy - 6, hx - 2, hy - 8, noInk('#c4843e')); dot(hx + 1, hy - 7, noInk('#8a4e22'));
    line(hx - 2, hy + 5, cx + 1, hy + 7, H.dk);
  },
  // ---- 덩굴 ----
  grape(k){
    const { cx, base, G, F, dot, line, egg, berry, stake, put } = k, V = cropPal('#8a5f3a');
    stake(cx + 9, base - 24, base);
    put(cx - 11, base - 22, 22, 1, noInk('#b8b0a0'));                          // 철사
    for (let y = base; y >= base - 21; y--){ const x = cx - 1 + Math.round(Math.sin(y * 0.55) * 0.8); dot(x, y, V.mid); dot(x + 1, y, V.dk); if ((y & 3) === 0) dot(x, y, V.hi); }
    line(cx - 10, base - 21, cx + 9, base - 21, V.mid); line(cx - 9, base - 20, cx + 8, base - 20, V.dk);   // 철사를 따라 뻗은 팔
    const vleaf = (x, y, r) => {                                              // 갈래진 포도잎 — 세 덩이에 잎맥
      egg(x - r * 0.8, y + 1, r * 0.62, r * 0.55, G); egg(x + r * 0.8, y + 1, r * 0.62, r * 0.55, G); egg(x, y, r * 0.75, r * 0.7, G);
      line(x, y + r * 0.6, x, y - r * 0.5, G.vein); line(x, y + r * 0.6, x - r * 0.8, y, G.vein); line(x, y + r * 0.6, x + r * 0.8, y, G.vein);
    };
    [[-8, -24, 3.2], [-2, -26, 3.4], [4, -25, 3.2], [9, -26, 3], [-6, -18, 2.6], [6, -19, 2.8], [-11, -20, 2.4]].forEach(([a, b, r]) => vleaf(cx + a, base + b, r));
    line(cx + 3, base - 22, cx + 5, base - 24, noInk(G.dk)); dot(cx + 6, base - 24, noInk(G.dk)); dot(cx + 6, base - 23, noInk(G.dk));   // 덩굴손
    if (!k.ripe) return;
    const bunch = (x, y, n) => {
      line(x, y - 2, x, y, noInk(V.dk));
      [n, n - 1, n - 1, n - 2, 1].forEach((m, r) => { for (let i = 0; i < m; i++) berry(x - m + 1 + i * 2, y + 1 + r * 2, F); });
    };
    bunch(cx - 6, base - 19, 4); bunch(cx + 4, base - 18, 4); bunch(cx - 1, base - 15, 3);
  },
  pea(k){
    const { cx, base, G, F, dot, leaf, stake } = k;
    stake(cx, base - 26, base, cropPal('#c8b070'));
    let px0 = cx;
    for (let y = base; y >= base - 25; y--){                                  // 지주를 감고 오르는 줄기
      const x = cx + Math.round(Math.sin((base - y) * 0.45) * 2.4);
      dot(x, y, G.dk);
      if ((base - y) % 5 === 3){
        leaf(x, y, -1, -0.4, 3.6, 1.3, G, 0.5); leaf(x, y, 1, -0.4, 3.6, 1.3, G, 0.5);
        if ((base - y) % 10 === 8){ dot(x + 3, y - 3, noInk(G.dk)); dot(x + 4, y - 4, noInk(G.dk)); dot(x + 5, y - 4, noInk(G.dk)); dot(x + 5, y - 3, noInk(G.dk)); }
      }
      px0 = x;
    }
    leaf(px0, base - 25, 0.2, -1, 3, 1.1, G, 0.2);
    if (k.stage === 3) [[-4, -14], [4, -20]].forEach(([a, b]) => { dot(cx + a, base + b, '#f4ecff'); dot(cx + a + 1, base + b, '#c9a0e6'); dot(cx + a, base + b + 1, '#dcc4f2'); });
    if (!k.ripe) return;
    const pod = (x, y, len) => {                                              // 꼬투리 — 알이 든 자리마다 불룩
      dot(x, y - 1, noInk(G.dk));
      for (let t = 0; t <= len; t++){ const xx = x + Math.round(t * 0.18); dot(xx, y + t, t % 2 && t < len ? F.hi : F.mid); dot(xx + 1, y + t, F.dk); }
    };
    pod(cx - 6, base - 17, 7); pod(cx + 4, base - 13, 6); pod(cx - 4, base - 8, 5); pod(cx + 5, base - 22, 5);
  },
  cucumber(k){
    const { cx, base, G, dot, line, egg, stake } = k, F = cropPal('#3a7a30');
    stake(cx, base - 25, base, cropPal('#c8b070'));
    for (let y = base; y >= base - 24; y--) dot(cx + Math.round(Math.sin((base - y) * 0.4) * 2.2), y, G.dk);
    const heart = (x, y, r) => { egg(x, y, r, r * 0.85, G); dot(x, y + Math.round(r * 0.85) + 1, G.dk); line(x, y + r * 0.6, x, y - r * 0.4, G.vein); };
    [[-6, -22, 3], [5, -20, 3.2], [-7, -13, 3.2], [6, -11, 3], [-4, -5, 2.8], [4, -26, 2.4]].forEach(([a, b, r]) => heart(cx + a, base + b, r));
    dot(cx + 3, base - 16, noInk(G.dk)); dot(cx + 4, base - 17, noInk(G.dk)); dot(cx + 4, base - 18, noInk(G.dk));
    const bloom = (x, y) => { dot(x, y, '#ffe066'); dot(x - 1, y, '#ffd23a'); dot(x + 1, y, '#ffd23a'); dot(x, y - 1, '#fff3a0'); };
    if (k.stage === 3){ bloom(cx - 2, base - 17); bloom(cx + 3, base - 8); return; }
    [[-4, -15, 4.8], [4, -9, 4.4]].forEach(([a, b, r]) => {                      // 오이 — 가늘고 긴, 오돌토돌한 가시. 잎 속에서도 보이게 짙은 테
      const x = cx + a, y = base + b;
      egg(x, y, 2, r, F, (i, j, u, v, c, d) => d > 0.8 ? '#1f4a1c' : ((i + j * 2) % 3 + 3) % 3 === 0 && Math.abs(v) < 0.8 ? F.hi : null);
      dot(x, y - Math.round(r) - 1, noInk(G.dk)); bloom(x, y + Math.round(r) + 1);
    });
  },
  // ---- 땅에 퍼지는 박 ----
  melon(k){
    const { cx, base, G, F, dot, line, egg } = k;
    line(cx - 12, base - 2, cx + 12, base - 3, G.dk);                            // 땅을 기는 덩굴
    const vleaf = (x, y, r) => {
      egg(x - r * 0.7, y + 1, r * 0.6, r * 0.5, G); egg(x + r * 0.7, y + 1, r * 0.6, r * 0.5, G); egg(x, y, r * 0.72, r * 0.62, G);
      line(x, y + r * 0.5, x, y - r * 0.4, G.vein); line(x, y + r * 0.5, x - r * 0.7, y, G.vein); line(x, y + r * 0.5, x + r * 0.7, y, G.vein);
    };
    [[-9, -6, 3.4], [8, -7, 3.4], [-3, -10, 3.6], [4, -12, 3.2], [-12, -2, 2.6], [12, -3, 2.6]].forEach(([a, b, r]) => vleaf(cx + a, base + b, r));
    [[-6, -2], [9, -12]].forEach(([a, b]) => { dot(cx + a, base + b, noInk(G.dk)); dot(cx + a + 1, base + b - 1, noInk(G.dk)); dot(cx + a + 2, base + b - 1, noInk(G.dk)); dot(cx + a + 2, base + b, noInk(G.dk)); });
    if (k.stage === 3){ dot(cx - 1, base - 6, '#ffe066'); dot(cx - 2, base - 6, '#ffd23a'); dot(cx, base - 6, '#ffd23a'); dot(cx - 1, base - 7, '#fff3a0'); return; }
    melonFruit(k, k.crop, cx, base - 5, k.crop === 'melon' ? 5.5 : 7.5, k.crop === 'melon' ? 4 : 5.2, F);
  },
  // ---- 뿌리 ----
  radish(k){
    const { cx, base, G, F, egg } = k, Gv = { ...G, vein: shade(G.mid, 34) };
    if (k.ripe) egg(cx, base - 2, 3.6, 3.2, F, (i, j, u, v, c) => v < -0.2 ? mix(c, G.mid, 0.45) : null);   // 어깨 — 위가 푸르다
    [[-1, -0.5, 8], [-0.6, -1, 10], [0, -1, 11], [0.55, -1, 10], [1, -0.45, 8]].forEach(([dx, dy, l]) => k.leaf(cx, base - 4, dx, dy, l, 1.8, Gv, 0.7, { frill: true }));
  },
  carrot(k){
    const { cx, base, G, F, dot, egg } = k;
    if (k.ripe) egg(cx, base - 1, 2.8, 2.4, F, (i, j, u, v, c) => (j & 1) && Math.abs(u) < 0.8 ? F.dk : null);
    [[-0.8, -1, 10], [-0.35, -1, 12], [0, -1, 13], [0.35, -1, 12], [0.8, -1, 10]].forEach(([dx, dy, l]) => {   // 깃털잎 — 가는 잎자루에 잘게 갈라진 잎
      const m = Math.hypot(dx, dy), ux = dx / m, uy = dy / m;
      for (let t = 0; t <= l; t++){
        const x = cx + ux * t + ux * t * t * 0.02, y = base - 3 + uy * t + t * t * 0.012;
        dot(x, y, noInk(G.dk));
        if (t > 2 && t % 2 === 0){ const nx = -uy, ny = ux; dot(x + nx, y + ny, G.mid); dot(x + nx * 2, y + ny * 2 - 1, G.hi); dot(x - nx, y - ny, G.mid); dot(x - nx * 2, y - ny * 2 - 1, G.lt); }
      }
    });
  },
  potato(k){
    const { cx, base, F, dot, line, egg } = k;
    const G = k.ripe ? cropPal(mix(k.G.mid, '#c8b060', 0.15)) : k.G;
    if (k.ripe) [[-8, 0, 2.4], [7, 0, 2.2], [-1, 1, 2]].forEach(([a, b, r]) => egg(cx + a, base + b - 1, r, r * 0.72, F, (i, j) => (i === 0 && j === 0) || (i === 1 && j === -1) ? F.dk : null));
    line(cx, base, cx - 5, base - 12, G.dk); line(cx, base, cx + 5, base - 13, G.dk); line(cx, base, cx, base - 16, G.dk);
    const comp = (x, y, d) => { k.leaf(x, y, d, -0.5, 4, 1.5, G, 0.5); k.leaf(x, y, -d * 0.3, -1, 3.5, 1.4, G, 0.3); k.leaf(x, y + 1, d, 0.3, 3, 1.2, G, 0.4); };
    comp(cx - 5, base - 12, -1); comp(cx + 5, base - 13, 1); comp(cx, base - 16, -1); comp(cx - 3, base - 6, -1); comp(cx + 3, base - 7, 1); comp(cx + 1, base - 16, 1);
    if (k.stage === 3) [[-4, -18], [4, -17], [0, -20]].forEach(([a, b]) => { const x = cx + a, y = base + b; dot(x - 1, y, '#f6f2fa'); dot(x + 1, y, '#f6f2fa'); dot(x, y - 1, '#f6f2fa'); dot(x, y + 1, '#dcd2ea'); dot(x, y, '#ffd23a'); });
  },
  sweetpotato(k){
    const { cx, base, G, F, dot, line, egg } = k, vine = '#9a4a6a';
    if (k.ripe) [[-5, 0, 3.2], [5, 0, 2.8]].forEach(([a, b, r]) => egg(cx + a, base + b - 1, r, 1.8, F, (i, j) => j === -1 && (i & 1) ? F.hi : null));
    line(cx - 12, base - 2, cx + 12, base - 4, vine); line(cx, base, cx - 3, base - 12, vine); line(cx, base, cx + 4, base - 10, vine);
    const heart = (x, y, r) => { k.egg(x, y, r, r * 0.85, G); dot(x, y + Math.round(r * 0.85) + 1, G.dk); dot(x, y - Math.round(r * 0.85), G.dk); line(x, y + r * 0.6, x, y - r * 0.3, G.vein); };
    [[-10, -5, 2.6], [10, -7, 2.6], [-4, -13, 2.8], [4, -11, 2.8], [-1, -7, 2.6], [-7, -9, 2.2], [7, -3, 2.2]].forEach(([a, b, r]) => heart(cx + a, base + b, r));
  },
  onion(k){
    const { cx, base, G, F, line, egg } = k, fl = k.ripe ? 1.8 : 0.5;
    if (k.ripe){
      egg(cx, base - 3, 4, 3.4, F, (i, j, u, v, c) => i % 2 === 0 && Math.abs(u) < 0.8 && v > -0.7 ? F.vein : null);   // 알 — 얇은 껍질 결
      line(cx - 1, base - 6, cx, base - 9, F.dk); line(cx, base + 1, cx - 2, base + 2, noInk('#e8dcc0')); line(cx + 1, base + 1, cx + 2, base + 2, noInk('#e8dcc0'));
    }
    [[-0.35, -1, 12], [0.1, -1, 13], [0.5, -1, 11], [-0.8, -0.8, 9], [0.9, -0.7, 9]].forEach(([dx, dy, l]) => k.leaf(cx, base - (k.ripe ? 7 : 2), dx, dy, l, 1.1, G, fl, { vein: false }));
  },
  // ---- 잎 뭉치 ----
  cabbage(k){
    const { cx, base, G, F, egg, leaf } = k, Gd = cropPal(shade(G.mid, -30)), Gv = { ...Gd, vein: shade(G.mid, 30) };
    const r = k.ripe ? 5.4 : 3.8, hy = base - 7 - (k.ripe ? 1 : 0);
    [[-1, 0.25, 9], [1, 0.25, 9], [-1, -0.3, 10], [1, -0.3, 10]].forEach(([dx, dy, l]) => leaf(cx, base - 4, dx, dy, l, 3.4, Gv, 0.6));   // 땅에 퍼진 겉잎 — 짙게, 잎맥은 희게
    egg(cx, base - 6, r + 1.6, (r + 1.6) * 0.78, Gd);                                                                               // 속을 받친 그늘진 잎
    [[-0.8, -1], [0.8, -1]].forEach(([dx, dy]) => leaf(cx + dx * 3, base - 3, dx, dy, r + 3, 2.4, { ...G, vein: shade(G.mid, 36) }, 0.9)); // 속을 감싸 오른 잎
    const seam = shade(F.mid, -42);
    egg(cx, hy, r, r * 0.9, F, (i, j, u, v) => {                                  // 속 — 겹겹이 감싼 잎의 이음매가 둥글게
      const a = u - (-0.3 + 0.3 * v * v), b = u - (0.35 - 0.25 * v * v);
      if (Math.abs(a) < 0.13 && v > -0.75) return seam;
      if (a > 0.13 && a < 0.3 && v > -0.6 && v < 0.5) return F.hi;
      if (Math.abs(b) < 0.13 && v > -0.55) return seam;
      return null;
    });
  },
  napa(k){
    const { cx, base, G, F, line, egg } = k, Gv = { ...G, vein: shade(G.mid, 36) };
    [[-1, -0.1, 8], [1, -0.1, 8], [-0.8, -0.7, 8], [0.8, -0.7, 8]].forEach(([dx, dy, l]) => k.leaf(cx, base - 3, dx, dy, l, 2.8, Gv, 0.6));
    const ry = k.ripe ? 10 : 7, pale = cropPal('#f1f4d8');
    egg(cx, base - ry, 4.4, ry, pale, (i, j, u, v, c) => {                        // 아래는 흰 줄기, 위는 오글오글한 연두 잎
      if (v < -0.2) return ((i + j) & 1) && u * u + v * v > 0.55 ? F.dk : u > 0.4 ? F.vein : F.mid;
      if (i === -2 || i === 1) return shade(c, -18);
      return null;
    });
    line(cx, base - 2, cx, base - ry, pale.hi);
  },
  lettuce(k){
    // 상추 — 땅에 퍼진 짙은 겉잎 위로 연한 속잎이 오글오글 솟는다
    const { cx, base, G, F } = k, l = k.ripe ? 1 : 0.8, Go = cropPal(shade(G.mid, -20)), fr = { frill: true };
    [[-1, 0.1], [1, 0.1], [-1, -0.45], [1, -0.45]].forEach(([dx, dy]) => k.leaf(cx, base - 3, dx, dy, 9 * l, 3, { ...Go, vein: shade(Go.mid, 30) }, 0.7, fr));
    [[-0.55, -1, 7], [0.55, -1, 7], [-0.1, -1, 8.5]].forEach(([dx, dy, n], i) => k.leaf(cx + (i - 1), base - 3, dx, dy, n * l, 2.8, { ...(i === 2 ? F : G), vein: shade(F.mid, 30) }, 0.4, fr));
  },
  spinach(k){
    const { cx, base, G, line, leaf, dot } = k, s = k.ripe ? 1 : 0.85;
    [[-0.9, 0.1], [0.9, 0.1], [-1, -0.4], [1, -0.4], [-0.55, -1], [0.55, -1], [0, -1]].forEach(([dx, dy]) => {
      const m = Math.hypot(dx, dy), ux = dx / m, uy = dy / m;
      line(cx, base - 1, cx + ux * 3, base - 1 + uy * 3, noInk(G.dk));           // 잎자루
      leaf(cx + ux * 3, base - 1 + uy * 3, ux, uy, 7 * s, 2 * s, G, 0.3);
      dot(cx + ux * 6, base - 1 + uy * 6 - 1, G.hi);                              // 반들반들한 윤
    });
  },
  kale(k){
    const { cx, base, G } = k, Gv = { ...G, vein: shade(G.mid, 34) }, l = k.ripe ? 12 : 10;
    [[-1, -0.5], [1, -0.5], [-0.6, -1], [0.6, -1], [0, -1]].forEach(([dx, dy], i) => k.leaf(cx, base - 2, dx, dy, l - (i === 4 ? 1 : 0), 2.4, Gv, 0.5, { frill: true }));
  },
  // ---- 떨기 ----
  tomato(k){
    const { cx, base, G, F, dot, line, leaf, egg, stake } = k;
    stake(cx + 3, base - 24, base);
    line(cx, base, cx + 1, base - 8, G.dk); line(cx + 1, base - 8, cx, base - 15, G.dk); line(cx, base - 15, cx + 1, base - 22, G.dk);
    const sprig = (x, y, d) => { leaf(x, y, d, -0.6, 5, 1.5, G, 0.9); leaf(x + d * 2, y - 1, d * 0.4, -1, 3.5, 1.2, G, 0.3); leaf(x + d * 3, y + 1, d, 0.2, 3, 1.1, G, 0.6); };
    sprig(cx, base - 5, -1); sprig(cx + 1, base - 9, 1); sprig(cx, base - 13, -1); sprig(cx + 1, base - 17, 1); sprig(cx, base - 20, -1);
    leaf(cx + 1, base - 22, 0.2, -1, 4, 1.2, G, 0.2);
    if (k.stage === 3){ [[-5, -12], [6, -16]].forEach(([a, b]) => { const x = cx + a, y = base + b; dot(x, y, '#ffe066'); dot(x - 1, y, '#ffd23a'); dot(x + 1, y, '#ffd23a'); dot(x, y - 1, '#fff3a0'); dot(x, y + 1, '#e0b020'); }); return; }
    [[-5, -9, 2.6, F], [6, -13, 2.4, F], [-3, -17, 2.2, cropPal(mix(F.mid, '#f0a030', 0.5))]].forEach(([a, b, r, f]) => {
      const x = cx + a, y = base + b; egg(x, y, r, r * 0.92, f);
      const t = y - Math.round(r * 0.92);                                          // 꼭지 — 초록 별
      dot(x, t - 1, noInk(G.dk)); dot(x - 1, t, G.mid); dot(x, t, G.dk); dot(x + 1, t, G.mid);
    });
  },
  strawberry(k){
    const { cx, base, G, F, dot, line, egg } = k;
    const tri = (x, y) => {                                                        // 세 쪽 잎 — 톱니 가장자리
      line(cx, base - 1, x, y + 2, noInk(G.dk));
      const saw = (i, j, u, v, c, d) => d > 0.6 && ((i + j) & 1) ? G.dk : null;
      egg(x - 2, y + 1, 1.8, 1.5, G, saw); egg(x + 2, y + 1, 1.8, 1.5, G, saw); egg(x, y - 1, 1.8, 1.7, G, saw);
      dot(x, y, G.vein);
    };
    [[-7, -7], [7, -8], [-3, -12], [3, -13], [0, -6]].forEach(([a, b]) => tri(cx + a, base + b));
    if (k.stage === 3){ [[-9, -3], [6, -3]].forEach(([a, b]) => { const x = cx + a, y = base + b; dot(x - 1, y, '#fbfbf2'); dot(x + 1, y, '#fbfbf2'); dot(x, y - 1, '#fbfbf2'); dot(x, y + 1, '#e8e8dc'); dot(x, y, '#ffd23a'); }); return; }
    const berryH = (x, y) => {                                                      // 딸기 — 아래로 뾰족, 씨가 박혔다
      [3, 4, 4, 3, 2, 1].forEach((w, r) => { for (let i = 0; i < w; i++){ const xx = x - (w >> 1) + i - (w & 1 ? 0 : 0); dot(xx, y + r, i === 0 ? F.hi : i === w - 1 && w > 1 ? F.dk : ((i + r) % 2 === 0 && r > 0 && r < 5) ? '#ffe38a' : F.mid); } });
      dot(x - 1, y - 1, G.mid); dot(x, y - 1, G.dk); dot(x + 1, y - 1, G.mid); dot(x - 2, y, G.dk); dot(x + 2, y, G.dk); dot(x, y - 2, noInk(G.dk));
    };
    berryH(cx - 8, base - 4); berryH(cx + 6, base - 5); berryH(cx - 1, base - 3);
  },
  blueberry(k){
    const { cx, base, G, F, line, leaf } = k, wood = '#7a4a3a';
    line(cx, base, cx - 6, base - 18, wood); line(cx, base, cx + 1, base - 22, wood); line(cx, base, cx + 7, base - 17, wood); line(cx - 3, base - 9, cx - 9, base - 12, wood);
    const pts = [[-6, -18], [1, -22], [7, -17], [-9, -12], [-3, -12], [4, -12], [-1, -16], [5, -20], [-7, -6], [6, -8]];
    pts.forEach(([a, b], i) => { const d = a < 0 ? -1 : 1; leaf(cx + a, base + b, d, -0.6 - (i % 3) * 0.2, 3.5, 1.3, G, 0.6); leaf(cx + a, base + b, -d * 0.3, -1, 3, 1.2, G, 0.3); });
    if (!k.ripe) return;
    const dust = { hi: '#c2cdf4', mid: F.mid, dk: F.dk };
    [[-6, -14], [3, -18], [6, -11], [-2, -9]].forEach(([a, b]) => [[0, 0], [2, 1], [-1, 2], [1, 3]].forEach(([i, j]) => k.berry(cx + a + i, base + b + j, dust)));
  },
  pepper(k){
    const { cx, base, G, F, dot, line, leaf } = k;
    line(cx, base, cx, base - 10, G.dk); line(cx, base - 10, cx - 5, base - 18, G.dk); line(cx, base - 10, cx + 5, base - 19, G.dk);
    [[-5, -18, -1, -0.6], [5, -19, 1, -0.6], [-5, -18, 0.2, -1], [5, -19, -0.2, -1], [0, -10, -1, -0.2], [0, -10, 1, -0.3], [0, -5, -1, -0.4], [0, -6, 1, -0.5], [-2, -14, -0.6, -1], [2, -15, 0.6, -1]]
      .forEach(([a, b, dx, dy]) => leaf(cx + a, base + b, dx, dy, 5, 1.7, G, 0.6));
    if (k.stage === 3){ [[-4, -12], [4, -14]].forEach(([a, b]) => { const x = cx + a, y = base + b; dot(x - 1, y, '#fbfbf2'); dot(x + 1, y, '#fbfbf2'); dot(x, y - 1, '#fbfbf2'); dot(x, y + 1, '#e6e6d6'); dot(x, y, '#ffd23a'); }); return; }
    const pod = (x, y, len, f) => {                                                // 고추 — 꼭지에서 가늘어지며 휜다
      dot(x, y - 2, noInk(G.dk)); dot(x, y - 1, G.mid); dot(x + 1, y - 1, G.dk);
      for (let t = 0; t <= len; t++){ const w = t < len * 0.55 ? 2 : 1, xx = x + Math.round(t * t * 0.03); dot(xx, y + t, w > 1 ? f.hi : f.mid); if (w > 1) dot(xx + 1, y + t, f.dk); }
    };
    pod(cx - 5, base - 16, 7, F); pod(cx + 4, base - 17, 7, F); pod(cx - 1, base - 11, 6, F); pod(cx + 7, base - 12, 6, cropPal('#4f9a3a'));
  },
  eggplant(k){
    const { cx, base, G, F, dot, line, leaf, egg } = k, st = '#5f4470';
    line(cx, base, cx, base - 16, st); line(cx, base - 9, cx - 5, base - 14, st); line(cx, base - 11, cx + 5, base - 15, st);
    leaf(cx, base - 4, -1, -0.4, 8, 2.6, G, 1.1); leaf(cx, base - 6, 1, -0.5, 8, 2.6, G, 1.1);
    leaf(cx - 5, base - 14, -0.7, -1, 7, 2.3, G, 0.9); leaf(cx + 5, base - 15, 0.7, -1, 7, 2.3, G, 0.9); leaf(cx, base - 16, 0, -1, 5, 1.8, G, 0.4);
    if (k.stage === 3){ [[-6, -12], [5, -10]].forEach(([a, b]) => { const x = cx + a, y = base + b; dot(x - 1, y, '#b890e0'); dot(x + 1, y, '#b890e0'); dot(x, y - 1, '#cfb0f0'); dot(x, y + 1, '#9870c8'); dot(x, y, '#ffd23a'); }); return; }
    [[-4, -8], [5, -9]].forEach(([a, b]) => {                                      // 가지 — 반들반들한 긴 열매, 가시 돋은 초록 갓
      const x = cx + a, y = base + b;
      egg(x, y, 2.2, 4.6, F, (i, j, u, v) => i === -1 && v > -0.5 && v < 0.35 ? F.hi : null);
      const t = y - 5;
      for (let i = -2; i <= 2; i++) dot(x + i, t, i ? G.mid : G.dk);
      dot(x - 2, t + 1, G.dk); dot(x + 2, t + 1, G.dk); dot(x, t - 1, noInk(st));
    });
  },
  // ---- 꽃 ----
  tulip(k){
    const { cx, base, G, F, line, leaf, egg } = k;
    leaf(cx, base - 1, -0.7, -1, 10, 2.2, G, 0.6); leaf(cx + 1, base - 1, 0.8, -1, 9, 2, G, 0.7);
    line(cx, base, cx, base - 18, G.dk); line(cx + 1, base - 2, cx + 1, base - 17, shade(G.dk, -10));
    if (k.stage === 3){ egg(cx, base - 20, 1.6, 2.8, cropPal(mix(F.mid, G.mid, 0.55))); k.dot(cx, base - 23, F.mid); return; }
    k.map(cx - 3, base - 25, ['h..h..m', 'hl.hm.d', 'hlmhmdd', 'hlmmmdd', 'hlmmmdd', '.hmmmd.', '..mdd..'], { h: F.hi, l: F.lt, m: F.mid, d: F.dk });
  },
  sunflower(k){
    const { cx, base, G, F, line, leaf, egg } = k;
    line(cx, base, cx, base - 19, G.dk); line(cx + 1, base, cx + 1, base - 19, shade(G.dk, -12));
    leaf(cx, base - 6, -1, -0.3, 7, 2.6, G, 1); leaf(cx + 1, base - 9, 1, -0.3, 7, 2.6, G, 1);
    leaf(cx, base - 14, -1, -0.6, 6, 2.2, G, 0.9); leaf(cx + 1, base - 16, 1, -0.7, 5, 2, G, 0.8);
    const hx = cx + 1, hy = base - 23;
    if (k.stage === 3){ egg(hx, hy, 2.4, 2, G); k.dot(hx - 1, hy - 2, F.mid); k.dot(hx + 1, hy - 2, F.mid); return; }
    for (let a = 0; a < 12; a++){ const t = a / 12 * Math.PI * 2 + 0.2; leaf(hx + Math.cos(t) * 1.5, hy + Math.sin(t) * 1.5, Math.cos(t), Math.sin(t), 4.2, 1.2, F, 0, { vein: false }); }
    egg(hx, hy, 2.8, 2.8, cropPal('#7a4a22'), (i, j) => ((i + j) & 1) ? '#5a3418' : null);
  },
  cosmos(k){
    const { cx, base, G, F, dot, line, leaf } = k;
    line(cx, base, cx - 1, base - 20, G.dk); line(cx, base - 8, cx + 5, base - 16, G.dk);
    for (let y = base - 3; y > base - 18; y -= 3){                                // 실처럼 갈라진 잎
      const x = cx - Math.round((base - y) / 20);
      dot(x - 1, y, noInk(G.mid)); dot(x - 2, y - 1, noInk(G.hi)); dot(x + 1, y + 1, noInk(G.mid)); dot(x + 2, y, noInk(G.dk));
    }
    const heads = [[cx - 1, base - 22], [cx + 5, base - 17]];
    if (k.stage === 3){ heads.forEach(([x, y]) => { k.egg(x, y, 1.3, 1.5, G); dot(x, y - 1, F.mid); }); return; }
    heads.forEach(([x, y]) => {
      for (let a = 0; a < 8; a++){ const t = a / 8 * Math.PI * 2; leaf(x + Math.cos(t) * 0.8, y + Math.sin(t) * 0.8, Math.cos(t), Math.sin(t), 3.2, 1.2, F, 0, { vein: false }); }
      dot(x, y, '#ffd23a'); dot(x + 1, y, '#e0a820'); dot(x, y + 1, '#e0a820'); dot(x + 1, y + 1, '#c08818');
    });
  },
  daffodil(k){
    const { cx, base, G, F, dot, line, leaf, egg } = k;
    leaf(cx - 1, base, -0.35, -1, 12, 1.3, G, 0.5); leaf(cx + 1, base, 0.3, -1, 11, 1.3, G, 0.6); leaf(cx, base, -0.8, -1, 8, 1.2, G, 0.8);
    line(cx, base, cx + 1, base - 18, G.dk); line(cx + 1, base - 18, cx + 3, base - 19, G.dk);
    const hx = cx + 4, hy = base - 19;
    if (k.stage === 3){ egg(hx, hy, 1.4, 2.4, cropPal('#d8d0a0')); return; }
    for (let a = 0; a < 6; a++){ const t = a / 6 * Math.PI * 2 - Math.PI / 2; leaf(hx + Math.cos(t), hy + Math.sin(t), Math.cos(t), Math.sin(t), 3.2, 1.3, F, 0, { vein: false }); }
    egg(hx + 1, hy, 1.7, 1.7, cropPal('#ffb530')); dot(hx + 1, hy, '#c07010');
  },
  lily(k){
    const { cx, base, G, F, dot, line, leaf, egg } = k;
    line(cx, base, cx, base - 20, G.dk);
    for (let y = base - 4, i = 0; y > base - 19; y -= 3, i++) leaf(cx, y, i & 1 ? 1 : -1, -0.6, 4, 1.1, G, 0.4, { vein: false });
    const hx = cx + 1, hy = base - 22, Fp = { ...F, vein: '#f2a6c4' };
    if (k.stage === 3){ egg(hx, hy, 1.5, 3.4, cropPal(mix(F.mid, G.mid, 0.4))); return; }
    [[-0.8, -1], [0.1, -1], [0.9, -0.7], [1, 0.1], [-1, -0.2]].forEach(([dx, dy]) => leaf(hx, hy + 1, dx, dy, 5, 1.6, Fp, -0.4));
    [[-1, -4], [1, -5], [2, -3]].forEach(([a, b]) => { line(hx, hy, hx + a, hy + b, noInk('#9ab060')); dot(hx + a, hy + b - 1, noInk('#d8702a')); });
  },
  chrys(k){
    const { cx, base, G, F, dot, line, egg } = k;
    line(cx, base, cx - 5, base - 13, G.dk); line(cx, base, cx + 4, base - 15, G.dk); line(cx, base, cx, base - 19, G.dk);
    const lobe = (i, j, u, v, c, d) => d > 0.6 && ((i * 2 + j) % 3 === 0) ? G.dk : null;
    [[-6, -5, 3], [6, -6, 3], [-3, -10, 2.8], [4, -11, 2.8], [0, -5, 3], [-7, -11, 2.2], [0, -14, 2.4]].forEach(([a, b, r]) => egg(cx + a, base + b, r, r * 0.75, G, lobe));
    const heads = [[cx - 5, base - 15], [cx + 4, base - 17], [cx, base - 21]];
    if (k.stage === 3){ heads.forEach(([x, y]) => { egg(x, y, 1.5, 1.4, G); dot(x, y - 1, F.mid); }); return; }
    heads.forEach(([x, y]) => egg(x, y, 2.8, 2.6, F, (i, j, u, v, c, d) => d < 0.12 ? F.dk : ((Math.round(Math.atan2(v, u) * 2.5) + Math.round(d * 3)) & 1) ? F.hi : null));
  },
  camellia(k){
    const { cx, base, G, F, dot, line, leaf, egg } = k, wood = '#6a4a34';
    line(cx, base, cx, base - 10, wood); line(cx, base - 6, cx - 6, base - 12, wood); line(cx, base - 7, cx + 6, base - 13, wood);
    [[-6, -12, -1, -0.5], [-6, -12, -0.2, -1], [6, -13, 1, -0.5], [6, -13, 0.2, -1], [0, -10, -0.6, -1], [0, -10, 0.6, -1], [0, -4, -1, -0.3], [0, -5, 1, -0.3], [-3, -15, -0.4, -1], [3, -16, 0.5, -1]]
      .forEach(([a, b, dx, dy]) => { leaf(cx + a, base + b, dx, dy, 4.5, 1.8, G, 0.4); dot(cx + a + dx * 2, base + b + dy * 2 - 1, shade(G.mid, 50)); });   // 반들반들한 잎 — 윤이 한 점씩
    const heads = [[cx - 4, base - 16], [cx + 5, base - 11]];
    if (k.stage === 3){ heads.forEach(([x, y]) => { egg(x, y, 1.6, 1.8, G); dot(x, y - 1, F.mid); dot(x - 1, y - 1, F.dk); }); return; }
    heads.forEach(([x, y]) => egg(x, y, 3, 2.8, F, (i, j, u, v, c, d) => d < 0.18 ? (((i + j) & 1) ? '#ffd84d' : '#f0b030') : (d > 0.3 && d < 0.5 && v < 0.3) ? F.dk : null));
  },
  star(k){
    const { cx, base, G, F, dot, line, leaf } = k;
    line(cx, base, cx, base - 18, G.dk); line(cx, base - 9, cx - 5, base - 15, G.dk); line(cx, base - 10, cx + 5, base - 13, G.dk);
    [[-1, -0.5, 6], [1, -0.5, 6], [-0.5, -1, 5], [0.6, -1, 5]].forEach(([dx, dy, l]) => leaf(cx, base - 3, dx, dy, l, 1.8, G, 0.6));
    const heads = [[cx - 8, base - 20], [cx + 2, base - 24], [cx + 3, base - 17]];
    if (k.stage === 3){ heads.forEach(([x, y]) => { k.egg(x + 3, y + 3, 1.4, 1.4, F); dot(x + 3, y + 1, noInk('#ffffff')); }); return; }
    heads.forEach(([x, y]) => k.map(x, y, ['...h...', '..hmd..', 'hhmmmdd', '.lmmmd.', '.mm.dd.', '.d...d.'], { h: F.hi, l: F.lt, m: F.mid, d: F.dk }));
    [[-10, -24], [7, -26], [8, -19]].forEach(([a, b]) => { dot(cx + a, base + b, noInk('#fffbe0')); dot(cx + a - 1, base + b, noInk('#ffe680')); dot(cx + a + 1, base + b, noInk('#ffe680')); dot(cx + a, base + b - 1, noInk('#ffe680')); dot(cx + a, base + b + 1, noInk('#ffe680')); });
  },
  snowflower(k){
    const { cx, base, G, F, dot, line, leaf } = k;
    line(cx, base, cx, base - 17, G.dk);
    [[-1, -0.6, 6], [1, -0.6, 6], [-0.6, -1, 5], [0.6, -1, 5]].forEach(([dx, dy, l]) => leaf(cx, base - 2, dx, dy, l, 1.4, G, 0.5));
    const hx = cx, hy = base - 20;
    if (k.stage === 3){ k.egg(hx, hy, 1.5, 1.8, F); return; }
    for (let a = 0; a < 6; a++){                                                   // 눈꽃 — 여섯 갈래 결정
      const t = a / 6 * Math.PI * 2 - Math.PI / 2, ux = Math.cos(t), uy = Math.sin(t);
      line(hx, hy, hx + ux * 4, hy + uy * 4, a & 1 ? F.dk : F.mid);
      dot(hx + ux * 2.5 - uy, hy + uy * 2.5 + ux, F.hi); dot(hx + ux * 2.5 + uy, hy + uy * 2.5 - ux, F.hi);
    }
    dot(hx, hy, '#ffffff');
    [[-6, -4], [6, 3], [4, -6]].forEach(([a, b]) => { dot(hx + a, hy + b, noInk('#ffffff')); dot(hx + a + 1, hy + b, noInk('#dff2ff')); dot(hx + a - 1, hy + b, noInk('#dff2ff')); dot(hx + a, hy + b - 1, noInk('#dff2ff')); dot(hx + a, hy + b + 1, noInk('#dff2ff')); });
  },
};
CROP_ART.winterradish = CROP_ART.radish; CROP_ART.watermelon = CROP_ART.pumpkin = CROP_ART.melon;
const CROP_SHAPE_ART = { root: 'radish', head: 'cabbage', bush: 'pepper', vine: 'pea', tall: 'corn', melon: 'melon', flower: 'tulip' };
// 어린 포기(2단계) — 모양 무리마다 한 가지
function youngCrop(k, shape){
  const { cx, base, G, line, leaf, dot } = k;
  if (shape === 'tall'){
    for (let y = base; y >= base - 13; y--){ dot(cx, y, G.mid); dot(cx + 1, y, G.dk); }
    leaf(cx, base - 4, -1, -1, 7, 1.3, G, 1.2); leaf(cx + 1, base - 7, 1, -1.1, 7, 1.3, G, 1.2); leaf(cx, base - 11, -0.5, -1, 6, 1.1, G, 1);
  } else if (shape === 'vine'){
    k.stake(cx, base - 16, base, cropPal('#c8b070'));
    for (let y = base; y >= base - 12; y--) dot(cx + Math.round(Math.sin((base - y) * 0.5) * 2), y, G.dk);
    leaf(cx, base - 4, -1, -0.5, 4, 1.4, G, 0.5); leaf(cx, base - 8, 1, -0.5, 4, 1.4, G, 0.5); leaf(cx, base - 12, -0.6, -1, 3.5, 1.2, G, 0.3);
  } else if (shape === 'flower'){
    line(cx, base, cx, base - 13, G.dk);
    leaf(cx, base - 2, -1, -0.8, 6, 1.7, G, 0.7); leaf(cx + 1, base - 5, 1, -0.8, 5, 1.5, G, 0.7);
    k.egg(cx, base - 14, 1.2, 1.6, G);
  } else {
    [[-1, -0.35, 6], [-0.4, -1, 6.5], [0.45, -1, 6], [1, -0.4, 6]].forEach(([dx, dy, l]) => leaf(cx, base - 1, dx, dy, l, 1.8, G, 0.6));
  }
}
function drawCrop(X, Y, crop, stage, wilted, P, sway){
  const put = P || pxMap, C = R.CROPS[crop], s = sway || 0;
  const cx = X + 16, base = Y + 28;
  const k = cropPen(put, y => s * Math.max(0, Math.min(1, (base - y) / 22)));
  Object.assign(k, { cx, base, crop, stage, ripe: stage === 4, G: cropPal(wilted ? '#a08a5a' : C.leaf), F: cropPal(C.fruit) });
  const { G, line, leaf } = k;
  put(cx - 9, base, 19, 2, '#00000016');                                         // 그림자
  if (wilted){                                                                   // 시든 것 — 꺾여 누운 줄기와 처진 잎
    line(cx, base, cx - 1, base - 8, '#7a6a44'); line(cx - 1, base - 8, cx - 5, base - 7, '#7a6a44');
    leaf(cx, base - 2, -1, 0.3, 6, 1.4, G, 0.6); leaf(cx, base - 4, 1, 0.1, 6, 1.4, G, 0.9); leaf(cx - 4, base - 7, -1, 0.6, 4, 1.1, G, 0.5);
    return;
  }
  if (stage === 0){                                                              // 씨 — 흙이 봉긋, 떡잎 둘이 막 올라온다
    put(cx - 3, base - 1, 6, 1, '#00000022'); line(cx, base, cx, base - 2, G.dk);
    leaf(cx, base - 2, -1, -0.5, 2.5, 1, G, 0, { vein: false }); leaf(cx, base - 2, 1, -0.5, 2.5, 1, G, 0, { vein: false });
    return;
  }
  if (stage === 1){
    line(cx, base, cx, base - 7, G.dk);
    leaf(cx, base - 4, -1, -0.3, 4, 1.3, G, 0.3); leaf(cx, base - 5, 1, -0.4, 4, 1.3, G, 0.3); leaf(cx, base - 7, 0.2, -1, 3, 1.1, G, 0.1, { vein: false });
    return;
  }
  if (stage === 2) return youngCrop(k, C.shape);
  (CROP_ART[crop] || CROP_ART[CROP_SHAPE_ART[C.shape]])(k);
}
// 밭에 얹을 작물 한 포기 — 테까지 둘러 작은 그림에 담아 둔다. 작물 줄은 바람 단계(0.11초)마다 다시 그려진다.
function cropAt(X, Y, crop, stage, wilted, sway){
  cachedDraw('crop:' + crop + ':' + stage + (wilted ? 'x' : '') + ':' + (sway || 0) + '@' + S, X - 10, Y - 8, 52, 44,
    () => withInk(INK.crop, () => drawCrop(X, Y, crop, stage, wilted, null, sway)));
}
function drawGiant(id, p, sway){
  const a = R.parseId(id), b = R.parseId(p.pairOf);
  const X = Math.min(a.x, b.x) * T, Y = Math.min(a.y, b.y) * T;
  const w = (Math.abs(a.x - b.x) + 1) * T, hgt = (Math.abs(a.y - b.y) + 1) * T;
  const C = R.CROPS[p.crop], st = R.stageOf(p), s = sway || 0;
  const cx = X + w / 2, base = Y + hgt - 2;
  const k = cropPen(pxMap, y => s * Math.max(0, Math.min(1, (base - y) / 30)));
  const G = cropPal(C.leaf), F = cropPal(C.fruit), { line, egg } = k;
  pxMap(X + 4, base - 2, w - 8, 2, '#00000020');
  line(X + 4, base - 4, X + w - 4, base - 5, G.dk);                                // 땅을 기는 덩굴과 갈래진 큰 잎
  const vleaf = (x, y, r) => {
    egg(x - r * 0.7, y + 1, r * 0.6, r * 0.5, G); egg(x + r * 0.7, y + 1, r * 0.6, r * 0.5, G); egg(x, y, r * 0.72, r * 0.62, G);
    line(x, y + r * 0.5, x, y - r * 0.4, G.vein); line(x, y + r * 0.5, x - r * 0.7, y, G.vein); line(x, y + r * 0.5, x + r * 0.7, y, G.vein);
  };
  [[0.14, -8, 4.4], [0.86, -9, 4.4], [0.3, -16, 4.2], [0.72, -17, 4.2], [0.06, -2, 3.2], [0.94, -3, 3.2]].forEach(([fx, dy, r]) => vleaf(Math.round(X + w * fx), base + dy, r));
  if (st >= 4){
    const r = Math.min(w, hgt) / 2 - 2;
    melonFruit(k, p.crop, Math.round(cx), Math.round(base - r * 0.85), Math.round(r), Math.round(r * 0.82), F);
  } else if (st >= 2) egg(Math.round(cx), base - 10, 8, 6, cropPal(shade(C.leaf, -12)));
  if (p.pulls && p.pulls.length) p.pulls.forEach((who, i) => { const c = who === 'sua' ? '#ff7f8a' : '#6cc7b3'; pxMap(X + 6 + i * 20, Y + 6, 12, 12, c); pxMap(X + 6 + i * 20, Y + 6, 6, 4, shade(c, 26)); });
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

// ---------- 건물 ----------
// 밤에 불이 켜지는 자리는 여기에 모아 둔다. 바탕을 그릴 때 채우고, 어두워지면 그 위에 빛을 얹는다.
let lamps = [];
// 테를 두르는 동안에는 같은 그림을 다섯 번 그리므로 등불도 다섯 번 모인다 — 마지막 한 번만 센다
function lamp(x, y, r, c){
  if (inkPass) return;
  if (lampOff){ x += lampOff.x; y += lampOff.y; }         // 아이소 섬에 곧게 세운 그림이면 옮긴 만큼
  lamps.push({ x, y, r, c: c || '#ffcf7a' });
}
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
  // 가게 아저씨는 서성이므로 여기(굳힌 겹)가 아니라 매 장 drawStallKeeper2D 가 그린다
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
  const P = groundPal(season);
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
// ---------- 별 동상 도우미 ----------
// 금: 0 가장 밝음 → 5 테두리. 대리석: 0 밝음 → 4 그늘.
const STAR_GOLD = ['#fff3b8', '#ffe066', '#f5c030', '#e0a01c', '#b8740e', '#7a4608'];
const STAR_MARBLE = ['#fbf9f5', '#ece7df', '#dcd5ca', '#bdb4a7', '#9c9285'];
function starGeom(X, Y){ return { cx: X + 16, cy: Y + 15, R: 13, r: 5.6 }; }
// 별 안이면 면 색 번호(0~4), 밖이면 -1. 뾰족한 끝 다섯, 오목한 곳 다섯 → 열 조각.
// 조각마다 바깥 방향이 왼쪽 위(빛)를 볼수록 밝다.
// 금별 — 도트 하나하나를 열 조각 면에 따라 칠한다. depth 만큼 위로 두께(아이소에서 보이는 윗면)를 먼저 깐다.
function paintStar(sc, depth){
  const G = STAR_GOLD;
  for (let k = depth || 0; k > 0; k--) for (let yy = -sc.R - 1; yy <= sc.R + 1; yy++) for (let xx = -sc.R - 1; xx <= sc.R + 1; xx++)
    if (starFace(sc, xx + 0.5, yy + 0.5) >= 0) px(sc.cx + xx, sc.cy + yy - k, 1, 1, k === depth ? G[3] : G[4]);
  for (let yy = -sc.R - 1; yy <= sc.R + 1; yy++) for (let xx = -sc.R - 1; xx <= sc.R + 1; xx++){
    const f = starFace(sc, xx + 0.5, yy + 0.5);
    if (f < 0) continue;
    const edge = starFace(sc, xx + 1.5, yy + 0.5) < 0 || starFace(sc, xx - 0.5, yy + 0.5) < 0 || starFace(sc, xx + 0.5, yy + 1.5) < 0 || starFace(sc, xx + 0.5, yy - 0.5) < 0;
    px(sc.cx + xx, sc.cy + yy, 1, 1, edge ? (xx + yy < -2 ? G[3] : G[5]) : G[f]);
  }
  px(sc.cx - 1, sc.cy - 1, 3, 3, '#fff6c8'); px(sc.cx, sc.cy, 1, 1, '#ffffff');  // 한가운데 박힌 빛
  px(sc.cx - 4, sc.cy - 6, 2, 1, '#ffffff'); px(sc.cx - 5, sc.cy - 5, 1, 2, '#ffffff');   // 윗면에 맺힌 빛
}
function starFace(g, x, y){
  const a = Math.atan2(y, x) + Math.PI / 2;                                    // 위쪽 끝이 0
  const seg = Math.PI / 5, k = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / seg;
  const i = Math.floor(k), f = k - i;
  const r0 = i % 2 ? g.r : g.R, r1 = i % 2 ? g.R : g.r;
  const d = Math.hypot(x, y), lim = (r0 * r1 * Math.sin(seg)) / (r0 * Math.sin(seg * f) + r1 * Math.sin(seg * (1 - f)));
  if (d > lim) return -1;
  // 조각 가운데 방향과 빛(왼쪽 위) 사이 — 1이면 빛을 정면으로
  const mid = (i + 0.5) * seg - Math.PI / 2, lit = Math.cos(mid) * -0.62 + Math.sin(mid) * -0.78;
  // 한 끝을 가르는 두 면 중 한쪽은 밝고 한쪽은 어두워야 입체로 읽힌다
  const v = lit + (i % 2 ? -0.35 : 0.35);
  return v > 0.75 ? 0 : v > 0.25 ? 1 : v > -0.2 ? 2 : v > -0.65 ? 3 : 4;
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
  if (d.pond){ const b = spot('pond'); drawPond(season, b.x * T, b.y * T, b.w * T, b.h * T); }
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
    /* 별 동상 — 농장에서 가장 비싼 꾸미개라 가장 번쩍여야 한다.
       아래부터 겹겹이: 그림자 → 대리석 세 단(금테·보석·명판) → 홈 파인 기둥 → 금 잔 → 입체 금별.
       별은 열 조각 면으로 나눠 왼쪽 위에서 빛을 받게 칠한다 — 깎은 보석처럼 보인다.
       빛살·반짝임·빛줄기는 움직이는 겹(drawDecorLive)에서 돈다. */
    const b = spot('statue'), X = b.x * T, Y = b.y * T, h = b.h * T, G = STAR_GOLD, M2 = STAR_MARBLE;
    const B = Y + h;                                                           // 바닥 줄
    px(X + 1, B - 5, 30, 3, '#00000022'); px(X + 4, B - 3, 24, 2, '#00000014');   // 그림자
    // 맨 아래 단 — 넓은 대리석, 윗면에 금테
    px(X + 2, B - 13, 28, 9, M2[2]); grainy(X + 2, B - 13, 28, 9, M2[2], 'stone', 'st1');
    px(X + 2, B - 13, 28, 2, G[2]); px(X + 2, B - 13, 28, 1, G[0]); px(X + 2, B - 11, 28, 1, G[4]);
    px(X + 2, B - 6, 28, 2, M2[3]); px(X + 2, B - 13, 1, 9, M2[3]); px(X + 29, B - 13, 1, 9, M2[4]);
    [6, 16, 25].forEach(ox => px(X + ox, B - 9, 1, 1, G[1]));                  // 금 못
    // 가운데 단 — 금 명판에 작은 별, 양옆에 루비
    px(X + 5, B - 21, 22, 8, M2[1]); grainy(X + 5, B - 21, 22, 8, M2[1], 'stone', 'st2');
    px(X + 5, B - 21, 22, 1, M2[0]); px(X + 5, B - 14, 22, 1, M2[3]); px(X + 26, B - 21, 1, 8, M2[3]);
    px(X + 4, B - 22, 24, 2, G[2]); px(X + 4, B - 22, 24, 1, G[0]); px(X + 4, B - 20, 24, 1, G[4]);
    px(X + 10, B - 19, 12, 6, G[4]); px(X + 11, B - 19, 10, 5, G[2]); px(X + 11, B - 19, 10, 1, G[0]);   // 명판
    [[2, 0, 1], [0, 1, 5], [1, 2, 3], [0, 3, 1], [4, 3, 1]].forEach(([ox, oy, w]) => px(X + 14 + ox, B - 18 + oy, w, 1, G[5]));   // 새긴 별
    [X + 6, X + 23].forEach(gx => { px(gx, B - 18, 3, 3, '#b3203a'); px(gx, B - 18, 2, 2, '#e8364f'); px(gx, B - 18, 1, 1, '#ffb3c0'); });
    // 기둥 — 홈 셋, 위아래 금가락지, 가운데 사파이어
    px(X + 10, B - 38, 12, 16, M2[1]);
    for (let i = 0; i < 16; i++) if (i % 5 === 2) px(X + 10, B - 38 + i, 12, 1, M2[0]);   // 대리석 결
    px(X + 12, B - 38, 1, 16, M2[3]); px(X + 15, B - 38, 1, 16, M2[3]); px(X + 18, B - 38, 1, 16, M2[3]);
    px(X + 10, B - 38, 2, 16, M2[0]); px(X + 20, B - 38, 2, 16, M2[3]); px(X + 21, B - 38, 1, 16, M2[4]);
    px(X + 16, B - 34, 1, 5, '#c7bfb3');                                       // 실금 한 줄 — 돌맛
    px(X + 9, B - 25, 14, 3, G[2]); px(X + 9, B - 25, 14, 1, G[0]); px(X + 9, B - 23, 14, 1, G[4]);
    px(X + 9, B - 40, 14, 3, G[2]); px(X + 9, B - 40, 14, 1, G[0]); px(X + 9, B - 38, 14, 1, G[4]);
    px(X + 14, B - 33, 4, 4, '#1f4f9a'); px(X + 14, B - 33, 3, 3, '#3a7bd5'); px(X + 14, B - 33, 1, 1, '#b8dcff');
    // 금 잔 — 별을 받쳐 든다
    px(X + 8, B - 44, 16, 4, G[2]); px(X + 8, B - 44, 16, 1, G[0]); px(X + 9, B - 41, 14, 1, G[4]);
    px(X + 10, B - 45, 12, 1, G[1]); px(X + 8, B - 44, 2, 3, G[1]); px(X + 22, B - 44, 2, 3, G[3]);
    // 별 — 도트 하나하나를 면에 따라 칠한다
    const sc = starGeom(X, Y);
    paintStar(sc);
    if (night){ lamp(sc.cx, sc.cy, 40, '#ffe6a0'); lamp(sc.cx, B - 20, 18, '#ffd36a'); }
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
  const N = nodeOf(n), X = N.x * T, Y = N.y * T;
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
// 주말 손님 한 명(섬에서만) — 그림일 뿐이라 세이브에 안 적는다. 움직이는 부분은 drawWalkerIso 아래에.
let farmGuest = null, farmGuestNext = 4000, farmGuestAsk = null;   // Ask: 시험으로 부른 { n }
WALKSHEET.onReady(() => { if (liveCv && W) drawFarm(liveCv); });   // 손님 그림이 늦게 오면 한 번 더(움직임 줄이기면 이게 유일한 다시 그리기)
function walkableTile(tx, ty){
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS - 1) return false;   // 맨 아랫줄은 앞쪽 수풀에 가린다
  if (R.fieldHas(W, tx, ty)) return false;                            // 밭 칸 — 농장마다 모양이 다르다(아직 안 연 땅까지)
  for (let i = 0; i < R.PLACE_IDS.length; i++){
    const id = R.PLACE_IDS[i];
    if (id === 'path' || !here(id)) continue;
    const b = spot(id);
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  for (const n in R.NODES){ const N = R.nodeSpot(W, n); if (N.x === tx && N.y === ty) return false; }
  if (R.sceneryOf(W).some(c => c.x === tx && c.y === ty)) return false;   // 서 있기만 하는 풍경 나무·바위
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
  const sig = (W.farm || 0) + JSON.stringify(W.layout || {}) + Object.keys(W.buildings).filter(b => W.buildings[b].done).sort().join('') + (W.expand || 0) + Object.keys(W.decor || {}).sort().join('');
  if (walkGrid && walkSig === sig) return;
  walkSig = sig; walkGrid = [];
  for (let y = 0; y < ROWS; y++){ const row = []; for (let x = 0; x < COLS; x++) row.push(walkableTile(x, y)); walkGrid.push(row); }
}
// 너비 우선 — 240칸짜리 지도라서 넉넉하다. 건물을 뚫고 지나가지 않는다.
// near({x,y,r}) 를 주면 그 칸에서 r 칸 안을 막힌 셈 친다 — 다른 아이 둘레를 돌아서 가려고.
function pathFind(sx, sy, tx, ty, near){
  ensureWalkGrid();
  if (sx < 0 || sy < 0 || sx >= COLS || sy >= ROWS) return null;
  if (!walkGrid[ty] || !walkGrid[ty][tx]) return null;
  const idx = (x, y) => y * COLS + x;
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  if (near) for (let y = near.y - near.r; y <= near.y + near.r; y++) for (let x = near.x - near.r; x <= near.x + near.r; x++){
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && !(x === tx && y === ty)) seen[idx(x, y)] = 1;
  }
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
function ensureActors(){
  if (!walkers){
    const h = spot('house');
    walkers = ['sua', 'yona'].map((who, i) => {
      const t0 = nearestWalkable(h.x + 1 + i * 2, h.y + h.h);
      // 연아는 한참 뒤에 나선다 — 둘이 같이 출발하면 한 몸처럼 붙어 다닌다
      return { who, x: t0.x * T + 16, y: t0.y * T + 24, wait: i ? 1500 + Math.random() * 1500 : 300 + Math.random() * 900, vx: 0, vy: 0, moving: false, goAt: -1e9, phase: i * 2, path: null, step: 0, trail: [] };
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
  // 새 그림(수아 38·연아 32 도트)은 아이소 칸 하나(40)만큼 넓다 — 두 칸보다 가까우면 몸이 겹쳐 보인다
  const KID_GAP = 2 * T, KID_FAR = 5 * T;
  walkers.forEach(w => {
    if (w.wait > 0){ w.wait -= dt; w.moving = false; return; }
    const o = walkers.find(v => v !== w);
    if (!w.path || w.step >= w.path.length){
      const from = nearestWalkable(Math.floor(w.x / T), Math.floor(w.y / T));
      if (!walkableTile(Math.floor(w.x / T), Math.floor(w.y / T))){ w.x = from.x * T + 16; w.y = from.y * T + 24; }
      // 다른 아이의 자리·목적지에서 다섯 칸 넘게 떨어진 곳을, 그 아이 둘레를 밟지 않는 길로 고른다.
      // 끝내 없으면 가장 먼 곳으로 그냥 간다(걷다가 가까워지면 아래에서 다시 비킨다).
      const og = o && o.path && o.path.length ? o.path[o.path.length - 1] : null;
      const on = o ? { x: Math.floor(o.x / T), y: Math.floor(o.y / T) } : null;
      if (on) on.r = Math.max(0, Math.min(2, Math.max(Math.abs(on.x - from.x), Math.abs(on.y - from.y)) - 1));   // 제 발밑까지 막지는 않게
      let p = null, far = -1, route = null;
      for (let k = 0; k < 12 && !route; k++){
        const c = someTile(), cx = c.x * T + 16, cy = c.y * T + 24;
        let cd = o ? Math.hypot(cx - o.x, cy - o.y) : 1e9;
        if (og) cd = Math.min(cd, Math.hypot(cx - og.x * T - 16, cy - og.y * T - 24));
        if (cd >= KID_FAR){ const r = pathFind(from.x, from.y, c.x, c.y, on); if (r && r.length) route = r; }
        if (cd > far){ far = cd; p = c; }
      }
      w.path = route || pathFind(from.x, from.y, p.x, p.y);
      w.step = 0; w.moving = false;
      // 기다림도 아이마다 결이 다르다 — 연아가 조금 더 느긋하다
      w.wait = w.path && w.path.length ? (w.who === 'yona' ? 900 + Math.random() * 3200 : 400 + Math.random() * 2400) : 500;
      return;
    }
    const g = w.path[w.step], gx = g.x * T + 16, gy = g.y * T + 24;
    const dx = gx - w.x, dy = gy - w.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 4){ w.x = gx; w.y = gy; w.step++; return; }
    if (o){
      // 막 걸음을 떼려는데 다른 아이도 방금 떠났으면 조금 더 있다가 — 둘이 한꺼번에 움직이지 않게
      if (!w.moving && o.moving && t - o.goAt < 1000){ w.wait = 600 + Math.random() * 900; return; }
      // 다음 걸음이 다른 아이에게 더 다가가며 두 칸 안에 들면: 앞서 가는 아이면 뒤에서 기다리고,
      // 마주 오거나 서 있으면 멈춰서 그 아이를 비켜 가는 새 길을 짠다(위에서)
      const ox = o.x - w.x, oy = o.y - w.y, gd = Math.hypot(gx - o.x, gy - o.y);
      if (gd < KID_GAP && gd < Math.hypot(ox, oy)){
        w.moving = false;
        if (o.moving && o.vx * ox + o.vy * oy > 0) w.wait = 500 + Math.random() * 700;
        else { w.path = null; w.wait = 200 + Math.random() * 400; }
        return;
      }
    }
    if (!w.moving) w.goAt = t;
    w.x += dx / d * kidSp; w.y += dy / d * kidSp; w.moving = true; w.phase += kidSp / 6.4;
    w.vx = dx; w.vy = dy;                                              // 보는 쪽은 그릴 때 dir8 로 고른다
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
  stepFarmGuest(dt, t);
}
function drawWalker(w, t){
  const A = KIDART[w.who] || KIDART.yona, d = w.moving ? dir8(w.vx, w.vy) : 'S', f = KIDSTEP(w.moving, w.phase);   // 멈추면 화면(정면)을 본다
  const bob = w.moving ? 0 : (Math.sin(t / 900 + w.phase) > 0.8 ? 2 : 0);
  footShade(w.x, w.y - 2, 22);
  artOut(w.who + d + f, A.dirs[d][f], Math.round(w.x - A.w / 2), Math.round(w.y - A.h + bob), KIDPAL[w.who]);   // 그림 밑단 가운데 = 발자리
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
// foot 은 말하는 이의 발끝 — 아이소 섬에서는 발끝을 화면 자리로 옮기고 그 위로 키만큼 올린다
function bubbleAt(id, x, y, text, t, foot){
  if (isoView && foot != null){ const q = isoP(x / T, foot / T); y = q.y - (foot - y); x = q.x; }
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
    const x = Math.round(Math.max(2, Math.min(artSize().w - w - 2, o.x - w / 2)));
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
/* ---------- 연못 ----------
   예전 연못은 파란 네모 셋을 겹치고 위아래로 돌 한 줄씩 둔 것이라 「파란 판」으로 보였고,
   오리 두 마리가 헤엄친다는 설명과 달리 오리가 없었다. 이제는
   · 가장자리가 둥글고 줄마다 조금씩 울퉁불퉁한 물 — 물가는 얕아 밝고 가운데로 갈수록 깊다
   · 윗물가에는 둑 그늘이 물에 지고, 아랫물가에는 밝은 물빛 한 줄
   · 둘레 돌은 크기·빛깔이 제각각, 앞쪽 돌은 옆면까지 보인다
   · 부들·갈대·수련 잎과 꽃, 가을엔 떠 있는 낙엽, 겨울엔 금 간 얼음과 눈
   이것들은 구워 두는 겹(지은 것)에 그려서 도트 하나하나를 칠해도 매 장 드는 값은 없고,
   오리와 물 반짝임만 drawPondLive 가 매 장 그린다. */
const POND_WATER = {
  warm: ['#8fd3ea', '#6bbbe6', '#55a6dc', '#4592cf', '#3c82c0'],
  ice:  ['#e2f1f8', '#cfe6f1', '#bcdaea', '#a9cde3', '#9ac2dc'],   // 눈밭과 섞이지 않게 푸른 기를 남긴다
};
function pondGeom(X, Y, w, h){
  const cx = X + w / 2, cy = Y + h / 2 + 1;
  const rx = w / 2 - 3, ry = h / 2 - 3;           // 둑(돌 바깥)까지
  const wx = rx - 8, wy = ry - 8;                 // 물까지
  return { cx, cy, rx, ry, wx, wy };
}
// 줄마다 반폭. 둥근 네모꼴(p>2)에 부드러운 울퉁불퉁함을 더한다 — 줄마다 따로 흔들면 톱니가 된다.
function pondHalf(yy, a, b, p, salt){
  const q = Math.abs(yy) / b;
  if (q >= 1) return -1;
  const n = (yy + 200) / 7, i0 = Math.floor(n), f = n - i0, sn = strSeed('pond' + salt);
  const e = f * f * (3 - 2 * f), wob = (hash2(i0, 0, sn) * (1 - e) + hash2(i0 + 1, 0, sn) * e - 0.5) * 3.2;
  return a * Math.pow(1 - Math.pow(q, p), 1 / p) + wob;
}
function drawPond(season, X, Y, w, h){
  const ice = season === 'winter', G = pondGeom(X, Y, w, h), { cx, cy, rx, ry, wx, wy } = G;
  const WC = ice ? POND_WATER.ice : POND_WATER.warm, sn = strSeed('pondw');
  // 1) 젖은 풀 그늘 — 둑보다 두 도트 넓게 옅게
  for (let yy = -ry - 2; yy <= ry + 3; yy++){
    const hw = pondHalf(yy, rx + 3, ry + 3, 2.4, 'o'); if (hw <= 0) continue;
    px(cx - hw, cy + yy, hw * 2, 1, ice ? '#6a8aa01a' : '#1e3a1a22');
  }
  // 2) 둑 — 흙(겨울엔 눈). 알갱이를 흩뿌린다
  const mud = ice ? '#e9f1f5' : season === 'autumn' ? '#a08a62' : '#a8946c';
  for (let yy = -ry; yy <= ry; yy++){
    const hw = pondHalf(yy, rx, ry, 2.4, 'b'); if (hw <= 0) continue;
    const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    px(x0, cy + yy, x1 - x0, 1, mud);
    for (let x = x0; x < x1; x++){
      const v = hash2(x, cy + yy, sn + 7);
      if (v > 0.86) px(x, cy + yy, 1, 1, shade(mud, 12)); else if (v < 0.12) px(x, cy + yy, 1, 1, shade(mud, -14));
    }
  }
  // 3) 물 — 가장자리에서 얼마나 떨어졌나로 깊이를 고르고, 경계는 흩뿌려 섞는다. 같은 색은 한 번에 칠한다
  for (let yy = -wy; yy <= wy; yy++){
    const hw = pondHalf(yy, wx, wy, 2.3, 'w'); if (hw <= 0) continue;
    const y = cy + yy, x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    let runC = null, runX = x0;
    for (let x = x0; x <= x1; x++){
      let c = null;
      if (x < x1){
        const ex = (x + 0.5 - cx) / wx, ey = yy / wy;
        const edge = Math.min(x - x0, x1 - 1 - x, (wy - Math.abs(yy)) * 1.6);
        let d = Math.min(1, Math.sqrt(ex * ex + ey * ey)) ;
        d += (hash2(x, y, sn) - 0.5) * 0.10;
        let k = d > 0.9 || edge < 2 ? 0 : d > 0.74 ? 1 : d > 0.52 ? 2 : d > 0.28 ? 3 : 4;
        if (!ice && yy < -wy + 7 && k < 4) k = Math.min(4, k + (yy < -wy + 3 ? 2 : 1));   // 윗둑 그늘
        c = WC[k];
        if (!ice && yy > wy - 2 && edge >= 2) c = '#a9def0';                               // 아랫물가 빛
      }
      if (c !== runC){ if (runC) px(runX, y, x - runX, 1, runC); runC = c; runX = x; }
    }
  }
  // 4) 물 위의 하늘 빛 / 얼음 금
  if (!ice){
    for (let i = 0; i < 9; i++){
      const u = R.prand('prf' + i) - 0.5, v = R.prand('prg' + i) - 0.5, len = 3 + Math.floor(R.prand('prl' + i) * 8);
      const gx = cx + u * wx * 1.3, gy = cy + v * wy * 1.2;
      px(gx, gy, len, 1, i < 3 ? '#c4ebf7' : '#8fd0ee');
    }
    px(cx - wx * 0.55, cy - wy * 0.35, 10, 1, '#d6f2fb'); px(cx - wx * 0.55 + 3, cy - wy * 0.35 + 2, 5, 1, '#b9e5f4');
  } else {
    const crack = (pts) => { for (let i = 1; i < pts.length; i++){
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let s2 = 0; s2 <= n; s2++){ const qx = ax + (bx - ax) * s2 / n, qy = ay + (by - ay) * s2 / n; px(qx, qy + 1, 1, 1, '#9fc2d4'); px(qx, qy, 1, 1, '#ffffff'); }
    } };
    crack([[cx - 20, cy - 10], [cx - 8, cy - 4], [cx + 2, cy - 6], [cx + 16, cy + 2]]);
    crack([[cx - 8, cy - 4], [cx - 12, cy + 8]]);
    crack([[cx + 2, cy - 6], [cx + 8, cy - 16]]);
    [[cx + 18, cy + 12, 14, 5], [cx - 26, cy + 6, 10, 4], [cx + 24, cy - 12, 8, 3]].forEach(([sx, sy, sw, sh]) => {
      for (let r = 0; r < sh; r++){ const k2 = Math.sin(Math.PI * (r + 0.5) / sh), ww = Math.round(sw * (0.4 + 0.6 * k2)); px(sx - ww / 2, sy + r, ww, 1, '#fbfdfe'); }
    });
  }
  // 5) 수련 잎과 꽃 · 가을 낙엽 (얼음 위엔 없다)
  if (!ice){
    const padC = season === 'autumn' ? ['#a3a94e', '#c2c46a', '#7f8538'] : ['#5fae4e', '#86c96a', '#3f8a3c'];
    [[0.36, 0.42, 7, 0], [-0.30, 0.52, 5, 1], [0.58, -0.22, 6, 2], [-0.62, 0.05, 4, 3]].forEach(([u, v, r, i]) => {
      const lx = Math.round(cx + u * wx), ly = Math.round(cy + v * wy), ry2 = Math.max(2, Math.round(r * 0.62));
      px(lx - r + 1, ly + ry2 - 1, r * 2 - 2, 1, '#2f6fa866');                    // 물에 비친 잎 그늘
      for (let yy = -ry2; yy < ry2; yy++){
        const k2 = Math.sqrt(1 - Math.pow((yy + 0.5) / ry2, 2)), hw = Math.round(r * k2);
        px(lx - hw, ly + yy, hw * 2, 1, yy >= ry2 - 1 ? padC[2] : padC[0]);
        if (yy < 0 && hw > 2) px(lx - hw + 1, ly + yy, Math.max(1, hw - 2), 1, padC[1]);
      }
      const notch = WC[3];                                                        // 잎의 갈라진 틈
      px(lx, ly - 1, Math.round(r * 0.9), 1, notch); px(lx + 1, ly, Math.round(r * 0.6), 1, notch);
      if (i === 0 && season !== 'autumn'){                                        // 꽃 한 송이
        px(lx - 4, ly - 3, 3, 2, '#ff9ec4'); px(lx - 1, ly - 3, 3, 2, '#ff9ec4');
        px(lx - 3, ly - 5, 2, 2, '#ffc2dc'); px(lx - 1, ly - 6, 2, 3, '#ffd6e7'); px(lx + 1, ly - 5, 2, 2, '#ffc2dc');
        px(lx - 2, ly - 3, 2, 1, '#ffe066');
      }
    });
    if (season === 'autumn') [['#e8874a', 0.1, -0.3], ['#d9603c', -0.2, 0.2], ['#f2c14e', 0.3, 0.1]].forEach(([c, u, v]) => {
      const lx = cx + u * wx, ly = cy + v * wy; px(lx, ly, 3, 1, c); px(lx + 1, ly + 1, 3, 1, shade(c, -24));
    });
  }
  // 6) 둘레 돌 — 뒤(위)쪽부터. 앞쪽 돌은 옆면이 보인다
  const stones = [];
  const N = 30;
  for (let k = 0; k < N; k++){
    const a = (k + (R.prand('psa' + k) - 0.5) * 0.5) / N * Math.PI * 2;
    const sw = 7 + Math.floor(R.prand('psw' + k) * 6), sh = 5 + Math.floor(R.prand('psh' + k) * 3);
    stones.push({ x: cx + Math.cos(a) * (wx + 3) - sw / 2, y: cy + Math.sin(a) * (wy + 3) - sh / 2, sw, sh, front: Math.sin(a) > 0.15, k });
  }
  stones.sort((p, q) => p.y - q.y).forEach(o => {
    const x = Math.round(o.x), y = Math.round(o.y), { sw, sh } = o;
    const base = [STONE.mid, STONE.hi, STONE.low, '#b8b0a4'][Math.floor(R.prand('psc' + o.k) * 4)];
    if (o.front){ px(x + 1, y + sh - 1, sw - 2, 3, STONE.dark); px(x + 2, y + sh + 2, sw - 4, 1, '#00000022'); }
    px(x + 1, y, sw - 2, sh, base); px(x, y + 1, sw, sh - 2, base);
    px(x + 1, y + 1, sw - 3, 1, shade(base, 16)); px(x + 1, y + 1, 1, sh - 3, shade(base, 10));   // 위·왼쪽 빛
    px(x + 2, y + sh - 1, sw - 3, 1, shade(base, -18)); px(x + sw - 1, y + 2, 1, sh - 3, shade(base, -12));
    if (R.prand('psd' + o.k) > 0.6) px(x + 3, y + 2, 1, 1, shade(base, -22));                     // 오목한 곳
    if (ice){ px(x + 1, y, sw - 2, 2, '#f6fafc'); px(x, y + 1, sw, 1, '#ffffff'); }
    else if (season !== 'autumn' && R.prand('psm' + o.k) > 0.7){ px(x + 1, y, 3, 1, '#7fb069'); px(x, y + 1, 2, 1, '#6a9c58'); }
  });
  // 7) 부들(왼쪽 뒤)과 갈대(오른쪽 앞)
  const stem = ice ? '#b89e72' : season === 'autumn' ? '#a88f52' : '#5f9440';
  const leaf = ice ? '#c7ae80' : season === 'autumn' ? '#bda463' : '#79b04e';
  [[-0.94, -0.30, 19], [-0.86, -0.46, 23], [-0.78, -0.24, 16], [-0.70, -0.52, 20]].forEach(([u, v, hh], i) => {
    const bx = Math.round(cx + u * rx), by = Math.round(cy + v * ry) + 4;
    px(bx - 1, by, 3, 1, '#00000024');
    px(bx, by - hh, 1, hh, stem);
    px(bx + (i % 2 ? 1 : -1), by - Math.round(hh * 0.5), 1, Math.round(hh * 0.5), leaf);
    px(bx + (i % 2 ? 2 : -2), by - Math.round(hh * 0.62), 1, Math.round(hh * 0.25), leaf);
    px(bx - 1, by - hh + 3, 3, 6, '#7a4a2a'); px(bx - 1, by - hh + 3, 1, 5, '#9a6a3f');       // 부들 이삭
    px(bx, by - hh, 1, 3, stem);
    if (ice) px(bx - 1, by - hh + 3, 3, 1, '#ffffff');
  });
  [[0.80, 0.58], [0.88, 0.44], [0.72, 0.66]].forEach(([u, v], i) => {
    const bx = Math.round(cx + u * rx), by = Math.round(cy + v * ry) + 2;
    for (let s2 = 0; s2 < 3; s2++){
      const hh = 8 + ((i + s2) % 3) * 3, lean = s2 - 1;
      for (let r = 0; r < hh; r++) px(bx + s2 * 2 + Math.round(lean * r / hh * 2), by - r, 1, 1, r > hh * 0.6 ? leaf : stem);
    }
  });
}
// 오리 두 마리와 물 반짝임 — 매 장. 오리는 서로 다른 크기의 타원을 반대로 돈다(한 바퀴 17초·23초).
function drawPondLive(season, t, L){
  const b = spot('pond'); if (!b) return;
  const ice = season === 'winter', G = pondGeom(b.x * T, b.y * T, b.w * T, b.h * T), { cx, cy, wx, wy } = G;
  if (!ice && L.dark < 0.55) for (let i = 0; i < 6; i++){
    const ph = (t / 1000 + R.prand('pgt' + i) * 7) % 7;
    if (ph > 0.7) continue;
    const iq = isoView ? isoP(b.x + b.w * (0.5 + (R.prand('pgx' + i) - 0.5) * 0.6), b.y + b.h * (0.5 + (R.prand('pgy' + i) - 0.5) * 0.6)) : null;
    const gx = iq ? Math.round(iq.x) : cx + (R.prand('pgx' + i) - 0.5) * wx * 1.3, gy = iq ? Math.round(iq.y) : cy + (R.prand('pgy' + i) - 0.5) * wy * 1.2;
    if (ph < 0.35){ px(gx - 1, gy, 3, 1, '#f2fbff'); px(gx, gy - 1, 1, 3, '#f2fbff'); } else px(gx, gy, 1, 1, '#e3f6fd');
  }
  const B = BEAST.duck, rows = ice ? B.art : B.art.slice(0, 14);                 // 헤엄칠 땐 다리와 배 밑이 물에 잠긴다
  const list = [0, 1].map(i => {
    const dir = i ? -1 : 1, a = dir * t / (i ? 23000 : 17000) * Math.PI * 2 + i * 2.6;
    if (isoView){                                   // 아이소 섬 — 칸 위에서 도는 길을 화면으로 옮긴다
      const k = 0.6 - i * 0.1, ru = 0.39 * b.w * k, rv = 0.38 * b.h * k;
      const q = isoP(b.x + b.w / 2 + Math.cos(a) * ru, b.y + b.h / 2 + Math.sin(a) * rv);
      return { i, x: q.x, y: q.y + 4, flip: (-Math.sin(a) * ru - Math.cos(a) * rv) * dir < 0 };
    }
    const ex = wx - 20 - i * 3, ey = wy - 13 - i * 5;
    return { i, x: cx + Math.cos(a) * ex, y: cy + 5 + Math.sin(a) * ey, flip: -Math.sin(a) * dir < 0 };
  }).sort((p, q) => p.y - q.y);
  list.forEach(o => {
    const x = Math.round(o.x), y = Math.round(o.y), back = o.flip ? 1 : -1;
    const bob = ice ? 0 : Math.round(Math.sin(t / 650 + o.i * 2));
    if (ice){
      footShade(x, y + 6, 20);
      artOut('pondDuckI', rows, x - 12, y + 6 - rows.length, B.pal, o.flip);
      return;
    }
    // 꼬리 뒤로 벌어지는 물살
    for (let k = 1; k <= 3; k++){
      ctx.globalAlpha = 0.75 - k * 0.2;
      const wx2 = x + back * (11 + k * 4) - (back < 0 ? 3 : 0);
      px(wx2, y - k, 3, 1, '#d4f0fa'); px(wx2, y + k, 3, 1, '#d4f0fa');
    }
    ctx.globalAlpha = 1;
    artOut('pondDuck', rows, x - 12, y - rows.length + bob, B.pal, o.flip);
    px(x - 12, y + bob, 24, 1, '#d9f3fb');                                     // 물에 닿는 줄
    px(x - 10, y + bob + 1, 20, 1, '#2f6fa855');
  });
}
/* 별 동상의 번쩍임 세 겹 — 별 뒤로 천천히 도는 빛살, 별 위를 쓸고 지나가는 빛줄기, 둘레에서 터지는 네모꼴 반짝임.
   빛살은 별 바깥에만 찍어 바탕에 구운 별을 가리지 않는다. sc 는 별 가운데(판 그림·아이소 둘 다 쓴다). */
function starLive(sc, t, L){
  const G = STAR_GOLD;
  const glow = 0.45 + 0.2 * Math.sin(t / 700) + L.dark * 0.3;
  ctx.globalAlpha = Math.min(0.85, glow);
  for (let i = 0; i < 8; i++){
    const a = t / 4200 + i * Math.PI / 4, long = i % 2 ? 17 : 21;
    for (let s2 = 11; s2 <= long; s2++){
      const x = Math.round(sc.cx + Math.cos(a) * s2), y = Math.round(sc.cy + Math.sin(a) * s2);
      if (y > sc.cy + 6 || starFace(sc, x - sc.cx + 0.5, y - sc.cy + 0.5) >= 0) continue;   // 기둥 위는 긋지 않는다
      px(x, y, 1, 1, s2 < 15 ? '#ffffff' : G[0]);
    }
  }
  ctx.globalAlpha = 1;
  // 빛줄기 — 네 초마다 한 번, 왼쪽 위에서 오른쪽 아래로
  const sw = (t % 4000) / 700;
  if (sw < 1){
    const k = -sc.R * 2 + sw * sc.R * 4;
    for (let yy = -sc.R; yy <= sc.R; yy++) for (let dd = 0; dd < 3; dd++){
      const xx = Math.round(k - yy) + dd;
      if (starFace(sc, xx + 0.5, yy + 0.5) >= 0) px(sc.cx + xx, sc.cy + yy, 1, 1, dd === 1 ? '#ffffff' : G[0]);
    }
  }
  // 반짝임 다섯 — 자리마다 제 박자로 켜졌다 꺼진다
  [[-12, -9, 0], [11, -11, 1.3], [13, 4, 2.6], [-13, 6, 3.7], [1, -16, 5.1]].forEach(([dx, dy, ph]) => {
    const v = Math.sin(t / 520 + ph * 1.7);
    if (v < 0.35) return;
    const x = sc.cx + dx, y = sc.cy + dy, n = v > 0.8 ? 3 : v > 0.6 ? 2 : 1;
    px(x, y - n, 1, n * 2 + 1, '#ffffff'); px(x - n, y, n * 2 + 1, 1, '#ffffff');
    if (n > 1) px(x, y, 1, 1, G[0]);
  });
}
function drawDecorLive(season, t, L){
  const d = W.decor || {};
  if (d.statue){ const b = spot('statue'); starLive(starGeom(b.x * T, b.y * T), t, L); }
  if (d.pond) drawPondLive(season, t, L);
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
    flagCloth(X + 17, Y + 3, 12, 10, t, (c, r) => r < 5 ? '#ffb7d5' : '#fff3a0');
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
  const A = artSize(), Wp = A.w, Hp = A.h;
  flies.forEach(f => {
    f.x = (f.sx * Wp + Math.sin(t / 1500 + f.ph * 1.3) * 36 + Wp) % Wp;
    f.y = (f.sy * Hp + Math.cos(t / 1900 + f.ph * 2.1) * 26 + Hp) % Hp;
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 700 + f.ph * 1.7));
    ctx.globalAlpha = a * 0.5; px(f.x - 3, f.y - 3, 10, 10, '#9bea6e');
    ctx.globalAlpha = a; px(f.x, f.y, 4, 4, '#ffe66d'); px(f.x + 1, f.y + 1, 2, 2, '#ffffff');
    ctx.globalAlpha = 1;
  });
}
function flyAt(tx, ty){ const c = isoView ? isoP(tx + 0.5, ty + 0.5) : { x: tx * T + T / 2, y: ty * T + T / 2 }; return flyAtPix(c.x, c.y); }
// 누른 화면 도트 가까이의 반딧불이 — 아이소 섬에서는 칸이 아니라 누른 자리로 견줘야 지붕 앞을 나는 것도 잡힌다
function flyAtPix(px0, py0){
  let best = -1, bd = 24;
  flies.forEach((f, i) => { const d = Math.hypot(f.x - px0, f.y - py0); if (d < bd){ bd = d; best = i; } });
  return best;
}
function drawCritters(season, t, L){
  const A = artSize(), Wp = A.w, Hp = A.h;
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
  if (isoView && !isoChimney) return;
  const b = spot('house'), X = isoView ? isoChimney.x - 2 : b.x * T + b.w * T - 34, Y = isoView ? isoChimney.y : b.y * T - 4;
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
  const A = artSize(), Wp = A.w, Hp = A.h;
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
  const bw = 116, bh = 10, at = fishing.at;
  let top;
  if (at){
    // 바다낚시 — 찌가 떨어진 자리에서 물결 따라 까딱인다
    const bob = Math.round(Math.sin(t / 260) * 1.5) + (fishOpen() ? 2 : 0);
    ctx.globalAlpha = 0.5; px(Math.round(at.x) - 5, Math.round(at.y) + 2, 10, 1, '#e8f6ff'); ctx.globalAlpha = 1;
    px(Math.round(at.x) - 1, Math.round(at.y) - 4 + bob, 3, 3, '#ff5a4a');
    px(Math.round(at.x) - 1, Math.round(at.y) - 1 + bob, 3, 2, '#fff6e9');
    top = { x: at.x, y: at.y - 8 };
  } else {
    const b = spot('pond');
    top = isoView ? isoP(b.x + b.w / 2, b.y) : { x: b.x * T + b.w * T / 2, y: b.y * T };
  }
  // 연못이 화면 구석에 있으면 바가 잘린다 — 안쪽으로 밀어 넣는다
  const bx = Math.max(6, Math.min(artSize().w - bw - 6, Math.round(top.x - bw / 2)));
  const by = Math.max(6, Math.round(top.y - 22));
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
  if (isoView) return isoPlaceOverlay(t);
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
  // 채집 나무·바위·덤불과 풍경도 옮길 수 있다 — 한 칸 초록 테두리(2026-10-07)
  Object.keys(R.NODES).map(n => Object.assign({ id: n }, nodeOf(n))).concat(R.sceneryOf(W)).forEach(N => outlineBox({ x: N.x, y: N.y, w: 1, h: 1 }, N.id === placePick ? (Math.sin(t / 180) > 0 ? '#ffe066' : '#ffffff') : '#7fe0a8'));
}

// 나무·바위·덤불의 자리 — 새 농장은 저마다 다르다(규칙의 nodeSpot). 그림에 넘길 때는 종류·계절 표에 자리를 얹는다
function nodeOf(n){ return Object.assign({}, R.NODES[n], R.nodeSpot(W, n)); }

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
  sig += '|' + COLS + 'x' + ROWS;                        // 섬 크기가 다른 농장으로 옮겨 가면 다시 그린다
  const L = layerCv(name, w, h);
  if (L.sig !== sig){
    L.sig = sig;
    const g = L.cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    const keep = ctx; ctx = g; fn(g); ctx = keep;
  }
  return L.cv;
}
function dropLayers(){ Object.keys(layers).forEach(k => { layers[k].sig = null; }); [spriteBuf, furnCache, dotBuf, isoBuf].forEach(o => Object.keys(o).forEach(k => { delete o[k]; })); }
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
function sigGround(season, wk){ return season + '|' + wk + '|' + (W.farm || 0) + (wetYesterday() ? '|y' : ''); }
// 어제 비가 왔나 — 꽃구름 섬은 비 갠 다음 날 무지개가 짙다
function wetYesterday(){
  const t = now() - R.DAY_MS, w = R.weatherOf(R.dayKey(t), R.calendar(W, t).season);
  return w === 'rain' || w === 'storm';
}
function sigBuilt(cal, night){
  let s = cal.season + '|' + (night ? 'n' : 'd') + '|' + (W.expand || 0) + '|' + (W.farm || 0);
  Object.keys(R.BUILDINGS).forEach(b => { if (W.buildings[b] && W.buildings[b].done) s += b; });
  s += '|' + Object.keys(W.decor || {}).sort().join(',') + '|' + JSON.stringify(W.layout || {});
  s += '|' + ((W.buildings.hive && W.buildings.hive.honey) || 0) + '|' + (key ? (W.mail[key] || []).length : 0);
  return s;
}
function sigField(){
  const n = now();
  let s = (W.farm || 0) + ':' + (W.expand || 0) + '|';
  R.plotIds(W, 'field').forEach(id => { const p = W.plots[id]; s += p && p.tilled ? (R.wetNow(p, n, false) ? 'W' : 'T') + (p.fert ? 'f' : '') : '.'; });
  return s;
}
function sigCrops(windStep){
  let s = windStep + '|' + curWind.toFixed(2) + '|';
  R.plotIds(W, 'field').forEach(id => { const p = W.plots[id]; s += p && p.crop ? p.crop.charAt(0) + R.stageOf(p) + (p.wilted ? 'x' : '') + (p.giant ? 'G' : '') : '.'; });
  return s;
}
function sigFront(season){ return season + '|' + (W.farm || 0) + '|' + JSON.stringify(W.layout || {}) + '|' + (W.expand || 0) + '|' + (W.buildings.pasture && W.buildings.pasture.done ? 1 : 0); }
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
  const Wp = COLS * T, base = ROWS * T, LK = farmLook();
  if (LK && LK.front === 'sea') return drawFrontSea(season);
  if (LK && LK.front === 'cloud') return drawFrontCloud(season);
  const C = season === 'autumn' ? ['#8a6a2e', '#6f5424', '#54401b', '#a8853c']
          : season === 'winter' ? ['#7f9a8c', '#67806f', '#4e6356', '#9db4a5']
          : LK && LK.front === 'rocks' ? ['#3f6f58', '#335e4a', '#264a3a', '#4f8468']
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
  if (LK && LK.front === 'rocks') drawFrontRocks(season);
}
// 산골 농장 — 수풀 사이로 바위가 솟고 어린 소나무가 선다
function drawFrontRocks(season){
  const Wp = COLS * T, base = ROWS * T, snow = season === 'winter';
  for (let i = 0; i < 9; i++){
    const x = Math.floor(R.prand('frx' + i) * (Wp - 20)) + 10, w = 16 + Math.floor(R.prand('frw' + i) * 16), h = 12 + Math.floor(R.prand('frh' + i) * 12);
    blob(x, base - h, w, h + 2, STONE.low, STONE.hi, STONE.dark, 'fr' + i);
    px(x - w / 4, base - h + 3, w / 3, 1, STONE.line);                      // 금 한 줄
    if (snow) px(x - w / 3, base - h, (w * 2) / 3, 2, '#f2f9ff');
  }
  for (let i = 0; i < 7; i++){
    const x = Math.floor(R.prand('fpx' + i) * (Wp - 30)) + 15, h = 30 + Math.floor(R.prand('fph' + i) * 16);
    const c = ['#2f6a4a', '#3c7d57', '#23533a'];
    for (let r = 0; r < h - 6; r += 2){                                    // 층층이 넓어지는 잎
      const tier = (r % 10) / 10, ww = 2 + Math.round((r / h) * 18 * (0.6 + tier * 0.5));
      px(x - ww / 2, base - h + r, ww, 2, r % 10 < 4 ? c[1] : c[0]);
      px(x + ww / 2 - 2, base - h + r, 2, 2, c[2]);
      if (snow && r % 10 === 0) px(x - ww / 2, base - h + r, ww / 2, 1, '#f2f9ff');
    }
    px(x - 2, base - 6, 4, 6, WOOD.dark);
  }
}
// 바닷가 농장 — 풀밭이 모래사장으로 이어지고 맨 아래에 파도가 친다
function drawFrontSea(season){
  const Wp = COLS * T, base = ROWS * T, snow = season === 'winter';
  const sand = snow ? ['#eef0ec', '#dfe4e2'] : ['#f2dfae', '#e3c890'];
  for (let x = 0; x < Wp; x += 2){                                         // 모래 — 윗가장자리를 물결치게
    const top = base - 16 + Math.round(Math.sin(x / 23) * 2 + hash2(x, 0, 301) * 2);
    px(x, top, 2, base - top, sand[0]);
    if (hash2(x, 1, 302) > 0.7) px(x, top + 3 + Math.floor(hash2(x, 2, 303) * 6), 1, 1, sand[1]);
  }
  for (let x = 0; x < Wp; x += 2){                                         // 바다와 흰 거품
    const top = base - 6 + Math.round(Math.sin(x / 17 + 1) * 1.5);
    px(x, top, 2, base - top, '#4fa6db'); px(x, top + 3, 2, base - top - 3, '#3b8cc6');
    if (hash2(x, 3, 304) > 0.35) px(x, top - 1, 2, 2, '#ffffff');
  }
  for (let i = 0; i < 12; i++){                                            // 조개와 불가사리
    const x = Math.floor(R.prand('fsh' + i) * Wp), y = base - 13 + Math.floor(R.prand('fsy' + i) * 4);
    if (i % 3 === 0){ px(x, y, 5, 1, '#ff9a7a'); px(x + 2, y - 2, 1, 5, '#ff9a7a'); px(x + 2, y, 1, 1, '#ffd0b8'); }
    else { px(x, y, 4, 3, '#fbe3dc'); px(x, y, 4, 1, '#ffffff'); px(x + 1, y + 2, 2, 1, '#e8b8a8'); }
  }
  for (let i = 0; i < 40; i++){                                            // 모래언덕 풀
    const x = Math.floor(R.prand('fdx' + i) * (Wp + 8)) - 4, h = 8 + Math.floor(R.prand('fdh' + i) * 12);
    const c = snow ? '#9db4a5' : i % 2 ? '#8fb865' : '#a9c877';
    px(x, base - 14 - h, 1, h, c); px(x + 2, base - 12 - h, 1, h - 2, shade(c, -18)); px(x - 2, base - 11 - h + 4, 1, h - 5, c);
  }
}
// 꽃구름 농장 — 가장자리가 뭉게구름이라 땅이 하늘에 떠 있다
function drawFrontCloud(season){
  const Wp = COLS * T, base = ROWS * T;
  const tone = [['#f4eefe', '#ffffff', '#ddd2f2'], ['#fdeef5', '#ffffff', '#efcfe0'], ['#eef7fe', '#ffffff', '#cfe2f2']];
  for (let i = 0; i < 26; i++){
    const x = Math.floor(R.prand('fcx' + i) * (Wp + 40)) - 20, w = 30 + Math.floor(R.prand('fcw' + i) * 34), h = 16 + Math.floor(R.prand('fch' + i) * 14);
    const tn = tone[i % 3];
    blob(x, base - h + 4, w, h, tn[0], tn[1], tn[2], 'fc' + i);
  }
  if (season !== 'winter') for (let i = 0; i < 18; i++){                  // 구름 위에 핀 꽃
    const x = Math.floor(R.prand('fcf' + i) * Wp), y = base - 10 - Math.floor(R.prand('fcg' + i) * 12);
    const c = ['#ffb7d5', '#c9a8ff', '#fff3a0', '#9ad8ff'][i % 4];
    px(x, y, 2, 2, c); px(x - 2, y + 2, 6, 2, c); px(x, y + 4, 2, 2, c); px(x, y + 2, 2, 2, '#fff6c0');
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
/* ================= 새 농장 — 아이소메트릭 섬 =================
   이사 간 농장(W.farm ≥ 1)은 위에서 내려다본 판 대신 비스듬히 내려다본 섬으로 그린다
   (2026-09-28 로키즈: 「이전 농장과 완전히 다른 느낌, 농장 메인화면도 아이소메트릭으로 여러 층 레이어」).
   규칙의 칸(20×16)은 그대로다 — 칸 (u,v) 를 마름모에 옮겨 그릴 뿐이라 배치·길찾기·저장은 안 바뀐다.
   겹은 먼 하늘 → 먼 풍경 두세 겹 → 섬 아래(바다·골짜기·구름) → 땅켜가 드러난 절벽 → 섬 윗면 →
   바닥에 붙은 것(밭·연못·목장 바닥) → 작물 → 깊이순으로 선 것(건물·나무·아이·동물) → 날씨·빛.
   집·가게·닭장·외양간·온실은 아이소 상자로 새로 짓고, 작은 것(우물·우편함·꾸미개…)은
   원래 그림을 그 칸 위에 곧게 세운다. 면은 캔버스 path 대신 도트 줄로 채워 가장자리가 뭉개지지 않는다. */
const IT = 40, IH = 20;                  // 칸 마름모의 가로·세로(도트)
const ITOP = 108, ICLIFF = 72;           // 맨 뒤 꼭짓점 위로 남긴 하늘 · 섬 아래로 드러난 땅켜
let ISO_W = 0, ISO_H = 0, IOX = 0;
// 섬 크기는 농장마다 다르다(규칙의 gridOf — 새 농장일수록 넓다). 그림·길찾기·누르기가 모두 COLS·ROWS 를 보므로
// 지금 보는 농장에 맞춰 둔다. withView 가 들어가고 나올 때 부른다(옛 농장 구경 중에는 그 농장 크기)
function syncGrid(){
  const G = W && R.gridOf ? R.gridOf(W) : R.GRID;
  if (G.w === COLS && G.h === ROWS && ISO_W) return;
  COLS = G.w; ROWS = G.h;
  ISO_W = (COLS + ROWS) * IT / 2; ISO_H = ITOP + (COLS + ROWS) * IH / 2 + ICLIFF + 12; IOX = ROWS * IT / 2;
}
syncGrid();
let isoView = false, isoHits = [], isoChimney = null, lampOff = null;
const isoBuf = {};
function isoMode(){ return !!W && (W.farm || 0) >= 1; }
// 칸 (u,v) 의 바닥에서 z 도트 위 → 화면 도트
function isoP(u, v, z){ return { x: IOX + (u - v) * IT / 2, y: ITOP + (u + v) * IH / 2 - (z || 0) }; }
function isoTileAt(x, y){ const a = (x - IOX) / (IT / 2), b = (y - ITOP) / (IH / 2); return { u: (a + b) / 2, v: (b - a) / 2 }; }
// 아이·동물은 위에서 본 좌표(도트)로 걷는다. 누른 자리와 견줄 때 화면 자리로 옮긴다.
function actorScreen(x, y){ return isoView ? isoP(x / T, y / T) : { x, y }; }
function artSize(){ return isoView ? { w: ISO_W, h: ISO_H } : { w: COLS * T, h: ROWS * T }; }
// 다각형을 도트 줄로 채운다. col 이 함수면 도트마다 색을 묻고 같은 색끼리 한 번에 칠한다.
function polyFill(pts, col){
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts){ if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const fn = typeof col === 'function';
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++){
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++){
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2){
      const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
      if (xb <= xa) continue;
      if (!fn){ px(xa, y, xb - xa, 1, col); continue; }
      let rs = xa, rc = col(xa, y);
      for (let x = xa + 1; x <= xb; x++){
        const c = x < xb ? col(x, y) : null;
        if (c !== rc){ if (rc) px(rs, y, x - rs, 1, rc); rs = x; rc = c; }
      }
    }
  }
}
function poly3(pts, col){ polyFill(pts.map(p => { const q = isoP(p[0], p[1], p[2]); return [q.x, q.y]; }), col); }
function isoSeg(a, b, col, th){
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
  let last = '';
  for (let i = 0; i <= n; i++){
    const x = Math.round(a.x + dx * i / n), y = Math.round(a.y + dy * i / n), k = x + ',' + y;
    if (k !== last){ last = k; px(x, y, 1, th || 1, col); }
  }
}
// 칸 네모(x,y,w,h) 안의 도트마다 colFn(u,v) 색을 칠한다. z 만큼 떠 있는 면도 된다.
function isoPaintRect(x, y, w, h, colFn, z){
  z = z || 0;
  const top = isoP(x, y, z).y, bot = isoP(x + w, y + h, z).y, xa = Math.floor(isoP(x, y + h).x), xb = Math.ceil(isoP(x + w, y).x);
  for (let yy = Math.floor(top); yy < Math.ceil(bot); yy++){
    let rs = xa, rc = null;
    for (let xx = xa; xx <= xb; xx += 2){
      let c = null;
      if (xx < xb){
        const q = isoTileAt(xx + 1, yy + 0.5 + z);
        if (q.u >= x && q.v >= y && q.u < x + w && q.v < y + h) c = colFn(q.u, q.v);
      }
      if (c !== rc){ if (rc) px(rs, yy, xx - rs, 1, rc); rs = xx; rc = c; }
    }
  }
}
// 작은 상자 하나 — 굴뚝·기둥·광주리·화분 같은 것. 보이는 세 면(위·왼쪽 앞·오른쪽 앞)만.
function isoCube(u, v, su, sv, z0, z1, top, lf, rt){
  poly3([[u, v + sv, z0], [u + su, v + sv, z0], [u + su, v + sv, z1], [u, v + sv, z1]], lf);
  poly3([[u + su, v + sv, z0], [u + su, v, z0], [u + su, v, z1], [u + su, v + sv, z1]], rt);
  poly3([[u, v, z1], [u + su, v, z1], [u + su, v + sv, z1], [u, v + sv, z1]], top);
  // 윗면 앞 모서리 두 줄에 빛 — 작은 상자도 모서리가 선다(너무 작거나 칠이 무늬면 건너뛴다)
  if (typeof top === 'string' && top.length === 7 && top[0] === '#' && (su + sv) * IT / 2 >= 6 && z1 - z0 >= 2){
    const hl = shade(top, 22);
    isoSeg(isoP(u, v + sv, z1), isoP(u + su, v + sv, z1), hl, 1);
    isoSeg(isoP(u + su, v + sv, z1), isoP(u + su, v, z1), shade(top, 10), 1);
  }
}

// ---- 섬 풍경 — 농장마다 하늘·먼 풍경·섬 아래·땅켜 빛깔이 다르다 ----
const ISO_LOOK = {
  seaside:  { sky: ['#8fd0f2', '#addcf5', '#cdebf9', '#eef8fd'], horizon: 176, below: 'sea',
              strata: ['#e0c393', '#cfa574', '#b98c66', '#9a7b66'], deep: 64 },
  // 화산 — 검붉은 하늘, 분화하는 화산, 섬 아래는 용암 바다. 땅켜는 검은 현무암(2026-10-06 로키즈 「무시무시하고 척박한 용암지대」)
  mountain: { sky: ['#120a0e', '#2a0f13', '#5e1a12', '#a83514'], horizon: 250, below: 'lava',
              strata: ['#3a302c', '#2a2422', '#201a1a', '#161213'], deep: ICLIFF },
  // 일본 — 옅은 쪽빛 하늘, 섬 옆구리는 성처럼 쌓은 돌담(이시가키) 아래 이끼 낀 흙(2026-10-07 로키즈 「좀 더 일본스럽게」)
  cloud:    { sky: ['#a9d2f2', '#c6e2f6', '#e6eef4', '#fbeaee'], horizon: 330, below: 'clouds',
              strata: ['#a29e94', '#959188', '#6a5848', '#4f4236'], deep: ICLIFF, wall: true },
};
function isoLook(){ return ISO_LOOK[R.farmOf(W).id] || ISO_LOOK.seaside; }
// 하늘은 네 빛깔을 띠로 깔고 사이를 흩뿌려 잇는다
function isoSky(K, y0, y1){ isoGrad(y0, y1, K.sky); }
/* 빛깔 띠를 흩뿌림으로 잇는다. 도트마다 칠하면 한 장에 20만 번이라(재 봄) 한 도트 = 한 픽셀인
   작은 그림에 한 번 구워 두고 늘여 붙인다. 흩뿌림 무늬는 ditherRow 와 같은 BAYER 다. */
const gradMemo = {};
function isoGrad(y0, y1, cols){
  const key = ISO_W + '|' + y0 + '|' + y1 + '|' + cols.join(',');
  let c = gradMemo[key];
  if (!c){
    const h = Math.max(1, y1 - y0), n = cols.length - 1;
    c = document.createElement('canvas'); c.width = ISO_W; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(ISO_W, h), d = img.data;
    const rgb = cols.map(x => { const v = parseInt(x.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; });
    for (let y = 0; y < h; y++){
      const tt = y / h * n, k = Math.min(n - 1, Math.floor(tt)), th = Math.round((tt - k) * 16), r4 = ((y0 + y) % 4 + 4) % 4;
      for (let x = 0; x < ISO_W; x++){
        const q = rgb[th > 0 && BAYER[r4 * 4 + (x % 4)] < th ? k + 1 : k], i = (y * ISO_W + x) * 4;
        d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    gradMemo[key] = c;
  }
  const keep = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, Math.round(y0 * S), Math.round(ISO_W * S), Math.round(y1 * S) - Math.round(y0 * S));
  ctx.imageSmoothingEnabled = keep;
}
// 산등성이 한 겹 — 사인 몇 개와 잡음으로 봉우리를 세운다. 아래는 끝까지 채운다.
function isoRidge(base, amp, col, seed, snow, bot){
  for (let x = 0; x < ISO_W; x += 2){
    const h = amp * (0.55 + 0.25 * Math.sin(x / 61 + seed) + 0.15 * Math.sin(x / 23 + seed * 2.3) + 0.12 * (hash2(x >> 3, seed, 911) - 0.5));
    const top = Math.round(base - h);
    px(x, top, 2, (bot || ISO_H) - top, col);
    if (snow && h > amp * 0.62) px(x, top, 2, Math.round((h - amp * 0.62) * 0.9) + 1, snow);
    else if (hash2(x, seed, 912) > 0.7) px(x, top, 2, 1, shade(col, 14));
  }
}
function isoCloudPuff(cx, cy, w, h, tone, seed){ blob(cx, cy, w, h, tone[0], tone[1], tone[2], seed); }
// 매끄러운 잡음 — 칸 꼭짓점의 hash2 를 부드럽게 잇는다(건물·땅 그을음 얼룩)
function vnoise(x, y, s){
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/* 화산 섬 건물 — 다 그린 그림 위에 불길이 핥고 간 자국과 금을 낸다(2026-10-06 로키즈 「건물이 너무 깔끔하다,
   여기저기 균열이 가고 군데군데 타들어간 느낌」). 건물마다 따로 그리지 않고 구운 그림을 도트 단위로 손본다 —
   집·외양간·닭장·가게·꾸미개가 한 번에 같은 결로 낡는다. 도트(S 픽셀 네모) 단위로 칠해 도트 그림 결을 지킨다.
   · 바램: 모든 색을 조금 잿빛·누렇게 눌러 오래된 칠처럼(꾸미개도 — 로키즈 「꾸미개도 지저분하고 오래된 느낌」).
   · 그을음: 아래에서 올라온 불처럼 밑동일수록 짙고, 얼룩 잡음으로 군데군데 번진다. 가장 탄 자리는 숯처럼 검고 불씨가 남았다.
   · 균열: 몸에서 시작해 아래로 지그재그로 내려가는 검은 금. 오른쪽 옆 도트는 밝게 — 깨진 턱이 선다. 셋에 하나는 속에 용암빛. */
function scorchSprite(cv, id, o){
  o = o || {};
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, n = o.n || Math.max(1, Math.round(S)), bk = o.burn == null ? 1 : o.burn, fd = o.fade == null ? 1 : o.fade;
  const img = g.getImageData(0, 0, W2, H2), d = img.data, cw = Math.floor(W2 / n), chh = Math.floor(H2 / n);
  let seed = 7; for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0;
  for (let i = 0; i < d.length; i += 4){                                        // 바래고 때 탄 빛깔 — 새 칠이 아니라 오래 볕과 재를 맞았다
    if (d[i + 3] < 8) continue;
    const gy = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const m = 0.28 * fd, r0 = d[i] * (1 - m) + gy * m, g0 = d[i + 1] * (1 - m) + gy * m, b0 = d[i + 2] * (1 - m) + gy * m;
    d[i] = Math.round(r0 * (1 - 0.1 * fd) + 6 * fd); d[i + 1] = Math.round(g0 * (1 - 0.12 * fd) + 2 * fd); d[i + 2] = Math.round(b0 * (1 - 0.14 * fd));
  }
  if (!bk){ g.putImageData(img, 0, 0); return; }
  const at = (cx, cy) => (Math.min(H2 - 1, cy * n + (n >> 1)) * W2 + Math.min(W2 - 1, cx * n + (n >> 1))) * 4;
  const solid = (cx, cy) => cx >= 0 && cy >= 0 && cx < cw && cy < chh && d[at(cx, cy) + 3] > 200;
  const put = (cx, cy, r, gg, b) => {
    for (let y = cy * n; y < Math.min(H2, cy * n + n); y++) for (let x = cx * n; x < Math.min(W2, cx * n + n); x++){
      const i = (y * W2 + x) * 4; if (d[i + 3] < 8) continue; d[i] = r; d[i + 1] = gg; d[i + 2] = b;
    }
  };
  // 그림이 차지한 세로 범위 — 밑동 쪽이 더 탄다
  let top = chh, bot = 0;
  for (let cy = 0; cy < chh; cy++) for (let cx = 0; cx < cw; cx += 2) if (solid(cx, cy)){ if (cy < top) top = cy; bot = cy; }
  if (bot <= top) return;
  for (let cy = top; cy <= bot; cy++) for (let cx = 0; cx < cw; cx++){
    if (!solid(cx, cy)) continue;
    const i = at(cx, cy), low = (cy - top) / (bot - top);
    const nz = vnoise(cx / 9, cy / 9, seed) * 0.6 + vnoise(cx / 4, cy / 4, seed + 1) * 0.4;
    const burn = Math.max(0, (nz - 0.5) * 2.4 + low * low * 0.7 - 0.12) * bk;
    if (burn <= 0) continue;
    const th = BAYER[(cy & 3) * 4 + (cx & 3)] / 16;
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    if (burn > 0.95 && th < 0.9){                                               // 숯 — 검게 타 버린 자리
      const ember = hash2(cx, cy, seed + 3) > 0.94;
      if (ember){ r = 255; gg = 106; b = 26; } else { r = 26; gg = 20; b = 18; }
    } else if (th < burn){                                                      // 그을음 — 원래 색을 검붉게 눌러 흩뿌린다
      const k = Math.min(0.8, 0.35 + burn * 0.4);
      r = Math.round(r * (1 - k) + 34 * k); gg = Math.round(gg * (1 - k) + 24 * k); b = Math.round(b * (1 - k) + 22 * k);
    } else continue;
    put(cx, cy, r, gg, b);
  }
  // 균열
  // 금 개수 — 처음엔 넓이 900 도트마다 하나(3~14개)였는데 많다고 해서(2026-10-06 로키즈 「크랙 약간만 줄여」) 1300 마다, 2~9개로
  const area = (bot - top) * cw, count = Math.round(Math.max(2, Math.min(9, Math.round(area / 1300))) * (o.cracks == null ? 1 : o.cracks));
  for (let k = 0; k < count; k++){
    let cx = Math.floor(hash2(k, 1, seed) * cw), cy = top + Math.floor(hash2(k, 2, seed) * (bot - top) * 0.8), tries = 0;
    while (!solid(cx, cy) && tries++ < 30){ cx = Math.floor(hash2(k, 10 + tries, seed) * cw); cy = top + Math.floor(hash2(k, 40 + tries, seed) * (bot - top) * 0.8); }
    if (!solid(cx, cy)) continue;
    const glow = hash2(k, 3, seed) > 0.66, len = 6 + Math.floor(hash2(k, 4, seed) * 12);
    let dir = hash2(k, 5, seed) > 0.5 ? 1 : -1;
    for (let s2 = 0; s2 < len; s2++){
      if (!solid(cx, cy)) break;
      if (solid(cx + 1, cy)){ const j = at(cx + 1, cy); put(cx + 1, cy, Math.min(255, d[j] + 22), Math.min(255, d[j + 1] + 20), Math.min(255, d[j + 2] + 18)); }
      put(cx, cy, glow && s2 > 1 && s2 < len - 2 ? 255 : 18, glow && s2 > 1 && s2 < len - 2 ? 96 : 12, glow && s2 > 1 && s2 < len - 2 ? 24 : 12);
      cy += 1; if (hash2(k, s2, seed + 9) > 0.55) cx += dir;
      if (hash2(k, s2, seed + 11) > 0.85) dir = -dir;
      if (hash2(k, s2, seed + 13) > 0.9 && solid(cx - dir, cy)) put(cx - dir, cy, 18, 12, 12);   // 곁가지
    }
  }
  g.putImageData(img, 0, 0);
}
/* 화산 섬 식물 — 작물·덤불·나무를 잿빛에 눌린 어두운 빛깔로(2026-10-06 로키즈 「식물들도 분위기에 맞게 어두운 톤」).
   색을 반쯤 잿빛으로 빼고 검붉게 눌러, 초록이 재 낀 진녹·검보라로 가라앉는다. 무늬·모양은 그대로라 무엇이 자라는지는 읽힌다. */
function duskPlants(cv){
  const g = cv.getContext('2d'), img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4){
    if (d[i + 3] < 8) continue;
    const gy = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    d[i] = Math.round((d[i] * 0.55 + gy * 0.45) * 0.7 + 10); d[i + 1] = Math.round((d[i + 1] * 0.55 + gy * 0.45) * 0.62 + 2); d[i + 2] = Math.round((d[i + 2] * 0.55 + gy * 0.45) * 0.64 + 6);
  }
  g.putImageData(img, 0, 0);
}
// 굳은 껍질 판 — 칸마다 씨앗 점 하나, 가장 가까운 두 씨앗까지 거리 차(e)가 작으면 판과 판 사이 금이다
function plates(x, y){
  const i0 = Math.floor(x), j0 = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++){
    const dx = i + hash2(i, j, 974) - x, dy = j + hash2(i, j, 975) - y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < f1){ f2 = f1; f1 = d; id = i * 7919 + j; } else if (d < f2) f2 = d;
  }
  return { e: f2 - f1, f1, id };
}
/* 화산 섬의 화산 둘 — 크고 분화하는 것(섬 오른쪽 뒤), 작고 연기만 나는 것(왼쪽 뒤).
   x 가운데 · top 분화구 높이 · h 높이 · cr 분화구 반폭 · flows 분화구 어디서 흘러내리는지(dx, 기울기) */
const VOLCS = [
  { x: 614, top: 40, h: 214, cr: 20, flows: [[-12, -0.55], [3, 0.12], [14, 0.6]], erupt: true },
  { x: 112, top: 140, h: 116, cr: 9, flows: [[2, 0.35]] },
];
function volcHalf(V, y){ return V.cr + (V.h * 0.92) * Math.pow(Math.max(0, y - V.top) / V.h, 1.15); }
function volcFlowX(V, f, y){ return V.x + f[0] + f[1] * (volcHalf(V, y) - V.cr) * 0.8 + Math.sin(y / 9 + f[0]) * 2.4; }
// 섬 뒤 가장자리의 높이 — 이보다 아래는 섬 땅이라 움직이는 먼 풍경을 그리면 안 된다
function isoBackEdgeY(x){ return ITOP + Math.abs(x - IOX) / 2; }
function isoVolcano(V){
  const bot = isoLook().horizon + 2;
  if (V.erupt) for (let i = 7; i >= 0; i--)                                    // 분화 기둥 — 위로 갈수록 넓게 퍼져 오른쪽으로 흐른다
    isoCloudPuff(V.x + i * 9, V.top - 10 - i * 11, 26 + i * 12, 12 + i * 2, i < 2 ? ['#6a2a1c', '#8a3a22', '#3a1814'] : ['#2a1e22', '#3a2e32', '#18121a'], 'ivp' + i);
  else for (let i = 0; i < 4; i++) isoCloudPuff(V.x - 4 + i * 6, V.top - 8 - i * 9, 14 + i * 7, 8 + i, ['#3a3236', '#4a4246', '#262024'], 'ivs' + i);
  for (let y = V.top; y < bot; y++){
    const hw = Math.round(volcHalf(V, y)), m = V.x + Math.round(hw * 0.12), l = V.x - hw, r = V.x + hw, f = (y - V.top) / V.h;
    const lit = mix('#4a2a26', '#2e1e1e', Math.min(1, f * 1.4)), dark = mix('#2a1a1c', '#1a1214', Math.min(1, f * 1.4));
    px(l, y, m - l, 1, lit); px(m, y, r - m, 1, dark);
    if (y % 3 === 0) for (let x = l; x < r; x += 2){ const q = hash2(x >> 1, y, 964); if (q > 0.9) px(x, y, 2, 1, shade(x < m ? lit : dark, q > 0.96 ? 14 : -10)); }   // 화산재 결
  }
  // 분화구 — 안쪽이 끓는다
  for (let k = 0; k < 5; k++){ const w = V.cr * 2 - k * 3; px(V.x - Math.round(w / 2), V.top - 2 + k, w, 1, k === 0 ? '#3a1a14' : k < 3 ? '#ff8a1a' : '#ffd84a'); }
  V.flows.forEach(fl => {                                                    // 흘러내리는 용암 줄기 — 아래로 갈수록 식어 가늘고 붉다
    const y1 = V.top + Math.round(V.h * (V.erupt ? 0.86 : 0.7));
    for (let y = V.top + 2; y < Math.min(y1, bot); y++){
      const x = Math.round(volcFlowX(V, fl, y)), cool = (y - V.top) / (y1 - V.top), w = cool < 0.5 ? 4 : 3;
      px(x - 1, y, w + 2, 1, '#5a1a10'); px(x, y, w, 1, cool < 0.7 ? '#e8501a' : '#a82c0c');
      if (cool < 0.55 || hash2(y, x, 965) > 0.6) px(x + 1, y, 1, 1, cool < 0.35 ? '#ffe066' : '#ff8a1a');
    }
  });
}
// 용암 바다 — 굳은 검은 껍질 판 사이로 흐르는 금. 한 도트 = 한 픽셀 그림에 한 번 구워 늘여 붙인다(isoGrad 와 같은 셈)
const lavaMemo = {};
function isoLavaSea(y0, y1){
  const key = ISO_W + '|' + y0 + '|' + y1;
  let c = lavaMemo[key];
  if (!c){
    const h = Math.max(1, y1 - y0);
    c = document.createElement('canvas'); c.width = ISO_W; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(ISO_W, h), d = img.data;
    const hex = x => { const v = parseInt(x.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    const HOT = hex('#ffe066'), ORG = hex('#ff8a1a'), RED = hex('#c8360e'), DRK = hex('#6a1a0c'), CR = [hex('#2a1512'), hex('#331a15'), hex('#21100e'), hex('#3d2019')], HAZE = hex('#6a2414');
    for (let y = 0; y < h; y++){
      const dp = y / h, sx = 10 + dp * 30, sy = 3.5 + dp * 13;               // 멀수록 판이 작고 납작하다
      for (let x = 0; x < ISO_W; x++){
        const wob = (hash2(x >> 2, y >> 1, 970) - 0.5) * 0.08, P = plates(x / sx + wob, y / sy + wob), e = P.e + wob * 0.6;
        const molten = hash2(P.id, 1, 971) < 0.1;                            // 열에 하나는 아직 녹은 판
        let q;
        if (e < 0.025) q = HOT; else if (e < 0.065) q = ORG; else if (e < 0.11) q = RED; else if (e < 0.15) q = DRK;
        else if (molten) q = hash2(x >> 1, y, 976) > 0.7 ? ORG : RED;
        else { const r = hash2(x >> 1, y >> 1, 972); q = r > 0.92 ? CR[1] : r < 0.08 ? CR[2] : P.f1 < 0.18 && r > 0.5 ? CR[3] : CR[0]; }
        if (dp < 0.18 && hash2(x, y, 973) < (0.18 - dp) / 0.18 * 0.75) q = HAZE;   // 먼 데는 열기에 흐리다
        const i = (y * ISO_W + x) * 4; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    lavaMemo[key] = c;
  }
  const keep = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, Math.round(y0 * S), Math.round(ISO_W * S), Math.round(y1 * S) - Math.round(y0 * S));
  ctx.imageSmoothingEnabled = keep;
}
/* 섬 가장자리에서 떨어지는 용암 폭포 자리 — 왼쪽 앞면(v=ROWS)에 둘, 오른쪽 앞면(u=COLS)에 둘.
   처음 배치에서 비어 있는 가장자리 칸이다(나무·바위·돌탑을 피했다). 섬 크기가 바뀌어도 비율로 따라간다. */
function lavaFalls(){
  return [[10.5 / 24, 1], [21.5 / 24, 1], [2.5 / 18, 0], [8.5 / 18, 0]].map(([a, side]) => {
    const g = side ? { u: a * COLS, v: ROWS } : { u: COLS, v: a * ROWS }, q = isoP(g.u, g.v);
    return { u: g.u, v: g.v, side, x: q.x, y: q.y };
  });
}
function isoBackdrop(season){
  const K = isoLook(), winter = season === 'winter';
  if (K.below === 'sea'){
    isoSky(K, 0, K.horizon);
    // 먼 구름 두 겹
    [[80, 46, 70, 18], [250, 30, 90, 20], [470, 52, 80, 18], [640, 34, 64, 16]].forEach((c, i) => isoCloudPuff(c[0], c[1], c[2], c[3], ['#f4fbff', '#ffffff', '#d9eef8'], 'isc' + i));
    // 수평선 너머 먼 섬 — 두 겹, 멀수록 흐리다
    isoRidge(K.horizon + 2, 18, '#9fc9dc', 3, null, K.horizon + 2);
    for (let x = 40; x < 200; x += 2){ const h = Math.round(14 * Math.sin((x - 40) / 160 * Math.PI) + hash2(x >> 2, 5, 913) * 2); px(x, K.horizon - h, 2, h, winter ? '#b9ccd4' : '#7fae95'); }
    // 먼 섬 비탈의 흰 마을 — 네모난 회벽 집이 층층이, 파란 둥근 지붕 둘
    for (let i = 0; i < 10; i++){
      const x = 62 + i * 12 + Math.floor(hash2(i, 1, 930) * 5), h = 3 + Math.floor(hash2(i, 2, 931) * 4);
      const base = K.horizon - Math.round(14 * Math.sin((x - 40) / 160 * Math.PI)) + 4 + (i % 2) * 3;
      px(x, base - h, 7, h, '#f7f4ee'); px(x + 5, base - h, 2, h, '#d3cdc2'); px(x + 2, base - h + 1, 1, 1, '#6d7f95');
      if (i === 3 || i === 7){ px(x + 1, base - h - 3, 5, 3, AEGEAN); px(x + 2, base - h - 4, 3, 1, AEGEAN); }
    }
    // 바다 — 수평선에서 가까워질수록 짙다
    const sea = winter ? ['#a9cfe0', '#8fbcd4', '#77a9c6', '#6397b8'] : ['#7cc6ea', '#5fb2e0', '#469dd2', '#3389c2'];
    isoGrad(K.horizon, ISO_H, sea);
    // 반짝이는 물결 줄
    for (let i = 0; i < 90; i++){
      const x = Math.floor(hash2(i, 1, 914) * ISO_W), y = K.horizon + 4 + Math.floor(Math.pow(hash2(i, 2, 915), 0.8) * (ISO_H - K.horizon - 6));
      const w = 3 + Math.floor((y - K.horizon) / 60) * 2;
      px(x, y, w, 1, i % 3 ? '#bfe6f8' : '#ffffff');
    }
    // 돛단배 하나
    const bx = 590, by = K.horizon + 10;
    px(bx, by, 16, 3, '#8a5a3c'); px(bx + 2, by + 3, 12, 1, '#6f4a2c'); px(bx + 7, by - 14, 1, 14, '#6f4a2c');
    for (let r = 0; r < 12; r++) px(bx + 8, by - 13 + r, Math.round(r * 0.6) + 1, 1, '#fffaf2');
  } else if (K.below === 'lava'){
    isoSky(K, 0, K.horizon);
    // 하늘을 덮은 화산재 구름 — 아래쪽이 용암 빛을 받아 붉다
    for (let i = 0; i < 11; i++){
      const x = Math.floor(hash2(i, 1, 960) * (ISO_W + 60)) - 30, y = 10 + Math.floor(hash2(i, 2, 961) * 70);
      isoCloudPuff(x, y, 70 + Math.floor(hash2(i, 3, 962) * 60), 16, y > 50 ? ['#3a1e1c', '#4a2622', '#24130f'] : ['#1e1216', '#2a1a1e', '#140c10'], 'iva' + i);
    }
    isoRidge(214, 44, '#2c1416', 6.3, null, K.horizon);                       // 먼 산줄기 — 톱니처럼 날카롭다
    VOLCS.forEach(v => isoVolcano(v));
    isoRidge(244, 20, '#170b0d', 8.1, null, K.horizon + 1);                    // 가까운 검은 등성이가 화산 밑동을 가린다
    for (let x = 0; x < ISO_W; x += 2) if (hash2(x >> 2, 1, 963) > 0.55) px(x, K.horizon - 1 - Math.floor(hash2(x, 2, 963) * 3), 2, 1, '#ff6a1a');   // 등성이 너머 용암 빛
    // 섬 아래 — 굳은 껍질 사이로 용암이 흐르는 바다
    isoLavaSea(K.horizon, ISO_H);
    ctx.globalAlpha = 0.35; isoGrad(K.horizon, K.horizon + 10, ['#ff7a1a', '#c8360e', '#5a1a10']); ctx.globalAlpha = 1;   // 수평선 열기
  } else {
    /* 일본 — 병풍 그림처럼 겹겹이 옅어지는 먹빛 산, 사이사이 금빛 띠구름(스야리가스미), 눈 덮인 후지산,
       왼쪽 언덕 위 오층탑, 섬 뒤 왼쪽 가장자리엔 대숲, 오른쪽 가장자리엔 고가 철도(2026-10-07 로키즈 「현대 일본 — 맵 한쪽에 철도」).
       무지개는 뺐다 — 무지개는 「무지개 다리」였던 꾸미개 몫이었는데 그것도 붉은 북다리로 바꿨다. */
    isoSky(K, 0, ISO_H);
    isoRidge(298, 76, winter ? '#d8dfe9' : '#c4d2e4', 2.2, null, 362);         // 먼 산
    isoFuji(winter);
    isoRidge(334, 46, winter ? '#bfcad8' : '#a2b6cd', 4.7, null, 372);          // 가까운 산
    isoPagoda(84, 198, winter);
    // 산 밑동을 덮는 구름
    for (let i = 0; i < 6; i++) isoCloudPuff(Math.floor(hash2(i, 7, 920) * ISO_W), 262 + Math.floor(hash2(i, 8, 921) * 50), 70 + Math.floor(hash2(i, 9, 922) * 50), 20, ['#eef2f8', '#ffffff', '#d8e0ec'], 'icb' + i);
    isoRailway();
    isoBambooGrove(winter);
    // 구름바다 — 섬 아래로 세 겹
    [['#e2e8f1', '#f6f8fc', '#cdd6e4', 350], ['#edf1f7', '#ffffff', '#d8e0ec', 420], ['#ffffff', '#ffffff', '#e4eaf2', 490]].forEach((tn, L) => {
      for (let i = 0; i < 16; i++){
        const x = Math.floor(hash2(i, 10 + L, 923) * (ISO_W + 80)) - 40, w = 70 + Math.floor(hash2(i, 13 + L, 924) * 60);
        isoCloudPuff(x, tn[3] + Math.floor(hash2(i, 16 + L, 925) * 30), w, 34, tn, 'icl' + L + '_' + i);
      }
    });
    // 떠 있는 작은 바위섬 둘
    [[90, 380], [640, 420]].forEach(([x, y], i) => {
      for (let r = 0; r < 14; r++){ const w = Math.round(14 - r); px(x - w, y + r, w * 2, 1, r < 3 ? '#7fa86a' : shade('#8f8c84', -r * 3)); }
      if (i === 1) px(x - 1, y - 8, 2, 8, WOOD.dark), blob(x, y - 12, 12, 9, '#ffc2d8', '#ffe0ec', '#e89ab8', 'irk' + i);   // 작은 벚나무
      else {                                                                   // 붉은 도리이 — 섬 왼쪽 바위섬이라 늘 보인다
        px(x - 9, y - 22, 3, 22, '#e8453c'); px(x + 6, y - 22, 3, 22, '#e8453c');
        px(x - 13, y - 26, 26, 3, '#e8453c'); px(x - 14, y - 28, 28, 2, WA.ink); px(x - 11, y - 19, 22, 2, '#e8453c');
      }
    });
  }
}
// ---- 꽃구름(일본) 섬의 먼 풍경 ----
// 후지산 — 쪽빛 몸에 눈 덮인 머리. 눈 끝은 골짜기 따라 손가락처럼 흘러내리고, 밑동은 안개에 풀린다.
function isoFuji(winter){
  const fx = 560, ftop = 58, H = 200, haze = winter ? '#d8dfe9' : '#c4d2e4';
  for (let y = 0; y < H; y += 1){
    const f = y / H, half = Math.round(13 + 160 * Math.pow(f, 1.35)), m = fx + Math.round(half * 0.1), fog = Math.max(0, (f - 0.55) / 0.45);
    for (let x = fx - half; x < fx + half; x += 2){
      const lit = x < m, finger = Math.max(0, Math.sin((x - fx) / 5.3)) * (hash2(x >> 2, 1, 955) > 0.35 ? 1 : 0.3);
      const snowY = (winter ? 96 : 46) + Math.round(finger * 22 + Math.sin(x / 2.1) * 2);
      let c = y < snowY ? (lit ? '#fbfcff' : '#dfe4f2') : lit ? '#7d90c2' : '#62739f';
      if (y >= snowY && hash2(x >> 1, y, 959) > 0.93) c = shade(c, 10);                   // 산비탈 결
      if (fog > 0) c = mix(c, haze, fog * 0.85);
      px(x, ftop + y, 2, 1, c);
    }
  }
}
// 오층탑 — 왼쪽 먼 언덕 위. 주홍 몸에 짙은 기와 처마가 다섯 겹, 끝이 살짝 들렸다. 꼭대기엔 고리 달린 상륜.
function isoPagoda(x, y, winter){
  const hill = winter ? '#a9b8c6' : '#7d9a8e';
  for (let r = 0; r < 70; r++){ const w = Math.round(16 + Math.sqrt(r / 70) * 84); px(x - w, y + r, w * 2, 1, r < 2 ? shade(hill, 12) : hill); }   // 둥근 언덕
  for (let i = 0; i < 11; i++){ const tx = x - 70 + i * 14, ty = y + 6 + Math.round(Math.pow(Math.abs(i - 5) / 5, 2) * 40) + (i % 2) * 3; blob(tx, ty, 12, 9, winter ? '#c8d2dc' : '#6a8a78', winter ? '#eef2f6' : '#86a490', winter ? '#9aa8b6' : '#536f60', 'pgt' + i); }   // 언덕 나무
  const body = '#c0503c', bodyD = '#9a3e30', roof = '#3e4658', roofL = '#59627a', snow = '#f4f6fa';
  let yy = y;
  for (let i = 0; i < 5; i++){
    const bw = Math.round(7 - i * 0.8), rw = bw + 7;
    px(x - bw, yy - 7, bw, 7, body); px(x, yy - 7, bw, 7, bodyD);                         // 몸 — 왼쪽이 빛을 받는다
    px(x - bw + 1, yy - 5, bw * 2 - 2, 1, '#6a2a22');                                       // 난간 그늘
    px(x - rw, yy - 9, rw * 2, 2, roof); px(x - rw + 1, yy - 10, rw * 2 - 2, 1, roofL);     // 처마
    px(x - rw - 1, yy - 11, 2, 2, roof); px(x + rw - 1, yy - 11, 2, 2, roof);              // 들린 끝
    if (winter) px(x - rw + 2, yy - 11, rw * 2 - 4, 1, snow);
    yy -= 10;
  }
  px(x - 1, yy - 15, 2, 15, '#8a7a50');                                                   // 상륜
  for (let k = 0; k < 5; k++) px(x - 2, yy - 3 - k * 2, 4, 1, '#b89a5a');
  px(x - 1, yy - 17, 2, 2, '#e8c94e');
}
// 대숲 — 섬 뒤 왼쪽 가장자리 너머로 곧게 솟은 대나무. 마디마다 짙은 줄, 꼭대기엔 잎 무더기.
function isoBambooGrove(winter){
  for (let x = 140; x < IOX - 8; x += 2 + Math.floor(hash2(x, 1, 956) * 4)){
    const base = Math.round(isoBackEdgeY(x)) + 4, h = 52 + Math.floor(hash2(x, 2, 956) * 40) + Math.round(Math.sin(x / 37) * 10);
    const far = hash2(x, 3, 956) > 0.5, c = far ? '#6f9a52' : '#8fb85a', dk = shade(c, -28), lean = (hash2(x, 4, 956) - 0.5) * 0.12;
    for (let z = 0; z < h; z++){ const xx = x + Math.round(lean * z); px(xx, base - z, 2, 1, z % 9 === 0 ? dk : c); if (!far && z % 9) px(xx, base - z, 1, 1, shade(c, 18)); }
  }
  for (let i = 0; i < 56; i++){
    const x = 140 + Math.floor(hash2(i, 5, 957) * (IOX - 150)), y = Math.round(isoBackEdgeY(x)) - 46 - Math.floor(hash2(i, 6, 957) * 46);
    for (let k = 0; k < 10; k++){
      const a = hash2(i, k, 958) * Math.PI * 2, d = hash2(i, k + 20, 958) * 10, lx = Math.round(x + Math.cos(a) * d * 1.4), ly = Math.round(y + Math.sin(a) * d * 0.7);
      px(lx, ly, 4, 1, k % 3 ? '#4f7a3a' : '#6f9a4a'); px(lx + 1, ly + 1, 3, 1, '#3a5a2c');
      if (winter && k % 4 === 0) px(lx, ly - 1, 3, 1, '#f4f8fb');
    }
  }
}
/* 고가 철도 — 섬 뒤 오른쪽 가장자리(v=0) 바깥 v=RAIL_V 를 따라 왼쪽 위 하늘 끝에서 오른쪽 끝까지 놓였다.
   섬보다 먼저 그리므로 뒤 줄에 선 것들이 앞을 가린다. 교각은 아래 구름바다로 내려간다.
   전차선 기둥은 선로 뒤쪽에 세워 지나가는 열차가 기둥 아래를 가리게 했다. 열차는 isoTrain 이 매 장 그린다. */
const RAIL_V = -1.45, RAIL_Z = 8;
function isoRailway(){
  const u0 = -14, u1 = COLS + 8, v0 = RAIL_V - 0.36, v1 = RAIL_V + 0.36;
  for (let u = 3; u < u1; u += 3) isoCube(u - 0.16, v0 + 0.1, 0.32, v1 - v0 - 0.2, -96, RAIL_Z - 4, '#c9c4ba', '#bdb8ae', '#9d988e');   // 교각
  poly3([[u0, v1, RAIL_Z - 5], [u1, v1, RAIL_Z - 5], [u1, v1, RAIL_Z], [u0, v1, RAIL_Z]], '#dcd8cf');                                    // 고가 옆면
  isoSeg(isoP(u0, v1, RAIL_Z - 5), isoP(u1, v1, RAIL_Z - 5), '#8f8a80', 1);
  poly3([[u0, v0, RAIL_Z], [u1, v0, RAIL_Z], [u1, v1, RAIL_Z], [u0, v1, RAIL_Z]], '#9d978c');                                          // 자갈 바닥
  for (let u = u0; u < u1; u += 0.22) isoSeg(isoP(u, v0 + 0.08, RAIL_Z), isoP(u, v1 - 0.08, RAIL_Z), '#7c766c', 1);                    // 침목
  [-0.12, 0.12].forEach(o => { isoSeg(isoP(u0, RAIL_V + o, RAIL_Z + 1), isoP(u1, RAIL_V + o, RAIL_Z + 1), '#4f4b46', 1); isoSeg(isoP(u0, RAIL_V + o, RAIL_Z + 2), isoP(u1, RAIL_V + o, RAIL_Z + 2), '#d8d4cc', 1); });
  for (let u = -12; u < u1; u += 2){                                                                                                  // 전차선 기둥과 팔
    const b = isoP(u, v0 - 0.02, RAIL_Z), tp = isoP(u, v0 - 0.02, RAIL_Z + 31);
    px(Math.round(b.x), Math.round(tp.y), 2, Math.round(b.y - tp.y), '#7a808a');
    isoSeg(isoP(u, v0 - 0.02, RAIL_Z + 29), isoP(u, RAIL_V + 0.12, RAIL_Z + 29), '#7a808a', 1);
  }
  isoSeg(isoP(u0, RAIL_V, RAIL_Z + 27), isoP(u1, RAIL_V, RAIL_Z + 27), '#4a4f58', 1);
  isoSeg(isoP(u0, RAIL_V, RAIL_Z + 30), isoP(u1, RAIL_V, RAIL_Z + 30), '#5a606a', 1);
}
// 섬 옆구리 — 앞쪽 두 면에 땅켜를 쌓는다. 맨 위는 풀 턱, 그 아래 흙·진흙·바위 순. 왼쪽 면이 빛을 받는다.
function isoCliff(season){
  const K = isoLook(), P = groundPal(season), turf = shade(P.g[2], -16);
  const L0 = isoP(0, ROWS), B0 = isoP(COLS, ROWS), R0 = isoP(COLS, 0);
  const band = [5, 17, 32, 50];                                    // 켜가 바뀌는 깊이(도트)
  for (let x = Math.round(L0.x); x < Math.round(R0.x); x += 2){
    const left = x < B0.x, top = Math.round(left ? L0.y + (x - L0.x) / 2 : B0.y - (x - B0.x) / 2);
    let deep = K.deep - Math.floor(hash2(x >> 2, 1, 931) * 6) - (hash2(x >> 3, 2, 932) > 0.7 ? 4 : 0);
    if (K.below === 'clouds') deep = Math.round(K.deep * (0.5 + 0.5 * (1 - Math.abs(x - B0.x) / (R0.x - L0.x) * 1.6))) + 10;
    for (let k = 0; k <= band.length; k++){
      const z0 = k ? band[k - 1] + Math.round(Math.sin(x / 19 + k * 1.7) * 1.5 + hash2(x >> 1, k, 933)) : 0;
      const z1 = k < band.length ? band[k] + Math.round(Math.sin(x / 19 + (k + 1) * 1.7) * 1.5 + hash2(x >> 1, k + 1, 933)) : deep;
      if (z1 <= z0 || z0 >= deep) continue;
      let c = k === 0 ? turf : K.strata[k - 1];
      if (!left) c = shade(c, -24);
      if (K.wall && (k === 1 || k === 2)){                         // 돌담 — 크고 작은 돌을 맞물려 쌓았다. 돌 사이 틈은 짙고, 군데군데 이끼
        for (let z = z0; z < Math.min(z1, deep); z++){
          const P = plates(x / 11 + (left ? 0 : 0.5), z / 6), r = hash2(P.id, 3, 951);
          let q = P.e < 0.06 ? '#4a4842' : r > 0.75 ? '#b2aea3' : r > 0.45 ? '#a29e94' : r > 0.18 ? '#938f86' : '#85827a';
          if (P.e >= 0.06 && P.e < 0.12) q = shade(q, z - z0 < 3 ? 10 : -10);   // 돌 모서리 — 윗단은 밝게, 그 밖은 둥글게 그늘
          else if (P.e < 0.06 && hash2(x >> 1, z, 952) > 0.82) q = '#6f8a4a';     // 틈의 이끼
          px(x, top + z, 2, 1, left ? q : shade(q, -24));
        }
        continue;
      }
      px(x, top + z0, 2, Math.min(z1, deep) - z0, c);
      // 켜마다 결 — 흙엔 뿌리, 진흙엔 자갈, 바위엔 금
      for (let z = z0 + 1; z < Math.min(z1, deep) - 1; z += 3){
        const r = hash2(x >> 1, z, 934 + k);
        if (k === 1 && r > 0.9) px(x + (r > 0.95 ? 1 : 0), top + z, 1, 3, shade(c, -26));
        else if (k === 2 && r > 0.86) px(x, top + z, 2, 1, shade(c, r > 0.93 ? 22 : -18));
        else if (k >= 3 && r > 0.88) px(x + 1, top + z, 1, 4, shade(c, -22));
        else if (k >= 3 && r < 0.06) px(x, top + z, 2, 1, shade(c, 16));
      }
    }
    // 풀 턱이 아래로 늘어진 자리
    if (hash2(x >> 1, 3, 935) > 0.62) px(x, top + band[0], 2, 1 + Math.floor(hash2(x, 4, 936) * 4), turf);
    if (K.wall && hash2(x >> 1, 7, 953) > 0.9) px(x + (hash2(x, 8, 953) > 0.5 ? 1 : 0), top + band[0], 1, 4 + Math.floor(hash2(x, 9, 953) * 14), x % 4 ? '#5f8a44' : '#7fa85a');   // 돌담을 타고 내린 담쟁이
    if (K.wall && deep > band[2] + 4 && hash2(x >> 1, 10, 954) > 0.93) px(x, top + band[2], 1, Math.min(deep - band[2] - 2, 6 + Math.floor(hash2(x, 11, 954) * 16)), '#3e3228');   // 흙켜에서 늘어진 뿌리
    px(x, top + deep - 2, 2, 2, shade(K.strata[3], left ? -30 : -44));   // 밑동 그늘
    if (K.below === 'lava'){                                         // 현무암 금마다 비치는 용암, 밑동은 용암에 잠겨 달아 있다
      for (let z = band[1]; z < deep - 8; z += 4){ const r = hash2(x >> 1, z, 944); if (r > 0.965){ px(x, top + z, 1, 3 + (r > 0.985 ? 3 : 0), '#e8501a'); px(x, top + z + 1, 1, 1, '#ffc23a'); } }
      const wl = deep - 7;
      px(x, top + wl, 2, deep - wl, left ? '#c8360e' : '#a82c0c'); px(x, top + wl, 2, 1, '#ff8a1a');
      if (hash2(x >> 1, 5, 945) > 0.4) px(x, top + deep - 1, 2, 1, '#ffd84a');
    }
    if (K.below === 'sea'){                                          // 물에 잠긴 자리와 거품
      const wl = deep - 8;
      ctx.globalAlpha = 0.55; px(x, top + wl, 2, deep - wl, '#3b8cc6'); ctx.globalAlpha = 1;
      if (hash2(x >> 1, 5, 937) > 0.25) px(x, top + wl - 1 + (hash2(x, 6, 938) > 0.5 ? 1 : 0), 2, 2, '#ffffff');
    }
  }
  // 앞 모서리에 빛 한 줄
  px(Math.round(B0.x) - 2, Math.round(B0.y), 1, K.deep - 12, '#ffffff33');
  // 맨 앞 겹 — 섬 밑동을 가로지르는 구름·안개. 섬이 그 뒤에 떠 있어 깊이가 생긴다.
  if (K.below === 'clouds') for (let i = 0; i < 7; i++){
    const x = Math.round(L0.x + (R0.x - L0.x) * (i + 0.5) / 7 + (hash2(i, 1, 940) - 0.5) * 40);
    const left = x < B0.x, y = Math.round((left ? L0.y + (x - L0.x) / 2 : B0.y - (x - B0.x) / 2) + K.deep - 6 + hash2(i, 2, 941) * 14);
    isoCloudPuff(x, y, 54 + Math.floor(hash2(i, 3, 942) * 30), 18, ['#f6f8fc', '#ffffff', '#dde4ee'], 'ifc' + i);
  }
  if (K.below === 'lava') lavaFalls().forEach(f => {                 // 섬 가장자리에서 쏟아지는 용암 폭포
    const y0 = Math.round(f.y), y1 = y0 + K.deep - 2, x = Math.round(f.x) - 3;
    for (let y = y0; y < y1; y++){
      const wv = Math.round(Math.sin(y / 5 + f.x) * 0.8);
      px(x - 3 + wv, y, 14, 1, '#6a1a0c'); px(x - 2 + wv, y, 12, 1, '#d8400e'); px(x + wv, y, 8, 1, '#ff8a1a');
      if (hash2(y, f.x | 0, 946) > 0.4) px(x + 2 + wv + (hash2(y, 1, 947) > 0.5 ? 1 : 0), y, 3, 1, '#ffd84a');
    }
    for (let r = 0; r < 6; r++) px(x - 9 + r, y1 - 3 + r, 26 - r * 2, 1, r < 2 ? '#ffe066' : r < 4 ? '#ff8a1a' : '#c8360e');   // 떨어진 자리 — 튀어 오른 용암
  });
  if (K.below === 'sea'){                                            // 섬 둘레로 퍼지는 물결
    for (let k = 1; k <= 3; k++){
      ctx.globalAlpha = 0.5 - k * 0.12;
      for (let x = Math.round(L0.x); x < Math.round(R0.x); x += 4){
        const left = x < B0.x, y = Math.round((left ? L0.y + (x - L0.x) / 2 : B0.y - (x - B0.x) / 2) + K.deep - 4 + k * 7);
        if (hash2(x >> 2, k, 939) > 0.3) px(x, y, 3, 1, '#ffffff');
      }
      ctx.globalAlpha = 1;
    }
  }
}
// 흙길 칸마다 가장자리를 미리 셈해 둔다 — 도트마다 R.prand 를 부르면 한 장에 수십만 번이다
function isoPathMap(season){
  const cells = pathCells(), map = {}, LK = farmLook() || {};
  const c = LK.path || (season === 'winter' ? ['#dcd6c8', '#cfc7b6', '#e6e0d3'] : ['#e0cfa8', '#d2bf95', '#ece0bf']);
  const edge = LK.pathEdge || (season === 'winter' ? '#c6bfae' : '#c2ac7e');
  const has = (x, y) => cells.has(x + ',' + y);
  cells.forEach(k => {
    const [x, y] = k.split(',').map(Number);
    const up = has(x, y - 1), dn = has(x, y + 1), lf = has(x - 1, y), rt = has(x + 1, y);
    const j = (t2, a) => a + Math.round(R.prand(t2 + x + '_' + y) * 4);
    map[k] = { up, dn, lf, rt, c, edge,
      x0: lf || rt ? 0 : j('pl', 5), x1: lf || rt ? T : T - j('pr', 5), y0: up || dn ? 0 : j('pt', 5), y1: up || dn ? T : T - j('pb', 5) };
  });
  return map;
}
function isoGroundAt(fx, fy, P, K, pm){
  const tx = Math.floor(fx / T), ty = Math.floor(fy / T), ix = Math.floor(fx), iy = Math.floor(fy);
  const m = pm[tx + ',' + ty];
  if (m){
    const lx = fx - tx * T, ly = fy - ty * T;
    if (lx >= m.x0 && lx < m.x1 && ly >= m.y0 && ly < m.y1){
      const e = Math.min(m.lf ? 9 : lx - m.x0, m.rt ? 9 : m.x1 - lx, m.up ? 9 : ly - m.y0, m.dn ? 9 : m.y1 - ly);
      if (e < 1.6 && hash2(ix, iy, 141) > 0.35) return m.edge;
      if ((m.lf || m.rt) && ((ly >= 12 && ly < 14) || (ly >= 20 && ly < 22))) return m.c[1];
      if ((m.up || m.dn) && ((lx >= 12 && lx < 14) || (lx >= 20 && lx < 22))) return m.c[1];
      const r = hash2(ix >> 1, iy >> 1, 142);
      return r > 0.9 ? m.c[2] : r < 0.07 ? m.c[1] : m.c[0];
    }
  }
  const v = noise2i(fx, fy, 64, 11) * 0.62 + noise2i(fx, fy, 28, 22) * 0.26 + noise2i(fx, fy, 13, 33) * 0.12;
  let col = P.g[Math.min(2, Math.floor(v * 3))];
  const r = hash2(ix >> 2, iy >> 2, 55);
  if (r > 0.93) col = P.g[0]; else if (r < 0.05) col = P.g[2];
  for (let i = 0; i < DRY_PATCH.length; i++){
    const w = DRY_PATCH[i], nx = (fx - w[0] * T) / (w[2] * T), ny = (fy - w[1] * T) / (w[3] * T), d = nx * nx + ny * ny;
    if (d > 1.3 || d >= 0.5 + noise2i(fx, fy, 20, 101 + i) * 0.7 || (d > 0.55 && hash2(ix, iy, 66) > 0.45)) continue;
    const q = hash2(ix, iy, 77); return q > 0.92 ? K.dryDk : q < 0.08 ? K.dryLt : P.dry;
  }
  if (K.clover) for (let i = 0; i < CLOVER_PATCH.length; i++){
    const w = CLOVER_PATCH[i], nx = (fx - w[0] * T) / (w[2] * T), ny = (fy - w[1] * T) / (w[3] * T), d = nx * nx + ny * ny;
    if (d > 1.3 || d >= 0.5 + noise2i(fx, fy, 20, 201 + i) * 0.7 || (d > 0.5 && hash2(ix, iy, 88) > 0.4)) continue;
    const q = hash2(ix, iy, 99); if (q > 0.66) return q > 0.9 ? K.clLt : K.clDk;
  }
  return col;
}
// 겹 1 — 먼 풍경·절벽·섬 윗면. 계절과 집 자리(흙길이 거기서 나온다)가 바뀔 때만.
function isoGround(season){
  const P = groundPal(season), LK = farmLook() || {}, pm = isoPathMap(season);
  const K = { dryDk: shade(P.dry, -12), dryLt: shade(P.dry, 9), clLt: shade(P.tuft[0], 14), clDk: shade(P.tuft[0], -12), clover: season !== 'winter' };
  isoBackdrop(season);
  isoCliff(season);
  const shadeMemo = {};
  const sh = (c, d) => shadeMemo[c + d] || (shadeMemo[c + d] = shade(c, d));
  const sootC = '#1e1816', crowns = LK.petals && season !== 'winter' ? cherryCrowns() : null;
  isoPaintRect(0, 0, COLS, ROWS, (u, v) => {
    let c = isoGroundAt(u * T, v * T, P, K, pm);
    if (crowns){                                                   // 진 벚꽃잎 — 어디에나 조금, 바람이 모은 자리와 벚나무 밑엔 소복이
      const fx = u * T, fy = v * T;
      let d = 0.1 + Math.max(0, vnoise(fx / 70, fy / 70, 1501) - 0.45) * 1.3;
      for (let i = 0; i < crowns.length; i++){ const du = u - crowns[i][0] - 0.3, dv = v - crowns[i][1] - 0.1, dd = du * du + dv * dv; if (dd < 3.4) d += (1 - dd / 3.4) * 0.75; }
      const q = hash2(Math.floor(fx * 0.7), Math.floor(fy * 0.9), 1503);
      if (q < d) c = PETAL[Math.floor(hash2(Math.floor(fx * 0.7), Math.floor(fy * 0.9), 1504) * 4)];
    }
    if (LK.soot){                                                  // 화산 섬 — 불길이 지나간 자리마다 검은 그을음 얼룩
      const fx = u * T, fy = v * T, nz = vnoise(fx / 46, fy / 46, 1301) * 0.65 + vnoise(fx / 15, fy / 15, 1302) * 0.35, k = (nz - LK.soot) / 0.16;
      if (k > 0){ const q = hash2(Math.floor(fx), Math.floor(fy), 1303); c = k > 0.85 && q < 0.8 ? sootC : q < k ? sh(c, -34) : c; }
    }
    if (u < 0.18 || v < 0.18) return sh(c, -12);                   // 뒤 가장자리 — 섬 끝이 하늘과 갈린다
    if (u > COLS - 0.1 || v > ROWS - 0.1) return sh(c, 16);        // 앞 턱에 빛
    return c;
  });
  // 칸마다 풀포기·조약돌·꽃 — 선 것이라 마름모 위에 곧게 세운다
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++){
    if (pm[tx + ',' + ty] || R.fieldHas(W, tx, ty)) continue;
    const r0 = R.prand('g' + tx + '_' + ty), n = r0 < 0.5 ? 3 : r0 < 0.85 ? 2 : 1;
    for (let i = 0; i < n; i++){
      const p = isoP(tx + 0.15 + R.prand('t' + tx + '_' + ty + '_' + i) * 0.7, ty + 0.15 + R.prand('u' + tx + '_' + ty + '_' + i) * 0.7);
      const gx = Math.round(p.x) - 3, gy = Math.round(p.y) - 7, c = P.tuft[i % 2];
      px(gx, gy + 2, 2, 5, c); px(gx + 2, gy, 2, 7, sh(c, 14)); px(gx + 4, gy + 3, 2, 4, sh(c, -10));
    }
    if (r0 > (LK.pebble || 0.93)){
      const p = isoP(tx + 0.5, ty + 0.55), X = Math.round(p.x) - 4, Y = Math.round(p.y) - 2;          // 둥근 조약돌
      px(X + 1, Y, 6, 1, P.ink); px(X, Y + 1, 8, 2, P.ink); px(X + 1, Y + 3, 6, 1, P.ink);
      px(X + 1, Y + 1, 6, 2, P.rock); px(X + 1, Y + 1, 3, 1, sh(P.rock, 22)); px(X + 3, Y + 2, 4, 1, sh(P.rock, -26));
    }
    const bloomP = (season === 'spring' ? 0.2 : season === 'summer' ? 0.14 : season === 'autumn' ? 0.07 : 0) * (LK.bloomX || 1);
    if (R.prand('f' + tx + '_' + ty) < bloomP){
      const c = P.bloom[Math.floor(R.prand('fc' + tx + '_' + ty) * P.bloom.length)];
      const p = isoP(tx + 0.25 + R.prand('fx' + tx + '_' + ty) * 0.5, ty + 0.25 + R.prand('fy' + tx + '_' + ty) * 0.5);
      const fx = Math.round(p.x) - 1, fy = Math.round(p.y) - 10;
      px(fx, fy + 4, 2, 6, P.tuft[1]);
      px(fx - 1, fy - 1, 4, 2, P.ink); px(fx - 3, fy + 1, 8, 2, P.ink); px(fx - 1, fy + 3, 4, 4, P.ink);
      px(fx, fy, 2, 2, c); px(fx - 2, fy + 2, 6, 2, c); px(fx, fy + 4, 2, 2, c);
      px(fx, fy + 2, 2, 2, '#fff6c0');
    }
    if (season === 'autumn' && R.prand('l' + tx + '_' + ty) < 0.16){
      const p = isoP(tx + 0.2 + R.prand('lx' + tx + '_' + ty) * 0.6, ty + 0.2 + R.prand('ly' + tx + '_' + ty) * 0.6);
      const c = ['#d9603c', '#e8874a', '#c9a227'][Math.floor(R.prand('lc' + tx + '_' + ty) * 3)];
      px(Math.round(p.x), Math.round(p.y), 4, 2, c); px(Math.round(p.x) + 2, Math.round(p.y) + 2, 2, 1, sh(c, -26));
    }
    if (season === 'winter' && R.prand('w' + tx + '_' + ty) < 0.25){
      const p = isoP(tx + 0.2 + R.prand('wx' + tx + '_' + ty) * 0.6, ty + 0.2 + R.prand('wy' + tx + '_' + ty) * 0.6);
      px(Math.round(p.x) - 3, Math.round(p.y), 6, 3, LK.ash ? '#8a8284' : '#ffffff');   // 화산 섬엔 눈 대신 재
    }
  }
  if (LK.cracks) isoLavaCracks(pm, LK.cracks);
}
// 화산 섬 땅 — 군데군데 갈라진 틈으로 용암이 비치고, 폭포 자리마다 가장자리로 흐르는 용암 도랑
function isoLavaCracks(pm, rate){
  const crack = (pts) => {
    for (let i = 1; i < pts.length; i++) isoSeg({ x: pts[i - 1].x - 1, y: pts[i - 1].y }, { x: pts[i].x - 1, y: pts[i].y }, '#120a09', 3);
    for (let i = 1; i < pts.length; i++) isoSeg(pts[i - 1], pts[i], i === 1 || i === pts.length - 1 ? '#c8360e' : '#ff6a1a', 1);
    pts.slice(1, -1).forEach(p => px(Math.round(p.x), Math.round(p.y), 1, 1, '#ffd84a'));
  };
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++){
    if (pm[tx + ',' + ty] || R.fieldHas(W, tx, ty) || R.prand('lc' + tx + '_' + ty) >= rate) continue;
    let u = tx + 0.2 + R.prand('lu' + tx + '_' + ty) * 0.6, v = ty + 0.2 + R.prand('lv' + tx + '_' + ty) * 0.6;
    const pts = [isoP(u, v)];
    const du = R.prand('lk' + tx + '_' + ty) - 0.5, dv = R.prand('lj' + tx + '_' + ty) - 0.5;   // 한쪽으로 뻗어 가며 지그재그
    for (let k = 0; k < 5; k++){
      u += du * 0.5 + (R.prand('ld' + tx + '_' + ty + k) - 0.5) * 0.35; v += dv * 0.5 + (R.prand('le' + tx + '_' + ty + k) - 0.5) * 0.35;
      pts.push(isoP(Math.max(0.1, Math.min(COLS - 0.1, u)), Math.max(0.1, Math.min(ROWS - 0.1, v))));
    }
    crack(pts);
  }
  lavaFalls().forEach(f => {                                       // 도랑 — 안쪽에서 굽이쳐 나와 가장자리에서 떨어진다
    const pts = [];
    for (let k = 0; k <= 6; k++){
      const d = 1.6 - k * 0.27, w = Math.sin(k * 1.3 + f.u) * 0.12;
      pts.push(f.side ? isoP(f.u + w, f.v - d) : isoP(f.u - d, f.v + w));
    }
    for (let i = 1; i < pts.length; i++) isoSeg({ x: pts[i - 1].x - 2, y: pts[i - 1].y }, { x: pts[i].x - 2, y: pts[i].y }, '#140b0a', 5);
    for (let i = 1; i < pts.length; i++) isoSeg({ x: pts[i - 1].x - 1, y: pts[i - 1].y + 1 }, { x: pts[i].x - 1, y: pts[i].y + 1 }, '#d8400e', 3);
    for (let i = 1; i < pts.length; i++) isoSeg({ x: pts[i - 1].x, y: pts[i - 1].y + 2 }, { x: pts[i].x, y: pts[i].y + 2 }, '#ffb02e', 1);
  });
}

// ---- 바닥에 붙은 것 — 목장 바닥·연못·꽃길·안 지은 터 ----
function isoGhost(b){
  const pts = [isoP(b.x + 0.1, b.y + 0.1), isoP(b.x + b.w - 0.1, b.y + 0.1), isoP(b.x + b.w - 0.1, b.y + b.h - 0.1), isoP(b.x + 0.1, b.y + b.h - 0.1)];
  ctx.globalAlpha = 0.1; polyFill(pts.map(p => [p.x, p.y]), '#000000'); ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++){                                     // 노끈 — 끊어 가며 두른다
    const a = pts[i], c = pts[(i + 1) % 4], n = Math.max(2, Math.round(Math.hypot(c.x - a.x, c.y - a.y) / 4));
    for (let k = 0; k < n; k += 2){
      const p0 = { x: a.x + (c.x - a.x) * k / n, y: a.y + (c.y - a.y) * k / n - 6 }, p1 = { x: a.x + (c.x - a.x) * (k + 1) / n, y: a.y + (c.y - a.y) * (k + 1) / n - 6 };
      isoSeg(p0, p1, '#e8dcc8', 1);
    }
  }
  pts.forEach(p => { const x = Math.round(p.x), y = Math.round(p.y); px(x - 1, y - 9, 3, 10, WOOD.dark); px(x - 1, y - 9, 1, 10, WOOD.mid); px(x - 2, y - 10, 5, 1, WOOD.hi); });
}
function isoPond(season, b){
  const ice = season === 'winter';
  const deep = ice ? '#bcdbea' : '#3b8cc6', mid = ice ? '#cfe6f2' : '#4fa6db', edge = ice ? '#e6f3f9' : '#7cc3e8';
  isoPaintRect(b.x, b.y, b.w, b.h, (u, v) => {
    const fu = (u - b.x) / b.w - 0.5, fv = (v - b.y) / b.h - 0.5, d = (fu * fu) / 0.2 + (fv * fv) / 0.19;
    const wob = noise2i(u * T, v * T, 10, 951) * 0.22;
    if (d < 0.78 + wob){
      if (d > 0.62 + wob && fv + fu < 0) return shade(mid, -14);  // 뒤쪽 둑 그늘 — 물이 파여 보인다
      const r = hash2(Math.floor(u * T), Math.floor(v * T), 952);
      if (!ice && r > 0.985) return '#e3f6fd';
      return d < 0.3 ? deep : d < 0.6 ? mid : edge;
    }
    if (d < 1.02 + wob){                                           // 물가 — 모래와 조약돌
      const r = hash2(Math.floor(u * T) >> 1, Math.floor(v * T) >> 1, 953);
      return r > 0.82 ? STONE.hi : r < 0.12 ? STONE.low : (ice ? '#eef2f2' : '#dccb9e');
    }
    return null;
  });
  if (!ice) [[0.28, 0.62], [0.66, 0.36], [0.58, 0.7]].forEach(([a, c], i) => {    // 연잎
    const p = isoP(b.x + a * b.w, b.y + c * b.h), x = Math.round(p.x), y = Math.round(p.y);
    px(x - 4, y - 1, 8, 3, '#5fa155'); px(x - 3, y - 1, 6, 1, '#7fc06e'); px(x, y, 2, 1, '#4f8f48');
    if (i === 1){ px(x + 1, y - 3, 3, 2, '#ffb7d5'); px(x + 2, y - 4, 1, 1, '#ffffff'); }
  });
}
function isoFlowerPath(season, b){
  const pc = season === 'winter' ? '#dcd6c8' : '#e6d7b5';
  const cols = season === 'winter' ? ['#ffffff', '#eaf6ff'] : season === 'autumn' ? ['#e8874a', '#f2c14e', '#d9603c', '#c9a8ff'] : ['#ffb7d5', '#fff3a0', '#ffffff', '#c9a8ff'];
  const horiz = b.w >= b.h;
  isoPaintRect(b.x, b.y, b.w, b.h, (u, v) => {
    const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
    const d = horiz ? (fu * fu) / 0.12 + (fv * fv) / 0.07 : (fu * fu) / 0.07 + (fv * fv) / 0.12;
    if (d > 1) return null;
    return d > 0.72 ? shade(pc, -26) : hash2(Math.floor(u * T), Math.floor(v * T), 954) > 0.86 ? shade(pc, 14) : pc;
  });
  for (let i = 0; i < b.w * b.h * 3; i++){                         // 길섶 꽃
    const side = i % 2 ? 0.1 : 0.9, along = (i + 0.5) / (b.w * b.h * 3) * (horiz ? b.w : b.h);
    const p = horiz ? isoP(b.x + along, b.y + side) : isoP(b.x + side, b.y + along);
    const x = Math.round(p.x), y = Math.round(p.y) - 5, c = cols[i % cols.length];
    px(x, y + 2, 1, 4, '#5fa155'); px(x - 1, y, 3, 2, c); px(x, y, 1, 1, '#fff6c0');
  }
}
function isoPastureFloor(season, b){
  const P = groundPal(season), base = shade(P.g[2], -8), lt = shade(P.g[1], -6), mud = mix(shade(P.g[2], -18), P.dry, 0.35), road = mix(shade(P.g[2], -22), '#836448', 0.7);
  isoPaintRect(b.x + 0.1, b.y + 0.1, b.w - 0.2, b.h - 0.2, (u, v) => {
    const fx = u * T, fy = v * T, n = noise2i(fx, fy, 14, 961) * 0.62 + noise2i(fx, fy, 6, 962) * 0.38;
    const mid = b.y + b.h / 2 + Math.sin((u - b.x) * 1.7) * 0.25;
    if (Math.abs(v - mid) < 0.16 && hash2(Math.floor(fx), Math.floor(fy), 963) > 0.3) return road;
    return n > 0.7 ? lt : n < 0.24 ? mud : base;
  });
}
function isoFloor(season){
  R.PLACE_IDS.forEach(id => {
    const P = R.PLACE[id];
    if (P.kind === 'build' && !here(id) && id !== 'scarecrow') isoGhost(spot(id));
  });
  if (here('pasture')) isoPastureFloor(season, spot('pasture'));
  if (here('pond')) isoPond(season, spot('pond'));
  if (here('path')) isoFlowerPath(season, spot('path'));
}

// ---- 밭 ----
function isoFencePost(p, hgt){
  const x = Math.round(p.x), y = Math.round(p.y), h = hgt || 14;
  px(x - 1, y - h, 3, h + 1, WOOD.dark); px(x - 1, y - h, 1, h + 1, WOOD.mid); px(x - 1, y - h - 1, 3, 1, WOOD.hi);
}
// 울타리 한 토막 — (ua,va) 에서 (ub,vb) 까지 가로대 둘, 양 끝 기둥
// 그리스는 낮은 흰 돌담, 일본은 대나무 울, 스위스는 빗살 댄 나무 울타리
function isoFenceSeg(ua, va, ub, vb){
  const th = isoTheme();
  if (th === 'seaside') return isoWallSeg(ua, va, ub, vb);
  if (th === 'cloud') return isoBambooSeg(ua, va, ub, vb);
  isoSeg(isoP(ua, va, 11), isoP(ub, vb, 11), WOOD.mid, 2);
  isoSeg(isoP(ua, va, 5), isoP(ub, vb, 5), WOOD.low, 2);
  isoSeg(isoP(ua, va, 2), isoP(ub, vb, 13), WOOD.low, 1);                       // 빗살 하나
  isoFencePost(isoP(ua, va)); isoFencePost(isoP(ub, vb));
}
function isoWallSeg(ua, va, ub, vb){
  const alongU = Math.abs(ub - ua) >= Math.abs(vb - va), t = 0.12, z = 9;
  const ou = alongU ? 0 : -t, ov = alongU ? -t : 0, face = alongU ? WHITEWASH : shade(WHITEWASH, -28);   // 두께는 뒤쪽으로
  poly3([[ua, va, 0], [ub, vb, 0], [ub, vb, z], [ua, va, z]], face);
  poly3([[ua, va, z], [ub, vb, z], [ub + ou, vb + ov, z], [ua + ou, va + ov, z]], '#ffffff');
  for (let k = 1; k < 4; k++){ const f = k / 4, q = isoP(ua + (ub - ua) * f, va + (vb - va) * f, 3 + (k % 2) * 3); px(Math.round(q.x), Math.round(q.y), 3, 1, shade(face, -14)); }
}
function isoBambooSeg(ua, va, ub, vb){
  const cane = '#b9c46a', dark = '#8a9446', tie = '#3a2e22';
  [4, 9, 14].forEach(z => isoSeg(isoP(ua, va, z), isoP(ub, vb, z), cane, 2));
  [0, 0.5, 1].forEach(f => {
    const q = isoP(ua + (ub - ua) * f, va + (vb - va) * f), x = Math.round(q.x), y = Math.round(q.y), h = f === 0.5 ? 16 : 19;
    px(x - 1, y - h, 3, h + 1, f === 0.5 ? cane : dark); px(x - 1, y - h, 1, h + 1, '#d6de8e'); px(x - 1, y - 12, 3, 1, dark);
    [4, 9, 14].forEach(z => px(x - 1, y - z - 1, 3, 2, tie));
  });
}
function isoFenceLine(ua, va, ub, vb, skip){
  const n = Math.max(1, Math.round(Math.max(Math.abs(ub - ua), Math.abs(vb - va))));
  for (let k = 0; k < n; k++) if (!(skip && skip(k))) isoFenceSeg(ua + (ub - ua) * k / n, va + (vb - va) * k / n, ua + (ub - ua) * (k + 1) / n, va + (vb - va) * (k + 1) / n);
}
/* 밭 둘레 — 열린 칸 모임(open: Set 'x,y')의 바깥 변마다 한 토막. off 만큼 바깥으로 물러나 선다.
   곧게 이어지는 변은 그대로, 바깥 모서리는 off 만큼 늘이고 안으로 꺾이는 모서리는 줄여서 토막끼리 맞물린다.
   front: 아래·오른쪽 변(화면 앞쪽) — 뒤쪽 변도 밭이 오목한 자리에서는 사람 앞에 올 수 있어 모두 깊이순으로 세운다 */
function fieldEdges(open, off){
  const has = (x, y) => open.has(x + ',' + y), out = [];
  open.forEach(id => {
    const [x, y] = id.split(',').map(Number);
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([nx, ny]) => {
      if (has(x + nx, y + ny)) return;
      const ax = ny ? 1 : 0, ay = nx ? 1 : 0, cx = x + 0.5 + nx * 0.5, cy = y + 0.5 + ny * 0.5;
      const end = sg => {
        const d = has(x + ax * sg + nx, y + ay * sg + ny) ? -off : has(x + ax * sg, y + ay * sg) ? 0 : off;
        return [cx + ax * sg * (0.5 + d) + nx * off, cy + ay * sg * (0.5 + d) + ny * off];
      };
      const a = end(-1), b = end(1);
      out.push([a[0], a[1], b[0], b[1]]);
    });
  });
  return out;
}
function openField(k){ const s = new Set(); R.fieldCells(W).forEach(c => { if (c.k <= k) s.add(c.id); }); return s; }
// 밭 한 칸 — 세 도트 돋운 두둑. 고랑은 u 쪽으로 흐른다.
function isoPlot(id, p){
  const { x, y } = R.parseId(id);
  if (!p || !p.tilled) return;
  const wet = R.wetNow(p, now(), false), S3 = wet ? SOIL.wet : SOIL.dry;
  const c0 = S3[0], c1 = S3[1], c2 = S3[2], hi = shade(c0, 24), n1 = shade(c0, 12), n2 = shade(c0, -12), fert = '#e8dcae';
  const b = isoP(x, y, 3);
  isoSideL(px, b.x, b.y, IT / 2, IT / 2, 3, shade(c0, -22));
  isoSideR(px, b.x, b.y, IT / 2, IT / 2, 3, shade(c0, -36));
  isoPaintRect(x, y, 1, 1, (u, v) => {
    const fx = u * T, fy = v * T, ly = (v - y) * T;
    for (let i = 4; i < T - 2; i += 6){
      if (ly >= i - 1 && ly < i) return hi;
      if (ly >= i && ly < i + 2) return c2;
      if (ly >= i + 2 && ly < i + 4) return c1;
    }
    const n = noise2i(fx, fy, 14, 121) * 0.62 + noise2i(fx, fy, 6, 122) * 0.38;
    if (p.fert && hash2(Math.floor(fx), Math.floor(fy), 123) > 0.94) return fert;
    return n > 0.66 ? n1 : n < 0.3 ? n2 : c0;
  }, 3);
  if (wet){ const q = isoP(x + 0.35, y + 0.3, 3); px(Math.round(q.x), Math.round(q.y), 5, 1, '#7fbfe0aa'); }
}
function isoField(){
  const k = W.expand || 0;
  if (R.EXPANSIONS[k + 1]){                                        // 다음에 열 땅 — 그 모양 그대로 점선
    fieldEdges(openField(k + 1), 0).forEach(([ua, va, ub, vb]) => {
      const p = isoP(ua, va), q = isoP(ub, vb), n = Math.round(Math.hypot(q.x - p.x, q.y - p.y) / 5);
      for (let j = 0; j < n; j += 2) isoSeg({ x: p.x + (q.x - p.x) * j / n, y: p.y + (q.y - p.y) * j / n }, { x: p.x + (q.x - p.x) * (j + 1) / n, y: p.y + (q.y - p.y) * (j + 1) / n }, '#00000030', 1);
    });
  }
  R.plotIds(W, 'field').forEach(id => isoPlot(id, W.plots[id]));
}
// 겹 4 — 작물. 칸 가운데 두둑 위에 세운다. 뒤 칸부터 그려야 앞 칸 잎이 뒤를 덮는다.
/* 작물은 대각선 한 줄(x+y 가 같은 칸들)씩 담아 두고 깊이순에 끼운다. 겹 하나로 얹으면
   밭 뒤에 선 분수·동상 받침이 앞줄 잎을 덮는다(판 화면에서는 없던 일이다). */
function isoCropBands(cast, windStep){
  const bands = {};
  R.plotIds(W, 'field').forEach(id => {
    const p = W.plots[id]; if (!p || !p.crop || (p.giant && (!p.pairOf || id > p.pairOf))) return;
    const q = R.parseId(id), k = q.x + q.y;
    (bands[k] = bands[k] || []).push(id);
  });
  Object.keys(bands).forEach(k => {
    const ids = bands[k].sort(), n = Number(k);
    let sig = windStep + '|' + curWind.toFixed(2) + '|';
    ids.forEach(id => { const p = W.plots[id]; sig += id + p.crop.charAt(0) + R.stageOf(p) + (p.wilted ? 'x' : '') + (p.giant ? 'G' : '') + ';'; });
    let x0 = Infinity, x1 = -Infinity;
    ids.forEach(id => { const q = R.parseId(id), c = isoP(q.x + 0.5, q.y + 0.5).x; x0 = Math.min(x0, c); x1 = Math.max(x1, c); });
    const y = isoP(n / 2 + 0.5, n / 2 + 0.5).y;
    cast.push({ d: n + 0.9, go: () => { cropHits.push({ n, ids, e: isoSprite('crop' + n, sig, { x: x0 - 44, y: y - 70, w: x1 - x0 + 88, h: 96 }, () => isoCrops(windStep, ids)) }); } });
  });
}
function isoCrops(windStep, ids){
  const open = ids.slice();
  const sway = (x, y) => Math.round(Math.sin(windStep / 640 + x * 0.7 + y * 0.4) * curWind);
  open.forEach(id => {
    const p = W.plots[id], q = R.parseId(id);
    if (p.giant){
      if (!p.pairOf || id > p.pairOf) return;
      const o = R.parseId(p.pairOf), cu = (q.x + o.x) / 2 + 0.5, cv = (q.y + o.y) / 2 + 0.5;
      withBB(flatOffAt(((q.x + o.x) / 2 + 0.5) * T, ((q.y + o.y) / 2 + 0.75) * T, cu, cv + 0.1, 3), () => withInk(INK.crop, () => drawGiant(id, p, sway(q.x, q.y))));
      return;
    }
    withBB(flatOffAt(q.x * T + 16, q.y * T + 24, q.x + 0.5, q.y + 0.55, 3), () => cropAt(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, sway(q.x, q.y)));
  });
}

// ---- 곧게 세우기 — 위에서 본 그림을 칸 위에 그대로 세운다 ----
// 위에서 본 좌표 (fx,fy) 가 화면의 칸 (u,v,z) 에 오도록 옮길 거리(도트)
function flatOffAt(fx, fy, u, v, z){ const q = isoP(u, v, z); return { x: Math.round(q.x - fx), y: Math.round(q.y - fy) }; }
function flatOff(fx, fy){ return flatOffAt(fx, fy, fx / T, fy / T); }
// 자리 b 에 서는 것 — 그림 밑단 가운데를 칸 마름모 가운데보다 조금 앞에 둔다
function bbOffset(b){ return flatOffAt((b.x + b.w / 2) * T, (b.y + b.h) * T - 3, b.x + b.w / 2 + 0.22, b.y + b.h / 2 + 0.22); }
function withBB(off, fn){
  ctx.save(); ctx.translate(Math.round(off.x * S), Math.round(off.y * S)); lampOff = off;
  try { fn(); } finally { lampOff = null; ctx.restore(); }
}
// 꾸미개 하나만 있는 것처럼 그린다 — drawDecor·drawDecorLive 는 W.decor 를 통째로 훑는다
function onlyDecor(id, fn){
  const keep = W.decor, one = {}; one[id] = keep[id];
  W.decor = one;
  try { fn(); } finally { W.decor = keep; }
}
/* 담아 둔 그림 둘레에 한 도트 테를 두른다 — 판 그림의 withInk 와 같은 구실. withInk 는 다섯 번 그려야 해서
   다 그린 캔버스에서 한 번에 찾는다. 반쯤 비치는 그림자는 몸이 아니니 테를 안 두른다(알파 140 아래). */
function inkRim(cv, col){
  const w = cv.width, h = cv.height, d = Math.max(1, Math.round(S)), g = cv.getContext('2d');
  const img = g.getImageData(0, 0, w, h), a = img.data, n = parseInt(col.slice(1), 16);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = a[i * 4 + 3] > 140 ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = y * w + x;
    if (solid[i]) continue;
    if ((x >= d && solid[i - d]) || (x + d < w && solid[i + d]) || (y >= d && solid[i - d * w]) || (y + d < h && solid[i + d * w])){
      const j = i * 4; a[j] = n >> 16; a[j + 1] = (n >> 8) & 255; a[j + 2] = n & 255; a[j + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}
// 한 번 그려 작은 캔버스에 담아 둔다. 표(sig)가 바뀌면 다시. 등불 자리도 함께 담는다. ink 가 있으면 테를 두른다.
function isoSprite(id, sig, box, paint, ink){
  let e = isoBuf[id];
  const gk = COLS + 'x' + ROWS;                          // 섬 크기가 바뀌면 같은 그림도 자리가 옮겨진다
  if (!e || e.sig !== sig || e.S !== S || e.gk !== gk){
    // 다 그린 뒤에만 담는다 — 그리다 터지면 반쪽 그림이 굳지 않고 다음 장에 다시 그린다
    // 작물 줄은 바람 단계마다 다시 그린다 — 크기가 같으면 캔버스를 새로 만들지 않고 비워 쓴다(폰의 쓰레기 수거를 덜려고)
    const old = e, w = Math.max(1, Math.ceil(box.w * S) + 2), h = Math.max(1, Math.ceil(box.h * S) + 2);
    delete isoBuf[id];
    e = { sig, S, gk, lamps: [], cv: old && old.cv.width === w && old.cv.height === h ? old.cv : document.createElement('canvas') };
    e.ox = Math.floor(box.x * S); e.oy = Math.floor(box.y * S);
    if (e.cv !== (old && old.cv)){ e.cv.width = w; e.cv.height = h; }
    const g = e.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false;
    g.translate(-e.ox, -e.oy);
    const keepCtx = ctx, keepLamps = lamps;
    ctx = g; lamps = e.lamps;
    try { paint(); } finally { ctx = keepCtx; lamps = keepLamps; }
    if (isoLook().below === 'lava'){
      if (ink === INK.build) scorchSprite(e.cv, id);
      else if (ink === INK.tree || id.slice(0, 4) === 'crop') duskPlants(e.cv);
    }
    if (ink) inkRim(e.cv, ink);
    isoBuf[id] = e;
  }
  ctx.drawImage(e.cv, e.ox, e.oy);
  return e;
}
function isoBoxOf(b){
  const l = isoP(b.x, b.y + b.h), r = isoP(b.x + b.w, b.y), t = isoP(b.x, b.y), f = isoP(b.x + b.w, b.y + b.h);
  return { x: l.x - 40, y: t.y - 150, w: r.x - l.x + 80, h: f.y - t.y + 170 };
}

// ---- 아이소 집 짓기 ----
function isoGeo(b, ins, H){ return { u0: b.x + ins, v0: b.y + ins, u1: b.x + b.w - ins, v1: b.y + b.h - ins, H }; }
// 면 위 네모. L 은 앞쪽(v1) 면을 왼쪽에서부터, R 은 오른쪽(u1) 면을 앞 모서리에서부터 잰다(칸 단위).
function faceQuad(G, side, a0, a1, z0, z1){
  return side === 'L' ? [[G.u0 + a0, G.v1, z0], [G.u0 + a1, G.v1, z0], [G.u0 + a1, G.v1, z1], [G.u0 + a0, G.v1, z1]]
                      : [[G.u1, G.v1 - a0, z0], [G.u1, G.v1 - a1, z0], [G.u1, G.v1 - a1, z1], [G.u1, G.v1 - a0, z1]];
}
function faceRect(G, side, a0, a1, z0, z1, col){ poly3(faceQuad(G, side, a0, a1, z0, z1), col); }
function faceMid(G, side, a, z){ return side === 'L' ? isoP(G.u0 + a, G.v1, z) : isoP(G.u1, G.v1 - a, z); }
// 벽 결. 면을 따라 흐르는 줄은 왼쪽 면에서 y - x/2, 오른쪽 면에서 y + x/2 가 같다.
function wallTex(col, side, mat, seed){
  const dk = shade(col, -16), lt = shade(col, 12), sm = shade(col, -26), gr = shade(col, -7);
  return (x, y) => {
    const s = side === 'L' ? y - x / 2 : y + x / 2;
    if (mat === 'wood'){                                                        // 널빤지 — 판마다 빛깔이 조금씩, 옹이와 이음매 못
      const plank = Math.floor(s / 7), band = ((Math.floor(s) % 7) + 7) % 7, xm = ((x % 26) + 26) % 26;
      if (band === 0) return lt;
      if (band === 6) return dk;
      if (xm === 0) return sm;
      if (xm === 1 && (band === 2 || band === 4)) return sm;                    // 못 머리
      const kn = hash2(x >> 2, plank, seed + 9);
      if (kn > 0.975) return band === 3 ? sm : dk;                              // 옹이
      const tone = hash2(Math.floor((x + plank * 13) / 26), plank, seed + 4);
      if (hash2(x >> 1, plank, seed) > 0.86) return gr;
      return tone > 0.72 ? shade(col, 5) : tone < 0.22 ? shade(col, -5) : col;
    }
    if (mat === 'stone'){                                                       // 돌마다 빛깔이 다르고 윗단이 밝다
      const row = Math.floor(s / 5), band = ((Math.floor(s) % 5) + 5) % 5, cx = x + (row % 2) * 6, cm = ((cx % 12) + 12) % 12;
      if (band === 4 || cm === 0) return sm;
      if (band === 0 && cm > 1) return lt;
      if (cm === 11 && band > 1) return dk;
      const t = hash2(Math.floor(cx / 12), row, seed), h = hash2(x >> 1, Math.floor(s), seed + 2);
      const base = t > 0.66 ? shade(col, 8) : t < 0.3 ? shade(col, -9) : col;
      return h > 0.9 ? lt : h < 0.07 ? dk : base;
    }
    if (mat === 'plaster'){                                                     // 회벽 — 손으로 바른 얼룩, 빗물 자국, 가는 금
      const h = hash2(x >> 1, Math.floor(s / 3), seed);
      if (hash2(x >> 1, Math.floor(y / 14), seed + 3) > 0.95 && (((y % 14) + 14) % 14) < 9) return gr;   // 흘러내린 자국
      if (hash2(Math.floor(x / 9), Math.floor(s / 11), seed + 7) > 0.97 && ((x + Math.floor(s)) & 3) === 0) return sm;   // 금
      return h > 0.93 ? gr : h < 0.04 ? lt : col;
    }
    return col;
  };
}
// 기와·너와 — 한 장마다 빛깔이 조금씩 다르고, 왼쪽 위 귀가 빛을 받는다. 가끔 이끼 낀 장.
function roofTex(col, side){
  const hi = shade(col, 16), lo = shade(col, -18), seam = shade(col, -30), up = shade(col, 8), dn = shade(col, -9), moss = mix(col, '#5f7a3c', 0.35);
  return (x, y) => {
    const s = side === 'L' ? y - x / 2 : y + x / 2, row = Math.floor(s / 4), band = ((Math.floor(s) % 4) + 4) % 4;
    const cx = x + (row % 2) * 5, cm = ((cx % 10) + 10) % 10, h = hash2(Math.floor(cx / 10), row, 57);
    if (band === 3) return lo;
    if (band === 0) return h < 0.12 ? up : hi;
    if (cm === 0) return seam;
    if (cm === 1 && band === 1) return hi;
    if (h > 0.985) return moss;
    return h > 0.8 ? up : h < 0.2 ? dn : col;
  };
}
function glassTex(col, side){
  const rib = '#a9d3e8', shine = '#ffffffb0';
  return (x, y) => {
    const s = side === 'L' ? y - x / 2 : y + x / 2;
    if ((((x % 12) + 12) % 12) === 0) return rib;
    if ((((Math.floor(s) % 9) + 9) % 9) === 0) return rib;
    if (((x + Math.floor(s)) % 17 + 17) % 17 < 2) return shine;
    return col;
  };
}
function isoShadow(G){
  poly3([[G.u0 + 0.2, G.v0 + 0.25, 0], [G.u1 + 0.35, G.v0 + 0.25, 0], [G.u1 + 0.35, G.v1 + 0.35, 0], [G.u0 + 0.2, G.v1 + 0.35, 0]], 'rgba(30,44,24,0.2)');
}
function isoWalls(G, wall, mat, seed){
  faceRect(G, 'L', 0, G.u1 - G.u0, 0, G.H, wallTex(wall, 'L', mat, seed));
  faceRect(G, 'R', 0, G.v1 - G.v0, 0, G.H, wallTex(shade(wall, -30), 'R', mat, seed + 1));
  faceRect(G, 'L', 0, G.u1 - G.u0, 0, 2, shade(wall, -34));        // 땅에 닿는 쪽 그늘
  faceRect(G, 'R', 0, G.v1 - G.v0, 0, 2, shade(wall, -50));
  wallDepth(G, 0);
}
/* 벽의 겹 — 땅 그늘이 위로 옅게 번지고, 앞 모서리에 빛 한 줄, 오른쪽 면 먼 끝에 그늘 한 줄.
   벽을 다 칠한 뒤(창·문을 달기 전) 부른다. 도트 한 줄 = u 로 0.05. */
function wallDepth(G, z0){
  const lenL = G.u1 - G.u0, lenR = G.v1 - G.v0;
  for (let k = 0; k < 4; k++){
    const a = (0.16 - k * 0.04).toFixed(2);
    faceRect(G, 'L', 0, lenL, z0 + 2 + k, z0 + 3 + k, 'rgba(40,30,20,' + a + ')');
    faceRect(G, 'R', 0, lenR, z0 + 2 + k, z0 + 3 + k, 'rgba(20,14,10,' + a + ')');
  }
  faceRect(G, 'L', lenL - 0.05, lenL, z0, G.H, 'rgba(255,250,235,0.32)');
  faceRect(G, 'L', 0, 0.05, z0, G.H, 'rgba(40,30,20,0.12)');
  faceRect(G, 'R', lenR - 0.05, lenR, z0, G.H, 'rgba(0,0,0,0.16)');
}
// 처마 그늘 — 지붕이 벽 위쪽에 드리운다(지붕을 얹기 바로 전에)
function eaveShade(G, deep){
  const lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, n = deep || 5;
  for (let k = 0; k < n; k++){
    const a = (0.3 - k * 0.3 / n).toFixed(2);
    faceRect(G, 'L', 0, lenL, G.H - 1 - k, G.H - k, 'rgba(30,20,12,' + a + ')');
    faceRect(G, 'R', 0, lenR, G.H - 1 - k, G.H - k, 'rgba(10,6,4,' + a + ')');
  }
}
/* 박공지붕. ridge 'u' 면 용마루가 u 쪽(오른쪽 아래)으로 뻗어 오른쪽 면에 박공 세모가 서고,
   'v' 면 용마루가 v 쪽으로 뻗어 앞(왼쪽) 면에 박공이 선다. 뒤 비탈은 용마루가 높아 거의 가린다.
   o.mid 는 뒤 비탈과 박공 다음, 앞 비탈 앞에 그릴 것(굴뚝·다락창). */
// 겨울이면 보이는 비탈 위쪽 칠 할에 눈이 얹히고 아래 끝은 고드름처럼 들쭉날쭉(paintIsoThing 이 켠다)
let isoSnow = false;
function snowTex(x, y){ return hash2(x >> 1, y >> 1, 977) > 0.88 ? '#dfe9f0' : '#f6fafc'; }
function roofSnow(pts, edge){
  poly3(pts, snowTex);
  const [a, b] = edge, n = 14;
  for (let k = 0; k <= n; k++){ const f = k / n, q = isoP(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); px(Math.round(q.x) - 1, Math.round(q.y), 3, 1 + (k % 3 === 0 ? 2 : k % 2), '#f6fafc'); }
}
function isoRoof(G, o){
  const e = o.eave == null ? 0.16 : o.eave, H = G.H, top = H + o.rise, low = H - 2, dz = 3;
  const base = o.roof, dark = shade(base, -30), side = shade(base, -46), tex = o.glass ? glassTex : o.straw ? strawTex : roofTex;
  const fill = o.glass ? c => c + 'c0' : c => c;
  if (!o.glass && !o.open) eaveShade(G, Math.round(3 + e * 10));              // 벽 없이 기둥에 얹은 지붕(open)은 그늘 칠할 벽이 없다
  const lip = shade(base, 30);                                                 // 처마 끝 빛 한 줄
  if (o.ridge === 'v'){
    const um = (G.u0 + G.u1) / 2;
    poly3([[G.u0 - e, G.v0 - e, low], [um, G.v0 - e, top], [um, G.v1 + e, top], [G.u0 - e, G.v1 + e, low]], fill(dark));
    poly3([[G.u0, G.v1, H], [G.u1, G.v1, H], [um, G.v1, top]], o.gable ? wallTex(o.gable, 'L', 'wood', 71) : shade(o.wall, -8));
    if (o.mid) o.mid(um);
    poly3([[um, G.v0 - e, top], [um, G.v1 + e, top], [G.u1 + e, G.v1 + e, low], [G.u1 + e, G.v0 - e, low]], tex(fill(base), 'R'));
    poly3([[G.u0 - e, G.v1 + e, low], [um, G.v1 + e, top], [um, G.v1 + e, top - dz], [G.u0 - e, G.v1 + e, low - dz]], side);
    poly3([[um, G.v1 + e, top], [G.u1 + e, G.v1 + e, low], [G.u1 + e, G.v1 + e, low - dz], [um, G.v1 + e, top - dz]], dark);
    poly3([[G.u1 + e, G.v1 + e, low], [G.u1 + e, G.v0 - e, low], [G.u1 + e, G.v0 - e, low - dz], [G.u1 + e, G.v1 + e, low - dz]], side);
    isoSeg(isoP(um, G.v0 - e, top), isoP(um, G.v1 + e, top), shade(base, 34), 2);
    if (!o.glass){
      isoSeg(isoP(G.u1 + e, G.v0 - e, low), isoP(G.u1 + e, G.v1 + e, low), lip, 1);
      isoSeg(isoP(G.u0 - e, G.v1 + e, low), isoP(um, G.v1 + e, top), lip, 1);
      isoSeg(isoP(um, G.v1 + e, top), isoP(G.u1 + e, G.v1 + e, low), shade(base, 10), 1);
    }
    if (!isoSnow && !o.glass && isoTheme() === 'cloud'){ roofPetals([[um, G.v0 - e, top], [um, G.v1 + e, top], [G.u1 + e, G.v1 + e, low], [G.u1 + e, G.v0 - e, low]]); roofPetals([[G.u0 - e, G.v0 - e, low], [um, G.v0 - e, top], [um, G.v1 + e, top], [G.u0 - e, G.v1 + e, low]], 0.6); }
    if (isoSnow && !o.glass){
      const us = um + 0.7 * (G.u1 + e - um), zs = top + 0.7 * (low - top);
      roofSnow([[um, G.v0 - e, top], [um, G.v1 + e, top], [us, G.v1 + e, zs], [us, G.v0 - e, zs]], [[us, G.v1 + e, zs], [us, G.v0 - e, zs]]);
      isoSeg(isoP(G.u0 - e, G.v1 + e, low), isoP(um, G.v1 + e, top), '#f6fafc', 2);
    }
    return { top: isoP(um, G.v1 + e, top) };
  }
  const vm = (G.v0 + G.v1) / 2;
  poly3([[G.u0 - e, G.v0 - e, low], [G.u1 + e, G.v0 - e, low], [G.u1 + e, vm, top], [G.u0 - e, vm, top]], fill(dark));
  poly3([[G.u1, G.v1, H], [G.u1, G.v0, H], [G.u1, vm, top]], o.gable ? wallTex(o.gable, 'R', 'wood', 72) : shade(o.wall, -34));
  if (o.mid) o.mid(vm);
  poly3([[G.u0 - e, G.v1 + e, low], [G.u1 + e, G.v1 + e, low], [G.u1 + e, vm, top], [G.u0 - e, vm, top]], tex(fill(base), 'L'));
  poly3([[G.u0 - e, G.v1 + e, low], [G.u1 + e, G.v1 + e, low], [G.u1 + e, G.v1 + e, low - dz], [G.u0 - e, G.v1 + e, low - dz]], side);
  poly3([[G.u1 + e, G.v1 + e, low], [G.u1 + e, vm, top], [G.u1 + e, vm, top - dz], [G.u1 + e, G.v1 + e, low - dz]], dark);
  poly3([[G.u1 + e, vm, top], [G.u1 + e, G.v0 - e, low], [G.u1 + e, G.v0 - e, low - dz], [G.u1 + e, vm, top - dz]], side);
  isoSeg(isoP(G.u0 - e, vm, top), isoP(G.u1 + e, vm, top), shade(base, 34), 2);
  if (!o.glass){
    isoSeg(isoP(G.u0 - e, G.v1 + e, low), isoP(G.u1 + e, G.v1 + e, low), lip, 1);
    isoSeg(isoP(G.u1 + e, G.v1 + e, low), isoP(G.u1 + e, vm, top), shade(base, 10), 1);
  }
  if (!isoSnow && !o.glass && isoTheme() === 'cloud') roofPetals([[G.u0 - e, G.v1 + e, low], [G.u1 + e, G.v1 + e, low], [G.u1 + e, vm, top], [G.u0 - e, vm, top]]);
  if (isoSnow && !o.glass){
    const vs = vm + 0.7 * (G.v1 + e - vm), zs = top + 0.7 * (low - top);
    roofSnow([[G.u0 - e, vs, zs], [G.u1 + e, vs, zs], [G.u1 + e, vm, top], [G.u0 - e, vm, top]], [[G.u0 - e, vs, zs], [G.u1 + e, vs, zs]]);
    isoSeg(isoP(G.u1 + e, G.v1 + e, low), isoP(G.u1 + e, vm, top), '#f6fafc', 2);
  }
  return { top: isoP(G.u1 + e, vm, top) };
}
// 꽃구름 섬 지붕에 내려앉은 벚꽃잎(2026-10-07 로키즈 「건물 지붕에도 벚꽃이 약간 쌓여」) — 군데군데 모여 있고 나머지는 드문드문
function roofPetals(pts, k){
  k = k == null ? 1 : k;
  poly3(pts, (x, y) => { const q = hash2(x, y, 1701), n = vnoise(x / 9, y / 7, 1702); return q < (0.012 + Math.max(0, n - 0.55) * 0.3) * k ? PETAL[Math.floor(hash2(x, y, 1703) * 4)] : null; });
}
function isoWindow(G, side, a, w, z, h, night){
  faceRect(G, side, a - 0.05, a + w + 0.05, z - 2, z + h + 2, WOOD.dark);
  faceRect(G, side, a, a + w, z, z + h, night ? '#ffd98a' : '#8fc7e0');
  faceRect(G, side, a, a + w, z + h * 0.62, z + h, night ? '#ffeec0' : '#bfe4f7');
  if (!night) faceRect(G, side, a + w * 0.15, a + w * 0.3, z + 2, z + h - 1, '#eaf6ff');
  faceRect(G, side, a + w / 2 - 0.025, a + w / 2 + 0.025, z, z + h, WOOD.dark);
  faceRect(G, side, a, a + w, z + h / 2 - 1, z + h / 2, WOOD.dark);
  faceRect(G, side, a - 0.08, a + w + 0.08, z - 4, z - 2, WOOD.low);
  if (night){ const q = faceMid(G, side, a + w / 2, z + h / 2); lamp(q.x, q.y, 24); }
}
function isoDoor(G, side, a, w, h, col){
  faceRect(G, side, a - 0.05, a + w + 0.05, 0, h + 2, WOOD.line);
  faceRect(G, side, a, a + w, 0, h, col);
  for (let z = 6; z < h; z += 7) faceRect(G, side, a, a + w, z, z + 1, shade(col, -18));
  faceRect(G, side, a, a + 0.05, 0, h, 'rgba(0,0,0,0.22)');
  doorHardware(G, side, a, w, h);
}
/* 가게 — 뒤는 트여 있고 아저씨가 그 안에 선다. 앞에 낮은 판대, 위에 높은 줄무늬 차양.
   차양을 낮게 두면 비스듬히 내려다보는 눈에 아저씨가 통째로 가린다(처음 판이 그랬다). */
// 나라 빛깔 — 그리스 바다색·회벽, 스위스 샬레, 일본 집(가게·온실이 먼저 쓰므로 여기 둔다)
const AEGEAN = '#2f6fb8', WHITEWASH = '#fbf8f2', LIME = '#e6dfd2';
const CHALET = { wood: '#a86b3e', dark: '#6e4326', roof: '#5f514a', trim: '#f6efe2', shutter: '#3f7a4a' };
const WA = { post: '#4a3a2e', plaster: '#f3eee2', shoji: '#f6efd9', tile: '#4a5160', stone: '#a9a79f', deck: '#9a7650', indigo: '#2f3f6e', ink: '#2b2f36' };
// 들판 가게 간판 안쪽 — 과일 셋. 나라 가게는 간판 대신 나라 깃발을 단다(ipStallFlagLive).
function isoStallSign(sx, sy){
  px(sx + 4, sy + 3, 4, 4, '#f2857a'); px(sx + 10, sy + 3, 4, 4, '#8fd66c'); px(sx + 16, sy + 3, 4, 4, '#ffe066');
}
// 나라마다 차양 두 빛깔 · 자락 두 빛깔 · 옆 띠.
const STALL_LOOK = {
  seaside:  { a: ['#ffffff', AEGEAN], skirt: ['#e6e2da', '#245a98'], side: '#245a98' },
  mountain: { a: ['#fff6e9', '#d93a3a'], skirt: ['#e8dccb', '#b52a2a'], side: '#b52a2a' },
  cloud:    { a: ['#f4ead8', WA.indigo], skirt: ['#ddd2bf', '#22305a'], side: '#22305a' },
};
function isoStall(b, cal){
  const th = isoTheme();
  if (th === 'seaside') return isoStallGreek(b, cal);
  if (th === 'mountain') return isoStallSwiss(b, cal);
  if (th === 'cloud') return isoStallWa(b, cal);
  const O = isoGeo(b, 0.18, 0), lenL = O.u1 - O.u0, K = STALL_LOOK[isoTheme()] || { a: ['#fff6e9', '#f2857a'], skirt: ['#e8dccb', '#d9665c'], side: '#c95a58' };
  const post = (u, v) => isoCube(u - 0.05, v - 0.05, 0.1, 0.1, 0, 60, WOOD.hi, WOOD.mid, WOOD.dark);
  if (stallPart !== 'front'){
    isoShadow(O);
    poly3([[O.u0, O.v0, 1], [O.u1, O.v0, 1], [O.u1, O.v1, 1], [O.u0, O.v1, 1]], wallTex(WOOD.low, 'L', 'wood', 23));   // 널마루
    post(O.u0, O.v0); post(O.u1, O.v0);
    // 뒤 선반 — 상자 둘
    isoCube(O.u0 + 0.15, O.v0 + 0.08, 0.5, 0.3, 1, 14, WOOD.hi, WOOD.mid, WOOD.dark);
    isoCube(O.u1 - 0.7, O.v0 + 0.08, 0.5, 0.3, 1, 10, '#e0c268', WOOD.mid, WOOD.dark);
  }
  if (stallPart === 'back') ctx = VOID_CTX; else if (!stallPart) drawStallKeeperIso(b, 0);   // 가게 아저씨 — 나눠 그릴 땐 drawFarmIso 가 매 장
  const G = { u0: O.u0, u1: O.u1, v0: O.v1 - 0.5, v1: O.v1, H: 18 };                                                 // 앞 판대
  isoWalls(G, WOOD.mid, 'wood', 21);
  poly3([[G.u0 - 0.07, G.v0 - 0.07, G.H + 2], [G.u1 + 0.07, G.v0 - 0.07, G.H + 2], [G.u1 + 0.07, G.v1 + 0.07, G.H + 2], [G.u0 - 0.07, G.v1 + 0.07, G.H + 2]], WOOD.hi);   // 판 윗면
  poly3([[G.u0 - 0.07, G.v1 + 0.07, G.H + 2], [G.u1 + 0.07, G.v1 + 0.07, G.H + 2], [G.u1 + 0.07, G.v1 + 0.07, G.H], [G.u0 - 0.07, G.v1 + 0.07, G.H]], WOOD.dark);
  poly3([[G.u1 + 0.07, G.v1 + 0.07, G.H + 2], [G.u1 + 0.07, G.v0 - 0.07, G.H + 2], [G.u1 + 0.07, G.v0 - 0.07, G.H], [G.u1 + 0.07, G.v1 + 0.07, G.H]], WOOD.line);
  const goods = { spring: ['#ff5c6b', '#ffe066', '#8fd66c'], summer: ['#3f9a4b', '#ff5a4a', '#ffcf3d'], autumn: ['#ff9a2e', '#8a5cc7', '#e8f2c0'], winter: ['#eef8ff', '#4fa653', '#e8f4ee'] }[cal.season];
  goods.forEach((c, i) => {                                                     // 광주리 셋 — 계절 물건
    const u = G.u0 + 0.2 + i * (lenL - 0.6) / 2, v = G.v0 + 0.07;
    isoCube(u, v, 0.36, 0.36, G.H + 2, G.H + 7, c, WOOD.dark, shade(WOOD.dark, -12));
    const q = isoP(u + 0.18, v + 0.18, G.H + 7), x = Math.round(q.x), y = Math.round(q.y);
    px(x - 4, y - 3, 8, 3, c); px(x - 2, y - 5, 5, 2, c); px(x - 1, y - 5, 2, 1, shade(c, 40)); px(x + 2, y - 2, 2, 2, shade(c, -30));
  });
  faceRect(G, 'L', lenL / 2 - 0.3, lenL / 2 + 0.3, 7, 13, '#fff6e9');           // 값 쪽지
  { const q = faceMid(G, 'L', lenL / 2 - 0.2, 11); px(Math.round(q.x), Math.round(q.y), 10, 1, '#8a7a63'); }
  post(G.u0, G.v1); post(G.u1, G.v1);
  const n = 6, e = 0.12, zb = 66, zf = 56, vf = G.v1 + e + 0.12, vb = O.v0 - e;
  for (let k = 0; k < n; k++){                                                  // 줄무늬 차양 — 뒤가 조금 높다
    const ua = G.u0 - e + (lenL + 2 * e) * k / n, ub = G.u0 - e + (lenL + 2 * e) * (k + 1) / n;
    poly3([[ua, vb, zb], [ub, vb, zb], [ub, vf, zf], [ua, vf, zf]], K.a[k % 2 ? 0 : 1]);
    for (let s = 0; s < 2; s++){                                               // 물결 자락
      const sa = ua + (ub - ua) * s / 2, sb = ua + (ub - ua) * (s + 1) / 2;
      poly3([[sa, vf, zf], [sb, vf, zf], [sb, vf, zf - 3], [(sa + sb) / 2, vf, zf - 5], [sa, vf, zf - 3]], K.skirt[k % 2 ? 0 : 1]);
    }
  }
  poly3([[G.u1 + e, vb, zb], [G.u1 + e, vf, zf], [G.u1 + e, vf, zf - 2], [G.u1 + e, vb, zb - 2]], K.side);
  if (isoTheme() === 'cloud') [0.25, 0.75].forEach(f => {                       // 차양 끝에 매단 붉은 초롱 둘
    const q = isoP(G.u0 + lenL * f, vf, zf - 6), x = Math.round(q.x), y = Math.round(q.y);
    px(x, y - 4, 1, 4, WA.post); px(x - 3, y, 7, 10, '#e8453c'); px(x - 2, y - 1, 5, 1, WA.ink); px(x - 2, y + 10, 5, 1, WA.ink);
    px(x - 3, y + 3, 7, 1, '#b8322b'); px(x - 3, y + 6, 7, 1, '#b8322b'); px(x - 1, y + 1, 1, 7, '#ff8a7a');
  });
  isoSeg(isoP(G.u0 - e, vb, zb), isoP(G.u1 + e, vb, zb), '#ffffff', 1);
  // 차양 위 간판
  const sq = isoP((G.u0 + G.u1) / 2, vb + 0.05, zb);
  const sx = Math.round(sq.x) - 12, sy = Math.round(sq.y) - 12;
  px(sx - 1, sy - 1, 26, 12, WOOD.dark); px(sx, sy, 24, 10, '#fff6e9'); px(sx, sy, 24, 1, '#ffffff');
  isoStallSign(sx, sy);
  px(sx + 3, sy + 10, 2, 4, WOOD.dark); px(sx + 19, sy + 10, 2, 4, WOOD.dark);
}
/* ---- 나라마다 다른 가게(2026-09-28 로키즈 「상점이 다 똑같음」) ----
   그리스는 흰 회벽 판대에 포도 덩굴 시렁, 스위스는 기둥 위에 박공지붕을 얹은 나무 가게, 일본은 바퀴 달린 포장마차.
   아저씨(56도트)는 판대 뒤에 서므로 지붕·시렁은 높게(z 70 위) 둔다 — 낮으면 비스듬히 내려다보는 눈에 가린다. */
function stallGoods(cal){ return { spring: ['#ff5c6b', '#ffe066', '#8fd66c'], summer: ['#3f9a4b', '#ff5a4a', '#ffcf3d'], autumn: ['#ff9a2e', '#8a5cc7', '#e8f2c0'], winter: ['#eef8ff', '#4fa653', '#e8f4ee'] }[cal.season]; }
// 바닥·아저씨·판대까지 — 판대 벽과 윗판, 뒤 살림은 나라가 넘긴다
function stallCore(b, o){
  const O = isoGeo(b, 0.18, 0), lenL = O.u1 - O.u0;
  if (stallPart !== 'front'){
    isoShadow(O);
    poly3([[O.u0, O.v0, 1], [O.u1, O.v0, 1], [O.u1, O.v1, 1], [O.u0, O.v1, 1]], o.floor);
    if (o.back) o.back(O, lenL);
    if (o.backPosts) o.backPosts(O);                                         // 뒤 기둥은 아저씨보다 먼저 — 나중에 그리면 얼굴 앞을 지난다
  }
  if (stallPart === 'back') ctx = VOID_CTX; else if (!stallPart) drawStallKeeperIso(b, 0);   // 아저씨 자리 — 나눠 그릴 땐 drawFarmIso 가 매 장
  const G = { u0: O.u0, u1: O.u1, v0: O.v1 - 0.5, v1: O.v1, H: o.h || 18 };
  o.counter(G, lenL);
  const t = o.top, e = 0.07;
  poly3([[G.u0 - e, G.v0 - e, G.H + 2], [G.u1 + e, G.v0 - e, G.H + 2], [G.u1 + e, G.v1 + e, G.H + 2], [G.u0 - e, G.v1 + e, G.H + 2]], t);
  poly3([[G.u0 - e, G.v1 + e, G.H + 2], [G.u1 + e, G.v1 + e, G.H + 2], [G.u1 + e, G.v1 + e, G.H], [G.u0 - e, G.v1 + e, G.H]], shade(t, -26));
  poly3([[G.u1 + e, G.v1 + e, G.H + 2], [G.u1 + e, G.v0 - e, G.H + 2], [G.u1 + e, G.v0 - e, G.H], [G.u1 + e, G.v1 + e, G.H]], shade(t, -42));
  isoSeg(isoP(G.u0 - e, G.v1 + e, G.H + 2), isoP(G.u1 + e, G.v1 + e, G.H + 2), shade(t, 24), 1);
  return { O, G, lenL };
}
function stallPrice(G, lenL, z){
  faceRect(G, 'L', lenL / 2 - 0.3, lenL / 2 + 0.3, z, z + 6, '#fff6e9');
  const q = faceMid(G, 'L', lenL / 2 - 0.2, z + 4); px(Math.round(q.x), Math.round(q.y), 10, 1, '#8a7a63');
}
// 판 위에 담긴 계절 물건 한 무더기
function heap(x, y, c){ px(x - 4, y - 3, 8, 3, c); px(x - 2, y - 5, 5, 2, c); px(x - 1, y - 5, 2, 1, shade(c, 40)); px(x + 2, y - 2, 2, 2, shade(c, -30)); }

// ■ 그리스 — 흰 회벽 판대, 파란 윗판, 흰 기둥 넷에 나무 시렁, 시렁 위 포도 덩굴과 늘어진 포도송이
function isoStallGreek(b, cal){
  const goods = stallGoods(cal);
  const { O, G, lenL } = stallCore(b, {
    floor: (x, y) => ((x + y * 2) % 12 + 12) % 12 === 0 || ((x - y * 2) % 12 + 12) % 12 === 0 ? '#c9bfae' : hash2(x >> 1, y, 61) > 0.9 ? '#ece6da' : '#e0d8ca',   // 마름모 돌바닥
    back: (O, lenL) => {
      ibox(O.u0 + 0.15, O.v0 + 0.08, lenL - 0.3, 0.26, 1, 24, WHITEWASH);     // 뒤 벽 선반 — 흰 회벽에 파란 선반 두 칸
      const B = { u0: O.u0 + 0.15, u1: O.u1 - 0.15, v0: O.v0 + 0.08, v1: O.v0 + 0.34 };
      [9, 17].forEach(z => faceRect(B, 'L', 0.05, lenL - 0.35, z, z + 2, AEGEAN));
      for (let i = 0; i < 6; i++){ const q = faceMid(B, 'L', 0.2 + i * (lenL - 0.7) / 5, 19 - (i % 2) * 8), x = Math.round(q.x), y = Math.round(q.y); px(x - 2, y - 5, 4, 5, i % 3 ? '#c9683f' : '#e8e0c8'); px(x - 1, y - 6, 2, 1, i % 3 ? '#a4502c' : '#c9bfae'); }   // 기름 단지·물병
    },
    counter: (G, lenL) => {
      isoWalls(G, WHITEWASH, 'plaster', 63);
      for (let k = 0; k < 6; k++){ const a = 0.12 + k * (lenL - 0.36) / 5; faceRect(G, 'L', a, a + 0.18, 5, 12, '#ffffff'); faceRect(G, 'L', a + 0.02, a + 0.16, 6, 11, k % 2 ? AEGEAN : '#6f9fd8'); const q = faceMid(G, 'L', a + 0.09, 8); px(Math.round(q.x) - 1, Math.round(q.y), 2, 1, '#ffffff'); }   // 파란 타일 띠
    },
    top: AEGEAN,
    backPosts: O => [O.u0 + 0.04, O.u1 - 0.04].forEach(u => isoDrum(u, O.v0 + 0.02, 0.06, 0, 70, WHITEWASH, '#ffffff')),
  });
  goods.forEach((c, i) => {                                                     // 흙 사발 셋
    const u = G.u0 + 0.38 + i * (lenL - 0.76) / 2, v = G.v0 + 0.25;
    isoDrum(u, v, 0.16, G.H + 2, G.H + 6, '#c9683f', '#a4502c');
    const q = isoP(u, v, G.H + 6); heap(Math.round(q.x), Math.round(q.y) + 1, c);
  });
  amphora(G.u1 + 0.1, G.v1 - 0.1, 66); amphora(G.u1 + 0.14, G.v0 - 0.3, 67);
  // 시렁 — 흰 둥근 기둥 넷, 앞뒤 들보, 가로 살
  const Z = 70, vb = O.v0 + 0.02, vf = G.v1 + 0.02;
  const col = (u, v) => isoDrum(u, v, 0.06, 0, Z, WHITEWASH, '#ffffff');
  const wood = '#b08a5a';
  ibox(O.u0 - 0.12, vb - 0.04, lenL + 0.24, 0.08, Z, Z + 3, wood);
  for (let k = 0; k <= 6; k++){ const u = O.u0 - 0.05 + k * (lenL + 0.1) / 6; ibox(u - 0.03, vb - 0.1, 0.06, vf - vb + 0.24, Z + 3, Z + 5, shade(wood, 10)); }
  // 덩굴 — 살 위에 잎 덩이를 흩고 포도송이를 늘어뜨린다
  for (let i = 0; i < 46; i++){                                                // 잎 — 작은 잎을 촘촘히, 살 사이로 하늘이 조금 비친다
    const u = O.u0 + hash2(i, 1, 68) * lenL, v = vb + hash2(i, 2, 68) * (vf - vb + 0.1), q = isoP(u, v, Z + 5), x = Math.round(q.x), y = Math.round(q.y);
    const c = ['#4f8a42', '#5f9a4a', '#6fac52', '#3f7036'][i % 4];
    px(x - 3, y - 3, 6, 3, c); px(x - 2, y - 4, 4, 1, c); px(x - 2, y - 3, 2, 1, shade(c, 30)); px(x + 1, y - 1, 2, 1, shade(c, -24));
    if (i % 7 === 0) px(x, y, 1, 3 + (i % 3), '#4f7a38');                       // 늘어진 덩굴손
  }
  ibox(O.u0 - 0.12, vf - 0.04, lenL + 0.24, 0.08, Z, Z + 3, wood);
  [-0.04, 1.02].forEach((f, i) => {                                            // 앞 들보에 늘어진 포도송이 — 아저씨 얼굴을 비켜 양 끝에
    const q = isoP(O.u0 + lenL * f, vf + 0.04, Z), x = Math.round(q.x), y = Math.round(q.y);
    px(x, y, 1, 3, '#4f7a38');
    for (let r = 0; r < 4; r++) for (let c2 = 0; c2 < 4 - r; c2++) px(x - 3 + c2 * 2 + r, y + 3 + r * 2, 2, 2, (r + c2 + i) % 3 ? '#6a3f8a' : '#8a5cb0');
  });
  col(O.u0 + 0.04, vf); col(O.u1 - 0.04, vf);
  bougainvillea({ u0: O.u0, u1: O.u1, v0: O.v0, v1: vf + 0.07 }, 'L', -0.05, 0.25, Z - 6, 69);
  // 앞 들보에 매단 그리스 국기 — 막대와 끈만 여기서, 천은 ipStallFlagLive 가 매 장 바람에 날린다
  const q = isoP(O.u0 + lenL * 0.12, vf, Z), sx = Math.round(q.x) - 7, sy = Math.round(q.y) + 3;   // 왼쪽 끝 — 가운데면 아저씨 얼굴을 가린다
  px(sx, sy - 3, 1, 3, '#6b5d4a'); px(sx + 13, sy - 3, 1, 3, '#6b5d4a'); px(sx - 1, sy - 1, 16, 1, '#6b5d4a');
  stallFlagAt = { th: 'seaside', hang: true, x: sx, y: sy, w: 14, h: 9 };
}

// ■ 스위스 — 높은 기둥 넷 위 박공지붕(너와), 나무 판대에 하트 구멍과 제라늄 상자, 치즈 바퀴·우유통, 처마에 소 방울
function isoStallSwiss(b, cal){
  const goods = stallGoods(cal);
  const { O, G, lenL } = stallCore(b, {
    floor: wallTex(CHALET.wood, 'L', 'wood', 71),
    back: (O, lenL) => {
      ibox(O.u0 + 0.12, O.v0 + 0.06, lenL - 0.24, 0.28, 1, 26, CHALET.dark);      // 뒤 선반 — 치즈 바퀴를 층층이
      const B = { u0: O.u0 + 0.12, u1: O.u1 - 0.12, v0: O.v0 + 0.06, v1: O.v0 + 0.34 };
      [10, 19].forEach(z => faceRect(B, 'L', 0, lenL - 0.24, z, z + 1, shade(CHALET.dark, 24)));
      for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++){ const q = faceMid(B, 'L', 0.2 + i * (lenL - 0.6) / 4, 11 + r * 9), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 6, 7, 6, '#f2c94e'); px(x - 3, y - 6, 7, 1, '#ffe08a'); px(x + 3, y - 6, 1, 6, '#c99a2e'); if (i % 2) px(x - 1, y - 4, 1, 1, '#c99a2e'); }
    },
    counter: (G, lenL) => {
      isoWalls(G, CHALET.wood, 'wood', 73);
      for (let k = 0; k < 3; k++){ const q = faceMid(G, 'L', 0.35 + k * (lenL - 0.7) / 2, 9), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 2, 3, 2, '#3a2a1f'); px(x + 1, y - 2, 3, 2, '#3a2a1f'); px(x - 3, y, 7, 2, '#3a2a1f'); px(x - 2, y + 2, 5, 1, '#3a2a1f'); px(x - 1, y + 3, 3, 1, '#3a2a1f'); }   // 하트 구멍
      faceRect({ u0: G.u0, v1: G.v1 + 0.1 }, 'L', 0.05, lenL - 0.05, 2, 6, CHALET.dark);   // 판대 앞 제라늄 상자
      for (let k = 0; k < 9; k++){ const q = faceMid({ u0: G.u0, v1: G.v1 + 0.1 }, 'L', 0.12 + k * (lenL - 0.24) / 8, 6), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y - 3, 3, 3, '#4f8f48'); px(x, y - 5, 2, 2, k % 2 ? '#e8324a' : '#ff5a6a'); }
    },
    top: shade(CHALET.wood, 16),
    backPosts: O => [O.u0 + 0.02, O.u1 - 0.02].forEach(u => ibox(u - 0.06, O.v0 - 0.04, 0.12, 0.12, 0, 72, CHALET.dark)),
  });
  goods.forEach((c, i) => {                                                     // 나무 상자 셋 — 가운데는 큰 치즈 바퀴
    const u = G.u0 + 0.2 + i * (lenL - 0.6) / 2, v = G.v0 + 0.07;
    if (i === 1){ isoDrum(u + 0.18, v + 0.18, 0.2, G.H + 2, G.H + 8, '#e8b83a', '#f2c94e'); const q = isoP(u + 0.14, v + 0.3, G.H + 5); px(Math.round(q.x), Math.round(q.y), 2, 2, '#c99a2e'); isoEllipse(u + 0.22, v + 0.12, 0.05, 0.05, G.H + 8, '#c99a2e'); return; }
    isoCube(u, v, 0.36, 0.36, G.H + 2, G.H + 7, CHALET.wood, CHALET.dark, shade(CHALET.dark, -12));
    const q = isoP(u + 0.18, v + 0.18, G.H + 7); heap(Math.round(q.x), Math.round(q.y), c);
  });
  isoDrum(G.u1 + 0.1, G.v1 - 0.15, 0.1, 0, 14, '#c9ccd4', '#e6e8ec'); isoDrum(G.u1 + 0.1, G.v1 - 0.15, 0.06, 14, 16, '#aeb3be', '#dfe2e8');   // 우유통
  // 기둥 넷과 박공지붕 — 용마루가 u 쪽, 오른쪽에 나무 박공
  const Z = 72, P = (u, v) => ibox(u - 0.06, v - 0.06, 0.12, 0.12, 0, Z, CHALET.dark);
  P(O.u0 + 0.02, G.v1); P(O.u1 - 0.02, G.v1);
  const Rf = { u0: O.u0 + 0.02, u1: O.u1 - 0.02, v0: O.v0 + 0.02, v1: G.v1, H: Z };
  isoRoof(Rf, { ridge: 'u', rise: 14, roof: CHALET.roof, wall: CHALET.wood, gable: CHALET.wood, eave: 0.24, open: true, mid: vm => {
    const q = isoP(Rf.u1, vm, Z + 7), x = Math.round(q.x), y = Math.round(q.y);          // 박공의 하트 구멍
    px(x - 3, y - 2, 3, 2, '#3a2a1f'); px(x + 1, y - 2, 3, 2, '#3a2a1f'); px(x - 3, y, 7, 2, '#3a2a1f'); px(x - 2, y + 2, 5, 1, '#3a2a1f'); px(x - 1, y + 3, 3, 1, '#3a2a1f');
  } });
  [0.3, 1].forEach((f, i) => {                                                 // 처마에 매단 소 방울 둘 — 아저씨 얼굴 앞은 비운다
    const q = isoP(Rf.u0 + (Rf.u1 - Rf.u0) * f, Rf.v1 + 0.24, Z - 3), x = Math.round(q.x), y = Math.round(q.y);
    px(x, y, 1, 3 + i % 2 * 2, '#5a544d'); const by = y + 3 + (i % 2) * 2; px(x - 2, by, 5, 5, '#d9a93a'); px(x - 1, by, 2, 1, '#f2cf6a'); px(x - 3, by + 5, 7, 1, '#b8862a');
  });
  // 처마 밑에 매단 스위스 국기 — 막대만 여기서, 천은 ipStallFlagLive 가 매 장 바람에 날린다
  const q = isoP(Rf.u0 + (Rf.u1 - Rf.u0) * 0.1, Rf.v1 + 0.24, Z - 2), sx = Math.round(q.x) - 6, sy = Math.round(q.y) + 1;   // 왼쪽 끝
  px(sx - 2, sy - 1, 16, 1, CHALET.dark); px(sx - 2, sy - 2, 1, 1, CHALET.dark); px(sx + 13, sy - 2, 1, 1, CHALET.dark);
  stallFlagAt = { th: 'mountain', hang: true, x: sx, y: sy, w: 12, h: 12 };
}

// ■ 일본 — 바퀴 달린 포장마차. 짙은 나무 판대, 기둥 넷 위 기와지붕, 짧은 쪽빛 노렌, 붉은 초롱, 김 나는 냄비
function isoStallWa(b, cal){
  const goods = stallGoods(cal), wood = '#8a6440';
  const { O, G, lenL } = stallCore(b, {
    floor: wallTex('#b8956a', 'R', 'wood', 81),
    back: (O, lenL) => {
      ibox(O.u0 + 0.12, O.v0 + 0.06, lenL - 0.24, 0.26, 1, 20, wood);             // 뒤 찬장 — 미닫이 두 짝
      const B = { u0: O.u0 + 0.12, u1: O.u1 - 0.12, v0: O.v0 + 0.06, v1: O.v0 + 0.32 };
      faceRect(B, 'L', 0.06, (lenL - 0.24) / 2 - 0.02, 4, 17, WA.shoji); faceRect(B, 'L', (lenL - 0.24) / 2 + 0.02, lenL - 0.3, 4, 17, WA.shoji);
      for (let a = 0.16; a < lenL - 0.3; a += 0.14) faceRect(B, 'L', a, a + 0.015, 4, 17, '#b8a888');
      [0.3, lenL - 0.6].forEach(a => { const q = faceMid(B, 'L', a, 20), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 6, 7, 6, '#f6efd9'); px(x - 3, y - 6, 7, 2, '#c8323a'); });   // 술병
    },
    counter: (G, lenL) => {
      isoWalls(G, wood, 'wood', 83);
      for (let a = 0.08; a < lenL; a += 0.16) faceRect(G, 'L', a, a + 0.04, 0, G.H, shade(wood, -20));   // 세로 살
      const W2 = { u0: G.u0, u1: G.u1 + 0.02, v0: G.v0, v1: G.v1 };                // 오른쪽 옆 큰 바퀴
      const c = faceMid(W2, 'R', 0.25, 10), x = Math.round(c.x), y = Math.round(c.y);
      for (let i = 0; i < 28; i++){ const an = i / 28 * Math.PI * 2; px(Math.round(x + Math.cos(an) * 5), Math.round(y + Math.sin(an) * 9 + Math.cos(an) * 2.5), 2, 2, WA.post); }
      for (let i = 0; i < 4; i++){ const an = i / 4 * Math.PI; isoSeg({ x: x + Math.cos(an) * 5, y: y + Math.sin(an) * 8 }, { x: x - Math.cos(an) * 5, y: y - Math.sin(an) * 8 }, shade(WA.post, 20), 1); }
      px(x - 1, y - 1, 3, 3, '#2a2622');
      isoSeg(isoP(G.u0, G.v1 + 0.02, 8), isoP(G.u0 - 0.55, G.v1 + 0.12, 3), WA.post, 2);   // 끄는 채
    },
    top: '#c9a878',
    backPosts: O => [O.u0 + 0.02, O.u1 - 0.02].forEach(u => ibox(u - 0.05, O.v0 - 0.03, 0.1, 0.1, 0, 78, WA.post)),
  });
  // 판 위 — 대바구니 둘에 계절 물건, 가운데 김 나는 냄비
  goods.forEach((c, i) => {
    const u = G.u0 + 0.35 + i * (lenL - 0.7) / 2, v = G.v0 + 0.25;
    if (i === 1){ isoDrum(u, v, 0.16, G.H + 2, G.H + 9, '#3a3f4a', '#4a505c'); isoEllipse(u, v, 0.12, 0.12, G.H + 9, '#e8e0c8'); const q = isoP(u, v, G.H + 12); [-3, 0, 3].forEach((d2, j) => { for (let k = 0; k < 6; k++) px(Math.round(q.x) + d2 + (k % 2 ? 1 : 0), Math.round(q.y) - k * 2 - j, 1, 2, '#ffffffb0'); }); return; }
    isoDrum(u, v, 0.17, G.H + 2, G.H + 5, '#c9a86a', '#8a6a3a');
    for (let k = 0; k < 8; k++){ const q = isoP(u + Math.cos(k) * 0.16, v + Math.sin(k) * 0.16, G.H + 3); px(Math.round(q.x), Math.round(q.y), 1, 2, '#8a6a3a'); }
    const q = isoP(u, v, G.H + 5); heap(Math.round(q.x), Math.round(q.y) + 1, c);
  });
  // 기둥 넷과 기와지붕
  const Z = 78, P = (u, v) => ibox(u - 0.05, v - 0.05, 0.1, 0.1, 0, Z, WA.post);
  P(O.u0 + 0.02, G.v1); P(O.u1 - 0.02, G.v1);
  const Rf = { u0: O.u0 + 0.02, u1: O.u1 - 0.02, v0: O.v0 + 0.02, v1: G.v1, H: Z }, e = 0.22;
  isoRoof(Rf, { ridge: 'u', rise: 12, roof: WA.tile, wall: wood, gable: wood, eave: e, open: true });
  tileCaps(isoP(Rf.u0 - e, Rf.v1 + e, Z - 2), isoP(Rf.u1 + e, Rf.v1 + e, Z - 2), 0.16 * IT / 2);
  // 짧은 노렌 — 넉 폭, 가운데 두 폭에 흰 동그라미. 아저씨 머리 위에서 끝난다.
  const F = { u0: Rf.u0, v1: Rf.v1 + 0.04 }, len2 = Rf.u1 - Rf.u0;
  for (let k = 0; k < 4; k++){
    const a0 = 0.04 + k * (len2 - 0.08) / 4, a1 = a0 + (len2 - 0.08) / 4 - 0.03;
    faceRect(F, 'L', a0, a1, Z - 10, Z - 3, WA.indigo); faceRect(F, 'L', a0, a1, Z - 10, Z - 9, '#1f2a4a');
    if (k === 1 || k === 2){ const q = faceMid(F, 'L', k === 1 ? a1 : a0, Z - 6), x = Math.round(q.x), y = Math.round(q.y); px(x - 2, y - 2, 4, 4, '#f3eee2'); px(x - 1, y - 1, 2, 2, WA.indigo); }
  }
  faceRect(F, 'L', 0, len2, Z - 3, Z - 1, WA.post);
  [Rf.u0 - 0.05, Rf.u1 + 0.05].forEach(u => {                                   // 앞 기둥 끝에 매단 붉은 초롱
    const q = isoP(u, Rf.v1 + 0.06, Z - 8), x = Math.round(q.x), y = Math.round(q.y);
    px(x, y - 4, 1, 4, WA.post); px(x - 3, y, 7, 10, '#e8453c'); px(x - 2, y - 1, 5, 1, WA.ink); px(x - 2, y + 10, 5, 1, WA.ink);
    px(x - 3, y + 3, 7, 1, '#b8322b'); px(x - 3, y + 6, 7, 1, '#b8322b'); px(x - 1, y + 1, 1, 7, '#ff8a7a');
  });
  // 지붕 위 깃대 — 흰 바탕 붉은 해 깃발이 바람에 날린다(천은 ipStallFlagLive 가 매 장 그린다, 2026-09-29 로키즈)
  const q = isoP((Rf.u0 + Rf.u1) / 2, (Rf.v0 + Rf.v1) / 2, Z + 14), fx = Math.round(q.x) - 12, fy = Math.round(q.y) - 12;
  px(fx - 1, fy - 4, 2, 19, WA.post); px(fx - 2, fy - 6, 4, 2, '#c9a227');                     // 깃대와 금빛 꼭지
  stallFlagAt = { th: 'cloud', x: fx + 1, y: fy - 3, w: 24, h: 15 };
}
/* 바람에 날리는 천(2026-09-29 로키즈 「각 농장의 국기를 전부 휘날리게」). 깃대(왼쪽)에 단 깃발은 칸마다 위아래로,
   들보·처마(위)에 매단 천(hang)은 줄마다 옆으로 흔들린다. 매단 데서 멀수록 크게, 바람이 세면 더 크게.
   물결이 비탈진 데는 어둡게, 솟은 데는 밝게 — 주름이 흘러가는 것처럼 보인다. col(c, r) 이 그 자리 빛깔. */
function flagCloth(x, y, FW, FH, t, col, hang){
  // 작은 깃발은 물결을 낮고 완만하게 — 한 도트짜리 줄무늬(그리스)가 칸마다 크게 어긋나면 천이 아니라 잡음으로 보인다
  const k = (STILL ? 0.6 : 0.8 + curWind * 0.9) * Math.min(1, FH / 14), ph = STILL ? 0 : t, step = FW >= 20 ? 0.42 : 0.3;
  const off = c => Math.sin(ph / 230 - c * step) * k * (0.25 + c / FW * 1.4);
  for (let c = 0; c < FW; c++){
    const slope = off(c + 1) - off(c), dark = slope > 0.25 ? -14 : slope < -0.25 ? 8 : 0, dy = hang ? 0 : Math.round(off(c));
    for (let r = 0; r < FH; r++){
      const dx = hang ? Math.round((Math.sin(ph / 420) * 0.9 + Math.sin(ph / 200 - r * 0.6) * 0.3) * k * (r / FH)) : 0;   // 통째로 흔들리고 잔물결은 조금 — 십자·줄이 무너지지 않게
      px(x + c + dx, y + r + dy, 1, 1, shade(col(c, r), dark));
    }
  }
}
// 나라 깃발 빛깔 — 그리스(아홉 줄 + 왼쪽 위 십자, 9줄에 맞춰 높이 9), 스위스(붉은 바탕 흰 십자), 일본(흰 바탕 붉은 해, 위아래 테)
const FLAG_COL = {
  seaside: (c, r) => (c < 5 && r < 5) ? (c === 2 || r === 2 ? '#ffffff' : '#0d5eaf') : r % 2 ? '#ffffff' : '#0d5eaf',
  // 화산 섬(2026-10-06 스위스 국기에서 바꿈) — 검은 천에 붉은 화산, 꼭대기에 노란 불
  mountain: (c, r, W, H) => { const m = (W - 1) / 2, top = Math.round(H * 0.3), half = (r - top) * 0.9; if (r === H - 1) return '#5a1a10'; if (r >= top && Math.abs(c - m) <= half) return r === top || (r === top + 1 && Math.abs(c - m) < 1) ? '#ffd84a' : '#c8360e'; return r < top && Math.abs(c - m) < 1 && r >= top - 3 ? '#ff8a1a' : '#1e1618'; },
  cloud: (c, r, W, H) => { if (r === 0 || r === H - 1) return '#2b2f36'; const dx = c - 11.5, dy = r - 7; return dx * dx + dy * dy <= 17 ? '#e8453c' : '#f4ead8'; },
};
// 가게 깃발 — 그리스·스위스는 들보·처마에 매단 천, 일본은 지붕 위 깃대. 자리는 가게를 그릴 때 적어 둔다.
let stallFlagAt = null;
function ipStallFlagLive(b, t){
  const f = stallFlagAt;
  if (!f || f.th !== isoTheme()) return;
  flagCloth(f.x, f.y, f.w, f.h, t, (c, r) => FLAG_COL[f.th](c, r, f.w, f.h), f.hang);
}
// ---- 농장마다 다른 나라(2026-09-28 로키즈 「외국에 온 것처럼 완전히 다른 생태계」) ----
// 바닷가 = 그리스 섬, 산골 = 스위스 알프스, 꽃구름 = 일본 정원. 집·외양간·닭장·가게·온실·나무·덤불·울타리·먼 풍경이 나라를 따른다.
function isoTheme(){ return W ? R.farmOf(W).id : 'meadow'; }
// 맨 위가 평평한 상자 — z0 부터 G.H 까지 두 면을 세우고 윗면을 덮는다
function isoBlock(G, z0, col, mat, seed, top){
  faceRect(G, 'L', 0, G.u1 - G.u0, z0, G.H, wallTex(col, 'L', mat, seed));
  faceRect(G, 'R', 0, G.v1 - G.v0, z0, G.H, wallTex(shade(col, -30), 'R', mat, seed + 1));
  poly3([[G.u0, G.v0, G.H], [G.u1, G.v0, G.H], [G.u1, G.v1, G.H], [G.u0, G.v1, G.H]], top || shade(col, -6));
  wallDepth(G, z0);
}
// 창의 겹 — 벽 두께만큼 들어간 그늘(위·왼쪽), 안쪽 커튼, 창턱 밑 그늘, 유리의 빛 한 점. 유리를 칠한 바로 뒤에 부른다.
function winDepth(G, side, a, w, z, h, night, curtain){
  if (curtain){
    const c = night ? mix(curtain, '#ffd98a', 0.45) : curtain, lo = shade(c, -22), ct = z + Math.round(h * 0.3);
    faceRect(G, side, a, a + w * 0.24, ct, z + h, c); faceRect(G, side, a + w * 0.76, a + w, ct, z + h, c);
    faceRect(G, side, a + w * 0.18, a + w * 0.24, ct, z + h, lo); faceRect(G, side, a + w * 0.76, a + w * 0.82, ct, z + h, lo);
    faceRect(G, side, a, a + w * 0.3, ct, ct + 1, lo); faceRect(G, side, a + w * 0.7, a + w, ct, ct + 1, lo);   // 묶은 끈
  }
  faceRect(G, side, a, a + w, z + h - 2, z + h, 'rgba(0,0,0,0.3)');
  faceRect(G, side, a, a + 0.05, z, z + h - 2, 'rgba(0,0,0,0.22)');
  faceRect(G, side, a - 0.06, a + w + 0.06, z - 5, z - 3, 'rgba(0,0,0,0.16)');
  if (!night){ const q = faceMid(G, side, a + w * 0.7, z + h - 4); px(Math.round(q.x), Math.round(q.y), 1, 1, '#ffffff'); px(Math.round(q.x) - 1, Math.round(q.y) + 1, 1, 1, '#ffffffa0'); }
}
// 평지붕 둘레의 낮은 턱. 안쪽은 한 톤 어둡게 — 오목하게 읽힌다.
function isoParapet(G, col){
  faceRect(G, 'L', 0, G.u1 - G.u0, G.H, G.H + 3, shade(col, -4));
  faceRect(G, 'R', 0, G.v1 - G.v0, G.H, G.H + 3, shade(col, -32));
  poly3([[G.u0, G.v0, G.H + 3], [G.u1, G.v0, G.H + 3], [G.u1, G.v1, G.H + 3], [G.u0, G.v1, G.H + 3]], shade(col, -3));
  poly3([[G.u0 + 0.1, G.v0 + 0.1, G.H + 3], [G.u1 - 0.1, G.v0 + 0.1, G.H + 3], [G.u1 - 0.1, G.v1 - 0.1, G.H + 3], [G.u0 + 0.1, G.v1 - 0.1, G.H + 3]], isoSnow ? snowTex : shade(col, -12));
}
// 위가 둥근 문 — 네모 위에 반달을 도트 줄로 얹는다
function isoArchDoor(G, side, a, w, h, col, frame){
  const top = Math.max(3, Math.round(w * 12));
  const arch = (pad, c) => {
    faceRect(G, side, a - pad, a + w + pad, 0, h + (pad ? 1 : 0), c);
    for (let k = 0; k < top; k++){
      const f = k / top, cut = (w / 2 + pad) * (1 - Math.sqrt(1 - f * f));
      faceRect(G, side, a - pad + cut, a + w + pad - cut, h + k, h + k + 1, c);
    }
  };
  arch(0.06, frame); arch(0, col);
  for (let z = 5; z < h; z += 6) faceRect(G, side, a, a + w, z, z + 1, shade(col, -16));
  faceRect(G, side, a, a + 0.05, 0, h, 'rgba(0,0,0,0.22)');                    // 문틀 안쪽 그늘
  faceRect(G, side, a + w - 0.05, a + w, 0, h, 'rgba(255,255,255,0.18)');
  if (w >= 0.3){                                                                // 쇠고리 손잡이
    const q = faceMid(G, side, a + w * 0.78, Math.round(h * 0.48)), x = Math.round(q.x), y = Math.round(q.y);
    px(x - 1, y - 1, 3, 3, '#c9a03a'); px(x, y, 1, 1, col); px(x - 1, y - 1, 1, 1, '#f2d27a');
  }
}
// 나무 문 손잡이와 경첩 두 줄
function doorHardware(G, side, a, w, h){
  [0.22, 0.78].forEach(f => faceRect(G, side, a, a + w * 0.45, Math.round(h * f), Math.round(h * f) + 1, '#2a2622'));
  const q = faceMid(G, side, a + w * 0.82, Math.round(h * 0.46)), x = Math.round(q.x), y = Math.round(q.y);
  px(x - 1, y - 1, 2, 3, '#c9a03a'); px(x - 1, y - 1, 1, 1, '#f2d27a');
}
function isoBlueWindow(G, side, a, w, z, h, night){
  faceRect(G, side, a - 0.05, a + w + 0.05, z - 2, z + h + 2, LIME);
  faceRect(G, side, a, a + w, z, z + h, night ? '#ffd98a' : '#27405c');
  if (!night) faceRect(G, side, a + w * 0.15, a + w * 0.3, z + 2, z + h - 2, '#4f6f90');
  winDepth(G, side, a, w, z, h, night, '#f4f1ea');                               // 흰 레이스 커튼
  faceRect(G, side, a + w / 2 - 0.02, a + w / 2 + 0.02, z, z + h, LIME);
  faceRect(G, side, a - 0.19, a - 0.03, z - 1, z + h + 1, AEGEAN);            // 덧문 두 짝
  faceRect(G, side, a + w + 0.03, a + w + 0.19, z - 1, z + h + 1, AEGEAN);
  for (let k = z + 1; k < z + h; k += 3){ faceRect(G, side, a - 0.19, a - 0.03, k, k + 1, shade(AEGEAN, -22)); faceRect(G, side, a + w + 0.03, a + w + 0.19, k, k + 1, shade(AEGEAN, -22)); }
  if (night){ const q = faceMid(G, side, a + w / 2, z + h / 2); lamp(q.x, q.y, 24); }
}
// 부겐빌레아 — 흰 벽 모서리를 타고 오르는 분홍 꽃 덩굴
function bougainvillea(G, side, a0, a1, zTop, seed){
  const foot = faceMid(G, side, (a0 + a1) / 2, 0);
  px(Math.round(foot.x) - 1, Math.round(foot.y) - zTop * 0.6, 2, Math.round(zTop * 0.6), '#7a5a3a');
  for (let i = 0; i < 16; i++){
    const a = a0 + hash2(i, 1, seed) * (a1 - a0), z = 3 + Math.pow(hash2(i, 2, seed), 0.7) * zTop;
    const q = faceMid(G, side, a, z);
    if (i % 4 === 0) blob(q.x, q.y, 8, 6, '#4f8f48', '#6fb567', '#3a6f36', 'bgl' + seed + i);
    else blob(q.x, q.y, 9 + (i % 3) * 2, 7 + (i % 2) * 2, i % 3 ? '#e0529a' : '#f27ab8', '#ffa3cf', '#a8306e', 'bg' + seed + i);
  }
}
// 파란 둥근 지붕 — 흰 테두리 위에 도트 한 줄씩 좁혀 쌓는다
function isoDome(cu, cv, r, z0, col){
  isoDrum(cu, cv, r * 1.04, z0, z0 + 4, WHITEWASH, WHITEWASH);
  const RZ = Math.max(4, Math.round(r * IT * 0.42)), cx0 = isoP(cu, cv).x, W0 = r * IT / 2;
  for (let k = 0; k <= RZ; k++){
    const f = k / (RZ + 1), rr = r * Math.sqrt(1 - f * f), base = roundTex(cu, cv, rr, col), w = rr * IT / 2;
    // 둥근 지붕의 골 — 세로 줄 여섯, 왼쪽 위 반짝이는 자리
    isoEllipse(cu, cv, rr, rr, z0 + 4 + k, (x, y) => {
      const t = (x - cx0) / (w || 1);
      if (w > 3 && Math.abs(((t * 3 + 9) % 1) - 0.5) < 0.12 / Math.max(0.4, Math.sqrt(1 - t * t))) return shade(col, -14);
      if (k > RZ * 0.35 && k < RZ * 0.75 && x > cx0 - W0 * 0.55 && x < cx0 - W0 * 0.3) return shade(col, 40);
      return base(x, y);
    });
  }
  const q = isoP(cu, cv, z0 + 5 + RZ), x = Math.round(q.x), y = Math.round(q.y);
  px(x, y - 9, 1, 9, LIME); px(x - 3, y - 6, 7, 1, LIME);                      // 꼭대기 십자
}
function terracotta(u, v, flower, seed){
  isoCube(u, v, 0.2, 0.2, 0, 8, '#b5572f', '#d0714a', '#a4502c');
  const q = isoP(u + 0.1, v + 0.1, 8);
  blob(q.x, q.y - 5, 11, 8, '#5fa155', '#7fc06c', '#3f7d3c', 'tc' + seed);
  px(Math.round(q.x) - 3, Math.round(q.y) - 9, 3, 3, flower); px(Math.round(q.x) + 1, Math.round(q.y) - 7, 3, 3, flower);
}

// ■ 그리스 섬
function isoHouseGreek(b, night){
  const G = isoGeo(b, 0.2, 32), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, wall = WHITEWASH;
  isoShadow(G);
  isoBlock(G, 0, wall, 'plaster', 11);
  faceRect(G, 'L', 0, lenL, 0, 3, '#d9d2c4'); faceRect(G, 'R', 0, lenR, 0, 3, '#b3ac9f');    // 발치 회칠 줄
  isoParapet(G, wall);
  // 윗층 — 뒤 오른쪽에 작은 흰 방, 그 위에 파란 둥근 지붕
  const U = { u0: G.u0 + lenL * 0.5, u1: G.u1 - 0.12, v0: G.v0 + 0.12, v1: G.v0 + lenR * 0.58, H: G.H + 26 };
  isoBlock(U, G.H + 3, wall, 'plaster', 17);
  isoBlueWindow(U, 'L', (U.u1 - U.u0) / 2 - 0.18, 0.36, G.H + 10, 10, night);
  isoDome((U.u0 + U.u1) / 2, (U.v0 + U.v1) / 2, Math.min(U.u1 - U.u0, U.v1 - U.v0) * 0.4, U.H, AEGEAN);
  // 앞 지붕으로 오르는 바깥 계단 — 왼쪽 끝, 흰 난간
  for (let k = 0; k < 6; k++){
    const a = 0.06 + k * 0.1, z = 4 + k * 5;
    poly3([[G.u0 + a, G.v1, z], [G.u0 + a + 0.1, G.v1, z], [G.u0 + a + 0.1, G.v1 + 0.24, z], [G.u0 + a, G.v1 + 0.24, z]], '#efe9df');
    poly3([[G.u0 + a, G.v1 + 0.24, z], [G.u0 + a + 0.1, G.v1 + 0.24, z], [G.u0 + a + 0.1, G.v1 + 0.24, 0], [G.u0 + a, G.v1 + 0.24, 0]], shade(wall, -10));
  }
  // 굴뚝 — 앞 지붕 오른쪽, 파란 모자
  const cu = G.u1 - 0.55, cv = G.v1 - 0.5;
  isoCube(cu, cv, 0.24, 0.24, G.H + 3, G.H + 15, '#efe9df', wall, shade(wall, -30));
  isoCube(cu - 0.04, cv - 0.04, 0.32, 0.32, G.H + 15, G.H + 17, AEGEAN, AEGEAN, shade(AEGEAN, -30));
  isoChimney = isoP(cu + 0.12, cv + 0.12, G.H + 18);
  const da = lenL / 2 - 0.2;
  isoArchDoor(G, 'L', da, 0.5, 20, AEGEAN, LIME);
  { const q = faceMid(G, 'L', da + 0.4, 11); px(Math.round(q.x), Math.round(q.y), 2, 2, '#ffd166'); }
  isoBlueWindow(G, 'L', lenL - 0.85, 0.4, 13, 11, night);
  isoBlueWindow(G, 'R', lenR / 2 - 0.2, 0.4, 13, 11, night);
  poly3([[G.u0 + da - 0.08, G.v1, 2], [G.u0 + da + 0.58, G.v1, 2], [G.u0 + da + 0.58, G.v1 + 0.28, 2], [G.u0 + da - 0.08, G.v1 + 0.28, 2]], AEGEAN);   // 파란 문턱돌
  poly3([[G.u0 + da - 0.08, G.v1 + 0.28, 2], [G.u0 + da + 0.58, G.v1 + 0.28, 2], [G.u0 + da + 0.58, G.v1 + 0.28, 0], [G.u0 + da - 0.08, G.v1 + 0.28, 0]], shade(AEGEAN, -30));
  bougainvillea(G, 'L', da + 0.62, da + 1.0, G.H - 2, 71);
  plasterPatch(G, 'L', lenL - 0.62, 4, 73); plasterPatch(G, 'R', 0.3, 18, 74);
  wallLamp(G, 'L', da - 0.14, 22, night, '#2b2f36');
  { const q = faceMid(G, 'L', da + 0.62, 16), x = Math.round(q.x), y = Math.round(q.y); px(x - 2, y - 2, 5, 5, '#ffffff'); px(x - 1, y - 1, 3, 3, AEGEAN); px(x, y, 1, 1, '#ffffff'); }   // 문패 타일
  [[1, '#ff5a6a'], [3, '#ffffff']].forEach(([k, c], i) => { const a = 0.06 + k * 0.1; terracottaMini(G.u0 + a + 0.05, G.v1 + 0.14, 4 + k * 5, c, 80 + i); });   // 계단 위 작은 화분
  // 지붕 마당 — 파란 둥근 탁자와 의자 둘, 앞 끝에 파란 쇠 난간
  const zr = G.H + 3, tu = G.u0 + lenL * 0.3, tv = G.v0 + lenR * 0.42;
  ibox(tu - 0.32, tv - 0.06, 0.12, 0.12, zr, zr + 5, AEGEAN); ibox(tu - 0.34, tv - 0.06, 0.02, 0.12, zr + 5, zr + 9, AEGEAN);
  ipost(tu, tv, zr, zr + 8, '#2b2f36', 0.05); isoDrum(tu, tv, 0.17, zr + 8, zr + 10, AEGEAN, shade(AEGEAN, 20));
  ibox(tu + 0.2, tv - 0.06, 0.12, 0.12, zr, zr + 5, AEGEAN); ibox(tu + 0.32, tv - 0.06, 0.02, 0.12, zr + 5, zr + 9, AEGEAN);
  { const q = isoP(tu, tv, zr + 10); px(Math.round(q.x) - 1, Math.round(q.y) - 4, 3, 4, '#ffffff'); px(Math.round(q.x) - 1, Math.round(q.y) - 5, 3, 1, '#e8324a'); }   // 작은 꽃병
  for (let k = 0; k <= 6; k++){ const u = G.u0 + 0.72 + k * 0.12; ipost(u, G.v1 - 0.06, zr, zr + 8, AEGEAN, 0.03); }
  isoSeg(isoP(G.u0 + 0.72, G.v1 - 0.06, zr + 8), isoP(G.u0 + 1.44, G.v1 - 0.06, zr + 8), AEGEAN, 1);
  terracotta(G.u1 - 0.34, G.v1 + 0.06, '#e8324a', 1);
  terracotta(G.u1 - 0.1, G.v1 - 0.4, '#ff9ec4', 2);
  if (night){ const q = faceMid(G, 'L', da + 0.25, 25); lamp(q.x, q.y, 26); }
}
// 회칠이 떨어져 속 돌이 보이는 자리 — 가장자리가 들쭉날쭉
function plasterPatch(G, side, a, z, seed){
  const st = side === 'L' ? '#cfc3b0' : '#a89d8c';
  [[0, 0.3, 1, 6], [0.05, 0.24, 0, 8], [0.1, 0.36, 2, 5]].forEach(([a0, a1, z0, z1], i) => faceRect(G, side, a + a0, a + a1 * (0.8 + hash2(i, 1, seed) * 0.4), z + z0, z + z1, wallTex(st, side, 'stone', seed + i)));
  faceRect(G, side, a, a + 0.3, z + 8, z + 9, side === 'L' ? '#ffffff' : '#e6e0d4');
}
// 벽에 붙은 쇠 등 — 까만 받침과 유리 갓. 밤이면 불이 켜진다.
function wallLamp(G, side, a, z, night, metal){
  const q = faceMid(G, side, a, z), x = Math.round(q.x), y = Math.round(q.y);
  px(x - 1, y + 2, 4, 1, metal); px(x + 2, y - 1, 1, 4, metal);
  px(x - 2, y - 4, 5, 1, metal); px(x - 2, y - 3, 5, 6, night ? '#ffe08a' : '#cfe3ee'); px(x - 2, y - 3, 1, 6, metal); px(x + 2, y - 3, 1, 6, metal); px(x - 1, y + 3, 3, 1, metal);
  px(x - 1, y - 6, 3, 2, metal);
  if (night) lamp(x, y, 22, '#ffe08a');
}
function terracottaMini(u, v, z, flower, seed){
  isoCube(u, v, 0.1, 0.1, z, z + 4, '#b5572f', '#d0714a', '#a4502c');
  const q = isoP(u + 0.05, v + 0.05, z + 4), x = Math.round(q.x), y = Math.round(q.y);
  px(x - 2, y - 3, 5, 3, '#4f8f48'); px(x - 1, y - 4, 3, 1, '#6fb567'); px(x - 1 + (seed % 2), y - 5, 2, 2, flower);
}
function isoBarnGreek(b, night){
  const G = isoGeo(b, 0.16, 32), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, wall = '#f4efe6';
  isoShadow(G);
  isoBlock(G, 0, wall, 'plaster', 31);
  faceRect(G, 'L', 0, lenL, 0, 10, wallTex(STONE.mid, 'L', 'stone', 33)); faceRect(G, 'R', 0, lenR, 0, 10, wallTex(STONE.low, 'R', 'stone', 34));   // 돌 허리
  isoParapet(G, wall);
  const dw = 0.96, da = lenL / 2 - dw / 2;
  isoArchDoor(G, 'L', da, dw, 20, AEGEAN, LIME);
  faceRect(G, 'L', da + dw / 2 - 0.02, da + dw / 2 + 0.02, 0, 20, shade(AEGEAN, -30));
  isoBlueWindow(G, 'R', 0.42, 0.34, 17, 9, night);
  isoBlueWindow(G, 'R', lenR - 0.78, 0.34, 17, 9, night);
  // 종탑 — 앞 지붕 가운데 흰 벽에 구멍 둘, 종 둘, 꼭대기 십자
  const um = G.u0 + lenL / 2, B = { u0: um - 0.42, u1: um + 0.42, v0: G.v1 - 0.16, v1: G.v1, H: G.H + 26 };
  isoBlock(B, G.H + 3, wall, 'plaster', 35);
  [0.12, 0.5].forEach(a => {
    faceRect(B, 'L', a, a + 0.22, G.H + 10, G.H + 19, '#3a3226');
    const q = faceMid(B, 'L', a + 0.11, G.H + 16), x = Math.round(q.x), y = Math.round(q.y);
    px(x - 2, y, 5, 4, '#d9a93a'); px(x - 1, y - 1, 3, 1, '#d9a93a'); px(x - 2, y, 1, 3, '#f2cf6a');
  });
  { const q = isoP(um, G.v1 - 0.08, B.H), x = Math.round(q.x), y = Math.round(q.y); px(x, y - 8, 1, 8, AEGEAN); px(x - 2, y - 6, 5, 1, AEGEAN); }
  isoCube(G.u0 + 0.25, G.v0 + 0.25, 0.7, 0.5, G.H + 3, G.H + 10, '#f2da8a', '#e0c268', '#c9a94e');   // 지붕 위 건초
  hayWisps(G.u0 + 0.25, G.v0 + 0.25, 0.7, 0.5, G.H + 10, 37);
  plasterPatch(G, 'L', 0.22, 13, 38); plasterPatch(G, 'R', lenR - 0.7, 14, 39);
  wallLamp(G, 'L', da + dw + 0.14, 21, night, '#2b2f36');
  amphora(G.u0 + da - 0.26, G.v1 + 0.16, 40); amphora(G.u0 + da - 0.5, G.v1 + 0.22, 41);
  ibox(G.u1 + 0.05, G.v1 - 1.6, 0.18, 0.9, 0, 7, AEGEAN);                         // 옆벽에 붙은 파란 걸상
  if (night){ const q = faceMid(G, 'L', lenL / 2, 24); lamp(q.x, q.y, 28); }
}
// 건초 윗면에 삐져나온 지푸라기
function hayWisps(u, v, su, sv, z, seed){
  for (let i = 0; i < 14; i++){ const q = isoP(u + hash2(i, 1, seed) * su, v + hash2(i, 2, seed) * sv, z), x = Math.round(q.x), y = Math.round(q.y); px(x, y - 2, 1, 2, i % 3 ? '#fbe8a8' : '#c9a94e'); if (i % 4 === 0) px(x + 1, y - 3, 1, 1, '#fbe8a8'); }
}
// 흙 항아리 — 배가 불룩하고 목이 좁다
function amphora(u, v, seed){
  const c = '#c9683f';
  for (let z = 0; z < 12; z++){ const f = z / 12, r = 0.05 + 0.08 * Math.sin(Math.PI * Math.min(1, f * 1.25)); isoEllipse(u, v, r, r, z, roundTex(u, v, r, z % 5 === 3 ? shade(c, -18) : c)); }
  isoDrum(u, v, 0.05, 12, 14, shade(c, -10), shade(c, -30));
  const q = isoP(u, v, 7); px(Math.round(q.x) - 3, Math.round(q.y), 1, 1, '#f4efe6'); px(Math.round(q.x) + 1 + (seed % 2), Math.round(q.y) - 1, 1, 1, '#f4efe6');
}
function isoCoopGreek(b, night){
  const G = isoGeo(b, 0.24, 20), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, wall = WHITEWASH;
  isoShadow(G);
  isoBlock(G, 0, wall, 'plaster', 41);
  faceRect(G, 'L', 0, lenL, G.H - 3, G.H, AEGEAN); faceRect(G, 'R', 0, lenR, G.H - 3, G.H, shade(AEGEAN, -30));   // 파란 띠
  isoParapet(G, wall);
  const da = lenL / 2 - 0.18;
  isoArchDoor(G, 'L', da, 0.36, 11, AEGEAN, LIME);
  poly3([[G.u0 + da, G.v1, 3], [G.u0 + da + 0.36, G.v1, 3], [G.u0 + da + 0.36, G.v1 + 0.5, 0], [G.u0 + da, G.v1 + 0.5, 0]], wallTex(WOOD.low, 'L', 'wood', 42));
  { const q = faceMid(G, 'R', lenR / 2, 12), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 3, 7, 7, AEGEAN); px(x - 2, y - 2, 5, 5, night ? '#ffd98a' : '#27405c'); }
  [[0.3, 0.3], [0.7, 0.5]].forEach(([fu, fv], i) => {                        // 지붕 위 비둘기 둘
    const q = isoP(G.u0 + lenL * fu, G.v0 + lenR * fv, G.H + 3), x = Math.round(q.x), y = Math.round(q.y);
    px(x - 3, y - 4, 6, 4, '#c9ccd4'); px(x + 2, y - 6, 3, 3, '#aeb3be'); px(x + 4, y - 5, 2, 1, '#e0a040'); px(x - 4, y - 3, 2, 2, '#9ba1ad'); px(x - 1, y, 1, 1, '#e07a7a');
    if (i) px(x - 2, y - 4, 3, 1, '#dfe2e8');
  });
  plasterPatch(G, 'L', lenL - 0.45, 3, 44);
  grainSack(G.u1 + 0.1, G.v1 - 0.35, '#e6d6b0');
  eggBasket(G.u0 + da + 0.5, G.v1 + 0.22);
}
// 곡식 자루 — 불룩한 몸에 묶은 목
function grainSack(u, v, c){
  iegg(u, v, 0.14, 0.12, 0, 11, [shade(c, 10), c, shade(c, -26)]);
  isoDrum(u, v, 0.05, 10, 13, shade(c, -30), shade(c, -12));
  const q = isoP(u, v + 0.12, 5); px(Math.round(q.x) - 2, Math.round(q.y) - 1, 4, 3, '#c9803c');
}
// 달걀 바구니
function eggBasket(u, v){
  isoDrum(u, v, 0.1, 0, 4, '#b8895c', '#8a6038');
  [[-0.04, 0], [0.04, 0.02], [0, -0.04]].forEach(([a, b]) => { const q = isoP(u + a, v + b, 4); px(Math.round(q.x) - 1, Math.round(q.y) - 2, 3, 3, '#fff6e9'); px(Math.round(q.x) - 1, Math.round(q.y) - 2, 1, 1, '#ffffff'); });
  isoSeg(isoP(u - 0.1, v, 4), isoP(u, v, 11), '#8a6038', 1); isoSeg(isoP(u, v, 11), isoP(u + 0.1, v, 4), '#8a6038', 1);
}

// ■ 스위스 알프스
function isoChaletWindow(G, side, a, w, z, h, night, box){
  faceRect(G, side, a - 0.05, a + w + 0.05, z - 2, z + h + 2, CHALET.trim);
  faceRect(G, side, a, a + w, z, z + h, night ? '#ffd98a' : '#6f9bb3');
  if (!night) faceRect(G, side, a + w * 0.15, a + w * 0.3, z + 2, z + h - 2, '#bfe4f7');
  winDepth(G, side, a, w, z, h, night, '#d9534a');                               // 붉은 체크 커튼
  if (h >= 8) faceRect(G, side, a, a + w, z + Math.round(h / 2), z + Math.round(h / 2) + 1, CHALET.trim);
  faceRect(G, side, a + w / 2 - 0.02, a + w / 2 + 0.02, z, z + h, CHALET.trim);
  faceRect(G, side, a - 0.2, a - 0.06, z - 1, z + h + 1, CHALET.shutter); faceRect(G, side, a + w + 0.06, a + w + 0.2, z - 1, z + h + 1, CHALET.shutter);
  [[a - 0.2, a - 0.06], [a + w + 0.06, a + w + 0.2]].forEach(([s0, s1]) => {   // 덧문 — 가로 살 그늘, 가운데 하트 구멍
    for (let k = z + 1; k < z + h; k += 3) faceRect(G, side, s0, s1, k, k + 1, shade(CHALET.shutter, -20));
    faceRect(G, side, s1 - 0.03, s1, z - 1, z + h + 1, shade(CHALET.shutter, -30));
    const q = faceMid(G, side, (s0 + s1) / 2, z + Math.round(h / 2) + 1); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 1, 1, '#2e241c'); px(Math.round(q.x) + 1, Math.round(q.y) - 1, 1, 1, '#2e241c'); px(Math.round(q.x), Math.round(q.y), 1, 1, '#2e241c');
  });
  if (box !== false){                                                          // 창 밑 제라늄 상자
    faceRect(G, side, a - 0.08, a + w + 0.08, z - 6, z - 2, CHALET.dark);
    for (let k = 0; k < 5; k++){ const q = faceMid(G, side, a - 0.02 + k * (w + 0.04) / 4, z - 2), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y - 3, 3, 3, '#4f8f48'); px(x, y - 4, 2, 2, k % 2 ? '#e8324a' : '#ff5a6a'); }
  }
  if (night){ const q = faceMid(G, side, a + w / 2, z + h / 2); lamp(q.x, q.y, 24); }
}
function stoneBase(G, h, seed){
  faceRect(G, 'L', 0, G.u1 - G.u0, 0, h, wallTex(STONE.mid, 'L', 'stone', seed)); faceRect(G, 'R', 0, G.v1 - G.v0, 0, h, wallTex(STONE.low, 'R', 'stone', seed + 1));
  faceRect(G, 'L', 0, G.u1 - G.u0, h, h + 1, STONE.hi);
}
function isoHouseChalet(b, night){
  const G = isoGeo(b, 0.2, 44), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0;
  isoShadow(G);
  isoWalls(G, CHALET.wood, 'wood', 11);
  stoneBase(G, 14, 13);                                                         // 높은 돌 기단 — 비탈에 선 집
  faceRect(G, 'L', 0, 0.08, 14, G.H, CHALET.dark); faceRect(G, 'L', lenL - 0.08, lenL, 14, G.H, CHALET.dark); faceRect(G, 'R', lenR - 0.08, lenR, 14, G.H, shade(CHALET.dark, -20));
  const da = lenL / 2 - 0.26;
  isoDoor(G, 'L', da, 0.52, 24, CHALET.dark);
  faceRect(G, 'L', da - 0.08, da + 0.6, 24, 26, CHALET.trim);
  isoChaletWindow(G, 'L', 0.34, 0.44, 17, 9, night);
  isoChaletWindow(G, 'L', lenL - 0.78, 0.44, 17, 9, night);
  isoChaletWindow(G, 'R', lenR / 2 - 0.22, 0.44, 17, 9, night);
  isoChaletWindow(G, 'L', lenL / 2 - 0.62, 0.36, 34, 7, night, false);          // 발코니 뒤 윗층 창
  isoChaletWindow(G, 'L', lenL / 2 + 0.26, 0.36, 34, 7, night, false);
  // 발코니 — 앞 박공 아래로 길게. 난간 살 사이사이 제라늄.
  const zb = 31, dv = 0.32, a0 = G.u0 - 0.06, a1 = G.u1 + 0.06, vf = G.v1 + dv;
  poly3([[a0, G.v1, zb], [a1, G.v1, zb], [a1, vf, zb], [a0, vf, zb]], CHALET.dark);
  poly3([[a0, vf, zb], [a1, vf, zb], [a1, vf, zb - 3], [a0, vf, zb - 3]], shade(CHALET.dark, -20));
  poly3([[a1, G.v1, zb], [a1, vf, zb], [a1, vf, zb - 3], [a1, G.v1, zb - 3]], shade(CHALET.dark, -36));
  for (let k = 0; ; k++){
    const a = a0 + 0.02 + k * 0.11; if (a > a1) break;
    const p = isoP(a, vf, zb), x = Math.round(p.x), y = Math.round(p.y);
    px(x, y - 9, 2, 9, k % 2 ? CHALET.wood : shade(CHALET.wood, 16));
    if (k % 3 === 1){ px(x - 2, y - 13, 5, 3, '#4f8f48'); px(x - 1, y - 15, 3, 2, k % 2 ? '#e8324a' : '#ff5a6a'); }
  }
  isoSeg(isoP(a0, vf, zb + 9), isoP(a1, vf, zb + 9), CHALET.dark, 2);
  isoSeg(isoP(a1, G.v1, zb + 9), isoP(a1, vf, zb + 9), CHALET.dark, 2);
  const cu = G.u0 + 0.35, cv = G.v0 + 0.35;
  isoRoof(G, { ridge: 'v', rise: 24, roof: CHALET.roof, wall: CHALET.wood, gable: CHALET.wood, eave: 0.42, mid: um => {
    const a = um - G.u0;
    faceRect(G, 'L', a - 0.18, a + 0.18, G.H + 4, G.H + 13, CHALET.trim);        // 박공 다락창
    faceRect(G, 'L', a - 0.13, a + 0.13, G.H + 5, G.H + 12, night ? '#ffd98a' : '#6f9bb3');
    faceRect(G, 'L', a - 0.01, a + 0.01, G.H + 5, G.H + 12, CHALET.trim);
    isoCube(cu, cv, 0.4, 0.4, G.H, G.H + 38, STONE.hi, wallTex(STONE.mid, 'L', 'stone', 15), wallTex(STONE.low, 'R', 'stone', 16));
    isoCube(cu - 0.06, cv - 0.06, 0.52, 0.52, G.H + 38, G.H + 41, CHALET.roof, shade(CHALET.roof, -10), shade(CHALET.roof, -30));
    isoChimney = isoP(cu + 0.2, cv + 0.2, G.H + 42);
  } });
  // 너와 지붕을 누르는 돌 — 비탈 여기저기
  { const um = (G.u0 + G.u1) / 2, e = 0.42, top = G.H + 24, low = G.H - 2;
    [[0.35, 0.3], [0.6, 0.75], [0.3, 1.5], [0.7, 2.1], [0.45, 2.55]].forEach(([f, v], i) => {
      if (isoSnow && f < 0.7) return;
      const u = um + (G.u1 + e - um) * f;
      boulder(u, G.v0 - e + v, 0.09 + (i % 2) * 0.02, 4, i % 2 ? STONE.mid : STONE.hi, Math.round(top + (low - top) * f) - 1);
    }); }
  // 옆벽에 쌓은 장작 — 통나무 끝이 동그랗게 보인다
  const P = { u0: G.u1 + 0.02, u1: G.u1 + 0.3, v0: G.v0 + 0.12, v1: G.v0 + 0.82, H: 22 };
  faceRect(P, 'L', 0, P.u1 - P.u0, 0, P.H, wallTex('#8a5a34', 'L', 'wood', 17));
  faceRect(P, 'R', 0, P.v1 - P.v0, 0, P.H, '#6e4326');
  for (let z = 2; z < P.H; z += 4) for (let a = 0.03; a < P.v1 - P.v0 - 0.03; a += 0.1){
    const q = faceMid(P, 'R', a + ((z >> 2) % 2) * 0.05, z), x = Math.round(q.x), y = Math.round(q.y);
    px(x - 1, y - 1, 3, 3, '#d9b07a'); px(x, y, 1, 1, '#b8854e'); px(x - 1, y - 1, 1, 1, '#f0cf9a');
  }
  islope(P.u0 - 0.04, P.u1 + 0.06, P.v0 - 0.04, P.v1 + 0.04, P.H + 5, P.H + 1, CHALET.roof);
  // 문 위에 매단 소 방울, 문 옆 걸상, 발코니 밑 깎은 받침
  { const q = faceMid(G, 'L', da + 0.26, 29), x = Math.round(q.x), y = Math.round(q.y); px(x, y - 3, 1, 3, '#5a544d'); px(x - 2, y, 5, 5, '#d9a93a'); px(x - 1, y, 2, 1, '#f2cf6a'); px(x - 3, y + 5, 7, 1, '#b8862a'); px(x, y + 6, 1, 1, '#5a544d'); }
  ibox(G.u0 + 0.12, G.v1 + 0.04, 0.5, 0.2, 5, 8, CHALET.wood); ipost(G.u0 + 0.16, G.v1 + 0.2, 0, 5, CHALET.dark, 0.05); ipost(G.u0 + 0.58, G.v1 + 0.2, 0, 5, CHALET.dark, 0.05);
  [0.3, lenL / 2, lenL - 0.3].forEach(a => { for (let k = 0; k < 5; k++) faceRect(G, 'L', a - 0.02 - k * 0.012, a + 0.02 + k * 0.012, 30 - k, 31 - k, k % 2 ? CHALET.dark : shade(CHALET.dark, 18)); });
  if (night){ const q = faceMid(G, 'L', da + 0.26, 28); lamp(q.x, q.y, 26); }
}
function isoBarnSwiss(b, night){
  const G = isoGeo(b, 0.16, 40), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, wood = '#8f5f3b';
  isoShadow(G);
  isoWalls(G, wood, 'wood', 31);
  stoneBase(G, 16, 33);
  const da = lenL / 2 - 0.28;                                                   // 아랫칸 외양간 문 — 위 반쪽이 열려 있다
  faceRect(G, 'L', da - 0.06, da + 0.62, 0, 17, CHALET.dark);
  faceRect(G, 'L', da, da + 0.56, 8, 16, '#2e241c');
  faceRect(G, 'L', da, da + 0.56, 0, 8, wallTex(CHALET.wood, 'L', 'wood', 36));
  { const q = faceMid(G, 'L', da + 0.7, 13), x = Math.round(q.x), y = Math.round(q.y); px(x, y - 4, 1, 3, '#5a544d'); px(x - 2, y - 1, 5, 5, '#d9a93a'); px(x - 1, y - 1, 2, 1, '#f2cf6a'); }   // 소 방울
  faceRect(G, 'L', lenL / 2 - 0.46, lenL / 2 + 0.46, 21, 36, '#3a2a1f');        // 건초 넣는 큰 문
  faceRect(G, 'L', lenL / 2 - 0.46, lenL / 2 + 0.46, 21, 27, '#e0c268');
  faceRect(G, 'L', lenL / 2 - 0.5, lenL / 2 + 0.5, 36, 38, CHALET.dark);
  [0.3, lenR - 0.6].forEach(a => { faceRect(G, 'R', a, a + 0.3, 6, 11, '#2e241c'); faceRect(G, 'R', a - 0.03, a + 0.33, 11, 12, STONE.hi); });
  isoRoof(G, { ridge: 'v', rise: 26, roof: '#5a4c45', wall: wood, gable: wood, eave: 0.38, mid: um => {
    const a = um - G.u0;                                                        // 박공의 십자 바람구멍
    [[-0.34, 0], [0.34, 0]].forEach(([o]) => {
      faceRect(G, 'L', a + o - 0.03, a + o + 0.03, G.H + 4, G.H + 12, '#2e241c');
      faceRect(G, 'L', a + o - 0.1, a + o + 0.1, G.H + 7, G.H + 9, '#2e241c');
    });
  } });
  // 건초 문에서 삐져나온 지푸라기, 문 옆 우유통 둘, 벽에 기댄 쇠스랑, 옆벽의 수레바퀴
  for (let i = 0; i < 12; i++){ const q = faceMid(G, 'L', lenL / 2 - 0.42 + hash2(i, 1, 45) * 0.84, 21), x = Math.round(q.x), y = Math.round(q.y); px(x, y, 1, 2 + (i % 3), i % 2 ? '#f2da8a' : '#c9a94e'); }
  [[da + 0.72, 0.12], [da + 0.92, 0.2]].forEach(([a, dv]) => { const u = G.u0 + a; isoDrum(u, G.v1 + dv, 0.08, 0, 11, '#c9ccd4', '#e6e8ec'); isoDrum(u, G.v1 + dv, 0.05, 11, 13, '#aeb3be', '#dfe2e8'); });
  { const f = faceMid(G, 'L', da - 0.22, 0), t = faceMid(G, 'L', da - 0.12, 30); isoSeg(f, t, '#8a6038', 1); px(Math.round(t.x) - 2, Math.round(t.y) - 4, 5, 1, '#5a544d'); for (let k = -2; k <= 2; k += 2) px(Math.round(t.x) + k, Math.round(t.y) - 8, 1, 4, '#5a544d'); }
  { const c = faceMid({ u0: G.u0, u1: G.u1 + 0.04, v0: G.v0, v1: G.v1 }, 'R', 0.6, 9), x = Math.round(c.x), y = Math.round(c.y);
    for (let i = 0; i < 20; i++){ const an = i / 20 * Math.PI * 2; px(Math.round(x + Math.cos(an) * 4), Math.round(y + Math.sin(an) * 8 + Math.cos(an) * 2), 1, 1, '#4a3322'); }
    for (let i = 0; i < 3; i++){ const an = i / 3 * Math.PI; isoSeg({ x: x + Math.cos(an) * 4, y: y + Math.sin(an) * 7 }, { x: x - Math.cos(an) * 4, y: y - Math.sin(an) * 7 }, '#6e4326', 1); }
    px(x - 1, y - 1, 2, 2, '#5a544d'); }
  if (night){ const q = faceMid(G, 'L', da + 0.28, 12); lamp(q.x, q.y, 26); }
}
function isoCoopSwiss(b, night){
  const G = isoGeo(b, 0.24, 20), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, wood = '#b07a4a';
  isoShadow(G);
  isoWalls(G, wood, 'wood', 41);
  stoneBase(G, 5, 43);
  const da = lenL / 2 - 0.18;
  faceRect(G, 'L', da - 0.05, da + 0.41, 0, 15, CHALET.dark); faceRect(G, 'L', da, da + 0.36, 0, 13, '#3a2a1f');
  poly3([[G.u0 + da, G.v1, 3], [G.u0 + da + 0.36, G.v1, 3], [G.u0 + da + 0.36, G.v1 + 0.5, 0], [G.u0 + da, G.v1 + 0.5, 0]], wallTex(WOOD.low, 'L', 'wood', 42));
  isoChaletWindow(G, 'R', lenR / 2 - 0.16, 0.32, 11, 6, night, false);
  isoRoof(G, { ridge: 'v', rise: 16, roof: CHALET.roof, wall: wood, gable: wood, eave: 0.24, mid: um => {
    const q = faceMid(G, 'L', um - G.u0, G.H + 7), x = Math.round(q.x), y = Math.round(q.y);   // 박공의 하트 구멍
    px(x - 3, y - 2, 3, 2, '#3a2a1f'); px(x + 1, y - 2, 3, 2, '#3a2a1f'); px(x - 3, y, 7, 2, '#3a2a1f'); px(x - 2, y + 2, 5, 1, '#3a2a1f'); px(x - 1, y + 3, 3, 1, '#3a2a1f');
  } });
  grainSack(G.u1 + 0.1, G.v1 - 0.3, '#e6d6b0');
  eggBasket(G.u0 + da + 0.55, G.v1 + 0.2);
}

// ■ 일본 정원
// 나마코 벽 — 검은 판에 흰 줄눈이 마름모로 엇갈린다
function namakoTex(side){
  const base = side === 'L' ? '#3d434d' : '#30353d', joint = side === 'L' ? '#f2efe8' : '#d6d2ca';
  return (x, y) => {
    const s = side === 'L' ? y - x / 2 : y + x / 2;
    const d1 = ((Math.round(x + s * 2) % 12) + 12) % 12, d2 = ((Math.round(x - s * 2) % 12) + 12) % 12;
    return d1 < 2 || d2 < 2 ? joint : base;
  };
}
/* 꽃구름(일본) 집 — 2026-10-07 로키즈가 보내 준 일본 동네 밥집 사진을 본떠 다시 지었다(전에는 초가 민가).
   이층집: 흰 타일 벽, 짙은 기와 박공지붕(박공은 오른쪽), 일층을 두르는 기와 차양과 그 밑 나무 띠,
   검은 틀 창, 유리 미닫이 가게문 위 쪽빛 노렌, 붉은 노보리 깃발, 옆벽 실외기, 모퉁이 전봇대와 전깃줄.
   집 앞에는 노란 번호판 흰 경차가 서 있고 고깔·물통이 놓였다. */
// 흰 타일 벽 — 작은 네모 타일 줄눈(면 방향 결을 따라)
function tileWallTex(col, side){
  const gr = shade(col, -22), hi = shade(col, 6);
  return (x, y) => {
    const s = side === 'L' ? y - x / 2 : y + x / 2, a = ((Math.floor(s) % 3) + 3) % 3, b2 = ((x % 3) + 3) % 3;
    if (a === 0 || b2 === 0) return gr;
    return hash2(x >> 1, Math.floor(s / 3), 77) > 0.9 ? hi : col;
  };
}
// 경차 — 네모난 몸, 짧은 코는 +u 쪽(오른쪽 앞에서 보인다), 노란 번호판
function keiCar(ua, va, night){
  const L = 1.1, Wd = 0.5, ub = ua + L, vb = va + Wd, body = '#f4f5f6', sideC = '#dfe2e6', endC = '#c9ced4', glass = '#3a4656';
  isoEllipse(ua + L / 2 + 0.08, va + Wd / 2 + 0.08, 0.64, 0.34, 0, 'rgba(30,44,24,0.22)');
  const wheel = u => { const q = isoP(u, vb, 3); pxDisc(Math.round(q.x), Math.round(q.y), 3, '#22262c'); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2, '#9aa0a8'); };
  isoCube(ua, va, L, Wd, 2, 10, '#ffffff', body, endC);                                    // 몸
  isoCube(ua + 0.06, va + 0.04, L - 0.34, Wd - 0.08, 10, 19, '#ffffff', sideC, endC);     // 실내 — 키 큰 경차
  const S1 = { u0: ua + 0.06, u1: ub - 0.28, v0: va + 0.04, v1: vb - 0.04 }, lenS = S1.u1 - S1.u0;
  faceRect(S1, 'L', 0.06, lenS * 0.48, 11, 18, glass); faceRect(S1, 'L', lenS * 0.52, lenS - 0.04, 11, 18, glass);   // 옆창 둘
  faceRect(S1, 'L', 0.1, 0.2, 16, 18, '#6a7888');
  faceRect(S1, 'R', 0.04, Wd - 0.12, 11, 18, glass); faceRect(S1, 'R', 0.08, 0.16, 16, 18, '#7a8898');   // 앞유리
  const B = { u0: ua, u1: ub, v0: va, v1: vb };
  faceRect(B, 'L', lenS * 0.5 + 0.04, lenS * 0.5 + 0.06, 3, 10, '#b8bec6');                // 문 틈
  faceRect(B, 'L', 0.62, 0.7, 8, 9, '#8a929c');                                             // 손잡이
  faceRect(B, 'R', 0.02, Wd - 0.02, 2, 4, '#9aa0a8');                                       // 범퍼
  faceRect(B, 'R', 0.04, 0.12, 7, 9, night ? '#fffbe0' : '#e8eef4'); faceRect(B, 'R', Wd - 0.12, Wd - 0.04, 7, 9, night ? '#fffbe0' : '#e8eef4');   // 앞등
  faceRect(B, 'R', Wd / 2 - 0.08, Wd / 2 + 0.08, 4, 6, '#f2d84a'); faceRect(B, 'R', Wd / 2 - 0.05, Wd / 2 + 0.05, 5, 5.6, '#4a5a2a');   // 노란 번호판
  { const q = isoP(ub - 0.28, vb + 0.03, 15); px(Math.round(q.x) - 1, Math.round(q.y), 3, 2, '#2b2f36'); }   // 사이드 거울
  wheel(ua + 0.22); wheel(ub - 0.22);
}
function isoHouseJp(b, night){
  const G = isoGeo(b, 0.34, 54), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, F1 = 24, wall = '#f2f1ec', wood = '#6a4a30', frame = '#2b2f36';
  const tl = tileWallTex(wall, 'L'), tr = tileWallTex(shade(wall, -22), 'R');
  isoShadow(G);
  isoCube(G.u0 - 0.04, G.v0 - 0.04, lenL + 0.08, lenR + 0.08, 0, 3, '#c9c6bc', '#b0ada3', '#8f8c83');   // 콘크리트 기초
  faceRect(G, 'L', 0, lenL, 3, G.H, tl); faceRect(G, 'R', 0, lenR, 3, G.H, tr);
  // 1층 — 왼쪽 작은 창(작은 차양), 가운데·오른쪽 가게문
  const win = (side, a0, a1, z0, z1, grid) => {
    faceRect(G, side, a0 - 0.05, a1 + 0.05, z0 - 2, z1 + 2, frame);
    faceRect(G, side, a0, a1, z0, z1, night ? '#ffe3a8' : side === 'L' ? '#6a7a8c' : '#55657a');
    if (!night) faceRect(G, side, a0 + 0.04, a0 + (a1 - a0) * 0.3, z0 + 1, z1 - 1, '#8e9eb0');
    faceRect(G, side, (a0 + a1) / 2 - 0.02, (a0 + a1) / 2 + 0.02, z0, z1, frame);
    if (grid) for (let z = z0 + 3; z < z1; z += 3) faceRect(G, side, a0, a1, z, z + 0.6, night ? '#e8c890' : '#7f8fa0');   // 간유리 결
  };
  win('L', 0.25, 0.85, 9, 17, true);
  islope(G.u0 + 0.18, G.u0 + 0.92, G.v1, G.v1 + 0.22, 21, 19, WA.tile);                    // 창 위 작은 차양
  const d0 = lenL * 0.42, d1 = lenL - 0.2;
  faceRect(G, 'L', d0 - 0.06, d1 + 0.06, 3, F1 - 3, '#5a3e2a');                             // 가게문 나무 틀
  faceRect(G, 'L', d0, d1, 3, F1 - 5, night ? '#ffd98a' : '#2e3440');                       // 유리 미닫이
  if (!night) for (let a = d0 + 0.1; a < d1; a += 0.5) faceRect(G, 'L', a, a + 0.12, 6, F1 - 6, '#46505e');   // 유리에 비친 빛
  for (let k = 1; k < 4; k++){ const a = d0 + (d1 - d0) * k / 4; faceRect(G, 'L', a - 0.02, a + 0.02, 3, F1 - 5, '#5a3e2a'); }
  faceRect(G, 'L', d0, d1, 9, 10, '#5a3e2a');
  { const n0 = d0 + 0.1, n1 = d1 - 0.1;                                                     // 노렌 — 쪽빛 천 넉 폭에 흰 붓글씨
    for (let k = 0; k < 4; k++){
      const a0 = n0 + k * (n1 - n0) / 4 + 0.02, a1 = a0 + (n1 - n0) / 4 - 0.04;
      faceRect(G, 'L', a0, a1, F1 - 12, F1 - 4, WA.indigo); faceRect(G, 'L', a0, a1, F1 - 12, F1 - 11, '#1f2a4a');
      const m = (a0 + a1) / 2; faceRect(G, 'L', m - 0.04, m + 0.04, F1 - 9, F1 - 8, '#f3eee2'); faceRect(G, 'L', m - 0.015, m + 0.015, F1 - 11, F1 - 6, '#f3eee2');
    }
    faceRect(G, 'L', n0 - 0.04, n1 + 0.04, F1 - 4, F1 - 3, '#8a6a3a'); }
  faceRect(G, 'L', 0, lenL, F1, F1 + 4, wallTex(wood, 'L', 'wood', 92)); faceRect(G, 'R', 0, lenR, F1, F1 + 4, wallTex(shade(wood, -14), 'R', 'wood', 93));   // 나무 띠
  // 옆벽 1층 — 작은 창, 실외기
  win('R', lenR * 0.55, lenR * 0.85, 11, 18, true);
  { const u = G.u1 + 0.02, v = G.v0 + 0.25; isoCube(u, v, 0.22, 0.46, 0, 11, '#f4f4f0', '#e2e2dc', '#cfcfc8');
    const q = isoP(u + 0.22, v + 0.23, 6); pxDisc(Math.round(q.x), Math.round(q.y), 3, '#5a5f68'); px(Math.round(q.x) - 3, Math.round(q.y), 7, 1, '#8a8f98');
    isoSeg(isoP(u + 0.1, v + 0.1, 11), isoP(G.u1, v + 0.1, 30), '#d8d6ce', 1); }
  // 1층 차양 — 기와를 두른 처마. 오른쪽 면 먼저, 앞면이 모서리를 덮는다
  const e = 0.34, zh = F1 + 8, zl = F1 + 3;
  poly3([[G.u1, G.v0, zh], [G.u1, G.v1, zh], [G.u1 + e, G.v1 + e, zl], [G.u1 + e, G.v0 - 0.02, zl]], roofTex(shade(WA.tile, -8), 'R'));
  poly3([[G.u0 - e, G.v1 + e, zl], [G.u1 + e, G.v1 + e, zl], [G.u1, G.v1, zh], [G.u0, G.v1, zh]], roofTex(WA.tile, 'L'));
  poly3([[G.u0 - e, G.v1 + e, zl], [G.u1 + e, G.v1 + e, zl], [G.u1 + e, G.v1 + e, zl - 2], [G.u0 - e, G.v1 + e, zl - 2]], shade(WA.tile, -40));
  poly3([[G.u1 + e, G.v1 + e, zl], [G.u1 + e, G.v0 - 0.02, zl], [G.u1 + e, G.v0 - 0.02, zl - 2], [G.u1 + e, G.v1 + e, zl - 2]], shade(WA.tile, -50));
  poly3([[G.u0 - e, G.v1, zh], [G.u0, G.v1, zh], [G.u0 - e, G.v1 + e, zl]], shade(WA.tile, -30));
  tileCaps(isoP(G.u0 - e, G.v1 + e, zl - 1), isoP(G.u1 + e, G.v1 + e, zl - 1), 0.16 * IT / 2);
  tileCaps(isoP(G.u1 + e, G.v1 + e, zl - 1), isoP(G.u1 + e, G.v0, zl - 1), 0.16 * IT / 2);
  if (isoTheme() === 'cloud' && !isoSnow){ roofPetals([[G.u0 - e, G.v1 + e, zl], [G.u1 + e, G.v1 + e, zl], [G.u1, G.v1, zh], [G.u0, G.v1, zh]], 1.4); }
  // 2층 — 검은 틀 큰 창 둘(앞), 하나(옆)
  win('L', 0.3, 1.25, 36, 48, false); win('L', 1.85, 2.85, 37, 47, false);
  win('R', lenR * 0.3, lenR * 0.7, 37, 47, false);
  // 박공지붕
  const re = 0.3, r = isoRoof(G, { ridge: 'u', rise: 20, roof: WA.tile, wall, gable: null, eave: re });
  const vm = (G.v0 + G.v1) / 2, top = G.H + 20;
  tileCaps(isoP(G.u0 - re, G.v1 + re, G.H - 2), isoP(G.u1 + re, G.v1 + re, G.H - 2), 0.16 * IT / 2);
  isoSeg(isoP(G.u0 - re, vm, top + 1), isoP(G.u1 + re, vm, top + 1), '#2f343e', 3);
  [isoP(G.u0 - re, vm, top), r.top].forEach(q => { const x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 5, 6, 5, '#2f343e'); px(x - 4, y - 7, 3, 3, '#2f343e'); px(x + 2, y - 7, 3, 3, '#2f343e'); });   // 귀면 기와
  { const q = isoP(G.u1, vm, G.H + 9), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 3, 7, 6, '#d8d6ce'); for (let k = 0; k < 3; k++) px(x - 2, y - 2 + k * 2, 5, 1, '#8a8f98'); }   // 박공 환기구
  isoChimney = isoP(G.u1, vm, G.H + 12);
  // 노보리 깃발 — 가게문 오른쪽, 붉은 천에 흰 글씨
  { const q = isoP(G.u1 + 0.5, G.v1 + 0.45, 0), x = Math.round(q.x), y = Math.round(q.y);
    px(x, y - 40, 1, 40, '#c9ced4'); px(x - 8, y - 38, 8, 1, '#c9ced4');
    px(x - 8, y - 37, 7, 28, '#d8322a'); px(x - 8, y - 37, 1, 28, '#f3eee2');
    for (let k = 0; k < 4; k++) px(x - 6, y - 34 + k * 6, 4, 2, '#ffffff'); }
  // 전봇대 — 모퉁이에 서서 집 2층으로 전깃줄을 내린다. 밤엔 가로등
  { const pu = G.u1 + 0.5, pv = G.v0 - 0.1, base = isoP(pu, pv, 0), x = Math.round(base.x), y = Math.round(base.y);
    px(x - 1, y - 92, 3, 92, '#a9a69e'); px(x - 1, y - 92, 1, 92, '#c4c1b9');
    px(x - 9, y - 84, 19, 2, '#7a7870'); px(x - 7, y - 74, 15, 2, '#7a7870');
    px(x + 2, y - 70, 5, 9, '#8a8f98'); px(x + 2, y - 70, 5, 1, '#b0b5bc');                 // 변압기
    for (let k = -1; k <= 1; k += 2){ const w2 = isoP(G.u1 - 0.1, G.v0 + 0.3 + k * 0.15, 50); for (let i = 0; i <= 12; i++){ const f = i / 12; px(Math.round(x + k * 8 + (w2.x - x - k * 8) * f), Math.round(y - 84 + (w2.y - y + 84) * f + Math.sin(Math.PI * f) * 5), 1, 1, '#3a3a3e'); } }
    px(x + 2, y - 54, 7, 2, '#5a5f68'); px(x + 6, y - 53, 3, 2, night ? '#fffbe0' : '#d8dde4');   // 가로등
    if (night) lamp(x + 7, y - 50, 34, '#fff3c8'); }
  // 집 앞 — 경차, 빨간 고깔, 흰 물통
  keiCar(G.u0 - 0.12, G.v1 + 0.42, night);
  { const q = isoP(G.u0 + 1.15, G.v1 + 0.5, 0), x = Math.round(q.x), y = Math.round(q.y); for (let r2 = 0; r2 < 7; r2++) px(x - Math.round(r2 / 2), y - 7 + r2, 1 + Math.round(r2 / 2) * 2, 1, r2 === 3 ? '#ffffff' : '#e8452c'); px(x - 3, y, 7, 1, '#3a3a3e'); }
  isoDrum(G.u0 + 1.3, G.v1 + 0.3, 0.09, 0, 7, '#f4f4f0', '#ffffff');
  if (night){ const q = faceMid(G, 'L', (d0 + d1) / 2, 14); lamp(q.x, q.y, 40, '#ffe3a8'); const q2 = faceMid(G, 'L', 1.2, 42); lamp(q2.x, q2.y, 24, '#ffe3a8'); }
}
function isoKura(b, night){
  const G = isoGeo(b, 0.2, 40), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0;
  isoShadow(G);
  isoWalls(G, WA.plaster, 'plaster', 31);
  faceRect(G, 'L', 0, lenL, 0, 14, namakoTex('L')); faceRect(G, 'R', 0, lenR, 0, 14, namakoTex('R'));
  faceRect(G, 'L', 0, lenL, 14, 16, WA.ink); faceRect(G, 'R', 0, lenR, 14, 16, '#23262c');
  const da = lenL / 2 - 0.35;                                                   // 두꺼운 흙문
  faceRect(G, 'L', da - 0.08, da + 0.78, 0, 27, WA.ink);
  faceRect(G, 'L', da, da + 0.7, 0, 25, WA.plaster);
  faceRect(G, 'L', da + 0.34, da + 0.36, 0, 25, '#b9b2a4');
  [0.12, 0.58].forEach(a => { const q = faceMid(G, 'L', da + a, 12); px(Math.round(q.x), Math.round(q.y), 3, 3, WA.ink); });
  faceRect(G, 'R', lenR / 2 - 0.22, lenR / 2 + 0.22, 24, 33, WA.ink);           // 높은 창 — 검은 덧문
  faceRect(G, 'R', lenR / 2 - 0.15, lenR / 2 + 0.15, 26, 31, night ? '#ffd98a' : '#6b6e75');
  isoRoof(G, { ridge: 'v', rise: 22, roof: '#3f4552', wall: WA.plaster, gable: null, eave: 0.24, mid: um => {
    const q = faceMid(G, 'L', um - G.u0, G.H + 9), x = Math.round(q.x), y = Math.round(q.y);   // 박공의 집안 문양
    for (let i = 0; i < 28; i++){ const an = i / 28 * Math.PI * 2; px(Math.round(x + Math.cos(an) * 5), Math.round(y + Math.sin(an) * 5), 2, 2, WA.ink); }
    px(x - 1, y - 3, 2, 6, WA.ink); px(x - 3, y - 1, 6, 2, WA.ink);
  } });
  { const um = (G.u0 + G.u1) / 2; tileCaps(isoP(G.u1 + 0.24, G.v0 - 0.24, G.H - 2), isoP(G.u1 + 0.24, G.v1 + 0.24, G.H - 2), 0.16 * IT / 2); isoSeg(isoP(um, G.v0 - 0.24, G.H + 23), isoP(um, G.v1 + 0.24, G.H + 23), WA.ink, 2); }
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++){ const q = faceMid(G, 'L', da + 0.1 + k * 0.17, 5 + j * 8); px(Math.round(q.x), Math.round(q.y), 2, 2, '#5a5a5a'); px(Math.round(q.x), Math.round(q.y), 1, 1, '#9a9a9a'); }   // 흙문의 쇠못
  for (let a = lenR / 2 - 0.13; a < lenR / 2 + 0.15; a += 0.07) faceRect(G, 'R', a, a + 0.018, 26, 31, '#2a2a2a');   // 창의 쇠살
  if (night){ const q = faceMid(G, 'L', lenL / 2, 28); lamp(q.x, q.y, 26); }
}
// 처마 끝 막새 기와 — 끝선을 따라 동그란 기와 머리가 줄지어 선다
function tileCaps(a, b, gap){
  const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / gap));
  for (let i = 0; i <= n; i++){
    const x = Math.round(a.x + (b.x - a.x) * i / n), y = Math.round(a.y + (b.y - a.y) * i / n);
    px(x - 2, y - 1, 4, 4, '#2a2e36'); px(x - 1, y - 2, 2, 1, '#2a2e36'); px(x - 1, y, 2, 2, '#5d6576'); px(x - 1, y, 1, 1, '#8a93a4');
  }
}
function isoCoopWa(b, night){
  const G = isoGeo(b, 0.24, 18), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, wood = '#a9794f';
  isoShadow(G);
  isoWalls(G, wood, 'wood', 41);
  const da = lenL / 2 - 0.18;
  faceRect(G, 'L', da - 0.05, da + 0.41, 0, 14, WA.post); faceRect(G, 'L', da, da + 0.36, 0, 12, '#3a2a1f');
  poly3([[G.u0 + da, G.v1, 3], [G.u0 + da + 0.36, G.v1, 3], [G.u0 + da + 0.36, G.v1 + 0.5, 0], [G.u0 + da, G.v1 + 0.5, 0]], wallTex(WOOD.low, 'L', 'wood', 42));
  faceRect(G, 'R', lenR / 2 - 0.16, lenR / 2 + 0.16, 8, 14, night ? '#ffd98a' : '#3a2a1f');
  for (let a = lenR / 2 - 0.12; a < lenR / 2 + 0.16; a += 0.08) faceRect(G, 'R', a, a + 0.02, 8, 14, WA.post);
  isoRoof(G, { ridge: 'v', rise: 22, roof: '#c9a86a', wall: wood, gable: wood, eave: 0.3, straw: true });   // 짚 지붕
  const um = (G.u0 + G.u1) / 2;
  isoSeg(isoP(um, G.v0 - 0.3, G.H + 22), isoP(um, G.v1 + 0.3, G.H + 22), '#7a6038', 3);   // 짚 용마루 누름
  for (let k = 0; k <= 4; k++){ const q = isoP(um, G.v0 - 0.3 + k * (lenR + 0.6) / 4, G.H + 24); px(Math.round(q.x) - 2, Math.round(q.y) - 1, 5, 3, '#5a4a2a'); }   // 누름대 매듭
  grainSack(G.u1 + 0.1, G.v1 - 0.3, '#d9c08a');
  eggBasket(G.u0 + da + 0.55, G.v1 + 0.2);
}
// 짚 — 비탈을 따라 흐르는 결, 켜마다 끝이 조금 삐죽
function strawTex(col, side){
  const hi = shade(col, 16), lo = shade(col, -18), cut = shade(col, -30);
  return (x, y) => {
    const s = side === 'L' ? y - x / 2 : y + x / 2, band = ((Math.floor(s) % 6) + 6) % 6, h = hash2(x, Math.floor(s / 6), 91);
    if (band === 5 && h > 0.3) return cut;
    return h > 0.78 ? hi : h < 0.22 ? lo : col;
  };
}
// 온실 틀과 안의 꽃: 그리스는 흰 틀에 레몬나무, 스위스는 나무 틀에 에델바이스, 일본은 짙은 나무 틀에 분재 진달래
const GH_LOOK = {
  seaside:  { ribL: '#ffffff', ribR: '#d9d4c8', door: '#ffffff', fl: ['#ffe066', '#fff2a0'], pot: ['#b5572f', '#d0714a', '#a4502c'] },
  mountain: { ribL: '#a8784c', ribR: '#7a5334', door: '#a8784c', fl: ['#ffffff', '#f2f2e6'] },
  cloud:    { ribL: '#5a4a36', ribR: '#46392a', door: '#5a4a36', fl: ['#ff8fb8', '#ffc2d8'], pot: ['#4a4f5a', '#6a707c', '#3a3f4a'] },
};
function isoGreenhouse(b, night){
  const G = isoGeo(b, 0.2, 32), lenL = G.u1 - G.u0, lenR = G.v1 - G.v0, K = GH_LOOK[isoTheme()] || { ribL: '#eaf6ff', ribR: '#9cc8dc', door: '#f4fbff', fl: ['#ff9ec4', '#ffd166'] }, pot = K.pot || ['#6f5238', '#c97a5a', '#a8603f'];
  isoShadow(G);
  poly3([[G.u0, G.v0, 0], [G.u1, G.v0, 0], [G.u1, G.v1, 0], [G.u0, G.v1, 0]], '#8a6a4a');          // 흙바닥
  poly3([[G.u0, G.v0, 0], [G.u1, G.v0, 0], [G.u1, G.v0, G.H], [G.u0, G.v0, G.H]], '#bfe0ef');       // 안쪽 뒤 유리벽
  poly3([[G.u0, G.v1, 0], [G.u0, G.v0, 0], [G.u0, G.v0, G.H], [G.u0, G.v1, G.H]], '#cfe8f3');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++){                                      // 화분 두 줄
    const u = G.u0 + 0.25 + k * (lenL - 0.7) / 3, v = G.v0 + 0.3 + r * (lenR - 0.85);
    isoCube(u, v, 0.34, 0.34, 0, 6, pot[0], pot[1], pot[2]);
    const q = isoP(u + 0.17, v + 0.17, 6);
    blob(q.x, q.y - 8, 14, 12, ['#5da05a', '#4f9a58', '#6aab5e', '#57a06b'][k], '#8ad07a', '#3c7a44', 'ig' + r + k);
    px(Math.round(q.x) - 2, Math.round(q.y) - 11, 3, 3, K.fl[(r + k) % 2]); px(Math.round(q.x) + 3, Math.round(q.y) - 7, 2, 2, K.fl[(r + k + 1) % 2]);
  }
  faceRect(G, 'L', 0, lenL, 0, G.H, '#d8f0fa60');                                                // 앞쪽 유리 — 비친다
  faceRect(G, 'R', 0, lenR, 0, G.H, '#a8d0e270');
  for (let i = 0; i <= 4; i++){ const a = lenL * i / 4; faceRect(G, 'L', Math.max(0, a - 0.03), Math.min(lenL, a + 0.03), 0, G.H, K.ribL); }
  for (let i = 0; i <= 3; i++){ const a = lenR * i / 3; faceRect(G, 'R', Math.max(0, a - 0.03), Math.min(lenR, a + 0.03), 0, G.H, K.ribR); }
  faceRect(G, 'L', 0, lenL, 15, 16, K.ribL); faceRect(G, 'R', 0, lenR, 15, 16, K.ribR);
  faceRect(G, 'L', 0, lenL, 0, 4, '#8fc7e0'); faceRect(G, 'R', 0, lenR, 0, 4, '#7fb3cc');
  const da = lenL / 2 - 0.3;                                                                   // 문틀
  faceRect(G, 'L', da - 0.04, da, 0, 26, K.door); faceRect(G, 'L', da + 0.6, da + 0.64, 0, 26, K.door); faceRect(G, 'L', da - 0.04, da + 0.64, 26, 28, K.door);
  poly3([[G.u0 + 0.3, G.v1, 6], [G.u0 + 0.42, G.v1, 6], [G.u0 + 0.9, G.v1, G.H - 3], [G.u0 + 0.78, G.v1, G.H - 3]], '#ffffff70');   // 유리 반사
  isoRoof(G, { ridge: 'u', rise: 22, roof: '#dff0f8', wall: '#c3e6f6', glass: true, gable: null });
  if (night){ const q = isoP((G.u0 + G.u1) / 2, (G.v0 + G.v1) / 2, 16); lamp(q.x, q.y, 30, '#cfeccf'); }
}
// 바닥에 누운 동그라미(칸 단위 반지름) — 아이소에서는 가로로 긴 타원이 된다
function isoEllipse(cu, cv, ru, rv, z, col){
  const pts = [];
  for (let i = 0; i < 32; i++){ const a = i / 32 * Math.PI * 2, q = isoP(cu + Math.cos(a) * ru, cv + Math.sin(a) * rv, z); pts.push([q.x, q.y]); }
  polyFill(pts, col);
}
// 돌을 둥글게 쌓은 기둥 — 줄눈이 가로로 돌고, 돌마다 빛깔이 조금 다르다
function stoneDrum(cu, cv, r, z0, z1, side, top, seed){
  const cx = isoP(cu, cv).x, w = r * IT / 2, dk = shade(side, -24);
  for (let z = z0; z < z1; z++){
    const row = Math.floor((z - z0) / 3), band = (z - z0) % 3;
    isoEllipse(cu, cv, r, r, z, (x) => {
      if (band === 2 && z < z1 - 1) return dk;
      const lx = x + (row % 2) * 4;
      if ((((lx % 8) + 8) % 8) === 0) return dk;
      const t = hash2(Math.floor(lx / 8), row, seed), c = t > 0.65 ? shade(side, 8) : t < 0.3 ? shade(side, -8) : side;
      return x > cx + w * 0.4 ? shade(c, -24) : x < cx - w * 0.55 ? shade(c, 14) : c;
    });
  }
  isoEllipse(cu, cv, r, r, z1, top);
}
// 둥근 기둥 — 옆면을 한 도트씩 쌓고 윗면을 얹는다. 왼쪽 앞이 밝도록 옆면 위에 빛 한 줄.
function isoDrum(cu, cv, r, z0, z1, side, top){
  for (let z = z0; z < z1; z++){ isoEllipse(cu, cv, r, r, z, z === z0 ? shade(side, -18) : side); }
  isoEllipse(cu - 0.02, cv + 0.02, r, r, z1 - 1, shade(side, 12));
  isoEllipse(cu, cv, r, r, z1, top);
}
/* 분수 물빛 — 화산 섬은 현무암 수반에 용암이 끓어 넘친다(2026-10-06 로키즈 「꾸미개를 용암지대 테마에 맞게」).
   deep 수반 깊은 데 · mid 얕은 데 · rim 물결 · fall 떨어지는 줄기 · spray 물보라 · stone 돌(낮은·밝은·가운데·안쪽) · glow 밤빛 */
const FOUNT_WATER = { deep: '#4f9ad6', mid: '#62b0e0', rim: '#bfe6f8', dish: '#6fb8e6', fall: '#cfeefc', fall2: '#ffffff', spray: '#dff4fd', spray2: '#cfeefc', ring: '#d8f1fc', drop: '#ffffff', glow: '#9ed6ff' };
const FOUNT_LAVA = { deep: '#c8360e', mid: '#ff7a1a', rim: '#ffd84a', dish: '#ff8a1a', fall: '#ff9a2a', fall2: '#ffe066', spray: '#ffd84a', spray2: '#ff8a1a', ring: '#ffe066', drop: '#ffe066', glow: '#ff7a2a',
                     stone: ['#2e2628', '#4a4042', '#3a3234', '#1a1416'] };
function fountTone(){ return isoTheme() === 'mountain' ? FOUNT_LAVA : FOUNT_WATER; }
function isoFountain(b, night){
  if (isoTheme() === 'cloud') return isoChozuya(b, night);
  const cu = b.x + b.w / 2, cv = b.y + b.h / 2, r = Math.min(b.w, b.h) * 0.42, F = fountTone(), St = F.stone || [STONE.low, STONE.hi, STONE.mid, STONE.dark];
  isoEllipse(cu + 0.14, cv + 0.14, r + 0.06, r + 0.06, 0, 'rgba(30,44,24,0.2)');
  stoneDrum(cu, cv, r, 0, 9, St[0], St[1], 5);                                    // 돌 수반 — 돌을 쌓은 결
  isoEllipse(cu, cv, r * 0.82, r * 0.82, 9, St[3]);
  isoEllipse(cu + 0.02, cv + 0.02, r * 0.78, r * 0.78, 9, F.deep);               // 물(용암)
  isoEllipse(cu + 0.1, cv + 0.12, r * 0.5, r * 0.44, 9, F.mid);
  [0.5, 1.9, 3.6, 5].forEach(a => { const q = isoP(cu + Math.cos(a) * r * 0.55, cv + Math.sin(a) * r * 0.55, 9); px(Math.round(q.x) - 2, Math.round(q.y), 4, 1, F.rim); });
  isoDrum(cu, cv, 0.11, 9, 26, St[2], St[1]);                                    // 기둥
  isoDrum(cu, cv, 0.36, 25, 28, St[0], St[1]);                                   // 윗 접시
  isoEllipse(cu, cv, 0.28, 0.28, 28, F.dish);
  for (let i = 0; i < 10; i++){                                                  // 접시 가장자리에서 떨어지는 물
    const a = i / 10 * Math.PI * 2;
    if (Math.sin(a) + Math.cos(a) < -0.5) continue;                              // 뒤쪽 물줄기는 기둥에 가린다
    for (let z = 26; z > 10; z -= 2){ const k = (26 - z) / 16, q = isoP(cu + Math.cos(a) * (0.36 + k * 0.22), cv + Math.sin(a) * (0.36 + k * 0.22), z); px(Math.round(q.x), Math.round(q.y), 1, 1, z % 4 ? F.fall : F.fall2); }
  }
  const q = isoP(cu, cv, 30), x = Math.round(q.x), y = Math.round(q.y);          // 꼭대기 물보라
  px(x - 1, y - 6, 2, 7, F.spray); px(x - 3, y - 4, 6, 1, F.fall2); px(x - 4, y - 1, 1, 2, F.spray2); px(x + 3, y - 1, 1, 2, F.spray2);
  if (night) lamp(x, y + 18, F === FOUNT_LAVA ? 34 : 22, F.glow);
}
// 분수 물 — 접시에서 떨어지는 물방울이 흘러내리고, 수반에 물결 고리가 번지고, 꼭대기 물보라가 솟았다 가라앉는다(2026-09-29 로키즈)
function ipFountainLive(b, t){
  if (isoTheme() === 'cloud') return chozuyaLive(b, t);
  if (STILL) return;
  const cu = b.x + b.w / 2, cv = b.y + b.h / 2, r = Math.min(b.w, b.h) * 0.42, F = fountTone();
  for (let i = 0; i < 10; i++){                                                  // 떨어지는 물방울 — 앞쪽 물줄기만(뒤는 기둥에 가린다)
    const a = i / 10 * Math.PI * 2;
    if (Math.sin(a) + Math.cos(a) < -0.5) continue;
    for (let j = 0; j < 2; j++){
      const f = ((t / 520 + i * 0.37 + j * 0.5) % 1), z = 26 - f * 16, q = isoP(cu + Math.cos(a) * (0.36 + f * 0.22), cv + Math.sin(a) * (0.36 + f * 0.22), z);
      px(Math.round(q.x), Math.round(q.y), 1, 2, F.drop);
    }
  }
  for (let k = 0; k < 2; k++){                                                   // 수반 물결 고리
    const f = ((t / 1400 + k * 0.5) % 1), rr = r * (0.3 + f * 0.45);
    ctx.globalAlpha = 0.7 * (1 - f);
    for (let i = 0; i < 18; i++){ const a = i / 18 * Math.PI * 2, q = isoP(cu + Math.cos(a) * rr, cv + Math.sin(a) * rr, 9); px(Math.round(q.x), Math.round(q.y), 2, 1, F.ring); }
    ctx.globalAlpha = 1;
  }
  const q = isoP(cu, cv, 30), x = Math.round(q.x), y = Math.round(q.y), h = Math.round(2 + (Math.sin(t / 180) + 1) * 2);   // 꼭대기 물보라
  px(x - 1, y - 4 - h, 2, 4 + h, F.fall2); px(x - 3, y - 2 - h, 1, 2, F.spray2); px(x + 2, y - 2 - h, 1, 2, F.spray2);
  for (let i = 0; i < 4; i++){ const f = ((t / 700 + i / 4) % 1), sx = (i % 2 ? 1 : -1) * (2 + f * 6); px(x + Math.round(sx), y - 8 + Math.round(f * f * 14 - f * 6), 1, 1, F.spray); }
}
// 목장 — 바닥은 바닥 겹에, 여기는 뒤쪽 울타리 두 줄과 우리 안 살림
function isoPastureBack(b){
  const x0 = b.x + 0.1, y0 = b.y + 0.1, x1 = b.x + b.w - 0.1, y1 = b.y + b.h - 0.1;
  isoFenceLine(x0, y0, x1, y0);
  isoFenceLine(x0, y0, x0, y1);
  isoCube(x0 + 0.4, y0 + 0.5, 1.1, 0.34, 0, 7, '#c9a227', WOOD.low, WOOD.dark);                 // 여물통
  { const q = isoP(x0 + 0.95, y0 + 0.67, 7); px(Math.round(q.x) - 6, Math.round(q.y) - 1, 12, 2, '#e8c94e'); }
  isoCube(x1 - 1.1, y0 + 0.45, 0.55, 0.5, 0, 8, '#4f9ad6', STONE.mid, STONE.low);                // 물통
  isoCube(x1 - 1.3, y0 + 1.5, 0.8, 0.7, 0, 12, '#f2da8a', '#e0c268', '#c9a94e');                 // 건초 더미
}
// 목장과 밭의 앞쪽 울타리 — 토막마다 깊이를 따로 매겨 아이·동물과 앞뒤를 가린다
function isoFrontFences(cast){
  const seg = (ua, va, ub, vb) => cast.push({ d: (ua + ub) / 2 + (va + vb) / 2, go: () => isoFenceSeg(ua, va, ub, vb) });
  const line = (ua, va, ub, vb, skip) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(ub - ua), Math.abs(vb - va))));
    for (let k = 0; k < n; k++) if (!(skip && skip(k, n))) seg(ua + (ub - ua) * k / n, va + (vb - va) * k / n, ua + (ub - ua) * (k + 1) / n, va + (vb - va) * (k + 1) / n);
  };
  fieldEdges(openField(W.expand || 0), 0.15).forEach(([ua, va, ub, vb]) => line(ua, va, ub, vb));   // 밭 울타리 — 모양대로 빙 둘러
  if (here('pasture')){
    const b = spot('pasture'), x0 = b.x + 0.1, y0 = b.y + 0.1, x1 = b.x + b.w - 0.1, y1 = b.y + b.h - 0.1;
    line(x0, y1, x1, y1, (k, n) => k === Math.floor(n / 2));                   // 가운데는 드나드는 문
    line(x1, y0, x1, y1);
  }
}
// ---- 섬의 작은 것들을 아이소로(2026-09-28 로키즈 「정면을 바라보는 아이템들도 다시 디자인」) ----
// 섬에서는 우편함·게시판·우물·벌통·반려동물 집·허수아비와 꾸미개를 납작 그림 대신 여기서 세운다. 나라 모양도 여기서 가른다.
// 움직이는 부분(흔들리는 그네·빨래·깃발·풍차 날개·불꽃·새)은 ISO_PROP_LIVE 가 매 장 그린다.
function ibox(u, v, su, sv, z0, z1, col, top){ isoCube(u, v, su, sv, z0, z1, top || shade(col, 14), col, shade(col, -28)); }
function ipost(u, v, z0, z1, col, s){ s = s || 0.08; ibox(u - s / 2, v - s / 2, s, s, z0, z1, col); }
function ishadow(cu, cv, ru, rv){ isoEllipse(cu + 0.1, cv + 0.1, ru, rv, 0, 'rgba(30,44,24,0.18)'); }
function propWood(th){ return th === 'seaside' ? '#d9c7a8' : th === 'cloud' ? '#7a5a3e' : CHALET.wood; }
// 얇은 판(u 쪽으로 긴) — 앞면에 무늬를 그릴 수 있게 G 를 돌려준다
function iplank(u0, u1, v, z0, z1, col){ ibox(u0, v, u1 - u0, 0.06, z0, z1, col); return { u0, u1, v0: v, v1: v + 0.06, H: z1 }; }
// 비탈 지붕 한 장(앞으로 기운) — 작은 것들의 지붕
function islope(u0, u1, v0, v1, zb, zf, col){
  poly3([[u0, v0, zb], [u1, v0, zb], [u1, v1, zf], [u0, v1, zf]], isoSnow ? snowTex : roofTex(col, 'L'));
  poly3([[u1, v0, zb], [u1, v1, zf], [u1, v1, zf - 2], [u1, v0, zb - 2]], shade(col, -40));
  poly3([[u0, v1, zf], [u1, v1, zf], [u1, v1, zf - 2], [u0, v1, zf - 2]], shade(col, -26));
}
// 원뿔 — 짚 모자·등 지붕·풍차 머리
function icone(cu, cv, r, z0, h, col){
  for (let k = 0; k <= h; k++){ const rr = r * (1 - k / (h + 1)); isoEllipse(cu, cv, rr, rr, z0 + k, roundTex(cu, cv, rr, k % 3 ? col : shade(col, -12))); }
}
function nightGlow(u, v, z, r, c){ const q = isoP(u, v, z); lamp(q.x, q.y, r, c); }

function ipMail(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.55; let top;
  ishadow(cu, cv, 0.22, 0.16);
  if (th === 'cloud'){                                                          // 일본 — 빨간 둥근 우체통
    isoDrum(cu, cv, 0.17, 0, 30, '#d8322a', '#e8554c'); isoDrum(cu, cv, 0.21, 30, 34, '#b8261f', '#e8554c');
    const G = { u0: cu - 0.12, u1: cu + 0.12, v0: cv, v1: cv + 0.17 };
    faceRect(G, 'L', 0.03, 0.21, 23, 25, '#2b1a18'); faceRect(G, 'L', 0.06, 0.18, 11, 17, '#ffffff'); faceRect(G, 'L', 0.09, 0.15, 13, 15, '#d8322a');
    top = 34;
  } else {
    const pc = th === 'seaside' ? '#f4efe6' : CHALET.wood, bc = th === 'seaside' ? AEGEAN : '#f2c230';   // 그리스 파란 통 · 스위스 노란 통
    ipost(cu, cv, 0, 18, pc, 0.1);
    ibox(cu - 0.2, cv - 0.14, 0.4, 0.28, 18, 30, bc);
    const G = { u0: cu - 0.2, u1: cu + 0.2, v0: cv - 0.14, v1: cv + 0.14 };
    faceRect(G, 'L', 0.1, 0.3, 26, 27, '#1f2a3a');
    if (th === 'mountain'){ const q = faceMid(G, 'L', 0.2, 21), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y, 6, 2, '#1f1f1f'); px(x + 2, y - 2, 2, 5, '#1f1f1f'); }   // 우편 나팔
    else { const q = faceMid(G, 'L', 0.2, 21), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y, 7, 1, '#ffffff'); }
    top = 30;
  }
  if (key && (W.mail[key] || []).length){                                       // 편지가 왔다 — 깃발과 삐져나온 편지
    const q = isoP(cu + 0.1, cv, top), x = Math.round(q.x), y = Math.round(q.y);
    px(x - 6, y - 5, 11, 5, '#fff6e9'); px(x - 6, y - 5, 11, 1, '#ffffff'); px(x - 4, y - 3, 6, 1, '#c9b9a2');
    px(x + 7, y - 14, 2, 14, '#6f4a2c'); px(x + 9, y - 14, 5, 4, '#ff5a4a');
  }
}
function ipBoard(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.45, u0 = cu - 0.4, u1 = cu + 0.4;
  ishadow(cu, cv, 0.4, 0.14);
  const wood = propWood(th), frame = th === 'seaside' ? AEGEAN : shade(wood, -22);
  ipost(u0 + 0.06, cv + 0.03, 0, 34, frame); ipost(u1 - 0.06, cv + 0.03, 0, 34, frame);
  const G = iplank(u0, u1, cv, 12, 34, frame), L = u1 - u0;
  faceRect(G, 'L', 0.05, L - 0.05, 14, 32, th === 'cloud' ? '#eadfc4' : '#fff6e9');
  faceRect(G, 'L', 0.1, 0.36, 19, 30, '#fffdf6');                              // 쪽지 둘
  faceRect(G, 'L', 0.44, 0.7, 16, 26, th === 'cloud' ? '#f6efd9' : '#ffe9ef');
  for (let z = 21; z < 29; z += 3) faceRect(G, 'L', 0.13, 0.32, z, z + 1, '#8a7a63');
  if (th === 'cloud') for (let z = 18; z < 25; z += 3) faceRect(G, 'L', 0.55, 0.58, z, z + 2, WA.ink);   // 붓글씨 획
  [0.22, 0.57].forEach((a, i) => { const q = faceMid(G, 'L', a, 29 - i * 3); px(Math.round(q.x), Math.round(q.y), 2, 2, i ? '#4a7fb5' : '#e05545'); });
  if (th !== 'seaside') islope(u0 - 0.08, u1 + 0.08, cv - 0.14, cv + 0.22, 40, 34, th === 'cloud' ? WA.tile : CHALET.roof);   // 작은 지붕
  else faceRect(G, 'L', 0, L, 32, 34, '#ffffff');
}
function ipWell(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.4, 0.34);
  if (th === 'mountain'){                                                       // 스위스 — 나무 구유 샘, 기둥 꼭지에서 물이 흐른다
    const wood = CHALET.wood;
    ibox(cu - 0.4, cv - 0.2, 0.8, 0.4, 0, 11, wood);
    poly3([[cu - 0.34, cv - 0.14, 11], [cu + 0.34, cv - 0.14, 11], [cu + 0.34, cv + 0.14, 11], [cu - 0.34, cv + 0.14, 11]], '#4f9ad6');
    poly3([[cu - 0.2, cv - 0.06, 11], [cu + 0.1, cv - 0.06, 11], [cu + 0.1, cv + 0.08, 11], [cu - 0.2, cv + 0.08, 11]], '#7fc4ea');
    ibox(cu - 0.08, cv - 0.3, 0.16, 0.12, 0, 30, shade(wood, -16));
    ibox(cu - 0.03, cv - 0.2, 0.06, 0.14, 22, 24, '#8a8f96');
    const q = isoP(cu, cv - 0.07, 22); for (let z = 0; z < 11; z++) px(Math.round(q.x), Math.round(q.y) + z, 1, 1, z % 3 ? '#cfeefc' : '#ffffff');
    [[-0.3, '#e8324a'], [0.26, '#ff5a6a']].forEach(([o, c]) => { const r = isoP(cu + o, cv + 0.2, 11); px(Math.round(r.x) - 3, Math.round(r.y) - 4, 6, 4, '#4f8f48'); px(Math.round(r.x) - 2, Math.round(r.y) - 6, 3, 2, c); });
    return;
  }
  const rim = th === 'seaside' ? WHITEWASH : STONE.mid;
  if (th === 'cloud'){ ibox(cu - 0.3, cv - 0.3, 0.6, 0.6, 0, 13, '#9a978f'); poly3([[cu - 0.22, cv - 0.22, 13], [cu + 0.22, cv - 0.22, 13], [cu + 0.22, cv + 0.22, 13], [cu - 0.22, cv + 0.22, 13]], '#1f3a4a'); }
  else { isoDrum(cu, cv, 0.3, 0, 13, rim, shade(rim, -8)); isoEllipse(cu, cv, 0.23, 0.23, 13, '#1f3a4a'); }
  const pc = th === 'seaside' ? AEGEAN : WA.post;
  ipost(cu - 0.28, cv, 0, 38, pc); ipost(cu + 0.28, cv, 0, 38, pc);
  ibox(cu - 0.32, cv - 0.03, 0.64, 0.06, 36, 38, pc);                            // 도르래 막대
  { const q = isoP(cu, cv, 36), x = Math.round(q.x), y = Math.round(q.y); px(x, y, 1, 10, '#8a7a63'); px(x - 3, y + 10, 7, 5, th === 'seaside' ? '#c9ccd4' : WOOD.mid); px(x - 3, y + 10, 7, 1, '#ffffff'); }
  if (th === 'seaside') isoDome(cu, cv, 0.26, 38, AEGEAN);                         // 파란 뚜껑 지붕
  else islope(cu - 0.42, cu + 0.42, cv - 0.3, cv + 0.3, 46, 38, WA.tile);          // 일본 — 기와 얹은 두레박 우물
}
function ipHive(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.3, 0.24);
  let top;
  if (th === 'cloud'){                                                          // 일본 — 네모 통을 층층이 쌓고 짚 삿갓
    ibox(cu - 0.2, cv - 0.2, 0.4, 0.4, 0, 4, STONE.mid);
    for (let k = 0; k < 4; k++) ibox(cu - 0.17, cv - 0.17, 0.34, 0.34, 4 + k * 7, 10 + k * 7, k % 2 ? '#a9794f' : '#b8895c');
    icone(cu, cv, 0.3, 32, 12, '#c9a86a'); top = 44;
  } else if (th === 'mountain'){                                                // 스위스 — 다리 달린 나무 통에 작은 박공
    ipost(cu - 0.15, cv + 0.12, 0, 8, WOOD.dark); ipost(cu + 0.15, cv + 0.12, 0, 8, WOOD.dark);
    ibox(cu - 0.22, cv - 0.18, 0.44, 0.36, 8, 26, '#c98f55');
    islope(cu - 0.28, cu + 0.28, cv - 0.24, cv + 0.24, 32, 25, CHALET.roof); top = 32;
  } else {                                                                      // 그리스 — 흰 통과 파란 통을 포개고 뚜껑
    ibox(cu - 0.2, cv - 0.18, 0.4, 0.36, 0, 12, WHITEWASH); ibox(cu - 0.2, cv - 0.18, 0.4, 0.36, 12, 24, AEGEAN); ibox(cu - 0.24, cv - 0.22, 0.48, 0.44, 24, 27, WHITEWASH);
    top = 27;
  }
  const G = { u0: cu - 0.2, u1: cu + 0.2, v0: cv, v1: cv + 0.18 };
  faceRect(G, 'L', 0.12, 0.28, 3, 5, '#2e241c');                                // 드나드는 틈
  [12, 19].forEach(z => { if (z < top - 3) faceRect(G, 'L', 0, 0.4, z, z + 1, 'rgba(40,24,10,0.35)'); });
  { const q = faceMid(G, 'L', 0.2, 2), x = Math.round(q.x), y = Math.round(q.y); px(x - 4, y, 9, 1, 'rgba(40,24,10,0.3)'); }   // 착륙판 그늘
  if (W.buildings.hive && W.buildings.hive.honey){ const q = isoP(cu + 0.3, cv + 0.25, 0), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 8, 7, 8, '#ffb43d'); px(x - 3, y - 8, 3, 3, '#ffe08a'); px(x - 4, y - 9, 9, 2, '#c98f55'); }
  [[0.3, 10], [-0.25, 18], [0.1, top + 6]].forEach(([o, z], i) => { const q = isoP(cu + o, cv + 0.2, z); px(Math.round(q.x), Math.round(q.y), 2, 2, '#ffd23d'); px(Math.round(q.x) + (i % 2 ? -1 : 2), Math.round(q.y) - 1, 1, 1, '#ffffff'); });
}
function ipPethouse(b, night, season, th){
  const G = isoGeo(b, 0.16, 16), lenL = G.u1 - G.u0;
  isoShadow(G);
  if (th === 'seaside'){ isoBlock(G, 0, WHITEWASH, 'plaster', 51); isoParapet(G, WHITEWASH); faceRect(G, 'L', 0, lenL, G.H - 2, G.H, AEGEAN); }
  else isoWalls(G, th === 'cloud' ? '#a9794f' : CHALET.wood, 'wood', 51);
  isoArchDoor(G, 'L', lenL / 2 - 0.16, 0.32, 7, '#2e241c', th === 'seaside' ? AEGEAN : shade(propWood(th), -30));
  const plate = faceMid(G, 'L', lenL / 2, 13); px(Math.round(plate.x) - 4, Math.round(plate.y) - 1, 8, 3, '#fff6e9');
  if (th === 'mountain') isoRoof(G, { ridge: 'v', rise: 11, roof: CHALET.roof, wall: CHALET.wood, gable: CHALET.wood, eave: 0.14 });
  if (th === 'cloud') isoRoof(G, { ridge: 'u', rise: 11, roof: WA.tile, wall: '#a9794f', gable: '#a9794f', eave: 0.16 });
  const bowl = isoP(G.u1 + 0.05, G.v1 + 0.12, 0); px(Math.round(bowl.x) - 3, Math.round(bowl.y) - 2, 6, 2, '#e05545'); px(Math.round(bowl.x) - 2, Math.round(bowl.y) - 3, 4, 1, '#c98f55');
}
function ipScarecrow(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.24, 0.12);
  ipost(cu, cv, 0, 38, WOOD.dark, 0.07);
  const shirt = th === 'seaside' ? '#5aa0d8' : th === 'mountain' ? '#c8323a' : WA.indigo;
  ibox(cu - 0.36, cv - 0.03, 0.72, 0.06, 27, 30, WOOD.dark);                    // 팔 막대
  ibox(cu - 0.15, cv - 0.05, 0.3, 0.1, 13, 30, shirt);
  ibox(cu - 0.34, cv - 0.04, 0.19, 0.08, 26, 30, shirt); ibox(cu + 0.15, cv - 0.04, 0.19, 0.08, 26, 30, shirt);
  const G = { u0: cu - 0.15, u1: cu + 0.15, v0: cv - 0.05, v1: cv + 0.05 };
  if (th === 'seaside') for (let z = 15; z < 30; z += 4) faceRect(G, 'L', 0, 0.3, z, z + 1, '#ffffff');   // 줄무늬 셔츠
  if (th === 'mountain') faceRect(G, 'L', 0.11, 0.19, 13, 30, '#fff6e9');                                // 흰 셔츠 위 붉은 조끼
  if (th === 'cloud') for (let k = 0; k < 7; k++){ const q = faceMid(G, 'L', k * 0.05, 30); px(Math.round(q.x), Math.round(q.y), 1, 12, '#b89b5a'); }   // 짚 도롱이
  [cu - 0.36, cu + 0.36].forEach(u => { const q = isoP(u, cv, 28); px(Math.round(q.x) - 2, Math.round(q.y) - 1, 4, 4, '#e8c94e'); px(Math.round(q.x) - 3, Math.round(q.y) + 2, 1, 2, '#c9a94e'); px(Math.round(q.x) + 2, Math.round(q.y) + 2, 1, 3, '#f2da8a'); });   // 삐져나온 짚
  faceRect(G, 'L', 0.03, 0.11, 16, 21, th === 'mountain' ? '#6f9a4a' : '#e8a040');                   // 덧댄 헝겊
  { const q = faceMid(G, 'L', 0.07, 21), x = Math.round(q.x), y = Math.round(q.y); px(x - 2, y, 1, 1, '#3a3226'); px(x + 1, y + 1, 1, 1, '#3a3226'); px(x - 1, y - 2, 1, 1, '#3a3226'); }   // 바늘땀
  [26, 22, 18].forEach(z => { const q = faceMid(G, 'L', 0.22, z); px(Math.round(q.x), Math.round(q.y), 1, 1, '#3a3226'); });   // 단추
  const h = isoP(cu, cv, 32), x = Math.round(h.x), y = Math.round(h.y);
  blob(x, y - 10, 11, 10, '#e9cf95', '#f7e5bb', '#c9ab70', 'scf');
  px(x - 3, y - 6, 2, 2, '#3a3226'); px(x + 2, y - 6, 2, 2, '#3a3226'); px(x - 1, y - 3, 3, 1, '#b5572f');
  if (th === 'cloud') icone(cu, cv, 0.26, 40, 9, '#d9c08a');                          // 삿갓
  else if (th === 'seaside'){ isoEllipse(cu, cv, 0.28, 0.28, 40, '#e8cf86'); icone(cu, cv, 0.14, 40, 5, '#e8cf86'); isoEllipse(cu, cv, 0.15, 0.15, 42, AEGEAN); }
  else { isoDrum(cu, cv, 0.13, 40, 46, '#3f6a44', '#4f7d4a'); isoEllipse(cu, cv, 0.22, 0.22, 40, '#3f6a44'); const f = isoP(cu + 0.1, cv, 46); px(Math.round(f.x), Math.round(f.y) - 6, 1, 6, '#ffffff'); }
}
const LANTERN_Z = { seaside: 34, mountain: 44, cloud: 22 };
function ipLantern(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.2, 0.16);
  if (th === 'cloud'){                                                          // 석등
    const s = '#a9a79f';
    ibox(cu - 0.2, cv - 0.2, 0.4, 0.4, 0, 4, s); isoDrum(cu, cv, 0.08, 4, 16, s, shade(s, 10)); ibox(cu - 0.16, cv - 0.16, 0.32, 0.32, 16, 19, s);
    ibox(cu - 0.12, cv - 0.12, 0.24, 0.24, 19, 27, s);
    const G = { u0: cu - 0.12, u1: cu + 0.12, v0: cv - 0.12, v1: cv + 0.12 };
    faceRect(G, 'L', 0.06, 0.18, 20, 26, night ? '#ffd98a' : '#3a3226'); faceRect(G, 'R', 0.06, 0.18, 20, 26, night ? '#ffc86a' : '#2e2a24');
    for (let k = 0; k < 3; k++) ibox(cu - 0.24 + k * 0.05, cv - 0.24 + k * 0.05, 0.48 - k * 0.1, 0.48 - k * 0.1, 27 + k * 2, 29 + k * 2, s);
    isoDrum(cu, cv, 0.05, 33, 37, s, shade(s, 12));
  } else if (th === 'mountain'){                                                // 화산 — 쇠 화로대. 세 발 위 쇠 바구니에 장작불(불꽃은 ipBrazierLive)
    const ir = '#241c1e', z = 30;
    [[-0.1, -0.06], [0.08, -0.08], [0, 0.1]].forEach(([a, c2]) => isoSeg(isoP(cu + a * 1.6, cv + c2 * 1.6, 0), isoP(cu, cv, z - 10), ir, 2));   // 세 발
    ipost(cu, cv, z - 12, z - 4, ir, 0.05);
    isoDrum(cu, cv, 0.16, z - 4, z, '#1a1416', '#3a2e30');                       // 바구니 밑
    for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; if (Math.sin(a) + Math.cos(a) < -0.6) continue; isoSeg(isoP(cu + Math.cos(a) * 0.16, cv + Math.sin(a) * 0.16, z), isoP(cu + Math.cos(a) * 0.2, cv + Math.sin(a) * 0.2, z + 7), ir, 1); }   // 쇠살
    isoEllipse(cu, cv, 0.15, 0.15, z + 1, '#ff6a1a'); isoEllipse(cu - 0.02, cv - 0.02, 0.08, 0.08, z + 2, '#ffd84a');   // 숯불
    isoDrum(cu, cv, 0.2, z + 6, z + 8, ir, '#3a2e30');                           // 테
    if (night) nightGlow(cu, cv, z + 6, 36, '#ff8a3a');
    return;
  } else {
    const pc = th === 'seaside' ? WHITEWASH : '#2f2f33', z = LANTERN_Z[th] || 34;
    ibox(cu - 0.1, cv - 0.1, 0.2, 0.2, 0, 4, pc); ipost(cu, cv, 4, z - 8, pc, 0.06);
    ibox(cu - 0.09, cv - 0.09, 0.18, 0.18, z - 8, z, night ? '#ffe9a0' : '#cfe3ee', pc);
    const G = { u0: cu - 0.09, u1: cu + 0.09, v0: cv - 0.09, v1: cv + 0.09 };
    faceRect(G, 'L', 0.08, 0.1, z - 8, z, pc); faceRect(G, 'R', 0.08, 0.1, z - 8, z, pc);
    faceRect(G, 'L', 0, 0.18, z - 5, z - 4, pc); faceRect(G, 'R', 0, 0.18, z - 5, z - 4, pc);
    if (!night) faceRect(G, 'L', 0.02, 0.05, z - 7, z - 1, '#ffffffb0');
    icone(cu, cv, 0.15, z, 5, th === 'seaside' ? AEGEAN : '#2f2f33');
    if (th === 'mountain'){ const q = isoP(cu, cv, z - 16); px(Math.round(q.x) - 4, Math.round(q.y), 3, 1, '#2f2f33'); px(Math.round(q.x) + 2, Math.round(q.y), 3, 1, '#2f2f33'); }   // 쇠 장식
  }
  if (night) nightGlow(cu, cv, LANTERN_Z[th] - 4 || 30, 30, '#ffe08a');
}
function ipBench(b, night, season, th){
  const u0 = b.x + 0.2, u1 = b.x + b.w - 0.2, cv = b.y + b.h / 2;
  ishadow((u0 + u1) / 2, cv, (u1 - u0) / 2, 0.2);
  if (th === 'cloud'){                                                          // 붉은 천 깐 평상과 큰 양산
    [u0 + 0.06, u1 - 0.06].forEach(u => { ipost(u, cv - 0.12, 0, 10, WA.post); ipost(u, cv + 0.12, 0, 10, WA.post); });
    ibox(u0, cv - 0.2, u1 - u0, 0.4, 10, 13, '#c8323a');
    const pu = u1 - 0.25;
    ipost(pu, cv - 0.25, 0, 44, WA.post, 0.04);
    for (let k = 0; k < 10; k++){ const rr = 0.62 * (1 - k / 10); isoEllipse(pu, cv - 0.25, rr, rr, 40 + k, roundTex(pu, cv - 0.25, rr, k === 0 ? '#a8261f' : '#d8322a')); }
    return;
  }
  if (th === 'mountain'){                                                       // 화산 — 현무암 덩이 다리 둘에 두꺼운 흑요석 판, 금마다 용암빛
    [u0 + 0.02, u1 - 0.26].forEach((u, j) => ibox(u, cv - 0.18, 0.24, 0.36, 0, 9, shade('#2a2226', j * 8), '#4a3e44'));
    ibox(u0 - 0.04, cv - 0.2, u1 - u0 + 0.08, 0.4, 9, 13, '#1e181a', '#3a3034');      // 앉는 판
    iplank(u0, u1, cv - 0.24, 13, 25, '#2a2226');                                     // 등판
    const S2 = { u0: u0 - 0.04, u1: u1 + 0.04, v0: cv - 0.2, v1: cv + 0.2 };
    faceRect(S2, 'L', 0.06, u1 - u0 + 0.02, 10, 11, '#c8360e');                       // 판 이음 틈
    for (let z = 14; z < 25; z++){ const q = isoP(u0 + (u1 - u0) * 0.38 + Math.sin(z * 0.9) * 0.04, cv - 0.18, z); px(Math.round(q.x), Math.round(q.y), 1, 1, z % 4 ? '#ff5a1a' : '#ffd84a'); }   // 등판 금
    if (night) nightGlow((u0 + u1) / 2, cv, 11, 18, '#ff6a1a');
    return;
  }
  const leg = th === 'seaside' ? WHITEWASH : CHALET.dark, seat = th === 'seaside' ? AEGEAN : CHALET.wood;
  if (th === 'seaside'){ ibox(u0, cv - 0.18, 0.18, 0.36, 0, 12, leg); ibox(u1 - 0.18, cv - 0.18, 0.18, 0.36, 0, 12, leg); }
  else [u0 + 0.06, u1 - 0.06].forEach(u => { ipost(u, cv + 0.12, 0, 11, leg); ipost(u, cv - 0.14, 0, 24, leg); });
  for (let k = 0; k < 3; k++) ibox(u0 - 0.02, cv - 0.16 + k * 0.12, u1 - u0 + 0.04, 0.1, 11, 13, seat);
  iplank(u0 - 0.02, u1 + 0.02, cv - 0.22, 16, 24, seat);
}
function ipSwingFrame(b, night, season, th){
  const u0 = b.x + 0.25, u1 = b.x + b.w - 0.25, cv = b.y + b.h / 2, c = th === 'seaside' ? WHITEWASH : th === 'cloud' ? '#b9c46a' : CHALET.wood;
  ishadow((u0 + u1) / 2, cv, (u1 - u0) / 2 + 0.1, 0.4);
  if (th === 'mountain'){                                                       // 화산 — 거친 현무암 기둥 둘에 검은 쇠 가로대, 기둥 금마다 용암빛
    [u0, u1].forEach((u, j) => {
      [[0.16, 0, 14], [0.13, 14, 30], [0.14, 30, 44]].forEach(([s2, z0, z1], k) => { const o = (hash2(j, k, 618) - 0.5) * 0.04; ibox(u - s2 / 2 + o, cv - s2 / 2, s2, s2, z0, z1, shade('#2a2226', (k % 2) * 8), '#4a3e44'); });
      for (let z = 4; z < 42; z += 2){ const q = isoP(u - 0.02 + Math.sin(z * 0.8 + j) * 0.02, cv + 0.07, z); if (hash2(z, j, 619) > 0.5) px(Math.round(q.x), Math.round(q.y), 1, 2, z % 6 ? '#ff5a1a' : '#ffd84a'); }
    });
    ibox(u0 - 0.1, cv - 0.04, u1 - u0 + 0.2, 0.08, 44, 47, '#2f2f33');
    [u0, u1].forEach(u => ibox(u - 0.09, cv - 0.09, 0.18, 0.18, 47, 50, '#1e181a', '#3a3034'));   // 머릿돌
    return;
  }
  [u0, u1].forEach(u => {                                                       // 기울어진 다리 둘씩(A 틀)
    isoSeg(isoP(u, cv - 0.4, 0), isoP(u, cv, 46), shade(c, -20), 3);
    isoSeg(isoP(u, cv + 0.4, 0), isoP(u, cv, 46), c, 3);
  });
  ibox(u0 - 0.08, cv - 0.04, u1 - u0 + 0.16, 0.08, 45, 48, c);
  if (th === 'cloud') [u0, u1].forEach(u => { const q = isoP(u, cv, 30); px(Math.round(q.x) - 2, Math.round(q.y), 4, 2, WA.ink); });
}
function ipSwingLive(b, t, L, season, th){
  const u0 = b.x + 0.25, u1 = b.x + b.w - 0.25, cv = b.y + b.h / 2;
  const a = STILL ? 0 : Math.sin(t / 1150) * (0.35 + curWind * 0.04), dv = Math.sin(a) * 0.9, dz = (1 - Math.cos(a)) * 30;
  const sa = u0 + (u1 - u0) * 0.3, sb = u1 - (u1 - u0) * 0.3, seat = th === 'seaside' ? AEGEAN : th === 'cloud' ? '#c8323a' : th === 'mountain' ? '#2a2226' : CHALET.wood;
  [sa, sb].forEach(u => isoSeg(isoP(u, cv, 45), isoP(u, cv + dv, 12 + dz), th === 'mountain' ? '#4a4448' : '#8a7a63', 1));   // 화산은 쇠사슬
  ibox(sa - 0.06, cv + dv - 0.1, sb - sa + 0.12, 0.2, 10 + dz, 13 + dz, seat);
  if (th === 'mountain'){ const q = isoP((sa + sb) / 2, cv + dv + 0.1, 11 + dz); px(Math.round(q.x) - 3, Math.round(q.y), 6, 1, '#ff5a1a'); }   // 판 앞 용암 금
}
function ipArch(b, night, season, th){
  const u0 = b.x + 0.22, u1 = b.x + b.w - 0.22, cv = b.y + b.h / 2;
  ishadow((u0 + u1) / 2, cv, (u1 - u0) / 2 + 0.1, 0.16);
  if (th === 'cloud'){                                                          // 붉은 도리이
    const red = '#e8453c';
    [u0 + 0.08, u1 - 0.08].forEach(u => { ibox(u - 0.08, cv - 0.08, 0.16, 0.16, 0, 3, WA.ink); isoDrum(u, cv, 0.065, 3, 48, red, shade(red, 16)); });
    ibox(u0 - 0.06, cv - 0.04, u1 - u0 + 0.12, 0.08, 38, 41, red);                   // 누키
    ibox(u0 - 0.2, cv - 0.07, u1 - u0 + 0.4, 0.14, 48, 51, red);                     // 가사기 밑
    ibox(u0 - 0.26, cv - 0.08, u1 - u0 + 0.52, 0.16, 51, 54, WA.ink);                // 검은 갓
    ibox((u0 + u1) / 2 - 0.05, cv - 0.03, 0.1, 0.06, 41, 48, red);
    return;
  }
  if (th === 'seaside'){                                                        // 흰 회벽 문 — 위에 부겐빌레아
    ibox(u0 - 0.1, cv - 0.12, 0.2, 0.24, 0, 38, WHITEWASH); ibox(u1 - 0.1, cv - 0.12, 0.2, 0.24, 0, 38, WHITEWASH);
    ibox(u0 - 0.14, cv - 0.14, u1 - u0 + 0.28, 0.28, 38, 46, WHITEWASH);
    const G = { u0: u0 - 0.14, u1: u1 + 0.14, v0: cv - 0.14, v1: cv + 0.14 };
    faceRect(G, 'L', 0, u1 - u0 + 0.28, 44, 46, AEGEAN);
    for (let i = 0; i < 9; i++){ const q = isoP(u0 - 0.1 + i * (u1 - u0 + 0.2) / 8, cv, 46 + (i % 3) * 2); blob(q.x, q.y - 6, 9, 7, i % 3 ? '#e0529a' : '#f27ab8', '#ffa3cf', '#a8306e', 'ar' + i); }
    return;
  }
  if (th === 'mountain'){                                                       // 화산 — 거칠게 깎은 흑요석 기둥 둘과 얹은 돌, 금마다 용암빛, 발치엔 불꽃 장미
    const ob = '#2a2226';
    [u0, u1].forEach((u, j) => {
      [[0.17, 0, 12], [0.14, 12, 24], [0.15, 24, 34], [0.12, 34, 42]].forEach(([s2, z0, z1], k) => { const o = (hash2(j, k, 615) - 0.5) * 0.05; ibox(u - s2 / 2 + o, cv - s2 / 2, s2, s2, z0, z1, shade(ob, (k % 2) * 8), '#4a3e44'); });
      for (let z = 4; z < 40; z += 2){ const q = isoP(u - 0.03 + Math.sin(z * 0.7 + j) * 0.02, cv + 0.08, z); if (hash2(z, j, 616) > 0.45) px(Math.round(q.x), Math.round(q.y), 1, 2, z % 6 ? '#ff5a1a' : '#ffd84a'); }   // 기둥 금
    });
    ibox(u0 - 0.16, cv - 0.11, u1 - u0 + 0.32, 0.22, 42, 48, '#1e181a', '#3a3034');   // 얹은 돌
    ibox((u0 + u1) / 2 - 0.12, cv - 0.09, 0.24, 0.18, 48, 53, '#2a2226', '#463a40');
    { const q = isoP((u0 + u1) / 2, cv + 0.11, 45), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 1, 6, 2, '#ff6a1a'); px(x - 1, y - 2, 2, 4, '#ffd84a'); }   // 가운데 불꽃 문양
    [[u0, '#ff5a1a'], [u1, '#ffb02e']].forEach(([u, c]) => { const r = isoP(u, cv + 0.14, 4); px(Math.round(r.x) - 3, Math.round(r.y) - 6, 6, 6, '#3a2e26'); px(Math.round(r.x) - 2, Math.round(r.y) - 9, 2, 4, c); px(Math.round(r.x) + 1, Math.round(r.y) - 8, 2, 3, '#e8321e'); });
    return;
  }
  const w = CHALET.wood;                                                        // 스위스 — 나무 대문, 작은 지붕과 매단 팻말
  ipost(u0, cv, 0, 40, CHALET.dark, 0.12); ipost(u1, cv, 0, 40, CHALET.dark, 0.12);
  ibox(u0 - 0.12, cv - 0.05, u1 - u0 + 0.24, 0.1, 36, 40, w);
  islope(u0 - 0.2, u1 + 0.2, cv - 0.2, cv + 0.2, 48, 40, CHALET.roof);
  const q = isoP((u0 + u1) / 2, cv, 36), x = Math.round(q.x), y = Math.round(q.y);
  px(x - 1, y, 1, 3, '#5a544d'); px(x + 5, y, 1, 3, '#5a544d'); px(x - 6, y + 3, 16, 6, '#fff6e9'); px(x - 4, y + 5, 12, 1, CHALET.dark);
  [[u0, '#e8324a'], [u1, '#ff9ec4']].forEach(([u, c]) => { const r = isoP(u, cv + 0.1, 8); px(Math.round(r.x) - 3, Math.round(r.y) - 6, 6, 6, '#4f8f48'); px(Math.round(r.x) - 1, Math.round(r.y) - 7, 3, 2, c); });
}
function ipSandbox(b, night, season, th){
  const u0 = b.x + 0.18, u1 = b.x + b.w - 0.18, v0 = b.y + 0.18, v1 = b.y + b.h - 0.18;
  const fr = th === 'seaside' ? WHITEWASH : th === 'cloud' ? '#9a978f' : th === 'mountain' ? '#3a3234' : CHALET.wood, t = 0.1;   // 화산 — 현무암 틀에 검은 화산 모래
  ibox(u0, v0, u1 - u0, t, 0, 6, fr); ibox(u0, v0, t, v1 - v0, 0, 6, fr);
  const sand = th === 'cloud' ? '#e8e4d8' : th === 'mountain' ? '#4a4244' : '#ecd9a4', castle = th === 'mountain' ? ['#5e5456', '#6a6062'] : ['#e0c47e', '#e8cf8e'];
  poly3([[u0 + t, v0 + t, 4], [u1 - t, v0 + t, 4], [u1 - t, v1 - t, 4], [u0 + t, v1 - t, 4]], sand);
  if (th === 'cloud'){                                                          // 일본 — 흰 모래에 물결을 긁은 마른 정원, 돌 셋
    for (let k = 1; k < 9; k++){ const v = v0 + t + (v1 - v0 - 2 * t) * k / 9; isoSeg(isoP(u0 + t + 0.05, v, 4), isoP(u1 - t - 0.05, v, 4), '#d4cfc0', 1); }
    [[0.35, 0.4, 0.22, 8], [0.62, 0.62, 0.14, 5], [0.28, 0.72, 0.1, 4]].forEach(([fu, fv, r, h]) => {
      const u = u0 + (u1 - u0) * fu, v = v0 + (v1 - v0) * fv;
      isoEllipse(u, v, r + 0.08, r + 0.06, 4, '#d4cfc0'); ibox(u - r / 2, v - r / 2, r, r, 4, 4 + h, '#6d6f6a'); isoEllipse(u - 0.02, v - 0.02, r * 0.4, r * 0.4, 4 + h, '#7f9a5a');
    });
  } else {
    for (let i = 0; i < 40; i++){ const q = isoP(u0 + t + hash2(i, 1, 611) * (u1 - u0 - 2 * t), v0 + t + hash2(i, 2, 611) * (v1 - v0 - 2 * t), 4); px(Math.round(q.x), Math.round(q.y), 1, 1, shade(sand, -14)); }
    const cu = u0 + (u1 - u0) * 0.4, cv = v0 + (v1 - v0) * 0.45;                  // 모래성
    ibox(cu - 0.2, cv - 0.2, 0.4, 0.4, 4, 12, castle[0]); ibox(cu - 0.1, cv - 0.1, 0.2, 0.2, 12, 20, castle[0]);
    [[-0.2, -0.2], [0.12, -0.2], [-0.2, 0.12], [0.12, 0.12]].forEach(([a, c]) => ibox(cu + a, cv + c, 0.08, 0.08, 12, 15, castle[1]));
    if (th === 'mountain'){ const q = isoP(cu, cv, 20); px(Math.round(q.x) - 1, Math.round(q.y) - 2, 2, 2, '#ff6a1a'); px(Math.round(q.x), Math.round(q.y) - 3, 1, 1, '#ffd84a'); }   // 성 꼭대기에 꽂은 불씨 깃
    const bu = u0 + (u1 - u0) * 0.72, bv = v0 + (v1 - v0) * 0.7;
    isoDrum(bu, bv, 0.1, 4, 12, th === 'seaside' ? AEGEAN : '#e8453c', '#ffffff');   // 양동이
    if (th === 'seaside') [[0.2, 0.75], [0.6, 0.25]].forEach(([fu, fv]) => { const q = isoP(u0 + (u1 - u0) * fu, v0 + (v1 - v0) * fv, 4); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 2, '#ffd6e0'); });   // 조개껍데기
  }
  ibox(u0, v1 - t, u1 - u0, t, 0, 6, fr); ibox(u1 - t, v0, t, v1 - v0, 0, 6, fr);   // 앞쪽 두 판은 모래 뒤에
}
function ipFirepit(b, night, season, th){
  if (th === 'cloud') return isoKettleFire(b, night);
  const cu = b.x + 0.5, cv = b.y + 0.5, st = th === 'seaside' ? '#e6e0d4' : th === 'cloud' ? '#6d6f6a' : th === 'mountain' ? '#3a3234' : STONE.mid;
  isoEllipse(cu, cv, 0.34, 0.34, 0, '#3a3226');
  for (let i = 0; i < 9; i++){ const a = i / 9 * Math.PI * 2, u = cu + Math.cos(a) * 0.3, v = cv + Math.sin(a) * 0.3; ibox(u - 0.07, v - 0.06, 0.14, 0.12, 0, 5 + (i % 2), shade(st, (i % 3) * 8 - 8)); }
  isoSeg(isoP(cu - 0.2, cv - 0.1, 3), isoP(cu + 0.2, cv + 0.1, 5), WOOD.dark, 3); isoSeg(isoP(cu - 0.15, cv + 0.18, 3), isoP(cu + 0.15, cv - 0.18, 5), WOOD.low, 3);
  if (night) nightGlow(cu, cv, 8, 34, '#ffb055');
}
// 화로대 불꽃 — 낮에도 타오른다
function ipBrazierLive(b, t, L, season, th){
  if (th !== 'mountain') return withBB(bbOffset(b), () => onlyDecor('lantern', () => drawDecorLive(season, t, L)));   // 다른 농장 등불은 예전 그대로
  const q = isoP(b.x + 0.5, b.y + 0.5, 37), x = Math.round(q.x), y = Math.round(q.y);
  const f = STILL ? 0 : Math.sin(t / 130) > 0 ? 2 : 0, f2 = STILL ? 0 : Math.sin(t / 190) > 0 ? 2 : 0;
  px(x - 4, y - 5 - f, 8, 5, '#ff6a1a'); px(x - 3, y - 9 - f2, 6, 5, '#ff8c2e'); px(x - 2, y - 12 - f, 4, 4, '#ffa94d'); px(x - 1, y - 8, 2, 6, '#ffd166'); px(x - 1, y - 4, 2, 3, '#fff3c0');
  if (!STILL){ const ph = (t / 600) % 1; px(x + Math.round(Math.sin(t / 200) * 3), y - 14 - Math.round(ph * 14), 1, 1, ph < 0.5 ? '#ffd84a' : '#ff6a1a'); }   // 튀는 불티
}
function ipFireLive(b, t, L){
  if (isoTheme() === 'cloud') kettleSteam(b, t);
  if (L.dark <= 0.14) return;
  const q = isoP(b.x + 0.5, b.y + 0.5, 5), x = Math.round(q.x), y = Math.round(q.y);
  const f = Math.sin(t / 150) > 0 ? 3 : 0, f2 = Math.sin(t / 210) > 0 ? 2 : 0;
  px(x - 5, y - 6 - f, 10, 6, '#ff8c2e'); px(x - 4, y - 10 - f, 8, 5, '#ff8c2e'); px(x - 3, y - 13 - f2, 6, 4, '#ffa94d'); px(x - 2, y - 9 - f2, 4, 8, '#ffd166'); px(x - 1, y - 5, 2, 4, '#fff3c0');
}
function ipSign(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.24, 0.1);
  if (th === 'cloud'){                                                          // 세운 나무 팻말 — 붓글씨 세 줄
    const G = iplank(cu - 0.12, cu + 0.12, cv, 0, 38, '#c9a878');
    islope(cu - 0.18, cu + 0.18, cv - 0.08, cv + 0.14, 42, 38, WA.post);
    [0.06, 0.12, 0.18].forEach((a, i) => faceRect(G, 'L', a - 0.012, a + 0.012, 12 + i * 3, 33 - i * 2, WA.ink));
    return;
  }
  ipost(cu, cv + 0.03, 0, 26, th === 'seaside' ? WHITEWASH : CHALET.dark);
  const col = th === 'seaside' ? AEGEAN : CHALET.wood, G = iplank(cu - 0.3, cu + 0.3, cv, 18, 30, col);
  if (th === 'seaside') for (let a = 0.05; a < 0.55; a += 0.03) faceRect(G, 'L', a, a + 0.03, 23 + Math.round(Math.sin(a * 22) * 1.5), 25 + Math.round(Math.sin(a * 22) * 1.5), '#ffffff');
  else { faceRect(G, 'L', 0.06, 0.54, 20, 28, shade(col, 12)); faceRect(G, 'L', 0.12, 0.48, 23, 24, CHALET.dark); faceRect(G, 'L', 0.16, 0.44, 25, 26, CHALET.dark); }
}
function ipFlowerbed(b, night, season, th){
  const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, cv = b.y + b.h / 2, box = th === 'seaside' ? '#c9683f' : th === 'cloud' ? '#9a978f' : th === 'mountain' ? '#3a3234' : CHALET.wood;
  ibox(u0, cv - 0.22, u1 - u0, 0.44, 0, 8, box);
  poly3([[u0 + 0.05, cv - 0.17, 8], [u1 - 0.05, cv - 0.17, 8], [u1 - 0.05, cv + 0.17, 8], [u0 + 0.05, cv + 0.17, 8]], (x, y) => { const q = hash2(x, y, 405); return q > 0.85 ? '#7a5a3c' : q < 0.12 ? '#44301e' : '#5a3f28'; });
  const fire = th === 'mountain';                                               // 화산 — 사철 피는 불꽃 꽃(겨울에도 재 속에서 핀다)
  const cols = fire ? ['#ff5a1a', '#ffb02e', '#e8321e'] : season === 'winter' ? ['#e8f0f4', '#ffffff'] : th === 'seaside' ? ['#e8324a', '#ff9ec4', '#ffffff'] : ['#8f6ad8', '#6a8fe0', '#ffffff'];   // 불꽃 꽃 / 제라늄 / 붓꽃·수국
  for (let i = 0; i < 12; i++){
    const u = u0 + 0.12 + (i % 6) * (u1 - u0 - 0.24) / 5, v = cv - 0.08 + Math.floor(i / 6) * 0.16, q = isoP(u, v, 8), x = Math.round(q.x), y = Math.round(q.y);
    if (season === 'winter' && !fire){ px(x - 2, y - 3, 5, 3, '#eef4f8'); continue; }
    const c = cols[i % cols.length];
    if (fire){ px(x, y - 6, 1, 6, '#2e3a26'); px(x - 2, y - 10, 5, 4, c); px(x - 1, y - 13, 3, 3, c); px(x, y - 15, 1, 2, '#ffd84a'); px(x - 1, y - 9, 3, 2, '#ffe066'); continue; }   // 불꽃처럼 위로 뾰족
    px(x, y - 7, 1, 7, '#4f8f48'); px(x - 2, y - 4, 2, 2, '#5fa155');
    if (th === 'cloud' && i % 2) { px(x - 3, y - 11, 7, 5, c); px(x - 2, y - 12, 5, 1, shade(c, 30)); }   // 수국 송이
    else { px(x - 2, y - 10, 5, 4, c); px(x - 1, y - 9, 2, 2, shade(c, -30)); }
  }
}
function ipClothesPosts(b, night, season, th){
  const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, cv = b.y + b.h / 2, c = th === 'seaside' ? WHITEWASH : th === 'cloud' ? '#b9c46a' : CHALET.wood;
  ipost(u0, cv, 0, 34, c); ipost(u1, cv, 0, 34, c);
  isoSeg(isoP(u0, cv, 32), isoP(u1, cv, 32), '#6b5d4a', 1);
}
function ipClothesLive(b, t, L, season, th){
  const u0 = b.x + 0.15, u1 = b.x + b.w - 0.15, cv = b.y + b.h / 2;
  const cols = th === 'seaside' ? ['#ffffff', AEGEAN, '#bfe0f6'] : th === 'mountain' ? ['#5a4a44', '#8a3a22', '#6e6664'] : [WA.indigo, '#ffffff', '#f2a0b8'];   // 화산 — 그을린 헌 천 · 일본 — 쪽빛 유카타, 손수건, 벚꽃빛 유카타
  cols.forEach((c, i) => {
    const a = u0 + 0.22 + i * (u1 - u0 - 0.44) / 2, w = 0.3, h = 11 + (i % 2) * 4, sw = STILL ? 0 : Math.sin(t / (520 + i * 90) + i) * (0.05 + curWind * 0.03);
    poly3([[a - w / 2, cv, 31], [a + w / 2, cv, 31], [a + w / 2, cv + sw, 31 - h], [a - w / 2, cv + sw, 31 - h]], c);
    poly3([[a - w / 2, cv, 31], [a + w / 2, cv, 31], [a + w / 2, cv, 29], [a - w / 2, cv, 29]], shade(c, -20));
    if (th === 'mountain'){ const q = isoP(a + 0.06, cv + sw, 33 - h); px(Math.round(q.x), Math.round(q.y), 2, 2, '#1e1618'); px(Math.round(q.x) - 4, Math.round(q.y) - 4, 1, 3, '#2a2022'); }   // 탄 구멍과 해진 끝
    if (th === 'cloud' && i !== 1) for (let k = 0; k < 6; k++){ const q = isoP(a - w / 2 + 0.05 + (k % 3) * 0.1, cv + sw * 0.6, 28 - Math.floor(k / 3) * 5); px(Math.round(q.x), Math.round(q.y), 2, 2, i ? '#ffffff' : '#f2a0b8'); }   // 유카타 꽃무늬
  });
  if (th === 'cloud') [u0 + 0.08, u1 - 0.08].forEach((u, j) => { const q = isoP(u, cv, 31); teruteru(q.x, q.y + 2, STILL ? 0 : Math.sin(t / (640 + j * 120) + j) * (1 + curWind * 0.6)); });
}
function ipBirdhouse(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5, wall = th === 'seaside' ? WHITEWASH : th === 'cloud' ? '#a9794f' : CHALET.wood;
  ishadow(cu, cv, 0.14, 0.1);
  ipost(cu, cv, 0, 30, WOOD.dark, 0.07);
  ibox(cu - 0.13, cv - 0.13, 0.26, 0.26, 30, 42, wall);
  const G = { u0: cu - 0.13, u1: cu + 0.13, v0: cv - 0.13, v1: cv + 0.13 };
  { const q = faceMid(G, 'L', 0.13, 37); px(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4, '#2e241c'); }
  if (th === 'seaside') isoDome(cu, cv, 0.13, 42, AEGEAN);
  else islope(cu - 0.18, cu + 0.18, cv - 0.18, cv + 0.18, 49, 41, th === 'cloud' ? WA.tile : CHALET.roof);
  ibox(cu - 0.02, cv + 0.13, 0.04, 0.12, 33, 34, WOOD.dark);                         // 횃대
}
function ipBirdLive(b, t, L){
  const cyc = (t / 1000) % 20;
  if (cyc >= 12 || L.dark >= 0.5) return;
  const q = isoP(b.x + 0.5, b.y + 0.72, 35), hop = Math.sin(t / 260) > 0.6 ? 1 : 0, fl = Math.sin(t / 3000) > 0, bx = Math.round(q.x), by = Math.round(q.y) - 3 - hop;
  const crow = isoTheme() === 'mountain';                                       // 화산 섬엔 파랑새 대신 까마귀
  px(bx - 1, by + 1, 5, 3, crow ? '#1a1416' : '#5aa9e6'); px(bx + (fl ? -1 : 3), by, 3, 3, crow ? '#2a2226' : '#7dc2ea'); px(bx + (fl ? -2 : 5), by + 1, 1, 1, crow ? '#8a8284' : '#ffb347'); px(bx + (fl ? 4 : -1), by + 2, 2, 2, crow ? '#120e10' : '#4f8fc4');
  if (crow) px(bx + (fl ? 0 : 3), by, 1, 1, '#ff5a1a');                         // 붉은 눈
}
function ipFlagPole(b, night, season, th){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.12, 0.1);
  ibox(cu - 0.1, cv - 0.1, 0.2, 0.2, 0, 4, STONE.mid);
  if (th === 'cloud'){                                                          // 연 날리는 대 — 대나무 장대에 실패
    isoDrum(cu, cv, 0.035, 4, 46, '#a9c46a', '#c9d98a');
    const q = isoP(cu, cv, 20), x = Math.round(q.x), y = Math.round(q.y); px(x - 4, y - 3, 9, 6, '#8a6440'); px(x - 3, y - 2, 7, 4, '#f4efe6'); px(x - 4, y - 3, 9, 1, '#a9794f');
    return;
  }
  isoDrum(cu, cv, 0.03, 4, 60, '#d6d6d6', '#ffffff');
  { const q = isoP(cu, cv, 60); px(Math.round(q.x) - 1, Math.round(q.y) - 2, 3, 2, '#e8c94e'); }
}
// 깃발 — 그리스 국기, 스위스 국기. 일본은 연(잉어 깃발은 꽃구름 전용 꾸미개 「잉어 깃발」이 따로 있어 겹치지 않게 2026-10-07 바꿈)
function ipFlagLive(b, t, L, season, th){
  if (th === 'cloud') return kiteLive(b, t);
  const q0 = isoP(b.x + 0.5, b.y + 0.5, 58), X = Math.round(q0.x) + 1, Y = Math.round(q0.y);
  const [FW, FH] = th === 'seaside' ? [15, 9] : [12, 12];
  flagCloth(X, Y, FW, FH, t, (c, r) => FLAG_COL[th](c, r, FW, FH));
}
function ipWagon(b, night, season, th){
  const u0 = b.x + 0.18, u1 = b.x + b.w - 0.18, cv = b.y + b.h / 2, body = th === 'seaside' ? AEGEAN : th === 'cloud' ? '#9a7650' : th === 'mountain' ? '#4a2e24' : '#b5452f';
  ishadow((u0 + u1) / 2, cv, (u1 - u0) / 2 + 0.05, 0.26);
  ibox(u0, cv - 0.24, u1 - u0, 0.48, 9, 13, shade(body, -18));
  ibox(u0, cv - 0.24, u1 - u0, 0.06, 13, 22, body); ibox(u0, cv - 0.24, 0.06, 0.48, 13, 22, body);
  // 건너편 바퀴 둘 — 몸통보다 먼저 그려 몸통 뒤로 아래쪽만 보인다(한쪽에만 바퀴가 있어 보였다)
  const wheel = (Gf, a, rim, hub) => {
    for (let i = 0; i < 24; i++){ const an = i / 24 * Math.PI * 2, q = faceMid(Gf, 'L', a + Math.cos(an) * 0.17, 8 + Math.sin(an) * 8); px(Math.round(q.x), Math.round(q.y), 2, 2, rim); }
    const c = faceMid(Gf, 'L', a, 8); px(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 3, hub);
    for (let i = 0; i < 4; i++){ const an = i / 4 * Math.PI; isoSeg(faceMid(Gf, 'L', a + Math.cos(an) * 0.15, 8 + Math.sin(an) * 7), faceMid(Gf, 'L', a - Math.cos(an) * 0.15, 8 - Math.sin(an) * 7), shade(rim, 18), 1); }
  };
  const GB = { u0, u1, v0: cv - 0.3, v1: cv - 0.24 };
  [0.22, u1 - u0 - 0.22].forEach(a => { wheel(GB, a, shade(WOOD.dark, -14), '#48433d'); isoSeg(faceMid(GB, 'L', a, 8), isoP(u0 + a, cv + 0.24, 8), '#48433d', 1); });   // 굴대
  const load = th === 'mountain' ? 'ore' : th === 'cloud' ? 'rice' : season === 'autumn' ? 'pumpkin' : 'hay';
  if (load === 'ore') [[0.22, -0.06, 0.13], [0.5, 0.04, 0.15], [0.78, -0.04, 0.12], [0.36, 0.1, 0.1], [0.64, -0.1, 0.1]].forEach(([f, dv, r], i) => {   // 화산 — 금마다 용암이 비치는 마그마 광석
    const u = u0 + (u1 - u0) * f; boulder(u, cv + dv, r, 6 + (i % 3) * 2, '#2e2628', 13);
    const q = isoP(u, cv + dv + r * 0.6, 16 + (i % 2) * 2); px(Math.round(q.x) - 2, Math.round(q.y), 4, 1, '#ff6a1a'); px(Math.round(q.x), Math.round(q.y) - 1, 1, 3, '#ffd84a');
  });
  else if (load === 'rice') [0.3, 0.7].forEach(f => { const u = u0 + (u1 - u0) * f; isoDrum(u, cv, 0.16, 13, 26, '#d9c08a', '#e8d4a4'); const q = isoP(u, cv + 0.16, 19); px(Math.round(q.x) - 3, Math.round(q.y) - 5, 1, 10, '#7a6038'); px(Math.round(q.x) + 3, Math.round(q.y) - 5, 1, 10, '#7a6038'); });   // 쌀가마
  else if (load === 'pumpkin') [0.25, 0.55, 0.8].forEach((f, i) => { const u = u0 + (u1 - u0) * f; isoDrum(u, cv, 0.13, 13, 21, '#ff9a2e', '#ffb45c'); const q = isoP(u, cv, 21); px(Math.round(q.x), Math.round(q.y) - 3, 2, 3, '#4f8f48'); if (i) px(Math.round(q.x) - 4, Math.round(q.y) + 2, 1, 5, '#e07a1e'); });
  else ibox(u0 + 0.06, cv - 0.18, u1 - u0 - 0.1, 0.4, 13, 24, '#f2da8a', '#fbe8a8');
  ibox(u0, cv + 0.18, u1 - u0, 0.06, 13, 22, body); ibox(u1 - 0.06, cv - 0.24, 0.06, 0.48, 13, 22, body);
  const G = { u0, u1, v0: cv - 0.24, v1: cv + 0.24 };
  [16, 19].forEach(z => faceRect(G, 'L', 0.02, u1 - u0 - 0.02, z, z + 1, shade(body, -26)));        // 옆판 널 이음
  [0.04, u1 - u0 - 0.08].forEach(a => { faceRect(G, 'L', a, a + 0.04, 13, 22, shade(body, -34)); const q = faceMid(G, 'L', a + 0.02, 20); px(Math.round(q.x), Math.round(q.y), 1, 1, '#d9d9d9'); });   // 쇠 띠와 못
  [0.22, u1 - u0 - 0.22].forEach(a => wheel(G, a, WOOD.dark, '#5a544d'));       // 앞 바퀴 — 앞면에 선 둥근 테
  isoSeg(isoP(u0, cv, 11), isoP(u0 - 0.5, cv + 0.1, 4), WOOD.dark, 2);            // 끌채
}
const MILL_Z = 50;
function ipWindmill(b, night, season, th){
  if (th === 'cloud') return isoSuisha(b, night);
  const cu = b.x + b.w / 2, cv = b.y + b.h / 2;
  ishadow(cu, cv, 0.62, 0.58);
  if (th === 'seaside'){                                                        // 미코노스 풍차 — 흰 원통에 짚 원뿔 머리
    isoDrum(cu, cv, 0.52, 0, MILL_Z, WHITEWASH, '#efe9df'); icone(cu, cv, 0.56, MILL_Z, 14, '#9a7a50');
  } else if (th === 'mountain'){                                                // 화산 — 현무암을 켜켜이 쌓은 탑에 그을린 쇠 머리, 돌 틈마다 용암빛
    for (let k = 0; k < 5; k++) isoDrum(cu, cv, 0.54 - k * 0.04, k * 10, k * 10 + 10, k % 2 ? '#2a2226' : '#342a2e', '#463a40');
    for (let z = 3; z < MILL_Z - 2; z++){ const r = 0.54 - Math.floor(z / 10) * 0.04, q = isoP(cu - 0.32 + Math.sin(z * 0.7) * 0.04, cv + r * 0.8, z); if (hash2(z, 3, 620) > 0.3) px(Math.round(q.x), Math.round(q.y), 1, 1, z % 5 ? '#ff5a1a' : '#ffd84a'); }
    icone(cu, cv, 0.5, MILL_Z, 12, '#2f2f33');
  } else {
    isoDrum(cu, cv, 0.48, 0, 12, '#9a978f', '#b0ada3'); isoDrum(cu, cv, 0.44, 12, MILL_Z, WA.plaster, '#fbf8f2'); for (let z = 20; z < MILL_Z; z += 12) isoDrum(cu, cv, 0.45, z, z + 2, WA.post, WA.post);
    icone(cu, cv, 0.56, MILL_Z, 12, WA.tile);
  }
  const G = { u0: cu - 0.3, u1: cu + 0.3, v0: cv, v1: cv + 0.52 };
  const lava = th === 'mountain';
  isoArchDoor(G, 'L', 0.18, 0.24, 14, th === 'seaside' ? AEGEAN : lava ? '#1a1416' : '#3a2a1f', th === 'seaside' ? LIME : lava ? '#2f2f33' : WOOD.dark);
  faceRect(G, 'L', 0.24, 0.36, 30, 36, lava ? '#ff8a3a' : night ? '#ffd98a' : th === 'seaside' ? '#27405c' : '#3a3226');   // 화산은 안에서 불빛이 샌다
  if (night) nightGlow(cu, cv + 0.52, 33, 22, lava ? '#ff6a1a' : undefined);
}
function ipWindmillLive(b, t, L, season, th){
  if (th === 'cloud') return suishaLive(b, t);
  const cu = b.x + b.w / 2, cv = b.y + b.h / 2 + 0.62, ang = STILL ? 0.4 : t / (2600 / (0.6 + curWind * 0.55));
  const n = th === 'seaside' ? 8 : 4, R0 = 1.05;
  const P = (a, s2) => isoP(cu + Math.cos(a) * s2 * R0 * 0.5, cv, MILL_Z - 2 + Math.sin(a) * s2 * R0 * 22);
  for (let i = 0; i < n; i++){
    const a = ang + i * Math.PI * 2 / n;
    isoSeg(P(a, 0), P(a, 1), WOOD.dark, 1);
    if (th === 'seaside'){ const a2 = a + 0.32; polyFill([[P(a, 0.25).x, P(a, 0.25).y], [P(a, 1).x, P(a, 1).y], [P(a2, 0.8).x, P(a2, 0.8).y]], '#fbf8f2'); }   // 삼각 돛
    else for (let s2 = 0.35; s2 <= 1; s2 += 0.13){ const q = P(a, s2), c = th === 'cloud' ? (s2 > 0.9 ? '#e8453c' : '#f6efd9') : th === 'mountain' ? (s2 > 0.9 ? '#c8360e' : '#4a3a36') : '#f5efe0';
      if (th === 'mountain' && hash2(i, Math.round(s2 * 100), 621) > 0.75) continue;   // 화산 — 그을린 돛은 군데군데 타서 뚫렸다
      px(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4, c); px(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 1, WOOD.low); }
  }
  const h = P(0, 0); px(Math.round(h.x) - 2, Math.round(h.y) - 2, 5, 5, WOOD.dark); px(Math.round(h.x) - 1, Math.round(h.y) - 1, 2, 2, '#c4c4c4');
}
const ISO_PROP = {
  mail: ipMail, board: ipBoard, well: ipWell, hive: ipHive, pethouse: ipPethouse, scarecrow: ipScarecrow,
  lantern: ipLantern, bench: ipBench, swing: ipSwingFrame, arch: ipArch, sandbox: ipSandbox, firepit: ipFirepit,
  statue: ipStatue, sign: ipSign, flowerbed: ipFlowerbed, clothesline: ipClothesPosts, birdhouse: ipBirdhouse, flag: ipFlagPole, wagon: ipWagon, windmill: ipWindmill,
};
const ISO_PROP_LIVE = { lantern: ipBrazierLive, stall: ipStallFlagLive, fountain: ipFountainLive, statue: (b, t, L) => starLive(isoStarAt(b), t, L), swing: ipSwingLive, firepit: ipFireLive, clothesline: ipClothesLive, birdhouse: ipBirdLive, flag: ipFlagLive, windmill: ipWindmillLive };
// 둥근 돌덩이 — 도트 한 줄씩 좁혀 쌓고 위쪽은 밝게
// 돌 결 — 얼룩 알갱이가 흩어져 있고, 윗면 가장자리가 빛을 받는다
function boulder(cu, cv, r, h, c, z0){
  z0 = z0 || 0;
  for (let k = 0; k <= h; k++){
    const f = k / (h + 1), rr = r * Math.sqrt(1 - f * f), base = roundTex(cu, cv, rr, k > h * 0.6 ? shade(c, 14) : k < 2 ? shade(c, -16) : c);
    isoEllipse(cu, cv, rr, rr * 0.85, z0 + k, (x, y) => { const b = base(x), q = hash2(x, y, 23); return q > 0.93 ? shade(b, 12) : q < 0.06 ? shade(b, -16) : b; });
  }
  if (h > 5){ const q = isoP(cu - r * 0.3, cv - r * 0.1, z0 + h); px(Math.round(q.x) - 1, Math.round(q.y), 3, 1, shade(c, 34)); }
}
// 바위 — 나라마다 흰 석회암 / 회색 화강암 / 이끼 낀 검은 정원석. 캔 뒤에는 부스러기만.
function isoRock(N, ready, th){
  const cu = N.x + 0.5, cv = N.y + 0.55, c = th === 'seaside' ? '#e6e0d4' : th === 'cloud' ? '#6d6f6a' : th === 'mountain' ? '#3a3234' : STONE.mid;
  ishadow(cu, cv, 0.34, 0.26);
  if (!ready){ boulder(cu - 0.1, cv, 0.12, 4, shade(c, -8)); boulder(cu + 0.12, cv + 0.06, 0.08, 3, c); return; }
  boulder(cu - 0.06, cv - 0.04, 0.32, 17, c);
  boulder(cu + 0.2, cv + 0.16, 0.17, 8, shade(c, -6));
  [[-0.3, 0.2, 0.05], [0.36, -0.06, 0.04], [0.02, 0.36, 0.035]].forEach(([a, b, rr], i) => boulder(cu + a, cv + b, rr, 2, shade(c, -4 - i * 6)));   // 발치 자갈
  if (th === 'mountain'){                                                        // 화산 — 이끼 대신 몸을 가르는 용암 금, 발치엔 녹아 흐른 자국
    [[-0.2, 0.18, 3, 12, 6], [0.06, 0.3, 2, 8, 4], [0.18, 0.08, 4, 15, 5]].forEach(([a, b2, z0, z1, n]) => {
      for (let z = z0; z < z1; z++){ const q = isoP(cu + a + Math.sin(z * 0.9 + a * 9) * 0.03, cv + b2, z); px(Math.round(q.x), Math.round(q.y), 1, 1, z % n === 0 ? '#ffd84a' : '#ff5a1a'); }
    });
    isoEllipse(cu + 0.1, cv + 0.34, 0.12, 0.05, 0, '#c8360e'); isoEllipse(cu + 0.1, cv + 0.34, 0.06, 0.025, 0, '#ffb02e');
  } else if (th !== 'seaside'){                                                  // 이끼 — 윗면에 번지고 옆으로 흘러내린다
    const mc = th === 'cloud' ? ['#8fb85a', '#6f9a4a', '#4f7a38'] : ['#9ab07a', '#7f9a6a', '#5f7a52'];
    isoEllipse(cu - 0.1, cv - 0.08, 0.14, 0.11, 16, mc[1]); isoEllipse(cu - 0.13, cv - 0.1, 0.08, 0.06, 17, mc[0]);
    for (let i = 0; i < 7; i++){ const q = isoP(cu - 0.26 + i * 0.05, cv + 0.02 + i * 0.03, 13 - (i % 3) * 3); px(Math.round(q.x), Math.round(q.y), 2, 2 + (i % 2), mc[i % 3]); }
  }
  { const q = isoP(cu - 0.02, cv + 0.26, 10), x = Math.round(q.x), y = Math.round(q.y), k = shade(c, -34);   // 갈라진 금
    px(x, y - 5, 1, 3, k); px(x + 1, y - 2, 1, 3, k); px(x, y + 1, 1, 2, k); px(x - 1, y - 7, 1, 2, k); px(x - 2, y - 8, 1, 1, k); px(x + 1, y - 5, 1, 1, shade(c, 24)); }
}

// ---- 나라마다 사는 것들 — 그리스 고양이·갈매기, 스위스 산양·마멋, 일본 잉어·두루미. 구경거리일 뿐 규칙에는 없다 ----
function catSit(x, y, t, c){
  const d = shade(c, -26), s = !STILL && Math.sin(t / 520) > 0 ? 1 : 0;
  px(x - 3, y - 6, 7, 6, c); px(x - 2, y - 6, 1, 5, d); px(x + 1, y - 5, 1, 4, d);
  px(x - 4, y - 10, 6, 5, c); px(x - 4, y - 11, 1, 1, c); px(x + 1, y - 11, 1, 1, c);
  px(x - 3, y - 8, 1, 1, '#3a3226'); px(x, y - 8, 1, 1, '#3a3226'); px(x - 2, y - 7, 1, 1, '#e07a7a');
  px(x + 4, y - 2 - s, 3, 1, c); px(x + 6, y - 5 - s, 1, 3, c);
}
function catNap(x, y, t, c){
  const d = shade(c, -26);
  px(x - 5, y - 5, 10, 5, c); px(x - 3, y - 5, 1, 4, d); px(x, y - 5, 1, 4, d);
  px(x - 7, y - 6, 4, 4, c); px(x - 7, y - 7, 1, 1, c); px(x - 4, y - 7, 1, 1, c); px(x - 6, y - 4, 2, 1, '#3a3226');
  px(x - 4, y - 1, 9, 1, d);
  if (!STILL && (t / 1000) % 4 < 2){ px(x - 9, y - 12, 3, 1, '#9aa7b8'); px(x - 8, y - 11, 1, 1, '#9aa7b8'); px(x - 9, y - 10, 3, 1, '#9aa7b8'); }   // 쿨쿨
}
// 불도마뱀 — 검은 몸에 용암빛 점, 꼬리를 느릿느릿 흔들고 가끔 혀를 날름
function salamander(x, y, t){
  const sw = STILL ? 0 : Math.round(Math.sin(t / 600) * 2), lick = !STILL && (t / 1000) % 5 > 4.6, k = '#1e1416', o = '#ff6a1a';
  px(x - 6, y - 4, 12, 3, k); px(x - 5, y - 5, 9, 1, '#3a2a2c');
  px(x + 6, y - 5, 4, 3, k); px(x + 8, y - 5, 1, 1, '#ffd84a');                       // 머리와 눈
  if (lick) px(x + 10, y - 4, 3, 1, '#e8453c');
  px(x - 10, y - 3 + sw, 4, 2, k); px(x - 13, y - 3 + sw * 2, 3, 1, k);               // 꼬리
  [[-4, 0], [3, 0]].forEach(([dx]) => { px(x + dx, y - 1, 1, 2, k); px(x + dx + 1, y, 1, 1, k); });
  [-4, -1, 2].forEach(dx => px(x + dx, y - 4, 2, 1, o)); px(x - 8, y - 3 + sw, 1, 1, o);
}
// 땅 틈의 김 — 잿빛 연기가 뭉게뭉게 올라가다 흩어진다
function steamVent(x, y, t){
  px(x - 4, y - 1, 9, 2, '#140b0a'); px(x - 2, y - 1, 5, 1, '#ff6a1a'); px(x, y - 1, 1, 1, '#ffd84a');
  if (STILL) return;
  for (let i = 0; i < 4; i++){
    const ph = ((t / 1800) + i / 4) % 1, r = 2 + Math.round(ph * 5), yy = y - 4 - Math.round(ph * 30), xx = x + Math.round(Math.sin(ph * 5 + i) * 3);
    ctx.globalAlpha = 0.55 * (1 - ph); px(xx - r, yy - r, r * 2, r * 2, '#9a9294'); px(xx - r + 1, yy - r, r, 1, '#b8b0b2');
  }
  ctx.globalAlpha = 1;
}
function crane(x, y, t){
  const dip = !STILL && (t / 1000) % 8 > 6.4 ? 4 : 0, k = '#2b2f36';
  px(x - 1, y - 9, 1, 9, k); px(x + 2, y - 9, 1, 9, k);
  px(x - 4, y - 16, 9, 7, '#ffffff'); px(x - 4, y - 10, 9, 1, '#e6e8ec'); px(x + 3, y - 15, 4, 5, k);
  px(x - 5, y - 23 + dip, 2, 8, k); px(x - 7, y - 25 + dip, 4, 3, '#ffffff'); px(x - 6, y - 26 + dip, 2, 1, '#e8453c'); px(x - 10, y - 24 + dip, 3, 1, '#c9b07a');
}
function koi(x, y, dir, c, spot){ px(x - 3, y, 7, 2, c); px(x + (dir > 0 ? 3 : -4), y, 2, 2, c); px(x + (dir > 0 ? -5 : 4), y - 1, 2, 4, shade(c, -10)); px(x - 1, y, 2, 1, spot); }
function isoLife(cast, t, season, L){
  const th = isoTheme(), at = (u, v, z, fn) => cast.push({ d: u + v, go: () => { const q = isoP(u, v, z); fn(Math.round(q.x), Math.round(q.y)); } });
  if (th === 'seaside'){
    const h = spot('house');
    cast.push({ d: h.x + h.w / 2 + h.y + h.h / 2 + 0.01, go: () => { const q = isoP(h.x + 0.6, h.y + h.h - 0.45, 35); catSit(Math.round(q.x), Math.round(q.y), t, '#f2a65a'); } });   // 평지붕 난간에 앉은 고양이 at(h.x + h.w - 0.6, h.y + h.h + 0.3, 0, (x, y) => catNap(x, y, t, '#ece8e0'));   // 집 앞에서 조는 흰 고양이
  } else if (th === 'mountain'){
    const r2 = nodeOf('rock1'), ready = W && M ? R.nodeReady(W, M, 'rock1', now()) : true;   // rock2 는 화산 섬 온실 뒤에 가린다
    cast.push({ d: r2.x + r2.y + 1.05, go: () => { const q = isoP(r2.x + 0.45, r2.y + 0.5, ready ? 17 : 0); salamander(Math.round(q.x), Math.round(q.y), t); } });   // 바위 꼭대기 불도마뱀
    const r3 = nodeOf('rock3'); at(r3.x - 0.5, r3.y + 0.7, 0, (x, y) => steamVent(x, y, t));                             // 땅 틈에서 뿜는 김
  } else if (th === 'cloud'){
    if (here('pond') && season !== 'winter'){
      const b = spot('pond'), cu = b.x + b.w / 2, cv = b.y + b.h / 2;
      cast.push({ d: b.x + b.y + 1.02, go: () => [['#ff7a3a', '#ffffff'], ['#ffffff', '#e8453c'], ['#f2c230', '#ffffff']].forEach(([c, s2], i) => {
        const dir = i % 2 ? 1 : -1, a = (STILL ? 0 : t / 2600) * dir + i * 2.1, q = isoP(cu + Math.cos(a) * b.w * 0.24, cv + Math.sin(a) * b.h * 0.22, 0);
        koi(Math.round(q.x), Math.round(q.y), -Math.sin(a) * dir, c, s2);
      }) });
    }
    const t1 = nodeOf('tree1'); at(t1.x + 1.1, t1.y + 1.4, 0, (x, y) => crane(x, y, t));                           // 벚나무 아래 두루미
  }
}
// 하늘에 나는 것 — 그리스 갈매기, 일본 두루미 한 쌍
function isoSkyLife(t){
  const th = isoTheme(); if (STILL) return;
  if (th === 'mountain') return isoSkyLava(t);
  if (th !== 'seaside' && th !== 'cloud') return;
  const n = th === 'seaside' ? 3 : 2;
  for (let i = 0; i < n; i++){
    const sp = th === 'seaside' ? 38 : 70, x = Math.round(((t / sp + i * (th === 'seaside' ? 260 : 30)) % (ISO_W + 80)) - 40), y = Math.round((th === 'seaside' ? 70 + i * 26 : 110 + i * 10) + Math.sin(t / 700 + i) * 6);
    const up = Math.sin(t / (th === 'seaside' ? 180 : 320) + i) > 0 ? -1 : 1;
    if (th === 'seaside'){ px(x - 4, y + up, 4, 1, '#ffffff'); px(x, y + 1, 1, 1, '#ffffff'); px(x + 1, y + up, 4, 1, '#ffffff'); px(x - 4, y + up, 1, 1, '#9aa7b8'); px(x + 4, y + up, 1, 1, '#9aa7b8'); }
    else { px(x - 6, y + up, 5, 1, '#ffffff'); px(x - 7, y + up, 2, 1, '#2b2f36'); px(x + 2, y + up, 5, 1, '#ffffff'); px(x + 6, y + up, 2, 1, '#2b2f36'); px(x - 1, y, 3, 2, '#ffffff'); px(x + 2, y, 3, 1, '#2b2f36'); px(x - 4, y + 1, 3, 1, '#e8e4d8'); }
  }
}

// 꽃구름 섬 벚나무 자리 — 채집 나무 tree1·tree3 과 풍경 나무 중 짝이 아닌 것(isoNode 에서 벚나무로 그리는 것)
function cherryCrowns(){
  const out = [];
  ['tree1', 'tree3'].forEach(n => { if (R.NODES[n]){ const N = nodeOf(n); out.push([N.x + 0.5, N.y + 0.55]); } });
  R.sceneryOf(W).forEach((c, i) => { if (c.kind === 'tree' && i % 2 === 0) out.push([c.x + 0.5, c.y + 0.55]); });
  return out;
}
/* 흩날리는 벚꽃잎(2026-10-07 로키즈 「벚꽃나무에서 벚꽃이 계속 떨어져서」). 나무마다 꽃잎 여섯이 가지에서 떨어져
   바람 따라 흘러 땅에 닿고, 섬 위 하늘로도 바람에 실린 꽃잎이 가로지른다. 꽃잎은 뒤집히며 2×1 → 1×1 → 1×2 로 바뀐다. */
const PETAL = ['#ffd0e4', '#ffb7d5', '#fff0f6', '#f5a8cb'];
function petalPx(x, y, f, c){ if (f > 0.3) px(x, y, 2, 1, c); else if (f < -0.3) px(x, y, 1, 2, c); else px(x, y, 1, 1, shade(c, -24)); }
function isoPetals(t, season){
  if (isoTheme() !== 'cloud' || season === 'winter') return;
  const tt = STILL ? 4321 : t, wind = 0.5 + curWind * 0.35;
  cherryCrowns().forEach(([cu, cv], j) => {
    for (let i = 0; i < 6; i++){
      const s = j * 13 + i, P = 4200 + hash2(s, 1, 1601) * 3200, ph = (tt / P + hash2(s, 2, 1601)) % 1;
      const u = cu + (hash2(s, 3, 1601) - 0.5) * 0.9 + ph * wind, v = cv + (hash2(s, 4, 1601) - 0.5) * 0.9 - ph * 0.3, z = (20 + hash2(s, 5, 1601) * 16) * (1 - ph);
      const q = isoP(u, v, z);
      petalPx(Math.round(q.x + Math.sin(tt / 380 + s) * 3), Math.round(q.y), Math.sin(tt / 150 + s * 1.7), PETAL[s % 4]);
    }
  });
  for (let i = 0; i < 44; i++){
    const P = 9000 + hash2(i, 1, 1602) * 7000, ph = (tt / P + hash2(i, 2, 1602)) % 1;
    const x = ph * (ISO_W + 60) - 30, y = hash2(i, 3, 1602) * ISO_H * 0.8 + ph * 50 + Math.sin(tt / 900 + i) * 9;
    petalPx(Math.round(x), Math.round(y), Math.sin(tt / 170 + i * 2.3), PETAL[i % 4]);
  }
}
/* 꽃구름 섬 고가 철도를 지나는 열차(2026-10-07 로키즈 「현대의 일본 모습 — 일본의 철도가 지나가는」).
   30초마다: 흰 몸에 파란 줄 신칸센이 왼쪽 위에서 오른쪽 아래로 휙(7초) → 은빛 몸에 연두 줄 전철이 거꾸로 천천히(12초).
   멈춘 그림(STILL)에선 신칸센이 후지산 앞을 지나는 자리. 섬보다 뒤라 건물·나무보다 먼저 그린다. */
function isoTrain(t, L){
  const p = STILL ? 2600 : t % 30000;
  let kind, head;
  if (p < 7000){ kind = 'n700'; head = -6 + p / 7000 * (COLS + 30); }
  else if (p >= 14000 && p < 26000){ kind = 'local'; head = COLS + 4 - (p - 14000) / 12000 * (COLS + 30); }
  else return;
  const night = !!(L && L.lamp), n = kind === 'n700' ? 6 : 4, cl = kind === 'n700' ? 2.3 : 2.0, gap = 0.07;
  const tail = kind === 'n700' ? head - n * cl : head;                                       // 신칸센은 +u 로, 전철은 -u 로 간다
  for (let i = 0; i < n; i++){
    const ua = tail + i * cl, ub = ua + cl - gap;
    if (ub < -8 || ua > COLS + 4) continue;
    trainCar(ua, ub, kind, night, kind === 'n700' && i === 0, kind === 'n700' && i === n - 1, i % 2 === 1, kind === 'local' && i === n - 1);
    if (i < n - 1) isoCube(ub, RAIL_V - 0.15, gap, 0.3, RAIL_Z + 3, RAIL_Z + 12, '#4a4f58', '#3a3f48', '#2e333a');   // 이음 덮개
  }
}
function trainCar(ua, ub, kind, night, noseA, noseB, panto, tailEnd){
  const v = RAIL_V, z0 = RAIL_Z + 2, H = 12, NL = 1.3, fast = kind === 'n700';
  const C = fast ? { roof: '#d9dde2', side: '#f2f4f6', end: '#c9ced4', band: '#1f4fa8' } : { roof: '#aeb4bc', side: '#dfe3e8', end: '#b8bec6', band: '#3fae4a' };
  const win = night ? '#ffeeb0' : '#323a48', w0 = 0.22;
  const side = (a, b, vf, za, zb, col) => poly3([[a, vf, za], [b, vf, za], [b, vf, zb], [a, vf, zb]], col);
  const ba = noseA ? ua + NL : ua, bb = noseB ? ub - NL : ub;
  const nose = (a, b, dir) => {                                                              // 코 — 얇게 썰어 높이·폭을 줄여 간다(뒤에서 앞으로 그려야 겹침이 맞다)
    for (let u = a; u < b - 1e-6; u += 0.1){
      const du = Math.min(0.1, b - u), m = u + du / 2, f = dir > 0 ? (m - a) / NL : 1 - (m - a) / NL;
      const hz = Math.max(3, Math.round(H * Math.sqrt(Math.max(0, 1 - f * f * 0.92)))), w = w0 * (1 - 0.45 * f * f), cab = f > 0.18 && f < 0.42;
      isoCube(u, v - w, du, w * 2, z0, z0 + hz, cab ? '#2b3340' : C.roof, C.side, C.end);
      if (hz > 4) side(u, u + du, v + w, z0 + 2, z0 + 3, C.band);
      if (f > 0.86) side(u, u + du, v + w, z0 + 1, z0 + 2, night ? '#fffbe0' : '#f4f0d0');   // 앞등
    }
  };
  if (noseA) nose(ua, ba, -1);
  isoCube(ba, v - w0, bb - ba, w0 * 2, z0, z0 + H, C.roof, C.side, C.end);
  side(ba, bb, v + w0, z0 - 1, z0 + 1, '#3a3a3e');                                           // 대차
  side(ba + 0.12, bb - 0.12, v + w0, z0 + 6, z0 + 9, win);                                   // 창 띠
  for (let u = ba + 0.3; u < bb - 0.12; u += fast ? 0.16 : 0.42) side(u, u + 0.03, v + w0, z0 + 6, z0 + 9, C.side);   // 창틀
  side(ba, bb, v + w0, fast ? z0 + 3 : z0 + 10, fast ? z0 + 5 : z0 + 11, C.band);           // 줄 — 신칸센은 창 아래 파란 줄, 전철은 창 위 연두 줄
  if (!fast) side(ba, bb, v + w0, z0 + 2, z0 + 3, C.band);
  [ba + 0.2, bb - 0.36].forEach(u => side(u, u + 0.16, v + w0, z0 + 1, z0 + 10, fast ? '#d4d8de' : '#8a929c'));   // 문
  if (tailEnd){                                                                              // 전철 뒤끝 — 검은 얼굴에 창, 밤엔 붉은 꼬리등
    poly3([[ub, v - 0.18, z0 + 5], [ub, v + 0.18, z0 + 5], [ub, v + 0.18, z0 + 11], [ub, v - 0.18, z0 + 11]], '#22262c');
    poly3([[ub, v - 0.14, z0 + 7], [ub, v + 0.14, z0 + 7], [ub, v + 0.14, z0 + 10], [ub, v - 0.14, z0 + 10]], win);
    [-0.15, 0.13].forEach(o => poly3([[ub, v + o, z0 + 3], [ub, v + o + 0.04, z0 + 3], [ub, v + o + 0.04, z0 + 4], [ub, v + o, z0 + 4]], night ? '#ff5040' : '#a8302a'));
  }
  if (noseB) nose(bb, ub, 1);
  if (panto){                                                                                // 팬터그래프 — 지붕에서 전차선까지 마름모
    const m = (ba + bb) / 2, top = RAIL_Z + 27;
    isoSeg(isoP(m - 0.2, v, z0 + H), isoP(m, v, top - 6), '#5a5f68', 1); isoSeg(isoP(m, v, top - 6), isoP(m - 0.15, v, top), '#5a5f68', 1);
    isoSeg(isoP(m - 0.3, v, top), isoP(m + 0.05, v, top), '#3a3f48', 1);
  }
}
// 화산 하늘 — 분화 기둥 둘레를 맴도는 까마귀 셋, 먼 하늘을 천천히 가로지르는 용 한 마리
function isoSkyLava(t){
  const V = VOLCS[0];
  for (let i = 0; i < 3; i++){
    const a = t / 2600 + i * 2.1, x = Math.round(V.x - 30 + Math.cos(a) * (70 + i * 14)), y = Math.round(V.top + 24 + Math.sin(a) * 18 + i * 6);
    const up = Math.sin(t / 150 + i * 2) > 0 ? -1 : 1, k = '#0e0a0c';
    px(x - 1, y, 3, 2, k); px(x - 5, y + up, 4, 1, k); px(x + 2, y + up, 4, 1, k); px(x - 6, y + up * 2, 1, 1, k); px(x + 6, y + up * 2, 1, 1, k); px(x + 2, y + 1, 2, 1, k);
  }
  const dx = Math.round(((t / 90) % (ISO_W + 200)) - 100), dy = 62 + Math.round(Math.sin(t / 1400) * 8), fl = Math.sin(t / 260), k = '#160e10';   // 용 — 날개를 크게 젓는다
  px(dx - 8, dy, 16, 3, k); px(dx + 8, dy - 2, 5, 3, k); px(dx + 12, dy - 1, 3, 1, k); px(dx + 10, dy - 3, 1, 1, '#ff6a1a');   // 몸·머리·뿔 사이 눈빛
  px(dx - 14, dy + 1, 6, 1, k); px(dx - 18, dy + 2 + Math.round(fl), 4, 1, k);                                              // 꼬리
  const wy = Math.round(fl * 7);
  for (let j = 0; j < 8; j++){ px(dx - 4 + j, dy - 1 - Math.round(wy * (j < 4 ? j / 4 : (8 - j) / 4)) - (j > 1 && j < 6 ? 2 : 0), 1, 2, k); }
  px(dx - 6, dy - 1 - wy, 3, 1, k); px(dx + 3, dy - 1 - wy, 3, 1, k);
}
/* 화산 섬의 움직이는 먼 풍경 — 건물·나무보다 먼저 그린다(뒤에 있으니까).
   화산 줄기와 분화구는 섬 뒤 가장자리 위에서만, 용암 폭포는 절벽 위에서, 용암 바다 거품은 섬 밖에서만.
   밤 불빛(lamps)은 자리가 늘 같아야 빛 겹이 새로 구워지지 않는다 — 깜빡임은 그림으로만 한다. */
function isoLavaBack(t){
  const K = isoLook();
  VOLCS.forEach((V, vi) => {
    lamp(V.x, V.top, V.erupt ? 80 : 36, '#ff5a1a');
    if (STILL) return;
    V.flows.forEach((fl, k) => {                                               // 줄기를 타고 내려가는 뜨거운 덩이
      const y1 = V.top + Math.round(V.h * (V.erupt ? 0.86 : 0.7));
      for (let j = 0; j < 3; j++){
        const y = Math.round(V.top + 2 + (((t / 5200) + j / 3 + k * 0.29) % 1) * (y1 - V.top - 2)), x = Math.round(volcFlowX(V, fl, y));
        if (y < isoBackEdgeY(x) && y < K.horizon) px(x, y, 3, 3, '#ffe066');
      }
    });
    const boil = Math.sin(t / 240 + vi) > 0;                                   // 분화구가 끓어 번쩍인다
    px(V.x - V.cr + 4, V.top, V.cr * 2 - 8, 2, boil ? '#ffe066' : '#ff8a1a');
    if (V.erupt) for (let i = 0; i < 9; i++){                                  // 솟구쳤다 떨어지는 용암 덩이
      const ph = ((t / 2400) + i / 9) % 1, vx = (hash2(i, Math.floor(t / 2400 + i / 9), 980) - 0.5) * 120, h2 = 40 + hash2(i, 2, 981) * 50;
      const x = Math.round(V.x + vx * ph), y = Math.round(V.top - 4 - Math.sin(ph * Math.PI) * h2 + ph * ph * 50);
      if (y < isoBackEdgeY(x) && y < K.horizon){ px(x, y, 2, 2, ph < 0.6 ? '#ffd84a' : '#ff5a1a'); if (ph < 0.7) px(x - Math.sign(vx), y + 2, 1, 2, '#c8360e'); }
    }
  });
  lavaFalls().forEach((f, i) => {
    const x = Math.round(f.x) - 3, y0 = Math.round(f.y);
    lamp(f.x, y0 + K.deep - 4, 30, '#ff6a1a');
    if (STILL) return;
    for (let j = 0; j < 4; j++){ const y = y0 + Math.round((((t / 900) + j / 4 + i * 0.13) % 1) * (K.deep - 4)); px(x + Math.round(Math.sin(y / 5 + f.x) * 0.8), y, 6, 4, '#ffe066'); }   // 쏟아지는 덩이
    const sp = (t / 260 + i) % 1; px(x - 4 + Math.round(sp * 4), y0 + K.deep - 6 - Math.round(Math.sin(sp * Math.PI) * 6), 2, 2, '#ffd84a'); px(x + 8 - Math.round(sp * 4), y0 + K.deep - 5 - Math.round(Math.sin(sp * Math.PI) * 5), 2, 2, '#ff8a1a');
  });
  [[70, 520], [210, 590], [640, 560], [790, 470], [420, 600]].forEach(([x, y]) => { if (y < ISO_H) lamp(x, y, 70, '#ff4a12'); });   // 용암 바다가 밤에 붉게 달아 있다
  if (STILL) return;
  const inIsle = g => g.u >= -0.3 && g.v >= -0.3 && g.u <= COLS + 0.3 && g.v <= ROWS + 0.3;
  for (let i = 0; i < 18; i++){                                                // 용암 바다에서 부글부글 터지는 거품
    const p = t / 1300 + R.prand('lb' + i), cyc = Math.floor(p), ph = p - cyc;
    const x = Math.floor(R.prand('lbx' + i + '|' + cyc) * ISO_W), y = K.horizon + 10 + Math.floor(R.prand('lby' + i + '|' + cyc) * (ISO_H - K.horizon - 12));
    if (inIsle(isoTileAt(x, y)) || inIsle(isoTileAt(x, y - K.deep))) continue;
    const r = 1 + Math.round(Math.sin(ph * Math.PI) * 3);
    if (ph < 0.75){ px(x - r, y - r + 1, r * 2, r, '#ff8a1a'); px(x - r + 1, y - r + 1, Math.max(1, r - 1), 1, '#ffe066'); }
    else { px(x - 4, y, 2, 1, '#ffd84a'); px(x + 3, y - 1, 2, 1, '#ffd84a'); px(x, y - 3, 1, 1, '#ff8a1a'); }
  }
}
/* 화산 섬의 밤 — 푸른 밤빛을 덮으면 용암까지 죽어 보였다. 밤이 깊을수록 검붉은 빛으로 덮고 조금 덜 어둡게 해서
   용암·불씨가 밤에 더 무섭게 빛난다. 낮(dark 0)에는 그대로다. */
function lavaNight(L){
  const k = Math.min(1, L.dark / 0.5);
  return Object.assign({}, L, { dark: L.dark * (1 - 0.18 * k), tint: mix(L.tint, '#6a2a22', 0.7 * k), lift: mix(L.lift, '#1e0604', 0.7 * k) });
}
// 화산 섬 앞겹 — 하늘에서 내리는 재, 아래 용암에서 솟는 불티. 섬 위 모든 것 앞을 지나간다.
function isoLavaFront(t){
  if (STILL) return;
  for (let i = 0; i < 46; i++){
    const sp = 0.6 + hash2(i, 1, 990) * 0.8, ph = ((t / 16000) * sp + hash2(i, 2, 991)) % 1;
    const x = Math.round((hash2(i, 3, 992) * ISO_W + ph * 90 + Math.sin(t / 900 + i) * 6) % ISO_W), y = Math.round(ph * ISO_H);
    px(x, y, i % 4 ? 1 : 2, 1, i % 3 ? '#8a8284' : '#5a5254');
  }
  for (let i = 0; i < 26; i++){
    const sp = 0.7 + hash2(i, 4, 993) * 0.8, ph = ((t / 7000) * sp + hash2(i, 5, 994)) % 1;
    const x = Math.round(hash2(i, 6, 995) * ISO_W + Math.sin(t / 400 + i * 3) * 4), y = Math.round(ISO_H - ph * ISO_H * 0.75);
    if (Math.sin(t / 90 + i * 7) < -0.6) continue;                               // 깜빡
    ctx.globalAlpha = 1 - ph; px(x, y, 1, 1, ph < 0.4 ? '#ffd84a' : '#ff6a1a'); ctx.globalAlpha = 1;
  }
}

// ---- 섬의 나무·덤불·눈사람·별 동상도 아이소로(2026-09-28 로키즈) ----
// 잎 덩이 — 가로 원을 한 도트씩 쌓아 위아래가 둥근 덩이를 만든다. 위·왼쪽이 밝고 아래·오른쪽이 어둡다. 잎 결은 흩뿌림.
// cols: [가장 밝은, 밝은, 가운데, 어두운]
function ifoliage(cu, cv, r, z0, h, cols, seed, lumpy){
  const n = cols.length - 1, cl = i => cols[Math.max(0, Math.min(n, i))];
  // 덩이 하나 — bias 는 덩이가 놓인 자리(오른쪽이면 어둡게, 왼쪽 위면 밝게)
  const ball = (bu, bv, br, bz, bh, bias) => {
    const cx = isoP(bu, bv).x, w = br * IT / 2;
    for (let k = 0; k <= bh; k++){
      const f = (k - bh / 2) / (bh / 2 + 0.5), rr = br * Math.sqrt(Math.max(0, 1 - f * f));
      if (rr < 0.02) continue;
      const band = k > bh * 0.66 ? 0 : k > bh * 0.4 ? 1 : k > bh * 0.15 ? 2 : 3;
      isoEllipse(bu, bv, rr, rr, bz + k, (x, y) => {
        let i = band + bias + (x > cx + w * 0.3 ? 1 : x < cx - w * 0.45 ? -1 : 0);
        // 잎 송이 — 비늘처럼 엇갈린 작은 송이. 송이 아래 끝은 그늘, 위 끝은 빛.
        if (lumpy !== false){
          const ry = Math.floor(y / 4), ox = x + (ry & 1) * 3 + Math.floor(hash2(ry, 3, seed) * 6), lx = ((ox % 6) + 6) % 6, ly = ((y % 4) + 4) % 4;
          if (ly === 3 && lx !== 0) i += 1;
          else if (ly === 0 && lx >= 2 && lx <= 4 && band < 2) i -= 1;
        }
        const q = hash2(x >> 1, y >> 1, seed);
        if (q > 0.9) i -= 1; else if (q < 0.06) i += 1;
        return cl(i);
      });
    }
  };
  // 겉에 붙은 작은 덩이 — 실루엣이 울퉁불퉁해진다. 뒤쪽 것은 몸통보다 먼저, 앞쪽 것은 나중에.
  const lumps = [];
  if (lumpy !== false && r > 0.15) for (let i = 0; i < 9; i++){
    const a = i / 9 * Math.PI * 2 + hash2(i, 7, seed) * 0.6, el = (hash2(i, 8, seed) - 0.3) * 1.1;
    const d = r * Math.cos(el) * 0.9, lr = r * (0.3 + hash2(i, 9, seed) * 0.12), lh = Math.max(3, Math.round(h * lr / r)), lz = z0 + h / 2 + Math.sin(el) * h * 0.42 - lh / 2;
    const du = Math.cos(a) * d, dv = Math.sin(a) * d, sx = (du - dv) / (r * 2);
    lumps.push({ u: cu + du, v: cv + dv, r: lr, z: Math.round(lz), h: lh, dep: du + dv, bias: (sx > 0.25 ? 1 : sx < -0.25 && el > 0 ? -1 : 0) + (el < -0.1 ? 1 : 0) });
  }
  lumps.filter(l => l.dep < 0).forEach(l => ball(l.u, l.v, l.r, l.z, l.h, l.bias));
  ball(cu, cv, r, z0, h, 0);
  lumps.filter(l => l.dep >= 0).forEach(l => ball(l.u, l.v, l.r, l.z, l.h, l.bias));
}
// 잎 원뿔 한 켜 — 전나무 층. 겨울엔 윗면 가장자리에 눈.
function iconeLeaf(cu, cv, r, z0, h, cols, seed, snow){
  const cx = isoP(cu, cv).x;
  for (let k = 0; k <= h; k++){
    const rr = r * (1 - k / (h + 1)), w = rr * IT / 2;
    isoEllipse(cu, cv, rr, rr, z0 + k, (x, y) => {
      if (k < 2 && hash2(x >> 1, k, seed + 5) > 0.62) return null;              // 가지 끝이 처져 아랫단이 들쭉날쭉
      if (snow && k > h * 0.25 && hash2(x >> 1, y, seed) > 0.55) return '#f6fafc';
      let i = (k < 3 ? 2 : 1) + (x > cx + w * 0.3 ? 1 : x < cx - w * 0.4 ? -1 : 0);
      if ((((x - cx) * (x < cx ? -1 : 1) + Math.floor(k * 0.7)) % 5 + 5) % 5 === 0 && k > 2) i += 1;   // 가지마다 바늘잎 결
      if (hash2(x >> 1, y >> 1, seed) > 0.88) i -= 1;
      return cols[Math.max(0, Math.min(cols.length - 1, i))];
    });
  }
}
// 줄기 — 아래가 조금 벌어지고, 세로 껍질 결과 뿌리 셋
function itrunk(cu, cv, r, z1, bark){
  [0.6, 2.4, 4.3].forEach((a, i) => isoSeg(isoP(cu, cv, 3), isoP(cu + Math.cos(a) * r * 2.4, cv + Math.sin(a) * r * 2.4, 0), i % 2 ? shade(bark, -12) : bark, 2));
  for (let z = 0; z < z1; z++){
    const rr = r * (1 + Math.max(0, 4 - z) * 0.14), base = roundTex(cu, cv, rr, z === 0 ? shade(bark, -18) : bark);
    isoEllipse(cu, cv, rr, rr, z, (x, y) => {
      const c = base(x);
      if ((((x + (hash2(x, Math.floor(y / 5), 17) > 0.6 ? 1 : 0)) % 3) + 3) % 3 === 0) return shade(c, -16);
      return hash2(x, y, 19) > 0.94 ? shade(c, 14) : c;
    });
  }
  isoEllipse(cu, cv, r, r, z1, shade(bark, 12));
}
function istump(cu, cv, bark){ isoDrum(cu, cv, 0.12, 0, 6, bark, '#e0c49a'); isoEllipse(cu, cv, 0.06, 0.06, 6, shade(bark, -10)); }
// 흩뿌린 점(꽃·열매·눈) — 잎 덩이 윗쪽 겉면 둘레에
function idots(cu, cv, r, z, n, col, seed, sz){
  for (let i = 0; i < n; i++){
    const a = hash2(i, 1, seed) * Math.PI * 2, d = Math.sqrt(hash2(i, 2, seed)) * r * 0.85, q = isoP(cu + Math.cos(a) * d, cv + Math.sin(a) * d, z + hash2(i, 3, seed) * 6);
    px(Math.round(q.x), Math.round(q.y), sz || 2, sz || 2, col);
  }
}
// 겨울 벌거숭이 가지
function ibare(cu, cv, z, bark, seed){
  for (let i = 0; i < 6; i++){
    const a = i / 6 * Math.PI * 2 + hash2(i, 1, seed), l = 0.28 + hash2(i, 2, seed) * 0.16, zt = z + 10 + hash2(i, 3, seed) * 14;
    const p0 = isoP(cu, cv, z), p1 = isoP(cu + Math.cos(a) * l, cv + Math.sin(a) * l, zt);
    isoSeg(p0, p1, bark, 2); px(Math.round(p1.x) - 1, Math.round(p1.y) - 1, 3, 2, '#f6fafc');
  }
}
const LEAF = {
  olive:   ['#c8d2ae', '#a3b18a', '#7d8e64', '#5a6a48'],
  cypress: ['#6f9a60', '#4f7d4a', '#3a6238', '#284828'],
  fir:     ['#6aa27a', '#3f7a52', '#2a5a3e', '#1f4630'],
  cherry:  ['#fff0f6', '#ffd0e4', '#f5a8cb', '#d47aa6'],
  maple:   { spring: ['#f6c29a', '#f0a07a', '#d9704f', '#a8503a'], summer: ['#b8e88a', '#8ccf6a', '#5fae4a', '#3f8238'], autumn: ['#ffa07a', '#ff6a4a', '#e0402c', '#a82620'] },
};
function isoTree(n, N, ready, season, th){
  const cu = N.x + 0.5, cv = N.y + 0.55, pair = n === 'tree2' || n === 'tree4', winter = season === 'winter';
  ishadow(cu, cv, 0.56, 0.44);
  const bark = th === 'seaside' ? '#8a7560' : th === 'cloud' ? '#6b4a3a' : WOOD.dark;
  if (!ready) return istump(cu, cv, bark);
  if (th === 'mountain') return isoDeadTree(cu, cv, pair, winter);
  if (th === 'seaside' && pair){                                                // 사이프러스 — 가늘고 높은 불꽃 모양
    itrunk(cu, cv, 0.06, 8, bark);
    const H = 82;
    for (let k = 0; k <= H; k++){
      const f = k / H, rr = 0.3 * Math.sin(Math.PI * Math.pow(Math.max(0.02, f), 0.62)), cx = isoP(cu, cv).x, w = rr * IT / 2;
      isoEllipse(cu, cv, rr, rr, 6 + k, (x, y) => { let i = f > 0.7 ? 0 : 1; if (x > cx + w * 0.3) i += 1; if (x < cx - w * 0.4) i -= 1; if (hash2(x >> 1, y >> 1, 81) > 0.8) i += 1; if ((((x + (k >> 2)) % 4) + 4) % 4 === 0 && k % 6 < 4) i += 1; if (Math.abs(x - cx) > w - 1 && hash2(x, k >> 1, 82) > 0.55) return null; return LEAF.cypress[Math.max(0, Math.min(3, i))]; });   // 불꽃처럼 위로 흐르는 결, 가장자리는 삐죽
    }
    if (winter) idots(cu, cv, 0.18, 40, 8, '#f6fafc', 83, 3);
    return;
  }
  if (th === 'seaside'){                                                        // 올리브 — 꼬인 줄기 둘, 넓게 퍼진 은빛 잎
    isoDrum(cu - 0.06, cv, 0.08, 0, 24, bark, shade(bark, 12)); isoDrum(cu + 0.07, cv + 0.03, 0.07, 0, 18, shade(bark, -12), bark);
    isoSeg(isoP(cu, cv, 18), isoP(cu - 0.32, cv + 0.06, 30), bark, 3); isoSeg(isoP(cu, cv, 18), isoP(cu + 0.28, cv - 0.18, 30), bark, 3);
    [[-0.32, 0.05, 0.36, 24], [0, 0, 0.46, 30], [0.28, -0.2, 0.34, 26], [0.1, 0.26, 0.3, 22]].forEach(([du, dv, r, z], i) => ifoliage(cu + du, cv + dv, r, z, 18, LEAF.olive, 90 + i));
    const fruit = season === 'summer' ? '#9aa844' : season === 'spring' ? null : '#3b2f45';
    if (fruit) idots(cu, cv, 0.5, 36, 9, fruit, 95, 2);
    if (winter) idots(cu, cv, 0.35, 36, 10, '#f6fafc', 96, 3);
    return;
  }
  // 일본(그 밖) — 벚나무·단풍나무. 겨울엔 벌거숭이 가지에 눈.
  itrunk(cu, cv, 0.1, 30, bark);
  isoSeg(isoP(cu, cv, 22), isoP(cu - 0.3, cv + 0.12, 34), bark, 3); isoSeg(isoP(cu, cv, 24), isoP(cu + 0.26, cv - 0.16, 36), bark, 3);
  if (winter) return ibare(cu, cv, 30, bark, pair ? 101 : 102);
  // 꽃구름 섬 벚나무는 겨울만 빼고 늘 만개 — 꽃잎이 쉬지 않고 진다(2026-10-07 로키즈). 단풍나무는 철 따라.
  const cols = pair ? LEAF.maple[season] : LEAF.cherry;
  [[-0.3, 0.12, 0.38, 28], [0.28, -0.18, 0.38, 30], [0, 0, 0.54, 32], [0.16, 0.28, 0.32, 26]].forEach(([du, dv, r, z], i) => ifoliage(cu + du, cv + dv, r, z, 26, cols, 110 + i + (pair ? 10 : 0)));
  if (!pair){ idots(cu, cv, 0.55, 50, 16, '#ffffff', 121, 2); idots(cu, cv, 0.5, 40, 12, '#ff9ec4', 122, 2); }   // 벚꽃 흰 점·짙은 꽃술
}
/* 화산 섬 나무 — 잎 하나 없이 불타 죽은 고목. 검게 그을린 줄기가 비틀려 올라가 가지가 갈퀴처럼 뻗고,
   껍질 틈으로 아직 꺼지지 않은 불씨가 비친다. 짝 나무는 꺾여 키가 낮고 더 굽었다. 겨울엔 가지에 재가 앉는다. */
function isoDeadTree(cu, cv, pair, winter){
  const bark = '#2a2022', H = pair ? 26 : 38, seed = pair ? 171 : 172;
  itrunk(cu, cv, pair ? 0.1 : 0.08, H, bark);
  for (let z = 4; z < H - 2; z += 3) if (hash2(z, seed, 173) > 0.55){            // 줄기의 불씨 틈
    const q = isoP(cu - 0.04 + hash2(z, 1, seed) * 0.08, cv + 0.08, z); px(Math.round(q.x), Math.round(q.y), 1, 2, z % 2 ? '#ff5a1a' : '#ffb02e');
  }
  const twig = (p0, a, l, zt, w, d) => {
    const p1 = { x: p0.x + Math.cos(a) * l, y: p0.y - zt };
    isoSeg(p0, p1, d ? '#3a2e30' : bark, w);
    if (winter) px(Math.round(p1.x) - 1, Math.round(p1.y) - 1, 3, 1, '#8a8284');
    if (d < 2) for (let k = 0; k < 2; k++) twig(p1, a + (k ? 0.55 : -0.6) + (hash2(d, k, seed) - 0.5) * 0.4, l * 0.55, zt * 0.6, Math.max(1, w - 1), d + 1);
  };
  const n = pair ? 4 : 5;
  for (let i = 0; i < n; i++){
    const z = H - 10 + Math.round(hash2(i, 1, seed) * 10), a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4 + (hash2(i, 2, seed) - 0.5) * 0.3;
    twig(isoP(cu, cv, z), a, 10 + hash2(i, 3, seed) * 8, 8 + hash2(i, 4, seed) * 10, 2, 0);
  }
  if (pair){ const q = isoP(cu, cv, H); px(Math.round(q.x) - 3, Math.round(q.y) - 1, 6, 2, '#ff6a1a'); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 1, '#ffd84a'); }   // 꺾인 끝이 아직 탄다
}
function isoBush(n, N, ready, season, th){
  if (N.season.indexOf(season) < 0) return;
  const cu = N.x + 0.5, cv = N.y + 0.55;
  ishadow(cu, cv, 0.34, 0.28);
  if (th === 'seaside'){                                                        // 라벤더 — 낮은 은빛 덤불에 보라 꽃대
    ifoliage(cu, cv, 0.4, 0, 14, ['#c9d2b6', '#adb99a', '#8e9c7c', '#66735a'], 131);
    for (let i = 0; i < 22; i++){ const a = hash2(i, 1, 132) * Math.PI * 2, d = Math.sqrt(hash2(i, 2, 132)) * 0.32, q = isoP(cu + Math.cos(a) * d, cv + Math.sin(a) * d, 12), h = 6 + (i % 3) * 3; px(Math.round(q.x), Math.round(q.y) - h, 2, h, '#9a6fd0'); px(Math.round(q.x), Math.round(q.y) - h, 1, 2, '#c9a8ff'); }
  } else {
    const cols = th === 'cloud' ? ['#8fcf7a', '#5a9a52', '#3f6f3c', '#2b5028'] : ['#6e5e50', '#54463c', '#3c322c', '#28201e'];   // 철쭉(둥글게 깎음) / 화산 마른 가시덤불
    ifoliage(cu, cv, 0.42, 0, th === 'cloud' ? 18 : 16, cols, 133);
    if (th === 'mountain') for (let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2, q = isoP(cu + Math.cos(a) * 0.4, cv + Math.sin(a) * 0.4, 10 + (i % 3) * 3); isoSeg(isoP(cu + Math.cos(a) * 0.25, cv + Math.sin(a) * 0.25, 8), q, '#28201e', 1); }   // 삐죽 나온 가시
    else if (season !== 'autumn') idots(cu, cv, 0.36, 10, th === 'cloud' ? 16 : 11, '#ff8fb8', 134, 3);
  }
  if (ready) idots(cu, cv, 0.26, 6, 5, '#e83a4a', 135, 3);                       // 딸 수 있는 열매
}
function isoSnowman(N, ready, season){
  if (season !== 'winter' || !ready) return;
  // 앞뒤·옆 어디서 봐도 동글동글하게 — 납작한 타원 대신 화면에서 둥근 공 셋을 쌓는다(2026-09-29 로키즈)
  const cu = N.x + 0.5, cv = N.y + 0.55, snowC = ['#ffffff', '#f6fafc', '#e6eef4', '#cfdce6', '#b3c4d2'];
  ishadow(cu, cv, 0.3, 0.24);
  const b0 = isoP(cu, cv, 0), X = Math.round(b0.x), Y = Math.round(b0.y);
  snowBall(X, Y - 9, 9, snowC); snowBall(X, Y - 23, 7, snowC); snowBall(X, Y - 34, 5.5, snowC);
  px(X - 6, Y - 29, 12, 3, '#e8453c'); px(X + 2, Y - 27, 3, 5, '#d13a32');                          // 목도리와 늘어진 끝
  px(X - 3, Y - 36, 2, 2, '#3a3226'); px(X + 1, Y - 36, 2, 2, '#3a3226');                            // 눈
  px(X - 1, Y - 34, 5, 2, '#ff8c2e'); px(X + 4, Y - 34, 2, 1, '#ff8c2e');                            // 당근 코
  [-24, -20, -16].forEach(y => px(X - 1, Y + y, 2, 2, '#3a3226'));                                  // 단추
  px(X - 6, Y - 41, 12, 2, '#2e2a26'); px(X - 4, Y - 49, 8, 8, '#2e2a26'); px(X - 4, Y - 43, 8, 1, '#8a3a32');   // 모자
  isoSeg({ x: X - 6, y: Y - 23 }, { x: X - 14, y: Y - 30 }, WOOD.dark, 1); isoSeg({ x: X + 6, y: Y - 23 }, { x: X + 14, y: Y - 29 }, WOOD.dark, 1);   // 나뭇가지 팔
}
// 눈덩이 한 알 — 화면 도트로 둥글게. 왼쪽 위에서 빛이 오니 오른쪽 아래로 갈수록 그늘
function snowBall(cx, cy, R, cols){
  for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++){
    const d = (dx + 0.5) * (dx + 0.5) + (dy + 0.5) * (dy + 0.5); if (d > R * R) continue;
    const nx = (dx + 0.5) / R, ny = (dy + 0.5) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = -0.45 * nx - 0.55 * ny + 0.7 * nz, k = lit > 0.85 ? 0 : lit > 0.62 ? 1 : lit > 0.36 ? 2 : lit > 0.1 ? 3 : 4;
    px(cx + dx, cy + dy, 1, 1, cols[Math.min(cols.length - 1, k)]);
  }
}
function isoNode(n, N, ready, season, th){
  if (N.kind === 'rock') return isoRock(N, ready, th);
  if (N.kind === 'tree') return isoTree(n, N, ready, season, th);
  if (N.kind === 'bush') return isoBush(n, N, ready, season, th);
  if (N.kind === 'snow') return isoSnowman(N, ready, season);
}
function nodeBox(N){ const q = isoP(N.x + 0.5, N.y + 0.5); return { x: q.x - 50, y: q.y - 120, w: 100, h: 145 }; }
// 별 동상 — 대리석 두 단(금테·명판·루비), 금가락지 두른 기둥, 금 잔, 두께가 있는 금별
function isoStarAt(b){ const q = isoP(b.x + 0.5, b.y + 1, 58); return starGeom(Math.round(q.x) - 16, Math.round(q.y) - 15); }
function ipStatue(b, night, season, th){
  if (th === 'cloud') return isoManeki(b, night);
  const cu = b.x + 0.5, cv = b.y + 1, G = STAR_GOLD, m = th === 'cloud' ? '#8d8f88' : th === 'mountain' ? '#bdb8ae' : '#f4f1ea';
  ishadow(cu, cv, 0.46, 0.52);
  ibox(cu - 0.42, cv - 0.5, 0.84, 1.0, 0, 8, m);
  ibox(cu - 0.44, cv - 0.52, 0.88, 1.04, 8, 10, G[2], G[0]);
  ibox(cu - 0.32, cv - 0.36, 0.64, 0.72, 10, 18, shade(m, -6));
  ibox(cu - 0.34, cv - 0.38, 0.68, 0.76, 18, 20, G[2], G[0]);
  const P = { u0: cu - 0.32, u1: cu + 0.32, v0: cv - 0.36, v1: cv + 0.36 };
  faceRect(P, 'L', 0.18, 0.46, 12, 17, G[4]); faceRect(P, 'L', 0.2, 0.44, 12, 16, G[2]);
  [0.07, 0.55].forEach(a => { const q = faceMid(P, 'L', a, 14); px(Math.round(q.x), Math.round(q.y) - 1, 3, 3, '#b3203a'); px(Math.round(q.x), Math.round(q.y) - 1, 1, 1, '#ffb3c0'); });
  isoDrum(cu, cv, 0.15, 20, 40, m, shade(m, 10));
  isoDrum(cu, cv, 0.17, 22, 24, G[2], G[0]); isoDrum(cu, cv, 0.17, 38, 40, G[2], G[0]);
  { const q = isoP(cu, cv + 0.15, 31); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3, '#3a7bd5'); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 1, 1, '#b8dcff'); }
  for (let k = 0; k < 6; k++){ const r = 0.1 + k * 0.035; isoEllipse(cu, cv, r, r, 40 + k, roundTex(cu, cv, r, k === 5 ? G[1] : G[2])); }
  isoEllipse(cu, cv, 0.24, 0.24, 46, G[4]);
  const sc = isoStarAt(b);
  paintStar(sc, 3);
  if (night){ lamp(sc.cx, sc.cy, 40, '#ffe6a0'); const q = isoP(cu, cv, 20); lamp(q.x, q.y, 18, '#ffd36a'); }
}

// ---- 섬의 가축과 수아·연아도 아이소로(2026-09-28 로키즈 「가축들도 수아연아 캐릭도 아이소메트릭으로」) ----
// 가축·인형은 몸·머리·다리를 둥근 덩이로 쌓아 세운다. 보는 방향은 넷(u 앞뒤, v 앞뒤), 걸음은 두 장.
// 수아·연아는 2026-09-29 부터 판 그림(여덟 방향)을 세운다 — drawWalkerIso.
// 매 장 쌓으면 무거우니 (누구·방향·걸음) 마다 한 번 그려 담아 두고, 자리만 옮겨 붙인다(charSprite).
const DIRV = { u: [1, 0], '-u': [-1, 0], v: [0, 1], '-v': [0, -1] };
const charBuf = {};
// 기준 칸 (0,0) 위에 그려 담는다. 붙일 때는 isoP(칸) - isoP(0,0) 만큼 민다.
function charSprite(key, paint){
  let e = charBuf[key];
  if (!e || e.S !== S){
    const o = isoP(0, 0), box = { x: o.x - 48, y: o.y - 84, w: 96, h: 100 };
    const w = Math.ceil(box.w * S) + 2, h = Math.ceil(box.h * S) + 2, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const ox = Math.floor(box.x * S), oy = Math.floor(box.y * S);
    g.translate(-ox, -oy);
    const keepCtx = ctx, keepLamps = lamps; ctx = g; lamps = [];
    try { paint(); } finally { ctx = keepCtx; lamps = keepLamps; }
    inkRim(cv, INK.beast);
    e = charBuf[key] = { cv, ox, oy, S };
  }
  return e;
}
function charBlit(e, fx, fy, lift){
  const o = isoP(0, 0), q = isoP(fx / T, fy / T);
  ctx.drawImage(e.cv, e.ox + Math.round((q.x - o.x) * S), e.oy + Math.round((q.y - o.y - (lift || 0)) * S));
}
// 둥근 덩이 — 가로 타원을 쌓은 달걀꼴. cols [밝은, 가운데, 어두운]. pat(x,y) 가 색을 주면 그 도트는 무늬.
function iegg(cu, cv, ru, rv, z0, h, cols, pat){
  const cx = isoP(cu, cv).x, w = Math.max(ru, rv) * IT / 2;
  for (let k = 0; k <= h; k++){
    const f = (k - h / 2) / (h / 2 + 0.5), s = Math.sqrt(Math.max(0, 1 - f * f));
    if (s < 0.08) continue;
    const top = k > h * 0.58, low = k < h * 0.22;
    isoEllipse(cu, cv, ru * s, rv * s, z0 + k, (x, y) => {
      const p = pat && pat(x, y, k); if (p) return p;
      if (k < h * 0.1 && h > 5) return shade(cols[2], -12);                     // 바닥에 닿는 쪽 한 단 더 어둡게
      if (x > cx + w * 0.35 || low) return cols[2];
      return top && x < cx + w * 0.1 ? cols[0] : cols[1];
    });
  }
}
function ileg(u, v, r, z0, z1, col, foot){
  for (let z = z0; z < z1; z++) isoEllipse(u, v, r, r, z, z < z0 + 2 && foot ? foot : z === z1 - 1 ? shade(col, 10) : col);
}
// 방향 d 로 앞 f 칸, 옆 s 칸 떨어진 자리
function fwd(d, f, s){ const [du, dv] = DIRV[d]; return [f * du - s * dv, f * dv + s * du]; }
const facingViewer = d => d === 'u' || d === 'v';
// 눈 둘 — 머리 겉면(앞쪽)에. 뒤를 보면 안 그린다.
function ieyes(d, hc, r, z, gap, col, shine){
  if (!facingViewer(d)) return;
  [-1, 1].forEach(sd => { const [a, b] = fwd(d, r, sd * gap), q = isoP(hc[0] + a, hc[1] + b, z), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y - 2, 2, 3, col); if (shine) px(x - 1, y - 2, 1, 1, '#ffffff'); });
}

// ■ 가축 — 크기는 모두 도트(칸 하나 ≈ 가로 28도트). L·Wd 는 몸 길이·너비의 반. k 로 새끼를 줄인다.
const DOT = 1 / 28;
const BEAST3D = {
  chicken: { L: 7, Wd: 5, z0: 4, h: 10, legH: 4, leg: '#ffb43d', legR: 1.1, body: ['#ffffff', '#fffaf2', '#e3d9c8'], head: { f: 7, r: 4, z: 11, h: 8 }, face: 'chicken', nose: 1.3 },
  duck:    { L: 8, Wd: 5.5, z0: 3, h: 9, legH: 3, leg: '#ffb43d', legR: 1.4, body: ['#ffffff', '#fbf6ea', '#dcd4c2'], head: { f: 8, r: 4, z: 9, h: 8 }, face: 'duck', nose: 2 },
  cow:     { L: 15, Wd: 8, z0: 9, h: 14, legH: 10, leg: '#fbf6ee', legR: 2, body: ['#ffffff', '#f7f2ea', '#d9d1c4'], head: { f: 16, r: 6, z: 14, h: 11 }, face: 'cow', spots: '#2e2a26', nose: 3.5 },
  sheep:   { L: 11, Wd: 8, z0: 6, h: 14, legH: 7, leg: '#3a3226', legR: 1.6, body: ['#fffdf6', '#f3ecdc', '#d8ceb8'], head: { f: 12, r: 4.5, z: 12, h: 9, col: ['#5a5048', '#3a3226', '#2a241c'] }, face: 'sheep', fluff: true },
  pig:     { L: 11, Wd: 7.5, z0: 4, h: 12, legH: 5, leg: '#f2a0b0', legR: 2, body: ['#ffd0da', '#ffb3c1', '#e88aa0'], head: { f: 12, r: 5.5, z: 7, h: 10 }, face: 'pig', nose: 3 },
  rabbit:  { L: 6, Wd: 5, z0: 1, h: 9, legH: 2, leg: '#f2ece2', legR: 1.6, body: ['#ffffff', '#f6f0e6', '#d9d0c2'], head: { f: 6, r: 4, z: 8, h: 8 }, face: 'rabbit' },
  dog:     { L: 9, Wd: 5, z0: 6, h: 9, legH: 6, leg: '#c98f55', legR: 1.6, body: ['#f0c48a', '#dca36a', '#b57f48'], head: { f: 10, r: 5, z: 11, h: 9 }, face: 'dog', nose: 2.5 },
  cat:     { L: 8, Wd: 4.5, z0: 5, h: 8, legH: 5, leg: '#e0a060', legR: 1.4, body: ['#ffc98a', '#f2a65a', '#c9803c'], head: { f: 8, r: 4.5, z: 10, h: 8 }, face: 'cat', stripes: '#c9803c' },
  // 이삿날 새 식구 — 갈매기는 잿빛 날개, 두루미는 긴 다리와 까만 목(neck)으로 머리를 높이 든다
  gull:    { L: 7, Wd: 5, z0: 4, h: 9, legH: 4, leg: '#f2b04e', legR: 1.1, body: ['#ffffff', '#f6f8fa', '#d3dae0'], head: { f: 7, r: 3.8, z: 10, h: 7 }, face: 'gull', nose: 1.2, bird: true, wing: ['#c3ccd4', '#a4b0bb', '#6d7780'] },
  goat:    { L: 10, Wd: 6, z0: 8, h: 11, legH: 9, leg: '#ece2cf', legR: 1.5, body: ['#fffaf0', '#f1e7d4', '#d4c4a6'], head: { f: 11, r: 4.3, z: 14, h: 9 }, face: 'goat', nose: 2 },
  crane:   { L: 7, Wd: 4.5, z0: 16, h: 9, legH: 16, leg: '#3a3a3e', legR: 0.8, body: ['#ffffff', '#f7f7f3', '#d9d9d2'], head: { f: 8, r: 3, z: 30, h: 6 }, face: 'crane', bird: true, neck: '#2a2a2e' },
};
BEAST3D.chicken.bird = BEAST3D.duck.bird = true;
function beast3d(kind, d, frame, k){
  const B = BEAST3D[kind] || BEAST3D.chicken, sc = x => x * DOT * k, zc = z => Math.round(z * k);   // sc: 도트 → 칸
  const parts = [];
  // 다리 넷(새는 둘) — 걸음 장마다 앞뒤로 엇갈린다
  const legs = B.bird ? [[0, -0.4], [0, 0.4]] : [[0.6, -0.55], [0.6, 0.55], [-0.6, -0.55], [-0.6, 0.55]];
  legs.forEach(([lf, ls], i) => {
    const step = frame ? ((i + (lf > 0 ? 0 : 1)) % 2 ? 1.5 : -1.5) : 0, [a, b] = fwd(d, sc(B.L * lf + step), sc(B.Wd * ls));
    parts.push({ dep: a + b - 5, go: () => ileg(a, b, sc(B.legR), frame && step > 0 ? 1 : 0, zc(B.legH) + 2, B.leg, kind === 'cow' ? '#4a3a2e' : kind === 'pig' ? '#c97a8a' : kind === 'sheep' ? '#1f1a14' : null) });
  });
  // 꼬리
  const [tu, tv] = fwd(d, -sc(B.L) * 1.05, 0);
  parts.push({ dep: tu + tv, go: () => {
    const q = isoP(tu, tv, zc(B.z0 + B.h * 0.7)), x = Math.round(q.x), y = Math.round(q.y);
    if (kind === 'chicken') iegg(tu, tv, sc(3), sc(3), zc(B.z0 + B.h * 0.5), zc(8), ['#ffffff', '#f2ece0', '#d8cfbd']);
    else if (kind === 'rabbit' || kind === 'sheep') iegg(tu, tv, sc(2.5), sc(2.5), zc(B.z0 + B.h * 0.4), zc(5), B.body);
    else if (kind === 'pig'){ px(x - 1, y - 2, 3, 1, '#e88aa0'); px(x + 1, y - 3, 1, 2, '#e88aa0'); px(x - 1, y - 4, 2, 1, '#e88aa0'); }
    else if (kind === 'duck') px(x - 2, y - 1, 4, 2, '#dcd4c2');
    else if (kind === 'gull'){ px(x - 2, y - 1, 4, 2, '#2f3338'); px(x - 2, y - 1, 4, 1, '#6d7780'); }
    else if (kind === 'crane') iegg(tu, tv, sc(3.2), sc(3.2), zc(B.z0 + 1), zc(6), ['#3a3a3e', '#2a2a2e', '#18181b']);   // 까만 꽁지깃
    else if (kind === 'goat'){ px(x, y - 4, 2, 4, B.body[2]); px(x, y - 4, 2, 1, B.body[0]); }                          // 짧게 치켜든 꼬리
    else { const up = kind === 'cat' || kind === 'dog' ? -1 : 1; for (let i = 0; i < 8; i++) px(x + (i >> 2), y + up * i - (up < 0 ? 0 : 4), 2, 1, kind === 'cow' ? '#3a3226' : B.body[2]); if (kind === 'cow') px(x, y + 3, 3, 3, '#2e2a26'); if (kind === 'cat') px(x + 1, y - 8, 2, 2, shade(B.body[2], -16)); }
  } });
  // 몸 — 방향 쪽으로 길쭉한 달걀. 소는 점박이, 양은 몽글몽글, 고양이는 줄무늬.
  const [du, dv] = DIRV[d], ru = sc(du ? B.L : B.Wd), rv = sc(dv ? B.L : B.Wd);
  const pat = B.spots ? (x, y) => hash2(x >> 3, y >> 2, 331) > 0.72 ? B.spots : null
            : B.fluff ? (x, y) => { const q = hash2(x >> 1, y >> 1, 332), ry = y >> 1, cx3 = ((x + (ry % 2) * 2) % 4 + 4) % 4; if ((y & 1) && cx3 === 0) return B.body[2]; if (!(y & 1) && cx3 === 2) return B.body[0]; return q > 0.85 ? B.body[0] : q < 0.08 ? B.body[2] : null; }
            : B.stripes ? (x, y, kk) => kk % 4 === 1 && (x & 3) ? B.stripes : null : null;
  parts.push({ dep: 0, go: () => iegg(0, 0, ru, rv, zc(B.z0), zc(B.h), B.body, pat) });
  if (B.bird) parts.push({ dep: 0.005, go: () => {
    const sd = [-1, 1].find(k2 => { const [a, b] = fwd(d, 0, k2); return a + b > 0; }), [a, b] = fwd(d, -sc(1), sd * sc(B.Wd * 0.8));
    iegg(a, b, du ? sc(4) : sc(2), dv ? sc(4) : sc(2), zc(B.z0 + 3), zc(5), B.wing || [B.body[1], B.body[2], shade(B.body[2], -14)]);
  } });
  if (B.neck){                                                                  // 두루미 목 — 몸 앞에서 머리까지 곧게
    const [na, nb] = fwd(d, sc(B.head.f * 0.8), 0);
    parts.push({ dep: na + nb + 0.01, go: () => ileg(na, nb, sc(1.4), zc(B.z0 + B.h * 0.6), zc(B.head.z + 1), B.neck) });
  }
  if (kind === 'cow') parts.push({ dep: 0.01, go: () => { const [a, b] = fwd(d, -sc(3), 0); iegg(a, b, sc(2.5), sc(2.5), zc(B.z0 - 3), zc(4), ['#ffc9d2', '#ffb3c1', '#e88aa0']); } });   // 젖
  // 머리
  const H = B.head, [hu, hv] = fwd(d, sc(H.f), 0), hc = [hu, hv], hz = zc(H.z), hh = zc(H.h), hr = sc(H.r);
  parts.push({ dep: hu + hv + 0.02, go: () => {
    iegg(hu, hv, hr, hr, hz, hh, H.col || B.body);
    const top = hz + hh, mid = hz + hh * 0.55;
    const ear = (sd, h, col, w) => { const [a, b] = fwd(d, -hr * 0.2, sd * hr * 0.6), q = isoP(hu + a, hv + b, top - 1), x = Math.round(q.x), y = Math.round(q.y); for (let i = 0; i < h; i++) px(x - (w >> 1), y - i, Math.max(1, w - Math.floor(i * w / h)), 1, col); };
    const nose = (col, zo) => {
      const [a, b] = fwd(d, hr * 0.95, 0), r = sc(B.nose); iegg(hu + a, hv + b, r, r, hz + zc(zo), zc(4), [shade(col, 16), col, shade(col, -20)]);
      if (facingViewer(d) && (B.face === 'cow' || B.face === 'pig')) [-1, 1].forEach(sd => { const [c2, e2] = fwd(d, hr * 0.95 + r * 0.9, sd * r * 0.45), q = isoP(hu + c2, hv + e2, hz + zc(zo) + 2); px(Math.round(q.x), Math.round(q.y), 1, 2, shade(col, -60)); });
    };
    if (B.face === 'chicken'){ const q = isoP(hu, hv, top), x = Math.round(q.x), y = Math.round(q.y); px(x - 2, y - 3, 5, 3, '#ff5a4a'); px(x - 1, y - 4, 2, 1, '#ff5a4a'); nose('#ff9f2e', 3); const [a, b] = fwd(d, hr * 0.8, 0), w = isoP(hu + a, hv + b, hz + 1); px(Math.round(w.x) - 1, Math.round(w.y), 2, 3, '#ff5a4a'); }
    if (B.face === 'duck') nose('#ffb43d', 2);
    if (B.face === 'cow'){ nose('#ffc0c8', 1); [-1, 1].forEach(sd => { const [a, b] = fwd(d, 0, sd * hr * 0.8), q = isoP(hu + a, hv + b, top - 1), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y - 4, 2, 4, '#e8dcc4'); px(x - 1, y - 4, 1, 1, '#b8a888'); px(x + sd * 2, y - 1, 3, 2, '#f7f2ea'); px(x + sd * 2 + (sd > 0 ? 0 : 2), y, 1, 1, '#ffb3c1'); }); }
    if (B.face === 'sheep'){ iegg(hu, hv, hr * 1.1, hr * 1.1, top - 3, zc(5), ['#fffdf6', '#f3ecdc', '#d8ceb8']); [-1, 1].forEach(sd => ear(sd, 3, '#3a3226', 3)); }
    if (B.face === 'pig'){ nose('#f28ea3', 3); [-1, 1].forEach(sd => ear(sd, 4, '#e88aa0', 4)); }
    if (B.face === 'rabbit') [-1, 1].forEach(sd => { const [a, b] = fwd(d, -hr * 0.2, sd * hr * 0.4); ileg(hu + a, hv + b, sc(1), top - 2, top + zc(10), '#fbf6ee'); const q = isoP(hu + a, hv + b, top + zc(8)); px(Math.round(q.x), Math.round(q.y), 1, zc(4), '#ffb3c1'); });
    if (B.face === 'dog'){ nose('#c98f55', 2); [-1, 1].forEach(sd => { const [a, b] = fwd(d, 0, sd * hr * 0.9), q = isoP(hu + a, hv + b, top - 2), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y, 3, 6, '#8a5a34'); }); const [ca, cb] = fwd(d, -hr * 0.6, 0); isoEllipse(hu + ca, hv + cb, hr * 0.7, hr * 0.7, hz + 1, '#e8453c'); }
    if (B.face === 'gull'){ nose('#f5c542', 2); const [a, b] = fwd(d, hr * 0.95 + sc(B.nose), 0), q = isoP(hu + a, hv + b, hz + zc(2)); px(Math.round(q.x), Math.round(q.y) + 1, 1, 1, '#e0453a'); }
    if (B.face === 'goat'){
      nose('#f2c9b8', 2);
      [-1, 1].forEach(sd => { const [a, b] = fwd(d, -hr * 0.2, sd * hr * 0.45), q = isoP(hu + a, hv + b, top - 1), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y - 3, 2, 3, '#9a8466'); px(x - 2, y - 5, 2, 2, '#b8a282'); });   // 뒤로 휜 뿔
      [-1, 1].forEach(sd => { const [a, b] = fwd(d, 0, sd * hr * 0.95), q = isoP(hu + a, hv + b, mid), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y, 3, 3, '#e6d6ba'); });                                      // 옆으로 늘어진 귀
      if (facingViewer(d)){ const [a, b] = fwd(d, hr * 0.8, 0), q = isoP(hu + a, hv + b, hz); px(Math.round(q.x) - 1, Math.round(q.y), 2, 4, '#d8c8a8'); }                                                    // 턱수염
    }
    if (B.face === 'crane'){
      const q = isoP(hu, hv, top), x = Math.round(q.x), y = Math.round(q.y); px(x - 1, y - 1, 3, 2, '#e0303a');                                    // 붉은 정수리
      for (let i = 0; i < 4; i++){ const [a, b] = fwd(d, hr * 0.9 + sc(1.3 * i), 0), w = isoP(hu + a, hv + b, hz + zc(3)); px(Math.round(w.x), Math.round(w.y), 2, 1, '#b8b08a'); }   // 긴 부리
    }
    if (B.face === 'cat'){ [-1, 1].forEach(sd => ear(sd, 4, '#e08a44', 4)); if (facingViewer(d)) [-1, 1].forEach(sd => { const [a, b] = fwd(d, hr, sd * hr * 0.5), q = isoP(hu + a, hv + b, mid - 2); px(Math.round(q.x) + (sd > 0 ? 1 : -4), Math.round(q.y), 4, 1, '#fff6e9'); }); }
    ieyes(d, hc, hr * 0.92, mid + 1, hr * 0.45, '#2b2622', true);
    if (facingViewer(d) && (B.face === 'pig' || B.face === 'cow' || B.face === 'cat' || B.face === 'rabbit')){ [-1, 1].forEach(sd => { const [a, b] = fwd(d, hr * 0.85, sd * hr * 0.62), q = isoP(hu + a, hv + b, mid - 2); px(Math.round(q.x) - 1, Math.round(q.y), 2, 1, '#ff9aa8'); }); }
  } });
  parts.sort((a, b) => a.dep - b.dep).forEach(p => p.go());
}

// 방에서 따라 나온 인형 — 분홍 여우(레샤)와 흰 새(상그렐라). 판 그림의 색표(DOLLS)를 그대로 쓴다.
function doll3d(kind, d, frame){
  const D = DOLLS[kind], P = D ? D.pal : {}, q = x => x * DOT, lift = frame ? 1 : 0;
  if (kind === 'fox'){
    const pink = [shade(P.p, 12), P.p, shade(P.p, -22)], cream = [P.c, P.c, shade(P.c, -18)];
    iegg(0, 0, q(5), q(5), lift, 8, pink);
    const [ta, tb] = fwd(d, -q(6), 0); iegg(ta, tb, q(2.5), q(2.5), 3 + lift, 5, cream);   // 꼬리 끝
    iegg(0, 0, q(6), q(6), 7 + lift, 10, pink);
    if (facingViewer(d)){ const [a, b] = fwd(d, q(3), 0); iegg(a, b, q(3.5), q(3.5), 8 + lift, 6, cream); }
    [-1, 1].forEach(sd => { const [a, b] = fwd(d, -q(1), sd * q(3.5)), p = isoP(a, b, 16 + lift), x = Math.round(p.x), y = Math.round(p.y); px(x - 2, y - 2, 4, 3, P.p); px(x - 1, y - 4, 2, 2, P.p); px(x - 1, y - 2, 2, 2, P.c); });
    ieyes(d, [0, 0], q(5.6), 12 + lift, q(2.4), P.e, true);
    if (facingViewer(d)){ const [a, b] = fwd(d, q(6), 0), p = isoP(a, b, 10 + lift); px(Math.round(p.x) - 1, Math.round(p.y), 2, 1, P.n); }
    return;
  }
  const white = [P.b, P.b, P.s];                                                  // 상그렐라 — 둥근 흰 새
  [-1, 1].forEach(sd => { const [a, b] = fwd(d, 0, sd * q(2.5)); iegg(a, b, q(1.5), q(1.5), 0, 2, [P.k, P.k, P.K]); });
  iegg(0, 0, q(6.5), q(6.5), 1 + lift, 14, white);
  [-1, 1].forEach(sd => { const [a, b] = fwd(d, -q(1), sd * q(6)); iegg(a, b, q(2), q(2), 5 + lift, 6, [P.s, P.s, shade(P.s, -16)]); });   // 날개
  ieyes(d, [0, 0], q(6.2), 10 + lift, q(2.6), P.e, true);
  if (facingViewer(d)){ const [a, b] = fwd(d, q(6.6), 0), p = isoP(a, b, 8 + lift); px(Math.round(p.x) - 1, Math.round(p.y), 3, 2, P.k); }
}
function drawDollIso(o, t){
  if (!DOLLS[o.kind]) return;
  const d = isoFaceOf(o), f = o.moving ? (Math.floor(o.phase) % 2) : 0, bob = !o.moving && Math.sin(t / 1000 + o.phase) > 0.75 ? 1 : 0;
  isoEllipse(o.x / T + 0.04, o.y / T + 0.04, 0.26, 0.22, 0, 'rgba(30,44,24,0.18)');
  charBlit(charSprite('d|' + o.kind + '|' + d + '|' + f, () => doll3d(o.kind, d, f)), o.x, o.y, bob);
}
function isoFaceOf(o){                                                          // 움직인 쪽을 본다 — 멈추면 마지막 방향
  if (o._lx != null){ const dx = o.x - o._lx, dy = o.y - o._ly; if (Math.abs(dx) + Math.abs(dy) > 0.05) o._face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'u' : '-u') : (dy > 0 ? 'v' : '-v'); }
  o._lx = o.x; o._ly = o.y;
  return o._face || (o.flip ? '-u' : 'v');
}
// ■ 수아·연아 — 판 그림(kid-art.js)을 그대로 세운다. 그 그림이 2:1 아이소 카메라로 그려져 여덟 방향이 섬 위에서도 맞는다.
// 지도에서 움직인 쪽(u·v)을 45도 돌려 방향을 고른다: +u → SE, +v → SW, -u → NW, -v → NE, u·v 같이 → S·N, 엇갈리면 E·W.
// 걸음 네 장에 오르내림이 이미 들어 있어서, 들썩임은 서 있을 때만.
function drawWalkerIso(w, t){
  const A = KIDART[w.who] || KIDART.yona, d = w.moving ? dir8(w.vx - w.vy, w.vx + w.vy) : 'S', f = KIDSTEP(w.moving, w.phase);   // 멈추면 화면(정면)을 본다
  const lift = w.moving ? 0 : (Math.sin(t / 900 + w.phase) > 0.8 ? 1 : 0), q = isoP(w.x / T, w.y / T);
  isoEllipse(w.x / T + 0.06, w.y / T + 0.06, 0.34, 0.28, 0, 'rgba(30,44,24,0.2)');
  artOut(w.who + d + f, A.dirs[d][f], Math.round(q.x - A.w / 2), Math.round(q.y - A.h - lift), KIDPAL[w.who]);
}
// ■ 주말 손님(2026-09-29 로키즈 「주말마다 관객 한 명이 놀러 와서 가게를 구경」)
// 토·일(한국 시각)에 섬 가장자리에서 걸어 들어와 가게 앞에 서서 구경하고, 밭이나 꾸미개 한 곳을 들렀다가
// 온 데로 나간다. 1~2분 뒤 또 온다. 그림은 연주회장 객석 손님(WALKSHEET guest 0~7) — 그날 누가 올지는 날짜로.
// 움직임 줄이기면 가게 앞에 서 있기만. 시험: 콘솔에서 FARM.visitNow() (번호를 주면 그 손님).
const GUEST_SAY = ['구경 왔어요!', '우와, 뭐 팔아요?', '맛있겠다!'];
function weekendKST(){ const d = new Date(now() + 9 * 36e5).getUTCDay(); return d === 0 || d === 6; }
function guestNo(){ return Math.floor(R.prand('fg' + R.dayKey(now())) * WALKSHEET.count('guest')); }
function stallFront(){
  const b = spot('stall'), at = nearestWalkable(b.x + 1, b.y + b.h);
  return { x: at.x, y: at.y, look: { x: (b.x + b.w / 2 - at.x - 0.5) * T, y: (b.y + b.h / 2 - at.y - 0.75) * T } };
}
function newFarmGuest(t, n){
  const front = stallFront(), edge = [];
  for (let y = 0; y < ROWS - 1; y++) for (let x = 0; x < COLS; x++){
    if ((x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 2) && walkableTile(x, y)) edge.push({ x, y });
  }
  let from = null;
  for (let k = 0; k < 10 && edge.length && !from; k++){
    const e = edge[Math.floor(Math.random() * edge.length)];
    if (pathFind(e.x, e.y, front.x, front.y)) from = e;
  }
  if (!from) return null;
  const stops = [Object.assign({ ms: 6000 + Math.random() * 4000, say: true }, front)];
  // 한 군데 더 — 밭이나 놓인 꾸미개·건물 둘레
  const homes = [R.fieldBox(W)];
  R.PLACE_IDS.forEach(id => { if (id !== 'path' && id !== 'stall' && here(id)) homes.push(spot(id)); });
  if (Math.random() < 0.75){
    const h = homes[Math.floor(Math.random() * homes.length)], p = nearTile(h, 1), tx = (p.x - 16) / T, ty = (p.y - 24) / T;
    if (pathFind(front.x, front.y, tx, ty)) stops.push({ x: tx, y: ty, ms: 3000 + Math.random() * 3000, look: { x: (h.x + h.w / 2 - tx - 0.5) * T, y: (h.y + h.h / 2 - ty - 0.75) * T } });
  }
  stops.push({ x: from.x, y: from.y, ms: 1 });
  return { n: n == null ? guestNo() : n, x: from.x * T + 16, y: from.y * T + 24, vx: 0, vy: 1, moving: false, phase: 0, stops, si: 0, path: null, step: 0, wait: 0, born: t, out: 0 };
}
function stepFarmGuest(dt, t){
  if (!isoView || visitAt != null || (!weekendKST() && !farmGuestAsk && !(farmGuest && farmGuest.asked))){ farmGuest = null; return; }
  if (!farmGuest){
    if (!farmGuestAsk && t < farmGuestNext) return;
    farmGuest = newFarmGuest(t, farmGuestAsk ? farmGuestAsk.n : null);
    if (farmGuest) farmGuest.asked = !!farmGuestAsk;
    farmGuestAsk = null;
    if (!farmGuest){ farmGuestNext = t + 20000; return; }
  }
  const v = farmGuest, s = v.stops[v.si];
  if (v.hold > 0){ v.hold -= dt; v.moving = false; return; }       // 아이가 불러 세웠다 — 하던 일은 그대로 두고 잠깐 선다
  if (v.wait > 0){ v.wait -= dt; v.moving = false; if (v.wait <= 0){ v.si++; v.path = null; } return; }
  if (!s){                                                          // 다 돌았다 — 옅어지며 사라진다
    v.moving = false;
    if (!v.out) v.out = t;
    if (t - v.out > 600){ farmGuest = null; farmGuestNext = t + 60000 + Math.random() * 60000; }
    return;
  }
  if (!v.path){ v.path = pathFind(Math.floor(v.x / T), Math.floor(v.y / T), s.x, s.y) || []; v.step = 0; }
  if (v.step >= v.path.length){                                     // 닿았다 — 그쪽을 보고 선다
    v.moving = false;
    if (s.look){ v.vx = s.look.x; v.vy = s.look.y; }
    v.wait = s.ms;
    if (s.say){ const h = WALKSHEET.heights('guest')[v.n] || 48; bubbleAt('farmGuest', v.x, v.y - h - 2, GUEST_SAY[Math.floor(Math.random() * GUEST_SAY.length)], t, v.y); }
    return;
  }
  const g = v.path[v.step], gx = g.x * T + 16, gy = g.y * T + 24, dx = gx - v.x, dy = gy - v.y, d = Math.hypot(dx, dy), sp = 22 * dt / 1000;
  if (d < 4){ v.x = gx; v.y = gy; v.step++; return; }
  // 다음 걸음이 아이에게 두 칸 안으로 다가가면 손님이 비킨다 — 잠깐 서 있다가 그 아이 둘레를 도는 길을 새로 짠다.
  // 여덟 번(5~9초) 비켜도 길이 안 나면(아이가 가게 앞에 버티고 섰다) 그냥 간다
  const kid = walkers && walkers.find(w => { const gd = Math.hypot(gx - w.x, gy - w.y); return gd < 2 * T && gd < Math.hypot(v.x - w.x, v.y - w.y); });
  if (kid && (v.yield || 0) < 8){
    v.moving = false; v.hold = 500 + Math.random() * 700; v.yield = (v.yield || 0) + 1;
    // 아이 둘레 한 칸을 막고 돌 길 → 없으면(좁은 길) 아이 선 칸만 막고
    const fx = Math.floor(v.x / T), fy = Math.floor(v.y / T), kx = Math.floor(kid.x / T), ky = Math.floor(kid.y / T);
    const near1 = Math.abs(kx - fx) > 1 || Math.abs(ky - fy) > 1;                         // 제 발밑까지 막지는 않게
    const r = (near1 && pathFind(fx, fy, s.x, s.y, { x: kx, y: ky, r: 1 })) || ((kx !== fx || ky !== fy) && pathFind(fx, fy, s.x, s.y, { x: kx, y: ky, r: 0 }));
    if (r && r.length){ v.path = r; v.step = 0; }
    return;
  }
  if (!kid) v.yield = 0;
  v.x += dx / d * sp; v.y += dy / d * sp; v.moving = true; v.phase += sp / 6.4; v.vx = dx; v.vy = dy;
}
// 움직임 줄이기면 걷지 않고 가게 앞에 서 있다
function stillFarmGuest(n){
  const f = stallFront();
  return { n: n == null ? guestNo() : n, x: f.x * T + 16, y: f.y * T + 24, vx: f.look.x, vy: f.look.y, moving: false, phase: 0, born: -1e9, out: 0, still: true };
}
// 그림 한 칸은 1도트 = 캔버스 2px 에 테 1도트가 둘러져 있다 — 아이 그림과 같은 도트 크기로 줄여 붙인다. 발끝은 칸 밑단에서 두 도트 위.
function drawFarmGuestIso(v, t){
  const d = dir8(v.vx - v.vy, v.vx + v.vy), cv = WALKSHEET.sprite('guest', v.n, v.moving ? d : WALKSHEET.diag(d, v.n & 1), KIDSTEP(v.moving, v.phase), null);   // 서 있을 땐 아이소 대각선(정면은 수아·연아만)
  if (!cv) return;
  const a = Math.max(0, Math.min(1, (t - v.born) / 500, v.out ? 1 - (t - v.out) / 600 : 1));
  const nod = !v.moving && !v.still && Math.sin(t / 650) > 0.85 ? 1 : 0;           // 구경하며 가끔 끄덕
  const q = isoP(v.x / T, v.y / T), w = cv.width / 2, h = cv.height / 2;
  ctx.globalAlpha = a;
  isoEllipse(v.x / T + 0.06, v.y / T + 0.06, 0.34, 0.28, 0, 'rgba(30,44,24,0.2)');
  ctx.drawImage(cv, Math.round((q.x - w / 2) * S), Math.round((q.y - h + 2 + nod) * S), Math.round(w * S), Math.round(h * S));
  ctx.globalAlpha = 1;
}
// 시험용 — 평일에도 손님을 부른다. n 을 주면 그 손님(0~7).
R.visitNow = n => {
  if (!isoMode()) return '섬 농장에서만 와요';
  if (STILL){ farmGuest = stillFarmGuest(n); if (liveCv) drawFarm(liveCv); return 'ok'; }
  farmGuest = null; farmGuestAsk = { n };
  return 'ok';
};
function drawBeastIso(a, t){
  const rec = (W.animals || []).find(x => x.id === a.id), baby = rec && rec.baby, k = baby ? BABY_K : 1;
  const d = isoFaceOf(a), f = a.moving ? (Math.floor(a.phase) % 2) : 0, B = BEAST3D[a.kind] || BEAST3D.chicken;
  const bob = a.moving ? f : (Math.sin(t / 1100 + a.phase) > 0.7 ? 1 : 0);
  isoEllipse(a.x / T + 0.05, a.y / T + 0.05, (B.L + 2) * DOT * k, (B.L + 1) * DOT * k, 0, 'rgba(30,44,24,0.18)');
  charBlit(charSprite('b|' + a.kind + '|' + d + '|' + f + '|' + (baby ? 1 : 0), () => beast3d(a.kind, d, f, k)), a.x, a.y, bob);
  if (rec && rec.ready){
    const q = isoP(a.x / T, a.y / T), x = Math.round(q.x), by = Math.round(q.y - (B.head.z + B.head.h + 14) * k + Math.sin(t / 400) * 2.4);
    px(x - 4, by, 10, 10, '#ffe066'); px(x - 4, by, 6, 4, '#fff3b8'); px(x - 6, by + 2, 2, 6, '#e8b74a'); px(x + 6, by + 2, 2, 6, '#e8b74a');
  }
}

// ---- 농장마다 하나뿐인 꾸미개(2026-09-28) — 섬에서만 놓이므로 아이소 그림만 있다 ----
const ISO_OWN = { lighthouse: 1, palm: 1, cairn: 1, waterfall: 1, balloon: 1, skybridge: 1, anchor: 1, boat: 1, parasol: 1, woodpile: 1, milkcans: 1, alphorn: 1, shishi: 1, koinobori: 1, toro: 1 };
// 둥근 것의 옆면 — 왼쪽 앞은 밝고 오른쪽은 그늘. isoEllipse 에 색 대신 넘긴다.
function roundTex(cu, cv, r, col){
  const c = isoP(cu, cv).x, w = r * IT / 2;
  return (x) => x > c + w * 0.4 ? shade(col, -26) : x < c - w * 0.55 ? shade(col, 16) : col;
}
function isoLighthouse(b, night){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  isoEllipse(cu + 0.16, cv + 0.16, 0.42, 0.42, 0, 'rgba(30,44,24,0.2)');
  isoDrum(cu, cv, 0.4, 0, 5, STONE.low, STONE.hi);                               // 돌 받침
  for (let z = 5; z < 52; z++){                                                   // 빨강·하양 띠 — 위로 갈수록 가늘다
    const r = 0.3 - (z - 5) / 47 * 0.09, col = Math.floor((z - 5) / 9) % 2 ? '#f4efe6' : '#d9504a';
    isoEllipse(cu, cv, r, r, z, roundTex(cu, cv, r, col));
  }
  { const q = isoP(cu + 0.2, cv + 0.2, 5); px(Math.round(q.x) - 2, Math.round(q.y) - 9, 4, 9, WOOD.dark); px(Math.round(q.x) - 2, Math.round(q.y) - 9, 4, 1, WOOD.low); }
  isoDrum(cu, cv, 0.3, 51, 54, '#3a3a44', '#5a5a66');                              // 난간 마루
  isoDrum(cu, cv, 0.17, 54, 63, night ? '#ffe9a0' : '#bfe6f8', night ? '#fff6cf' : '#e6f6fd');   // 등불 방
  [-0.12, 0, 0.12].forEach(o => { const q = isoP(cu + o, cv - o + 0.17, 54); px(Math.round(q.x), Math.round(q.y) - 9, 1, 9, '#3a3a44'); });
  for (let z = 63; z < 71; z++){ const r = 0.22 * (71 - z) / 8; isoEllipse(cu, cv, r, r, z, roundTex(cu, cv, 0.22, '#d9504a')); }
  { const q = isoP(cu, cv, 72); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2, '#3a3a44'); }
  if (night){ const q = isoP(cu, cv, 58); lamp(q.x, q.y, 34, '#fff0a0'); }
}
function isoPalm(b){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  isoEllipse(cu + 0.3, cv, 0.4, 0.3, 0, 'rgba(30,44,24,0.18)');
  for (let z = 0; z < 46; z++){                                                   // 휘어 오르는 줄기, 네 도트마다 마디
    const k = (z / 46) * (z / 46), r = 0.1 - z * 0.0008;
    isoEllipse(cu + k * 0.28, cv - k * 0.1, r, r, z, roundTex(cu + k * 0.28, cv - k * 0.1, r, z % 4 ? '#b08a5a' : '#8f6b42'));
  }
  const q = isoP(cu + 0.28, cv - 0.1, 46), x = Math.round(q.x), y = Math.round(q.y);
  [[-3, 2], [2, 3], [0, 5]].forEach(([dx, dy]) => { px(x + dx - 1, y + dy - 1, 4, 4, '#6b4a2a'); px(x + dx - 1, y + dy - 1, 2, 1, '#8f6b42'); });   // 야자 열매
}
// 야자 잎 — 바람 따라 끝이 흔들린다. 여섯 장을 부챗살로.
function isoPalmLeaves(b, t){
  const q = isoP(b.x + 0.78, b.y + 0.4, 46), x = q.x, y = q.y - 1;
  const sway = STILL ? 0 : Math.sin(t / 820) * (curWind + 0.5) * 2;
  [-2.8, -2.0, -1.1, -0.3, 0.5, 1.5, 2.5].forEach((a, i) => {
    const len = 20 + (i % 2) * 4;
    for (let s2 = 0; s2 <= len; s2 += 2){
      // 잎은 위로 솟았다가 끝이 처진다 — 가운데가 볼록한 활 모양
      const f = s2 / len, sx = x + Math.cos(a) * s2 + sway * f * f, sy = y + Math.sin(a) * s2 * 0.45 - s2 * 0.45 + f * f * len * 0.75;
      px(Math.round(sx) - 1, Math.round(sy), 3, 2, f < 0.3 ? '#3f7d3a' : '#4f9a44');
      if (s2 > 3 && s2 < len - 1) { px(Math.round(sx), Math.round(sy) + 2, 1, 2 + (s2 % 4 ? 1 : 0), '#3f7d3a'); px(Math.round(sx) - 1, Math.round(sy) - 1, 2, 1, '#79c05e'); }
    }
  });
}
/* 돌탑 — 화산 섬의 꾸미개라 검은 흑요석을 쌓았다(2026-10-06). 돌마다 새긴 무늬에 용암빛이 돌고, 맨 위엔 불씨 하나.
   겨울엔 눈 대신 재가 앉는다. */
function isoCairn(b, season){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  isoEllipse(cu + 0.12, cv + 0.12, 0.4, 0.36, 0, 'rgba(30,44,24,0.2)');
  const top = [[0.34, 5, 0, 0, '#2a2226'], [0.27, 5, 0.03, -0.02, '#3a3034'], [0.23, 4, -0.02, 0.02, '#241c20'], [0.18, 4, 0.02, 0, '#3a3034'], [0.13, 4, -0.01, -0.01, '#2a2226'], [0.08, 3, 0.01, 0.01, '#463a40']]
    .reduce((z, [r, h, du, dv, c], i) => {
      isoDrum(cu + du, cv + dv, r, z, z + h, c, shade(c, 22));
      if (i < 5){ const q = isoP(cu + du, cv + dv + r, z + h / 2); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 1, i % 2 ? '#ffb02e' : '#ff5a1a'); if (i % 2 === 0) px(Math.round(q.x), Math.round(q.y) - 2, 1, 3, '#ff6a1a'); }   // 새긴 무늬
      return z + h;
    }, 0);
  const q = isoP(cu + 0.01, cv + 0.01, top); px(Math.round(q.x) - 1, Math.round(q.y) - 3, 2, 3, '#ff8a1a'); px(Math.round(q.x), Math.round(q.y) - 4, 1, 2, '#ffe066');   // 불씨
  if (season === 'winter') isoEllipse(cu + 0.03, cv + 0.03, 0.06, 0.06, top - 1, '#8a8284');
  [[-0.35, 0.3], [0.32, 0.36], [0.4, -0.2]].forEach(([du, dv], i) => isoDrum(cu + du, cv + dv, 0.07, 0, 2, i % 2 ? '#3a3034' : '#2a2226', '#4a4044'));   // 둘레 조약돌
}
const FALL_Z = 36;
// 자연 바위 결 — 벽돌처럼 줄 맞추지 않고 얼룩과 금을 흩뿌린다
function rockTex(col, seed){
  const dk = shade(col, -18), lt = shade(col, 14), vein = shade(col, -34);
  return (x, y) => {
    if (hash2(x >> 1, (y + (x >> 2)) >> 1, seed + 7) > 0.93) return vein;
    const h = hash2(x >> 2, y >> 2, seed);
    return h > 0.78 ? lt : h < 0.2 ? dk : col;
  };
}
// 바위 덩이마다 u, v, 너비, 깊이, 높이 — 가운데가 가장 높고 그 앞면으로 물이 떨어진다
const FALL_ROCKS = [[0.05, 0.1, 0.7, 0.7, 24], [0.7, 0, 0.65, 0.75, FALL_Z + 2], [1.3, 0.08, 0.65, 0.7, 29]];
function fallFoot(b){ return { u: b.x + 1.02, v: b.y + 0.75 }; }
/* 작은 폭포 — 화산 섬의 꾸미개라 2026-10-06 부터 용암 폭포다. 현무암 바위 틈에서 용암이 쏟아져 발치에 끓는 웅덩이를 만든다.
   이끼 대신 윗면으로 넘쳐흐른 용암 자국, 얼지 않는다. */
function isoWaterfall(b, season){
  const crust = '#3a2a26';
  const cu = b.x + 1.4, cv = b.y + 1.12;
  FALL_ROCKS.forEach(([du, dv, su, sv, h], i) => {
    isoCube(b.x + du, b.y + dv, su, sv, 0, h, crust, rockTex('#3a3234', 'fl' + i), rockTex('#2a2426', 'fr' + i));
    for (let k = 0; k < 5; k++){ const u = b.x + du + su * (0.12 + k * 0.18), q = isoP(u, b.y + dv + sv, h); px(Math.round(q.x), Math.round(q.y), 1, 2 + Math.floor(hash2(k, i, 55) * 5), k % 2 ? '#ff5a1a' : '#c8360e'); }   // 흘러내린 용암 자국
  });
  isoEllipse(cu, cv, 0.66, 0.6, 0, '#2a2426');
  isoEllipse(cu, cv, 0.57, 0.5, 1, '#c8360e');
  isoEllipse(cu + 0.1, cv + 0.1, 0.32, 0.24, 1, '#ff8a1a');
  isoEllipse(cu + 0.14, cv + 0.12, 0.14, 0.1, 1, '#ffd84a');
  [[0.35, 1.0], [0.55, 1.55], [1.85, 1.5], [1.95, 0.95]].forEach(([du, dv], i) => isoDrum(b.x + du, b.y + dv, 0.12, 0, 5, i % 2 ? '#3a3234' : '#2a2426', '#4a4044'));
  { const q = isoP(cu, cv, 1); lamp(q.x, q.y, 30, '#ff6a1a'); }
}
// 떨어지는 물 — 줄무늬가 아래로 흐르고 발치에 물보라. 겨울엔 얼어서 멈춘다.
// 쏟아지는 용암 — 밝은 덩이가 줄무늬로 흘러내리고 발치엔 튀어 오르는 불티. 용암은 얼지 않는다.
function isoWaterfallLive(b, t){
  const f = fallFoot(b), k = STILL ? 0 : Math.floor(t / 110);
  for (let z = 0; z <= FALL_Z - 2; z++){
    const q = isoP(f.u, f.v, z), w = 6 + Math.round((FALL_Z - z) / FALL_Z * -2) + (z < 4 ? 2 : 0);
    const c = (z + k) % 7 < 2 ? '#ffe066' : (z + k) % 7 < 5 ? '#ff8a1a' : '#d8400e';
    px(Math.round(q.x - w / 2) - 1, Math.round(q.y), w + 2, 1, '#6a1a0c'); px(Math.round(q.x - w / 2), Math.round(q.y), w, 1, c);
  }
  if (STILL) return;
  const q = isoP(f.u + 0.05, f.v + 0.1, 1);
  for (let i = 0; i < 6; i++){
    const ph = ((t / 650) + i / 6) % 1, dx = (i - 2.5) * 3, h = Math.round(Math.sin(ph * Math.PI) * 7);
    px(Math.round(q.x + dx * (0.6 + ph)), Math.round(q.y) - h, 2, 2, i % 2 ? '#ffd84a' : '#ff6a1a');
  }
}
// ---- 농장마다 셋 더(2026-09-29 로키즈 「처음 농장과 확연히 다른 분위기」) ----
// 도트 원 — 통나무 끝·잉어 눈처럼 작은 동그라미
function pxDisc(x, y, r, col){ for (let dy = -r; dy <= r; dy++){ const w = Math.round(Math.sqrt(r * r - dy * dy + r * 0.8)); px(x - w, y + dy, w * 2 + 1, 1, col); } }
// 닻 — 밧줄 똬리 위에 비스듬히 박힌 쇠닻. 녹이 슬었다.
function isoAnchor(b){
  const cu = b.x + 0.5, cv = b.y + 0.55, IRON = '#4a5058', IRL = '#7a828c', RUST = '#9a5a3a';
  ishadow(cu, cv, 0.4, 0.3);
  for (let k = 0; k < 3; k++){ isoEllipse(cu, cv, 0.34 - k * 0.07, 0.3 - k * 0.06, k * 2, '#a8864f'); isoEllipse(cu, cv, 0.3 - k * 0.07, 0.26 - k * 0.06, k * 2 + 1, k % 2 ? '#c9a86a' : '#dcc088'); }
  isoEllipse(cu, cv, 0.1, 0.08, 6, '#8a6a3a');
  const q = isoP(cu, cv, 5), x = Math.round(q.x), y = Math.round(q.y);
  px(x - 1, y - 30, 3, 30, IRON); px(x - 1, y - 30, 1, 30, IRL);                               // 자루
  px(x - 9, y - 26, 19, 3, IRON); px(x - 9, y - 26, 19, 1, IRL); px(x - 11, y - 27, 3, 5, IRON); px(x + 9, y - 27, 3, 5, IRON);   // 가로대
  pxDisc(x, y - 34, 3, IRON); pxDisc(x, y - 34, 1, '#e8e0d0');                                  // 고리
  for (let i = 0; i <= 10; i++){ const a = Math.PI * (0.15 + i / 10 * 0.7), dx = Math.round(Math.cos(a) * 11), dy = Math.round(Math.sin(a) * 6); px(x - dx - 1, y - 2 + dy - 6, 3, 2, IRON); }   // 팔
  [[-12, -8], [11, -8]].forEach(([dx, dy]) => { px(x + dx - 1, y + dy - 3, 4, 4, IRON); px(x + dx - 1, y + dy - 3, 4, 1, IRL); });   // 갈고리 끝
  [[0, -18], [-6, -25], [5, -4]].forEach(([dx, dy]) => px(x + dx, y + dy, 2, 2, RUST));
  for (let i = 0; i < 5; i++) px(x - 2 + (i % 2) * 3, y - 34 + 4 + i * 2, 2, 2, '#c9a86a');     // 고리에서 내려온 밧줄
}
// 고깃배 — 그리스 카이키. 흰 몸에 파란 띠, 바닥은 빨강. 안에 가로대와 노.
function isoBoat(b){
  const cu = b.x + 1, cv = b.y + 0.5, H = 12;
  ishadow(cu, cv, 0.95, 0.4);
  for (let z = 0; z <= H; z++){
    const f = 0.55 + 0.45 * Math.sqrt(z / H), ru = 0.88 * f, rv = 0.34 * f;
    const col = z < 3 ? '#c8423a' : z >= H - 3 && z < H - 1 ? AEGEAN : z === H ? '#e6dfd2' : WHITEWASH;
    isoEllipse(cu, cv, ru, rv, z, roundTex(cu, cv, rv, col));
  }
  isoEllipse(cu, cv, 0.8, 0.28, H, '#b88a5a');                                                   // 속 바닥
  isoEllipse(cu + 0.02, cv + 0.02, 0.72, 0.22, H - 1, '#9a7048');
  [-0.35, 0.3].forEach(o => ibox(cu + o - 0.05, cv - 0.26, 0.1, 0.52, H - 3, H + 1, WOOD.mid));   // 앉는 가로대
  [cu - 0.92, cu + 0.92].forEach((u, i) => { const q = isoP(u, cv, H); px(Math.round(q.x) - 1, Math.round(q.y) - 6, 3, 8, i ? AEGEAN : '#e6dfd2'); });   // 뱃머리·꼬리
  { const q = isoP(cu - 0.55, cv + 0.34, H - 2); px(Math.round(q.x) - 4, Math.round(q.y), 9, 2, '#27405c'); }       // 뱃머리 눈
  const a = isoP(cu - 0.5, cv - 0.1, H + 2), c = isoP(cu + 0.75, cv + 0.25, 1);                   // 걸쳐 둔 노
  isoSeg(a, c, WOOD.dark, 2); px(Math.round(c.x) - 3, Math.round(c.y) - 1, 7, 3, WOOD.low);
}
// 파라솔 — 빨강·하양 여덟 쪽 우산과 줄무늬 수건
function isoParasol(b){
  const cu = b.x + 0.5, cv = b.y + 0.5, Z = 34;
  isoEllipse(cu + 0.18, cv + 0.18, 0.5, 0.46, 0, 'rgba(30,44,24,0.2)');
  poly3([[cu - 0.05, cv - 0.1, 0.5], [cu + 0.42, cv - 0.1, 0.5], [cu + 0.42, cv + 0.42, 0.5], [cu - 0.05, cv + 0.42, 0.5]], (x, y) => ((y + x * 0.5) >> 2) % 2 ? '#7cc4ff' : WHITEWASH);
  ipost(cu, cv, 0, Z, '#e8e2d6', 0.05);
  const o = isoP(cu, cv, Z);
  for (let k = 0; k < 8; k++){
    const r = 0.52 * (1 - k / 8);
    isoEllipse(cu, cv, r, r, Z - 2 + k, (x, y) => {
      const s = Math.floor(((Math.atan2((y - o.y) * 2, x - o.x) / Math.PI + 1) * 4 + 0.5)) % 2;
      const c = s ? '#e8584c' : WHITEWASH;
      return x > o.x + 10 ? shade(c, -22) : c;
    });
  }
  px(Math.round(o.x) - 1, Math.round(o.y) - 13, 3, 4, '#e8e2d6');
  for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; if (Math.sin(a) < -0.3) continue; const q = isoP(cu + Math.cos(a) * 0.52, cv + Math.sin(a) * 0.52, Z - 3); px(Math.round(q.x), Math.round(q.y), 2, 2, i % 2 ? '#e8584c' : '#f0e8dc'); }   // 술
}
// 장작더미 — 통나무 끝이 앞으로 보이게 쌓고 판자 지붕을 얹었다
function isoWoodpile(b, season){
  const u0 = b.x + 0.08, v0 = b.y + 0.2, v1 = b.y + 0.82;
  ishadow(b.x + 1, b.y + 0.5, 1, 0.4);
  ibox(u0, v0 - 0.05, 1.84, 0.08, 0, 38, '#241c1e');                                             // 뒤판
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9 - (r === 3 ? 2 : 0); i++){
    const u = u0 + 0.02 + i * 0.2 + (r % 2) * 0.1 + (r === 3 ? 0.2 : 0);
    if (u > u0 + 1.72) continue;
    const z = 1 + r * 8;
    ibox(u, v0, 0.19, v1 - v0, z, z + 7, '#2e2422', '#3a2e2a');                // 화산 섬 — 그을린 숯 장작(2026-10-06)
    const q = isoP(u + 0.095, v1, z + 3.5), x = Math.round(q.x), y = Math.round(q.y), h = hash2(i, r, 41);
    pxDisc(x, y, 3, '#1e1618'); pxDisc(x, y, 2, h > 0.72 ? '#ff6a1a' : h > 0.45 ? '#3a2a26' : '#2a201e'); px(x, y, 1, 1, h > 0.72 ? '#ffd84a' : '#120c0c');   // 나뭇결 끝 — 넷에 하나는 불씨가 남았다
  }
  [u0, u0 + 1.8].forEach(u => { ipost(u + 0.02, v1 + 0.02, 0, 40, '#241c1e', 0.07); });
  islope(u0 - 0.06, u0 + 1.9, v0 - 0.12, v1 + 0.14, 44, 36, '#3a3032');
}
// 불씨 항아리(옛 우유통, 2026-10-06 화산 섬으로 바꿈) — 검은 무쇠 항아리 셋, 붉은 쇠띠. 하나는 뚜껑이 열려 불씨가 보인다.
function isoMilkcans(b){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.42, 0.36);
  [[-0.2, -0.14, 0], [0.18, -0.08, 1], [-0.02, 0.2, 2]].forEach(([du, dv, i]) => {
    const u = cu + du, v = cv + dv, M = '#2e2628', T = '#4a4042';
    for (let k = 0; k < 16; k += 2){ const r = 0.1 + Math.sin(k / 16 * Math.PI) * 0.05; isoEllipse(u, v, r, r, k, roundTex(u, v, r, M)); isoEllipse(u, v, r, r, k + 1, roundTex(u, v, r, M)); }   // 배가 부른 항아리
    isoDrum(u, v, 0.142, 6, 8, '#8a3a22', '#a84a2a');                                          // 쇠띠
    isoDrum(u, v, 0.07, 16, 19, M, T);
    if (i === 1){ isoEllipse(u, v, 0.06, 0.06, 19, '#ff6a1a'); isoEllipse(u - 0.01, v - 0.01, 0.03, 0.03, 19, '#ffe066'); const q = isoP(u, v, 19); lamp(q.x, q.y, 14, '#ff7a2a'); }   // 열린 항아리 — 불씨
    else isoDrum(u, v, 0.09, 19, 21, '#1e1618', T);
    const q = isoP(u - 0.15, v, 12), r2 = isoP(u + 0.15, v, 12);
    px(Math.round(q.x) - 2, Math.round(q.y) - 2, 2, 4, '#1a1416'); px(Math.round(r2.x), Math.round(r2.y) - 2, 2, 4, '#1a1416');   // 손잡이
  });
}
// 용뿔 나팔(옛 알프호른, 2026-10-06 화산 섬으로 바꿈) — 긴 뿔 나팔. 입 대는 쪽은 받침 위, 끝은 땅에서 휘어 올라간다.
// 뼈빛 뿔에 검은 마디, 끝으로 갈수록 그을렸고, 나팔 입 속에서 불빛이 샌다.
function isoAlphorn(b){
  const cv = b.y + 0.5, u0 = b.x + 0.18, L = 1.6;
  ishadow(b.x + 1, cv, 0.95, 0.24);
  ipost(u0 + 0.22, cv - 0.08, 0, 15, '#241c1e', 0.05); ipost(u0 + 0.22, cv + 0.08, 0, 15, '#241c1e', 0.05);   // 받침
  for (let i = 0; i <= 80; i++){
    const f = i / 80, u = u0 + f * L, bell = f > 0.78 ? Math.pow((f - 0.78) / 0.22, 2) : 0;
    const z = 16 * (1 - f) + 2 + bell * 7, r = 0.028 + bell * 0.14;
    const band = Math.floor(f * 40) % 4 === 0;                                    // 뿔 마디
    isoEllipse(u, cv, 0.02 + bell * 0.03, r, z, roundTex(u, cv, r, band ? '#4a3e36' : mix('#d8cdb8', '#4a3a32', Math.min(1, f * f * 1.3))));
  }
  const e = isoP(u0 + L, cv, 11);
  pxDisc(Math.round(e.x) + 1, Math.round(e.y) - 1, 5, '#3a2e2a'); pxDisc(Math.round(e.x) + 1, Math.round(e.y) - 1, 3, '#c8360e'); px(Math.round(e.x), Math.round(e.y) - 2, 2, 2, '#ffd84a');   // 나팔 입 — 속에서 불빛
  { const q = isoP(u0, cv, 18); px(Math.round(q.x) - 2, Math.round(q.y) - 1, 3, 3, '#1e1618'); }                                    // 입 대는 곳
}
// 대나무 물통(시시오도시) — 돌 물확 위에 대나무 통이 기둥 사이에 걸려 있다. 통은 isoShishiLive 가 움직인다.
const SHISHI_Z = 13;
function isoShishi(b){
  const cu = b.x + 0.45, cv = b.y + 0.5, st = WA.stone, moss = '#7f9a5a', BAM = '#8fb85a';
  ishadow(cu + 0.05, cv, 0.44, 0.34);
  isoDrum(cu + 0.26, cv + 0.12, 0.2, 0, 6, shade(st, -8), st);                                   // 돌 물확
  isoEllipse(cu + 0.26, cv + 0.12, 0.14, 0.14, 6, '#4f7fa8'); isoEllipse(cu + 0.28, cv + 0.14, 0.07, 0.06, 6, '#7fb2d8');
  boulder(cu - 0.3, cv + 0.02, 0.1, 4, shade(st, -12));                                          // 통 끝이 두드리는 돌
  [[-0.38, 0.28], [0.44, -0.22], [0.02, 0.36]].forEach(([du, dv], i) => boulder(cu + du, cv + dv, 0.06, 2, i % 2 ? st : shade(st, -10)));
  ipost(cu - 0.02, cv - 0.1, 0, SHISHI_Z + 3, shade(BAM, -20), 0.05); ipost(cu - 0.02, cv + 0.1, 0, SHISHI_Z + 3, BAM, 0.05);   // 기둥 둘
  const a = isoP(cu + 0.62, cv - 0.28, 25), e = isoP(cu + 0.34, cv, 22);                         // 물 떨어지는 대롱
  isoSeg(a, e, shade(BAM, -24), 3); isoSeg({ x: a.x, y: a.y - 1 }, { x: e.x, y: e.y - 1 }, BAM, 1);
  { const q = isoP(cu + 0.62, cv - 0.28, 0); px(Math.round(q.x) - 1, Math.round(q.y) - 25, 3, 25, shade(BAM, -30)); }
  [[-0.2, 0.26], [0.4, 0.3]].forEach(([du, dv]) => { const q = isoP(cu + du, cv + dv, 1); px(Math.round(q.x) - 3, Math.round(q.y) - 1, 6, 2, moss); });
}
// 통이 천천히 차서(위로 들린 입) 딸깍 기울어 물을 쏟고, 되돌아와 뒤끝이 돌을 친다. 4초에 한 번.
function isoShishiLive(b, t){
  const cu = b.x + 0.45, cv = b.y + 0.5, BAM = '#8fb85a', p = STILL ? 0.3 : (t / 4000) % 1;
  const up = 0.38, dn = -0.5;
  const ang = p < 0.8 ? up : p < 0.84 ? up + (dn - up) * (p - 0.8) / 0.04 : p < 0.9 ? dn : p < 0.95 ? dn + (up - dn) * (p - 0.9) / 0.05 : up + Math.sin((p - 0.95) / 0.05 * Math.PI) * 0.06;
  for (let s2 = -0.28; s2 <= 0.34; s2 += 0.02){
    const u = cu + Math.cos(ang) * s2, z = SHISHI_Z + Math.sin(ang) * s2 * 30;
    const node = Math.abs(s2 - 0.06) < 0.012 || Math.abs(s2 + 0.16) < 0.012;
    isoEllipse(u, cv, 0.045, 0.045, z, roundTex(u, cv, 0.045, node ? shade(BAM, -18) : BAM));
  }
  const m = isoP(cu + Math.cos(ang) * 0.35, cv, SHISHI_Z + Math.sin(ang) * 0.35 * 30);            // 통 입
  px(Math.round(m.x) - 2, Math.round(m.y) - 2, 4, 3, '#3f5a2a');
  if (STILL) return;
  if (p < 0.8){ const s0 = isoP(cu + 0.34, cv, 21); for (let k = 0; k < 3; k++){ const y = Math.round(s0.y + ((t / 90 + k * 3) % 8)); px(Math.round(s0.x), y, 1, 2, '#bfe6f8'); } }   // 떨어지는 물
  else if (p < 0.92){ const q = isoP(cu + 0.28, cv + 0.12, 7); for (let k = 0; k < 5; k++) px(Math.round(q.x) - 4 + k * 2, Math.round(q.y) - 2 - (k % 2) * 2, 1, 1, '#dff4fd'); }   // 쏟은 물보라
}
// 잉어 깃발 — 긴 장대 끝에 바람개비, 오색 띠와 잉어 셋. 잉어는 isoKoiLive 가 바람 따라 흔든다.
const KOI_Z = 76;
function isoKoinobori(b){
  const cu = b.x + 0.5, cv = b.y + 0.5;
  ishadow(cu, cv, 0.3, 0.24);
  isoDrum(cu, cv, 0.14, 0, 4, '#8d8f88', '#a9a79f');
  isoDrum(cu, cv, 0.055, 4, KOI_Z + 4, '#9a7a4e', '#c9a878');                                  // 장대
  const q = isoP(cu, cv, KOI_Z + 4), x = Math.round(q.x), y = Math.round(q.y);
  pxDisc(x, y - 3, 2, '#f2c84b'); px(x - 5, y + 1, 11, 1, '#c8323a'); px(x, y - 4, 1, 10, '#c8323a');   // 금빛 공과 바람개비
}
function isoKoiLive(b, t){
  const q = isoP(b.x + 0.5, b.y + 0.5, KOI_Z), x0 = Math.round(q.x) - 2, y0 = Math.round(q.y), D = -1;   // 섬 가장자리 쪽 하늘로 날린다
  const k = STILL ? 0 : t, lift = Math.min(1, 0.4 + curWind * 0.6);
  // 오색 띠
  ['#2f6fb8', '#ffffff', '#c8323a', '#f2c84b', '#4f9a44'].forEach((c, i) => { for (let s = 0; s < 24; s++){ const w = Math.sin(k / 260 - s * 0.35) * 2 * (s / 24); px(x0 + D * Math.round(s * lift), y0 + i + Math.round(w + s * (1 - lift) * 0.8), 1, 1, c); } });
  [['#2b2f36', '#4a505a', 30], ['#d8322a', '#f07a6a', 25], ['#2f6fb8', '#7cc4ff', 20]].forEach(([c, hl, len], j) => {
    const yb = y0 + 10 + j * 10;
    for (let s = 0; s < len; s++){
      const w = Math.sin(k / 300 - s * 0.3 + j) * 2.2 * (s / len), th = Math.max(2, Math.round(6 * (1 - s / len * 0.55)));
      const xx = x0 + D * Math.round(s * lift), yy = yb + Math.round(w + s * (1 - lift) * 0.9) - (th >> 1);
      px(xx, yy, 1, th, (s + j) % 4 === 0 && s > 5 ? hl : c);
      if (s > 4 && s % 3 === 0) px(xx, yy + 1, 1, 1, '#ffffff66');
    }
    const tx = x0 + D * Math.round(len * lift) - 2, ty = yb + Math.round(Math.sin(k / 300 - len * 0.3 + j) * 2.2 + len * (1 - lift) * 0.9);
    px(tx, ty - 4, 3, 2, c); px(tx, ty + 2, 3, 2, c);                                            // 갈라진 꼬리
    px(x0, yb - 3, 2, 6, '#ffffff'); pxDisc(x0 - 4, yb - 1, 2, '#ffffff'); px(x0 - 4, yb - 1, 1, 1, '#1a1a1a');   // 입 테와 눈
  });
}
/* ---- 꽃구름 섬 꾸미개 — 일본에서만 볼 법한 것들(2026-10-07 로키즈 「꾸미개도 일본에서만 볼 수 있을 법한 아이템들로」) ----
   아이디는 그대로 두고(저장이 안 깨지게) 그림만 바꾼다. 전용 꾸미개는 farm-rules.js 의 이름·설명도 함께 바꿨다.
   열기구 → 음료 자판기 둘 · 무지개 다리 → 붉은 북다리 · 석등(toro) → 지장보살.
   공용 꾸미개의 꽃구름 그림: 분수 → 데미즈야(손 씻는 돌 수반) · 별 동상 → 마네키네코 · 깃발 → 연 · 모닥불 → 쇠주전자 건 화롯가 ·
   빨랫줄 → 유카타·손수건과 데루테루보즈 · 풍차 → 물레방앗간. */
function isoVending(b, night){
  const v0 = b.y + 0.55, d = 0.5;
  isoEllipse(b.x + 1, b.y + 1.05, 0.95, 0.55, 0, 'rgba(30,44,24,0.16)');
  isoCube(b.x + 0.15, v0 - 0.05, 1.5, d + 0.1, 0, 2, '#b8b4aa', '#a29e94', '#85827a');               // 콘크리트 받침
  [['#d8322a', '#b8261f', '#f4f4f4'], ['#f2f4f6', '#d6dade', '#2f6fb8']].forEach(([body, sideC, accent], i) => {
    const u = b.x + 0.2 + i * 0.72, w = 0.66;
    isoCube(u, v0, w, d, 2, 38, shade(body, 10), body, sideC);
    const G = { u0: u, u1: u + w, v0, v1: v0 + d };
    faceRect(G, 'L', 0.05, w - 0.05, 20, 34, night ? '#fff7d8' : '#e8eef4');                         // 진열창
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++){                                         // 줄줄이 선 깡통·병
      const a = 0.09 + k * (w - 0.2) / 4, c = ['#d8322a', '#2f6fb8', '#f2c230', '#4f9a44', '#8a5a3c'][(k + r * 2 + i) % 5];
      faceRect(G, 'L', a, a + 0.05, 22 + r * 4, 25 + r * 4, c);
      faceRect(G, 'L', a, a + 0.05, 21 + r * 4, 22 + r * 4, r === 1 ? '#ff5a4a' : '#5aff8a');            // 버튼 불
    }
    faceRect(G, 'L', 0.05, w - 0.05, 34, 37, accent);                                                // 위 간판 띠
    faceRect(G, 'L', w - 0.18, w - 0.08, 14, 18, '#3a3f48'); faceRect(G, 'L', w - 0.15, w - 0.12, 15, 17, '#c9ced4');   // 동전 넣는 곳
    faceRect(G, 'L', 0.08, w - 0.08, 4, 9, '#22262c');                                               // 꺼내는 칸
    if (i === 1) faceRect(G, 'L', 0.05, w - 0.05, 11, 13, '#2f6fb8');
    if (night){ const q = faceMid(G, 'L', w / 2, 27); lamp(q.x, q.y, 34, '#eaf6ff'); }
  });
  [0, 1].forEach(k => {                                                                              // 빈 깡통·병 수거함
    const u = b.x + 1.62, v = b.y + 1.2 + k * 0.3;
    isoCube(u, v, 0.26, 0.24, 0, 12, '#3a7bd5', '#2f6fb8', '#245a96');
    const q = isoP(u + 0.13, v + 0.12, 12); pxDisc(Math.round(q.x), Math.round(q.y), 1, '#1a2a40');
  });
}
function isoTaikoBridge(b){
  const u0 = b.x + 0.08, u1 = b.x + b.w - 0.08, cv = b.y + 0.5, w = 0.24, red = '#c8323a', redD = '#9a2228';
  // 다리 밑 개울 — 둥근 돌 사이로 물
  poly3([[u0 + 0.3, b.y + 0.02, 0], [u1 - 0.3, b.y + 0.02, 0], [u1 - 0.3, b.y + 0.98, 0], [u0 + 0.3, b.y + 0.98, 0]], '#4f8fc0');
  poly3([[u0 + 0.5, b.y + 0.1, 0], [u1 - 0.5, b.y + 0.1, 0], [u1 - 0.5, b.y + 0.9, 0], [u0 + 0.5, b.y + 0.9, 0]], '#6fb0dc');
  [[0.3, 0.15], [0.32, 0.8], [b.w - 0.36, 0.2], [b.w - 0.34, 0.85]].forEach(([du, dv], i) => boulder(b.x + du, b.y + dv, 0.09, 3, i % 2 ? WA.stone : '#8d8f88'));
  const Z = f => 3 + Math.sin(Math.PI * f) * 15;
  const rail = vv => {                                                                               // 난간 — 기둥마다 청동 의보주
    for (let k = 0; k <= 8; k++){ const f = k / 8, q = isoP(u0 + f * (u1 - u0), vv, Z(f) + 2); px(Math.round(q.x), Math.round(q.y) - 7, 2, 7, k % 4 ? red : redD); if (k % 4 === 0){ px(Math.round(q.x) - 1, Math.round(q.y) - 10, 4, 3, '#7f9a72'); px(Math.round(q.x), Math.round(q.y) - 11, 2, 1, '#c9d6a6'); } }
    for (let i = 0; i < 40; i++){ const f = i / 40, g = (i + 1) / 40; isoSeg(isoP(u0 + f * (u1 - u0), vv, Z(f) + 8), isoP(u0 + g * (u1 - u0), vv, Z(g) + 8), red, 2); }
  };
  rail(cv - w);
  for (let i = 0; i < 36; i++){                                                                      // 둥글게 솟은 다리 판
    const f = i / 36, ua = u0 + f * (u1 - u0), du = (u1 - u0) / 36, z = Z(f + 0.5 / 36);
    isoCube(ua, cv - w, du, w * 2, z - 3, z, i % 3 ? '#9a7650' : '#8a6a44', redD, shade(redD, -20));
  }
  for (let k = 1; k < 4; k++){ const f = k / 4, q = isoP(u0 + f * (u1 - u0), cv + w, 0), top = isoP(u0 + f * (u1 - u0), cv + w, Z(f) - 3); px(Math.round(q.x) - 1, Math.round(top.y), 3, Math.round(q.y - top.y), '#3a2a22'); }   // 다리 발
  rail(cv + w);
}
function isoJizo(b, night){
  const cu = b.x + 0.5, cv = b.y + 0.5, st = '#9a978f';
  ishadow(cu, cv, 0.3, 0.26);
  isoCube(cu - 0.22, cv - 0.2, 0.44, 0.4, 0, 5, shade(st, 10), st, shade(st, -26));                   // 받침돌
  boulder(cu, cv, 0.16, 16, st, 5);                                                                  // 몸 — 둥근 옷자락
  boulder(cu, cv, 0.12, 9, shade(st, 6), 20);                                                        // 머리
  { const q = isoP(cu, cv + 0.12, 26), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y, 2, 1, '#5a5852'); px(x + 2, y, 2, 1, '#5a5852'); px(x - 1, y + 3, 3, 1, '#6a6862'); }   // 감은 눈, 웃는 입
  { const q = isoP(cu, cv + 0.16, 19), x = Math.round(q.x), y = Math.round(q.y); for (let r = 0; r < 7; r++) px(x - 6 + r, y + r, 13 - r * 2, 1, r ? '#d8322a' : '#a8261f'); }   // 붉은 턱받이
  { const q = isoP(cu, cv, 30), x = Math.round(q.x), y = Math.round(q.y); px(x - 5, y - 2, 10, 3, '#c8323a'); px(x - 4, y - 4, 8, 2, '#d8322a'); px(x - 1, y - 6, 2, 2, '#e8554c'); }   // 뜨개 모자
  { const q = isoP(cu + 0.3, cv + 0.26, 0), x = Math.round(q.x), y = Math.round(q.y); px(x - 2, y - 3, 4, 3, '#e8e4d8'); px(x - 1, y - 4, 2, 1, '#8a6a3a'); }   // 공양 잔
  { const q = isoP(cu - 0.28, cv + 0.24, 0), x = Math.round(q.x), y = Math.round(q.y); px(x, y - 14, 1, 14, '#6a4a2e'); px(x - 3, y - 17, 3, 3, '#ff8fb8'); px(x + 1, y - 17, 3, 3, '#7cc4ff'); px(x - 1, y - 19, 3, 2, '#ffe066'); px(x - 1, y - 15, 3, 2, '#8fdc8a'); }   // 바람개비
  const c = isoP(cu + 0.12, cv + 0.3, 0), cx = Math.round(c.x), cy = Math.round(c.y);              // 초
  px(cx, cy - 5, 2, 5, '#f6efd9'); px(cx, cy - 7, 2, 2, night ? '#ffd84a' : '#5a4a36');
  if (night) lamp(cx, cy - 6, 20, '#ffcf7a');
}
function isoChozuya(b, night){
  const G = isoGeo(b, 0.32, 40), st = WA.stone, cu = (G.u0 + G.u1) / 2, cv = (G.v0 + G.v1) / 2;
  isoShadow(G);
  isoCube(G.u0 - 0.12, G.v0 - 0.12, G.u1 - G.u0 + 0.24, G.v1 - G.v0 + 0.24, 0, 2, shade(st, 8), shade(st, -6), shade(st, -30));   // 돌 바닥
  const P = (u, v) => ibox(u - 0.06, v - 0.06, 0.12, 0.12, 2, G.H, WA.post);
  P(G.u0, G.v0); P(G.u1, G.v0);
  const bu = cu - 0.5, bv = cv - 0.22;
  isoCube(bu, bv, 1.0, 0.44, 2, 12, shade(st, 14), st, shade(st, -26));                              // 돌 수반
  poly3([[bu + 0.06, bv + 0.06, 12], [bu + 0.94, bv + 0.06, 12], [bu + 0.94, bv + 0.38, 12], [bu + 0.06, bv + 0.38, 12]], '#3f7fa8');
  poly3([[bu + 0.3, bv + 0.12, 12], [bu + 0.7, bv + 0.12, 12], [bu + 0.7, bv + 0.26, 12], [bu + 0.3, bv + 0.26, 12]], '#6fa8d0');
  isoSeg(isoP(G.u0 + 0.04, G.v0 + 0.1, 24), isoP(bu + 0.22, cv - 0.06, 18), '#6f9a44', 3);           // 대나무 홈통
  isoSeg(isoP(G.u0 + 0.04, G.v0 + 0.1, 25), isoP(bu + 0.22, cv - 0.06, 19), '#a9d070', 1);
  isoSeg(isoP(bu + 0.08, cv + 0.18, 13), isoP(bu + 0.92, cv + 0.18, 13), '#b9c46a', 2);              // 국자 얹는 대
  for (let k = 0; k < 4; k++){                                                                       // 대나무 국자 넷
    const u = bu + 0.2 + k * 0.2;
    isoSeg(isoP(u, cv + 0.18, 14), isoP(u + 0.06, cv - 0.12, 13), '#c9a878', 1);
    isoDrum(u, cv + 0.2, 0.05, 12, 16, '#c9a878', '#e0c494');
  }
  P(G.u0, G.v1); P(G.u1, G.v1);
  const e = 0.24;
  isoRoof(G, { ridge: 'u', rise: 14, roof: WA.tile, wall: WA.post, gable: WA.post, eave: e, open: true });
  tileCaps(isoP(G.u0 - e, G.v1 + e, G.H - 2), isoP(G.u1 + e, G.v1 + e, G.H - 2), 0.16 * IT / 2);
  isoSeg(isoP(G.u0, G.v1 + 0.02, G.H - 4), isoP(G.u1, G.v1 + 0.02, G.H - 4), '#d9c08a', 2);         // 시메나와 금줄과 흰 종이 술
  [0.25, 0.5, 0.75].forEach(f => { const q = isoP(G.u0 + f * (G.u1 - G.u0), G.v1 + 0.02, G.H - 5), x = Math.round(q.x), y = Math.round(q.y); px(x, y, 2, 2, '#ffffff'); px(x + 1, y + 2, 2, 2, '#ffffff'); px(x, y + 4, 2, 2, '#ffffff'); });
  if (night){ const q = isoP(cu, cv, G.H - 8); lamp(q.x, q.y, 24, '#ffe3a8'); }
}
// 데미즈야 물 — 대나무 홈통 끝에서 수반으로 졸졸, 물 위에 고리가 번진다
function chozuyaLive(b, t){
  if (STILL) return;
  const G = isoGeo(b, 0.32, 40), cu = (G.u0 + G.u1) / 2, cv = (G.v0 + G.v1) / 2, s0 = isoP(cu - 0.28, cv - 0.06, 18);
  for (let k = 0; k < 3; k++){ const y = Math.round(s0.y + ((t / 80 + k * 2) % 6)); px(Math.round(s0.x), y, 1, 2, '#cfeefc'); }
  const r = (t / 1400) % 1, q = isoP(cu - 0.28, cv - 0.04, 12), w = Math.round(2 + r * 7);
  ctx.globalAlpha = 1 - r; px(Math.round(q.x) - w, Math.round(q.y), w * 2, 1, '#d8f1fc'); ctx.globalAlpha = 1;
}
function isoManeki(b, night){
  const cu = b.x + 0.5, cv = b.y + 1, st = '#8d8f88', wh = '#fbf8f0', sh = '#e6e0d2';
  ishadow(cu, cv, 0.46, 0.52);
  isoCube(cu - 0.42, cv - 0.5, 0.84, 1.0, 0, 8, shade(st, 10), st, shade(st, -26));                   // 돌 받침
  isoCube(cu - 0.32, cv - 0.36, 0.64, 0.72, 8, 12, '#e8554c', '#c8323a', '#9a2228');                  // 붉은 방석
  [[-0.32, -0.36], [0.28, -0.36], [-0.32, 0.32], [0.28, 0.32]].forEach(([a, c2]) => { const q = isoP(cu + a + 0.02, cv + c2 + 0.02, 12); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3, '#f2c230'); });   // 방석 술
  boulder(cu, cv, 0.26, 18, wh, 12);                                                                 // 몸
  isoDrum(cu, cv, 0.22, 28, 30, '#d8322a', '#e8554c');                                               // 붉은 목줄
  boulder(cu, cv, 0.24, 15, wh, 30);                                                                 // 머리
  const F = (du, z) => { const q = isoP(cu + du, cv + 0.24, z); return [Math.round(q.x), Math.round(q.y)]; };
  { const [x, y] = F(0, 26); pxDisc(x, y + 1, 2, '#f2c230'); px(x - 1, y + 1, 2, 1, '#8a6a1a'); }    // 금방울
  { const [x, y] = F(0.02, 20); px(x - 5, y - 3, 10, 7, '#f2c230'); px(x - 4, y - 2, 8, 5, '#ffe066'); px(x - 2, y - 1, 4, 1, '#b8740e'); px(x - 2, y + 1, 4, 1, '#b8740e'); }   // 고반(금화)
  { const [x, y] = F(0, 38); px(x - 5, y, 3, 1, '#2b2f36'); px(x + 3, y, 3, 1, '#2b2f36'); px(x - 4, y - 1, 1, 1, '#2b2f36'); px(x + 4, y - 1, 1, 1, '#2b2f36');   // 웃는 눈
    px(x - 1, y + 2, 2, 1, '#ff8fa3'); px(x - 2, y + 4, 1, 1, '#2b2f36'); px(x + 1, y + 4, 1, 1, '#2b2f36');
    px(x - 9, y + 2, 4, 1, '#c9c2b2'); px(x + 6, y + 2, 4, 1, '#c9c2b2'); px(x - 4, y + 3, 2, 1, '#ffc2d0'); px(x + 3, y + 3, 2, 1, '#ffc2d0'); }   // 수염·볼
  [[-0.14, '#2b2f36'], [0.14, wh]].forEach(([du, c]) => { const q = isoP(cu + du, cv, 46), x = Math.round(q.x), y = Math.round(q.y); for (let r = 0; r < 5; r++) px(x - r, y - 4 + r, r * 2 + 1, 1, c); px(x, y - 2, 1, 2, '#ffb7c5'); });   // 귀 — 하나는 검은 얼룩
  { const q = isoP(cu - 0.1, cv - 0.06, 38), x = Math.round(q.x), y = Math.round(q.y); px(x - 3, y - 2, 6, 3, '#f2a65a'); px(x + 4, y + 2, 4, 3, '#2b2f36'); }   // 삼색 얼룩
  { const [x, y] = F(-0.26, 30); px(x - 2, y - 18, 5, 18, wh); px(x - 2, y - 18, 1, 18, sh); px(x - 3, y - 21, 7, 4, wh); px(x - 1, y - 20, 3, 2, '#ffb7c5'); }   // 번쩍 든 앞발 — 별을 부른다
  { const [x, y] = F(0.12, 18); px(x - 2, y - 2, 6, 6, wh); px(x - 2, y + 3, 6, 1, sh); }             // 고반 쥔 앞발
  const sc = isoStarAt(b);
  paintStar(sc, 3);
  if (night){ lamp(sc.cx, sc.cy, 40, '#ffe6a0'); const q = isoP(cu, cv, 20); lamp(q.x, q.y, 18, '#ffd36a'); }
}
// 연 — 흰 바탕 붉은 테에 먹으로 그린 무사 얼굴, 꼬리 둘. 깃대 끝 실에 매여 바람 따라 오르내린다.
function kiteLive(b, t){
  const p0 = isoP(b.x + 0.5, b.y + 0.5, 46), k = STILL ? 0 : t, wind = 0.6 + curWind * 0.5;
  const kx = Math.round(p0.x - 26 - Math.sin(k / 1700) * 6), ky = Math.round(p0.y - 46 - Math.sin(k / 1100) * 5 * wind), tilt = Math.round(Math.sin(k / 600) * 1.5);
  for (let i = 0; i <= 20; i++){ const f = i / 20, x = p0.x + (kx + 7 - p0.x) * f, y = p0.y + (ky + 18 - p0.y) * f + Math.sin(Math.PI * f) * 6; px(Math.round(x), Math.round(y), 1, 1, '#f4efe6'); }   // 늘어진 실
  for (let r = 0; r < 18; r++){ const dx = Math.round(tilt * r / 18); px(kx + dx, ky + r, 15, 1, r < 2 || r > 15 ? '#c8323a' : '#fbf6ea'); px(kx + dx, ky + r, 1, 1, '#c8323a'); px(kx + dx + 14, ky + r, 1, 1, '#c8323a'); }
  px(kx + 3, ky + 5, 4, 1, '#1a1a1a'); px(kx + 8, ky + 5, 4, 1, '#1a1a1a'); px(kx + 4, ky + 7, 2, 2, '#1a1a1a'); px(kx + 9, ky + 7, 2, 2, '#1a1a1a');   // 치켜뜬 눈썹·눈
  px(kx + 6, ky + 10, 3, 1, '#c8323a'); px(kx + 4, ky + 12, 7, 2, '#c8323a'); px(kx + 2, ky + 3, 11, 1, '#2f3f6e');   // 코·입·머리띠
  [3, 11].forEach((o, j) => { for (let s = 0; s < 16; s++){ const w = Math.round(Math.sin(k / 220 - s * 0.5 + j) * 2 * (s / 16)); px(kx + o + w + Math.round(tilt * (18 + s) / 18), ky + 18 + s, 1, 1, s % 5 < 3 ? '#e8453c' : '#ffd166'); } });   // 꼬리
}
function isoKettleFire(b, night){
  const cu = b.x + 0.5, cv = b.y + 0.5, st = '#6d6f6a';
  isoEllipse(cu, cv, 0.34, 0.34, 0, '#3a3226');
  for (let i = 0; i < 9; i++){ const a = i / 9 * Math.PI * 2, u = cu + Math.cos(a) * 0.3, v = cv + Math.sin(a) * 0.3; ibox(u - 0.07, v - 0.06, 0.14, 0.12, 0, 5 + (i % 2), shade(st, (i % 3) * 8 - 8)); }
  isoEllipse(cu, cv, 0.16, 0.16, 1, '#5a4a3a'); isoEllipse(cu - 0.03, cv, 0.08, 0.08, 2, night ? '#ff8a3a' : '#8a3a22');   // 숯
  const top = isoP(cu, cv, 40);
  [[-0.32, -0.18], [0.3, -0.16], [0.02, 0.34]].forEach(([a, c2], i) => isoSeg(isoP(cu + a, cv + c2, 0), top, i === 2 ? '#a9c46a' : '#8fa850', 2));   // 대나무 세 발
  px(Math.round(top.x) - 1, Math.round(top.y) - 3, 3, 3, '#5a4a2a');                                // 묶은 끈
  isoSeg(top, isoP(cu, cv, 22), '#3a3a3a', 1);                                                       // 자재갈고리
  isoDrum(cu, cv, 0.15, 12, 20, '#2e2a28', '#4a4642'); isoEllipse(cu, cv, 0.08, 0.08, 20, '#3a3632');   // 쇠주전자
  for (let z = 13; z < 19; z += 2){ const q = isoP(cu - 0.06, cv + 0.15, z); px(Math.round(q.x), Math.round(q.y), 1, 1, '#5a5652'); }   // 쇠 오돌토돌
  isoSeg(isoP(cu + 0.12, cv + 0.08, 17), isoP(cu + 0.26, cv + 0.12, 20), '#2e2a28', 2);              // 주둥이
  { const a = isoP(cu - 0.15, cv, 20), c = isoP(cu + 0.15, cv, 20); for (let i = 0; i <= 10; i++){ const f = i / 10; px(Math.round(a.x + (c.x - a.x) * f), Math.round(a.y + (c.y - a.y) * f - Math.sin(Math.PI * f) * 6), 1, 1, '#4a4642'); } }   // 손잡이
  isoDrum(cu + 0.34, cv + 0.18, 0.08, 0, 5, '#8a6a3a', '#c9a878');                                    // 찻잔 둘
  isoDrum(cu + 0.18, cv + 0.34, 0.07, 0, 4, '#4f7a9a', '#7fa8c8');
}
function kettleSteam(b, t){
  if (STILL) return;
  const q = isoP(b.x + 0.5 + 0.26, b.y + 0.5 + 0.12, 21);
  for (let k = 0; k < 4; k++){ const ph = (t / 1600 + k / 4) % 1; ctx.globalAlpha = 0.7 * (1 - ph); px(Math.round(q.x + Math.sin(t / 400 + k) * 2 + ph * 6), Math.round(q.y - ph * 18), 2, 2, '#ffffff'); }
  ctx.globalAlpha = 1;
}
// 데루테루보즈 — 맑은 날을 비는 흰 천 인형. 빨랫줄 끝에 매달려 흔들린다.
function teruteru(x, y, sw){
  const X = Math.round(x + sw), Y = Math.round(y);
  isoSeg({ x, y: y - 4 }, { x: X, y: Y }, '#8a7a63', 1);
  pxDisc(X, Y + 3, 3, '#ffffff'); px(X - 1, Y + 2, 1, 1, '#2b2f36'); px(X + 1, Y + 2, 1, 1, '#2b2f36'); px(X, Y + 4, 1, 1, '#ff8fa3');
  px(X - 1, Y + 6, 3, 1, '#d8322a');
  for (let r = 0; r < 5; r++) px(X - 2 - (r >> 1), Y + 7 + r, 5 + (r >> 1) * 2, 1, r === 4 ? '#e6e6e6' : '#ffffff');
}
function isoSuisha(b, night){
  const cu = b.x + b.w / 2, cv = b.y + b.h / 2 - 0.15, G = { u0: cu - 0.5, u1: cu + 0.5, v0: cv - 0.45, v1: cv + 0.3, H: 22 };
  isoShadow(G);
  isoWalls(G, '#8a6440', 'wood', 61);
  faceRect(G, 'L', 0.62, 0.86, 0, 14, '#3a2a1f');                                                    // 문
  faceRect(G, 'R', 0.25, 0.5, 10, 16, night ? '#ffd98a' : '#3a2a1f');
  isoRoof(G, { ridge: 'v', rise: 18, roof: '#c9a86a', wall: '#8a6440', gable: '#8a6440', eave: 0.22, straw: true });   // 짚 지붕
  // 물길 — 왼쪽 뒤에서 오는 나무 홈통이 바퀴 위로 물을 붓는다
  const wu = cu - 0.12, wv = G.v1 + 0.16;
  [[cu - 1.0, 0], [cu - 0.55, 0]].forEach(([u]) => ipost(u, wv, 0, 40, WA.post, 0.06));
  isoCube(cu - 1.05, wv - 0.07, 0.95, 0.14, 40, 43, '#a9794f', '#8a6440', '#6a4a30');
  poly3([[cu - 1.0, wv - 0.04, 43], [cu - 0.12, wv - 0.04, 43], [cu - 0.12, wv + 0.04, 43], [cu - 1.0, wv + 0.04, 43]], '#6fb0dc');
  // 바퀴 밑 물받이 도랑
  poly3([[wu - 0.55, wv + 0.18, 0], [wu + 0.6, wv + 0.18, 0], [wu + 0.6, wv + 0.42, 0], [wu - 0.55, wv + 0.42, 0]], '#4f8fc0');
  isoSeg(isoP(wu - 0.5, wv + 0.3, 0), isoP(wu + 0.55, wv + 0.3, 0), '#9fd0ec', 1);
}
function suishaLive(b, t){
  const cu = b.x + b.w / 2, cv = b.y + b.h / 2 - 0.15, wu = cu - 0.12, wv = cv + 0.3 + 0.2, ang = STILL ? 0.3 : t / 2200, R0 = 0.66, zc = 22;
  const P = (a, r) => isoP(wu + Math.cos(a) * r, wv, zc + Math.sin(a) * r * 30);
  for (let i = 0; i < 64; i++){ const a = i / 64 * Math.PI * 2, q = P(a, R0), q2 = P(a, R0 * 0.55); px(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3, '#5a4030'); px(Math.round(q2.x), Math.round(q2.y), 2, 2, '#6a4a30'); }   // 바깥·안 바퀴 테
  for (let i = 0; i < 8; i++){
    const a = ang + i * Math.PI / 4;
    isoSeg(P(a, 0), P(a, R0), '#6a4a30', 2);
    const q = P(a, R0 + 0.06); px(Math.round(q.x) - 3, Math.round(q.y) - 2, 6, 5, '#8a6440'); px(Math.round(q.x) - 3, Math.round(q.y) - 2, 6, 1, '#a9794f');   // 물을 받는 판
  }
  { const h = P(0, 0); px(Math.round(h.x) - 2, Math.round(h.y) - 2, 5, 5, '#3a2a1f'); }
  if (STILL) return;
  const s0 = isoP(cu - 0.12, cv + 0.3 + 0.16, 43), bot = P(Math.PI / 2, R0).y;                                                   // 홈통에서 떨어지는 물
  for (let k = 0; k < 6; k++){ const y = Math.round(s0.y + ((t / 60 + k * 4) % Math.max(4, bot - s0.y))); px(Math.round(s0.x) + (k % 2), y, 2, 2, k % 3 ? '#cfeefc' : '#ffffff'); }
}
function isoOwnLive(id, b, t, L, season){
  if (id === 'palm') isoPalmLeaves(b, t);
  else if (id === 'waterfall') isoWaterfallLive(b, t);
  else if (id === 'shishi') isoShishiLive(b, t);
  else if (id === 'koinobori') isoKoiLive(b, t);
}
// 등대 불빛 — 밤빛을 입힌 뒤에 더해야 어두운 바다 위로 또렷하다
function isoBeam(g, t, L){
  if (!L.lamp || !here('lighthouse') || !W.decor.lighthouse) return;
  const b = spot('lighthouse'), o = isoP(b.x + 0.5, b.y + 0.5, 58), a = STILL ? 2.4 : t / 1500, w = 0.12, len = 170;
  g.save(); g.globalCompositeOperation = 'lighter'; ctx = g;
  polyFill([[o.x, o.y], [o.x + Math.cos(a - w) * len, o.y + Math.sin(a - w) * len * 0.5], [o.x + Math.cos(a + w) * len, o.y + Math.sin(a + w) * len * 0.5]], 'rgba(255,226,140,0.3)');
  g.restore();
}
function paintIsoThing(id, b, cal, night, season){
  if (id === 'lighthouse') return isoLighthouse(b, night);
  if (id === 'palm') return isoPalm(b);
  if (id === 'cairn') return isoCairn(b, season);
  if (id === 'waterfall') return isoWaterfall(b, season);
  if (id === 'balloon') return isoVending(b, night);
  if (id === 'skybridge') return isoTaikoBridge(b);
  if (id === 'anchor') return isoAnchor(b);
  if (id === 'boat') return isoBoat(b);
  if (id === 'parasol') return isoParasol(b);
  if (id === 'woodpile') return isoWoodpile(b, season);
  if (id === 'milkcans') return isoMilkcans(b);
  if (id === 'alphorn') return isoAlphorn(b);
  if (id === 'shishi') return isoShishi(b);
  if (id === 'koinobori') return isoKoinobori(b);
  if (id === 'toro') return isoJizo(b, night);
  isoSnow = season === 'winter';
  const th = isoTheme();
  if (id === 'house') return th === 'mountain' ? isoHouseChalet(b, night) : th === 'cloud' ? isoHouseJp(b, night) : isoHouseGreek(b, night);
  if (id === 'stall') return isoStall(b, cal);
  if (id === 'coop') return th === 'mountain' ? isoCoopSwiss(b, night) : th === 'cloud' ? isoCoopWa(b, night) : isoCoopGreek(b, night);
  if (id === 'barn') return th === 'mountain' ? isoBarnSwiss(b, night) : th === 'cloud' ? isoKura(b, night) : isoBarnGreek(b, night);
  if (id === 'greenhouse') return isoGreenhouse(b, night);
  if (id === 'pasture') return isoPastureBack(b);
  if (id === 'fountain') return isoFountain(b, night);
  if (ISO_PROP[id]) return ISO_PROP[id](b, night, season, th);
  withBB(bbOffset(b), () => {
    if (id === 'mail') withInk(INK.build, drawMail);
    else if (id === 'board') withInk(INK.build, drawBoard);
    else if (id === 'well') withInk(INK.build, () => drawWell(night));
    else if (id === 'pethouse') withInk(INK.build, () => drawPethouse(night));
    else if (id === 'hive') withInk(INK.build, drawHive);
    else if (id === 'scarecrow') withInk(INK.build, drawScarecrow);
    else onlyDecor(id, () => drawDecor(season, night));
  });
}
// 누른 자리에 무엇이 서 있나 — 앞에 그린 것부터, 담아 둔 그림의 그 도트가 비었는지까지 본다
function isoHitTile(x, y){
  for (let i = isoHits.length - 1; i >= 0; i--){
    const h = isoHits[i];
    if (h.e){
      const dx = Math.floor(x * S) - h.e.ox, dy = Math.floor(y * S) - h.e.oy;
      if (dx < 0 || dy < 0 || dx >= h.e.cv.width || dy >= h.e.cv.height) continue;
      let a = 0;
      try { a = h.e.cv.getContext('2d').getImageData(dx, dy, 1, 1).data[3]; } catch (err) { a = 0; }
      if (a > 90) return { tx: h.tx, ty: h.ty };
    } else if (x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1) return { tx: h.tx, ty: h.ty };
  }
  return null;
}
function isoPlaceOverlay(t){
  ctx.globalAlpha = 0.45;
  for (let u = 0; u <= COLS; u++) isoSeg(isoP(u, 0), isoP(u, ROWS), '#ffffff', 1);
  for (let v = 0; v <= ROWS; v++) isoSeg(isoP(0, v), isoP(COLS, v), '#ffffff', 1);
  const dia = (b, c) => poly3([[b.x, b.y, 0], [b.x + b.w, b.y, 0], [b.x + b.w, b.y + b.h, 0], [b.x, b.y + b.h, 0]], c);
  ctx.globalAlpha = 0.22; R.fieldCells(W).forEach(c => dia({ x: c.x, y: c.y, w: 1, h: 1 }, '#ff5a4a')); ctx.globalAlpha = 1;
  R.PLACE_IDS.forEach(id => {
    if (!here(id)) return;
    const b = spot(id), c = id === placePick ? (Math.sin(t / 180) > 0 ? '#ffe066' : '#ffffff') : R.PLACE[id].move ? '#7fe0a8' : '#ff9aa2';
    const a = isoP(b.x, b.y), r = isoP(b.x + b.w, b.y), f = isoP(b.x + b.w, b.y + b.h), l = isoP(b.x, b.y + b.h);
    [[a, r], [r, f], [f, l], [l, a]].forEach(([p, q]) => isoSeg(p, q, c, 2));
  });
  Object.keys(R.NODES).map(n => Object.assign({ id: n }, nodeOf(n))).concat(R.sceneryOf(W)).forEach(N => {   // 채집 나무·바위·덤불과 풍경 — 한 칸 초록 테두리
    const c = N.id === placePick ? (Math.sin(t / 180) > 0 ? '#ffe066' : '#ffffff') : '#7fe0a8';
    const a = isoP(N.x, N.y), r = isoP(N.x + 1, N.y), f = isoP(N.x + 1, N.y + 1), l = isoP(N.x, N.y + 1);
    [[a, r], [r, f], [f, l], [l, a]].forEach(([p, q]) => isoSeg(p, q, c, 1));
  });
}
// 한 장 — 아이소 섬
function drawFarmIso(cv, g, t, cal, season, wk, L, windStep){
  const cw = cv.width, ch = cv.height, hs = spot('house');
  paintLayer('iground', cw, ch, 'i|' + sigGround(season, wk) + '|' + hs.x + ',' + hs.y, () => isoGround(season));
  const sigB = sigBuilt(cal, L.lamp);
  paintLayer('ifloor', cw, ch, 'i|' + season + '|' + sigField() + '|' + sigB, () => { isoFloor(season); isoField(); });
  g.drawImage(composeBack(cw, ch, ['iground', 'ifloor']), 0, 0);
  ctx = g; lamps = []; isoHits = []; cropHits = [];
  if (isoLook().below === 'lava') isoLavaBack(t);
  if (isoTheme() === 'cloud') isoTrain(t, L);
  const cast = [];
  isoCropBands(cast, windStep);
  R.PLACE_IDS.forEach(id => {
    if (!here(id) || id === 'path' || id === 'pond') return;
    const b = spot(id);
    cast.push({ d: id === 'pasture' ? b.x + b.y + 0.3 : b.x + b.w / 2 + b.y + b.h / 2, go: () => {
      if (seeThrough) ctx.globalAlpha = SEE_ALPHA;
      const paint = part => () => { stallPart = part; try { paintIsoThing(id, b, cal, L.lamp, season); } finally { stallPart = null; } };
      if (id === 'stall'){                                                     // 가게는 뒤 겹 → 서성이는 아저씨 → 앞 겹
        isoHits.push({ e: isoSprite('stall:b', sigB + '|' + season + '|' + id, isoBoxOf(b), paint('back'), INK.build), tx: b.x, ty: b.y });
        drawStallKeeperIso(b, t);
      }
      const e = isoSprite(id, sigB + '|' + season + '|' + id, isoBoxOf(b), paint(id === 'stall' ? 'front' : null), INK.build);
      for (let i = 0; i < e.lamps.length; i++) lamps.push(e.lamps[i]);
      isoHits.push({ e, tx: b.x, ty: b.y });
      if (ISO_OWN[id]) isoOwnLive(id, b, t, L, season);
      else if (ISO_PROP_LIVE[id]) ISO_PROP_LIVE[id](b, t, L, season, isoTheme());
      else if (W.decor[id]) withBB(bbOffset(b), () => onlyDecor(id, () => drawDecorLive(season, t, L)));
      ctx.globalAlpha = 1;
    } });
  });
  if (here('pond')){ const b = spot('pond'); cast.push({ d: b.x + b.y + 1, go: () => drawPondLive(season, t, L) }); }
  isoFrontFences(cast);
  Object.keys(R.NODES).forEach(n => {
    const N = nodeOf(n);
    cast.push({ d: N.x + N.y + 1, go: () => {
      const ready = W && M ? R.nodeReady(W, M, n, now()) : true;
      if (seeThrough) ctx.globalAlpha = SEE_ALPHA;
      isoSprite('n:' + n, isoTheme() + '|' + season + '|' + (ready ? 1 : 0) + '|' + N.x + ',' + N.y, nodeBox(N), () => isoNode(n, N, ready, season, isoTheme()), INK.tree);
      ctx.globalAlpha = 1;
      const q = isoP(N.x + 0.5, N.y + 0.62);
      isoHits.push({ x0: q.x - 16, x1: q.x + 16, y0: q.y - 50, y1: q.y + 6, tx: N.x, ty: N.y });
    } });
  });
  // 풍경 — 채집 자리처럼 캐고 벤다. 나무는 둘에 하나를 짝 나무 모양(사이프러스 등)으로, 덤불은 열매 없이 사철
  R.sceneryOf(W).forEach((c, i) => {
    const N = { kind: c.kind, x: c.x, y: c.y, season: ['spring', 'summer', 'autumn', 'winter'] }, k = c.kind === 'tree' ? (i % 2 ? 'tree2' : 'tree1') : c.id;
    cast.push({ d: c.x + c.y + 1, go: () => {
      // 채집한 날은 그루터기·돌 부스러기·열매 없는 덤불
      const ready = W && M ? R.nodeReady(W, M, c.id, now()) : true;
      if (seeThrough) ctx.globalAlpha = SEE_ALPHA;
      const e = isoSprite('s:' + c.id, isoTheme() + '|' + season + '|' + c.kind + '|' + (ready ? 1 : 0) + '|' + c.x + ',' + c.y, nodeBox(N), () => isoNode(k, N, ready, season, isoTheme()), INK.tree);
      ctx.globalAlpha = 1;
      // 칠해진 도트만 잡는다 — 뒤의 채집 나무를 가리지 않은 곳은 그 나무로 넘어간다
      isoHits.push({ e, tx: c.x, ty: c.y });
    } });
  });
  Object.keys(W.sprinklers || {}).forEach(id => {
    const q = R.parseId(id), good = (W.sprinklers[id] || {}).k === 'good';
    cast.push({ d: q.x + q.y + 1, go: () => withBB(flatOffAt(q.x * T + 16, q.y * T + 26, q.x + 0.5, q.y + 0.55, 3), () => drawSprinkler(q.x * T, q.y * T, t, good)) });
  });
  if (R.peddlerHere(W, now())){
    const P = R.peddlerSpot(W);
    // 수레는 칠해진 도트로, 행상인은 몸 상자로 누른다. 그릴 때 넣어야 앞뒤 순서가 맞는다
    const k = pedKeeperAt(P), q = isoP(k.u, k.v);
    cast.push({ d: P.x + P.y + 1.3, go: () => {
      const e = isoSprite('peddler', P.x + ',' + P.y, isoBoxOf({ x: P.x, y: P.y, w: 2.3, h: 1 }), () => isoPeddlerCart(P), INK.beast);
      for (let i = 0; i < e.lamps.length; i++) lamps.push(e.lamps[i]);
      isoHits.push({ e, tx: P.x, ty: P.y });
    } });
    cast.push({ d: k.u + k.v, go: () => { drawPeddlerIso(P, t); isoHits.push({ x0: q.x - 14, x1: q.x + 14, y0: q.y - 56, y1: q.y + 2, tx: P.x, ty: P.y }); } });
  }
  if (walkers) walkers.forEach(w => cast.push({ d: (w.x + w.y) / T, go: () => drawWalkerIso(w, t) }));
  if (STILL && !farmGuest && visitAt == null && weekendKST()) farmGuest = stillFarmGuest();
  if (farmGuest && visitAt == null){ const v = farmGuest; cast.push({ d: (v.x + v.y) / T, go: () => drawFarmGuestIso(v, t) }); }
  if (beasts) beasts.list.forEach(a => cast.push({ d: (a.x + a.y) / T, go: () => drawBeastIso(a, t) }));
  if (dolls) dolls.list.forEach(d => cast.push({ d: (d.x + d.y) / T, go: () => drawDollIso(d, t) }));
  isoLife(cast, t, season, L);
  cast.sort((a, b) => a.d - b.d).forEach(c => { ctx = g; c.go(); });
  ctx = g;
  drawSmoke(t);
  drawCritters(season, t, L);
  isoSkyLife(t);
  isoPetals(t, season);
  if (isoLook().below === 'lava') isoLavaFront(t);
  drawWeather(wk, season, t, cv);
  isoSeaRain(wk, t);
  grade(g, cw, ch, isoLook().below === 'lava' ? lavaNight(L) : L);
  if (L.lamp && lamps.length){
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(paintLayer('glow', cw, ch, sigGlow(L.dark), gg => drawGlow(gg, L.dark)), 0, 0);
    g.restore();
  }
  isoBeam(g, t, L);
  ctx = g;
  drawFireflies(t);
  drawTapMark(t);
  drawPlaceOverlay(t);
  drawBubbles(t);
  drawFishBar(t);
}

// 바닷가 섬에 비가 오면 바다에 빗방울 동그라미가 퍼진다. 하나가 다 퍼지면 다른 자리에서 또.
function isoSeaRain(wk, t){
  if (!(wk === 'rain' || wk === 'storm') || isoLook().below !== 'sea') return;
  const K = isoLook(), n = wk === 'storm' ? 40 : 24;
  for (let i = 0; i < n; i++){
    const p = (STILL ? 0.5 : t / 900) + R.prand('sr' + i), cyc = Math.floor(p), ph = p - cyc;
    const x = Math.floor(R.prand('srx' + i + '|' + cyc) * ISO_W), y = K.horizon + 6 + Math.floor(R.prand('sry' + i + '|' + cyc) * (ISO_H - K.horizon - 8));
    const g0 = isoTileAt(x, y), g1 = isoTileAt(x, y - K.deep);
    const inIsle = (g) => g.u >= -0.3 && g.v >= -0.3 && g.u <= COLS + 0.3 && g.v <= ROWS + 0.3;
    if (inIsle(g0) || inIsle(g1)) continue;                                            // 섬과 벼랑 위에는 안 그린다
    const r = 2 + Math.round(ph * 9), h = Math.ceil(r / 2);
    ctx.globalAlpha = 0.95 * (1 - ph * 0.8);
    px(x - r, y, 2, 1, '#ffffff'); px(x + r - 1, y, 2, 1, '#ffffff');
    px(x - Math.round(r * 0.6), y - h, Math.round(r * 1.2), 1, '#ffffff'); px(x - Math.round(r * 0.6), y + h, Math.round(r * 1.2), 1, '#dff2ff');
  }
  ctx.globalAlpha = 1;
}

// ---------- 건물 비춰 보기 ----------
/* 섬을 돌려 보고 싶다는 생각에서 나왔다. 아이소 건물은 보이는 두 면만 그려 두어서 진짜로
   돌리려면 모든 건물을 네 방향으로 다시 그려야 한다. 대신 건물·나무를 비치게 해 뒤에 가린
   아이·동물·밭을 보여 준다. 이 칸의 단추로 켜고 끈다. */
let seeThrough = false;
const SEE_ALPHA = 0.32;
// 농장 그림 위의 띠 — 옛 농장 단추와 비춰 보기 단추. 아이 화면과 손님 화면이 같이 쓴다.
function paintPastBar(el, pick){
  const past = Array.isArray(W.past) ? W.past : [], iso = withView(isoMode);
  el.hidden = !past.length && !iso;
  if (el.hidden) return;
  el.innerHTML = '';
  const add = (label, on, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (on) b.className = 'on'; b.addEventListener('click', fn); el.appendChild(b); };
  const text = h => { const s = document.createElement('span'); s.innerHTML = h; el.appendChild(s); };
  const nameOf = p => { const F = R.FARMS.find(f => f.id === p.farm); return F ? F.icon + ' ' + F.name : '옛 농장'; };
  const day = k => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(k || ''); return m ? Number(m[1]) + '월 ' + Number(m[2]) + '일' : ''; };
  // 대문 문패 — 이사할 때마다 「N호점」이 붙는다(2026-09-30 로키즈 「이사 보상」). 옛 농장 구경 중이면 그 농장 번호
  const shown = visitAt != null && past[visitAt] ? R.FARMS.findIndex(f => f.id === past[visitAt].farm) : (W.farm || 0);
  if (shown >= 1) text('<span class="doorplate">🪧 수아연아 농장 ' + (shown + 1) + '호점</span>');
  if (visitAt != null && past[visitAt]){
    const p = past[visitAt];
    text('<b>' + nameOf(p) + '</b> 구경 중' + (day(p.until) ? ' · ' + day(p.until) + '까지 살던 곳' : ''));
    add('🏡 지금 농장으로', true, () => pick(null));
  } else if (past.length){
    text('옛 농장 구경');
    past.forEach((p, i) => add(nameOf(p), false, () => pick(i)));
  }
  if (iso) add(seeThrough ? '🏠 건물 다시 보기' : '👀 건물 비춰 보기', seeThrough, () => { seeThrough = !seeThrough; paintPastBar(el, pick); drawFarm(liveCv); });
}

// ---------- 옛 농장 구경 ----------
/* 이사 가며 두고 온 농장을 언제든 다시 가 볼 수 있다(2026-09-28 로키즈 요청). 이사할 때
   W.past 에 꾸미개·다 지은 건물·배치를 통째로 적어 두었으니(farm-rules-play.js 의 이사),
   그리는 동안만 그 기록을 W 에 잠깐 끼워 넣는다. 밭과 동물은 들고 떠났으니 빈 밭·빈 우리다.
   구경하는 동안은 눌러도 아무것도 안 한다 — 옛 농장은 추억이지 일터가 아니다. */
let visitAt = null, inView = false;
const VIEW_KEYS = ['farm', 'decor', 'layout', 'buildings', 'expand', 'plots', 'sprinklers', 'animals'];
function pastOf(i){ return W && Array.isArray(W.past) && i != null ? W.past[i] || null : null; }
function withView(fn){
  const P = pastOf(visitAt);
  if (!P || inView){ syncGrid(); return fn(); }
  const keep = {};
  VIEW_KEYS.forEach(k => { keep[k] = W[k]; });
  inView = true;
  W.farm = Math.max(0, R.FARMS.findIndex(f => f.id === P.farm));
  W.decor = P.decor || {}; W.layout = P.layout || {}; W.buildings = P.buildings || {}; W.expand = P.expand || 0;
  W.plots = {}; W.sprinklers = {}; W.animals = [];
  syncGrid();
  try { return fn(); } finally { VIEW_KEYS.forEach(k => { W[k] = keep[k]; }); inView = false; syncGrid(); }
}

// ---- 한 장 그리기 ----
function drawFarm(cvIn, tms){
  const cv = cvIn || $('#farmCanvas');
  if (!cv || !W) return;
  if (cv.id === 'farmCanvas') syncZoomBtn();
  withView(() => drawFarmIn(cv, tms));
}
function drawFarmIn(cv, tms){
  const t = tms == null ? (window.performance ? performance.now() : Date.now()) : tms;
  const cal = R.calendar(W, now()), season = cal.season, wk = R.weatherOf(R.dayKey(now()), season);
  const L = dayLight();
  isoView = isoMode();
  const A = artSize();
  if (fitPixelCanvas(cv, A.w, A.h, 5)) dropLayers();
  S = pixScale(cv, A.w, A.h, 1.5);
  const cw = cv.width, ch = cv.height;
  curWind = wk === 'wind' ? 4.8 : wk === 'storm' ? 3.8 : wk === 'rain' ? 2.0 : 1.1;
  // 바람은 0.11초 단위로만 센다. 흔들리는 폭이 어차피 한두 도트라 눈에는 그대로인데,
  // 작물 겹을 다시 그리는 횟수는 절반이 된다.
  const windStep = Math.round(t / 110) * 110;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cw, ch);
  if (isoView) return drawFarmIso(cv, g, t, cal, season, wk, L, windStep);

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
      cropAt(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, sway(q.x, q.y));
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
    const N = nodeOf(n);
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
  if (R.peddlerHere(W, now())) cast.push({ y: R.peddlerSpot(W).y * T + 30, go: () => drawPeddler(t) });
  { const b = spot('stall'); cast.push({ y: b.y * T + 36, go: () => drawStallKeeper2D(t) }); }
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
  withView(() => {                               // 옛 농장을 구경하는 중이면 아이들도 그 농장을 걷는다
    ensureActors();
    stepActors(Math.min(150, dt), ts);
    drawFarm(liveCv, ts);
  });
  // 집 탭이 열려 있으면 방도 함께 — 불꽃과 먼지와 아이가 움직인다
  if (tab === 'house' && key && !$('#tab-house').hidden) drawRoom($('#houseCanvas'), room, ts);
}
function startLoop(cv){
  liveCv = cv;
  withView(ensureActors);
  drawFarm(cv);                                // 첫 장은 바로 — 빈 화면이 잠깐 보이지 않게
  if (STILL) return;
  if (!rafId) rafId = requestAnimationFrame(loop);
}

// ---------- 누르기 ----------
// 아이소 섬이면 선 것(건물·나무)을 먼저 보고, 없으면 땅의 칸을 거꾸로 셈한다
// ground 면 선 것은 건너뛰고 땅의 칸만 — 배치에서 놓을 자리를 고를 때(지붕이 뒤 칸을 덮는다)
function tileAt(clientX, clientY, ground){
  const q = pixAt(clientX, clientY);
  if (!isoView) return { tx: Math.floor(q.x / T), ty: Math.floor(q.y / T) };
  const hit = ground ? null : isoHitTile(q.x, q.y);
  if (hit) return hit;
  // 갈아 둔 밭 칸은 세 도트 돋아 있다 — 그 윗면을 누른 것인지 먼저 본다
  const g3 = isoTileAt(q.x, q.y + 3), t3 = { tx: Math.floor(g3.u), ty: Math.floor(g3.v) }, id3 = plotAtTile(t3.tx, t3.ty);
  let t = t3;
  if (!(id3 && W.plots[id3] && W.plots[id3].tilled)){ const g = isoTileAt(q.x, q.y); t = { tx: Math.floor(g.u), ty: Math.floor(g.v) }; }
  // 작물 그림은 칸 위로 솟아 뒤 칸을 덮는다 — 잎을 눌렀으면 땅의 칸(뒤)보다 그 작물의 칸(앞)이 맞다(2026-09-29 로키즈)
  if (!ground){ const c = cropTileAt(q.x, q.y); if (c && c.tx + c.ty >= t.tx + t.ty) t = c; }
  if (plotAtTile(t.tx, t.ty)) tapMark = { tx: t.tx, ty: t.ty, at: performance.now() };
  return t;
}
// 누른 자리(도트)에 작물 그림이 실제로 칠해져 있으면 그 작물의 칸 — 앞(아래) 줄부터 담아 둔 그림의 그 도트를 본다.
// 한 줄(x+y 가 같은 칸들)에 여럿이면 가로로 가장 가까운 칸
let cropHits = [];
function cropTileAt(x, y){
  const bands = cropHits.slice().sort((a, b) => b.n - a.n);
  for (const h of bands){
    const dx = Math.floor(x * S) - h.e.ox, dy = Math.floor(y * S) - h.e.oy;
    if (dx < 0 || dy < 0 || dx >= h.e.cv.width || dy >= h.e.cv.height) continue;
    let a = 0;
    try { a = h.e.cv.getContext('2d').getImageData(dx, dy, 1, 1).data[3]; } catch (err) { a = 0; }
    if (a <= 90) continue;
    let best = null, bd = 1e9;
    h.ids.forEach(id => { const c = R.parseId(id), d = Math.abs(isoP(c.x + 0.5, c.y + 0.5).x - x); if (d < bd){ bd = d; best = { tx: c.x, ty: c.y }; } });
    return best;
  }
  return null;
}
// 방금 누른 밭 칸 — 0.6초 동안 테두리가 반짝이며 옅어진다(어느 칸이 눌렸는지 눈으로 확인). 아이소 섬에서만 찍힌다
let tapMark = null;
function drawTapMark(t){
  if (!tapMark || STILL) return;
  const a = 1 - (t - tapMark.at) / 600;
  if (a <= 0){ tapMark = null; return; }
  const { tx, ty } = tapMark, P = [isoP(tx, ty, 3), isoP(tx + 1, ty, 3), isoP(tx + 1, ty + 1, 3), isoP(tx, ty + 1, 3)];
  ctx.globalAlpha = a;
  P.forEach((p, i) => isoSeg(p, P[(i + 1) % 4], '#fff4a0', 2));
  ctx.globalAlpha = 1;
}
/* 밭 크게 보기(2026-09-29 로키즈) — 아이소 섬에서는 휴대폰 폭에서 밭 한 칸이 가로 19px 남짓이라 누르기 어렵다.
   캔버스를 CSS 로 키우고 밀어 밭(아직 안 연 땅까지)이 틀 가득 오게 한다 — 대개 두 배. 그림은 그대로 그리고,
   누른 자리는 pixAt 이 키워진 크기(getBoundingClientRect)로 재므로 따로 셈할 것이 없다 */
let zoomOn = false;
function applyZoom(){
  const cv = $('#farmCanvas'), zb = $('#zoomBtn');
  if (!cv) return;
  if (zb){ zb.setAttribute('aria-pressed', zoomOn ? 'true' : 'false'); zb.textContent = zoomOn ? '🔍 섬 전체' : '🔍 밭 크게'; }
  if (!zoomOn || !W || !isoMode()){ cv.style.transform = ''; return; }
  const Wc = cv.offsetWidth, Hc = cv.offsetHeight, f = Wc / (cv.width / S);        // 한 도트가 CSS 몇 px(키우기 전)
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  R.fieldCells(W).forEach(c => [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([a, b]) => {
    const p = isoP(c.x + a, c.y + b); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }));
  y0 -= 34;                                                              // 뒷줄 작물 키만큼 위도 보이게
  const k = Math.max(1, Math.min(3, Wc / ((x1 - x0) * f * 1.1), Hc / ((y1 - y0) * f * 1.1)));
  const tx = Math.min(0, Math.max(Wc - k * Wc, Wc / 2 - k * (x0 + x1) / 2 * f));
  const ty = Math.min(0, Math.max(Hc - k * Hc, Hc / 2 - k * (y0 + y1) / 2 * f));
  cv.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + k.toFixed(3) + ')';
}
// 섬(아이소)일 때만 단추를 보인다 — 들판(판 화면)은 칸이 네모라 필요 없다
function syncZoomBtn(){
  const zb = $('#zoomBtn'), show = !!W && isoMode();
  if (!zb || zb.hidden === !show) return;
  zb.hidden = !show;
  if (!show && zoomOn){ zoomOn = false; applyZoom(); }
}
if ($('#zoomBtn')){
  $('#zoomBtn').addEventListener('click', () => { zoomOn = !zoomOn; applyZoom(); });
  window.addEventListener('resize', () => { if (zoomOn) applyZoom(); });
}
// 누른 자리를 화면 도트로 — 칸이 아니라 그림 위 어디를 눌렀는지 봐야 할 때(캐릭터). 판이면 곧 지도 좌표다.
function pixAt(clientX, clientY){
  const cv = liveCv || $('#farmCanvas'), r = cv.getBoundingClientRect();
  const w = r.width || cv.width, h = r.height || cv.height;
  return { x: (clientX - r.left) / w * cv.width / S, y: (clientY - r.top) / h * cv.height / S };
}
function plotAtTile(tx, ty){ return R.fieldHas(W, tx, ty) ? tx + ',' + ty : null; }   // 밭 모양 안이면(아직 안 연 땅까지) 그 칸
function nodeAt(tx, ty){
  const sc = R.sceneryOf(W).find(c => c.x === tx && c.y === ty);   // 풍경도 채집된다
  return Object.keys(R.NODES).find(n => { const q = R.nodeSpot(W, n); return q.x === tx && q.y === ty; }) || (sc && sc.id) || null;
}
function built(id){ return !!(W.buildings[id] && W.buildings[id].done); }
/* ---------- 끌어서 이어 하기 ----------
   스타듀밸리처럼 누른 채 밭 위를 지나가면 지나간 칸마다 이어서 한다. 톡 누르는 것은
   예전 그대로다 — 끌지 않았으면 아무것도 안 하고 click 이 하던 일을 그대로 한다.
   끌 때는 도구가 세 칸·아홉 칸짜리라도 한 칸씩만 한다. 아홉 칸짜리로 끌면 기운이
   순식간에 바닥나고, 지나가지도 않은 칸이 갈려서 「내가 뭘 한 건지」를 못 읽는다.
   폰에서는 가로로 끌어야 한다(#farmCanvas 의 touch-action:pan-y pinch-zoom) — 세로로 끄는 것은
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
/* 방이 있는 농장 — 새 농장마다 나라가 다르다(2026-09-29 로키즈 「방 내부도 각 나라에 맞게」).
   바닷가=그리스(회칠 벽·파란 덧창·테라코타 타일), 산골=스위스(소나무 널벽·체크 커튼·알프스),
   꽃구름=일본(흙벽과 기둥·장지·다다미). 들판은 처음 그대로. 아이 색(수아 분홍·연아 민트)은 어디서나 남긴다. */
function roomTheme(){ return (W && R.farmOf) ? R.farmOf(W).id : 'meadow'; }
const ROOM_THEME_PAL = {
  seaside: {
    sua:    { wall: '#fbf3f1', wall2: '#f1e5e2', dot: '#ec8aa6' },
    yona:   { wall: '#f2f8f6', wall2: '#e3eeea', dot: '#3fa78f' },
    living: { wall: '#f9f6ef', wall2: '#ece6da', dot: '#2f6fb0' },
    all: { trim: '#2f6fb0', rail: '#3f86c6', motif: 'key', cur: '#3b7fc4', wain: '#f4efe8', wainL: '#fffaf4', base: '#2a5f99',
           floor: ['#d8875a', '#c97a4f', '#e29a6c', '#bd6f47'] },
  },
  mountain: {
    sua:    { dot: '#f59ab0', cur: '#e8607a' },
    yona:   { dot: '#7fd0b8', cur: '#3f9f86' },
    living: { dot: '#ffffff', cur: '#d8433f' },
    all: { wall: '#e0b27a', wall2: '#d09e66', trim: '#7a4c2a', rail: '#6f4526', motif: 'edel', wain: '#c48f5a', wainL: '#d6a36c', base: '#5e3a20',
           floor: ['#b8844f', '#a87645', '#c69260', '#98683c'] },
  },
  cloud: {
    sua:    { wall: '#f6e7e1', wall2: '#ead6ce', dot: '#f19db4', cur: '#f19db4', motif: 'sakura' },
    yona:   { wall: '#e9efdd', wall2: '#dae3cb', dot: '#5fae9a', cur: '#5fae9a', motif: 'wave' },
    living: { wall: '#efe3c7', wall2: '#e1d2b0', dot: '#3f5f8f', cur: '#3f5f8f', motif: 'check' },
    all: { trim: '#5e4130', rail: '#5e4130', wain: '#fbf5ea', wainL: '#fffbf4', base: '#4a3222',
           floor: ['#cdc98e', '#c5c083', '#d5d29a', '#bfb97c'] },
  },
};
function roomPal(r){
  const TP = ROOM_THEME_PAL[roomTheme()];
  if (TP) return Object.assign({ theme: roomTheme() }, roomPal0(r), TP.all, TP[r] || TP.living);
  return roomPal0(r);
}
function roomPal0(r){
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
                     whale: 1, wlight: 1, medalcase: 1,
                     blueplate: 1, cuckoo: 1, scroll: 1 };
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
    case 'blueplate': {                                              // 그리스 파란 무늬 접시 셋
      const plate = (cx, cy, rr) => {
        for (let dy = -rr; dy <= rr; dy++){
          const hw = Math.round(Math.sqrt(rr * rr - dy * dy));
          const edge = dy * dy + hw * hw >= (rr - 2) * (rr - 2) && Math.abs(dy) > rr - 3;
          w(cx - hw, cy + dy, hw * 2, 1, c);
          if (!edge && hw > 2) w(cx - hw + 2, cy + dy, hw * 2 - 4, 1, dy > rr / 2 ? '#e3e8ee' : '#fbfbf7');
        }
        w(cx - 2, cy - 4, 4, 2, c); w(cx - 2, cy + 2, 4, 2, c); w(cx - 4, cy - 2, 2, 4, c); w(cx + 2, cy - 2, 2, 4, c);   // 가운데 꽃
        w(cx, cy - 1, 1, 2, '#e8b04a');
        for (let a = 0; a < 8; a++){ const x = Math.round(cx + Math.cos(a * Math.PI / 4) * (rr - 4)), y = Math.round(cy + Math.sin(a * Math.PI / 4) * (rr - 4)); if (rr > 7) w(x - 1, y - 1, 2, 2, c); }
        w(cx - 1, cy - rr - 2, 2, 2, '#8a8078');                                         // 거는 쇠
      };
      plate(20, 20, 10); plate(9, 42, 6); plate(31, 42, 6);
      break;
    }
    case 'cuckoo': {                                                 // 스위스 뻐꾸기시계 — 지붕 달린 작은 집
      hang(20, 3, 0);
      for (let j = 0; j < 7; j++) w(18 - 2 * j, 6 + 2 * j, 4 + 4 * j, 2, j % 2 ? '#5e3a20' : '#6f4526');   // 지붕
      w(6, 18, 28, 1, '#3a2618');
      w(9, 19, 22, 22, c); w(9, 19, 2, 22, shade(c, 20)); w(29, 19, 2, 22, shade(c, -24));
      w(16, 21, 8, 6, '#3a2618'); w(18, 22, 4, 4, '#ffd166'); w(22, 24, 2, 1, '#ff8c2e');   // 뻐꾸기
      for (let dy = -6; dy <= 6; dy++){ const hw = Math.round(Math.sqrt(36 - dy * dy)); w(20 - hw, 33 + dy, hw * 2, 1, '#fff6e9'); }
      [[19, 27], [19, 38], [14, 32], [25, 32]].forEach(pp => w(pp[0], pp[1], 2, 1, '#3a3226'));
      w(19, 29, 2, 4, '#3a3226'); w(20, 32, 4, 2, '#3a3226');
      [[4, 24], [32, 24], [4, 32], [32, 32]].forEach(pp => { w(pp[0], pp[1], 4, 3, '#4f7a3a'); w(pp[0] + 1, pp[1], 2, 1, '#7aa85e'); });   // 깎은 잎
      w(14, 41, 1, 10, '#b0a080'); w(26, 41, 1, 8, '#b0a080');             // 사슬과 솔방울 추
      w(12, 50, 4, 7, '#6f4526'); w(12, 51, 4, 1, '#8a5a34'); w(12, 54, 4, 1, '#8a5a34');
      w(24, 48, 4, 7, '#6f4526'); w(24, 49, 4, 1, '#8a5a34'); w(24, 52, 4, 1, '#8a5a34');
      w(20, 41, 1, 8, '#8a7b6e'); w(18, 48, 4, 4, '#c9a24a'); w(18, 48, 2, 1, '#ffe08a');   // 흔들이
      break;
    }
    case 'scroll': {                                                 // 일본 족자 — 비단 테에 먹 산수와 붉은 해
      w(18, 1, 4, 2, '#6f6257'); w(14, 3, 4, 2, '#6f6257'); w(22, 3, 4, 2, '#6f6257');
      w(8, 5, 24, 3, '#5e4130');
      w(10, 8, 20, 47, '#b8a27a'); w(10, 8, 20, 1, '#d4c29a'); w(28, 8, 2, 47, '#9d875f');
      w(13, 13, 14, 36, c); w(13, 13, 14, 1, '#e3d9c0');
      w(20, 17, 4, 4, '#e8574f'); w(19, 18, 6, 2, '#e8574f');
      for (let i = 0; i < 14; i += 2){ const h2 = Math.max(0, 7 - Math.abs(i - 6)); if (h2) w(13 + i, 34 - h2, 2, h2, '#6a6a72'); }
      for (let i = 0; i < 10; i += 2){ const h2 = Math.max(0, 5 - Math.abs(i - 4)); if (h2) w(17 + i, 38 - h2, 2, h2, '#3f3f48'); }
      w(13, 38, 14, 1, '#8a8a92');
      w(16, 42, 2, 5, '#2e2622'); w(15, 43, 4, 1, '#2e2622'); w(22, 41, 2, 6, '#2e2622');   // 먹 글씨 두 자
      w(8, 55, 24, 3, '#5e4130'); w(6, 55, 2, 3, '#3a2618'); w(32, 55, 2, 3, '#3a2618');
      break;
    }
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
      /* 훈장 열여섯을 4×4 로(2026-09-30 이사 도장 넷이 붙기 전에는 4×3). 지름을 6으로 잡았더니 옆것과 딱 붙어
         한 줄 막대로 보였다 — 4로 줄이고 자리는 6칸씩 띄워 사이에 두 도트가 남게 했다. 줄은 10칸씩, 리본 밑에 한 도트 틈 */
      R.MEDALS.forEach((Md, i) => {
        const cx = 8 + (i % 4) * 6, cy = 9 + Math.floor(i / 4) * 10;
        if (got.indexOf(Md.id) < 0){ w(cx + 1, cy + 2, 2, 2, '#2e2a3c'); return; }   // 아직 못 받은 자리 — 빈 못
        w(cx + 1, cy, 2, 1, shade(Md.col, -34));
        w(cx, cy + 1, 4, 4, Md.col);
        w(cx, cy + 1, 4, 1, shade(Md.col, 26));
        w(cx + 1, cy + 5, 2, 1, shade(Md.col, -34));
        w(cx, cy + 6, 2, 3, '#c9333f'); w(cx + 2, cy + 6, 2, 3, '#e0736e');          // 리본
      });
      // 받은 만큼 밑에 금빛 막대로 — 글자를 못 쓰니 길이로 센다(열여섯은 두 도트씩 눈금이 안 들어간다)
      w(6, 49, 28, 1, '#2e2a3c');
      w(6, 49, Math.round(28 * got.length / R.MEDALS.length), 1, '#ffd25a');
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
/* ---- 나라별 방 틀 (2026-09-29) ----
   벽 한 면·창·거실 문·바닥 한 점의 색을 농장(P.theme)에 따라 그린다. 붓은 drawRoomShell 의 것 그대로
   (wall(u, v, 폭, 높이, 색) — u·폭은 짝수). 창과 문의 자리·크기는 들판과 같아서 벽 칸 알림(wallCovers)과
   창으로 든 볕은 그대로 맞는다. */
// 종이 올과 아래로 갈수록 어두워지는 결 — 어느 나라 벽에나 얹는다
function wallGrain(wall, len, k, r){
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
}
function themePaper(wall, len, k, side, P, r){
  const T = P.theme;
  if (T === 'seaside'){
    // 그리스 — 손으로 문질러 바른 흰 회칠 벽. 여덟 도트 덩이로 얼룩이 져서 고르지 않다.
    const wc = shade(P.wall, k), bl = shade(P.trim, k), dc = shade(P.dot, k);
    wall(0, 0, len, WALLH, wc);
    for (let u = 0; u < len; u += 2) for (let v = W_MOULD; v < W_BASE; v += 2){
      const b = R.prand('gw' + r + k + ((u / 8) | 0) + '_' + ((v / 6) | 0)), g2 = R.prand('gp' + r + k + u + '_' + v);
      if (b > 0.8 && g2 > 0.3) wall(u, v, 2, 2, shade(wc, -5));
      else if (b < 0.15 && g2 > 0.3) wall(u, v, 2, 2, shade(wc, 4));
    }
    wall(0, 0, len, W_MOULD, bl);                                              // 천장 밑 파란 띠
    wall(0, 0, len, 2, shade(P.trim, k + 24)); wall(0, W_MOULD - 2, len, 2, shade(P.trim, k - 20));
    // 메안드로스(그리스 번개무늬) 띠 — 아이 색으로. 열두 도트가 한 마디
    const mv = W_MOULD + 6;
    wall(0, mv - 3, len, 1, bl); wall(0, mv + 12, len, 1, bl);
    for (let u = 0; u + 12 <= len; u += 12){
      wall(u, mv, 2, 10, dc); wall(u, mv, 10, 2, dc); wall(u + 8, mv, 2, 6, dc);
      wall(u + 4, mv + 4, 6, 2, dc); wall(u + 4, mv + 4, 2, 4, dc); wall(u, mv + 8, 12, 2, dc);
    }
    wall(0, W_RAIL, len, 2, shade(P.rail, k)); wall(0, W_RAIL + 2, len, 1, shade(P.rail, k - 24));   // 가는 파란 허리선
    wall(0, W_BASE - 4, len, WALLH - W_BASE + 4, bl);                          // 파란 걸레받이
    wall(0, W_BASE - 4, len, 1, shade(P.trim, k + 26)); wall(0, WALLH - 2, len, 2, shade(P.trim, k - 26));
  } else if (T === 'mountain'){
    // 스위스 샬레 — 소나무 가로 널벽. 널마다 조금씩 색이 다르고, 이음매는 어둡고 위 모서리는 밝다.
    const wc = shade(P.wall, k);
    for (let v = W_MOULD, n = 0; v < W_RAIL; v += 10, n++){
      const bc = shade(wc, Math.round((R.prand('sb' + r + k + n) - 0.5) * 12));
      wall(0, v, len, 10, bc);
      wall(0, v, len, 1, shade(bc, 16)); wall(0, v + 9, len, 1, shade(bc, -30));
      for (let u = 0; u < len; u += 2){
        const g2 = R.prand('sg' + r + k + n + '_' + u);
        if (g2 > 0.9) wall(u, v + 3 + (((g2 * 97) | 0) % 5), 6, 1, shade(bc, -12));   // 나뭇결
        else if (g2 < 0.01){ wall(u, v + 4, 2, 2, shade(bc, -38)); wall(u - 2, v + 4, 2, 1, shade(bc, -20)); }   // 옹이
      }
    }
    wall(0, 0, len, W_MOULD, shade(P.trim, k));
    wall(0, 0, len, 2, shade(P.trim, k + 24)); wall(0, W_MOULD - 2, len, 2, shade(P.trim, k - 20));
    // 몰딩 밑 칠한 띠 — 스위스 시골집의 꽃 그림(바우에른말레라이). 에델바이스와 하트가 번갈아
    const bv = W_MOULD;
    wall(0, bv, len, 12, shade(P.trim, k + 12)); wall(0, bv + 12, len, 1, shade(P.trim, k - 18));
    for (let u = 6, n = 0; u + 8 <= len; u += 18, n++){
      if (n % 2){
        const hc = shade(P.cur, k);
        wall(u, bv + 3, 2, 2, hc); wall(u + 4, bv + 3, 2, 2, hc); wall(u, bv + 5, 6, 2, hc); wall(u + 2, bv + 7, 2, 2, hc);
      } else {
        const fc = shade(P.dot, k);
        wall(u, bv + 5, 6, 2, fc); wall(u + 2, bv + 2, 2, 8, fc);
        wall(u + 2, bv + 5, 2, 2, '#ffd166');
        wall(u - 2, bv + 9, 4, 1, '#6fa869'); wall(u + 4, bv + 9, 4, 1, '#6fa869');   // 잎 두 장
      }
    }
    wall(0, W_RAIL, len, W_WAIN - W_RAIL, shade(P.rail, k)); wall(0, W_RAIL, len, 1, shade(P.rail, k + 26));
    wall(0, W_WAIN, len, W_BASE - W_WAIN, shade(P.wain, k));                   // 아래는 세로 널
    for (let u = 0; u < len; u += 10){
      wall(u, W_WAIN, 2, W_BASE - W_WAIN, shade(P.wain, k - 24));
      wall(u + 2, W_WAIN, 2, W_BASE - W_WAIN, shade(P.wainL, k));
    }
    for (let u = 34; u + 6 < len; u += 60){                                    // 널에 판 하트 구멍
      const hc = shade(P.wain, k - 46);
      wall(u, W_WAIN + 10, 2, 2, hc); wall(u + 4, W_WAIN + 10, 2, 2, hc); wall(u, W_WAIN + 12, 6, 2, hc); wall(u + 2, W_WAIN + 14, 2, 2, hc);
    }
    wall(0, W_BASE, len, WALLH - W_BASE, shade(P.base, k)); wall(0, WALLH - 2, len, 2, shade(P.base, k - 26));
  } else {
    // 일본 — 고운 흙벽을 짙은 나무 기둥과 가로 도리(나게시)가 나눈다. 허리 아래는 무늬 종이(고시바리).
    const wc = shade(P.wall, k), wood = shade(P.trim, k), woodH = shade(P.trim, k + 24), woodD = shade(P.trim, k - 20);
    wall(0, 0, len, WALLH, wc);
    for (let u = 0; u < len; u += 2) for (let v = W_MOULD; v < W_RAIL; v += 2){
      const g2 = R.prand('jw' + r + k + u + '_' + v);
      if (g2 > 0.9) wall(u, v, 2, 1, shade(wc, -7));
      else if (g2 < 0.06) wall(u, v, 2, 1, shade(wc, 6));
    }
    wall(0, 0, len, W_MOULD, wood); wall(0, 0, len, 2, woodH); wall(0, W_MOULD - 2, len, 2, woodD);
    const nv = 26;                                                             // 나게시
    wall(0, nv, len, 5, wood); wall(0, nv, len, 1, woodH); wall(0, nv + 5, len, 2, 'rgba(26,18,10,0.16)');
    wall(0, W_RAIL, len, 3, wood); wall(0, W_RAIL, len, 1, woodH);
    const bt = W_RAIL + 3, bh = W_BASE - bt, pc = shade(P.wain, k), dc = shade(P.dot, k);
    wall(0, bt, len, bh, pc);
    if (P.motif === 'sakura'){                                                 // 수아 — 벚꽃잎
      for (let u = 4, n = 0; u + 6 < len; u += 16, n++){
        const v = bt + 6 + (n % 2) * 12;
        wall(u + 2, v, 2, 2, dc); wall(u, v + 2, 6, 2, dc); wall(u, v + 4, 2, 2, dc); wall(u + 4, v + 4, 2, 2, dc);
        wall(u + 2, v + 2, 2, 2, '#fff6f8');
      }
    } else if (P.motif === 'wave'){                                            // 연아 — 청해파(겹친 물결)
      for (let row = 0; row < 3; row++){
        const by = bt + 9 + row * 8, sh = (row % 2) * 6;
        for (let u = -12 + sh; u < len; u += 12) for (let i = 0; i < 12; i += 2){
          const d = (i + 1 - 6) / 6, hh = Math.round(6 * Math.sqrt(Math.max(0, 1 - d * d)));
          if (u + i >= 0) wall(u + i, by - hh, 2, 1, dc);
        }
      }
    } else {                                                                   // 거실 — 옅은 바둑판(이치마쓰)
      for (let u = 0; u < len; u += 8) for (let v = bt; v < W_BASE; v += 8)
        if ((((u / 8) | 0) + (((v - bt) / 8) | 0)) % 2) wall(u, v, 8, Math.min(8, W_BASE - v), shade(P.wain, k - 9));
      wall(0, bt, len, 1, dc);
    }
    wall(0, W_BASE, len, WALLH - W_BASE, shade(P.base, k)); wall(0, W_BASE, len, 1, shade(P.base, k + 22));
    // 기둥 — 두 벽이 만나는 구석과 벽 끝. 창도 문도 없는 벽이면 가운데에도 하나
    const posts = [0, len - 6];
    if (!side && r !== 'living') posts.push(Math.floor(len / 4) * 2 - 2);
    posts.forEach(pu => { wall(pu, 0, 6, WALLH, wood); wall(pu, 0, 2, WALLH, woodH); wall(pu + 4, 0, 2, WALLH, woodD); });
  }
  wallGrain(wall, len, k, r);
}
// 창밖 — 밤·저녁이면 어둡게. 들판 창과 같은 시계를 본다
function nightTone(col, S2, L){ return S2.star ? shade(col, -58) : L.dark > 0.2 ? shade(col, -30) : col; }
function themeWindow(w, P, S2, L, wu, wv, ww, wh){
  const T = P.theme, N = c => nightTone(c, S2, L);
  const sky = () => {
    w(wu, wv, ww, wh, S2.bot); w(wu, wv, ww, Math.round(wh * 0.5), S2.top);
    if (S2.star){
      [[8, 6], [22, 12], [36, 6], [50, 14], [16, 22], [44, 24]].forEach(p => w(wu + p[0], wv + p[1], 2, 2, '#fff6c0'));
      w(wu + 42, wv + 6, 8, 8, '#fff3c0'); w(wu + 44, wv + 6, 4, 2, '#ffe9a8');
    }
  };
  const shine = () => {                                                        // 유리에 비스듬히 비치는 빛
    for (let i = 0; i < 10; i += 2) w(wu + 6 + i, wv + 6 + i, 2, 10, 'rgba(255,255,255,0.28)');
    for (let i = 0; i < 6; i += 2) w(wu + 16 + i, wv + 6 + i, 2, 8, 'rgba(255,255,255,0.20)');
  };
  if (T === 'seaside'){
    /* 그리스 — 위가 둥근 창, 파란 덧창을 활짝 열었다. 밖은 에게해와 하얀 집·파란 지붕. */
    const arc = (i, n, a) => { const d = (i + 1 - n / 2) / (n / 2); return Math.round(a * (1 - Math.sqrt(Math.max(0, 1 - d * d)))); };
    const blue = P.trim;
    for (let i = -2; i < ww + 2; i += 2){ const o = arc(i + 2, ww + 4, 15); w(wu + i, wv - 2 + o, 2, wh + 6 - o, blue); }
    sky();
    if (!S2.star){ w(wu + 26, wv + 6, 8, 8, '#fff3c0'); w(wu + 24, wv + 8, 12, 4, '#fff3c0'); }   // 해
    const hz = wv + 27, sea = N('#2f86c6'), seaL = shade(sea, 24);
    w(wu, hz, ww, wv + wh - hz, sea);
    for (let y = hz + 3; y < wv + wh; y += 4) for (let u = ((y / 4) | 0) % 2 * 6; u + 6 <= ww; u += 14) w(wu + u, y, 6, 1, seaL);
    for (let i = 0; i < 22; i += 2){ const hg = Math.round(5 - Math.abs(i - 10) * 0.4); if (hg > 0) w(wu + 30 + i, hz - hg, 2, hg, N('#a9bccd')); }   // 먼 섬
    w(wu + 14, hz - 9, 2, 8, N('#8a7560'));                                    // 돛단배
    [[2, 1], [2, 3], [4, 5], [4, 7]].forEach(([sw, y]) => w(wu + 16, hz - 9 + y, sw, 2, N('#ffffff')));
    w(wu + 10, hz - 1, 12, 2, N('#8a5a3a'));
    // 앞쪽 하얀 집 둘 — 오른쪽 집은 파란 둥근 지붕
    const g1 = wv + wh - 10;
    w(wu, g1, 18, 10, N('#f6f6f2')); w(wu + 12, g1, 6, 10, N('#dfe5ec')); w(wu, g1, 18, 1, N('#ffffff'));
    w(wu + 4, g1 + 4, 4, 6, S2.star ? '#ffd166' : blue);
    const hx = wu + 34, hy = wv + wh - 17;
    w(hx, hy, 20, 17, N('#ffffff')); w(hx + 14, hy, 6, 17, N('#dfe5ec'));
    [[2, 16], [2, 16], [4, 12], [6, 8]].forEach(([dx, dw], j) => w(hx + dx, hy - 2 - j * 2, dw, 2, N(j === 3 ? '#4f93d8' : '#1f5aa0')));
    w(hx + 4, hy - 6, 4, 2, N('#4f93d8'));                                     // 둥근 지붕의 볕
    w(hx + 8, hy - 12, 2, 4, N('#ffffff'));
    w(hx + 4, hy + 5, 4, 5, S2.star ? '#ffd166' : blue); w(hx + 10, hy + 5, 2, 3, S2.star ? '#ffd166' : blue);
    shine();
    w(wu + ww / 2 - 2, wv + 4, 2, wh - 4, blue); w(wu, wv + 22, ww, 2, blue);  // 창살
    // 둥근 윗모서리는 창틀색으로 덮는다
    // 둥근 윗모서리 밖은 회칠 벽으로 덮고, 그 선을 따라 파란 틀을 두른다
    for (let i = -2; i < ww + 2; i += 2){
      const o = arc(i + 2, ww + 4, 15);
      if (o > 0) w(wu + i, wv - 2, 2, o, P.wall);
      w(wu + i, wv - 2 + o, 2, 2, blue);
    }
    // 활짝 연 덧창 두 짝 — 가로 살(루버)
    [wu - 22, wu + ww + 4].forEach(sx => {
      w(sx, wv, 18, wh + 2, shade(P.cur, -26));
      w(sx + 2, wv + 2, 14, wh - 2, P.cur);
      for (let v = wv + 4; v < wv + wh - 2; v += 3) w(sx + 2, v, 14, 1, shade(P.cur, -18));
      w(sx + 2, wv + 2, 2, wh - 2, shade(P.cur, 22));
      w(sx + 2, wv + Math.round(wh / 2), 14, 2, shade(P.cur, -30));
    });
    w(wu - 8, wv + wh + 4, ww + 16, 4, '#ffffff'); w(wu - 8, wv + wh + 7, ww + 16, 1, '#d8dee6');   // 흰 창턱
    // 창턱에 제라늄 화분, 창 위로는 부겐빌레아가 늘어진다
    w(wu + 2, wv + wh - 2, 10, 6, '#c9713f'); w(wu + 2, wv + wh - 2, 10, 1, '#e39062'); w(wu + 8, wv + wh - 1, 4, 5, '#a95a30');
    [[2, -8], [6, -10], [10, -7], [4, -5], [8, -4]].forEach(([dx, dy], j) => w(wu + dx, wv + wh + dy, 2 + (j % 2) * 2, 3, j < 3 ? '#e8433f' : '#4f9a58'));
    [[-12, -6], [-8, -8], [-4, -9], [0, -8], [4, -6], [-14, -2], [-10, -3], [-16, 2], [-12, 4], [-16, 8]].forEach(([dx, dy], j) => {
      w(wu + dx, wv + dy, 4, 3, j % 3 === 2 ? '#5f9a52' : j % 2 ? '#f06bb0' : '#d63d8f');
      if (j % 3 !== 2) w(wu + dx, wv + dy, 2, 1, '#ffb0d8');
    });
  } else if (T === 'mountain'){
    /* 화산 섬 — 작은 유리 여섯 칸의 나무창(스위스 샬레 그대로). 밖은 2026-10-06 부터 알프스 대신
       검붉은 하늘에 연기를 뿜는 화산, 흘러내리는 용암, 불탄 고목. 용암은 밤에도 어둡게 누르지 않는다. */
    w(wu - 4, wv - 4, ww + 8, wh + 8, '#4a2e1c'); w(wu - 2, wv - 2, ww + 4, wh + 4, '#6e4a30');
    const night = S2.star || L.dark > 0.2;
    w(wu, wv, ww, wh, night ? '#3a1210' : '#b8461c'); w(wu, wv, ww, Math.round(wh * 0.55), night ? '#140a0c' : '#5a1e16');
    const base = wv + wh - 12, vx = 40, vh = 30;
    for (let i = 0; i < 4; i++) w(wu + vx - 6 + i * 3, wv + 2 + (3 - i) * 3, 8 + i * 4, 3, N(i < 2 ? '#3a2e30' : '#4a3a3a'));   // 연기 기둥
    for (let y = 0; y < vh; y += 2){                                           // 화산 — 왼쪽 면이 붉은 빛을 받는다
      const hw = 3 + Math.round(y * 0.9);
      w(wu + Math.max(0, vx - hw), base - vh + y, Math.min(hw, vx), 2, N('#4a2a26'));
      w(wu + vx, base - vh + y, Math.min(hw, ww - vx), 2, N('#2e1c1e'));
    }
    w(wu + vx - 3, base - vh, 6, 2, '#ffd84a');                                 // 끓는 분화구
    [[-1, -0.5], [1, 0.4]].forEach(([dx, k]) => { for (let y = 2; y < vh; y += 2) w(wu + vx + dx + Math.round(y * k), base - vh + y, 2, 2, y < 12 ? '#ffb02e' : '#e8501a'); });   // 용암 줄기
    w(wu, base, ww, wv + wh - base, N('#3a302c')); w(wu, base, ww, 2, N('#4a3e38'));
    for (let x = 4; x < ww; x += 13) w(wu + x, base + 3 + (x % 3), 6, 1, '#ff6a1a');    // 땅 틈 용암
    [[8, 0], [50, 3]].forEach(([tx, dy]) => {                                  // 불탄 고목
      w(wu + tx, base - 12 + dy, 2, 14, N('#1e1416'));
      w(wu + tx - 4, base - 10 + dy, 4, 1, N('#1e1416')); w(wu + tx + 2, base - 8 + dy, 4, 1, N('#1e1416')); w(wu + tx - 5, base - 12 + dy, 1, 2, N('#1e1416')); w(wu + tx + 6, base - 10 + dy, 1, 2, N('#1e1416'));
    });
    shine();
    w(wu + 18, wv, 4, wh, '#8a5a34'); w(wu + 38, wv, 4, wh, '#8a5a34'); w(wu, wv + 19, ww, 4, '#8a5a34');   // 여섯 칸 창살
    w(wu + 18, wv, 2, wh, '#a8744a'); w(wu + 38, wv, 2, wh, '#a8744a'); w(wu, wv + 19, ww, 1, '#a8744a');
    // 체크무늬 커튼 — 아이 색 깅엄. 가로·세로 띠가 겹친 칸은 짙고, 한 줄만 지나면 중간, 아니면 흰 바탕
    [wu - 16, wu + ww + 2].forEach((cx, i) => {
      const top = wv - 8, hgt = wh + 10, tie = top + Math.round(hgt * 0.6);
      for (let u = 0; u < 14; u += 2) for (let v = top; v < top + hgt; v++){
        const pinch = Math.abs(v - tie) < 8 ? (i ? 1 : -1) * (8 - Math.abs(v - tie)) / 4 : 0;
        const a = ((u / 4) | 0) % 2, b = (((v - top) / 4) | 0) % 2;
        let c2 = a && b ? shade(P.cur, -10) : a || b ? shade(P.cur, 34) : '#fffaf2';
        if ((u / 2 + i) % 3 === 2) c2 = shade(c2, -14);                          // 주름 골
        w(cx + u + Math.round(pinch), v, 2, 1, c2);
      }
      w(cx + (i ? 0 : 2), tie - 2, 12, 3, shade(P.cur, -30));
    });
    w(wu - 20, wv - 10, ww + 40, 3, '#5e3a20'); w(wu - 22, wv - 11, 4, 5, '#3a2618'); w(wu + ww + 18, wv - 11, 4, 5, '#3a2618');   // 커튼봉
    w(wu - 6, wv + wh + 4, ww + 12, 4, '#8a5a34'); w(wu - 6, wv + wh + 4, ww + 12, 1, '#b5804f');    // 창턱
    w(wu - 4, wv + wh + 8, ww + 8, 8, '#6f4526');                              // 꽃상자
    for (let u = 0; u < ww + 8; u += 8) w(wu - 4 + u, wv + wh + 8, 2, 8, '#5e3a20');
    for (let u = -4; u < ww + 2; u += 6){
      w(wu + u, wv + wh + 1, 6, 4, '#4f9a58'); w(wu + u + 2, wv + wh - 1, 4, 3, (u / 6) % 2 ? '#ff7a6b' : '#e8433f');
      w(wu + u + 2, wv + wh - 1, 2, 1, '#ffb3a8');
      if ((u / 6) % 3 === 0) w(wu + u, wv + wh + 16, 2, 3, '#4f9a58');           // 늘어진 잎
    }
  } else {
    /* 일본 — 장지(쇼지) 창. 한 짝을 밀어 두어 반은 열려 있고, 밖은 구름 바다 위 후지산과 벚꽃 가지.
       처마 끝에 풍경(후린)이 달려 있다. */
    w(wu - 4, wv - 4, ww + 8, wh + 8, '#4a3222'); w(wu - 2, wv - 2, ww + 4, wh + 4, '#6b4a33');
    sky();
    if (!S2.star){ w(wu + 30, wv + 5, 6, 6, '#ff7a59'); w(wu + 28, wv + 7, 10, 2, '#ff7a59'); }   // 붉은 해
    const base = wv + wh - 10;
    for (let i = -26; i < 26; i += 2){                                         // 후지산 — 윗머리가 평평하다
      const d = Math.abs(i + 1), hg = d < 5 ? 22 : Math.round(22 - (d - 5) * 0.95);
      if (hg <= 0) continue;
      const x = 20 + i; if (x < 0 || x >= ww) continue;
      w(wu + x, base - hg, 2, hg, N(i >= 0 ? '#5f769e' : '#6f86b0'));
      const sn = d < 5 ? 7 : Math.max(0, 7 - Math.round((d - 5) * 0.7)) + ((x / 2) % 2 ? 1 : 0);
      if (sn > 0) w(wu + x, base - hg, 2, sn, N(i >= 0 ? '#e1e8f2' : '#ffffff'));
    }
    // 구름 바다 — 솜뭉치를 겹쳐 놓는다
    [[0, 6, 14], [10, 3, 18], [24, 5, 16], [36, 2, 20], [50, 4, 14]].forEach(([x, dy, cw]) => {
      w(wu + x, base - 2 + dy, cw, wv + wh - base + 2 - dy, N('#ffffff'));
      w(wu + x + 2, base - 4 + dy, cw - 4, 2, N('#ffffff'));
      w(wu + x, wv + wh - 2, cw, 2, N('#e4ebf5'));
    });
    // 벚꽃 가지 — 왼쪽 위에서 들어온다
    w(wu, wv + 3, 12, 2, '#6b4a33'); w(wu + 10, wv + 5, 8, 2, '#6b4a33'); w(wu + 6, wv + 1, 2, 3, '#6b4a33');
    [[2, 0], [8, 6], [14, 2], [16, 7], [4, 5]].forEach(([dx, dy]) => { w(wu + dx, wv + dy, 4, 3, '#ffc0d4'); w(wu + dx, wv + dy, 2, 1, '#ffffff'); });
    // 오른쪽 한 짝은 닫힌 장지 — 흰 종이에 가는 나무살
    const sx = wu + 32, sw = ww - 32;
    w(sx - 2, wv, 2, wh, 'rgba(26,18,10,0.22)');
    w(sx, wv, sw, wh, S2.star ? '#e9d7b0' : '#fbf6e8');
    for (let u = 6; u < sw; u += 8) w(sx + u, wv, 2, wh, '#a3826a');
    for (let v = 8; v < wh; v += 10) w(sx, wv + v, sw, 1, '#a3826a');
    w(sx, wv, 2, wh, '#6b4a33'); w(sx + sw - 2, wv, 2, wh, '#6b4a33');
    w(wu - 6, wv + wh + 4, ww + 12, 3, '#6b4a33'); w(wu - 6, wv + wh + 4, ww + 12, 1, '#8a6a4a');   // 창턱
    // 풍경 — 줄 끝에 유리 종, 그 아래 종이 띠
    w(wu + 22, wv, 2, 6, '#6f6257');
    w(wu + 20, wv + 6, 6, 5, '#bfe4f7'); w(wu + 20, wv + 6, 2, 5, '#e8f6ff'); w(wu + 20, wv + 10, 6, 1, '#e8574f');
    w(wu + 22, wv + 11, 2, 3, '#6f6257'); w(wu + 20, wv + 14, 4, 8, '#ffffff'); w(wu + 20, wv + 14, 4, 1, '#e8574f');
  }
}
function themeDoor(w, P, du, dv, dw, dh){
  const T = P.theme;
  if (T === 'seaside'){
    // 그리스 — 파랗게 칠한 널문. 두꺼운 회칠 벽에 파묻혀 있다
    const c = P.trim;
    w(du - 4, dv - 4, dw + 8, dh + 4, shade(P.wall, -12));
    w(du, dv, dw, dh, c);
    for (let i = 0; i < dw; i += 8){ w(du + i, dv, 2, dh, shade(c, -18)); w(du + i + 2, dv, 2, dh, shade(c, 14)); }
    [14, dh - 22].forEach(o => { w(du, dv + o, dw, 4, shade(c, 10)); w(du, dv + o + 4, dw, 1, shade(c, -30)); });
    for (let i = 0; i < 12; i += 2) w(du + 8 + i, dv + 22 + i, 2, 8, 'rgba(255,255,255,0.08)');
    w(du + dw - 8, dv + Math.round(dh / 2), 4, 4, '#e0b04a'); w(du + dw - 8, dv + Math.round(dh / 2), 2, 2, '#fff0b8');
    w(du + 16, dv + 30, 8, 8, '#e0b04a'); w(du + 18, dv + 32, 4, 4, c);        // 둥근 문고리쇠
    w(du - 2, dv + dh, dw + 4, 2, 'rgba(26,18,10,0.22)');
  } else if (T === 'mountain'){
    // 스위스 — 두꺼운 나무문에 검은 쇠 경첩과 하트 구멍
    w(du - 2, dv - 2, dw + 4, dh + 2, '#5e3a20'); w(du, dv, dw, dh, '#9c6a3e');
    for (let i = 0; i < dw; i += 8){ w(du + i, dv, 2, dh, '#7a4c2a'); w(du + i + 2, dv, 2, dh, '#b07a4a'); }
    [12, dh - 20].forEach(o => {
      w(du, dv + o, dw - 6, 4, '#3a3230'); w(du, dv + o, dw - 6, 1, '#5a504a');
      for (let i = 2; i < dw - 8; i += 8) w(du + i, dv + o + 1, 2, 2, '#8a8078');
    });
    const hx = du + dw / 2 - 4, hy = dv + 26;
    w(hx, hy, 2, 2, '#2a1c12'); w(hx + 4, hy, 2, 2, '#2a1c12'); w(hx, hy + 2, 6, 2, '#2a1c12'); w(hx + 2, hy + 4, 2, 2, '#2a1c12');
    w(du + dw - 8, dv + Math.round(dh / 2), 4, 6, '#3a3230'); w(du + dw - 8, dv + Math.round(dh / 2), 2, 2, '#8a8078');
    w(du - 2, dv + dh, dw + 4, 2, 'rgba(26,18,10,0.22)');
  } else {
    // 일본 — 미닫이 두 짝(위는 장지 종이, 아래는 나무판)과 문 위에 드리운 노렌
    w(du - 2, dv - 2, dw + 4, dh + 2, '#4a3222');
    [0, dw / 2].forEach((o, j) => {
      const x = du + o, pw = dw / 2;
      w(x, dv, pw, dh, '#6b4a33');
      w(x + 2, dv + 2, pw - 4, dh - 26, '#fbf6e8');
      for (let u = 6; u < pw - 4; u += 6) w(x + u, dv + 2, 2, dh - 26, '#a3826a');
      for (let v = 10; v < dh - 24; v += 10) w(x + 2, dv + v, pw - 4, 1, '#a3826a');
      w(x + 2, dv + dh - 22, pw - 4, 20, '#8a6246');
      for (let v = dv + dh - 20; v < dv + dh - 2; v += 4) w(x + 2, v, pw - 4, 1, '#7a5238');
      w(x + (j ? 2 : pw - 6), dv + Math.round(dh / 2) + 2, 4, 6, '#2e2622');   // 둥근 손잡이 홈
    });
    w(du + dw / 2 - 1, dv, 2, dh, '#3a2618');
    // 노렌 — 두 폭, 가운데에 흰 동그라미
    w(du - 4, dv - 2, dw + 8, 2, '#8a6a4a');
    [0, dw / 2 + 2].forEach(o => {
      w(du + o, dv, dw / 2 - 2, 26, P.cur); w(du + o, dv, 2, 26, shade(P.cur, 18)); w(du + o, dv + 24, dw / 2 - 2, 2, shade(P.cur, -26));
    });
    w(du + dw / 2 - 6, dv + 8, 12, 10, '#ffffff'); w(du + dw / 2 - 4, dv + 6, 8, 14, '#ffffff');
    w(du + dw / 2 - 2, dv + 10, 4, 6, P.cur);
    w(du - 2, dv + dh, dw + 4, 2, 'rgba(26,18,10,0.22)');
  }
}
/* 바닥 한 점의 색. tx·ty 는 칸 좌표(소수), 들판·스위스는 null — 널마루를 그대로 쓴다.
   그리스는 반 칸짜리 테라코타 타일, 일본은 두 칸짜리 다다미를 벽돌처럼 어긋나게 깐다. */
function themeFloorAt(P, r, tx, ty){
  if (P.theme === 'seaside'){
    const gx = Math.floor(tx * 2), gy = Math.floor(ty * 2), fx = tx * 2 - gx, fy = ty * 2 - gy;
    if (fx < 0.07 || fy < 0.07) return '#eadcc8';                              // 줄눈
    const col = P.floor[Math.floor(R.prand('gt' + r + gx + '_' + gy) * 4)];
    if (fx > 0.9 || fy > 0.9) return shade(col, -14);                          // 타일 가장자리가 살짝 볼록
    if (fx < 0.16 || fy < 0.16) return shade(col, 10);
    return col;
  }
  if (P.theme === 'cloud'){
    const row = Math.floor(ty), fy = ty - row, off = row % 2, m = Math.floor((tx + off) / 2), fx = (tx + off) / 2 - m;
    if (fy < 0.09 || fy > 0.91) return '#34423a';                              // 헤리(검은 천 테두리)
    if (fx < 0.03 || fx > 0.975) return '#8c8650';                             // 짧은 쪽 이음
    const col = P.floor[Math.floor(R.prand('tt' + r + row + '_' + m) * 4)];
    return Math.floor(tx * 20) % 2 ? shade(col, -6) : col;                    // 골풀 결
  }
  return null;
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
    wallGrain(wall, len, k, r);
  };
  if (P.theme){ themePaper(wallR, LW, 0, 1, P, r); themePaper(wallL, LH, -9, 0, P, r); }
  else { paper(wallR, LW, 0); paper(wallL, LH, -9); }
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
  if (P.theme) themeWindow(wallR, P, S2, L, wu, wv, ww, wh);
  else {
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
  }
  // 거실에는 왼쪽 벽에 밖으로 나가는 문이 하나
  if (r === 'living' && P.theme){
    const du = Math.max(6, Math.floor((LH - 44) / 2 / 2) * 2), dw = 40, dv = W_MOULD + 4, dh = WALLH - dv - 6;
    themeDoor(wallL, P, du, dv, dw, dh);
  } else if (r === 'living'){
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
  const tiled = P.theme === 'seaside' || P.theme === 'cloud';           // 그리스 타일·일본 다다미는 널이 아니다
  for (let cx = 0; cx < A.w && !tiled; cx += 2){
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
  if (tiled) for (let cx = 0; cx < A.w; cx += 2){
    const yTop = cx < ox ? WALLH + (ox - cx) / 2 : WALLH + (cx - ox) / 2;
    const yBot = cx < BX ? LY + cx / 2 : FBY - (cx - BX) / 2;
    let run = yTop, rc = null;                                   // 같은 색이 이어지면 한 번에 칠한다
    for (let y = yTop; y <= yBot; y++){
      let col = null;
      if (y < yBot){
        const a = (cx + 1 - ox) / TW, b = (y + 0.5 - WALLH) / TH;
        col = themeFloorAt(P, r, Math.min(Rm.w - 0.001, Math.max(0, b + a)), Math.min(Rm.h - 0.001, Math.max(0, b - a)));
      }
      if (col !== rc){ if (rc) q(cx, run, 2, y - run, rc); rc = col; run = y; }
    }
  }
  /* 벽 밑 그늘 — 걸레받이가 바닥에 닿는 자리. 빛이 안 드는 좁은 띠 하나면 벽과 바닥이
     맞물려 보인다. 없으면 바닥이 벽 뒤로 그냥 이어진 것처럼 떠 보였다. */
  for (let i = 0; i < 10; i += 2){
    const a = (0.14 * (1 - i / 10)).toFixed(3), c2 = 'rgba(26,18,10,' + a + ')';
    for (let u = 0; u < LW; u += 2){ const y2 = WALLH + u / 2 + i; if (inFloor(ox + u + 1, y2 + 1)) q(ox + u, y2, 2, 2, c2); }
    for (let u = 0; u < LH; u += 2){ const y2 = WALLH + (u + 2) / 2 + i; if (inFloor(ox - u - 1, y2 + 1)) q(ox - u - 2, y2, 2, 2, c2); }
  }
  for (let k = 0; k < Rm.h * 3 && !tiled; k++){
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
  kachel:   { c: '#ff9a3a', r: 56, dy: -10, flick: 'fire' },
  andon:    { c: '#ffe2a8', r: 64, dy: -22, flick: 'breathe' },
};
// 그 가구에서 「빛나는 색」들. 그리는 코드가 shade() 로 만든 변형까지 같이 넣어 둔다.
const LIT_BASE = {
  lamp: ['#ffe9a8', '#fff3c0', '#ffd979'], fire: ['#ff8c2e', '#ffd166', '#fff3c0'], stove: ['#ff8c2e', '#ffd166'],
  xmas: ['#ffd979', '#f2707d', '#5aa9e6', '#ffd166'], nightsky: ['#fff3c0'], tank: ['#8fd0f0', '#5aa9e6'],
  tv: ['#9fd8f0', '#e8f6ff'], stars: ['#ffe680', '#fff6d0'], wlight: ['#ffe9a8', '#fff3c0', '#ffd979'],
  mobile: ['#ffd166', '#ff8fb8', '#8fd9c8', '#a9c8ff', '#c9a8ff', '#ffffff'],
  kachel: ['#ff8c2e', '#ffd166'], andon: ['#fff3d6', '#ffe9b8', '#fff9ea'],
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
                 bigbear: 80,
                 amphora: 46, olive: 52, kachel: 66, sled: 24, kotatsu: 30, andon: 52 };
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
  amphora:'plain', olive:'plain', kachel:'plain', sled:'wood', kotatsu:'cloth', andon:'plain',
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
    /* ---- 나라별 가구(2026-09-29) — 그 농장 가게에서만 판다 ---- */
    case 'amphora': {                                                    // 그리스 항아리 — 검은 띠에 번개무늬
      const K = [[-10, 7], [-8, 4], [-2, 4], [0, 8], [4, 11], [10, 12], [15, 12], [19, 10], [23, 7], [27, 4], [29, 5]];
      const hw = y => { for (let i = 1; i < K.length; i++) if (y <= K[i][0]){ const a = K[i - 1], b = K[i]; return Math.round(a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0])); } return 4; };
      oq(4, -6, 3, 10, dk); oq(4, -6, 6, 2, dk); oq(25, -6, 3, 10, dk); oq(22, -6, 6, 2, dk);   // 손잡이 둘
      for (let y = -10; y < 30; y++){
        const h2 = hw(y), band = y >= 5 && y < 13;
        const col = y <= -8 || y >= 28 ? dk : band ? '#2a2320' : c;
        oq(16 - h2, y, h2 * 2, 1, col);
        if (!band){ oq(16 - h2 + 2, y, 2, 1, hi); oq(16 + h2 - 3, y, 3, 1, lo); }
      }
      for (let x = 7; x < 25; x += 6){ oq(x, 7, 4, 1, c); oq(x, 7, 1, 4, c); oq(x + 3, 7, 1, 3, c); oq(x + 1, 10, 3, 1, c); }   // 번개무늬
      oq(16 - 8, 1, 16, 1, '#2a2320'); oq(16 - 11, 16, 22, 1, '#2a2320');
      break;
    }
    case 'olive': {                                                      // 올리브 나무 — 흰 화분에 파란 띠
      oq(8, 16, 16, 14, '#f4f1ea'); oq(8, 19, 16, 3, '#2f6fb0'); oq(7, 14, 18, 3, '#ffffff');
      oq(20, 16, 4, 14, '#d8d4ca'); oq(8, 29, 16, 1, '#b9b3a6');
      oq(14, 2, 5, 14, '#7a6450'); oq(14, 2, 1, 14, '#9a8470'); oq(17, 6, 2, 6, '#5e4a3a');   // 굵고 비틀린 줄기
      oq(11, -4, 4, 8, '#7a6450'); oq(18, -8, 4, 11, '#7a6450'); oq(12, -6, 2, 3, '#9a8470');
      blob(CX - 7, CY - 32 - 24, 18, 14, c, shade(c, 28), shade(c, -26), 'ol1', q);
      blob(CX + 6, CY - 32 - 28, 18, 14, c, shade(c, 28), shade(c, -26), 'ol2', q);
      blob(CX, CY - 32 - 16, 24, 12, c, shade(c, 28), shade(c, -26), 'ol3', q);
      [[9, -18], [21, -22], [14, -12], [24, -14], [7, -10]].forEach(([x, y]) => { oq(x, y, 2, 2, '#3e2f4a'); oq(x, y, 1, 1, '#7a6a8a'); });
      break;
    }
    case 'kachel': {                                                     // 스위스 타일 난로 — 초록 유약 타일, 쇠문 안에 불
      box(0, 0, E, D, 6, '#6f4a2c');                                       // 받침
      box(2, 2, E - 4, D - 4, 50, c, 6);
      box(0, 0, E, D, 4, shade(c, -30), 56); box(3, 3, E - 6, D - 6, 4, shade(c, 18), 60);   // 머리 장식
      const seam = shade(c, -34);
      for (let up = 14; up < 56; up += 8){
        for (let a = 2; a < E - 2; a += 2){ const p = P(a, D - 2, up); q(p[0], p[1], 2, 1, seam); }
        for (let b = 2; b < D - 2; b += 2){ const p = P(E - 2, b, up); q(p[0], p[1], 2, 1, seam); }
      }
      [10, 18].forEach(a => { const p = P(a, D - 2, 56); q(p[0], p[1], 2, 50, seam); });
      [10, 18].forEach(b => { const p = P(E - 2, b, 56); q(p[0] - 2, p[1], 2, 50, seam); });
      for (let up = 16; up < 56; up += 8) [4, 12].forEach(a => { const p = P(a, D - 2, up); q(p[0], p[1] - 6, 2, 2, shade(c, 34)); });
      for (let a = 7; a < 17; a += 2){                                     // 쇠문 — 앞면 아래, 면을 따라 비스듬히
        const p = P(a, D - 2, 22), inner = a > 7 && a < 15;
        q(p[0], p[1], 2, 12, '#2a221b'); q(p[0], p[1], 2, 2, '#5a504a');
        if (inner){ q(p[0], p[1] + 4, 2, 8, '#ff8c2e'); if (a > 9 && a < 13) q(p[0], p[1] + 7, 2, 5, '#ffd166'); }
      }
      break;
    }
    case 'sled': {                                                       // 나무 썰매 — 앞이 말려 올라간 날, 체크 담요
      [3, D - 7].forEach(b => {
        box(4, b, E - 12, 3, 2, '#5e3a20');                                // 날
        box(E - 9, b, 3, 3, 6, '#5e3a20', 2); box(E - 12, b, 4, 3, 2, '#5e3a20', 8);   // 말려 올라간 앞
        box(10, b, 3, 3, 9, '#8a5a34', 2); box(E - 20, b, 3, 3, 9, '#8a5a34', 2);     // 다리
      });
      for (let a = 7; a < E - 12; a += 6) box(a, 2, 4, D - 4, 2, c, 11);   // 앉는 널
      box(14, 5, 16, D - 10, 4, '#fffaf2', 13);                            // 접은 담요
      for (let a = 16; a < 30; a += 5) top(a, 5, 17, 2, D - 10, '#3f7d5c');
      for (let b = 7; b < D - 6; b += 5) top(14, b, 17, 16, 2, '#3f7d5c');
      break;
    }
    case 'kotatsu': {                                                    // 고타쓰 — 이불을 덮은 낮은 탁자, 귤 한 바구니
      box(0, 0, E, D, 18, c);
      for (let a = 6; a < E - 2; a += 10){ const p = P(a, D - 2, 12); q(p[0], p[1], 4, 3, '#fff6f0'); q(p[0] + 1, p[1] + 1, 2, 1, '#ffd166'); }
      for (let b = 6; b < D - 2; b += 10){ const p = P(E - 2, b, 12); q(p[0] - 4, p[1], 4, 3, '#fff6f0'); }
      box(0, 0, E, D, 2, shade(c, -26));                                   // 이불 아랫단
      top(0, 0, 18, E, D, shade(c, 16));                                  // 상판 둘레로 이불 윗면이 보인다
      box(5, 4, E - 10, D - 8, 3, '#a8744a', 19); top(7, 6, 22, E - 14, D - 12, '#c48a58');   // 나무 상판
      box(E / 2 - 7, D / 2 - 6, 12, 12, 3, '#3a3230', 22);                  // 바구니
      [[E / 2 - 5, D / 2 - 4], [E / 2, D / 2 - 5], [E / 2 - 3, D / 2]].forEach(([a, b]) => { box(a, b, 5, 5, 4, '#ff9a2e', 24); top(a + 1, b + 1, 28, 2, 2, '#ffc46b'); });
      break;
    }
    case 'andon': {                                                      // 종이 등 — 나무 살에 한지를 발랐다
      const wd = '#5e4130';
      oq(8, 26, 3, 6, wd); oq(21, 26, 3, 6, wd); oq(7, 24, 18, 3, wd); oq(7, 24, 18, 1, '#8a6a4a');
      oq(8, -14, 16, 38, c); oq(12, -8, 8, 28, '#fff9ea');                 // 종이와 가운데 밝은 빛
      oq(8, -14, 2, 38, wd); oq(22, -14, 2, 38, wd); oq(15, -14, 2, 38, 'rgba(94,65,48,0.35)');
      for (let y = -5; y < 24; y += 9) oq(8, y, 16, 1, '#b99f78');
      oq(7, -17, 18, 3, wd); oq(7, -17, 18, 1, '#8a6a4a');
      oq(11, -22, 2, 5, wd); oq(19, -22, 2, 5, wd); oq(11, -22, 10, 2, wd);   // 손잡이
      break;
    }
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
  const sig = r + '|' + roomTheme() + '|' + cw + 'x' + ch + '|' + (L.dark > 0.42 ? 'n' : L.dark > 0.2 ? 'e' : L.dark > 0.08 ? 'd' : 'l') + '|' + wsig;
  if (houseBg.width !== cw || houseBg.height !== ch){ houseBg.width = cw; houseBg.height = ch; houseSig = ''; }
  if (sig !== houseSig){
    houseSig = sig;
    const bg = houseBg.getContext('2d'); bg.imageSmoothingEnabled = false;
    bg.clearRect(0, 0, cw, ch);
    const keep = ctx; ctx = bg;
    drawRoomShell(bg, r, L, wallItems);
    ctx = keep;
    // 화산 섬 방 — 살짝 바랜 빛깔만. 그을음·금은 넣지 않는다(2026-10-06 로키즈 「집 내부는 너무 지저분하게 하지 마」)
    if (roomTheme() === 'mountain') scorchSprite(houseBg, 'room' + r, { fade: 0.45, burn: 0 });
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
    const rows = blink ? kidBlink(A2) : A2.dirs.S[0];
    // outlined 는 둘레에 한 도트씩 테를 두르니 그만큼 더 민다 — 그림 밑단 가운데가 (kx, ky - 1)
    const kb = outlined(who + 'room' + (blink ? 1 : 0), rows, KIDPAL[who], false, HS), kxp = Math.round((kx - A2.w / 2 - 1) * HS), kyp = Math.round((ky - A2.h - 2) * HS);
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

