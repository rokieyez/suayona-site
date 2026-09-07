// board.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('board');
buildBackdrop('board');   // 배경 픽셀 겹 (common.js)

const AUTHORS = Object.assign({}, HERO_NAMES, { together:'같이' });   // 정본은 common.js
let posts = [];
const lightbox = createLightbox();

// 사진이 있는 글만 모아서 라이트박스에서 앞뒤로 넘길 수 있게 함
// 사진에 남은 촬영 날짜. 없으면 null — 그때는 날짜 없이 저장된다.
async function exifDate(file){
  try {
    const meta = await extractPhotoMeta(file);
    return meta.takenAtISO ? meta.takenAtISO.slice(0, 10) : null;
  } catch (e) { return null; }
}

// ---------- 날씨 도장 ----------
// 그날 날씨를 일기에 찍어 준다. 열쇠 없이 좌표만 주면 되는 open-meteo 를 쓰고, 자리는
// 우리가 사는 대한민국 서울 자양동이다(pages/index.js 의 WEATHER_AT · farm-rules.js 의 SKY_AT 과 같은 값).
// 최근 것은 예보 API 에 past_days 를 붙여 받고, 두 달이 넘은 날은 기록 보관 API 로 간다.
// 실패하면 도장 없이 그냥 저장된다 — 날씨는 덤이지, 일기를 막을 이유가 아니다.
const W_AT = 'latitude=37.534&longitude=127.0823' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul';
const W_FACE = [
  [0, 0, '☀️', '맑음'],      [1, 2, '🌤', '구름 조금'], [3, 3, '☁️', '흐림'],
  [45, 48, '🌫', '안개'],    [51, 57, '🌦', '이슬비'],  [61, 67, '🌧', '비'],
  [71, 77, '❄️', '눈'],      [80, 82, '🌦', '소나기'],  [85, 86, '🌨', '눈 소나기'],
  [95, 99, '⛈', '천둥번개'],
];
// 오늘 날짜를 이 자리 시각으로. toISOString 은 협정시라 자정 넘어 쓰면 어제가 된다.
function todayISO(){
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}
function weatherFace(code){
  for (const f of W_FACE) if (code >= f[0] && code <= f[1]) return f;
  return null;
}
async function weatherOn(day){
  if (!day) return null;
  const days = Math.round((Date.now() - new Date(day + 'T12:00:00+09:00').getTime()) / 86400000);
  if (days < 0 || days > 3650) return null;            // 아직 안 온 날, 또는 너무 옛날
  const url = days <= 60
    ? 'https://api.open-meteo.com/v1/forecast?' + W_AT +
      '&past_days=' + Math.min(92, days + 1) + '&forecast_days=1'
    : 'https://archive-api.open-meteo.com/v1/archive?' + W_AT +
      '&start_date=' + day + '&end_date=' + day;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);    // 날씨 때문에 저장이 늦어지면 안 된다
  try {
    const j = await (await fetch(url, { signal: ac.signal })).json();
    const d = j.daily || {}, i = (d.time || []).indexOf(day);
    if (i < 0 || typeof d.weather_code[i] !== 'number') return null;
    return { code: d.weather_code[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i] };
  } catch (e) { return null; } finally { clearTimeout(timer); }
}
function weatherTag(w){
  if (!w || typeof w.code !== 'number') return '';
  const f = weatherFace(w.code);
  if (!f) return '';
  const t = [w.tmax, w.tmin].filter(v => typeof v === 'number').map(v => Math.round(v) + '°').join(' · ');
  return '<span class="tag weather">' + f[2] + ' ' + escapeHTML(f[3]) + (t ? ' ' + t : '') + '</span> ';
}

// ---------- 내 일기만 보기 ----------
// 아이는 자기 글을 고칠 수 있게 됐는데, 여러 장 섞인 목록에서 자기 것을 찾아 내려가야 했다.
// 로그인한 아이에게만 칩 둘을 띄우고, 고른 쪽만 그린다. 부모는 어차피 다 자기 것이라 안 띄운다.
let composePad = null;        // 새 일기 칸의 그림판 (고치는 칸의 판은 각자 들고 있다)
let mineOnly = false;
const isMine = p => !!(me && me.user_id && p.written_by === me.user_id);
// 아이가 아니게 되면(로그아웃·부모 로그인) 고른 것이 저절로 풀린다 — 안 그러면
// 부모 화면이 「내 일기」에 갇힌 채로 남고 칩은 숨어서 되돌릴 길이 없다.
const mineView = () => mineOnly && isChild;
function shownPosts(){ return mineView() ? posts.filter(isMine) : posts; }

function photoPosts(){
  return shownPosts().filter(p => photosOf(p).length);
}

