// index.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('home');

// ================= 첫 화면이 함께 쓰는 조회 =================
// 아래 조각들이 같은 표를 각자 물어보고 있었다. 「N년 전 오늘」과 「여긴 어디였을까」가
// event_meta 를 한 번씩, 숫자 넷이 표 네 곳에 한 번씩 — 첫 화면 한 번 여는 데 왕복이 열둘.
//
// supabase 의 질의 객체는 await 할 때마다 새로 물어보러 간다. 그래서 객체를 나눠 쓰면
// 소용이 없고, 이렇게 결과 약속(Promise) 자체를 만들어 두고 나눠 써야 한 번만 다녀온다.
// start_date 는 아래 「마을이 아는 우리 이야기」가 쓴다 — 같은 표를 두 번 묻지 않으려고 여기서 함께 받는다.
const metaOnce   = (async () => (await sb.from('event_meta').select('event_id, org_name, event_name, start_date')).data || [])();
const countsOnce = (async () => ((await sb.rpc('home_counts')).data || [])[0] || {})();
// 로그인 확인은 페이지당 한 번이면 된다. 세 군데가 나눠 쓴다.
const authOnce   = refreshAuth().catch(() => null);

// 첫 화면 아래쪽 구획은 화면에 들어올 때 불러온다.
// 열어 보자마자 열한 번을 부르고 있었는데, 스크롤도 안 하고 나가는 사람에게는
// 그중 여섯 번이 통째로 낭비다. 구획이 hidden 이면 크기가 0 이라 자기 자신을
// 지켜볼 수가 없어서, 늘 자리를 차지하는 표식(#belowFold)을 대신 본다.
// 조사 고르기. common.js 의 josa 를 쓰되, 배포 직후 10분 동안은 옛 common.js 와
// 짝이 될 수 있어 없으면 예전 표기로 물러선다.
const J = (w, a, b) => (typeof josa === 'function' ? josa(w, a, b) : a + '(' + b + ')');
const NM = k => (typeof heroName === 'function' ? heroName(k) : k);

const belowFold = (() => {
  const jobs = [];
  let fired = false;
  function run(){
    if (fired) return;
    fired = true;
    jobs.splice(0).forEach(fn => { Promise.resolve().then(fn).catch(() => {}); });
  }
  function arm(){
    const el = document.getElementById('belowFold');
    if (!el || !('IntersectionObserver' in window)) { run(); return; }
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting){ io.disconnect(); run(); }
    }, { rootMargin: '400px' });          // 닿기 조금 전에 미리 부른다
    io.observe(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
  return fn => { if (fired) Promise.resolve().then(fn).catch(() => {}); else jobs.push(fn); };
})();

