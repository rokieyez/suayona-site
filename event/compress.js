// 이미지 용량 압축 + EXIF(촬영 날짜/위치) 추출 유틸리티.
// 사진 픽셀 자체에는 아무것도 새기지 않음 — 추출한 날짜/위치는 화면에 별도 오버레이로 표시하는 용도.

// ---------------------------------------------------------------------------
// 좌표 → 지명
//
// 무료 공개 서비스(Nominatim)를 쓰기 때문에 "초당 한 번" 이라는 사용 규약이 있다.
// 사진 40장을 한꺼번에 올리면 그만큼 한꺼번에 물어보게 되므로, 요청을 한 줄로 세워
// 간격을 두고 하나씩 내보낸다. 막히면 그 뒤로는 조용히 포기한다 — 장소가 없다고
// 사진 업로드까지 실패하면 안 되기 때문.
// ---------------------------------------------------------------------------
const _geocodeCache = new Map();
let _geoChain = Promise.resolve();
let _geoBlocked = false;               // 서버가 그만 물어보라고 하면(429/403) 여기서 멈춤
let _geoMisses = 0;                    // 연달아 헛걸음한 횟수
const GEO_GAP_MS = 1100;               // 사용 규약: 초당 1회
const GEO_TIMEOUT_MS = 6000;
const GEO_GIVE_UP = 3;                 // 세 번 연달아 실패하면 이번 방문에는 더 묻지 않는다

const _sleep = ms => new Promise(r => setTimeout(r, ms));

// 지명을 못 얻으면 '' 를, 물어보지도 못했으면(그물 문제·시간초과) null 을 돌려준다.
// 이 둘을 갈라야 "여긴 이름이 없는 곳" 과 "이번엔 실패" 를 구분해 캐시할 수 있다.
async function _lookupPlace(lat, lng){
  let res;
  try {
    res = await Promise.race([
      fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&accept-language=ko&zoom=16'),
      _sleep(GEO_TIMEOUT_MS).then(() => null),
    ]);
  } catch (e) { return null; }
  if (!res) return null;                       // 시간 초과
  if (res.status === 429 || res.status === 403) { _geoBlocked = true; return null; }
  if (!res.ok) return null;

  let data;
  try { data = await res.json(); } catch (e) { return null; }
  const a = (data && data.address) || {};
  const region = a.city || a.town || a.county || a.state || '';
  const district = a.borough || a.suburb || a.city_district || a.village || '';
  const parts = [region, district].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return ((data && data.display_name) || '').split(',').slice(0, 2).join(' ').trim();
}

async function _reverseGeocode(lat, lng){
  // 100m 단위로 나눠 물어보면 한 동네를 걸어다닌 사진마다 새로 묻게 된다.
  // 어차피 쓰는 건 "시 + 구" 정도라 1km 단위로 묶어도 답이 같다.
  const key = lat.toFixed(2) + ',' + lng.toFixed(2);
  if (_geocodeCache.has(key)) return _geocodeCache.get(key);
  if (_geoBlocked) return '';

  const task = _geoChain.then(async () => {
    if (_geocodeCache.has(key)) return _geocodeCache.get(key);   // 줄 서 있는 사이 앞사람이 채웠을 수 있음
    if (_geoBlocked) return '';
    const place = await _lookupPlace(lat, lng);
    if (place === null) {
      // 실패는 캐시하지 않는다 — 다음에 다시 시도해 볼 값이라서.
      // 다만 그물이 끊겼거나 서버가 죽었으면 사진마다 시간초과(6초)를 기다리게 되어
      // 사진 40장 올리는 데 몇 분이 걸린다. 몇 번 연달아 헛걸음하면 이번 방문에는 접는다.
      // (새로고침하면 다시 물어본다.)
      if (++_geoMisses >= GEO_GIVE_UP) _geoBlocked = true;
      return '';
    }
    _geoMisses = 0;
    _geocodeCache.set(key, place);
    return place;
  });
  // 다음 차례는 이번 요청이 끝난 뒤 1.1초를 기다렸다가 출발한다
  const wait = () => _sleep(GEO_GAP_MS);
  _geoChain = task.then(wait, wait);
  return task.catch(() => '');
}

// ---------------------------------------------------------------------------
// 지명 → 좌표 (위와 반대 방향)
//
// 관리 화면에서 장소를 적으면 지도에 핀을 찍기 위한 좌표를 찾아 둔다.
// 같은 서비스를 쓰므로 같은 줄에 세워 보낸다 — 위쪽 _geoChain 을 그대로 공유한다.
//
// 돌려주는 값
//   {lat, lng, label}  찾음
//   null               못 찾았거나 물어보지 못함 (이름만 저장하고 핀은 안 찍힘)
// ---------------------------------------------------------------------------
async function _lookupCoords(q){
  let res;
  try {
    res = await Promise.race([
      fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ko&q=' + encodeURIComponent(q)),
      _sleep(GEO_TIMEOUT_MS).then(() => null),
    ]);
  } catch (e) { return null; }
  if (!res) return null;
  if (res.status === 429 || res.status === 403) { _geoBlocked = true; return null; }
  if (!res.ok) return null;

  let data;
  try { data = await res.json(); } catch (e) { return null; }
  const hit = Array.isArray(data) && data[0];
  if (!hit) return null;
  const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: hit.display_name || '' };
}