// 칩 둘. 그릴 때마다 다시 세는데, 글이 수십 장이라 세는 값이 싸다.
function syncFilter(){
  const bar = $('#postFilter');
  if (!bar) return;
  const n = posts.filter(isMine).length;
  if (!isChild || !n){ bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = '';
  [['전체 ' + posts.length, false], ['내 일기 ' + n, true]].forEach(pair => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot-btn small' + (mineOnly === pair[1] ? ' on' : '');
    b.textContent = pair[0];
    b.setAttribute('aria-pressed', String(mineOnly === pair[1]));
    b.addEventListener('click', () => {
      if (mineOnly === pair[1]) return;
      mineOnly = pair[1]; shownCount = PAGE; sfx('pop'); render();
      $('#posts').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    bar.appendChild(b);
  });
}

async function loadPosts(){
  // 비공개 글은 로그인한 사람에게만 보임 (서버 정책에서도 한 번 더 막혀 있음)
  // 최근 500개까지. 지금 글은 한 자리 수라 한참 남았지만, 상한이 없으면 표가 자라는 만큼
  // 매번 통째로 받는다. 500에 가까워지면 「더 보기」로 나눠 받게 바꿔야 한다.
  let q = sb.from('posts').select('*').order('created_at', {ascending:false}).limit(500);
  if (!isAdmin) q = q.eq('is_public', true);
  const { data, error } = await q;
  if (error) {
    $('#empty').style.display = 'block';
    $('#empty').textContent = '불러오기 실패: ' + error.message;
    return;
  }
  posts = data || [];
  render();
}

// 대표 사진 + 추가 사진을 한 줄로 이어 다룸.
// 목록에는 작은 사본을, 눌러서 크게 볼 때는 원본을 쓰므로 둘을 짝으로 들고 다닌다.
function photosOf(p){
  return (p.image_url ? [{ url: p.image_url, thumb: p.thumb_url || null }] : [])
    .concat((Array.isArray(p.extra_images) ? p.extra_images : [])
      .filter(x => x && x.url)
      .map(x => ({ url: x.url, thumb: x.thumb || null })));
}

/* 일기 카드는 사진까지 달려 크다. 포트폴리오와 같은 방식으로, 받아 둔 것 중
   앞에서부터 스무 개만 그리고 나머지는 「더보기」나 스크롤로 이어 붙인다. */
const PAGE = 20;
let shownCount = PAGE;

function render(){
  const list = $('#posts');
  const shown = shownPosts();
  list.innerHTML = '';
  $('#empty').style.display = shown.length ? 'none' : 'block';
  $('#empty').textContent = mineView() ? '아직 내가 쓴 일기가 없어요' : '아직 쓴 일기가 없어요';
  syncFilter();

  shown.slice(0, shownCount).forEach(p => {
    const el = document.createElement('article');
    el.className = 'post dot-card reveal';
    el.id = 'post-' + p.id;      // 작품에서 "그날의 일기"로 바로 건너올 수 있도록
    el.dataset.when = p.happened_on || p.created_at;   // 배경을 그날 계절로 갈아 끼우는 데 쓴다
    el.innerHTML =
      '<h2>' + escapeHTML(p.title) + '</h2>' +
      '<div class="meta">' +
        '<span class="tag ' + escapeHTML(p.author) + '">' + (AUTHORS[p.author] || '같이') + '</span> ' +
        (p.status === 'pending' ? '<span class="tag pending">⏳ 확인 기다림</span> ' : '') +
        weatherTag(p.weather) +
        (p.is_public === false ? '<span class="tag private">🔒 비공개</span> ' : '') +
        // 있었던 날이 적혀 있으면 그것을 보여준다. 쓴 날은 그 뒤에 작게.
        escapeHTML(formatDate(p.happened_on || p.created_at)) +
        (p.place ? ' · ' + escapeHTML(p.place) : '') +
        (p.happened_on && p.happened_on.slice(0,10) !== String(p.created_at).slice(0,10)
          ? '<span class="written">' + escapeHTML(formatDate(p.created_at)) + '에 씀</span>' : '') +
      '</div>' +
      // 일정표 커스텀 탭과 같은 서식으로 그린다 (제목·굵게·목록·표·사진)
      (p.body ? '<div class="body note-content">' + renderNoteContent(p.body) + '</div>' : '') +
      // 글씨보다 빠른 기록. 받아 두기만 하고 누를 때 내려받는다.
      (p.audio_url
        ? '<span class="voice-lab">🎙 목소리로 남긴 일기' +
          (p.audio_secs ? ' · ' + secsLabel(p.audio_secs) : '') + '</span>' +
          '<audio controls preload="none" src="' + escapeHTML(p.audio_url) + '"></audio>'
        : '') +
      // 화면 폭이 300px 남짓인데 원본은 3000px 이 넘는다. 사본이 있으면 그것만 받는다.
      // 크게 볼 때 쓸 원본 주소는 data-full 에 따로 달아 둔다.
      photosOf(p).map(ph => '<img class="post-img" src="' + escapeHTML(ph.thumb || ph.url) +
        '" data-full="' + escapeHTML(ph.url) +
        '" loading="lazy" alt="' + escapeHTML(p.title) + '">').join('');

    // 첨부 사진을 누르면 라이트박스로 크게 보기 (사진 있는 글끼리 앞뒤로 넘어감)
    // 사진을 누르면 라이트박스. 글 하나에 여러 장이면 그 안에서 넘어가고,
    // 모든 글의 사진을 한 줄로 이어 붙여 글과 글 사이도 넘어갈 수 있게 함.
    const all = [];
    photoPosts().forEach(x => photosOf(x).forEach(ph => all.push({
      media_url: ph.url, media_type: 'image',
      caption: x.title + ' · ' + formatDate(x.happened_on || x.created_at) +
        (x.place ? ' · ' + x.place : ''),
    })));
    el.querySelectorAll('.post-img').forEach(im => {
      im.addEventListener('click', () => {
        // src 는 사본일 수 있으므로 원본 주소로 찾는다
        const full = im.dataset.full || im.getAttribute('src');
        const at = all.findIndex(a => a.media_url === full);
        lightbox.open(all, Math.max(0, at));
      });
    });

    // 부모는 모든 글, 아이는 자기가 쓴 글에만 단추가 붙는다 (서버 정책도 같은 선이다)
    const mineToEdit = isChild && isMine(p);
    if (isAdmin || mineToEdit) {
      const actions = document.createElement('div');
      actions.className = 'actions';

      const edit = document.createElement('button');
      edit.className = 'dot-btn small';
      edit.textContent = '수정';
      edit.addEventListener('click', () => {
        el.innerHTML = '';
        const ef = renderEditForm(p);
        el.appendChild(ef);
        buildFormatBar(ef.querySelector('.eBody'), { fileInput: ef.querySelector('.eImage') });
      });

      const del = document.createElement('button');
      del.className = 'dot-btn small danger';
      del.textContent = '삭제';
      del.addEventListener('click', async () => {
        if (!confirm('"' + p.title + '" 일기를 삭제할까요?')) return;
        // 목소리도 같이 치운다 — 줄만 지우면 녹음 파일이 저장소에 그대로 남는다
        const files = photosOf(p).flatMap(ph => [ph.url, ph.thumb]).concat([p.audio_url]);
        const { error } = await sb.from('posts').delete().eq('id', p.id);
        if (error) { alert('삭제 실패: ' + error.message); return; }
        await removeStored(MEDIA_BUCKET, files);     // 줄만 지우면 사진은 저장소에 계속 남는다
        loadPosts();
      });

      if (p.audio_url) {
        const dv = document.createElement('button');
        dv.className = 'dot-btn small';
        dv.textContent = '🎙 목소리 지우기';
        dv.addEventListener('click', async () => {
          if (!confirm('이 일기의 목소리를 지울까요?')) return;
          const path = pathFromPublicUrl(MEDIA_BUCKET, p.audio_url);
          const { error } = await sb.from('posts')
            .update({ audio_url: null, audio_secs: null }).eq('id', p.id);
          if (error) { alert('지우지 못했어요: ' + error.message); return; }
          if (path) await sb.storage.from(MEDIA_BUCKET).remove([path]);
          loadPosts();
        });
        actions.appendChild(dv);
      }

      actions.appendChild(edit);
      actions.appendChild(del);
      el.appendChild(actions);
    }

    list.appendChild(el);
    revealNow(el);
  });

  syncMore();
}

// ---------- 더보기 ----------
function syncMore(){
  const box = $('#moreBox');
  if (!box) return;
  const 남음 = shownPosts().length - shownCount;
  box.hidden = 남음 <= 0;
  if (남음 > 0) $('#moreBtn').textContent = '더보기 (' + 남음 + '개 남음)';
}

function showMore(){
  if (shownPosts().length <= shownCount) return;
  shownCount += PAGE;
  render();
}

// 아래로 내려가면 저절로 이어 붙인다. 단추는 관찰자가 안 도는 자리를 위한 대비다.
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) showMore(); },
    { rootMargin: '600px 0px' });
  const box = document.getElementById('moreBox');
  if (box) io.observe(box);
}
const moreBtn = document.getElementById('moreBtn');
if (moreBtn) moreBtn.addEventListener('click', showMore);

