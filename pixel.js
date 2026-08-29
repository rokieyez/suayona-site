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
  // 캐릭터: 수아 — 단발머리, 코랄 옷 12x18
  sua: [
    '...zzzzzz...',
    '..zzzzzzzz..',
    '.zzzzzzzzzz.',
    '.zwwwwwwwwz.',
    '.zwFwwwwFwz.',
    '.zwwwwwwwwz.',
    '.zwwwFFwwwz.',
    '..zwwwwwwz..',
    '...wwwwww...',
    '....wwww....',
    '..AAAAAAAA..',
    '.AAAAAAAAAA.',
    'wAAAAAAAAAAw',
    'wAAAAAAAAAAw',
    '.ABBBBBBBBA.',
    '..BBBBBBBB..',
    '...ww..ww...',
    '...zz..zz...',
  ],
  // 캐릭터: 연아 — 양갈래머리, 민트 옷 12x18
  yona: [
    '..zzzzzzzz..',
    '.zzzzzzzzzz.',
    'zzzwwwwwwzzz',
    'zzzwwwwwwzzz',
    'zzzwFwwFwzzz',
    'zzzwwwwwwzzz',
    '.zzwwFFwwzz.',
    '..zwwwwwwz..',
    '...wwwwww...',
    '....wwww....',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    'wCCCCCCCCCCw',
    'wCCCCCCCCCCw',
    '.CDDDDDDDDC.',
    '..DDDDDDDD..',
    '...ww..ww...',
    '...zz..zz...',
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
  // 말풍선 (게시판 아이콘) 12x10
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
  // 편지 (컨택트 아이콘) 12x9
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

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  const q = v => Math.round(v / 8) * 8;  // 색 단계를 거칠게 끊어 도트 느낌 유지
  const mixed = pa.map((v, i) => q(Math.round(v + (pb[i] - v) * t)));
  return '#' + mixed.map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
}
