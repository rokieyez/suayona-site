// run.html 의 페이지 스크립트. 게임 알맹이는 그대로 /pages/run.js 이고,
// 이 파일은 그 앞에서 머리글과 로그인만 차려 둔다.
// (2026-09-12) 첫 화면에 있던 구간을 제 쪽으로 옮겼다 — 게임은 「게임」 쪽에 모은다.
// 싣는 순서: supabase → pixel → common → 이 파일 → run.js.

buildChrome('games');   // 머리글에서는 「게임」 자리에 있는 놀이다

/* run.js 가 첫 화면의 최상위 이름 authOnce 를 쓴다(있으면 기다렸다가 부모면 기록 지우기
   단추를 보여 준다). 여기서 같은 이름으로 한 번만 물어봐 둔다 — run.js 보다 먼저 실려야 한다. */
const authOnce = refreshAuth().catch(() => null);

initReveal();
