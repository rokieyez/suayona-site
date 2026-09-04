// time.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('time');
buildBackdrop('time');

const DAYNAME = ['일','월','화','수','목','금','토'];
const WHONAME = { sua:'수아', yona:'연아', together:'둘 다' };
const KINDNAME = { school:'학교', academy:'학원', other:'그 밖' };
const DEFAULT_LEN = 40;              // 끝 시각을 안 적었을 때 (초등 한 교시)

let all = [];                        // 시간표 전부
let who = 'sua';                     // 격자에 띄울 아이
let anchor = new Date();             // 보고 있는 주 안의 아무 날
let editing = null;                  // 고치는 중인 행 (없으면 새로 넣는 중)
let editingGroup = [];               // 그 행과 요일만 다른 형제 줄들

// ---------- 날짜·시간 잔손질 ----------
const toMin = t => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); };
const hhmm  = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const endOf = s => s.end_at ? toMin(s.end_at) : toMin(s.start_at) + DEFAULT_LEN;
// 시작만 적어 두면 언제 끝나는지 몰라 답답하다. 끝 시각이 있으면 같이 적는다.
const spanLabel = (s, sep) =>
  s.start_at.slice(0, 5) + (s.end_at ? (sep || '-') + s.end_at.slice(0, 5) : '');
const iso   = d => d.getFullYear() + '-' +
                   String(d.getMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getDate()).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// 주는 월요일에 시작한다
