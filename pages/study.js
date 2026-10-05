// study.html 의 페이지 스크립트. 셈은 study-plan.js 에 있다.
// 싣는 순서: supabase → common → study-plan → study-xp → (hero-walk, 있으면) → 이 파일.

buildChrome('study');
buildBackdrop('study');

const DAYNAME = ['일','월','화','수','목','금','토'];
const AHEAD = 7;                                     // 「한 주 미리보기」 날 수
// 처음 쓰는 아이의 기본 공부 시간대 — 평일 16시·주말 10시부터 밤 11시 반까지(2026-10-05 부모: 집 공부는 보통 23:30 까지).
// 학교·학원·그 밖 일정은 시간표에서 빠지니, 저녁 먹는 시간 같은 건 「공부 시간 정하기」에서 줄이면 된다
const DEFAULT_WIN = { 0:[600,1410], 1:[960,1410], 2:[960,1410], 3:[960,1410], 4:[960,1410], 5:[960,1410], 6:[600,1410] };

let who = 'sua';
let plan = null;                                     // { win, tasks } — 지금 보는 아이(who)의 것
let view = 'both';                                   // 처음엔 둘을 나란히(2026-10-05 부모 요청), 탭을 누르면 한 아이
const plans = {};                                    // 아이별 계획
// 셈·그리기·저장은 who/plan 을 본다. 둘을 나란히 그릴 때는 잠깐 그 아이로 바꿔 부른다
function withKid(k, fn){ const w = who, p = plan; who = k; plan = plans[k]; try { return fn(); } finally { who = w; plan = p; } }
let schedules = [];                                  // 시간표(schedules) 전부
let scheduleOk = false;                               // 시간표를 읽었나(가족만 읽힌다)
let localOnly = false;                               // study_plans 표를 못 읽으면 이 기기에만 저장
let editing = null;
let gridAt = null;                                   // 잔디 달력이 보는 달 { y, m(1~12) } — null 이면 이번 달
let walk = null;                                     // HEROWALK.mount 가 돌려준 것

const toMin = t => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); };
const hhmm  = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const minLabel = m => ((m >= 60 ? Math.floor(m / 60) + '시간 ' : '') + (m % 60 || m < 60 ? (m % 60) + '분' : '')).trim();
const todayIso = () => studyIso(new Date());
const canEdit = () => isAdmin || (me && me.author_key === who);

// ---------- 저장 ----------
// ponytail: 표를 못 읽으면(SQL 을 아직 안 돌렸거나 망이 끊김) 이 기기에만 저장한다.
//           두 기기에서 따로 쓰면 어긋난다 — study_plans 를 만든 뒤에는 서버로만 간다.
async function loadPlans(){
  const { data, error } = await sb.from('study_plans').select('who, data');
  localOnly = !!error;
  ['sua', 'yona'].forEach(k => {
    let d = (data || []).find(r => r.who === k);
    d = d && d.data;
    if (error) { try { d = JSON.parse(localStorage.getItem('sy.study.' + k) || 'null'); } catch (e) { d = null; } }
    // 손님도 읽는 줄이라 화면에 그대로 찍히는 숫자 칸은 숫자로 다진다(아이 계정은 제 줄 data 를 아무 JSON 으로나 쓸 수 있다)
    const num = v => Math.max(0, Math.floor(+v) || 0);
    const tasks = ((d && d.tasks) || []).map(t => Object.assign({}, t, { total: num(t.total), per: Math.max(1, num(t.per)), base: Math.floor(+t.base) || 0 }));
    plans[k] = { win: (d && d.win) || DEFAULT_WIN, tasks, free: (d && d.free) || {} };
  });
  plan = plans[who];
}
async function savePlan(){
  if (localOnly) {
    try { localStorage.setItem('sy.study.' + who, JSON.stringify(plan)); return null; }
    catch (e) { return '이 브라우저는 저장이 막혀 있어요.'; }
  }
  const { error } = await sb.from('study_plans')
    .upsert({ who, data: plan, updated_at: new Date().toISOString() });
  return error ? readableError(error) : null;
}

