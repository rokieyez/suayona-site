// quest.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('games');   // 머리글의 「게임」 자리에 있는 놀이다

// 규칙은 quest-rules.js 에 있다. 여기는 화면과 순서만.
const Q = QUEST;
const J2 = (w, a, b) => (typeof josa === 'function' ? josa(w, a, b) : a + '(' + b + ')');
const EI = e => (Q.ELEM[e] || Q.ELEM.none).icon;
// 점 표시 — 남은 횟수·이긴 횟수를 숫자 대신 칸으로 보여 준다.
function pips(on, all, cls){
  let h = '';
  for (let i = 0; i < all; i++) h += '<i' + (i < on ? ' class="on"' : '') + '></i>';
  return '<span class="pips' + (cls ? ' ' + cls : '') + '">' + h + '</span>';
}
// 스탯 한 줄이 어떤 재료로 만들어졌는지 — 색 조각 띠 하나로.
const SRC = {
  base:   { n: '기본',   c: '#d8d2c6', p: 'solid' },
  lv:     { n: '레벨',   c: '#ffd979', p: 'diag' },
  works:  { n: '작품',   c: '#ff9f68', p: 'vert' },
  weapon: { n: '무기',   c: '#b9a3d6', p: 'diag' },
  run:    { n: '달리기', c: '#8ec9ee', p: 'vert' },
  diary:  { n: '일기',   c: '#ff7f8a', p: 'vert' },
  hrt:    { n: '마음',   c: '#f7a8bf', p: 'vert' },
  armor:  { n: '갑옷',   c: '#6cc7b3', p: 'diag' },
  height: { n: '키',     c: '#6fb567', p: 'solid' },
  amu:    { n: '장신구', c: '#c9b6e8', p: 'diag' },
};
// 색만으로 나누면 색을 가려내기 어려운 눈에는 한 덩어리로 보인다 — 무늬를 함께 넣는다.
function fillOf(k){
  const S = SRC[k];
  if (S.p === 'diag') return 'repeating-linear-gradient(45deg,' + S.c + ' 0 3px,rgba(255,255,255,.55) 3px 5px)';
  if (S.p === 'vert') return 'repeating-linear-gradient(90deg,' + S.c + ' 0 3px,rgba(255,255,255,.5) 3px 4px)';
  return S.c;
}
function segRow(icon, name, val, parts, tail, up){
  const keys = Object.keys(parts).filter(k => parts[k] > 0);
  const tot = keys.reduce((a, k) => a + parts[k], 0) || 1;
  const say = keys.map(k => SRC[k].n + ' ' + parts[k]).join(' + ');
  const segs = keys.map(k =>
    '<i style="width:' + (100 * parts[k] / tot).toFixed(2) + '%;background:' + fillOf(k) + '"></i>').join('');
  return '<div class="srow"><span class="lb"><em>' + icon + '</em>' + name + ' <i>' + val + '</i>' +
    (up ? '<b class="up" title="지난번보다 ' + up + ' 올랐어요">▲' + up + '</b>' : '') + '</span>' +
    '<span class="segbar" title="' + escapeHTML(say) + '" aria-label="' + escapeHTML(say) + '">' + segs + '</span>' +
    (tail ? '<span class="tail">' + tail + '</span>' : '') + '</div>';
}
function legendFor(list){
  const seen = [], order = Object.keys(SRC);
  list.forEach(o => Object.keys(o).forEach(k => { if (o[k] > 0 && seen.indexOf(k) < 0) seen.push(k); }));
  seen.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return '<div class="legend">' + seen.map(k =>
    '<span><i style="background:' + fillOf(k) + '"></i>' + SRC[k].n + '</span>').join('') + '</div>';
}
const EN = e => (Q.ELEM[e] || Q.ELEM.none).name;

let key = null, hero = null, save = null, facts = null, st = null;
const saves = {};                       // 두 아이의 세이브 — 손님 화면과 이번 주 보스에 쓴다
let TUNE = Q.fixTune(null);             // 부모 조정판 — 같은 표의 'tuning' 줄
let combo = false;                      // 오늘 자매 둘 다 모험 중이면 참
// 되돌리기 — 그날 첫 저장 때 「오늘 시작할 때의 모습」을 서버에 한 벌 담아 둔다.
// 실수로 진 날을 아침 상태로 돌릴 수 있게 하려는 것이고, 하루에 한 벌만 남는다.
const backups = {};                    // { sua: { has, day } } — 조정판이 읽는다
let dayStart = null;                   // 오늘 열었을 때의 세이브 사본
let battle = null;
let curArea = 0;

// ---------- 저장 ----------
// 바뀔 때마다 조금 기다렸다가 한 번만 쓴다. 전투 한 턴마다 쓰면 요청이 너무 잦다.
let saveTimer = 0, saveChain = Promise.resolve(), dirty = false;
function persist(now){
  clearTimeout(saveTimer); dirty = false;
  const go = () => { saveChain = saveChain.then(() => doSave()).catch(() => {}); };
  if (now) go(); else saveTimer = setTimeout(go, 600);
}
async function doSave(){
  if (!key || !save) return;
  save.lv = st ? st.lv : save.lv;
  const row = { who: key, data: save };
  // 오늘 것이 아직 없으면 이번 저장에 딸려 보낸다. 하루에 한 번뿐이라 요청이 늘지 않는다.
  const bk = backups[key];
  if (dayStart && (!bk || bk.day !== today())) {
    row.prev = dayStart;
    row.prev_day = today();
    backups[key] = { has: true, day: today() };
  }
  const { error } = await sb.from('quest_saves').upsert(row, { onConflict: 'who' });
  if (error) {
    log('저장하지 못했어요: ' + readableError(error));
    if (row.prev) backups[key] = bk || null;      // 안 올라갔으면 다음에 다시 시도
  }
}
// 페이지를 닫을 때 남은 것을 바로 쓴다. 기다리는 저장이 있으면 그것부터.
document.addEventListener('visibilitychange', () => { if (document.hidden && (saveTimer || dirty)) persist(true); });

// ---------- 시작 ----------
async function boot(){
  try { await bootInner(); }
  catch (e) {
    // 서버에 안 닿으면(지하철·전파 없는 곳) 두 상자가 다 감춰진 빈 화면이 남았다.
    $('#gate').hidden = false;
    $('#gateWho').textContent = '지금은 서버에 닿지 않아요. 신호가 돌아오면 다시 열어 주세요.';
    initReveal();
  }
}
async function bootInner(){
  await refreshAuth();
  key = isChild && me && Q.HEROES[me.author_key] ? me.author_key : null;
  // 손님에게는 세이브 표를 안 연다 — 그 안에는 아이가 어느 날 왔는지(playDays·lastPlay
  // ·journalDay)가 들어 있다. 문 앞 카드에 필요한 요약만 주는 함수를 따로 부른다.
  // prev 는 세이브 한 벌(수아 1.3KB · 연아 2.3KB)이라 통째로 받으면 열 때마다 낭비다.
  // 있는지만 알면 되고, prev 와 prev_day 는 늘 같이 적히므로 날짜만 받는다.
  let got = isLoggedIn ? await sb.from('quest_saves').select('who, data, prev_day') : { data: null, error: null };
  // 로그인은 했지만 가족 프로필이 없는 계정이면 표가 비어 온다 — 그때도 카드는 보여야 한다.
  if (!got.error && !(got.data && got.data.length)) got = await sb.rpc('quest_cards');
  const rows = got.data, error = got.error;
  if (error) throw error;
  (rows || []).forEach(r => {
    if (r.who === 'tuning') { TUNE = Q.fixTune(r.data); return; }
    saves[r.who] = Q.fixSave(r.data);
    // 되돌릴 자리가 있는지, 있으면 언제 것인지 — 부모 조정판이 읽는다
    backups[r.who] = { has: !!r.prev_day, day: r.prev_day || null };
  });

  if (!key){
    $('#gate').hidden = false;
    if (isLoggedIn) $('#gateWho').textContent = '이 모험은 수아와 연아의 것이에요. 부모는 여기서 구경하고, 아래에서 난이도를 맞출 수 있어요.';
    renderHeroes();
    if (isAdmin) renderTune();
    initReveal();
    return;
  }
  hero = Q.HEROES[key];
  const fr = await sb.rpc('quest_facts', { p_who: key });
  facts = fr.data || {};
  save = saves[key] || Q.newSave();
  saves[key] = save;
  // 아직 손대기 전이다. 지금 모습을 떠 둔다 — 오늘 첫 저장 때 서버로 같이 올라간다.
  try { dayStart = JSON.parse(JSON.stringify(save)); } catch (e) { dayStart = null; }
  refreshStats();
  if (save.hp == null || save.hp > st.maxHp) save.hp = st.maxHp;
  // 오늘 놀았다 — 자매 콤보의 근거. 다른 한 명의 줄에서 오늘 날짜가 보이면 콤보.
  if (save.lastPlay !== today()){ save.lastPlay = today(); persist(); }
  Q.markPlayed(save, today());                       // 이번 주 발자국
  Q.dayLog(save, today());                           // 하루치 기록 상자를 오늘 것으로
  Q.growCheck(save, st, today());                    // 지난번보다 얼마나 자랐는지 — 하루 한 번만 잰다
  const other = saves[hero.other];
  combo = !!(other && other.lastPlay === today());
  /* 자매가 내놓은 금화를 여기서 받는다 — 상대 줄은 못 고치니 받는 쪽이 가져간다.
     번호를 적어 두어 두 번 받지 않는다. 받자마자 한 번 저장해 둔다(못 받은 채 닫히면 안 되니). */
  const giftGold = Q.claimGifts(save, other);
  if (giftGold){
    persist(true);
    const nm = Q.HEROES[hero.other].name;
    setTimeout(() => notice('💌 ' + nm + '가 보낸 금화 <b>' + giftGold + '</b>개를 받았어요!'), 0);
    sfx('key');
  }
  // 오래 놀지 않다가 온 날 — 돌아와 있는 원정이 있으면 맨 위에서 먼저 알린다.
  // 원정 칸까지 내려가야 알 수 있으면, 방치형을 붙인 뜻이 반은 사라진다.
  const back = Q.expoOf(save).sent.filter(e => Q.expoLeft(e, facts) <= 0).length;
  if (back) setTimeout(() => notice('🎒 원정 나갔던 친구 <b>' + back + '</b>마리가 돌아와 있어요 — 아래 <b>원정</b>에서 만나요'), 0);
  $('#game').hidden = false;
  $('#lead').textContent = hero.name + '의 모험 — 현실에서 한 일이 경험치가 돼요';
  wireRoom();                                        // 방은 한 번만 이어 둔다
  renderAll();
  initReveal();
}

function refreshStats(){
  const before = st ? st.lv : null;
  st = Q.stats(save, facts);
  if (before != null && st.lv > before){
    // 레벨이 오르면 최대 체력이 늘어난 만큼 채워 준다 — 오르자마자 반피면 기쁘지가 않다.
    save.hp = Math.min(st.maxHp, (save.hp || 0) + (st.lv - before) * 8);
    sfx('fanfare');
    // 이 레벨에서 새로 배운 기술이 있으면 그것부터 알려 준다.
    const got = Q.HEROES[key].skills.filter(s => s.lv > before && s.lv <= st.lv);
    notice('<b>레벨 ' + st.lv + '</b>' + J2(st.lv, '이', '가') + ' 됐어요! 힘 ' + st.str + ' · 재빠름 ' + st.agi + ' · 마음 ' + st.hrt +
      (got.length ? ' — 새 기술 <b>' + got.map(s => EI(s.elem) + ' ' + s.name).join(', ') + '</b>' : ''));
  }
}

function renderAll(){ renderStatus(); renderReal(); renderToday(); renderMap(); renderExpo(); renderShop(); renderWeek(); renderDex(); renderMission(); renderRoom(); }
function today(){ const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

// ---------- 손님 화면 ----------
function renderHeroes(){
  const box = $('#heroes'); box.innerHTML = '';
  Object.keys(Q.HEROES).forEach(k => {
    const h = Q.HEROES[k], s = saves[k];
    const card = document.createElement('div');
    card.className = 'dot-card hero-card';
    const cv = document.createElement('canvas'); cv.width = 42; cv.height = 40;
    cv.getContext('2d').imageSmoothingEnabled = false;
    drawSprite(cv.getContext('2d'), SPRITES[h.sprite], 0, 0, 1);
    card.appendChild(cv);
    const d = document.createElement('div');
    const wins = s ? s.wins.reduce((a, b) => a + b, 0) : 0;
    const bosses = s ? s.boss.filter(Boolean).length : 0;
    const t = s ? Q.titleOf(s, { lv: s.lv || 1 }) : null;
    d.innerHTML = '<div class="nm">' + h.name + (t ? ' <span class="badge">' + t.name + '</span>' : '') + '</div>' +
      '<div class="lv">' + (s ? '레벨 ' + (s.lv || 1) + ' · ' + wins + '번 이김 · 대장 ' + bosses + '명 · 친구 ' + (s.friends || []).length : '아직 모험을 시작하지 않았어요') + '</div>';
    card.appendChild(d);
    box.appendChild(card);
  });
}

// ---------- 부모 조정판 ----------
function renderTune(){
  const c = $('#tuneCard'); c.hidden = false;
  const w = $('#tWeek'), f = $('#tFoe'), g = $('#tGift'), ch = $('#tCheer'), ex = $('#tExpo');
  w.value = TUNE.weekHpMul; f.value = TUNE.foeMul; g.value = TUNE.giftGold; ch.value = TUNE.cheer; ex.value = TUNE.expoNote;
  const show = () => {
    $('#tWeekV').textContent = '×' + Number(w.value).toFixed(1) + ' (' + Q.WEEK.hp(Q.weekKey(), { weekHpMul: Number(w.value) }) + ')';
    $('#tFoeV').textContent = '×' + Number(f.value).toFixed(1);
    $('#tGiftV').textContent = g.value + '금화';
  };
  // 막대를 옮기는 동안 아이 화면이 어떻게 되는지 옆에서 같이 움직인다.
  const prev = () => {
    const T = { weekHpMul: Number(w.value), foeMul: Number(f.value), giftGold: Number(g.value) };
    const wk = Q.WEEK.hp(Q.weekKey(), T), wkMax = Q.WEEK.hp(Q.weekKey(), { weekHpMul: 2 });
    const f0 = Q.foeAt(0, 0, T), f0Max = Q.foeAt(0, 0, { foeMul: 1.4 });
    const b0 = Q.bossAt(0, T), b0Max = Q.bossAt(0, { foeMul: 1.4 });
    const bar = (v, max, c) =>
      '<div class="b"><i style="width:' + Math.min(100, Math.round(100 * v / (max || 1))) + '%;background:' + c + '"></i></div>';
    $('#tunePrev').innerHTML =
      '<h4>이렇게 돼요 — 막대가 꽉 차면 가장 센 설정</h4><div class="g">' +
      '<span>🐉 이번 주 보스</span>' + bar(wk, wkMax, '#b9a3d6') + '<span class="n">체력 ' + wk + '</span>' +
      '<span>🌿 첫 무대 상대</span>' + bar(f0.hp, f0Max.hp, 'var(--grass)') + '<span class="n">체력 ' + f0.hp + ' · 공격 ' + f0.atk + '</span>' +
      '<span>👑 첫 무대 대장</span>' + bar(b0.hp, b0Max.hp, 'var(--coral)') + '<span class="n">체력 ' + b0.hp + ' · 공격 ' + b0.atk + '</span>' +
      '<span>🎁 오늘의 선물</span>' + bar(Number(g.value), 100, 'var(--lemon)') + '<span class="n">금화 ' + g.value + '</span>' +
      '</div>';
  };
  [w, f, g].forEach(el => el.addEventListener('input', () => { show(); prev(); }));
  show(); prev();
  renderUndo();
  $('#tSave').addEventListener('click', async () => {
    const t = Q.fixTune({ weekHpMul: w.value, foeMul: f.value, giftGold: g.value, cheer: ch.value, expoNote: ex.value });
    $('#tMsg').textContent = '저장 중…';
    const { error } = await sb.from('quest_saves').upsert({ who: 'tuning', data: t }, { onConflict: 'who' });
    $('#tMsg').textContent = error ? '안 됐어요: ' + readableError(error) : '저장했어요. 아이가 다음에 열 때부터예요.';
    if (!error){ TUNE = t; sfx('pop'); }
  });
}

// 오늘 실수로 진 날을 아침으로 돌린다. 아이 줄은 부모가 직접 못 고치게 막혀 있어서,
// 되돌리기만 열어 둔 함수(quest_restore)를 부른다.
function renderUndo(){
  const box = $('#tUndo');
  if (!box) return;
  const kids = Object.keys(Q.HEROES).filter(k => saves[k]);
  if (!kids.length) { box.innerHTML = ''; return; }

  box.innerHTML = '<h4>↩️ 그날 아침으로 되돌리기</h4>' +
    '<p>그날 처음 열었을 때의 모습으로 한 번 돌립니다. 그 뒤에 얻은 것도 같이 사라져요.</p>' +
    kids.map(k => {
      const bk = backups[k];
      const ok = bk && bk.has;
      return '<div class="u-row"><b>' + escapeHTML(Q.HEROES[k].name) + '</b>' +
        '<button type="button" class="dot-btn small" data-undo="' + k + '"' +
        (ok ? '' : ' disabled') + '>되돌리기</button>' +
        '<span class="u-when">' + (ok
          ? escapeHTML(formatDate(bk.day)) + ' 아침 것이 있어요'
          : '되돌릴 것이 아직 없어요') + '</span></div>';
    }).join('') +
    '<span class="msg" id="uMsg"></span>';

  box.querySelectorAll('[data-undo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const k = btn.dataset.undo;
      if (!confirm(Q.HEROES[k].name + '의 모험을 그날 아침으로 되돌릴까요? 그 뒤에 얻은 것은 사라져요.')) return;
      btn.disabled = true;
      const msg = $('#uMsg'); msg.textContent = '되돌리는 중…';
      const { data, error } = await sb.rpc('quest_restore', { target: k });
      if (error) { btn.disabled = false; msg.textContent = '안 됐어요: ' + readableError(error); return; }
      msg.textContent = data
        ? '되돌렸어요. 아이가 다시 열면 그날 아침 상태예요.'
        : '되돌릴 것이 없었어요.';
      sfx('pop');
    });
  });
}

// ---------- 상태창 ----------
// ---------- 오늘의 미션 ----------
// 날이 바뀌면 진행을 0으로. 미션 자체는 날짜가 정하니 저장할 필요가 없다 — 진행만 적는다.
function missionNow(){
  const day = today();
  if (save.mission.day !== day) save.mission = { day, n: 0, claimed: false };
  const open = Q.AREAS.filter((a, i) => !a.hidden && Q.areaOpen(save, i, facts)).length;
  return Q.dailyMission(day, open);
}
function missionTick(id, area){
  const m = missionNow();
  if (m.id !== id || save.mission.claimed) return;
  if (id === 'win' && area !== m.area) return;
  if (save.mission.n >= m.need) return;
  save.mission.n++;
  dirty = true;
  if (save.mission.n >= m.need){ sfx('key'); notice('📌 <b>오늘의 미션</b>을 다 했어요! 보상은 「오늘 · 이번 주」 칸에서 받아요.'); }
  if (!battle) renderMission();
}
function renderMission(){
  const box = $('#mission'); if (!box) return;
  const m = missionNow(), n = Math.min(save.mission.n, m.need), done = n >= m.need;
  box.className = 'mission' + (done ? ' done' : '');
  box.innerHTML =
    '<b>📌 오늘의 미션 — ' + escapeHTML(m.say) + '</b>' +
    (save.mission.claimed
      ? '오늘 몫은 받았어요. 내일 새 미션이 와요.'
      : done ? '' : pips(n, m.need) + ' <i>💰' + Q.MISSION.reward.gold + '</i> <i>⭐' + Q.MISSION.reward.xp + '</i>');
  if (done && !save.mission.claimed){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dot-btn small primary';
    b.textContent = '🎁 보상 받기 💰' + Q.MISSION.reward.gold + ' ⭐' + Q.MISSION.reward.xp;
    b.addEventListener('click', () => {
      save.mission.claimed = true; save.gold += Q.MISSION.reward.gold; save.xp += Q.MISSION.reward.xp;
      sfx('fanfare'); refreshStats(); renderAll(); persist(true);
    });
    box.appendChild(b);
  }
}

