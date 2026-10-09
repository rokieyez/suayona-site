// farm.html 의 놀이 화면 코드 — 가게·가방·집 조작·도감·저장.
// pages/farm.js 가 로그인한 사람에게만 받아 온다(loadPlay). 손님은 이 파일을 안 받는다.
// 최상위 let/const 는 farm.js 것을 그대로 쓴다 — 고전 스크립트라 전역 렉시컬 환경이 하나다.

// 오늘 날짜를 이 자리 시각으로. toISOString 은 협정시라 한국 00~09시에는 어제가 된다.
function todayISO(){ const d = new Date(), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }

/* 답을 못 받은 저장들. 창을 덮는 순간 보낸 저장은 서버에 들어가도 페이지가 얼어서 답을
   못 받을 수 있다. 그러면 판 번호가 뒤처져 다음 저장이 겹치는데, 그때 옛 기준점에서
   다시 하면 이미 올라간 수확·판매가 「못 한 일」로 버려져 돈과 작물이 줄었다.
   저장마다 표식(sync)을 붙여 두고, 서버 줄의 표식이 이 중 하나면 그만큼은 올라간 것으로 친다. */
let unacked = [];
function persist(){ clearTimeout(saveTimer); saveTimer = setTimeout(commit, 600); }
/* 서버에서 막 읽은 내 줄 위에서 못 올라간 행동을 다시 한다. 되돌린 가짓수를 돌려준다. */
function rebase(fresh){
  const hit = unacked.find(u => u.tag === fresh.sync);
  if (hit) pending.splice(0, hit.sent);      // 이미 서버에 있는 몫
  unacked = [];
  const redo = pending; pending = [];
  M = clone(fresh); Mbase = clone(fresh);
  let dropped = 0;
  redo.forEach(fn => { try { const r = fn(W, M); if (r && r.ok) pending.push(fn); else dropped++; } catch (e) { dropped++; } });
  if (pending.length) dirty = true;
  return dropped;
}
async function commit(){
  if (!key || saving) return;
  saving = true;
  try {
    for (let tries = 0; tries < 3; tries++){
      // 보내는 순간의 모습을 적어 둔다 — 답을 기다리는 사이에 한 일은 다음 차례에 올린다
      dirty = false;
      const sent = pending.length, tag = Math.random().toString(36).slice(2, 10);
      M.sync = tag;
      const sentM = clone(M);
      unacked.push({ tag, sent });
      const { data, error } = await sb.rpc('farm_commit', { p_world: W, p_rev: REV, p_mine: M });
      if (error){
        // 인터넷이 끊긴 것이면 행동은 그대로 두고 조금 뒤에 다시 올린다. 돌아오면 저절로.
        const off = !navigator.onLine || error.offline || /fetch|network|load failed/i.test(error.message || '');
        flash(off ? '지금은 인터넷에 닿지 않아요. 한 일은 기억해 두었다가 연결되면 올려요' : '저장하지 못했어요: ' + readableError(error), true);
        if (off){ clearTimeout(saveTimer); saveTimer = setTimeout(commit, 15000); }
        break;
      }
      if (data >= 0){
        REV = data; Mbase = sentM; unacked = [];
        pending.splice(0, sent);
        if (pending.length) dirty = true;
        break;
      }
      // 겹쳤다 — 다시 읽고, 못 올라간 행동을 새 농장 위에서 다시.
      const fresh = await loadRows();
      if (!fresh) break;
      let dropped;
      if (fresh.mine) dropped = rebase(fresh.mine);
      else {                                   // 옛 farm.js 와 섞여 받은 경우 — 예전 방식 그대로
        const redo = pending.slice(); pending = [];
        M = clone(Mbase); dropped = 0;
        redo.forEach(fn => { try { const r = fn(W, M); if (r && r.ok) pending.push(fn); else dropped++; } catch (e) { dropped++; } });
      }
      if (dropped) flash('다른 곳에서 먼저 바뀐 게 있어서 ' + dropped + '가지는 되돌렸어요', true);
      renderAll();
      if (!pending.length){ dirty = false; break; }
    }
  } finally {
    saving = false;
    // 창이 덮인 채 끝났으면 기다리지 않는다 — 곧 얼어서 타이머가 안 돌 수 있다
    if (dirty){ if (document.hidden) commit(); else persist(); }
  }
}
/* 뒤로 가기로 되살아난 페이지는 부팅을 안 거친다. 그 사이 서버가 앞서 있을 수 있으니 맞춘다. */
async function resync(){
  if (!key || !W || saving) return;
  if (pending.length){ clearTimeout(saveTimer); commit(); return; }
  const fresh = await loadRows();
  if (!fresh || !fresh.mine || saving) return;
  rebase(fresh.mine);
  if (pending.length) persist();
  tickAll();
  renderAll();
}
function act(fn, quiet){
  const r = fn(W, M);
  if (!quiet) flash(r.msg, !r.ok);
  if (r.ok){ pending.push(fn); dirty = true; persist(); renderAll(); }
  return r;
}
function daily(w, m){
  const today = R.dayKey(now());
  let changed = false;
  // 아침 소식은 한 줄씩 모았다가 마지막에 한 번만 건다. 부를 때마다 notice 를 부르면
  // 뒤의 소식이 앞의 소식을 지워서, 비료나 선물이 온 날엔 날씨·동물 소식이 사라졌다.
  const says = [];
  if (w.dayKey !== today){
    w.dayKey = today;
    const notes = R.newDay(w, m, now());
    if (notes.length) says.push(notes.join(' · '));
    changed = true;
  }
  if (R.refreshEnergy(w, m, now())) changed = true;
  // 일기 → 비료는 뺐다(2026-09-17 부모 요청). 이미 받은 비료는 그대로 두고, 비료는 가게에서 산다. 일기의 현실 연동은 인생 퀘스트·모험단에 남아 있다
  // 모험단 원정에서 주워 온 씨앗 — 이 계절에 심을 수 있는 것으로 온다
  const seeds = R.seedsFromExpo(w, m, expoSeedsEver, now());
  if (seeds.length){
    says.push('🌱 모험단 원정에서 <b>' + seeds.map(c => R.CROPS[c].name).join(' · ') + '</b> 씨앗이 왔어요');
    changed = true;
  }
  const g = R.claimParentGift(m, TUNE);
  if (g){ says.push('부모님이 ' + g.coins + ' 동전을 보냈어요' + (g.note ? ' — "' + escapeHTML(g.note) + '"' : '')); changed = true; }
  if (m.lastPlay !== today){ R.markPlayed(m, now()); changed = true; }
  // 내일 비가 오면 오늘의 계획이 달라진다 — 스타듀밸리의 일기예보 자리다.
  // (배포 어긋남 대비: 옛 farm-rules.js 와 짝이 되면 그냥 건너뛴다)
  if (R.forecast){
    const f = R.forecast(w, now());
    if (f.wet || f.weather === 'snow') says.push('내일은 ' + f.icon + ' <b>' + f.name + '</b>' +
      (f.wet ? ' — 아침에 밭이 저절로 촉촉해져요' : ''));
  }
  // 어제 한 일은 맨 앞에 — 「어제 이만큼 했지」로 하루가 시작되게
  if (R.yesterdayNote){ const y = R.yesterdayNote(m, now()); if (y) says.unshift(y); }
  if (says.length){
    notice(says.join('<br>'));
    // 아침 소식 중 가장 반가운 것을 소리로도 알린다 — 글을 아직 잘 못 읽는 아이를 위해
    const joined = says.join(' ');
    sfx(/새끼를 낳았어요/.test(joined) ? 'chick' : /원정|행상인/.test(joined) ? 'cart'
      : /스프링클러/.test(joined) ? 'sprinkle' : 'prop');
  }
  return { ok: changed };
}
async function renderTune(){
  const card = $('#tuneCard'); card.hidden = false;
  const { data } = await sb.from('farm_saves').select('who, data').eq('who', 'tune');
  TUNE = R.fixTune(data && data[0] ? data[0].data : null);
  $('#tLen').value = TUNE.seasonLen; $('#tLenV').textContent = TUNE.seasonLen + '일';
  $('#tLen').addEventListener('input', () => { $('#tLenV').textContent = $('#tLen').value + '일'; });
  $('#tSave').addEventListener('click', async () => {
    const t = clone(TUNE); t.seasonLen = Number($('#tLen').value);
    const coins = Number($('#tGiftCoins').value) || 0;
    if (coins > 0){ t.gift = t.gift || {}; t.gift[$('#tGiftWho').value] = { id: 'g' + Date.now(), coins: Math.min(1000, coins), note: $('#tGiftNote').value.trim() }; }
    const { data: rows, error } = await sb.from('farm_saves').upsert({ who: 'tune', data: t }, { onConflict: 'who' }).select('who');
    $('#tMsg').textContent = error ? '저장하지 못했어요: ' + readableError(error) : (!rows || !rows.length) ? '저장되지 않았어요. 부모로 로그인했는지 확인해 주세요.' : '저장했어요' + (coins > 0 ? ' · 선물은 다음에 열 때 받아요' : '');
    if (!error && rows && rows.length){ TUNE = t; $('#tGiftCoins').value = ''; $('#tGiftNote').value = ''; }   // 같은 봉투를 또 만들지 않게 칸을 비운다
  });
  await renderUndo();
  $('#tReset').addEventListener('click', async () => {
    if (!confirm('농장과 두 아이의 가방을 모두 지울까요? 되돌릴 수 없어요.')) return;
    if (!confirm('정말요? 지은 건물과 가구도 다 사라져요.')) return;
    const { data: rows, error } = await sb.from('farm_saves').delete().in('who', ['farm', 'sua', 'yona']).select('who');
    $('#tMsg').textContent = error ? '지우지 못했어요: ' + readableError(error) : '지웠어요 (' + ((rows || []).length) + '줄)';
  });
}
// 되돌릴 것이 있는지 물어보고 단추를 켠다. 세이브 알맹이는 받지 않는다 —
// farm_restore_info 는 「누구 것이 언제 것인지」만 준다.
async function renderUndo(){
  const box = $('#tUndo'), btn = $('#tUndoBtn'), when = $('#tUndoWhen');
  if (!box) return;
  const { data, error } = await sb.rpc('farm_restore_info');
  if (error) return;                                   // 옛 서버면 그냥 안 보여 준다
  box.hidden = false;
  const 밭 = (data || []).find(r => r.who === 'farm');
  const 있음 = !!(밭 && 밭.has_prev);
  btn.disabled = !있음;
  when.textContent = 있음
    ? formatDate(밭.prev_day) + ' 아침 것이 있어요'
    : '되돌릴 것이 아직 없어요';
  btn.addEventListener('click', async () => {
    if (!confirm('농장을 그날 아침으로 되돌릴까요? 그 뒤에 심고 판 것은 사라져요.')) return;
    btn.disabled = true;
    $('#tMsg').textContent = '되돌리는 중…';
    const { data: ok, error: err } = await sb.rpc('farm_restore');
    if (err){ btn.disabled = false; $('#tMsg').textContent = '안 됐어요: ' + readableError(err); return; }
    $('#tMsg').textContent = ok
      ? '되돌렸어요. 아이가 다시 열면 그날 아침 농장이에요.'
      : '되돌릴 것이 없었어요.';
  });
}
// ---------- 위쪽 띠 ----------
function syncTop(){
  const cal = R.calendar(W, now()), wk = R.weatherOf(R.dayKey(now()), cal.season);
  // 때는 농장 그림과 같은 시계를 본다 — 화면이 어두운데 「낮」이라고 적히면 어긋난다
  const L = dayLight(), h = L.hour;
  const when = h < 5 ? '한밤' : h < 7 ? '새벽' : h < 11 ? '아침' : h < 16 ? '낮' : h < 18.5 ? '해질참' : h < 20.5 ? '저녁' : '밤';
  const night = L.dark > 0.16;
  if (R.farmOf){ const F = R.farmOf(W), h1 = document.querySelector('.section-head h1'); if (h1) h1.textContent = W.farm ? '수아연아 ' + F.name : '수아연아 농장'; }
  syncMoveHint();
  syncPast();
  syncTodo();
  checkArrival();
  $('#cSeason').textContent = R.SEASON_ICON[cal.season] + ' ' + R.SEASON_NAME[cal.season] + ' ' + cal.dayOfSeason + '/' + cal.len + '일 · ' + cal.year + '년째';
  const cw = $('#cWeather');
  const fc = R.forecast ? R.forecast(W, now()) : null;
  cw.textContent = R.WEATHER[wk].icon + ' ' + R.WEATHER[wk].name + ' · ' + when + (cal.lastDay ? ' · 축제!' : '')
    + (fc ? ' · 내일 ' + fc.icon : '');
  // 진짜 서울 날씨를 받아 온 날은 그렇다고 알려 준다 — 창밖과 화면이 같다는 걸 알아야 재밌다
  const real = R.skyOf ? R.skyOf(R.dayKey(now())) : null;
  cw.title = (real ? '서울 오늘 날씨예요' + (fc ? ' · ' : '') : '') + (fc ? '내일은 ' + fc.name : '');
  cw.classList.toggle('night', night);
  const mx = R.maxEnergy(W, M);
  $('#enFill').style.width = Math.round(100 * M.energy / mx) + '%'; $('#enText').textContent = M.energy + '/' + mx;
  $('#coins').textContent = M.coins;
  const lv = R.levelOf(M.xp), a = R.xpForLevel(lv), b = R.xpForLevel(lv + 1);
  $('#lv').textContent = lv; $('#xpFill').style.width = Math.max(0, Math.min(100, Math.round(100 * (M.xp - a) / (b - a)))) + '%';   // 레벨 20 위로 쌓인 경험치가 막대를 넘쳤다
  const n = (W.mail[key] || []).length; $('#mailN').hidden = !n; $('#mailN').textContent = n;
  const waiting = duoWaiting(); $('#duoN').hidden = !waiting; $('#duoN').textContent = waiting;
  const an = $('#arkN'); if (an){ const aw = arkWaiting(); an.hidden = !aw; an.textContent = aw; }
}
// 농장 위 이사 알림 — 「꾸미개 N개만 더 놓으면 새 농장으로」. 누르면 가게 꾸미기 칸이 열린다.
function syncMoveHint(){
  const el = $('#moveHint'); if (!el || !R.moveState) return;
  if (!el.dataset.on){
    el.dataset.on = 1;
    el.addEventListener('click', () => { if (el.dataset.mode === 'ark'){ openTab('ark', true); return; } const n = R.moveState(W, M); shopTab = 'deco'; openTab(n.ready || n.ask ? 'duo' : 'shop', true); });
  }
  // 방주 이야기(2026-10-09) — 방주 농장부터는 이사 대신 방주 띠
  const A = R.arkState && !visiting() ? R.arkState(W, M, now()) : null;
  if (A && (A.atArk || A.phase)){
    el.dataset.mode = 'ark'; el.hidden = false;
    const done = A.phase === 'land' ? A.landDone >= A.land.length : false;
    const say = A.phase === 'flood' ? '방주 <b>' + A.month + '달째</b> — ' + (A.monthDone ? '오늘 한 달은 보냈어요. 동물을 돌봐요' : '오늘 <b>한 달 보내기</b>를 눌러요 (양식 ' + A.food + ')')
      : A.phase === 'land' ? (done ? '무지개 농장 완성! 🎉' : '새 땅 짓기 <b>' + A.landDone + '/' + A.land.length + '</b> — 다음: ' + (A.land.find(L => !L.done) || {}).name)
      : A.step >= A.total ? '방주가 다 지어졌어요! 둘이 함께 <b>방주에 들어가요</b>' : '방주 <b>' + A.step + '/' + A.total + '단계</b> — 다음: ' + A.steps[A.step].icon + ' ' + A.steps[A.step].name;
    const pct = A.phase === 'flood' ? A.month / A.months : A.phase === 'land' ? A.landDone / A.land.length : A.step / A.total;
    el.classList.toggle('ready', (A.phase === 'flood' && !A.monthDone) || (!A.phase && A.step >= A.total));
    el.innerHTML = '<span>' + (A.phase === 'land' ? '🌈' : '🛶') + '</span><span>' + say + '</span><span class="mv-bar"><i style="width:' + Math.round(100 * pct) + '%"></i></span>';
    return;
  }
  el.dataset.mode = 'move';
  const s = R.moveState(W, M);
  el.hidden = !s.next;
  if (!s.next) return;
  const o = R.OTHER[key];
  const say = s.otherAsked ? NAME[o] + '가 ' + s.next.name + '으로 이사 가자고 해요! 눌러서 대답해요'
    : s.mineAsked ? NAME[o] + '가 좋다고 하면 ' + s.next.name + '으로 떠나요'
    : !s.ready ? s.next.name + '으로 이사까지 <b>' + R.moveLeftText(s) + '</b> 남았어요'
    : R.MOVE_OPEN === false ? '준비가 다 됐어요! ' + s.next.name + '은 곧 열려요'
    : '준비가 다 됐어요! ' + s.next.name + '으로 가는 길이 열렸어요';
  // 막대는 조건마다 채운 만큼을 똑같은 무게로 더한다
  const pct = Math.round(100 * s.conds.reduce((a, c) => a + Math.min(1, c.have / c.need), 0) / s.conds.length);
  el.classList.toggle('ready', s.ready);
  el.innerHTML = '<span>🚚 ' + s.next.icon + '</span><span>' + say + '</span><span class="mv-bar"><i style="width:' + pct + '%"></i></span>';
}
// 새 농장 첫날 할 일 — 두고 온 우물·우리를 새로 짓고 꾸미개 하나를 놓을 때까지만 뜬다
const TODO_ICON = { well: '💧', coop: '🐔', barn: '🐄', pasture: '🐖', pethouse: '🐶' };
function syncTodo(){
  const el = $('#firstTodo'); if (!el) return;
  const done = id => !!(W.buildings[id] && W.buildings[id].done);
  const needs = (W.animals || []).map(a => R.ANIMALS[a.kind] && R.ANIMALS[a.kind].need);
  const list = ['well'].concat(['coop', 'barn', 'pasture', 'pethouse'].filter(id => needs.indexOf(id) >= 0))
    .map(id => ({ nm: TODO_ICON[id] + ' ' + R.BUILDINGS[id].name + ' 짓기', done: done(id), go: () => openTab('duo', true) }));
  list.push({ nm: '🎀 첫 꾸미개 놓기', done: Object.keys(W.decor || {}).some(id => !W.decor[id].keep), go: () => { shopTab = 'deco'; openTab('shop', true); } });
  const show = (W.farm || 0) >= 1 && !visiting() && !(W.ark && W.ark.phase === 'flood') && list.some(x => !x.done);
  el.hidden = !show;
  if (!show){ moveLine(el); return; }
  el.innerHTML = '<span>' + R.farmOf(W).icon + ' 새 농장 첫날 할 일</span>';
  list.forEach(x => el.appendChild(btn((x.done ? '✅ ' : '⬜ ') + x.nm, x.done ? 'done' : '', x.go)));
}
// 다음 농장까지 남은 것 한 줄(2026-10-09) — 누르면 이사 카드가 있는 꾸미개 가게로
function moveLine(el){
  const s = R.moveState && !visiting() ? R.moveState(W, M) : null;
  if (!s || !s.next) return;
  el.hidden = false;
  el.innerHTML = '';
  const left = R.moveLeftText ? R.moveLeftText(s) : '';
  el.appendChild(btn('🚚 ' + s.next.icon + ' ' + s.next.name + (s.ready ? ' — <b>이사 갈 수 있어요!</b>' : '까지 ' + left), s.ready ? 'done' : '', () => { shopTab = 'deco'; openTab('shop', true); }));
}
/* 이삿날 장면 — 떠난 섬에서 짐수레가 새 섬으로 건너간다. 이사를 확정한 아이는 그 자리에서,
   자매는 다음에 농장을 열 때 한 번 본다(본 농장 번호를 이 기기에 적어 둔다). */
const ARRIVE_KEY = () => 'suayona.farm.arrived.' + key;
function checkArrival(){
  if (!W || !(W.farm >= 1) || !$('#modal').hidden || visiting()) return;
  // 자매가 방주에 들어간 뒤 처음 열면 입장 장면을 한 번 본다(2026-10-09)
  if (W.ark && W.ark.phase === 'flood'){ let b = '1'; try { b = localStorage.getItem(BOARD_KEY()); } catch (e) { b = '1'; } if (b !== '1'){ openBoardScene(); return; } }
  let seen = 0;
  try { seen = arriveSeen(localStorage.getItem(ARRIVE_KEY())); } catch (e) { return; }
  if (seen < W.farm) openArrival();
}
/* 본 농장 번호 — 2026-10-09 단풍·밀림·사바나가 끼어들어 사막부터 번호가 셋씩 밀렸다. 「v2:」 없는 옛 기록(5 이상)은 옮겨 읽는다 */
function arriveSeen(raw){ if (raw && raw.indexOf('v2:') === 0) return Number(raw.slice(3)) || 0; const n = Number(raw) || 0; return n >= 5 ? n + 3 : n; }
const ISLE = { meadow: ['#8fcf6a', '#b5895a'], seaside: ['#9ad76e', '#d8b27a'], mountain: ['#6fa85a', '#8a7a6a'], cloud: ['#f2b8d8', '#f5f0ff'], desert: ['#f2d49c', '#c98850'], ark: ['#a8c672', '#74583c'],
  aurora: ['#eef4fa', '#7c8aa4'], maple: ['#d8902a', '#8a6a4a'], jungle: ['#2f7a30', '#a85a3a'], savanna: ['#dcc46e', '#c0703e'], newland: ['#9cd06a', '#7a5a40'] };
const ARRIVE_SKY = { seaside: ['#bfe6ff', '#6fb8e6'], mountain: ['#d6ecd2', '#8fb3a0'], cloud: ['#f3e6ff', '#fbf7ff'], ark: ['#9aa6b4', '#7a8a6a'],
  maple: ['#cfe4ef', '#6aa8d0'], jungle: ['#c8e8e0', '#1e5a2a'], savanna: ['#f8d8a8', '#d8b468'] };