// ================= N년 전 오늘 =================
// 지난 10년의 "오늘" 하루씩을 시각 범위로 물어본다. 촬영 시각은 UTC 로 저장돼
// 있으니, 이 컴퓨터의 자정~자정을 ISO 로 바꿔 물으면 시차가 알아서 맞는다.
// 사진 전체를 받아 와서 날짜를 고르는 짓은 안 한다 — 해가 갈수록 무거워지는 길이라.
(async () => {
  const now = new Date();
  const spans = [];
  for (let back = 1; back <= 10; back++) {
    const s = new Date(now.getFullYear() - back, now.getMonth(), now.getDate());
    const e = new Date(now.getFullYear() - back, now.getMonth(), now.getDate() + 1);
    spans.push({ back, gte: s.toISOString(), lt: e.toISOString() });
  }
  const orExpr = spans.map(w => 'and(taken_at.gte.' + w.gte + ',taken_at.lt.' + w.lt + ')').join(',');

  // 비공개 이벤트는 서버 정책이 로그인한 가족에게만 돌려준다.
  // 그래서 여기 나온 이벤트 목록이 곧 "이 사람이 봐도 되는 것"의 목록이다.
  // 하루에 한 번만 물어본다. 사진이 있는 날이 1년에 며칠뿐이라 대부분은 0줄이 오고,
  // 그 0줄을 받으려고 700바이트짜리 주소를 매번 보내던 참이었다.
  const memKey = 'sy.mem.' + now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate();
  let cached = null;
  try { const t = sessionStorage.getItem(memKey); if (t) cached = JSON.parse(t); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  if (cached && cached.none) return;

  const [photosRes, metaList] = cached
    ? [{ data: cached.hits }, await metaOnce]
    : await Promise.all([
        sb.from('gallery_media')
          .select('media_url, thumb_url, taken_at, is_best, event_id, media_type')
          .eq('media_type', 'image').or(orExpr),
        metaOnce,
      ]);
  const metas = new Map(metaList.map(m => [m.event_id, m]));
  const hits = (photosRes.data || []).filter(r => metas.has(r.event_id));
  try { sessionStorage.setItem(memKey, JSON.stringify(hits.length ? { hits } : { none: 1 })); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  if (!hits.length) return;                      // 오늘은 겹치는 날이 없다 — 조용히 지나간다

  // 베스트 컷이 있으면 그중에서, 없으면 전체에서 하루 단위로 같은 한 장을 고른다.
  // Math.random 이면 새로고침마다 사진이 바뀌어 "오늘의 기억"이라기 어색하다.
  const pool = hits.some(h => h.is_best) ? hits.filter(h => h.is_best) : hits;
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const pick = pool[seed % pool.length];

  const taken = new Date(pick.taken_at);
  const back = now.getFullYear() - taken.getFullYear();
  const meta = metas.get(pick.event_id);
  const name = [meta.org_name, meta.event_name].filter(Boolean).join(' · ');

  $('#memTitle').textContent = back + '년 전 오늘';
  $('#memImg').src = pick.thumb_url || pick.media_url;
  $('#memWhere').textContent = name || pick.event_id;
  $('#memWhen').textContent = taken.getFullYear() + '. ' + (taken.getMonth()+1) + '. ' + taken.getDate() + '.';
  $('#memCard').href = '/event/e/?slug=' + encodeURIComponent(pick.event_id) + '&tab=gallery';
  document.getElementById('memory').hidden = false;
})().catch(() => {});                            // 이건 덤이다 — 실패해도 홈은 홈이어야 한다

// ================= 히어로 도트 풍경 =================
(function(){
  const canvas = $('#heroCanvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, S = 4, t = 0, scrollY = 0;
  let headerH = 0;                 // 헤더가 캔버스 위에 떠 있어서, 이름표가 그 아래로 내려와야 한다

  // 새 HTML 과 예전 pixel.js 가 짝이 되는 창이 배포 직후 10분쯤 있다 (둘 다 max-age=600).
  // 그때 phaseAt 같은 게 없다고 여기서 죽으면 첫 화면이 통째로 빈 칸이 된다.
  // 없으면 "그냥 낮" 으로 물러나서, 색만 예전 그대로이고 나머지는 다 돌아가게 둔다.
  const HAS_PHASE = typeof PHASES !== 'undefined' && typeof phaseAt === 'function';

  // 지금이 언제인지는 들어온 순간에 한 번만 정한다.
  // 보고 있는 도중에 낮이 밤으로 넘어가면 그게 더 이상하다.
  const PHASE  = HAS_PHASE ? phaseAt() : 'day';
  const SEASON = HAS_PHASE ? seasonAt() : 'summer';
  const NIGHT  = PHASE === 'night';
  // 마을의 시계 — 창에 불이 몇 집이나 켜졌는지, 굴뚝 연기가 얼마나 굵은지는 시각이 정한다.
  // 시간대처럼 들어온 순간에 한 번만 잰다. ?phase= 로 시간대를 억지로 바꾸면 그 시간대의
  // 한가운데 시각으로 치고, ?hour=21.5 처럼 시각만 바꿔 볼 수도 있다.
  const CLOCK = (() => {
    const q = new URLSearchParams(location.search);
    const forced = parseFloat(q.get('hour'));
    const mid = { night: 22, dusk: 18.5, dawn: 6.5, day: 12 };
    const d = new Date();
    const h = !isNaN(forced) ? forced : (q.get('phase') && mid[PHASE] != null) ? mid[PHASE] : d.getHours() + d.getMinutes() / 60;
    // 창불: 해 질 녘엔 드문드문, 저녁엔 거의 다, 자정을 넘기면 몇 집만 남는다
    const litP = h < 5 ? 0.15 : h < 17 ? 0 : h < 18.5 ? 0.3 : h < 22 ? 0.8 : 0.45;
    // 연기: 아침·저녁 밥때 굵고, 낮엔 보통, 한밤엔 실낱
    const smoke = ((h >= 6.5 && h < 9) || (h >= 17 && h < 20.5)) ? 1 : (h >= 11.5 && h < 13.5) ? 0.7 : (h < 5.5 || h >= 23) ? 0.15 : 0.45;
    return { h, litP, smoke };
  })();
  const wash   = sp => HAS_PHASE ? phaseWash(sp, PHASE) : undefined;   // 밤이면 스프라이트 색을 물 뺀다
  const paint  = (fn) => HAS_PHASE ? withPhase(PHASE, fn) : fn();
  const DAY_SEED = (() => { const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();

  // 캐릭터를 누르면 이름이 잠깐 떴다 사라진다.
  // 소개를 메뉴에서 뺀 대신, 궁금할 때 직접 눌러 보게 하는 자리.
  // hits 는 그릴 때마다 다시 채운다 — 캐릭터가 화면 폭에 따라 자리를 옮기기 때문에
  // 좌표를 미리 박아 둘 수가 없다. 그린 그 자리가 곧 누를 자리다.
  let hits = [];
  const view = { gx: 0, gy: 0 };                        // 마을 그림이 캔버스에 놓인 자리 — 누른 곳을 마을 도트로 되돌릴 때 쓴다
  // ---- 마을 ----
  // 풍경은 village.js 가 한 장으로 그린다 (건물·길·나무·개울). 여기서는 그 위에 놀이를 얹는다.
  // VG 는 그 그림과, 놀이를 얹을 자리들(도트 단위)을 들고 있다.
  let VG = null;
  let HS = 2;                                           // 마을 도트 한 개가 몇 px 인가
  let panX = 0, panMax = 0;                             // 좁은 화면에서는 마을이 화면보다 넓다 — 끌어서 본다
  const TITLE_H = 108;                                  // 헤더 아래 제목 두 줄이 차지하는 하늘 띠
  const VILLAGE_TILES = 26;                             // 마을 땅의 가로+세로 칸 수 (14+12) — 아래 꼭짓점 자리를 재는 데 쓴다
  const tagBox = $('#heroTags');
  let nameTag = null;                                   // { text, x, y, at }
  const TAG_IN = 140, TAG_HOLD = 1700, TAG_OUT = 340;   // 뜨고 · 머물고 · 사라지고 (ms)
  const TAG_LIFE = TAG_IN + TAG_HOLD + TAG_OUT;

  // 처음 누르면 이름을 알려 주고, 그 다음부터는 한 마디씩 한다.
  // 이름을 한 번은 보여 줘야 누가 누군지 알 수 있고, 그 뒤로도 계속 이름만 나오면
  // 두 번 누를 이유가 없다.
  const LINES = {
    '상그렐라': ['상그상그~', '꽥!', '뎅굴뎅굴', '난 오리야', '어지러워~', '꽥꽥', '꽤애액?!'],
    '수아':     ['아 연아야...', '꺼억~', '미안해', '홍홍홍~', '아이디어가 안떠오르네...',
                 '피아노가 안보이네', '날씨 좋다!'],
    '연아':     ['뿡~', '레샤 귀여워!', '아 언니이!', '햐~ 날씨도 좋코~', '사냥이나 해볼까?',
                 '아빠 가죽벗겨!', '카페가자~'],
    '레샤':     ['뀨?', '뀨웅~', '뀌잉?', '뀽??', '뀨우우~', '뀩!', '뀨뀨~'],
    '미미':     ['짹?', '짹짹!', '짹짹짹~', '째애애애액~', '....', '멀리 떠나고 싶다~'],
  };

  // 소품이 내는 소리. 사람이 아니니 이름 대신 의성어만 낸다.
  const PROP_LINES = {
    house: ['똑똑!', '아무도 없어요?', '우리 집이야'],
    tree:  ['바스락', '흔들흔들', '나뭇잎이 떨어졌다'],
    bench: ['삐걱', '여기 앉을래?'],
    sun:   ['쨍!', '눈부셔!', '오늘도 맑음'],
    moon:  ['잘 자~', '반짝', '쉿, 다들 자는 중'],
    cloud: ['뭉게뭉게', '폭신폭신', '어디 가는 길이야?'],
    star:  ['반짝', '✦'],
    castle:     ['두둥!', '용사님, 어서 오세요', '성문은 열려 있어요'],
    fountain:   ['첨벙', '시원해~', '동전 던질래?'],
    tent:       ['둥둥~', '축제다!', '표 사세요~'],
    windmill:   ['빙글빙글', '바람이 분다~'],
    well:       ['똑, 똑', '깊다~', '메아리~'],
    lotte:      ['롯데타워'],
    nseoul:     ['남산타워'],
    post:       ['편지 왔어요!', '우표 붙였어?'],
    gallery:    ['쉿, 전시 중', '이 그림 누가 그렸게?'],
    boat:       ['출렁', '노 저어라~'],
    bridge:     ['삐걱삐걱', '건너가요'],
    greenhouse: ['따뜻해', '무럭무럭'],
    shed:       ['삽 어디 갔지?', '덜컹'],
    stall:      ['사과 사세요~', '딸기 한 알?'],
    sign:       ['이쪽!', '저쪽?'],
    ruler:      ['키 재 볼까?', '얼마나 컸을까'],
    lamp:       ['딸깍', '불 켜졌다'],
    butterfly:  ['팔랑팔랑', '꽃 좋아해', '살랑~'],
  };

  // 아무도 안 눌러 주면 먼저 말을 건다.
  // 이 화면에서 누를 수 있다는 걸 알려 주는 건 마우스 커서뿐이라, 폰에서는
  // 대사가 있다는 사실조차 알기 어려웠다. 한 번만 스스로 말하면 규칙이 전달된다.
  const GREET = {
    dawn:  ['잘 잤어?', '아침이다!', '하암~ 벌써 아침이야?'],
    day:   ['나 눌러봐!', '안녕!', '오늘 뭐 할까?', '여기 눌러도 돼'],
    dusk:  ['해가 지네', '노을 예쁘다', '집에 갈 시간인가?'],
    night: ['별 보인다!', '아직 안 자?', '쉿... 조용히', '밤이야'],
  };
  const BACK_LINES = ['오랜만이야!', '어디 갔었어?', '기다렸어!'];

  // 누른 횟수와 방금 한 말을 캐릭터마다 따로 센다 —
  // 수아를 두 번 눌렀다고 해서 연아까지 이름을 건너뛰면 안 되니까.
  const said = {};

  function pickLine(lines, memo){
    if (!lines || !lines.length) return '';
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && memo && i === memo.last) i = (i + 1) % lines.length;
    if (memo) memo.last = i;
    return lines[i];
  }

  function speak(name){
    const lines = LINES[name];
    const s = said[name] || (said[name] = { n: 0, last: -1 });
    s.n++;
    if (s.n === 1 || !lines || !lines.length) return name;
    // 방금 한 말은 다시 안 고른다. 예닐곱 마디뿐이라 그냥 뽑으면
    // 같은 말이 연달아 나오는 일이 일곱 번에 한 번씩 생긴다.
    return pickLine(lines, s);
  }

  const clouds = [
    { x:0.05, y:0.13, sp:0.010, sc:1.6, depth:0.20 },
    { x:0.42, y:0.07, sp:0.016, sc:1.2, depth:0.30 },
    { x:0.72, y:0.19, sp:0.008, sc:1.4, depth:0.16 },
    { x:0.22, y:0.26, sp:0.014, sc:1.0, depth:0.40 },
    { x:0.58, y:0.31, sp:0.011, sc:0.8, depth:0.50 },
    { x:0.88, y:0.36, sp:0.006, sc:0.7, depth:0.55 },
    { x:0.12, y:0.38, sp:0.019, sc:0.6, depth:0.60 },
  ];
  const birds = [
    { x:0.20, y:0.20, sp:0.05 }, { x:0.26, y:0.24, sp:0.05 }, { x:0.32, y:0.18, sp:0.05 },
  ];

  // 계절마다 하늘에서 떨어지는 것. 배열로 들고 있지 않고 t 의 함수로 그린다 —
  // 개수가 고정이고 되돌릴 일이 없어서 상태를 둘 이유가 없다.
  const FALLS = {
    spring: { n:26, speed:0.55, drift:1.6, colors:['#ffb7d5', '#ff8fc0', '#fff0f6'] },
    summer: null,
    autumn: { n:22, speed:0.75, drift:1.2, colors:['#e8912f', '#d4622a', '#f2b544'] },
    winter: { n:40, speed:0.45, drift:0.9, colors:['#ffffff', '#eaf6ff', '#cfe9fa'] },
  };
  const BCOL = ['#ff7f8a', '#ffd979', '#6cc7b3', '#5aa9e6', '#b9a3d6', '#ff9aa2'];   // 풍선·색종이 색
  FALLS.party = { n:34, speed:0.7, drift:1.8, colors:BCOL };                  // 생일 색종이
  const FALL = FALLS[SEASON];
  // 생일이면 색종이, 눈 오면 눈, 비 오면 아무것도(비는 따로 그린다), 아니면 계절 것.
  const fallNow = () => BIRTHDAY ? FALLS.party : weather.snow ? FALLS.winter : raining() ? null : FALL;

  // ---- 소리 ----
  // 소리통은 common.js 로 옮겼다 — 전시실·그리기도 같은 것을 쓰고,
  // 껐다 켠 것(sy.mute)도 한 곳에서 기억한다. 여기서는 부르기만 한다.

  wireSoundButton($('#soundHud'));
  // 손전등 단추는 밤에만 나온다.
  const torchHud = $('#torchHud');
  if (torchHud && NIGHT) {
    torchHud.hidden = false;
    torchHud.addEventListener('click', () => {
      torch = !torch;
      torchHud.classList.toggle('on', torch);
      sfx(torch ? 'star' : 'prop');
      kick();
    });
  }

  // 인터넷이 끊기면 알려 준다. 서비스 워커가 그리기를 미리 담아 두어서 그때도 열린다 —
  // 「지금 아무것도 안 된다」가 아니라 「이건 된다」를 보여 주는 자리다.
  const offHud = $('#offHud');
  function syncOnline(){ if (offHud) offHud.hidden = navigator.onLine !== false; }
  syncOnline();
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);

  // 폰에서는 마을이 화면보다 넓다. 끌 수 있다는 것을 처음 한 번만 알려 준다 —
  // 꼬리표 여덟 중 셋이 화면 밖에 있어서, 모르면 그 셋은 없는 것이나 같다.
  const panHint = $('#panHint');
  const PAN_HINT_KEY = 'sy.panhint';
  let panHintOff = false;
  try { panHintOff = localStorage.getItem(PAN_HINT_KEY) === '1'; } catch (e) { /* 저장이 막힌 브라우저 — 힌트는 덤이다 */ }
  function hidePanHint(){
    if (!panHint || panHint.hidden) return;
    panHint.hidden = true;
    try { localStorage.setItem(PAN_HINT_KEY, '1'); } catch (e) { /* 위와 같은 이유 */ }
  }
  function maybePanHint(){
    if (!panHint || panHintOff || panMax <= 0) return;
    panHint.hidden = false;
    setTimeout(hidePanHint, 6000);
  }

  // 눌렀을 때 톡 튀어나오는 하트와 별
  let pops = [];
  function popAt(x, y, sp, n){
    for (let i = 0; i < (n || 5); i++) pops.push({
      x, y, sp,
      vx: (Math.random() - 0.5) * 1.8,
      vy: -1.1 - Math.random() * 1.3,
      life: 1,
    });
  }

  // ---- 숨은 친구 ----
  // 하루에 세 마리만, 절반쯤 잘린 채로 수풀에 섞여 있다. 자리는 날짜로 정하므로
  // 자매 둘이 같은 날 같은 자리에서 같은 친구를 찾는다.
  // 계절마다 나오는 친구가 다르다 — 봄에 나비, 가을에 다람쥐. 자리는 날마다 바뀌고
  // 얼굴은 계절마다 바뀌어서, 하루도 어제와 같지 않고 석 달 뒤에는 아예 다른 마을이 된다.
  const SECRET_KINDS = [
    { key:'cat',      sp:SPRITES.cat,      label:'고양이',   line:'야옹!',           when:['winter', 'autumn'] },
    { key:'squirrel', sp:SPRITES.squirrel, label:'다람쥐',   line:'또르르',          when:['autumn', 'winter'] },
    { key:'snail',    sp:SPRITES.snail,    label:'달팽이',   line:'느릿... 느릿...', when:['spring', 'summer'] },
    { key:'mushroom', sp:SPRITES.mushroom, label:'버섯',     line:'뽕!',             when:['autumn', 'summer'] },
    { key:'ladybug',  sp:SPRITES.ladybug,  label:'무당벌레', line:'톡',              when:['spring', 'summer'] },
    { key:'butterfly',sp:SPRITES.butterfly,label:'나비',     line:'팔랑팔랑',        when:['spring', 'summer'] },
    { key:'fox',      sp:SPRITES.fox,      label:'여우',     line:'캥!',             when:['winter', 'autumn'] },
    { key:'bird',     sp:SPRITES.bird,     label:'새',       line:'짹짹',            when:['spring', 'winter'] },
    { key:'crab',     sp:SPRITES.crab,     label:'게',       line:'집게집게',        when:['summer'] },
  ].filter(k => k.sp);                       // 예전 pixel.js 와 짝이 되면 그림이 없다 (위 HAS_PHASE 와 같은 이유)
  // 마을의 숨을 자리 일곱 곳 — 번호만 고르고 자리는 village.js 가 안다
  // (벤치 뒤, 미술관 앞 덤불, 술통 뒤, 광장 화단, 건초 더미, 성벽 위, 풍차 옆 덤불)
  const SECRET_SPOTS = [0, 1, 2, 3, 4, 5, 6];
  const FOUND_KEY = 'sy.found.' + DAY_SEED;
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(FOUND_KEY) || '[]')); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  const secrets = (() => {
    // 이 계절에 나오는 얼굴부터. 셋이 안 되면 나머지에서 채운다 — 빈 날은 없어야 한다.
    const inSeason = SECRET_KINDS.filter(k => k.when.indexOf(SEASON) >= 0);
    const rest = SECRET_KINDS.filter(k => k.when.indexOf(SEASON) < 0);
    const kinds = inSeason.concat(rest.slice(0, Math.max(0, 3 - inSeason.length)));
    const spots = SECRET_SPOTS.slice(), out = [];
    const n = Math.min(3, kinds.length);
    for (let i = 0; i < n; i++) {
      const k = kinds.splice(Math.floor(prand(DAY_SEED + i * 3.1) * kinds.length), 1)[0];
      const s = spots.splice(Math.floor(prand(DAY_SEED + i * 7.7) * spots.length), 1)[0];
      out.push(Object.assign({}, k, { spot: s }));
    }
    return out;
  })();

  // ---- 오늘의 숨바꼭질 ----
  // 하루에 한 번, 연아가 마을 어딘가에 숨는다. 숨은 친구가 쓰지 않은 자리 중에서 날짜로 고르므로
  // 자매가 같은 날 같은 자리를 뒤진다. 생일에는 숨지 않는다 — 주인공이 없으면 잔치가 안 된다.
  const HIDE_KEY = 'sy.hide.' + DAY_SEED;
  const HIDE_LINES = ['연아가 숨었어! 찾아 줘', '연아 어디 갔지?', '숨바꼭질 중이야'];
  let yonaFound = false;
  try { yonaFound = localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { /* 저장이 막힌 브라우저 — 올 때마다 새로 숨는다 */ }
  // 자리는 처음 물어볼 때 정한다 — 생일 여부(BIRTHDAY)가 이 줄보다 아래에서 정해진다
  let hideSpot;
  function hideSpotOf(){
    if (hideSpot === undefined) {
      const used = secrets.map(x => x.spot);
      const free = SECRET_SPOTS.filter(i => used.indexOf(i) < 0);
      hideSpot = (BIRTHDAY || !free.length) ? -1 : free[Math.floor(prand(DAY_SEED + 11.3) * free.length)];
    }
    return hideSpot;
  }
  const hiding = () => hideSpotOf() >= 0 && !yonaFound;

  // ---- 밤 산책: 반딧불이 잡기 ----
  // 여름밤(또는 손전등을 켠 밤)에만 난다. 누르면 병에 담기고, 그 밤 동안 그대로 남는다.
  // 날마다 새로 태어난다 — 어제 다 잡았다고 오늘 밤이 심심하면 안 된다.
  const FLY_KEY = 'sy.flies.' + DAY_SEED;
  let caughtFlies = new Set();
  try { caughtFlies = new Set(JSON.parse(localStorage.getItem(FLY_KEY) || '[]')); } catch (e) { /* 저장이 막힌 브라우저 — 그 자리에서만 센다 */ }
  const flyPos = [];                                    // 이번 장에 떠 있는 자리 (누를 자리)

  const hud = $('#findHud');
  function syncHud(){
    if (!hud) return;
    const all = secrets.length;
    if (!all) { hud.hidden = true; return; }
    const n = secrets.filter(s => found.has(s.key)).length;
    hud.textContent = (n >= all ? '🔍 다 찾았다!' : '🔍 숨은 친구 ' + n + '/' + all) +
                      (hiding() ? ' · 🙈 연아' : '') +
                      (caughtFlies.size ? ' · ✨' + caughtFlies.size : '') +
                      (keys.size ? ' · 🔑' + keys.size : '');
    hud.classList.toggle('done', n >= all);
  }

  // ---- 심어 둔 꽃 ----
  // 잔디밭을 누르면 그 자리에 꽃이 핀다. 내 화면에만 피는 게 아니라 남는다 —
  // 할머니가 심고 간 꽃을 아이가 본다.
  let planted = [];                       // { xr, yr, k }
  let plantAt = 0, plantedHere = 0;       // 도배 방지: 간격과 한 번 방문당 개수
  let steps = [];                         // 길 위의 발자국 { xr, yr, dir, at } — 하루면 사라진다
  let stepAt = 0, steppedHere = 0;

  // ---- 이젤에 걸린 그림 ----
  let easelImg = null, easelHref = null, easelRect = null;
  // 그림에 아이 목소리가 붙어 있으면 이젤을 눌렀을 때 그게 나온다
  let easelAudio = null, easelLine = '', audioEl = null;

  // ---- 걸어 둔 도트 그림 ----
  // draw.html 에서 "액자에 걸기" 한 그림. 이 브라우저에만 있다 — 가족 폰에서 걸면 가족 폰에서 보인다.
  const hung = [1, 2].map(n => {
    try { const raw = localStorage.getItem('sy.hang.' + n); const h = raw && JSON.parse(raw);
          return h && h.n && h.s ? h : null; } catch (e) { return null; }
  });

  // ---- 진짜 날씨 ----
  // open-meteo 는 열쇠 없이 좌표만 주면 된다. 풍경에 남산타워가 있으니 서울시청으로 둔다.
  // 실패하면 조용히 계절 기본값으로 — 날씨는 덤이다.
  const WEATHER_AT = { lat: 37.5665, lng: 126.9780 };
  const weather = { rain:false, snow:false, fog:false, wind:1 };
  let shower = 0;                                        // 해를 열 번 누르면 오는 소나기가 끝나는 시각
  // 소나기가 그친 뒤 30초 동안 뜨는 무지개.
  // ?rainbow=1 을 붙이면 비를 부르지 않고도 볼 수 있다 (?phase= 와 같은 이유).
  const RAINBOW_MS = 30000;
  const rainbowPreview = !!new URLSearchParams(location.search).get('rainbow');
  let rainbowFrom = 0, rainbowUntil = 0;
  let torch = false;                                     // 밤에 켜는 손전등
  const raining = () => weather.rain || performance.now() < shower;
  let snowPainted = false;                               // 마을 그림에 눈을 구워 넣었는지
  let ct = 0;                                            // 구름 전용 시계 — 바람이 세면 빨리 간다
  // ?weather=rain|snow|fog|wind 로 미리 볼 수 있다 (phase·season 과 같은 이유)
  const forcedW = new URLSearchParams(location.search).get('weather');
  if (forcedW === 'rain') weather.rain = true;
  else if (forcedW === 'snow') weather.snow = true;
  else if (forcedW === 'fog') weather.fog = true;
  else if (forcedW === 'wind') weather.wind = 2.2;
  else fetch('https://api.open-meteo.com/v1/forecast?latitude=' + WEATHER_AT.lat + '&longitude=' + WEATHER_AT.lng +
        '&current=weather_code,wind_speed_10m&timezone=Asia%2FSeoul')
    .then(r => r.json()).then(j => {
      const c = j.current || {}, code = c.weather_code;
      if (typeof code !== 'number') return;
      weather.rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
      weather.snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
      weather.fog  = code === 45 || code === 48;
      weather.wind = c.wind_speed_10m > 25 ? 2.2 : c.wind_speed_10m > 12 ? 1.5 : 1;
      // 눈은 지붕마다 그리는 것이 아니라 마을 그림 한 장에 통째로 굽는다. 날씨는 늦게
      // 도착하므로, 눈 여부가 바뀌었을 때만 마을을 한 번 더 그린다(300ms 짜리라 아껴 쓴다).
      if (weather.snow !== snowPainted) paint(() => paintGround());
      kick();
    }).catch(() => {});

  // ---- 생일 ----
  // 'MM-DD'. 비워 두면 그냥 안 켜진다. 주소에 ?birthday=수아 를 붙이면 미리 볼 수 있다.
  const BIRTHDAYS = { '수아': '07-09', '연아': '03-19' };
  const BIRTHDAY = (() => {
    const q = new URLSearchParams(location.search).get('birthday');
    if (q && BIRTHDAYS.hasOwnProperty(q)) return q;
    const d = new Date();
    const md = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return Object.keys(BIRTHDAYS).find(n => BIRTHDAYS[n] === md) || null;
  })();
  const CONGRATS = ['생일 축하해!', '🎂 생일이다!', '축하축하~', '케이크 먹자!', '선물은?'];
  let bdayFoot = null;                                   // 생일인 아이의 발밑 — 케이크를 놓을 자리

  // ---- 던지기 기록 ----
  // 상그렐라를 던진 거리. 화면 폭을 10m 로 친다 — 폰과 모니터에서 같은 던지기가 같은 기록이 되게.
  // 표시할 자리는 따로 두지 않는다. 신기록이 나오면 상그렐라가 직접 말한다.
  const bestThrow = () => { try { return Number(localStorage.getItem('sy.throw.best') || 0); } catch (e) { return 0; } };

  // ---- 열쇠 (순서를 맞춰야 열리는 비밀) ----
  // 안내 없이 숨겨 둔다. 찾은 건 남아서 표시에 🔑 로 붙는다.
  let keys = new Set();
  try { keys = new Set(JSON.parse(localStorage.getItem('sy.keys') || '[]')); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  const taps = {};                                       // { key: [시각들] }
  let doorOpen = 0, meteorAt = 0;
  function countTap(key, need, within){
    const now = performance.now();
    const list = (taps[key] = (taps[key] || []).filter(x => now - x < within));
    list.push(now);
    if (list.length < need) return false;
    taps[key] = [];
    return true;
  }
  function unlock(key, hit, text){
    const fresh = !keys.has(key);
    keys.add(key);
    try { localStorage.setItem('sy.keys', JSON.stringify(Array.from(keys))); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    popAt(hit.x, hit.y, SPRITES.star, fresh ? 9 : 4);
    if (fresh) sfx('key');
    say(fresh ? '🔑 비밀 발견! ' + text : text, hit);
    syncHud();
  }

  // ---- 둘이 대화 ----
  // 한 명을 누르고 5초 안에 다른 한 명을 누르면, 그 둘의 대화가 이어진다.
  const TALKS = [
    { who:['수아','연아'], lines:[['수아','연아야 내 색연필 봤어?'],['연아','몰라~'],['수아','아까 네가 썼잖아'],['연아','...레샤가 가져갔어'],['수아','아 연아야...']] },
    { who:['수아','연아'], lines:[['연아','언니 뭐 그려?'],['수아','비밀'],['연아','고래지?'],['수아','...어떻게 알았어'],['연아','맨날 고래잖아']] },
    { who:['수아','연아'], lines:[['수아','카페 갈래?'],['연아','카페가자~'],['수아','아빠한테 물어봐'],['연아','언니가 물어봐'],['수아','꺼억~']] },
    { who:['연아','레샤'], lines:[['연아','레샤 귀여워!'],['레샤','뀨?'],['연아','사냥 갈까?'],['레샤','뀨우우~'],['연아','알았어 안 가']] },
    { who:['수아','상그렐라'], lines:[['수아','상그렐라 어지럽지 않아?'],['상그렐라','뎅굴뎅굴'],['수아','그만 굴러'],['상그렐라','꽤애액?!'],['수아','미안해']] },
    { who:['연아','상그렐라'], lines:[['연아','상그렐라 뿡~'],['상그렐라','꽥!'],['연아','햐~ 날씨도 좋코~'],['상그렐라','상그상그~']] },
    { who:['미미','수아'],  lines:[['미미','짹짹!'],['수아','미미야 내려와'],['미미','멀리 떠나고 싶다~'],['수아','피아노 치면 올 거야?'],['미미','....']] },
    { who:['미미','연아'],  lines:[['연아','미미 어디 가?'],['미미','째애애애액~'],['연아','아 언니이! 미미 좀 봐'],['미미','짹?']] },
    { who:['레샤','상그렐라'], lines:[['레샤','뀽??'],['상그렐라','꽥꽥'],['레샤','뀨뀨~'],['상그렐라','난 오리야']] },
  ];
  let lastTap = null;                                    // { name, at }
  let talk = null;                                       // { lines, i }
  function nextLine(){
    if (!talk || talk.i >= talk.lines.length) { talk = null; return; }
    const [name, text] = talk.lines[talk.i++];
    const h = hits.find(x => x.kind === 'char' && x.name === name);
    if (!h) { talk = null; return; }
    say(text, h);
    nameTag.onEnd = nextLine;
  }

  // 배경은 매 프레임 다시 그리기엔 무거워서, 크기가 바뀔 때만 한 번 그려두고 재사용함.
  // sky = 하늘(고정). 마을은 village.js 가 그린 캔버스(VG.canvas)를 그대로 쓴다.
  const skyLayer = document.createElement('canvas');
  const torchLayer = document.createElement('canvas');   // 손전등의 어둠을 따로 만드는 판
  let horizon = 0, charS = 4;

  function resize(){
    // 폰에서 주소창이 접히고 펴질 때마다 resize 가 온다. 크기가 그대로면 300ms 짜리 마을 그리기를 되풀이하지 않는다
    if (VG && W === canvas.clientWidth && H === canvas.clientHeight) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    S = W < 640 ? 4 : 5;
    const hdr = document.querySelector('header.site');
    headerH = hdr ? Math.round(hdr.getBoundingClientRect().height) : 0;
    // 마을 배율. 집 꼭대기(뒤 꼭짓점 위 74도트)부터 절벽 밑(아래 352도트)까지 426도트가
    // 헤더 아래에서 화면 밑 여백 위까지 들어가게 한다. 폰에서는 1배쯤으로 두고 좌우로 끌어 본다.
    // 제목 띠(헤더 아래 108px)는 비워 둔다 — 마을 지붕이 제목 글자에 걸리면 둘 다 안 읽힌다
    HS = W < 700 ? Math.max(1, Math.min(1.4, W / 460)) : Math.max(1.2, Math.min(2.6, (H - headerH - TITLE_H - 40) / 426));
    const vw = Math.max(Math.ceil(W / HS), 660);
    panMax = Math.max(0, Math.round(vw * HS - W));
    panX = panMax ? Math.max(-panMax, Math.min(0, panX || -Math.round(panMax / 2))) : 0;
    charS = Math.max(2, Math.round(S * 0.85));
    planted.forEach(f => { delete f.dot; });             // 꽃 자리는 다시 푼다 — 원점이 옮겨졌다
    steps.forEach(s => { delete s.dot; });
    snowmen.forEach(m => { delete m.dot; });

    [skyLayer, torchLayer].forEach(c => {
      c.width = Math.floor(W * dpr); c.height = Math.floor(H * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, H);
    });
    // 하늘은 지금 칠하고, 마을은 다음 장으로 미룬다. 마을 한 장을 그리는 데 200ms 가 걸려서
    // (폰 375px 기준, 잰 값) 여기서 곧바로 그리면 그 200ms 동안 화면이 아예 안 뜬다.
    // 미루면 하늘·제목·아이들이 먼저 뜨고 마을이 한 장 뒤에 채워진다 — 마을이 아직 없는
    // 상태는 원래부터 그릴 수 있게 돼 있다(배포 직후 스크립트가 어긋나는 10분을 위해).
    paint(() => paintSky());
    scheduleGround();
  }

  // 크기가 여러 번 바뀌어도 마을은 한 번만 다시 그린다.
  // 숨은 탭에서는 rAF 가 아예 안 오므로 시계로도 한 번 더 재촉한다 — 둘 중 먼저 온 쪽이 그린다.
  let groundPend = false;
  function scheduleGround(){
    if (groundPend) return;
    groundPend = true;
    const run = () => { if (!groundPend) return; groundPend = false; paint(() => paintGround()); draw(); };
    requestAnimationFrame(run);
    setTimeout(run, 400);
  }

  function paintSky(){
    const g = skyLayer.getContext('2d');
    drawSkyBands(g, W, H, S, [
      { at:0.00, color:SCENE.sky[0] }, { at:0.18, color:SCENE.sky[1] },
      { at:0.36, color:SCENE.sky[2] }, { at:0.54, color:SCENE.sky[3] },
      { at:0.70, color:SCENE.sky[4] }, { at:0.86, color:SCENE.sky[5] },
      { at:1.00, color:SCENE.sky[6] },
    ]);
    if (NIGHT) drawStars(g, W, H, S, Math.round(W / 14), 0);   // NIGHT 는 HAS_PHASE 일 때만 참이다
  }

  // 색을 반투명으로
  const hexA = (hex, a) => 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')';

  /* ---- 첫화면이 비추는 진짜 농장 ----
     farm_cards() 는 손님도 부를 수 있는 요약이다(아이가 언제 왔는지 같은 것은 안 들어 있다).
     한 번만, 그것도 화면이 다 그려진 뒤 한가할 때 부른다 — 첫 그림을 늦추지 않는다.
     못 읽으면(손님이거나 서버가 안 되면) 이름표는 그냥 「농장」으로 남는다.
     마을 그림 자체를 바꾸지 않은 까닭: Village.render 한 번이 이 기계에서 250ms 다.
     밭 그림을 갈아 끼우려면 마을을 통째로 다시 그려야 해서 첫화면이 그만큼 멈춘다. */
  let farmLive = null;
  const FARM_SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const FARM_SEASON_KO = { spring: '🌷 봄', summer: '🌻 여름', autumn: '🍁 가을', winter: '⛄ 겨울' };
  function farmDayIndex(started){
    if (!started) return null;
    const [y, m, d] = String(started).split('-').map(Number);
    if (!y || !m || !d) return null;
    const a = new Date(y, m - 1, d), n = new Date();
    return Math.max(0, Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - a) / 86400000));
  }
  function farmLine(c){
    const bits = [];
    const idx = farmDayIndex(c.started);
    const len = Math.max(3, Number(c.seasonLen) || 7);
    if (idx != null){
      const si = Math.floor(idx / len);
      bits.push(FARM_SEASON_KO[FARM_SEASONS[si % 4]] + ' ' + (Math.floor(si / 4) + 1) + '년째');
    }
    const crops = Number(c.crops) || 0, animals = Number(c.animals) || 0;
    bits.push(crops ? '밭에 ' + crops + '포기' : '밭이 비었어요');
    if (animals) bits.push('동물 ' + animals + '마리');
    return bits.join(' · ');
  }
  function loadFarmLive(){
    if (typeof sb === 'undefined' || !sb) return;
    sb.rpc('farm_cards').then(({ data }) => {
      if (!data || typeof data !== 'object') return;
      farmLive = farmLine(data);
      layoutTags();
    }).catch(() => {});
  }
  if (window.requestIdleCallback) requestIdleCallback(loadFarmLive, { timeout: 3000 });
  else setTimeout(loadFarmLive, 1200);

  // 마을 이름표 — 집 위에 떠 있는 메뉴. 캔버스가 아니라 링크라서 눌리고, 읽히고, 탭으로 옮겨 다닌다.
  function layoutTags(){
    if (!tagBox) return;
    tagBox.innerHTML = '';
    if (!VG) return;
    VG.labels.forEach(l => {
      const a = document.createElement('a');
      a.className = 'tag'; a.href = l.href; a.textContent = l.text;
      a.style.left = Math.round(l.x * HS) + 'px';
      a.style.top = Math.round(l.y * HS) + 'px';
      // 농장 이름표만은 지금 밭 소식을 한 줄 달고 있다 — 마을이 진짜 농장을 비추도록
      let live = null;
      if (l.href === '/farm.html' && farmLive){
        live = document.createElement('span'); live.className = 'live';
        live.textContent = farmLive;                 // 서버가 준 숫자뿐이지만 글로 넣는다
        a.appendChild(live);
      }
      tagBox.appendChild(a);
      /* 이름표는 아래 끝을 기준으로 위로 자란다(translate -100%). 한 줄이 늘면 그만큼 위로
         올라가 수아를 덮는다 — 늘어난 높이만큼 도로 내려서 이름 줄은 제자리에 둔다. */
      if (live) a.style.top = Math.round(l.y * HS) + live.offsetHeight + 3 + 'px';
    });
    moveTags(0);
  }
  function moveTags(gy){ if (tagBox) tagBox.style.transform = 'translate(' + panX + 'px,' + gy + 'px)'; }

  function paintGround(){
    // 배포 직후 HTML 과 village.js 가 짝이 안 맞는 10분 — 하늘과 아이들만 나오고 마을은 비어 있다
    if (typeof Village === 'undefined') { VG = null; layoutTags(); return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = Math.ceil((W + panMax) / HS), vh = Math.ceil(H / HS);
    // 땅 뒤 꼭짓점 — 가로는 마을이 가운데, 세로는 헤더 밑에서 가장 높은 지붕(74도트)만큼 내려온 곳
    const orgY = Math.round((headerH + TITLE_H) / HS) + 74;
    const dim = NIGHT || PHASE === 'dusk';               // 저녁부터 가로등과 창에 불이 켜진다
    // 절벽 두께 — 마을 밑에 남는 자리를 절벽이 먼저 먹는다(그림이 커져도 폭은 그대로다).
    // 폰처럼 세로가 긴 화면에서만 두꺼워지고, 데스크톱에서는 40으로 남아 섬이 뜬 채로 끝난다.
    const plotBottom = orgY + (VILLAGE_TILES * 24) / 2;  // 땅 뒤 꼭짓점에서 아래 꼭짓점까지 (14+12칸 × 반 칸 높이)
    const spare = H - (plotBottom + 40) * HS;            // 지금 절벽으로도 남는 빈 자리(px)
    const cliff = Math.max(40, Math.min(116, Math.round(40 + Math.max(0, spare) * 0.30 / HS)));
    if (VG && VG.canvas) VG.canvas.width = 0;           // 지난 마을 캔버스를 바로 놓아 준다 (크기를 바꿀 때마다 20MB 씩 쌓인다)
    VG = Village.render({
      w: vw, h: vh, hs: HS * dpr, orgX: Math.round(vw / 2 - 24), orgY, cliff, night: dim, litP: CLOCK.litP, snow: weather.snow,
      sprites: SPRITES, pal: PAL,
      frames: hung.map(h => h ? drawingToCanvas(h) : null),
    });
    VG.dpr = dpr;
    canvas.dataset.lights = VG.lights.length;           // 시험용 — 시각에 따라 불 켜진 창이 몇인지 밖에서 읽는다
    snowPainted = weather.snow;                          // 지금 그림에 눈이 얹혀 있는지
    horizon = VG.horizon * HS;
    const g = VG.canvas.getContext('2d');
    // 시간대 색은 맨 마지막에 한 겹으로 덮는다. source-atop 이라 하늘로 비치는 빈 자리에는 묻지 않는다.
    if (HAS_PHASE) tintLayer(g, VG.canvas.width, VG.canvas.height, PHASE);
    // 덮개 뒤에 켜는 불 — 가로등·창·횃불. 덮기 전에 그리면 같이 어두워져서 불이 꺼진 것처럼 보인다.
    if (dim) {
      const k = HS * dpr, a = NIGHT ? 0.55 : 0.26;
      g.save(); g.globalCompositeOperation = 'lighter';
      VG.lights.forEach(l => {
        const gr = g.createRadialGradient(l.x * k, l.y * k, 0, l.x * k, l.y * k, l.r * k);
        gr.addColorStop(0, hexA(l.c, a)); gr.addColorStop(1, hexA(l.c, 0));
        g.fillStyle = gr;
        g.fillRect((l.x - l.r) * k, (l.y - l.r) * k, l.r * 2 * k, l.r * 2 * k);
      });
      g.restore();
    }
    layoutTags();
    maybePanHint();
  }

  // 계절이 뿌리는 것 — 봄 꽃잎, 가을 낙엽, 겨울 눈
  function drawFalling(){
    const f = fallNow();
    if (!f) return;
    const px = Math.max(2, S - 1);
    for (let i = 0; i < f.n; i++) {
      const sp = 0.35 + prand(i * 5.1) * 0.5;
      const y = ((prand(i * 2.3) + t * f.speed * sp * 0.06) % 1.15 - 0.08) * H;
      const x = (prand(i * 3.7) * 1.05 - 0.02) * W
              + Math.sin(t * (0.6 + prand(i * 9.1)) + i) * W * 0.02 * f.drift;
      ctx.fillStyle = f.colors[i % f.colors.length];
      ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, px, px);
    }
  }

  // 비 — 비스듬한 줄. 계절 것과 달리 길쭉하고 빠르다.
  function drawRain(){
    if (!raining()) return;
    const n = Math.round(W / 9);
    ctx.fillStyle = 'rgba(205,222,240,.72)';
    for (let i = 0; i < n; i++) {
      const sp = 1.6 + prand(i * 4.2) * 0.8;
      const y = ((prand(i * 2.9) + t * sp * 0.25) % 1.1 - 0.05) * H;
      const x = (prand(i * 6.1) * 1.1 - 0.05) * W - y * 0.12;
      ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, Math.max(1, S - 2), S * 2.5);
    }
  }

  // 생일 풍선 — 아래에서 올라간다
  function drawBalloons(){
    if (!BIRTHDAY) return;
    const s = Math.max(2, charS);
    for (let i = 0; i < 7; i++) {
      const y = (1.1 - ((prand(i * 3.3) + t * 0.05 * (0.7 + prand(i * 7.1) * 0.6)) % 1.25)) * H;
      const x = (0.05 + prand(i * 5.7) * 0.9) * W + Math.sin(t + i) * S * 3;
      drawSprite(ctx, SPRITES.balloon, Math.round(x / S) * S, Math.round(y / S) * S, s, { H: BCOL[i % BCOL.length] });
    }
  }

  // 유성 — 별 다섯 개를 누르면 한 번. 왼쪽 위에서 오른쪽 아래로 3초 동안 긋는다.
  function drawMeteor(){
    if (!meteorAt) return;
    const age = (performance.now() - meteorAt) / 3000;
    if (age >= 1) { meteorAt = 0; return; }
    const hx = W * (0.05 + age * 0.9), hy = H * (0.04 + age * 0.34);
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = (1 - i / 9) * (1 - Math.max(0, age - 0.7) / 0.3);
      ctx.fillStyle = i < 2 ? '#ffffff' : '#ffe9a8';
      ctx.fillRect(Math.round((hx - i * S * 2.2) / S) * S, Math.round((hy - i * S * 0.85) / S) * S, S, S);
    }
    ctx.globalAlpha = 1;
  }

  // 생일 밤에는 성 위로 불꽃이 오른다. 2.6초마다 저절로 하나, 하늘을 누르면 그 자리에 하나 더.
  const FW_COL = ['#ff7f8a', '#ffd979', '#6cc7b3', '#5aa9e6', '#b9a3d6'];
  let fireworks = [], fwAt = 0;
  function boom(x, y){
    fireworks.push({ x, y, at: performance.now(), c: FW_COL[Math.floor(Math.random() * FW_COL.length)], a: Math.random() * 6.283 });
    sfx('star');
  }
  function drawFireworks(){
    if (!BIRTHDAY || !NIGHT) return;
    const now = performance.now();
    if (!reduce && now - fwAt > 2600) { fwAt = now; boom(W * (0.42 + Math.random() * 0.5), horizon * (0.22 + Math.random() * 0.42)); }
    fireworks = fireworks.filter(f => now - f.at < 1400);
    const s = Math.max(1, Math.round(S / 2));
    fireworks.forEach(f => {
      const u = (now - f.at) / 1400;
      ctx.globalAlpha = 1 - u * u;
      ctx.fillStyle = f.c;
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * 6.283 + f.a, r = u * S * 26;
        ctx.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r + u * u * S * 10), s, s);
      }
    });
    ctx.globalAlpha = 1;
  }

  // 여름밤에만 나오는 반딧불. 풀밭 높이에서 느리게 떠다니며 깜빡인다.
  // ---- 별자리 잇기 ----
  // 하늘에 박힌 큰 별을 하나씩 누르면 선으로 이어진다. 다 이으면 그날의 별자리가
  // 완성되고 이름이 붙는다. 오늘 이은 것만 남는다 — 내일은 다시 빈 하늘이다.
  //
  // 이을 별을 고르는 규칙이 두 가지를 만족해야 한다.
  //
  // 하나, 어느 화면에서나 같은 별이어야 한다. 하늘에 박힌 별의 수는 화면 폭을
  // 따라가서 폰에서는 여섯, 큰 모니터에서는 열여덟이 된다. 그대로 두면 모니터에서만
  // 열여덟 번을 눌러야 완성돼 같은 놀이가 화면마다 다른 일이 돼 버린다. 번호 25 까지는
  // 폰에도 있으므로 거기까지만 쓴다.
  //
  // 둘, 하늘에 떠 있는 별이어야 한다. 별자리 선은 산과 언덕보다 먼저 그려지므로,
  // 지평선 아래에 찍힌 별로 이으면 선이 산에 먹혀 끊긴 것처럼 보인다. 실제로
  // 20번이 그랬다. 그래서 높이로 한 번 더 거른다 — 그렇게 남는 것이 다섯 개다.
  let MAP_IDS = [];
  const isMapStar = idx => idx != null && MAP_IDS.indexOf(idx) >= 0;
  const MAP_KEY = 'sy.starmap.' + DAY_SEED;
  let lit = [];                              // 누른 순서대로의 별 번호
  try { lit = JSON.parse(localStorage.getItem(MAP_KEY) || '[]'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  let starPts = [];                          // 이번 화면에서의 별 좌표 (그릴 때 채운다)
  const STAR_NAMES = ['수아자리', '연아자리', '레샤자리', '미미자리', '상그렐라자리', '자매자리'];

  function drawStarMap(){
    if (!lit.length) return;
    const pt = i => starPts.find(s => s.i === i);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,243,160,.75)';
    ctx.lineWidth = Math.max(1, Math.round(S / 2));
    ctx.beginPath();
    let started = false;
    lit.forEach(i => {
      const q = pt(i); if (!q) return;
      if (!started) { ctx.moveTo(q.x, q.y); started = true; }
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    // 이은 별은 조금 크게 찍어 준다 — 어디를 눌렀는지 보이게
    ctx.fillStyle = '#fff3a0';
    lit.forEach(i => { const q = pt(i); if (q) ctx.fillRect(q.x - S, q.y - S, S * 2, S * 2); });
    ctx.restore();
  }

  // 무지개. 스프라이트가 아니라 굵은 띠 일곱 개를 계단처럼 찍어서 도트 느낌을 낸다.
  const RAINBOW = ['#ff6b6b', '#ff9a4d', '#ffd979', '#7ed37e', '#5aa9e6', '#6a7fd6', '#a87fd6'];
  function drawRainbow(){
    // 미리보기(?rainbow=1)일 때는 다 그려진 채로 계속 떠 있다.
    let grow = 1, fade = 1;
    if (!rainbowPreview) {
      const left = rainbowUntil - performance.now();
      if (left <= 0) return;
      // 나타날 때 1초에 걸쳐 그려지고, 사라질 때 2초에 걸쳐 옅어진다.
      grow = Math.min(1, (performance.now() - rainbowFrom) / 1000);
      fade = Math.min(1, left / 2000);
    }
    const cx = W * 0.5, cy = horizon + H * 0.10;      // 중심을 언덕 아래에 두어야 반원이 하늘에 걸린다
    const r0 = Math.min(W, H) * 0.42;
    const band = Math.max(S, Math.round(S * 1.5));
    ctx.globalAlpha = 0.5 * fade;
    RAINBOW.forEach((col, i) => {
      ctx.fillStyle = col;
      const r = r0 + (RAINBOW.length - 1 - i) * band;
      // 왼쪽 끝에서 오른쪽으로 자라난다
      for (let a = Math.PI; a >= Math.PI * (1 - grow); a -= 0.012) {
        const x = Math.round((cx + Math.cos(a) * r) / S) * S;
        const y = Math.round((cy - Math.sin(a) * r) / S) * S;
        if (y > horizon + H * 0.10) continue;
        ctx.fillRect(x, y, band, band);
      }
    });
    ctx.globalAlpha = 1;
  }

  // 손전등. 화면을 덮은 어둠에 구멍을 하나 뚫는다.
  // destination-out 은 「이미 그린 것을 지우는」 칠이라, 지운 자리로 아래 풍경이 드러난다.
  function drawTorch(){
    if (!torch || !NIGHT) return;
    // 동그라미가 크고 흐리면 「조금 어두워졌네」 로만 보인다. 작고 또렷해야 손전등이다.
    const r = Math.min(W, H) * 0.17;
    const x = pointer.on ? pointer.x : W * 0.5;
    const y = pointer.on ? pointer.y : H * 0.55;

    // 어둠은 반드시 딴 판에서 뚫어야 한다.
    // 본 화면에 바로 destination-out 을 쓰면 어둠만 지우는 게 아니라 이미 그려 둔
    // 풍경까지 같이 파낸다 — 처음에 그렇게 했다가 손전등 자리에 흰 구멍이 났다.
    const g = torchLayer.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(5,8,20,.88)';
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(x, y, r * 0.55, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.75, 'rgba(0,0,0,.96)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.restore();

    ctx.drawImage(torchLayer, 0, 0, W, H);

    // 비추는 자리에 아주 옅은 노란빛을 얹는다 — 이래야 「덜 어두운 곳」이 아니라
    // 「빛이 닿은 곳」으로 보인다.
    ctx.save();
    const warm = ctx.createRadialGradient(x, y, 0, x, y, r);
    warm.addColorStop(0, 'rgba(255,240,190,.16)');
    warm.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = warm;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawFireflies(){
    flyPos.length = 0;
    if (!NIGHT) return;
    // 원래는 여름밤에만 열넷. 손전등을 켜면 계절과 상관없이 서른 마리가 나온다 —
    // 「불을 꺼야 보이는 것이 있다」 를 손으로 만져 보게 하는 자리.
    if (SEASON !== 'summer' && !torch) return;
    const n = torch ? 30 : 14;
    for (let i = 0; i < n; i++) {
      if (caughtFlies.has(i)) continue;                 // 잡은 놈은 병 속에 있다
      const x = (prand(i * 4.4) + Math.sin(t * 0.3 + i) * 0.04) * W;
      const y = H * (0.66 + prand(i * 8.8) * 0.22) + Math.sin(t * 0.7 + i * 1.7) * H * 0.02;
      flyPos.push({ i: i, x: x, y: y });                // 누를 자리는 그린 그 자리다
      const blink = Math.sin(t * 2.3 + i * 2.9);
      if (blink < 0) continue;
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#fff3a0';
      ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, S, S);
      ctx.globalAlpha = blink * 0.35;
      ctx.fillRect(Math.round(x / S) * S - S, Math.round(y / S) * S, S * 3, S);
    }
    ctx.globalAlpha = 1;
  }

  function drawPops(){
    if (!pops.length) return;
    const s = Math.max(2, Math.round(charS * 0.55));
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.018;
      if (p.life <= 0) { pops.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.7));
      drawSprite(ctx, p.sp, Math.round(p.x / S) * S, Math.round(p.y / S) * S, s);
    }
    ctx.globalAlpha = 1;
  }

  // 발자국 — 길 위에 두 발씩. 갓 남긴 것은 또렷하고, 하루에 걸쳐 옅어진다
  function drawSteps(gx, gy){
    if (!VG || !steps.length) return;
    const b = Math.max(1, Math.round(HS)), now = Date.now();
    steps.forEach(s => {
      if (s.dot === undefined) {
        const tx = s.xr * VG.PW, ty = s.yr * VG.PD;
        s.dot = STEP_KINDS[VG.kindOf(tx, ty)] ? VG.dotAt(tx, ty) : null;   // 길이 아닌 자리에 떨어진 옛 자국은 안 그린다
      }
      if (!s.dot) return;
      const a = (s.wet ? 0.8 : 0.55) * (1 - (now - s.at) / 86400e3);
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.wet ? '#2b2a3a' : '#3d2e22';   // 웅덩이를 밟고 지나간 자국은 더 짙다
      const x = Math.round(s.dot.x * HS + gx), y = Math.round(s.dot.y * HS + gy), f = s.dir ? -1 : 1;
      ctx.fillRect(x - 3 * b, y - f * b, 2 * b, 3 * b);   // 왼발
      ctx.fillRect(x + b, y + f * b, 2 * b, 3 * b);       // 오른발 — 어느 발이 앞인지 번갈아
    });
    ctx.globalAlpha = 1;
  }

  // 심어 둔 꽃 — 마을 잔디 위에. 자리(xr, yr)는 땅 칸의 비율이라 화면 크기와 상관없이 같은 자리에 핀다
  function drawPlanted(gx, gy){
    if (!VG) return;
    const base = Math.max(1, Math.round(HS));
    planted.forEach(f => {
      if (f.dot === undefined) {                          // 자리는 한 번만 푼다 (resize 가 지운다)
        const tx = f.xr * VG.PW, ty = f.yr * VG.PD, kind = VG.kindOf(tx, ty);
        f.dot = (kind === 'grass' || kind === 'garden') ? VG.dotAt(tx, ty) : null;   // 길·집 자리에 떨어진 옛 꽃은 안 그린다
      }
      if (!f.dot) return;
      // 심자마자 활짝 피면 「심었다」 는 느낌이 안 난다. 한 시간은 새싹, 하루는 봉오리,
      // 그다음부터 꽃이다 — 오늘 심은 것을 내일 보러 올 이유가 생긴다.
      const sp = f.age == null ? SPRITES.flower
               : f.age < 3600e3   ? (SPRITES.sprout || SPRITES.flower)
               : f.age < 86400e3  ? (SPRITES.bud || SPRITES.flower)
               : SPRITES.flower;
      const x = Math.round(f.dot.x * HS + gx - sp[0].length * base / 2);
      const y = Math.round(f.dot.y * HS + gy - sp.length * base);
      drawSprite(ctx, sp, x, y, base,
        Object.assign({}, wash(sp), { J: SCENE.petal[f.k % SCENE.petal.length] }));
    });
  }

  // ---- 눈사람 ----
  // 눈 오는 날에는 잔디를 누르면 꽃 대신 눈덩이가 생긴다. 같은 자리를 세 번 누르면 눈사람이 선다.
  // 꽃처럼 남아서 다른 손님도 본다 — 사흘 지난 것은 표가 스스로 지운다.
  let snowmen = [];                       // { xr, yr, at }
  const balls = {};                       // 굴리는 중인 눈덩이 { 반칸키: { n, tx, ty } }
  let snowAt = 0, builtHere = 0;
  const SNOW_MAX = 3;                     // 한 방문에 셋까지 — 마을이 눈사람 밭이 되면 안 된다
  function snowball(w, p){
    const now = performance.now();
    if (now - snowAt < 300) return;
    snowAt = now;
    const key = Math.round(w.tx * 2) + ',' + Math.round(w.ty * 2);
    const o = balls[key] || (balls[key] = { n: 0, tx: w.tx, ty: w.ty });
    o.n++;
    if (o.n < 3) { sfx('plant'); popAt(p.x, p.y, SPRITES.star, 1); kick(); return; }
    delete balls[key];
    if (builtHere >= SNOW_MAX) return;
    builtHere++;
    const m = { xr: o.tx / VG.PW, yr: o.ty / VG.PD, at: Date.now() };
    snowmen.push(m);
    sfx('key');
    popAt(p.x, p.y, SPRITES.star, 6);
    kick();
    sb.from('snowmen').insert({ xr: Math.round(m.xr * 1000), yr: Math.round(m.yr * 1000) }).then(() => {}, () => {});
  }
  // 꽃이 가장 많이 모인 칸 — 네 송이부터 나비가 찾아온다.
  // 매 프레임 세면 아깝다. 3초에 한 번만 세고 그 사이에는 같은 자리를 쓴다.
  let patchAt = 0, patchPt = null;
  function flowerPatch(gx, gy){
    if (!VG) return null;
    const now = performance.now();
    if (now - patchAt > 3000) {
      patchAt = now;
      const box = {};
      planted.forEach(f => {
        if (!f.dot) return;
        const k = Math.round(f.xr * VG.PW) + ',' + Math.round(f.yr * VG.PD);
        (box[k] || (box[k] = [])).push(f.dot);
      });
      let best = null;
      Object.keys(box).forEach(k => { if (!best || box[k].length > box[best].length) best = k; });
      const g = best && box[best].length >= 4 ? box[best] : null;
      patchPt = g ? { x: g.reduce((a, d) => a + d.x, 0) / g.length, y: g.reduce((a, d) => a + d.y, 0) / g.length } : null;
    }
    return patchPt ? { x: patchPt.x * HS + gx, y: patchPt.y * HS + gy, low: true } : null;
  }

  function drawSnowmen(gx, gy){
    if (!VG) return;
    const b = Math.max(1, Math.round(HS));
    Object.keys(balls).forEach(k => {
      const o = balls[k], p = VG.dotAt(o.tx, o.ty), r = o.n === 1 ? 3 : 5;
      dotEllipse(p.x, p.y - r, r, r, gx, gy, '#f2f8ff');
    });
    snowmen.forEach(m => {
      if (m.dot === undefined) {
        const tx = m.xr * VG.PW, ty = m.yr * VG.PD, kind = VG.kindOf(tx, ty);
        m.dot = (kind === 'grass' || kind === 'garden') ? VG.dotAt(tx, ty) : null;   // 길·집 자리에 떨어진 옛 눈사람은 안 그린다
      }
      if (!m.dot) return;
      const x = m.dot.x, y = m.dot.y;
      dotLine(x - 6, y - 8, x - 11, y - 12, gx, gy, '#8a6a4a');    // 나뭇가지 팔 — 몸통 옆에서 위로
      dotLine(x + 6, y - 8, x + 11, y - 12, gx, gy, '#8a6a4a');
      dotEllipse(x, y - 5, 6, 5, gx, gy, '#e9f2fb');      // 아랫덩이
      dotEllipse(x, y - 13, 4, 4, gx, gy, '#f8fbff');     // 머리
      ctx.fillStyle = '#3a3632';                           // 눈
      ctx.fillRect(Math.round((x - 2) * HS + gx), Math.round((y - 14) * HS + gy), b, b);
      ctx.fillRect(Math.round((x + 1) * HS + gx), Math.round((y - 14) * HS + gy), b, b);
      ctx.fillStyle = '#e8913a';                           // 당근 코
      ctx.fillRect(Math.round((x - 1) * HS + gx), Math.round((y - 12) * HS + gy), b * 2, b);
    });
  }
  // 남이 만들어 둔 눈사람 — 사흘 안의 것만
  sb.from('snowmen').select('xr, yr, created_at').order('id', { ascending: false }).limit(40)
    .then(({ data }) => {
      if (!data) return;
      snowmen = data.map(r => ({ xr: r.xr / 1000, yr: r.yr / 1000, at: new Date(r.created_at).getTime() })).concat(snowmen);
      kick();
    }, () => {});

  // ---- 강의 오리와 천막의 연 ----
  // 마을 그림에 박지 않고 프레임마다 움직여 그린다. 도트 그림은 village.js 가 같은 코드로 만들어 준다.
  const SPR2 = (() => {
    if (typeof Village.sprites !== 'function') return null;
    const raw = Village.sprites();
    // 저녁·밤에는 마을과 같은 색으로 가라앉힌다 — 마을은 tintLayer 로 물들었는데 오리만 낮 색이면 튄다
    const dimOf = sp => {
      if (!HAS_PHASE) return sp;
      const cv = document.createElement('canvas'); cv.width = sp.w; cv.height = sp.h;
      const g = cv.getContext('2d'); g.drawImage(sp.canvas, 0, 0); tintLayer(g, sp.w, sp.h, PHASE);
      return Object.assign({}, sp, { canvas: cv });
    };
    const dim = NIGHT || PHASE === 'dusk';
    return { duck: dim ? dimOf(raw.duck) : raw.duck, kite: dim ? raw.kite.map(dimOf) : raw.kite };
  })();
  // 도트 1:1 그림을 마을 자리(도트)에 마을 배율로 얹는다. flip 이면 좌우를 뒤집는다 — 기준점은 그대로
  function blitDots(sp, dx, dy, gx, gy, flip, sc){
    const k = HS * (sc || 1);                                   // sc: 새끼 오리처럼 같은 그림을 작게 얹을 때
    const x = dx * HS + gx, y = dy * HS + gy, w = Math.round(sp.w * k), h = Math.round(sp.h * k);
    if (!flip) { ctx.drawImage(sp.canvas, 0, 0, sp.w, sp.h, Math.round(x - sp.ox * k), Math.round(y - sp.oy * k), w, h); return; }
    ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1);
    ctx.drawImage(sp.canvas, 0, 0, sp.w, sp.h, -Math.round(sp.ox * k), Math.round(y - sp.oy * k), w, h);
    ctx.restore();
  }
  // 도트 단위 직선 — 연줄
  function dotLine(x0, y0, x1, y1, gx, gy, col){
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const s = Math.ceil(HS);
    ctx.fillStyle = col;
    for (let i = 0; i <= n; i++){
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      ctx.fillRect(Math.round(x * HS + gx), Math.round(y * HS + gy), s, s);
    }
  }
  // 굴뚝 연기 — 마을 그림에 박지 않고 프레임마다 피워 올린다. 바람이 세면 더 옆으로 눕는다
  function drawSmoke(gx, gy){
    const s = VG && VG.smoke; if (!s) return;
    // 밥때는 굵고 자주, 한밤엔 실낱 하나 — 시계(CLOCK.smoke 0~1)가 정한다
    const lv = CLOCK.smoke;
    const step = Math.max(1, Math.round(HS)), wind = Math.min(2, weather.wind || 1), N = Math.round(2 + 5 * lv);
    for (let i = 0; i < N; i++){
      const u = ((t / 3.4) + i / N) % 1;                   // 0 갓 나온 것 → 1 다 흩어진 것
      const x = (s.x - u * 11 * wind) * HS + gx, y = (s.y - u * 26) * HS + gy;
      ctx.globalAlpha = 0.62 * (0.45 + 0.55 * lv) * (1 - u) * (1 - u * 0.3);
      ctx.fillStyle = i % 2 ? '#e6e6eb' : '#d2d2dc';
      pixelCircle(ctx, x, y, (1.6 + u * 4.4) * (0.55 + 0.45 * lv) * HS, step);
    }
    ctx.globalAlpha = 1;
  }

  // 비 오는 날 웅덩이 — 광장 돌바닥의 빈 자리 다섯 곳. 비가 오는 동안 천천히 커지고,
  // 그치면 천천히 마른다. 자리는 물건에 안 가리는 칸으로 미리 골라 뒀다.
  const PUDDLES = [[5.0, 5.5], [5.5, 6.0], [6.0, 7.0], [7.0, 7.0], [8.0, 6.0]];
  let wet = 0;                                          // 0 마름 → 1 흥건함
  function drawPuddles(gx, gy){
    if (!VG) return;
    wet = Math.max(0, Math.min(1, wet + (raining() ? 0.016 / 22 : -0.016 / 60)));
    if (wet < 0.02) return;
    const s = Math.max(1, Math.round(HS));
    PUDDLES.forEach(([tx, ty], i) => {
      const c = VG.dotAt(tx, ty);
      const r = (5 + (i % 3) * 2) * wet;                 // 도트 반지름
      if (r < 1) return;
      const x0 = c.x * HS + gx, y0 = c.y * HS + gy;
      hits.push({ kind:'puddle', x: x0, y: y0 - r * HS / 2, w: r * 2 * HS, h: r * HS });
      ctx.fillStyle = 'rgba(150,180,205,0.45)';
      for (let dy = -Math.round(r / 2); dy <= Math.round(r / 2); dy++){
        const k = 1 - Math.pow(dy / Math.max(1, r / 2), 2);
        const hw = Math.round(r * Math.sqrt(Math.max(0, k)));
        if (hw <= 0) continue;
        ctx.fillRect(Math.round(x0 - hw * HS), Math.round(y0 + dy * HS), Math.round(hw * 2 * HS), s);
      }
      // 빗방울이 떨어진 자리 — 고리 하나가 퍼졌다 사라진다
      if (!raining()) return;
      const u = ((t * 0.7) + i * 0.37) % 1;
      const rr = Math.round(r * u);
      if (rr < 1) return;
      ctx.globalAlpha = (1 - u) * 0.5;
      ctx.fillStyle = '#e8f2fa';
      ctx.fillRect(Math.round(x0 - rr * HS), Math.round(y0), s, s);
      ctx.fillRect(Math.round(x0 + rr * HS), Math.round(y0), s, s);
      ctx.globalAlpha = 1;
    });
  }

  // 웅덩이를 밟으면 물이 튄다. 튄 뒤 2분 동안 남기는 발자국은 젖은 자국이 된다.
  let splashes = [];
  let wetUntil = 0;
  function drawSplash(){
    if (!splashes.length) return;
    const now = performance.now(), s = Math.max(1, Math.round(HS));
    splashes = splashes.filter(sp => now - sp.at < 520);
    ctx.fillStyle = '#dcecfa';
    splashes.forEach(sp => {
      const u = (now - sp.at) / 520;
      ctx.globalAlpha = 1 - u;
      for (let i = 0; i < 8; i++){
        const a = i / 8 * 6.283, r = u * S * 7;
        ctx.fillRect(Math.round(sp.x + Math.cos(a) * r), Math.round(sp.y + Math.sin(a) * r * 0.5 - u * S * 5 + u * u * S * 8), s, s);
      }
    });
    ctx.globalAlpha = 1;
  }

  // 오리 두 마리 — 다리 오른쪽 강(x 5.2~13, 물은 y 10.8~12)을 천천히 오가며 둥실거린다.
  // 다리(x 3.15~4.35)와 배(x 1.2) 쪽으로는 안 간다 — 마을 그림 위에 얹혀서, 다리 밑을 지나면 다리 위에 그려진다.
  const ducks = [
    { tx: 6.9, ty: 11.35, dir: 1,  v: 0.13, ph: 0 },      // v: 초당 칸 — 한 칸에 8초쯤
    { tx: 8.4, ty: 11.65, dir: -1, v: 0.10, ph: 2.1 },
  ];
  const DUCK_MIN = 5.2, DUCK_MAX = 13.0;
  // 강을 누르면 빵조각이 떨어지고 가까운 오리가 헤엄쳐 온다. 하루 세 번까지 —
  // 매번 되면 오리가 늘 먹고만 있고, 오늘 몫을 아껴 쓰는 재미도 없다.
  // 준 밥은 날마다 세 번까지지만, 모두 합한 횟수는 계속 쌓인다 — 세 번마다 새끼가 한 마리 는다.
  // 하루에 다 못 채우니 여러 날에 걸쳐 오리 가족이 자란다.
  const FEED_KEY = 'sy.feed.' + DAY_SEED, FEED_MAX = 3, FEED_ALL_KEY = 'sy.feed.total';
  let fedToday = 0, fedAll = 0;
  try { fedToday = Number(localStorage.getItem(FEED_KEY) || 0) || 0;
        fedAll = Number(localStorage.getItem(FEED_ALL_KEY) || 0) || 0; } catch (e) { /* 저장이 막힌 브라우저 — 이 자리에서만 센다 */ }
  const DUCKLINGS = 5;                                  // 다 모이면 다섯 마리
  let crumb = null;                                     // { tx, ty }
  function feed(tx, ty, px, py){
    if (fedToday >= FEED_MAX) { say('오늘 몫은 다 줬어 (' + FEED_MAX + '/' + FEED_MAX + ')', { x:px, y:py, w:0, h:0 }); return; }
    if (crumb) return;                                  // 아직 안 먹은 것이 떠 있다
    crumb = { tx: Math.max(DUCK_MIN, Math.min(DUCK_MAX, tx)), ty: ty };
    sfx('plant');
    popAt(px, py, SPRITES.heart, 1);
    kick();
  }
  function drawDucks(gx, gy){
    ducks.forEach(d => {
      if (!reduce) {
        // 빵조각이 떠 있으면 그쪽으로 뱃머리를 돌린다 — 두 배 빠르게
        if (crumb) {
          const away = crumb.tx - d.tx;
          d.dir = away >= 0 ? 1 : -1;
          d.tx += d.dir * d.v * 2 * 0.016;
          if (Math.abs(crumb.tx - d.tx) < 0.18) {
            const p2 = VG.dotAt(crumb.tx, crumb.ty);
            popAt(p2.x * HS + gx, p2.y * HS + gy, SPRITES.heart, 3);
            crumb = null;
            fedToday++; fedAll++;
            try { localStorage.setItem(FEED_KEY, String(fedToday));
                  localStorage.setItem(FEED_ALL_KEY, String(fedAll)); } catch (e) { /* 위와 같은 이유 */ }
            sfx('char');
            if (fedAll === DUCKLINGS * 3)
              unlock('ducks', { x: p2.x * HS + gx, y: p2.y * HS + gy - S * 4, w: S * 10, h: S * 6 }, '오리 가족이 다 모였다!');
            else if (fedAll % 3 === 0 && fedAll < DUCKLINGS * 3)
              say('새끼 오리가 한 마리 늘었다!', { x: p2.x * HS + gx, y: p2.y * HS + gy - S * 4, w: S * 10, h: S * 6 });
          }
        } else {
          d.tx += d.dir * d.v * 0.016;
          if (d.tx > DUCK_MAX) { d.tx = DUCK_MAX; d.dir = -1; }
          else if (d.tx < DUCK_MIN) { d.tx = DUCK_MIN; d.dir = 1; }
          else if (Math.random() < 0.0012) d.dir = -d.dir;        // 가끔 마음이 바뀐다 — 14초에 한 번쯤
        }
        d.tx = Math.max(DUCK_MIN, Math.min(DUCK_MAX, d.tx));
      }
      const p = VG.dotAt(d.tx, d.ty + Math.sin(t * 0.35 + d.ph) * 0.12);   // 강 폭 안에서 살짝 비껴 흐른다
      const bob = Math.sin(t * 1.7 + d.ph) * 1.2;                            // 둥실 — 도트
      blitDots(SPR2.duck, p.x, p.y + bob, gx, gy, d.dir < 0);
    });
    // 새끼 오리 — 어미(첫째 오리) 뒤를 줄지어 따라간다. 밥을 세 번 줄 때마다 한 마리씩
    const kids = Math.min(DUCKLINGS, Math.floor(fedAll / 3));
    if (kids) {
      const m = ducks[0];
      for (let i = 1; i <= kids; i++) {
        const tx = m.tx - m.dir * 0.26 * i;
        if (tx < DUCK_MIN - 0.4 || tx > DUCK_MAX + 0.4) continue;
        const p = VG.dotAt(tx, m.ty + Math.sin(t * 0.35 + m.ph + i * 0.5) * 0.12);
        blitDots(SPR2.duck, p.x, p.y + Math.sin(t * 1.7 + m.ph + i) * 1.0, gx, gy, m.dir < 0, 0.62);
      }
    }
    // 빵조각 — 물 위에서 까딱거린다
    if (crumb) {
      const c = VG.dotAt(crumb.tx, crumb.ty), s = Math.max(1, Math.round(HS));
      const y = Math.round((c.y + Math.sin(t * 2.4) * 0.8) * HS + gy), x = Math.round(c.x * HS + gx);
      ctx.fillStyle = '#e6c48a'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = '#c9a465'; ctx.fillRect(x, y, s, s);
    }
  }
  // 연 — 천막 기둥에 줄로 매여 바람에 살살 흔들리고, 꼬리는 물결친다 (village.js 의 위상 12장)
  function drawKite(gx, gy){
    const k = VG.kite, wind = Math.min(2, weather.wind || 1);
    const sway = (Math.sin(t * 0.7) * 4 + Math.sin(t * 1.9) * 1.5) * wind;   // 좌우 — 도트
    const lift = Math.sin(t * 1.1 + 1) * 2 * wind;                            // 위아래
    const kx = k.home.x + sway, ky = k.home.y + lift;
    dotLine(k.anchor.x, k.anchor.y, kx, ky + 5, gx, gy, '#5a4a3a');           // 줄: 기둥 끝 → 연 아래 꼭짓점
    blitDots(SPR2.kite[Math.floor(t * 8) % SPR2.kite.length], kx, ky, gx, gy, false);
  }

  // ---- 매표소 풍선 ----
  // 마을 그림에 박지 않고 여기서 흔들며 그린다 — 아이가 하나를 떼어 하늘로 날려 보낼 수 있다.
  // 하루에 하나까지. 날려 보낸 자리는 다음 날 다시 매여 있다.
  const BALLOONS = [
    { c:'#ff6b6b', hi:'#ff9d9d', kc:'#c04a45', dx:-6, dy:-40 },
    { c:'#5aa9e6', hi:'#8ecdf5', kc:'#3d7cae', dx: 2, dy:-46 },
    { c:'#ffd166', hi:'#ffe6a8', kc:'#c9a13f', dx: 8, dy:-38 },
  ];
  const WISHES = ['소원 하나 하늘로!', '풍선아 잘 가~', '구름까지 갈까?', '높이 높이!', '안녕~ 또 만나'];
  const BAL_KEY = 'sy.balloon.' + DAY_SEED;
  let balloonGone = -1;                                 // 오늘 떼어 낸 풍선 번호 (-1 이면 아직 셋 다 있다)
  try { const v = localStorage.getItem(BAL_KEY); if (v != null) balloonGone = Number(v); } catch (e) { /* 저장이 막힌 브라우저 — 이 자리에서만 센다 */ }
  let freeBalloon = null;                               // 날아가는 중 { c, hi, kc, cx, cy, at }

  // 도트 타원 — 마을 배율로. 풍선처럼 작고 둥근 것에만 쓴다.
  // 줄마다 다음 줄이 시작하는 자리까지 채운다 — 배율이 정수가 아니면 줄 사이가 벌어져
  // 눈사람이 줄무늬 통이 됐다.
  function dotEllipse(cx, cy, rx, ry, gx, gy, col){
    ctx.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++){
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
      if (hw <= 0) continue;
      const x0 = Math.round((cx - hw) * HS + gx), x1 = Math.round((cx + hw + 1) * HS + gx);
      const y0 = Math.round((cy + dy) * HS + gy), y1 = Math.round((cy + dy + 1) * HS + gy);
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }
  function oneBalloon(b, cx, cy, gx, gy, tied){
    const s = Math.max(1, Math.round(HS));
    if (tied) dotLine(VG.balloons.x, VG.balloons.y - 18, cx, cy + 5, gx, gy, '#6a5a50');
    else dotLine(cx, cy + 5, cx + 1, cy + 11, gx, gy, '#6a5a50');   // 끊어진 줄이 대롱대롱
    dotEllipse(cx, cy, 4, 5, gx, gy, b.c);
    ctx.fillStyle = b.hi; ctx.fillRect(Math.round((cx - 2) * HS + gx), Math.round((cy - 3) * HS + gy), s * 2, s * 2);
    ctx.fillStyle = b.kc; ctx.fillRect(Math.round(cx * HS + gx), Math.round((cy + 5) * HS + gy), s, s);
  }
  function drawTentBalloons(gx, gy){
    const B = VG.balloons; if (!B) return;
    BALLOONS.forEach((b, i) => {
      if (i === balloonGone) return;
      const cx = B.x + b.dx + Math.sin(t * 0.8 + i * 1.7) * 1.6, cy = B.y + b.dy + Math.sin(t * 1.1 + i) * 1.2;
      oneBalloon(b, cx, cy, gx, gy, true);
      hits.push({ kind:'balloon', idx:i, x: cx * HS + gx, y: (cy - 5) * HS + gy, w: 9 * HS, h: 11 * HS });
    });
    if (freeBalloon) {
      const age = (performance.now() - freeBalloon.at) / 1000;
      if (age > 9) { freeBalloon = null; return; }
      oneBalloon(freeBalloon, freeBalloon.cx + Math.sin(age * 1.6) * 5, freeBalloon.cy - age * 34, gx, gy, false);
    }
  }

  // ---- 광장 고양이 ----
  // 마을 그림에 박지 않고 여기서 그린다. 누르면 일어나고, 그다음 광장을 누르면 그리로 걸어온다.
  // 15초 동안만 깨어 있다 — 계속 따라다니면 부르는 재미가 없다.
  const CAT_LINES = ['야옹', '골골골', '냐앙~', '...', '꼬리 살랑', '배고파'];
  const CAT_AREA = { x0: 5.3, x1: 8.7, y0: 3.9, y1: 7.3 };
  const CAT_NAME_KEY = 'sy.cat.name', CAT_PLAY_KEY = 'sy.cat.play';
  let catName = '', catPlay = 0;
  try { catName = localStorage.getItem(CAT_NAME_KEY) || ''; catPlay = Number(localStorage.getItem(CAT_PLAY_KEY) || 0) || 0; } catch (e) { /* 저장이 막힌 브라우저 — 이름 없이도 논다 */ }
  const cat = { tx: 0, ty: 0, gx: 0, gy: 0, walk: 0, ready: false };
  let catAwake = 0;                                     // 이때까지는 부르면 온다
  function drawCat(gx, gy){
    if (!VG.cat) return;
    if (!cat.ready) { cat.tx = cat.gx = VG.cat.tx; cat.ty = cat.gy = VG.cat.ty; cat.ready = true; }
    if (!reduce) {
      const dx = cat.gx - cat.tx, dy = cat.gy - cat.ty, d = Math.hypot(dx, dy);
      if (d > 0.05) { const v = 0.9 * 0.016; cat.tx += dx / d * v; cat.ty += dy / d * v; cat.walk += 0.016; }
      else cat.walk = 0;
    }
    const p = VG.dotAt(cat.tx, cat.ty), s = Math.max(1, Math.round(HS));
    const bob = cat.walk ? Math.round(Math.abs(Math.sin(cat.walk * 9))) * s : 0;   // 걸을 때만 통통
    const x = Math.round(p.x * HS + gx) - 5 * s, y = Math.round(p.y * HS + gy) - 7 * s - bob;
    drawSprite(ctx, SPRITES.cat, x, y, s, wash(SPRITES.cat));
    hits.push({ kind:'cat', name: catName || '고양이', x: x + 5 * s, y, w: 10 * s, h: 7 * s });
  }
  // 고양이를 부르는 자리 — 광장 안이어야 하고, 너무 가까우면 안 움직인다
  function callCat(tx, ty){
    if (performance.now() > catAwake) return false;
    const gx2 = Math.max(CAT_AREA.x0, Math.min(CAT_AREA.x1, tx));
    const gy2 = Math.max(CAT_AREA.y0, Math.min(CAT_AREA.y1, ty));
    if (Math.hypot(gx2 - cat.tx, gy2 - cat.ty) < 0.35) return false;
    cat.gx = gx2; cat.gy = gy2;
    catAwake = performance.now() + 15000;               // 부를 때마다 조금 더 깨어 있는다
    sfx('prop');
    kick();
    return true;
  }

  // 이름 짓기 상자 — 이름이 없을 때 고양이를 누르면 뜬다. 지어 주면 다시 안 뜬다.
  const catBox = $('#catNameBox'), catIn = $('#catNameIn');
  function showCatName(){ if (catBox && !catName) { catBox.hidden = false; if (catIn) catIn.focus(); } }
  if (catBox) catBox.addEventListener('submit', e => {
    e.preventDefault();
    const v = (catIn && catIn.value || '').trim().slice(0, 6);
    if (!v) return;
    catName = v;
    try { localStorage.setItem(CAT_NAME_KEY, catName); } catch (e2) { /* 저장이 막힌 브라우저 — 이 방문 동안만 부른다 */ }
    catBox.hidden = true;
    sfx('key');
    const h = hits.find(x => x.kind === 'cat');
    if (h) { say('이제부터 나는 ' + catName, h); popAt(h.x, h.y, SPRITES.heart, 5); }
    kick();
  });

  function drawSecrets(gx, gy){
    if (!VG) return;
    const s = Math.max(1, Math.round(HS));
    secrets.forEach(sec => {
      const p = VG.secrets[sec.spot] || VG.secrets[0];
      const w = sec.sp[0].length * s, h = sec.sp.length * s;
      const x = Math.round(p.x * HS + gx - w / 2);
      const y = Math.round(p.y * HS + gy - h);
      const done = found.has(sec.key);
      // 못 찾은 동안에는 위쪽 절반만 보인다 — 수풀 밖으로 빼꼼 내민 모습.
      // 찾고 나면 통째로 나와서, 찾았다는 게 눈으로 보인다.
      ctx.save();
      if (!done) { ctx.beginPath(); ctx.rect(x, y, w, h * 0.55); ctx.clip(); }
      drawSprite(ctx, sec.sp, x, y, s, wash(sec.sp));
      ctx.restore();
      if (done) drawSprite(ctx, SPRITES.star, x + w, y - s * 3, Math.max(1, s - 1));
      sec.rect = { x: x + w / 2, y, w, h: done ? h : h * 0.55 };
    });
  }

  function draw(){
    if (!W || !H) return;
    // 비 온 뒤에 무지개. 소나기를 부른 아이만 볼 수 있는 상이다 —
    // 30초를 기다려야 나오니 「비 그만!」 하고 나가 버리면 못 본다.
    if (shower && performance.now() > shower) {
      rainbowFrom = performance.now(); rainbowUntil = rainbowFrom + RAINBOW_MS; shower = 0;
    }
    ctx.clearRect(0, 0, W, H);
    hits = [];                      // 그리는 순서대로 다시 채운다 (뒤에 넣은 것이 위에 있는 것)

    paint(() => drawScene());
    drawTorch();                    // 손전등은 시간대 색을 안 탄다 — 그 자체가 빛이므로
    drawNameTag();                  // 이름표는 시간대 색을 안 탄다 — 늘 읽혀야 하므로
  }

  function drawScene(){
    // 1) 하늘
    ctx.drawImage(skyLayer, 0, 0, W, H);
    if (NIGHT) {
      const n = Math.round(W / 26);
      drawStars(ctx, W, H, S, n, t);   // 몇 개만 반짝이게 덧그림
      // 십자로 크게 그린 별들은 누를 수 있다 (drawStars 와 같은 자리 계산).
      // 반짝이는 몇 개(n)가 아니라 하늘에 박힌 것 전부(W/14)를 세야 폰에서도 여섯 개쯤 나온다.
      starPts = [];
      for (let i = 0; i < Math.round(W / 14); i += 5) {
        const sx = Math.round(prand(i * 1.7) * W / S) * S;
        const sy = Math.round(prand(i * 3.9) * H * 0.5 / S) * S - S * 2;
        starPts.push({ i, x: sx + S * 3, y: sy + S * 3 });
        hits.push({ kind:'prop', key:'star', idx:i, x: sx, y: sy, w: S * 6, h: S * 6 });
      }
      // 이을 별 고르기. 세 가지를 거른다.
      //  · 번호 25 까지 — 폰에도 있는 별만 써야 화면마다 같은 놀이가 된다
      //  · 지평선 위 — 아래에 찍힌 별로 이으면 선이 산에 먹혀 끊긴 것처럼 보인다
      //  · 서로 떨어진 것 — 상자가 겹치면 뒤엣것은 영영 못 누른다. 앞엣것이 늘 먼저
      //    잡히기 때문이다. 실제로 5번과 10번이 8px 차이로 붙어 있어서, 여섯 번을
      //    눌러도 하나는 끝까지 안 이어졌다.
      MAP_IDS = [];
      starPts.forEach(q => {
        if (q.i > 25 || q.y >= H * 0.38 || MAP_IDS.length >= 5) return;
        const far = MAP_IDS.every(j => {
          const o = starPts.find(sp => sp.i === j);
          return !o || Math.abs(o.x - q.x) >= S * 7 || Math.abs(o.y - q.y) >= S * 7;
        });
        if (far) MAP_IDS.push(q.i);
      });
      // 두세 개로는 별자리라 하기 어렵다. 그런 날은 그냥 별만 반짝인다.
      if (MAP_IDS.length < 3) MAP_IDS = [];
      // 이을 수 있는 별은 한 점 더 찍어 도톰하게 — 어느 별인지 손에 잡히게 한다
      ctx.fillStyle = 'rgba(255,243,160,.55)';
      starPts.forEach(q => {
        if (isMapStar(q.i) && lit.indexOf(q.i) < 0)
          ctx.fillRect(q.x - S, q.y - S, S * 2, S * 2);
      });
      drawStarMap();
    }
    drawMeteor();

    // 2) 해 (밤에는 달)
    const sunR = (26 + Math.sin(t * 0.6) * 1.5) * (W < 640 ? 0.8 : 1);
    const sunX = W * 0.18, sunY = H * 0.15 - scrollY * 0.10;
    // 무리는 낮에는 넓게 퍼져도 하늘과 대비가 작아 눈에 안 걸리는데, 아침·노을·밤에는 같은 크기가
    // 딱딱한 원판으로 보인다. 낮이 아닐 때는 해에 바짝 붙인다.
    ctx.fillStyle = SCENE.sun.glow; pixelCircle(ctx, sunX, sunY, sunR * (PHASE === 'day' ? 1.8 : 1.32), S);
    ctx.fillStyle = SCENE.sun.core; pixelCircle(ctx, sunX, sunY, sunR, S);
    if (NIGHT) {
      // 초승달 — 하늘색 원을 옆에 겹쳐 한쪽을 베어 문다
      ctx.fillStyle = SCENE.sky[1];
      pixelCircle(ctx, sunX + sunR * 0.62, sunY - sunR * 0.22, sunR * 0.92, S);
    }
    hits.push({ kind:'prop', key: NIGHT ? 'moon' : 'sun',
      x: sunX, y: sunY - sunR, w: sunR * 2, h: sunR * 2 });

    // 3) 구름 — 층마다 속도를 달리해 원근감
    clouds.forEach((c, i) => {
      const cx = ((c.x + ct * c.sp) % 1.4 - 0.2) * W;
      const cy = c.y * H - scrollY * c.depth * 0.5;
      drawFluffyCloud(ctx, cx, cy, S * 7 * c.sc, S, i * 17 + 3);
      const cw = S * 7 * c.sc * 2.6, ch = S * 7 * c.sc * 1.5;
      hits.push({ kind:'prop', key:'cloud', x: cx, y: cy - ch / 2, w: cw, h: ch });
    });

    // 4) 새
    birds.forEach((b, i) => {
      const bx = ((b.x + t * b.sp) % 1.25 - 0.12) * W;
      const by = b.y * H + Math.sin(t * 2 + i) * 8 - scrollY * 0.3;
      drawSprite(ctx, SPRITES.bird, Math.round(bx/S)*S, Math.round(by/S)*S, Math.max(2, S - 2), wash(SPRITES.bird));
    });

    // 사랑앵무 — 하늘을 천천히 가로지르며 날개를 퍼덕임.
    // 오르내림과 날갯짓 주기를 다르게 둬야 기계적으로 안 보임.
    const budS = Math.max(2, Math.round((S - 1) * 0.8));   // 기존 대비 80%
    const budX = ((0.02 + t * 0.03) % 1.3 - 0.16) * W;
    const budY = H * 0.13 + Math.sin(t * 0.9) * S * 5 - scrollY * 0.3;
    const budSp = Math.sin(t * 7) > 0 ? SPRITES.budgieUp : SPRITES.budgieDown;
    const budDX = Math.round(budX / S) * S, budDY = Math.round(budY / S) * S;
    drawSprite(ctx, budSp, budDX, budDY, budS, wash(budSp));
    // 미미도 누르면 이름이 뜬다. 날개를 폈다 접었다 하느라 스프라이트의 빈 줄이
    // 계속 바뀌므로, 누를 자리는 두 그림에 공통인 바깥 네모로 잡는다.
    const budW = budSp[0].length * budS, budH = budSp.length * budS;
    hits.push({ kind:'char', name: '미미', x: budDX + budW / 2, y: budDY, w: budW, h: budH });

    // 5) 마을 (스크롤에 따라 살짝 밀리고, 좁은 화면에서는 끌어 본 만큼 옆으로)
    const gy = Math.round(scrollY * 0.06 / S) * S, gx = panX;
    view.gx = gx; view.gy = gy;
    if (VG) ctx.drawImage(VG.canvas, 0, 0, VG.canvas.width, VG.canvas.height, gx, gy, VG.canvas.width / VG.dpr, VG.canvas.height / VG.dpr);
    moveTags(gy);
    drawUnderClouds();               // 섬 밑 구름바다 — 마을 그림(먼 들판) 위, 놀이보다 아래
    // 비 오면 온 화면이 한 톤 가라앉고, 안개 낀 날은 지평선에 뿌연 띠가 낀다
    if (raining()) { ctx.fillStyle = 'rgba(70,80,100,.22)'; ctx.fillRect(0, 0, W, H); }
    if (weather.fog) { ctx.fillStyle = 'rgba(232,236,240,.40)'; ctx.fillRect(0, horizon - H * 0.1, W, H * 0.24); }
    // 두드려서 열린 문 — 오두막은 마을 그림에 박혀 있으니 그 위에 문만 어둡게 덧그리고 고양이를 내보낸다.
    // 문은 2:1 로 기운 벽에 있어서 기둥마다 반 도트씩 내려간다.
    if (VG && performance.now() < doorOpen) {
      const d = VG.house.door;
      ctx.fillStyle = '#2a1e16';
      for (let i = 0; i < d.w; i++)
        ctx.fillRect(Math.round((d.x + i) * HS + gx), Math.round((d.y + Math.floor(i / 2)) * HS + gy), Math.ceil(HS), Math.round(d.h * HS));
      const cs = Math.max(1, Math.round(HS)), f = VG.house.foot;
      drawSprite(ctx, SPRITES.cat, Math.round(f.x * HS + gx) - 5 * cs, Math.round(f.y * HS + gy) - SPRITES.cat.length * cs, cs, wash(SPRITES.cat));
    }

    // 5b) 강의 오리와 천막의 연 — 마을 그림 위에서 움직인다
    if (VG && SPR2) { drawDucks(gx, gy); if (VG.kite) drawKite(gx, gy); }
    if (VG) drawTentBalloons(gx, gy);
    drawPuddles(gx, gy);
    drawSmoke(gx, gy);

    drawSteps(gx, gy);
    drawPlanted(gx, gy);
    drawSnowmen(gx, gy);
    if (VG) drawCat(gx, gy);
    drawRuler(gx, gy);
    drawSecrets(gx, gy);
    secrets.forEach(sec => sec.rect && hits.push({ kind:'secret', key:sec.key,
      x:sec.rect.x, y:sec.rect.y, w:sec.rect.w, h:sec.rect.h }));

    // 6) 두 아이와 친구들 — 광장에 서 있다. 통통 튀는 모션.
    // 마을과 같은 배율로 그린다 — 집과 아이의 도트 크기가 같아야 한 그림으로 보인다.
    const castS = Math.max(1, Math.round(HS));
    // 튀는 높이는 도트 격자에 맞춰 끊는다. 소수 자리로 올리면 drawSprite 가 그 소수를 알파로
    // 구워 넣어서(SUBY) 도트 줄마다 반투명한 이음매가 생기고, 아이들 사이로 배경이 비친다.
    const hop1 = Math.round(Math.abs(Math.sin(t * 1.4)) * 3) * castS;
    const hop2 = Math.round(Math.abs(Math.sin(t * 1.4 + 0.9)) * 3) * castS;
    const spot = p => ({ x: p.x * HS + gx, y: p.y * HS + gy });
    const cast = VG ? [
      { sp: SPRITES.sua,   s: castS, bob: hop1, name: '수아', at: spot(VG.chars.sua) },
      // 숨는 날에는 광장 대신 숨는 자리에, 위 절반만 내밀고 서 있다 (레샤는 같이 안 숨는다)
      hiding() && VG.secrets[hideSpotOf()]
        ? { sp: SPRITES.yona, s: castS, bob: 0, name: '연아', hide: true, at: spot(VG.secrets[hideSpotOf()]) }
        : { sp: SPRITES.yona, s: castS, bob: hop2, rider: SPRITES.fox, name: '연아', riderName: '레샤', at: spot(VG.chars.yona) },
      { sp: SPRITES.easel, s: castS, bob: 0, easel: true, at: spot(VG.chars.easel) },   // 이젤은 사람이 아니라 이름이 없다
      // 얼굴만 있는 친구 — 통통 튀지 않고 굴러다닌다. 두 아이보다 앞줄에 서 있으니 맨 나중에 그린다
      { sp: SPRITES.chick, s: castS, bob: 0, roll: true, name: '상그렐라', at: spot(VG.chars.chick) },
    ] : [];
    cast.forEach(c => {
      const w = c.sp[0].length * c.s, h = c.sp.length * c.s;
      const cx = Math.round(c.at.x - w / 2), standY = Math.round(c.at.y);
      if (c.roll) {
        // 돌처럼 굴러다님: 좌우로 천천히 오가고, 굴러간 거리만큼 실제로 돌아간다.
        // 각도 = 이동거리 / 반지름 이라서 미끄러지지 않고 굴러가는 것으로 보임.
        const radius = w / 2;
        const amp = Math.min(w * 1.6, HS * 18);
        const LIM = HS * 110;                             // 광장과 길 너비만큼만 — 성이나 개울까지 굴러가지 않는다
        // 끌어다 던질 수 있다. 던진 뒤에는 제자리로 천천히 돌아온다 —
        // 아주 돌아오지 않으면 다음에 왔을 때 화면 구석에 박혀 있게 된다.
        if (!chick.held) {
          chick.ox += chick.vx;
          chick.vx = chick.vx * 0.94 - chick.ox * 0.006;    // 감쇠 + 제자리로 당기는 힘
          // 끝에 닿으면 튕긴다
          if (Math.abs(chick.ox) >= LIM && Math.sign(chick.vx) === Math.sign(chick.ox)) chick.vx = -chick.vx * 0.55;
          if (chick.thrown) chick.far = Math.max(chick.far, Math.abs(chick.ox - chick.from));
          if (Math.abs(chick.vx) < 0.02 && Math.abs(chick.ox) < 0.5) { chick.vx = 0; chick.ox = 0; }
          // 멈추면 기록. 살짝 민 것(화면의 5% 미만)은 던진 걸로 안 친다.
          if (chick.thrown && Math.abs(chick.vx) < 0.4) {
            chick.thrown = false;
            const m = Math.round(chick.far / W * 100) / 10;      // 화면 폭 = 10m
            if (chick.far > W * 0.05) {
              // 자기 자리를 직접 만든다 — hits 는 매 장 새로 채우는데 상그렐라는 아직 안 들어가 있어서
              // 찾으면 undefined 였고, 그 바람에 신기록 소리도 말풍선도 안 나왔다
              const hh = { x: cx + w / 2 + chick.ox, y: standY - h, w: w, h: h };
              if (m > bestThrow()) {
                try { localStorage.setItem('sy.throw.best', String(m)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
                if (hh) { sfx('key'); say('신기록! ' + m.toFixed(1) + 'm', hh); popAt(hh.x, hh.y, SPRITES.star, 8); }
              } else if (hh) say(m.toFixed(1) + 'm', hh);
            }
          }
        }
        chick.ox = Math.max(-LIM, Math.min(LIM, chick.ox));
        const dx = Math.sin(t * 0.42) * amp + chick.ox;
        ctx.save();
        // 회전 중심을 도트 격자에 맞춰 잡아야 돌 때 그림이 떨리지 않음
        ctx.translate(Math.round((cx + w / 2 + dx) / c.s) * c.s, Math.round((standY - h / 2) / c.s) * c.s);
        ctx.rotate(dx / radius);
        drawSprite(ctx, c.sp, -Math.round(w / 2), -Math.round(h / 2), c.s, wash(c.sp));
        ctx.restore();
        // 돌고 있어도 누를 자리는 네모로 잡는다 — 돌아가는 모양까지 따라가면
        // 손끝이 계속 빗나가서 오히려 누르기 어렵다
        hits.push({ kind:'char', name: c.name, x: cx + w / 2 + dx, y: standY - h, w: w, h: h });
      } else {
        const top = standY - h - c.bob;
        if (c.hide) {
          // 물건 너머로 머리만 내민 모습 — 숨은 친구와 같은 방식이다
          ctx.save();
          ctx.beginPath(); ctx.rect(cx, top, w, h * 0.55); ctx.clip();
          drawSprite(ctx, c.sp, cx, top, c.s, wash(c.sp));
          ctx.restore();
          hits.push({ kind:'char', name: c.name, hide: true, x: cx + w / 2, y: top, w: w, h: h * 0.55 });
          return;
        }
        drawSprite(ctx, c.sp, cx, top, c.s, wash(c.sp));
        let headTop = top;                                 // 우산을 씌울 높이 — 머리 위 친구가 있으면 그 위
        if (BIRTHDAY && c.name === BIRTHDAY) bdayFoot = { x: cx + w + S, y: standY };
        // 이젤에는 최근 작품 한 점이 걸린다. 흰 캔버스 자리(가로 4~19칸, 세로 2~14칸)에 맞춰 얹음.
        if (c.easel) {
          const ex = cx + 4 * c.s, ey = top + 2 * c.s, ew = 16 * c.s, eh = 13 * c.s;
          if (easelImg) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(easelImg, ex, ey, ew, eh);
            if (NIGHT) { ctx.globalAlpha = 0.42; ctx.fillStyle = '#101d3a'; ctx.fillRect(ex, ey, ew, eh); }
            ctx.restore();
          }
          easelRect = { x: cx + w / 2, y: top, w: w, h: h };
          hits.push(Object.assign({ kind:'easel' }, easelRect));
        }
        const own = c.name ? { kind:'char', name: c.name, x: cx + w / 2, y: top, w: w, h: h } : null;
        if (own) hits.push(own);
        if (c.rider) {
          // 머리 위에 올라탄 친구 — 주인이 튀면 같이 튀도록 같은 top 을 기준으로 앉힘.
          // 주인의 top 이 정수라 여기도 정수가 된다. 따로 반올림하면 주인과 어긋나 혼자 끊겨 보인다.
          const rs = Math.max(1, Math.round(c.s * 0.85));
          const rw = c.rider[0].length * rs, rh = c.rider.length * rs;
          const rx = Math.round((cx + (w - rw) / 2) / rs) * rs;
          const rtop = top - rh + rs;
          drawSprite(ctx, c.rider, rx, rtop, rs, wash(c.rider));
          // 주인을 눌렀을 때 이름표는 머리 위 친구보다 더 높이 띄운다.
          if (own) own.tagY = rtop;
          // 머리 위 친구는 주인 위에 겹쳐 있으니 뒤에 넣어 둔다 — 찾을 때 뒤에서부터 보므로
          // 겹친 자리를 누르면 위에 있는 쪽이 잡힌다
          if (c.riderName) hits.push({ kind:'char', name: c.riderName, x: rx + rw / 2, y: rtop, w: rw, h: rh });
          headTop = rtop;
        }
        // 비 오는 날엔 아이들이 우산을 쓴다. 이젤은 안 쓴다 — 그림이 젖는 건 모른 척.
        if (raining() && c.name) {
          const us = Math.max(1, Math.round(c.s * 2.2));
          const uw = SPRITES.umbrella[0].length * us, uh = SPRITES.umbrella.length * us;
          drawSprite(ctx, SPRITES.umbrella, Math.round((cx + (w - uw) / 2) / us) * us,
            Math.round((headTop - uh + us * 2) / us) * us, us, wash(SPRITES.umbrella));
        }
      }
    });
    // 생일 케이크 — 생일인 아이 발밑 옆에
    if (bdayFoot) {
      const cs = Math.max(2, Math.round(castS * 0.8));
      drawSprite(ctx, SPRITES.cake, Math.round(bdayFoot.x / S) * S,
        Math.round((bdayFoot.y - SPRITES.cake.length * cs) / S) * S, cs);
    }

    // 7) 나비 — 8자를 그리며 떠다니다가, 손가락이 가까이 오면 그쪽으로 끌려온다.
    // 꽃이 네 송이 넘게 모인 자리가 있으면 아이들 머리 위 대신 그 꽃밭으로 간다 — 심을수록 나비가 온다
    const patch = flowerPatch(gx, gy);
    for (let i = 0; i < 3; i++) {
      const home = patch || (VG ? spot(VG.chars.sua) : { x: W * 0.5, y: H * 0.6 });
      const spread = patch ? 16 : 46, lift = patch ? 14 : 62;
      let bx = home.x + (i - 1) * HS * spread + Math.sin(t * 0.7 + i * 2) * HS * (patch ? 9 : 22);
      // 아이들 머리 위로 띄움 — 얼굴 높이면 표정을 가림. 꽃밭에서는 꽃 바로 위에서 난다
      let by = home.y - HS * lift + Math.sin(t * 1.5 + i) * S * (patch ? 3 : 5);
      if (pointer.on) {
        const d = Math.hypot(pointer.x - bx, pointer.y - by);
        if (d < W * 0.45) {
          // 거리에 반비례해 끌린다. 딱 붙지 않고 조금 못 미치게 두면 살아 있는 것처럼 보인다.
          const k = (1 - d / (W * 0.45)) * 0.75;
          bx += (pointer.x - bx) * k;
          by += (pointer.y - by - S * 6) * k;
        }
      }
      const bs = Math.max(2, charS - 1), bdx = Math.round(bx / S) * S, bdy = Math.round(by / S) * S;
      drawSprite(ctx, SPRITES.butterfly, bdx, bdy, bs, wash(SPRITES.butterfly));
      const bw = SPRITES.butterfly[0].length * bs, bh = SPRITES.butterfly.length * bs;
      hits.push({ kind:'prop', key:'butterfly', x: bdx + bw / 2, y: bdy, w: bw, h: bh });
    }

    drawForeground();                // 맨 앞 수풀 — 아이들보다도 앞
    drawRainbow();
    drawFalling();
    drawRain();
    drawBalloons();
    drawFireworks();
    drawFireflies();
    drawSplash();
    drawPops();
  }

  // ---- 마을 아래 빈 자리 채우기 ----
  // 폰처럼 세로가 긴 화면에서는 떠 있는 섬 밑으로 먼 들판만 249px(29%) 비어 보였다.
  // 마을을 키우면 폭까지 같이 커져 옆이 잘리므로, 세로만 채운다 — 절벽을 두껍게(마을 그림 쪽),
  // 그 아래로 구름바다, 맨 앞에 수풀. 절벽 밑이 이미 화면 밖이면(데스크톱) 아무것도 안 그린다.
  // 빈 자리가 이만큼도 안 되면 그리지 않는다. 여기서 딱 끊지 않고 FG_FULL 까지 서서히 짙어지게 한다 —
  // 안드로이드는 스크롤할 때 주소창이 접히며 resize 가 오고, 그때 빈 자리가 조금 줄어든다.
  // 예전처럼 90px 에서 잘라 버리면 그 순간 구름과 수풀이 통째로 사라져 「갑자기 없어졌다」로 보인다.
  const FG_MIN = 24, FG_FULL = 130;

  // 절벽 밑의 빈 자리. { top: 화면 y, band: 높이, a: 짙기 0~1 }. 자리가 없으면 null
  function underBand(){
    if (!VG || !VG.cliff) return null;
    const top = (VG.dotAt(VG.PW, VG.PD).y + VG.cliff) * HS + (view.gy || 0);
    const band = H - top;
    if (band < FG_MIN) return null;
    return { top, band, a: Math.min(1, (band - FG_MIN) / (FG_FULL - FG_MIN)) };
  }
  // 맨 앞 수풀의 등성이 — 빈 자리의 위 절반쯤을 남기고 앉는다. 절벽을 덮지는 않는다.
  function fgRidgeY(B){ return Math.max(B.top + 6, Math.max(B.top + B.band * 0.55, H - H * 0.14)); }

  // 섬 밑 구름은 옆으로 흐르기만 한다 — 프레임마다 다시 그리면 fillRect 가 1300번 는다.
  // 한 번 구워 두고 캔버스째 옮겨 붙인다. 도트 크기(S)가 바뀌면 다시 굽는다.
  const ucBaked = new Map();
  function underCloud(seed, scale){
    const key = seed + ':' + Math.round(scale) + ':' + S;
    let im = ucBaked.get(key);
    if (im) return im;
    const w = Math.ceil(scale * 4.6) + S * 2, h = Math.ceil(scale * 3.2) + S * 2;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    drawFluffyCloud(g, w / 2, h / 2, scale, S, seed);
    im = { cv, ox: w / 2, oy: h / 2 };
    if (ucBaked.size > 40) ucBaked.clear();          // 화면 크기를 이리저리 바꾸면 쌓인다
    ucBaked.set(key, im);
    return im;
  }

  // 섬 밑을 흘러가는 구름바다 — 마을과 저 아래 들판 사이. 마을이 얼마나 높이 떠 있는지 말해 준다.
  // 위쪽은 작고 옅게(멀다), 아래쪽은 크고 희게(가깝다). 아래 겹은 수풀에 반쯤 가려 깊이가 생긴다.
  function drawUnderClouds(){
    const B = underBand();
    if (!B) return;
    const top = B.top, band = B.band;
    // 먼 들판을 옅은 안개로 눌러 준다 — 구름바다가 앉을 자리
    const hz = ctx.createLinearGradient(0, top, 0, H);
    hz.addColorStop(0, 'rgba(226,238,248,0)'); hz.addColorStop(0.5, 'rgba(226,238,248,' + (0.40 * B.a).toFixed(3) + ')'); hz.addColorStop(1, 'rgba(226,238,248,' + (0.14 * B.a).toFixed(3) + ')');
    ctx.fillStyle = hz; ctx.fillRect(0, top, W, band);
    [[-0.02, 0.42, 0.55, 0.55], [0.15, 0.62, 0.85, 0.85]].forEach((r, ri) => {
      const [y0, sc, alpha, sp] = r;
      for (let i = 0; i < 5; i++){
        const seed = ri * 37 + i * 11;
        const cx = (((0.10 + i * 0.30 + prand(seed) * 0.10) + ct * 0.010 * sp) % 1.5 - 0.25) * W;
        const cy = top + band * (y0 + prand(seed + 5) * 0.08);
        if (cy > H + S * 12) continue;
        const im = underCloud(seed, S * 7 * sc * (0.75 + prand(seed + 3) * 0.5) * (0.55 + B.a * 0.45));
        ctx.globalAlpha = alpha * B.a;
        ctx.drawImage(im.cv, Math.round((cx - im.ox) / S) * S, Math.round((cy - im.oy) / S) * S);
        ctx.globalAlpha = 1;
      }
    });
  }

  // 맨 앞 수풀 — 화면 아래를 덮는 가장 가까운 겹. 앞이 어두우면 마을이 더 멀어 보인다.
  // 마을보다 1.5배 빠르게 밀린다 — 가까운 것이 더 많이 움직여야 깊이가 산다.
  function drawForeground(){
    const B = underBand();
    if (!B) return;
    ctx.globalAlpha = B.a;                               // 자리가 좁아지면 옅어진다 (한 번에 사라지지 않게)
    const pal = SCENE.bush, s = S, fx = panX * 1.5, baseY = fgRidgeY(B);
    const ridge = x => {                                 // 등성이 높이 — 열마다 다르다
      const u = (x - fx) / s;
      return Math.round((baseY + (Math.sin(u * 0.06) * 4 + Math.sin(u * 0.19 + 1.7) * 2.5 + prand(Math.floor(u * 0.5)) * 2) * s * 0.7) / s) * s;
    };
    // 언덕 — 두 단계 그늘로 덩어리를 만든다. 높이가 같은 열은 한 번에 칠한다(열마다 칠하면 300번이 넘는다)
    for (let x = -s * 2; x < W + s * 2; ){
      const top = ridge(x);
      let x2 = x + s;
      while (x2 < W + s * 2 && ridge(x2) === top) x2 += s;
      const w2 = x2 - x;
      ctx.fillStyle = pal[4]; ctx.fillRect(x, top, w2, H - top);
      ctx.fillStyle = pal[3]; ctx.fillRect(x, top, w2, s * 3);
      ctx.fillStyle = pal[2]; ctx.fillRect(x, top, w2, s);
      x = x2;
    }
    // 밀어 본 만큼 옆으로 흐르되 양 끝에서 감긴다 — 안 감으면 끝까지 밀었을 때 덩어리가 죄다 화면 밖으로 나간다
    const span = W + s * 24, wrap = v => ((v % span) + span) % span - s * 12;
    for (let i = 0; i < 8; i++){                         // 수풀 덩어리 — 등성이 위에 앉는다
      const cx = wrap(prand(i * 5.3) * span + fx);
      const cy = ridge(cx) + s * (1 + prand(i * 2.7) * 1.5);
      const r = s * (5 + prand(i * 3.1) * 4);
      ctx.fillStyle = pal[4]; pixelCircle(ctx, cx, cy + s * 1.5, r, s);
      ctx.fillStyle = pal[3]; pixelCircle(ctx, cx, cy, r * 0.94, s);
      ctx.fillStyle = pal[2]; pixelCircle(ctx, cx - r * 0.22, cy - r * 0.34, r * 0.52, s);
      ctx.fillStyle = pal[1]; pixelCircle(ctx, cx - r * 0.34, cy - r * 0.5, r * 0.24, s);
    }
    ctx.fillStyle = pal[2];                              // 풀잎 — 등성이 위로 삐죽삐죽, 바람에 흔들린다
    for (let i = 0; i < Math.round(W / (s * 1.6)); i++){
      const x = Math.round(wrap(prand(i * 1.9) * span + fx) / s) * s;
      const top = ridge(x), len = 2 + Math.floor(prand(i * 4.4) * 4);
      const sway = Math.sin(t * 1.3 + i) * 0.7;
      for (let k = 0; k < len; k++) ctx.fillRect(x + Math.round(sway * k) * s, top - (k + 1) * s, s, s);
    }
    for (let i = 0; i < 4; i++){                         // 실루엣 꽃 — 앞 겹에도 이야기가 있어야 한다
      const x = Math.round(wrap((0.13 + i * 0.24) * span + fx) / s) * s;
      const top = ridge(x), sway = Math.sin(t * 1.1 + i * 2) * s * 0.6;
      ctx.fillStyle = pal[3];
      for (let k = 0; k < 6; k++) ctx.fillRect(Math.round((x + sway * k / 6) / s) * s, top - (k + 1) * s, s, s);
      ctx.fillStyle = pal[1]; pixelCircle(ctx, x + sway, top - s * 7, s * 1.8, s);
      ctx.fillStyle = pal[0]; ctx.fillRect(Math.round((x + sway - s) / s) * s, Math.round((top - s * 8) / s) * s, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // 말풍선도 도트로 그린다 — 사이트의 카드와 같은 굵은 테두리와 4px 어긋난 그림자.
  // 시간은 t 가 아니라 실제 시계로 잰다. 움직임을 줄인 설정에서는 t 가 멈춰 있기 때문.
  function drawNameTag(){
    if (!nameTag) return;
    // 목소리가 나오는 동안은 자막이 사라지면 안 된다 — 머무는 구간 끝에 붙잡아 둔다
    if (nameTag.holdWhile && nameTag.holdWhile())
      nameTag.at = Math.max(nameTag.at, performance.now() - TAG_IN - TAG_HOLD + 200);
    const age = performance.now() - nameTag.at;
    if (age >= TAG_LIFE) { const cb = nameTag.onEnd; nameTag = null; if (cb) cb(); return; }

    const fade = age < TAG_IN ? age / TAG_IN
      : age > TAG_IN + TAG_HOLD ? 1 - (age - TAG_IN - TAG_HOLD) / TAG_OUT : 1;
    const rise = age < TAG_IN ? (1 - age / TAG_IN) * S * 2 : 0;   // 살짝 떠오르며 나타남

    const INK = '#2f2a24', PAPER = '#fff6e9';
    const fs = Math.max(12, Math.round(S * 3.4));
    const pad = S * 2;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.font = '800 ' + fs + 'px Suayona Dot, Suayona Sans, Pretendard, sans-serif';
    ctx.textBaseline = 'top';

    const bw = Math.ceil(ctx.measureText(nameTag.text).width) + pad * 2;
    const bh = fs + pad * 2;
    // 화면 밖으로 나가지 않게 가두되, 꼬리는 캐릭터를 계속 가리키게 둔다
    const bx = Math.max(S, Math.min(W - bw - S, Math.round((nameTag.x - bw / 2) / S) * S));

    // 기본은 머리 위. 다만 하늘 높이 있는 미미는 위에 띄우면 헤더 뒤로 숨어 버리므로,
    // 자리가 없으면 발밑으로 내려 꼬리를 위로 돌린다.
    const up = Math.round((nameTag.y - bh - S * 4 + rise) / S) * S;
    const below = up < headerH + S;
    const by = below
      ? Math.round((nameTag.bottom + S * 4 - rise) / S) * S
      : up;
    const tip = Math.round(Math.max(bx + S * 3, Math.min(bx + bw - S * 3, nameTag.x)) / S) * S;

    ctx.fillStyle = INK;   ctx.fillRect(bx + S, by + S, bw, bh);      // 그림자
    ctx.fillStyle = PAPER; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = INK;                                              // 네 변 테두리
    ctx.fillRect(bx, by, bw, S); ctx.fillRect(bx, by + bh - S, bw, S);
    ctx.fillRect(bx, by, S, bh); ctx.fillRect(bx + bw - S, by, S, bh);

    // 꼬리 — 먹으로 삼각형을 놓고 그 안에 종이색을 한 겹 작게 얹는다.
    // 말풍선이 아래에 붙었으면 같은 삼각형을 위로 뒤집어 그린다.
    const edge = below ? by : by + bh - S;        // 꼬리가 붙는 변
    const step = below ? -S : S;                  // 뻗어 나가는 방향
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = INK;
      ctx.fillRect(tip - (3 - i) * S, edge + i * step, (3 - i) * 2 * S, S);
    }
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(tip - (2 - i) * S, edge + i * step, (2 - i) * 2 * S, S);
    }

    ctx.fillStyle = INK;
    ctx.fillText(nameTag.text, bx + pad, by + pad);
    ctx.restore();
  }

  function say(text, h){
    nameTag = { text, x: h.x, at: performance.now(),
                y: h.tagY != null ? h.tagY : h.y, bottom: h.y + h.h };
    idleAt = performance.now();
    kick();
  }

  // 누른 자리에 있는 캐릭터 — 뒤에서부터 찾아 위에 그려진 쪽을 먼저 잡는다.
  // 손끝은 화살표보다 뭉툭해서 스프라이트 딱 그만큼만 받으면 자꾸 빗나간다. 조금 넉넉히 잡음.
  function hitAt(px, py){
    const slack = S * 2;
    const inside = h => px >= h.x - h.w / 2 - slack && px <= h.x + h.w / 2 + slack &&
                        py >= h.y - slack && py <= h.y + h.h + slack;
    // 반딧불이가 맨 먼저다. 점 한 개짜리라 다른 물건 상자에 밀리면 영영 못 잡는다.
    for (let i = 0; i < flyPos.length; i++) {
      const f = flyPos[i];
      if (Math.abs(px - f.x) <= S * 3 && Math.abs(py - f.y) <= S * 3)
        return { kind:'fly', idx:f.i, x:f.x, y:f.y - S, w:S * 2, h:S * 2 };
    }
    // 별자리로 이을 별만 먼저 본다.
    // 뒤에서부터 훑으면 나중에 그린 것이 이긴다. 구름은 별보다 나중에 그려지고 상자도
    // 넓어서, 구름 아래 놓인 별은 눌러도 구름이 대신 대답한다. 여섯 번 눌러 둘만
    // 이어지길래 찾은 것이 이것이었다. 별자리에 쓰는 다섯 개만 예외로 둔다.
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (h.key === 'star' && isMapStar(h.idx) && inside(h)) return h;
    }
    // 숨은 친구도 먼저 본다. 아이들 상자는 넓고 나중에 그려져서, 그 여유 폭 안에
    // 숨은 친구가 있으면 눌러도 아이가 대신 대답했다 (광장 화단의 달팽이가 그랬다).
    for (let i = 0; i < hits.length; i++) if (hits[i].kind === 'secret' && inside(hits[i])) return hits[i];
    // 웅덩이도 먼저 본다. 광장 바닥에 있어서 아이들 상자 밑에 깔리는데, 상자가 넓어
    // 다섯 중 셋은 눌러도 아이가 대신 대답했다. 웅덩이 상자는 손바닥만 하니 아이를 가리지 않는다.
    for (let i = 0; i < hits.length; i++) if (hits[i].kind === 'puddle' && inside(hits[i])) return hits[i];
    for (let i = hits.length - 1; i >= 0; i--) if (inside(hits[i])) return hits[i];
    // 마을의 물건은 상자가 아니라 그려진 도트로 본다. 성은 상자가 화면의 반이라,
    // 그 앞 집의 벽을 눌러도 성이 대답했다. 말풍선은 그 물건의 상자 위에 띄운다.
    if (VG) {
      const b = VG.hitAt((px - view.gx) / HS, (py - view.gy) / HS);
      if (b) return { kind:'prop', key:b.key, x:b.x * HS + view.gx, y:b.y * HS + view.gy, w:b.w * HS, h:b.h * HS };
    }
    return null;
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(){ t += 0.016; ct += 0.016 * weather.wind; draw(); requestAnimationFrame(loop); }

  // 움직임을 줄인 설정에서는 화면이 멈춰 있으니, 살아 있는 것이 있는 동안만 따로 돌린다.
  let ticking = false;
  function kick(){
    if (!reduce || ticking) return;
    ticking = true;
    (function tick(){
      draw();
      if (nameTag || pops.length || splashes.length || fireworks.length || freeBalloon || Math.hypot(cat.gx - cat.tx, cat.gy - cat.ty) > 0.05) requestAnimationFrame(tick);
      else ticking = false;
    })();
  }

  const pointer = { x:0, y:0, on:false };
  const chick = { ox:0, vx:0, held:false, thrown:false, from:0, far:0 };
  let drag = null;

  const atCanvas = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', e => {
    const p = atCanvas(e);
    const hit = hitAt(p.x, p.y);
    drag = { x0:p.x, y0:p.y, hit, moved:false, last:p.x, vx:0, panBase: panX };
    if (hit && hit.kind === 'char' && hit.name === '상그렐라') {
      chick.held = true; chick.vx = 0;
      drag.base = chick.ox;
    }
    // 상그렐라를 잡았거나 좁은 화면에서 마을을 끌 때는 손가락이 캔버스 밖으로 나가도 놓치지 않게 붙잡는다
    if (chick.held || panMax > 0) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 이미 놓인 포인터면 실패한다 — 붙잡기는 덤이다 */ }
    }
  });

  canvas.addEventListener('pointermove', e => {
    const p = atCanvas(e);
    pointer.x = p.x; pointer.y = p.y; pointer.on = true;
    if (drag) {
      if (Math.abs(p.x - drag.x0) > 6 || Math.abs(p.y - drag.y0) > 6) drag.moved = true;
      if (chick.held) {
        chick.ox = drag.base + (p.x - drag.x0);
        drag.vx = p.x - drag.last;
        drag.last = p.x;
        kick();
      } else if (panMax > 0 && drag.moved) {
        // 좁은 화면 — 마을을 옆으로 끌어 본다. 이름표도 같이 간다
        panX = Math.max(-panMax, Math.min(0, drag.panBase + (p.x - drag.x0)));
        hidePanHint();
        kick();
      }
    }
    if (e.pointerType === 'mouse') canvas.style.cursor = hitAt(p.x, p.y) ? 'pointer' : '';
    if (reduce && pointer.on) kick();
  });

  function endDrag(e){
    const d = drag; drag = null;
    if (chick.held) {
      chick.held = false;
      chick.vx = Math.max(-28, Math.min(28, (d && d.vx) || 0));   // 던진 세기
      chick.thrown = true; chick.from = chick.ox; chick.far = 0;
      kick();
      if (d && d.moved) return;                                   // 던진 것이면 말은 안 시킨다
    }
    if (!d) return;
    const p = atCanvas(e);
    if (d.moved) return;
    const hit = hitAt(p.x, p.y);
    if (hit) { react(hit); return; }
    plant(p);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { chick.held = false; drag = null; });
  canvas.addEventListener('pointerleave', () => { pointer.on = false; });

  function react(hit){
    if (hit.kind === 'char') {
      if (hit.hide) {
        yonaFound = true;
        try { localStorage.setItem(HIDE_KEY, '1'); } catch (e) { /* 저장이 막힌 브라우저 — 다음에 오면 또 숨어 있다 */ }
        sfx('secret');
        popAt(hit.x, hit.y, SPRITES.star, 9);
        say('찾았다! 여기 숨어 있었지~', hit);
        syncHud();
        kick();
        return;
      }
      const now = performance.now();
      // 방금 다른 한 명을 눌렀으면 둘의 대화를 튼다
      if (!talk && lastTap && lastTap.name !== hit.name && now - lastTap.at < 5000) {
        const pool = TALKS.filter(tk => tk.who.indexOf(hit.name) >= 0 && tk.who.indexOf(lastTap.name) >= 0);
        if (pool.length) {
          const memo = said['talk'] || (said['talk'] = { last:-1 });
          talk = { lines: pickLine(pool, memo).lines, i: 0 };
          lastTap = null;
          popAt(hit.x, hit.y, SPRITES.heart, 3);
          nextLine();
          return;
        }
      }
      lastTap = { name: hit.name, at: now };
      sfx('char');
      say(speak(hit.name), hit); popAt(hit.x, hit.y, SPRITES.heart, 3); return;
    }
    if (hit.kind === 'puddle') {
      splashes.push({ x: hit.x, y: hit.y + hit.h / 2, at: performance.now() });
      wetUntil = performance.now() + 120000;
      sfx('splash');
      say(pickLine(['첨벙!', '철퍽', '물 튀었다!', '신발 젖었다'], said['puddle'] || (said['puddle'] = { last:-1 })), hit);
      kick();
      return;
    }
    if (hit.kind === 'balloon') {
      if (balloonGone >= 0) { sfx('prop'); say('풍선은 하루에 하나만~', hit); return; }
      balloonGone = hit.idx;
      try { localStorage.setItem(BAL_KEY, String(hit.idx)); } catch (e) { /* 저장이 막힌 브라우저 — 이 방문 동안만 날아간 채로 */ }
      const b = BALLOONS[hit.idx], B = VG.balloons;
      freeBalloon = { c: b.c, hi: b.hi, kc: b.kc, cx: B.x + b.dx, cy: B.y + b.dy, at: performance.now() };
      sfx('star');
      popAt(hit.x, hit.y, SPRITES.heart, 3);
      say(WISHES[Math.floor(Math.random() * WISHES.length)], hit);
      kick();
      return;
    }
    if (hit.kind === 'cat') {
      catAwake = performance.now() + 15000;
      catPlay++;
      try { localStorage.setItem(CAT_PLAY_KEY, String(catPlay)); } catch (e) { /* 위와 같은 이유 */ }
      sfx('char');
      popAt(hit.x, hit.y, SPRITES.heart, 3);
      if (!catName) { showCatName(); say('이름을 지어 줄래?', hit); return; }
      if (catPlay === 5) { unlock('cat', hit, catName + '와 친구가 됐다'); return; }
      say(pickLine(CAT_LINES, said['cat'] || (said['cat'] = { last:-1 })), hit);
      return;
    }
    if (hit.kind === 'easel') {
      // 목소리가 붙은 작품이면 그 목소리부터. 이미 나오는 중이면 멈춘다.
      if (easelAudio) {
        if (audioEl && !audioEl.paused) { audioEl.pause(); nameTag = null; return; }
        if (!audioEl) { audioEl = new Audio(easelAudio); audioEl.preload = 'auto'; }
        audioEl.currentTime = 0;
        audioEl.play().then(() => {
          say('🔊 ' + easelLine, hit);
          nameTag.holdWhile = () => audioEl && !audioEl.paused && !audioEl.ended;
          if (reduce) (function tick(){ draw(); if (nameTag) requestAnimationFrame(tick); })();
        }).catch(() => { if (easelHref) location.href = easelHref; });
        return;
      }
      sfx('easel');
      if (easelHref) location.href = easelHref;
      else say('아직 걸린 그림이 없어', hit);
      return;
    }
    if (hit.kind === 'fly') {
      caughtFlies.add(hit.idx);
      try { localStorage.setItem(FLY_KEY, JSON.stringify(Array.from(caughtFlies))); } catch (e) { /* 저장이 막힌 브라우저 — 그 자리에서만 센다 */ }
      sfx('star');
      popAt(hit.x, hit.y, SPRITES.star, 5);
      const n = caughtFlies.size;
      say(n >= 10 ? '반딧불이 ' + n + '마리! 병이 환하다' : n === 1 ? '반딧불이 한 마리 잡았다' : '반딧불이 ' + n + '마리', hit);
      syncHud();
      return;
    }
    if (hit.kind === 'secret') {
      const sec = secrets.find(s => s.key === hit.key);
      if (!sec) return;
      if (!found.has(sec.key)) {
        found.add(sec.key);
        try { localStorage.setItem(FOUND_KEY, JSON.stringify(Array.from(found))); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
        syncHud();
        sfx('secret');
        popAt(hit.x, hit.y, SPRITES.star, 7);
        say(sec.label + ' 찾았다!', hit);
      } else {
        sfx('prop');
        say(sec.line, hit);
      }
      return;
    }
    // 순서를 맞추면 열리는 것들 — 집 세 번, 해 열 번, 별 다섯 개
    if (hit.key === 'house' && countTap('house', 3, 4000)) { doorOpen = performance.now() + 6000; unlock('door', hit, '문이 열렸다!'); return; }
    if (hit.key === 'sun'   && countTap('sun', 10, 15000)) { shower = performance.now() + 30000; unlock('shower', hit, '소나기다!'); return; }
    if (hit.key === 'star') {
      popAt(hit.x, hit.y + S * 3, SPRITES.star, 2);
      sfx('star');
      // 별자리 잇기 — 아직 안 이은 별이면 선이 하나 더 늘어난다.
      if (isMapStar(hit.idx) && lit.indexOf(hit.idx) < 0) {
        lit.push(hit.idx);
        try { localStorage.setItem(MAP_KEY, JSON.stringify(lit)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
        if (MAP_IDS.length && lit.length >= MAP_IDS.length) {
          const name = STAR_NAMES[DAY_SEED % STAR_NAMES.length];
          unlock('starmap', hit, '별자리 완성! 오늘의 이름은 ' + name);
        } else if (lit.length === 2) {
          say('별이 이어졌다', hit);              // 두 개째에 한 번만 귀띔한다
        }
      }
      if (countTap('star', 5, 20000)) { meteorAt = performance.now(); unlock('meteor', hit, '유성이다! 소원 빌어'); }
      return;
    }
    // 액자 — 걸린 그림이 있으면 자랑, 없으면 안내
    if (hit.key === 'frame1' || hit.key === 'frame2') {
      say(hung[hit.key === 'frame1' ? 0 : 1] ? '내가 그린 그림!' : '그리기에서 여기 걸 수 있어', hit);
      popAt(hit.x, hit.y, SPRITES.heart, 2);
      return;
    }
    // 두 타워 — 그 앞에서 찍은 날이 이벤트에 있으면 그 달을 말한다
    if (hit.key === 'lotte' || hit.key === 'nseoul') {
      const nm = hit.key === 'lotte' ? '롯데타워' : '남산타워';
      sfx('prop');
      say(towerVisit[hit.key] ? nm + ' · ' + towerVisit[hit.key] + '에 갔었지' : nm, hit);
      popAt(hit.x, hit.y, SPRITES.star, 3);
      return;
    }
    // 마을 게시판 — 다음 일정 한 줄
    if (hit.key === 'sign' && boardLine) {
      sfx('prop'); say(boardLine, hit); popAt(hit.x, hit.y, SPRITES.heart, 2); return;
    }
    // 키 재기 기둥 — 두 아이의 키 눈금을 기둥에 얹는다
    if (hit.key === 'ruler') { sfx('prop'); showHeights(hit); return; }
    // 소품 — 이름이 없으니 소리만 낸다
    const memo = said['prop:' + hit.key] || (said['prop:' + hit.key] = { last:-1 });
    sfx(SOUND[hit.key] ? hit.key : 'prop');
    say(pickLine(PROP_LINES[hit.key] || ['톡'], memo), hit);
    popAt(hit.x, hit.y, hit.key === 'sun' || hit.key === 'moon' ? SPRITES.star : SPRITES.heart, 4);
  }

  // 잔디밭 빈자리를 누르면 꽃이 핀다.
  // 한 번에 하나씩, 방문당 다섯 송이까지 — 서버에도 같은 제한이 걸려 있지만
  // 여기서 먼저 막아야 눌러 놓고 거절당하는 일이 없다.
  const PLANT_MAX = 5;
  function plant(p){
    if (!VG) return;
    // 생일 밤에 하늘을 누르면 불꽃이 하나 더 터진다
    if (BIRTHDAY && NIGHT && p.y < horizon) { boom(p.x, p.y); kick(); return; }
    // 마을 잔디에만 — 길·광장·건물·물에는 안 심긴다
    const gy = Math.round(scrollY * 0.06 / S) * S;
    const w = VG.worldAt((p.x - panX) / HS, (p.y - gy) / HS);
    // 강을 누르면 오리 밥. 잔디가 아니면 여기서 끝난다
    if (w.kind === 'water' && w.ty > 10.4) { feed(w.tx, w.ty, p.x, p.y); return; }
    if (w.kind === 'plaza' && callCat(w.tx, w.ty)) return;
    if (STEP_KINDS[w.kind]) { step(w); return; }
    if (w.kind !== 'grass' && w.kind !== 'garden') return;
    // 눈 오는 날엔 꽃 대신 눈덩이. 눈 위에 꽃을 심는 것보다 눈사람을 만드는 편이 겨울답다
    if (weather.snow) { snowball(w, p); return; }
    if (plantedHere >= PLANT_MAX) return;
    const now = performance.now();
    if (now - plantAt < 1200) return;
    plantAt = now; plantedHere++;

    const f = { xr: w.tx / VG.PW, yr: w.ty / VG.PD, k: Math.floor(Math.random() * SCENE.petal.length), age: 0 };
    planted.push(f);
    popAt(p.x, p.y, SPRITES.heart, 2);
    sfx('plant');
    kick();
    // 남겨 두는 건 덤이다. 표가 없거나 실패해도 이 화면의 꽃은 그대로 핀다.
    sb.from('garden').insert({
      xr: Math.round(f.xr * 1000), yr: Math.round(f.yr * 1000), kind: f.k,
    }).then(() => {}, () => {});
  }

  // 길·광장·마당을 누르면 발자국이 남는다 — 손님이 다녀간 자리. 하루 지나면 옅어져 사라진다.
  // 꽃과 달리 소리도 하트도 없다. 지나간 자국이지 심은 것이 아니라서.
  const STEP_KINDS = { cobble: 1, plaza: 1, dirt: 1, court: 1 };
  const STEP_MAX = 12;
  function step(w){
    if (steppedHere >= STEP_MAX) return;
    const now = performance.now();
    if (now - stepAt < 400) return;
    stepAt = now; steppedHere++;
    const s = { xr: w.tx / VG.PW, yr: w.ty / VG.PD, dir: steppedHere % 2, at: Date.now(), wet: performance.now() < wetUntil };
    steps.push(s);
    canvas.dataset.steps = steps.length;                 // 시험용
    kick();
    sb.from('steps').insert({ xr: Math.round(s.xr * 1000), yr: Math.round(s.yr * 1000), dir: s.dir }).then(() => {}, () => {});
  }
  // 남이 남긴 발자국 — 하루 안의 것만, 최근 200개까지
  sb.from('steps').select('xr, yr, dir, created_at')
    .gte('created_at', new Date(Date.now() - 86400e3).toISOString())
    .order('id', { ascending: false }).limit(200)
    .then(({ data }) => {
      if (!data) return;
      steps = data.map(r => ({ xr: r.xr / 1000, yr: r.yr / 1000, dir: r.dir || 0, at: new Date(r.created_at).getTime() })).concat(steps);
      canvas.dataset.steps = steps.length;
      kick();
    }, () => {});

  // 남이 심어 둔 꽃 불러오기 — 최근 것부터 120송이까지만.
  // 다 그리면 화면이 꽃밭이 되고, 오래된 것부터 자연스럽게 밀려나는 편이 낫다.
  // 심은 시각도 같이 받는다 — 갓 심은 것은 새싹으로, 오래된 것은 꽃으로 그리려고.
  sb.from('garden').select('xr, yr, kind, created_at').order('id', { ascending: false }).limit(120)
    .then(({ data }) => {
      if (!data) return;
      const now = Date.now();
      planted = data.map(r => ({
        xr: r.xr / 1000, yr: r.yr / 1000, k: r.kind || 0,
        age: r.created_at ? now - new Date(r.created_at).getTime() : null,
      })).concat(planted);
      kick();
    }, () => {});

  // 이젤에 걸 그림 — 가장 최근 작품 한 점.
  // 포트폴리오는 작품 하나만 여는 주소가 없어서 전시실 입구로 보낸다.
  // 아이 목소리가 붙은 작품이 있으면 그걸 먼저 건다 — 첫 화면에서 아이 목소리가 나오게.
  sb.from('works').select('id, title, quote, thumb_url, media_url, media_type, audio_url')
    .eq('media_type', 'image')
    .order('audio_url', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).limit(1)
    .then(({ data }) => {
      const w = data && data[0];
      if (!w) return;
      const img = new Image();
      img.onload = () => {
        easelImg = img; easelHref = '/portfolio.html';
        if (w.audio_url) {
          easelAudio = w.audio_url;
          const line = (w.quote || w.title || '').trim();
          easelLine = line.length > 22 ? line.slice(0, 21) + '…' : line;
        }
        kick();
      };
      img.src = w.thumb_url || w.media_url;
    }, () => {});

  // ---- 마을이 아는 우리 이야기 ----
  // 타워를 누르면 그 앞에서 찍은 날이 있으면 그 날을, 게시판을 누르면 다음 일정을 말한다.
  // 날짜를 손으로 박아 두지 않는다 — 이벤트가 하나 늘면 마을이 저절로 새 말을 한다.
  const towerVisit = { lotte: null, nseoul: null };
  let boardLine = null;
  const ymLabel = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? Number(m[1]) + '년 ' + Number(m[2]) + '월' : null; };
  Promise.all([
    metaOnce,
    sb.from('events').select('event_id, title, place_name').then(r => r.data || [], () => []),
  ]).then(([metas, evs]) => {
    const dateOf = {};
    metas.forEach(m => { dateOf[m.event_id] = m.start_date; });
    const hit = (row, word) => (row.place_name || '').indexOf(word) >= 0 || (row.title || '').indexOf(word) >= 0;
    [['lotte', '롯데'], ['nseoul', '남산']].forEach(([key, word]) => {
      const row = evs.filter(e => hit(e, word)).sort((a, b) => String(dateOf[b.event_id] || '').localeCompare(String(dateOf[a.event_id] || '')))[0];
      if (row) towerVisit[key] = ymLabel(dateOf[row.event_id]);
    });
    // 게시판 — 앞으로 올 일이 있으면 그것을, 없으면 가장 가까운 지난 일을 적는다
    const today = new Date().toISOString().slice(0, 10);
    const ahead = metas.filter(m => m.start_date && m.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const past = metas.filter(m => m.start_date && m.start_date < today).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    const pick = ahead || past;
    if (pick) boardLine = (ahead ? '다음은 ' : '지난 ') + ymLabel(pick.start_date) + ' · ' + pick.event_name;
  });

  // ---- 키 재기 기둥 ----
  // 성장 기록의 키만 손님에게 열려 있다(무게·발 크기는 가족만 본다). 누르면 그 키가
  // 기둥에 눈금으로 올라가고, 몇 초 뒤 사라진다.
  let heights = null, heightsAsked = false, rulerUntil = 0;
  const RULER_MS = 7000;
  function showHeights(hit){
    const tell = () => {
      if (!heights || (!heights.sua && !heights.yona)) { say('아직 잰 키가 없어', hit); return; }
      rulerUntil = performance.now() + RULER_MS;
      const bits = [];
      if (heights.sua)  bits.push('수아 ' + heights.sua + 'cm');
      if (heights.yona) bits.push('연아 ' + heights.yona + 'cm');
      say(bits.join(' · '), hit);
      kick();
    };
    if (heights) { tell(); return; }
    if (heightsAsked) { say('재는 중…', hit); return; }
    heightsAsked = true;
    say('키 재는 중…', hit);
    sb.from('growth').select('who, cm, measured_on').eq('kind', 'height')
      .order('measured_on', { ascending: false })
      .then(({ data }) => {
        heights = {};
        (data || []).forEach(r => { if (!heights[r.who]) heights[r.who] = Math.round(Number(r.cm)); });
        tell();
      }, () => { heights = {}; tell(); });
  }
  // 기둥에 눈금을 얹는다 — 마을 도트 자리에 맞춰 그리므로 화면 크기와 상관없이 같은 높이다
  function drawRuler(gx, gy){
    if (!VG || !VG.ruler || performance.now() > rulerUntil || !heights) return;
    const R = VG.ruler, s = Math.max(1, Math.round(HS));
    const rows = [['sua', heights.sua, '#e86a5c'], ['yona', heights.yona, '#4f8fd6']];
    rows.forEach(([, cm, col]) => {
      if (!cm) return;
      const f = Math.max(0, Math.min(1, (cm - R.cm0) / (R.cm1 - R.cm0)));
      const y = Math.round((R.y - f * R.h) * HS + gy);
      const x = Math.round((R.x - 4) * HS + gx);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, Math.round(9 * HS), s);              // 눈금 한 줄
      ctx.fillRect(x - Math.round(2 * HS), y - s, s * 2, s * 3);  // 왼쪽 끝의 작은 깃발
    });
  }

  // ---- 먼저 말 걸기 ----
  // 처음 한 번은 조금 빨리(4초), 그 뒤로는 12초마다. 스크롤로 첫 화면을 벗어나면 멈춘다.
  let idleAt = performance.now(), greeted = false;
  const LAST_KEY = 'sy.lastVisit';
  let awayDays = 0;
  try {
    const prev = Number(localStorage.getItem(LAST_KEY) || 0);
    if (prev) awayDays = Math.floor((Date.now() - prev) / 86400000);
    localStorage.setItem(LAST_KEY, String(Date.now()));
  } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  setInterval(() => {
    if (document.hidden || scrollY > H * 0.5) return;
    const wait = greeted ? 12000 : 4000;
    if (performance.now() - idleAt < wait) return;
    const talkers = hits.filter(h => h.kind === 'char' && !h.hide);
    if (!talkers.length) return;
    const who = talkers[Math.floor(Math.random() * talkers.length)];
    // 오랜만에 온 사람에게는 그 말부터. 하루 안에 다시 온 사람에게 "오랜만" 은 어색하다.
    if (talk) return;                                    // 대화 중엔 끼어들지 않는다
    const lines = BIRTHDAY ? CONGRATS : hiding() ? HIDE_LINES : (!greeted && awayDays >= 3) ? BACK_LINES : GREET[PHASE];
    const memo = said['greet'] || (said['greet'] = { last:-1 });
    greeted = true;
    say(pickLine(lines, memo), who);
  }, 1000);

  syncHud();
  if (BIRTHDAY) {
    const b = $('#bdayHud');
    if (b) { b.textContent = '🎂 오늘은 ' + BIRTHDAY + ' 생일!'; b.hidden = false; }
  }

  // 창 크기를 끄는 동안 300ms 짜리 마을 그리기를 매번 하지 않게 조금 기다린다
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { resize(); draw(); }, 120); });
  window.addEventListener('scroll', () => { scrollY = window.scrollY; if (reduce) draw(); }, {passive:true});
  resize();
  if (reduce) draw(); else loop();
})();

