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
    const world = { lv: {}, keys: [], season: 'autumn', tod: 'day', hour: 12 };
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
      const d = new Date(); world.hour = d.getHours() + d.getMinutes() / 60; world.tod = todOf(world.hour);
    }
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
      if (!compact) ridge(st.camU * TW * 0.03, HY - 2, HY * 0.5, 0.011, 1.3, sky.far, se === 'winter' ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.4)');
      ridge(st.camU * TW * 0.07, HY + 2, HY * (compact ? 0.42 : 0.32), 0.019, 4.1, sky.mid2, se === 'winter' ? 'rgba(255,255,255,.8)' : null);
    }
    // ④ 언덕 — 철 빛깔 + 능선 위 작은 나무 실루엣
    function drawHills(sky, se){
      const L = LAND[se], off = st.camU * TW * 0.15, base = HY + 3, amp = compact ? 10 : 15;
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
      const L = LAND[se];
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
      const L = LAND[se];
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
    function prop(x, y, key, big){
      g.save(); g.translate(x, y); const s = big ? 1.25 : 1; g.scale(s, s);
      if (key === 'art'){                                                 // 🎨 이젤과 그림
        g.strokeStyle = '#7a5232'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-2, -34); g.moveTo(9, 0); g.lineTo(2, -34); g.moveTo(0, -30); g.lineTo(5, 1); g.stroke();
        rrect(-12, -32, 24, 19, 1.5); g.fillStyle = big ? '#c9a24a' : '#fffaf0'; g.fill(); ink(1.4); R(-9.5, -29.5, 19, 14, '#bfe4f7'); R(-9.5, -21, 19, 5.5, '#7cc46a'); circ(5, -25, 2.6, '#ffd24d'); circ(-4, -22, 3.2, '#3f8a3a');
        R(-13, -13, 26, 2.2, '#8a5a34'); if (big){ circ(-14, -4, 3, '#ff7f8a'); circ(-10, -2, 2.4, '#6cc7b3'); circ(-13, 0, 2, '#ffd24d'); }
      } else if (key === 'stage'){                                        // 🎹 길가 피아노(큰 것은 음표가 떠오른다)
        rrect(-15, -27, 30, 22, 2); g.fillStyle = '#3b3346'; g.fill(); ink(1.4); R(-13, -12, 26, 5, '#fffaf2'); for (let i = 0; i < 6; i++) R(-11 + i * 4.4, -12, 1.6, 3, INK);
        R(-14, -5, 3, 5, '#3b3346'); R(11, -5, 3, 5, '#3b3346'); R(-12, -25, 24, 2, 'rgba(255,255,255,.18)');
        if (big){ const f = (st.t * 0.7) % 1; g.globalAlpha = 1 - f; outlined('♪', 8, -32 - f * 14, '#b9a3d6', 11, 2.5); g.globalAlpha = 1; }
      } else if (key === 'write'){                                        // ✍️ 책 더미와 연필
        const C = ['#ff7f8a', '#6cc7b3', '#ffd979', '#8ec9ee', '#b9a3d6'], n = big ? 5 : 3;
        for (let i = 0; i < n; i++){ rrect(-11 + (i % 2) * 2, -6 - i * 6, 22, 6, 1); g.fillStyle = C[i]; g.fill(); ink(1.1); R(-8 + (i % 2) * 2, -4.5 - i * 6, 16, 1, 'rgba(255,255,255,.7)'); }
        g.save(); g.translate(6, -6 - n * 6); g.rotate(-0.6); R(-1.5, -12, 3, 12, '#ffd24d'); g.beginPath(); g.moveTo(-1.5, -12); g.lineTo(0, -16); g.lineTo(1.5, -12); g.fillStyle = '#f3c58e'; g.fill(); R(-1.5, 0, 3, 2, '#ff9fb0'); g.restore();
      } else if (key === 'body'){                                         // 🏃 깃발(큰 것은 결승선 깃발 둘)
        const flag = (fx, col) => { R(fx - 1, -40, 2, 40, '#8a5a34'); const w = Math.sin(st.t * 4 + fx) * 2; g.beginPath(); g.moveTo(fx + 1, -40); g.quadraticCurveTo(fx + 8, -42 + w, fx + 16, -37 + w); g.quadraticCurveTo(fx + 8, -33 + w, fx + 1, -31); g.closePath(); g.fillStyle = col; g.fill(); ink(1.1); };
        flag(-4, '#8ec9ee'); if (big) flag(8, '#ffd24d');
      } else if (key === 'heart'){                                        // 💗 하트 꽃덤불
        oval(0, -7, 13, 8, '#4f9a4a'); oval(-3, -9, 8, 5, '#6cbb5c');
        [[-6, -11, 3.4, '#ff5d7a'], [5, -12, 3, '#ff9fb0'], [0, -6, 2.6, '#ff7f8a']].concat(big ? [[-9, -4, 2.6, '#ffd24d'], [9, -5, 2.6, '#ff5d7a']] : []).forEach(h => { heartPath(h[0], h[1], h[2]); g.fillStyle = h[3]; g.fill(); ink(0.9); });
      } else if (key === 'grit'){                                         // 🏆 받침 위 트로피
        rrect(-9, -10, 18, 10, 1.5); g.fillStyle = '#a97c47'; g.fill(); ink(1.2);
        const c = big ? '#ffd24d' : '#d8d8e2'; g.beginPath(); g.moveTo(-8, -28); g.lineTo(8, -28); g.quadraticCurveTo(7, -17, 0, -16); g.quadraticCurveTo(-7, -17, -8, -28); g.closePath(); g.fillStyle = c; g.fill(); ink(1.2);
        R(-1.5, -16, 3, 4, c); R(-5, -12, 10, 2.2, c); g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.arc(-8, -24, 3.5, Math.PI * 0.5, Math.PI * 1.5); g.arc(8, -24, 3.5, -Math.PI * 0.5, Math.PI * 0.5); g.stroke(); R(-5, -26, 2, 6, 'rgba(255,255,255,.7)');
        if (big){ const a = (Math.sin(st.t * 3) + 1) / 2; g.globalAlpha = a; outlined('✦', 10, -32, '#fff6c4', 9, 2); g.globalAlpha = 1; }
      } else if (key === 'wisdom'){                                       // 📚 펼친 책을 얹은 독서대
        R(-1.5, -18, 3, 18, '#7a5232'); R(-7, -1, 14, 2, '#7a5232');
        g.beginPath(); g.moveTo(-13, -22); g.lineTo(0, -19); g.lineTo(13, -22); g.lineTo(13, -30); g.lineTo(0, -27); g.lineTo(-13, -30); g.closePath(); g.fillStyle = '#fffaf0'; g.fill(); ink(1.2);
        g.strokeStyle = 'rgba(47,42,36,.4)'; g.lineWidth = 0.7; g.beginPath(); for (let i = 0; i < 3; i++){ g.moveTo(-11, -27 + i * 2); g.lineTo(-2, -25 + i * 2); g.moveTo(2, -25 + i * 2); g.lineTo(11, -27 + i * 2); } g.stroke();
        if (big) circ(0, -34, 2.4, '#ffe27a');
      } else if (key === 'lamp'){                                         // 가로등(밤엔 불빛이 번진다)
        R(-1.5, -44, 3, 44, '#4a4458'); R(-4, -2, 8, 2, '#4a4458'); rrect(-5, -52, 10, 9, 2); g.fillStyle = world.tod === 'night' || world.tod === 'dusk' ? '#ffe9a0' : '#e9e4d4'; g.fill(); ink(1.2); R(-6, -54, 12, 2.5, '#4a4458');
      } else if (key === 'sign'){                                         // 나무 이정표
        R(-1.5, -30, 3, 30, '#8a5a34'); g.beginPath(); g.moveTo(-12, -30); g.lineTo(9, -30); g.lineTo(14, -26); g.lineTo(9, -22); g.lineTo(-12, -22); g.closePath(); g.fillStyle = '#c99a62'; g.fill(); ink(1.2); outlined('→', -1, -26, '#fffaf0', 7, 2);
      } else {                                                            // 바위 둘
        oval(-3, -4, 9, 6, '#a8a29a'); oval(-5, -6, 5, 3, '#c9c4bc'); oval(7, -3, 6, 4, '#98928a'); g.beginPath(); g.ellipse(-3, -4, 9, 6, 0, 0, TAU); ink(1.1);
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
      const L = LAND[se], gap = 34, off = st.camU * TW * 0.62;
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
          if (h2(iu, ri + 11) >= r[1]) return;
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