function arrivalFrame(g, from, to, p){
  const sky = ARRIVE_SKY[to.id] || ARRIVE_SKY.seaside;
  g.fillStyle = sky[0]; g.fillRect(0, 0, 320, 96);
  g.fillStyle = sky[1]; g.fillRect(0, 96, 320, 44);
  const isle = (cx, id) => {
    const c = ISLE[id] || ISLE.meadow;
    g.fillStyle = c[1]; g.beginPath(); g.moveTo(cx - 34, 88); g.lineTo(cx, 104); g.lineTo(cx + 34, 88); g.lineTo(cx + 26, 112); g.lineTo(cx, 124); g.lineTo(cx - 26, 112); g.fill();
    g.fillStyle = c[0]; g.beginPath(); g.moveTo(cx - 34, 88); g.lineTo(cx, 72); g.lineTo(cx + 34, 88); g.lineTo(cx, 104); g.fill();
  };
  isle(58, from.id); isle(262, to.id);
  g.font = '18px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(from.icon, 58, 66); g.fillText(to.icon, 262, 66);
  const at = f => ({ x: (1 - f) * (1 - f) * 78 + 2 * (1 - f) * f * 160 + f * f * 242, y: (1 - f) * (1 - f) * 84 + 2 * (1 - f) * f * 26 + f * f * 84 });
  g.fillStyle = '#ffffffcc';
  for (let f = 0; f <= 1; f += 0.04){ const q = at(f); g.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); }
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, q = at(e);
  const x = Math.round(q.x), y = Math.round(q.y - 10 - Math.abs(Math.sin(p * Math.PI * 7)) * 2);
  g.fillStyle = '#8a5f3a'; g.fillRect(x - 10, y, 20, 7);
  g.fillStyle = '#c79b6d'; g.fillRect(x - 10, y, 20, 2);
  g.fillStyle = '#e8c46a'; g.fillRect(x - 8, y - 6, 7, 6);
  g.fillStyle = '#f28c8c'; g.fillRect(x + 1, y - 7, 5, 5);
  g.fillStyle = '#2f2a24'; g.fillRect(x - 8, y + 7, 4, 4); g.fillRect(x + 4, y + 7, 4, 4);
  if (p >= 1) [[240, 64], [284, 70], [262, 52], [230, 86], [296, 90]].forEach(([sx, sy], i) => { g.fillStyle = i % 2 ? '#ffffff' : '#ffe066'; g.fillRect(sx, sy, 3, 3); });
}
// 넓어진 땅 — 「26×20 → 28×20 (+40칸)」(2026-10-09)
function landLine(from, to){
  const a = (from && from.grid) || R.GRID, b = to.grid || R.GRID, more = b.w * b.h - a.w * a.h;
  return more > 0 ? '🗺️ 땅이 넓어졌어요! ' + a.w + '×' + a.h + ' → <b>' + b.w + '×' + b.h + '</b> (+' + more + '칸)' : '';
}
// 이삿날 선물 목록 — 추억·새 식구·문패·도장(2026-09-30 로키즈 「이사 보상」)
function arrivalGifts(to){
  const keeps = Object.keys(W.decor || {}).filter(id => W.decor[id].keep && R.DECOR[id]);
  // 지나온 농장들(건너뛴 화산 포함)의 아기 동물 — 바닷가→꽃구름이면 염소와 두루미가 함께 온다
  const P = (W.past || [])[(W.past || []).length - 1], i0 = P ? R.FARMS.findIndex(f => f.id === P.farm) : (W.farm || 0) - 1;
  const passed = R.FARMS.slice(i0 + 1, (W.farm || 0) + 1).map(f => f.id);
  const babies = Object.keys(R.ANIMALS).filter(k => passed.indexOf(R.ANIMALS[k].gift) >= 0)
    .map(k => (W.animals || []).filter(a => a.gift && a.kind === k).pop()).filter(Boolean);
  const stamp = R.MEDALS.find(Md => Md.id === { seaside: 'stampSea', cloud: 'stampCloud', aurora: 'stampAurora', maple: 'stampMaple', jungle: 'stampJungle', savanna: 'stampSavanna', desert: 'stampDesert', ark: 'stampArk' }[to.id]);
  const li = [
    '📮 우편함에 이사 선물 동전 ' + (R.MOVE_GIFT || 0),
    keeps.length ? '🧳 들고 온 추억: ' + keeps.map(id => R.DECOR[id].icon + ' ' + R.DECOR[id].name).join(' · ') : '',
    babies.length ? babies.map(b => R.ANIMALS[b.kind].icon).join('') + ' 새 식구 ' + babies.map(b => '<b>' + escapeHTML(b.name) + '</b>').join('와 ') + '가 따라왔어요. 「👭 둘이서」 칸 동물 목록의 ✏️ 로 이름을 지어 줘요' : '',
    '🪧 대문 문패가 <b>수아연아 농장 ' + R.farmNo(W.farm || 0) + '호점</b>이 됐어요',
    stamp ? stamp.icon + ' 「📖 도감·기록」 칸 훈장에서 <b>' + stamp.name + '</b>을 받을 수 있어요' : '',
    landLine(R.FARMS[i0], to),
    to.perk ? '🌟 이 농장만의 능력: <b>' + to.perk.icon + ' ' + to.perk.text + '</b>' : '',
    R.GUESTS && R.GUESTS[to.id] ? R.GUESTS[to.id].icon + ' 손님 <b>' + R.GUESTS[to.id].name + '</b>' + (/[가-힣]/.test(R.GUESTS[to.id].name.slice(-1)) && (R.GUESTS[to.id].name.slice(-1).charCodeAt(0) - 0xac00) % 28 ? '이' : '가') + ' 사흘마다 부탁하러 와요(「👭 둘이서」 칸)' : '',
  ].filter(Boolean);
  return '<ul class="arrive-gifts">' + li.map(x => '<li>' + x + '</li>').join('') + '</ul>';
}
function openArrival(){
  const past = W.past || [], P = past[past.length - 1], to = R.farmOf(W);
  const from = (P && R.FARMS.find(f => f.id === P.farm)) || R.FARMS[Math.max(0, W.farm - 1)];
  // 방주 농장 — 아직 못 들은 아이는 하나님의 음성을 먼저 듣고 이삿날 창으로(2026-10-09)
  if (to.id === 'ark'){ let heard = true; try { heard = localStorage.getItem(VOICE_KEY()) === '1'; } catch (e) { heard = true; } if (!heard){ openVoice(() => openArrival()); return; } }
  try { localStorage.setItem(ARRIVE_KEY(), 'v2:' + W.farm); } catch (e) { /* 못 적으면 다음에 한 번 더 본다 */ }
  const inner = $('#modalInner');
  // 무지개 농장 — 대홍수를 건너 새 땅에 내린 날(2026-10-09)
  const AH = window.FARMHD && window.FARMHD.ark;
  if (to.id === 'newland' && AH){
    const A = W.ark || {}, kinds = R.ARK_KINDS.filter(k => (W.animals || []).some(a => a.kind === k)), fl = R.MEDALS.find(Md => Md.id === 'flood');
    const li = [
      '📮 우편함에 새 땅 선물 동전 ' + (R.MOVE_GIFT || 0),
      (A.seeds || []).length ? '🌰 씨앗 금고를 열었어요 — <b>' + A.seeds.length + '가지</b> 씨앗을 두 알씩 우편함에 넣었어요' : '🌰 씨앗 금고가 비어 있었어요 — 가게에서 씨앗을 사요',
      A.babies ? '🐣 생육하고 번성하라(창세기 9:1) — 한 쌍마다 아기가 하나씩, <b>' + A.babies + '마리</b>가 태어났어요' : '',
      '🌈 이 농장만의 능력: <b>' + to.perk.icon + ' ' + to.perk.text + '</b>',
      '🏘️ 「🛶 방주」 칸에서 <b>새 땅 짓기</b> 여섯 가지를 하나씩 지어요 — 감사의 제단부터',
      fl ? fl.icon + ' 「📖 도감·기록」 칸 훈장에서 <b>' + fl.name + '</b>을 받을 수 있어요' : '',
      '🪧 대문 문패가 <b>수아연아 농장 ' + R.farmNo(W.farm || 0) + '호점</b>이 됐어요',
    ].filter(Boolean);
    inner.innerHTML = '<h3 class="pixel">🌈 무지개 농장에 도착!</h3><p class="sub">열두 달 만에 방주 문이 열렸어요. 물이 빠진 새 땅에 동물들과 함께 내려요(창세기 8:18-19). 하늘엔 다시는 물로 땅을 덮지 않겠다는 약속의 무지개가 떠요.</p>'
      + AH.SCENE_CV('arriveCv', '물이 빠지고 비둘기가 올리브 잎을 물어 오고 모두 방주에서 내려 무지개 아래 새 땅으로 가는 그림')
      + '<ul class="arrive-gifts">' + li.map(x => '<li>' + x + '</li>').join('') + '</ul>'
      + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="arriveGo">🌈 새 땅 둘러보기</button></div>';
    $('#modal').hidden = false;
    const run = AH.landing($('#arriveCv'), { kinds, onDone: () => sfx('fanfare') });
    $('#arriveGo').addEventListener('click', () => { run.stop(); closeModal(); });
    return;
  }
  // 스테이지2 로 넘어가는 이사는 비행선 장면(2026-10-09, pages/farm-hd-people.js) — 고화소 그림이 안 왔으면 짐수레 그대로
  const air = to.stage === 2 && !(from.stage >= 2) && window.FARMHD && window.FARMHD.airship;
  // 스테이지2 안의 사막 이사는 마법 양탄자 장면(2026-10-09)
  const carpet = !air && to.id === 'desert' && window.FARMHD && window.FARMHD.airship;
  inner.innerHTML = (carpet ? '<h3 class="pixel">🧞 마법 양탄자 — ' + to.name + '으로!</h3>'
      + '<p class="sub">' + from.name + '을 떠나 마법 양탄자를 타고 모래 언덕 바다를 건너 <b>' + to.name + '</b>에 내려앉았어요. ' + (to.desc || '') + '</p>' + window.FARMHD.AIRSHIP_CV
      : air ? '<h3 class="pixel">✈️ 스테이지2 — ' + to.name + '으로!</h3>'
      + '<p class="sub">' + from.name + '을 떠나 비행선을 타고 구름 바다를 건너 <b>' + to.name + '</b>에 내려앉았어요. 여기서부터 <b>스테이지2</b>예요! ' + (to.desc || '') + '</p>' + window.FARMHD.AIRSHIP_CV
      : '<h3 class="pixel">🚚 이삿날!</h3>'
      + '<p class="sub">' + from.name + '을 떠나 <b>' + to.name + '</b>에 도착했어요. ' + (to.desc || '') + '</p>'
      + '<canvas id="arriveCv" class="arrive" width="640" height="280" aria-label="짐수레가 새 농장으로 건너가는 그림"></canvas>')
    + '<p class="sub">두고 온 ' + from.name + '은 농장 그림 위 「옛 농장 구경」에서 언제든 가 볼 수 있어요.</p>'
    + arrivalGifts(to)
    + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="arriveGo">🏝 새 농장 둘러보기</button>'
    + (P ? '<button type="button" class="dot-btn small" id="arriveSnap">📷 ' + from.name + ' 마지막 한 장 내기</button>' : '') + '</div>';
  $('#modal').hidden = false;
  if (carpet) window.FARMHD.airship($('#arriveCv'), { carpet: true, title: '오아시스 도착!', sub: to.icon + ' ' + to.name, onDone: () => sfx('sparkle') });
  else if (air) window.FARMHD.airship($('#arriveCv'), { sub: to.icon + ' ' + to.name, onDone: () => sfx('sparkle') });
  else {
  const cv = $('#arriveCv'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false; g.setTransform(2, 0, 0, 2, 0, 0);
  const t0 = performance.now(), D = 2600;
  const step = () => {
    if (!cv.isConnected) return;
    const p = STILL ? 1 : Math.min(1, (performance.now() - t0) / D);
    arrivalFrame(g, from, to, p);
    if (p < 1) requestAnimationFrame(step); else sfx('sparkle');
  };
  step();
  }
  $('#arriveGo').addEventListener('click', closeModal);
  if (P) $('#arriveSnap').addEventListener('click', () => openSnap(past.length - 1));
}
// 옛 농장 구경 — 이사 간 뒤에만 뜬다. 구경하는 동안은 농장 그림만 옛 농장으로 바뀌고 나머지는 그대로다.
const visiting = () => typeof visitAt !== 'undefined' && visitAt != null;
function syncPast(){
  // 띠 그리기는 farm.js 가 한다(손님 화면도 같이 쓴다). 배포 직후 옛 farm.js 와 짝지어지면 잠깐 안 뜬다.
  const el = $('#pastBar'); if (!el || typeof paintPastBar !== 'function') return;
  if (visitAt != null && !(W.past || [])[visitAt]){ visitAt = null; walkers = null; beasts = null; withView(ensureActors); }
  paintPastBar(el, visitFarm);
}
function visitFarm(i){
  visitAt = i;
  if (placeMode) togglePlace();
  if (fishing) fishing = null;
  // 아이들을 그 농장 집 앞에서 새로 세운다(동물도 그 농장 것으로). 움직임 줄이기면 걷는 고리가 없어 여기서 바로 세운다.
  walkers = null; beasts = null;
  withView(ensureActors);
  sfx('house');
  syncPast();
  drawFarm(liveCv);
}
// 둘이서 탭에 「내 차례」가 몇 개인지 — 자매가 낸 건물, 잡아당길 큰 작물, 쓰다듬을 동물.
function duoWaiting(){
  let n = 0;
  Object.keys(R.BUILDINGS).forEach(b => { const s = R.buildState(W, b); if (!s.done && s[R.OTHER[key]] && !s[key]) n++; });
  Object.keys(W.plots).forEach(id => { const p = W.plots[id]; if (p.giant && p.pulls && p.pulls.indexOf(R.OTHER[key]) >= 0 && p.pulls.indexOf(key) < 0) n++; });
  (W.animals || []).forEach(a => { if (a.petDay === R.dayKey(now()) && (a.pet || []).indexOf(R.OTHER[key]) >= 0 && a.pet.indexOf(key) < 0) n++; });
  if (R.moveState && R.moveState(W, M).otherAsked) n++;              // 자매가 이사 가자고 했다
  return n;
}
function renderTools(){
  const box = $('#tools'); box.innerHTML = '';
  TOOLS.forEach(t => {
    if (t.when && !t.when()){ if (tool === t.id) tool = 'hand'; return; }
    const b = document.createElement('button'); b.type = 'button';
    b.className = tool === t.id ? 'on' : '';
    b.innerHTML = t.icon + ' ' + t.name + '<small>' + (typeof t.sub === 'function' ? t.sub() : t.sub) + '</small>';
    b.addEventListener('click', () => { tool = t.id; sfx('prop'); renderTools(); });
    box.appendChild(b);
  });
  const sr = $('#seedRow'); sr.hidden = tool !== 'seed' && tool !== 'sprk';
  if (tool === 'sprk'){
    // 두 가지를 다 가졌을 때만 고르는 줄이 뜬다 — 하나뿐이면 고를 것이 없다
    const kinds = ['sprinkler', 'sprinkler2'].filter(k => (M.inv[k] || 0) > 0);
    if (!R.SPRINKLERS || kinds.length < 2){ sr.hidden = true; if (kinds.length === 1) sprk = kinds[0]; }
    else {
      if (kinds.indexOf(sprk) < 0) sprk = kinds[0];
      sr.innerHTML = '';
      kinds.forEach(k => {
        const b = document.createElement('button'); b.type = 'button';
        b.className = sprk === k ? 'on' : '';
        b.textContent = R.SPRINKLERS[k].name + ' ' + M.inv[k] + ' (둘레 ' + R.SPRINKLERS[k].reach + '칸)';
        b.addEventListener('click', () => { sprk = k; renderTools(); });
        sr.appendChild(b);
      });
    }
  }
  if (tool === 'seed'){
    sr.innerHTML = '';
    const have = Object.keys(M.inv).filter(k => k.startsWith('seed:') && M.inv[k] > 0);
    if (!have.length){ sr.innerHTML = '<span class="none">씨앗이 없어요. 가게에서 사거나 자매에게 받아요.</span>'; seed = null; }
    if (seed && have.indexOf('seed:' + seed) < 0) seed = have.length ? have[0].slice(5) : null;
    if (!seed && have.length) seed = have[0].slice(5);
    have.forEach(k => {
      const c = k.slice(5), b = document.createElement('button'); b.type = 'button';
      b.className = seed === c ? 'on' : '';
      const cv = cropIcon(c); b.appendChild(cv);
      b.appendChild(document.createTextNode(R.CROPS[c].name + ' ' + M.inv[k]));
      b.addEventListener('click', () => { seed = c; renderTools(); });
      sr.appendChild(b);
    });
  }
  $('#fhint').textContent = hintFor();
}
function hintFor(){
  // 끌 수 있는 도구는 그 이야기를 먼저 해 준다 — 손이 아니라 눈으로 알아야 쓴다
  const cal = R.calendar(W, now());
  if (tool === 'hoe') return '밭의 풀밭을 눌러 땅을 갈아요. 누른 채 끌면 지나간 칸마다 이어서 갈려요. 기운 1.';
  if (tool === 'can') return '갈아 둔 땅을 눌러 물을 줘요. 누른 채 끌면 줄줄이 줘요. 스무 시간 촉촉해요. 비 오는 날은 안 줘도 돼요.';
  if (tool === 'seed') return seed ? R.CROPS[seed].name + ' — ' + R.CROPS[seed].hours + '시간이면 자라요. ' + (R.CROPS[seed].season.indexOf(cal.season) >= 0 || R.CROPS[seed].hardy ? '지금 심을 수 있어요.' : '지금은 ' + R.SEASON_NAME[cal.season] + '이라 밭에서는 안 자라요(온실은 돼요).') : '';
  if (tool === 'fert') return '비료는 가게에서 사요. 1.5배 빨리 자라요. 끌면 줄줄이 줘요.';
  if (tool === 'pull') return '시든 작물이나 그만 키울 작물을 뽑아요. 큰 작물은 짝도 같이 뽑혀요.';
  if (tool === 'sprk'){
    const S = (R.SPRINKLERS && R.SPRINKLERS[sprk]) || R.SPRINKLER;
    return '밭의 빈 칸을 눌러 놓아요. 아침마다 둘레 ' + S.reach + '칸에 물을 줘요. 놓은 칸을 다시 누르면 걷어요.';
  }
  const here = R.farmOf(W).id;
  if (W.ark && W.ark.phase === 'flood') return '큰물 위를 떠가는 방주예요. 방주를 누르면 「🛶 방주」 칸, 창밖 물을 누르면 낚시를 해요. 하루에 한 달씩 지나요.';
  return '다 자란 작물·나무·바위·동물·집·우편함·게시판·가게를 눌러요. 밭 위를 끌면 익은 것만 줄줄이 거둬요.'
    + (here === 'seaside' ? ' 섬 밖 바다를 누르면 바다낚시를 해요.' : here === 'mountain' ? ' 화산 바위에는 가끔 반짝돌이 박혀 있어요.'
      : here === 'aurora' ? ' 얼음낚시 구멍을 누르면 얼음낚시를 해요. 밤엔 땅에 떨어진 오로라 빛 조각을 주워요.'
      : here === 'maple' ? ' 낮엔 단풍나무 아래 메이플 시럽 양동이를 주워요. 사슴·다람쥐가 밤과 도토리를 물어 와요. 거둘 때 가끔 풍년이라 하나 더!'
      : here === 'jungle' ? ' 낮엔 땅에 떨어진 망고를 주워요. 날마다 스콜이 지나가 밭이 촉촉해요. 원숭이가 바나나를, 앵무새가 깃털을 줘요.'
      : here === 'savanna' ? ' 낮엔 바오밥 나무 아래 열매를 주워요. 둘이 쓰다듬으면 동물 마음이 두 칸씩 자라요. 코끼리가 통나무를 날라 와요.'
      : here === 'desert' ? ' 낮엔 모래 위에 놓인 사막 장미 돌을 주워요. 요술 램프를 놓으면 가끔 램프 요정 편지가 와요.'
      : here === 'ark' ? ' 가운데 방주를 누르면 「🛶 방주」 칸이 열려요. 낮엔 땅에 떨어진 역청 덩어리를 주워요. 혼자인 동물에게 짝꿍이 찾아와요.'
      : here === 'newland' ? ' 낮엔 땅에 떨어진 올리브를 주워요. 새 땅 짓기는 「🛶 방주」 칸에서 해요.' : '');
}
// where: 'sea' 면 바닷가 섬 밖 바다에 던진 것 — at 은 찌가 떨어진 화면 도트
function startFishing(where, at){
  if (fishing) return;
  if (R.fishLeft(M, now()) <= 0){ flash('오늘은 많이 잡았어요. 내일 또 와요', true); return; }
  // 기운은 미리 본다 — 한 판 다 하고 나서 「기운이 없어요」 하면 억울하다
  if ((M.energy || 0) < R.COST.fish){ flash('기운이 없어요', true); return; }
  if (STILL){ doFish('good', where); return; }
  const open = performance.now() + FISH_GRACE;
  fishing = { t0: open, openAt: open, center: 26 + Math.random() * 48, done: false, where, at };
  sfx('bite'); flash('찌가 움직여요 — <b>칸 안에서 톡!</b>');
  setTimeout(() => { if (fishing && !fishing.done) finishFishing('miss'); }, FISH_GRACE + FISH_LIMIT);
}
function finishFishing(force){
  if (!fishing || fishing.done) return;
  fishing.done = true;
  const pos = fishMarker(performance.now()), d = Math.abs(pos - fishing.center);
  const g = force || (d <= FISH_ZONE / 4 ? 'perfect' : d <= FISH_ZONE / 2 ? 'good' : 'miss');
  fishing.pos = pos; fishing.grade = g;
  sfx('reel'); sfx(g === 'perfect' ? 'sparkle' : g === 'miss' ? 'thud' : 'pop');
  const where = fishing.where;
  setTimeout(() => { fishing = null; doFish(g, where); }, 420);
}
function doFish(g, where){
  const r = act((w, m) => R.fish(w, m, now(), g, where));
  if (r.ok){
    sfx(r.rare ? 'fanfare' : r.junk ? 'thud' : 'pop');
    const head = g === 'perfect' ? '<b>딱 맞췄어요!</b> ' : g === 'miss' ? '늦었어요… ' : '';
    flash(head + r.msg + ' <span style="color:var(--ink-soft);font-weight:700;">(오늘 ' + R.fishLeft(M, now()) + '번 남음)</span>');
  }
}
function sweepTile(id){
  if (sweep.done[id]) return;
  sweep.done[id] = 1;
  if (!R.plotOpen(W, id)) return;
  let r = null;
  if (tool === 'hoe') r = act((w, m) => R.till(w, m, id, now()), true);
  else if (tool === 'can') r = act((w, m) => R.water(w, m, id, now()), true);
  else if (tool === 'seed' && seed) r = act((w, m) => R.plant(w, m, id, seed, now()), true);
  else if (tool === 'fert') r = act((w, m) => R.fertilize(w, m, id, now()), true);
  else if (tool === 'hand'){
    const p = W.plots[id];
    if (!p || !p.crop) return;
    R.tickPlot(p, now(), false);
    if (!p.wilted && !R.ripe(p)) return;                 // 아직 안 익은 것은 건드리지 않는다
    r = act((w, m) => R.harvest(w, m, id, now()), true);
  }
  if (r && r.ok){
    sweep.n++;
    // 칸마다 소리를 내면 시끄럽다 — 열에 한 번쯤만 낸다
    const t = performance.now();
    if (t - sweepSfxAt > 110){
      sweepSfxAt = t;
      sfx(tool === 'can' ? 'drip' : tool === 'hoe' ? 'thud' : tool === 'seed' ? 'plant' : 'pop');
    }
  } else if (r && r.msg) sweep.why = r.msg;
}
function onFarmDown(e){
  sweep = null;
  if (visiting() || fishing || placeMode || !SWEEP_TOOLS[tool]) return;
  const { tx, ty } = tileAt(e.clientX, e.clientY);
  const id = plotAtTile(tx, ty);
  if (!id) return;                                       // 밭에서 시작할 때만
  sweep = { id0: id, done: {}, n: 0, moved: false, why: null };
  try { $('#farmCanvas').setPointerCapture(e.pointerId); } catch (err) { /* 붙잡기는 덤이다 */ }
}
function onFarmMove(e){
  if (!sweep) return;
  const { tx, ty } = tileAt(e.clientX, e.clientY);
  const id = plotAtTile(tx, ty);
  if (!id || sweep.done[id] || (id === sweep.id0 && !sweep.moved)) return;
  if (!sweep.moved){ sweep.moved = true; sweepTile(sweep.id0); }   // 첫 칸도 이때 함께
  sweepTile(id);
}
function onFarmUp(){
  if (!sweep) return;
  const s = sweep; sweep = null;
  if (!s.moved) return;                                  // 톡 누른 것 — click 이 알아서 한다
  sweepClick = true;                                     // 끌고 난 뒤 따라오는 click 은 삼킨다
  if (s.n) flash(SWEEP_MSG[tool] + ' <b>' + s.n + '칸</b>');
  else flash(s.why || '한 칸도 안 됐어요', true);
}
function onFarmTap(e){
  if (sweepClick){ sweepClick = false; return; }
  if (visiting()){ flash('옛 농장을 구경하는 중이에요. 위의 「지금 농장으로」를 누르면 돌아가요'); return; }
  if (fishing){ if (fishOpen()) finishFishing(); return; }   // 찌가 떠 있으면 어디를 눌러도 당긴다
  // 대홍수 — 섬 대신 방주 단면(2026-10-09). 방주는 방주 칸, 물은 창밖 낚시
  if (typeof voyageOn === 'function' && voyageOn()){
    const p = pixAt(e.clientX, e.clientY), B = window.FARMHD && window.FARMHD.ark && window.FARMHD.ark.voyageBox;
    if (B && p.x >= B.x0 && p.x <= B.x1 && p.y >= B.y0 && p.y <= B.y1){ openTab('ark', true); sfx('house'); return; }
    if (B && p.y > B.water){ startFishing('flood', p); return; }
    flash('큰물 위를 떠가는 중이에요 — 방주를 누르면 방주 칸이 열려요');
    return;
  }
  // 배치에서 들고 있는 것을 놓을 때는 땅의 칸으로 — 아이소 섬에서 지붕이 뒤 칸을 덮는다
  const { tx, ty } = tileAt(e.clientX, e.clientY, placeMode && !!placePick);
  if (!placeMode && seaAt(e.clientX, e.clientY)){ startFishing('sea', pixAt(e.clientX, e.clientY)); return; }
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  if (placeMode){ onPlaceTap(tx, ty); return; }
  // 반딧불이는 무엇 위를 날든 먼저 잡힌다 — 밭 위에 있다고 놓치면 아이가 답답하다
  const p0 = pixAt(e.clientX, e.clientY);
  const fi = typeof flyAtPix === 'function' ? flyAtPix(p0.x, p0.y) : flyAt(tx, ty);
  if (fi >= 0){
    // 누른 그 마리를 먼저 지운다. act 가 다시 그리면서 마릿수를 맞추므로,
    // 뒤에 지우면 애먼 마리까지 사라진다. 못 잡았으면 syncFlies 가 도로 채운다.
    flies.splice(fi, 1);
    const r = act((w, m) => R.catchFirefly(w, m, now()));
    if (r.ok) sfx('firefly');
    return;
  }
  // 오로라 빛 조각 — 밤 땅에 떨어진 것을 누르면 줍는다(2026-10-09). 옛 farm.js 와 짝이면 shardAtPix 가 없다
  const si = typeof shardAtPix === 'function' ? shardAtPix(p0.x, p0.y) : -1;
  if (si >= 0){ const r = act((w, m) => R.pickShard(w, m, si, now())); if (r.ok) sfx('sparkle'); return; }
  const id = plotAtTile(tx, ty);
  if (id){ onPlot(id); return; }
  // 아이·인형·동물을 누르면 한마디. 밭보다는 뒤, 건물보다는 앞 — 우리 안의 동물도 말을 한다.
  const q = pixAt(e.clientX, e.clientY), hit = actorAt(q.x, q.y);
  if (hit){ speak(hit); return; }
  const n = nodeAt(tx, ty);
  if (n){ const r = act((w, m) => R.gather(w, m, n, now())), k = R.nodeDef(W, n).kind; if (r.ok) sfx(r.gem ? 'sparkle' : k === 'tree' ? 'thud' : k === 'rock' ? 'prop' : 'pop'); return; }
  if (inSpot('ark', tx, ty)){ openTab('ark', true); sfx('house'); return; }
  if (['altar', 'rainbowhill', 'vineyard', 'dovecote', 'olivegrove', 'wellsquare'].some(id => inSpot(id, tx, ty))){ openTab('ark', true); return; }
  if (inSpot('house', tx, ty)){ openTab('house', true); sfx('house'); return; }
  if (inSpot('mail', tx, ty)){ openMail(); return; }
  if (inSpot('board', tx, ty)){ openTab('duo', true); return; }
  if (inSpot('stall', tx, ty)){ openTab('shop', true); return; }
  if (inSpot('hive', tx, ty)){ const r = act((w, m) => R.takeHoney(w, m, now())); if (r.ok) sfx('sparkle'); return; }
  if (inSpot('greenhouse', tx, ty)){ if (built('greenhouse')) openGreenhouse(); else flash('온실 터예요. 둘이서 탭에서 같이 지어요'); return; }
  if (inSpot('well', tx, ty)){ flash(built('well') ? '우물이에요. 물뿌리개를 키울 수 있어요' : '우물 터예요. 둘이서 탭에서 같이 지어요'); return; }
  if (inSpot('pond', tx, ty)){ startFishing(); return; }
  // 얼음낚시 구멍 — 오로라에서 누르면 그 구멍에 찌를 드리운다(2026-10-09)
  if (inSpot('icefish', tx, ty) && R.farmOf(W).id === 'aurora'){ const b = spot('icefish'); startFishing('ice', isoView ? isoP(b.x + 0.5, b.y + 0.5) : { x: b.x * T + T / 2, y: b.y * T + T / 2 }); return; }
  if (R.peddlerHere(W, now()) && (P => inBox({ x: P.x, y: P.y, w: P.w + 1, h: P.h }, tx, ty))(R.peddlerSpot(W))){ openPeddler(); sfx('cart'); return; }
  if (inSpot('firepit', tx, ty)){ const r = act((w, m) => R.fireSit(w, m, now())); if (r.ok) sfx(r.both ? 'fanfare' : 'fire'); return; }
  if (inSpot('bench', tx, ty) || inSpot('swing', tx, ty)){ flash('쉬는 자리예요. 앉으면 기분이 좋아져요'); return; }
  // 동물이 있는 곳은 어디를 눌러도 동물 카드로
  if (['coop', 'barn', 'pasture', 'pethouse'].some(b => inSpot(b, tx, ty))){ openTab('duo', true); return; }
  const near = (W.animals || []).some(a => { const b = beasts && beasts.list.find(x => x.id === a.id); return b && Math.abs(b.x - (tx * T + 8)) < 14 && Math.abs(b.y - (ty * T + 12)) < 16; });
  if (near){ openTab('duo', true); return; }
  // 안 지은 건물 터를 누르면 무엇이 들어설 자리인지 알려 준다
  const site = ['pasture', 'barn', 'coop', 'pethouse', 'scarecrow'].find(b => inSpot(b, tx, ty));
  if (site) flash(R.BUILDINGS[site].name + ' 터예요. 둘이서 탭에서 같이 지어요');
}
// 바닷가 섬 밖의 바다를 눌렀나 — 하늘(수평선 위)과 섬 벼랑은 뺀다.
// 벼랑은 섬 가장자리 아래로 늘어진 면이라, 그 깊이만큼 올려 보면 섬 위에 떨어진다.
function seaAt(clientX, clientY){
  if (typeof isoView === 'undefined' || !isoView || typeof ISO_LOOK === 'undefined' || R.farmOf(W).id !== 'seaside') return false;
  const q = pixAt(clientX, clientY), L = ISO_LOOK.seaside;
  if (q.y < L.horizon) return false;
  const off = (y) => { const g = isoTileAt(q.x, y); return g.u < 0 || g.v < 0 || g.u >= COLS || g.v >= ROWS; };
  return off(q.y) && off(q.y - L.deep);
}
// ---------- 말풍선 ----------
// 누른 도트 자리에 누가 서 있나. 그림이 발끝(x, y)에서 위로 그려지므로 그 높이만큼 위를 본다.
function actorAt(x, y){
  // 발끝을 화면 자리로 옮겨 견준다 — 아이소 섬에서는 걷는 좌표와 그려진 자리가 다르다
  // 배포 직후 옛 farm.js 와 짝지어져도 안 깨지게 — 그때는 판 좌표 그대로 견준다
  const scr = typeof actorScreen === 'function' ? actorScreen : (a, b) => ({ x: a, y: b });
  const inBox = (cx, foot, w, h) => { const p = scr(cx, foot); return Math.abs(x - p.x) <= w / 2 + 2 && y >= p.y - h - 2 && y <= p.y + 3; };
  if (walkers) for (const w of walkers) if (inBox(w.x, w.y, 28, 38)) return { kind: 'kid', o: w };
  // 주말 손님 — 옛 farm.js 와 짝이면 farmGuest 가 없다
  const fg = typeof farmGuest !== 'undefined' && farmGuest && !farmGuest.out ? farmGuest : null;
  if (fg && inBox(fg.x, fg.y, 26, (WALKSHEET.heights('guest')[fg.n] || 48) - 4)) return { kind: 'guest', o: fg };
  if (dolls) for (const d of dolls.list){ const D = DOLLS[d.kind]; if (D && inBox(d.x, d.y, D.w, D.art.length)) return { kind: 'doll', o: d }; }
  if (beasts) for (const a of beasts.list){
    const B = BEAST[a.kind] || BEAST.chicken, rec = (W.animals || []).find(r => r.id === a.id), k = rec && rec.baby ? BABY_K : 1;
    if (inBox(a.x, a.y, B.w * k, B.art.length * k)) return { kind: 'beast', o: a, rec };
  }
  return null;
}
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
/* 어울리는 말을 고른다 — 늘 하는 말 몇 마디에, 지금 맞는 말(계절·날씨·밤·기운·거둘 것·
   배고픈 동물…)을 얹어서 그중 하나. 소개 페이지의 「좋아하는 것·한마디」에서 말투를 가져왔다. */
function linesForKid(who){
  const cal = R.calendar(W, now()), wk = R.weatherOf(R.dayKey(now()), cal.season), L = dayLight();
  const me = who === key, call = who === 'yona' ? '언니' : '연아야';
  const pool = who === 'sua'
    ? ['오늘은 뭐 심을까?', '피아노 치고 올게 🎹', '이 농장 이야기를 글로 써 볼까', '시간이 너무 빠르다 ㅠㅠ', '새 캐릭터가 떠올랐어!', call + ', 같이 거두자!']
    : ['상그상그~', '레샤 어디 갔지?', '만화 그리고 싶다 ✏️', '시원배게 베고 눕고 싶어', '이거 그림으로 그려야지', call + ', 물 다 줬어?'];
  if (cal.season === 'spring') pool.push('꽃 냄새 난다 🌸');
  if (cal.season === 'summer') pool.push('덥다~ 수박 먹고 싶어 🍉');
  if (cal.season === 'autumn') pool.push('낙엽 밟는 소리 좋아 🍂');
  if (cal.season === 'winter') pool.push('손 시려… 호호 ❄️');
  if (wk === 'rain' || wk === 'storm') pool.push('비 오니까 오늘은 물 안 줘도 돼!');
  if (wk === 'snow') pool.push('눈이다! 눈사람 만들자 ⛄');
  if (wk === 'wind') pool.push('바람 세다~ 모자 잡아!');
  if (L.dark > 0.4) pool.push('별이 많다 ✨', '졸려…');
  if (me && M.energy <= 10) pool.push('기운이 없어… 뭐 좀 먹자');
  if (me && M.energy >= R.maxEnergy(W, M)) pool.push('오늘은 힘이 넘쳐!');
  if (me && M.coins < 20) pool.push('동전이 다 떨어졌어… 뭐 팔까');
  const ripe = Object.keys(W.plots).filter(id => W.plots[id].crop && R.ripe(W.plots[id], now())).length;
  if (ripe) pool.push('거둘 게 ' + ripe + '개나 있어!');
  const hungry = (W.animals || []).filter(a => a.fedDay !== R.dayKey(now()));
  if (hungry.length) pool.push(hungry[0].name + ' 밥 줘야 해');
  if (W.hot && R.CROPS[W.hot]) pool.push('오늘은 ' + R.CROPS[W.hot].name + '가 인기래!');
  if (!me) pool.push(NAME[key] + (who === 'yona' ? ' 언니, 왔어?' : '야, 왔어?'));
  return pool;
}
function linesForDoll(kind){
  return kind === 'fox'
    ? ['연아 기다리는 중…', '(꼬리 살랑살랑)', '나도 농부야!', '폭신폭신~', '햇볕 좋다']
    : ['상그상그~', '구름 같지? ☁️', '꼬옥 안아 줘', '여기가 제일 좋아', '같이 놀자'];
}
function linesForBeast(a, rec){
  const today = R.dayKey(now()), name = (rec && rec.name) || R.ANIMALS[a.kind].name;
  const cry = { chicken: '꼬꼬댁!', duck: '꽥꽥!', cow: '음매~', sheep: '매에~', pig: '꿀꿀', rabbit: '(코 씰룩씰룩)', dog: '멍멍! 산책 가자', cat: '야옹… (하품)', gull: '끼룩끼룩!', goat: '메에에~', crane: '뚜루루— (날개를 활짝)' }[a.kind] || '…';
  const lc = name.charCodeAt(name.length - 1), jong = lc >= 0xac00 && lc <= 0xd7a3 && (lc - 0xac00) % 28 !== 0;   // 받침이 있으면 「이에요」
  const pool = [cry, cry, name + (jong ? '이에요' : '예요')];
  if (rec){
    if (rec.baby) pool.push('엄마 어디 있어?', '(아장아장)');
    if (rec.fedDay === today) pool.push('밥 먹었어요 😊', '배불러~');
    else pool.push('배고파요…', '밥 주세요!');
    if ((rec.love || 0) >= 5) pool.push(NAME[rec.by] + ' 좋아 💗');
    if (rec.ready) pool.push('선물이 있어요!');
    if (R.ANIMALS[a.kind] && R.ANIMALS[a.kind].find) pool.push('뭐 주워 왔어요!');
  }
  return pool;
}
// 주말 손님이 누른 아이에게 하는 말
function linesForGuest(){
  const cal = R.calendar(W, now()), who = NAME[key];
  const pool = ['안녕! ' + who + ' 농장 구경 왔어', '여기 정말 예쁘다!', '다음 주말에 또 올게요', '저 가게에서 뭐 팔아요?', '밭이 반짝반짝하네'];
  if (cal.season === 'spring') pool.push('꽃이 활짝 폈네 🌸');
  if (cal.season === 'summer') pool.push('여기는 시원해서 좋다');
  if (cal.season === 'autumn') pool.push('단풍 구경하러 왔어요 🍂');
  if (cal.season === 'winter') pool.push('눈 밟는 소리 좋다 ❄️');
  if ((W.animals || []).length) pool.push((W.animals[0].name || '동물') + ' 귀엽다!');
  return pool;
}
function speak(hit){
  const t = performance.now();
  let text, x, y, id;
  if (hit.kind === 'kid'){ text = pick(linesForKid(hit.o.who)); x = hit.o.x; y = hit.o.y - 38; id = 'k' + hit.o.who; }
  else if (hit.kind === 'guest'){
    // 불러 세우면 이쪽(보는 사람)을 보고 한마디 — 하던 구경은 그대로 이어 간다
    text = pick(linesForGuest()); x = hit.o.x; y = hit.o.y - (WALKSHEET.heights('guest')[hit.o.n] || 48) - 2; id = 'farmGuest';
    hit.o.hold = 2600; hit.o.moving = false; hit.o.vx = 1; hit.o.vy = 1;
  }
  else if (hit.kind === 'doll'){ text = pick(linesForDoll(hit.o.kind)); x = hit.o.x; y = hit.o.y - DOLLS[hit.o.kind].art.length; id = 'd' + hit.o.kind; }
  else {
    const B = BEAST[hit.o.kind] || BEAST.chicken, k = hit.rec && hit.rec.baby ? BABY_K : 1;
    text = pick(linesForBeast(hit.o, hit.rec)); x = hit.o.x; y = hit.o.y - B.art.length * k; id = 'b' + hit.o.id;
  }
  bubbleAt(id, x, y, text, t, hit.o.y);
  sfx('pop');
}
// ---------- 배치 바꾸기 ----------
function togglePlace(){
  placeMode = !placeMode; placePick = null;
  $('#placeBtn').classList.toggle('on', placeMode);
  $('#placeBar').hidden = !placeMode;
  flash(placeMode ? '옮길 것을 눌러요. 초록 테두리는 옮길 수 있는 것(나무·바위·덤불도), 빨강은 못 옮기는 것이에요' : '');
  dropLayers(); if (STILL) drawFarm(liveCv);
}
function onPlaceTap(tx, ty){
  if (!placePick){
    const id = R.PLACE_IDS.find(i => here(i) && inSpot(i, tx, ty)) || nodeAt(tx, ty);   // 채집 나무·바위·덤불과 풍경도 든다
    if (!id){ flash('옮길 것을 눌러요', true); return; }
    const P = R.placeInfo(W, id);
    if (!P.move){ flash(P.name + '은 옮길 수 없어요', true); return; }
    placePick = id; sfx('prop');
    flash('<b>' + P.name + '</b>을 들었어요. 놓을 곳을 눌러요');
    return;
  }
  const P = R.placeInfo(W, placePick);
  const nx = tx - Math.floor(P.w / 2), ny = ty - Math.floor(P.h / 2);
  const r = act((w, m) => R.moveThing(w, m, placePick, nx, ny));
  if (r.ok){ placePick = null; sfx('thud'); dropLayers(); }
}
function onPlot(id){
  if (!R.plotOpen(W, id)){ const nx = R.EXPANSIONS[(W.expand || 0) + 1]; flash(nx ? '아직 닫힌 땅이에요. 가게에서 밭을 넓혀요 (' + nx.cost + ' 동전, 레벨 ' + nx.lv + ')' : '여기는 밭이 아니에요'); return; }
  const gh = id[0] === 'g';
  if (tool === 'hoe'){ multi(id, R.toolN(M, 'hoe'), (w, m, t) => R.till(w, m, t, now()), '땅을 갈았어요'); return; }
  if (tool === 'can'){ if (gh){ flash('온실은 물을 안 줘도 돼요'); return; } multi(id, R.toolN(M, 'can'), (w, m, t) => R.water(w, m, t, now()), '물을 줬어요'); return; }
  if (tool === 'seed'){ if (!seed){ flash('씨앗을 먼저 골라요', true); return; } const c = seed; const r = act((w, m) => R.plant(w, m, id, c, now())); if (r.ok){ sfx(r.joined ? 'fanfare' : 'plant'); renderTools(); } return; }
  if (tool === 'fert'){ const r = act((w, m) => R.fertilize(w, m, id, now())); if (r.ok) sfx('pop'); renderTools(); return; }
  if (tool === 'pull'){ const p = W.plots[id]; if (p && p.crop && !p.wilted && !confirm(R.CROPS[p.crop].name + '을 정말 뽑을까요?')) return; act((w, m) => R.clear(w, m, id)); return; }
  if (tool === 'sprk'){
    const on = (W.sprinklers || {})[id];
    const r = act((w, m) => on ? R.pullSprinkler(w, m, id) : R.putSprinkler(w, m, id, sprk));
    if (r.ok) sfx(on ? 'pop' : 'sprinkle');
    renderTools(); return;
  }
  // 손
  const p = W.plots[id];
  if (p && p.crop){
    R.tickPlot(p, now(), gh);
    if (p.wilted || R.ripe(p)){ const r = act((w, m) => R.harvest(w, m, id, now())); if (r.ok) sfx(r.giant ? 'fanfare' : r.waiting ? 'prop' : 'pop'); return; }
    const C = R.CROPS[p.crop];
    // 지금까지 돌본 만큼의 별 — 물을 다 주면 하나 더, 비료까지 주면 반짝 작물이 된다
    const st = R.starOf(p, gh), need = R.careNeed(p);
    const stars = '★'.repeat(st) + '☆'.repeat(3 - st);
    flash(C.name + (p.giant ? '(큰 것)' : '') + ' <b>' + stars + '</b> — ' + Math.ceil(R.hoursLeft(p, now())) + '시간 더. '
      + (R.wetNow(p, now(), gh) ? '촉촉해요' : '<b>물이 말랐어요</b>')
      + (st < 3 ? ' · ' + (!gh && (p.care || 0) < need ? '물 ' + (need - (p.care || 0)) + '번 더' : '비료를 주면 반짝!') : ' · <b>반짝 작물이 돼요</b>')
      + lifeNote(p, gh)
      + (p.by !== key ? ' · ' + NAME[p.by] + '가 심었어요' : ''));
    return;
  }
  if ((W.sprinklers || {})[id]){
    const S = R.sprinklerOf ? R.sprinklerOf(W.sprinklers[id]) : R.SPRINKLER;
    flash(S.name + '예요. 아침마다 둘레 ' + S.reach + '칸에 물을 줘요'); return;
  }
  flash(p && p.tilled ? '갈아 둔 땅이에요. 씨앗을 골라 심어요' : '괭이로 갈면 심을 수 있어요');
}
// 일주일이면 시든다(또 열리는 작물은 마지막으로 딴 때부터) — 사흘 안으로 들어오면 알려 준다.
// 온실·별열매는 안 시든다.
// 옛 규칙 파일(lifeLeft 가 없는 것)과 짝이 된 10분 동안은 아무 말도 안 붙인다.
function lifeNote(p, gh){
  if (typeof R.lifeLeft !== 'function') return '';
  const left = R.lifeLeft(p, now(), gh);
  if (!isFinite(left) || left > 3 * 86400000) return '';
  const h = Math.ceil(left / 3600000);
  return ' · <b>' + (h <= 24 ? h + '시간 뒤 시들어요' : Math.ceil(h / 24) + '일 뒤 시들어요') + '</b>';
}
// 도구가 여러 칸을 다루면 하나라도 되면 성공으로 친다. 실패 이유는 마지막 것만.
function multi(id, n, fn, okMsg){
  const targets = R.toolTargets(id, n).filter(t => R.plotOpen(W, t));
  let done = 0, last = null;
  targets.forEach(t => { const r = act((w, m) => fn(w, m, t), true); if (r.ok) done++; else last = r.msg; });
  if (done){ flash(okMsg + (done > 1 ? ' (' + done + '칸)' : '')); sfx(tool === 'can' ? 'drip' : 'thud'); }
  else flash(last || '안 됐어요', true);
  renderTools();
}
// 온실 — 같은 그리기로 12칸짜리 작은 지도를 띄운다.
function openGreenhouse(){
  // 농장 배수는 2.5배 같은 소수일 수 있다. 온실 창은 작으니 정수배로 따로 잡는다.
  const gs = Math.max(1, Math.min(3, Math.round(S)));
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">온실</h3><p class="msg" style="margin:0 0 8px;">어느 계절 씨앗이든 자라고 물도 필요 없어요. 지금 든 도구로 칸을 눌러요.</p>' +
    '<div class="stage"><canvas id="ghCanvas" width="' + (R.GH.w * T * gs) + '" height="' + (R.GH.h * T * gs) + '"></canvas></div><div class="fmsg" id="ghMsg"></div>' +
    '<div class="modal-actions"><button type="button" class="dot-btn small" id="ghClose">닫기</button></div>';
  $('#modal').hidden = false;
  const draw = () => {
    const cv = $('#ghCanvas'); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const keep = ctx, keepS = S; ctx = g; S = gs;
    for (let y = 0; y < R.GH.h; y++) for (let x = 0; x < R.GH.w; x++){ px(x * T, y * T, T, T, (x + y) % 2 ? '#d8ecd0' : '#cfe6c6'); }
    R.plotIds(W, 'gh').forEach(id => drawPlot(id, W.plots[id], true));
    // 작물은 밭 그림과 마찬가지로 흙 위에 따로 얹는다
    R.plotIds(W, 'gh').forEach(id => {
      const p = W.plots[id]; if (!p || !p.crop || p.giant) return;
      const q = R.parseId(id);
      cropAt(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, 0);
    });
    R.plotIds(W, 'gh').forEach(id => { const p = W.plots[id]; if (p && p.giant && p.pairOf && id < p.pairOf) drawGiant(id, p, 0); });
    ctx = keep; S = keepS;
  };
  draw();
  $('#ghCanvas').addEventListener('click', e => {
    const cv = $('#ghCanvas'), r = cv.getBoundingClientRect(); const w = r.width || cv.width, h = r.height || cv.height;
    const tx = Math.floor((e.clientX - r.left) / w * cv.width / gs / T), ty = Math.floor((e.clientY - r.top) / h * cv.height / gs / T);
    if (tx < 0 || ty < 0 || tx >= R.GH.w || ty >= R.GH.h) return;
    onPlot('g' + tx + ',' + ty); draw(); $('#ghMsg').innerHTML = $('#fmsg').innerHTML;
  });
  $('#ghClose').addEventListener('click', closeModal);
}
function closeModal(){ $('#modal').hidden = true; }
// ---------- 우편함 ----------
function openMail(){
  const box = W.mail[key] || [];
  const inner = $('#modalInner');
  const who = g => g.from === 'postcard' ? '그림엽서' : g.from === 'festival' ? '축제' : g.from === 'board' ? '게시판' : g.from === 'move' ? '이삿날' : g.from === 'santa' ? '🎅 산타 할아버지' : g.from === 'genie' ? '🧞 램프 요정' : g.from === 'ark' ? '🛶 방주' : NAME[g.from] || '';
  inner.innerHTML = '<h3 class="pixel">우편함</h3>' + (box.length ? box.map(g =>
    '<div class="mailrow' + (g.from === 'postcard' ? ' postcard' : '') + '"><b>' + (g.from === 'postcard' ? '🖼️ 그림엽서' : g.id === 'note' ? '💌 쪽지' : g.id === 'coins' ? '🪙 ' + g.n + ' 동전' : escapeHTML(R.itemName(g.id)) + ' ' + g.n + '개') + '</b>' +
    '<span class="from">' + who(g) + (g.note ? ' · "' + escapeHTML(g.note) + '"' : '') + '</span></div>').join('') :
    '<p class="msg">비었어요. ' + NAME[R.OTHER[key]] + '가 선물이나 쪽지를 보내면 여기로 와요.</p>') +
    '<div class="modal-actions"><button type="button" class="dot-btn small" id="mailNote">✏️ 쪽지 쓰기</button>'
    + (box.length ? '<button type="button" class="dot-btn small primary" id="mailTake">다 받기</button>' : '')
    + '<button type="button" class="dot-btn small" id="mailClose">닫기</button></div>';
  $('#modal').hidden = false;
  $('#mailClose').addEventListener('click', closeModal);
  $('#mailNote').addEventListener('click', noteDialog);
  const t = $('#mailTake'); if (t) t.addEventListener('click', () => { const r = act((w, m) => R.openMail(w, m, now())); if (r.ok) sfx('fanfare'); closeModal(); });
}
/* 쪽지 — 물건 없이 한 마디만. 선물 창과 같은 모양이라 아이가 헷갈리지 않는다. */
function noteDialog(){
  $('#modalInner').innerHTML = '<h3 class="pixel">' + NAME[R.OTHER[key]] + '에게 쪽지</h3>'
    + '<p class="msg" style="margin:0;">한 마디만 적어 보내요. 하루에 다섯 통까지요.</p>'
    + '<input type="text" id="nText" maxlength="60" placeholder="예: 오늘 딸기 심었어!">'
    + '<div class="modal-actions"><button type="button" class="dot-btn small" id="nCancel">취소</button>'
    + '<button type="button" class="dot-btn small primary" id="nGo">보내기</button></div>';
  $('#modal').hidden = false;
  const go = () => { const r = act((w, m) => R.sendNote(w, m, $('#nText').value, now())); if (r.ok) sfx('sparkle'); closeModal(); };
  $('#nCancel').addEventListener('click', closeModal);
  $('#nGo').addEventListener('click', go);
  $('#nText').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  $('#nText').focus();
}
function openPeddler(){
  const stock = R.peddlerStock(W, now());
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">🛒 행상인</h3><p class="sub">이레에 두 번쯤 와요. 오늘 물건은 셋, 둘이 하나씩 살 수 있어요.</p>'
    + '<div id="pedWant"></div><div id="pedRows"></div><div class="modal-actions"><button type="button" class="dot-btn small" id="pedClose">닫기</button></div>';
  // 오늘 그가 두 배로 사 가는 물건 — 파는 쪽이 먼저 눈에 띄어야 「모아 뒀다 판다」가 된다
  const want = R.peddlerWant(W, now());
  if (want){
    const left = R.peddlerSoldLeft(M, now()), have = R.countOf(M, want.id);
    const n = Math.min(have, left);
    const each = R.sellPrice(want.id, W, now()) * want.mult;
    const wb = $('#pedWant'); wb.className = 'wantrow';
    wb.appendChild(itemIcon(want.id));
    const tx = document.createElement('span');
    // 「우유을」 처럼 어긋나지 않게 조사는 규칙에 맡긴다 — 이름만 굵게 하려고 조사 한 글자를 떼어 쓴다
    const wnm = R.itemName(want.id), josa = R.eul(wnm).slice(wnm.length);
    tx.innerHTML = '오늘은 <b>' + escapeHTML(wnm) + '</b>' + josa + ' <b>두 배</b>로 사 가요'
      + '<br><span class="sub" style="margin:0;">한 개에 ' + each + ' 동전 · 가진 것 ' + have + '개 · 오늘 ' + left + '개까지</span>';
    wb.appendChild(tx);
    // 못 파는 까닭이 「없어서」인지 「오늘 몫을 다 써서」인지 구별해 준다
    const why = left <= 0 ? '오늘 몫은 다 팔았어요' : '팔 것이 없어요';
    const sb2 = btn(n ? '🪙 ' + n + '개 팔기' : why, 'sm buy', () => {
      const r = act((w, m) => R.sellToPeddler(w, m, n, now()));
      if (r.ok) sfx('cart');
      openPeddler();
    }, !n);
    sb2.style.marginLeft = 'auto';
    wb.appendChild(sb2);
  }
  const rows = $('#pedRows');
  stock.forEach(it => {
    const got = R.peddlerGot(M, now(), it.slot);
    const d = document.createElement('div'); d.className = 'mailrow';
    d.innerHTML = '<b>' + escapeHTML(R.itemName(it.id)) + (it.n > 1 ? ' ' + it.n + '개' : '') + '</b>'
      + '<span class="from">' + escapeHTML(it.desc) + '</span>';
    const b = btn(got ? '샀어요' : '🪙 ' + it.cost, 'sm buy', () => {
      const r = act((w, m) => R.buy(w, m, 'ped:' + it.slot, now()));
      if (r.ok) sfx(r.box ? 'fanfare' : 'pop');
      openPeddler();
    }, got || M.coins < it.cost);
    b.style.marginLeft = 'auto';
    d.appendChild(b); rows.appendChild(d);
  });
  $('#modal').hidden = false;
  $('#pedClose').addEventListener('click', closeModal);
}
function openTab(t, goTo){ tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); ['bag', 'shop', 'house', 'duo', 'ark', 'dex'].forEach(k => { const el = $('#tab-' + k); if (el) el.hidden = k !== t; }); renderTab(); if (goTo) scrollToPanel(); }
function scrollToPanel(){
  const bar = $('#tabs'); if (!bar) return;
  /* 머리글은 붙박이인데 아래로 밀면 스스로 숨는다. 지금 숨었는지를 보고 셈하면,
     내려가는 사이에 도로 나타났을 때 탭 줄을 덮는다 — 늘 그 높이만큼 뺀다.
     숨어 있었다면 그만큼 지도 끝자락이 위에 남을 뿐, 가려지는 일은 없다. */
  const head = document.querySelector('header.site');
  const off = head && getComputedStyle(head).position === 'fixed' ? head.offsetHeight : 0;
  const y = window.scrollY + bar.getBoundingClientRect().top - off - 8;
  window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: STILL ? 'auto' : 'smooth' });
}
function renderTab(){ if (tab === 'bag') renderBag(); else if (tab === 'shop') renderShop(); else if (tab === 'house') renderHouse(); else if (tab === 'duo') renderDuo(); else if (tab === 'ark') renderArk(); else renderDex(); }
function renderAll(){ syncTop(); renderTools(); drawFarm(); renderTab(); }
// 작은 그림 — 작물은 밭 그림을, 물건은 색 네모를.
function cropIcon(c){
  // 한 칸이 32도트가 되었으니 아이콘도 32x32 에 한 도트 한 픽셀로 그린다
  const cv = document.createElement('canvas'); cv.width = T; cv.height = T;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#e6d7b5'; g.fillRect(0, 0, T, T);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  // 키 큰 작물(옥수수 개꼬리)은 칸 위로 넘친다 — 먼저 위아래 끝을 재어, 넘친 만큼 아래로 내려 그린다
  let top = T, bot = 0;
  drawCrop(0, 0, c, 4, false, (x, y, w, h) => { top = Math.min(top, Math.round(y)); bot = Math.max(bot, Math.round(y + h)); });
  drawCrop(0, Math.max(0, Math.min(1 - top, T - bot)), c, 4, false, P);
  return cv;
}
/* 요리 그림 — 32x32 에 한 도트 한 픽셀. 층을 쌓아 그린다:
   바닥 그림자 → 그릇(접시·사발·병·잔·파이 틀) → 음식(그늘·바탕·하이라이트 3단) → 고명 → 외곽선 → 김·반짝이.
   외곽선은 그림 둘레 빈칸을 옆 색보다 어둡게 칠해 저절로 두른다. 김과 반짝이는 외곽선 뒤에 얹어 테가 없다.
   도우미는 전역에 두지 않는다 — 늦게 받는 짝 스크립트라 farm.js 이름과 부딪히면 통째로 멈춘다. */
