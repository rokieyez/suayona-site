// portfolio.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('portfolio');
buildBackdrop('portfolio');   // 배경 픽셀 겹 (common.js)

const AUTHORS = { sua:'수아', yona:'연아', together:'같이' };
let works = [], filter = 'all', yearFilter = 'all';
const lightbox = createLightbox();

// ---------- 목록 ----------
async function loadWorks(){
  // 카드에 보이는 날짜(made_on) 기준 내림차순 — 최근 것이 위, 오래된 것이 아래.
  // 내림차순 정렬은 NULL 을 먼저 놓는 게 기본이라, 날짜를 안 적은 작품이 맨 위로
  // 올라와 버림. nullsFirst:false 로 뒤로 보내고 올린 순서로 이어 붙임.
  const { data, error } = await sb.from('works').select('*')
    .order('made_on', {ascending:false, nullsFirst:false})
    .order('created_at', {ascending:false});
  if (error) {
    $('#empty').style.display = 'block';
    $('#empty').textContent = '불러오기 실패: ' + error.message;
    return;
  }
  works = data || [];
  // 유튜브 작품이 하나도 없으면 「▶ 영상」 거르개는 숨긴다 —
  // 연도가 한 해뿐이면 연도 단추가 숨는 것과 같은 규칙.
  const ytBtn = document.querySelector('#filters [data-filter="youtube"]');
  if (ytBtn) ytBtn.hidden = !works.some(w => w.media_type === 'youtube');
  buildYearFilter();
  render();
}

function visible(){
  // 「영상」만 작가가 아니라 종류로 거른다 — 누구 작품인지와는 다른 축이라
  // 같은 줄에 섞여 있어도 서로 부딪히지 않는다(하나만 켜지므로).
  // 아이가 낸 뒤 아직 안 올린 것(pending)은 전시실에 섞지 않는다 — 아래 승인 칸에만 나온다.
  return works.filter(w =>
    w.status !== 'pending' &&
    (filter === 'all' ||
     (filter === 'youtube' ? w.media_type === 'youtube' : w.author === filter)) &&
    (yearFilter === 'all' || (w.made_on && w.made_on.slice(0,4) === yearFilter)));
}

function render(){
  const grid = $('#grid');
  const list = visible();
  grid.innerHTML = '';
  $('#empty').style.display = list.length ? 'none' : 'block';

  list.forEach((w, i) => {
    const card = document.createElement('div');
    card.className = 'gal-item dot-card hoverable reveal';
    const ytId = w.media_type === 'youtube' ? youtubeId(w.media_url) : '';
    const media = ytId
      ? youtubeThumbHTML(ytId, w.title, '', '(max-width:560px) calc(50vw - 57px), 230px') + '<span class="yt-mark">▶ 영상</span><span class="yt-play sm"></span>'
      : w.media_type === 'video'
      ? '<video src="' + escapeHTML(w.media_url) + '" preload="metadata" muted></video>'
      // 격자 칸은 264px 인데 원본은 1800px 이 넘는다. 사본이 있으면 그것만 받는다.
      : '<img src="' + escapeHTML(w.thumb_url || w.media_url) + '" loading="lazy" alt="' + escapeHTML(w.title) + '">';
    // 적어둔 이야기를 목록에서도 보여준다 — 예전에는 사진을 눌러야만 한 줄로 보였다.
    const story = w.quote
      ? '<div class="gal-quote">\u201C' + escapeHTML(w.quote) + '\u201D</div>'
      : (w.description ? '<div class="gal-note">' + escapeHTML(w.description) + '</div>' : '');
    card.innerHTML =
      '<div class="gal-thumb">' + media +
        (w.audio_url ? '<span class="has-voice" title="목소리가 담겨 있어요">🔊</span>' : '') +
        (w.is_public === false ? '<span class="gal-lock" title="비공개 — 가족만 볼 수 있어요">🔒</span>' : '') +
      '</div>' +
      '<div class="gal-cap">' + escapeHTML(w.title) + '</div>' +
      story +
      '<div class="gal-sub">' +
        '<span class="tag ' + escapeHTML(w.author) + '">' + (AUTHORS[w.author] || '같이') + '</span>' +
        (w.made_on ? escapeHTML(formatDate(w.made_on)) : '') +
      '</div>';

    card.addEventListener('click', () => openWork(list, i));

    if (isAdmin) {
      const edit = document.createElement('button');
      edit.className = 'gal-edit';
      edit.textContent = '✎';
      edit.title = '수정';
      edit.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(w); });
      card.appendChild(edit);

      const del = document.createElement('button');
      del.className = 'gal-del';
      del.textContent = '✕';
      del.title = '삭제';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('"' + w.title + '" 작품을 삭제할까요?')) return;
        const files = [w.media_url, w.thumb_url, w.audio_url];
        const { error } = await sb.from('works').delete().eq('id', w.id);
        if (error) { alert('삭제 실패: ' + error.message); return; }
        // 줄만 지우면 사진·사본·목소리 파일이 저장소에 그대로 남는다
        await removeStored(MEDIA_BUCKET, files);
        loadWorks();
      });
      card.appendChild(del);
    }

    grid.appendChild(card);
    revealNow(card);
  });
}

