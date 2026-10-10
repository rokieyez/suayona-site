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

// 하루 빈 시간보다 긴 단위는 그날 못 넣는다: 빈 시간 [10분, 50분]에 20분짜리 셋
// (분만 더하면 60분이라 셋이 다 들어가는 것처럼 보였고, 첫날 10분에 20분이 들어갔다)
const two = [{ date: '2026-10-05', free: 10 }, { date: '2026-10-06', free: 50 }];
const u = planStudy(two, [{ id: 'u', left: 3, per: 20, due: '2026-10-06' }]);
assert.deepStrictEqual(u.byDay, { '2026-10-05': [], '2026-10-06': [{ id: 'u', units: 2, min: 40 }] });
assert.deepStrictEqual(u.perTask.u, { need: 60, room: 40, cushion: -20, short: 20, late: false });
assert.strictEqual(cushionLevel(u.perTask.u), 'short');
// 자투리가 뒤쪽에 몰려 있어도 들어갈 수 있는 만큼은 다 넣는다
const tail = [60, 15, 15, 15, 15].map((free, i) => ({ date: '2026-10-0' + (5 + i), free }));
assert.strictEqual(planStudy(tail, [{ id: 'v', left: 3, per: 20, due: '2026-10-09' }]).byDay['2026-10-05'][0].units, 3);
// 아무 값이나 넣어도: 하루 빈 시간을 안 넘기고, 넣은 수 + 모자란 수 = 남은 수
let seed = 7;
const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
for (let c = 0; c < 300; c++) {
  const ds = Array.from({ length: 1 + rnd(6) }, (_, i) => ({ date: '2026-11-0' + (i + 1), free: rnd(8) * 15 + rnd(2) * 10 }));
  const ts = Array.from({ length: 1 + rnd(4) }, (_, i) => ({ id: 't' + i, left: rnd(9), per: 1 + rnd(40), due: '2026-11-0' + (1 + rnd(7)) }));
  const q = planStudy(ds, ts);
  ds.forEach(d => assert.ok(q.byDay[d.date].reduce((a, x) => a + x.min, 0) <= d.free, 'case ' + c + ' ' + d.date));
  ts.forEach(t => {
    const put = Object.values(q.byDay).flat().filter(x => x.id === t.id).reduce((a, x) => a + x.units, 0);
    assert.strictEqual(put * t.per + q.perTask[t.id].short, t.left * t.per, 'case ' + c + ' ' + t.id);
    assert.strictEqual(q.perTask[t.id].cushion < 0, q.perTask[t.id].short > 0, 'case ' + c + ' ' + t.id);
  });
}

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

// ---------- 저장(study.js) — 막 읽은 서버 줄에 바꾼 것만 얹는가 ----------
// study.js 는 화면에 묶여 있어 통째로 못 부른다. 저장 대목만 글자로 떼어 가짜 서버(sb)에 물려 돌린다.
(async () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../pages/study.js'), 'utf8');
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, '대목을 못 찾음: ' + a); return src.slice(i, j); };
  const copy = x => JSON.parse(JSON.stringify(x));
  let row = { data: { win: { 1: [960, 1410] }, tasks: [{ id: 'a', title: '수학', total: 10, per: 5, base: 0, log: {} }], free: { '2026-10-09': 60 }, stamps: {} } };
  let readErr = null;
  const sb = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => (readErr ? { data: null, error: readErr } : { data: row && copy(row), error: null }) }) }),
    upsert: async r => { row = { data: copy(r.data) }; return { error: null }; },
  }) };
  const S = new Function('sb', 'DEFAULT_WIN', 'readableError', 'localOnly', 'who', 'plan',
    cut('function fixPlan', '/* 막 읽은') + cut('let planQ', '// 👍 부모 도장') +
    '; return { fixPlan, savePlan, as: p => { plan = p; } };')(sb, {}, e => e.message, false, 'yona', null);

  // 부모 탭이 저녁에 읽어 둔 계획 → 그 뒤 아이가 다른 기기에서 「했어요」 3, 부모가 도장
  const stale = S.fixPlan(copy(row.data)); S.as(stale);
  row.data.tasks[0].log['2026-10-09'] = 3; row.data.stamps['2026-10-09'] = { at: 1 };
  // 자정: 열려 있던 탭이 빈 분만 다시 적는다
  const free = { '2026-10-10': 45 }; stale.free = free;
  assert.strictEqual(await S.savePlan(d => { d.free = free; }), null);
  assert.strictEqual(row.data.tasks[0].log['2026-10-09'], 3);            // 아이 기록이 남는다
  assert.ok(row.data.stamps['2026-10-09']);                              // 도장도
  assert.deepStrictEqual(row.data.free, free);
  assert.strictEqual(stale.tasks[0].log['2026-10-09'], 3);               // 메모리도 합친 결과로
  // 연달아 부른 저장은 차례대로 — 둘 다 남는다
  const a = S.savePlan(d => { d.tasks[0].log['2026-10-10'] = 2; }), b = S.savePlan(d => { d.win = { 2: [600, 720] }; });
  await a; await b;
  assert.strictEqual(row.data.tasks[0].log['2026-10-10'], 2);
  assert.deepStrictEqual(row.data.win, { 2: [600, 720] });
  // 못 읽었으면 쓰지 않는다
  const before = copy(row); readErr = { message: '끊김' };
  assert.strictEqual(await S.savePlan(d => { d.tasks = []; }), '끊김');
  assert.deepStrictEqual(row, before);
  // 줄이 아직 없으면 메모리 것을 통째로
  readErr = null; row = null;
  assert.strictEqual(await S.savePlan(() => { throw new Error('첫 저장에는 얹을 것이 없다'); }), null);
  assert.strictEqual(row.data.tasks[0].log['2026-10-10'], 2);
})().catch(e => { console.error(e); process.exit(1); });
