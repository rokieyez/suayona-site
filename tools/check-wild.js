// 단풍·밀림·사바나 농장 점검 — node tools/check-wild.js (2026-10-09 로키즈 「오로라와 사막 사이에 농장 셋」)
// 농장 차례 · 그 농장에서만 얻는 동식물(이주 조건) · 능력(풍년·스콜·물웅덩이) · 낮에 줍는 것 · 손님 · 도감 훈장
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, I = R.__inner, assert = require('assert');
const day = new Date(2026, 9, 10, 12, 0).getTime(), D = R.DAY_MS;
const rich = k => Object.assign(R.fixMine(null, k || 'sua'), { coins: 999999, xp: 9999999, energy: 999 });
const world = id => { const w = R.fixWorld(null, day); w.started = R.dayKey(day - 8 * D); w.seasonLen = 7; w.farm = R.FARMS.findIndex(f => f.id === id); return w; };   // 여름

// 차례 — 오로라 → 단풍 → 밀림 → 사바나 → 사막 → 방주 → 무지개
assert.deepStrictEqual(R.FARMS.slice(R.FARMS.findIndex(f => f.id === 'aurora')).map(f => f.id), ['aurora', 'maple', 'jungle', 'savanna', 'desert', 'ark', 'newland']);
['maple', 'jungle', 'savanna'].forEach(id => { const F = R.FARMS.find(f => f.id === id); assert(F.stage === 2 && F.perk && F.grid, id); });

