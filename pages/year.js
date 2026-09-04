// year.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('year');
buildBackdrop('year');

const AUTHORS = Object.assign({}, HERO_NAMES, { together:'같이' });   // 정본은 common.js
let allWorks = [], allPosts = [], allEvents = [], allBest = [];
let year = null, who = 'all';
let allYears = [], yearsOpen = false;

const yearOf = d => d ? String(d).slice(0, 4) : null;

async function loadAll(){
  const [w, p, e, b] = await Promise.all([
    sb.from('works').select('*').order('made_on', { ascending:true, nullsFirst:false }),
    sb.from('posts').select('*').order('created_at', { ascending:true }),
    sb.from('event_meta').select('*').order('start_date', { ascending:true }),
    // 갤러리에서 ★ 찍어 둔 사진만. 전부 실으면 여행마다 백 장씩이라
    // 모아보기가 모아보기가 아니게 된다 — 고른 것만이 한 해의 얼굴이다.
    sb.from('gallery_media').select('media_url, thumb_url, taken_at, event_id')
      .eq('is_best', true).eq('media_type', 'image')
      .order('taken_at', { ascending:true }),
  ]);
  allWorks  = w.data || [];
  allPosts  = p.data || [];
  allEvents = (e.data || []).filter(x => x.is_public !== false || isAdmin);
  // 볼 수 있는 이벤트의 사진만 — 비공개 이벤트가 여기로 새면 안 된다
  const okEvents = new Set(allEvents.map(x => x.event_id));
  allBest = (b.data || []).filter(x => okEvents.has(x.event_id));

  // 연도 목록은 실제로 자료가 있는 해만 — 빈 해를 눌러 허탕치지 않게
  const years = [...new Set([
    ...allWorks.map(x => yearOf(x.made_on)),
    ...allPosts.map(x => yearOf(x.happened_on || x.created_at)),
    ...allEvents.map(x => yearOf(x.start_date)),
  ].filter(Boolean))].sort((a, b) => b.localeCompare(a));

  // 포트폴리오에서 연도를 골라 넘어오면 그 해로 연다 (?year=2026&who=sua).
  // 여기까지 와서 다시 고르게 하면 옮겨 온 뜻이 없다.
  const q = new URLSearchParams(location.search);
  const wantYear = q.get('year');
  year = (wantYear && years.includes(wantYear)) ? wantYear
       : (years[0] || String(new Date().getFullYear()));
  const wantWho = q.get('who');
  if (AUTHORS[wantWho] || wantWho === 'all') who = wantWho;

  allYears = years;
  buildYearPick();
  $$('#whoPick .dot-btn').forEach(x => x.classList.toggle('on', x.dataset.who === who));
  render();
}

// 포트폴리오의 연도 줄과 같은 규칙: 최근 몇 해만 단추로 두고 나머지는 접는다.
// 5개까지는 다 보이고, 접혀 있어도 지금 보는 해는 반드시 보인다.
const RECENT_YEARS = 4;
function buildYearPick(){
  const foldable = allYears.length > RECENT_YEARS + 1;
  const shown = (foldable && !yearsOpen)
    ? allYears.filter((y, i) => i < RECENT_YEARS || y === year)
    : allYears;
  $('#yearPick').innerHTML = shown.map(y =>
    '<button class="dot-btn small' + (y === year ? ' on' : '') + '" data-year="' + y + '">' +
    y + '년</button>').join('') +
    (foldable
      ? '<button class="dot-btn small" id="yearsMore">' + (yearsOpen ? '접기 <span class="ico">▴</span>' : '그전 <span class="ico">▾</span>') + '</button>'
      : '');
  const more = $('#yearsMore');
  if (more) more.addEventListener('click', () => { yearsOpen = !yearsOpen; buildYearPick(); });
}