function renderStatus(){
  const face = $('#heroFace').getContext('2d');
  face.imageSmoothingEnabled = false;
  face.clearRect(0, 0, 42, 40);
  drawSprite(face, SPRITES[hero.sprite], 0, 0, 1);
  $('#heroName').textContent = hero.name + '의 모험단';
  const grL = (save.grew && save.grew.day === today()) ? (save.grew.lv || 0) : 0;
  $('#heroLv').textContent = '레벨 ' + st.lv + (grL ? ' ▲' + grL : '') + ' · ⭐ ' + st.xp + ' / ' + st.next;
  const t = Q.titleOf(save, st), tb = $('#titleNow');
  tb.hidden = !t; if (t) tb.textContent = '🏅 ' + t.name;
  const sk = save.streak || 0, skb = $('#streakNow');
  skb.hidden = sk < 2; if (sk >= 2) skb.textContent = '🔥 ' + sk + '연승';
  const span = st.next - st.prev;
  $('#xpFill').style.width = Math.round(100 * (st.xp - st.prev) / span) + '%';
  const p = st.parts;
  const gr = (save.grew && save.grew.day === today()) ? save.grew : {};
  $('#stat').innerHTML =
    segRow('❤️', '체력', save.hp + ' / ' + st.maxHp, p.hp, '', gr.maxHp) +
    segRow('💪', '힘', st.str, p.str, '', gr.str) +
    segRow('⚡', '재빠름', st.agi, p.agi, '💨 피하기 ' + Math.round(st.dodge * 100) + '%', gr.agi) +
    segRow('💗', '마음', st.hrt, p.hrt, '🛡 방어하면 +' + st.guardHeal, gr.hrt) +
    legendFor([p.hp, p.str, p.agi, p.hrt]);
  // 가방 — 그림과 숫자만. 이름은 눌러 보면(툴팁) 나온다.
  $('#bag').innerHTML = [
    ['💰', save.gold, '금화'], ['🧪', save.potions, '물약'], ['🎨', paintLeft(), '물감'],
    ['🗡', '+' + save.weapon, '무기'], ['🛡', '+' + save.armor, '갑옷'], ['🎁', (save.chests || 0), '상자'],
  ].concat(Q.amuletOf(save) ? [[Q.amuletOf(save).icon, '', Q.amuletOf(save).name + ' — ' + Q.amuletOf(save).say]] : [])
   .map(b => '<span title="' + b[2] + '" aria-label="' + b[2] + ' ' + b[1] + '"><em>' + b[0] + '</em>' + b[1] + '</span>').join('');
  // 배운 기술과 아직 못 배운 기술 — 레벨이 오를 이유가 눈에 보여야 한다.
  // 기술 — 이름 옆 작은 칸이 드는 기운이다. 잠긴 기술은 열쇠와 레벨만.
  const skChip = (ic, nm, cost, cls, tip) =>
    '<span class="sk' + (cls ? ' ' + cls : '') + '" title="' + escapeHTML(tip) + '"><em>' + ic + '</em>' + nm +
    (cost ? pips(cost, cost, 'sm') : '') + '</span>';
  $('#skillList').innerHTML = Q.HEROES[key].skills.map(s =>
    st.lv >= s.lv
      ? skChip(EI(s.elem), s.name, s.cost, '', s.name + ' · 기운 ' + s.cost + '칸')
      : skChip('🔒', s.name, 0, 'off', s.name + ' · 레벨 ' + s.lv + '에 배워요') + ''
  ).join('') +
  (combo ? skChip('💞', Q.DUO.name, Q.DUO.cost, 'duo', Q.DUO.name + ' · 오늘만 · 기운 ' + Q.DUO.cost + '칸')
         : skChip('💞', Q.DUO.name, 0, 'off duo', hero.call + '도 오늘 모험하면 쓸 수 있어요'));
  // 친구들 — 작게 줄지어 선다. 전투 중 나서서 때리거나 돌봐 준다.
  const fr = Q.friendsOf(save), fbox = $('#friends'); fbox.innerHTML = '';
  if (fr.length){
    const lab = document.createElement('span'); lab.style.cssText = 'font-size:12px;font-weight:800;margin-right:4px;';
    // 원정 나간 아이는 전투에 안 나선다 — 확률도 곁에 있는 수로 센다.
    const here = fr.filter(f => Q.expoAway(save).indexOf(f.key) < 0).length;
    const pc = Math.round(Q.FRIEND.chance(here) * 100);
    lab.textContent = '🐾 ' + here + (here < fr.length ? '/' + fr.length : '') + ' · ' + pc + '%';
    lab.title = here < fr.length
      ? '곁에 있는 친구 ' + here + '마리 (원정 ' + (fr.length - here) + '마리) — 전투에서 ' + pc + '% 확률로 도와줘요'
      : '친구 ' + fr.length + '마리 — 전투에서 ' + pc + '% 확률로 도와줘요';
    fbox.appendChild(lab);
    fr.forEach(f => {
      const sp = SPRITES[f.sp]; if (!sp) return;
      const cv = document.createElement('canvas'); cv.width = sp[0].length * 2; cv.height = sp.length * 2;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      const away = Q.expoAway(save).indexOf(f.key) >= 0;
      cv.title = f.name + (away ? ' — 원정 중이에요' : ' — 눌러 보세요');
      if (away) cv.style.opacity = '.35';
      cv.addEventListener('click', () => showFriend(f));
      drawSprite(g, sp, 0, 0, 2); fbox.appendChild(cv);
    });
  }
  const fs = $('#friendSay');
  if (fs) fs.innerHTML = fr.length ? '동물을 누르면 언제 어디서 친구가 됐는지 나와요.' : '';
  const cb = $('#combo');
  cb.hidden = !combo;
  if (combo) cb.textContent = '💞 오늘 ' + hero.call + '도 모험 중 — 피해 ×' + Q.COMBO_MULT;
}
function paintLeft(){ return Math.max(0, (facts.works || 0) - (save.spentPaint || 0)); }

// 현실 → 모험 팝업 — 늘 펴 두면 화면이 붐빈다. 눌렀을 때만 연다.
(function(){
  const m = $('#realModal'), openBtn = $('#realOpen'), closeBtn = $('#realClose');
  if (!m || !openBtn || !closeBtn) return;
  const open = () => { if (st) renderReal(); m.hidden = false; sfx('pop'); closeBtn.focus(); };
  const close = () => { m.hidden = true; openBtn.focus(); };
  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  m.addEventListener('click', e => { if (e.target === m) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) close(); });
})();

// 친구 소개 — 언제 어디서 친구가 됐는지. 도감과 달리 '우리 사이의 기록'이다.
function showFriend(f){
  const A = Q.AREAS[f.area], d = save.friendDay ? save.friendDay[f.key] : '';
  const wins = (save.foeWins && save.foeWins[f.key]) || Q.TAME_WINS;
  const when = d ? Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8, 10)) + '일' : '오래전';
  $('#friendSay').innerHTML = '🐾 <b>' + escapeHTML(f.name) + '</b> · ' + EI(A.elem) + ' ' + A.name +
    ' · ' + when + '에 친구가 됐어요 (' + wins + '번 만나고서)';
  sfx('purr');
}

// ---------- ① 오늘의 모험 · ⑨ 이번 주 발자국 ----------
function renderToday(){
  const box = $('#todayBox'); if (!box) return;
  const dl = Q.dayLog(save, today());
  box.innerHTML = '';
  if (!dl.wins && !dl.foes.length){
    box.innerHTML = '<span class="none">아직 오늘 모험 전이에요. 아래에서 무대를 골라 봐요.</span>';
  } else {
    dl.foes.slice(0, 12).forEach(k => {
      const bits = k.split(':'), A = Q.AREAS[+bits[0]];
      if (!A) return;
      const d = bits[1] === 'boss' ? A.boss : A.foes[+bits[1]];
      if (!d || !SPRITES[d.sp]) return;
      box.appendChild(tinyCell(SPRITES[d.sp], true, d.name + (bits[1] === 'boss' ? ' (대장)' : '')));
    });
    const chips = document.createElement('div'); chips.className = 'chips';
    chips.innerHTML = '<i title="오늘 이긴 횟수">⚔ ' + dl.wins + '</i>' +
      (dl.boss ? '<i title="오늘 쓰러뜨린 대장">👑 ' + dl.boss + '</i>' : '') +
      '<i title="오늘 번 금화">💰+' + dl.gold + '</i><i title="오늘 얻은 경험치">⭐+' + dl.xp + '</i>';
    box.appendChild(chips);
  }
  const foot = $('#weekFoot'); if (!foot) return;
  const names = ['월', '화', '수', '목', '금', '토', '일'], days = Q.weekDays(), td = today();
  foot.innerHTML = days.map((d, i) => {
    const played = (save.playDays || []).indexOf(d) >= 0;
    const cls = [played ? 'on' : '', d === td ? 'now' : '', d > td ? 'later' : ''].filter(Boolean).join(' ');
    return '<span class="' + cls + '" title="' + d + (played ? ' · 모험한 날' : '') + '">' +
      '<b>' + (played ? '🐾' : '·') + '</b>' + names[i] + '</span>';
  }).join('');
}

function renderReal(){
  const f = facts, p = st.parts;
  const left = Q.hiddenDaysLeft(f);
  const g = (t, dim) => '<i' + (dim ? ' class="dim"' : '') + '>' + t + '</i>';
  const sfxName = f.sfx ? ((typeof WORK_SFX !== 'undefined' && WORK_SFX[f.sfx]) ? WORK_SFX[f.sfx].label : f.sfx) : '';
  // 그림 하나 · 지금까지 한 수 · 그래서 늘어난 것. 문장은 툴팁으로 내렸다.
  const rows = [
    ['📓', '일기', (f.diaries || 0) + '편', [g('💗+' + p.hrt.diary), g('⭐+' + (f.diaries || 0) * Q.REAL.diary.xp)]],
    ['🎨', '작품', (f.works || 0) + '점', [g('💪+' + p.str.works), g('🎨+' + (f.works || 0)), g('⭐+' + (f.works || 0) * Q.REAL.work.xp)]],
    ['🏃', '달리기 최고 점수', (f.run_best || 0) + '점', [g('⚡+' + p.agi.run), g('⭐+' + Math.min(Q.REAL.runCap, Math.floor((f.run_best || 0) / Q.REAL.runDiv)))]],
    ['🚗', '나들이', (f.outings || 0) + '번', [g('⭐+' + (f.outings || 0) * Q.REAL.outing.xp)]],
    ['📏', '키', f.height ? f.height + 'cm' : '—', [g('❤️+' + p.hp.height)].concat(
      left ? [g('🌳 ' + left + '일')] : [g('🌳', true)])],
    ['🎵', '작품 소리', sfxName ? '「' + sfxName + '」' : '—', [g(sfxName ? '💥 연속 강타' : '작품에 소리 붙이기', !sfxName)]],
  ];
  $('#real').innerHTML = rows.map(r =>
    '<li title="' + escapeHTML(r[1]) + '"><em class="ic">' + r[0] + '</em><span class="n">' + r[2] + '</span>' +
    '<span class="gain">' + r[3].join('') + '</span></li>').join('');
}

// ---------- 지도 ----------
// 세계 지도 — 무대마다 하늘·땅 색만 얼른 그려서 조그맣게 늘어놓는다.
// 도감을 다 채운 무대만 환하다 — 지금까지 쌓은 걸 한눈에 보여 주는 자리라,
// 배틀 배경처럼 다 움직일 필요는 없다.
function renderWorldMap(){
  const box = $('#worldMap'); if (!box) return;
  box.innerHTML = '';
  Q.AREAS.forEach((A, i) => {
    const open = Q.areaOpen(save, i, facts);
    if (A.hidden && !open) return;
    const lit = Q.dexDone(save, i);
    const b = document.createElement('button');
    b.type = 'button'; b.disabled = !open; b.className = i === curArea ? 'here' : '';
    b.title = A.name + (open ? (lit ? ' · 도감 완성' : '') : ' · 잠김');
    const cv = document.createElement('canvas'); cv.width = 44; cv.height = 30;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const skyH = 24, n = A.sky.length;
    for (let si = 0; si < n; si++){
      const y0 = Math.round(si * skyH / n), y1 = Math.round((si + 1) * skyH / n);
      g.fillStyle = A.sky[si]; g.fillRect(0, y0, 44, y1 - y0);
    }
    g.fillStyle = A.ground; g.fillRect(0, skyH, 44, 30 - skyH);
    if (!open) { g.fillStyle = 'rgba(30,26,20,.6)'; g.fillRect(0, 0, 44, 30); }
    else if (!lit) { g.fillStyle = 'rgba(30,26,20,.28)'; g.fillRect(0, 0, 44, 30); }
    // 자매 둘의 진행을 한 칸에 겹친다 — 왼쪽 아래가 수아, 오른쪽 아래가 연아.
    ['sua', 'yona'].forEach((who, n) => {
      const sv = saves[who], x = n === 0 ? 2 : 35, done = !!(sv && sv.boss && sv.boss[i]);
      g.fillStyle = '#2f2a24'; g.fillRect(x, 21, 7, 7);
      g.fillStyle = done ? Q.HEROES[who].color : '#fffaf2'; g.fillRect(x + 1, 22, 5, 5);
    });
    b.appendChild(cv);
    b.addEventListener('click', () => { curArea = i; renderMap(); });
    box.appendChild(b);
  });
  const mk = $('#mapKey');
  if (mk) mk.innerHTML = ['sua', 'yona'].map(w =>
    '<span><i style="background:' + Q.HEROES[w].color + '"></i>' + Q.HEROES[w].name + ' 대장 이김</span>').join('') +
    '<span><i style="background:#fffaf2"></i>아직</span>';
}

function renderMap(){
  renderWorldMap();
  const box = $('#areas'); box.innerHTML = '';
  Q.AREAS.forEach((A, i) => {
    const open = Q.areaOpen(save, i, facts);
    if (A.hidden && !open) return;                   // 숨은 무대는 열렸을 때만 보인다
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = !open;
    b.className = (save.boss[i] ? 'done' : '') + (i === curArea ? ' here' : '') + (A.hidden ? ' secret' : '');
    // 몇 번 이겼는지 — 숫자 대신 칸. 다 차면 대장을 부를 수 있다.
    b.title = A.name + (open ? (save.boss[i] ? ' · 대장을 이겼어요' : ' · ' + save.wins[i] + '번 이김') : ' · 아직 잠겨 있어요');
    b.innerHTML = EI(A.elem) + ' ' + A.name + (Q.dexDone(save, i) ? ' 📖' : '') +
      '<small>' + (open
        ? (save.boss[i] ? '👑' : pips(Math.min(save.wins[i], Q.WINS_FOR_BOSS), Q.WINS_FOR_BOSS))
        : '🔒') + '</small>';
    b.addEventListener('click', () => { curArea = i; renderMap(); });
    box.appendChild(b);
  });
  if (!Q.areaOpen(save, curArea, facts)) curArea = 0;
  const A = Q.AREAS[curArea], act = $('#areaAct');
  const need = Math.max(0, Q.WINS_FOR_BOSS - save.wins[curArea]);
  const friendsHere = [0, 1, 2].filter(j => save.friends.includes(curArea + ':' + j)).length;
  const found = !!save.finds[curArea];
  const triedToday = save.findTries[curArea] === today();
  act.innerHTML =
    '<button type="button" class="dot-btn small primary" id="goFight">' + A.name + '에서 싸우기</button>' +
    '<button type="button" class="dot-btn small coral" id="goBoss"' + (need ? ' disabled' : '') + '>' +
      '대장 ' + A.boss.name + (save.boss[curArea] ? ' (다시)' : '') + '</button>' +
    (A.find ? '<button type="button" class="dot-btn small" id="goFind"' + (found || triedToday ? ' disabled' : '') + '>' +
      (found ? '🔍 ' + A.find.name + ' 찾음' : '🔍 살펴보기') + '</button>' : '') +
    '<span class="note" title="' + EN(A.elem) + ' 무대 · ' +
      (need ? '대장을 부르려면 ' + need + '번 더 이겨야 해요' : '대장에게 도전할 수 있어요') +
      (friendsHere ? ' · 친구가 된 상대는 안 나와요' : '') + '">' +
      EI(A.elem) + ' ' + pips(Math.min(save.wins[curArea], Q.WINS_FOR_BOSS), Q.WINS_FOR_BOSS) +
      ' <span style="opacity:' + (need ? '.45' : '1') + '">👑</span>' +
      (A.hidden ? ' · 🌳 ×2' : '') +
      (friendsHere ? ' · 🐾' + friendsHere : '') +
      (A.find && !found && triedToday ? ' · 🔍 내일 또' : '') +
    '</span>';
  $('#goFight').addEventListener('click', () => {
    if (Math.random() < Q.MERCHANT.chance){ openMerchant(); return; }
    // 친구가 된 상대는 빼고 고른다. 셋 다 친구가 될 수는 없다(무대마다 하나만 tame).
    const pool = [0, 1, 2].filter(j => !save.friends.includes(curArea + ':' + j));
    startBattle(Q.foeAt(curArea, pool[Math.floor(Math.random() * pool.length)], TUNE));
  });
  $('#goBoss').addEventListener('click', () => startBattle(Q.bossAt(curArea, TUNE)));
  const findBtn = $('#goFind');
  if (findBtn) findBtn.addEventListener('click', () => {
    save.findTries[curArea] = today();
    missionTick('find');
    const got = Q.tryFind();
    sfx(got ? 'sparkle' : 'prop');
    if (got){ save.finds[curArea] = true; notice('🔍 <b>' + A.find.name + '</b>' + J2(A.find.name, '을', '를') + ' 찾았어요!'); }
    else notice('이번엔 못 찾았어요. 내일 또 살펴봐요.');
    renderMap(); renderDex(); persist(true);
  });
}

// ---------- 방랑 상인 ----------
// 무대 화면 자리를 그대로 빌려 쓴다 — 따로 창을 띄우면 「지금 뭘 보고 있는지」가
// 헷갈린다. 거래를 하든 지나치든 지도로 돌아간다.
function openMerchant(){
  const deal = Q.merchantDeal();
  const act = $('#areaAct');
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 34;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  drawSprite(g, SPRITES.fox, 1, 2, 2);
  const box = document.createElement('div'); box.className = 'merchant';
  const head = document.createElement('div'); head.className = 'merchant-say';
  head.appendChild(cv);
  const say = document.createElement('span');
  say.innerHTML = '<b>방랑 상인</b>「' + escapeHTML(deal.say) + '」';
  head.appendChild(say);
  box.appendChild(head);

  const DO = {
    buyPotion:  { can: save.gold >= deal.cost, label: '💰 ' + deal.cost + '금화 → 🧪 물약 ' + deal.potions + '개',
      run(){ save.gold -= deal.cost; save.potions = Math.min(Q.SHOP.potion.max, save.potions + deal.potions); return '물약을 받았어요.'; } },
    sellPotion: { can: save.potions >= deal.potions, label: '🧪 물약 ' + deal.potions + '개 → 💰 금화 ' + deal.gold,
      run(){ save.potions -= deal.potions; save.gold += deal.gold; return '금화를 받았어요.'; } },
    giftGold:   { can: true, label: '🎁 금화 ' + deal.gold + ' 받기',
      run(){ save.gold += deal.gold; return '금화를 받았어요!'; } },
    giftXp:     { can: true, label: '🎁 경험치 ' + deal.xp + ' 받기',
      run(){ save.xp += deal.xp; return '경험치를 받았어요!'; } },
  }[deal.kind];

  const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'dot-btn small primary';
  b1.textContent = DO.label; b1.disabled = !DO.can;
  b1.addEventListener('click', () => {
    const msg = DO.run();
    sfx('key'); refreshStats(); renderStatus();
    act.querySelector('.note').textContent = msg;
    b1.disabled = true; b2.disabled = true;
    persist(true);
  });
  const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'dot-btn small';
  b2.textContent = '괜찮아요';
  b2.addEventListener('click', () => renderMap());

  const row = document.createElement('div'); row.className = 'merchant-row'; row.appendChild(b1); row.appendChild(b2);
  box.appendChild(row);
  const note = document.createElement('span'); note.className = 'note'; note.textContent = '거래를 마치면 지도로 돌아가요.';
  box.appendChild(note);

  act.innerHTML = ''; act.appendChild(box);
}

