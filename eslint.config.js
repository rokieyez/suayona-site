// eslint 설정 — 이 사이트의 유일한 「검사 도구」다. 빌드는 없다.
//
// 왜 필요한가:
//   페이지 스크립트가 HTML 안에 인라인으로 있던 동안에는 문법 오류를 배포하고 나서야
//   알았다. 첫 화면이 통째로 빈 적도 있다. 이제 pages/*.js 로 빠졌으니 `npm run lint`
//   한 번이면 19쪽의 코드를 배포 전에 다 훑는다.
//
// 이 코드베이스의 특징을 설정에 그대로 옮겼다:
//   · 모듈이 아니라 「같은 전역을 나눠 쓰는 클래식 스크립트」다. common.js 가 정의한
//     $·sb·escapeHTML 같은 이름을 pages/*.js 가 그냥 쓴다. 그래서 파일마다
//     `no-undef` 가 울지 않게, 공유 파일의 최상위 선언을 읽어 전역 목록으로 넣는다 —
//     손으로 118개를 적어 두면 금세 낡는다.
//   · 빈 catch 가 68곳 있다. 대부분은 의도(localStorage 실패, 자동재생 거부)지만
//     코드만 봐서는 의도와 실수가 구별이 안 된다. `no-empty` 는 블록 안에 주석이
//     있으면 통과시키므로, 이 규칙 하나로 「왜 삼키는지 한 줄 적기」를 강제한다.
const fs = require('node:fs');
const path = require('node:path');
const globals = require('globals');

// 공유 스크립트의 최상위 const/let/function 이름을 전역으로 등록한다.
function topLevelNames(file) {
  const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const out = {};
  for (const m of src.matchAll(/^(?:function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
    out[m[1]] = 'readonly';
  }
  // `let a = 1, b = 2` 처럼 한 줄에 여럿 선언한 것도 다 잡는다 — 첫 이름만 잡으면
  // 짝 파일에서 W·M·REV 같은 이름이 no-undef 로 울린다. 괄호 안의 쉼표는 안 센다.
  for (const m of src.matchAll(/^(?:const|let|var)\s+([^\n]*)/gm)) {
    let depth = 0, part = '';
    for (const ch of m[1]) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { addName(out, part); part = ''; continue; }
      part += ch;
    }
    addName(out, part);
  }
  return out;
}
function addName(out, part) {
  const m = part.trim().match(/^([A-Za-z_$][\w$]*)/);
  if (m) out[m[1]] = 'readonly';
}
const shared = Object.assign(
  {},
  topLevelNames('common.js'),
  topLevelNames('pixel.js'),
  topLevelNames('village.js'),       // Village — index.html 이 pixel.js 뒤에 싣는다
  topLevelNames('event/compress.js'),
  topLevelNames('farm-rules.js'),    // FARM — farm.html 이 common.js 뒤에 싣는다
  topLevelNames('quest-rules.js'),   // QUEST — quest.html 도 같다
);

// 바깥 라이브러리가 만드는 전역
const vendor = {
  supabase: 'readonly',   // supabase-js (CDN)
  kakao: 'readonly',      // 카카오 지도 SDK
  exifr: 'readonly',      // event/compress.js 가 늦게 싣는다
  qrcode: 'readonly',     // portfolio 가 늦게 싣는다
  module: 'writable',     // farm-rules / quest-rules 가 node 에서도 돌게 한다
  require: 'readonly',
};

// 농장은 두 파일이 한 벌이다 — pages/farm.js 가 손님도 받는 그림 몫,
// pages/farm-play.js 가 로그인한 사람만 받는 놀이 몫. 둘은 같은 전역 렉시컬 환경을
// 나눠 쓰므로 서로의 최상위 이름을 전역으로 넣어 준다.
const farmPair = Object.assign({}, topLevelNames('pages/farm.js'), topLevelNames('pages/farm-play.js'));

module.exports = [
  { ignores: ['node_modules/**', '_*.js', 'tools/**'] },

  // 공유 스크립트와 페이지 스크립트 — 브라우저 전역 + 우리 전역
  {
    files: ['common.js', 'pixel.js', 'village.js', 'event/compress.js', 'pages/**/*.js', 'farm-rules.js', 'quest-rules.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: Object.assign({}, globals.browser, shared, vendor),
    },
    rules: {
      // 진짜 버그를 잡는 것들
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-unsafe-negation': 'error',
      'no-self-assign': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-const-assign': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      // 안 쓰는 지역 변수는 실수일 때가 많다. 최상위(전역)는 다른 파일이 쓸 수 있어 뺀다.
      'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
    },
  },

  // 농장 두 짝은 서로의 이름을 쓴다
  {
    files: ['pages/farm.js', 'pages/farm-play.js'],
    languageOptions: { globals: farmPair },
  },

  // 서비스 워커 — 전역이 다르다
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: Object.assign({}, globals.serviceworker),
    },
    rules: { 'no-undef': 'error', 'no-empty': ['error', { allowEmptyCatch: false }] },
  },

  // 이 설정 파일 자신은 node 다
  {
    files: ['eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
  },
];
