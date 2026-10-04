/* 연아네 냠냠 시장 — 연아가 그리고 만든 프룻프렌즈·디저트프렌즈·넛프렌즈·스낵프렌즈 도감.
   책 한 권이 가게 한 칸이고, 가게 앞 뽑기 기계로 친구를 하나씩 만난다.
   뽑기로 만난 친구는 이 브라우저에만 적어 둔다(다른 기기와는 따로). */

// 책 = 가게. a·b 는 차양 두 줄무늬 색
const BOOKS = [
  { id: "fruit", title: "프룻프렌즈", en: "Fruit Friends", emoji: "🍓", color: "#ff6b81", deep: "#c93a57", soft: "#ffe3e8", a: "#ef5350", b: "#fff3f3" },
  { id: "dessert", title: "디저트프렌즈", en: "Dessert Friends", emoji: "🧁", color: "#ff8fc4", deep: "#c2477f", soft: "#ffe6f2", a: "#b07cd8", b: "#fdf0ff" },
  { id: "nut", title: "넛프렌즈", en: "Nut Friends", emoji: "🥜", color: "#c08a52", deep: "#7f5127", soft: "#f5e6d3", a: "#6aa84f", b: "#fff8e6" },
  { id: "snack", title: "스낵프렌즈", en: "Snack Friends", emoji: "🍪", color: "#ffb43c", deep: "#c9761c", soft: "#fff0cf", a: "#4a90e2", b: "#ffe27a" },
];

// 연아 범례(사진 아래 줄)의 테두리 색 뜻 그대로
const TAGS = {
  villain: { word: "빌런", color: "#e0393e" },
  love: { word: "커플·짝사랑·썸", color: "#e0398f" },
  sib: { word: "형제자매", color: "#3fb3e6" },
  revive: { word: "부활", color: "#f2c200" },
  bad: { word: "질 나쁨", color: "#f08a24" },
  bullied: { word: "괴롭힘 당함", color: "#8bc53f" },
};

// 친구 하나 = 한 줄. 그림은 friends/<id>.svg — 연아 그림을 tools/friends-build.py 가 선 정리·색칠한 것.
// 이름은 연아 손글씨를 읽어 옮긴 것, 종류(kind)는 그림을 보고 내가 붙인 것이다. love = 짝 표시(♥ ○ △ ☆)로 이어진 상대.
const F = (book, id, name, kind = "", tags = [], love = "") => ({ book, id, name, kind, tags, love, img: `/friends/${id}.svg?v=1004f` });
const FRIENDS = [
  F("fruit", "cherry", "이체리", "체리", ["revive"]),
  F("fruit", "orange", "오렌지", "오렌지"),
  F("fruit", "peach", "똑숭아", "복숭아"),
  F("fruit", "watermelon", "수박 아저씨", "수박", ["love"], "banana"),
  F("fruit", "banana", "바나나아줌마", "바나나", ["love"], "watermelon"),
  F("fruit", "slice", "샤수박", "수박 조각", ["revive"]),
  F("fruit", "pirate", "사과해적", "사과", ["bad"]),
  F("fruit", "muscat", "샤인머스켓", "청포도"),
  F("fruit", "strawberry", "미딸기", "딸기"),
  F("fruit", "carrot", "최당근", "당근"),
  F("fruit", "olive", "올리브", "올리브"),
  F("fruit", "chef", "악마 요리사", "요리사", ["villain"]),
  F("fruit", "blueberry", "블루베리 삼형제", "블루베리", ["sib"]),
  F("fruit", "bangul", "방울이", "방울토마토"),
  F("nut", "chestnut", "알밤이", "밤"),
  F("nut", "almond", "몬디", "아몬드"),
  F("nut", "peanut", "딱콩이", "땅콩"),
  F("nut", "walnut", "호둥이", "호두"),
  F("nut", "pistachio", "피치오", "피스타치오"),
  F("nut", "cashew", "캐슈거", "캐슈너트"),
  F("nut", "berry", "베리", "", ["revive", "love"], "brazil"),
  F("nut", "brazil", "브질트", "브라질너트", ["love"], "berry"),
  F("nut", "acorns", "도토리 삼형제", "도토리", ["sib"]),
  F("nut", "pinenut", "자니", "잣"),
  F("nut", "squirrel", "캐리다람", "다람쥐", ["villain"]),
  F("nut", "raccoon", "캐리구리", "너구리", ["villain"]),
  F("dessert", "bread", "식빵이", "식빵", ["bullied"]),
  F("dessert", "donut", "도넛씨", "도넛"),
  F("dessert", "sandwich", "썬두위치", "샌드위치"),
  F("dessert", "muffin", "머핀이", "머핀"),
  F("dessert", "croissant", "크루아상 군", "크루아상", ["love"], "creambun"),
  F("dessert", "creambun", "크림빵 양", "크림빵", ["love"], "croissant"),
  F("dessert", "cookies", "쿠키형제", "쿠키", ["sib"]),
  F("dessert", "macaron", "마카롱 자매", "마카롱", ["sib"]),
  F("dessert", "shrimp", "새우밥", "새우", ["sib"]),
  F("dessert", "slice2", "샤수박", "수박 조각", ["revive"]),
  F("dessert", "pudding", "푸딩스", "푸딩", ["sib"]),
  F("dessert", "cake", "케이크 왕", "케이크", ["bad"]),
  F("dessert", "madeleine", "마들렌", "마들렌"),
  F("dessert", "dessert", "디저필스", "요리사"),
  F("dessert", "bar", "딸기바 아줌마", "딸기 아이스바", ["love"], "soda"),
  F("dessert", "soda", "소다아저씨", "소다", ["love"], "bar"),
  F("dessert", "icecop", "아이스 킴", "", ["villain"]),
  F("snack", "berry2", "베리", "", ["revive"]),
  F("snack", "ddakbbang", "딱빵이"),
  F("snack", "jjondeugi", "쫀두기·쫀도기", "쫀드기", ["sib"]),
  F("snack", "marshmallow", "마시로", "마시멜로"),
  F("snack", "choco", "쪼꼬이", "초콜릿"),
  F("snack", "chip", "칩이", "", ["bullied"]),
  F("snack", "rainbow", "레인보우 7형제", "", ["sib"]),
  F("snack", "hotdog", "핫도그 패거리", "핫도그", ["bad"]),
];
BOOKS.forEach(b => FRIENDS.filter(f => f.book === b.id).forEach((f, i) => f.no = i + 1));