// ---------- 목소리 일기 ----------
// 글씨를 쓰기 싫은 날에도 하루가 남게 하려는 것이다. 올리기를 누를 때까지는
// 이 브라우저 안에만 있고, 그때 한 번 저장소로 올라간다.
let vRec = null;      // 녹음 중인 기계
let vDraft = null;    // 방금 녹음한 것 { blob, secs, ext, url }

function dropVoiceDraft(){
  if (vDraft && vDraft.url) URL.revokeObjectURL(vDraft.url);
  vDraft = null;
}

function renderComposeVoice(){
  const box = $('#pVoice');
  if (!box) return;
  let html = '<div class="voice-box">';
  if (vDraft) {
    html += '<audio controls src="' + vDraft.url + '"></audio>' +
      '<p class="hintline">이대로 올리면 일기에 붙어요.</p>' +
      '<div class="row">' +
        '<button type="button" class="dot-btn small" id="vRedo">다시 녹음</button>' +
        '<button type="button" class="dot-btn small danger" id="vDrop">빼기</button>' +
      '</div>';
  } else if (vRec) {
    html += '<div class="row">' +
        '<span class="timer" id="vTimer"><span class="rec-dot"></span>0:00</span>' +
        '<button type="button" class="dot-btn small primary" id="vStop">■ 멈추기</button>' +
      '</div>' +
      '<p class="hintline">오늘 있었던 일을 그냥 말해 보세요.</p>';
  } else {
    html += '<div class="row"><button type="button" class="dot-btn small" id="vRec">🎙 녹음하기</button></div>' +
      '<p class="hintline">최대 ' + VOICE_MAX_SECS + '초까지 담겨요. 글씨 대신 말로 남겨도 돼요.</p>';
    if (!canRecordVoice()) {
      html += '<p class="hintline">이 브라우저에서는 녹음이 안 돼요. 크롬이나 사파리에서 열어주세요.</p>';
    }
  }
  html += '<div class="msg" id="vMsg"></div></div>';
  box.innerHTML = html;

  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  on('#vRec', async () => {
    const msg = $('#vMsg');
    if (!canRecordVoice()) { msg.className = 'msg err'; msg.textContent = '이 브라우저에서는 녹음이 안 돼요.'; return; }
    try {
      vRec = await startVoiceRecorder(secs => {
        const t = $('#vTimer');
        if (t) t.innerHTML = '<span class="rec-dot"></span>' + secsLabel(secs);
        if (secs >= VOICE_MAX_SECS) stopComposeVoice();   // 저절로 멈춘 뒤 화면도 맞춘다
      });
      renderComposeVoice();
    } catch (e) {
      msg.className = 'msg err';
      msg.textContent = /NotAllowed|Permission/i.test((e && e.name) + (e && e.message))
        ? '마이크를 쓸 수 없어요. 브라우저에서 이 사이트의 마이크 사용을 허용해 주세요.'
        : '녹음을 시작하지 못했어요: ' + ((e && e.message) || e);
    }
  });
  on('#vStop', stopComposeVoice);
  on('#vDrop', () => { dropVoiceDraft(); renderComposeVoice(); });
  on('#vRedo', () => { dropVoiceDraft(); renderComposeVoice(); const b = $('#vRec'); if (b) b.click(); });
}

async function stopComposeVoice(){
  if (!vRec) return;
  const rec = vRec; vRec = null;
  try {
    const { blob, secs } = await rec.stop();
    if (blob && blob.size) vDraft = { blob, secs, ext: rec.ext, url: URL.createObjectURL(blob) };
  } catch (e) { /* 아무것도 안 담겼으면 처음 화면으로 */ }
  renderComposeVoice();
}

