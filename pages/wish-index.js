// wish/index.html 의 페이지 스크립트.
// 싣는 순서는 다른 쪽과 같다 — supabase → pixel → common → 이 파일.
//
// 한 곳의 일생을 한 줄에 담는다: 가고 싶다(want) → 계획 중(planned) → 다녀옴(done).
// 다녀온 뒤에만 별과 한마디가 붙는다. 읽기는 누구나, 쓰기는 부모만 (표의 RLS 와 같은 선).

buildChrome('wish');
// 배경은 이벤트 쪽 풍경을 그대로 쓴다. BACKDROP 에 'wish' 항목을 따로 만들지 않은 이유는,
// 이 쪽이 이벤트와 같은 「어디를 다녀왔나」의 자리이고 그림도 그쪽이 어울리기 때문이다.
buildBackdrop('event');

const CATS = ['전체', '먹거리', '자연', '체험', '숙소'];
const STATES = [['전체','all'], ['가보고 싶은 곳','want'], ['계획 중','planned'], ['가본 곳','done']];
const SORTS = [['최근 순','recent'], ['별 높은 순','stars'], ['이름 순','name']];
const SEASONS = ['아무때나', '봄', '여름', '가을', '겨울'];
const CAT_ICON = { 먹거리:'🍜', 자연:'🌳', 체험:'🎨', 숙소:'🏨' };

let PLACES = [];
let EVENT_LIST = [];          // 다녀옴으로 바꿀 때 고를 이벤트 목록
let fCat = '전체', fState = 'all', fSort = 'recent';
let openId = null, editId = null;
let map = null, mapDrawn = false;
const pinEls = {};

// 별은 하나뿐이라 평균을 낼 것이 없다. 0 이나 null 이면 「아직 안 매김」이다.
function score(p){ return p.stars > 0 ? p.stars : null; }
function starText(n, max){ return '★'.repeat(n) + '☆'.repeat(max - n); }
function stateLabel(s){ return s === 'want' ? '가보고 싶은 곳' : s === 'planned' ? '계획 중' : '다녀옴'; }
function iconOf(p){ return CAT_ICON[p.category] || '📍'; }

// 지금이 어느 계절인지. 12·1·2 를 겨울로 묶는다.
function nowSeason(){
  const m = new Date().getMonth() + 1;
  if (m === 12 || m <= 2) return '겨울';
  if (m <= 5) return '봄';
  if (m <= 8) return '여름';
  return '가을';
}

// 두 자리 사이의 거리(m). 하버사인을 쓸 만큼 멀지 않아 평면으로 셈해도 된다 —
// 우리가 볼 거리는 길어야 몇 km 이고, 위도 1도를 111km 로 두면 그 안에서는 오차가
// 몇 m 밖에 안 난다. 경도는 위도에 따라 좁아지므로 cos 을 곱한다.
function metersBetween(a, b){
  const dLat = (a.lat - b.lat) * 111000;
  const dLng = (a.lng - b.lng) * 111000 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
}
// 주소 줄. 누르면 카카오맵이 그 자리를 열어 준다 — 이벤트 상세의 장소 표와 같은 주소 꼴이다.
function addrHTML(p){
  const 자리 = (Number.isFinite(p.lat) && Number.isFinite(p.lng))
    ? 'https://map.kakao.com/link/map/' + encodeURIComponent(p.name) + ',' + p.lat + ',' + p.lng
    : 'https://map.kakao.com/link/search/' + encodeURIComponent(p.name);
  // 주소가 아직 없는 곳도 있다(이벤트에서 옮겨 올 때 좌표만 있었다). 그때는 이름으로 찾아 준다.
  const 글 = p.address || '지도에서 찾아보기';
  return '<a class="addr" href="' + escapeHTML(자리) + '" target="_blank" rel="noopener noreferrer">' +
    '📍 <span>' + escapeHTML(글) + '</span></a>';
}

