// farm.html 의 놀이 화면 코드 — 가게·가방·집 조작·도감·저장.
// pages/farm.js 가 로그인한 사람에게만 받아 온다(loadPlay). 손님은 이 파일을 안 받는다.
// 최상위 let/const 는 farm.js 것을 그대로 쓴다 — 고전 스크립트라 전역 렉시컬 환경이 하나다.

function persist(){ clearTimeout(saveTimer); saveTimer = setTimeout(commit, 600); }
async function commit(){
  if (!key || saving) return;
  saving = true; dirty = false;
  try {
    for (let tries = 0; tries < 3; tries++){
      const { data, error } = await sb.rpc('farm_commit', { p_world: W, p_rev: REV, p_mine: M });
      if (error){
        // 인터넷이 끊긴 것이면 행동은 그대로 두고 조금 뒤에 다시 올린다. 돌아오면 저절로.
        const off = !navigator.onLine || error.offline || /fetch|network|load failed/i.test(error.message || '');
        flash(off ? '지금은 인터넷에 닿지 않아요. 한 일은 기억해 두었다가 연결되면 올려요' : '저장하지 못했어요: ' + readableError(error), true);
        if (off){ clearTimeout(saveTimer); saveTimer = setTimeout(commit, 15000); }
        break;
      }
      if (data >= 0){ REV = data; Mbase = clone(M); pending = []; break; }
      // 겹쳤다 — 다시 읽고, 못 올라간 행동을 새 농장 위에서 다시.
      const fresh = await loadRows();
      if (!fresh) break;
      const redo = pending.slice(); pending = [];
      M = clone(Mbase);
      let dropped = 0;
      redo.forEach(fn => { try { const r = fn(W, M); if (r && r.ok) pending.push(fn); else dropped++; } catch (e) { dropped++; } });
      if (dropped) flash(NAME[R.OTHER[key]] + '가 먼저 움직여서 ' + dropped + '가지는 되돌렸어요', true);
      renderAll();
    }
  } finally { saving = false; if (dirty) persist(); }
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
  const fert = R.fertFromDiaries(m, facts.diaries || 0);
  if (fert) { says.push('일기 덕분에 비료 ' + fert + '개가 생겼어요'); changed = true; }
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
  $('#cSeason').textContent = R.SEASON_ICON[cal.season] + ' ' + R.SEASON_NAME[cal.season] + ' ' + cal.dayOfSeason + '/' + cal.len + '일 · ' + cal.year + '년째';
  const cw = $('#cWeather');
  const fc = R.forecast ? R.forecast(W, now()) : null;
  cw.textContent = R.WEATHER[wk].icon + ' ' + R.WEATHER[wk].name + ' · ' + when + (cal.lastDay ? ' · 축제!' : '')
    + (fc ? ' · 내일 ' + fc.icon : '');
  // 진짜 자양동 날씨를 받아 온 날은 그렇다고 알려 준다 — 창밖과 화면이 같다는 걸 알아야 재밌다
  const real = R.skyOf ? R.skyOf(R.dayKey(now())) : null;
  cw.title = (real ? '서울 자양동 오늘 날씨예요' + (fc ? ' · ' : '') : '') + (fc ? '내일은 ' + fc.name : '');
  cw.classList.toggle('night', night);
  const mx = R.maxEnergy(W, M);
  $('#enFill').style.width = Math.round(100 * M.energy / mx) + '%'; $('#enText').textContent = M.energy + '/' + mx;
  $('#coins').textContent = M.coins;
  const lv = R.levelOf(M.xp), a = R.xpForLevel(lv), b = R.xpForLevel(lv + 1);
  $('#lv').textContent = lv; $('#xpFill').style.width = Math.round(100 * (M.xp - a) / (b - a)) + '%';
  const n = (W.mail[key] || []).length; $('#mailN').hidden = !n; $('#mailN').textContent = n;
  const waiting = duoWaiting(); $('#duoN').hidden = !waiting; $('#duoN').textContent = waiting;
}
// 둘이서 탭에 「내 차례」가 몇 개인지 — 자매가 낸 건물, 잡아당길 큰 작물, 쓰다듬을 동물.
function duoWaiting(){
  let n = 0;
  Object.keys(R.BUILDINGS).forEach(b => { const s = R.buildState(W, b); if (!s.done && s[R.OTHER[key]] && !s[key]) n++; });
  Object.keys(W.plots).forEach(id => { const p = W.plots[id]; if (p.giant && p.pulls && p.pulls.indexOf(R.OTHER[key]) >= 0 && p.pulls.indexOf(key) < 0) n++; });
  (W.animals || []).forEach(a => { if (a.petDay === R.dayKey(now()) && (a.pet || []).indexOf(R.OTHER[key]) >= 0 && a.pet.indexOf(key) < 0) n++; });
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
  if (tool === 'fert') return '비료는 일기를 쓰면 하나씩 생겨요. 1.5배 빨리 자라요. 끌면 줄줄이 줘요.';
  if (tool === 'pull') return '시든 작물이나 그만 키울 작물을 뽑아요. 큰 작물은 짝도 같이 뽑혀요.';
  if (tool === 'sprk'){
    const S = (R.SPRINKLERS && R.SPRINKLERS[sprk]) || R.SPRINKLER;
    return '밭의 빈 칸을 눌러 놓아요. 아침마다 둘레 ' + S.reach + '칸에 물을 줘요. 놓은 칸을 다시 누르면 걷어요.';
  }
  return '다 자란 작물·나무·바위·동물·집·우편함·게시판·가게를 눌러요. 밭 위를 끌면 익은 것만 줄줄이 거둬요.';
}
function startFishing(){
  if (fishing) return;
  if (R.fishLeft(M, now()) <= 0){ flash('오늘은 많이 잡았어요. 내일 또 와요', true); return; }
  // 기운은 미리 본다 — 한 판 다 하고 나서 「기운이 없어요」 하면 억울하다
  if ((M.energy || 0) < R.COST.fish){ flash('기운이 없어요', true); return; }
  if (STILL){ doFish('good'); return; }
  const open = performance.now() + FISH_GRACE;
  fishing = { t0: open, openAt: open, center: 26 + Math.random() * 48, done: false };
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
  setTimeout(() => { fishing = null; doFish(g); }, 420);
}
function doFish(g){
  const r = act((w, m) => R.fish(w, m, now(), g));
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
  if (fishing || placeMode || !SWEEP_TOOLS[tool]) return;
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
  if (fishing){ if (fishOpen()) finishFishing(); return; }   // 찌가 떠 있으면 어디를 눌러도 당긴다
  const { tx, ty } = tileAt(e.clientX, e.clientY);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  if (placeMode){ onPlaceTap(tx, ty); return; }
  // 반딧불이는 무엇 위를 날든 먼저 잡힌다 — 밭 위에 있다고 놓치면 아이가 답답하다
  const fi = flyAt(tx, ty);
  if (fi >= 0){
    // 누른 그 마리를 먼저 지운다. act 가 다시 그리면서 마릿수를 맞추므로,
    // 뒤에 지우면 애먼 마리까지 사라진다. 못 잡았으면 syncFlies 가 도로 채운다.
    flies.splice(fi, 1);
    const r = act((w, m) => R.catchFirefly(w, m, now()));
    if (r.ok) sfx('firefly');
    return;
  }
  const id = plotAtTile(tx, ty);
  if (id){ onPlot(id); return; }
  // 아이·인형·동물을 누르면 한마디. 밭보다는 뒤, 건물보다는 앞 — 우리 안의 동물도 말을 한다.
  const q = pixAt(e.clientX, e.clientY), hit = actorAt(q.x, q.y);
  if (hit){ speak(hit); return; }
  const n = nodeAt(tx, ty);
  if (n){ const r = act((w, m) => R.gather(w, m, n, now())); if (r.ok) sfx(R.NODES[n].kind === 'tree' ? 'thud' : R.NODES[n].kind === 'rock' ? 'prop' : 'pop'); return; }
  if (inSpot('house', tx, ty)){ openTab('house', true); sfx('house'); return; }
  if (inSpot('mail', tx, ty)){ openMail(); return; }
  if (inSpot('board', tx, ty)){ openTab('duo', true); return; }
  if (inSpot('stall', tx, ty)){ openTab('shop', true); return; }
  if (inSpot('hive', tx, ty)){ const r = act((w, m) => R.takeHoney(w, m)); if (r.ok) sfx('sparkle'); return; }
  if (inSpot('greenhouse', tx, ty)){ if (built('greenhouse')) openGreenhouse(); else flash('온실 터예요. 둘이서 탭에서 같이 지어요'); return; }
  if (inSpot('well', tx, ty)){ flash(built('well') ? '우물이에요. 물뿌리개를 키울 수 있어요' : '우물 터예요. 둘이서 탭에서 같이 지어요'); return; }
  if (inSpot('pond', tx, ty)){ startFishing(); return; }
  if (R.peddlerHere(W, now()) && inBox({ x: R.PEDDLER.x, y: R.PEDDLER.y, w: R.PEDDLER.w + 1, h: R.PEDDLER.h }, tx, ty)){ openPeddler(); sfx('cart'); return; }
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
// ---------- 말풍선 ----------
// 누른 도트 자리에 누가 서 있나. 그림이 발끝(x, y)에서 위로 그려지므로 그 높이만큼 위를 본다.
function actorAt(x, y){
  const inBox = (cx, foot, w, h) => Math.abs(x - cx) <= w / 2 + 2 && y >= foot - h - 2 && y <= foot + 3;
  if (walkers) for (const w of walkers) if (inBox(w.x, w.y, 28, 38)) return { kind: 'kid', o: w };
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
  const cry = { chicken: '꼬꼬댁!', duck: '꽥꽥!', cow: '음매~', sheep: '매에~', pig: '꿀꿀', rabbit: '(코 씰룩씰룩)', dog: '멍멍! 산책 가자', cat: '야옹… (하품)' }[a.kind] || '…';
  const lc = name.charCodeAt(name.length - 1), jong = lc >= 0xac00 && lc <= 0xd7a3 && (lc - 0xac00) % 28 !== 0;   // 받침이 있으면 「이에요」
  const pool = [cry, cry, name + (jong ? '이에요' : '예요')];
  if (rec){
    if (rec.baby) pool.push('엄마 어디 있어?', '(아장아장)');
    if (rec.fedDay === today) pool.push('밥 먹었어요 😊', '배불러~');
    else pool.push('배고파요…', '밥 주세요!');
    if ((rec.love || 0) >= 5) pool.push(NAME[rec.by] + ' 좋아 💗');
    if (rec.ready) pool.push('선물이 있어요!');
    if (a.kind === 'dog' || a.kind === 'cat') pool.push('뭐 주워 왔어요!');
  }
  return pool;
}
function speak(hit){
  const t = performance.now();
  let text, x, y, id;
  if (hit.kind === 'kid'){ text = pick(linesForKid(hit.o.who)); x = hit.o.x; y = hit.o.y - 38; id = 'k' + hit.o.who; }
  else if (hit.kind === 'doll'){ text = pick(linesForDoll(hit.o.kind)); x = hit.o.x; y = hit.o.y - DOLLS[hit.o.kind].art.length; id = 'd' + hit.o.kind; }
  else {
    const B = BEAST[hit.o.kind] || BEAST.chicken, k = hit.rec && hit.rec.baby ? BABY_K : 1;
    text = pick(linesForBeast(hit.o, hit.rec)); x = hit.o.x; y = hit.o.y - B.art.length * k; id = 'b' + hit.o.id;
  }
  bubbleAt(id, x, y, text, t);
  sfx('pop');
}
// ---------- 배치 바꾸기 ----------
function togglePlace(){
  placeMode = !placeMode; placePick = null;
  $('#placeBtn').classList.toggle('on', placeMode);
  $('#placeBar').hidden = !placeMode;
  flash(placeMode ? '옮길 것을 눌러요. 초록 테두리는 옮길 수 있는 것, 빨강은 못 옮기는 것이에요' : '');
  dropLayers(); if (STILL) drawFarm(liveCv);
}
function onPlaceTap(tx, ty){
  if (!placePick){
    const id = R.PLACE_IDS.find(i => here(i) && inSpot(i, tx, ty));
    if (!id){ flash('옮길 것을 눌러요', true); return; }
    if (!R.PLACE[id].move){ flash(R.PLACE[id].name + '은 옮길 수 없어요', true); return; }
    placePick = id; sfx('prop');
    flash('<b>' + R.PLACE[id].name + '</b>을 들었어요. 놓을 곳을 눌러요');
    return;
  }
  const P = R.PLACE[placePick];
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
      + (p.by !== key ? ' · ' + NAME[p.by] + '가 심었어요' : ''));
    return;
  }
  if ((W.sprinklers || {})[id]){
    const S = R.sprinklerOf ? R.sprinklerOf(W.sprinklers[id]) : R.SPRINKLER;
    flash(S.name + '예요. 아침마다 둘레 ' + S.reach + '칸에 물을 줘요'); return;
  }
  flash(p && p.tilled ? '갈아 둔 땅이에요. 씨앗을 골라 심어요' : '괭이로 갈면 심을 수 있어요');
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
      withInk(INK.crop, () => drawCrop(q.x * T, q.y * T, p.crop, R.stageOf(p), p.wilted, null, 0));
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
  const who = g => g.from === 'festival' ? '축제' : g.from === 'board' ? '게시판' : NAME[g.from] || '';
  inner.innerHTML = '<h3 class="pixel">우편함</h3>' + (box.length ? box.map(g =>
    '<div class="mailrow"><b>' + (g.id === 'note' ? '💌 쪽지' : g.id === 'coins' ? '🪙 ' + g.n + ' 동전' : escapeHTML(R.itemName(g.id)) + ' ' + g.n + '개') + '</b>' +
    '<span class="from">' + who(g) + (g.note ? ' · "' + escapeHTML(g.note) + '"' : '') + '</span></div>').join('') :
    '<p class="msg">비었어요. ' + NAME[R.OTHER[key]] + '가 선물이나 쪽지를 보내면 여기로 와요.</p>') +
    '<div class="modal-actions"><button type="button" class="dot-btn small" id="mailNote">✏️ 쪽지 쓰기</button>'
    + (box.length ? '<button type="button" class="dot-btn small primary" id="mailTake">다 받기</button>' : '')
    + '<button type="button" class="dot-btn small" id="mailClose">닫기</button></div>';
  $('#modal').hidden = false;
  $('#mailClose').addEventListener('click', closeModal);
  $('#mailNote').addEventListener('click', noteDialog);
  const t = $('#mailTake'); if (t) t.addEventListener('click', () => { const r = act((w, m) => R.openMail(w, m)); if (r.ok) sfx('fanfare'); closeModal(); });
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
function openTab(t, goTo){ tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); ['bag', 'shop', 'house', 'duo', 'dex'].forEach(k => { $('#tab-' + k).hidden = k !== t; }); renderTab(); if (goTo) scrollToPanel(); }
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
function renderTab(){ if (tab === 'bag') renderBag(); else if (tab === 'shop') renderShop(); else if (tab === 'house') renderHouse(); else if (tab === 'duo') renderDuo(); else renderDex(); }
function renderAll(){ syncTop(); renderTools(); drawFarm(); renderTab(); }
// 작은 그림 — 작물은 밭 그림을, 물건은 색 네모를.
function cropIcon(c){
  // 한 칸이 32도트가 되었으니 아이콘도 32x32 에 한 도트 한 픽셀로 그린다
  const cv = document.createElement('canvas'); cv.width = T; cv.height = T;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#e6d7b5'; g.fillRect(0, 0, T, T);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  drawCrop(0, 0, c, 4, false, P);
  return cv;
}
function itemIcon(id){
  const [k, v] = id.split(':');
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
    else {
      P(3, 6, 9, 5, F.c); P(3, 7, 7, 2, shade(F.c, 26)); P(6, 9, 6, 2, shade(F.c, -26));
      P(11, 5, 3, 2, F.c); P(11, 10, 3, 2, F.c); P(12, 6, 2, 5, shade(F.c, -18));
      P(2, 7, 1, 1, '#2a2a2a'); P(5, 5, 3, 1, shade(F.c, 30));
    }
    return cv;
  }
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; const g = cv.getContext('2d');
  const col = { egg: '#fff6e9', bigegg: '#ffe9a8', milk: '#ffffff', goldmilk: '#ffd979', wool: '#f7f3ee', honey: '#f7b733', berry: '#ff5c6b', wood: '#a97b4f', stone: '#a49c92', fert: '#8a5f3a', snowball: '#eef8ff', sprinkler: '#b9924a', sprinkler2: '#c9d6e0', firefly: '#ffe66d' }[id] || (k === 'dish' ? '#ffb3a7' : k === 'f' ? R.FURNITURE[v].c : '#ddd');
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
    const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = (price ? '🪙 ' + price + '개당' : '팔지 않아요') + (food ? ' · ⚡ ' + food : ''); card.appendChild(pr);
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
function renderShop(){
  const st = $('#shoptabs'); st.innerHTML = '';
  SHOP_TABS.forEach(([k, l]) => st.appendChild(btn(l, shopTab === k ? 'on' : '', () => { shopTab = k; renderShop(); })));
  const box = $('#shop'); box.innerHTML = '';
  const cal = R.calendar(W, now()), lv = R.levelOf(M.xp);
  const buyBtn = (id, cost, ok) => btn('🪙 ' + cost, 'buy', () => { const r = act((w, m) => R.buy(w, m, id, now())); if (r.ok) sfx(r.animal ? 'fanfare' : 'pop'); if (r.animal) nameDialog(r.animal); renderShop(); }, !ok);
  if (shopTab === 'seed'){
    const gh = built('greenhouse');
    $('#shopSub').innerHTML = R.SEASON_NAME[cal.season] + ' 씨앗. 흐린 것은 <b>' + NAME[R.OTHER[key]] + '의 가게</b>에만 있어요 — 선물로 받아요. 다음 계절(' + R.SEASON_NAME[R.nextSeason(cal.season)] + ') 씨앗은 ' + (gh ? '지금도 살 수 있어요 — 온실에서 자라요.' : '구경만 해요 — 그 계절이 오면 살 수 있어요.');
    const list = R.CROP_IDS.filter(c => R.CROPS[c].seed > 0 && (R.CROPS[c].season.indexOf(cal.season) >= 0 || R.CROPS[c].season.indexOf(R.nextSeason(cal.season)) >= 0));
    list.forEach(c => {
      const C = R.CROPS[c], mineHalf = !C.half || C.half === key, lvOk = (C.lv || 1) <= lv, inSeason = C.season.indexOf(cal.season) >= 0;
      // 지금 심을 수 없는 씨앗은 사지 못한다 — 온실이 있으면 아무 때나 자라니 그때만 열린다
      const seasonOk = inSeason || C.hardy || gh;
      const card = itemCard('seed:' + c, M.inv['seed:' + c] || 0, null, (!mineHalf || !lvOk || !seasonOk ? 'locked' : '') + (W.hot === c ? ' hot' : ''));
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
    const fc = document.createElement('div'); fc.className = 'item'; fc.innerHTML = '<div class="nm">🧪 비료</div><div class="pr">1.5배 빨리. 일기를 쓰면 공짜로 하나</div>';
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
      const what = A.product ? R.itemName(A.product) + (A.every > 1 ? ' ' + A.every + '일마다' : ' 날마다')
                             : A.find.map(f => R.itemName(f)).join('·') + ' 중 하나를 날마다 물어 와요';
      const pr = document.createElement('div'); pr.className = 'pr';
      pr.textContent = what + (A.best ? ' · 마음 ' + R.LOVE_FOR_BEST + '이면 ' + R.itemName(A.best) : '') + ' · 마음 ' + R.LOVE_FOR_BABY + '이면 새끼를 봐요' + (ok ? '' : ' · ' + R.BUILDINGS[A.need].name + ' 필요');
      card.appendChild(pr);
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('animal:' + k, A.cost, ok && M.coins >= A.cost)); card.appendChild(a); box.appendChild(card);
    });
  } else if (shopTab === 'furn'){
    $('#shopSub').textContent = '사면 가방에 들어와요. 집 탭에서 놓아요. 좋은 침대는 기운을 늘려 줘요.';
    // 쉰 가지가 넘으니 싼 것부터 세운다 — 아이가 가진 돈으로 살 수 있는 것이 먼저 보인다
    const furnList = Object.keys(R.FURNITURE).filter(f => !R.FURNITURE[f].rare && R.FURNITURE[f].cost > 0);
    furnList.sort((a, b) => R.FURNITURE[a].cost - R.FURNITURE[b].cost);
    furnList.forEach(f => {
      const Fu = R.FURNITURE[f], seasonOk = !Fu.season || Fu.season === cal.season;
      const card = itemCard('f:' + f, M.inv['f:' + f] || 0, null, seasonOk ? '' : 'locked');
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
    $('#shopSub').textContent = '농장에 놓는 것. 혼자 사도 돼요 — 둘의 농장에 남아요.';
    Object.keys(R.DECOR).forEach(d => {
      const Dc = R.DECOR[d], have = W.decor && W.decor[d];
      const card = document.createElement('div'); card.className = 'item' + (have ? ' locked' : '');
      card.innerHTML = '<div class="nm">' + Dc.icon + ' ' + Dc.name + '</div><div class="pr">' + (Dc.desc || '') + (have ? ' · ' + NAME[have.by] + '가 놓았어요' : ' · 레벨 ' + Dc.lv + '부터') + '</div>';
      if (!have){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('deco:' + d, Dc.cost, M.coins >= Dc.cost && lv >= Dc.lv)); card.appendChild(a); }
      box.appendChild(card);
    });
  } else {
    $('#shopSub').textContent = '요리법을 알면 부엌에서 만들 수 있어요. 요리는 비싸게 팔리고 기운도 많이 돌려줘요.';
    Object.keys(R.DISHES).forEach(d => {
      const Dd = R.DISHES[d], know = M.recipes.indexOf(d) >= 0, lvOk = Dd.lv <= lv;
      const card = itemCard('dish:' + d, null, null, know || !lvOk ? 'locked' : '');
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = Object.keys(Dd.need).map(k => R.itemName(k) + ' ' + Dd.need[k]).join(' + ') + ' · 🪙 ' + Dd.sell + ' · ⚡ ' + Dd.food + (know ? ' · 알아요' : !lvOk ? ' · 레벨 ' + Dd.lv + '부터' : ''); card.appendChild(pr);
      if (!know && lvOk){ const a = document.createElement('div'); a.className = 'act'; a.appendChild(buyBtn('recipe:' + d, Dd.sell, M.coins >= Dd.sell)); card.appendChild(a); }
      box.appendChild(card);
    });
  }
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
  hcv.style.touchAction = arrange ? 'none' : '';   // 재배치 중엔 끌어도 화면이 안 따라 움직인다
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
      const a = document.createElement('div'); a.className = 'act'; a.appendChild(btn('만들기', 'buy', () => { const r = act((w, m) => R.cook(w, m, d, now())); if (r.ok) sfx('sparkle'); }, !ok)); card.appendChild(a); grid.appendChild(card);
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
    act2.appendChild(btn('🍚 밥', 'sm', () => act((w, m) => R.feed(w, m, a.id, now())), a.fedDay === today));
    act2.appendChild(btn('🤚 쓰다듬기', 'sm', () => { const r = act((w, m) => R.pet(w, m, a.id, now())); if (r.love) sfx('purr'); }, petted.indexOf(key) >= 0));
    if (a.ready) act2.appendChild(btn('줍기', 'sm buy', () => { act((w, m) => R.collect(w, m, a.id, now())); sfx('pop'); }));
    act2.appendChild(btn('✏️', 'sm', () => nameDialog(a)));
    d.appendChild(act2); ab.appendChild(d);
  });
  renderTree();
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
function renderDex(){
  const box = $('#dex'); box.innerHTML = '';
  const all = R.CROP_IDS.map(c => ['crop:' + c, c]).concat(R.CROP_IDS.filter(c => R.CROPS[c].giant).map(c => ['giant:' + c, 'giant:' + c]))
    .concat(['egg', 'bigegg', 'milk', 'goldmilk', 'wool', 'honey', 'firefly'].map(k => [k, k]))
    .concat(R.FISH_IDS.map(f => ['fish:' + f, 'fish:' + f])).concat(Object.keys(R.DISHES).map(d => ['dish:' + d, 'dish:' + d]));
  let got = 0, gold = 0;
  all.forEach(([id, dexKey]) => {
    const have = M.dex.indexOf(dexKey) >= 0; if (have) got++;
    // 반짝 작물은 따로 칸을 만들지 않고, 그 작물 칸에 금테와 별을 얹는다
    const shiny = id.slice(0, 5) === 'crop:' && M.dex.indexOf('gold:' + id.slice(5)) >= 0;
    if (shiny) gold++;
    const d = document.createElement('div'); d.className = have ? (shiny ? 'gold' : '') : 'no';
    d.appendChild(itemIcon(shiny ? 'gold:' + id.slice(5) : id));
    d.appendChild(document.createTextNode(have ? R.itemName(id) : '???'));
    if (shiny){ const sp = document.createElement('span'); sp.className = 'sp'; sp.textContent = '★★★'; d.appendChild(sp); }
    box.appendChild(d);
  });
  $('#dexCount').textContent = got + '/' + all.length + (gold ? ' · 반짝 ' + gold : '');
  const st = M.stats || {};
  $('#stats').innerHTML = [['거둔 작물', st.harvested], ['물 준 횟수', st.watered], ['심은 씨앗', st.planted], ['판 물건', st.sold], ['보낸 선물', st.gifted], ['만든 요리', st.cooked], ['모은 재료', st.gathered], ['낚은 물고기', st.fished], ['잡은 반딧불이', st.caught], ['온 날', (M.playDays || []).length + '일']].map(x => '<div>' + x[0] + '<b>' + (x[1] || 0) + '</b></div>').join('');
  renderMedals();
  $('#logs').innerHTML = (W.log || []).slice(0, 12).map(l => '<li><b>' + formatDate(l.t) + '</b> ' + escapeHTML(l.text).replace(/&lt;b&gt;|&lt;\/b&gt;/g, '') + '</li>').join('') || '<li>아직 일지가 없어요</li>';
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
      d.appendChild(btn('받기 🪙' + m.coins, 'sm buy', () => {
        const r = act((w, mm) => R.claimMedal(w, mm, m.id, now()));
        if (r.ok) sfx('medal');
      }));
    }
    box.appendChild(d);
  });
  $('#medalCount').textContent = list.filter(m => m.got).length + '/' + list.length;
}
function snapCanvas(){
  /* 화면 캔버스를 그대로 뜨면 기기 배수(dpr)까지 곱해져 1638x1417·170KB 가 된다.
     도트 두 배로 줄이면 1310x1133·144KB — 저장소가 1GB 뿐이고 아이가 날마다 낼 수 있으니 그만큼이 낫다.
     줄여 그리든 새로 그리든 무게는 같지만(둘 다 144KB), 새로 그리면 도트가 정확히 두 배라
     기기 배수와 상관없이 같은 그림이 나온다 — 두 아이가 다른 폰으로 내도 한 장이 똑같다. */
  const W2 = R.GRID.w * T * SNAP_DOT, H2 = R.GRID.h * T * SNAP_DOT;
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
  g.fillText('수아연아 농장 · ' + R.dayKey(now()), PAD + 4, PAD + BAR * 0.5);
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
function openSnap(){
  if (!W || !M){ flash('농장을 먼저 열어요', true); return; }
  const cv = snapCanvas();
  const inner = $('#modalInner');
  inner.innerHTML = '<h3 class="pixel">📷 오늘의 농장 한 장</h3>'
    + '<p class="sub">지금 이 순간의 농장이에요. 작품으로 내면 부모님이 보고 전시실에 걸어 줘요.</p>'
    + '<div class="snapwrap" id="snapWrap"></div>'
    + '<div class="modal-actions"><button type="button" class="dot-btn small primary" id="snapSend">🖼 작품으로 내기</button>'
    + '<button type="button" class="dot-btn small" id="snapClose">닫기</button></div>';
  $('#snapWrap').appendChild(cv);
  $('#modal').hidden = false;
  $('#snapClose').addEventListener('click', closeModal);
  $('#snapSend').addEventListener('click', () => sendSnap(cv, $('#snapSend')));
}
async function sendSnap(cv, b){
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
      title: '오늘의 농장 · ' + R.SEASON_NAME[cal.season] + ' ' + cal.year + '년째',
      quote: R.dayKey(now()) + '의 수아연아 농장',
      author: key,
      media_type: 'image',
      media_url: pub.publicUrl,
      made_on: new Date().toISOString().slice(0, 10),
      status: 'pending',
      written_by: user.id,
    });
    if (error) throw error;
    b.textContent = '냈어요!';
    flash('오늘의 농장을 작품으로 냈어요. 부모님이 보고 전시실에 걸어 줘요');
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
  window.addEventListener('pageshow', rollIfNewDay);   // 폰에서 되살아난 쪽(bfcache)은 부팅이 안 돈다
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