// ---------- 그림 일기 ----------
// 사진이 없는 날의 자리. 도트 그림판(draw.html)과 같은 색으로 열여섯 칸을 칠해 한 장 붙인다.
// 올리기를 누를 때까지는 이 브라우저 안에만 있다 — 목소리와 같은 얼개다.
//
// 판은 한 화면에 여럿 뜬다 — 새로 쓰는 칸에 하나, 고치는 카드마다 하나. 그래서 상태를
// 모듈에 두지 않고 makePad 가 닫아 쥔다(예전엔 모듈에 뒀는데, 그러면 카드 둘을 같이
// 열었을 때 한쪽을 그리다 다른 쪽이 지워진다). 자리 이름도 id 가 아니라 class 다.
//
// 색표의 정본은 pixel.js 의 DRAW_PALETTE 다. 일기장은 pixel.js 를 안 싣기 때문에
// (그 한 벌이 gzip 18.6KB 다) 같은 값을 여기 둔다 — 색을 고칠 때는 두 곳을 같이 고친다.
const PAD_PALETTE = [
  '#2f2a24', '#6f6558', '#a2988a', '#ffffff',
  '#ff7f8a', '#ff9aa2', '#ffb7d5', '#c0392b',
  '#e8912f', '#ffd979', '#fff3a0', '#f7b733',
  '#6cc7b3', '#8fd9c8', '#6fb567', '#3f7d3c',
  '#8ec9ee', '#5aa9e6', '#2e3a54', '#b9a3d6',
  '#c79b6d', '#8a5f3a', '#fbdcc4', '#ffe0c4',
];
const PAD_N     = 16;        // 한 변의 칸 수
const PAD_BG    = '#fffaf2';
const PAD_EMPTY = -1;
const PAD_OUT   = 48;        // 내보낼 때 한 칸의 크기 → 768px 짜리 그림

// 칸 값을 글자 하나씩으로 적어 표에 담는다(posts.doodle) — 도트 그림판이 자기 그림을
// 담아 두는 방식과 같다. 이게 있어야 나중에 「다시 그리기」가 빈 판이 아니라 그린 것에서
// 시작한다. PNG 만 두면 색 번호를 되찾을 길이 없다.
const padEncode = list => list.map(c => c === PAD_EMPTY ? '.' : c.toString(36)).join('');
function padDecode(str){
  if (!str || str.length !== PAD_N * PAD_N) return null;
  return Array.from(str).map(ch => {
    if (ch === '.') return PAD_EMPTY;
    const v = parseInt(ch, 36);
    return (v >= 0 && v < PAD_PALETTE.length) ? v : PAD_EMPTY;
  });
}

// 격자선 없이 큼직하게 — 이대로 파일이 된다
function padToCanvas(list, px){
  const cv = document.createElement('canvas');
  cv.width = cv.height = PAD_N * px;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = PAD_BG; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < list.length; i++){
    if (list[i] === PAD_EMPTY) continue;
    g.fillStyle = PAD_PALETTE[list[i]] || PAD_BG;
    g.fillRect((i % PAD_N) * px, Math.floor(i / PAD_N) * px, px, px);
  }
  return cv;
}

async function uploadDoodle(blob){
  // 아이도 올릴 수 있는 자리다 (2026-09-07 에 suayona/posts/ 를 가족에게 열었다).
  const path = 'suayona/posts/doodle-' + Date.now() + '-' +
    Math.random().toString(36).slice(2, 8) + '.png';
  const file = new File([blob], path.split('/').pop(), { type: 'image/png' });
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) throw new Error('그림 올리기 실패: ' + error.message);
  return sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// 그림판 하나를 box 안에 만든다.
//   seed  — 이미 그려 둔 칸들(없으면 null). 있으면 그것부터 보여 주고, 다시 그리기도 여기서 시작한다.
//   hint  — 판이 닫혀 있을 때 밑에 적을 한 줄
// 그린 결과는 pad.draft({ blob, url }) 와 pad.cells(글자로 적은 칸들) 로 꺼내 간다.
function makePad(box, seed, hint){
  if (!box) return null;
  const pad = { draft: null, cells: null };
  let cells = null;                                  // 그리는 중일 때의 칸들
  let last = seed ? seed.slice() : null;             // 판을 다시 열 때 채울 것
  let color = 4, hist = [];

  const q = sel => box.querySelector(sel);
  const blank = () => new Array(PAD_N * PAD_N).fill(PAD_EMPTY);

  function dropDraft(){
    if (pad.draft && pad.draft.url) URL.revokeObjectURL(pad.draft.url);
    pad.draft = null; pad.cells = null;
  }

  // 그리는 중인 판 (격자선이 있다)
  function paint(){
    const cv = q('.padCanvas');
    if (!cv || !cells) return;
    const g = cv.getContext('2d'), c = cv.width / PAD_N;
    g.imageSmoothingEnabled = false;
    g.fillStyle = PAD_BG; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < cells.length; i++){
      if (cells[i] === PAD_EMPTY) continue;
      g.fillStyle = PAD_PALETTE[cells[i]] || PAD_BG;
      g.fillRect((i % PAD_N) * c, Math.floor(i / PAD_N) * c, c, c);
    }
    g.fillStyle = 'rgba(47,42,36,0.16)';
    for (let i = 1; i < PAD_N; i++){
      g.fillRect(Math.round(i * c), 0, 1, cv.height);
      g.fillRect(0, Math.round(i * c), cv.width, 1);
    }
  }

  function render(){
    let html = '<div class="pad-box">';
    if (cells) {
      html += '<canvas class="padCanvas" width="256" height="256" role="img" aria-label="도트 그림판"></canvas>' +
        '<div class="pad-colors padColors"></div>' +
        '<div class="row">' +
          '<button type="button" class="dot-btn small padUndo">되돌리기</button>' +
          '<button type="button" class="dot-btn small padClear">다 지우기</button>' +
          '<button type="button" class="dot-btn small primary padDone">이 그림 붙이기</button>' +
          '<button type="button" class="dot-btn small padCancel">그만두기</button>' +
        '</div>' +
        '<p class="hintline">칸을 눌러 칠해요. 맨 끝의 빗금 칸이 지우개예요.</p>';
    } else if (pad.draft) {
      html += '<img class="pad-prev" src="' + pad.draft.url + '" alt="그린 그림">' +
        '<p class="hintline">이대로 올리면 일기에 붙어요.</p>' +
        '<div class="row">' +
          '<button type="button" class="dot-btn small padOpen">다시 그리기</button>' +
          '<button type="button" class="dot-btn small danger padDrop">빼기</button>' +
        '</div>';
    } else if (last) {
      // 이미 붙어 있는 그림. 그린 칸들이 남아 있어서 그때 그 그림에서 이어 그린다.
      html += '<img class="pad-prev" src="' + padToCanvas(last, 24).toDataURL('image/png') + '" alt="붙어 있는 그림">' +
        '<div class="row"><button type="button" class="dot-btn small padOpen">🎨 다시 그리기</button></div>' +
        '<p class="hintline">' + escapeHTML(hint || '고치면 일기의 그림도 바뀌어요.') + '</p>';
    } else {
      html += '<div class="row"><button type="button" class="dot-btn small padOpen">🎨 그림 그리기</button></div>' +
        '<p class="hintline">' + escapeHTML(hint || '사진이 없는 날엔 그려서 남겨요.') + '</p>';
    }
    box.innerHTML = html + '</div>';

    const on = (sel, fn) => { const el = q(sel); if (el) el.addEventListener('click', fn); };
    on('.padOpen', () => { cells = last ? last.slice() : blank(); hist = []; render(); });
    on('.padCancel', () => { cells = null; render(); });
    on('.padDrop', () => { dropDraft(); last = seed ? seed.slice() : null; render(); });
    on('.padClear', () => { hist.push(cells.slice()); cells.fill(PAD_EMPTY); paint(); });
    on('.padUndo', () => { if (hist.length){ cells = hist.pop(); paint(); } });
    on('.padDone', async () => {
      if (!cells.some(c => c !== PAD_EMPTY)) { cells = null; render(); return; }   // 빈 판은 안 붙인다
      const blob = await new Promise(r => padToCanvas(cells, PAD_OUT).toBlob(r, 'image/png'));
      if (!blob) return;
      dropDraft();
      last = cells.slice();
      pad.cells = padEncode(cells);
      pad.draft = { blob: blob, url: URL.createObjectURL(blob) };
      cells = null;
      sfx('sparkle');
      render();
    });

    if (!cells) return;

    // 색 고르기 — 스물넷에 지우개 하나
    const cols = q('.padColors');
    PAD_PALETTE.concat([null]).forEach((hex, i) => {
      const v = hex === null ? PAD_EMPTY : i;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = (color === v ? 'on' : '') + (hex === null ? ' eraser' : '');
      b.style.background = hex || '';
      b.title = hex === null ? '지우개' : hex;
      b.setAttribute('aria-label', hex === null ? '지우개' : '색 ' + (i + 1));
      b.addEventListener('click', () => { color = v; render(); });
      cols.appendChild(b);
    });

    // 그리기 — 누른 채 끌면 이어서 칠한다
    const cv = q('.padCanvas');
    paint();
    let painting = false, lastCell = -1;
    const cellAt = e => {
      const r = cv.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * PAD_N);
      const y = Math.floor((e.clientY - r.top) / r.height * PAD_N);
      return (x < 0 || y < 0 || x >= PAD_N || y >= PAD_N) ? -1 : y * PAD_N + x;
    };
    const put = i => {
      if (i < 0 || i === lastCell || cells[i] === color) { lastCell = i; return; }
      lastCell = i; cells[i] = color; paint();
    };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      hist.push(cells.slice());
      if (hist.length > 40) hist.shift();
      painting = true; lastCell = -1;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 붙잡기는 덤이다 */ }
      put(cellAt(e));
    });
    cv.addEventListener('pointermove', e => { if (painting) put(cellAt(e)); });
    const stop = () => { painting = false; lastCell = -1; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);
  }

  pad.render = render;
  pad.drop = dropDraft;
  render();
  return pad;
}

