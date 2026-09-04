// youtube-preview.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

// 붙여넣은 주소에서 영상 번호만 꺼낸다.
// 일반 주소 / youtu.be 짧은 주소 / Shorts / embed 를 모두 받는다.
function videoId(raw){
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;              // 번호만 붙여넣은 경우
  let u;
  try { u = new URL(s.startsWith('http') ? s : 'https://' + s); } catch (e) { return ''; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return '';
  if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12);
  const v = u.searchParams.get('v');
  if (v) return v.slice(0, 11);
  const m = u.pathname.match(/\/(shorts|embed|v|live)\/([\w-]{11})/);
  return m ? m[2] : '';
}

const $ = s => document.querySelector(s);
const msg = $('#msg');

async function show(raw){
  const id = videoId(raw);
  if (!id) {
    msg.className = 'msg err';
    msg.textContent = '유튜브 주소가 아닌 것 같아요. 영상 페이지의 주소를 그대로 붙여넣어 주세요.';
    return;
  }
  msg.className = 'msg';
  msg.textContent = '영상을 확인하는 중...';

  // 열쇠 없이 제목과 채널 이름을 물어본다.
  // 없는 영상이면 400 을 주므로, 넣기 전에 걸러낼 수 있다.
  let info = null;
  try {
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (res.ok) info = await res.json();
    else if (res.status === 400 || res.status === 404) {
      msg.className = 'msg err';
      msg.textContent = '그런 영상을 못 찾았어요. 비공개 영상이거나 주소가 틀렸을 수 있어요.';
      return;
    }
  } catch (e) { /* 그물이 끊겨도 그림은 붙는다 */ }

  // 미리보기 그림에는 두 종류가 있다.
  //   maxresdefault  1280x720  16:9 — 높은 화질로 찍은 영상에만 있다
  //   mqdefault       320x180  16:9 — 늘 있다
  // hqdefault(480x360)는 늘 있지만 4:3 이라 위아래에 검은 띠가 붙는다.
  // 네모 칸에 맞춰 자르면 그 띠가 그대로 보여서 안 쓴다.
  ['#t1', '#t2', '#t3'].forEach(sel => {
    const img = document.querySelector(sel + ' img');
    if (!img) return;
    img.onerror = () => { img.onerror = null; img.src = 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg'; };
    img.src = 'https://img.youtube.com/vi/' + id + '/maxresdefault.jpg';
  });
  if (info && info.title) {
    ['#c1', '#c2', '#c3'].forEach(sel => { const el = $(sel); if (el) el.textContent = info.title; });
  }

  msg.className = 'msg';
  msg.textContent = info
    ? '넣었습니다 — “' + info.title + '” · ' + info.author_name
    : '그림은 넣었어요. (제목은 못 물어봤습니다 — 그물 상태를 확인해 주세요)';
}

$('#go').addEventListener('click', () => show($('#url').value));
$('#url').addEventListener('keydown', e => { if (e.key === 'Enter') show($('#url').value); });
