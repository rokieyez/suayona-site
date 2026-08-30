// ---------------------------------------------------------------------------
// 수아랑 연아랑 — 통째로 내려받기
//
//   node tools/backup.mjs [내려받을곳]
//   (안 적으면 ~/수아랑연아랑-백업 에 쌓인다)
//
// 사진·영상·목소리 파일과 글·일정·시간표를 전부 이 컴퓨터로 가져온다.
// 두 번째부터는 이미 받아 둔 파일을 건너뛰므로 새로 올린 것만 받는다.
//
// 비밀번호는 물어보기만 하고 어디에도 적어 두지 않는다. 화면에도 안 보이고,
// 받은 파일 어디에도 남지 않는다. 매번 다시 물어본다.
//
// 받을 파일 목록은 저장소를 훑는 대신 글·작품·일정에 적힌 주소에서 뽑는다.
// 그래야 "지금 화면에 쓰이는 것"과 정확히 같은 것을 받게 된다.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const SB_URL = 'https://ifiemaypzjwdrljmmkgb.supabase.co';
const SB_KEY = 'sb_publishable_uhn46d4RFI5DeIUjtz3IRA_U9X8iPZj';

// 통째로 가져올 표. 사진 주소가 들어 있는 칸은 아래 URL_FIELDS 에 적어 둔다.
const TABLES = [
  'works', 'posts', 'events', 'gallery_media',
  'event_meta', 'custom_tabs', 'schedules', 'messages', 'profiles',
];
const BUCKETS = ['event-images', 'gallery-uploads'];
const PAGE = 1000;
const PARALLEL = 5;

const OUT   = path.resolve(process.argv[2] || path.join(os.homedir(), '수아랑연아랑-백업'));
const FILES = path.join(OUT, '사진');
const DB    = path.join(OUT, '기록');

const today = new Date().toISOString().slice(0, 10);
const say = (...a) => console.log(...a);

// ---------- 물어보기 (비밀번호는 화면에 안 보이게) ----------
// 한 창구(readline)로 둘 다 받는다. 따로 받으면 파이프로 넣었을 때 두 번째가 사라진다.
// 매달 자동으로 돌리고 싶으면 SUAYONA_EMAIL / SUAYONA_PASSWORD 를 넣어 두면 안 묻는다.
function prompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  rl.on('close', () => { closed = true; });
  const ask = (q, hidden) => new Promise(resolve => {
    if (closed) return resolve('');      // 입력이 이미 끝났으면 더 묻지 않는다
    let muted = false, settled = false;
    const orig = rl._writeToOutput ? rl._writeToOutput.bind(rl) : null;
    const finish = ans => {
      if (settled) return;
      settled = true;
      muted = false;
      if (orig) rl._writeToOutput = orig;
      rl.off('close', onClose);
      if (hidden) process.stdout.write('\n');
      resolve((ans || '').trim());
    };
    // 답을 못 받고 입력이 끝나 버리면(파이프로 넣었을 때 등) 빈 값으로 마무리한다.
    // 이걸 안 두면 기다리던 약속이 영영 안 풀려서, 아무 말 없이 성공한 척 끝난다.
    const onClose = () => finish('');
    rl.on('close', onClose);
    if (hidden && orig) rl._writeToOutput = str => { if (!muted) orig(str); };
    rl.question(q, finish);
    muted = hidden;                       // 물음말은 보여 주고, 그 뒤 입력만 가린다
  });
  return { ask, close: () => { if (!closed) rl.close(); } };
}

// ---------- 로그인 ----------
async function signIn(email, password) {
  const res = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = body.error_description || body.msg || body.message || ('HTTP ' + res.status);
    throw new Error('로그인하지 못했어요: ' + why);
  }
  return body.access_token;
}

