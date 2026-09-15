// settings.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('settings');

const KID_LIST = ['sua', 'yona'].map(k => ({ k, n: HERO_NAMES[k] }));   // 정본은 common.js
const LIMIT = 100;                    // 묶음마다 최근 100개까지만 그린다

// ---------- 문 ----------
function showGate(){
  const gate = $('#gate');
  gate.innerHTML = '';
  if (isAdmin) { $('#app').hidden = false; return true; }
  $('#app').hidden = true;
  if (isLoggedIn) {
    gate.innerHTML = '<p class="why">이 쪽은 부모만 열 수 있어요.</p>';
    revealNow(gate);
    return false;
  }
  gate.innerHTML = '<p class="why">무엇이 공개인지 한눈에 보이는 쪽이라<br>' +
    '부모만 볼 수 있게 잠가 두었습니다.</p>';
  mountLoginBox(gate, reboot);
  revealNow(gate);
  return false;
}

async function reboot(){
  await refreshAuth();
  if (showGate()) await load();
}

// ---------- 생일 ----------
let born = {};

function renderBorn(){
  $('#bornRows').innerHTML = KID_LIST.map(x =>
    '<div class="born-row"><b>' + x.n + '</b>' +
    '<input type="date" id="b-' + x.k + '" aria-label="' + x.n + ' 생일" value="' + escapeHTML(born[x.k] || '') + '">' +
    '<span class="age" id="ba-' + x.k + '">' + escapeHTML(born[x.k] ? '지금 ' + ageLabel(born[x.k]) : '') + '</span>' +
    '</div>').join('');
  KID_LIST.forEach(x => {
    $('#b-' + x.k).addEventListener('input', (e) => {
      const v = e.target.value;
      $('#ba-' + x.k).textContent = v ? '지금 ' + ageLabel(v) : '';
    });
  });
}

async function saveBorn(){
  const msg = $('#bornMsg'), btn = $('#bornSave');
  msg.className = 'set-msg'; msg.textContent = '저장 중…';
  btn.disabled = true;
  const rows = KID_LIST
    .map(x => ({ author_key: x.k, born_on: $('#b-' + x.k).value || null, updated_at: new Date().toISOString() }))
    .filter(r => r.born_on);
  if (!rows.length) {
    btn.disabled = false;
    msg.className = 'set-msg err'; msg.textContent = '생일을 하나는 적어 주세요.';
    return;
  }
  const { error } = await sb.from('kids').upsert(rows, { onConflict: 'author_key' });
  btn.disabled = false;
  if (error) { msg.className = 'set-msg err'; msg.textContent = '안 됐어요: ' + error.message; return; }
  rows.forEach(r => { born[r.author_key] = r.born_on; });
  msg.textContent = '저장했어요. 이제 작품에 그때 나이가 붙어요.';
}

// ---------- 공개 여부 ----------
// 세 곳에 흩어져 있던 것을 한 줄씩 같은 모양으로 늘어놓는다.
// 표마다 열쇠 칸 이름이 달라서(id / event_id) 무엇으로 찾을지도 같이 들고 다닌다.
let groups = [];

function isPub(v){ return v !== false; }      // 비어 있으면 공개로 친다(서버 규칙과 같음)

function renderVis(){
  let pub = 0, pri = 0;
  groups.forEach(g => g.rows.forEach(r => { isPub(r.is_public) ? pub++ : pri++; }));
  $('#visSum').innerHTML =
    '<span class="pub">🌏 공개 ' + pub + '</span>' +
    '<span class="pri">🔒 비공개 ' + pri + '</span>';

  $('#visList').innerHTML = groups.map(g =>
    '<div class="vis-group"><h4>' + escapeHTML(g.title) + ' (' + g.rows.length + ')</h4>' +
    (g.rows.length
      ? g.rows.map(r => {
          const on = isPub(r.is_public);
          return '<div class="vis-row">' +
            '<span class="vis-main"><span class="t">' + escapeHTML(g.label(r)) + '</span>' +
            '<span class="d">' + escapeHTML(g.sub(r)) + '</span></span>' +
            '<button type="button" class="vis-btn ' + (on ? 'pub' : 'pri') + '"' +
            ' data-g="' + escapeHTML(g.key) + '" data-id="' + escapeHTML(String(r[g.pk])) + '">' +
            (on ? '🌏 공개' : '🔒 비공개') + '</button></div>';
        }).join('')
      : '<p class="vis-more">아직 없어요.</p>') +
    (g.more ? '<p class="vis-more">최근 ' + LIMIT + '개만 보여요.</p>' : '') +
    '</div>').join('');

  $('#visList').querySelectorAll('.vis-btn').forEach(b => b.addEventListener('click', flip));
}

