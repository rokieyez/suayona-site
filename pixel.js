// 도트(픽셀) 그래픽 유틸리티.
// 스프라이트는 "문자 한 개 = 픽셀 한 개" 인 문자열 배열로 정의하고,
// 팔레트(문자 -> 색)와 함께 캔버스에 그림. '.' 은 투명.

// ---------- 팔레트 ----------
const PAL = {
  // 하늘/구름
  a: '#bfe4f7', b: '#a5d8f3', c: '#8ec9ee', d: '#ffffff', e: '#eaf6ff', f: '#cfe9fa',
  // 해/노랑
  g: '#ffd979', h: '#ffc94d', i: '#f7b733',
  // 풀/나무
  j: '#a8dba0', k: '#8ccb84', l: '#6fb567', m: '#559b50', n: '#3f7d3c',
  // 나무줄기/흙
  o: '#c79b6d', p: '#a97b4f', q: '#8a5f3a',
  // 집
  r: '#ffd9d0', s: '#ffb3a7', t: '#f2857a', u: '#ffffff', v: '#7fbfe0',
  // 피부/머리
  w: '#ffe0c4', x: '#f7c9a3', y: '#5b3ba2', z: '#4a2f1f',
  // 옷 (수아=코랄, 연아=민트)
  A: '#ff9aa2', B: '#ff7f8a', C: '#8fd9c8', D: '#6cc7b3',
  // 포인트
  E: '#ffffff', F: '#3a3226', G: '#ffe66d', H: '#ff6b6b', I: '#5aa9e6',
  // 꽃
  J: '#ffb7d5', K: '#ff8fc0', L: '#fff3a0',
  // 캐릭터 (티셔츠 그림 기준) — M:연아 머리(적갈색), O:수아 머리(진갈색), N:얼굴(크림)
  M: '#a0562c', O: '#3f2d23', N: '#fbdcc4',
  // 참조 그림의 옷 색 — X:티셔츠 빨강, V:남색 반바지, W:주황 신발
  X: '#ea2027', V: '#2e3a54', W: '#e8912f',
  // 유튜브 빨강 (사이트 톤에 맞춰 살짝 낮춘 채도)
  R: '#e03e30',
  // 남산타워 — 멀리 있으므로 흐린 회청색
  S: '#dfe6ec', T: '#b3c0cc', U: '#8b9bab',
  // 분홍 여우
  P: '#ffb0c4', Q: '#5a3a24',
  // 사랑앵무 — Y:연보라 뺨, Z:배의 청회색(하늘색과 겹치지 않게)
  Y: '#b9a3d6', Z: '#a8c8d6',
};

// 풍경을 여러 겹으로 그리기 위한 색 묶음.
// 초록을 멀리(연함) → 가까이(진함) 순으로 여러 단계 둬야 깊이가 생김.
const SCENE = {
  sky:   ['#7cc0e8', '#a8d8f2', '#d6eefb', '#f4e6c8'],
  cloud: { body:'#ffffff', mid:'#eaf4fd', shade:'#cfe4f5' },
  sun:   { core:'#ffe07a', glow:'rgba(255,231,150,.30)' },
  city:  ['#8fb4cf', '#7ea5c4', '#6f96b6'],           // 원경 건물 (공기원근법으로 흐릿하게)
  hills: ['#bfe3ac', '#a3d493', '#84c078', '#69a860'], // 먼 언덕 → 가까운 언덕
  grass: { base:'#5c9c54', tuft:'#4d8a48', light:'#7cb96e' },
  bush:  ['#3f7d3c', '#356b34', '#2b592b'],            // 맨 앞 수풀 (가장 진함)
  trunk: { light:'#c79b6d', mid:'#a97b4f', dark:'#8a5f3a', line:'#6f4a2c' },
  leaf:  ['#5fa855', '#4e9147', '#3f7a3b', '#79bf6b'],
  path:  ['#d9c49a', '#c9b083'],
  petal: ['#ffb7d5', '#fff3a0', '#ffffff', '#ffc98a'],
};