// ================= 카드 아이콘 =================
// 메뉴 카드와 첫 화면 바로가기 단추가 같은 도트 아이콘을 쓴다
$$('canvas[data-icon]').forEach(cv => {
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sp = SPRITES[cv.dataset.icon];
  if (!sp) return;
  const w = sp[0].length, h = sp.length;
  const s = Math.floor(Math.min(cv.width / w, cv.height / h));
  drawSprite(ctx, sp, Math.floor((cv.width - w*s)/2), Math.floor((cv.height - h*s)/2), s);
});

// ================= 메뉴 카드에 선 캐릭터 =================
// 어디로 가는 곳인지 글로만 적혀 있었다. 카드마다 그곳의 친구를 하나씩 세워
// 첫 화면의 등장인물과 메뉴를 한 식구로 묶는다.
$$('canvas[data-char]').forEach(cv => {
  const sp = SPRITES[cv.dataset.char];
  if (!sp) return;
  // 스프라이트마다 원래 크기가 제각각이라(수아 42칸, 상그렐라 18칸) 배율을 그때그때 잡아
  // 화면에서 보이는 크기를 46px 안팎으로 맞춘다. 줄이지는 않는다 — 도트는 줄이면 뭉개진다.
  const s = Math.max(1, Math.floor(46 / Math.max(sp[0].length, sp.length)));
  cv.width = sp[0].length * s; cv.height = sp.length * s;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawSprite(g, sp, 0, 0, s);
});