// ---------- 셈에 넣을 것 ----------
// 그 아이의 그날 일정(학교·학원)을 [시작, 끝] 분으로. 시간표 쪽(time.js itemsOn)과 같은 규칙.
function busyOn(date){
  const ds = studyIso(date), wd = date.getDay();
  return schedules.filter(s => {
    if (s.who !== who && s.who !== 'together') return false;
    if (s.on_date) return s.on_date === ds;
    if (s.weekday !== wd) return false;
    if (s.valid_from && ds < s.valid_from) return false;
    if (s.valid_to && ds > s.valid_to) return false;
    return true;
  }).map(s => [toMin(s.start_at), s.end_at ? toMin(s.end_at) : toMin(s.start_at) + 40]);
}

const doneOf = t => (t.base || 0) + Object.values(t.log || {}).reduce((a, n) => a + n, 0);
const doneToday = t => (t.log || {})[todayIso()] || 0;

// 오늘 몫은 「오늘 아침에 남았던 양」으로 셈한다. 하는 중에 몫이 줄었다 늘었다 하지 않게.
function compute(){
  const today = todayIso();
  // 오늘 끝낸 것도 오늘 목록에는 남아야 하니 「아침에 열려 있던 것」으로 거른다
  const open = plan.tasks.filter(t => doneOf(t) - doneToday(t) < t.total);
  const lastDue = open.reduce((m, t) => (t.due > m ? t.due : m), today);
  const days = [];
  for (let d = new Date(); studyIso(d) <= lastDue || days.length < AHEAD; d = addDays(d, 1)) {
    const ds = studyIso(d);
    // 시간표는 가족만 읽는다. 손님은 가족이 볼 때 적어 둔 「그날 빈 분」(plan.free)을 쓰고, 없으면 시간대만으로 센다
    const free = scheduleOk ? freeMinutes(plan.win[d.getDay()], busyOn(d))
      : (plan.free[ds] != null ? plan.free[ds] : freeMinutes(plan.win[d.getDay()], []));
    days.push({ date: ds, free, wd: d.getDay(), d: new Date(d) });
  }
  const r = planStudy(days, open.map(t => ({
    id: t.id, per: t.per, due: t.due, left: t.total - doneOf(t) + doneToday(t),
  })));
  return Object.assign(r, { days });
}

// 가족(고칠 수 있는 사람)이 볼 때 날짜별 빈 분만 계획에 적어 둔다 — 손님이 같은 계획을 보게.
// 시각·장소는 안 남기고 「그날 몇 분 비는지」만. ponytail: 시간표를 바꾼 뒤 가족이 한 번 열어야 손님 쪽도 맞춰진다
function syncFree(days){
  if (!scheduleOk || !canEdit()) return;
  const free = Object.fromEntries(days.map(x => [x.date, x.free]));
  if (JSON.stringify(free) === JSON.stringify(plan.free)) return;
  plan.free = free;
  savePlan();
}

// ---------- 그리기 ----------
function render(){
  const both = view === 'both';
  $('#single').hidden = both; $('#both').hidden = !both;
  if (both) { renderBoth(); renderGrass(); $('#tools').hidden = true; return; }
  const r = compute();
  syncFree(r.days);
  const byId = Object.fromEntries(plan.tasks.map(t => [t.id, t]));
  renderToday(r, byId);
  renderGrass();
  renderCushion(r);
  renderWeek(r, byId);
  $('#tools').hidden = !canEdit();
  $('#hint').textContent = (canEdit() ? '여유 카드를 누르면 고치거나 지울 수 있어요. ' : '') +
    (localOnly ? '지금은 이 기기에만 저장돼요.' : '') +
    (isLoggedIn ? '' : '보기만 할 수 있어요. 고치거나 「했어요」를 누르려면 위의 로그인을 눌러 주세요.');
}

