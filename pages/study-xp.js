// 공부 기록(study_plans.data)을 인생 퀘스트의 경험치·연속 기록·달력으로 바꾸는 셈만 둔 파일.
// 화면(study.js)·인생 퀘스트(life.js)·점검(tools/check-study.js)이 같이 쓴다. study-plan.js 뒤에 싣는다.
//
// 규칙
//  · 공부한 날(어느 할 일이라도 log > 0) 하루에 지혜 +10 — 분량이 아니라 날 수. 꾸준함이 이긴다.
//  · 마감 보너스: 다 끝낸 날이 마감보다 앞서면 앞선 날 × 5, 최대 15.
//  · 연속 기록: 공부 시간대가 없는 요일(win[요일] 이 null)은 빠짐으로 치지 않는다.
//    하루 빠짐은 봐준다(「불씨」) — 이틀 연속 빠지면 끊긴다. 7일·30일에 닿으면 배지 +10.

// node(점검)에서는 study-plan.js 의 studyIso 를 빌려 온다. 브라우저에서는 이미 전역에 있다.
if (typeof studyIso === 'undefined' && typeof module !== 'undefined') globalThis.studyIso = require('./study-plan.js').studyIso;

const STUDY_XP = { day: 10, early: 5, earlyMax: 15, streak: 10 };
const STUDY_BADGES = [7, 30];

// 'YYYY-MM-DD' → 그날 정오(로컬). 정오라 하루 경계에서 어긋나지 않는다.
const sxNoon = iso => { const p = iso.split('-'); return new Date(+p[0], p[1] - 1, +p[2], 12); };
const sxNext = (iso, n) => { const d = sxNoon(iso); d.setDate(d.getDate() + n); return studyIso(d); };

// 날짜별 공부한 단위·분 — { 'YYYY-MM-DD': { units, min } } (0 인 날은 없다)
function sxByDay(data){
  const out = {};
  ((data && data.tasks) || []).forEach(t => Object.entries(t.log || {}).forEach(([d, n]) => {
    if (!(n > 0)) return;
    const o = out[d] = out[d] || { units: 0, min: 0 };
    o.units += n; o.min += n * (t.per || 0);
  }));
  return out;
}

// 그 요일에 공부 시간대가 있는가(없으면 쉬는 날 — 빠짐으로 안 친다). win 이 없으면 날마다 공부하는 날.
const sxOpen = (data, iso) => {
  if (!data || !data.win) return true;
  const w = data.win[sxNoon(iso).getDay()];
  return !!(w && w[1] > w[0]);
};

// 첫 공부한 날부터 end 까지 하루씩 걸으며 연속 기록을 센다. onDay(iso, days) 는 공부한 날마다 불린다.
// 돌려주는 것: { days, miss } — miss 는 마지막 공부 뒤로 이어진 빠진 날 수
function sxWalk(data, by, end, onDay){
  const first = Object.keys(by).sort()[0];
  let days = 0, miss = 0;
  if (!first) return { days, miss };
  for (let d = first; d <= end; d = sxNext(d, 1)) {
    if (by[d]) { days++; miss = 0; if (onDay) onDay(d, days); }
    else if (sxOpen(data, d)) { miss++; if (miss >= 2) days = 0; }
  }
  return { days, miss };
}

// 오늘(아직 안 했으면 어제)까지 이어진 공부한 날 수.
// graceUsed: 하루 빠져서 불씨만 남은 상태(오늘 하면 다시 이어진다)
function studyStreak(data, today){
  const by = sxByDay(data);
  // 오늘 아직 안 했으면 오늘은 빠짐으로 치지 않는다
  const r = sxWalk(data, by, by[today] ? today : sxNext(today, -1));
  const alive = r.days > 0 && r.miss < 2;
  return { days: alive ? r.days : 0, alive, graceUsed: alive && r.miss === 1 };
}

// life.js 의 events 모양 그대로: { k, t(ms), stat, xp, icon, name, label }
function studyEvents(k, data){
  const by = sxByDay(data), out = [];
  const ev = (iso, xp, name, label) => out.push({ k, t: sxNoon(iso).getTime(), stat: 'wisdom', xp, icon: '📚', name, label: label || '' });

  Object.keys(by).sort().forEach(d => ev(d, STUDY_XP.day, '공부한 날'));

  ((data && data.tasks) || []).forEach(t => {
    const log = Object.keys(t.log || {}).filter(d => t.log[d] > 0).sort();
    const sum = Object.values(t.log || {}).reduce((a, n) => a + (n > 0 ? n : 0), 0);
    if (!log.length || (t.base || 0) + sum < t.total || !t.due) return;
    const end = log[log.length - 1];
    const early = Math.round((sxNoon(t.due) - sxNoon(end)) / 86400000);
    if (early <= 0) return;
    const name = '「' + t.title + '」 마감 전에 끝!';
    ev(end, Math.min(STUDY_XP.earlyMax, early * STUDY_XP.early), name, name);
  });

  // 연속 기록 배지 — 새로 이어 간 기록이 다시 7일에 닿으면 또 준다
  const last = Object.keys(by).sort().pop();
  if (last) sxWalk(data, by, last, (d, days) => {
    if (STUDY_BADGES.includes(days)) ev(d, STUDY_XP.streak, '연속 ' + days + '일 공부', '🔥 연속 ' + days + '일 공부');
  });
  return out.sort((a, b) => a.t - b.t);
}

// 그 달(month 는 1~12) 날짜별 공부. [{ date, day, wd, units, min, open }] — open 은 공부 시간대가 있는 날
function monthGrid(data, year, month){
  const by = sxByDay(data), out = [];
  const n = new Date(year, month, 0).getDate();
  for (let i = 1; i <= n; i++) {
    const date = studyIso(new Date(year, month - 1, i, 12)), o = by[date] || { units: 0, min: 0 };
    out.push({ date, day: i, wd: new Date(year, month - 1, i).getDay(), units: o.units, min: o.min, open: sxOpen(data, date) });
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { studyEvents, studyStreak, monthGrid, STUDY_XP };
