# 전시실 관객 여덟 명 — 힉스필드 원본(가짜 도트 큰 그림) → 진짜 도트 시트 한 장. 2026-09-29
#   python3 tools/guest-sheet.py   → pages/guests-walk.png (+ ~/Downloads/관객-걷기-스프라이트 에 확대본·걷기 gif)
# 원본: ~/Downloads/관객-걷기-스프라이트/원본/g{0..7}-{S,SW,W,NW,N}.png(서기 1 + 걷기 4), g{n}-clap.png(서기·손 모음·손 벌림)
# 손님 번호는 연주회장 객석(KIDART_GUEST)과 같다: 0 포니테일 1 삐죽 머리 2 할머니 3 땋은 머리 4 모자 5 곱슬 6 아빠 7 만두 머리.
# 시트: 손님마다 여섯 줄(S SW W NW N 손뼉) × 다섯 칸. 칸은 모두 같은 크기, 발은 칸 바닥에서 두 도트 위.
# 오른쪽 셋(NE·E·SE)은 왼쪽을 뒤집어 쓴다 — gallery-room.js 가 뒤집는다. 도트 줄이는 법은 수아 시트의 pixelize.py 와 같다.
import os
import numpy as np
from PIL import Image

SRC = os.path.expanduser('~/Downloads/관객-걷기-스프라이트')
OUT = os.path.join(os.path.dirname(__file__), '..', 'pages', 'guests-walk.png')
DIRS = ['S', 'SW', 'W', 'NW', 'N']
TARGET = [48, 48, 52, 48, 48, 48, 58, 46]   # 서 있는 키(도트) — 원본을 부탁한 키. 방향마다 키가 같아지게 이걸로 칸 크기를 잡는다
NCOL = 26                                   # 손님 한 명의 색 수


