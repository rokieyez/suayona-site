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

function photoPosts(){
  return posts.filter(p => photosOf(p).length);
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

function render(){
  const list = $('#posts');
  list.innerHTML = '';
  $('#empty').style.display = posts.length ? 'none' : 'block';

  posts.forEach(p => {
    const el = document.createElement('article');
    el.className = 'post dot-card reveal';
    el.id = 'post-' + p.id;      // 작품에서 "그날의 일기"로 바로 건너올 수 있도록
    el.dataset.when = p.happened_on || p.created_at;   // 배경을 그날 계절로 갈아 끼우는 데 쓴다
    el.innerHTML =
      '<h2>' + escapeHTML(p.title) + '</h2>' +
      '<div class="meta">' +
        '<span class="tag ' + escapeHTML(p.author) + '">' + (AUTHORS[p.author] || '같이') + '</span> ' +
        (p.status === 'pending' ? '<span class="tag pending">⏳ 확인 기다림</span> ' : '') +
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

    if (isAdmin) {
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
}

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

// ---------- 기존 일기 수정 ----------
function renderEditForm(p){
  const form = document.createElement('div');
  form.className = 'edit-form';
  const sel = (v, cur) => v === cur ? ' selected' : '';
  form.innerHTML =
    '<label class="field">누가 쓰나요</label>' +
    '<select class="eAuthor" aria-label="누가 쓰나요">' +
      '<option value="sua"' + sel('sua', p.author) + '>수아</option>' +
      '<option value="yona"' + sel('yona', p.author) + '>연아</option>' +
      '<option value="together"' + sel('together', p.author) + '>같이</option>' +
    '</select>' +
    '<label class="field">공개 설정</label>' +
    '<select class="ePublic" aria-label="공개 설정">' +
      '<option value="true"' + (p.is_public !== false ? ' selected' : '') + '>🌏 공개 — 누구나 볼 수 있어요</option>' +
      '<option value="false"' + (p.is_public === false ? ' selected' : '') + '>🔒 비공개 — 로그인해야 볼 수 있어요</option>' +
    '</select>' +
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
    '<div class="actions" style="margin-top:16px;">' +
      '<button class="dot-btn small primary eSave">저장</button>' +
      '<button class="dot-btn small eCancel">취소</button>' +
    '</div>' +
    '<div class="msg eMsg"></div>';

  form.querySelector('.eCancel').addEventListener('click', () => render());

  form.querySelector('.eSave').addEventListener('click', async () => {
    const btn = form.querySelector('.eSave'), msg = form.querySelector('.eMsg');
    const title = form.querySelector('.eTitle').value.trim();
    if (!title) { msg.className = 'msg err'; msg.textContent = '제목을 입력해주세요.'; return; }

    btn.disabled = true;
    msg.className = 'msg'; msg.textContent = '저장 중...';

    let image_url = p.image_url || null, thumb_url = p.thumb_url || null;
    const file = form.querySelector('.eImage').files[0];
    const removeImg = form.querySelector('.eRemoveImg');
    const dropped = [];                       // 저장이 끝난 뒤 저장소에서 치울 것들
    try {
      if (file) {
        msg.textContent = '사진 올리는 중...';
        const up = await uploadMedia(file, 'posts');
        dropped.push(image_url, thumb_url);    // 갈아치운 옛 사진은 남길 이유가 없다
        image_url = up.url; thumb_url = up.thumbUrl || null;
      } else if (removeImg && removeImg.checked) {
        dropped.push(image_url, thumb_url);
        image_url = null; thumb_url = null;
      }
      const { error } = await sb.from('posts').update({
        author: form.querySelector('.eAuthor').value,
        is_public: form.querySelector('.ePublic').value === 'true',
        title,
        body: form.querySelector('.eBody').value.trim() || null,
        happened_on: form.querySelector('.eWhen').value || null,
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

// 아이가 올린 글은 여기 모인다. 부모가 보고 공개하거나 지운다.
function renderPendingBox(area){
  const waiting = posts.filter(p => p.status === 'pending');
  if (!waiting.length) return;

  const box = document.createElement('div');
  box.className = 'pending-box dot-card';
  box.innerHTML = '<div class="inner"><h3>⏳ 아이가 쓴 글 ' + waiting.length + '개가 기다려요</h3>' +
    '<p class="pending-hint">공개하기를 누르기 전에는 다른 사람에게 보이지 않아요.</p></div>';
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

  // 홈의 「오늘의 질문」에서 넘어오면 그 질문을 제목으로 미리 채워 준다.
  // 질문을 보고 여기까지 왔는데 빈 칸만 있으면 다시 옮겨 적어야 한다.
  const ask = (new URLSearchParams(location.search).get('ask') || '').slice(0, 100);

  if (!isAdmin && !isChild) {
    const box = document.createElement('div');
    box.style.textAlign = 'center';
    box.style.marginBottom = '26px';
    if (ask) {
      const q = document.createElement('p');
      q.style.cssText = 'font-size:15px; font-weight:800; margin:0 0 12px;';
      q.textContent = '💬 ' + ask;
      box.appendChild(q);
    }
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
      (isChild
        ? '<div class="child-note">' + escapeHTML(me.display) +
          (typeof josa === 'function' ? josa(me.display, '이', '가') : '이(가)') + ' 쓰는 일기예요.<br>' +
          '올리면 <b>부모님이 확인한 뒤</b> 다른 사람에게 보여요.</div>' +
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
      '<label class="field">사진 (선택 · 여러 장 가능)</label><input type="file" id="pImage" accept="image/*" multiple>' +
      '<button class="dot-btn primary" id="pSave" style="width:100%; margin-top:18px;">올리기</button>' +
      '<div class="msg" id="pMsg"></div>' +
    '</div>';
  area.appendChild(box);

  // 글쓰기 칸에 서식 도구막대 (일정표 커스텀 탭과 같은 것)
  buildFormatBar($('#pBody'), { fileInput: $('#pImage') });
  renderComposeVoice();

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

  if (ask) {
    $('#pTitle').value = ask;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#pBody').focus({ preventScroll: true });
  }

  $('#pSave').addEventListener('click', async () => {
    const msg = $('#pMsg'), btn = $('#pSave');
    msg.className = 'msg'; msg.textContent = '';
    const title = $('#pTitle').value.trim();
    if (!title) { msg.className = 'msg err'; msg.textContent = '제목을 입력해주세요.'; return; }

    btn.disabled = true;
    const files = Array.from($('#pImage').files);
    let image_url = null, thumb_url = null, extra_images = [], happened_on = $('#pWhen').value || null;
    let audio_url = null, audio_secs = null;
    try {
      if (vDraft) {
        msg.textContent = '목소리 올리는 중...';
        audio_url = await uploadVoice(vDraft.blob, vDraft.ext);
        audio_secs = vDraft.secs;
      }
      for (let i = 0; i < files.length; i++) {
        msg.textContent = '사진 올리는 중... (' + (i+1) + '/' + files.length + ') ' + files[i].name;
        // 있었던 날을 비웠으면 첫 사진의 촬영 날짜를 쓴다 — 지난 일을 나중에 적어도 날짜가 맞게
        if (!happened_on && i === 0) happened_on = await exifDate(files[i]);
        const up = await uploadMedia(files[i], 'posts');
        if (i === 0) { image_url = up.url; thumb_url = up.thumbUrl || null; }
        else extra_images.push({ url: up.url, thumb: up.thumbUrl || null });
      }
      msg.textContent = '저장 중...';
      const { data: { session } } = await sb.auth.getSession();
      const { error } = await sb.from('posts').insert({
        author: $('#pAuthor').value,
        is_public: $('#pPublic').value === 'true',
        status: isChild ? 'pending' : 'published',
        written_by: session ? session.user.id : null,
        title,
        body: $('#pBody').value.trim() || null,
        image_url, thumb_url, extra_images,
        audio_url, audio_secs,
        happened_on,
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
    msg.textContent = isChild ? '올렸어요! 부모님이 확인하면 보여요.' : '올렸어요!';
    $('#pTitle').value = ''; $('#pBody').value = ''; $('#pImage').value = '';
    $('#pWhen').value = ''; $('#pPlace').value = '';
    dropVoiceDraft(); renderComposeVoice();
    loadPosts();
  });

  render();
}

// 주소에 #post-12 가 붙어 오면 그 글로 데려간다.
// 글은 나중에 그려지므로 브라우저가 알아서 못 찾는다 — 다 그린 뒤에 직접 옮긴다.
function jumpToHash(){
  const id = (location.hash || '').match(/^#post-(\d+)$/);
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
