/* 수아·연아 도트 그림 — 농장(farm.js)과 업적 전시실(honors.js)이 같이 쓴다.
   예전엔 farm.js 안에 있었다. 전시실에서도 같은 아이가 걸어 다니게 하려고 따로 뺐다(2026-09-15).
   farm.js·honors.js 보다 먼저 싣는다. 밖으로는 window.KIDART·window.KIDPAL 둘만 내놓고 나머지는 이 안에 가둔다 —
   배포 직후 새로고침하면 새 farm.html 이 캐시에 남은 옛 farm.js(같은 이름을 const 로 가진)와 짝지어질 수 있는데,
   여기서도 const 로 선언하면 「이미 선언됨」으로 farm.js 가 통째로 멈춘다(시험에서 확인). 창 속성은 const 와 부딪히지 않는다. */
(function(){
'use strict';
// 아이들 — 앞·옆·뒤 세 방향, 걸음 두 장. 팔레트만 갈아 끼우면 수아·연아가 된다.
// 아이들 — 앞·옆·뒤 세 방향, 걸음 두 장. 머리 모양은 둘이 다르고, 색표만 갈아 끼우면 옷이 바뀐다.
// 걸음 두 번째 장은 손으로 또 적지 않고 첫 장을 한 도트 내려앉혀 만든다.
function walkFrame(rows, legA, legB){
  // 걸음 두 번째 장 — 몸을 두 도트 내려앉히고 다리 네 줄만 갈아 끼운다
  const pad = '.'.repeat(rows[0].length);
  const out = [pad, pad].concat(rows.slice(0, rows.length - 2));
  out[out.length - 4] = legA; out[out.length - 3] = legA;
  out[out.length - 2] = legB; out[out.length - 1] = legB.replace(/b/g, 'B');
  return out;
}
// 짧은 머리 — 연아. 첫화면 히어로(pixel.js)의 버섯 단발·가운데 가르마를 그대로 옮겼다.
const KID_SHORT = {
  down: [
    '..........kkkkkkk...........', '........kkhhhhhhhkk.........', '......kkhhhhhHhhhhhkk.......', '.....khhhHHdHHHHdHhhhk......',
    '....khhHHHHdHHHHdHHHhhk.....', '...khhhhhhhdhhhhdhhhhhhk....', '..khhhhhhhhdhhhhdhhhhhhhk...', '..khhhhhhhfdffffdhhhhhhhk...',
    '.khhhhhhfffdffffdffhhhhhhk..', '.khhhhhffffdffffdfffhhhhhk..', 'khhhhhhffffdffffdfffhhhhhhk.', 'khhhhhfffffffffffffffhhhhhk.',
    'khhhhhfffffffffffffffhhhhhk.', 'khhhhhfffewffffffewffhhhhhhk', 'khhhhhfffeeffffffeeffhhhhhhk', 'khhhhhfffeeffffffeeffhhhhhhk',
    'khhhhhfffffffffffffffhhhhhhk', 'khhhhhfppffffffffffpphhhhhhk', 'khhhhhfppfffmffmfffpphhhhhhk', 'kddddddffffffmmfffffdddddddk',
    'kdddddFFFFFFFFFFFFFFFFdddddk', '.kkkkkFnnnnnnnnnnnnnnFkkkkk.', '.....kcnnnnnnnnnnnnnnck.....', '.....kccCCCECCCCECCCcck.....',
    '.....kcccccEccccEccccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....',
    '.....kssnnCCCCCCCCnnssk.....', '.....kssnnnnnnnnnnnnssk.....', '......kkVVVVVVVVVVVVkk......', '.......kvvvvvkkvvvvvk.......',
    '.......kvvvvvkkvvvvvk.......', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  side: [
    '..........kkkkkkk...........', '........kkhhhhhhhkk.........', '......kkhhhhhHhhhhhkk.......', '.....khhhHHHHHHHHHhhhk......',
    'kkkkkhhHHHHHHHHHHHHHhhk.....', 'hhhhhhhhhhhhhhhhhhhhhhhk....', 'hhhhhhhhhhhhhhhhhhhhhhhhk...', 'hHHHhhhhhhhhhfffffffhhhhk...',
    'hHHHhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhfffffffffffhhhhk.', 'hHHHhhhhhhhfffffffffffhhhhk.',
    'hHHHhhhhhhhffffffffffffhhhk.', 'hHHHhhhhhhhfffffewfffffhhhhk', 'hHHHhhhhhhhfffffeefffffhhhhk', 'hHHHhhhhhhhfffffeefffffhhhhk',
    'hHHHhhhhhhhffffffffffFfhhhhk', 'hHHHhhhhhhhffffffffppffhhhhk', 'hhhhhhhhhhhffffffmmppfhhhhhk', 'dddddddddddfffffffffffdddddk',
    'dddddddddddFFFFFFFFFFFdddddk', 'kkkkkkknnnnnnnnnnnnnnFkkkkk.', '.....kcnnnnnnnnnnnnnnck.....', '.....kccCCCECCCCECCCcck.....',
    '.....kcccccEccccEccccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....', '.....kccccCECCCCECcccck.....',
    '.....kssnnCCCCCCCCnnssk.....', '.....kssnnnnnnnnnnnnssk.....', '......kkVVVVVVVVVVVVkk......', '.......kvvvvvkkvvvvvk.......',
    '.......kvvvvvkkvvvvvk.......', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  up: [
    '..........kkkkkkk...........', '........kkhhhhhhhkk.........', '......kkhhhhhHhhhhhkk.......', '.....khhhHHHHHHHHHhhhk......',
    '....khhHHHHHHHHHHHHHhhk.....', '...khhhhhhhhhhhhhhhhhhhk....', '..khhhhhhhHHHHHHHhhhhhhhk...', '..khhhhhhHHHHHHHHHhhhhhhk...',
    '.khhhhhhHHHHHHHHHHHhhhhhhk..', '.khhhhhhHHHHHHHHHHHhhhhhhk..', 'khhhhhhhHHHHHHHHHHHhhhhhhhk.', 'khhhhhhhHHHHHHHHHHHhhhhhhhk.',
    'khhhhhhhHHHHHHHHHHHhhhhhhhk.', 'khhhhhhhHHHHHHHHHHHhhhhhhhhk', 'khhhhhhhHHHHHHHHHHHhhhhhhhhk', 'khhhhhhhHHHHHHHHHHHhhhhhhhhk',
    'khhhhhhhhHHHHHHHHHhhhhhhhhhk', 'khhhhhhhhhHHHHHHHhhhhhhhhhhk', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk',
    'kddddddddddddddddddddddddddk', 'kddddddnnnnnnnnnnnnnnddddddk', '.kkkkkcnnnnnnnnnnnnnnckkkkk.', '.....kcnnnnnnnnnnnnnnck.....',
    '.....kcccccccccccccccck.....', '.....kccccCCCCCCCCcccck.....', '.....kccccCCCCCCCCcccck.....', '.....kccccCCCCCCCCcccck.....',
    '.....kssnnnnnnnnnnnnssk.....', '.....kssnnnnnnnnnnnnssk.....', '......kkVVVVVVVVVVVVkk......', '.......kvvvvvkkvvvvvk.......',
    '.......kvvvvvkkvvvvvk.......', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
};
// 긴 머리 — 수아. 히어로처럼 머리가 어깨 너머로 흘러내려 몸을 감싼다.
const KID_LONG = {
  down: [
    '........kkhhhhhhhkk.........', '......kkhhhhhhhhhhhkk.......', '.....khhhhhhhhhhhhhhhk......', '....khhhhhhhhHhhhhhhhhk.....',
    '...khhhhhHHHHHHHHHhhhhhk....', '...khhhHHHHHHHHHHHHHhhhk....', '..khhhhhhhhhhhhhhhhhhhhhk...', '.khhhhhhhhfffffffhhhhhhhhk..',
    '.khhhhhhfffffffffffhhhhhhk..', '.khhhhhfffffffffffffhhhhhk..', 'khhhhhhfffffffffffffhhhhhhk.', 'khhhhhfffffffffffffffhhhhhk.',
    'khhhhhfffffffffffffffhhhhhk.', 'khhhhhfffewffffffewffhhhhhk.', 'khhhhhfffeeffffffeeffhhhhhhk', 'khhhhhfffeeffffffeeffhhhhhhk',
    'khHHhhfffffffffffffffhhhHHhk', 'khHHhhfppffffffffffpphhhHHhk', 'khHHhhfppfffmffmfffpphhhHHhk', 'khHHhhhffffffmmfffffhhhhHHhk',
    'khHHhhFFFFFFFFFFFFFFFFhhHHhk', 'khHHhhFFFFFFFFFFFFFFFFhhHHhk', 'khHHhhEEEEEEEEEEEEEEEEhhHHhk', 'khHHhhCCCCCCCCCCCCCCCChhHHhk',
    'khHHhhcccccccccccccccchhHHhk', 'khHHhhcccccccccccccccchhHHhk', 'khHHhhCCCCCCCCCCCCCCCChhHHhk', 'khHHhhCCCCCCCCCCCCCCCChhHHhk',
    'khhhhdssccccccccccccssdhhhhk', 'khhhhkssccccccccccccsskhhhhk', 'kddddkkkVVVVVVVVVVVVkkkddddk', 'kddddk.kvvvvvkkvvvvvk.kddddk',
    '.kkkk..kvvvvvkkvvvvvk..kkkk.', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  side: [
    '........kkhhhhhhhkk.........', '......kkhhhhhhhhhhhkk.......', '.....khhhhhhhhhhhhhhhk......', '....khhhhhhhhHhhhhhhhhk.....',
    '...khhhhhHHHHHHHHHhhhhhk....', 'kkkkhhhHHHHHHHHHHHHHhhhk....', 'hhhhhhhhhhhhhhhhhhhhhhhhk...', 'hhhhhhhhhhhhhfffffffhhhhhk..',
    'hhhhhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhhfffffffffhhhhk..', 'hHHHhhhhhhhfffffffffffhhhhk.', 'hHHHhhhhhhhfffffffffffhhhhk.',
    'hHHHhhhhhhhffffffffffffhhhk.', 'hHHHhhhhhhhfffffewfffffhhhk.', 'hHHHhhhhhhhfffffeefffffhhhhk', 'hHHHhhhhhhhfffffeefffffhhhhk',
    'hHHHhhhhhhhffffffffffFfhHHhk', 'hHHHhhhhhhhffffffffppffhHHhk', 'hHHHhhhhhhhffffffmmppfhhHHhk', 'hHHHhhhhhhhfffffffffffhhHHhk',
    'hHHHhhhhhhhFFFFFFFFFFFhhHHhk', 'hHHHhhhhhhhFFFFFFFFFFFhhHHhk', 'hHHHhhEEEEEEEEEEEEEEEEhhHHhk', 'hHHHhhCCCCCCCCCCCCCCCChhHHhk',
    'hHHHhhcccccccccccccccchhHHhk', 'hHHHhhcccccccccccccccchhHHhk', 'hHHHhhCCCCCCCCCCCCCCCChhHHhk', 'hHHHhhCCCCCCCCCCCCCCCChhHHhk',
    'hhhhhdssccccccccccccssdhhhhk', 'hhhhhhssccccccccccccsskhhhhk', 'ddddddddVVVVVVVVVVVVkkkddddk', 'ddddddddvvvvvkkvvvvvk.kddddk',
    'kkkkkkkkvvvvvkkvvvvvk..kkkk.', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
  up: [
    '........kkhhhhhhhkk.........', '......kkhhhhhhhhhhhkk.......', '.....khhhhhhhhhhhhhhhk......', '....khhhhhhhhHhhhhhhhhk.....',
    '...khhhhhHHHHHHHHHhhhhhk....', '...khhhHHHHHHHHHHHHHhhhk....', '..khhhhhhhhhhhhhhhhhhhhhk...', '.khhhhhhhhhhhhhhhhhhhhhhhk..',
    '.khhhhhhhhhhhhhhhhhhhhhhhk..', '.khhhhhhhhhhhhhhhhhhhhhhhk..', 'khhhhhhhhhhhhhhhhhhhhhhhhhk.', 'khhhhhhhhhhhhhhhhhhhhhhhhhk.',
    'khhhhhhhhhhhhhhhhhhhhhhhhhk.', 'khhhhhhhhhhhhhhhhhhhhhhhhhk.', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk', 'khhhhhhhhhhhhhhhhhhhhhhhhhhk',
    'khHHhhhhhhHHHHHHHhhhhhhhHHhk', 'khHHhhhhhhHHHHHHHhhhhhhhHHhk', 'khHHhhhhhHHHHHHHHHhhhhhhHHhk', 'khHHhhhhhHHHHHHHHHhhhhhhHHhk',
    'khHHhhhhhHHHHHHHHHhhhhhhHHhk', 'khHHhhhhhHHHHHHHHHhhhhhhHHhk', 'khHHhhcchHHHHHHHHHhhcchhHHhk', 'khHHhhcchHHHHHHHHHhhcchhHHhk',
    'khHHhhcchHHHHHHHHHhhcchhHHhk', 'khHHhhcchHHHHHHHHHhhcchhHHhk', 'khHHhhcchhHHHHHHHhhhcchhHHhk', 'khHHhhcchhHHHHHHHhhhcchhHHhk',
    'khhhhhsshhhhHHHhhhhhsshhhhhk', 'khhhhdsshhhhhhhhhhhhssdhhhhk', 'kdddddddVVVVVVVVVVVVdddddddk', 'kdddddddvvvvvkkvvvvvdddddddk',
    '.kkkkkkkvvvvvkkvvvvvkkkkkkk.', '........ksssskkssssk........', '........ksssskkssssk........', '........kbbbbkkbbbbk........',
    '........kbbbbkkbbbbk........', '........kBBBBkkBBBBk........',
  ],
};


function kidSet(base){
  return {
    down: [base.down, walkFrame(base.down, '.......kssssk..kssssk.......', '.......kbbbbk..kbbbbk.......')],
    side: [base.side, walkFrame(base.side, '.......kssssk..kssssk.......', '.......kbbbbk..kbbbbk.......')],
    up:   [base.up,   walkFrame(base.up,   '.......kssssk..kssssk.......', '.......kbbbbk..kbbbbk.......')],
  };
}
const KIDART_ = { sua: kidSet(KID_LONG), yona: kidSet(KID_SHORT) };
const KIDPAL_ = {
  // 메인 첫화면 캐릭터와 같은 색을 쓴다.
  // 수아 — 진갈색 긴 머리, 빨강·흰 줄무늬 상의, 남색 반바지, 주황 신발
  sua:  { k: '#3a3226', h: '#3f2d23', H: '#634a37', d: '#2b1e17', f: '#fbdcc4', F: '#eec3a2', e: '#3a3226', w: '#ffffff',
          m: '#c9333f', p: '#ffb0b8', c: '#ea2027', C: '#fdfdfd', n: '#c2151b', E: '#ffffff',
          s: '#fbdcc4', v: '#2e3a54', V: '#41506e', b: '#e8912f', B: '#c47320' },
  // 연아 — 적갈색 단발, 노란 후드(흰 끈), 남색 반바지, 주황 신발
  yona: { k: '#3a3226', h: '#a0562c', H: '#bd6c3a', d: '#77401f', f: '#fbdcc4', F: '#eec3a2', e: '#3a3226', w: '#ffffff',
          m: '#c9333f', p: '#ffb0b8', c: '#ffe66d', C: '#fff3ae', n: '#ffc94d', E: '#ffffff',
          s: '#fbdcc4', v: '#2e3a54', V: '#41506e', b: '#e8912f', B: '#c47320' },
};
window.KIDART = KIDART_;
window.KIDPAL = KIDPAL_;
})();