// 사진이 있으면 사진을, 없으면 분류 아이콘을 보여 준다.
function thumbHTML(p){
  const src = p.thumb_url || p.photo_url;
  // 스토리지에서 파일이 사라지면 깨진 그림 자국만 남는다. 그때는 분류 아이콘으로 돌아간다.
  return src
    ? '<img alt="" loading="lazy" src="' + escapeHTML(src) + '" ' +
      'onerror="this.parentNode.textContent=' + "'" + iconOf(p) + "'" + '">'
    : iconOf(p);
}
function dateText(d){
  if (!d) return '';
  const k = isoToDateKey(d);
  return k ? k[0] + '. ' + (k[1] + 1) + '. ' + k[2] + '.' : '';
}

// ---------- 불러오기 ----------
async function load(){
  const { data, error } = await sb.from('places').select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('가볼 곳 로딩 오류:', error); PLACES = []; return; }
  PLACES = data || [];
}

async function loadEventList(){
  if (!isAdmin || EVENT_LIST.length) return;
  const { data, error } = await sb.from('event_meta')
    .select('event_id, event_name, org_name, start_date')
    .order('start_date', { ascending: false });
  if (error) { console.error('이벤트 목록 오류:', error); return; }
  EVENT_LIST = data || [];
}

// ---------- 거르개 ----------
function shown(){
  let list = PLACES.filter(p =>
    (fCat === '전체' || p.category === fCat) &&
    (fState === 'all' || p.status === fState));
  if (fSort === 'stars') {
    list = list.slice().sort((a, b) => (score(b) || -1) - (score(a) || -1));
  } else if (fSort === 'name') {
    list = list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  } else {
    // 최근 순 — 다녀온 날이 있으면 그것이 앞, 없으면 넣은 차례
    list = list.slice().sort((a, b) =>
      String(b.visited_on || b.created_at || '').localeCompare(String(a.visited_on || a.created_at || '')));
  }
  return list;
}

function drawFilters(){
  const box = $('#filters');
  box.innerHTML = '';
  CATS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (c === fCat ? ' on' : '');
    b.textContent = c;
    b.addEventListener('click', () => { fCat = c; render(); });
    box.appendChild(b);
  });
  const gap = document.createElement('span'); gap.className = 'filter-gap'; box.appendChild(gap);
  STATES.forEach(([label, v]) => {
    const b = document.createElement('button');
    b.className = 'chip' + (v === fState ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { fState = v; render(); });
    box.appendChild(b);
  });

  const sbox = $('#sorts');
  sbox.innerHTML = '<span class="filter-label">차례</span>';
  SORTS.forEach(([label, v]) => {
    const b = document.createElement('button');
    b.className = 'chip sort' + (v === fSort ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { fSort = v; render(); });
    sbox.appendChild(b);
  });
}

// ---------- 별 ----------
function rateRows(p){
  const cur = p.stars || 0;
  const stars = [1,2,3,4,5].map(n =>
    '<button type="button" class="' + (n <= cur ? 'on' : '') + '"' +
    (isAdmin ? ' data-rate="' + p.id + ':' + n + '"' : ' disabled') +
    ' aria-label="별 ' + n + '점">★</button>').join('');
  return '<div class="rate-list"><div class="rate-row">' +
    '<span class="rate-who">별점</span>' +
    '<span class="rate-stars">' + stars + '</span>' +
    '<span class="rate-note">' + (cur ? cur + '점' : '아직 안 매김') + '</span></div></div>';
}

