// 모험단 저장 점검: node tools/check-quest.js — 조용히 끝나면 통과.
// pages/quest.js 는 화면(캔버스·DOM)에 묶여 있어 통째로 못 부른다. 「저장」 대목만 글자로 떼어
// 가짜 서버(sb)에 물려 돌린다 — 판 번호(rev) 겹침 검사, 실패 뒤 재시도, 다른 기기 것 불러오기.
// 화면 쪽(전투 접기의 그림, 알림 띠의 모양, 실제 PostgREST·로그인)은 여기서 못 본다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Q = require('../quest-rules.js');

const src = fs.readFileSync(path.join(__dirname, '../pages/quest.js'), 'utf8');
const A = '// ---------- 저장 ----------', B = '// ---------- 시작 ----------';
assert.ok(src.indexOf(A) >= 0 && src.indexOf(B) > src.indexOf(A), '저장 대목을 못 찾음');
const section = src.slice(src.indexOf(A), src.indexOf(B));
const copy = x => JSON.parse(JSON.stringify(x));
const DAY = '2026-10-10';

// ---------- 가짜 서버: quest_saves 한 표, PostgREST 가 하는 만큼만 ----------
function fakeServer(){
  const S = { rows: {}, fail: null, dropAck: false, deny: false, log: [] };
  const rev = r => (r.data.rev == null ? null : String(r.data.rev));
  S.sb = { from: () => {
    const q = { op: 'select', f: {} };
    const api = {
      select(c){ if (q.op === 'select') q.cols = c; else q.ret = c; return api; },
      insert(r){ q.op = 'insert'; q.row = copy(r); return api; },
      update(r){ q.op = 'update'; q.row = copy(r); return api; },
      eq(c, v){ q.f[c] = { eq: v }; return api; },
      is(c, v){ q.f[c] = { is: v }; return api; },
      maybeSingle(){ q.one = true; return api; },
      then(ok, no){ return Promise.resolve().then(run).then(ok, no); },
    };
    function run(){
      S.log.push(q.op + (q.cols ? ':' + q.cols : ''));
      if (S.fail) return { data: null, error: S.fail };
      const who = q.op === 'insert' ? q.row.who : q.f.who.eq, cur = S.rows[who];
      if (q.op === 'select'){
        if (!cur) return { data: null, error: null };
        return { data: /^rev:/.test(q.cols) ? { rev: rev(cur) } : copy({ data: cur.data, prev_day: cur.prev_day || null }), error: null };
      }
      if (q.op === 'insert'){
        if (cur) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        S.rows[who] = q.row;
      } else {
        const f = q.f['data->>rev'];
        assert.ok(f, '판 번호 조건 없이 고쳤다');
        const hit = !S.deny && cur && (('is' in f) ? rev(cur) === null : rev(cur) === f.eq);
        if (!hit) return { data: [], error: null };
        S.rows[who] = Object.assign(cur, q.row);
      }
      if (S.dropAck){ S.dropAck = false; return { data: null, error: { message: 'Failed to fetch' } }; }
      return { data: q.ret ? [{ who }] : null, error: null };
    }
    return api;
  } };
  return S;
}