// 사이트 공통 머리줄 — common.js 가 못 실려도 도감은 그대로 돈다
if (typeof buildChrome === "function") buildChrome("friends");

(function () {
  const $ = s => document.querySelector(s);
  const book = id => BOOKS.find(b => b.id === id);
  const friend = id => FRIENDS.find(f => f.id === id);
  const castOf = id => FRIENDS.filter(f => f.book === id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const jong = w => (w.charCodeAt(w.length - 1) - 0xac00) % 28 !== 0; // 받침 있나
  const j = (w, a, b) => w + (jong(w) ? a : b);
  const pic = (f, cls = "pic") => `<img class="${cls}" src="${esc(f.img)}" alt="" loading="lazy" decoding="async">`;
  const tagHtml = f => f.tags.map(t => `<span class="rel" style="--t:${TAGS[t].color}">${TAGS[t].word}</span>`).join("");
  const fmt = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── 뽑기로 만난 친구 { id: "2026.10.03" } — 브라우저 저장이 막혀 있으면 이번 방문 동안만 ──
  const KEY = "friends-met";
  let met = {};
  try { met = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(met)); } catch {} };

  // ── 가게 세 칸 ──
  function renderStalls() {
    $("#stalls").innerHTML = BOOKS.map(b => `
      <section class="stall" id="stall-${b.id}" data-book="${b.id}" aria-labelledby="t-${b.id}">
        <div class="awning" style="--a:${b.a};--b:${b.b}" aria-hidden="true"></div>
        <div class="board-name"><h2 id="t-${b.id}">${b.emoji} ${b.title} 가게</h2><span>${b.en} · 친구 ${castOf(b.id).length}</span></div>
        <div class="shelf">${castOf(b.id).map(f => `
          <button class="item" data-id="${f.id}" aria-label="${esc(f.name)}${f.kind ? ", " + esc(f.kind) : ""}${met[f.id] ? ", 뽑기로 만남" : ""}">
            ${pic(f)}
            <span class="crate"><b>${esc(f.name)}</b>${met[f.id] ? `<i class="stamp" aria-hidden="true">만남!</i>` : ""}</span>
            <span class="ptag" aria-hidden="true"${f.tags[0] ? ` style="--t:${TAGS[f.tags[0]].color}"` : ""}>No.${f.no}${f.kind ? `<small>${esc(f.kind)}</small>` : ""}</span>
          </button>`).join("")}</div>
      </section>`).join("");
    const n = FRIENDS.filter(f => met[f.id]).length;
    $("#metCount").textContent = n; $("#metAll").textContent = FRIENDS.length;
    $("#reset").hidden = !n;
  }

  $("#tabs").innerHTML = `<button class="tab" data-go="all" aria-pressed="true">전체</button>` +
    BOOKS.map(b => `<button class="tab" data-go="${b.id}" aria-pressed="false">${b.emoji} ${b.title}</button>`).join("") +
    `<a class="tab" href="#rel">💞 관계도</a>`;
  $("#tabs").addEventListener("click", e => {
    const t = e.target.closest(".tab[data-go]"); if (!t) return;
    document.querySelectorAll(".tab").forEach(x => x.setAttribute("aria-pressed", x === t));
    document.querySelectorAll(".stall").forEach(s => s.hidden = t.dataset.go !== "all" && s.dataset.book !== t.dataset.go);
    if (t.dataset.go !== "all") $("#stall-" + t.dataset.go).scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  });

  // ── 뽑기 기계 ──
  const SPOTS = [[8, 214], [62, 218], [116, 214], [170, 218], [224, 212], [30, 166], [86, 162], [140, 168], [194, 162], [236, 160], [58, 116], [118, 120], [178, 114], [92, 72], [154, 70]];
  $("#dome").innerHTML = SPOTS.map(([x, y], i) =>
    `<span class="cap" style="left:${x}px;top:${y}px;--r:${(i * 47) % 90 - 45}deg;--d:${-(i % 5) * .05}s;--c:${BOOKS[i % BOOKS.length].color}"></span>`).join("");

  let pool = "all", busy = false, deg = 0, last = null;
  const today = FRIENDS[Math.floor(Date.now() / 864e5) % FRIENDS.length]; // 날마다 다른 친구

  function idle() {
    $("#board").innerHTML = `
      <div class="today"><div class="today-pic">${pic(today)}</div>
        <div><h2>오늘의 추천 친구</h2><div class="who">${esc(today.name)}</div><p>${book(today.book).emoji} ${book(today.book).title}${today.kind ? " · " + esc(today.kind) : ""}</p>
          <button class="chalk-btn" data-receipt="${today.id}">영수증 보기</button></div></div>
      <hr>
      <p class="ask">뽑기 손잡이를 돌려 친구를 만나 보세요! 어느 가게 친구를 뽑을까요?</p>
      <div class="pool">${[["all", "🎲 아무거나"], ...BOOKS.map(b => [b.id, `${b.emoji} ${b.title}`])].map(([id, t]) =>
        `<button data-pool="${id}" aria-pressed="${pool === id}">${t}</button>`).join("")}</div>`;
  }

  function turn() {
    if (busy) return; busy = true;
    $("#hint").hidden = true;
    $("#chute").innerHTML = "";
    $("#knob").style.transform = `rotate(${deg += 360}deg)`;
    $("#dome").classList.add("shake");
    // 아직 못 만난 친구가 먼저 나온다
    const inPool = FRIENDS.filter(f => pool === "all" || f.book === pool);
    const fresh = inPool.filter(f => !met[f.id]);
    const from = fresh.length ? fresh : inPool;
    const f = from[Math.floor(Math.random() * from.length)];
    setTimeout(() => {
      $("#dome").classList.remove("shake");
      $("#chute").innerHTML = `<button class="cap" style="--c:${book(f.book).color}" data-cap="${f.id}" aria-label="나온 캡슐 열기"></button>`;
      $("#board").innerHTML = `<div class="wait"><div class="bob" aria-hidden="true">✨</div><h2>캡슐이 나왔어요!</h2><p>뽑기 기계 아래 캡슐을 눌러서 열어 보세요.</p></div>`;
      $("#chute .cap").focus({ preventScroll: true });
    }, reduced ? 0 : 1000);
  }

  function reveal(id) {
    const f = friend(id), b = book(f.book), isNew = !met[id];
    if (isNew) { met[id] = fmt(new Date()); save(); }
    last = id; busy = false;
    $("#chute").innerHTML = "";
    const COL = ["#ff6b81", "#ffd84d", "#7ed6a5", "#6cc4ff", "#b08cff", "#ff8fc4", "#fff"];
    const conf = Array.from({ length: 22 }, (_, i) => {
      const a = i / 22 * Math.PI * 2, r = 110 + Math.random() * 90;
      return `<i class="conf" style="--k:${COL[i % COL.length]};--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;--rot:${Math.random() * 720}deg"></i>`;
    }).join("");
    $("#board").innerHTML = `<div class="got">
      <div class="open-cap" style="--c:${b.color}"><div class="half top"></div><div class="half bot"></div><div class="pop">${pic(f)}</div>${conf}</div>
      <span class="badge ${isNew ? "" : "old"}">${isNew ? "✨ 새 친구!" : "또 만났네!"}</span>
      <h2>${esc(j(f.name, "을", "를"))} 만났어요!</h2><p>${b.emoji} ${b.title} 가게 ${f.no}번${f.kind ? " · " + esc(f.kind) : ""}</p>
      <div class="actions"><button class="chalk-btn solid" data-receipt="${f.id}">영수증 보기</button><button class="chalk-btn" id="again">한 번 더!</button></div></div>`;
    renderStalls();
    // 폰에서는 칠판이 기계 아래라 화면 밖일 수 있다 — 만난 친구가 보이게 내려 준다
    const r = $("#board").getBoundingClientRect();
    if (r.top > innerHeight * .5) $("#board").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }

  $("#knob").addEventListener("click", turn);
  $("#chute").addEventListener("click", e => { const c = e.target.closest("[data-cap]"); if (c) reveal(c.dataset.cap); });
  $("#board").addEventListener("click", e => {
    const p = e.target.closest("[data-pool]"); if (p) { pool = p.dataset.pool; idle(); return; }
    if (e.target.closest("#again")) {
      idle(); turn();
      // 폰: 기계가 위로 지나가 있으면 캡슐이 나오는 게 보이게 올려 준다
      if ($(".machine").getBoundingClientRect().top < 0) $(".machine").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    }
  });
  $("#reset").addEventListener("click", () => {
    met = {}; save(); renderStalls(); if (!busy) idle();
  });

  // ── 영수증 ──
  const dlg = $("#dlg");
  function openReceipt(id) {
    const f = friend(id), b = book(f.book), fr = f.love && friend(f.love);
    const row = (k, v) => `<div class="row"><span>${k}</span><i class="dots"></i><span>${v}</span></div>`;
    dlg.innerHTML = `<div class="receipt">
      <button class="close" aria-label="닫기">✕</button>
      <h3 id="dlgTitle">냠냠 시장 영수증</h3>
      <div class="center">${b.title} 가게 · ${fmt(new Date())}</div>
      <div class="r-pic">${pic(f)}</div>
      <hr>
      ${row("이름", esc(f.name))}${f.kind ? row("종류", esc(f.kind)) : ""}${row("책", `${b.title} ${f.no}번`)}
      ${fr ? row("짝", `<button class="link" data-receipt="${fr.id}">${esc(fr.name)}</button>`) : ""}
      ${row("처음 만난 날", met[f.id] || "아직 — 뽑기에서 만나요")}
      ${f.tags.length ? `<div class="rels">${tagHtml(f)}</div>` : ""}
      <hr>
      <div class="total"><span>합계</span><span>귀여움 ∞원</span></div>
      <div class="barcode" aria-hidden="true"></div>
      <div class="center">또 놀러 오세요!</div>
    </div>`;
    if (!dlg.open) dlg.showModal();
    dlg.querySelector(".close").focus();
  }
  document.addEventListener("click", e => {
    const it = e.target.closest(".item"); if (it) return openReceipt(it.dataset.id);
    const r = e.target.closest("[data-receipt]"); if (r) return openReceipt(r.dataset.receipt);
    if (e.target.closest(".close") || e.target === dlg) dlg.close();
  });

  // ── 관계도: 연아 범례 색별로 한 판에. 짝은 둘씩 묶고, 나머지는 무리째 ──
  const chip = f => `<button class="who-chip" data-receipt="${f.id}">${pic(f)}<b>${esc(f.name)}</b><small>${book(f.book).emoji}</small></button>`;
  const MARK = { watermelon: "♥", croissant: "○", berry: "△", bar: "☆" }; // 연아가 짝마다 그려 둔 표시
  const pairs = FRIENDS.filter(f => f.love && f.id < f.love).map(f => [f, friend(f.love)]);
  $("#relBoard").innerHTML = Object.entries(TAGS).map(([k, t]) => {
    const body = k === "love"
      ? pairs.map(([a, b]) => `<div class="pair">${chip(a)}<span class="heart" aria-label="짝">${MARK[a.id] || MARK[b.id] || "♥"}</span>${chip(b)}</div>`).join("")
      : FRIENDS.filter(f => f.tags.includes(k)).map(chip).join("");
    const n = k === "love" ? `${pairs.length}쌍` : `${FRIENDS.filter(f => f.tags.includes(k)).length}`;
    return `<section class="rel-box ${k === "love" ? "wide" : ""}" style="--t:${t.color}"><h3>${t.word} <span>${n}</span></h3><div class="rel-body">${body}</div></section>`;
  }).join("");

  renderStalls(); idle();
})();