// ---------- 작품 수정 팝업 ----------
function openEditModal(w){
  const sel = (v, cur) => v === cur ? ' selected' : '';
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.innerHTML =
    '<div class="modal-box dot-card"><div class="inner">' +
      '<h3>✎ 작품 수정</h3>' +
      (w.media_type === 'youtube'
        ? '<div class="preview yt-prev">' + youtubeThumbHTML(youtubeId(w.media_url), w.title, '', '(max-width:520px) 92vw, 420px') + '</div>'
        : w.media_type === 'video'
        ? '<video class="preview" src="' + escapeHTML(w.media_url) + '" controls playsinline></video>'
        : '<img class="preview" src="' + escapeHTML(w.media_url) + '" alt="">') +
      // 주소를 잘못 붙여넣었을 때 지웠다 다시 넣지 않아도 되게. 영상일 때만 나온다.
      (w.media_type === 'youtube'
        ? '<label class="field">유튜브 주소</label>' +
          '<input type="text" class="eYoutube" aria-label="유튜브 주소" value="' + escapeHTML(w.media_url) + '">'
        : '') +
      '<label class="field">제목</label>' +
      '<input type="text" class="eTitle" aria-label="제목" value="' + escapeHTML(w.title) + '">' +
      '<label class="field">아이가 한 말 (선택)</label>' +
      '<textarea class="eQuote" aria-label="아이가 한 말" style="min-height:60px;">' + escapeHTML(w.quote || '') + '</textarea>' +
      '<label class="field">메모 (선택)</label>' +
      '<textarea class="eDesc" aria-label="메모" style="min-height:60px;">' + escapeHTML(w.description || '') + '</textarea>' +
      '<div class="row2">' +
        '<div><label class="field">누구 작품</label>' +
          '<select class="eAuthor" aria-label="누구 작품">' +
            '<option value="sua"' + sel('sua', w.author) + '>수아</option>' +
            '<option value="yona"' + sel('yona', w.author) + '>연아</option>' +
            '<option value="together"' + sel('together', w.author) + '>같이</option>' +
          '</select></div>' +
        '<div><label class="field">만든 날 (선택)</label>' +
          '<input type="date" class="eDate" aria-label="만든 날" value="' + escapeHTML(w.made_on || '') + '"></div>' +
      '</div>' +
      // 작품마다 소리를 하나씩. 전시실에서 그림을 열면 그 소리가 난다 —
      // 아이가 「이 그림은 이런 소리야」 를 정하는 자리다.
      '<label class="field">이 작품의 소리 (선택)</label>' +
      '<div class="row2">' +
        '<select class="eSfx" aria-label="이 작품의 소리">' +
          '<option value="">소리 없음</option>' +
          Object.keys(WORK_SFX).map(k =>
            '<option value="' + k + '"' + sel(k, w.sfx) + '>' + WORK_SFX[k].label + '</option>').join('') +
        '</select>' +
        '<button type="button" class="dot-btn eSfxTry">▶ 들어보기</button>' +
      '</div>' +
      '<label class="field">그날 일정과 잇기 (선택)</label>' +
      '<select class="eEvent" aria-label="그날 일정과 잇기"><option value="">연결 안 함</option></select>' +
      '<label class="field">사진/영상 바꾸기 (선택)</label>' +
      '<input type="file" class="eFile" accept="image/*,video/*">' +
      '<div class="modal-actions">' +
        '<button class="dot-btn primary eSave">저장</button>' +
        '<button class="dot-btn eCancel">취소</button>' +
      '</div>' +
      '<div class="msg eMsg"></div>' +
    '</div></div>';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  fillEventSelect(overlay.querySelector('.eEvent'), w.event_id);

  const close = () => { overlay.remove(); document.body.style.overflow = ''; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.eSfxTry').addEventListener('click', () => {
    const k = overlay.querySelector('.eSfx').value;
    if (k) sfx(k); else alert('먼저 소리를 골라 주세요.');
  });
  overlay.querySelector('.eCancel').addEventListener('click', close);
  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  overlay.querySelector('.eSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('.eSave'), msg = overlay.querySelector('.eMsg');
    const title = overlay.querySelector('.eTitle').value.trim();
    if (!title) { msg.className = 'msg err'; msg.textContent = '제목을 입력해주세요.'; return; }

    btn.disabled = true;
    msg.className = 'msg'; msg.textContent = '저장 중...';
    const patch = {
      title,
      description: overlay.querySelector('.eDesc').value.trim() || null,
      author: overlay.querySelector('.eAuthor').value,
      made_on: overlay.querySelector('.eDate').value || null,
      quote: overlay.querySelector('.eQuote').value.trim() || null,
      event_id: overlay.querySelector('.eEvent').value || null,
      sfx: overlay.querySelector('.eSfx').value || null,
    };
    // 영상 주소를 고쳤으면 그것부터 확인한다. 없는 영상으로 바꿔 두면
    // 목록에 빈 칸만 남고 왜 그런지 알 길이 없다.
    const ytBox = overlay.querySelector('.eYoutube');
    if (ytBox) {
      const id = youtubeId(ytBox.value);
      if (!id) {
        msg.className = 'msg err'; msg.textContent = '유튜브 주소가 아닌 것 같아요.';
        btn.disabled = false; return;
      }
      if (youtubeUrl(id) !== w.media_url) {
        const info = await youtubeInfo(id);
        if (info.gone) {
          msg.className = 'msg err';
          msg.textContent = '그런 영상을 못 찾았어요. 주소를 다시 확인해 주세요.';
          btn.disabled = false; return;
        }
        patch.media_url = youtubeUrl(id);
      }
    }

    try {
      const file = overlay.querySelector('.eFile').files[0];
      const dropped = [];
      if (file) {
        msg.textContent = '새 파일 올리는 중...';
        const up = await uploadMedia(file, 'works', PORTFOLIO_IMAGE_LIMIT);
        dropped.push(w.media_url, w.thumb_url);     // 갈아치운 옛 사진은 남길 이유가 없다
        patch.media_url = up.url;
        patch.media_type = up.type;
        patch.thumb_url = up.thumbUrl;
      }
      const { error } = await sb.from('works').update(patch).eq('id', w.id);
      if (error) throw error;
      if (dropped.length) await removeStored(MEDIA_BUCKET, dropped);
    } catch (e) {
      msg.className = 'msg err'; msg.textContent = '실패: ' + ((e && e.message) || e);
      btn.disabled = false;
      return;
    }
    document.removeEventListener('keydown', onKey);
    close();
    loadWorks();
  });
}

// ---------- 사진에서 찍은 날짜 꺼내기 ----------
// 만든 날을 비우고 올리면 오늘 날짜가 박혀서, 몇 년 전 그림도 오늘 만든 것이 돼버린다.
// EXIF 가 없는 사진(스캔본·캡처)이면 null 을 돌려주고, 그때는 날짜 없이 저장된다.
async function exifDate(file){
  try {
    const meta = await extractPhotoMeta(file);
    return meta.takenAtISO ? meta.takenAtISO.slice(0, 10) : null;
  } catch (e) { return null; }
}

// ---------- 일정 목록 (작품을 그날과 잇기 위한 것) ----------
let eventList = [];
async function loadEventList(){
  const { data } = await sb.from('event_meta')
    .select('event_id, org_name, event_name, start_date, end_date')
    .order('start_date', { ascending:false });
  eventList = data || [];
}

// 작품을 만든 날에 무슨 일이 있었는지 스스로 찾아 붙이려면 일기와 이벤트가 필요하다.
// '그날 일정과 잇기'를 손으로 고르는 칸은 23개 중 0개가 쓰였는데 날짜는 전부 들어 있다.
let dayPosts = [];
async function loadDayLinks(){
  const [p, e] = await Promise.all([
    sb.from('posts').select('id, title, author, happened_on, created_at, status, is_public')
      .order('created_at', { ascending:false }),
    eventList.length ? Promise.resolve({ data: eventList }) : loadEventList().then(() => ({ data: eventList })),
  ]);
  dayPosts = (p.data || []).filter(x => x.status !== 'pending');
  if (!eventList.length && e && e.data) eventList = e.data;
}

const dayOf = v => v ? String(v).slice(0, 10) : null;

// 그 날짜에 걸리는 일기와 이벤트. 이벤트는 하루가 아니라 기간이라 사이에 드는지 본다.
function whatHappenedOn(made_on){
  if (!made_on) return { posts: [], events: [] };
  const d = dayOf(made_on);
  return {
    posts: dayPosts.filter(x => dayOf(x.happened_on || x.created_at) === d),
    events: eventList.filter(x =>
      x.start_date && dayOf(x.start_date) <= d && d <= dayOf(x.end_date || x.start_date)),
  };
}
function fillEventSelect(sel, current){
  if (!sel) return;
  sel.innerHTML = '<option value="">연결 안 함</option>' +
    eventList.map(e => {
      const name = [e.org_name, e.event_name].filter(Boolean).join(' · ') || e.event_id;
      const when = e.start_date ? ' (' + e.start_date.slice(0,7).replace('-', '.') + ')' : '';
      return '<option value="' + escapeHTML(e.event_id) + '"' +
        (current === e.event_id ? ' selected' : '') + '>' + escapeHTML(name + when) + '</option>';
    }).join('');
}

// ---------- 작품 자세히 보기 ----------
// 예전에는 사진만 크게 띄우는 라이트박스였다. 작품을 전시하는 게 이 사이트의 목적이라
// 사진 아래에 아이 말과 메모를 같이 두고, 좌우로 넘길 수 있게 함.
let viewList = [], viewIdx = -1;

// ---------- QR ----------
// 실물 그림 뒤에 붙여 두면, 몇 해 뒤 서랍에서 꺼냈을 때 언제 그렸는지·그날 무슨 일이
// 있었는지·아이가 뭐라고 했는지가 한 번에 열린다. 종이와 이 사이트를 잇는 유일한 고리다.
function workUrl(w){
  // 인쇄물은 오래 남는다. 지금 어디서 열어 보고 있든 링크는 늘 진짜 주소를 가리켜야 한다.
  return 'https://www.suayona.com/portfolio.html?work=' + w.id;
}

// QR 도구는 라벨을 뽑을 때만 받는다. 화면에 필요해진 그 순간에 부른다.
const QR_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const QR_SRI = 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k';
let _qrReady = null;
function loadQrcode(){
  if (_qrReady) return _qrReady;
  _qrReady = new Promise(resolve => {
    if (typeof qrcode !== 'undefined') return resolve(true);
    const sc = document.createElement('script');
    sc.src = QR_SRC;
    sc.integrity = QR_SRI;
    sc.crossOrigin = 'anonymous';
    sc.onload = () => resolve(true);
    sc.onerror = () => resolve(false);   // 못 받아도 화면은 그대로 두고 안내만 띄운다
    document.head.appendChild(sc);
  });
  return _qrReady;
}

function qrSvg(text, cellSize){
  if (typeof qrcode === 'undefined') return '';
  const qr = qrcode(0, 'M');          // 0 = 길이에 맞춰 알아서 고름
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: cellSize || 4, margin: 2, scalable: true });
}

