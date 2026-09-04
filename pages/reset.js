// reset.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('');

const MIN_LEN = 8;

function show(id, leadText){
  document.querySelectorAll('.state').forEach(s => s.classList.toggle('on', s.id === id));
  if (leadText) $('#lead').textContent = leadText;
}

// ----- 링크가 실패한 경우 -----
// Supabase 는 실패를 주소 뒤(#error=...)에 붙여 보낸다. 사람이 읽을 수 있게 바꿔 준다.
// location.hash 를 지금 보면 이미 비어 있다 — supabase-js 가 읽고 지운 뒤라서.
// common.js 가 지워지기 전에 챙겨 둔 INITIAL_HASH 를 본다.
function failureFromUrl(){
  const h = new URLSearchParams(String(INITIAL_HASH || '').replace(/^#/, ''));
  const code = h.get('error_code') || h.get('error');
  if (!code) return null;
  const why = h.get('error_description') || '';
  if (/expired/i.test(code + why)) return '이 링크는 시간이 지나 만료됐어요.';
  if (/invalid/i.test(code + why)) return '이 링크는 이미 썼거나 올바르지 않아요.';
  return '링크를 확인하지 못했어요. (' + code + ')';
}

// ----- 준비 -----
(async () => {
  const failed = failureFromUrl();
  if (failed) { show('stBad', '링크를 쓸 수 없어요'); $('#badWhy').textContent = failed; return; }

  // supabase-js 가 주소 뒤의 열쇠를 읽어 세션을 만드는 데 잠깐 걸린다.
  // 바로 물어보면 아직 없다고 나오므로, 생길 때까지 짧게 기다린다.
  let session = null;
  for (let i = 0; i < 20 && !session; i++) {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (!session) await new Promise(r => setTimeout(r, 150));
  }

  if (!session) {
    // 메일 없이도 바꿀 수 있다 — 지금 비밀번호를 알고 있으면 그냥 로그인하면 된다.
    // (Supabase 무료 요금제는 메일을 시간당 몇 통으로 묶어 두어서, 한도에 걸리면
    //  이쪽이 유일하게 바로 되는 길이다.)
    show('stBad', '로그인하고 바꿔도 돼요');
    $('#badWhy').innerHTML =
      '메일 링크로 들어오지 않으셨네요. 그래도 괜찮아요 —<br>' +
      '<b>오른쪽 위 「로그인」</b>을 눌러 지금 비밀번호로 들어오시면 바로 바꿀 수 있어요.';
    return;
  }
  show('stForm', (session.user.email || '') + ' 의 비밀번호를 바꿉니다');
})();

// 화면을 띄운 뒤에 머리말에서 로그인하면 그때 폼으로 바꿔 준다.
// (처음 확인은 이미 지나갔으므로 이게 없으면 안내문만 계속 보인다)
sb.auth.onAuthStateChange((event, session) => {
  if (!session) return;
  if (document.getElementById('stDone').classList.contains('on')) return;   // 다 바꾼 뒤엔 그대로 둠
  show('stForm', (session.user.email || '') + ' 의 비밀번호를 바꿉니다');
});

// ----- 입력 확인 -----
const pw1 = $('#pw1'), pw2 = $('#pw2');
function checkRules(){
  const okLen = pw1.value.length >= MIN_LEN;
  const okSame = pw2.value.length > 0 && pw1.value === pw2.value;
  $('#ruleLen').className = 'rule' + (okLen ? ' ok' : '');
  $('#ruleLen').textContent = (okLen ? '✓' : '·') + ' ' + MIN_LEN + '자 이상';
  $('#ruleSame').className = 'rule' + (okSame ? ' ok' : '');
  $('#ruleSame').textContent = (okSame ? '✓ 같아요' : '· 위와 같아야 해요');
  return okLen && okSame;
}
pw1.addEventListener('input', checkRules);
pw2.addEventListener('input', checkRules);

// ----- 바꾸기 -----
$('#saveBtn').addEventListener('click', async () => {
  const btn = $('#saveBtn'), msg = $('#formMsg');
  msg.className = 'msg'; msg.textContent = '';

  if (pw1.value.length < MIN_LEN) { msg.className = 'msg err'; msg.textContent = MIN_LEN + '자 이상으로 지어주세요.'; return; }
  if (pw1.value !== pw2.value)    { msg.className = 'msg err'; msg.textContent = '두 칸이 서로 달라요.'; return; }

  btn.disabled = true; btn.textContent = '바꾸는 중...';
  const { error } = await sb.auth.updateUser({ password: pw1.value });
  if (error) {
    btn.disabled = false; btn.textContent = '바꾸기';
    msg.className = 'msg err';
    msg.textContent = /weak|short|characters/i.test(error.message)
      ? '더 어려운 비밀번호가 필요해요. 길이를 늘리거나 숫자·기호를 섞어보세요.'
      : '바꾸지 못했어요: ' + error.message;
    return;
  }

  // 지금 이 접속까지 통째로 끊는다.
  //
  // 처음엔 scope:'others' 로 "나만 빼고" 끊었는데, 그게 정확히 거꾸로였다.
  // 메일 링크로 들어와 비밀번호를 바꾸면 지금 이 접속이 바로 그 링크가 만든 것이다.
  // 링크가 새어 나갔을까 봐 바꾸는 건데, 남기는 하나가 하필 그 링크의 접속이 된다.
  // (실제로 그렇게 됐다 — 다른 둘은 끊기고 문제의 하나만 살아남았다.)
  //
  // 실패해도 비밀번호는 이미 바뀐 뒤라 여기서 되돌리지 않고 넘어간다.
  try { await sb.auth.signOut(); } catch (e) {}

  show('stDone', '다 됐어요');
});