// ---------- 표 읽기 ----------
// 한 번에 다 못 받아올 수 있어서 나눠 받고, 서버가 알려 준 전체 개수와 맞는지 확인한다.
// 반만 받아 놓고 "다 받았다"고 하면 백업이 아니라 착각이 된다.
async function fetchTable(table, token) {
  const rows = [];
  let total = null;
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + token,
        Range: `${from}-${from + PAGE - 1}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok && res.status !== 206) {
      throw new Error(`${table} 을 읽지 못했어요 (HTTP ${res.status}): ${await res.text()}`);
    }
    const part = await res.json();
    rows.push(...part);
    const m = /\/(\d+|\*)\s*$/.exec(res.headers.get('content-range') || '');
    if (m && m[1] !== '*') total = Number(m[1]);
    if (part.length < PAGE) break;
  }
  if (total != null && rows.length !== total) {
    throw new Error(`${table} 을 다 읽지 못했어요 (${rows.length}/${total}). 백업을 멈춥니다.`);
  }
  return rows;
}

// ---------- 사진 주소 모으기 ----------
const URL_FIELDS = ['media_url', 'thumb_url', 'audio_url', 'image_url'];

function collectUrls(dump) {
  const found = new Set();
  const take = v => { if (typeof v === 'string' && v.includes('/storage/v1/object/public/')) found.add(v); };
  const walk = v => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (URL_FIELDS.includes(k) || k === 'url' || k === 'thumb') take(val);
        else if (val && typeof val === 'object') walk(val);
      }
    }
  };
  for (const rows of Object.values(dump)) rows.forEach(walk);
  return [...found];
}

// 공개 주소 -> { bucket, path }
function splitUrl(url) {
  for (const bucket of BUCKETS) {
    const tail = url.split('/object/public/' + bucket + '/')[1];
    if (tail) return { bucket, path: decodeURIComponent(tail.split('?')[0]) };
  }
  return null;
}

// ---------- 파일 내려받기 ----------
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.내려받는중';
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);                 // 다 받은 뒤에야 제자리에 놓는다
  return fs.statSync(dest).size;
}

async function downloadAll(urls) {
  let got = 0, skipped = 0, bytes = 0;
  const failed = [];
  let at = 0;

  async function worker() {
    while (at < urls.length) {
      const i = at++;
      const url = urls[i];
      const where = splitUrl(url);
      if (!where) { failed.push({ url, why: '주소 모양이 낯설어요' }); continue; }
      const dest = path.join(FILES, where.bucket, where.path);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped++; continue; }
      try {
        bytes += await download(url, dest);
        got++;
      } catch (e) {
        failed.push({ url, why: (e && e.message) || String(e) });
      }
      if ((got + skipped + failed.length) % 20 === 0) {
        process.stdout.write(`\r   ${got + skipped + failed.length}/${urls.length} ...   `);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  process.stdout.write('\r');
  return { got, skipped, bytes, failed };
}

// ---------- 받아 둔 것이 실제로 다 있는지 ----------
function verify(urls) {
  const missing = [];
  for (const url of urls) {
    const where = splitUrl(url);
    if (!where) continue;
    const dest = path.join(FILES, where.bucket, where.path);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) missing.push(where.path);
  }
  return missing;
}

const mb = n => (n / 1048576).toFixed(1) + ' MB';

// ---------- 본체 ----------
async function main() {
  say('수아랑 연아랑 — 통째로 내려받기');
  say('받는 곳: ' + OUT + '\n');

  let email = process.env.SUAYONA_EMAIL || '';
  let password = process.env.SUAYONA_PASSWORD || '';
  if (!email || !password) {
    const p = prompter();
    if (!email) email = await p.ask('부모 계정 이메일: ', false);
    if (!password) password = await p.ask('비밀번호 (화면에 안 보입니다): ', true);
    p.close();
  }
  if (!email || !password) { say('\n이메일과 비밀번호가 있어야 합니다.'); process.exit(1); }

  process.stdout.write('로그인 중... ');
  const token = await signIn(email, password);
  say('됐습니다.\n');

  // 1) 글·작품·일정 내려받기
  const dump = {};
  for (const t of TABLES) {
    process.stdout.write('  ' + t + ' ... ');
    try {
      dump[t] = await fetchTable(t, token);
      say(dump[t].length + '줄');
    } catch (e) {
      say('건너뜀 (' + ((e && e.message) || e) + ')');
      dump[t] = null;                        // 못 받은 표는 아예 저장하지 않는다
    }
  }
  const snapshot = path.join(DB, today);
  fs.mkdirSync(snapshot, { recursive: true });
  for (const [t, rows] of Object.entries(dump)) {
    if (rows) fs.writeFileSync(path.join(snapshot, t + '.json'), JSON.stringify(rows, null, 2));
  }
  say('\n기록을 ' + snapshot + ' 에 넣었습니다.');

  // 2) 사진·영상·목소리 내려받기
  const urls = collectUrls(Object.fromEntries(Object.entries(dump).filter(([, v]) => v)));
  say('\n사진·영상·목소리 ' + urls.length + '개를 확인합니다...');
  const res = await downloadAll(urls);
  say(`  새로 받음 ${res.got}개 (${mb(res.bytes)}) · 이미 있어서 건너뜀 ${res.skipped}개` +
      (res.failed.length ? ` · 실패 ${res.failed.length}개` : ''));
  res.failed.slice(0, 5).forEach(f => say('    ✗ ' + f.url.split('/').pop() + ' — ' + f.why));

  // 3) 정말 다 있는지 다시 센다
  const missing = verify(urls);
  say('\n확인: 쓰이는 파일 ' + urls.length + '개 중 ' + (urls.length - missing.length) + '개가 이 컴퓨터에 있습니다.');
  if (missing.length) {
    say('  없는 것 ' + missing.length + '개:');
    missing.slice(0, 5).forEach(m => say('    · ' + m));
    say('  다시 한 번 돌리면 없는 것만 받습니다.');
  }

  // 4) 나중에 이 폴더를 발견할 사람을 위한 쪽지
  fs.writeFileSync(path.join(OUT, '이게 무엇인가요.txt'),
`수아랑 연아랑 (www.suayona.com) 백업
마지막으로 받은 날: ${today}

  사진/   올린 사진·영상·아이 목소리 원본. 홈페이지에 있는 그대로입니다.
          .thumb.jpg 로 끝나는 것은 화면에 빨리 띄우려고 만든 작은 사본이라,
          없어도 원본만 있으면 됩니다.

  기록/   글·작품 설명·일정·시간표를 날짜별로 담아 둔 것(JSON).
          사진이 어디에 붙어 있었는지, 언제 찍은 것인지, 아이가 뭐라고 했는지가
          여기 들어 있습니다. 사진만으로는 알 수 없는 것들입니다.

다시 받으려면 홈페이지 폴더에서:
  node tools/backup.mjs "${OUT}"

이미 받아 둔 사진은 건너뛰므로 두 번째부터는 금방 끝납니다.
`);

  say('\n끝났습니다. ' + OUT);
  if (res.failed.length || missing.length) process.exit(1);
}

// 직접 실행했을 때만 돈다. 이렇게 두면 각 조각을 따로 불러 시험할 수 있다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error('\n멈췄습니다: ' + ((e && e.message) || e));
    process.exit(1);
  });
}

export { fetchTable, collectUrls, splitUrl, download, downloadAll, verify, signIn };