function weekStart(d){
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// 그 아이의, 그 날짜의 일정. 매주 오는 것과 그날 하루짜리를 한 줄로 섞어 돌려준다.
function itemsOn(date, whoKey){
  const ds = iso(date), wd = date.getDay();
  return all.filter(s => {
    if (s.who !== whoKey && s.who !== 'together') return false;
    if (s.on_date) return s.on_date === ds;
    if (s.weekday !== wd) return false;
    if (s.valid_from && ds < s.valid_from) return false;
    if (s.valid_to   && ds > s.valid_to)   return false;
    return true;
  }).sort((a, b) => toMin(a.start_at) - toMin(b.start_at) || a.title.localeCompare(b.title));
}

// 겹치는 것끼리 묶어 폭을 나눠 준다. 한 시간에 두 개가 잡혀도 서로 가리지 않는다.
function spread(items){
  const out = [];
  let group = [], groupEnd = -1;
  const flush = () => {
    group.forEach((it, i) => out.push({ it, slot:i, of:group.length }));
    group = []; groupEnd = -1;
  };
  items.forEach(it => {
    if (group.length && toMin(it.start_at) >= groupEnd) flush();
    group.push(it);
    groupEnd = Math.max(groupEnd, endOf(it));
  });
  flush();
  return out;
}

// ---------- 오늘 ----------
function renderToday(){
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  $('#todayHead').textContent =
    '오늘 · ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + DAYNAME[now.getDay()] + '요일';

  $('#today').innerHTML = ['sua', 'yona'].map(k => {
    const list = itemsOn(now, k);
    let inner;
    if (!list.length) {
      inner = '<div class="none">오늘은 잡힌 일정이 없어요.</div>';
    } else {
      inner = '<ul>' + list.map(s => {
        const st = toMin(s.start_at), en = endOf(s);
        const cls = nowMin >= st && nowMin < en ? 'now' : (nowMin >= en ? 'past' : '');
        return '<li class="' + cls + '">' +
          '<b>' + spanLabel(s) + '</b>' +
          '<span><span class="nm">' + escapeHTML(s.title) + '</span>' +
          (s.place ? ' <span class="pl">' + escapeHTML(s.place) + '</span>' : '') + '</span>' +
          (cls === 'now' ? '<span class="tag">지금</span>' : '') +
        '</li>';
      }).join('') + '</ul>';

      const next = list.find(s => toMin(s.start_at) > nowMin);
      if (next) {
        const left = toMin(next.start_at) - nowMin;
        const h = Math.floor(left / 60), m = left % 60;
        inner += '<div class="next">다음 · ' + escapeHTML(next.title) + '까지 ' +
          (h ? h + '시간 ' : '') + m + '분</div>';
      } else if (list.some(s => endOf(s) <= nowMin)) {
        inner += '<div class="next">오늘 일정은 다 끝났어요.</div>';
      }
    }
    return '<div class="tcard"><h4>' + WHONAME[k] + '</h4>' + inner + '</div>';
  }).join('');
}

// ---------- 한 주 ----------
function renderWeek(){
  const mon = weekStart(anchor);
  const todayStr = iso(new Date());

  // 이레를 다 편다. 주말에도 학원과 나들이가 있어서, 비어 있는 칸이 보이는 편이
  // "그날은 아무것도 없다"를 알려 준다.
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    days.push({ d, list: itemsOn(d, who) });
  }

  $('#printTitle').innerHTML = '<h1>' + escapeHTML(WHONAME[who]) + ' 시간표 · ' +
    (mon.getMonth() + 1) + '월 ' + mon.getDate() + '일 주</h1>';
  $('#wkLabel').textContent =
    (mon.getMonth() + 1) + '월 ' + mon.getDate() + '일 ~ ' +
    (() => { const e = addDays(mon, 6); return (e.getMonth() + 1) + '월 ' + e.getDate() + '일'; })();

  // 시간축 범위 — 기본 08~17시에서 일정이 삐져나온 만큼만 넓힌다
  let lo = 8 * 60, hi = 17 * 60;
  days.forEach(({ list }) => list.forEach(s => {
    lo = Math.min(lo, toMin(s.start_at));
    hi = Math.max(hi, endOf(s));
  }));
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;

  // 좁은 화면에서는 칸의 최소 너비를 풀어 이레가 가로로 다 들어오게 한다.
  // 옆으로 밀어야 토요일이 보이면 "한 주 보기"가 아니게 된다.
  const narrow = window.innerWidth < 640;
  const HOUR = narrow ? 42 : 58;
  const GUT  = narrow ? 28 : 48;
  const H = (hi - lo) / 60 * HOUR;
  const grid = $('#grid');
  grid.style.gridTemplateColumns =
    GUT + 'px repeat(' + days.length + ', minmax(' + (narrow ? 0 : 76) + 'px, 1fr))';
  grid.dataset.lo = lo;          // 빈 칸을 눌렀을 때 시각을 되계산하려면 필요하다

  let html = '<div class="hcell"></div>';
  days.forEach(({ d }) => {
    const cls = ['hcell'];
    if (d.getDay() === 6) cls.push('sat');
    if (d.getDay() === 0) cls.push('sun');
    if (iso(d) === todayStr) cls.push('today');
    html += '<div class="' + cls.join(' ') + '">' + DAYNAME[d.getDay()] +
      '<small>' + (d.getMonth() + 1) + '/' + d.getDate() + '</small></div>';
  });

  // 시간 눈금
  let gut = '<div class="gut" style="height:' + H + 'px">';
  for (let m = lo; m < hi; m += 60) {          // 마지막 줄은 칸 밖으로 삐져나가서 뺀다
    const label = narrow ? String(m / 60) : hhmm(m);   // 좁으면 시(時)만
    gut += '<span style="top:' + ((m - lo) / 60 * HOUR + 3) + 'px">' + label + '</span>';
  }
  html += gut + '</div>';

  const lines = 'repeating-linear-gradient(to bottom,' +
    'transparent 0,transparent ' + (HOUR - 1) + 'px,' +
    'rgba(47,42,36,.16) ' + (HOUR - 1) + 'px,rgba(47,42,36,.16) ' + HOUR + 'px)';

  days.forEach(({ d, list }) => {
    const cls = ['col'];
    if (iso(d) === todayStr) cls.push('today');
    if (isAdmin) cls.push('hot');
    html += '<div class="' + cls.join(' ') + '" data-date="' + iso(d) + '" data-wd="' + d.getDay() + '"' +
      ' style="height:' + H + 'px; background-image:' + lines + '">';

    spread(list).forEach(({ it, slot, of }) => {
      const st = toMin(it.start_at), en = endOf(it);
      const top = (st - lo) / 60 * HOUR;
      const h = Math.max(20, (en - st) / 60 * HOUR - 2);
      const w = 100 / of;
      const long = h >= (narrow ? 36 : 40);
      const when = spanLabel(it, narrow ? ' ~' : '-');
      html += '<button type="button" class="it k-' + it.kind + (it.on_date ? ' once' : '') +
        (isAdmin ? ' editable' : '') + '" data-id="' + it.id + '"' +
        (isAdmin ? '' : ' tabindex="-1"') +
        ' title="' + escapeHTML(spanLabel(it) + ' ' + it.title + (it.place ? ' · ' + it.place : '')) + '"' +
        ' style="top:' + top + 'px; height:' + h + 'px; left:' + (slot * w) +
        '%; width:calc(' + w + '% - 2px)">' +
        '<b>' + escapeHTML(it.title) + '</b>' +
        (long ? '<span>' + escapeHTML(when) +
          (it.place && !narrow ? ' ' + escapeHTML(it.place) : '') + '</span>' : '') +
      '</button>';
    });
    html += '</div>';
  });

  grid.innerHTML = html;
}