const dishIcon = (() => {
  const S = 32;
  function canvasOf(){
    const px = new Array(S * S).fill(null), fx = [];
    const set = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && x < S && y >= 0 && y < S) px[y * S + x] = c; };
    const b = {
      set: set,
      r: (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); },
      // 타원. clip(x,y) 가 있으면 그 안만 칠한다
      e: (cx, cy, rx, ry, c, clip) => {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++){
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1 && (!clip || clip(x, y))) set(x, y, c);
        }
      },
      d: (c, ...xy) => { for (let i = 0; i < xy.length; i += 2) set(xy[i], xy[i + 1], c); },
      // 다각형 — 칸 한가운데가 안에 드는지 광선으로 센다
      poly: (pts, c) => {
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
          const X = x + 0.5, Y = y + 0.5; let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > Y) !== (yj > Y) && X < (xj - xi) * (Y - yi) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) set(x, y, c);
        }
      },
      fx: (c, ...xy) => { for (let i = 0; i < xy.length; i += 2) fx.push([xy[i], xy[i + 1], c]); },
      px: px, fxs: fx,
    };
    // 둥근 더미 — 아래 그늘, 바탕, 왼쪽 위 하이라이트
    b.m = (cx, cy, rx, ry, c) => { b.e(cx, cy, rx, ry, shade(c, -30)); b.e(cx, cy - 1, rx - 0.5, ry - 1, c); b.e(cx - rx * 0.3, cy - ry * 0.45, rx * 0.45, ry * 0.35, shade(c, 28)); };
    return b;
  }

  // ---------- 그릇 ----------
  const plate = b => {
    b.e(16, 24, 15, 5, '#d6cdbd'); b.e(16, 23, 15, 5, '#fbf8f2');
    b.e(16, 23, 12, 3.6, '#e9e2d4'); b.e(16, 23.5, 11, 3, '#f3eee4'); b.r(6, 19, 6, 1, '#ffffff');
  };
  const bowl = (b, food) => {
    const body = (x, y) => y >= 15;
    b.e(16, 15, 13, 12, '#f1ebdf', body); b.e(16, 15, 13, 12, '#d9d0c0', (x, y) => y >= 15 && x >= 22);
    b.e(16, 15, 13, 12, '#6d8fc7', (x, y) => y === 20 || y === 21); b.e(16, 15, 13, 12, '#4f6fa8', (x, y) => (y === 20 || y === 21) && x >= 22);
    b.r(5, 17, 2, 3, '#fffdf8'); b.r(6, 23, 2, 1, '#fffdf8');
    b.r(11, 26, 10, 2, '#cfc5b3'); b.r(12, 28, 8, 1, '#b3a893');
    b.e(16, 15, 13, 4, '#fbf8f2'); b.e(16, 15, 11.5, 3, shade(food, -30)); b.e(16, 14.6, 11, 2.6, food);
    b.r(6, 12, 5, 1, '#ffffff');
  };
  const jar = (b, fill, lid) => {
    b.r(7, 9, 18, 20, '#cfe6ea'); b.d(null, 7, 9, 24, 9, 7, 28, 24, 28);
    b.r(8, 11, 16, 17, fill); b.r(8, 11, 16, 1, shade(fill, 34)); b.r(20, 12, 4, 16, shade(fill, -28)); b.r(8, 27, 16, 1, shade(fill, -40));
    b.r(9, 12, 2, 13, '#f4fbfc'); b.r(22, 13, 1, 4, '#f4fbfc');
    b.r(9, 7, 14, 2, '#bcd8de'); b.r(8, 3, 16, 4, lid); b.r(8, 6, 16, 1, shade(lid, -34)); b.r(9, 3, 7, 1, shade(lid, 30));
  };
  const pieDish = (b, fill) => {
    b.r(3, 17, 26, 8, '#c98a4b'); b.r(3, 17, 26, 1, '#dca468'); b.r(22, 18, 7, 7, '#b57840'); b.r(5, 25, 22, 2, '#a56a35');
    b.d('#dca468', 6, 20, 10, 20, 14, 20, 18, 20);
    b.e(16, 16, 14, 5, '#e0a868'); b.e(16, 16.6, 11.5, 3.4, shade(fill, -30)); b.e(16, 16, 11.5, 3.2, fill); b.e(12, 15, 5, 1.3, shade(fill, 28));
    for (let i = 0; i < 16; i++){                                       // 가장자리 주름
      const a = i / 16 * Math.PI * 2, x = 16 + 13 * Math.cos(a), y = 16 + 4.4 * Math.sin(a);
      b.set(x, y, i % 2 ? '#c98a4b' : '#f2c088');
    }
  };
  const steam = b => b.fx('#fbf6ea', 11, 7, 12, 6, 12, 5, 11, 4, 11, 3, 12, 2, 19, 6, 20, 5, 20, 4, 19, 3, 19, 2, 20, 1, 15, 4, 16, 3, 16, 2);
  const sparkle = (b, x, y) => b.fx('#ffffff', x, y, x - 1, y, x + 1, y, x, y - 1, x, y + 1);
  const leaf = (b, x, y, c) => { b.e(x, y, 2.5, 1.5, c); b.set(x - 1, y - 1, shade(c, 40)); };

  // ---------- 요리 ----------
  const ART = {
    salad: b => { plate(b);
      b.e(8, 19.5, 4, 2.5, '#5e9e4c'); b.e(8, 19, 3, 1.8, '#9fdc85'); b.e(24, 19.5, 4, 2.5, '#5e9e4c'); b.e(24, 19, 3, 1.8, '#9fdc85'); b.d('#5e9e4c', 7, 19, 24, 19);
      b.m(16, 18, 9, 5, '#f0d27a');
      b.r(11, 15, 3, 3, '#f7e3a0'); b.r(11, 17, 3, 1, '#d8b75a'); b.r(17, 14, 3, 3, '#f7e3a0'); b.r(17, 16, 3, 1, '#d8b75a'); b.r(19, 18, 3, 2, '#f7e3a0'); b.r(19, 19, 3, 1, '#d8b75a');
      b.e(15, 13.5, 2.5, 1.8, '#ffffff'); b.d('#f7c52e', 15, 13, 16, 13);
      b.d('#f08a3a', 13, 19, 21, 16, 10, 17, 16, 20); b.d('#4f9a3e', 14, 16, 18, 19, 20, 14, 12, 20); b.d('#3a3226', 12, 18, 19, 15, 17, 18);
    },
    jam: b => { jar(b, '#b0202e', '#f5f5f5');
      b.d('#e05a5a', 9, 3, 10, 3, 13, 3, 14, 3, 17, 3, 18, 3, 21, 3, 22, 3, 11, 5, 12, 5, 15, 5, 16, 5, 19, 5, 20, 5);
      b.r(7, 7, 18, 1, '#b98a4f'); b.r(8, 11, 16, 1, '#e84a58');
      b.r(11, 16, 10, 8, '#fff6e2'); b.r(11, 23, 10, 1, '#e8d9b8');
      b.e(16, 20.5, 2.5, 2.5, '#e0323f'); b.set(15, 19, '#ff8a8a'); b.r(15, 17, 3, 1, '#5e9e4c'); b.set(16, 16, '#5e9e4c'); b.d('#ffe27a', 15, 21, 17, 20, 16, 22);
    },
    soup: b => { bowl(b, '#f5c542');
      b.d('#fff3c8', 11, 13, 12, 13, 13, 14, 14, 14, 15, 14, 16, 13, 17, 13, 18, 14, 19, 14);
      [[9, 14], [20, 12], [22, 15], [17, 16], [13, 16]].forEach(([x, y]) => { b.r(x, y, 2, 1, '#ffd84a'); b.set(x + 1, y, '#d9a520'); });
      b.r(14, 15, 2, 2, '#c98a4b'); b.set(14, 15, '#e5b377'); b.r(19, 15, 2, 2, '#c98a4b'); b.set(19, 15, '#e5b377');
      b.d('#4f9a3e', 11, 15, 18, 12, 21, 14); steam(b);
    },
    pasta: b => { plate(b);
      b.m(16, 19, 10, 4.5, '#f0c862');
      b.r(8, 19, 4, 1, '#d4a640'); b.r(19, 20, 5, 1, '#d4a640'); b.r(12, 21, 6, 1, '#d4a640'); b.r(21, 17, 3, 1, '#d4a640');
      b.r(9, 17, 4, 1, '#fbe39a'); b.r(20, 19, 3, 1, '#fbe39a'); b.r(14, 22, 3, 1, '#fbe39a');
      b.m(16, 16, 6.5, 3.2, '#d6452f'); b.e(13, 15, 1.6, 1.2, '#f06a4f'); b.e(19, 16, 1.6, 1.2, '#f06a4f'); b.set(18, 13, '#a82a1a');
      leaf(b, 18, 12.5, '#4f9a3e'); b.d('#fff6d8', 15, 14, 17, 15, 12, 16, 20, 15);
    },
    pie: b => { pieDish(b, '#f08a24');
      b.e(16, 13.5, 3.2, 2, '#e8dcc8'); b.e(16, 13, 3, 1.7, '#fffaf0'); b.e(16, 11.5, 2, 1.4, '#ffffff'); b.set(16, 10, '#ffffff');
      b.d('#a8561a', 10, 16, 21, 17, 20, 15, 12, 18, 23, 16); b.fx('#ffffff', 15, 11);
    },
    cookie: b => { plate(b);
      const disc = (cx, cy, r) => { b.e(cx, cy + 1.2, r, r * 0.55, '#a56a35'); b.e(cx, cy, r, r * 0.55, '#d9a060'); b.e(cx - 1, cy - 1, r * 0.6, r * 0.28, '#ecc08a'); };
      disc(10, 20, 6); b.d('#5a3218', 8, 20, 12, 21, 10, 19);
      disc(22, 20, 6); b.d('#5a3218', 20, 20, 24, 19, 23, 21);
      disc(16, 15, 6.5); b.d('#5a3218', 13, 15, 18, 16, 16, 14, 20, 15);
      b.d('#f7b733', 11, 13, 12, 14, 13, 13, 14, 14, 15, 13, 16, 14, 17, 13, 18, 14, 19, 13, 20, 14, 20, 15, 20, 16);
      b.d('#ffd76a', 12, 13, 16, 13, 18, 13); sparkle(b, 25, 9);
    },
    juice: b => {
      for (let y = 6; y <= 27; y++){ const h = Math.round(7 - (y - 6) * 0.1); b.r(16 - h, y, h * 2, 1, '#d7eef3'); }
      for (let y = 10; y <= 26; y++){ const h = Math.round(6 - (y - 6) * 0.1); b.r(16 - h, y, h * 2, 1, y < 13 ? '#a060c8' : y < 21 ? '#7b3fa0' : '#5e2f82'); b.set(16 + h - 1, y, '#4a2468'); }
      b.r(11, 11, 4, 4, '#e8d8f5'); b.r(11, 11, 4, 1, '#ffffff'); b.r(17, 13, 4, 4, '#d8c0ee'); b.r(17, 13, 4, 1, '#f4ecfb');
      b.d('#c8a0e8', 13, 20, 18, 23, 15, 25, 12, 23);
      b.r(10, 8, 1, 17, '#ffffff'); b.r(9, 6, 14, 1, '#ffffff'); b.r(8, 28, 16, 2, '#c4e0e7'); b.r(8, 28, 16, 1, '#e6f4f7');
      b.r(19, 1, 2, 14, '#ff6b8a'); b.r(19, 1, 6, 2, '#ff6b8a'); b.d('#ffffff', 19, 4, 20, 5, 19, 8, 20, 9, 19, 12, 20, 13, 22, 1, 23, 2);
      b.e(8.5, 7, 2.2, 2.2, '#7b3fa0'); b.set(8, 6, '#c090e0'); b.set(9, 4, '#5e9e4c');
    },
    kimchi: b => { plate(b);
      b.m(16, 18, 9.5, 5, '#d8452f');
      b.r(10, 17, 6, 2, '#f3d2b0'); b.r(10, 19, 6, 1, '#e0a080'); b.r(18, 15, 5, 2, '#f3d2b0'); b.r(18, 17, 5, 1, '#e0a080'); b.r(14, 20, 5, 1, '#f3d2b0');
      b.r(12, 14, 6, 1, '#b02e1a'); b.r(17, 19, 5, 1, '#b02e1a'); leaf(b, 21, 20, '#6fae5c'); leaf(b, 10, 15, '#6fae5c');
      b.d('#8a1a0a', 12, 16, 19, 18, 15, 21, 22, 16, 16, 15); b.d('#fff6d8', 14, 16, 17, 19, 20, 17, 11, 20);
    },
    omelet: b => { plate(b);
      b.e(16, 19, 10.5, 4.6, '#d8a82a'); b.e(16, 18, 10, 4, '#f7d23e'); b.e(13, 16.5, 5, 1.4, '#fde68a');
      for (let x = 9; x <= 22; x++){ const y = 17 + (x % 2); b.set(x, y, '#d8323f'); b.set(x, y + 1, '#a51f2a'); }
      leaf(b, 20, 15, '#4f9a3e'); b.e(26, 21, 2.2, 2.2, '#e0323f'); b.set(25, 20, '#ff9a9a'); b.set(26, 18, '#4f9a3e');
      b.e(6, 21, 3, 1.6, '#8fcf7a'); b.set(5, 20, '#c0eba8');
    },
    risotto: b => { plate(b);
      b.m(16, 19, 10, 4.6, '#efe3c2');
      b.d('#fffaf0', 10, 18, 13, 20, 17, 21, 21, 19, 24, 20, 15, 17, 19, 22);
      b.d('#d6c595', 9, 20, 12, 22, 18, 22, 22, 21, 25, 19, 14, 21);
      [[12, 16], [19, 15], [17, 19], [23, 18]].forEach(([x, y]) => { b.e(x, y, 2.2, 1.3, '#5a3e2b'); b.set(x - 1, y - 1, '#8a6a52'); b.set(x + 1, y, '#3a2618'); });
      b.d('#4f9a3e', 14, 18, 21, 17, 10, 19, 16, 15); b.d('#fff3c0', 15, 20, 20, 20, 11, 17);
    },
    stew: b => { bowl(b, '#d8452f');
      b.e(11.5, 13.5, 3.6, 2, '#f4ead8'); b.r(9, 12, 6, 1, '#8a98a0'); b.set(10, 12, '#b8c4ca');
      b.r(17, 11, 3, 3, '#fffaf0'); b.r(17, 13, 3, 1, '#e3dccb'); b.r(19, 11, 1, 3, '#ece5d4');
      b.r(20, 15, 4, 2, '#f5f0e0'); b.r(20, 16, 4, 1, '#d8d0bc');
      b.d('#6fae5c', 14, 16, 15, 16, 22, 13, 23, 13, 8, 15); b.d('#a8e08a', 14, 15, 22, 12);
      b.e(8.5, 16, 1.5, 1, '#8a1a0a'); b.d('#ff8a5a', 12, 16, 17, 15, 21, 14, 7, 14); steam(b);
    },
    sushi: b => {
      b.r(2, 21, 28, 4, '#c08650'); b.r(2, 21, 28, 1, '#d9a068'); b.r(5, 25, 3, 3, '#9a6a3a'); b.r(24, 25, 3, 3, '#9a6a3a');
      b.d('#a8743f', 4, 23, 5, 23, 9, 22, 10, 22, 14, 23, 15, 23, 20, 22, 21, 22, 26, 23, 27, 23);
      [9, 23].forEach(cx => {
        b.e(cx, 18.5, 5.5, 3.4, '#ddd8cc'); b.e(cx, 18, 5.5, 3, '#f7f4ee'); b.d('#ffffff', cx - 3, 18, cx + 1, 19, cx - 1, 17); b.d('#e6e1d6', cx + 3, 19, cx - 2, 20);
        b.e(cx, 15.5, 6, 2.6, '#e0683a'); b.e(cx, 15, 5.8, 2.2, '#ff8c5a');
        b.d('#ffd0b0', cx - 4, 15, cx - 3, 14, cx - 1, 16, cx, 15, cx + 1, 14, cx + 3, 16, cx + 4, 15); b.set(cx - 3, 13, '#ffe0c8');
      });
      b.e(16, 20, 1.6, 1.1, '#8fcf5a'); b.set(15, 19, '#c0ee90'); sparkle(b, 12, 9);
    },
    shrimprice: b => { plate(b);
      b.m(16, 18, 10, 5, '#e9c46a');
      b.d('#f7e0a0', 10, 17, 13, 19, 18, 21, 22, 18, 24, 20, 16, 16, 12, 21);
      b.d('#c9a040', 9, 20, 14, 22, 20, 21, 23, 21, 15, 19);
      b.d('#fbe27a', 11, 18, 19, 19, 17, 17); b.d('#6fae5c', 14, 17, 20, 16, 12, 20, 22, 20); b.d('#f08a3a', 16, 20, 23, 18, 10, 19);
      [[11, 15], [21, 16]].forEach(([x, y]) => {
        b.e(x, y, 3.2, 2.6, '#ff8c7a'); b.e(x + 0.6, y + 0.6, 1.3, 1, '#e9c46a'); b.set(x - 2, y - 1, '#ffb8a8');
        b.d('#e0604a', x - 1, y - 2, x + 1, y - 2, x + 2, y); b.r(x + 2, y + 1, 2, 2, '#e0402a');
      });
    },
    ayu: b => { plate(b);
      b.e(26, 22, 2.5, 1.6, '#f7e24a'); b.set(25, 21, '#fff6a0');
      b.r(25, 15, 2, 6, '#6e7e64'); b.r(27, 14, 2, 8, '#6e7e64'); b.d('#ffffff', 28, 14, 28, 15, 28, 20, 28, 21);
      b.e(15, 18, 10.5, 3.6, '#8e9c82'); b.e(15, 19.6, 9, 1.8, '#e8e4d4'); b.e(15, 16, 9, 1.2, '#5e6e58');
      [11, 15, 19].forEach(x => { b.r(x, 16, 1, 3, '#3a2e22'); b.set(x + 1, 16, '#3a2e22'); });
      b.e(8, 17.5, 1.3, 1.3, '#ffffff'); b.set(8, 17, '#2a2a2a'); b.d('#c8c0a8', 6, 19, 7, 19);
      b.d('#ffffff', 13, 17, 17, 18, 21, 17, 10, 18, 23, 18);
    },
    crayfish: b => { plate(b);
      b.d('#b02a18', 14, 12, 13, 11, 12, 10, 11, 9, 10, 8, 18, 12, 19, 11, 20, 10, 21, 9, 22, 8);
      b.r(10, 14, 3, 1, '#c33520'); b.r(19, 14, 3, 1, '#c33520');
      b.e(7.5, 12.5, 3.2, 2.2, '#e0432a'); b.d(null, 5, 12, 6, 12); b.set(7, 11, '#ff7a5a');
      b.e(24.5, 12.5, 3.2, 2.2, '#e0432a'); b.d(null, 26, 12, 27, 12); b.set(24, 11, '#ff7a5a');
      b.e(16, 16, 4, 3, '#e0432a'); b.e(15, 15, 2, 1.2, '#ff7a5a');
      [19.5, 22, 24.3].forEach((y, i) => { b.e(16, y, 3.6 - i * 0.4, 1.5, '#e0432a'); b.r(13 + i, Math.round(y) + 1, 6 - i * 2, 1, '#b02a18'); b.set(15, Math.floor(y) - 1, '#ff7a5a'); });
      b.e(16, 26, 3.2, 1.4, '#c33520'); b.d('#2a2a2a', 14, 14, 18, 14);
    },
    carpsteam: b => { plate(b);
      b.e(16, 22, 12, 3, '#b8382a'); b.e(16, 21.6, 11, 2.4, '#c8452a');
      b.r(25, 15, 3, 7, '#b8782a'); b.r(27, 14, 2, 9, '#b8782a');
      b.e(15, 18, 10.5, 4, '#b8782a'); b.e(15, 17.5, 10, 3.5, '#d99a45'); b.e(13, 16, 6, 1.4, '#f5c070');
      b.d('#b8782a', 12, 18, 14, 19, 16, 18, 18, 19, 20, 18, 22, 19);
      b.r(8, 17, 14, 1, '#c8452a'); b.d('#c8452a', 10, 18, 15, 16, 19, 18);
      b.d('#6fae5c', 11, 15, 12, 15, 17, 14, 18, 14, 21, 16); b.d('#a8e08a', 14, 15, 20, 15); b.d('#e0323f', 13, 14, 19, 16);
      b.e(7, 17, 1.3, 1.3, '#ffffff'); b.set(7, 17, '#2a2a2a'); b.fx('#ffffff', 12, 15);
    },
    smeltfry: b => { plate(b);
      const stick = (cx, cy) => { b.e(cx, cy, 7, 1.9, '#c9862a'); b.e(cx, cy - 0.4, 6.6, 1.4, '#dba03a'); b.r(cx - 4, cy - 1, 6, 1, '#f5cf6e'); b.d('#fbe39a', cx - 2, cy, cx + 3, cy); b.d('#a86a20', cx - 5, cy, cx + 1, cy); b.r(cx + 7, cy - 1, 2, 2, '#a86a20'); };
      stick(13, 21); stick(17, 18); stick(12, 15); stick(18, 13);
      b.e(26, 21, 2.5, 1.6, '#f7e24a'); b.set(25, 20, '#fff6a0'); b.d('#4f9a3e', 5, 20, 6, 19); sparkle(b, 8, 9);
    },
    catstew: b => { bowl(b, '#a83222');
      b.e(11.5, 13.5, 3.6, 2, '#f0e6d4'); b.r(9, 12, 6, 1, '#5a5048'); b.set(10, 12, '#7a7068');
      b.e(20, 12, 3.2, 1.6, '#3f7a3a'); b.r(18, 12, 5, 1, '#5e9e4c'); b.set(22, 11, '#6fae5c');
      b.r(19, 15, 4, 2, '#f5f0e0'); b.r(19, 16, 4, 1, '#d8d0bc');
      b.e(8.5, 16, 1.5, 1, '#e0323f'); b.d('#6fae5c', 14, 16, 15, 16, 23, 14); b.d('#d8452f', 12, 16, 16, 12, 22, 16); steam(b);
    },
    eelbowl: b => { bowl(b, '#fbf7ee');
      [[5, 11], [12, 10], [19, 11]].forEach(([x, y]) => {
        b.r(x, y, 7, 4, '#8a4a22'); b.r(x, y, 7, 1, '#c07a40'); b.r(x, y + 3, 7, 1, '#6a3418');
        b.d('#4a2410', x + 2, y + 1, x + 3, y + 2, x + 5, y + 1); b.set(x + 1, y + 1, '#e0a060');
      });
      b.d('#6a3418', 8, 15, 15, 14, 22, 15); b.r(21, 15, 4, 1, '#f7d23e'); b.d('#6fae5c', 11, 15, 18, 15); b.d('#fff6d8', 9, 12, 16, 11, 23, 12); b.fx('#ffffff', 14, 10);
    },
    pufferstew: b => { bowl(b, '#e4ecdc');
      b.e(10.5, 13.5, 3, 1.8, '#dde2d6'); b.e(10.5, 13, 2.8, 1.5, '#ffffff'); b.e(19, 12.5, 3, 1.8, '#dde2d6'); b.e(19, 12, 2.8, 1.5, '#ffffff');
      b.d('#f5ecd0', 14, 12, 14, 13, 14, 14, 15, 12, 15, 13, 15, 14); b.d('#c8b484', 14, 11, 15, 11);
      b.e(21.5, 15.5, 2.5, 1.2, '#f5f0e0'); b.set(21, 16, '#d8d0bc');
      b.d('#5e9e4c', 8, 15, 9, 15, 17, 15, 18, 16, 23, 13); b.d('#8fcf7a', 9, 16, 18, 15, 24, 13); b.d('#f4f8ee', 12, 15, 20, 14); steam(b);
    },
    pickle: b => { jar(b, '#d9cf86', '#8a5f3a');
      b.d('#6e4a2a', 12, 4, 12, 5, 16, 4, 16, 5, 20, 4, 20, 5);
      [[10, 13, 4, 13], [15, 12, 4, 14], [20, 14, 3, 12]].forEach(([x, y, w, h]) => {
        b.r(x, y, w, h, '#5d9a4c'); b.r(x, y, 1, h, '#8fcf7a'); b.r(x + w - 1, y, 1, h, '#3f7a36');
        b.d('#3f7a36', x + 1, y + 3, x + 2, y + 7, x + 1, y + 10); b.set(x + 1, y, '#9fd88a');
      });
      b.r(13, 11, 3, 1, '#e0323f'); b.e(19, 25, 1.6, 1.1, '#fff6e2');
    },
    starpie: b => { pieDish(b, '#8a5fd0');
      const pts = []; for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.8 : 6.5; pts.push([16 + r * Math.cos(a), 11 + r * Math.sin(a)]); }
      b.poly(pts, '#ffd84a'); b.poly(pts.map(([x, y]) => [x + (x - 16) * -0.35, y + (y - 11) * -0.35]), '#fff0a0');
      b.d('#e0a820', 19, 13, 20, 14, 18, 15, 13, 14, 16, 16); b.d('#6e44b0', 10, 17, 21, 16, 14, 18);
      sparkle(b, 6, 6); sparkle(b, 26, 9); b.fx('#ffffff', 23, 3, 9, 12);
    },
  };

  const cache = {};
  function pixels(v){
    if (cache[v]) return cache[v];
    const b = canvasOf();
    (ART[v] || (x => { plate(x); x.m(16, 18, 8, 4, '#ffb3a7'); }))(b);   // 그림 없는 새 요리는 접시 위 덩어리
    const out = b.px.slice();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){          // 외곽선 — 이웃 색보다 한참 어둡게
      if (b.px[y * S + x]) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (x + dx >= 0 && x + dx < S && y + dy >= 0 && y + dy < S) ? b.px[(y + dy) * S + x + dx] : null).find(Boolean);
      if (n) out[y * S + x] = shade(n, -80);
    }
    return (cache[v] = { px: out, fx: b.fxs });
  }
  return function (v){
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const P = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    g.fillStyle = '#e6d7b5'; g.fillRect(0, 0, S, S);
    const bg = canvasOf(); bg.e(16, 28, 13, 2.5, '#d4c29c'); bg.px.forEach((c, i) => c && P(i % S, i / S | 0, c));   // 바닥 그림자
    const d = pixels(v);
    d.px.forEach((c, i) => c && P(i % S, i / S | 0, c));
    d.fx.forEach(([x, y, c]) => P(x, y, c));
    return cv;
  };
})();
function itemIcon(id){
  const [k, v] = id.split(':');
  if (k === 'dish') return dishIcon(v);
  if (k === 'gold'){                                    // 반짝 작물 — 같은 그림에 금테와 반짝임을 두른다
    const cv = cropIcon(v), g = cv.getContext('2d');
    g.fillStyle = '#ffd979'; g.fillRect(0, 0, 32, 2); g.fillRect(0, 30, 32, 2); g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32);
    g.fillStyle = '#fff6c0'; g.fillRect(24, 4, 2, 2); g.fillRect(22, 6, 6, 2); g.fillRect(24, 8, 2, 2);
    return cv;
  }
  if (k === 'crop' || k === 'seed' || k === 'giant') { const cv = cropIcon(v); if (k === 'seed'){ const g = cv.getContext('2d'); g.fillStyle = '#fff6e9cc'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#8a5f3a'; g.fillRect(10, 12, 4, 6); g.fillRect(18, 10, 4, 6); g.fillRect(14, 18, 4, 6); } return cv; }
  if (k === 'fish'){
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * 2, y * 2, w * 2, h * 2); };
    P(0, 0, 16, 16, '#bfe4f7'); P(0, 0, 16, 5, '#d7eefb');
    const F = R.FISH[v] || { c: '#a9c4d6' };
    if (v === 'boot'){ P(4, 6, 6, 8, F.c); P(4, 12, 9, 2, shade(F.c, -22)); P(5, 5, 4, 2, shade(F.c, 20)); }
    else if (F.shape === 'shrimp'){                          // 새우·가재 — 머리는 오른쪽, 등이 굽어 꼬리가 왼쪽 아래
      P(9, 5, 4, 5, F.c); P(6, 4, 4, 4, F.c); P(4, 5, 3, 4, F.c); P(2, 7, 3, 3, F.c);
      P(1, 9, 3, 2, shade(F.c, -12));                                        // 꼬리 부채
      P(7, 4, 5, 1, shade(F.c, 26)); P(4, 8, 8, 1, shade(F.c, -24));         // 등 빛 · 배 그늘
      P(10, 10, 1, 2, shade(F.c, -12)); P(8, 8, 1, 2, shade(F.c, -12)); P(6, 9, 1, 2, shade(F.c, -12));   // 다리
      P(13, 2, 1, 3, shade(F.c, -30)); P(11, 3, 1, 2, shade(F.c, -30));      // 더듬이
      P(11, 6, 1, 1, '#2a2a2a');
    } else {
      P(3, 6, 9, 5, F.c); P(3, 7, 7, 2, shade(F.c, 26)); P(6, 9, 6, 2, shade(F.c, -26));
      P(11, 5, 3, 2, F.c); P(11, 10, 3, 2, F.c); P(12, 6, 2, 5, shade(F.c, -18));
      P(2, 7, 1, 1, '#2a2a2a'); P(5, 5, 3, 1, shade(F.c, 30));
    }
    return cv;
  }
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; const g = cv.getContext('2d');
  const col = { pitch: '#2a201a', olive: '#6a8a4a', egg: '#fff6e9', bigegg: '#ffe9a8', milk: '#ffffff', goldmilk: '#ffd979', wool: '#f7f3ee', honey: '#f7b733', berry: '#ff5c6b', wood: '#a97b4f', stone: '#a49c92', fert: '#8a5f3a', snowball: '#eef8ff', sprinkler: '#b9924a', sprinkler2: '#c9d6e0', firefly: '#ffe66d', shard: '#9ef0d0', moss: '#9fb88a', pinecone: '#8a5a32', sandrose: '#e8b088', date: '#a0522a', syrup: '#c8781e', chestnut: '#7a4a2a', acorn: '#a0703a', mango: '#ff8a20', banana: '#f0c830', feather: '#2a8ae8', baobab: '#9a9a62' }[id] || (k === 'f' ? R.FURNITURE[v].c : '#ddd');
  g.fillStyle = '#e6d7b5'; g.fillRect(0, 0, 32, 32); g.fillStyle = col; g.fillRect(8, 8, 16, 16); g.fillStyle = '#3a3226'; g.fillRect(8, 8, 16, 2); g.fillRect(8, 22, 16, 2); g.fillRect(8, 8, 2, 16); g.fillRect(22, 8, 2, 16);
  return cv;
}
function furnPreview(f){
  const wrap = document.createElement('div'); wrap.className = 'fprev';
  const keep = HS; HS = 1;
  try {
    const F = R.FURNITURE[f];
    const cv = document.createElement('canvas');
    if (WALL_KINDS[F.kind]){
      cv.width = 42; cv.height = 54;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      paintWallItem((u, v, uw, vh, c) => { g.fillStyle = c; g.fillRect(u + 1, v - 4, Math.max(1, uw), Math.max(1, vh)); }, 0, f, roomPal('sua'), 'sua');
    } else {
      const A = furnArt(f, 0), bm = furnBitmap(f, 0, A, 0);
      cv.width = bm.width; cv.height = bm.height;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(bm, 0, 0);
    }
    wrap.appendChild(cv);
  } catch (e){ /* 그림이 없어도 카드는 나와야 한다 */ }
  HS = keep;
  return wrap;
}
function itemCard(id, n, actions, cls){
  const d = document.createElement('div'); d.className = 'item' + (cls ? ' ' + cls : '');
  const nm = document.createElement('div'); nm.className = 'nm'; nm.appendChild(itemIcon(id));
  nm.appendChild(document.createTextNode(R.itemName(id)));
  if (n != null){ const c = document.createElement('span'); c.className = 'cnt'; c.textContent = '×' + n; nm.appendChild(c); }
  d.appendChild(nm);
  return d;
}
function btn(label, cls, fn, disabled){ const b = document.createElement('button'); b.type = 'button'; b.className = cls || ''; b.innerHTML = label; b.disabled = !!disabled; b.addEventListener('click', fn); return b; }
function renderBag(){
  const mi = R.missionOf(W, M, now());
  const mbox = $('#mission'); mbox.className = 'mission' + (mi.done ? ' done' : '');
  mbox.innerHTML = '<b>오늘의 할 일</b> ' + mi.m.text + ' — ' + Math.min(mi.got, mi.m.n) + '/' + mi.m.n + (mi.done ? ' · 받았어요' : mi.got >= mi.m.n ? ' <button type="button" class="sm" id="missionTake">🪙 ' + mi.m.coins + ' 받기</button>' : ' (🪙 ' + mi.m.coins + ')');
  const mt = $('#missionTake'); if (mt) mt.addEventListener('click', () => { act((w, m) => { if (!m.day || m.day.key !== R.dayKey(now()) || m.day.missionDone) return { ok: false, msg: '이미 받았어요' }; m.day.missionDone = true; m.coins += mi.m.coins; return { ok: true, msg: '🪙 ' + mi.m.coins + ' 받았어요' }; }); sfx('fanfare'); });
  $('#priceMult').textContent = '×' + R.priceMult(W, now()).toFixed(1);
  $('#hotCrop').textContent = W.hot && R.CROPS[W.hot] ? R.CROPS[W.hot].name + ' ×1.5' : '-';
  const box = $('#bag'); box.innerHTML = '';
  const ids = Object.keys(M.inv).filter(k => M.inv[k] > 0).sort();
  $('#bagCount').textContent = ids.length ? ids.length + '가지' : '';
  if (!ids.length){ box.innerHTML = '<p class="sub">비었어요. 밭에서 거두거나 나무를 베어 와요.</p>'; return; }
  ids.forEach(id => {
    const n = M.inv[id], price = R.sellPrice(id, W, now()), food = R.foodOf(id);
    const card = itemCard(id, n, null, W.hot && id === 'crop:' + W.hot ? 'hot' : '');
    const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = (price ? '🪙 ' + price + '개당' : '팔지 않아요') + (food ? ' · ⚡ ' + food : '') + (price && R.originOf && R.originOf(id) && R.originOf(id) !== R.farmOf(W).id ? ' · 🌍 다른 농장 특산물 ×1.5' : ''); card.appendChild(pr);
    const a = document.createElement('div'); a.className = 'act';
    if (price){ a.appendChild(btn('팔기', 'sell', () => { act((w, m) => R.sell(w, m, id, 1, now())); sfx('pop'); })); if (n > 1) a.appendChild(btn('다 팔기', 'sell', () => { const k = n; act((w, m) => R.sell(w, m, id, k, now())); sfx('pop'); })); }
    if (food) a.appendChild(btn('먹기', '', () => act((w, m) => R.eat(w, m, id, now()))));
    if (id.startsWith('f:')) a.appendChild(btn('집에 놓기', '', () => { furnPick = id.slice(2); openTab('house', true); }));
    a.appendChild(btn('선물', '', () => giftDialog(id, n)));
    card.appendChild(a); box.appendChild(card);
  });
}
function giftDialog(id, have){
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">' + NAME[R.OTHER[key]] + '에게 보내기</h3><p class="msg" style="margin:0;">' + escapeHTML(R.itemName(id)) + ' — ' + have + '개 있어요</p>' +
    '<input type="number" id="gN" aria-label="보낼 개수" min="1" max="' + have + '" value="1"><input type="text" id="gNote" maxlength="40" placeholder="한 마디 (선택)">' +
    '<div class="modal-actions"><button type="button" class="dot-btn small" id="gCancel">취소</button><button type="button" class="dot-btn small primary" id="gGo">보내기</button></div>';
  $('#modal').hidden = false;
  $('#gCancel').addEventListener('click', closeModal);
  $('#gGo').addEventListener('click', () => { const n = Math.max(1, Math.min(have, Number($('#gN').value) || 1)), note = $('#gNote').value; const r = act((w, m) => R.sendGift(w, m, id, n, note, now())); if (r.ok) sfx('sparkle'); closeModal(); });
}
// 이 농장에서만 얻는 것의 이름 — 동물·씨앗(작물)·특산물(2026-10-09 「이주 조건」)
function localName(id){ if (R.ANIMALS[id]) return R.ANIMALS[id].icon + ' ' + R.ANIMALS[id].name; if (R.CROPS[id]) return R.CROPS[id].name + ' 씨앗'; return R.itemName(id); }
// 이사 카드 — 꾸미개를 다 놓으면 다음 농장으로. 먼저 누른 아이가 묻고 자매가 「좋아」 하면 떠난다.
let keepPick = null;                                               // 들고 갈 추억 — 먼저 묻는 아이가 고른다
function moveCard(cls){
  if (!R.moveState) return null;                                   // 배포 어긋남 대비
  const s = R.moveState(W, M), o = R.OTHER[key];
  const d = document.createElement('div'); d.className = cls;
  if (!s.next){
    d.innerHTML = '<div class="nm">🗺️ 네 농장을 모두 다녀왔어요</div><div class="pr">' + (W.past || []).map(p => { const F = R.FARMS.find(f => f.id === p.farm); return F ? F.icon + ' ' + F.name : ''; }).join(' → ') + ' → ' + s.farm.icon + ' ' + s.farm.name + '</div>';
    return d;
  }
  const say = s.otherAsked ? '<b>' + NAME[o] + '가 이사 가자고 해요!</b> 좋다고 하면 바로 떠나요'
    : s.mineAsked ? NAME[o] + '의 대답을 기다려요'
    : s.ready ? '준비가 다 됐어요! 둘 다 좋다고 하면 떠나요'
    : '아래를 모두 채우면 이사 갈 수 있어요';
  const list = s.conds.map(c => (c.left ? '⬜ ' : '✅ ') + c.icon + ' ' + c.name + ' ' + Math.min(c.have, c.need) + '/' + c.need + (c.miss && c.miss.length ? ' — <b>' + c.miss.map(localName).join('·') + '</b>' : '')).join('<br>')
    + (s.conds.some(c => c.id.indexOf('local:') === 0) ? '<br><small>🛶 이 농장에서만 얻는 동식물이에요. 떠나기 전에 챙겨야 방주에 실을 수 있어요(씨앗은 「🛶 방주」 칸 씨앗 금고에).</small>' : '');
  const gk = R.movePath(W).map(f => Object.keys(R.ANIMALS).find(k => R.ANIMALS[k].gift === f.id)).filter(Boolean);   // 건너뛴 농장의 아기도
  const sp = ((R.SPECIALS || {})[s.next.id] || []).map(R.itemName).join('·'), land = landLine(s.farm, s.next);
  const why = (s.next.perk ? '<br>🌟 새 능력: <b>' + s.next.perk.icon + ' ' + s.next.perk.text + '</b>' : '') + (sp ? '<br>🌍 새 특산물: ' + sp + ' — 다른 농장에서 팔면 1.5배' : '') + (land ? '<br>' + land.replace('넓어졌어요!', '넓어져요:') : '');
  d.innerHTML = '<div class="nm">🚚 ' + s.next.icon + ' ' + s.next.name + '으로 이사</div><div class="pr">' + s.next.desc + why + '<br>' + say + '<br>' + list +
    '<br>🎁 이삿날 선물: 동전 ' + (R.MOVE_GIFT || 0) + ' · 추억 하나' + gk.map(k => ' · 아기 ' + R.ANIMALS[k].name).join('') + ' · 새 문패 · 여권 도장' +
    '<br><small>꾸미개와 다 지은 건물은 ' + s.farm.name + '에 두고 가요(고른 추억 하나는 들고 가요). 동전·가방·동물·집 가구·밭은 가져가요. 두고 간 농장은 언제든 다시 구경할 수 있어요.</small></div>';
  if (R.MOVE_OPEN === false){                                      // 새 농장을 짓는 동안은 조건만 보여 준다
    d.insertAdjacentHTML('beforeend', '<div class="pr">🔒 <b>' + s.next.name + '은 지금 짓고 있어요. 곧 열려요!</b> 그동안 조건을 채워 둬요.</div>');
    return d;
  }
  // 추억 고르기 — 옛 농장에 두고 갈 꾸미개 가운데 하나. 이미 들고 온 추억은 알아서 따라가니 빼고 보여 준다
  const keeps = Object.keys(W.decor || {}).filter(id => W.decor[id].keep && R.DECOR[id]);
  if (keeps.length) d.insertAdjacentHTML('beforeend', '<div class="pr">🧳 늘 따라오는 추억: ' + keeps.map(id => R.DECOR[id].icon + ' ' + R.DECOR[id].name).join(' · ') + '</div>');
  // 묻는 아이가 고르고, 고르지 않고 물었으면(이 기능 전에 물어 둔 것 포함) 「좋아」 하는 아이가 고른다
  const asked = s.ask && s.ask.keep && R.DECOR[s.ask.keep];
  if (asked) d.insertAdjacentHTML('beforeend', '<div class="pr">🧳 ' + (s.mineAsked ? '내가' : NAME[o] + '가') + ' 고른 추억: <b>' + asked.icon + ' ' + asked.name + '</b></div>');
  else if (s.mineAsked) d.insertAdjacentHTML('beforeend', '<div class="pr">🧳 들고 갈 추억은 ' + NAME[o] + '가 골라요</div>');
  const canPick = s.ready && (!s.ask || (s.otherAsked && !asked));
  const pickable = canPick ? Object.keys(W.decor || {}).filter(id => R.DECOR[id] && !W.decor[id].keep) : [];
  if (keepPick && pickable.indexOf(keepPick) < 0) keepPick = null;
  if (pickable.length){
    d.insertAdjacentHTML('beforeend', '<div class="pr">🧳 <b>들고 갈 추억 하나</b>를 골라요 — 새 농장에 그대로 서고, 다음 이사 때도 따라와요</div>');
    const row = document.createElement('div'); row.className = 'act keeps';
    pickable.forEach(id => row.appendChild(btn(R.DECOR[id].icon + ' ' + R.DECOR[id].name, keepPick === id ? 'on' : '', () => { keepPick = id; renderTab(); })));
    d.appendChild(row);
  }
  const a = document.createElement('div'); a.className = 'act';
  if (!s.mineAsked) a.appendChild(btn(s.otherAsked ? '좋아, 가자!' : '이사 가자고 하기', 'buy', () => {
    if (s.otherAsked && !confirm(s.next.name + '으로 떠날까요? 꾸미개와 건물은 두고 가서 새로 지어야 해요.')) return;
    // 옛 농장을 구경하던 중이면 먼저 지금 농장으로 돌아온다 — 떠난 뒤에도 옛 그림이 남지 않게
    if (visiting()) visitFarm(null);
    // 이삿날 장면은 act 가 다시 그리며 부르는 checkArrival 이 띄운다
    const toArk = s.next && s.next.id === 'ark';
    const r = act((w, m) => R.askMove(w, m, now(), keepPick || undefined));
    if (r.ok){ sfx(r.moved ? 'fanfare' : 'pop'); keepPick = null; }
    renderTab();
    // 방주 농장으로 가자고 결정한 순간 — 하늘에서 음성이 들린다(2026-10-09 로키즈). 떠났으면 이삿날 창이 음성 뒤에 이어진다
    let heard = false; try { heard = localStorage.getItem(VOICE_KEY()) === '1'; } catch (e) { heard = false; }
    if (r.ok && toArk && !r.moved && !heard) openVoice();
  }, !s.ready || (pickable.length > 0 && !keepPick)));
  if (s.ask) a.appendChild(btn(s.mineAsked ? '물어본 것 거두기' : '다음에 가자', '', () => { act((w, m) => R.cancelMove(w, m, now())); renderTab(); }));
  d.appendChild(a);
  return d;
}
function renderShop(){
  const st = $('#shoptabs'); st.innerHTML = '';
  SHOP_TABS.forEach(([k, l]) => st.appendChild(btn(l, shopTab === k ? 'on' : '', () => { shopTab = k; renderShop(); })));
  const box = $('#shop'); box.innerHTML = '';
  const cal = R.calendar(W, now()), lv = R.levelOf(M.xp);
  const buyBtn = (id, cost, ok) => btn('🪙 ' + cost, 'buy', () => { const r = act((w, m) => R.buy(w, m, id, now())); if (r.ok) sfx(r.animal ? 'fanfare' : 'pop'); if (r.animal) nameDialog(r.animal); renderShop(); }, !ok);
  if (shopTab === 'seed'){
    const gh = built('greenhouse');
    $('#shopSub').innerHTML = R.SEASON_NAME[cal.season] + ' 씨앗. 흐린 것은 <b>' + NAME[R.OTHER[key]] + '의 가게</b>에만 있어요 — 선물로 받아요. 다음 계절(' + R.SEASON_NAME[R.nextSeason(cal.season)] + ') 씨앗은 ' + (gh ? '지금도 살 수 있어요 — 온실에서 자라요.' : '구경만 해요 — 그 계절이 오면 살 수 있어요.');
    // 다른 농장 전용 씨앗(클라우드베리)은 거기 살 때만 — 이 농장 것은 맨 앞에, 꾸미개·가구와 같은 「이 농장에만」 표시
    const here = R.farmOf(W).id;
    const list = R.CROP_IDS.filter(c => R.CROPS[c].seed > 0 && (!R.CROPS[c].farm || R.CROPS[c].farm === here) && (R.CROPS[c].season.indexOf(cal.season) >= 0 || R.CROPS[c].season.indexOf(R.nextSeason(cal.season)) >= 0));
    list.sort((a, b) => !R.CROPS[b].farm - !R.CROPS[a].farm);
    list.forEach(c => {
      const C = R.CROPS[c], mineHalf = !C.half || C.half === key, lvOk = (C.lv || 1) <= lv, inSeason = C.season.indexOf(cal.season) >= 0;
      // 지금 심을 수 없는 씨앗은 사지 못한다 — 온실이 있으면 아무 때나 자라니 그때만 열린다
      const seasonOk = inSeason || C.hardy || gh;
      const card = itemCard('seed:' + c, M.inv['seed:' + c] || 0, null, (!mineHalf || !lvOk || !seasonOk ? 'locked' : '') + (W.hot === c ? ' hot' : ''));
      if (C.farm){ const tag = document.createElement('span'); tag.className = 'farm-only'; tag.textContent = '이 농장에만'; card.querySelector('.nm').appendChild(tag); }
      const pr = document.createElement('div'); pr.className = 'pr';
      pr.innerHTML = C.hours + '시간 · 🪙 ' + C.sell + (C.yield > 1 ? '×' + C.yield : '') + (C.regrow ? ' · 또 열려요' : '') + (C.giant ? ' · <b>둘이 나란히 심으면 큰 것</b>' : '') + (C.flower ? ' · 꽃' : '') +
        (!inSeason ? '<br>' + (gh ? '온실에서만 자라요 · ' : R.SEASON_NAME[cal.season] + '에는 못 사요 · ') + C.season.map(s => R.SEASON_NAME[s]).join('·') + '에 심어요' : '') +
        (!lvOk ? '<br>레벨 ' + C.lv + '부터' : '') + (!mineHalf ? '<br>' + NAME[C.half] + '의 가게' : '');
      card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act';
      const canBuy = mineHalf && lvOk && seasonOk && M.coins >= C.seed;
      a.appendChild(buyBtn('seed:' + c, C.seed, canBuy));
      /* 「반씩 나눠 가진 씨앗」은 제 가게에서 사서 건네야 상대가 심는다 —
         사고 가방에서 다시 찾아 보내는 두 걸음을 한 걸음으로 줄인다. */
      if (C.half === key) a.appendChild(btn('🎁 사서 보내기', 'buy', () => {
        const r = act((w, m) => R.buyGift(w, m, 'seed:' + c, '', now()));
        if (r.ok) sfx('sparkle');
        renderShop();
      }, !canBuy));
      card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'tool'){
    $('#shopSub').textContent = '도구가 좋아지면 한 번에 여러 칸. 밭은 넓힐수록 칸이 늘어요. 나무와 돌도 여기서 살 수 있어요.';
    Object.keys(R.TOOLS).forEach(t => {
      const Tt = R.TOOLS[t], cur = M.tools[t] || 0, nx = Tt.levels[cur + 1];
      const card = document.createElement('div'); card.className = 'item';
      card.innerHTML = '<div class="nm">' + Tt.icon + ' ' + Tt.name + ' ' + (cur + 1) + '단계</div><div class="pr">지금 한 번에 ' + Tt.levels[cur].n + '칸' + (nx ? ' → ' + nx.n + '칸' + (nx.need ? ' (' + R.BUILDINGS[nx.need].name + ' 필요)' : '') : ' · 최고예요') + '</div>';
      if (nx){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('tool:' + t, nx.cost, M.coins >= nx.cost && (!nx.need || built(nx.need)))); card.appendChild(a); }
      box.appendChild(card);
    });
    const nxE = R.EXPANSIONS[(W.expand || 0) + 1];
    const card = document.createElement('div'); card.className = 'item';
    card.innerHTML = '<div class="nm">🟫 밭 넓히기</div><div class="pr">지금 ' + R.EXPANSIONS[W.expand || 0].w + '×' + R.EXPANSIONS[W.expand || 0].h + (nxE ? ' → ' + nxE.w + '×' + nxE.h + ' · 레벨 ' + nxE.lv + '부터' : ' · 제일 넓어요') + '</div>';
    if (nxE){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('expand:1', nxE.cost, M.coins >= nxE.cost && lv >= nxE.lv)); card.appendChild(a); }
    box.appendChild(card);
    const sp = document.createElement('div'); sp.className = 'item';
    sp.innerHTML = '<div class="nm">⛲ ' + R.SPRINKLER.name + '</div><div class="pr">밭 한 칸을 차지하고, 아침마다 둘레 네 칸에 물을 줘요 · 레벨 ' + R.SPRINKLER.lv + '부터 · 가진 것 ' + (M.inv.sprinkler || 0) + '개</div>';
    const spa = document.createElement('div'); spa.className = 'act'; spa.appendChild(buyBtn('sprinkler:1', R.SPRINKLER.cost, M.coins >= R.SPRINKLER.cost && lv >= R.SPRINKLER.lv)); sp.appendChild(spa); box.appendChild(sp);
    // 좋은 스프링클러 — 옛 farm-rules.js 와 짝이 되면 아예 안 그린다
    if (R.SPRINKLER2){
      const S2 = R.SPRINKLER2;
      const sp2 = document.createElement('div'); sp2.className = 'item';
      sp2.innerHTML = '<div class="nm">⛲ ' + S2.name + '</div><div class="pr">모서리까지 <b>여덟 칸</b>을 적셔요. 한 칸으로 여덟 칸의 손을 던 셈이에요 · 레벨 ' + S2.lv + '부터 · 가진 것 ' + (M.inv.sprinkler2 || 0) + '개</div>';
      const sp2a = document.createElement('div'); sp2a.className = 'act';
      sp2a.appendChild(buyBtn('sprinkler2:1', S2.cost, M.coins >= S2.cost && lv >= S2.lv));
      sp2.appendChild(sp2a); box.appendChild(sp2);
    }
    const fc = document.createElement('div'); fc.className = 'item'; fc.innerHTML = '<div class="nm">🧪 비료</div><div class="pr">1.5배 빨리 자라요</div>';
    const fa = document.createElement('div'); fa.className = 'act'; fa.appendChild(buyBtn('fert:1', 30, M.coins >= 30)); fc.appendChild(fa); box.appendChild(fc);
    // 나무·돌 — 베고 캐는 것이 하루에 몇 번뿐이라, 짓다가 한 가지가 모자라면 며칠을 기다려야 했다
    [['wood', '🪵'], ['stone', '🪨']].forEach(([id, icon]) => {
      const cost = R.MATERIALS[id].cost;
      const card = itemCard(id, M.inv[id] || 0, null);
      const pr = document.createElement('div'); pr.className = 'pr';
      pr.textContent = icon + ' 집을 지을 때 써요 · 되팔면 🪙 ' + R.sellPrice(id, W, now()) + ' · 가진 것 ' + (M.inv[id] || 0) + '개';
      card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('mat:' + id, cost, M.coins >= cost)); card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'animal'){
    $('#shopSub').textContent = '닭장·외양간을 먼저 지어요(둘이서 탭). 한 곳에 네 마리까지.';
    Object.keys(R.ANIMALS).forEach(k => {
      const A = R.ANIMALS[k], ok = built(A.need);
      const card = document.createElement('div'); card.className = 'item' + (ok ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; cv.getContext('2d').imageSmoothingEnabled = false; drawAnimalAt(cv.getContext('2d'), k, 4, 5, 1);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.appendChild(cv); nm.appendChild(document.createTextNode(A.name)); card.appendChild(nm);
      const what = A.product ? R.itemName(A.product) + (A.every > 1 ? ' ' + A.every + '일마다' : ' 날마다') + (A.find ? ' · 가끔 ' + A.find.map(f => R.itemName(f)).join('·') + '을 찾아 와요' : '')
                             : A.find.map(f => R.itemName(f)).join('·') + ' 중 하나를 날마다 물어 와요';
      const pr = document.createElement('div'); pr.className = 'pr';
      pr.textContent = what + (A.best ? ' · 마음 ' + R.LOVE_FOR_BEST + '이면 ' + R.itemName(A.best) : '') + ' · 마음 ' + R.LOVE_FOR_BABY + '이면 새끼를 봐요' + (ok ? '' : ' · ' + R.BUILDINGS[A.need].name + ' 필요');
      card.appendChild(pr);
      if (A.gift){                                                  // 새 식구 — 이사 갈 때 새끼로만 온다
        card.className = 'item locked';
        const F = R.FARMS.find(f => f.id === A.gift);
        pr.textContent = what + ' · ' + (F ? F.icon + ' ' + F.name : '새 농장') + '으로 이사 가면 새끼로 따라와요';
        box.appendChild(card); return;
      }
      if (A.farm && A.farm !== R.farmOf(W).id){                    // 그 농장 가게에서만 파는 동물(2026-10-09)
        const F = R.FARMS.find(f => f.id === A.farm), past = R.FARMS.findIndex(f => f.id === A.farm) < (W.farm || 0);
        card.className = 'item locked'; pr.textContent = what + ' · ' + (F ? F.icon + ' ' + F.name : '그 농장') + (past ? ' 가게에서만 팔았어요' : '에 가면 만나요'); box.appendChild(card); return;
      }
      if (A.farm){ const tag = document.createElement('span'); tag.className = 'farm-only'; tag.textContent = '이 농장에만'; nm.appendChild(tag); }
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('animal:' + k, A.cost, ok && M.coins >= A.cost)); card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'furn'){
    $('#shopSub').textContent = '사면 가방에 들어와요. 집 탭에서 놓아요. 좋은 침대는 기운을 늘려 줘요.';
    // 쉰 가지가 넘으니 싼 것부터 세운다 — 아이가 가진 돈으로 살 수 있는 것이 먼저 보인다
    // 다른 농장 전용은 거기 살 때만 보인다 — 이 농장 것은 맨 앞에(꾸미개 탭과 같은 표시)
    const here = R.farmOf(W).id;
    const furnList = Object.keys(R.FURNITURE).filter(f => !R.FURNITURE[f].rare && R.FURNITURE[f].cost > 0 && (!R.FURNITURE[f].farm || R.FURNITURE[f].farm === here));
    furnList.sort((a, b) => (!R.FURNITURE[b].farm - !R.FURNITURE[a].farm) || R.FURNITURE[a].cost - R.FURNITURE[b].cost);
    furnList.forEach(f => {
      const Fu = R.FURNITURE[f], seasonOk = !Fu.season || Fu.season === cal.season;
      const card = itemCard('f:' + f, M.inv['f:' + f] || 0, null, seasonOk ? '' : 'locked');
      if (Fu.farm){ const tag = document.createElement('span'); tag.className = 'farm-only'; tag.textContent = '이 농장에만'; card.querySelector('.nm').appendChild(tag); }
      card.insertBefore(furnPreview(f), card.firstChild);
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = '아늑함 +' + Fu.cozy + (Fu.energy ? ' · 기운 +' + Fu.energy : '') + (Fu.wall ? ' · 벽에 걸어요' : Fu.w > 1 ? ' · ' + Fu.w + '칸' : '') + (Fu.season ? ' · ' + R.SEASON_NAME[Fu.season] + '에만' : ''); card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('f:' + f, Fu.cost, seasonOk && M.coins >= Fu.cost)); card.appendChild(a); box.appendChild(card);
    });
    // 방 넓히기 — 가구를 사다 보면 자리가 모자란다. 그 자리에서 방도 넓힐 수 있게 둔다.
    if (R.roomBox) Object.keys(R.ROOMS).forEach(r => {
      const B = R.roomBox(W, r);
      if (B.owner && B.owner !== key) return;              // 남의 방은 넓혀 줄 수 없다
      const nx = B.next;
      const card = document.createElement('div'); card.className = 'item';
      const after = nx ? { w: B.w + nx.w - R.ROOM_GROW[B.step].w, h: B.h + nx.h - R.ROOM_GROW[B.step].h } : null;
      card.innerHTML = '<div class="nm">📐 ' + B.name + ' 넓히기</div><div class="pr">지금 ' + B.w + '×' + B.h
        + (after ? ' → ' + after.w + '×' + after.h + ' · 레벨 ' + nx.lv + '부터' : ' · 제일 넓어요') + '</div>';
      if (nx){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('room:' + r, nx.cost, M.coins >= nx.cost && lv >= nx.lv)); card.appendChild(a); }
      box.appendChild(card);
    });
  } else if (shopTab === 'deco'){
    $('#shopSub').textContent = '농장에 놓는 것. 혼자 사도 돼요 — 둘의 농장에 남아요. 모두 놓으면 이사 갈 수 있어요.';
    const mc = moveCard('item move'); if (mc) box.appendChild(mc);
    const here = R.farmOf(W).id;
    Object.keys(R.DECOR).forEach(d => {
      const Dc = R.DECOR[d], have = W.decor && W.decor[d];
      if (Dc.farm && Dc.farm !== here && !have) return;    // 다른 농장 전용은 거기 살 때만 보인다
      const card = document.createElement('div'); card.className = 'item' + (have ? ' locked' : '');
      const from = have && have.keep && R.FARMS.find(f => f.id === have.keep);
      card.innerHTML = '<div class="nm">' + Dc.icon + ' ' + Dc.name + (from ? ' <span class="farm-only">🧳 추억</span>' : Dc.farm ? ' <span class="farm-only">이 농장에만</span>' : '') + '</div><div class="pr">' + (Dc.desc || '') + (from ? ' · ' + from.name + '에서 들고 왔어요' : have ? ' · ' + NAME[have.by] + '가 놓았어요' : ' · 레벨 ' + Dc.lv + '부터') + '</div>';
      if (!have){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('deco:' + d, Dc.cost, M.coins >= Dc.cost && lv >= Dc.lv)); card.appendChild(a); }
      box.appendChild(card);
    });
  } else {
    $('#shopSub').textContent = '요리법을 알면 부엌에서 만들 수 있어요. 요리는 비싸게 팔리고 기운도 많이 돌려줘요.';
    Object.keys(R.DISHES).forEach(d => {
      const Dd = R.DISHES[d], know = M.recipes.indexOf(d) >= 0, lvOk = Dd.lv <= lv;
      const card = itemCard('dish:' + d, null, null, know || !lvOk ? 'locked' : '');
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = Object.keys(Dd.need).map(k => R.itemName(k) + ' ' + Dd.need[k]).join(' + ') + ' · 🪙 ' + Dd.sell + ' · ⚡ ' + Dd.food + (know ? ' · 알아요' : !lvOk ? ' · 레벨 ' + Dd.lv + '부터' : ''); card.appendChild(pr);
      const fh = fishHint(Dd.need);
      if (fh){ const h = document.createElement('div'); h.className = 'pr'; h.textContent = '🎣 ' + fh; card.appendChild(h); }
      if (!know && lvOk){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('recipe:' + d, Dd.sell, M.coins >= Dd.sell)); card.appendChild(a); }
      box.appendChild(card);
    });
  }
}
/* 요리법 카드의 생선 안내. 요리법은 레벨 2·3부터 보이는데 생선은 연못(레벨 5·2000코인)이
   있어야 낚이므로, 아이 눈에는 「어디서도 못 구하는 재료」다. 어디서 언제 나는지 한 줄 적는다. */