async function renderQr(w){
  const box = $('#qrBox');
  if (!box) return;
  if (!isAdmin) { box.innerHTML = ''; return; }
  await loadQrcode();
  if (typeof qrcode === 'undefined') {
    box.innerHTML = '<div class="qrbox"><span class="lab">QR</span>' +
      '<p class="hintline">QR 만드는 도구를 못 불러왔어요. 새로고침해 보세요.</p></div>';
    return;
  }
  box.innerHTML = '<div class="qrbox">' +
      '<div class="code">' + qrSvg(workUrl(w)) + '</div>' +
      '<div class="side">' +
        '<span class="lab">🏷 작품 뒤에 붙일 QR</span>' +
        '<p class="hintline">그림 뒤에 붙여 두면 이 화면으로 바로 옵니다.</p>' +
        '<button class="dot-btn small" id="qrOne">이 작품만 인쇄</button>' +
      '</div>' +
    '</div>';
  $('#qrOne').addEventListener('click', () => printQrLabels([w]));
}

// 라벨을 종이에 앉히고 인쇄한다. 인쇄가 끝나면 화면을 원래대로 되돌린다.
async function printQrLabels(list){
  const sheet = $('#qrSheet');
  if (!list.length) return;
  await loadQrcode();
  if (typeof qrcode === 'undefined') { alert('QR 만드는 도구를 못 불러왔어요. 새로고침해 보세요.'); return; }

  sheet.innerHTML = list.map(w =>
    '<div class="qr-label">' +
      qrSvg(workUrl(w), 3) +
      '<div class="t">' + escapeHTML(w.title) + '</div>' +
      '<div class="m">' + (AUTHORS[w.author] || '같이') +
        (w.made_on ? ' · ' + escapeHTML(formatDate(w.made_on)) : '') + '</div>' +
      '<div class="s">suayona.com</div>' +
    '</div>').join('');

  document.body.classList.add('qr-printing');
  const done = () => {
    document.body.classList.remove('qr-printing');
    sheet.innerHTML = '';
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // 인쇄 대화상자를 취소했을 때 afterprint 가 안 오는 브라우저가 있어 대비해 둔다
  setTimeout(() => { if (document.body.classList.contains('qr-printing')) done(); }, 3000);
}

// ---------- 작품집 ----------
// 라벨은 작품 뒤에 붙이는 것이고, 이건 한 해를 통째로 묶는 것이다.
// 표지 한 장 + 한 장에 두 작품. 그림은 원본을 쓴다 — 종이에서는 썸네일이 뭉개진다.
async function printBook(list){
  if (!list.length) return;
  await loadQrcode();
  const btn = $('#bookBtn');
  const 그림 = list.filter(w => w.media_type !== 'youtube');
  const 해 = yearFilter === 'all' ? '' : yearFilter + '년 · ';
  const 누구 = filter === 'all' ? '수아랑 연아랑'
             : filter === 'youtube' ? '영상' : (AUTHORS[filter] || '수아랑 연아랑');

  $('#bookSheet').innerHTML =
    '<div class="bk-cover">' +
      '<h1>' + escapeHTML(해 + 누구 + ' 작품집') + '</h1>' +
      '<p class="sub">그리고, 만들고, 찍은 것들</p>' +
      '<p class="n">' + 그림.length + '점' +
        (그림.length !== list.length ? ' (영상 ' + (list.length - 그림.length) + '개는 빠졌어요)' : '') +
      '</p>' +
      '<p class="mark">suayona.com</p>' +
    '</div>' +
    그림.map(w =>
      '<div class="bk-item">' +
        '<img class="bk-pic" src="' + escapeHTML(w.media_url) + '" alt="' + escapeHTML(w.title) + '">' +
        '<div class="bk-row">' +
          qrSvg(workUrl(w), 3) +
          '<div class="bk-txt">' +
            '<p class="t">' + escapeHTML(w.title) + '</p>' +
            '<p class="m">' + (AUTHORS[w.author] || '같이') +
              (w.made_on ? ' · ' + escapeHTML(formatDate(w.made_on)) : '') + '</p>' +
            (w.quote ? '<p class="q">' + escapeHTML(w.quote) + '</p>' : '') +
          '</div>' +
        '</div>' +
      '</div>').join('');

  // 종이에는 게으른 그림이 빈칸으로 나온다 — 다 올 때까지 기다린다.
  const imgs = $$('#bookSheet img');
  const 남은 = imgs.filter(im => { im.loading = 'eager'; return !im.complete; });
  if (남은.length){
    btn.disabled = true;
    btn.textContent = '그림 불러오는 중… (' + 남은.length + '장)';
    await Promise.all(남은.map(im => new Promise(r => {
      im.addEventListener('load', r, { once:true });
      im.addEventListener('error', r, { once:true });
    })));
    btn.disabled = false;
    btn.textContent = '📖 작품집 인쇄';
  }

  document.body.classList.add('book-printing');
  const done = () => {
    document.body.classList.remove('book-printing');
    $('#bookSheet').innerHTML = '';
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (document.body.classList.contains('book-printing')) done(); }, 3000);
}

// ---------- 그날 있었던 일 ----------
// 손으로 고르게 한 칸은 아무도 안 썼다. 날짜는 이미 다 들어 있으니 그것으로 잇는다.
function renderThatDay(w){
  const box = $('#dayBox');
  if (!box) return;
  const { posts, events } = whatHappenedOn(w.made_on);
  // 이미 손으로 이어 둔 이벤트는 위에 따로 뜨므로 여기서는 뺀다
  const evs = events.filter(e => e.event_id !== w.event_id);
  if (!posts.length && !evs.length) { box.innerHTML = ''; return; }

  box.innerHTML = '<div class="thatday">' +
    '<span class="lab">📎 이 작품을 만든 날</span>' +
    evs.map(e =>
      '<a href="/event/e/?slug=' + encodeURIComponent(e.event_id) + '">' +
        '<span>📅 ' + escapeHTML(e.event_name || e.event_id) + '</span></a>').join('') +
    posts.map(p =>
      '<a href="/board.html#post-' + p.id + '">' +
        '<span>📖 ' + escapeHTML(p.title) + '</span>' +
        '<span class="who">' + (AUTHORS[p.author] || '같이') + '</span></a>').join('') +
  '</div>';
}

// ---------- 나중에 덧붙이기 ----------
// 여러 장을 한 번에 올리면 '아이가 한 말' 칸은 하나뿐이라 개별로 적을 수가 없었다.
// 그래서 23개 중 0개가 채워졌다. 여기서 언제든 적을 수 있게 한다.
function renderAddNote(w){
  const box = $('#noteBox');
  if (!box) return;
  if (!isAdmin) { box.innerHTML = ''; return; }

  box.innerHTML = '<div class="addnote">' +
    '<button class="dot-btn small" id="anOpen">✏️ ' +
      (w.quote || w.description ? '글 고치기' : '한 줄 덧붙이기') + '</button>' +
    '<div class="fields" id="anFields" hidden>' +
      '<label for="anQuote">아이가 한 말</label>' +
      '<textarea id="anQuote" placeholder="예: 이건 밤에 우는 나무예요"></textarea>' +
      '<label for="anNote">메모</label>' +
      '<textarea id="anNote" placeholder="언제 · 어디서 · 무슨 일이 있던 날인지"></textarea>' +
      '<div class="row">' +
        '<button class="dot-btn small primary" id="anSave">저장</button>' +
        '<button class="dot-btn small" id="anCancel">닫기</button>' +
      '</div>' +
      '<div class="msg" id="anMsg"></div>' +
    '</div></div>';

  $('#anOpen').addEventListener('click', () => {
    $('#anQuote').value = w.quote || '';
    $('#anNote').value  = w.description || '';
    $('#anFields').hidden = false;
    $('#anOpen').hidden = true;
    $('#anQuote').focus();
  });
  $('#anCancel').addEventListener('click', () => {
    $('#anFields').hidden = true;
    $('#anOpen').hidden = false;
  });
  $('#anSave').addEventListener('click', async () => {
    const msg = $('#anMsg'), btn = $('#anSave');
    btn.disabled = true;
    msg.className = 'msg'; msg.textContent = '저장 중...';
    const patch = {
      quote: $('#anQuote').value.trim() || null,
      description: $('#anNote').value.trim() || null,
    };
    const { error } = await sb.from('works').update(patch).eq('id', w.id);
    if (error) {
      btn.disabled = false;
      msg.className = 'msg err'; msg.textContent = '저장 실패: ' + error.message;
      return;
    }
    Object.assign(w, patch);
    renderWork();      // 인용문·메모가 바로 위에 반영되도록 다시 그린다
    render();          // 격자 카드의 한 줄도 함께
  });
}

