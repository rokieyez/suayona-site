// 캐시 꼬리표(?v=)를 내용 해시로 붙인다: node tools/stamp-versions.mjs [폴더=.]
//
// 왜: HTML 도 JS 도 max-age=600 으로 나가고 파일마다 따로 돈다. 꼬리표를 손으로 붙이던 때는 꼬리표 그대로
// 내용만 바뀐 적이 세 번 있었고, 꼬리표가 없는 쪽(index·quest·honors·portfolio …)은 새 JS 와 옛 common.js 가
// 짝지어질 수 있었다. 내용이 바뀌면 주소가 바뀌게 해서 「이 HTML 이 부르는 JS·CSS 는 늘 이 HTML 과 같은 배포의 것」을 보장한다.
//
// 배포 사본에서만 돈다(.github/workflows/pages.yml). 저장소의 HTML 은 건드리지 않는다 — 로컬에서 돌리면
// 작업 폴더의 HTML 이 고쳐지니, 확인할 때는 사본에 돌린다.
//   · 모든 *.html 에서 같은 출처의 <script src>·<link rel="stylesheet" href> 가 가리키는 .js·.css 를
//     ?v=<파일 내용 sha1 앞 8자> 로 바꾼다. 이미 ?v= 가 있으면 갈아 끼운다. 두 번 돌려도 결과가 같다.
//   · 바깥 주소(https:·//)와 data: 는 그대로 둔다. 가리키는 파일이 없으면 모아서 알리고 exit 1.
//   · sw.js 의 「PRECACHE-HASH」 주석 줄에 PRECACHE 파일들의 해시를 찍는다(CACHE 이름은 그대로). 미리 담아 둔 놀이 쪽(draw.js 등)은 sw.js 바이트가
//     바뀔 때만 다시 담겼는데, 공용 파일(common.js)만 바뀐 배포에서는 옛 draw.js + 새 common.js 가 짝지어질 수 있었다.
// JS 안에서 동적으로 부르는 주소(farm.js 의 PLAY_V, index.js 의 kid-art·korea-sig …)는 여기서 못 고친다 — tools/README.md 참고.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, relative, sep } from 'node:path';

const ROOT = resolve(process.argv[2] || '.');
// 올리지 않는 폴더(pages.yml 이 뒤에서 지운다)와 의존성·백업은 안 본다.
const SKIP = new Set(['node_modules', '.git', 'backup', 'docs', 'tools', '.github']);
const errors = [];
const sha = buf => createHash('sha1').update(buf).digest('hex').slice(0, 8);
const rel = f => relative(ROOT, f).split(sep).join('/');

function* htmlFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) yield* htmlFiles(join(dir, e.name)); }
    else if (e.name.endsWith('.html')) yield join(dir, e.name);
  }
}

const hashCache = new Map();
function hashOf(file) {
  if (!hashCache.has(file)) hashCache.set(file, sha(readFileSync(file)));
  return hashCache.get(file);
}

const isFile = f => { try { return statSync(f).isFile(); } catch { return false; } };

let changed = 0, tags = 0;
for (const file of htmlFiles(ROOT)) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/<(script|link)\b[^>]*>/gi, tag => {
    const isScript = /^<script/i.test(tag);
    if (!isScript && !/\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(tag)) return tag;
    const attr = isScript ? 'src' : 'href';
    return tag.replace(new RegExp(`(\\s${attr}\\s*=\\s*)(["'])([^"']*)\\2`, 'i'), (all, pre, q, val) => {
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(val)) return all;          // 바깥 주소·data:
      const [, path, query = '', hash = ''] = val.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
      if (!/\.(js|css)$/.test(path)) return all;
      const abs = path.startsWith('/') ? join(ROOT, decodeURIComponent(path)) : resolve(dirname(file), decodeURIComponent(path));
      if (!abs.startsWith(ROOT + sep) || !isFile(abs)) {
        errors.push(`${rel(file)}: ${val} — 가리키는 파일이 없다`);
        return all;
      }
      const params = query.slice(1).split('&').filter(s => s && !/^v=/.test(s));
      params.push('v=' + hashOf(abs));
      tags++;
      return `${pre}${q}${path}?${params.join('&')}${hash}${q}`;
    });
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

// ── sw.js: PRECACHE-HASH 줄에 미리 담을 파일들의 해시를 찍는다 (HTML 을 고친 뒤에 재야 그 HTML 의 꼬리표까지 담긴다) ──
const swFile = join(ROOT, 'sw.js');
const sw = readFileSync(swFile, 'utf8');
const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
const offline = sw.match(/const OFFLINE = '([^']+)'/);
if (!list || !offline) errors.push('sw.js: PRECACHE·OFFLINE 를 못 찾았다');
else {
  const h = createHash('sha1');
  const urls = [offline[1], ...[...list[1].replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map(m => m[1])];
  for (const u of urls) {
    const f = join(ROOT, u);
    if (!isFile(f)) { errors.push(`sw.js: PRECACHE 의 ${u} 가 없다`); continue; }
    h.update(u + '\0').update(readFileSync(f)).update('\0');
  }
  // CACHE 이름은 건드리지 않는다(sw.js 의 PRECACHE-HASH 주석에 까닭) — 주석 한 줄만 갈아 sw.js 바이트를 바꾼다
  const swAfter = sw.replace(/^(\/\/ PRECACHE-HASH: )\S+$/m, `$1${h.digest('hex').slice(0, 8)}`);
  if (!/^\/\/ PRECACHE-HASH: [0-9a-f]{8}$/m.test(swAfter)) errors.push('sw.js: PRECACHE-HASH 줄을 못 찾았다');
  else if (swAfter !== sw) writeFileSync(swFile, swAfter);
  console.log(swAfter.match(/^\/\/ PRECACHE-HASH: .*$/m)?.[0]);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`꼬리표 ${tags}개를 붙였다 (HTML ${changed}개 고침)`);