function fishHint(need){
  const fs = Object.keys(need).filter(k => k.indexOf('fish:') === 0);
  if (!fs.length) return '';
  const pond = !!(W.decor && W.decor.pond);
  return fs.map(k => {
    const F = R.FISH[k.slice(5)]; if (!F) return '';
    const when = [F.season ? F.season.map(sn => R.SEASON_NAME[sn]).join('·') : '', F.night ? '밤' : ''].filter(Boolean).join(' ');
    const at = when ? when + '에 ' : '';
    return R.eun(F.name) + ' ' + (pond ? at + '연못에서 낚아요'
      : '연못을 놓으면 ' + at + '낚을 수 있어요 (가게 꾸미기 · 레벨 ' + R.DECOR.pond.lv + ')');
  }).filter(Boolean).join(' · ');
}
function nameDialog(a){
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">' + R.ANIMALS[a.kind].name + '의 이름</h3><input type="text" id="aName" maxlength="8" placeholder="예: 꼬꼬">' +
    '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="aGo">정했어요</button></div>';
  $('#modal').hidden = false;
  $('#aGo').addEventListener('click', () => { const nm = $('#aName').value; if (nm.trim()) act((w, m) => R.rename(w, m, a.id, nm)); closeModal(); });
}
// 화면 도트 → 칸. 마름모 경계를 정확히 가른다.
function dotTile(Rm, px, py){
  const a = (px - isoOx(Rm)) / TW, b = (py - WALLH) / TH;
  return { tx: Math.floor(b + a), ty: Math.floor(b - a) };
}
// 화면 자리 → 벽 격자. 벽의 기울기를 되돌려 u,v 를 얻고 칸과 단으로 나눈다.
function wallPickAt(rm, Rm, px, py){
  const ox = isoOx(Rm), side = px >= ox ? 1 : 0;
  const u = side ? px - ox : ox - px - 2;
  const v = py - (u + (side ? 0 : 2)) / 2;
  const len = wallLenOf(Rm, side);
  if (u < 0 || u >= len || v < 0 || v >= WALLH) return null;
  const cols = wallColsOf(rm, side);
  const col = Math.max(0, Math.min(cols - 1, Math.floor((u - wallU(len, cols, 0)) / WALL_PITCH())));
  return { side: side, col: col, row: v >= WALL_ROW_SPLIT ? 1 : 0 };
}
function renderHouse(){
  const rb = $('#rooms'); rb.innerHTML = '';
  Object.keys(R.ROOMS).forEach(r => rb.appendChild(btn(R.ROOMS[r].name, room === r ? 'on' : '', () => { room = r; rotMode = false; arrange = false; furnPick = null; houseSig = ''; renderHouse(); })));
  const cz = R.cozyOf(W), lvl = R.cozyLevel(W), nxt = R.COZY_LEVELS[lvl + 1];
  $('#cozy').innerHTML = '아늑함 <span class="hearts">' + '♥'.repeat(lvl) + '♡'.repeat(Math.max(0, 5 - lvl)) + '</span> ' + cz + (nxt ? ' / ' + nxt : '') + ' · 기운 최대 ' + R.maxEnergy(W, M);
  const Rm = RM(room);
  const hcv = $('#houseCanvas');
  // 재배치 중엔 한 손가락으로 끌어도 화면이 안 따라 움직인다(가구를 옮긴다). 두 손가락으로
  // 벌리는 것은 열어 둔다 — none 이면 핀치 줌까지 막힌다
  hcv.style.touchAction = arrange ? 'pinch-zoom' : '';
  drawRoom(hcv, room);
  const mineRoom = !Rm.owner || Rm.owner === key;
  const dirName = ['↑ 처음', '→ 오른쪽', '↓ 뒤로', '← 왼쪽'][furnRot];
  $('#houseHint').innerHTML = !mineRoom ? NAME[Rm.owner] + '의 방이에요. 구경만 해요.'
    : !arrange ? '<b>재배치</b>를 누르면 가구를 놓거나 가방에 넣을 수 있어요.'
    : rotMode ? '<b>돌리기</b> 중이에요. 놓인 가구를 누르면 90도씩 돌아가요. 다시 누르면 끝나요.'
    : furnPick ? (R.FURNITURE[furnPick].wall
        ? '<b>' + R.FURNITURE[furnPick].name + '</b>은 벽에 걸어요 — <b>벽의 초록 칸</b>을 눌러요. 위·아래 두 단이 있어요.'
        : '<b>' + R.FURNITURE[furnPick].name + '</b>을 놓을 자리를 눌러요 (' + dirName + '). 놓인 가구를 누르면 가방에 들어가요.')
    : '놓인 가구는 <b>끌어서</b> 옮겨요. 벽에 건 것도 <b>끌면</b> 다른 칸으로 옮겨져요. 그냥 누르면 가방에 들어가요.';
  const fb = $('#furn'); fb.innerHTML = '';
  /* 방 넓히기 — 밭처럼 가게에도 두었지만, 방을 보고 있을 때 그 자리에서 넓히는 쪽이
     「좁다」고 느낀 순간과 가장 가깝다. (옛 farm-rules.js 면 아예 안 그린다) */
  if (mineRoom && R.roomBox){
    const nx = Rm.next;
    const lvNow = R.levelOf(M.xp);
    const can = !!nx && M.coins >= nx.cost && lvNow >= nx.lv;
    const label = nx ? '📐 넓히기 ' + Rm.w + '×' + Rm.h + ' → ' + (Rm.w + nx.w - R.ROOM_GROW[Rm.step].w) + '×' + (Rm.h + nx.h - R.ROOM_GROW[Rm.step].h) + ' · 🪙 ' + nx.cost
      : '📐 ' + Rm.w + '×' + Rm.h + ' · 제일 넓어요';
    const eb = btn(label, '', () => {
      const r = act((w, m) => R.buy(w, m, 'room:' + room, now()));
      if (r.ok){ sfx('prop'); houseSig = ''; }
      renderHouse();
    }, !can);
    eb.classList.add('rotbtn');
    if (nx && lvNow < nx.lv) eb.title = '농장 레벨 ' + nx.lv + '부터';
    fb.appendChild(eb);
  }
  if (mineRoom){
    // 재배치 — 이걸 누른 뒤에만 들고 놓고 돌릴 수 있다. 끝내면 들고 있던 것도 내려놓는다
    const ab = btn(arrange ? '✅ 재배치 끝' : '🔧 재배치', arrange ? 'on' : '', () => {
      arrange = !arrange;
      if (!arrange){ furnPick = null; rotMode = false; }
      renderHouse();
    });
    ab.classList.add('rotbtn'); fb.appendChild(ab);
  }
  if (mineRoom && arrange){
    // 돌리기 — 들고 있으면 놓을 각도를, 아니면 놓인 것을 돌리는 모드를 바꾼다
    const rb = btn('🔄 ' + (furnPick ? '돌려서 놓기 ' + dirName : rotMode ? '돌리기 끝' : '돌리기'), rotMode ? 'on' : '', () => {
      if (furnPick) furnRot = (furnRot + 1) % 4;
      else rotMode = !rotMode;
      renderHouse();
    });
    rb.classList.add('rotbtn'); fb.appendChild(rb);
    Object.keys(M.inv).filter(k => k.startsWith('f:') && M.inv[k] > 0).forEach(k => {
      const f = k.slice(2), b = btn('', furnPick === f ? 'on' : '', () => { furnPick = furnPick === f ? null : f; rotMode = false; renderHouse(); });
      b.appendChild(itemIcon(k)); b.appendChild(document.createTextNode(R.FURNITURE[f].name + ' ×' + M.inv[k])); fb.appendChild(b);
    });
  }
  if (furnPick && !(M.inv['f:' + furnPick] > 0)) furnPick = null;
  // 부엌
  const kb = $('#kitchen'); kb.innerHTML = '';
  if (built('kitchen')){
    kb.innerHTML = '<h3 class="pixel" style="margin-top:14px;">부엌</h3><p class="sub">아는 요리만 나와요. 요리법은 가게에서.</p>';
    const grid = document.createElement('div'); grid.className = 'items';
    M.recipes.forEach(d => {
      const Dd = R.DISHES[d], ok = R.canCook(M, d);
      const card = itemCard('dish:' + d, M.inv['dish:' + d] || 0, null, ok ? '' : 'locked');
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = Object.keys(Dd.need).map(k => R.itemName(k) + ' ' + Dd.need[k] + '(' + R.countOf(M, k) + ')').join(' + '); card.appendChild(pr);
      // 생선이 하나도 없을 때만 — 있으면 어디서 났는지 이미 안다
      const fh = ok ? '' : fishHint(Object.keys(Dd.need).filter(k => k.indexOf('fish:') === 0 && !R.countOf(M, k)).reduce((o, k) => { o[k] = 1; return o; }, {}));
      if (fh){ const h = document.createElement('div'); h.className = 'pr'; h.textContent = '🎣 ' + fh; card.appendChild(h); }
      const a = document.createElement('div'); a.className = 'act'; const tired = ok && (M.energy || 0) < R.COST.cook; a.appendChild(btn(tired ? '만들기 · ⚡부족' : '만들기', 'buy', () => { const r = act((w, m) => R.cook(w, m, d, now())); if (r.ok) sfx('sparkle'); }, !ok || tired)); card.appendChild(a); grid.appendChild(card);
    });
    kb.appendChild(grid);
  } else {
    kb.innerHTML = '<p class="sub" style="margin-top:12px;">부엌은 둘이서 탭에서 같이 지어요. 지으면 여기서 요리할 수 있어요.</p>';
  }
}
// 화면 자리 → 방의 칸. 마름모 격자라 x,y 를 따로 나누면 안 되고 두 축을 함께 되돌린다
function houseTileAt(e){
  const cv = $('#houseCanvas'), r = cv.getBoundingClientRect(); const w = r.width || cv.width, h = r.height || cv.height;
  const Rm = RM(room);
  const x = (e.clientX - r.left) / w * cv.width / HS, y = (e.clientY - r.top) / h * cv.height / HS;
  const T2 = dotTile(Rm, x, y);
  return { x, y, tx: T2.tx, ty: T2.ty, Rm };
}
// 지금 끌고 있는 것을 그 자리에 놓을 수 있나 — 방 밖으로 나가거나 다른 가구와 겹치면 안 된다
function grabFits(){
  const Rm = RM(room), b = R.furnBox(grab.f, grab.r);
  if (grab.tx < 0 || grab.ty < 0 || grab.tx + b.w > Rm.w || grab.ty + b.h > Rm.h) return false;
  for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++){
    const o = R.occupied(W, room, grab.tx + i, grab.ty + j);
    if (o && o !== grab.k) return false;
  }
  return true;
}
function onHouseDown(e){
  if (tab !== 'house' || !arrange || rotMode || furnPick) return;
  const Rm = RM(room);
  if (Rm.owner && Rm.owner !== key) return;             // 남의 방은 못 만진다
  const p = houseTileAt(e);
  const offFloor = p.tx < 0 || p.ty < 0 || p.tx >= Rm.w || p.ty >= Rm.h;
  // 벽에 건 것도 끌어 옮긴다 — 벽 격자 위에서 칸을 옮겨 다닌다
  if (offFloor){
    if (!HAS_WALLGRID()) return;
    const sl = wallPickAt(room, Rm, p.x, p.y); if (!sl) return;
    const wk = R.hungCol(W, room, sl.side, sl.col); if (!wk) return;
    const q = R.parseWall(wk), wit = R.placed(W, room)[wk];
    if (!q || !wit) return;
    grab = { wall: true, k: wk, f: wit.f, pic: wit.pic, fside: q.side, fcol: q.col, frow: q.row,
             side: q.side, col: q.col, row: q.row,
             sx: e.clientX, sy: e.clientY, moved: false, ok: true };
    try { $('#houseCanvas').setPointerCapture(e.pointerId); } catch (err) { /* 붙잡기는 덤이다 */ }
    return;
  }
  const k = R.occupied(W, room, p.tx, p.ty); if (!k) return;
  const it = R.placed(W, room)[k];
  if (!it || R.FURNITURE[it.f].wall) return;            // 벽에 건 것은 바닥 칸에 없다
  const parts = k.split(',').map(Number);
  grab = { k, f: it.f, r: it.r || 0, fx: parts[0], fy: parts[1],
           ox: p.tx - parts[0], oy: p.ty - parts[1], tx: parts[0], ty: parts[1],
           sx: e.clientX, sy: e.clientY, moved: false, ok: true };
  try { $('#houseCanvas').setPointerCapture(e.pointerId); } catch (err) { /* 붙잡기는 덤이다 */ }
}
function onHouseMove(e){
  if (!grab) return;
  // 몇 도트 안 움직였으면 아직 「누른 것」이다 — 손가락은 조금씩 떨린다
  if (!grab.moved && Math.abs(e.clientX - grab.sx) < 6 && Math.abs(e.clientY - grab.sy) < 6) return;
  grab.moved = true;
  const p = houseTileAt(e);
  if (grab.wall){
    const sl = wallPickAt(room, p.Rm, p.x, p.y);
    if (sl){ grab.side = sl.side; grab.col = sl.col; grab.row = sl.row; }   // 벽을 벗어나면 마지막 칸을 지킨다
    const o = R.hungCol(W, room, grab.side, grab.col);
    grab.ok = (!o || o === grab.k) && grab.row < R.wallRowsFor(grab.f);
    return;
  }
  grab.tx = p.tx - grab.ox; grab.ty = p.ty - grab.oy;
  grab.ok = grabFits();
}
function onHouseUp(){
  if (!grab) return;
  const gg = grab; grab = null;
  if (!gg.moved) return;                                 // 끌지 않았으면 뒤따라 오는 click 이 맡는다
  grabClick = true;                                      // 끌고 난 뒤의 click 은 삼킨다
  if (gg.wall){
    if (gg.side === gg.fside && gg.col === gg.fcol && gg.row === gg.frow){ renderHouse(); return; }
    const rw = act((w2, m) => R.moveHang(w2, m, room, gg.k, gg.side, gg.col, gg.row));
    if (rw.ok){
      sfx('plant');
      if (wallCovers(room, gg.side, gg.col)) flash('창(문)을 가리는 자리예요 — 다시 끌어 옮겨도 돼요');
    }
    renderHouse(); return;
  }
  if (gg.tx === gg.fx && gg.ty === gg.fy){ renderHouse(); return; }
  const r2 = act((w2, m) => R.moveFurn(w2, m, room, gg.k, gg.tx, gg.ty));
  if (r2.ok) sfx('plant');
  renderHouse();
}
function onWallTap(sl){
  const Rm = RM(room);
  if (!HAS_WALLGRID()){ flash('벽이에요. 잠시 뒤에 다시 열면 벽에도 걸 수 있어요'); return; }
  if (Rm.owner && Rm.owner !== key){ flash(NAME[Rm.owner] + '의 방이에요'); return; }
  if (!arrange){ flash('재배치를 누르면 벽에도 걸 수 있어요'); return; }
  const k = R.hungCol(W, room, sl.side, sl.col);      // 한 칸에 하나뿐이라 단은 안 따진다
  if (k){
    const r2 = act((w2, m) => R.pickUp(w2, m, room, k));
    if (r2.ok){ sfx('prop'); furnPick = null; }
    renderHouse(); return;
  }
  if (!furnPick){ flash('가방에서 벽에 거는 것을 골라요'); return; }
  const F = R.FURNITURE[furnPick];
  if (!F.wall){ flash('그건 바닥에 놓는 거예요'); return; }
  const f = furnPick;
  if (F.pic){ openPicPick(pic => hangNow(f, sl, pic)); return; }    // 담을 그림부터 고른다
  hangNow(f, sl, null);
}
function hangNow(f, sl, pic){
  const r2 = act((w2, m) => R.hang(w2, m, room, f, sl.side, sl.col, sl.row, pic));
  if (r2.ok){
    sfx(f === 'medalcase' ? 'medal' : 'plant');
    if (wallCovers(room, sl.side, sl.col)) flash('창(문)을 가리는 자리예요 — 눌러서 집어 다른 칸에 걸어도 돼요');
  }
  if (!(M.inv['f:' + f] > 0)) furnPick = null;
  renderHouse();
}
/* 걸 수 있는 그림은 두 곳에서 온다 — 그림 일기에 붙인 그림(posts.doodle, 16칸)과
   도트 그리기에 저장한 그림(doodles.cells, 16·24·32칸). 담는 방식이 같아서 한 줄로
   묶어 최근 것부터 보여 준다. 한 판에 여러 번 걸 수 있으니 표는 한 번만 읽는다. */