function geocodePlace(query){
  const q = String(query || '').trim();
  if (!q) return Promise.resolve(null);
  const task = _geoChain.then(async () => {
    if (_geoBlocked) return null;
    return await _lookupCoords(q);
  });
  const wait = () => _sleep(GEO_GAP_MS);
  _geoChain = task.then(wait, wait);
  return task.catch(() => null);
}

// 사진 파일의 EXIF에서 촬영 일시/위치를 꺼냄.
// 반환: { takenAtISO: string|null, place: string, gps: 'ok'|'blanked'|'none' }
//   ok      — 좌표가 들어 있었음
//   blanked — 위치 칸은 있는데 값이 비어 있음. 휴대폰이 브라우저에 넘기면서 지운 것.
//   none    — 위치 칸 자체가 없음. 위치 기록을 끄고 찍었거나, 중간에 한 번 걸러진 사진.
async function extractPhotoMeta(file){
  const empty = { takenAtISO: null, place: '', gps: 'none' };
  if (!file.type || !file.type.startsWith('image/') || typeof exifr === 'undefined') return empty;

  // 날짜와 좌표는 따로 읽어야 한다.
  // exifr 의 pick 은 파일에 실제로 박혀 있는 "태그 이름" 만 통과시키는데,
  // latitude/longitude 는 태그가 아니라 exifr 가 GPSLatitude 와 GPSLatitudeRef 를
  // 합쳐서 만들어 주는 값이다. 그래서 pick 목록에 적어 두면 오히려 걸러져 사라진다.
  // 위치가 여태 한 장도 안 들어온 이유가 이것이었다. 좌표는 전용 헬퍼로 따로 읽는다.
  let exif = null;
  try { exif = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] }); } catch (e) {}

  let takenAtISO = null;
  const dt = exif && (exif.DateTimeOriginal || exif.CreateDate);
  if (dt instanceof Date && !isNaN(dt)) takenAtISO = dt.toISOString();

  let coords;
  try { coords = await exifr.gps(file); } catch (e) {}

  // Number.isFinite 로 봐야 한다. 값이 지워진 사진에서 exifr 는 NaN 을 돌려주는데
  // NaN 도 typeof 로는 'number' 라, 그것만 보면 좌표가 있는 줄 알고 NaN 으로 지명을 물으러 간다.
  if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    return { takenAtISO, place: await _reverseGeocode(coords.latitude, coords.longitude), gps: 'ok' };
  }
  // 안드로이드는 사진을 브라우저에 넘길 때 위치 칸은 남겨 두고 값만 지운다.
  // 그래서 껍데기만 돌아오면(좌표가 NaN) "사진에는 있었는데 휴대폰이 빼고 줬다" 는 뜻이다.
  return { takenAtISO, place: '', gps: coords ? 'blanked' : 'none' };
}

// taken_at(ISO 문자열)/location_name으로 화면에 얹을 오버레이 HTML을 만듦.
// 둘 다 없으면 빈 문자열 반환 — 사진 위에 아무것도 안 그려짐(이미지 파일 자체는 그대로).
function photoMetaOverlayHTML(takenAt, locationName){
  let dateStr = '';
  if (takenAt) {
    const d = new Date(takenAt);
    if (!isNaN(d)) {
      const pad = n => String(n).padStart(2, '0');
      dateStr = d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  }
  const text = [dateStr, locationName || ''].filter(Boolean).join('   ');
  if (!text) return '';
  return '<div class="photo-meta">' + text + '</div>';
}

function escapeHTML(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// (노트 서식 변환기 renderNoteContent / inlineFmt 는 common.js 로 옮겼음 —
//  일기장에서도 같은 서식을 쓰기 때문. 이벤트 페이지도 common.js 를 불러온다.)

// 이미지를 지정한 용량 이하로 압축(JPEG로 재인코딩). 사진 내용은 그대로 — 리사이즈/화질 조정만 함.
// 이미지가 아니거나 이미 목표 용량 이하면 원본 파일을 그대로 반환함(불필요한 화질 손실 방지).
async function compressImageToLimit(file, maxBytes, opts) {
  opts = opts || {};
  const maxDim = opts.maxDim || 2400;

  if (!file.type || !file.type.startsWith('image/')) return file;
  if (file.size <= maxBytes) return file;

  let img;
  const url = URL.createObjectURL(file);
  try {
    img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    return file; // 디코딩 실패 시 원본 그대로 업로드
  }

  let width = img.naturalWidth, height = img.naturalHeight;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  function draw() {
    canvas.width = width; canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
  }

  let quality = 0.9;
  draw();
  let blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));

  // 화질을 낮춰가며 용량 맞추기
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
  }
  // 그래도 크면 가로세로 크기 자체를 줄여가며 재시도
  while (blob && blob.size > maxBytes && Math.min(width, height) > 500) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    draw();
    blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
  }

  URL.revokeObjectURL(url);

  if (!blob) return file;
  const newName = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}
