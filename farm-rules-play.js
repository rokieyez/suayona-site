// 수아연아 농장의 **놀이 규칙** — 심기·물주기·거두기·사기·팔기·요리·낚시·집 꾸미기.
// farm-rules.js 에서 떼어 냈다. 손님은 농장과 방 그림만 보므로 이 규칙이 한 줄도 안 쓰인다
// (함수 159개 중 손님이 부르는 것은 37개뿐이었다). 로그인한 사람만 늦게 받는다.
//
// farm-rules.js 가 먼저 돌아야 한다. 저 파일의 닫힘 안에 있는 것들은 FARM.__inner 로 받는다.
(() => {
  if (typeof FARM === 'undefined' || !FARM.__inner) throw new Error('farm-rules.js 를 먼저 실어야 해요');
  const { ANIMALS, ANIMAL_MAX, BABY_CHANCE, BABY_DAYS, BABY_REST_DAYS, BOX_PRIZES, BUILDINGS, COST, COZY_LEVELS, CROPS, CROP_IDS, DAY_MS, DECOR, DISHES, ENERGY_BASE, EXPANSIONS, FERT_SPEED, FESTIVALS, FIELD_BOX, FIREFLY_MAX, FIREFLY_SEASONS, FIRE_ENERGY, FIRE_TOGETHER, FISH, FISH_IDS, FISH_MAX, FURNITURE, GIANT_MULT, GOLD_MULT, GOODS, GRID, H, LOG_MAX, LOVE_FOR_BABY, LOVE_FOR_BEST, MATERIALS, MEDALS, MISSIONS, NAME, NODES, NOTE_A_DAY, NOTE_MAX, OTHER, PED_WANT_MAX, PED_WANT_MULT, PLACE, PLACE_IDS, PLAY_DAYS_MAX, ROOMS, SEASONS, SEASON_NAME, SPRINKLER, SPRINKLERS, TOOLS, WATER_HOURS, WEATHER, XP, calendar, dayKey, dayStartMs, daysBetween, fireflyLeft, fireflyNight, furnBox, growTime, hungCol, isNight, levelOf, nodeReady, occupied, okPic, parseId, parseWall, peddlerHere, placed, plotIds, prand, roomBox, spotOf, sprinklerOf, stageOf, thingHere, tickPlot, wallCols, wallKey, wallRowsFor, weatherOf } = FARM.__inner;

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
  function careNeed(plot){ const C = CROPS[plot.crop]; if (!C) return 1; const h = (plot.regrowLeft || C.hours) / (plot.fert ? FERT_SPEED : 1); return Math.max(1, Math.round(h / WATER_HOURS)); }
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
    const list = CROP_IDS.filter(c => CROPS[c].seed > 0 && CROPS[c].season.indexOf(cal.season) >= 0);
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
    const b = world.buildings[id] || { paid: {} };
    return { done: !!b.done, sua: !!b.paid.sua, yona: !!b.paid.yona };
  }
  function thingsOn(world){ return PLACE_IDS.filter(id => thingHere(world, id)).map(id => spotOf(world, id)); }
  function boxHit(a, b){ return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
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
      if (here >= ANIMAL_MAX[A.need]) return;                 // 우리가 꽉 찼다
      if (prand('bb' + a.id + key) >= BABY_CHANCE) return;
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
  function fish(world, mine, now, grade){
    if (!(world.decor && world.decor.pond)) return fail('연못을 먼저 놓아요. 가게 꾸미기 칸에 있어요');
    if (fishLeft(mine, now) <= 0) return fail('오늘은 많이 잡았어요. 내일 또 와요');
    if (!spend(mine, 'fish')) return fail('기운이 없어요');
    const key = dayKey(now), n = mine.fishDay === key ? (mine.fishN || 0) : 0;
    const cal = calendar(world, now), night = isNight(now);
    const pool = FISH_IDS.filter(f => {
      const F = FISH[f];
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
    if (mine.dex.indexOf('fish:' + got) < 0) mine.dex.push('fish:' + got);
    mine.xp += XP.fish + (g === 'perfect' ? 3 : 0); bump(mine, 'fished', 1, now);
    if (FISH[got].junk) return okay(eul(FISH[got].name) + ' 건졌어요… 물고기는 아니네요', { junk: true });
    const two = cnt > 1 ? ' <b>두 마리</b>나!' : '';
    if (got === 'golden' || got === 'moonfish'){
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
  function medalState(world, mine){
    return MEDALS.map(M => ({
      id: M.id, name: M.name, icon: M.icon, desc: M.desc, coins: M.coins,
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
    // 첫 훈장에는 걸어 둘 자리가 따라온다 — 받은 것이 가방에만 쌓이면 자랑할 데가 없다
    const first = mine.medals.length === 1;
    if (first) give(mine, 'f:medalcase', 1);
    logAdd(world, mine.key, NAME[mine.key] + '가 훈장 「' + M.name + '」을 받았어요', now);
    return okay(M.icon + ' <b>' + M.name + '</b> 훈장! ' + M.coins + ' 동전'
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
    const pool = CROP_IDS.map(c => 'crop:' + c)
      .concat(['egg', 'bigegg', 'duckegg', 'milk', 'goldmilk', 'wool', 'honey', 'truffle', 'angora', 'downfeather', 'gem', 'berry'])
      .concat(FISH_IDS.filter(f => !FISH[f].junk).map(f => 'fish:' + f));
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
    if (P.id === 'coins') mine.coins += P.n;
    else { give(mine, P.id, P.n); if (mine.dex.indexOf(P.id) < 0 && GOODS[P.id]) mine.dex.push(P.id); }
    return P;
  }
  function catchFirefly(world, mine, now){
    if (!fireflyNight(world, now)) return fail('반딧불이는 여름·가을 밤에만 날아요');
    if (fireflyLeft(mine, now) <= 0) return fail('오늘은 그만 — 나머지는 내일 또 만나요');
    const key = dayKey(now);
    if (mine.ffDay !== key){ mine.ffDay = key; mine.ffGot = 0; }
    mine.ffGot++;
    give(mine, 'firefly', 1); mine.xp += 3; bump(mine, 'caught', 1, now);
    if (mine.dex.indexOf('firefly') < 0) mine.dex.push('firefly');
    return okay('반딧불이를 잡았어요 ✨ (오늘 ' + mine.ffGot + '/' + FIREFLY_MAX + ')');
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
    if (both) logAdd(world, mine.key, '둘이 나란히 모닥불 앞에서 별을 봤어요', now);
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
  function logAdd(world, who, text, now){
    world.log.unshift({ t: now == null ? Date.now() : now, who, text });
    if (world.log.length > LOG_MAX) world.log.length = LOG_MAX;
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
    p.wet = now + WATER_HOURS * H;
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
      p.wet = now + WATER_HOURS * H;
      if (p.crop) p.care = (p.care || 0) + 1;
      n++;
    });
    return n;
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
      if (mine.dex.indexOf('giant:' + cropId) < 0) mine.dex.push('giant:' + cropId);
      logAdd(world, mine.key, '둘이서 큰 ' + eul(C.name) + ' 뽑았어요!', now);
      return okay('둘이서 ' + eul('<b>큰 ' + C.name + '</b>') + ' 뽑았어요!', { giant: true });
    }
    const star = starOf(p, gh);
    const n = C.yield + (star >= 2 ? 1 : 0);   // 잘 돌본 작물은 한 개 더
    const cropId = p.crop, gold = star >= 3;
    give(mine, (gold ? 'gold:' : 'crop:') + cropId, n);
    mine.xp += XP.harvest + (gold ? 4 : 0); bump(mine, 'harvested', n, now);
    if (mine.dex.indexOf(cropId) < 0) mine.dex.push(cropId);
    if (gold && mine.dex.indexOf('gold:' + cropId) < 0) mine.dex.push('gold:' + cropId);
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
    if (k === 'ped'){
      if (!peddlerHere(world, now)) return fail('행상인은 오늘 안 왔어요');
      const it = peddlerStock(world, now).find(x => x.slot === v);
      if (!it) return fail('오늘은 그 물건이 없어요');
      if (peddlerGot(mine, now, v)) return fail('오늘 몫은 이미 샀어요');
      if (mine.coins < it.cost) return fail('동전이 모자라요');
      mine.coins -= it.cost;
      pedToday(mine, now);
      mine.pedGot[v] = true;
      if (it.id === 'box'){
        const P = openBox(world, mine, now);
        logAdd(world, mine.key, NAME[mine.key] + '가 행상인의 보따리에서 ' + P.say.replace(/<[^>]*>/g, '') + '을 얻었어요', now);
        return okay('보따리를 풀었더니 — ' + P.say + '!', { box: true });
      }
      give(mine, it.id, it.n);
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
  function takeHoney(world, mine){
    const hv = world.buildings.hive; if (!hv || !hv.honey) return fail('꿀이 아직 없어요');
    give(mine, 'honey', hv.honey); const n = hv.honey; hv.honey = 0;
    if (mine.dex.indexOf('honey') < 0) mine.dex.push('honey');
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
    logAdd(world, mine.key, NAME[mine.key] + '가 ' + NAME[to] + '에게 쪽지를 보냈어요', now);
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
    got.forEach(g => { if (g.id === 'coins') coins += g.n; else if (g.id !== 'note') give(mine, g.id, g.n); });
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
  // 일기 하나에 비료 하나 — 현실 연동. 서버가 센 일기 수에서 쓴 만큼 뺀다.
  // 모험단 원정에서 주워 온 씨앗. 모험단 저장은 「지금까지 몇 개 주웠나」만 세고,
  // 농장은 「그중 몇 개를 가져갔나」를 제 저장에 적는다. 두 놀이가 서로의 저장에
  // 손대지 않으므로 순서가 엇갈려도 두 번 받거나 잃을 일이 없다 — 일기→비료와 같은 꼴.
  function seedsFromExpo(world, mine, seedsEver, now){
    const owed = Math.max(0, Math.floor(Number(seedsEver) || 0) - (mine.expoSeeds || 0));
    if (!owed || !world || !world.started) return [];
    const season = calendar(world, now).season;
    // 별열매(rare)는 뺀다 — 그건 주문을 다 채운 사람에게만 오는 씨앗이다.
    const pool = Object.keys(CROPS).filter(c => !CROPS[c].rare && CROPS[c].season.indexOf(season) >= 0);
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
  function fertFromDiaries(mine, diaries){
    const owed = Math.max(0, (diaries || 0) - (mine.fertSpent || 0));
    if (!owed) return 0;
    give(mine, 'fert', owed); mine.fertSpent = diaries;
    return owed;
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
    world.hot = hotCrop(world, now);
    return notes;
  }

  // 규칙을 FARM 에 얹는다. 이 뒤부터 R.till · R.buy … 를 부를 수 있다.
  Object.assign(FARM, {
    ringOf,
    fishLeft,
    fish,
    thingsOn,
    placeBlocked,
    moveThing,
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
    fireSit,
    peddlerStock,
    peddlerGot,
    peddlerWant,
    peddlerSoldLeft,
    sellToPeddler,
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
    fertFromDiaries,
    seedsFromExpo,
    newDay,
  });
})();
