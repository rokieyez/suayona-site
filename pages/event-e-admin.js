// event/e/admin.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('event');

const CONFIG = {
  eventSlug: new URLSearchParams(location.search).get('slug') || '',
  panels: [],
};

const WEEKDAY = ['일','월','화','수','목','금','토'];
function formatDateLabel(dateKey){
  const [y,m,d] = dateKey;
  return (m+1) + '/' + d + ' ' + WEEKDAY[new Date(y,m,d).getDay()];
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
  return panels;
}

const loginBox = $('#login-box'), adminBox = $('#admin-box');

// ----- 로그인 상태에 따라 화면 전환 -----
// ----- 이벤트 이름 (단체명 / 일정명 / 아이콘) -----
let EVENT_META = null;

function fillMetaForm(){
  if (!EVENT_META) return;
  $('#mIcon').value = EVENT_META.icon || '';
  $('#mOrgName').value = EVENT_META.org_name || '';
  $('#mEventName').value = EVENT_META.event_name || '';
  drawMetaPreview();
}

// 저장하기 전에 이벤트 페이지에서 어떻게 보일지 그대로 보여 준다 —
// 어느 칸이 큰 글씨인지 글로 설명하는 것보다 이게 빠르다.
function drawMetaPreview(){
  const org = $('#mOrgName').value.trim();
  const name = $('#mEventName').value.trim();
  const icon = $('#mIcon').value.trim() || '🗓️';
  const big = name || org, small = name ? org : '';
  $('#metaPreview').innerHTML = '이벤트 페이지에서는 이렇게 보여요<br>' +
    (small ? escapeHTML(icon + ' ' + small) : '') +
    '<b>' + escapeHTML(big || '(이름 없음)') + '</b>';
}
['#mIcon','#mOrgName','#mEventName'].forEach(sel =>
  $(sel).addEventListener('input', drawMetaPreview));

function applyAdminTitle(){
  const label = (EVENT_META && (EVENT_META.event_name || EVENT_META.org_name)) || CONFIG.eventSlug;
  $('#pageTitle').textContent = '🔧 일정 관리 · ' + label;
  document.title = '일정 관리 · ' + label;
}

$('#mSaveBtn').addEventListener('click', async () => {
  const btn = $('#mSaveBtn'), msg = $('#meta-msg');
  msg.className = ''; msg.textContent = '';
  const orgName = $('#mOrgName').value.trim();
  const eventName = $('#mEventName').value.trim();
  const icon = $('#mIcon').value.trim();
  if (!orgName && !eventName) {
    msg.className = 'err'; msg.textContent = '단체명과 일정명 중 적어도 하나는 적어주세요.'; return;
  }
  btn.disabled = true; btn.textContent = '저장 중...';
  const patch = { org_name: orgName || null, event_name: eventName || null, icon: icon || '🗓️' };
  const { error } = await sb.from('event_meta').update(patch).eq('event_id', CONFIG.eventSlug);
  btn.disabled = false; btn.textContent = '이름 저장';
  if (error) { msg.className = 'err'; msg.textContent = '저장 실패: ' + error.message; return; }
  EVENT_META = Object.assign({}, EVENT_META, patch);
  applyAdminTitle();
  msg.className = 'ok'; msg.textContent = '저장했어요. 이벤트 페이지를 새로고침하면 바뀌어 있습니다.';
});

/* =========================================================================
   장소 고르기
   ------------------------------------------------------------------------
   세 가지 길을 준다. 하나만 되면 되도록.
     1. 이름만 적고 저장   — 저장할 때 알아서 찾아 본다 (예전과 같음)
     2. 찾아서 고르기      — 이름이나 주소로 찾아 나온 목록에서 고른다
     3. 지도를 눌러 찍기   — 검색으로 안 나오는 곳(밭, 캠핑장, 친구네)을 위해

   3번이 있어야 하는 이유: 카카오가 못 찾는 곳은 이름만 남고 핀이 안 찍혔는데,
   그걸 고칠 방법이 화면에 없었다. 이제 손으로 찍을 수 있다.
   ========================================================================= */
/* ---------- 시간 고르기 ----------
   손으로 적으면 「9시」·「09:0」·「18:00 - 18:30」 처럼 꼴이 제각각이 된다.
   실제로 서른여덟 개 가운데 여덟 개가 가운뎃줄 앞뒤에 사이띄개가 붙어 있었다.
   열 분 간격으로 고르게 하고, 저장은 늘 「09:00-10:00」 한 꼴로 한다.
   이미 있는 값은 전부 열 분 단위라 그대로 옮겨 담긴다. */
const TIME_STEP = 10;

function timeOptionsHTML(){
  const out = ['<option value="">— 없음 —</option>'];
  for (let m = 0; m < 24 * 60; m += TIME_STEP) {
    const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' +
              String(m % 60).padStart(2, '0');
    out.push('<option value="' + t + '">' + t + '</option>');
  }
  return out.join('');
}

