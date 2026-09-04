// event/e/index.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('event');

const CONFIG = {
  eventSlug: new URLSearchParams(location.search).get('slug') || '',
  orgName: '이벤트', eventName: '일정', dateRangeText: '',
  startDate: null, endDate: null,
  panels: [],
};

// 장소를 카카오맵으로 이어 준다.
// 이 주소는 열쇠(API 키)가 필요 없다 — 지도를 이 페이지 안에 그리는 게 아니라
// 카카오맵으로 넘겨 주는 것뿐이라서. 휴대폰에서는 카카오맵 앱이, 컴퓨터에서는 지도 사이트가 열린다.
//
// 좌표가 있으면 이름표를 단 채 그 지점에 핀을 찍어 주고(/link/map/이름,위도,경도),
// 없으면 이름으로 찾아 준다(/link/search/이름).
// 이름 안의 쉼표는 encodeURIComponent 가 %2C 로 바꿔 주므로, 자리를 나누는 쉼표와 섞이지 않는다.
function mapLinkFor(name, lat, lng){
  const label = encodeURIComponent(name);
  return (Number.isFinite(lat) && Number.isFinite(lng))
    ? 'https://map.kakao.com/link/map/' + label + ',' + lat + ',' + lng
    : 'https://map.kakao.com/link/search/' + label;
}
function placeChipHTML(name, lat, lng){
  if (!name) return '';
  const pin = (Number.isFinite(lat) && Number.isFinite(lng)) ? '📍' : '🔎';
  return '<a class="place" href="' + escapeHTML(mapLinkFor(name, lat, lng)) + '"' +
    ' target="_blank" rel="noopener" title="지도에서 보기">' + pin +
    '<span>' + escapeHTML(name) + '</span></a>';
}

const WEEKDAY = ['일','월','화','수','목','금','토'];
function formatDateLabel(dateKey){
  const [y,m,d] = dateKey;
  return (m+1) + '/' + d + ' ' + WEEKDAY[new Date(y,m,d).getDay()];
}
function formatDateRangeText(s, e){
  const f = d => (d[1]+1) + '. ' + d[2] + '(' + WEEKDAY[new Date(d[0],d[1],d[2]).getDay()] + ')';
  return s[0] + '. ' + f(s) + ' ~ ' + f(e);
}
// isoToDateKey 는 common.js 에 있다 (행사 세 쪽이 똑같은 것을 갖고 있었다).
function buildDatePanels(startDate, endDate){
  const panels = [];
  let cur = new Date(startDate[0], startDate[1], startDate[2]);
  const end = new Date(endDate[0], endDate[1], endDate[2]);
  let i = 1;
  while (cur <= end) {
    panels.push({ id: 'd' + i, dateKey: [cur.getFullYear(), cur.getMonth(), cur.getDate()] });
    cur.setDate(cur.getDate() + 1);
    i++;
  }
  panels.push({ id: 'gallery', label: '📷 갤러리', dateKey: null });
  return panels;
}

function showNotFound(msg){
  $('#wrap').innerHTML = '<div class="notfound">🔍<br><br>' + msg + '</div>';
}

function applyHeaderText(){
  // 단체명은 위쪽에 작게, 일정명은 그 아래 크게.
  // 매일 눈으로 찾는 것은 "부산여행" 이지 "수아연아랑" 이 아니라서, 큰 글씨 자리를 일정명에 준다.
  const org = (CONFIG.orgName || '').trim();
  const name = (CONFIG.eventName || '').trim();
  const big = name || org;             // 일정명을 안 적은 이벤트는 단체명이 큰 글씨로 올라온다
  const small = name ? org : '';
  $('#logo').textContent = big;
  $('#pillText').textContent = small;
  document.querySelector('.pill').hidden = !small;
  document.getElementById('dateRange').textContent = CONFIG.dateRangeText;
  document.title = [big, small].filter(Boolean).join(' · ');
}

async function refreshHubLink(){
  // 공용 refreshAuth 가 역할(부모/아이)까지 봐준다.
  // 예전처럼 "로그인했으면 관리자"로 두면 아이 계정이 여기서 일정을 고칠 수 있게 된다.
  await refreshAuth();
}

const tabsEl = $('#tabs'), panelsEl = $('#panels');

// ----- 일정에 첨부된 사진 클릭 시 갤러리와 같은 라이트박스로 확대 -----
panelsEl.addEventListener('click', async (e) => {
  const img = e.target.closest('.item-img');
  if (!img) return;
  // 일정 하나에 사진이 여러 장이라 id 로 찾으면 늘 첫 장이 열림 — 주소로 정확히 찾음.
  // src 는 작은 사본일 수 있으므로 원본 주소로 찾는다.
  const src = img.dataset.full || img.getAttribute('src');
  let idx = galleryItems.findIndex(g => g.media_url === src);
  if (idx === -1) { await loadGallery(); idx = galleryItems.findIndex(g => g.media_url === src); }
  if (idx === -1) return;
  openLightbox(idx);
});
function buildTabsAndPanels(){
  CONFIG.panels.forEach((p, i) => {
    const label = p.label || (p.dateKey ? formatDateLabel(p.dateKey) : p.id);

    if (i > 0 && !p.dateKey && CONFIG.panels[i-1].dateKey) {
      const sep = document.createElement('span');
      sep.className = 'tab-sep';
      sep.textContent = '·';
      tabsEl.appendChild(sep);
    }

    const tab = document.createElement('button');
    tab.className = 'tab' + (i === 0 ? ' active' : '');
    tab.dataset.t = p.id;
    tab.textContent = label;
    tab.addEventListener('click', () => showPanel(p.id));
    tabsEl.appendChild(tab);

    const panel = document.createElement('div');
    panel.className = 'panel' + (i === 0 ? ' active' : '');
    panel.id = p.id;
    const body = p.id === 'gallery'
      // 올리기 버튼은 관리자로 로그인했을 때만 (수정 버튼과 같은 기준)
      ? (isAdmin
          ? '<div class="gallery-toolbar">' +
              '<label class="upload-btn" id="uploadBtn" for="galleryFileInput">📤 사진/영상 올리기</label>' +
              '<input type="file" id="galleryFileInput" accept="image/*,video/*" multiple style="display:none;">' +
              '<button type="button" class="auto-btn" id="autoBtn">🪄 사진으로 일정 만들기</button>' +
              '<button type="button" class="auto-btn" id="thumbBtn" hidden>🗜 사진 가볍게 만들기</button>' +
            '</div>'
          : '') +
        '<div class="gallery-msg" id="galleryMsg"></div>' +
        '<div id="propBox"></div>' +
        '<div class="gallery-grid" id="galleryGrid"></div>' +
        '<div class="empty-msg" id="galleryEmpty" style="display:none;">아직 등록된 사진/영상이 없습니다</div>'
      : p.id === 'map'
      ? '<div class="trip-days" id="tripDays"></div>' +
        '<div class="trip-wrap">' +
          '<div class="trip-map" id="tripMap"></div>' +
          '<div class="trip-strip">' +
            '<span id="tripText"></span>' +
            '<button type="button" id="tripGo" hidden>일정 보기 →</button>' +
          '</div>' +
        '</div>' +
        '<div class="near-wish" id="nearWish" hidden></div>' +
        '<div class="trip-stash" id="tripStash" hidden></div>'
      : '<div class="timeline"></div>';
    panel.innerHTML = '<div class="day-head"><span>' + label + '</span>' +
      '<span class="day-count"></span></div>' + body;
    panelsEl.appendChild(panel);
  });
}

// ----- 노트 탭과 같은 자유 서식 탭을 관리자가 원하는 만큼 만든 경우, 날짜 탭과 갤러리 탭 사이에 끼워 넣음 -----
async function loadCustomTabs(){
  const { data, error } = await sb.from('custom_tabs').select('*')
    .eq('event_id', CONFIG.eventSlug).order('sort_order', {ascending:true}).order('id', {ascending:true});
  if (error || !data) return;
  data.forEach(addCustomTabPanel);
}

function addCustomTabPanel(row){
  const id = 'custom-' + row.id;
  const galleryTab = tabsEl.querySelector('[data-t="gallery"]');

  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.t = id;
  tab.textContent = row.label;
  tab.addEventListener('click', () => showPanel(id));
  if (galleryTab) tabsEl.insertBefore(tab, galleryTab); else tabsEl.appendChild(tab);

  const editLink = isAdmin
    ? '<a class="add-schedule-btn" href="./admin.html?slug=' + encodeURIComponent(CONFIG.eventSlug) + '&editTab=' + row.id + '" style="display:inline-block; margin-bottom:14px;">✏️ 편집</a>'
    : '';
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = id;
  // 부모가 적는 값이라 남이 넣을 수는 없지만, 제목에 <, & 를 쓰면 화면이 깨진다.
  // 「<3」 같은 것을 적어 보면 바로 사라진다 — HTML 로 읽혀 버리기 때문이다.
  panel.innerHTML = '<div class="day-head">' + escapeHTML(row.label) + '</div>' + editLink +
    '<div class="note-content">' + (renderNoteContent(row.content) || '<div class="empty-msg">아직 작성된 내용이 없습니다</div>') + '</div>';
  panelsEl.appendChild(panel);
}

/* =========================================================================
   동선 지도
   ------------------------------------------------------------------------
   일정에 적어 둔 장소(place_lat/place_lng)를 날짜별로 색을 나눠 찍고,
   그날 들른 순서대로 선으로 잇는다. 핀의 숫자가 그날 몇 번째로 들렀는지다.
   ========================================================================= */
const DAY_COLORS = ['#ff7f8a', '#6cc7b3', '#ffd979', '#5aa9e6', '#b9a3d6', '#ffa45c'];
let TRIP_STOPS = [], tripDrawn = false;

// 좌표가 있는 일정만 날짜 순서대로 모은다
function collectTripStops(byPanel){
  const stops = [];
  CONFIG.panels.filter(p => p.dateKey).forEach((p, dayIndex) => {
    let no = 0;
    (byPanel[p.id] || []).forEach(r => {
      if (!Number.isFinite(r.place_lat) || !Number.isFinite(r.place_lng)) return;
      stops.push({
        id: r.id, panelId: p.id, dayIndex, dayLabel: formatDateLabel(p.dateKey),
        no: ++no, time: r.time || '', title: r.title, place: r.place_name,
        lat: r.place_lat, lng: r.place_lng,
        // 「가볼 곳으로 담기」가 쓰는 것들 — 날짜와 그날 사진
        dateKey: p.dateKey, photo: r.image_url || null, thumb: r.thumb_url || null,
      });
    });
  });
  return stops;
}