// ---------- 저장 대목을 가짜 화면에 물린다 ----------
function mount(S){
  const timers = [], notices = [], els = { saveWarn: { hidden: true }, battleCard: { hidden: true } };
  const env = {
    Q, sb: S.sb, escapeHTML: x => String(x), readableError: e => (e && e.message) || String(e), today: () => DAY,
    $: sel => els[sel.slice(1)] || null, notice: h => notices.push(h), renderAll(){}, loopOff(){},
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: id => { if (id) timers[id - 1] = null; },
    document: { hidden: false, addEventListener(){} }, window: { addEventListener(){} }, navigator: { onLine: true },
  };
  const G = new Function(...Object.keys(env), `
    let key = 'yona', hero = Q.HEROES.yona, save = null, st = null, dayStart = null, battle = null,
        timing = null, fx = [], fairyAt = 0, friendAt = 0, chestAt = 0;
    const saves = {}, backups = {};
    const refreshStats = () => { st = Q.stats(save, {}); };
    const wait = async () => { if (battle) battle.busy = false; };
    ${section}
    return {
      persist, onTab, openSave, saves, backups,
      get save(){ return save; }, get dayStart(){ return dayStart; }, get dirty(){ return dirty; },
      get fails(){ return saveFails; }, get battle(){ return battle; }, set battle(v){ battle = v; },
      set hasRow(v){ hasRow = v; }, mark(){ dirty = true; },
      settle: async () => { let c; do { c = saveChain; await c; } while (c !== saveChain); },
    };`)(...Object.values(env));
  G.notices = notices; G.els = els;
  G.timers = () => timers.filter(Boolean);
  G.fire = async () => { const t = timers.findIndex(Boolean), x = timers[t]; timers[t] = null; x.fn(); await G.settle(); };
  // 열기: 서버 줄이 있으면 그것으로, 없으면 새 세이브
  G.boot = () => { const r = S.rows.yona; G.hasRow = !!r; G.backups.yona = { has: !!(r && r.prev_day), day: (r && r.prev_day) || null }; G.openSave(r ? Q.fixSave(copy(r.data)) : Q.newSave()); return G; };
  G.save1 = async () => { G.persist(true); await G.settle(); };
  return G;
}
const legacy = () => Object.assign(Q.newSave(), { gold: 100, lastPlay: DAY });   // 번호가 없던 옛 세이브