// ================= 도트 그리기 미리보기 =================
(function(){
  const cv = $('#drawPeek'); if (!cv) return;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const N = 16, C = cv.width / N;                 // 16칸짜리 도트판
  g.fillStyle = '#fffaf2'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(47,42,36,.13)';
  for (let i = 1; i < N; i++) {
    g.fillRect(Math.round(i * C), 0, 1, cv.height);
    g.fillRect(0, Math.round(i * C), cv.width, 1);
  }
  drawSprite(g, SPRITES.heart, C * 4, C * 5, C);  // 한 칸이 곧 도트판 한 칸
})();

// ================= 우리가 쌓은 것 =================
// 줄을 받아와서 세지 않는다. 서버가 다섯 숫자를 한 번에 세어서 준다(home_counts).
// 그 함수는 부른 사람의 권한으로 세기 때문에, 화면에 뜨는 수와 실제로 볼 수 있는 수가 늘 같다.
(async () => {
  const c = await countsOnce;
  const nums = {
    works: c.works || 0, posts: c.posts || 0,
    photos: c.photos || 0, events: c.events || 0,
  };

  // ---- 배지 ----
  // 다음 고개를 흐리게라도 보여 준다. 다 받은 것만 늘어놓으면 여기서 끝인 줄 안다.
  const BADGES = [
    { n:'작품 10점',  f:'works',  need:10,  icon:'🎨' },
    { n:'작품 25점',  f:'works',  need:25,  icon:'🖼' },
    { n:'작품 50점',  f:'works',  need:50,  icon:'🏆' },
    { n:'일기 10편',  f:'posts',  need:10,  icon:'📓' },
    { n:'사진 100장', f:'photos', need:100, icon:'📷' },
    { n:'사진 300장', f:'photos', need:300, icon:'📸' },
    { n:'나들이 5번', f:'events', need:5,   icon:'🧭' },
  ];
  const badgeBox = $('#badges');
  if (badgeBox) {
    const got = BADGES.filter(b => nums[b.f] >= b.need);
    // 아직 못 받은 것 중 가장 가까운 하나만 흐리게 곁들인다
    const next = BADGES.filter(b => nums[b.f] < b.need)
      .sort((a, b) => (a.need - nums[a.f]) - (b.need - nums[b.f]))[0];
    badgeBox.innerHTML =
      got.map(b => '<span class="badge">' + b.icon + ' ' + b.n + '</span>').join('') +
      (next ? '<span class="badge locked">' + next.icon + ' ' + next.n +
              ' (' + (next.need - nums[next.f]) + ' 남음)</span>' : '');
  }

  // ---- 작품 도감 ----
  // 전시실에서 실제로 열어 본 작품만 센다. 이 브라우저에만 남는다.
  const dex = $('#dexLine');
  if (dex && nums.works) {
    let seenWorks = [];
    try { seenWorks = JSON.parse(localStorage.getItem('sy.dex') || '[]'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    const n = Math.min(seenWorks.length, nums.works);
    dex.hidden = false;
    dex.textContent = n >= nums.works
      ? '🏅 도감 완성! 작품 ' + nums.works + '점을 다 봤어요'
      : '📖 도감 ' + n + '/' + nums.works + ' — 전시실에서 작품을 열면 도감에 담겨요';
    // 숫자보다 칸이 눈에 빨리 들어온다. 너무 많으면 칸이 안 보이니 60칸에서 멈춘다.
    const bar = $('#dexBar');
    if (bar){
      const cells = Math.min(nums.works, 60);
      const on = Math.round(cells * n / nums.works);
      bar.innerHTML = Array.from({ length: cells },
        (_, i) => '<i' + (i < on ? ' class="on"' : '') + '></i>').join('');
      bar.hidden = false;
    }
  }

  // ---- 올해의 우리 카드 ----
  // 서버 숫자와 이 브라우저에만 있는 것(도감·도장·최고 점수)을 한 장에 모은다.
  // 그림은 캔버스로 그려서 그대로 PNG 로 내려받는다 — 서버를 더 부르지 않는다.
  const yBtn = $('#yearBtn'), yCard = $('#yearCard'), ySave = $('#yearSave');
  if (yBtn && yCard) yBtn.addEventListener('click', () => {
    const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
    let dexN = 0, stamps = 0;
    try { dexN = (JSON.parse(localStorage.getItem('sy.dex') || '[]') || []).length; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    // 출석 도장은 sy.stamps 에 날짜 문자열로 쌓이고 최근 70일치만 남는다.
    // 그래서 「올해 몇 번」이 아니라 「최근 며칠」이다.
    try {
      const st = JSON.parse(localStorage.getItem('sy.stamps') || '[]');
      stamps = Array.isArray(st) ? st.length : 0;
    } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    const best = Math.max(0, parseInt(get('sy.run.best', '0'), 10) || 0);
    const year = new Date().getFullYear();

    const g = yCard.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#fff6e9'; g.fillRect(0, 0, yCard.width, yCard.height);
    // 모험단 도감을 채운 무대의 하늘을 배경으로. 글자가 읽히게 반투명으로 깐다.
    const skySel = $('#yearSky');
    const sky = skySel && skySel.value ? (window.__questSkies || {})[skySel.value] : null;
    if (sky){
      g.globalAlpha = 0.55;
      sky.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * (yCard.height / 5), yCard.width, yCard.height / 5 + 1); });
      g.globalAlpha = 1;
    }
    g.fillStyle = '#3a3226';
    g.fillRect(0, 0, yCard.width, 4); g.fillRect(0, yCard.height - 4, yCard.width, 4);
    g.fillRect(0, 0, 4, yCard.height); g.fillRect(yCard.width - 4, 0, 4, yCard.height);

    g.textAlign = 'center';
    g.fillStyle = '#3a3226';
    g.font = '800 20px Suayona Dot, Suayona Sans, sans-serif';
    g.fillText(year + ' 수아랑 연아랑', yCard.width / 2, 36);

    g.font = '800 12px Suayona Dot, Suayona Sans, sans-serif';
    const rows = [
      ['작품', nums.works + '점'],   ['일기', nums.posts + '편'],
      ['사진', nums.photos + '장'],  ['나들이', nums.events + '번'],
      ['도감', dexN + '/' + nums.works], ['달리기', best + '점'],
      ['최근 출석', stamps + '일'],
    ];
    rows.forEach((r, i) => {
      const x = 62 + (i % 2) * 132, y = 68 + Math.floor(i / 2) * 22;
      g.textAlign = 'right'; g.fillStyle = '#6b5f4e'; g.fillText(r[0], x + 34, y);
      g.textAlign = 'left';  g.fillStyle = '#3a3226'; g.fillText(r[1], x + 40, y);
    });

    // 아래쪽에 둘을 세운다. 글자와 겹치지 않게 카드를 230 으로 키웠다.
    drawSprite(g, SPRITES.sua,  16, 142, 2);
    drawSprite(g, SPRITES.yona, 220, 150, 2);
    g.textAlign = 'center'; g.fillStyle = '#6b5f4e';
    g.font = '800 11px Suayona Dot, Suayona Sans, sans-serif';
    g.fillText('www.suayona.com', yCard.width / 2, 208);
    g.textAlign = 'start';

    yCard.hidden = false;
    if (ySave){
      ySave.href = yCard.toDataURL('image/png');
      ySave.download = 'suayona-' + year + '.png';
      ySave.hidden = false;
      ySave.textContent = '카드 저장하기';
    }
    yBtn.textContent = '🗓 다시 만들기';
  });

  function countUp(el, target){
    const dur = 900, t0 = performance.now();
    requestAnimationFrame(function step(now){
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    });
  }

  // 화면에 들어올 때 올라가야 의미가 있다. 스크롤 전에 다 올라가 버리면 아무도 못 본다.
  const seen = new WeakSet();
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting || seen.has(en.target)) return;
      seen.add(en.target);
      countUp(en.target, nums[en.target.dataset.count] || 0);
    });
  }, { threshold: 0.4 });
  $$('[data-count]').forEach(el => io.observe(el));
})().catch(() => {});