// 지도에서 "일정 보기" 를 누르면 그 날짜 탭으로 건너가 해당 일정을 짚어 준다
function goToItem(panelId, id){
  showPanel(panelId);
  const el = document.querySelector('#' + panelId + ' .item[data-id="' + id + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior:'smooth', block:'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1800);
}

// 지도는 탭이 열려 있어야 크기를 잴 수 있다 — 처음 열 때 한 번만 그린다.
async function drawTripMap(){
  if (tripDrawn || !TRIP_STOPS.length) return;
  const box = document.getElementById('tripMap');
  if (!box || !box.offsetHeight) return;             // 아직 안 보이는 탭

  try { await loadKakaoMaps(); }
  catch (e) {
    tripDrawn = true;
    box.innerHTML = '<div class="empty-msg">지도를 불러오지 못했어요</div>';
    return;
  }
  tripDrawn = true;

  const map = new kakao.maps.Map(box, {
    center: new kakao.maps.LatLng(TRIP_STOPS[0].lat, TRIP_STOPS[0].lng),
    level: 6, scrollwheel: false,
  });
  enablePinchZoom(map, box);
  map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.TOPLEFT);

  const color = i => DAY_COLORS[i % DAY_COLORS.length];
  const days = [...new Set(TRIP_STOPS.map(s => s.dayIndex))];
  const pins = [], lines = [];

  // 날짜마다 선 하나 — 그날 들른 차례대로
  days.forEach(di => {
    const path = TRIP_STOPS.filter(s => s.dayIndex === di)
      .map(s => new kakao.maps.LatLng(s.lat, s.lng));
    if (path.length < 2) return;                     // 한 곳뿐이면 이을 데가 없다
    const line = new kakao.maps.Polyline({
      map, path, strokeWeight: 4, strokeColor: color(di),
      strokeOpacity: 0.95, strokeStyle: 'solid',
    });
    lines.push({ dayIndex: di, line });
  });

  TRIP_STOPS.forEach(s => {
    const node = document.createElement('div');
    node.className = 'trip-pin';
    node.style.background = color(s.dayIndex);
    node.textContent = s.no;
    node.title = s.place;
    node.addEventListener('click', () => {
      pins.forEach(p => p.node.classList.remove('on'));
      node.classList.add('on');
      document.getElementById('tripText').innerHTML =
        escapeHTML(s.place) +
        '<span class="sub">' + escapeHTML(s.dayLabel) +
        (s.time ? ' · ' + escapeHTML(s.time) : '') + ' · ' + escapeHTML(s.title) + '</span>';
      const go = document.getElementById('tripGo');
      go.hidden = false;
      go.onclick = () => goToItem(s.panelId, s.id);
    });
    pins.push({ stop: s, node });
    new kakao.maps.CustomOverlay({
      map, position: new kakao.maps.LatLng(s.lat, s.lng), content: node,
      xAnchor: 0.5, yAnchor: 0.5, clickable: true, zIndex: 3,
    });
  });

  const fitTo = list => {
    if (!list.length) return;
    const b = new kakao.maps.LatLngBounds();
    list.forEach(s => b.extend(new kakao.maps.LatLng(s.lat, s.lng)));
    if (list.length === 1) { map.setCenter(new kakao.maps.LatLng(list[0].lat, list[0].lng)); map.setLevel(5); }
    else map.setBounds(b, 40, 40, 40, 40);
  };

  // 날짜 단추 — 색이 곧 범례다. 누르면 그날만 남고, 다시 누르면 전체로 돌아온다.
  const daysBox = document.getElementById('tripDays');
  let picked = null;
  function applyPick(){
    pins.forEach(p => p.node.classList.toggle('dim', picked !== null && p.stop.dayIndex !== picked));
    lines.forEach(l => l.line.setOptions({ strokeOpacity: (picked === null || l.dayIndex === picked) ? 0.95 : 0.15 }));
    daysBox.querySelectorAll('.trip-day').forEach(b =>
      b.classList.toggle('on', b.dataset.day === String(picked)));
    fitTo(picked === null ? TRIP_STOPS : TRIP_STOPS.filter(s => s.dayIndex === picked));
    document.getElementById('tripText').innerHTML = picked === null
      ? '\uD83D\uDDFA 다녀온 길<span class="sub">모두 ' + TRIP_STOPS.length + '곳 · 핀을 눌러보세요</span>'
      : TRIP_STOPS.filter(s => s.dayIndex === picked)[0].dayLabel +
        '<span class="sub">' + TRIP_STOPS.filter(s => s.dayIndex === picked).length + '곳 · 핀을 눌러보세요</span>';
    document.getElementById('tripGo').hidden = true;
    pins.forEach(p => p.node.classList.remove('on'));
  }
  days.forEach(di => {
    const label = TRIP_STOPS.find(s => s.dayIndex === di).dayLabel;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'trip-day'; b.dataset.day = String(di);
    b.innerHTML = '<span class="dot" style="background:' + color(di) + '"></span>' + escapeHTML(label);
    b.addEventListener('click', () => { picked = (picked === di) ? null : di; applyPick(); });
    daysBox.appendChild(b);
  });
  applyPick();
  kakao.maps.event.addListener(map, 'click', () => {
    pins.forEach(p => p.node.classList.remove('on'));
    document.getElementById('tripGo').hidden = true;
  });

  showNearbyWishes();
  buildStashBox();
}

/* 이 일정의 장소를 「가볼 곳」으로 담기 (부모만)
   ------------------------------------------------------------------
   저장할 때 저절로 담게 하지 않는 이유: 한 여행에서 열 곳을 찍으면 카드도 열 장이
   생겨 목록이 금세 무거워진다. 남길 만한 곳은 몇 되지 않는다. 그래서 골라 담는다.
   이미 담긴 것(이름이 같거나 300m 안)은 목록에서 빼고, 다 담겼으면 상자를 안 그린다. */
async function buildStashBox(){
  const box = document.getElementById('tripStash');
  if (!box || !isAdmin || !TRIP_STOPS.length) return;

  const { data, error } = await sb.from('places').select('name, lat, lng');
  if (error) { console.warn('가볼 곳을 못 읽었습니다:', error.message); return; }
  const 이미 = data || [];
  const 담긴가 = (s) => 이미.some(x =>
    x.name === (s.place || s.title) ||
    (Number.isFinite(x.lat) && metersBetween({ lat: s.lat, lng: s.lng }, x) <= 300));

  // 같은 장소가 여러 날에 나오면 한 번만 (제주에서 숙소가 그랬다)
  const 남은 = [];
  TRIP_STOPS.forEach(s => {
    if (담긴가(s)) return;
    if (남은.some(x => (x.place || x.title) === (s.place || s.title))) return;
    남은.push(s);
  });
  if (!남은.length) return;

  box.hidden = false;
  box.innerHTML = '<b>📌 이 일정의 장소를 가볼 곳으로 담기</b>' +
    '<p class="stash-hint">담긴 곳은 「가본 곳」으로 들어가고 이 이벤트에 이어집니다. ' +
    '무엇인지(먹거리·자연·체험·숙소)는 가볼 곳 쪽에서 정하세요.</p>' +
    '<div class="stash-list">' +
      남은.map((s, i) => '<label><input type="checkbox" data-stash="' + i + '">' +
        '<span>' + escapeHTML(s.place || s.title) + '</span>' +
        '<em>' + escapeHTML(s.dayLabel) + '</em></label>').join('') +
    '</div>' +
    '<div class="stash-act">' +
      '<button type="button" class="stash-all">모두 고르기</button>' +
      '<button type="button" class="stash-go">담기</button>' +
      '<span class="stash-msg"></span>' +
    '</div>';

  const msg = box.querySelector('.stash-msg');
  box.querySelector('.stash-all').addEventListener('click', () => {
    const 켤까 = [...box.querySelectorAll('[data-stash]')].some(c => !c.checked);
    box.querySelectorAll('[data-stash]').forEach(c => { c.checked = 켤까; });
  });

  box.querySelector('.stash-go').addEventListener('click', async () => {
    const 고른 = [...box.querySelectorAll('[data-stash]')]
      .filter(c => c.checked).map(c => 남은[+c.dataset.stash]);
    if (!고른.length) { msg.textContent = '담을 곳을 골라 주세요.'; return; }

    const rows = 고른.map(s => ({
      name: s.place || s.title,
      lat: s.lat, lng: s.lng,
      status: 'done',
      event_id: CONFIG.eventSlug,
      // dateKey 는 [년, 달-1, 일] 이다. 표에는 'YYYY-MM-DD' 로 넣는다.
      visited_on: s.dateKey
        ? s.dateKey[0] + '-' + String(s.dateKey[1] + 1).padStart(2, '0') + '-' +
          String(s.dateKey[2]).padStart(2, '0')
        : null,
      season: s.dateKey ? seasonOfMonth(s.dateKey[1] + 1) : null,
      photo_url: s.photo, thumb_url: s.thumb,
      hope: 0,
    }));

    msg.textContent = '담는 중...';
    const { data: 넣은것, error: err } = await sb.from('places').insert(rows).select();
    if (err) { msg.textContent = '담지 못했습니다: ' + err.message; return; }
    if (!넣은것 || !넣은것.length) { msg.textContent = '담기지 않았습니다 (권한 확인)'; return; }
    msg.textContent = 넣은것.length + '군데를 담았습니다.';
    box.querySelectorAll('[data-stash]').forEach(c => { c.checked = false; });
    // 담고 나면 목록에서 빠져야 한다 — 다시 세어 그린다.
    box.hidden = true;
    buildStashBox();
    showNearbyWishes();
  });
}

function seasonOfMonth(m){
  return (m === 12 || m <= 2) ? '겨울' : m <= 5 ? '봄' : m <= 8 ? '여름' : '가을';
}

/* 이 여행길 가까이에 적어 둔 「가볼 곳」이 있으면 알려 준다.
   ------------------------------------------------------------------
   부산에 가면서 부산에 적어 둔 데를 잊는 일이 실제로 생긴다. 다녀온 뒤에 보면
   「거기 바로 옆이었네」가 된다. 그래서 이 쪽을 열 때 한 번만 물어보고, 길에서
   5km 안에 있는 것만 보여 준다 — 그보다 멀면 「근처」라고 하기 어렵다. */