// 둘을 나란히 — 아이마다 「오늘 할 것」과 여유 카드. 잔디·한 주·할 일 넣기는 탭에서 한 아이씩
function renderBoth(){
  $('#both').innerHTML = ['sua', 'yona'].map(k =>
    '<div class="bcol" data-k="' + k + '"><h3 class="day-head">' + HERO_NAMES[k] +
      ' <button type="button" class="dot-btn small" data-more="' + k + '">자세히 ›</button></h3>' +
      '<div class="box today"></div><div class="cush"></div></div>').join('');
  ['sua', 'yona'].forEach(k => withKid(k, () => {
    const r = compute(), col = $('#both [data-k="' + k + '"]');
    syncFree(r.days);
    renderToday(r, Object.fromEntries(plan.tasks.map(t => [t.id, t])), col.querySelector('.today'));
    renderCushion(r, col.querySelector('.cush'));
  }));
  $('#hint').textContent = '이름 옆 「자세히」나 위의 탭을 누르면 그 아이의 잔디·한 주·할 일 넣기가 나와요.' +
    (isLoggedIn ? '' : ' 지금은 보기만 할 수 있어요 — 고치려면 로그인해 주세요.');
}
$('#both').addEventListener('click', e => {
  const m = e.target.closest('[data-more]'), c = e.target.closest('.cc');
  if (m) pick(m.dataset.more);
  else if (c) {                                        // 여유 카드를 누르면 그 아이 탭으로 가서 고친다
    const k = c.closest('[data-k]').dataset.k;
    pick(k);
    if (canEdit()) openSheet(plan.tasks.find(t => t.id === c.dataset.edit));
  }
});

// 오늘 몫 중 아직 안 한 분
const leftToday = (r, byId) => (r.byDay[todayIso()] || []).reduce((a, x) => a + Math.max(0, x.units - doneToday(byId[x.id])) * byId[x.id].per, 0);

// 🔥 연속 n일 — 하루 빠져 불씨만 남았으면 「불씨」, 배지(7·30일)가 3일 안이면 귀띔
function fireTag(){
  const s = studyStreak(plan, todayIso());
  if (!s.alive) return '';
  const goal = s.days < 7 ? 7 : s.days < 30 ? 30 : 0, more = goal - s.days;
  return '<span class="fire' + (s.graceUsed ? ' ember' : '') + '" title="하루 빠지는 건 봐줘요. 이틀 연속 빠지면 끊겨요.">' +
    (s.graceUsed ? '🔥 불씨 · 오늘 하면 ' + (s.days + 1) + '일' : '🔥 연속 ' + s.days + '일') +
    (goal && more <= 3 ? '<em>' + more + '일 더 하면 배지!</em>' : '') + '</span>';
}

function renderToday(r, byId, el){
  const now = new Date();
  const list = r.byDay[todayIso()] || [];
  const total = list.reduce((a, x) => a + x.min, 0);
  const left = leftToday(r, byId);
  let html = '<h4>오늘 할 것 · ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + DAYNAME[now.getDay()] + '요일' + fireTag() +
    (total ? '<small>' + (left ? '남은 시간 약 ' + minLabel(left) : '오늘 몫 끝! 🎉') + ' / 모두 ' + minLabel(total) + '</small>' : '') + '</h4>';
  if (!list.length) {
    html += '<div class="none">' + (plan.tasks.length ? '오늘은 정해진 공부가 없어요. 쉬어도 돼요!' : '아직 할 일이 없어요. 아래 「할 일 넣기」로 시작해요.') + '</div>';
  } else {
    html += '<ul>' + list.map(x => {
      const t = byId[x.id], got = doneToday(t), rest = Math.max(0, x.units - got);
      return '<li class="' + (rest ? '' : 'ok') + '">' +
        '<span class="nm">' + escapeHTML(t.title) + '</span>' +
        '<span class="amt">' + x.units + escapeHTML(t.unit) + '</span>' +
        '<span class="min">약 ' + minLabel(x.min) + (got ? ' · ' + got + escapeHTML(t.unit) + ' 했어요' : '') + '</span>' +
        (canEdit() ? '<span class="go"><input type="number" min="1" step="1" inputmode="numeric" value="' + (rest || 1) + '" data-amt="' + escapeHTML(t.id) + '" aria-label="' + escapeHTML(t.title) + ' 한 만큼(' + escapeHTML(t.unit) + ')">' +
          '<button class="dot-btn small primary" data-did="' + escapeHTML(t.id) + '" aria-label="' + escapeHTML(t.title) + ' 했어요">했어요</button>' +
          (got ? '<button class="dot-btn small" data-undo="' + escapeHTML(t.id) + '" title="오늘 적은 것 되돌리기" aria-label="' + escapeHTML(t.title) + ' 오늘 적은 것 되돌리기">↶</button>' : '') + '</span>' : '') +
        '<span class="bar"><i style="width:' + Math.min(100, got / x.units * 100) + '%"></i></span>' +
      '</li>';
    }).join('') + '</ul>';
  }
  (el || $('#today')).innerHTML = html;
}

