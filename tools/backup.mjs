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
// 무엇을 받을지는 여기 적어 두지 않고 DB 에 묻는다 (부모만 부를 수 있는 함수 둘):
//   backup_table_names()  지금 있는 표 전부
//   storage_file_usage()  저장소에 있는 파일 전부
// 전에는 표 9개와 「주소가 든 칸」 목록을 여기 적어 두었는데, 그 뒤 생긴 표
// (honors·places·growth …)와 상장·장소 사진 119개가 백업에서 빠져 있었다(2026-09-19).
// 적어 둔 목록은 낡는다 — 그래서 목록을 없앴다.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const SB_URL = 'https://ifiemaypzjwdrljmmkgb.supabase.co';
const SB_KEY = 'sb_publishable_uhn46d4RFI5DeIUjtz3IRA_U9X8iPZj';

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

// ---------- 끊긴 망 기다리기 ----------
// 일요일 밤 자동 실행은 맥이 막 깨어난 참이라 망이 아직 안 붙어 있을 때가 있다
// (2026-09-13 백업이 「로그인 중... fetch failed」 한 줄로 끝났다). 서버가 「안 된다」고
// 답한 것은 다시 물어도 같으므로 그대로 두고, 아예 닿지 못한 것만 기다렸다 다시 한다.
const RETRY_WAITS = [5, 15, 30, 60, 120];            // 초. 다 합쳐 4분쯤
async function reach(url, opts) {
  for (let i = 0; ; i++) {
    try { return await fetch(url, opts); }
    catch (e) {
      if (i >= RETRY_WAITS.length) throw e;
      say(`\n  (망에 닿지 못했어요 — ${RETRY_WAITS[i]}초 뒤 다시 해 봅니다)`);
      await new Promise(r => setTimeout(r, RETRY_WAITS[i] * 1000));
    }
  }
}

// ---------- 로그인 ----------
async function signIn(email, password) {
  const res = await reach(SB_URL + '/auth/v1/token?grant_type=password', {
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
    const res = await reach(`${SB_URL}/rest/v1/${table}?select=*`, {
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

// ---------- DB 에 묻기 ----------
async function rpc(name, token) {
  const res = await reach(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`${name} 을 부르지 못했어요 (HTTP ${res.status}): ${await res.text()}`);
  return res.json();
}

// 저장소 파일 하나의 주소. 공개 버킷은 공개 주소로, 아니면 로그인한 채로 받는다.
function fileUrl(f) {
  const tail = f.name.split('/').map(encodeURIComponent).join('/');
  return `${SB_URL}/storage/v1/object/${f.is_public ? 'public' : 'authenticated'}/${f.bucket}/${tail}`;
}
const fileDest = f => path.join(FILES, f.bucket, f.name);

// ---------- 파일 내려받기 ----------
async function download(url, dest, token) {
  const res = await reach(url, token ? { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token } } : undefined);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.내려받는중';
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);                 // 다 받은 뒤에야 제자리에 놓는다
  return fs.statSync(dest).size;
}

// 이미 받아 둔 것인지. 크기까지 같아야 받은 것으로 친다 — 이름만 같고 반쪽인 파일을 거르려고.
function have(f) {
  const dest = fileDest(f);
  if (!fs.existsSync(dest)) return false;
  const n = fs.statSync(dest).size;
  return n > 0 && (!f.size || n === Number(f.size));
}

async function downloadAll(files, token) {
  let got = 0, skipped = 0, bytes = 0;
  const failed = [];
  let at = 0;

  async function worker() {
    while (at < files.length) {
      const f = files[at++];
      if (have(f)) { skipped++; continue; }
      try {
        bytes += await download(fileUrl(f), fileDest(f), f.is_public ? null : token);
        got++;
      } catch (e) {
        failed.push({ name: f.name, why: (e && e.message) || String(e) });
      }
      if ((got + skipped + failed.length) % 20 === 0) {
        process.stdout.write(`\r   ${got + skipped + failed.length}/${files.length} ...   `);
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  process.stdout.write('\r');
  return { got, skipped, bytes, failed };
}

// ---------- 받아 둔 것이 실제로 다 있는지 ----------
const verify = files => files.filter(f => !have(f)).map(f => f.bucket + '/' + f.name);

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

  // 1) 표 전부 내려받기 — 어떤 표가 있는지는 DB 에 묻는다
  const tables = await rpc('backup_table_names', token);
  if (!Array.isArray(tables) || !tables.length) throw new Error('표 목록이 비어 있어요. 부모 계정인지 확인해 주세요.');
  const dump = {};
  const unread = [];
  for (const t of tables) {
    process.stdout.write('  ' + t + ' ... ');
    try {
      dump[t] = await fetchTable(t, token);
      say(dump[t].length + '줄');
    } catch (e) {
      say('못 받음 (' + ((e && e.message) || e) + ')');
      dump[t] = null;                        // 못 받은 표는 아예 저장하지 않는다
      unread.push(t);
    }
  }
  const snapshot = path.join(DB, today);
  fs.mkdirSync(snapshot, { recursive: true });
  for (const [t, rows] of Object.entries(dump)) {
    if (rows) fs.writeFileSync(path.join(snapshot, t + '.json'), JSON.stringify(rows, null, 2));
  }
  say('\n기록을 ' + snapshot + ' 에 넣었습니다.');

  // 2) 사진·영상·목소리 내려받기 — 저장소에 있는 것 전부
  const files = await rpc('storage_file_usage', token);
  if (!Array.isArray(files) || !files.length) throw new Error('파일 목록이 비어 있어요. 부모 계정인지 확인해 주세요.');
  fs.writeFileSync(path.join(snapshot, '_저장소-파일-목록.json'), JSON.stringify(files, null, 2));
  say('\n사진·영상·목소리 ' + files.length + '개를 확인합니다...');
  const res = await downloadAll(files, token);
  say(`  새로 받음 ${res.got}개 (${mb(res.bytes)}) · 이미 있어서 건너뜀 ${res.skipped}개` +
      (res.failed.length ? ` · 실패 ${res.failed.length}개` : ''));
  res.failed.slice(0, 5).forEach(f => say('    ✗ ' + f.name.split('/').pop() + ' — ' + f.why));

  // 3) 정말 다 있는지 다시 센다
  const missing = verify(files);
  say('\n확인: 저장소 파일 ' + files.length + '개 중 ' + (files.length - missing.length) + '개가 이 컴퓨터에 있습니다.');
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

여기에 안 들어 있는 것: 로그인 계정 자체(이메일·비밀번호)입니다.
그건 어떤 방법으로도 내려받을 수 없습니다. 홈페이지를 처음부터 다시 세우게 되면
계정은 새로 만들고, profiles.json 을 보고 누가 어떤 역할이었는지 다시 이어 주면 됩니다.

다시 받으려면 홈페이지 폴더에서:
  node tools/backup.mjs "${OUT}"

이미 받아 둔 사진은 건너뛰므로 두 번째부터는 금방 끝납니다.
`);

  say('\n끝났습니다. ' + OUT);
  if (unread.length) say('못 받은 표: ' + unread.join(', ') + ' — 백업이 온전하지 않습니다.');
  if (res.failed.length || missing.length || unread.length) process.exit(1);
}

// 직접 실행했을 때만 돈다. 이렇게 두면 각 조각을 따로 불러 시험할 수 있다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error('\n멈췄습니다: ' + ((e && e.message) || e));
    process.exit(1);
  });
}

export { fetchTable, rpc, fileUrl, download, downloadAll, verify, signIn, reach };