// ---------- 스프라이트 ----------
const SPRITES = {
  // 작은 구름 12x6
  cloudS: [
    '....dd......',
    '..ddddde....',
    '.dddddddde..',
    'dddddddddde.',
    '.eeeeeeeee..',
    '............',
  ],
  // 큰 구름 20x8
  cloudL: [
    '......dddd..........',
    '....dddddddd........',
    '..dddddddddddd..dd..',
    '.dddddddddddddddddd.',
    'dddddddddddddddddddd',
    '.eeeeeeeeeeeeeeeeee.',
    '..eeeeeeeeeeeeee....',
    '....................',
  ],
  // 나무 14x16
  tree: [
    '.....mmm......',
    '...mmlllmm....',
    '..mllllllmm...',
    '.mlllkkkllmm..',
    'mllkkkkkklllm.',
    'mlkkkkjjkkllm.',
    'mlkkjjjjjkklm.',
    '.mkkjjjjjkkm..',
    '..mkkjjjkkm...',
    '...mmkkkmm....',
    '.....ooo......',
    '.....opo......',
    '.....opo......',
    '.....opo......',
    '....oppqo.....',
    '...oqqqqqo....',
  ],
  // 집 22x18
  house: [
    '.........tt...........',
    '........tsst..........',
    '.......tsssst.........',
    '......tsssssst........',
    '.....tsssssssst.......',
    '....tsssssssssst......',
    '...tsssssssssssst.....',
    '..tsssssssssssssst....',
    '.tttttttttttttttttt...',
    '.frrrrrrrrrrrrrrrrf...',
    '.fr..vv...rr...vv.rf..',
    '.fr..vv...rr...vv.rf..',
    '.frrrrrr..rr..rrrrrf..',
    '.fr.......rr......rf..',
    '.fr..vv...rr...vv.rf..',
    '.fr..vv...rr...vv.rf..',
    '.frrrrrrrrrrrrrrrrrf..',
    '.ffffffffffffffffff...',
  ],
  // 캐릭터: 수아 — 참조 그림 기준. 아주 긴 생머리, 빨간 가로 줄무늬 티셔츠,
  // 남색 반바지, 주황 신발. 42x40 (위아래 한 줄은 외곽선용 여백)
  sua: [
    '............FFFFFFFFFFFFFFFFFF............',
    '..........FFOOOOOOOOOOOOOOOOOOFF..........',
    '.........FOOOOOOOOOOOOOOOOOOOOOOF.........',
    '........FOOOOOOOOOOOOOOOOOOOOOOOOF........',
    '.......FOOOOOOOOOOOOOOOOOOOOOOOOOOF.......',
    '......FOOOOOOOOOOOOOOOOOOOOOOOOOOOOF......',
    '......FOOOOOOOOOOOOOOOOOOOOOOOOOOOOF......',
    '.....FOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOF.....',
    '.....FOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOF.....',
    '.....FOOOOOOOOONNNNNNNNNNNNOOOOOOOOOF.....',
    '.....FOOOOOONNNNNNNNNNNNNNNNNNOOOOOOF.....',
    '....FOOOOOONNNNNNNNNNNNNNNNNNNNOOOOOOF....',
    '....FOOOOONNNNNNNNNNNNNNNNNNNNNNOOOOOF....',
    '....FOOOOONNNNNNNFFNNNNFFNNNNNNNOOOOOF....',
    '....FOOOOONNNNNNNFFNNNNFFNNNNNNNOOOOOF....',
    '...FOOOOOONNNNNNNNNNFFNNNNNNNNNNOOOOOOF...',
    '...FOOOOOONNNNNNNNNFXXFNNNNNNNNNOOOOOOF...',
    '...FOOOOOONNNNNNNNNFXXFNNNNNNNNNOOOOOOF...',
    '..FOOOOOOONNNNNNNNNFXXFNNNNNNNNNOOOOOOOF..',
    '..FOOOOOOONNNNNNNNNNFFNNNNNNNNNNOOOOOOOF..',
    '..FOOOOOOOONNNNNNNNNNNNNNNNNNNNOOOOOOOOF..',
    '.FOOOOOOOOOONNNNNNNNNNNNNNNNNNOOOOOOOOOF..',
    '.FOOOOOOOOOOOXXXNNNNNNNNNNXXXOOOOOOOOOOOF.',
    '.FOOOOOOOOFFEEEEEEEEEEEEEEEEEEEFOOOOOOOOF.',
    '.FOOOOOOOOFFXXXXXXXXXXXXXXXXXXXFOOOOOOOOF.',
    '.FOOOOOOOFFEEEEEEEEEEEEEEEEEEEEFFOOOOOOOF.',
    '.FOOOOOOF.FXXXXXXXXXXXXXXXXXXXXF.FOOOOOOF.',
    '.FOOOOOF.FEEEEEEEEEEEEEEEEEEEEEEF.FOOOOOF.',
    '.FOOOOOF.FXXXXXXXXXXXXXXXXXXXXXXF.FOOOOOF.',
    '.FOOOOF.FEEEEEEEEEEEEEEEEEEEEEEEEF.FOOOOOF',
    'FOOOOF..FNNNNXXXXXXXXXXXXXXXXNNNNF..FOOOOF',
    'FOOOF...FNNNFFFFFFFFFFFFFFFFFFFNNF...FOOOF',
    'FOOOF...FNNNNFFVVVVVVVVVVVVFFNNNNF...FOOOF',
    '.FFF.....FFFF.FVVVVVVVVVVVVF.FFFF.....FFF.',
    '..............FVVVVVFFVVVVVF..............',
    '..............FVVVVVFFVVVVVF..............',
    '.............FWWWWWWFFWWWWWWF.............',
    '.............FWWWWWWFFWWWWWWF.............',
    '.............FWWWWWWFFWWWWWWF.............',
    '..............FFFFFF..FFFFFF..............',
  ],
  // 캐릭터: 연아 — 수아와 같은 비율의 버섯 단발. 민트 티셔츠, 남색 반바지 42x40
  yona: [
    '............FFFFFFFFFFFFFFFFFF............',
    '...........FMMMMMMMMMMMMMMMMMMF...........',
    '..........FMMMMMMMMMMMMMMMMMMMMF..........',
    '.........FMMMMMMMMMMFMMMMMMMMMMMF.........',
    '........FMMMMMMMMMMMFMMMMMMMMMMMMF........',
    '.......FMMMMMMMMMMMMFMMMMMMMMMMMMMF.......',
    '......FMMMMMMMMMMMMMFMMMMMMMMMMMMMMF......',
    '......FMMMMMMMMMMMMMMMMMMMMMMMMMMMMF......',
    '......FMMMMMMMMMMMMMMMMMMMMMMMMMMMMF......',
    '......FMMMMMMMMNNNNNNNNNNNNMMMMMMMMF......',
    '......FMMMMMNNNNNNNNNNNNNNNNNNMMMMMF......',
    '.....FMMMMMNNNNNNNNNNNNNNNNNNNNMMMMMF.....',
    '.....FMMMMNNNNNNNNNNNNNNNNNNNNNNMMMMF.....',
    '.....FMMMMNNNNNNNFFNNNNFFNNNNNNNMMMMF.....',
    '....FMMMMMNNNNNNNFFNNNNFFNNNNNNNMMMMMF....',
    '....FMMMMMNNNNNNNNNNFFNNNNNNNNNNMMMMMF....',
    '....FMMMMMNNNNNNNNNFXXFNNNNNNNNNMMMMMF....',
    '....FMMMMMNNNNNNNNNFXXFNNNNNNNNNMMMMMF....',
    '...FMMMMMMNNNNNNNNNFXXFNNNNNNNNNMMMMMMF...',
    '...FMMMMMMNNNNNNNNNNFFNNNNNNNNNNMMMMMMF...',
    '...FMMMMMMMNNNNNNNNNNNNNNNNNNNNMMMMMMMF...',
    '...FMMMMMMMMNNNNNNNNNNNNNNNNNNMMMMMMMMF...',
    '....FFFFFFFFFCCCNNNNNNNNNNCCCFFFFFFFFF....',
    '...........FCCCCCCCCCCCCCCCCCCCF..........',
    '...........FCCCCCCCCCCCCCCCCCCCF..........',
    '..........FCCCCCCCCCCCCCCCCCCCCF..........',
    '..........FCCCCCCCCCCCCCCCCCCCCF..........',
    '.........FCCCCCCCCCCCCCCCCCCCCCCF.........',
    '.........FCCCCCCCCCCCCCCCCCCCCCCF.........',
    '........FCCCCCCCCCCCCCCCCCCCCCCCCF........',
    '........FNNNNCCCCCCCCCCCCCCCCNNNNF........',
    '........FNNNFFFFFFFFFFFFFFFFFFFNNF........',
    '........FNNNNFFVVVVVVVVVVVVFFNNNNF........',
    '.........FFFF.FVVVVVVVVVVVVF.FFFF.........',
    '..............FVVVVVFFVVVVVF..............',
    '..............FVVVVVFFVVVVVF..............',
    '.............FWWWWWWFFWWWWWWF.............',
    '.............FWWWWWWFFWWWWWWF.............',
    '.............FWWWWWWFFWWWWWWF.............',
    '..............FFFFFF..FFFFFF..............',
  ],
  // 액자에 담긴 그림 (포트폴리오 아이콘) 12x10
  frame: [
    'FFFFFFFFFFFF',
    'FaaaaaaaaaaF',
    'FaaaaaaaghaF',
    'FaaaaaaaghaF',
    'FaaaammaaaaF',
    'FaaammmmaaaF',
    'FaammmmmmaaF',
    'FammmmmmmmaF',
    'FkkkkkkkkkkF',
    'FFFFFFFFFFFF',
  ],
  // 말풍선 (일기장 아이콘) 12x10
  bubble: [
    '.FFFFFFFFFF.',
    'FEEEEEEEEEEF',
    'FEEFFFFFFEEF',
    'FEEEEEEEEEEF',
    'FEEFFFFFFEEF',
    'FEEEEEEEEEEF',
    'FEEFFFFEEEEF',
    'FEEEEEEEEEEF',
    '.FFFFEEFFFF.',
    '....FFF.....',
  ],
  // 편지 (편지쓰기 아이콘) 12x9
  mail: [
    'FFFFFFFFFFFF',
    'FEEEEEEEEEEF',
    'FEFEEEEEEFEF',
    'FEEFEEEEFEEF',
    'FEEEFEEFEEEF',
    'FEEEEFFEEEEF',
    'FEEEEEEEEEEF',
    'FEEEEEEEEEEF',
    'FFFFFFFFFFFF',
  ],
  // 꽃 5x6
  flower: [
    '.J.J.',
    'JKKKJ',
    '.JLJ.',
    '..l..',
    '.jl..',
    '..l..',
  ],
  // 덤불 10x5
  bush: [
    '...kkk....',
    '.kkjjjkk..',
    'kkjjjjjkkk',
    'kjjjjjjjkk',
    'llllllllll',
  ],
  // 사진 속 사랑앵무 — 하늘을 나는 두 컷(날개 위/아래) 22x15
  budgieUp: [
    '...FUUUFF.............',
    '...FEEEEEF............',
    '....FUUUUUFF..........',
    '.....FEEEEEEF.FFFFF...',
    '......FUUUUUUFEEEEEF..',
    '.....FZZZZZZZUEEEEEF..',
    '..FFFZZZZZZZZEEEFEEF..',
    '.FTTTZZZZZZZZUEEEEEiF.',
    'FTTTTZZZZZZZZZEEEEEiiF',
    '.FTTTZZZZZZZZZZEYYEiF.',
    '..FFFZZZZZZZZZZZZFFF..',
    '.....FZZZZZZZZZZF.....',
    '......FFZZZZZZFF......',
    '........FFFFFF........',
    '......................',
  ],
  budgieDown: [
    '......................',
    '......................',
    '......................',
    '..............FFFFF...',
    '......FFFFFFFFEEEEEF..',
    '.....FZZZZZZZUEEEEEF..',
    '..FFFZZZZZZZZEEEFEEF..',
    '.FTTTZZZZZZZZUEEEEEiF.',
    'FTTTTZZZZZZZZZEEEEEiiF',
    '.FTTTZZZZZZZZZZEYYEiF.',
    '..FFFZZUUUUUUZZZZFFF..',
    '.....FEEEEEEZZZZF.....',
    '....FUUUUUZZZZFF......',
    '...FEEEEEFFFFF........',
    '...FUUUFF.............',
  ],
  // 새 7x4
  bird: [
    'F.....F',
    '.F...F.',
    '..FFF..',
    '.......',
  ],
  // 하트 7x6
  heart: [
    '.HH.HH.',
    'HHHHHHH',
    'HHHHHHH',
    '.HHHHH.',
    '..HHH..',
    '...H...',
  ],
  // 그림 이젤 — 참조 이미지의 노트북 자리에 놓일, 이 사이트다운 소품 16x18
  easel: [
    '......FFFF......',
    '.....FEEEEF.....',
    '....FEEEEEEF....',
    '...FEJJEEKKEF...',
    '...FEJJEEKKEF...',
    '...FEEEEEEEEF...',
    '...FEEIIEELLF...',
    '...FEEIIEELLF...',
    '...FEEEEEEEEF...',
    '...FFFFFFFFFF...',
    '....q......q....',
    '....q......q....',
    '...q........q...',
    '...q........q...',
    '..q..........q..',
    '..q..........q..',
    '.q............q.',
    '.q............q.',
  ],
  // 나무 벤치 18x9
  bench: [
    '..pppppppppppp..',
    '..pppppppppppp..',
    '................',
    '..pppppppppppp..',
    '..pppppppppppp..',
    '..q..........q..',
    '..q..........q..',
    '..q..........q..',
    '.qqq........qqq.',
  ],
  // 유튜브 아이콘 14x11 (모서리 깎은 사각형 + 오른쪽을 향한 재생 삼각형)
  youtube: [
    '..FFFFFFFFFF..',
    '.FRRRRRRRRRRF.',
    'FRRRRERRRRRRRF',
    'FRRRREERRRRRRF',
    'FRRRREEERRRRRF',
    'FRRRREEEERRRRF',
    'FRRRREEERRRRRF',
    'FRRRREERRRRRRF',
    'FRRRRERRRRRRRF',
    '.FRRRRRRRRRRF.',
    '..FFFFFFFFFF..',
  ],
  // 남산타워 11x26 (안테나 · 전망대 · 기둥 · 받침)
  tower: [
    '.....S.....',
    '.....S.....',
    '.....S.....',
    '.....T.....',
    '....STS....',
    '....STS....',
    '...SSTSS...',
    '..SSSTSSS..',
    '.SSSSTSSSS.',
    '.SUUUUUUUS.',
    '.SSSSSSSSS.',
    '..UUUUUUU..',
    '....STS....',
    '....STS....',
    '....STS....',
    '....STS....',
    '....STS....',
    '....STS....',
    '...SSTSS...',
    '...SUTUS...',
    '...SSTSS...',
    '..SSSTSSS..',
    '..SUUUUUS..',
    '.SSSSSSSSS.',
    '.SUUUUUUUS.',
    'SSSSSSSSSSS',
  ],
  // 흰 병아리 캐릭터 12x17
  chick: [
    '...FFFFFF...',
    '..FEEEEEEF..',
    '.FEEEEEEEEF.',
    'FEEEEEEEEEEF',
    'FEEFEEEEFEEF',
    'FEEEEEEEEEEF',
    'FEEEEhhEEEEF',
    'FEEEEhhEEEEF',
    'FEEEEEhEEEEF',
    '.FEEEEEEEEF.',
    '..FFEEEEFF..',
    '...FEEEEF...',
    '..FEEEEEEF..',
    '.FEEEEEEEEF.',
    '.FEEEEEEEEF.',
    '..FEEEEEEF..',
    '...FF..FF...',
  ],
  // 분홍 여우 18x12 (왼쪽에 갈색 끝 꼬리)
  fox: [
    '......FF......FF..',
    '.....FPPF....FPPF.',
    '.....FPPPFFFFPPPF.',
    '....FPPPPPPPPPPPPF',
    '....FEEEPPPPPPEEEF',
    '....FEEFEEPPEEFEEF',
    '.FF.FEEEEEFFEEEEEF',
    'FQQFFEEEEEEEEEEEEF',
    'FQPF.FEEEEEEEEEEF.',
    '.FF...FFPPF..FPPFF',
    '......FPPF...FPPF.',
    '......FFFF...FFFF.',
  ],
  // 나비 7x5
  butterfly: [
    'J.....J',
    'JJK.KJJ',
    '.JKFKJ.',
    'JJK.KJJ',
    'J.....J',
  ],
  // 별 9x9
  star: [
    '....G....',
    '....G....',
    '...GGG...',
    'GGGGGGGGG',
    '.GGGGGGG.',
    '..GGGGG..',
    '..GGGGG..',
    '.GG...GG.',
    '.G.....G.',
  ],
};