// ---------- 고치기 폼 ----------
function editHTML(p){
  const opt = (list, cur) => list.map(v =>
    '<option' + (v === cur ? ' selected' : '') + '>' + escapeHTML(v) + '</option>').join('');
  const evOpt = ['<option value="">— 이벤트 없음 —</option>'].concat(
    EVENT_LIST.map(e => '<option value="' + escapeHTML(e.event_id) + '"' +
      (e.event_id === p.event_id ? ' selected' : '') + '>' +
      escapeHTML((e.event_name || e.event_id) + (e.org_name ? ' · ' + e.org_name : '')) +
      '</option>')).join('');
  return '<div class="edit-box" data-edit="' + p.id + '">' +
    '<div class="edit-row">' +
      '<div><label>어디까지 왔나</label><select class="e-status">' +
        '<option value="want"' + (p.status === 'want' ? ' selected' : '') + '>가보고 싶은 곳</option>' +
        '<option value="planned"' + (p.status === 'planned' ? ' selected' : '') + '>계획 중</option>' +
        '<option value="done"' + (p.status === 'done' ? ' selected' : '') + '>다녀옴</option>' +
      '</select></div>' +
      '<div><label>무엇</label><select class="e-cat">' + opt(CATS.slice(1), p.category) + '</select></div>' +
      '<div><label>언제쯤</label><select class="e-season">' + opt(SEASONS, p.season) + '</select></div>' +
    '</div>' +
    '<div class="edit-row">' +
      '<div><label>얼마나 가고 싶은지</label><select class="e-hope">' +
        [0,1,2,3].map(n => '<option value="' + n + '"' + ((p.hope || 0) === n ? ' selected' : '') + '>' +
          (n ? '★'.repeat(n) : '보통') + '</option>').join('') + '</select></div>' +
      '<div><label>다녀온 날</label><input class="e-visited" type="date" value="' +
        escapeHTML(p.visited_on || '') + '"></div>' +
    '</div>' +
    '<label>이어진 이벤트</label><select class="e-event">' + evOpt + '</select>' +
    '<label>메모</label><textarea class="e-memo">' + escapeHTML(p.memo || '') + '</textarea>' +
    '<label>다녀온 뒤 한마디</label><textarea class="e-review">' + escapeHTML(p.review || '') + '</textarea>' +
    '<label>링크 (한 줄에 하나)</label><textarea class="e-links">' +
      escapeHTML((p.links || []).join('\n')) + '</textarea>' +
    '<label><input class="e-again" type="checkbox" style="width:auto; margin-right:6px;"' +
      (p.again ? ' checked' : '') + '>또 가고 싶다</label>' +
    '<div class="act-row" style="margin-top:12px;">' +
      '<button class="act primary" type="button" data-save="' + p.id + '">저장</button>' +
      '<button class="act ghost" type="button" data-cancel="' + p.id + '">그만두기</button>' +
      '<span class="msg" data-msg="' + p.id + '"></span>' +
    '</div>' +
  '</div>';
}

// ---------- 카드 ----------
function cardHTML(p){
  const sc = score(p);
  const links = (p.links || []).filter(Boolean).map(u => {
    const safe = /^https?:\/\//i.test(u) ? u : 'https://' + u;
    let label = safe;
    try { label = new URL(safe).hostname.replace(/^www\./, ''); }
    catch (e) { /* 주소가 아니면 적어 둔 글자를 그대로 보여 준다 */ }
    return '<a href="' + escapeHTML(safe) + '" target="_blank" rel="noopener noreferrer">🔗 ' +
      escapeHTML(label) + '</a>';
  }).join('');

  const adminActs = isAdmin
    ? '<button class="act" type="button" data-edit-open="' + p.id + '">✏️ 고치기</button>' +
      '<button class="act ghost" type="button" data-del="' + p.id + '">🗑 지우기</button>'
    : '';
  const eventAct = (p.status === 'done' && p.event_id)
    ? '<a class="act ghost" href="/event/e/?slug=' + encodeURIComponent(p.event_id) + '">📖 이벤트 보기</a>'
    : '';

  return '<div class="wcard' + (p.status === 'done' ? ' done' : '') +
      (p.id === openId ? ' open' : '') + '" data-card="' + p.id + '">' +
    '<div class="wcard-top" role="button" tabindex="0" aria-expanded="' +
        (p.id === openId ? 'true' : 'false') + '">' +
      '<div class="wcard-thumb">' + thumbHTML(p) + '</div>' +
      '<div class="wcard-body">' +
        '<p class="wcard-name">' + escapeHTML(p.name) + '</p>' +
        '<div class="wcard-meta">' +
          (p.category ? '<span class="tag cat-' + escapeHTML(p.category) + '">' + escapeHTML(p.category) + '</span>' : '') +
          '<span class="state ' + p.status + '">' + stateLabel(p.status) + '</span>' +
          (p.status !== 'done' && p.hope ? '<span class="hope">가고 싶은 정도 ' + starText(p.hope, 3) + '</span>' : '') +
          (p.again === true ? '<span class="again">또 가고 싶다</span>' : '') +
        '</div>' +
        (sc ? '<div class="score"><span class="stars">' + starText(sc, 5) + '</span>' +
              '<span class="num">' + sc + '점</span></div>' : '') +
        '<div class="wcard-meta" style="margin-top:4px;">' +
          escapeHTML(p.visited_on ? dateText(p.visited_on) + ' 다녀옴' : (p.season || '')) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="wcard-more">' +
      (p.id === editId ? editHTML(p) : '') +
      addrHTML(p) +
      (p.review ? '<p class="review">“' + escapeHTML(p.review) + '”</p>' : '') +
      (p.memo ? '<p>' + escapeHTML(p.memo) + '</p>' : '') +
      (p.status === 'done' ? rateRows(p) : '') +
      (links ? '<div class="link-row">' + links + '</div>' : '') +
      '<div class="act-row">' + eventAct + adminActs + '</div>' +
    '</div>' +
  '</div>';
}