// ================= 출석 도장 =================
// 이번 달 달력에 들어온 날마다 도장이 찍힌다. 이 브라우저에만 남는다 —
// 자매가 각자 자기 것을 모으는 편이 맞고, 남의 출석은 세어 봐야 재미가 없다.
(function(){
  const grid = $('#stampGrid'); if (!grid) return;
  const KEY = 'sy.stamps';
  let days = [];
  try { days = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  if (days.indexOf(today) < 0) {
    days.push(today);
    // 두 달치만 남긴다. 몇 년을 모으면 저장 칸만 차지하고 화면에는 안 나온다.
    days = days.slice(-70);
    try { localStorage.setItem(KEY, JSON.stringify(days)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  }
  const set = new Set(days);

  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1).getDay();          // 0=일
  const last = new Date(y, m + 1, 0).getDate();
  $('#stampMonth').textContent = y + '년 ' + (m + 1) + '월';

  let html = '';
  for (let i = 0; i < first; i++) html += '<div class="stamp-cell pad"></div>';
  for (let d = 1; d <= last; d++) {
    const key = y + '-' + pad(m + 1) + '-' + pad(d);
    const on = set.has(key), isToday = key === today;
    // 도장이 찍힌 날도 날짜는 남는다 — 별로 갈아 치우면 며칠인지 알 수가 없다.
    html += '<div class="stamp-cell' + (on ? ' on' : '') + (isToday ? ' today' : '') +
            '" title="' + (m + 1) + '월 ' + d + '일' + (on ? ' · 다녀감' : '') + '">' + d +
            (on ? '<span class="st">⭐</span>' : '') + '</div>';
  }
  grid.innerHTML = html;

  // 오늘부터 거꾸로 며칠이나 이어졌나
  let streak = 0;
  for (let i = 0; ; i++) {
    const dt = new Date(y, m, now.getDate() - i);
    const key = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    if (!set.has(key)) break;
    streak++;
  }
  $('#stampSay').textContent = streak >= 2
    ? streak + '일째 이어서 왔어요! 내일도 오면 ' + (streak + 1) + '일'
    : '들어올 때마다 오늘 칸에 도장이 찍혀요';
})();

// ================= 오늘의 대결 · 이어그리기 =================
// 그리기에서 같은 주제로 각자 그린 것을 나란히 건다.
// 이어그리기 알림도 같은 표라, 한 번만 불러서 둘 다 만든다.
belowFold(async () => {
  const grid = $('#duelGrid'); if (!grid) return;
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const { data } = await sb.from('doodles')
    .select('id, author, n, cells, theme, kind, relay_of, created_at')
    .in('kind', ['duel', 'relay']).eq('made_on', today)
    .order('created_at', { ascending: true });
  if (!data || !data.length) return;

  const duels = data.filter(r => r.kind === 'duel');
  if (duels.length){
    // 한 사람이 여러 번 냈으면 마지막 것만
    const last = new Map();
    duels.forEach(r => last.set(r.author, r));
    $('#duelTheme').textContent = '주제 — ' + (duels[0].theme || '오늘의 미션');
    [...last.values()].forEach(r => {
      const cell = document.createElement('div');
      cell.className = 'duel-cell reveal';
      cell.appendChild(drawingToCanvas({ n: r.n, s: r.cells }));
      const who = document.createElement('span');
      who.className = 'who pixel'; who.textContent = NM(r.author);
      cell.appendChild(who);
      grid.appendChild(cell);
      revealNow(cell);
    });
  } else {
    $('#duelTheme').textContent = '';
  }

  // 오늘 누가 누구 그림을 이어 그렸는지. 원본은 relay_of 로 가리키는데,
  // 오늘 것이 아닐 수 있어서 없으면 이어 그린 쪽만 보여 준다.
  const relay = data.filter(r => r.kind === 'relay' && r.relay_of).slice(-1)[0];
  if (relay){
    const from = data.find(r => r.id === relay.relay_of);
    const note = $('#relayNote');
    note.innerHTML = '';
    if (from) note.appendChild(drawingToCanvas({ n: from.n, s: from.cells }));
    const say = document.createElement('span');
    const a = NM(relay.author);
    say.textContent = '🖍 ' + a + J(a, '이', '가') + ' ' +
      (from ? NM(from.author) + ' 그림을 이어 그렸어요' : '그림을 이어 그렸어요');
    note.appendChild(say);
    note.appendChild(drawingToCanvas({ n: relay.n, s: relay.cells }));
    note.hidden = false;
  }

  if (duels.length || relay) $('#duel').hidden = false;
});

// ================= 올해의 카드 배경 =================
// 「우리 모험단」 칸은 뺐지만, 도감을 채운 무대의 하늘은 올해의 카드가 여전히 쓴다.
// 세이브 요약만 한 번 읽어 하늘 목록을 채운다.
belowFold(async () => {
  const sel = $('#yearSky'); if (!sel) return;
  const { data } = await sb.rpc('quest_cards');
  const rows = (data || []).filter(r => r.data && r.data.lv);
  if (!rows.length) return;
  const skies = {};
  rows.forEach(r => (r.data.dexSkies || []).forEach(s2 => { if (s2 && s2.name && Array.isArray(s2.sky)) skies[s2.name] = s2.sky; }));
  if (!Object.keys(skies).length) return;
  window.__questSkies = skies;
  Object.keys(skies).forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n + ' 하늘'; sel.appendChild(o); });
  sel.hidden = false;
});