// ---------- 그리기 ----------
// 캔버스에 스프라이트를 (x, y) 위치에 배율 s 로 그림
function drawSprite(ctx, sprite, x, y, s, paletteOverride) {
  const pal = paletteOverride ? Object.assign({}, PAL, paletteOverride) : PAL;
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.') continue;
      const color = pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * s, y + row * s, s, s);
    }
  }
}

// 계단식(픽셀) 언덕. waves 는 [{freq, amp, phase}] 형태의 사인파 목록
function drawHill(ctx, waves, color, s, baseY, width, height) {
  ctx.fillStyle = color;
  const cols = Math.ceil(width / s);
  for (let c = 0; c < cols; c++) {
    const t = c / cols;
    let h = 0;
    waves.forEach(wv => { h += Math.sin(t * Math.PI * wv.freq + wv.phase) * wv.amp; });
    const top = Math.round((baseY + h) / s) * s;
    ctx.fillRect(c * s, top, s, height - top);
  }
}

// 픽셀 느낌으로 색 단계가 끊기는 가로 줄무늬 하늘
function drawSkyBands(ctx, w, h, s, stops) {
  const bands = Math.ceil(h / s);
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    let color = stops[stops.length - 1].color;
    for (let k = 0; k < stops.length - 1; k++) {
      if (t >= stops[k].at && t <= stops[k + 1].at) {
        const local = (t - stops[k].at) / (stops[k + 1].at - stops[k].at);
        color = mixHex(stops[k].color, stops[k + 1].color, local);
        break;
      }
    }
    ctx.fillStyle = color;
    ctx.fillRect(0, i * s, w, s);
  }
}

