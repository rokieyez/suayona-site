// pages/hero-walk.js — 「인생 퀘스트」 무대: 아이소메트릭 길 위를 수아·연아가 한 발 한 발 걸어가며 귀여운 「공부몹」을 알아서 물리친다(idle quest).
// 2026-10-05 부모 요청: 「배경은 아이소메트릭, 최대한 레이어 많이 쌓고 고화소로」 · 캐릭터는 수아·연아 히어로 걷기 그림(tools/hero-atlas.py 가 굽는다).
// 레이어(뒤→앞): 하늘 그러데이션 · 별/해/달 · 먼 구름 · 먼 산 · 가까운 산 · 가까운 구름 · 언덕(작은 나무) · 땅(풀 마름모) · 길(돌 마름모·흙 가장자리·풀 테두리)
//   · 땅 장식(꽃·자갈) · 지평선 안개 · 그림자 · 나무 줄·길가 소품·아이·짝꿍 새·몹(깊이 순) · 날아가는 공격 · 파티클 · 앞쪽 풀숲·나뭇가지
//   · 시간대 빛깔 · 밤 불빛 · 날씨(꽃잎·낙엽·눈·반딧불) · 빛줄기 · 비네트 · 이름표·HP 칸·+XP 글자·말풍선
// 페이지와는 콜백으로만 이어진다 — 능력치 표(STATS)·셈(statsAt)은 페이지 것을 그대로 받아 쓴다. 능력치가 일곱 개(wisdom)가 돼도 받은 목록을 돌 뿐이다.
// 다른 페이지(study.html)가 작게(compact) 띄울 수도 있다. 고전 스크립트끼리 이름이 부딪히지 않게 IIFE 로 가두고 window.HEROWALK 만 내놓는다.
(function(){
  'use strict';
  const V = '1005a';
  // tools/hero-atlas.py 가 찍은 칸 정보 — 줄 = S·SW·W·NW·N, 칸 = 서기·걷기 4. foot = 칸 안의 발끝 줄, cx = 윗몸 가운데 열, tall = 서기 칸 키(px)
  const ATLAS = {
    sua:  { src: '/pages/hero-sua.png?v=' + V,  w: 166, h: 231, foot: 228, cx: 83, tall: 220, hip: 179, cut: [78, 70] },
    yona: { src: '/pages/hero-yona.png?v=' + V, w: 144, h: 229, foot: 226, cx: 72, tall: 220, hip: 177, cut: [68, 61] },
  };
  // 원본 걷기 칸은 늘 같은 다리가 앞이라(힉스필드로 다시 그려도 같았다, 2026-10-05) 걸을 때는 서기 칸을 몸통·두 다리로 잘라
  // 다리를 엉덩이에서 서로 반대로 흔든다. hip = 반바지 아랫단 줄, cut = 두 다리를 가르는 선의 [엉덩이 쪽, 발 쪽] 열(서기 칸 기준)
  const LEG_SWING = 13, LEG_LIFT = 8;                                    // 발끝이 앞뒤로 가는 거리 · 앞으로 나오는 발을 드는 높이(시트 px)
  const ROW_SW = 1;                                                      // 앞옆(SW) 줄을 좌우로 뒤집어 남동(SE)으로 걷는다
  const FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  const INK = '#2f2a24', TAU = Math.PI * 2;
  const NAME = { sua: '수아', yona: '연아' }, COLOR = { sua: '#ff7f8a', yona: '#6cc7b3' }, CM = { sua: 150, yona: 135 };
  const DEF_COLOR = { art: '#ff9f68', stage: '#b9a3d6', write: '#ff7f8a', body: '#8ec9ee', heart: '#f7a8bf', grit: '#ffd979', wisdom: '#8fcf6a' };
  const SHOT = { art: 'drop', stage: 'note', write: 'glyph', body: 'dash', heart: 'heart', grit: 'star', wisdom: 'page' };   // 가장 높은 능력치 → 공격 모양
  const PROP_LV = 3, PROP_BIG = 6;                                       // 길가 소품이 생기는 레벨 · 커지는 레벨(예전 방의 벽 물건과 같다)
  const TW = 56, TH = 28;                                                // 마름모 타일 한 칸(논리 단위)
  const WALK = 0.72;                                                     // 걷는 빠르기(타일/초) — 천천히
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const KINDS = ['slime', 'jelly', 'bat', 'ghost'], HP = { slime: 3, jelly: 3, bat: 3, ghost: 4, golem: 7 };
  const MOB_Z = { slime: 13, jelly: 15, bat: 30, ghost: 26, golem: 36 };   // 맞는 자리(몸 가운데)의 높이
  const MOB_TOP = { slime: 46, jelly: 34, bat: 50, ghost: 52, golem: 76 };   // 머리끝 높이(HP 칸 자리)
  const MOB_W = { slime: 21, jelly: 18, bat: 14, ghost: 16, golem: 27 };

  const hash = n => { let h = Math.imul(n | 0, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA77); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ 0x5bd1e995);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const backOut = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  function seasonOf(at){ const m = new Date(at).getMonth() + 1; return m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; }
  function todOf(h){ return h < 5 || h >= 19.5 ? 'night' : h < 7.5 ? 'dawn' : h < 17 ? 'day' : 'dusk'; }
  const SKY = {
    dawn:  { top: '#6c8cd0', mid: '#c8b2d8', bot: '#ffd2a8', far: '#a3a6d0', mid2: '#8291c2', haze: 'rgba(255,214,184,', tint: 'rgba(255,160,110,.10)', sun: '#ffc98a', cloud: ['#fff1e8', 'rgba(222,160,178,.6)'] },
    day:   { top: '#4fa3e3', mid: '#94cdf0', bot: '#dff2fb', far: '#a7c7e4', mid2: '#84acd5', haze: 'rgba(226,243,251,', tint: null, sun: '#fff4c8', cloud: ['rgba(255,255,255,.96)', 'rgba(160,192,226,.6)'] },
    dusk:  { top: '#474c98', mid: '#c27499', bot: '#ffb27c', far: '#8e7fb2', mid2: '#6c67a0', haze: 'rgba(255,186,150,', tint: 'rgba(255,110,80,.12)', sun: '#ffab6b', cloud: ['#ffd8c4', 'rgba(150,104,158,.58)'] },
    night: { top: '#0c1231', mid: '#1c2758', bot: '#364785', far: '#2a356b', mid2: '#222d5c', haze: 'rgba(70,90,160,', tint: 'rgba(10,16,48,.44)', sun: null, cloud: ['rgba(122,136,192,.32)', 'rgba(36,46,96,.34)'] },
  };
  const LAND = {                                                         // 계절마다 땅·언덕·잎 빛깔
    spring: { grass: ['#b4e08e', '#94cf70'], hill: '#86c26c', blade: ['#5e9e48', '#9fd77a'], leaf: [['#68b25a', '#8fd07a', '#c8eea0'], ['#f19bb8', '#ffc4d6', '#fff0f5']], fl: ['#ff9fb8', '#fff3a0', '#ffffff', '#c9b6ff'], fg: '#3f7a3a' },
    summer: { grass: ['#8fd16e', '#6dbb52'], hill: '#5eab4d', blade: ['#3f8a3a', '#7cc95e'], leaf: [['#2f8a40', '#4fae55', '#8fd68a'], ['#3a9447', '#62bb5c', '#a8e295']], fl: ['#fff3a0', '#ff8f6b', '#ffffff', '#8ec9ee'], fg: '#2c6630' },
    autumn: { grass: ['#d8cc86', '#c3b062'], hill: '#b99a4f', blade: ['#8f7a36', '#d8c070'], leaf: [['#d36a2a', '#ee9a40', '#ffd27a'], ['#c0432e', '#e5683f', '#ffab7a'], ['#b7a034', '#d9c14e', '#f6e38c']], fl: ['#ffb36b', '#ffe08a', '#e8672a', '#ffffff'], fg: '#6b5426' },
    winter: { grass: ['#f3f7fc', '#dfe8f3'], hill: '#cfdcec', blade: ['#9fb4cc', '#ffffff'], leaf: [['#2f6b52', '#3f8566', '#e9f2fa'], ['#2f6b52', '#3f8566', '#e9f2fa']], fl: ['#ffffff', '#d8e6f6', '#ffffff', '#ffd6e0'], fg: '#c4d3e6' },
  };

  // 바닷가 지역의 모래밭(겨울이면 그냥 눈밭) — 잎 빛깔은 여름 것을 빌린다
  const SAND = { grass: ['#f1e2b4', '#e4cf98'], hill: '#e4cf98', blade: ['#a4ad62', '#ccd68a'], leaf: LAND.summer.leaf, fl: ['#ffffff', '#ffd0dc', '#ffe6a8', '#bfe3f0'], fg: '#8d9a52' };
  const SEA = { dawn: ['#8a9fd6', '#d6c4dc'], day: ['#3d9bd6', '#8fd6ee'], dusk: ['#6a5c9c', '#e09a92'], night: ['#121c46', '#2a3a78'] };

  const imgs = {};
  function sheet(k){ if (!imgs[k]){ const im = new Image(); im.decoding = 'async'; im.src = ATLAS[k].src; imgs[k] = im; } return imgs[k]; }

  function mount(cv, opts){
    opts = opts || {};
    const compact = !!opts.compact;
    const kids = (opts.kids || ['sua', 'yona']).filter(k => ATLAS[k]).slice(0, 2);   // compact 도 둘까지(공부 계획 첫 화면이 둘을 함께 보인다)
    const LH = compact ? 210 : 330;                                      // 논리 높이 — 화면 높이에 맞춰 늘리고 줄인다(너비는 비율대로)
    const g = cv.getContext('2d');
    let LW = 600, K = 1, DPR = 1, CX = 0, CY = 0, HY = 0;
    let dead = false, raf = 0, visible = true, dirty = true, last = 0, lastDraw = 0, infoT = 0;
    let sel = kids.includes(opts.sel) ? opts.sel : kids[0];
    const st = { t: 0, camU: 0, walkT: 0, fight: false, mobs: [], shots: [], parts: [], texts: [], weather: [], cool: 0.8, count: 0, pick: {} };
    const team = kids.map((k, i) => ({ k, du: i ? -1.6 : 0, v: kids.length > 1 ? (i ? 0.72 : -0.42) : 0, atk: 0.35 + i * 0.42, hop: -9, dash: null, dust: i * 0.11, phase: i * 0.37 }));
    const info = {};
    const world = { lv: {}, keys: [], season: 'autumn', tod: 'day', hour: 12, region: 'forest', note: '' };
    let hits = [], spots = {}, lamps = [];

    // ---------- 페이지에서 받는 것 — 능력치·연속·이름표·키·짝꿍. 매 장면이 아니라 refresh() 와 2초마다 한 번만 묻는다 ----------
    function colorOf(key){ const x = opts.stats && opts.stats.find(y => y.key === key); return (x && x.color) || DEF_COLOR[key] || '#ffd979'; }
    function refreshInfo(){
      const at = opts.at ? opts.at() : Date.now(), lv = {};
      kids.forEach(k => {
        const s = (opts.getStats && opts.getStats(k)) || {};
        const keys = opts.stats ? opts.stats.map(x => x.key).filter(key => s[key]) : Object.keys(s);
        let top = null;
        keys.forEach(key => { const o = s[key], b = top && s[top]; if (!b || (o.lv || 0) > (b.lv || 0) || ((o.lv || 0) === (b.lv || 0) && (o.xp || 0) > (b.xp || 0))) top = key; lv[key] = Math.max(lv[key] || 0, o.lv || 0); });
        if (top && !(s[top].xp > 0 || s[top].lv > 0)) top = null;        // 아직 아무 기록이 없으면 별
        info[k] = { top, streak: opts.streak ? Number(opts.streak(k)) || 0 : 0, label: opts.label ? opts.label(k) : NAME[k], badge: opts.badge ? opts.badge(k) || '' : '',
          cm: clamp((opts.height && Number(opts.height(k))) || CM[k], 95, 185), pet: opts.pet ? opts.pet(k) : null };
      });
      world.lv = lv; world.keys = Object.keys(lv).filter(key => lv[key] >= PROP_LV);
      world.season = seasonOf(at);
      const rg = opts.region ? opts.region(sel) : null;                 // 지역(숲·바닷가·성 앞)과 「다음 지역까지 N일」 — 페이지가 정한다
      world.region = (rg && rg.key) || 'forest'; world.note = (rg && rg.note) || '';
      const d = new Date(); world.hour = d.getHours() + d.getMinutes() / 60; world.tod = todOf(world.hour);
    }
    const landOf = se => world.region === 'sea' && se !== 'winter' ? SAND : LAND[se];
    const kidTall = k => (info[k] ? info[k].cm : CM[k]) * 0.6;           // 1cm = 0.6 논리 단위 — 키가 크면 그림도 자란다

    // ---------- 자리 — 세계(u: 길 방향 남동, v: 길 건너 남서) → 화면. 카메라는 앞선 아이를 따라간다 ----------
    const P = (u, v) => [CX + ((u - st.camU) - v) * TW / 2, CY + ((u - st.camU) + v) * TH / 2];
    function layout(){
      const r = cv.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(w * DPR), H = Math.round(h * DPR);
      if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
      K = h / LH; LW = w / K;
      CX = LW * (compact ? 0.3 : LW < 520 ? 0.36 : 0.38); CY = LH * (compact ? 0.7 : 0.6); HY = LH * (compact ? 0.3 : 0.27);
      dirty = true;
    }
    function kidPos(m){
      let u = st.camU + m.du, v = m.v;
      if (m.dash){ const mob = liveMob(); if (mob){ const f = Math.sin(Math.PI * Math.min(1, m.dash.t / m.dash.dur)) * 0.85; u += (mob.u - 0.9 - u) * f; v += (mob.v - v) * f; } }
      return [u, v];
    }
    const liveMob = () => st.mobs.find(m => m.hp > 0);
    const mobCenter = m => [m.u, m.v, MOB_Z[m.kind] + (m.kind === 'bat' ? Math.sin(st.t * 3 + m.seed * 6) * 4 : 0)];

    // ---------- 몹 · 공격 · 파티클 ----------
    function spawn(du, kind){
      st.count++;
      kind = kind || (st.count % 5 === 0 ? 'golem' : KINDS[Math.floor(Math.random() * KINDS.length)]);
      const m = { kind, u: st.camU + du, v: -0.12, hp: HP[kind], max: HP[kind], born: st.t, die: -1, hitT: -9, seed: Math.random(),
        mark: kind === 'bat' ? String(Math.floor(Math.random() * 10)) : kind === 'ghost' ? 'ABCDEFGHKMNPRSTWXYZ'.charAt(Math.floor(Math.random() * 19)) : '' };
      st.mobs.push(m); puff(m.u, m.v, 6, 10); return m;
    }
    function part(u, v, o){ st.parts.push(Object.assign({ u, v, x: 0, z: 0, vx: 0, vz: 0, g: 0, age: 0, life: 0.6, size: 3, rot: 0, vr: 0, color: '#fff', kind: 'spark' }, o)); }
    function puff(u, v, n, z){ for (let i = 0; i < n; i++){ const a = i / n * TAU; part(u, v, { kind: 'smoke', x: Math.cos(a) * 6, z: (z || 0) + Math.sin(a) * 4, vx: Math.cos(a) * 26, vz: 8 + Math.sin(a) * 14, life: 0.55, size: 5 + Math.random() * 3 }); } }
    function sparks(u, v, z, color, n){ for (let i = 0; i < n; i++){ const a = Math.random() * TAU, sp = 40 + Math.random() * 50; part(u, v, { kind: 'spark', z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.2, size: 3 + Math.random() * 2.5, color }); } }
    function dust(u, v){ part(u, v, { kind: 'dust', x: -4 + Math.random() * 3, z: 1, vx: -14 - Math.random() * 8, vz: 6 + Math.random() * 6, life: 0.6, size: 2.2 + Math.random() * 1.6 }); }
    function poof(m, text){
      const c = mobCenter(m), cols = ['#ffd24d', '#ff7f8a', '#6cc7b3', '#8ec9ee', '#b9a3d6', '#ffffff'];
      for (let i = 0; i < 10; i++){ const a = i / 10 * TAU + Math.random() * 0.3, sp = 55 + Math.random() * 45; part(m.u, m.v, { kind: 'star', z: c[2], vx: Math.cos(a) * sp, vz: Math.sin(a) * sp + 30, g: 120, life: 0.9, size: 4 + Math.random() * 2.5, vr: (Math.random() - 0.5) * 10, color: cols[i % cols.length] }); }
      sparks(m.u, m.v, c[2], '#fff6c4', 8); puff(m.u, m.v, 8, c[2] - 6);
      if (text) st.texts.push({ u: m.u, v: m.v, z: c[2] + 22, text, age: 0 });
    }
    function attack(m, big, text){
      const mob = liveMob(); if (!mob) return;
      const key = info[m.k] && info[m.k].top;
      let shape = SHOT[key] || 'star';
      m.hop = st.t;
      if (shape === 'dash'){ if (!big){ m.dash = { t: 0, dur: 0.52, hit: false }; return; } shape = 'star'; }
      const p = kidPos(m);
      st.shots.push({ k: m.k, mob, shape, color: key ? colorOf(key) : '#ffd979', from: [p[0], p[1], kidTall(m.k) * 0.55], p: 0, dur: big ? 0.42 : 0.52, dmg: big ? mob.hp : 1, big: !!big, text,
        ch: shape === 'glyph' ? '가나다라ABC'.charAt(Math.floor(Math.random() * 7)) : shape === 'note' && Math.random() < 0.5 ? 2 : 1, spin: Math.random() * 6 });
    }
    function hit(mob, dmg, color, text){
      mob.hp = Math.max(0, mob.hp - dmg); mob.hitT = st.t;
      const c = mobCenter(mob); sparks(mob.u, mob.v, c[2], color, 6);
      if (mob.hp <= 0){ mob.die = st.t; poof(mob, text || '+' + mob.max + ' XP'); st.cool = 1.3 + Math.random() * 1.2; }
    }

    // ---------- 날씨 — 화면 기준(카메라와 따로 논다) ----------
    function weatherKind(){ const s = world.season; return s === 'winter' ? 'snow' : world.tod === 'night' ? (s === 'summer' || s === 'spring' ? 'fly' : s === 'autumn' ? 'leaf' : 'snow') : s === 'spring' ? 'petal' : s === 'autumn' ? 'leaf' : 'mote'; }
    function weatherStep(dt){
      const want = compact ? 9 : 24, kind = weatherKind();
      while (st.weather.length < want) st.weather.push({ x: Math.random() * LW, y: Math.random() * LH, ph: Math.random() * TAU, s: 0.6 + Math.random() * 0.8, kind });
      st.weather.forEach(w => {
        w.kind = kind; w.ph += dt;
        const fall = kind === 'snow' ? 16 : kind === 'petal' ? 14 : kind === 'leaf' ? 20 : kind === 'fly' ? 0 : -3;
        w.x += (kind === 'fly' ? Math.sin(w.ph * 0.7) * 10 : -10 - w.s * 8 + Math.sin(w.ph * 1.3) * 8) * dt; w.y += (fall * w.s + (kind === 'fly' ? Math.cos(w.ph * 0.9) * 8 : 0)) * dt;
        if (w.x < -10) w.x += LW + 20; if (w.x > LW + 10) w.x -= LW + 20; if (w.y > LH + 10) w.y -= LH + 20; if (w.y < -10) w.y += LH + 20;
      });
    }

    // ---------- 한 걸음 ----------
    function update(dt){
      st.t += dt;
      if (st.t - infoT > 2){ infoT = st.t; refreshInfo(); }
      const mob = liveMob();
      st.fight = !!mob && mob.u - st.camU <= 2.5;
      if (!st.fight){ st.camU += WALK * dt; st.walkT += dt; }
      if (mob && !st.fight && st.t - mob.born > 0.4) mob.u -= 0.32 * dt;   // 몹도 깡총깡총 다가온다
      if (!st.mobs.length){ st.cool -= dt; if (st.cool <= 0) spawn(6 + Math.random() * 1.2); }
      team.forEach((m, i) => {
        if (m.dash){ m.dash.t += dt; if (!m.dash.hit && m.dash.t >= m.dash.dur / 2){ m.dash.hit = true; const mm = liveMob(); if (mm) hit(mm, 1, colorOf('body')); } if (m.dash.t >= m.dash.dur) m.dash = null; }
        if (st.fight){ m.atk -= dt; if (m.atk <= 0){ attack(m); m.atk = 0.82 + Math.random() * 0.22; } }
        else { m.atk = Math.min(m.atk, 0.3 + i * 0.42); m.dust -= dt; if (m.dust <= 0){ m.dust = 0.24; const p = kidPos(m); dust(p[0], p[1]); } }
      });
      st.shots = st.shots.filter(s => { s.p += dt / s.dur; if (s.p < 1) return true; if (s.mob.hp > 0) hit(s.mob, s.dmg, s.color, s.text); return false; });
      st.mobs = st.mobs.filter(m => m.die < 0 || st.t - m.die < 0.3);
      st.parts = st.parts.filter(p => { p.age += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= p.g * dt; p.rot += p.vr * dt; if (p.kind === 'smoke' || p.kind === 'spark'){ p.vx *= 0.92; p.vz *= 0.92; } return p.age < p.life; });
      st.texts = st.texts.filter(x => (x.age += dt) < 1.5);
      weatherStep(dt);
    }

    // ================= 그리기 =================
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    const oval = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };
    function rrect(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    const ink = w => { g.strokeStyle = INK; g.lineWidth = w || 1.6; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
    function star5(x, y, r, rot){ g.beginPath(); for (let i = 0; i < 10; i++){ const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
    function heartPath(x, y, s){ g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.closePath(); }
    function outlined(text, x, y, fill, size, w){ g.font = '800 ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = w || 3; g.strokeStyle = INK; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y); }

    // ① 하늘 · 별 · 해/달
    function drawSky(sky){
      const gr = g.createLinearGradient(0, 0, 0, HY + 10); gr.addColorStop(0, sky.top); gr.addColorStop(0.55, sky.mid); gr.addColorStop(1, sky.bot); R(0, 0, LW, HY + 30, gr);
      if (world.tod === 'night') for (let i = 0; i < (compact ? 26 : 60); i++){ const x = hash(i * 7 + 1) * LW, y = hash(i * 11 + 3) * HY * 0.9, a = 0.35 + 0.65 * Math.abs(Math.sin(st.t * (0.6 + hash(i) * 1.4) + i)); R(x, y, 1.2, 1.2, 'rgba(255,255,240,' + a.toFixed(2) + ')'); if (i % 9 === 0){ R(x - 2, y + 0.4, 5.2, 0.4, 'rgba(255,255,240,' + (a * 0.6).toFixed(2) + ')'); R(x + 0.4, y - 2, 0.4, 5.2, 'rgba(255,255,240,' + (a * 0.6).toFixed(2) + ')'); } }
    }
    function sunPos(){ const f = clamp((world.hour - 5.5) / 14, 0, 1); return [LW * (0.12 + 0.76 * f), HY - 6 - Math.sin(Math.PI * f) * (HY - 24)]; }
    function drawSun(sky){
      if (world.tod === 'night'){
        const x = LW * 0.8, y = HY * 0.36, gl = g.createRadialGradient(x, y, 4, x, y, 46); gl.addColorStop(0, 'rgba(230,236,255,.45)'); gl.addColorStop(1, 'rgba(230,236,255,0)'); R(x - 50, y - 50, 100, 100, gl);
        circ(x, y, 10, '#f6f2da'); circ(x - 3, y - 2, 2.4, 'rgba(190,184,150,.55)'); circ(x + 3.5, y + 3, 1.8, 'rgba(190,184,150,.5)'); circ(x + 2, y - 4.5, 1.2, 'rgba(190,184,150,.45)');
        return;
      }
      const s = sunPos(), gl = g.createRadialGradient(s[0], s[1], 6, s[0], s[1], 60); gl.addColorStop(0, sky.sun); gl.addColorStop(0.25, 'rgba(255,240,200,.45)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
      R(s[0] - 64, s[1] - 64, 128, 128, gl); circ(s[0], s[1], 11, sky.sun); circ(s[0] - 2, s[1] - 2, 7, 'rgba(255,255,255,.55)');
    }
    // ② 구름 — 바닥이 납작한 뭉게구름(그늘 한 겹 + 몸 + 윗면 빛)
    function cloud(x, y, s, col){
      const blob = (dx, dy, c) => { g.fillStyle = c; g.beginPath(); [[-22, 0, 11], [-9, -8, 14], [8, -7, 12], [22, 0, 9]].forEach(b => { g.moveTo(x + (b[0] + dx) * s + b[2] * s, y + (b[1] + dy) * s); g.arc(x + (b[0] + dx) * s, y + (b[1] + dy) * s, b[2] * s, 0, TAU); }); g.rect(x + (-24 + dx) * s, y + (-2 + dy) * s, 48 * s, 9 * s); g.fill(); };
      blob(2, 3, col[1]); blob(0, 0, col[0]);
      if (world.tod !== 'night'){ g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - 9 * s, y - 14 * s, 7 * s, 3 * s, -0.2, 0, TAU); g.fill(); }
    }
    function clouds(par, speed, n, y0, sc, seed, sky){
      const span = LW + 260;
      for (let i = 0; i < n; i++){
        const base = hash(i * 31 + seed) * span, x = ((base - st.camU * TW * par - st.t * speed) % span + span) % span - 130;
        cloud(x, y0 + hash(i * 17 + seed) * 18, sc * (0.7 + hash(i * 13 + seed) * 0.6), sky.cloud);
      }
    }
    // ③ 산 — 사인 몇 개를 겹친 능선(이음매 없이 되풀이). 봉우리는 눈(겨울엔 하얗게)
    const ridgeY = (X, base, amp, f, sd) => base - amp * (0.55 + 0.32 * Math.sin(X * f + sd) + 0.2 * Math.sin(X * f * 2.7 + sd * 1.7) + 0.1 * Math.sin(X * f * 6.1 + sd * 2.3));
    function ridge(off, base, amp, f, sd, fill, snow){
      g.beginPath(); g.moveTo(0, LH); for (let x = 0; x <= LW + 6; x += 5) g.lineTo(x, ridgeY(x + off, base, amp, f, sd)); g.lineTo(LW, LH); g.closePath(); g.fillStyle = fill; g.fill();
      if (snow){ g.save(); g.clip(); const sg = g.createLinearGradient(0, base - amp * 1.15, 0, base - amp * 0.72); sg.addColorStop(0, snow); sg.addColorStop(1, 'rgba(255,255,255,0)'); R(0, base - amp * 1.3, LW, amp * 0.6, sg); g.restore(); }
    }
    function drawMountains(sky, se){
      if (world.region === 'sea') return drawSea(sky);
      if (!compact) ridge(st.camU * TW * 0.03, HY - 2, HY * 0.5, 0.011, 1.3, sky.far, se === 'winter' ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.4)');
      ridge(st.camU * TW * 0.07, HY + 2, HY * (compact ? 0.42 : 0.32), 0.019, 4.1, sky.mid2, se === 'winter' ? 'rgba(255,255,255,.8)' : null);
    }
    // ③' 바닷가 — 산 대신 수평선까지 바다. 물결 줄·반짝임·돛단배 하나·갈매기 둘
    function drawSea(sky){
      const C = SEA[world.tod], top = HY - (compact ? 9 : 14), night = world.tod === 'night';
      const sg = g.createLinearGradient(0, top, 0, HY + 4); sg.addColorStop(0, C[0]); sg.addColorStop(1, C[1]); R(0, top, LW, HY + 4 - top, sg);
      R(0, top, LW, 1, 'rgba(255,255,255,.55)');
      g.strokeStyle = night ? 'rgba(200,215,255,.35)' : 'rgba(255,255,255,.7)'; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i < (compact ? 14 : 22); i++){ const y = top + 3 + hash(i * 5 + 1) * (HY - top - 1), w = 4 + hash(i * 3) * 8, x = ((hash(i * 7) * (LW + 40) - st.camU * TW * 0.05 + Math.sin(st.t * 0.8 + i) * 3) % (LW + 40) + LW + 40) % (LW + 40) - 20; g.moveTo(x, y); g.lineTo(x + w, y); }
      g.stroke();
      const bx = ((LW * 0.62 + st.t * 3 - st.camU * TW * 0.04) % (LW + 60) + LW + 60) % (LW + 60) - 30, by = top + 2 + Math.sin(st.t * 1.4) * 0.6;
      poly([[bx - 7, by + 2], [bx + 7, by + 2], [bx + 5, by + 5], [bx - 5, by + 5]], '#8a5a3a');
      poly([[bx, by + 1.5], [bx, by - 11], [bx + 7, by + 1.5]], night ? '#c8cde6' : '#ffffff'); poly([[bx - 1, by + 1.5], [bx - 1, by - 8], [bx - 6, by + 1.5]], '#ff9fa8');
      if (night) return;
      g.strokeStyle = INK; g.lineWidth = 1.1; g.beginPath();
      [[0.3, 0.45, 5], [0.38, 0.38, 4]].forEach((b, i) => { const x = ((LW * b[0] + st.t * (6 + i * 2)) % (LW + 40)) - 20, y = HY * b[1] + Math.sin(st.t * 2 + i) * 2, w = b[2], f = Math.sin(st.t * 6 + i * 2) * 1.5; g.moveTo(x - w, y - 1 + f); g.quadraticCurveTo(x - w / 2, y - 3, x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y - 1 + f); });
      g.stroke();
    }
    // ③'' 성 앞 — 먼 산 앞 언덕 위에 성 하나(가운데 큰 탑 + 양옆 탑, 깃발). 아주 멀어서 거의 안 움직인다
    function drawCastle(sky, se){
      const s = compact ? 0.8 : 1.15, x0 = LW * 0.66, y0 = HY + 3, night = world.tod === 'night';
      const W = se === 'winter' ? ['#eef2f8', '#cdd6e4'] : ['#efe3cf', '#d2bf9f'], ROOF = ['#ff8f9a', '#8fb8e8'];
      g.save(); g.translate(x0, y0); g.scale(s, s); g.lineJoin = 'round';
      const block = (x, y, w, h, cren) => { R(x, y, w, h, W[0]); R(x + w * 0.62, y, w * 0.38, h, W[1]); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x, y, w, h);
        if (cren) for (let i = 0; i < w - 2; i += 5){ R(x + i, y - 3, 3, 3, W[0]); g.strokeRect(x + i, y - 3, 3, 3); } };
      const roof = (x, y, w, col) => { poly([[x - 2, y], [x + w / 2, y - w * 1.15], [x + w + 2, y]], col); ink(1.2); g.strokeStyle = INK; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + w / 2, y - w * 1.15); g.lineTo(x + w / 2, y - w * 1.15 - 7); g.stroke(); poly([[x + w / 2, y - w * 1.15 - 7], [x + w / 2 + 6, y - w * 1.15 - 5.5 + Math.sin(st.t * 4) * 0.8], [x + w / 2, y - w * 1.15 - 4]], col); };
      const win = (x, y) => { R(x, y, 2.4, 3.6, night ? '#ffd27a' : '#5a4a6a'); };
      block(-36, -18, 72, 18, true);                                     // 성벽
      block(-44, -34, 14, 34, false); roof(-44, -34, 14, ROOF[1]); win(-38.5, -26);
      block(30, -34, 14, 34, false); roof(30, -34, 14, ROOF[1]); win(35.5, -26);
      block(-12, -46, 24, 46, false); roof(-12, -46, 24, ROOF[0]); win(-6, -38); win(3.6, -38); win(-1.2, -28);
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(-6, -9); g.arc(0, -9, 6, Math.PI, 0); g.lineTo(6, 0); g.closePath(); g.fillStyle = night ? '#6a4a2a' : '#8a5a3a'; g.fill(); ink(1.2);
      g.restore();
    }
    // ④ 언덕 — 철 빛깔 + 능선 위 작은 나무 실루엣
    function drawHills(sky, se){
      if (world.region === 'sea') return;
      if (world.region === 'castle') drawCastle(sky, se);
      const L = landOf(se), off = st.camU * TW * 0.15, base = HY + 3, amp = compact ? 10 : 15;
      ridge(off, base, amp, 0.03, 2.2, L.hill, null);
      const hz = g.createLinearGradient(0, base - amp * 1.3, 0, base); hz.addColorStop(0, sky.haze + '.35)'); hz.addColorStop(1, sky.haze + '0)'); R(0, base - amp * 1.4, LW, amp * 1.4, hz);
      g.fillStyle = se === 'winter' ? '#5d7f74' : 'rgba(40,80,50,.55)';
      for (let x = -8; x <= LW + 8; x += 7){ const X = x + off, j = Math.floor(X / 7); if (hash(j * 5 + 2) > 0.42) continue; const xx = j * 7 - off, y = ridgeY(j * 7, base, amp, 0.03, 2.2), r = 2.4 + hash(j) * 2.2; g.beginPath(); g.arc(xx, y - r + 1.5, r, 0, TAU); g.arc(xx + r * 0.7, y - r * 0.6 + 1.5, r * 0.7, 0, TAU); g.fill(); }
    }
    // ⑤ 땅 — 풀 마름모(밝은/어두운 두 묶음을 한 번씩 칠한다) · 길 · 길 가장자리 풀 · 꽃과 자갈
    function tileRange(){
      const c = [[0, HY], [LW, HY], [0, LH], [LW, LH]].map(p => { const a = (p[0] - CX) / (TW / 2), b = (p[1] - CY) / (TH / 2); return [(a + b) / 2, (b - a) / 2]; });
      return { u0: Math.floor(st.camU + Math.min(...c.map(x => x[0]))) - 2, u1: Math.ceil(st.camU + Math.max(...c.map(x => x[0]))) + 2, v0: Math.floor(Math.min(...c.map(x => x[1]))) - 2, v1: Math.ceil(Math.max(...c.map(x => x[1]))) + 2 };
    }
    function diamond(path, u, v, inset){ const a = 0.5 - (inset || 0); let p = P(u - a, v - a); path.moveTo(p[0], p[1]); p = P(u + a, v - a); path.lineTo(p[0], p[1]); p = P(u + a, v + a); path.lineTo(p[0], p[1]); p = P(u - a, v + a); path.lineTo(p[0], p[1]); path.closePath(); }
    function drawGround(sky, se, tr){
      const L = landOf(se);
      g.save(); g.beginPath(); g.rect(0, HY, LW, LH - HY); g.clip();
      const gg = g.createLinearGradient(0, HY, 0, LH); gg.addColorStop(0, L.grass[0]); gg.addColorStop(1, L.grass[1]); R(0, HY, LW, LH - HY, gg);
      const lite = new Path2D(), dark = new Path2D(), flowers = L.fl.map(() => new Path2D()), pebbles = new Path2D(), tufts = new Path2D();
      for (let iu = tr.u0; iu <= tr.u1; iu++) for (let iv = tr.v0; iv <= tr.v1; iv++){
        if (Math.abs(iv) <= 1) continue;
        const p = P(iu, iv); if (p[0] < -TW || p[0] > LW + TW || p[1] < HY - TH || p[1] > LH + TH) continue;
        const h = h2(iu, iv);
        if (h < 0.3) diamond(lite, iu, iv, 0.02); else if (h > 0.72) diamond(dark, iu, iv, 0.02);
        const d = h2(iu * 3 + 1, iv * 7 + 2);
        if (Math.abs(iv) >= 2 && d < 0.13){ const fp = P(iu + h2(iu, iv + 9) - 0.5, iv + h2(iu + 9, iv) - 0.5), fl = flowers[Math.floor(d / 0.13 * L.fl.length) % L.fl.length]; for (let k = 0; k < 3; k++){ const x = fp[0] + (k - 1) * 3.4, y = fp[1] + (k === 1 ? -1.6 : 0.6); fl.moveTo(x + 1.5, y); fl.arc(x, y, 1.5, 0, TAU); } }
        else if (d < 0.19){ const pp = P(iu + h2(iu, iv + 5) - 0.5, iv + h2(iu + 5, iv) - 0.5); pebbles.moveTo(pp[0] + 2.4, pp[1]); pebbles.ellipse(pp[0], pp[1], 2.4, 1.3, 0, 0, TAU); }
        else if (d < 0.32){ const tp = P(iu + h2(iu, iv + 3) - 0.5, iv + h2(iu + 3, iv) - 0.5); for (let k = -1; k <= 1; k++){ tufts.moveTo(tp[0] + k * 1.6, tp[1]); tufts.lineTo(tp[0] + k * 3, tp[1] - 4 - (k === 0 ? 2 : 0)); } }
      }
      g.fillStyle = 'rgba(255,255,255,.13)'; g.fill(lite); g.fillStyle = 'rgba(30,50,20,.07)'; g.fill(dark);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 0.5;
      g.stroke(lite);
      g.strokeStyle = L.blade[0]; g.lineWidth = 1; g.lineCap = 'round'; g.stroke(tufts);
      g.fillStyle = 'rgba(110,100,90,.55)'; g.fill(pebbles); g.fillStyle = 'rgba(255,255,255,.4)'; g.translate(-0.6, -0.5); g.fill(pebbles); g.translate(0.6, 0.5);
      flowers.forEach((f, i) => { g.fillStyle = L.fl[i]; g.fill(f); });
      // 길 — 흙 테두리 띠 → 줄눈 → 돌 마름모(색 네 묶음) → 윗변 빛 · 아랫변 그늘
      const band = (vA, vB, col) => { const a = P(tr.u0, vA), b = P(tr.u1, vA), c = P(tr.u1, vB), d = P(tr.u0, vB); g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); };
      band(-1.8, 1.8, se === 'winter' ? 'rgba(160,170,190,.45)' : 'rgba(140,105,60,.38)'); band(-1.55, 1.55, se === 'winter' ? '#9aa0ab' : '#9c8460');
      const STONE = se === 'winter' ? ['#d9dde6', '#cfd4de', '#e3e7ee', '#c6ccd8'] : ['#e0cfad', '#d5c19c', '#e8dabd', '#cbb690'];
      const stones = STONE.map(() => new Path2D()), hi = new Path2D(), lo = new Path2D(), moss = new Path2D();
      for (let iu = tr.u0; iu <= tr.u1; iu++) for (let iv = -1; iv <= 1; iv++){
        const h = h2(iu * 5 + 3, iv + 40); diamond(stones[Math.floor(h * 4) % 4], iu, iv, 0.05);
        const a = 0.45, l = P(iu - a, iv + a), t = P(iu - a, iv - a), r = P(iu + a, iv - a), b = P(iu + a, iv + a);
        hi.moveTo(l[0], l[1]); hi.lineTo(t[0], t[1]); hi.lineTo(r[0], r[1]); lo.moveTo(r[0], r[1]); lo.lineTo(b[0], b[1]); lo.lineTo(l[0], l[1]);
        if (h2(iu, iv + 77) < 0.18){ const m = P(iu + 0.2, iv + 0.1); moss.moveTo(m[0] + 4, m[1]); moss.ellipse(m[0], m[1], 4, 1.8, 0, 0, TAU); }
        if (h2(iu, iv + 91) < 0.15){ const c0 = P(iu - 0.2, iv - 0.1), c1 = P(iu + 0.15, iv + 0.05); lo.moveTo(c0[0], c0[1]); lo.lineTo((c0[0] + c1[0]) / 2 + 2, (c0[1] + c1[1]) / 2 - 1); lo.lineTo(c1[0], c1[1]); }
      }
      stones.forEach((p, i) => { g.fillStyle = STONE[i]; g.fill(p); });
      g.fillStyle = se === 'winter' ? 'rgba(255,255,255,.7)' : 'rgba(110,150,70,.35)'; g.fill(moss);
      g.lineWidth = 0.9; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke(hi); g.strokeStyle = 'rgba(90,65,35,.32)'; g.stroke(lo);
      // 길 가장자리 풀(겨울엔 쌓인 눈)
      const edge = new Path2D(), edge2 = new Path2D();
      for (let s = tr.u0 * 3; s <= tr.u1 * 3; s++) [-1.62, 1.62].forEach((v, j) => {
        const u = s / 3 + h2(s, j) * 0.2, p = P(u, v + (h2(s, j + 4) - 0.5) * 0.15);
        if (se === 'winter'){ const rx = 4 + h2(s, j + 2) * 3; edge.moveTo(p[0] + rx, p[1] - 1); edge.ellipse(p[0], p[1] - 1, rx, 2, 0, 0, TAU); return; }
        const t = edge, h = 4 + h2(s, j + 2) * 4; t.moveTo(p[0] - 2.5, p[1]); t.lineTo(p[0] - 2, p[1] - h * 0.7); t.lineTo(p[0] - 0.5, p[1]); t.lineTo(p[0] + 0.3, p[1] - h); t.lineTo(p[0] + 1.2, p[1]); t.lineTo(p[0] + 2.6, p[1] - h * 0.6); t.lineTo(p[0] + 3, p[1]); t.closePath();
        edge2.moveTo(p[0] + 0.3, p[1] - h); edge2.lineTo(p[0] + 0.2, p[1] - h * 0.4);
      });
      g.fillStyle = se === 'winter' ? '#f7fbff' : L.blade[0]; g.fill(edge); g.strokeStyle = L.blade[1]; g.lineWidth = 0.8; g.stroke(edge2);
      // 지평선 안개 — 먼 땅이 하늘빛으로 옅어진다
      const hz = g.createLinearGradient(0, HY, 0, HY + (compact ? 30 : 56)); hz.addColorStop(0, sky.haze + '.75)'); hz.addColorStop(1, sky.haze + '0)'); R(0, HY, LW, compact ? 30 : 56, hz);
      g.restore();
    }

    // ⑥ 나무 — 둥근 나무·바늘잎 나무·(겨울) 빈 가지. 철 빛깔. (0,0) = 밑동
    function tree(x, y, s, type, se, sway){
      const L = landOf(se);
      g.save(); g.translate(x, y); g.scale(s, s);
      if (type === 'pine'){
        R(-2.2, -12, 4.4, 12, '#7a5232'); R(0.6, -12, 1.6, 12, '#5e3d24');
        const C = se === 'autumn' ? ['#2f6b46', '#3f855a', '#7fb98a'] : se === 'spring' ? ['#3d8a55', '#55a668', '#9fd8a0'] : ['#2a6b4a', '#3a8560', '#86c89a'];
        for (let i = 0; i < 3; i++){ const w = 16 - i * 4, yb = -10 - i * 11, ht = 17; g.beginPath(); g.moveTo(-w + sway * (i + 1) * 0.3, yb); g.lineTo(sway * (i + 1) * 0.6, yb - ht); g.lineTo(w + sway * (i + 1) * 0.3, yb); g.closePath(); g.fillStyle = C[0]; g.fill(); ink(1.2);
          g.beginPath(); g.moveTo(-w * 0.85 + sway * (i + 1) * 0.3, yb - 1); g.lineTo(sway * (i + 1) * 0.6, yb - ht + 2); g.lineTo(-w * 0.15, yb - 1); g.closePath(); g.fillStyle = C[1]; g.fill();
          if (se === 'winter'){ g.beginPath(); g.moveTo(-w * 0.55 + sway * (i + 1) * 0.4, yb - ht * 0.45); g.lineTo(sway * (i + 1) * 0.6, yb - ht); g.lineTo(w * 0.5 + sway * (i + 1) * 0.4, yb - ht * 0.48); g.quadraticCurveTo(0, yb - ht * 0.3, -w * 0.55 + sway * (i + 1) * 0.4, yb - ht * 0.45); g.fillStyle = '#f6faff'; g.fill(); }
          else { circ(-w * 0.35, yb - 4, 1.2, C[2]); } }
        g.restore(); return;
      }
      // 줄기와 가지
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(-2, -20); g.lineTo(-7, -30); g.lineTo(-5, -31); g.lineTo(0, -24); g.lineTo(5, -33); g.lineTo(7, -31); g.lineTo(2, -20); g.lineTo(3, 0); g.closePath(); g.fillStyle = '#8a5a34'; g.fill(); ink(1.2);
      R(0.5, -20, 2, 20, 'rgba(60,35,15,.35)');
      if (se === 'winter' && type !== 'round2'){
        g.strokeStyle = '#7a5232'; g.lineWidth = 1.6; g.beginPath(); [[-5, -30, -12, -40], [-5, -30, -2, -42], [5, -32, 12, -42], [5, -32, 4, -45], [0, -24, 0, -38]].forEach(b => { g.moveTo(b[0], b[1]); g.lineTo(b[2] + sway, b[3]); }); g.stroke();
        g.fillStyle = '#ffffff'; [[-12, -40], [-2, -42], [12, -42], [4, -45], [0, -38]].forEach(p => { g.beginPath(); g.ellipse(p[0] + sway, p[1], 3, 1.6, 0, 0, TAU); g.fill(); });
        g.restore(); return;
      }
      const C = L.leaf[type === 'round2' ? 1 % L.leaf.length : type === 'round3' ? 2 % L.leaf.length : 0];
      const B = [[-11, -36, 11], [10, -37, 11], [0, -46, 13], [-4, -33, 10], [6, -31, 9]];
      g.beginPath(); B.forEach(b => { g.moveTo(b[0] + sway + b[2], b[1]); g.arc(b[0] + sway, b[1], b[2], 0, TAU); }); g.fillStyle = C[0]; g.fill(); ink(1.3); g.fillStyle = C[0]; g.fill();
      g.beginPath(); [[-12, -39, 8], [0, -49, 9], [8, -41, 7]].forEach(b => { g.moveTo(b[0] + sway + b[2], b[1]); g.arc(b[0] + sway, b[1], b[2], 0, TAU); }); g.fillStyle = C[1]; g.fill();
      g.beginPath(); [[-13, -42, 4], [-2, -52, 4.5], [7, -45, 3]].forEach(b => { g.moveTo(b[0] + sway + b[2], b[1]); g.arc(b[0] + sway, b[1], b[2], 0, TAU); }); g.fillStyle = C[2]; g.fill();
      if (se === 'summer' && type === 'round3') [[-8, -34], [6, -40], [2, -30]].forEach(p => circ(p[0] + sway, p[1], 2, '#ff5d5d'));   // 여름 열매
      if (se === 'winter') { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(sway, -57, 9, 3, 0, 0, TAU); g.ellipse(-12 + sway, -46, 6, 2.2, 0, 0, TAU); g.fill(); }
      g.restore();
    }
    // ⑦ 길가 소품 — 능력치가 Lv.3 이 되면 그 능력치의 물건이 길가에 서고, Lv.6 이면 커진다. (0,0) = 바닥
    // 2026-10-05 부모 요청 「트로피 같은 것들도 아이소메트릭에 맞게 다시 고화소로」 — 모두 2:1 아이소 입체로 다시 그렸다.
    // 빛은 길·나무처럼 왼쪽 위에서 온다: 윗면이 가장 밝고, 왼쪽 면(+v 쪽)이 중간, 오른쪽 면(+u 쪽)이 어둡다. 아래 도우미는 prop 안(옮긴 자리)에서만 쓴다.
    const iso = (u, v, z) => [u - v, (u + v) / 2 - (z || 0)];          // 소품 좌표(u: 오른쪽 아래, v: 왼쪽 아래, z: 위) → 화면
    function shade(c, k){ const n = parseInt(c.slice(1), 16), t = k < 0 ? 0 : 255, f = x => Math.round(x + (t - x) * Math.abs(k)); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }   // k>0 밝게 · k<0 어둡게
    function poly(pts, fill){ g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill){ g.fillStyle = fill; g.fill(); } }
    const thin = a => { g.strokeStyle = 'rgba(47,42,36,' + (a || 0.35) + ')'; g.lineWidth = 0.6; g.stroke(); };
    // 상자 — 가운데 (u, v), 반너비 a(u 쪽)·b(v 쪽), 높이 h, 바닥 높이 z
    function box(u, v, a, b, h, z, col, lw){
      const W0 = iso(u - a, v + b, z), S0 = iso(u + a, v + b, z), E0 = iso(u + a, v - b, z), W1 = iso(u - a, v + b, z + h), S1 = iso(u + a, v + b, z + h), E1 = iso(u + a, v - b, z + h), N1 = iso(u - a, v - b, z + h);
      poly([W0, S0, S1, W1], col); poly([S0, E0, E1, S1], shade(col, -0.3)); poly([N1, E1, S1, W1], shade(col, 0.22));
      g.beginPath(); g.moveTo(S0[0], S0[1]); g.lineTo(S1[0], S1[1]); g.moveTo(W1[0], W1[1]); g.lineTo(S1[0], S1[1]); g.lineTo(E1[0], E1[1]); thin();
      if (h > 1.6){ g.beginPath(); g.moveTo(W1[0] + 0.4, W1[1] + 0.7); g.lineTo(S1[0] - 0.4, S1[1] + 0.7); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.6; g.stroke(); }   // 앞 윗모서리 빛
      poly([W0, S0, E0, E1, N1, W1]); ink(lw || 1.1);
    }
    // 면에 붙여 그리기 — 'L' 왼쪽 면(x: +u, y: 아래) · 'R' 오른쪽 면(x: -v, y: 아래) · 'T' 윗면(x: +u, y: +v). (u, v, z) 가 그 면의 (0,0)
    function face(kind, u, v, z, fn){ const p = iso(u, v, z); g.save(); g.translate(p[0], p[1]); if (kind === 'L') g.transform(1, 0.5, 0, 1, 0, 0); else if (kind === 'R') g.transform(1, -0.5, 0, 1, 0, 0); else g.transform(1, 0.5, -1, 0.5, 0, 0); fn(); g.restore(); }
    // 세운 원기둥 — 왼쪽이 밝고 오른쪽이 어둡다. 윗면은 아이소 타원(세로 = 가로 ÷ 2)
    function cyl(u, v, r, h, z, col, lw){
      const p = iso(u, v, z), q = iso(u, v, z + h), gr = g.createLinearGradient(p[0] - r, 0, p[0] + r, 0);
      gr.addColorStop(0, shade(col, 0.1)); gr.addColorStop(0.3, shade(col, 0.32)); gr.addColorStop(0.62, col); gr.addColorStop(1, shade(col, -0.38));
      g.beginPath(); g.moveTo(q[0] - r, q[1]); g.lineTo(p[0] - r, p[1]); g.ellipse(p[0], p[1], r, r / 2, 0, Math.PI, 0, true); g.lineTo(q[0] + r, q[1]); g.ellipse(q[0], q[1], r, r / 2, 0, 0, Math.PI, true); g.closePath(); g.fillStyle = gr; g.fill(); ink(lw || 1);
      g.beginPath(); g.ellipse(q[0], q[1], r, r / 2, 0, 0, TAU); g.fillStyle = shade(col, 0.22); g.fill(); ink((lw || 1) * 0.7);
    }
    // 바닥 그림자 — 발밑 아이소 마름모 두 겹(빛 반대쪽인 오른쪽 아래로 조금 밀린다)
    function foot(a, b){ [[2, '.08'], [0, '.15']].forEach(s => poly([iso(-a - s[0] + 1.5, -b - s[0] + 0.5), iso(a + s[0] + 1.5, -b - s[0] + 0.5), iso(a + s[0] + 1.5, b + s[0] + 0.5), iso(-a - s[0] + 1.5, b + s[0] + 0.5)], 'rgba(40,30,20,' + s[1] + ')')); }
    // 막대 — 먹선 위에 나무색을 얹은 다리·살
    function stick(a, b, w, col){ g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = INK; g.lineWidth = w + 1.6; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = w * 0.35; g.beginPath(); g.moveTo(a[0] - w * 0.25, a[1]); g.lineTo(b[0] - w * 0.25, b[1]); g.stroke(); }
    function prop(x, y, key, big){
      g.save(); g.translate(x, y); const s = big ? 1.25 : 1; g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
      const lit = world.tod === 'night' || world.tod === 'dusk';
      if (key === 'art'){                                                 // 🎨 세 다리 이젤 · 두께 있는 캔버스 · 바닥 팔레트(큰 것은 금빛 액자 + 붓통)
        foot(11, 9);
        stick(iso(0, -9, 0), iso(0, -0.5, 34), 1.8, '#7a5232');
        stick(iso(-8.5, 2.8, 0), iso(-1.4, 1.4, 35), 2, '#8a5a34'); stick(iso(8.5, 2.8, 0), iso(1.4, 1.4, 35), 2, '#8a5a34');
        box(0, 3, 13, 1.6, 1.7, 11.5, '#8a5a34', 1);                      // 받침대
        const fr = big ? '#d9ac4a' : '#f4ead8';
        box(0, 1.2, 11, 1.1, 21, 13, fr, 1.2);                            // 캔버스(두께 2.2)
        face('L', -11, 2.3, 34, () => {                                   // 앞면 그림 — 하늘·해·언덕·나무
          const sk = g.createLinearGradient(0, 1.6, 0, 19.4); sk.addColorStop(0, '#9fd3f2'); sk.addColorStop(1, '#e6f5fb'); R(1.6, 1.6, 18.8, 17.8, sk);
          circ(15.5, 5.6, 2.6, '#ffd24d'); circ(14.8, 4.9, 1, 'rgba(255,255,255,.7)');
          g.beginPath(); g.moveTo(1.6, 13); g.quadraticCurveTo(7, 8.5, 12, 12); g.quadraticCurveTo(16, 10, 20.4, 12.5); g.lineTo(20.4, 19.4); g.lineTo(1.6, 19.4); g.closePath(); g.fillStyle = '#7cc46a'; g.fill();
          g.beginPath(); g.moveTo(1.6, 16); g.quadraticCurveTo(10, 13, 20.4, 16.5); g.lineTo(20.4, 19.4); g.lineTo(1.6, 19.4); g.closePath(); g.fillStyle = '#5aa850'; g.fill();
          R(5.6, 10.5, 1, 4, '#7a5232'); circ(6.1, 9.6, 2.8, '#3f8a3a'); circ(5.3, 8.8, 1.1, '#7cc46a');
          g.strokeStyle = 'rgba(255,127,138,.85)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(10, 17.2); g.quadraticCurveTo(13, 15.8, 16, 17.4); g.stroke();
          g.strokeStyle = 'rgba(47,42,36,.5)'; g.lineWidth = 0.5; g.strokeRect(1.6, 1.6, 18.8, 17.8);
        });
        box(0, 1.2, 2.2, 1.7, 2.6, 33, '#7a5232', 0.9);                   // 위 집게
        face('T', 0.5, 4.5, 0.4, () => {                                  // 팔레트 — 바닥에 눕힌 물감판
          g.beginPath(); g.ellipse(6, 4.5, 7, 4.6, 0, 0, TAU); g.fillStyle = '#9a6a3a'; g.fill();
          g.translate(-0.7, -0.7); g.beginPath(); g.ellipse(6, 4.5, 7, 4.6, 0, 0, TAU); g.fillStyle = '#d9a86a'; g.fill(); ink(0.8);
          circ(2.4, 5.8, 1.1, '#9a6a3a'); [[4, 2.2, '#ff7f8a'], [7, 1.8, '#ffd24d'], [9.8, 3, '#6cc7b3'], [10.2, 6, '#8ec9ee'], [7.4, 7.2, '#b9a3d6']].forEach(d => { circ(d[0], d[1], 1.2, d[2]); circ(d[0] - 0.35, d[1] - 0.35, 0.4, 'rgba(255,255,255,.75)'); });
        });
        if (big){ cyl(-9, 7, 2.6, 5, 0, '#8ec9ee', 0.9); [[-1.2, '#ff7f8a', -0.25], [0.6, '#ffd24d', 0.1], [1.6, '#6cc7b3', 0.35]].forEach(b => { const p = iso(-9, 7, 4.5); g.save(); g.translate(p[0] + b[0], p[1]); g.rotate(b[2]); R(-0.5, -7, 1, 7, '#c99a62'); circ(0, -7.6, 0.9, b[1]); g.restore(); }); }
      } else if (key === 'stage'){                                        // 🎹 업라이트 피아노 · 건반 윗면 · 의자(큰 것은 음표가 떠오른다)
        foot(13, 10);
        const V0 = -3.5, BODY = '#3b3346';
        box(0, V0, 12, 4.5, 26, 0, BODY, 1.2);                            // 몸통
        face('L', -12, V0 + 4.5, 26, () => {                              // 앞판 — 윗판·악보·아랫판
          rrect(2, 2, 20, 9, 1.2); g.fillStyle = '#4a4158'; g.fill(); thin(0.5);
          R(7.5, 3.4, 9, 6.6, '#fffaf2'); g.strokeStyle = 'rgba(47,42,36,.55)'; g.lineWidth = 0.35; g.beginPath(); for (let i = 0; i < 3; i++){ g.moveTo(8.3, 4.8 + i * 1.7); g.lineTo(15.7, 4.8 + i * 1.7); } g.stroke(); [[9.5, 5.4], [11.6, 4.6], [13.7, 6.2]].forEach(n => circ(n[0], n[1], 0.55, INK));
          R(6.8, 10, 10.4, 0.8, '#2a2433');
          rrect(2, 15.5, 20, 8.5, 1.2); g.fillStyle = '#453c52'; g.fill(); thin(0.5); R(10.5, 25, 3, 1, '#e9c25a');
        });
        box(-10.6, V0 + 8.2, 1, 1, 11, 0, BODY, 0.8); box(10.6, V0 + 8.2, 1, 1, 11, 0, BODY, 0.8);   // 건반 다리
        box(0, V0 + 7, 12, 2.5, 2.2, 11, BODY, 1);                         // 건반 선반
        face('T', -12, V0 + 4.5, 13.2, () => {                            // 건반 윗면 — 흰 건반 14개 · 검은 건반
          R(0.6, 0.5, 22.8, 4, '#fffaf2'); const kw = 22.8 / 14;
          g.strokeStyle = 'rgba(47,42,36,.45)'; g.lineWidth = 0.3; g.beginPath(); for (let i = 1; i < 14; i++){ g.moveTo(0.6 + i * kw, 0.5); g.lineTo(0.6 + i * kw, 4.5); } g.stroke();
          for (let i = 0; i < 13; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) R(0.6 + (i + 1) * kw - 0.5, 0.5, 1, 2.4, INK);
        });
        const tp = iso(-6, V0 - 2, 26); R(tp[0] - 0.5, tp[1] - 6, 1, 6, '#e9c25a'); circ(tp[0], tp[1] - 6.6, 1.4, '#fff6c4');   // 뚜껑 위 촛대
        box(0, V0 + 13.6, 6.5, 2.6, 6.5, 0, '#6b4a3a', 1);                // 의자
        box(0, V0 + 13.6, 6.5, 2.6, 1.6, 6.5, '#b9a3d6', 1);               // 방석
        if (big){ const f = (st.t * 0.7) % 1; g.globalAlpha = 1 - f; outlined('♪', 9, -38 - f * 14, '#b9a3d6', 12, 2.5); g.globalAlpha = 1; }
      } else if (key === 'write'){                                        // ✍️ 쌓인 책 — 책등·페이지 단면 · 위에 누운 연필
        foot(11, 10);
        const C = ['#ff7f8a', '#6cc7b3', '#ffd979', '#8ec9ee', '#b9a3d6'], n = big ? 5 : 3, BH = 4.4;
        let top = null;
        for (let i = 0; i < n; i++){
          const turn = i % 2, a = turn ? 6.5 : 9.5, b = turn ? 9.5 : 6.5, du = (h2(i, 7) - 0.5) * 2.4, dv = (h2(i, 8) - 0.5) * 2.4, z = i * BH, c = C[i];
          box(du, dv, a, b, BH, z, c, 1);
          const pages = (k, w) => face(k, k === 'L' ? du - a : du + a, dv + b, z + BH - 0.8, () => { R(0.6, 0, w - 1.2, BH - 1.6, '#fbf3e0'); if (k === 'R') R(0.6, 0, w - 1.2, BH - 1.6, 'rgba(60,40,20,.12)'); g.strokeStyle = 'rgba(120,100,70,.45)'; g.lineWidth = 0.25; g.beginPath(); for (let j = 1; j < 3; j++){ g.moveTo(0.8, j * (BH - 1.6) / 3); g.lineTo(w - 0.8, j * (BH - 1.6) / 3); } g.stroke(); });
          const spine = (k, w) => face(k, k === 'L' ? du - a : du + a, dv + b, z + BH, () => { R(2, 0.2, 0.9, BH - 0.4, shade(c, -0.25)); R(w - 2.9, 0.2, 0.9, BH - 0.4, shade(c, -0.25)); R(w / 2 - 2, 1.4, 4, 1.4, '#fff6c4'); });
          if (turn){ pages('L', 2 * a); spine('R', 2 * b); } else { spine('L', 2 * a); pages('R', 2 * b); }
          top = [du, dv, a, b, z + BH];
        }
        face('T', top[0] - top[2], top[1] - top[3], top[4], () => {      // 연필 — 윗책 위에 비스듬히 눕힘
          g.translate(top[2] * 0.95, top[3]); g.rotate(-0.55);
          R(-7, 0.6, 13, 2.4, 'rgba(40,30,20,.18)');
          R(-7, -1.2, 11, 2.4, '#ffd24d'); R(-7, -1.2, 11, 0.8, '#ffe68a'); R(-7, 0.6, 11, 0.6, '#e0a92a');
          g.beginPath(); g.moveTo(4, -1.2); g.lineTo(7.5, 0); g.lineTo(4, 1.2); g.closePath(); g.fillStyle = '#f3c58e'; g.fill(); g.beginPath(); g.moveTo(6.4, -0.4); g.lineTo(7.5, 0); g.lineTo(6.4, 0.4); g.fillStyle = INK; g.fill();
          R(-8.4, -1.2, 1.4, 2.4, '#c9c4bc'); R(-10, -1.2, 1.6, 2.4, '#ff9fb0');
          g.beginPath(); g.rect(-10, -1.2, 14, 2.4); g.moveTo(4, -1.2); g.lineTo(7.5, 0); g.lineTo(4, 1.2); ink(0.6);
        });
      } else if (key === 'body'){                                         // 🏃 아이소 돌 받침 + 펄럭이는 깃발(큰 것은 둘 + 결승 테이프)
        const flag = (u, v, col) => {
          box(u, v, 4, 4, 3, 0, '#c9c4bc', 1);
          cyl(u, v, 1.1, 40, 3, '#8a5a34', 0.8);
          const k = iso(u, v, 44.2); circ(k[0], k[1], 1.9, '#ffd24d'); g.beginPath(); g.arc(k[0], k[1], 1.9, 0, TAU); ink(0.7); circ(k[0] - 0.6, k[1] - 0.6, 0.6, '#fff6c4');
          face('L', u + 1.1, v, 42.5, () => {
            const w = Math.sin(st.t * 4 + u) * 1.6, w2 = Math.sin(st.t * 4 + u - 1.6) * 1.6;
            g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(5, -1 + w, 10, 1 + w2 * 0.4); g.quadraticCurveTo(14, 2.6 - w, 18, 5.5 + w2 * 0.6);
            g.quadraticCurveTo(13, 7.6 + w, 9, 9 - w2 * 0.3); g.quadraticCurveTo(4, 10.6 + w * 0.5, 0, 11); g.closePath();
            const gr = g.createLinearGradient(0, 0, 18, 0); gr.addColorStop(0, col); gr.addColorStop(0.3, shade(col, 0.28)); gr.addColorStop(0.55, shade(col, -0.16)); gr.addColorStop(0.8, shade(col, 0.18)); gr.addColorStop(1, shade(col, -0.1));
            g.fillStyle = gr; g.fill(); ink(1);
            circ(5.5, 5.4, 2.1, '#fffaf2'); g.beginPath(); g.arc(5.5, 5.4, 2.1, 0, TAU); ink(0.5); star5(5.5, 5.5, 1.4, 0); g.fillStyle = col; g.fill();
          });
        };
        foot(big ? 12 : 6, big ? 12 : 6);
        if (big){
          flag(4, -8, '#ffd24d');
          const a = iso(-6, 0, 22), b = iso(4, -8, 22), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 3];
          g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], b[0], b[1]); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = '#fffaf2'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([1.6, 1.6]); g.strokeStyle = '#ff7f8a'; g.stroke(); g.setLineDash([]);
        }
        flag(-6, 0, '#8ec9ee');
      } else if (key === 'heart'){                                        // 💗 하트 꽃덤불 — 둥근 잎 덩어리가 겹친다
        foot(13, 9);
        const B = [[2, -6, 7, 7], [-7, -2, 6, 6.5], [6, 1, 6, 6.5], [-1, 0, 7, 8], [-4, 5, 4.5, 5], [4, 6, 4.2, 4.6]].concat(big ? [[-11, 4, 3.6, 4.2], [10, 6, 3.4, 4]] : []);
        const ctr = B.map(b => { const p = iso(b[0], b[1], b[2]); return [p[0], p[1], b[3]]; });
        g.beginPath(); ctr.forEach(c => { g.moveTo(c[0] + c[2], c[1]); g.arc(c[0], c[1], c[2], 0, TAU); }); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
        ctr.forEach(c => {
          const gr = g.createRadialGradient(c[0] - c[2] * 0.4, c[1] - c[2] * 0.45, 0.5, c[0], c[1], c[2] * 1.15); gr.addColorStop(0, '#a6df82'); gr.addColorStop(0.55, '#5aa850'); gr.addColorStop(1, '#2f6b3a');
          circ(c[0], c[1], c[2], gr);
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.7; g.beginPath(); g.arc(c[0] - c[2] * 0.15, c[1] - c[2] * 0.1, c[2] * 0.6, Math.PI * 1.1, Math.PI * 1.55); g.stroke();
          g.strokeStyle = 'rgba(30,70,35,.4)'; g.beginPath(); g.arc(c[0] + c[2] * 0.1, c[1] + c[2] * 0.1, c[2] * 0.62, Math.PI * 0.05, Math.PI * 0.45); g.stroke();
        });
        const H = [[-8, -6, 3.2, '#ff5d7a'], [3, -12, 3, '#ff9fb0'], [-1, -6.5, 2.6, '#ff7f8a'], [9, -6, 2.6, '#ff5d7a'], [-4, -1, 2.2, '#ff9fb0']].concat(big ? [[-13, -3, 2.4, '#ffd24d'], [12, -1.5, 2.2, '#ff7f8a'], [5, -2, 2.4, '#ffd24d']] : []);
        H.forEach(h => { heartPath(h[0], h[1], h[2]); g.fillStyle = h[3]; g.fill(); ink(0.9); circ(h[0] - h[2] * 0.42, h[1] - h[2] * 0.42, h[2] * 0.24, 'rgba(255,255,255,.8)'); });
      } else if (key === 'grit'){                                         // 🏆 두 층 받침(이름판) · 손잡이 둘 · 반짝이는 잔
        foot(9, 9);
        box(0, 0, 8, 8, 5, 0, '#7a5232', 1.1);
        face('L', -8, 8, 5, () => { rrect(3, 1, 10, 3, 0.6); g.fillStyle = '#e9c25a'; g.fill(); ink(0.5); R(5, 2.3, 6, 0.45, 'rgba(110,70,20,.65)'); });   // 이름판
        box(0, 0, 5.5, 5.5, 4, 5, '#a97c47', 1.1);
        const M = big ? ['#fff6c4', '#ffd24d', '#c98e1c'] : ['#ffffff', '#d8d8e2', '#8e8ea4'];
        cyl(0, 0, 4, 1.4, 9, M[1], 0.9); cyl(0, 0, 1.4, 4.4, 10.4, M[1], 0.8); cyl(0, 0, 2.4, 1.1, 14, M[1], 0.8);
        const hd = (sx, col) => { g.beginPath(); g.moveTo(sx * 8.4, -25.5); g.bezierCurveTo(sx * 15, -27, sx * 15, -18, sx * 5.5, -19.4); g.strokeStyle = INK; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = col; g.lineWidth = 1.7; g.stroke(); };
        hd(-1, M[1]); hd(1, M[2]);
        g.beginPath(); g.moveTo(-9, -28); g.bezierCurveTo(-9, -20, -4, -16.4, -1.6, -15.6); g.lineTo(1.6, -15.6); g.bezierCurveTo(4, -16.4, 9, -20, 9, -28); g.ellipse(0, -28, 9, 4.5, 0, 0, Math.PI, true); g.closePath();
        const gr = g.createLinearGradient(-9, 0, 9, 0); gr.addColorStop(0, M[1]); gr.addColorStop(0.22, M[0]); gr.addColorStop(0.5, M[1]); gr.addColorStop(1, M[2]); g.fillStyle = gr; g.fill(); ink(1.2);
        g.beginPath(); g.ellipse(0, -28, 7.6, 3.5, 0, 0, TAU); const ig = g.createLinearGradient(0, -31.5, 0, -24.5); ig.addColorStop(0, M[2]); ig.addColorStop(1, M[1]); g.fillStyle = ig; g.fill(); thin(0.5);
        g.beginPath(); g.ellipse(0, -28, 9, 4.5, 0, Math.PI * 0.95, Math.PI * 1.6); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.8; g.stroke();
        star5(1.5, -21.6, 2.6, 0); g.fillStyle = M[2]; g.fill(); ink(0.5);
        g.beginPath(); g.moveTo(-6.4, -25.4); g.quadraticCurveTo(-6, -19.4, -2.8, -17.2); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5; g.stroke(); circ(-6.6, -27.6, 0.7, '#fff');
        if (big){ const a = (Math.sin(st.t * 3) + 1) / 2; g.globalAlpha = a; outlined('✦', 11, -34, '#fff6c4', 9, 2); g.globalAlpha = 1 - a; outlined('✦', -12, -30, '#fff6c4', 6, 1.6); g.globalAlpha = 1; }
      } else if (key === 'wisdom'){                                       // 📚 독서대 — 받침·기둥·비스듬한 판 위에 페이지가 휜 펼친 책
        foot(9, 9);
        box(0, 0, 7, 7, 2.5, 0, '#6b4a2e', 1.1); box(0, 0, 2, 2, 18, 2.5, '#8a5a34', 1);
        const T = (u, v, d) => iso(u, v, 23 - v * 0.45 + (d || 0));      // 판 윗면(뒤가 높다)
        const up = (p, l) => [p[0], p[1] - l];
        poly([T(-11, 6.5), T(11, 6.5), T(11, 6.5, -2), T(-11, 6.5, -2)], '#8a5a34'); poly([T(11, -6.5), T(11, 6.5), T(11, 6.5, -2), T(11, -6.5, -2)], '#5e3d24'); poly([T(-11, -6.5), T(11, -6.5), T(11, 6.5), T(-11, 6.5)], '#b07d4a');
        poly([T(-11, -6.5), T(11, -6.5), T(11, -6.5, -2), T(11, 6.5, -2), T(-11, 6.5, -2), T(-11, 6.5)]); ink(1.1);
        poly([T(-11, 6.5), T(11, 6.5), up(T(11, 6.5), 1.4), up(T(-11, 6.5), 1.4)], '#7a5232'); ink(0.8);   // 앞 턱
        poly([T(-10, -5.2, 0.3), T(10, -5.2, 0.3), T(10, 5.2, 0.3), T(-10, 5.2, 0.3)], '#3f7d4a'); ink(0.9);   // 겉표지
        const lift = t => 0.6 + 2.6 * Math.sin(Math.PI * Math.pow(t, 0.6));
        [-1, 1].forEach(sd => {
          const edge = v => { const out = []; for (let i = 0; i <= 10; i++){ const t = i / 10; out.push(up(T(sd * t * 9.4, v, 0.3), lift(t))); } return out; };
          const top = edge(-4.6), bot = edge(4.6).reverse();
          poly(top.concat(bot).map(p => [p[0] + 0.5, p[1] + 0.8]), '#d9cbb0');                     // 페이지 두께
          poly(top.concat(bot), sd < 0 ? '#fffaf0' : '#efe5d0'); ink(0.8);
          g.strokeStyle = 'rgba(47,42,36,.32)'; g.lineWidth = 0.45; g.beginPath();
          for (let k = 0; k < 5; k++){ const v = -3.4 + k * 1.7; for (let i = 2; i <= 8; i++){ const t = i / 10, p = up(T(sd * t * 9.4, v, 0.3), lift(t)); if (i === 2) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } } g.stroke();
        });
        const r0 = up(T(0.3, 4.6, 0.3), 0.6), r1 = T(0.8, 6.5, -3.5); g.beginPath(); g.moveTo(r0[0], r0[1]); g.quadraticCurveTo(r0[0] + 1, r0[1] + 3, r1[0], r1[1] + 2); g.strokeStyle = '#ff5d7a'; g.lineWidth = 1.2; g.stroke();   // 책갈피 끈
        if (big){ const o = iso(0, 0, 36), gl = g.createRadialGradient(o[0], o[1], 0.5, o[0], o[1], 8); gl.addColorStop(0, 'rgba(255,240,170,.75)'); gl.addColorStop(1, 'rgba(255,240,170,0)'); R(o[0] - 8, o[1] - 8, 16, 16, gl); circ(o[0], o[1], 2.4, '#ffe27a'); g.beginPath(); g.arc(o[0], o[1], 2.4, 0, TAU); ink(0.6); circ(o[0] - 0.8, o[1] - 0.8, 0.7, '#fff'); }
      } else if (key === 'lamp'){                                         // 가로등 — 두 층 받침·기둥·유리 등갓·지붕(밤·저녁엔 불이 켜진다)
        foot(5, 5);
        box(0, 0, 4.5, 4.5, 2.5, 0, '#4a4458', 1); box(0, 0, 3, 3, 2.5, 2.5, '#5a5468', 0.9);
        cyl(0, 0, 1.3, 38, 5, '#4a4458', 0.8); cyl(0, 0, 2, 1.2, 20, '#5a5468', 0.7);
        box(0, 0, 3.6, 3.6, 1.4, 43, '#4a4458', 0.9);
        box(0, 0, 3, 3, 8, 44.4, lit ? '#ffe9a0' : '#d8e6ec', 1);         // 유리
        if (lit){ const o = iso(0, 0, 48.4), gl = g.createRadialGradient(o[0], o[1], 0.5, o[0], o[1], 5); gl.addColorStop(0, '#fffdf0'); gl.addColorStop(1, 'rgba(255,233,160,0)'); R(o[0] - 5, o[1] - 5, 10, 10, gl); }
        else { face('L', -3, 3, 51.4, () => { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1.2, 5.5); g.lineTo(3, 1.2); g.moveTo(2.4, 6.2); g.lineTo(3.6, 3.4); g.stroke(); }); }
        [[-3, 3], [3, 3], [3, -3]].forEach(c => { const a = iso(c[0], c[1], 44.4), b = iso(c[0], c[1], 52.4); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = '#4a4458'; g.lineWidth = 1; g.stroke(); });
        const ap = iso(0, 0, 57.2), rw = iso(-4.6, 4.6, 52.4), rs = iso(4.6, 4.6, 52.4), re = iso(4.6, -4.6, 52.4);
        poly([rw, rs, ap], '#5a5468'); poly([rs, re, ap], '#3c3748'); g.beginPath(); g.moveTo(rs[0], rs[1]); g.lineTo(ap[0], ap[1]); thin(0.4); poly([rw, rs, re, ap]); ink(1);
        circ(ap[0], ap[1] - 1, 1.1, '#4a4458'); g.beginPath(); g.arc(ap[0], ap[1] - 1, 1.1, 0, TAU); ink(0.6);
      } else if (key === 'sign'){                                         // 나무 이정표 — 네모 기둥·두께 있는 화살 판자 둘·나뭇결·못
        foot(5, 5);
        box(0, 0, 1.8, 1.8, 32, 0, '#8a5a34', 1);
        const ct = iso(0, 0, 35), cw = iso(-2.4, 2.4, 32), cs = iso(2.4, 2.4, 32), ce = iso(2.4, -2.4, 32); poly([cw, cs, ct], '#9c6a3c'); poly([cs, ce, ct], '#6b4426'); poly([cw, cs, ce, ct]); ink(0.9);
        const plank = (z, dir, len, col) => face('L', -len / 2, 2.4, z, () => {
          const pts = dir > 0 ? [[0, 0], [len - 4, 0], [len, 4], [len - 4, 8], [0, 8]] : [[4, 0], [len, 0], [len, 8], [4, 8], [0, 4]];
          const shape = (o) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + o, p[1] - o) : g.moveTo(p[0] + o, p[1] - o)); g.closePath(); };
          shape(1.8); g.fillStyle = shade(col, -0.35); g.fill(); ink(1.8);
          for (let o = 1.5; o > 0; o -= 0.3){ shape(o); g.fillStyle = shade(col, -0.35); g.fill(); }
          shape(0); g.fillStyle = col; g.fill();
          g.strokeStyle = 'rgba(110,70,30,.45)'; g.lineWidth = 0.4; g.beginPath(); [1.8, 4.2, 6.4].forEach((yy, i) => { g.moveTo(dir > 0 ? 0.6 : 4.6, yy); g.bezierCurveTo(len * 0.3, yy - 0.8 + i * 0.3, len * 0.6, yy + 0.9, len - (dir > 0 ? 4.6 : 0.6), yy - 0.2); }); g.stroke();
          g.beginPath(); g.ellipse(len * 0.3, 4.6, 1.2, 0.6, 0, 0, TAU); g.stroke();
          const ax = dir > 0 ? len * 0.62 : len * 0.38; g.beginPath(); g.moveTo(ax - dir * 3.5, 4); g.lineTo(ax + dir * 2, 4); g.moveTo(ax + dir * 0.2, 2.2); g.lineTo(ax + dir * 2, 4); g.lineTo(ax + dir * 0.2, 5.8); g.strokeStyle = '#fffaf0'; g.lineWidth = 1.2; g.stroke();
          circ(len / 2 + 0.2, 2, 0.55, '#5a5148'); circ(len / 2 + 0.2, 6, 0.55, '#5a5148');
          shape(0); ink(1.1);
        });
        plank(30, 1, 22, '#c99a62'); plank(20.5, -1, 18, '#b98a55');
      } else {                                                            // 바위 둘 — 면이 있는 돌(윗면 밝게 · 오른쪽 면 어둡게) · 이끼
        foot(10, 7);
        const rock = (sil, f) => { poly(sil); g.save(); g.clip(); f.forEach(p => poly(p[0], p[1])); g.restore(); f.forEach((p, i) => { if (i){ poly(p[0]); thin(0.3); } }); poly(sil); ink(1.1); };
        rock([[-14, 1], [-13, -5], [-8, -11], [-1, -12.5], [5, -9], [8, -3], [6, 1.5], [-5, 3]],
          [[[[-15, 4], [-15, -6], [10, -14], [10, 4]], '#aaa49b'], [[[-13, -5], [-8, -11], [-1, -12.5], [5, -9], [0, -6], [-7, -5.5]], '#d6d1c8'], [[[0, -6], [5, -9], [8, -3], [6, 1.5], [-1, 1]], '#86807a'], [[[-14, 1], [-13, -5], [-7, -5.5], [-9, 1.5]], '#bab4ab']]);
        g.fillStyle = 'rgba(110,160,80,.75)'; g.beginPath(); g.ellipse(-5, -9.8, 3.4, 1.3, -0.2, 0, TAU); g.ellipse(-9.6, -8, 1.6, 0.8, -0.5, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-2, -4); g.lineTo(-3, -1.2); g.lineTo(-1.8, 1); thin(0.45);
        rock([[3, 2.5], [4, -3], [8, -6], [12, -5], [14.5, -1], [12.5, 3], [7, 4.2]],
          [[[[2, 5], [2, -7], [16, -7], [16, 5]], '#a8a29a'], [[[4, -3], [8, -6], [12, -5], [10, -2]], '#d0cbc2'], [[[10, -2], [12, -5], [14.5, -1], [12.5, 3], [8.5, 4]], '#85807a']]);
        circ(-11, 3.4, 1, '#a8a29a'); circ(16, 3.6, 0.8, '#98928a');
      }
      g.restore();
    }

    // ⑧ 공부몹 — 피·폭력 없이 귀엽게. (0,0) = 발밑(땅)
    function eyes(x, y, gap, r, seed){
      const shut = (st.t + seed * 5) % 3.3 < 0.12;
      [-1, 1].forEach(s => { if (shut){ g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + s * gap - r, y); g.lineTo(x + s * gap + r, y); g.stroke(); return; } oval(x + s * gap, y, r * 0.8, r, INK); circ(x + s * gap - r * 0.25, y - r * 0.4, r * 0.36, '#fff'); });
      [-1, 1].forEach(s => oval(x + s * (gap + r * 1.5), y + r * 1.4, r * 0.85, r * 0.5, 'rgba(255,110,140,.5)'));
    }
    function smile(x, y, w){ g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y - w * 0.5, w, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    function mobArt(m){
      const t = st.t + m.seed * 10;
      if (m.kind === 'slime'){                                            // 연필 슬라임 — 노란 몸에 연필이 꽂혀 있다
        const q = Math.sin(t * 5) * 0.07; g.scale(1 + q, 1 - q);
        g.save(); g.translate(5, -24); g.rotate(0.35); R(-3, -12, 6, 12, '#ffd24d'); R(-1, -12, 2, 12, '#f2b632'); g.beginPath(); g.moveTo(-3, -12); g.lineTo(0, -19); g.lineTo(3, -12); g.closePath(); g.fillStyle = '#f3c58e'; g.fill(); g.beginPath(); g.moveTo(-1.2, -16.2); g.lineTo(0, -19); g.lineTo(1.2, -16.2); g.fillStyle = '#4a4458'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.strokeRect(-3, -12, 6, 12); g.restore();
        g.beginPath(); g.moveTo(-21, 0); g.bezierCurveTo(-23, -17, -10, -28, 0, -28); g.bezierCurveTo(10, -28, 23, -17, 21, 0); g.closePath();
        const gr = g.createLinearGradient(0, -28, 0, 0); gr.addColorStop(0, '#ffe98f'); gr.addColorStop(1, '#f5b93a'); g.fillStyle = gr; g.fill(); ink(1.8);
        oval(-9, -19, 4, 2.4, 'rgba(255,255,255,.65)'); oval(15, -3, 3, 4, '#f5b93a');
        eyes(0, -14, 6, 2.6, m.seed); smile(0, -8, 2.6);
      } else if (m.kind === 'jelly'){                                     // 지우개 젤리 — 분홍 지우개 + 파란 띠
        g.transform(1, 0, Math.sin(t * 4.5) * 0.09, 1, 0, 0);
        rrect(-17, -31, 34, 31, 8); g.fillStyle = '#ffa3b6'; g.fill(); ink(1.8);
        g.save(); rrect(-17, -31, 34, 31, 8); g.clip(); R(-18, -15, 36, 13, '#5b8fd6'); R(-18, -15, 36, 1.5, '#8fb7ec'); g.restore();
        g.font = '800 6px ' + FONT; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('지우개', 0, -8.5);
        oval(-9, -26, 4, 2, 'rgba(255,255,255,.7)'); eyes(0, -22, 5.5, 2.4, m.seed);
      } else if (m.kind === 'bat'){                                       // 숫자 박쥐 — 배에 숫자
        const z = 26 + Math.sin(t * 3) * 4, f = Math.sin(t * 14); g.translate(0, -z);
        [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 7, -3); g.quadraticCurveTo(s * 18, -14 - f * 6, s * 27, -8 - f * 7); g.quadraticCurveTo(s * 22, -3 - f * 3, s * 20, 1); g.quadraticCurveTo(s * 15, -2, s * 13, 3); g.quadraticCurveTo(s * 10, 1, s * 7, 4); g.closePath(); g.fillStyle = '#6d4fb8'; g.fill(); ink(1.4); });
        [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 3, -9); g.lineTo(s * 8, -16); g.lineTo(s * 9, -6); g.closePath(); g.fillStyle = '#8d6ad8'; g.fill(); ink(1.2); });
        g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fillStyle = '#8d6ad8'; g.fill(); ink(1.6);
        circ(0, 4.2, 5.6, '#f1e9ff'); g.font = '800 8.5px ' + FONT; g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.mark, 0, 4.6);
        eyes(0, -4, 4, 1.9, m.seed); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-2, -0.6); g.lineTo(-1, 1.4); g.lineTo(0, -0.6); g.fill();
      } else if (m.kind === 'ghost'){                                     // 알파벳 유령
        const z = 12 + Math.sin(t * 2.2) * 4; g.translate(0, -z);
        g.beginPath(); g.moveTo(-15, -2); g.lineTo(-15, -22); g.arc(0, -22, 15, Math.PI, 0); g.lineTo(15, -2);
        for (let i = 0; i < 4; i++){ const x0 = 15 - i * 7.5, ph = Math.sin(t * 6 + i) * 1.5; g.quadraticCurveTo(x0 - 3.75, 4 + ph, x0 - 7.5, -2); }
        g.closePath(); g.fillStyle = 'rgba(255,255,255,.94)'; g.fill(); ink(1.6);
        oval(-7, -28, 3.6, 2, 'rgba(200,220,255,.8)');
        g.font = '800 13px ' + FONT; g.fillStyle = '#5b8fd6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.mark, 0, -7);
        eyes(0, -20, 5, 2.4, m.seed);
        [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * 15, -12 + Math.sin(t * 4) * s, 3.5, 2.4, s * 0.5, 0, TAU); g.fillStyle = '#fff'; g.fill(); ink(1.1); });
      } else if (m.kind === 'golem'){                                     // 받아쓰기 공책 골렘(가끔 나오는 큰 몹)
        const b = Math.abs(Math.sin(t * 2.6)) * 2; g.translate(0, -b);
        rrect(-14, -9, 10, 9, 2); g.fillStyle = '#4a4458'; g.fill(); ink(1.3); rrect(4, -9, 10, 9, 2); g.fillStyle = '#4a4458'; g.fill(); ink(1.3);
        [-1, 1].forEach(s => { g.save(); g.translate(s * 25, -36); g.rotate(-s * (0.7 + Math.sin(t * 3) * 0.15)); R(-2.5, 0, 5, 16, '#ffd24d'); g.strokeStyle = INK; g.lineWidth = 1.1; g.strokeRect(-2.5, 0, 5, 16); g.beginPath(); g.moveTo(-2.5, 16); g.lineTo(0, 21); g.lineTo(2.5, 16); g.fillStyle = '#f3c58e'; g.fill(); g.stroke(); R(-2.5, -3, 5, 3, '#ff9fb0'); g.restore(); });
        rrect(-24, -64, 48, 56, 4); g.fillStyle = '#6cc7b3'; g.fill(); ink(2);
        R(-24, -62, 7, 52, 'rgba(30,90,80,.35)'); R(18, -62, 4, 52, 'rgba(255,255,255,.25)');
        for (let i = 0; i < 7; i++){ g.beginPath(); g.arc(-24, -58 + i * 7.6, 2.6, 0, TAU); g.strokeStyle = '#d8d8e2'; g.lineWidth = 1.5; g.stroke(); }
        rrect(-14, -33, 32, 14, 2); g.fillStyle = '#fffaf2'; g.fill(); ink(1.2);
        g.font = '800 7.5px ' + FONT; g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('받아쓰기', 2, -26);
        eyes(2, -48, 7, 3.2, m.seed);
        g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-9, -55); g.lineTo(-3, -53.5); g.moveTo(13, -55); g.lineTo(7, -53.5); g.stroke();
        smile(2, -40, 3);
      }
    }
    function drawMob(m, x, y){
      const a = st.t - m.born; let s = a < 0.36 ? backOut(clamp(a / 0.36, 0, 1)) : 1, rot = 0;
      if (m.die >= 0){ const d = (st.t - m.die) / 0.25; s *= Math.max(0, 1 - d); rot = d * 1.2; }
      if (s <= 0.01) return;
      const hs = st.t - m.hitT; let dx = 0, sq = 0;
      if (hs < 0.2){ dx = Math.sin(hs * 70) * 2.5 * (1 - hs / 0.2); sq = 0.12 * (1 - hs / 0.2); }
      g.save(); g.translate(x + dx, y); g.rotate(rot); g.scale(s * (1 + sq), s * (1 - sq));
      if (m.kind === 'golem') g.scale(1.08, 1.08);
      mobArt(m);
      g.restore();
      if (hs < 0.12){ g.save(); g.globalCompositeOperation = 'lighter'; const c = MOB_Z[m.kind], gl = g.createRadialGradient(x, y - c, 2, x, y - c, 26); gl.addColorStop(0, 'rgba(255,255,255,.7)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); R(x - 28, y - c - 28, 56, 56, gl); g.restore(); }
    }
    // ⑨ 아이 — 시트에서 한 칸을 뒤집어 그린다. 발끝이 (x, y)
    // 서기 칸을 몸통·먼 다리·가까운 다리로 한 번만 잘라 둔다. 가까운 다리 = 시트에서 오른쪽(발끝이 더 아래)
    const parts = {};
    function partsOf(k, im){
      if (parts[k]) return parts[k];
      const A = ATLAS[k], cut = (pathOf) => { const c = document.createElement('canvas'); c.width = A.w; c.height = A.h; const x = c.getContext('2d'); x.beginPath(); pathOf(x); x.clip(); x.drawImage(im, 0, ROW_SW * A.h, A.w, A.h, 0, 0, A.w, A.h); return c; };
      const top = A.hip - 3;                                             // 다리 위 끝은 반바지 속으로 조금 넣어 몸통이 이음매를 덮게
      return (parts[k] = {
        body: cut(x => x.rect(0, 0, A.w, A.hip + 1)),
        far:  cut(x => { x.moveTo(0, top); x.lineTo(A.cut[0], top); x.lineTo(A.cut[1], A.h); x.lineTo(0, A.h); }),
        near: cut(x => { x.moveTo(A.cut[0], top); x.lineTo(A.w, top); x.lineTo(A.w, A.h); x.lineTo(A.cut[1], A.h); }),
      });
    }
    // 한 다리 — 엉덩이를 축으로 밀어 기울이고(도트가 덜 깨지게 회전 대신 기울이기), 앞으로 나올 때 발을 든다
    function drawLeg(P, A, leg, th){
      const len = A.foot - A.hip, sw = Math.sin(th), up = Math.max(0, Math.cos(th)) * LEG_LIFT;
      g.save(); g.translate(0, A.hip);
      g.transform(1, 0, -sw * LEG_SWING / len, 1 - up / len, 0, 0);      // 앞 = 시트의 왼쪽(뒤집기 전)
      g.drawImage(P[leg], 0, -A.hip); g.restore();
    }
    function drawKid(m, x, y){
      const A = ATLAS[m.k], im = sheet(m.k), tall = kidTall(m.k), sc = tall / A.tall;
      let frame = 0, lift = 0, th = null;
      // 네 칸 한 바퀴(ph 4) = 왼발·오른발 한 번씩
      if (!st.fight && !STILL){ const ph = st.walkT * 5 + m.phase * 4; th = ph / 4 * TAU; lift = (1 - Math.abs(Math.sin(th))) * 1.5; }
      const ha = st.t - m.hop; if (ha >= 0 && ha < 0.34){ lift += Math.sin(ha / 0.34 * Math.PI) * 8; frame = 2; th = null; }
      const pk = st.t - (st.pick[m.k] === undefined ? -9 : st.pick[m.k]); if (pk >= 0 && pk < 0.55) lift += Math.abs(Math.sin(pk / 0.55 * Math.PI * 2)) * 10 * (1 - pk / 0.55);
      spots[m.k] = { x, y, top: y - tall - lift, tall, lift };
      hits.push({ kid: m.k, x: x - tall * 0.3, y: y - tall - lift - 4, w: tall * 0.6, h: tall + 8 });
      if (!im.complete || !im.naturalWidth) return;
      g.save(); g.translate(x, y - lift); g.scale(-1, 1);
      if (th === null) g.drawImage(im, frame * A.w, ROW_SW * A.h, A.w, A.h, -A.cx * sc, -A.foot * sc, A.w * sc, A.h * sc);
      else {
        const P = partsOf(m.k, im);
        g.scale(sc, sc); g.translate(-A.cx, -A.foot);
        drawLeg(P, A, 'far', th); drawLeg(P, A, 'near', th + Math.PI); g.drawImage(P.body, 0, 0);
      }
      g.restore();
      if (m.dash && m.dash.t < m.dash.dur * 0.6){ g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i < 4; i++){ const yy = y - tall * (0.25 + i * 0.17); g.moveTo(x - tall * 0.28 - 4, yy - 2); g.lineTo(x - tall * 0.28 - 18 - i * 3, yy - 9); } g.stroke(); }
    }
    // 🐣 짝꿍 새 — 아이 뒤에서 어깨높이로 따라 난다(알은 땅에서 통통)
    function drawPet(k, x, y){
      const pet = info[k] && info[k].pet; if (!pet || !pet.rows) return;
      const d = 1.7, egg = !pet.stage, ph = st.t * (egg ? 5 : 3) + (k === 'yona' ? 2 : 0);
      const z = egg ? Math.abs(Math.sin(ph)) * 4 : kidTall(k) * 0.5 + Math.sin(ph) * 3, x0 = x - 6 * d, y0 = y - z - 12 * d;
      for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++){ const ch = pet.rows[r][11 - c]; if (ch !== '.'){ g.fillStyle = pet.pal[ch]; g.fillRect(x0 + c * d, y0 + r * d, d + 0.05, d + 0.05); } }
      if (!egg && !STILL){ const f = Math.sin(st.t * 16) > 0; g.fillStyle = pet.pal.k; g.fillRect(x0 + 3 * d, y0 + (f ? 4 : 7) * d, 2 * d, d); }
      spots['pet-' + k] = { x, top: y0 };
      hits.push({ pet: k, x: x0 - 3, y: y0 - 3, w: 12 * d + 6, h: 12 * d + 6 });
    }

    // ⑩ 공격 — 날아가는 것들
    function shotXY(s){
      const c = mobCenter(s.mob), p = clamp(s.p, 0, 1), u = s.from[0] + (c[0] - s.from[0]) * p, v = s.from[1] + (c[1] - s.from[1]) * p;
      const z = s.from[2] + (c[2] - s.from[2]) * p + Math.sin(Math.PI * p) * (s.shape === 'page' ? 10 : 22), q = P(u, v); return [q[0], q[1] - z];
    }
    function drawShot(s){
      const q = shotXY(s), sc = s.big ? 1.7 : 1, rot = s.spin + st.t * 7;
      if (s.big){ const gl = g.createRadialGradient(q[0], q[1], 1, q[0], q[1], 18); gl.addColorStop(0, 'rgba(255,250,210,.9)'); gl.addColorStop(1, 'rgba(255,250,210,0)'); R(q[0] - 18, q[1] - 18, 36, 36, gl); }
      for (let i = 1; i <= 3; i++){ const o = shotXY({ from: s.from, mob: s.mob, p: s.p - i * 0.05, shape: s.shape }); g.globalAlpha = 0.5 - i * 0.13; circ(o[0], o[1], (2.4 - i * 0.5) * sc, s.color); } g.globalAlpha = 1;
      g.save(); g.translate(q[0], q[1]); g.scale(sc, sc);
      if (s.shape === 'drop'){ g.rotate(Math.atan2(1, 1)); g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI); g.lineTo(0, -8); g.closePath(); g.fillStyle = s.color; g.fill(); ink(1.1); circ(-1.4, 0.4, 1.2, 'rgba(255,255,255,.8)'); }
      else if (s.shape === 'note'){ g.rotate(Math.sin(st.t * 10) * 0.3); const one = ox => { g.beginPath(); g.ellipse(ox, 3, 3.6, 2.6, -0.4, 0, TAU); g.fillStyle = s.color; g.fill(); ink(1.1); R(ox + 2.6, -8, 1.4, 11, INK); }; one(0); if (s.ch === 2){ one(7); R(2.6, -8.5, 8.4, 2.2, INK); } else { g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(3.3, -8); g.quadraticCurveTo(8, -5, 6, 0); g.stroke(); } }
      else if (s.shape === 'glyph'){ g.rotate(Math.sin(st.t * 8) * 0.25); g.font = '800 14px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(s.ch, 0, 0); g.fillStyle = s.color === '#ff7f8a' ? '#e8506a' : s.color; g.fillText(s.ch, 0, 0); }
      else if (s.shape === 'heart'){ g.rotate(Math.sin(st.t * 9) * 0.3); heartPath(0, 0, 5.5); g.fillStyle = '#ff5d7a'; g.fill(); ink(1.1); circ(-2, -2, 1, 'rgba(255,255,255,.8)'); }
      else if (s.shape === 'page'){ g.scale(Math.cos(st.t * 12), 1); rrect(-5, -6.5, 10, 13, 1); g.fillStyle = '#fffaf0'; g.fill(); ink(1); g.strokeStyle = 'rgba(47,42,36,.5)'; g.lineWidth = 0.7; g.beginPath(); for (let i = 0; i < 4; i++){ g.moveTo(-3, -3.5 + i * 2.6); g.lineTo(3, -3.5 + i * 2.6); } g.stroke(); }
      else { star5(0, 0, 7, rot); g.fillStyle = '#ffd24d'; g.fill(); ink(1.1); }
      g.restore();
    }
    function drawParts(){
      st.parts.forEach(p => {
        const q = P(p.u, p.v), x = q[0] + p.x, y = q[1] - p.z, f = p.age / p.life;
        if (p.kind === 'smoke'){ g.globalAlpha = 0.8 * (1 - f); circ(x, y, p.size * (0.6 + f), '#ffffff'); }
        else if (p.kind === 'dust'){ g.globalAlpha = 0.5 * (1 - f); circ(x, y, p.size * (0.7 + f), world.season === 'winter' ? '#ffffff' : 'rgba(170,140,95,1)'); }
        else if (p.kind === 'star'){ g.globalAlpha = 1 - f * f; star5(x, y, p.size, p.rot); g.fillStyle = p.color; g.fill(); g.strokeStyle = 'rgba(47,42,36,.6)'; g.lineWidth = 0.8; g.stroke(); }
        else { g.globalAlpha = 1 - f; const r = p.size * (1 - f * 0.5); g.fillStyle = p.color; g.fillRect(x - r, y - 0.5, r * 2, 1); g.fillRect(x - 0.5, y - r, 1, r * 2); g.fillStyle = '#fff'; g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
      });
      g.globalAlpha = 1;
    }
    // ⑪ 앞쪽 풀숲(빨리 흐른다) · 오른쪽 위 나뭇가지
    function foreground(se){
      const L = landOf(se), gap = 34, off = st.camU * TW * 0.62;
      for (let j = Math.floor(off / gap) - 1; j <= Math.floor((off + LW) / gap) + 1; j++){
        if (hash(j * 3 + 7) > 0.55) continue;
        const x = j * gap - off + hash(j) * 12, hgt = 14 + hash(j * 5) * 16, sw = Math.sin(st.t * 1.6 + j) * 2;
        if (se === 'winter'){ oval(x, LH + 2, 18 + hgt * 0.5, hgt * 0.55, '#e8f0f8'); oval(x - 4, LH - hgt * 0.3, 10, 4, '#ffffff'); continue; }
        g.fillStyle = L.fg; g.beginPath();
        for (let b = -3; b <= 3; b++){ const bx = x + b * 3.4, bh = hgt * (1 - Math.abs(b) * 0.12) * (0.8 + hash(j * 11 + b) * 0.4); g.moveTo(bx - 2.6, LH + 1); g.quadraticCurveTo(bx + sw * 0.5, LH - bh * 0.5, bx + b * 2 + sw, LH - bh); g.quadraticCurveTo(bx + sw * 0.3, LH - bh * 0.4, bx + 2.6, LH + 1); }
        g.fill();
        if (hash(j * 13) < 0.35){ circ(x + 4 + sw, LH - hgt - 1, 2.6, L.fl[j & 3]); circ(x + 4 + sw, LH - hgt - 1, 1, '#fff3a0'); }
      }
      if (compact) return;
      const sw = Math.sin(st.t * 0.9) * 2, C = L.leaf[0];                // 화면 오른쪽 위로 들어온 나뭇가지
      g.strokeStyle = '#5e3d24'; g.lineWidth = 4; g.beginPath(); g.moveTo(LW + 4, 6); g.quadraticCurveTo(LW - 34, 12 + sw, LW - 70, 6 + sw); g.stroke();
      if (se === 'winter'){ g.fillStyle = '#fff'; g.beginPath(); g.ellipse(LW - 40, 9 + sw, 16, 3, -0.1, 0, TAU); g.fill(); return; }
      [[-12, 6, 13], [-30, 14, 12], [-46, 9, 11], [-62, 13, 9], [-22, -2, 12], [-56, 2, 9]].forEach((b, i) => { oval(LW + b[0], b[1] + sw * (1 + i * 0.1), b[2], b[2] * 0.62, i % 2 ? C[0] : C[1]); });
      [[-18, 8, 4], [-40, 6, 3.5], [-58, 10, 3]].forEach(b => oval(LW + b[0], b[1] + sw, b[2], b[2] * 0.6, C[2]));
    }
    function drawWeather(){
      st.weather.forEach(w => {
        const x = w.x, y = w.y, s = w.s;
        if (w.kind === 'snow'){ circ(x, y, 1.3 * s + 0.4, 'rgba(255,255,255,.9)'); }
        else if (w.kind === 'petal'){ g.save(); g.translate(x, y); g.rotate(w.ph * 2); oval(0, 0, 2.6 * s, 1.5 * s, '#ffc4d6'); g.restore(); }
        else if (w.kind === 'leaf'){ g.save(); g.translate(x, y); g.rotate(w.ph * 1.6); g.scale(Math.cos(w.ph * 2.2), 1); g.beginPath(); g.moveTo(-4 * s, 0); g.quadraticCurveTo(0, -3 * s, 4 * s, 0); g.quadraticCurveTo(0, 3 * s, -4 * s, 0); g.fillStyle = s > 1 ? '#e5683f' : '#ee9a40'; g.fill(); g.restore(); }
        else if (w.kind === 'fly'){ if (y < HY) return; const a = 0.5 + 0.5 * Math.sin(w.ph * 3); g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y, 0, x, y, 7); gl.addColorStop(0, 'rgba(255,240,140,' + (0.8 * a).toFixed(2) + ')'); gl.addColorStop(1, 'rgba(255,240,140,0)'); R(x - 7, y - 7, 14, 14, gl); g.restore(); }
        else { if (y < HY - 20) return; g.globalAlpha = 0.35 + 0.3 * Math.sin(w.ph * 2); circ(x, y, 0.9 * s, '#fffbe0'); g.globalAlpha = 1; }
      });
    }
    function lightRays(sky){
      const s = sunPos(), base = Math.atan2(LH - s[1], LW * 0.5 - s[0]);
      g.save(); g.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++){
        const a = base + (i - 2) * 0.13 + Math.sin(st.t * 0.25 + i) * 0.02, w = 0.035 + hash(i) * 0.03, len = LW * 1.1, al = 0.07 + 0.05 * Math.sin(st.t * 0.4 + i * 1.7);
        const gr = g.createLinearGradient(s[0], s[1], s[0] + Math.cos(a) * len, s[1] + Math.sin(a) * len); gr.addColorStop(0, 'rgba(255,240,200,' + al.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[0] + Math.cos(a - w) * len, s[1] + Math.sin(a - w) * len); g.lineTo(s[0] + Math.cos(a + w) * len, s[1] + Math.sin(a + w) * len); g.closePath(); g.fill();
      }
      g.restore();
      if (sky.tint){ g.fillStyle = sky.tint; g.fillRect(0, 0, LW, LH); }
    }

    // ⑫ 글자 — 이름표 · HP 칸 · +XP · 말풍선 · 띠
    let tagBoxes = [];
    function nameTag(k){
      const sp = spots[k]; if (!sp) return;
      const I = info[k] || {}, text = (I.label || NAME[k]) + (I.badge ? ' ' + I.badge : '') + (I.streak > 0 ? ' 🔥' + I.streak : '');
      g.font = '800 10px ' + FONT; const w = Math.ceil(g.measureText(text).width) + 12, x = Math.round(sp.x - w / 2);
      let y = Math.round(sp.top - 19);
      while (tagBoxes.some(b => x < b[0] + b[2] + 3 && b[0] < x + w + 3 && y < b[1] + 20 && b[1] < y + 20)) y -= 4;   // 두 아이가 붙어 걸으면 뒤 아이 이름표를 위로 비킨다
      tagBoxes.push([x, y, w]);
      rrect(x + 1, y + 1.5, w, 14, 7); g.fillStyle = 'rgba(30,20,10,.25)'; g.fill();
      rrect(x, y, w, 14, 7); g.fillStyle = COLOR[k] || '#fff'; g.fill(); ink(k === sel ? 2 : 1.3); if (k === sel){ g.strokeStyle = '#ffd24d'; g.lineWidth = 1; rrect(x - 1.5, y - 1.5, w + 3, 17, 8.5); g.stroke(); }
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + 7.5);
      if (k === sel && kids.length > 1){ g.beginPath(); g.moveTo(sp.x - 3.5, y + 15.5); g.lineTo(sp.x + 3.5, y + 15.5); g.lineTo(sp.x, y + 19.5); g.closePath(); g.fillStyle = '#ffd24d'; g.fill(); ink(1); }
    }
    function hpBar(m){
      if (m.hp <= 0 || st.t - m.born < 0.3) return;
      const q = P(m.u, m.v), top = q[1] - MOB_TOP[m.kind] - 9, cw = m.max > 5 ? 4 : 5, w = m.max * (cw + 1) + 1, x = Math.round(q[0] - w / 2), y = Math.round(top);
      R(x - 1, y - 1, w + 2, 7, INK); for (let i = 0; i < m.max; i++) R(x + 1 + i * (cw + 1), y + 1, cw, 3, i < m.hp ? (m.hp / m.max > 0.4 ? '#7fd36e' : '#ff8f6b') : '#5a5148');
    }
    function drawTexts(){
      st.texts.forEach(x => { const q = P(x.u, x.v), f = x.age / 1.5, s = x.age < 0.2 ? backOut(x.age / 0.2) : 1; g.save(); g.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1; g.translate(q[0], q[1] - x.z - f * 26); g.scale(s, s); outlined(x.text, 0, 0, '#ffe27a', 13, 3.2); g.restore(); });
    }
    function wrapLines(text, maxW){ const out = []; let line = ''; String(text).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
    function bubble(cx, tipY, text){
      g.font = '700 10px ' + FONT; const lines = wrapLines(text, Math.min(170, LW * 0.6)), w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + 16, h = lines.length * 13 + 10;
      const x = clamp(Math.round(cx - w / 2), 4, LW - w - 4), y = Math.max(4, tipY - h - 7);
      rrect(x, y, w, h, 6); g.fillStyle = '#fff'; g.fill(); ink(1.5);
      g.beginPath(); g.moveTo(cx - 4, y + h - 0.5); g.lineTo(cx, y + h + 6); g.lineTo(cx + 4, y + h - 0.5); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 4, y + h); g.lineTo(cx, y + h + 6); g.lineTo(cx + 4, y + h); g.stroke();
      g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'top'; lines.forEach((l, i) => g.fillText(l, x + 8, y + 6 + i * 13));
    }
    function drawOverlay(){
      if (world.note){ g.font = '800 10px ' + FONT; const w = Math.ceil(g.measureText(world.note).width) + 14, y = LH - 26; rrect(6, y, w, 19, 9.5); g.fillStyle = 'rgba(255,255,255,.92)'; g.fill(); ink(1.4); g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(world.note, 13, y + 10); }
      const o = opts.overlay && opts.overlay(); if (!o) return;
      if (o.stamp){ g.font = '800 12px ' + FONT; const w = Math.ceil(g.measureText(o.stamp).width) + 18; rrect(8, 8, w, 22, 5); g.fillStyle = '#ffd979'; g.fill(); ink(1.6); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.stamp, 8 + w / 2, 19.5); }
      if (o.bubble && o.bubble.text){ const sp = spots[(o.bubble.pet ? 'pet-' : '') + o.bubble.k]; if (sp) bubble(sp.x, sp.top - (o.bubble.pet ? 2 : 22), o.bubble.text); }
      if (o.banner){
        g.font = '800 11.5px ' + FONT; const w = Math.min(LW - 16, Math.ceil(g.measureText(o.banner).width) + 22), x = Math.round(LW / 2 - w / 2), y = o.stamp ? 36 : 10;
        rrect(x, y, w, 23, 11.5); g.fillStyle = '#ffd979'; g.fill(); ink(1.8); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.banner, LW / 2, y + 12, w - 14);
        for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + st.t * 1.5, sx = LW / 2 + Math.cos(a) * (w / 2 + 10), sy = y + 11 + Math.sin(a) * 18; star5(sx, sy, 3, st.t * 3 + i); g.fillStyle = ['#ffd24d', '#ff7f8a', '#6cc7b3', '#fff'][i % 4]; g.fill(); }
      }
    }

    function render(){
      const sky = SKY[world.tod], se = world.season, night = world.tod === 'night';
      hits = []; spots = {}; lamps = [];
      g.setTransform(DPR * K, 0, 0, DPR * K, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      drawSky(sky); drawSun(sky);
      if (!compact) clouds(0.02, 3, 4, HY * 0.16, 0.55, 3, sky);
      drawMountains(sky, se);
      clouds(0.05, 6, compact ? 3 : 4, HY * (compact ? 0.18 : 0.42), compact ? 0.6 : 0.8, 9, sky);
      drawHills(sky, se);
      const tr = tileRange();
      drawGround(sky, se, tr);
      // 깊이 순 그림 — 나무·소품·아이·짝꿍·몹
      const list = [], rows = compact ? [[-3.1, 0.6, 2.4], [3.3, 0.3, 1.5]] : [[-3.1, 0.62, 2.2], [-6.4, 0.55, 3.2], [-10.5, 0.5, 3], [3.5, 0.4, 1.6], [6.6, 0.6, 3]];
      for (let iu = tr.u0 - 2; iu <= tr.u1 + 2; iu++){
        rows.forEach((r, ri) => {
          if (h2(iu, ri + 11) >= r[1] * (world.region === 'sea' ? 0.35 : world.region === 'castle' ? 0.55 : 1)) return;
          const u = iu + h2(iu, ri + 21) * 0.8, v = r[0] + Math.sign(r[0]) * h2(iu, ri + 31) * r[2], p = P(u, v);
          if (p[1] < HY + 2 || p[1] > LH + 70 || p[0] < -50 || p[0] > LW + 50) return;
          const th = h2(iu, ri + 41), type = th < 0.3 ? 'pine' : th < 0.6 ? 'round' : th < 0.82 ? 'round2' : 'round3', s = (0.78 + h2(iu, ri + 51) * 0.45) * clamp((p[1] - HY) / 60 + 0.55, 0.55, 1);
          list.push({ d: u + v, x: p[0], y: p[1], sh: 13 * s, draw: () => tree(p[0], p[1], s, type, se, Math.sin(st.t * 1.1 + iu) * 0.8) });
        });
        const lamp = !compact && ((iu % 7) + 7) % 7 === 0, ph = h2(iu, 50);
        if (lamp){ const p = P(iu + 0.3, -1.95); if (p[1] < HY + 4) continue; lamps.push(p); list.push({ d: iu + 0.3 - 1.95, x: p[0], y: p[1], sh: 4, draw: () => prop(p[0], p[1], 'lamp', false) }); continue; }
        if (ph < (world.keys.length ? 0.34 : 0.16)){
          const v = h2(iu, 51) < 0.5 ? -2.2 : 2.3, u = iu + h2(iu, 53) * 0.4, p = P(u, v);
          if (p[1] < HY + 4) continue;
          const key = world.keys.length ? world.keys[Math.floor(h2(iu, 52) * world.keys.length)] : h2(iu, 52) < 0.5 ? 'sign' : 'rock';
          list.push({ d: u + v, x: p[0], y: p[1], sh: 10, draw: () => prop(p[0], p[1], key, (world.lv[key] || 0) >= PROP_BIG) });
        }
      }
      team.forEach(m => { const p = kidPos(m), q = P(p[0], p[1]); list.push({ d: p[0] + p[1], x: q[0], y: q[1], sh: 14, kid: m, draw: () => drawKid(m, q[0], q[1]) });
        if (info[m.k] && info[m.k].pet){ const pp = P(p[0] - 0.95, p[1] + 0.32); list.push({ d: p[0] + p[1] - 0.63, x: pp[0], y: pp[1], sh: info[m.k].pet.stage ? 0 : 6, draw: () => drawPet(m.k, pp[0], pp[1]) }); } });
      st.mobs.forEach(m => { const q = P(m.u, m.v); list.push({ d: m.u + m.v, x: q[0], y: q[1], sh: m.die >= 0 ? 0 : MOB_W[m.kind] * (m.kind === 'bat' || m.kind === 'ghost' ? 0.6 : 1), draw: () => drawMob(m, q[0], q[1]) }); });
      list.sort((a, b) => a.d - b.d);
      // 그림자 한 겹 — 고른 아이는 발밑에 빛 고리
      g.fillStyle = 'rgba(40,30,20,.2)'; g.beginPath(); list.forEach(it => { if (it.sh > 0){ g.moveTo(it.x + it.sh, it.y); g.ellipse(it.x, it.y, it.sh, it.sh * 0.36, 0, 0, TAU); } }); g.fill();
      list.forEach(it => {
        if (!it.kid || it.kid.k !== sel || kids.length < 2 && !compact) return;
        const pu = 1 + Math.sin(st.t * 3) * 0.06, rx = 22 * pu, ry = 8 * pu;
        g.save(); g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(it.x, it.y, 2, it.x, it.y, rx * 1.4); gl.addColorStop(0, 'rgba(255,220,120,.45)'); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; g.beginPath(); g.ellipse(it.x, it.y, rx * 1.4, ry * 1.4, 0, 0, TAU); g.fill(); g.restore();
        g.strokeStyle = 'rgba(255,210,77,.95)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(it.x, it.y, rx, ry, 0, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(it.x, it.y, rx - 2.5, ry - 1.2, 0, 0, TAU); g.stroke();
      });
      list.forEach(it => it.draw());
      st.shots.forEach(drawShot); drawParts();
      foreground(se);
      if (night){
        g.fillStyle = sky.tint; g.fillRect(0, 0, LW, LH);
        g.save(); g.globalCompositeOperation = 'lighter';
        lamps.forEach(p => { const gl = g.createRadialGradient(p[0], p[1] - 48, 2, p[0], p[1] - 48, 46); gl.addColorStop(0, 'rgba(255,220,140,.4)'); gl.addColorStop(1, 'rgba(255,220,140,0)'); R(p[0] - 48, p[1] - 96, 96, 96, gl); const gp = g.createRadialGradient(p[0], p[1], 2, p[0], p[1], 40); gp.addColorStop(0, 'rgba(255,210,130,.25)'); gp.addColorStop(1, 'rgba(255,210,130,0)'); g.fillStyle = gp; g.beginPath(); g.ellipse(p[0], p[1], 40, 16, 0, 0, TAU); g.fill(); });
        Object.keys(spots).forEach(k => { const sp = spots[k]; if (!sp.tall) return; const gl = g.createRadialGradient(sp.x, sp.y - sp.tall * 0.5, 4, sp.x, sp.y - sp.tall * 0.5, sp.tall * 0.8); gl.addColorStop(0, 'rgba(255,230,180,.16)'); gl.addColorStop(1, 'rgba(255,230,180,0)'); R(sp.x - sp.tall, sp.y - sp.tall * 1.3, sp.tall * 2, sp.tall * 1.6, gl); });
        g.restore();
      }
      drawWeather();
      if (!night && !compact) lightRays(sky); else if (!night && sky.tint){ g.fillStyle = sky.tint; g.fillRect(0, 0, LW, LH); }
      const vg = g.createRadialGradient(LW / 2, LH * 0.55, LH * 0.45, LW / 2, LH * 0.55, Math.max(LW, LH) * 0.78); vg.addColorStop(0, 'rgba(30,20,40,0)'); vg.addColorStop(1, 'rgba(30,20,40,.3)'); R(0, 0, LW, LH, vg);
      st.mobs.forEach(hpBar); drawTexts();
      tagBoxes = []; [sel].concat(kids.filter(k => k !== sel)).forEach(nameTag);   // 고른 아이 이름표가 제자리
      drawOverlay();
    }

    // ---------- 돌리기 — 화면 밖·탭 숨김이면 멈춘다. 움직임 줄이기면 한 장만 ----------
    const running = () => !STILL && visible && !document.hidden && !dead;
    function frame(now){
      raf = 0; if (dead) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      update(dt);
      if (dirty || now - lastDraw >= 28){ render(); lastDraw = now; dirty = false; }   // 30fps 남짓 — 천천히 걷는 장면이라 이걸로 넉넉하다
      schedule();
    }
    function schedule(){ if (!raf && running()) raf = requestAnimationFrame(frame); }
    function paint(){ if (running()){ dirty = true; schedule(); } else if (!dead) render(); }
    const onVis = () => { last = 0; if (running()) schedule(); else paint(); };
    function onTap(e){
      const rc = cv.getBoundingClientRect(); if (!rc.width || !opts.onTap) return;
      const x = (e.clientX - rc.left) / K, y = (e.clientY - rc.top) / K;
      const hit = hits.slice().reverse().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
      if (hit) return opts.onTap(hit.pet ? { pet: hit.pet } : { kid: hit.kid });
      const near = Object.keys(spots).filter(k => spots[k].tall).sort((a, b) => Math.abs(spots[a].x - x) - Math.abs(spots[b].x - x))[0];   // 빈 곳은 가까운 아이
      if (near) opts.onTap({ kid: near });
    }
    cv.addEventListener('click', onTap);
    document.addEventListener('visibilitychange', onVis);
    const ro = window.ResizeObserver ? new ResizeObserver(() => { layout(); paint(); }) : null; if (ro) ro.observe(cv);
    const io = window.IntersectionObserver ? new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; onVis(); }) : null; if (io) io.observe(cv);
    if (!ro) window.addEventListener('resize', layout);
    kids.forEach(k => { const im = sheet(k); if (!im.complete) im.addEventListener('load', paint, { once: true }); });

    layout(); refreshInfo();
    if (STILL){ st.fight = true; spawn(2.5, 'slime'); st.mobs[0].born = -9; st.parts = []; }   // 정지 한 장 — 나타날 때의 연기는 뺀다 else spawn(4.4, 'slime');
    paint();

    return {
      setSel(k){ if (!kids.includes(k) || k === sel) return; sel = k; st.pick[k] = st.t; paint(); },
      burst(k, text){                                                    // 「했어요」 같은 순간 — 그 아이가 몹 하나를 바로 물리치고 글자를 띄운다
        const m = team.find(x => x.k === k) || team[0]; if (!m) return;
        if (STILL){ const p = kidPos(m); st.texts.push({ u: p[0], v: p[1], z: kidTall(m.k) + 26, text: text || '+XP', age: 0.3 }); render(); setTimeout(() => { st.texts = []; paint(); }, 1600); return; }
        let mob = liveMob();
        if (mob && mob.u - st.camU > 4.2){ mob.hp = 0; mob.die = st.t; puff(mob.u, mob.v, 6, 10); mob = null; }
        if (!mob){ st.mobs = st.mobs.filter(x => x.hp > 0); mob = spawn(2.4, 'slime'); }
        attack(m, true, text || '+XP'); paint();
      },
      refresh(){ refreshInfo(); paint(); },
      destroy(){ dead = true; if (raf) cancelAnimationFrame(raf); cv.removeEventListener('click', onTap); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); else window.removeEventListener('resize', layout); if (io) io.disconnect(); },
    };
  }

  window.HEROWALK = { mount };
})();