async function loadMyPics(){
  if (myPics) return myPics;
  const [diary, drawn] = await Promise.all([
    /* 공개된 일기의 그림만 건다. 방 벽은 손님 화면(farm_peek)에도 그려지므로,
       비공개 일기의 그림을 걸면 그 그림만 공개되는 셈이 된다. */
    sb.from('posts').select('id, title, doodle, happened_on, created_at')
      .not('doodle', 'is', null).in('author', [key, 'together'])
      .eq('is_public', true).eq('status', 'published')
      .order('created_at', { ascending: false }).limit(30),
    sb.from('doodles').select('id, theme, cells, made_on, created_at')
      .eq('author', key)
      .order('created_at', { ascending: false }).limit(30),
  ]);
  if (diary.error) throw diary.error;
  const list = (diary.data || []).map(q => ({
    pic: q.doodle, when: q.happened_on || String(q.created_at || '').slice(0, 10), what: q.title || '일기', at: q.created_at,
  }));
  // 도트 그리기 표가 없거나 막혀 있어도 일기 그림은 보여 준다
  if (!drawn.error) (drawn.data || []).forEach(q => list.push({
    pic: q.cells, when: q.made_on || String(q.created_at || '').slice(0, 10), what: q.theme || '그리기', at: q.created_at,
  }));
  myPics = list.filter(q => R.okPic(q.pic)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return myPics;
}
function padThumb(str){
  const cells = padDecode(str);
  const n = cells ? cells.n : 16;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;                       // 칸 수가 달라도 카드 크기는 같게
  const px = 64 / n;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = PAD_BG; g.fillRect(0, 0, cv.width, cv.height);
  if (cells) for (let i = 0; i < cells.length; i++){
    if (cells[i] === PAD_EMPTY) continue;
    g.fillStyle = PAD_PALETTE[cells[i]] || PAD_BG;
    g.fillRect((i % n) * px, Math.floor(i / n) * px, px, px);
  }
  return cv;
}
function openPicPick(then){
  $('#modalInner').innerHTML = '<h3 class="pixel">어떤 그림을 걸까요</h3>'
    + '<p class="msg" style="margin:0 0 8px;">그림 일기에 붙인 그림과 도트 그리기에 저장한 그림이 다 나와요.</p>'
    + '<div class="picrows" id="picRows">불러오는 중...</div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small" id="picClose">닫기</button></div>';
  $('#modal').hidden = false;
  $('#picClose').addEventListener('click', closeModal);
  loadMyPics().then(list => {
    const box = $('#picRows'); if (!box) return;
    box.innerHTML = '';
    if (!list.length){ box.textContent = '아직 그린 그림이 없어요. 도트 그리기나 그림 일기에서 먼저 그려요.'; return; }
    list.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'picpick';
      b.appendChild(padThumb(q.pic));
      const cap = document.createElement('span');
      cap.textContent = q.when + ' ' + q.what;
      b.appendChild(cap);
      b.addEventListener('click', () => { closeModal(); then(q.pic); });
      box.appendChild(b);
    });
  }).catch(e => {
    const box = $('#picRows');
    if (box) box.textContent = '그림을 못 불러왔어요: ' + ((e && e.message) || e);
  });
}
function onHouseTap(e){
  if (grabClick){ grabClick = false; return; }
  const p = houseTileAt(e), Rm = p.Rm, tx = p.tx, ty = p.ty;
  if (tx < 0 || ty < 0 || tx >= Rm.w || ty >= Rm.h){
    const sl = HAS_WALLGRID() ? wallPickAt(room, Rm, p.x, p.y) : null;
    if (sl) onWallTap(sl);
    return;
  }
  const occ = R.occupied(W, room, tx, ty);
  // 재배치 중이 아니면 구경만 — 가구가 가방으로 들어가 버리지 않는다
  if (!arrange){
    const Rm2 = RM(room);
    if (!Rm2.owner || Rm2.owner === key) flash('재배치를 누르면 가구를 끌어 옮길 수 있어요');
    return;
  }
  if (rotMode){
    if (!occ){ flash('돌릴 가구를 눌러요', true); return; }
    const r2 = act((w2, m) => R.rotateFurn(w2, m, room, occ));
    if (r2.ok) sfx('prop');
    renderHouse(); return;
  }
  if (occ){ const r2 = act((w2, m) => R.pickUp(w2, m, room, occ)); if (r2.ok){ sfx('prop'); furnPick = null; } renderHouse(); return; }
  if (furnPick){
    const f = furnPick, rr = furnRot;
    const r2 = act((w2, m) => R.place(w2, m, room, f, tx, ty, rr));
    if (r2.ok){
      sfx(f === 'medalcase' ? 'medal' : 'plant');
      // 걸이는 늘 왼쪽 벽에 걸리므로, 어디에 놓든 그 자리에 나타나는 까닭을 알려 준다

    }
    if (!(M.inv['f:' + f] > 0)) furnPick = null;
    renderHouse(); return;
  }
  flash('가방의 가구를 먼저 골라요');
}
// ---------- 둘이서 ----------
function renderDuo(){
  const lv = R.levelOf(M.xp), o = R.OTHER[key];
  const bb = $('#builds'); bb.innerHTML = '';
  const ms = R.moveState ? R.moveState(W, M) : null;
  if (ms && ms.next && (ms.ready || ms.ask)){ const mc = moveCard('build move'); if (mc) bb.appendChild(mc); }
  const q = R.questOf ? R.questOf(W, now()) : null;
  if (q){                                                          // 농장 손님 부탁(2026-10-09)
    const c = document.createElement('div'); c.className = 'build move';
    const have = R.countOf(M, q.id);
    c.innerHTML = '<div class="nm">' + q.icon + ' ' + q.name + '의 부탁</div><div class="pr">' + (q.done ? '✅ ' + NAME[q.by] + '가 들어줬어요. 다음 부탁은 곧 와요'
      : '「' + R.itemName(q.id) + ' ' + q.n + '개 구해 줄래?」 (가방에 ' + have + '개)<br>🎁 ' + q.coins + ' 동전' + (q.gift ? ' · ' + R.itemName(q.gift) : '')) + '</div>';
    if (!q.done){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(btn('건네주기', have >= q.n ? 'primary' : '', () => { const r = act((w, m) => R.giveQuest(w, m, now())); if (r.ok) sfx('fanfare'); })); c.appendChild(a); }
    bb.appendChild(c);
  }
  Object.keys(R.BUILDINGS).forEach(id => {
    const B = R.BUILDINGS[id], s = R.buildState(W, id);
    const d = document.createElement('div'); d.className = 'build' + (s.done ? ' done' : '');
    const need = Object.keys(B.each).map(k => (k === 'coins' ? '🪙 ' : R.itemName(k) + ' ') + B.each[k] + (k === 'coins' ? '' : '(' + (M.inv[k] || 0) + ')')).join(' · ');
    d.innerHTML = '<div class="nm">' + B.icon + ' ' + B.name + (s.done ? ' · 다 지었어요' : lv < B.lv ? ' · 레벨 ' + B.lv + '부터' : '') + '</div><div>' + B.desc + '</div>' +
      '<div class="who"><span class="' + (s.sua ? 'paid' : '') + '">수아' + (s.sua ? ' ✓' : '') + '</span><span class="' + (s.yona ? 'paid' : '') + '">연아' + (s.yona ? ' ✓' : '') + '</span></div>' +
      (s.done ? '' : '<div class="need">각자 ' + need + '</div>');
    if (!s.done && !s[key]){ const b = btn(s[o] ? '내 몫 내기 — ' + NAME[o] + '가 기다려요!' : '내 몫 내기', 'sm', () => { const r = act((w, m) => R.contribute(w, m, id, now())); if (r.ok) sfx(r.built ? 'fanfare' : 'pop'); }, lv < B.lv || !R.canPay(M, B.each)); b.style.marginTop = '6px'; d.appendChild(b); }
    bb.appendChild(d);
  });
  // 주문
  const ob = $('#orders'); ob.innerHTML = '';
  R.ordersOf(W, now()).forEach(od => {
    const p = R.orderProgress(W, od), C = R.CROPS[od.crop], have = R.countOf(M, 'crop:' + od.crop);
    const d = document.createElement('div'); d.className = 'order' + (p.done ? ' done' : '');
    d.innerHTML = '<b>' + C.name + ' ' + od.n + '개</b><span class="pb"><i style="width:' + Math.round(100 * p.got / od.n) + '%"></i></span><span>' + p.got + '/' + od.n + ' · 🪙 ' + od.reward + (od.rareSeed ? ' + 별씨앗' : '') + '</span>' +
      (Object.keys(p.by || {}).length ? '<span class="sub" style="margin:0;flex-basis:100%;">' + Object.keys(p.by).map(k => NAME[k] + ' ' + p.by[k]).join(' · ') + '</span>' : '');
    if (!p.done) d.appendChild(btn('보태기 (' + have + '개 있음)', 'sm', () => { const n = Math.min(have, od.n - p.got); act((w, m) => R.fillOrder(w, m, od, n, now())); sfx('pop'); }, !have));
    ob.appendChild(d);
  });
  // 축제
  const cal = R.calendar(W, now()), F = R.FESTIVALS[cal.season], fk = R.festivalKey(W, now()), fs = W.festival[fk];
  const fb = $('#fest');
  const openNow = R.festivalOpen(W, now());
  /* 축제 저울 — 얼마나 찼는지, 그중 누가 얼마를 냈는지가 한눈에 보여야
     「같이 채우는 일」이 된다. 숫자만 적으면 아이는 자기 몫을 못 읽는다. */
  const sc = fs ? fs.score : 0, byS = (fs && fs.by && fs.by.sua) || 0, byY = (fs && fs.by && fs.by.yona) || 0;
  const pc = v => Math.min(100, Math.round(v / F.n * 100));
  fb.innerHTML = '<b class="t">' + F.icon + ' ' + F.name + '</b> — ' + F.desc + '<br>'
    + (fs && fs.done ? '이번 ' + R.SEASON_NAME[cal.season] + ' 축제는 상을 받았어요 🏆'
      : openNow ? '지금 열렸어요!'
      : R.SEASON_NAME[cal.season] + ' ' + (cal.len - 1) + '일째부터 열려요 (' + Math.max(0, cal.len - 1 - cal.dayOfSeason) + '일 뒤). 미리 모아 둬요.')
    + '<div class="fbar"><i class="s" style="width:' + pc(byS) + '%"></i>'
    + '<i class="y" style="left:' + pc(byS) + '%;width:' + pc(byY) + '%"></i>'
    + '<b>' + sc + ' / ' + F.n + '</b></div>'
    + '<span class="fkeys"><i class="s"></i>' + NAME.sua + ' ' + byS + ' &nbsp; <i class="y"></i>' + NAME.yona + ' ' + byY + '</span>';
  if (openNow && !(fs && fs.done)){
    const wrap = document.createElement('div'); wrap.className = 'act'; wrap.style.marginTop = '6px';
    Object.keys(M.inv).filter(id => M.inv[id] > 0 && R.festivalWorth(cal.season, id, W, now()) > 0).forEach(id => wrap.appendChild(btn(R.itemName(id) + ' ' + M.inv[id] + '개 내기', 'sm', () => { const n = M.inv[id]; const r = act((w, m) => R.donate(w, m, id, n, now())); if (r.ok){ sfx(r.won ? 'fanfare' : 'pop'); if (r.won) openPrize(F); } })));
    if (!wrap.children.length) wrap.innerHTML = '<span class="sub">낼 것이 가방에 없어요</span>';
    fb.appendChild(wrap);
  }
  // 동물
  const ab = $('#animals'); ab.innerHTML = '';
  if (!W.animals.length) ab.innerHTML = '<p class="sub">아직 동물이 없어요. 닭장을 지으면 가게에서 닭을 살 수 있어요.</p>';
  const today = R.dayKey(now());
  W.animals.forEach(a => {
    const d = document.createElement('div'); d.className = 'animal';
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; cv.getContext('2d').imageSmoothingEnabled = false; drawAnimalAt(cv.getContext('2d'), a.kind, 4, 5, 1, false, a.baby ? 2 / 3 : 1); d.appendChild(cv);
    const info = document.createElement('div');
    const petted = a.petDay === today ? (a.pet || []) : [];
    // 새끼는 아직 알을 못 낳는다. 며칠 더 돌보면 어른이 되는지 알려 준다.
    const grow = a.baby ? Math.max(1, R.BABY_DAYS - R.daysBetween(a.born, today)) : 0;
    info.innerHTML = '<span class="nm">' + escapeHTML(a.name) + '</span> ' + (a.baby ? '<span class="baby">🐣 아기</span> ' : '') + '<span class="love">' + '♥'.repeat(a.love || 0) + '♡'.repeat(10 - (a.love || 0)) + '</span><br><span class="sub" style="margin:0;">' + (a.fedDay === today ? '밥 먹었어요' : '<b>배고파요</b>') + ' · 쓰다듬기 ' + (petted.length ? petted.map(k => NAME[k]).join('·') : '아직') + (a.baby ? ' · <b>' + grow + '일</b> 뒤 어른이 돼요' : '') + (a.ready ? ' · <b>' + escapeHTML(R.ee(R.itemName(a.ready))) + '</b> 있어요' : '') + '</span>';
    d.appendChild(info);
    const act2 = document.createElement('div'); act2.className = 'act';
    // 기운이 모자라면 누르기 전에 알려 준다 — 눌러서 거절당하는 것보다 낫다
    const tired = (M.energy || 0) < R.COST.feed && a.fedDay !== today;
    act2.appendChild(btn(tired ? '🍚 밥 · ⚡부족' : '🍚 밥', 'sm', () => act((w, m) => R.feed(w, m, a.id, now())), a.fedDay === today || tired));
    act2.appendChild(btn('🤚 쓰다듬기', 'sm', () => { const r = act((w, m) => R.pet(w, m, a.id, now())); if (r.love) sfx('purr'); }, petted.indexOf(key) >= 0));
    if (a.ready) act2.appendChild(btn('줍기', 'sm buy', () => { act((w, m) => R.collect(w, m, a.id, now())); sfx('pop'); }));
    act2.appendChild(btn('✏️', 'sm', () => nameDialog(a)));
    d.appendChild(act2); ab.appendChild(d);
  });
  renderTree();
}
// ---------- 🛶 방주 — 메인 목표 「수아연아의 방주」(2026-10-09 로키즈) ----------
/* 큰 퀘스트 카드(짝·씨앗·방주·양식 막대) → 지금 할 일(방주 농장 가는 길 / 방주 짓기·양식 창고·입장 / 한 달 보내기 / 새 땅 짓기) → 방주 명부(동물 짝·씨앗 금고).
   규칙은 farm-rules-play.js 의 ark* · landPay */