// 거리 재기(metersBetween)는 common.js 에 있다 — 가볼 곳 쪽도 같은 것을 쓴다.
const NEAR_WISH_M = 5000;

async function showNearbyWishes(){
  const box = document.getElementById('nearWish');
  if (!box || !TRIP_STOPS.length) return;
  const { data, error } = await sb.from('places')
    .select('id, name, category, lat, lng')
    .eq('status', 'want')
    .not('lat', 'is', null);
  if (error) { console.warn('가볼 곳을 못 읽었습니다:', error.message); return; }

  const near = [];
  (data || []).forEach(w => {
    let 가장가까움 = Infinity;
    TRIP_STOPS.forEach(s => { 가장가까움 = Math.min(가장가까움, metersBetween(w, s)); });
    if (가장가까움 <= NEAR_WISH_M) near.push({ ...w, m: 가장가까움 });
  });
  if (!near.length) return;

  near.sort((a, b) => a.m - b.m);
  box.hidden = false;
  box.innerHTML = '<b>📌 이 근처에 적어 둔 가볼 곳 ' + near.length + '군데</b>' +
    near.slice(0, 6).map(w =>
      '<a href="/wish/">' + escapeHTML(w.name) +
      '<span>' + (w.m < 1000 ? w.m + 'm' : (w.m / 1000).toFixed(1) + 'km') + '</span></a>').join('');
}

function reveal(panel){
  panel.querySelectorAll('.item').forEach(it => it.classList.add('show'));
  countDay(panel);
  markNow(panel);
  alignTimelineDots(panel);
  if (panel.id === 'map') drawTripMap();
}

// 눈금 높이를 오른쪽 시각 칸의 한가운데에 맞춘다.
// CSS 만으로는 알 수 없다 — 제목이 길어 두 줄이 되면 그 줄의 한가운데가 내려가기 때문.
// 사진이 몇 장이든 이 값은 안 변한다(시각 줄이 사진보다 위에 있으므로) — 한 번만 재면 된다.
// 숨어 있는 탭은 높이가 0 으로 나오므로 열려 있는 탭만 잰다.
function alignTimelineDots(panel){
  if (!panel) return;
  panel.querySelectorAll('.timeline .item').forEach(it => {
    if (!it.offsetHeight) return;
    const t = it.querySelector('.time');
    if (!t) return;
    // offsetTop 은 카드 테두리 "안쪽" 부터 잰 값이고, CSS 의 top 도 같은 기준이라 그대로 쓴다.
    it.style.setProperty('--dot-y', (t.offsetTop + t.offsetHeight / 2).toFixed(1) + 'px');
  });
}

const activePanel = () => document.querySelector('.panel.active');
// 글꼴이 늦게 도착하면 줄 높이가 바뀐다 — 도착한 뒤에 한 번 더 잰다.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => alignTimelineDots(activePanel()));
// 화면 폭이 바뀌면 제목이 접히거나 펴져서 줄 높이가 달라진다.
let dotTimer;
window.addEventListener('resize', () => {
  clearTimeout(dotTimer);
  dotTimer = setTimeout(() => alignTimelineDots(activePanel()), 150);
});

// 날짜 머리글 오른쪽에 "4가지 · 사진 6장" — 그날이 얼마나 되는지 미리 알 수 있게
function countDay(panel){
  const box = panel && panel.querySelector('.day-count');
  if (!box) return;
  const items = panel.querySelectorAll('.timeline .item').length;
  const shots = panel.querySelectorAll('.timeline .item-img').length;
  const cells = panel.querySelectorAll('.gallery-thumb').length;
  box.textContent = items ? items + '가지 · 사진 ' + shots + '장'
    : cells ? '사진 ' + cells + '장' : '';
}

function showPanel(id, opts){
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.t === id));
  document.querySelectorAll('.panel').forEach(p => {
    const was = p.classList.contains('active');
    p.classList.toggle('active', p.id === id);
    // 떠나는 탭에서 틀어 둔 유튜브를 카드로 되돌린다 — 숨긴다고 소리가 멎지 않는다
    if (was && p.id !== id) stopYoutubeIn(p);
  });
  const panel = document.getElementById(id);
  if (panel) reveal(panel);
  // 지금 보고 있는 탭을 주소에 남긴다 — 주소창을 그대로 복사하면 그 탭이 열린 링크가 된다.
  // replaceState 라서 뒤로가기는 이 페이지에 들어오기 전으로 간다.
  if (!(opts && opts.silent) && panel) {
    const u = new URL(location.href);
    u.searchParams.set('tab', id);
    history.replaceState(null, '', u);
  }
}

// 탭 줄 맨 끝에 "＋ 일정 추가" 를 붙인다. (관리자에게만)
function addTabLinkButton(){
  if (document.querySelector('.tab-link')) return;
  if (!isAdmin) return;

  // 지금 열려 있는 날짜 탭을 관리 화면에 넘겨줘서, 들어가자마자 그 날짜가 골라져 있게 한다.
  const add = document.createElement('a');
  add.className = 'tab-link tab-add';
  add.textContent = '＋ 일정 추가';
  add.title = '지금 보고 있는 날짜에 일정을 추가합니다';
  add.href = './admin.html?slug=' + encodeURIComponent(CONFIG.eventSlug);
  add.addEventListener('click', () => {
    // 누르는 순간의 활성 탭을 넘긴다. 갤러리·노트처럼 날짜가 아닌 탭에서는 날짜를 안 붙임.
    const act = document.querySelector('.tab.active');
    const id = act && act.dataset.t;
    add.href = './admin.html?slug=' + encodeURIComponent(CONFIG.eventSlug) +
      (id && PANEL_DATE[id] ? '&addPanel=' + encodeURIComponent(id) : '');
  });
  tabsEl.appendChild(add);
}

// 주소의 ?tab= 을 실제 탭으로 옮긴다.
// 탭 id(d1, gallery, custom-3) 를 그대로 받고, 날짜(10-04, 1004)로도 찾을 수 있게 했다.
function panelIdFromQuery(raw){
  if (!raw) return null;
  const want = String(raw).trim();
  if (document.getElementById(want)) return want;

  const digits = want.replace(/[^0-9]/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const mm = +digits.slice(0, digits.length - 2), dd = +digits.slice(-2);
    for (const id in PANEL_DATE) {
      const d = PANEL_DATE[id];
      if (d && d[1] + 1 === mm && d[2] === dd && document.getElementById(id)) return id;
    }
  }
  // 탭 이름으로도 찾기 (이모지·공백 무시)
  const norm = t => t.replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase();
  const hit = [...document.querySelectorAll('.tab')]
    .find(t => norm(t.textContent) === norm(want));
  return hit ? hit.dataset.t : null;
}

let PANEL_DATE = {};
function markNow(panel){
  panel.querySelectorAll('.now-tag').forEach(e => e.remove());
  panel.querySelectorAll('.item').forEach(i => i.classList.remove('now'));
  const pd = PANEL_DATE[panel.id];
  if (!pd) return;
  const now = new Date();
  if (now.getFullYear() !== pd[0] || now.getMonth() !== pd[1] || now.getDate() !== pd[2]) return;
  const hm = now.getHours() * 60 + now.getMinutes();
  let nowItem = null;
  panel.querySelectorAll('.item').forEach(it => {
    const t = it.querySelector('.time'); if (!t) return;
    const m = t.textContent.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/); if (!m) return;
    const s = +m[1]*60 + +m[2], e = +m[3]*60 + +m[4];
    if (hm >= s && hm < e) {
      it.classList.add('now'); if (!nowItem) nowItem = it;
      // 시각 바로 뒤에 붙인다. 카드 맨 앞에 넣으면 시각·제목 줄 위로 혼자 떨어진다.
      t.insertAdjacentHTML('afterend', '<span class="now-tag">지금</span>');
    }
  });
  if (nowItem) setTimeout(() => nowItem.scrollIntoView({behavior:'smooth', block:'center'}), 400);
}

let firstProgressRun = true;
function updateProgress(){
  const [sy,sm,sd] = CONFIG.startDate, [ey,em,ed] = CONFIG.endDate;
  const start = new Date(sy,sm,sd), end = new Date(ey,em,ed,23,59,59), now = new Date();
  const dd = $('#dday'), fill = $('#progFill'), txt = $('#progTxt');
  const d = Math.ceil((start-now)/86400000);
  const applyWidth = pct => { if (firstProgressRun) setTimeout(() => fill.style.width = pct + '%', 300); else fill.style.width = pct + '%'; };
  if (now < start) {
    dd.textContent = '일정까지 D-' + d + ' 🔥';
    txt.textContent = '설레는 마음으로 준비 중이에요';
    applyWidth(0);
  } else if (now <= end) {
    dd.textContent = '🔥 일정 진행 중! 🔥';
    const pct = Math.round((now-start)/(end-start)*100);
    applyWidth(pct);
    const day = Math.floor((now-start)/86400000) + 1;
    txt.textContent = '일정 ' + day + '일째 · ' + pct + '% 진행';
  } else {
    dd.textContent = '일정 마침';
    applyWidth(100);
    txt.textContent = '모든 일정 마침 · 100%';
  }
  // 끝난 이벤트에서 막대는 늘 100% 라 첫 화면 자리만 차지한다
  const box = document.querySelector('.prog');
  if (box) box.classList.toggle('done', now > end);
  firstProgressRun = false;
}

let c = 0;
$('#logo').addEventListener('click', () => {
  if (++c >= 3) {
    const e = $('#egg'); e.style.display = 'block';
    $('#logoIcon').style.transform = 'rotate(360deg) scale(1.2)';
    c = 0;
    setTimeout(() => { e.style.display = 'none'; $('#logoIcon').style.transform = ''; }, 4000);
  }
});