// ---------- 풍경 그리기 도구 ----------
// 새로고침할 때마다 그림이 달라지면 안 되므로 씨앗값으로 고정된 의사난수를 씀
function prand(i){
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// 도트 느낌을 유지한 원 (안티앨리어싱 없이 계단식)
function pixelCircle(ctx, cx, cy, r, s, color){
  if (color) ctx.fillStyle = color;
  for (let y = -r; y <= r; y += s) {
    const half = Math.sqrt(Math.max(0, r*r - y*y));
    ctx.fillRect(Math.round((cx-half)/s)*s, Math.round((cy+y)/s)*s, Math.round((half*2)/s)*s || s, s);
  }
}

// 원을 여러 개 겹쳐 만든 뭉게구름. 아래쪽에 그림자색을 깔아 입체감을 냄.
function drawFluffyCloud(ctx, cx, cy, scale, s, seed){
  const blobs = [];
  const n = 5 + Math.floor(prand(seed) * 3);
  for (let i = 0; i < n; i++) {
    blobs.push({
      x: cx + (prand(seed + i * 7) - 0.5) * scale * 2.4,
      y: cy + (prand(seed + i * 13) - 0.5) * scale * 0.5,
      r: scale * (0.45 + prand(seed + i * 19) * 0.55),
    });
  }
  ctx.fillStyle = SCENE.cloud.shade;
  blobs.forEach(b => pixelCircle(ctx, b.x, b.y + scale * 0.22, b.r, s));
  ctx.fillStyle = SCENE.cloud.mid;
  blobs.forEach(b => pixelCircle(ctx, b.x, b.y + scale * 0.10, b.r, s));
  ctx.fillStyle = SCENE.cloud.body;
  blobs.forEach(b => pixelCircle(ctx, b.x, b.y - scale * 0.05, b.r * 0.92, s));
}

// 지평선 위의 원경 건물들. 멀수록 흐린 색을 써서 거리감을 만듦.
function drawSkyline(ctx, baseY, W, s, seed){
  let x = -20;
  let i = 0;
  while (x < W + 20) {
    const r = prand(seed + i * 3);
    const w = Math.round((10 + r * 18) / s) * s;
    const h = Math.round((10 + prand(seed + i * 5) * 34) / s) * s;
    const shade = SCENE.city[i % SCENE.city.length];
    ctx.fillStyle = shade;
    ctx.fillRect(Math.round(x/s)*s, Math.round((baseY - h)/s)*s, w, h);
    // 창문 몇 개
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let wy = baseY - h + s*2; wy < baseY - s*2; wy += s*3) {
      for (let wx = x + s; wx < x + w - s; wx += s*3) {
        if (prand(wx * 0.7 + wy * 1.3 + seed) > 0.55) ctx.fillRect(Math.round(wx/s)*s, Math.round(wy/s)*s, s, s);
      }
    }
    x += w + s * (1 + Math.floor(prand(seed + i * 11) * 2));
    i++;
  }
}

