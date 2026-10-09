// 수아연아 농장의 **놀이 규칙** — 심기·물주기·거두기·사기·팔기·요리·낚시·집 꾸미기.
// farm-rules.js 에서 떼어 냈다. 손님은 농장과 방 그림만 보므로 이 규칙이 한 줄도 안 쓰인다
// (함수 159개 중 손님이 부르는 것은 37개뿐이었다). 로그인한 사람만 늦게 받는다.
//
// farm-rules.js 가 먼저 돌아야 한다. 저 파일의 닫힘 안에 있는 것들은 FARM.__inner 로 받는다.
(() => {
  if (typeof FARM === 'undefined' || !FARM.__inner) throw new Error('farm-rules.js 를 먼저 실어야 해요');
  const { ARK_STEPS, ARK_FOOD_MIN, ARK_RATION, ARK_MONTHS, ARK_GOODS_FOOD, ARK_LOG, LAND_STEPS, ARK_KINDS, arkFarmIndex, arkPhase, afloat, arkCount, arkPairsHave, arkSeedsHave, arkStep, landDone, arkRation, animalMax, SPECIALS, TRADE_MULT, PAST_COINS, perkOf, originOf, dexId, GUESTS, QUEST_DAYS, QUEST_MULT, shardMax, farmOk, SHARD_MAX, PICKS, GENIE_GIFTS, shardSpots, SANTA_CHANCE, SANTA_GIFTS, nodeDef, nodeSpot, sceneryOf, gridOf, fieldCells, fieldHas, FARMS, MOVE_GIFT, MOVE_KEEP, MOVE_OPEN, farmOf, nextFarmIndex, movePath, ANIMALS, ANIMAL_MAX, BABY_CHANCE, BABY_DAYS, BABY_REST_DAYS, BOX_PRIZES, BUILDINGS, COST, COZY_LEVELS, CROPS, CROP_IDS, DAY_MS, DECOR, DISHES, ENERGY_BASE, EXPANSIONS, FERT_SPEED, FESTIVALS, FIREFLY_MAX, FIREFLY_SEASONS, FIRE_ENERGY, FIRE_TOGETHER, FISH, FISH_IDS, FISH_MAX, FURNITURE, GIANT_MULT, GOLD_MULT, GOODS, H, LOG_MAX, LOVE_FOR_BABY, LOVE_FOR_BEST, MATERIALS, MEDALS, MISSIONS, NAME, NODES, NOTE_A_DAY, NOTE_MAX, OTHER, PED_WANT_MAX, PED_WANT_MULT, PLACE, PLACE_IDS, PLAY_DAYS_MAX, ROOMS, SEASONS, SEASON_NAME, SPRINKLER, SPRINKLERS, TOOLS, WATER_HOURS, WEATHER, XP, calendar, dayKey, dayStartMs, daysBetween, fireflyLeft, fireflyNight, furnBox, growTime, hungCol, isNight, levelOf, nodeReady, occupied, okPic, parseId, parseWall, peddlerHere, placed, plotIds, prand, roomBox, spotOf, sprinklerOf, stageOf, thingHere, tickPlot, wallCols, wallKey, wallRowsFor, weatherOf } = FARM.__inner;

  function dayEndMs(t){ return dayStartMs(dayKey(t)) + DAY_MS; }
  function nextSeason(s){ return SEASONS[(SEASONS.indexOf(s) + 1) % 4]; }
  function isWet(w){ return w === 'rain' || w === 'storm'; }
  function forecast(world, now){
    const t = (now == null ? Date.now() : now) + DAY_MS;
    const cal = calendar(world, t), key = dayKey(t);
    const w = weatherOf(key, cal.season);
    return { key: key, season: cal.season, weather: w, wet: isWet(w), icon: WEATHER[w].icon, name: WEATHER[w].name };
  }
  function seedsFor(season, half, lv){
    return CROP_IDS.filter(c => {
      const C = CROPS[c];
      return C.seed > 0 && C.season.indexOf(season) >= 0 && (!C.half || C.half === half) && (C.lv || 1) <= (lv || 1);
    });
  }
  function plotOpen(world, id){
    if (afloat(world)) return false;                          // 대홍수 동안 섬은 물속이다
    if (id[0] === 'g') return !!(world.buildings.greenhouse && world.buildings.greenhouse.done);
    return plotIds(world, 'field').indexOf(id) >= 0;
  }
  // 모서리까지 여덟 칸 — 좋은 스프링클러가 적시는 자리
  function ringOf(id){
    const p = parseId(id), pre = p.gh ? 'g' : '';
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
      if (!dx && !dy) continue;
      out.push(pre + (p.x + dx) + ',' + (p.y + dy));
    }
    return out;
  }
  function neighborsOf(id){
    const p = parseId(id), pre = p.gh ? 'g' : '';
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => pre + (p.x + d[0]) + ',' + (p.y + d[1]));
  }
  function ripe(plot){ return !!plot && !!plot.crop && !plot.wilted && (plot.progress || 0) >= growTime(plot); }
  function hoursLeft(plot, now){
    if (!plot || !plot.crop) return 0;
    return Math.max(0, (growTime(plot) - (plot.progress || 0)) / H / (plot.fert ? FERT_SPEED : 1));
  }
  // 비료를 주면 1.5배 빨리 자라니 물 줄 기회도 그만큼 줄어든다 — 셈에 넣는다
  function careNeed(plot){ const C = CROPS[plot.crop]; if (!C) return 1; const h = (plot.regrowLeft || C.hours) / (plot.fert ? FERT_SPEED : 1); return Math.max(1, Math.round(h / (plot.wh || WATER_HOURS))); }
  const waterHours = world => perkOf(world) === 'water' ? 30 : WATER_HOURS;   // 오아시스 능력 「오아시스 샘」
  function starOf(plot, gh){
    if (!plot || !plot.crop) return 0;
    let st = 1;
    if (gh || (plot.care || 0) >= careNeed(plot)) st++;
    if (plot.fert) st++;
    return Math.min(3, st);
  }
  // 계절이 바뀐 것만 적어 둔다. 작물은 이제 계절 때문에 시들지 않는다 — 일주일이
  // 지나야 시든다(tickPlot). seasonIndex 를 계속 맞춰 두는 까닭: 배포가 어긋난 10분 동안
  // 옛 규칙 파일이 돌더라도, 이 값이 맞아 있으면 옛 규칙이 계절을 핑계로 밭을 시들게 하지 않는다.
  function seasonSweep(world, now){
    const cal = calendar(world, now);
    if (world.seasonIndex !== cal.seasonIndex) world.seasonIndex = cal.seasonIndex;
    return 0;
  }
  function itemName(id){
    const [k, v] = id.split(':');
    if (k === 'seed') return CROPS[v] ? CROPS[v].name + ' 씨앗' : id;
    if (k === 'crop') return CROPS[v] ? CROPS[v].name : id;
    if (k === 'giant') return CROPS[v] ? '큰 ' + CROPS[v].name : id;
    if (k === 'gold') return CROPS[v] ? '반짝 ' + CROPS[v].name : id;
    if (k === 'dish') return DISHES[v] ? DISHES[v].name : id;
    if (k === 'f') return FURNITURE[v] ? FURNITURE[v].name : id;
    if (k === 'fish') return FISH[v] ? FISH[v].name : id;
    return GOODS[id] ? GOODS[id].name : id;
  }
  function sellPrice(id, world, now){
    const base = sellBase(id, world, now), o = world && originOf(id), pk = world && perkOf(world), k = id.split(':')[0];
    let m = o && o !== farmOf(world).id ? TRADE_MULT : 1;                         // 다른 농장 특산물은 1.5배(농장끼리 장사)
    if ((pk === 'fish' && k === 'fish') || (pk === 'dish' && k === 'dish')) m *= 1.25;   // 바닷가·꽃구름 능력
    return m === 1 ? base : Math.round(base * m);
  }
  function sellBase(id, world, now){
    const [k, v] = id.split(':');
    const mult = world ? priceMult(world, now) : 1;
    if (k === 'crop') return Math.round(CROPS[v].sell * mult * (world && world.hot === v ? 1.5 : 1));
    if (k === 'giant') return Math.round(CROPS[v].sell * GIANT_MULT * mult);
    if (k === 'gold') return Math.round(CROPS[v].sell * GOLD_MULT * mult * (world && world.hot === v ? 1.5 : 1));
    if (k === 'dish') return DISHES[v].sell;
    if (k === 'seed') return Math.floor(CROPS[v].seed / 2);
    if (k === 'f') return Math.floor(FURNITURE[v].cost / 3);
    if (k === 'fish') return FISH[v] ? FISH[v].sell : 0;
    return GOODS[id] ? GOODS[id].sell : 0;
  }
  // 시세 — 날마다 0.8~1.3 사이. 오늘의 인기 작물은 1.5배.
  function priceMult(world, now){
    const key = dayKey(now);
    return 0.8 + Math.round(prand('p' + key) * 5) / 10;
  }
  function hotCrop(world, now){
    const cal = calendar(world, now);
    const list = CROP_IDS.filter(c => CROPS[c].seed > 0 && CROPS[c].season.indexOf(cal.season) >= 0 && farmOk(world, CROPS[c]));
    return list[Math.floor(prand('h' + dayKey(now)) * list.length)];
  }
  // 먹으면 기운이 돈다. 작물은 조금, 요리는 많이.
  function foodOf(id){
    const [k, v] = id.split(':');
    if (k === 'crop') return CROPS[v].flower ? 0 : 3;
    if (k === 'gold') return CROPS[v].flower ? 0 : 6;
    if (k === 'dish') return DISHES[v].food;
    if (k === 'fish') return FISH[v] && !FISH[v].junk ? 4 : 0;
    if (GOODS[id] && GOODS[id].food) return GOODS[id].food;
    return 0;
  }
  function maxEnergy(world, mine){
    let e = ENERGY_BASE;
    const bed = bestOf(world, mine.key, 'bed');          // 침대가 좋을수록 잘 자서 기운이 는다
    if (bed) e += FURNITURE[bed].energy || 0;
    if (world.buildings.well && world.buildings.well.done) e += 3;
    return e;
  }
  function refreshEnergy(world, mine, now){
    const key = dayKey(now);
    if (mine.energyDay !== key){
      rollDay(mine, key);
      mine.energyDay = key; mine.energy = maxEnergy(world, mine); return true;
    }
    return false;
  }
  function rollDay(mine, key){
    if (mine.day && mine.day.key && mine.day.key !== key){
      mine.day.coins1 = mine.coins;
      mine.prevDay = mine.day;
    }
    mine.day = { key: key, stats: {}, coins0: mine.coins };
  }
  function yesterdayNote(mine, now){
    const p = mine.prevDay;
    if (!p || !p.stats) return '';
    if (p.key !== dayKey(dayStartMs(dayKey(now)) - DAY_MS)) return '';    // 하루 넘게 안 왔으면 안 보여 준다
    const s = p.stats, bits = [];
    if (s.harvested) bits.push('수확 ' + s.harvested + '개');
    if (s.watered)   bits.push('물 ' + s.watered + '번');
    if (s.planted)   bits.push('씨앗 ' + s.planted + '개');
    if (s.gathered)  bits.push('나무·돌 ' + s.gathered + '개');
    if (s.fished)    bits.push('낚시 ' + s.fished + '번');
    // 옛 세이브에는 하루 시작 동전이 안 적혀 있다 — 그때는 돈 이야기를 빼고 나머지만 적는다
    const got = (typeof p.coins0 === 'number' && typeof p.coins1 === 'number') ? p.coins1 - p.coins0 : 0;
    if (!bits.length && got <= 0) return '';
    if (!bits.length) return '어제는 🪙 ' + got + '을 벌었어요';
    return '어제는 ' + bits.join(' · ') + ' 했어요' + (got > 0 ? ' · 🪙 ' + got + ' 벌었어요' : '');
  }
  function toolN(mine, tool){ return TOOLS[tool].levels[Math.min(mine.tools[tool] || 0, 2)].n; }
  // 몇 칸을 한 번에 다루나 — 1은 그 칸, 3은 가로 셋, 9는 3×3.
  function toolTargets(id, n){
    const p = parseId(id), pre = p.gh ? 'g' : '';
    if (n >= 9){ const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.push(pre + (p.x + dx) + ',' + (p.y + dy)); return o; }
    if (n >= 3) return [pre + (p.x - 1) + ',' + p.y, id, pre + (p.x + 1) + ',' + p.y];
    return [id];
  }
  function canPay(mine, each){
    if ((each.coins || 0) > mine.coins) return false;
    return Object.keys(each).every(k => k === 'coins' || (mine.inv[k] || 0) >= each[k]);
  }
  function pay(mine, each){
    mine.coins -= each.coins || 0;
    Object.keys(each).forEach(k => { if (k !== 'coins') take(mine, k, each[k]); });
  }
  function buildState(world, id){
    const b = world.buildings[id] || {}, paid = b.paid || {};
    return { done: !!b.done, sua: !!paid.sua, yona: !!paid.yona };
  }
  function thingsOn(world){ return PLACE_IDS.filter(id => thingHere(world, id)).map(id => spotOf(world, id)); }
  function boxHit(a, b){ return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  // 채집 나무·바위·덤불과 풍경(sc0…)도 옮긴다 — 한 칸짜리. 이름은 종류로 부른다.
  const NODE_NAME = { tree: '나무', rock: '바위', bush: '덤불', snow: '눈더미' };
  function placeInfo(world, id){
    if (PLACE[id]) return PLACE[id];
    const d = nodeDef(world, id);
    return d ? { w: 1, h: 1, move: true, node: true, name: NODE_NAME[d.kind] || '나무' } : null;
  }
  // 왜 못 놓는지 한 마디로 돌려준다. 놓을 수 있으면 빈 문자열.
  function placeBlocked(world, id, x, y){
    const P = placeInfo(world, id); if (!P) return '없는 자리예요';
    if (!P.move) return P.name + '은 옮길 수 없어요';
    if (!P.node && !thingHere(world, id)) return '아직 농장에 없어요';
    const me = { x, y, w: P.w, h: P.h };
    if (x < 0 || y < 0 || x + P.w > gridOf(world).w || y + P.h > gridOf(world).h) return '농장 밖이에요';
    for (let yy = y; yy < y + P.h; yy++) for (let xx = x; xx < x + P.w; xx++) if (fieldHas(world, xx, yy)) return '밭 자리에는 놓을 수 없어요';
    for (const other of PLACE_IDS){
      if (other === id || !thingHere(world, other)) continue;
      if (boxHit(me, spotOf(world, other))) return PLACE[other].name + '과 겹쳐요';
    }
    for (const n in NODES){
      if (n === id) continue;
      const N = nodeSpot(world, n);
      if (boxHit(me, { x: N.x, y: N.y, w: 1, h: 1 })) return '나무나 바위가 있어요';
    }
    if (sceneryOf(world).some(c => c.id !== id && boxHit(me, { x: c.x, y: c.y, w: 1, h: 1 }))) return '나무나 바위가 있어요';
    return '';
  }
  function moveThing(world, mine, id, x, y){
    if (afloat(world)) return fail('섬이 물에 잠겨 있어요');
    x = Math.round(Number(x)); y = Math.round(Number(y));
    const why = placeBlocked(world, id, x, y);
    if (why) return fail(why);
    world.layout = world.layout || {};
    const P = placeInfo(world, id), w0 = Object.assign({}, world, { layout: {} });
    const home = P.node ? (NODES[id] ? nodeSpot(w0, id) : sceneryOf(w0).find(c => c.id === id)) : spotOf(w0, id);   // 농장마다 처음 자리가 다르다
    if (x === home.x && y === home.y) delete world.layout[id]; else world.layout[id] = { x, y };
    return okay(eul(P.name) + ' 옮겼어요');
  }
  function resetLayout(world){ world.layout = {}; return okay('배치를 처음으로 되돌렸어요'); }
  function animalDay(world, now){
    // 하루가 바뀌면 어제 밥을 먹은 동물이 알을 낳는다. 그리고 밥그릇을 비운다.
    const key = dayKey(now);
    let made = [];
    (world.animals || []).forEach(a => {
      if (!a.baby && a.fedDay && a.fedDay !== key && a.fedDay !== a.lastMade){
        const A = ANIMALS[a.kind];
        a.since = (a.since || 0) + 1;
        if (a.since >= A.every){
          a.since = 0;
          const good = A.best && (a.love || 0) >= LOVE_FOR_BEST;
          // 낳는 것이 있는 동물(순록)은 findOdds 만큼만 찾아 오고 나머지 날은 제 것을 낳는다
          if (A.find && (!A.product || prand('rf' + a.id + key) < (A.findOdds || 0))){
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
  function babyDay(world, now){
    const key = dayKey(now), list = world.animals || [];
    const born = [], grown = [];
    list.forEach(a => {
      if (a.baby && daysBetween(a.born, key) >= BABY_DAYS){ a.baby = false; grown.push(a); }
    });
    list.slice().forEach(a => {
      const A = ANIMALS[a.kind];
      if (a.baby || !A) return;
      if ((a.love || 0) < LOVE_FOR_BABY) return;
      if (a.lastBorn && daysBetween(a.lastBorn, key) < BABY_REST_DAYS) return;
      const here = world.animals.filter(x => ANIMALS[x.kind] && ANIMALS[x.kind].need === A.need).length;
      if (here >= animalMax(world, A.need)) return;          // 우리가 꽉 찼다(방주·무지개 농장은 두 배)
      if (prand('bb' + a.id + key) >= BABY_CHANCE * (perkOf(world) === 'bloom' ? 2 : 1)) return;   // 무지개 농장 「생육하고 번성하라」
      a.lastBorn = key;
      // 이름이 겹치면 누구 새끼인지 알 수 없다 — 그럴 때는 어미 이름을 앞에 붙인다
      let nm = '아기 ' + A.name;
      if (world.animals.some(x => x.name === nm)) nm = a.name + '의 아기';
      const baby = { id: 'a' + now + 'b' + world.animals.length, kind: a.kind, name: nm,
        by: a.by, born: key, love: 0, pet: [], since: 0, baby: true, mom: a.id, momName: a.name };
      world.animals.push(baby);
      born.push(baby);
    });
    return { born, grown };
  }
  function fishLeft(mine, now){
    const key = dayKey(now);
    return FISH_MAX - (mine.fishDay === key ? (mine.fishN || 0) : 0);
  }
  // 물고기 크기(cm) 가운데값 — 낚을 때 0.7~1.3배로 흔들리고, 잘 낚으면(perfect) 조금 더 크다. 장화·미역은 재지 않는다
  const FISH_CM = { minnow: 8, crucian: 20, carp: 45, eel: 60, trout: 40, golden: 55, catfish: 70, moonfish: 50, shrimp: 9, sweetfish: 18,
    crayfish: 11, smelt: 13, puffer: 30, mackerel: 35, squid: 30, flounder: 50, seabream: 45, tuna: 150, cod: 70, char: 55 };
  function fishCm(f, seed, g){ const b = FISH_CM[f]; return b ? Math.round(b * (0.7 + 0.6 * prand('cm' + seed)) * (g === 'perfect' ? 1.1 : 1)) : 0; }
  function fish(world, mine, now, grade, where){
    const sea = where === 'sea', ice = where === 'ice', flood = where === 'flood';
    if (sea && farmOf(world).id !== 'seaside') return fail('바다는 바닷가 농장에만 있어요');
    // 방주 창밖 낚시(2026-10-09) — 큰물 위에서만. 바닷물고기가 문다
    if (flood && !afloat(world)) return fail('방주 창밖 낚시는 큰물 위에 떠 있을 때만 해요');
    if (!flood && afloat(world)) return fail('지금은 방주 안이에요. 창밖 큰물에 찌를 드리워요');
    // 얼음낚시 — 오로라 농장에 얼음낚시 구멍(icefish)이 놓여 있을 때만(2026-10-09)
    if (ice && !(farmOf(world).id === 'aurora' && world.decor && world.decor.icefish)) return fail('얼음낚시 구멍을 먼저 놓아요. 오로라 농장 가게 꾸미기 칸에 있어요');
    if (!sea && !ice && !flood && !(world.decor && world.decor.pond)) return fail('연못을 먼저 놓아요. 가게 꾸미기 칸에 있어요');
    if (fishLeft(mine, now) <= 0) return fail('오늘은 많이 잡았어요. 내일 또 와요');
    if (!spend(mine, 'fish')) return fail('기운이 없어요');
    const key = dayKey(now), n = mine.fishDay === key ? (mine.fishN || 0) : 0;
    const cal = calendar(world, now), night = isNight(now);
    const pool = FISH_IDS.filter(f => {
      const F = FISH[f];
      if (!!F.sea !== (sea || flood)) return false;    // 바다(와 큰물)에서는 바닷물고기만, 연못에서는 민물고기만
      if (!!F.ice !== ice) return false;               // 얼음 구멍에서는 얼음 물고기만
      if (F.season && F.season.indexOf(cal.season) < 0) return false;
      if (F.night && !night) return false;            // 달빛 물고기와 메기는 밤에만
      return true;
    });
    const g = grade === 'perfect' || grade === 'miss' ? grade : 'good';
    const rareUp = g === 'perfect' ? 5 : g === 'good' ? 1.6 : 0.6;
    const junkUp = g === 'perfect' ? 0.15 : g === 'good' ? 0.6 : 2.2;
    const wOf = f => { const F = FISH[f]; return Math.max(0.2, F.junk ? F.w * junkUp : (F.sell >= 200 ? F.w * rareUp : F.w)); };
    const total = pool.reduce((a, f) => a + wOf(f), 0);
    let r = prand('fi' + mine.key + key + n + g) * total, got = pool[0];
    for (const f of pool){ r -= wOf(f); if (r <= 0){ got = f; break; } }
    mine.fishDay = key; mine.fishN = n + 1;
    const cnt = g === 'perfect' && !FISH[got].junk ? 2 : 1;
    give(mine, 'fish:' + got, cnt);
    const cm = fishCm(got, mine.key + key + n, g), was = dexRec(mine, 'fish:' + got);
    noteDex(world, mine, 'fish:' + got, now, cnt, { cm });
    // 처음 낚은 것은 기록 갱신이라 하지 않는다 — 두루미·갈매기가 물어 와 크기 없이 도감에 든 물고기(x=0)도 마찬가지
    const best = !!was && was.x > 0 && cm > was.x;
    mine.xp += XP.fish + (g === 'perfect' ? 3 : 0); bump(mine, 'fished', 1, now);
    if (FISH[got].junk) return okay(eul(FISH[got].name) + ' 건졌어요… 물고기는 아니네요', { junk: true });
    const two = (cm ? ' · ' + cm + 'cm' + (best ? ' 🏆 가장 큰 기록!' : '') : '') + (cnt > 1 ? ' <b>두 마리</b>나!' : '');
    if (got === 'golden' || got === 'moonfish' || got === 'tuna' || got === 'char'){
      logAdd(world, mine.key, NAME[mine.key] + '가 ' + eul(FISH[got].name) + ' 낚았어요!', now);
      return okay('<b>' + FISH[got].name + '</b>! 아주 귀한 물고기예요' + two, { rare: true });
    }
    return okay(eul(FISH[got].name) + ' 낚았어요' + two, { perfect: g === 'perfect' });
  }
  function hungAt(world, room, side, col, row){
    const P = placed(world, room);
    for (const k in P){
      const q = parseWall(k);
      if (q && q.side === (side ? 1 : 0) && q.col === col && q.row === row) return k;
    }
    return null;
  }
  function canHang(world, room, f, side, col, row){
    const R2 = ROOMS[room], F = FURNITURE[f];
    if (!R2 || !F || !F.wall) return false;
    if (!(col >= 0 && col < wallCols(world, room, side))) return false;
    if (!(row >= 0 && row < wallRowsFor(f))) return false;
    return !hungCol(world, room, side, col);
  }
  function hang(world, mine, room, f, side, col, row, pic){
    const R2 = ROOMS[room], F = FURNITURE[f];
    if (!R2 || !F) return fail('놓을 수 없어요');
    if (R2.owner && R2.owner !== mine.key) return fail('여기는 ' + NAME[R2.owner] + '의 방이에요');
    if (!F.wall) return fail(eun(F.name) + ' 바닥에 놓는 거예요');
    if (!(row >= 0 && row < wallRowsFor(f))) return fail(eun(F.name) + ' 길어서 윗단에만 걸려요');
    if (!canHang(world, room, f, side, col, row)) return fail('그 자리에는 걸 수 없어요');
    if (F.pic && !okPic(pic)) return fail('담을 그림을 먼저 골라요');
    if (!take(mine, 'f:' + f)) return fail('그 가구가 없어요');
    const it = { f: f, by: mine.key, r: 0 };
    if (F.pic) it.pic = pic;
    world.house[room][wallKey(side, col, row)] = it;
    return okay(eul(F.name) + ' 벽에 걸었어요');
  }
  function moveHang(world, mine, room, k, side, col, row){
    const R2 = ROOMS[room], P = world.house && world.house[room];
    if (!R2 || !P || !P[k]) return fail('그 자리에 아무것도 없어요');
    if (R2.owner && R2.owner !== mine.key) return fail('여기는 ' + NAME[R2.owner] + '의 방이에요');
    const it = P[k], F = FURNITURE[it.f];
    if (!F.wall) return fail(eun(F.name) + ' 벽에 건 것이 아니에요');
    if (!(col >= 0 && col < wallCols(world, room, side))) return fail('벽 밖이에요');
    if (!(row >= 0 && row < wallRowsFor(it.f))) return fail(eun(F.name) + ' 길어서 윗단에만 걸려요');
    const nk = wallKey(side, col, row);
    if (nk === k) return fail('제자리예요');
    const o = hungCol(world, room, side, col);
    if (o && o !== k) return fail('그 자리에는 다른 것이 걸려 있어요');
    delete P[k]; P[nk] = it;
    return okay(eul(F.name) + ' 옮겼어요');
  }
  function canPlace(world, room, f, x, y, r){
    const R = roomBox(world, room), F = FURNITURE[f];
    if (!R || !F) return false;
    const b = furnBox(f, r);
    if (x < 0 || y < 0 || x + b.w > R.w || y + b.h > R.h) return false;
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) if (occupied(world, room, x + i, y + j)) return false;
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
  function cozyLevel(world){ const c = cozyOf(world); let l = 0; COZY_LEVELS.forEach((t, i) => { if (c >= t) l = i; }); return l; }
  function canCook(mine, d){
    const D = DISHES[d];
    return Object.keys(D.need).every(k => countOf(mine, k) >= D.need[k]);
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
    const pool = CROP_IDS.filter(c => CROPS[c].seed > 0 && CROPS[c].season.indexOf(cal.season) >= 0 && farmOk(world, CROPS[c]));   // 이 농장에서 못 심는 작물은 주문하지 않는다
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
  function festivalOpen(world, now){ const cal = calendar(world, now); return cal.dayOfSeason >= cal.len - 1; }   // 마지막 이틀
  function festivalKey(world, now){ const cal = calendar(world, now); return 'y' + cal.year + cal.season; }
  // 물건 하나가 축제에 얼마나 보태나. 0 이면 받지 않는다.
  function festivalWorth(fest, id, world, now){
    const F = FESTIVALS[fest], [k, v] = id.split(':');
    if (F.want === 'flower') return (k === 'crop' || k === 'gold') && CROPS[v].flower ? 1 : 0;
    if (F.want === 'snowball') return id === 'snowball' ? 1 : 0;
    if (F.want === 'value') return k === 'crop' || k === 'gold' || k === 'giant' ? sellPrice(id, world, now) : 0;
    if (F.want === 'crop:watermelon') return v === 'watermelon' ? (k === 'giant' ? 3 : k === 'gold' ? 2 : k === 'crop' ? 1 : 0) : 0;
    return 0;
  }
  // ---------- 이사 ----------
  function moveState(world, mine){
    const next = FARMS[nextFarmIndex(world)] || null, ask = world.moveAsk || null;
    // 다른 농장 전용 꾸미개는 여기서 살 수 없으니 세지 않는다
    const here = farmOf(world).id, ids = Object.keys(DECOR).filter(d => !DECOR[d].farm || DECOR[d].farm === here);
    const have = ids.filter(d => world.decor && world.decor[d]).length;
    const conds = [{ id: 'decor', icon: '🌼', name: '꾸미개', have, need: ids.length, unit: '개' }];
    if (next){
      ['sua', 'yona', 'living'].forEach(r => conds.push({ id: 'room:' + r, icon: '🛋️', name: ROOMS[r].name + ' 가구',
        have: Object.keys((world.house && world.house[r]) || {}).length, need: next.room, unit: '개' }));
      conds.push({ id: 'animals', icon: '🐾', name: '동물', have: (world.animals || []).length, need: next.animals, unit: '마리' });
    }
    conds.forEach(c => { c.left = Math.max(0, c.need - c.have); });
    return { farm: farmOf(world), next, have, need: ids.length, conds, ready: !!next && conds.every(c => !c.left),
      ask, mineAsked: !!(ask && ask.by === mine.key), otherAsked: !!(ask && ask.by !== mine.key) };
  }
  // 남은 조건을 한 줄로 — 「꾸미개 4개 · 연아 방 가구 3개 · 동물 2마리」
  function moveLeftText(s){ return s.conds.filter(c => c.left).map(c => c.name + ' ' + c.left + c.unit).join(' · '); }
  // 먼저 누른 아이는 묻기만 하고, 자매가 「좋아」를 누르면 그때 떠난다 — 둘의 농장이라 혼자 못 옮긴다
  /* keep: 옛 농장에 두고 가는 꾸미개 가운데 하나를 「추억」으로 들고 간다(2026-09-30 로키즈 「이사 보상」).
     먼저 묻는 아이가 고르고, 들고 온 추억은 다음 이사 때도 늘 따라간다(decor[id].keep = 처음 놓였던 농장). */
  function askMove(world, mine, now, keep){
    const s = moveState(world, mine);
    const D = world.decor || {};
    if (keep && !(D[keep] && !D[keep].keep)) return fail('들고 갈 추억은 지금 농장에 놓인 꾸미개에서 골라요');
    if (!s.next) return fail('여기가 마지막 농장이에요');
    if (!MOVE_OPEN) return fail(s.next.name + '은 아직 짓고 있어요. 곧 열려요');
    if (!s.ready) return fail('이사까지 ' + moveLeftText(s) + ' 더 있어야 해요');
    if (s.mineAsked) return fail(NAME[OTHER[mine.key]] + '의 대답을 기다려요');
    if (s.otherAsked) return moveFarm(world, mine, s, now, s.ask.keep || keep);
    world.moveAsk = { by: mine.key, on: dayKey(now) };
    if (keep) world.moveAsk.keep = keep;
    logAdd(world, mine.key, NAME[mine.key] + '가 ' + s.next.name + '으로 이사 가자고 했어요', now, true);
    return okay(NAME[OTHER[mine.key]] + '에게 물어봤어요. 둘 다 좋다고 하면 ' + s.next.icon + ' ' + s.next.name + '으로 떠나요');
  }
  function cancelMove(world, mine, now){
    if (!world.moveAsk) return fail('이사 이야기가 없어요');
    delete world.moveAsk;
    logAdd(world, mine.key, NAME[mine.key] + '가 이사는 다음에 가자고 했어요', now, true);
    return okay('이사는 다음에 가기로 했어요');
  }
  function moveFarm(world, mine, s, now, keep){
    const left = [];
    Object.keys(world.buildings).forEach(b => {
      const B = world.buildings[b];
      if (MOVE_KEEP[b] || !B || !B.done) return;
      left.push(b); delete world.buildings[b];
    });
    // 옛 농장을 언제든 다시 구경할 수 있게 놓인 자리까지 통째로 적어 둔다(2026-09-28 로키즈 요청)
    const kept = {}; left.forEach(b => { kept[b] = { done: true }; });
    world.past.push({ farm: s.farm.id, until: dayKey(now), decor: JSON.parse(JSON.stringify(world.decor || {})),
      buildings: kept, layout: JSON.parse(JSON.stringify(world.layout || {})), expand: world.expand || 0 });
    const from = fieldCells(world), old = world.decor || {};
    const path = movePath(world).map(f => f.id);   // 건너뛴 농장의 아기 동물도 데려가려고 넘기기 전에 적는다
    world.decor = {}; world.layout = {}; world.farm = nextFarmIndex(world);
    // 추억 — 예전에 들고 온 것과 이번에 고른 것. 자리는 새 농장의 처음 자리에 선다
    Object.keys(old).forEach(d => { if (old[d] && (old[d].keep || d === keep)) world.decor[d] = Object.assign({}, old[d], { keep: old[d].keep || s.farm.id }); });
    // 새 농장은 밭 모양이 달라 칸 이름(좌표)이 바뀐다 — 같은 넓히기 차례끼리 순서대로 옮겨 심는다(칸 수는 차례마다 같다).
    // 온실 칸(g…)은 그대로. 커다란 작물 짝이 옮긴 뒤 이웃이 아니면 짝을 풀어 보통 작물로 둔다
    const to = fieldCells(world), map = {};
    from.forEach((c, i) => { if (to[i]) map[c.id] = to[i].id; });
    const moved = o => { const n = {}; Object.keys(o || {}).forEach(id => { const t = id[0] === 'g' ? id : map[id]; if (t) n[t] = o[id]; }); return n; };
    world.plots = moved(world.plots); world.sprinklers = moved(world.sprinklers);
    Object.keys(world.plots).forEach(id => {
      const p = world.plots[id];
      if (!p.pairOf || id[0] === 'g') return;
      p.pairOf = map[p.pairOf] || null;
      if (!p.pairOf || neighborsOf(id).indexOf(p.pairOf) < 0) Object.assign(p, { giant: false, pairOf: null });
    });
    delete world.moveAsk;
    ['sua', 'yona'].forEach(k => { (world.mail[k] = world.mail[k] || []).push({ id: 'coins', n: MOVE_GIFT, from: 'move', note: s.next.name + ' 이사 선물', t: now }); });
    // 새 식구 — 그 농장에서만 만나는 동물이 새끼로 따라온다. 우리가 없으면 빈 터에서 논다(다른 동물처럼)
    Object.keys(ANIMALS).filter(k => path.indexOf(ANIMALS[k].gift) >= 0).forEach((gk, i) => world.animals.push({ id: 'a' + now + 'g' + (i || ''), kind: gk, name: '아기 ' + ANIMALS[gk].name, by: mine.key, born: dayKey(now), love: 0, pet: [], since: 0, baby: true, gift: true }));
    logAdd(world, mine.key, '수아와 연아가 ' + s.next.name + '으로 이사 왔어요', now);
    return okay(s.next.icon + ' <b>' + s.next.name + '</b>으로 이사 왔어요! 우편함에 이사 선물이 있어요. 건물은 둘이 다시 지어요', { moved: true });
  }
  function medalState(world, mine){
    return MEDALS.map(M => ({
      id: M.id, name: M.name, icon: M.icon, desc: M.desc, coins: M.coins, gift: M.gift || null,
      got: (mine.medals || []).indexOf(M.id) >= 0,
      ready: !!M.need(world, mine),
    }));
  }
  function claimMedal(world, mine, id, now){
    const M = MEDALS.find(x => x.id === id); if (!M) return fail('없는 훈장이에요');
    mine.medals = mine.medals || [];
    if (mine.medals.indexOf(id) >= 0) return fail('이미 받은 훈장이에요');
    if (!M.need(world, mine)) return fail('아직이에요 — ' + M.desc);
    mine.medals.push(id); mine.coins += M.coins; mine.xp += 25;
    if (M.gift) give(mine, M.gift.id, M.gift.n);
    // 첫 훈장에는 걸어 둘 자리가 따라온다 — 받은 것이 가방에만 쌓이면 자랑할 데가 없다
    const first = mine.medals.length === 1;
    if (first) give(mine, 'f:medalcase', 1);
    if (M.gift && M.gift.id.slice(0, 2) === 'f:') noteFurn(world, mine, M.gift.id, now);
    if (first) noteFurn(world, mine, 'f:medalcase', now);
    logAdd(world, mine.key, NAME[mine.key] + '가 훈장 「' + M.name + '」을 받았어요', now);
    return okay(M.icon + ' <b>' + M.name + '</b> 훈장! ' + M.coins + ' 동전'
      + (M.gift ? ' · ' + itemName(M.gift.id) + ' ' + M.gift.n + '개' : '')
      + (first ? ' · <b>훈장 걸이</b>도 왔어요. 집에 걸어요' : ''), { medal: true, first: first });
  }
  function peddlerStock(world, now){
    if (!peddlerHere(world, now)) return [];
    const key = dayKey(now);
    const furn = Object.keys(FURNITURE).filter(f => !FURNITURE[f].rare && FURNITURE[f].cost > 0 && !FURNITURE[f].season);
    const fPick = furn[Math.floor(prand('pf' + key) * furn.length)];
    const pool = [
      { slot: 'star',  id: 'seed:star', n: 1, cost: 600,  desc: '어디서도 안 파는 씨앗이에요' },
      { slot: 'fert',  id: 'fert',      n: 5, cost: 120,  desc: '비료 다섯 개 묶음' },
      { slot: 'sprk',  id: 'sprinkler', n: 1, cost: 1200, desc: '가게보다 300 싸요' },
      { slot: 'furn',  id: 'f:' + fPick, n: 1, cost: Math.round(FURNITURE[fPick].cost * 0.8), desc: '값을 깎아 왔어요' },
      { slot: 'box',   id: 'box',       n: 1, cost: 300,  desc: '열어 보기 전엔 나도 몰라요' },
    ];
    // 다섯 중 셋. 날짜로 고르니 둘이 같은 것을 본다.
    const pick = [];
    const left = pool.slice();
    for (let i = 0; i < 3; i++){
      const j = Math.floor(prand('pp' + key + i) * left.length);
      pick.push(left.splice(j, 1)[0]);
    }
    return pick;
  }
  function peddlerGot(mine, now, slot){
    return mine.pedDay === dayKey(now) && (mine.pedGot || {})[slot];
  }
  function peddlerWant(world, now){
    if (!peddlerHere(world, now)) return null;
    const key = dayKey(now);
    // 다른 농장 전용(클라우드베리·얼음 물고기)은 거기 살 때만 — 뒤에 붙어서 앞 농장의 뽑기 차례도 안 바뀐다
    const pool = CROP_IDS.filter(c => farmOk(world, CROPS[c])).map(c => 'crop:' + c)
      .concat(['egg', 'bigegg', 'duckegg', 'milk', 'goldmilk', 'wool', 'honey', 'truffle', 'angora', 'downfeather', 'gem', 'berry'])
      .concat(FISH_IDS.filter(f => !FISH[f].junk && farmOk(world, FISH[f])).map(f => 'fish:' + f));
    return { id: pool[Math.floor(prand('pw' + key) * pool.length)], mult: PED_WANT_MULT, max: PED_WANT_MAX };
  }
  // 오늘 산 자리·판 개수는 날이 바뀌면 함께 지운다
  function pedToday(mine, now){
    const key = dayKey(now);
    if (mine.pedDay !== key){ mine.pedDay = key; mine.pedGot = {}; mine.pedSold = 0; }
  }
  function peddlerSoldLeft(mine, now){
    return mine.pedDay === dayKey(now) ? Math.max(0, PED_WANT_MAX - (mine.pedSold || 0)) : PED_WANT_MAX;
  }
  function sellToPeddler(world, mine, n, now){
    if (afloat(world)) return fail('행상인은 큰물 위에 없어요');
    const want = peddlerWant(world, now);
    if (!want) return fail('행상인은 오늘 안 왔어요');
    const left = peddlerSoldLeft(mine, now);
    if (left <= 0) return fail('오늘 살 만큼 샀대요. 다음에 또 올게요');
    n = Math.max(1, Math.min(Math.floor(n || 1), left));
    if (!takeAny(mine, want.id, n)) return fail(itemName(want.id) + '이 그만큼 없어요');
    pedToday(mine, now);
    mine.pedSold = (mine.pedSold || 0) + n;
    const each = sellPrice(want.id, world, now) * want.mult;
    mine.coins += each * n; bump(mine, 'sold', n, now);
    return okay(itemName(want.id) + ' ' + n + '개를 <b>두 배</b>로 팔았어요 — ' + (each * n) + ' 동전', { sold: true });
  }
  function openBox(world, mine, now){
    const r = prand('bx' + mine.key + dayKey(now) + (mine.boxes || 0));
    mine.boxes = (mine.boxes || 0) + 1;
    const P = BOX_PRIZES[Math.floor(r * BOX_PRIZES.length)];
    noteDex(world, mine, 'ev:box', now);
    if (P.id === 'coins') mine.coins += P.n;
    else { give(mine, P.id, P.n); if (DEX_GOODS.indexOf(P.id) >= 0) noteDex(world, mine, P.id, now, P.n); }
    return P;
  }
  function catchFirefly(world, mine, now){
    if (!fireflyNight(world, now)) return fail('반딧불이는 여름·가을 밤에만 날아요');
    if (fireflyLeft(mine, now) <= 0) return fail('오늘은 그만 — 나머지는 내일 또 만나요');
    const key = dayKey(now);
    if (mine.ffDay !== key){ mine.ffDay = key; mine.ffGot = 0; }
    mine.ffGot++;
    give(mine, 'firefly', 1); mine.xp += 3; bump(mine, 'caught', 1, now);
    noteDex(world, mine, 'firefly', now);
    return okay('반딧불이를 잡았어요 ✨ (오늘 ' + mine.ffGot + '/' + FIREFLY_MAX + ')');
  }
  // 오로라 빛 조각 줍기 — 기운은 안 든다. 줍는 몫은 각자(mine.shard)
  // 사막에서는 같은 틀로 낮 모래 위의 사막 장미 돌을 줍는다(PICKS)
  function pickShard(world, mine, i, now){
    const PK = PICKS[farmOf(world).id], nm = PK && GOODS[PK.item] ? GOODS[PK.item].name : '빛 조각';
    if (!PK) return fail('빛 조각은 오로라 농장에만 떨어져요');
    if (isNight(now) !== PK.night) return fail(nm + (PK.night ? '은 밤에만 떨어져 있어요' : '은 낮에만 모래 위에 보여요'));
    const key = dayKey(now), q = shardSpots(world, now).find(s => s.i === i);
    if (!q) return fail('여기엔 빛 조각이 없어요');
    if (!mine.shard || mine.shard.day !== key) mine.shard = { day: key, got: [] };
    if (mine.shard.got.indexOf(i) >= 0) return fail('이미 주운 조각이에요');
    mine.shard.got.push(i);
    give(mine, PK.item, 1); mine.xp += 3;
    noteDex(world, mine, PK.item, now);
    return okay('<b>' + nm + '</b>' + (jong(nm) ? '을' : '를') + ' 주웠어요 ✨ (오늘 ' + mine.shard.got.length + '/' + shardMax(world) + ')');
  }
  function fireSit(world, mine, now){
    if (!(world.decor && world.decor.firepit)) return fail('모닥불이 아직 없어요');
    if (!isNight(now)) return fail('불은 밤에 피워요');
    const key = dayKey(now);
    world.fire = world.fire || {};
    if (world.fire.day !== key) world.fire = { day: key, by: {} };
    if (world.fire.by[mine.key]) return fail('오늘은 이미 앉았다 왔어요');
    world.fire.by[mine.key] = true;
    const both = world.fire.by.sua && world.fire.by.yona;
    const add = FIRE_ENERGY + (both ? FIRE_TOGETHER : 0);
    mine.energy = Math.min(maxEnergy(world, mine), mine.energy + add);
    // 둘이서 모닥불은 둘이 함께 한 일이라 농장에 적는다 — 먼저 앉은 아이는 다시 앉을 수 없어 제 칸에 적을 길이 없다
    if (both){ logAdd(world, mine.key, '둘이 나란히 모닥불 앞에서 별을 봤어요', now); if (!world.fireFirst) world.fireFirst = dayKey(now); }
    return okay(both ? '둘이 나란히 앉아 별을 봤어요. 기운 +' + add + ' 🔥' : '불 앞에 앉아 별을 봤어요. 기운 +' + add
      + ' · ' + NAME[OTHER[mine.key]] + '도 앉으면 더 따뜻해요', { both: both });
  }
  function missionOf(world, mine, now){
    const key = dayKey(now);
    let list = MISSIONS.filter(m => (m.id !== 'pet' || (world.animals || []).length) && (m.id !== 'fish' || (world.decor && world.decor.pond))
      && (m.id !== 'firefly' || FIREFLY_SEASONS.indexOf(calendar(world, now).season) >= 0));
    const m = list[Math.floor(prand('m' + key + mine.key) * list.length)];
    const day = mine.day && mine.day.key === key ? mine.day : { key, stats: {} };
    return { m, got: day.stats[m.stat] || 0, done: !!(day.missionDone) };
  }
  function xpForLevel(l){ return (l - 1) * (l - 1) * 30; }
  /* 일기장(world.diary) — 일지(log)는 24줄에서 잘리지만 큰 일은 여기 오래 남는다(2026-10-09 로키즈 「도감 강화」).
     쪽지·선물·이사 묻기처럼 날마다 여러 번 생기는 일은 small 로 넘겨 일기장에 안 적는다.
     일기장이 처음 생길 때는 그때까지의 일지에서 작은 일을 빼고 옮겨 담는다. */
  const DIARY_MAX = 120;      // 농장 세이브 한도(60KB) 안에서 넉넉히 — 한 줄이 90바이트쯤
  function logAdd(world, who, text, now, small){
    const e = { t: now == null ? Date.now() : now, who, text };
    world.log.unshift(e);
    if (world.log.length > LOG_MAX) world.log.length = LOG_MAX;
    if (small) return;
    if (!Array.isArray(world.diary)) world.diary = world.log.slice(1).filter(l => !/보냈어요|이사 가자고|이사는 다음에/.test(l.text));
    world.diary.unshift(e);
    if (world.diary.length > DIARY_MAX) world.diary.length = DIARY_MAX;
  }
  /* 도감 기록(2026-10-09 로키즈 「도감 강화 전부」) — dex 는 「모았다」만 안다. 언제·어디서·몇 번은 dexAt 에 적는다.
     mine.dexAt[키] = '날.농장.횟수.덤' 한 글자열. 날은 261007(26년 10월 7일, 모르면 0), 농장은 FARMS 번호(모르면 빈칸),
     덤은 작물이면 거둔 계절 비트(봄 1·여름 2·가을 4·겨울 8), 물고기면 가장 큰 cm.
     객체로 적으면 칸 150여 개에 아이 세이브 한도(16KB, farm_commit)에 닿아서 짧게 줄였다.
     이 기록이 생기기 전에 모은 것은 날·농장이 없다 — 화면은 「예전에 만남」으로 둔다. 지어 넣지 않는다.
     가구는 둘이 함께 쓰는 집 물건이라 농장(world.furnAt)에 적는다 — noteFurn. */
  const DEX_GOODS = ['egg', 'bigegg', 'duckegg', 'downfeather', 'milk', 'goldmilk', 'wool', 'truffle', 'angora', 'gem', 'honey',
    'berry', 'snowball', 'firefly', 'shard', 'moss', 'pinecone', 'date', 'sandrose'];
  const DEX_MAIL = ['santa', 'genie', 'postcard', 'move'];     // 축제 상은 농장 축제 기록(world.festival)으로 본다
  function dexRec(mine, id){
    const v = (mine.dexAt || {})[id];
    if (typeof v !== 'string') return null;
    const [d, f, n, x] = v.split('.'), F = f === '' ? null : FARMS[Number(f)];
    return { d: /^\d{6}$/.test(d) ? '20' + d.slice(0, 2) + '-' + d.slice(2, 4) + '-' + d.slice(4) : null, f: F ? F.id : null, n: Number(n) || 0, x: Number(x) || 0 };
  }
  // opt — s: 거둔 계절 비트 · cm: 물고기 크기 · farm: 처음 만난 농장이 지금 농장이 아닐 때(옛 농장 선물)
  function noteDex(world, mine, id, now, n, opt){
    const o = opt || {}, at = mine.dexAt || (mine.dexAt = {});
    let r = dexRec(mine, id) || { d: null, f: null, n: 0, x: 0 };
    if (mine.dex.indexOf(id) < 0){ mine.dex.push(id); r = { d: dayKey(now == null ? Date.now() : now), f: o.farm || farmOf(world).id, n: 0, x: 0 }; }
    r.n += n == null ? 1 : n;
    if (o.s) r.x |= o.s;
    if (o.cm) r.x = Math.max(r.x, o.cm);
    at[id] = [r.d ? r.d.slice(2).replace(/-/g, '') : 0, r.f ? FARMS.findIndex(F => F.id === r.f) : '', r.n, r.x].join('.');
    return r;
  }
  function noteFurn(world, mine, id, now){
    const v = String(id).slice(2), at = world.furnAt || (world.furnAt = {});
    if (!at[v]) at[v] = { d: dayKey(now == null ? Date.now() : now), by: mine.key, f: farmOf(world).id };
  }
  function give(mine, id, n){ mine.inv[id] = (mine.inv[id] || 0) + (n == null ? 1 : n); }
  function subsOf(id){ return id.slice(0, 5) === 'crop:' ? ['gold:' + id.slice(5)] : []; }
  function countOf(mine, id){ return (mine.inv[id] || 0) + subsOf(id).reduce((a, s) => a + (mine.inv[s] || 0), 0); }
  function takeAny(mine, id, n){
    n = n == null ? 1 : n;
    if (countOf(mine, id) < n) return false;
    let left = n;
    [id].concat(subsOf(id)).forEach(k => {
      if (left <= 0) return;
      const u = Math.min(mine.inv[k] || 0, left);
      if (u){ take(mine, k, u); left -= u; }
    });
    return true;
  }
  function take(mine, id, n){
    n = n == null ? 1 : n;
    if ((mine.inv[id] || 0) < n) return false;
    mine.inv[id] -= n;
    if (mine.inv[id] <= 0) delete mine.inv[id];
    return true;
  }
  function bump(mine, stat, n, now){
    const key = dayKey(now);
    if (!mine.day || mine.day.key !== key) rollDay(mine, key);
    mine.day.stats[stat] = (mine.day.stats[stat] || 0) + (n == null ? 1 : n);
    mine.stats[stat] = (mine.stats[stat] || 0) + (n == null ? 1 : n);
  }
  function markPlayed(mine, now){
    const key = dayKey(now);
    if (mine.playDays.indexOf(key) < 0){ mine.playDays.push(key); if (mine.playDays.length > PLAY_DAYS_MAX) mine.playDays.splice(0, mine.playDays.length - PLAY_DAYS_MAX); }
    mine.lastPlay = key;
  }
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
    if ((world.sprinklers || {})[id]) return fail('스프링클러가 놓인 칸이에요');
    const p = world.plots[id] || (world.plots[id] = {});
    if (!p.tilled) return fail('먼저 땅을 갈아요');
    if (p.crop) return fail('이미 무언가 자라고 있어요');
    if (!farmOk(world, C)) return fail(eun(C.name) + ' ' + FARMS.find(f => f.id === C.farm).name + '에서만 자라요');
    const cal = calendar(world, now), gh = id[0] === 'g';
    if (!gh && !C.hardy && C.season.indexOf(cal.season) < 0) return fail(eun(C.name) + ' ' + SEASON_NAME[cal.season] + '에 자라지 않아요');
    if (!take(mine, 'seed:' + crop)) return fail(C.name + ' 씨앗이 없어요');
    Object.assign(p, { crop, by: mine.key, plantedAt: now, tick: now, progress: 0, picks: 0, pickedAt: 0, wilted: false, giant: false });
    delete p.wet;
    p.care = 0;                                        // 새로 심으면 별도 처음부터
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
    p.wh = waterHours(world); p.wet = now + p.wh * H;
    p.care = (p.care || 0) + 1;                        // 제때 준 물이 별이 된다
    mine.xp += XP.water; bump(mine, 'watered', 1, now);
    return okay('물을 줬어요');
  }
  // 스프링클러를 밭 한 칸에 놓는다. 온실은 늘 촉촉하니 받지 않는다.
  function putSprinkler(world, mine, id, item){
    const S = SPRINKLERS[item] || SPRINKLER;
    if (id[0] === 'g') return fail('온실은 물을 안 줘도 돼요');
    if (!plotOpen(world, id)) return fail('밭이 아니에요');
    world.sprinklers = world.sprinklers || {};
    if (world.sprinklers[id]) return fail('여기 이미 있어요');
    const p = world.plots[id];
    if (p && p.crop) return fail('심어 둔 칸에는 못 놓아요');
    if (!take(mine, S.item)) return fail(S.name + '가 없어요');
    const put = { by: mine.key };
    if (S.item === 'sprinkler2') put.k = 'good';        // 없으면 보통 것 — 옛 세이브가 그대로 산다
    world.sprinklers[id] = put;
    return okay(eul(S.name) + ' 놓았어요. 아침마다 둘레 ' + S.reach + '칸을 적셔요');
  }
  function pullSprinkler(world, mine, id){
    if (!world.sprinklers || !world.sprinklers[id]) return fail('여기 스프링클러가 없어요');
    const S = sprinklerOf(world.sprinklers[id]);
    delete world.sprinklers[id];
    give(mine, S.item, 1);
    return okay(eul(S.name) + ' 걷었어요');
  }
  // 스프링클러가 적시는 칸 — 자기 칸은 빼고 둘레 넷. 밭 밖은 셈에서 뺀다.
  function sprinkled(world){
    const out = {};
    Object.keys(world.sprinklers || {}).forEach(id => {
      const around = sprinklerOf(world.sprinklers[id]).reach >= 8 ? ringOf(id) : neighborsOf(id);
      around.forEach(n => { if (plotOpen(world, n) && !(world.sprinklers || {})[n]) out[n] = true; });
    });
    return Object.keys(out);
  }
  function sprinklerDay(world, now){
    const ids = sprinkled(world);
    let n = 0;
    ids.forEach(id => {
      const p = world.plots[id];
      if (!p || !p.tilled) return;
      if ((p.wet || 0) > now) return;                  // 아직 촉촉하면 그냥 둔다
      tickPlot(p, now, false);
      p.wh = waterHours(world); p.wet = now + p.wh * H;
      if (p.crop) p.care = (p.care || 0) + 1;
      n++;
    });
    return n;
  }
  function fertilize(world, mine, id, now){
    const p = world.plots[id];
    if (!p || !p.tilled) return fail('비료를 줄 땅이 아니에요');
    if (p.fert) return fail('이미 비료를 줬어요');
    if (!take(mine, 'fert')) return fail('비료가 없어요. 가게에서 살 수 있어요');
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
      return okay(eul(((p.pickedAt ? '딴 지' : '심은 지') + ' 일주일이 지나 시든 ') + C.name) + ' 뽑았어요');
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
      noteDex(world, mine, 'giant:' + cropId, now);
      logAdd(world, mine.key, '둘이서 큰 ' + eul(C.name) + ' 뽑았어요!', now);
      return okay('둘이서 ' + eul('<b>큰 ' + C.name + '</b>') + ' 뽑았어요!', { giant: true });
    }
    const star = starOf(p, gh);
    const n = C.yield + (star >= 2 ? 1 : 0);   // 잘 돌본 작물은 한 개 더
    const cropId = p.crop, gold = star >= 3;
    give(mine, (gold ? 'gold:' : 'crop:') + cropId, n);
    mine.xp += XP.harvest + (gold ? 4 : 0); bump(mine, 'harvested', n, now);
    // 계절 별 — 거둔 계절을 비트로 모은다(봄 1·여름 2·가을 4·겨울 8). 온실이면 철 아닌 때도 거둔다
    noteDex(world, mine, cropId, now, n, { s: 1 << SEASONS.indexOf(calendar(world, now).season) });
    if (gold) noteDex(world, mine, 'gold:' + cropId, now, n);
    const say = gold ? '<b>반짝 ' + C.name + '</b> ' + n + '개! 잘 돌봤네요'
              : star === 2 ? C.name + ' ' + n + '개를 거뒀어요 (잘 돌봐서 한 개 더!)'
              : C.name + ' ' + n + '개를 거뒀어요';
    if (gold) logAdd(world, mine.key, NAME[mine.key] + '가 반짝 ' + eul(C.name) + ' 거뒀어요!', now);
    if (C.regrow){
      p.picks = (p.picks || 0) + 1;
      p.progress = growTime(p) - C.regrow * H;         // 다시 열릴 때까지
      p.tick = now; p.care = 0;                        // 다음 열매는 다시 돌봐야 한다
      p.pickedAt = now;                                // 시들기까지 일주일도 여기서 다시 센다
      return okay(say + ' 또 열려요', { n, star });
    }
    Object.assign(p, { crop: null, fert: false, progress: 0, care: 0 });
    return okay(say, { n, star, gold });
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
    if (afloat(world)) return fail('섬이 물에 잠겨 있어요');
    const N = nodeDef(world, node);
    if (!N) return fail('없는 자리예요');
    const sea = calendar(world, now).season;
    if (N.season && N.season.indexOf(sea) < 0) return fail(SEASON_NAME[sea] + (N.kind === 'snow' ? '에는 눈이 없어요' : '에는 열매가 없어요'));   // 풍경 덤불은 겨울에도 서 있다
    if (!nodeReady(world, mine, node, now)) return fail('아직 다시 자라지 않았어요');
    if (!spend(mine, N.cost)) return fail('기운이 없어요');
    mine.nodes[node] = dayKey(now);
    Object.keys(N.give).forEach(k => { give(mine, k, N.give[k]); if (DEX_GOODS.indexOf(k) >= 0) noteDex(world, mine, k, now, N.give[k]); });
    mine.xp += XP.gather; bump(mine, 'gathered', 1, now);
    const got = Object.keys(N.give).map(k => itemName(k) + ' ' + N.give[k] + '개').join(', ');
    // 산골 농장 바위는 네 번에 한 번쯤 반짝돌이 박혀 나온다 — 그날·그 아이·그 바위로 정해져 새로 고쳐도 같다
    if (N.kind === 'rock' && farmOf(world).id === 'mountain' && prand('gem' + mine.key + dayKey(now) + node) < 0.25){
      give(mine, 'gem', 1); noteDex(world, mine, 'gem', now);
      return okay(got + '를 얻었어요. <b>반짝돌</b>도 하나 박혀 있었어요!', { gem: true });
    }
    return okay(got + '를 얻었어요');
  }
  function buy(world, mine, id, now){
    if (afloat(world)) return fail('방주 안에는 가게가 없어요. 새 땅에 내리면 다시 열려요');
    const [k, v] = id.split(':');
    if (k === 'seed'){
      const C = CROPS[v];
      if (!C || !C.seed) return fail('파는 씨앗이 아니에요');
      if (C.half && C.half !== mine.key) return fail('이 씨앗은 ' + NAME[C.half] + '의 가게에만 있어요. 선물로 받아야 해요');
      if (!farmOk(world, C)) return fail(C.name + ' 씨앗은 ' + FARMS.find(f => f.id === C.farm).name + '에서만 팔아요');
      if ((C.lv || 1) > levelOf(mine.xp)) return fail('농장 레벨 ' + C.lv + '부터 살 수 있어요');
      /* 지금 심을 수 없는 씨앗은 팔지 않는다. 사 놓고 심지 못하면 동전만 버리는 셈이다.
         온실이 있으면 어느 계절이든 자라니 그때는 열어 준다. */
      const cal2 = calendar(world, now);
      if (!C.hardy && C.season.indexOf(cal2.season) < 0 && !(world.buildings.greenhouse && world.buildings.greenhouse.done))
        return fail(SEASON_NAME[cal2.season] + '에는 ' + C.name + ' 씨앗을 살 수 없어요. ' + C.season.map(s => SEASON_NAME[s]).join('·') + '에 오세요');
      if (mine.coins < C.seed) return fail('동전이 모자라요');
      mine.coins -= C.seed; give(mine, id, 1);
      return okay(C.name + ' 씨앗을 샀어요');
    }
    if (k === 'f'){
      const F = FURNITURE[v];
      if (!F || F.rare) return fail('파는 가구가 아니에요');
      if (F.season && calendar(world, now).season !== F.season) return fail(F.name + '은 ' + SEASON_NAME[F.season] + '에만 팔아요');
      if (F.farm && F.farm !== farmOf(world).id) return fail(F.name + '은 ' + FARMS.find(f => f.id === F.farm).name + '에서만 팔아요');
      if (mine.coins < F.cost) return fail('동전이 모자라요');
      mine.coins -= F.cost; give(mine, id, 1); noteFurn(world, mine, id, now);
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
      if (A.gift) return fail(A.name + (jong(A.name) ? '은 ' : '는 ') + FARMS.find(f => f.id === A.gift).name + '으로 이사 갈 때 새끼로 따라와요');
      if (!(world.buildings[A.need] && world.buildings[A.need].done)) return fail(eul(BUILDINGS[A.need].name) + ' 먼저 지어요');
      const here = world.animals.filter(a => ANIMALS[a.kind].need === A.need).length;
      if (here >= animalMax(world, A.need)) return fail(ee(BUILDINGS[A.need].name) + ' 꽉 찼어요');
      if (mine.coins < A.cost) return fail('동전이 모자라요');
      mine.coins -= A.cost;
      world.animals.push({ id: 'a' + now, kind: v, name: A.name, by: mine.key, born: dayKey(now), love: 0, pet: [], since: 0 });
      return okay(ee(A.name) + ' 왔어요. 이름을 지어 줘요', { animal: world.animals[world.animals.length - 1] });
    }
    if (k === 'deco'){
      const Dc = DECOR[v]; if (!Dc) return fail('없는 꾸미개예요');
      if (Dc.farm && Dc.farm !== farmOf(world).id) return fail(Dc.name + '은 ' + FARMS.find(f => f.id === Dc.farm).name + '에서만 팔아요');
      world.decor = world.decor || {};
      if (world.decor[v]) return fail('이미 있어요');
      if (levelOf(mine.xp) < Dc.lv) return fail('농장 레벨 ' + Dc.lv + '부터');
      if (mine.coins < Dc.cost) return fail('동전이 모자라요');
      mine.coins -= Dc.cost; world.decor[v] = { by: mine.key, on: dayKey(now) }; mine.xp += XP.expand;
      logAdd(world, mine.key, NAME[mine.key] + '가 농장에 ' + Dc.name + '을 놓았어요', now);
      return okay(ee(Dc.name) + ' 생겼어요');
    }
    if (k === 'ped'){
      if (!peddlerHere(world, now)) return fail('행상인은 오늘 안 왔어요');
      const it = peddlerStock(world, now).find(x => x.slot === v);
      if (!it) return fail('오늘은 그 물건이 없어요');
      if (peddlerGot(mine, now, v)) return fail('오늘 몫은 이미 샀어요');
      if (mine.coins < it.cost) return fail('동전이 모자라요');
      mine.coins -= it.cost;
      pedToday(mine, now);
      mine.pedGot[v] = true;
      noteDex(world, mine, 'ev:peddler', now);
      if (it.id === 'box'){
        const P = openBox(world, mine, now);
        logAdd(world, mine.key, NAME[mine.key] + '가 행상인의 보따리에서 ' + P.say.replace(/<[^>]*>/g, '') + '을 얻었어요', now);
        return okay('보따리를 풀었더니 — ' + P.say + '!', { box: true });
      }
      give(mine, it.id, it.n);
      if (String(it.id).slice(0, 2) === 'f:') noteFurn(world, mine, it.id, now);   // 행상인 가구도 집 도감에
      return okay(eul(itemName(it.id)) + (it.n > 1 ? ' ' + it.n + '개를' : '') + ' 샀어요');
    }
    if (k === 'sprinkler' || k === 'sprinkler2'){
      const S = SPRINKLERS[k];
      if (levelOf(mine.xp) < S.lv) return fail('농장 레벨 ' + S.lv + '부터 살 수 있어요');
      if (mine.coins < S.cost) return fail('동전이 모자라요');
      mine.coins -= S.cost; give(mine, S.item, 1);
      return okay(eul(S.name) + ' 샀어요. 밭의 빈 칸에 놓아요');
    }
    if (k === 'fert'){ if (mine.coins < 30) return fail('동전이 모자라요'); mine.coins -= 30; give(mine, 'fert', 1); return okay('비료를 샀어요'); }
    /* 나무와 돌 — 베고 캐는 것이 하루에 몇 번뿐이라, 집을 지을 때 한 가지가 모자라
       며칠을 기다려야 했다. 파는 값은 GOODS 의 파는 값(나무 4·돌 3)에 시세 최대 1.3배를
       곱한 값(5·4)보다 넉넉히 높게 잡는다 — 사서 되파는 것으로 동전이 늘면 안 된다. */
    if (k === 'mat'){
      const Mt = MATERIALS[v]; if (!Mt) return fail('그건 안 팔아요');
      if (mine.coins < Mt.cost) return fail('동전이 모자라요');
      mine.coins -= Mt.cost; give(mine, v, 1);
      return okay(eul(GOODS[v].name) + ' 샀어요');
    }
    if (k === 'recipe'){
      const D = DISHES[v]; if (!D) return fail('없는 요리예요');
      if (mine.recipes.indexOf(v) >= 0) return fail('이미 아는 요리예요');
      const cost = D.sell;
      if (mine.coins < cost) return fail('동전이 모자라요');
      mine.coins -= cost; mine.recipes.push(v);
      return okay(D.name + ' 만드는 법을 배웠어요');
    }
    if (k === 'room'){
      const B = roomBox(world, v);
      if (!B) return fail('없는 방이에요');
      if (B.owner && B.owner !== mine.key) return fail('여기는 ' + NAME[B.owner] + '의 방이에요');
      const nx = B.next;
      if (!nx) return fail(B.name + '은 이미 제일 넓어요');
      if (levelOf(mine.xp) < nx.lv) return fail('농장 레벨 ' + nx.lv + '부터');
      if (mine.coins < nx.cost) return fail('동전이 모자라요');
      mine.coins -= nx.cost;
      if (!world.rooms) world.rooms = {};
      world.rooms[v] = B.step + 1;
      mine.xp += XP.expand;
      const after = roomBox(world, v);
      return okay(B.name + '이 ' + after.w + '×' + after.h + '으로 넓어졌어요');
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
    if (afloat(world)) return fail('방주 안에는 사 줄 상인이 없어요. 먹을 것은 양식 창고에 넣어요');
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
    if (afloat(world)) return fail('섬이 물에 잠겨 있어요. 새 땅에 내리면 지어요');
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
    noteDex(world, mine, got, now);
    return okay(eul(itemName(got)) + ' 얻었어요');
  }
  function rename(world, mine, aid, name){
    const a = world.animals.find(x => x.id === aid); if (!a) return fail('없는 동물이에요');
    name = String(name || '').replace(/[<>]/g, '').trim().slice(0, 8);
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
  function takeHoney(world, mine, now){
    const hv = world.buildings.hive; if (!hv || !hv.honey) return fail('꿀이 아직 없어요');
    give(mine, 'honey', hv.honey); const n = hv.honey; hv.honey = 0;
    noteDex(world, mine, 'honey', now, n);
    return okay('꿀 ' + n + '개를 떴어요');
  }
  function place(world, mine, room, f, x, y, r){
    const R = ROOMS[room], F = FURNITURE[f];
    if (!R || !F) return fail('놓을 수 없어요');
    if (R.owner && R.owner !== mine.key) return fail('여기는 ' + NAME[R.owner] + '의 방이에요');
    if (F.wall) return fail(eun(F.name) + ' 벽에 거는 거예요. 벽을 눌러요');
    r = (((Math.round(Number(r) || 0)) % 4) + 4) % 4;
    if (!canPlace(world, room, f, x, y, r)) return fail('그 자리에는 놓을 수 없어요');
    if (!take(mine, 'f:' + f)) return fail('그 가구가 없어요');
    world.house[room][x + ',' + y] = { f, by: mine.key, r };
    return okay(eul(F.name) + ' 놓았어요');
  }
  // 놓여 있는 것을 그 자리에서 90도 돌린다. 돌려서 방 밖으로 나가거나 옆것과 겹치면 안 된다.
  function rotateFurn(world, mine, room, k){
    const R = ROOMS[room], P = world.house && world.house[room];
    if (!R || !P || !P[k]) return fail('그 자리에 아무것도 없어요');
    if (R.owner && R.owner !== mine.key) return fail('여기는 ' + NAME[R.owner] + '의 방이에요');
    const it = P[k], F = FURNITURE[it.f];
    if (F.wall) return fail(eun(F.name) + ' 벽에 걸린 것이라 못 돌려요');
    const parts = k.split(',').map(Number), x = parts[0], y = parts[1];
    const nr = ((it.r || 0) + 1) % 4, b = furnBox(it.f, nr);
    if (x + b.w > R.w || y + b.h > R.h) return fail('돌리면 방 밖으로 나가요');
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++){
      const o = occupied(world, room, x + i, y + j);
      if (o && o !== k) return fail('옆에 다른 가구가 있어요');
    }
    it.r = nr;
    return okay(eul(F.name) + ' 돌렸어요');
  }
  function moveFurn(world, mine, room, k, x, y){
    const R = ROOMS[room], P = world.house && world.house[room];
    if (!R || !P || !P[k]) return fail('그 자리에 아무것도 없어요');
    if (R.owner && R.owner !== mine.key) return fail('여기는 ' + NAME[R.owner] + '의 방이에요');
    const it = P[k], F = FURNITURE[it.f];
    if (F.wall) return fail(eun(F.name) + ' 벽에 걸린 것이라 못 끌어요');
    x = Math.round(Number(x)); y = Math.round(Number(y));
    const b = furnBox(it.f, it.r);
    if (!(x >= 0 && y >= 0) || x + b.w > R.w || y + b.h > R.h) return fail('방 밖으로는 못 옮겨요');
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++){
      const o = occupied(world, room, x + i, y + j);
      if (o && o !== k) return fail('그 자리에는 다른 가구가 있어요');
    }
    const nk = x + ',' + y;
    if (nk === k) return fail('제자리예요');
    delete P[k]; P[nk] = it;
    return okay(eul(F.name) + ' 옮겼어요');
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
    Object.keys(D.need).forEach(k => takeAny(mine, k, D.need[k]));
    give(mine, 'dish:' + d, 1); mine.xp += XP.cook; bump(mine, 'cooked', 1, now);
    noteDex(world, mine, 'dish:' + d, now);
    return okay(eul(D.name) + ' 만들었어요');
  }
  function sendGift(world, mine, id, n, note, now){
    n = Math.max(1, Math.floor(n || 1));
    if (!take(mine, id, n)) return fail('그만큼 없어요');
    const to = OTHER[mine.key];
    world.mail[to].push({ id, n, from: mine.key, note: String(note || '').slice(0, 40), t: now });
    if (world.mail[to].length > 12) world.mail[to].splice(0, world.mail[to].length - 12);
    bump(mine, 'gifted', 1, now); logAdd(world, mine.key, NAME[mine.key] + '가 ' + NAME[to] + '에게 ' + itemName(id) + ' ' + n + '개를 보냈어요', now, true);
    return okay(NAME[to] + '의 우편함에 넣었어요');
  }
  function sendNote(world, mine, note, now){
    const txt = String(note == null ? '' : note).trim().slice(0, NOTE_MAX);
    if (!txt) return fail('쓸 말을 적어요');
    const to = OTHER[mine.key];
    const box = world.mail[to] || (world.mail[to] = []);
    const today = dayKey(now);
    const sent = box.filter(g => g.id === 'note' && g.from === mine.key && dayKey(g.t) === today).length;
    if (sent >= NOTE_A_DAY) return fail('오늘 쪽지는 ' + NOTE_A_DAY + '통까지 보냈어요. 내일 또 보내요');
    box.push({ id: 'note', n: 1, from: mine.key, note: txt, t: now });
    if (box.length > 12) box.splice(0, box.length - 12);
    logAdd(world, mine.key, NAME[mine.key] + '가 ' + NAME[to] + '에게 쪽지를 보냈어요', now, true);
    return okay(NAME[to] + '의 우편함에 쪽지를 넣었어요');
  }
  function buyGift(world, mine, id, note, now){
    const r = buy(world, mine, id, now);
    if (!r.ok) return r;
    const g = sendGift(world, mine, id, 1, note, now);
    if (!g.ok){ give(mine, id, 1); return g; }        // 못 보내면 되돌린다 — buy 가 이미 줬으니
    return okay(itemName(id) + ' 하나를 사서 ' + NAME[OTHER[mine.key]] + '의 우편함에 넣었어요');
  }
  function fillOrder(world, mine, o, n, now){
    if (afloat(world)) return fail('방주 안에서는 주문을 받지 않아요');
    const p = world.orders[o.id] || (world.orders[o.id] = { got: 0, by: {}, done: false });
    if (p.done) return fail('이미 채운 주문이에요');
    n = Math.min(n, o.n - p.got);
    if (n <= 0) return fail('다 찼어요');
    if (!takeAny(mine, 'crop:' + o.crop, n)) return fail(ee(CROPS[o.crop].name) + ' 그만큼 없어요');
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
    if (afloat(world)) return fail('방주 안에서는 축제가 쉬어요');
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
  function openMailAll(world, mine, now){
    const box = world.mail[mine.key] || [];
    if (!box.length) return fail('우편함이 비었어요');
    const got = box.splice(0, box.length);
    let coins = 0;
    got.forEach(g => {
      if (g.id === 'coins') coins += g.n; else if (g.id !== 'note') give(mine, g.id, g.n);
      // 손님·사건 도감 — 산타·램프 요정·그림엽서·이사 선물·축제 상. 날짜는 편지가 온 때
      if (DEX_MAIL.indexOf(g.from) >= 0){ noteDex(world, mine, 'ev:' + g.from, g.t || now); if (DEX_GOODS.indexOf(g.id) >= 0) noteDex(world, mine, g.id, g.t || now, g.n); }
      if (String(g.id).slice(0, 2) === 'f:') noteFurn(world, mine, g.id, g.t || now);
    });
    mine.coins += coins;
    const things = got.filter(g => g.id !== 'note');
    const notes = got.length - things.length;
    const said = things.map(g => (g.id === 'coins' ? g.n + ' 동전' : itemName(g.id) + ' ' + g.n + '개')).join(', ');
    return okay((things.length ? said + '를 받았어요' : '') + (notes ? (things.length ? ' · ' : '') + '쪽지 ' + notes + '통을 읽었어요' : ''), { got });
  }
  // 부모가 보낸 선물(조정판 줄) — 같은 번호는 한 번만 받는다.
  function claimParentGift(mine, tune){
    const g = tune && tune.gift && tune.gift[mine.key];
    if (!g || !g.id || mine.claimed.indexOf(g.id) >= 0) return null;
    mine.claimed.push(g.id); if (mine.claimed.length > 10) mine.claimed.shift();
    mine.coins += Math.max(0, Math.min(1000, Math.floor(g.coins || 0)));
    return g;
  }
  // (일기 하나에 비료 하나는 2026-09-17 에 뺐다. 저장에 남은 fertSpent 칸은 읽지 않는다)
  // 모험단 원정에서 주워 온 씨앗. 모험단 저장은 「지금까지 몇 개 주웠나」만 세고,
  // 농장은 「그중 몇 개를 가져갔나」를 제 저장에 적는다. 두 놀이가 서로의 저장에
  // 손대지 않으므로 순서가 엇갈려도 두 번 받거나 잃을 일이 없다.
  function seedsFromExpo(world, mine, seedsEver, now){
    const owed = Math.max(0, Math.floor(Number(seedsEver) || 0) - (mine.expoSeeds || 0));
    if (!owed || !world || !world.started) return [];
    const season = calendar(world, now).season;
    // 별열매(rare)는 뺀다 — 그건 주문을 다 채운 사람에게만 오는 씨앗이다.
    const pool = Object.keys(CROPS).filter(c => !CROPS[c].rare && CROPS[c].season.indexOf(season) >= 0 && farmOk(world, CROPS[c]));
    if (!pool.length) return [];
    const got = [];
    for (let i = 0; i < owed; i++){
      const c = pool[Math.floor(prand('expo' + mine.key + ':' + ((mine.expoSeeds || 0) + i)) * pool.length) % pool.length];
      give(mine, 'seed:' + c, 1);
      got.push(c);
    }
    mine.expoSeeds = (mine.expoSeeds || 0) + owed;
    return got;
  }
  // 하루가 열릴 때 한 번 — 계절, 동물, 꿀, 까마귀, 비 온 날의 물.
  function newDay(world, mine, now){
    const notes = [];
    const cal = calendar(world, now), key = dayKey(now);
    seasonSweep(world, now);
    const made = animalDay(world, now);
    if (made.length) notes.push(made.map(a => a.name).join(', ') + '이 무언가 남겼어요');
    const babies = babyDay(world, now);
    babies.born.forEach(b => {
      notes.push('<b>' + b.momName + '</b>가 새끼를 낳았어요! 이름을 지어 줘요');
      logAdd(world, b.by, b.momName + '가 새끼 ' + ANIMALS[b.kind].name + '을 낳았어요', now);
    });
    babies.grown.forEach(g => {
      notes.push(g.name + (jong(g.name) ? '이' : '가') + ' 다 자랐어요');
      logAdd(world, g.by, g.name + (jong(g.name) ? '이' : '가') + ' 어른이 됐어요', now);
    });
    if (afloat(world)){
      const A = world.ark, need = arkRation(world);
      notes.push('🛶 방주 ' + (A.month || 0) + '달째' + (A.monthDay === key ? ' — 오늘 한 달은 보냈어요' : ' — 「🛶 방주」 칸에서 <b>한 달 보내기</b>를 눌러요 (양식 ' + A.food + ' · 한 달에 ' + need + ')'));
      world.hot = hotCrop(world, now);
      return notes;
    }
    // 짝꿍이 찾아와요(방주 농장 능력, 창세기 7:9) — 혼자인 동물에게 짝이 스스로 온다. 하루에 한 번, 다섯에 셋꼴
    if (perkOf(world) === 'mate' && !arkPhase(world) && world.mateDay !== key && prand('mate' + key) < 0.6){
      const lone = ARK_KINDS.filter(k => arkCount(world, k) === 1 && world.animals.filter(a => ANIMALS[a.kind] && ANIMALS[a.kind].need === ANIMALS[k].need).length < animalMax(world, ANIMALS[k].need));
      if (lone.length){
        world.mateDay = key;
        const k = lone[Math.floor(prand('matek' + key) * lone.length)], one = world.animals.find(a => a.kind === k), Ak = ANIMALS[k];
        let nm = '짝꿍 ' + Ak.name; if (world.animals.some(x => x.name === nm)) nm = one.name + '의 짝꿍';
        world.animals.push({ id: 'a' + now + 'm', kind: k, name: nm, by: one.by || 'sua', born: key, love: 3, pet: [], since: 0, mate: one.id });
        notes.push('💞 <b>' + one.name + '</b>의 짝꿍 ' + ee(Ak.name) + ' 스스로 찾아왔어요! 이제 한 쌍이에요');
        logAdd(world, one.by || 'sua', one.name + '의 짝꿍 ' + ee(Ak.name) + ' 방주 농장에 찾아왔어요', now);
      }
    }
    const sprinkled_n = sprinklerDay(world, now);
    if (sprinkled_n) notes.push('스프링클러가 ' + sprinkled_n + '칸에 물을 줬어요');
    if (peddlerHere(world, now)){
      const pw = peddlerWant(world, now);
      notes.push('<b>행상인</b>이 수레를 끌고 왔어요 — 오늘은 ' + eul(itemName(pw.id)) + ' 두 배로 사 간대요');
    }
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
    if (farmOf(world).id === 'aurora' && world.decor && world.decor.santapost && world.santaDay !== key && prand('santa' + key) < SANTA_CHANCE){
      world.santaDay = key;
      const G = SANTA_GIFTS[Math.floor(prand('santag' + key) * SANTA_GIFTS.length)];
      ['sua', 'yona'].forEach(k => { (world.mail[k] = world.mail[k] || []).push({ id: G.id, n: G.n, from: 'santa', note: '착한 ' + NAME[k] + '에게 — 산타 할아버지가', t: now }); });
      notes.push('📮 산타 우체통에 <b>산타 할아버지 편지</b>가 왔어요! 우편함을 열어 봐요');
    }
    if (farmOf(world).id === 'desert' && world.decor && world.decor.genielamp && world.genieDay !== key && prand('genie' + key) < SANTA_CHANCE){
      world.genieDay = key;
      const G = GENIE_GIFTS[Math.floor(prand('genieg' + key) * GENIE_GIFTS.length)];
      ['sua', 'yona'].forEach(k => { (world.mail[k] = world.mail[k] || []).push({ id: G.id, n: G.n, from: 'genie', note: NAME[k] + '에게 — 램프 요정이 소원 하나 대신', t: now }); });
      notes.push('🪔 요술 램프에서 <b>램프 요정 편지</b>가 나왔어요! 우편함을 열어 봐요');
    }
    // ② 그림엽서 — 이사 조건을 절반 넘게 채우면 다음 농장에서 한 번 온다
    const ms = moveState(world, mine), nx = ms.next;
    if (nx && world.postcard !== nx.id){
      const need = ms.conds.reduce((a, c) => a + c.need, 0), left = ms.conds.reduce((a, c) => a + c.left, 0);
      if (need && left <= need / 2){
        world.postcard = nx.id;
        const sp = (SPECIALS[nx.id] || []).map(itemName).join('·'), pk = nx.perk;
        const note = nx.icon + ' ' + nx.name + ' — ' + nx.desc + (pk ? ' · 능력: ' + pk.text : '') + (sp ? ' · 특산물: ' + sp : '');
        ['sua', 'yona'].forEach(k => { (world.mail[k] = world.mail[k] || []).push({ id: 'note', n: 1, from: 'postcard', farm: nx.id, note, t: now }); });
        notes.push('🖼️ ' + nx.name + '에서 <b>그림엽서</b>가 왔어요! 우편함을 열어 봐요');
      }
    }
    const q = questOf(world, now);
    if (q && !q.done && q.day === key) notes.push(q.icon + ' <b>' + q.name + '</b>' + (jong(q.name) ? '이' : '가') + ' 부탁을 하러 왔어요 — ' + itemName(q.id) + ' ' + q.n + '개. 「둘이서」에서 건네요');
    world.hot = hotCrop(world, now);
    return notes;
  }
  /* ⑥ 농장 손님 부탁 — 사흘마다 새로. 둘 중 한 명이 건네면 끝(world.quest). 받는 것은 동전(파는 값×2)과 그 농장 가구 하나 */
  function questOf(world, now){
    const f = farmOf(world).id, G = GUESTS[f]; if (!G || afloat(world)) return null;
    const today = dayKey(now), d = Math.max(0, daysBetween(world.started || today, today)), turn = Math.floor(d / QUEST_DAYS);
    const day = dayKey(dayStartMs(today) - (d % QUEST_DAYS) * DAY_MS + 12 * H);   // 이번 부탁이 온 날(한낮으로 재서 서머타임에도 안 밀린다)
    const [id, n] = G.want[Math.floor(prand('quest' + f + turn) * G.want.length)];
    const furn = Object.keys(FURNITURE).filter(x => FURNITURE[x].farm === f);
    const q = { farm: f, turn, day, id, n, name: G.name, icon: G.icon, coins: Math.max(100, sellBase(id, null, now) * n * QUEST_MULT),
      gift: furn.length ? 'f:' + furn[Math.floor(prand('questf' + f + turn) * furn.length)] : null };
    const w = world.quest; q.done = !!(w && w.farm === f && w.turn === turn && w.by);
    if (q.done) q.by = w.by;
    return q;
  }
  function giveQuest(world, mine, now){
    const q = questOf(world, now);
    if (!q) return fail('이 농장엔 부탁하러 오는 손님이 없어요');
    if (q.done) return fail(NAME[q.by] + '가 벌써 건넸어요. 다음 부탁은 곧 와요');
    if (!takeAny(mine, q.id, q.n)) return fail(itemName(q.id) + ' ' + q.n + '개가 있어야 해요 (지금 ' + countOf(mine, q.id) + '개)');
    world.quest = { farm: q.farm, turn: q.turn, by: mine.key };
    mine.coins += q.coins; mine.xp += 20; if (q.gift){ give(mine, q.gift, 1); noteFurn(world, mine, q.gift, now); }
    noteDex(world, mine, 'guest:' + q.farm, now);
    logAdd(world, mine.key, NAME[mine.key] + '가 ' + q.name + '의 부탁을 들어줬어요', now);
    return okay(q.icon + ' ' + q.name + ': 고마워! ' + q.coins + ' 동전' + (q.gift ? ' · ' + itemName(q.gift) : '') + '을 받았어요');
  }
  /* ④ 옛 농장 선물 — 옛 농장을 구경할 때 하루 한 번(각자). 특산물이 있으면 그중 하나를 두세 개, 없으면 동전 */
  function pastGift(world, mine, farmId, now){
    if (!(world.past || []).some(p => p.farm === farmId)) return fail('떠나온 농장이 아니에요');
    const key = dayKey(now);
    if (mine.pastDay === key) return fail('옛 농장 선물은 하루에 한 번이에요. 내일 또 와요');
    mine.pastDay = key;
    const S = SPECIALS[farmId], F = FARMS.find(f => f.id === farmId);
    if (!S){ mine.coins += PAST_COINS; return okay(F.icon + ' ' + F.name + ' 이웃들이 ' + PAST_COINS + ' 동전을 챙겨 줬어요'); }
    const id = S[Math.floor(prand('past' + key + mine.key) * S.length)], n = id.slice(0, 5) === 'fish:' ? 1 : 2;
    give(mine, id, n); noteDex(world, mine, dexId(id), now, n, { farm: farmId });
    return okay(F.icon + ' ' + F.name + '에서 <b>' + itemName(id) + '</b> ' + n + '개를 받아 왔어요' + (originOf(id) !== farmOf(world).id ? ' — 여기서 팔면 ' + TRADE_MULT + '배예요' : ''));
  }

  // ---------- 메인 목표: 수아연아의 방주 (2026-10-09 로키즈) ----------
  // 처음 쓰는 날 world.ark 를 만든다. 모양은 fixWorld 가 다시 거른다
  function arkOf(world){
    if (!world.ark || typeof world.ark !== 'object') world.ark = {};
    const A = world.ark;
    if (!Array.isArray(A.seeds)) A.seeds = [];
    if (!Array.isArray(A.on)) A.on = [];
    ['paid', 'by', 'land'].forEach(k => { if (!A[k] || typeof A[k] !== 'object') A[k] = {}; });
    A.step = arkStep(world); A.food = Math.max(0, Math.floor(Number(A.food) || 0)); A.month = Math.max(0, Math.floor(Number(A.month) || 0));
    return A;
  }
  const atArk = world => farmOf(world).id === 'ark';
  // 창고에 넣으면 몇 점인가 — 먹으면 기운이 도는 것 + 동물이 낳은 것. 꽃·재료는 0
  function arkFoodOf(id){
    const k = String(id).split(':')[0];
    if (k === 'giant') return 15;
    return foodOf(id) || ARK_GOODS_FOOD[id] || 0;
  }
  // 화면이 한 번에 읽는 방주 이야기 전부
  function arkState(world, mine, now){
    const A = world.ark || {}, step = arkStep(world), key = dayKey(now == null ? Date.now() : now), ask = A.ask || null;
    return {
      phase: arkPhase(world), here: farmOf(world).id, atArk: atArk(world), step, total: ARK_STEPS.length,
      steps: ARK_STEPS.map((S, i) => Object.assign({ i, done: i < step, cur: i === step }, S)),
      paid: Object.assign({}, A.paid || {}), on: (A.on || []).slice(),
      food: Math.max(0, Math.floor(Number(A.food) || 0)), foodMin: ARK_FOOD_MIN, by: Object.assign({}, A.by || {}),
      ration: arkRation(world), month: A.month || 0, months: ARK_MONTHS, monthDone: A.monthDay === key, log: ARK_LOG,
      pairs: ARK_KINDS.map(k => ({ kind: k, n: arkCount(world, k) })), pairsHave: arkPairsHave(world), pairsTotal: ARK_KINDS.length,
      seeds: (A.seeds || []).slice(), seedsHave: arkSeedsHave(world), seedsTotal: CROP_IDS.length,
      ask, mineAsked: !!(ask && ask.by === mine.key), otherAsked: !!(ask && ask.by !== mine.key),
      land: LAND_STEPS.map((L, i) => { const s = (A.land || {})[L.id] || {}; return Object.assign({ i, name: PLACE[L.id].name, done: !!s.done, paid: Object.assign({}, s.paid || {}), open: LAND_STEPS.slice(0, i).every(x => ((A.land || {})[x.id] || {}).done) }, L); }),
      landDone: landDone(world),
    };
  }
  // 씨앗 금고 — 어느 농장에서나 한 알씩. 농장 전용 작물은 그 농장에 있을 때 넣어 둬야 한다
  function arkSeed(world, mine, crop, now){
    const C = CROPS[crop]; if (!C) return fail('그런 씨앗은 없어요');
    const A = arkOf(world);
    if (A.seeds.indexOf(crop) >= 0) return fail(C.name + ' 씨앗은 이미 금고에 있어요');
    if (!take(mine, 'seed:' + crop)) return fail(C.name + ' 씨앗이 가방에 없어요. 가게에서 사거나 자매에게 받아요');
    A.seeds.push(crop); mine.xp += 5;
    if (A.seeds.length === CROP_IDS.length) logAdd(world, mine.key, '방주 씨앗 금고에 모든 작물 씨앗이 모였어요!', now);
    return okay('🌰 <b>' + C.name + '</b> 씨앗을 방주 씨앗 금고에 넣었어요 (' + arkSeedsHave(world) + '/' + CROP_IDS.length + ')', { seed: crop });
  }
  // 방주 짓기 — 지금 단계에 각자 제 몫을 낸다. 둘 다 내면 한 단계 올라간다
  function arkPay(world, mine, now){
    if (!atArk(world)) return fail('방주는 방주 농장에서 지어요');
    const A = arkOf(world);
    if (A.phase || A.step >= ARK_STEPS.length) return fail('방주는 다 지었어요');
    const S = ARK_STEPS[A.step];
    if (A.paid[mine.key]) return fail('내 몫은 냈어요. ' + NAME[OTHER[mine.key]] + '를 기다려요');
    if (S.id === 'store' && A.food < ARK_FOOD_MIN) return fail('양식 창고가 ' + A.food + '/' + ARK_FOOD_MIN + '이에요. 먹을 것을 더 넣어요');
    if (!canPay(mine, S.each)) return fail('재료가 모자라요 — 각자 ' + Object.keys(S.each).map(k => (k === 'coins' ? '🪙 ' : itemName(k) + ' ') + S.each[k]).join(' · '));
    pay(mine, S.each); A.paid[mine.key] = true; mine.xp += 20;
    if (A.paid.sua && A.paid.yona){
      A.step++; A.paid = {}; A.on.push(dayKey(now)); mine.xp += XP.build;
      logAdd(world, mine.key, '방주 ' + A.step + '단계 「' + S.name + '」 — ' + S.say, now);
      return okay(S.icon + ' 방주 <b>' + A.step + '단계 「' + S.name + '」</b> 완성! ' + S.say, { built: true, step: A.step });
    }
    return okay('내 몫을 냈어요. ' + NAME[OTHER[mine.key]] + '도 내면 「' + S.name + '」이 지어져요');
  }
  // 양식 창고 — 방주 농장과 방주 안에서. 넣은 것은 둘이 함께 먹는다
  function arkStore(world, mine, id, n, now){
    if (!atArk(world) || arkPhase(world) === 'land') return fail('양식 창고는 방주 농장에 있어요');
    const v = arkFoodOf(id);
    if (!v) return fail(itemName(id) + '은 양식이 아니에요');
    n = Math.max(1, Math.min(Math.floor(n || 1), mine.inv[id] || 0));
    if (!take(mine, id, n)) return fail('그만큼 없어요');
    const A = arkOf(world);
    A.food += v * n; A.by[mine.key] = (A.by[mine.key] || 0) + v * n;
    bump(mine, 'stored', n, now);
    return okay('🌾 ' + itemName(id) + ' ' + n + '개를 양식 창고에 넣었어요 (+' + v * n + ' · 창고 ' + A.food + ')', { food: A.food });
  }
  // 방주에 들어가기 — 먼저 누른 아이가 묻고, 자매가 「좋아」 하면 모두 들어가고 문이 닫힌다(창세기 7:16)
  function arkBoard(world, mine, now){
    if (!atArk(world)) return fail('방주 농장에서 들어가요');
    const A = arkOf(world);
    if (A.phase) return fail('이미 방주에 들어갔어요');
    if (A.step < ARK_STEPS.length) return fail('방주를 ' + ARK_STEPS.length + '단계까지 다 지어야 들어가요 (지금 ' + A.step + '단계)');
    if (A.ask && A.ask.by === mine.key) return fail(NAME[OTHER[mine.key]] + '의 대답을 기다려요');
    if (A.ask) return boardArk(world, mine, now);
    A.ask = { by: mine.key, on: dayKey(now) };
    logAdd(world, mine.key, NAME[mine.key] + '가 방주에 들어가자고 했어요', now, true);
    return okay(NAME[OTHER[mine.key]] + '에게 물어봤어요. 둘 다 좋다고 하면 모두 방주에 들어가요');
  }
  function arkBoardCancel(world, mine, now){
    const A = world.ark;
    if (!A || !A.ask) return fail('들어가자는 이야기가 없어요');
    delete A.ask;
    logAdd(world, mine.key, NAME[mine.key] + '가 방주에는 조금 이따 들어가자고 했어요', now, true);
    return okay('조금 더 준비하고 들어가요');
  }
  function boardArk(world, mine, now){
    const A = arkOf(world), key = dayKey(now);
    // 밭에 서 있는 작물은 거둬서 창고로 — 물에 잠기기 전에(꽃은 빼고)
    let got = 0;
    Object.keys(world.plots || {}).forEach(id => { const p = world.plots[id], C = p && CROPS[p.crop]; if (C && !p.wilted && !C.flower) got += 3 * (C.yield || 1); });
    A.food += got;
    // 스프링클러는 놓은 아이의 우편함으로 — 새 땅 밭에 다시 놓는다
    Object.keys(world.sprinklers || {}).forEach(id => { const S = world.sprinklers[id], who = S && NAME[S.by] ? S.by : mine.key; (world.mail[who] = world.mail[who] || []).push({ id: sprinklerOf(S).item, n: 1, from: 'ark', note: '방주에 실어 둔 스프링클러', t: now }); });
    world.plots = {}; world.sprinklers = {};
    delete A.ask; delete world.moveAsk;
    A.phase = 'flood'; A.boardOn = key; A.month = 0; A.monthDay = null;
    logAdd(world, mine.key, '수아와 연아가 동물 ' + (world.animals || []).length + '마리와 함께 방주에 들어갔어요. 문이 닫히고 큰비가 내리기 시작했어요', now);
    return okay('🛶 모두 방주에 들어갔어요! 문이 닫히고 큰비가 내려요' + (got ? ' · 밭에 남은 작물은 양식 창고에 실었어요(+' + got + ')' : ''), { boarded: true });
  }
  // 대홍수 — 하루에 한 번 「한 달 보내기」. 한 달 양식을 먹고 이야기가 한 장 넘어간다. 열두 달이면 새 땅
  function arkMonth(world, mine, now){
    if (!afloat(world)) return fail('방주에 들어가야 한 달씩 지나요');
    const A = arkOf(world), key = dayKey(now), need = arkRation(world);
    if (A.monthDay === key) return fail('오늘은 한 달을 보냈어요. 내일 또 와요 — 방주에서는 하루가 한 달이에요');
    if (A.food < need) return fail('양식이 ' + (need - A.food) + ' 모자라요 — 동물이 낳은 것을 줍거나 창밖 낚시로 잡아 양식 창고에 넣어요');
    A.food -= need; A.month = (A.month || 0) + 1; A.monthDay = key; mine.xp += 20;
    const L = ARK_LOG[A.month] || ARK_LOG[ARK_LOG.length - 1];
    logAdd(world, mine.key, '방주 ' + A.month + '달째 — ' + L.text, now);
    if (A.month >= ARK_MONTHS){ landArk(world, mine, now); return okay(L.icon + ' <b>' + A.month + '달째</b> — ' + L.text, { month: A.month, landed: true }); }
    return okay(L.icon + ' <b>' + A.month + '달째</b> — ' + L.text + ' (창세기 ' + L.ref + ') · 양식 ' + A.food + ' 남았어요', { month: A.month });
  }
  // 새 땅에 내린다 — 방주 농장은 옛 농장으로 남고(물이 빠진 빈 터) 무지개 농장에서 새로 짓는다
  function landArk(world, mine, now){
    const A = arkOf(world), key = dayKey(now), from = farmOf(world);
    const left = {};
    Object.keys(world.buildings).forEach(b => { const B = world.buildings[b]; if (MOVE_KEEP[b] || !B || !B.done) return; left[b] = { done: true }; delete world.buildings[b]; });
    world.past.push({ farm: from.id, until: key, decor: JSON.parse(JSON.stringify(world.decor || {})), buildings: left, layout: JSON.parse(JSON.stringify(world.layout || {})), expand: world.expand || 0 });
    const old = world.decor || {};
    world.decor = {}; Object.keys(old).forEach(d => { if (old[d] && old[d].keep) world.decor[d] = Object.assign({}, old[d]); });
    world.layout = {}; world.plots = {}; world.sprinklers = {};
    world.farm = FARMS.findIndex(f => f.id === 'newland');
    A.phase = 'land'; A.landOn = key;
    // 생육하고 번성하라(창세기 9:1) — 한 쌍이 있는 동물마다 아기 하나, 우리 자리가 있으면
    let babies = 0;
    ARK_KINDS.forEach(k => {
      const Ak = ANIMALS[k], mom = world.animals.find(a => a.kind === k && !a.baby);
      if (arkCount(world, k) < 2 || !mom) return;
      if (world.animals.filter(a => ANIMALS[a.kind] && ANIMALS[a.kind].need === Ak.need).length >= animalMax(world, Ak.need)) return;
      let nm = '아기 ' + Ak.name; if (world.animals.some(x => x.name === nm)) nm = mom.name + '의 아기';
      world.animals.push({ id: 'a' + now + 'r' + babies, kind: k, name: nm, by: mom.by || mine.key, born: key, love: 0, pet: [], since: 0, baby: true, mom: mom.id, momName: mom.name });
      babies++;
    });
    // 씨앗 금고를 연다 — 금고에 든 작물마다 둘에게 두 알씩. 이사 선물 동전도
    ['sua', 'yona'].forEach(k => {
      const box = world.mail[k] = world.mail[k] || [];
      box.push({ id: 'coins', n: MOVE_GIFT, from: 'ark', note: '새 땅에 내린 날', t: now });
      A.seeds.forEach(c => box.push({ id: 'seed:' + c, n: 2, from: 'ark', note: '방주 씨앗 금고에서', t: now }));
    });
    A.babies = babies;
    logAdd(world, mine.key, '수아와 연아가 방주에서 내려 무지개 농장에 첫발을 디뎠어요. 하늘에 무지개가 떴어요', now);
    return babies;
  }
  // 무지개 농장 짓기 — LAND_STEPS 를 차례로. 각자 제 몫을 내면 하나가 선다
  function landPay(world, mine, id, now){
    if (farmOf(world).id !== 'newland') return fail('무지개 농장에서 지어요');
    const i = LAND_STEPS.findIndex(L => L.id === id); if (i < 0) return fail('없는 것이에요');
    const A = arkOf(world), L = LAND_STEPS[i], nm = PLACE[id].name;
    const prev = LAND_STEPS.slice(0, i).find(x => !((A.land[x.id] || {}).done));
    if (prev) return fail('먼저 ' + eul(PLACE[prev.id].name) + ' 지어요 — 새 땅은 하나씩 지어요');
    const s = A.land[id] = A.land[id] || { paid: {} };
    if (s.done) return fail('이미 지었어요');
    if (s.paid[mine.key]) return fail('내 몫은 냈어요. ' + NAME[OTHER[mine.key]] + '를 기다려요');
    if (!canPay(mine, L.each)) return fail('재료가 모자라요 — 각자 ' + Object.keys(L.each).map(k => (k === 'coins' ? '🪙 ' : itemName(k) + ' ') + L.each[k]).join(' · '));
    pay(mine, L.each); s.paid[mine.key] = true; mine.xp += 20;
    if (s.paid.sua && s.paid.yona){
      s.done = true; s.on = dayKey(now); mine.xp += XP.build;
      logAdd(world, mine.key, L.icon + ' ' + nm + ' 완성 — ' + L.say, now);
      const all = landDone(world) >= LAND_STEPS.length;
      if (all) logAdd(world, mine.key, '무지개 농장이 완성됐어요! 수아연아의 방주 이야기 끝 — 그리고 새 이야기의 시작', now);
      return okay(L.icon + ' <b>' + nm + '</b> 완성! ' + L.say, { built: true, all });
    }
    return okay('내 몫을 냈어요. ' + NAME[OTHER[mine.key]] + '도 내면 ' + ee(nm) + ' 지어져요');
  }

  // 규칙을 FARM 에 얹는다. 이 뒤부터 R.till · R.buy … 를 부를 수 있다.
  Object.assign(FARM, {
    arkOf, arkFoodOf, arkState, arkSeed, arkPay, arkStore, arkBoard, arkBoardCancel, arkMonth, landPay,
    noteDex, noteFurn, dexRec, DEX_GOODS, DEX_MAIL, FISH_CM,
    ringOf,
    fishLeft,
    fish,
    thingsOn,
    placeBlocked,
    moveThing, placeInfo,
    resetLayout,
    dayEndMs,
    nextSeason,
    isWet,
    forecast,
    yesterdayNote,
    countOf,
    seedsFor,
    plotOpen,
    putSprinkler,
    pullSprinkler,
    sprinkled,
    sprinklerDay,
    catchFirefly,
    pickShard,
    fireSit,
    peddlerStock,
    peddlerGot,
    peddlerWant,
    peddlerSoldLeft,
    sellToPeddler,
    moveState,
    questOf,
    giveQuest,
    pastGift,
    moveLeftText,
    askMove,
    cancelMove,
    medalState,
    claimMedal,
    neighborsOf,
    ripe,
    hoursLeft,
    seasonSweep,
    starOf,
    careNeed,
    itemName,
    sellPrice,
    priceMult,
    hotCrop,
    foodOf,
    maxEnergy,
    refreshEnergy,
    toolN,
    toolTargets,
    canPay,
    buildState,
    animalDay,
    babyDay,
    canPlace,
    bestOf,
    cozyOf,
    cozyLevel,
    canCook,
    hungAt,
    canHang,
    hang,
    moveHang,
    weekKey,
    ordersOf,
    orderProgress,
    festivalOpen,
    festivalKey,
    festivalWorth,
    missionOf,
    xpForLevel,
    eul,
    ee,
    eun,
    logAdd,
    give,
    take,
    bump,
    markPlayed,
    till,
    plant,
    water,
    fertilize,
    harvest,
    clear,
    gather,
    buy,
    sell,
    eat,
    contribute,
    feed,
    pet,
    collect,
    rename,
    takeHoney,
    place,
    rotateFurn,
    moveFurn,
    pickUp,
    cook,
    sendGift,
    sendNote,
    buyGift,
    openMail: openMailAll,
    fillOrder,
    donate,
    claimParentGift,
    seedsFromExpo,
    newDay,
  });
})();