// 일정 행을 먼저 읽어옴 — 어떤 날짜에 내용이 있는지 알아야 탭을 만들 수 있어서.
// 실패하면 null 을 돌려주고, 그 경우엔 날짜 탭을 거르지 않고 모두 보여줌.
//
// 여기서 받은 줄을 한 번만 물려준다. 바로 뒤에 도는 loadGallery 가 「사진이 붙은
// 일정」을 또 물어보고 있었는데, 그건 방금 받은 것의 부분집합이라 첫 그림에
// 왕복이 하나 더 붙던 자리였다. 한 번 쓰고 버리는 이유는 사진을 올리면 일정이
// 새로 생길 수 있어서다 — 두 번째부터는 늘 새로 받는다.
let scheduleRowsOnce = null;
async function fetchScheduleRows(){
  const { data, error } = await sb.from('events').select('*')
    .eq('event_id', CONFIG.eventSlug)
    .order('panel', {ascending:true}).order('sort_order', {ascending:true});
  if (error) { console.error('일정 로딩 오류:', error); return null; }
  scheduleRowsOnce = data || [];
  const byPanel = {};
  (data || []).forEach(r => (byPanel[r.panel] = byPanel[r.panel] || []).push(r));
  return byPanel;
}

// 내용이 없는 날짜는 탭이 사라지므로, 관리자에게는 일정을 넣으러 갈 링크를 따로 보여줌
function showAdminAddLink(byPanel){
  if (!isAdmin) return;
  const total = CONFIG.startDate && CONFIG.endDate
    ? buildDatePanels(CONFIG.startDate, CONFIG.endDate).filter(p => p.dateKey).length : 0;
  const shown = CONFIG.panels.filter(p => p.dateKey).length;
  if (shown >= total) return;                       // 모든 날짜가 이미 보이면 굳이 안 띄움

  const note = document.createElement('div');
  note.style.cssText = 'text-align:center; margin:-6px 0 16px; font-size:12.5px; color:var(--ink-soft);';
  note.innerHTML =
    '내용이 없는 날짜 ' + (total - shown) + '일은 탭에서 숨겨졌어요 · ' +
    '<a href="./admin.html?slug=' + encodeURIComponent(CONFIG.eventSlug) + '" ' +
    'style="color:var(--accent); font-weight:700;">일정 추가하기</a>';
  tabsEl.insertAdjacentElement('afterend', note);
}

function renderSchedule(byPanel){
  CONFIG.panels.forEach(p => {
    const panel = document.getElementById(p.id);
    if (!panel) return;
    // 일정표가 없는 탭(갤러리·지도·노트)은 건너뛴다.
    // id 를 하나씩 적어 두면 탭을 새로 만들 때마다 여기를 같이 고쳐야 하고,
    // 잊으면 그 자리에서 터져서 뒤따르는 초기화가 통째로 멈춘다 — 실제로 그랬다.
    const timeline = panel.querySelector('.timeline');
    if (!timeline) return;
    const rows = byPanel[p.id];

    if (!rows || !rows.length) {
      const addBtn = isAdmin ? '<a class="add-schedule-btn" href="./admin.html?slug=' + CONFIG.eventSlug + '&addPanel=' + p.id + '">+ 일정 추가하기</a>' : '';
      timeline.insertAdjacentHTML('beforeend', '<div class="empty-msg">아직 등록된 일정이 없습니다' + (addBtn ? '<br>' + addBtn : '') + '</div>');
      return;
    }

    rows.forEach(r => {
      // 설명에 유튜브 주소만 홀로 적힌 줄이 있으면 그 줄은 빼고 영상 칸으로 만든다.
      // 새 칸을 따로 만들지 않은 건, 영상이 붙는 자리는 결국 "그날 그 일" 옆이라서다.
      const cut = pullYoutubeLines(r.detail);
      const detail = cut.text
        ? '<div class="row"><span class="ic">📌</span><span class="detail-text">' + escapeHTML(cut.text) + '</span></div>' : '';
      const videos = cut.ids.length
        ? '<div class="item-videos">' + cut.ids.map(id => youtubeCardHTML(id, r.title)).join('') + '</div>' : '';
      // 대표 사진(image_url) 뒤에 추가 사진(extra_images)을 이어 붙여 여러 장을 모두 보여줌
      const shots = (r.image_url
        ? [{ url: r.image_url, thumb: r.thumb_url || null, taken_at: r.taken_at, location_name: r.location_name }]
        : []).concat(Array.isArray(r.extra_images) ? r.extra_images : []);
      // 사진 칸은 250px 남짓인데 원본은 4000px 이 넘는다. 사본이 있으면 그것만 받고,
      // 눌러서 크게 볼 때 쓸 원본 주소는 data-full 에 달아 둔다.
      //
      // 여러 장이면 두 칸으로 놓는다 — 한 장씩 세로로만 쌓으면 하루가 한없이 길어진다.
      // 홀수면 첫 장을 두 칸에 걸쳐 크게 두어 빈 칸 없이 채운다(그날의 대표 사진이 된다).
      const many = shots.length > 1;
      const lead = many && shots.length % 2 === 1;
      const image = !shots.length ? '' :
        '<div class="shots' + (many ? ' many' : '') + '">' + shots.map((sh, i) =>
          '<div class="item-img-wrap' + (lead && i === 0 ? ' lead' : '') + '">' +
          '<img class="item-img" src="' + escapeHTML(sh.thumb || sh.url) +
          '" data-full="' + escapeHTML(sh.url) + '" loading="lazy" data-event-id="' + r.id + '" alt="">'
          + '</div>').join('') + '</div>';
      const editBtn = isAdmin ? '<a class="item-edit" href="./admin.html?slug=' + CONFIG.eventSlug + '&edit=' + r.id + '">✏️ 수정</a>' : '';
      timeline.insertAdjacentHTML('beforeend',
        '<div class="item" data-id="' + r.id + '">' + editBtn +
          '<div class="item-line' + (isAdmin ? ' has-edit' : '') + '">' +
            '<span class="time">' + escapeHTML(r.time || '') + '</span>' +
            '<h3 class="title">' + escapeHTML(r.title) + '</h3>' +
            placeChipHTML(r.place_name, r.place_lat, r.place_lng) +
          '</div>' + detail + videos + image + '</div>');
    });
  });

  reveal(document.querySelector('.panel.active'));
}

// GALLERY_BUCKET · IMAGE_LIMIT(5MB) · VIDEO_LIMIT(100MB) 과 갤러리에 파일을 넣는
// putGalleryFile 은 common.js 에 있다 — 이벤트 목록에서도 같은 절차로 사진을 올린다.
// (여기서 다시 선언하면 이름이 겹쳐 페이지가 멈춘다)
let galleryItems = [];

// 이 일정과 이어진 작품 — 포트폴리오에서 "그날 일정"으로 고른 것들.
// 작품과 경험이 각자 다른 서랍에 있던 것을 잇는 쪽 절반.
async function loadLinkedWorks(){
  const { data, error } = await sb.from('works')
    .select('id, title, media_url, media_type, author, made_on')
    .eq('event_id', CONFIG.eventSlug)
    .order('made_on', { ascending:true, nullsFirst:false });
  if (error || !data || !data.length) return;

  const panel = document.getElementById('gallery');
  if (!panel) return;
  const box = document.createElement('div');
  box.className = 'linked-works';
  box.innerHTML = '<div class="lw-head">🎨 이날 만든 작품 ' + data.length + '개</div>' +
    '<div class="lw-strip">' + data.map(w =>
      '<a class="lw-item" href="/portfolio.html" title="' + escapeHTML(w.title) + '">' +
        (w.media_type === 'youtube'
          ? youtubeThumbHTML(youtubeId(w.media_url), w.title, '', '108px') + '<span class="lw-play"></span>'
          : w.media_type === 'video'
          ? '<video src="' + escapeHTML(w.media_url) + '" preload="metadata" muted></video>'
          : '<img src="' + escapeHTML(w.media_url) + '" loading="lazy" alt="' + escapeHTML(w.title) + '">') +
        '<span>' + escapeHTML(w.title) + '</span>' +
      '</a>').join('') + '</div>';
  panel.insertBefore(box, panel.querySelector('.gallery-grid'));
}