// 겹겹이 쌓인 수풀 덩어리. 화면 맨 앞을 채워서 깊이를 만드는 용도.
function drawBushMass(ctx, x0, x1, yTop, yBot, s, seed, shades){
  shades.forEach((color, layer) => {
    ctx.fillStyle = color;
    const step = s * (5 - layer);
    const lift = layer * s * 3;
    for (let x = x0, i = 0; x < x1; x += step, i++) {
      const r = (s * 3) + prand(seed + i * 4.7 + layer * 31) * s * 5;
      const y = yTop + lift + prand(seed + i * 2.3 + layer * 17) * (yBot - yTop) * 0.45;
      pixelCircle(ctx, x, y, r, s);
    }
    ctx.fillRect(x0, yTop + lift + s * 4, x1 - x0, yBot - yTop);
  });
}

// 잔디 위에 흩뿌리는 풀포기 — 밋밋한 초록 면을 덜 심심하게 만듦
function drawGrassTufts(ctx, x0, x1, yTop, yBot, s, seed, density){
  const n = Math.floor((x1 - x0) / s * (density || 0.10));
  for (let i = 0; i < n; i++) {
    const x = x0 + prand(seed + i * 3.1) * (x1 - x0);
    const y = yTop + prand(seed + i * 5.9) * (yBot - yTop);
    ctx.fillStyle = prand(seed + i * 7.7) > 0.5 ? SCENE.grass.tuft : SCENE.grass.light;
    const px = Math.round(x/s)*s, py = Math.round(y/s)*s;
    ctx.fillRect(px, py, s, s);
    ctx.fillRect(px - s, py + s, s, s);
    ctx.fillRect(px + s, py + s, s, s);
  }
}