(async () => {
  // 1) 옛 세이브(rev 없음)의 첫 저장 — 「번호가 없을 때만」 조건으로 들어가고 1번이 된다
  let S = fakeServer(); S.rows.yona = { who: 'yona', data: legacy(), prev_day: '2026-10-09' };
  let G = mount(S).boot();
  G.save.gold = 130; await G.save1();
  assert.strictEqual(S.rows.yona.data.rev, 1);
  assert.strictEqual(S.rows.yona.data.gold, 130);
  assert.strictEqual(S.rows.yona.prev_day, DAY);                        // 오늘 첫 저장이라 아침 사본이 딸려 간다
  assert.strictEqual(S.rows.yona.prev.gold, 100);                       // 손대기 전 모습
  assert.ok(!('rev' in S.rows.yona.prev));
  const prev1 = S.rows.yona.prev;
  G.save.gold = 140; await G.save1();
  assert.strictEqual(S.rows.yona.data.rev, 2);
  assert.strictEqual(S.rows.yona.prev, prev1);                          // 하루에 한 번만
  assert.strictEqual(G.notices.length, 0);
  assert.strictEqual(G.els.saveWarn.hidden, true);

  // 2) 줄이 아예 없을 때(처음 시작)만 새로 넣는다
  S = fakeServer(); G = mount(S).boot();
  await G.settle();
  G.save.gold = 55; await G.save1();
  assert.deepStrictEqual(S.log.filter(x => x !== 'update'), ['insert']);
  assert.strictEqual(S.rows.yona.data.rev, 1);
  G.save.gold = 56; await G.save1();
  assert.strictEqual(S.rows.yona.data.rev, 2);
  assert.strictEqual(S.rows.yona.data.gold, 56);

  // 3) 실패 — 알리고, 못 올린 것을 기억했다가 다시 올린다
  S = fakeServer(); S.rows.yona = { who: 'yona', data: Object.assign(legacy(), { rev: 7 }), prev_day: DAY };
  G = mount(S).boot();
  S.fail = { message: 'Failed to fetch' };
  G.save.gold = 200; await G.save1();
  assert.strictEqual(S.rows.yona.data.gold, 100);
  assert.strictEqual(G.dirty, true);
  assert.strictEqual(G.notices.length, 1);
  assert.ok(/저장하지 못했어요: 지금은 인터넷에 닿지 않아요/.test(G.notices[0]));
  assert.strictEqual(G.els.saveWarn.hidden, false);                     // 띠가 남는다
  assert.deepStrictEqual(G.timers().map(t => t.ms), [15000]);
  await G.fire();                                                       // 15초 뒤 — 아직도 안 된다
  assert.strictEqual(G.notices.length, 1);                              // 알림은 한 번만
  assert.strictEqual(G.els.saveWarn.hidden, false);
  assert.deepStrictEqual(G.timers().map(t => t.ms), [30000]);           // 간격이 늘어난다
  S.fail = null;
  G.onTab(false); await G.settle();                                     // 신호가 돌아왔다(online)
  assert.strictEqual(S.rows.yona.data.gold, 200);
  assert.strictEqual(S.rows.yona.data.rev, 8);
  assert.strictEqual(G.els.saveWarn.hidden, true);                      // 성공하면 걷힌다
  assert.strictEqual(G.fails, 0);
  assert.strictEqual(G.dirty, false);
  assert.strictEqual(G.timers().length, 0);

  // 4) 겹침 — 낡은 탭이 덮지 못하고, 서버 것을 불러온다
  S = fakeServer(); S.rows.yona = { who: 'yona', data: Object.assign(legacy(), { rev: 3 }), prev_day: '2026-10-09' };
  G = mount(S).boot();                                                  // 태블릿: 3번을 읽어 둔 채 열려 있다
  Object.assign(S.rows.yona.data, { rev: 9, gold: 900, sync: 'phone' }); // 그 사이 폰에서 9번까지 갔다
  G.save.gold = 1;                                                      // 태블릿에서 한 번 누른다
  await G.save1();
  await G.settle();
  assert.strictEqual(S.rows.yona.data.gold, 900);                       // 폰에서 한 것이 남는다
  assert.strictEqual(G.save.gold, 900);                                 // 화면도 그쪽 것으로
  assert.strictEqual(G.saves.yona, G.save);
  assert.ok(/다른 기기에서 이어서 했어요/.test(G.notices[0]));
  assert.strictEqual(G.dayStart.gold, 900);                             // 아침 사본도 낡은 것이 아니다
  G.save.gold = 950; await G.save1();
  assert.strictEqual(S.rows.yona.data.rev, 10);
  assert.strictEqual(S.rows.yona.prev.gold, 900);
  assert.strictEqual(S.rows.yona.prev_day, DAY);

  // 5) 탭을 다시 볼 때 — 번호가 같으면 번호만 묻고, 다르면 누르기 전에 불러온다
  S.log.length = 0; G.notices.length = 0;
  G.onTab(true); await G.settle();
  assert.deepStrictEqual(S.log, ['select:rev:data->>rev']);
  Object.assign(S.rows.yona.data, { rev: 11, gold: 5, sync: 'phone2' });
  G.onTab(true); await G.settle();
  assert.strictEqual(G.save.gold, 5);
  assert.strictEqual(G.notices.length, 1);
  // 부모가 그날 아침으로 되돌렸다(번호가 뒤로 간다) — 그것도 불러온다
  S.rows.yona.data = copy(S.rows.yona.prev);
  G.save.gold = 777; await G.save1(); await G.settle();
  assert.strictEqual(S.rows.yona.data.gold, 900);
  assert.strictEqual(G.save.gold, 900);

  // 6) 답을 못 받은 내 저장 — 남의 것으로 치지 않고 이어서 올린다
  S = fakeServer(); S.rows.yona = { who: 'yona', data: Object.assign(legacy(), { rev: 1 }), prev_day: DAY };
  G = mount(S).boot();
  S.dropAck = true;
  G.save.gold = 300; await G.save1();                                   // 서버에는 들어갔는데 답이 끊겼다
  assert.strictEqual(S.rows.yona.data.rev, 2);
  assert.strictEqual(G.dirty, true);
  G.save.gold = 310;                                                    // 그 뒤에 한 일
  await G.fire(); await G.settle();
  assert.strictEqual(S.rows.yona.data.gold, 310);                       // 버려지지 않는다
  assert.strictEqual(S.rows.yona.data.rev, 3);
  assert.ok(!G.notices.some(n => /다른 기기/.test(n)));
  assert.strictEqual(G.els.saveWarn.hidden, true);

  // 7) 번호는 맞는데 서버가 안 받아 준다(로그인이 풀림) — 화면을 되돌리지 않고 실패로 알린다
  S = fakeServer(); S.rows.yona = { who: 'yona', data: Object.assign(legacy(), { rev: 4 }), prev_day: DAY };
  G = mount(S).boot();
  S.deny = true;
  G.save.gold = 400; await G.save1();
  assert.strictEqual(G.save.gold, 400);
  assert.strictEqual(G.dirty, true);
  assert.strictEqual(G.els.saveWarn.hidden, false);
  assert.strictEqual(S.rows.yona.data.gold, 100);

  // 8) 처음 시작인 줄 알았는데 줄이 이미 있다 — 덮지 않고 불러온다
  S = fakeServer(); G = mount(S).boot();
  await G.settle();
  S.rows.yona = { who: 'yona', data: Object.assign(legacy(), { rev: 2, gold: 88 }), prev_day: DAY };
  S.log.length = 0;
  G.save.gold = 1; G.hasRow = false; await G.save1(); await G.settle();
  assert.strictEqual(S.log[0], 'insert');
  assert.strictEqual(S.rows.yona.data.gold, 88);
  assert.strictEqual(G.save.gold, 88);

  // 9) 전투 중에 불러오게 되면 턴이 끝나기를 기다렸다가 전투를 접는다
  S = fakeServer(); S.rows.yona = { who: 'yona', data: Object.assign(legacy(), { rev: 1 }), prev_day: DAY };
  G = mount(S).boot();
  Object.assign(S.rows.yona.data, { rev: 2, gold: 9 });
  G.battle = { busy: true }; G.els.battleCard.hidden = false;
  G.mark(); G.onTab(false); await G.settle();
  assert.strictEqual(G.battle, null);
  assert.strictEqual(G.els.battleCard.hidden, true);
  assert.strictEqual(G.save.gold, 9);

  // ---------- 금화 선물(quest-rules.js) — 가득이면 거절, 금화는 그대로 ----------
  let tick = 1760000000000; Date.now = () => tick++;                    // 선물 번호는 보낸 시각(ms)이다 — 한 번에 하나씩 보낸 것처럼
  const me = Object.assign(Q.newSave(), { gold: 5000 }), sis = Q.newSave();
  for (let i = 0; i < Q.SEND.keep; i++) assert.ok(Q.sendGold(me, 100, DAY, sis).id);
  assert.deepStrictEqual(Q.sendGold(me, 100, DAY, sis), { full: true });
  assert.strictEqual(me.gold, 5000 - 100 * Q.SEND.keep);                // 못 보낸 몫은 안 빠진다
  assert.strictEqual(me.outbox.length, Q.SEND.keep);
  assert.strictEqual(Q.claimGifts(sis, me), 100 * Q.SEND.keep);         // 하나도 안 사라졌다
  const first = me.outbox[0].id;
  assert.ok(Q.sendGold(me, 300, DAY, sis).id);                          // 받아 간 것부터 비우고 보낸다
  assert.strictEqual(me.outbox.length, Q.SEND.keep);
  assert.ok(!me.outbox.some(g => g.id === first));
  assert.strictEqual(Q.claimGifts(sis, me), 300);                       // 새것만, 한 번만
  assert.strictEqual(Q.claimGifts(sis, me), 0);
  assert.strictEqual(Q.sendGold(me, 50, DAY, sis), null);               // 틀린 금액은 예전대로
})().catch(e => { console.error(e); process.exit(1); });
