// 메인 목표 「수아연아의 방주」 점검 — node tools/check-ark.js (2026-10-09)
// 사막 → 방주 농장 이사 · 씨앗 금고 · 짝꿍 · 방주 10단계 · 양식 창고 · 입장(둘 다) · 대홍수 열두 달 · 무지개 농장 · 새 땅 짓기 · 훈장
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, assert = require('assert');
const day0 = new Date(2026, 9, 10, 12, 0).getTime(), D = R.DAY_MS;
const rich = k => Object.assign(R.fixMine(null, k), { coins: 999999, xp: 9999999, energy: 999 });
const fresh = id => { const w = R.fixWorld(null, day0); w.started = R.dayKey(day0); w.farm = R.FARMS.findIndex(f => f.id === id); return w; };
const sua = rich('sua'), yona = rich('yona');

// 농장 차례 — 사막 다음은 방주 농장, 방주 농장에서는 이사가 아니라 대홍수로 무지개 농장에 간다
{
  const ia = R.FARMS.findIndex(f => f.id === 'ark'), inl = R.FARMS.findIndex(f => f.id === 'newland');
  assert(ia > 0 && inl === ia + 1, '방주 농장 다음이 무지개 농장');
  const wa = fresh('ark');
  assert(!R.moveState(wa, sua).next, '방주 농장에서는 이사로 못 간다');
  assert(R.gridOf(wa).w * R.gridOf(wa).h >= 2 * 28 * 20, '방주 농장은 훨씬 넓다');
  assert(R.thingHere(wa, 'ark') && !R.thingHere(fresh('desert'), 'ark'), '방주 터는 방주 농장에만');
}
// 사막 → 방주 농장 이사(조건을 채우면). 방주 도장
{
  const wd = fresh('desert'), ms = rich('sua'), my = rich('yona');
  Object.keys(R.DECOR).forEach(d => { if (!R.DECOR[d].farm || R.DECOR[d].farm === 'desert') wd.decor[d] = { by: 'sua' }; });
  const need = R.FARMS.find(f => f.id === 'ark');
  ['sua', 'yona', 'living'].forEach(r => { wd.house[r] = {}; for (let i = 0; i < need.room; i++) wd.house[r][i + ',0'] = { f: 'bed1', r: 0 }; });
  for (let i = 0; i < need.animals; i++) wd.animals.push({ id: 'z' + i, kind: 'duck', name: '오리' });
  assert(!R.moveState(wd, ms).ready, '사막에서만 얻는 낙타·용과 씨앗·특산물이 없으면 못 떠난다');
  // 그 농장에서만 얻는 것(2026-10-09 「이주 조건」) — 낙타 한 마리, 용과 씨앗은 금고에, 대추야자·사막 장미 돌
  wd.animals.push({ id: 'cm', kind: 'camel', name: '낙타' }); ms.inv['seed:dragonfruit'] = 1; assert(R.arkSeed(wd, ms, 'dragonfruit', day0).ok);
  ms.inv.date = 1; ms.inv.sandrose = 1; R.noteDex(wd, my, 'date', day0); R.noteDex(wd, my, 'sandrose', day0);
  assert(R.moveState(wd, ms).ready, '연아가 만난 특산물도 둘이 같이 센다');
  assert(R.askMove(wd, ms, day0).ok && R.askMove(wd, my, day0).moved, '사막 → 방주 농장');
  assert.strictEqual(R.farmOf(wd).id, 'ark');
  assert(R.claimMedal(wd, ms, 'stampArk', day0).ok, '방주 도장');
}
// 씨앗 금고 — 어느 농장에서나 한 알씩, 같은 것은 한 번
{
  const w = fresh('aurora'), m = rich('sua');
  m.inv['seed:cloudberry'] = 2;
  assert(R.arkSeed(w, m, 'cloudberry', day0).ok, '오로라에서 클라우드베리를 금고에');
  assert(!R.arkSeed(w, m, 'cloudberry', day0).ok, '같은 씨앗은 한 번');
  assert(!R.arkSeed(w, m, 'pea', day0).ok, '가방에 없으면 못 넣는다');
  assert.strictEqual(m.inv['seed:cloudberry'], 1);
  const w2 = R.fixWorld(JSON.parse(JSON.stringify(w)), day0);
  assert.deepStrictEqual(w2.ark.seeds, ['cloudberry'], '저장 뒤에도');
}
// 짝꿍 — 방주 농장에서는 혼자인 동물에게 짝이 스스로 찾아온다. 우리는 두 배
{
  const w = fresh('ark'), m = rich('sua');
  w.buildings.barn = { done: true }; w.buildings.pasture = { done: true }; w.buildings.coop = { done: true };
  w.animals.push({ id: 'g1', kind: 'goat', name: '염소', by: 'sua' }, { id: 'c1', kind: 'camel', name: '낙타', by: 'yona' });
  let came = 0;
  for (let d = 0; d < 20; d++){ w.dayKey = null; const n = R.newDay(w, m, day0 + d * D); if (n.some(x => /짝꿍/.test(x))) came++; }
  assert(came >= 2 && R.arkPairsHave(w) === 2, '염소·낙타 짝꿍이 왔다 (' + came + ')');
  for (let d = 0; d < 10; d++) R.newDay(w, m, day0 + (30 + d) * D);
  assert.strictEqual(w.animals.length, 4, '한 쌍이 되면 더 안 온다');
  for (let i = 0; i < 11; i++) w.animals.push({ id: 'h' + i, kind: 'chicken', name: '닭' });
  for (let i = 0; i < 6; i++) w.animals.push({ id: 'i' + i, kind: 'chicken', name: '닭' });
  assert(R.buy(w, m, 'animal:chicken', day0).ok, '방주 농장 닭장은 열여덟 마리까지(세 배)');
  assert(!R.buy(w, m, 'animal:chicken', day0).ok, '열아홉째는 꽉 참');
  const wd = fresh('desert'); wd.animals.push({ id: 'g1', kind: 'goat', name: '염소' });
  for (let d = 0; d < 20; d++){ wd.dayKey = null; R.newDay(wd, m, day0 + d * D); }
  assert.strictEqual(wd.animals.length, 1, '사막에서는 짝꿍이 안 온다');
}
// 방주 열 단계 — 각자 제 몫, 둘 다 내야 올라간다. 마지막은 양식 창고가 차야
const wa = fresh('ark');
{
  const ms = rich('sua'), my = rich('yona');
  [ms, my].forEach(m => { m.inv.wood = 999; m.inv.stone = 999; m.inv.pitch = 99; });
  assert(!R.arkPay(fresh('desert'), ms, day0).ok, '방주는 방주 농장에서');
  assert(R.arkPay(wa, ms, day0).ok && R.arkStep(wa) === 0, '혼자 내면 안 올라간다');
  assert(!R.arkPay(wa, ms, day0).ok, '두 번은 못 낸다');
  const r = R.arkPay(wa, my, day0);
  assert(r.ok && r.built && R.arkStep(wa) === 1, '둘 다 내면 1단계');
  for (let s = 1; s < 9; s++){ assert(R.arkPay(wa, ms, day0).ok && R.arkPay(wa, my, day0).built, (s + 1) + '단계'); }
  assert.strictEqual(R.arkStep(wa), 9);
  assert(!R.arkPay(wa, ms, day0).ok, '양식이 모자라면 마지막 단계를 못 한다');
  // 양식 창고 — 먹을 것만, 점수는 foodOf + 동물이 낳은 것
  ms.inv['crop:potato'] = 10; ms.inv['dish:pie'] = 5; ms.inv.egg = 10; ms.inv.wood = 10; ms.inv['crop:tulip'] = 3;
  assert(!R.arkStore(wa, ms, 'wood', 5, day0).ok && !R.arkStore(wa, ms, 'crop:tulip', 1, day0).ok, '나무·꽃은 양식이 아니다');
  assert(R.arkStore(wa, ms, 'crop:potato', 10, day0).ok && wa.ark.food === 30, '감자 열 개 = 30');
  assert(R.arkStore(wa, ms, 'dish:pie', 5, day0).ok && R.arkStore(wa, ms, 'egg', 10, day0).ok);
  assert.strictEqual(wa.ark.food, 30 + 5 * R.DISHES.pie.food + 20);
  assert(!R.arkStore(fresh('desert'), ms, 'egg', 1, day0).ok, '창고는 방주 농장에');
  wa.ark.food = R.ARK_FOOD_MIN + 300;
  assert(R.arkPay(wa, ms, day0).ok && R.arkPay(wa, my, day0).built && R.arkStep(wa) === 10, '10단계 — 다 지었다');
  assert(!R.arkPay(wa, ms, day0).ok, '더 지을 것이 없다');
  assert(R.claimMedal(wa, ms, 'arkBuilt', day0).ok, '방주 목수 훈장');
}
// 입장 — 둘 다 좋다고 해야. 밭 작물은 창고로, 스프링클러는 우편함으로
{
  const ms = rich('sua'), my = rich('yona');
  ['chicken', 'cow'].forEach((k, i) => { wa.animals.push({ id: 'p' + i, kind: k, name: k, by: 'sua' }, { id: 'q' + i, kind: k, name: k + '2', by: 'yona' }); });
  wa.plots['31,5'] = { tilled: true, crop: 'potato', progress: 0 }; wa.sprinklers['32,5'] = { by: 'yona' };
  const f0 = wa.ark.food;
  assert(R.arkBoard(wa, ms, day0).ok && !R.arkPhase(wa), '먼저 누르면 묻기만');
  assert(!R.arkBoard(wa, ms, day0).ok, '같은 아이는 기다림');
  const r = R.arkBoard(wa, my, day0);
  assert(r.ok && r.boarded && R.arkPhase(wa) === 'flood', '둘 다 좋으면 방주로');
  assert(wa.ark.food === f0 + 6 && !Object.keys(wa.plots).length, '밭 감자(두 개) → 창고 +6');
  assert(wa.mail.yona.some(g => g.id === 'sprinkler' && g.from === 'ark'), '스프링클러는 연아 우편함으로');
}
// 홍수 동안 — 섬 일은 쉬고, 창밖 낚시는 된다
{
  const m = rich('sua');
  assert(!R.buy(wa, m, 'seed:radish', day0).ok && !R.sell(wa, Object.assign(m, { inv: { egg: 1 } }), 'egg', 1, day0).ok, '가게가 쉰다');
  assert(!R.plotOpen(wa, '31,5') && !R.gather(wa, m, 'tree1', day0).ok, '밭·채집도 쉰다');
  assert(R.fish(wa, m, day0, 'good', 'flood').ok, '창밖 낚시');
  assert(Object.keys(m.inv).some(k => k.indexOf('fish:') === 0 && R.FISH[k.slice(5)].sea), '바닷물고기');
  assert(!R.fish(fresh('ark'), rich('sua'), day0, 'good', 'flood').ok, '홍수 전에는 창밖 낚시가 없다');
  const n = R.newDay(wa, m, day0 + D);
  assert(n.some(x => /방주 0일째/.test(x)) && !n.some(x => /행상인|부탁/.test(x)), '아침 소식은 방주 이야기');
}
// 370일 — 하루에 열흘, 양식이 모자라면 기다린다. 37번째(370일째)에 무지개 농장
{
  const ms = rich('sua'), my = rich('yona'), ration = R.arkRation(wa);
  wa.ark.food = ration * 3;
  assert(R.arkMonth(wa, ms, day0).ok && wa.ark.month === 1, '10일째');
  assert(R.arkState(wa, ms, day0).day === 10 && R.arkState(wa, ms, day0).news.length === 1, '열흘 — 첫 이야기는 큰비');
  assert(!R.arkMonth(wa, my, day0).ok, '하루에 열흘');
  assert(R.arkMonth(wa, my, day0 + D).ok && R.arkMonth(wa, ms, day0 + 2 * D).ok && wa.ark.month === 3);
  const r = R.arkMonth(wa, ms, day0 + 3 * D);
  assert(!r.ok && /모자라요/.test(r.msg) && wa.ark.month === 3, '양식이 없으면 멈춘다(실패는 없다)');
  wa.ark.seeds = ['radish', 'cloudberry'];
  wa.ark.food = 9999;
  let landed = null;
  for (let d = 3; d < R.ARK_TURNS; d++){ const x = R.arkMonth(wa, d % 2 ? ms : my, day0 + d * D); assert(x.ok, (d + 1) * 10 + '일째'); assert(!landed, '370일 전에는 안 내린다'); if (x.landed) landed = x; }
  assert(R.ARK_TURNS === 37 && landed.day === 370, '한 해와 열흘(창 7:11 → 8:14)');
  assert(R.ARK_LOG.every(L => L.day >= 1 && L.day <= 370), '이야기는 다 370일 안에');
  assert(landed && R.arkPhase(wa) === 'land' && R.farmOf(wa).id === 'newland', '370일째 — 무지개 농장');
  assert(wa.past[wa.past.length - 1].farm === 'ark' && !R.thingHere(Object.assign({}, wa, { farm: R.FARMS.findIndex(f => f.id === 'ark') }), 'ark'), '방주 농장은 빈 터로 남는다');
  assert(wa.animals.filter(a => a.baby && a.mom).length === 2, '한 쌍마다 아기 하나 — 닭·소');
  assert(wa.mail.sua.filter(g => g.from === 'ark' && g.id === 'seed:cloudberry').length === 1, '씨앗 금고의 씨앗이 돌아온다');
  assert(R.claimMedal(wa, ms, 'flood', day0).ok, '큰물을 건넜어요 훈장');
  const w2 = R.fixWorld(JSON.parse(JSON.stringify(wa)), day0);
  assert(R.arkPhase(w2) === 'land' && R.farmOf(w2).id === 'newland', '저장 뒤에도');
}
// 무지개 농장 — 금고에 넣은 농장 전용 작물이 자라고, 새 땅은 하나씩 짓는다
{
  const ms = rich('sua'), my = rich('yona');
  wa.seasonLen = 7; wa.started = R.dayKey(day0 - 8 * D);   // 여름
  assert(R.buy(wa, ms, 'seed:cloudberry', day0).ok, '금고에 넣은 클라우드베리는 무지개 농장에서 산다');
  assert(!R.buy(wa, ms, 'seed:dragonfruit', day0).ok, '안 넣은 용과는 못 산다');
  [ms, my].forEach(m => { m.inv.wood = 999; m.inv.stone = 999; m.inv.olive = 99; });
  assert(!R.landPay(wa, ms, 'vineyard', day0).ok, '차례를 건너뛸 수 없다');
  R.LAND_STEPS.forEach(L => { assert(R.landPay(wa, ms, L.id, day0).ok && R.landPay(wa, my, L.id, day0).built, L.id); assert(R.thingHere(wa, L.id), L.id + ' 이 섬에 선다'); });
  assert(R.landDone(wa) === R.LAND_STEPS.length && R.claimMedal(wa, ms, 'rainbow', day0).ok, '무지개 언약');
  assert(!R.thingHere(fresh('desert'), 'altar'), '다른 농장에는 안 선다');
}
// 무지개 농장 능력 — 새끼를 두 배 자주(같은 날짜로 견준다)
{
  const make = id => { const w = fresh(id); w.buildings.coop = { done: true }; for (let i = 0; i < 2; i++) w.animals.push({ id: 'k' + i, kind: 'chicken', name: '닭' + i, love: 10 }); return w; };
  let a = 0, b = 0;
  for (let d = 0; d < 200; d++){ const t = day0 + d * D, wn = make('newland'), wd = make('desert'); a += R.babyDay(wn, t).born.length; b += R.babyDay(wd, t).born.length; }
  assert(a > b * 1.5, '무지개 농장 새끼 ' + a + ' · 사막 ' + b);
}
// 명부 훈장 — 동물 스무 가지 한 쌍씩, 씨앗 전부. 방주 농장 우리(세 배)에 한 쌍씩 다 들어간다
{
  const w = fresh('ark'), m = rich('sua');
  assert.strictEqual(R.ARK_KINDS.length, 20, '동물 스무 가지');
  Object.keys(R.ANIMAL_MAX).forEach(need => assert(R.ARK_KINDS.filter(k => R.ANIMALS[k].need === need).length * 2 <= R.animalMax(w, need), need + ' 에 한 쌍씩 다 들어간다'));
  R.ARK_KINDS.forEach(k => { w.animals.push({ id: k + 1, kind: k }, { id: k + 2, kind: k }); });
  assert(R.claimMedal(w, m, 'arkPairs', day0).ok, '노아의 명부');
  w.ark = { seeds: R.CROP_IDS.slice() };
  assert(R.claimMedal(R.fixWorld(w, day0), m, 'arkSeeds', day0).ok, '씨앗 지기');
}
// 세이브 크기 — 방주 기록을 다 채워도 농장 한도(60KB) 안
{
  const s = JSON.stringify(wa).length;
  assert(s < 40000, '농장 세이브 ' + s + 'B');
  console.log('  방주 끝난 농장 세이브 ' + s + 'B');
}
console.log('방주 규칙 점검 통과');