async function loadGallery(){
  const grid = $('#galleryGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // 일정 줄은 방금 fetchScheduleRows 가 받아 둔 것이 있으면 그걸 쓴다(첫 그림 한 번).
  const handMeDown = scheduleRowsOnce;
  scheduleRowsOnce = null;
  const [galleryRes, eventsRes] = await Promise.all([
    sb.from('gallery_media').select('*').eq('event_id', CONFIG.eventSlug),
    handMeDown
      ? Promise.resolve({ data: handMeDown.filter(r => r.image_url) })
      : sb.from('events').select('*').eq('event_id', CONFIG.eventSlug).not('image_url', 'is', null),
  ]);
  if (galleryRes.error) console.error('갤러리 로딩 오류:', galleryRes.error);
  if (eventsRes.error) console.error('일정 사진 로딩 오류:', eventsRes.error);

  // thumb_url 을 여기서 빠뜨리면 아래 renderGalleryThumb 이 늘 원본으로 물러난다.
  // 갤러리 사본을 지난번에 만들어 두고도 격자가 계속 원본을 받아 온 이유가 이것이었다.
  const fromGallery = (galleryRes.data || []).map(r => ({
    id: r.id, media_url: r.media_url, thumb_url: r.thumb_url || null,
    media_type: r.media_type, created_at: r.created_at, source: 'gallery',
    taken_at: r.taken_at, location_name: r.location_name, is_best: !!r.is_best,
  }));
  // 일정 하나에 사진이 여러 장이면 전부 갤러리에 넣음. 추가 사진은 id 에 순번을 붙여 구분.
  const fromEvents = (eventsRes.data || []).flatMap(r => {
    const extra = Array.isArray(r.extra_images) ? r.extra_images : [];
    return [{
      id: r.id, media_url: r.image_url, thumb_url: r.thumb_url || null,
      media_type: 'image', created_at: r.created_at, source: 'event',
      taken_at: r.taken_at, location_name: r.location_name,
    }].concat(extra.map((sh, i) => ({
      id: r.id + ':' + i, media_url: sh.url, thumb_url: sh.thumb || null,
      media_type: 'image', created_at: r.created_at, source: 'event',
      taken_at: sh.taken_at || null, location_name: sh.location_name || null,
    })));
  });

  // 「사진으로 일정 만들기」로 만든 일정은 갤러리 사진의 주소를 그대로 물려받는다.
  // 그래서 위의 두 곳에서 같은 사진이 한 번씩 올라오고, 그냥 이으면 격자에
  // 같은 사진이 두 번 나온다("사진 N장" 수도 그만큼 부풀었다).
  //
  // 남기는 쪽은 갤러리다 — 지우기와 ★ 를 달 수 있는 줄이 그쪽이라서.
  // 갤러리에 없이 일정에만 붙은 사진(관리 화면에서 직접 첨부한 것)은 그대로 나온다.
  const seenUrls = new Set(fromGallery.map(r => r.media_url));
  const eventsOnly = fromEvents.filter(r => {
    if (seenUrls.has(r.media_url)) return false;
    seenUrls.add(r.media_url);      // 한 사진을 여러 일정이 나눠 쓴 경우도 한 번만
    return true;
  });

  // 촬영 시각(EXIF) 기준 오름차순 정렬 — 먼저 찍힌 사진이 먼저 나옴.
  // EXIF 날짜가 없는 사진/영상은 맨 뒤로 밀리고, 그 안에서는 업로드 순으로 정렬됨.
  galleryItems = [...fromGallery, ...eventsOnly].sort((a, b) => {
    const aHas = !!a.taken_at, bHas = !!b.taken_at;
    if (aHas && bHas) return new Date(a.taken_at) - new Date(b.taken_at);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  $('#galleryEmpty').style.display = galleryItems.length ? 'none' : 'block';
  galleryItems.forEach((r, i) => grid.appendChild(renderGalleryThumb(r, i)));
  countDay(grid.closest('.panel'));       // 갤러리 탭의 "사진 N장"
}

function renderGalleryThumb(r, index){
  const isVideo = r.media_type === 'video';
  const thumb = document.createElement('div');
  thumb.className = 'gallery-thumb' + (isVideo ? ' is-video' : '');
  thumb.innerHTML = isVideo
    ? '<video src="' + escapeHTML(r.media_url) + '" preload="metadata" muted></video>'
    // 손톱만 한 칸이다. 사본이 있으면 원본을 받지 않는다.
    : '<img src="' + escapeHTML(r.thumb_url || r.media_url) + '" loading="lazy" alt="">';
  thumb.addEventListener('click', () => openLightbox(index));

  // 베스트 컷 — 표시는 모두에게 보이고, 고르는 것은 부모만.
  // 일정에 붙은 사진(source==='event')은 gallery_media 에 줄이 없어서 못 고른다.
  if (r.is_best) thumb.classList.add('best');
  if (isAdmin && r.source === 'gallery') {
    const star = document.createElement('button');
    star.className = 'gallery-star' + (r.is_best ? ' on' : '');
    star.textContent = r.is_best ? '★' : '☆';
    star.title = r.is_best ? '베스트에서 빼기' : '베스트 컷으로';
    star.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const want = !r.is_best;
      star.disabled = true;
      const { error } = await sb.from('gallery_media').update({ is_best: want }).eq('id', r.id);
      star.disabled = false;
      if (error) { alert('저장 실패: ' + error.message); return; }
      r.is_best = want;
      star.textContent = want ? '★' : '☆';
      star.classList.toggle('on', want);
      star.title = want ? '베스트에서 빼기' : '베스트 컷으로';
      thumb.classList.toggle('best', want);
    });
    thumb.appendChild(star);
  } else if (r.is_best) {
    const mark = document.createElement('span');
    mark.className = 'gallery-star mark';
    mark.textContent = '★';
    thumb.appendChild(mark);
  }

  if (isAdmin && r.source === 'gallery') {
    const del = document.createElement('button');
    del.className = 'gallery-del';
    del.textContent = '✕';
    del.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (!confirm('이 파일을 삭제할까요?')) return;
      // 사진으로 일정을 만들면 갤러리 사진의 주소가 그대로 일정에도 붙는다.
      // 그런 사진은 파일을 남기고 줄만 지운다 — 안 그러면 일정 쪽 사진이 깨진다.
      // 사본도 마찬가지다. 일정 목록이 바로 그 사본을 쓰고 있으므로 같이 남겨야 한다.
      const stillUsed = await usedBySchedule(r.media_url, r.thumb_url);
      const { error } = await sb.from('gallery_media').delete().eq('id', r.id);
      if (error) { alert('삭제 실패: ' + error.message); return; }
      if (!stillUsed) await removeStored(GALLERY_BUCKET, [r.media_url, r.thumb_url]);
      loadGallery();
  loadLinkedWorks();
    });
    thumb.appendChild(del);
  }
  return thumb;
}

// 이 사진(또는 사본)이 일정(events)에도 붙어 있는지. 붙어 있으면 파일을 남겨야 한다.
// 확인하지 못하면 "쓰이고 있다"로 친다 — 잘못 지우는 것보다 남기는 쪽이 낫다.
async function usedBySchedule(...urls){
  const want = urls.filter(Boolean);
  if (!want.length) return true;
  const { data, error } = await sb.from('events')
    .select('id, image_url, thumb_url, extra_images').eq('event_id', CONFIG.eventSlug);
  if (error) { console.warn('일정 확인 실패, 파일은 남깁니다:', error.message); return true; }
  const inUse = new Set();
  (data || []).forEach(r => {
    if (r.image_url) inUse.add(r.image_url);
    if (r.thumb_url) inUse.add(r.thumb_url);
    (Array.isArray(r.extra_images) ? r.extra_images : []).forEach(x => {
      if (!x) return;
      if (x.url) inUse.add(x.url);
      if (x.thumb) inUse.add(x.thumb);      // 일정 목록이 바로 이 사본을 쓴다
    });
  });
  return want.some(u => inUse.has(u));
}

// ----- 같은 사진 다시 올리는 것 막기 -----
// 파일 이름 + EXIF(촬영시각·장소)가 이미 올라간 사진과 같으면 업로드를 건너뜀.
// 5MB가 넘는 사진은 저장할 때 .jpg 로 바뀌므로 확장자는 빼고 비교함.
function photoFingerprint(name, takenAt, place){
  const base = String(name || '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')    // 저장 경로를 만들 때와 같은 규칙
    .replace(/\.\w+$/, '')
    .toLowerCase();
  return base + '|' + normTakenAt(takenAt) + '|' + (place || '');
}

// DB 는 "2024-10-03T05:45:01+00:00", EXIF 는 "2024-10-03T05:45:01.000Z" 로 같은 시각을
// 다른 문자열로 준다. 그대로 비교하면 영영 안 맞으므로 밀리초 숫자로 통일함.
function normTakenAt(v){
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : String(d.getTime());
}

// 저장 경로에서 원래 파일 이름만 되돌림
//   "slug/1699999999999-ab12cd-photo.jpg" -> "photo.jpg"
function nameFromStoredUrl(url){
  try {
    const last = decodeURIComponent(String(url).split('?')[0].split('/').pop() || '');
    return last.replace(/^\d{10,}-[a-z0-9]{1,8}-/i, '').replace(/^\d{10,}-/, '');
  } catch (e) { return ''; }
}

// 이 이벤트에 이미 등록된 사진들의 지문 모음 (갤러리 + 일정 첨부 모두)
async function existingPhotoFingerprints(){
  const set = new Set();
  const [gal, ev] = await Promise.all([
    sb.from('gallery_media').select('media_url, taken_at, location_name').eq('event_id', CONFIG.eventSlug),
    sb.from('events').select('*').eq('event_id', CONFIG.eventSlug).not('image_url', 'is', null),
  ]);
  (gal.data || []).forEach(r =>
    set.add(photoFingerprint(nameFromStoredUrl(r.media_url), r.taken_at, r.location_name)));
  (ev.data || []).forEach(r => {
    set.add(photoFingerprint(nameFromStoredUrl(r.image_url), r.taken_at, r.location_name));
    (Array.isArray(r.extra_images) ? r.extra_images : []).forEach(sh =>
      set.add(photoFingerprint(nameFromStoredUrl(sh.url), sh.taken_at, sh.location_name)));
  });
  return set;
}

async function uploadGalleryFiles(fileList){
  const files = Array.from(fileList);
  if (!files.length) return;
  const msg = $('#galleryMsg'), btn = $('#uploadBtn');
  if (btn) btn.classList.add('uploading');
  let okCount = 0;
  const skipped = [];
  let blankedGps = 0;                    // 휴대폰이 위치를 지우고 넘긴 사진 수

  msg.className = 'gallery-msg'; msg.textContent = '이미 올라간 사진 확인 중...';
  const seen = await existingPhotoFingerprints();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    msg.className = 'gallery-msg'; msg.textContent = '업로드 중... (' + (i+1) + '/' + files.length + ') ' + file.name;
    const check = validateGalleryFile(file);
    if (!check.ok) {
      msg.className = 'gallery-msg err'; msg.textContent = check.reason;
      continue;
    }
    try {
      let taken_at = null, location_name = null;
      if (!check.isVideo) {
        // 압축 전에 EXIF 를 먼저 읽어 중복이면 바로 건너뜀 (헛되이 압축하지 않도록)
        const meta = await extractPhotoMeta(file);
        taken_at = meta.takenAtISO; location_name = meta.place || null;
        if (meta.gps === 'blanked') blankedGps++;
      }
      const fp = photoFingerprint(file.name, taken_at, location_name);
      if (seen.has(fp)) { skipped.push(file.name); continue; }
      seen.add(fp);                          // 이번에 고른 파일들 사이의 중복도 함께 거름
      if (!check.isVideo) msg.textContent = '압축 중... (' + (i+1) + '/' + files.length + ') ' + file.name;
      await putGalleryFile(CONFIG.eventSlug, file,
        { isVideo: check.isVideo, taken_at, location_name });
      okCount++;
    } catch (err) {
      msg.className = 'gallery-msg err'; msg.textContent = file.name + ' 업로드 실패: ' + err.message;
    }
  }

  if (btn) btn.classList.remove('uploading');
  const parts = [];
  if (okCount) parts.push(okCount + '개 업로드 완료!');
  if (skipped.length) parts.push('이미 올라간 사진 ' + skipped.length + '개는 건너뛰었어요 (' + skipped.join(', ') + ')');
  // 위치가 왜 비었는지 말해 주지 않으면, 사이트가 못 읽은 건지 사진에 없던 건지 알 길이 없다.
  if (blankedGps) parts.push('사진 ' + blankedGps + '장은 휴대폰이 위치를 지우고 보내서 장소가 안 들어갔어요 (사진 자체에는 남아 있어요)');
  if (parts.length) {
    msg.className = 'gallery-msg ' + (okCount ? 'ok' : '');
    msg.textContent = parts.join(' · ');
    // 사진을 막 올린 지금이 일정을 만들기 제일 좋은 때라, 그 자리에서 이어 갈 수 있게 둔다
    if (okCount) {
      msg.insertAdjacentHTML('beforeend',
        ' · <a href="#" id="autoLink">🪄 이 사진들로 일정 만들기</a>');
      const link = $('#autoLink');
      if (link) link.addEventListener('click', e => { e.preventDefault(); openScheduleProposal(); });
    }
  }
  if (okCount) loadGallery();
}

