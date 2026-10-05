// 공부 계획 셈 점검: node tools/check-study.js — 조용히 끝나면 통과.
const assert = require('assert');
const { freeMinutes, planStudy, cushionLevel } = require('../pages/study-plan.js');

// 16~19시 중 학원 17~18시, 17:30~18:30 이 겹쳐도 한 번만 뺀다 → 180 - 90
assert.strictEqual(freeMinutes([960, 1140], [[1020, 1080], [1050, 1110]]), 90);
assert.strictEqual(freeMinutes([960, 1140], []), 180);
assert.strictEqual(freeMinutes(null, []), 0);

const days = [
  { date: '2026-10-05', free: 60 },
  { date: '2026-10-06', free: 60 },
  { date: '2026-10-07', free: 0 },
  { date: '2026-10-08', free: 60 },
];
// 수학 20쪽(쪽당 5분, 8일 마감) · 영어 6장(장당 10분, 6일 마감)
const r = planStudy(days, [
  { id: 'm', left: 20, per: 5, due: '2026-10-08' },
  { id: 'e', left: 6, per: 10, due: '2026-10-06' },
]);
const sum = id => Object.values(r.byDay).flat().filter(x => x.id === id).reduce((a, x) => a + x.units, 0);
assert.strictEqual(sum('e'), 6);                       // 마감이 이른 영어가 먼저 다 들어간다
assert.strictEqual(sum('m'), 20);
assert.ok(r.byDay['2026-10-07'].length === 0);         // 빈 시간이 없는 날엔 안 넣는다
assert.ok(r.byDay['2026-10-08'].some(x => x.id === 'm'));
Object.entries(r.byDay).forEach(([d, xs]) =>          // 하루 빈 시간을 넘기지 않는다
  assert.ok(xs.reduce((a, x) => a + x.min, 0) <= days.find(x => x.date === d).free, d));
assert.strictEqual(r.perTask.e.cushion, 60);           // 120분 중 60분 필요
assert.strictEqual(cushionLevel(r.perTask.e), 'easy');

// 모자라면 들어갈 만큼만 넣고 모자란 분을 알려 준다
const s = planStudy(days.slice(0, 1), [{ id: 'x', left: 10, per: 10, due: '2026-10-05' }]);
assert.strictEqual(s.byDay['2026-10-05'][0].units, 6);
assert.strictEqual(s.perTask.x.short, 40);
assert.strictEqual(cushionLevel(s.perTask.x), 'short');

// 마감이 지난 것은 오늘로 당긴다
const l = planStudy(days, [{ id: 'z', left: 2, per: 10, due: '2026-10-01' }]);
assert.ok(l.perTask.z.late && l.byDay['2026-10-05'][0].units === 2);

// ---------- 경험치·연속 기록·달력(study-xp.js) ----------
const { studyEvents, studyStreak, monthGrid } = require('../pages/study-xp.js');
const all = { 0: [600, 720], 1: [960, 1140], 2: [960, 1140], 3: [960, 1140], 4: [960, 1140], 5: [960, 1140], 6: [600, 720] };
const logOf = (...ds) => Object.fromEntries(ds.map(d => [d, 1]));

// 하루에 여러 번·여러 과목을 해도 공부한 날은 하루 +10
const ev = studyEvents('yona', { win: all, tasks: [
  { id: 'a', title: '수학', total: 10, per: 5, due: '2026-10-09', base: 0, log: { '2026-10-01': 3, '2026-10-02': 7 } },
  { id: 'b', title: '영어', total: 99, per: 2, due: '2026-10-30', base: 0, log: { '2026-10-02': 4, '2026-10-03': 0 } },
] });
const sdays = ev.filter(e => e.name === '공부한 날');
assert.strictEqual(sdays.length, 2);                                     // 0 인 날(10-03)은 안 센다
assert.ok(ev.every(e => e.k === 'yona' && e.stat === 'wisdom' && e.icon === '📚'));
assert.strictEqual(new Date(sdays[0].t).getHours(), 12);                 // 그날 정오
// 마감(10-09)보다 7일 앞서 끝냄 → 7 × 5 = 35 이지만 최대 15
const early = ev.find(e => e.label === '「수학」 마감 전에 끝!');
assert.ok(early && early.xp === 15);
assert.ok(!ev.some(e => /영어/.test(e.name)));                          // 덜 끝낸 것은 보너스 없음
// 하루 앞서 끝내면 5, 마감날 끝내면 없음
const one = studyEvents('sua', { win: all, tasks: [{ id: 'c', title: '독서', total: 2, per: 5, due: '2026-10-03', base: 1, log: { '2026-10-02': 1 } }] });
assert.strictEqual(one.find(e => e.label).xp, 5);
assert.ok(!studyEvents('sua', { win: all, tasks: [{ id: 'c', title: '독서', total: 1, per: 5, due: '2026-10-02', log: { '2026-10-02': 1 } }] }).some(e => e.label));

