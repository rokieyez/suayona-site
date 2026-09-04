// notes.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('notes');

// 우체통은 아이 둘의 것이다. 짝이 누구인지는 이름으로 정해진다.
// 열쇠는 프로필의 author_key(sua/yona)다. 한글 이름으로 찾고 있어서 아이로
// 들어와도 짝이 없다고 문이 닫혔다 — 쪽지가 한 통도 없던 이유가 이것이었다.
const PAIR = { sua: 'yona', yona: 'sua' };
const NAME = HERO_NAMES;                                             // 정본은 common.js
let myKey = null, youKey = null;

function fmt(iso){
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const p = n => String(n).padStart(2, '0');
  return sameDay
    ? '오늘 ' + p(d.getHours()) + ':' + p(d.getMinutes())
    : (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

async function boot(){
  await refreshAuth();
  myKey = me && me.author_key;
  youKey = PAIR[myKey];
  // 부모로 들어와도 열리지 않는다. 정책도 같은 규칙이라, 화면만 열어 봐야 빈 목록이 온다.
  if (!isChild || !youKey) {
    $('#gate').hidden = false;
    $('#box').hidden = true;
    if (isLoggedIn && !isChild) $('#lead').textContent = '이곳은 수아와 연아만 열 수 있어요';
    return;
  }
  $('#gate').hidden = true;
  $('#box').hidden = false;
  $('#nTo').textContent = NAME[youKey] + '에게';
  $('#lead').textContent = NAME[myKey] + '와 ' + NAME[youKey] + '만 주고받는 쪽지예요';
  await load();
}

async function load(){
  const list = $('#list');
  const { data, error } = await sb.from('sister_notes')
    .select('id, from_who, to_who, body, read_at, created_at')
    .order('created_at', { ascending: false }).limit(60);
  if (error) { list.innerHTML = '<div class="empty-msg">불러오지 못했어요</div>'; return; }
  if (!data.length) { list.innerHTML = '<div class="empty-msg">아직 쪽지가 없어요. 먼저 보내볼까요?</div>'; return; }

  list.innerHTML = '';
  const toRead = [];
  data.forEach(n => {
    const mine = n.from_who === myKey;
    const unread = !mine && !n.read_at;
    if (unread) toRead.push(n.id);
    const el = document.createElement('div');
    el.className = 'dot-card note reveal ' + (mine ? 'mine' : 'theirs') + (unread ? ' unread' : '');
    el.innerHTML =
      (unread ? '<span class="new pixel">NEW</span>' : '') +
      '<div class="head">' + escapeHTML(mine ? '나 › ' + (NAME[n.to_who] || n.to_who) : (NAME[n.from_who] || n.from_who) + ' › 나') +
        ' · ' + escapeHTML(fmt(n.created_at)) + '</div>' +
      '<p class="body">' + escapeHTML(n.body) + '</p>';
    list.appendChild(el);
    revealNow(el);
  });

  // 열어 본 것은 읽음으로 표시한다. 실패해도 그만이라 조용히 넘어간다.
  if (toRead.length) {
    sb.from('sister_notes').update({ read_at: new Date().toISOString() })
      .in('id', toRead).then(() => {}, () => {});
  }
}

$('#nBody').addEventListener('input', () => {
  $('#nCount').textContent = $('#nBody').value.length + ' / 500자';
});

$('#nSend').addEventListener('click', async () => {
  const btn = $('#nSend'), msg = $('#nMsg'), body = $('#nBody').value.trim();
  msg.className = 'msg';
  if (!body) { msg.className = 'msg err'; msg.textContent = '하고 싶은 말을 적어주세요.'; return; }
  btn.disabled = true; msg.textContent = '보내는 중...';
  const { error } = await sb.from('sister_notes')
    .insert({ from_who: myKey, to_who: youKey, body });
  btn.disabled = false;
  if (error) { msg.className = 'msg err'; msg.textContent = '보내지 못했어요: ' + error.message; return; }
  msg.className = 'msg ok'; msg.textContent = '보냈어요!';
  $('#nBody').value = ''; $('#nCount').textContent = '0 / 500자';
  sfx('pop');
  await load();
});

// 헤더의 로그인 상자는 성공하면 페이지를 새로 그린다(common.js) — 따로 붙일 것이 없다.
boot();
initReveal();
