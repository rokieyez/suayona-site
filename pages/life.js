// life.html 의 페이지 스크립트 — 「인생 퀘스트」(2026-09-17 부모 구상: 현실의 경험치로 아바타가 자란다).
// 모험단(quest)은 기록을 전투력으로 바꿔 노는 곳이고, 여기는 기록 그 자체를 보여 주는 캐릭터 시트다. 전투·세이브가 없다.
// 1단계는 새 표 없이 이미 있는 기록만 센다: 작품·영상(works) · 일기(posts) · 달리기(run_scores) · 업적(honors) · 박수(work_claps·honor_claps) · 키(growth).
// 모든 경험치가 「날짜 달린 사건」이라 어느 날의 모습이든 다시 계산할 수 있다 — 「자라 온 길 다시 보기」와 「지난달의 나」가 그걸 쓴다.
// 손님에게는 아바타·능력치 모양·별명만, 수치(레벨·키·나이·다음 목표)는 로그인한 가족에게만. 자매끼리 수치를 나란히 놓지 않는다(한 번에 한 아이).
// 밖으로는 window.LIFE 만 내놓는다(시험용).
buildChrome('life');

(function(){
  'use strict';
  const q = s => document.querySelector(s);
  const STILL = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const RW = 512, RH = 330, FLOOR = 296, PX_PER_CM = 1.5, INK = '#2f2a24';
  const FONT = '"Suayona Sans", Pretendard, system-ui, sans-serif';
  const KIDS = ['sua', 'yona'], KID_NAME = { sua: '수아', yona: '연아' }, KID_COLOR = { sua: '#ff7f8a', yona: '#6cc7b3' };
  const KID_X = { sua: 150, yona: 366 };
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
  const GEAR_LV = 2, SHINE_LV = 5, MAX_LV = 12;
  const need = n => 5 * n * (n + 1);                                     // Lv.n 이 되는 누적 경험치: 10 · 30 · 60 · 100 · 150 · 210 …
  function levelOf(xp){ let n = 0; while (n < MAX_LV && xp >= need(n + 1)) n++; return n; }

  // ---------- 상태 ----------
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
      const o = out[e.stat]; o.xp += e.xp; o.n++;
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
    const lv = s => st[s].lv, on = s => lv(s) >= GEAR_LV;
    const key = [k, frame].concat(STATS.map(s => Math.min(lv(s.key), SHINE_LV))).join('|');
    if (avatarBuf[key]) return avatarBuf[key];
    const rows = KIDART[k].down[frame], pal = Object.assign({}, KIDPAL[k]), W = rows[0].length, H = rows.length;
    if (on('body')){ pal.b = '#6cc7b3'; pal.B = '#3f9e8b'; }               // 🏃 민트 운동화
    const c = document.createElement('canvas'); c.width = W + MX * 2; c.height = H + MY * 2;
    const g = c.getContext('2d');
    const dot = (x, y, col, w, h) => { g.fillStyle = col; g.fillRect(MX + x, MY + y, w || 1, h || 1); };
    const paint = (ox, oy, one) => { for (let r = 0; r < H; r++) for (let x = 0; x < W; x++){ const ch = rows[r][x]; if (ch !== '.') dot(x + ox, r + oy, one || pal[ch] || '#000'); } };
    [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(o => paint(o[0], o[1], 'rgba(36,28,20,.78)'));
    paint(0, 0);
    const top = rows.findIndex(r => /[^.]/.test(r));                     // 걸음 둘째 장은 두 도트 내려앉는다
    if (on('body')){ dot(9, H - 3, '#fff', 3, 1); dot(16, H - 3, '#fff', 3, 1); }
    if (on('art')){                                                      // 🎨 베레모 + 붓
      const b1 = lv('art') >= SHINE_LV ? '#c03a4b' : '#d9534f', b2 = '#8f2a35';
      dot(7, top - 1, INK, 14, 1); dot(6, top, INK, 16, 3); dot(7, top, b1, 14, 2); dot(8, top - 1, b1, 12, 1); dot(7, top + 2, b2, 14, 1); dot(13, top - 3, INK, 2, 2); dot(13, top - 2, b1, 1, 1);
      dot(23, top + 20, INK, 3, 11); dot(24, top + 23, '#a0522d', 1, 7); dot(23, top + 19, INK, 3, 1); dot(24, top + 20, '#ffd979', 1, 3);
    }
    if (on('write')){ for (let i = 0; i < 5; i++){ dot(22 + Math.floor(i / 2), top + 12 - i, INK, 3, 1); dot(23 + Math.floor(i / 2), top + 12 - i, i === 4 ? '#ff7f8a' : '#ffd24d', 1, 1); } }   // ✍️ 귀에 꽂은 연필
    if (on('stage')){ dot(2, top + 21, INK, 5, 5); dot(3, top + 22, '#8d8d9b', 3, 3); dot(3, top + 22, '#d8d8e2', 1, 1); dot(3, top + 26, INK, 3, 5); dot(4, top + 26, '#4a4458', 1, 4); }   // 🎹 마이크
    if (on('grit')){ dot(11, top + 21, '#5b7fbf', 1, 3); dot(16, top + 21, '#5b7fbf', 1, 3); dot(12, top + 24, INK, 4, 4); dot(12, top + 24, '#ffd24d', 3, 3); dot(13, top + 25, '#fff3ae', 1, 1); }   // 🏆 금메달
    if (on('heart')){ dot(17, top + 25, '#ff5d7a', 1, 1); dot(19, top + 25, '#ff5d7a', 1, 1); dot(17, top + 26, '#ff5d7a', 3, 1); dot(18, top + 27, '#ff5d7a', 1, 1); }   // 💗 하트 배지
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
      if (fam && big && cm >= 100){ g.font = '700 7px ' + FONT; g.fillStyle = INK; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(String(cm), rx + 17, y); }
    }
    g.font = '800 8px ' + FONT; g.fillStyle = '#8a7a66'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('키 재는 자', RW / 2, FLOOR - 175 * PX_PER_CM - 12);
    return (bgCv = c);
  }
  const now = () => Date.now();
  function viewAt(){ return replay ? replay.at : now(); }
  let frameN = 0;
  function draw(){
    const cv = q('#lifeCv'); if (!cv) return;
    const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, RW, RH); g.drawImage(background(), 0, 0, RW, RH);
    const at = viewAt();
    KIDS.forEach(k => {
      const st = statsAt(k, at), cm = heightAt(k, at), x = KID_X[k];
      const bob = !STILL && !replay && (frameN + (k === 'sua' ? 0 : 2)) % 8 < 1 ? 1 : 0;
      const img = avatar(k, st, 0), rows = KIDART[k].down[0], u = cm * PX_PER_CM / rows.length;   // 도트 한 칸의 화면 크기 — 머리끝~발끝이 실제 키
      if (k === sel){ g.fillStyle = 'rgba(255,217,121,.75)'; g.beginPath(); g.ellipse(x, FLOOR + 6, 62, 11, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(47,42,36,.22)'; g.beginPath(); g.ellipse(x, FLOOR + 5, 40, 6, 0, 0, Math.PI * 2); g.fill();
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
      if (fam){ const y = Math.round(FLOOR - cm * PX_PER_CM), dir = k === 'sua' ? 1 : -1; const mx = dir > 0 ? RW / 2 - 35 : RW / 2 + 10; g.fillStyle = KID_COLOR[k]; g.fillRect(mx, y, 25, 2); g.fillStyle = INK; g.fillRect(dir > 0 ? mx : mx + 23, y - 1, 2, 4); }   // 머리끝이 자에 닿는 자리
    });
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
      '<p class="life-nick">「' + escapeHTML(nickOf(st)) + '」' + (age !== null ? ' · 레벨은 나이예요' : '') + (fam ? ' · 키 ' + Math.round(heightAt(sel, at) * 10) / 10 + 'cm' : '') + '</p>' + radarSVG(st) +
      '<ul class="gear-list">' + STATS.map(s => '<li class="' + (st[s.key].lv >= GEAR_LV ? '' : 'off') + '">' + s.icon + ' ' + s.gear + (st[s.key].lv >= SHINE_LV ? ' ✦' : '') + '</li>').join('') + '</ul>';
    box.innerHTML = '<h2>능력치</h2>' + STATS.map(s => {
      const o = st[s.key], lo = need(o.lv), hi = need(o.lv + 1), f = o.lv >= MAX_LV ? 1 : (o.xp - lo) / (hi - lo), up = o.xp - past[s.key].xp;
      return '<div class="stat-row"><span class="nm">' + s.icon + ' ' + s.name + '</span><span class="stat-bar" style="--c:' + s.color + '"><i style="width:' + (fam ? Math.round(f * 100) : Math.round(Math.min(1, o.lv / 8) * 100)) + '%"></i></span>' +
        '<span class="lvn">' + (fam ? 'Lv.' + o.lv + (up > 0 && !replay ? '<span class="up">▲' + up + '</span>' : '') : o.lv >= SHINE_LV ? '✦' : o.lv >= GEAR_LV ? '●' : '○') + '</span>' +
        '<p class="stat-from">' + s.from + (fam ? ' · ' + s.unit + ' ' + o.n + ' · 경험치 ' + o.xp + (o.lv < MAX_LV ? ' / ' + hi : '') : '') + '</p></div>';
    }).join('') + (fam && !replay ? '<p class="stat-from" style="margin:6px 0 0;">▲ 는 지난달의 나보다 늘어난 경험치예요.</p>' : '');
    renderQuests(st);
  }
  // 다음 목표 — 1단계는 기록에서 저절로 나오는 것만(부모가 내는 퀘스트는 2단계). 가장 가까운 셋
  function renderQuests(st){
    const box = q('#lifeQuests'); if (!box) return;
    box.hidden = !fam || !!replay; if (box.hidden) return;
    const per = { art: XP.work, stage: XP.video, write: XP.diary, body: XP.run, heart: XP.clap, grit: XP.award };
    const how = { art: '그림이나 만들기를 올리면', stage: '연주·영상을 올리면', write: '일기를 쓰면', body: '달리기 놀이를 하면', heart: '박수를 받으면', grit: '상장·급수를 올리면' };
    const list = STATS.filter(s => st[s.key].lv < MAX_LV).map(s => { const o = st[s.key], left = need(o.lv + 1) - o.xp; return { s, o, left, times: Math.ceil(left / per[s.key]) }; }).sort((a, b) => a.times - b.times).slice(0, 3);
    box.innerHTML = '<h2>다음 목표</h2><ul class="quest-list">' + list.map(x => '<li><span class="ic">' + x.s.icon + '</span><span><b>' + x.s.name + ' Lv.' + (x.o.lv + 1) + '</b> 까지 ' + x.s.unit + ' ' + x.times + '번' +
      (x.o.lv + 1 === GEAR_LV ? ' — 「' + x.s.gear + '」가 생겨요' : x.o.lv + 1 === SHINE_LV ? ' — 장비가 반짝여요 ✦' : '') + '<small>' + how[x.s.key] + ' 경험치 +' + per[x.s.key] + ' · 남은 경험치 ' + x.left + '</small></span></li>').join('') + '</ul>';
  }
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
  function renderTools(){
    const box = q('#lifeTools'); if (!box) return;
    box.innerHTML = KIDS.map(k => '<button type="button" class="dot-btn small" data-kid="' + k + '" aria-pressed="' + (k === sel) + '">' + KID_NAME[k] + '</button>').join(' ') +
      ' <button type="button" class="dot-btn small" id="lifeReplay">' + (replay ? '■ 그만 보기' : '⏪ 자라 온 길 다시 보기') + '</button>';
    box.querySelectorAll('[data-kid]').forEach(b => b.addEventListener('click', () => pick(b.dataset.kid)));
    q('#lifeReplay').addEventListener('click', () => { if (replay) stopReplay(); else startReplay(); });
  }
  function pick(k){ if (!KIDS.includes(k) || k === sel){ return; } sel = k; roadAll = false; renderTools(); renderSheet(); renderRoad(); draw(); }

  // ---------- 자라 온 길 다시 보기 — 첫 기록부터 오늘까지 6초. 시계는 setInterval(가려진 탭에서도 끝까지 간다) ----------
  const REPLAY_MS = 6000;
  function startReplay(){
    const first = Math.min(now() - 365 * DAY, ...events.map(e => e.t), ...KIDS.flatMap(k => heights[k].map(h => h.t)));
    if (STILL){ say('움직임 줄이기를 켜 두어서 다시 보기는 쉬어요'); return; }
    replay = { from: first, at: first, t0: performance.now(), timer: setInterval(stepReplay, 60) };
    renderTools(); say('첫 기록부터 오늘까지 — 키가 자라고 장비가 하나씩 생겨요');
  }
  function stepReplay(){
    if (!replay) return;
    const p = Math.min(1, (performance.now() - replay.t0) / REPLAY_MS);
    replay.at = replay.from + (now() - replay.from) * p;
    draw(); renderSheet();
    if (p >= 1) stopReplay();
  }
  function stopReplay(){ if (!replay) return; clearInterval(replay.timer); replay = null; renderTools(); renderSheet(); draw(); say('오늘의 모습이에요'); }

  // ---------- 불러오기 — 부른 사람이 볼 수 있는 줄만 온다(RLS). 표마다 필요한 열만 ----------
  async function load(){
    fam = !!(isLoggedIn && me);
    if (fam){ try { born = await loadKids(); } catch (e) { born = {}; } }
    if (isChild && me && KIDS.includes(me.author_key)) sel = me.author_key;
    const ask = (t, cols, f) => { let r = sb.from(t).select(cols); if (f) r = f(r); return r.then(x => x.error ? [] : x.data || []).catch(() => { loadErr = true; return []; }); };
    const [works, posts, runs, honors, grow, wclaps, hclaps] = await Promise.all([
      ask('works', 'id, author, media_type, title, made_on, created_at', r => r.eq('status', 'published')),
      ask('posts', 'author, title, happened_on, created_at', r => r.eq('status', 'published')),
      ask('run_scores', 'who, score, created_at', r => r.in('who', KIDS)),
      ask('honors', 'id, who, kind, title, got_on, created_at'),
      ask('growth', 'who, cm, measured_on', r => r.eq('kind', 'height').order('measured_on')),
      ask('work_claps', 'work_id, created_at'),
      ask('honor_claps', 'honor_id, created_at'),
    ]);
    events = []; heights = { sua: [], yona: [] };
    const add = (who, e) => kidsOf(who).forEach(k => { if (Number.isFinite(e.t)) events.push(Object.assign({ k }, e)); });
    const firsts = {};
    const firstOf = (k, tag) => { const key = k + tag; if (firsts[key]) return false; firsts[key] = 1; return true; };
    const wAuthor = {}, hWho = {};
    works.slice().sort((a, b) => whenOf(a.made_on, a.created_at) - whenOf(b.made_on, b.created_at)).forEach(w => {
      wAuthor[w.id] = w.author;
      const vid = w.media_type === 'youtube' || w.media_type === 'video', t = whenOf(w.made_on, w.created_at), both = w.author === 'together';
      kidsOf(w.author).forEach(k => {
        const first = firstOf(k, vid ? 'v' : 'w');
        events.push({ k, t, stat: vid ? 'stage' : 'art', xp: vid ? XP.video : XP.work, icon: vid ? '🎹' : '🎨', label: first ? (vid ? '첫 영상 「' : '첫 작품 「') + (w.title || '') + '」' : '' });
        if (both) events.push({ k, t, stat: 'heart', xp: XP.together });
      });
    });
    posts.slice().sort((a, b) => whenOf(a.happened_on, a.created_at) - whenOf(b.happened_on, b.created_at)).forEach(p => kidsOf(p.author).forEach(k => {
      events.push({ k, t: whenOf(p.happened_on, p.created_at), stat: 'write', xp: XP.diary, icon: '✍️', label: firstOf(k, 'p') ? '첫 일기 「' + (p.title || '') + '」' : '' });
    }));
    runs.forEach(r => add(r.who, { t: dayOf(r.created_at), stat: 'body', xp: XP.run, score: Number(r.score) || 0 }));
    honors.forEach(h => { hWho[h.id] = h.who; add(h.who, { t: whenOf(h.got_on, h.created_at), stat: 'grit', xp: XP[h.kind] || XP.award, kind: h.kind, label: h.title || '업적' }); if (h.who === 'both') add('both', { t: whenOf(h.got_on, h.created_at), stat: 'heart', xp: XP.together }); });
    wclaps.forEach(c => add(wAuthor[c.work_id], { t: dayOf(c.created_at), stat: 'heart', xp: XP.clap }));
    hclaps.forEach(c => add(hWho[c.honor_id], { t: dayOf(c.created_at), stat: 'heart', xp: XP.clap }));
    grow.forEach(r => { const k = r.who === '수아' ? 'sua' : r.who === '연아' ? 'yona' : r.who; if (heights[k] && Number(r.cm) > 0) heights[k].push({ t: dayOf(r.measured_on), cm: Number(r.cm) }); });
    KIDS.forEach(k => heights[k].sort((a, b) => a.t - b.t));
    loaded = true;
    q('#lifeGuest').hidden = fam;
    renderTools(); renderSheet(); renderRoad(); draw();
    say(loadErr ? '기록을 다 불러오지 못했어요 — 잠시 뒤 다시 열어 주세요' : '아바타를 누르면 그 아이의 기록이 나와요');
  }

  // ---------- 누르기·움직임 ----------
  function wire(){
    const cv = q('#lifeCv'); if (!cv) return;
    const kidAt = e => { const rc = cv.getBoundingClientRect(); if (!rc.width) return null; const x = (e.clientX - rc.left) / rc.width * RW; return x < RW / 2 ? 'sua' : 'yona'; };
    cv.addEventListener('click', e => { const k = kidAt(e); if (k) pick(k); });
    cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') pick('sua'); if (e.key === 'ArrowRight') pick('yona'); });
    if (!STILL) setInterval(() => { if (document.hidden || replay || !loaded) return; const rc = cv.getBoundingClientRect(); if (rc.bottom < 0 || rc.top > (window.innerHeight || 800)) return; frameN++; draw(); }, 260);
  }

  (async function boot(){
    try { await refreshAuth(); } catch (e) { /* 로그인 확인이 안 되면 손님으로 본다 */ }
    wire();
    await load();
    if (typeof initReveal === 'function') initReveal();
  })();

  window.LIFE = { draw, _stats: statsAt, _height: heightAt, _events: () => events, _pick: pick, _sel: () => sel, _replay: () => replay, _start: startReplay, _stop: stopReplay, _fam: () => fam, _level: levelOf, _need: need, _load: load, _tick: () => { frameN++; draw(); } };
})();