function drawCards(){
  const box = $('#cards');
  const list = shown();
  if (!list.length){
    box.innerHTML = '<p class="empty-msg">' +
      (PLACES.length ? '고른 조건에 맞는 곳이 없습니다' : '아직 적어 둔 곳이 없습니다') + '</p>';
    return;
  }
  box.innerHTML = list.map(cardHTML).join('');
}

// 이번 계절과 맞는, 아직 안 간 곳
function drawSeasonTip(){
  const box = $('#seasonTip');
  const 계절 = nowSeason();
  const list = PLACES.filter(p => p.status !== 'done' && p.season === 계절);
  if (!list.length){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<b>🍂 지금은 ' + 계절 + ' — 이때 가면 좋을 곳 ' + list.length + '군데</b>';
  list.slice(0, 6).forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = iconOf(p) + ' ' + p.name;
    b.addEventListener('click', () => {
      // 거르개가 걸려 있으면 그 카드가 안 보일 수 있다. 풀고 나서 편다.
      fCat = '전체'; fState = 'all'; openId = p.id; editId = null;
      render();
      const card = document.querySelector('[data-card="' + p.id + '"]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (Number.isFinite(p.lat)) focusPin(p);
    });
    box.appendChild(b);
  });
}

function drawBest(){
  const done = PLACES.filter(p => p.status === 'done' && score(p));
  const top = done.slice().sort((a, b) => score(b) - score(a)).slice(0, 5);
  const box = $('#best');
  if (top.length < 2){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<h2>🏆 별이 높았던 곳</h2>' +
    '<p class="sub">별을 매긴 차례입니다 · 다녀온 곳 ' + done.length + '군데</p>' +
    '<ol>' + top.map(p => '<li>' + escapeHTML(p.name) +
      '<span class="s">' + score(p) + '점</span></li>').join('') + '</ol>';
}

// ---------- 지도 ----------
function withCoords(){ return PLACES.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)); }

/* 핀 그리기.
   ------------------------------------------------------------------
   한 곳에 하나씩 그대로 얹으면 안 된다. 이벤트에서 옮겨 온 27곳 가운데 스무 곳이
   제주에 있어, 전국이 보이는 레벨에서는 34px 짜리 핀들이 171쌍이나 겹쳤다.
   그래서 화면에서 가까운 것끼리 묶어 「N곳」 하나로 그리고, 누르면 그 자리를
   확대한다. 묶는 기준은 위경도가 아니라 화면 픽셀이다 — 같은 거리라도 확대하면
   멀어지므로, 지도가 멈출 때(idle)마다 다시 센다. */
const CLUSTER_PX = 46;
let overlays = [];

function pinFace(p){
  const sc = score(p);
  if (p.status !== 'done') return iconOf(p);
  return sc ? '★' + sc : '✓';
}