// 「18:00 - 18:30」, 「09:00~10:00」, 「9:00」 을 모두 받아 준다
function parseTimeText(text){
  const m = String(text || '').match(/(\d{1,2}):(\d{2})\s*(?:[-~–—]\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return { from: '', to: '' };
  const pad = (h, mm) => String(+h).padStart(2, '0') + ':' + mm;
  return { from: pad(m[1], m[2]), to: m[3] ? pad(m[3], m[4]) : '' };
}

function timeTextOf(from, to){
  if (!from) return '';
  return to ? from + '-' + to : from;
}

// 고를 거리에 없는 값(열 분에 안 떨어지는 옛 값)이면 그 한 칸만 끼워 넣는다 —
// 안 그러면 저장할 때 조용히 시간이 지워진다.
function setTimeSelect(sel, value){
  if (value && !Array.from(sel.options).some(o => o.value === value)) {
    const o = document.createElement('option');
    o.value = o.textContent = value;
    sel.insertBefore(o, sel.options[1] || null);
  }
  sel.value = value || '';
}

/* 시작을 고르면 끝을 한 시간 뒤로 채워 준다 — 아직 안 골랐을 때만.
   사람이 이미 적어 둔 것을 말없이 덮으면 안 된다. */
function linkTimePair(fromSel, toSel){
  fromSel.addEventListener('change', () => {
    if (!fromSel.value || toSel.value) return;
    const [h, m] = fromSel.value.split(':').map(Number);
    const t = (h * 60 + m + 60) % (24 * 60);
    setTimeSelect(toSel, String(Math.floor(t / 60)).padStart(2, '0') + ':' +
                          String(t % 60).padStart(2, '0'));
  });
}

function makePlacePicker(host, init){
  init = init || {};
  const st = { lat: Number.isFinite(init.lat) ? init.lat : null,
               lng: Number.isFinite(init.lng) ? init.lng : null };

  host.innerHTML =
    '<input type="text" class="pName" maxlength="80" placeholder="예: 부산 해운대해수욕장">' +
    '<div class="place-state"><span class="pWhere"></span>' +
      '<button type="button" class="pClear" hidden>핀 지우기</button></div>' +
    '<button type="button" class="place-open">\uD83D\uDDFA 지도에서 고르기</button>' +
    '<div class="place-box" hidden>' +
      '<div class="place-search">' +
        '<input type="text" class="pQuery" placeholder="이름이나 주소로 찾기">' +
        '<button type="button" class="pFind">찾기</button>' +
      '</div>' +
      '<ul class="place-results"></ul>' +
      '<div class="place-map"></div>' +
      '<p class="place-tip">목록에서 고르거나, <b>지도를 직접 눌러</b> 핀을 옮길 수 있어요.</p>' +
    '</div>';

  const q = sel => host.querySelector(sel);
  const nameEl = q('.pName'), whereEl = q('.pWhere'), clearEl = q('.pClear');
  const boxEl = q('.place-box'), listEl = q('.place-results');
  nameEl.value = init.name || '';

  let map = null, marker = null;

  function drawState(){
    const has = Number.isFinite(st.lat) && Number.isFinite(st.lng);
    whereEl.textContent = has
      ? '\uD83D\uDCCD ' + st.lat.toFixed(5) + ', ' + st.lng.toFixed(5) + ' — 지도에 찍힘'
      : (nameEl.value.trim() ? '아직 안 찍힘 — 저장할 때 찾아 봅니다' : '');
    whereEl.parentElement.classList.toggle('has', has);
    clearEl.hidden = !has;
  }
  drawState();
  nameEl.addEventListener('input', drawState);
  clearEl.addEventListener('click', () => {
    st.lat = st.lng = null;
    if (marker) { marker.setMap(null); marker = null; }
    drawState();
  });

  function setPoint(lat, lng, center){
    st.lat = lat; st.lng = lng;
    if (map) {
      const pos = new kakao.maps.LatLng(lat, lng);
      if (!marker) {
        const node = document.createElement('div');
        node.className = 'place-mark';
        marker = new kakao.maps.CustomOverlay({ map, position: pos, content: node,
          xAnchor: 0.5, yAnchor: 0.5, zIndex: 5 });
      } else marker.setPosition(pos);
      if (center) map.setCenter(pos);
    }
    drawState();
  }

  function showResults(items, render){
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<li class="none">못 찾았어요. 지도를 직접 눌러 찍어 주세요.</li>';
      return;
    }
    items.slice(0, 5).forEach(it => {
      const r = render(it);
      const li = document.createElement('li');
      li.innerHTML = '<b>' + escapeHTML(r.title) + '</b><span>' + escapeHTML(r.sub || '') + '</span>';
      li.addEventListener('click', () => {
        setPoint(r.lat, r.lng, true);
        if (!nameEl.value.trim()) nameEl.value = r.title.slice(0, 80);
        listEl.innerHTML = '';
        drawState();
      });
      listEl.appendChild(li);
    });
  }

  // 이름으로 먼저 찾고(가게·명소), 안 나오면 주소로 한 번 더
  async function find(){
    const text = q('.pQuery').value.trim();
    if (!text) return;
    listEl.innerHTML = '<li class="none">찾는 중...</li>';
    const places = new kakao.maps.services.Places();
    const byName = await new Promise(res => places.keywordSearch(text, (d, stt) =>
      res(stt === kakao.maps.services.Status.OK ? d : [])));
    if (byName.length) {
      showResults(byName, it => ({ title: it.place_name,
        sub: it.road_address_name || it.address_name || '',
        lat: parseFloat(it.y), lng: parseFloat(it.x) }));
      return;
    }
    const geocoder = new kakao.maps.services.Geocoder();
    const byAddr = await new Promise(res => geocoder.addressSearch(text, (d, stt) =>
      res(stt === kakao.maps.services.Status.OK ? d : [])));
    showResults(byAddr, it => ({ title: it.address_name, sub: '주소',
      lat: parseFloat(it.y), lng: parseFloat(it.x) }));
  }

  q('.place-open').addEventListener('click', async () => {
    if (!boxEl.hidden) { boxEl.hidden = true; return; }
    boxEl.hidden = false;
    if (map) { map.relayout(); return; }

    try { await loadKakaoMaps(); }
    catch (e) { q('.place-map').textContent = '지도를 불러오지 못했어요'; return; }

    const start = (Number.isFinite(st.lat) && Number.isFinite(st.lng))
      ? new kakao.maps.LatLng(st.lat, st.lng)
      : new kakao.maps.LatLng(36.5, 127.9);          // 아무것도 없으면 전국
    map = new kakao.maps.Map(q('.place-map'), {
      center: start, level: (Number.isFinite(st.lat) ? 4 : 12),
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.TOPLEFT);
    if (Number.isFinite(st.lat)) setPoint(st.lat, st.lng, false);

    kakao.maps.event.addListener(map, 'click', e => {
      const ll = e.latLng;
      setPoint(ll.getLat(), ll.getLng(), false);
      // 누른 자리가 어디인지 알려 준다 — 이름 칸이 비어 있으면 채워도 준다
      new kakao.maps.services.Geocoder().coord2Address(ll.getLng(), ll.getLat(), (d, stt) => {
        if (stt !== kakao.maps.services.Status.OK || !d[0]) return;
        const addr = (d[0].road_address && d[0].road_address.address_name) ||
                     (d[0].address && d[0].address.address_name) || '';
        if (addr) {
          whereEl.textContent = '\uD83D\uDCCD ' + addr;
          if (!nameEl.value.trim()) { nameEl.value = addr.slice(0, 80); }
        }
      });
    });

    q('.pQuery').value = nameEl.value.trim();
    if (q('.pQuery').value) find();
  });

  q('.pFind').addEventListener('click', find);
  q('.pQuery').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); find(); } });

  return {
    // 저장할 값. 이름을 지웠으면 좌표도 같이 버린다.
    async value(onMsg){
      const name = nameEl.value.trim();
      if (!name) return { place_name: null, place_lat: null, place_lng: null, found: null };
      if (Number.isFinite(st.lat) && Number.isFinite(st.lng)) {
        return { place_name: name, place_lat: st.lat, place_lng: st.lng, found: true };
      }
      // 손으로 안 찍었으면 예전처럼 이름으로 찾아 본다
      if (onMsg) onMsg('장소를 지도에서 찾는 중...');
      return await resolvePlace(name);
    },
  };
}