// ---------- 아이 목소리 ----------
// 글로 쓰는 '아이가 한 말' 칸은 작품 23개 중 0개가 채워졌다. 말로 하면 부담이 훨씬 적고,
// 몇 해 지나면 그림보다 이쪽이 더 값질 수 있다.
let voiceRec = null;          // 녹음 중인 녹음기
let voiceDraft = null;        // 멈췄지만 아직 저장 안 한 것 {blob, secs, ext, url}

function clearVoiceDraft(){
  if (voiceDraft && voiceDraft.url) URL.revokeObjectURL(voiceDraft.url);
  voiceDraft = null;
}

// 다른 작품으로 넘어가거나 창을 닫으면 녹음을 접는다 — 마이크가 켜진 채로 남으면 안 된다
function stopVoiceWork(){
  if (voiceRec) { voiceRec.cancel(); voiceRec = null; }
  clearVoiceDraft();
}

function renderVoice(w){
  const box = $('#voiceBox');
  if (!box) return;

  // 들을 것도 없고 녹음할 권한도 없으면 자리를 아예 두지 않는다
  if (!w.audio_url && !isAdmin) { box.innerHTML = ''; return; }

  let html = '<div class="voice"><span class="lab">🎙 아이 목소리</span>';

  if (voiceDraft) {
    html += '<audio controls src="' + voiceDraft.url + '"></audio>' +
      '<p class="hintline">방금 녹음한 거예요. 들어보고 마음에 들면 저장하세요.</p>' +
      '<div class="row">' +
        '<button class="dot-btn small primary" id="vSave">저장</button>' +
        '<button class="dot-btn small" id="vRedo">다시 녹음</button>' +
        '<button class="dot-btn small" id="vDrop">버리기</button>' +
      '</div>';
  } else if (voiceRec) {
    html += '<div class="row">' +
        '<span class="timer" id="vTimer"><span class="rec-dot"></span>0:00</span>' +
        '<button class="dot-btn small primary" id="vStop">■ 멈추기</button>' +
      '</div>' +
      '<p class="hintline">최대 ' + VOICE_MAX_SECS + '초까지 담겨요. "이건 뭐 그린 거야?" 하고 물어보세요.</p>';
  } else {
    if (w.audio_url) {
      html += '<audio controls preload="none" src="' + escapeHTML(w.audio_url) + '"></audio>';
      if (w.audio_secs) html += '<p class="hintline">' + secsLabel(w.audio_secs) + '</p>';
    }
    if (isAdmin) {
      html += '<div class="row">' +
        '<button class="dot-btn small" id="vRec">🎙 ' + (w.audio_url ? '다시 녹음' : '녹음하기') + '</button>' +
        (w.audio_url ? '<button class="dot-btn small danger" id="vDel">지우기</button>' : '') +
      '</div>';
      if (!w.audio_url) {
        html += '<p class="hintline">아이에게 작품을 보여주며 물어보고, 그 대답을 그대로 담아보세요.</p>';
      }
      if (!canRecordVoice()) {
        html += '<p class="hintline">이 브라우저에서는 녹음이 안 돼요. 크롬이나 사파리에서 열어주세요.</p>';
      }
    }
  }
  html += '<div class="msg" id="vMsg"></div></div>';
  box.innerHTML = html;
  wireVoice(w);
}

function wireVoice(w){
  const msg = $('#vMsg');
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

  on('#vRec', async () => {
    if (!canRecordVoice()) { msg.className = 'msg err'; msg.textContent = '이 브라우저에서는 녹음이 안 돼요.'; return; }
    try {
      voiceRec = await startVoiceRecorder(secs => {
        const t = $('#vTimer');
        if (t) t.innerHTML = '<span class="rec-dot"></span>' + secsLabel(secs);
        if (secs >= VOICE_MAX_SECS) finishRecording(w);   // 저절로 멈춘 뒤 화면도 맞춰 준다
      });
      renderVoice(w);
    } catch (e) {
      msg.className = 'msg err';
      msg.textContent = /NotAllowed|Permission/i.test((e && e.name) + (e && e.message))
        ? '마이크를 쓸 수 없어요. 브라우저에서 이 사이트의 마이크 사용을 허용해 주세요.'
        : '녹음을 시작하지 못했어요: ' + ((e && e.message) || e);
    }
  });

  on('#vStop', () => finishRecording(w));
  on('#vRedo', () => { clearVoiceDraft(); $('#vRec') || renderVoice(w); $('#vRec') && $('#vRec').click(); });
  on('#vDrop', () => { clearVoiceDraft(); renderVoice(w); });

  on('#vSave', async () => {
    if (!voiceDraft) return;
    const btn = $('#vSave'); btn.disabled = true;
    msg.className = 'msg'; msg.textContent = '저장 중...';
    try {
      const url = await uploadVoice(voiceDraft.blob, voiceDraft.ext);
      const { error } = await sb.from('works')
        .update({ audio_url: url, audio_secs: voiceDraft.secs }).eq('id', w.id);
      if (error) throw error;
      w.audio_url = url; w.audio_secs = voiceDraft.secs;
      clearVoiceDraft();
      renderVoice(w);
      render();                     // 격자 카드에 🔊 표시가 붙도록
    } catch (e) {
      btn.disabled = false;
      msg.className = 'msg err'; msg.textContent = (e && e.message) || String(e);
    }
  });

  on('#vDel', async () => {
    if (!confirm('이 목소리를 지울까요?')) return;
    msg.className = 'msg'; msg.textContent = '지우는 중...';
    // 저장소 파일도 같이 치운다. 지워지지 않아도 화면에서는 사라지므로 막지는 않는다.
    const path = pathFromPublicUrl(MEDIA_BUCKET, w.audio_url);
    const { error } = await sb.from('works')
      .update({ audio_url: null, audio_secs: null }).eq('id', w.id);
    if (error) { msg.className = 'msg err'; msg.textContent = '지우지 못했어요: ' + error.message; return; }
    if (path) await sb.storage.from(MEDIA_BUCKET).remove([path]);
    w.audio_url = null; w.audio_secs = null;
    renderVoice(w);
    render();
  });
}

async function finishRecording(w){
  if (!voiceRec) return;
  const rec = voiceRec; voiceRec = null;
  try {
    const { blob, secs } = await rec.stop();
    if (!blob || !blob.size) { renderVoice(w); return; }
    voiceDraft = { blob, secs, ext: rec.ext, url: URL.createObjectURL(blob) };
  } catch (e) { /* 아무것도 안 담겼으면 그냥 처음 화면으로 */ }
  renderVoice(w);
}

// ---------- 도감 ----------
// 실제로 열어 본 작품을 이 브라우저에 적어 둔다. 첫 화면이 「도감 12/39」 로 읽어 간다.
// 서버에 안 남긴다 — 누가 무엇을 봤는지는 남길 이유가 없는 기록이다.
function markSeen(id){
  if (id == null) return;
  try {
    const seen = JSON.parse(localStorage.getItem('sy.dex') || '[]');
    if (seen.indexOf(id) >= 0) return;
    seen.push(id);
    localStorage.setItem('sy.dex', JSON.stringify(seen));
  } catch (e) {}          // 저장이 막혀 있어도 작품 보기는 그대로 돌아야 한다
}