function redrawPins(){
  if (!map) return;
  overlays.forEach(o => o.setMap(null));
  overlays = [];
  Object.keys(pinEls).forEach(k => delete pinEls[k]);

  const proj = map.getProjection();
  const spots = withCoords();
  const cells = new Map();
  spots.forEach(p => {
    const pt = proj.containerPointFromCoords(new kakao.maps.LatLng(p.lat, p.lng));
    const key = Math.round(pt.x / CLUSTER_PX) + ':' + Math.round(pt.y / CLUSTER_PX);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(p);
  });

  cells.forEach(group => {
    const lat = group.reduce((a, p) => a + p.lat, 0) / group.length;
    const lng = group.reduce((a, p) => a + p.lng, 0) / group.length;
    const here = new kakao.maps.LatLng(lat, lng);
    const el = document.createElement('div');

    if (group.length === 1) {
      const p = group[0];
      el.className = 'wish-pin' + (p.status === 'done' ? ' done' : '');
      el.textContent = pinFace(p);
      el.title = p.name;
      pinEls[p.id] = el;
      el.addEventListener('click', () => {
        openId = p.id; editId = null; render(); focusPin(p);
        const card = document.querySelector('[data-card="' + p.id + '"]');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      const done = group.filter(p => p.status === 'done').length;
      el.className = 'wish-pin cluster' + (done === group.length ? ' done' : '');
      el.textContent = group.length + '곳';
      el.title = group.map(p => p.name).join(', ');
      el.addEventListener('click', () => {
        // 한 칸 더 들어가도 안 갈라지는 자리가 있어 두 칸씩 당긴다
        map.setLevel(Math.max(1, map.getLevel() - 2), { anchor: here });
      });
    }

    overlays.push(new kakao.maps.CustomOverlay({
      map, position: here, content: el,
      xAnchor: 0.5, yAnchor: 0.5, clickable: true, zIndex: 2,
    }));
  });
}



function focusPin(p){
  Object.values(pinEls).forEach(el => el.classList.remove('on'));
  if (pinEls[p.id]) pinEls[p.id].classList.add('on');
  const sc = score(p);
  $('#stripText').innerHTML = escapeHTML(p.name) +
    '<span class="sub">' + escapeHTML((p.category || '') + ' · ' + stateLabel(p.status) +
      (sc ? ' · 별 ' + sc + '점' : (p.season ? ' · ' + p.season : ''))) + '</span>';
}

function summary(){
  const want = PLACES.filter(p => p.status !== 'done').length;
  const done = PLACES.filter(p => p.status === 'done');
  const scored = done.map(score).filter(Boolean);
  const 평균 = scored.length ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1) : null;
  $('#stripText').innerHTML = '📌 가볼 곳<span class="sub">' +
    '가고 싶은 곳 ' + want + '군데 · 가본 곳 ' + done.length + '군데' +
    (평균 ? ' · 별 평균 ' + 평균 : '') + ' · 핀을 눌러보세요</span>';
  Object.values(pinEls).forEach(el => el.classList.remove('on'));
}

// 핀이 다 들어오게 맞춘다. 카카오는 레벨 14 보다 물러날 수 없어, 그래도 안 들어오면
// 한가운데에 놓는 쪽으로 물러선다 (이벤트 목록과 같은 규칙).
function mapFit(){
  const spots = withCoords();
  if (!map || !spots.length) return;
  if (spots.length === 1) {
    map.setCenter(new kakao.maps.LatLng(spots[0].lat, spots[0].lng));
    map.setLevel(6);
    return;
  }
  const bounds = new kakao.maps.LatLngBounds();
  spots.forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  map.setBounds(bounds, 22, 22, 22, 22);
  const view = map.getBounds();
  if (!spots.every(p => view.contain(new kakao.maps.LatLng(p.lat, p.lng)))) {
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    map.setLevel(14);
    map.setCenter(new kakao.maps.LatLng((sw.getLat() + ne.getLat()) / 2, (sw.getLng() + ne.getLng()) / 2));
  }
}

async function drawMap(){
  if (mapDrawn) return;
  const spots = withCoords();
  if (!spots.length) return;
  // 여기서 실패하면(서비스가 꺼져 있거나 도메인이 안 맞으면) 조용히 접는다.
  // 지도 하나 때문에 목록이 안 보이면 안 되므로.
  try { await loadKakaoMaps(); } catch (e) { console.warn('지도를 건너뜁니다:', e.message); return; }

  mapDrawn = true;
  $('#mapBand').hidden = false;
  map = new kakao.maps.Map($('#wishMap'), {
    center: new kakao.maps.LatLng(36.5, 127.9), level: 13, scrollwheel: false,
  });
  enablePinchZoom(map, $('#wishMap'));

  mapFit();

  // 자리가 정해진 뒤에 그려야 화면 좌표가 맞는다. 그 뒤로는 지도가 멈출 때마다.
  redrawPins();
  kakao.maps.event.addListener(map, 'idle', redrawPins);

  const zbox = $('#zoomCtl'), zin = $('#zoomIn'), zout = $('#zoomOut');
  function sync(){ const lv = map.getLevel(); zin.disabled = lv <= 1; zout.disabled = lv >= 14; }
  zin.addEventListener('click', () => { map.setLevel(map.getLevel() - 1); sync(); });
  zout.addEventListener('click', () => { map.setLevel(map.getLevel() + 1); sync(); });
  kakao.maps.event.addListener(map, 'zoom_changed', sync);
  kakao.maps.event.addListener(map, 'click', summary);
  zbox.hidden = false; sync();
  summary();
}

// 핀은 여기서 다시 그리지 않는다. 카드를 펴고 접을 때마다 오버레이를 통째로 새로
// 만들던 것을 재 보니 한 번 누를 때 다섯 개(펼쳐 놓으면 스물일곱 개)를 버리고 다시
// 만들고 있었다. 핀이 달라지는 때 — 별점을 매길 때와 지울 때 — 만 redrawPins() 를 부른다.
function render(){ drawSeasonTip(); drawFilters(); drawCards(); drawBest(); }

// 손가락뿐 아니라 자판으로도 펼 수 있어야 한다. 카드 머리에 role="button" 을 주었으니
// 엔터와 사이띄개가 누름과 같아야 한다 — div 는 그것을 저절로 해 주지 않는다.
$('#cards').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const head = e.target.closest('.wcard-top');
  if (!head) return;
  e.preventDefault();
  head.click();
});

