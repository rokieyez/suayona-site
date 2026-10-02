# 가게 아저씨·행상인 — 힉스필드 원본 → 문자열 도트(farm.js 의 SHOPKEEP·PEDKEEP). 2026-10-02 로키즈 「관객들 캐릭터처럼 다시 그릴 것」
#   python3 tools/shopkeep-art.py   → pages/farm.js 의 // <shopkeep> … // </shopkeep> 토막을 다시 쓴다
# 원본: ~/Downloads/관객-걷기-스프라이트/원본/{shopkeep,peddler}-X.png (SW 를 보는 세 칸: 서기·눈웃음·손 흔들기,
#   힉스필드 d7269aa9 · 34f94b9d).
# 줄이는 법은 관객 시트(guest-sheet.py)와 같다. 세 칸 모두 쓴다 — 제자리에서 서성이다 가끔 웃고 손을 흔든다(farm.js npcIdle).
import importlib.util
import json
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('gs', os.path.join(HERE, 'guest-sheet.py'))
gs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gs)

TALL = 56
KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'


def one(name):
    # 세 칸(서기·눈웃음·손 흔들기)을 같은 크기로 — 발은 맨 아래 줄, 머리 한가운데는 가운데 칸에. 그래야 칸을 바꾸거나 뒤집어도 제자리
    a = np.array(Image.open(f'{gs.SRC}/원본/{name}-X.png').convert('RGBA'))
    fr = gs.split(gs.down(a, TALL, gs.palette([a])), 3)
    top = min(gs.bbox(f)[0] for f in fr)
    bot = max(gs.bbox(f)[1] for f in fr)
    cx = [int(round(gs.topcx(f))) for f in fr]
    half = max(max(cx[i] - gs.bbox(f)[2], gs.bbox(f)[3] - cx[i]) for i, f in enumerate(fr))
    fr = [np.pad(f, ((0, 0), (half, half + 1), (0, 0)))[top:bot + 1, cx[i]:cx[i] + 2 * half + 1] for i, f in enumerate(fr)]
    allpx = np.concatenate([f[f[..., 3] > 0][:, :3] for f in fr])
    cols = [tuple(c) for c in np.unique(allpx, axis=0)]
    key = {c: KEYS[i] for i, c in enumerate(cols)}
    rows = [[''.join(key[tuple(px[:3])] if px[3] else '.' for px in r) for r in f] for f in fr]
    print(name, fr[0].shape[1], 'x', fr[0].shape[0], '색', len(cols))
    return rows, {key[c]: '#%02x%02x%02x' % c for c in cols}


out = []
for name, var, pvar in [('shopkeep', 'SHOPKEEP', 'SHOPPAL'), ('peddler', 'PEDKEEP', 'PEDPAL')]:
    rows, pal = one(name)
    out += [f'const {var} = {json.dumps(rows)};   // [서기, 눈웃음, 손 흔들기]', f'const {pvar} = {json.dumps(pal)};']

block = '// <shopkeep>\n' + '\n'.join(out) + '\n// </shopkeep>'
P = os.path.join(HERE, '..', 'pages', 'farm.js')
s = open(P, encoding='utf-8').read()
i, j = s.index('// <shopkeep>'), s.index('// </shopkeep>') + len('// </shopkeep>')
open(P, 'w', encoding='utf-8').write(s[:i] + block + s[j:])