// 연속 기록: 하루 빠짐은 봐주고(불씨), 이틀 연속 빠지면 끊긴다
const xplan = log => ({ win: all, tasks: [{ id: 'x', title: 'x', total: 999, per: 1, due: '2026-12-31', log }] });
assert.deepStrictEqual(studyStreak(xplan(logOf('2026-10-03', '2026-10-04', '2026-10-05')), '2026-10-05'), { days: 3, alive: true, graceUsed: false });
// 오늘 아직 안 했으면 어제까지로 센다
assert.deepStrictEqual(studyStreak(xplan(logOf('2026-10-03', '2026-10-04')), '2026-10-05'), { days: 2, alive: true, graceUsed: false });
// 어제 빠짐 → 불씨
assert.deepStrictEqual(studyStreak(xplan(logOf('2026-10-02', '2026-10-03')), '2026-10-05'), { days: 2, alive: true, graceUsed: true });
// 하루 빠지고 이어 가면 그대로 이어진다(빠진 날은 안 센다)
assert.strictEqual(studyStreak(xplan(logOf('2026-10-01', '2026-10-03', '2026-10-04')), '2026-10-04').days, 3);
// 이틀 연속 빠지면 끊김
assert.deepStrictEqual(studyStreak(xplan(logOf('2026-10-01', '2026-10-02')), '2026-10-05'), { days: 0, alive: false, graceUsed: false });
assert.strictEqual(studyStreak(xplan(logOf('2026-10-01', '2026-10-04', '2026-10-05')), '2026-10-05').days, 2);
// 공부 시간대가 없는 요일(토 10-03·일 10-04)은 빠짐이 아니다
const noWeekend = Object.assign({}, all, { 0: null, 6: null });
assert.strictEqual(studyStreak({ win: noWeekend, tasks: xplan(logOf('2026-10-01', '2026-10-02', '2026-10-05')).tasks }, '2026-10-05').days, 3);
assert.deepStrictEqual(studyStreak(xplan({}), '2026-10-05'), { days: 0, alive: false, graceUsed: false });

// 7일 이어지면 그날 배지 +10, 30일에도 한 번 더
const run = n => logOf(...Array.from({ length: n }, (_, i) => '2026-09-' + String(i + 1).padStart(2, '0')));
const b7 = studyEvents('sua', xplan(run(8))).filter(e => /연속/.test(e.name));
assert.ok(b7.length === 1 && b7[0].xp === 10 && b7[0].label === '🔥 연속 7일 공부' && new Date(b7[0].t).getDate() === 7);
const l30 = run(30);
assert.deepStrictEqual(studyEvents('sua', xplan(l30)).filter(e => e.label).map(e => e.name), ['연속 7일 공부', '연속 30일 공부']);

// 달력: 그 달 날짜 수, 단위·분, 공부할 수 있는 날
const g = monthGrid({ win: noWeekend, tasks: [{ id: 'a', per: 5, log: { '2026-10-02': 3, '2026-11-01': 1 } }, { id: 'b', per: 2, log: { '2026-10-02': 1 } }] }, 2026, 10);
assert.strictEqual(g.length, 31);
assert.deepStrictEqual(g[1], { date: '2026-10-02', day: 2, wd: 5, units: 4, min: 17, open: true });
assert.strictEqual(g[2].open, false);                                   // 10-03 은 토요일
assert.strictEqual(g.reduce((a, x) => a + x.units, 0), 4);              // 다른 달 기록은 안 들어온다
assert.strictEqual(monthGrid(xplan({}), 2028, 2).length, 29);            // 윤년