let addPlacePicker = null;

/* ---------- 가볼 곳에서 고르기 ----------
   이제까지는 이벤트 -> 가볼 곳 한 방향뿐이었다. 나들이를 짜면서 「적어 둔 곳」을
   일정으로 옮길 때, 이름을 다시 치고 좌표를 다시 찾는 일이 없게 한다. */
let WISH_PLACES = null;

async function loadWishPlaces(){
  if (WISH_PLACES) return WISH_PLACES;
  const { data, error } = await sb.from('places')
    .select('id, name, category, lat, lng, address, memo, status, season')
    .eq('status', 'want')
    .order('created_at', { ascending: false });
  if (error) { console.error('가볼 곳 목록 오류:', error); return (WISH_PLACES = []); }
  return (WISH_PLACES = data || []);
}

const WISH_ICON = { 먹거리:'🍜', 자연:'🌳', 체험:'🎨', 숙소:'🏨' };

async function toggleWishPick(){
  const box = $('#wishPickBox');
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<div class="none">불러오는 중…</div>';
  const list = await loadWishPlaces();
  if (!list.length) {
    box.innerHTML = '<div class="none">가볼 곳에 적어 둔 「가보고 싶은 곳」이 없습니다.</div>';
    return;
  }
  box.innerHTML = '';
  list.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wp';
    b.innerHTML = (WISH_ICON[p.category] || '📍') + ' ' + escapeHTML(p.name) +
      '<span class="sub">' + escapeHTML([p.category, p.season && p.season !== '아무때나' ? p.season : '',
        p.address || ''].filter(Boolean).join(' · ')) + '</span>';
    b.addEventListener('click', () => {
      if (!$('#addTitle').value.trim()) $('#addTitle').value = p.name;
      // 좌표까지 그대로 물려주려면 고르개를 그 값으로 다시 세우는 것이 가장 확실하다
      addPlacePicker = makePlacePicker($('#addPlaceField'),
        { name: p.name, lat: p.lat, lng: p.lng });
      if (p.memo && !$('#addDetail').value.trim()) $('#addDetail').value = p.memo;
      box.hidden = true;
      const msg = $('#add-msg');
      msg.className = '';
      msg.textContent = '「' + p.name + '」을 가져왔습니다' +
        (Number.isFinite(p.lat) ? ' 📍 핀도 함께.' : ' (좌표는 저장할 때 찾아 봅니다)');
    });
    box.appendChild(b);
  });
}



// ----- 장소 -> 좌표 -----
// 이름만 저장해도 지도는 열린다(이름으로 찾아 준다). 좌표는 목록 페이지 지도에 핀을 찍는 데 쓴다.
// 못 찾아도 저장은 그대로 진행한다 — 장소 하나 때문에 일정이 안 들어가면 안 되므로.
async function resolvePlace(text){
  const name = String(text || '').trim();
  if (!name) return { place_name: null, place_lat: null, place_lng: null, found: null };
  const hit = await geocodePlace(name);
  return {
    place_name: name,
    place_lat: hit ? hit.lat : null,
    place_lng: hit ? hit.lng : null,
    found: !!hit,
  };
}
function placeNote(res){
  if (!res.place_name) return '';
  return res.found ? ' 📍 지도에 핀도 찍었어요.'
                   : ' (좌표를 못 찾아서 핀은 못 찍었어요 — 이름으로는 지도가 열립니다)';
}

async function refreshAuthUI(){
  // 관리 화면은 부모만. 아이 계정으로 들어오면 로그인 화면에 머문다.
  const session = await refreshAuth();
  if (session && isAdmin) {
    loginBox.style.display = 'none';
    adminBox.style.display = 'block';
    $('#whoami').textContent = session.user.email + ' 로 로그인됨';
    fillPanelSelect();
    fillMetaForm();
    if (!addPlacePicker) addPlacePicker = makePlacePicker($('#addPlaceField'));
    const tf = $('#addTimeFrom'), tt = $('#addTimeTo');
    if (tf && !tf.options.length) {
      tf.innerHTML = timeOptionsHTML();
      tt.innerHTML = timeOptionsHTML();
      linkTimePair(tf, tt);
    }
    const wb = $('#wishPickBtn');
    if (wb && !wb.dataset.on) { wb.dataset.on = '1'; wb.addEventListener('click', toggleWishPick); }
    await checkExtraImagesColumn();     // 사진 여러 장 컬럼 유무를 먼저 확인
    await loadList();
    await loadCustomTabsAdmin();
    openEditFromQuery();
  } else {
    loginBox.style.display = 'block';
    adminBox.style.display = 'none';
  }
}

$('#loginBtn').addEventListener('click', async () => {
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPw').value;
  $('#login-msg').textContent = '로그인 중...';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { $('#login-msg').textContent = '로그인 실패: ' + error.message; return; }
  $('#login-msg').textContent = '';
  refreshAuthUI();
});

$('#logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  refreshAuthUI();
});

