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
  /* 진짜 하늘 — 대한민국 서울 자양동 기준. 페이지가 open-meteo 에서 받아다 setSky 로
     넣어 주면, 그날 농장 날씨는 지어내지 않고 밖에 실제로 내리는 것을 그대로 쓴다.
     「오늘 비 왔지?」가 농장에서도 비여야 아이가 창밖과 화면을 잇는다.
     못 받아 오면(신호가 없거나 표에 없는 날짜) 지금까지처럼 날짜로 지어낸다. */
  const SKY_AT = { lat: 37.5340, lng: 127.0823, name: '서울 자양동' };
  let sky = {};
  function setSky(map){ sky = (map && typeof map === 'object') ? map : {}; }
  function skyOf(key){ const w = sky[key]; return WEATHER[w] ? w : null; }
  /* 해 뜨고 지는 시각도 같은 자리에서 받아 둔다(자양동 기준, 시각은 시간 단위 실수).
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
  };
  const CROP_IDS = Object.keys(CROPS);
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
    const E = EXPANSIONS[Math.min(world.expand || 0, EXPANSIONS.length - 1)];
    for (let y = 0; y < E.h; y++) for (let x = 0; x < E.w; x++) out.push((FIELD.x0 + x) + ',' + (FIELD.y0 + y));
    return out;
  }
  function parseId(id){ const s = id[0] === 'g' ? id.slice(1) : id; const [x, y] = s.split(',').map(Number); return { x, y, gh: id[0] === 'g' }; }

  // 한 칸의 상태: { tilled, crop, by, plantedAt, progress(ms), wet(until ms), tick(마지막으로 센 때), fert, giant, wilted, picks }
  // 물이 있는 동안만 progress 가 는다. 마지막으로 센 때(tick)부터 지금까지 중 젖어 있던 만큼만 더한다.
  function growTime(plot){
    const C = CROPS[plot.crop];
    let h = C.hours * H;
    if (plot.giant) h *= GIANT_TIME;
    return h;
  }
  function tickPlot(plot, now, gh){
    if (!plot || !plot.crop || plot.wilted) return;
    const from = plot.tick || plot.plantedAt || now;
    const wetUntil = gh && GH_ALWAYS_WET ? Infinity : (plot.wet || 0);
    const grew = Math.max(0, Math.min(now, wetUntil) - from);
    plot.progress = (plot.progress || 0) + grew * (plot.fert ? FERT_SPEED : 1);
    plot.tick = now;
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
  };
  // 파는 값. 작물은 그날 시세가 붙는다.
  // 가게에서 파는 재료 — 값은 되파는 값(시세 1.3배까지)보다 넉넉히 높다
  const MATERIALS = { wood: { cost: 10 }, stone: { cost: 8 } };

  // ---------- 기운 ----------
  const ENERGY_BASE = 40;
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
  };

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
    pond:       { name: '연못',     w: 2, h: 2, x: 0,  y: 13, kind: 'decor',  move: true },
    path:       { name: '꽃길',     w: 8, h: 1, x: 8,  y: 8,  kind: 'decor',  move: true },
    lantern:    { name: '등불',     w: 1, h: 1, x: 16, y: 7,  kind: 'decor',  move: true },
    bench:      { name: '나무 벤치', w: 2, h: 1, x: 8, y: 15, kind: 'decor',  move: true },
    swing:      { name: '그네',     w: 2, h: 2, x: 4,  y: 14, kind: 'decor',  move: true },
    arch:       { name: '장미 아치', w: 2, h: 1, x: 18, y: 7, kind: 'decor',  move: true },
    sandbox:    { name: '모래놀이터', w: 2, h: 2, x: 0, y: 10, kind: 'decor',  move: true },
    firepit:    { name: '모닥불',   w: 1, h: 1, x: 11, y: 13, kind: 'decor',  move: true },
  };
  const PLACE_IDS = Object.keys(PLACE);
  function spotOf(world, id){
    const P = PLACE[id]; if (!P) return null;
    const L = (world && world.layout && world.layout[id]) || null;
    return { id, x: L ? L.x : P.x, y: L ? L.y : P.y, w: P.w, h: P.h, move: P.move, name: P.name };
  }
  // 지금 농장에 실제로 있는 것들만. 안 지은 건물 자리는 비어 있는 것으로 친다.
  function thingHere(world, id){
    const P = PLACE[id];
    if (!P) return false;
    if (P.kind === 'always') return true;
    if (P.kind === 'build') return !!(world.buildings && world.buildings[id] && world.buildings[id].done);
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
  };
  const ANIMAL_MAX = { coop: 6, barn: 6, pasture: 4, pethouse: 2 };
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
    boot:    { name: '낡은 장화',   sell: 2,   w: 11, c: '#6b5a4a', junk: true },
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
    bush:  { kind: 'bush', x: 3,  y: 12, give: { berry: 2 }, cost: 'forage', days: 1, season: ['spring', 'summer', 'autumn'] },
    bush2: { kind: 'bush', x: 6,  y: 13, give: { berry: 3 }, cost: 'forage', days: 2, season: ['spring', 'summer', 'autumn'] },
    snow:  { kind: 'snow', x: 8,  y: 13, give: { snowball: 1 }, cost: 'forage', days: 1, season: ['winter'] },
  };
  // 자리는 하나지만 몫은 각자다 — 먼저 온 사람이 다 가져가면 둘째는 늘 빈손이라서.
  function nodeReady(world, mine, id, now){
    const N = NODES[id], cal = calendar(world, now);
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
  const WALL_TALL = { heightbar: 1 };         // 아래 단에 걸면 허리 몰딩을 넘는 것 — 늘 윗단에만
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
  const MEDALS = [
    { id: 'seedling', col: '#8fd66c', name: '첫 삽',       icon: '🌱', desc: '작물 다섯 가지를 거둬요',       coins: 100,  need: (w, m) => cropsInDex(m) >= 5 },
    { id: 'farmer', col: '#e8c46a',   name: '밭의 주인',   icon: '🌾', desc: '작물 절반을 거둬요',           coins: 400,  need: (w, m) => cropsInDex(m) >= Math.ceil(CROP_IDS.length / 2) },
    { id: 'master', col: '#ffd25a',   name: '온 밭 도감',  icon: '🏅', desc: '작물을 모두 거둬요',           coins: 1500, need: (w, m) => cropsInDex(m) >= CROP_IDS.length },
    { id: 'shiny', col: '#fff0a8',    name: '반짝반짝',    icon: '✨', desc: '반짝 작물 다섯 가지를 거둬요', coins: 500,  need: (w, m) => m.dex.filter(k => k.slice(0, 5) === 'gold:').length >= 5 },
    { id: 'angler', col: '#6fb3e0',   name: '연못 지기',   icon: '🎣', desc: '물고기를 모두 낚아요',         coins: 800,  need: (w, m) => FISH_IDS.every(f => m.dex.indexOf('fish:' + f) >= 0) },
    { id: 'cook', col: '#ff9a2e',     name: '부엌 대장',   icon: '🍳', desc: '요리를 모두 만들어요',         coins: 900,  need: (w, m) => Object.keys(DISHES).every(d => m.dex.indexOf('dish:' + d) >= 0) },
    { id: 'giant', col: '#e8892f',    name: '둘이서 번쩍', icon: '🎃', desc: '큰 작물을 뽑아요',             coins: 300,  need: (w, m) => m.dex.some(k => k.slice(0, 6) === 'giant:') },
    { id: 'bestie', col: '#ff7f8a',   name: '마음이 가득', icon: '💗', desc: '동물의 마음을 10까지 채워요',  coins: 400,  need: (w) => (w.animals || []).some(a => (a.love || 0) >= 10) },
    { id: 'cradle', col: '#ffe066',   name: '새끼를 봤어요', icon: '🐣', desc: '동물이 새끼를 낳아요',       coins: 500,  need: (w) => (w.animals || []).some(a => a.mom) },
    { id: 'night', col: '#9bea6e',    name: '반딧불이 밤', icon: '🌟', desc: '반딧불이를 스무 마리 잡아요',  coins: 300,  need: (w, m) => ((m.stats || {}).caught || 0) >= 20 },
    { id: 'party', col: '#c9a24a',    name: '축제의 별',   icon: '🏆', desc: '축제에서 상을 받아요',         coins: 600,  need: (w) => Object.keys(w.festival || {}).some(k => w.festival[k].done) },
    { id: 'hundred', col: '#a9c4d6',  name: '백 날의 농부', icon: '📅', desc: '농장에 백 날 와요',           coins: 1000, need: (w, m) => (m.playDays || []).length >= 100 },
  ];
  function cropsInDex(mine){
    return CROP_IDS.filter(c => mine.dex.indexOf(c) >= 0).length;
  }

  // ---------- 돌아다니는 행상인 ----------
  /* 이레에 두 번쯤 수레를 끌고 온다. 가게에 없는 것만 판다 —
     별열매 씨앗, 비료 묶음, 싸게 나온 스프링클러, 값을 깎은 가구, 그리고 수수께끼 보따리.
     세 자리는 날짜로 정해지므로 둘이 같은 날 보는 물건이 같다. */
  const PEDDLER = { x: 16, y: 8, w: 2, h: 1, chance: 0.3 };
  function peddlerHere(world, now){ return prand('pd' + dayKey(now)) < PEDDLER.chance; }
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
  function newWorld(now){
    return {
      v: 1, started: dayKey(now), seasonLen: SEASON_LEN_DEFAULT, seasonIndex: 0,
      expand: 0, rooms: {}, plots: {}, buildings: {}, animals: [], layout: {}, decor: {}, sprinklers: {},
      house: { living: {}, sua: { '0,0': { f: 'bed1', r: 0 } }, yona: { '0,0': { f: 'bed1', r: 0 } } },
      orders: {}, festival: {}, mail: { sua: [], yona: [] }, log: [], seen: {},
    };
  }
  function newMine(key){
    return {
      key, coins: 120, xp: 0, energy: ENERGY_BASE, energyDay: null,
      // 제 가게에 있는 씨앗 셋과 자매 가게 씨앗 하나 — 첫날부터 「이건 내 가게엔 없네」를 알게 된다.
      inv: key === 'yona' ? { 'seed:potato': 3, 'seed:radish': 1 } : { 'seed:radish': 3, 'seed:potato': 1 },
      tools: { can: 0, hoe: 0 }, dex: [], recipes: ['salad', 'jam'], stats: {}, day: null, nodes: {},
      lastPlay: null, playDays: [], fertSpent: 0, claimed: [], fishDay: null, fishN: 0,
      medals: [],
    };
  }
  function fixWorld(w, now){
    const base = newWorld(now);
    if (!w || typeof w !== 'object') return base;
    const o = Object.assign(base, w);
    ['plots', 'buildings', 'orders', 'festival', 'seen', 'decor', 'layout'].forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; });
    // 옮긴 자리는 늘 지도 안에 있어야 한다 — 지도가 바뀌어도 물건이 밖으로 나가지 않게.
    Object.keys(o.layout).forEach(id => {
      const P = PLACE[id], L = o.layout[id];
      if (!P || !L || typeof L.x !== 'number' || typeof L.y !== 'number'){ delete o.layout[id]; return; }
      L.x = Math.max(0, Math.min(GRID.w - P.w, Math.round(L.x)));
      L.y = Math.max(0, Math.min(GRID.h - P.h, Math.round(L.y)));
    });
    // 넓힌 방 — 숫자만 남기고 0~2 안으로 맞춘다. 옛 세이브에는 아예 없다.
    if (!o.rooms || typeof o.rooms !== 'object') o.rooms = {};
    Object.keys(o.rooms).forEach(r => {
      if (!ROOMS[r]) { delete o.rooms[r]; return; }
      o.rooms[r] = Math.max(0, Math.min(ROOM_GROW.length - 1, Math.round(Number(o.rooms[r]) || 0)));
    });
    if (!Array.isArray(o.animals)) o.animals = [];
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
    if (!o.mail) o.mail = { sua: [], yona: [] };
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
  /* 쪽지 — 물건 없이 한 마디만 보낸다. 우편함이 열두 통까지라, 쪽지로 다 채우면
     선물이 밀려난다. 그래서 하루 다섯 통까지만. */
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
  const INNER = { ANIMALS, ANIMAL_MAX, BABY_CHANCE, BABY_DAYS, BABY_REST_DAYS, BOX_PRIZES, BUILDINGS, COST, COZY_LEVELS, CROPS, CROP_IDS, DAY_MS, DECOR, DISHES, ENERGY_BASE, EXPANSIONS, FERT_SPEED, FESTIVALS, FIELD_BOX, FIREFLY_MAX, FIREFLY_SEASONS, FIRE_ENERGY, FIRE_TOGETHER, FISH, FISH_IDS, FISH_MAX, FURNITURE, GIANT_MULT, GOLD_MULT, GOODS, GRID, H, LOG_MAX, LOVE_FOR_BABY, LOVE_FOR_BEST, MATERIALS, MEDALS, MISSIONS, NAME, NODES, NOTE_A_DAY, NOTE_MAX, OTHER, PED_WANT_MAX, PED_WANT_MULT, PLACE, PLACE_IDS, PLAY_DAYS_MAX, ROOMS, SEASONS, SEASON_NAME, SPRINKLER, SPRINKLERS, TOOLS, WATER_HOURS, WEATHER, XP, calendar, dayKey, dayStartMs, daysBetween, fireflyLeft, fireflyNight, furnBox, growTime, hungCol, isNight, levelOf, nodeReady, occupied, okPic, parseId, parseWall, peddlerHere, placed, plotIds, prand, roomBox, spotOf, sprinklerOf, stageOf, thingHere, tickPlot, wallCols, wallKey, wallRowsFor, weatherOf };

  return {
    SEASONS, SEASON_NAME, SEASON_ICON, SEASON_LEN_DEFAULT, WEATHER, CROPS, CROP_IDS, GOODS, TOOLS, BUILDINGS, ANIMALS, ANIMAL_MAX, LOVE_FOR_BEST, LOVE_FOR_BABY, BABY_DAYS, BABY_REST_DAYS, NODES, DECOR, FURNITURE, ROOMS, DISHES, FESTIVALS, MISSIONS, XP, COST, EXPANSIONS, FIELD, GH, NAME, OTHER,
    GIANT_MULT, GOLD_MULT, WATER_HOURS, SPRINKLER, SPRINKLER2, SPRINKLERS, sprinklerOf, FIREFLY_MAX, PEDDLER, PED_WANT_MULT, PED_WANT_MAX, MEDALS, ENERGY_BASE, COZY_LEVELS, H, DAY_MS, GRID, PLACE, PLACE_IDS, FIELD_BOX, FISH, FISH_IDS, FISH_MAX, isNight,
    spotOf, thingHere,
    dayKey, dayStartMs, daysBetween, calendar, weatherOf, prand,
    SKY_AT, setSky, skyOf, setSun, sunOf,
    plotIds, parseId,
    fireflyNight, fireflyLeft,
    peddlerHere,
    cropsInDex, tickPlot, stageOf, wetNow, growTime,
    nodeReady, placed, occupied, furnBox,
    MATERIALS, WALL_PITCH, WALL_ROWS, wallCols, wallRowsFor, wallKey, parseWall, hungCol,
    ROOM_GROW, roomStep, roomBox, okPic, picSide, PIC_N,
    levelOf,
    __inner: INNER,
    newWorld, newMine, fixWorld, fixMine, fixTune,
  };
})();
if (typeof module !== 'undefined') module.exports = FARM;
