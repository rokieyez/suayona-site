// 「나들이」(event/index.html)의 앞쪽 짝 — 나들이 기록(이벤트) 목록과 만들기·지우기.
// 2026-09-18 이벤트 목록과 가볼 곳을 한 쪽으로 합치면서 event-index.js 에서 이름을 바꿨다.
// 파일 이름을 바꾼 까닭: 새 HTML 이 캐시에 남은 옛 스크립트와 섞여 돌지 않게 하려고.
// 싣는 순서 — supabase → compress → pixel → common → 이 파일 → outing-places.js.
// 머리말·배경·지도·탭·첫 실행은 전부 뒤쪽 짝(outing-places.js)이 맡는다. 여기서는
// 함수만 내놓고 스스로 돌지 않는다.

/* =========================================================================
   레거시 이벤트(전용 폴더+파일로 만들어진 것) — 새 이벤트는 여기 추가할 필요 없음.
   "+ 새 이벤트 만들기"로 만든 이벤트는 자동으로 Supabase에서 불러와 아래 목록에 합쳐짐.
   ========================================================================= */
const WEEKDAY = ['일','월','화','수','목','금','토'];
const EVENTS = [];
/* ========================================================================= */

function formatDateRangeText(s, e){
  const f = d => (d[1]+1) + '. ' + d[2] + '(' + WEEKDAY[new Date(d[0],d[1],d[2]).getDay()] + ')';
  return s[0] + '. ' + f(s) + ' ~ ' + f(e);
}
// isoToDateKey 는 common.js 에 있다 (행사 세 쪽이 똑같은 것을 갖고 있었다).

function getStatus(ev){
  const now = new Date();
  const start = new Date(...ev.startDate);
  const end = new Date(ev.endDate[0], ev.endDate[1], ev.endDate[2], 23, 59, 59);
  if (now < start) return 'upcoming';
  if (now <= end) return 'ongoing';
  return 'done';
}

/* 카드 표지 — 그 나들이의 사진 한 장(부모 요청 2026-09-18).
   일정에 붙여 둔 사진이 첫째고(지도 핀과 같은 것이라 새로 받는 것이 없다), 일정 사진이
   하나도 없는 나들이(사진만 골라 만든 것)는 갤러리의 첫 사진으로 물러선다. 그것도 없으면
   이벤트 아이콘. 파일이 사라졌으면 깨진 그림 대신 아이콘으로 돌아간다. */
let TRIP_COVERS = {};
async function loadTripCovers(events){
  TRIP_COVERS = {};
  EVENT_ROWS.forEach(r => {
    const u = r.thumb_url || r.image_url;
    if (u && !TRIP_COVERS[r.event_id]) TRIP_COVERS[r.event_id] = u;
  });
  const bare = events.map(e => e.slug).filter(sl => !TRIP_COVERS[sl]);
  if (!bare.length) return;
  const { data, error } = await sb.from('gallery_media')
    .select('event_id, thumb_url, media_url')
    .in('event_id', bare).eq('media_type', 'image')
    .order('created_at', {ascending:true}).limit(60);
  if (error) { console.warn('표지 사진을 못 읽었습니다:', error.message); return; }
  (data || []).forEach(r => {
    const u = r.thumb_url || r.media_url;
    if (u && !TRIP_COVERS[r.event_id]) TRIP_COVERS[r.event_id] = u;
  });
}
function coverHTML(ev){
  const src = TRIP_COVERS[ev.slug];
  const icon = escapeHTML(ev.icon || '🗓️');
  return src
    ? '<img alt="" src="' + escapeHTML(src) + '" data-icon="' + icon + '">'
    : icon;
}
// 깨진 사진은 아이콘으로. error 는 거품처럼 올라오지 않아서 잡는 쪽(capture)에서 듣는다.
document.addEventListener('error', (e) => {
  const im = e.target;
  if (im && im.tagName === 'IMG' && im.parentNode && im.parentNode.classList.contains('card-cover'))
    im.parentNode.textContent = im.dataset.icon || '🗓️';
}, true);