// ---------------------------------------------------------------------------
// 사진으로 일정 만들기
//
// 일정을 한 줄씩 손으로 적는 게 제일 고된 일이라, 이미 올라간 사진의 촬영 시각으로
// 초안을 뽑아 준다. 다만 바로 쓰지 않고 미리보기를 먼저 보여준다 — 잘못 만들어진
// 일정은 관리 화면에서 하나씩 지워야 해서, 되돌리는 비용이 만드는 비용보다 크다.
//
// 묶는 기준은 "몇 시부터 두 시간" 같은 고정 칸이 아니라 사진 사이의 간격이다.
// 11:55 과 12:05 처럼 붙어 찍은 두 장이 정각을 사이에 뒀다는 이유로 갈라지면
// 안 되기 때문. 대신 한 덩어리가 두 시간을 넘지 않게 상한을 둔다.
// ---------------------------------------------------------------------------
const GROUP_GAP_MIN = 40;    // 이만큼 벌어지면 다른 덩어리
const GROUP_MAX_MIN = 120;   // 한 덩어리의 최대 길이
const COVER_MAX = 3;         // 일정에 붙일 대표 사진 수

// 날짜 탭은 내용이 있는 날만 남기고 걸러지므로(PANEL_DATE), 사진이 있는 빈 날을
// 찾으려면 거르기 전의 전체 날짜 목록이 필요하다.
function panelIdForDate(d){
  if (!CONFIG.startDate || !CONFIG.endDate) return null;
  const all = buildDatePanels(CONFIG.startDate, CONFIG.endDate);
  for (const p of all) {
    if (!p.dateKey) continue;
    const [y, m, dd] = p.dateKey;
    if (d.getFullYear() === y && d.getMonth() === m && d.getDate() === dd) return p.id;
  }
  return null;
}

function clusterShots(shots){
  const sorted = shots.slice().sort((a, b) => a.t - b.t);
  const groups = [];
  let cur = null;
  sorted.forEach(sh => {
    if (cur && (sh.t - cur[cur.length - 1].t) / 60000 <= GROUP_GAP_MIN) { cur.push(sh); return; }
    cur = [sh];
    groups.push(cur);
  });
  // 두 시간을 넘는 덩어리는 나누되, 시계가 두 시간을 가리키는 자리가 아니라
  // 사진이 가장 크게 끊긴 자리에서 자른다. 1분 간격으로 이어 찍은 사진이
  // 정각을 사이에 뒀다는 이유로 갈라지지 않도록.
  return groups.reduce((acc, g) => acc.concat(splitLongGroup(g)), []);
}

function splitLongGroup(g){
  if (g.length < 2) return [g];
  if ((g[g.length - 1].t - g[0].t) / 60000 <= GROUP_MAX_MIN) return [g];

  // 자를 자리는 가운데 쪽에서만 찾는다. 끝자락을 골라 한 장씩 떼어내면
  // 아주 촘촘히 찍은 무리가 낱개로 흩어지기 때문.
  const lo = Math.max(1, Math.floor(g.length * 0.2));
  const hi = Math.max(lo + 1, Math.ceil(g.length * 0.8));
  let cutAt = lo, widest = -1;
  for (let i = lo; i < hi && i < g.length; i++) {
    const gap = g[i].t - g[i - 1].t;
    if (gap > widest) { widest = gap; cutAt = i; }
  }
  return splitLongGroup(g.slice(0, cutAt)).concat(splitLongGroup(g.slice(cutAt)));
}

// 처음·중간·끝 — 그 시간대가 어떻게 흘렀는지가 석 장에 담긴다
function pickCovers(g){
  if (g.length <= COVER_MAX) return g.slice();
  return [g[0], g[Math.floor(g.length / 2)], g[g.length - 1]];
}

function twoDigit(n){ return String(n).padStart(2, '0'); }

// 시각은 30분 단위로 뭉뚱그린다. 12:29-13:57 은 일정표에 12:30-14:00 으로 오른다.
// 사진이 정확히 그 시각에 찍혔는지는 중요하지 않고, 대강 언제였는지만 알면 되기 때문.
// 반올림이라 앞뒤 순서가 뒤집히지 않는다 — 뒤 덩어리의 첫 사진은 앞 덩어리의 마지막
// 사진보다 늦으므로, 반올림한 뒤에도 늦거나 같다. 그래서 다음 일정과 겹칠 수 없다.
const ROUND_MIN = 30;

function roundClock(t){
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  return Math.min(Math.round(m / ROUND_MIN) * ROUND_MIN, 24 * 60);
}
function clockLabel(mins){
  return twoDigit(Math.floor(mins / 60)) + ':' + twoDigit(mins % 60);
}

// 제목은 GPS 로 얻은 지명이 있으면 그걸 쓰고, 없으면 시간대 이름을 넣는다.
// 어느 쪽이든 미리보기에서 고쳐 쓸 수 있으니 빈칸으로 두지 않는다.
function guessTitle(g){
  const place = g.map(x => x.place).find(Boolean);
  if (place) return place;
  // 한 날에 같은 이름이 여러 번 나오면 고쳐 쓰기가 번거로워서 구간을 잘게 뒀다
  const h = new Date(g[0].t).getHours();
  if (h < 9)  return '아침';
  if (h < 12) return '오전';
  if (h < 14) return '점심 무렵';
  if (h < 16) return '이른 오후';
  if (h < 18) return '늦은 오후';
  if (h < 20) return '저녁';
  return '밤';
}

let proposals = [];

async function openScheduleProposal(){
  const box = $('#propBox'), btn = $('#autoBtn'), msg = $('#galleryMsg');
  if (btn) btn.disabled = true;
  box.innerHTML = '';
  msg.className = 'gallery-msg'; msg.textContent = '사진을 살펴보는 중...';

  const [gal, ev] = await Promise.all([
    sb.from('gallery_media').select('*').eq('event_id', CONFIG.eventSlug),
    sb.from('events').select('*').eq('event_id', CONFIG.eventSlug),
  ]);
  if (btn) btn.disabled = false;
  if (gal.error || ev.error) {
    msg.className = 'gallery-msg err';
    msg.textContent = '사진을 불러오지 못했어요: ' + ((gal.error || ev.error).message);
    return;
  }

  // 이미 일정에 붙어 있는 사진은 다시 제안하지 않는다 — 여러 번 눌러도 안전하도록
  const used = new Set();
  (ev.data || []).forEach(r => {
    if (r.image_url) used.add(r.image_url);
    (Array.isArray(r.extra_images) ? r.extra_images : []).forEach(x => x && x.url && used.add(x.url));
  });

  const media = gal.data || [];
  let noTime = 0, alreadyUsed = 0;
  const shots = [];
  media.forEach(m => {
    if (used.has(m.media_url)) { alreadyUsed++; return; }
    if (!m.taken_at) { noTime++; return; }
    const t = new Date(m.taken_at).getTime();
    if (isNaN(t)) { noTime++; return; }
    shots.push({ url: m.media_url, thumb: m.thumb_url || null, t, taken_at: m.taken_at,
                 place: m.location_name || '', isVideo: m.media_type === 'video' });
  });

  // 행사 기간 밖에서 찍힌 사진은 넣을 날짜 탭이 없다
  const outside = [];
  const inside = [];
  shots.forEach(sh => {
    const pid = panelIdForDate(new Date(sh.t));
    if (pid) { sh.panel = pid; inside.push(sh); } else outside.push(sh);
  });

  // 날짜별로 먼저 갈라 놓고 묶는다. 자정을 사이에 둔 사진이 한 덩어리가 되면
  // 어느 날 탭에 넣어야 할지 정할 수 없기 때문.
  const byPanel = {};
  inside.forEach(sh => (byPanel[sh.panel] = byPanel[sh.panel] || []).push(sh));

  proposals = [];
  Object.keys(byPanel).sort().forEach(pid => {
    clusterShots(byPanel[pid]).forEach(g => {
      const covers = pickCovers(g);
      const from = roundClock(g[0].t), to = roundClock(g[g.length - 1].t);
      proposals.push({
        panel: pid,
        // 뭉뚱그린 뒤 같은 칸에 떨어지면(사진 몇 장을 몇 분 사이에 찍은 경우)
        // 없는 길이를 지어내지 않고 한 시각만 적는다
        time: from === to ? clockLabel(from) : clockLabel(from) + ' - ' + clockLabel(to),
        title: guessTitle(g),
        count: g.length,
        covers,
        on: true,
      });
    });
  });

  const notes = [];
  if (alreadyUsed) notes.push('이미 일정에 쓰인 사진 ' + alreadyUsed + '장은 뺐어요');
  if (noTime)      notes.push('촬영 시각이 없는 파일 ' + noTime + '개는 뺐어요 (영상은 대개 시각이 없어요)');
  if (outside.length) notes.push('행사 기간 밖에서 찍힌 사진 ' + outside.length + '장은 넣을 날짜가 없어요');

  if (!proposals.length) {
    msg.className = 'gallery-msg';
    msg.textContent = ['만들 수 있는 일정이 없어요.'].concat(notes).join(' · ');
    return;
  }

  msg.textContent = '';
  renderProposal(notes);
}

