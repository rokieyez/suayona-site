// event/index.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('event');
buildBackdrop('event');   // 배경 픽셀 겹 (common.js) — 다른 쪽들과 같은 풍경을 깐다

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
function isoToDateKey(iso){
  const [y,m,d] = iso.split('-').map(Number);
  return [y, m-1, d];
}

function getStatus(ev){
  const now = new Date();
  const start = new Date(...ev.startDate);
  const end = new Date(ev.endDate[0], ev.endDate[1], ev.endDate[2], 23, 59, 59);
  if (now < start) return 'upcoming';
  if (now <= end) return 'ongoing';
  return 'done';
}

function cardHTML(ev, status){
  const badgeText = status === 'ongoing' ? '진행중' : status === 'upcoming' ? '예정' : '종료';
  const adminBtns = (isAdmin && ev.isRegistry)
    ? '<button class="card-lock" data-slug="' + ev.slug + '" title="' +
        (ev.isPublic ? '공개 상태 — 눌러서 비공개로' : '비공개 상태 — 눌러서 공개로') + '">' +
        (ev.isPublic ? '🌏' : '🔒') + '</button>' +
      '<button class="card-del" data-slug="' + ev.slug + '" title="이벤트 삭제">🗑</button>'
    : '';
  const privateTag = (isAdmin && ev.isRegistry && !ev.isPublic)
    ? '<span class="badge private">🔒 비공개</span>' : '';
  // 사진만 골라 만든 뒤 아직 이름을 안 지은 이벤트
  const needsName = isAdmin && ev.isRegistry
    && ev.orgName === QUICK_ORG && ev.eventName === QUICK_EVENT;
  const todo = needsName
    ? '<a class="card-todo" href="/event/e/admin.html?slug=' + encodeURIComponent(ev.slug) + '">✏️ 이름을 지어주세요</a>'
    : '';
  return '<div class="card' + (ev.isPublic === false ? ' is-private' : '') + '" data-slug="' + ev.slug + '">' +
    '<a class="card-link" href="' + ev.href + '">' +
    '<div class="card-top"><span class="card-name">' + ev.orgName + ' · ' + ev.eventName + '</span>' +
    '<span class="badge-group">' + privateTag +
    '<span class="badge ' + status + '">' + badgeText + '</span></span></div>' +
    '<div class="card-sub">' + ev.dateRangeText + '</div></a>' +
    todo + adminBtns + '</div>';
}

async function fetchRegistryEvents(){
  const legacySlugs = new Set(EVENTS.map(e => e.slug));
  // 비공개 이벤트는 로그인한 사람에게만 (서버 정책에서도 한 번 더 막혀 있음)
  let q = sb.from('event_meta').select('*').not('start_date', 'is', null).not('end_date', 'is', null);
  if (!isAdmin) q = q.eq('is_public', true);
  const { data, error } = await q;
  if (error) { console.error('이벤트 목록 로딩 오류:', error); return []; }
  return data
    .filter(r => !legacySlugs.has(r.event_id))
    .map(r => {
      const startDate = isoToDateKey(r.start_date), endDate = isoToDateKey(r.end_date);
      return {
        slug: r.event_id,
        orgName: r.org_name || r.event_id,
        eventName: r.event_name || '',
        dateRangeText: r.date_range_text || formatDateRangeText(startDate, endDate),
        startDate, endDate,
        icon: r.icon || '📍',
        href: '/event/e/?slug=' + encodeURIComponent(r.event_id),
        isRegistry: true,
        isPublic: r.is_public !== false,
      };
    });
}

async function renderEvents(){
  const currentList = $('#current-list');
  const pastList = $('#past-list');
  const current = [], past = [];

  const registryEvents = await fetchRegistryEvents();
  const allEvents = [...EVENTS, ...registryEvents];

  allEvents.forEach(ev => {
    const status = getStatus(ev);
    (status === 'done' ? past : current).push({ev, status});
  });

  current.sort((a,b) => new Date(...a.ev.startDate) - new Date(...b.ev.startDate));
  past.sort((a,b) => new Date(...b.ev.endDate) - new Date(...a.ev.endDate));

  currentList.innerHTML = current.length ? current.map(c => cardHTML(c.ev, c.status)).join('') : '<div class="empty">진행중이거나 예정된 이벤트가 없습니다</div>';
  $('#past-section').style.display = past.length ? 'block' : 'none';
  pastList.innerHTML = past.map(c => cardHTML(c.ev, c.status)).join('');

  // 목록을 다 그린 뒤에 지도를 붙인다 — 지도가 늦어도 목록은 먼저 보이도록.
  drawMapBand(allEvents);
}