function render(){ renderToday(); renderWeek(); }

// ---------- 창을 연 동안 뒤로가기 막기 ----------
// 휴대폰에서 창을 열어 둔 채 뒤로가기를 누르면 쓰던 내용째로 페이지를 벗어난다.
// 창을 열 때 히스토리에 한 칸을 밀어 넣어, 뒤로가기가 그 칸을 대신 먹게 한다.
let sheetPushed = false;

function holdBack(){
  if (sheetPushed) return;
  sheetPushed = true;
  history.pushState({ sheet: 1 }, '');
}
function releaseBack(){
  if (!sheetPushed) return;
  sheetPushed = false;
  history.back();                 // 우리가 넣어 둔 칸을 되돌린다
}
window.addEventListener('popstate', () => {
  if (!sheetPushed) return;
  sheetPushed = false;            // 칸은 이미 빠졌으니 back 을 또 부르지 않는다
  $('#sheet').hidden = true;
  $('#copySheet').hidden = true;
  editing = null;
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#sheet').hidden) closeSheet();
  else if (!$('#copySheet').hidden) closeCopy();
});

// ---------- 넣고 고치기 (부모만) ----------
function openSheet(row, preset){
  editing = row || null;
  const s = row || {};
  $('#shTitle').textContent = row ? '일정 고치기' : '일정 넣기';
  $('#fWho').value   = s.who   || (preset && preset.who)   || who;
  $('#fKind').value  = s.kind  || (preset && preset.kind)  || 'school';
  $('#fTitle').value = s.title || '';
  $('#fPlace').value = s.place || '';
  $('#fNote').value  = s.note  || '';
  $('#fFrom').value  = s.valid_from || '';
  $('#fTo').value    = s.valid_to   || '';

  const mode = s.on_date ? 'd' : (row ? 'w' : (preset && preset.mode) || 'w');
  $('#fMode').value = mode;

  // 같은 일정이 요일만 달리해 여러 줄로 들어가 있으면 한 덩어리로 다룬다.
  // '학교'를 열면 월~금이 다 켜진 채로 뜨고, 끝 시각을 고치면 다섯 줄이 함께 바뀐다.
  editingGroup = row && row.weekday != null ? siblingsOf(row) : [];
  const on = editingGroup.length ? editingGroup.map(r => r.weekday)
           : (s.weekday != null ? [s.weekday]
           : (preset && preset.weekday != null ? [preset.weekday] : [1]));
  setWeekdays(on);

  $('#fDate').value = s.on_date || (preset && preset.date) || iso(new Date());
  syncMode();

  const start = s.start_at ? s.start_at.slice(0, 5) : (preset && preset.start) || '09:00';
  $('#fStart').value = start;
  // 새로 넣을 때는 끝 시각을 비워 둔다. 아래 길이 단추가 시작 시각에서부터
  // 쌓이도록 하려면 미리 채워 두면 안 된다.
  $('#fEnd').value = s.end_at ? s.end_at.slice(0, 5) : '';

  $('#fDel').hidden = !row;
  $('#fMsg').className = 'msg'; $('#fMsg').textContent = '';
  $('#sheet').hidden = false;
  holdBack();
  $('#fTitle').focus();
}
function closeSheet(){ $('#sheet').hidden = true; editing = null; editingGroup = []; releaseBack(); }
function closeCopy(){ $('#copySheet').hidden = true; releaseBack(); }