// 화면 오른쪽 가장자리를 타고 올라가 위쪽을 덮는 큰 나무.
// 참조 이미지처럼 잎이 화면 위로 걸쳐 나가면서 장면을 감싸는 역할을 함.
function drawBigTree(ctx, W, H, s){
  // 줄기는 화면 밖에 걸쳐 두고 옆면만 살짝 보이게 — 참조 이미지처럼 잘린 느낌
  const baseX = W * 1.04, topX = W * 1.00;
  const baseW = s * 9, topW = s * 6;

  for (let y = H; y > -s; y -= s) {
    const t = 1 - (y / H);
    const x = baseX + (topX - baseX) * t + Math.sin(t * 2.2) * s * 1.5;
    const w = baseW + (topW - baseW) * t;
    const px = Math.round((x - w/2)/s)*s, pw = Math.round(w/s)*s;
    ctx.fillStyle = SCENE.trunk.mid;   ctx.fillRect(px, y, pw, s);
    ctx.fillStyle = SCENE.trunk.light; ctx.fillRect(px, y, s, s);
    if (prand(y * 0.37) > 0.7) {       // 껍질 결
      ctx.fillStyle = SCENE.trunk.line;
      ctx.fillRect(px + s * 2, y, s, s);
    }
  }

  // 줄기에서 왼쪽 위로 뻗는 가지 — 끝으로 갈수록 가늘어지게
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const bx = W * 1.00 - i * s * 2.4;
    const by = H * 0.17 + Math.sin(t * 1.4) * s * 5;
    ctx.fillStyle = SCENE.trunk.dark;
    ctx.fillRect(Math.round(bx/s)*s, Math.round(by/s)*s, s * 3, Math.max(s, Math.round((s * 2.5 * (1 - t))/s)*s));
  }

  // 잎 — 위쪽 오른편을 덮되, 진한 색을 먼저 넓게 깔고 밝은 색을 위에 얹어 입체감
  const clusters = [
    { cx:0.99, cy:0.06, r:1.35 }, { cx:0.90, cy:0.02, r:1.25 },
    { cx:0.82, cy:0.09, r:1.05 }, { cx:0.73, cy:0.05, r:0.85 },
    { cx:0.95, cy:0.20, r:1.00 }, { cx:0.85, cy:0.22, r:0.80 },
    { cx:0.66, cy:0.13, r:0.60 },
  ];
  SCENE.leaf.forEach((color, li) => {
    ctx.fillStyle = color;
    clusters.forEach((c, ci) => {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = prand(li * 40 + ci * 13 + i * 3.3) * Math.PI * 2;
        const d = prand(li * 70 + ci * 17 + i * 5.1) * s * 9 * c.r;
        pixelCircle(ctx,
          W * c.cx + Math.cos(a) * d * 1.6,
          H * c.cy + Math.sin(a) * d - li * s * 1.5,
          s * (4 + prand(li * 90 + ci * 23 + i) * 5) * c.r, s);
      }
    });
  });
}