// 이번 달 공부 잔디 — 진하기는 그날 공부한 분(30·60·90분 경계), 색은 아이마다(수아 코랄·연아 민트).
// 「둘 다」면 한 칸을 대각선으로 반반 — 왼쪽 위 수아, 오른쪽 아래 연아
const GRASS_RGB = { sua: '255,127,138', yona: '108,199,179' };
const grassTint = (k, min) => { const a = min <= 0 ? 0 : min < 30 ? 0.3 : min < 60 ? 0.55 : min < 90 ? 0.8 : 1; return a ? 'rgba(' + GRASS_RGB[k] + ',' + a + ')' : 'transparent'; };
function renderGrass(){
  const now = new Date(), at = gridAt || { y: now.getFullYear(), m: now.getMonth() + 1 };
  const kids = view === 'both' ? ['sua', 'yona'] : [who];
  const grids = Object.fromEntries(kids.map(k => [k, monthGrid(plans[k], at.y, at.m)]));
  const g = grids[kids[0]], today = todayIso();
  const lead = (g[0].wd + 6) % 7;                      // 월요일부터
  const isNow = at.y === now.getFullYear() && at.m === now.getMonth() + 1;
  const cell = (x, i) => {
    const mins = kids.map(k => grids[k][i].min), open = kids.some(k => grids[k][i].open);
    const bg = kids.length === 1 ? grassTint(kids[0], mins[0])
      : 'linear-gradient(135deg,' + grassTint('sua', mins[0]) + ' 50%,' + grassTint('yona', mins[1]) + ' 50%)';
    const tip = x.date + kids.map((k, j) => mins[j] ? ' · ' + (kids.length > 1 ? HERO_NAMES[k] + ' ' : '') + minLabel(mins[j]) : '').join('') + (open ? '' : ' · 쉬는 날');
    return '<span class="c' + (open ? '' : ' off') + (x.date === today ? ' now' : '') + '" title="' + tip + '" role="img" aria-label="' + tip + '"' +
      (mins.some(m => m > 0) ? ' style="background:' + bg + '"' : '') + '>' + x.day + '</span>';
  };
  const sum = kids.map(k => {
    const gg = grids[k], n = gg.filter(x => x.units > 0).length, op = gg.filter(x => x.open);
    const full = op.length > 0 && op.every(x => x.units > 0);
    return (kids.length > 1 ? '<i class="gdot" style="background:rgb(' + GRASS_RGB[k] + ')"></i>' + HERO_NAMES[k] + ' ' : '') + n + '일' + (full ? ' 🎉' : '');
  }).join(' · ');
  const legend = kids.map(k => (kids.length > 1 ? HERO_NAMES[k] + ' ' : '조금 ') +
    [10, 40, 70, 100].map(m => '<i style="background:' + grassTint(k, m) + '"></i>').join('') + (kids.length > 1 ? '' : ' 많이')).join(' &nbsp; ');
  $('#grass').innerHTML =
    '<div class="gh"><button type="button" class="dot-btn small" data-gm="-1" aria-label="앞 달">◀</button>' +
      '<b>' + at.y + '년 ' + at.m + '월</b>' +
      '<button type="button" class="dot-btn small" data-gm="1" aria-label="다음 달"' + (isNow ? ' disabled' : '') + '>▶</button></div>' +
    '<div class="gcal">' + ['월','화','수','목','금','토','일'].map(d => '<span class="wd">' + d + '</span>').join('') +
      '<span></span>'.repeat(lead) + g.map(cell).join('') +
    '</div>' +
    '<p class="gsum">' + (isNow ? '이번 달 ' : at.m + '월에 ') + sum + ' 공부</p>' +
    '<div class="glegend">' + legend + '</div>' +
    (kids.length > 1 ? '<p class="glegend">한 칸의 왼쪽 위 ◤ 는 수아, 오른쪽 아래 ◢ 는 연아예요.</p>' : '');
}
$('#grass').addEventListener('click', e => {
  const b = e.target.closest('[data-gm]');
  if (!b) return;
  const now = new Date(), at = gridAt || { y: now.getFullYear(), m: now.getMonth() + 1 };
  const d = new Date(at.y, at.m - 1 + (+b.dataset.gm), 1);
  gridAt = { y: d.getFullYear(), m: d.getMonth() + 1 };
  renderGrass();
});

