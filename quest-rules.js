// 수아연아 모험단의 규칙 — 숫자와 표만 있고 화면은 없다.
// 화면(quest.html)과 떼어 둔 이유: 노드에서 이 파일만 읽어 수백 판을 돌려 보고
// 「몇 레벨이면 어느 무대를 깰 수 있나」를 재기 위해서다. 균형은 감이 아니라 측정으로 맞춘다.
const QUEST = (() => {

  // ---------- 속성 ----------
  // 불 > 풀 > 물 > 불 로 돌고, 빛과 어둠은 서로에게 강하다.
  // 아이가 외울 것이 다섯을 넘으면 안 된다 — 가위바위보 하나에 짝 하나가 전부다.
  const ELEM = {
    none:  { name: '보통', icon: '⚪', c: '#a2988a' },
    fire:  { name: '불',   icon: '🔥', c: '#ff8a5c' },
    water: { name: '물',   icon: '💧', c: '#5aa9e6' },
    grass: { name: '풀',   icon: '🌿', c: '#6fb567' },
    light: { name: '빛',   icon: '✨', c: '#ffd979' },
    dark:  { name: '어둠', icon: '🌑', c: '#9b8ec4' },
  };
  const STRONG = { fire: 'grass', grass: 'water', water: 'fire', light: 'dark', dark: 'light' };
  function elemMult(a, d){
    if (!a || a === 'none' || !d || d === 'none') return 1;
    if (STRONG[a] === d) return 1.5;
    if (STRONG[d] === a) return 0.7;
    return 1;
  }
  function elemSay(a, d){
    const m = elemMult(a, d);
    return m > 1 ? '강해요!' : m < 1 ? '약해요' : '';
  }

  // ---------- 모험가 ----------
  // 표의 열쇠(author_key)가 sua/yona 라서 그대로 쓴다.
  // 기술은 레벨이 오르면 하나씩 는다 — 레벨업이 숫자만 오르는 것이 아니라 손이 늘어야 한다.
  const HEROES = {
    sua: {
      name: '수아', sprite: 'sua', color: '#ff7f8a', other: 'yona', call: '동생',
      streakSfx: 'fanfare',
      skills: [
        { id: 'beam',  name: '하트 빔',   elem: 'light', lv: 1, cost: 3, mult: 1.8, sfx: 'sparkle' },
        { id: 'flame', name: '불꽃 하트', elem: 'fire',  lv: 4, cost: 3, mult: 1.8, sfx: 'boing' },
        { id: 'star',  name: '별똥별',    elem: 'light', lv: 8, cost: 5, mult: 2.6, sfx: 'fanfare' },
      ],
    },
    yona: {
      name: '연아', sprite: 'yona', color: '#6cc7b3', other: 'sua', call: '언니',
      streakSfx: 'chirp',
      skills: [
        { id: 'storm',  name: '민트 폭풍',   elem: 'water', lv: 1, cost: 3, mult: 1.8, sfx: 'sparkle' },
        { id: 'sprout', name: '새싹 회오리', elem: 'grass', lv: 4, cost: 3, mult: 1.8, sfx: 'chirp' },
        { id: 'aurora', name: '오로라',      elem: 'light', lv: 8, cost: 5, mult: 2.6, sfx: 'fanfare' },
      ],
    },
  };
  const MAX_ENERGY = 5;
  function skillsOf(heroKey, lv){ return HEROES[heroKey].skills.filter(s => lv >= s.lv); }

  // ---------- 무대 ----------
  // 열 무대 + 숨은 무대 하나. 달리기 게임의 열 곳을 그대로 세계 지도로 쓴다.
  // dark 는 글자를 밝게 써야 하는 어두운 하늘. tame 은 세 번 이기면 친구가 되는 상대.
  // tier 는 세기 단계 — 없으면 무대 번호. 숨은 무대는 번호는 끝이지만 세기는 중간이다.
  // bg 는 판타지 배경의 설계도다. 그리는 방법은 quest.html 에 있고, 여기엔 무엇이
  // 있는지만 적는다 — 무대를 하나 더 만들 때 이 한 덩어리만 쓰면 되도록.
  const AREAS = [
    { name: '들판', dark: false, elem: 'grass',
      sky: ['#bfe4f7', '#a8d8f2', '#9ad0ef', '#cfe9fa', '#eaf3ea'],
      far: '#a6cd91', near: '#76b166', ground: '#dcc9a1', groundDark: '#b79a6f',
      bg: { orb: { x: 0.80, y: 0.14, r: 15, c: '#ffe9a8', glow: '#fff6d0' },
            clouds: [[0.15, 0.16, 2], [0.52, 0.10, 1], [0.86, 0.26, 1]],
            silh: { sp: 'tree', s: 2, gap: 46, c: '#7fb46f', y: 118, speed: 0 },
            motes: { kind: 'petal', n: 14, c: '#ffc9de' },
            deco: { sp: 'flower', s: 2, gap: 52 } },
      foes: [ { sp: 'ladybug',  name: '무당벌레',     s: 5, tame: true },
              { sp: 'snail',    name: '느림보 달팽이', s: 5 },
              { sp: 'mushroom', name: '통통 버섯',    s: 5, elem: 'dark' } ],
      boss:   { sp: 'fox',      name: '분홍 여우 대장', s: 4, pattern: ['charge'] } },

    { name: '산', dark: false, elem: 'grass',
      sky: ['#a9cfe8', '#93c2e0', '#7fb5d8', '#c3ddec', '#e6eef2'],
      far: '#8ba0b8', near: '#4c8f46', ground: '#b5ada0', groundDark: '#8a8377',
      bg: { orb: { x: 0.18, y: 0.13, r: 11, c: '#f4f7ff', glow: '#dfe9f5' },
            peaks: { c: '#6b7f9c', edge: '#c8d6e4', n: 4, top: 74, h: 40 },
            fog: [{ y: 124, c: '#ffffff', a: 0.26 }],
            birds: 4,
            silh: { sp: 'tree', s: 1, gap: 22, c: '#3d6f42', y: 140, speed: 0 },
            motes: { kind: 'snow', n: 10, c: '#ffffff' } },
      foes: [ { sp: 'squirrel', name: '도토리 다람쥐', s: 5, tame: true },
              { sp: 'stone',    name: '굴러온 돌',    s: 4, elem: 'none' },
              { sp: 'bird',     name: '산새',        s: 6 } ],
      boss:   { sp: 'tree',     name: '걷는 나무',    s: 4, pattern: ['charge', 'heal'] } },

    { name: '강', dark: false, elem: 'water',
      sky: ['#bfe4f7', '#a5d8f3', '#8ec9ee', '#d3ecfa', '#eef6f2'],
      far: '#8ec07b', near: '#4a9ed6', ground: '#cfc6ae', groundDark: '#9b9280',
      bg: { orb: { x: 0.72, y: 0.12, r: 12, c: '#fff2bd', glow: '#fff9e2' },
            clouds: [[0.22, 0.14, 1], [0.60, 0.22, 2]],
            shimmer: { y: 138, c: '#cdeaff', n: 16 },
            silh: { sp: 'reed', s: 2, gap: 26, c: '#31573b', y: 136, speed: 0 },
            motes: { kind: 'firefly', n: 12, c: '#fff3a0' },
            deco: { sp: 'sprout', s: 2, gap: 44 } },
      foes: [ { sp: 'reed',     name: '갈대 요정',    s: 4, elem: 'grass' },
              { sp: 'log',      name: '떠내려온 통나무', s: 4, elem: 'grass' },
              { sp: 'crab',     name: '강게',        s: 4, tame: true } ],
      boss:   { sp: 'umbrella', name: '우산 도깨비',  s: 5, pattern: ['charge', 'guard'] } },

    { name: '바다', dark: false, elem: 'water',
      sky: ['#cfeafc', '#a8dcf6', '#86cbef', '#dff0fb', '#f3f7ee'],
      far: '#2f7fbe', near: '#1f6aa8', ground: '#efe0bb', groundDark: '#c9b58c',
      bg: { orb: { x: 0.24, y: 0.20, r: 18, c: '#ffd39a', glow: '#ffe9c4' },
            islands: [[0.62, 96, 34], [0.84, 88, 22]],
            shimmer: { y: 128, c: '#bfe6ff', n: 22 },
            birds: 5,
            motes: { kind: 'bubble', n: 12, c: '#e7f6ff' },
            deco: { sp: 'starfish', s: 1, gap: 58 } },
      foes: [ { sp: 'starfish',   name: '불가사리',     s: 4, tame: true },
              { sp: 'crab',       name: '집게 게',     s: 4 },
              { sp: 'sandcastle', name: '모래성 지킴이', s: 4, elem: 'none' } ],
      boss:   { sp: 'starfish',   name: '왕불가사리',   s: 7, pattern: ['charge', 'guard', 'heal'] } },

    { name: '도시', dark: true, elem: 'dark',
      sky: ['#5a4a86', '#a05f86', '#ff8a5c', '#ffb877', '#ffd9a0'],
      far: '#6d8db0', near: '#3f5470', ground: '#6b6a72', groundDark: '#45444c',
      bg: { orb: { x: 0.14, y: 0.12, r: 10, c: '#fff4d6', glow: '#ffe0b0' },
            stars: 0.35,
            skyline: { c: '#2f4058', y: 120, lit: '#ffd979' },
            silh: { sp: 'tower', s: 1, gap: 96, c: '#243247', y: 122, speed: 0 },
            motes: { kind: 'spark', n: 10, c: '#ffd979' } },
      foes: [ { sp: 'cone', name: '공사장 고깔',  s: 4, elem: 'fire' },
              { sp: 'bin',  name: '쓰레기통 괴물', s: 4 },
              { sp: 'cat',  name: '골목 고양이',  s: 4, tame: true } ],
      boss:   { sp: 'tower', name: '타워 로봇',   s: 4, pattern: ['charge', 'guard'] } },

    { name: '사막', dark: true, elem: 'fire',
      sky: ['#33305e', '#6b4477', '#c2645f', '#e79a6a', '#f3c58c'],
      far: '#a87a54', near: '#c9a06a', ground: '#e0bd85', groundDark: '#b18a5a',
      bg: { orb: { x: 0.74, y: 0.17, r: 20, c: '#ff9a6a', glow: '#ffc79a' },
            stars: 0.5,
            dunes: { c: '#8a6141', y: 112, n: 3 },
            silh: { sp: 'cactus', s: 2, gap: 58, c: '#7a5a3c', y: 150, speed: 0 },
            motes: { kind: 'dust', n: 16, c: '#e8c79a' } },
      foes: [ { sp: 'cactus', name: '뾰족 선인장', s: 3, elem: 'grass' },
              { sp: 'tumble', name: '굴러풀',    s: 4, tame: true, elem: 'grass' },
              { sp: 'skull',  name: '사막 해골',  s: 4 } ],
      boss:   { sp: 'skull',  name: '해골 대왕',  s: 7, pattern: ['charge', 'heal'] } },

    { name: '화산', dark: true, elem: 'fire',
      sky: ['#120c1c', '#1d1026', '#331331', '#5a1a2c', '#8a2a22'],
      far: '#2b2230', near: '#191320', ground: '#2a2228', groundDark: '#151016',
      bg: { orb: { x: 0.22, y: 0.11, r: 9, c: '#ff6a4a', glow: '#a8321f' },
            stars: 0.6,
            silh: { sp: 'volcano', s: 3, gap: 130, c: '#150f18', y: 132, speed: 0 },
            lava: { y: 150, c: '#ff6a2a', c2: '#ffb15a' },
            glow: '#ff6a2a',
            motes: { kind: 'ember', n: 22, c: '#ffb15a' } },
      foes: [ { sp: 'flame',    name: '춤추는 불꽃', s: 4, tame: true },
              { sp: 'lavaRock', name: '용암 바위',  s: 4, elem: 'none' },
              { sp: 'skull',    name: '검은 해골',  s: 4, elem: 'dark' } ],
      boss:   { sp: 'volcano',  name: '화산 거인',  s: 4, pattern: ['charge', 'charge', 'guard'] } },

    { name: '발사기지', dark: true, elem: 'dark',
      sky: ['#2c3d6b', '#4b5f96', '#7c86b4', '#c39ba0', '#f0c39a'],
      far: '#59657f', near: '#3b4358', ground: '#4d5060', groundDark: '#343643',
      bg: { stars: 0.4,
            beams: { n: 3, c: '#ffe9c4' },
            silh: { sp: 'launchPad', s: 2, gap: 150, c: '#3a4459', y: 128, speed: 0 },
            skyline: { c: '#404b63', y: 132, lit: '#9fd6ff' },
            motes: { kind: 'spark', n: 8, c: '#bfe4f7' } },
      foes: [ { sp: 'agent',  name: '선글라스 요원', s: 4, tame: true },
              { sp: 'crate',  name: '수상한 상자',  s: 4, elem: 'none' },
              { sp: 'barrel', name: '드럼통',      s: 4, elem: 'fire' } ],
      boss:   { sp: 'rocket', name: '로켓 로봇',    s: 4, pattern: ['charge', 'guard', 'charge'] } },

    { name: '우주', dark: true, elem: 'dark',
      sky: ['#05060f', '#080b1a', '#0c1128', '#101838', '#161f4a'],
      far: '#3a3550', near: '#5b5570', ground: '#6b6480', groundDark: '#474155',
      bg: { orb: { x: 0.76, y: 0.22, r: 26, c: '#8f7ec9', glow: '#4b3f78', ring: '#c9b6ff' },
            stars: 1, meteor: true,
            aurora: ['#5aa9e6', '#b9a3d6', '#6cc7b3'],
            islands: [[0.16, 92, 30], [0.42, 74, 18]],
            silh: { sp: 'ufo', s: 2, gap: 170, c: '#2b2740', y: 104, speed: 8 },
            motes: { kind: 'spark', n: 14, c: '#ffffff' } },
      foes: [ { sp: 'alien',  name: '초록 외계인', s: 4, tame: true, elem: 'grass' },
              { sp: 'ufo',    name: 'UFO',       s: 4 },
              { sp: 'planet', name: '꼬마 행성',  s: 3, elem: 'none' } ],
      boss:   { sp: 'planet', name: '행성 왕',    s: 5, pattern: ['charge', 'heal', 'guard'] } },

    { name: '천국', dark: false, elem: 'light',
      sky: ['#efd9ff', '#f9e2fa', '#ffe8f2', '#fff3ea', '#fffaf2'],
      far: '#ffe6f4', near: '#f7d9ef', ground: '#fdf6ff', groundDark: '#f2ddf7',
      bg: { rays: ['#ff9aa2', '#ffd979', '#8fd9c8', '#a5d8f3', '#b9a3d6'],
            orb: { x: 0.20, y: 0.14, r: 13, c: '#fffdf2', glow: '#ffeec9' },
            cloudsea: { y: 128, c: '#ffe6f4', edge: '#ffffff' },
            silh: { sp: 'goldCity', s: 2, gap: 200, c: '#f0d69a', y: 126, speed: 2.5 },
            pillars: { c: '#f6e6fb', n: 3 },
            motes: { kind: 'feather', n: 14, c: '#ffffff' } },
      foes: [ { sp: 'angel',  name: '장난꾸러기 천사', s: 4, tame: true },
              { sp: 'harp',   name: '혼자 울리는 하프', s: 4, elem: 'none' },
              { sp: 'pillar', name: '구름 기둥',     s: 4, elem: 'none' } ],
      boss:   { sp: 'star',   name: '별의 수호자',    s: 6, pattern: ['charge', 'guard', 'heal'] } },

    // 숨은 무대. 반년 만에 키를 다시 재서 자랐으면 이레 동안 열린다.
    // 세기는 도시쯤(tier 4)인데 보상은 두 배 — 기념이니까.
    { name: '뒷마당', dark: false, hidden: true, tier: 4, elem: 'grass',
      sky: ['#bfe4f7', '#cfe9fa', '#e2f3fb', '#f0f8f0', '#fff6e9'],
      far: '#8fd9c8', near: '#6cc7b3', ground: '#c79b6d', groundDark: '#a97b4f',
      bg: { orb: { x: 0.82, y: 0.13, r: 14, c: '#ffe9a8', glow: '#fff6d0' },
            clouds: [[0.18, 0.14, 2], [0.55, 0.24, 1]],
            silh: { sp: 'house', s: 2, gap: 190, c: '#e0a49a', y: 130, speed: 0 },
            balloons: 3,
            motes: { kind: 'petal', n: 10, c: '#ffd9e4' },
            deco: { sp: 'flower', s: 2, gap: 40 } },
      foes: [ { sp: 'butterfly', name: '나비 떼',    s: 6, tame: true },
              { sp: 'balloon',   name: '도망간 풍선', s: 6, elem: 'none' },
              { sp: 'cake',      name: '케이크 도둑', s: 4, elem: 'fire' } ],
      boss:   { sp: 'house',     name: '걸어 다니는 우리 집', s: 3, pattern: ['charge', 'heal'] } },
  ];
  const HIDDEN_DAYS = 7;

  // ---------- 부모 조정판 ----------
  // 표의 'tuning' 줄 하나. 규칙 파일을 고치지 않고 난이도를 맞춘다. 범위 밖 값은 잘라 낸다.
  const TUNE_DEFAULT = { weekHpMul: 1, giftGold: 25, foeMul: 1, cheer: '' };
  const clamp = (v, lo, hi, d) => { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  function fixTune(t){
    t = Object.assign({}, TUNE_DEFAULT, t || {});
    return {
      weekHpMul: Math.round(clamp(t.weekHpMul, 0.5, 2, 1) * 10) / 10,
      giftGold:  Math.round(clamp(t.giftGold, 10, 100, 25)),
      foeMul:    Math.round(clamp(t.foeMul, 0.6, 1.4, 1) * 10) / 10,
      cheer:     String(t.cheer || '').slice(0, 60),
    };
  }

  // ---------- 성장 ----------
  // 레벨은 경험치의 제곱근. 처음엔 빨리 오르고 갈수록 느려진다.
  // 60 → 2레벨, 240 → 3, 540 → 4, 960 → 5, 1500 → 6 …
  const XP_UNIT = 60;
  function levelOf(xp){ return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / XP_UNIT)); }
  function xpForLevel(lv){ return (lv - 1) * (lv - 1) * XP_UNIT; }

  // 현실에서 한 일 → 경험치. 서버가 센 숫자(quest_facts)를 받는다.
  // 달리기 점수는 2만 점을 넘기도 해서 상한을 뒀다 — 그것만으로 레벨이 다 오르면
  // 나머지가 의미 없어진다.
  const REAL = {
    diary:   { xp: 40, label: '일기' },
    work:    { xp: 15, label: '작품' },
    outing:  { xp: 15, label: '나들이' },
    runDiv:  100, runCap: 300,
  };
  function realXp(f){
    f = f || {};
    return (f.diaries || 0) * REAL.diary.xp
         + (f.works || 0) * REAL.work.xp
         + (f.outings || 0) * REAL.outing.xp
         + Math.min(REAL.runCap, Math.floor((f.run_best || 0) / REAL.runDiv));
  }

  // 스탯 셋. 각 항목이 어디서 왔는지(parts)를 같이 돌려줘서 화면이 「왜」를 보여 줄 수 있다.
  //   힘     — 공격. 레벨과 작품 수(만드는 손), 무기.
  //   재빠름 — 피하기와 타이밍 칸의 너비. 레벨과 달리기 최고 점수.
  //   마음   — 체력과 방어할 때 회복. 레벨과 일기 편수.
  function stats(save, facts){
    const f = facts || {};
    const xp = (save.xp || 0) + realXp(f);
    const lv = levelOf(xp);
    const fromWorks  = Math.min(15, Math.floor((f.works || 0) / 3));
    const fromRun    = Math.min(12, Math.floor((f.run_best || 0) / 1500));
    const fromDiary  = Math.min(30, (f.diaries || 0) * 2);
    const fromHeight = f.height ? Math.min(40, Math.max(0, Math.round((f.height - 100) / 2))) : 0;
    const weapon = save.weapon || 0, armor = save.armor || 0;
    const str = 4 + 2 * (lv - 1) + fromWorks + weapon * 3;
    const agi = 2 + (lv - 1) + fromRun;
    const hrt = 4 + 2 * (lv - 1) + fromDiary;
    const maxHp = 28 + hrt * 3 + armor * 8 + fromHeight;
    return {
      lv, xp, next: xpForLevel(lv + 1), prev: xpForLevel(lv),
      str, agi, hrt, maxHp, weapon, armor,
      dodge: Math.min(0.35, 0.05 + agi * 0.012),        // 피할 확률
      zone:  Math.min(46, 16 + agi * 1.3),              // 타이밍 칸 너비(%)
      guardHeal: Math.ceil(hrt * 0.5),
      parts: {
        str: { base: 4, lv: 2 * (lv - 1), works: fromWorks, weapon: weapon * 3 },
        agi: { base: 2, lv: lv - 1, run: fromRun },
        hrt: { base: 4, lv: 2 * (lv - 1), diary: fromDiary },
        hp:  { base: 28, hrt: hrt * 3, armor: armor * 8, height: fromHeight },
        xp:  { fights: save.xp || 0, real: realXp(f) },
      },
    };
  }

  // ---------- 상대 ----------
  // T 는 부모 조정판. foeMul 이 상대의 체력·공격에 곱해진다.
  function foeAt(area, idx, T){
    const A = AREAS[area], d = A.foes[idx], tier = A.tier == null ? area : A.tier;
    const mul = (T && T.foeMul) || 1, bonus = A.hidden ? 2 : 1;
    const hpMul = [1, 1.15, 0.85][idx];
    return {
      sp: d.sp, name: d.name, s: d.s, boss: false, area, idx, tame: !!d.tame,
      elem: d.elem || A.elem,
      hp: Math.round((16 + tier * 14) * hpMul * mul),
      atk: Math.max(1, Math.round((3 + tier * 2 + idx) * mul)),
      xp: (14 + tier * 12) * bonus,
      gold: (5 + tier * 4) * bonus,
    };
  }
  function bossAt(area, T){
    const A = AREAS[area], d = A.boss, tier = A.tier == null ? area : A.tier;
    const mul = (T && T.foeMul) || 1, bonus = A.hidden ? 2 : 1;
    return {
      sp: d.sp, name: d.name, s: d.s, boss: true, area, idx: -1, tame: false,
      elem: d.elem || A.elem, pattern: d.pattern || ['charge'],
      hp: Math.round((16 + tier * 14) * 3.0 * mul),
      atk: Math.max(1, Math.round(((3 + tier * 2) * 1.25 + 1) * mul)),
      xp: (14 + tier * 12) * 4 * bonus,
      gold: (5 + tier * 4) * 6 * bonus,
    };
  }
  // 대장은 세 턴마다 한 번 특별한 짓을 한다. 무엇을 할지는 대장마다 정해진 차례대로.
  //   charge 힘 모으기(다음 공격 두 배) · guard 단단해지기(내 공격 절반) · heal 회복
  function bossAct(foe, turn){
    if (!foe.boss || turn % 3 !== 0) return null;
    const p = foe.pattern || ['charge'];
    return p[(Math.floor(turn / 3) - 1) % p.length];
  }
  const BOSS_SKIP = { charge: true, guard: false, heal: false };
  const BOSS_SAY = {
    charge: { say: '힘을 모아요! 다음 공격이 세요 — <b>방어</b>하면 좋아요.', sfx: 'thud' },
    guard:  { say: '단단해졌어요! 잠깐은 내 공격이 절반만 들어가요.', sfx: 'prop' },
    heal:   { say: '숨을 고르며 체력을 회복해요!', sfx: 'drip' },
  };
  const BOSS_HEAL = 0.12;          // 대장이 회복하는 비율
  const BOSS_GUARD_CUT = 0.5;      // 단단해졌을 때 내 공격이 줄어드는 비율

  // ---------- 한 번의 공격 ----------
  // kind: perfect(칸 한가운데) | good(칸 안) | miss(칸 밖) | skill(기술)
  // extra 는 자매 콤보·속성 상성 같은 곱을 모두 곱해 넘긴다.
  const HIT_MULT = { perfect: 1.7, good: 1.0, miss: 0.5, skill: 1 };
  function heroHit(st, kind, rnd, extra){
    const base = st.str + Math.floor((rnd == null ? Math.random() : rnd) * 4);
    return Math.max(1, Math.round(base * (HIT_MULT[kind] || 1) * (extra || 1)));
  }
  // 대장이 힘을 모은 다음 턴은 두 배. 방어하면 반으로.
  function foeHit(foe, st, guarding, charged, rnd){
    let raw = foe.atk + Math.floor((rnd == null ? Math.random() : rnd) * 3) - Math.floor(st.armor * 1.2);
    if (charged) raw *= 2;
    if (guarding) raw = Math.ceil(raw / 2);
    return Math.max(1, raw);
  }
  // 타이밍 바에서 어디를 눌렀나. pos·center 는 0~100, zone 은 칸 너비.
  function judge(pos, center, zone){
    const d = Math.abs(pos - center);
    if (d <= zone / 4) return 'perfect';
    if (d <= zone / 2) return 'good';
    return 'miss';
  }
  const COMBO_MULT = 1.5;                // 같은 날 둘 다 모험하면 — 언니 동생 콤보
  const STREAK_FOR_FANFARE = 3;          // 완벽 타이밍 연속 셋이면 팡파르
  const TAME_WINS = 3;                   // 이만큼 이기면 친구가 된다
  const CHEER_HEAL = 0.15;               // 응원 요정이 채워 주는 체력 비율

  // ---------- 친구 ----------
  // 친구는 따라만 다니지 않는다. 턴마다 하나가 나서서 때리거나 돌봐 준다.
  const FRIEND = {
    chance: n => Math.min(0.75, 0.3 * n),    // 누군가 나설 확률
    healShare: 0.35,                          // 그중 돌보는 쪽 비율
    atk: st => Math.max(1, Math.round(st.str * 0.6)),
    heal: st => Math.max(1, Math.round(st.hrt * 0.6)),
  };
  // rng 는 난수 「함수」다. 숫자 하나를 받아 세 판단에 다 쓰면 「나설 때는 주로 돌본다」처럼
  // 서로 묶여 버린다 — 처음에 그렇게 짰다가 시뮬레이션에서 비율이 안 맞아 찾았다.
  function friendAct(save, st, rng){
    const r = typeof rng === 'function' ? rng : Math.random;
    const list = save.friends || [], n = list.length;
    if (!n || r() > FRIEND.chance(n)) return null;
    const who = list[Math.min(n - 1, Math.floor(r() * n))];
    const heal = r() < FRIEND.healShare;
    return { key: who, kind: heal ? 'heal' : 'atk', amount: heal ? FRIEND.heal(st) : FRIEND.atk(st) };
  }

  // ---------- 연승 ----------
  // 이길 때마다 하나씩 쌓이고, 쓰러지면 0으로 돌아간다(도망은 안 끊는다 —
  // 도망은 진 게 아니라 물러난 것이다). 상자에서 나오는 금화·경험치에
  // 붙는 배율. 10연승에서 +50% 로 막아 둔다 — 안 그러면 잘하는 아이일수록
  // 격차가 계속 벌어져 동생이 따라잡을 길이 없어진다.
  const STREAK = { cap: 10, per: 0.05 };
  function streakMult(n){ return 1 + Math.min(Math.max(0, n || 0), STREAK.cap) * STREAK.per; }

  // ---------- 보물 상자 ----------
  // 이겼을 때 가끔(대장은 늘) 열린다. 무엇이 나올지 몰라야 여는 재미가 있다.
  const CHEST = { chance: boss => (boss ? 1 : 0.22) };
  function openChest(foe, rnd){
    const r = typeof rnd === 'function' ? rnd() : (rnd == null ? Math.random() : rnd);
    if (r < 0.4) return { kind: 'gold',   gold: foe.gold, say: '금화가 가득!' };
    if (r < 0.7) return { kind: 'potion', potions: foe.boss ? 2 : 1, say: '물약이 들어 있어요!' };
    return { kind: 'xp', xp: Math.round(foe.xp * 0.6), say: '낡은 지도 — 경험치!' };
  }

  // ---------- 칭호 ----------
  // 위에서 아래로 갈수록 어렵다. 가진 것 중 가장 아래 것을 이름 옆에 단다.
  const TITLES = [
    { id: 'start',  name: '모험을 시작한 사람', ok: (s) => (s.fights || 0) >= 1 },
    { id: 'friend', name: '모두의 친구',       ok: (s) => (s.friends || []).length >= 3 },
    { id: 'dex',    name: '기록하는 사람',      ok: (s) => (s.dexSkies || []).length >= 3 },
    { id: 'boss3',  name: '대장 사냥꾼',        ok: (s) => s.boss.filter(Boolean).length >= 3 },
    { id: 'gear',   name: '빛나는 장비',        ok: (s) => (s.weapon || 0) >= 3 && (s.armor || 0) >= 3 },
    { id: 'week',   name: '함께 이긴 사람',      ok: (s) => (s.weekWins || 0) >= 1 },
    { id: 'lv10',   name: '베테랑 모험가',      ok: (s, st) => st.lv >= 10 },
    { id: 'streak5', name: '연승 행진',        ok: (s) => (s.bestStreak || 0) >= 5 },
    { id: 'all',    name: '세계를 돈 사람',      ok: (s) => s.boss.length >= 10 && s.boss.slice(0, 10).every(Boolean) },
  ];
  function titlesOf(save, st){ return TITLES.filter(t => { try { return t.ok(save, st); } catch (e) { return false; } }); }
  function titleOf(save, st){ const e = titlesOf(save, st); return e.length ? e[e.length - 1] : null; }

  // ---------- 가게 ----------
  const SHOP = {
    potion:  { price: 15, max: 9, heal: 0.45 },
    inn:     { price: 10 },
    upgrade: { max: 5, gold: w => 30 + w * 30, paint: w => w + 1 },
    gift:    { gold: T => (T && T.giftGold) || TUNE_DEFAULT.giftGold, potions: 1 },
    lose:    { goldKeep: 0.8 },           // 쓰러지면 금화의 80% 만 남는다
  };

  // ---------- 이번 주 보스 ----------
  // 월요일 날짜가 주의 열쇠. 자매 둘이 낸 피해를 합쳐서 잰다.
  const WEEK0 = new Date(2026, 7, 31);   // 첫 주 월요일
  function weekKey(d){
    d = new Date(d || Date.now());
    const back = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - back); d.setHours(0, 0, 0, 0);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function weekIndex(key){
    const [y, m, dd] = key.split('-').map(Number);
    return Math.max(0, Math.round((new Date(y, m - 1, dd) - WEEK0) / (7 * 864e5)));
  }
  const WEEK = {
    hp: (key, T) => Math.round((2000 + 300 * weekIndex(key)) * ((T && T.weekHpMul) || 1)),
    swingsPerDay: 5,
    swingMult: 3,
    reward: { gold: 150, xp: 300 },
    names:   ['하늘 앵무', '왕병아리', '걸어 다니는 집', '이젤 유령', '왕나비'],
    sprites: [{ sp: 'budgieUp', s: 3 }, { sp: 'chick', s: 4 }, { sp: 'house', s: 2 }, { sp: 'easel', s: 2 }, { sp: 'butterfly', s: 8 }],
    elems:   ['light', 'grass', 'none', 'dark', 'water'],
    name: key => WEEK.names[weekIndex(key) % WEEK.names.length],
    sprite: key => WEEK.sprites[weekIndex(key) % WEEK.sprites.length],
    elem: key => WEEK.elems[weekIndex(key) % WEEK.elems.length],
    area: key => [9, 0, 10, 4, 3][weekIndex(key) % 5],   // 어느 무대 배경에서 만나나
  };

  function newSave(){
    return {
      v: 3, xp: 0, gold: 20, hp: null, potions: 1, weapon: 0, armor: 0, spentPaint: 0,
      wins: AREAS.map(() => 0), boss: AREAS.map(() => false),
      lastGift: '', fights: 0, lv: 1,
      week: { key: '', dmg: 0, day: '', swings: 0, claimed: false, hp: 0 },
      lastWeek: null,                     // 지난주 보스 기록 — 첫 화면 카드가 읽는다
      weekWins: 0,                        // 이번 주 보스를 함께 쓰러뜨린 횟수 — 칭호
      lastPlay: '',                       // 마지막으로 논 날 — 자매 콤보의 근거
      friends: [],                        // 친구가 된 상대 ('무대:번호')
      foeWins: {},                        // 상대마다 이긴 횟수 — 친구 되기용
      met: {},                            // 만난 상대 — 도감
      dexSkies: [],                       // 도감을 채운 무대의 하늘 — 올해의 카드 배경
      gear: { weapon: null, armor: null }, // 장비에 붙인 그림 ({ n, s })
      journalDay: '',                     // 모험 일지를 남긴 날 — 하루 한 편
      chests: 0,                          // 연 상자 수
      streak: 0,                          // 지금 이어지는 연승 — 쓰러지면 0으로
      bestStreak: 0,                      // 가장 길었던 연승 — 칭호 근거
    };
  }
  // 옛 세이브에 없는 칸을 채운다. 규칙이 늘어도 예전 줄이 깨지지 않게.
  function fixSave(s){
    const n = newSave();
    s = Object.assign(n, s || {});
    s.wins = AREAS.map((_, i) => (s.wins && s.wins[i]) || 0);
    s.boss = AREAS.map((_, i) => !!(s.boss && s.boss[i]));
    s.week = Object.assign(n.week, s.week || {});
    s.gear = Object.assign(n.gear, s.gear || {});
    if (!Array.isArray(s.friends)) s.friends = [];
    if (!Array.isArray(s.dexSkies)) s.dexSkies = [];
    if (!s.foeWins || typeof s.foeWins !== 'object') s.foeWins = {};
    if (!s.met || typeof s.met !== 'object') s.met = {};
    return s;
  }
  // 무대 i 가 열렸나 — 첫 무대는 늘, 그다음은 앞 무대 대장을 이겨야.
  // 숨은 무대는 자란 날(facts.grow_on)로부터 이레 동안.
  function hiddenDaysLeft(facts, now){
    if (!facts || !facts.grow_on) return 0;
    const [y, m, d] = String(facts.grow_on).slice(0, 10).split('-').map(Number);
    const opened = new Date(y, m - 1, d);
    const days = Math.floor(((now || Date.now()) - opened) / 864e5);
    return days < 0 ? 0 : Math.max(0, HIDDEN_DAYS - days);
  }
  function areaOpen(save, i, facts){
    if (AREAS[i].hidden) return hiddenDaysLeft(facts) > 0;
    return i === 0 || !!save.boss[i - 1];
  }
  // 대장에게 도전하려면 그 무대에서 세 번은 이겨야 한다.
  const WINS_FOR_BOSS = 3;
  // 도감 — 그 무대의 셋과 대장을 다 만났나.
  function dexDone(save, i){
    return [0, 1, 2].every(j => save.met[i + ':' + j]) && !!save.met[i + ':boss'];
  }
  function dexCount(save){
    let seen = 0, all = 0;
    AREAS.forEach((A, i) => { all += 4; [0, 1, 2].forEach(j => { if (save.met[i + ':' + j]) seen++; }); if (save.met[i + ':boss']) seen++; });
    return { seen, all };
  }
  function friendsOf(save){
    return (save.friends || []).map(k => {
      const [a, j] = k.split(':').map(Number);
      return AREAS[a] && AREAS[a].foes[j] ? Object.assign({ key: k, area: a }, AREAS[a].foes[j]) : null;
    }).filter(Boolean);
  }

  return {
    HEROES, AREAS, REAL, SHOP, WEEK, TUNE_DEFAULT, HIT_MULT, ELEM, STRONG, TITLES, CHEST, FRIEND, STREAK, streakMult,
    BOSS_SAY, BOSS_SKIP, BOSS_HEAL, BOSS_GUARD_CUT, MAX_ENERGY,
    WINS_FOR_BOSS, COMBO_MULT, STREAK_FOR_FANFARE, TAME_WINS, CHEER_HEAL, HIDDEN_DAYS,
    levelOf, xpForLevel, realXp, stats, foeAt, bossAt, bossAct, heroHit, foeHit, judge,
    elemMult, elemSay, skillsOf, friendAct, openChest, titlesOf, titleOf,
    weekKey, weekIndex, newSave, fixSave, fixTune, areaOpen, hiddenDaysLeft, dexDone, dexCount, friendsOf,
  };
})();
if (typeof module !== 'undefined') module.exports = QUEST;