function tripCardHTML(ev, status){
  // 이름·기간은 부모가 적는 값이지만 「<」 하나로 손님 쪽 카드가 깨지므로 글자로만 넣는다.
  const slugAttr = escapeHTML(ev.slug);
  const badgeText = status === 'ongoing' ? '진행중' : status === 'upcoming' ? '예정' : '종료';
  const adminBtns = (isAdmin && ev.isRegistry)
    ? '<button class="card-lock" data-slug="' + slugAttr + '" title="' +
        (ev.isPublic ? '공개 상태 — 눌러서 비공개로' : '비공개 상태 — 눌러서 공개로') + '">' +
        (ev.isPublic ? '🌏' : '🔒') + '</button>' +
      '<button class="card-del" data-slug="' + slugAttr + '" title="나들이 삭제">🗑</button>'
    : '';
  const privateTag = (isAdmin && ev.isRegistry && !ev.isPublic)
    ? '<span class="badge private">🔒 비공개</span>' : '';
  // 사진만 골라 만든 뒤 아직 이름을 안 지은 이벤트
  const needsName = isAdmin && ev.isRegistry
    && ev.orgName === QUICK_ORG && ev.eventName === QUICK_EVENT;
  const todo = needsName
    ? '<a class="card-todo" href="/event/e/admin.html?slug=' + encodeURIComponent(ev.slug) + '">✏️ 이름을 지어주세요</a>'
    : '';
  // 이 나들이에 이어 둔 장소가 몇 곳인지 (장소 쪽 표에서 센다)
  const linked = PLACES.filter(p => p.event_id === ev.slug).length;
  // 지금 열려 있는 이벤트는 테두리를 코랄로 둘러 한눈에 갈라 보이게 한다
  return '<div class="card' + (status === 'ongoing' ? ' is-now' : '') +
    (ev.isPublic === false ? ' is-private' : '') + (adminBtns ? ' has-admin' : '') + '" data-slug="' + slugAttr + '">' +
    '<a class="card-link" href="' + escapeHTML(ev.href) + '">' +
    '<span class="card-cover">' + coverHTML(ev) + '</span>' +
    '<div class="card-text">' +
    '<div class="card-top"><span class="card-name">' + escapeHTML(ev.orgName) + ' · ' + escapeHTML(ev.eventName) + '</span>' +
    '<span class="badge-group">' + privateTag +
    '<span class="badge ' + status + '">' + badgeText + '</span></span></div>' +
    '<div class="card-sub">' + escapeHTML(ev.dateRangeText) +
      (linked ? ' · 📍 장소 ' + linked + '곳' : '') + '</div></div></a>' +
    todo + adminBtns + '</div>';
}

