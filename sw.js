// 서비스 워커 — 지하철이나 엘리베이터처럼 신호가 끊기는 곳에서도 한 번 본 페이지는
// 다시 열리게 한다.
//
// 반드시 「네트워크 먼저」다. 캐시 먼저로 두면 안 되는 이유가 이 사이트에는 실제로 있다:
// HTML 과 common.js·pixel.js 가 모두 max-age=600 으로 나가서, 배포 직후 최대 10분 동안
// 새 HTML 과 옛 스크립트가 짝지어질 수 있다. 캐시를 먼저 주면 그 어긋남이 10분이 아니라
// 무기한이 되고, 함수 하나가 없어 첫 화면이 통째로 비는 사고가 난다.
// 그래서 캐시는 오직 네트워크가 실패했을 때의 대비책으로만 쓴다.
const CACHE = 'suayona-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(OFFLINE)).then(() => self.skipWaiting()));
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
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req).then(hit =>
        hit || (req.mode === 'navigate' ? caches.match(OFFLINE) : Response.error())
      )
    )
  );
});
