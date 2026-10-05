// study.html 의 페이지 스크립트. 셈은 study-plan.js 에 있다.
// 싣는 순서: supabase → common → study-plan → 이 파일.

buildChrome('study');
buildBackdrop('study');

const DAYNAME = ['일','월','화','수','목','금','토'];
const AHEAD = 7;                                     // 「한 주 미리보기」 날 수
// 처음 쓰는 아이의 기본 공부 시간대 — 평일 16~19시, 주말 10~12시
const DEFAULT_WIN = { 0:[600,720], 1:[960,1140], 2:[960,1140], 3:[960,1140], 4:[960,1140], 5:[960,1140], 6:[600,720] };

let who = 'sua';
let plan = null;                                     // { win, tasks }
let schedules = [];                                  // 시간표(schedules) 전부
let localOnly = false;                               // study_plans 표를 못 읽으면 이 기기에만 저장
let editing = null;

const toMin = t => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); };
const hhmm  = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const minLabel = m => ((m >= 60 ? Math.floor(m / 60) + '시간 ' : '') + (m % 60 || m < 60 ? (m % 60) + '분' : '')).trim();
const todayIso = () => studyIso(new Date());
const canEdit = () => isAdmin || (me && me.author_key === who);

// ---------- 저장 ----------
// ponytail: 표를 못 읽으면(SQL 을 아직 안 돌렸거나 망이 끊김) 이 기기에만 저장한다.
//           두 기기에서 따로 쓰면 어긋난다 — study_plans 를 만든 뒤에는 서버로만 간다.
async function loadPlan(){
  const { data, error } = await sb.from('study_plans').select('data').eq('who', who).maybeSingle();
  localOnly = !!error;
  let d = data && data.data;
  if (error) { try { d = JSON.parse(localStorage.getItem('sy.study.' + who) || 'null'); } catch (e) { d = null; } }
  plan = { win: (d && d.win) || DEFAULT_WIN, tasks: (d && d.tasks) || [] };
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
    days.push({ date: studyIso(d), free: freeMinutes(plan.win[d.getDay()], busyOn(d)), wd: d.getDay(), d: new Date(d) });
  }
  const r = planStudy(days, open.map(t => ({
    id: t.id, per: t.per, due: t.due, left: t.total - doneOf(t) + doneToday(t),
  })));
  return Object.assign(r, { days });
}

// ---------- 그리기 ----------
function render(){
  const r = compute();
  const byId = Object.fromEntries(plan.tasks.map(t => [t.id, t]));
  renderToday(r, byId);
  renderCushion(r);
  renderWeek(r, byId);
  $('#tools').hidden = !canEdit();
  $('#hint').textContent = (canEdit() ? '여유 카드를 누르면 고치거나 지울 수 있어요. ' : '') +
    (localOnly ? '지금은 이 기기에만 저장돼요.' : '');
}

function renderToday(r, byId){
  const now = new Date();
  const list = r.byDay[todayIso()] || [];
  const total = list.reduce((a, x) => a + x.min, 0);
  const left = list.reduce((a, x) => a + Math.max(0, x.units - doneToday(byId[x.id])) * byId[x.id].per, 0);
  let html = '<h4>오늘 할 것 · ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + DAYNAME[now.getDay()] + '요일' +
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
        (canEdit() ? '<span class="go"><input type="number" min="1" step="1" inputmode="numeric" value="' + (rest || 1) + '" data-amt="' + t.id + '">' +
          '<button class="dot-btn small primary" data-did="' + t.id + '">했어요</button>' +
          (got ? '<button class="dot-btn small" data-undo="' + t.id + '" title="오늘 적은 것 되돌리기">↶</button>' : '') + '</span>' : '') +
        '<span class="bar"><i style="width:' + Math.min(100, got / x.units * 100) + '%"></i></span>' +
      '</li>';
    }).join('') + '</ul>';
  }
  $('#today').innerHTML = html;
}

function renderCushion(r){
  const today = todayIso();
  const rows = plan.tasks.map(t => {
    // 셈은 아침 기준이라, 보여 줄 때는 오늘 한 만큼을 빼서 지금 남은 일로 고친다
    const q = r.perTask[t.id] || { need: 0, room: 0, cushion: 0 };
    const got = doneToday(t) * t.per;
    const p = { need: Math.max(0, q.need - got), room: q.room, cushion: q.cushion + got };
    const lv = doneOf(t) >= t.total ? 'done' : cushionLevel(p);
    const days = Math.round((new Date(t.due) - new Date(today)) / 86400000);
    const dd = lv === 'done' ? '끝' : days < 0 ? '마감 지남' : days === 0 ? '오늘까지' : 'D-' + days;
    const label = {
      done: '다 했어요 👏',
      easy: '넉넉해요 · 여유 ' + minLabel(p.cushion),
      tight: '빠듯해요 · 여유 ' + minLabel(p.cushion),
      short: '시간이 ' + minLabel(-p.cushion) + ' 모자라요',
    }[lv];
    const fill = p.room ? Math.min(100, p.need / p.room * 100) : (p.need ? 100 : 0);
    return { t, lv, html:
      '<button type="button" class="cc lv-' + lv + '" data-edit="' + t.id + '">' +
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
  $('#cush').innerHTML = rows.length ? rows.map(x => x.html).join('') : '<p class="hint">할 일을 넣으면 여기에 여유가 보여요.</p>';
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
$('#today').addEventListener('click', async e => {
  const did = e.target.closest('[data-did]'), undo = e.target.closest('[data-undo]');
  const id = (did || undo) && (did || undo).dataset[did ? 'did' : 'undo'];
  if (!id) return;
  const t = plan.tasks.find(x => x.id === id);
  const day = todayIso();
  t.log = t.log || {};
  if (did) {
    const n = Math.max(1, Math.floor(+$('[data-amt="' + id + '"]').value || 0));
    t.log[day] = Math.min(t.total - (doneOf(t) - doneToday(t)), doneToday(t) + n);
    sfx('sparkle');
  } else {
    delete t.log[day];
  }
  render();
  const err = await savePlan();
  if (err) $('#hint').textContent = '저장하지 못했어요 — ' + err;
});

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
  await savePlan();
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
  if (!b || b.dataset.who === who) return;
  who = b.dataset.who;
  $$('#whoPick .dot-btn').forEach(x => x.classList.toggle('on', x === b));
  await loadPlan(); render();
});

// ---------- 시작 ----------
async function load(){
  if (me && (me.author_key === 'sua' || me.author_key === 'yona')) {
    who = me.author_key;
    $$('#whoPick .dot-btn').forEach(x => x.classList.toggle('on', x.dataset.who === who));
  }
  const res = await sb.from('schedules').select('*');
  schedules = res.error ? [] : (res.data || []);
  await loadPlan();
  render();
}

function showGate(){
  const gate = $('#gate');
  gate.innerHTML = '';
  if (isLoggedIn) { $('#app').hidden = false; return true; }
  $('#app').hidden = true;
  gate.innerHTML = '<p class="why">공부 계획은 시간표를 끌어다 써서, 시간표처럼 가족만 볼 수 있어요.</p>';
  mountLoginBox(gate, reboot);
  revealNow(gate);
  return false;
}
async function reboot(){ await refreshAuth(); if (showGate()) await load(); }

(async () => {
  await refreshAuth();
  if (showGate()) await load();
  initReveal();
})();
