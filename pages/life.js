// life.html 의 페이지 스크립트 — 「인생 퀘스트」(2026-09-17 부모 구상: 현실의 경험치로 아바타가 자란다).
// 모험단(quest)은 기록을 전투력으로 바꿔 노는 곳이고, 여기는 기록 그 자체를 보여 주는 캐릭터 시트다. 전투·세이브가 없다.
// 1단계는 새 표 없이 이미 있는 기록만 센다: 작품·영상(works) · 일기(posts) · 달리기(run_scores) · 업적(honors) · 박수(work_claps·honor_claps) · 키(growth).
// 모든 경험치가 「날짜 달린 사건」이라 어느 날의 모습이든 다시 계산할 수 있다 — 「자라 온 길 다시 보기」와 「지난달의 나」가 그걸 쓴다.
// 손님에게는 아바타·능력치 모양·별명·키·퀘스트 목록(2026-09-17 부모 요청으로 키·목록을 열었다), 나머지 수치(레벨·경험치·나이·다음 목표)는 로그인한 가족에게만. 자매끼리 수치를 나란히 놓지 않는다(한 번에 한 아이).
// 2단계(같은 날): 부모가 내는 현실 퀘스트(life_quests 표). 부모가 내고 → 아이가 「했어요」 → 부모가 확인하면 그날 경험치. 칸 단위 규칙(아이는 상태·한마디만, 한 달 150)은 서버 트리거가 지킨다.
// 손님은 표를 못 읽고 함수(rpc life_quest_list)로 목록만 받는다 — 제목·경험치·상태·날짜. 아이의 한마디·누가 눌렀는지·아직 안 받아 준 제안은 안 온다.
// 밖으로는 window.LIFE 만 내놓는다(시험용).
buildChrome('life');