const arkLabel = (n, max) => Math.min(n, max) + '/' + max;
const arkBar = (label, n, max, cls) => '<div><b>' + label + ' ' + arkLabel(n, max) + '</b><span><i class="' + (cls || '') + '" style="width:' + Math.round(100 * Math.min(1, max ? n / max : 0)) + '%"></i></span></div>';
const arkCost = each => Object.keys(each).map(k => (k === 'coins' ? '🪙 ' + each[k] : escapeHTML(R.itemName(k)) + ' ' + each[k] + '(' + (M.inv[k] || 0) + ')')).join(' · ') || '없음';
const shortDay = k => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(k || ''); return m ? Number(m[1]) + '월 ' + Number(m[2]) + '일' : ''; };
function arkWaiting(){
  if (!R.arkState) return 0;
  const s = R.arkState(W, M, now()), o = R.OTHER[key];
  let n = 0;
  if (s.atArk && !s.phase && s.step < s.total && s.paid[o] && !s.paid[key]) n++;
  if (s.otherAsked) n++;
  s.land.forEach(L => { if (L.open && !L.done && L.paid[o] && !L.paid[key]) n++; });
  if (s.phase === 'flood' && !s.monthDone) n++;
  return n;
}
function renderArk(){
  const box = $('#arkBox'); if (!box || !R.arkState) return;
  const s = R.arkState(W, M, now()), o = R.OTHER[key];
  box.innerHTML = '';
  const card = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
  const wrap = document.createElement('div'); wrap.className = 'duo';
  const L1 = document.createElement('div'), L2 = document.createElement('div');
  wrap.appendChild(L1); wrap.appendChild(L2); box.appendChild(wrap);
  // 큰 퀘스트
  const say = s.phase === 'land' ? (s.landDone >= s.land.length ? '무지개 농장이 완성됐어요! 수아연아의 방주 이야기를 다 해냈어요 🌈' : '물이 빠진 새 땅이에요. 무지개 농장을 하나씩 지어요')
    : s.phase === 'flood' ? '방주 안에서 열두 달을 버텨요. 하루에 한 달씩, 양식을 아껴 먹고 동물을 돌봐요'
    : s.atArk ? (s.step >= s.total ? '방주가 다 지어졌어요! 둘이 함께 방주에 들어가요' : '방주 터에 방주를 열 단계로 지어요. 그동안 동물 짝·씨앗·양식을 모아요')
    : '큰비가 오기 전에 동물을 한 쌍씩, 씨앗을 한 알씩 모아요. 오아시스 농장 다음이 방주 농장이에요';
  const q = card('quest', '<h4>📜 큰 퀘스트 — 수아연아의 방주</h4>' + say
    + '<div class="bars">' + arkBar('🐾 동물 짝', s.pairsHave, s.pairsTotal) + arkBar('🌰 씨앗 금고', s.seedsHave, s.seedsTotal)
    + arkBar('🛶 방주', s.step, s.total, 'wood') + (s.phase === 'flood' ? arkBar('🌊 항해', s.month, s.months, 'sea') : s.phase === 'land' ? arkBar('🌈 새 땅', s.landDone, s.land.length) : arkBar('🌾 양식', s.food, s.foodMin, 'food')) + '</div>');
  const qr = document.createElement('div'); qr.className = 'row';
  qr.appendChild(btn('🌤️ 하나님의 말씀 다시 듣기', 'sm', () => openVoice()));
  q.appendChild(qr); L1.appendChild(q);
  // 지금 할 일
  if (!s.phase && !s.atArk){
    const i0 = W.farm || 0, ia = R.FARMS.findIndex(f => f.id === 'ark');
    const path = R.FARMS.slice(i0, ia + 1).filter(f => !f.skip).map(f => f.icon + ' ' + f.name).join(' → ');
    L1.appendChild(card('build move', '<div class="nm">🚚 방주 농장까지</div><div class="pr">' + path + '<br>지금부터 동물을 한 쌍씩, 씨앗을 한 알씩 모아 둬요. <b>농장 전용 동식물</b>은 그 농장에 있을 때만 얻을 수 있어서, 다 챙겨야 다음 농장으로 떠날 수 있어요.<br><small>방주 농장에서는 혼자인 동물에게 짝꿍이 스스로 찾아와요(창세기 7:9).</small></div>'));
    // 이 농장에서만 얻는 것(2026-10-09 로키즈 「각 농장에서만 얻는 동식물 — 이주 조건」)
    const LS = R.localState ? R.localState(W, M) : null, F = R.farmOf(W);
    if (LS && (LS.animals.length || LS.crops.length || LS.goods.length)){
      const row = (x, txt) => '<span class="' + (x.have ? 'paid' : '') + '">' + (x.have ? '✅ ' : '⬜ ') + txt + '</span>';
      const c = card('build move', '<div class="nm">' + F.icon + ' ' + F.name + '에서만 얻는 것 — 떠나기 전에 챙겨요</div>'
        + (LS.animals.length ? '<div class="who">' + LS.animals.map(x => row(x, R.ANIMALS[x.id].icon + ' ' + R.ANIMALS[x.id].name + (R.ANIMALS[x.id].gift ? '' : ' (가게)'))).join('') + '</div>' : '')
        + (LS.crops.length ? '<div class="who">' + LS.crops.map(x => row(x, '🌰 ' + R.CROPS[x.id].name + ' 씨앗 → 금고')).join('') + '</div>' : '')
        + (LS.goods.length ? '<div class="who">' + LS.goods.map(x => row(x, R.itemName(x.id))).join('') + '</div>' : ''));
      LS.crops.filter(x => !x.have && (M.inv['seed:' + x.id] || 0) > 0).forEach(x => { const b = btn('🌰 ' + R.CROPS[x.id].name + ' 씨앗 금고에 넣기', 'sm buy', () => { const r = act((w, m) => R.arkSeed(w, m, x.id, now())); if (r.ok) sfx('plant'); }); b.style.marginTop = '6px'; c.appendChild(b); });
      L1.appendChild(c);
    }
  }
  if (s.atArk && !s.phase){
    // 방주 열 단계
    const st = document.createElement('div');
    st.innerHTML = '<h3 class="pixel">방주 짓기 ' + s.step + '/' + s.total + '</h3><p class="sub">각자 제 몫을 내요. 둘 다 내야 한 단계 올라가고, 농장 가운데 방주가 서서히 지어져요.</p>';
    s.steps.forEach(S => {
      if (S.done){ st.appendChild(card('stepline done', '✅ ' + (S.i + 1) + '단계 ' + S.icon + ' ' + S.name + (s.on[S.i] ? ' · ' + shortDay(s.on[S.i]) : ''))); return; }
      if (!S.cur){ st.appendChild(card('stepline', '⬜ ' + (S.i + 1) + '단계 ' + S.icon + ' ' + S.name)); return; }
      const c = card('build move', '<div class="nm">' + S.icon + ' ' + (S.i + 1) + '단계 — ' + S.name + '</div><div>' + escapeHTML(S.say) + '</div>'
        + '<div class="who"><span class="' + (s.paid.sua ? 'paid' : '') + '">수아' + (s.paid.sua ? ' ✓' : '') + '</span><span class="' + (s.paid.yona ? 'paid' : '') + '">연아' + (s.paid.yona ? ' ✓' : '') + '</span></div>'
        + '<div class="need">' + (S.id === 'store' ? '양식 창고 ' + s.food + '/' + s.foodMin + ' — 아래 창고에 먹을 것을 넣어요' : '각자 ' + arkCost(S.each)) + '</div>');
      if (!s.paid[key]){
        const ok = S.id === 'store' ? s.food >= s.foodMin : R.canPay(M, S.each);
        const b = btn(s.paid[o] ? '내 몫 내기 — ' + NAME[o] + '가 기다려요!' : '내 몫 내기', 'sm' + (ok ? ' buy' : ''), () => {
          const r = act((w, m) => R.arkPay(w, m, now()));
          if (r.ok){ sfx(r.built ? 'fanfare' : 'pop'); if (r.built){ flash(r.msg + ' <b>농장 가운데를 봐요!</b>'); window.scrollTo({ top: 0, behavior: STILL ? 'auto' : 'smooth' }); } }
        }, !ok);
        b.style.marginTop = '6px'; c.appendChild(b);
      }
      st.appendChild(c);
    });
    L1.appendChild(st);
    if (s.step < s.total) L1.appendChild(card('sub', '🪵 나무는 왼쪽·앞쪽 잣나무 숲에서 베고, 🖤 역청 덩어리는 낮에 땅에 떨어진 것을 주워요. 돌은 바위에서 캐요.'));
    // 입장
    if (s.step >= s.total){
      const c = card('build move', '<div class="nm">🛶 방주에 들어가기</div><div class="pr">' + (s.otherAsked ? '<b>' + NAME[o] + '가 방주에 들어가자고 해요!</b> 좋다고 하면 모두 들어가고 문이 닫혀요'
        : s.mineAsked ? NAME[o] + '의 대답을 기다려요' : '둘 다 좋다고 하면 동물 ' + (W.animals || []).length + '마리와 함께 방주에 들어가요. 문이 닫히고 큰비가 내려요.')
        + '<br><small>밭에 서 있는 작물은 거둬서 양식 창고에 실어요. 방주 안에서는 가게·밭·채집이 쉬고, 하루에 한 달씩 열두 달을 지내요.</small></div>');
      const a = document.createElement('div'); a.className = 'act';
      if (!s.mineAsked) a.appendChild(btn(s.otherAsked ? '좋아, 들어가자!' : '방주에 들어가자고 하기', 'buy', () => {
        if (s.otherAsked && !confirm('방주에 들어갈까요? 열두 달 동안은 섬에 못 나와요.')) return;
        if (visiting()) visitFarm(null);
        const r = act((w, m) => R.arkBoard(w, m, now()));
        if (r.ok){ sfx(r.boarded ? 'fanfare' : 'pop'); if (r.boarded) openBoardScene(); }
      }));
      if (s.ask) a.appendChild(btn(s.mineAsked ? '물어본 것 거두기' : '조금 이따가', '', () => act((w, m) => R.arkBoardCancel(w, m, now()))));
      c.appendChild(a); L1.appendChild(c);
    }
  }
  if (s.phase === 'flood'){
    const L = s.log[s.month] || null, nx = s.log[s.month + 1] || null;
    const c = card('build move', '<div class="nm">🌊 방주 ' + s.month + '달째 / ' + s.months + '달</div>'
      + '<div class="months">' + Array.from({ length: s.months }, (_, i) => '<i class="' + (i < s.month ? 'on' : i === s.month ? 'now' : '') + '"></i>').join('') + '</div>'
      + '<div class="monthtext">' + (L ? L.icon + ' ' + escapeHTML(L.text) + ' <small>(창세기 ' + L.ref + ')</small>' : '🚪 방주 문이 닫혔어요. 이제 큰비가 내려요') + '</div>'
      + '<div class="pr">한 달에 양식 ' + s.ration + '을 먹어요(우리 둘 4 + 동물 두 마리마다 1). 창고 ' + s.food + (s.monthDone ? ' · <b>오늘 한 달은 보냈어요. 내일 또 와요</b>' : '') + (nx && !s.monthDone ? '<br>다음 달: ' + nx.icon + ' …' : '') + '</div>');
    const a = document.createElement('div'); a.className = 'act';
    a.appendChild(btn('🌙 한 달 보내기 (양식 −' + s.ration + ')', 'buy', () => {
      const r = act((w, m) => R.arkMonth(w, m, now()));
      if (r.ok) sfx(r.landed ? 'fanfare' : 'sparkle');
    }, s.monthDone || s.food < s.ration));
    a.appendChild(btn('🎣 창밖 낚시', '', () => { const B = window.FARMHD && window.FARMHD.ark && window.FARMHD.ark.voyageBox; startFishing('flood', B ? { x: B.x0 - 30, y: B.water + 24 } : null); if (liveCv) liveCv.scrollIntoView({ block: 'center', behavior: STILL ? 'auto' : 'smooth' }); }));
    c.appendChild(a);
    if (s.food < s.ration) c.appendChild(card('pr', '⚠️ 양식이 ' + (s.ration - s.food) + ' 모자라요. 동물이 낳은 것을 줍거나 창밖 낚시로 잡아 아래 창고에 넣어요. 모자라도 괜찮아요 — 채우면 다시 떠나요.'));
    c.appendChild(card('pr', '<small>동물 밥·쓰다듬기는 「👭 둘이서」 칸에서 그대로 해요. 달걀·우유 같은 것도 창고에 넣으면 양식이 돼요.</small>'));
    L1.appendChild(c);
  }
  // 양식 창고 — 방주 농장(짓는 동안)과 방주 안
  if ((s.atArk && !s.phase) || s.phase === 'flood'){
    const need = s.phase === 'flood' ? s.ration * Math.max(1, s.months - s.month) : s.foodMin;
    const c = card('build', '<div class="nm">🌾 양식 창고 — ' + s.food + (s.phase === 'flood' ? ' (남은 달을 다 지내려면 ' + need + ')' : ' / ' + s.foodMin) + '</div>'
      + '<div class="bars">' + arkBar('창고', s.food, need, 'food') + '</div>'
      + '<div class="need">' + (s.by.sua || s.by.yona ? '넣은 몫 — 수아 ' + (s.by.sua || 0) + ' · 연아 ' + (s.by.yona || 0) + '<br>' : '') + '작물 3 · 요리 8~20 · 물고기 4 · 달걀 2 · 우유 3 · 큰 작물 15</div>');
    const ids = Object.keys(M.inv).filter(id => M.inv[id] > 0 && R.arkFoodOf(id) > 0).sort((a, b) => R.arkFoodOf(b) * M.inv[b] - R.arkFoodOf(a) * M.inv[a]);
    const a = document.createElement('div'); a.className = 'act'; a.style.flexWrap = 'wrap';
    ids.slice(0, 16).forEach(id => { const n = M.inv[id], v = R.arkFoodOf(id); a.appendChild(btn(escapeHTML(R.itemName(id)) + ' ' + n + '개 넣기 (+' + v * n + ')', 'sm', () => { const r = act((w, m) => R.arkStore(w, m, id, n, now())); if (r.ok) sfx('pop'); })); });
    if (!ids.length) a.innerHTML = '<span class="sub">가방에 양식이 될 것이 없어요. 거두고, 요리하고, 낚아 와요.</span>';
    c.appendChild(a); L1.appendChild(c);
  }
  if (s.phase === 'land'){
    const all = s.landDone >= s.land.length;
    if (all) L1.appendChild(card('done-all', '🌈 무지개 농장 완성! 🎉<br><small>방주를 짓고, 큰물을 건너고, 새 땅에 마을을 세웠어요. 이제 이 땅에서 오래오래 농사지어요.</small>'));
    const st = document.createElement('div');
    st.innerHTML = '<h3 class="pixel">새 땅 짓기 ' + s.landDone + '/' + s.land.length + '</h3><p class="sub">하나를 다 지어야 다음이 열려요. 각자 제 몫을 내요.</p>';
    s.land.forEach(L => {
      if (L.done){ st.appendChild(card('stepline done', '✅ ' + L.icon + ' ' + L.name)); return; }
      if (!L.open){ st.appendChild(card('stepline', '⬜ ' + L.icon + ' ' + L.name)); return; }
      const c = card('build move', '<div class="nm">' + L.icon + ' ' + L.name + '</div><div>' + escapeHTML(L.say) + '</div>'
        + '<div class="who"><span class="' + (L.paid.sua ? 'paid' : '') + '">수아' + (L.paid.sua ? ' ✓' : '') + '</span><span class="' + (L.paid.yona ? 'paid' : '') + '">연아' + (L.paid.yona ? ' ✓' : '') + '</span></div><div class="need">각자 ' + arkCost(L.each) + '</div>');
      if (!L.paid[key]){ const b = btn(L.paid[o] ? '내 몫 내기 — ' + NAME[o] + '가 기다려요!' : '내 몫 내기', 'sm' + (R.canPay(M, L.each) ? ' buy' : ''), () => { const r = act((w, m) => R.landPay(w, m, L.id, now())); if (r.ok) sfx(r.built ? 'fanfare' : 'pop'); }, !R.canPay(M, L.each)); b.style.marginTop = '6px'; c.appendChild(b); }
      st.appendChild(c);
    });
    L1.appendChild(st);
    L1.appendChild(card('sub', '🫒 올리브는 낮에 땅에 떨어진 것을 주워요. 방주 씨앗 금고에 넣어 온 작물은 다른 농장 전용이라도 여기서 자라요.'));
  }
  // 방주 명부 — 동물 짝
  const lh = document.createElement('div');
  lh.innerHTML = '<h3 class="pixel">방주 명부 — 동물 ' + arkLabel(s.pairsHave, s.pairsTotal) + '쌍</h3><p class="sub">한 가지에 두 마리면 한 쌍. 새끼를 보거나 가게에서 사요.' + (s.atArk && !s.phase ? ' 방주 농장에서는 짝꿍이 스스로 찾아와요.' : '') + '</p>';
  const lg = document.createElement('div'); lg.className = 'ledger';
  s.pairs.forEach(P => {
    const A = R.ANIMALS[P.kind], d = document.createElement('div'); d.className = P.n >= 2 ? 'ok' : P.n === 1 ? 'half' : '';
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; cv.getContext('2d').imageSmoothingEnabled = false; drawAnimalAt(cv.getContext('2d'), P.kind, 4, 5, 1, false, 1);
    if (!P.n) cv.style.opacity = '.3';
    d.appendChild(cv);
    const where = A.gift ? (R.FARMS.find(f => f.id === A.gift) || {}).name + ' 이사 식구' : A.farm ? (R.FARMS.find(f => f.id === A.farm) || {}).name + ' 가게에서만' : '가게에서';
    d.insertAdjacentHTML('beforeend', '<b>' + A.icon + ' ' + A.name + '</b>' + (P.n >= 2 ? '✅ 한 쌍' + (P.n > 2 ? ' (+' + (P.n - 2) + ')' : '') : P.n === 1 ? '혼자 1/2' : '0/2 · ' + where));
    lg.appendChild(d);
  });
  lh.appendChild(lg); L2.appendChild(lh);
  // 씨앗 금고
  const sh = document.createElement('div');
  sh.innerHTML = '<h3 class="pixel">씨앗 금고 ' + arkLabel(s.seedsHave, s.seedsTotal) + '</h3><p class="sub">작물마다 씨앗 한 알씩. 새 땅에 내리면 금고의 씨앗을 둘에게 두 알씩 돌려줘요.</p>';
  const sg = document.createElement('div'); sg.className = 'ledger';
  R.CROP_IDS.forEach(c => {
    const C = R.CROPS[c], inV = s.seeds.indexOf(c) >= 0, have = (M.inv['seed:' + c] || 0) > 0, d = document.createElement('div'); d.className = inV ? 'ok' : have ? 'half' : '';
    const ic = cropIcon(c); if (!inV && !have) ic.style.opacity = '.35'; d.appendChild(ic);
    const hint = C.farm ? (R.FARMS.find(f => f.id === C.farm) || {}).name + '에서만' : C.rare ? '축제·행상인' : C.season.map(x => R.SEASON_NAME[x]).join('·') + ' 씨앗' + (C.half ? ' · ' + NAME[C.half] + ' 가게' : '');
    d.insertAdjacentHTML('beforeend', '<b>' + C.name + '</b>' + (inV ? '✅ 금고에' : have ? '가방에 ' + M.inv['seed:' + c] + '알' : hint));
    if (!inV && have) d.appendChild(btn('넣기', '', () => { const r = act((w, m) => R.arkSeed(w, m, c, now())); if (r.ok) sfx('plant'); }));
    sg.appendChild(d);
  });
  sh.appendChild(sg); L2.appendChild(sh);
}
// 하나님의 음성(2026-10-09 로키즈 「이사가기로 결정버튼을 누르면 하나님의 음성」) — 장면 아래 대사가 한 줄씩. 다 들으면 큰 퀘스트 카드
const VOICE_KEY = () => 'suayona.farm.voice.' + key;
const VOICE_LINES = [
  ['', '(하늘의 구름이 갈라지고, 따스한 빛이 내려와요…)'],
  ['God', '수아야, 연아야.'],
  ['God', '너희가 지금까지 착실하게 농장을 가꾸고, 동물들을 사랑으로 돌보는 모습이 참 어여쁘구나.'],
  ['God', '이제 내가 너희에게 아주 큰 퀘스트를 하나 주겠다.'],
  ['God', '머지않아 큰비가 내릴 것이다. 사십 일 밤낮 비가 그치지 않아, 물이 온 땅과 높은 산까지 덮을 것이다.'],
  ['God', '그러니 너희는 잣나무로 커다란 방주를 지어라. 삼 층으로 짓고 칸을 나누고, 안팎에 역청을 칠하고, 위에는 창을, 옆에는 문을 내어라. (창세기 6:14-16)'],
  ['God', '모든 동물을 암수 한 쌍씩 방주로 데려와 함께 살게 하여라. 땅의 모든 씨앗도 한 알씩 담아 두어라.'],
  ['God', '너희와 동물들이 먹을 양식도 넉넉히 모아 두어라. 방주 안에서 꼬박 한 해를 지내야 한단다. (6:21)'],
  ['God', '두려워하지 말아라. 내가 너희와 함께하겠다. 물이 빠지면 너희에게 무지개를 보여 주마.'],
  ['sua', '네! 연아야, 우리 같이 해 보자!'],
  ['yona', '응, 언니! 동물 친구들 다 데려가자!'],
];
function openVoice(then){
  const inner = $('#modalInner'), H = window.FARMHD && window.FARMHD.ark;
  try { localStorage.setItem(VOICE_KEY(), '1'); } catch (e) { /* 못 적으면 한 번 더 듣는다 */ }
  inner.innerHTML = '<h3 class="pixel">🌤️ 하늘에서 들려온 목소리</h3>' + (H ? H.SCENE_CV('voiceCv', '구름이 갈라지고 빛이 내려와 수아와 연아가 하늘을 올려다보는 그림') : '')
    + '<div class="voice-line" id="voiceLine" aria-live="polite"></div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small" id="voiceSkip">건너뛰기</button><button type="button" class="dot-btn small primary" id="voiceNext">다음 ▶</button></div>';
  $('#modal').hidden = false;
  const run = H ? H.voice($('#voiceCv'), { kinds: [...new Set((W.animals || []).map(a => a.kind))] }) : null;
  let i = 0, typing = 0;
  const show = () => {
    const [who, text] = VOICE_LINES[i], el = $('#voiceLine');
    el.className = 'voice-line' + (who === 'sua' || who === 'yona' ? ' kid' : '');
    el.innerHTML = (who ? '<span class="who">' + (who === 'God' ? '하나님의 음성' : NAME[who]) + '</span>' : '') + '<span id="voiceText"></span>';
    const t = $('#voiceText'); let n = 0; clearInterval(typing);
    if (STILL){ t.textContent = text; return; }
    typing = setInterval(() => { n += 2; t.textContent = text.slice(0, n); if (n >= text.length) clearInterval(typing); }, 40);
    if (who === 'God' && i === 1) sfx('sparkle');
  };
  const finish = () => {
    clearInterval(typing); if (run) run.stop();
    const s = R.arkState(W, M, now());
    inner.innerHTML = '<h3 class="pixel">📜 큰 퀘스트를 받았어요 — 수아연아의 방주</h3>'
      + '<ul class="voice-quest">'
      + '<li>🛶 <b>방주 농장</b> 한가운데 방주를 열 단계로 지어요 (지금 ' + s.step + '/' + s.total + ')</li>'
      + '<li>🐾 동물 열세 가지를 <b>한 쌍씩</b> 모아요 (지금 ' + s.pairsHave + '/' + s.pairsTotal + '쌍)</li>'
      + '<li>🌰 작물 씨앗을 한 알씩 <b>씨앗 금고</b>에 넣어요 (지금 ' + s.seedsHave + '/' + s.seedsTotal + ')</li>'
      + '<li>🌾 <b>양식 창고</b>를 채워요 — 방주 안에서 열두 달을 먹고 지내요</li>'
      + '<li>🌊 방주에 들어가 <b>대홍수</b>를 버티면 → 🌈 <b>무지개 농장</b>에 닿아요</li></ul>'
      + '<p class="sub">언제든 「🛶 방주」 칸에서 다시 볼 수 있어요.</p>'
      + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="voiceOk">🙏 네, 해 볼게요!</button></div>';
    $('#voiceOk').addEventListener('click', () => { closeModal(); sfx('fanfare'); if (then) then(); else if (tab !== 'ark') renderTab(); });
  };
  $('#voiceNext').addEventListener('click', () => { const t = $('#voiceText'); if (t && t.textContent.length < VOICE_LINES[i][1].length){ clearInterval(typing); t.textContent = VOICE_LINES[i][1]; return; } i++; if (i >= VOICE_LINES.length) finish(); else show(); });
  $('#voiceSkip').addEventListener('click', finish);
  show();
}
// 입장 장면 — 들어간 아이는 그 자리에서, 자매는 다음에 열 때 한 번
const BOARD_KEY = () => 'suayona.farm.boarded.' + key;
function openBoardScene(){
  const H = window.FARMHD && window.FARMHD.ark; if (!H) return;
  try { localStorage.setItem(BOARD_KEY(), '1'); } catch (e) { /* 다시 봐도 괜찮다 */ }
  const kinds = R.ARK_KINDS.filter(k => (W.animals || []).some(a => a.kind === k));
  $('#modalInner').innerHTML = '<h3 class="pixel">🛶 모두 방주로!</h3><p class="sub">동물들이 둘씩 짝지어 방주로 들어가요(창세기 7:9). 마지막으로 수아와 연아가 들어가고 — 문이 닫혀요.</p>'
    + H.SCENE_CV('boardCv', '동물들이 둘씩 방주에 들어가고 문이 닫히며 큰비가 내리는 그림')
    + '<div class="modal-actions"><button type="button" class="dot-btn small" id="boardAgain">🔁 다시 보기</button><button type="button" class="dot-btn small primary" id="boardGo">방주 안으로</button></div>';
  $('#modal').hidden = false;
  let run = H.boarding($('#boardCv'), { kinds, onDone: () => sfx('fanfare') });
  $('#boardAgain').addEventListener('click', () => { run.stop(); run = H.boarding($('#boardCv'), { kinds }); });
  $('#boardGo').addEventListener('click', () => { run.stop(); closeModal(); openTab('ark'); });
}
function renderTree(){
  const box = $('#tree'), wrap = $('#treeBox');
  if (!box || !wrap) return;
  const list = W.animals || [];
  if (!list.some(a => a.mom)){ wrap.hidden = true; return; }
  wrap.hidden = false; box.innerHTML = '';
  const kids = {};
  list.forEach(a => { if (a.mom) (kids[a.mom] = kids[a.mom] || []).push(a); });
  const byId = {}; list.forEach(a => { byId[a.id] = a; });
  const row = (a, depth, last) => {
    const d = document.createElement('div'); d.className = 'row';
    if (depth){
      const ln = document.createElement('span'); ln.className = 'ln';
      ln.textContent = '   '.repeat(depth - 1) + (last ? '└─ ' : '├─ ');
      d.appendChild(ln);
    }
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    cv.getContext('2d').imageSmoothingEnabled = false;
    drawAnimalAt(cv.getContext('2d'), a.kind, 4, 5, 1, false, a.baby ? 2 / 3 : 1);
    d.appendChild(cv);
    const nm = document.createElement('span'); nm.innerHTML = '<b>' + escapeHTML(a.name) + '</b>';
    d.appendChild(nm);
    if (a.baby){ const t = document.createElement('b'); t.className = 'baby'; t.textContent = '🐣'; d.appendChild(t); }
    const by = document.createElement('span'); by.className = 'by';
    by.textContent = '♥' + (a.love || 0) + ' · ' + (NAME[a.by] || '') + '가 돌봐요';
    d.appendChild(by);
    box.appendChild(d);
    (kids[a.id] || []).forEach((k, i, arr) => row(k, depth + 1, i === arr.length - 1));
  };
  // 어미가 없거나 어미가 사라진 아이가 뿌리다. 태어난 차례대로 세운다.
  list.filter(a => !a.mom || !byId[a.mom]).forEach(a => row(a, 0, true));
}
// ---------- 도감 ----------
/* 2026-10-09 로키즈 「도감 강화 전부」 — 갈래(작물·물고기…)와 농장으로 골라 보고, 칸을 누르면
   처음 만난 날·농장·모은 수·계절·가장 큰 물고기·힌트가 나온다. 수아 것과 연아 것을 나란히 보여 준다.
   동물·꾸미개·축제는 둘이 함께 가진 것이라 농장(W)에서 바로 읽는다. 다 모은 쪽은 한 장으로 내 전시실에 건다. */
