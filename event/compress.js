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

// 노트 탭용 간단한 문법을 HTML로 변환함.
// "# "는 큰제목, "## "는 소제목. 세로선(|)이 포함된 줄이 연달아 있으면 표(첫 줄이 표 제목).
// "![](사진주소)"만 있는 줄은 사진 (관리자 화면의 사진 첨부 버튼이 이 형식으로 넣어줌).
// 빈 줄은 문단/표 구간을 끊는 용도일 뿐, 필수는 아님 — 제목 바로 다음 줄에 표를 이어 써도 됨.
function renderNoteContent(text){
  if (!text || !text.trim()) return '';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let mode = null; // 'para' | 'table'
  let buf = [];

  function flush(){
    if (!buf.length) { mode = null; return; }
    if (mode === 'table') {
      const rows = buf
        .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()))
        .filter(cells => !cells.every(c => /^:?-{1,}:?$/.test(c))); // 마크다운 구분선(---) 행은 무시
      if (rows.length) {
        const [header, ...body] = rows;
        const thead = '<thead><tr>' + header.map(c => '<th>' + escapeHTML(c) + '</th>').join('') + '</tr></thead>';
        const tbody = body.length
          ? '<tbody>' + body.map(r => '<tr>' + r.map(c => '<td>' + escapeHTML(c) + '</td>').join('') + '</tr>').join('') + '</tbody>'
          : '';
        parts.push('<div class="note-table-wrap"><table class="note-table">' + thead + tbody + '</table></div>');
      }
    } else if (mode === 'para') {
      parts.push('<p class="note-para">' + buf.map(escapeHTML).join('<br>') + '</p>');
    }
    buf = []; mode = null;
  }

  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if (line.startsWith('## ')) { flush(); parts.push('<h4 class="note-subheading">' + escapeHTML(line.slice(3)) + '</h4>'); return; }
    if (line.startsWith('# ')) { flush(); parts.push('<h3 class="note-heading">' + escapeHTML(line.slice(2)) + '</h3>'); return; }
    const img = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
    if (img) {
      flush();
      parts.push('<div class="note-img-wrap"><img class="note-img" src="' + escapeHTML(img[2]) + '" alt="' + escapeHTML(img[1]) + '" loading="lazy"></div>');
      return;
    }
    const lineMode = line.includes('|') ? 'table' : 'para';
    if (lineMode !== mode) flush();
    mode = lineMode;
    buf.push(line);
  });
  flush();

  return parts.join('');
}

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
