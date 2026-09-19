// find.html 의 페이지 스크립트 — 통합 찾기.
// 작품·일기·자랑·나들이·나들이 일정·장소를 한 번에 받아 두고 브라우저 안에서 거른다.
// 자료가 수백 줄 규모라(2026-09-19: 다 합쳐 200줄 남짓) 서버에 찾기를 시키는 것보다 이쪽이 빠르고,
// 글자를 칠 때마다 서버를 부르지 않는다. 무엇이 보이는지는 RLS 가 정한다 — 손님에게는 공개된 것만 온다.
// 싣는 순서: supabase → common → 이 파일.

buildChrome('find');

const KINDS = [
  { key: 'work',  icon: '🖼', label: '작품' },
  { key: 'post',  icon: '📔', label: '일기' },
  { key: 'honor', icon: '🏅', label: '자랑' },
  { key: 'trip',  icon: '🧭', label: '나들이' },
  { key: 'place', icon: '📍', label: '장소' },
];
const KIND_OF = {};
KINDS.forEach(k => { KIND_OF[k.key] = k; });

const PAGE = 30;
let ITEMS = [], kind = 'all', shown = PAGE, failedTables = [], ready = false;

// ---------- 글자 다듬기 ----------
// 맥에서 올린 제목은 자모가 풀린 NFD 일 수 있다 — 눈에는 같아도 비교가 어긋난다. 양쪽을 NFC 로 모은다.
const fold = s => String(s == null ? '' : s).normalize('NFC').toLowerCase();
// 일기 본문의 서식 글자를 걷는다. 찾기와 미리보기에는 글자만 있으면 된다.
const plain = s => String(s == null ? '' : s)
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')            // 사진
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')          // 링크는 글자만
  .replace(/^[#>|\-*\s]+/gm, ' ')
  .replace(/[*~=`|]/g, '')
  .replace(/\s+/g, ' ').trim();

// 찾은 말에 색을 입힌다. 조각마다 escapeHTML 을 거치므로 자료의 글자가 태그가 될 수 없다.
function marked(text, terms){
  const src = String(text == null ? '' : text).normalize('NFC');
  const low = src.toLowerCase();
  const hits = [];
  terms.forEach(t => {
    for (let at = low.indexOf(t); at >= 0; at = low.indexOf(t, at + t.length)) hits.push([at, at + t.length]);
  });
  if (!hits.length) return escapeHTML(src);
  hits.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  hits.forEach(([a, b]) => {
    if (a < pos) { if (b <= pos) return; a = pos; }   // 겹친 자리는 이어 붙인다
    out += escapeHTML(src.slice(pos, a)) + '<mark>' + escapeHTML(src.slice(a, b)) + '</mark>';
    pos = b;
  });
  return out + escapeHTML(src.slice(pos));
}

// 긴 글에서 찾은 말 둘레만 잘라 보여 준다
function snippet(text, terms){
  const src = String(text || '').normalize('NFC');
  if (src.length <= 90) return src;
  const low = src.toLowerCase();
  let at = -1;
  terms.forEach(t => { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; });
  if (at < 0) return src.slice(0, 90) + '…';
  const from = Math.max(0, at - 30);
  return (from ? '…' : '') + src.slice(from, from + 90) + (from + 90 < src.length ? '…' : '');
}

// ---------- 불러오기 ----------
async function loadAll(){
  const ask = (table, cols, f) => {
    let q = sb.from(table).select(cols);
    if (f) q = f(q);
    return q.then(r => { if (r.error) { failedTables.push(table); return []; } return r.data || []; },
                  () => { failedTables.push(table); return []; });
  };
  const [works, posts, honors, metas, stops, places] = await Promise.all([
    ask('works',  'id, title, quote, author, made_on, created_at, thumb_url, media_type', q => q.eq('status', 'published')),
    ask('posts',  'id, title, body, place, author, happened_on, created_at, thumb_url', q => q.eq('status', 'published')),
    ask('honors', 'id, who, title, org, track, got_on, thumb_url, say_sua, say_yona'),
    ask('event_meta', 'event_id, icon, org_name, event_name, start_date'),
    ask('events', 'event_id, title, detail, place_name, location_name, thumb_url'),
    ask('places', 'id, name, category, address, memo, review, status, visited_on, thumb_url, created_at'),
  ]);

  const items = [];
  const who = k => (k === 'both' ? '수아·연아' : k === 'family' ? '가족' : k ? heroName(k) : '');
  works.forEach(w => items.push({
    kind: 'work', title: w.title || '제목 없는 작품', body: w.quote || '', who: who(w.author),
    date: w.made_on || String(w.created_at || '').slice(0, 10), thumb: w.thumb_url,
    icon: w.media_type === 'youtube' ? '🎬' : '🖼', href: '/portfolio.html?work=' + encodeURIComponent(w.id),
  }));
  posts.forEach(p => items.push({
    kind: 'post', title: p.title || '제목 없는 일기', body: [p.place, plain(p.body)].filter(Boolean).join(' · '), who: who(p.author),
    date: p.happened_on || String(p.created_at || '').slice(0, 10), thumb: p.thumb_url,
    icon: '📔', href: '/board.html#post-' + encodeURIComponent(p.id),
  }));
  honors.forEach(h => items.push({
    kind: 'honor', title: h.title || '자랑', body: [h.org, h.track, h.say_sua, h.say_yona].filter(Boolean).join(' · '), who: who(h.who),
    date: h.got_on || '', thumb: h.thumb_url, icon: '🏅', href: '/honors.html?item=' + encodeURIComponent(h.id),
  }));
  // 나들이는 이름 한 줄 + 그 안의 일정들을 한 덩어리로 찾는다. 일정마다 줄을 내면 같은 나들이가 열 줄씩 나온다.
  const stopText = {}, stopThumb = {};
  stops.forEach(s => {
    const id = s.event_id; if (!id) return;
    (stopText[id] = stopText[id] || []).push([s.title, s.place_name, s.location_name, plain(s.detail)].filter(Boolean).join(' '));
    if (!stopThumb[id] && s.thumb_url) stopThumb[id] = s.thumb_url;
  });
  metas.forEach(m => items.push({
    kind: 'trip', title: [m.org_name, m.event_name].filter(Boolean).join(' · ') || m.event_id,
    body: (stopText[m.event_id] || []).join(' / '), who: '',
    date: m.start_date || '', thumb: stopThumb[m.event_id], icon: m.icon || '🧭',
    href: '/event/e/?slug=' + encodeURIComponent(m.event_id),
  }));
  places.forEach(p => items.push({
    kind: 'place', title: p.name || '이름 없는 곳',
    body: [p.category, p.address, p.memo, p.review].filter(Boolean).join(' · '),
    who: p.status === 'done' ? '가본 곳' : '가보고 싶은 곳',
    date: p.visited_on || '', thumb: p.thumb_url, icon: '📍',
    href: '/event/#' + (p.status === 'done' ? 'done' : 'want'),
  }));

  items.forEach(it => { it.fTitle = fold(it.title); it.fAll = fold([it.title, it.body, it.who, it.date].join(' ')); });
  // 날짜가 있는 것이 위로, 그 안에서는 최근 것이 위로
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  ITEMS = items;
  return metas;
}

// ---------- 찾기 ----------
function termsOf(q){ return fold(q).split(/\s+/).filter(Boolean).slice(0, 5); }

function search(terms){
  if (!terms.length) return [];
  // 적은 말이 전부 들어 있어야 한다(AND). 제목에 걸린 것이 본문에만 걸린 것보다 위.
  const hit = ITEMS.filter(it => terms.every(t => it.fAll.indexOf(t) >= 0));
  const score = it => terms.reduce((n, t) => n + (it.fTitle.indexOf(t) >= 0 ? 1 : 0), 0);
  return hit.map((it, i) => ({ it, s: score(it), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.it);
}

function rowHTML(it, terms){
  const K = KIND_OF[it.kind];
  const thumb = it.thumb
    ? '<img alt="" loading="lazy" decoding="async" src="' + escapeHTML(it.thumb) + '">'
    : escapeHTML(it.icon);
  const snip = snippet(it.body, terms);
  return '<li><a class="find-row dot-card" href="' + escapeHTML(it.href) + '">' +
    '<span class="find-thumb" aria-hidden="true">' + thumb + '</span>' +
    '<span class="find-main">' +
      '<span class="find-meta"><span class="k">' + K.icon + ' ' + K.label + '</span>' +
        (it.who ? '<span>' + marked(it.who, terms) + '</span>' : '') +
        (it.date ? '<span>' + escapeHTML(formatDate(it.date + 'T00:00:00') || it.date) + '</span>' : '') + '</span>' +
      '<span class="find-title">' + marked(it.title, terms) + '</span>' +
      (snip ? '<span class="find-snip">' + marked(snip, terms) + '</span>' : '') +
    '</span></a></li>';
}

function paintKinds(all){
  const n = {};
  all.forEach(it => { n[it.kind] = (n[it.kind] || 0) + 1; });
  const btn = (key, label, count) =>
    '<button type="button" data-kind="' + key + '" aria-pressed="' + (kind === key) + '"' +
    (count ? '' : ' disabled') + '>' + label + ' ' + count + '</button>';
  $('#kinds').innerHTML = btn('all', '전체', all.length) +
    KINDS.map(k => btn(k.key, k.icon + ' ' + k.label, n[k.key] || 0)).join('');
}

function run(){
  if (!ready) return;
  const q = $('#q').value.trim();
  const terms = termsOf(q);
  const note = $('#note'), list = $('#list'), more = $('#more');
  note.className = 'find-note';
  const warn = failedTables.length ? ' · 일부(' + failedTables.length + '가지)는 불러오지 못했어요' : '';

  // 주소에 찾은 말을 남겨 둔다 — 뒤로 가기로 돌아오면 그대로 있고, 찾은 결과를 가족에게 보낼 수 있다.
  try { history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : location.pathname); } catch (e) { /* 주소를 못 바꿔도 찾기는 된다 */ }

  if (!terms.length) {
    $('#kinds').innerHTML = ''; list.innerHTML = ''; more.hidden = true;
    note.textContent = '기록 ' + ITEMS.length + '개에서 찾아요' + warn;
    $('#tryBox').hidden = !$('#tryBox').children.length;
    return;
  }
  $('#tryBox').hidden = true;
  const all = search(terms);
  if (kind !== 'all' && !all.some(it => it.kind === kind)) kind = 'all';
  if (all.length) paintKinds(all); else $('#kinds').innerHTML = '';
  const hits = kind === 'all' ? all : all.filter(it => it.kind === kind);
  note.textContent = all.length
    ? '「' + q + '」 ' + all.length + '개를 찾았어요' + warn
    : '「' + q + '」에 맞는 기록이 없어요 — 말을 줄이거나 띄어 써 보세요' + warn;
  if (failedTables.length && !all.length) note.className = 'find-note err';
  list.innerHTML = hits.slice(0, shown).map(it => rowHTML(it, terms)).join('');
  more.hidden = hits.length <= shown;
  if (!more.hidden) more.textContent = '더 보기 (' + (hits.length - shown) + '개 남음)';
}

// ---------- 귀 달기 ----------
let timer = 0;
$('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { shown = PAGE; run(); }, 120); });
$('#findForm').addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); shown = PAGE; run(); $('#q').blur(); });
$('#kinds').addEventListener('click', e => {
  const b = e.target.closest('button[data-kind]'); if (!b || b.disabled) return;
  kind = b.dataset.kind; shown = PAGE; run();
});
$('#more').addEventListener('click', () => { shown += PAGE; run(); });
$('#tryBox').addEventListener('click', e => {
  const b = e.target.closest('button[data-try]'); if (!b) return;
  $('#q').value = b.dataset.try; shown = PAGE; run();
});

// 로그인 상태가 바뀌면 보이는 것이 달라진다(비공개 글) — 다시 받아 온다.
async function boot(){
  failedTables = [];
  const metas = await loadAll();
  ready = true;
  // 뭘 찾을지 막막한 사람에게 — 최근 나들이 이름 몇 개를 단추로 내민다.
  const tries = metas.filter(m => m.event_name).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
    .slice(0, 6).map(m => m.event_name);
  $('#tryBox').innerHTML = tries.map(t => '<button type="button" data-try="' + escapeHTML(t) + '">' + escapeHTML(t) + '</button>').join('');
  if (failedTables.length === 6) {
    $('#note').className = 'find-note err';
    $('#note').textContent = '기록을 불러오지 못했어요 — 인터넷을 확인하고 새로 고쳐 주세요';
    return;
  }
  run();
}

(async () => {
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) $('#q').value = q0.slice(0, 40);
  try { await refreshAuth(); } catch (e) { /* 손님으로 본다 */ }
  await boot();
  if (!q0) $('#q').focus({ preventScroll: true });
})();
document.addEventListener('suayona:auth', () => { if (ready) boot(); });
