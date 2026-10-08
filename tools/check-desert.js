// 사막 오아시스 농장 전용 규칙 점검 — node tools/check-desert.js (2026-10-09)
// 용과·사막 장미 돌(낮에 줍기)·낙타가 물어 오는 것·요술 램프 편지·꾸미개 넷·가구 넷
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, assert = require('assert');
const at = (h, d) => new Date(2026, 6, d || 10, h, 0).getTime();
const day = at(12), night = at(22);
const world = farm => { const w = R.fixWorld(null, day); w.started = R.dayKey(at(12, 9)); w.farm = R.FARMS.findIndex(f => f.id === farm); return w; };
const rich = k => Object.assign(R.fixMine(null, k || 'sua'), { coins: 99999, xp: 999999, energy: 999 });

// 용과 — 사막에서만 사고 심는다, 다른 농장 주문·행상인에 안 섞인다
{
  const au = world('aurora'), de = world('desert'), m = rich();
  [au, de].forEach(w => { w.seasonLen = 7; w.started = R.dayKey(day - 8 * R.DAY_MS); });
  assert.strictEqual(R.calendar(de, day).season, 'summer');
  assert(!R.buy(au, m, 'seed:dragonfruit', day).ok, '오로라에서는 용과 씨앗을 못 산다');
  assert(R.buy(de, m, 'seed:dragonfruit', day).ok, '사막에서는 산다');
  const id = R.plotIds(de, 'field')[0], id2 = R.plotIds(au, 'field')[0];
  au.plots[id2] = { tilled: true }; de.plots[id] = { tilled: true };
  assert(!R.plant(au, m, id2, 'dragonfruit', day).ok, '오로라 밭에는 못 심는다');
  assert(R.plant(de, m, id, 'dragonfruit', day).ok, '사막 밭에는 심긴다');
  for (let d = 0; d < 60; d++){ const t = day + d * R.DAY_MS; assert(R.ordersOf(au, t).every(o => o.crop !== 'dragonfruit')); const pw = R.peddlerWant(au, t); assert(!pw || pw.id !== 'crop:dragonfruit'); }
}
// 사막 장미 돌 — 사막의 낮에만, 하루 넷, 밭 위에는 없다, 각자 줍는다. 오로라 빛 조각은 그대로 밤
{
  const de = world('desert'), au = world('aurora'), a = rich('sua'), b = rich('yona');
  assert.strictEqual(R.shardSpots(de, night).length, 0, '밤에는 없다');
  assert.strictEqual(R.shardSpots(au, day).length, 0, '오로라 낮에는 빛 조각이 없다');
  assert.strictEqual(R.shardSpots(au, night).length, R.SHARD_MAX, '오로라 밤 빛 조각은 그대로');
  const S = R.shardSpots(de, day);
  assert.strictEqual(S.length, R.SHARD_MAX);
  S.forEach(q => assert(!R.fieldHas(de, q.x, q.y), '밭 위에 놓이지 않는다'));
  assert(!R.pickShard(de, a, S[0].i, night).ok, '밤에는 못 줍는다');
  assert(R.pickShard(de, a, S[0].i, day).ok && a.inv.sandrose === 1 && !a.inv.shard, '사막 장미 돌을 줍는다');
  assert(!R.pickShard(de, a, S[0].i, day).ok, '같은 돌은 한 번');
  assert(R.pickShard(de, b, S[0].i, day).ok, '자매는 제 몫');
  assert(R.sellPrice('sandrose', de, day) > 100, '비싸게 팔린다');
}
// 낙타 — 젖을 주다가 가끔 대추야자·사막 장미 돌
{
  const de = world('desert'), got = {};
  for (let d = 0; d < 60; d++){
    const t = day + d * R.DAY_MS, prev = R.dayKey(t - R.DAY_MS);
    de.animals = [{ id: 'c1', kind: 'camel', name: '낙타', love: 0, pet: [], since: 0, fedDay: prev }];
    R.animalDay(de, t); const it = de.animals[0].ready; got[it] = (got[it] || 0) + 1;
  }
  assert(got.milk && (got.date || got.sandrose), '젖도, 대추야자·장미 돌도: ' + JSON.stringify(got));
  assert(Object.keys(got).every(k => ['milk', 'date', 'sandrose'].indexOf(k) >= 0));
  assert(R.itemName('date') === '대추야자');
}
// 요술 램프 — 놓여 있으면 며칠에 한 번 램프 요정 편지, 하루 한 번, 사막에서만
{
  const de = world('desert'), m = rich(); let n = 0;
  for (let d = 0; d < 30; d++){ de.dayKey = null; R.newDay(de, m, day + d * R.DAY_MS); }
  assert.strictEqual(de.mail.sua.length, 0, '램프가 없으면 편지도 없다');
  de.decor.genielamp = { by: 'sua' };
  for (let d = 0; d < 30; d++){ const t = day + d * R.DAY_MS, before = de.mail.sua.length; R.newDay(de, m, t); R.newDay(de, m, t); const add = de.mail.sua.length - before; assert(add <= 1); n += add; }
  assert(n >= 4 && n <= 20, '서른 날에 ' + n + '통');
  assert(de.mail.sua.every(g => g.from === 'genie') && de.mail.yona.length === de.mail.sua.length);
  const au = world('aurora'); au.decor.genielamp = { by: 'sua' };
  for (let d = 0; d < 30; d++) R.newDay(au, m, day + d * R.DAY_MS);
  assert(au.mail.sua.every(g => g.from !== 'genie'), '사막이 아니면 안 온다');
}
// 꾸미개 넷·가구 넷 — 사막에서만 산다
{
  const de = world('desert'), au = world('aurora'), m = rich();
  ['berber', 'zellige', 'genielamp', 'telescope'].forEach(d => { assert(!R.buy(au, m, 'deco:' + d, day).ok); assert(R.buy(de, m, 'deco:' + d, day).ok, d); });
  ['teaset', 'kilim', 'pouf', 'mlamp'].forEach(f => { assert(!R.buy(au, m, 'f:' + f, day).ok); assert(R.buy(de, m, 'f:' + f, day).ok, f); });
}
console.log('사막 오아시스 규칙 점검 통과');
