// 2026-10-10 검수에서 고친 것 점검 — node tools/check-play.js
// 우편함 넘침 · 규칙 판 번호(옛 탭) · 큰 작물 수명 · 주문 게시판. (이사 막힘은 check-move.js 끝에)
global.FARM = require('../farm-rules.js');
require('../farm-rules-play.js');
const R = FARM, I = FARM.__inner, assert = require('assert'), fs = require('fs'), path = require('path');
const H = 3600e3, D = 24 * H, now = new Date(2026, 9, 10, 12).getTime();
const kids = () => ({ sua: Object.assign(R.fixMine(null, 'sua'), { xp: 99999, coins: 99999 }), yona: Object.assign(R.fixMine(null, 'yona'), { xp: 99999, coins: 99999 }) });

// ---------- 우편함: 넘치면 자매 쪽지만 오래된 것부터 지운다. 선물·상금은 안 지운다 ----------
{
  const w = R.fixWorld(null, now), { sua, yona } = kids();
  w.mail.yona.push({ id: 'coins', n: 2000, from: 'move', note: '이사 선물', t: now });
  w.mail.yona.push({ id: 'f:trophy', n: 1, from: 'festival', note: '트로피', t: now });
  w.mail.yona.push({ id: 'note', n: 1, from: 'postcard', farm: 'seaside', note: '그림엽서', t: now });
  // 쪽지 열다섯 통(하루 다섯 통 × 사흘) — 열두 통에 맞추되 선물·상금·그림엽서는 남는다
  for (let d = 0; d < 3; d++) for (let i = 0; i < R.__inner.NOTE_A_DAY; i++) assert(R.sendNote(w, sua, d + '-' + i, now + d * D + i).ok);
  const box = w.mail.yona, notes = box.filter(g => g.id === 'note' && g.from === 'sua').map(g => g.note);
  assert.strictEqual(box.length, 12, '쪽지로는 열두 통을 안 넘긴다');
  assert(box.some(g => g.from === 'move') && box.some(g => g.id === 'f:trophy') && box.some(g => g.from === 'postcard'), '선물·상금·그림엽서는 안 지운다');
  assert.deepStrictEqual(notes, ['1-1', '1-2', '1-3', '1-4', '2-0', '2-1', '2-2', '2-3', '2-4'], '오래된 쪽지부터 지운다');
  // 선물은 한도 없이 들어간다 — 그때도 지워지는 것은 쪽지뿐
  sua.inv['crop:radish'] = 30;
  for (let i = 0; i < 20; i++) assert(R.sendGift(w, sua, 'crop:radish', 1, '', now + 3 * D + i).ok);
  assert.strictEqual(sua.inv['crop:radish'], 10);
  assert.strictEqual(box.filter(g => g.id === 'crop:radish').length, 20, '선물 스무 통이 다 남는다');
  assert(box.some(g => g.from === 'move') && box.some(g => g.id === 'f:trophy') && box.some(g => g.from === 'postcard'));
  assert.strictEqual(box.filter(g => g.id === 'note' && g.from === 'sua').length, 0, '넘친 만큼 쪽지가 비켜 준다');
  // 쪽지를 다 치워도 자리가 없으면 쪽지는 안 받는다 — 우편함도 보낸 아이도 그대로
  const before = JSON.stringify([w.mail, sua, w.log]);
  const r = R.sendNote(w, sua, '안녕', now + 4 * D);
  assert(!r.ok && /가득/.test(r.msg), '가득 찬 우편함에는 쪽지를 못 넣는다');
  assert.strictEqual(JSON.stringify([w.mail, sua, w.log]), before, '거절이면 아무것도 안 바뀐다');
  // 다 받으면 하나도 빠짐없이 들어온다
  const c0 = yona.coins; assert(R.openMail(w, yona, now + 4 * D).ok);
  assert.strictEqual(yona.coins - c0, 2000); assert.strictEqual(yona.inv['crop:radish'], 20); assert.strictEqual(yona.inv['f:trophy'], 1);
  assert(R.sendNote(w, sua, '이제 돼?', now + 4 * D + 1).ok, '우편함을 비우면 다시 보낼 수 있다');
}
// 새 땅에 내린 날 — 이사 선물 + 금고 씨앗(스무 가지)이 한꺼번에 와도 자매의 선물 한 통에 사라지지 않는다
{
  const w = R.fixWorld(null, now), { sua } = kids();
  w.farm = R.FARMS.findIndex(f => f.id === 'ark');
  w.ark = { phase: 'flood', step: 10, month: I.ARK_TURNS - 1, food: 999, boardOn: '2026-09-01', seeds: R.CROP_IDS.slice(0, 20) };
  const r = R.arkMonth(w, sua, now); assert(r.ok && r.landed);
  assert.strictEqual(w.mail.yona.length, 21);
  sua.inv['crop:radish'] = 1; assert(R.sendGift(w, sua, 'crop:radish', 1, '', now + 1).ok);
  assert.strictEqual(w.mail.yona.filter(g => g.from === 'ark').length, 21, '방주에서 온 동전·씨앗이 그대로');
}
// 방주에 탈 때 우편으로 돌아오는 스프링클러 열네 대
{
  const w = R.fixWorld(null, now), { sua, yona } = kids();
  w.farm = R.FARMS.findIndex(f => f.id === 'ark'); w.ark = { step: 10, food: 300, seeds: [] };
  I.fieldCells(w).slice(0, 14).forEach((c, i) => { w.sprinklers[c.id] = { by: 'yona', k: i % 2 ? 'good' : undefined }; });
  R.arkBoard(w, sua, now); assert(R.arkBoard(w, yona, now + 1).ok);
  sua.inv['crop:radish'] = 3; for (let i = 0; i < 3; i++) assert(R.sendGift(w, sua, 'crop:radish', 1, '', now + 10 + i).ok);
  assert.strictEqual(w.mail.yona.filter(g => /sprinkler/.test(g.id)).length, 14, '스프링클러 열네 대가 다 남는다');
}

