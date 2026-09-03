// 수아연아 모험단의 규칙 — 숫자와 표만 있고 화면은 없다.
// 화면(quest.html)과 떼어 둔 이유: 노드에서 이 파일만 읽어 수백 판을 돌려 보고
// 「몇 레벨이면 어느 무대를 깰 수 있나」를 재기 위해서다. 균형은 감이 아니라 측정으로 맞춘다.
const QUEST = (() => {

  // 모험가 둘. 표의 열쇠(author_key)가 sua/yona 라서 그대로 쓴다.
  // streakSfx 는 작품에 소리를 아직 안 붙였을 때 연속 강타에 쓰는 기본 소리.
  const HEROES = {
    sua:  { name: '수아', sprite: 'sua',  color: '#ff7f8a', skill: '하트 빔',  skillSfx: 'sparkle', streakSfx: 'fanfare', other: 'yona', call: '동생' },
    yona: { name: '연아', sprite: 'yona', color: '#6cc7b3', skill: '민트 폭풍', skillSfx: 'sparkle', streakSfx: 'chirp',   other: 'sua',  call: '언니' },
  };

  // 열 무대 + 숨은 무대 하나. 달리기 게임의 열 곳을 그대로 세계 지도로 쓴다.
  // dark 는 글자를 밝게 써야 하는 어두운 하늘. tame 은 세 번 이기면 친구가 되는 상대.
  // tier 는 세기 단계 — 없으면 무대 번호. 숨은 무대는 번호는 끝이지만 세기는 중간이다.
  const AREAS = [
    { name: '들판', dark: false,
      sky: ['#bfe4f7', '#a8d8f2', '#9ad0ef', '#cfe9fa', '#eaf3ea'],
      far: '#a6cd91', near: '#76b166', ground: '#dcc9a1', groundDark: '#b79a6f',
      foes: [ { sp: 'ladybug',  name: '무당벌레',     s: 5, tame: true },
              { sp: 'snail',    name: '느림보 달팽이', s: 5 },
              { sp: 'mushroom', name: '통통 버섯',    s: 5 } ],
      boss:   { sp: 'fox',      name: '분홍 여우 대장', s: 4 } },

    { name: '산', dark: false,
      sky: ['#a9cfe8', '#93c2e0', '#7fb5d8', '#c3ddec', '#e6eef2'],
      far: '#8ba0b8', near: '#4c8f46', ground: '#b5ada0', groundDark: '#8a8377',
      foes: [ { sp: 'squirrel', name: '도토리 다람쥐', s: 5, tame: true },
              { sp: 'stone',    name: '굴러온 돌',    s: 4 },
              { sp: 'bird',     name: '산새',        s: 6 } ],
      boss:   { sp: 'tree',     name: '걷는 나무',    s: 4 } },

    { name: '강', dark: false,
      sky: ['#bfe4f7', '#a5d8f3', '#8ec9ee', '#d3ecfa', '#eef6f2'],
      far: '#8ec07b', near: '#4a9ed6', ground: '#cfc6ae', groundDark: '#9b9280',
      foes: [ { sp: 'reed',     name: '갈대 요정',    s: 4 },
              { sp: 'log',      name: '떠내려온 통나무', s: 4 },
              { sp: 'crab',     name: '강게',        s: 4, tame: true } ],
      boss:   { sp: 'umbrella', name: '우산 도깨비',  s: 5 } },

    { name: '바다', dark: false,
      sky: ['#cfeafc', '#a8dcf6', '#86cbef', '#dff0fb', '#f3f7ee'],
      far: '#2f7fbe', near: '#1f6aa8', ground: '#efe0bb', groundDark: '#c9b58c',
      foes: [ { sp: 'starfish',   name: '불가사리',     s: 4, tame: true },
              { sp: 'crab',       name: '집게 게',     s: 4 },
              { sp: 'sandcastle', name: '모래성 지킴이', s: 4 } ],
      boss:   { sp: 'starfish',   name: '왕불가사리',   s: 7 } },

    { name: '도시', dark: true,
      sky: ['#5a4a86', '#a05f86', '#ff8a5c', '#ffb877', '#ffd9a0'],
      far: '#6d8db0', near: '#3f5470', ground: '#6b6a72', groundDark: '#45444c',
      foes: [ { sp: 'cone', name: '공사장 고깔',  s: 4 },
              { sp: 'bin',  name: '쓰레기통 괴물', s: 4 },
              { sp: 'cat',  name: '골목 고양이',  s: 4, tame: true } ],
      boss:   { sp: 'tower', name: '타워 로봇',   s: 4 } },

    { name: '사막', dark: true,
      sky: ['#33305e', '#6b4477', '#c2645f', '#e79a6a', '#f3c58c'],
      far: '#a87a54', near: '#c9a06a', ground: '#e0bd85', groundDark: '#b18a5a',
      foes: [ { sp: 'cactus', name: '뾰족 선인장', s: 3 },
              { sp: 'tumble', name: '굴러풀',    s: 4, tame: true },
              { sp: 'skull',  name: '사막 해골',  s: 4 } ],
      boss:   { sp: 'skull',  name: '해골 대왕',  s: 7 } },

    { name: '화산', dark: true,
      sky: ['#120c1c', '#1d1026', '#331331', '#5a1a2c', '#8a2a22'],
      far: '#2b2230', near: '#191320', ground: '#2a2228', groundDark: '#151016',
      foes: [ { sp: 'flame',    name: '춤추는 불꽃', s: 4, tame: true },
              { sp: 'lavaRock', name: '용암 바위',  s: 4 },
              { sp: 'skull',    name: '검은 해골',  s: 4 } ],
      boss:   { sp: 'volcano',  name: '화산 거인',  s: 4 } },

    { name: '발사기지', dark: true,
      sky: ['#2c3d6b', '#4b5f96', '#7c86b4', '#c39ba0', '#f0c39a'],
      far: '#59657f', near: '#3b4358', ground: '#8d8f96', groundDark: '#5f6169',
      foes: [ { sp: 'agent',  name: '선글라스 요원', s: 4, tame: true },
              { sp: 'crate',  name: '수상한 상자',  s: 4 },
              { sp: 'barrel', name: '드럼통',      s: 4 } ],
      boss:   { sp: 'rocket', name: '로켓 로봇',    s: 4 } },

    { name: '우주', dark: true,
      sky: ['#05060f', '#080b1a', '#0c1128', '#101838', '#161f4a'],
      far: '#3a3550', near: '#5b5570', ground: '#6b6480', groundDark: '#474155',
      foes: [ { sp: 'alien',  name: '초록 외계인', s: 4, tame: true },
              { sp: 'ufo',    name: 'UFO',       s: 4 },
              { sp: 'planet', name: '꼬마 행성',  s: 3 } ],
      boss:   { sp: 'planet', name: '행성 왕',    s: 5 } },

    { name: '천국', dark: false,
      sky: ['#efd9ff', '#f9e2fa', '#ffe8f2', '#fff3ea', '#fffaf2'],
      far: '#ffe6f4', near: '#f7d9ef', ground: '#fdf6ff', groundDark: '#f2ddf7',
      foes: [ { sp: 'angel',  name: '장난꾸러기 천사', s: 4, tame: true },
              { sp: 'harp',   name: '혼자 울리는 하프', s: 4 },
              { sp: 'pillar', name: '구름 기둥',     s: 4 } ],
      boss:   { sp: 'star',   name: '별의 수호자',    s: 6 } },

    // 숨은 무대. 반년 만에 키를 다시 재서 자랐으면 이레 동안 열린다.
    // 세기는 도시쯤(tier 4)인데 보상은 두 배 — 기념이니까.
    { name: '뒷마당', dark: false, hidden: true, tier: 4,
      sky: ['#bfe4f7', '#cfe9fa', '#e2f3fb', '#f0f8f0', '#fff6e9'],
      far: '#8fd9c8', near: '#6cc7b3', ground: '#c79b6d', groundDark: '#a97b4f',
      foes: [ { sp: 'butterfly', name: '나비 떼',    s: 6, tame: true },
              { sp: 'balloon',   name: '도망간 풍선', s: 6 },
              { sp: 'cake',      name: '케이크 도둑', s: 4 } ],
      boss:   { sp: 'house',     name: '걸어 다니는 우리 집', s: 3 } },
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
      hp: Math.round((16 + tier * 14) * 2.6 * mul),
      atk: Math.max(1, Math.round(((3 + tier * 2) * 1.25 + 1) * mul)),
      xp: (14 + tier * 12) * 4 * bonus,
      gold: (5 + tier * 4) * 6 * bonus,
    };
  }

  // ---------- 한 번의 공격 ----------
  // kind: perfect(칸 한가운데) | good(칸 안) | miss(칸 밖) | skill(기술)
  // extra 는 자매 콤보 같은 곱.
  const HIT_MULT = { perfect: 1.7, good: 1.0, miss: 0.5, skill: 2.2 };
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
  const SKILL_COST = 3;                  // 기운 셋을 모으면 기술 하나
  const COMBO_MULT = 1.5;                // 같은 날 둘 다 모험하면 — 언니 동생 콤보
  const STREAK_FOR_FANFARE = 3;          // 완벽 타이밍 연속 셋이면 팡파르
  const TAME_WINS = 3;                   // 이만큼 이기면 친구가 된다
  const FRIEND_HEAL_MAX = 5;             // 친구 하나가 턴마다 체력 1, 최대 다섯
  const CHEER_HEAL = 0.15;               // 응원 요정이 채워 주는 체력 비율

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
    names: ['하늘 앵무', '왕병아리', '걸어 다니는 집', '이젤 유령', '왕나비'],
    sprites: [ { sp: 'budgieUp', s: 3 }, { sp: 'chick', s: 4 }, { sp: 'house', s: 2 }, { sp: 'easel', s: 2 }, { sp: 'butterfly', s: 8 } ],
    name: key => WEEK.names[weekIndex(key) % WEEK.names.length],
    sprite: key => WEEK.sprites[weekIndex(key) % WEEK.sprites.length],
  };

  function newSave(){
    return {
      v: 2, xp: 0, gold: 20, hp: null, potions: 1, weapon: 0, armor: 0, spentPaint: 0,
      wins: AREAS.map(() => 0), boss: AREAS.map(() => false),
      lastGift: '', fights: 0, lv: 1,
      week: { key: '', dmg: 0, day: '', swings: 0, claimed: false, hp: 0 },
      lastWeek: null,                     // 지난주 보스 기록 — 첫 화면 카드가 읽는다
      lastPlay: '',                       // 마지막으로 논 날 — 자매 콤보의 근거
      friends: [],                        // 친구가 된 상대 ('무대:번호')
      foeWins: {},                        // 상대마다 이긴 횟수 — 친구 되기용
      met: {},                            // 만난 상대 — 도감
      dexSkies: [],                       // 도감을 채운 무대의 하늘 — 올해의 카드 배경
      gear: { weapon: null, armor: null }, // 장비에 붙인 그림 ({ n, s })
      journalDay: '',                     // 모험 일지를 남긴 날 — 하루 한 편
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
  function friendsOf(save){
    return (save.friends || []).map(k => {
      const [a, j] = k.split(':').map(Number);
      return AREAS[a] && AREAS[a].foes[j] ? Object.assign({ key: k, area: a }, AREAS[a].foes[j]) : null;
    }).filter(Boolean);
  }

  return {
    HEROES, AREAS, REAL, SHOP, WEEK, TUNE_DEFAULT, HIT_MULT,
    SKILL_COST, WINS_FOR_BOSS, COMBO_MULT, STREAK_FOR_FANFARE, TAME_WINS, FRIEND_HEAL_MAX, CHEER_HEAL, HIDDEN_DAYS,
    levelOf, xpForLevel, realXp, stats, foeAt, bossAt, heroHit, foeHit, judge,
    weekKey, weekIndex, newSave, fixSave, fixTune, areaOpen, hiddenDaysLeft, dexDone, friendsOf,
  };
})();
if (typeof module !== 'undefined') module.exports = QUEST;