// ---------- 도감 · 칭호 ----------
function tinyCell(sp, met, name){
  const s = sp.length > 14 ? 1 : 2;
  const cv = document.createElement('canvas');
  cv.width = sp[0].length * s; cv.height = sp.length * s;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  if (met) drawSprite(g, sp, 0, 0, s);
  else silhOn(g, sp, 0, 0, s, '#d8d2c6');           // 아직 못 만난 것은 그림자만
  cv.title = met ? name : '아직 못 만났어요';
  return cv;
}
function renderDex(){
  const box = $('#dexBox'); box.innerHTML = '';
  const c = Q.dexCount(save);
  $('#dexCount').textContent = c.seen + ' / ' + c.all;
  Q.AREAS.forEach((A, i) => {
    if (A.hidden && !Q.areaOpen(save, i, facts) && !Q.dexDone(save, i)) return;
    const row = document.createElement('div');
    row.className = 'row' + (Q.dexDone(save, i) ? ' full' : '');
    const seen = [0, 1, 2].filter(j => save.met[i + ':' + j]).length + (save.met[i + ':boss'] ? 1 : 0);
    row.innerHTML = '<div class="nm"><span>' + EI(A.elem) + ' ' + A.name + '</span><em>' + seen + '/4</em></div>';
    const cells = document.createElement('div'); cells.className = 'cells';
    A.foes.forEach((f, j) => { const sp = SPRITES[f.sp]; if (sp) cells.appendChild(tinyCell(sp, !!save.met[i + ':' + j], f.name)); });
    const bs = SPRITES[A.boss.sp]; if (bs) cells.appendChild(tinyCell(bs, !!save.met[i + ':boss'], A.boss.name + ' (대장)'));
    row.appendChild(cells);
    box.appendChild(row);
  });
  // 채집 — 무대마다 하나, 도감 칸과 같은 그림 상자를 재활용한다.
  const findBox = $('#findBox'); findBox.innerHTML = '';
  Q.AREAS.forEach((A, i) => {
    if (!A.find) return;
    if (A.hidden && !Q.areaOpen(save, i, facts) && !save.finds[i]) return;
    const sp = SPRITES[A.find.sp]; if (!sp) return;
    findBox.appendChild(tinyCell(sp, !!save.finds[i], A.find.name));
  });
  $('#findCount').textContent = Q.findsCount(save) + ' / ' + Q.AREAS.length;

  const ids = Q.titlesOf(save, st).map(t => t.id);
  $('#titleBox').innerHTML = Q.TITLES.map(t =>
    '<span class="' + (ids.includes(t.id) ? 'on' : '') + '">' + (ids.includes(t.id) ? '🏅 ' : '🔒 ') + t.name + '</span>').join('');
}

// ---------- 가게 ----------
// ---------- 원정 ----------
// 직접 놀지 않는 시간에도 세계가 돌아가는 자리. 친구를 무대로 내보내고, 돌아오면 거둔다.
// 화면은 셋으로 나뉜다 — 나가 있는 것 · 새로 보내는 자리 · 지난 일지.
let expoTimer = 0;
function fmtLeft(ms){
  if (ms <= 0) return '돌아왔어요';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return m + '분 남음';
  return Math.floor(m / 60) + '시간 ' + (m % 60) + '분 남음';
}
function otherSave(){ return hero ? saves[hero.other] : null; }
// 원정 하나의 칸. 남은 시간만 자주 바뀌므로 그 부분만 따로 갱신한다.
function paintTrip(el, e){
  const left = Q.expoLeft(e, facts, Date.now());
  const sp2 = Q.expoSpeed(e, facts);
  const all = e.hours * 3600000 - sp2.mins * 60000;
  const el2 = el.querySelector('.sub'), bar = el.querySelector('.bar i'), btn = el.querySelector('button');
  el.classList.toggle('back', left <= 0);
  bar.style.width = Math.round(Math.max(0, Math.min(1, 1 - left / Math.max(1, all))) * 100) + '%';
  el2.innerHTML = escapeHTML(Q.AREAS[e.area].name) + ' · ' + Q.expoPlan(e.hours).name + '<br>' +
    (left <= 0 ? '<b>돌아왔어요</b>' : fmtLeft(left)) +
    (sp2.mins ? ' · <b>' + sp2.mins + '분</b> 앞당겨졌어요 (' + escapeHTML(sp2.why.join(', ')) + (sp2.capped ? ' — 여기까지' : '') + ')' : '');
  btn.hidden = left > 0;
}
function renderExpo(){
  const card = $('#expoCard'); if (!card || !save) return;
  const E = Q.expoOf(save), fr = Q.friendsOf(save), slots = Q.expoSlots(save);
  $('#expoSlot').textContent = fr.length ? '자리 ' + E.sent.length + '/' + slots + ' · 다녀온 원정 ' + (E.done || 0) + '번' : '';
  $('#expoLead').innerHTML = fr.length
    ? '친구를 무대로 내보내면 <b>혼자서 다녀와요</b>. 나가 있는 동안엔 전투를 안 도와줘요.<br>놔둬도 잃는 건 없고, 그 사이에 일기를 쓰거나 달리기를 하면 <b>더 빨리 돌아와요</b>.'
    : '상대를 세 번 이기면 친구가 돼요. <b>친구가 한 명이라도 생기면</b> 원정을 보낼 수 있어요.';

  // 나가 있는 것
  const out = $('#expoOut'); out.innerHTML = '';
  E.sent.forEach((e, i) => {
    const f = fr.filter(x => x.key === e.who)[0];
    const el = document.createElement('div'); el.className = 'trip';
    const sp = f && SPRITES[f.sp];
    if (sp){
      const cv = document.createElement('canvas'); cv.width = sp[0].length * 2; cv.height = sp.length * 2;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      drawSprite(g, sp, 0, 0, 2); el.appendChild(cv);
    }
    const body = document.createElement('div'); body.className = 'body';
    body.innerHTML = '<div class="nm">' + escapeHTML(f ? f.name : '친구') + '</div><div class="sub"></div><div class="bar"><i></i></div>';
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = '데리러 가기';
    btn.addEventListener('click', () => claimExpo(e));
    body.appendChild(btn);
    el.appendChild(body); out.appendChild(el);
    paintTrip(el, e);
  });

  // 새로 보내기
  const box = $('#expoSend');
  const free = fr.filter(f => Q.expoAway(save).indexOf(f.key) < 0);
  box.hidden = !fr.length || E.sent.length >= slots || !free.length || !!battle;
  // 보내는 칸이 그냥 사라지면 왜 없어졌는지 알 길이 없다 — 까닭을 한 줄로 남긴다.
  const why = $('#expoWhy');
  const reason = !fr.length ? '' : battle ? '싸우는 중에는 못 보내요'
    : (E.sent.length >= slots || !free.length) ? '지금은 친구들이 다 나가 있어요 — 한 명이 돌아오면 또 보낼 수 있어요' : '';
  why.hidden = !reason;
  why.textContent = reason;
  if (!box.hidden){
    const asel = $('#expoArea'), wsel = $('#expoWho');
    const keepA = asel.value, keepW = wsel.value;
    asel.innerHTML = ''; wsel.innerHTML = '';
    Q.AREAS.forEach((A, i) => {
      if (!Q.areaOpen(save, i, facts)) return;
      const o = document.createElement('option'); o.value = String(i); o.textContent = A.name; asel.appendChild(o);
    });
    free.forEach(f => { const o = document.createElement('option'); o.value = f.key; o.textContent = f.name; wsel.appendChild(o); });
    if (keepA && asel.querySelector('option[value="' + keepA + '"]')) asel.value = keepA;
    if (keepW && wsel.querySelector('option[value="' + keepW + '"]')) wsel.value = keepW;
    asel.onchange = renderExpoPlans;
    renderExpoPlans();
  }

  // 엄마 아빠 쪽지 — 조정판에 적어 두면 여기에 붙는다
  const note = $('#expoNote');
  note.hidden = !(TUNE && TUNE.expoNote);
  if (!note.hidden) note.innerHTML = '📮 ' + escapeHTML(TUNE.expoNote);

  // 일지
  const lg = $('#expoLog'); lg.innerHTML = '';
  $('#expoLogH').hidden = !E.log.length;
  E.log.forEach(x => {
    const f = Q.AREAS[x.area], nm = friendName(x.who);
    const el = document.createElement('div'); el.className = 'e' + (x.empty ? ' empty' : '');
    el.innerHTML = '<b>' + escapeHTML(nm) + '</b> — ' + escapeHTML(f ? f.name : '') + (x.duo ? ' 🤝' : '') + '<br>' +
      escapeHTML(x.say) + (x.empty ? '' : ' <em>💰' + x.gold + ' · ✨' + x.xp + (x.seed ? ' · 🌱씨앗' : '') + '</em>');
    lg.appendChild(el);
  });

  clearInterval(expoTimer);
  // 남은 시간은 「분」으로만 보여 주므로 1초마다 깨울 까닭이 없다. 열어 둔 채 두는 화면이라
  // 초마다 깨우면 그냥 배터리를 쓴다. 10초면 「돌아왔어요」도 늦지 않게 뜬다.
  if (E.sent.length) expoTimer = setInterval(expoTick, 10000);
}
function friendName(k){
  const [a, j] = String(k).split(':').map(Number);
  return (Q.AREAS[a] && Q.AREAS[a].foes[j]) ? Q.AREAS[a].foes[j].name : '친구';
}
function expoTick(){
  const out = $('#expoOut'); if (!out) return;
  const E = Q.expoOf(save);
  [].forEach.call(out.children, (el, i) => { if (E.sent[i]) paintTrip(el, E.sent[i]); });
}
function renderExpoPlans(){
  const wrap = $('#expoPlans'); wrap.innerHTML = '';
  const area = Number($('#expoArea').value || 0);
  const oth = otherSave();
  // 언니(동생)가 오늘 같은 곳으로 이미 보냈으면 합동이 된다 — 보내기 전에 알려 준다.
  const duoHint = !!(oth && oth.expo && [].concat(oth.expo.sent || [], oth.expo.log || [])
    .some(x => x && x.area === area && Q.dayKey(x.at) === today()));
  Q.EXPO.PLANS.forEach(P => {
    const r = Q.expoReward(area, P.h, TUNE, duoHint);
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = P.name + '<small>' + P.h + '시간 · 💰' + r.gold + ' · ✨' + r.xp + (duoHint ? ' · 🤝합동' : '') + '</small>';
    b.addEventListener('click', () => sendExpo(area, $('#expoWho').value, P.h));
    wrap.appendChild(b);
  });
  if (duoHint){
    const t = document.createElement('span');
    t.style.cssText = 'font-size:11.5px;font-weight:800;align-self:center;';
    t.textContent = '🤝 ' + hero.call + '도 오늘 여기로 보냈어요 — 합동 원정!';
    wrap.appendChild(t);
  }
}
function sendExpo(area, who, hours){
  if (!who) return;
  const E = Q.expoOf(save);
  if (E.sent.length >= Q.expoSlots(save)) return;
  if (Q.expoAway(save).indexOf(who) >= 0) return;
  Q.expoSend(save, area, who, hours, facts);
  sfx('key');
  notice('<b>' + escapeHTML(friendName(who)) + '</b>' + J2(friendName(who), '이', '가') + ' ' +
    escapeHTML(Q.AREAS[area].name) + '으로 떠났어요 — ' + hours + '시간 뒤에 만나요');
  renderExpo(); renderStatus(); persist(true);
}
function claimExpo(e){
  const E = Q.expoOf(save), i = E.sent.indexOf(e);
  if (i < 0) return;
  const r = Q.expoClaim(save, i, facts, TUNE, otherSave());
  if (!r) return;
  sfx(r.empty ? 'thud' : 'fanfare');
  const nm = escapeHTML(friendName(r.who));
  notice(r.empty
    ? '<b>' + nm + '</b>' + J2(friendName(r.who), '이', '가') + ' 빈손으로 돌아왔어요 — ' + escapeHTML(r.say)
    : '<b>' + nm + '</b> ' + escapeHTML(r.say) + (r.duo ? ' 🤝<b>합동 원정</b>' : '') +
      ' — 💰' + r.gold + ' · ✨' + r.xp + (r.seed ? ' · 🌱 <b>농장에 심을 씨앗</b>도 주워 왔어요' : ''));
  refreshStats();
  renderExpo(); renderStatus(); renderDex(); persist(true);
}

function renderShop(){
  const S = Q.SHOP, box = $('#shop');
  const gift = S.gift.gold(TUNE);
  const items = [
    { id: 'potion', t: '🧪 물약 사기', d: '💰' + S.potion.price + ' · ❤️ +' + Math.round(S.potion.heal * 100) + '%',
      can: save.gold >= S.potion.price && save.potions < S.potion.max,
      do(){ save.gold -= S.potion.price; save.potions++; return '물약을 샀어요.'; } },
    { id: 'inn', t: '🛏 여관에서 쉬기', d: '💰' + S.inn.price + ' · ❤️ 가득',
      can: save.gold >= S.inn.price && save.hp < st.maxHp,
      do(){ save.gold -= S.inn.price; save.hp = st.maxHp; return '푹 쉬었어요. 체력이 가득 찼어요.'; } },
    { id: 'weapon', t: '🗡 무기 강화 +' + (save.weapon + 1), d: upgradeLabel(save.weapon),
      can: canUpgrade(save.weapon),
      do(){ const w = save.weapon; save.gold -= S.upgrade.gold(w); save.spentPaint += S.upgrade.paint(w); save.weapon++; return '무기가 +' + save.weapon + J2(save.weapon, '이', '가') + ' 됐어요. 힘이 올라요.'; } },
    { id: 'armor', t: '🛡 갑옷 강화 +' + (save.armor + 1), d: upgradeLabel(save.armor),
      can: canUpgrade(save.armor),
      do(){ const w = save.armor; save.gold -= S.upgrade.gold(w); save.spentPaint += S.upgrade.paint(w); save.armor++; return '갑옷이 +' + save.armor + J2(save.armor, '이', '가') + ' 됐어요. 체력이 늘어요.'; } },
    { id: 'gift', t: '🎁 오늘의 선물', d: save.lastGift === today() ? '오늘 건 받았어요. 내일 또!' : '하루 한 번 · 💰' + gift + ' · 🧪' + S.gift.potions + ' · ❤️ 가득',
      can: save.lastGift !== today(),
      do(){ save.lastGift = today(); save.gold += gift; save.potions = Math.min(S.potion.max, save.potions + S.gift.potions); save.hp = st.maxHp; return '선물을 받았어요!'; } },
    { id: 'seedbag', t: '🌱 농장 씨앗 주머니', d: '💰' + S.seedbag.price + ' · 농장 가방에 제철 씨앗 하나'
        + ((save.bought && save.bought.seedbag) ? ' (지금까지 ' + save.bought.seedbag + '개)' : ''),
      can: save.gold >= S.seedbag.price,
      do(){ save.gold -= S.seedbag.price;
            save.expo.seedsEver = (save.expo.seedsEver || 0) + 1;
            save.bought.seedbag = (save.bought.seedbag || 0) + 1;
            return '씨앗을 샀어요. 다음에 농장을 열면 가방에 들어와 있어요.'; } },
    { id: 'gear', t: '🎨 장비에 그림 넣기', d: (save.weapon || save.armor) ? '그리기에서 그린 도트를 무기·갑옷에 붙여요' : '무기나 갑옷을 먼저 강화해요',
      can: !!(save.weapon || save.armor),
      do(){ openGearPick(); return ''; } },
  ];
  box.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button'; b.disabled = !it.can || !!battle;
    b.innerHTML = it.t + '<small>' + it.d + '</small>';
    b.addEventListener('click', () => {
      const say = it.do();
      if (it.id === 'gear') return;
      sfx(it.id === 'gift' ? 'key' : 'pop');
      refreshStats(); if (save.hp > st.maxHp) save.hp = st.maxHp;
      $('#shopMsg').textContent = say;
      renderStatus(); renderShop(); renderDex(); persist();
    });
    box.appendChild(b);
  });
  renderGearNow();
  renderAmulets();
  renderSend();
}

/* ---------- 장신구 ----------
   금화로만 사는 칸. 한 번 사면 팔지 않고, 찰 수 있는 건 하나뿐이라 누르면 바꿔 찬다. */
function renderAmulets(){
  const box = $('#amuBox'); if (!box) return;
  const now = Q.amuletOf(save);
  $('#amuNow').textContent = now ? '지금 ' + now.icon + ' ' + now.name + ' — ' + now.say
                                 : '하나만 찰 수 있어요. 산 것은 눌러서 바꿔 차요';
  box.innerHTML = '';
  Q.AMULETS.forEach(a => {
    const own = Q.hasAmulet(save, a.id), on = save.amulet === a.id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = on ? 'on' : (own ? 'own' : '');
    b.disabled = !!battle || (!own && save.gold < a.price);
    b.innerHTML = a.icon + ' ' + a.name + (on ? ' <em style="font-style:normal">· 차는 중</em>' : '') +
      '<small>' + a.say + ' · ' + (own ? (on ? '누르면 벗어요' : '누르면 차요') : '💰' + a.price) + '</small>';
    b.addEventListener('click', () => {
      let say;
      if (!own){
        save.gold -= a.price; save.amulets.push(a.id); save.amulet = a.id;
        say = a.name + J2(a.name, '을', '를') + ' 샀어요. 바로 찼어요.'; sfx('key');
      } else {
        save.amulet = on ? '' : a.id;
        say = a.name + J2(a.name, '을', '를') + (on ? ' 벗었어요.' : ' 찼어요.'); sfx('pop');
      }
      refreshStats();
      if (save.hp > st.maxHp) save.hp = st.maxHp;
      $('#shopMsg').textContent = say;
      renderStatus(); renderShop(); persist();
    });
    box.appendChild(b);
  });
}

/* ---------- 자매에게 금화 보내기 ----------
   제 줄에만 적을 수 있으니 「보낸다」가 아니라 「내놓는다」 — 상대가 제 화면을 열 때 가져간다.
   그래서 여기서는 「기다리는 중」과 「받아 갔어요」를 나눠 보여 준다. */