async function fetchRegistryEvents(){
  const legacySlugs = new Set(EVENTS.map(e => e.slug));
  // 비공개 이벤트는 로그인한 사람에게만 (서버 정책에서도 한 번 더 막혀 있음)
  let q = sb.from('event_meta').select('*').not('start_date', 'is', null).not('end_date', 'is', null);
  if (!isAdmin) q = q.eq('is_public', true);
  const { data, error } = await q;
  // 못 읽은 것을 「없다」로 보여 주면 안 된다 — 표시를 남겨 빈 자리 문구가 바뀌게 한다.
  window.outingTripsFailed = !!error;
  if (error) { console.error('이벤트 목록 로딩 오류:', error); return []; }
  const rows = data.filter(r => !legacySlugs.has(r.event_id));

  /* 기간 밖 날짜(하루 일찍 내려간 날 같은 것)에 적어 둔 일정이 있는지 본다.
     있으면 카드의 기간을 그만큼 넓힌다 — 적어 뒀는데 카드에 안 나오면 빠뜨린 줄 안다.
     한 번에 물어 온다(행사 수만큼 묻지 않는다). 못 읽어도 예전 글자로 그냥 간다. */
  const withRows = {};
  const slugs = rows.map(r => r.event_id);
  if (slugs.length) {
    // 지도 핀에 쓸 장소·사진도 이 한 번에 같이 받는다. 전에는 같은 표를 같은 주소들로 두 번
    // 물었다(panel 한 번, 좌표 한 번) — 재 보니 192B + 2,293B 가 2,696B 한 번이 되고 왕복이 하나 준다.
    const { data: pr, error: prErr } = await sb.from('events')
      .select('event_id, panel, place_name, place_lat, place_lng, thumb_url, image_url')
      .in('event_id', slugs)
      .order('panel', {ascending:true}).order('sort_order', {ascending:true});
    if (prErr) console.error('일정 로딩 오류:', prErr);
    EVENT_ROWS = pr || [];
    EVENT_ROWS.forEach(x => {
      (withRows[x.event_id] = withRows[x.event_id] || new Set()).add(x.panel);
    });
  }

  return rows
    .map(r => {
      const startDate = isoToDateKey(r.start_date), endDate = isoToDateKey(r.end_date);
      const eff = shownRange(startDate, endDate, withRows[r.event_id]);
      return {
        slug: r.event_id,
        orgName: r.org_name || r.event_id,
        eventName: r.event_name || '',
        // 넓어졌으면 새로 짓고, 아니면 적혀 있던 글자를 그대로 쓴다
        dateRangeText: eff.changed
          ? formatDateRangeText(eff.startDate, eff.endDate)
          : (r.date_range_text || formatDateRangeText(startDate, endDate)),
        startDate: eff.startDate, endDate: eff.endDate,
        icon: r.icon || '📍',
        href: '/event/e/?slug=' + encodeURIComponent(r.event_id),
        isRegistry: true,
        isPublic: r.is_public !== false,
      };
    });
}

// 탭을 바꿀 때마다 다시 그리지만, 서버에는 바뀐 것이 있을 때만(force) 다시 묻는다.
let TRIPS_CACHE = null;
async function renderEvents(force){
  const currentList = $('#current-list');
  const pastList = $('#past-list');
  const current = [], past = [];

  const fresh = force || !TRIPS_CACHE;
  if (fresh) { TRIPS_CACHE = [...EVENTS, ...(await fetchRegistryEvents())]; await loadTripCovers(TRIPS_CACHE); }
  const allEvents = TRIPS_CACHE;

  allEvents.forEach(ev => {
    const status = getStatus(ev);
    (status === 'done' ? past : current).push({ev, status});
  });

  current.sort((a,b) => new Date(...a.ev.startDate) - new Date(...b.ev.startDate));
  past.sort((a,b) => new Date(...b.ev.endDate) - new Date(...a.ev.endDate));

  TRIP_COUNT = allEvents.length;
  // 「전체」에서는 진행중·예정이 없으면 그 칸을 통째로 접는다 — 빈 안내가 장소 목록을 밀어낸다.
  const brief = currentTab() === 'all';
  const failed = !!window.outingTripsFailed;
  $('#current-section').style.display = (brief && !current.length && !failed) ? 'none' : 'block';
  currentList.innerHTML = current.length ? current.map(c => tripCardHTML(c.ev, c.status)).join('')
    : '<div class="empty" role="status">' + (failed ? '나들이를 불러오지 못했어요 — 인터넷을 확인하고 새로 고쳐 주세요' : '진행중이거나 예정된 나들이가 없습니다') + '</div>';
  $('#past-section').style.display = past.length ? 'block' : 'none';
  // 지난 기록은 여섯 장까지만 먼저 보이고, 나머지는 단추를 눌러 여섯 장씩 더 편다(부모 요청).
  // 「전체」와 「나들이 기록」 어느 탭에서나 같다.
  const few = past.slice(0, tripsShown);
  pastList.innerHTML = few.map(c => tripCardHTML(c.ev, c.status)).join('');
  const more = $('#tripsMore');
  const left = past.length - few.length;
  more.hidden = left <= 0;
  if (left > 0) more.textContent = '지난 나들이 더 보기 (' + left + '개 남음)';

  // 목록을 다 그린 뒤에 지도 핀을 챙긴다 — 지도가 늦어도 목록은 먼저 보이도록.
  if (fresh) loadTripPins(allEvents);
}