async function flip(e){
  const btn = e.currentTarget;
  const g = groups.find(x => x.key === btn.dataset.g);
  if (!g) return;
  const row = g.rows.find(r => String(r[g.pk]) === btn.dataset.id);
  if (!row) return;
  const next = !isPub(row.is_public);
  btn.disabled = true;
  const msg = $('#visMsg'); msg.className = 'set-msg'; msg.textContent = '바꾸는 중…';
  // 고친 줄을 돌려받는다. 규칙에 걸려 한 줄도 안 바뀌면 PostgREST 는 오류가 아니라
  // 「0줄 고침」으로 조용히 끝나서, 예전 코드는 바뀌지도 않은 것을 바꿨다고 말했다.
  const { data, error } = await sb.from(g.table)
    .update({ is_public: next }).eq(g.pk, row[g.pk]).select(g.pk);
  btn.disabled = false;
  if (error) { msg.className = 'set-msg err'; msg.textContent = '안 됐어요: ' + error.message; return; }
  if (!data || !data.length) {
    msg.className = 'set-msg err';
    msg.textContent = '바꾸지 못했어요. 부모로 로그인했는지 확인해 주세요.';
    return;
  }
  row.is_public = next;
  msg.textContent = (next ? '공개로 바꿨어요.' : '비공개로 바꿨어요.');
  renderVis();
  sfx('pop');
}

async function load(){
  // 네 곳을 한꺼번에 물어본다 — 차례로 기다리면 문 열고 네 번을 왕복한다.
  const [k, p, ev, w] = await Promise.all([
    sb.from('kids').select('author_key, born_on'),
    sb.from('posts').select('id, title, author, happened_on, created_at, is_public, status')
      .order('created_at', { ascending: false }).limit(LIMIT + 1),
    sb.from('event_meta').select('event_id, event_name, org_name, start_date, is_public')
      .order('start_date', { ascending: false, nullsFirst: false }).limit(LIMIT + 1),
    sb.from('works').select('id, title, author, made_on, is_public')
      .order('made_on', { ascending: false, nullsFirst: false }).limit(LIMIT + 1),
  ]);

  born = {};
  (k.data || []).forEach(r => { born[r.author_key] = r.born_on; });
  renderBorn();

  const cut = list => ({ rows: (list || []).slice(0, LIMIT), more: (list || []).length > LIMIT });
  const P = cut(p.data), E = cut(ev.data), W = cut(w.data);
  const who = Object.assign({}, HERO_NAMES, { together:'같이' });

  groups = [
    { key:'posts', table:'posts', pk:'id', title:'📓 일기', rows:P.rows, more:P.more,
      label: r => r.title || '(제목 없음)',
      sub: r => [who[r.author] || '', formatDate(r.happened_on || r.created_at),
                 r.status === 'pending' ? '확인 기다림' : ''].filter(Boolean).join(' · ') },
    { key:'events', table:'event_meta', pk:'event_id', title:'📅 이벤트', rows:E.rows, more:E.more,
      label: r => r.event_name || r.event_id,
      sub: r => [r.org_name || '', r.start_date ? formatDate(r.start_date) : ''].filter(Boolean).join(' · ') },
    { key:'works', table:'works', pk:'id', title:'🎨 작품', rows:W.rows, more:W.more,
      label: r => r.title || '(제목 없음)',
      sub: r => [who[r.author] || '', r.made_on ? formatDate(r.made_on) : '',
                 ageAt(r.author, r.made_on)].filter(Boolean).join(' · ') },
  ];
  kidsBorn = born;                 // 「그때 몇 살」이 이 값을 읽는다
  renderVis();
  initReveal();
}

$('#bornSave').addEventListener('click', saveBorn);

// 부모가 놓치는 것들. 개수만 서버에서 받아 온다 — 알맹이는 각 페이지에서 본다.
// 자매 우체통은 세지 않는다. 아이들끼리의 자리라 부모에게 열지 않기로 했다.
const DIGEST_ROWS = [
  // 아이가 손으로 쓴 일기는 바로 실린다(2026-09-07). 여기 세어지는 것은 모험 일지처럼
  // 저절로 남은 초안뿐이라, 「아이가 쓴 일기」라고 부르면 부모가 헷갈린다.
  { k:'posts',    icon:'📖', label:'확인을 기다리는 일기 초안',   href:'/board.html',     unit:'편' },
  { k:'works',    icon:'🖼', label:'아이가 낸 그림이 기다려요',   href:'/portfolio.html', unit:'점' },
  { k:'capsules', icon:'⏳', label:'오늘 열리는 1년 편지가 있어요', href:'/#capsule',       unit:'통' },
];
async function renderDigest(){
  const { data, error } = await sb.rpc('parent_digest');
  if (error || !data) return;
  const 있는것 = DIGEST_ROWS.filter(r => (data[r.k] || 0) > 0);
  if (!있는것.length) return;
  $('#digest').innerHTML = 있는것.map(r =>
    '<a class="dg-row" href="' + r.href + '">' +
      '<span class="dg-ico">' + r.icon + '</span>' +
      '<span class="dg-txt">' + r.label + '</span>' +
      '<span class="dg-n">' + data[r.k] + r.unit + '</span>' +
    '</a>').join('');
  $('#digestCard').hidden = false;
}