// ---------- 카드 안의 누름은 한 자리에서 받는다 (카드를 다시 그려도 살아 있게) ----------
$('#cards').addEventListener('click', async (e) => {
  const t = e.target.closest('button, a');

  // 별 매기기
  if (t && t.dataset.rate) {
    e.stopPropagation();
    const [id, n] = t.dataset.rate.split(':');
    const p = PLACES.find(x => String(x.id) === id);
    if (!p) return;
    // 같은 별을 다시 누르면 지운다 — 잘못 누른 것을 되돌릴 길이 있어야 한다
    const next = (p.stars === +n) ? null : +n;
    const before = p.stars;
    p.stars = next; render(); redrawPins();
    // select() 를 붙여야 한다. RLS 에 막힌 update 는 오류 없이 0행이라, error 만 보면
    // 저장되지 않은 것을 저장된 것으로 읽는다 — 화면만 바뀌고 새로고침하면 되돌아간다.
    const { data, error } = await sb.from('places').update({ stars: next }).eq('id', p.id).select();
    if (error || !data || !data.length) {
      p.stars = before; render(); redrawPins();
      alert('별을 저장하지 못했습니다' + (error ? ': ' + error.message : ' (로그인이 풀렸는지 확인해 주세요)'));
    }
    return;
  }

  if (t && t.dataset.editOpen) {
    e.stopPropagation();
    await loadEventList();
    editId = +t.dataset.editOpen; openId = editId; render();
    return;
  }
  if (t && t.dataset.cancel) { e.stopPropagation(); editId = null; render(); return; }

  if (t && t.dataset.save) {
    e.stopPropagation();
    const id = +t.dataset.save;
    const box = document.querySelector('[data-edit="' + id + '"]');
    const msg = box.querySelector('[data-msg]');
    const status = box.querySelector('.e-status').value;
    const patch = {
      status,
      category: box.querySelector('.e-cat').value,
      season: box.querySelector('.e-season').value,
      hope: +box.querySelector('.e-hope').value,
      visited_on: box.querySelector('.e-visited').value || null,
      event_id: box.querySelector('.e-event').value || null,
      memo: box.querySelector('.e-memo').value.trim() || null,
      review: box.querySelector('.e-review').value.trim() || null,
      again: box.querySelector('.e-again').checked,
      links: box.querySelector('.e-links').value.split('\n').map(s => s.trim()).filter(Boolean),
    };
    msg.className = 'msg'; msg.textContent = '저장 중...';
    const { data, error } = await sb.from('places').update(patch).eq('id', id).select().maybeSingle();
    if (error) { msg.className = 'msg err'; msg.textContent = '저장 실패: ' + error.message; return; }
    // RLS 에 막히면 오류 없이 0행이 온다 — 그때를 성공으로 읽으면 안 된다
    if (!data) { msg.className = 'msg err'; msg.textContent = '저장되지 않았습니다 (권한 확인)'; return; }
    Object.assign(PLACES.find(x => x.id === id), data);
    editId = null; render();
    return;
  }

  if (t && t.dataset.del) {
    e.stopPropagation();
    const id = +t.dataset.del;
    const p = PLACES.find(x => x.id === id);
    if (!confirm('「' + p.name + '」을 지웁니다. 되돌릴 수 없습니다.')) return;
    // 여기도 select() 가 필요하다. 막힌 delete 는 오류 없이 0행이라, 화면에서만
    // 사라지고 표에는 그대로 남는다.
    const { data, error } = await sb.from('places').delete().eq('id', id).select();
    if (error) { alert('지우지 못했습니다: ' + error.message); return; }
    if (!data || !data.length) { alert('지워지지 않았습니다 (로그인이 풀렸는지 확인해 주세요)'); return; }
    PLACES = PLACES.filter(x => x.id !== id);
    openId = editId = null; render(); redrawPins(); summary();
    return;
  }

  if (t) return;   // 링크·다른 단추는 그대로 둔다

  // 카드 몸통을 누르면 펼치거나 접는다
  const card = e.target.closest('[data-card]');
  if (!card) return;
  const id = +card.dataset.card;
  openId = (openId === id) ? null : id;
  if (openId !== id) editId = null;
  render();
  const p = PLACES.find(x => x.id === id);
  if (p && openId === id && Number.isFinite(p.lat)) focusPin(p);
});