// 같은 일정인데 요일만 다른 줄들. 이름·장소·시각·학기가 모두 같아야 한 덩어리로 본다.
function siblingsOf(row){
  const same = r =>
    r.weekday != null && r.who === row.who && r.kind === row.kind &&
    r.title === row.title && (r.place || '') === (row.place || '') &&
    r.start_at === row.start_at && (r.end_at || '') === (row.end_at || '') &&
    (r.valid_from || '') === (row.valid_from || '') &&
    (r.valid_to || '') === (row.valid_to || '');
  return all.filter(same).sort((a, b) => a.weekday - b.weekday);
}

function pickedWeekdays(){
  return $$('#fWeekdays button.on').map(b => +b.dataset.wd).sort((a, b) => a - b);
}
function setWeekdays(list){
  const set = new Set(list);
  $$('#fWeekdays button').forEach(b => b.classList.toggle('on', set.has(+b.dataset.wd)));
  syncWeekdayNote();
}

// 저장을 누르면 무슨 일이 벌어지는지 미리 적어 준다.
// 특히 요일을 껐을 때 그 줄이 지워진다는 걸 누르기 전에 알아야 한다.
function syncWeekdayNote(){
  const note = $('#fWdNote');
  const picked = pickedWeekdays();
  if (!picked.length) {
    note.className = 'wd-note warn';
    note.textContent = '요일을 하나 이상 골라주세요.';
    return;
  }
  const names = picked.map(w => DAYNAME[w]).join('·');
  const had = new Set(editingGroup.map(r => r.weekday));
  const gone = [...had].filter(w => !picked.includes(w));
  note.className = 'wd-note' + (gone.length ? ' warn' : '');
  note.textContent = names + ' ' + picked.length + '개 요일에 저장돼요.' +
    (gone.length ? '  ' + gone.map(w => DAYNAME[w]).join('·') + '요일은 지워집니다.' : '');
}

$('#fWeekdays').addEventListener('click', e => {
  const b = e.target.closest('[data-wd]');
  if (!b) return;
  b.classList.toggle('on');
  syncWeekdayNote();
});
$('#fWdQuick').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const p = b.dataset.preset;
  setWeekdays(p === 'weekday' ? [1,2,3,4,5] : p === 'weekend' ? [0,6] : [0,1,2,3,4,5,6]);
});

// '매주'냐 '그날 하루만'이냐에 따라 고르개를 바꿔 끼운다
function syncMode(){
  const daily = $('#fMode').value === 'd';
  $('#fWeekBox').hidden = daily;
  $('#fDateBox').hidden = !daily;
  // 하루짜리에는 학기가 없다
  $('#fFrom').disabled = $('#fTo').disabled = daily;
}
$('#fMode').addEventListener('change', syncMode);

