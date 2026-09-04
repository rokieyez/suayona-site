// contact.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('contact');
buildBackdrop('contact');   // 배경 픽셀 겹 (common.js)

// 편지 아이콘
$$('canvas[data-icon]').forEach(cv => {
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sp = SPRITES[cv.dataset.icon];
  if (!sp) return;
  const w = sp[0].length, h = sp.length;
  const s = Math.floor(Math.min(cv.width / w, cv.height / h));
  drawSprite(ctx, sp, Math.floor((cv.width - w*s)/2), Math.floor((cv.height - h*s)/2), s);
});

// ---------- 메일로도 받기 ----------
// 정적 사이트(브라우저)에서는 메일을 직접 보낼 수 없어서, Web3Forms 라는 무료 중계를 거침.
// 이 키는 브라우저에 그대로 노출됨(원래 공개용 키라 정상) — 남용이 걱정되면
// web3forms.com 대시보드에서 허용 도메인을 www.suayona.com 으로 제한할 수 있음.
// 메일 전송이 실패해도 메시지는 항상 Supabase 에 저장되므로 유실되지 않음.
const WEB3FORMS_KEY = '7aa08280-93d3-464e-bdb8-1b03ed713385';
// 받는 사람 주소는 여기 두지 않는다. Web3Forms 대시보드에 등록된 주소로 가므로
// 코드에 적을 이유가 없고, 적어 두면 페이지 소스를 훑는 수집기에 그대로 걸린다.

async function sendMail({ name, contact, body }){
  if (!WEB3FORMS_KEY) return { sent:false, reason:'key-missing' };
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: '[수아·연아 홈페이지] ' + (name || '이름 없음') + '님의 메시지',
        from_name: '수아·연아 홈페이지',
        이름: name || '(없음)',
        답장받을곳: contact || '(없음)',
        내용: body,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { sent: !!data.success, reason: data.message };
  } catch (e) {
    return { sent:false, reason: (e && e.message) || String(e) };
  }
}

// ---------- 글자 수 ----------
// 여기서 막는 것은 알려 주기 위한 것일 뿐이다. 진짜로 막는 곳은 서버다 —
// 이 화면을 건너뛰고 곧장 보낼 수 있으므로, 화면만 믿으면 안 막은 것과 같다.
const MAX = { name: 40, contact: 120, body: 2000 };

function showCount(){
  const n = $('#cBody').value.length;
  const el = $('#cCount');
  el.textContent = n + ' / ' + MAX.body + '자';
  el.className = 'count' + (n >= MAX.body ? ' over' : n > MAX.body * 0.9 ? ' near' : '');
}
$('#cBody').addEventListener('input', showCount);
showCount();

// 서버가 돌려준 말은 사람이 읽기 어렵다. 무엇을 어떻게 고치면 되는지로 바꿔 준다.
function whyRefused(error){
  const m = (error && error.message) || '';
  if (/messages_length/.test(m)) return '글이 너무 길어요. 하고 싶은 말은 ' + MAX.body + '자까지 쓸 수 있어요.';
  if (/편지가 너무 많이/.test(m)) return '지금은 편지가 너무 많이 왔어요. 잠시 뒤에 다시 보내주세요.';
  return '보내지 못했어요: ' + m;
}

// ---------- 목소리 붙이기 ----------
// 녹음기와 올리는 길은 common.js 에 이미 있다(작품 목소리에 쓰던 것).
// 저장소 정책도 suayona/voice/ 아래로만 가족이 올릴 수 있게 열어 두었다.
let voiceRec = null, voiceBlob = null, voiceExt = 'webm';

(async () => {
  await refreshAuth();
  if (!me || !canRecordVoice()) return;      // 로그인 안 했거나 녹음이 안 되는 브라우저
  $('#cVoiceRow').hidden = false;
})();

function resetVoice(){
  voiceBlob = null;
  $('#cVoicePlay').hidden = true;
  $('#cVoicePlay').removeAttribute('src');
  $('#cVoiceDrop').hidden = true;
  $('#cVoiceState').textContent = '';
  $('#cRec').textContent = '🎙 목소리 넣기';
  $('#cRec').classList.remove('coral');
}

$('#cRec') && $('#cRec').addEventListener('click', async () => {
  const btn = $('#cRec'), state = $('#cVoiceState');
  if (voiceRec) {                                   // 녹음 중 → 멈춤
    const { blob, secs } = await voiceRec.stop();
    voiceRec = null;
    voiceBlob = blob;
    btn.textContent = '🎙 다시 녹음'; btn.classList.remove('coral');
    state.textContent = secsLabel(secs) + ' 녹음됨';
    const el = $('#cVoicePlay');
    el.src = URL.createObjectURL(blob); el.hidden = false;
    $('#cVoiceDrop').hidden = false;
    return;
  }
  try {
    voiceRec = await startVoiceRecorder(n => { state.textContent = '● 녹음 중 ' + secsLabel(n); });
    voiceExt = voiceRec.ext;
    btn.textContent = '■ 멈추기'; btn.classList.add('coral');
    state.textContent = '● 녹음 중 0:00';
  } catch (e) {
    state.textContent = '마이크를 쓸 수 없어요';
  }
});