let dexCat = 'crop', dexFarm = 'all', diaryAt = 0;
const DEX_CATS = [['all', '전체'], ['crop', '🌱 작물'], ['fish', '🐟 물고기'], ['dish', '🍳 요리'], ['goods', '🥚 산물'],
  ['animal', '🐮 동물'], ['guest', '🧳 손님·사건'], ['decor', '🎀 꾸미개'], ['furn', '🛋 가구']];
const DEX_EVENTS = [
  ['ev:peddler', '🧳', '떠돌이 행상인', '가끔 농장에 들르는 행상인에게서 물건을 사요', null],
  ['ev:box', '🎁', '행상인 보따리', '행상인이 파는 보따리를 풀어 봐요', null],
  ['ev:postcard', '💌', '그림엽서', '이사 준비를 절반 넘게 하면 다음 농장에서 엽서가 와요', null],
  ['ev:move', '🚚', '이사 선물', '둘이 좋다고 해서 다음 농장으로 이사 가면 우편으로 와요', null],
  ['ev:santa', '🎅', '산타 할아버지 편지', '산타 우체통을 놓으면 가끔 편지가 와요', 'aurora'],
  ['ev:genie', '🧞', '램프 요정 편지', '요술 램프를 놓으면 가끔 소원 편지가 와요', 'desert'],
  ['ev:ark', '🛶', '방주 씨앗 금고', '대홍수를 건너 새 땅에 내린 날, 금고의 씨앗과 선물이 우편으로 와요', 'newland'],
];
const GOOD_HINT = { honey: '벌통을 짓고 꽃이 피면 꿀이 고여요', berry: '덤불에서 따요', snowball: '겨울에 눈더미에서 뭉쳐요',
  firefly: '여름·가을 밤에 날아다녀요', shard: '오로라 농장 밤에 하늘에서 떨어져요', sandrose: '오아시스 농장 낮에 모래 위에 보여요',
  pitch: '방주 농장 낮에 땅에 떨어진 까만 덩어리를 주워요', olive: '무지개 농장 낮에 땅에 떨어진 것을 주워요',
  syrup: '단풍 농장 낮에 단풍나무 아래 시럽 양동이를 주워요', mango: '밀림 농장 낮에 땅에 떨어진 것을 주워요', baobab: '사바나 농장 낮에 바오밥 나무 아래서 주워요' };
const SEASON_DOT = { spring: '🌸', summer: '☀️', autumn: '🍁', winter: '❄️' };
const farmName = id => (R.FARMS.find(f => f.id === id) || { name: '' }).name;
const skipFarm = id => !!id && !!(R.FARMS.find(f => f.id === id) || {}).skip;
// 건너뛴 농장(화산)에 딸린 것은 다음 농장 쪽에 둔다 — 화산 아기 염소는 꽃구름으로 이사 갈 때 따라온다
function farmPage(id){ let i = R.FARMS.findIndex(f => f.id === id); if (i < 0) return 'meadow'; while (R.FARMS[i + 1] && R.FARMS[i].skip) i++; return R.FARMS[i].id; }
function dexList(){
  const out = [];
  const kid = k => ({ me: M.dex.indexOf(k) >= 0 ? (R.dexRec(M, k) || {}) : null,
    sis: other && other.dex.indexOf(k) >= 0 ? (R.dexRec(other, k) || {}) : null });
  const add = (o, k) => { const e = Object.assign(o, o.shared ? {} : kid(k || o.id)); e.farm0 = e.farm; e.farm = farmPage(e.farm); if (!e.shared) e.have = !!e.me; out.push(e); };
  R.CROP_IDS.forEach(c => {
    const C = R.CROPS[c];
    add({ cat: 'crop', id: 'crop:' + c, name: C.name, farm: C.farm || null, shiny: M.dex.indexOf('gold:' + c) >= 0 }, c);
    if (C.giant) add({ cat: 'crop', id: 'giant:' + c, name: '큰 ' + C.name, farm: C.farm || null });
  });
  R.FISH_IDS.forEach(f => { const F = R.FISH[f]; add({ cat: 'fish', id: 'fish:' + f, name: F.name, farm: R.originOf('fish:' + f) || (F.sea ? 'seaside' : F.ice ? 'aurora' : null) }); });
  Object.keys(R.DISHES).forEach(d => add({ cat: 'dish', id: 'dish:' + d, name: R.DISHES[d].name, farm: null }));
  R.DEX_GOODS.forEach(g => {
    const by = Object.keys(R.ANIMALS).filter(a => { const A = R.ANIMALS[a]; return A.product === g || A.best === g || (A.find || []).indexOf(g) >= 0; });
    const gift = by.length && by.every(a => R.ANIMALS[a].gift) ? R.ANIMALS[by[0]].gift : null;
    add({ cat: 'goods', id: g, name: R.itemName(g), farm: R.originOf(g) || gift });
  });
  Object.keys(R.ANIMALS).forEach(k => {
    const A = R.ANIMALS[k], list = (W.animals || []).filter(a => a.kind === k);
    const first = list.slice().sort((a, b) => String(a.born).localeCompare(String(b.born)))[0], babies = list.filter(a => a.mom).length;
    add({ cat: 'animal', id: 'animal:' + k, name: A.name, farm: A.gift || A.farm || null, shared: true, have: !!first, by: first && first.by,
      info: first ? [['처음 온 날', first.born + ' · ' + (A.gift && !first.mom ? '이사 때 아기로 따라왔어요' : NAME[first.by] + '가 데려왔어요')],
        ['지금', list.length + '마리' + (babies ? ' · 농장에서 태어난 아기 ' + babies + '마리' : '')]] : null });
  });
  DEX_EVENTS.forEach(([k, ic, nm, hint, f]) => add({ cat: 'guest', id: k, emoji: ic, name: nm, hint, farm: f }));
  add({ cat: 'guest', id: 'ev:fire', emoji: '🔥', name: '둘이서 모닥불', farm: null, shared: true, have: !!W.fireFirst,
    hint: '밤에 둘이 나란히 모닥불 앞에 앉아요', info: W.fireFirst ? [['처음 함께 앉은 날', W.fireFirst]] : null });
  Object.keys(R.GUESTS).forEach(f => { const G = R.GUESTS[f]; add({ cat: 'guest', id: 'guest:' + f, emoji: G.icon, name: G.name, farm: f,
    hint: farmName(f) + '에 살면 사흘마다 부탁하러 와요. 부탁을 들어주면 만난 거예요' }); });
  Object.keys(R.FESTIVALS).forEach(s => {
    const F = R.FESTIVALS[s], won = Object.keys(W.festival || {}).filter(k => /^y\d+/.test(k) && k.replace(/^y\d+/, '') === s && (W.festival[k] || {}).done);
    const who = {}; won.forEach(k => Object.keys(W.festival[k].by || {}).forEach(p => { who[p] = true; }));
    add({ cat: 'guest', id: 'fest:' + s, emoji: F.icon, name: F.name, farm: null, shared: true, have: won.length > 0,
      hint: R.SEASON_NAME[s] + ' 마지막 이틀에 열려요. ' + F.desc,
      info: won.length ? [['상 받은 해', won.map(k => k.match(/^y(\d+)/)[1] + '년째').join(' · ')], ['함께 낸 사람', Object.keys(who).map(p => NAME[p]).join('·') || '-']] : null });
  });
  // 꾸미개 — 떠나온 농장(W.past)에 두고 온 것까지. 앞선 농장 것이 먼저라 처음 놓은 자리가 남는다
  const deco = {};
  (W.past || []).forEach(p => Object.keys(p.decor || {}).forEach(v => { if (!deco[v]) deco[v] = Object.assign({ farm: p.farm }, p.decor[v]); }));
  Object.keys(W.decor || {}).forEach(v => { if (!deco[v]) deco[v] = Object.assign({ farm: R.farmOf(W).id }, W.decor[v]); });
  Object.keys(R.DECOR).forEach(v => {
    const Dc = R.DECOR[v], d = deco[v];
    if (skipFarm(Dc.farm)) return;                     // 화산 꾸미개는 살 곳이 없다
    add({ cat: 'decor', id: 'deco:' + v, emoji: Dc.icon, name: Dc.name, farm: Dc.farm || null, shared: true, have: !!d, by: d && d.by,
      info: d ? [['놓은 날', (d.on || '예전') + ' · ' + farmName(d.farm)], ['놓은 사람', NAME[d.by] || '-']] : null });
  });
  // 가구 — 집 물건이라 둘이 함께 모은다(W.furnAt). 적기 전부터 가진 것은 가방이나 방에 있으면 「예전부터」로 친다
  const room = {}; Object.keys(W.house || {}).forEach(r => Object.keys(W.house[r] || {}).forEach(p => { const it = W.house[r][p]; if (it) room[it.f] = r; }));
  Object.keys(R.FURNITURE).forEach(v => {
    const F = R.FURNITURE[v], a = (W.furnAt || {})[v];
    const old = !!room[v] || (M.inv['f:' + v] || 0) > 0 || !!(other && (other.inv['f:' + v] || 0) > 0);
    if (skipFarm(F.farm) && !a && !old) return;      // 화산 가구는 가게에서 못 사지만, 행상인에게 산 것은 보여 준다
    add({ cat: 'furn', id: 'f:' + v, name: F.name, farm: F.farm || null, shared: true, have: !!a || old, by: a && a.by,
      info: a ? [['처음 들인 날', a.d + ' · ' + farmName(a.f)], ['들인 사람', NAME[a.by] || '-']] : old ? [['', '예전부터 있었어요']] : null });
  });
  return out;
}
function dexHint(e){
  const [k, v] = e.id.split(':');
  if (e.hint) return e.hint;
  if (k === 'crop'){
    const C = R.CROPS[v], p = [C.seed ? C.season.map(s => R.SEASON_NAME[s]).join('·') + '에 심어요' : '씨앗은 가게에 없어요 — 축제 상으로 받아요'];
    if (C.half) p.push(NAME[C.half] + ' 가게 씨앗');
    if (C.farm) p.push(farmName(C.farm) + '에서만');
    if ((C.lv || 1) > 1) p.push('레벨 ' + C.lv + '부터');
    return p.join(' · ');
  }
  if (k === 'giant') return '나란히 자란 ' + R.CROPS[v].name + ' 두 포기가 가끔 커다랗게 붙어요. 둘이 함께 잡아당겨 뽑아요';
  if (k === 'fish'){
    const F = R.FISH[v];
    if (F.junk) return '물고기가 아니에요… ' + (F.sea ? '바다' : '연못') + '에서 가끔 걸려 올라와요';
    const p = [F.sea ? '바닷가 농장 바다' : F.ice ? '오로라 농장 얼음낚시 구멍' : '연못'];
    if (F.season) p.push(F.season.map(s => R.SEASON_NAME[s]).join('·'));
    if (F.night) p.push('밤에만');
    if (F.sell >= 200) p.push('아주 귀해요 — 낚시를 잘 맞추면 더 잘 물어요');
    return p.join(' · ');
  }
  if (k === 'dish'){
    const D = R.DISHES[v];
    return '재료: ' + Object.keys(D.need).map(i => R.itemName(i) + ' ' + D.need[i]).join(' · ')
      + (M.recipes.indexOf(v) >= 0 ? ' — 만드는 법을 알아요. 부엌에서 만들어요' : ' — 가게에서 만드는 법을 먼저 배워요');
  }
  if (k === 'animal'){
    const A = R.ANIMALS[v];
    return A.gift ? farmName(farmPage(A.gift)) + '으로 이사 갈 때 아기로 따라와요' : R.BUILDINGS[A.need].name + '을 짓고 가게에서 데려와요 · ' + A.cost + ' 동전';
  }
  if (k === 'deco'){ const Dc = R.DECOR[v]; return (Dc.desc ? Dc.desc + ' — ' : '') + (Dc.farm ? farmName(Dc.farm) + ' 가게' : '가게 꾸미기 칸') + ' · 레벨 ' + Dc.lv + ' · ' + Dc.cost + ' 동전'; }
  if (k === 'f'){
    const F = R.FURNITURE[v];
    if (F.rare) return '가게에는 없어요 — 훈장이나 상으로 받아요';
    if (!F.cost) return '처음부터 방에 있어요';
    return (F.farm ? farmName(F.farm) + ' 가게' : '가게 가구 칸') + (F.season ? ' · ' + R.SEASON_NAME[F.season] + '에만' : '') + ' · ' + F.cost + ' 동전';
  }
  const p = [];
  Object.keys(R.ANIMALS).forEach(a => { const A = R.ANIMALS[a];
    if (A.product === e.id) p.push(R.ee(A.name) + ' 낳아요');
    else if (A.best === e.id) p.push('마음이 가득 찬 ' + R.ee(A.name) + ' 가끔');
    else if ((A.find || []).indexOf(e.id) >= 0) p.push(R.ee(A.name) + ' 물어 와요'); });
  if (GOOD_HINT[e.id]) p.unshift(GOOD_HINT[e.id]);
  return p.join(' · ') || '여기저기서 모아요';
}
/* 칸 그림은 한 번 그려 담아 둔다 — 행동마다 도감을 다시 그리는데, 가구 91개를 매번 새로 그리면
   「전체」에서 0.2~0.4초씩 걸렸다. 담은 것을 새 캔버스에 옮겨 그려 준다(한 캔버스는 한 자리에만 선다). */
