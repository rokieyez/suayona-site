// 오로라 농장 전용 규칙 점검 — node tools/check-aurora.js (2026-10-09)
// 클라우드베리·얼음낚시·빛 조각·순록이 물어 오는 것·산타 편지
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, assert = require('assert');
const at = (h, d) => new Date(2026, 6, d || 10, h, 0).getTime();     // 7월(여름 날씨와 상관없이 시각만 쓴다)
const day = at(12), night = at(22);
const world = farm => { const w = R.fixWorld(null, day); w.started = R.dayKey(at(12, 9)); w.farm = R.FARMS.findIndex(f => f.id === farm); return w; };
const rich = k => Object.assign(R.fixMine(null, k || 'sua'), { coins: 99999, xp: 999999, energy: 999 });

// 클라우드베리 — 오로라에서만 사고 심는다
{
  const sea = world('seaside'), au = world('aurora'), m = rich();
  au.seasonLen = 7; sea.seasonLen = 7;
  // 여름이 되도록 시작일을 당긴다
  [sea, au].forEach(w => { w.started = R.dayKey(day - 8 * R.DAY_MS); });
  assert.strictEqual(R.calendar(au, day).season, 'summer');
  assert(!R.buy(sea, m, 'seed:cloudberry', day).ok, '바닷가에서는 클라우드베리 씨앗을 못 산다');
  assert(R.buy(au, m, 'seed:cloudberry', day).ok, '오로라에서는 산다');
  const id = R.plotIds(au, 'field')[0], id2 = R.plotIds(sea, 'field')[0];
  sea.plots[id2] = { tilled: true }; au.plots[id] = { tilled: true };
  assert(!R.plant(sea, m, id2, 'cloudberry', day).ok, '바닷가 밭에는 못 심는다');
  assert(R.plant(au, m, id, 'cloudberry', day).ok, '오로라 밭에는 심긴다');
  // 다른 농장의 주문·행상인·원정 씨앗에는 안 나온다
  for (let d = 0; d < 60; d++){
    const t = day + d * R.DAY_MS;
    assert(R.ordersOf(sea, t).every(o => o.crop !== 'cloudberry'));
    const pw = R.peddlerWant(sea, t); assert(!pw || ['crop:cloudberry', 'fish:char', 'fish:cod'].indexOf(pw.id) < 0);
  }
  // 훈장 문턱은 농장 전용 작물을 세지 않는다
  const all = R.CROP_IDS.filter(c => c !== 'cloudberry');
  const mm = R.fixMine(null, 'sua'); mm.dex = all.slice();
  assert(R.medalState(sea, mm).find(x => x.id === 'master').ready, '클라우드베리 없이도 온 밭 도감');
}
// 얼음낚시 — 오로라에 얼음낚시 구멍이 있을 때만, 얼음 물고기만
{
  const au = world('aurora'), m = rich();
  assert(!R.fish(au, m, day, 'good', 'ice').ok, '구멍이 없으면 얼음낚시는 없다');
  au.decor.icefish = { by: 'sua' };
  for (let i = 0; i < 5; i++) assert(R.fish(au, m, day, i % 2 ? 'perfect' : 'good', 'ice').ok);
  const caught = Object.keys(m.inv).filter(k => k.indexOf('fish:') === 0);
  assert(caught.length && caught.every(k => R.FISH[k.slice(5)].ice), '얼음 물고기만 문다');
  const sea = world('seaside'), m2 = rich(); sea.decor.icefish = { by: 'sua' };
  assert(!R.fish(sea, m2, day, 'good', 'ice').ok, '오로라가 아니면 얼음낚시는 없다');
  // 연못에서는 얼음 물고기가 안 문다
  const p = world('aurora'), m3 = rich(); p.decor.pond = { by: 'sua' };
  for (let i = 0; i < 5; i++) R.fish(p, m3, day + i * R.DAY_MS, 'perfect');
  assert(Object.keys(m3.inv).every(k => !R.FISH[k.slice(5)] || !R.FISH[k.slice(5)].ice), '연못엔 얼음 물고기 없음');
}
// 빛 조각 — 오로라의 밤에만, 하루 몇 개, 밭·물건 위에는 없다, 각자 줍는다
{
  const au = world('aurora'), sea = world('seaside'), a = rich('sua'), b = rich('yona');
  assert.strictEqual(R.shardSpots(au, day).length, 0, '낮에는 없다');
  assert.strictEqual(R.shardSpots(sea, night).length, 0, '오로라가 아니면 없다');
  const S = R.shardSpots(au, night);
  assert.strictEqual(S.length, R.shardMax(au));   // 오로라 능력 「긴 밤」 — 여덟
  S.forEach(q => assert(!R.fieldHas(au, q.x, q.y), '밭 위에 떨어지지 않는다'));
  assert(!R.pickShard(au, a, S[0].i, day).ok, '낮에는 못 줍는다');
  assert(R.pickShard(au, a, S[0].i, night).ok && a.inv.shard === 1);
  assert(!R.pickShard(au, a, S[0].i, night).ok, '같은 조각은 한 번');
  assert(R.pickShard(au, b, S[0].i, night).ok, '자매는 제 몫을 줍는다');
  assert.strictEqual(R.shardsLeft(au, a, night).length, R.shardMax(au) - 1);
  assert.strictEqual(R.shardsLeft(au, null, night).length, R.shardMax(au), '손님은 다 본다');
  assert(R.sellPrice('shard', au, night) > 100, '빛 조각은 비싸게 팔린다');
  assert.deepStrictEqual(R.shardSpots(au, night), S, '같은 날은 같은 자리');
}
// 순록 — 우유를 주다가 가끔 이끼·솔방울을 물어 온다
{
  const au = world('aurora'), got = {};
  for (let d = 0; d < 60; d++){
    const t = day + d * R.DAY_MS, prev = R.dayKey(t - R.DAY_MS);
    au.animals = [{ id: 'r1', kind: 'reindeer', name: '순록', love: 0, pet: [], since: 0, fedDay: prev }];
    R.animalDay(au, t);
    const it = au.animals[0].ready; got[it] = (got[it] || 0) + 1;
  }
  assert(got.milk && (got.moss || got.pinecone), '우유도, 이끼·솔방울도 나온다: ' + JSON.stringify(got));
  assert(Object.keys(got).every(k => ['milk', 'moss', 'pinecone'].indexOf(k) >= 0));
  assert(R.itemName('moss') !== 'moss' && R.itemName('pinecone') !== 'pinecone', '새 아이템 이름');
}
// 산타 우체통 — 놓여 있으면 며칠에 한 번 편지와 선물이 둘에게, 하루 한 번만
{
  const au = world('aurora'), m = rich();
  let n = 0;
  for (let d = 0; d < 30; d++){ au.dayKey = null; R.newDay(au, m, day + d * R.DAY_MS); }
  assert.strictEqual(au.mail.sua.length, 0, '우체통이 없으면 편지도 없다');
  au.decor.santapost = { by: 'sua' };
  for (let d = 0; d < 30; d++){
    const t = day + d * R.DAY_MS, before = au.mail.sua.length;
    R.newDay(au, m, t); R.newDay(au, m, t);                       // 같은 날 두 번 열어도 한 통
    const add = au.mail.sua.length - before;
    assert(add <= 1); n += add;
  }
  assert(n >= 4 && n <= 20, '서른 날에 ' + n + '통');
  assert(au.mail.sua.every(g => g.from === 'santa') && au.mail.yona.length === au.mail.sua.length, '둘 다 받는다');
  const sea = world('seaside'); sea.decor.santapost = { by: 'sua' };
  for (let d = 0; d < 30; d++) R.newDay(sea, m, day + d * R.DAY_MS);
  assert.strictEqual(sea.mail.sua.length, 0, '오로라가 아니면 안 온다');
}
// 꾸미개 넷·가구 넷 — 오로라에서만 산다
{
  const au = world('aurora'), sea = world('seaside'), m = rich();
  ['sauna', 'lavvu', 'icesculpt', 'santapost'].forEach(d => { assert(!R.buy(sea, m, 'deco:' + d, day).ok); assert(R.buy(au, m, 'deco:' + d, day).ok, d); });
  ['woodstove', 'furrug', 'rockchair', 'advent'].forEach(f => { assert(!R.buy(sea, m, 'f:' + f, day).ok); assert(R.buy(au, m, 'f:' + f, day).ok, f); });
  assert.strictEqual(R.FURNITURE.rocker.name, '흔들목마', '옛 흔들목마는 그대로');
}
console.log('오로라 규칙 점검 통과');