/* =========================================================================
   나들이 사진 핀
   ------------------------------------------------------------------------
   핀은 일정에 적어 둔 장소(events.place_lat/place_lng)에서 온다.
   사진의 위치정보로는 못 만든다 — 올라와 있는 사진 중 좌표가 남은 것이 없다.
   그래서 관리 화면에서 장소를 적은 일정이 하나도 없는 나들이는 사진 핀이 안 나온다.
   ========================================================================= */
// 목록에 실제로 보이는 이벤트의 일정만 들어 있다(fetchRegistryEvents 가 그 주소들로만 묻는다) —
// 비공개 이벤트의 위치가 로그인 안 한 사람의 지도에 찍히면 안 되므로.
let EVENT_ROWS = [];
function eventPlaces(){
  const byEvent = {};
  EVENT_ROWS.forEach(r => {
    if (!Number.isFinite(r.place_lat) || !Number.isFinite(r.place_lng)) return;
    (byEvent[r.event_id] = byEvent[r.event_id] || []).push(r);
  });
  return byEvent;
}

/* 나들이 하나에 사진 핀 하나. 지도 자체는 뒤쪽 짝이 그린다 — 여기서는 핀에 쓸 것만 모은다.
   한 나들이에서 다닌 곳들은 서로 몇 km 안이라 전국이 보이는 크기에서는 장소마다 찍으면
   사진이 통째로 포개진다. 그래서 그 자리들의 한가운데에 한 장만 둔다. */
let TRIP_PINS = [];
let TRIP_COUNT = 0;
const TRIPS_PAGE = 6;
let tripsShown = TRIPS_PAGE;
function loadTripPins(events){
  const byEvent = eventPlaces();
  TRIP_PINS = events.filter(e => byEvent[e.slug] && byEvent[e.slug].length).map(ev => {
    const rows = byEvent[ev.slug];
    const names = rows.map(r => r.place_name).filter(Boolean);
    return {
      ev, count: rows.length,
      lat: rows.reduce((a, r) => a + r.place_lat, 0) / rows.length,
      lng: rows.reduce((a, r) => a + r.place_lng, 0) / rows.length,
      // 그 장소에 붙여 둔 사진을 핀으로. 없으면 이벤트 아이콘으로 대신한다.
      shot: rows.map(r => r.thumb_url || r.image_url).find(Boolean) || null,
      // 이름표는 한 줄로. 길어지면 줄이 두 겹이 되어 띠가 들썩인다.
      label: names.slice(0, 2).join(', ') + (names.length > 2 ? ' 외 ' + (names.length - 2) + '곳' : ''),
    };
  });
}