// ---------- 장소 찾기 ----------
let picked = null;
let searchTimer = null;
$('#q').addEventListener('input', (e) => {
  const kw = e.target.value.trim();
  const out = $('#searchOut');
  picked = null;
  clearTimeout(searchTimer);
  if (kw.length < 2) { out.hidden = true; return; }
  // 글자마다 물어보면 한 번 적는 동안 열 번 넘게 부른다. 잠깐 기다렸다 한 번만 부른다.
  searchTimer = setTimeout(async () => {
    try { await loadKakaoMaps(); } catch (err) { return; }
    new kakao.maps.services.Places().keywordSearch(kw, (data, status) => {
      if (status !== kakao.maps.services.Status.OK) { out.hidden = true; return; }
      out.innerHTML = '';
      data.slice(0, 6).forEach(r => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<b>' + escapeHTML(r.place_name) + '</b><span>' +
          escapeHTML(r.road_address_name || r.address_name || '') + '</span>';
        b.addEventListener('click', () => {
          picked = { name: r.place_name, lat: +r.y, lng: +r.x,
                     address: r.road_address_name || r.address_name || null };
          $('#q').value = r.place_name;
          out.hidden = true;
        });
        out.appendChild(b);
      });
      out.hidden = false;
    });
  }, 280);
});

// 고른 사진을 미리 보여 준다. 올리는 것은 「넣기」를 누를 때다.
let pickedPic = null;
$('#pic').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  pickedPic = f || null;
  const box = $('#picPreview');
  if (!f) { box.hidden = true; return; }
  const url = URL.createObjectURL(f);
  $('#picImg').src = url;
  // 미리보기용 주소는 곧 쓸모가 없어진다. 그림이 뜨고 나면 바로 놓아 준다.
  $('#picImg').onload = () => URL.revokeObjectURL(url);
  box.hidden = false;
});