// 지금 보고 있는 해와 아이를 주소에 남긴다 — 주소창을 그대로 보내면 같은 화면이 열린다
function syncQuery(){
  const u = new URL(location.href);
  u.searchParams.set('year', year);
  u.searchParams.set('who', who);
  history.replaceState(null, '', u);
  // 탭 이름도 지금 보는 것으로 — 링크를 여러 개 열어 두면 이게 유일한 표지다
  document.title = year + '년 · ' + (AUTHORS[who] || '전체') + ' · 한 해 모아보기';
}

// 지금 보고 있는 그대로의 주소. 해와 사람이 붙어 있으니 받은 쪽도 같은 화면을 연다.
// 인쇄용 주소는 늘 진짜 도메인을 가리켜야 한다 — 미리보기에서 눌러도 마찬가지.
function shareUrl(){
  const u = new URL('https://www.suayona.com/year.html');
  u.searchParams.set('year', year);
  u.searchParams.set('who', who);
  return u.toString();
}
$('#shareBtn').addEventListener('click', async () => {
  const url = shareUrl();
  const msg = $('#shareMsg');
  const 제목 = year + '년 · ' + (AUTHORS[who] || '전체') + ' — 수아랑 연아랑';
  // 손전화에서는 공유판을 띄우고, 안 되면 클립보드로, 그것도 막히면 주소를 보여 준다.
  try {
    if (navigator.share) { await navigator.share({ title: 제목, url }); return; }
    await navigator.clipboard.writeText(url);
    msg.className = 'msg ok'; msg.textContent = '링크를 복사했어요';
  } catch (e) {
    if (e && e.name === 'AbortError') return;      // 공유판을 그냥 닫은 것
    msg.className = 'msg'; msg.textContent = url;
  }
  setTimeout(() => { msg.textContent = ''; }, 4000);
});

function pick(){
  const okWho = a => who === 'all' || a === who;
  return {
    works:  allWorks.filter(x => yearOf(x.made_on) === year && okWho(x.author)),
    posts:  allPosts.filter(x => yearOf(x.happened_on || x.created_at) === year && okWho(x.author)
                                 && x.status !== 'pending'),
    events: allEvents.filter(x => yearOf(x.start_date) === year),
    best:   allBest.filter(x => yearOf(x.taken_at) === year),
  };
}

