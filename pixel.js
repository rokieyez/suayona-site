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
  // 16비트 게임 느낌을 내려고 각 소재마다 명도/채도 단계를 촘촘하게 잡음.
  // 멀수록 연하고 푸르게(공기원근법), 가까울수록 진하고 노랗게.
  sky:   ['#3f8fd0', '#5aa5de', '#7cc0e8', '#a8d8f2', '#cfe9fa', '#eaf3ea', '#f7ead0'],
  cloud: { hi:'#ffffff', body:'#f6fcff', mid:'#ddeffd', shade:'#bcd9ef', deep:'#9dc3e0' },
  sun:   { core:'#fff6c8', ring:'#ffe07a', glow:'rgba(255,231,150,.30)' },
  city:  ['#a8c4da', '#94b3cd', '#809fbf', '#6d8db0'],   // 원경 건물 (흐릿하게)
  // 언덕 7단계 + 능선에 얹을 밝은 단 7단계
  hills:    ['#bcd9a8', '#a6cd91', '#8ec07b', '#76b166', '#5fa155', '#4c8f46', '#3c7c39'],
  hillsLit: ['#d6ebc6', '#c0e2af', '#a9d698', '#92ca82', '#7bbb6e', '#66aa5d', '#54984f'],
  grass: { base:'#5c9c54', tuft:'#4d8a48', light:'#7cb96e', hi:'#9ad189', dark:'#3f7d3c' },
  bush:  ['#3f7d3c', '#356b34', '#2b592b', '#224823', '#1b3a1d'],   // 맨 앞 수풀 (가장 진함)
  trunk: { light:'#d6b083', mid:'#bb8f61', warm:'#a97b4f', dark:'#8a5f3a', line:'#6f4a2c', deep:'#553d24' },
  leaf:  ['#93d481', '#7cc26e', '#63aa58', '#51944a', '#417c3d', '#326631'],
  path:  ['#ece0bf', '#dcc9a1', '#cab188', '#b79a6f'],
  petal: ['#ffb7d5', '#fff3a0', '#ffffff', '#ffc98a', '#c9a8ff', '#ff9aa2'],
  rock:  ['#c2bab0', '#a49c92', '#857d75', '#665f59'],
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
  // 캐릭터: 연아 — 티셔츠 그림에서 잰 비율(얼굴폭 63%, 높이 44%, 갈래 두 가닥, 브이 입). 노란 후드티(모자·끈·앞주머니), 남색 반바지 42x40
  yona: [
    '...........FFFFFFFFFFFFFFFFFFFF...........',
    '........FFFMMMMMMMMMMMMMMMMMMMMFFF........',
    '......FFMMMMMMMMMMMMMMMMMMMMMMMMMMFF......',
    '.....FMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMF.....',
    '....FMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMF....',
    '...FMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMF...',
    '..FMMMMMMMMMMMMMMFMMMMMMFMMMMMMMMMMMMMMF..',
    '..FMMMMMMMMMMMMMMFMMMMMMFMMMMMMMMMMMMMMF..',
    '.FMMMMMMMMMMMMMMMFMMMMMMFMMMMMMMMMMMMMMMF.',
    '.FMMMMMMMMMMMMMMMFMMMMMMFMMMMMMMMMMMMMMMF.',
    '.FMMMMMMMMMMMMNNNNNNNNNNNNNNMMMMMMMMMMMMF.',
    '.FMMMMMMMMMMNNNNNNNNNNNNNNNNNNMMMMMMMMMMF.',
    '.FMMMMMMMMNNNNNNNNNNNNNNNNNNNNNNMMMMMMMMF.',
    '.FMMMMMMMNNNNNNNNNNNNNNNNNNNNNNNNMMMMMMMF.',
    '.FMMMMMMMNNNNNNNNNNNNNNNNNNNNNNNNMMMMMMMF.',
    '.FMMMMMMMNNNNNNFNNNNNNNNNNFNNNNNNMMMMMMMF.',
    '..FMMMMMMNNNNNNFNNNNNNNNNNFNNNNNNMMMMMMF..',
    '..FMMMMMMNNNNNNNNNNNNNNNNNNNNNNNNMMMMMMF..',
    '...FMMMMMNNNNNNNNNNNNNNNNNNNNNNNNMMMMMF...',
    '....FMMMMNNNNNNNNNNFNNFNNNNNNNNNNMMMMF....',
    '.....FMMMNNNNNNNNNNNFFNNNNNNNNNNNMMMF.....',
    '......FFMMNNNNNNNNNNNNNNNNNNNNNNMMFF......',
    '....FFFFFFFFFhhhNNNNNNNNNNhhhFFFFFFFFF....',
    '...........FhhhGGGGGGGGGGGGhhhhF..........',
    '...........FGGGGGGGEGGEGGGGGGGGF..........',
    '..........FGGGGGGGGEGGEGGGGGGGGF..........',
    '..........FGGGGGGGGEGGEGGGGGGGGF..........',
    '.........FGGGGGGGGGFGGFGGGGGGGGGF.........',
    '.........FGGFFFFFFFFFFFFFFFFFFGGF.........',
    '........FGGhhhhhhhhhhhhhhhhhhhhGGF........',
    '........FNNNNhhhhhhhhhhhhhhhhNNNNF........',
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
  // 사진 속 사랑앵무 — 하늘을 나는 두 컷(날개 위/아래). 몸을 유선형으로 얇게 22x15
  budgieUp: [
    '...FUUUFF.............',
    '...FEEEEEF............',
    '....FUUUUUFF..........',
    '.....FEEEEEEF.FFFFF...',
    '......FUUUUUUFEEEEEF..',
    '......FFFFFFFUEEEEEF..',
    '..FFFFZZZZZZZEEEFEEF..',
    '.FTTTZZZZZZZZUEEEEEiF.',
    'FTTTTZZZZZZZZZEEEEEiiF',
    '.FTTTZZZZZZZZZZEYYEiF.',
    '..FFFZZZZZZZZZZZFFFF..',
    '.....FFZZZZZZZFF......',
    '.......FFFFFFF........',
    '......................',
    '......................',
  ],
  budgieDown: [
    '......................',
    '......................',
    '......................',
    '..............FFFFF...',
    '.............FEEEEEF..',
    '......FFFFFFFUEEEEEF..',
    '..FFFFZZZZZZZEEEFEEF..',
    '.FTTTZZZZZZZZUEEEEEiF.',
    'FTTTTZZZZZZZZZEEEEEiiF',
    '.FTTTZZZZZZZZZZEYYEiF.',
    '..FFFZZUUUUUUZZZFFFF..',
    '.....FEEEEEEZZFF......',
    '....FUUUUUFFFF........',
    '...FEEEEEF............',
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
  // 그림 이젤 — 캔버스에 그림이 담기고 물감 팔레트와 붓까지 있는 26x30
  easel: [
    '.FppppppppppppppppppppF...',
    '.FppppppppppppppppppppF...',
    '.FppEEEEEEEEEEEEEEEEppF...',
    '.FppEEEEEEEEEEEGGGEEppF...',
    '.FppEEEEEEEEEEGGGGGEppF...',
    '.FppEEEEEEEEEEEGGGEEppF...',
    '.FppEJJJEEEEEEEEEEEEppF...',
    '.FppEJJJEEKKEEEEEEEEppF...',
    '.FppEEmEEEKKEEEEEEEEppF...',
    '.FppmmEmmEmmEmmEmmEmppF...',
    '.FppllllllllllllllllppF...',
    '.FppllllllllllllLLllppF...',
    '.FppllIIIlllllllLLllppF...',
    '.FppllIIIlllllllllllppF...',
    '.FppllllllllllllllllppF...',
    '.FppppppppppppppppppppF...',
    '.FppppppppppppppppppppFF..',
    '..FFFFqqFFFqqFFFFqqFFFFHF.',
    '....FqqF..FqqF...FqqF.FqF.',
    '....FqqF..FqqF...FqqF.FqF.',
    '...FqqF...FqqF....FqqF.F..',
    '...FqqFFFFFqqFFFFFFqqF....',
    '..FppppppppppppppppppqF...',
    '..FppppppppppppppppppqFFF.',
    '.FqqFFFFFFFqqFFFFFFooooJoF',
    '.FqqF.....FqqF....FoHIGooF',
    'FqqFFFFF..FqqF..FFFooooooF',
    'FqqqqqqqF.FqqF.FqqqqqqqFF.',
    'FqqqqqqqF.FqqF.FqqqqqqqF..',
    '.FFFFFFF..FqqF..FFFFFFF...',
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
  // 첨부 그림의 캐릭터 — 얼굴만 떼어 씀. 돌처럼 굴러다니는 용도 18x15
  chick: [
    '.....FFFFFFFF.....',
    '...FFEEEEEEEEFF...',
    '..FEEEEEEEEEEEEF..',
    '.FEEEEEEEEEEEEEEF.',
    'FEEEEEEEEEEEEEEEEF',
    'FEEEEFEEEEEEFEEEEF',
    'FEEEEFEEEEEEFEEEEF',
    'FEEEEEEEFFFEEEEEEF',
    'FEEEEEEFhhhFEEEEEF',
    'FEEEEEEFhhhFEEEEEF',
    'FEEEEEEFhhFEEEEEEF',
    '.FEEEEEFhhFEEEEEF.',
    '..FEEEEEFFEEEEEF..',
    '...FFEEEEEEEEFF...',
    '.....FFFFFFFF.....',
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
// 언덕. opts 로 원근 기울기(tilt), 능선 하이라이트(lit), 디더 전환(dither)을 줄 수 있음.
//   tilt: 화면 왼쪽 대비 오른쪽 능선을 몇 px 내릴지. 양수면 오른쪽이 가까워 보임.
function drawHill(ctx, waves, color, s, baseY, width, height, opts) {
  const o = opts || {};
  const cols = Math.ceil(width / s);
  const tops = [];
  for (let c = 0; c < cols; c++) {
    const t = c / cols;
    let h = (o.tilt || 0) * t;
    waves.forEach(wv => { h += Math.sin(t * Math.PI * wv.freq + wv.phase) * wv.amp; });
    tops.push(Math.round((baseY + h) / s) * s);
  }
  ctx.fillStyle = color;
  for (let c = 0; c < cols; c++) ctx.fillRect(c * s, tops[c], s, height - tops[c]);

  // 능선 위쪽 한두 줄만 밝게 — 빛을 받는 면
  if (o.lit) {
    ctx.fillStyle = o.lit;
    for (let c = 0; c < cols; c++) ctx.fillRect(c * s, tops[c], s, s * (o.litRows || 2));
  }
  // 아래쪽 경계를 체커보드로 섞어 색 단이 딱 끊기지 않게 함 (90년대 게임의 디더링)
  if (o.dither) {
    for (let c = 0; c < cols; c++) {
      for (let k = 0; k < (o.ditherRows || 3); k++) {
        const y = tops[c] + s * ((o.litRows || 2) + k);
        if ((c + k) % 2) continue;
        ctx.fillStyle = o.dither;
        ctx.fillRect(c * s, y, s, s);
      }
    }
  }
  return tops;
}

// 능선을 따라 늘어선 먼 숲 — 언덕 위에 작은 봉우리를 촘촘히 찍어 나무처럼 보이게 함
function drawTreeLine(ctx, tops, s, width, colorDark, colorLit, seed, scale){
  // 일정 간격으로 찍으면 울타리처럼 보여서, 간격과 높이를 모두 흩뜨림
  let c = 0;
  while (c < tops.length) {
    const r = prand(seed + c * 0.83);
    const h = Math.round((s * (1.2 + r * r * 5.0) * (scale || 1)) / s) * s;
    const w = s * (1 + Math.floor(prand(seed + c * 1.7) * 3));
    const x = c * s, y = tops[c] - h;
    ctx.fillStyle = colorDark; ctx.fillRect(x, y, w, h + s * 2);
    ctx.fillStyle = colorLit;  ctx.fillRect(x, y, s, Math.min(h, s * 2));
    c += Math.max(1, Math.round(w / s) + Math.floor(prand(seed + c * 2.9) * 3));
  }
}

// 앞쪽에 세우는 긴 풀잎 — 수풀 위로 삐죽 솟아 전경 밀도를 올림
function drawTallGrass(ctx, x0, x1, baseY, s, seed, shades, dense){
  const step = s * (dense || 2);
  for (let x = x0, i = 0; x < x1; x += step, i++) {
    const h = s * (2 + prand(seed + i * 1.9) * 10);
    const lean = prand(seed + i * 4.3) * 2 - 1;
    ctx.fillStyle = shades[Math.floor(prand(seed + i * 7.1) * shades.length)];
    for (let k = 0; k < h; k += s) {
      ctx.fillRect(Math.round((x + lean * k * 0.5) / s) * s, Math.round((baseY - k) / s) * s, s, s);
    }
  }
}

// 바위 — 전경/중경에 흩뿌려 초록 면을 덜 심심하게 만듦
function drawRock(ctx, cx, baseY, s, scale, shades){
  const w = s * 3 * scale, h = s * 2 * scale;
  for (let y = 0; y < h; y += s) {
    const t = y / h;
    const half = w * Math.sqrt(Math.max(0, 1 - t * t * 0.6)) * 0.5;
    const px = Math.round((cx - half) / s) * s;
    const pw = Math.max(s, Math.round((half * 2) / s) * s);
    ctx.fillStyle = shades[1];
    ctx.fillRect(px, Math.round((baseY - h + y) / s) * s, pw, s);
    ctx.fillStyle = t < 0.34 ? shades[0] : shades[2];
    ctx.fillRect(px, Math.round((baseY - h + y) / s) * s, s, s);
  }
  ctx.fillStyle = shades[3];
  ctx.fillRect(Math.round((cx - w / 2) / s) * s, Math.round(baseY / s) * s,
               Math.max(s, Math.round(w / s) * s), s);
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

  // 줄기에서 왼쪽 위로 뻗는 가지 — 끝으로 갈수록 가늘어지게.
  // 길이는 반드시 화면 폭 비율로 잡는다. 절대 px 로 두면 잎(비율로 배치됨)보다 길게 뻗어
  // 좁은 화면에서 하늘에 갈색 줄만 덩그러니 남는다.
  const reach = W * 0.22;                       // 잎 덩어리(0.73W 안쪽)에 가려지는 범위
  const steps = Math.max(4, Math.round(reach / (s * 2.4)));
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
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

// 오솔길. 지평선 쪽(xTop)에서 화면 앞(xBot)으로 이어지며, 아래로 갈수록 급격히 넓어져
// 원근이 드러나게 함. 색 네 단으로 가장자리와 바퀴자국을 표현.
function drawPath(ctx, W, yTop, yBot, s, seed, xTop, xBot){
  const a = (xTop === undefined) ? 0.30 : xTop;
  const b = (xBot === undefined) ? 0.30 : xBot;
  for (let y = yTop; y < yBot; y += s) {
    const t = (y - yTop) / (yBot - yTop);
    const e = t * t;                                     // 가까울수록 빠르게 넓어짐
    const cx = W * (a + (b - a) * e) + Math.sin(t * 2.0 + seed) * W * 0.035;
    const w = s * (1.2 + e * 20);
    const px = Math.round((cx - w / 2) / s) * s;
    const pw = Math.max(s, Math.round(w / s) * s);
    ctx.fillStyle = SCENE.path[1]; ctx.fillRect(px, y, pw, s);
    ctx.fillStyle = SCENE.path[0]; ctx.fillRect(px + s, y, Math.max(s, pw - s * 2), s);
    ctx.fillStyle = SCENE.path[2]; ctx.fillRect(px, y, s, s);
    ctx.fillStyle = SCENE.path[3]; ctx.fillRect(px + pw - s, y, s, s);
    if (pw > s * 6 && Math.round(y / s) % 3 === 0) {      // 흙바닥 결
      ctx.fillStyle = SCENE.path[2];
      ctx.fillRect(px + Math.round(pw * 0.35 / s) * s, y, s, s);
    }
  }
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  const q = v => Math.round(v / 4) * 4;  // 도트 느낌은 남기되 단계를 촘촘하게
  const mixed = pa.map((v, i) => q(Math.round(v + (pb[i] - v) * t)));
  return '#' + mixed.map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}

// ---------- 배경 겹 전용 도구 (내부 페이지에서만 씀) ----------
// pixel.js 는 event/ 도 로드하지만 아래 셋은 호출하지 않으면 아무 일도 안 하는 순수 함수다.

// 스프라이트가 실제로 쓰는 팔레트 문자만 훑어, 크림 쪽으로 물 뺀 paletteOverride 를 만든다.
// 문자를 손으로 열거하면 반드시 샌다 — tree 는 7문자, frame 은 6문자다.
// 어두운 색(윤곽선)은 배경에서 글자를 가장 방해하므로 조금 더 세게 뺀다.
function washPal(sprite, t, base){
  const used = new Set();
  for (const row of sprite) for (const ch of row) if (ch !== '.') used.add(ch);
  const out = {};
  used.forEach(ch => {
    const c = PAL[ch];
    if (!c) return;
    const lum = [1,3,5].reduce((n,i) => n + parseInt(c.substr(i,2),16), 0) / 765;
    out[ch] = mixHex(c, base, Math.min(0.95, t + (lum < 0.35 ? 0.02 : 0)));
  });
  return out;
}

// SCENE 의 일부를 잠깐 바꿔 끼우고 fn 을 실행한 뒤 반드시 되돌린다.
// drawFluffyCloud 는 색을 인자로 못 받고 SCENE.cloud 를 함수 안에서 직접 읽기 때문에 필요하다.
// SCENE 은 첫 페이지·이벤트 페이지와 공유하는 전역이라, 원복이 빠지면 그쪽 색이 같이 죽는다.
function withScene(patch, fn){
  const saved = {};
  Object.keys(patch).forEach(k => { saved[k] = SCENE[k]; });
  Object.assign(SCENE, patch);
  try { return fn(); }
  finally { Object.assign(SCENE, saved); }
}

// 먼 겹 캔버스의 아래 이음매 전용. y0 부터 여섯 줄에 걸쳐 크림으로 계단식으로 흩어지고,
// 그 아래는 크림 단색으로 채운다. 겹이 위로 밀려 올라가도 화면에 빈틈이 안 생기게 하는 장치.
function groundOut(ctx, W, H, y0, s, fromColor, toColor){
  const cols = Math.ceil(W / s);
  const steps = [1, 2, 2, 3, 4, 4];          // 아래로 갈수록 크림 비율이 늘어남 (4칸 중 몇 칸)
  steps.forEach((thresh, k) => {
    const y = Math.round((y0 + k * s) / s) * s;
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = ((c + k * 2) % 4) < thresh ? toColor : fromColor;
      ctx.fillRect(c * s, y, s, s);
    }
  });
  const solid = Math.round((y0 + steps.length * s) / s) * s;
  ctx.fillStyle = toColor;
  ctx.fillRect(0, solid, W, Math.max(0, H - solid));
}