/* =========================================================================
   지도 띠
   ------------------------------------------------------------------------
   핀은 일정에 적어 둔 장소(events.place_lat/place_lng)에서 온다.
   사진의 위치정보로는 못 만든다 — 올라와 있는 사진 중 좌표가 남은 것이 없다.
   그래서 관리 화면에서 장소를 적은 일정이 하나도 없으면 띠는 안 나온다.
   ========================================================================= */
let mapBandDrawn = false;

// 목록에 실제로 보이는 이벤트만 물어본다 — 비공개 이벤트의 위치가
// 로그인 안 한 사람의 지도에 찍히면 안 되므로.
async function fetchEventPlaces(slugs){
  if (!slugs.length) return {};
  const { data, error } = await sb.from('events')
    .select('event_id, place_name, place_lat, place_lng, thumb_url, image_url')
    .in('event_id', slugs)
    .not('place_lat', 'is', null)
    .order('panel', {ascending:true}).order('sort_order', {ascending:true});
  if (error) { console.error('장소 로딩 오류:', error); return {}; }
  const byEvent = {};
  (data || []).forEach(r => {
    if (!Number.isFinite(r.place_lat) || !Number.isFinite(r.place_lng)) return;
    (byEvent[r.event_id] = byEvent[r.event_id] || []).push(r);
  });
  return byEvent;
}

async function drawMapBand(events){
  if (mapBandDrawn) return;
  const band = $('#mapBand');
  const byEvent = await fetchEventPlaces(events.map(e => e.slug));
  const shown = events.filter(e => byEvent[e.slug] && byEvent[e.slug].length);
  if (!shown.length) return;                       // 적어 둔 장소가 없으면 띠를 안 그린다

  // 여기서 실패하면(서비스가 꺼져 있거나 도메인이 안 맞으면) 조용히 접는다.
  // 지도 하나 때문에 이벤트 목록이 안 보이면 안 되므로.
  try { await loadKakaoMaps(); } catch (e) { console.warn('지도를 건너뜁니다:', e.message); return; }

  mapBandDrawn = true;
  band.hidden = false;
  const map = new kakao.maps.Map($('#eventMap'), {
    center: new kakao.maps.LatLng(36.5, 127.9), level: 13, scrollwheel: false,
  });
  enablePinchZoom(map, $('#eventMap'));
  const bounds = new kakao.maps.LatLngBounds();
  const pins = [];

  const placeCount = shown.reduce((a, ev) => a + byEvent[ev.slug].length, 0);
  function showSummary(){
    pins.forEach(p => p.classList.remove('on'));
    $('#stripText').innerHTML = '📍 다녀온 곳<span class="sub">이벤트 ' + shown.length +
      '개 · ' + placeCount + '군데 · 사진을 눌러보세요</span>';
    $('#stripLink').hidden = true;
  }

  const spots = [];
  shown.forEach(ev => {
    const rows = byEvent[ev.slug];
    const lat = rows.reduce((a,r) => a + r.place_lat, 0) / rows.length;
    const lng = rows.reduce((a,r) => a + r.place_lng, 0) / rows.length;
    const here = new kakao.maps.LatLng(lat, lng);
    spots.push(here);
    bounds.extend(here);

    // 그 장소에 붙여 둔 사진을 핀으로. 사진이 없는 일정이면 이벤트 아이콘으로 대신한다.
    const shot = rows.map(r => r.thumb_url || r.image_url).find(Boolean);
    const pin = document.createElement('div');
    pin.className = 'pin-photo';
    pin.innerHTML = shot ? '<img alt="" src="' + escapeHTML(shot) + '">' : (ev.icon || '📍');

    pin.addEventListener('click', () => {
      pins.forEach(p => p.classList.remove('on'));
      pin.classList.add('on');
      // 이름표는 한 줄로. 길어지면 줄이 두 겹이 되어 띠가 들썩인다.
      const names = rows.map(r => r.place_name).filter(Boolean);
      const label = names.slice(0, 2).join(', ') +
        (names.length > 2 ? ' 외 ' + (names.length - 2) + '곳' : '');
      $('#stripText').innerHTML = escapeHTML(ev.eventName || ev.orgName) +
        '<span class="sub">' + escapeHTML(label) + '</span>';
      $('#stripLink').href = ev.href;
      $('#stripLink').hidden = false;
    });
    pins.push(pin);

    new kakao.maps.CustomOverlay({
      map, position: here, content: pin,
      xAnchor: 0.5, yAnchor: 0.5, clickable: true, zIndex: 2,
    });
  });

  // 핀이 다 들어오게 맞춘다.
  //
  // 띠가 얇아서 여백을 크게 두면 안 된다. 카카오 지도는 레벨 14 보다 더 물러날 수
  // 없는데, 210px 짜리 띠가 그 레벨에서 담는 세로 폭이 위도 3.8도쯤이다.
  // 부산~홍천만 해도 2.6도라, 여백을 위아래 58px 씩 두었더니 담을 자리가 모자라
  // setBounds 가 한쪽을 통째로 잘라 버렸다(핀 두 개 중 하나가 사라졌다).
  // 그래서 여백은 작게 두고, 그래도 다 안 들어오면 한가운데에 놓는 쪽으로 물러선다.
  if (spots.length === 1) {
    map.setCenter(spots[0]);
    map.setLevel(6);                       // 한 곳뿐이면 동네가 보일 만큼만
  } else {
    map.setBounds(bounds, 22, 22, 22, 22);
    const view = map.getBounds();
    if (!spots.every(p => view.contain(p))) {
      const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
      map.setLevel(14);
      map.setCenter(new kakao.maps.LatLng((sw.getLat()+ne.getLat())/2, (sw.getLng()+ne.getLng())/2));
    }
  }
  showSummary();
  kakao.maps.event.addListener(map, 'click', showSummary);
}