// ----- 이벤트 삭제 (2단계 확인: 🗑 클릭 → 인라인 확인 → 삭제 버튼 클릭) -----
async function deleteEvent(slug){
  // 줄을 먼저 지우고 파일을 나중에 치운다(common.js 의 removeStored 와 같은 순서) — 거꾸로 하면
  // 줄 지우기가 막혔을 때 사진 없는 나들이가 남는다. 단계마다 결과를 본다: 전에는 중간 실패를
  // 버렸고, RLS 에 막힌 delete 는 오류 없이 0줄이라 「지웠다」고 나왔다.
  const must = (res, what) => { if (res.error) throw new Error(what + ': ' + res.error.message); return res; };

  // 이 나들이에 이어 둔 장소·작품은 남기고 끈만 푼다.
  must(await sb.from('places').update({ event_id: null }).eq('event_id', slug), '장소 연결 풀기');
  must(await sb.from('works').update({ event_id: null }).eq('event_id', slug), '작품 연결 풀기');
  must(await sb.from('custom_tabs').delete().eq('event_id', slug), '탭 지우기');
  must(await sb.from('events').delete().eq('event_id', slug), '일정 지우기');
  must(await sb.from('gallery_media').delete().eq('event_id', slug), '사진 줄 지우기');
  const meta = must(await sb.from('event_meta').delete().eq('event_id', slug).select('event_id'), '나들이 지우기');
  if (!meta.data || !meta.data.length) throw new Error('지워지지 않았어요 — 부모 계정인지 확인해 주세요');

  // 파일은 천 개씩 끝까지. 여기서 실패해도 화면은 멀쩡하고, 남은 파일은 작품전시실의 「치우기」가 거둔다.
  for (const bucket of ['event-images', 'gallery-uploads']) {
    for (let round = 0; round < 20; round++) {
      const { data: files, error } = await sb.storage.from(bucket).list(slug, { limit: 1000 });
      if (error) { console.warn('파일 목록 실패:', bucket, error.message); break; }
      const paths = (files || []).filter(f => f.id).map(f => slug + '/' + f.name);
      if (!paths.length) break;
      const rm = await sb.storage.from(bucket).remove(paths);
      if (rm.error) { console.warn('파일 치우기 실패:', bucket, rm.error.message); break; }
    }
  }
}

$('#content').addEventListener('click', async (e) => {
  // 자물쇠 버튼: 공개 <-> 비공개 전환
  const lockBtn = e.target.closest('.card-lock');
  if (lockBtn) {
    e.preventDefault();
    const slug = lockBtn.dataset.slug;
    const nowPublic = lockBtn.textContent.trim() === '🌏';
    lockBtn.disabled = true;
    const { error } = await sb.from('event_meta').update({ is_public: !nowPublic }).eq('event_id', slug);
    lockBtn.disabled = false;
    if (error) { alert('변경 실패: ' + error.message); return; }
    await renderEvents(true); redrawPins();
    return;
  }

  const delBtn = e.target.closest('.card-del');
  if (delBtn) {
    e.preventDefault();
    const card = delBtn.closest('.card');
    if (card.querySelector('.card-confirm')) return;
    const box = document.createElement('div');
    box.className = 'card-confirm';
    box.innerHTML =
      '<p>정말 삭제할까요? 이 나들이의 모든 일정과 사진이 함께 삭제되며 되돌릴 수 없어요.</p>' +
      '<div class="card-confirm-btns">' +
      '<button type="button" class="card-confirm-cancel">취소</button>' +
      '<button type="button" class="card-confirm-ok">삭제</button>' +
      '</div>';
    card.appendChild(box);
    return;
  }

  const cancelBtn = e.target.closest('.card-confirm-cancel');
  if (cancelBtn) {
    e.preventDefault();
    cancelBtn.closest('.card-confirm').remove();
    return;
  }

  const okBtn = e.target.closest('.card-confirm-ok');
  if (okBtn) {
    e.preventDefault();
    const slug = okBtn.closest('.card').dataset.slug;
    okBtn.disabled = true; okBtn.textContent = '삭제 중...';
    try {
      await deleteEvent(slug);
      await renderEvents(true); redrawPins(); syncTabs();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
      okBtn.disabled = false; okBtn.textContent = '삭제';
    }
  }
});