function renderProposal(notes){
  const dayLabel = pid => {
    const p = buildDatePanels(CONFIG.startDate, CONFIG.endDate).find(x => x.id === pid);
    return p && p.dateKey ? formatDateLabel(p.dateKey) : pid;
  };

  let html =
    '<div class="prop">' +
    '<h4>이렇게 만들까요?</h4>' +
    '<p class="lead">사진 찍힌 시각으로 ' + proposals.length + '개를 뽑았어요. ' +
    '이름은 고쳐 쓸 수 있고, 뺄 것은 체크를 풀면 됩니다.' +
    (notes.length ? '<br>' + escapeHTML(notes.join(' · ')) : '') + '</p>';

  let lastPanel = null;
  proposals.forEach((p, i) => {
    if (p.panel !== lastPanel) {
      html += '<div class="prop-when" style="margin-top:10px;">' + escapeHTML(dayLabel(p.panel)) + '</div>';
      lastPanel = p.panel;
    }
    html +=
      '<label class="prop-item" data-i="' + i + '">' +
        '<input type="checkbox" checked>' +
        '<span class="prop-main">' +
          '<span class="prop-when">' + escapeHTML(p.time) + '</span>' +
          '<input type="text" value="' + escapeHTML(p.title) + '" placeholder="일정 이름">' +
          '<span class="prop-shots">' +
            p.covers.map(c => '<img src="' + escapeHTML(c.thumb || c.url) + '" loading="lazy" alt="">').join('') +
          '</span>' +
          '<span class="prop-note">사진 ' + p.count + '장 중 ' + p.covers.length + '장을 일정에 붙여요' +
            (p.count > p.covers.length ? ' (나머지는 갤러리에 그대로 있어요)' : '') + '</span>' +
        '</span>' +
      '</label>';
  });

  html +=
    '<div class="prop-btns">' +
      '<button type="button" class="upload-btn" id="propGo">일정 만들기</button>' +
      '<button type="button" class="auto-btn" id="propCancel">닫기</button>' +
      '<span class="prop-note" id="propMsg"></span>' +
    '</div></div>';

  const box = $('#propBox');
  box.innerHTML = html;

  // 위임 처리는 상자 자체에 걸리므로 한 번만 단다. 두 번 열 때마다 겹쳐 달면
  // 같은 이벤트가 두 번씩 처리된다.
  if (box.dataset.bound) { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
  box.dataset.bound = '1';

  box.addEventListener('change', e => {
    const item = e.target.closest('.prop-item');
    if (!item) return;
    const p = proposals[+item.dataset.i];
    if (e.target.type === 'checkbox') { p.on = e.target.checked; item.classList.toggle('off', !p.on); }
    if (e.target.type === 'text') p.title = e.target.value;
  });
  box.addEventListener('input', e => {
    if (e.target.type !== 'text') return;
    const item = e.target.closest('.prop-item');
    if (item) proposals[+item.dataset.i].title = e.target.value;
  });
  box.addEventListener('click', e => {
    if (e.target.id === 'propCancel') { box.innerHTML = ''; proposals = []; }
    if (e.target.id === 'propGo') createProposedItems();
  });
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function createProposedItems(){
  const go = $('#propGo'), pmsg = $('#propMsg');
  const picked = proposals.filter(p => p.on && p.title.trim());
  if (!picked.length) { pmsg.textContent = '만들 일정을 하나 이상 골라주세요.'; return; }

  go.disabled = true;
  pmsg.textContent = '만드는 중...';

  // 손으로 넣어 둔 일정 뒤에 붙인다. 이미 있는 줄의 순서는 건드리지 않는다.
  const { data: exist, error: exErr } = await sb.from('events')
    .select('panel, sort_order').eq('event_id', CONFIG.eventSlug);
  if (exErr) { go.disabled = false; pmsg.textContent = '실패: ' + exErr.message; return; }
  const base = {};
  (exist || []).forEach(r => {
    base[r.panel] = Math.max(base[r.panel] || 0, r.sort_order || 0);
  });

  const rows = picked.map(p => {
    const first = p.covers[0];
    // 갤러리 사진에는 이미 작은 사본이 있다. 일정에도 그대로 물려 줘야 목록에서 원본을 받지 않는다.
    const rest = p.covers.slice(1).map(c => ({ url: c.url, thumb: c.thumb || null,
                                               taken_at: c.taken_at, location_name: c.place || null }));
    base[p.panel] = (base[p.panel] || 0) + 1;
    return {
      event_id: CONFIG.eventSlug,
      panel: p.panel,
      sort_order: base[p.panel],
      time: p.time,
      title: p.title.trim(),
      detail: null,
      image_url: first.url,
      thumb_url: first.thumb || null,
      taken_at: first.taken_at,
      location_name: first.place || null,
      extra_images: rest,
    };
  });

  const { error } = await sb.from('events').insert(rows);
  if (error) {
    go.disabled = false;
    // 권한 거절은 원문이 영어라 무슨 말인지 알 수 없다. 실제로는 로그인이 풀린 경우다.
    pmsg.textContent = /row-level security|permission/i.test(error.message)
      ? '관리자로 로그인해야 만들 수 있어요. 로그인 뒤 다시 눌러주세요.'
      : '실패: ' + error.message;
    return;
  }

  pmsg.textContent = rows.length + '개를 만들었어요. 새로 고칩니다...';
  // 날짜 탭은 내용이 있어야 생기므로, 새 일정이 들어간 날 탭을 띄우려면 다시 그려야 한다
  setTimeout(() => location.reload(), 700);
}

// ---------------------------------------------------------------------------
// 이미 올라간 사진의 작은 사본 만들기
//
// 사본을 쓰기 시작한 건 나중이라, 그 전에 올린 사진에는 사본이 없다.
// 없는 것만 골라 한 번 훑어 만들어 준다. 한 장씩 처리하는 게 느려 보여도,
// 브라우저 메모리에 큰 사진을 여러 장 동시에 올리는 것보다 안전하다.
// ---------------------------------------------------------------------------
async function countMissingThumbs(){
  const btn = $('#thumbBtn');
  if (!btn) return;
  const { count, error } = await sb.from('gallery_media')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', CONFIG.eventSlug).eq('media_type', 'image').is('thumb_url', null);
  if (error || !count) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.textContent = '🗜 사진 ' + count + '장 가볍게 만들기';
}

async function makeGalleryThumbs(){
  const btn = $('#thumbBtn'), msg = $('#galleryMsg');
  btn.disabled = true;

  const { data, error } = await sb.from('gallery_media')
    .select('id, media_url')
    .eq('event_id', CONFIG.eventSlug).eq('media_type', 'image').is('thumb_url', null);
  if (error) {
    btn.disabled = false;
    msg.className = 'gallery-msg err'; msg.textContent = '목록을 읽지 못했어요: ' + error.message;
    return;
  }
  const rows = (data || []).map(r => ({ id: r.id, url: r.media_url }));
  if (!rows.length) { btn.hidden = true; btn.disabled = false; return; }

  const res = await backfillThumbs(
    GALLERY_BUCKET, rows,
    (id, thumb_url) => sb.from('gallery_media').update({ thumb_url }).eq('id', id),
    (i, n) => {
      msg.className = 'gallery-msg';
      msg.textContent = '가볍게 만드는 중... (' + i + '/' + n + ')';
    });

  btn.disabled = false;
  const parts = [res.made + '장 완료'];
  if (res.skipped) parts.push('이미 작은 사진 ' + res.skipped + '장은 그대로');
  if (res.failed)  parts.push(res.failed + '장 실패 — ' + res.why);
  msg.className = 'gallery-msg ' + (res.failed ? 'err' : 'ok');
  msg.textContent = parts.join(' · ');
  await countMissingThumbs();
  loadGallery();
}

let lightboxIndex = -1;
let lightboxPrevBtn, lightboxNextBtn;

function renderLightboxAt(index){
  const item = galleryItems[index];
  if (!item) return;
  lightboxIndex = index;
  const isVideo = item.media_type === 'video';
  const img = $('#lightboxImg'), vid = $('#lightboxVideo');
  if (isVideo) {
    img.style.display = 'none'; img.src = '';
    vid.style.display = 'block'; vid.src = item.media_url;
  } else {
    vid.style.display = 'none'; vid.pause(); vid.src = '';
    img.style.display = 'block'; img.src = item.media_url;
  }
  const metaLabel = photoMetaOverlayHTML(item.taken_at, item.location_name).replace(/<[^>]+>/g, '');
  const posLabel = galleryItems.length > 1 ? (index + 1) + ' / ' + galleryItems.length : '';
  $('#lightboxCaption').textContent = [posLabel, metaLabel].filter(Boolean).join('   ·   ');
  const multi = galleryItems.length > 1;
  lightboxPrevBtn.hidden = !multi;
  lightboxNextBtn.hidden = !multi;
  const play = $('#lightboxPlay');
  if (play) play.hidden = !multi;      // 한 장짜리에 슬라이드쇼는 우습다
  queueSlide();                        // 슬라이드쇼 중이면 다음 장을 예약
}

// 사진을 크게 띄우면 뒤로가기 자리를 하나 만들어 둔다. 손전화에서 창을 닫는
// 몸짓이 곧 뒤로가기라, 그냥 두면 사진 한 장 닫으려다 이벤트를 통째로 나가게 된다.
let lbPushed = false;

function openLightbox(index){
  renderLightboxAt(index);
  if (!lbPushed) { history.pushState({ lb:true }, ''); lbPushed = true; }
  $('#lightbox').classList.add('open');
}
// 화면만 정리한다. 뒤로가기 자리는 부르는 쪽이 맡는다.
function closeLightboxView(){
  stopSlideshow();
  $('#lightbox').classList.remove('open');
  const img = $('#lightboxImg'), vid = $('#lightboxVideo');
  img.src = ''; vid.pause(); vid.src = '';
  resetManualZoom();
}
// ✕ · ESC · 바깥 누르기 — 뒤로가기와 같은 길로 닫는다.
// 그래야 열고 닫을 때마다 자리가 쌓여 뒤로를 여러 번 눌러야 하는 일이 없다.
function closeLightbox(){
  if (!$('#lightbox').classList.contains('open')) return;
  if (lbPushed) { history.back(); return; }   // 아래 popstate 가 받아서 닫는다
  closeLightboxView();
}
window.addEventListener('popstate', () => {
  lbPushed = false;
  if ($('#lightbox').classList.contains('open')) closeLightboxView();
});

// ----- 슬라이드쇼 -----
// 여행 하나에 사진이 백 장 가까이 쌓인다. 소파에서 다 같이 볼 때
// 백 번 넘기지 않아도 되게. 사진은 4초씩, 영상은 끝나면 넘어간다.
const SLIDESHOW_MS = 4000;
let slideshowOn = false, slideshowTimer = null;
function queueSlide(){
  clearTimeout(slideshowTimer);
  if (!slideshowOn) return;
  const it = galleryItems[lightboxIndex];
  const vid = $('#lightboxVideo');
  if (it && it.media_type === 'video') {
    vid.onended = () => { vid.onended = null; if (slideshowOn) showNextMedia(); };
    vid.play().catch(() => {     // 자동재생이 막히면 영상도 사진처럼 시간으로 넘긴다
      slideshowTimer = setTimeout(() => { if (slideshowOn) showNextMedia(); }, SLIDESHOW_MS);
    });
  } else {
    slideshowTimer = setTimeout(() => { if (slideshowOn) showNextMedia(); }, SLIDESHOW_MS);
  }
}
function stopSlideshow(){
  slideshowOn = false;
  clearTimeout(slideshowTimer);
  $('#lightboxVideo').onended = null;
  const b = $('#lightboxPlay');
  if (b) b.textContent = '▶ 슬라이드쇼';
}
function showPrevMedia(){ resetManualZoom(); renderLightboxAt((lightboxIndex - 1 + galleryItems.length) % galleryItems.length); }
function showNextMedia(){ resetManualZoom(); renderLightboxAt((lightboxIndex + 1) % galleryItems.length); }

// ----- 더블탭/더블클릭으로 확대·축소 토글 + 확대 중 드래그로 이동 -----
let manualZoomed = false, zoomPanX = 0, zoomPanY = 0;
function currentLightboxMedia(){
  const img = $('#lightboxImg'), vid = $('#lightboxVideo');
  return img.style.display !== 'none' ? img : vid;
}
function applyZoomTransform(){
  const media = currentLightboxMedia();
  media.style.transform = manualZoomed
    ? 'translate(' + zoomPanX + 'px, ' + zoomPanY + 'px) scale(2.4)'
    : '';
}
function resetManualZoom(){
  manualZoomed = false; zoomPanX = 0; zoomPanY = 0;
  applyZoomTransform();
  $('#lightbox').classList.remove('zoomed');
}
function toggleZoom(){
  if (manualZoomed) { resetManualZoom(); return; }
  manualZoomed = true; zoomPanX = 0; zoomPanY = 0;
  applyZoomTransform();
  $('#lightbox').classList.add('zoomed');
}

const DOUBLE_TAP_MS = 420, DOUBLE_TAP_DIST = 50;

function setupLightboxInteractions(){
  lightboxPrevBtn = $('#lightboxPrev'); lightboxNextBtn = $('#lightboxNext');
  $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
  $('#lightboxClose').addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
  $('#lightboxPlay').addEventListener('click', (e) => {
    e.stopPropagation();
    if (slideshowOn) { stopSlideshow(); return; }
    slideshowOn = true;
    $('#lightboxPlay').textContent = '⏸ 멈추기';
    queueSlide();
  });
  lightboxPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); showPrevMedia(); });
  lightboxNextBtn.addEventListener('click', (e) => { e.stopPropagation(); showNextMedia(); });

  document.addEventListener('keydown', (e) => {
    if (!$('#lightbox').classList.contains('open')) return;
    if (e.key === 'ArrowLeft') showPrevMedia();
    else if (e.key === 'ArrowRight') showNextMedia();
    else if (e.key === 'Escape') closeLightbox();
  });

  $('#lightbox').addEventListener('dblclick', (e) => {
    if (e.target.id === 'lightboxImg' || e.target.id === 'lightboxVideo') {
      e.preventDefault();
      toggleZoom();
    }
  });

  // 확대된 상태면 넘기기 대신 드래그로 사진 안을 움직임. 짧은 탭 두 번(더블탭)이면 확대/축소.
  const lb = $('#lightbox');
  let startX = 0, startY = 0, tracking = false;
  let panning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

  lb.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; panning = false; return; }
    if (manualZoomed) {
      panning = true;
      panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
      panOriginX = zoomPanX; panOriginY = zoomPanY;
      return;
    }
    if (window.visualViewport && window.visualViewport.scale > 1.01) { tracking = false; return; }
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
  }, {passive:true});

  lb.addEventListener('touchmove', (e) => {
    if (!panning || e.touches.length !== 1) return;
    zoomPanX = panOriginX + (e.touches[0].clientX - panStartX);
    zoomPanY = panOriginY + (e.touches[0].clientY - panStartY);
    applyZoomTransform();
  }, {passive:true});

  lb.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX, endY = e.changedTouches[0].clientY;
    const isMediaTarget = e.target.id === 'lightboxImg' || e.target.id === 'lightboxVideo';

    if (panning) {
      panning = false;
      const moved = Math.abs(endX - panStartX) > 10 || Math.abs(endY - panStartY) > 10;
      if (!moved) {
        const now = Date.now();
        if (isMediaTarget && now - lastTapTime < DOUBLE_TAP_MS && Math.abs(endX - lastTapX) < DOUBLE_TAP_DIST && Math.abs(endY - lastTapY) < DOUBLE_TAP_DIST) {
          toggleZoom();
          lastTapTime = 0;
        } else {
          lastTapTime = now; lastTapX = endX; lastTapY = endY;
        }
      }
      return;
    }

    if (!tracking) return;
    tracking = false;
    const dx = endX - startX, dy = endY - startY;
    const moved = Math.abs(dx) > 10 || Math.abs(dy) > 10;

    if (!moved) {
      const now = Date.now();
      if (isMediaTarget && now - lastTapTime < DOUBLE_TAP_MS && Math.abs(endX - lastTapX) < DOUBLE_TAP_DIST && Math.abs(endY - lastTapY) < DOUBLE_TAP_DIST) {
        toggleZoom();
        lastTapTime = 0;
      } else {
        lastTapTime = now; lastTapX = endX; lastTapY = endY;
      }
      return;
    }

    if (isPageZoomed()) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) showNextMedia(); else showPrevMedia();
    }
  }, {passive:true});

  // 데스크톱 마우스 드래그로도 확대 중 이동 가능하게
  let mouseDragging = false;
  lb.addEventListener('mousedown', (e) => {
    if (!manualZoomed) return;
    if (e.target.id !== 'lightboxImg' && e.target.id !== 'lightboxVideo') return;
    mouseDragging = true;
    panStartX = e.clientX; panStartY = e.clientY;
    panOriginX = zoomPanX; panOriginY = zoomPanY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDragging) return;
    zoomPanX = panOriginX + (e.clientX - panStartX);
    zoomPanY = panOriginY + (e.clientY - panStartY);
    applyZoomTransform();
  });
  window.addEventListener('mouseup', () => { mouseDragging = false; });
}

