// 이사 규칙 점검 — node tools/check-move.js
global.FARM = require('../farm-rules.js');
// 잠금(MOVE_OPEN=false)이어도 규칙 자체는 점검한다 — 잠금은 askMove 첫머리 한 줄이다
FARM.__inner.MOVE_OPEN = true;
require('../farm-rules-play.js');
const R = FARM, assert = require('assert'), now = Date.now();
const w = R.fixWorld(null, now), sua = R.fixMine(null, 'sua'), yona = R.fixMine(null, 'yona');
assert.strictEqual(R.farmOf(w).id, 'meadow');
assert(!R.askMove(w, sua, now).ok, '꾸미개가 없으면 못 간다');
Object.keys(R.DECOR).forEach(d => { w.decor[d] = { by: 'sua', on: '2026-09-28' }; });
assert(!R.askMove(w, sua, now).ok, '꾸미개만으로는 못 간다 — 가구·동물도 본다');
const fill = n => ['sua', 'yona', 'living'].forEach(r => { w.house[r] = {}; for (let i = 0; i < n; i++) w.house[r][i + ',0'] = { f: 'bed1', r: 0 }; });
fill(11); for (let i = 0; i < 9; i++) w.animals.push({ id: 'x' + i, kind: 'duck', name: '오리' });
assert.strictEqual(R.moveLeftText(R.moveState(w, sua)), '수아 방 가구 1개 · 연아 방 가구 1개 · 거실 가구 1개 · 동물 1마리');
fill(12);
w.buildings.coop = { done: true }; w.buildings.kitchen = { done: true }; w.buildings.barn = { sua: true };
w.animals.push({ id: 'a1', kind: 'chicken', name: '꼬꼬' }); w.layout.statue = { x: 3, y: 3 };
assert(R.askMove(w, sua, now).ok && w.moveAsk.by === 'sua', '먼저 누르면 묻기만');
assert(!R.askMove(w, sua, now).ok, '같은 아이가 또 누르면 기다림');
assert.strictEqual(R.farmOf(w).id, 'meadow');
const r = R.askMove(w, yona, now);
assert(r.ok && r.moved, '자매가 좋다고 하면 떠난다');
assert.strictEqual(R.farmOf(w).id, 'seaside');
assert.deepStrictEqual(w.decor, {}); assert.deepStrictEqual(w.layout, {});
assert(!w.buildings.coop && w.buildings.kitchen && w.buildings.barn, '다 지은 것만 두고 간다');
assert.strictEqual(w.animals.length, 10);
assert.strictEqual(w.mail.sua.filter(g => g.from === 'move').length, 1);
assert.strictEqual(w.past[0].farm, 'meadow'); assert.deepStrictEqual(w.past[0].layout, { statue: { x: 3, y: 3 } }); assert(w.past[0].buildings.coop && w.past[0].decor.statue); assert(!w.moveAsk);
// 저장·불러오기 뒤에도 그대로
const w2 = R.fixWorld(JSON.parse(JSON.stringify(w)), now);
assert.strictEqual(R.farmOf(w2).id, 'seaside');
// 마지막 농장에서는 더 못 간다
w2.farm = 3; Object.keys(R.DECOR).forEach(d => { w2.decor[d] = { by: 'sua' }; });
assert(!R.askMove(w2, sua, now).ok && !R.moveState(w2, sua).next);
// 농장 전용 꾸미개 — 그 농장에서만 사고, 이사 조건에도 그때만 든다
{
  const w3 = R.fixWorld(null, now), m3 = R.fixMine(null, 'sua'); m3.coins = 99999; m3.xp = 999999;
  assert(!R.buy(w3, m3, 'deco:lighthouse', now).ok, '들판에서는 등대를 못 산다');
  assert(R.moveState(w3, m3).need === Object.keys(R.DECOR).filter(d => !R.DECOR[d].farm).length);
  w3.farm = 1;
  assert(R.buy(w3, m3, 'deco:lighthouse', now).ok, '바닷가에서는 등대를 산다');
  assert(R.moveState(w3, m3).need === Object.keys(R.DECOR).filter(d => !R.DECOR[d].farm || R.DECOR[d].farm === 'seaside').length);
  // 바다낚시 — 바닷가에서만, 바닷물고기만
  m3.energy = 999;
  const f = R.fish(w3, m3, now, 'good', 'sea');
  assert(f.ok, '바닷가 바다에서 낚인다');
  assert(Object.keys(m3.inv).some(k => k.indexOf('fish:') === 0 && R.FISH[k.slice(5)].sea), '바닷물고기가 나온다');
  w3.farm = 2;
  assert(!R.fish(w3, m3, now, 'good', 'sea').ok, '산골에는 바다가 없다');
}
// 새 농장마다 처음 자리가 다르다 — 그 농장에 놓일 수 있는 것끼리, 밭·나무·바위·지도 끝과 안 겹쳐야 한다
{
  const I = R.__inner, hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  R.FARMS.forEach((f, i) => {
    const wf = R.fixWorld(null, now); wf.farm = i;
    const all = I.PLACE_IDS.filter(id => !(R.DECOR[id] && R.DECOR[id].farm && R.DECOR[id].farm !== f.id)).map(id => R.spotOf(wf, id));
    const rocks = Object.keys(R.NODES).map(n => ({ id: n, x: R.NODES[n].x, y: R.NODES[n].y, w: 1, h: 1 }));
    all.forEach((a, k) => {
      assert(a.x >= 0 && a.y >= 0 && a.x + a.w <= R.GRID.w && a.y + a.h <= R.GRID.h, f.id + ' ' + a.id + ' 지도 밖');
      if (!a.move) return;                                         // 집·가게는 원래 자리
      assert(!hit(a, R.FIELD_BOX), f.id + ' ' + a.id + ' 밭과 겹침');
      rocks.forEach(n => assert(!hit(a, n), f.id + ' ' + a.id + ' ' + n.id + '과 겹침'));
      all.slice(k + 1).forEach(b => assert(!hit(a, b), f.id + ' ' + a.id + ' ' + b.id + '과 겹침'));
      if (i) assert(!hit(a, { x: R.PEDDLER.x, y: R.PEDDLER.y, w: R.PEDDLER.w + 1, h: 1 }), f.id + ' ' + a.id + ' 떠돌이 상인 자리');
    });
  });
  // 옮겼다가 처음 자리로 되돌리면 layout 에서 빠진다(그 농장의 처음 자리 기준)
  const wm = R.fixWorld(null, now); wm.farm = 1; wm.decor.lighthouse = { by: 'sua' };
  assert(R.moveThing(wm, sua, 'lighthouse', 19, 14).ok && wm.layout.lighthouse);
  assert(R.moveThing(wm, sua, 'lighthouse', 19, 15).ok && !wm.layout.lighthouse, '바닷가 등대 처음 자리는 (19,15)');
}
console.log('이사 규칙 점검 통과');