// 끝 시각을 손으로 계산하지 않도록. 누를 때마다 그만큼 뒤로 밀린다 —
// 9시에서 30분을 세 번 누르면 10시 30분. 지우고 다시 하려면 '비우기'.
$('#fQuick').innerHTML =
  [30, 60, 120].map(n =>
    '<button type="button" data-len="' + n + '">' +
    (n < 60 ? n + '분' : (n / 60) + '시간') + '</button>').join('') +
  '<button type="button" data-clear="1">비우기</button>';

$('#fQuick').addEventListener('click', e => {
  const clear = e.target.closest('[data-clear]');
  if (clear) { $('#fEnd').value = ''; return; }
  const b = e.target.closest('[data-len]');
  const st = $('#fStart').value;
  if (!b || !st) return;
  const end = $('#fEnd').value;
  // 이미 적힌 끝 시각이 있으면 거기서 이어 붙이고, 없으면 시작 시각에서 출발한다
  const from = (end && toMin(end) > toMin(st)) ? toMin(end) : toMin(st);
  $('#fEnd').value = hhmm(Math.min(23 * 60 + 59, from + (+b.dataset.len)));
});

$('#fSave').addEventListener('click', async () => {
  const msg = $('#fMsg');
  const title = $('#fTitle').value.trim();
  if (!title) { msg.className = 'msg err'; msg.textContent = '이름을 적어주세요.'; return; }
  if (!$('#fStart').value) { msg.className = 'msg err'; msg.textContent = '시작 시각을 골라주세요.'; return; }

  const daily = $('#fMode').value === 'd';
  const endV = $('#fEnd').value;
  if (endV && toMin(endV) <= toMin($('#fStart').value)) {
    msg.className = 'msg err'; msg.textContent = '끝나는 시각이 시작보다 빨라요.'; return;
  }

  const picked = daily ? [] : pickedWeekdays();
  if (!daily && !picked.length) {
    msg.className = 'msg err'; msg.textContent = '요일을 하나 이상 골라주세요.'; return;
  }

  const base = {
    who: $('#fWho').value,
    kind: $('#fKind').value,
    title,
    place: $('#fPlace').value.trim() || null,
    on_date: daily ? $('#fDate').value : null,
    start_at: $('#fStart').value,
    end_at: endV || null,
    valid_from: daily ? null : ($('#fFrom').value || null),
    valid_to:   daily ? null : ($('#fTo').value   || null),
    note: $('#fNote').value.trim() || null,
  };

  msg.className = 'msg'; msg.textContent = '저장 중...';

  // 하루짜리는 예전과 같다 — 한 줄이면 한 줄.
  if (daily) {
    const row = Object.assign({ weekday: null }, base);
    const { error } = editing
      ? await sb.from('schedules').update(row).eq('id', editing.id)
      : await sb.from('schedules').insert(row);
    if (error) { msg.className = 'msg err'; msg.textContent = '저장 실패: ' + error.message; return; }
    closeSheet();
    await load();
    return;
  }

  // 매주 반복은 고른 요일의 수만큼 줄이 있어야 한다.
  // 이미 있던 줄은 고쳐 쓰고, 새로 고른 요일은 만들고, 끈 요일은 지운다.
  // 요일을 하나씩 다섯 번 넣지 않아도 되게 하려고 이렇게 둔다.
  const keep = editingGroup.filter(r => picked.includes(r.weekday));
  const drop = editingGroup.filter(r => !picked.includes(r.weekday));
  const fresh = picked.filter(w => !editingGroup.some(r => r.weekday === w));

  try {
    for (const r of keep) {
      const { error } = await sb.from('schedules')
        .update(Object.assign({ weekday: r.weekday }, base)).eq('id', r.id);
      if (error) throw error;
    }
    if (fresh.length) {
      const { error } = await sb.from('schedules')
        .insert(fresh.map(w => Object.assign({ weekday: w }, base)));
      if (error) throw error;
    }
    if (drop.length) {
      const { error } = await sb.from('schedules').delete().in('id', drop.map(r => r.id));
      if (error) throw error;
    }
  } catch (e) {
    msg.className = 'msg err'; msg.textContent = '저장 실패: ' + ((e && e.message) || e);
    return;
  }

  closeSheet();
  await load();
});