function isPageZoomed(){
  return manualZoomed || !!(window.visualViewport && window.visualViewport.scale > 1.01);
}

// ----- 초기 로딩 -----
(async () => {
  if (!CONFIG.eventSlug) { showNotFound('이벤트 주소가 올바르지 않습니다.'); return; }

  const { data, error } = await sb.from('event_meta').select('*').eq('event_id', CONFIG.eventSlug).maybeSingle();
  if (error || !data || !data.start_date || !data.end_date) {
    showNotFound('이벤트를 찾을 수 없습니다.');
    return;
  }

  CONFIG.orgName = data.org_name || CONFIG.orgName;
  CONFIG.eventName = data.event_name || CONFIG.eventName;
  CONFIG.startDate = isoToDateKey(data.start_date);
  CONFIG.endDate = isoToDateKey(data.end_date);
  CONFIG.dateRangeText = data.date_range_text || formatDateRangeText(CONFIG.startDate, CONFIG.endDate);
  CONFIG.panels = buildDatePanels(CONFIG.startDate, CONFIG.endDate);
  if (data.icon) $('#logoIcon').textContent = data.icon;

  applyHeaderText();
  await refreshHubLink();          // isAdmin 먼저 — 수정 버튼 표시 여부에 쓰임

  // 일정이 하나도 없는 날짜는 탭 자체를 만들지 않음.
  // (불러오기에 실패했을 땐 거르지 않고 전부 보여줌 — 빈 화면보다 나으므로)
  const byPanel = await fetchScheduleRows();
  if (byPanel) {
    CONFIG.panels = CONFIG.panels.filter(p =>
      !p.dateKey || (byPanel[p.id] && byPanel[p.id].length));
  }
  CONFIG.panels.forEach(p => { if (p.dateKey) PANEL_DATE[p.id] = p.dateKey; });

  // 장소를 적어 둔 일정이 하나라도 있으면 「지도」 탭을 갤러리 앞에 끼워 넣는다.
  // 하나도 없으면 탭 자체를 안 만든다 — 빈 지도를 띄우느니 없는 편이 낫다.
  if (byPanel) {
    TRIP_STOPS = collectTripStops(byPanel);
    if (TRIP_STOPS.length) {
      const gi = CONFIG.panels.findIndex(p => p.id === 'gallery');
      CONFIG.panels.splice(gi < 0 ? CONFIG.panels.length : gi, 0,
        { id: 'map', label: '\uD83D\uDDFA 지도', dateKey: null });
    }
  }

  buildTabsAndPanels();
  addTabLinkButton();
  // 탭을 만든 뒤에 붙여야 함 (도구막대가 여기서 생성되므로)
  const galleryFileInput = $('#galleryFileInput');
  if (galleryFileInput) {
    galleryFileInput.addEventListener('change', (e) => {
      uploadGalleryFiles(e.target.files);
      e.target.value = '';
    });
  }
  const autoBtn = $('#autoBtn');
  if (autoBtn) autoBtn.addEventListener('click', openScheduleProposal);
  const thumbBtn = $('#thumbBtn');
  if (thumbBtn) {
    thumbBtn.addEventListener('click', makeGalleryThumbs);
    countMissingThumbs();
  }
  if (byPanel) renderSchedule(byPanel);
  showAdminAddLink(byPanel);
  setupLightboxInteractions();
  updateProgress();
  setInterval(updateProgress, 30000);
  setInterval(() => { const active = document.querySelector('.panel.active'); if (active) markNow(active); }, 30000);

  loadGallery();
  // 커스텀 탭은 나중에 붙으므로, 다 붙은 뒤에 ?tab= 을 적용해야 custom-3 같은 주소도 열린다
  await loadCustomTabs();

  const want = panelIdFromQuery(new URLSearchParams(location.search).get('tab'));
  if (want) showPanel(want, { silent:true });
})();