function render(){
  const { works, posts, events, best } = pick();
  const whoLabel = who === 'all' ? '수아와 연아' : AUTHORS[who];

  $('#printTitle').innerHTML =
    '<h1>' + year + '년 · ' + escapeHTML(whoLabel) + '</h1>' +
    '<p>작품 ' + works.length + '개 · 일기 ' + posts.length + '개 · 일정 ' + events.length + '개</p>';

  let html =
    '<div class="sum">' +
      '<div class="box"><div class="n">' + works.length + '</div><div class="k">작품</div></div>' +
      '<div class="box"><div class="n">' + posts.length + '</div><div class="k">일기</div></div>' +
      '<div class="box"><div class="n">' + events.length + '</div><div class="k">일정</div></div>' +
    '</div>';

  // 작품
  html += '<div class="yr-section"><h2>🎨 만든 것</h2>';
  html += works.length ? '<div class="yr-works">' + works.map(w =>
    '<div class="yr-work">' +
      (w.media_type === 'youtube'
        ? youtubeThumbHTML(youtubeId(w.media_url), w.title, '', '(max-width:400px) 86vw, (max-width:560px) 44vw, 200px') + '<span class="yr-play"></span>'
        : w.media_type === 'video'
        ? '<video src="' + escapeHTML(w.media_url) + '" preload="metadata" muted></video>'
        : '<img src="' + escapeHTML(w.thumb_url || w.media_url) + '" loading="lazy" alt="' + escapeHTML(w.title) + '">') +
      '<div class="cap">' +
        '<div class="t">' + escapeHTML(w.title) + '</div>' +
        (w.quote ? '<div class="q">“' + escapeHTML(w.quote) + '”</div>' : '') +
        '<div class="m">' + escapeHTML(AUTHORS[w.author] || '') +
          (w.made_on ? ' · ' + escapeHTML(formatDate(w.made_on)) : '') + '</div>' +
      '</div>' +
    '</div>').join('') + '</div>'
    : '<div class="yr-empty">이 해에 올린 작품이 없어요.</div>';
  html += '</div>';

  // 일기
  html += '<div class="yr-section"><h2>📖 있었던 일</h2>';
  html += posts.length ? posts.map(p =>
    '<div class="yr-post">' +
      '<h3>' + escapeHTML(p.title) + '</h3>' +
      '<div class="m">' + escapeHTML(AUTHORS[p.author] || '') + ' · ' +
        escapeHTML(formatDate(p.happened_on || p.created_at)) +
        (p.place ? ' · ' + escapeHTML(p.place) : '') + '</div>' +
      (p.body ? '<div class="b note-content">' + renderNoteContent(p.body) + '</div>' : '') +
      (p.image_url ? '<img src="' + escapeHTML(p.image_url) + '" loading="lazy" alt="">' : '') +
    '</div>').join('')
    : '<div class="yr-empty">이 해에 쓴 일기가 없어요.</div>';
  html += '</div>';

  // 베스트 컷 — ★ 를 하나도 안 찍은 해에는 구간째 안 나온다
  if (best.length) {
    const names = new Map(allEvents.map(e =>
      [e.event_id, [e.org_name, e.event_name].filter(Boolean).join(' · ') || e.event_id]));
    html += '<div class="yr-section"><h2>📷 베스트 컷</h2><div class="yr-shots">' +
      best.map(s2 =>
        '<a class="yr-shot" href="/event/e/?slug=' + encodeURIComponent(s2.event_id) + '&tab=gallery"' +
          ' title="' + escapeHTML(names.get(s2.event_id) || '') + '">' +
          '<img src="' + escapeHTML(s2.thumb_url || s2.media_url) + '" loading="lazy" alt="">' +
        '</a>').join('') + '</div></div>';
  }

  // 일정
  html += '<div class="yr-section"><h2>📅 함께한 날</h2>';
  html += events.length ? '<div class="yr-events">' + events.map(e =>
    '<a class="yr-event" href="/event/e/?slug=' + encodeURIComponent(e.event_id) + '">' +
      '<b>' + escapeHTML([e.org_name, e.event_name].filter(Boolean).join(' · ') || e.event_id) + '</b>' +
      '<span>' + escapeHTML(e.date_range_text || e.start_date || '') + '</span>' +
    '</a>').join('') + '</div>'
    : '<div class="yr-empty">이 해에 있었던 이벤트가 없어요.</div>';
  html += '</div>';

  $('#body').innerHTML = html;
  initReveal();
}

$('#yearPick').addEventListener('click', (e) => {
  const b = e.target.closest('[data-year]');
  if (!b) return;
  year = b.dataset.year;
  $$('#yearPick .dot-btn').forEach(x => x.classList.toggle('on', x === b));
  syncQuery();
  render();
});
$('#whoPick').addEventListener('click', (e) => {
  const b = e.target.closest('[data-who]');
  if (!b) return;
  who = b.dataset.who;
  $$('#whoPick .dot-btn').forEach(x => x.classList.toggle('on', x === b));
  syncQuery();
  render();
});

// 인쇄하기 전에 사진이 다 와 있어야 한다. lazy 인 채로 인쇄하면 아직 안 온 것은 빈칸으로 나온다.
$('#printBtn').addEventListener('click', async () => {
  const btn = $('#printBtn');
  const imgs = $$('#body img');
  const pending = imgs.filter(im => { im.loading = 'eager'; return !im.complete; });
  if (pending.length) {
    btn.disabled = true;
    btn.textContent = '사진 불러오는 중... (' + pending.length + '장)';
    await Promise.all(pending.map(im => new Promise(r => {
      im.addEventListener('load', r, { once:true });
      im.addEventListener('error', r, { once:true });
      setTimeout(r, 8000);
    })));
    btn.disabled = false;
    btn.textContent = '🖨 이대로 인쇄하기';
  }
  window.print();
});

(async () => {
  await refreshAuth();
  await loadAll();
  initReveal();
})();
