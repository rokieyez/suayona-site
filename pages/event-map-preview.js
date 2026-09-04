// event/map-preview.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

// 실제 두 이벤트에서 다녀온 자리. 나중에는 events 표의 place_lat/place_lng 를 그대로 읽어 옵니다.
const PLACES = [
  { ev:'busan', name:'부산역',         when:'8/5 09:20', lat:35.1151, lng:129.0415 },
  { ev:'busan', name:'감천문화마을',   when:'8/5 13:00', lat:35.0975, lng:129.0107 },
  { ev:'busan', name:'해운대해수욕장', when:'8/6 11:00', lat:35.1587, lng:129.1604 },
  { ev:'busan', name:'광안리해변',     when:'8/7 18:30', lat:35.1532, lng:129.1186 },
  { ev:'hongchun', name:'홍천 밭',     when:'10/3 10:00', lat:37.6971, lng:127.8888 },
  { ev:'hongchun', name:'홍천강',      when:'10/3 15:00', lat:37.7156, lng:127.8583 },
  { ev:'hongchun', name:'팔봉산',      when:'10/4 09:30', lat:37.6392, lng:127.7639 },
];
const BASE = 'https://ifiemaypzjwdrljmmkgb.supabase.co/storage/v1/object/public/gallery-uploads/';
const EVENTS = {
  busan:    { label:'부산여행',       href:'/event/e/?slug=2026-08-busan',
              photo: BASE + '2026-08-busan/1788102835120-r0yfwh-10147.thumb.jpg' },
  hongchun: { label:'홍천밭에서 놀기', href:'/event/e/?slug=2024-10-hongchun',
              photo: BASE + '2024-10-hongchun/1788018333573-m1k58r-2024-10-03_14_45________3840x2560_.thumb.jpg' },
};

const LL = (lat, lng) => new kakao.maps.LatLng(lat, lng);
const placesOf = ev => PLACES.filter(p => p.ev === ev);
const centerOf = list => LL(
  list.reduce((a,p) => a + p.lat, 0) / list.length,
  list.reduce((a,p) => a + p.lng, 0) / list.length);