// ----- 새 일정 추가 폼의 날짜/탭 드롭다운 채우기 -----
function fillPanelSelect(){
  const sel = $('#addPanel');
  sel.addEventListener('change', () => {
    if (insertAfter && insertAfter.panel !== sel.value) { insertAfter = null; syncInsertNote(); }
  });
  sel.innerHTML = CONFIG.panels.map(p => '<option value="' + p.id + '">' + p.label + '</option>').join('');
}


// (글쓰기 도구막대 buildFormatBar 는 common.js 로 옮겼음 — 일기장에서도 씀)

// ----- 커스텀 탭 사진 첨부: 업로드한 뒤 내용 맨 끝에 "![](주소)" 한 줄로 붙여줌 -----
async function appendImagesToTextarea(fileInput, textarea, msgEl){
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;
  const setMsg = (cls, text) => { if (msgEl) { msgEl.className = cls; msgEl.textContent = text; } };

  for (let i = 0; i < files.length; i++) {
    setMsg('', '사진 올리는 중... (' + (i+1) + '/' + files.length + ') ' + files[i].name);
    try {
      const uploaded = await uploadImageWithMeta(files[i]);
      const prefix = textarea.value.trim() ? textarea.value.replace(/\s*$/, '') + '\n\n' : '';
      textarea.value = prefix + '![](' + uploaded.url + ')';
    } catch (e) {
      setMsg('err', '사진 업로드 실패: ' + ((e && e.message) || e));
      fileInput.value = '';
      return;
    }
  }
  setMsg('ok', '사진 ' + files.length + '장을 내용에 넣었어요. 저장 버튼을 눌러야 반영됩니다.');
  fileInput.value = '';
}

// ----- 커스텀 탭 (custom_tabs 테이블) 목록/추가/수정/삭제 -----
async function loadCustomTabsAdmin(){
  const listEl = $('#ctList');
  listEl.innerHTML = '불러오는 중...';
  const { data, error } = await sb.from('custom_tabs').select('*')
    .eq('event_id', CONFIG.eventSlug).order('sort_order', {ascending:true}).order('id', {ascending:true});
  if (error) { listEl.innerHTML = '<div class="empty">불러오기 실패: ' + error.message + '</div>'; return; }
  if (!data.length) { listEl.innerHTML = '<div class="empty">아직 만든 탭이 없습니다</div>'; return; }
  listEl.innerHTML = '';
  data.forEach(row => listEl.appendChild(renderCustomTabCard(row)));
}