// ---------- 사진 속 찍은 곳 ----------
// 2026-09-15 점검: 공개 작품 사진 23장 중 11장이 같은 좌표 한 점을 달고 있었다(원본을 그대로 올리던 규칙).
// 새로 올리는 사진은 compressImage 가 지우고, 이미 올라간 것은 부모가 여기서 한 번 누른다.
// 좌표 칸 50바이트 남짓만 0 으로 덮으므로(scrubGpsBytes) 파일 길이·그림 바이트가 그대로다.
const PHOTO_COLS = [
  ['works', 'media_url'], ['posts', 'image_url', 'extra_images'], ['events', 'image_url', 'extra_images'],
  ['gallery_media', 'media_url'], ['places', 'photo_url'], ['honors', 'photo_url'],
];
function storageSpot(url){
  const m = /\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/.exec(url || '');
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}
async function photoUrls(){
  const got = await Promise.all(PHOTO_COLS.map(([t, ...cols]) => sb.from(t).select(cols.join(', '))));
  const set = new Set();
  got.forEach(({ data, error }, i) => {
    if (error) throw error;
    (data || []).forEach(r => PHOTO_COLS[i].slice(1).forEach(c => {
      const v = r[c];
      (Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : x && x.url) : [v])
        .forEach(u => { if (storageSpot(u)) set.add(u); });
    }));
  });
  return [...set];
}
// dryRun 이면 올리지 않고 좌표 든 사진을 세기만 한다(점검용 — 콘솔에서 wipePhotoGps(true)).
async function wipePhotoGps(dryRun){
  const msg = $('#gpsMsg'), btn = $('#gpsWipe');
  msg.className = 'set-msg'; btn.disabled = true;
  let urls = [], found = 0, done = 0, failed = 0;
  try {
    urls = await photoUrls();
    for (let i = 0; i < urls.length; i++){
      msg.textContent = '살펴보는 중 ' + (i + 1) + ' / ' + urls.length;
      try {
        // 좌표는 파일 앞머리(Exif, 64KB 이하)에 있다 — 앞 128KB 만 받아 보고 있을 때만 통째로 받는다
        const head = await fetch(urls[i], { headers: { Range: 'bytes=0-131071' } });
        if (!head.ok || !scrubGpsBytes(new Uint8Array(await head.arrayBuffer())).located) continue;   // 값이 0 인 빈 칸은 두어도 된다
        found++;
        if (dryRun) continue;
        const res = await fetch(urls[i], { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const bytes = new Uint8Array(await res.arrayBuffer()), n = bytes.length;
        const r = scrubGpsBytes(bytes);
        // 길이가 그대로이고, 다시 훑었을 때 좌표가 하나도 안 나와야 올린다
        if (!r.located || r.bytes.length !== n || scrubGpsBytes(r.bytes.slice()).wiped) throw new Error('지운 결과가 이상해요');
        const spot = storageSpot(urls[i]);
        const { error } = await sb.storage.from(spot.bucket)
          .update(spot.path, new Blob([r.bytes], { type: 'image/jpeg' }), { contentType: 'image/jpeg', cacheControl: '3600' });
        if (error) throw error;
        done++;
      } catch (e) { failed++; console.warn('좌표 지우기 실패', urls[i], e); }
    }
  } catch (e) {
    msg.className = 'set-msg err'; msg.textContent = '사진 목록을 못 읽었어요: ' + readableError(e);
    btn.disabled = false;
    return { urls: urls.length, found, done, failed };
  }
  btn.disabled = false;
  msg.textContent = !found ? '좌표가 든 사진이 없어요 (' + urls.length + '장 살펴봄)'
    : dryRun ? '좌표가 든 사진 ' + found + '장 (' + urls.length + '장 중)'
    : '좌표를 지운 사진 ' + done + '장' + (failed ? ' · 못 한 것 ' + failed + '장 — 다시 눌러 주세요' : '') +
      ' · 공개 주소에는 한 시간 안에 반영돼요';
  if (failed) msg.className = 'set-msg err';
  return { urls: urls.length, found, done, failed };
}
$('#gpsWipe').addEventListener('click', () => {
  if (!confirm('올라가 있는 사진에서 찍은 곳 좌표만 지웁니다. 그림은 바뀌지 않아요. 할까요?')) return;
  wipePhotoGps(false);
});

(async () => {
  await refreshAuth();
  if (showGate()) { await load(); await renderDigest(); }
  initReveal();
})();