// ----- 이벤트 삭제 (2단계 확인: 🗑 클릭 → 인라인 확인 → 삭제 버튼 클릭) -----
async function deleteEvent(slug){
  const buckets = ['event-images', 'gallery-uploads'];
  for (const bucket of buckets) {
    const { data: files } = await sb.storage.from(bucket).list(slug, { limit: 1000 });
    if (files && files.length) {
      const paths = files.map(f => slug + '/' + f.name);
      await sb.storage.from(bucket).remove(paths);
    }
  }
  await sb.from('events').delete().eq('event_id', slug);
  await sb.from('gallery_media').delete().eq('event_id', slug);
  const { error } = await sb.from('event_meta').delete().eq('event_id', slug);
  if (error) throw error;
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
    renderEvents();
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
      '<p>정말 삭제할까요? 이 이벤트의 모든 일정과 사진이 함께 삭제되며 되돌릴 수 없어요.</p>' +
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
      renderEvents();
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
  renderEvents();
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
  msg.textContent = '이벤트 만드는 중...';
  const slug = await freeSlug(startVal);
  const { error: metaErr } = await sb.from('event_meta').insert({
    event_id: slug, icon: '🗓️', org_name: QUICK_ORG, event_name: QUICK_EVENT,
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
  renderEvents();                       // 사진 올리는 동안 카드는 먼저 보이도록

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
    ? '<b>' + span + '</b> 이벤트를 만들고 ' + what + ' 올렸어요.'
    : '<b>' + span + '</b> 이벤트는 만들었는데 올라간 것이 하나도 없어요.'];
  if (from === 'file')  lines.push('촬영 날짜를 못 찾아 <b>파일 날짜</b>로 잡았어요. 다르면 이벤트 안에서 고쳐주세요.');
  if (from === 'today') lines.push('날짜를 찾지 못해 <b>오늘</b>로 잡았어요. 이벤트 안에서 고쳐주세요.');
  if (slug !== startVal) lines.push('그날 이벤트가 이미 있어서 주소는 <b>' + slug + '</b> 로 했어요.');
  if (rejected.length) lines.push(rejected.length + '개는 올리지 않았어요 — ' + escapeHTML(rejected[0]));
  if (firstFail) lines.push('올리다 실패한 것이 있어요 — ' + escapeHTML(firstFail));
  lines.push('이름은 <b>' + QUICK_ORG + ' · ' + QUICK_EVENT + '</b> 로 뒀어요. ' +
             '<a href="/event/e/?slug=' + slug + '">열어서 바꾸기 →</a>');
  lines.push('지금은 🔒 비공개예요. 아래 카드의 자물쇠를 누르면 공개됩니다.');
  msg.className = okCount ? 'ok' : 'err';
  msg.innerHTML = lines.join('<br>');

  renderEvents();
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

// ----- 목록은 누구나 볼 수 있고, 만들기/삭제만 로그인한 사람에게 노출 -----
async function refreshAuthUI(){
  // 역할까지 확인 — 아이 계정은 이벤트를 만들거나 지울 수 없어야 한다
  const session = await refreshAuth();

  $('#content').style.display = 'block';            // 목록은 항상 보임
  $('#new-event-box').style.display = isAdmin ? 'block' : 'none';
  $('.section-head p').textContent = isAdmin
    ? '지금까지 열린 이벤트를 확인하고 새로 만들 수 있어요'
    : '지금까지 열린 이벤트를 확인해보세요';

  renderEvents();
}

refreshAuthUI();
