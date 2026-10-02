# 가게 아저씨·행상인 — 힉스필드 원본 → 문자열 도트(farm.js 의 SHOPKEEP·PEDKEEP). 2026-10-02 로키즈 「관객들 캐릭터처럼 다시 그릴 것」
#   python3 tools/shopkeep-art.py   → pages/farm.js 의 // <shopkeep> … // </shopkeep> 토막을 다시 쓴다
# 원본: ~/Downloads/관객-걷기-스프라이트/원본/{shopkeep,peddler}-X.png (SW 를 보는 세 칸: 서기·눈웃음·손 흔들기,
#   힉스필드 d7269aa9 · 34f94b9d).
# 줄이는 법은 관객 시트(guest-sheet.py)와 같다. 지금은 첫 칸(서기)만 쓴다.
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
    a = np.array(Image.open(f'{gs.SRC}/원본/{name}-X.png').convert('RGBA'))
    f = gs.split(gs.down(a, TALL, gs.palette([a])), 3)[0]
    y0, y1, x0, x1 = gs.bbox(f)
    f = f[y0:y1 + 1, x0:x1 + 1]
    cols = [tuple(c) for c in np.unique(f[f[..., 3] > 0][:, :3], axis=0)]
    key = {c: KEYS[i] for i, c in enumerate(cols)}
    rows = [''.join(key[tuple(px[:3])] if px[3] else '.' for px in r) for r in f]
    print(name, f.shape[1], 'x', f.shape[0], '색', len(cols))
    return rows, {key[c]: '#%02x%02x%02x' % c for c in cols}


out = []
for name, var, pvar in [('shopkeep', 'SHOPKEEP', 'SHOPPAL'), ('peddler', 'PEDKEEP', 'PEDPAL')]:
    rows, pal = one(name)
    out += [f'const {var} = {json.dumps(rows)};', f'const {pvar} = {json.dumps(pal)};']

block = '// <shopkeep>\n' + '\n'.join(out) + '\n// </shopkeep>'
P = os.path.join(HERE, '..', 'pages', 'farm.js')
s = open(P, encoding='utf-8').read()
i, j = s.index('// <shopkeep>'), s.index('// </shopkeep>') + len('// </shopkeep>')
open(P, 'w', encoding='utf-8').write(s[:i] + block + s[j:])
