// 도트 모험단의 규칙 — 숫자와 표만 있고 화면은 없다.
// 화면(quest.html)과 떼어 둔 이유: 노드에서 이 파일만 읽어 수백 판을 돌려 보고
// 「몇 레벨이면 어느 무대를 깰 수 있나」를 재기 위해서다. 균형은 감이 아니라 측정으로 맞춘다.
const QUEST = (() => {

  // 모험가 둘. 표의 열쇠(author_key)가 sua/yona 라서 그대로 쓴다.
  const HEROES = {
    sua:  { name: '수아', sprite: 'sua',  color: '#ff7f8a', skill: '하트 빔',  skillSfx: 'sparkle' },
    yona: { name: '연아', sprite: 'yona', color: '#6cc7b3', skill: '민트 폭풍', skillSfx: 'sparkle' },
  };

  // 열 무대. 달리기 게임의 열 곳을 그대로 세계 지도로 쓴다 — 하늘색도 같은 값이다.
  // dark 는 글자를 밝게 써야 하는 어두운 하늘.
  const AREAS = [
    { name: '들판', dark: false,
      sky: ['#bfe4f7', '#a8d8f2', '#9ad0ef', '#cfe9fa', '#eaf3ea'],
      far: '#a6cd91', near: '#76b166', ground: '#dcc9a1', groundDark: '#b79a6f',
      foes: [ { sp: 'ladybug',  name: '무당벌레',     s: 5 },
              { sp: 'snail',    name: '느림보 달팽이', s: 5 },
              { sp: 'mushroom', name: '통통 버섯',    s: 5 } ],
      boss:   { sp: 'fox',      name: '분홍 여우 대장', s: 4 } },

    { name: '산', dark: false,
      sky: ['#a9cfe8', '#93c2e0', '#7fb5d8', '#c3ddec', '#e6eef2'],
      far: '#8ba0b8', near: '#4c8f46', ground: '#b5ada0', groundDark: '#8a8377',
      foes: [ { sp: 'squirrel', name: '도토리 다람쥐', s: 5 },
              { sp: 'stone',    name: '굴러온 돌',    s: 4 },
              { sp: 'bird',     name: '산새',        s: 6 } ],
      boss:   { sp: 'tree',     name: '걷는 나무',    s: 4 } },

    { name: '강', dark: false,
      sky: ['#bfe4f7', '#a5d8f3', '#8ec9ee', '#d3ecfa', '#eef6f2'],
      far: '#8ec07b', near: '#4a9ed6', ground: '#cfc6ae', groundDark: '#9b9280',
      foes: [ { sp: 'reed',     name: '갈대 요정',    s: 4 },
              { sp: 'log',      name: '떠내려온 통나무', s: 4 },
              { sp: 'crab',     name: '강게',        s: 4 } ],
      boss:   { sp: 'umbrella', name: '우산 도깨비',  s: 5 } },

    { name: '바다', dark: false,
      sky: ['#cfeafc', '#a8dcf6', '#86cbef', '#dff0fb', '#f3f7ee'],
      far: '#2f7fbe', near: '#1f6aa8', ground: '#efe0bb', groundDark: '#c9b58c',
      foes: [ { sp: 'starfish',   name: '불가사리',     s: 4 },
              { sp: 'crab',       name: '집게 게',     s: 4 },
              { sp: 'sandcastle', name: '모래성 지킴이', s: 4 } ],
      boss:   { sp: 'starfish',   name: '왕불가사리',   s: 7 } },

    { name: '도시', dark: true,
      sky: ['#5a4a86', '#a05f86', '#ff8a5c', '#ffb877', '#ffd9a0'],
      far: '#6d8db0', near: '#3f5470', ground: '#6b6a72', groundDark: '#45444c',
      foes: [ { sp: 'cone', name: '공사장 고깔',  s: 4 },
              { sp: 'bin',  name: '쓰레기통 괴물', s: 4 },
              { sp: 'cat',  name: '골목 고양이',  s: 4 } ],
      boss:   { sp: 'tower', name: '타워 로봇',   s: 4 } },

    { name: '사막', dark: true,
      sky: ['#33305e', '#6b4477', '#c2645f', '#e79a6a', '#f3c58c'],
      far: '#a87a54', near: '#c9a06a', ground: '#e0bd85', groundDark: '#b18a5a',
      foes: [ { sp: 'cactus', name: '뾰족 선인장', s: 3 },
              { sp: 'tumble', name: '굴러풀',    s: 4 },
              { sp: 'skull',  name: '사막 해골',  s: 4 } ],
      boss:   { sp: 'skull',  name: '해골 대왕',  s: 7 } },

    { name: '화산', dark: true,
      sky: ['#120c1c', '#1d1026', '#331331', '#5a1a2c', '#8a2a22'],
      far: '#2b2230', near: '#191320', ground: '#2a2228', groundDark: '#151016',
      foes: [ { sp: 'flame',    name: '춤추는 불꽃', s: 4 },
              { sp: 'lavaRock', name: '용암 바위',  s: 4 },
              { sp: 'skull',    name: '검은 해골',  s: 4 } ],
      boss:   { sp: 'volcano',  name: '화산 거인',  s: 4 } },

    { name: '발사기지', dark: true,
      sky: ['#2c3d6b', '#4b5f96', '#7c86b4', '#c39ba0', '#f0c39a'],
      far: '#59657f', near: '#3b4358', ground: '#8d8f96', groundDark: '#5f6169',
      foes: [ { sp: 'agent',  name: '선글라스 요원', s: 4 },
              { sp: 'crate',  name: '수상한 상자',  s: 4 },
              { sp: 'barrel', name: '드럼통',      s: 4 } ],
      boss:   { sp: 'rocket', name: '로켓 로봇',    s: 4 } },

    { name: '우주', dark: true,
      sky: ['#05060f', '#080b1a', '#0c1128', '#101838', '#161f4a'],
      far: '#3a3550', near: '#5b5570', ground: '#6b6480', groundDark: '#474155',
      foes: [ { sp: 'alien',  name: '초록 외계인', s: 4 },
              { sp: 'ufo',    name: 'UFO',       s: 4 },
              { sp: 'planet', name: '꼬마 행성',  s: 3 } ],
      boss:   { sp: 'planet', name: '행성 왕',    s: 5 } },

    { name: '천국', dark: false,
      sky: ['#efd9ff', '#f9e2fa', '#ffe8f2', '#fff3ea', '#fffaf2'],
      far: '#ffe6f4', near: '#f7d9ef', ground: '#fdf6ff', groundDark: '#f2ddf7',
      foes: [ { sp: 'angel',  name: '장난꾸러기 천사', s: 4 },
              { sp: 'harp',   name: '혼자 울리는 하프', s: 4 },
              { sp: 'pillar', name: '구름 기둥',     s: 4 } ],
      boss:   { sp: 'star',   name: '별의 수호자',    s: 6 } },
  ];

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
  function foeAt(area, idx){
    const A = AREAS[area], d = A.foes[idx];
    const hpMul = [1, 1.15, 0.85][idx];
    return {
      sp: d.sp, name: d.name, s: d.s, boss: false, area,
      hp: Math.round((16 + area * 14) * hpMul),
      atk: 3 + area * 2 + idx,
      xp: 14 + area * 12,
      gold: 5 + area * 4,
    };
  }
  function bossAt(area){
    const A = AREAS[area], d = A.boss;
    return {
      sp: d.sp, name: d.name, s: d.s, boss: true, area,
      hp: Math.round((16 + area * 14) * 2.6),
      atk: Math.round((3 + area * 2) * 1.25) + 1,
      xp: (14 + area * 12) * 4,
      gold: (5 + area * 4) * 6,
    };
  }

  // ---------- 한 번의 공격 ----------
  // kind: perfect(칸 한가운데) | good(칸 안) | miss(칸 밖) | skill(기술)
  const HIT_MULT = { perfect: 1.7, good: 1.0, miss: 0.5, skill: 2.2 };
  function heroHit(st, kind, rnd){
    const base = st.str + Math.floor((rnd == null ? Math.random() : rnd) * 4);
    return Math.max(1, Math.round(base * (HIT_MULT[kind] || 1)));
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
  const SKILL_COST = 3;                  // 기운 셋을 모으면 기술 하나

  // ---------- 가게 ----------
  const SHOP = {
    potion:  { price: 15, max: 9, heal: 0.45 },
    inn:     { price: 10 },
    upgrade: { max: 5, gold: w => 30 + w * 30, paint: w => w + 1 },
    gift:    { gold: 25, potions: 1 },
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
    hp: key => 2000 + 300 * weekIndex(key),
    swingsPerDay: 5,
    swingMult: 3,
    reward: { gold: 150, xp: 300 },
    names: ['구름 고래', '무지개 거북', '별똥 두더지', '달빛 문어', '천둥 오리'],
    name: key => WEEK.names[weekIndex(key) % WEEK.names.length],
  };

  function newSave(){
    return {
      v: 1, xp: 0, gold: 20, hp: null, potions: 1, weapon: 0, armor: 0, spentPaint: 0,
      wins: AREAS.map(() => 0), boss: AREAS.map(() => false),
      lastGift: '', fights: 0, lv: 1,
      week: { key: '', dmg: 0, day: '', swings: 0, claimed: false },
    };
  }
  // 옛 세이브에 없는 칸을 채운다. 규칙이 늘어도 예전 줄이 깨지지 않게.
  function fixSave(s){
    const n = newSave();
    s = Object.assign(n, s || {});
    s.wins = AREAS.map((_, i) => (s.wins && s.wins[i]) || 0);
    s.boss = AREAS.map((_, i) => !!(s.boss && s.boss[i]));
    s.week = Object.assign(n.week, s.week || {});
    return s;
  }
  // 무대 i 가 열렸나 — 첫 무대는 늘, 그다음은 앞 무대 대장을 이겨야.
  function areaOpen(save, i){ return i === 0 || !!save.boss[i - 1]; }
  // 대장에게 도전하려면 그 무대에서 세 번은 이겨야 한다.
  const WINS_FOR_BOSS = 3;

  return {
    HEROES, AREAS, REAL, SHOP, WEEK, SKILL_COST, WINS_FOR_BOSS, HIT_MULT,
    levelOf, xpForLevel, realXp, stats, foeAt, bossAt, heroHit, foeHit, judge,
    weekKey, weekIndex, newSave, fixSave, areaOpen,
  };
})();
if (typeof module !== 'undefined') module.exports = QUEST;