$('#fDel').addEventListener('click', async () => {
  if (!editing) return;
  // 요일만 다른 형제 줄이 있으면 몇 개가 사라지는지 먼저 알려준다
  const ids = editingGroup.length ? editingGroup.map(r => r.id) : [editing.id];
  const j = typeof josa === 'function' ? josa(editing.title, '을', '를') : '을(를)';
  const what = ids.length > 1
    ? '"' + editing.title + '" ' + j + ' ' + editingGroup.map(r => DAYNAME[r.weekday]).join('·') +
      ' 요일에서 모두 지울까요? (' + ids.length + '개)'
    : '"' + editing.title + '" ' + j + ' 지울까요?';
  if (!confirm(what)) return;
  const { error } = await sb.from('schedules').delete().in('id', ids);
  if (error) {
    $('#fMsg').className = 'msg err'; $('#fMsg').textContent = '지우지 못했어요: ' + error.message; return;
  }
  closeSheet();
  await load();
});

$('#fCancel').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

// 격자를 눌러서 넣기 — 빈 칸을 누르면 그 요일 그 시각이 미리 채워진다
$('#grid').addEventListener('click', e => {
  if (!isAdmin) return;

  const it = e.target.closest('.it');
  if (it) {
    const row = all.find(s => String(s.id) === it.dataset.id);
    if (row) openSheet(row);
    return;
  }

  const col = e.target.closest('.col');
  if (!col) return;
  const HOUR = window.innerWidth < 640 ? 46 : 58;
  const lo = +$('#grid').dataset.lo;
  const y = e.clientY - col.getBoundingClientRect().top;
  const raw = lo + (y / HOUR) * 60;
  const start = Math.max(0, Math.min(23 * 60 + 30, Math.round(raw / 10) * 10));   // 10분 단위로 맞춤
  openSheet(null, {
    who,
    mode: 'w',
    weekday: +col.dataset.wd,
    date: col.dataset.date,
    start: hhmm(start),
  });
});

// ---------- 학기 넘기기 ----------
function openCopy(){
  $('#cpWho').value = who;
  $('#cpFrom').value = ''; $('#cpTo').value = '';
  $('#cpMsg').className = 'msg'; $('#cpMsg').textContent = '';
  const n = all.filter(s => s.weekday != null && (s.who === who || s.who === 'together')).length;
  $('#cpWhat').textContent = '매주 반복하는 일정 ' + n + '개가 대상이에요.';
  $('#copySheet').hidden = false;
  holdBack();
}
$('#cpWho').addEventListener('change', () => {
  const k = $('#cpWho').value;
  const n = all.filter(s => s.weekday != null && (s.who === k || s.who === 'together')).length;
  $('#cpWhat').textContent = '매주 반복하는 일정 ' + n + '개가 대상이에요.';
});
$('#cpCancel').addEventListener('click', closeCopy);
$('#copySheet').addEventListener('click', e => { if (e.target.id === 'copySheet') closeCopy(); });