function renderCustomTabCard(row){
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.ctId = row.id;
  card.innerHTML =
    '<div class="item-title">' + escapeHTML(row.label) + '</div>' +
    '<div class="item-actions">' +
      '<button class="btn ghost ctEditBtn">수정</button>' +
      '<button class="btn danger ctDelBtn">삭제</button>' +
    '</div>';

  card.querySelector('.ctDelBtn').addEventListener('click', async () => {
    if (!confirm('"' + row.label + '" 탭을 삭제할까요?')) return;
    const { error } = await sb.from('custom_tabs').delete().eq('id', row.id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    loadCustomTabsAdmin();
  });

  card.querySelector('.ctEditBtn').addEventListener('click', () => {
    card.innerHTML = '';
    card.appendChild(renderCustomTabEditForm(row));
  });

  return card;
}

function renderCustomTabEditForm(row){
  const form = document.createElement('div');
  form.className = 'edit-form';
  form.innerHTML =
    '<label>탭 이름</label><input type="text" class="ctLabelInput" value="' + escapeHTML(row.label) + '">' +
    '<label>내용</label><textarea class="ctContentInput" style="min-height:160px;">' + escapeHTML(row.content || '') + '</textarea>' +
    '<label>사진 추가 (선택 · 여러 장 가능)</label><input type="file" class="ctImageInput" accept="image/*" multiple>' +
    '<div class="btn-row"><button class="btn saveBtn">저장</button><button class="btn ghost cancelBtn">취소</button></div>' +
    '<div class="ct-edit-msg" style="font-size:12.5px; margin-top:8px; min-height:1em;"></div>';

  form.querySelector('.ctImageInput').addEventListener('change', (e) =>
    appendImagesToTextarea(e.target, form.querySelector('.ctContentInput'), form.querySelector('.ct-edit-msg')));

  // 수정할 때도 같은 도구막대를 쓴다
  buildFormatBar(form.querySelector('.ctContentInput'),
    { fileInput: form.querySelector('.ctImageInput') });

  form.querySelector('.cancelBtn').addEventListener('click', loadCustomTabsAdmin);

  form.querySelector('.saveBtn').addEventListener('click', async () => {
    const saveBtn = form.querySelector('.saveBtn');
    const label = form.querySelector('.ctLabelInput').value.trim();
    const content = form.querySelector('.ctContentInput').value;
    if (!label) { alert('탭 이름을 입력해주세요.'); return; }
    saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
    const { error } = await sb.from('custom_tabs').update({ label, content }).eq('id', row.id);
    if (error) { alert('저장 실패: ' + error.message); saveBtn.disabled = false; saveBtn.textContent = '저장'; return; }
    loadCustomTabsAdmin();
  });

  return form;
}

$('#ctAddBtn').addEventListener('click', async () => {
  const msg = $('#ct-msg'), btn = $('#ctAddBtn');
  msg.className = ''; msg.textContent = '';
  const label = $('#ctLabel').value.trim();
  const content = $('#ctContent').value;
  if (!label) { msg.className = 'err'; msg.textContent = '탭 이름을 입력해주세요.'; return; }

  btn.disabled = true; btn.textContent = '추가하는 중...';
  const { data: existing } = await sb.from('custom_tabs').select('sort_order')
    .eq('event_id', CONFIG.eventSlug).order('sort_order', {ascending:false}).limit(1);
  const nextOrder = existing && existing.length ? existing[0].sort_order + 1 : 0;
  const { error } = await sb.from('custom_tabs').insert({ event_id: CONFIG.eventSlug, label, content, sort_order: nextOrder });
  btn.disabled = false; btn.textContent = '+ 탭 추가하기';
  if (error) { msg.className = 'err'; msg.textContent = '추가 실패: ' + error.message; return; }

  msg.className = 'ok'; msg.textContent = '추가됐어요!';
  $('#ctLabel').value = ''; $('#ctContent').value = ''; $('#ctImage').value = '';
  loadCustomTabsAdmin();
});

$('#ctImage').addEventListener('change', (e) =>
  appendImagesToTextarea(e.target, $('#ctContent'), $('#ct-msg')));

// 새 탭 작성칸에 서식 도구막대 붙이기
buildFormatBar($('#ctContent'), { fileInput: $('#ctImage') });

// ----- 이미지 업로드 (Storage 'event-images' 버킷, 5MB로 자동 압축) -----
// 사진 파일에는 아무것도 새기지 않고, EXIF 날짜/위치는 별도로 뽑아서 DB 컬럼에 저장함(화면 오버레이용)
const IMAGE_COMPRESS_TARGET = 3 * 1024 * 1024;   // common.js 의 IMAGE_LIMIT 과 같은 기준
async function uploadImageWithMeta(file){
  const meta = await extractPhotoMeta(file);
  const uploadFile = await compressImageToLimit(file, IMAGE_COMPRESS_TARGET);
  const path = CONFIG.eventSlug + '/' + Date.now() + '-' + uploadFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const { error } = await sb.storage.from('event-images').upload(path, uploadFile);
  if (error) throw error;
  const { data } = sb.storage.from('event-images').getPublicUrl(path);
  // 일정 목록의 사진 칸은 250px 남짓인데 원본은 4000px 이 넘는다. 작은 사본을 같이 만들어 둔다.
  const thumb = await makeAndUploadThumb('event-images', path, uploadFile);
  return { url: data.publicUrl, thumb: thumb || null,
           taken_at: meta.takenAtISO, location_name: meta.place || null };
}

// ----- 일정 사진 여러 장 -----
// 첫 장은 기존처럼 image_url 에 저장하고(예전 데이터/갤러리 질의와 호환),
// 나머지는 extra_images(jsonb) 배열에 [{url, taken_at, location_name}] 로 쌓음.
// 컬럼이 아직 없는 프로젝트에서도 첫 장만으로 정상 동작하도록 존재 여부를 먼저 확인함.
let hasExtraImages = false;
async function checkExtraImagesColumn(){
  const { error } = await sb.from('events').select('extra_images').limit(1);
  hasExtraImages = !error;
  if (!hasExtraImages) {
    const box = document.createElement('div');
    box.className = 'card';
    box.style.cssText = 'border-color:#d9822b; background:#fff6ec;';
    box.innerHTML =
      '<h2 style="color:#b3600f;">사진 여러 장 기능을 켜려면</h2>' +
      '<p style="font-size:13px; line-height:1.7; margin:0 0 8px;">' +
      'Supabase SQL Editor에서 아래 한 줄을 실행해주세요. 실행 전까지는 일정마다 사진 1장만 저장됩니다.</p>' +
      '<pre style="user-select:all;">alter table events add column if not exists extra_images jsonb default \'[]\'::jsonb;</pre>';
    const anchor = adminBox.querySelector('.card') || document.querySelector('.card');
    if (anchor) anchor.parentNode.insertBefore(box, anchor);
  }
  return hasExtraImages;
}

function extraImagesOf(r){
  const v = r && r.extra_images;
  return Array.isArray(v) ? v : [];
}

// 파일 여러 개를 순서대로 올려 [{url, taken_at, location_name}] 로 돌려줌
async function uploadManyWithMeta(files, onProgress){
  const out = [];
  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(i + 1, files.length, files[i].name);
    out.push(await uploadImageWithMeta(files[i]));
  }
  return out;
}

// 첫 장 + 나머지를 DB 컬럼 모양으로 정리
function splitPhotos(shots){
  const first = shots[0] || null;
  return {
    image_url: first ? first.url : null,
    thumb_url: first ? (first.thumb || null) : null,
    taken_at: first ? first.taken_at : null,
    location_name: first ? first.location_name : null,
    extra_images: shots.slice(1),
  };
}

// ----- 목록 불러오기 -----
async function loadList(){
  const listEl = $('#list');
  listEl.innerHTML = '불러오는 중...';
  const { data, error } = await sb.from('events').select('*')
    .eq('event_id', CONFIG.eventSlug)
    .order('panel', {ascending:true}).order('sort_order', {ascending:true});
  if (error) { listEl.innerHTML = '<div class="empty">불러오기 실패: ' + error.message + '</div>'; return; }

  const byPanel = {};
  data.forEach(r => (byPanel[r.panel] = byPanel[r.panel] || []).push(r));
  // 보는 쪽과 같은 차례로 늘어놓아야 「여기 아래」가 눈에 보이는 그대로 동작한다
  Object.values(byPanel).forEach(rows => rows.sort(bySchedule));

  listEl.innerHTML = '';
  CONFIG.panels.forEach(p => {
    const rows = byPanel[p.id] || [];
    const group = document.createElement('div');
    group.className = 'panel-group';
    group.innerHTML = '<h3>' + p.label + '</h3>';
    if (!rows.length) {
      group.innerHTML += '<div class="empty">아직 일정이 없습니다</div>';
    } else {
      rows.forEach(r => group.appendChild(renderCard(r)));
    }
    listEl.appendChild(group);
  });
}

/* 어디에 끼워 넣을지.
   ------------------------------------------------------------------
   새 일정은 늘 그 판의 맨 뒤(sort_order = 마지막 + 1)로 갔다. 하루 일정을 시간
   순서대로 적다가 중간에 빠뜨린 것이 생각나면 손 쓸 방법이 없었다.
   여기에 「이 카드 다음」을 적어 두면 그 자리에 넣는다. null 이면 예전처럼 맨 뒤다. */
let insertAfter = null;   // { id, panel, sortOrder, title }