// ----- 새 이벤트 만들기 -----
$('#neBtn').addEventListener('click', async () => {
  const msg = $('#new-event-msg');
  msg.className = ''; msg.textContent = '';

  const slug = $('#neSlug').value.trim().toLowerCase();
  const orgName = $('#neOrgName').value.trim();
  const eventName = $('#neEventName').value.trim();
  const icon = $('#neIcon').value.trim() || '🗓️';
  const startVal = $('#neStart').value;
  const endVal = $('#neEnd').value;

  if (!/^[a-z0-9-]+$/.test(slug)) { msg.className = 'err'; msg.textContent = '주소는 영문 소문자/숫자/하이픈만 사용할 수 있어요.'; return; }
  if (!orgName) { msg.className = 'err'; msg.textContent = '단체명을 입력해주세요.'; return; }
  if (!startVal || !endVal) { msg.className = 'err'; msg.textContent = '시작일과 종료일을 선택해주세요.'; return; }
  if (startVal > endVal) { msg.className = 'err'; msg.textContent = '종료일이 시작일보다 빠를 수 없어요.'; return; }
  if (EVENTS.some(e => e.slug === slug)) { msg.className = 'err'; msg.textContent = '이미 사용 중인 주소예요.'; return; }

  const neBtn = $('#neBtn');
  neBtn.disabled = true; neBtn.textContent = '만드는 중...';

  const { data: existing } = await sb.from('event_meta').select('event_id').eq('event_id', slug).maybeSingle();
  if (existing) {
    msg.className = 'err'; msg.textContent = '이미 사용 중인 주소예요.';
    neBtn.disabled = false; neBtn.textContent = '만들기';
    return;
  }

  const startDate = isoToDateKey(startVal), endDate = isoToDateKey(endVal);
  const { error } = await sb.from('event_meta').insert({
    event_id: slug, icon, org_name: orgName, event_name: eventName || null,
    date_range_text: formatDateRangeText(startDate, endDate),
    start_date: startVal, end_date: endVal,
    is_public: $('#nePublic').value === 'true',
  });

  neBtn.disabled = false; neBtn.textContent = '만들기';
  if (error) { msg.className = 'err'; msg.textContent = '만들기 실패: ' + error.message; return; }

  msg.className = 'ok'; msg.textContent = '만들어졌어요! 목록에 추가됐습니다.';
  $('#neSlug').value = ''; $('#neOrgName').value = ''; $('#neEventName').value = '';
  $('#neIcon').value = ''; $('#neStart').value = ''; $('#neEnd').value = '';
  await renderEvents(true); redrawPins(); syncTabs();
});

// ---------------------------------------------------------------------------
// 사진만 골라서 새 이벤트 만들기
//
// 이벤트를 하나 열려면 주소·이름·기간을 먼저 다 적어야 했다. 그런데 사진을 막
// 옮겨 담는 순간에 알고 싶은 건 그게 아니다. 날짜는 이미 사진 안에 박혀 있으니
// 그걸 읽어 쓰고, 이름은 나중에 바꿀 수 있는 값으로 먼저 채워 둔다.
//
// 미리 물어보지 않고 바로 만드는 건 되돌리는 값이 싸기 때문이다 — 카드의 🗑
// 하나로 일정·사진·저장된 파일까지 통째로 지워진다(deleteEvent 참고).
// 대신 만들고 나서 무엇을 어떻게 정했는지(날짜의 출처, 바뀐 주소) 빠짐없이 말한다.
// ---------------------------------------------------------------------------
const QUICK_ORG = '가족끼리';
const QUICK_EVENT = '나들이';

/* 「다녀왔어요」 다리 — 가보고 싶은 곳 카드에서 건너온다.
   전에는 장소를 「다녀옴」으로 바꾸고, 따로 이벤트를 만들고, 다시 장소로 돌아와 둘을
   이어야 했다. 이제 사진만 고르면 셋이 한 번에 된다: 기록이 그 곳 이름으로 만들어지고,
   장소는 다녀옴이 되며, 둘이 이어진다. */