// ---------- 걷기 장면(HEROWALK 가 있을 때만) ----------
function studyLv(){
  const xp = studyEvents(who, plan).reduce((a, e) => a + e.xp, 0);
  let lv = 0;
  while (lv < 12 && xp >= 5 * (lv + 1) * (lv + 2)) lv++;     // life.js 와 같은 need(n) = 5n(n+1), 최고 Lv.12
  return lv;
}
function mountWalk(){
  const cv = $('#studyWalk');
  if (walk && walk.destroy) walk.destroy();
  walk = null;
  if (typeof window.HEROWALK === 'undefined') { cv.hidden = true; return; }
  cv.hidden = false;
  walk = window.HEROWALK.mount(cv, {
    kids: view === 'both' ? ['sua', 'yona'] : [who], compact: true,
    getStats: k => withKid(k, () => ({ wisdom: { lv: studyLv() } })),
    streak: k => withKid(k, () => studyStreak(plan, todayIso()).days),
  });
}

function renderCushion(r, el){
  const today = todayIso();
  const rows = plan.tasks.map(t => {
    // 셈은 아침 기준이라, 보여 줄 때는 오늘 한 만큼을 빼서 지금 남은 일로 고친다
    const q = r.perTask[t.id] || { need: 0, room: 0, cushion: 0 };
    const got = doneToday(t) * t.per;
    const p = { need: Math.max(0, q.need - got), room: q.room, cushion: q.cushion + got };
    const days = Math.round((new Date(t.due) - new Date(today)) / 86400000);
    // 마감이 지났으면 오늘 빈 시간이 남아도 「넉넉」이 아니다 — 맨 위(급함)로 올린다
    const lv = doneOf(t) >= t.total ? 'done' : days < 0 ? 'short' : cushionLevel(p);
    const dd = lv === 'done' ? '끝' : days < 0 ? '마감 지남' : days === 0 ? '오늘까지' : 'D-' + days;
    const label = {
      done: '다 했어요 👏',
      easy: '넉넉해요 · 여유 ' + minLabel(p.cushion),
      tight: '빠듯해요 · 여유 ' + minLabel(p.cushion),
      short: p.cushion < 0 ? '시간이 ' + minLabel(-p.cushion) + ' 모자라요' : '마감이 지났어요 · 오늘 끝내요',
    }[lv];
    const fill = p.room ? Math.min(100, p.need / p.room * 100) : (p.need ? 100 : 0);
    return { t, lv, html:
      '<button type="button" class="cc lv-' + lv + '" data-edit="' + escapeHTML(t.id) + '">' +
        '<div class="top"><b>' + escapeHTML(t.title) + '</b><span class="dd">' + dd + '</span></div>' +
        '<div class="sub">' + doneOf(t) + ' / ' + t.total + escapeHTML(t.unit) +
          (lv === 'done' ? '' : ' · 남은 일 ' + minLabel(p.need) + ' · 빈 시간 ' + minLabel(p.room)) + '</div>' +
        '<div class="cbar"><i style="width:' + (lv === 'done' ? 100 : fill) + '%"></i></div>' +
        '<div class="lv">' + label + '</div>' +
      '</button>' };
  });
  // 급한 것부터: 모자람 → 빠듯 → 넉넉 → 끝
  const order = { short: 0, tight: 1, easy: 2, done: 3 };
  rows.sort((a, b) => order[a.lv] - order[b.lv] || (a.t.due < b.t.due ? -1 : 1));
  (el || $('#cush')).innerHTML = rows.length ? rows.map(x => x.html).join('') : '<p class="hint">할 일을 넣으면 여기에 여유가 보여요.</p>';
}

function renderWeek(r, byId){
  const today = todayIso();
  $('#week').innerHTML = r.days.slice(0, AHEAD).map(day => {
    const list = r.byDay[day.date] || [];
    const used = list.reduce((a, x) => a + x.min, 0);
    return '<div class="d' + (day.date === today ? ' today' : '') + '">' +
      '<h5>' + DAYNAME[day.wd] + '<small>' + (day.d.getMonth() + 1) + '/' + day.d.getDate() + '</small></h5>' +
      '<div class="fr">' + (day.free ? minLabel(used) + ' / ' + minLabel(day.free) : '쉬는 날') + '</div>' +
      list.map(x => '<div class="chip" title="' + escapeHTML(byId[x.id].title + ' ' + x.units + byId[x.id].unit) + '"><b>' +
        escapeHTML(byId[x.id].title) + '</b> <span>' + x.units + escapeHTML(byId[x.id].unit) + '</span></div>').join('') +
    '</div>';
  }).join('');
}