function renderSend(){
  const box = $('#sendBox'); if (!box) return;
  const other = otherSave(), name = Q.HEROES[hero.other].name;
  $('#sendWho').textContent = hero.call + ' ' + name + '에게 — 다음에 ' + name + '가 모험단을 열 때 받아요';
  box.innerHTML = '';
  const lb = document.createElement('span');
  lb.className = 'lb'; lb.textContent = '💰 ' + save.gold + ' 중에서';
  box.appendChild(lb);
  [100, 300, 500].forEach(n => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = n + ' 보내기';
    b.disabled = !!battle || save.gold < n;
    b.addEventListener('click', () => {
      const g = Q.sendGold(save, n, today());
      if (!g) return;
      sfx('key');
      $('#shopMsg').textContent = name + '에게 금화 ' + n + '개를 보냈어요.';
      renderStatus(); renderShop(); persist(true);
    });
    box.appendChild(b);
  });
  // 내가 내놓은 것 — 상대가 받아 갔는지는 상대 줄의 gotGifts 로 안다
  const got = (other && other.gotGifts) || [];
  const mine = (save.outbox || []).slice().reverse().slice(0, 4);
  $('#sendOut').innerHTML = mine.length
    ? mine.map(g => '💰' + g.gold + ' · ' + g.day + ' — ' + (got.indexOf(g.id) >= 0 ? '받아 갔어요 ✔' : '기다리는 중')).join('<br>')
    : '';
}
function upgradeLabel(w){
  const S = Q.SHOP.upgrade;
  if (w >= S.max) return '더는 못 올려요 (최대 +' + S.max + ')';
  return '💰' + S.gold(w) + ' · 🎨' + S.paint(w) + ' (작품을 올리면 물감이 생겨요)';
}
function canUpgrade(w){
  const S = Q.SHOP.upgrade;
  return w < S.max && save.gold >= S.gold(w) && paintLeft() >= S.paint(w);
}

// ---------- 장비에 그림 넣기 ----------
// 그리기 페이지에서 그린 자기 도트(doodles)를 무기·갑옷에 붙인다. 전투 화면에서
// 방패와 깃발로 보인다. 누르기 전엔 서버를 안 부르고, 그림은 세이브에 통째로 담는다
// (32칸이면 1KB — 세이브 상한 8KB 안).
const gearCache = {};
function gearCanvas(slot){
  const g = save.gear[slot]; if (!g || !g.s) return null;
  const k = slot + ':' + g.n + ':' + g.s.length + ':' + g.s.slice(0, 40);
  if (!gearCache[k]) gearCache[k] = drawingToCanvas({ n: g.n, s: g.s });
  return gearCache[k];
}
function renderGearNow(){
  const box = $('#gearNow'); box.innerHTML = '';
  ['weapon', 'armor'].forEach(slot => {
    const cv = gearCanvas(slot); if (!cv) return;
    const lab = document.createElement('span'); lab.textContent = slot === 'weapon' ? '🗡 깃발' : '🛡 방패';
    const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
    c2.getContext('2d').drawImage(cv, 0, 0);
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '빼기';
    x.style.cssText = 'font:inherit;font-size:10px;font-weight:800;padding:2px 6px;border:2px solid var(--ink);background:#fff;cursor:pointer;';
    x.addEventListener('click', () => { save.gear[slot] = null; renderGearNow(); persist(); });
    box.appendChild(lab); box.appendChild(c2); box.appendChild(x);
  });
}
async function openGearPick(){
  const box = $('#gearPick'); box.hidden = false;
  box.innerHTML = '<span class="msg" style="margin:0">그림을 찾는 중…</span>';
  const { data, error } = await sb.from('doodles').select('id, n, cells, created_at')
    .eq('author', key).order('created_at', { ascending: false }).limit(12);
  if (error || !data || !data.length){
    box.innerHTML = '<span class="msg" style="margin:0">' + (error ? '불러오지 못했어요' : '아직 그린 그림이 없어요. <a href="./draw.html">그리기</a>에서 하나 그려 와요.') + '</span>';
    return;
  }
  box.innerHTML = '';
  data.forEach(r => {
    const p = document.createElement('div'); p.className = 'pick';
    p.appendChild(drawingToCanvas({ n: r.n, s: r.cells }));
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '4px';
    [['weapon', '깃발'], ['armor', '방패']].forEach(([slot, lab]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
      b.disabled = !(slot === 'weapon' ? save.weapon : save.armor);
      b.addEventListener('click', () => {
        save.gear[slot] = { n: r.n, s: r.cells };
        sfx('pop'); $('#shopMsg').textContent = (slot === 'weapon' ? '깃발' : '방패') + '에 그림을 붙였어요. 전투에서 보여요.';
        renderGearNow(); persist();
      });
      row.appendChild(b);
    });
    p.appendChild(row); box.appendChild(p);
  });
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기';
  close.addEventListener('click', () => { box.hidden = true; }); box.appendChild(close);
}

// =====================================================================
//  내 방 — 중세 전사의 방
// =====================================================================
/* 방은 농장의 아이 방과 같은 눈높이로 — 비스듬히 내려다보는 아이소메트릭이다.
   칸 하나는 가로 56 · 세로 28 도트. 벽 둘이 가운데에서 만나고, 바닥은 6×4 칸.
   그림은 400×260 으로 그려 800×520 판에 두 배로 올린다. */