let pendingPlace = null;
function syncPendingNote(){
  const box = $('#pendingNote');
  box.hidden = !pendingPlace;
  if (!pendingPlace) return;
  box.innerHTML = '<b>「' + escapeHTML(pendingPlace.name) + '」 다녀온 기록을 만듭니다.</b> ' +
    '사진을 고르면 이 곳이 「다녀옴」으로 바뀌고 새 기록에 이어져요. ' +
    '<button type="button" id="pendingCancel">그만두기</button>';
  $('#pendingCancel').addEventListener('click', () => { pendingPlace = null; syncPendingNote(); });
}
function startTripFromPlace(p){
  pendingPlace = p;
  setTab('trips');
  syncPendingNote();
  $('#new-event-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function isoDay(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// 같은 날 두 번째 이벤트면 뒤에 번호를 붙인다 (2026-08-23 → 2026-08-23-2)
async function freeSlug(base){
  const { data } = await sb.from('event_meta').select('event_id').like('event_id', base + '%');
  const taken = new Set((data || []).map(r => r.event_id));
  EVENTS.forEach(e => taken.add(e.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) if (!taken.has(base + '-' + n)) return base + '-' + n;
  return base + '-' + Date.now();
}

async function createEventFromPhotos(fileList){
  const files = Array.from(fileList);
  if (!files.length) return;
  const msg = $('#quick-msg'), btn = $('#quick-pick');
  msg.className = ''; msg.textContent = '';

  const picked = [], rejected = [];
  files.forEach(f => {
    const check = validateGalleryFile(f);
    if (check.ok) picked.push({ file: f, isVideo: check.isVideo, taken_at: null, location_name: null });
    else rejected.push(check.reason);
  });
  if (!picked.length) {
    msg.className = 'err';
    msg.textContent = rejected[0] || '사진이나 영상을 골라주세요.';
    return;
  }

  btn.classList.add('busy');

  // 1) 사진에 박힌 촬영 시각과 장소 읽기 (영상에는 없다)
  for (let i = 0; i < picked.length; i++) {
    msg.textContent = '사진을 살펴보는 중... (' + (i+1) + '/' + picked.length + ')';
    if (picked[i].isVideo) continue;
    const meta = await extractPhotoMeta(picked[i].file);
    picked[i].taken_at = meta.takenAtISO;
    picked[i].location_name = meta.place || null;
  }

  // 2) 기간 정하기.
  //    촬영 시각이 첫째 기준이고, 한 장도 없으면(영상만 골랐거나 편집하면서 지워졌거나)
  //    파일 날짜로 물러선다. 물러선 사실은 아래에서 반드시 말해 준다 —
  //    파일 날짜는 찍은 날이 아니라 옮겨 담은 날일 수 있어서.
  let from = 'photo';
  let days = picked.map(p => p.taken_at ? new Date(p.taken_at) : null)
                   .filter(d => d && !isNaN(d));
  if (!days.length) {
    from = 'file';
    days = picked.map(p => new Date(p.file.lastModified))
                 .filter(d => !isNaN(d) && d.getFullYear() > 1980);
  }
  if (!days.length) { from = 'today'; days = [new Date()]; }
  days.sort((a, b) => a - b);
  const startVal = isoDay(days[0]), endVal = isoDay(days[days.length - 1]);

  // 3) 자리부터 잡는다 — 사진이 저장되는 경로에 주소가 쓰이므로 사진보다 먼저.
  msg.textContent = '나들이 만드는 중...';
  const slug = await freeSlug(startVal);
  const forPlace = pendingPlace;
  const { error: metaErr } = await sb.from('event_meta').insert({
    event_id: slug, icon: '🗓️', org_name: QUICK_ORG,
    event_name: forPlace ? String(forPlace.name).slice(0, 60) : QUICK_EVENT,
    date_range_text: formatDateRangeText(isoToDateKey(startVal), isoToDateKey(endVal)),
    start_date: startVal, end_date: endVal,
    // 이름도 아직 안 정한 이벤트가 만들자마자 밖에 보이지는 않게. 자물쇠로 공개한다.
    is_public: false,
  });
  if (metaErr) {
    btn.classList.remove('busy');
    msg.className = 'err'; msg.textContent = '만들기 실패: ' + metaErr.message;
    return;
  }
  // 건너온 장소가 있으면 다녀옴으로 바꾸고 이 기록에 잇는다. select() 를 붙여야 한다 —
  // RLS 에 막힌 update 는 오류 없이 0행이다.
  let placeLine = '';
  if (forPlace) {
    const patch = { status: 'done', event_id: slug, visited_on: forPlace.visited_on || startVal, hope: 0 };
    const { data: pd, error: pe } = await sb.from('places').update(patch).eq('id', forPlace.id).select();
    if (pe || !pd || !pd.length) {
      placeLine = '「' + escapeHTML(forPlace.name) + '」을 다녀옴으로 바꾸지 못했어요 — 장소 카드에서 직접 고쳐주세요.';
    } else {
      Object.assign(forPlace, pd[0]);
      placeLine = '「' + escapeHTML(forPlace.name) + '」을 <b>다녀옴</b>으로 바꾸고 이 기록에 이었어요. 별점은 장소 카드에서 매겨요.';
    }
    pendingPlace = null;
    syncPendingNote();
    render(); redrawPins();
  }
  renderEvents(true);                   // 사진 올리는 동안 카드는 먼저 보이도록

  // 4) 갤러리에 사진 넣기
  let okPhoto = 0, okVideo = 0, firstFail = '';
  for (let i = 0; i < picked.length; i++) {
    const p = picked[i];
    msg.textContent = '올리는 중... (' + (i+1) + '/' + picked.length + ') ' + p.file.name;
    try {
      await putGalleryFile(slug, p.file, p);
      if (p.isVideo) okVideo++; else okPhoto++;
    } catch (err) {
      if (!firstFail) firstFail = p.file.name + ' — ' + (err.message || err);
    }
  }
  const okCount = okPhoto + okVideo;

  btn.classList.remove('busy');

  const span = startVal === endVal ? startVal : startVal + ' ~ ' + endVal;
  const what = [okPhoto ? '사진 ' + okPhoto + '장' : '', okVideo ? '영상 ' + okVideo + '개' : '']
    .filter(Boolean).join(' · ');
  const lines = [okCount
    ? '<b>' + span + '</b> 나들이를 만들고 ' + what + ' 올렸어요.'
    : '<b>' + span + '</b> 나들이는 만들었는데 올라간 것이 하나도 없어요.'];
  if (from === 'file')  lines.push('촬영 날짜를 못 찾아 <b>파일 날짜</b>로 잡았어요. 다르면 나들이 안에서 고쳐주세요.');
  if (from === 'today') lines.push('날짜를 찾지 못해 <b>오늘</b>로 잡았어요. 나들이 안에서 고쳐주세요.');
  if (slug !== startVal) lines.push('그날 나들이가 이미 있어서 주소는 <b>' + slug + '</b> 로 했어요.');
  if (rejected.length) lines.push(rejected.length + '개는 올리지 않았어요 — ' + escapeHTML(rejected[0]));
  if (firstFail) lines.push('올리다 실패한 것이 있어요 — ' + escapeHTML(firstFail));
  if (placeLine) lines.push(placeLine);
  lines.push('이름은 <b>' + QUICK_ORG + ' · ' + escapeHTML(forPlace ? forPlace.name : QUICK_EVENT) + '</b> 로 뒀어요. ' +
             '<a href="/event/e/?slug=' + slug + '">열어서 바꾸기 →</a>');
  lines.push('지금은 🔒 비공개예요. 아래 카드의 자물쇠를 누르면 공개됩니다.');
  msg.className = okCount ? 'ok' : 'err';
  msg.innerHTML = lines.join('<br>');

  await renderEvents(true); redrawPins(); syncTabs();
}

$('#quickFiles').addEventListener('change', (e) => {
  createEventFromPhotos(e.target.files);
  e.target.value = '';                  // 같은 사진을 다시 고를 수 있게 비워 둔다
});

$('#manualToggle').addEventListener('click', () => {
  const box = $('#manual-new');
  const open = box.style.display === 'block';
  box.style.display = open ? 'none' : 'block';
  $('#manualToggle').textContent = open ? '✏️ 직접 적어서 만들기' : '✏️ 접기';
});

// 목록은 누구나 볼 수 있고, 만들기·지우기는 부모에게만 — 그 갈림과 첫 실행은
// outing-places.js 의 refreshAuthUI 가 한다.
$('#tripsMore').addEventListener('click', () => { tripsShown += TRIPS_PAGE; renderEvents(); });