function renderWork(){
  stopVoiceWork();          // 앞 작품에서 녹음 중이었다면 접는다
  const w = viewList[viewIdx];
  if (!w) return;
  markSeen(w.id);
  // 작품을 여는 것 자체가 누름이라, 이때는 소리 장치를 켤 수 있다.
  if (w.sfx) setTimeout(() => sfx(w.sfx), 120);
  const ytId = w.media_type === 'youtube' ? youtubeId(w.media_url) : '';
  const media = ytId
    ? '<div class="yt-frame">' + youtubeEmbedHTML(ytId, w.title) + '</div>'
    : w.media_type === 'video'
    ? '<video src="' + escapeHTML(w.media_url) + '" controls playsinline></video>'
    : '<img src="' + escapeHTML(w.media_url) + '" alt="' + escapeHTML(w.title) + '">';
  const ev = w.event_id
    ? '<a class="go-event" href="/event/e/?slug=' + encodeURIComponent(w.event_id) + '">📅 이날 무슨 일이 있었는지 보기</a>'
    : '';
  // 뒤에 적을 이야기가 있는 그림만 뒤집는다. 영상·유튜브는 누르면 재생이라 그대로 둔다.
  const flat = w.media_type !== 'youtube' && w.media_type !== 'video';
  const canFlip = flat && !!(w.quote || w.description || isAdmin);
  const when = w.made_on ? formatDate(w.made_on) : '';
  const age = ageAt(w.author, w.made_on);      // 로그인한 가족에게만 나온다
  const back =
    '<div class="face back">' +
      '<div class="bk-eye">뒷면</div>' +
      (w.quote ? '<div class="bk-quote">\u201C' + escapeHTML(w.quote) + '\u201D</div>' : '') +
      (w.description ? '<div class="bk-note">' + escapeHTML(w.description) + '</div>' : '') +
      (!w.quote && !w.description
        ? '<div class="bk-note">이 그림을 그릴 때 무슨 생각이었는지 여기에 적어 두면, 뒤집었을 때 나와요.</div>'
        : '') +
      '<div class="bk-when">' + escapeHTML([when, age].filter(Boolean).join(' · ')) + '</div>' +
    '</div>';
  $('#workBox').innerHTML =
    '<div class="media' + (canFlip ? ' can-flip' : '') + '" id="wMedia">' +
      (canFlip
        ? '<div class="flipper"><div class="face front">' + media + '</div>' + back + '</div>'
        : media) +
    '</div>' +
    '<div class="body">' +
      '<h3>' + escapeHTML(w.title) + '</h3>' +
      '<div class="meta">' +
        '<span class="tag ' + escapeHTML(w.author) + '">' + escapeHTML(AUTHORS[w.author] || '같이') + '</span>' +
        (when ? escapeHTML(when) : '') +
        (age ? ' <span class="tag">' + escapeHTML(age) + '</span>' : '') +
        (canFlip ? ' <button type="button" class="flip-btn" id="wFlip">🔄 뒷면</button>' : '') +
        // 아이가 이 작품에 붙여 둔 소리. 열 때 한 번 나고, 눌러서 다시 들을 수 있다.
        (w.sfx && WORK_SFX[w.sfx]
          ? ' <button type="button" class="work-sfx" id="wSfx" title="이 작품의 소리">🔈 ' +
            escapeHTML(WORK_SFX[w.sfx].label) + '</button>'
          : '') +
      '</div>' +
      // 뒤집히는 작품은 이야기를 뒷면에만 둔다 — 앞면에 또 적으면 뒤집을 까닭이 없다
      (canFlip ? '' :
        (w.quote ? '<p class="quote">\u201C' + escapeHTML(w.quote) + '\u201D</p>' : '') +
        (w.description ? '<p class="note">' + escapeHTML(w.description) + '</p>' : '')) +
      ev +
      '<div id="noteBox"></div>' +
      '<div id="qrBox"></div>' +
      '<div id="voiceBox"></div>' +
      '<div id="dayBox"></div>' +
      '<div class="work-nav">' +
        '<button class="dot-btn small" id="wPrev">← 이전</button>' +
        '<button class="dot-btn small" id="wNext">다음 →</button>' +
      '</div>' +
    '</div>';
  renderVoice(w);
  renderQr(w);
  renderThatDay(w);
  renderAddNote(w);
  $('#wPrev').disabled = viewIdx <= 0;
  $('#wNext').disabled = viewIdx >= viewList.length - 1;
    const sfxBtn = $('#wSfx');
  if (sfxBtn) sfxBtn.addEventListener('click', () => sfx(w.sfx));
  if (canFlip) {
    const mediaBox = $('#wMedia'), flipBtn = $('#wFlip');
    const flip = () => { mediaBox.classList.toggle('flipped'); sfx('prop'); };
    mediaBox.addEventListener('click', flip);
    if (flipBtn) flipBtn.addEventListener('click', (e) => { e.stopPropagation(); flip(); });
  }
  $('#wPrev').addEventListener('click', () => { if (viewIdx > 0) { viewIdx--; renderWork(); } });
  $('#wNext').addEventListener('click', () => { if (viewIdx < viewList.length - 1) { viewIdx++; renderWork(); } });
  $('#workView').scrollTop = 0;
}

// 작품 창을 열 때 뒤로가기 자리를 하나 만들어 둔다.
// 손전화에서 창을 닫는 몸짓은 곧 뒤로가기다. 그런데 여기서 뒤로를 누르면
// 창만 닫히는 게 아니라 사이트 밖으로 나가 버려서, 보던 목록과 걸러 놓은 것을
// 통째로 잃었다. 이제 뒤로는 창만 닫는다.
let workPushed = false;

function openWork(list, i){
  viewList = list; viewIdx = i;
  renderWork();
  // QR 로 찍고 들어온 사람이 다시 이 주소를 나눌 수 있게 남긴다
  const u = new URL(location.href);
  u.searchParams.set('work', list[i] && list[i].id);
  if (workPushed) {
    history.replaceState({ work:true }, '', u);   // 이미 자리를 만들어 뒀으면 덧대지 않는다
  } else {
    // ?work= 를 달고 들어온 경우(QR)에는 지금 자리를 먼저 깨끗한 주소로 바꾼다.
    // 그래야 뒤로 갔을 때 주소까지 목록 화면이 된다.
    const bare = new URL(location.href);
    bare.searchParams.delete('work');
    history.replaceState(null, '', bare);
    history.pushState({ work:true }, '', u);
    workPushed = true;
  }
  $('#workView').classList.add('open');
  document.body.classList.add('lb-open');       // 배경 겹·스크롤 정리는 기존 규칙을 그대로 씀
  document.body.style.overflow = 'hidden';
}

// 화면만 정리한다. 뒤로가기 자리를 어떻게 할지는 부르는 쪽이 정한다.
function closeWorkView(){
  $('#workView').classList.remove('open');
  document.body.classList.remove('lb-open');
  document.body.style.overflow = '';
  const v = $('#workBox').querySelector('video'); if (v) v.pause();
  const a = $('#workBox').querySelector('audio'); if (a) a.pause();
  // 유튜브 재생기는 pause 가 없다 — 창을 숨겨도 소리가 계속 나와서 통째로 떼어 낸다.
  // 다시 열면 renderWork 가 새로 그리니 잃는 것이 없다.
  const f = $('#workBox').querySelector('iframe'); if (f) f.remove();
  stopVoiceWork();          // 창을 닫으면 마이크도 끈다
}

// ✕ · ESC · 바깥 누르기 — 뒤로가기와 같은 결과가 되도록 한 자리를 물러난다.
// 그래야 닫을 때마다 자리가 쌓여서 뒤로를 여러 번 눌러야 하는 일이 없다.
function closeWork(){
  if (!$('#workView').classList.contains('open')) return;
  if (workPushed) { history.back(); return; }   // 아래 popstate 가 받아서 닫는다
  const u = new URL(location.href);
  u.searchParams.delete('work');
  history.replaceState(null, '', u);
  closeWorkView();
}

// 뒤로가기 — 페이지를 떠나는 대신 창만 닫는다
window.addEventListener('popstate', () => {
  workPushed = false;
  if ($('#workView').classList.contains('open')) closeWorkView();
});
$('#workClose').addEventListener('click', closeWork);
$('#workView').addEventListener('click', (e) => { if (e.target.id === 'workView') closeWork(); });
document.addEventListener('keydown', (e) => {
  if (!$('#workView').classList.contains('open')) return;
  if (e.key === 'Escape') closeWork();
  if (e.key === 'ArrowLeft'  && viewIdx > 0) { viewIdx--; renderWork(); }
  if (e.key === 'ArrowRight' && viewIdx < viewList.length - 1) { viewIdx++; renderWork(); }
});

// ---------- 필터 ----------
$('#filters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  filter = btn.dataset.filter;
  $$('#filters .dot-btn').forEach(b => b.classList.toggle('on', b === btn));
  render();
});

