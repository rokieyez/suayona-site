// 이미지 용량 압축 + EXIF(촬영 날짜/위치) 추출 유틸리티.
// 사진 픽셀 자체에는 아무것도 새기지 않음 — 추출한 날짜/위치는 화면에 별도 오버레이로 표시하는 용도.

const _geocodeCache = new Map();

async function _reverseGeocode(lat, lng){
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (_geocodeCache.has(key)) return _geocodeCache.get(key);

  const timeout = new Promise(resolve => setTimeout(() => resolve(''), 5000));
  const fetchPromise = (async () => {
    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&accept-language=ko&zoom=16'
      );
      if (!res.ok) return '';
      const data = await res.json();
      const a = data.address || {};
      const region = a.city || a.town || a.county || a.state || '';
      const district = a.borough || a.suburb || a.city_district || a.village || '';
      const parts = [region, district].filter(Boolean);
      if (parts.length) return parts.join(' ');
      return (data.display_name || '').split(',').slice(0, 2).join(' ').trim();
    } catch (e) { return ''; }
  })();

  const result = await Promise.race([fetchPromise, timeout]);
  _geocodeCache.set(key, result);
  return result;
}

// 사진 파일의 EXIF에서 촬영 일시/위치를 꺼냄. 정보가 없으면 필드가 null/빈 문자열로 옴.
// 반환: { takenAtISO: string|null, place: string }
async function extractPhotoMeta(file){
  if (!file.type || !file.type.startsWith('image/') || typeof exifr === 'undefined') {
    return { takenAtISO: null, place: '' };
  }
  let exif;
  try {
    exif = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'] });
  } catch (e) { return { takenAtISO: null, place: '' }; }
  if (!exif) return { takenAtISO: null, place: '' };

  let takenAtISO = null;
  const dt = exif.DateTimeOriginal || exif.CreateDate;
  if (dt instanceof Date && !isNaN(dt)) takenAtISO = dt.toISOString();

  let place = '';
  if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
    place = await _reverseGeocode(exif.latitude, exif.longitude);
  }

  return { takenAtISO, place };
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
