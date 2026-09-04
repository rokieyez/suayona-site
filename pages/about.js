// about.html 의 페이지 스크립트. 전에는 HTML 안에 인라인으로 있었다.
// 파일로 빼 둔 이유: 문법 검사(node --check / eslint)가 되고, 에디터가 참조를 따라갈 수 있다.
// 싣는 순서는 그대로다 — supabase → (compress) → pixel → common → 이 파일.

buildChrome('about');
buildBackdrop('about');   // 배경 픽셀 겹 (common.js)

// 캐릭터 도트 찍기
$$('canvas[data-icon]').forEach(cv => {
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const sp = SPRITES[cv.dataset.icon];
  if (!sp) return;
  const w = sp[0].length, h = sp.length;
  const s = Math.floor(Math.min(cv.width / w, cv.height / h));
  drawSprite(ctx, sp, Math.floor((cv.width - w*s)/2), Math.floor((cv.height - h*s)/2), s);
});

initReveal();
