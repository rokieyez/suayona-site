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
  function dayEndMs(t){ return dayStartMs(dayKey(t)) + DAY_MS; }
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
  function nextSeason(s){ return SEASONS[(SEASONS.indexOf(s) + 1) % 4]; }

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
  function weatherOf(key, season){
    const r = prand('w' + key);
    if (season === 'winter') return r < 0.45 ? 'snow' : 'sun';
    if (season === 'spring') return r < 0.35 ? 'rain' : 'sun';
    if (season === 'summer') return r < 0.08 ? 'storm' : r < 0.25 ? 'rain' : 'sun';
    return r < 0.25 ? 'rain' : r < 0.4 ? 'wind' : 'sun';   // 가을
  }
  function isWet(w){ return w === 'rain' || w === 'storm'; }

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
  function seedsFor(season, half, lv){
    return CROP_IDS.filter(c => {
      const C = CROPS[c];
      return C.seed > 0 && C.season.indexOf(season) >= 0 && (!C.half || C.half === half) && (C.lv || 1) <= (lv || 1);
    });
  }
  const GIANT_MULT = 5;          // 큰 작물은 다섯 배로 팔린다
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
  function plotOpen(world, id){
    if (id[0] === 'g') return !!(world.buildings.greenhouse && world.buildings.greenhouse.done);
    return plotIds(world, 'field').indexOf(id) >= 0;
  }
  function parseId(id){ const s = id[0] === 'g' ? id.slice(1) : id; const [x, y] = s.split(',').map(Number); return { x, y, gh: id[0] === 'g' }; }
  function neighborsOf(id){
    const p = parseId(id), pre = p.gh ? 'g' : '';
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => pre + (p.x + d[0]) + ',' + (p.y + d[1]));
  }

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
  function ripe(plot){ return !!plot && !!plot.crop && !plot.wilted && (plot.progress || 0) >= growTime(plot); }
  function hoursLeft(plot, now){
    if (!plot || !plot.crop) return 0;
    return Math.max(0, (growTime(plot) - (plot.progress || 0)) / H / (plot.fert ? FERT_SPEED : 1));
  }
  function wetNow(plot, now, gh){ return gh && GH_ALWAYS_WET ? true : (plot.wet || 0) > now; }

  // 계절이 바뀌면 그 계절에 안 맞는 작물은 시든다. 온실 안과 별열매는 예외.
  function seasonSweep(world, now){
    const cal = calendar(world, now);
    if (world.seasonIndex === cal.seasonIndex) return 0;
    world.seasonIndex = cal.seasonIndex;
    let n = 0;
    Object.keys(world.plots).forEach(id => {
      const p = world.plots[id];
      if (!p.crop || id[0] === 'g') return;
      const C = CROPS[p.crop];
      if (C.hardy || C.season.indexOf(cal.season) >= 0) return;
      p.wilted = true; n++;
    });
    return n;
  }

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
  };
  function itemName(id){
    const [k, v] = id.split(':');
    if (k === 'seed') return CROPS[v] ? CROPS[v].name + ' 씨앗' : id;
    if (k === 'crop') return CROPS[v] ? CROPS[v].name : id;
    if (k === 'giant') return CROPS[v] ? '큰 ' + CROPS[v].name : id;
    if (k === 'dish') return DISHES[v] ? DISHES[v].name : id;
    if (k === 'f') return FURNITURE[v] ? FURNITURE[v].name : id;
    return GOODS[id] ? GOODS[id].name : id;
  }
  // 파는 값. 작물은 그날 시세가 붙는다.
  function sellPrice(id, world, now){
    const [k, v] = id.split(':');
    const mult = world ? priceMult(world, now) : 1;
    if (k === 'crop') return Math.round(CROPS[v].sell * mult * (world && world.hot === v ? 1.5 : 1));
    if (k === 'giant') return Math.round(CROPS[v].sell * GIANT_MULT * mult);
    if (k === 'dish') return DISHES[v].sell;
    if (k === 'seed') return Math.floor(CROPS[v].seed / 2);
    if (k === 'f') return Math.floor(FURNITURE[v].cost / 3);
    return GOODS[id] ? GOODS[id].sell : 0;
  }
  // 시세 — 날마다 0.8~1.3 사이. 오늘의 인기 작물은 1.5배.
  function priceMult(world, now){
    const key = dayKey(now);
    return 0.8 + Math.round(prand('p' + key) * 5) / 10;
  }
  function hotCrop(world, now){
    const cal = calendar(world, now);
    const list = CROP_IDS.filter(c => CROPS[c].seed > 0 && CROPS[c].season.indexOf(cal.season) >= 0);
    return list[Math.floor(prand('h' + dayKey(now)) * list.length)];
  }
  // 먹으면 기운이 돈다. 작물은 조금, 요리는 많이.
  function foodOf(id){
    const [k, v] = id.split(':');
    if (k === 'crop') return CROPS[v].flower ? 0 : 3;
    if (k === 'dish') return DISHES[v].food;
    if (GOODS[id] && GOODS[id].food) return GOODS[id].food;
    return 0;
  }

  // ---------- 기운 ----------
  const ENERGY_BASE = 40;
  const COST = { till: 1, water: 1, harvest: 1, chop: 2, mine: 2, plant: 0, fert: 0, feed: 1, pet: 0, cook: 1, forage: 1 };
  function maxEnergy(world, mine){
    let e = ENERGY_BASE;
    const bed = bestOf(world, mine.key, 'bed');          // 침대가 좋을수록 잘 자서 기운이 는다
    if (bed) e += FURNITURE[bed].energy || 0;
    if (world.buildings.well && world.buildings.well.done) e += 3;
    return e;
  }
  function refreshEnergy(world, mine, now){
    const key = dayKey(now);
    if (mine.energyDay !== key){ mine.energyDay = key; mine.energy = maxEnergy(world, mine); return true; }
    return false;
  }

  // ---------- 도구 ----------
  // 물뿌리개·괭이는 단계가 오르면 한 번에 여러 칸. 우물이 있어야 2단계부터 올릴 수 있다.
  const TOOLS = {
    can: { name: '물뿌리개', icon: '💧', levels: [{ n: 1, cost: 0 }, { n: 3, cost: 250 }, { n: 9, cost: 900, need: 'well' }] },
    hoe: { name: '괭이',     icon: '⛏️', levels: [{ n: 1, cost: 0 }, { n: 3, cost: 200 }, { n: 9, cost: 700 }] },
  };
  function toolN(mine, tool){ return TOOLS[tool].levels[Math.min(mine.tools[tool] || 0, 2)].n; }
  // 몇 칸을 한 번에 다루나 — 1은 그 칸, 3은 가로 셋, 9는 3×3.
  function toolTargets(id, n){
    const p = parseId(id), pre = p.gh ? 'g' : '';
    if (n >= 9){ const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.push(pre + (p.x + dx) + ',' + (p.y + dy)); return o; }
    if (n >= 3) return [pre + (p.x - 1) + ',' + p.y, id, pre + (p.x + 1) + ',' + p.y];
    return [id];
  }

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
  function canPay(mine, each){
    if ((each.coins || 0) > mine.coins) return false;
    return Object.keys(each).every(k => k === 'coins' || (mine.inv[k] || 0) >= each[k]);
  }
  function pay(mine, each){
    mine.coins -= each.coins || 0;
    Object.keys(each).forEach(k => { if (k !== 'coins') take(mine, k, each[k]); });
  }
  function buildState(world, id){
    const b = world.buildings[id] || { paid: {} };
    return { done: !!b.done, sua: !!b.paid.sua, yona: !!b.paid.yona };
  }

  // 농장 꾸미기 — 혼자 사도 된다. 다 짓고 나서도 동전을 쓸 데가 있어야 오래 간다.
  const DECOR = {
    path:     { name: '꽃길',     icon: '🌼', cost: 800,  lv: 3 },
    pond:     { name: '연못',     icon: '🦆', cost: 2000, lv: 5, desc: '오리 두 마리가 헤엄쳐요' },
    fountain: { name: '분수',     icon: '⛲', cost: 3500, lv: 7 },
    statue:   { name: '별 동상',  icon: '🌟', cost: 8000, lv: 9, desc: '농장의 자랑' },
  };

  // ---------- 농장 배치 ----------
  // 지도는 20×12 칸. 밭은 늘 가운데(6..15, 2..7)에 있고, 나머지는 아이들이 옮길 수 있다.
  // 자리는 world.layout 에만 적는다 — 표(PLACE)의 x,y 는 아무도 옮기지 않았을 때의 처음 자리다.
  const GRID = { w: 20, h: 12 };
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
    scarecrow:  { name: '허수아비', w: 1, h: 1, x: 6,  y: 8,  kind: 'build',  move: true },
    pasture:    { name: '목장',     w: 4, h: 6, x: 16, y: 3,  kind: 'build',  move: true },
    barn:       { name: '외양간',   w: 3, h: 3, x: 16, y: 9,  kind: 'build',  move: true },
    fountain:   { name: '분수',     w: 2, h: 2, x: 8,  y: 0,  kind: 'decor',  move: true },
    statue:     { name: '별 동상',  w: 1, h: 2, x: 11, y: 0,  kind: 'decor',  move: true },
    pond:       { name: '연못',     w: 2, h: 2, x: 12, y: 10, kind: 'decor',  move: true },
    path:       { name: '꽃길',     w: 8, h: 1, x: 8,  y: 8,  kind: 'decor',  move: true },
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
  function thingsOn(world){ return PLACE_IDS.filter(id => thingHere(world, id)).map(id => spotOf(world, id)); }
  function boxHit(a, b){ return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  // 밭은 늘 자리를 비워 둔다 — 지금 열린 만큼이 아니라 끝까지 넓혔을 때만큼.
  const FIELD_BOX = { x: FIELD.x0, y: FIELD.y0, w: FIELD.w, h: FIELD.h };
  // 왜 못 놓는지 한 마디로 돌려준다. 놓을 수 있으면 빈 문자열.
  function placeBlocked(world, id, x, y){
    const P = PLACE[id]; if (!P) return '없는 자리예요';
    if (!P.move) return P.name + '은 옮길 수 없어요';
    if (!thingHere(world, id)) return '아직 농장에 없어요';
    const me = { x, y, w: P.w, h: P.h };
    if (x < 0 || y < 0 || x + P.w > GRID.w || y + P.h > GRID.h) return '농장 밖이에요';
    if (boxHit(me, FIELD_BOX)) return '밭 자리에는 놓을 수 없어요';
    for (const other of PLACE_IDS){
      if (other === id || !thingHere(world, other)) continue;
      if (boxHit(me, spotOf(world, other))) return PLACE[other].name + '과 겹쳐요';
    }
    for (const n in NODES){
      const N = NODES[n];
      if (boxHit(me, { x: N.x, y: N.y, w: 1, h: 1 })) return '나무나 바위가 있어요';
    }
    return '';
  }
  function moveThing(world, mine, id, x, y){
    x = Math.round(Number(x)); y = Math.round(Number(y));
    const why = placeBlocked(world, id, x, y);
    if (why) return fail(why);
    world.layout = world.layout || {};
    const P = PLACE[id];
    if (x === P.x && y === P.y) delete world.layout[id]; else world.layout[id] = { x, y };
    return okay(eul(P.name) + ' 옮겼어요');
  }
  function resetLayout(world){ world.layout = {}; return okay('배치를 처음으로 되돌렸어요'); }

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
  function animalDay(world, now){
    // 하루가 바뀌면 어제 밥을 먹은 동물이 알을 낳는다. 그리고 밥그릇을 비운다.
    const key = dayKey(now);
    let made = [];
    (world.animals || []).forEach(a => {
      if (a.fedDay && a.fedDay !== key && a.fedDay !== a.lastMade){
        const A = ANIMALS[a.kind];
        a.since = (a.since || 0) + 1;
        if (a.since >= A.every){
          a.since = 0;
          const good = A.best && (a.love || 0) >= LOVE_FOR_BEST;
          if (A.find){
            // 강아지와 고양이는 낳는 대신 물어 온다. 마음이 크면 가끔 반짝돌.
            a.ready = good && prand('g' + a.id + key) < 0.25 ? A.best
                    : A.find[Math.floor(prand('f' + a.id + key) * A.find.length)];
          } else {
            a.ready = good ? A.best : A.product;
          }
          made.push(a);
        }
        a.lastMade = a.fedDay;
      }
      if (a.petDay !== key){ a.pet = []; a.petDay = key; }
    });
    return made;
  }

  // ---------- 채집 ----------
  // 나무 셋·바위 둘·산딸기 덤불 하나가 날마다 돌아온다. 건물 재료는 여기서 난다.
  const NODES = {
    tree1: { kind: 'tree', x: 0,  y: 10, give: { wood: 3 },  cost: 'chop',   days: 1 },
    tree2: { kind: 'tree', x: 2,  y: 10, give: { wood: 3 },  cost: 'chop',   days: 1 },
    tree3: { kind: 'tree', x: 4,  y: 10, give: { wood: 4 },  cost: 'chop',   days: 2 },
    rock1: { kind: 'rock', x: 9,  y: 10, give: { stone: 2 }, cost: 'mine',   days: 1 },
    rock2: { kind: 'rock', x: 11, y: 10, give: { stone: 3 }, cost: 'mine',   days: 1 },
    bush:  { kind: 'bush', x: 6,  y: 11, give: { berry: 2 }, cost: 'forage', days: 1, season: ['spring', 'summer', 'autumn'] },
    snow:  { kind: 'snow', x: 8,  y: 11, give: { snowball: 1 }, cost: 'forage', days: 1, season: ['winter'] },
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
    bed1:    { name: '작은 침대',   cost: 0,    w: 2, kind: 'bed', energy: 0,  cozy: 1, c: '#f2c6c6' },
    bed2:    { name: '포근한 침대', cost: 400,  w: 2, kind: 'bed', energy: 4,  cozy: 3, c: '#f7a8bf' },
    bed3:    { name: '구름 침대',   cost: 1500, w: 2, kind: 'bed', energy: 8,  cozy: 5, c: '#cfe4ff' },
    rug1:    { name: '줄무늬 러그', cost: 80,   w: 2, kind: 'rug', cozy: 1, c: '#ffd979' },
    rug2:    { name: '꽃무늬 러그', cost: 200,  w: 2, kind: 'rug', cozy: 2, c: '#f7a8bf' },
    table:   { name: '탁자',        cost: 120,  w: 2, kind: 'table', cozy: 1, c: '#c79a62' },
    chair:   { name: '의자',        cost: 60,   w: 1, kind: 'chair', cozy: 1, c: '#c79a62' },
    lamp:    { name: '램프',        cost: 90,   w: 1, kind: 'lamp', cozy: 2, c: '#ffe9a8' },
    plant:   { name: '화분',        cost: 70,   w: 1, kind: 'plant', cozy: 1, c: '#6fb567' },
    shelf:   { name: '책장',        cost: 220,  w: 1, kind: 'shelf', cozy: 2, c: '#a67c52' },
    frame:   { name: '그림 액자',   cost: 150,  w: 1, kind: 'frame', cozy: 2, c: '#ffb7d5' },
    curtain: { name: '커튼 창문',   cost: 180,  w: 1, kind: 'window', cozy: 2, c: '#bfe4f7' },
    sofa:    { name: '소파',        cost: 350,  w: 2, kind: 'sofa', cozy: 3, c: '#ff7f8a' },
    clock:   { name: '벽시계',      cost: 130,  w: 1, kind: 'clock', cozy: 1, c: '#fff6e9' },
    tank:    { name: '어항',        cost: 300,  w: 1, kind: 'tank', cozy: 2, c: '#8ec9ee' },
    catbed:  { name: '고양이 집',   cost: 250,  w: 1, kind: 'catbed', cozy: 2, c: '#f5d9a8' },
    stars:   { name: '별 조명',     cost: 260,  w: 1, kind: 'stars', cozy: 3, c: '#ffe680' },
    piano:   { name: '피아노',      cost: 900,  w: 2, kind: 'piano', cozy: 4, c: '#3a3230' },
    doll:    { name: '인형',        cost: 110,  w: 1, kind: 'doll', cozy: 1, c: '#ffcf9e' },
    vase:    { name: '꽃병',        cost: 95,   w: 1, kind: 'vase', cozy: 1, c: '#6cc7b3' },
    tree:    { name: '겨울 나무',   cost: 500,  w: 1, kind: 'xmas', cozy: 3, c: '#3f7d3c', season: 'winter' },
    trophy:  { name: '축제 트로피', cost: 0,    w: 1, kind: 'trophy', cozy: 3, c: '#ffd25a', rare: true },
    stove:   { name: '화로',        cost: 0,    w: 1, kind: 'stove', cozy: 2, c: '#7a5c48', rare: true },
  };
  const ROOMS = {
    living: { name: '거실',    w: 8, h: 5, owner: null },
    sua:    { name: '수아 방', w: 6, h: 5, owner: 'sua' },
    yona:   { name: '연아 방', w: 6, h: 5, owner: 'yona' },
  };
  // 어떤 방의 어느 칸에 무엇이 있나: world.house[room]["x,y"] = { f, by }
  function placed(world, room){ return (world.house && world.house[room]) || {}; }
  function occupied(world, room, x, y){
    const P = placed(world, room);
    for (const k in P){ const [px, py] = k.split(',').map(Number); const w = FURNITURE[P[k].f].w; if (py === y && x >= px && x < px + w) return k; }
    return null;
  }
  function canPlace(world, room, f, x, y){
    const R = ROOMS[room], F = FURNITURE[f];
    if (!R || !F) return false;
    if (x < 0 || y < 0 || y >= R.h || x + F.w > R.w) return false;
    for (let i = 0; i < F.w; i++) if (occupied(world, room, x + i, y)) return false;
    return true;
  }
  function bestOf(world, who, kind){
    let best = null;
    ['living', who].forEach(room => {
      const P = placed(world, room);
      Object.keys(P).forEach(k => { const f = P[k].f; if (FURNITURE[f].kind === kind && (!best || (FURNITURE[f].energy || 0) > (FURNITURE[best].energy || 0))) best = f; });
    });
    return best;
  }
  function cozyOf(world){
    let n = 0;
    Object.keys(ROOMS).forEach(r => { const P = placed(world, r); Object.keys(P).forEach(k => { n += FURNITURE[P[k].f].cozy || 0; }); });
    return n;
  }
  const COZY_LEVELS = [0, 8, 20, 40, 70, 110];
  function cozyLevel(world){ const c = cozyOf(world); let l = 0; COZY_LEVELS.forEach((t, i) => { if (c >= t) l = i; }); return l; }

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
    pickle:  { name: '오이지',       need: { 'crop:cucumber': 3, 'crop:pepper': 1 },   sell: 210, food: 7,  lv: 1 },
    starpie: { name: '별열매 파이',   need: { 'crop:star': 1, 'egg': 1, 'milk': 1 },    sell: 1200, food: 20, lv: 4 },
  };
  function canCook(mine, d){
    const D = DISHES[d];
    return Object.keys(D.need).every(k => (mine.inv[k] || 0) >= D.need[k]);
  }

  // ---------- 주문 게시판 (둘이서) ----------
  // 이번 주 주문 셋. 둘 다 같은 주문에 보탤 수 있다 — 낸 만큼 이름이 적힌다.
  function weekKey(now){
    const d = new Date(now == null ? Date.now() : now);
    const day = (d.getDay() + 6) % 7;            // 월요일이 0
    d.setDate(d.getDate() - day);
    return dayKey(d.getTime());
  }
  function ordersOf(world, now){
    const wk = weekKey(now), cal = calendar(world, now);
    const pool = CROP_IDS.filter(c => CROPS[c].seed > 0 && CROPS[c].season.indexOf(cal.season) >= 0);
    const out = [];
    for (let i = 0; i < 3; i++){
      const c = pool[Math.floor(prand('o' + wk + i) * pool.length)];
      const n = 3 + Math.floor(prand('n' + wk + i) * 5);          // 3~7개
      const reward = Math.round(CROPS[c].sell * n * 1.8);
      out.push({ id: wk + ':' + i, crop: c, n, reward, xp: 20 + n * 3, rareSeed: i === 2 });
    }
    return out;
  }
  function orderProgress(world, o){
    const p = (world.orders && world.orders[o.id]) || { got: 0, by: {} };
    return p;
  }

  // ---------- 축제 (계절 마지막 날) ----------
  // 둘의 점수를 합쳐서 문턱을 넘으면 둘 다 상을 받는다.
  const FESTIVALS = {
    spring: { name: '꽃 축제',     icon: '🌷', want: 'flower',  n: 6,  desc: '꽃을 여섯 송이 모아 와요.' },
    summer: { name: '수박 대회',   icon: '🍉', want: 'crop:watermelon', n: 3, desc: '수박 세 통. 큰 수박은 셋으로 쳐요.' },
    autumn: { name: '추수 잔치',   icon: '🌾', want: 'value',   n: 600, desc: '작물을 600 동전어치 내놓아요.' },
    winter: { name: '눈사람 축제', icon: '⛄', want: 'snowball', n: 4,  desc: '눈덩이 네 개. 하루에 하나씩만 나와요.' },
  };
  function festivalOpen(world, now){ const cal = calendar(world, now); return cal.dayOfSeason >= cal.len - 1; }   // 마지막 이틀
  function festivalKey(world, now){ const cal = calendar(world, now); return 'y' + cal.year + cal.season; }
  // 물건 하나가 축제에 얼마나 보태나. 0 이면 받지 않는다.
  function festivalWorth(fest, id, world, now){
    const F = FESTIVALS[fest], [k, v] = id.split(':');
    if (F.want === 'flower') return k === 'crop' && CROPS[v].flower ? 1 : 0;
    if (F.want === 'snowball') return id === 'snowball' ? 1 : 0;
    if (F.want === 'value') return k === 'crop' || k === 'giant' ? sellPrice(id, world, now) : 0;
    if (F.want === 'crop:watermelon') return id === 'crop:watermelon' ? 1 : id === 'giant:watermelon' ? 3 : 0;
    return 0;
  }

  // ---------- 오늘의 할 일 ----------
  const MISSIONS = [
    { id: 'water5',  text: '물 다섯 번 주기',            stat: 'watered',  n: 5,  coins: 20 },
    { id: 'harvest3',text: '작물 세 개 거두기',          stat: 'harvested', n: 3, coins: 30 },
    { id: 'plant3',  text: '씨앗 세 개 심기',            stat: 'planted',  n: 3,  coins: 20 },
    { id: 'pet',     text: '동물 쓰다듬기',              stat: 'petted',   n: 1,  coins: 25 },
    { id: 'gift',    text: '자매에게 선물 보내기',       stat: 'gifted',   n: 1,  coins: 40 },
    { id: 'gather',  text: '나무나 돌 모으기',           stat: 'gathered', n: 2,  coins: 20 },
    { id: 'sell',    text: '상인에게 무엇이든 팔기',     stat: 'sold',     n: 1,  coins: 15 },
  ];
  function missionOf(world, mine, now){
    const key = dayKey(now);
    let list = MISSIONS.filter(m => m.id !== 'pet' || (world.animals || []).length);
    const m = list[Math.floor(prand('m' + key + mine.key) * list.length)];
    const day = mine.day && mine.day.key === key ? mine.day : { key, stats: {} };
    return { m, got: day.stats[m.stat] || 0, done: !!(day.missionDone) };
  }

  // ---------- 경험치 ----------
  const XP = { plant: 2, water: 1, harvest: 4, giant: 40, build: 60, cook: 8, gather: 2, feed: 2, pet: 1, order: 15, festival: 80, expand: 30 };
  function levelOf(xp){ return Math.min(20, Math.floor(Math.sqrt((xp || 0) / 30)) + 1); }
  function xpForLevel(l){ return (l - 1) * (l - 1) * 30; }

  // ---------- 세이브 ----------
  function newWorld(now){
    return {
      v: 1, started: dayKey(now), seasonLen: SEASON_LEN_DEFAULT, seasonIndex: 0,
      expand: 0, plots: {}, buildings: {}, animals: [], layout: {}, decor: {},
      house: { living: {}, sua: { '0,0': { f: 'bed1' } }, yona: { '0,0': { f: 'bed1' } } },
      orders: {}, festival: {}, mail: { sua: [], yona: [] }, log: [], seen: {},
    };
  }
  function newMine(key){
    return {
      key, coins: 120, xp: 0, energy: ENERGY_BASE, energyDay: null,
      // 제 가게에 있는 씨앗 셋과 자매 가게 씨앗 하나 — 첫날부터 「이건 내 가게엔 없네」를 알게 된다.
      inv: key === 'yona' ? { 'seed:potato': 3, 'seed:radish': 1 } : { 'seed:radish': 3, 'seed:potato': 1 },
      tools: { can: 0, hoe: 0 }, dex: [], recipes: ['salad', 'jam'], stats: {}, day: null, nodes: {},
      lastPlay: null, playDays: [], fertSpent: 0, claimed: [],
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
    if (!Array.isArray(o.animals)) o.animals = [];
    if (!Array.isArray(o.log)) o.log = [];
    if (!o.house) o.house = base.house;
    Object.keys(ROOMS).forEach(r => { if (!o.house[r]) o.house[r] = {}; });
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
    ['dex', 'recipes', 'playDays', 'claimed'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
    o.dex = o.dex.filter(k => typeof k === 'string' && k.indexOf('null') < 0);
    if (!o.stats) o.stats = {};
    if (!o.nodes || typeof o.nodes !== 'object') o.nodes = {};
    o.coins = Math.max(0, Math.floor(Number(o.coins) || 0));
    o.xp = Math.max(0, Math.floor(Number(o.xp) || 0));
    return o;
  }
  const LOG_MAX = 24;
  function logAdd(world, who, text, now){
    world.log.unshift({ t: now == null ? Date.now() : now, who, text });
    if (world.log.length > LOG_MAX) world.log.length = LOG_MAX;
  }
  function give(mine, id, n){ mine.inv[id] = (mine.inv[id] || 0) + (n == null ? 1 : n); }
  function take(mine, id, n){
    n = n == null ? 1 : n;
    if ((mine.inv[id] || 0) < n) return false;
    mine.inv[id] -= n;
    if (mine.inv[id] <= 0) delete mine.inv[id];
    return true;
  }
  function bump(mine, stat, n, now){
    const key = dayKey(now);
    if (!mine.day || mine.day.key !== key) mine.day = { key, stats: {} };
    mine.day.stats[stat] = (mine.day.stats[stat] || 0) + (n == null ? 1 : n);
    mine.stats[stat] = (mine.stats[stat] || 0) + (n == null ? 1 : n);
  }
  const PLAY_DAYS_MAX = 21;
  function markPlayed(mine, now){
    const key = dayKey(now);
    if (mine.playDays.indexOf(key) < 0){ mine.playDays.push(key); if (mine.playDays.length > PLAY_DAYS_MAX) mine.playDays.splice(0, mine.playDays.length - PLAY_DAYS_MAX); }
    mine.lastPlay = key;
  }

  // ---------- 행동 ----------
  // 전부 (world, mine, …, now) 를 받아 고치고 { ok, msg } 를 돌려준다. 화면은 이걸 부르고 결과만 보여 준다.
  const OTHER = { sua: 'yona', yona: 'sua' };
  const NAME = { sua: '수아', yona: '연아' };
  // 받침에 따라 을/를, 이/가, 은/는. 마지막 글자가 한글이 아니면 앞쪽 것을 쓴다.
  function jong(w){ const c = String(w).replace(/<[^>]*>/g, '').trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false; }
  function eul(w){ return w + (jong(w) ? '을' : '를'); }
  function ee(w){ return w + (jong(w) ? '이' : '가'); }
  function eun(w){ return w + (jong(w) ? '은' : '는'); }
  function fail(msg){ return { ok: false, msg }; }
  function okay(msg, extra){ return Object.assign({ ok: true, msg }, extra || {}); }
  function spend(mine, kind){
    const c = COST[kind] || 0;
    if (mine.energy < c) return false;
    mine.energy -= c; return true;
  }

  function till(world, mine, id, now){
    if (!plotOpen(world, id)) return fail('아직 열리지 않은 땅이에요');
    const p = world.plots[id] || (world.plots[id] = {});
    if (p.tilled) return fail('이미 갈아 둔 땅이에요');
    if (!spend(mine, 'till')) return fail('기운이 없어요. 무엇을 좀 먹거나 내일 다시 와요');
    p.tilled = true; p.by = mine.key;
    return okay('땅을 갈았어요');
  }
  function plant(world, mine, id, crop, now){
    const C = CROPS[crop];
    if (!C) return fail('그런 씨앗은 없어요');
    if (!plotOpen(world, id)) return fail('아직 열리지 않은 땅이에요');
    const p = world.plots[id] || (world.plots[id] = {});
    if (!p.tilled) return fail('먼저 땅을 갈아요');
    if (p.crop) return fail('이미 무언가 자라고 있어요');
    const cal = calendar(world, now), gh = id[0] === 'g';
    if (!gh && !C.hardy && C.season.indexOf(cal.season) < 0) return fail(eun(C.name) + ' ' + SEASON_NAME[cal.season] + '에 자라지 않아요');
    if (!take(mine, 'seed:' + crop)) return fail(C.name + ' 씨앗이 없어요');
    Object.assign(p, { crop, by: mine.key, plantedAt: now, tick: now, progress: 0, picks: 0, wilted: false, giant: false });
    delete p.wet;
    mine.xp += XP.plant; bump(mine, 'planted', 1, now);
    // 큰 작물: 옆 칸에 자매가 오늘 심은 같은 작물이 있으면 둘이 합쳐진다.
    let joined = null;
    if (C.giant){
      for (const nb of neighborsOf(id)){
        const q = world.plots[nb];
        if (q && q.crop === crop && !q.giant && q.by === OTHER[mine.key] && dayKey(q.plantedAt) === dayKey(now) && !q.pairOf){
          q.giant = true; q.pairOf = id; p.giant = true; p.pairOf = nb;
          q.progress = 0; q.tick = now; q.plantedAt = now; joined = nb; break;
        }
      }
    }
    return okay(joined ? NAME[OTHER[mine.key]] + '가 심은 ' + C.name + '과 합쳐져 <b>큰 ' + C.name + '</b>이 됐어요!' : C.name + ' 씨앗을 심었어요', { joined });
  }
  function water(world, mine, id, now){
    const p = world.plots[id];
    if (!p || !p.tilled) return fail('물을 줄 땅이 아니에요');
    if (id[0] === 'g') return fail('온실은 물을 안 줘도 돼요');
    if (p.wet > now) return fail('아직 촉촉해요');
    if (!spend(mine, 'water')) return fail('기운이 없어요');
    tickPlot(p, now, false);
    p.wet = now + WATER_HOURS * H;
    mine.xp += XP.water; bump(mine, 'watered', 1, now);
    return okay('물을 줬어요');
  }
  function fertilize(world, mine, id, now){
    const p = world.plots[id];
    if (!p || !p.tilled) return fail('비료를 줄 땅이 아니에요');
    if (p.fert) return fail('이미 비료를 줬어요');
    if (!take(mine, 'fert')) return fail('비료가 없어요. 일기를 쓰면 하나 생겨요');
    tickPlot(p, now, id[0] === 'g');
    p.fert = true;
    return okay('비료를 줬어요. 1.5배 빨리 자라요');
  }
  function harvest(world, mine, id, now){
    const p = world.plots[id];
    if (!p || !p.crop) return fail('거둘 것이 없어요');
    const C = CROPS[p.crop], gh = id[0] === 'g';
    if (p.wilted){
      Object.assign(p, { crop: null, wilted: false, fert: false, giant: false, pairOf: null });
      return okay(eul('시든 ' + C.name) + ' 뽑았어요');
    }
    tickPlot(p, now, gh);
    if (!ripe(p)) return fail(ee(C.name) + ' 아직 덜 자랐어요 (' + Math.ceil(hoursLeft(p, now)) + '시간)');
    if (!spend(mine, 'harvest')) return fail('기운이 없어요');
    if (p.giant){
      // 큰 작물은 둘이 잡아당겨야 뽑힌다. 먼저 온 사람은 손을 얹고 기다린다.
      // 손은 두 칸 어느 쪽을 눌러도 같은 작물에 얹는 것이다 — 두 칸이 같은 목록을 본다.
      const pair = p.pairOf ? world.plots[p.pairOf] : null, cropId = p.crop;
      const pulls = (p.pulls || []).slice();
      if (pair) (pair.pulls || []).forEach(k => { if (pulls.indexOf(k) < 0) pulls.push(k); });
      if (pulls.indexOf(mine.key) < 0) pulls.push(mine.key);
      p.pulls = pulls; if (pair) pair.pulls = pulls.slice();
      if (pulls.length < 2){ mine.energy += COST.harvest; return okay('큰 ' + C.name + '에 손을 얹었어요. ' + NAME[OTHER[mine.key]] + '도 잡아당겨야 뽑혀요!', { waiting: true }); }
      give(mine, 'giant:' + cropId, 1);
      [id, p.pairOf].forEach(k => { const q = world.plots[k]; if (q) Object.assign(q, { crop: null, giant: false, pairOf: null, pulls: null, fert: false, progress: 0 }); });
      mine.xp += XP.giant; bump(mine, 'harvested', 1, now);
      if (mine.dex.indexOf('giant:' + cropId) < 0) mine.dex.push('giant:' + cropId);
      logAdd(world, mine.key, '둘이서 큰 ' + eul(C.name) + ' 뽑았어요!', now);
      return okay('둘이서 ' + eul('<b>큰 ' + C.name + '</b>') + ' 뽑았어요!', { giant: true });
    }
    const n = C.yield;
    give(mine, 'crop:' + p.crop, n);
    mine.xp += XP.harvest; bump(mine, 'harvested', n, now);
    if (mine.dex.indexOf(p.crop) < 0) mine.dex.push(p.crop);
    if (C.regrow){
      p.picks = (p.picks || 0) + 1;
      p.progress = growTime(p) - C.regrow * H;         // 다시 열릴 때까지
      p.tick = now;
      return okay(C.name + ' ' + n + '개를 땄어요. 또 열려요', { n });
    }
    Object.assign(p, { crop: null, fert: false, progress: 0 });
    return okay(C.name + ' ' + n + '개를 거뒀어요', { n });
  }
  function clear(world, mine, id){
    const p = world.plots[id];
    if (!p || !p.crop) return fail('뽑을 것이 없어요');
    const C = CROPS[p.crop];
    if (p.giant && p.pairOf){ const q = world.plots[p.pairOf]; if (q) Object.assign(q, { crop: null, giant: false, pairOf: null, pulls: null }); }
    Object.assign(p, { crop: null, wilted: false, giant: false, pairOf: null, pulls: null, progress: 0 });
    return okay(eul(C.name) + ' 뽑았어요');
  }
  function gather(world, mine, node, now){
    const N = NODES[node];
    if (!N) return fail('없는 자리예요');
    if (!nodeReady(world, mine, node, now)) return fail('아직 다시 자라지 않았어요');
    if (!spend(mine, N.cost)) return fail('기운이 없어요');
    mine.nodes[node] = dayKey(now);
    Object.keys(N.give).forEach(k => give(mine, k, N.give[k]));
    mine.xp += XP.gather; bump(mine, 'gathered', 1, now);
    const got = Object.keys(N.give).map(k => itemName(k) + ' ' + N.give[k] + '개').join(', ');
    return okay(got + '을 얻었어요');
  }
  function buy(world, mine, id, now){
    const [k, v] = id.split(':');
    if (k === 'seed'){
      const C = CROPS[v];
      if (!C || !C.seed) return fail('파는 씨앗이 아니에요');
      if (C.half && C.half !== mine.key) return fail('이 씨앗은 ' + NAME[C.half] + '의 가게에만 있어요. 선물로 받아야 해요');
      if ((C.lv || 1) > levelOf(mine.xp)) return fail('농장 레벨 ' + C.lv + '부터 살 수 있어요');
      if (mine.coins < C.seed) return fail('동전이 모자라요');
      mine.coins -= C.seed; give(mine, id, 1);
      return okay(C.name + ' 씨앗을 샀어요');
    }
    if (k === 'f'){
      const F = FURNITURE[v];
      if (!F || F.rare) return fail('파는 가구가 아니에요');
      if (F.season && calendar(world, now).season !== F.season) return fail(F.name + '은 ' + SEASON_NAME[F.season] + '에만 팔아요');
      if (mine.coins < F.cost) return fail('동전이 모자라요');
      mine.coins -= F.cost; give(mine, id, 1);
      return okay(eul(F.name) + ' 샀어요. 집에 가서 놓아요');
    }
    if (k === 'tool'){
      const T = TOOLS[v]; if (!T) return fail('없는 도구예요');
      const cur = mine.tools[v] || 0;
      const nx = T.levels[cur + 1];
      if (!nx) return fail('이미 최고예요');
      if (nx.need && !(world.buildings[nx.need] && world.buildings[nx.need].done)) return fail(BUILDINGS[nx.need].name + '이 있어야 해요');
      if (mine.coins < nx.cost) return fail('동전이 모자라요');
      mine.coins -= nx.cost; mine.tools[v] = cur + 1;
      return okay(ee(T.name) + ' 좋아졌어요. 한 번에 ' + nx.n + '칸!');
    }
    if (k === 'animal'){
      const A = ANIMALS[v]; if (!A) return fail('없는 동물이에요');
      if (!(world.buildings[A.need] && world.buildings[A.need].done)) return fail(eul(BUILDINGS[A.need].name) + ' 먼저 지어요');
      const here = world.animals.filter(a => ANIMALS[a.kind].need === A.need).length;
      if (here >= ANIMAL_MAX[A.need]) return fail(ee(BUILDINGS[A.need].name) + ' 꽉 찼어요');
      if (mine.coins < A.cost) return fail('동전이 모자라요');
      mine.coins -= A.cost;
      world.animals.push({ id: 'a' + now, kind: v, name: A.name, by: mine.key, born: dayKey(now), love: 0, pet: [], since: 0 });
      return okay(ee(A.name) + ' 왔어요. 이름을 지어 줘요', { animal: world.animals[world.animals.length - 1] });
    }
    if (k === 'deco'){
      const Dc = DECOR[v]; if (!Dc) return fail('없는 꾸미개예요');
      world.decor = world.decor || {};
      if (world.decor[v]) return fail('이미 있어요');
      if (levelOf(mine.xp) < Dc.lv) return fail('농장 레벨 ' + Dc.lv + '부터');
      if (mine.coins < Dc.cost) return fail('동전이 모자라요');
      mine.coins -= Dc.cost; world.decor[v] = { by: mine.key, on: dayKey(now) }; mine.xp += XP.expand;
      logAdd(world, mine.key, NAME[mine.key] + '가 농장에 ' + Dc.name + '을 놓았어요', now);
      return okay(ee(Dc.name) + ' 생겼어요');
    }
    if (k === 'fert'){ if (mine.coins < 30) return fail('동전이 모자라요'); mine.coins -= 30; give(mine, 'fert', 1); return okay('비료를 샀어요'); }
    if (k === 'recipe'){
      const D = DISHES[v]; if (!D) return fail('없는 요리예요');
      if (mine.recipes.indexOf(v) >= 0) return fail('이미 아는 요리예요');
      const cost = D.sell;
      if (mine.coins < cost) return fail('동전이 모자라요');
      mine.coins -= cost; mine.recipes.push(v);
      return okay(D.name + ' 만드는 법을 배웠어요');
    }
    if (k === 'expand'){
      const nx = EXPANSIONS[(world.expand || 0) + 1];
      if (!nx) return fail('밭이 이미 제일 넓어요');
      if (levelOf(mine.xp) < nx.lv) return fail('농장 레벨 ' + nx.lv + '부터');
      if (mine.coins < nx.cost) return fail('동전이 모자라요');
      mine.coins -= nx.cost; world.expand = (world.expand || 0) + 1; mine.xp += XP.expand;
      return okay('밭이 ' + nx.w + '×' + nx.h + '으로 넓어졌어요');
    }
    return fail('살 수 없는 것이에요');
  }
  function sell(world, mine, id, n, now){
    n = n == null ? 1 : n;
    const price = sellPrice(id, world, now);
    if (!price) return fail('상인이 사지 않는 물건이에요');
    if (!take(mine, id, n)) return fail('그만큼 없어요');
    const got = price * n;
    mine.coins += got; bump(mine, 'sold', n, now);
    return okay(itemName(id) + ' ' + n + '개를 팔아 ' + got + ' 동전을 받았어요', { got });
  }
  function eat(world, mine, id, now){
    const f = foodOf(id);
    if (!f) return fail('먹을 수 없어요');
    if (mine.energy >= maxEnergy(world, mine)) return fail('배가 불러요');
    if (!take(mine, id, 1)) return fail('없어요');
    mine.energy = Math.min(maxEnergy(world, mine), mine.energy + f);
    return okay(eul(itemName(id)) + ' 먹고 기운이 ' + f + ' 돌아왔어요');
  }
  function contribute(world, mine, id, now){
    const B = BUILDINGS[id]; if (!B) return fail('없는 건물이에요');
    const b = world.buildings[id] || (world.buildings[id] = { paid: {} });
    if (b.done) return fail('이미 지었어요');
    if (b.paid[mine.key]) return fail('내 몫은 이미 냈어요. ' + NAME[OTHER[mine.key]] + '를 기다려요');
    if (levelOf(mine.xp) < B.lv) return fail('농장 레벨 ' + B.lv + '부터');
    if (!canPay(mine, B.each)) return fail('재료가 모자라요');
    pay(mine, B.each); b.paid[mine.key] = true;
    if (b.paid.sua && b.paid.yona){ b.done = true; b.doneOn = dayKey(now); mine.xp += XP.build; logAdd(world, mine.key, ee(B.name) + ' 완성됐어요!', now); return okay(ee('<b>' + B.name + '</b>') + ' 완성됐어요!', { built: true }); }
    return okay('내 몫을 냈어요. ' + NAME[OTHER[mine.key]] + '도 내면 지어져요');
  }
  function feed(world, mine, aid, now){
    const a = world.animals.find(x => x.id === aid); if (!a) return fail('없는 동물이에요');
    const key = dayKey(now);
    if (a.fedDay === key) return fail(eun(a.name) + ' 오늘 밥을 먹었어요');
    if (!spend(mine, 'feed')) return fail('기운이 없어요');
    a.fedDay = key; a.fedBy = mine.key;
    mine.xp += XP.feed; bump(mine, 'fed', 1, now);
    return okay(a.name + '에게 밥을 줬어요');
  }
  function pet(world, mine, aid, now){
    const a = world.animals.find(x => x.id === aid); if (!a) return fail('없는 동물이에요');
    const key = dayKey(now);
    if (a.petDay !== key){ a.pet = []; a.petDay = key; }
    if (a.pet.indexOf(mine.key) >= 0) return fail('오늘은 이미 쓰다듬었어요');
    a.pet.push(mine.key);
    mine.xp += XP.pet; bump(mine, 'petted', 1, now);
    if (a.pet.length >= 2){ a.love = Math.min(10, (a.love || 0) + 1); return okay('둘 다 쓰다듬어서 ' + a.name + '의 마음이 ' + a.love + '이 됐어요 💗', { love: true }); }
    return okay(eul(a.name) + ' 쓰다듬었어요. ' + NAME[OTHER[mine.key]] + '도 쓰다듬으면 마음이 자라요');
  }
  function collect(world, mine, aid, now){
    const a = world.animals.find(x => x.id === aid); if (!a) return fail('없는 동물이에요');
    if (!a.ready) return fail('아직 없어요');
    give(mine, a.ready, 1); const got = a.ready; a.ready = null;
    if (mine.dex.indexOf(got) < 0) mine.dex.push(got);
    return okay(eul(itemName(got)) + ' 얻었어요');
  }
  function rename(world, mine, aid, name){
    const a = world.animals.find(x => x.id === aid); if (!a) return fail('없는 동물이에요');
    name = String(name || '').trim().slice(0, 8);
    if (!name) return fail('이름이 비었어요');
    a.name = name; return okay(name + (jong(name) ? '이라고' : '라고') + ' 부를게요');
  }
  function honeyCheck(world, now){
    const hv = world.buildings.hive; if (!hv || !hv.done) return false;
    const key = dayKey(now);
    if (hv.last && daysBetween(hv.last, key) < 2) return false;
    const flowers = Object.keys(world.plots).some(id => { const p = world.plots[id]; return p.crop && CROPS[p.crop].flower && stageOf(p) >= 3; });
    if (!flowers) return false;
    hv.last = key; hv.honey = (hv.honey || 0) + 1;
    return true;
  }
  function takeHoney(world, mine){
    const hv = world.buildings.hive; if (!hv || !hv.honey) return fail('꿀이 아직 없어요');
    give(mine, 'honey', hv.honey); const n = hv.honey; hv.honey = 0;
    if (mine.dex.indexOf('honey') < 0) mine.dex.push('honey');
    return okay('꿀 ' + n + '개를 떴어요');
  }
  function place(world, mine, room, f, x, y){
    const R = ROOMS[room], F = FURNITURE[f];
    if (!R || !F) return fail('놓을 수 없어요');
    if (R.owner && R.owner !== mine.key) return fail('여기는 ' + NAME[R.owner] + '의 방이에요');
    if (!canPlace(world, room, f, x, y)) return fail('그 자리에는 놓을 수 없어요');
    if (!take(mine, 'f:' + f)) return fail('그 가구가 없어요');
    world.house[room][x + ',' + y] = { f, by: mine.key };
    return okay(eul(F.name) + ' 놓았어요');
  }
  function pickUp(world, mine, room, key){
    const R = ROOMS[room]; const P = world.house[room];
    if (!R || !P || !P[key]) return fail('없어요');
    if (R.owner && R.owner !== mine.key) return fail('여기는 ' + NAME[R.owner] + '의 방이에요');
    const f = P[key].f;
    if (FURNITURE[f].kind === 'bed' && room === mine.key &&
        Object.keys(P).filter(k => FURNITURE[P[k].f].kind === 'bed').length <= 1) return fail('침대는 하나는 있어야 해요');
    delete P[key]; give(mine, 'f:' + f, 1);
    return okay(eul(FURNITURE[f].name) + ' 들었어요');
  }
  function cook(world, mine, d, now){
    if (!(world.buildings.kitchen && world.buildings.kitchen.done)) return fail('부엌을 먼저 지어요');
    const D = DISHES[d]; if (!D) return fail('없는 요리예요');
    if (mine.recipes.indexOf(d) < 0) return fail('아직 모르는 요리예요');
    if (!canCook(mine, d)) return fail('재료가 모자라요');
    if (!spend(mine, 'cook')) return fail('기운이 없어요');
    Object.keys(D.need).forEach(k => take(mine, k, D.need[k]));
    give(mine, 'dish:' + d, 1); mine.xp += XP.cook; bump(mine, 'cooked', 1, now);
    if (mine.dex.indexOf('dish:' + d) < 0) mine.dex.push('dish:' + d);
    return okay(eul(D.name) + ' 만들었어요');
  }
  function sendGift(world, mine, id, n, note, now){
    n = Math.max(1, Math.floor(n || 1));
    if (!take(mine, id, n)) return fail('그만큼 없어요');
    const to = OTHER[mine.key];
    world.mail[to].push({ id, n, from: mine.key, note: String(note || '').slice(0, 40), t: now });
    if (world.mail[to].length > 12) world.mail[to].splice(0, world.mail[to].length - 12);
    bump(mine, 'gifted', 1, now); logAdd(world, mine.key, NAME[mine.key] + '가 ' + NAME[to] + '에게 ' + itemName(id) + ' ' + n + '개를 보냈어요', now);
    return okay(NAME[to] + '의 우편함에 넣었어요');
  }
  function fillOrder(world, mine, o, n, now){
    const p = world.orders[o.id] || (world.orders[o.id] = { got: 0, by: {}, done: false });
    if (p.done) return fail('이미 채운 주문이에요');
    n = Math.min(n, o.n - p.got);
    if (n <= 0) return fail('다 찼어요');
    if (!take(mine, 'crop:' + o.crop, n)) return fail(ee(CROPS[o.crop].name) + ' 그만큼 없어요');
    p.got += n; p.by[mine.key] = (p.by[mine.key] || 0) + n;
    if (p.got >= o.n){
      p.done = true;
      // 상은 낸 만큼 나눈다. 다른 한 명 몫은 우편함으로.
      const other = OTHER[mine.key];
      const mineShare = Math.round(o.reward * (p.by[mine.key] / o.n));
      const otherShare = o.reward - mineShare;
      mine.coins += mineShare; mine.xp += o.xp;
      if (otherShare > 0) world.mail[other].push({ id: 'coins', n: otherShare, from: 'board', note: '주문 상금', t: now });
      if (o.rareSeed){ give(mine, 'seed:star', 1); }
      logAdd(world, mine.key, '주문 「' + CROPS[o.crop].name + ' ' + o.n + '개」를 채웠어요', now);
      return okay('주문 완성! ' + mineShare + ' 동전' + (o.rareSeed ? ' + <b>별열매 씨앗</b>' : '') + (otherShare ? ' (' + NAME[other] + ' 몫 ' + otherShare + '은 우편함으로)' : ''), { done: true });
    }
    return okay(CROPS[o.crop].name + ' ' + n + '개를 보탰어요 (' + p.got + '/' + o.n + ')');
  }
  function donate(world, mine, id, n, now){
    if (!festivalOpen(world, now)) return fail('축제는 계절 마지막 이틀에 열려요');
    const cal = calendar(world, now), fest = cal.season, fk = festivalKey(world, now);
    const worth = festivalWorth(fest, id, world, now);
    if (!worth) return fail('이번 축제에서는 받지 않는 물건이에요');
    const f = world.festival[fk] || (world.festival[fk] = { score: 0, by: {}, done: false });
    if (f.done) return fail('이미 상을 받았어요');
    if (!take(mine, id, n)) return fail('그만큼 없어요');
    f.score += worth * n; f.by[mine.key] = (f.by[mine.key] || 0) + worth * n;
    const F = FESTIVALS[fest];
    if (f.score >= F.n){
      f.done = true;
      const prize = { id: 'seed:star', n: 1 };
      ['sua', 'yona'].forEach(k => { world.mail[k].push({ id: 'coins', n: 300, from: 'festival', note: F.name + ' 상금', t: now }); world.mail[k].push(Object.assign({ from: 'festival', note: F.name, t: now }, prize)); });
      ['sua', 'yona'].forEach(k => world.mail[k].push({ id: 'f:trophy', n: 1, from: 'festival', note: F.name + ' 트로피', t: now }));
      mine.xp += XP.festival;
      logAdd(world, mine.key, F.name + '에서 상을 받았어요!', now);
      return okay('<b>' + F.name + '</b> 목표를 채웠어요! 상은 둘의 우편함으로', { won: true });
    }
    return okay(F.name + '에 냈어요 (' + f.score + '/' + F.n + ')');
  }
  // 우편함의 동전 봉투는 물건이 아니라서 따로 받는다.
  function openMailAll(world, mine){
    const box = world.mail[mine.key] || [];
    if (!box.length) return fail('우편함이 비었어요');
    const got = box.splice(0, box.length);
    let coins = 0;
    got.forEach(g => { if (g.id === 'coins') coins += g.n; else give(mine, g.id, g.n); });
    mine.coins += coins;
    return okay(got.map(g => (g.id === 'coins' ? g.n + ' 동전' : itemName(g.id) + ' ' + g.n + '개')).join(', ') + '를 받았어요', { got });
  }
  // 부모가 보낸 선물(조정판 줄) — 같은 번호는 한 번만 받는다.
  function claimParentGift(mine, tune){
    const g = tune && tune.gift && tune.gift[mine.key];
    if (!g || !g.id || mine.claimed.indexOf(g.id) >= 0) return null;
    mine.claimed.push(g.id); if (mine.claimed.length > 10) mine.claimed.shift();
    mine.coins += Math.max(0, Math.min(1000, Math.floor(g.coins || 0)));
    return g;
  }
  // 일기 하나에 비료 하나 — 현실 연동. 서버가 센 일기 수에서 쓴 만큼 뺀다.
  function fertFromDiaries(mine, diaries){
    const owed = Math.max(0, (diaries || 0) - (mine.fertSpent || 0));
    if (!owed) return 0;
    give(mine, 'fert', owed); mine.fertSpent = diaries;
    return owed;
  }
  function fixTune(t){
    const o = Object.assign({ seasonLen: SEASON_LEN_DEFAULT, gift: {} }, t || {});
    o.seasonLen = Math.max(3, Math.min(30, Math.floor(Number(o.seasonLen) || SEASON_LEN_DEFAULT)));
    return o;
  }

  // 하루가 열릴 때 한 번 — 계절, 동물, 꿀, 까마귀, 비 온 날의 물.
  function newDay(world, mine, now){
    const notes = [];
    const cal = calendar(world, now), key = dayKey(now);
    const wilted = seasonSweep(world, now);
    if (wilted) notes.push(SEASON_NAME[cal.season] + '이 와서 작물 ' + wilted + '개가 시들었어요');
    const made = animalDay(world, now);
    if (made.length) notes.push(made.map(a => a.name).join(', ') + '이 무언가 남겼어요');
    if (honeyCheck(world, now)) notes.push('벌통에 꿀이 찼어요');
    if (isWet(weatherOf(key, cal.season))){
      Object.keys(world.plots).forEach(id => { const p = world.plots[id]; if (p.tilled && id[0] !== 'g'){ tickPlot(p, now, false); p.wet = Math.max(p.wet || 0, dayEndMs(now)); } });
      notes.push('비가 와서 밭이 저절로 촉촉해요');
    }
    if (cal.season === 'autumn' && !(world.buildings.scarecrow && world.buildings.scarecrow.done) && world.crow !== key && prand('c' + key) < 0.3){
      world.crow = key;
      const ids = Object.keys(world.plots).filter(id => world.plots[id].crop && !world.plots[id].giant && id[0] !== 'g');
      if (ids.length){ const id = ids[Math.floor(prand('cc' + key) * ids.length)]; const C = CROPS[world.plots[id].crop]; Object.assign(world.plots[id], { crop: null, progress: 0, fert: false }); notes.push('까마귀가 ' + eul(C.name) + ' 쪼아 갔어요. 허수아비가 있으면 막아요'); }
    }
    world.hot = hotCrop(world, now);
    return notes;
  }

  return {
    SEASONS, SEASON_NAME, SEASON_ICON, SEASON_LEN_DEFAULT, WEATHER, CROPS, CROP_IDS, GOODS, TOOLS, BUILDINGS, ANIMALS, ANIMAL_MAX, LOVE_FOR_BEST, NODES, DECOR, FURNITURE, ROOMS, DISHES, FESTIVALS, MISSIONS, XP, COST, EXPANSIONS, FIELD, GH, NAME, OTHER,
    GIANT_MULT, WATER_HOURS, ENERGY_BASE, COZY_LEVELS, H, DAY_MS, GRID, PLACE, PLACE_IDS, FIELD_BOX,
    spotOf, thingHere, thingsOn, placeBlocked, moveThing, resetLayout,
    dayKey, dayStartMs, dayEndMs, daysBetween, calendar, nextSeason, weatherOf, isWet, prand,
    seedsFor, plotIds, plotOpen, parseId, neighborsOf, tickPlot, stageOf, ripe, hoursLeft, wetNow, growTime, seasonSweep,
    itemName, sellPrice, priceMult, hotCrop, foodOf, maxEnergy, refreshEnergy, toolN, toolTargets,
    canPay, buildState, animalDay, nodeReady, placed, occupied, canPlace, bestOf, cozyOf, cozyLevel, canCook,
    weekKey, ordersOf, orderProgress, festivalOpen, festivalKey, festivalWorth, missionOf, levelOf, xpForLevel, eul, ee, eun,
    newWorld, newMine, fixWorld, fixMine, fixTune, logAdd, give, take, bump, markPlayed,
    till, plant, water, fertilize, harvest, clear, gather, buy, sell, eat, contribute, feed, pet, collect, rename, takeHoney, place, pickUp, cook, sendGift, openMail: openMailAll, fillOrder, donate, claimParentGift, fertFromDiaries, newDay,
  };
})();
if (typeof module !== 'undefined') module.exports = FARM;