// ---------- 규칙 판 번호: 세이브에 rv 를 적고, 더 새 판의 번호는 낮추지 않는다 ----------
{
  assert(Number.isInteger(R.RULES_V) && R.RULES_V >= 1);
  assert.strictEqual(R.fixWorld(null, now).rv, R.RULES_V, '새 농장');
  // 옛 세이브(rv 없음)는 그대로 읽히고 번호만 붙는다
  const old = JSON.parse(JSON.stringify(R.fixWorld({}, now))); delete old.rv;
  old.house.sua['3,3'] = { f: 'chair', r: 1 }; old.decor.statue = { by: 'sua', on: '2026-09-28' }; old.animals.push({ id: 'a1', kind: 'chicken', name: '꼬꼬' });
  const again = R.fixWorld(JSON.parse(JSON.stringify(old)), now);
  assert.strictEqual(again.rv, R.RULES_V);
  { const a = Object.assign({}, again), b = Object.assign({}, old); delete a.rv; assert.deepStrictEqual(a, b, '옛 세이브는 rv 말고는 하나도 안 바뀐다'); }
  assert.strictEqual(R.fixWorld(Object.assign({}, old, { rv: R.RULES_V + 5 }), now).rv, R.RULES_V + 5, '더 새 판이 쓴 번호는 낮추지 않는다');
  ['x', -3, null, 0.4].forEach(v => assert.strictEqual(R.fixWorld(Object.assign({}, old, { rv: v }), now).rv, R.RULES_V, '깨진 번호는 지금 판으로'));
  assert.strictEqual(JSON.parse(JSON.stringify(R.fixWorld(JSON.parse(JSON.stringify(again)), now))).rv, R.RULES_V, '저장·불러오기 뒤에도');
}
/* 화면(pages/farm.js) — 세이브의 rv 가 더 크면 읽기 전에 멈추고 새로 고친다. 60초 안에 또 걸리면 새로 고치지 않고 안내만.
   브라우저 코드라 그 대목만 떼어 가짜 sessionStorage·location 으로 돌린다 */
{
  const src = fs.readFileSync(path.join(__dirname, '../pages/farm.js'), 'utf8');
  const lr = src.slice(src.indexOf('async function loadRows()'));
  const at = lr.indexOf('Number(farm.data.rv) > (R.RULES_V || 0)) return staleRules()');
  assert(at > 0 && at < lr.indexOf('R.fixWorld(farm'), 'loadRows 는 fixWorld 로 읽기 전에 판 번호를 본다');
  const a = src.indexOf('let halted = false;'), b = src.indexOf('// ---------- 시작 ----------');
  assert(a > 0 && b > a);
  const make = new Function('sessionStorage', 'location', 'now', 'stickMsg', src.slice(a, b) + '\nreturn { staleRules, halted: () => halted };');
  const run = (store, clock) => { const out = { reloads: 0, said: [] };
    out.api = make(store, { reload(){ out.reloads++; } }, () => clock.t, m => out.said.push(m)); return out; };
  const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); } }; };
  const store = mem(), clock = { t: now };
  let tab = run(store, clock);
  assert.strictEqual(tab.api.halted(), false);
  assert.strictEqual(tab.api.staleRules(), false, 'loadRows 가 그대로 돌려줄 값 — 읽기 실패로 친다');
  assert(tab.api.halted() && tab.reloads === 1 && !tab.said.length, '처음 걸리면 저장을 멈추고 새로 고친다');
  clock.t += 5000; tab = run(store, clock);                       // 새로 고쳤는데도 옛 파일이 왔다
  tab.api.staleRules();
  assert(tab.api.halted() && tab.reloads === 0 && /새 판이 나왔어요/.test(tab.said[0]), '60초 안에 또 걸리면 새로 고치지 않고 안내만');
  tab.api.staleRules(); assert.strictEqual(tab.reloads, 0);
  clock.t += 61000; tab = run(store, clock); tab.api.staleRules();
  assert.strictEqual(tab.reloads, 1, '60초가 지나면 다시 한 번 새로 고쳐 본다');
  // sessionStorage 를 못 쓰는 브라우저 — 되풀이를 못 막으니 새로 고치지 않는다
  tab = run({ getItem(){ throw new Error('막힘'); }, setItem(){ throw new Error('막힘'); } }, clock); tab.api.staleRules();
  assert(tab.api.halted() && tab.reloads === 0 && tab.said.length === 1);
  tab = run({ getItem: () => null, setItem(){ throw new Error('가득'); } }, clock); tab.api.staleRules();
  assert(tab.api.halted() && tab.reloads === 0 && tab.said.length === 1, '시각을 못 적으면 새로 고치지 않는다');
  // 저장 길은 commit 하나 — halted 면 올리지 않고, 행동도 받지 않는다
  const play = fs.readFileSync(path.join(__dirname, '../pages/farm-play.js'), 'utf8');
  assert.strictEqual(play.split("sb.rpc('farm_commit'").length - 1, 1, '저장 길은 하나');
  assert(/async function commit\(\)\{\n(  \/\/[^\n]*\n)?  if \(!key \|\| saving \|\| \(typeof halted !== 'undefined' && halted\)\) return;/.test(play), 'commit 첫머리가 halted 를 본다');
  assert(/function act\(fn, quiet\)\{\n(  \/\/[^\n]*\n)?  if \(typeof halted !== 'undefined' && halted\) return \{ ok: false/.test(play), 'act 첫머리가 halted 를 본다');
}

// ---------- 작물 수명: 하루 한 번 물을 주면 어떤 작물이든 시들기 전에 익는다 ----------
{
  const seasonStart = { spring: 0, summer: 1, autumn: 2, winter: 3 };
  // giant: 자매가 같은 날 옆 칸에 심어 합친 큰 작물. 아니면 한 아이가 한 칸만 심는다(수박·호박도 보통 것으로)
  function grow(crop, giant, everyH){
    const C = R.CROPS[crop], t0 = new Date(2026, 6, 1, 16).getTime();
    const w = R.fixWorld(null, t0), { sua, yona } = kids();
    if (C.farm) w.farm = R.FARMS.findIndex(f => f.id === C.farm);
    w.started = R.dayKey(t0 - seasonStart[C.season[0]] * w.seasonLen * D);        // 그 작물 첫 제철의 첫날에 심는다
    const cells = I.fieldCells(w), a = cells[0].id, b = cells[1].id;
    const who = giant ? [[sua, a], [yona, b]] : [[sua, a]];
    who.forEach(([m, id], i) => { m.inv['seed:' + crop] = 1; m.energy = 99; assert(R.till(w, m, id, t0).ok); const r = R.plant(w, m, id, crop, t0 + i); assert(r.ok, crop + ' 심기: ' + r.msg); });
    assert.strictEqual(!!w.plots[a].giant, giant, crop + (giant ? ' 합쳐져야' : ' 혼자 심으면 보통 작물'));
    for (let t = t0 + 2; t <= t0 + 30 * D; t += H){
      if ((t - t0 - 2) % (everyH * H) === 0) who.forEach(([m, id]) => { m.energy = 99; R.water(w, m, id, t); });
      who.forEach(([, id]) => I.tickPlot(w.plots[id], t, false));
      if (who.every(([, id]) => R.ripe(w.plots[id]))) return { ripe: true, days: (t - t0) / D };
      if (who.some(([, id]) => w.plots[id].wilted)) return { ripe: false, days: (t - t0) / D, at: Math.round(w.plots[a].progress / H) + '/' + Math.round(I.growTime(w.plots[a]) / H) + '시간' };
    }
    return { ripe: false, days: 30 };
  }
  let n = 0;
  R.CROP_IDS.forEach(crop => [false, true].forEach(giant => {
    if (giant && !R.CROPS[crop].giant) return;
    const r = grow(crop, giant, 24);
    assert(r.ripe, (giant ? '큰 ' : '') + R.CROPS[crop].name + ' — 하루 한 번 물로 익기 전에 시든다(' + r.days.toFixed(1) + '일, ' + r.at + ')');
    n++;
  }));
  assert(n === R.CROP_IDS.length + R.CROP_IDS.filter(c => R.CROPS[c].giant).length && n > R.CROP_IDS.length, '모든 작물 + 큰 작물을 봤다');
  // 큰 작물의 수명은 자라는 시간만큼(GIANT_TIME) 길다 — 그래도 끝은 있다: 물을 사흘에 한 번만 주면 시든다
  const lazy = grow('watermelon', true, 72); assert(!lazy.ripe && Math.abs(lazy.days - R.CROP_LIFE_DAYS * I.growTime({ crop: 'watermelon', giant: true }) / I.growTime({ crop: 'watermelon' })) < 0.1, '큰 수박도 게으르면 시든다');
  const lazy1 = grow('watermelon', false, 72); assert(!lazy1.ripe && Math.abs(lazy1.days - R.CROP_LIFE_DAYS) < 0.1, '보통 작물의 수명은 그대로 일주일');
  // 화면의 「며칠 뒤 시들어요」도 같은 수명을 쓴다
  const p = { crop: 'pumpkin', plantedAt: now, giant: true };
  assert(Math.abs(R.lifeLeft(p, now, false) - R.CROP_LIFE_DAYS * 1.6 * D) < 1); assert.strictEqual(R.lifeLeft(Object.assign({}, p, { giant: false }), now, false), R.CROP_LIFE_DAYS * D);
}

// ---------- 주문 게시판: 한 주(월~일) 동안 주문이 안 바뀐다 ----------
{
  const show = (w, t) => R.ordersOf(w, t).map(o => o.id + ' ' + o.crop + ' ' + o.n + ' ' + o.reward);
  // 실제 농장은 금요일(2026-09-04)에 시작해 금요일마다 계절이 바뀐다 — 계절 길이를 바꿔도(조정판) 같아야 한다
  [7, 5, 3].forEach(len => {
    const mon = new Date(2026, 9, 12, 12).getTime(), w = R.fixWorld(null, mon); w.started = '2026-09-04'; w.seasonLen = len;
    let changed = 0;
    for (let wk = 0; wk < 16; wk++){
      const t0 = mon + wk * 7 * D, first = show(w, t0);
      for (let d = 0; d < 7; d++) [0, 9, 23].forEach(h => assert.deepStrictEqual(show(w, new Date(2026, 9, 12 + wk * 7 + d, h).getTime()), first, '주중에 주문이 바뀐다 — ' + R.dayKey(t0) + ' 주 ' + d + '일째'));
      if (R.calendar(w, t0).season !== R.calendar(w, t0 + 6 * D).season) changed++;
      first.forEach(s => assert(R.CROPS[s.split(' ')[1]].season.indexOf(R.calendar(w, t0).season) >= 0, '월요일 계절의 작물'));
    }
    assert(changed > 0, '계절이 주중에 바뀌는 주를 실제로 지났다');
  });
  // 목요일에 낸 것이 금요일(계절 바뀐 날)에도 같은 주문에 붙어 있다
  const mon = new Date(2026, 9, 12, 12).getTime(), w = R.fixWorld(null, mon), { sua, yona } = kids(); w.started = '2026-09-04';
  const thu = mon + 3 * D, fri = mon + 4 * D, o1 = R.ordersOf(w, thu)[0];
  assert.notStrictEqual(R.calendar(w, thu).season, R.calendar(w, fri).season);
  sua.inv['crop:' + o1.crop] = o1.n; assert(R.fillOrder(w, sua, o1, o1.n - 1, thu).ok);
  const o2 = R.ordersOf(w, fri)[0];
  assert.deepStrictEqual([o2.id, o2.crop, o2.n, R.orderProgress(w, o2).got], [o1.id, o1.crop, o1.n, o1.n - 1]);
  // 주중에 이사해 심을 수 있는 작물(farmOk)이 바뀌어도, 한 번이라도 낸 주문은 그 작물 그대로다
  {
    const wm = R.fixWorld(null, mon); wm.started = '2026-09-04';
    const at = f => { wm.farm = R.FARMS.findIndex(x => x.id === f); return R.ordersOf(wm, thu); };
    // 농장을 옮기면 같은 번호의 작물이 달라지는 주문을 하나 찾는다(없으면 이 점검이 헛돈다)
    const pairs = []; R.FARMS.forEach(a => R.FARMS.forEach(b => { if (a.id === b.id || a.id === 'ark' || b.id === 'ark') return; const A = at(a.id), B = at(b.id); A.forEach((o, i) => { if (o.crop !== B[i].crop) pairs.push([a.id, b.id, i]); }); }));
    assert(pairs.length, '이사로 주문 작물이 달라지는 경우가 있다');
    const [fa, fb, i] = pairs[0], o = at(fa)[i];
    sua.inv['crop:' + o.crop] = 1; assert(R.fillOrder(wm, sua, o, 1, thu).ok);
    const after = at(fb)[i];
    assert.deepStrictEqual([after.id, after.crop, R.orderProgress(wm, after).got], [o.id, o.crop, 1], fa + '→' + fb + ' 이사 뒤에도 낸 주문은 그 작물');
    // 굳은 주문에 다른 작물을 든 옛 화면이 보태려 하면 받지 않는다 — 가방도 그대로
    const other = R.CROP_IDS.find(c => c !== o.crop); yona.inv['crop:' + other] = 5;
    const r = R.fillOrder(wm, yona, Object.assign({}, after, { crop: other }), 1, thu);
    assert(!r.ok && yona.inv['crop:' + other] === 5 && R.orderProgress(wm, after).got === 1, '엉뚱한 작물은 안 붙는다');
    assert.strictEqual(R.fixWorld(JSON.parse(JSON.stringify(wm)), thu).orders[o.id].crop, o.crop, '저장·불러오기 뒤에도 굳은 작물이 남는다');
  }
  // 옛 세이브의 주문 기록(작물이 안 적힌 것)도 그대로 이어서 채운다
  {
    const wo = R.fixWorld(null, mon), o = R.ordersOf(wo, mon)[1]; wo.orders[o.id] = { got: 1, by: { yona: 1 }, done: false };
    assert.strictEqual(R.orderProgress(wo, R.ordersOf(wo, mon)[1]).got, 1);
    sua.inv['crop:' + o.crop] = o.n; const r = R.fillOrder(wo, sua, o, o.n - 1, mon);
    assert(r.ok && r.done && wo.orders[o.id].crop === o.crop && wo.mail.yona.some(g => g.from === 'board'), '옛 기록에 보태 완성 — 자매 몫은 우편함으로');
  }
}
console.log('놀이 규칙(우편함·판 번호·작물 수명·주문) 점검 통과');
