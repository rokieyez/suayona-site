// 서비스 워커 — 지하철이나 엘리베이터처럼 신호가 끊기는 곳에서도 한 번 본 페이지는
// 다시 열리게 한다.
//
// 반드시 「네트워크 먼저」다. 캐시 먼저로 두면 안 되는 이유가 이 사이트에는 실제로 있다:
// HTML 과 common.js·pixel.js 가 모두 max-age=600 으로 나가서, 배포 직후 최대 10분 동안
// 새 HTML 과 옛 스크립트가 짝지어질 수 있다. 캐시를 먼저 주면 그 어긋남이 10분이 아니라
// 무기한이 되고, 함수 하나가 없어 첫 화면이 통째로 비는 사고가 난다.
// 그래서 캐시는 오직 네트워크가 실패했을 때의 대비책으로만 쓴다.
const CACHE = 'suayona-v2';
// 미리 담는 파일들의 내용 해시 — 배포 때 tools/stamp-versions.mjs 가 찍는다. 이 줄이 바뀌면 sw.js 바이트가 달라져
// 새 워커가 깔리며 PRECACHE 를 같은 캐시에 다시 담는다. CACHE 이름에 붙이면 안 된다 — activate 가 이름이 다른 캐시를
// 통째로 지워, 공용 파일이 바뀌는 배포마다 그동안 본 쪽의 오프라인 사본이 전부 사라진다.
// PRECACHE-HASH: -
const OFFLINE = '/offline.html';

// 그리기·지뢰찾기·한 번 눌러 뛰기는 신호가 없어도 열려야 한다 — 달리는 동안 서버를 안 부르는
// 놀이라 지하철에서도 그대로 된다(순위표만 신호가 있을 때 읽는다). 그래서 한 번도 안 들른
// 사람에게도 미리 담아 둔다. 하나라도 없으면 addAll 은 통째로 실패하므로 한 장씩 담고 실패는 넘긴다.
const PRECACHE = [OFFLINE, '/draw.html', '/pages/draw.js', '/mine.html', '/pages/mine.js',
                  '/games.html', '/pages/games.js', '/run.html', '/pages/run-page.js', '/pages/run.js',
                  '/pixel.js', '/common.js', '/style.css',
                  // 글꼴도 같이 — 빠져 있어서, 첫 방문 직후 신호가 끊기면 놀이가 기본 글꼴로 떴다.
                  // 어느 쪽이든 어차피 받는 파일들이라 더 받는 것은 없다.
                  '/fonts/dot.css', '/fonts/Galmuri11.subset.woff2', '/fonts/Galmuri11-Bold.subset.woff2',
                  '/fonts/PretendardVariable.subset.woff2',
                  // 로고가 쓰는 작은 벌(936B) — 첫 화면 말고는 로고가 이 벌을 쓴다.
                  '/fonts/Galmuri11-Bold.logo.woff2'];

// 담아 둘 수 있는 최대 벌수. 캐시는 주소가 한 글자만 달라도 다른 자리를 차지하는데,
// 이 사이트의 주소에는 ?tab=, ?work=, ?year= 처럼 뜻이 있는 꼬리표가 붙는다. 그래서
// 오래 쓰면 같은 쪽이 수십 벌씩 쌓인다 — 실제로 한 브라우저에서 portfolio.html 이
// 마흔다섯 벌, 전체 365벌 14.8MB 였다. 네트워크 먼저라 옛 벌은 쓸 일이 없으니
// 담을 때마다 오래된 것부터 잘라 상한을 지킨다. keys() 는 담은 차례대로 준다.
//
// 120 → 240: andere.html 의 그림 92장이 base64 로 HTML 안에 있다가 파일(andere/img/)로 나오면서 한 쪽이 항목
// 90여 개를 차지하게 됐다. 120 이면 안데레를 한 번 보는 것으로 다른 쪽의 담아 둔 벌이 거의 다 밀려난다(그림만 4MB 라 부담은 작다).
const MAX_ENTRIES = 240;

// 미리 담아 둔 것(오프라인 그리기)은 아무리 오래돼도 자르지 않는다 — 자르면
// 신호 없는 곳에서 그리기가 안 열린다. 그게 미리 담아 둔 이유다.
const KEEP = new Set(PRECACHE.map(u => new URL(u, self.location.origin).href));

async function putCapped(req, res){
  const c = await caches.open(CACHE);
  await c.put(req, res);
  const ks = await c.keys();
  let over = ks.length - MAX_ENTRIES;
  for (let i = 0; i < ks.length && over > 0; i++){
    if (KEEP.has(ks[i].url)) continue;
    await c.delete(ks[i]);
    over--;
  }
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 우리 사이트 파일만 다룬다. 수파베이스·유튜브·폰트 CDN 은 건드리지 않는다 —
  // 로그인 토큰이나 남의 응답을 우리 캐시에 담을 이유가 없다.
  if (url.origin !== self.location.origin) return;
  // 영상 조각 요청(Range)은 부분 응답이라 캐시에 담으면 깨진다.
  if (req.headers.has('range')) return;

  // 약한 신호에서는 fetch 가 거절되지 않고 수십 초 매달려서, 아래 대비책(catch)이 돌 기회가 없었다(흰 화면).
  // 그래서 페이지 이동만 5초 안에 못 받으면 담아 둔 벌로 넘긴다. 담아 둔 벌이 없으면 계속 기다린다 —
  // 처음 가는 쪽을 오프라인 안내로 끊을 까닭은 없다.
  // fetch(req, { signal }) 로 끊지 않고 경주를 시킨다: init 을 주면 navigate 요청의 mode 가 same-origin 으로
  // 바뀌고, AbortSignal.timeout 은 Safari 16.4 부터라 대체가 또 필요하다. 늦게라도 도착한 응답은 그대로 캐시에 담긴다.
  const nav = req.mode === 'navigate';
  const net = fetch(req).then(res => {
    if (res && res.status === 200 && res.type === 'basic') {
      putCapped(req, res.clone()).catch(() => {});
    }
    return res;
  });
  // 주소 뒤에 ?v=… 가 붙어 담긴 것을 그냥 「/」로 들어와도 찾게 한다.
  // 캐시 무시용 꼬리표 하나 때문에 오프라인 안내로 떨어지곤 했다.
  const cached = () => caches.match(req).then(hit => hit || caches.match(req, { ignoreSearch: true }));

  e.respondWith(
    (nav ? Promise.race([net, new Promise(r => setTimeout(r, 5000)).then(cached).then(hit => hit || net)]) : net)
      .catch(() => cached().then(hit => hit || (nav ? caches.match(OFFLINE) : Response.error())))
  );
});