$('#cVoiceDrop') && $('#cVoiceDrop').addEventListener('click', resetVoice);

// ---------- 메시지 보내기 ----------
$('#cSend').addEventListener('click', async () => {
  const msg = $('#cMsg'), btn = $('#cSend');
  msg.className = 'msg'; msg.textContent = '';
  const body = $('#cBody').value.trim();
  if (!body) { msg.className = 'msg err'; msg.textContent = '하고 싶은 말을 적어주세요.'; return; }
  if (body.length > MAX.body) {
    msg.className = 'msg err';
    msg.textContent = '하고 싶은 말은 ' + MAX.body + '자까지 쓸 수 있어요. (지금 ' + body.length + '자)';
    return;
  }

  const name = $('#cName').value.trim().slice(0, MAX.name) || null;
  const contact = $('#cContact').value.trim().slice(0, MAX.contact) || null;

  btn.disabled = true; msg.textContent = '보내는 중...';

  // 목소리를 넣었으면 먼저 올린다. 실패하면 글만이라도 보낸다 —
  // 목소리 때문에 편지 자체가 안 가면 곤란하다.
  let voice_url = null;
  if (voiceBlob) {
    msg.textContent = '목소리 올리는 중...';
    try { voice_url = await uploadVoice(voiceBlob, voiceExt); }
    catch (e) { voice_url = null; }
  }

  // 저장이 우선 — 메일 중계가 실패해도 메시지는 남아 있음
  const { error } = await sb.from('messages').insert({ name, contact, body, voice_url });
  if (error) {
    btn.disabled = false;
    msg.className = 'msg err'; msg.textContent = whyRefused(error);
    return;
  }
  await sendMail({ name, contact, body });

  btn.disabled = false;
  msg.className = 'msg ok'; msg.textContent = '보냈어요! 고마워요 :)';
  $('#cName').value = ''; $('#cContact').value = ''; $('#cBody').value = '';
  resetVoice();
  showCount();
});

// ---------- 관리자: 받은 메시지 확인 ----------
async function loadInbox(){
  const inbox = $('#inbox');
  inbox.innerHTML = '';
  if (!isAdmin) return;

  const { data, error } = await sb.from('messages').select('*').order('created_at', {ascending:false});
  if (error) { inbox.innerHTML = '<div class="empty-msg">불러오기 실패: ' + escapeHTML(error.message) + '</div>'; return; }
  if (!data.length) { inbox.innerHTML = '<div class="empty-msg">받은 메시지가 없어요</div>'; return; }

  data.forEach(m => {
    const el = document.createElement('div');
    el.className = 'letter dot-card';
    el.innerHTML =
      '<div class="meta">' +
        escapeHTML(m.name || '이름 없음') +
        (m.contact ? ' · ' + escapeHTML(m.contact) : '') +
        ' · ' + escapeHTML(formatDate(m.created_at)) +
      '</div>' +
      (m.voice_url ? '<audio controls preload="none" src="' + escapeHTML(m.voice_url) + '" style="width:100%; margin:8px 0;"></audio>' : '') +
      '<div class="body">' + escapeHTML(m.body) + '</div>';
    const actions = document.createElement('div');
    actions.className = 'actions';
    const del = document.createElement('button');
    del.className = 'dot-btn small danger';
    del.textContent = '삭제';
    del.addEventListener('click', async () => {
      if (!confirm('이 메시지를 삭제할까요?')) return;
      const { error } = await sb.from('messages').delete().eq('id', m.id);
      if (error) { alert('삭제 실패: ' + error.message); return; }
      loadInbox();
    });
    actions.appendChild(del);
    el.appendChild(actions);
    inbox.appendChild(el);
  });
}

function renderAdminArea(){
  const area = $('#adminArea');
  area.innerHTML = '';
  if (!isAdmin) {
    const box = document.createElement('div');
    box.style.textAlign = 'center';
    const btn = document.createElement('button');
    btn.className = 'dot-btn small';
    btn.textContent = '📬 받은 메시지 보기 (관리자)';
    btn.addEventListener('click', openAuthModal);   // 로그인 창은 헤더 것 하나만 쓴다
    box.appendChild(btn);
    area.appendChild(box);
    return;
  }
}

(async () => {
  await refreshAuth();
  renderAdminArea();
  loadInbox();
  initReveal();
})();