// ---------- 기존 일기 수정 ----------
function renderEditForm(p){
  const form = document.createElement('div');
  form.className = 'edit-form';
  const sel = (v, cur) => v === cur ? ' selected' : '';
  const canPad = !p.image_url || !!p.doodle;
  form.innerHTML =
    // 아이는 글쓰기 칸에서와 같이 이름과 공개 여부를 못 고른다 — 서버도 막으므로
    // 화면에서 미리 감춰야 저장을 눌렀다가 거절당하는 일이 없다. 값은 그대로 들고 간다.
    (isAdmin
      ? '<label class="field">누가 쓰나요</label>' +
        '<select class="eAuthor" aria-label="누가 쓰나요">' +
          '<option value="sua"' + sel('sua', p.author) + '>수아</option>' +
          '<option value="yona"' + sel('yona', p.author) + '>연아</option>' +
          '<option value="together"' + sel('together', p.author) + '>같이</option>' +
        '</select>' +
        '<label class="field">공개 설정</label>' +
        '<select class="ePublic" aria-label="공개 설정">' +
          '<option value="true"' + (p.is_public !== false ? ' selected' : '') + '>🌏 공개 — 누구나 볼 수 있어요</option>' +
          '<option value="false"' + (p.is_public === false ? ' selected' : '') + '>🔒 비공개 — 로그인해야 볼 수 있어요</option>' +
        '</select>'
      : '<input type="hidden" class="eAuthor" value="' + escapeHTML(p.author) + '">' +
        '<input type="hidden" class="ePublic" value="' + (p.is_public === false ? 'false' : 'true') + '">') +
    '<label class="field">제목</label><input type="text" class="eTitle" value="' + escapeHTML(p.title) + '">' +
    '<div class="row2">' +
      '<div><label class="field">있었던 날</label><input type="date" class="eWhen" value="' +
        escapeHTML(p.happened_on || '') + '"></div>' +
      '<div><label class="field">장소</label><input type="text" class="ePlace" value="' +
        escapeHTML(p.place || '') + '"></div>' +
    '</div>' +
    '<label class="field">내용</label><textarea class="eBody">' + escapeHTML(p.body || '') + '</textarea>' +
    '<label class="field">사진</label>' +
    (p.image_url ? '<img class="post-img" style="margin:0 0 8px; cursor:default;" alt="' + escapeHTML(p.title || '일기 사진') + '" src="' + escapeHTML(p.image_url) + '">' : '') +
    '<input type="file" class="eImage" accept="image/*">' +
    (p.image_url
      ? '<label style="display:flex; align-items:center; gap:7px; font-size:12.5px; margin-top:8px; color:var(--ink-soft);">' +
          '<input type="checkbox" class="eRemoveImg" style="width:auto;">사진 삭제</label>'
      : '') +
    // 그림판은 「그림 일기였거나, 아직 아무 사진도 없는 글」에만 연다. 사진이 붙은 글에
    // 판까지 열어 두면, 그리는 순간 그 사진이 조용히 밀려난다.
    (canPad ? '<label class="field">그림</label><div class="ePad"></div>' : '') +
    '<div class="actions" style="margin-top:16px;">' +
      '<button class="dot-btn small primary eSave">저장</button>' +
      '<button class="dot-btn small eCancel">취소</button>' +
    '</div>' +
    '<div class="msg eMsg"></div>';

  // 그린 칸들이 표에 남아 있어서, 다시 그리기가 빈 판이 아니라 그때 그 그림에서 시작한다.
  const editPad = makePad(form.querySelector('.ePad'), padDecode(p.doodle),
    p.doodle ? '고치면 일기의 그림도 바뀌어요.' : '그리면 일기에 그림이 붙어요.');

  form.querySelector('.eCancel').addEventListener('click', () => render());

  form.querySelector('.eSave').addEventListener('click', async () => {
    const btn = form.querySelector('.eSave'), msg = form.querySelector('.eMsg');
    const title = form.querySelector('.eTitle').value.trim();
    if (!title) { msg.className = 'msg err'; msg.textContent = '제목을 입력해주세요.'; return; }

    btn.disabled = true;
    msg.className = 'msg'; msg.textContent = '저장 중...';

    let image_url = p.image_url || null, thumb_url = p.thumb_url || null;
    let doodle = p.doodle || null;
    const file = form.querySelector('.eImage').files[0];
    const removeImg = form.querySelector('.eRemoveImg');
    const dropped = [];                       // 저장이 끝난 뒤 저장소에서 치울 것들
    try {
      if (file) {
        msg.textContent = '사진 올리는 중...';
        const up = await uploadMedia(file, 'posts', null, { capDim: PHOTO_CAP_DIM });
        dropped.push(image_url, thumb_url);    // 갈아치운 옛 사진은 남길 이유가 없다
        image_url = up.url; thumb_url = up.thumbUrl || null;
      } else if (removeImg && removeImg.checked) {
        dropped.push(image_url, thumb_url);
        image_url = null; thumb_url = null; doodle = null;   // 그림도 같이 뗀다
      }
      if (editPad && editPad.draft) {
        msg.textContent = '그림 올리는 중...';
        const url = await uploadDoodle(editPad.draft.blob);
        dropped.push(image_url, thumb_url);      // 갈아치운 옛 그림(또는 사진)은 남길 이유가 없다
        image_url = url; thumb_url = null; doodle = editPad.cells;
      }
      const day = form.querySelector('.eWhen').value || null;
      let weather = p.weather || null;
      if (!weather || day !== (p.happened_on || null)) weather = await weatherOn(day || todayISO());
      const { error } = await sb.from('posts').update({
        author: form.querySelector('.eAuthor').value,
        is_public: form.querySelector('.ePublic').value === 'true',
        title,
        body: form.querySelector('.eBody').value.trim() || null,
        happened_on: day,
        weather, doodle,
        place: form.querySelector('.ePlace').value.trim() || null,
        image_url, thumb_url,
      }).eq('id', p.id);
      if (error) throw error;
      // 줄이 제대로 바뀐 뒤에 옛 파일을 치운다 — 실패하면 파일만 남고 화면은 멀쩡하다
      if (dropped.length) await removeStored(MEDIA_BUCKET, dropped);
    } catch (e) {
      msg.className = 'msg err'; msg.textContent = '실패: ' + ((e && e.message) || e);
      btn.disabled = false;
      return;
    }
    loadPosts();
  });

  return form;
}