// ---------- 했어요 ----------
$('#app').addEventListener('click', e => {
  const did = e.target.closest('.today [data-did]'), undo = e.target.closest('.today [data-undo]');
  if (!did && !undo) return;
  const col = e.target.closest('[data-k]');
  if (col) withKid(col.dataset.k, () => logDone(e, did, undo, col)); else logDone(e, did, undo, $('#today'));
});
async function logDone(e, did, undo, box){
  const id = (did || undo).dataset[did ? 'did' : 'undo'];
  const t = plan.tasks.find(x => x.id === id);
  const day = todayIso();
  t.log = t.log || {};
  if (did) {
    const before = leftToday(compute(), Object.fromEntries(plan.tasks.map(x => [x.id, x])));
    const n = Math.max(1, Math.floor(+box.querySelector('[data-amt="' + CSS.escape(id) + '"]').value || 0));
    t.log[day] = Math.min(t.total - (doneOf(t) - doneToday(t)), doneToday(t) + n);
    const after = leftToday(compute(), Object.fromEntries(plan.tasks.map(x => [x.id, x])));
    if (walk && walk.burst) walk.burst(who, '+10');
    if (before > 0 && after === 0) {                   // 오늘 몫을 다 채운 순간
      sfx('fanfare');
      cheer('오늘 몫 끝! 📚 지혜 +10');
    } else sfx('sparkle');
  } else {
    delete t.log[day];
  }
  const err = await savePlan();                       // 저장을 먼저 — render 가 who 를 되돌리기 전에
  render();
  if (err) $('#hint').textContent = '저장하지 못했어요 — ' + err;
}

// 화면 아래 잠깐 뜨는 축하 한 줄
let cheerTimer = 0;
function cheer(text){
  const el = $('#cheer');
  el.hidden = true; void el.offsetWidth;               // 연달아 눌러도 움직임이 처음부터 다시 돈다
  el.textContent = text; el.hidden = false;
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => { el.hidden = true; }, 2700);
}

// ---------- 할 일 창 ----------
function openSheet(t){
  editing = t || null;
  $('#shTitle').textContent = t ? '할 일 고치기' : '할 일 넣기';
  $('#fTitle').value = t ? t.title : '';
  $('#fTotal').value = t ? t.total : '';
  $('#fUnit').value = t ? t.unit : '쪽';
  $('#fBase').value = t ? doneOf(t) : 0;
  $('#fPer').value = t ? t.per : 5;
  $('#fDue').value = t ? t.due : studyIso(addDays(new Date(), 7));
  $('#fDel').hidden = !t;
  $('#fMsg').className = 'msg'; $('#fMsg').textContent = '';
  $('#sheet').hidden = false;
  $('#fTitle').focus();
}
const closeSheet = () => { $('#sheet').hidden = true; editing = null; };

$('#fDueQuick').addEventListener('click', e => {
  const b = e.target.closest('[data-d]');
  if (b) $('#fDue').value = studyIso(addDays(new Date(), +b.dataset.d));
});
$('#fCancel').addEventListener('click', closeSheet);
$('#fSave').addEventListener('click', async () => {
  const title = $('#fTitle').value.trim(), total = Math.floor(+$('#fTotal').value),
        done = Math.max(0, Math.floor(+$('#fBase').value || 0)), per = Math.floor(+$('#fPer').value), due = $('#fDue').value;
  const bad = !title ? '이름을 적어 주세요.' : !(total >= 1) ? '전체 분량을 1 이상으로 적어 주세요.'
    : !(per >= 1) ? '하나에 몇 분 걸리는지 적어 주세요.' : !due ? '마감 날짜를 골라 주세요.'
    : done > total ? '벌써 한 것이 전체보다 많아요.' : '';
  if (bad) { $('#fMsg').className = 'msg error'; $('#fMsg').textContent = bad; return; }

  const t = editing || { id: Date.now().toString(36), log: {} };
  // 「벌써 한 것」을 고치면 기록(log)은 두고 시작값(base)으로 맞춘다
  t.base = done - Object.values(t.log || {}).reduce((a, n) => a + n, 0);
  Object.assign(t, { title: title.slice(0, 40), total, unit: $('#fUnit').value, per, due });
  if (!editing) plan.tasks.push(t);
  const err = await savePlan();
  if (err) { $('#fMsg').className = 'msg error'; $('#fMsg').textContent = err; return; }
  closeSheet(); render();
});
$('#fDel').addEventListener('click', async () => {
  if (!editing || !confirm('「' + editing.title + '」을(를) 지울까요?')) return;
  plan.tasks = plan.tasks.filter(t => t !== editing);
  const err = await savePlan();
  if (err) { $('#fMsg').className = 'msg error'; $('#fMsg').textContent = '지우지 못했어요 — ' + err; return; }
  closeSheet(); render();
});
$('#cush').addEventListener('click', e => {
  const b = e.target.closest('[data-edit]');
  if (b && canEdit()) openSheet(plan.tasks.find(t => t.id === b.dataset.edit));
});
$('#addBtn').addEventListener('click', () => openSheet(null));

