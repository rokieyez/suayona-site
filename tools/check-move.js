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
assert.strictEqual(w.past[0].farm, 'meadow'); assert(!w.moveAsk);
// 저장·불러오기 뒤에도 그대로
const w2 = R.fixWorld(JSON.parse(JSON.stringify(w)), now);
assert.strictEqual(R.farmOf(w2).id, 'seaside');
// 마지막 농장에서는 더 못 간다
w2.farm = 3; Object.keys(R.DECOR).forEach(d => { w2.decor[d] = { by: 'sua' }; });
assert(!R.askMove(w2, sua, now).ok && !R.moveState(w2, sua).next);
console.log('이사 규칙 점검 통과');
