// 수아연아 농장의 규칙 — 숫자와 표만 있고 화면은 없다.
// 모험단(quest-rules.js)과 같은 이유로 화면(farm.html)과 떼어 둔다:
// 노드에서 이 파일만 읽어 한 해를 통째로 돌려 보고 「며칠이면 온실을 지을 수 있나」를
// 잰다. 균형은 감이 아니라 측정으로 맞춘다.
//
// 시간은 진짜 시간이다. 작물은 물이 있는 동안만 자라고, 하루가 지나면 기운이 찬다.
// 계절은 며칠(기본 7일)마다 바뀐다 — 매일 조금씩 들러야 하는 놀이라서.
const FARM = (() => {

  // ---------- 시간 ----------
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_NAME = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
  const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
  const SEASON_LEN_DEFAULT = 7;                 // 한 계절 = 7일. 부모 조정판이 바꿀 수 있다.
  const H = 3600 * 1000;
  const DAY_MS = 24 * H;

  function dayKey(t){
    const d = new Date(t == null ? Date.now() : t), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function dayStartMs(key){ const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
  function daysBetween(a, b){ return Math.round((dayStartMs(b) - dayStartMs(a)) / DAY_MS); }

  // 농장이 시작된 날부터 며칠째인지로 계절을 센다.
  function calendar(world, now){
    const len = Math.max(3, Number(world.seasonLen) || SEASON_LEN_DEFAULT);
    const idx = Math.max(0, daysBetween(world.started, dayKey(now)));
    const si = Math.floor(idx / len);
    return {
      day: idx, len,
      season: SEASONS[si % 4],
      year: Math.floor(si / 4) + 1,
      dayOfSeason: (idx % len) + 1,
      lastDay: (idx % len) === len - 1,          // 계절 마지막 날 = 축제
      seasonIndex: si,                            // 계절이 바뀌었는지 비교하는 데 쓴다
    };
  }

  // 날씨 — 날짜만으로 정해진다. 서버가 없어도 두 아이 화면이 같은 날씨를 본다.
  function prand(seed){
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return (h % 10000) / 10000;
  }
  const WEATHER = {
    sun:   { name: '맑음',  icon: '☀️' },
    rain:  { name: '비',    icon: '🌧️' },
    storm: { name: '천둥',  icon: '⛈️' },
    snow:  { name: '눈',    icon: '🌨️' },
    wind:  { name: '바람',  icon: '🍃' },
  };
  /* 진짜 하늘 — 서울 기준. 페이지가 open-meteo 에서 받아다 setSky 로
     넣어 주면, 그날 농장 날씨는 지어내지 않고 밖에 실제로 내리는 것을 그대로 쓴다.
     「오늘 비 왔지?」가 농장에서도 비여야 아이가 창밖과 화면을 잇는다.
     못 받아 오면(신호가 없거나 표에 없는 날짜) 지금까지처럼 날짜로 지어낸다. */
  const SKY_AT = { lat: 37.53, lng: 127.08, name: '서울' };
  let sky = {};
  function setSky(map){ sky = (map && typeof map === 'object') ? map : {}; }
  function skyOf(key){ const w = sky[key]; return WEATHER[w] ? w : null; }
  /* 해 뜨고 지는 시각도 같은 자리에서 받아 둔다(서울 기준, 시각은 시간 단위 실수).
     농장 하루의 빛은 지금까지 시각이 박혀 있었다 — 겨울에도 일곱 시에 밝아졌다.
     진짜 시각을 알면 겨울엔 다섯 시에 저물고 여름엔 여덟 시까지 환하다. */
  let sun = {};
  function setSun(map){ sun = (map && typeof map === 'object') ? map : {}; }
  function sunOf(key){
    const s2 = sun[key];
    if (!s2 || !(s2.rise > 0) || !(s2.set > s2.rise) || !(s2.set < 24)) return null;
    return s2;
  }
  function weatherOf(key, season){
    const real = skyOf(key);
    if (real) return real;
    const r = prand('w' + key);
    if (season === 'winter') return r < 0.45 ? 'snow' : 'sun';
    if (season === 'spring') return r < 0.35 ? 'rain' : 'sun';
    if (season === 'summer') return r < 0.08 ? 'storm' : r < 0.25 ? 'rain' : 'sun';
    return r < 0.25 ? 'rain' : r < 0.4 ? 'wind' : 'sun';   // 가을
  }
  /* 내일 날씨. 날씨가 날짜만으로 정해지니 미리 볼 수 있다 — 스타듀밸리의 텔레비전 일기예보와
     같은 자리다. 「내일 비가 오니 오늘은 다른 일을 하자」는 판단이 생기라고 둔다.
     계절이 내일 바뀔 수도 있어서 달력을 내일 것으로 다시 센다. */

  // ---------- 작물 ----------
  // hours: 다 자라는 데 걸리는 시간(물이 있는 동안만 센다). regrow: 다시 열리는 시간(있으면 여러 번 딴다).
  // half: 어느 자매의 가게에만 있는 씨앗인지. 반은 언니만, 반은 동생만 살 수 있어서 서로 나눠야 한다.
  // giant: 자매가 같은 날 나란히 심으면 하나로 합쳐지는 큰 작물.
  // 그림은 5×5 열매 무늬 하나와 잎 색으로 그린다 — 작물이 스물이라 하나하나 도트를 찍지는 않는다.
  const CROPS = {
    radish:     { name: '무',       season: ['spring'],          hours: 6,   seed: 6,   sell: 14,  yield: 1, half: 'sua',  lv: 1, leaf: '#8fcf7a', fruit: '#f5f0e8', shape: 'root' },
    potato:     { name: '감자',     season: ['spring'],          hours: 24,  seed: 14,  sell: 38,  yield: 2, half: 'yona', lv: 1, leaf: '#7fbf6a', fruit: '#d9b26f', shape: 'root' },
    pea:        { name: '완두콩',   season: ['spring'],          hours: 30,  seed: 20,  sell: 26,  yield: 3, half: 'sua',  lv: 2, leaf: '#79c46d', fruit: '#8fd66c', shape: 'vine', regrow: 18 },
    strawberry: { name: '딸기',     season: ['spring'],          hours: 48,  seed: 40,  sell: 34,  yield: 2, half: 'yona', lv: 2, leaf: '#5fae55', fruit: '#ff5c6b', shape: 'bush', regrow: 20 },
    tulip:      { name: '튤립',     season: ['spring'],          hours: 30,  seed: 18,  sell: 40,  yield: 1, half: 'sua',  lv: 1, leaf: '#78c06a', fruit: '#ff8fb8', shape: 'flower', flower: true },
    cabbage:    { name: '양배추',   season: ['spring'],          hours: 60,  seed: 45,  sell: 120, yield: 1, half: 'yona', lv: 3, leaf: '#8fd08f', fruit: '#b9e6a3', shape: 'head' },

    corn:       { name: '옥수수',   season: ['summer', 'autumn'], hours: 48, seed: 30,  sell: 32,  yield: 1, half: 'sua',  lv: 1, leaf: '#6fbf5a', fruit: '#ffe066', shape: 'tall', regrow: 24 },
    tomato:     { name: '토마토',   season: ['summer'],          hours: 40,  seed: 28,  sell: 28,  yield: 2, half: 'yona', lv: 1, leaf: '#66b25a', fruit: '#ff5a4a', shape: 'bush', regrow: 20 },
    watermelon: { name: '수박',     season: ['summer'],          hours: 96,  seed: 60,  sell: 180, yield: 1, half: 'sua',  lv: 3, leaf: '#5aa54f', fruit: '#3f9a4b', shape: 'melon', giant: true },
    sunflower:  { name: '해바라기', season: ['summer', 'autumn'], hours: 36, seed: 22,  sell: 48,  yield: 1, half: 'yona', lv: 1, leaf: '#79b85f', fruit: '#ffcf3d', shape: 'flower', flower: true },
    blueberry:  { name: '블루베리', season: ['summer'],          hours: 60,  seed: 50,  sell: 30,  yield: 3, half: 'sua',  lv: 2, leaf: '#4d9c5f', fruit: '#5d6fd6', shape: 'bush', regrow: 30 },
    pepper:     { name: '고추',     season: ['summer'],          hours: 48,  seed: 24,  sell: 22,  yield: 3, half: 'yona', lv: 2, leaf: '#5fb050', fruit: '#e63a2e', shape: 'bush', regrow: 24 },

    carrot:     { name: '당근',     season: ['autumn'],          hours: 12,  seed: 10,  sell: 24,  yield: 1, half: 'yona', lv: 1, leaf: '#7cc763', fruit: '#ff8c2e', shape: 'root' },
    sweetpotato:{ name: '고구마',   season: ['autumn'],          hours: 36,  seed: 22,  sell: 60,  yield: 2, half: 'sua',  lv: 1, leaf: '#6fb761', fruit: '#b04a8a', shape: 'root' },
    pumpkin:    { name: '호박',     season: ['autumn'],          hours: 96,  seed: 70,  sell: 220, yield: 1, half: 'yona', lv: 3, leaf: '#5fa64e', fruit: '#ff9a2e', shape: 'melon', giant: true },
    grape:      { name: '포도',     season: ['autumn'],          hours: 72,  seed: 55,  sell: 44,  yield: 2, half: 'sua',  lv: 2, leaf: '#5aa04c', fruit: '#8a5cc7', shape: 'vine', regrow: 36 },
    cosmos:     { name: '코스모스', season: ['autumn'],          hours: 24,  seed: 15,  sell: 36,  yield: 1, half: 'yona', lv: 1, leaf: '#84c46f', fruit: '#ff9bc9', shape: 'flower', flower: true },
    napa:       { name: '배추',     season: ['autumn'],          hours: 72,  seed: 50,  sell: 150, yield: 1, half: 'sua',  lv: 3, leaf: '#a4d98a', fruit: '#e8f2c0', shape: 'head' },

    spinach:    { name: '시금치',   season: ['winter', 'spring'], hours: 18, seed: 12,  sell: 30,  yield: 1, half: 'yona', lv: 1, leaf: '#3f8f45', fruit: '#4fa653', shape: 'head' },
    winterradish:{ name: '겨울무',  season: ['winter'],          hours: 30,  seed: 18,  sell: 55,  yield: 1, half: 'sua',  lv: 1, leaf: '#9fd0a8', fruit: '#e8f4ee', shape: 'root' },
    snowflower: { name: '눈꽃',     season: ['winter'],          hours: 48,  seed: 35,  sell: 90,  yield: 1, half: 'yona', lv: 2, leaf: '#b9dde6', fruit: '#eef8ff', shape: 'flower', flower: true },

    // 봄 — 늦게 들어온 것들
    lettuce:    { name: '상추',     season: ['spring'],          hours: 8,   seed: 8,   sell: 16,  yield: 2, half: 'yona', lv: 1, leaf: '#9ad48a', fruit: '#b7e59b', shape: 'head',   regrow: 10 },
    onion:      { name: '양파',     season: ['spring'],          hours: 20,  seed: 16,  sell: 34,  yield: 1, half: 'sua',  lv: 2, leaf: '#7ec46f', fruit: '#e8d5b0', shape: 'root' },
    daffodil:   { name: '수선화',   season: ['spring'],          hours: 26,  seed: 20,  sell: 44,  yield: 1, half: 'yona', lv: 2, leaf: '#74bd66', fruit: '#ffe98a', shape: 'flower', flower: true },
    // 여름
    cucumber:   { name: '오이',     season: ['summer'],          hours: 30,  seed: 20,  sell: 24,  yield: 2, half: 'sua',  lv: 1, leaf: '#63b455', fruit: '#6fbf4a', shape: 'vine',   regrow: 16 },
    melon:      { name: '참외',     season: ['summer'],          hours: 66,  seed: 45,  sell: 130, yield: 1, half: 'yona', lv: 3, leaf: '#5aa54f', fruit: '#ffd84d', shape: 'melon' },
    lily:       { name: '백합',     season: ['summer'],          hours: 34,  seed: 26,  sell: 58,  yield: 1, half: 'sua',  lv: 2, leaf: '#6fb763', fruit: '#fff2f6', shape: 'flower', flower: true },
    // 가을
    eggplant:   { name: '가지',     season: ['autumn'],          hours: 44,  seed: 30,  sell: 40,  yield: 2, half: 'sua',  lv: 2, leaf: '#66ab5a', fruit: '#7d4fa8', shape: 'bush',   regrow: 22 },
    chrys:      { name: '국화',     season: ['autumn'],          hours: 28,  seed: 18,  sell: 42,  yield: 1, half: 'yona', lv: 1, leaf: '#82c06e', fruit: '#ffcf5c', shape: 'flower', flower: true },
    // 겨울
    kale:       { name: '케일',     season: ['winter'],          hours: 26,  seed: 16,  sell: 46,  yield: 1, half: 'sua',  lv: 1, leaf: '#4f9a58', fruit: '#6fb26a', shape: 'head' },
    camellia:   { name: '동백꽃',   season: ['winter'],          hours: 54,  seed: 38,  sell: 100, yield: 1, half: 'yona', lv: 2, leaf: '#2f7a48', fruit: '#e8324a', shape: 'flower', flower: true },

    // 축제에서만 얻는 씨앗. 어느 계절이든 자라고, 온실이 없어도 겨울을 난다.
    star:       { name: '별열매',   season: SEASONS.slice(),     hours: 120, seed: 0,   sell: 400, yield: 1, half: null,   lv: 1, leaf: '#8fd8ff', fruit: '#ffe680', shape: 'flower', hardy: true, rare: true },
    // 그 농장에서만 사고 심는 작물(farm) — 2026-10-09 로키즈 「오로라 농장만의 특색 있는 제품」. 맨 끝에 둬야 앞 작물 차례(주문·시세 뽑기)가 안 밀린다
    cloudberry: { name: '클라우드베리', season: ['summer'],      hours: 60,  seed: 70,  sell: 95,  yield: 2, half: null,   lv: 1, leaf: '#6fa65a', fruit: '#ff9a2e', shape: 'bush', regrow: 36, farm: 'aurora' },
    // 사막 오아시스(2026-10-09) — 선인장 열매. 한 번 심으면 거둔 뒤 다시 열린다
    dragonfruit:{ name: '용과',     season: ['summer', 'autumn'], hours: 66, seed: 80,  sell: 110, yield: 2, half: null,   lv: 1, leaf: '#5aa064', fruit: '#e8407a', shape: 'bush', regrow: 40, farm: 'desert' },
    /* 2026-10-09 로키즈 「각 농장에서만 얻을 수 있는 동식물 — 여러 농장을 거쳐 방주로 가는 서사」. 농장마다 그 땅에서만 사고 심는 작물이 하나씩.
       씨앗을 방주 씨앗 금고에 넣어야 다음 농장으로 떠난다(moveState). 겨울만 빼고 자라 오래 기다리지 않게 */
    fig:        { name: '무화과',   season: ['spring', 'summer', 'autumn'], hours: 54, seed: 60, sell: 85, yield: 2, half: null, lv: 1, leaf: '#6a9a50', fruit: '#7a3a6a', shape: 'bush', regrow: 30, farm: 'seaside' },
    tea:        { name: '녹차',     season: ['spring', 'summer', 'autumn'], hours: 40, seed: 50, sell: 60, yield: 2, half: null, lv: 1, leaf: '#2f6a3a', fruit: '#9ad86a', shape: 'head', regrow: 24, farm: 'cloud' },
    cranberry:  { name: '크랜베리', season: ['spring', 'summer', 'autumn'], hours: 56, seed: 70, sell: 95, yield: 3, half: null, lv: 1, leaf: '#5a7a3a', fruit: '#c8203a', shape: 'bush', regrow: 30, farm: 'maple' },
    cacao:      { name: '카카오',   season: ['spring', 'summer', 'autumn'], hours: 64, seed: 80, sell: 110, yield: 2, half: null, lv: 1, leaf: '#3f8a4a', fruit: '#d8862a', shape: 'bush', regrow: 36, farm: 'jungle' },
    kiwano:     { name: '뿔멜론',   season: ['spring', 'summer', 'autumn'], hours: 70, seed: 90, sell: 230, yield: 1, half: null, lv: 1, leaf: '#7aa04a', fruit: '#f0902a', shape: 'melon', farm: 'savanna' },
  };
  const CROP_IDS = Object.keys(CROPS);
  // 농장 전용(farm)인 것은 그 농장에 살 때만 — 작물·물고기·꾸미개·가구 모두 같은 뜻
  // 무지개 농장에서는 방주 씨앗 금고에 넣어 온 작물이면 다른 농장 전용이라도 자란다(2026-10-09 「수아연아의 방주」)
  const farmOk = (world, X) => !X || !X.farm || X.farm === farmOf(world).id
    || (farmOf(world).id === 'newland' && !!(world.ark && Array.isArray(world.ark.seeds)) && world.ark.seeds.some(c => CROPS[c] === X));
  // 훈장의 작물 수는 어느 농장에서나 거둘 수 있는 것만 센다 — 농장 전용 작물이 늘어도 앞 농장 아이의 훈장 문턱이 안 바뀐다
  const DEX_CROP_IDS = CROP_IDS.filter(c => !CROPS[c].farm);
  const GIANT_MULT = 5;          // 큰 작물은 다섯 배로 팔린다
  const GOLD_MULT = 2;           // 반짝 작물(★★★)은 두 배로 팔린다
  const GIANT_TIME = 1.6;        // 대신 시간이 더 걸린다
  const FERT_SPEED = 1.5;        // 비료를 준 칸은 1.5배 빨리 자란다
  const WATER_HOURS = 20;        // 한 번 물을 주면 스무 시간 촉촉하다
  const GH_ALWAYS_WET = true;    // 온실 칸은 물을 안 줘도 된다

  // ---------- 밭 ----------
  // 밭은 16×11 칸 지도의 오른쪽(가로 6..15, 세로 2..7)이다. 처음엔 4×3 = 12칸, 넓힐수록 는다.
  const FIELD = { x0: 6, y0: 2, w: 10, h: 6 };
  const EXPANSIONS = [
    { w: 4, h: 3, cost: 0,    lv: 1 },
    { w: 6, h: 4, cost: 300,  lv: 2 },
    { w: 8, h: 5, cost: 900,  lv: 4 },
    { w: 10, h: 6, cost: 2500, lv: 6 },
  ];
  const GH = { w: 4, h: 3 };     // 온실 안 12칸
  /* 스프링클러. 밭 한 칸을 차지하고, 아침마다 둘레 네 칸에 물을 준다.
     그 칸에는 심을 수 없다 — 한 칸을 내주고 네 칸의 손을 던다.
     좋은 것은 모서리까지 여덟 칸(스타듀밸리의 품질 스프링클러 자리). 값은 밭을 한 번 더
     넓히는 값(2500)보다 조금 비싸게 뒀다 — 「넓힐까, 손을 덜까」가 고민이 되라고. */
  const SPRINKLER  = { name: '스프링클러',      cost: 1500, lv: 5, reach: 4, item: 'sprinkler' };
  const SPRINKLER2 = { name: '좋은 스프링클러', cost: 3500, lv: 6, reach: 8, item: 'sprinkler2' };
  const SPRINKLERS = { sprinkler: SPRINKLER, sprinkler2: SPRINKLER2 };
  const sprinklerOf = s => (s && s.k === 'good') ? SPRINKLER2 : SPRINKLER;
  function plotIds(world, area){
    const out = [];
    if (area === 'gh'){
      for (let y = 0; y < GH.h; y++) for (let x = 0; x < GH.w; x++) out.push('g' + x + ',' + y);
      return out;
    }
    const k = Math.min(world.expand || 0, EXPANSIONS.length - 1);
    fieldCells(world).forEach(c => { if (c.k <= k) out.push(c.id); });
    return out;
  }
  /* 밭 모양 — 새 농장은 저마다 다르다(2026-09-29 로키즈). 숫자는 그 칸이 열리는 넓히기 차례
     (0 처음 12칸 · 1 24칸 · 2 40칸 · 3 60칸, 들판과 같은 수). 칸 이름은 지도 좌표 'x,y' 그대로다.
     바닷가: 바다 쪽 앞줄부터 모래 언덕처럼 위가 둥글게 · 산골: 왼쪽 위에서 열려 오른쪽 아래 비탈로 계단(다랭이)처럼 내려간다 ·
     꽃구름: 가운데서 부풀어 위아래가 뭉게뭉게. 들판은 EXPANSIONS 네모 그대로.
     이사 때는 같은 차례끼리 순서대로 옮겨 심는다(moveFarm). 겹침·길 막힘은 tools/check-move.js 가 본다. */
  const FIELD_SHAPE = {
    seaside: { x0: 6, y0: 1, rows: [
      '...3333...',
      '..333333..',
      '3333223333',
      '3222222223',
      '2211111122',
      '2100000012',
      '1100000011'] },
    mountain: { x0: 6, y0: 2, rows: [
      '0000011122...',
      '0000112223...',
      '0011122233...',
      '0111222333...',
      '..12223333...',
      '...2233333333',
      '........33...'] },
    cloud: { x0: 6, y0: 1, rows: [
      '.33....33.',
      '3332222333',
      '3211001123',
      '2210000123',
      '2210000123',
      '3211001123',
      '.332..233.'] },
    aurora: { x0: 6, y0: 1, rows: [
      '..333333..',
      '.32222223.',
      '3211111123',
      '3210000123',
      '3210000123',
      '3210000123',
      '..332233..'] },
    // 방주 농장 — 밭은 오른쪽 뒤(가운데는 방주 터라). 모양은 오로라와 같다(차례마다 칸 수가 같아야 이사 때 옮겨 심긴다)
    ark: { x0: 29, y0: 2, rows: [
      '..333333..',
      '.32222223.',
      '3211111123',
      '3210000123',
      '3210000123',
      '3210000123',
      '..332233..'] },
    // 무지개 농장 — 집 옆 앞쪽 들판. 물 빠진 땅을 새로 일군다
    newland: { x0: 7, y0: 4, rows: [
      '..333333..',
      '.32222223.',
      '3211111123',
      '3210000123',
      '3210000123',
      '3210000123',
      '..332233..'] },
  };
  const fieldMemo = {};
  // 그 농장의 밭 칸 전부(아직 안 연 것까지) — 열리는 차례, 그다음 위에서 아래·왼쪽에서 오른쪽 순
  function fieldCells(world){
    const fid = farmOf(world).id;
    if (fieldMemo[fid]) return fieldMemo[fid];
    const out = [], S = FIELD_SHAPE[fid];
    if (S) S.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') out.push({ x: S.x0 + x, y: S.y0 + y, k: Number(r[x]) }); });
    else for (let y = 0; y < FIELD.h; y++) for (let x = 0; x < FIELD.w; x++) out.push({ x: FIELD.x0 + x, y: FIELD.y0 + y, k: EXPANSIONS.findIndex(E => x < E.w && y < E.h) });
    out.forEach(c => { c.id = c.x + ',' + c.y; });
    out.sort((a, b) => a.k - b.k || a.y - b.y || a.x - b.x);
    return (fieldMemo[fid] = out);
  }
  function fieldHas(world, x, y){ return fieldCells(world).some(c => c.x === x && c.y === y); }
  // 밭 칸을 모두 품는 네모 — 손님이 들를 자리처럼 대강이면 되는 곳에
  function fieldBox(world){
    const C = fieldCells(world), xs = C.map(c => c.x), ys = C.map(c => c.y), x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
  }
  function parseId(id){ const s = id[0] === 'g' ? id.slice(1) : id; const [x, y] = s.split(',').map(Number); return { x, y, gh: id[0] === 'g' }; }

  // 한 칸의 상태: { tilled, crop, by, plantedAt, progress(ms), wet(until ms), tick(마지막으로 센 때), fert, giant, wilted, picks }
  // 물이 있는 동안만 progress 가 는다. 마지막으로 센 때(tick)부터 지금까지 중 젖어 있던 만큼만 더한다.
  //
  // 시드는 것은 「일주일」 하나뿐이다(현실 시간, 계절과 상관없다 — 2026-09-11).
  // 또 열리는 작물은 마지막으로 딴 때부터, 나머지는 심은 때부터 센다(2026-09-12).
  // 예전에는 계절이 바뀌는 날 제철이 아닌 작물이 한꺼번에 시들었다. 한 계절이 7일이라,
  // 전날 심은 감자까지 봄이 끝나는 날 모두 시들어 너무 빨리 죽는다는 말을 들었다.
  // 온실 칸과 별열매(hardy)는 예전처럼 시들지 않는다.
  const CROP_LIFE_DAYS = 7;
  function ages(plot, gh){ const C = CROPS[plot.crop]; return !gh && !!plot.plantedAt && !(C && C.hardy); }
  /* 일주일을 어디서부터 세는가 — 또 열리는 작물(토마토·딸기…)은 딸 때마다 새로 센다.
     돌보며 계속 따 먹는 밭이 「심은 날」만 보고 죽어 버리면 아이가 억울하다.
     한 번도 안 딴 칸과 한 번 따면 끝인 작물은 심은 날부터 그대로. */
  function lifeFrom(plot){ return plot.pickedAt || plot.plantedAt; }
  /* 큰 작물은 자라는 시간이 긴 만큼(GIANT_TIME) 수명도 길다(2026-10-10) — 큰 수박·호박은 젖은 채 153.6시간이 드는데
     하루 한 번 물(스무 시간)로는 일주일에 140시간뿐이라, 날마다 물을 줘도 익기 전에 시들었다. */
  function lifeEnd(plot){ return lifeFrom(plot) + CROP_LIFE_DAYS * (plot.giant ? GIANT_TIME : 1) * DAY_MS; }
  // 시들 때까지 남은 시간(ms). 안 시드는 칸이면 Infinity.
  function lifeLeft(plot, now, gh){
    if (!plot || !plot.crop || plot.wilted) return 0;
    return ages(plot, gh) ? Math.max(0, lifeEnd(plot) - now) : Infinity;
  }
  function growTime(plot){
    const C = CROPS[plot.crop];
    let h = C.hours * H;
    if (plot.giant) h *= GIANT_TIME;
    return h;
  }
  function tickPlot(plot, now, gh){
    if (!plot || !plot.crop || plot.wilted) return;
    const old = ages(plot, gh);
    const until = old ? Math.min(now, lifeEnd(plot)) : now;   // 시든 뒤로는 자라지 않는다
    const from = plot.tick || plot.plantedAt || now;
    const wetUntil = gh && GH_ALWAYS_WET ? Infinity : (plot.wet || 0);
    const grew = Math.max(0, Math.min(until, wetUntil) - from);
    plot.progress = (plot.progress || 0) + grew * (plot.fert ? FERT_SPEED : 1);
    plot.tick = now;
    if (old && now >= lifeEnd(plot)) plot.wilted = true;
  }
  function stageOf(plot){
    if (!plot || !plot.crop) return -1;
    const r = (plot.progress || 0) / growTime(plot);
    if (plot.wilted) return 5;
    if (r >= 1) return 4;
    return Math.min(3, Math.floor(r * 4));
  }
  function wetNow(plot, now, gh){ return gh && GH_ALWAYS_WET ? true : (plot.wet || 0) > now; }
  /* 작물의 별. 물을 제때 준 만큼, 비료를 준 만큼 오른다.
     ★ 보통 · ★★ 잘 돌봤다(한 개 더) · ★★★ 반짝 작물(값이 두 배).
     싹은 촉촉할 때만 자라므로, 비가 대신 적셔 준 작물은 물 준 횟수가 모자라 ★ 하나에 그친다.
     온실은 늘 촉촉하니 값을 치른 셈 치고 물은 다 준 것으로 본다. */


  // ---------- 물건 ----------
  // 물건 이름은 종류:이름 꼴. seed:radish, crop:radish, f:bed1(가구), 그 밖에 낱개.
  const GOODS = {
    egg:     { name: '달걀',     sell: 30 },
    bigegg:  { name: '큰 달걀',  sell: 70 },
    milk:    { name: '우유',     sell: 60 },
    goldmilk:{ name: '금빛 우유', sell: 140 },
    wool:    { name: '양털',     sell: 110 },
    duckegg: { name: '오리알',   sell: 40 },
    downfeather:{ name: '오리 솜털', sell: 110 },
    truffle: { name: '송로버섯', sell: 170 },
    angora:  { name: '앙고라 털', sell: 85 },
    gem:     { name: '반짝돌',   sell: 300 },
    honey:   { name: '꿀',       sell: 90 },
    berry:   { name: '산딸기',   sell: 12, food: 3 },
    wood:    { name: '나무',     sell: 4 },
    stone:   { name: '돌',       sell: 3 },
    fert:    { name: '비료',     sell: 0 },
    snowball:{ name: '눈덩이',   sell: 0 },
    sprinkler:{ name: '스프링클러', sell: 0 },     // 팔지는 않는다 — 밭에 놓는 물건
    sprinkler2:{ name: '좋은 스프링클러', sell: 0 },
    firefly: { name: '반딧불이', sell: 45 },      // 여름·가을 밤에만 날아다닌다
    box:     { name: '수수께끼 보따리', sell: 0 },  // 행상인에게서만. 사면 그 자리에서 풀린다
    // 오로라 농장에서만 나는 것(2026-10-09)
    shard:   { name: '오로라 빛 조각', sell: 150 },  // 오로라 밤에만 땅에 떨어져 있다
    moss:    { name: '순록 이끼', sell: 35 },        // 순록이 가끔 물어 온다
    pinecone:{ name: '솔방울',   sell: 20 },
    // 사막 오아시스에서만 나는 것(2026-10-09)
    sandrose:{ name: '사막 장미 돌', sell: 150 },  // 사막 낮에만 모래 위에 놓여 있다
    date:    { name: '대추야자', sell: 30, food: 4 }, // 낙타가 가끔 물어 온다
    // 방주 농장(2026-10-09 로키즈 「노아의 방주」) — 역청 웅덩이에서 줍는 까만 덩어리. 방주 안팎에 칠한다(창세기 6:14)
    pitch:   { name: '역청 덩어리', sell: 40 },
    // 무지개 농장 — 비둘기가 물어 온 올리브(창세기 8:11). 낮 땅에 떨어진 것을 줍는다
    olive:   { name: '올리브', sell: 45, food: 4 },
    // 단풍 농장(캐나다 단풍 골짜기) — 수액 양동이에 고인 시럽을 낮에 줍고, 사슴·다람쥐가 밤과 도토리를 물어 온다
    syrup:   { name: '메이플 시럽', sell: 150, food: 6 },
    chestnut:{ name: '밤',       sell: 30, food: 4 },
    acorn:   { name: '도토리',   sell: 20 },
    // 밀림 농장(아마존) — 떨어진 망고를 줍고, 원숭이가 바나나를, 앵무새가 깃털을 준다
    mango:   { name: '망고',     sell: 50, food: 5 },
    banana:  { name: '바나나',   sell: 30, food: 4 },
    feather: { name: '앵무새 깃털', sell: 110 },
    // 사바나 농장(케냐) — 바오밥 나무 아래 떨어진 열매
    baobab:  { name: '바오밥 열매', sell: 45, food: 4 },
  };
  // 파는 값. 작물은 그날 시세가 붙는다.
  // 가게에서 파는 재료 — 값은 되파는 값(시세 1.3배까지)보다 넉넉히 높다
  const MATERIALS = { wood: { cost: 10 }, stone: { cost: 8 } };

  // ---------- 기운 ----------
  const ENERGY_BASE = 60;
  const COST = { till: 1, water: 1, harvest: 1, chop: 2, mine: 2, plant: 0, fert: 0, feed: 1, pet: 0, cook: 1, forage: 1, fish: 1 };
  /* 어제 한 일을 한 벌 남겨 둔다. 아침에 「어제는 이만큼 했어요」를 보여 주려는 것 —
     스타듀밸리가 잠들 때 보여 주는 하루 정산과 같은 자리인데, 여기는 잠드는 순간이 없으니
     다음에 들어온 아침에 보여 준다. 동전은 하루가 열릴 때와 닫힐 때를 재서 뺀다. */

  // ---------- 도구 ----------
  // 물뿌리개·괭이는 단계가 오르면 한 번에 여러 칸. 우물이 있어야 2단계부터 올릴 수 있다.
  const TOOLS = {
    can: { name: '물뿌리개', icon: '💧', levels: [{ n: 1, cost: 0 }, { n: 3, cost: 250 }, { n: 9, cost: 900, need: 'well' }] },
    hoe: { name: '괭이',     icon: '⛏️', levels: [{ n: 1, cost: 0 }, { n: 3, cost: 200 }, { n: 9, cost: 700 }] },
  };

  // ---------- 건물 (둘이서) ----------
  // 각자 제 몫을 낸다. 둘 다 내야 지어진다 — 한 명이 다 내는 건 안 된다.
  const BUILDINGS = {
    well:       { name: '우물',    icon: '🪣', each: { coins: 150, stone: 8 },            lv: 1, desc: '물뿌리개를 키울 수 있고, 기운이 3 늘어요.' },
    coop:       { name: '닭장',    icon: '🐔', each: { coins: 300, wood: 20 },            lv: 2, desc: '닭을 키울 수 있어요. 달걀은 아침마다.' },
    hive:       { name: '벌통',    icon: '🐝', each: { coins: 200, wood: 10 },            lv: 2, desc: '꽃이 피어 있으면 이틀에 한 번 꿀이 생겨요.' },
    scarecrow:  { name: '허수아비', icon: '🎃', each: { wood: 15 },                        lv: 2, desc: '가을 까마귀가 작물을 못 쪼아요.' },
    greenhouse: { name: '온실',    icon: '🏡', each: { coins: 600, wood: 40, stone: 20 },  lv: 4, desc: '안에서는 어느 계절 씨앗이든 자라고 물도 안 줘도 돼요.' },
    barn:       { name: '외양간',  icon: '🐄', each: { coins: 800, wood: 30, stone: 25 },  lv: 5, desc: '소와 양을 키울 수 있어요.' },
    pasture:    { name: '목장',    icon: '🐖', each: { coins: 250, wood: 25 },             lv: 3, desc: '울타리 친 풀밭이에요. 돼지와 토끼가 살고, 다른 가축도 낮에 나와서 놀아요.' },
    pethouse:   { name: '반려동물 집', icon: '🐕', each: { coins: 200, wood: 10 },          lv: 3, desc: '강아지와 고양이가 살아요. 밥을 주면 무언가 물어 와요.' },
    kitchen:    { name: '부엌',    icon: '🍳', each: { coins: 250, wood: 12 },            lv: 3, desc: '집 안에서 요리를 할 수 있어요.' },
  };

  // 농장 꾸미기 — 혼자 사도 된다. 다 짓고 나서도 동전을 쓸 데가 있어야 오래 간다.
  const DECOR = {
    path:     { name: '꽃길',     icon: '🌼', cost: 800,  lv: 3 },
    pond:     { name: '연못',     icon: '🦆', cost: 2000, lv: 5, desc: '오리 두 마리가 헤엄쳐요' },
    fountain: { name: '분수',     icon: '⛲', cost: 3500, lv: 7 },
    statue:   { name: '별 동상',  icon: '🌟', cost: 8000, lv: 9, desc: '농장의 자랑' },
    lantern:  { name: '등불',     icon: '🏮', cost: 400,  lv: 2, desc: '밤이 되면 둘레를 밝혀요' },
    bench:    { name: '나무 벤치', icon: '🪑', cost: 300,  lv: 2, desc: '앉아서 쉬는 자리' },
    swing:    { name: '그네',     icon: '🎠', cost: 1200, lv: 4, desc: '바람에 살랑살랑 흔들려요' },
    arch:     { name: '장미 아치', icon: '🌹', cost: 2500, lv: 6, desc: '들어오는 길에 꽃문' },
    sandbox:  { name: '모래놀이터', icon: '🏖️', cost: 900,  lv: 3, desc: '모래성을 쌓아 뒀어요' },
    firepit:  { name: '모닥불',     icon: '🔥', cost: 1800, lv: 6, desc: '밤이면 타닥타닥 타올라요' },
    sign:     { name: '농장 팻말',   icon: '🪧', cost: 200,  lv: 1, desc: '문 앞에 세우는 나무 팻말' },
    clothesline: { name: '빨랫줄',  icon: '👕', cost: 300,  lv: 2, desc: '빨래가 바람에 펄럭여요' },
    flowerbed: { name: '꽃밭',      icon: '🌷', cost: 350,  lv: 2, desc: '계절마다 다른 꽃이 피어요' },
    birdhouse: { name: '새집',      icon: '🐦', cost: 600,  lv: 3, desc: '작은 새가 놀러 와요' },
    flag:     { name: '깃발',       icon: '🚩', cost: 700,  lv: 4, desc: '바람 부는 날엔 힘차게 나부껴요' },
    wagon:    { name: '수레',       icon: '🛒', cost: 1000, lv: 4, desc: '가을엔 호박을 가득 실어요' },
    windmill: { name: '풍차',       icon: '🌀', cost: 3000, lv: 6, desc: '날개가 빙글빙글 돌아가요' },
    // 그 농장에서만 파는 꾸미개(2026-09-28 로키즈 「전부 진행」). farm 이 붙은 것은 그 농장에 살 때만 사고, 이사 조건에도 그때만 든다.
    lighthouse: { name: '등대',     icon: '🗼', cost: 2800, lv: 5, farm: 'seaside',  desc: '밤이면 불빛이 바다를 비춰요' },
    palm:     { name: '야자수',     icon: '🌴', cost: 600,  lv: 3, farm: 'seaside',  desc: '바닷바람에 잎이 살랑여요' },
    cairn:    { name: '흑요석 돌탑', icon: '🪨', cost: 500,  lv: 3, farm: 'mountain', desc: '돌마다 새긴 무늬가 불빛처럼 빛나요' },
    waterfall:{ name: '용암 폭포',  icon: '🌋', cost: 3200, lv: 6, farm: 'mountain', desc: '바위 틈에서 용암이 쏟아져요' },
    // 꽃구름 전용 꾸미개는 2026-10-07 「일본에서만 볼 법한 것」으로 바꿨다 — 아이디는 그대로(산 것·놓은 자리가 안 깨지게)
    balloon:  { name: '음료 자판기', icon: '🥤', cost: 4000, lv: 7, farm: 'cloud',    desc: '밤에도 환하게 불이 켜진 자판기 두 대' },
    skybridge:{ name: '붉은 북다리', icon: '🌉', cost: 3000, lv: 6, farm: 'cloud',    desc: '개울 위로 둥글게 솟은 붉은 다리' },
    // 농장마다 셋 더(2026-09-29 로키즈 「처음 농장과 확연히 다른 분위기」) — 그리스 바닷가·스위스 산골·일본 꽃구름
    anchor:   { name: '닻',         icon: '⚓', cost: 700,  lv: 3, farm: 'seaside',  desc: '밧줄을 감은 오래된 닻이에요' },
    boat:     { name: '고깃배',     icon: '🚣', cost: 1500, lv: 4, farm: 'seaside',  desc: '모래밭에 올려 둔 파란 나무배' },
    parasol:  { name: '파라솔',     icon: '⛱️', cost: 450,  lv: 2, farm: 'seaside',  desc: '줄무늬 그늘 아래 수건을 깔았어요' },
    woodpile: { name: '숯 장작더미', icon: '🪵', cost: 400,  lv: 2, farm: 'mountain', desc: '그을린 장작 사이로 불씨가 깜빡여요' },
    milkcans: { name: '불씨 항아리', icon: '🏺', cost: 550,  lv: 3, farm: 'mountain', desc: '꺼지지 않는 불씨를 담아 뒀어요' },
    alphorn:  { name: '용뿔 나팔',  icon: '📯', cost: 1600, lv: 5, farm: 'mountain', desc: '길게 불면 화산이 우르릉 대답해요' },
    shishi:   { name: '대나무 물통', icon: '🎋', cost: 1400, lv: 4, farm: 'cloud',    desc: '물이 차면 딸깍! 하고 돌을 두드려요' },
    koinobori:{ name: '잉어 깃발',  icon: '🎏', cost: 1100, lv: 4, farm: 'cloud',    desc: '바람을 먹고 잉어가 헤엄쳐요' },
    toro:     { name: '지장보살',   icon: '🙏', cost: 800,  lv: 3, farm: 'cloud',    desc: '빨간 턱받이 지장님 — 밤엔 촛불을 켜요' },
    // 오로라(스테이지2 첫 농장, 2026-10-09) — 그림은 pages/farm-hd.js
    igloo:    { name: '이글루',     icon: '🛖', cost: 3600, lv: 7, farm: 'aurora',   desc: '눈 벽돌로 쌓은 집 — 밤이면 안에서 불빛이 새요' },
    sled:     { name: '빨간 썰매',  icon: '🛷', cost: 1500, lv: 4, farm: 'aurora',   desc: '금빛 날이 둥글게 말린 썰매, 선물 상자를 실었어요' },
    icefish:  { name: '얼음낚시 구멍', icon: '🎣', cost: 900, lv: 3, farm: 'aurora', desc: '누르면 얼음낚시 — 북극곤들매기와 대구가 물어요' },
    // 오로라 넷 더(2026-10-09 로키즈 「오로라 농장만의 특색 있는 꾸미개」) — 북유럽 눈 섬
    sauna:    { name: '사우나 오두막', icon: '🧖', cost: 2600, lv: 6, farm: 'aurora', desc: '통나무 사우나 — 밤이면 굴뚝에서 김이 올라요' },
    lavvu:    { name: '사미 천막',   icon: '⛺', cost: 1800, lv: 5, farm: 'aurora', desc: '원뿔 천막 앞 모닥불과 통나무 의자' },
    icesculpt:{ name: '얼음 조각상', icon: '🦌', cost: 1200, lv: 4, farm: 'aurora', desc: '오로라 빛에 어른거리는 얼음 순록' },
    santapost:{ name: '산타 우체통', icon: '📮', cost: 700,  lv: 3, farm: 'aurora', desc: '빨간 우체통 — 가끔 산타 할아버지 편지가 와요' },
    // 사막 오아시스 넷(2026-10-09) — 모로코·사하라. 그림은 pages/farm-hd.js
    berber:   { name: '베르베르 천막', icon: '⛺', cost: 1800, lv: 5, farm: 'desert', desc: '줄무늬 천막 아래 양탄자와 방석, 놋 등' },
    zellige:  { name: '모자이크 분수', icon: '⛲', cost: 2400, lv: 6, farm: 'desert', desc: '파란 타일 별무늬 분수 — 밤엔 물빛이 반짝여요' },
    genielamp:{ name: '요술 램프',   icon: '🪔', cost: 700,  lv: 3, farm: 'desert', desc: '받침 위 금빛 램프 — 가끔 램프 요정 편지가 와요' },
    telescope:{ name: '별 망원경',   icon: '🔭', cost: 1200, lv: 4, farm: 'desert', desc: '사막의 밤하늘을 보는 놋쇠 망원경' },
    // 단풍 농장 넷(2026-10-09) — 캐나다 단풍 골짜기. 그림은 pages/farm-wild.js
    sugarshack:{ name: '시럽 오두막', icon: '🍁', cost: 2600, lv: 6, farm: 'maple', desc: '단풍나무 수액을 졸이는 오두막 — 굴뚝에서 달콤한 김이 올라요' },
    canoe:    { name: '빨간 카누',   icon: '🛶', cost: 1500, lv: 4, farm: 'maple',  desc: '호숫가에 엎어 둔 빨간 나무 카누' },
    leafpile: { name: '낙엽 더미',   icon: '🍂', cost: 600,  lv: 3, farm: 'maple',  desc: '폭신한 단풍잎 더미 — 뛰어들면 바스락' },
    jacklight:{ name: '호박 등불',   icon: '🎃', cost: 900,  lv: 3, farm: 'maple',  desc: '웃는 얼굴 호박 셋 — 밤이면 촛불이 켜져요' },
    // 밀림 농장 넷 — 아마존 밀림
    treehouse:{ name: '나무 위 오두막', icon: '🌳', cost: 3200, lv: 7, farm: 'jungle', desc: '큰 나무 위 오두막 — 줄사다리를 타고 올라가요' },
    ropebridge:{ name: '출렁다리',   icon: '🌉', cost: 1800, lv: 5, farm: 'jungle', desc: '덩굴로 엮은 흔들흔들 다리' },
    vinehammock:{ name: '밀림 해먹', icon: '🪢', cost: 700,  lv: 3, farm: 'jungle', desc: '나무 사이에 건 알록달록 줄무늬 해먹' },
    samba:    { name: '삼바 북',     icon: '🥁', cost: 900,  lv: 4, farm: 'jungle', desc: '알록달록 북 — 축제 날엔 둥둥 울려요' },
    // 사바나 농장 넷 — 케냐 초원
    waterhole:{ name: '물웅덩이',    icon: '💧', cost: 3000, lv: 6, farm: 'savanna', desc: '동물들이 목을 축이러 모이는 웅덩이' },
    safari:   { name: '사파리 지프', icon: '🚙', cost: 2400, lv: 6, farm: 'savanna', desc: '흙먼지를 뒤집어쓴 초록 지프' },
    manyatta: { name: '마사이 흙집', icon: '🛖', cost: 1800, lv: 5, farm: 'savanna', desc: '둥근 흙벽에 풀 지붕을 얹은 집' },
    lookout:  { name: '나무 망루',   icon: '🔭', cost: 1400, lv: 4, farm: 'savanna', desc: '올라가면 초원 끝까지 보여요' },
  };

  // ---------- 이사 ----------
  /* 꾸미개를 모두 놓으면 다음 농장으로 이사 갈 수 있다(2026-09-28). 둘 다 좋다고 해야 떠난다.
     꾸미개와 다 지은 건물은 옛 농장에 두고 가서 새 땅에서 둘이 다시 짓는다.
     동전·레벨·가방·동물·집 안 가구·밭·스프링클러는 가져간다. 짓던 건물은 짓던 채로 따라온다.
     부엌은 집 안에 있어 집과 함께 간다. 동물은 새 우리가 생길 때까지 빈 터 둘레에서 논다.
     풍경(땅 빛깔·가장자리)은 farm.js 의 FARM_LOOK 이 농장마다 바꾼다. */
  const FARMS = [
    { id: 'meadow',   name: '들판 농장',   icon: '🌾', desc: '처음 연 농장이에요' },
    { id: 'seaside',  name: '바닷가 농장', icon: '🌊', desc: '모래밭 너머로 파도가 쳐요',        room: 12, animals: 10, grid: { w: 22, h: 18 }, peddler: { x: 15, y: 12 }, perk: { id: 'fish', icon: '🐟', text: '어시장 — 물고기를 1.25배에 팔아요' } },
    // skip — 2026-10-09 로키즈 「화산농장은 아이들이 싫어할 것 같아 스킵」. 바닷가에서 바로 꽃구름으로 간다.
    // 줄은 지우지 않는다: world.farm 이 이 표의 번호라서, 빼면 뒤 농장 번호와 도장 조건이 다 밀린다. 그림·?farm=mountain 구경은 남는다
    { id: 'mountain', name: '화산 농장',   icon: '🌋', desc: '용암이 흐르고 재가 날리는 메마른 땅이에요', skip: true, room: 16, animals: 14, grid: { w: 24, h: 18 }, peddler: { x: 16, y: 16 } },
    { id: 'cloud',    name: '꽃구름 농장', icon: '☁️', desc: '벚꽃 흩날리는 구름 위 일본 마을, 신칸센이 지나가요', room: 16, animals: 14, grid: { w: 24, h: 20 }, peddler: { x: 15, y: 13 }, perk: { id: 'dish', icon: '🍱', text: '도시락 가게 — 요리를 1.25배에 팔아요' } },
    // 스테이지2 — 여기서부터 고화소 그림(pages/farm-hd.js). 2026-10-08 로키즈 「오로라부터 고화소로 전부 다시」
    { id: 'aurora',   name: '오로라 농장', icon: '🌌', desc: '오로라가 춤추는 북쪽 눈 섬, 통나무집에 불이 켜져요', room: 22, animals: 17, grid: { w: 26, h: 20 }, peddler: { x: 15, y: 13 }, stage: 2, perk: { id: 'shard', icon: '✨', text: '긴 밤 — 빛 조각이 밤마다 두 배로 떨어져요' } },
    /* 2026-10-09 로키즈 「오로라와 사막 사이에 농장 셋 — 단풍·밀림·사바나」. 눈 섬에서 남쪽으로 내려가며 점점 따뜻해지다 사막에 닿는다.
       끼워 넣느라 사막·방주·무지개 농장 번호가 셋씩 밀렸다 — 옛 세이브는 fixWorld 가 옮긴다(FARM_V) */
    { id: 'maple',    name: '단풍 농장',   icon: '🍁', desc: '빨갛게 물든 단풍 골짜기, 통나무 오두막에서 메이플 시럽 냄새가 나요', room: 22, animals: 17, grid: { w: 26, h: 20 }, peddler: { x: 15, y: 13 }, stage: 2, perk: { id: 'harvest', icon: '🧺', text: '풍년 — 작물을 거둘 때 넷에 하나꼴로 하나 더 나와요' } },
    { id: 'jungle',   name: '밀림 농장',   icon: '🦜', desc: '폭포가 쏟아지는 열대 밀림, 덩굴 아래 나무 위 오두막', room: 23, animals: 18, grid: { w: 27, h: 20 }, peddler: { x: 15, y: 13 }, stage: 2, perk: { id: 'squall', icon: '🌦️', text: '스콜 — 날마다 소나기가 밭을 적셔 줘요' } },
    { id: 'savanna',  name: '사바나 농장', icon: '🦒', desc: '노을 지는 너른 초원, 바오밥 나무 아래 기린이 고개를 내밀어요', room: 23, animals: 18, grid: { w: 28, h: 20 }, peddler: { x: 15, y: 13 }, stage: 2, perk: { id: 'herd', icon: '💗', text: '물웅덩이 — 둘이 쓰다듬으면 동물 마음이 두 칸씩 자라요' } },
    // 2026-10-09 로키즈 시안 ① — 오로라보다 조금 높게(가구 24 · 동물 18 = 우리를 다 채운 수, 아기 낙타 자리 포함)
    { id: 'desert',   name: '오아시스 농장', icon: '🐪', desc: '모래 언덕 너머 대추야자 오아시스, 밤엔 은하수가 흘러요', room: 24, animals: 18, grid: { w: 28, h: 20 }, peddler: { x: 15, y: 13 }, stage: 2, perk: { id: 'water', icon: '💧', text: '오아시스 샘 — 물을 한 번 주면 30시간 촉촉해요' } },
    /* 메인 목표 「수아연아의 방주」(2026-10-09 로키즈) — 방주를 짓는 마지막 농장. 땅이 훨씬 넓고(40×30) 한가운데 방주 터가 있다.
       pens 3 — 우리마다 세 배로 들어간다(동물 스무 가지를 한 쌍씩 다 모으려면 자리가 모자라서. 단풍·밀림·사바나가 들며 둘 → 셋). 떠날 때는 이사가 아니라 대홍수(ARK_*)로 간다.
       동물 조건은 앞 농장 우리를 다 채운 수(18)를 넘으면 못 떠나므로 18 그대로 */
    { id: 'ark',      name: '방주 농장',   icon: '🛶', desc: '먹구름이 몰려오는 너른 들판 — 한가운데 커다란 방주를 짓는 터가 있어요', room: 26, animals: 18, grid: { w: 40, h: 30 }, peddler: { x: 26, y: 20 }, stage: 2, pens: 3,
      perk: { id: 'mate', icon: '💞', text: '짝꿍이 찾아와요 — 혼자인 동물에게 짝이 스스로 찾아와요(창세기 7:9)' } },
    // via — 이사로는 못 가고 대홍수를 건너야 닿는다(nextFarmIndex 가 건너뛴다). 진짜 마지막 농장
    { id: 'newland',  name: '무지개 농장', icon: '🌈', desc: '물이 빠진 새 땅 — 아라랏 산 위에 방주가 쉬고, 하늘엔 약속의 무지개가 떠요', room: 26, animals: 18, grid: { w: 40, h: 30 }, peddler: { x: 21, y: 17 }, stage: 2, pens: 3, via: 'flood',
      perk: { id: 'bloom', icon: '🐣', text: '생육하고 번성하라 — 동물이 새끼를 두 배 자주 봐요(창세기 9:1)' } },
  ];
  /* 새 농장일수록 섬이 넓다(2026-09-29 로키즈 「새 농장은 전체 크기를 더 크게」) — 들판 20×16 → 22×18 → 24×18 → 24×20.
     늘어난 땅은 오른쪽(x 20~)과 아래(y 16~), 곧 섬의 앞쪽 두 가장자리다. 집·가게·밭·나무 자리는 그대로라 좌표가 안 바뀐다. */
  /* 꾸미개만 사서 이사를 서두르지 않게 방 가구와 동물 수도 본다(2026-09-28 로키즈 요청).
     room 은 수아 방·연아 방·거실 「각각」에 놓인 가구 수 — 한 아이 방만 채우고 떠나지 않게.
     가구와 동물은 이사 때 가져가니 갈수록 조금씩 높다. 동물은 우리를 다 채우면 18마리까지 산다. */
  const MOVE_KEEP = { kitchen: true };
  const FARM_V = 2;                      // 농장 표 차례 — 2: 단풍·밀림·사바나가 끼어든 뒤(fixWorld 가 옛 번호를 옮긴다)
  /* 이사 갈 까닭(2026-10-09 로키즈 「전부 진행」)
     perk — 농장마다 하나뿐인 능력(FARMS 줄). 그 농장에 사는 동안만 든다. 들판은 없다(처음 농장).
     SPECIALS — 그 농장에서만 나는 것. 다른 농장에 살 때 팔면 TRADE_MULT 배, 다 모으면 도감 훈장,
       떠난 뒤에는 옛 농장 구경 때 하루 한 번 몇 개 받아 온다(pastGift). 들판은 전용 물건이 없어 동전을 받는다.
       2026-10-09 로키즈 「다음 농장으로 이주하는 조건에 그 농장에서만 얻는 것을 갖추었는지」 — localOf·moveState. */
  const SPECIALS = {
    seaside: ['fish:mackerel', 'fish:squid', 'fish:flounder', 'fish:seabream', 'crop:fig'],
    cloud: ['crop:tea'],
    aurora: ['crop:cloudberry', 'shard', 'moss', 'pinecone', 'fish:cod', 'fish:char'],
    maple: ['crop:cranberry', 'syrup', 'chestnut', 'acorn'],
    jungle: ['crop:cacao', 'mango', 'banana', 'feather'],
    savanna: ['crop:kiwano', 'baobab'],
    desert: ['crop:dragonfruit', 'date', 'sandrose'],
    ark: ['pitch'],
    newland: ['olive'],
  };
  const TRADE_MULT = 1.5, PAST_COINS = 120;
  const perkOf = world => (farmOf(world).perk || {}).id || null;
  // 물건이 난 농장 — 반짝·큰 작물도 그 작물의 농장
  function originOf(id){ const b = String(id).replace(/^(gold|giant):/, 'crop:'); return Object.keys(SPECIALS).find(f => SPECIALS[f].indexOf(b) >= 0) || null; }
  // 도감에 적히는 이름 — 작물은 앞머리 없이
  const dexId = id => id.slice(0, 5) === 'crop:' ? id.slice(5) : id;
  /* 농장 손님 — 그 농장에만 오는 손님이 사흘마다 하나씩 부탁한다(world.quest). 건네면 동전과 그 농장 가구.
     want 가운데 날짜 주사위로 하나. 들판은 손님이 없다. */
  const GUESTS = {
    seaside: { name: '뱃사람 할아버지', icon: '⚓', want: [['fish:mackerel', 3], ['fish:flounder', 2], ['fish:squid', 2], ['egg', 6]] },
    cloud:   { name: '떠돌이 화가',     icon: '🎨', want: [['honey', 2], ['milk', 3], ['egg', 6], ['berry', 8]] },
    aurora:  { name: '순록 썰매꾼 아이노', icon: '🛷', want: [['crop:cloudberry', 4], ['moss', 3], ['pinecone', 4], ['fish:cod', 2]] },
    desert:  { name: '대상 상인 하산',   icon: '🐫', want: [['crop:dragonfruit', 4], ['date', 6], ['sandrose', 2], ['milk', 3]] },
    maple:   { name: '나무꾼 아저씨 조', icon: '🪓', want: [['crop:cranberry', 4], ['syrup', 2], ['chestnut', 4], ['wood', 20]] },
    jungle:  { name: '탐험가 마리아',   icon: '🧭', want: [['crop:cacao', 4], ['mango', 3], ['banana', 5], ['feather', 2]] },
    savanna: { name: '사파리 안내인 바라카', icon: '🦓', want: [['crop:kiwano', 2], ['baobab', 4], ['milk', 3], ['wood', 15]] },
  };
  const QUEST_DAYS = 3, QUEST_MULT = 2;      // 사흘마다 새 부탁 · 동전은 파는 값의 두 배
  // 새 농장(아이소 화면)을 다 그릴 때까지 조건과 알림만 보이고 떠나지는 못했다. 2026-09-28 아이소 섬을 그려 열었다.
  const MOVE_OPEN = true;
  const MOVE_GIFT = 2000;                 // 이삿날 두 아이에게 우편으로 가는 동전
  function farmIndex(world){ return Math.max(0, Math.min(FARMS.length - 1, Math.floor(Number(world && world.farm) || 0))); }
  function farmOf(world){ return FARMS[farmIndex(world)]; }
  // 다음 이사 갈 농장 번호 — 건너뛰는 농장(skip)은 지나친다. 없으면 -1
  function nextFarmIndex(world){ let i = farmIndex(world) + 1; while (FARMS[i] && FARMS[i].skip) i++; return FARMS[i] && !FARMS[i].via ? i : -1; }
  // 이번 이사로 지나가는 농장들(건너뛴 것 + 도착할 곳) — 건너뛴 농장의 아기 동물도 함께 따라온다
  function movePath(world){ const n = nextFarmIndex(world); return n < 0 ? [] : FARMS.slice(farmIndex(world) + 1, n + 1); }
  // 대문 문패 「N호점」 — 건너뛴 농장은 세지 않는다
  function farmNo(i){ return FARMS.slice(0, i + 1).filter(f => !f.skip).length; }
  function gridOf(world){ return farmOf(world).grid || GRID; }

  // ---------- 농장 배치 ----------
  // 지도는 20×12 칸. 밭은 늘 가운데(6..15, 2..7)에 있고, 나머지는 아이들이 옮길 수 있다.
  // 자리는 world.layout 에만 적는다 — 표(PLACE)의 x,y 는 아무도 옮기지 않았을 때의 처음 자리다.
  const GRID = { w: 20, h: 16 };
  // kind: 'always' 늘 있는 것 · 'build' 지어야 생기는 것 · 'decor' 사야 생기는 것.
  const PLACE = {
    house:      { name: '집',       w: 4, h: 3, x: 0,  y: 0,  kind: 'always', move: false },
    stall:      { name: '가게',     w: 3, h: 2, x: 16, y: 0,  kind: 'always', move: false },
    mail:       { name: '우편함',   w: 1, h: 1, x: 4,  y: 1,  kind: 'always', move: true },
    board:      { name: '게시판',   w: 1, h: 1, x: 5,  y: 0,  kind: 'always', move: true },
    coop:       { name: '닭장',     w: 2, h: 2, x: 0,  y: 3,  kind: 'build',  move: true },
    pethouse:   { name: '반려동물 집', w: 1, h: 1, x: 3, y: 3, kind: 'build', move: true },
    well:       { name: '우물',     w: 1, h: 1, x: 5,  y: 3,  kind: 'build',  move: true },
    hive:       { name: '벌통',     w: 1, h: 1, x: 4,  y: 4,  kind: 'build',  move: true },
    greenhouse: { name: '온실',     w: 4, h: 3, x: 0,  y: 6,  kind: 'build',  move: true },
    barn:       { name: '외양간',   w: 3, h: 3, x: 16, y: 3,  kind: 'build',  move: true },
    scarecrow:  { name: '허수아비', w: 1, h: 1, x: 6,  y: 8,  kind: 'build',  move: true },
    pasture:    { name: '목장',     w: 6, h: 5, x: 13, y: 10, kind: 'build',  move: true },
    fountain:   { name: '분수',     w: 2, h: 2, x: 8,  y: 0,  kind: 'decor',  move: true },
    statue:     { name: '별 동상',  w: 1, h: 2, x: 11, y: 0,  kind: 'decor',  move: true },
    pond:       { name: '연못',     w: 4, h: 3, x: 0,  y: 12, kind: 'decor',  move: true },   // 2×2 는 오리 두 마리가 헤엄치기엔 좁았다. 맨 아랫줄은 앞 수풀에 가려 한 줄 올렸다
    path:       { name: '꽃길',     w: 8, h: 1, x: 8,  y: 8,  kind: 'decor',  move: true },
    lantern:    { name: '등불',     w: 1, h: 1, x: 16, y: 7,  kind: 'decor',  move: true },
    bench:      { name: '나무 벤치', w: 2, h: 1, x: 8, y: 15, kind: 'decor',  move: true },
    swing:      { name: '그네',     w: 2, h: 2, x: 4,  y: 14, kind: 'decor',  move: true },
    arch:       { name: '장미 아치', w: 2, h: 1, x: 18, y: 7, kind: 'decor',  move: true },
    sandbox:    { name: '모래놀이터', w: 2, h: 2, x: 13, y: 0, kind: 'decor',  move: true },   // (0,10) 은 나무(1,10)를 덮었다 — 점검이 잡음. 아랫줄은 앞 수풀에 가려 위 빈터로
    firepit:    { name: '모닥불',   w: 1, h: 1, x: 11, y: 13, kind: 'decor',  move: true },
    sign:       { name: '농장 팻말', w: 1, h: 1, x: 6,  y: 0,  kind: 'decor',  move: true },
    clothesline:{ name: '빨랫줄',   w: 2, h: 1, x: 8,  y: 14, kind: 'decor',  move: true },   // 연못이 커지며 처음 자리를 비켜 줬다
    flowerbed:  { name: '꽃밭',     w: 2, h: 1, x: 10, y: 9,  kind: 'decor',  move: true },
    birdhouse:  { name: '새집',     w: 1, h: 1, x: 12, y: 0,  kind: 'decor',  move: true },
    flag:       { name: '깃발',     w: 1, h: 1, x: 19, y: 0,  kind: 'decor',  move: true },
    wagon:      { name: '수레',     w: 2, h: 1, x: 6,  y: 15, kind: 'decor',  move: true },   // 연못이 4×3 이 되며 처음 자리를 비켜 줬다
    windmill:   { name: '풍차',     w: 2, h: 2, x: 16, y: 8,  kind: 'decor',  move: true },
    lighthouse: { name: '등대',     w: 1, h: 1, x: 19, y: 6,  kind: 'decor',  move: true },
    palm:       { name: '야자수',   w: 1, h: 1, x: 19, y: 12, kind: 'decor',  move: true },
    cairn:      { name: '돌탑',     w: 1, h: 1, x: 12, y: 12, kind: 'decor',  move: true },
    waterfall:  { name: '작은 폭포', w: 2, h: 2, x: 11, y: 14, kind: 'decor',  move: true },
    balloon:    { name: '음료 자판기', w: 2, h: 2, x: 13, y: 0,  kind: 'decor',  move: true },
    skybridge:  { name: '붉은 북다리', w: 2, h: 1, x: 16, y: 15, kind: 'decor',  move: true },
    anchor:     { name: '닻',       w: 1, h: 1, x: 4,  y: 12, kind: 'decor',  move: true },
    boat:       { name: '고깃배',   w: 2, h: 1, x: 9, y: 16, kind: 'decor',  move: true },
    parasol:    { name: '파라솔',   w: 1, h: 1, x: 14, y: 12, kind: 'decor',  move: true },
    woodpile:   { name: '장작더미', w: 2, h: 1, x: 1,  y: 7,  kind: 'decor',  move: true },
    milkcans:   { name: '우유통',   w: 1, h: 1, x: 23, y: 6,  kind: 'decor',  move: true },
    alphorn:    { name: '알프호른', w: 2, h: 1, x: 6,  y: 8, kind: 'decor',  move: true },
    shishi:     { name: '대나무 물통', w: 1, h: 1, x: 1, y: 9,  kind: 'decor',  move: true },
    koinobori:  { name: '잉어 깃발', w: 1, h: 1, x: 2, y: 9,  kind: 'decor',  move: true },
    toro:       { name: '지장보살', w: 1, h: 1, x: 5,  y: 15, kind: 'decor',  move: true },
    igloo:      { name: '이글루',   w: 2, h: 2, x: 21, y: 7,  kind: 'decor',  move: true },
    sled:       { name: '빨간 썰매', w: 2, h: 1, x: 22, y: 19, kind: 'decor',  move: true },
    icefish:    { name: '얼음낚시 구멍', w: 1, h: 1, x: 5, y: 15, kind: 'decor', move: true },
    sauna:      { name: '사우나 오두막', w: 2, h: 2, x: 23, y: 12, kind: 'decor', move: true },
    lavvu:      { name: '사미 천막', w: 2, h: 2, x: 12, y: 17, kind: 'decor', move: true },
    icesculpt:  { name: '얼음 조각상', w: 1, h: 1, x: 22, y: 9, kind: 'decor', move: true },
    santapost:  { name: '산타 우체통', w: 1, h: 1, x: 6, y: 0, kind: 'decor', move: true },
    berber:     { name: '베르베르 천막', w: 3, h: 2, x: 12, y: 17, kind: 'decor', move: true },
    zellige:    { name: '모자이크 분수', w: 2, h: 2, x: 24, y: 9, kind: 'decor', move: true },
    genielamp:  { name: '요술 램프', w: 1, h: 1, x: 6, y: 0, kind: 'decor', move: true },
    telescope:  { name: '별 망원경', w: 1, h: 1, x: 22, y: 9, kind: 'decor', move: true },
    // 단풍·밀림·사바나 꾸미개(2026-10-09)
    sugarshack: { name: '시럽 오두막', w: 2, h: 2, x: 21, y: 7, kind: 'decor', move: true },
    canoe:      { name: '빨간 카누', w: 2, h: 1, x: 2, y: 17, kind: 'decor', move: true },
    leafpile:   { name: '낙엽 더미', w: 1, h: 1, x: 22, y: 9, kind: 'decor', move: true },
    jacklight:  { name: '호박 등불', w: 1, h: 1, x: 6, y: 0, kind: 'decor', move: true },
    treehouse:  { name: '나무 위 오두막', w: 2, h: 2, x: 23, y: 12, kind: 'decor', move: true },
    ropebridge: { name: '출렁다리', w: 2, h: 1, x: 22, y: 19, kind: 'decor', move: true },
    vinehammock:{ name: '밀림 해먹', w: 2, h: 1, x: 12, y: 17, kind: 'decor', move: true },
    samba:      { name: '삼바 북', w: 1, h: 1, x: 6, y: 0, kind: 'decor', move: true },
    waterhole:  { name: '물웅덩이', w: 2, h: 2, x: 24, y: 9, kind: 'decor', move: true },
    safari:     { name: '사파리 지프', w: 2, h: 1, x: 22, y: 19, kind: 'decor', move: true },
    manyatta:   { name: '마사이 흙집', w: 2, h: 2, x: 12, y: 17, kind: 'decor', move: true },
    lookout:    { name: '나무 망루', w: 1, h: 1, x: 26, y: 12, kind: 'decor', move: true },
    // 방주 터(2026-10-09) — 방주 농장 한가운데. 옮길 수 없다. 그림은 pages/farm-ark.js 가 짓는 단계(world.ark.step)대로
    ark:        { name: '방주',     w: 18, h: 7, x: 11, y: 11, kind: 'ark',  move: false },
    // 무지개 농장에서 둘이 차례로 짓는 것(LAND_STEPS). 다 지은 것만 선다
    altar:      { name: '감사의 제단', w: 2, h: 2, x: 20, y: 4,  kind: 'land', move: true },
    rainbowhill:{ name: '무지개 언덕', w: 4, h: 3, x: 26, y: 6,  kind: 'land', move: true },
    vineyard:   { name: '첫 포도원',   w: 5, h: 3, x: 8,  y: 15, kind: 'land', move: true },
    dovecote:   { name: '비둘기 집',   w: 2, h: 2, x: 24, y: 16, kind: 'land', move: true },
    olivegrove: { name: '올리브 동산', w: 4, h: 3, x: 30, y: 18, kind: 'land', move: true },
    wellsquare: { name: '새 마을 우물 광장', w: 4, h: 4, x: 18, y: 12, kind: 'land', move: true },
  };
  const PLACE_IDS = Object.keys(PLACE);
  /* 새 농장은 처음 자리부터 다르다(2026-09-28 로키즈 「이전 농장과 완전히 다른 느낌」). 여기 없는 것은 PLACE 의 자리.
     집·가게·밭·나무와 바위(NODES)는 그대로라 길찾기와 저장은 안 바뀐다. 겹침은 tools/check-move.js 가 본다.
     바닷가: 목장은 넓어진 오른쪽 앞, 앞 가장자리에 널빤지 길, 오른쪽 끝 바다 모서리에 등대 · 산골: 집 앞은 낮은 연못, 목장은 밭 앞 비탈, 온실과 폭포는 넓어진 오른쪽 앞 · 꽃구름: 연못은 외양간 곁 오른쪽 끝, 꽃길이 밭 앞을 가로지르고 목장은 오른쪽 앞 끝
     집 바로 앞(0..5, 3..5)에 키 큰 건물을 두면 문 앞 아이들을 가린다 — 낮은 것만 둘 것.
     줄 끝에 붙은 앞 농장 전용 꾸미개 자리는 이사 때 「추억」으로 들고 왔을 때 서는 곳(2026-09-30). */
  const FARM_SPOT = {
    seaside: { mail: [4, 1], board: [5, 0], birdhouse: [7, 0], statue: [14, 0], lighthouse: [21, 0], sign: [5, 2], greenhouse: [17, 2], coop: [0, 3], pethouse: [3, 3], well: [1, 5], clothesline: [2, 5], hive: [4, 5], scarecrow: [16, 5], barn: [18, 5], flowerbed: [6, 8], flag: [21, 8], swing: [3, 9], fountain: [9, 9], lantern: [13, 9], windmill: [17, 10], arch: [7, 11], sandbox: [12, 11], pond: [5, 13], pasture: [16, 13], bench: [3, 16], firepit: [8, 16], wagon: [3, 17], path: [7, 17], palm: [15, 17], anchor: [4, 12], boat: [9, 16], parasol: [14, 12] },
    mountain: { mail: [4, 1], board: [5, 0], sign: [6, 1], birdhouse: [8, 0], windmill: [12, 0], flag: [23, 0], pethouse: [16, 2], coop: [18, 2], barn: [20, 4], statue: [20, 7], scarecrow: [16, 5], well: [1, 3], hive: [3, 4], greenhouse: [16, 11], pasture: [9, 12], pond: [19, 14], waterfall: [22, 12], cairn: [23, 17], path: [6, 17], fountain: [9, 9], lantern: [11, 9], bench: [4, 16], swing: [6, 12], arch: [12, 10], sandbox: [17, 9], firepit: [7, 15], clothesline: [2, 6], flowerbed: [6, 7], wagon: [14, 17], woodpile: [1, 7], milkcans: [23, 6], alphorn: [6, 8],
      lighthouse: [10, 0], palm: [14, 0], anchor: [23, 2], boat: [4, 15], parasol: [18, 5] },
    cloud: { mail: [4, 1], board: [5, 0], flag: [7, 0], statue: [12, 0], birdhouse: [20, 0], sign: [5, 2], coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], scarecrow: [16, 6], barn: [16, 7], greenhouse: [20, 2], fountain: [10, 7], balloon: [21, 7], lantern: [15, 10], flowerbed: [17, 10], path: [6, 11], windmill: [21, 11], swing: [0, 11], pond: [1, 14], arch: [2, 13], sandbox: [12, 14], bench: [7, 16], pasture: [16, 14], firepit: [9, 18], clothesline: [0, 19], wagon: [4, 19], skybridge: [22, 19], shishi: [1, 9], koinobori: [2, 9], toro: [5, 15],
      lighthouse: [22, 0], palm: [0, 7], cairn: [11, 18], waterfall: [4, 17], anchor: [14, 17], boat: [18, 6], parasol: [23, 0], woodpile: [2, 11], milkcans: [23, 8], alphorn: [22, 5] },
    // 오로라 — 꽃구름 자리를 바탕으로, 밭 아래 끝이 가운데로 내려와 분수는 넓어진 오른쪽 끝으로
    aurora: { mail: [4, 1], board: [5, 0], flag: [24, 3], statue: [19, 4], birdhouse: [20, 0], sign: [5, 2], coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], scarecrow: [16, 6], barn: [16, 7], greenhouse: [20, 2], fountain: [24, 9], igloo: [21, 7], lantern: [15, 10], flowerbed: [17, 10], path: [6, 11], windmill: [21, 11], swing: [0, 11], pond: [1, 14], arch: [2, 13], sandbox: [12, 14], bench: [7, 16], pasture: [16, 14], firepit: [9, 18], clothesline: [0, 19], wagon: [4, 19], sled: [22, 19], icefish: [5, 15],
      sauna: [23, 12], lavvu: [12, 17], icesculpt: [22, 9], santapost: [6, 0],   // 사우나는 오른쪽 숲가, 천막은 앞 가운데, 조각상은 이글루 앞, 우체통은 우편함 곁
      lighthouse: [22, 0], palm: [0, 7], cairn: [11, 18], waterfall: [4, 17], anchor: [14, 17], boat: [18, 6], parasol: [23, 0], woodpile: [2, 11], milkcans: [23, 8], alphorn: [22, 5],
      shishi: [1, 9], koinobori: [2, 9], toro: [24, 2], balloon: [24, 4], skybridge: [24, 17] },
    // 사막 — 오로라 자리를 바탕으로, 연못(오아시스)은 집 앞 가운데로 오고 넓어진 오른쪽 끝(26~27)에 분수·망원경
    desert: { mail: [4, 1], board: [5, 0], flag: [26, 3], statue: [19, 4], birdhouse: [20, 0], sign: [5, 2], coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], scarecrow: [16, 6], barn: [16, 7], greenhouse: [20, 2], fountain: [24, 9], lantern: [15, 10], flowerbed: [17, 10], path: [6, 11], windmill: [21, 11], swing: [0, 11], pond: [1, 14], arch: [2, 13], sandbox: [12, 14], bench: [7, 16], pasture: [16, 14], firepit: [9, 18], clothesline: [0, 19], wagon: [4, 19],
      berber: [12, 17], zellige: [26, 6], genielamp: [6, 0], telescope: [26, 12],   // 천막은 앞 가운데, 분수·망원경은 넓어진 오른쪽 끝, 램프는 우편함 곁
      igloo: [21, 7], sled: [22, 19], icefish: [5, 15], sauna: [23, 12], lavvu: [26, 16], icesculpt: [22, 9], santapost: [7, 0],
      lighthouse: [22, 0], palm: [0, 7], cairn: [11, 18], waterfall: [4, 17], anchor: [23, 18], boat: [18, 6], parasol: [23, 0], woodpile: [2, 11], milkcans: [23, 8], alphorn: [22, 5],
      shishi: [1, 9], koinobori: [2, 9], toro: [24, 2], balloon: [24, 4], skybridge: [24, 17],
      sugarshack: [8, 0], leafpile: [4, 0], jacklight: [10, 0], treehouse: [11, 0], ropebridge: [13, 0], vinehammock: [26, 0], samba: [15, 0], waterhole: [26, 4], safari: [0, 3], manyatta: [26, 10], lookout: [19, 0] },   // 끝줄은 단풍·밀림·사바나 추억(2026-10-09)
    // 단풍·밀림·사바나(2026-10-09) — 오로라·사막 자리를 바탕으로. 앞 농장에서 추억으로 들고 온 꾸미개 자리는 빈 가장자리에(겹침은 tools/check-move.js)
    maple: { mail: [4, 1], board: [5, 0], flag: [24, 3], statue: [19, 4], birdhouse: [20, 0], sign: [5, 2], coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], scarecrow: [16, 6], barn: [16, 7], greenhouse: [20, 2], fountain: [24, 9], lantern: [15, 10], flowerbed: [17, 10], path: [6, 11], windmill: [21, 11], swing: [0, 11], pond: [1, 14], arch: [2, 13], sandbox: [12, 14], bench: [7, 16], pasture: [16, 14], firepit: [9, 18], clothesline: [0, 19], wagon: [4, 19],
      sugarshack: [21, 7], canoe: [22, 19], leafpile: [22, 9], jacklight: [6, 0],   // 오두막은 오른쪽 숲가, 카누는 앞 물가, 낙엽은 오두막 앞, 호박 등불은 우편함 곁
      icefish: [5, 15], sauna: [23, 12], lavvu: [12, 17],
      lighthouse: [22, 0], palm: [0, 7], cairn: [11, 18], waterfall: [4, 17], anchor: [14, 17], boat: [18, 6], parasol: [23, 0], woodpile: [2, 11], milkcans: [23, 8], alphorn: [22, 5], shishi: [1, 9], koinobori: [2, 9], toro: [24, 2], balloon: [24, 4], skybridge: [24, 17],
      igloo: [7, 0], sled: [9, 0], icesculpt: [4, 0], santapost: [11, 0] },
    jungle: { mail: [4, 1], board: [5, 0], flag: [24, 3], statue: [19, 4], birdhouse: [20, 0], sign: [5, 2], coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], scarecrow: [16, 6], barn: [16, 7], greenhouse: [20, 2], fountain: [24, 9], lantern: [15, 10], flowerbed: [17, 10], path: [6, 11], windmill: [21, 11], swing: [0, 11], pond: [1, 14], arch: [2, 13], sandbox: [12, 14], bench: [7, 16], pasture: [16, 14], firepit: [9, 18], clothesline: [0, 19], wagon: [4, 19],
      treehouse: [21, 7], ropebridge: [22, 19], vinehammock: [12, 17], samba: [6, 0],   // 오두막은 오른쪽 숲가, 출렁다리는 앞 끝, 해먹은 앞 가운데, 북은 우편함 곁
      icefish: [5, 15], sauna: [23, 12],
      lighthouse: [22, 0], palm: [0, 7], cairn: [11, 18], waterfall: [4, 17], anchor: [14, 17], boat: [18, 6], parasol: [23, 0], woodpile: [2, 11], milkcans: [23, 8], alphorn: [22, 5], shishi: [1, 9], koinobori: [2, 9], toro: [24, 2], balloon: [24, 4], skybridge: [24, 17],
      igloo: [7, 0], sled: [9, 0], lavvu: [11, 0], santapost: [4, 0], sugarshack: [13, 0], leafpile: [15, 0], jacklight: [19, 0], canoe: [25, 1] },
    savanna: { mail: [4, 1], board: [5, 0], flag: [26, 3], statue: [19, 4], birdhouse: [20, 0], sign: [5, 2], coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], scarecrow: [16, 6], barn: [16, 7], greenhouse: [20, 2], fountain: [24, 9], lantern: [15, 10], flowerbed: [17, 10], path: [6, 11], windmill: [21, 11], swing: [0, 11], pond: [1, 14], arch: [2, 13], sandbox: [12, 14], bench: [7, 16], pasture: [16, 14], firepit: [9, 18], clothesline: [0, 19], wagon: [4, 19],
      waterhole: [21, 7], safari: [24, 18], manyatta: [12, 17], lookout: [26, 12],   // 웅덩이는 오른쪽 숲가, 지프는 앞 끝, 흙집은 앞 가운데, 망루는 넓어진 오른쪽 끝
      sled: [22, 19], icefish: [5, 15], sauna: [23, 12], lavvu: [26, 16], icesculpt: [22, 9],
      lighthouse: [22, 0], palm: [0, 7], cairn: [11, 18], waterfall: [4, 17], boat: [18, 6], parasol: [23, 0], woodpile: [2, 11], milkcans: [23, 8], alphorn: [22, 5],
      shishi: [1, 9], koinobori: [2, 9], toro: [24, 2], balloon: [24, 4], skybridge: [24, 17],
      igloo: [6, 0], santapost: [4, 0], sugarshack: [8, 0], leafpile: [10, 0], jacklight: [11, 0], treehouse: [12, 0], ropebridge: [14, 0], vinehammock: [26, 0], samba: [19, 0] },
    /* 방주 농장(40×30) — 가운데(11..28, 11..17)는 방주 터, 오른쪽 뒤(29..38, 2..8)는 밭. 방주 문 앞으로 꽃길이 난다.
       왼쪽과 앞쪽 가장자리는 잣나무(고페르 나무) 숲(SCENERY) — 방주 나무를 여기서 벤다 */
    ark: { mail: [4, 1], board: [5, 0], sign: [5, 2], birdhouse: [7, 0], flag: [9, 0], statue: [12, 0], fountain: [20, 1], santapost: [6, 0], genielamp: [8, 1],
      coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], greenhouse: [22, 2], barn: [24, 6], scarecrow: [28, 9], pasture: [31, 20],
      pond: [2, 21], path: [15, 19], lantern: [10, 18], bench: [12, 25], swing: [0, 11], arch: [18, 21], sandbox: [7, 24], firepit: [24, 22],
      clothesline: [0, 27], flowerbed: [7, 12], wagon: [4, 27], windmill: [37, 12],
      lighthouse: [39, 0], palm: [0, 9], cairn: [28, 27], waterfall: [37, 26], balloon: [34, 15], skybridge: [20, 27], anchor: [30, 11], boat: [9, 22],
      parasol: [27, 24], woodpile: [6, 9], milkcans: [33, 11], alphorn: [14, 28], shishi: [1, 15], koinobori: [2, 15], toro: [39, 15], igloo: [8, 4],
      sled: [24, 28], icefish: [5, 15], sauna: [30, 26], lavvu: [26, 26], icesculpt: [21, 9], berber: [33, 27], zellige: [36, 9], telescope: [38, 17],
      jacklight: [4, 0], treehouse: [10, 0], ropebridge: [13, 0], vinehammock: [19, 0], samba: [8, 0], safari: [21, 0], manyatta: [23, 0], lookout: [15, 0] },   // 끝줄은 단풍·밀림·사바나 추억(2026-10-09)
    /* 무지개 농장(40×30) — 물 빠진 새 땅. 밭은 집 옆(7..16, 4..10), 새 땅 건설 여섯(PLACE 의 land)은 PLACE 자리 그대로 */
    newland: { mail: [4, 1], board: [5, 0], sign: [5, 2], birdhouse: [8, 1], flag: [10, 1], statue: [13, 1], fountain: [22, 1], santapost: [6, 0], genielamp: [11, 0],
      coop: [0, 4], pethouse: [3, 4], well: [4, 6], hive: [2, 7], greenhouse: [33, 2], barn: [28, 2], scarecrow: [17, 8], pasture: [31, 23],
      pond: [2, 20], path: [10, 12], lantern: [22, 11], bench: [14, 20], swing: [0, 11], arch: [16, 18], sandbox: [5, 25], firepit: [20, 22],
      clothesline: [0, 27], flowerbed: [24, 13], wagon: [9, 27], windmill: [37, 9],
      lighthouse: [39, 0], palm: [0, 9], cairn: [27, 25], waterfall: [37, 15], balloon: [34, 12], skybridge: [22, 27], anchor: [29, 12], boat: [9, 22],
      parasol: [26, 22], woodpile: [1, 13], milkcans: [33, 8], alphorn: [14, 28], shishi: [3, 15], koinobori: [4, 15], toro: [38, 4], igloo: [19, 8],
      sled: [24, 28], icefish: [6, 18], sauna: [28, 27], lavvu: [12, 24], icesculpt: [22, 9], berber: [17, 25], zellige: [37, 5], telescope: [38, 19],
      leafpile: [4, 0], jacklight: [7, 0], treehouse: [14, 0], vinehammock: [8, 0], samba: [10, 0], safari: [12, 0], manyatta: [20, 0] },   // 끝줄은 단풍·밀림·사바나 추억(2026-10-09)
  };
  function spotOf(world, id){
    const P = PLACE[id]; if (!P) return null;
    const home = (FARM_SPOT[farmOf(world).id] || {})[id];
    const L = (world && world.layout && world.layout[id]) || (home && { x: home[0], y: home[1] }) || null;
    return { id, x: L ? L.x : P.x, y: L ? L.y : P.y, w: P.w, h: P.h, move: P.move, name: P.name };
  }
  // 지금 농장에 실제로 있는 것들만. 안 지은 건물 자리는 비어 있는 것으로 친다.
  function thingHere(world, id){
    const P = PLACE[id];
    if (!P) return false;
    if (P.kind === 'always') return true;
    if (P.kind === 'build') return !!(world.buildings && world.buildings[id] && world.buildings[id].done);
    // 방주는 방주 농장에만(홍수 동안에도 그 자리에 떠 있다), 새 땅 건설은 무지개 농장에서 다 지은 것만
    if (P.kind === 'ark') return farmOf(world).id === 'ark' && !(world.ark && world.ark.phase === 'land');   // 떠난 뒤 옛 농장 구경 때는 빈 터
    if (P.kind === 'land') return farmOf(world).id === 'newland' && !!(world.ark && world.ark.land && world.ark.land[id] && world.ark.land[id].done);
    return !!(world.decor && world.decor[id]);
  }
  // 밭은 늘 자리를 비워 둔다 — 지금 열린 만큼이 아니라 끝까지 넓혔을 때만큼.
  const FIELD_BOX = { x: FIELD.x0, y: FIELD.y0, w: FIELD.w, h: FIELD.h };

  // ---------- 동물 ----------
  // 밥은 하루 한 번이면 되지만, 쓰다듬기는 둘 다 해야 마음이 자란다.
  // 마음이 5 를 넘으면 큰 달걀·금빛 우유가 나온다.
  // find 가 있는 아이(강아지·고양이)는 낳는 대신 무언가를 물어 온다.
  const ANIMALS = {
    chicken: { name: '닭',    cost: 150, need: 'coop',    product: 'egg',     best: 'bigegg',      every: 1, icon: '🐔' },
    duck:    { name: '오리',  cost: 220, need: 'coop',    product: 'duckegg', best: 'downfeather', every: 1, icon: '🦆' },
    cow:     { name: '소',    cost: 500, need: 'barn',    product: 'milk',    best: 'goldmilk',    every: 1, icon: '🐄' },
    sheep:   { name: '양',    cost: 400, need: 'barn',    product: 'wool',    best: null,          every: 3, icon: '🐑' },
    pig:     { name: '돼지',  cost: 600, need: 'pasture', product: 'truffle', best: null,          every: 2, icon: '🐖' },
    rabbit:  { name: '토끼',  cost: 250, need: 'pasture', product: 'angora',  best: null,          every: 2, icon: '🐇' },
    dog:     { name: '강아지', cost: 700, need: 'pethouse', product: null,    best: 'gem',         every: 1, icon: '🐕', find: ['wood', 'stone', 'berry'] },
    cat:     { name: '고양이', cost: 700, need: 'pethouse', product: null,    best: 'gem',         every: 1, icon: '🐈', find: ['berry', 'fert', 'wood'] },
    // 이삿날 새 농장에서 새끼 한 마리로 따라오는 식구(gift = 그 농장). 가게에서는 안 판다(2026-09-30 로키즈 「이사 보상」)
    gull:    { name: '갈매기', cost: 0,   need: 'coop',    product: null,     best: 'gem',         every: 1, icon: '🕊️', find: ['fish:mackerel', 'fish:flounder', 'fish:seaweed'], gift: 'seaside' },
    goat:    { name: '염소',  cost: 0,   need: 'barn',    product: 'milk',    best: 'goldmilk',    every: 1, icon: '🐐', gift: 'mountain' },
    crane:   { name: '두루미', cost: 0,   need: 'pasture', product: null,     best: 'gem',         every: 1, icon: '🦢', find: ['fish:minnow', 'fish:crucian', 'fish:carp'], gift: 'cloud' },
    // 순록은 우유를 주다가 가끔(findOdds) 눈 밑에서 이끼나 솔방울을 찾아 물어 온다(2026-10-09)
    reindeer:{ name: '순록',  cost: 0,   need: 'barn',    product: 'milk',    best: 'goldmilk',    every: 1, icon: '🦌', gift: 'aurora', find: ['moss', 'pinecone'], findOdds: 0.35 },
    // 낙타(사막 이사 식구, 2026-10-09) — 젖을 주다가 가끔 대추야자나 사막 장미 돌을 물어 온다. 외양간은 순록 차지라 목장에서 산다
    camel:   { name: '낙타',  cost: 0,   need: 'pasture', product: 'milk',    best: 'goldmilk',    every: 1, icon: '🐪', gift: 'desert', find: ['date', 'sandrose'], findOdds: 0.35 },
    /* 단풍·밀림·사바나(2026-10-09 로키즈 「각 농장에서만 얻을 수 있는 동식물」) — gift 는 이삿날 새끼로 따라오는 식구,
       farm 은 그 농장 가게에서만 파는 동물. 떠나려면 그 농장 동물을 한 마리씩은 데리고 있어야 한다(짝은 방주 농장에서 찾아온다) */
    deer:    { name: '사슴',   cost: 0,   need: 'barn',    product: null,     best: 'gem',         every: 1, icon: '🦌', gift: 'maple', find: ['chestnut', 'acorn'] },
    squirrel:{ name: '다람쥐', cost: 380, need: 'coop',    product: null,     best: 'gem',         every: 1, icon: '🐿️', farm: 'maple', find: ['acorn', 'chestnut', 'acorn'] },
    monkey:  { name: '원숭이', cost: 0,   need: 'pasture', product: null,     best: 'gem',         every: 1, icon: '🐒', gift: 'jungle', find: ['banana', 'banana', 'mango'] },
    parrot:  { name: '앵무새', cost: 450, need: 'coop',    product: 'feather', best: null,         every: 2, icon: '🦜', farm: 'jungle' },
    giraffe: { name: '기린',   cost: 0,   need: 'barn',    product: null,     best: 'gem',         every: 1, icon: '🦒', gift: 'savanna', find: ['baobab', 'baobab', 'wood'] },
    elephant:{ name: '코끼리', cost: 900, need: 'barn',    product: null,     best: 'gem',         every: 1, icon: '🐘', farm: 'savanna', find: ['wood', 'wood', 'stone', 'baobab'] },
    zebra:   { name: '얼룩말', cost: 600, need: 'pasture', product: null,     best: 'gem',         every: 1, icon: '🦓', farm: 'savanna', find: ['berry', 'baobab'] },
  };
  const ANIMAL_MAX = { coop: 6, barn: 6, pasture: 4, pethouse: 2 };
  // 그 농장 우리에 몇 마리 — 방주·무지개 농장은 세 배(pens). 스무 가지를 한 쌍씩 다 모으려면 들판 우리로는 모자란다
  const animalMax = (world, need) => ANIMAL_MAX[need] * ((world && farmOf(world).pens) || 1);
  const LOVE_FOR_BEST = 5;
  // 새끼. 마음이 아주 큰 어른이, 우리에 자리가 있을 때만 본다.
  const LOVE_FOR_BABY = 8;      // 마음이 이만큼 크면 새끼를 볼 수 있다
  const BABY_DAYS = 5;          // 닷새 돌보면 어른이 된다
  const BABY_REST_DAYS = 8;     // 한 번 낳으면 여드레는 쉰다
  const BABY_CHANCE = 0.34;     // 조건이 맞은 날에도 셋에 하나꼴로만
  /* 하루가 열리면 새끼가 자라고, 마음이 큰 어른이 새끼를 본다.
     자란 것을 먼저 세는 까닭: 어른이 되어도 자리는 그대로라 셈이 달라지지 않지만,
     「아기」 딱지는 그날 아침에 떼 주는 것이 맞다. */

  // ---------- 낚시 ----------
  // 연못을 놓으면 생기는 놀이. 하루 다섯 번까지, 한 번에 기운 하나.
  // 무엇이 걸릴지는 그날 그 아이의 차례로 정해진다 — 두 아이가 같은 것만 낚지 않게.
  const FISH = {
    minnow:  { name: '피라미',     sell: 25,  w: 34, c: '#a9c4d6' },
    crucian: { name: '붕어',       sell: 55,  w: 24, c: '#c9b06a' },
    carp:    { name: '잉어',       sell: 120, w: 15, c: '#e0813f' },
    eel:     { name: '장어',       sell: 200, w: 8,  c: '#5a6b52', season: ['summer', 'autumn'] },
    trout:   { name: '송어',       sell: 260, w: 6,  c: '#8fb7c9', season: ['winter', 'spring'] },
    golden:  { name: '금빛 잉어',   sell: 900, w: 2,  c: '#ffd24d' },
    catfish: { name: '메기',       sell: 320, w: 12, c: '#4a4238', night: true },
    moonfish:{ name: '달빛 물고기', sell: 700, w: 4,  c: '#cfd8f5', night: true },
    // 계절마다 다른 것이 물게 — 한 계절에 새 물고기 하나씩은 있어야 「다음 계절엔 뭐가 나오나」가 생긴다
    shrimp:  { name: '새우',       sell: 45,  w: 20, c: '#f2a58c', shape: 'shrimp' },
    sweetfish:{ name: '은어',      sell: 150, w: 9,  c: '#c7d9d4', season: ['summer'] },
    crayfish:{ name: '가재',       sell: 70,  w: 12, c: '#b9533e', season: ['summer', 'autumn'], shape: 'shrimp' },
    smelt:   { name: '빙어',       sell: 90,  w: 14, c: '#dfe8ef', season: ['winter'] },
    puffer:  { name: '복어',       sell: 380, w: 5,  c: '#e8d8a0', season: ['autumn', 'winter'] },
    boot:    { name: '낡은 장화',   sell: 2,   w: 11, c: '#6b5a4a', junk: true },
    // 바닷가 농장에서 섬 가장자리 바다에 찌를 던지면 무는 것(sea). 연못에서는 안 문다.
    mackerel:{ name: '고등어',     sell: 80,  w: 30, c: '#5f86a8', sea: true },
    squid:   { name: '오징어',     sell: 150, w: 14, c: '#f0c8b8', sea: true, shape: 'shrimp' },
    flounder:{ name: '광어',       sell: 180, w: 12, c: '#a8977a', sea: true },
    seabream:{ name: '참돔',       sell: 260, w: 8,  c: '#e0707a', sea: true },
    tuna:    { name: '참치',       sell: 950, w: 2,  c: '#3f5f88', sea: true },
    seaweed: { name: '미역',       sell: 5,   w: 10, c: '#4f7a4a', sea: true, junk: true },
    // 오로라 농장 얼음낚시 구멍(icefish)에서만 무는 것(ice). 연못·바다에서는 안 문다(2026-10-09)
    cod:     { name: '대구',       sell: 110, w: 30, c: '#9a8f78', ice: true, farm: 'aurora' },
    char:    { name: '북극곤들매기', sell: 280, w: 12, c: '#e0785a', ice: true, farm: 'aurora' },
  };
  const FISH_IDS = Object.keys(FISH);
  const FISH_MAX = 5;                    // 하루에 다섯 번
  // 밤 — 농장에 등불이 켜지는 시각과 같게 본다. 밤에만 무는 물고기가 있다.
  function isNight(now){ const h = new Date(now).getHours(); return h >= 19 || h < 6; }
  /* grade 는 찌를 당긴 손맛 — 'perfect' | 'good' | 'miss'.
     칸 안에서 멈추면 귀한 것이 잘 물고 두 마리가 올라온다. 놓쳐도 빈손은 아니다 —
     아이가 하는 놀이라, 못했다고 아무것도 안 주면 다시 안 온다. */

  // ---------- 채집 ----------
  // 나무 셋·바위 둘·산딸기 덤불 하나가 날마다 돌아온다. 건물 재료는 여기서 난다.
  const NODES = {
    tree1: { kind: 'tree', x: 1,  y: 10, give: { wood: 3 },  cost: 'chop',   days: 1 },
    tree2: { kind: 'tree', x: 3,  y: 10, give: { wood: 3 },  cost: 'chop',   days: 1 },
    tree3: { kind: 'tree', x: 5,  y: 10, give: { wood: 4 },  cost: 'chop',   days: 2 },
    tree4: { kind: 'tree', x: 7,  y: 11, give: { wood: 5 },  cost: 'chop',   days: 2 },
    rock1: { kind: 'rock', x: 9,  y: 11, give: { stone: 2 }, cost: 'mine',   days: 1 },
    rock2: { kind: 'rock', x: 11, y: 11, give: { stone: 3 }, cost: 'mine',   days: 1 },
    rock3: { kind: 'rock', x: 10, y: 13, give: { stone: 4 }, cost: 'mine',   days: 2 },
    bush:  { kind: 'bush', x: 5,  y: 12, give: { berry: 2 }, cost: 'forage', days: 1, season: ['spring', 'summer', 'autumn'] },
    bush2: { kind: 'bush', x: 6,  y: 13, give: { berry: 3 }, cost: 'forage', days: 2, season: ['spring', 'summer', 'autumn'] },
    snow:  { kind: 'snow', x: 8,  y: 13, give: { snowball: 1 }, cost: 'forage', days: 1, season: ['winter'] },
  };
  /* 새 농장은 나무·바위·덤불 자리도 저마다 다르다(2026-09-29 로키즈 「널찍하게, 다른 농장과 다른 느낌으로」).
     여기 없는 농장(들판)은 NODES 의 x,y. 채집 기록(mine.nodes)은 이름으로 적으니 자리가 달라도 그대로다. */
  const NODE_SPOT = {
    seaside:  { tree1: [0, 7], tree2: [3, 7], tree3: [0, 10], tree4: [6, 11], rock1: [20, 11], rock2: [12, 15], rock3: [14, 13], bush: [2, 12], bush2: [11, 14], snow: [12, 16] },
    mountain: { tree1: [1, 9], tree2: [0, 11], tree3: [2, 13], tree4: [4, 10], bush: [7, 10], bush2: [5, 13], snow: [8, 13], rock1: [21, 2], rock2: [23, 7], rock3: [21, 9] },
    cloud:    { tree1: [5, 10], tree2: [5, 12], tree3: [14, 10], tree4: [14, 12], bush: [8, 13], bush2: [10, 13], snow: [10, 16], rock1: [11, 15], rock2: [14, 15], rock3: [12, 16] },
    aurora:   { tree1: [5, 10], tree2: [5, 12], tree3: [14, 10], tree4: [14, 12], bush: [8, 13], bush2: [10, 13], snow: [10, 16], rock1: [11, 15], rock2: [14, 15], rock3: [12, 16] },
    desert:   { tree1: [5, 10], tree2: [5, 12], tree3: [14, 10], tree4: [14, 12], bush: [8, 13], bush2: [10, 13], snow: [10, 16], rock1: [11, 15], rock2: [14, 15], rock3: [12, 16] },
    maple:    { tree1: [5, 10], tree2: [5, 12], tree3: [14, 10], tree4: [14, 12], bush: [8, 13], bush2: [10, 13], snow: [10, 16], rock1: [11, 15], rock2: [14, 15], rock3: [12, 16] },
    jungle:   { tree1: [5, 10], tree2: [5, 12], tree3: [14, 10], tree4: [14, 12], bush: [8, 13], bush2: [10, 13], snow: [10, 16], rock1: [11, 15], rock2: [14, 15], rock3: [12, 16] },
    savanna:  { tree1: [5, 10], tree2: [5, 12], tree3: [14, 10], tree4: [14, 12], bush: [8, 13], bush2: [10, 13], snow: [10, 16], rock1: [11, 15], rock2: [14, 15], rock3: [12, 16] },
    ark:      { tree1: [3, 11], tree2: [3, 13], tree3: [5, 11], tree4: [5, 13], bush: [8, 14], bush2: [9, 16], snow: [6, 17], rock1: [12, 22], rock2: [14, 22], rock3: [16, 23] },
    newland:  { tree1: [0, 15], tree2: [1, 17], tree3: [5, 13], tree4: [3, 18], bush: [7, 19], bush2: [6, 21], snow: [10, 19], rock1: [23, 6], rock2: [32, 15], rock3: [25, 19] },
  };
  // 아이들이 옮긴 자리(world.layout[이름])가 있으면 그 자리(2026-10-07 로키즈 「채집 나무·덤불도 재배치」)
  function nodeSpot(world, id){
    const L = world && world.layout && world.layout[id];
    if (L) return { x: L.x, y: L.y };
    const N = NODES[id], h = (NODE_SPOT[farmOf(world).id] || {})[id];
    return h ? { x: h[0], y: h[1] } : { x: N.x, y: N.y };
  }
  /* 풍경 — 넓어진 섬에 더 선 나무·덤불·바위(아래 nodeDef 로 채집도 된다). 넓어진 섬이 휑하지 않게 농장마다 결을 달리해 둔다.
     바닷가: 올리브·사이프러스 숲과 해변 바위 · 산골: 왼쪽 뒤 전나무 숲과 오른쪽 비탈 너덜 · 꽃구름: 벚나무 가로수와 돌 정원 */
  const SCENERY = {
    seaside:  [['tree', 1, 8], ['tree', 1, 11], ['tree', 1, 13], ['tree', 2, 15], ['bush', 0, 15], ['rock', 0, 17], ['rock', 20, 9], ['bush', 14, 16], ['tree', 10, 12], ['bush', 19, 1], ['rock', 21, 4], ['tree', 9, 15], ['bush', 4, 14], ['tree', 19, 10], ['tree', 21, 12], ['tree', 6, 16]],
    mountain: [['tree', 0, 8], ['tree', 2, 10], ['tree', 1, 12], ['tree', 3, 12], ['tree', 0, 14], ['tree', 2, 15], ['tree', 0, 16], ['tree', 3, 17], ['tree', 4, 8], ['rock', 20, 0], ['rock', 22, 1], ['rock', 23, 4], ['rock', 22, 8], ['rock', 23, 10], ['bush', 15, 16], ['rock', 19, 17], ['tree', 17, 15], ['tree', 23, 14], ['rock', 16, 17], ['tree', 13, 11]],
    cloud:    [['tree', 8, 10], ['tree', 11, 10], ['tree', 8, 12], ['tree', 11, 12], ['tree', 0, 9], ['tree', 3, 9], ['tree', 23, 6], ['tree', 23, 10], ['tree', 23, 17], ['tree', 14, 19], ['bush', 6, 14], ['bush', 0, 17], ['bush', 18, 12], ['rock', 15, 15], ['bush', 23, 14], ['bush', 8, 0], ['bush', 9, 0], ['bush', 10, 0], ['bush', 11, 0], ['bush', 9, 1], ['bush', 10, 1], ['bush', 11, 1], ['bush', 13, 0], ['bush', 14, 0], ['bush', 15, 0], ['rock', 15, 1], ['tree', 2, 18], ['tree', 7, 18], ['bush', 19, 9]],
    aurora:   [['tree', 8, 10], ['tree', 11, 10], ['tree', 8, 12], ['tree', 11, 12], ['tree', 0, 9], ['tree', 3, 9], ['tree', 23, 6], ['tree', 23, 10], ['tree', 23, 17], ['tree', 14, 19], ['bush', 6, 14], ['bush', 0, 17], ['bush', 18, 12], ['rock', 15, 15], ['bush', 23, 14], ['tree', 2, 18], ['tree', 7, 18], ['bush', 19, 9], ['tree', 25, 7], ['tree', 25, 12], ['tree', 25, 15], ['tree', 24, 19], ['rock', 25, 0]],
    // 사막 — 대추야자 숲은 왼쪽 오아시스 둘레와 오른쪽 끝, 붉은 사암은 오른쪽 뒤
    desert:   [['tree', 8, 10], ['tree', 11, 10], ['tree', 8, 12], ['tree', 11, 12], ['tree', 0, 9], ['tree', 3, 9], ['tree', 23, 6], ['tree', 23, 10], ['tree', 23, 17], ['tree', 14, 19], ['bush', 6, 14], ['bush', 0, 17], ['bush', 18, 12], ['rock', 15, 15], ['bush', 23, 14], ['tree', 2, 18], ['tree', 7, 18], ['bush', 19, 9], ['tree', 27, 9], ['tree', 27, 15], ['tree', 26, 19], ['rock', 25, 0], ['rock', 27, 1], ['rock', 26, 2]],
    // 단풍 농장 — 단풍나무·자작나무 숲이 섬 가장자리를 두르고, 오른쪽 뒤는 이끼 낀 바위
    maple:    [['tree', 8, 10], ['tree', 11, 10], ['tree', 8, 12], ['tree', 11, 12], ['tree', 0, 9], ['tree', 3, 9], ['tree', 23, 6], ['tree', 23, 10], ['tree', 23, 17], ['tree', 14, 19], ['bush', 6, 14], ['bush', 0, 17], ['bush', 18, 12], ['rock', 15, 15], ['bush', 23, 14], ['tree', 2, 18], ['tree', 7, 18], ['bush', 19, 9], ['tree', 25, 7], ['tree', 25, 12], ['tree', 25, 15], ['tree', 24, 19], ['rock', 25, 0], ['rock', 24, 1]],
    // 밀림 농장 — 가장자리마다 빽빽한 열대 나무, 덤불이 많다
    jungle:   [['tree', 8, 10], ['tree', 11, 10], ['tree', 8, 12], ['tree', 11, 12], ['tree', 0, 9], ['tree', 3, 9], ['tree', 23, 6], ['tree', 23, 10], ['tree', 23, 17], ['tree', 14, 19], ['bush', 6, 14], ['bush', 0, 17], ['bush', 18, 12], ['rock', 15, 15], ['bush', 23, 14], ['tree', 2, 18], ['tree', 7, 18], ['bush', 19, 9], ['tree', 25, 7], ['tree', 26, 9], ['tree', 25, 15], ['tree', 26, 17], ['tree', 24, 19], ['bush', 26, 13], ['bush', 26, 2], ['rock', 25, 0],
               ['tree', 0, 13], ['tree', 26, 5], ['tree', 26, 15], ['tree', 19, 19], ['tree', 10, 19], ['tree', 26, 11], ['bush', 9, 16]],   // 2026-10-09 「더 짙은 정글」 — 가장자리 숲을 빽빽하게
    // 사바나 농장 — 띄엄띄엄 선 아카시아와 바오밥, 오른쪽 뒤는 둥근 바위 언덕(코피)
    savanna:  [['tree', 8, 10], ['tree', 11, 12], ['tree', 0, 9], ['tree', 23, 6], ['tree', 23, 17], ['tree', 14, 19], ['bush', 6, 14], ['bush', 0, 17], ['bush', 18, 12], ['rock', 15, 15], ['bush', 23, 14], ['tree', 2, 18], ['bush', 19, 9], ['tree', 27, 9], ['tree', 27, 15], ['tree', 26, 19], ['rock', 25, 0], ['rock', 27, 1], ['rock', 26, 2], ['rock', 27, 4]],
    // 방주 농장 — 왼쪽과 앞쪽 가장자리가 잣나무(고페르 나무) 숲. 방주에 들 나무를 여기서 벤다(창세기 6:14). 오른쪽엔 바위와 덤불
    ark:      [['tree', 0, 14], ['tree', 3, 16], ['tree', 0, 17], ['tree', 2, 18], ['tree', 4, 18], ['tree', 1, 20], ['tree', 3, 20], ['tree', 5, 20], ['tree', 7, 18], ['tree', 8, 20],
               ['tree', 0, 22], ['tree', 0, 24], ['tree', 1, 25], ['tree', 3, 25], ['tree', 5, 25], ['tree', 2, 29], ['tree', 6, 28], ['tree', 9, 27], ['tree', 11, 28], ['tree', 17, 28],
               ['tree', 18, 26], ['tree', 22, 29], ['tree', 29, 29], ['tree', 36, 29], ['tree', 39, 28], ['tree', 39, 6], ['tree', 39, 9], ['tree', 39, 21], ['tree', 39, 24], ['tree', 37, 23],
               ['tree', 28, 0], ['tree', 30, 0], ['tree', 33, 0], ['tree', 36, 0], ['tree', 10, 9], ['tree', 6, 26],
               ['rock', 30, 14], ['rock', 32, 13], ['rock', 9, 8], ['rock', 35, 18], ['bush', 29, 18], ['bush', 17, 6], ['bush', 34, 9], ['bush', 21, 24]],
    // 무지개 농장 — 물 빠진 새 땅에 막 돋은 올리브·잣나무 숲, 젖은 바위
    newland:  [['tree', 0, 23], ['tree', 1, 25], ['tree', 3, 24], ['tree', 7, 24], ['tree', 3, 28], ['tree', 6, 29], ['tree', 11, 29], ['tree', 16, 29], ['tree', 20, 29], ['tree', 26, 29],
               ['tree', 31, 29], ['tree', 37, 29], ['tree', 39, 26], ['tree', 39, 22], ['tree', 38, 13], ['tree', 39, 11], ['tree', 36, 0], ['tree', 31, 0], ['tree', 26, 0], ['tree', 19, 0],
               ['tree', 2, 10], ['tree', 39, 2],
               ['rock', 15, 22], ['rock', 21, 19], ['rock', 35, 10], ['bush', 13, 22], ['bush', 27, 15], ['bush', 33, 16]],
  };
  function sceneryOf(world){
    const lay = (world && world.layout) || {};
    return (SCENERY[farmOf(world).id] || []).map(([kind, x, y], i) => { const L = lay['sc' + i]; return { id: 'sc' + i, kind, x: L ? L.x : x, y: L ? L.y : y }; });
  }
  /* 풍경도 다 채집된다(2026-10-01 로키즈 「풍경 나무도 다 벨 수 있게」 → 「바위랑 덤불도」). 채집 자리와 똑같이 생겨서, 안 되면 고장처럼 보였다.
     기록은 mine.nodes['sc3'] 처럼 풍경 번호로 적는다. 채집 자리보다 조금 덜 주고 이틀에 한 번 돌아온다. */
  const SCENERY_NODE = {
    tree: { kind: 'tree', give: { wood: 3 },  cost: 'chop',   days: 2 },
    rock: { kind: 'rock', give: { stone: 2 }, cost: 'mine',   days: 2 },
    bush: { kind: 'bush', give: { berry: 2 }, cost: 'forage', days: 2, season: ['spring', 'summer', 'autumn'] },
  };
  function nodeDef(world, id){
    if (NODES[id]) return NODES[id];
    const c = sceneryOf(world).find(c => c.id === id);
    return c ? SCENERY_NODE[c.kind] : null;
  }
  // 자리는 하나지만 몫은 각자다 — 먼저 온 사람이 다 가져가면 둘째는 늘 빈손이라서.
  function nodeReady(world, mine, id, now){
    const N = nodeDef(world, id), cal = calendar(world, now);
    if (!N) return false;
    if (N.season && N.season.indexOf(cal.season) < 0) return false;
    const last = mine.nodes && mine.nodes[id];
    return !last || daysBetween(last, dayKey(now)) >= N.days;
  }

  // ---------- 가구 ----------
  // w: 몇 칸 너비. cozy: 아늑함 점수. room: 놓을 수 있는 방(없으면 아무 데나).
  // 색은 화면이 그릴 때 쓴다. 이 파일은 그림을 모른다.
  const FURNITURE = {
    bed1:    { name: '작은 침대',   cost: 0,    w: 2, kind: 'bed', energy: 0,  cozy: 1, c: '#f2c6c6' , flat: true },
    bed2:    { name: '포근한 침대', cost: 400,  w: 2, kind: 'bed', energy: 4,  cozy: 3, c: '#f7a8bf' , flat: true },
    bed3:    { name: '구름 침대',   cost: 1500, w: 2, kind: 'bed', energy: 8,  cozy: 5, c: '#cfe4ff' , flat: true },
    rug1:    { name: '줄무늬 러그', cost: 80,   w: 2, kind: 'rug', cozy: 1, c: '#ffd979' , flat: true },
    rug2:    { name: '꽃무늬 러그', cost: 200,  w: 2, kind: 'rug', cozy: 2, c: '#f7a8bf' , flat: true },
    table:   { name: '탁자',        cost: 120,  w: 2, kind: 'table', cozy: 1, c: '#c79a62' , flat: true },
    chair:   { name: '의자',        cost: 60,   w: 1, kind: 'chair', cozy: 1, c: '#c79a62' , flat: true },
    lamp:    { name: '램프',        cost: 90,   w: 1, kind: 'lamp', cozy: 2, c: '#ffe9a8' },
    plant:   { name: '화분',        cost: 70,   w: 1, kind: 'plant', cozy: 1, c: '#6fb567' },
    shelf:   { name: '책장',        cost: 220,  w: 1, kind: 'shelf', cozy: 2, c: '#a67c52' },
    frame:   { name: '그림 액자',   cost: 150,  w: 1, kind: 'frame', cozy: 2, c: '#ffb7d5' , wall: true },
    curtain: { name: '커튼 창문',   cost: 180,  w: 1, kind: 'window', cozy: 2, c: '#bfe4f7' , wall: true },
    sofa:    { name: '소파',        cost: 350,  w: 2, kind: 'sofa', cozy: 3, c: '#ff7f8a' , flat: true },
    clock:   { name: '벽시계',      cost: 130,  w: 1, kind: 'clock', cozy: 1, c: '#fff6e9' , wall: true },
    tank:    { name: '어항',        cost: 300,  w: 1, kind: 'tank', cozy: 2, c: '#8ec9ee' },
    catbed:  { name: '고양이 집',   cost: 250,  w: 1, kind: 'catbed', cozy: 2, c: '#f5d9a8' , flat: true },
    stars:   { name: '별 조명',     cost: 260,  w: 1, kind: 'stars', cozy: 3, c: '#ffe680' , wall: true },
    piano:   { name: '피아노',      cost: 900,  w: 2, kind: 'piano', cozy: 4, c: '#3a3230' , flat: true },
    doll:    { name: '인형',        cost: 110,  w: 1, kind: 'doll', cozy: 1, c: '#ffcf9e' },
    vase:    { name: '꽃병',        cost: 95,   w: 1, kind: 'vase', cozy: 1, c: '#6cc7b3' },
    tree:    { name: '겨울 나무',   cost: 500,  w: 1, kind: 'xmas', cozy: 3, c: '#3f7d3c', season: 'winter' },
    trophy:  { name: '축제 트로피', cost: 0,    w: 1, kind: 'trophy', cozy: 3, c: '#ffd25a', rare: true },
    stove:   { name: '화로',        cost: 0,    w: 1, kind: 'stove', cozy: 2, c: '#7a5c48', rare: true },
    // 나중에 들어온 것들
    bunk:    { name: '이층 침대',   cost: 900,  w: 2, kind: 'bunk',  energy: 6, cozy: 4, c: '#f7c6a8' , flat: true },
    desk:    { name: '책상',        cost: 260,  w: 2, kind: 'desk',  cozy: 2, c: '#c79a62' , flat: true },
    fire:    { name: '벽난로',      cost: 1100, w: 2, kind: 'fire',  cozy: 5, c: '#a9866a' , flat: true },
    mirror:  { name: '거울',        cost: 190,  w: 1, kind: 'mirror', cozy: 2, c: '#cfe4ff' , wall: true },
    guitar:  { name: '기타',        cost: 420,  w: 1, kind: 'guitar', cozy: 3, c: '#d8a05a' },
    bear:    { name: '큰 곰인형',   cost: 340,  w: 1, kind: 'bear',  cozy: 3, c: '#c79b6d' },
    cushion: { name: '방석',        cost: 70,   w: 1, kind: 'cushion', cozy: 1, c: '#ffc48a' , flat: true },
    poster:  { name: '포스터',      cost: 140,  w: 1, kind: 'poster', cozy: 2, c: '#8fd9c8' , wall: true },
    // 방을 채울 것들 — 바닥에 놓는 것
    wardrobe:{ name: '옷장',        cost: 420,  w: 1, kind: 'wardrobe', cozy: 3, c: '#b98a5e' },
    drawer:  { name: '서랍장',      cost: 200,  w: 1, kind: 'drawer',  cozy: 2, c: '#d9b48a' },
    tv:      { name: '텔레비전',    cost: 650,  w: 2, kind: 'tv',      cozy: 3, c: '#3a3a42' , flat: true },
    fridge:  { name: '냉장고',      cost: 480,  w: 1, kind: 'fridge',  cozy: 2, c: '#e8eef2' },
    toybox:  { name: '장난감 상자', cost: 150,  w: 1, kind: 'toybox',  cozy: 2, c: '#ff9f6e' , flat: true },
    cattower:{ name: '고양이 타워', cost: 330,  w: 1, kind: 'cattower', cozy: 3, c: '#d8c7a8' },
    easel:   { name: '이젤',        cost: 240,  w: 1, kind: 'easel',   cozy: 3, c: '#c79a62' },
    beanbag: { name: '빈백',        cost: 190,  w: 1, kind: 'beanbag', cozy: 2, c: '#8fd0c0' , flat: true },
    tent:    { name: '놀이 텐트',   cost: 560,  w: 2, kind: 'tent',    cozy: 4, c: '#ffd979' , flat: true },
    rocker:  { name: '흔들목마',    cost: 300,  w: 1, kind: 'rocker',  cozy: 3, c: '#f7c6a8' },
    books:   { name: '책 더미',     cost: 60,   w: 1, kind: 'books',   cozy: 1, c: '#5aa9e6' , flat: true },
    bigplant:{ name: '큰 화분',     cost: 230,  w: 1, kind: 'bigplant', cozy: 2, c: '#4f9e57' },
    rug3:    { name: '동그란 러그', cost: 260,  w: 2, kind: 'rug',     cozy: 2, c: '#a9c8ff' , flat: true },
    // 벽에 거는 것
    board:   { name: '칠판',        cost: 170,  w: 1, kind: 'board',   cozy: 2, c: '#3f6b4a' , wall: true },
    garland: { name: '사진 줄',     cost: 120,  w: 1, kind: 'garland', cozy: 2, c: '#ffb7d5' , wall: true },
    wshelf:  { name: '벽 선반',     cost: 160,  w: 1, kind: 'wshelf',  cozy: 2, c: '#c79a62' , wall: true },
    rainbow: { name: '무지개',      cost: 150,  w: 1, kind: 'rainbow', cozy: 2, c: '#ff8fb8' , wall: true },
    // 그 계절에만 가게에 나오는 것
    sakura:  { name: '벚꽃 가지',   cost: 220,  w: 1, kind: 'sakura',  cozy: 2, c: '#ffc0d4', season: 'spring' },
    fan:     { name: '선풍기',      cost: 200,  w: 1, kind: 'fan',     cozy: 2, c: '#dfe8ee', season: 'summer' },
    pumpkin: { name: '호박 등',     cost: 220,  w: 1, kind: 'pumpkin', cozy: 2, c: '#ff8c3a', season: 'autumn' },
    // 놀 것들 — 방을 놀이터로 만드는 큰 것
    dollhouse:{ name: '인형의 집', cost: 380,  w: 1, kind: 'dollhouse', cozy: 3, c: '#ffd8c2' },
    slide:    { name: '미끄럼틀',  cost: 520,  w: 2, kind: 'slide',   cozy: 4, c: '#ffb26b' , flat: true },
    ballpit:  { name: '볼풀',      cost: 620,  w: 2, kind: 'ballpit', cozy: 4, c: '#8fd0f0' , flat: true },
    hammock:  { name: '해먹',      cost: 340,  w: 2, kind: 'hammock', energy: 3, cozy: 3, c: '#a9c8ff' , flat: true },
    kitchen:  { name: '놀이 부엌', cost: 400,  w: 1, kind: 'kitchen', cozy: 3, c: '#ffd0d8' },
    blocks:   { name: '블록 성',   cost: 130,  w: 1, kind: 'blocks',  cozy: 2, c: '#f2707d' , flat: true },
    dresser:  { name: '화장대',    cost: 360,  w: 1, kind: 'dresser', cozy: 3, c: '#e8c9a8' },
    nightsky: { name: '별 프로젝터', cost: 300, w: 1, kind: 'nightsky', cozy: 3, c: '#7f8fd6' },
    // 벽에 거는 것 넷
    heightbar:{ name: '키 재기 자', cost: 140, w: 1, kind: 'heightbar', cozy: 2, c: '#ffb7d5' , wall: true },
    worldmap: { name: '세계 지도',  cost: 200, w: 1, kind: 'worldmap',  cozy: 2, c: '#8fd9c8' , wall: true },
    mobile:   { name: '별 모빌',    cost: 160, w: 1, kind: 'mobile',    cozy: 2, c: '#ffd166' , wall: true },
    wreath:   { name: '겨울 화환',  cost: 180, w: 1, kind: 'wreath',    cozy: 2, c: '#e8574f' , wall: true, season: 'winter' },
    // 아이들이 골라 넣은 것 — 레샤와 상그렐라는 이 집의 진짜 식구다
    fox:      { name: '레샤 인형',     cost: 300, w: 1, kind: 'fox',       cozy: 3, c: '#ffb0c4' },
    sangre:   { name: '상그렐라 인형', cost: 300, w: 1, kind: 'sangre',    cozy: 3, c: '#fff6e9' },
    rabbit:   { name: '토끼 인형',     cost: 220, w: 1, kind: 'rabbit',    cozy: 2, c: '#f7f0ea' },
    pcdesk:   { name: '컴퓨터 책상',   cost: 720, w: 2, kind: 'pcdesk',    cozy: 3, c: '#c79a62' , flat: true },
    sunflower:{ name: '해바라기 화분', cost: 170, w: 1, kind: 'sunflower', cozy: 2, c: '#ffc94d' },
    rose:     { name: '장미 화분',     cost: 190, w: 1, kind: 'rose',      cozy: 2, c: '#ff6b7a' },
    whale:    { name: '고래 그림',     cost: 230, w: 1, kind: 'whale',     cozy: 3, c: '#5aa9e6' , wall: true },
    wlight:   { name: '벽 조명',       cost: 200, w: 1, kind: 'wlight',    cozy: 3, c: '#ffe9a8' , wall: true },
    medalcase:{ name: '훈장 걸이',     cost: 0,   w: 1, kind: 'medalcase', cozy: 4, c: '#c9a24a' , wall: true, rare: true },   // 가게에 없다 — 첫 훈장과 함께 온다
    /* 내 그림 액자 — 그림 일기에 그린 그림을 골라 담는다. 고른 그림은 칸 글자열 그대로
       집 정보에 얹는다(`pic`). 256글자라 세이브가 눈에 띄게 무거워지지 않고,
       손님 화면도 따로 부르는 것 없이 그대로 그린다. */
    mypic:    { name: '내 그림 액자',   cost: 150, w: 1, kind: 'mypic',     cozy: 4, c: '#e6d3ae' , wall: true, pic: true },
    bigbear:  { name: '엄청 큰 곰인형', cost: 950, w: 2, kind: 'bigbear', cozy: 5, c: '#c79b6d' },
    /* 그 농장에서만 파는 가구(2026-09-29 로키즈 「내부 꾸미개도 나라별로」) — 꾸미개의 farm 과 같은 뜻.
       바닷가=그리스, 산골=스위스, 꽃구름=일본. 이사 갈 때 가방·방에 든 것은 그대로 따라간다. */
    amphora:  { name: '암포라 항아리', cost: 260, w: 1, kind: 'amphora', cozy: 2, c: '#d9824f', farm: 'seaside' },
    olive:    { name: '올리브 나무',   cost: 320, w: 1, kind: 'olive',   cozy: 3, c: '#8fa86e', farm: 'seaside' },
    blueplate:{ name: '파란 무늬 접시', cost: 180, w: 1, kind: 'blueplate', cozy: 2, c: '#2f6fb0', wall: true, farm: 'seaside' },
    cuckoo:   { name: '뻐꾸기시계',    cost: 380, w: 1, kind: 'cuckoo',  cozy: 3, c: '#7a4c2a', wall: true, farm: 'mountain' },
    kachel:   { name: '타일 난로',     cost: 900, w: 1, kind: 'kachel',  cozy: 4, c: '#4f9a7a', farm: 'mountain' },
    sled:     { name: '나무 썰매',     cost: 240, w: 2, kind: 'sled',    cozy: 2, c: '#c9463f', flat: true, farm: 'mountain' },
    kotatsu:  { name: '고타쓰',        cost: 700, w: 2, kind: 'kotatsu', energy: 4, cozy: 4, c: '#e8818f', flat: true, farm: 'cloud' },
    andon:    { name: '종이 등',       cost: 240, w: 1, kind: 'andon',   cozy: 3, c: '#fff3d6', farm: 'cloud' },
    scroll:   { name: '족자',          cost: 260, w: 1, kind: 'scroll',  cozy: 3, c: '#f4ecd8', wall: true, farm: 'cloud' },
    // 오로라 = 북유럽 통나무집(2026-10-09). 흔들의자는 rocker(흔들목마)와 겹쳐 rockchair 로 둔다
    woodstove:{ name: '무쇠 장작 난로', cost: 850, w: 1, kind: 'woodstove', energy: 4, cozy: 4, c: '#3a3634', farm: 'aurora' },
    furrug:   { name: '순록 털 깔개',   cost: 380, w: 2, kind: 'furrug',    cozy: 3, c: '#e8dcc8', flat: true, farm: 'aurora' },
    rockchair:{ name: '뜨개 담요 흔들의자', cost: 460, w: 1, kind: 'rockchair', cozy: 3, c: '#a97b4f', farm: 'aurora' },
    advent:   { name: '대림절 별 등',   cost: 240, w: 1, kind: 'advent',    cozy: 3, c: '#ffd979', wall: true, farm: 'aurora' },
    // 사막 = 모로코 리아드(2026-10-09)
    teaset:   { name: '민트 차 상',     cost: 620, w: 1, kind: 'teaset',    energy: 3, cozy: 4, c: '#3a8a6a', farm: 'desert' },
    kilim:    { name: '베르베르 양탄자', cost: 420, w: 2, kind: 'kilim',     cozy: 3, c: '#b0302a', flat: true, farm: 'desert' },
    pouf:     { name: '가죽 방석',      cost: 300, w: 1, kind: 'pouf',      cozy: 3, c: '#c87a3a', farm: 'desert' },
    mlamp:    { name: '모로코 등',      cost: 280, w: 1, kind: 'mlamp',     cozy: 3, c: '#e8b040', wall: true, farm: 'desert' },
    // 단풍 = 캐나다 통나무 오두막 · 밀림 = 아마존 나무집 · 사바나 = 케냐 사파리 롯지(2026-10-09). 그림은 pages/room-hd-furn.js
    plaidsofa:{ name: '체크무늬 소파',   cost: 680, w: 2, kind: 'plaidsofa', energy: 3, cozy: 4, c: '#b8302a', farm: 'maple' },
    leafrug:  { name: '단풍잎 깔개',     cost: 380, w: 2, kind: 'leafrug',   cozy: 3, c: '#d8602a', flat: true, farm: 'maple' },
    syrupshelf:{ name: '시럽 병 선반',   cost: 320, w: 1, kind: 'syrupshelf', cozy: 3, c: '#c8862a', farm: 'maple' },
    leaflamp: { name: '단풍잎 등',       cost: 240, w: 1, kind: 'leaflamp',  cozy: 3, c: '#e8702a', wall: true, farm: 'maple' },
    rattan:   { name: '등나무 흔들의자', cost: 560, w: 1, kind: 'rattan',    energy: 3, cozy: 4, c: '#c8a060', farm: 'jungle' },
    monstera: { name: '몬스테라 화분',   cost: 300, w: 1, kind: 'monstera',  cozy: 3, c: '#3a8a4a', farm: 'jungle' },
    weaverug: { name: '짚 깔개',         cost: 340, w: 2, kind: 'weaverug',  cozy: 3, c: '#d8b870', flat: true, farm: 'jungle' },
    parrotlamp:{ name: '앵무새 등',      cost: 260, w: 1, kind: 'parrotlamp', cozy: 3, c: '#e84a3a', wall: true, farm: 'jungle' },
    kanga:    { name: '캉가 천 깔개',    cost: 400, w: 2, kind: 'kanga',     cozy: 3, c: '#e8a020', flat: true, farm: 'savanna' },
    drumstool:{ name: '북 의자',         cost: 480, w: 1, kind: 'drumstool', energy: 3, cozy: 4, c: '#8a5a3a', farm: 'savanna' },
    woodgiraffe:{ name: '나무 기린 조각', cost: 340, w: 1, kind: 'woodgiraffe', cozy: 3, c: '#d8a040', farm: 'savanna' },
    beadlamp: { name: '구슬 등',         cost: 260, w: 1, kind: 'beadlamp',  cozy: 3, c: '#3a6ae8', wall: true, farm: 'savanna' },
  };
  // 방은 가로 칸 수 × 세로 칸 수. 넓히는 건 언제든 안전하다 — 이미 놓인 가구는 그대로 있다.
  const ROOMS = {
    living: { name: '거실',    w: 9, h: 5, owner: null },
    sua:    { name: '수아 방', w: 7, h: 5, owner: 'sua' },
    yona:   { name: '연아 방', w: 7, h: 5, owner: 'yona' },
  };
  /* 방 넓히기 — 밭처럼 동전을 모아 두 번 넓힌다(world.rooms[방] = 0·1·2).
     가로 둘 세로 하나씩 늘린다: 거실 9×5 → 11×6 → 13×7, 각 방 7×5 → 9×6 → 11×7.
     가로만 늘리면 벽만 길어지고 바닥이 안 늘어 「복도」처럼 보인다.
     값은 밭 넓히기(300·900·2500) 사이에 두되, 방은 셋이라 조금 눅게 잡았다.
     거실은 둘이 함께 쓰는 자리라 누구든 넓힐 수 있고, 각자 방은 그 방 주인만 넓힌다. */
  const ROOM_GROW = [
    { w: 0, h: 0, cost: 0,    lv: 0 },
    { w: 2, h: 1, cost: 800,  lv: 3 },
    { w: 4, h: 2, cost: 2200, lv: 5 },
  ];
  function roomStep(world, room){
    const n = (world && world.rooms && Number(world.rooms[room])) || 0;
    return Math.max(0, Math.min(ROOM_GROW.length - 1, n));
  }
  /* 지금 이 농장에서 방이 몇 칸인가. ROOMS 는 처음 크기라 그대로 두고, 크기를 묻는 자리는
     전부 이걸 지난다. world 를 안 주면 처음 크기 — 손님 화면과 배포가 어긋난 동안에 쓰인다. */
  function roomBox(world, room){
    const B = ROOMS[room];
    if (!B) return null;
    const st = roomStep(world, room), g = ROOM_GROW[st];
    return { name: B.name, owner: B.owner, w: B.w + g.w, h: B.h + g.h, step: st, next: ROOM_GROW[st + 1] || null };
  }
  /* 어떤 방의 어디에 무엇이 있나: world.house[room][열쇠] = { f, by, r }
     열쇠는 두 가지다 — 바닥은 "x,y", 벽에 거는 것은 "w,벽,칸,단"(벽 0=왼쪽, 1=오른쪽). */
  // r 은 돌린 횟수 0·1·2·3 (오른쪽으로 90도씩). 없으면 0 — 예전 세이브가 그대로 열린다.
  function placed(world, room){ return (world.house && world.house[room]) || {}; }
  /* ---- 벽 격자 ----
     벽에 거는 것은 바닥 칸이 아니라 벽에 매단다. 열쇠는 'w,<벽>,<칸>,<단>' 이다
     (벽 0=왼쪽, 1=오른쪽). 바닥 열쇠('3,2')와 글자 모양이 달라서 occupied() 의 숫자
     비교에 걸리지 않는다 — 그림 한 장이 바닥 한 칸을 잡아먹던 것이 이걸로 없어진다.
     칸 너비를 44도트로 잡은 까닭: 벽에 거는 그림이 가장 넓은 것이 40도트라, 그보다
     넓게 띄어야 두 장이 겹치지 않는다. 단은 둘 — 아래 단은 12도트 내려 건다. */
  const TILE_HALF = 24;                       // 칸 하나가 벽을 따라 차지하는 가로 도트(farm.js 의 TW/2)
  const WALL_PITCH = 44, WALL_ROWS = 2;
  const WALL_TALL = { heightbar: 1, scroll: 1 };         // 아래 단에 걸면 허리 몰딩을 넘는 것 — 늘 윗단에만
  /* 배포가 어긋나는 십 분 동안 옛 pages/farm.js 는 wallCols(room, side) 로 부른다.
     첫 자리가 글자면 그 꼴로 알아듣고 처음 크기를 쓴다 — 벽에 건 그림이 사라지지 않는다. */
  function roomArgs(world, room, side){
    if (typeof world === 'string') return { world: null, room: world, side: room };
    return { world: world, room: room, side: side };
  }
  function wallLen(world, room, side){
    const a = roomArgs(world, room, side), B = roomBox(a.world, a.room);
    if (!B) return 0;
    return (a.side ? B.w : B.h) * TILE_HALF;
  }
  function wallCols(world, room, side){
    const a = roomArgs(world, room, side);
    return Math.max(1, Math.floor(wallLen(a.world, a.room, a.side) / WALL_PITCH));
  }
  function wallRowsFor(f){ const F = FURNITURE[f]; return (F && WALL_TALL[F.kind]) ? 1 : WALL_ROWS; }
  function wallKey(side, col, row){ return 'w,' + (side ? 1 : 0) + ',' + col + ',' + row; }
  function parseWall(k){
    if (typeof k !== 'string' || k.charAt(0) !== 'w') return null;
    const p = k.split(',');
    if (p.length !== 4) return null;
    const side = Number(p[1]), col = Number(p[2]), row = Number(p[3]);
    if (!isFinite(side) || !isFinite(col) || !isFinite(row)) return null;
    return { side: side ? 1 : 0, col: col, row: row };
  }
  /* 한 칸에는 하나만 건다. 아래 단은 열두 도트만 내려 걸리므로 같은 칸의 두 단은
     그림끼리 크게 겹친다 — 단은 「높이를 고르는 것」이지 자리를 하나 더 주는 게 아니다. */
  function hungCol(world, room, side, col){
    const P = placed(world, room);
    for (const k in P){
      const q = parseWall(k);
      if (q && q.side === (side ? 1 : 0) && q.col === col) return k;
    }
    return null;
  }
  // 그림 액자에 담는 그림은 칸 글자열 — 16×16 이라 256글자여야 한다
  /* 액자에 담는 도트 그림. 일기의 그림판은 16칸이고 도트 그리기(draw.html)는 16·24·32칸을
     고를 수 있다 — 담는 방식은 셋 다 같다(빈 칸은 '.', 나머지는 색 번호 36진수 한 글자).
     그래서 한 변이 16·24·32 인 것만 받는다. */
  const PIC_N = [16, 24, 32];
  function picSide(pic){
    if (typeof pic !== 'string' || !/^[.0-9a-z]*$/.test(pic)) return 0;
    const n = PIC_N.find(k => k * k === pic.length);
    return n || 0;
  }
  function okPic(pic){ return picSide(pic) > 0; }
  // 돌리면 가로세로가 바뀐다. 두 칸짜리 침대가 세로로 눕는다.
  function furnBox(f, r){
    const F = FURNITURE[f]; if (!F) return { w: 1, h: 1 };
    const w = F.w || 1, h = F.h || 1;
    return ((r || 0) % 2) ? { w: h, h: w } : { w, h };
  }
  function occupied(world, room, x, y){
    const P = placed(world, room);
    for (const k in P){
      const parts = k.split(',').map(Number), px = parts[0], py = parts[1];
      const b = furnBox(P[k].f, P[k].r);
      if (x >= px && x < px + b.w && y >= py && y < py + b.h) return k;
    }
    return null;
  }
  const COZY_LEVELS = [0, 8, 20, 40, 70, 110];

  // ---------- 요리 ----------
  const DISHES = {
    salad:   { name: '감자 샐러드',   need: { 'crop:potato': 2, 'crop:cabbage': 1 }, sell: 260, food: 8,  lv: 1 },
    jam:     { name: '딸기잼',        need: { 'crop:strawberry': 3 },                   sell: 150, food: 6,  lv: 1 },
    soup:    { name: '옥수수 스프',   need: { 'crop:corn': 2, 'milk': 1 },              sell: 200, food: 10, lv: 2 },
    pasta:   { name: '토마토 파스타', need: { 'crop:tomato': 3, 'crop:pepper': 1 },     sell: 180, food: 9,  lv: 2 },
    pie:     { name: '호박 파이',     need: { 'crop:pumpkin': 1, 'egg': 1, 'milk': 1 }, sell: 520, food: 14, lv: 3 },
    cookie:  { name: '꿀 쿠키',       need: { 'honey': 1, 'egg': 2 },                   sell: 230, food: 8,  lv: 2 },
    juice:   { name: '포도 주스',     need: { 'crop:grape': 3 },                        sell: 190, food: 7,  lv: 2 },
    kimchi:  { name: '김치',          need: { 'crop:napa': 1, 'crop:pepper': 2, 'crop:radish': 1 }, sell: 480, food: 12, lv: 3 },
    omelet:  { name: '오리알 오믈렛', need: { 'duckegg': 2, 'milk': 1 },              sell: 330, food: 11, lv: 2 },
    risotto: { name: '송로 리조또',  need: { 'truffle': 1, 'milk': 1, 'crop:onion': 1 }, sell: 760, food: 16, lv: 3 },
    stew:    { name: '매운탕',      need: { 'fish:crucian': 1, 'crop:radish': 1, 'crop:pepper': 1 }, sell: 430, food: 13, lv: 2 },
    sushi:   { name: '연어초밥',    need: { 'fish:trout': 1, 'crop:cucumber': 1 },                sell: 640, food: 15, lv: 3 },
    // 낚이는 물고기마다 쓰일 데가 하나씩 — 잉어·장어·메기는 그동안 팔 수만 있었다
    shrimprice: { name: '새우볶음밥', need: { 'fish:shrimp': 2, 'crop:onion': 1, 'egg': 1 },   sell: 380, food: 12, lv: 2 },
    ayu:     { name: '은어 소금구이', need: { 'fish:sweetfish': 2 },                             sell: 400, food: 11, lv: 2 },
    crayfish:{ name: '가재찜',       need: { 'fish:crayfish': 2, 'crop:pepper': 1 },            sell: 360, food: 10, lv: 2 },
    carpsteam:{ name: '잉어찜',      need: { 'fish:carp': 1, 'crop:radish': 1, 'crop:pepper': 1 }, sell: 400, food: 12, lv: 3 },
    smeltfry:{ name: '빙어튀김',     need: { 'fish:smelt': 3, 'egg': 1 },                       sell: 450, food: 12, lv: 3 },
    catstew: { name: '메기 매운탕',  need: { 'fish:catfish': 1, 'crop:radish': 1, 'crop:pepper': 2 }, sell: 520, food: 14, lv: 3 },
    eelbowl: { name: '장어덮밥',     need: { 'fish:eel': 1, 'egg': 1 },                         sell: 560, food: 15, lv: 3 },
    pufferstew:{ name: '복어탕',     need: { 'fish:puffer': 1, 'crop:radish': 1, 'crop:onion': 1 }, sell: 900, food: 17, lv: 4 },
    pickle:  { name: '오이지',       need: { 'crop:cucumber': 3, 'crop:pepper': 1 },   sell: 210, food: 7,  lv: 1 },
    starpie: { name: '별열매 파이',   need: { 'crop:star': 1, 'egg': 1, 'milk': 1 },    sell: 1200, food: 20, lv: 4 },
  };


  // ---------- 축제 (계절 마지막 날) ----------
  // 둘의 점수를 합쳐서 문턱을 넘으면 둘 다 상을 받는다.
  const FESTIVALS = {
    spring: { name: '꽃 축제',     icon: '🌷', want: 'flower',  n: 6,  desc: '꽃을 여섯 송이 모아 와요.' },
    summer: { name: '수박 대회',   icon: '🍉', want: 'crop:watermelon', n: 3, desc: '수박 세 통. 큰 수박은 셋으로 쳐요.' },
    autumn: { name: '추수 잔치',   icon: '🌾', want: 'value',   n: 600, desc: '작물을 600 동전어치 내놓아요.' },
    winter: { name: '눈사람 축제', icon: '⛄', want: 'snowball', n: 4,  desc: '눈덩이 네 개. 하루에 하나씩만 나와요.' },
  };

  // ---------- 도감 훈장 ----------
  /* 도감을 채우는 것 말고도 「해 본 일」에 훈장을 준다. 조건이 차면 받을 수 있고,
     받을 때 동전과 경험치를 준다 — 도감이 목록이 아니라 발자국이 되도록. */
  const at = id => FARMS.findIndex(f => f.id === id);   // 도장 — 농장 번호는 표 차례라 이름으로 찾는다(2026-10-09 농장 셋이 끼어들어 번호가 밀렸다)
  const MEDALS = [
    { id: 'seedling', col: '#8fd66c', name: '첫 삽',       icon: '🌱', desc: '작물 다섯 가지를 거둬요',       coins: 100,  need: (w, m) => cropsInDex(m) >= 5 },
    { id: 'farmer', col: '#e8c46a',   name: '밭의 주인',   icon: '🌾', desc: '작물 절반을 거둬요',           coins: 400,  need: (w, m) => cropsInDex(m) >= Math.ceil(DEX_CROP_IDS.length / 2) },
    { id: 'master', col: '#ffd25a',   name: '온 밭 도감',  icon: '🏅', desc: '작물을 모두 거둬요',           coins: 1500, need: (w, m) => cropsInDex(m) >= DEX_CROP_IDS.length },
    { id: 'shiny', col: '#fff0a8',    name: '반짝반짝',    icon: '✨', desc: '반짝 작물 다섯 가지를 거둬요', coins: 500,  need: (w, m) => m.dex.filter(k => k.slice(0, 5) === 'gold:').length >= 5 },
    { id: 'angler', col: '#6fb3e0',   name: '연못 지기',   icon: '🎣', desc: '물고기를 모두 낚아요',         coins: 800,  need: (w, m) => FISH_IDS.every(f => FISH[f].sea || FISH[f].ice || m.dex.indexOf('fish:' + f) >= 0) },   // 바닷물고기·얼음 물고기는 연못 지기에 안 든다
    { id: 'cook', col: '#ff9a2e',     name: '부엌 대장',   icon: '🍳', desc: '요리를 모두 만들어요',         coins: 900,  need: (w, m) => Object.keys(DISHES).every(d => m.dex.indexOf('dish:' + d) >= 0) },
    { id: 'giant', col: '#e8892f',    name: '둘이서 번쩍', icon: '🎃', desc: '큰 작물을 뽑아요',             coins: 300,  need: (w, m) => m.dex.some(k => k.slice(0, 6) === 'giant:') },
    { id: 'bestie', col: '#ff7f8a',   name: '마음이 가득', icon: '💗', desc: '동물의 마음을 10까지 채워요',  coins: 400,  need: (w) => (w.animals || []).some(a => (a.love || 0) >= 10) },
    { id: 'cradle', col: '#ffe066',   name: '새끼를 봤어요', icon: '🐣', desc: '동물이 새끼를 낳아요',       coins: 500,  need: (w) => (w.animals || []).some(a => a.mom) },
    { id: 'night', col: '#9bea6e',    name: '반딧불이 밤', icon: '🌟', desc: '반딧불이를 스무 마리 잡아요',  coins: 300,  need: (w, m) => ((m.stats || {}).caught || 0) >= 20 },
    { id: 'party', col: '#c9a24a',    name: '축제의 별',   icon: '🏆', desc: '축제에서 상을 받아요',         coins: 600,  need: (w) => Object.keys(w.festival || {}).some(k => w.festival[k].done) },
    { id: 'hundred', col: '#a9c4d6',  name: '백 날의 농부', icon: '📅', desc: '농장에 백 날 와요',           coins: 1000, need: (w, m) => (m.playDays || []).length >= 100 },
    // 농장 여권 — 이사할 때마다 도장 하나, 넷을 다 모으면 큰 선물(2026-09-30 로키즈 「이사 보상」)
    { id: 'stampSea', col: '#5fb3e8',   name: '바닷가 도장', icon: '🌊', desc: '바닷가 농장으로 이사 가요',   coins: 300,  need: (w) => (w.farm || 0) >= at('seaside') },
    { id: 'stampCloud', col: '#f2b8d8', name: '꽃구름 도장', icon: '☁️', desc: '꽃구름 농장으로 이사 가요',   coins: 800,  need: (w) => (w.farm || 0) >= at('cloud') },
    // 스테이지2 첫 도장(2026-10-09). 여권(첫 세 농장 — 화산은 건너뜀)은 그대로 — 스테이지2 여권은 다섯 농장을 다 열면 만든다
    { id: 'stampAurora', col: '#8fe6c8', name: '오로라 도장', icon: '🌌', desc: '스테이지2 — 오로라 농장으로 이사 가요', coins: 1000, need: (w) => (w.farm || 0) >= at('aurora') },
    { id: 'stampMaple', col: '#e8702a', name: '단풍 도장', icon: '🍁', desc: '스테이지2 — 단풍 농장으로 이사 가요', coins: 1000, need: (w) => (w.farm || 0) >= at('maple') },
    { id: 'stampJungle', col: '#3aa860', name: '밀림 도장', icon: '🦜', desc: '스테이지2 — 밀림 농장으로 이사 가요', coins: 1100, need: (w) => (w.farm || 0) >= at('jungle') },
    { id: 'stampSavanna', col: '#e8b040', name: '사바나 도장', icon: '🦒', desc: '스테이지2 — 사바나 농장으로 이사 가요', coins: 1100, need: (w) => (w.farm || 0) >= at('savanna') },
    { id: 'stampDesert', col: '#f2b860', name: '오아시스 도장', icon: '🐪', desc: '스테이지2 — 오아시스 농장으로 이사 가요', coins: 1200, need: (w) => (w.farm || 0) >= at('desert') },
    // 농장 도감 — 그 농장 특산물을 모두 모으면(2026-10-09). 이름이 곧 칭호
    { id: 'dexSea', col: '#5fb3e8',    name: '바다 박사',    icon: '🐚', desc: '바닷가 특산물 — 고등어·오징어·광어·참돔·무화과를 모두 모아요', coins: 800,  gift: { id: 'f:amphora', n: 1 }, need: (w, m) => SPECIALS.seaside.every(i => m.dex.indexOf(dexId(i)) >= 0) },
    { id: 'dexAurora', col: '#8fe6c8', name: '오로라 박사',  icon: '🧭', desc: '오로라 특산물 — 클라우드베리·빛 조각·이끼·솔방울·대구·곤들매기를 모두 모아요', coins: 1500, gift: { id: 'f:advent', n: 1 }, need: (w, m) => SPECIALS.aurora.every(i => m.dex.indexOf(dexId(i)) >= 0) },
    { id: 'dexDesert', col: '#f2b860', name: '오아시스 박사', icon: '📜', desc: '오아시스 특산물 — 용과·대추야자·사막 장미 돌을 모두 모아요', coins: 1500, gift: { id: 'f:mlamp', n: 1 }, need: (w, m) => SPECIALS.desert.every(i => m.dex.indexOf(dexId(i)) >= 0) },
    { id: 'dexMaple', col: '#e8702a',  name: '단풍 박사',    icon: '🍁', desc: '단풍 특산물 — 크랜베리·메이플 시럽·밤·도토리를 모두 모아요', coins: 1500, gift: { id: 'f:leaflamp', n: 1 }, need: (w, m) => SPECIALS.maple.every(i => m.dex.indexOf(dexId(i)) >= 0) },
    { id: 'dexJungle', col: '#3aa860', name: '밀림 박사',    icon: '🦜', desc: '밀림 특산물 — 카카오·망고·바나나·앵무새 깃털을 모두 모아요', coins: 1500, gift: { id: 'f:parrotlamp', n: 1 }, need: (w, m) => SPECIALS.jungle.every(i => m.dex.indexOf(dexId(i)) >= 0) },
    { id: 'dexSavanna', col: '#e8b040', name: '사바나 박사', icon: '🦒', desc: '사바나 특산물 — 뿔멜론·바오밥 열매를 모두 모아요', coins: 1500, gift: { id: 'f:beadlamp', n: 1 }, need: (w, m) => SPECIALS.savanna.every(i => m.dex.indexOf(dexId(i)) >= 0) },
    // 메인 목표 「수아연아의 방주」(2026-10-09)
    { id: 'stampArk', col: '#a0784e',  name: '방주 도장',     icon: '🛶', desc: '방주 농장으로 이사 가요', coins: 1500, need: (w) => (w.farm || 0) >= arkFarmIndex() },
    { id: 'arkPairs', col: '#e8a060',  name: '노아의 명부',   icon: '📜', desc: '동물 스무 가지를 모두 한 쌍씩 모아요', coins: 2500, gift: { id: 'seed:star', n: 3 }, need: (w) => arkPairsHave(w) >= ARK_KINDS.length },
    { id: 'arkSeeds', col: '#8fd66c',  name: '씨앗 지기',     icon: '🌰', desc: '방주 씨앗 금고에 모든 작물 씨앗을 한 알씩 넣어요', coins: 2000, need: (w) => arkSeedsHave(w) >= CROP_IDS.length },
    { id: 'arkBuilt', col: '#7a5a3a',  name: '방주 목수',     icon: '🔨', desc: '방주를 열 단계 모두 지어요', coins: 3000, need: (w) => arkStep(w) >= ARK_STEPS.length },
    { id: 'flood',    col: '#5f86c8',  name: '큰물을 건넜어요', icon: '🕊️', desc: '방주에서 한 해를 버티고 새 땅에 내려요', coins: 5000, gift: { id: 'olive', n: 6 }, need: (w) => arkPhase(w) === 'land' },
    { id: 'arkCards', col: '#c8a060',  name: '노아 이야기',   icon: '📖', desc: '방주 안에서 노아 이야기 카드 열네 장을 모두 모아요', coins: 1500, need: (w) => arkCardsHave(w) >= ARK_LOG.length },
    { id: 'arkGarden', col: '#6ab04a', name: '금고 정원지기', icon: '🌱', desc: '씨앗 금고에서 나온 작물을 무지개 농장에서 하나씩 모두 거둬요', coins: 2000, need: (w) => arkGardenDone(w) },
    { id: 'rainbow',  col: '#ff8fb8',  name: '무지개 언약',   icon: '🌈', desc: '무지개 농장의 새 마을을 모두 지어요', coins: 8000, need: (w) => landDone(w) >= LAND_STEPS.length },
    { id: 'passport', col: '#ffd25a',   name: '세 농장 여권', icon: '🗺️', desc: '이사 도장 둘을 모두 받아요', coins: 3000, gift: { id: 'seed:star', n: 5 },
      need: (w, m) => ['stampSea', 'stampCloud'].every(k => (m.medals || []).indexOf(k) >= 0) },
  ];
  function cropsInDex(mine){
    return DEX_CROP_IDS.filter(c => mine.dex.indexOf(c) >= 0).length;
  }

  // ---------- 돌아다니는 행상인 ----------
  /* 이레에 두 번쯤 수레를 끌고 온다. 가게에 없는 것만 판다 —
     별열매 씨앗, 비료 묶음, 싸게 나온 스프링클러, 값을 깎은 가구, 그리고 수수께끼 보따리.
     세 자리는 날짜로 정해지므로 둘이 같은 날 보는 물건이 같다. */
  const PEDDLER = { x: 16, y: 8, w: 2, h: 1, chance: 0.3 };
  function peddlerHere(world, now){ return prand('pd' + dayKey(now)) < PEDDLER.chance; }
  /* 수레 자리는 농장마다 다르다 — 바닷가에서 (16,8)은 오른쪽 아래 흰 집에 가려 휴대폰에서 누르기 어려웠다.
     아래쪽 가운데 즈음 빈 칸으로 옮겼다(2026-10-05 로키즈). 들판은 원래 자리. */
  /* 꾸미개는 이 자리에도 옮겨 놓을 수 있다 — 2026-10-08 모래놀이터를 옮겨 두자 수레가 그 위에 겹쳐 섰다.
     자리를 막아 두면 행상인이 안 오는 날에도 못 쓰니, 막힌 날엔 가장 가까운 빈자리(수레+행상인, 가로 w+1 칸)로 비켜 선다. */
  function peddlerSpot(world){
    const P = Object.assign({}, PEDDLER, farmOf(world).peddler);
    if (!world) return P;
    const G = gridOf(world), w = P.w + 1, hit = (b, x, y) => x < b.x + b.w && b.x < x + w && y < b.y + b.h && b.y <= y;
    const things = PLACE_IDS.filter(id => thingHere(world, id)).map(id => spotOf(world, id))
      .concat(Object.keys(NODES).map(n => Object.assign({ w: 1, h: 1 }, nodeSpot(world, n))), sceneryOf(world).map(c => ({ x: c.x, y: c.y, w: 1, h: 1 })));
    const free = (x, y) => {
      if (x < 0 || y < 0 || x + w > G.w || y >= G.h) return false;
      for (let i = 0; i < w; i++) if (fieldHas(world, x + i, y)) return false;
      return !things.some(b => hit(b, x, y));
    };
    for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(P.x + dx, P.y + dy)) return Object.assign(P, { x: P.x + dx, y: P.y + dy });
    }
    return P;
  }
  /* 오늘 그가 두 배로 쳐 주는 물건 하나. 열 개까지만 사 간다 —
     끝없이 사 주면 「모아 뒀다가 오는 날 판다」가 아니라 그냥 돈 나오는 구멍이 된다.
     날짜로 정해지므로 둘이 같은 물건을 본다. */
  const PED_WANT_MULT = 2, PED_WANT_MAX = 10;
  // 수수께끼 보따리 — 무엇이 나와도 300냥어치는 넘는다. 아이가 하는 놀이라 꽝은 두지 않았다.
  const BOX_PRIZES = [
    { id: 'seed:star', n: 1, say: '<b>별열매 씨앗</b>' },
    { id: 'gem',       n: 1, say: '<b>반짝돌</b>' },
    { id: 'fert',      n: 10, say: '비료 열 장' },
    { id: 'honey',     n: 4, say: '꿀 네 통' },
    { id: 'coins',     n: 420, say: '<b>420 동전</b>' },
    { id: 'goldmilk',  n: 3, say: '금빛 우유 셋' },
  ];

  // ---------- 밤에만 있는 것 ----------
  /* 반딧불이는 여름과 가을 밤에만 난다. 기운은 안 든다 — 잡는 재미가 상이고,
     하루에 여섯 마리까지만 잡히니 밤마다 조금씩 모으는 일이 된다. */
  const FIREFLY_MAX = 6;
  const FIREFLY_SEASONS = ['summer', 'autumn'];
  function fireflyNight(world, now){
    return isNight(now) && FIREFLY_SEASONS.indexOf(calendar(world, now).season) >= 0;
  }
  function fireflyLeft(mine, now){
    const key = dayKey(now);
    return mine.ffDay === key ? Math.max(0, FIREFLY_MAX - (mine.ffGot || 0)) : FIREFLY_MAX;
  }
  /* 오로라 빛 조각(2026-10-09) — 오로라 농장의 밤에만 빈 땅 몇 군데에 떨어져 있다. 손으로 누르면 줍는다.
     자리는 그날 날짜로 정해져 두 아이가 같은 자리를 보고, 줍는 몫은 각자다(반딧불이처럼).
     손님 화면도 그리므로 자리 셈은 이 파일에 둔다. 줍기는 farm-rules-play.js 의 pickShard. */
  const SHARD_MAX = 4;
  const shardMax = world => SHARD_MAX * (perkOf(world) === 'shard' ? 2 : 1);   // 오로라 능력 「긴 밤」
  // 농장마다 줍는 것 — 오로라는 밤의 빛 조각, 사막은 낮 모래 위의 사막 장미 돌(2026-10-09). 셈·그림 자리는 같은 틀
  // 방주 농장은 낮 땅의 역청 덩어리, 무지개 농장은 낮 땅에 떨어진 올리브(2026-10-09)
  // 단풍은 낮에 단풍나무 수액 양동이(메이플 시럽), 밀림은 떨어진 망고, 사바나는 바오밥 열매(2026-10-09)
  const PICKS = { aurora: { item: 'shard', night: true }, maple: { item: 'syrup', night: false }, jungle: { item: 'mango', night: false }, savanna: { item: 'baobab', night: false },
    desert: { item: 'sandrose', night: false }, ark: { item: 'pitch', night: false }, newland: { item: 'olive', night: false } };
  function shardSpots(world, now){
    const PK = world && PICKS[farmOf(world).id];
    if (!PK || isNight(now) !== PK.night) return [];
    const G = gridOf(world), key = dayKey(now), out = [];
    const things = PLACE_IDS.filter(id => thingHere(world, id)).map(id => spotOf(world, id))
      .concat(Object.keys(NODES).map(n => Object.assign({ w: 1, h: 1 }, nodeSpot(world, n))), sceneryOf(world).map(c => ({ x: c.x, y: c.y, w: 1, h: 1 })));
    const busy = (x, y) => fieldHas(world, x, y) || things.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || out.some(q => q.x === x && q.y === y);
    // ponytail: 빈 칸을 날짜 주사위로 60번까지 던져 본다 — 섬이 꽉 차 빈 칸이 거의 없으면 넷이 안 될 수 있다
    const max = shardMax(world);
    for (let k = 0; k < 60 && out.length < max; k++){
      const x = Math.floor(prand('shx' + key + k) * G.w), y = 1 + Math.floor(prand('shy' + key + k) * (G.h - 2));   // 맨 윗줄·맨 아랫줄은 섬 끝이라 뺀다
      if (!busy(x, y)) out.push({ i: out.length, x, y });
    }
    return out;
  }
  // 아직 안 주운 조각 — mine 이 없으면(손님) 다 보인다
  function shardsLeft(world, mine, now){
    const got = mine && mine.shard && mine.shard.day === dayKey(now) ? mine.shard.got || [] : [];
    return shardSpots(world, now).filter(q => got.indexOf(q.i) < 0);
  }
  /* 산타 우체통(2026-10-09) — 놓여 있으면 사흘에 한 번꼴로 아침 우편함에 산타 할아버지 편지와 작은 선물이 온다(newDay). */
  const SANTA_CHANCE = 0.34;
  const SANTA_GIFTS = [
    { id: 'coins', n: 200 },
    { id: 'seed:cloudberry', n: 2 },
    { id: 'shard', n: 1 },
    { id: 'coins', n: 120 },
  ];
  /* 요술 램프(사막, 2026-10-09) — 산타 우체통과 같은 틀. 놓여 있으면 사흘에 한 번꼴로 램프 요정 편지와 작은 선물 */
  const GENIE_GIFTS = [
    { id: 'coins', n: 200 },
    { id: 'seed:dragonfruit', n: 2 },
    { id: 'sandrose', n: 1 },
    { id: 'date', n: 3 },
  ];
  // ---------- 메인 목표: 수아연아의 방주 (2026-10-09 로키즈) ----------
  /* 농장을 옮겨 다니며 모은 동물(암수 한 쌍씩)과 씨앗(한 알씩)을 방주에 싣고 대홍수를 건너 새 땅에 닿는다.
     world.ark = {
       seeds: [작물…]           씨앗 금고 — 어느 농장에서나 넣는다
       step: 0~10               방주 농장에서 다 지은 단계 수. paid: { sua, yona } 는 지금 단계에 낸 사람
       on: [날짜…]              단계마다 다 지은 날
       food: 수, by: {sua, yona} 양식 창고(점수)와 각자 넣은 몫
       phase: undefined | 'flood' | 'land'
       ask: { by }              입장하자고 먼저 누른 아이(둘 다 눌러야 들어간다)
       boardOn, month: 0~37, monthDay  대홍수 — 하루에 한 번 「열흘 보내기」. month 는 보낸 열흘의 수(이름은 세이브 때문에 그대로)
       land: { 이름: { paid, done, on } } 무지개 농장에서 짓는 것
     }
     아이가 하는 놀이라 실패는 없다 — 양식이 모자라면 열흘이 안 넘어갈 뿐, 줍고 낚아 채우면 다시 간다. */
  const ARK_STEPS = [
    { id: 'ground', name: '터 다지기',          icon: '⛏️', each: { stone: 20, coins: 300 }, say: '방주를 앉힐 땅을 평평하게 다지고 받침돌을 줄지어 놓았어요' },
    { id: 'keel',   name: '용골 놓기',          icon: '🪵', each: { wood: 40 },              say: '배의 등뼈 — 길고 굵은 잣나무 용골을 받침돌 위에 눕혔어요' },
    { id: 'ribs',   name: '갈빗대 세우기',      icon: '🦴', each: { wood: 45 },              say: '용골에서 갈빗대가 솟아 배 모양이 보이기 시작했어요' },
    { id: 'hull1',  name: '아래층 짓기',        icon: '🧱', each: { wood: 45, stone: 10 },   say: '아래층에 판자를 붙였어요 — 큰 동물들이 지낼 층이에요' },
    { id: 'hull2',  name: '가운데층과 칸 나누기', icon: '🚪', each: { wood: 45, coins: 800 }, say: '가운데층을 올리고 동물마다 칸을 나눴어요 (창세기 6:14)' },
    { id: 'hull3',  name: '위층 짓기',          icon: '🏠', each: { wood: 45 },              say: '위층까지 올렸어요 — 우리 식구가 지낼 층이에요 (6:16)' },
    { id: 'pitch',  name: '역청 칠하기',        icon: '🖌️', each: { pitch: 12 },             say: '안팎에 까만 역청을 칠해 물 한 방울 새지 않게 했어요 (6:14)' },
    { id: 'roof',   name: '지붕과 창 내기',     icon: '🪟', each: { wood: 35, coins: 1000 }, say: '지붕을 덮고 위로 한 규빗 창을 냈어요 (6:16)' },
    { id: 'door',   name: '옆문 달기',          icon: '🚪', each: { wood: 25, stone: 15, pitch: 6 }, say: '옆구리에 큰 문과 오르막 다리를 달았어요 (6:16)' },
    { id: 'store',  name: '양식 싣기',          icon: '🌾', each: {},                        say: '양식 창고를 가득 채웠어요 — 방주가 다 지어졌어요! (6:21)' },
  ];
  const ARK_FOOD_MIN = 200;            // 마지막 단계 「양식 싣기」에 필요한 창고 점수
  /* 방주 안 시간 — 진짜 하루에 열흘씩(2026-10-09 로키즈 「하루를 한 달로 하면 너무 짧다, 열흘로」).
     창세기대로 600세 2월 17일에 들어가 601세 2월 27일에 나온다 — 한 해와 열흘, 한 달 30일로 370일, 37번. */
  const ARK_SPAN = 10;                 // 「열흘 보내기」 한 번에 지나는 날
  const ARK_DAYS = 370;                // 방주 안에서 지내는 날 수(창 7:11 → 8:14)
  const ARK_TURNS = Math.ceil(ARK_DAYS / ARK_SPAN);   // 37 — 진짜 날로 37일
  const ARK_RATION = 1;                // 열흘에 두 아이가 먹는 양식 — 여기에 동물 여섯 마리마다 1 씩(한 달 4+두 마리마다 1 이던 것과 한 해 합이 비슷하게)
  // 창고에 넣을 때의 양식 점수 — 먹으면 기운이 도는 것(foodOf)에 더해 동물이 낳은 것
  const ARK_GOODS_FOOD = { egg: 2, bigegg: 4, duckegg: 2, milk: 3, goldmilk: 6, honey: 4, truffle: 5 };
  /* 방주 안 이야기 — 창세기 7~8장, 들어간 날(2월 17일)부터 센 날(day). 「열흘 보내기」로 그 날을 지나면 한 줄씩.
     날짜는 한 달을 30일로 셌다: 7월 17일 = 150일, 10월 1일 = 224일, 이듬해 1월 1일 = 314일, 2월 27일 = 370일 */
  const ARK_LOG = [
    { day: 1,   icon: '🌧️', text: '하늘의 창이 열리고 큰비가 쏟아졌어요. 방주가 물 위로 둥실 떠올랐어요', ref: '7:11-17' },
    { day: 20,  icon: '🌊', text: '물이 높은 산들까지 다 덮었어요. 방주만 물 위를 떠다녀요', ref: '7:19-20' },
    { day: 40,  icon: '⛈️', text: '사십 일 밤낮 내리던 비가 그쳤어요. 온 세상이 바다예요', ref: '7:12' },
    { day: 100, icon: '🛶', text: '물이 백오십 일 동안 땅을 덮어요. 동물들과 꼭 붙어 서로 돌봐요', ref: '7:24' },
    { day: 150, icon: '🌬️', text: '하나님이 방주 안의 모두를 기억하시고 바람을 보내셨어요. 깊은 샘과 하늘의 창이 닫혔어요', ref: '8:1-3' },
    { day: 150, icon: '⛰️', text: '일곱째 달 열이렛날, 방주가 아라랏 산 위에 머물렀어요', ref: '8:4' },
    { day: 180, icon: '🌤️', text: '물이 날마다 조금씩 줄어요. 창밖이 환해졌어요', ref: '8:5' },
    { day: 224, icon: '🏔️', text: '열째 달 초하루, 산봉우리들이 물 위로 보이기 시작했어요', ref: '8:5' },
    { day: 264, icon: '🐦', text: '사십 일 뒤 창문을 열고 까마귀를 내보냈어요. 까마귀는 물이 마를 때까지 오락가락했어요', ref: '8:6-7' },
    { day: 271, icon: '🕊️', text: '비둘기를 내보냈지만 앉을 곳이 없어 돌아왔어요', ref: '8:8-9' },
    { day: 278, icon: '🕊️', text: '이레 뒤 다시 보낸 비둘기가 올리브 새잎을 물고 돌아왔어요!', ref: '8:10-11' },
    { day: 285, icon: '🕊️', text: '또 이레 뒤 보낸 비둘기는 돌아오지 않았어요. 물이 거의 다 빠졌어요', ref: '8:12' },
    { day: 314, icon: '☀️', text: '새해 첫날, 방주 뚜껑을 열고 보니 땅 위에 물이 걷혔어요', ref: '8:13' },
    { day: 370, icon: '🌈', text: '둘째 달 스무이렛날, 땅이 다 말랐어요. 이제 모두 방주에서 나가요!', ref: '8:14-19' },
  ];
  const arkDay = n => Math.min(ARK_DAYS, Math.max(0, n) * ARK_SPAN);   // n 번 보낸 뒤 며칠째인가
  /* 항해 날씨(2026-10-09 로키즈 「방주 더하기 11가지」) — 열흘마다 하나, prand 로 정해진다(n = 보내는 중인 열흘의 차례).
     큰 파도: 그 열흘을 넘긴 다음 아침엔 동물이 놀라 아무것도 안 남긴다 · 잔잔함: 창밖 낚시에서 좋은 물고기가 두 배로 잘 문다 ·
     안개: 다음 이야기 날짜가 「?」. 아라랏 산에 얹힌 뒤(150일~)는 큰 파도가 없다 */
  const ARK_SEA = { calm: { icon: '☀️', name: '잔잔한 바다' }, fog: { icon: '🌫️', name: '짙은 안개' }, wave: { icon: '🌊', name: '큰 파도' } };
  function arkSea(world, n){
    const A = world && world.ark, r = prand('arksea' + ((A && A.boardOn) || '') + ':' + n);
    const w = r < 0.5 ? 'calm' : r < 0.75 ? 'fog' : 'wave';
    return w === 'wave' && arkDay(n) >= 150 ? 'calm' : w;
  }
  /* 양식 창고 칸(2026-10-09) — 넣은 것을 네 칸에 나눠 적기만 한다. 먹는 것은 그대로 총점(food)에서.
     네 칸이 모두 ARK_BIN_MIN 넘게 차면 「골고루 실었어요」 — 열흘 양식이 1 준다(1 밑으로는 안 내려간다) */
  const ARK_BINS = { grain: { icon: '🌾', name: '곡식' }, hay: { icon: '🌿', name: '풀' }, fish: { icon: '🐟', name: '물고기' }, animal: { icon: '🥚', name: '낳은 것' } };
  const ARK_BIN_MIN = 20;
  const ARK_HAY = ['cabbage', 'napa', 'spinach', 'lettuce', 'kale', 'corn', 'carrot', 'tea'];   // 풀 칸 — 잎채소·옥수수·당근(동물 먹이 풀)
  const arkBinOf = id => { const [k, c] = String(id).split(':'); if (k === 'fish') return 'fish'; if (ARK_GOODS_FOOD[id]) return 'animal'; if (c && ARK_HAY.indexOf(c) >= 0 && k !== 'dish') return 'hay'; return 'grain'; };
  const arkEven = world => { const S = (world && world.ark && world.ark.store) || {}; return Object.keys(ARK_BINS).every(b => (S[b] || 0) >= ARK_BIN_MIN); };
  const ARK_CABIN_MAX = 4;             // 가족 방(위층)에 싣는 가구 수
  // 노아 이야기 카드(ARK_LOG 열네 장, 150일은 두 장) · 금고 정원(금고 작물을 무지개 농장에서 한 번씩 거둠)
  const arkCardsHave = world => { const c = (world && world.ark && world.ark.cards) || []; return ARK_LOG.filter(L => c.indexOf(L.day) >= 0).length; };
  const arkGardenHave = world => { const A = (world && world.ark) || {}, g = A.garden || []; return (A.seeds || []).filter(c => g.indexOf(c) >= 0).length; };
  const arkGardenDone = world => { const A = (world && world.ark) || {}; return arkPhase(world) === 'land' && (A.seeds || []).length > 0 && arkGardenHave(world) >= A.seeds.length; };
  const arkNews = n => n > 0 ? ARK_LOG.filter(L => L.day > arkDay(n - 1) && L.day <= arkDay(n)) : [];   // n 번째 열흘에 일어난 일
  /* 무지개 농장에서 둘이 차례로 짓는 것 — 하나를 다 지어야 다음이 열린다. 다 지으면 진짜 마지막 농장이 완성 */
  const LAND_STEPS = [
    { id: 'altar',       icon: '🪨', each: { stone: 15 },                    say: '방주에서 내려 맨 먼저 돌을 쌓아 감사의 제단을 만들었어요 (8:20)' },
    { id: 'rainbowhill', icon: '🌈', each: { coins: 600, wood: 10 },         say: '다시는 물로 땅을 덮지 않겠다는 무지개 약속을 기억하는 꽃 언덕 (9:13)' },
    { id: 'vineyard',    icon: '🍇', each: { wood: 20, coins: 500 },         say: '노아처럼 새 땅에 처음으로 포도나무를 심었어요 (9:20)' },
    { id: 'dovecote',    icon: '🕊️', each: { wood: 15, olive: 3 },           say: '올리브 잎을 물어 온 비둘기 가족이 사는 집' },
    { id: 'olivegrove',  icon: '🫒', each: { olive: 6, coins: 800 },         say: '비둘기가 물어 온 올리브 가지를 심어 동산을 만들었어요' },
    { id: 'wellsquare',  icon: '⛲', each: { stone: 30, wood: 20, coins: 1500 }, say: '새 땅의 첫 마을 우물 광장 — 무지개 농장이 완성됐어요!' },
  ];
  const arkFarmIndex = () => FARMS.findIndex(f => f.id === 'ark');
  // 방주 명부 — 동물은 가짓수마다 지금 농장에 몇 마리(둘이면 한 쌍), 씨앗은 금고에 든 작물
  const ARK_KINDS = Object.keys(ANIMALS);
  const arkCount = (world, kind) => ((world && world.animals) || []).filter(a => a && a.kind === kind).length;
  const arkPairsHave = world => ARK_KINDS.filter(k => arkCount(world, k) >= 2).length;
  /* 그 농장에서만 얻는 것(2026-10-09 로키즈 「각 농장에서만 얻을 수 있는 동식물」「이주 조건에 그 농장 것이 갖춰졌는지」)
     동물 — 이삿날 따라온 식구(gift)와 그 농장 가게에서만 파는 동물(farm). 한 마리씩은 데리고 있어야 떠난다(짝은 방주 농장에서 찾아온다)
     씨앗 — 그 농장 전용 작물. 방주 씨앗 금고에 넣어야 떠난다(가방의 씨앗 한 알)
     특산물 — SPECIALS 가운데 작물 아닌 것. 둘 중 하나라도 한 번 만나면 된다(world.found, 옛 기록은 제 도감) */
  function localOf(fid){
    return { animals: Object.keys(ANIMALS).filter(k => ANIMALS[k].gift === fid || ANIMALS[k].farm === fid),
      crops: CROP_IDS.filter(c => CROPS[c].farm === fid),
      goods: (SPECIALS[fid] || []).filter(id => id.slice(0, 5) !== 'crop:') };
  }
  // 도감 이름(작물은 앞머리 없이) → 특산물 이름(crop:…)
  const specKey = id => CROPS[id] ? 'crop:' + id : String(id).replace(/^(gold|giant):/, 'crop:');
  function localState(world, mine, fid){
    const L = localOf(fid || farmOf(world).id), seeds = (world && world.ark && world.ark.seeds) || [], found = (world && world.found) || [], dex = (mine && mine.dex) || [];
    const has = id => found.indexOf(id) >= 0 || dex.indexOf(dexId(id)) >= 0;
    return { animals: L.animals.map(k => ({ id: k, have: arkCount(world, k) > 0 })),
      crops: L.crops.map(c => ({ id: c, have: seeds.indexOf(c) >= 0 })),
      goods: L.goods.map(g => ({ id: g, have: has(g) })) };
  }
  const arkSeedsHave = world => ((world && world.ark && world.ark.seeds) || []).filter(c => CROPS[c]).length;
  const arkStep = world => Math.max(0, Math.min(ARK_STEPS.length, Math.floor(Number(world && world.ark && world.ark.step) || 0)));
  const landDone = world => LAND_STEPS.filter(L => world && world.ark && world.ark.land && world.ark.land[L.id] && world.ark.land[L.id].done).length;
  // 열흘 양식 — 두 아이 몫에 동물 여섯 마리마다 하나(한 쌍씩 마흔이면 8, 37번이면 296 — 예전 한 달 24×12=288 과 비슷)
  const arkRation = world => Math.max(1, ARK_RATION + Math.ceil(((world && world.animals) || []).length / 6) - (arkEven(world) ? 1 : 0));
  // 지금 방주 이야기가 어디쯤인가 — 홍수 동안(afloat)에는 섬이 물에 잠겨 밭·가게·채집이 쉰다
  const arkPhase = world => (world && world.ark && world.ark.phase) || null;
  const afloat = world => arkPhase(world) === 'flood';
  /* 모닥불 — 밤에 앉으면 기운이 돈다. 하루에 한 번씩, 둘이 같은 날 앉으면 더 따뜻하다. */
  const FIRE_ENERGY = 12, FIRE_TOGETHER = 8;

  // ---------- 오늘의 할 일 ----------
  const MISSIONS = [
    { id: 'water5',  text: '물 다섯 번 주기',            stat: 'watered',  n: 5,  coins: 20 },
    { id: 'harvest3',text: '작물 세 개 거두기',          stat: 'harvested', n: 3, coins: 30 },
    { id: 'plant3',  text: '씨앗 세 개 심기',            stat: 'planted',  n: 3,  coins: 20 },
    { id: 'pet',     text: '동물 쓰다듬기',              stat: 'petted',   n: 1,  coins: 25 },
    { id: 'gift',    text: '자매에게 선물 보내기',       stat: 'gifted',   n: 1,  coins: 40 },
    { id: 'gather',  text: '나무나 돌 모으기',           stat: 'gathered', n: 2,  coins: 20 },
    { id: 'sell',    text: '상인에게 무엇이든 팔기',     stat: 'sold',     n: 1,  coins: 15 },
    { id: 'fish',    text: '연못에서 두 번 낚시하기',     stat: 'fished',   n: 2,  coins: 30 },
    { id: 'firefly', text: '반딧불이 세 마리 잡기',       stat: 'caught',   n: 3,  coins: 35 },
  ];

  // ---------- 경험치 ----------
  const XP = { plant: 2, water: 1, harvest: 4, giant: 40, build: 60, cook: 8, gather: 2, feed: 2, pet: 1, order: 15, festival: 80, expand: 30, fish: 5 };
  function levelOf(xp){ return Math.min(20, Math.floor(Math.sqrt((xp || 0) / 30)) + 1); }

  // ---------- 세이브 ----------
  /* 규칙 판 번호 — 새 가구·작물·꾸미개·동물을 넣을 때마다 올린다.
     fixWorld 는 모르는 가구·씨앗·자리를 걸러 낸다. 그래서 배포 전에 열어 둔 탭(옛 규칙)이 새 세이브를 다시 읽고
     저장하면 자매가 새로 산 것이 사라졌다. 세이브에 이 번호(rv)를 적어 두고, 화면(pages/farm.js loadRows)은
     세이브의 번호가 제 것보다 크면 저장을 멈추고 새로 고친다. */
  const RULES_V = 1;
  function newWorld(now){
    return {
      v: 1, fv: FARM_V, rv: RULES_V, started: dayKey(now), seasonLen: SEASON_LEN_DEFAULT, seasonIndex: 0,
      farm: 0, past: [], expand: 0, rooms: {}, plots: {}, buildings: {}, animals: [], layout: {}, decor: {}, sprinklers: {},
      house: { living: {}, sua: { '0,0': { f: 'bed1', r: 0 } }, yona: { '0,0': { f: 'bed1', r: 0 } } },
      orders: {}, festival: {}, mail: { sua: [], yona: [] }, log: [], seen: {},
    };
  }
  function newMine(key){
    return {
      key, coins: 120, xp: 0, energy: ENERGY_BASE, energyDay: null,
      // 제 가게에 있는 씨앗 셋과 자매 가게 씨앗 하나 — 첫날부터 「이건 내 가게엔 없네」를 알게 된다.
      inv: key === 'yona' ? { 'seed:potato': 3, 'seed:radish': 1 } : { 'seed:radish': 3, 'seed:potato': 1 },
      tools: { can: 0, hoe: 0 }, dex: [], dexAt: {}, recipes: ['salad', 'jam'], stats: {}, day: null, nodes: {},
      lastPlay: null, playDays: [], fertSpent: 0, claimed: [], fishDay: null, fishN: 0,
      medals: [],
    };
  }
  function fixWorld(w, now){
    const base = newWorld(now);
    if (!w || typeof w !== 'object') return base;
    const o = Object.assign(base, w);
    /* 농장 표 차례가 바뀐 세이브 — 2026-10-09 오로라 뒤에 단풍·밀림·사바나를 끼워 사막(5)·방주(6)·무지개(7)가 셋씩 밀렸다.
       fv 가 없는 옛 세이브만 한 번 옮긴다(아래 칸 맞추기보다 먼저 — 지도 크기가 농장 번호를 따른다) */
    if (!(Number(w.fv) >= FARM_V)){ const f0 = Math.floor(Number(w.farm) || 0); if (f0 >= 5) o.farm = f0 + 3; }
    o.fv = FARM_V;
    o.rv = Math.max(Math.floor(Number(w.rv) || 0), RULES_V);   // 더 새 판이 쓴 세이브의 번호는 낮추지 않는다
    ['plots', 'buildings', 'orders', 'festival', 'seen', 'decor', 'layout'].forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; });
    // 축제 한 판이 빈 값이면 훈장·도감이 .done 을 읽다 터진다 — 서버는 값의 모양을 안 보니 여기서 거른다
    Object.keys(o.festival).forEach(k => { if (!o.festival[k] || typeof o.festival[k] !== 'object') delete o.festival[k]; });
    // 옮긴 자리는 늘 지도 안에 있어야 한다 — 지도가 바뀌어도 물건이 밖으로 나가지 않게.
    Object.keys(o.layout).forEach(id => {
      const P = PLACE[id] || ((NODES[id] || /^sc\d+$/.test(id)) && { w: 1, h: 1 }), L = o.layout[id];   // 채집 자리·풍경도 옮긴 자리를 적는다
      if (!P || !L || typeof L.x !== 'number' || typeof L.y !== 'number'){ delete o.layout[id]; return; }
      L.x = Math.max(0, Math.min(gridOf(o).w - P.w, Math.round(L.x)));
      L.y = Math.max(0, Math.min(gridOf(o).h - P.h, Math.round(L.y)));
    });
    // 넓힌 방 — 숫자만 남기고 0~2 안으로 맞춘다. 옛 세이브에는 아예 없다.
    if (!o.rooms || typeof o.rooms !== 'object') o.rooms = {};
    Object.keys(o.rooms).forEach(r => {
      if (!ROOMS[r]) { delete o.rooms[r]; return; }
      o.rooms[r] = Math.max(0, Math.min(ROOM_GROW.length - 1, Math.round(Number(o.rooms[r]) || 0)));
    });
    if (!Array.isArray(o.animals)) o.animals = [];
    // 이름은 안내 줄에 HTML 로 들어간다. rename 은 <> 를 걸러 받지만 그건 이 화면을 거칠 때뿐이고,
    // 저장 함수(farm_commit)는 값의 모양을 안 본다 — 서버에서 온 이름도 같은 규칙으로 한 번 더 거른다.
    o.animals.forEach(a => { if (a && a.name != null) a.name = String(a.name).replace(/[<>]/g, '').slice(0, 8); });
    if (!Array.isArray(o.log)) o.log = [];
    if (!o.house) o.house = base.house;
    Object.keys(ROOMS).forEach(r => {
      if (!o.house[r]) o.house[r] = {};
      const P = o.house[r];
      Object.keys(P).forEach(k => {
        const it = P[k];
        if (!it || !FURNITURE[it.f]){ delete P[k]; return; }        // 없어진 가구는 지운다
        if (FURNITURE[it.f].pic){ if (!okPic(it.pic)) delete P[k]; } else if (it.pic) delete it.pic;
        it.r = FURNITURE[it.f].wall ? 0 : ((Math.round(Number(it.r) || 0) % 4) + 4) % 4;
      });
      /* 벽에 거는 것을 바닥 칸에서 벽 격자로 옮긴다 — 한 번만 일어난다.
         예전에는 바닥 칸에 걸어 두고 그 칸으로 벽자리를 어림했다. 그래서 그림 한 장이
         바닥 한 칸을 잡아먹었고 높이도 못 골랐다. 보이던 자리를 되도록 지키도록
         옛 규칙(y<=x 면 오른쪽 벽, 아니면 왼쪽 벽)으로 칸을 고르고, 그 자리가 차 있으면
         가까운 빈 칸을 찾는다. 벽이 꽉 찼으면 그냥 두고 옛 자리 그대로 그린다. */
      Object.keys(P).forEach(k => {
        if (parseWall(k)) return;
        const it = P[k], F = FURNITURE[it.f];
        if (!F || !F.wall) return;
        const p = k.split(',').map(Number);
        if (!isFinite(p[0]) || !isFinite(p[1])) return;
        // 훈장 걸이는 예전에 어디에 놓아도 왼쪽 벽에 걸렸다 — 옮길 때도 왼쪽 벽으로 간다
        const side = F.kind === 'medalcase' ? 0 : (p[1] <= p[0] ? 1 : 0);
        const at = side ? p[0] : p[1];
        const cols = wallCols(o, r, side), rows = wallRowsFor(it.f);
        const want = Math.max(0, Math.min(cols - 1, Math.round((at * TILE_HALF - 8) / WALL_PITCH)));
        let put = null;
        for (let d = 0; d < cols && !put; d++){
          const tryCols = d === 0 ? [want] : [want + d, want - d];
          for (let i = 0; i < tryCols.length && !put; i++){
            const c = tryCols[i];
            if (c < 0 || c >= cols) continue;
            if (!hungCol(o, r, side, c)) put = wallKey(side, c, rows > 1 ? 0 : 0);
          }
        }
        if (!put) return;
        delete P[k]; P[put] = it;
      });
    });
    if (!o.sprinklers || typeof o.sprinklers !== 'object') o.sprinklers = {};
    /* 「딴 날부터 일주일」로 바꾸기 전에 이미 따 먹던 칸에는 딴 때가 안 적혀 있다.
       심은 날로 세면 규칙을 바꾼 그날 우수수 시들어 버리므로, 그런 칸만 한 번
       지금으로 적어 준다 — 규칙이 바뀐 날부터 다시 일주일. 한 번 적히면 안 건드린다. */
    Object.keys(o.plots).forEach(id => {
      const p = o.plots[id];
      if (p && p.crop && (p.picks || 0) > 0 && !p.pickedAt) p.pickedAt = now;
    });
    if (!o.mail) o.mail = { sua: [], yona: [] };
    o.farm = farmIndex(o);
    if (!Array.isArray(o.past)) o.past = [];
    // 방주 농장 그림엽서는 이제 안 보낸다(2026-10-10 로키즈 「아직 알면 안 돼」) — 방주 농장에 닿기 전이면 이미 와 있는 것도 거둔다
    if (o.farm < arkFarmIndex()){
      ['sua', 'yona'].forEach(k => { if (Array.isArray(o.mail[k])) o.mail[k] = o.mail[k].filter(g => !(g && g.from === 'postcard' && g.farm === 'ark')); });
      if (o.postcard === 'ark') delete o.postcard;
    }
    if (o.moveAsk && (typeof o.moveAsk !== 'object' || !NAME[o.moveAsk.by] || nextFarmIndex(o) < 0)) delete o.moveAsk;
    // 방주(2026-10-09) — 서버는 값의 모양을 안 보니 여기서 거른다. 없으면 그대로 없다(필요할 때 arkOf 가 만든다)
    if (o.ark != null){
      if (typeof o.ark !== 'object' || Array.isArray(o.ark)) delete o.ark;
      else {
        const A = o.ark;
        A.seeds = Array.isArray(A.seeds) ? A.seeds.filter((c, i, a) => CROPS[c] && a.indexOf(c) === i) : [];
        A.step = arkStep(o);
        A.food = Math.max(0, Math.floor(Number(A.food) || 0));
        ['paid', 'by', 'land'].forEach(k => { if (!A[k] || typeof A[k] !== 'object' || Array.isArray(A[k])) A[k] = {}; });
        Object.keys(A.land).forEach(k => { if (!LAND_STEPS.some(L => L.id === k) || !A.land[k] || typeof A.land[k] !== 'object') delete A.land[k]; else if (!A.land[k].paid || typeof A.land[k].paid !== 'object') A.land[k].paid = {}; });
        if (!Array.isArray(A.on)) A.on = [];
        if (A.phase !== 'flood' && A.phase !== 'land') delete A.phase;
        A.month = Math.max(0, Math.min(ARK_TURNS, Math.floor(Number(A.month) || 0)));
        if (A.ask && (typeof A.ask !== 'object' || !NAME[A.ask.by] || A.phase)) delete A.ask;
        // 방주 더하기 열한 가지(2026-10-09) — 옛 세이브는 칸 0·빈 목록에서 시작
        const S0 = A.store && typeof A.store === 'object' ? A.store : {};
        A.store = {}; Object.keys(ARK_BINS).forEach(b => { A.store[b] = Math.max(0, Math.floor(Number(S0[b]) || 0)); });
        A.duty = (Array.isArray(A.duty) ? A.duty : []).filter(d => d && NAME[d.by] && Number.isFinite(d.day)).slice(-ARK_TURNS);
        A.cabin = (Array.isArray(A.cabin) ? A.cabin : []).filter((f, i, a) => FURNITURE[f] && a.indexOf(f) === i).slice(0, ARK_CABIN_MAX);
        if (!Array.isArray(A.cards)) A.cards = A.phase ? ARK_LOG.filter(L => L.day <= (A.phase === 'land' ? ARK_DAYS : arkDay(A.month))).map(L => L.day) : [];   // 카드 전에 지난 이야기는 모은 것으로
        A.cards = A.cards.filter((d, i, a) => ARK_LOG.some(L => L.day === d) && a.indexOf(d) === i);
        A.garden = (Array.isArray(A.garden) ? A.garden : []).filter((c, i, a) => CROPS[c] && a.indexOf(c) === i);
        A.doves = (Array.isArray(A.doves) ? A.doves : []).filter(d => d && ['back', 'olive', 'gone'].indexOf(d.r) >= 0).slice(-6);
        if (A.wx && !ARK_SEA[A.wx]) delete A.wx;
        if (!A.covenant && A.land.altar && A.land.altar.done) A.covenant = A.land.altar.on || dayKey(now);
        if (A.memorial != null && (typeof A.memorial !== 'object' || Array.isArray(A.memorial))) delete A.memorial;
      }
    }
    // 둘이 만난 특산물(localState 의 「특산물」) — SPECIALS 에 있는 것만, 한 번씩
    o.found = Array.isArray(o.found) ? o.found.filter((id, i, a) => typeof id === 'string' && originOf(id) && a.indexOf(id) === i) : [];
    if (!o.started) o.started = dayKey(now);
    return o;
  }
  function fixMine(m, key){
    const base = newMine(key);
    if (!m || typeof m !== 'object') return base;
    const o = Object.assign(base, m, { key });
    if (!o.inv || typeof o.inv !== 'object') o.inv = {};
    if (!o.tools) o.tools = { can: 0, hoe: 0 };
    ['dex', 'recipes', 'playDays', 'claimed', 'medals'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
    o.dex = o.dex.filter(k => typeof k === 'string' && k.indexOf('null') < 0);
    if (!o.dexAt || typeof o.dexAt !== 'object' || Array.isArray(o.dexAt)) o.dexAt = {};
    if (!o.stats) o.stats = {};
    if (!o.nodes || typeof o.nodes !== 'object') o.nodes = {};
    o.coins = Math.max(0, Math.floor(Number(o.coins) || 0));
    o.xp = Math.max(0, Math.floor(Number(o.xp) || 0));
    return o;
  }
  const LOG_MAX = 24;
  /* 반짝 작물은 보통 작물 대신 쓸 수 있다 — 요리와 주문에는 그대로 통한다.
     아까우니 보통 것을 먼저 쓰고, 모자랄 때만 반짝 것에 손을 댄다. */
  const PLAY_DAYS_MAX = 21;

  // ---------- 행동 ----------
  // 전부 (world, mine, …, now) 를 받아 고치고 { ok, msg } 를 돌려준다. 화면은 이걸 부르고 결과만 보여 준다.
  const OTHER = { sua: 'yona', yona: 'sua' };
  const NAME = { sua: '수아', yona: '연아' };

  /* 아침마다 한 번. 손으로 준 물과 똑같이 쳐 준다 — 값을 치르고 한 칸을 내준 물이니
     별에도 그대로 보탠다. 여러 대가 같은 칸을 적셔도 한 번만 센다. */
  /* 놓인 것을 다른 칸으로 곧장 옮긴다 — 가방을 거치지 않는다.
     아이가 가구를 집어 끌면 이걸 부른다. 돌린 각도는 그대로 간다. */
  /* 쪽지 — 물건 없이 한 마디만 보낸다. 하루 다섯 통까지만.
     우편함 열두 통이 넘치면 오래된 쪽지부터 지워진다(선물·상금은 안 지운다 — 놀이 규칙의 trimMail). */
  const NOTE_MAX = 60, NOTE_A_DAY = 5;
  /* 사서 바로 보내기 — 「반씩 나눠 가진 씨앗」은 제 가게에서 사서 건네야 상대가 심는다.
     사고 가방에서 다시 찾아 보내는 두 걸음을 한 걸음으로 줄인다. */
  function fixTune(t){
    const o = Object.assign({ seasonLen: SEASON_LEN_DEFAULT, gift: {} }, t || {});
    o.seasonLen = Math.max(3, Math.min(30, Math.floor(Number(o.seasonLen) || SEASON_LEN_DEFAULT)));
    return o;
  }


  /* 놀이 규칙(farm-rules-play.js)이 이 닫힘 안의 것을 쓴다. 손으로 적은 목록이 아니라
     tools/split-rules.py 가 두 파일을 읽어 만든 것이다 — 하나라도 빠지면 그 규칙이
     돌 때 undefined 로 터진다. 놀이 규칙을 고쳤으면 그 도구를 다시 돌린다. */
  const INNER = { ARK_SEA, arkSea, ARK_BINS, ARK_BIN_MIN, ARK_HAY, arkBinOf, arkEven, ARK_CABIN_MAX, arkCardsHave, arkGardenHave, arkGardenDone, ARK_STEPS, ARK_FOOD_MIN, ARK_RATION, ARK_SPAN, ARK_DAYS, ARK_TURNS, ARK_GOODS_FOOD, ARK_LOG, arkDay, arkNews, LAND_STEPS, ARK_KINDS, arkFarmIndex, arkPhase, afloat, arkCount, arkPairsHave, arkSeedsHave, arkStep, landDone, arkRation, animalMax, localOf, localState, specKey, FARM_V, SPECIALS, TRADE_MULT, PAST_COINS, perkOf, originOf, dexId, GUESTS, QUEST_DAYS, QUEST_MULT, shardMax, farmOk, SHARD_MAX, PICKS, GENIE_GIFTS, shardSpots, shardsLeft, SANTA_CHANCE, SANTA_GIFTS, nodeDef, nodeSpot, sceneryOf, gridOf, fieldCells, fieldHas, FARMS, MOVE_GIFT, MOVE_KEEP, MOVE_OPEN, farmOf, nextFarmIndex, movePath, ANIMALS, ANIMAL_MAX, BABY_CHANCE, BABY_DAYS, BABY_REST_DAYS, BOX_PRIZES, BUILDINGS, COST, COZY_LEVELS, CROPS, CROP_IDS, DAY_MS, DECOR, DISHES, ENERGY_BASE, EXPANSIONS, FERT_SPEED, FESTIVALS, FIELD_BOX, FIREFLY_MAX, FIREFLY_SEASONS, FIRE_ENERGY, FIRE_TOGETHER, FISH, FISH_IDS, FISH_MAX, FURNITURE, GIANT_MULT, GOLD_MULT, GOODS, GRID, H, LOG_MAX, LOVE_FOR_BABY, LOVE_FOR_BEST, MATERIALS, MEDALS, MISSIONS, NAME, NODES, NOTE_A_DAY, NOTE_MAX, OTHER, PED_WANT_MAX, PED_WANT_MULT, PLACE, PLACE_IDS, PLAY_DAYS_MAX, ROOMS, SEASONS, SEASON_NAME, SPRINKLER, SPRINKLERS, TOOLS, WATER_HOURS, WEATHER, XP, calendar, dayKey, dayStartMs, daysBetween, fireflyLeft, fireflyNight, furnBox, growTime, hungCol, isNight, levelOf, nodeReady, occupied, okPic, parseId, parseWall, peddlerHere, peddlerSpot, placed, plotIds, prand, roomBox, spotOf, sprinklerOf, stageOf, thingHere, tickPlot, wallCols, wallKey, wallRowsFor, weatherOf };

  return {
    SEASONS, SEASON_NAME, SEASON_ICON, SEASON_LEN_DEFAULT, WEATHER, CROPS, CROP_IDS, GOODS, TOOLS, BUILDINGS, ANIMALS, ANIMAL_MAX, LOVE_FOR_BEST, LOVE_FOR_BABY, BABY_DAYS, BABY_REST_DAYS, NODES, DECOR, FURNITURE, ROOMS, DISHES, FESTIVALS, MISSIONS, XP, COST, EXPANSIONS, FIELD, GH, NAME, OTHER,
    GIANT_MULT, GOLD_MULT, WATER_HOURS, SPRINKLER, SPRINKLER2, SPRINKLERS, sprinklerOf, FIREFLY_MAX, PEDDLER, PED_WANT_MULT, PED_WANT_MAX, MEDALS, ENERGY_BASE, COZY_LEVELS, H, DAY_MS, GRID, PLACE, PLACE_IDS, FIELD_BOX, FISH, FISH_IDS, FISH_MAX, isNight,
    spotOf, thingHere,
    FARMS, farmOf, farmNo, movePath, gridOf, nodeDef, nodeSpot, sceneryOf, MOVE_OPEN, MOVE_GIFT,
    dayKey, dayStartMs, daysBetween, calendar, weatherOf, prand,
    SKY_AT, setSky, skyOf, setSun, sunOf,
    plotIds, parseId, fieldCells, fieldHas, fieldBox,
    fireflyNight, fireflyLeft,
    ARK_SEA, arkSea, ARK_BINS, ARK_BIN_MIN, ARK_HAY, arkBinOf, arkEven, ARK_CABIN_MAX, arkCardsHave, arkGardenHave, arkGardenDone, 
    ARK_STEPS, ARK_FOOD_MIN, ARK_RATION, ARK_SPAN, ARK_DAYS, ARK_TURNS, ARK_GOODS_FOOD, ARK_LOG, arkDay, arkNews, LAND_STEPS, ARK_KINDS, arkFarmIndex, arkPhase, afloat, arkCount, arkPairsHave, arkSeedsHave, arkStep, landDone, arkRation, animalMax,
    localOf, localState, FARM_V,
    farmOk, SHARD_MAX, PICKS, shardSpots, shardsLeft, shardMax, SPECIALS, TRADE_MULT, perkOf, originOf, GUESTS,
    peddlerHere, peddlerSpot,
    cropsInDex, tickPlot, stageOf, wetNow, growTime, lifeLeft, lifeFrom, CROP_LIFE_DAYS,
    nodeReady, placed, occupied, furnBox,
    MATERIALS, WALL_PITCH, WALL_ROWS, wallCols, wallRowsFor, wallKey, parseWall, hungCol,
    ROOM_GROW, roomStep, roomBox, okPic, picSide, PIC_N,
    levelOf,
    __inner: INNER,
    newWorld, newMine, fixWorld, fixMine, fixTune, RULES_V,
  };
})();
if (typeof module !== 'undefined') module.exports = FARM;