function baseMap(id, opts){
  opts = opts || {};
  // 페이지를 스크롤하다 지도에 걸려 확대되는 일이 없도록 휠 확대는 꺼 둔다
  const map = new kakao.maps.Map(document.getElementById(id), {
    center: LL(36.5, 127.9), level: 13, scrollwheel: false,
  });
  if (opts.zoomControl) map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.TOPLEFT);
  return map;
}
function fit(map, list, pad){
  const b = new kakao.maps.LatLngBounds();
  list.forEach(p => b.extend(LL(p.lat, p.lng)));
  pad = pad || {};
  map.setBounds(b, pad.top || 30, pad.right || 30, pad.bottom || 30, pad.left || 30);
}
// 화면에 얹는 딱지 하나. content 를 진짜 요소로 만들어야 눌렀을 때 반응할 수 있다.
function overlay(map, latlng, el, z){
  return new kakao.maps.CustomOverlay({
    map, position: latlng, content: el, xAnchor: 0.5, yAnchor: 0.5,
    clickable: true, zIndex: z || 1,
  });
}
function el(html){
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

/* ---------- 시안 1 : 큰 지도 (이벤트 핀 → 눌러서 장소 핀) ---------- */
(function(){
  const map = baseMap('map1', { zoomControl:true });
  const back = document.getElementById('back1'), cap = document.getElementById('cap1');
  let shown = [], bubble = null;

  const clear = () => {
    shown.forEach(o => o.setMap(null)); shown = [];
    if (bubble) { bubble.setMap(null); bubble = null; }
  };

  function showEvents(){
    clear();
    Object.keys(EVENTS).forEach(ev => {
      const list = placesOf(ev);
      const node = el('<div class="pin-ev">' + EVENTS[ev].label + '<b>' + list.length + '</b></div>');
      node.addEventListener('click', () => showPlaces(ev));
      shown.push(overlay(map, centerOf(list), node, 2));
    });
    fit(map, PLACES, { top:40, right:40, bottom:40, left:40 });
    back.hidden = true;
    cap.textContent = '이벤트 ' + Object.keys(EVENTS).length + '개 · 다녀온 곳 ' + PLACES.length + '군데';
  }

  function showPlaces(ev){
    clear();
    const list = placesOf(ev);
    list.forEach(p => {
      const node = el('<div class="pin">📍</div>');
      node.addEventListener('click', () => {
        if (bubble) bubble.setMap(null);
        const card = el('<div class="bubble"><b>' + p.name + '</b>' + p.when +
          '<br><a href="' + EVENTS[ev].href + '">이 이벤트 보러가기 →</a></div>');
        bubble = new kakao.maps.CustomOverlay({
          map, position: LL(p.lat, p.lng), content: card,
          xAnchor: 0.5, yAnchor: 1.5, clickable: true, zIndex: 5,
        });
      });
      shown.push(overlay(map, LL(p.lat, p.lng), node, 2));
    });
    fit(map, list, { top:56, right:44, bottom:44, left:44 });
    back.hidden = false;
    cap.textContent = EVENTS[ev].label + ' · ' + list.length + '군데';
  }

  back.addEventListener('click', showEvents);
  kakao.maps.event.addListener(map, 'click', () => { if (bubble) { bubble.setMap(null); bubble = null; } });
  showEvents();
})();

/* ---------- 시안 2 : 지도와 목록이 서로 가리킴 ---------- */
(function(){
  const map = baseMap('map2', { zoomControl:true });
  const nodes = {};
  PLACES.forEach(p => {
    const node = el('<div class="pin">📍</div>');
    node.addEventListener('click', () => light(p.ev, true));
    (nodes[p.ev] = nodes[p.ev] || []).push(node);
    overlay(map, LL(p.lat, p.lng), node, 2);
  });
  fit(map, PLACES, { top:36, right:36, bottom:36, left:36 });

  const cards = document.querySelectorAll('.v2 .card');
  const dim = () => {
    cards.forEach(c => c.classList.remove('lit'));
    Object.keys(nodes).forEach(k => nodes[k].forEach(n => n.classList.remove('on')));
  };
  function light(ev, fromMap){
    dim();
    cards.forEach(c => c.classList.toggle('lit', c.dataset.ev === ev));
    nodes[ev].forEach(n => n.classList.add('on'));
    if (fromMap) {
      const card = [...cards].find(c => c.dataset.ev === ev);
      if (card) card.scrollIntoView({ behavior:'smooth', block:'nearest' });
    } else {
      fit(map, placesOf(ev), { top:36, right:36, bottom:36, left:36 });
    }
  }
  cards.forEach(c => {
    c.addEventListener('mouseenter', () => light(c.dataset.ev));
    c.addEventListener('click',      () => light(c.dataset.ev));
    c.addEventListener('mouseleave', dim);
  });
})();

/* ---------- 시안 3 : 얇은 띠 지도 ---------- */
(function(){
  // 띠가 얇아서 전국이 한 화면에 들어온다. 그 크기에서는 한 여행에서 다닌 곳들이
  // 서로 몇 km 안이라 사진이 통째로 포개진다 — 그래서 여기서는 이벤트마다 사진 한 장.
  const map = baseMap('map3');
  const slide = document.getElementById('slide3');
  const nodes = [];

  Object.keys(EVENTS).forEach(ev => {
    const list = placesOf(ev);
    const here = centerOf(list);
    const node = el('<div class="pin-photo"><img alt="" src="' + EVENTS[ev].photo + '"></div>');
    node.addEventListener('click', () => {
      nodes.forEach(n => n.classList.remove('on'));
      node.classList.add('on');
      // 이름표는 한 줄로. 길어지면 띠를 다 덮어서 정작 사진이 안 보인다.
      const names = list.slice(0, 2).map(p => p.name).join(', ') +
        (list.length > 2 ? ' 외 ' + (list.length - 2) + '곳' : '');
      document.getElementById('slideText').innerHTML =
        EVENTS[ev].label + '<span class="sub">' + names + '</span>';
      document.getElementById('slideLink').href = EVENTS[ev].href;
      slide.classList.add('open');
      map.panTo(here);            // 누른 사진을 한가운데로 — 이름표가 덮지 않게
    });
    nodes.push(node);
    overlay(map, here, node, 2);
  });
  // 여백을 크게 두면 안 된다. 카카오 지도는 레벨 14 보다 더 물러날 수 없는데,
  // 얇은 띠가 그 레벨에서 담는 세로 폭이 부산~홍천(2.6도)에 여백까지 얹기엔 빠듯하다.
  fit(map, PLACES, { top:22, right:22, bottom:22, left:22 });
  kakao.maps.event.addListener(map, 'click', () => slide.classList.remove('open'));
})();
