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
  for (let d = 3; d < R.ARK_TURNS; d++){ const x = R.arkMonth(wa, d % 2 ? my : ms, day0 + d * D); assert(x.ok, (d + 1) * 10 + '일째'); assert(!landed, '370일 전에는 안 내린다'); if (x.landed) landed = x; }
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
// ---------- 방주 더하기 열한 가지(2026-10-09) ----------
// 방주에 막 들어간 농장 — 날씨는 boardOn 으로 정해지므로 바꿔 가며 고를 수 있다
const boarded = b => { const w = fresh('ark'); w.ark = { step: 10, phase: 'flood', boardOn: b || R.dayKey(day0), month: 0, food: 9999, seeds: ['radish'] }; return R.fixWorld(w, day0); };
const seaBoard = (want, n) => { for (let i = 0; i < 500; i++){ const w = boarded('b' + i); if (R.arkSea(w, n || 0) === want) return w; } throw new Error(want + ' 날씨를 못 찾음'); };
// 1 동물 칸 돌보기 — 항해 중에도 밥·쓰다듬기 규칙 그대로
{
  const w = boarded(), m = rich('sua'), y = rich('yona');
  w.animals.push({ id: 'c1', kind: 'cow', name: '소', love: 0 });
  assert(R.feed(w, m, 'c1', day0).ok && R.pet(w, m, 'c1', day0).ok && R.pet(w, y, 'c1', day0).love, '항해 중에도 밥·쓰다듬기');
}
// 2 항해 날씨 — 열흘마다 정해짐, 아라랏 뒤엔 큰 파도 없음, 큰 파도 다음 아침엔 생산 없음, 잔잔하면 좋은 물고기↑, 안개면 다음 날짜 「?」
{
  const w = boarded(), kinds = {};
  for (let n = 0; n < R.ARK_TURNS; n++) kinds[R.arkSea(w, n)] = 1;
  assert(kinds.calm && kinds.fog, '잔잔함·안개가 다 나온다');
  for (let n = 15; n < R.ARK_TURNS; n++) assert(R.arkSea(seaBoard('wave'), n) !== 'wave', '150일 뒤엔 큰 파도 없음');
  assert.strictEqual(R.arkSea(w, 3), R.arkSea(R.fixWorld(JSON.parse(JSON.stringify(w)), day0), 3), '저장해도 같은 날씨');
  const lay = sea => { const v = seaBoard(sea), m = rich('sua'); v.buildings.coop = { done: true }; v.animals.push({ id: 'h1', kind: 'chicken', name: '닭' }); v.dayKey = R.dayKey(day0);
    R.feed(v, m, 'h1', day0); assert(R.arkMonth(v, m, day0).ok); const notes = R.newDay(v, m, day0 + D); return { ready: v.animals[0].ready, notes }; };
  const wave = lay('wave'), calm = lay('calm');
  assert(!wave.ready && wave.notes.some(x => /큰 파도/.test(x)), '큰 파도 다음 아침 — 동물이 쉰다');
  assert(calm.ready, '잔잔한 날 다음 아침엔 낳는다');
  const rare = sea => { const v = seaBoard(sea); let n = 0; for (let d = 0; d < 300; d++){ const m = rich('sua'); R.fish(v, m, day0 + d * D, 'good', 'flood'); n += Object.keys(m.inv).filter(k => k.indexOf('fish:') === 0 && R.FISH[k.slice(5)].sell >= 200).length; } return n; };
  const rc = rare('calm'), rf = rare('fog');
  assert(rc > rf, '잔잔한 바다에서 좋은 물고기가 더 문다 (' + rc + ' > ' + rf + ')');
  const fg = seaBoard('fog');
  assert(R.arkState(fg, rich('sua'), day0).fog && !R.arkState(seaBoard('calm'), rich('sua'), day0).fog, '안개');
  assert(R.newDay(fg, rich('sua'), day0 + D).some(x => /짙은 안개/.test(x)), '아침 소식에 바다 날씨');
}
// 3 비둘기 심부름 — 264일 뒤부터 열흘에 한 번, 270 돌아옴 · 280 올리브 · 290 안 돌아옴(그 뒤 단추 없음)
{
  const w = boarded(), m = rich('sua');
  w.ark.month = 26; assert(!R.arkDove(w, m, day0).ok && !R.arkState(w, m, day0).doveOpen, '260일엔 아직');
  w.ark.month = 27; let r = R.arkDove(w, m, day0);
  assert(r.ok && r.dove === 'back' && !R.arkDove(w, m, day0).ok, '270일 — 돌아옴, 열흘에 한 번');
  w.ark.month = 28; r = R.arkDove(w, m, day0);
  assert(r.dove === 'olive' && m.inv.olive === 1 && R.dexRec(m, 'olive'), '280일 — 올리브 새잎(도감)');
  w.ark.month = 29; r = R.arkDove(w, m, day0);
  w.ark.month = 30;
  assert(r.dove === 'gone' && !R.arkDove(w, m, day0).ok && !R.arkState(w, m, day0).doveOpen, '290일 — 안 돌아오고 단추가 사라짐');
  assert.deepStrictEqual(R.fixWorld(JSON.parse(JSON.stringify(w)), day0).ark.doves.map(d => d.r), ['back', 'olive', 'gone']);
}
// 4 번갈아 당번 — 지난번에 넘긴 아이는 쉬고, 자매가 이틀 넘게 안 넘기면 같은 아이도
{
  const w = boarded(), ms = rich('sua'), my = rich('yona');
  assert(R.arkMonth(w, ms, day0).ok, '첫 번은 누구나');
  const r = R.arkMonth(w, ms, day0 + D);
  assert(!r.ok && /연아 당번/.test(r.msg), '같은 아이는 다음 번에 못 넘김');
  assert(R.arkState(w, my, day0 + D).myTurn && !R.arkState(w, ms, day0 + D).myTurn);
  assert(R.arkMonth(w, my, day0 + D).ok);
  assert(!R.arkMonth(w, my, day0 + 2 * D).ok && !R.arkMonth(w, my, day0 + 3 * D).ok, '이틀까지는 수아를 기다림');
  assert(R.arkMonth(w, my, day0 + 4 * D).ok, '사흘째엔 연아가 또 넘길 수 있다(막힘 방지)');
  assert.deepStrictEqual(w.ark.duty.map(d => d.by + d.day), ['sua10', 'yona20', 'yona30']);
  assert(w.diary.some(l => /수아 당번 — 방주 10일째/.test(l.text)), '일기장에 당번');
  assert.strictEqual(R.fixWorld(JSON.parse(JSON.stringify(w)), day0).ark.duty.length, 3);
}
// 6 창고 칸 — 총점은 그대로, 네 칸이 다 차면 열흘 양식 −1. 옛 세이브는 칸 0
{
  const w = fresh('ark'), m = rich('sua'), fishId = R.FISH_IDS.find(f => R.arkFoodOf('fish:' + f) > 0);
  for (let i = 0; i < 12; i++) w.animals.push({ id: 'z' + i, kind: 'chicken', name: '닭' });
  const r0 = R.arkRation(w);
  Object.assign(m.inv, { 'crop:potato': 7, 'crop:cabbage': 7, egg: 10 }); m.inv['fish:' + fishId] = 20;
  ['crop:potato', 'crop:cabbage', 'egg'].forEach(id => assert(R.arkStore(w, m, id, 99, day0).ok));
  assert(R.arkRation(w) === r0, '세 칸만으로는 그대로');
  const r = R.arkStore(w, m, 'fish:' + fishId, 20, day0);
  assert(r.ok && r.even && R.arkRation(w) === r0 - 1, '네 칸이 골고루 — 열흘 양식 −1');
  const S = w.ark.store;
  assert(S.grain === 21 && S.hay === 21 && S.animal === 20 && S.fish >= 20, '칸마다 ' + JSON.stringify(S));
  assert.strictEqual(w.ark.food, S.grain + S.hay + S.animal + S.fish, '총점은 칸의 합');
  const old = R.fixWorld({ farm: 0, ark: { food: 50 } }, day0);
  assert(old.ark.food === 50 && old.ark.store.grain === 0 && old.ark.store.fish === 0, '옛 세이브 — food 그대로, 칸은 0');
}
// 7 방주 꾸미기 — 가진 가구 중 넷까지, 문이 닫히면 못 바꿈
{
  const w = fresh('ark'), m = rich('sua');
  w.house.living = { '0,0': { f: 'bed1', r: 0 }, '2,0': { f: 'table', r: 0 } }; m.inv['f:rug1'] = 1; m.inv['f:rug2'] = 1; m.inv['f:bed2'] = 1;
  assert(!R.arkCabin(w, m, 'bed3', day0).ok, '없는 가구는 못 실음');
  ['bed1', 'table', 'rug1', 'rug2'].forEach(f => assert(R.arkCabin(w, m, f, day0).ok, f));
  assert(!R.arkCabin(w, m, 'bed2', day0).ok, '다섯째는 자리가 없음');
  assert(R.arkCabin(w, m, 'table', day0).ok && w.ark.cabin.length === 3, '다시 누르면 내려놓음');
  assert.deepStrictEqual(R.fixWorld(JSON.parse(JSON.stringify(w)), day0).ark.cabin, ['bed1', 'rug1', 'rug2']);
  w.ark.phase = 'flood';
  assert(!R.arkCabin(w, m, 'bed2', day0).ok, '문이 닫히면 못 바꿈');
}
// 11 노아 이야기 카드 · 9 기념관 · 10 금고 정원 · 8 무지개 언약 — 370일을 다 지낸 wa 로
{
  const ms = rich('sua'), my = rich('yona');
  assert.strictEqual(R.arkCardsHave(wa), R.ARK_LOG.length, '370일 지나면 카드 14장');
  assert(wa.diary.some(l => /「노아 이야기」 한 권/.test(l.text)), '한 권 완성 기록');
  assert(R.claimMedal(wa, ms, 'arkCards', day0).ok, '노아 이야기 훈장');
  const half = R.fixWorld({ farm: R.arkFarmIndex(), ark: { phase: 'flood', month: 10 } }, day0);
  assert.deepStrictEqual(half.ark.cards, [1, 20, 40, 100], '카드 전 옛 세이브 — 지난 이야기는 모은 것으로');
  const b = boarded(), r = R.arkMonth(b, rich('sua'), day0);
  assert(r.card && b.ark.cards.length === 1, '첫 열흘 — 큰비 카드');
  // 기념관
  const Mm = wa.ark.memorial;
  assert(Mm && Mm.landOn && Mm.pairs.indexOf('chicken') >= 0 && Mm.pairs.indexOf('cow') >= 0, '기념관 명부 ' + (Mm && Mm.pairs));
  assert(Mm.log.length > 10 && Mm.log.some(l => /당번/.test(l.text)), '기념관 일지');
  assert(wa.ark.duty.length === R.ARK_TURNS, '당번 기록 37번');
  // 금고 정원 — 금고 작물(무, 클라우드베리)을 무지개 농장에서 하나씩
  const pid = R.plotIds(wa, 'field')[0], grow = c => { wa.plots[pid] = { tilled: true, crop: c, progress: 1e9, tick: day0, care: 99 }; return R.harvest(wa, ms, pid, day0); };
  assert(!R.claimMedal(wa, ms, 'arkGarden', day0).ok);
  assert(/금고 정원 1\/2/.test(grow('radish').msg) && !/금고 정원/.test(grow('radish').msg), '같은 작물은 한 번');
  assert(!/금고 정원/.test(grow('potato').msg), '금고에 없던 작물은 안 셈');
  assert(/금고 정원 2\/2/.test(grow('cloudberry').msg) && R.claimMedal(wa, ms, 'arkGarden', day0).ok, '금고 정원 훈장');
  // 무지개 언약 — 첫 제단(무지개 농장 짓기는 앞에서 다 했으므로 새 농장으로)
  const nl = R.fixWorld({ farm: R.FARMS.findIndex(f => f.id === 'newland'), ark: { phase: 'land', step: 10 } }, day0);
  [ms, my].forEach(m => { m.inv.stone = 99; m.inv.wood = 99; });
  assert(R.landPay(nl, ms, 'altar', day0).ok && R.landPay(nl, my, 'altar', day0).covenant && nl.ark.covenant, '첫 제단 — 무지개 언약');
  assert(!R.landPay(nl, ms, 'rainbowhill', day0).covenant && !R.landPay(nl, my, 'rainbowhill', day0).covenant, '언약은 한 번');
  assert(wa.ark.covenant, '앞에서 지은 무지개 농장도 언약 기록');
  const oldNl = R.fixWorld({ farm: 0, ark: { phase: 'land', land: { altar: { done: true, on: '2026-10-11', paid: {} } } } }, day0);
  assert.strictEqual(oldNl.ark.covenant, '2026-10-11', '옛 세이브 — 제단을 지었으면 언약도');
}
// 세이브 크기 — 방주 기록을 다 채워도 농장 한도(60KB) 안
{
  const s = JSON.stringify(wa).length;
  assert(s < 40000, '농장 세이브 ' + s + 'B');
  console.log('  방주 끝난 농장 세이브 ' + s + 'B');
}
console.log('방주 규칙 점검 통과');