// 그 농장에서만 얻는 것 — 농장마다 동물·작물이 있다(들판 빼고, 방주·무지개는 마지막이라 빼고)
['seaside', 'cloud', 'aurora', 'maple', 'jungle', 'savanna', 'desert'].forEach(id => {
  const L = R.localOf(id);
  assert(L.animals.length >= 1 && L.crops.length >= 1, id + ' 전용 동식물');
  L.crops.forEach(c => assert(R.CROPS[c].farm === id, id + ' ' + c));
});
// 그 농장 씨앗은 철이 아니어도 산다(금고에 넣으려고) — 겨울 오로라에서 클라우드베리
{
  const w = world('aurora'), m = rich(); w.started = R.dayKey(day - 22 * D);
  assert.strictEqual(R.calendar(w, day).season, 'winter');
  assert(R.buy(w, m, 'seed:cloudberry', day).ok && R.arkSeed(w, m, 'cloudberry', day).ok, '겨울에도 사서 금고에');
  assert(!R.buy(w, m, 'seed:tomato', day).ok, '보통 씨앗은 철에만');
}
['fig', 'tea', 'cranberry', 'cacao', 'kiwano'].forEach(c => { assert(R.CROPS[c].season.length >= 3, c + ' 은 세 계절 자란다');
});
assert.deepStrictEqual(R.localOf('savanna').animals, ['giraffe', 'elephant', 'zebra']);
// 특산물은 둘이 같이 센다 — 연아가 주워도 수아의 이사 조건이 찬다
{
  const w = world('maple'), s = rich('sua'), y = rich('yona');
  const goods = () => R.localState(w, s).goods.filter(g => g.have).length;
  assert.strictEqual(goods(), 0);
  R.noteDex(w, y, 'syrup', day); R.noteDex(w, y, 'chestnut', day);
  assert.strictEqual(goods(), 2, '연아가 만난 것');
  R.noteDex(w, y, 'egg', day); assert(w.found.indexOf('egg') < 0, '특산물이 아닌 것은 안 적는다');
  R.noteDex(w, y, 'gold:cranberry', day); assert(w.found.indexOf('crop:cranberry') >= 0, '반짝 작물도 그 작물로');
  const w2 = R.fixWorld(JSON.parse(JSON.stringify(w)), day);
  assert.deepStrictEqual(w2.found, w.found, '저장 뒤에도');
}
// 단풍 「풍년」 — 거둘 때 넷에 하나꼴로 하나 더
{
  let extra = 0, tries = 0;
  for (let k = 0; k < 200; k++){
    ['maple', 'jungle'].forEach(id => {
      const w = world(id), m = rich(), pid = R.plotIds(w, 'field')[0], t = day + k * 3600 * 1000;
      w.plots[pid] = { tilled: true, crop: 'potato', plantedAt: t - 100 * R.H, progress: 999 * R.H, tick: t };
      const n0 = m.inv['crop:potato'] || 0, r = R.harvest(w, m, pid, t);
      assert(r.ok, r.msg);
      if (id === 'maple'){ tries++; if ((m.inv['crop:potato'] - n0) > R.CROPS.potato.yield) extra++; }
      else assert.strictEqual(m.inv['crop:potato'] - n0, R.CROPS.potato.yield, '밀림에는 풍년이 없다');
    });
  }
  assert(extra > tries * 0.12 && extra < tries * 0.4, '풍년 ' + extra + '/' + tries);
}
// 밀림 「스콜」 — 맑은 날에도 밭이 촉촉해진다
{
  const pick = id => { for (let d = 0; d < 40; d++){ const t = day + d * D, w = world(id), cal = R.calendar(w, t); if (R.weatherOf(R.dayKey(t), cal.season) === 'sun') return t; } };
  const t = pick('jungle'), wj = world('jungle'), wm = world('maple'), m = rich(), pid = R.plotIds(wj, 'field')[0];
  wj.plots[pid] = { tilled: true }; wm.plots[pid] = { tilled: true };
  const n = R.newDay(wj, m, t); R.newDay(wm, rich(), t);
  assert(wj.plots[pid].wet > t && n.some(x => /스콜/.test(x)), '밀림은 맑은 날에도 소나기');
  assert(!(wm.plots[pid].wet > t), '단풍은 맑으면 그대로');
}
// 사바나 「물웅덩이」 — 둘이 쓰다듬으면 마음이 두 칸
{
  const ws = world('savanna'), wd = world('desert'), s = rich('sua'), y = rich('yona');
  [ws, wd].forEach(w => w.animals.push({ id: 'a1', kind: 'cow', name: '소', love: 0, pet: [] }));
  [ws, wd].forEach(w => { R.pet(w, s, 'a1', day); R.pet(w, y, 'a1', day); });
  assert.strictEqual(ws.animals[0].love, 2); assert.strictEqual(wd.animals[0].love, 1);
}
// 낮에 줍는 것 — 단풍 시럽 · 밀림 망고 · 사바나 바오밥 열매
{
  [['maple', 'syrup'], ['jungle', 'mango'], ['savanna', 'baobab']].forEach(([id, item]) => {
    const w = world(id), m = rich(), noon = new Date(2026, 9, 10, 13).getTime(), night = new Date(2026, 9, 10, 22).getTime();
    const sp = R.shardSpots(w, noon);
    assert(sp.length >= 3, id + ' 줍는 자리');
    assert(!R.pickShard(w, m, sp[0].i, night).ok, id + ' 밤에는 없다');
    assert(R.pickShard(w, m, sp[0].i, noon).ok && m.inv[item] === 1, id + ' ' + item);
    assert(w.found.indexOf(item) >= 0, '주운 특산물은 같이 센다');
  });
}
// 동물이 물어 오는 것 — 사슴은 밤·도토리, 원숭이는 바나나·망고, 앵무새는 깃털
{
  const w = world('jungle'), m = rich();
  w.animals.push({ id: 'd', kind: 'deer', name: '사슴', fedDay: R.dayKey(day - D) }, { id: 'p', kind: 'parrot', name: '앵무새', fedDay: R.dayKey(day - D), since: 1 }, { id: 'k', kind: 'monkey', name: '원숭이', fedDay: R.dayKey(day - D) });
  R.newDay(w, m, day);
  const got = id => w.animals.find(a => a.id === id).ready;
  assert(['chestnut', 'acorn'].indexOf(got('d')) >= 0 && got('p') === 'feather' && ['banana', 'mango'].indexOf(got('k')) >= 0, JSON.stringify(w.animals.map(a => a.ready)));
}
// 손님 — 농장마다
{
  [['maple', '나무꾼'], ['jungle', '탐험가'], ['savanna', '사파리']].forEach(([id, nm]) => { const q = R.questOf(world(id), day); assert(q && q.name.indexOf(nm) >= 0 && R.FURNITURE[q.gift.slice(2)].farm === id, id + ' 손님'); });
}
// 도감 훈장 — 특산물을 다 모으면
{
  [['maple', 'dexMaple'], ['jungle', 'dexJungle'], ['savanna', 'dexSavanna']].forEach(([id, md]) => {
    const w = world(id), m = rich();
    assert(!R.claimMedal(w, m, md, day).ok);
    R.SPECIALS[id].forEach(x => R.noteDex(w, m, I.dexId(x), day));
    assert(R.claimMedal(w, m, md, day).ok && m.inv[R.MEDALS.find(M => M.id === md).gift.id] === 1, md);
  });
}
// 그 농장 꾸미개·가구 — 그 농장에서만 판다
{
  const w = world('jungle'), m = rich();
  assert(R.buy(w, m, 'deco:treehouse', day).ok && !R.buy(w, m, 'deco:sugarshack', day).ok, '밀림에서는 밀림 꾸미개만');
  ['maple', 'jungle', 'savanna'].forEach(id => {
    assert.strictEqual(Object.keys(R.DECOR).filter(d => R.DECOR[d].farm === id).length, 4, id + ' 꾸미개 넷');
    assert.strictEqual(Object.keys(R.FURNITURE).filter(f => R.FURNITURE[f].farm === id).length, 4, id + ' 가구 넷');
  });
}
console.log('단풍·밀림·사바나 점검 통과');