// 계단식 산봉우리. 능선을 살짝 흔들어 밋밋하지 않게 함.
// 꼭대기 좌표를 돌려줘서 그 위에 타워를 올릴 수 있게 함.
function drawMountain(ctx, cx, baseY, halfW, height, s, colors, seed){
  const peakY = baseY - height;
  for (let x = cx - halfW; x <= cx + halfW; x += s) {
    const t = Math.abs(x - cx) / halfW;              // 0(꼭대기) ~ 1(기슭)
    const jag = Math.sin((x + seed * 37) * 0.06) * s * 1.5;
    const top = Math.round((peakY + Math.pow(t, 1.45) * height + jag) / s) * s;
    ctx.fillStyle = colors.body;
    ctx.fillRect(Math.round(x / s) * s, top, s, baseY - top);
    // 능선 왼쪽에 빛, 오른쪽에 그늘
    ctx.fillStyle = x < cx ? colors.light : colors.shade;
    ctx.fillRect(Math.round(x / s) * s, top, s, s * 2);
  }
  return { x: cx, y: peakY };
}

// 구불구불한 오솔길
function drawPath(ctx, W, yTop, yBot, s, seed){
  for (let y = yTop; y < yBot; y += s) {
    const t = (y - yTop) / (yBot - yTop);
    const cx = W * (0.30 + Math.sin(t * 2.2 + seed) * 0.10);
    const w = s * (1.5 + t * 7);
    ctx.fillStyle = SCENE.path[0];
    ctx.fillRect(Math.round((cx - w/2)/s)*s, y, Math.round(w/s)*s, s);
    ctx.fillStyle = SCENE.path[1];
    ctx.fillRect(Math.round((cx - w/2)/s)*s, y, s, s);
  }
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  const q = v => Math.round(v / 8) * 8;  // 색 단계를 거칠게 끊어 도트 느낌 유지
  const mixed = pa.map((v, i) => q(Math.round(v + (pb[i] - v) * t)));
  return '#' + mixed.map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}