const dexIconKeep = {};
function dexIcon(e){
  // 고화소 가구 그림은 낮·밤 빛깔이 달라(furnBitmap) 그때의 낮밤을 열쇠에 넣는다
  const k = e.id + (e.shiny ? '*' : '') + (e.cat === 'furn' ? '|' + (dayLight().dark ? 'n' : 'd') : ''), src = dexIconKeep[k] || (dexIconKeep[k] = dexIconDraw(e));
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
  cv.getContext('2d').drawImage(src, 0, 0);
  return cv;
}
function dexIconDraw(e){
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  try {
    if (e.emoji){ g.font = '24px "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e.emoji, 16, 18); }
    else if (e.cat === 'animal') drawAnimalAt(g, e.id.slice(7), 4, 5, 1, false, 1);
    else if (e.cat === 'furn'){
      const src = furnPreview(e.id.slice(2)).querySelector('canvas');
      if (src && src.width){
        const s0 = Math.min(32 / src.width, 32 / src.height), s = s0 >= 1 ? Math.floor(s0) : s0;
        g.imageSmoothingEnabled = s < 1;
        g.drawImage(src, (32 - src.width * s) / 2, (32 - src.height * s) / 2, src.width * s, src.height * s);
      }
    } else g.drawImage(itemIcon(e.shiny ? 'gold:' + e.id.slice(5) : e.id), 0, 0);
  } catch (err){ /* 그림이 없어도 칸은 나와야 한다 */ }
  return cv;
}
function dexWho(e){
  // 공동 것은 누가 했는지, 각자 것은 수·연 두 글자에 불을 켠다. 둘 다면 하트
  const s = document.createElement('span'); s.className = 'who';
  if (e.shared){
    if (NAME[e.by]){ const i = document.createElement('i'); i.className = 'on k-' + e.by; i.textContent = NAME[e.by][0]; s.appendChild(i); }   // 서버 값은 모양을 안 거른다 — 수아·연아만
    return s;
  }
  const has = { [key]: e.me, [R.OTHER[key]]: e.sis };
  s.innerHTML = ['sua', 'yona'].map(k => '<i class="k-' + k + (has[k] ? ' on' : '') + '">' + NAME[k][0] + '</i>').join('') + (e.me && e.sis ? '<i class="both">♥</i>' : '');
  return s;
}
function dexShown(all){
  return all.filter(e => (dexCat === 'all' || e.cat === dexCat) && (dexFarm === 'all' || e.farm === dexFarm));
}
function renderDex(){
  const all = dexList(), cats = $('#dexCats'), farms = $('#dexFarms'), box = $('#dex');
  cats.innerHTML = ''; farms.innerHTML = ''; box.innerHTML = '';
  DEX_CATS.forEach(([k, l]) => cats.appendChild(btn(l, dexCat === k ? 'on' : '', () => { dexCat = k; renderDex(); })));
  [['all', '모든 농장']].concat(R.FARMS.filter(f => !f.skip).map(f => [f.id, f.icon + ' ' + f.name.replace(/ 농장$/, '')])).forEach(([k, l]) => {
    const n = all.filter(e => e.farm === k || k === 'all'), done = n.length && n.every(e => e.have);
    farms.appendChild(btn(l + (done && k !== 'all' ? ' 🏅' : ''), dexFarm === k ? 'on' : '', () => { dexFarm = k; renderDex(); }));
  });
  const list = dexShown(all), got = list.filter(e => e.have).length, both = list.filter(e => e.have || e.sis).length;
  list.forEach(e => {
    const d = document.createElement('div');
    d.className = e.have ? (e.shiny ? 'gold' : '') : e.sis ? 'sis' : 'no';
    d.appendChild(dexIcon(e));
    d.appendChild(document.createTextNode(e.have || e.sis ? e.name : '???'));
    if (e.shiny){ const sp = document.createElement('span'); sp.className = 'sp'; sp.textContent = '★★★'; d.appendChild(sp); }
    if (e.cat === 'crop' && e.me && e.me.x){
      const ss = document.createElement('span'); ss.className = 'ss';
      ss.innerHTML = R.SEASONS.map((s, i) => '<i class="' + s + (e.me.x & (1 << i) ? ' on' : '') + '"></i>').join('');
      d.appendChild(ss);
    }
    d.appendChild(dexWho(e));
    // 키보드로도 연다 — 칸은 div 라 스스로는 초점을 못 받는다
    d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', (e.have || e.sis ? e.name : '아직 못 만난 칸') + ' 자세히 보기');
    d.addEventListener('click', () => openDexCard(e));
    d.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); openDexCard(e); } });
    box.appendChild(d);
  });
  // 그 농장에서만 나는 그 갈래가 없을 때(꽃구름 산물 등) — 빈 판 대신 어디서 찾을지 알려 준다
  if (!list.length) box.innerHTML = '<p class="sub dexnone">' + escapeHTML(R.eun(dexLabel())) + ' 따로 없어요. 「모든 농장」이나 🌾 들판(어느 농장에서나 나는 것)에서 찾아봐요.</p>';
  const label = dexLabel(), bar = $('#dexBar'), pct = list.length ? Math.round(got * 100 / list.length) : 0;
  bar.hidden = !list.length;
  bar.innerHTML = '<div class="pg"><i style="width:' + pct + '%"></i></div><span><b>' + got + '/' + list.length + '</b>'
    + (both > got ? ' · 둘이 합쳐 ' + both : '') + '</span>';
  if (list.length && got === list.length){
    const st = document.createElement('div'); st.className = 'stamp';
    st.innerHTML = '<b>🏅 ' + escapeHTML(label) + ' — 다 모았어요!</b>';
    st.appendChild(btn('📷 이 쪽을 작품으로', 'sm buy', () => openDexSnap(list, label)));
    bar.appendChild(st);
  }
  const mine = all.filter(e => e.have).length, gold = all.filter(e => e.shiny).length;
  $('#dexCount').textContent = mine + '/' + all.length + (gold ? ' · 반짝 ' + gold : '');
  const st = M.stats || {};
  $('#stats').innerHTML = [['거둔 작물', st.harvested], ['물 준 횟수', st.watered], ['심은 씨앗', st.planted], ['판 물건', st.sold], ['보낸 선물', st.gifted], ['만든 요리', st.cooked], ['모은 재료', st.gathered], ['낚은 물고기', st.fished], ['잡은 반딧불이', st.caught], ['온 날', (M.playDays || []).length + '일']].map(x => '<div>' + x[0] + '<b>' + (x[1] || 0) + '</b></div>').join('');
  renderMedals();
  $('#logs').innerHTML = (W.log || []).slice(0, 12).map(l => '<li><b>' + formatDate(l.t) + '</b> ' + escapeHTML(l.text).replace(/&lt;b&gt;|&lt;\/b&gt;/g, '') + '</li>').join('') || '<li>아직 일지가 없어요</li>';
  $('#diaryBtn').onclick = () => { diaryAt = 0; openDiary(); };
}
function dexLabel(){
  const c = DEX_CATS.find(x => x[0] === dexCat), f = R.FARMS.find(x => x.id === dexFarm);
  return [f ? f.name : '', dexCat === 'all' ? (f ? '' : '모든 도감') : c[1].replace(/^\S+ /, '')].filter(Boolean).join(' ');
}
function openDexCard(e){
  const known = e.have || e.sis, inner = $('#modalInner'), u = e.cat === 'guest' ? '번' : e.cat === 'fish' ? '마리' : '개';
  const rows = [];
  if (e.shared) (e.info || [['', '아직 못 만났어요']]).forEach(r => rows.push(r));
  else ['sua', 'yona'].forEach(k => {
    const r = k === key ? e.me : e.sis;
    rows.push([NAME[k], !r ? '아직' : (r.d ? r.d + ' · ' + farmName(r.f) + '에서 처음' : '예전에 만났어요') + (r.n ? ' · ' + r.n + u : '') + (e.cat === 'fish' && r.x ? ' · 가장 큰 것 ' + r.x + 'cm' : '')]);
  });
  if (e.cat === 'crop' && e.id.slice(0, 5) === 'crop:'){
    const s = (e.me && e.me.x) || 0, all4 = s === 15;
    rows.push(['내 계절', R.SEASONS.map((x, i) => '<span class="' + (s & (1 << i) ? '' : 'off') + '">' + SEASON_DOT[x] + '</span>').join(' ') + (all4 ? ' ★ 네 계절 다 거뒀어요!' : '')]);
    if (e.shiny) rows.push(['반짝', '★★★ 반짝 ' + escapeHTML(e.name) + '도 거뒀어요']);
  }
  if (!e.farm0 && e.cat !== 'animal') rows.push(['어디서', '어느 농장에서나']);
  else if (e.farm0) rows.push(['어디서', farmName(e.farm)]);
  inner.innerHTML = '<h3 class="pixel">' + (known ? escapeHTML(e.name) : '???') + '</h3>'
    + '<div class="dexbig' + (known ? '' : ' no') + '" id="dexBig"></div>'
    + '<p class="sub">' + escapeHTML(dexHint(e)) + '</p>'
    + '<dl class="dexrows">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + (r[0] === '내 계절' || r[0] === '반짝' ? r[1] : escapeHTML(r[1])) + '</dd>').join('') + '</dl>'
    + '<div class="modal-actions" id="dexAct"></div>';
  $('#dexBig').appendChild(dexIcon(e));
  const act = $('#dexAct');
  if (e.cat === 'animal' && (W.animals || []).some(a => a.mom && a.kind === e.id.slice(7))) act.appendChild(btn('🌳 가계도 보기', 'dot-btn small', () => {
    closeModal(); openTab('duo'); const t = $('#treeBox'); if (t && !t.hidden) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  act.appendChild(btn('닫기', 'dot-btn small', closeModal));
  $('#modal').hidden = false;
}
// 다 모은 쪽 한 장 — 오늘의 농장 한 장(sendSnap)처럼 작품으로 낸다
function dexSnap(list, label){
  const COLS = Math.min(8, list.length), CW = 80, CH = 92, PAD = 12, BAR = 46;
  // 몇 칸 안 되는 쪽도 제목과 날짜가 안 겹치게 폭을 640 이상으로 두고 칸은 가운데로
  const o = document.createElement('canvas'); o.width = Math.max(640, PAD * 2 + COLS * CW); o.height = PAD * 2 + BAR + 8 + Math.ceil(list.length / COLS) * CH;
  const X0 = (o.width - COLS * CW) / 2;
  const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#fff6e9'; g.fillRect(0, 0, o.width, o.height);
  g.fillStyle = '#3a3226'; g.font = '700 17px "Galmuri11", system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillText('📖 ' + NAME[key] + '의 도감 · ' + label, PAD + 4, PAD + BAR / 2);
  g.textAlign = 'right'; g.fillText(R.dayKey(now()), o.width - PAD - 4, PAD + BAR / 2); g.textAlign = 'left';
  g.fillRect(0, PAD + BAR - 3, o.width, 3);
  list.forEach((e, i) => {
    const x = X0 + (i % COLS) * CW, y = PAD + BAR + 8 + Math.floor(i / COLS) * CH;
    g.fillStyle = e.shiny ? '#fffbe9' : '#fff'; g.fillRect(x + 4, y, CW - 8, CH - 8);
    g.strokeStyle = e.shiny ? '#e0a72b' : '#3a3226'; g.lineWidth = 2; g.strokeRect(x + 5, y + 1, CW - 10, CH - 10);
    g.drawImage(dexIcon(e), x + (CW - 64) / 2, y + 5, 64, 64);
    g.fillStyle = '#3a3226'; g.font = '700 11px "Galmuri11", system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(e.name, x + CW / 2, y + CH - 18, CW - 14); g.textAlign = 'left';
  });
  return o;
}
function openDexSnap(list, label){
  const cv = dexSnap(list, label), inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">📖 ' + escapeHTML(label) + ' 도감</h3>'
    + '<p class="sub">다 모은 쪽이에요. 작품으로 내면 부모님이 보고 전시실에 걸어 줘요.</p>'
    + '<div class="snapwrap" id="snapWrap"></div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="snapSend">🖼 작품으로 내기</button>'
    + '<button type="button" class="dot-btn small" id="snapClose">닫기</button></div>';
  $('#snapWrap').appendChild(cv);
  $('#modal').hidden = false;
  $('#snapClose').addEventListener('click', closeModal);
  $('#snapSend').addEventListener('click', () => sendSnap(cv, $('#snapSend'), { title: '도감 · ' + label, quote: NAME[key] + '가 다 모은 ' + label + ' 도감' }));
}
// 일기장 — 큰 일만 모은 W.diary 를 달마다 넘겨 본다. 일기장이 생기기 전이면 일지(W.log)로
const DIARY_ICON = [[/이사 왔/, '🚚'], [/새끼|아기/, '🐣'], [/어른이 됐/, '🌱'], [/상을 받/, '🏆'], [/훈장/, '🏅'], [/큰 .*뽑/, '🎃'],
  [/반짝/, '✨'], [/완성/, '🏠'], [/모닥불/, '🔥'], [/낚았/, '🎣'], [/부탁/, '🧳'], [/주문/, '📋'], [/놓았어요/, '🎀'], [/보따리/, '🎁']];
const DIARY_BIG = /이사 왔|새끼|상을 받|훈장|큰 .*뽑|완성/;
function openDiary(){
  const src = Array.isArray(W.diary) ? W.diary : (W.log || []), inner = $('#modalInner');
  const months = [];
  src.forEach(l => { const m = R.dayKey(l.t).slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
  months.sort().reverse();
  if (!months.length){ inner.innerHTML = '<h3 class="pixel">📔 농장 일기장</h3><p class="sub">아직 적힌 날이 없어요</p><div class="modal-actions" id="dAct"></div>'; $('#dAct').appendChild(btn('닫기', 'dot-btn small', closeModal)); $('#modal').hidden = false; return; }
  diaryAt = Math.max(0, Math.min(months.length - 1, diaryAt));
  const m = months[diaryAt], days = {};
  src.filter(l => R.dayKey(l.t).slice(0, 7) === m).forEach(l => { const d = R.dayKey(l.t); (days[d] = days[d] || []).push(l); });
  const WD = '일월화수목금토';
  inner.innerHTML = '<h3 class="pixel">📔 농장 일기장</h3>'
    + '<div class="dnav"><span id="dOld"></span><b>' + m.slice(0, 4) + '년 ' + Number(m.slice(5)) + '월</b><span id="dNew"></span></div>'
    + '<div class="diary">' + Object.keys(days).sort().reverse().map(d => {
      const list = days[d], big = list.some(l => DIARY_BIG.test(l.text));
      const pi = list.some(l => /이사 왔/.test(l.text)) ? (W.past || []).findIndex(p => p.until === d) : -1;
      return '<div class="dday' + (big ? ' big' : '') + '"><b>' + Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8)) + '일 (' + WD[new Date(d + 'T00:00').getDay()] + ')</b><ul>'
        + list.map(l => '<li>' + ((DIARY_ICON.find(x => x[0].test(l.text)) || [0, '·'])[1]) + ' ' + escapeHTML(l.text).replace(/&lt;b&gt;|&lt;\/b&gt;/g, '') + '</li>').join('')
        + '</ul>' + (pi >= 0 ? '<button type="button" class="dot-btn small" data-past="' + pi + '">📷 ' + escapeHTML(farmName(W.past[pi].farm)) + ' 마지막 한 장</button>' : '') + '</div>';
    }).join('') + '</div><div class="modal-actions" id="dAct"></div>';
  if (diaryAt < months.length - 1) $('#dOld').appendChild(btn('◀ 지난달', 'sm', () => { diaryAt++; openDiary(); }));
  if (diaryAt > 0) $('#dNew').appendChild(btn('다음 달 ▶', 'sm', () => { diaryAt--; openDiary(); }));
  inner.querySelectorAll('[data-past]').forEach(b => b.addEventListener('click', () => openSnap(Number(b.dataset.past))));
  $('#dAct').appendChild(btn('닫기', 'dot-btn small', closeModal));
  $('#modal').hidden = false;
}
function renderMedals(){
  const box = $('#medals'); if (!box) return;
  box.innerHTML = '';
  const list = R.medalState(W, M);
  list.forEach(m => {
    const d = document.createElement('div');
    d.className = m.got ? 'got' : m.ready ? 'can' : 'no';
    d.innerHTML = '<span class="ic">' + m.icon + '</span><span><b>' + escapeHTML(m.name) + '</b><br>'
      + escapeHTML(m.got ? '받았어요' : m.desc) + '</span>';
    if (!m.got && m.ready){
      d.appendChild(btn('받기 🪙' + m.coins + (m.gift ? ' + ' + R.itemName(m.gift.id) + ' ' + m.gift.n : ''), 'sm buy', () => {
        const r = act((w, mm) => R.claimMedal(w, mm, m.id, now()));
        if (r.ok) sfx('medal');
      }));
    }
    box.appendChild(d);
  });
  $('#medalCount').textContent = list.filter(m => m.got).length + '/' + list.length;
}
function snapCanvas(label){
  /* 화면 캔버스를 그대로 뜨면 기기 배수(dpr)까지 곱해져 1638x1417·170KB 가 된다.
     도트 두 배로 줄이면 1310x1133·144KB — 저장소가 1GB 뿐이고 아이가 날마다 낼 수 있으니 그만큼이 낫다.
     줄여 그리든 새로 그리든 무게는 같지만(둘 다 144KB), 새로 그리면 도트가 정확히 두 배라
     기기 배수와 상관없이 같은 그림이 나온다 — 두 아이가 다른 폰으로 내도 한 장이 똑같다. */
  // 이사 간 농장은 아이소 섬이라 그림 크기가 다르다(옛 farm.js 와 짝지어졌으면 판 크기로)
  const iso = typeof isoMode === 'function' && (typeof withView === 'function' ? withView(isoMode) : isoMode());
  const W2 = (iso ? ISO_W : R.GRID.w * T) * SNAP_DOT, H2 = (iso ? ISO_H : R.GRID.h * T) * SNAP_DOT;
  const shot = document.createElement('canvas'); shot.width = W2; shot.height = H2;
  drawFarm(shot);
  const BAR = Math.round(W2 * 0.062), PAD = Math.round(W2 * 0.012);
  const o = document.createElement('canvas');
  o.width = W2 + PAD * 2; o.height = H2 + BAR + PAD * 2;
  const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#fff6e9'; g.fillRect(0, 0, o.width, o.height);
  g.drawImage(shot, PAD, BAR + PAD);
  const cal = R.calendar(W, now()), wk = R.weatherOf(R.dayKey(now()), cal.season);
  const WNAME = { sun: '맑음', cloud: '흐림', rain: '비', storm: '비바람', wind: '바람', snow: '눈' };
  g.fillStyle = '#3a3226';
  g.font = '700 ' + Math.round(BAR * 0.46) + 'px "Galmuri11", system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(label || ((W.farm && R.farmOf ? '수아연아 농장 ' + R.farmNo(W.farm) + '호점 · ' + R.farmOf(W).name : '수아연아 농장') + ' · ' + R.dayKey(now())), PAD + 4, PAD + BAR * 0.5);
  const right = R.SEASON_ICON[cal.season] + ' ' + R.SEASON_NAME[cal.season] + ' ' + cal.year + '년째 · '
    + (WNAME[wk] || wk) + ' · Lv ' + R.levelOf(M.xp);
  g.textAlign = 'right';
  g.fillText(right, o.width - PAD - 4, PAD + BAR * 0.5);
  g.textAlign = 'left';
  g.fillStyle = '#3a3226'; g.fillRect(0, BAR + PAD - 3, o.width, 3);
  // 배수(S)와 겹이 한 장 뜨는 사이 바뀌었다 — 화면 것을 제 배수로 되돌려 놓는다
  dropLayers(); if (liveCv) drawFarm(liveCv);
  return o;
}
// pi 를 주면 이사 가며 두고 온 그 농장의 마지막 한 장
function openSnap(pi){
  if (!W || !M){ flash('농장을 먼저 열어요', true); return; }
  const P = pi != null ? (W.past || [])[pi] : null, F = P && R.FARMS.find(f => f.id === P.farm);
  if (!F && visiting()){ flash('지금 농장으로 돌아와서 찍어요', true); return; }
  const cv = F ? pastSnap(pi, F) : snapCanvas();
  const meta = F ? { title: F.name + ' 마지막 날', quote: (P.until || R.dayKey(now())) + '까지 살던 ' + F.name } : null;
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">📷 ' + (F ? F.name + ' 마지막 한 장' : '오늘의 농장 한 장') + '</h3>'
    + '<p class="sub">' + (F ? '떠나온 ' + F.name + '의 모습이에요' : '지금 이 순간의 농장이에요') + '. 작품으로 내면 부모님이 보고 전시실에 걸어 줘요.</p>'
    + '<div class="snapwrap" id="snapWrap"></div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="snapSend">🖼 작품으로 내기</button>'
    + '<button type="button" class="dot-btn small" id="snapClose">닫기</button></div>';
  $('#snapWrap').appendChild(cv);
  $('#modal').hidden = false;
  $('#snapClose').addEventListener('click', closeModal);
  $('#snapSend').addEventListener('click', () => sendSnap(cv, $('#snapSend'), meta));
}
function pastSnap(i, F){
  const keep = visitAt; visitAt = i;
  try { return snapCanvas(F.icon + ' ' + F.name + ' 마지막 날'); } finally { visitAt = keep; if (liveCv) drawFarm(liveCv); }
}
async function sendSnap(cv, b, meta){
  b.disabled = true; b.textContent = '내는 중…';
  try {
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('그림을 만들지 못했어요');
    /* 저장소 정책이 이름으로 막는다 — 가족이 올릴 수 있는 자리는 suayona/doodle/ 뿐이다.
       suayona/farm/ 으로 올리려다 아이 계정에서 통째로 막혔다. 앞머리만 붙여 구별한다. */
    const path = 'suayona/doodle/farm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.png';
    const up = await sb.storage.from('event-images').upload(path, blob, { contentType: 'image/png', upsert: false });
    if (up.error) throw up.error;
    const { data: pub } = sb.storage.from('event-images').getPublicUrl(path);
    const { data: { user } } = await sb.auth.getUser();
    const cal = R.calendar(W, now());
    const { error } = await sb.from('works').insert({
      title: meta ? meta.title : '오늘의 농장 · ' + R.SEASON_NAME[cal.season] + ' ' + cal.year + '년째',
      quote: meta ? meta.quote : R.dayKey(now()) + '의 수아연아 농장',
      author: key,
      media_type: 'image',
      media_url: pub.publicUrl,
      made_on: todayISO(),
      status: 'pending',
      written_by: user.id,
    });
    if (error) throw error;
    b.textContent = '냈어요!';
    flash((meta ? meta.title + '을' : '오늘의 농장을') + ' 작품으로 냈어요. 부모님이 보고 전시실에 걸어 줘요');
    setTimeout(closeModal, 900);
  } catch (e) {
    b.disabled = false; b.textContent = '🖼 작품으로 내기';
    flash('내지 못했어요: ' + readableError(e), true);
  }
}
function openPrize(F){
  const fk = R.festivalKey(W, now()), fs = W.festival[fk] || { by: {} };
  const byS = (fs.by || {}).sua || 0, byY = (fs.by || {}).yona || 0;
  $('#modalInner').innerHTML = '<div class="prize"><div class="cup">🏆</div>'
    + '<h3 class="pixel">' + F.icon + ' ' + escapeHTML(F.name) + ' 상!</h3>'
    + '<p class="who"><b>' + NAME.sua + '</b> ' + byS + ' &nbsp;·&nbsp; <b>' + NAME.yona + '</b> ' + byY + '<br>'
    + '둘이 모아 <b>' + (byS + byY) + '</b>만큼 채웠어요</p>'
    + '<p class="sub">상은 둘의 우편함으로 갔어요 — 동전 300, 별열매 씨앗, 축제 트로피.</p></div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="prizeClose">고마워요</button></div>';
  $('#modal').hidden = false;
  $('#prizeClose').addEventListener('click', closeModal);
}
// ---------- 배선 ----------
/* 하루가 바뀌었으면 아침을 연다. daily() 는 부팅 때 한 번만 돌기 때문에, 창을 켜 둔 채
   자정을 넘기거나 폰에서 앱을 다시 열어 화면만 되살아나면 기운도 아침 소식도 안 왔다.
   실제로 연아의 저장 줄이 그랬다 — energyDay 는 어제인데 그날치 물주기는 오늘 것으로 쌓였다. */
function rollIfNewDay(){
  if (!W || !M) return;
  const today = R.dayKey(now());
  if (today === dayOpen) return;
  dayOpen = today;
  const r = daily(W, M);
  if (r.ok){ pending.push(daily); dirty = true; persist(); }
  tickAll();
  renderAll();
}
function wireUI(){
  // 창을 덮거나 신호가 돌아오면 곧바로 올린다 (놀이 코드를 받은 뒤에만 걸린다)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ if (saveTimer || dirty){ clearTimeout(saveTimer); commit(); } return; }
    rollIfNewDay();                       // 다시 볼 때 — 밤새 덮어 뒀다 아침에 여는 길
  });
  window.addEventListener('pageshow', e => {            // 폰에서 되살아난 쪽(bfcache)은 부팅이 안 돈다
    if (e.persisted) resync().then(rollIfNewDay, rollIfNewDay); else rollIfNewDay();
  });
  // 말풍선 글꼴을 미리 받아 둔다 — 안 그러면 첫 말풍선만 다른 글꼴로 나온다
  if (document.fonts && document.fonts.load) document.fonts.load("bold 12px 'Suayona Dot'").catch(() => {});
  window.addEventListener('online', () => { if (pending.length){ clearTimeout(saveTimer); commit(); } });
  const fcv = $('#farmCanvas');
  fcv.addEventListener('pointerdown', onFarmDown);
  fcv.addEventListener('pointermove', onFarmMove);
  fcv.addEventListener('pointerup', onFarmUp);
  fcv.addEventListener('pointercancel', () => { sweep = null; });
  fcv.addEventListener('click', onFarmTap);
  const hc = $('#houseCanvas');
  hc.addEventListener('click', onHouseTap);
  hc.addEventListener('pointerdown', onHouseDown);
  hc.addEventListener('pointermove', onHouseMove);
  hc.addEventListener('pointerup', onHouseUp);
  hc.addEventListener('pointercancel', () => { grab = null; });
  // 창 크기가 바뀌면 도트 배수가 달라질 수 있다 — 겹을 버리고 다시 그린다
  let fitT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(fitT);
    fitT = setTimeout(() => { dropLayers(); houseSig = ''; if (liveCv) drawFarm(liveCv); if (tab === 'house') drawRoom($('#houseCanvas'), room); }, 160);
  });
  document.querySelectorAll('#tabs button[data-tab]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
  $('#placeBtn').addEventListener('click', togglePlace);
  $('#snapBtn').addEventListener('click', openSnap);
  $('#placeReset').addEventListener('click', () => { if (!confirm('배치를 처음으로 되돌릴까요?')) return; act(w => R.resetLayout(w)); placePick = null; dropLayers(); });
  $('#mailBtn').addEventListener('click', openMail);
  $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
