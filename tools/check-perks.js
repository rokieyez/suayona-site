// 이사 갈 까닭 점검 — node tools/check-perks.js (2026-10-09 로키즈 「전부 진행」)
// 농장 능력·농장끼리 장사·그림엽서·손님 부탁·옛 농장 선물·농장 도감 훈장
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, assert = require('assert');
const at = (h, d) => new Date(2026, 6, d || 10, h, 0).getTime();
const day = at(12), night = at(22);
const idx = id => R.FARMS.findIndex(f => f.id === id);
const world = farm => { const w = R.fixWorld(null, day); w.started = R.dayKey(at(12, 9)); w.farm = idx(farm); return w; };
const rich = k => Object.assign(R.fixMine(null, k || 'sua'), { coins: 99999, xp: 999999, energy: 999 });

// 농장끼리 장사 — 다른 농장 특산물은 1.5배, 제 농장에서는 그대로
{
  const au = world('aurora'), de = world('desert');
  assert.strictEqual(R.sellPrice('sandrose', au, day), 225, '사막 장미 돌은 오로라에서 1.5배');
  assert.strictEqual(R.sellPrice('sandrose', de, day), 150, '사막에서는 제값');
  assert.strictEqual(R.sellPrice('shard', de, day), 225, '빛 조각은 사막에서 1.5배');
  assert.strictEqual(R.sellPrice('egg', de, day), R.sellPrice('egg', au, day), '흔한 물건은 어디서나 같다');
}
// 농장 능력 — 바닷가 물고기·꽃구름 요리 1.25배, 오로라 빛 조각 두 배, 오아시스 물 30시간
{
  const sea = world('seaside'), cl = world('cloud'), au = world('aurora'), de = world('desert'), me = world('meadow');
  assert.strictEqual(R.sellPrice('fish:minnow', sea, day), Math.round(R.sellPrice('fish:minnow', me, day) * 1.25));
  const dish = Object.keys(R.DISHES)[0];
  assert.strictEqual(R.sellPrice('dish:' + dish, cl, day), Math.round(R.DISHES[dish].sell * 1.25));
  assert.strictEqual(R.shardMax(au), 8, '오로라는 밤마다 여덟 조각');
  assert.strictEqual(R.shardsLeft(au, null, night).length > 4, true, '실제로 다섯 개 넘게 떨어진다');
  assert.strictEqual(R.shardMax(de), 4, '사막 장미 돌은 그대로 넷');
  const m = rich(), id = R.plotIds(de, 'field')[0];
  de.plots[id] = { tilled: true };
  assert(R.water(de, m, id, day).ok);
  assert.strictEqual(de.plots[id].wet - day, 30 * R.H, '오아시스는 30시간 촉촉');
  const m2 = rich(), id2 = R.plotIds(au, 'field')[0];
  au.plots[id2] = { tilled: true }; R.water(au, m2, id2, day);
  assert.strictEqual(au.plots[id2].wet - day, R.WATER_HOURS * R.H, '다른 농장은 그대로');
}
// 그림엽서 — 이사 조건을 절반 넘게 채우면 다음 농장에서 한 번
{
  const au = world('aurora'), m = rich();
  R.newDay(au, m, day);
  assert(!(au.mail.sua || []).some(g => g.from === 'postcard'), '빈 농장에는 아직 안 온다');
  Object.keys(R.DECOR).filter(d => !R.DECOR[d].farm || R.DECOR[d].farm === 'aurora').forEach(d => { au.decor[d] = { by: 'sua' }; });
  ['sua', 'yona', 'living'].forEach(r => { au.house[r] = {}; for (let i = 0; i < 20; i++) au.house[r]['x' + i] = { id: 'bed1' }; });
  const notes = R.newDay(au, m, at(12, 11));
  const pc = (au.mail.sua || []).filter(g => g.from === 'postcard');
  assert.strictEqual(pc.length, 1, '엽서 한 통');
  assert(/단풍/.test(pc[0].note) && /풍년/.test(pc[0].note) && /크랜베리/.test(pc[0].note), '다음 농장·능력·특산물이 적힌다(오로라 다음은 단풍, 2026-10-09)');
  assert(notes.some(n => /그림엽서/.test(n)));
  R.newDay(au, m, at(12, 12));
  assert.strictEqual((au.mail.sua || []).filter(g => g.from === 'postcard').length, 1, '두 번 안 온다');
}
// 손님 부탁 — 사흘마다 새로, 한 명이 건네면 끝
{
  const de = world('desert'), a = rich('sua'), b = rich('yona'), q = R.questOf(de, day);
  assert(q && q.name === '대상 상인 하산' && q.n > 0 && q.gift && R.FURNITURE[q.gift.slice(2)].farm === 'desert');
  assert(!R.giveQuest(de, a, day).ok, '없으면 못 건넨다');
  a.inv[q.id] = q.n;
  const c0 = a.coins, r = R.giveQuest(de, a, day);
  assert(r.ok, r.msg);
  assert.strictEqual(a.coins - c0, q.coins); assert.strictEqual(a.inv[q.gift], 1);
  b.inv[q.id] = q.n;
  assert(!R.giveQuest(de, b, day).ok, '자매가 또 건넬 수는 없다');
  assert(!R.questOf(de, at(12, 13)).done, '사흘 뒤엔 새 부탁');
  assert.strictEqual(R.questOf(world('meadow'), day), null, '들판엔 손님이 없다');
}
// 옛 농장 선물 — 하루 한 번, 떠나온 농장만
{
  const de = world('desert'), m = rich();
  de.past = [{ farm: 'meadow' }, { farm: 'aurora' }];
  assert(!R.pastGift(de, m, 'seaside', day).ok, '안 살아 본 농장');
  const r = R.pastGift(de, m, 'aurora', day);
  assert(r.ok, r.msg);
  assert(R.SPECIALS.aurora.some(i => m.inv[i] > 0), '오로라 특산물을 받는다');
  assert(!R.pastGift(de, m, 'meadow', day).ok, '하루 한 번');
  const c0 = m.coins; assert(R.pastGift(de, m, 'meadow', at(12, 11)).ok); assert(m.coins > c0, '특산물 없는 농장은 동전');
}
// 농장 도감 훈장 — 특산물을 다 모으면
{
  const de = world('desert'), m = rich();
  const st = () => R.medalState(de, m).find(x => x.id === 'dexDesert');
  assert(!st().ready);
  m.dex.push('dragonfruit', 'date', 'sandrose');
  assert(st().ready);
  assert(R.claimMedal(de, m, 'dexDesert', day).ok); assert.strictEqual(m.inv['f:mlamp'], 1);
}
console.log('이사 갈 까닭 점검 통과');