(function(){
  'use strict';
  const q = s => document.querySelector(s);
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const RW = 512, RH = 330, FLOOR = 296, PX_PER_CM = 1.2, INK = '#2f2a24';
  const FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  const KIDS = ['sua', 'yona'], KID_NAME = { sua: '수아', yona: '연아' }, KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3' };
  const KID_X = { sua: 128, yona: 384 };
  const PROPOSE_ON = true;                                                // 3단계: 아이의 퀘스트 제안(migration life_quests_propose, 2026-09-17)
  const ROOM_LV = 3, ROOM_BIG = 6;                                        // 벽 물건이 생기는 레벨 · 커지는 레벨
  const DAY = 86400000;

  // ---------- 규칙 ----------
  // 능력치 여섯. xp 는 사건 하나의 값, gear 는 Lv.2 에 생기는 장비(Lv.5 부터 반짝인다)
  const STATS = [
    { key: 'art',   icon: '🎨', name: '예술', color: '#ff9f68', gear: '베레모와 붓',   nick: ['꼬마 화가', '그림 장인'],     from: '그림·만들기 작품', unit: '작품' },
    { key: 'stage', icon: '🎹', name: '무대', color: '#b9a3d6', gear: '마이크',        nick: ['무대의 새싹', '무대의 주인공'], from: '연주·영상',        unit: '영상' },
    { key: 'write', icon: '✍️', name: '글',   color: '#ff7f8a', gear: '귀에 꽂은 연필', nick: ['이야기꾼', '이야기 장인'],     from: '일기',            unit: '일기' },
    { key: 'body',  icon: '🏃', name: '체력', color: '#8ec9ee', gear: '민트 운동화',   nick: ['바람돌이', '번개 다리'],       from: '달리기 놀이',      unit: '달리기' },
    { key: 'heart', icon: '💗', name: '마음', color: '#f7a8bf', gear: '하트 배지',     nick: ['마음 부자', '모두의 친구'],    from: '받은 박수·같이 만든 것', unit: '박수' },
    { key: 'grit',  icon: '🏆', name: '끈기', color: '#ffd979', gear: '금메달',        nick: ['끈기 대장', '해내는 사람'],    from: '상장·급수·직함',   unit: '업적' },
  ];
  const XP = { work: 10, video: 10, diary: 10, run: 3, clap: 5, together: 10, award: 10, level: 10, title: 15, first: 10 };
  const RUN_BEST_CAP = 50;                                               // 달리기 최고 점수 덤(1000점에 1) 상한
  const GEAR_LV = 2, SHINE_LV = 5, LEGEND_LV = 8, MAX_LV = 12;          // 장비가 생김 · 반짝임 · 전설 장비(모양이 바뀐다)
  const need = n => 5 * n * (n + 1);                                     // Lv.n 이 되는 누적 경험치: 10 · 30 · 60 · 100 · 150 · 210 …
  function levelOf(xp){ let n = 0; while (n < MAX_LV && xp >= need(n + 1)) n++; return n; }

  // ---------- 상태 ----------
  let quests = [], noting = null, adding = false, celebrated = false;
  let fam = false, born = {}, events = [], heights = { sua: [], yona: [] }, sel = 'sua', replay = null, loaded = false, loadErr = false, roadAll = false;
  const dayOf = v => { if (!v) return NaN; const d = new Date(String(v).length <= 10 ? v + 'T00:00:00+09:00' : v); return d.getTime(); };
  // 적힌 날이 올린 날보다 뒤면(날짜를 잘못 적은 일기 1건이 있었다) 올린 날로 — 앞날의 기록은 오늘 경험치에서 빠지기 때문
  const whenOf = (on, made) => { const a = dayOf(on), b = dayOf(made); return Number.isFinite(a) && Number.isFinite(b) ? Math.min(a, b) : Number.isFinite(a) ? a : b; };
  const kidsOf = who => who === 'together' || who === 'both' ? KIDS : KIDS.includes(who) ? [who] : [];

  // 어느 날(at)까지의 능력치 — { art: { xp, lv, n }, … }
  function statsAt(k, at){
    const out = {}; STATS.forEach(s => { out[s.key] = { xp: 0, lv: 0, n: 0 }; });
    let best = 0;
    events.forEach(e => {
      if (e.k !== k || !(e.t <= at)) return;
      const o = out[e.stat]; o.xp += e.xp; if (!e.quest) o.n++;        // 퀘스트 경험치는 「작품 n」 같은 개수에는 안 센다
      if (e.score > best) best = e.score;
    });
    out.body.xp += Math.min(RUN_BEST_CAP, Math.floor(best / 1000));
    STATS.forEach(s => { out[s.key].lv = levelOf(out[s.key].xp); });
    return out;
  }
  function heightAt(k, at){
    const h = heights[k]; if (!h.length) return k === 'sua' ? 150 : 135;  // 잰 키가 없으면 어림 — 화면에 수치로는 안 적는다
    if (at <= h[0].t) return h[0].cm;
    for (let i = 1; i < h.length; i++) if (at <= h[i].t){ const a = h[i - 1], b = h[i]; return a.cm + (b.cm - a.cm) * (at - a.t) / Math.max(1, b.t - a.t); }
    return h[h.length - 1].cm;
  }
  // 🎂 생일(가족만 안다) — 그날 하루 고깔모자를 쓰고, 레벨(나이)이 오른 걸 축하한다
  function isBirthday(k){ const b = born[k]; if (!b || replay) return false; const d = new Date(), m = String(b).slice(5, 10); return m === String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysToBirthday(k){
    const b = born[k]; if (!b) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0); const n = new Date(t.getFullYear(), Number(String(b).slice(5, 7)) - 1, Number(String(b).slice(8, 10)));
    if (n < t) n.setFullYear(t.getFullYear() + 1);
    return Math.round((n - t) / DAY);
  }
  function topStat(st){ return STATS.slice().sort((a, b) => st[b.key].xp - st[a.key].xp)[0]; }
  function nickOf(st){ const s = topStat(st), o = st[s.key]; return o.xp <= 0 ? '이제 막 길을 나선 모험가' : s.nick[o.lv >= SHINE_LV ? 1 : 0]; }
  function ageYears(k, at){
    const b = born[k]; if (!b) return null;
    const bd = new Date(b), d = new Date(at); let y = d.getFullYear() - bd.getFullYear();
    if (d.getMonth() < bd.getMonth() || d.getMonth() === bd.getMonth() && d.getDate() < bd.getDate()) y--;
    return y >= 0 ? y : null;
  }

  // ---------- 아바타 — 도트 그림(kid-art.js)에 장비를 얹어 한 장으로 굽는다 ----------
  const MX = 8, MY = 8;                                                  // 장비가 삐져나갈 여백(도트)
  const avatarBuf = {};
  function avatar(k, st, frame){
    const lv = s => st[s].lv, on = s => lv(s) >= GEAR_LV, leg = s => lv(s) >= LEGEND_LV;
    const tier = n => n >= LEGEND_LV ? 3 : n >= SHINE_LV ? 2 : n >= GEAR_LV ? 1 : 0;
    const hat = isBirthday(k);
    const key = [k, frame, hat ? 'b' : ''].concat(STATS.map(s => tier(lv(s.key)))).join('|');
    if (avatarBuf[key]) return avatarBuf[key];
    const rows = KIDART[k].down[frame], pal = Object.assign({}, KIDPAL[k]), W = rows[0].length, H = rows.length;
    if (on('body')){ pal.b = leg('body') ? '#ffd24d' : '#6cc7b3'; pal.B = leg('body') ? '#c9a24a' : '#3f9e8b'; }   // 전설: 황금 날개 운동화               // 🏃 민트 운동화
    const c = document.createElement('canvas'); c.width = W + MX * 2; c.height = H + MY * 2;
    const g = c.getContext('2d');
    const dot = (x, y, col, w, h) => { g.fillStyle = col; g.fillRect(MX + x, MY + y, w || 1, h || 1); };
    const paint = (ox, oy, one) => { for (let r = 0; r < H; r++) for (let x = 0; x < W; x++){ const ch = rows[r][x]; if (ch !== '.') dot(x + ox, r + oy, one || pal[ch] || '#000'); } };
    [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(o => paint(o[0], o[1], 'rgba(36,28,20,.78)'));
    paint(0, 0);
    const top = rows.findIndex(r => /[^.]/.test(r));                     // 걸음 둘째 장은 두 도트 내려앉는다
    if (on('body')){ dot(9, H - 3, '#fff', 3, 1); dot(16, H - 3, '#fff', 3, 1); if (leg('body')){ dot(5, H - 5, INK, 3, 3); dot(5, H - 5, '#fff', 2, 2); dot(20, H - 5, INK, 3, 3); dot(21, H - 5, '#fff', 2, 2); } }
    if (on('art')){                                                      // 🎨 베레모 + 붓
      const b1 = leg('art') ? '#ffd24d' : lv('art') >= SHINE_LV ? '#c03a4b' : '#d9534f', b2 = leg('art') ? '#c9a24a' : '#8f2a35';   // 전설: 황금 베레모
      dot(7, top - 1, INK, 14, 1); dot(6, top, INK, 16, 3); dot(7, top, b1, 14, 2); dot(8, top - 1, b1, 12, 1); dot(7, top + 2, b2, 14, 1); dot(13, top - 3, INK, 2, 2); dot(13, top - 2, b1, 1, 1);
      dot(23, top + 20, INK, 3, 11); dot(24, top + 23, '#a0522d', 1, 7); dot(23, top + 19, INK, 3, 1); dot(24, top + 20, '#ffd979', 1, 3);
    }
    if (on('write')){ for (let i = 0; i < 5; i++){ dot(22 + Math.floor(i / 2), top + 12 - i, INK, 3, 1); dot(23 + Math.floor(i / 2), top + 12 - i, leg('write') ? (i === 0 ? '#2f2a24' : '#fff') : i === 4 ? '#ff7f8a' : '#ffd24d', 1, 1); } if (leg('write')){ dot(25, top + 6, INK, 3, 3); dot(26, top + 6, '#8ec9ee', 2, 2); } }   // 전설: 깃펜   // ✍️ 귀에 꽂은 연필
    if (on('stage')){ dot(2, top + 21, INK, 5, 5); dot(3, top + 22, leg('stage') ? '#ffd24d' : '#8d8d9b', 3, 3); dot(3, top + 22, leg('stage') ? '#fff3ae' : '#d8d8e2', 1, 1); dot(3, top + 26, INK, 3, 5); dot(4, top + 26, '#4a4458', 1, 4); }   // 🎹 마이크
    if (on('grit')){ dot(11, top + 21, '#5b7fbf', 1, 3); dot(16, top + 21, '#5b7fbf', 1, 3); dot(12, top + 24, INK, 4, 4); dot(12, top + 24, '#ffd24d', 3, 3); dot(13, top + 25, '#fff3ae', 1, 1); if (leg('grit')){ dot(11, top + 23, INK, 6, 6); dot(12, top + 24, '#ffd24d', 4, 4); dot(13, top + 25, '#ff7f8a', 2, 2); } }   // 전설: 큰 메달에 붉은 보석   // 🏆 금메달
    if (on('heart')){ dot(17, top + 25, '#ff5d7a', 1, 1); dot(19, top + 25, '#ff5d7a', 1, 1); dot(17, top + 26, '#ff5d7a', 3, 1); dot(18, top + 27, '#ff5d7a', 1, 1); if (leg('heart')){ dot(16, top + 24, '#ffd24d', 1, 1); dot(20, top + 24, '#ffd24d', 1, 1); dot(18, top + 28, '#ffd24d', 1, 1); } }   // 전설: 금빛 테   // 💗 하트 배지
    if (hat){ for (let i = 0; i < 7; i++){ dot(13 - Math.floor(i / 2) - (i > 4 ? 1 : 0), top - 7 + i, INK, 2 + i + (i > 4 ? 2 : 0), 1); dot(14 - Math.floor(i / 2) - (i > 4 ? 1 : 0), top - 7 + i, i % 2 ? '#ffd979' : '#ff7f8a', Math.max(1, i + (i > 4 ? 2 : 0)), 1); } dot(13, top - 9, '#6cc7b3', 2, 2); }   // 🎂 고깔모자
    return (avatarBuf[key] = c);
  }
  // Lv.5 넘은 장비 옆의 반짝임 자리(도트 좌표)
  const SHINE_AT = { art: [4, -2], stage: [0, 18], write: [27, 5], body: [3, 35], heart: [22, 23], grit: [9, 27] };

  // ---------- 무대 ----------
  let bgCv = null, bgFam = null;
  function background(){
    if (bgCv && bgFam === fam) return bgCv;
    bgFam = fam;
    const c = document.createElement('canvas'); c.width = RW * 2; c.height = RH * 2;
    const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = '#f6e9d2'; g.fillRect(0, 0, RW, FLOOR);
    for (let x = 0; x < RW; x += 32){ g.fillStyle = x / 32 % 2 ? '#f3e4c9' : '#f8eddb'; g.fillRect(x, 0, 32, FLOOR); }
    g.fillStyle = '#d9b98a'; g.fillRect(0, FLOOR - 14, RW, 14); g.fillStyle = '#b98f5c'; g.fillRect(0, FLOOR - 16, RW, 2);
    g.fillStyle = '#c99a62'; g.fillRect(0, FLOOR, RW, RH - FLOOR);
    for (let x = -20; x < RW; x += 46){ g.fillStyle = 'rgba(80,50,20,.16)'; g.fillRect(x, FLOOR, 2, RH - FLOOR); }
    g.fillStyle = 'rgba(80,50,20,.25)'; g.fillRect(0, FLOOR, RW, 2);
    // 키 재는 자 — 가운데 기둥. 눈금 수치는 가족에게만
    const rx = RW / 2 - 9;
    g.fillStyle = INK; g.fillRect(rx - 1, FLOOR - 175 * PX_PER_CM - 1, 20, 175 * PX_PER_CM + 1);
    g.fillStyle = '#fffaf2'; g.fillRect(rx, FLOOR - 175 * PX_PER_CM, 18, 175 * PX_PER_CM);
    for (let cm = 10; cm <= 170; cm += 5){
      const y = Math.round(FLOOR - cm * PX_PER_CM), big = cm % 10 === 0;
      g.fillStyle = big ? INK : '#9a8f80'; g.fillRect(rx, y, big ? 9 : 5, 1);
      if (big && cm >= 100){ g.font = '700 7px ' + FONT; g.fillStyle = INK; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(String(cm), rx + 17, y); }
    }
    g.font = '800 8px ' + FONT; g.fillStyle = '#8a7a66'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('키 재는 자', RW / 2, FLOOR - 175 * PX_PER_CM - 12);
    return (bgCv = c);
  }
  // ---------- 방이 자란다 — 능력치가 Lv.3 이 되면 그 아이 쪽 벽에 물건이 하나씩 걸리고, Lv.6 이면 커진다. 빈 자리는 점선 ----------
  function wallItem(g, key, x, y, lv){
    const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    if (lv < ROOM_LV){ g.fillStyle = 'rgba(47,42,36,.22)'; for (let d = 0; d < 30; d += 4){ g.fillRect(x + d, y + 6, 2, 1); g.fillRect(x + d, y + 41, 2, 1); } for (let d = 6; d < 42; d += 4){ g.fillRect(x, y + d, 1, 2); g.fillRect(x + 29, y + d, 1, 2); } return; }
    const big = lv >= ROOM_BIG;
    if (key === 'art'){ R(0, 6, 30, 36, INK); R(2, 8, 26, 32, big ? '#c9a24a' : '#a0714a'); R(4, 10, 22, 28, '#bfe4f7'); R(4, 28, 22, 10, '#6fb567'); R(8, 14, 6, 6, '#ffd979'); R(16, 22, 8, 8, '#2f7a3e'); R(19, 30, 2, 5, '#7a4a2a'); if (big){ R(6, 32, 4, 3, '#ff7f8a'); R(12, 34, 4, 3, '#fff'); } }
    if (key === 'stage'){ R(1, 6, 28, 36, INK); R(3, 8, 24, 32, big ? '#3a2a5c' : '#4a4458'); R(16, 14, 2, 14, '#ffd979'); R(18, 14, 6, 3, '#ffd979'); R(11, 26, 7, 5, '#ffd979'); if (big){ R(6, 12, 2, 10, '#ff9fb0'); R(3, 20, 5, 4, '#ff9fb0'); R(8, 34, 14, 2, '#fff'); } else R(8, 35, 14, 1, '#b9a3d6'); }
    if (key === 'write'){ R(0, 8, 30, 34, INK); R(2, 10, 26, 30, '#8a5a34'); R(2, 24, 26, 2, INK); const C = ['#ff7f8a', '#6cc7b3', '#ffd979', '#8ec9ee', '#b9a3d6', '#ff9f68']; for (let i = 0; i < 6; i++){ R(3 + i * 4, 12 + i % 2 * 2, 3, 12 - i % 2 * 2, C[i]); if (big || i < 3) R(3 + i * 4, 28 + (i + 1) % 2 * 2, 3, 12 - (i + 1) % 2 * 2, C[(i + 3) % 6]); } }
    if (key === 'body'){ R(2, 6, 2, 36, INK); R(3, 6, 1, 36, '#8a5a34'); for (let i = 0; i < 22; i++){ const h = Math.max(2, 20 - i); R(4 + i, 8 + Math.floor(i / 2), 1, h, i % 6 < 3 ? '#6cc7b3' : '#fff'); } R(4, 7, 23, 1, INK); if (big){ R(10, 14, 6, 6, '#ffd979'); R(12, 16, 2, 2, '#fff'); } }
    if (key === 'heart'){ g.fillStyle = INK; for (let d = 0; d < 30; d++) g.fillRect(x + d, y + 8 + Math.round(Math.sin(d / 29 * Math.PI) * 5), 1, 1); const H = (a, b, c) => { R(a, b, 2, 2, c); R(a + 3, b, 2, 2, c); R(a, b + 2, 5, 2, c); R(a + 1, b + 4, 3, 1, c); R(a + 2, b + 5, 1, 1, c); }; H(3, 14, '#ff5d7a'); H(13, 17, '#ff9fb0'); H(22, 14, '#ff5d7a'); if (big){ H(8, 26, '#ffd979'); H(18, 27, '#6cc7b3'); } }
    if (key === 'grit'){ R(0, 36, 30, 3, INK); R(1, 37, 28, 1, '#c9a24a'); const T = (a, c) => { R(a, 18, 10, 9, INK); R(a + 1, 19, 8, 7, c); R(a + 3, 27, 4, 5, INK); R(a + 4, 27, 2, 5, c); R(a + 1, 32, 8, 4, INK); R(a + 2, 33, 6, 2, '#8a5a34'); R(a + 2, 20, 2, 3, '#fff3ae'); }; T(big ? 3 : 10, '#ffd24d'); if (big) T(17, '#d8d8e2'); }
  }
  // ---------- 말풍선 · 레벨 업 ----------
  let bubbleNow = null, cele = null;
  function fanfare(){ if (typeof tone === 'function') [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.05, i * 0.1)); }   // 소리를 꺼 두었거나 아직 화면을 안 눌렀으면 조용히 넘어간다
  function wrap(g, text, maxW){ const out = []; let line = ''; text.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
  function drawBubble(g, cx, tipY, text){
    g.font = '700 10px ' + FONT; const lines = wrap(g, text, 150), w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + 14, h = lines.length * 13 + 9;
    const x = Math.max(4, Math.min(RW - w - 4, Math.round(cx - w / 2))), y = Math.max(4, tipY - h - 6);
    g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2); g.fillRect(cx - 3, y + h, 7, 4); g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillRect(cx - 2, y + h - 1, 5, 3);
    g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'top'; lines.forEach((l, i) => g.fillText(l, x + 7, y + 5 + i * 13));
  }
  function talk(k){
    const st = statsAt(k, now()), top = topStat(st), recent = events.filter(e => e.k === k && e.label).sort((a, b) => b.t - a.t)[0];
    const lines = [st[top.key].xp > 0 ? '요즘 제일 자신 있는 건 ' + top.icon + ' ' + top.name + '!' : '이제 막 시작했어. 지켜봐 줘!'];
    if (recent) lines.push('얼마 전에 이런 일이 있었어 — ' + recent.label + '!');
    const bare = STATS.filter(s => st[s.key].lv < GEAR_LV)[0]; if (bare) lines.push(bare.icon + ' ' + bare.name + '도 키워서 「' + bare.gear + '」 갖고 싶어.');
    const open = quests.filter(x => x.status === 'open' && (x.who === k || x.who === 'both'))[0]; if (open) lines.push('퀘스트 「' + open.title + '」 하는 중이야!');
    const shine = STATS.filter(s => st[s.key].lv >= SHINE_LV)[0]; if (shine) lines.push('내 ' + shine.gear + ', 반짝이는 거 봤어? ✦');
    const i = ((bubbleNow && bubbleNow.k === k ? bubbleNow.i : -1) + 1) % lines.length;
    cele = null; bubbleNow = { k, i, text: lines[i], until: now() + 3200 }; say(KID_NAME[k] + ': ' + lines[i]); draw();
    setTimeout(() => { if (bubbleNow && now() >= bubbleNow.until){ bubbleNow = null; draw(); } }, 3300);
  }
  // 지난 방문 때의 레벨을 이 브라우저에만 적어 두고(localStorage life_lv) 올랐으면 축하한다. 첫 방문은 적기만 한다. 수치는 가족에게만 말한다
  function celebrate(){
    let old = null; const cur = {};
    KIDS.forEach(k => { const st = statsAt(k, now()); cur[k] = {}; STATS.forEach(s => { cur[k][s.key] = st[s.key].lv; }); });
    try { old = JSON.parse(localStorage.getItem('life_lv') || 'null'); localStorage.setItem('life_lv', JSON.stringify(cur)); } catch (e) { return; }
    if (!old) return;
    const ups = []; KIDS.forEach(k => STATS.forEach(s => { const a = (old[k] || {})[s.key], b = cur[k][s.key]; if (Number.isFinite(a) && b > a) ups.push({ k, s, lv: b, gear: a < GEAR_LV && b >= GEAR_LV, shine: a < SHINE_LV && b >= SHINE_LV, legend: a < LEGEND_LV && b >= LEGEND_LV, room: a < ROOM_LV && b >= ROOM_LV }); }));
    const shown = fam ? ups : ups.filter(u => u.gear || u.shine || u.legend || u.room); if (!shown.length) return;
    const u = shown.find(x => x.k === sel) || shown[0];
    const ga = w => (typeof josa === 'function' ? josa(w, '이', '가') : '가');   // josa 는 조사만 돌려준다
    const what = u.legend ? '전설의 ' + u.s.gear + ga(u.s.gear) + ' 됐어요 ★' : u.gear ? '「' + u.s.gear + '」' + ga(u.s.gear) + ' 생겼어요!' : u.shine ? u.s.gear + ga(u.s.gear) + ' 반짝이기 시작했어요 ✦' : u.room ? '방에 새 물건이 걸렸어요!' : '';
    bubbleNow = null; cele = { k: u.k, text: '🎉 ' + KID_NAME[u.k] + ' ' + u.s.icon + ' ' + u.s.name + (fam ? ' Lv.' + u.lv : ' 레벨 업') + (what ? ' — ' + what : ''), until: now() + 5000 };
    if (u.k !== sel) pick(u.k);
    fanfare(); say(cele.text + (shown.length > 1 ? ' (그리고 ' + (shown.length - 1) + '개 더)' : ''));
    setTimeout(() => { cele = null; draw(); }, 5100); draw();
  }
  function birthday(){
    const k = KIDS.filter(isBirthday)[0]; if (!k || !fam) return;
    const tag = new Date().toISOString().slice(0, 10) + k; let seen = ''; try { seen = localStorage.getItem('life_bday') || ''; localStorage.setItem('life_bday', tag); } catch (e) { /* 저장이 막히면 올 때마다 축하한다 */ }
    if (seen === tag) return;
    if (k !== sel) pick(k);
    bubbleNow = null; cele = { k, text: '🎂 ' + KID_NAME[k] + ' 생일 축하해요! Lv.' + ageYears(k, now()) + (typeof josa === 'function' ? josa(String(ageYears(k, now())), '이', '가') : '가') + ' 됐어요', until: now() + 6000 };
    say(cele.text); setTimeout(() => { cele = null; draw(); }, 6100); draw();
  }
  const now = () => Date.now();
  function viewAt(){ return replay ? replay.at : now(); }
  let frameN = 0;
  function draw(){
    const cv = q('#lifeCv'); if (!cv) return;
    const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, RW, RH); g.drawImage(background(), 0, 0, RW, RH);
    const at = viewAt();
    KIDS.forEach(k => { const st = statsAt(k, at), x0 = k === 'sua' ? 10 : 274; STATS.forEach((s, i) => wallItem(g, s.key, x0 + i * 38, 10, st[s.key].lv)); });
    KIDS.forEach(k => {
      const st = statsAt(k, at), cm = heightAt(k, at), x = KID_X[k];
      const bob = !STILL && !replay && (frameN + (k === 'sua' ? 0 : 2)) % 8 < 1 ? 1 : 0;
      const img = avatar(k, st, 0), rows = KIDART[k].down[0], u = cm * PX_PER_CM / rows.length;   // 도트 한 칸의 화면 크기 — 머리끝~발끝이 실제 키
      if (k === sel){ g.fillStyle = 'rgba(255,217,121,.75)'; g.beginPath(); g.ellipse(x, FLOOR + 6, 54, 10, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(47,42,36,.22)'; g.beginPath(); g.ellipse(x, FLOOR + 5, 34, 5, 0, 0, Math.PI * 2); g.fill();
      const w = img.width * u, h = img.height * u, x0 = Math.round(x - w / 2), y0 = Math.round(FLOOR + 4 - (rows.length + MY) * u + bob);
      g.drawImage(img, x0, y0, Math.round(w), Math.round(h));
      if (!STILL) STATS.forEach(s => {                                   // ✦ 반짝임
        if (st[s.key].lv < SHINE_LV || (frameN + s.key.length) % 6 > 2) return;
        const p = SHINE_AT[s.key], sx = Math.round(x0 + (MX + p[0]) * u), sy = Math.round(y0 + (MY + p[1]) * u);
        g.fillStyle = '#fff6c4'; g.fillRect(sx - 3, sy, 7, 1); g.fillRect(sx, sy - 3, 1, 7); g.fillStyle = '#fff'; g.fillRect(sx - 1, sy - 1, 3, 3);
      });
      // 이름표
      const label = KID_NAME[k] + (fam && ageYears(k, at) !== null ? ' · Lv.' + ageYears(k, at) : '');
      g.font = '800 10px ' + FONT; const tw = Math.ceil(g.measureText(label).width) + 10;
      g.fillStyle = INK; g.fillRect(Math.round(x - tw / 2) - 1, FLOOR + 14, tw + 2, 15); g.fillStyle = KID_COLOR[k]; g.fillRect(Math.round(x - tw / 2), FLOOR + 15, tw, 13);
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(label, x, FLOOR + 17);
      { const y = Math.round(FLOOR - cm * PX_PER_CM), dir = k === 'sua' ? 1 : -1; const mx = dir > 0 ? RW / 2 - 35 : RW / 2 + 10; g.fillStyle = KID_COLOR[k]; g.fillRect(mx, y, 25, 2); g.fillStyle = INK; g.fillRect(dir > 0 ? mx : mx + 23, y - 1, 2, 4); }   // 머리끝이 자에 닿는 자리
    });
    if (cele && now() < cele.until){
      const x = KID_X[cele.k], top = FLOOR - heightAt(cele.k, at) * PX_PER_CM;
      for (let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2 + frameN * 0.5, r = 70 + (frameN + i) % 3 * 8, sx = Math.round(x + Math.cos(a) * r), sy = Math.round(top + 90 + Math.sin(a) * r * 0.8); g.fillStyle = ['#ffd979', '#ff7f8a', '#6cc7b3', '#fff'][i % 4]; g.fillRect(sx - 3, sy, 7, 1); g.fillRect(sx, sy - 3, 1, 7); }
      g.font = '800 11px ' + FONT; const tw = Math.min(RW - 16, Math.ceil(g.measureText(cele.text).width) + 16);
      g.fillStyle = INK; g.fillRect(Math.round(RW / 2 - tw / 2) - 1, 62, tw + 2, 22); g.fillStyle = '#ffd979'; g.fillRect(Math.round(RW / 2 - tw / 2), 63, tw, 20); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(cele.text, RW / 2, 67, tw - 10);
    }
    if (bubbleNow && !replay && now() < bubbleNow.until) drawBubble(g, KID_X[bubbleNow.k], Math.round(FLOOR - heightAt(bubbleNow.k, at) * PX_PER_CM) - 8, bubbleNow.text);
    if (replay){
      const d = new Date(replay.at), t = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0');
      g.font = '800 13px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillStyle = INK; g.fillRect(RW / 2 - 40, 8, 80, 22); g.fillStyle = '#ffd979'; g.fillRect(RW / 2 - 39, 9, 78, 20); g.fillStyle = INK; g.fillText(t, RW / 2, 12);
    }
  }

  // ---------- 시트 ----------
  function say(t){ const el = q('#lifeMsg'); if (el) el.textContent = t || ''; }
  function radarSVG(st){
    const R = 78, C = 100, pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [(C + Math.cos(a) * r).toFixed(1), (C + Math.sin(a) * r).toFixed(1)]; };
    const ring = r => STATS.map((s, i) => pt(i, r).join(',')).join(' ');
    const cap = Math.max(6, ...STATS.map(s => st[s.key].lv));
    const shape = STATS.map((s, i) => { const o = st[s.key], f = Math.min(1, (o.lv + Math.min(1, (o.xp - need(o.lv)) / Math.max(1, need(o.lv + 1) - need(o.lv)))) / cap); return pt(i, 8 + (R - 8) * f).join(','); }).join(' ');
    return '<svg class="life-radar" viewBox="0 0 200 200" role="img" aria-label="능력치 여섯의 모양">' +
      [R, R * 0.66, R * 0.33].map(r => '<polygon points="' + ring(r) + '" fill="none" stroke="#c9bfae" stroke-width="1"/>').join('') +
      STATS.map((s, i) => '<line x1="' + C + '" y1="' + C + '" x2="' + pt(i, R)[0] + '" y2="' + pt(i, R)[1] + '" stroke="#c9bfae" stroke-width="1"/>').join('') +
      '<polygon points="' + shape + '" fill="' + KID_COLOR[sel] + '" fill-opacity=".55" stroke="#2f2a24" stroke-width="2" stroke-linejoin="round"/>' +
      STATS.map((s, i) => { const p = pt(i, R + 14); return '<text x="' + p[0] + '" y="' + p[1] + '" font-size="13" text-anchor="middle" dominant-baseline="middle">' + s.icon + '</text>'; }).join('') + '</svg>';
  }
  function renderSheet(){
    const at = viewAt(), st = statsAt(sel, at), past = statsAt(sel, at - 30 * DAY), age = fam ? ageYears(sel, at) : null;
    const who = q('#lifeWho'), box = q('#lifeStats'); if (!who || !box) return;
    who.innerHTML = '<div class="life-name"><b style="color:' + (sel === 'sua' ? 'var(--coral-ink)' : '#2f8f78') + '">' + KID_NAME[sel] + '</b>' + (age !== null ? '<span class="lv">Lv.' + age + '</span>' : '') + '</div>' +
      '<p class="life-nick">「' + escapeHTML(nickOf(st)) + '」' + (age !== null ? ' · 레벨은 나이예요' + (isBirthday(sel) ? ' · 🎂 오늘 생일!' : daysToBirthday(sel) !== null ? ' · 다음 레벨까지 ' + daysToBirthday(sel) + '일' : '') : '') + (heights[sel].length ? ' · 키 ' + Math.round(heightAt(sel, at) * 10) / 10 + 'cm' : '') + '</p>' + radarSVG(st) +
      '<ul class="gear-list">' + STATS.map(s => '<li class="' + (st[s.key].lv >= GEAR_LV ? '' : 'off') + '">' + s.icon + ' ' + (st[s.key].lv >= LEGEND_LV ? '전설의 ' : '') + s.gear + (st[s.key].lv >= LEGEND_LV ? ' ★' : st[s.key].lv >= SHINE_LV ? ' ✦' : '') + '</li>').join('') + '</ul>';
    box.innerHTML = '<h2>능력치</h2>' + STATS.map(s => {
      const o = st[s.key], lo = need(o.lv), hi = need(o.lv + 1), f = o.lv >= MAX_LV ? 1 : (o.xp - lo) / (hi - lo), up = o.xp - past[s.key].xp;
      return '<div class="stat-row" data-stat="' + s.key + '" role="button" tabindex="0" aria-expanded="' + (openStat === s.key) + '"><span class="nm">' + s.icon + ' ' + s.name + '</span><span class="stat-bar" style="--c:' + s.color + '"><i style="width:' + (fam ? Math.round(f * 100) : Math.round(Math.min(1, o.lv / 8) * 100)) + '%"></i></span>' +
        '<span class="lvn">' + (fam ? 'Lv.' + o.lv + (up > 0 && !replay ? '<span class="up">▲' + up + '</span>' : '') : o.lv >= SHINE_LV ? '✦' : o.lv >= GEAR_LV ? '●' : '○') + '</span>' +
        '<p class="stat-from">' + s.from + (fam ? ' · ' + s.unit + ' ' + o.n + ' · 경험치 ' + o.xp + (o.lv < MAX_LV ? ' / ' + hi : '') : '') + ' · <u>무엇으로?</u></p></div>' + (openStat === s.key ? statDetail(s, at) : '');
    }).join('') + (fam && !replay ? '<p class="stat-from" style="margin:6px 0 0;">▲ 는 지난달의 나보다 늘어난 경험치예요.</p>' : '') + (replay ? '' : weeksHTML());
    box.querySelectorAll('[data-stat]').forEach(r => { const go = () => { openStat = openStat === r.dataset.stat ? null : r.dataset.stat; renderSheet(); }; r.addEventListener('click', go); r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } }); });
    renderQuests(st); renderBoard(); renderBadges(); renderMonth(); renderYears(); renderTeam();
  }
  // 능력치를 누르면 「무엇으로 올랐나」 — 새것부터 여덟. 경험치 수치는 가족에게만
  let openStat = null;
  function statDetail(s, at){
    const l = events.filter(e => e.k === sel && e.stat === s.key && e.t <= at).sort((a, b) => b.t - a.t);
    if (!l.length) return '<ul class="stat-detail"><li>아직 기록이 없어요 — ' + s.from + '</li></ul>';
    return '<ul class="stat-detail">' + l.slice(0, 8).map(e => { const d = new Date(e.t); return '<li>' + escapeHTML(e.name || s.from) + '<time>' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + (fam ? ' · +' + e.xp : '') + '</time></li>'; }).join('') + (l.length > 8 ? '<li class="more">… 그리고 ' + (l.length - 8) + '개 더</li>' : '') + '</ul>';
  }
  // 해마다 — 그 해에 모은 경험치를 능력치 색으로 쌓은 막대. 길이는 가장 많이 모은 해가 기준. 합계 수치는 가족에게만
  function renderYears(){
    const box = q('#lifeYears'); if (!box) return;
    const at = viewAt(), by = {}; events.forEach(e => { if (e.k !== sel || e.t > at) return; const y = new Date(e.t).getFullYear(); (by[y] = by[y] || {})[e.stat] = ((by[y] || {})[e.stat] || 0) + e.xp; });
    const years = Object.keys(by).map(Number).sort((a, b) => b - a); box.hidden = !years.length; if (box.hidden) return;
    const total = y => STATS.reduce((n, s) => n + (by[y][s.key] || 0), 0), max = Math.max(...years.map(total));
    box.innerHTML = '<h2>📊 해마다</h2>' + years.map(y => '<div class="year-row"><span class="yl">' + y + (fam && ageYears(sel, new Date(y, 11, 31).getTime()) !== null ? '<small>' + koNum(ageYears(sel, new Date(y, 11, 31).getTime())) + ' 살</small>' : '') + '</span><span class="yb" role="img" aria-label="' + y + '년에 모은 경험치">' +
      STATS.filter(s => by[y][s.key]).map(s => '<i style="width:' + (by[y][s.key] / max * 100).toFixed(1) + '%; background:' + s.color + '" title="' + s.name + '"></i>').join('') + '</span>' + (fam ? '<span class="yn">' + total(y) + '</span>' : '') + '</div>').join('') +
      '<p class="stat-from" style="margin:8px 0 0;">' + STATS.map(s => '<span style="white-space:nowrap;"><i class="lg" style="background:' + s.color + '"></i>' + s.name + '</span>').join(' ') + '</p>';
  }
  // 🤝 자매 팀 — 둘이 같이 해낸 것(같이 만든 작품·같이 받은 업적·「둘 다」 퀘스트). 누구를 골라도 같은 카드
  function renderTeam(){
    const box = q('#lifeTeam'); if (!box) return;
    const l = events.filter(e => e.k === 'sua' && e.team && e.t <= viewAt()).sort((a, b) => b.t - a.t); box.hidden = !l.length; if (box.hidden) return;
    box.innerHTML = '<h2>🤝 자매 팀 <span style="font-weight:700; color:var(--ink-soft);">둘이 같이 해낸 일 ' + l.length + '</span></h2><ul class="stat-detail" style="margin:0;">' + l.slice(0, 5).map(e => { const d = new Date(e.t); return '<li>' + (e.icon || '🏅') + ' ' + escapeHTML(e.name || '') + '<time>' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '</time></li>'; }).join('') + (l.length > 5 ? '<li class="more">… 그리고 ' + (l.length - 5) + '개 더</li>' : '') + '</ul>';
  }
  // 요즘 8주 — 하루 한 칸, 그날 기록이 있으면 그 능력치 색. 수치는 없다. 손님의 퀘스트 몫은 달 단위라 날짜가 없어 뺀다
  function weeksHTML(){
    const today = new Date(); today.setHours(0, 0, 0, 0); const end = today.getTime() + (6 - (today.getDay() + 6) % 7) * DAY, start = end - 55 * DAY;
    const byDay = {}; events.forEach(e => { if (e.k !== sel || e.t < start || e.t > end + DAY ) return; const d = Math.floor((e.t - start) / DAY); if (d >= 0 && d < 56) (byDay[d] = byDay[d] || []).push(e.stat); });
    let cells = '', days = 0;
    for (let d = 0; d < 56; d++){ const l = byDay[d], fut = start + d * DAY > today.getTime(); if (l) days++; cells += '<i' + (l ? ' style="background:' + statOf(l[0]).color + '" title="' + l.map(x => statOf(x).name).join('·') + '"' : fut ? ' class="fut"' : '') + '></i>'; }
    return '<div class="weeks"><p class="stat-from" style="margin:12px 0 6px;"><b>요즘 8주</b> · 기록을 남긴 날 ' + days + '일</p><div class="weeks-grid" role="img" aria-label="최근 8주 동안 기록을 남긴 날 ' + days + '일">' + cells + '</div></div>';
  }
  // ---------- 🏅 배지 — 기록에서 저절로 따지는 것들. 딴 날도 기록에서 찾는다(n번째 사건의 날) ----------
  const isClap = e => e.stat === 'heart' && e.xp === XP.clap;
  const BADGES = [
    { icon: '🎨', name: '첫 작품',        f: e => e.stat === 'art' && !e.quest, n: 1 },
    { icon: '🖼', name: '작품 열 점',      f: e => e.stat === 'art' && !e.quest, n: 10 },
    { icon: '🏛', name: '작품 스물다섯 점', f: e => e.stat === 'art' && !e.quest, n: 25 },
    { icon: '🎹', name: '첫 무대',        f: e => e.stat === 'stage' && !e.quest, n: 1 },
    { icon: '🎬', name: '무대 열 번',      f: e => e.stat === 'stage' && !e.quest, n: 10 },
    { icon: '✍️', name: '첫 일기',        f: e => e.stat === 'write' && !e.quest, n: 1 },
    { icon: '📓', name: '일기 열 편',      f: e => e.stat === 'write' && !e.quest, n: 10 },
    { icon: '📚', name: '일기 서른 편',    f: e => e.stat === 'write' && !e.quest, n: 30 },
    { icon: '🏃', name: '첫 달리기',      f: e => e.stat === 'body' && !e.quest, n: 1 },
    { icon: '⚡', name: '달리기 만 점',    f: e => e.score >= 10000, n: 1 },
    { icon: '🏅', name: '첫 상',          f: e => e.stat === 'grit' && !e.quest, n: 1 },
    { icon: '🥇', name: '업적 열 개',      f: e => e.stat === 'grit' && !e.quest, n: 10 },
    { icon: '👑', name: '업적 스물다섯 개', f: e => e.stat === 'grit' && !e.quest, n: 25 },
    { icon: '🎖', name: '직함을 맡다',     f: e => e.kind === 'title', n: 1 },
    { icon: '👏', name: '박수 열 번',      f: isClap, n: 10 },
    { icon: '🤝', name: '같이 해낸 일',    f: e => e.stat === 'heart' && !isClap(e) && !e.quest, n: 1 },
    { icon: '📜', name: '첫 퀘스트',      f: e => e.quest, n: 1 },
    { icon: '🗺', name: '퀘스트 열 개',    f: e => e.quest, n: 10 },
    { icon: '📏', name: '키 150cm',      h: 150 },
    { icon: '🦒', name: '키 160cm',      h: 160 },
    { icon: '✦', name: '첫 반짝 장비',    lv: st => STATS.some(s => st[s.key].lv >= SHINE_LV) },
    { icon: '★', name: '첫 전설 장비',    lv: st => STATS.some(s => st[s.key].lv >= LEGEND_LV), hint: '능력치 하나가 Lv.' + LEGEND_LV },
    { icon: '🌈', name: '팔방미인',        lv: st => STATS.every(s => st[s.key].lv >= ROOM_LV), hint: '여섯 능력치 모두 Lv.' + ROOM_LV },
  ];
  let badgeMemo = { key: '', list: [] };
  function badgesOf(k){                                                  // [{ b, t }] — t 는 딴 날(없으면 아직)
    const key = k + '|' + events.length + '|' + heights[k].length; if (badgeMemo.key === key) return badgeMemo.list;
    const mine = events.filter(e => e.k === k).sort((a, b) => a.t - b.t);
    const list = BADGES.map(b => {
      let t = null;
      if (b.f){ const hit = mine.filter(b.f)[b.n - 1]; if (hit) t = hit.t; }
      else if (b.h){ const m = heights[k].filter(x => x.cm >= b.h)[0]; if (m) t = m.t; }
      else if (b.lv){ const seen = {}; for (const e of mine){ if (seen[e.t]) continue; seen[e.t] = 1; if (b.lv(statsAt(k, e.t))){ t = e.t; break; } } }
      return { b, t };
    });
    badgeMemo = { key, list }; return list;
  }
  function renderBadges(){
    const box = q('#lifeBadges'); if (!box) return;
    const at = viewAt(), list = badgesOf(sel), have = list.filter(x => x.t !== null && x.t <= at);
    box.innerHTML = '<h2>🏅 배지 <span style="font-weight:700; color:var(--ink-soft);">' + have.length + ' / ' + list.length + '</span></h2><ul class="badge-grid">' + list.map(x => {
      const on = x.t !== null && x.t <= at, d = on ? new Date(x.t) : null, hint = x.b.hint || (x.b.h ? '키를 재서 ' + x.b.h + 'cm 가 넘으면' : x.b.name);
      return '<li class="' + (on ? 'on' : 'off') + '" title="' + escapeHTML(on ? x.b.name + ' · ' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') : '아직 — ' + hint) + '"><span class="bi">' + (on ? x.b.icon : '？') + '</span><span class="bn">' + x.b.name + '</span>' + (on ? '<time>' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '</time>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  // 이번 달의 나(가족만 — 수치) — 달력 달 기준, 지난달과 나란히
  function renderMonth(){
    const box = q('#lifeMonth'); if (!box) return;
    box.hidden = !fam || !!replay; if (box.hidden) return;
    const d = new Date(), m0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), p0 = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    const sum = (a, b) => { const o = { xp: 0, by: {} }; events.forEach(e => { if (e.k !== sel || e.t < a || e.t >= b) return; o.xp += e.xp; o.by[e.stat] = (o.by[e.stat] || 0) + 1; }); return o; };
    const cur = sum(m0, now() + DAY), prev = sum(p0, m0), diff = cur.xp - prev.xp;
    const parts = STATS.filter(s => cur.by[s.key]).map(s => s.icon + ' ' + s.name + ' ' + cur.by[s.key] + '번');
    box.innerHTML = '<h2>🗓 ' + (d.getMonth() + 1) + '월의 ' + KID_NAME[sel] + '</h2><p class="life-nick" style="margin:0;">' + (parts.length ? parts.join(' · ') + ' — 경험치 <b>+' + cur.xp + '</b>' : '이번 달은 아직 기록이 없어요. 하나 남겨 볼까요?') +
      '<br>지난달은 +' + prev.xp + (parts.length ? diff > 0 ? ' · 지난달의 나보다 ' + diff + ' 더 모았어요 💪' : diff < 0 ? ' · 지난달의 나를 따라잡으려면 ' + (-diff + 1) + ' 더' : ' · 지난달과 똑같아요' : '') + '</p>';
  }
  // 다음 목표 — 1단계는 기록에서 저절로 나오는 것만(부모가 내는 퀘스트는 2단계). 가장 가까운 셋
  function renderQuests(st){
    const box = q('#lifeQuests'); if (!box) return;
    box.hidden = !fam || !!replay; if (box.hidden) return;
    const per = { art: XP.work, stage: XP.video, write: XP.diary, body: XP.run, heart: XP.clap, grit: XP.award };
    const how = { art: '그림이나 만들기를 올리면', stage: '연주·영상을 올리면', write: '일기를 쓰면', body: '달리기 놀이를 하면', heart: '박수를 받으면', grit: '상장·급수를 올리면' };
    const list = STATS.filter(s => st[s.key].lv < MAX_LV).map(s => { const o = st[s.key], left = need(o.lv + 1) - o.xp; return { s, o, left, times: Math.ceil(left / per[s.key]) }; }).sort((a, b) => a.times - b.times).slice(0, 3);
    box.innerHTML = '<h2>다음 목표</h2><ul class="quest-list">' + list.map(x => '<li><span class="ic">' + x.s.icon + '</span><span><b>' + x.s.name + ' Lv.' + (x.o.lv + 1) + '</b> 까지 ' + x.s.unit + ' ' + x.times + '번' +
      (x.o.lv + 1 === GEAR_LV ? ' — 「' + x.s.gear + '」가 생겨요' : x.o.lv + 1 === SHINE_LV ? ' — 장비가 반짝여요 ✦' : x.o.lv + 1 === LEGEND_LV ? ' — 전설 장비가 돼요 ★' : '') + '<small>' + how[x.s.key] + ' 경험치 +' + per[x.s.key] + ' · 남은 경험치 ' + x.left + '</small></span></li>').join('') + '</ul>';
  }
  // ---------- 퀘스트 판(가족만) — 고른 아이의 것과 「둘 다」 ----------
  // 퀘스트 본보기 — 누르면 입력 칸이 채워진다(고쳐서 내면 된다)
  const QUEST_IDEAS = [['줄넘기 100번', 'body', 20], ['책 한 권 끝까지 읽기', 'write', 30], ['피아노 30분 연습', 'stage', 10], ['그림 한 장 완성하기', 'art', 20], ['동생·언니 도와주기', 'heart', 10], ['방 정리 혼자 하기', 'grit', 10], ['일주일 일기 쓰기', 'write', 30], ['자전거 30분 타기', 'body', 20]];
  function statOf(key){ return STATS.find(s => s.key === key) || STATS[0]; }
  const mmdd = v => { const d = new Date(dayOf(v)); return (d.getMonth() + 1) + '.' + d.getDate(); };
  function renderBoard(){
    const box = q('#lifeBoard'); if (!box) return;
    box.hidden = !!replay; if (box.hidden) return;                       // 퀘스트 목록은 손님에게도(2026-09-17 부모 요청) — 단추는 가족에게만
    const mine = quests.filter(x => x.who === sel || x.who === 'both'), today = dayOf(new Date().toISOString().slice(0, 10));
    const canClaim = x => isChild && me && (x.who === me.author_key || x.who === 'both');
    const item = x => {
      const s = statOf(x.stat), late = x.status !== 'done' && x.due_on && dayOf(x.due_on) < today - DAY;
      let acts = '';
      if (x.status === 'open' && canClaim(x)) acts = noting === x.id ? '<div class="qb-note"><input type="text" maxlength="120" placeholder="한마디 (안 써도 돼요)" data-note="' + x.id + '"><button type="button" class="dot-btn small mint" data-send="' + x.id + '">보내기</button></div>' : '<div class="qb-acts"><button type="button" class="dot-btn small lemon" data-claim="' + x.id + '">✋ 했어요</button></div>';
      if (isAdmin) acts = '<div class="qb-acts">' + (x.status === 'proposed' ? '<select data-xp="' + x.id + '" aria-label="경험치"><option value="10">10</option><option value="20" selected>20</option><option value="30">30</option></select><button type="button" class="dot-btn small mint" data-accept="' + x.id + '">👍 좋아, 해 보자</button>' : '') + (x.status === 'claimed' ? '<button type="button" class="dot-btn small mint" data-done="' + x.id + '">✔ 확인</button><button type="button" class="dot-btn small" data-redo="' + x.id + '">↩ 다시 해 보자</button>' : '') + (x.status !== 'done' ? '<button type="button" class="dot-btn small" data-del="' + x.id + '">지우기</button>' : '') + '</div>';
      return '<div class="qb-item ' + x.status + '"><span class="ic">' + s.icon + '</span><div class="body"><b>' + escapeHTML(x.title) + '</b>' + (x.who === 'both' ? ' <span class="tag">둘 다</span>' : '') +
        '<small>' + s.name + (x.status === 'proposed' ? ' · ' + KID_NAME[x.who] + '의 제안' + (isAdmin ? '' : ' — 엄마 아빠가 보고 있어요') : ' 경험치 +' + x.xp) + (x.due_on && x.status !== 'done' ? ' · ' + mmdd(x.due_on) + '까지' : '') + (x.status === 'done' ? ' · ' + mmdd(x.done_at) + ' 해냄' : '') + '</small>' +
        (late ? '<small class="late">기한이 지났어요 — 그래도 하면 돼요</small>' : '') +
        (x.status === 'claimed' ? '<small>✋ ' + (x.claimed_by ? KID_NAME[x.claimed_by] + (x.claim_note ? ': 「' + escapeHTML(x.claim_note) + '」' : '가 했대요') : '했대요 — 확인을 기다려요') + '</small>' : '') + acts + '</div></div>';
    };
    const group = (t, st, lim) => { const l = mine.filter(x => x.status === st); return l.length ? '<p class="qb-group">' + t + ' ' + l.length + '</p>' + (lim ? l.slice(0, lim) : l).map(item).join('') : ''; };
    const body = group('💡 제안', 'proposed') + group('확인 기다리는 중', 'claimed') + group('진행 중', 'open') + group('해냄', 'done', 5);
    box.innerHTML = '<div class="qb-head"><h2>📜 ' + KID_NAME[sel] + '의 퀘스트</h2>' + (isAdmin ? '<button type="button" class="dot-btn small primary" id="qbAdd">' + (adding ? '닫기' : '＋ 퀘스트 내기') + '</button>' : PROPOSE_ON && isChild && me && me.author_key === sel ? '<button type="button" class="dot-btn small lemon" id="qbAdd">' + (adding ? '닫기' : '💡 퀘스트 제안하기') + '</button>' : '') + '</div>' +
      (adding && isChild && PROPOSE_ON ? '<form class="qb-form" id="qbPropose"><label class="wide">무엇에 도전하고 싶어요?<input name="title" maxlength="80" required placeholder="예: 책 한 권 끝까지 읽기"></label><label class="wide">어떤 능력치일까요<select name="stat">' + STATS.map(s => '<option value="' + s.key + '">' + s.icon + ' ' + s.name + '</option>').join('') + '</select></label><div class="wide"><button class="dot-btn small mint">제안 보내기</button></div></form>' : '') +
      (adding && isAdmin ? '<form class="qb-form" id="qbForm"><div class="wide qb-chips">' + QUEST_IDEAS.map((t, i) => '<button type="button" class="chip" data-idea="' + i + '">' + statOf(t[1]).icon + ' ' + t[0] + '</button>').join('') + '</div><label class="wide">무엇을 하면 될까요<input name="title" maxlength="80" required placeholder="예: 줄넘기 100번"></label>' +
        '<label>누구에게<select name="who"><option value="' + sel + '">' + KID_NAME[sel] + '</option><option value="both">둘 다</option></select></label>' +
        '<label>능력치<select name="stat">' + STATS.map(s => '<option value="' + s.key + '">' + s.icon + ' ' + s.name + '</option>').join('') + '</select></label>' +
        '<label>경험치<select name="xp"><option value="10">10 — 그림 한 장만큼</option><option value="20" selected>20</option><option value="30">30 — 큰 도전</option></select></label>' +
        '<label>언제까지(없어도 돼요)<input name="due" type="date"></label><div class="wide"><button class="dot-btn small mint">퀘스트 내기</button></div></form>' : '') +
      (body || '<p class="life-nick" style="margin:0;">' + (isAdmin ? '아직 낸 퀘스트가 없어요. 「＋ 퀘스트 내기」로 첫 퀘스트를 내 보세요.' : '아직 퀘스트가 없어요.') + '</p>');
    const on = (sel2, fn) => box.querySelectorAll(sel2).forEach(b => b.addEventListener('click', () => fn(Number(Object.values(b.dataset)[0]), b)));
    on('[data-claim]', id => { noting = id; renderBoard(); const i = box.querySelector('[data-note]'); if (i) i.focus(); });
    on('[data-send]', id => { const i = box.querySelector('[data-note="' + id + '"]'); change(id, { status: 'claimed', claim_note: i && i.value.trim() ? i.value.trim().slice(0, 120) : null }, '✋ 보냈어요 — 엄마 아빠가 확인하면 경험치가 들어와요'); });
    on('[data-accept]', id => { const x = box.querySelector('[data-xp="' + id + '"]'); change(id, { status: 'open', xp: Number(x && x.value) || 20 }, '👍 퀘스트로 받아 줬어요'); });
    on('[data-done]', id => { const x = quests.find(y => y.id === id); change(id, { status: 'done' }, '✔ 확인했어요 — 경험치가 들어갔어요', () => { if (!x) return; const s = statOf(x.stat); bubbleNow = null; fanfare(); cele = { k: sel, text: '📜 퀘스트 완료! ' + s.icon + ' ' + s.name + ' +' + x.xp, until: now() + 4000 }; setTimeout(() => { cele = null; draw(); }, 4100); draw(); }); });
    on('[data-redo]', id => change(id, { status: 'open', claim_note: null }, '↩ 다시 진행 중으로 돌렸어요'));
    on('[data-del]', id => { if (window.confirm('이 퀘스트를 지울까요?')) sb.from('life_quests').delete().eq('id', id).select('id').then(after('지웠어요'), fail); });
    const add = q('#qbAdd'); if (add) add.addEventListener('click', () => { adding = !adding; renderBoard(); });
    box.querySelectorAll('[data-idea]').forEach(b => b.addEventListener('click', () => { const t = QUEST_IDEAS[Number(b.dataset.idea)], f = q('#qbForm'); if (!f) return; f.title.value = t[0]; f.stat.value = t[1]; f.xp.value = String(t[2]); f.title.focus(); }));
    const form = q('#qbForm'); if (form) form.addEventListener('submit', e => {
      e.preventDefault(); const f = new FormData(form), title = String(f.get('title') || '').trim(); if (!title) return;
      sb.from('life_quests').insert({ who: f.get('who'), stat: f.get('stat'), title: title.slice(0, 80), xp: Number(f.get('xp')), due_on: f.get('due') || null }).select('id').then(after('퀘스트를 냈어요 📜'), fail);
    });
    const pf = q('#qbPropose'); if (pf) pf.addEventListener('submit', e => {
      e.preventDefault(); const f = new FormData(pf), title = String(f.get('title') || '').trim(); if (!title) return;
      sb.from('life_quests').insert({ who: me.author_key, stat: f.get('stat'), title: title.slice(0, 80), xp: 10, status: 'proposed' }).select('id').then(after('💡 제안을 보냈어요 — 엄마 아빠가 보면 퀘스트가 돼요'), fail);
    });
    if (isChild){ try { localStorage.setItem('life_seen', new Date().toISOString()); sessionStorage.removeItem('life_wait'); } catch (e) { /* 저장이 막히면 메뉴의 점이 남을 뿐이다 */ } }
  }
  // RLS 에 막힌 update 는 오류 없이 0줄이다 — 돌아온 줄 수로 성공을 가린다
  const fail = () => say('저장하지 못했어요 — 잠시 뒤 다시 해 주세요');
  const after = (okMsg, then) => res => {
    if (res.error){ say(/까지예요|누를 수/.test(res.error.message || '') ? res.error.message : '저장하지 못했어요 — 로그인한 계정을 확인해 주세요'); return; }
    if (!res.data || !res.data.length){ say('바뀐 것이 없어요 — 이미 처리됐거나 권한이 없어요'); return; }
    noting = null; adding = false; try { sessionStorage.removeItem('life_wait'); } catch (e) { /* 점이 10분 늦게 바뀔 뿐 */ }
    load().then(() => { say(okMsg); if (then) then(); });
  };
  function change(id, patch, okMsg, then){ sb.from('life_quests').update(patch).eq('id', id).select('id').then(after(okMsg, then), fail); }

  function renderRoad(){
    const box = q('#lifeRoad'); if (!box) return;
    const ICON = { award: '🏅', level: '📈', title: '🎖', first: '✨' };
    const mine = events.filter(e => e.k === sel && e.label).sort((a, b) => b.t - a.t);
    const shown = roadAll ? mine : mine.slice(0, 12);
    let last = null, html = '';
    shown.forEach(e => {
      const d = new Date(e.t), age = fam ? ageYears(sel, e.t) : null, head = age !== null ? koNum(age) + ' 살' : d.getFullYear() + '년';
      if (head !== last){ html += '<li class="age">' + head + '</li>'; last = head; }
      html += '<li class="ev">' + (ICON[e.kind] || e.icon) + ' ' + escapeHTML(e.label) + '<time>' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '</time></li>';
    });
    box.innerHTML = '<h2>' + KID_NAME[sel] + '의 길</h2>' + (mine.length ? '<ul class="road">' + html + '</ul>' + (mine.length > shown.length ? '<p class="road-more"><button type="button" class="dot-btn small" id="roadMore">지난 길 더 보기 (' + (mine.length - shown.length) + ')</button></p>' : '') : '<p class="life-nick">아직 남은 기록이 없어요.</p>');
    const b = q('#roadMore'); if (b) b.addEventListener('click', () => { roadAll = true; renderRoad(); });
  }
  // 🖼 캐릭터 카드 — 아바타·별명·능력치 모양·장비·방 물건을 그림 한 장으로. 레벨·키·나이 같은 수치는 안 넣는다(밖에 나눌 수 있는 그림이라)
  function cardCanvas(k){
    const W = 600, H = 800, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), st = statsAt(k, now()); g.imageSmoothingEnabled = false;
    g.fillStyle = INK; g.fillRect(0, 0, W, H); g.fillStyle = '#fff6e9'; g.fillRect(8, 8, W - 16, H - 16); g.fillStyle = KID_COLOR[k]; g.fillRect(8, 8, W - 16, 64);
    g.fillStyle = INK; g.fillRect(8, 72, W - 16, 4);
    g.textBaseline = 'top'; g.textAlign = 'left'; g.font = '800 26px ' + FONT; g.fillText('인생 퀘스트', 28, 26);
    g.textAlign = 'right'; g.font = '700 15px ' + FONT; const d = new Date(); g.fillText(d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'), W - 28, 34);
    g.fillStyle = '#f6e9d2'; g.fillRect(28, 96, 300, 380); g.fillStyle = '#c99a62'; g.fillRect(28, 436, 300, 40); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(28, 96, 300, 380);
    const img = avatar(k, st, 0), u = 6.6, aw = img.width * u, ah = img.height * u; g.drawImage(img, Math.round(178 - aw / 2), Math.round(452 - (img.height - MY) * u), Math.round(aw), Math.round(ah));
    g.fillStyle = INK; g.textAlign = 'left'; g.font = '800 40px ' + FONT; g.fillText(KID_NAME[k], 352, 104);
    g.font = '700 18px ' + FONT; g.fillStyle = '#6f6558'; g.fillText('「' + nickOf(st) + '」', 348, 156);
    // 능력치 모양(육각형)
    const cx = 460, cy = 330, R = 96, cap = Math.max(6, ...STATS.map(s => st[s.key].lv)), pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    g.strokeStyle = '#c9bfae'; g.lineWidth = 2; [1, 0.66, 0.33].forEach(f => { g.beginPath(); STATS.forEach((s, i) => { const p2 = pt(i, R * f); if (i) g.lineTo(p2[0], p2[1]); else g.moveTo(p2[0], p2[1]); }); g.closePath(); g.stroke(); });
    g.beginPath(); STATS.forEach((s, i) => { const p2 = pt(i, 10 + (R - 10) * Math.min(1, st[s.key].lv / cap)); if (i) g.lineTo(p2[0], p2[1]); else g.moveTo(p2[0], p2[1]); }); g.closePath();
    g.globalAlpha = 0.6; g.fillStyle = KID_COLOR[k]; g.fill(); g.globalAlpha = 1; g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    g.font = '22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; STATS.forEach((s, i) => { const p2 = pt(i, R + 22); g.fillText(s.icon, p2[0], p2[1]); });
    // 방 물건 · 장비
    g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = INK; g.font = '800 17px ' + FONT; g.fillText('내 방', 28, 500);
    g.save(); g.translate(28, 524); g.scale(2, 2); STATS.forEach((s, i) => wallItem(g, s.key, i * 46, -4, st[s.key].lv)); g.restore();
    g.fillStyle = INK; g.font = '800 17px ' + FONT; g.fillText('장비', 28, 636);
    let gx = 28, gy = 664; g.font = '700 16px ' + FONT;
    STATS.forEach(s => { const has = st[s.key].lv >= GEAR_LV, t = s.icon + ' ' + (has ? s.gear + (st[s.key].lv >= SHINE_LV ? ' ✦' : '') : '???'), w = Math.ceil(g.measureText(t).width) + 20; if (gx + w > W - 28){ gx = 28; gy += 40; }
      g.globalAlpha = has ? 1 : 0.4; g.fillStyle = INK; g.fillRect(gx, gy, w, 32); g.fillStyle = '#fff'; g.fillRect(gx + 2, gy + 2, w - 4, 28); g.fillStyle = INK; g.fillText(t, gx + 10, gy + 8); g.globalAlpha = 1; gx += w + 8; });
    g.font = '700 14px ' + FONT; g.fillStyle = '#6f6558'; g.textAlign = 'right'; g.fillText('suayona.com', W - 28, H - 38);
    return c;
  }
  function saveCard(){
    const c = cardCanvas(sel), name = 'suayona-life-' + sel + '-' + new Date().toISOString().slice(0, 10) + '.png';
    return new Promise(res => c.toBlob(blob => {
      if (!blob){ say('카드를 만들지 못했어요'); return res(false); }
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: KID_NAME[sel] + '의 인생 퀘스트' }).then(() => res(true)).catch(() => res(false));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000); say(KID_NAME[sel] + '의 캐릭터 카드를 내려받았어요'); res(true);
    }, 'image/png'));
  }
  function renderTools(){
    const box = q('#lifeTools'); if (!box) return;
    box.innerHTML = KIDS.map(k => '<button type="button" class="dot-btn small" data-kid="' + k + '" aria-pressed="' + (k === sel) + '">' + KID_NAME[k] + '</button>').join(' ') +
      ' <button type="button" class="dot-btn small" id="lifeReplay">' + (replay ? '■ 그만 보기' : '⏪ 자라 온 길 다시 보기') + '</button>' + (replay ? '' : ' <button type="button" class="dot-btn small" id="lifeCard">🖼 캐릭터 카드</button>') +
      '<label class="life-scrub"><span>🕰 시간 여행</span><input type="range" id="lifeScrub" min="0" max="1000" value="' + (replay ? Math.round((replay.at - replay.from) / Math.max(1, now() - replay.from) * 1000) : 1000) + '" aria-label="첫 기록부터 오늘까지 — 끌면 그때의 모습"></label>';
    box.querySelectorAll('[data-kid]').forEach(b => b.addEventListener('click', () => pick(b.dataset.kid)));
    q('#lifeReplay').addEventListener('click', () => { if (replay) stopReplay(); else startReplay(); });
    const sc = q('#lifeScrub'); if (sc) sc.addEventListener('input', () => {
      const v = Number(sc.value); if (v >= 1000){ if (replay) stopReplay(); return; }
      const first = firstDay(); if (replay && replay.timer) clearInterval(replay.timer);
      const was = !!replay; replay = { from: first, at: first + (now() - first) * v / 1000, t0: 0, timer: null };
      if (!was){ const rb = q('#lifeReplay'), cb2 = q('#lifeCard'); if (rb) rb.textContent = '■ 오늘로 돌아오기'; if (cb2) cb2.hidden = true; }   // 단추 줄을 다시 그리면 끌던 손잡이가 사라진다 — 글자만 바꾼다
      draw(); renderSheet(); const d = new Date(replay.at); say(d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월의 모습 — 끝까지 밀면 오늘로 돌아와요');
    });
    const cb = q('#lifeCard'); if (cb) cb.addEventListener('click', () => { saveCard(); });
  }
  function pick(k){ if (!KIDS.includes(k) || k === sel){ return; } sel = k; roadAll = false; renderTools(); renderSheet(); renderRoad(); draw(); }

  // ---------- 자라 온 길 다시 보기 — 첫 기록부터 오늘까지 6초. 시계는 setInterval(가려진 탭에서도 끝까지 간다) ----------
  const REPLAY_MS = 6000;
  function firstDay(){ return Math.min(now() - 365 * DAY, ...events.map(e => e.t), ...KIDS.flatMap(k => heights[k].map(h => h.t))); }
  function startReplay(){
    const first = firstDay();
    if (STILL){ say('움직임 줄이기를 켜 두어서 다시 보기는 쉬어요'); return; }
    replay = { from: first, at: first, t0: performance.now(), timer: setInterval(stepReplay, 60) };
    renderTools(); say('첫 기록부터 오늘까지 — 키가 자라고 장비가 하나씩 생겨요');
  }
  function stepReplay(){
    if (!replay) return;
    const p = Math.min(1, (performance.now() - replay.t0) / REPLAY_MS);
    replay.at = replay.from + (now() - replay.from) * p;
    draw(); renderSheet(); const sc = q('#lifeScrub'); if (sc) sc.value = String(Math.round(p * 1000));
    if (p >= 1) stopReplay();
  }
  function stopReplay(){ if (!replay) return; clearInterval(replay.timer); replay = null; renderTools(); renderSheet(); draw(); say('오늘의 모습이에요'); }

  // ---------- 불러오기 — 부른 사람이 볼 수 있는 줄만 온다(RLS). 표마다 필요한 열만 ----------
  async function load(){
    fam = !!(isLoggedIn && me);
    if (fam){ try { born = await loadKids(); } catch (e) { born = {}; } }
    if (!loaded && isChild && me && KIDS.includes(me.author_key)) sel = me.author_key;
    const ask = (t, cols, f) => { let r = sb.from(t).select(cols); if (f) r = f(r); return r.then(x => x.error ? [] : x.data || []).catch(() => { loadErr = true; return []; }); };
    const [works, posts, runs, honors, grow, wclaps, hclaps, qrows] = await Promise.all([
      ask('works', 'id, author, media_type, title, made_on, created_at', r => r.eq('status', 'published')),
      ask('posts', 'author, title, happened_on, created_at', r => r.eq('status', 'published')),
      ask('run_scores', 'who, score, created_at', r => r.in('who', KIDS)),
      ask('honors', 'id, who, kind, title, got_on, created_at'),
      ask('growth', 'who, cm, measured_on', r => r.eq('kind', 'height').order('measured_on')),
      ask('work_claps', 'work_id, created_at'),
      ask('honor_claps', 'honor_id, created_at'),
      fam ? ask('life_quests', 'id, who, stat, title, xp, due_on, status, claimed_by, claim_note, done_at, created_at', r => r.order('created_at', { ascending: false }))
          : sb.rpc('life_quest_list').then(x => x.error ? [] : x.data || []).catch(() => []),
    ]);
    events = []; heights = { sua: [], yona: [] };
    const add = (who, e) => kidsOf(who).forEach(k => { if (Number.isFinite(e.t)) events.push(Object.assign({ k }, e)); });
    const firsts = {};
    const firstOf = (k, tag) => { const key = k + tag; if (firsts[key]) return false; firsts[key] = 1; return true; };
    const wAuthor = {}, hWho = {}, wTitle = {}, hTitle = {};
    works.slice().sort((a, b) => whenOf(a.made_on, a.created_at) - whenOf(b.made_on, b.created_at)).forEach(w => {
      wAuthor[w.id] = w.author; wTitle[w.id] = w.title || '';
      const vid = w.media_type === 'youtube' || w.media_type === 'video', t = whenOf(w.made_on, w.created_at), both = w.author === 'together';
      kidsOf(w.author).forEach(k => {
        const first = firstOf(k, vid ? 'v' : 'w');
        events.push({ k, t, stat: vid ? 'stage' : 'art', xp: vid ? XP.video : XP.work, icon: vid ? '🎹' : '🎨', name: w.title || (vid ? '영상' : '작품'), team: both, label: first ? (vid ? '첫 영상 「' : '첫 작품 「') + (w.title || '') + '」' : '' });
        if (both) events.push({ k, t, stat: 'heart', xp: XP.together, name: '같이 만든 「' + (w.title || '') + '」' });
      });
    });
    posts.slice().sort((a, b) => whenOf(a.happened_on, a.created_at) - whenOf(b.happened_on, b.created_at)).forEach(p => kidsOf(p.author).forEach(k => {
      events.push({ k, t: whenOf(p.happened_on, p.created_at), stat: 'write', xp: XP.diary, icon: '✍️', name: p.title || '일기', label: firstOf(k, 'p') ? '첫 일기 「' + (p.title || '') + '」' : '' });
    }));
    runs.forEach(r => add(r.who, { t: dayOf(r.created_at), stat: 'body', xp: XP.run, score: Number(r.score) || 0, name: '달리기 ' + (Number(r.score) || 0).toLocaleString('ko-KR') + '점' }));
    honors.forEach(h => { hWho[h.id] = h.who; hTitle[h.id] = h.title || ''; add(h.who, { t: whenOf(h.got_on, h.created_at), stat: 'grit', xp: XP[h.kind] || XP.award, kind: h.kind, name: h.title || '업적', team: h.who === 'both', label: h.title || '업적' }); if (h.who === 'both') add('both', { t: whenOf(h.got_on, h.created_at), stat: 'heart', xp: XP.together, name: '같이 해낸 「' + (h.title || '') + '」' }); });
    wclaps.forEach(c => add(wAuthor[c.work_id], { t: dayOf(c.created_at), stat: 'heart', xp: XP.clap, name: '「' + (wTitle[c.work_id] || '작품') + '」에 받은 박수' }));
    hclaps.forEach(c => add(hWho[c.honor_id], { t: dayOf(c.created_at), stat: 'heart', xp: XP.clap, name: '「' + (hTitle[c.honor_id] || '업적') + '」에 받은 박수' }));
    grow.forEach(r => { const k = r.who === '수아' ? 'sua' : r.who === '연아' ? 'yona' : r.who; if (heights[k] && Number(r.cm) > 0) heights[k].push({ t: dayOf(r.measured_on), cm: Number(r.cm) }); });
    KIDS.forEach(k => heights[k].sort((a, b) => a.t - b.t));
    quests = qrows;                                                      // 손님 것은 함수가 준 목록 — 한마디·누가 눌렀는지·제안은 안 온다
    qrows.forEach(x => {                                                 // 가족: 끝난 퀘스트 한 줄씩(길에 📜 로 선다) · 손님: 제목 없는 달별 합계
      if (x.status === 'done' && STATS.some(s => s.key === x.stat)) add(x.who, { t: dayOf(x.done_at), stat: x.stat, xp: Number(x.xp) || 0, quest: true, team: x.who === 'both', name: '퀘스트 「' + (x.title || '') + '」', icon: '📜', label: '퀘스트 「' + (x.title || '') + '」' });
    });
    loaded = true;
    q('#lifeGuest').hidden = fam;
    renderTools(); renderSheet(); renderRoad(); draw();
    say(loadErr ? '기록을 다 불러오지 못했어요 — 잠시 뒤 다시 열어 주세요' : '아바타를 누르면 그 아이의 기록이 나와요 · 한 번 더 누르면 말해요');
    if (!celebrated && !loadErr){ celebrated = true; celebrate(); birthday(); }
  }

  // ---------- 누르기·움직임 ----------
  function wire(){
    const cv = q('#lifeCv'); if (!cv) return;
    const kidAt = e => { const rc = cv.getBoundingClientRect(); if (!rc.width) return null; const x = (e.clientX - rc.left) / rc.width * RW; return x < RW / 2 ? 'sua' : 'yona'; };
    cv.addEventListener('click', e => { const k = kidAt(e); if (!k || replay) return; if (k === sel) talk(k); else pick(k); });
    cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') pick('sua'); if (e.key === 'ArrowRight') pick('yona'); });
    if (!STILL) setInterval(() => { if (document.hidden || replay || !loaded) return; const rc = cv.getBoundingClientRect(); if (rc.bottom < 0 || rc.top > (window.innerHeight || 800)) return; frameN++; draw(); }, 260);
  }

  (async function boot(){
    try { await refreshAuth(); } catch (e) { /* 로그인 확인이 안 되면 손님으로 본다 */ }
    wire();
    await load();
    if (typeof initReveal === 'function') initReveal();
  })();

  window.LIFE = { draw, _stats: statsAt, _height: heightAt, _events: () => events, _pick: pick, _sel: () => sel, _replay: () => replay, _start: startReplay, _stop: stopReplay, _fam: () => fam, _level: levelOf, _need: need, _load: load, _quests: () => quests, _talk: talk, _badges: badgesOf, _card: cardCanvas, _birthday: birthday, _celebrate: celebrate, _bubble: () => bubbleNow, _cele: () => cele, _tick: () => { frameN++; draw(); } };
})();