const RPAL = {
  k: '#241f1a', h: null, H: null,                       // h·H 는 아이 색으로 그때그때
  n: '#5a3a22', N: '#7a4f2d', W: '#8a5f3a', w: '#c79b6d', e: '#e8cda3',
  j: '#3f4653', J: '#5d6675', I: '#9aa4b2', i: '#cfd6de', d: '#f2f6fa',
  G: '#b9812c', g: '#e0a93b', y: '#ffd979', Y: '#fff0b8',
  R: '#7e2b28', r: '#b8423c', q: '#d4504a', Q: '#e8746a',
  B: '#23407a', b: '#3a63b0', v: '#5b86d6',
  c: '#f4e6c8', C: '#fff8e8', t: '#d8c49a',
  f: '#ff9d3b', F: '#ffd24a', x: '#ffeea8', o: '#e0561f',
  s: '#e8c86a', S: '#c7a44a', l: '#6fb567', L: '#4b8a46',
  p: '#8b867c', P: '#6f6a60', z: '#a8a296',
};
// 빛깔 한 칸을 밝게·어둡게 — 돌과 나무의 결을 내는 데 쓴다
function shade(hex, d){
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.max(0, Math.min(255, v + d)));
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
}
const ROOM_ART = {
  torch: [
    '........................',
    '..........xx............',
    '.........xFFx...........',
    '........xFFFFx..........',
    '........fFxxFf..........',
    '.......ofFFFFfo.........',
    '.......offFFffo.........',
    '........offffo..........',
    '.........offo...........',
    '..........ff............',
    '.........jWWj...........',
    '.........jWWj...........',
    '........jIIIIj..........',
    '.......jIddIIIj.........',
    '.......jIIIIIIj.........',
    '........jIIIIj..........',
    '.........jIIj...........',
    '..........jj............',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  shield: [
    '........................',
    '.......IIIIIIIIII.......',
    '......IdIIIIIIIIdI......',
    '.....IdhhhhhhhhhhdI.....',
    '.....Idhhhhhhhhhh.I.....',
    '.....IhhhhCChhhhhhI.....',
    '.....IhhhhCChhhhhhI.....',
    '.....IhhCCCCCChhhhI.....',
    '.....IhhCCCCCChhhhI.....',
    '.....IhhhhCChhhhhhI.....',
    '.....IhhhhCChhhhhhI.....',
    '.....IhhhhhhhhhhhhI.....',
    '.....IhhhhhhhhhhhhI.....',
    '......IhhhhhhhhhhI......',
    '......IhhhhhhhhhhI......',
    '.......IhhhhhhhhI.......',
    '........IhhhhhhI........',
    '.........IhhhhI.........',
    '..........IhhI..........',
    '...........II...........',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  banner: [
    '........................',
    '....jIIIIIIIIIIIIIIj....',
    '....jddddddddddddddj....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhyyhhhhhh.....',
    '.....hhhhhyyyyhhhhh.....',
    '.....hhhyyyYYyyyhhh.....',
    '.....hhhhyyyyyyhhhh.....',
    '.....hhhhyyyyyyhhhh.....',
    '.....hhhyyyhhyyyhhh.....',
    '.....hhyyhhhhhhyyhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '.....hhhh.hhhh.hhhh.....',
    '.....hhh...hh...hhh.....',
    '.....hh.....h.....hh....',
    '........................',
    '........................',
  ],
  swords: [
    '........................',
    '..d..................d..',
    '..Id................dI..',
    '...Id..............dI...',
    '....Id............dI....',
    '.....Id..........dI.....',
    '......Id........dI......',
    '.......Id......dI.......',
    '........Id....dI........',
    '.........Id..dI.........',
    '..........IddI..........',
    '.........GgIIgG.........',
    '........GyygggyyG.......',
    '.........GgIIgG.........',
    '..........IddI..........',
    '.........Id..dI.........',
    '........Id....dI........',
    '.......Id......dI.......',
    '......Id........dI......',
    '.....nW............Wn...',
    '.....nW............Wn...',
    '.....GG............GG...',
    '........................',
    '........................',
  ],
  medals: [
    '...........ii...........',
    '...........ii...........',
    '....nnnnnnnnnnnnnnnn....',
    '....nWWWWWWWWWWWWWWn....',
    '....nWCCCCCCCCCCCCWn....',
    '....nWCttttttttttCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCt........tCWn....',
    '....nWCttttttttttCWn....',
    '....nWCCCCCCCCCCCCWn....',
    '....nWWWWWWWWWWWWWWn....',
    '....nnnnnnnnnnnnnnnn....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  barrel: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.......WWWWWWWWWW.......',
    '......WwwwwwwwwwwW......',
    '.....WweeeeeeeeewwW.....',
    '....NwwWWWWWWWWWwwwN....',
    '....jjjjjjjjjjjjjjjj....',
    '....JIIIIIIIIIIIIIIJ....',
    '...NwWWWWWWWWWWWWWWwN...',
    '...NwWWWWWWWWWWWWWWwN...',
    '...NwWWWWWWWWWWWWWWwN...',
    '....jjjjjjjjjjjjjjjj....',
    '....JIIIIIIIIIIIIIIJ....',
    '....NwWWWWWWWWWWWWwN....',
    '....NwWWWWWWWWWWWWwN....',
    '.....NWWWWWWWWWWWWN.....',
    '.....jjjjjjjjjjjjjj.....',
    '.....JIIIIIIIIIIIIJ.....',
    '......nnnnnnnnnnnn......',
    '.......kkkkkkkkkk.......',
    '........................',
    '........................',
  ],
  books: [
    '..nnnnnnnnnnnnnnnnnnnn..',
    '..nWWWWWWWWWWWWWWWWWWn..',
    '..nWqqbbrCCyyllvvqqbWWn.',
    '..nWqqbbrCCyyllvvqqbWWn.',
    '..nWqqbbrCCyyllvvqqbWWn.',
    '..nWqqbbrCCyyllvvqqbWWn.',
    '..nnnnnnnnnnnnnnnnnnnnn.',
    '..nWbbllqqvvCCyybbrrWWn.',
    '..nWbbllqqvvCCyybbrrWWn.',
    '..nWbbllqqvvCCyybbrrWWn.',
    '..nWbbllqqvvCCyybbrrWWn.',
    '..nnnnnnnnnnnnnnnnnnnnn.',
    '..nWyyCCvvbbqqllrrbbWWn.',
    '..nWyyCCvvbbqqllrrbbWWn.',
    '..nWyyCCvvbbqqllrrbbWWn.',
    '..nWyyCCvvbbqqllrrbbWWn.',
    '..nnnnnnnnnnnnnnnnnnnnn.',
    '..nWllvvyyCCbbqqrr..WWn.',
    '..nWllvvyyCCbbqqrr..WWn.',
    '..nWllvvyyCCbbqqrr..WWn.',
    '..nWllvvyyCCbbqqrr..WWn.',
    '..nWWWWWWWWWWWWWWWWWWWn.',
    '..nnnnnnnnnnnnnnnnnnnnn.',
    '........................',
  ],
  rack: [
    '..........dd............',
    '.........dIId...........',
    '.........dIId...........',
    '..ii.....dIId......dd...',
    '.iIIi....dIId.....dIId..',
    '.iIIi....dIId....dIIIId.',
    '..II.....dIId.....dIId..',
    '..II......II.......II...',
    '..II......II.......II...',
    '..II......II.......II...',
    '..GG......GG.......GG...',
    '..WW......WW.......WW...',
    '..NN......NN.......NN...',
    '..NN......NN.......NN...',
    '..NN......NN.......NN...',
    '.NNNN....NNNN.....NNNN..',
    '..WW......WW.......WW...',
    '.wWWWWWWWWWWWWWWWWWWWw..',
    '.WWWWWWWWWWWWWWWWWWWWW..',
    '.nnnnnnnnnnnnnnnnnnnnn..',
    '..W.................W...',
    '..n.................n...',
    '........................',
    '........................',
  ],
  armor: [
    '..........qq............',
    '.........qqqq...........',
    '........qIIIIq..........',
    '.......dIIIIIId.........',
    '.......dIkkkkId.........',
    '.......dIIIIIId.........',
    '........dIIIId..........',
    '.....IIddIIIIddII.......',
    '....IdIIhhhhhhIIdI......',
    '....IdIhhhhhhhhIdI......',
    '....IdIhhhCChhhIdI......',
    '....IIIhhhCChhhIII......',
    '.....IIhhhhhhhhII.......',
    '......IIhhhhhhII........',
    '.......IIIIIIII.........',
    '........IIddII..........',
    '........II..II..........',
    '.......dI....Id.........',
    '.......II....II.........',
    '......wWWWWWWWWw........',
    '......WWWWWWWWWW........',
    '......nnnnnnnnnn........',
    '........................',
    '........................',
  ],
  hearth: [
    '..zzzzzzzzzzzzzzzzzzzz..',
    '..pppppppppppppppppppp..',
    '..PPPPPPPPPPPPPPPPPPPP..',
    '..zp................pz..',
    '..zp..kkkkkkkkkkkk..pz..',
    '..zp.kkkkkkkkkkkkkk.pz..',
    '..zp.kkkkkkkkkkkkkk.pz..',
    '..pz.kkkkkkkkkkkkkk.zp..',
    '..pz.kkkkk.xx.kkkkk.zp..',
    '..pz.kkkk.xFFx.kkkk.zp..',
    '..pz.kkk.xFFFFx.kkk.zp..',
    '..pz.kk.ofFFFFfo.kk.zp..',
    '..pz.k.oofFFFFfoo.k.zp..',
    '..pz.k.ooffFFffoo.k.zp..',
    '..pz.k.NooffffooN.k.zp..',
    '..pz.kNNWoooooWNN.k.zp..',
    '..zp.kNWWWnnnnWWWN..pz..',
    '..zp................pz..',
    '..PPPPPPPPPPPPPPPPPPPP..',
    '..pppppppppppppppppppp..',
    '..zzzzzzzzzzzzzzzzzzzz..',
    '..PPPPPPPPPPPPPPPPPPPP..',
    '........................',
    '........................',
  ],
  table: [
    '........................',
    '........................',
    '..........x.............',
    '.........xFx............',
    '.........xFx............',
    '..........f.............',
    '.........CCC............',
    '.........CCC......ll....',
    '.........CCC.....lqql...',
    '........GyyyG....qqqq...',
    '.........ttt......qq....',
    '..wwwwwwwwwwwwwwwwwwww..',
    '..eeeeeeeeeeeeeeeeeeee..',
    '..WWWWWWWWWWWWWWWWWWWW..',
    '..nnnnnnnnnnnnnnnnnnnn..',
    '...WW..............WW...',
    '...WW..............WW...',
    '...WN..............NW...',
    '...WN....WWWWWW....NW...',
    '...WN..............NW...',
    '...nn..............nn...',
    '...nn..............nn...',
    '........................',
    '........................',
  ],
  chest: [
    '........................',
    '........................',
    '........................',
    '.......GGGGGGGGGG.......',
    '.....GGwwwwwwwwwwGG.....',
    '....GweeeeeeeeeeeewG....',
    '...GwWWWWWWWWWWWWWWwG...',
    '...GwWWWWWWWWWWWWWWwG...',
    '...GGGGGGGGGGGGGGGGGG...',
    '...gyyyyyyyyyyyyyyyyg...',
    '...GwWWWWWGyyGWWWWWwG...',
    '...GwWWWWWGykGWWWWWwG...',
    '...GwWWWWWGyyGWWWWWwG...',
    '...GwWWWWWWWWWWWWWWwG...',
    '...GwWWWWWWWWWWWWWWwG...',
    '...GwWWWWWWWWWWWWWWwG...',
    '...GGGGGGGGGGGGGGGGGG...',
    '...gyyyyyyyyyyyyyyyyg...',
    '...nnnnnnnnnnnnnnnnnn...',
    '...kkkkkkkkkkkkkkkkkk...',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  bed: [
    '........................',
    '..nnnn..................',
    '..nWWn..................',
    '..nWWn..................',
    '..nWWn..................',
    '..nWWnCCC...............',
    '..nWWCCCCC..............',
    '..nWWCCCCChhhhhhhhhhhh..',
    '..nWWCCCCChhhhhhhhhhhh..',
    '..nWWsssssHHHHHHHHHHHH..',
    '..nWWsssssssssssssssss..',
    '..nWWSSSSSSSSSSSSSSSSS..',
    '..wwwwwwwwwwwwwwwwwwww..',
    '..WWWWWWWWWWWWWWWWWWWW..',
    '..nnnnnnnnnnnnnnnnnnnn..',
    '..WW................WW..',
    '..WN................NW..',
    '..nn................nn..',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  throne: [
    '..........yy............',
    '.........yYYy...........',
    '........GyyyyG..........',
    '.......GgggggggG........',
    '......nWWWWWWWWWWn......',
    '......nWqqqqqqqqWn......',
    '......nWqQQQQQQqWn......',
    '......nWqQrrrrQqWn......',
    '......nWqQrRRrQqWn......',
    '......nWqQrrrrQqWn......',
    '......nWqQQQQQQqWn......',
    '......nWqqqqqqqqWn......',
    '....nnWWqqqqqqqqWWnn....',
    '....nWWWqqqqqqqqWWWn....',
    '....nWWWqqqqqqqqWWWn....',
    '....nWWWWWWWWWWWWWWn....',
    '....nnnnWWWWWWWWnnnn....',
    '.......nWWWWWWWWn.......',
    '.......nnnnnnnnnn.......',
    '.......WW......WW.......',
    '.......WN......NW.......',
    '.......nn......nn.......',
    '........................',
    '........................',
  ],
};

/* ---- 아이소메트릭 상자 ---- 농장 아이 방과 같은 생각이다. 바닥에 놓는 가구는 납작한 그림이
   아니라 상자를 쌓아 만든다 — 윗면이 보여야 비스듬히 내려다보는 방으로 읽힌다.
   기준점 (cx, cy) 는 물건이 선 자리의 한가운데(바닥)이고, 높이 H 는 거기서 위로 센다.
   hw·hh 는 발자국 마름모의 반지름(가로·세로). */
function isoTopD(g, cx, cy, hw, hh, col){
  g.fillStyle = col;
  for (let k = -hh; k < hh; k++){
    const w = Math.round(hw * (1 - Math.abs(k + 0.5) / hh));
    if (w <= 0) continue;
    g.fillRect(Math.round(cx - w), Math.round(cy + k), w * 2, 1);
  }
}
function isoBandD(g, cx, cy, hw, hh, H, left, right, up){
  const base = cy - (up || 0);
  for (let dx = -hw; dx < hw; dx++){
    const edge = base + Math.round((hw - Math.abs(dx)) * (hh / hw));
    g.fillStyle = dx < 0 ? left : right;
    g.fillRect(Math.round(cx + dx), Math.round(edge - H), 1, H);
  }
}
function isoBoxD(g, cx, cy, hw, hh, H, top, left, right, up){
  const base = cy - (up || 0);
  for (let dx = -hw; dx < hw; dx++){
    const edge = base + Math.round((hw - Math.abs(dx)) * (hh / hw));   // 앞 두 면의 아랫선
    g.fillStyle = dx < 0 ? left : right;
    g.fillRect(Math.round(cx + dx), Math.round(edge - H), 1, H);
  }
  isoTopD(g, cx, base - H, hw, hh, top);
}
// 바닥 물건마다의 그리는 법. 납작한 도트로는 아이소메트릭이 안 나오는 것들만 여기 있다.
const ROOM_PAINT = {
  barrel(g, cx, cy, color){
    const W = RPAL.W;
    isoBoxD(g, cx, cy, 12, 6, 24, RPAL.e, shade(W, 12), shade(W, -24), 0);
    [6, 17].forEach(up => isoBandD(g, cx, cy, 12, 6, 3, RPAL.I, RPAL.J, up));   // 쇠 테 — 윗면은 없다
    isoTopD(g, cx, cy - 24, 12, 6, shade(RPAL.e, -10));
    isoTopD(g, cx, cy - 24, 7, 3, shade(RPAL.e, 10));
    g.fillStyle = RPAL.n; g.fillRect(cx - 1, cy - 25, 2, 2);
  },
  table(g, cx, cy, color){
    const W = RPAL.W, n = RPAL.n;
    [[-18, 0], [18, 0], [0, 9]].forEach(p => {                          // 다리 셋 (뒤 하나는 가려진다)
      g.fillStyle = p[0] < 0 ? shade(W, -6) : shade(W, -24);
      g.fillRect(Math.round(cx + p[0] - 2), Math.round(cy + p[1] - 20), 4, 20);
      g.fillStyle = n; g.fillRect(Math.round(cx + p[0] - 2), Math.round(cy + p[1] - 2), 4, 2);
    });
    isoBoxD(g, cx, cy, 22, 11, 4, RPAL.e, shade(W, 6), shade(W, -26), 20);
    // 촛대와 사과 한 알
    g.fillStyle = RPAL.G; g.fillRect(cx - 9, cy - 28, 5, 2);
    g.fillStyle = RPAL.g; g.fillRect(cx - 8, cy - 33, 3, 5);
    g.fillStyle = RPAL.C; g.fillRect(cx - 8, cy - 36, 3, 3);
    g.fillStyle = RPAL.F; g.fillRect(cx - 7, cy - 39, 1, 3);
    g.fillStyle = RPAL.x; g.fillRect(cx - 7, cy - 40, 1, 1);
    g.fillStyle = RPAL.q; g.fillRect(cx + 7, cy - 29, 5, 5);
    g.fillStyle = RPAL.l; g.fillRect(cx + 9, cy - 31, 2, 2);
  },
  chest(g, cx, cy, color){
    const W = RPAL.W, G = RPAL.G, g2 = RPAL.g;
    isoBoxD(g, cx, cy, 15, 8, 12, shade(W, 8), shade(W, 4), shade(W, -26), 0);
    isoBoxD(g, cx, cy, 15, 8, 6, RPAL.e, shade(W, 14), shade(W, -18), 12);
    // 금 테 — 앞 두 면을 가로지른다
    [0, 12].forEach(up => {
      for (let dx = -15; dx < 15; dx++){
        const edge = cy - up + Math.round((15 - Math.abs(dx)) * (8 / 15));
        g.fillStyle = dx < 0 ? g2 : G;
        g.fillRect(Math.round(cx + dx), Math.round(edge - 2), 1, 2);
      }
    });
    g.fillStyle = G; g.fillRect(cx - 2, cy - 13, 4, 6);
    g.fillStyle = g2; g.fillRect(cx - 1, cy - 12, 2, 4);
    g.fillStyle = RPAL.k; g.fillRect(cx, cy - 11, 1, 2);
  },
  bed(g, cx, cy, color){
    const W = RPAL.W;
    // 머리판 — 뒤쪽(왼쪽 꼭짓점)에 먼저 세운다
    isoBoxD(g, cx - 20, cy - 10, 5, 3, 20, shade(W, 12), shade(W, 8), shade(W, -22), 0);
    isoBoxD(g, cx, cy, 24, 12, 6, shade(W, 8), shade(W, 4), shade(W, -26), 0);    // 침대 틀
    isoTopD(g, cx, cy - 6, 22, 11, RPAL.s);                                        // 짚 요
    // 이불 — 발치(앞 절반)를 덮는다
    for (let k = 0; k < 11; k++){
      const w = Math.round(22 * (1 - k / 11));
      if (w <= 0) continue;
      g.fillStyle = k < 7 ? color : shade(color, -34);
      g.fillRect(Math.round(cx - w), Math.round(cy - 6 + k), w * 2, 1);
    }
    for (let k = 0; k < 5; k++){                                                   // 이불 자락 한 겹
      const w = Math.round(22 * (1 - k / 11));
      g.fillStyle = shade(color, 14);
      g.fillRect(Math.round(cx - w), Math.round(cy - 7 + k), w * 2, 1);
    }
    isoBoxD(g, cx - 13, cy - 7, 7, 4, 4, RPAL.C, RPAL.C, shade(RPAL.C, -22), 6);   // 베개
  },
  throne(g, cx, cy, color){
    const W = RPAL.W, q = RPAL.q;
    // 등받이 — 뒤에 있으므로 먼저
    isoBoxD(g, cx, cy - 5, 13, 5, 38, shade(W, 12), shade(W, 8), shade(W, -24), 0);
    for (let k = 0; k < 22; k++){                                                  // 붉은 천
      g.fillStyle = k < 18 ? q : RPAL.R;
      g.fillRect(cx - 8, cy - 40 + k, 16, 1);
    }
    g.fillStyle = RPAL.g; g.fillRect(cx - 10, cy - 46, 20, 3);                     // 금 테두리
    g.fillStyle = RPAL.y; g.fillRect(cx - 3, cy - 50, 2, 4);
    g.fillStyle = RPAL.y; g.fillRect(cx + 1, cy - 50, 2, 4);
    g.fillStyle = RPAL.Y; g.fillRect(cx - 1, cy - 51, 2, 2);
    isoBoxD(g, cx, cy, 14, 7, 13, shade(W, 8), shade(W, 4), shade(W, -26), 0);     // 앉는 자리
    isoTopD(g, cx, cy - 13, 12, 6, q);
    isoTopD(g, cx, cy - 13, 7, 3, RPAL.Q);
    [-11, 11].forEach(dx => isoBoxD(g, cx + dx, cy - 1, 4, 2, 9, shade(W, 12), shade(W, 6), shade(W, -22), 13));
  },
};

let roomPick = null;                    // 트레이에서 고른 물건 (놓을 차례)
let roomG = null;
const RW = 400, RH = 260;               // 그리는 좌표
const TW = 56, TH = 28;                 // 칸 하나
const FX = 172, FY = 116;               // 0,0 칸의 한가운데
const WALLH = 96;                       // 벽 높이
const CORNER = { x: FX, y: FY - TH / 2 };            // 두 벽이 바닥에서 만나는 점
const WTOP = CORNER.y - WALLH;                       // 벽 꼭대기(모서리 쪽)
const LWr = 6 * (TW / 2), LWl = 4 * (TW / 2);        // 오른쪽·왼쪽 벽의 가로 길이
function roomCtx(){
  if (roomG) return roomG;
  const cv = $('#roomCanvas'); if (!cv) return null;
  roomG = cv.getContext('2d');
  roomG.imageSmoothingEnabled = false;
  roomG.setTransform(2, 0, 0, 2, 0, 0);
  return roomG;
}
/* 도트 하나를 그린다. skew 가 0 이 아니면 오른쪽으로 갈수록 내려가거나(0.5) 올라간다(-0.5) —
   벽에 건 것이 벽면에 붙어 보이게 하는 기울기다. 바닥에 세우는 것은 0. */
function drawArt(g, art, x, y, s, hero, skew){
  const heroDark = shade(hero, -34);
  for (let c = 0; c < art[0].length; c++){
    const dy = skew ? Math.round(c * s * skew) : 0;
    for (let r = 0; r < art.length; r++){
      const ch = art[r][c];
      if (ch === '.') continue;
      g.fillStyle = ch === 'h' ? hero : ch === 'H' ? heroDark : RPAL[ch];
      if (!g.fillStyle) continue;
      g.fillRect(x + c * s, y + r * s + dy, s, s);
    }
  }
}
// 마름모 한 칸 — 두 줄씩 그려 도트 느낌을 지킨다
function isoTile(g, cx, cy, color, inset){
  const half = TW / 2 - (inset || 0);
  g.fillStyle = color;
  for (let k = 0; k < TH / 2; k++){
    const hw = (k < TH / 4 ? (k + 1) : (TH / 2 - k)) * 4 - (inset || 0);
    if (hw <= 0) continue;
    const hh = Math.min(hw, half);
    g.fillRect(Math.round(cx - hh), Math.round(cy - TH / 2 + k * 2), Math.round(hh * 2), 2);
  }
}
function tileXY(i, j){ return { x: FX + (i - j) * (TW / 2), y: FY + (i + j) * (TH / 2) }; }
// 벽면의 (u, v) 를 화면 좌표로. side 1 = 오른쪽 벽, 0 = 왼쪽 벽.
function wallXY(side, u, v){
  return { x: side ? CORNER.x + u : CORNER.x - u - 2, y: WTOP + v + u / 2 };
}
/* 방의 껍데기(벽·바닥·양탄자)는 한 번만 그려 두고 그 뒤로는 베껴 쓴다.
   벽 한 겹이 6천 번 넘는 칠이라, 물건을 하나 옮길 때마다 다시 칠하면 폰에서 느껴진다.
   농장의 마을·밭과 같은 방법이다. */
let roomShell = null;
function roomShellCv(color){
  if (roomShell) return roomShell;
  const c = document.createElement('canvas');
  c.width = RW * 2; c.height = RH * 2;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.fillStyle = '#1c1814'; g.fillRect(0, 0, RW, RH);
  paintShell(g, color);
  roomShell = c;
  return c;
}
function paintShell(g, color){
  // ---- 벽 둘 ----
  [1, 0].forEach(side => {
    const len = side ? LWr : LWl, dim = side ? 0 : -14;       // 왼쪽 벽은 빛을 등져 어둡다
    for (let u = 0; u < len; u += 2){
      for (let v = 0; v < WALLH; v += 2){
        const bx = Math.floor((u + (Math.floor(v / 14) % 2 ? 14 : 0)) / 28), by = Math.floor(v / 14);
        const t = Math.floor(prandRoom(side + ':' + bx + ':' + by) * 5) - 2;     // 돌마다 조금씩 다른 빛깔
        let c = shade('#7d786d', t * 6 + dim);
        if (v % 14 < 2 || (u + (by % 2 ? 14 : 0)) % 28 < 2) c = shade('#57534b', dim);   // 줄눈
        if (v < 6) c = shade('#9a9488', dim);                                    // 꼭대기 갓돌
        if (v >= WALLH - 8) c = shade('#4f4b43', dim);                           // 굽도리
        const p = wallXY(side, u, v);
        g.fillStyle = c; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    }
  });
  // 두 벽이 만나는 모서리는 빛이 덜 든다
  for (let i = 0; i < 10; i += 2){
    const a = (0.22 * (1 - i / 10)).toFixed(3);
    for (let v = 0; v < WALLH; v += 2){
      const pr = wallXY(1, i, v), pl = wallXY(0, i, v);
      g.fillStyle = 'rgba(20,14,8,' + a + ')';
      g.fillRect(Math.round(pr.x), Math.round(pr.y), 2, 2);
      g.fillRect(Math.round(pl.x), Math.round(pl.y), 2, 2);
    }
  }
  // ---- 바닥 ----
  for (let j = 0; j <= 3; j++) for (let i = 0; i <= 5; i++){
    const p = tileXY(i, j);
    isoTile(g, p.x, p.y, '#3f3b35', 0);                                  // 줄눈이 되는 바탕
    const t = Math.floor(prandRoom('f' + i + ':' + j) * 5) - 2;
    isoTile(g, p.x, p.y, shade('#8b867c', t * 7 + (j * -3)), 2);         // 안쪽일수록 조금 어둡게
  }
  // ---- 양탄자 ---- 아이 색. 방이 돌바닥뿐이면 허전하다.
  const rug = tileXY(2.5, 1.5);
  for (let k = -21; k <= 21; k++){
    const hw = Math.round((1 - Math.abs(k) / 22) * 84);
    if (hw <= 0) continue;
    const edge = Math.abs(k) > 17;
    g.fillStyle = edge ? shade(color, -60) : shade(color, -28);
    g.fillRect(Math.round(rug.x - hw), Math.round(rug.y + k * 2), hw * 2, 2);
    if (!edge && Math.abs(k) < 9){
      const hw2 = Math.round((1 - Math.abs(k) / 9) * 34);
      g.fillStyle = shade(color, 10);
      g.fillRect(Math.round(rug.x - hw2), Math.round(rug.y + k * 2), hw2 * 2, 2);
    }
  }
}
function drawRoom(){
  const g = roomCtx(); if (!g) return;
  const R = Q.roomOf(save), color = hero.color;
  g.clearRect(0, 0, RW, RH);
  g.drawImage(roomShellCv(color), 0, 0, RW, RH);
  // ---- 빈 자리 ----
  Q.ROOM_SLOTS.forEach(sl => {
    if (R.at[sl.id]) return;
    const on = roomPick && Q.RI[roomPick] && Q.RI[roomPick].where === sl.where;
    if (sl.where === 'wall'){
      // 벽면 위의 네 귀퉁이 — 벽이 기울어 있으므로 가로줄도 같이 기울여 긋는다
      g.fillStyle = on ? 'rgba(255,217,121,.8)' : 'rgba(255,255,255,.16)';
      const S = 48, L = on ? 12 : 6, sk = sl.side === 'r' ? 0.5 : -0.5;
      const hline = (c0, c1, rr) => { for (let c = c0; c < c1; c += 2) g.fillRect(sl.x + c, sl.y + rr + Math.round(c * sk), 2, 2); };
      const vline = (c, r0, len) => g.fillRect(sl.x + c, sl.y + r0 + Math.round(c * sk), 2, len);
      hline(0, L, 0); hline(S - L, S, 0); hline(0, L, S - 2); hline(S - L, S, S - 2);
      vline(0, 0, L); vline(0, S - L, L); vline(S - 2, 0, L); vline(S - 2, S - L, L);
    } else {
      isoTile(g, sl.x + 24, sl.y + 42, on ? 'rgba(255,217,121,.7)' : 'rgba(255,255,255,.13)', 6);
    }
  });
  // ---- 놓인 것 ---- 벽부터, 바닥은 뒤에서 앞으로
  const lamps = [];
  const put = sl => {
    const id = R.at[sl.id]; if (!id) return;
    const art = ROOM_ART[id];
    if (!art && !ROOM_PAINT[id]) return;
    if (sl.where !== 'wall'){                                  // 바닥에 지는 그림자
      isoTile(g, sl.x + 24, sl.y + 43, 'rgba(20,14,8,.30)', 10);
    }
    if (sl.where !== 'wall' && ROOM_PAINT[id]) ROOM_PAINT[id](g, sl.x + 24, sl.y + 44, color);
    else drawArt(g, art, sl.x, sl.y, 2, color, sl.where === 'wall' ? (sl.side === 'r' ? 0.5 : -0.5) : 0);
    if (id === 'medals'){                                      // 받은 칭호만큼 훈장이 걸린다
      const n = Math.min(6, Q.titlesOf(save, st).length);
      const sk = sl.side === 'r' ? 0.5 : -0.5;
      for (let m = 0; m < n; m++){
        const cx = 8 + (m % 3) * 7, cy = 8 + Math.floor(m / 3) * 7;
        const dy = Math.round(cx * 2 * sk);
        g.fillStyle = RPAL.G; g.fillRect(sl.x + cx * 2, sl.y + cy * 2 + dy, 8, 8);
        g.fillStyle = RPAL.y; g.fillRect(sl.x + cx * 2 + 2, sl.y + cy * 2 + 2 + dy, 4, 4);
        g.fillStyle = RPAL.q; g.fillRect(sl.x + cx * 2 + 2, sl.y + cy * 2 + 8 + dy, 4, 4);
      }
    }
    if (id === 'torch') lamps.push([sl.x + 24, sl.y + 14, 70]);
    if (id === 'hearth') lamps.push([sl.x + 24, sl.y + 28, 88]);
    if (id === 'table') lamps.push([sl.x + 20, sl.y + 10, 46]);
  };
  Q.ROOM_SLOTS.filter(sl => sl.where === 'wall').forEach(put);
  Q.ROOM_SLOTS.filter(sl => sl.where !== 'wall').sort((a, b) => a.y - b.y).forEach(put);
  // ---- 빛 ---- 불이 있는 것 둘레만 따뜻해진다. 없으면 방이 서늘하다.
  g.save();
  g.globalCompositeOperation = 'lighter';
  lamps.forEach(L => {
    const grd = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], L[2]);
    grd.addColorStop(0, 'rgba(255,190,90,0.30)');
    grd.addColorStop(0.5, 'rgba(255,160,60,0.12)');
    grd.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = grd; g.fillRect(L[0] - L[2], L[1] - L[2], L[2] * 2, L[2] * 2);
  });
  g.restore();
  // 가장자리는 어둡게 — 방이 한 덩어리로 모인다
  const vig = g.createRadialGradient(RW / 2, RH / 2, 60, RW / 2, RH / 2, 250);
  vig.addColorStop(0, 'rgba(10,6,2,0)');
  vig.addColorStop(1, 'rgba(10,6,2,0.45)');
  g.fillStyle = vig; g.fillRect(0, 0, RW, RH);
}
// 늘 같은 자리에 같은 결이 나오도록 — 자리 이름에서 0~1 사이 수 하나
function prandRoom(k){
  let h = 2166136261;
  for (let i = 0; i < k.length; i++){ h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}
/* 방 화면을 누르면 — 고른 것이 있으면 놓고, 없으면 그 자리 것을 집는다.
   앞에 그려진 것이 이긴다(뒤에서 앞으로 그리므로 거꾸로 훑는다). */
function roomHit(e){
  const cv = $('#roomCanvas'); const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * RW, y = (e.clientY - r.top) / r.height * RH;
  const list = Q.ROOM_SLOTS.slice().sort((a, b) => (a.where === 'wall' ? -1 : 1) - (b.where === 'wall' ? -1 : 1) || a.y - b.y);
  for (let i = list.length - 1; i >= 0; i--){
    const sl = list[i];
    const dy = sl.where === 'wall' ? 0 : 0;
    if (x >= sl.x && x < sl.x + 48 && y >= sl.y + dy && y < sl.y + 48 + dy) return sl;
  }
  return null;
}

function roomSay(t){ const el = $('#roomMsg'); if (el) el.textContent = t; }
function renderRoom(){
  const box = $('#roomTray'); if (!box) return;
  Q.roomOf(save);                       // 옛 세이브면 여기서 방 칸이 생긴다
  const rank = Q.roomRank(save);
  $('#roomRank').textContent = '🏰 ' + rank.name + ' · 꾸민 값 ' + Q.roomScore(save);
  // 트레이 — 산 것은 「놓기」, 안 산 것은 값이 붙는다
  box.innerHTML = '';
  Q.ROOM_ITEMS.forEach(it => {
    const own = Q.roomHas(save, it.id), put = Q.roomSlotOf(save, it.id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = (roomPick === it.id ? 'pick ' : '') + (put ? 'put' : own ? 'own' : '');
    b.disabled = !!battle || (!own && save.gold < it.price);
    b.innerHTML = it.icon + ' ' + it.name +
      '<small>' + (own ? (put ? '놓여 있어요 · 눌러서 옮기기' : '눌러서 자리 고르기') : '💰' + it.price) + '</small>';
    b.addEventListener('click', () => {
      if (!own){
        if (!Q.roomBuy(save, it.id)) return;
        sfx('key'); roomPick = it.id;
        roomSay(it.name + J2(it.name, '을', '를') + ' 샀어요. ' +
          (it.where === 'wall' ? '벽' : it.where === 'back' ? '안쪽' : '앞') + ' 자리를 골라 놓아요.');
      } else {
        roomPick = roomPick === it.id ? null : it.id;
        sfx('pop');
        roomSay(roomPick ? '자리를 눌러 놓아요 — ' + it.say : '');
      }
      renderStatus(); renderRoom(); drawRoom(); renderShop(); persist();
    });
    box.appendChild(b);
  });
  // 짚 침대에서 쉬기
  const rest = $('#roomRest');
  const canRest = Q.roomCanRest(save, today());
  rest.hidden = !Q.roomSlotOf(save, 'bed');
  rest.disabled = !canRest || !!battle || save.hp >= st.maxHp;
  rest.textContent = canRest ? '🛏 짚 침대에서 쉬기 (공짜)' : '🛏 오늘은 벌써 쉬었어요';
  drawRoom();
}
function wireRoom(){
  const cv = $('#roomCanvas'); if (!cv) return;
  cv.addEventListener('click', e => {
    if (battle) return;
    const sl = roomHit(e);
    if (!sl){ roomPick = null; renderRoom(); return; }
    const R = Q.roomOf(save);
    if (roomPick){
      const it = Q.RI[roomPick];
      if (it.where !== sl.where){
        roomSay(it.name + J2(it.name, '은', '는') + ' ' +
          (it.where === 'wall' ? '벽에 거는' : it.where === 'back' ? '안쪽 줄에 세우는' : '앞줄에 놓는') + ' 것이에요.');
        return;
      }
      const had = R.at[sl.id];
      Q.roomPut(save, roomPick, sl.id);
      sfx('pop');
      roomSay(it.name + J2(it.name, '을', '를') + ' 놓았어요.' + (had ? ' (' + Q.RI[had].name + J2(Q.RI[had].name, '은', '는') + ' 가방으로)' : ''));
      roomPick = null;
    } else if (R.at[sl.id]){
      const it = Q.RI[R.at[sl.id]];
      Q.roomTake(save, sl.id); sfx('pop');
      roomSay(it.name + J2(it.name, '을', '를') + ' 집었어요. 놓을 자리를 눌러요.');
      roomPick = it.id;
    } else {
      roomSay('아래에서 놓을 것을 먼저 골라요.');
    }
    renderStatus(); renderRoom(); renderShop(); persist();
  });
  $('#roomRest').addEventListener('click', () => {
    if (!Q.roomCanRest(save, today())) return;
    Q.roomOf(save).rest = today();
    save.hp = st.maxHp;
    sfx('sparkle');
    roomSay('짚 침대에서 푹 쉬었어요. 체력이 가득 찼어요.');
    renderStatus(); renderRoom(); persist();
  });
}

// ---------- 이번 주 보스 ----------
function weekFoe(streak){
  const k = Q.weekKey();
  return Object.assign({
    name: Q.WEEK.name(k), boss: true, week: true, hp: Q.WEEK.hp(k, TUNE, streak),
    atk: 0, xp: 0, gold: 0, area: Q.WEEK.area(k), idx: -1, elem: Q.WEEK.elem(k),
  }, Q.WEEK.sprite(k));
}
function weekTotal(k){
  return Object.keys(saves).reduce((a, w) => a + ((saves[w].week && saves[w].week.key === k) ? saves[w].week.dmg : 0), 0);
}
// 지난 넉 주와 이번 주를 나란히 세운다 — 이번 주가 나은 주인지 눈으로 견준다.
function weekBars(k, total, hp){
  let log = (save.weekLog || []).slice(-Q.WEEK_LOG_MAX);
  // 넉 주 기록이 쌓이기 전이라면, 예전 방식으로 적어 둔 지난주 한 줄이라도 쓴다.
  if (!log.length && save.lastWeek && save.lastWeek.hp)
    log = [{ key: save.lastWeek.key, total: save.lastWeek.dmg, hp: save.lastWeek.hp }];
  // 견줄 지난 주가 없으면 이번 주 막대 하나만 덩그러니 남아 고장처럼 보인다 — 그때는 안 그린다.
  if (!log.length) return '';
  const cells = log.concat([{ key: k, total: total, hp: hp, now: true }]).map(e => {
    const p = Math.max(0, Math.min(100, Math.round(100 * (e.total == null ? e.dmg : e.total) / (e.hp || 1))));
    const cls = [e.now ? 'now' : '', p >= 100 ? 'won' : ''].filter(Boolean).join(' ');
    return '<span class="' + cls + '" title="' + e.key + ' 주 · ' + p + '%">' +
      '<i style="height:' + Math.max(2, Math.round(p * 0.28)) + 'px"></i></span>';
  }).join('');
  return '<div class="wlog">' + cells + '<em>지난 ' + log.length + '주 → 이번 주</em></div>';
}
function renderWeek(){
  const k = Q.weekKey(), box = $('#week');
  if (save.week.key !== k && save.week.key){
    // 지난주가 막 끝났다 — 함께 쓰러뜨렸으면 심화판 연속이 하나 는다, 아니면 0으로.
    // 가족 전체 피해(weekTotal)로 재야 한다 — 내 몫만 보면 동생이 대신 넘긴 주도 「졌다」로 셀 수 있다.
    const wasWon = weekTotal(save.week.key) >= (save.week.hp || 0);
    save.weekStreak = wasWon ? (save.weekStreak || 0) + 1 : 0;
    save.lastWeek = { key: save.week.key, dmg: save.week.dmg, hp: save.week.hp || 0, name: Q.WEEK.name(save.week.key) };
    Q.pushWeekLog(save, { key: save.week.key, dmg: save.week.dmg, hp: save.week.hp || 0,
      total: weekTotal(save.week.key), won: wasWon });
  }
  const streak = save.weekStreak || 0, foe = weekFoe(streak);
  if (save.week.key !== k) save.week = { key: k, dmg: 0, day: '', swings: 0, claimed: false, hp: foe.hp };
  save.week.hp = foe.hp;
  if (save.week.day !== today()){ save.week.day = today(); save.week.swings = 0; }
  const total = weekTotal(k), left = Q.WEEK.swingsPerDay - save.week.swings, down = total >= foe.hp;
  const mine = save.week.dmg, other = total - mine, reward = Q.WEEK.reward(streak);
  const wpct = v => Math.min(100, Math.round(100 * v / foe.hp));
  box.innerHTML = '';
  const cv = document.createElement('canvas'); cv.width = 66; cv.height = 45;
  const g = cv.getContext('2d'); const sp = SPRITES[foe.sp];
  g.imageSmoothingEnabled = false;
  drawSprite(g, sp, Math.floor((66 - sp[0].length * 2) / 2), Math.max(0, 45 - sp.length * 2), 2);
  box.appendChild(cv);
  const d = document.createElement('div'); d.className = 'wb';
  d.innerHTML =
    '<div class="who" style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;"><span>' + EI(foe.elem) + ' ' + foe.name +
      (streak >= 1 ? ' <span class="badge streak">🔥 ' + streak + '주 연속 심화판</span>' : '') +
      '</span><span>' + Math.min(total, foe.hp) + ' / ' + foe.hp + '</span></div>' +
    '<div class="hpbar" title="자매가 낸 피해를 합쳐요"><i class="mine" style="width:' + wpct(mine) + '%"></i>' +
      '<i class="other" style="left:' + wpct(mine) + '%;width:' + Math.min(100 - wpct(mine), wpct(other)) + '%"></i></div>' +
    weekBars(k, total, foe.hp) +
    '<div class="wkeys">' +
      '<span title="내가 낸 피해"><i class="sw" style="background:#b9a3d6"></i>' + mine + '</span>' +
      '<span title="' + hero.call + J2(hero.call, '이', '가') + ' 낸 피해"><i class="sw" style="background:#8ec9ee"></i>' + hero.call + ' ' + other + '</span>' +
      (down ? '<span>👑 쓰러뜨렸어요!</span>'
            : '<span title="하루 ' + Q.WEEK.swingsPerDay + '번 · 오늘 ' + left + '번 남음">⚔ ' + pips(left, Q.WEEK.swingsPerDay) + '</span>') +
    '</div>';
  const act = document.createElement('div'); act.style.marginTop = '8px';
  if (down && !save.week.claimed){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dot-btn small primary';
    b.textContent = '🎁 보상 받기 💰' + reward.gold + ' ⭐' + reward.xp;
    b.addEventListener('click', () => {
      save.week.claimed = true; save.gold += reward.gold; save.xp += reward.xp;
      save.weekWins = (save.weekWins || 0) + 1;
      sfx('fanfare'); refreshStats(); renderAll(); persist(true);
    });
    act.appendChild(b);
  } else if (!down) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dot-btn small coral';
    b.textContent = left > 0 ? '⚔ 때리러 가기' : '오늘 몫은 다 썼어요';
    b.disabled = left <= 0 || !!battle;
    b.addEventListener('click', () => startBattle(foe));
    act.appendChild(b);
  } else {
    act.innerHTML = '<span class="note" style="font-size:12px;color:var(--ink-soft)">보상은 받았어요. 다음 주에 또 만나요.</span>';
  }
  d.appendChild(act);
  box.appendChild(d);
}

// =====================================================================
//  전투
// =====================================================================
const canvas = $('#qCanvas'), ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 320, H = 200, GROUND = 172;
let raf = 0, fx = [], shake = { hero: 0, foe: 0 }, flash = 0, timing = null;
let heroLunge = 0, foeLunge = 0, fairyAt = 0, friendAt = 0, chestAt = 0, chestItem = null;
const now = () => performance.now();
const wait = ms => new Promise(r => setTimeout(r, ms));

function log(html){ $('#qlog').innerHTML = html; }
// 전투 중이면 전투 기록에, 아니면 제목 아래에. 이번 주 보상으로 레벨이 오르면
// 전투 상자가 닫혀 있어서 기록에 적어 봐야 아무도 못 봤다.
function notice(html){
  if (battle && !$('#battleCard').hidden) { log(html); return; }
  $('#notice').innerHTML = html; $('#notice').hidden = false;
}

function startBattle(foe){
  if (battle) return;
  battle = {
    foe, fhp: foe.hp, energy: 0, charged: false, guard: false, bguard: false,
    turn: 0, busy: false, week: !!foe.week, streak: 0, cheered: false, acts: 0,
  };
  if (!foe.week){
    curArea = foe.area;
    // 도감 — 만난 상대를 적는다. 셋과 대장을 다 만나면 그 무대의 하늘을 올해의 카드에 쓸 수 있다.
    save.met[foe.boss ? foe.area + ':boss' : foe.area + ':' + foe.idx] = true;
    if (Q.dexDone(save, foe.area) && !save.dexSkies.some(s => s.name === Q.AREAS[foe.area].name)){
      save.dexSkies.push({ name: Q.AREAS[foe.area].name, sky: Q.AREAS[foe.area].sky });
      notice('📖 <b>' + Q.AREAS[foe.area].name + '</b> 도감을 다 채웠어요! 첫 화면의 올해의 카드 배경으로 쓸 수 있어요.');
    }
  }
  $('#battleCard').hidden = false;
  $('#bHeroName').textContent = hero.name;
  $('#bFoeName').textContent = EI(foe.elem) + ' ' + foe.name + (foe.boss ? ' (대장)' : '');
  renderBars(); renderMenu(); renderMap(); renderExpo(); renderShop(); renderWeek(); renderDex();
  log(foe.week
    ? '<b>' + foe.name + '</b>' + J2(foe.name, '이', '가') + ' 버티고 서 있어요. 오늘 몫 ' + (Q.WEEK.swingsPerDay - save.week.swings) + '번을 때려요!'
    : '<b>' + foe.name + '</b>' + J2(foe.name, '이', '가') + ' 나타났어요! ' + EI(foe.elem) + ' ' + EN(foe.elem) + ' 속성이에요.' + (combo ? ' 💞 콤보 중!' : ''));
  sfx(foe.boss ? 'thud' : 'pop');
  $('#battleCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  loopOn();
}

function endBattle(){
  battle = null; timing = null; fx = []; fairyAt = friendAt = chestAt = 0;
  $('#battleCard').hidden = true;
  loopOff();
  renderAll();
  persist(true);
}

function renderBars(){
  const b = battle;
  $('#bHeroHp').textContent = save.hp + ' / ' + st.maxHp;
  const hf = $('#bHeroFill'); hf.style.width = Math.max(0, Math.round(100 * save.hp / st.maxHp)) + '%';
  hf.classList.toggle('low', save.hp <= st.maxHp * 0.3);
  if (b.week){
    const total = weekTotal(save.week.key);
    $('#bFoeHp').textContent = Math.max(0, b.foe.hp - total) + ' / ' + b.foe.hp;
    $('#bFoeFill').style.width = Math.max(0, Math.round(100 * (b.foe.hp - total) / b.foe.hp)) + '%';
  } else {
    $('#bFoeHp').textContent = Math.max(0, b.fhp) + ' / ' + b.foe.hp;
    $('#bFoeFill').style.width = Math.max(0, Math.round(100 * b.fhp / b.foe.hp)) + '%';
  }
  $('#energy').innerHTML = Array.from({ length: Q.MAX_ENERGY }, (_, i) => '<i' + (i < b.energy ? ' class="on"' : '') + '></i>').join('');
}

function renderMenu(){
  const m = $('#menu'), b = battle; m.innerHTML = '';
  if (!b) return;
  if (timing){
    const t = document.createElement('button'); t.type = 'button'; t.className = 'tap';
    t.textContent = '지금!'; t.disabled = !timingOpen();     // 열리기 전에는 꺼 둔다
    t.addEventListener('click', tapNow);
    m.appendChild(t); return;
  }
  const mk = (label, sub, fn, opt) => {
    const el = document.createElement('button'); el.type = 'button';
    el.innerHTML = label + (sub ? '<small>' + sub + '</small>' : '');
    el.disabled = b.busy || (opt && opt.off);
    if (opt && opt.cls) el.className = opt.cls;
    el.addEventListener('click', fn); m.appendChild(el);
  };
  if (b.week){
    const left = Q.WEEK.swingsPerDay - save.week.swings;
    mk('공격', pips(left, Q.WEEK.swingsPerDay), () => act('attack'), { off: left <= 0 });
    mk('돌아가기', '', () => act('run'));
    return;
  }
  mk('공격', '타이밍!', () => act('attack'));
  // 배운 기술이 하나씩 단추가 된다. 상성이 좋고 나쁨을 단추에서 바로 알려 준다 —
  // 「왜 이번엔 덜 아팠지」를 아이가 스스로 알 수 있어야 고르는 재미가 생긴다.
  Q.skillsOf(key, st.lv, combo).forEach(s => {
    const say = Q.elemSay(s.elem, b.foe.elem);
    // 드는 기운은 칸으로 — 지금 모인 기운만큼 칸이 차 있어 얼마나 남았는지 눈에 보인다.
    mk((s.duo ? '💞' : EI(s.elem)) + ' ' + s.name,
      pips(Math.min(b.energy, s.cost), s.cost, 'sm') + (say ? ' ' + say : ''),
      () => act('skill:' + s.id),
      { off: b.energy < s.cost, cls: 'skill' + (say === '강해요!' ? ' good' : say === '약해요' ? ' bad' : '') });
  });
  mk('방어', '❤️ +' + st.guardHeal, () => act('guard'));
  mk('물약', '🧪 ' + save.potions, () => act('potion'), { off: save.potions <= 0 });
  mk('도망', '', () => act('run'));
}

// 타이밍 바 — 왔다 갔다 하는 표시를 칸 안에서 멈추면 강타.
/* 공격 단추를 누른 그 손짓이 그대로 타이밍 화면으로 넘어와 저절로 눌리던 일이 있었다.
   「지금!」 단추는 공격 단추가 있던 자리에 같은 프레임에 생기는데, 폰에서는 손을 뗀 뒤에도
   따라오는 이벤트(뒤늦은 click, 튀는 두 번째 탭)가 새 단추로 들어간다. 친구가 먼저 달려드는
   차례에는 기다림이 끼어 있어 안 그랬으니 「간혹」이었다.
   그래서 열리기까지 잠깐(GRACE) 아무 것도 안 받는다 — 단추도 그동안 눌리지 않게 꺼 둔다.
   바늘도 그때부터 움직이기 시작하니 손해 보는 시간은 없다. */
const TAP_GRACE = 280;
function startTiming(){
  return new Promise(resolve => {
    const open = now() + TAP_GRACE;
    timing = { t0: open, openAt: open, center: 30 + Math.random() * 40, zone: st.zone, resolve, done: false };
    renderMenu();
    setTimeout(() => { if (timing && !timing.done) renderMenu(); }, TAP_GRACE);   // 단추를 켠다
    // 열린 뒤 4초 안에 안 누르면 빗나간 것으로.
    setTimeout(() => { if (timing && !timing.done) finishTiming(); }, TAP_GRACE + 4000);
  });
}
function markerPos(t){
  const p = (Math.max(0, t - timing.t0) % 1200) / 1200;
  return p < 0.5 ? p * 200 : (1 - p) * 200;
}
function timingOpen(){ return !!timing && !timing.done && now() >= timing.openAt; }
function finishTiming(){
  if (!timing || timing.done) return;
  timing.done = true;
  const pos = markerPos(now());
  const r = Q.judge(pos, timing.center, timing.zone);
  const res = timing.resolve; timing.result = r; timing.pos = pos;
  setTimeout(() => { timing = null; renderMenu(); }, 350);
  res(r);
}
function tapNow(){ if (timingOpen()) finishTiming(); }
canvas.addEventListener('pointerdown', e => { e.preventDefault(); tapNow(); });
document.addEventListener('keydown', e => {
  // e.repeat 을 걸러야 스페이스를 누르고 있는 동안 저절로 안 눌린다
  if (e.key === ' ' && !e.repeat && timingOpen() && !$('#battleCard').hidden){ e.preventDefault(); tapNow(); }
});

const SAY = { perfect: '강타!', good: '명중', miss: '빗나감…', skill: '기술!' };

async function act(kind){
  const b = battle;
  if (!b || b.busy) return;
  b.busy = true; b.guard = false; renderMenu();
  if (kind === 'run'){
    log(b.week ? '오늘은 여기까지. 낸 피해는 남아 있어요.' : '도망쳤어요. 다음에 다시!');
    await wait(500); endBattle(); return;
  }
  b.acts++;

  // 친구와 응원 요정은 내 차례 앞에 온다.
  if (!b.week){
    const fa = Q.friendAct(save, st);
    if (fa && fa.kind === 'heal' && save.hp >= st.maxHp){
      fa.kind = 'atk'; fa.amount = Q.FRIEND.atk(st);
    }
    if (fa){
      const f = Q.friendsOf(save).find(x => x.key === fa.key), fn = f ? f.name : '친구';
      friendAt = now(); sfx('pop');
      if (fa.kind === 'atk'){
        b.fhp -= fa.amount;
        addFx(b.foe.name, '-' + fa.amount, '#8fd9c8', false);
        log('🐾 <b>' + fn + '</b>' + J2(fn, '이', '가') + ' 달려들어 <b>' + fa.amount + '</b> 피해!');
      } else {
        const heal = Math.min(fa.amount, st.maxHp - save.hp);
        save.hp += heal;
        addFx(hero.name, '+' + heal, '#6fb567', true);
        log('🐾 <b>' + fn + '</b>' + J2(fn, '이', '가') + ' 곁에 붙어 체력 <b>' + heal + '</b> 회복!');
      }
      renderBars(); await wait(650);
      if (b.fhp <= 0){ await win(); return; }
    }
    if (TUNE.cheer && !b.cheered && b.acts >= 2 && save.hp < st.maxHp * 0.7){
      b.cheered = true; fairyAt = now(); sfx('sparkle');
      const heal = Math.min(Math.round(st.maxHp * Q.CHEER_HEAL), st.maxHp - save.hp); save.hp += heal;
      addFx(hero.name, '+' + heal, '#ffd979', true);
      log('💌 응원 요정: 「' + escapeHTML(TUNE.cheer) + '」 — 체력 ' + heal + ' 회복!');
      renderBars(); await wait(900);
    }
  }

  if (kind === 'attack'){
    const r = await startTiming();
    if (!b.week) b.energy = Math.min(Q.MAX_ENERGY, b.energy + 1);
    await hitFoe(Q.heroHit(st, r, null, combo ? Q.COMBO_MULT : 1), r);
  } else if (kind.indexOf('skill:') === 0){
    const s = Q.skillsOf(key, st.lv, combo).find(x => x.id === kind.slice(6));
    if (!s || b.energy < s.cost){ b.busy = false; renderMenu(); return; }
    b.energy -= s.cost;
    sfx(s.sfx);
    const em = Q.elemMult(s.elem, b.foe.elem);
    // 별 조각(장신구)은 기술에만 붙는다 — 보통 공격까지 세지면 타이밍을 맞추는 재미가 줄어든다
    const shard = 1 + Q.amuEff(save, 'skill');
    await hitFoe(Q.heroHit(st, 'skill', null, s.mult * em * shard * (combo ? Q.COMBO_MULT : 1)), 'skill', s, em);
    missionTick('skill');
    // 합체기는 둘의 마음을 합친 만큼 체력도 조금 돌려준다
    if (s.heal && !b.week){
      const heal = Math.min(Math.round(st.maxHp * s.heal), st.maxHp - save.hp);
      if (heal > 0){
        save.hp += heal; addFx(hero.name, '+' + heal, '#ff9aa2', true);
        log('💞 <b>' + hero.call + '</b>' + J2(hero.call, '과', '와') + ' 마음을 합쳤어요 — 체력 ' + heal + ' 회복!');
        renderBars(); await wait(500);
      }
    }
  } else if (kind === 'guard'){
    b.guard = true; b.energy = Math.min(Q.MAX_ENERGY, b.energy + 1);
    const heal = Math.min(st.guardHeal, st.maxHp - save.hp);
    save.hp += heal; sfx('drip');
    addFx(hero.name, '+' + heal, '#6fb567', true);
    log('<b>방어</b> 자세! 체력 ' + heal + ' 회복. 이번 턴은 받는 피해가 절반이에요.');
    renderBars(); await wait(500);
  } else if (kind === 'potion'){
    save.potions--; b.energy = Math.min(Q.MAX_ENERGY, b.energy + 1);
    const heal = Math.min(Math.round(st.maxHp * Q.SHOP.potion.heal), st.maxHp - save.hp);
    save.hp += heal; sfx('drip');
    addFx(hero.name, '+' + heal, '#6fb567', true);
    log('<b>물약</b>을 마셨어요. 체력 ' + heal + ' 회복.');
    renderBars(); await wait(500);
  }

  if (b.week){
    if (weekTotal(save.week.key) >= b.foe.hp){
      log('<b>' + b.foe.name + '</b>' + J2(b.foe.name, '이', '가') + ' 쓰러졌어요! 보상은 지도 아래에서 받아요.');
      sfx('fanfare'); await wait(900); endBattle(); return;
    }
    if (save.week.swings >= Q.WEEK.swingsPerDay){
      log('오늘 몫을 다 때렸어요. 내일 또 ' + Q.WEEK.swingsPerDay + '번!');
      await wait(700); endBattle(); return;
    }
    b.busy = false; renderMenu(); dirty = true; return;
  }

  if (b.fhp <= 0){ await win(); return; }
  await foeTurn();
  if (save.hp <= 0){ await lose(); return; }
  // 턴마다 쓰지 않는다 — 열 턴이면 열 번 쓰게 되어서. 전투가 끝날 때 한 번, 그 전에
  // 페이지를 닫으면 그때 한 번.
  b.busy = false; renderMenu(); dirty = true;
}

async function hitFoe(dmg, kind, skill, em){
  const b = battle;
  heroLunge = now();
  await wait(140);
  // 대장이 단단해졌으면 내 공격이 줄어든다.
  let cut = '';
  if (b.bguard){ dmg = Math.max(1, Math.round(dmg * Q.BOSS_GUARD_CUT)); b.bguard = false; cut = ' (단단해져서 절반)'; }
  if (b.week){ dmg *= Q.WEEK.swingMult; save.week.dmg += dmg; save.week.swings++; }
  else b.fhp -= dmg;
  shake.foe = now(); flash = (kind === 'perfect' || kind === 'skill') ? now() : 0;
  let streakSay = '';
  if (kind === 'perfect'){
    missionTick('perfect');
    b.streak++;
    if (b.streak >= Q.STREAK_FOR_FANFARE){
      b.streak = 0;
      sfx(facts.sfx || hero.streakSfx);
      addFx(hero.name, Q.STREAK_FOR_FANFARE + '연속!', '#ffd979', true);
      streakSay = ' 🎵 <b>' + Q.STREAK_FOR_FANFARE + '연속 강타!</b>';
    } else sfx('sparkle');
  } else if (kind !== 'skill'){ b.streak = 0; sfx(kind === 'miss' ? 'prop' : 'boing'); }
  addFx(b.foe.name, '-' + dmg, (kind === 'perfect' || kind === 'skill') ? '#ffd979' : '#ffffff', false);
  const eSay = skill && em !== 1 ? ' — ' + EI(skill.elem) + (em > 1 ? ' 효과가 굉장했어요!' : ' 잘 안 통했어요') : '';
  log('<b>' + (skill ? skill.name + '!' : SAY[kind]) + '</b> ' + b.foe.name + '에게 <b>' + dmg + '</b> 피해' + cut + eSay +
      (kind === 'perfect' ? ' — 칸 한가운데!' : kind === 'miss' ? ' — 칸을 놓쳤어요' : '') +
      (b.week ? ' (합계 ' + weekTotal(save.week.key) + ')' : '') + streakSay);
  renderBars();
  await wait(520);
}

async function foeTurn(){
  const b = battle, foe = b.foe;
  b.turn++;
  // 대장은 세 턴마다 정해진 차례대로 특별한 짓을 한다.
  const special = Q.bossAct(foe, b.turn);
  if (special){
    const S = Q.BOSS_SAY[special];
    sfx(S.sfx);
    if (special === 'charge') b.charged = true;
    if (special === 'guard') b.bguard = true;
    if (special === 'heal'){
      const heal = Math.min(Math.round(foe.hp * Q.BOSS_HEAL), foe.hp - b.fhp);
      b.fhp += heal;
      addFx(foe.name, '+' + heal, '#6fb567', false);
    }
    log('<b>' + foe.name + '</b>' + J2(foe.name, '이', '가') + ' ' + S.say);
    renderBars();
    await wait(750);
    // 힘을 모으는 턴은 때리지 않는다. 나머지는 하고 나서 때린다 —
    // 안 그러면 특별 행동이 오히려 대장에게 손해가 된다(시뮬레이션에서 확인).
    if (Q.BOSS_SKIP[special]) return;
  }
  foeLunge = now();
  await wait(160);
  if (Math.random() < st.dodge){
    b.charged = false; sfx('pop');
    addFx(hero.name, '피함!', '#ffffff', true);
    log(hero.name + J2(hero.name, '이', '가') + ' 재빠르게 <b>피했어요</b>!');
    await wait(500); return;
  }
  const wasCharged = b.charged;
  const dmg = Q.foeHit(foe, st, b.guard, b.charged);
  b.charged = false;
  save.hp = Math.max(0, save.hp - dmg);
  shake.hero = now(); sfx('thud');
  addFx(hero.name, '-' + dmg, '#ff6b6b', true);
  log(foe.name + '의 ' + (wasCharged ? '<b>모아 둔</b> ' : '') + '공격! ' + hero.name + J2(hero.name, '이', '가') + ' <b>' + dmg + '</b> 피해' + (b.guard ? ' (방어로 절반)' : ''));
  renderBars();
  await wait(520);
}

async function win(){
  const b = battle, foe = b.foe, A = Q.AREAS[foe.area];
  sfx('fanfare');
  // 금화 주머니(장신구) — 싸워서 얻는 금화와 상자에서 나오는 금화에 붙는다
  const purse = 1 + Q.amuEff(save, 'gold');
  const gotGold = Math.round(foe.gold * purse);
  save.gold += gotGold; save.xp += foe.xp; save.fights++;
  // 오늘의 모험 카드가 읽을 하루치 — 이긴 상대와 벌어들인 것.
  const dl = Q.dayLog(save, today());
  dl.gold += gotGold; dl.xp += foe.xp;
  if (!foe.week){
    dl.wins++;
    if (foe.boss) dl.boss++;
    const fk = foe.area + ':' + (foe.boss ? 'boss' : foe.idx);
    if (dl.foes.indexOf(fk) < 0) dl.foes.push(fk);
  }
  save.streak = (save.streak || 0) + 1;
  save.bestStreak = Math.max(save.bestStreak || 0, save.streak);
  if (!foe.week) missionTick('win', foe.area);
  let extra = '';
  if (foe.boss){
    save.boss[foe.area] = true;
    const next = Q.AREAS[foe.area + 1];
    if (next && !next.hidden) extra = ' — <b>' + next.name + '</b>' + J2(next.name, '이', '가') + ' 열렸어요!';
    if (foe.area === 9) extra = ' — 열 무대를 다 돌았어요. 정말 대단해요!';
    journal(foe);
  } else {
    save.wins[foe.area]++;
    // 친구 되기 — 같은 상대를 세 번 이기면 싸우지 않고 따라다닌다.
    if (foe.tame){
      const k = foe.area + ':' + foe.idx;
      save.foeWins[k] = (save.foeWins[k] || 0) + 1;
      if (save.foeWins[k] >= Q.TAME_WINS && !save.friends.includes(k)){
        save.friends.push(k); save.friendDay[k] = today(); sfx('purr');
        extra = ' — <b>' + foe.name + '</b>' + J2(foe.name, '이', '가') + ' 친구가 됐어요! 이제 싸우지 않고 함께 싸워 줘요. 🐾';
      } else if (save.foeWins[k] < Q.TAME_WINS){
        extra = ' (' + (Q.TAME_WINS - save.foeWins[k]) + '번 더 이기면 친구가 돼요)';
      }
    }
  }
  log('<b>이겼어요!</b> 경험치 +' + foe.xp + ' · 금화 +' + gotGold + (A.hidden ? ' (두 배!)' : '') + extra);
  refreshStats();
  renderBars();
  await wait(1200);

  // 보물 상자 — 대장은 늘, 일반 상대는 가끔.
  if (Math.random() < Q.CHEST.chance(foe.boss) + Q.amuEff(save, 'chest')){
    const c = Q.openChest(foe);
    const mult = Q.streakMult(save.streak);
    if (c.gold) c.gold = Math.round(c.gold * mult * purse);   // 주머니는 금화에만 붙는다
    if (c.xp) c.xp = Math.round(c.xp * mult);
    save.chests = (save.chests || 0) + 1;
    if (c.gold) save.gold += c.gold;
    if (c.potions) save.potions = Math.min(Q.SHOP.potion.max, save.potions + c.potions);
    if (c.xp) save.xp += c.xp;
    dl.gold += c.gold || 0; dl.xp += c.xp || 0;
    chestAt = now(); chestItem = c; sfx('key');
    addFx(hero.name, '🎁', '#ffd979', true);
    const streakSay = save.streak >= 2 ? ' (🔥 ' + save.streak + '연승 · ×' + mult.toFixed(2) + ')' : '';
    log('🎁 <b>보물 상자!</b> ' + c.say + ' ' +
      (c.gold ? '금화 +' + c.gold : c.potions ? '물약 +' + c.potions : '경험치 +' + c.xp) + streakSay);
    refreshStats(); renderBars();
    await wait(2100);
  }
  endBattle();
}
async function lose(){
  const lost = save.gold - Math.floor(save.gold * Q.SHOP.lose.goldKeep);
  save.gold -= lost; save.hp = 1;
  save.streak = 0;
  sfx('thud');
  log('<b>쓰러졌어요…</b> 금화 ' + lost + J2(lost, '을', '를') + ' 잃었어요. 여관에서 쉬거나 물약을 챙겨 다시 와요.');
  renderBars();
  await wait(1500);
  endBattle();
}

// 모험 일지 — 대장을 이기면 일기장에 초안 한 편. 하루 한 편만, 부모가 확인하면 일기가
// 되어 경험치로 돌아온다. 손으로 쓴 일기는 2026-09-07 부터 바로 실리지만, 이건 아이가
// 쓴 글이 아니라 저절로 만들어진 초안이라 확인 전(pending)으로 그대로 둔다.
async function journal(foe){
  if (save.journalDay === today() || !me || !me.user_id) return;
  save.journalDay = today();
  const d = new Date(), A = Q.AREAS[foe.area];
  const body = (d.getMonth() + 1) + '월 ' + d.getDate() + '일, ' + hero.name + J2(hero.name, '이', '가') + ' ' +
    A.name + '에서 ' + foe.name + J2(foe.name, '을', '를') + ' 쓰러뜨렸다. 레벨 ' + st.lv + ', 친구 ' + save.friends.length + '.';
  const { error } = await sb.from('posts').insert({
    author: key, title: '모험 일지', body, status: 'pending', written_by: me.user_id, happened_on: today(), is_public: true,
  });
  if (!error) notice('📓 일기장에 <b>모험 일지</b> 초안을 남겼어요 — 이어 써도 되고, 부모님이 확인하면 경험치가 돼요.');
}

// =====================================================================
//  판타지 배경
//  무대마다 「무엇이 있는지」는 quest-rules.js 의 bg 에 적혀 있고, 여기서 그린다.
//  전부 정수 칸으로 그린다 — 도트 그림 옆에 매끄러운 원이 하나 있으면 그것만 튄다.
// =====================================================================
function pr(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function px(x, y, w, h, c){ ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

// 속성 고리 — 불▶풀▶물▶불, 빛◀▶어둠. 왜 이번엔 더 아팠는지 그림으로 알려 준다.
// 지금 상대의 속성 칸에 흰 테두리가 붙고, 그 칸을 이기는 화살표가 환해진다.
const RING = [
  { el: 'fire',  x: 20, y: 7  },
  { el: 'water', x: 8,  y: 24 },
  { el: 'grass', x: 32, y: 24 },
];
const RING_ARROW = {                                   // 때리는 쪽 → 맞는 쪽 사이의 점 세 개
  fire:  [[27, 15], [29, 18], [31, 21]],               // 불 → 풀
  grass: [[29, 29], [25, 29], [21, 29]],               // 풀 → 물
  water: [[12, 21], [14, 18], [16, 15]],               // 물 → 불
};
function drawElemRing(foeElem){
  const x0 = 4, y0 = 4, w = 62, h = 38;
  ctx.globalAlpha = 0.72; px(x0, y0, w, h, '#171512'); ctx.globalAlpha = 1;
  px(x0, y0, w, 1, '#6b6357'); px(x0, y0 + h - 1, w, 1, '#6b6357');
  px(x0, y0, 1, h, '#6b6357'); px(x0 + w - 1, y0, 1, h, '#6b6357');
  const node = (nx, ny, el) => {
    if (el === foeElem) px(nx - 2, ny - 2, 12, 12, '#ffffff');
    px(nx - 1, ny - 1, 10, 10, '#171512');
    px(nx, ny, 8, 8, (Q.ELEM[el] || Q.ELEM.none).c);
  };
  RING.forEach(n => {
    const beats = Q.STRONG[n.el] === foeElem;          // 이 칸이 지금 상대를 이긴다
    (RING_ARROW[n.el] || []).forEach((p, i) => {
      const c = beats ? ['#7e7768', '#c9c2b0', '#ffffff'][i] : '#5a5348';
      px(p[0], p[1], beats ? 3 : 2, beats ? 3 : 2, c);
    });
    node(n.x, n.y, n.el);
  });
  node(48, 7, 'light'); node(48, 24, 'dark');
  const lit = foeElem === 'light' || foeElem === 'dark';
  px(52, 17, 2, 6, lit ? '#ffffff' : '#5a5348');       // 빛 ↔ 어둠 은 서로 강하다
  px(51, 16, 4, 1, lit ? '#ffffff' : '#5a5348');
  px(51, 23, 4, 1, lit ? '#ffffff' : '#5a5348');
}

// 보물 상자 — 통통 튀어 오르고, 뚜껑이 열리고, 안에 든 것이 떠오른다.
function drawChest(t){
  const e = t - chestAt;
  const cy = GROUND - 20 - Math.min(10, e / 25);
  px(148, cy, 24, 16, '#c79b6d');                      // 몸통
  px(148, cy + 7, 24, 2, '#8a5f3a');
  px(157, cy, 6, 16, '#ffd979');                       // 자물쇠 띠
  const lift = e < 420 ? 0 : Math.min(10, (e - 420) / 20);
  px(148, cy - lift, 24, 5, '#8a5f3a');                // 뚜껑
  px(148, cy - lift, 24, 1, '#a87a4d');
  if (e > 470){                                        // 빛줄기
    const k = Math.min(1, (e - 470) / 260), fade = Math.max(0, 1 - Math.max(0, e - 1500) / 700);
    ctx.globalAlpha = 0.55 * fade;
    for (let i = -2; i <= 2; i++) px(159 + i * 5, cy - 4 - 15 * k, 2, Math.round(15 * k), '#fff3b0');
    ctx.globalAlpha = 1;
  }
  if (e > 540 && chestItem){                           // 안에 든 것이 떠오른다
    const iy = cy - 12 - Math.min(18, (e - 540) / 18);
    if (chestItem.gold){ px(155, iy, 10, 10, '#ffd979'); px(157, iy + 2, 6, 6, '#e0a93b'); px(159, iy + 3, 2, 4, '#ffd979'); }
    else if (chestItem.potions){ px(157, iy, 6, 3, '#8a5f3a'); px(155, iy + 3, 10, 8, '#6cc7b3'); px(157, iy + 5, 3, 3, '#bff0e4'); }
    else { drawSprite(ctx, SPRITES.star, 155, iy, 1); }
  }
}
// 스프라이트를 한 가지 색으로만 — 멀리 있는 것은 모양만 보이면 된다.
function silhOn(g, sprite, x, y, s, c){
  g.fillStyle = c;
  for (let r = 0; r < sprite.length; r++)
    for (let col = 0; col < sprite[r].length; col++)
      if (sprite[r][col] !== '.') g.fillRect(x + col * s, y + r * s, s, s);
}
const silh = (sp, x, y, s, c) => silhOn(ctx, sp, Math.round(x), Math.round(y), s, c);

// 스프라이트에 1px 테두리를 둘러 미리 그려 둔다. 배경이 화려해지자 천국의 천사,
// 사막의 선인장처럼 배경과 밝기가 비슷한 상대가 묻혔다(대비를 재서 찾았다).
const outlineCache = new Map();
function outlined(sprite, s, color){
  const k = sprite.length + '.' + sprite[0].length + '.' + s + '.' + color + '.' + sprite[0];
  let cv = outlineCache.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = sprite[0].length * s + 2; cv.height = sprite.length * s + 2;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(d => silhOn(g, sprite, d[0], d[1], s, color));
  drawSprite(g, sprite, 1, 1, s);
  outlineCache.set(k, cv);
  return cv;
}
// 밝은 무대에는 진한 테두리, 어두운 무대에는 밝은 테두리.
function drawFigure(sprite, x, y, s, dark){
  ctx.drawImage(outlined(sprite, s, dark ? '#f7f2e6' : '#2f2a24'), Math.round(x) - 1, Math.round(y) - 1);
}

function orb(o){
  const cx = Math.round(o.x * W), cy = Math.round(o.y * H), s = 2;
  const disc = (rr, col, a) => {
    ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col;
    for (let y = -rr; y <= rr; y += s){
      const w = Math.floor(Math.sqrt(Math.max(0, rr * rr - y * y)) / s) * s;
      if (w > 0) ctx.fillRect(cx - w, cy + y, w * 2, s);
    }
    ctx.globalAlpha = 1;
  };
  if (o.glow) disc(o.r + 7, o.glow, 0.28);
  disc(o.r, o.c);
  if (o.ring){                                  // 행성 고리 — 살짝 기울인 한 줄
    ctx.fillStyle = o.ring;
    for (let x = -o.r - 12; x <= o.r + 12; x += 2){
      if (Math.abs(x) > o.r * 0.6) ctx.fillRect(cx + x, cy + Math.round(x * 0.20 / 2) * 2 + 4, 2, 2);
    }
  }
}
function cloud(cx, cy, sc){
  px(cx, cy + 4 * sc, 22 * sc, 5 * sc, '#ffffff');
  px(cx + 4 * sc, cy, 11 * sc, 6 * sc, '#ffffff');
  px(cx + 14 * sc, cy + 2 * sc, 8 * sc, 4 * sc, '#ffffff');
  ctx.globalAlpha = 0.45; px(cx + 2 * sc, cy + 8 * sc, 19 * sc, 2 * sc, '#cfe4f2'); ctx.globalAlpha = 1;
}
function starfield(amount, t){
  const n = Math.round(70 * amount);
  for (let i = 0; i < n; i++){
    const sz = pr(i + 7) > 0.86 ? 2 : 1;
    ctx.globalAlpha = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t / 430 + i * 1.7));
    px(pr(i) * W, pr(i + 99) * 130, sz, sz, '#ffffff');
  }
  ctx.globalAlpha = 1;
}
function peaks(p){
  for (let k = 0; k < p.n; k++){
    const cx = Math.round((k + 0.5) * (W / p.n) + (k % 2 ? 16 : -12));
    const h = p.h - (k % 2) * 12;
    for (let y = 0; y < h; y += 2){
      const w = Math.round((y / h) * h * 0.85 / 2) * 2;
      px(cx - w, p.top + y, w * 2 || 2, 2, y < 6 ? p.edge : p.c);
    }
  }
}
function dunes(d){
  for (let k = 0; k < d.n; k++){
    ctx.fillStyle = k % 2 ? d.c : '#9a6f4a';
    for (let x = 0; x < W; x += 3){
      const y = Math.round((d.y + k * 10 + Math.sin(x / (44 + k * 14) + k * 2) * 6) / 3) * 3;
      ctx.fillRect(x, y, 3, GROUND - y);
    }
  }
}
function skyline(sk, t){
  for (let x = 0; x < W; x += 11){
    const h = 16 + Math.round(pr(x) * 36 / 2) * 2;
    px(x, sk.y - h, 10, h + 34, sk.c);
    for (let wy = sk.y - h + 4; wy < sk.y - 4; wy += 6)
      for (let wx = x + 2; wx < x + 9; wx += 4)
        if (pr(wx * 7 + wy) > 0.42 + 0.18 * Math.sin(t / 1900 + wx)) px(wx, wy, 2, 2, sk.lit);
  }
}
function island(ix, iy, iw, top, rock){
  px(ix, iy, iw, 3, top);
  for (let i = 0; i < 6; i++){
    const w = Math.max(2, iw - 4 - i * 4);
    px(ix + Math.round((iw - w) / 2), iy + 3 + i * 2, w, 2, rock);
  }
}
function rays(cols, t){
  cols.forEach((c, i) => {
    ctx.globalAlpha = 0.16; ctx.fillStyle = c;
    const x0 = 34 + i * 52 + Math.sin(t / 2700 + i) * 7;
    for (let y = 0; y < GROUND; y += 3){
      const w = 9 + y * 0.17;
      ctx.fillRect(Math.round(x0 - w / 2 + y * 0.10), y, Math.round(w), 3);
    }
    ctx.globalAlpha = 1;
  });
}
function cloudsea(cs, t){
  for (let x = 0; x < W; x += 4){
    const y = Math.round((cs.y + Math.sin(x / 32 + t / 1900) * 6) / 2) * 2;
    px(x, y, 4, GROUND - y + 24, cs.c);
    px(x, y - 2, 4, 2, cs.edge);
  }
}
function lavaRiver(lv, t){
  for (let x = 0; x < W; x += 4){
    const y = Math.round((lv.y + Math.sin(x / 24 + t / 800) * 3) / 2) * 2;
    px(x, y, 4, 5, lv.c);
    if (pr(x + Math.floor(t / 380)) > 0.72) px(x, y - 2, 4, 2, lv.c2);
  }
}
function beams(b, t){
  for (let i = 0; i < b.n; i++){
    const base = 54 + i * 104, ang = Math.sin(t / 2400 + i * 2) * 0.55;
    ctx.globalAlpha = 0.09; ctx.fillStyle = b.c;
    ctx.beginPath();
    ctx.moveTo(base, GROUND - 24);
    ctx.lineTo(base + Math.sin(ang) * 100 - 15, 0);
    ctx.lineTo(base + Math.sin(ang) * 100 + 15, 0);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function auroraBands(cols, t){
  cols.forEach((c, i) => {
    ctx.globalAlpha = 0.15; ctx.fillStyle = c;
    for (let x = 0; x < W; x += 4){
      const y = 14 + i * 11 + Math.sin(x / 36 + t / 1200 + i * 1.4) * 9;
      ctx.fillRect(x, Math.round(y / 2) * 2, 4, 13);
    }
    ctx.globalAlpha = 1;
  });
}
function meteors(t){
  for (let i = 0; i < 3; i++){
    const p = (t / 3600 + i * 0.4) % 1;
    if (p > 0.28) continue;
    const q = p / 0.28, x = W * 1.1 - q * W * 1.4 + i * 36, y = 6 + q * 64;
    for (let k = 0; k < 9; k++){
      ctx.globalAlpha = (1 - k / 9) * 0.9;
      px(x + k * 3, y - k * 1.6, 2, 2, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}
function shimmerLine(sh, t){
  for (let i = 0; i < sh.n; i++){
    ctx.globalAlpha = 0.25 + 0.65 * Math.abs(Math.sin(t / 520 + i * 1.7));
    px(pr(i) * W, sh.y + Math.round(pr(i + 31) * 22 / 2) * 2, 3 + (i % 2) * 4, 1, sh.c);
  }
  ctx.globalAlpha = 1;
}
function fogBand(f, t){
  ctx.globalAlpha = f.a; ctx.fillStyle = f.c;
  for (let x = 0; x < W; x += 4){
    const h = 4 + Math.sin(x / 26 + t / 1700) * 3;
    ctx.fillRect(x, f.y - h, 4, h * 2);
  }
  ctx.globalAlpha = 1;
}
function birdsFly(n, t){
  for (let i = 0; i < n; i++){
    const x = ((t / 1000 * (5 + i * 1.5) + pr(i) * W) % (W + 30)) - 15;
    silh(SPRITES.bird, x, 24 + pr(i + 5) * 44 + Math.sin(t / 620 + i) * 3, 1, '#66788a');
  }
}
function pillarsOf(p){
  for (let i = 0; i < p.n; i++){
    const x = 26 + i * 112, h = 38 + (i % 2) * 14;
    px(x, GROUND - h, 8, h, p.c);
    px(x - 3, GROUND - h - 4, 14, 4, p.c);
    px(x - 3, GROUND - 4, 14, 4, p.c);
  }
}
function balloonsUp(n, t){
  const cols = ['#ff9aa2', '#8fd9c8', '#ffd979'];
  for (let i = 0; i < n; i++)
    silh(SPRITES.balloon, 44 + i * 92, 36 + Math.sin(t / 1300 + i * 2) * 9, 3, cols[i % 3]);
}
const MOTE = {
  petal:   { size: 2, up: false, sway: 13, speed: 12 },
  snow:    { size: 2, up: false, sway: 6,  speed: 10 },
  feather: { size: 2, up: false, sway: 17, speed: 8 },
  dust:    { size: 2, up: false, sway: 0,  speed: 36, side: true },
  ember:   { size: 2, up: true,  sway: 8,  speed: 26 },
  bubble:  { size: 3, up: true,  sway: 5,  speed: 15 },
  spark:   { size: 2, up: true,  sway: 3,  speed: 11 },
  firefly: { size: 2, up: false, sway: 22, speed: 4, blink: true },
};
function motes(m, t){
  const k = MOTE[m.kind] || MOTE.petal;
  for (let i = 0; i < m.n; i++){
    const ph = pr(i) * 1000, sp = k.speed * (0.6 + pr(i + 3) * 0.8);
    let x = pr(i + 11) * W + Math.sin(t / 950 + i) * k.sway;
    if (k.side) x = ((pr(i + 11) * W - t / 1000 * sp) % (W + 20) + W + 20) % (W + 20) - 10;
    const y = k.up ? GROUND - ((t / 1000 * sp + ph) % 190) : (t / 1000 * sp + ph) % 200;
    ctx.globalAlpha = k.blink ? 0.25 + 0.75 * Math.abs(Math.sin(t / 720 + i * 2)) : 0.8;
    px(x, y, k.size, k.size, m.c);
  }
  ctx.globalAlpha = 1;
}
function groundDeco(d){
  const sp = SPRITES[d.sp]; if (!sp) return;
  for (let x = 8; x < W; x += d.gap)
    drawSprite(ctx, sp, Math.round(x + pr(x) * 10), GROUND - sp.length * d.s + 3, d.s);
}
function hill(color, top, amp, wave, s){
  ctx.fillStyle = color;
  for (let x = 0; x < W; x += s){
    const y = top + Math.round(Math.sin(x / wave * Math.PI * 2) * amp / s) * s;
    ctx.fillRect(x, y, s, H - y);
  }
}
function shadow(cx, cy, w){
  ctx.fillStyle = 'rgba(47,42,36,.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, 3, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------- 한 장면 ----------
function addFx(who, txt, color, isHero){
  fx.push({ txt, color, t0: now(), x: isHero ? 70 : 250, y: 70 });
}
function loopOn(){ if (!raf) raf = requestAnimationFrame(frame); }
function loopOff(){ if (raf) cancelAnimationFrame(raf); raf = 0; }
function frame(){ draw(); raf = battle ? requestAnimationFrame(frame) : 0; }
function bump(t0, ms, amp){
  if (!t0) return 0;
  const d = now() - t0; if (d > ms) return 0;
  return Math.round(Math.sin(d / ms * Math.PI * 4) * amp * (1 - d / ms));
}
function lunge(t0){
  if (!t0) return 0;
  const d = now() - t0; if (d > 300) return 0;
  return Math.round(Math.sin(d / 300 * Math.PI) * 14);
}

function draw(){
  if (!battle) return;
  const A = Q.AREAS[battle.foe.area], B = A.bg || {}, t = now();
  ctx.setTransform(2, 0, 0, 2, 0, 0);

  // 하늘 → 별 → 오로라 → 유성 → 해·달 → 빛기둥 → 구름
  A.sky.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 26, W, 27); });
  if (B.stars) starfield(B.stars, t);
  if (B.aurora) auroraBands(B.aurora, t);
  if (B.meteor) meteors(t);
  if (B.orb) orb(B.orb);
  if (B.rays) rays(B.rays, t);
  if (B.beams) beams(B.beams, t);
  if (B.clouds) B.clouds.forEach(c => cloud(c[0] * W - 20, c[1] * H, c[2]));
  if (B.balloons) balloonsUp(B.balloons, t);
  if (B.birds) birdsFly(B.birds, t);

  // 먼 지형
  if (B.peaks) peaks(B.peaks);
  if (B.dunes) dunes(B.dunes);
  if (B.skyline) skyline(B.skyline, t);
  if (B.islands) B.islands.forEach(([x, y, w]) => island(x * W, y, w, A.far, A.groundDark));
  hill(A.far, 104, 14, 60, 3);
  if (B.silh){
    const sp = SPRITES[B.silh.sp];
    if (sp){
      const off = B.silh.speed ? (t / 1000 * B.silh.speed) % B.silh.gap : 0;
      for (let x = -B.silh.gap; x < W + B.silh.gap; x += B.silh.gap)
        silh(sp, x - off, B.silh.y - sp.length * B.silh.s, B.silh.s, B.silh.c);
    }
  }
  if (B.cloudsea) cloudsea(B.cloudsea, t);
  if (B.fog) B.fog.forEach(f => fogBand(f, t));
  hill(A.near, 132, 10, 42, 5);
  if (B.shimmer) shimmerLine(B.shimmer, t);

  // 땅
  ctx.fillStyle = A.ground; ctx.fillRect(0, GROUND - 12, W, H);
  ctx.fillStyle = A.groundDark; ctx.fillRect(0, GROUND - 12, W, 3);
  for (let x = 0; x < W; x += 24) ctx.fillRect(x + (x / 24 % 2) * 6, GROUND + 6, 8, 2);
  if (B.lava) lavaRiver(B.lava, t);
  if (B.pillars) pillarsOf(B.pillars);
  if (B.deco) groundDeco(B.deco);

  // 어두운 무대는 가장자리를 눌러 도트가 뜨게 한다
  if (A.dark){
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, H - 10, W, 10);
    ctx.fillRect(0, 0, 10, H); ctx.fillRect(W - 10, 0, 10, H);
    ctx.globalAlpha = 1;
  }

  // 주인공
  const hs = SPRITES[hero.sprite];
  const hx = 34 + lunge(heroLunge) + bump(shake.hero, 320, 4), hy = GROUND - hs.length * 2;
  shadow(hx + hs[0].length, GROUND + 2, 30);
  drawFigure(hs, hx, hy, 2, A.dark);
  // 장비에 붙인 그림 — 왼손엔 방패, 오른쪽 위엔 깃발
  const sh = gearCanvas('armor'), fl = gearCanvas('weapon');
  if (sh){ px(hx - 12, hy + 32, 26, 26, '#2f2a24'); ctx.drawImage(sh, hx - 10, hy + 34, 22, 22); }
  if (fl){ px(hx + 78, hy + 8, 2, 60, '#2f2a24'); px(hx + 80, hy + 8, 24, 24, '#2f2a24'); ctx.drawImage(fl, hx + 81, hy + 9, 22, 22); }
  // 친구들 — 주인공 뒤에 줄지어 서서 살짝 뛴다. 나설 때는 앞으로 튀어나온다.
  const acting = friendAt && t - friendAt < 700;
  Q.friendsOf(save).slice(0, 6).forEach((f, i) => {
    const sp = SPRITES[f.sp]; if (!sp) return;
    const bob = Math.round(Math.sin(t / 220 + i) * 2) - (acting && i === 0 ? 6 : 0);
    drawFigure(sp, 124 + i * 24 + (acting && i === 0 ? 20 : 0), GROUND - sp.length * 2 + bob, 2, A.dark);
  });
  // 응원 요정 — 부모의 한 줄을 들고 잠깐 날아온다
  if (fairyAt && t - fairyAt < 1600){
    const fy = 60 - Math.sin((t - fairyAt) / 300) * 6;
    drawSprite(ctx, SPRITES.butterfly, hx + 30, fy, 3);
    ctx.font = '700 9px "Galmuri11", "Suayona Sans", sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = A.dark ? '#fff' : '#2f2a24';
    ctx.fillText('💌 ' + TUNE.cheer.slice(0, 18), hx + 54, fy + 12);
  }

  // 상대
  const foe = battle.foe, fs = SPRITES[foe.sp], fw = fs[0].length * foe.s, fh = fs.length * foe.s;
  const fx0 = W - 36 - fw - lunge(foeLunge) + bump(shake.foe, 320, 5);
  const fy = GROUND - fh + (foe.boss ? 0 : Math.round(Math.sin(t / 260) * 2));
  shadow(fx0 + fw / 2, GROUND + 2, fw * 0.6);
  if (flash && t - flash < 120){ ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (battle.charged){ ctx.fillStyle = 'rgba(255,107,107,.35)'; ctx.fillRect(fx0 - 6, fy - 6, fw + 12, fh + 12); }
  if (battle.bguard){ ctx.fillStyle = 'rgba(120,180,255,.32)'; ctx.fillRect(fx0 - 6, fy - 6, fw + 12, fh + 12); }
  drawFigure(fs, fx0, fy, foe.s, A.dark);
  // 상대 속성 — 머리 위 작은 칸. 글자로 적으면 도트 옆에서 지저분하다.
  const ec = (Q.ELEM[foe.elem] || Q.ELEM.none).c;
  px(fx0 + fw / 2 - 5, fy - 11, 10, 10, '#2f2a24'); px(fx0 + fw / 2 - 3, fy - 9, 6, 6, ec);

  // 보물 상자
  if (chestAt && t - chestAt < 2200) drawChest(t);
  // 속성 고리 — 이번 주 보스는 무대가 따로 없으니 일반 전투에서만
  if (!battle.week) drawElemRing(battle.foe.elem);

  // 실제 계절·겨울엔 눈, 밤엔 화면을 살짝 눌러 어둡게 — 무대 자체는 그대로 두고
  // 얇게 한 겹만 얹는다. 숫자·타이밍 바보다는 먼저 그려서 그 위는 안 눌린다.
  if (Q.seasonOf() === 'winter') motes({ kind: 'snow', n: 16, c: '#ffffff' }, t);
  if (Q.isNight()){ ctx.globalAlpha = 0.16; ctx.fillStyle = '#0a1030'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

  // 떠오르는 숫자
  const keep = [];
  fx.forEach(f => {
    const d = t - f.t0; if (d > 900) return; keep.push(f);
    ctx.globalAlpha = 1 - d / 900;
    ctx.font = '700 12px "Galmuri11", "Suayona Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f2a24'; ctx.fillText(f.txt, f.x + 1, f.y - d / 22 + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y - d / 22);
    ctx.globalAlpha = 1;
  });
  fx = keep;

  // 앞쪽 입자는 인물 위에 — 불티가 사람 뒤로만 지나가면 깊이가 안 산다
  if (B.motes) motes(B.motes, t);

  // 타이밍 바
  if (timing){
    const bx = 60, by = 10, bw = 200, bh = 12;
    px(bx - 2, by - 2, bw + 4, bh + 4, '#2f2a24');
    px(bx, by, bw, bh, '#fffaf2');
    const zx = bx + (timing.center - timing.zone / 2) / 100 * bw, zw = timing.zone / 100 * bw;
    ctx.fillStyle = '#ffd979'; ctx.fillRect(zx, by, zw, bh);
    ctx.fillStyle = '#ff7f8a'; ctx.fillRect(zx + zw / 4, by, zw / 2, bh);
    const ready = !timing.done && now() < timing.openAt;      // 아직 안 받는 짧은 사이
    const pos = timing.done ? timing.pos : markerPos(t);
    px(bx + pos / 100 * bw - 2, by - 4, 4, bh + 8, ready ? '#8a7b6e' : '#2f2a24');
    ctx.font = '700 10px "Galmuri11", "Suayona Sans", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = A.dark ? '#fff' : '#2f2a24';
    ctx.fillText(timing.done ? SAY[timing.result] : ready ? '준비…' : '칸 안에서 톡!', W / 2, by + bh + 14);
  }
}

// 시험용 손잡이. 화면을 안 거치고 규칙대로 도는지 확인할 때 쓴다.
window.__quest = {
  get state(){ return { key, save, st, battle, timing: !!timing, facts, tune: TUNE, combo }; },
  act, startBattle, endBattle, tapNow, draw, refreshStats, renderMenu, renderAll,
  foe: (a, i) => Q.foeAt(a, i, TUNE), boss: a => Q.bossAt(a, TUNE), weekFoe,
};

boot();
