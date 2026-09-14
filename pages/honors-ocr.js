/* 상장 사진 글자 읽기 — 자랑 올리기 폼에서 사진을 고르면 honors.js 가 이 파일을 늦게 불러 쓴다.
   · 글자 읽기(tesseract.js)는 이 기기 브라우저 안에서만 돈다. 사진은 어디로도 보내지 않는다.
     받아 오는 것은 읽는 프로그램과 한국어 글자 사전뿐이고, 사전은 브라우저에 남아 다음부턴 안 받는다.
   · 읽은 줄에서 상 이름·주는 곳·받은 날을 고른다. 틀릴 수 있으니 폼은 빈 칸만 채우고 고치는 건 부모 몫.
   손님은 이 파일을 받지 않는다(폼은 부모만 연다). */
(function(){
  'use strict';

  // 판을 못 박는다 — 메인 스크립트는 SRI 로, 나머지는 판 번호가 박힌 주소로만 받는다
  const TESS = {
    src: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
    sri: 'sha384-2BQ3U3OdKOb0Uczxqr41I9UvZkzr4V9Hv8uSzMMZAlmhsFClvdZX5wi5fDCzG+tM',
    worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
    core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
    lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/kor@1.0.0/4.0.0_best_int',
  };
  const LONG_MAX = 2400, LONG_MIN = 1400;   // 읽기 좋은 크기로 맞춘다(너무 크면 느리고, 작으면 글자가 뭉개진다)

  let libReady = null, workerReady = null, progressCb = null;
  function loadLib(){
    if (libReady) return libReady;
    libReady = new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve(window.Tesseract);
      const sc = document.createElement('script');
      sc.src = TESS.src; sc.integrity = TESS.sri; sc.crossOrigin = 'anonymous';
      sc.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('글자 읽기 도구가 비어 있어요'));
      sc.onerror = () => { libReady = null; sc.remove(); reject(new Error('글자 읽기 도구를 받지 못했어요')); };
      document.head.appendChild(sc);
    });
    return libReady;
  }
  function getWorker(){
    if (workerReady) return workerReady;
    workerReady = loadLib()
      .then(T => T.createWorker('kor', 1, {
        workerPath: TESS.worker, corePath: TESS.core, langPath: TESS.lang,
        logger: m => { if (progressCb) try { progressCb(m); } catch (e) { /* 진행 표시는 없어도 된다 */ } },
      }))
      .catch(e => { workerReady = null; throw e; });
    return workerReady;
  }

  function toImage(src){
    if (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement) return Promise.resolve(src);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(src), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 열지 못했어요')); };
      img.src = url;
    });
  }
  function fit(img){
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height, long = Math.max(w0, h0);
    const sc = long > LONG_MAX ? LONG_MAX / long : long < LONG_MIN ? LONG_MIN / long : 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * sc)); c.height = Math.max(1, Math.round(h0 * sc));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  // 결과 덩어리(blocks → paragraphs → lines)에서 줄만 뽑는다. 판마다 모양이 조금씩 달라 넉넉하게 훑는다.
  function collectLines(data){
    const out = [];
    (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => {
      const bb = l.bbox || {};
      out.push({ text: String(l.text || '').trim(), y: bb.y0 || 0, h: (bb.y1 || 0) - (bb.y0 || 0), conf: l.confidence || 0 });
    })));
    if (!out.length && data.text) String(data.text).split('\n').forEach((t, i) => out.push({ text: t.trim(), y: i, h: 0, conf: 0 }));
    return out.filter(l => l.text).sort((a, b) => a.y - b.y);
  }

  async function read(src, onProgress){
    const t0 = performance.now();
    const cv = fit(await toImage(src));
    progressCb = onProgress || null;
    try {
      const w = await getWorker();
      const { data } = await w.recognize(cv, {}, { text: true, blocks: true });
      const lines = collectLines(data);
      const out = parse(lines, todayISO());
      out.lines = lines.map(l => l.text);
      out.ms = Math.round(performance.now() - t0);
      return out;
    } finally { progressCb = null; }
  }
  // 폼을 열고 사진 칸을 누르는 순간 미리 받아 두면 고른 뒤 기다림이 짧다
  function warm(){ getWorker().catch(() => {}); }

  // ---------------------------------------------------------------------------
  // 읽은 줄 → 상 이름·주는 곳·받은 날
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  // 공백을 빼고 찾되 원래 글의 자리를 기억한다 — 찾은 조각을 원래 띄어쓰기로 되돌리려고
  function squeeze(s){ let out = ''; const map = []; for (let i = 0; i < s.length; i++){ if (!/\s/.test(s[i])){ out += s[i]; map.push(i); } } return { s: out, map }; }
  function spanOf(orig, sq, a, b){ return b > a ? tidy(orig.slice(sq.map[a], sq.map[b - 1] + 1)) : ''; }
  // 글자마다 띄워 읽힌 것(「우 수 상」)은 붙이고, 낱말 띄어쓰기는 살린다
  function tidy(s){
    const t = String(s).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (t.length >= 3 && t.filter(x => x.length === 1).length / t.length > 0.5) return t.join('');
    return t.join(' ');
  }
  // 흔한 잘못 읽기만 고친다: 숫자 사이의 O → 0, 장식 기호 → 공백
  function clean(s){
    return String(s || '')
      .replace(/[“”"'‘’`´|¦_=^*<>{}\[\]\\©®™§¶•●○◎◇◆□■△▲▽▼☆★※]/g, ' ')
      .replace(/(\d)[Oo]/g, (m, a) => a + '0').replace(/[Oo](\d)/g, (m, b) => '0' + b);
  }
  const compact = s => s.replace(/\s+/g, '');
  const clip = (s, n) => s.length > n ? s.slice(0, n).trim() : s;

  const GRADE_RE = /(최우수상|우수상|장려상|으뜸상|버금상|딸림상|노력상|모범상|선행상|효행상|봉사상|개근상|정근상|공로상|인기상|참가상|창의상|협동상|우정상|칭찬상|발표상|특별상|금상|은상|동상|대상|특상|입상|준우승|우승|[123]등|[123]위)/;
  const DOC_RE = /(표창장|감사장|임명장|위촉장|인증서|합격증|수료증|자격증|졸업장|확인서|상장)$/;
  const CONTEST_END = '(?:경시대회|경연대회|경진대회|사생대회|대회|골든벨|올림피아드|페스티벌|축제|콩쿠르|콩쿨|공모전|백일장|발표회|챔피언십|선발전|오디션|평가|검정|시험|캠프|전시회)';
  const ORG_END = '(?:초등학교|중학교|고등학교|대학교|학교|유치원|어린이집|학원|교습소|협회|연맹|연합회|위원회|협의회|재단|센터|도서관|박물관|과학관|교육지원청|교육청|시청|구청|군청|체육회|클럽|체육관|도장|음악원|미술원|아카데미|교회|신문사|방송사|주식회사|연구소|공단|공사|구단|협동조합)';
  const ORG_RE = new RegExp('^(.{0,24}' + ORG_END + ')(학교장|학원장|원장|이사장|위원장|회장|대표|총재|관장|센터장|장)?', 'd');
  const ROLE_ONLY_RE = /^(.{2,14}?(?:교육감|교육장|구청장|시장|군수|도지사|총장|장관))/d;
  const BODY_RE = /(합니다|하였|했으므로|으므로|하므로|기에|이에|드립니다|줍니다|증명|인정|되었|였음|습니다|위와같이)/;
  const STUDENT_RE = /(\d학년|\d반|성명|이름|초등부|중등부|유치부|저학년|고학년)/;
  const DATE_RE = /(\d{4,6})(?:년|[.\-\/,])+(\d{1,2})(?:월|[.\-\/,])+(\d{1,2})(?!\d)/dg;
  // 명조체 숫자는 곧잘 틀린다(시험: 2026 → 20926·2096, 12월 → 19월·13월). 2와 헷갈리는 9·3만 바꿔 보고,
  // 연도는 넷보다 길게 읽혔으면 네 자리를 골라 올해에 가까운 것부터 — 말이 되는 날짜가 처음 나오는 것을 쓴다.
  const DIGIT_SWAP = { '9': '2', '3': '2' };
  function variants(s){ let out = ['']; for (const ch of s){ const alt = DIGIT_SWAP[ch]; out = out.flatMap(p => alt ? [p + ch, p + alt] : [p + ch]); } return out; }
  function picks(s, n){ const out = []; const rec = (i, acc) => { if (acc.length === n){ out.push(acc); return; } for (let j = i; j < s.length; j++) rec(j + 1, acc + s[j]); }; rec(0, ''); return out; }
  function yearsOf(s, thisYear){
    const set = new Set();
    (s.length === 4 ? [s] : picks(s, 4)).forEach(x => variants(x).forEach(v => { const y = +v; if (y >= 2000 && y <= thisYear) set.add(y); }));
    if (set.has(+s)) return [+s];                       // 제대로 읽힌 네 자리는 그대로
    return [...set].sort((a, b) => (thisYear - a) - (thisYear - b));
  }
  // 달·날은 읽힌 수가 범위 안이면 그대로 믿는다(2월 31일을 21일로 「고치지」 않게). 범위 밖일 때만 바꿔 본다.
  const numsOf = (s, lo, hi) => { const n = +s; if (n >= lo && n <= hi) return [n]; return [...new Set(variants(s).map(Number))].filter(x => x >= lo && x <= hi); };
  const fixOrg = s => s.replace(/[혐헙]회/g, '협회').replace(/협화/g, '협회').replace(/(협회|학교|학원)함/g, '$1장');
  const grade1 = c => c.length <= 8 ? c.replace(/[삼샹싱]$/, '상') : '';   // 「우수삼」 — 끝 글자 상을 삼으로 읽곤 한다
  const SUBJECT_RE = /^위(?:의)?(?:어린이|학생|사람|원생|회원|선수|아동|친구|유아|분)?(?:은|는|을|를|이|가)|본(?:협회|원|교|회)/;
  const stripYear = s => s.replace(/^(?:19|20)\d{2}\s*(?:학년도|년도|년)?\s*(?:[12]\s*학기)?\s*/, '').trim();

  function findDates(line, today){
    const out = [], lim = addDays(today, 7);
    DATE_RE.lastIndex = 0;
    let m;
    const thisYear = +today.slice(0, 4);
    while ((m = DATE_RE.exec(line.c))){
      let hit = null;
      for (const y of yearsOf(m[1], thisYear)){
        for (const mo of numsOf(m[2], 1, 12)){
          for (const d of numsOf(m[3], 1, 31)){
            if (new Date(y, mo - 1, d).getMonth() !== mo - 1) continue;   // 2월 31일 같은 것
            const iso = y + '-' + pad(mo) + '-' + pad(d);
            if (iso > lim) continue;                                      // 앞날의 날짜는 받은 날일 수 없다
            hit = iso; break;
          }
          if (hit) break;
        }
        if (hit) break;
      }
      if (hit) out.push({ iso: hit, end: m.indices[0][1] });
    }
    return out;
  }
  function addDays(iso, n){ const [y, m, d] = iso.split('-').map(Number), t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }

  function parse(rawLines, today){
    today = today || todayISO();
    const lines = rawLines.map((l, i) => {
      const text = clean(l.text), sq = squeeze(text);
      return { i, text, sq, c: sq.s, h: l.h || 0, y: l.y == null ? i : l.y };
    }).filter(l => l.c.length);
    const isBody = l => l.c.length > 22 || BODY_RE.test(l.c);
    const short = lines.filter(l => !isBody(l) && l.c.length <= 16);

    // 받은 날 — 맨 아래 쪽 날짜(발급일). 본문 속 날짜보다 따로 선 줄을 먼저 본다.
    let date = null, dateLine = null;
    [lines.filter(l => !isBody(l)), lines].some(pool => {
      pool.forEach(l => { const ds = findDates(l, today); if (ds.length){ date = ds[ds.length - 1]; dateLine = l; } });
      return !!date;
    });

    // 문서 종류(상장·표창장·임명장…) — 짧은 제목 줄
    const docLine = short.find(l => l.c.length <= 6 && DOC_RE.test(l.c.replace(/^제?[\d\-]*호?/, '')));
    const doc = docLine ? docLine.c.match(DOC_RE)[1] : '';

    // 주는 곳 — 「○○학교장 홍길동」처럼 기관 이름 + 직위로 끝나는 줄, 날짜 아래일수록 점수
    let org = '', orgLine = null, best = 0;
    lines.forEach(l => {
      if (isBody(l) || STUDENT_RE.test(l.c) || SUBJECT_RE.test(l.c) || l === docLine) return;
      const from = l === dateLine ? date.end : 0;
      const c = fixOrg(l.c.slice(from)).replace(/^[^가-힣A-Za-z0-9(]+/, '');
      const off = l.c.length - c.length;
      let m = c.match(ORG_RE), score, a, b, role = '';
      if (m){ a = m.indices[1][0]; b = m.indices[1][1]; role = m[2] || ''; score = 2 + (role ? 3 : 0); }
      else if ((m = c.match(ROLE_ONLY_RE))){ a = m.indices[1][0]; b = m.indices[1][1]; score = 4; }
      else return;
      if (dateLine && l.y >= dateLine.y) score += 2;
      score += l.i / Math.max(1, rawLines.length);
      if (score > best){
        best = score; orgLine = l;
        org = fixOrg(spanOf(l.text, l.sq, a + off, b + off)).replace(/(학교|학원)\s*\1$/, '$1').replace(/^단법인/, '사단법인');
      }
    });

    // 상 이름
    const fullText = lines.map(l => l.text).join('\n'), full = squeeze(fullText);
    const piece = (m, g) => spanOf(fullText, full, m.indices[g][0], m.indices[g][1]);

    // 대회 이름 — 「위 어린이는 ○○ 대회에서」 사이
    let contest = '';
    let m = full.s.match(new RegExp('위(?:의)?(?:어린이|학생|사람|원생|회원|선수|아동|친구|유아|분)?(?:은|는|이|가)(.{0,36}?' + CONTEST_END + ')(?=에서|에|의|을|를|$)', 'd'));
    if (m) contest = piece(m, 1);
    else {
      const l = short.find(x => new RegExp(CONTEST_END + '$').test(x.c) && x !== docLine);
      if (l) contest = tidy(l.text);
    }
    contest = stripYear(contest.replace(/^.*?(?:실시한|주최한|주관한|개최한|열린|치러진)\s*/, ''));

    // 등급 — 크게 쓴 짧은 줄(「최우수상」「독서왕」)을 먼저, 없으면 본문에서
    let grade = '';
    const bySize = short.filter(l => l !== docLine && l !== dateLine && l !== orgLine && !STUDENT_RE.test(l.c)).sort((a, b) => b.h - a.h);
    for (const l of bySize){
      const g = grade1(l.c).match(GRADE_RE);
      if (g){ grade = g[1]; break; }
      if (/^[가-힣]{1,5}왕$/.test(l.c)){ grade = l.c; break; }
    }
    if (!grade){ const g = full.s.match(GRADE_RE); if (g && g[1] !== '입상') grade = g[1]; }

    // 직함 — 「위 학생을 ○○으로 임명합니다」
    let post = '';
    m = full.s.match(/(?:을|를)(.{2,30}?)(?:으로|로)(?:임명|위촉)/d);
    if (m) post = stripYear(piece(m, 1)).replace(/^.*?(?:초등학교|중학교|고등학교|학교|학원|유치원)\s*/, '').trim();

    // 급수 — 「피아노 실기 인증 5급」 같은 짧은 줄
    const levelLine = short.find(l => /\d{1,2}(?:급|단|품)/.test(l.c) && !STUDENT_RE.test(l.c) && l !== dateLine);

    let title = '';
    if (/임명장|위촉장/.test(doc) && post) title = post;
    else if (/합격증|인증서|자격증|수료증/.test(doc) && levelLine) title = tidy(levelLine.text);
    else if (grade) title = contest && !compact(contest).includes(grade) ? contest + ' ' + grade : (contest || grade);
    else if (post) title = post;
    else if (levelLine) title = tidy(levelLine.text);
    else if (contest) title = contest;
    else if (doc && doc !== '상장') title = doc;
    else {
      const big = bySize.find(l => /^[가-힣]{2,10}$/.test(l.c));
      if (big) title = big.c;
    }
    return { title: clip(title, 60), org: clip(org, 40), got_on: date ? date.iso : '', doc };
  }

  window.HonorOCR = { read, warm, parse };
})();