$('#cpGo').addEventListener('click', async () => {
  const msg = $('#cpMsg');
  const from = $('#cpFrom').value, to = $('#cpTo').value;
  if (!from) { msg.className = 'msg err'; msg.textContent = '새 학기 시작일을 골라주세요.'; return; }
  if (to && to < from) { msg.className = 'msg err'; msg.textContent = '끝나는 날이 시작보다 빨라요.'; return; }

  const k = $('#cpWho').value;
  // 새 학기 시작일에 아직 살아 있는 반복 일정만 옮긴다
  const src = all.filter(s =>
    s.weekday != null && (s.who === k || s.who === 'together') &&
    (!s.valid_to || s.valid_to >= from));
  if (!src.length) { msg.className = 'msg err'; msg.textContent = '넘길 일정이 없어요.'; return; }

  msg.className = 'msg'; msg.textContent = '넘기는 중...';

  const copies = src.map(s => ({
    who:s.who, kind:s.kind, title:s.title, place:s.place, weekday:s.weekday,
    start_at:s.start_at, end_at:s.end_at, note:s.note,
    valid_from: from, valid_to: to || null,
  }));
  const ins = await sb.from('schedules').insert(copies);
  if (ins.error) { msg.className = 'msg err'; msg.textContent = '복사 실패: ' + ins.error.message; return; }

  // 원래 것은 새 학기 하루 전까지만 — 안 그러면 둘이 겹쳐 나온다
  const cut = iso(addDays(new Date(from + 'T00:00:00'), -1));
  const upd = await sb.from('schedules').update({ valid_to: cut }).in('id', src.map(s => s.id));
  if (upd.error) {
    msg.className = 'msg err';
    msg.textContent = '복사는 됐는데 예전 것 정리에 실패했어요: ' + upd.error.message;
    return;
  }

  closeCopy();
  await load();
});

// ---------- 화면 조립 ----------
$('#whoPick').addEventListener('click', e => {
  const b = e.target.closest('[data-who]');
  if (!b) return;
  who = b.dataset.who;
  $$('#whoPick .dot-btn').forEach(x => x.classList.toggle('on', x === b));
  renderWeek();
});
$('#printBtn').addEventListener('click', () => window.print());
$('#prevWk').addEventListener('click', () => { anchor = addDays(weekStart(anchor), -7); renderWeek(); });
$('#nextWk').addEventListener('click', () => { anchor = addDays(weekStart(anchor),  7); renderWeek(); });
$('#thisWk').addEventListener('click', () => { anchor = new Date(); renderWeek(); });

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (!$('#app').hidden) renderWeek(); }, 160);
});

async function load(){
  const { data, error } = await sb.from('schedules').select('*');
  all = error ? [] : (data || []);
  render();

  $('#tools').innerHTML = isAdmin
    ? '<button class="dot-btn primary small" id="addBtn">＋ 일정 넣기</button>' +
      '<button class="dot-btn small" id="copyBtn">학기 넘기기</button>'
    : '';
  $('#hint').textContent = isAdmin
    ? (all.length
        ? '격자의 빈 칸을 누르면 그 시간에 바로 넣을 수 있어요. 이미 있는 일정을 누르면 고칩니다.'
        : '아직 시간표가 비어 있어요. 격자의 빈 칸을 눌러 첫 수업부터 채워보세요.')
    : (all.length ? '' : '아직 시간표가 없어요.');

  if (isAdmin) {
    $('#addBtn').addEventListener('click', () => openSheet(null, { who, mode:'w', weekday:1, start:'09:00' }));
    $('#copyBtn').addEventListener('click', openCopy);
  }
}

function showGate(){
  const gate = $('#gate');
  gate.innerHTML = '';
  if (isLoggedIn) {
    $('#app').hidden = false;
    return true;
  }
  $('#app').hidden = true;
  gate.innerHTML =
    '<p class="why">시간표에는 아이가 몇 시에 어디 있는지가 그대로 담겨 있어요.<br>' +
    '그래서 이 쪽은 가족만 볼 수 있게 잠가 두었습니다.</p>';
  mountLoginBox(gate, reboot);
  revealNow(gate);
  return false;
}

async function reboot(){
  await refreshAuth();
  if (showGate()) await load();
}

(async () => {
  await refreshAuth();
  if (showGate()) await load();
  initReveal();
  // 오늘 카드의 '지금'과 '다음까지 몇 분'은 시간이 지나면 틀려진다. 1분마다 다시 그린다.
  setInterval(() => { if (!$('#app').hidden && all.length) renderToday(); }, 60000);
})();