$('#addBtn').addEventListener('click', async () => {
  const msg = $('#addMsg');
  const name = $('#q').value.trim();
  if (!name) { msg.className = 'msg err'; msg.textContent = '장소 이름을 적어 주세요.'; return; }
  const row = {
    name: picked ? picked.name : name,
    category: $('#cat').value,
    season: $('#season').value,
    hope: +$('#hope').value,
    memo: $('#memo').value.trim() || null,
    links: $('#link').value.split('\n').map(s => s.trim()).filter(Boolean),
    status: 'want',
  };
  // 찾아서 고른 자리가 있으면 좌표까지 넣는다. 손으로만 적었으면 지도에는 안 찍힌다.
  if (picked) { row.lat = picked.lat; row.lng = picked.lng; row.address = picked.address; }

  // 이미 있는 곳인지 먼저 본다. 이벤트에서 옮겨 올 때 씨앤하우스가 두 번 들어가
  // 있던 것과 같은 일이 여기서도 생긴다. 이름이 같거나, 걸어서 갈 만한 거리(300m)
  // 안에 다른 곳이 이미 있으면 물어본다.
  const 같은이름 = PLACES.find(x => x.name === row.name);
  const 가까운곳 = row.lat
    ? PLACES.find(x => Number.isFinite(x.lat) && metersBetween(row, x) <= 300)
    : null;
  if (같은이름 || 가까운곳) {
    const 겹친것 = 같은이름 || 가까운곳;
    const 이유 = 같은이름
      ? '「' + 겹친것.name + '」은 이미 목록에 있습니다.'
      : '「' + 겹친것.name + '」이(가) ' + metersBetween(row, 겹친것) + 'm 거리에 이미 있습니다.';
    if (!confirm(이유 + '\n그래도 넣을까요?')) {
      msg.className = 'msg'; msg.textContent = '넣지 않았습니다.';
      return;
    }
  }

  msg.className = 'msg'; msg.textContent = '넣는 중...';

  // 사진이 있으면 먼저 올린다. 여기서 실패하면 줄 자체를 만들지 않는다 —
  // 사진 없는 줄이 남고 사람은 넣었다고 생각하는 편이 더 나쁘다.
  if (pickedPic) {
    try {
      msg.textContent = '사진 올리는 중...';
      const up = await uploadMedia(pickedPic, 'places');
      row.photo_url = up.url;
      row.thumb_url = up.thumbUrl;
    } catch (err) {
      msg.className = 'msg err'; msg.textContent = '사진을 올리지 못했습니다: ' + err.message;
      return;
    }
    msg.textContent = '넣는 중...';
  }

  const { data, error } = await sb.from('places').insert(row).select().maybeSingle();
  if (error) { msg.className = 'msg err'; msg.textContent = '넣지 못했습니다: ' + error.message; return; }
  if (!data) { msg.className = 'msg err'; msg.textContent = '넣어지지 않았습니다 (권한 확인)'; return; }

  PLACES.unshift(data);
  picked = null; pickedPic = null;
  $('#q').value = ''; $('#memo').value = ''; $('#link').value = '';
  $('#pic').value = ''; $('#picPreview').hidden = true;
  msg.className = 'msg ok'; msg.textContent = '넣었습니다.';
  render();
  // 좌표가 있는 첫 곳이면 이제야 지도를 그릴 수 있다. 이미 그렸으면 핀만 다시 얹는다
  // (예전에는 쪽을 통째로 새로고침했다 — 스크롤과 거르개가 다 날아갔다).
  if (!mapDrawn) drawMap();
  else if (data.lat) { mapFit(); redrawPins(); }
});

// ---------- 목록은 누구나, 넣기·고치기·별점은 부모만 ----------
async function refreshAuthUI(){
  await refreshAuth();
  $('#addBox').hidden = !isAdmin;
  $('#headNote').textContent = isAdmin
    ? '가고 싶은 곳을 적어 두고, 다녀오면 별을 매겨 남겨요'
    : '가고 싶은 곳과 다녀온 곳을 한 지도에 모았어요';
  render();
}

(async () => {
  await load();
  await refreshAuthUI();
  drawMap();
})();

// 로그인 상태가 바뀌면 관리 단추도 따라 바뀌어야 한다 (common.js 가 알려 준다)
document.addEventListener('suayona:auth', () => {
  $('#addBox').hidden = !isAdmin;
  render();
});