def palette(arrs):
    px = np.concatenate([a[a[..., 3] > 128][:, :3] for a in arrs]).astype(float)
    rng = np.random.default_rng(0)
    samp = px[rng.choice(len(px), min(60000, len(px)), replace=False)]
    C = samp[rng.choice(len(samp), NCOL, replace=False)]
    for _ in range(30):
        lab = ((samp[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([samp[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(NCOL)])
    return C.round().astype(np.uint8)


def down(a, target, PAL):
    # 칸 크기 = 첫 칸 키 / target. 격자 시작점만 색 경계에 맞춘다
    col = (a[..., 3] > 128).any(0)
    first = np.nonzero(col)[0]
    gap = np.nonzero(~col[first[0]:])[0][0] + first[0]
    ys = np.nonzero((a[:, :gap, 3] > 128).any(1))[0]
    p = (ys.max() - ys.min() + 1) / target
    rgb = a[..., :3].astype(int)
    best = []
    for axis in (1, 0):
        d = np.abs(np.diff(rgb, axis=axis)).sum(-1) > 60
        prof = d.sum(0) if axis == 1 else d.sum(1)
        pos = np.arange(len(prof)) + 0.5
        offs = np.arange(0, p, 0.25)
        sc = [(prof * (np.abs(((pos - o) % p) / p - 0.5) > 0.38)).sum() for o in offs]
        best.append(offs[int(np.argmax(sc))])
    ox, oy = best
    H, W = a.shape[:2]
    nx, ny = int((W - ox) // p), int((H - oy) // p)
    out = np.zeros((ny, nx, 4), np.uint8)
    P = PAL.astype(float)
    for j in range(ny):
        for i in range(nx):
            x0, y0 = ox + i * p, oy + j * p
            c = a[int(y0 + p * .25):int(y0 + p * .75), int(x0 + p * .25):int(x0 + p * .75)].reshape(-1, 4)
            if not len(c) or (c[:, 3] > 128).mean() < 0.5:
                continue
            c = c[c[:, 3] > 128][:, :3].astype(float)
            k = ((c[:, None] - P[None]) ** 2).sum(-1).argmin(1)
            out[j, i, :3] = PAL[np.bincount(k, minlength=len(PAL)).argmax()]
            out[j, i, 3] = 255
    return out


def split(g, want):
    # 빈 세로줄로 자른다. 작은 부스러기는 버리고, 너무 많으면 가장 큰 want 개(왼쪽부터)
    col = g[..., 3].any(0)
    runs, i = [], 0
    while i < len(col):
        if col[i]:
            j = i
            while j < len(col) and col[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    runs = [r for r in runs if r[1] - r[0] > 6]
    if len(runs) > want:
        runs = sorted(sorted(runs, key=lambda r: r[0] - r[1])[:want])
    assert len(runs) == want, f'프레임 {len(runs)}개(바라는 수 {want})'
    return [g[:, a:b] for a, b in runs]


def bbox(f):
    ys, xs = np.nonzero(f[..., 3])
    return ys.min(), ys.max(), xs.min(), xs.max()


def topcx(f):
    y0, y1, x0, x1 = bbox(f)
    return x0 + np.nonzero(f[y0:y0 + (y1 - y0) // 2, x0:x1 + 1, 3])[1].mean()


rows = []                                   # [손님][줄] = 칸들
for n, T in enumerate(TARGET):
    names = [f'g{n}-{d}' for d in DIRS] + [f'g{n}-clap']
    raws = [np.array(Image.open(f'{SRC}/원본/{k}.png').convert('RGBA')) for k in names]
    PAL = palette(raws)
    g = []
    for k, a in zip(names, raws):
        fr = split(down(a, T, PAL), 3 if k.endswith('clap') else 5)
        g.append(fr)
        print(k, [f.shape[0] for f in fr][:1], 'x', [bbox(f)[3] - bbox(f)[2] + 1 for f in fr])
    rows.append(g)

allf = [f for g in rows for r in g for f in r]
half = max(max(topcx(f) - bbox(f)[2], bbox(f)[3] - topcx(f)) for f in allf)
CW = int(np.ceil(half)) * 2 + 4
CH = max(bbox(f)[1] - bbox(f)[0] + 1 for f in allf) + 4
sheet = np.zeros((CH * 6 * len(rows), CW * 5, 4), np.uint8)
for n, g in enumerate(rows):
    for r, frames in enumerate(g):
        base = max(bbox(f)[1] for f in frames)
        for c, f in enumerate(frames):
            dx = int(round(CW / 2 - topcx(f)))
            dy = (CH - 2) - base
            ys, xs = np.nonzero(f[..., 3])
            sheet[(n * 6 + r) * CH + ys + dy, c * CW + xs + dx] = f[ys, xs]
# 색표 PNG 로 — 손님 여덟 명 색을 다 합쳐도 256 색 안쪽이라 잃는 것 없이 RGBA 의 1/3 크기가 된다. 0번이 투명
cols = np.unique(sheet[sheet[..., 3] > 0][:, :3], axis=0)
assert len(cols) < 256, f'색이 {len(cols)}개 — NCOL 을 줄일 것'
idx = {tuple(c): i + 1 for i, c in enumerate(cols)}
ind = np.zeros(sheet.shape[:2], np.uint8)
for (y, x) in zip(*np.nonzero(sheet[..., 3])):
    ind[y, x] = idx[tuple(sheet[y, x, :3])]
pim = Image.fromarray(ind, 'P')
pim.putpalette([0, 0, 0] + [int(v) for c in cols for v in c])
pim.save(OUT, optimize=True, transparency=0)
print('칸', CW, 'x', CH, '시트', sheet.shape[1], 'x', sheet.shape[0], '→', os.path.getsize(OUT), 'bytes')

# 확인용 — 4배 확대 + 풀밭 바탕, 걷는 gif(손님 × 다섯 방향)
S = 4
big = Image.fromarray(sheet).resize((sheet.shape[1] * S, sheet.shape[0] * S), Image.NEAREST)
bg = Image.new('RGBA', big.size, (104, 150, 86, 255))
bg.alpha_composite(big)
bg.save(f'{SRC}/guests-walk-확대4배.png')
gif = []
for t in [1, 2, 3, 4]:
    fr = Image.new('RGBA', (CW * 5 * S, CH * len(rows) * S), (104, 150, 86, 255))
    for n in range(len(rows)):
        for r in range(5):
            y = (n * 6 + r) * CH
            cell = Image.fromarray(sheet[y:y + CH, t * CW:(t + 1) * CW]).resize((CW * S, CH * S), Image.NEAREST)
            fr.alpha_composite(cell, (r * CW * S, n * CH * S))
    gif.append(fr.convert('RGB'))
gif[0].save(f'{SRC}/guests-걷기.gif', save_all=True, append_images=gif[1:], duration=150, loop=0)
