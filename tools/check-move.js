// 이사 규칙 점검 — node tools/check-move.js
global.FARM = require('../farm-rules.js');
// 잠금(MOVE_OPEN=false)이어도 규칙 자체는 점검한다 — 잠금은 askMove 첫머리 한 줄이다
FARM.__inner.MOVE_OPEN = true;
require('../farm-rules-play.js');
const R = FARM, I2 = FARM.__inner, assert = require('assert'), now = Date.now();
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
assert.strictEqual(w.animals.length, 11, '새 식구 한 마리가 따라온다');
{ const g = w.animals[w.animals.length - 1]; assert(g.kind === 'gull' && g.baby, '바닷가 새 식구는 아기 갈매기'); }
assert(!R.buy(w, Object.assign(R.fixMine(null, 'sua'), { coins: 99999 }), 'animal:gull', now).ok, '새 식구는 가게에서 못 산다');
assert.strictEqual(w.mail.sua.filter(g => g.from === 'move').length, 1);
assert.strictEqual(w.past[0].farm, 'meadow'); assert.deepStrictEqual(w.past[0].layout, { statue: { x: 3, y: 3 } }); assert(w.past[0].buildings.coop && w.past[0].decor.statue); assert(!w.moveAsk);
// 여권 도장 — 이사한 만큼 받고, 둘(바닷가·꽃구름 — 화산은 건너뜀)을 다 받으면 여권(별열매 씨앗 다섯)
{
  const mm = R.fixMine(null, 'sua');
  assert(R.claimMedal(w, mm, 'stampSea', now).ok && !R.claimMedal(w, mm, 'stampCloud', now).ok && !R.claimMedal(w, mm, 'passport', now).ok, '꽃구름 도장은 꽃구름에 가서');
  assert(!R.MEDALS.some(M => M.id === 'stampMt'), '화산 도장은 없다');
  const w4 = R.fixWorld(null, now); w4.farm = 3;
  assert(R.claimMedal(w4, mm, 'stampCloud', now).ok && R.claimMedal(w4, mm, 'passport', now).ok && mm.inv['seed:star'] === 5, '여권 선물');
}
// 저장·불러오기 뒤에도 그대로
const w2 = R.fixWorld(JSON.parse(JSON.stringify(w)), now);
assert.strictEqual(R.farmOf(w2).id, 'seaside');
// 마지막 농장에서는 더 못 간다
w2.farm = R.FARMS.length - 1; Object.keys(R.DECOR).forEach(d => { w2.decor[d] = { by: 'sua' }; });
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
    // 앞 농장 전용 꾸미개는 추억으로 들고 올 수 있으니 뒤 농장에서도 자리가 겹치면 안 된다
    const came = id => { const F = R.DECOR[id] && R.DECOR[id].farm; return !F || R.FARMS.findIndex(x => x.id === F) <= i; };
    const all = I.PLACE_IDS.filter(came).map(id => R.spotOf(wf, id));
    const rocks = Object.keys(R.NODES).map(n => Object.assign({ id: n, w: 1, h: 1 }, R.nodeSpot(wf, n))).concat(R.sceneryOf(wf).map(c => ({ id: '풍경 ' + c.kind + '(' + c.x + ',' + c.y + ')', x: c.x, y: c.y, w: 1, h: 1 })));
    // 나무·바위·풍경끼리, 그리고 밭·떠돌이 상인 자리와도 겹치지 않는다
    rocks.forEach((a, k) => {
      assert(a.x >= 0 && a.y >= 0 && a.x < R.gridOf(wf).w && a.y < R.gridOf(wf).h, f.id + ' ' + a.id + ' 지도 밖');
      assert(!R.fieldHas(wf, a.x, a.y), f.id + ' ' + a.id + ' 밭과 겹침');
      rocks.slice(k + 1).forEach(b => assert(!hit(a, b), f.id + ' ' + a.id + ' ' + b.id + '과 겹침'));
      assert(!hit(a, (P => ({ x: P.x, y: P.y, w: P.w + 1, h: 1 }))(R.peddlerSpot(wf))) || !i, f.id + ' ' + a.id + ' 떠돌이 상인 자리');
      ['house', 'stall'].forEach(id => assert(!hit(a, R.spotOf(wf, id)), f.id + ' ' + a.id + ' ' + id + '과 겹침'));
    });
    all.forEach((a, k) => {
      assert(a.x >= 0 && a.y >= 0 && a.x + a.w <= R.gridOf(wf).w && a.y + a.h <= R.gridOf(wf).h, f.id + ' ' + a.id + ' 지도 밖');
      if (!a.move) return;                                         // 집·가게는 원래 자리
      R.fieldCells(wf).forEach(c => assert(!hit(a, { x: c.x, y: c.y, w: 1, h: 1 }), f.id + ' ' + a.id + ' 밭(' + c.id + ')과 겹침'));
      rocks.forEach(n => assert(!hit(a, n), f.id + ' ' + a.id + ' ' + n.id + '과 겹침'));
      all.slice(k + 1).forEach(b => assert(!hit(a, b), f.id + ' ' + a.id + ' ' + b.id + '과 겹침'));
      if (i) assert(!hit(a, (P => ({ x: P.x, y: P.y, w: P.w + 1, h: 1 }))(R.peddlerSpot(wf))), f.id + ' ' + a.id + ' 떠돌이 상인 자리');
    });
  });
  // 꾸미개를 행상인 자리에 옮겨 두면 행상인이 가까운 빈자리로 비켜 선다(2026-10-08 모래놀이터)
  const wp = R.fixWorld(null, now); wp.farm = 1; wp.decor.sandbox = { by: 'sua' };
  const p0 = R.peddlerSpot(wp);
  assert(R.moveThing(wp, sua, 'sandbox', p0.x, p0.y).ok, '모래놀이터를 행상인 자리로');
  const p1 = R.peddlerSpot(wp);
  assert((p1.x !== p0.x || p1.y !== p0.y) && !hit(R.spotOf(wp, 'sandbox'), { x: p1.x, y: p1.y, w: p1.w + 1, h: 1 }), '행상인이 비켜 서야');
  // 옮겼다가 처음 자리로 되돌리면 layout 에서 빠진다(그 농장의 처음 자리 기준)
  const wm = R.fixWorld(null, now); wm.farm = 1; wm.decor.lighthouse = { by: 'sua' };
  assert(R.moveThing(wm, sua, 'lighthouse', 20, 0).ok && wm.layout.lighthouse);
  assert(R.moveThing(wm, sua, 'lighthouse', 21, 0).ok && !wm.layout.lighthouse, '바닷가 등대 처음 자리는 (21,0)');
}
// 밭 모양 — 넓히기 차례마다 칸 수가 들판과 같고(12·24·40·60), 차례마다 한 덩어리에, 대각선으로만 닿는 칸이 없다(울타리가 꼬인다)
{
  R.FARMS.forEach((f, i) => {
    const wf = R.fixWorld(null, now); wf.farm = i;
    const C = R.fieldCells(wf);
    const came = id => { const F = R.DECOR[id] && R.DECOR[id].farm; return !F || R.FARMS.findIndex(x => x.id === F) <= i; };
    [0, 1, 2, 3].forEach(k => {
      wf.expand = k;
      const open = new Set(R.plotIds(wf, 'field')), has = (x, y) => open.has(x + ',' + y);
      assert.strictEqual(open.size, [12, 24, 40, 60][k], f.id + ' 넓히기 ' + k + ' 칸 수');
      const seen = new Set(), st = [[...open][0]];
      while (st.length){ const id = st.pop(); if (seen.has(id)) continue; seen.add(id); const [x, y] = id.split(',').map(Number); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (has(x + dx, y + dy)) st.push((x + dx) + ',' + (y + dy)); }); }
      assert.strictEqual(seen.size, open.size, f.id + ' 넓히기 ' + k + ' 한 덩어리');
      open.forEach(id => { const [x, y] = id.split(',').map(Number); [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
        if (has(x + dx, y + dy)) assert(has(x + dx, y) || has(x, y + dy), f.id + ' 넓히기 ' + k + ' ' + id + ' 대각선으로만 닿음'); }); });
    });
    assert(C.every(c => c.x >= 0 && c.y >= 0 && c.x < R.gridOf(wf).w && c.y < R.gridOf(wf).h - 1), f.id + ' 밭이 지도 밖');
    // 걸어 다닐 땅이 밭 때문에 조각나지 않는다 — 들판 네모 밭일 때보다 덩어리 수가 늘면 안 된다
    const parts = cellOk => {
      const all = I2.PLACE_IDS.filter(id => id !== 'path' && came(id)).map(id => R.spotOf(wf, id));
      const G = R.gridOf(wf), ok = (x, y) => x >= 0 && y >= 0 && x < G.w && y < G.h - 1 && cellOk(x, y) &&
        !all.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) && !Object.keys(R.NODES).some(n => { const q = R.nodeSpot(wf, n); return q.x === x && q.y === y; }) && !R.sceneryOf(wf).some(c => c.x === x && c.y === y);
      const seen = new Set(); let n = 0;
      for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++){
        if (!ok(x, y) || seen.has(x + ',' + y)) continue; n++;
        const st = [[x, y]]; while (st.length){ const [a, b] = st.pop(), id = a + ',' + b; if (seen.has(id) || !ok(a, b)) continue; seen.add(id); st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
      }
      return n;
    };
    // 집 앞에서 걸어 나갈 수 있어야 한다 — 집 앞 칸이 둘러막힌 틈이면 아이들이 거기 갇힌다(산골에서 겪음)
    {
      const all = I2.PLACE_IDS.filter(id => id !== 'path' && came(id)).map(id => R.spotOf(wf, id));
      const G = R.gridOf(wf), ok = (x, y) => x >= 0 && y >= 0 && x < G.w && y < G.h - 1 && !R.fieldHas(wf, x, y) &&
        !all.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) && !Object.keys(R.NODES).some(n => { const q = R.nodeSpot(wf, n); return q.x === x && q.y === y; }) && !R.sceneryOf(wf).some(c => c.x === x && c.y === y);
      let total = 0; for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) if (ok(x, y)) total++;
      const hs = R.spotOf(wf, 'house'); let start = null;
      for (let r = 0; r < 8 && !start; r++) for (let dy = -r; dy <= r && !start; dy++) for (let dx = -r; dx <= r && !start; dx++) if (ok(hs.x + 1 + dx, hs.y + hs.h + dy)) start = [hs.x + 1 + dx, hs.y + hs.h + dy];
      const seen = new Set(), st = [start];
      while (st.length){ const [a, b] = st.pop(), id = a + ',' + b; if (seen.has(id) || !ok(a, b)) continue; seen.add(id); st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
      assert(seen.size >= total * 0.6, f.id + ' 집 앞에서 갈 수 있는 땅이 ' + seen.size + '/' + total + '칸뿐');
    }
    const FB = R.FIELD_BOX, box = parts((x, y) => !(x >= FB.x && x < FB.x + FB.w && y >= FB.y && y < FB.y + FB.h)), shaped = parts((x, y) => !R.fieldHas(wf, x, y));
    assert(shaped <= box, f.id + ' 밭 모양이 길을 끊음(' + box + '→' + shaped + ')');
  });
}
// 이사 — 밭이 같은 차례끼리 새 모양으로 옮겨 심어진다. 커다란 작물 짝은 이웃이면 그대로, 아니면 풀린다
{
  const wm = R.fixWorld(null, now); wm.expand = 2;
  R.plotIds(wm, 'field').forEach((id, i) => { wm.plots[id] = { tilled: true, crop: i % 2 ? 'carrot' : null, progress: i }; });
  wm.plots['6,2'].giant = true; wm.plots['6,2'].pairOf = '7,2'; wm.plots['7,2'].giant = true; wm.plots['7,2'].pairOf = '6,2';
  wm.plots['g0,0'] = { tilled: true, crop: 'carrot' }; wm.sprinklers['6,3'] = { k: 'plain' };
  const before = R.fieldCells(wm).filter(c => wm.plots[c.id]).map(c => c.k + ':' + wm.plots[c.id].progress);
  Object.keys(R.DECOR).filter(d => !R.DECOR[d].farm).forEach(d => { wm.decor[d] = { by: 'sua' }; });
  const fillM = n => ['sua', 'yona', 'living'].forEach(r => { wm.house[r] = {}; for (let i = 0; i < n; i++) wm.house[r][i + ',0'] = { f: 'bed1', r: 0 }; });
  fillM(12); for (let i = 0; i < 10; i++) wm.animals.push({ id: 'y' + i, kind: 'duck', name: '오리' });
  const s2 = R.fixMine(null, 'sua'), y2 = R.fixMine(null, 'yona');
  assert(R.askMove(wm, s2, now).ok && R.askMove(wm, y2, now).moved, '바닷가로 이사');
  const after = R.fieldCells(wm).filter(c => wm.plots[c.id]).map(c => c.k + ':' + wm.plots[c.id].progress);
  assert.deepStrictEqual(after, before, '같은 차례·같은 순서로 옮겨 심음');
  assert(Object.keys(wm.plots).every(id => id[0] === 'g' || R.fieldHas(wm, ...id.split(',').map(Number))), '옮긴 칸은 모두 새 밭 안');
  assert(wm.plots['g0,0'] && wm.plots['g0,0'].crop === 'carrot', '온실은 그대로');
  assert.strictEqual(Object.keys(wm.sprinklers).length, 1);
  const gi = Object.keys(wm.plots).filter(id => wm.plots[id].giant);
  gi.forEach(id => { const q = wm.plots[wm.plots[id].pairOf]; assert(q && q.pairOf === id, '짝이 서로를 가리킴'); });
}
// 추억 — 먼저 묻는 아이가 꾸미개 하나를 고르면 새 농장에 그대로 서고, 다음 이사 때도 따라간다
{
  const wk = R.fixWorld(null, now), a = R.fixMine(null, 'sua'), b = R.fixMine(null, 'yona');
  const fillK = n => ['sua', 'yona', 'living'].forEach(r => { wk.house[r] = {}; for (let i = 0; i < n; i++) wk.house[r][i + ',0'] = { f: 'bed1', r: 0 }; });
  const ready = () => { Object.keys(R.DECOR).filter(d => !R.DECOR[d].farm || R.DECOR[d].farm === R.farmOf(wk).id).forEach(d => { if (!wk.decor[d]) wk.decor[d] = { by: 'sua' }; }); fillK(20); while (wk.animals.length < 16) wk.animals.push({ id: 'k' + wk.animals.length, kind: 'duck', name: '오리' }); };
  ready();
  assert(!R.askMove(wk, a, now, 'lighthouse').ok, '없는 꾸미개는 못 고른다');
  assert(R.askMove(wk, a, now, 'windmill').ok && wk.moveAsk.keep === 'windmill');
  assert(R.askMove(wk, b, now, 'pond').moved, '먼저 물은 아이가 고른 것');
  assert.deepStrictEqual(Object.keys(wk.decor), ['windmill']); assert.strictEqual(wk.decor.windmill.keep, 'meadow');
  assert(wk.past[0].decor.windmill && wk.past[0].decor.pond, '옛 농장 기록에는 그대로');
  ready();
  assert(!R.askMove(wk, a, now, 'windmill').ok, '이미 들고 온 추억은 또 고르지 않는다');
  assert(R.askMove(wk, a, now, 'lighthouse').ok && R.askMove(wk, b, now).moved);
  assert.deepStrictEqual(Object.keys(wk.decor).sort(), ['lighthouse', 'windmill'], '추억은 쌓인다');
  assert.strictEqual(wk.decor.lighthouse.keep, 'seaside');
  // 화산은 건너뛴다(2026-10-09) — 바닷가에서 바로 꽃구름으로, 건너뛴 화산의 아기 염소도 두루미와 함께 온다
  assert.strictEqual(R.farmOf(wk).id, 'cloud', '바닷가 다음은 꽃구름');
  assert(wk.animals.some(x => x.kind === 'goat' && x.baby) && wk.animals.some(x => x.kind === 'crane' && x.baby), '아기 염소와 두루미');
  assert.deepStrictEqual([0, 1, 3, 4].map(R.farmNo), [1, 2, 3, 4], '문패는 건너뛴 농장을 안 센다');
}
// 채집 나무·바위·덤불과 풍경도 옮긴다(2026-10-07) — 빈 칸으로만, 처음 자리로 돌리면 기록이 지워진다, 저장 뒤에도 남는다
{
  const wp = R.fixWorld(null, now), m = R.fixMine(null, 'sua'); wp.farm = 3;
  const free = (() => { for (let y = 0; y < 20; y++) for (let x = 0; x < 24; x++) if (!R.placeBlocked(wp, 'tree1', x, y)) return { x, y }; })();
  assert(free && R.moveThing(wp, m, 'tree1', free.x, free.y).ok, '채집 나무를 빈 칸으로 옮긴다');
  assert.deepStrictEqual(R.nodeSpot(wp, 'tree1'), free);
  const sc = R.sceneryOf(wp)[0];
  assert(!R.moveThing(wp, m, 'sc0', free.x, free.y).ok, '옮긴 나무 자리에는 못 놓는다');
  assert(!R.moveThing(wp, m, 'sc0', R.fieldCells(wp)[0].x, R.fieldCells(wp)[0].y).ok, '밭에는 못 놓는다');
  const w3 = R.fixWorld(JSON.parse(JSON.stringify(wp)), now);
  assert.deepStrictEqual(R.nodeSpot(w3, 'tree1'), free, '저장·불러오기 뒤에도 옮긴 자리');
  assert(R.moveThing(wp, m, 'sc0', sc.x, sc.y).ok && !wp.layout.sc0, '처음 자리면 기록하지 않는다');
  assert(!R.moveThing(wp, m, 'tree1', 99, 99).ok, '농장 밖으로는 못 옮긴다');
  assert(!R.moveThing(wp, m, 'nope', 1, 1).ok, '없는 것은 못 옮긴다');
}
// 스테이지2 — 꽃구름에서 오로라로 이사하면 아기 순록이 따라오고 오로라 도장을 받는다(2026-10-09)
{
  const wa = R.fixWorld(null, now), ms = R.fixMine(null, 'sua'), my = R.fixMine(null, 'yona'); wa.farm = 3;
  Object.keys(R.DECOR).forEach(d => { if (!R.DECOR[d].farm || R.DECOR[d].farm === 'cloud') wa.decor[d] = { by: 'sua' }; });
  ['sua', 'yona', 'living'].forEach(r => { wa.house[r] = {}; for (let i = 0; i < 22; i++) wa.house[r][i + ',0'] = { f: 'bed1', r: 0 }; });
  for (let i = 0; i < 17; i++) wa.animals.push({ id: 'y' + i, kind: 'duck', name: '오리' });
  assert(R.askMove(wa, ms, now).ok && R.askMove(wa, my, now).moved, '꽃구름 → 오로라 이사');
  assert.strictEqual(R.farmOf(wa).id, 'aurora');
  const baby = wa.animals[wa.animals.length - 1];
  assert(baby.kind === 'reindeer' && baby.baby, '오로라 새 식구는 아기 순록');
  assert(R.claimMedal(wa, ms, 'stampAurora', now).ok, '오로라 도장');
  assert(!R.moveState(wa, ms).next, '오로라가 지금 마지막 농장');
}
console.log('이사 규칙 점검 통과');