// ---------- 공부 시간 창 ----------
$('#winBtn').addEventListener('click', () => {
  $('#wRows').innerHTML = [1,2,3,4,5,6,0].map(wd => {
    const w = plan.win[wd];
    return '<div class="row3"><b>' + DAYNAME[wd] + '</b>' +
      '<input type="time" step="600" data-ws="' + wd + '" value="' + (w ? hhmm(w[0]) : '') + '">' +
      '<input type="time" step="600" data-we="' + wd + '" value="' + (w ? hhmm(w[1]) : '') + '"></div>';
  }).join('');
  $('#wMsg').textContent = '';
  $('#winSheet').hidden = false;
});
$('#wCancel').addEventListener('click', () => { $('#winSheet').hidden = true; });
$('#wSave').addEventListener('click', async () => {
  const win = {};
  for (let wd = 0; wd < 7; wd++) {
    const s = $('[data-ws="' + wd + '"]').value, e = $('[data-we="' + wd + '"]').value;
    if (!s && !e) { win[wd] = null; continue; }
    if (!s || !e || toMin(e) <= toMin(s)) {
      $('#wMsg').className = 'msg error';
      $('#wMsg').textContent = DAYNAME[wd] + '요일: 끝이 시작보다 늦어야 해요(쉬는 날이면 둘 다 비워요).';
      return;
    }
    win[wd] = [toMin(s), toMin(e)];
  }
  plan.win = win;
  const err = await savePlan();
  if (err) { $('#wMsg').className = 'msg error'; $('#wMsg').textContent = err; return; }
  $('#winSheet').hidden = true; render();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeSheet(); $('#winSheet').hidden = true;
});

// ---------- 누구 ----------
$('#whoPick').addEventListener('click', async e => {
  const b = e.target.closest('[data-who]');
  if (!b) return;
  pick(b.dataset.who);
});
function pick(v){
  if (v === view) return;
  view = v;
  if (v !== 'both') { who = v; plan = plans[v]; }
  $$('#whoPick .dot-btn').forEach(x => { x.classList.toggle('on', x.dataset.who === v); x.setAttribute('aria-pressed', x.dataset.who === v); });
  render(); mountWalk();
}

// ---------- 시작 ----------
async function load(){
  if (me && (me.author_key === 'sua' || me.author_key === 'yona')) {
    who = me.author_key;                               // 탭을 누르면 먼저 제 것. 처음 화면은 그래도 둘 다
  }
  const res = isLoggedIn ? await sb.from('schedules').select('*') : { error: true };
  scheduleOk = !res.error;
  schedules = res.error ? [] : (res.data || []);
  await loadPlans();
  render();
  mountWalk();
}

// 자정을 넘겨 열어 둔 탭(휴대폰·태블릿)이 어제 「오늘 할 것」·「오늘 몫 끝!」을 계속 보이지 않게 — 날이 바뀌면 다시 그린다
let shownDay = todayIso();
setInterval(() => { if (todayIso() !== shownDay && plan) { shownDay = todayIso(); render(); } }, 60000);

// 2026-10-05 부모 요청: 손님도 보게 한다. 고치기·「했어요」는 canEdit() 이 로그인한 가족에게만 연다
(async () => {
  await refreshAuth();
  $('#app').hidden = false;
  await load();
  initReveal();
})();
