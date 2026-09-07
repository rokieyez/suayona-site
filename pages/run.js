// 첫 화면의 「한 번 눌러 뛰기」 — pages/index.js 에서 떼어 냈다.
// 화면 한참 아래에 있는데 gzip 16KB 라, 스크롤 안 하고 나가는 사람에게는 통째로 낭비였다.
// index.js 가 그 자리가 다가올 때 받아 온다. 고전 스크립트라 index.js 의 최상위
// 이름(authOnce)과 pixel.js 의 SPRITES 를 그대로 쓴다.

// ================= 한 번 눌러 뛰기 =================
// 달리는 동안은 서버를 안 쓴다. 끝났을 때만 순위표를 한 번 읽고, 이름을 남기면
// 한 번 쓴다. 화면 밖이거나 탭이 가려지면 rAF 를 멈춰서 안 볼 때 배터리를 안 먹는다.
(function(){
  const canvas = document.getElementById('runCanvas');
  if (!canvas || typeof SPRITES === 'undefined') return;
  const ctx = canvas.getContext('2d');

  const GRAV     = 900;    // px/s^2
  const JUMP_V   = -300;   // 뛰어오르는 속도
  const PLAYER_X = 46;

  // 점프 4단계. 누른 시간을 그대로 쓰면 높이가 연속으로 변해서 「지금 몇 칸 뛴 건지」
  // 를 아이가 못 읽는다. 손을 뗀 시간을 네 칸 중 하나로 올려 맞춰, 같은 세기로 누르면
  // 늘 같은 높이가 나오게 했다. 실측 높이는 53 / 62 / 75 / 84px.
  // 첫 칸을 0 이 아니라 0.04 로 둔 건, 손을 떼는 순간이 아니라 「칸」 이 높이를
  // 정하게 하기 위해서다. 0 이면 1단계만 뗀 시점에 따라 48~53px 로 흔들렸다.
  const HOLD_TIERS = [0.04, 0.09, 0.175, 0.26];
  const HOLD_G     = 0.38;   // 누르는 동안의 중력 배수

  // 속도 10단계. 계속 조금씩 빨라지면 빨라지는 걸 못 느낀다. 계단으로 올리고
  // 올라갈 때 화면에 알려 준다. 한 계단이 곧 한 무대다.
  //
  // (2026-09-07) 너무 쉬웠다. 공룡 게임을 자로 대고 다시 맞췄다 — 그쪽은 360px/s 로
  // 시작해 2분에 걸쳐 780px/s 까지 올라가고, 600px 짜리 화면이라 가장 빠를 때 장애물을
  // 보고 0.77초 만에 넘어야 한다. 여기 캔버스는 폰에서 327px 이라 455px/s 면 0.72초 —
  // 거의 같은 촉박함이다(넓은 화면에서는 그만큼 여유가 있다). 계단 하나도 26초에서
  // 18초로 줄여, 열 무대를 다 보는 데 4분 20초가 아니라 3분이 걸리게 했다.
  const SPEEDS  = [190, 218, 246, 275, 305, 335, 366, 397, 428, 455];
  const LV_SECS = 18;        // 한 계단에 머무는 시간 → 열 무대를 다 보려면 3분
  // 마지막 무대에 닿아도 멈추지 않는다. 공룡 게임처럼 끝내 따라잡히도록,
  // 초마다 조금씩 더 빨라지고 사이도 조금씩 좁아진다(각각 바닥값에서 멈춘다).
  const OVER_ACC  = 1.2;     // 마지막 무대부터 초마다 더해지는 속도(px/s)
  const SPD_MAX   = 560;     // 그래도 여기서 멈춘다 — 폰 화면(327px)을 0.58초에 가로지른다
  const GAP_TIGHT = 0.0015;  // 마지막 무대부터 초마다 줄어드는 사이(초)
  const GAP_FLOOR = 0.66;    // 사이는 여기까지만 좁아진다

  // 단계마다 얼마나 자주, 얼마나 길게 나오는지.
  // 처음엔 드문드문 나와서 아이가 조작을 익히고, 뒤로 갈수록 촘촘해진다.
  //   gap  = 다음 무리까지 비워 두는 시간(초) — 작을수록 자주
  //   maxN = 한 무리에 이어 붙일 조각 수 상한 → 장애물 길이 5단계
  //   gem  = 하트가 딸려 나올 확률
  // (2026-09-07) gap 은 앞 무리가 지나간 뒤 비어 있는 시간이다. 공룡 게임은 이게
  // 0.48초(느릴 때)~0.38초(가장 빠를 때)인데, 그쪽 점프는 0.56초로 짧고 여기 점프는
  // 0.71~0.94초로 뜬다. 그대로 베끼면 내려서기도 전에 다음 것이 온다 —
  // 「내려서자마자 다시 누르면 넘어간다」가 되는 선까지만 좁혔다(끝 무대 0.74초).
  const PACE = {
    gap:  [2.1, 1.8, 1.55, 1.35, 1.2, 1.08, 0.98, 0.88, 0.80, 0.74],
    maxN: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    gem:  [0.22, 0.28, 0.34, 0.40, 0.46, 0.52, 0.58, 0.63, 0.68, 0.72],
  };

  // 무대마다 다른 장애물. 들판에 게가 나오고 바다에 버섯이 나오면 무대를 바꾼 보람이 없다.
  // hit 은 그림보다 판정을 안쪽으로 줄이는 값 — 도트 그림은 모서리가 비어 있어서
  // 그림 크기 그대로 맞으면 "안 닿았는데 죽었다"가 된다. 판정 너비를 8~20px 로
  // 맞춰 뒀다: 그림이 커도 실제로 걸리는 폭은 비슷해야 억울하지 않다.
  // 배경 장식과 같은 그림은 절대 쓰지 않는다 — 넘어야 할 것과 아닌 것이 헷갈린다.
  const STAGE_PIECES = [
    [ { sp: 'bush',   s: 3, hit: [3, 2] }, { sp: 'mushroom', s: 3, hit: [2, 1] },
      { sp: 'snail',  s: 3, hit: [2, 1] }, { sp: 'ladybug',  s: 3, hit: [2, 1] } ],
    [ { sp: 'rockS',  s: 3, hit: [2, 1] }, { sp: 'log',      s: 3, hit: [3, 1] },
      { sp: 'mushroom', s: 3, hit: [2, 1] } ],
    [ { sp: 'stone',  s: 3, hit: [3, 1] }, { sp: 'reed',     s: 2, hit: [1, 1] },
      { sp: 'snail',  s: 3, hit: [2, 1] } ],
    [ { sp: 'sandcastle', s: 3, hit: [3, 1] }, { sp: 'starfish', s: 3, hit: [2, 1] },
      { sp: 'crab',   s: 3, hit: [3, 1] } ],
    [ { sp: 'cone',   s: 3, hit: [1, 1] }, { sp: 'bin',      s: 2, hit: [2, 1] },
      { sp: 'bench',  s: 2, hit: [3, 1] } ],
    [ { sp: 'skull',  s: 3, hit: [2, 1] }, { sp: 'tumble',   s: 3, hit: [2, 1] },
      { sp: 'rockS',  s: 3, hit: [2, 1] } ],
    [ { sp: 'lavaRock', s: 3, hit: [3, 1] }, { sp: 'flame',  s: 3, hit: [1, 1] },
      { sp: 'rockS',  s: 3, hit: [2, 1],
        pal: { S: '#4a3f4a', T: '#372e36', U: '#261f27' } } ],
    [ { sp: 'agent',  s: 2, hit: [1, 1] }, { sp: 'barrel', s: 3, hit: [1, 1] },
      { sp: 'crate',  s: 3, hit: [1, 1] } ],
    [ { sp: 'alien',  s: 2, hit: [1, 1] }, { sp: 'ufo',    s: 3, hit: [2, 1] },
      { sp: 'rockS',  s: 3, hit: [2, 1],
        pal: { S: '#c9c2d6', T: '#a29ab5', U: '#7d7593' } } ],
    [ { sp: 'angel',  s: 2, hit: [2, 1] }, { sp: 'harp',   s: 2, hit: [1, 1] },
      { sp: 'pillar', s: 2, hit: [1, 1] } ],
  ];
  // 조각을 이어 붙여도 이 너비를 넘기지 않는다. 넘을 수 있어야 하기 때문이다 —
  // 제일 빠른 560px/s 에서 140px 무리를 지나는 데 0.25초가 걸리는데,
  // 제일 약한 1단 점프도 판정 높이(21px) 위에 0.56초 머문다.
  function groupMaxW(maxN){ return Math.min(140, 30 * maxN + 12); }

  // 수풀이 언덕과 같은 연두라 배경에 묻혔다. 장애물만 훨씬 진한 초록으로 바꾸고,
  // 아래에서 검은 테두리를 한 겹 깐다.
  const OBS_PAL = { j: '#3f7d3c', k: '#2f6b34', l: '#24522b' };
  const OUTLINE = {};
  function outlineCells(key){
    if (!OUTLINE[key]) OUTLINE[key] = outlineOf(SPRITES[key]);
    return OUTLINE[key];
  }

  // 하트 3단계. 땅에서 그냥 달리면 어느 것도 안 닿는다.
  //   낮은 것 1단, 가운데 1단(딱 맞게), 높은 것 2단 이상.
  const GEM_H = [58, 90, 118];

  // 별 — 하트 중 일부가 별로 바뀐다. 늘 제일 높은 자리(GEM_H[2])에만 나와서
  // 별을 먹으려면 4단 점프를 확실히 눌러야 한다. 먹으면 잠깐 안 다친다 —
  // 맞았을 때의 무적과 같은 시계를 쓴다(그래서 화면 표현도 그대로 재활용된다).
  const STAR_CHANCE = 0.12;   // 하트가 나올 자리 중 이 비율이 별로 바뀐다
  const SHIELD_SECS = 4;      // 별을 먹으면 이만큼 안 다친다

  // 목숨. 한 판에서 한 번까지 이어서 달릴 수 있다(2026-09-07 에 둘에서 하나로 —
  // 세 번을 부딪혀도 안 끝나니 판이 늘어지기만 했다. 공룡 게임은 한 번이면 끝이다).
  // 부딪히면 하나 깎이고 3초 동안 무적 — 그동안 반투명으로 깜빡인다.
  // 깎인 자리는 하트를 GEMS_PER_LIFE 개 모으면 한 칸 되돌아온다(최대 MAX_LIVES).
  const MAX_LIVES     = 1;
  const INVULN_SECS   = 3;
  const GEMS_PER_LIFE = 14;

  let W = 0, H = 0, GY = 0, dpr = 1;
  let state = 'ready';                 // ready | play | over
  // 달리는 동안만 캔버스 위 스크롤을 막는다. 늘 막아 두면 게임 화면에 손이
  // 닿는 순간 페이지가 붙어서 아래로 못 내려간다. 멈춰 있을 때는 평소대로 밀린다.
  function setState(v){
    state = v;
    canvas.style.touchAction = (v === 'play') ? 'none' : 'manipulation';
  }
  let who = 'sua';
  try { if (localStorage.getItem('sy.run.who') === 'yona') who = 'yona'; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  let best = 0;
  try { best = Math.max(0, parseInt(localStorage.getItem('sy.run.best') || '0', 10) || 0); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  let py = 0, vy = 0, onGround = true;
  let holdT = 0, holdCap = 0, jumpTier = 1;
  let dist = 0, hearts = 0, lv = 0, spd = SPEEDS[0], t = 0, nextAt = 0, lvFlash = 0;
  let lives = MAX_LIVES, gemStreak = 0, invulnUntil = -1, lifeFlash = 0, shieldFlash = 0;
  let obs = [], gems = [], raf = 0, last = 0, deadAt = 0, runBest = 0;

  function mixHex(a, b, k){
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const r = Math.round(((A >> 16) & 255) * (1 - k) + ((B >> 16) & 255) * k);
    const g = Math.round(((A >> 8)  & 255) * (1 - k) + ((B >> 8)  & 255) * k);
    const b2 = Math.round((A & 255)  * (1 - k) + (B & 255)  * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b2).toString(16).slice(1);
  }

  const spriteOf = () => SPRITES[who];
  const spriteH  = () => spriteOf().length;
  const score    = () => Math.floor(dist / 12) + hearts * 5;
  // 마지막 무대에 들어선 뒤로 흐른 시간. 그 뒤로도 계속 빨라지고 좁아지는 데 쓴다.
  const overSecs = () => Math.max(0, t - (SPEEDS.length - 1) * LV_SECS);
  const ceilOf   = () => GY - spriteH() - 20;

  function recordBest(){
    if (score() <= best) return;
    best = score();
    try { localStorage.setItem('sy.run.best', String(best)); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
  }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || 320;
    H = canvas.clientHeight || 190;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    GY = Math.round(H - 26);
    buildRainbow();
    if (state !== 'play') draw();
  }

  function reset(){
    py = 0; vy = 0; onGround = true; holdT = 0; holdCap = 0; jumpTier = 1;
    dist = 0; hearts = 0; t = 0; lv = 0; spd = SPEEDS[0]; lvFlash = 0;
    lives = MAX_LIVES; gemStreak = 0; invulnUntil = -1; lifeFlash = 0; shieldFlash = 0;
    deadAt = 0; runBest = best;
    obs = []; gems = []; nextAt = SPEEDS[0] * PACE.gap[0];
  }

  // ---- 무대 7곳 ----
  // 속도 단계와 무대를 한 몸으로 묶었다. 18초마다 배경이 통째로 바뀌니
  // 「빨라졌다」 를 숫자가 아니라 풍경으로 알게 된다. 뒤로 갈수록 하늘이
  // 어두워져서 마지막 화산에서는 밤이 된다.
  //   night 0~1 은 그 무대가 얼마나 어두운지 — 글씨색과 장애물 테두리를 여기서 뒤집는다.
  // 무지개 빛. 매 프레임 칸을 다 칠하면 fillRect 가 3천 번 넘게 든다 —
  // 크기가 바뀔 때 한 번 그려 두고 재사용한다. 배경은 화면 크기 말고는 변할 게 없다.
  const RB_COLORS = ['#ff9aa2', '#ffc78a', '#fff3a0', '#b7e8a8', '#a8d8f2', '#b9a3d6', '#f0aee0'];
  const rbLayer = document.createElement('canvas');
  function buildRainbow(){
    rbLayer.width = Math.max(1, Math.floor(W * dpr));
    rbLayer.height = Math.max(1, Math.floor(H * dpr));
    const g = rbLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const ax = W * 0.5, ay = -46;
    for (let y = 0; y < GY; y += CELL){
      const k = (y - ay) / (GY - ay);              // 0 꼭대기 → 1 지평선
      g.globalAlpha = 0.09 + 0.26 * k;             // 아래로 갈수록 진하게
      for (let x = 0; x < W; x += CELL){
        const rel = (x + CELL / 2 - ax) / (W * (0.16 + k * 0.92));
        const i = Math.floor(rel * 3.5) + 70;      // 음수 나머지를 피하려고 크게 더한다
        g.fillStyle = RB_COLORS[i % RB_COLORS.length];
        g.fillRect(x, y, CELL, CELL);
      }
    }
  }

  const STAGES = [
    { name: '들판',
      sky: ['#bfe4f7', '#a8d8f2', '#9ad0ef', '#cfe9fa', '#eaf3ea'],
      far:  { kind: 'hill',  color: '#a6cd91', edge: '#bcd9a8', amp: 12, wave: 90,  off: 26 },
      near: { kind: 'hill',  color: '#76b166', edge: '#8ec07b', amp: 8,  wave: 62,  off: 10 },
      ground: ['#dcc9a1', '#b79a6f', '#cab188'],
      deco: { sp: 'tree', s: 2, gap: 0.55, off: -6 },
      cloud: 1, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '산',
      sky: ['#a9cfe8', '#93c2e0', '#7fb5d8', '#c3ddec', '#e6eef2'],
      far:  { kind: 'peak',  color: '#8ba0b8', edge: '#c2d2e0', amp: 46, wave: 130, off: 22 },
      near: { kind: 'peak',  color: '#4c8f46', edge: '#66aa5d', amp: 22, wave: 74,  off: 8  },
      ground: ['#b5ada0', '#8a8377', '#9d9689'],
      deco: { sp: 'tree', s: 2, gap: 0.42, off: -6,
              pal: { j: '#2f6b34', k: '#255a2c', l: '#1f4c26', m: '#173a1d', n: '#12301a' } },
      cloud: 0.8, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '강',
      sky: ['#bfe4f7', '#a5d8f3', '#8ec9ee', '#d3ecfa', '#eef6f2'],
      far:  { kind: 'hill',  color: '#8ec07b', edge: '#a9d698', amp: 10, wave: 100, off: 36 },
      near: { kind: 'water', color: '#4a9ed6', edge: '#7cc0e8', amp: 0,  wave: 0,   off: 14 },
      ground: ['#cfc6ae', '#9b9280', '#b8b09a'],
      deco: { sp: 'flower', s: 3, gap: 0.6, off: -4 },
      cloud: 0.9, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '바다',
      sky: ['#cfeafc', '#a8dcf6', '#86cbef', '#dff0fb', '#f3f7ee'],
      far:  { kind: 'water', color: '#2f7fbe', edge: '#6cb7e0', amp: 0, wave: 0, off: 32 },
      near: { kind: 'water', color: '#1f6aa8', edge: '#4a9ed6', amp: 0, wave: 0, off: 12 },
      ground: ['#efe0bb', '#c9b58c', '#dccaa4'],
      deco: { sp: 'bird', s: 2, gap: 0.5, off: -78 },
      cloud: 1, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },

    { name: '도시',
      sky: ['#5a4a86', '#a05f86', '#ff8a5c', '#ffb877', '#ffd9a0'],
      far:  { kind: 'city',  color: '#6d8db0', edge: '#809fbf', amp: 54, wave: 30, off: 20 },
      near: { kind: 'city',  color: '#3f5470', edge: '#4d6484', amp: 34, wave: 22, off: 6  },
      ground: ['#6b6a72', '#45444c', '#575660'],
      deco: { sp: 'tower', s: 2, gap: 0.95, off: -4, back: true },
      cloud: 0.5, star: 0.2, glow: null, ember: 0, inkLight: 1, textLight: 1 },

    { name: '사막',
      sky: ['#33305e', '#6b4477', '#c2645f', '#e79a6a', '#f3c58c'],
      far:  { kind: 'hill',  color: '#a87a54', edge: '#c49468', amp: 16, wave: 110, off: 24 },
      near: { kind: 'hill',  color: '#c9a06a', edge: '#dfb87f', amp: 10, wave: 70,  off: 8  },
      ground: ['#e0bd85', '#b18a5a', '#cfa771'],
      deco: { sp: 'cactus', s: 2, gap: 0.55, off: 0 },
      cloud: 0.25, star: 0.55, glow: null, ember: 0, inkLight: 0, textLight: 1 },

    { name: '화산',
      sky: ['#120c1c', '#1d1026', '#331331', '#5a1a2c', '#8a2a22'],
      far:  { kind: 'peak',  color: '#2b2230', edge: '#3d2f3c', amp: 50, wave: 136, off: 22 },
      near: { kind: 'peak',  color: '#191320', edge: '#2a2029', amp: 24, wave: 78,  off: 8  },
      ground: ['#2a2228', '#151016', '#3a2f33'],
      deco: { sp: 'volcano', s: 3, gap: 0.8, off: -6, back: true },
      cloud: 0.15, star: 1, glow: '#ff6a2a', ember: 1, inkLight: 1, textLight: 1 },

    { name: '발사기지',
      sky: ['#2c3d6b', '#4b5f96', '#7c86b4', '#c39ba0', '#f0c39a'],
      far:  { kind: 'city',  color: '#59657f', edge: '#6f7c96', amp: 26, wave: 26, off: 22, lit: 0.2 },
      near: { kind: 'hill',  color: '#3b4358', edge: '#4b5468', amp: 6,  wave: 120, off: 8 },
      ground: ['#8d8f96', '#5f6169', '#787a82'],
      deco: { sp: 'rocket', s: 2, gap: 0.9, off: -8, back: true },
      // 도시와 닮아 보이던 무대라, 아주 먼 곳으로 우주왕복선 발사대를 천천히 흘린다.
      // 격납고보다 뒤·느리게(0.045배) 지나가서 멀리 있는 것처럼 보인다.
      // 색은 대기에 씻긴 회청색으로 눌렀다 — 앞쪽 건물보다 진하면 가까워 보인다.
      // off 를 음수로 둬서 격납고 지붕 위로 솟게 한다. 지면에 맞춰 놓았더니
      // 건물에 통째로 가려 한 번도 안 보였다.
      bg2: { sp: 'launchPad', s: 2, gap: 1.4, off: -30, speed: 0.045,
             pal: { S: '#7f89a2', T: '#727c95', U: '#616b84',
                    E: '#aeb6c8', o: '#98858e', H: '#8e7681', W: '#9b8791' } },
      cloud: 0.4, star: 0.35, glow: null, ember: 0, inkLight: 1, textLight: 1 },

    { name: '우주',
      sky: ['#05060f', '#080b1a', '#0c1128', '#101838', '#161f4a'],
      far:  { kind: 'peak',  color: '#3a3550', edge: '#4d4668', amp: 34, wave: 120, off: 22 },
      near: { kind: 'hill',  color: '#5b5570', edge: '#736c8c', amp: 8,  wave: 70,  off: 8 },
      ground: ['#6b6480', '#474155', '#5a5470'],
      deco: { sp: 'planet', s: 2, gap: 0.95, off: -46, back: true },
      cloud: 0, star: 1, glow: null, ember: 0, inkLight: 1, textLight: 1 },

    // 천국만 다른 규칙으로 그린다. 언덕도 흙길도 없다 —
    // 무지개 빛이 하늘에서 아래로 퍼지고, 땅은 구름 바다다.
    { name: '천국',
      sky: ['#efd9ff', '#f9e2fa', '#ffe8f2', '#fff3ea', '#fffaf2'],
      far:  { kind: 'cloudsea', color: '#ffe6f4', edge: '#ffffff', amp: 16, wave: 96, off: 36 },
      near: { kind: 'cloudsea', color: '#f7d9ef', edge: '#fff8fd', amp: 11, wave: 60, off: 12 },
      ground: ['#fdf6ff', '#f2ddf7', '#ffffff'],
      groundKind: 'cloud',
      rainbow: true,
      deco: null,
      // 아주 먼 곳 둘 — 흰 옷을 길게 늘어뜨린 사람과, 빛나는 황금성.
      // 서로 다른 속도로 흘러서 깊이가 생긴다.
      bg2: [
        { sp: 'walker',   s: 2, gap: 2.4, off: -26, speed: 0.030,
          pal: { E: '#ffffff', S: '#f0e2f6', O: '#c9a98f', N: '#ffeede', G: '#ffe66d' } },
        // 구름 위 높은 곳에 띄운다. 지면에 맞추면 구름 바다에 가려 안 보이고,
        // 크게 키우면 저 멀리가 아니라 눈앞에 있는 것처럼 보인다.
        { sp: 'goldCity', s: 2, gap: 2.4, off: -76, speed: 0.018 },
      ],
      cloud: 1, star: 0, glow: null, ember: 0, inkLight: 0, textLight: 0 },
  ];
  const XFADE = 4;           // 무대가 겹쳐 넘어가는 시간(초)

  // 별자리는 매번 새로 뽑으면 밤하늘이 지글거린다. 한 번 정해 두고 쓴다.
  const STARS = [];
  for (let i = 0; i < 36; i++)
    STARS.push({ x: ((i * 137.5) % 100) / 100, y: ((i * 61.8) % 46) / 100, p: (i * 2.4) % 6.28 });

  function stageMix(){
    const i = Math.min(STAGES.length - 1, lv);
    if (i >= STAGES.length - 1) return { a: STAGES[i], b: null, w: 0 };
    const into = (t - (i + 1) * LV_SECS + XFADE) / XFADE;   // 다음 단계 4초 전부터
    return { a: STAGES[i], b: STAGES[i + 1], w: Math.min(1, Math.max(0, into)) };
  }
  // 하늘이 어두우면 글씨를, 땅이 어두우면 장애물 테두리를 밝게 뒤집는다.
  // 둘을 따로 두는 이유는 사막이다 — 하늘은 보랏빛으로 어두운데 땅은 모래라 밝다.
  // 겹치는 4초 동안은 절반을 넘어설 때 한 번에 바꾼다. 중간색으로 섞으면
  // 회색이 되어 어느 쪽에서도 안 읽힌다.
  function flagNow(key){
    const m = stageMix();
    return (m.b && m.w > 0.5 ? m.b : m.a)[key];
  }

  // ---- 무대 한 겹 그리기 ----
  // 도트 화면에서 부드러운 곡선은 혼자 겉돈다. 전부 4px 격자에 맞춰 기둥으로 세운다.
  const CELL = 4;
  function bandY(L, x, off){
    const u = x + off;
    if (L.kind === 'peak'){
      // 삼각파 — 언덕보다 뾰족해서 산으로 읽힌다
      const w = L.wave || 100;
      const tri = 1 - Math.abs(((u / w) % 2 + 2) % 2 - 1);
      return GY - L.off - tri * L.amp - Math.sin(u / (w * 0.23)) * L.amp * 0.12;
    }
    return GY - L.off - Math.sin(u / L.wave) * L.amp
                      - Math.sin(u / (L.wave * 0.41)) * L.amp * 0.35;
  }

  function paintBand(L, off){
    if (L.kind === 'water'){
      const top = Math.round((GY - L.off) / CELL) * CELL;
      ctx.fillStyle = L.color; ctx.fillRect(0, top, W, H - top);
      ctx.fillStyle = L.edge;  ctx.fillRect(0, top, W, CELL);
      // 물결 — 흐르는 게 보여야 물로 읽힌다
      for (let i = 0; i < 12; i++){
        const wx = W - ((off * 0.6 + i * 61) % (W + 60)) + 30;
        ctx.fillRect(Math.round(wx / CELL) * CELL, top + CELL * (2 + (i % 3)), CELL * 3, CELL);
      }
      return;
    }
    if (L.kind === 'cloudsea'){
      // 언덕처럼 한 겹으로 칠하되 능선을 세 겹 사인으로 울퉁불퉁하게 만들고,
      // 꼭대기에 밝은 단을 두 칸 얹어 뭉게뭉게 보이게 한다.
      for (let x = 0; x < W; x += CELL){
        const u = x + off;
        const raw = GY - L.off
          - Math.sin(u / L.wave) * L.amp
          - Math.sin(u / (L.wave * 0.33)) * L.amp * 0.5
          - Math.sin(u / (L.wave * 0.13)) * L.amp * 0.25;
        const y = Math.round(raw / CELL) * CELL;
        ctx.fillStyle = L.edge;  ctx.fillRect(x, y, CELL, CELL * 2);
        ctx.fillStyle = L.color; ctx.fillRect(x, y + CELL * 2, CELL, H - y - CELL * 2);
      }
      return;
    }
    if (L.kind === 'city'){
      // 블록 하나가 건물 하나. 높이는 자리에서 뽑아 늘 같은 스카이라인이 나온다.
      const bw = CELL * 7;
      const start = Math.floor(off / bw);
      for (let n = 0; n <= Math.ceil(W / bw) + 1; n++){
        const idx = start + n;
        const h = 18 + (Math.abs(Math.sin(idx * 12.9898) * 43758.5453) % 1) * L.amp;
        const x = Math.round((n * bw - (off % bw)) / CELL) * CELL;
        const y = Math.round((GY - L.off - h) / CELL) * CELL;
        ctx.fillStyle = L.color; ctx.fillRect(x, y, bw - CELL, H - y);
        ctx.fillStyle = L.edge;  ctx.fillRect(x, y, bw - CELL, CELL);
        // 창문 — 몇 개만 켠다. lit 이 낮으면 드문드문해서 격납고처럼 보인다.
        const lit = L.lit === undefined ? 0.62 : L.lit;
        for (let r = y + CELL * 2; r < GY - L.off - CELL; r += CELL * 3)
          for (let c = x + CELL; c < x + bw - CELL * 2; c += CELL * 2)
            if ((Math.abs(Math.sin((idx * 31 + r * 7 + c) * 0.7)) > 1 - lit)){
              ctx.fillStyle = '#ffd979'; ctx.fillRect(c, r, CELL, CELL);
            }
      }
      return;
    }
    for (let x = 0; x < W; x += CELL){
      const y = Math.round(bandY(L, x, off) / CELL) * CELL;
      ctx.fillStyle = L.edge;  ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = L.color; ctx.fillRect(x, y + CELL, CELL, H - y - CELL);
    }
  }

  function paintStage(st, alpha){
    ctx.save();
    ctx.globalAlpha = alpha;

    // 하늘 — 띠로 나눈다. 매끈한 그러데이션은 도트와 안 어울린다.
    const n = st.sky.length;
    for (let i = 0; i < n; i++){
      ctx.fillStyle = st.sky[i];
      ctx.fillRect(0, Math.round(GY * i / n), W, Math.ceil(GY / n) + 1);
    }

    // 무지개 빛 — 하늘 꼭대기 한 점에서 아래로 부챗살처럼 퍼진다
    if (st.rainbow) ctx.drawImage(rbLayer, 0, 0, W, H);

    if (st.star > 0){
      ctx.fillStyle = '#fff8e0';
      STARS.forEach((s2, i) => {
        ctx.globalAlpha = alpha * st.star * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.6 + s2.p)));
        ctx.fillRect(Math.round(s2.x * W / 2) * 2, Math.round(s2.y * GY / 2) * 2, 2, 2);
      });
      ctx.globalAlpha = alpha;
      if (st.star > 0.5){          // 달 — 별이 충분히 밝을 때만
        const mx = Math.round(W * 0.78), my = 30, r = 11;
        ctx.fillStyle = '#f6f1d8';
        for (let dy = -r; dy <= r; dy += 3)
          for (let dx = -r; dx <= r; dx += 3)
            if (dx * dx + dy * dy <= r * r) ctx.fillRect(mx + dx, my + dy, 3, 3);
        ctx.fillStyle = 'rgba(200,192,158,.6)';
        ctx.fillRect(mx - 5, my - 4, 6, 6); ctx.fillRect(mx + 2, my + 3, 4, 4);
      }
    }

    // 아주 먼 곳 — 언덕보다도 뒤에서, 언덕보다도 느리게 지나간다.
    // 하나만 쓰는 무대(발사기지)와 둘을 겹치는 무대(천국)가 있어 배열도 받는다.
    if (st.bg2){
      const list = Array.isArray(st.bg2) ? st.bg2 : [st.bg2];
      list.forEach(b => {
        const bsp = SPRITES[b.sp];
        if (!bsp) return;
        const bw = bsp[0].length * b.s, bh = bsp.length * b.s;
        const bgap = Math.max(bw + 120, W * (b.gap || 1.4));
        for (let i = 0; i < 3; i++){
          const bx = W - ((dist * (b.speed || 0.05) + i * bgap) % (W + bgap + bw)) + bw;
          drawSprite(ctx, bsp, Math.round(bx / 2) * 2, GY - bh + (b.off || 0), b.s, b.pal);
        }
      });
    }

    if (st.cloud > 0){
      ctx.globalAlpha = alpha * st.cloud;
      const cw = SPRITES.cloudS[0].length * 2;
      const gap = Math.max(140, W / 2);
      for (let i = 0; i < 4; i++){
        const cx = W - ((dist * 0.06 + i * gap) % (W + cw * 2)) + cw;
        drawSprite(ctx, SPRITES.cloudS, Math.round(cx / 2) * 2, 10 + (i % 2) * 16, 2);
      }
      ctx.globalAlpha = alpha;
    }

    // 화산 — 지평선이 벌겋게 달아오른다
    if (st.glow){
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = st.glow;
      for (let i = 0; i < 7; i++){
        ctx.globalAlpha = alpha * 0.09 * (7 - i) / 7;
        ctx.fillRect(0, GY - 30 - i * CELL, W, CELL);
      }
      ctx.globalAlpha = alpha;
    }

    // 무대마다 다른 장식이 흘러간다 — 뒤쪽이 흐르는 게 보여야 달리는 느낌이 난다.
    // 큰 것(남산타워·화산)은 앞 능선 뒤에 세운다. 땅 위에 서면 장애물로 보인다.
    const d = st.deco;
    function paintDeco(){
      if (!d || !SPRITES[d.sp]) return;
      const sp = SPRITES[d.sp], dw = sp[0].length * d.s, dh = sp.length * d.s;
      const gap = Math.max(dw + 40, W * d.gap);
      for (let i = 0; i < 4; i++){
        const dx = W - ((dist * 0.34 + i * gap) % (W + gap)) + dw;
        drawSprite(ctx, sp, Math.round(dx / 2) * 2, GY - dh + d.off, d.s, d.pal);
      }
    }

    paintBand(st.far, dist * 0.12);
    if (d && d.back) paintDeco();
    paintBand(st.near, dist * 0.26);
    if (!d || !d.back) paintDeco();

    // 땅
    ctx.fillStyle = st.ground[0]; ctx.fillRect(0, GY, W, H - GY);
    if (st.groundKind === 'cloud'){
      // 흙길 대신 구름 바닥. 지평선을 울퉁불퉁하게 만들고 빛 알갱이를 흘린다.
      ctx.fillStyle = st.ground[1];
      for (let x = 0; x < W; x += CELL){
        const b = Math.sin((x + dist) / 23) + Math.sin((x + dist) / 9);
        ctx.fillRect(x, GY - CELL * (b > 0.8 ? 2 : (b > -0.4 ? 1 : 0)), CELL, CELL * 3);
      }
      ctx.fillStyle = st.ground[2];
      for (let i = 0; i < 20; i++){
        const gx = W - ((dist + i * 41) % (W + 40)) + 20;
        ctx.fillRect(Math.round(gx / CELL) * CELL, GY + 7 + (i % 4) * 5, CELL, CELL);
      }
    } else {
      ctx.fillStyle = st.ground[1]; ctx.fillRect(0, GY, W, CELL);
      ctx.fillStyle = st.ground[2];
      for (let i = 0; i < 16; i++){
        const gx = W - ((dist + i * 53) % (W + 40)) + 20;
        ctx.fillRect(Math.round(gx / CELL) * CELL, GY + 8 + (i % 3) * 5, CELL, CELL);
      }
    }

    // 불티 — 화산에서만 떠오른다
    if (st.ember > 0){
      for (let i = 0; i < 18; i++){
        const ex = (i * 89 + Math.sin(i) * 40) % W;
        const ey = GY - ((t * 26 + i * 37) % (GY * 0.8));
        ctx.globalAlpha = alpha * st.ember * (ey / GY) * 0.9;
        ctx.fillStyle = i % 3 ? '#ff8a3c' : '#ffd979';
        ctx.fillRect(Math.round(ex / 2) * 2, Math.round(ey / 2) * 2, 2, 2);
      }
    }
    ctx.restore();
  }

  function drawBg(){
    const m = stageMix();
    paintStage(m.a, 1);
    if (m.b && m.w > 0) paintStage(m.b, m.w);   // 4초 동안 겹쳐서 넘어간다
  }

  function playerBox(){
    const sp = spriteOf();
    return { x: PLAYER_X + 11, y: GY - sp.length - py + 3, w: sp[0].length - 22, h: sp.length - 3 };
  }
  function hitBox(o){
    const sp = SPRITES[o.sp], w = sp[0].length * o.s, h = sp.length * o.s;
    return { x: o.x + o.hit[0] * o.s, y: GY - h + o.hit[1] * o.s,
             w: w - o.hit[0] * o.s * 2, h: h - o.hit[1] * o.s };
  }
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function drawObs(o, ink){
    const sp = SPRITES[o.sp], x = Math.round(o.x), y = GY - sp.length * o.s;
    ctx.fillStyle = ink;
    outlineCells(o.sp).forEach(c =>
      ctx.fillRect(x + c[0] * o.s - 2, y + c[1] * o.s - 2, o.s + 4, o.s + 4));
    drawSprite(ctx, sp, x, y, o.s, o.pal ? Object.assign({}, OBS_PAL, o.pal) : OBS_PAL);
  }

  function drawPlayer(){
    const sp = spriteOf(), h = sp.length, w = sp[0].length;
    const x = PLAYER_X, y = GY - h - py;
    // 그림자 — 발이 땅에서 떨어진 걸 알려준다
    const sh = Math.max(0.25, 1 - py / 70);
    ctx.fillStyle = (flagNow('inkLight') ? 'rgba(255,240,210,' : 'rgba(63,50,38,') +
      (0.22 * sh).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, GY + 3, (w / 2.6) * sh, 3.2 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    // 달릴 때 1px 씩 위아래로 — 도트에서는 이만큼만으로도 뛰는 것처럼 보인다
    const bob = (state === 'play' && onGround && Math.floor(t * 9) % 2) ? 1 : 0;
    // 무적일 때는 반투명으로 깜빡인다. 색을 바꾸지 않고 투명도만 흔드는 편이
    // 도트 그림을 덜 망가뜨린다.
    const inv = state === 'play' && t < invulnUntil;
    if (inv) ctx.globalAlpha = Math.floor(t * 9) % 2 ? 0.28 : 0.72;
    drawSprite(ctx, sp, x, Math.round(y + bob), 1);
    if (inv) ctx.globalAlpha = 1;

    // 점프 세기 — 머리 위 네 칸. 몇 단으로 뛴 건지 눈으로 보여야 4단계가 의미가 있다.
    if (state === 'play' && !onGround){
      for (let i = 0; i < 4; i++){
        ctx.fillStyle = i < jumpTier ? '#ff6b6b' : 'rgba(255,255,255,.6)';
        ctx.fillRect(x + 5 + i * 9, Math.round(y) - 11, 7, 7);
      }
    }
  }

  // 배경과 겹쳐도 읽히게 테두리를 두르고 찍는다. 무대가 어두워지면 글씨와
  // 테두리를 서로 바꾼다 — 밤하늘 위의 검은 글씨는 안 보인다.
  function inkNow(){ return flagNow('inkLight') ? '#f4eede' : '#241f16'; }
  function textPair(){
    return flagNow('textLight')
      ? { fill: '#fdf7e8', line: 'rgba(12,10,20,.9)' }
      : { fill: '#3a3226', line: 'rgba(255,255,255,.85)' };
  }
  function label(text, y, size, soft){
    const c = textPair();
    ctx.font = '800 ' + size + 'px Suayona Dot, Suayona Sans, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = c.line;
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = soft ? mixHex(c.fill, '#8b8272', 0.5) : c.fill;
    ctx.fillText(text, W / 2, y);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  function hud(text, x, y, size, align){
    const c = textPair();
    ctx.font = '800 ' + size + 'px Suayona Dot, Suayona Sans, sans-serif';
    ctx.textAlign = align || 'start';
    ctx.lineWidth = 4; ctx.strokeStyle = c.line; ctx.strokeText(text, x, y);
    ctx.fillStyle = c.fill; ctx.fillText(text, x, y);
    ctx.textAlign = 'start';
  }

  function draw(){
    drawBg();
    const ink = inkNow();
    obs.forEach(o => drawObs(o, ink));
    gems.forEach(gm => drawSprite(ctx, gm.star ? SPRITES.star : SPRITES.heart, Math.round(gm.x),
      Math.round(gm.y + Math.sin(t * 5 + gm.p) * 3), 3));
    drawPlayer();

    // 목숨 — 점수 왼쪽에 하트 MAX_LIVES 칸(지금은 한 칸). 깎인 칸은 투명하게 남겨 둔다.
    for (let i = 0; i < MAX_LIVES; i++){
      const on = i < lives;
      ctx.globalAlpha = on ? (lifeFlash > 0 && Math.floor(t * 10) % 2 ? 0.4 : 1) : 0.22;
      drawSprite(ctx, SPRITES.heart, 9 + i * 17, 11, 2);
    }
    ctx.globalAlpha = 1;
    const LX = 9 + MAX_LIVES * 17 + 6;
    hud(String(score()).padStart(4, '0'), LX, 20, 13);
    if (best) hud('BEST ' + best, LX, 36, 11);
    // 목숨이 비어 있을 때만 「몇 개 더 모으면 되는지」를 알려 준다
    if (lives < MAX_LIVES) hud(gemStreak + '/' + GEMS_PER_LIFE, 9, 36, 11);
    hud('LV' + (lv + 1), W - 10, 20, 13, 'end');
    if (hearts){
      drawSprite(ctx, SPRITES.heart, W - 42, 27, 2);
      hud('x' + hearts, W - 10, 36, 11, 'end');
    }

    if (lvFlash > 0)
      label(STAGES[lv].name + ' · 속도 ' + (lv + 1) + '단계!', H * 0.24, 15);
    else if (shieldFlash > 0)
      label('✨ 방패! ' + SHIELD_SECS + '초 동안 안 다쳐요', H * 0.24, 15);
    else if (lifeFlash > 0)
      label(t < invulnUntil ? '앗! 목숨 ' + lives + '개 남았어요' : '목숨 하나 되찾았어요!',
        H * 0.24, 15);
    if (state === 'ready') label('눌러서 시작', H * 0.44, 17);
    if (state === 'over'){
      label(score() + '점' + (score() > runBest ? ' · 최고 기록!' : ''), H * 0.36, 17);
      label('한 번 더 누르기', H * 0.36 + 22, 13, true);
    }
  }

  function spawn(){
    // 조각 수를 1~3 으로 이어 붙여 장애물 길이를 세 단계로 만든다.
    // 처음부터 긴 게 나오면 아이가 금방 포기하니 속도 단계에 맞춰 늘린다.
    // 마지막 무대에 오래 머물수록 사이가 조금씩 좁아진다(GAP_FLOOR 에서 멈춘다)
    const gap = Math.max(GAP_FLOOR, PACE.gap[lv] - overSecs() * GAP_TIGHT);
    const pace = { gap: gap, maxN: PACE.maxN[lv], gem: PACE.gem[lv] };
    const n = 1 + Math.floor(Math.random() * pace.maxN);
    const cap = groupMaxW(pace.maxN);
    const pool = STAGE_PIECES[Math.min(STAGE_PIECES.length - 1, lv)];
    const x0 = W + 10;
    let wide = 0;
    for (let i = 0; i < n; i++){
      const p = pool[Math.floor(Math.random() * pool.length)];
      const w = SPRITES[p.sp][0].length * p.s;
      if (wide + w > cap) break;
      obs.push({ sp: p.sp, s: p.s, hit: p.hit, pal: p.pal, x: x0 + wide });
      wide += w + 4 + Math.floor(Math.random() * 5);   // 겹치지 않게 조금 띄운다
    }
    // 하트는 낮은 것과 높은 것. 높은 건 2단 이상 눌러야 닿아서, 먹으려면
    // 「얼마나 세게 누를까」 를 한 번 고르게 된다.
    if (Math.random() < pace.gem){
      const isStar = Math.random() < STAR_CHANCE;
      const h = isStar ? GEM_H[2] : GEM_H[Math.floor(Math.random() * GEM_H.length)];
      gems.push({ x: x0 + wide + 90 + Math.random() * 90,
                  y: GY - h, p: Math.random() * 6, star: isStar });
    }
    nextAt = wide + spd * (pace.gap * (0.85 + Math.random() * 0.4));
  }

  function step(ts){
    raf = requestAnimationFrame(step);
    const dt = Math.max(0, Math.min(0.05, (ts - last) / 1000 || 0));   // 시계가 뒤로 가면 0
    last = ts;

    if (state === 'play'){
      t += dt;
      const nl = Math.min(SPEEDS.length - 1, Math.floor(t / LV_SECS));
      if (nl !== lv){ lv = nl; spd = SPEEDS[lv]; lvFlash = 1.4; sfx('pop'); }
      // 마지막 무대에서는 계단이 없으니 여기서 계속 조금씩 밀어 올린다
      if (lv === SPEEDS.length - 1) spd = Math.min(SPD_MAX, SPEEDS[lv] + overSecs() * OVER_ACC);
      if (lvFlash > 0) lvFlash -= dt;
      if (lifeFlash > 0) lifeFlash -= dt;
      if (shieldFlash > 0) shieldFlash -= dt;
      const move = spd * dt;
      dist += move;

      // 누르고 있는 동안엔 중력을 덜 받는다. holdCap 은 손을 뗄 때 네 칸 중
      // 하나로 올려 맞춘 값이라, 같은 세기로 누르면 늘 같은 높이가 나온다.
      if (!onGround) holdT += dt;
      const g = (vy < 0 && holdT < holdCap) ? GRAV * HOLD_G : GRAV;
      vy += g * dt;
      py -= vy * dt;
      const ceil = ceilOf();
      if (py > ceil){ py = ceil; vy = 0; }
      if (py <= 0){ py = 0; vy = 0; onGround = true; } else onGround = false;

      nextAt -= move;
      if (nextAt <= 0) spawn();
      obs.forEach(o => { o.x -= move; });
      gems.forEach(gm => { gm.x -= move; });
      obs = obs.filter(o => o.x > -160);
      gems = gems.filter(gm => gm.x > -40);

      const pb = playerBox();
      for (const gm of gems){
        const gw = gm.star ? 27 : 21;                    // 별(9px×3)이 하트(7px×3)보다 넓다
        if (!gm.got && overlap(pb, { x: gm.x + (gw - 15) / 2, y: gm.y, w: 15, h: 18 })){
          gm.got = true; gm.x = -99; hearts++;
          if (gm.star){
            invulnUntil = Math.max(invulnUntil, t + SHIELD_SECS);
            shieldFlash = 1.6; sfx('fanfare');
          } else {
            sfx('sparkle');
            if (lives < MAX_LIVES && ++gemStreak >= GEMS_PER_LIFE){
              lives++; gemStreak = 0; lifeFlash = 1.6; sfx('fanfare');
            }
          }
        }
      }
      if (t >= invulnUntil){
        for (const o of obs){
          if (!overlap(pb, hitBox(o))) continue;
          if (lives > 0){
            // 아직 목숨이 남았으면 판이 이어진다. 점수도 무대도 그대로 간다.
            lives--; gemStreak = 0; invulnUntil = t + INVULN_SECS;
            lifeFlash = 1.4; sfx('thud');
          } else {
            setState('over'); deadAt = performance.now(); sfx('thud'); recordBest();
            offerSave();
          }
          break;
        }
      }
    }

    draw();
    if (state === 'over') stop();     // 죽은 화면은 한 장이면 된다
  }

  function start(){ last = performance.now(); if (!raf) raf = requestAnimationFrame(step); }
  function stop(){
    if (state === 'play') recordBest();   // 멈춘 김에 여기까지의 기록은 남긴다
    if (raf) cancelAnimationFrame(raf); raf = 0;
  }

  function tierOf(h){
    for (let i = 0; i < HOLD_TIERS.length; i++) if (h <= HOLD_TIERS[i]) return i;
    return HOLD_TIERS.length - 1;
  }
  function release(){
    if (!onGround && vy < 0){
      holdCap = HOLD_TIERS[tierOf(holdT)];
      jumpTier = tierOf(holdT) + 1;
    }
  }

  function jump(){
    if (state === 'ready'){ reset(); setState('play'); start(); sfx('boing'); return; }
    if (state === 'over'){
      if (performance.now() - deadAt < 400) return;   // 죽자마자 눌린 건 재시작으로 안 센다
      hideSave(); reset(); setState('play'); start(); sfx('boing'); return;
    }
    if (onGround){
      vy = JUMP_V; py = 0.01; onGround = false;
      holdT = 0; holdCap = HOLD_TIERS[HOLD_TIERS.length - 1]; jumpTier = 4;
      sfx('boing');
    }
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.focus({ preventScroll: true });
    jump();
  });
  // touch-action 을 늦게 받아들인 옛 사파리가 있어 한 겹 더 막는다.
  // passive:false 가 없으면 preventDefault 가 무시된다.
  canvas.addEventListener('touchmove', e => {
    if (state === 'play') e.preventDefault();
  }, { passive: false });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  const JUMP_KEYS = [' ', 'Spacebar', 'ArrowUp', 'Enter'];
  canvas.addEventListener('keydown', e => {
    if (JUMP_KEYS.indexOf(e.key) < 0) return;
    e.preventDefault();
    if (!e.repeat){ jump(); }
  });
  canvas.addEventListener('keyup', e => { if (JUMP_KEYS.indexOf(e.key) >= 0) release(); });
  canvas.addEventListener('blur', release);

  document.querySelectorAll('#runWho button').forEach(b => {
    b.classList.toggle('on', b.dataset.who === who);
    b.addEventListener('click', () => {
      who = b.dataset.who;
      try { localStorage.setItem('sy.run.who', who); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
      document.querySelectorAll('#runWho button').forEach(x => x.classList.toggle('on', x === b));
      if (state !== 'play') draw();
    });
  });
  // 지우기는 부모만. 아이가 실수로 눌러 서로의 기록을 날리는 일이 실제로 생긴다.
  // 지우는 건 이 브라우저의 BEST 뿐이다 — 명예의 전당은 건드리지 않는다.
  const resetBtn = document.getElementById('runReset');
  resetBtn.addEventListener('click', () => {
    best = 0;
    try { localStorage.removeItem('sy.run.best'); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    if (state !== 'play') draw();
  });
  // 이 한 줄이 던지면 게임 전체가 안 뜬다. 바깥에서 오는 이름이라 조심스럽게 만진다.
  Promise.resolve(typeof authOnce === 'undefined' ? null : authOnce)
    .then(() => { if (typeof isAdmin !== 'undefined' && isAdmin) resetBtn.hidden = false; })
    .catch(() => {});

  // ---- 명예의 전당 ----
  // 달리는 동안엔 서버를 안 부른다. 처음 화면에 들어올 때 한 번 읽고,
  // 이름을 남길 때 한 번 쓰고 다시 읽는다.
  const saveBox  = document.getElementById('runSave');
  const topBox   = document.getElementById('runTop');
  const topList  = document.getElementById('runTopList');
  const nameIn   = document.getElementById('runName');
  const sendBtn  = document.getElementById('runSend');
  const saveMsg  = document.getElementById('runMsg');
  let savedId = null;
  let when = 'all';
  const topRows  = { all: null, week: null };   // 탭마다 받아 둔 줄
  const topCache = {};                          // 탭마다 한 번씩만 받는다
  let weekAsked = false;                        // 저장 여부를 정하려고 한 번만 더 받는다
  try { nameIn.value = localStorage.getItem('sy.run.name') || ''; } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }

  function renderTop(){
    document.querySelectorAll('#runWhen button')
      .forEach(b => b.classList.toggle('on', b.dataset.when === when));
    const rows = topRows[when];
    // 아직 안 받았으면 표를 감추는 대신 자리를 남긴다. 탭을 누를 때마다 상자가
    // 통째로 사라졌다 나타나면 누른 것이 취소된 것처럼 보인다.
    if (!rows){
      if (!topBox.hidden) topList.innerHTML = '<li><span class="nm">불러오는 중…</span></li>';
      return;
    }
    if (!rows.length){
      topList.innerHTML = '<li><span class="nm">' +
        (when === 'week' ? '이번 주엔 아직 아무도 안 남겼어요' : '아직 아무도 안 남겼어요') +
        '</span></li>';
      topBox.hidden = false;
      return;
    }
    topList.innerHTML = rows.map((r, i) =>
      '<li' + (r.id === savedId ? ' class="me"' : '') + '>' +
        '<span class="rk">' + (i + 1) + '위</span>' +
        '<span class="nm">' + escapeHTML(r.name) + '</span>' +
        '<span class="sc">' + Number(r.score) + '</span>' +
      '</li>').join('');
    topBox.hidden = false;
  }

  // 이번 주는 월요일부터. 「지난주 기록을 못 깬다」로 끝나지 않게 매주 새로 겨룬다.
  function weekStart(){
    const d = new Date();
    const back = (d.getDay() + 6) % 7;                 // 월요일까지 며칠 되돌리나
    d.setDate(d.getDate() - back);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  function loadTop(w){
    const key = w || when;
    if (topCache[key]) return topCache[key];
    let q = sb.from('run_scores').select('id, name, score')
      .order('score', { ascending: false }).order('created_at', { ascending: true })
      .limit(10);
    if (key === 'week') q = q.gte('created_at', weekStart());
    topCache[key] = q
      .then(({ data }) => { topRows[key] = data || []; if (key === when) renderTop(); })
      .catch(() => { delete topCache[key]; });
    return topCache[key];
  }

  document.querySelectorAll('#runWhen button').forEach(b =>
    b.addEventListener('click', () => {
      if (when === b.dataset.when) return;
      when = b.dataset.when;
      renderTop();
      loadTop();
    }));

  function hideSave(){ saveBox.hidden = true; saveMsg.textContent = ''; }

  function offerSave(){
    if (score() <= 0) return;
    // 10위 안에 못 들 점수면 굳이 이름을 묻지 않는다 — 표만 지저분해진다.
    // 전체 10위에서 밀려도 이번 주 10위에는 들 수 있다. 둘 다 밀릴 때만 넘어간다.
    const missed = k => {
      const r = topRows[k];
      return !!r && r.length >= 10 && score() <= Number(r[9].score);
    };
    if (missed('all')) {
      if (!topRows.week) {
        // 이번 주 표를 아직 안 받았으면 한 번만 받아 보고 다시 판단한다.
        if (weekAsked) return;
        weekAsked = true;
        loadTop('week').then(() => { if (saveBox.hidden && !savedId) offerSave(); });
        return;
      }
      if (missed('week')) return;
    }
    savedId = null;
    sendBtn.disabled = false;
    saveMsg.className = 'run-msg';
    saveMsg.textContent = '10위 안에 들었어요!';
    saveBox.hidden = false;
  }

  sendBtn.addEventListener('click', async () => {
    const nm = nameIn.value.trim();
    if (!nm){ saveMsg.className = 'run-msg err'; saveMsg.textContent = '이름을 적어주세요.'; return; }
    const pt = score();
    if (pt <= 0) return;
    sendBtn.disabled = true;
    saveMsg.className = 'run-msg'; saveMsg.textContent = '남기는 중…';
    try { localStorage.setItem('sy.run.name', nm); } catch (e) { /* 저장이 막힌 브라우저(사생활 모드·용량 초과) — 없이도 돌아간다 */ }
    const { data, error } = await sb.from('run_scores')
      .insert({ name: nm, score: pt, who }).select('id').single();
    if (error){
      sendBtn.disabled = false;
      saveMsg.className = 'run-msg err'; saveMsg.textContent = '못 남겼어요: ' + readableError(error);
      return;
    }
    savedId = data && data.id;
    saveMsg.textContent = '남겼어요!';
    // 방금 넣은 줄이 보여야 한다 — 두 탭 모두 다시 받는다.
    delete topCache.all; delete topCache.week;
    topRows.all = topRows.week = null;
    await loadTop();
    saveBox.hidden = true;
  });

  // 안 보이면 멈춘다. 게임이 화면 밖에서 계속 돌면 스크롤이 버벅이고 배터리만 먹는다.
  let visible = false;
  function sync(){
    if (visible && !document.hidden && state === 'play') start();
    else { stop(); }
  }
  if ('IntersectionObserver' in window){
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible) loadTop();        // 순위표는 화면에 들어올 때 딱 한 번
      sync();
    }, { threshold: 0.25 }).observe(canvas);
  } else { visible = true; loadTop(); }
  document.addEventListener('visibilitychange', sync);

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });

  // 시험용 손잡이. 화면을 안 거치고 규칙대로 도는지 확인할 때 쓴다.
  window.__run = {
    get state(){ return { state, t, lives, hearts, gemStreak, invulnUntil, shieldFlash, lifeFlash, score: score(), gems, obs, lv, py }; },
    playerBox,
    // y 를 안 주면 지금 캐릭터가 서 있는 자리에 맞춘다 — 점프 높낮이는 이미
    // GEM_H 로 따로 다뤄지는 값이라, 충돌 자체만 확인할 땐 굳이 안 맞춰도 된다.
    spawnStar(dx, y){ const pb = playerBox(); gems.push({ x: PLAYER_X + (dx || 20), y: y != null ? y : pb.y, p: 0, star: true }); },
    spawnHeart(dx, y){ const pb = playerBox(); gems.push({ x: PLAYER_X + (dx || 20), y: y != null ? y : pb.y, p: 0, star: false }); },
    spawnObstacle(dx){
      const p = STAGE_PIECES[0][0];
      obs.push({ sp: p.sp, s: p.s, hit: p.hit, pal: p.pal, x: PLAYER_X + (dx || 20) });
    },
    step: () => step(performance.now()),
    jump, reset, setState, start,
  };

  reset(); resize();
})();
