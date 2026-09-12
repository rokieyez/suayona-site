// games.html 의 페이지 스크립트 — 게임 세 가지를 모아 놓은 곳.
// 싣는 순서: supabase → pixel → common → 이 파일.

buildChrome('games');

// 카드 아이콘 (첫 화면 메뉴 카드와 같은 방식)
$$('canvas[data-icon]').forEach(cv => {
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sp = SPRITES[cv.dataset.icon];
  if (!sp) return;
  const w = sp[0].length, h = sp.length;
  const s = Math.floor(Math.min(cv.width / w, cv.height / h));
  drawSprite(ctx, sp, Math.floor((cv.width - w * s) / 2), Math.floor((cv.height - h * s) / 2), s);
});

// 카드마다 서 있는 친구 — 스프라이트 크기가 제각각이라 배율을 그때그때 잡는다(줄이지는 않는다)
$$('canvas[data-char]').forEach(cv => {
  const sp = SPRITES[cv.dataset.char];
  if (!sp) return;
  const s = Math.max(1, Math.floor(46 / Math.max(sp[0].length, sp.length)));
  cv.width = sp[0].length * s; cv.height = sp.length * s;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawSprite(g, sp, 0, 0, s);
});

initReveal();