// ================= 얼마나 컸을까 =================
// 집 문틀에 해마다 새기던 눈금. 그래프는 손님도 보고, 새 눈금은 로그인한 가족만 새긴다.
belowFold(async () => {
  const cv = $('#growthCanvas'); if (!cv) return;
  const COLORS = { sua: '#ff7f8a', yona: '#6cc7b3' };     // growth.who 는 이제 sua/yona 다
  // 종류마다 단위와 말이 되는 범위가 다르다. 서버 규칙과 같은 값을 쓴다.
  const KINDS = {
    height: { label: '키',      unit: 'cm', min: 50, max: 200, step: 10 },
    foot:   { label: '발 크기', unit: 'cm', min: 10, max: 35,  step: 2  },
    weight: { label: '몸무게',  unit: 'kg', min: 5,  max: 120, step: 5  },
  };
  let kind = 'height';
  let rows = [];                      // 한 번 받아 두고 종류만 갈아 끼운다

  async function draw(){
    if (!rows.length){
      const { data } = await sb.from('growth')
        .select('who, measured_on, cm, kind').order('measured_on', { ascending: true });
      rows = data || [];
    }
    const K = KINDS[kind];
    const data = rows.filter(r => (r.kind || 'height') === kind);
    // 종류 단추는 실제로 잰 적이 있는 것만 켠다 — 눌렀는데 빈 그래프가 나오면 고장 같다.
    $$('#gKind button').forEach(b => {
      const has = rows.some(r => (r.kind || 'height') === b.dataset.kind);
      b.hidden = !has && b.dataset.kind !== 'height';
      b.classList.toggle('on', b.dataset.kind === kind);
    });
    if (!rows.length) { $('#growth').hidden = true; return; }
    $('#growth').hidden = false;
    if (!data.length){
      const g0 = cv.getContext('2d');
      g0.clearRect(0, 0, cv.width, cv.height);
      g0.fillStyle = '#fff6e9'; g0.fillRect(0, 0, cv.width, cv.height);
      g0.fillStyle = '#6b5f4e'; g0.textAlign = 'center';
      g0.font = '800 ' + Math.round(16 * Math.max(1, Math.min(2, cv.width / (cv.getBoundingClientRect().width || cv.width)))) +
        'px Suayona Sans, Pretendard, sans-serif';
      g0.fillText('아직 ' + K.label + J(K.label, '을', '를') + ' 잰 적이 없어요',
        cv.width / 2, cv.height / 2);
      g0.textAlign = 'start';
      $('#growthLegend').innerHTML = '';
      return;
    }

    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const W = cv.width, H = cv.height, S = 4;
    // 좁은 화면에서는 이 그림이 절반 크기로 줄어 앉는다 — 11px 글씨가 6px 이 돼 안 읽힌다.
    // 줄어든 만큼 글씨와 자리를 키워서, 화면에 찍히는 크기는 어디서나 비슷하게 만든다.
    const shown = cv.getBoundingClientRect().width || W;
    const k = Math.max(1, Math.min(2, W / shown));
    const FS = Math.round(11 * k);
    g.clearRect(0, 0, W, H);

    // 문틀 — 도트로 굵게
    g.fillStyle = '#c79b6d';
    g.fillRect(0, 0, S * 4, H); g.fillRect(W - S * 4, 0, S * 4, H);
    g.fillStyle = '#a97b4f';
    g.fillRect(S * 3, 0, S, H); g.fillRect(W - S * 4, 0, S, H);
    g.fillStyle = '#fff6e9';
    g.fillRect(S * 4, 0, W - S * 8, H);

    const K2 = KINDS[kind];
    const lo = Math.floor(Math.min(...data.map(r => Number(r.cm))) / K2.step) * K2.step - K2.step / 2;
    const hi = Math.ceil(Math.max(...data.map(r => Number(r.cm))) / K2.step) * K2.step + K2.step / 2;
    const y = cm => Math.round((H - S * 6) * (hi - cm) / (hi - lo) / S) * S + S * 3;

    // 종류에 맞는 간격으로 가로줄. 눈금 글씨는 줄 왼쪽 끝에 두고, 눈금 막대는 그 오른쪽에서
    // 시작한다 — 예전에는 막대가 글씨 위를 지나가 「140cm」이 반쯤 지워졌다.
    const AX = Math.round(S * 16 * k);
    g.font = '600 ' + FS + 'px Suayona Sans, Pretendard, sans-serif';
    for (let c = Math.ceil(lo / K2.step) * K2.step; c <= hi; c += K2.step) {
      g.fillStyle = 'rgba(47,42,36,.18)';
      g.fillRect(AX, y(c), W - S * 5 - AX, 1);
      g.fillStyle = 'rgba(47,42,36,.55)';
      g.fillText(c + K2.unit, S * 2, y(c) + Math.round(FS * 0.36));
    }

    // 사람마다 눈금 — 도트 네모 하나와 날짜.
    // 가까운 날에 잰 값은 줄 사이가 좁아 글씨끼리 겹쳤다(3cm 차이 = 18px, 글씨는 11px+막대 8px).
    // 그래서 글씨만 위아래로 밀어 띄우고, 밀린 만큼 가는 선으로 제 줄과 이어 준다.
    const byWho = {};
    data.forEach(r => (byWho[r.who] = byWho[r.who] || []).push(r));
    const marks = [];
    Object.keys(byWho).forEach((who, wi) => {
      byWho[who].forEach(r => marks.push({
        who, wi, col: COLORS[who] || '#ffd979', cm: Number(r.cm),
        on: String(r.measured_on), y: y(Number(r.cm)),
      }));
    });
    marks.sort((a, b) => a.y - b.y);
    const GAP = Math.round(S * 4 * k);                  // 글씨 한 줄이 차지하는 최소 높이
    let last = -1e9;
    marks.forEach(m => { m.ty = Math.max(m.y - S * 2, last + GAP); last = m.ty; });
    const spill = last - (H - S * 2);                   // 아래로 넘치면 통째로 끌어올린다
    if (spill > 0) marks.forEach(m => { m.ty -= spill; });

    // 막대를 먼저 다 긋고, 글씨는 그 위에 올린다 — 순서를 섞으면 나중 막대가 앞 글씨를 지운다.
    marks.forEach(m => {
      const x0 = AX + S * 2 + m.wi * S * 3 * k;
      m.x0 = x0;
      g.fillStyle = m.col;
      g.fillRect(x0, m.y - S, W - S * 5 - x0, S * 2);
    });
    g.font = '800 ' + FS + 'px Suayona Sans, Pretendard, sans-serif';
    marks.forEach(m => {
      const drift = m.ty - (m.y - S * 2);
      if (Math.abs(drift) > 2){                         // 글씨가 제 줄에서 떨어졌으면 이어 준다
        g.fillStyle = 'rgba(47,42,36,.4)';
        g.fillRect(m.x0 + 1, Math.min(m.ty + 2, m.y - S), 1, Math.abs(drift));
      }
      // 눈금이 촘촘하면 글씨가 어느 막대 위에든 앉게 된다. 밑에 종이색 판을 깔아
      // 막대가 글자를 가로지르지 않게 한다.
      const label = heroName(m.who) + ' ' + m.cm + K2.unit + ' (' + m.on.slice(2, 7).replace('-', '.') + ')';
      const tw = g.measureText(label).width;
      g.fillStyle = '#fff6e9';
      g.fillRect(m.x0 + 2, m.ty - FS + 1, tw + 5, FS + 3);
      g.fillStyle = '#2f2a24';
      g.fillText(label, m.x0 + 4, m.ty);
    });

    $('#growthLegend').innerHTML = Object.keys(byWho).map(who =>
      '<span><i style="background:' + (COLORS[who] || '#ffd979') + '"></i>' + escapeHTML(heroName(who)) +
      ' · ' + byWho[who].length + '번 쟀어요</span>').join('');
  }

  let redraw = 0;
  window.addEventListener('resize', () => { clearTimeout(redraw); redraw = setTimeout(draw, 200); });

  $$('#gKind button').forEach(b => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    const K = KINDS[kind];
    const box = $('#gCm');
    if (box){
      box.placeholder = K.label + '(' + K.unit + ')';
      box.min = K.min; box.max = K.max; box.value = '';
    }
    draw();
  }));

  await draw();

  // 그래프는 누구나 본다(위 draw 가 이미 펼쳤다). 눈금을 새기는 건 로그인한 가족만 —
  // 재는 건 부모지만 아이가 자기 키를 적어 보는 것도 이 집에서는 놀이다.
  await authOnce;
  if (!isLoggedIn) return;
  $('#growthAdd').hidden = false;
  const today = new Date();
  $('#gWhen').value = today.toISOString().slice(0, 10);
  $('#gSave').addEventListener('click', async () => {
    const msg = $('#gMsg');
    const K = KINDS[kind];
    const raw = $('#gCm').value.trim();
    const cm = Number(raw);
    if (!raw || !isFinite(cm) || cm === 0) {
      msg.textContent = K.label + J(K.label, '을', '를') + ' 적어주세요'; return;
    }
    // 서버도 같은 범위만 받는다. 여기서 먼저 막아야 「무슨 소린지 모를 영어」 대신
    // 무엇이 잘못됐는지가 보인다 — 키를 미터로 1.3 이라 적으면 늘 걸린다.
    if (cm < K.min || cm > K.max) {
      msg.textContent = K.label + J(K.label, '은', '는') + ' ' + K.min + '~' + K.max + K.unit +
        ' 사이로 적어주세요. (적으신 값: ' + raw + ')';
      return;
    }
    const when = $('#gWhen').value;
    if (!when) { msg.textContent = '잰 날짜를 골라주세요'; return; }
    msg.textContent = '새기는 중...';
    const { error } = await sb.from('growth').upsert({
      who: $('#gWho').value, measured_on: when, kind, cm: Math.round(cm * 10) / 10,
    }, { onConflict: 'who,measured_on,kind' });
    msg.textContent = error ? ('안 됐어요: ' + readableError(error)) : '새겼어요!';
    if (!error) { $('#gCm').value = ''; rows = []; await draw(); }
  });
});

// ================= 다녀온 곳 =================
// 일정에 적힌 좌표가 어느 도(道)에 드는지 세어, 다녀온 곳만 색으로 칠한다.
belowFold(async () => {
  const cv = $('#koreaCanvas');
  if (!cv || typeof KOREA === 'undefined') return;      // 옛 pixel.js 와 짝이 되면 조용히 접는다
  // 다녀온 곳은 일정의 좌표에서, 가볼 곳은 places 에서 온다. 둘을 한 지도에 얹으면
  // 「어디를 갔고 어디가 남았나」에 더해 「다음에 어디로 갈 참인가」까지 보인다.
  const [{ data }, { data: wish }] = await Promise.all([
    sb.from('events')
      .select('event_id, place_lat, place_lng')
      .not('place_lat', 'is', null)
      .limit(2000),                                    // 좌표 있는 일정만 — 지금 28개, 난간일 뿐
    sb.from('places')
      .select('lat, lng')
      .eq('status', 'want')
      .not('lat', 'is', null)
      .limit(2000),
  ]);
  const been = new Map();                               // 지역 → 다녀온 이벤트 수
  const evOf = new Map();                               // 지역 → 그곳 이벤트 아이디들
  (data || []).forEach(r => {
    const k = koreaRegionAt(Number(r.place_lat), Number(r.place_lng));
    if (!k) return;
    been.set(k, (been.get(k) || 0) + 1);
    if (!evOf.has(k)) evOf.set(k, []);
    if (evOf.get(k).indexOf(r.event_id) < 0) evOf.get(k).push(r.event_id);
  });

  const willGo = new Map();                             // 지역 → 적어 둔 가볼 곳 수
  (wish || []).forEach(r => {
    const k = koreaRegionAt(Number(r.lat), Number(r.lng));
    if (!k) return;
    willGo.set(k, (willGo.get(k) || 0) + 1);
  });
  const 가볼곳수 = (wish || []).length;

  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const cols = KOREA[0].length, rows = KOREA.length;
  const s = Math.floor(Math.min(cv.width / cols, cv.height / rows));
  const ox = Math.floor((cv.width - cols * s) / 2);
  const oy = Math.floor((cv.height - rows * s) / 2);
  g.clearRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = KOREA[r][c];
      if (ch === '.') continue;
      // 다녀온 곳이 먼저다. 가 본 지역에 가볼 곳이 더 있어도 색은 민트로 둔다 —
      // 이 지도가 답하는 첫 물음은 「어디를 다녀왔나」이기 때문이다.
      g.fillStyle = been.has(ch) ? '#6cc7b3'
                  : willGo.has(ch) ? '#ffd979'
                  : '#e3ddd2';
      g.fillRect(ox + c * s, oy + r * s, s - 1, s - 1);
    }
  }

  const names = Object.keys(KOREA_NAMES);
  const gone = names.filter(k => been.has(k));
  const 갈곳지역 = names.filter(k => !been.has(k) && willGo.has(k));
  $('#mapCount').textContent = (gone.length
      ? '여덟 군데 중 ' + gone.length + '곳에 다녀왔어요'
      : '아직 지도가 비어 있어요') +
    (가볼곳수 ? ' · 가볼 곳 ' + 가볼곳수 + '군데를 적어 뒀어요' : '');
  $('#mapLegend').innerHTML =
    '<span><i style="background:#6cc7b3"></i>다녀온 곳 — ' +
      (gone.map(k => KOREA_NAMES[k]).join(', ') || '아직 없음') + '</span>' +
    (갈곳지역.length
      ? '<span><i style="background:#ffd979"></i>가볼 곳을 적어 둔 데 — ' +
        갈곳지역.map(k => KOREA_NAMES[k]).join(', ') + '</span>'
      : '') +
    '<span><i style="background:#e3ddd2"></i>아직 안 가 본 곳</span>';
  // 색칠된 곳을 누르면 그때 사진을 한 장만 떠 온다. 누르기 전엔 서버를 안 부른다.
  const shot = $('#mapShot');
  const shotCache = new Map();
  cv.addEventListener('click', async e => {
    const r = cv.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) * cv.width / r.width - ox) / s);
    const rr = Math.floor(((e.clientY - r.top) * cv.height / r.height - oy) / s);
    if (rr < 0 || rr >= rows || c < 0 || c >= cols) return;
    const ch = KOREA[rr][c];
    if (ch === '.' || !been.has(ch)) return;

    shot.hidden = false;
    if (shotCache.has(ch)) { shot.innerHTML = shotCache.get(ch); return; }
    shot.innerHTML = '<p class="cap">' + escapeHTML(KOREA_NAMES[ch]) + ' 사진을 찾는 중…</p>';
    const ids = evOf.get(ch) || [];
    const { data: pics } = await sb.from('gallery_media')
      .select('thumb_url, media_url, event_id')
      .in('event_id', ids).limit(1);
    const pic = (pics || [])[0];
    const html = pic
      ? '<img src="' + escapeHTML(pic.thumb_url || pic.media_url) + '" alt="" ' +
        'loading="lazy" decoding="async">' +
        '<p class="cap">' + escapeHTML(KOREA_NAMES[ch]) + ' · ' +
        (been.get(ch)) + '번 다녀왔어요</p>'
      : '<p class="cap">' + escapeHTML(KOREA_NAMES[ch]) + ' — 아직 올린 사진이 없어요</p>';
    shotCache.set(ch, html);
    shot.innerHTML = html;
  });

  $('#map').hidden = false;
});

// ================= 여긴 어디였을까? =================
// 사진은 갤러리에서 날짜로 한 장 고르고, 보기는 이벤트 이름 전부(최대 셋). 정답은 그 사진의 이벤트.
belowFold(async () => {
  // 사진을 전부 받아 와서 그중 한 장을 고르던 자리였다. 지금은 111장이라 3KB 지만
  // 사진은 해마다 늘기만 한다 — 한 장 고르자고 전부 받아 오는 모양은 언젠가 무거워진다.
  // 그래서 총 장수만 받아서 「오늘의 자리」를 셈하고, 그 자리부터 스무 장만 떠 온다.
  // 스무 장인 이유: 고른 자리의 사진이 이름 없는 이벤트일 수도 있어서 여유를 둔 것.
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const [metaAll, c] = await Promise.all([metaOnce, countsOnce]);
  const metas = metaAll.filter(m => m.event_name);
  const total = c.gallery_images || 0;
  if (metas.length < 2 || !total) return;

  const from = seed % total;
  const { data: slice } = await sb.from('gallery_media')
    .select('id, event_id, thumb_url, media_url')
    .eq('media_type', 'image').order('id').range(from, from + 20);
  const photos = (slice || []).filter(r => metas.some(m => m.event_id === r.event_id));
  if (!photos.length) return;
  const pick = photos[seed % photos.length];
  const answer = metas.find(m => m.event_id === pick.event_id);
  // 보기: 정답 + 다른 것들, 날짜로 섞어서 셋까지
  const others = metas.filter(m => m !== answer).sort((a, b) => prand(seed + a.event_id.length) - prand(seed + b.event_id.length));
  const choices = [answer].concat(others.slice(0, 2)).sort((a, b) => prand(seed * 3 + a.event_name.length) - prand(seed * 3 + b.event_name.length));

  const KEY = 'sy.quiz.' + seed;
  let solved = false;
  try { solved = localStorage.getItem(KEY) === 'ok'; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  $('#quizImg').src = pick.thumb_url || pick.media_url;
  const box = $('#quizChoices'), msg = $('#quizMsg');
  const href = '/event/e/?slug=' + encodeURIComponent(answer.event_id) + '&tab=gallery';
  const done = () => {
    msg.innerHTML = '딩동댕! ' + escapeHTML([answer.org_name, answer.event_name].filter(Boolean).join(' · ')) +
                    ' &nbsp;<a href="' + href + '">그날 사진 보러 가기 →</a>';
    box.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.dataset.id === answer.event_id) b.classList.add('right'); });
  };
  choices.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = m.event_name; b.dataset.id = m.event_id;
    b.addEventListener('click', () => {
      if (m === answer) { try { localStorage.setItem(KEY, 'ok'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ } done(); return; }
      b.classList.add('wrong'); b.disabled = true;
      msg.textContent = '아니야, 다시!';
    });
    box.appendChild(b);
  });
  if (solved) done();
  document.getElementById('quiz').hidden = false;
});

// ================= 방명록 도장 =================
// 손님이 이름을 안 적어도 다녀간 흔적이 남게 한다. 개인정보를 하나도 안 받는 게
// 핵심이다 — 서버에 남는 건 도장 번호와 찍은 때뿐이고, 그것도 정해진 열두 개 중 하나다.
const GB_KINDS = ['heart','star','flower','butterfly','cat','chick',
                  'fox','snail','mushroom','starfish','crab','squirrel'];
const GB_TODAY_KEY = 'sy.stamped';

// 도장 하나를 칸 하나에 꽉 차게 그린다. 스프라이트마다 크기가 달라서 배율을 그때 정한다.
function gbStamp(kind, box){
  const sp = SPRITES[GB_KINDS[kind]];
  if (!sp) return null;
  const w = sp[0].length, h = sp.length;
  const s = Math.max(1, Math.floor((box - 4) / Math.max(w, h)));
  const c = document.createElement('canvas');
  c.width = box; c.height = box;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawSprite(ctx, sp, Math.round((box - w * s) / 2), Math.round((box - h * s) / 2), s);
  return c;
}