// 연도 버튼은 실제로 있는 연도만 만든다 — 빈 연도를 눌러 아무것도 안 나오는 일이 없게
//
// 그리고 최근 몇 해만 단추로 둔다. 평소에 보는 건 최근 한두 해고, 옛날 연도는
// 작정하고 찾아 들어가는 것이라 클릭 한 번을 더 받아도 된다 — 단추 열몇 개를
// 매일 보는 화면에 늘어놓는 것보다는. 5개까지는 지금처럼 다 보인다.
const RECENT_YEARS = 4;
let yearsOpen = false;
function buildYearFilter(){
  const box = $('#years');
  const years = [...new Set(works.map(w => w.made_on && w.made_on.slice(0,4)).filter(Boolean))]
    .sort((a,b) => b.localeCompare(a));
  const foldable = years.length > RECENT_YEARS + 1;
  // 접혀 있어도 지금 고른 연도는 보여야 한다 — 켜진 단추가 숨으면 뭘 보고 있는지 모른다
  const shown = (foldable && !yearsOpen)
    ? years.filter((y, i) => i < RECENT_YEARS || y === yearFilter)
    : years;
  box.innerHTML = '<button class="dot-btn small' + (yearFilter === 'all' ? ' on' : '') +
    '" data-year="all">모든 해</button>' +
    shown.map(y => '<button class="dot-btn small' + (yearFilter === y ? ' on' : '') +
      '" data-year="' + y + '">' + y + '</button>').join('') +
    (foldable
      ? '<button class="dot-btn small" id="yearsMore">' + (yearsOpen ? '접기 <span class="ico">▴</span>' : '그전 <span class="ico">▾</span>') + '</button>'
      : '') +
    '<a class="yearbook-link" id="yearbookLink" href="/year.html"></a>';
  // 연도가 하나뿐이라 버튼 줄을 감추더라도 문집 입구는 남겨야 한다
  box.style.display = '';
  box.querySelectorAll('[data-year]').forEach(b => { b.hidden = years.length <= 1; });
  const more = box.querySelector('#yearsMore');
  if (more) more.addEventListener('click', () => { yearsOpen = !yearsOpen; buildYearFilter(); });
  syncYearbookLink(years);
}

// 지금 고른 연도를 그대로 문집으로 넘긴다. 저쪽에서 다시 고르지 않아도 되도록.
let yearsCache = [];
function syncYearbookLink(years){
  if (years) yearsCache = years;
  const a = $('#yearbookLink');
  if (!a) return;
  const y = yearFilter !== 'all' ? yearFilter : (yearsCache[0] || '');
  a.href = '/year.html' + (y ? '?year=' + encodeURIComponent(y) : '');
  a.textContent = '📖 ' + (y ? y + '년 ' : '') + '모아보기 →';
}
$('#years').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-year]');
  if (!btn) return;
  yearFilter = btn.dataset.year;
  $$('#years .dot-btn').forEach(b => b.classList.toggle('on', b === btn));
  syncYearbookLink();
  render();
});

// ---------- 작품 사진 가볍게 만들기 ----------
// 격자는 264px 칸인데 예전에 올린 작품은 원본(1800px 넘음)밖에 없다.
// 없는 것만 골라 작은 사본을 만들어 둔다.
async function showThumbTool(box){
  // 유튜브는 미리보기 그림을 유튜브가 주므로 우리가 만들 것이 없다
  const missing = works.filter(w =>
    w.media_type !== 'video' && w.media_type !== 'youtube' && !w.thumb_url);
  if (!missing.length) return;

  const btn = document.createElement('button');
  btn.className = 'dot-btn small';
  btn.textContent = '🗜 작품 사진 ' + missing.length + '개 가볍게 만들기';
  const note = document.createElement('span');
  note.style.cssText = 'font-size:12.5px; color:var(--ink-soft); margin-left:10px; align-self:center;';
  box.appendChild(btn);
  box.appendChild(note);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const res = await backfillThumbs(
      MEDIA_BUCKET,
      missing.map(w => ({ id: w.id, url: w.media_url })),
      (id, thumb_url) => sb.from('works').update({ thumb_url }).eq('id', id),
      (i, n) => { note.textContent = '만드는 중... (' + i + '/' + n + ')'; });

    const parts = [res.made + '개 완료'];
    if (res.skipped) parts.push('이미 작은 사진 ' + res.skipped + '개는 그대로');
    if (res.failed)  parts.push(res.failed + '개 실패 — ' + res.why);
    note.textContent = parts.join(' · ');
    note.style.color = res.failed ? '#c0392b' : 'var(--ink-soft)';
    btn.disabled = false;
    await loadWorks();
  });
}

// 일기와 이벤트 일정에도 사본이 없는 사진이 남아 있다.
// 작품과 같은 방식으로 한 번에 만들어 준다.
async function showOtherThumbTool(box){
  const [posts, events] = await Promise.all([
    sb.from('posts').select('id, image_url, thumb_url'),
    sb.from('events').select('id, image_url, thumb_url, extra_images'),
  ]);
  if (posts.error || events.error) return;

  const jobs = [];
  (posts.data || []).forEach(x => {
    if (x.image_url && !x.thumb_url)
      jobs.push({ what: '일기', id: x.id, url: x.image_url,
                  save: t => sb.from('posts').update({ thumb_url: t }).eq('id', x.id) });
  });
  (events.data || []).forEach(x => {
    if (x.image_url && !x.thumb_url)
      jobs.push({ what: '일정', id: x.id, url: x.image_url,
                  save: t => sb.from('events').update({ thumb_url: t }).eq('id', x.id) });
    // 추가 사진은 배열 안이라 자리를 짚어 그 항목만 갈아 끼운다
    (Array.isArray(x.extra_images) ? x.extra_images : []).forEach((sh, i) => {
      if (!sh || !sh.url || sh.thumb) return;
      jobs.push({ what: '일정', id: x.id + ':' + i, url: sh.url, save: t => {
        const next = x.extra_images.slice();
        next[i] = Object.assign({}, next[i], { thumb: t });
        x.extra_images = next;
        return sb.from('events').update({ extra_images: next }).eq('id', x.id);
      }});
    });
  });
  if (!jobs.length) return;

  const btn = document.createElement('button');
  btn.className = 'dot-btn small';
  btn.textContent = '🗜 일기·일정 사진 ' + jobs.length + '개 가볍게 만들기';
  const note = document.createElement('span');
  note.style.cssText = 'font-size:12.5px; color:var(--ink-soft); margin-left:10px; align-self:center;';
  box.appendChild(btn); box.appendChild(note);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    // 사진이 어느 버킷에 있는지는 주소가 알려 준다 — 갤러리에서 가져온 것과 직접 올린 것이 섞여 있다
    let made = 0, skipped = 0, failed = 0, why = '';
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      note.textContent = '만드는 중... (' + (i + 1) + '/' + jobs.length + ')';
      const bucket = pathFromPublicUrl(GALLERY_BUCKET, j.url) ? GALLERY_BUCKET : MEDIA_BUCKET;
      const res = await backfillThumbs(bucket, [{ id: j.id, url: j.url }], (_id, t) => j.save(t));
      made += res.made; skipped += res.skipped; failed += res.failed;
      if (!why && res.why) why = res.why;
    }
    const parts = [made + '개 완료'];
    if (skipped) parts.push('이미 작은 사진 ' + skipped + '개는 그대로');
    if (failed)  parts.push(failed + '개 실패 — ' + why);
    note.textContent = parts.join(' · ');
    note.style.color = failed ? '#c0392b' : 'var(--ink-soft)';
    btn.disabled = false;
  });
}