// 확인을 기다리는 글은 여기 모인다. 부모가 보고 공개하거나 지운다.
// 아이가 손으로 쓴 일기는 이제 바로 실리므로, 여기 오는 것은 모험 일지처럼
// 저절로 만들어진 초안과 예전에 올려 둔 글뿐이다.
function renderPendingBox(area){
  const waiting = posts.filter(p => p.status === 'pending');
  if (!waiting.length) return;

  const box = document.createElement('div');
  box.className = 'pending-box dot-card';
  box.innerHTML = '<div class="inner"><h3>⏳ 확인을 기다리는 초안 ' + waiting.length + '편</h3>' +
    '<p class="pending-hint">모험 일지처럼 저절로 남은 초안이에요. 공개하기를 누르기 전에는 다른 사람에게 보이지 않아요.</p></div>';
  const inner = box.querySelector('.inner');

  waiting.forEach(p => {
    const row = document.createElement('div');
    row.className = 'pending-row';
    row.innerHTML =
      '<div class="pr-main">' +
        '<b>' + escapeHTML(p.title) + '</b>' +
        '<span class="pr-meta">' + escapeHTML(AUTHORS[p.author] || p.author) + ' · ' +
          escapeHTML(formatDate(p.happened_on || p.created_at)) + '</span>' +
        (p.body ? '<span class="pr-body">' + escapeHTML(p.body.slice(0, 70)) +
          (p.body.length > 70 ? '…' : '') + '</span>' : '') +
      '</div>';
    const ok = document.createElement('button');
    ok.className = 'dot-btn small mint';
    ok.textContent = '공개하기';
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      const { error } = await sb.from('posts').update({ status: 'published' }).eq('id', p.id);
      if (error) { alert('실패: ' + error.message); ok.disabled = false; return; }
      await loadPosts();
      renderAdminArea();
    });
    const no = document.createElement('button');
    no.className = 'dot-btn small danger';
    no.textContent = '지우기';
    no.addEventListener('click', async () => {
      if (!confirm('이 글을 지울까요? 되돌릴 수 없어요.')) return;
      const files = photosOf(p).flatMap(ph => [ph.url, ph.thumb]);
      const { error } = await sb.from('posts').delete().eq('id', p.id);
      if (error) { alert('실패: ' + error.message); return; }
      await removeStored(MEDIA_BUCKET, files);
      await loadPosts();
      renderAdminArea();
    });
    const acts = document.createElement('div');
    acts.className = 'pr-acts';
    acts.appendChild(ok); acts.appendChild(no);
    row.appendChild(acts);
    inner.appendChild(row);
  });
  area.appendChild(box);
}