belowFold(async () => {
  const wall = $('#gbWall'), pick = $('#gbPick'), go = $('#gbGo'), msg = $('#gbMsg');
  if (!wall) return;
  let chosen = Math.floor(Math.random() * GB_KINDS.length);

  // 고르는 줄
  GB_KINDS.forEach((k, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = i === chosen ? 'on' : '';
    b.title = '이 도장 고르기';
    b.setAttribute('aria-label', '도장 ' + (i + 1) + '번');
    const c = gbStamp(i, 30);
    if (c) b.appendChild(c);
    b.addEventListener('click', () => {
      chosen = i;
      Array.from(pick.children).forEach((x, j) => x.classList.toggle('on', j === i));
      sfx('pop');
    });
    pick.appendChild(b);
  });

  function put(kind, front){
    const c = gbStamp(kind, 26);
    if (!c) return;
    const none = wall.querySelector('.gb-none');
    if (none) none.remove();
    if (front) wall.prepend(c); else wall.appendChild(c);
  }

  // 최근 것부터 예순 개까지만 건다. 전부 그리면 화면이 도장으로 덮인다.
  // 총 개수는 같은 왕복에 딸려 온다 — 세러 한 번 더 가지 않는다.
  const { data, count } = await sb.from('stamps')
    .select('kind', { count: 'exact' })
    .order('id', { ascending: false }).limit(60);
  (data || []).forEach(r => put(r.kind, false));
  if (!data || !data.length) wall.innerHTML = '<span class="gb-none">아직 아무도 안 찍었어요. 첫 도장을 찍어 주세요!</span>';
  if (count) $('#gbCount').textContent = '지금까지 ' + count.toLocaleString('ko-KR') + '개의 도장이 찍혔어요';

  // 하루에 한 번이면 충분하다. 서버도 1분에 스무 개로 막아 두었다.
  function stampedToday(){
    try { return localStorage.getItem(GB_TODAY_KEY) === new Date().toDateString(); }
    catch (e) { return false; }
  }
  function lock(){
    go.disabled = true;
    go.textContent = '오늘은 찍었어요';
    msg.className = 'gb-msg';
    msg.textContent = '내일 또 들러 주세요';
  }
  if (stampedToday()) lock();

  go.addEventListener('click', async () => {
    go.disabled = true;
    msg.className = 'gb-msg'; msg.textContent = '';
    const { error } = await sb.from('stamps').insert({ kind: chosen });
    if (error) {
      go.disabled = false;
      msg.className = 'gb-msg err';
      msg.textContent = error.message || '찍지 못했어요. 잠시 뒤에 다시 해 주세요.';
      return;
    }
    put(chosen, true);
    sfx('plant');
    try { localStorage.setItem(GB_TODAY_KEY, new Date().toDateString()); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    lock();
    msg.textContent = '찍었어요! 고마워요';
  });
});

// ================= 1년 뒤의 나에게 =================
// 잠그는 건 서버다 — opens_on 이 오늘 이후인 줄은 읽기 규칙이 아예 안 돌려준다.
// 그래서 여기서는 열린 것만 그리고, 잠긴 건 개수와 다음 날짜만 함수로 받아 온다.
belowFold(async () => {
  const WHO = Object.assign({}, HERO_NAMES, { together:'수아와 연아' });
  const fmt = iso => { const d = new Date(iso); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; };

  async function loadOpened(){
    const { data } = await sb.from('capsules').select('author, body, opens_on, created_at, video_url')
      .order('opens_on', { ascending: false }).limit(20);
    const wrap = $('#capsuleOpened');
    wrap.innerHTML = '';
    (data || []).forEach(c => {
      const el = document.createElement('div');
      el.className = 'dot-card cap-open reveal';
      el.innerHTML = '<div class="from">🔓 ' + escapeHTML(WHO[c.author] || c.author) + ' · ' +
        escapeHTML(fmt(c.created_at)) + '에 써서 ' + escapeHTML(fmt(c.opens_on)) + '에 열림</div>' +
        '<p class="body">' + escapeHTML(c.body) + '</p>' +
        (c.video_url
          ? '<video class="cap-open-video" controls playsinline preload="none" src="' +
            escapeHTML(c.video_url) + '"></video>'
          : '');
      wrap.appendChild(el);
      revealNow(el);
    });
  }
  async function loadLocked(){
    const { data } = await sb.rpc('capsules_locked');
    const row = Array.isArray(data) ? data[0] : data;
    const el = $('#capLocked');
    if (!row || !Number(row.n)) { el.textContent = '아직 잠긴 편지가 없어요.'; return; }
    el.textContent = '🔒 잠긴 편지 ' + row.n + '통 · 다음은 ' + fmt(row.next_open) + ' 열려요';
  }

  let who = 'sua';
  $$('#capWho button').forEach(b => b.addEventListener('click', () => {
    who = b.dataset.who;
    $$('#capWho button').forEach(x => x.classList.toggle('on', x === b));
  }));
  const body = $('#capBody'), cnt = $('#capCount'), msg = $('#capMsg'), btn = $('#capSend');
  body.addEventListener('input', () => { cnt.textContent = body.value.length + '/200'; });

  // ---- 영상 남기기 ----
  // 가족만 보이게 한다. 손님에게 열면 로그인 없이 저장소를 채울 길이 생긴다.
  let capRecorder = null, capVideoBlob = null, capVideoExt = 'webm';
  const vRow = $('#capVideoRow'), vBtn = $('#capRec'), vState = $('#capVState'),
        vPlay = $('#capVPlay'), vDrop = $('#capVDrop');

  await authOnce;
  if (isLoggedIn && canRecordVideo()) vRow.hidden = false;

  function capVideoReset(){
    capVideoBlob = null;
    if (vPlay.src) { URL.revokeObjectURL(vPlay.src); vPlay.removeAttribute('src'); }
    vPlay.srcObject = null;
    vPlay.pause();
    vPlay.load();                 // 지운 뒤에도 마지막 장면이 남아 있지 않게
    vPlay.hidden = true; vDrop.hidden = true; vState.textContent = '';
    vBtn.textContent = '🎬 영상으로 남기기';
  }

  vDrop.addEventListener('click', capVideoReset);

  vBtn.addEventListener('click', async () => {
    if (capRecorder) {                       // 찍는 중이면 멈춘다
      const rec = capRecorder; capRecorder = null;
      vBtn.disabled = true;
      const { blob, secs } = await rec.stop();
      vBtn.disabled = false;
      capVideoBlob = blob; capVideoExt = rec.ext;
      vPlay.srcObject = null;
      vPlay.src = URL.createObjectURL(blob);
      vPlay.hidden = false; vPlay.muted = false; vDrop.hidden = false;
      vBtn.textContent = '🎬 다시 찍기';
      vState.textContent = secsLabel(secs) + ' · ' + Math.max(1, Math.round(blob.size / 102400) / 10) + 'MB';
      return;
    }
    capVideoReset();
    try {
      capRecorder = await startVideoRecorder(vPlay, s => {
        vState.textContent = '● 녹화 중 ' + secsLabel(s) + ' / ' + secsLabel(CAPSULE_MAX_SECS);
        if (s >= CAPSULE_MAX_SECS) vBtn.click();   // 1분에서 스스로 멈춘다
      });
      vPlay.hidden = false;
      vBtn.textContent = '⏹ 그만 찍기';
      vState.textContent = '● 녹화 중 0초';
    } catch (e) {
      capRecorder = null;
      vState.textContent = '카메라를 못 켰어요. 브라우저에서 허용해 주세요.';
    }
  });

  btn.addEventListener('click', async () => {
    const text = body.value.trim();
    msg.className = 'cap-msg'; msg.textContent = '';
    if (!text) { msg.className = 'cap-msg err'; msg.textContent = '한 줄이라도 적어주세요.'; return; }
    if (capRecorder) { msg.className = 'cap-msg err'; msg.textContent = '녹화를 먼저 멈춰주세요.'; return; }
    btn.disabled = true;
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    const opens = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const row = { author: who, body: text, opens_on: opens };
    // 영상은 글보다 먼저 올린다. 올리다 실패하면 편지를 넣지 않는 편이 낫다 —
    // 넣고 나면 잠겨서 1년 동안 고칠 수가 없다.
    if (capVideoBlob) {
      msg.className = 'cap-msg'; msg.textContent = '영상 올리는 중…';
      try { row.video_url = await uploadCapsuleVideo(capVideoBlob, capVideoExt); }
      catch (e) {
        btn.disabled = false;
        msg.className = 'cap-msg err'; msg.textContent = e.message;
        return;
      }
    }
    const { error } = await sb.from('capsules').insert(row);
    btn.disabled = false;
    if (error) { msg.className = 'cap-msg err'; msg.textContent = '못 넣었어요: ' + readableError(error); return; }
    body.value = ''; cnt.textContent = '0/200'; capVideoReset();
    msg.textContent = '🔒 잠갔어요. ' + fmt(opens) + '에 여기서 열려요.';
    loadLocked();
  });

  await Promise.all([loadOpened(), loadLocked()]);
});

// ================= 한 번 눌러 뛰기 =================
// 달리는 동안은 서버를 안 쓴다. 끝났을 때만 순위표를 한 번 읽고, 이름을 남기면
// 한 번 쓴다. 화면 밖이거나 탭이 가려지면 rAF 를 멈춰서 안 볼 때 배터리를 안 먹는다.
(function(){
  const canvas = document.getElementById('runCanvas');
  if (!canvas || typeof SPRITES === 'undefined') return;
  const ctx = canvas.getContext('2d');

  const GRAV     = 900;    // px/s^2
  const JUMP_V   = -300;   // 뛰어오르는 속도
  const PLAYER_X = 46;

  // 점프 4단계. 누른 시간을 그대로 쓰면 높이가 연속으로 변해서 「지금 몇 칸 뛴 건지」
  // 를 아이가 못 읽는다. 손을 뗀 시간을 네 칸 중 하나로 올려 맞춰, 같은 세기로 누르면
  // 늘 같은 높이가 나오게 했다. 실측 높이는 53 / 62 / 75 / 84px.
  // 첫 칸을 0 이 아니라 0.04 로 둔 건, 손을 떼는 순간이 아니라 「칸」 이 높이를
  // 정하게 하기 위해서다. 0 이면 1단계만 뗀 시점에 따라 48~53px 로 흔들렸다.
  const HOLD_TIERS = [0.04, 0.09, 0.175, 0.26];
  const HOLD_G     = 0.38;   // 누르는 동안의 중력 배수

  // 속도 10단계. 계속 조금씩 빨라지면 빨라지는 걸 못 느낀다. 계단으로 올리고
  // 올라갈 때 화면에 알려 준다. 한 계단이 곧 한 무대다.
  const SPEEDS  = [160, 185, 210, 236, 262, 290, 318, 346, 375, 405];
  const LV_SECS = 26;        // 한 계단에 머무는 시간 → 열 무대를 다 보려면 4분 20초

  // 단계마다 얼마나 자주, 얼마나 길게 나오는지.
  // 처음엔 드문드문 나와서 아이가 조작을 익히고, 뒤로 갈수록 촘촘해진다.
  //   gap  = 다음 무리까지 비워 두는 시간(초) — 작을수록 자주
  //   maxN = 한 무리에 이어 붙일 조각 수 상한 → 장애물 길이 5단계
  //   gem  = 하트가 딸려 나올 확률
  const PACE = {
    gap:  [2.6, 2.2, 1.9, 1.65, 1.45, 1.3, 1.15, 1.05, 0.95, 0.88],
    maxN: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    gem:  [0.22, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.63, 0.68, 0.72],
  };

  // 무대마다 다른 장애물. 들판에 게가 나오고 바다에 버섯이 나오면 무대를 바꾼 보람이 없다.
  // hit 은 그림보다 판정을 안쪽으로 줄이는 값 — 도트 그림은 모서리가 비어 있어서
  // 그림 크기 그대로 맞으면 "안 닿았는데 죽었다"가 된다. 판정 너비를 8~20px 로
  // 맞춰 뒀다: 그림이 커도 실제로 걸리는 폭은 비슷해야 억울하지 않다.
  // 배경 장식과 같은 그림은 절대 쓰지 않는다 — 넘어야 할 것과 아닌 것이 헷갈린다.
  const STAGE_PIECES = [
    [ { sp: 'bush',   s: 3, hit: [3, 2] }, { sp: 'mushroom', s: 3, hit: [2, 1] },
      { sp: 'snail',  s: 3, hit: [2, 1] }, { sp: 'ladybug',  s: 3, hit: [2, 1] } ],
    [ { sp: 'rockS',  s: 3, hit: [2, 1] }, { sp: 'log',      s: 3, hit: [3, 1] },
      { sp: 'mushroom', s: 3, hit: [2, 1] } ],
    [ { sp: 'stone',  s: 3, hit: [3, 1] }, { sp: 'reed',     s: 2, hit: [1, 1] },
      { sp: 'snail',  s: 3, hit: [2, 1] } ],
    [ { sp: 'sandcastle', s: 3, hit: [3, 1] }, { sp: 'starfish', s: 3, hit: [2, 1] },
      { sp: 'crab',   s: 3, hit: [3, 1] } ],
    [ { sp: 'cone',   s: 3, hit: [1, 1] }, { sp: 'bin',      s: 2, hit: [2, 1] },
      { sp: 'bench',  s: 2, hit: [3, 1] } ],
    [ { sp: 'skull',  s: 3, hit: [2, 1] }, { sp: 'tumble',   s: 3, hit: [2, 1] },
      { sp: 'rockS',  s: 3, hit: [2, 1] } ],
    [ { sp: 'lavaRock', s: 3, hit: [3, 1] }, { sp: 'flame',  s: 3, hit: [1, 1] },
      { sp: 'rockS',  s: 3, hit: [2, 1],
        pal: { S: '#4a3f4a', T: '#372e36', U: '#261f27' } } ],
    [ { sp: 'agent',  s: 2, hit: [1, 1] }, { sp: 'barrel', s: 3, hit: [1, 1] },
      { sp: 'crate',  s: 3, hit: [1, 1] } ],
    [ { sp: 'alien',  s: 2, hit: [1, 1] }, { sp: 'ufo',    s: 3, hit: [2, 1] },
      { sp: 'rockS',  s: 3, hit: [2, 1],
        pal: { S: '#c9c2d6', T: '#a29ab5', U: '#7d7593' } } ],
    [ { sp: 'angel',  s: 2, hit: [2, 1] }, { sp: 'harp',   s: 2, hit: [1, 1] },
      { sp: 'pillar', s: 2, hit: [1, 1] } ],
  ];
  // 조각을 이어 붙여도 이 너비를 넘기지 않는다. 넘을 수 있어야 하기 때문이다 —
  // 가장 빠른 405px/s 에서 140px 무리를 지나려면 0.4초가 필요한데,
  // 제일 약한 1단 점프도 판정 높이(21px) 위에 0.57초 머문다.
  function groupMaxW(maxN){ return Math.min(140, 30 * maxN + 12); }

  // 수풀이 언덕과 같은 연두라 배경에 묻혔다. 장애물만 훨씬 진한 초록으로 바꾸고,
  // 아래에서 검은 테두리를 한 겹 깐다.
  const OBS_PAL = { j: '#3f7d3c', k: '#2f6b34', l: '#24522b' };
  const OUTLINE = {};
  function outlineCells(key){
    if (!OUTLINE[key]) OUTLINE[key] = outlineOf(SPRITES[key]);
    return OUTLINE[key];
  }

  // 하트 3단계. 땅에서 그냥 달리면 어느 것도 안 닿는다.
  //   낮은 것 1단, 가운데 1단(딱 맞게), 높은 것 2단 이상.
  const GEM_H = [58, 90, 118];

  // 별 — 하트 중 일부가 별로 바뀐다. 늘 제일 높은 자리(GEM_H[2])에만 나와서
  // 별을 먹으려면 4단 점프를 확실히 눌러야 한다. 먹으면 잠깐 안 다친다 —
  // 맞았을 때의 무적과 같은 시계를 쓴다(그래서 화면 표현도 그대로 재활용된다).
  const STAR_CHANCE = 0.12;   // 하트가 나올 자리 중 이 비율이 별로 바뀐다
  const SHIELD_SECS = 4;      // 별을 먹으면 이만큼 안 다친다

  // 목숨. 한 판에서 두 번까지 이어서 달릴 수 있다.
  // 부딪히면 하나 깎이고 5초 동안 무적 — 그동안 반투명으로 깜빡인다.
  // 깎인 자리는 하트를 GEMS_PER_LIFE 개 모으면 한 칸 되돌아온다(최대 MAX_LIVES).
  const MAX_LIVES     = 2;
  const INVULN_SECS   = 5;
  const GEMS_PER_LIFE = 10;

  let W = 0, H = 0, GY = 0, dpr = 1;
  let state = 'ready';                 // ready | play | over
  // 달리는 동안만 캔버스 위 스크롤을 막는다. 늘 막아 두면 게임 화면에 손이
  // 닿는 순간 페이지가 붙어서 아래로 못 내려간다. 멈춰 있을 때는 평소대로 밀린다.
  function setState(v){
    state = v;
    canvas.style.touchAction = (v === 'play') ? 'none' : 'manipulation';
  }
  let who = 'sua';
  try { if (localStorage.getItem('sy.run.who') === 'yona') who = 'yona'; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  let best = 0;
  try { best = Math.max(0, parseInt(localStorage.getItem('sy.run.best') || '0', 10) || 0); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  let py = 0, vy = 0, onGround = true;
  let holdT = 0, holdCap = 0, jumpTier = 1;
  let dist = 0, hearts = 0, lv = 0, spd = SPEEDS[0], t = 0, nextAt = 0, lvFlash = 0;
  let lives = MAX_LIVES, gemStreak = 0, invulnUntil = -1, lifeFlash = 0, shieldFlash = 0;
  let obs = [], gems = [], raf = 0, last = 0, deadAt = 0, runBest = 0;

  function mixHex(a, b, k){
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const r = Math.round(((A >> 16) & 255) * (1 - k) + ((B >> 16) & 255) * k);
    const g = Math.round(((A >> 8)  & 255) * (1 - k) + ((B >> 8)  & 255) * k);
    const b2 = Math.round((A & 255)  * (1 - k) + (B & 255)  * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b2).toString(16).slice(1);
  }

  const spriteOf = () => SPRITES[who];
  const spriteH  = () => spriteOf().length;
  const score    = () => Math.floor(dist / 12) + hearts * 5;
  const ceilOf   = () => GY - spriteH() - 20;

  function recordBest(){
    if (score() <= best) return;
    best = score();
    try { localStorage.setItem('sy.run.best', String(best)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || 320;
    H = canvas.clientHeight || 190;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    GY = Math.round(H - 26);
    buildRainbow();
    if (state !== 'play') draw();
  }

  function reset(){
    py = 0; vy = 0; onGround = true; holdT = 0; holdCap = 0; jumpTier = 1;
    dist = 0; hearts = 0; t = 0; lv = 0; spd = SPEEDS[0]; lvFlash = 0;
    lives = MAX_LIVES; gemStreak = 0; invulnUntil = -1; lifeFlash = 0; shieldFlash = 0;
    deadAt = 0; runBest = best;
    obs = []; gems = []; nextAt = SPEEDS[0] * PACE.gap[0];
  }

  // ---- 무대 7곳 ----
  // 속도 단계와 무대를 한 몸으로 묶었다. 18초마다 배경이 통째로 바뀌니
  // 「빨라졌다」 를 숫자가 아니라 풍경으로 알게 된다. 뒤로 갈수록 하늘이
  // 어두워져서 마지막 화산에서는 밤이 된다.
  //   night 0~1 은 그 무대가 얼마나 어두운지 — 글씨색과 장애물 테두리를 여기서 뒤집는다.
  // 무지개 빛. 매 프레임 칸을 다 칠하면 fillRect 가 3천 번 넘게 든다 —
  // 크기가 바뀔 때 한 번 그려 두고 재사용한다. 배경은 화면 크기 말고는 변할 게 없다.
  const RB_COLORS = ['#ff9aa2', '#ffc78a', '#fff3a0', '#b7e8a8', '#a8d8f2', '#b9a3d6', '#f0aee0'];
  const rbLayer = document.createElement('canvas');
  function buildRainbow(){
    rbLayer.width = Math.max(1, Math.floor(W * dpr));
    rbLayer.height = Math.max(1, Math.floor(H * dpr));
    const g = rbLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const ax = W * 0.5, ay = -46;
    for (let y = 0; y < GY; y += CELL){
      const k = (y - ay) / (GY - ay);              // 0 꼭대기 → 1 지평선
      g.globalAlpha = 0.09 + 0.26 * k;             // 아래로 갈수록 진하게
      for (let x = 0; x < W; x += CELL){
        const rel = (x + CELL / 2 - ax) / (W * (0.16 + k * 0.92));
        const i = Math.floor(rel * 3.5) + 70;      // 음수 나머지를 피하려고 크게 더한다
        g.fillStyle = RB_COLORS[i % RB_COLORS.length];
        g.fillRect(x, y, CELL, CELL);
      }
    }
  }

  const STAGES = [
    { name: '들판',
      sky: ['#bfe4f7', '#a8d8f2', '#9ad0ef', '#cfe9fa', '#eaf3ea'],
      far:  { kind: 'hill',  color: '#a6cd91', edge: '#bcd9a8', amp: 12, wave: 90,  off: 26 },
      near: { kind: 'hill',  color: '#76b166', edge: '#8ec07b', amp: 8,  wave: 62,  off: 10 },
      ground: ['#dcc9a1', '#b79a6f', '#cab188'],
      deco: { sp: 'tree', s: 2, gap: 0.55, off: -6 },
      cloud: 1, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '산',
      sky: ['#a9cfe8', '#93c2e0', '#7fb5d8', '#c3ddec', '#e6eef2'],
      far:  { kind: 'peak',  color: '#8ba0b8', edge: '#c2d2e0', amp: 46, wave: 130, off: 22 },
      near: { kind: 'peak',  color: '#4c8f46', edge: '#66aa5d', amp: 22, wave: 74,  off: 8  },
      ground: ['#b5ada0', '#8a8377', '#9d9689'],
      deco: { sp: 'tree', s: 2, gap: 0.42, off: -6,
              pal: { j: '#2f6b34', k: '#255a2c', l: '#1f4c26', m: '#173a1d', n: '#12301a' } },
      cloud: 0.8, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '강',
      sky: ['#bfe4f7', '#a5d8f3', '#8ec9ee', '#d3ecfa', '#eef6f2'],
      far:  { kind: 'hill',  color: '#8ec07b', edge: '#a9d698', amp: 10, wave: 100, off: 36 },
      near: { kind: 'water', color: '#4a9ed6', edge: '#7cc0e8', amp: 0,  wave: 0,   off: 14 },
      ground: ['#cfc6ae', '#9b9280', '#b8b09a'],
      deco: { sp: 'flower', s: 3, gap: 0.6, off: -4 },
      cloud: 0.9, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '바다',
      sky: ['#cfeafc', '#a8dcf6', '#86cbef', '#dff0fb', '#f3f7ee'],
      far:  { kind: 'water', color: '#2f7fbe', edge: '#6cb7e0', amp: 0, wave: 0, off: 32 },
      near: { kind: 'water', color: '#1f6aa8', edge: '#4a9ed6', amp: 0, wave: 0, off: 12 },
      ground: ['#efe0bb', '#c9b58c', '#dccaa4'],
      deco: { sp: 'bird', s: 2, gap: 0.5, off: -78 },
      cloud: 1, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '도시',
      sky: ['#5a4a86', '#a05f86', '#ff8a5c', '#ffb877', '#ffd9a0'],
      far:  { kind: 'city',  color: '#6d8db0', edge: '#809fbf', amp: 54, wave: 30, off: 20 },
      near: { kind: 'city',  color: '#3f5470', edge: '#4d6484', amp: 34, wave: 22, off: 6  },
      ground: ['#6b6a72', '#45444c', '#575660'],
      deco: { sp: 'tower', s: 2, gap: 0.95, off: -4, back: true },
      cloud: 0.5, star: 0.2, glow: null, ember: 0, inkLight: 1, textLight: 1 },

    { name: '사막',
      sky: ['#33305e', '#6b4477', '#c2645f', '#e79a6a', '#f3c58c'],
      far:  { kind: 'hill',  color: '#a87a54', edge: '#c49468', amp: 16, wave: 110, off: 24 },
      near: { kind: 'hill',  color: '#c9a06a', edge: '#dfb87f', amp: 10, wave: 70,  off: 8  },
      ground: ['#e0bd85', '#b18a5a', '#cfa771'],
      deco: { sp: 'cactus', s: 2, gap: 0.55, off: 0 },
      cloud: 0.25, star: 0.55, glow: null, ember: 0, inkLight: 0, textLight: 1 },

    { name: '화산',
      sky: ['#120c1c', '#1d1026', '#331331', '#5a1a2c', '#8a2a22'],
      far:  { kind: 'peak',  color: '#2b2230', edge: '#3d2f3c', amp: 50, wave: 136, off: 22 },
      near: { kind: 'peak',  color: '#191320', edge: '#2a2029', amp: 24, wave: 78,  off: 8  },
      ground: ['#2a2228', '#151016', '#3a2f33'],
      deco: { sp: 'volcano', s: 3, gap: 0.8, off: -6, back: true },
      cloud: 0.15, star: 1, glow: '#ff6a2a', ember: 1, inkLight: 1, textLight: 1 },

    { name: '발사기지',
      sky: ['#2c3d6b', '#4b5f96', '#7c86b4', '#c39ba0', '#f0c39a'],
      far:  { kind: 'city',  color: '#59657f', edge: '#6f7c96', amp: 26, wave: 26, off: 22, lit: 0.2 },
      near: { kind: 'hill',  color: '#3b4358', edge: '#4b5468', amp: 6,  wave: 120, off: 8 },
      ground: ['#8d8f96', '#5f6169', '#787a82'],
      deco: { sp: 'rocket', s: 2, gap: 0.9, off: -8, back: true },
      // 도시와 닮아 보이던 무대라, 아주 먼 곳으로 우주왕복선 발사대를 천천히 흘린다.
      // 격납고보다 뒤·느리게(0.045배) 지나가서 멀리 있는 것처럼 보인다.
      // 색은 대기에 씻긴 회청색으로 눌렀다 — 앞쪽 건물보다 진하면 가까워 보인다.
      // off 를 음수로 둬서 격납고 지붕 위로 솟게 한다. 지면에 맞춰 놓았더니
      // 건물에 통째로 가려 한 번도 안 보였다.
      bg2: { sp: 'launchPad', s: 2, gap: 1.4, off: -30, speed: 0.045,
             pal: { S: '#7f89a2', T: '#727c95', U: '#616b84',
                    E: '#aeb6c8', o: '#98858e', H: '#8e7681', W: '#9b8791' } },
      cloud: 0.4, star: 0.35, glow: null, ember: 0, inkLight: 1, textLight: 1 },

    { name: '우주',
      sky: ['#05060f', '#080b1a', '#0c1128', '#101838', '#161f4a'],
      far:  { kind: 'peak',  color: '#3a3550', edge: '#4d4668', amp: 34, wave: 120, off: 22 },
      near: { kind: 'hill',  color: '#5b5570', edge: '#736c8c', amp: 8,  wave: 70,  off: 8 },
      ground: ['#6b6480', '#474155', '#5a5470'],
      deco: { sp: 'planet', s: 2, gap: 0.95, off: -46, back: true },
      cloud: 0, star: 1, glow: null, ember: 0, inkLight: 1, textLight: 1 },

    // 천국만 다른 규칙으로 그린다. 언덕도 흙길도 없다 —
    // 무지개 빛이 하늘에서 아래로 퍼지고, 땅은 구름 바다다.
    { name: '천국',
      sky: ['#efd9ff', '#f9e2fa', '#ffe8f2', '#fff3ea', '#fffaf2'],
      far:  { kind: 'cloudsea', color: '#ffe6f4', edge: '#ffffff', amp: 16, wave: 96, off: 36 },
      near: { kind: 'cloudsea', color: '#f7d9ef', edge: '#fff8fd', amp: 11, wave: 60, off: 12 },
      ground: ['#fdf6ff', '#f2ddf7', '#ffffff'],
      groundKind: 'cloud',
      rainbow: true,
      deco: null,
      // 아주 먼 곳 둘 — 흰 옷을 길게 늘어뜨린 사람과, 빛나는 황금성.
      // 서로 다른 속도로 흘러서 깊이가 생긴다.
      bg2: [
        { sp: 'walker',   s: 2, gap: 2.4, off: -26, speed: 0.030,
          pal: { E: '#ffffff', S: '#f0e2f6', O: '#c9a98f', N: '#ffeede', G: '#ffe66d' } },
        // 구름 위 높은 곳에 띄운다. 지면에 맞추면 구름 바다에 가려 안 보이고,
        // 크게 키우면 저 멀리가 아니라 눈앞에 있는 것처럼 보인다.
        { sp: 'goldCity', s: 2, gap: 2.4, off: -76, speed: 0.018 },
      ],
      cloud: 1, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },
  ];
  const XFADE = 4;           // 무대가 겹쳐 넘어가는 시간(초)

  // 별자리는 매번 새로 뽑으면 밤하늘이 지글거린다. 한 번 정해 두고 쓴다.
  const STARS = [];
  for (let i = 0; i < 36; i++)
    STARS.push({ x: ((i * 137.5) % 100) / 100, y: ((i * 61.8) % 46) / 100, p: (i * 2.4) % 6.28 });

  function stageMix(){
    const i = Math.min(STAGES.length - 1, lv);
    if (i >= STAGES.length - 1) return { a: STAGES[i], b: null, w: 0 };
    const into = (t - (i + 1) * LV_SECS + XFADE) / XFADE;   // 다음 단계 4초 전부터
    return { a: STAGES[i], b: STAGES[i + 1], w: Math.min(1, Math.max(0, into)) };
  }
  // 하늘이 어두우면 글씨를, 땅이 어두우면 장애물 테두리를 밝게 뒤집는다.
  // 둘을 따로 두는 이유는 사막이다 — 하늘은 보랏빛으로 어두운데 땅은 모래라 밝다.
  // 겹치는 4초 동안은 절반을 넘어설 때 한 번에 바꾼다. 중간색으로 섞으면
  // 회색이 되어 어느 쪽에서도 안 읽힌다.
  function flagNow(key){
    const m = stageMix();
    return (m.b && m.w > 0.5 ? m.b : m.a)[key];
  }

  // ---- 무대 한 겹 그리기 ----
  // 도트 화면에서 부드러운 곡선은 혼자 겉돈다. 전부 4px 격자에 맞춰 기둥으로 세운다.
  const CELL = 4;
  function bandY(L, x, off){
    const u = x + off;
    if (L.kind === 'peak'){
      // 삼각파 — 언덕보다 뾰족해서 산으로 읽힌다
      const w = L.wave || 100;
      const tri = 1 - Math.abs(((u / w) % 2 + 2) % 2 - 1);
      return GY - L.off - tri * L.amp - Math.sin(u / (w * 0.23)) * L.amp * 0.12;
    }
    return GY - L.off - Math.sin(u / L.wave) * L.amp
                      - Math.sin(u / (L.wave * 0.41)) * L.amp * 0.35;
  }

  function paintBand(L, off){
    if (L.kind === 'water'){
      const top = Math.round((GY - L.off) / CELL) * CELL;
      ctx.fillStyle = L.color; ctx.fillRect(0, top, W, H - top);
      ctx.fillStyle = L.edge;  ctx.fillRect(0, top, W, CELL);
      // 물결 — 흐르는 게 보여야 물로 읽힌다
      for (let i = 0; i < 12; i++){
        const wx = W - ((off * 0.6 + i * 61) % (W + 60)) + 30;
        ctx.fillRect(Math.round(wx / CELL) * CELL, top + CELL * (2 + (i % 3)), CELL * 3, CELL);
      }
      return;
    }
    if (L.kind === 'cloudsea'){
      // 언덕처럼 한 겹으로 칠하되 능선을 세 겹 사인으로 울퉁불퉁하게 만들고,
      // 꼭대기에 밝은 단을 두 칸 얹어 뭉게뭉게 보이게 한다.
      for (let x = 0; x < W; x += CELL){
        const u = x + off;
        const raw = GY - L.off
          - Math.sin(u / L.wave) * L.amp
          - Math.sin(u / (L.wave * 0.33)) * L.amp * 0.5
          - Math.sin(u / (L.wave * 0.13)) * L.amp * 0.25;
        const y = Math.round(raw / CELL) * CELL;
        ctx.fillStyle = L.edge;  ctx.fillRect(x, y, CELL, CELL * 2);
        ctx.fillStyle = L.color; ctx.fillRect(x, y + CELL * 2, CELL, H - y - CELL * 2);
      }
      return;
    }
    if (L.kind === 'city'){
      // 블록 하나가 건물 하나. 높이는 자리에서 뽑아 늘 같은 스카이라인이 나온다.
      const bw = CELL * 7;
      const start = Math.floor(off / bw);
      for (let n = 0; n <= Math.ceil(W / bw) + 1; n++){
        const idx = start + n;
        const h = 18 + (Math.abs(Math.sin(idx * 12.9898) * 43758.5453) % 1) * L.amp;
        const x = Math.round((n * bw - (off % bw)) / CELL) * CELL;
        const y = Math.round((GY - L.off - h) / CELL) * CELL;
        ctx.fillStyle = L.color; ctx.fillRect(x, y, bw - CELL, H - y);
        ctx.fillStyle = L.edge;  ctx.fillRect(x, y, bw - CELL, CELL);
        // 창문 — 몇 개만 켠다. lit 이 낮으면 드문드문해서 격납고처럼 보인다.
        const lit = L.lit === undefined ? 0.62 : L.lit;
        for (let r = y + CELL * 2; r < GY - L.off - CELL; r += CELL * 3)
          for (let c = x + CELL; c < x + bw - CELL * 2; c += CELL * 2)
            if ((Math.abs(Math.sin((idx * 31 + r * 7 + c) * 0.7)) > 1 - lit)){
              ctx.fillStyle = '#ffd979'; ctx.fillRect(c, r, CELL, CELL);
            }
      }
      return;
    }
    for (let x = 0; x < W; x += CELL){
      const y = Math.round(bandY(L, x, off) / CELL) * CELL;
      ctx.fillStyle = L.edge;  ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = L.color; ctx.fillRect(x, y + CELL, CELL, H - y - CELL);
    }
  }

  function paintStage(st, alpha){
    ctx.save();
    ctx.globalAlpha = alpha;

    // 하늘 — 띠로 나눈다. 매끈한 그러데이션은 도트와 안 어울린다.
    const n = st.sky.length;
    for (let i = 0; i < n; i++){
      ctx.fillStyle = st.sky[i];
      ctx.fillRect(0, Math.round(GY * i / n), W, Math.ceil(GY / n) + 1);
    }

    // 무지개 빛 — 하늘 꼭대기 한 점에서 아래로 부챗살처럼 퍼진다
    if (st.rainbow) ctx.drawImage(rbLayer, 0, 0, W, H);

    if (st.star > 0){
      ctx.fillStyle = '#fff8e0';
      STARS.forEach((s2, i) => {
        ctx.globalAlpha = alpha * st.star * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.6 + s2.p)));
        ctx.fillRect(Math.round(s2.x * W / 2) * 2, Math.round(s2.y * GY / 2) * 2, 2, 2);
      });
      ctx.globalAlpha = alpha;
      if (st.star > 0.5){          // 달 — 별이 충분히 밝을 때만
        const mx = Math.round(W * 0.78), my = 30, r = 11;
        ctx.fillStyle = '#f6f1d8';
        for (let dy = -r; dy <= r; dy += 3)
          for (let dx = -r; dx <= r; dx += 3)
            if (dx * dx + dy * dy <= r * r) ctx.fillRect(mx + dx, my + dy, 3, 3);
        ctx.fillStyle = 'rgba(200,192,158,.6)';
        ctx.fillRect(mx - 5, my - 4, 6, 6); ctx.fillRect(mx + 2, my + 3, 4, 4);
      }
    }

    // 아주 먼 곳 — 언덕보다도 뒤에서, 언덕보다도 느리게 지나간다.
    // 하나만 쓰는 무대(발사기지)와 둘을 겹치는 무대(천국)가 있어 배열도 받는다.
    if (st.bg2){
      const list = Array.isArray(st.bg2) ? st.bg2 : [st.bg2];
      list.forEach(b => {
        const bsp = SPRITES[b.sp];
        if (!bsp) return;
        const bw = bsp[0].length * b.s, bh = bsp.length * b.s;
        const bgap = Math.max(bw + 120, W * (b.gap || 1.4));
        for (let i = 0; i < 3; i++){
          const bx = W - ((dist * (b.speed || 0.05) + i * bgap) % (W + bgap + bw)) + bw;
          drawSprite(ctx, bsp, Math.round(bx / 2) * 2, GY - bh + (b.off || 0), b.s, b.pal);
        }
      });
    }

    if (st.cloud > 0){
      ctx.globalAlpha = alpha * st.cloud;
      const cw = SPRITES.cloudS[0].length * 2;
      const gap = Math.max(140, W / 2);
      for (let i = 0; i < 4; i++){
        const cx = W - ((dist * 0.06 + i * gap) % (W + cw * 2)) + cw;
        drawSprite(ctx, SPRITES.cloudS, Math.round(cx / 2) * 2, 10 + (i % 2) * 16, 2);
      }
      ctx.globalAlpha = alpha;
    }

    // 화산 — 지평선이 벌겋게 달아오른다
    if (st.glow){
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = st.glow;
      for (let i = 0; i < 7; i++){
        ctx.globalAlpha = alpha * 0.09 * (7 - i) / 7;
        ctx.fillRect(0, GY - 30 - i * CELL, W, CELL);
      }
      ctx.globalAlpha = alpha;
    }

    // 무대마다 다른 장식이 흘러간다 — 뒤쪽이 흐르는 게 보여야 달리는 느낌이 난다.
    // 큰 것(남산타워·화산)은 앞 능선 뒤에 세운다. 땅 위에 서면 장애물로 보인다.
    const d = st.deco;
    function paintDeco(){
      if (!d || !SPRITES[d.sp]) return;
      const sp = SPRITES[d.sp], dw = sp[0].length * d.s, dh = sp.length * d.s;
      const gap = Math.max(dw + 40, W * d.gap);
      for (let i = 0; i < 4; i++){
        const dx = W - ((dist * 0.34 + i * gap) % (W + gap)) + dw;
        drawSprite(ctx, sp, Math.round(dx / 2) * 2, GY - dh + d.off, d.s, d.pal);
      }
    }

    paintBand(st.far, dist * 0.12);
    if (d && d.back) paintDeco();
    paintBand(st.near, dist * 0.26);
    if (!d || !d.back) paintDeco();

    // 땅
    ctx.fillStyle = st.ground[0]; ctx.fillRect(0, GY, W, H - GY);
    if (st.groundKind === 'cloud'){
      // 흙길 대신 구름 바닥. 지평선을 울퉁불퉁하게 만들고 빛 알갱이를 흘린다.
      ctx.fillStyle = st.ground[1];
      for (let x = 0; x < W; x += CELL){
        const b = Math.sin((x + dist) / 23) + Math.sin((x + dist) / 9);
        ctx.fillRect(x, GY - CELL * (b > 0.8 ? 2 : (b > -0.4 ? 1 : 0)), CELL, CELL * 3);
      }
      ctx.fillStyle = st.ground[2];
      for (let i = 0; i < 20; i++){
        const gx = W - ((dist + i * 41) % (W + 40)) + 20;
        ctx.fillRect(Math.round(gx / CELL) * CELL, GY + 7 + (i % 4) * 5, CELL, CELL);
      }
    } else {
      ctx.fillStyle = st.ground[1]; ctx.fillRect(0, GY, W, CELL);
      ctx.fillStyle = st.ground[2];
      for (let i = 0; i < 16; i++){
        const gx = W - ((dist + i * 53) % (W + 40)) + 20;
        ctx.fillRect(Math.round(gx / CELL) * CELL, GY + 8 + (i % 3) * 5, CELL, CELL);
      }
    }

    // 불티 — 화산에서만 떠오른다
    if (st.ember > 0){
      for (let i = 0; i < 18; i++){
        const ex = (i * 89 + Math.sin(i) * 40) % W;
        const ey = GY - ((t * 26 + i * 37) % (GY * 0.8));
        ctx.globalAlpha = alpha * st.ember * (ey / GY) * 0.9;
        ctx.fillStyle = i % 3 ? '#ff8a3c' : '#ffd979';
        ctx.fillRect(Math.round(ex / 2) * 2, Math.round(ey / 2) * 2, 2, 2);
      }
    }
    ctx.restore();
  }

  function drawBg(){
    const m = stageMix();
    paintStage(m.a, 1);
    if (m.b && m.w > 0) paintStage(m.b, m.w);   // 4초 동안 겹쳐서 넘어간다
  }

  function playerBox(){
    const sp = spriteOf();
    return { x: PLAYER_X + 11, y: GY - sp.length - py + 3, w: sp[0].length - 22, h: sp.length - 3 };
  }
  function hitBox(o){
    const sp = SPRITES[o.sp], w = sp[0].length * o.s, h = sp.length * o.s;
    return { x: o.x + o.hit[0] * o.s, y: GY - h + o.hit[1] * o.s,
             w: w - o.hit[0] * o.s * 2, h: h - o.hit[1] * o.s };
  }
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function drawObs(o, ink){
    const sp = SPRITES[o.sp], x = Math.round(o.x), y = GY - sp.length * o.s;
    ctx.fillStyle = ink;
    outlineCells(o.sp).forEach(c =>
      ctx.fillRect(x + c[0] * o.s - 2, y + c[1] * o.s - 2, o.s + 4, o.s + 4));
    drawSprite(ctx, sp, x, y, o.s, o.pal ? Object.assign({}, OBS_PAL, o.pal) : OBS_PAL);
  }

  function drawPlayer(){
    const sp = spriteOf(), h = sp.length, w = sp[0].length;
    const x = PLAYER_X, y = GY - h - py;
    // 그림자 — 발이 땅에서 떨어진 걸 알려준다
    const sh = Math.max(0.25, 1 - py / 70);
    ctx.fillStyle = (flagNow('inkLight') ? 'rgba(255,240,210,' : 'rgba(63,50,38,') +
      (0.22 * sh).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, GY + 3, (w / 2.6) * sh, 3.2 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    // 달릴 때 1px 씩 위아래로 — 도트에서는 이만큼만으로도 뛰는 것처럼 보인다
    const bob = (state === 'play' && onGround && Math.floor(t * 9) % 2) ? 1 : 0;
    // 무적일 때는 반투명으로 깜빡인다. 색을 바꾸지 않고 투명도만 흔드는 편이
    // 도트 그림을 덜 망가뜨린다.
    const inv = state === 'play' && t < invulnUntil;
    if (inv) ctx.globalAlpha = Math.floor(t * 9) % 2 ? 0.28 : 0.72;
    drawSprite(ctx, sp, x, Math.round(y + bob), 1);
    if (inv) ctx.globalAlpha = 1;

    // 점프 세기 — 머리 위 네 칸. 몇 단으로 뛴 건지 눈으로 보여야 4단계가 의미가 있다.
    if (state === 'play' && !onGround){
      for (let i = 0; i < 4; i++){
        ctx.fillStyle = i < jumpTier ? '#ff6b6b' : 'rgba(255,255,255,.6)';
        ctx.fillRect(x + 5 + i * 9, Math.round(y) - 11, 7, 7);
      }
    }
  }

  // 배경과 겹쳐도 읽히게 테두리를 두르고 찍는다. 무대가 어두워지면 글씨와
  // 테두리를 서로 바꾼다 — 밤하늘 위의 검은 글씨는 안 보인다.
  function inkNow(){ return flagNow('inkLight') ? '#f4eede' : '#241f16'; }
  function textPair(){
    return flagNow('textLight')
      ? { fill: '#fdf7e8', line: 'rgba(12,10,20,.9)' }
      : { fill: '#3a3226', line: 'rgba(255,255,255,.85)' };
  }
  function label(text, y, size, soft){
    const c = textPair();
    ctx.font = '800 ' + size + 'px Suayona Dot, Suayona Sans, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = c.line;
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = soft ? mixHex(c.fill, '#8b8272', 0.5) : c.fill;
    ctx.fillText(text, W / 2, y);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  function hud(text, x, y, size, align){
    const c = textPair();
    ctx.font = '800 ' + size + 'px Suayona Dot, Suayona Sans, sans-serif';
    ctx.textAlign = align || 'start';
    ctx.lineWidth = 4; ctx.strokeStyle = c.line; ctx.strokeText(text, x, y);
    ctx.fillStyle = c.fill; ctx.fillText(text, x, y);
    ctx.textAlign = 'start';
  }

  function draw(){
    drawBg();
    const ink = inkNow();
    obs.forEach(o => drawObs(o, ink));
    gems.forEach(gm => drawSprite(ctx, gm.star ? SPRITES.star : SPRITES.heart, Math.round(gm.x),
      Math.round(gm.y + Math.sin(t * 5 + gm.p) * 3), 3));
    drawPlayer();

    // 목숨 — 점수 왼쪽에 하트 두 칸. 깎인 칸은 투명하게 남겨 둔다.
    for (let i = 0; i < MAX_LIVES; i++){
      const on = i < lives;
      ctx.globalAlpha = on ? (lifeFlash > 0 && Math.floor(t * 10) % 2 ? 0.4 : 1) : 0.22;
      drawSprite(ctx, SPRITES.heart, 9 + i * 17, 11, 2);
    }
    ctx.globalAlpha = 1;
    const LX = 9 + MAX_LIVES * 17 + 6;
    hud(String(score()).padStart(4, '0'), LX, 20, 13);
    if (best) hud('BEST ' + best, LX, 36, 11);
    // 목숨이 비어 있을 때만 「몇 개 더 모으면 되는지」를 알려 준다
    if (lives < MAX_LIVES) hud(gemStreak + '/' + GEMS_PER_LIFE, 9, 36, 11);
    hud('LV' + (lv + 1), W - 10, 20, 13, 'end');
    if (hearts){
      drawSprite(ctx, SPRITES.heart, W - 42, 27, 2);
      hud('x' + hearts, W - 10, 36, 11, 'end');
    }

    if (lvFlash > 0)
      label(STAGES[lv].name + ' · 속도 ' + (lv + 1) + '단계!', H * 0.24, 15);
    else if (shieldFlash > 0)
      label('✨ 방패! ' + SHIELD_SECS + '초 동안 안 다쳐요', H * 0.24, 15);
    else if (lifeFlash > 0)
      label(t < invulnUntil ? '앗! 목숨 ' + lives + '개 남았어요' : '목숨 하나 되찾았어요!',
        H * 0.24, 15);
    if (state === 'ready') label('눌러서 시작', H * 0.44, 17);
    if (state === 'over'){
      label(score() + '점' + (score() > runBest ? ' · 최고 기록!' : ''), H * 0.36, 17);
      label('한 번 더 누르기', H * 0.36 + 22, 13, true);
    }
  }

  function spawn(){
    // 조각 수를 1~3 으로 이어 붙여 장애물 길이를 세 단계로 만든다.
    // 처음부터 긴 게 나오면 아이가 금방 포기하니 속도 단계에 맞춰 늘린다.
    const pace = { gap: PACE.gap[lv], maxN: PACE.maxN[lv], gem: PACE.gem[lv] };
    const n = 1 + Math.floor(Math.random() * pace.maxN);
    const cap = groupMaxW(pace.maxN);
    const pool = STAGE_PIECES[Math.min(STAGE_PIECES.length - 1, lv)];
    const x0 = W + 10;
    let wide = 0;
    for (let i = 0; i < n; i++){
      const p = pool[Math.floor(Math.random() * pool.length)];
      const w = SPRITES[p.sp][0].length * p.s;
      if (wide + w > cap) break;
      obs.push({ sp: p.sp, s: p.s, hit: p.hit, pal: p.pal, x: x0 + wide });
      wide += w + 4 + Math.floor(Math.random() * 5);   // 겹치지 않게 조금 띄운다
    }
    // 하트는 낮은 것과 높은 것. 높은 건 2단 이상 눌러야 닿아서, 먹으려면
    // 「얼마나 세게 누를까」 를 한 번 고르게 된다.
    if (Math.random() < pace.gem){
      const isStar = Math.random() < STAR_CHANCE;
      const h = isStar ? GEM_H[2] : GEM_H[Math.floor(Math.random() * GEM_H.length)];
      gems.push({ x: x0 + wide + 90 + Math.random() * 90,
                  y: GY - h, p: Math.random() * 6, star: isStar });
    }
    nextAt = wide + spd * (pace.gap * (0.85 + Math.random() * 0.4));
  }

  function step(ts){
    raf = requestAnimationFrame(step);
    const dt = Math.max(0, Math.min(0.05, (ts - last) / 1000 || 0));   // 시계가 뒤로 가면 0
    last = ts;

    if (state === 'play'){
      t += dt;
      const nl = Math.min(SPEEDS.length - 1, Math.floor(t / LV_SECS));
      if (nl !== lv){ lv = nl; spd = SPEEDS[lv]; lvFlash = 1.4; sfx('pop'); }
      if (lvFlash > 0) lvFlash -= dt;
      if (lifeFlash > 0) lifeFlash -= dt;
      if (shieldFlash > 0) shieldFlash -= dt;
      const move = spd * dt;
      dist += move;

      // 누르고 있는 동안엔 중력을 덜 받는다. holdCap 은 손을 뗄 때 네 칸 중
      // 하나로 올려 맞춘 값이라, 같은 세기로 누르면 늘 같은 높이가 나온다.
      if (!onGround) holdT += dt;
      const g = (vy < 0 && holdT < holdCap) ? GRAV * HOLD_G : GRAV;
      vy += g * dt;
      py -= vy * dt;
      const ceil = ceilOf();
      if (py > ceil){ py = ceil; vy = 0; }
      if (py <= 0){ py = 0; vy = 0; onGround = true; } else onGround = false;

      nextAt -= move;
      if (nextAt <= 0) spawn();
      obs.forEach(o => { o.x -= move; });
      gems.forEach(gm => { gm.x -= move; });
      obs = obs.filter(o => o.x > -160);
      gems = gems.filter(gm => gm.x > -40);

      const pb = playerBox();
      for (const gm of gems){
        const gw = gm.star ? 27 : 21;                    // 별(9px×3)이 하트(7px×3)보다 넓다
        if (!gm.got && overlap(pb, { x: gm.x + (gw - 15) / 2, y: gm.y, w: 15, h: 18 })){
          gm.got = true; gm.x = -99; hearts++;
          if (gm.star){
            invulnUntil = Math.max(invulnUntil, t + SHIELD_SECS);
            shieldFlash = 1.6; sfx('fanfare');
          } else {
            sfx('sparkle');
            if (lives < MAX_LIVES && ++gemStreak >= GEMS_PER_LIFE){
              lives++; gemStreak = 0; lifeFlash = 1.6; sfx('fanfare');
            }
          }
        }
      }
      if (t >= invulnUntil){
        for (const o of obs){
          if (!overlap(pb, hitBox(o))) continue;
          if (lives > 0){
            // 아직 목숨이 남았으면 판이 이어진다. 점수도 무대도 그대로 간다.
            lives--; gemStreak = 0; invulnUntil = t + INVULN_SECS;
            lifeFlash = 1.4; sfx('thud');
          } else {
            setState('over'); deadAt = performance.now(); sfx('thud'); recordBest();
            offerSave();
          }
          break;
        }
      }
    }

    draw();
    if (state === 'over') stop();     // 죽은 화면은 한 장이면 된다
  }

  function start(){ last = performance.now(); if (!raf) raf = requestAnimationFrame(step); }
  function stop(){
    if (state === 'play') recordBest();   // 멈춘 김에 여기까지의 기록은 남긴다
    if (raf) cancelAnimationFrame(raf); raf = 0;
  }

  function tierOf(h){
    for (let i = 0; i < HOLD_TIERS.length; i++) if (h <= HOLD_TIERS[i]) return i;
    return HOLD_TIERS.length - 1;
  }
  function release(){
    if (!onGround && vy < 0){
      holdCap = HOLD_TIERS[tierOf(holdT)];
      jumpTier = tierOf(holdT) + 1;
    }
  }

  function jump(){
    if (state === 'ready'){ reset(); setState('play'); start(); sfx('boing'); return; }
    if (state === 'over'){
      if (performance.now() - deadAt < 400) return;   // 죽자마자 눌린 건 재시작으로 안 센다
      hideSave(); reset(); setState('play'); start(); sfx('boing'); return;
    }
    if (onGround){
      vy = JUMP_V; py = 0.01; onGround = false;
      holdT = 0; holdCap = HOLD_TIERS[HOLD_TIERS.length - 1]; jumpTier = 4;
      sfx('boing');
    }
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.focus({ preventScroll: true });
    jump();
  });
  // touch-action 을 늦게 받아들인 옛 사파리가 있어 한 겹 더 막는다.
  // passive:false 가 없으면 preventDefault 가 무시된다.
  canvas.addEventListener('touchmove', e => {
    if (state === 'play') e.preventDefault();
  }, { passive: false });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  const JUMP_KEYS = [' ', 'Spacebar', 'ArrowUp', 'Enter'];
  canvas.addEventListener('keydown', e => {
    if (JUMP_KEYS.indexOf(e.key) < 0) return;
    e.preventDefault();
    if (!e.repeat){ jump(); }
  });
  canvas.addEventListener('keyup', e => { if (JUMP_KEYS.indexOf(e.key) >= 0) release(); });
  canvas.addEventListener('blur', release);

  document.querySelectorAll('#runWho button').forEach(b => {
    b.classList.toggle('on', b.dataset.who === who);
    b.addEventListener('click', () => {
      who = b.dataset.who;
      try { localStorage.setItem('sy.run.who', who); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
      document.querySelectorAll('#runWho button').forEach(x => x.classList.toggle('on', x === b));
      if (state !== 'play') draw();
    });
  });
  // 지우기는 부모만. 아이가 실수로 눌러 서로의 기록을 날리는 일이 실제로 생긴다.
  // 지우는 건 이 브라우저의 BEST 뿐이다 — 명예의 전당은 건드리지 않는다.
  const resetBtn = document.getElementById('runReset');
  resetBtn.addEventListener('click', () => {
    best = 0;
    try { localStorage.removeItem('sy.run.best'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    if (state !== 'play') draw();
  });
  // 이 한 줄이 던지면 게임 전체가 안 뜬다. 바깥에서 오는 이름이라 조심스럽게 만진다.
  Promise.resolve(typeof authOnce === 'undefined' ? null : authOnce)
    .then(() => { if (typeof isAdmin !== 'undefined' && isAdmin) resetBtn.hidden = false; })
    .catch(() => {});

  // ---- 명예의 전당 ----
  // 달리는 동안엔 서버를 안 부른다. 처음 화면에 들어올 때 한 번 읽고,
  // 이름을 남길 때 한 번 쓰고 다시 읽는다.
  const saveBox  = document.getElementById('runSave');
  const topBox   = document.getElementById('runTop');
  const topList  = document.getElementById('runTopList');
  const nameIn   = document.getElementById('runName');
  const sendBtn  = document.getElementById('runSend');
  const saveMsg  = document.getElementById('runMsg');
  let savedId = null;
  let when = 'all';
  const topRows  = { all: null, week: null };   // 탭마다 받아 둔 줄
  const topCache = {};                          // 탭마다 한 번씩만 받는다
  let weekAsked = false;                        // 저장 여부를 정하려고 한 번만 더 받는다
  try { nameIn.value = localStorage.getItem('sy.run.name') || ''; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  function renderTop(){
    document.querySelectorAll('#runWhen button')
      .forEach(b => b.classList.toggle('on', b.dataset.when === when));
    const rows = topRows[when];
    // 아직 안 받았으면 표를 감추는 대신 자리를 남긴다. 탭을 누를 때마다 상자가
    // 통째로 사라졌다 나타나면 누른 것이 취소된 것처럼 보인다.
    if (!rows){
      if (!topBox.hidden) topList.innerHTML = '<li><span class="nm">불러오는 중…</span></li>';
      return;
    }
    if (!rows.length){
      topList.innerHTML = '<li><span class="nm">' +
        (when === 'week' ? '이번 주엔 아직 아무도 안 남겼어요' : '아직 아무도 안 남겼어요') +
        '</span></li>';
      topBox.hidden = false;
      return;
    }
    topList.innerHTML = rows.map((r, i) =>
      '<li' + (r.id === savedId ? ' class="me"' : '') + '>' +
        '<span class="rk">' + (i + 1) + '위</span>' +
        '<span class="nm">' + escapeHTML(r.name) + '</span>' +
        '<span class="sc">' + Number(r.score) + '</span>' +
      '</li>').join('');
    topBox.hidden = false;
  }

  // 이번 주는 월요일부터. 「지난주 기록을 못 깬다」로 끝나지 않게 매주 새로 겨룬다.
  function weekStart(){
    const d = new Date();
    const back = (d.getDay() + 6) % 7;                 // 월요일까지 며칠 되돌리나
    d.setDate(d.getDate() - back);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  function loadTop(w){
    const key = w || when;
    if (topCache[key]) return topCache[key];
    let q = sb.from('run_scores').select('id, name, score')
      .order('score', { ascending: false }).order('created_at', { ascending: true })
      .limit(10);
    if (key === 'week') q = q.gte('created_at', weekStart());
    topCache[key] = q
      .then(({ data }) => { topRows[key] = data || []; if (key === when) renderTop(); })
      .catch(() => { delete topCache[key]; });
    return topCache[key];
  }

  document.querySelectorAll('#runWhen button').forEach(b =>
    b.addEventListener('click', () => {
      if (when === b.dataset.when) return;
      when = b.dataset.when;
      renderTop();
      loadTop();
    }));

  function hideSave(){ saveBox.hidden = true; saveMsg.textContent = ''; }

  function offerSave(){
    if (score() <= 0) return;
    // 10위 안에 못 들 점수면 굳이 이름을 묻지 않는다 — 표만 지저분해진다.
    // 전체 10위에서 밀려도 이번 주 10위에는 들 수 있다. 둘 다 밀릴 때만 넘어간다.
    const missed = k => {
      const r = topRows[k];
      return !!r && r.length >= 10 && score() <= Number(r[9].score);
    };
    if (missed('all')) {
      if (!topRows.week) {
        // 이번 주 표를 아직 안 받았으면 한 번만 받아 보고 다시 판단한다.
        if (weekAsked) return;
        weekAsked = true;
        loadTop('week').then(() => { if (saveBox.hidden && !savedId) offerSave(); });
        return;
      }
      if (missed('week')) return;
    }
    savedId = null;
    sendBtn.disabled = false;
    saveMsg.className = 'run-msg';
    saveMsg.textContent = '10위 안에 들었어요!';
    saveBox.hidden = false;
  }

  sendBtn.addEventListener('click', async () => {
    const nm = nameIn.value.trim();
    if (!nm){ saveMsg.className = 'run-msg err'; saveMsg.textContent = '이름을 적어주세요.'; return; }
    const pt = score();
    if (pt <= 0) return;
    sendBtn.disabled = true;
    saveMsg.className = 'run-msg'; saveMsg.textContent = '남기는 중…';
    try { localStorage.setItem('sy.run.name', nm); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    const { data, error } = await sb.from('run_scores')
      .insert({ name: nm, score: pt, who }).select('id').single();
    if (error){
      sendBtn.disabled = false;
      saveMsg.className = 'run-msg err'; saveMsg.textContent = '못 남겼어요: ' + readableError(error);
      return;
    }
    savedId = data && data.id;
    saveMsg.textContent = '남겼어요!';
    // 방금 넣은 줄이 보여야 한다 — 두 탭 모두 다시 받는다.
    delete topCache.all; delete topCache.week;
    topRows.all = topRows.week = null;
    await loadTop();
    saveBox.hidden = true;
  });

  // 안 보이면 멈춘다. 게임이 화면 밖에서 계속 돌면 스크롤이 버벅이고 배터리만 먹는다.
  let visible = false;
  function sync(){
    if (visible && !document.hidden && state === 'play') start();
    else { stop(); }
  }
  if ('IntersectionObserver' in window){
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible) loadTop();        // 순위표는 화면에 들어올 때 딱 한 번
      sync();
    }, { threshold: 0.25 }).observe(canvas);
  } else { visible = true; loadTop(); }
  document.addEventListener('visibilitychange', sync);

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });

  // 시험용 손잡이. 화면을 안 거치고 규칙대로 도는지 확인할 때 쓴다.
  window.__run = {
    get state(){ return { state, t, lives, hearts, gemStreak, invulnUntil, shieldFlash, lifeFlash, score: score(), gems, obs, lv, py }; },
    playerBox,
    // y 를 안 주면 지금 캐릭터가 서 있는 자리에 맞춘다 — 점프 높낮이는 이미
    // GEM_H 로 따로 다뤄지는 값이라, 충돌 자체만 확인할 땐 굳이 안 맞춰도 된다.
    spawnStar(dx, y){ const pb = playerBox(); gems.push({ x: PLAYER_X + (dx || 20), y: y != null ? y : pb.y, p: 0, star: true }); },
    spawnHeart(dx, y){ const pb = playerBox(); gems.push({ x: PLAYER_X + (dx || 20), y: y != null ? y : pb.y, p: 0, star: false }); },
    spawnObstacle(dx){
      const p = STAGE_PIECES[0][0];
      obs.push({ sp: p.sp, s: p.s, hit: p.hit, pal: p.pal, x: PLAYER_X + (dx || 20) });
    },
    step: () => step(performance.now()),
    jump, reset, setState, start,
  };

  reset(); resize();
})();

// ================= 하단 픽셀 띠 =================
(function(){
  const cv = $('#stripCanvas'); const ctx = cv.getContext('2d');
  let t = 0;
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(cv.clientWidth * dpr); cv.height = Math.floor(cv.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  }
  function draw(){
    const W = cv.clientWidth, H = cv.clientHeight, S = 4;
    ctx.clearRect(0,0,W,H);
    drawSkyBands(ctx, W, H, S, [{at:0,color:'#bfe4f7'},{at:1,color:'#eaf6ff'}]);
    drawHill(ctx, [{freq:2.0,amp:12,phase:1.0}], '#8ccb84', S, H*0.55, W, H);
    drawHill(ctx, [{freq:1.3,amp:9,phase:3.4}],  '#6fb567', S, H*0.72, W, H);
    const spacing = 150, offset = (t * 14) % spacing;
    for (let i = -1; i * spacing < W + spacing; i++) {
      drawSprite(ctx, SPRITES.tree, Math.round((i*spacing - offset)/S)*S, Math.round((H*0.72 - 48)/S)*S, 3);
    }
    for (let i = -1; i * spacing < W + spacing; i++) {
      drawSprite(ctx, SPRITES.bush, Math.round((i*spacing - offset*0.6 + 70)/S)*S, Math.round((H - 23)/S)*S, 3);
    }
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(){ t += 0.016; draw(); requestAnimationFrame(loop); }
  window.addEventListener('resize', () => { resize(); draw(); });
  resize();
  if (reduce) draw(); else loop();
})();

initReveal();