// 예전 삭제들이 남겨 둔 파일을 치운다. 치울 것이 없으면 단추 자체가 안 생긴다.
async function showCleanupTool(box){
  const note = document.createElement('span');
  note.style.cssText = 'font-size:12.5px; color:var(--ink-soft); margin-left:10px; align-self:center;';

  let scan;
  try { scan = await findUnusedFiles(); }
  catch (e) { console.warn('안 쓰는 파일 찾기 실패:', e); return; }
  if (!scan.found.length) return;

  const btn = document.createElement('button');
  btn.className = 'dot-btn small';
  btn.textContent = '🧹 안 쓰는 사진 파일 ' + scan.found.length + '개 치우기 (' + mbLabel(scan.bytes) + ')';
  box.appendChild(btn); box.appendChild(note);

  btn.addEventListener('click', async () => {
    // 지우기 전에 다시 훑는다. 아까 훑고 지금까지 사이에 새로 올라간 것이 있을 수 있다.
    btn.disabled = true;
    note.textContent = '다시 확인하는 중...';
    let fresh;
    try { fresh = await findUnusedFiles(); }
    catch (e) { note.textContent = '실패: ' + ((e && e.message) || e); note.style.color = '#c0392b'; btn.disabled = false; return; }
    if (!fresh.found.length) { note.textContent = '치울 것이 없어요.'; btn.disabled = false; return; }

    const sample = fresh.found.slice(0, 5).map(f => '· ' + f.path).join('\n');
    if (!confirm('아무 데서도 안 쓰는 파일 ' + fresh.found.length + '개(' + mbLabel(fresh.bytes) + ')를 지웁니다.\n' +
                 '되돌릴 수 없어요.\n\n' + sample +
                 (fresh.found.length > 5 ? '\n· ... 외 ' + (fresh.found.length - 5) + '개' : ''))) {
      btn.disabled = false; note.textContent = ''; return;
    }
    try {
      const gone = await removeUnusedFiles(fresh.found, (i, n) => { note.textContent = '치우는 중... (' + i + '/' + n + ')'; });
      note.textContent = gone + '개 치웠어요 · ' + mbLabel(fresh.bytes) + ' 되찾음';
      btn.remove();
    } catch (e) {
      note.textContent = '실패: ' + ((e && e.message) || e);
      note.style.color = '#c0392b';
      btn.disabled = false;
    }
  });
}

// ---------- 아이가 낸 그림 ----------
// 도트 그림판에서 아이가 「작품으로 내기」를 누르면 status='pending' 으로 들어온다.
// 일기와 같은 결로 — 부모가 보고 올려야 전시실에 걸린다.
function renderPendingWorks(){
  const area = $('#adminArea');
  const waiting = works.filter(w => w.status === 'pending');
  if (!waiting.length) return;

  const box = document.createElement('div');
  box.className = 'pending-works dot-card';
  box.innerHTML = '<div class="inner"><h3>⏳ 아이가 낸 그림 ' + waiting.length + '점이 기다려요</h3>' +
    '<p class="pw-hint">' + (isAdmin
      ? '올리기를 누르기 전에는 다른 사람에게 보이지 않아요.'
      : '부모님이 보고 올려 주면 전시실에 걸려요.') + '</p></div>';
  const inner = box.querySelector('.inner');

  waiting.forEach(w => {
    const row = document.createElement('div');
    row.className = 'pw-row';
    row.innerHTML =
      '<img src="' + escapeHTML(w.media_url) + '" alt="' + escapeHTML(w.title) + '">' +
      '<div class="pw-main">' +
        '<b>' + escapeHTML(w.title) + '</b>' +
        '<span class="pw-meta">' + (AUTHORS[w.author] || '같이') +
          (w.made_on ? ' · ' + escapeHTML(formatDate(w.made_on)) : '') + '</span>' +
        (w.quote ? '<span class="pw-q">\u201C' + escapeHTML(w.quote) + '\u201D</span>' : '') +
      '</div>' +
      '<div class="pw-acts"></div>';
    const acts = row.querySelector('.pw-acts');

    if (isAdmin){
      const ok = document.createElement('button');
      ok.className = 'dot-btn small primary';
      ok.textContent = '전시실에 올리기';
      ok.addEventListener('click', async () => {
        ok.disabled = true;
        const { error } = await sb.from('works').update({ status: 'published' }).eq('id', w.id);
        if (error){ ok.disabled = false; alert('올리지 못했어요: ' + readableError(error)); return; }
        await loadWorks();
        renderAdminArea();          // 기다리는 줄에서도 빠져야 한다
      });
      acts.appendChild(ok);
    }
    // 낸 아이도, 부모도 물릴 수 있다
    const no = document.createElement('button');
    no.className = 'dot-btn small danger';
    no.textContent = isAdmin ? '지우기' : '물리기';
    no.addEventListener('click', async () => {
      if (!confirm('「' + w.title + '」을 지울까요?')) return;
      no.disabled = true;
      const { error } = await sb.from('works').delete().eq('id', w.id);
      if (error){ no.disabled = false; alert('지우지 못했어요: ' + readableError(error)); return; }
      await loadWorks();
      renderAdminArea();
    });
    acts.appendChild(no);
    inner.appendChild(row);
  });
  area.appendChild(box);
}