function renderAdminArea(){
  const area = $('#adminArea');
  area.innerHTML = '';

  if (!isAdmin && !isChild) {
    const box = document.createElement('div');
    box.style.textAlign = 'center';
    box.style.marginBottom = '26px';
    const btn = document.createElement('button');
    btn.className = 'dot-btn small';
    btn.textContent = '✏️ 일기 쓰기 (수아 · 연아 · 부모)';
    btn.addEventListener('click', openAuthModal);   // 로그인 창은 헤더 것 하나만 쓴다
    box.appendChild(btn);
    area.appendChild(box);
    render();
    return;
  }

  if (isAdmin) renderPendingBox(area);

  const box = document.createElement('div');
  box.className = 'write-box dot-card';
  box.innerHTML =
    '<div class="inner">' +
      '<h3>✏️ 새 일기 쓰기</h3>' +
      // 아이는 자기 이름으로만 쓸 수 있고 공개 여부도 정하지 못한다 (규칙이 서버에서도 막힘).
      // 화면에서 미리 감춰야 눌렀다가 거절당하는 일이 없다.
      // 부모 확인은 없앴다 — 올리면 그 자리에서 일기장에 실린다.
      (isChild
        ? '<div class="child-note">' + escapeHTML(me.display) +
          (typeof josa === 'function' ? josa(me.display, '이', '가') : '이(가)') + ' 쓰는 일기예요.<br>' +
          '올리면 <b>바로</b> 일기장에 실려요. 잘못 쓴 건 <b>수정</b>이나 <b>삭제</b>로 고쳐요.</div>' +
          '<input type="hidden" id="pAuthor" value="' + escapeHTML(me.author_key || 'sua') + '">' +
          '<input type="hidden" id="pPublic" value="true">'
        : '<label class="field">누가 쓰나요</label>' +
          '<select id="pAuthor" aria-label="누가 쓰나요"><option value="sua">수아</option><option value="yona">연아</option><option value="together">같이</option></select>' +
          '<label class="field">공개 설정</label>' +
          '<select id="pPublic" aria-label="공개 설정">' +
            '<option value="true">🌏 공개 — 누구나 볼 수 있어요</option>' +
            '<option value="false">🔒 비공개 — 로그인해야 볼 수 있어요</option>' +
          '</select>') +
      // 「거꾸로 일기」 — 무엇을 쓸지 막막할 때, 옛날 사진을 먼저 한 장 뽑아 주고
      // 그날 이야기를 적게 한다. 날짜와 장소는 사진에 박혀 있는 것을 그대로 채워 준다.
      '<button type="button" class="dot-btn small lemon" id="pBack" style="margin-bottom:14px;">🎲 옛날 사진으로 시작하기</button>' +
      '<div class="back-photo" id="pBackBox" hidden></div>' +
      '<label class="field">제목</label><input type="text" id="pTitle" placeholder="예: 오늘 학교에서">' +
      '<div class="row2">' +
        '<div><label class="field">있었던 날 (비우면 사진에서)</label><input type="date" id="pWhen"></div>' +
        '<div><label class="field">장소 (선택)</label><input type="text" id="pPlace" placeholder="예: 홍천밭"></div>' +
      '</div>' +
      '<label class="field">내용</label><textarea id="pBody" placeholder="자유롭게 적어보세요"></textarea>' +
      '<label class="field">목소리 (선택)</label><div id="pVoice"></div>' +
      '<label class="field">그림 (선택)</label><div id="pDoodle"></div>' +
      '<label class="field">사진 (선택 · 여러 장 가능)</label><input type="file" id="pImage" accept="image/*" multiple>' +
      '<button class="dot-btn primary" id="pSave" style="width:100%; margin-top:18px;">올리기</button>' +
      '<div class="msg" id="pMsg"></div>' +
    '</div>';
  area.appendChild(box);

  // 글쓰기 칸에 서식 도구막대 (일정표 커스텀 탭과 같은 것)
  buildFormatBar($('#pBody'), { fileInput: $('#pImage') });
  renderComposeVoice();
  composePad = makePad($('#pDoodle'), null, '사진이 없는 날엔 그려서 남겨요. 그린 그림이 일기의 첫 장이 돼요.');

  // ---------- 거꾸로 일기 ----------
  // 사진을 먼저 보여 주고 그날 이야기를 끌어낸다. 한 장을 고르자고 목록을
  // 전부 받아 오지 않는다 — 총 장수만 받아서 그 안에서 자리를 하나 뽑는다.
  const backBtn = $('#pBack'), backBox = $('#pBackBox');
  if (backBtn) backBtn.addEventListener('click', async () => {
    backBtn.disabled = true;
    try {
      const { data: c } = await sb.rpc('home_counts');
      const total = (Array.isArray(c) ? c[0] : c || {}).gallery_images || 0;
      if (!total) { alert('아직 사진이 없어요.'); return; }
      const at = Math.floor(Math.random() * total);
      const { data } = await sb.from('gallery_media')
        .select('media_url, thumb_url, taken_at, location_name, event_id')
        .eq('media_type', 'image').order('id').range(at, at);
      const ph = data && data[0];
      if (!ph) { alert('사진을 못 찾았어요. 다시 눌러 보세요.'); return; }

      backBox.hidden = false;
      backBox.innerHTML =
        '<img src="' + escapeHTML(ph.thumb_url || ph.media_url) + '" loading="lazy" decoding="async" alt="옛날 사진">' +
        '<p>' + escapeHTML([
          ph.taken_at ? new Date(ph.taken_at).toLocaleDateString('ko-KR') : '',
          ph.location_name || '',
        ].filter(Boolean).join(' · ') || '이날은 언제였을까?') + '</p>' +
        '<p class="ask">이 사진을 보고 그날 이야기를 적어 볼까요?</p>' +
        '<button type="button" class="dot-btn small" id="pBackOff">사진 빼기</button>';

      // 날짜와 장소는 사진에 있는 것을 채워 준다. 이미 적어 둔 것은 건드리지 않는다.
      // 무엇을 우리가 채웠는지 적어 둬야, 사진을 뺄 때 그것만 되돌릴 수 있다.
      const filled = { when: false, place: false };
      if (ph.taken_at && !$('#pWhen').value) { $('#pWhen').value = ph.taken_at.slice(0, 10); filled.when = true; }
      if (ph.location_name && !$('#pPlace').value) { $('#pPlace').value = ph.location_name; filled.place = true; }
      // 뽑힌 사진이 마음에 안 들면 뺀다. 사진이 채워 준 날짜·장소도 같이 비운다 —
      // 아이가 직접 적은 것은 그대로 둔다.
      $('#pBackOff').addEventListener('click', () => {
        backBox.hidden = true; backBox.innerHTML = '';
        if (filled.when)  $('#pWhen').value = '';
        if (filled.place) $('#pPlace').value = '';
        sfx('prop');
      });
      sfx('pop');
      backBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally { backBtn.disabled = false; }
  });

  $('#pSave').addEventListener('click', async () => {
    const msg = $('#pMsg'), btn = $('#pSave');
    msg.className = 'msg'; msg.textContent = '';
    const title = $('#pTitle').value.trim();
    if (!title) { msg.className = 'msg err'; msg.textContent = '제목을 입력해주세요.'; return; }

    btn.disabled = true;
    const files = Array.from($('#pImage').files);
    let image_url = null, thumb_url = null, extra_images = [], happened_on = $('#pWhen').value || null;
    let doodle = null;                        // 그린 칸들 — 나중에 다시 그릴 때 쓴다
    let audio_url = null, audio_secs = null;
    try {
      if (vDraft) {
        msg.textContent = '목소리 올리는 중...';
        audio_url = await uploadVoice(vDraft.blob, vDraft.ext);
        audio_secs = vDraft.secs;
      }
      if (composePad && composePad.draft) {
        // 그린 그림은 사본을 안 만든다 — 768px 짜리 도트라 원본이 이미 작고,
        // JPEG 사본으로 줄이면 칸 경계가 뭉개진다. 그림이 있으면 그것이 일기의 첫 장이다.
        msg.textContent = '그림 올리는 중...';
        image_url = await uploadDoodle(composePad.draft.blob);
        doodle = composePad.cells;
      }
      for (let i = 0; i < files.length; i++) {
        msg.textContent = '사진 올리는 중... (' + (i+1) + '/' + files.length + ') ' + files[i].name;
        // 있었던 날을 비웠으면 첫 사진의 촬영 날짜를 쓴다 — 지난 일을 나중에 적어도 날짜가 맞게
        if (!happened_on && i === 0) happened_on = await exifDate(files[i]);
        const up = await uploadMedia(files[i], 'posts', null, { capDim: PHOTO_CAP_DIM });
        if (i === 0 && !image_url) { image_url = up.url; thumb_url = up.thumbUrl || null; }
        else extra_images.push({ url: up.url, thumb: up.thumbUrl || null });
      }
      msg.textContent = '날씨 보는 중...';
      const weather = await weatherOn(happened_on || todayISO());
      msg.textContent = '저장 중...';
      const { data: { session } } = await sb.auth.getSession();
      const { error } = await sb.from('posts').insert({
        author: $('#pAuthor').value,
        is_public: $('#pPublic').value === 'true',
        status: 'published',   // 아이가 쓴 것도 바로 실린다 (서버 정책도 2026-09-07 에 같이 열었다)
        written_by: session ? session.user.id : null,
        title,
        body: $('#pBody').value.trim() || null,
        image_url, thumb_url, extra_images,
        audio_url, audio_secs, doodle,
        happened_on,
        weather,
        place: $('#pPlace').value.trim() || null,
      });
      if (error) throw error;
    } catch (e) {
      msg.className = 'msg err'; msg.textContent = '실패: ' + ((e && e.message) || e);
      btn.disabled = false;
      return;
    }

    btn.disabled = false;
    msg.className = 'msg ok';
    msg.textContent = '올렸어요!';
    $('#pTitle').value = ''; $('#pBody').value = ''; $('#pImage').value = '';
    $('#pWhen').value = ''; $('#pPlace').value = '';
    dropVoiceDraft(); renderComposeVoice();
    if (composePad) composePad.drop();
    composePad = makePad($('#pDoodle'), null, '사진이 없는 날엔 그려서 남겨요. 그린 그림이 일기의 첫 장이 돼요.');
    loadPosts();
  });

  render();
}

// 주소에 #post-12 가 붙어 오면 그 글로 데려간다.
// 글은 나중에 그려지므로 브라우저가 알아서 못 찾는다 — 다 그린 뒤에 직접 옮긴다.
function jumpToHash(){
  const id = (location.hash || '').match(/^#post-(\d+)$/);
  // 페이지를 나눠 그리므로 찾는 글이 아직 안 그려졌을 수 있다. 그 글이 나올 때까지 늘린다.
  if (id) {
    const at = posts.findIndex(p => String(p.id) === id[1]);
    if (at >= shownCount) { shownCount = at + 1; render(); }
  }
  const el = id && document.getElementById('post-' + id[1]);
  if (!el) return;
  el.classList.add('jumped');
  requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

// 배경을 「지금 읽고 있는 일기의 그 계절, 그 시각」으로 갈아 끼운다.
// 화면 한가운데에 가장 가까운 글을 지금 읽는 글로 본다 — 스크롤하면 언덕 색이 따라 바뀐다.
// 배경 겹이 없거나(구형) 움직임을 줄여 달라고 한 사람에게는 그냥 안 건다.
function followSeason(){
  if (typeof repaintBackdrop !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const 글들 = () => Array.from(document.querySelectorAll('.post[data-when]'));
  let 대기 = false;
  const 고르기 = () => {
    대기 = false;
    const mid = innerHeight / 2;
    let 가까운 = null, 거리 = Infinity;
    for (const el of 글들()){
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;      // 화면 밖은 안 본다
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < 거리) { 거리 = d; 가까운 = el; }
    }
    repaintBackdrop(가까운 ? 가까운.dataset.when : null);
  };
  addEventListener('scroll', () => {
    if (대기) return;
    대기 = true;
    requestAnimationFrame(고르기);
  }, { passive: true });
  고르기();
}

(async () => {
  await refreshAuth();
  await loadPosts();
  renderAdminArea();
  initReveal();
  jumpToHash();
  followSeason();
})();
window.addEventListener('hashchange', jumpToHash);
