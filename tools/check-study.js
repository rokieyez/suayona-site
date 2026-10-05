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