function syncInsertNote(){
  const note = $('#insertNote');
  if (!note) return;
  if (!insertAfter) { note.hidden = true; return; }
  note.hidden = false;
  // 시간을 적으면 시각 순으로 저절로 자리를 잡으므로, 이 자리 지정은 시간을 비운
  // 일정에서만 뜻이 있다. 그 사실을 여기서 알려 준다.
  note.innerHTML = '<span>「' + escapeHTML(insertAfter.title) + '」 <b>다음</b>에 넣습니다' +
    '<br><small>시간을 고르면 그 시각 차례로 자리를 잡습니다</small></span>' +
    '<button type="button" class="btn ghost" id="insertReset">맨 뒤로</button>';
  $('#insertReset').addEventListener('click', () => { insertAfter = null; syncInsertNote(); });
}

function renderCard(r){
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.id = r.id;
  card.innerHTML =
    '<div class="item-time">' + escapeHTML(r.time || '') + '</div>' +
    '<div class="item-title">' + escapeHTML(r.title) + '</div>' +
    (r.place_name ? '<div class="item-detail">' +
        (Number.isFinite(r.place_lat) ? '📍 ' : '🔎 ') + escapeHTML(r.place_name) + '</div>' : '') +
    (r.detail ? '<div class="item-detail">' + escapeHTML(r.detail) + '</div>' : '') +
    (r.image_url ? '<img class="item-img" loading="lazy" decoding="async" src="' + (r.thumb_url || r.image_url) + '" alt="">' : '') +
    '<div class="item-actions">' +
      '<button class="btn ghost editBtn">수정</button>' +
      '<button class="btn ghost afterBtn">＋ 여기 아래</button>' +
      '<button class="btn danger delBtn">삭제</button>' +
    '</div>';

  card.querySelector('.delBtn').addEventListener('click', async () => {
    if (!confirm('"' + r.title + '" 일정을 삭제할까요?')) return;
    // event-images 버킷의 것만 치운다. 사진으로 일정을 만들면 갤러리 사진 주소가
    // 그대로 붙는데, 그건 갤러리가 주인이라 여기서 지우면 갤러리가 깨진다.
    // removeStored 가 다른 버킷 주소는 알아서 걸러 낸다.
    const files = [r.image_url, r.thumb_url].concat(urlsIn(extraImagesOf(r)));
    const { error } = await sb.from('events').delete().eq('id', r.id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    await removeStored('event-images', files);
    loadList();
  });

  card.querySelector('.editBtn').addEventListener('click', () => {
    card.innerHTML = '';
    card.appendChild(renderEditForm(r));
  });

  card.querySelector('.afterBtn').addEventListener('click', () => {
    insertAfter = { id: r.id, panel: r.panel, sortOrder: r.sort_order || 0, title: r.title };
    $('#addPanel').value = r.panel;      // 판이 다르면 넣을 자리가 어긋난다
    syncInsertNote();
    $('#add-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#addTitle').focus();
  });

  return card;
}

// ----- 이벤트 페이지의 "✏️ 수정" 버튼(?edit=id)으로 들어온 경우 해당 일정을 바로 수정 모드로 열기 -----
// 이벤트 페이지의 "+ 일정 추가하기" 버튼(?addPanel=id)으로 들어온 경우 추가 폼의 날짜를 미리 선택
function openEditFromQuery(){
  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  const editTab = params.get('editTab');
  const addPanel = params.get('addPanel');

  if (editId) {
    const card = document.querySelector('.item-card[data-id="' + editId + '"]');
    if (!card) return;
    card.querySelector('.editBtn').click();
    card.scrollIntoView({behavior:'smooth', block:'center'});
  } else if (editTab) {
    const card = document.querySelector('.item-card[data-ct-id="' + editTab + '"]');
    if (!card) return;
    card.querySelector('.ctEditBtn').click();
    card.scrollIntoView({behavior:'smooth', block:'center'});
  } else if (addPanel) {
    $('#addPanel').value = addPanel;
    $('#add-box').scrollIntoView({behavior:'smooth', block:'center'});
    $('#addTitle').focus();
  }
}

function renderEditForm(r){
  // 대표 사진(image_url) + 추가 사진(extra_images)을 한 줄로 이어 다룸
  const existing = (r.image_url
    ? [{ url: r.image_url, taken_at: r.taken_at || null, location_name: r.location_name || null }]
    : []).concat(extraImagesOf(r));

  const form = document.createElement('div');
  form.className = 'edit-form';
  form.innerHTML =
    '<label>시간 (열 분 간격)</label>' +
    '<div class="time-pick">' +
      '<select class="eTimeFrom" aria-label="시작 시각">' + timeOptionsHTML() + '</select>' +
      '<span class="tilde">~</span>' +
      '<select class="eTimeTo" aria-label="끝 시각">' + timeOptionsHTML() + '</select>' +
    '</div>' +
    '<label>제목</label><input type="text" class="eTitle" value="' + escapeHTML(r.title) + '">' +
    '<label>장소</label><div class="ePlaceField"></div>' +
    '<label>상세 설명</label><textarea class="eDetail">' + escapeHTML(r.detail || '') + '</textarea>' +
    '<div class="yt-tip">유튜브 주소를 <b>한 줄에 혼자</b> 적으면 그 자리에 영상 칸이 생겨요.</div>' +
    '<label>사진</label>' +
    // 이미 올라간 사진들을 한 줄씩 보여주고, 장마다 삭제 체크박스를 붙임
    existing.map((sh, i) =>
      '<div class="ePhoto" data-idx="' + i + '" style="margin-bottom:8px;">' +
        '<img class="item-img" loading="lazy" decoding="async" alt="첨부한 사진" src="' + escapeHTML(sh.url) + '">' +
        '<label style="display:flex; align-items:center; gap:6px; font-weight:400; margin-top:4px;">' +
          '<input type="checkbox" class="eDrop" style="width:auto;">이 사진 삭제</label>' +
      '</div>').join('') +
    '<input type="file" class="eImage" accept="image/*" multiple>' +
    '<div class="btn-row"><button class="btn saveBtn">저장</button><button class="btn ghost cancelBtn">취소</button></div>' +
    '<div class="add-msg"></div>';

  // 적혀 있던 시간을 고른 자리로 옮긴다
  {
    const f = form.querySelector('.eTimeFrom'), t = form.querySelector('.eTimeTo');
    const parsed = parseTimeText(r.time);
    setTimeSelect(f, parsed.from);
    setTimeSelect(t, parsed.to);
    linkTimePair(f, t);
  }

  // 폼이 화면에 붙은 뒤에 만들어야 지도가 크기를 잴 수 있다
  const editPlacePicker = makePlacePicker(form.querySelector('.ePlaceField'), {
    name: r.place_name || '', lat: r.place_lat, lng: r.place_lng,
  });

  form.querySelector('.cancelBtn').addEventListener('click', loadList);

  form.querySelector('.saveBtn').addEventListener('click', async () => {
    const saveBtn = form.querySelector('.saveBtn');
    const time = timeTextOf(form.querySelector('.eTimeFrom').value,
                            form.querySelector('.eTimeTo').value);
    const title = form.querySelector('.eTitle').value.trim();
    const detail = form.querySelector('.eDetail').value.trim();
    const files = Array.from(form.querySelector('.eImage').files);
    if (!title) { alert('제목을 입력해주세요.'); return; }

    saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
    const msgEl = form.querySelector('.add-msg');

    // 체크된 사진을 빼고, 새로 고른 사진을 뒤에 붙임
    const dropped = Array.from(form.querySelectorAll('.ePhoto')).map(el => el.querySelector('.eDrop').checked);
    let shots = existing.filter((_, i) => !dropped[i]);
    try {
      if (files.length) {
        const room = hasExtraImages ? files.length : Math.max(0, 1 - shots.length);
        shots = shots.concat(await uploadManyWithMeta(files.slice(0, room),
          (i, n, name) => { msgEl.textContent = '사진 올리는 중... (' + i + '/' + n + ') ' + name; }));
      }
    } catch (err) {
      msgEl.className = 'add-msg err'; msgEl.textContent = '이미지 업로드 실패: ' + err.message;
      saveBtn.disabled = false; saveBtn.textContent = '저장';
      return;
    }
    if (!hasExtraImages) shots = shots.slice(0, 1);

    // 지도에서 직접 찍었으면 그 좌표를 그대로, 이름만 적었으면 찾아 본다
    const placeRes = await editPlacePicker.value(t => { msgEl.textContent = t; });

    const photos = splitPhotos(shots);
    const patch = { time, title, detail: detail || null,
      image_url: photos.image_url, taken_at: photos.taken_at, location_name: photos.location_name,
      place_name: placeRes.place_name, place_lat: placeRes.place_lat, place_lng: placeRes.place_lng };
    if (hasExtraImages) patch.extra_images = photos.extra_images;
    const { error } = await sb.from('events').update(patch).eq('id', r.id);
    if (error) { alert('저장 실패: ' + error.message); saveBtn.disabled = false; saveBtn.textContent = '저장'; return; }
    loadList();
  });

  return form;
}

// ----- 새 일정 추가 -----
$('#addBtn').addEventListener('click', async () => {
  const addBtn = $('#addBtn');
  const panel = $('#addPanel').value;
  const time = timeTextOf($('#addTimeFrom').value, $('#addTimeTo').value);
  const title = $('#addTitle').value.trim();
  const detail = $('#addDetail').value.trim();
  const files = Array.from($('#addImage').files);
  const msg = $('#add-msg');
  msg.className = ''; msg.textContent = '';

  if (!title) { msg.className = 'err'; msg.textContent = '제목을 입력해주세요.'; return; }

  addBtn.disabled = true; addBtn.textContent = '추가 중...';

  let photos = { image_url: null, taken_at: null, location_name: null, extra_images: [] };
  if (files.length) {
    try {
      const shots = await uploadManyWithMeta(
        hasExtraImages ? files : files.slice(0, 1),      // 컬럼이 없으면 첫 장만 저장
        (i, n, name) => { msg.className = ''; msg.textContent = '사진 올리는 중... (' + i + '/' + n + ') ' + name; });
      photos = splitPhotos(shots);
    } catch (err) {
      msg.className = 'err'; msg.textContent = '이미지 업로드 실패: ' + err.message;
      addBtn.disabled = false; addBtn.textContent = '추가하기';
      return;
    }
  }

  const placeRes = await addPlacePicker.value(t => { msg.className = ''; msg.textContent = t; });

  // 끼워 넣기: 기준 카드 뒤에 있는 것들을 한 칸씩 밀고 그 자리를 비운다.
  // 한 판에 일정이 많아야 열 남짓이라 한 줄씩 고쳐도 무겁지 않다. 표현식 update
  // (sort_order = sort_order + 1)는 PostgREST 로 보낼 수 없어서 이 방법을 쓴다.
  let nextOrder;
  if (insertAfter && insertAfter.panel === panel) {
    const { data: 뒤엣것, error: 읽기오류 } = await sb.from('events')
      .select('id, sort_order')
      .eq('event_id', CONFIG.eventSlug).eq('panel', panel)
      .gt('sort_order', insertAfter.sortOrder);
    if (읽기오류) {
      addBtn.disabled = false; addBtn.textContent = '추가하기';
      msg.className = 'err'; msg.textContent = '자리를 만들지 못했습니다: ' + 읽기오류.message;
      return;
    }
    for (const row of (뒤엣것 || [])) {
      const { error: 밀기오류 } = await sb.from('events')
        .update({ sort_order: (row.sort_order || 0) + 1 }).eq('id', row.id);
      if (밀기오류) {
        addBtn.disabled = false; addBtn.textContent = '추가하기';
        msg.className = 'err'; msg.textContent = '자리를 만들지 못했습니다: ' + 밀기오류.message;
        return;
      }
    }
    nextOrder = insertAfter.sortOrder + 1;
  } else {
    const { data: existing } = await sb.from('events').select('sort_order')
      .eq('event_id', CONFIG.eventSlug).eq('panel', panel)
      .order('sort_order', {ascending:false}).limit(1);
    nextOrder = (existing && existing[0]) ? existing[0].sort_order + 1 : 1;
  }

  const payload = {
    event_id: CONFIG.eventSlug, panel, sort_order: nextOrder,
    time: time || null, title, detail: detail || null,
    image_url: photos.image_url, taken_at: photos.taken_at, location_name: photos.location_name,
    place_name: placeRes.place_name, place_lat: placeRes.place_lat, place_lng: placeRes.place_lng,
  };
  if (hasExtraImages) payload.extra_images = photos.extra_images;
  const { error } = await sb.from('events').insert(payload);
  addBtn.disabled = false; addBtn.textContent = '추가하기';
  if (error) { msg.className = 'err'; msg.textContent = '추가 실패: ' + error.message; return; }

  msg.className = 'ok';
  msg.textContent = '추가됐습니다!' + placeNote(placeRes) + (files.length > 1 && !hasExtraImages
    ? ' (사진은 첫 장만 저장됐어요 — 위 안내의 SQL을 실행하면 여러 장이 저장됩니다)' : '');
  insertAfter = null; syncInsertNote();
  $('#addTimeFrom').value = ''; $('#addTimeTo').value = ''; $('#addTitle').value = '';
  $('#addDetail').value = ''; $('#addImage').value = '';
  addPlacePicker = makePlacePicker($('#addPlaceField'));   // 장소 칸도 비운다
  loadList();
});

// ----- 기존 사진 재처리: EXIF가 남아있는 사진에서 날짜/위치만 뽑아 DB에 채워넣기 -----
// 사진 파일은 전혀 건드리지 않음(재업로드/삭제 없음) — taken_at/location_name 컬럼만 채움
async function fetchAsFile(url){
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
}

$('#retrofitBtn').addEventListener('click', async () => {
  if (!confirm('기존에 올라간 사진들을 검사해서, EXIF(날짜/위치) 정보가 남아있으면 그 정보만 뽑아 저장해요(사진 파일은 그대로 둠).\n사진 수에 따라 시간이 좀 걸릴 수 있어요. 계속할까요?')) return;

  const btn = $('#retrofitBtn'), msgEl = $('#retrofitMsg');
  btn.disabled = true;
  let done = 0, filled = 0, skipped = 0, failed = 0, blanked = 0;
  const failReasons = [];

  // 찾은 것만 덮어쓴다. 날짜만 나왔다고 location_name 까지 null 로 밀어 버리면
  // 예전에 어렵게 채워 둔 장소가 다시 눌러 볼 때마다 지워진다.
  const patchOf = meta => {
    const patch = {};
    if (meta.takenAtISO) patch.taken_at = meta.takenAtISO;
    if (meta.place) patch.location_name = meta.place;
    return patch;
  };

  const { data: eventsWithImg } = await sb.from('events').select('id, image_url')
    .eq('event_id', CONFIG.eventSlug).not('image_url', 'is', null);
  for (const r of (eventsWithImg || [])) {
    done++;
    msgEl.textContent = '처리 중... (' + done + ') 일정 첨부 사진';
    try {
      const file = await fetchAsFile(r.image_url);
      const meta = await extractPhotoMeta(file);
      if (meta.gps === 'blanked') blanked++;
      const patch = patchOf(meta);
      if (!Object.keys(patch).length) { skipped++; continue; }
      const { error: updErr } = await sb.from('events').update(patch).eq('id', r.id);
      if (updErr) throw updErr;
      filled++;
    } catch (e) {
      failed++;
      failReasons.push('일정 사진: ' + ((e && e.message) || String(e)));
      console.error('일정 사진 재처리 실패:', e);
    }
  }

  const { data: galleryImgs } = await sb.from('gallery_media').select('id, media_url')
    .eq('event_id', CONFIG.eventSlug).eq('media_type', 'image');
  for (const r of (galleryImgs || [])) {
    done++;
    msgEl.textContent = '처리 중... (' + done + ') 갤러리 사진';
    try {
      const file = await fetchAsFile(r.media_url);
      const meta = await extractPhotoMeta(file);
      if (meta.gps === 'blanked') blanked++;
      const patch = patchOf(meta);
      if (!Object.keys(patch).length) { skipped++; continue; }
      const { error: updErr } = await sb.from('gallery_media').update(patch).eq('id', r.id);
      if (updErr) throw updErr;
      filled++;
    } catch (e) {
      failed++;
      failReasons.push('갤러리 사진: ' + ((e && e.message) || String(e)));
      console.error('갤러리 사진 재처리 실패:', e);
    }
  }

  btn.disabled = false;
  msgEl.textContent = '완료! 총 ' + done + '장 확인 · ' + filled + '장에 날짜/위치 채움 · ' + skipped + '장은 EXIF 없어서 건너뜀'
    + (failed ? ' · ' + failed + '장 실패' : '') + '.'
    + (blanked ? '\n' + blanked + '장은 올릴 때 휴대폰이 위치를 지운 사진이라, 여기서는 장소를 되살릴 수 없어요.' : '')
    + (failReasons.length ? '\n실패 사유: ' + failReasons.join(' / ') : '');
  msgEl.style.whiteSpace = 'pre-line';
  loadList();
});

// ----- 초기화: event_meta에서 이벤트 정보/날짜 불러와서 CONFIG 완성 -----
// (사진 여러 장 컬럼 유무는 loadList 전에 checkExtraImagesColumn 으로 확인함)
(async () => {
  if (!CONFIG.eventSlug) { $('#notfound').style.display = 'block'; loginBox.style.display = 'none'; return; }
  $('#backLink').href = './?slug=' + encodeURIComponent(CONFIG.eventSlug);

  const { data, error } = await sb.from('event_meta').select('*').eq('event_id', CONFIG.eventSlug).maybeSingle();
  if (error || !data || !data.start_date || !data.end_date) {
    $('#notfound').style.display = 'block';
    loginBox.style.display = 'none';
    return;
  }

  EVENT_META = data;
  applyAdminTitle();
  CONFIG.panels = buildDatePanels(isoToDateKey(data.start_date), isoToDateKey(data.end_date));
  CONFIG.panels.forEach(p => { if (!p.label) p.label = formatDateLabel(p.dateKey); });

  refreshAuthUI();
})();