// ---------- 관리자 영역 ----------
function renderAdminArea(){
  const area = $('#adminArea');
  area.innerHTML = '';
  renderPendingWorks();
  // 방문자에게는 아무것도 두지 않는다. 작품을 올리는 사람은 한 명뿐이고,
  // 그 사람은 헤더 로그인으로 들어온다.
  if (!isAdmin) { render(); return; }   // 아이는 위의 「낸 그림」 칸까지만 본다

  // 사본이 없는 작품이 남아 있으면 한 번에 만들 수 있게 단추를 띄운다
  const tools = document.createElement('div');
  tools.style.cssText = 'display:flex; justify-content:center; gap:9px; flex-wrap:wrap; margin-bottom:18px;';
  area.appendChild(tools);

  // 올리기 폼은 접어 둔다. 펼쳐 두었더니 화면 한 장(889px)을 통째로 먹어서,
  // 작품을 보러 온 날에도 매번 폼부터 지나쳐야 했다. 올리는 날에만 편다.
  const addToggle = document.createElement('button');
  addToggle.className = 'dot-btn small primary';
  addToggle.textContent = '＋ 새 작품 올리기';
  addToggle.addEventListener('click', () => {
    const open = box.style.display !== 'none';
    box.style.display = open ? 'none' : '';
    addToggle.textContent = open ? '＋ 새 작품 올리기' : '－ 접기';
    if (!open) { $('#wTitle').focus(); box.scrollIntoView({ behavior:'smooth', block:'start' }); }
  });
  tools.appendChild(addToggle);

  showThumbTool(tools);
  showOtherThumbTool(tools);
  showCleanupTool(tools);

  // 지금 걸러 놓은 작품들의 라벨을 한 장에 모아 뽑는다
  const qrBtn = document.createElement('button');
  qrBtn.className = 'dot-btn small';
  qrBtn.textContent = '🏷 QR 라벨 인쇄';
  qrBtn.addEventListener('click', () => {
    const shown = visible();          // 거르개가 걸린 그대로
    if (!shown.length) { alert('인쇄할 작품이 없어요.'); return; }
    if (!confirm('지금 보이는 작품 ' + shown.length + '개의 라벨을 인쇄할까요?')) return;
    printQrLabels(shown);
  });
  tools.appendChild(qrBtn);

  // 한 해치를 묶어 종이 책으로. 라벨과 달리 그림이 통째로 들어간다.
  const bookBtn = document.createElement('button');
  bookBtn.className = 'dot-btn small';
  bookBtn.id = 'bookBtn';
  bookBtn.textContent = '📖 작품집 인쇄';
  bookBtn.addEventListener('click', () => {
    const shown = visible();
    const 그림 = shown.filter(w => w.media_type !== 'youtube');
    if (!그림.length) { alert('인쇄할 그림이 없어요. (영상은 종이에 담을 수 없어요)'); return; }
    if (!confirm('지금 보이는 그림 ' + 그림.length + '점으로 작품집을 만들까요?\n한 장에 두 점씩, 표지까지 ' +
                 (1 + Math.ceil(그림.length / 2)) + '장쯤 나와요.')) return;
    printBook(shown);
  });
  tools.appendChild(bookBtn);

  loadEventList().then(() => fillEventSelect($('#wEvent'), ''));

  const box = document.createElement('div');
  box.className = 'add-box dot-card';
  box.style.display = 'none';
  box.innerHTML =
    '<div class="inner">' +
      '<h3>＋ 새 작품 올리기</h3>' +
      '<label class="field">제목</label><input type="text" id="wTitle" placeholder="예: 우리 가족 그림">' +
      '<label class="field">아이가 한 말 (선택)</label>' +
      '<textarea id="wQuote" style="min-height:60px;" placeholder="예: 이건 밤에 우는 나무예요"></textarea>' +
      '<label class="field">메모 (선택)</label>' +
      '<textarea id="wDesc" style="min-height:60px;" placeholder="언제 · 어디서 · 무슨 일이 있던 날인지"></textarea>' +
      '<div class="row2">' +
        '<div><label class="field">누구 작품</label>' +
          '<select id="wAuthor" aria-label="누구 작품인지"><option value="sua">수아</option><option value="yona">연아</option><option value="together">같이</option></select>' +
        '</div>' +
        '<div><label class="field">만든 날 (비우면 사진에서)</label><input type="date" id="wDate"></div>' +
      '</div>' +
      '<label class="field">그날 일정과 잇기 (선택)</label>' +
      '<select id="wEvent" aria-label="어느 행사의 작품인지"><option value="">연결 안 함</option></select>' +
      '<label class="field">사진 / 영상 (여러 개 선택 가능)</label>' +
      '<div style="font-size:11.5px; color:var(--ink-soft); margin:-2px 0 6px; line-height:1.6;">' +
        '사진은 10MB를 넘을 때만 자동으로 줄여서 올라가요 · 영상은 100MB까지</div>' +
      '<input type="file" id="wFiles" accept="image/*,video/*" multiple>' +
      '<div class="or-line">또는</div>' +
      '<label class="field">유튜브 주소</label>' +
      '<input type="text" id="wYoutube" placeholder="https://youtu.be/... · Shorts 주소도 돼요">' +
      '<div class="yt-hint" id="wYtHint">붙여넣으면 제목을 채워드려요. 영상은 저장공간을 안 씁니다.</div>' +
      '<button class="dot-btn primary" id="wSave" style="width:100%; margin-top:18px;">올리기</button>' +
      '<div class="msg" id="wMsg"></div>' +
    '</div>';
  area.appendChild(box);

  // 주소를 붙여넣는 순간 그게 진짜 영상인지 물어보고, 제목 칸이 비어 있으면 채워 준다.
  // 저장한 뒤에 "없는 영상이었다"를 알게 되면 지웠다 다시 넣어야 해서 미리 본다.
  let ytChecked = '';                       // 방금 확인한 번호 (같은 주소를 두 번 안 묻게)
  const ytHint = () => $('#wYtHint');
  async function checkYoutube(){
    const raw = $('#wYoutube').value.trim();
    const id = youtubeId(raw);
    if (!raw) { ytChecked = ''; ytHint().className = 'yt-hint';
      ytHint().textContent = '붙여넣으면 제목을 채워드려요. 영상은 저장공간을 안 씁니다.'; return; }
    if (!id) { ytChecked = ''; ytHint().className = 'yt-hint err';
      ytHint().textContent = '유튜브 주소가 아닌 것 같아요.'; return; }
    if (id === ytChecked) return;
    ytHint().className = 'yt-hint'; ytHint().textContent = '영상을 확인하는 중...';
    const info = await youtubeInfo(id);
    if (info.gone) { ytChecked = ''; ytHint().className = 'yt-hint err';
      ytHint().textContent = '그런 영상을 못 찾았어요. 비공개 영상이거나 주소가 틀렸을 수 있어요.'; return; }
    ytChecked = id;
    if (info.ok) {
      if (!$('#wTitle').value.trim()) $('#wTitle').value = info.title;
      ytHint().className = 'yt-hint ok';
      ytHint().textContent = '확인했어요 — ' + info.channel + ' · 제목은 원하시는 말로 고치셔도 돼요.';
    } else {
      ytHint().className = 'yt-hint';
      ytHint().textContent = '제목은 못 물어봤지만 그대로 올릴 수 있어요.';
    }
  }
  $('#wYoutube').addEventListener('change', checkYoutube);
  $('#wYoutube').addEventListener('paste', () => setTimeout(checkYoutube, 0));

  $('#wSave').addEventListener('click', async () => {
    const msg = $('#wMsg'), btn = $('#wSave');
    msg.className = 'msg'; msg.textContent = '';
    const title = $('#wTitle').value.trim();
    const files = Array.from($('#wFiles').files || []);
    const ytId = youtubeId($('#wYoutube').value);
    if (!title) { msg.className = 'msg err'; msg.textContent = '제목을 입력해주세요.'; return; }
    if (!files.length && !ytId) {
      msg.className = 'msg err';
      msg.textContent = '사진·영상을 고르거나 유튜브 주소를 넣어주세요.';
      return;
    }

    btn.disabled = true;
    const author = $('#wAuthor').value;
    const description = $('#wDesc').value.trim() || null;
    const quote = $('#wQuote').value.trim() || null;
    const event_id = $('#wEvent').value || null;
    const madeOnTyped = $('#wDate').value || null;
    let ok = 0;

    // 유튜브는 파일이 없으므로 여기서 끝난다.
    // 만든 날을 비웠으면 오늘로 잡는다 — 사진과 달리 찍은 날을 알 길이 없고,
    // 비워 두면 연도별 보기에서 통째로 빠져 버린다.
    if (ytId) {
      msg.className = 'msg'; msg.textContent = '영상을 확인하는 중...';
      const info = await youtubeInfo(ytId);
      if (info.gone) {
        msg.className = 'msg err';
        msg.textContent = '그런 영상을 못 찾았어요. 주소를 다시 확인해 주세요.';
        btn.disabled = false; return;
      }
      const { error } = await sb.from('works').insert({
        title, description, quote, event_id, author,
        made_on: madeOnTyped || new Date().toLocaleDateString('sv-SE'),
        media_url: youtubeUrl(ytId), media_type: 'youtube', thumb_url: null,
        sort_order: Math.floor(Date.now() / 1000),
      });
      btn.disabled = false;
      if (error) { msg.className = 'msg err'; msg.textContent = '실패: ' + error.message; return; }
      msg.className = 'msg ok'; msg.textContent = '영상을 올렸어요!';
      $('#wTitle').value = ''; $('#wDesc').value = ''; $('#wQuote').value = '';
      $('#wYoutube').value = ''; ytChecked = '';
      ytHint().className = 'yt-hint';
      ytHint().textContent = '붙여넣으면 제목을 채워드려요. 영상은 저장공간을 안 씁니다.';
      loadWorks();
      return;
    }

    for (let i = 0; i < files.length; i++) {
      msg.className = 'msg';
      msg.textContent = '올리는 중... (' + (i+1) + '/' + files.length + ') ' + files[i].name;
      try {
        // 만든 날을 비웠으면 사진에 남은 촬영 날짜를 쓴다.
        // 올린 날이 만든 날로 굳어버리면 연도별 보기도 성장 기록도 어긋난다.
        const made_on = madeOnTyped || await exifDate(files[i]);
        const up = await uploadMedia(files[i], 'works', PORTFOLIO_IMAGE_LIMIT);
        const { error } = await sb.from('works').insert({
          title: files.length > 1 ? title + ' (' + (i+1) + ')' : title,
          description, quote, event_id, author, made_on,
          media_url: up.url, media_type: up.type, thumb_url: up.thumbUrl,
          sort_order: Math.floor(Date.now() / 1000),
        });
        if (error) throw error;
        ok++;
      } catch (e) {
        msg.className = 'msg err';
        msg.textContent = '실패: ' + ((e && e.message) || e);
        btn.disabled = false;
        return;
      }
    }

    btn.disabled = false;
    msg.className = 'msg ok'; msg.textContent = ok + '개 올렸어요!';
    $('#wTitle').value = ''; $('#wDesc').value = ''; $('#wQuote').value = ''; $('#wFiles').value = '';
    loadWorks();
  });

  render();
}

// ---------- 시작 ----------
(async () => {
  await refreshAuth();
  // 생일과 작품은 서로를 안 기다려도 된다. 줄 세우면 왕복이 하나씩 늘어난다.
  await Promise.all([loadKids(), loadWorks()]);
  renderAdminArea();
  initReveal();
  // 그날 자료는 작품을 열었을 때만 쓰이므로 화면을 막지 않고 뒤따라 받는다
  loadDayLinks().catch(() => {});
  openFromQuery();
})();

// 그림 뒤 QR 을 찍으면 ?work=13 으로 들어온다. 그 작품을 바로 펴 준다.
// 거른 조건과 상관없이 열려야 하므로 전체 목록에서 찾는다.
function openFromQuery(){
  const want = new URLSearchParams(location.search).get('work');
  if (!want) return;
  const i = works.findIndex(w => String(w.id) === String(want));
  if (i < 0) return;
  openWork(works, i);
}
