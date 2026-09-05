// 서비스 워커 — 지하철이나 엘리베이터처럼 신호가 끊기는 곳에서도 한 번 본 페이지는
// 다시 열리게 한다.
//
// 반드시 「네트워크 먼저」다. 캐시 먼저로 두면 안 되는 이유가 이 사이트에는 실제로 있다:
// HTML 과 common.js·pixel.js 가 모두 max-age=600 으로 나가서, 배포 직후 최대 10분 동안
// 새 HTML 과 옛 스크립트가 짝지어질 수 있다. 캐시를 먼저 주면 그 어긋남이 10분이 아니라
// 무기한이 되고, 함수 하나가 없어 첫 화면이 통째로 비는 사고가 난다.
// 그래서 캐시는 오직 네트워크가 실패했을 때의 대비책으로만 쓴다.
const CACHE = 'suayona-v2';
const OFFLINE = '/offline.html';

// 그리기는 신호가 없어도 열려야 한다 — 그래서 한 번도 안 들른 사람에게도 미리 담아 둔다.
// 하나라도 없으면 addAll 은 통째로 실패하므로 한 장씩 담고 실패는 넘긴다.
const PRECACHE = [OFFLINE, '/draw.html', '/pages/draw.js', '/pixel.js', '/common.js', '/style.css'];

// 담아 둘 수 있는 최대 벌수. 캐시는 주소가 한 글자만 달라도 다른 자리를 차지하는데,
// 이 사이트의 주소에는 ?tab=, ?work=, ?year= 처럼 뜻이 있는 꼬리표가 붙는다. 그래서
// 오래 쓰면 같은 쪽이 수십 벌씩 쌓인다 — 실제로 한 브라우저에서 portfolio.html 이
// 마흔다섯 벌, 전체 365벌 14.8MB 였다. 네트워크 먼저라 옛 벌은 쓸 일이 없으니
// 담을 때마다 오래된 것부터 잘라 상한을 지킨다. keys() 는 담은 차례대로 준다.
const MAX_ENTRIES = 120;

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

  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        putCapped(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(hit => {
      if (hit) return hit;
      // 주소 뒤에 ?v=… 가 붙어 담긴 것을 그냥 「/」로 들어와도 찾게 한다.
      // 캐시 무시용 꼬리표 하나 때문에 오프라인 안내로 떨어지곤 했다.
      return caches.match(req, { ignoreSearch: true }).then(loose =>
        loose || (req.mode === 'navigate' ? caches.match(OFFLINE) : Response.error())
      );
    }))
  );
});
