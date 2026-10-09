// 도감 기록 점검 — node tools/check-dex.js (2026-10-09 로키즈 「도감 강화 전부」)
// 처음 만난 날·농장·횟수·계절 별·물고기 크기·손님/사건·가구·일기장
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, assert = require('assert');
const at = (h, d) => new Date(2026, 6, d || 10, h, 0).getTime();
const day = at(12);
const idx = id => R.FARMS.findIndex(f => f.id === id);
const world = farm => { const w = R.fixWorld(null, day); w.started = R.dayKey(at(12, 9)); w.farm = idx(farm); return w; };
const rich = k => Object.assign(R.fixMine(null, k || 'sua'), { coins: 99999, xp: 999999, energy: 999 });

// 처음 만난 날·농장은 한 번만, 횟수는 쌓인다
{
  const w = world('aurora'), m = rich();
  const e = R.noteDex(w, m, 'moss', day, 2);
  assert.deepStrictEqual([e.d, e.f, e.n], [R.dayKey(day), 'aurora', 2]);
  assert.strictEqual(m.dexAt.moss, '260710.' + idx('aurora') + '.2.0', '짧은 글자열로 적는다');
  w.farm = idx('desert');
  R.noteDex(w, m, 'moss', at(12, 15));
  const r = R.dexRec(m, 'moss');
  assert.deepStrictEqual([r.d, r.f, r.n], [R.dayKey(day), 'aurora', 3], '처음 날·농장은 그대로');
  R.noteDex(w, m, 'pinecone', day, 1, { farm: 'aurora' });
  assert.strictEqual(R.dexRec(m, 'pinecone').f, 'aurora', '옛 농장 선물은 그 농장');
  assert.strictEqual(m.dex.filter(k => k === 'moss').length, 1, '도감 칸은 하나');
}
// 기록 전에 모은 것 — 날짜를 지어 넣지 않는다
{
  const w = world('meadow'), m = rich(); m.dex.push('egg');
  const e = R.noteDex(w, m, 'egg', day);
  assert(!e.d && !e.f && e.n === 1, '예전에 만난 것은 날짜 없이 횟수만');
  const back = R.fixMine(JSON.parse(JSON.stringify(m)), 'sua');
  assert.deepStrictEqual(R.dexRec(back, 'egg'), { d: null, f: null, n: 1, x: 0 }, '저장했다 읽어도 남는다');
  assert.strictEqual(R.dexRec(R.fixMine({ dex: ['egg'], dexAt: { egg: { d: 'x' } } }, 'sua'), 'egg'), null, '옛 모양은 없는 셈');
  assert.deepStrictEqual(R.fixMine({ dex: [], dexAt: [] }, 'sua').dexAt, {}, '이상한 값은 비운다');
}
// 거두기 — 계절 별(비트)과 반짝
{
  const w = world('meadow'), m = rich(), c = R.CROP_IDS.find(x => R.CROPS[x].season.indexOf('summer') >= 0 && !R.CROPS[x].regrow && !R.CROPS[x].farm);
  const id = R.plotIds(w, 'field')[0];
  w.plots[id] = { tilled: true, crop: c, progress: 1e9, tick: day, care: 99 };
  const r = R.harvest(w, m, id, day);
  assert(r.ok, r.msg);
  const sea = R.calendar(w, day).season;
  assert.strictEqual(R.dexRec(m, c).x, 1 << R.SEASONS.indexOf(sea), '거둔 계절 비트');
  assert.strictEqual(R.dexRec(m, c).n, r.n, '거둔 개수만큼');
}
// 낚시 — 크기, 가장 큰 기록
{
  const w = world('meadow'), m = rich(); w.decor.pond = { by: 'sua' };
  let sized = 0;
  for (let d = 1; d <= 20; d++){
    m.fishDay = null;
    const r = R.fish(w, m, at(12, d), 'good', 'pond');
    assert(r.ok, r.msg);
    if (/\d+cm/.test(r.msg)) sized++;
  }
  assert(sized > 10, '물고기는 크기를 잰다');
  const recs = Object.keys(m.dexAt).filter(k => k.slice(0, 5) === 'fish:' && R.FISH_CM[k.slice(5)]);
  assert(recs.length && recs.every(k => R.dexRec(m, k).x > 0), '가장 큰 크기가 남는다');
  recs.forEach(k => { const b = R.FISH_CM[k.slice(5)], x = R.dexRec(m, k).x; assert(x >= Math.floor(b * 0.7) && x <= Math.ceil(b * 1.3 * 1.1)); });
}
// 손님·사건 — 우편으로 온 산타 편지, 가구, 손님 부탁
{
  const w = world('aurora'), m = rich();
  w.mail.sua.push({ id: 'f:sled', n: 1, from: 'santa', note: '', t: at(12, 12) }, { id: 'note', n: 1, from: 'yona', note: 'hi', t: day });
  R.openMail(w, m);
  assert.strictEqual(R.dexRec(m, 'ev:santa').d, R.dayKey(at(12, 12)), '편지가 온 날');
  assert.deepStrictEqual(w.furnAt.sled, { d: R.dayKey(at(12, 12)), by: 'sua', f: 'aurora' }, '받은 가구는 농장에 둘이 함께');
  assert(!m.dexAt['ev:yona'] && m.dex.indexOf('f:sled') < 0, '쪽지는 사건이 아니고, 가구는 제 도감 칸을 안 먹는다');
  const q = R.questOf(w, day); m.inv[q.id] = q.n;
  assert(R.giveQuest(w, m, day).ok);
  assert(m.dexAt['guest:aurora'] && w.furnAt[q.gift.slice(2)], '손님과 받은 가구');
  const y = rich('yona'), f = Object.keys(R.FURNITURE).find(k => !R.FURNITURE[k].farm && !R.FURNITURE[k].rare && !R.FURNITURE[k].season && R.FURNITURE[k].cost > 0);
  assert(R.buy(w, y, 'f:' + f, day).ok); assert(R.buy(w, m, 'f:' + f, at(12, 14)).ok);
  assert.strictEqual(w.furnAt[f].by, 'yona', '먼저 들인 사람이 남는다');
}
// 둘이서 모닥불 — 농장에 한 번
{
  const w = world('meadow'), a = rich('sua'), b = rich('yona'), night = at(22);
  w.decor.firepit = { by: 'sua' };
  assert(R.fireSit(w, a, night).ok); assert(!w.fireFirst);
  assert(R.fireSit(w, b, night).ok); assert.strictEqual(w.fireFirst, R.dayKey(night));
}
// 일기장 — 큰 일만, 처음 생길 때 옛 일지에서 작은 일을 빼고 옮긴다
{
  const w = world('meadow');
  w.log = [{ t: day, who: 'sua', text: '수아가 연아에게 쪽지를 보냈어요' }, { t: day, who: 'sua', text: '닭장이 완성됐어요!' }];
  R.logAdd(w, 'sua', '수아가 연아에게 쪽지를 보냈어요', day, true);
  assert(!w.diary, '작은 일로는 일기장이 안 생긴다');
  R.logAdd(w, 'sua', '둘이서 큰 수박 뽑았어요!', day);
  assert.deepStrictEqual(w.diary.map(l => l.text), ['둘이서 큰 수박 뽑았어요!', '닭장이 완성됐어요!']);
  for (let i = 0; i < 400; i++) R.logAdd(w, 'sua', '반짝 ' + i, day);
  assert.strictEqual(w.diary.length, 120, '일기장은 120줄까지');
  assert.strictEqual(w.log.length, 24, '일지는 그대로 24줄');
}
// 세이브 한도 — farm_commit 은 아이 줄 16000·농장 60000 바이트를 넘으면 받지 않는다.
// 도감을 다 채운 아이와 일기장·가구 기록이 꽉 찬 농장도 넉넉히 들어가야 한다(JSON 길이로 어림)
{
  const w = world('desert'), m = rich();
  const ids = R.CROP_IDS.map(c => c).concat(R.CROP_IDS.map(c => 'gold:' + c), R.CROP_IDS.filter(c => R.CROPS[c].giant).map(c => 'giant:' + c),
    R.FISH_IDS.map(f => 'fish:' + f), Object.keys(R.DISHES).map(d => 'dish:' + d), R.DEX_GOODS,
    ['ev:peddler', 'ev:box', 'ev:postcard', 'ev:move', 'ev:santa', 'ev:genie'], Object.keys(R.GUESTS).map(f => 'guest:' + f));
  ids.forEach(id => R.noteDex(w, m, id, day, 12345, { s: 15, cm: 150 }));
  Object.keys(R.FURNITURE).forEach(f => { m.inv['f:' + f] = 3; R.noteFurn(w, m, 'f:' + f, day); });
  const mine = Buffer.byteLength(JSON.stringify(m));
  assert(mine < 12000, '도감을 다 채운 아이 세이브 ' + mine + '바이트 — 16000 한도에 여유');
  for (let i = 0; i < 200; i++) R.logAdd(w, 'sua', '수아가 북극곤들매기를 낚았어요! 아주 귀한 물고기 ' + i, day);
  const extra = Buffer.byteLength(JSON.stringify({ diary: w.diary, furnAt: w.furnAt }));
  assert(extra < 20000, '일기장·가구 기록이 농장 세이브에 더하는 것 ' + extra + '바이트');
  console.log('  아이 세이브(도감 가득) ' + mine + 'B · 농장에 더해지는 것 ' + extra + 'B');
}
console.log('도감 점검 통과');
