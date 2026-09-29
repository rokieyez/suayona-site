# 가짜 도트 한 줄(첫 칸 = 48도트로 서 있는 수아·연아, 크기 맞춤용) → 진짜 도트 칸들. 2026-09-29
#   python3 tools/pixelize-row.py <원본.png> <내보낼.png> [색표로 쓸 시트.png | -] [색 수]
# 첫 칸의 키를 48도트로 보고 도트 한 칸 크기를 정한다(가짜 도트는 칸 크기가 고르지 않아 격자 자동 찾기가 안 맞았다).
# 색표 시트를 주면 그 시트의 색으로만 칠한다(수아·연아 앉은 모습이 서 있는 모습과 같은 색이 되게).
# 안 주면(-) 그림에서 k-means 로 색을 뽑는다(객석 손님). 첫 칸은 버리고 나머지를 같은 칸 크기로, 발(맨 아래)을 맞춰 한 줄로 늘어놓는다.
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
palsrc = sys.argv[3] if len(sys.argv) > 3 else '-'
ncol = int(sys.argv[4]) if len(sys.argv) > 4 else 32
TARGET = 48

a = np.array(Image.open(src).convert('RGBA'))
if palsrc != '-':
    s = np.array(Image.open(palsrc).convert('RGBA'))
    PAL = np.unique(s[s[..., 3] > 0][:, :3], axis=0)
else:
    px = a[a[..., 3] > 128][:, :3].astype(float)
    rng = np.random.default_rng(0)
    samp = px[rng.choice(len(px), min(60000, len(px)), replace=False)]
    C = samp[rng.choice(len(samp), ncol, replace=False)]
    for _ in range(30):
        lab = ((samp[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([samp[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(ncol)])
    PAL = C.round().astype(np.uint8)

def runs(mask):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]: j += 1
            out.append((i, j)); i = j
        else: i += 1
    return out

# 1) 칸 크기 — 첫 그림(서 있는 아이)의 키 / 48
col = (a[..., 3] > 128).any(0)
figs = [r for r in runs(col) if r[1] - r[0] > 40]
x0, x1 = figs[0]
ys = np.nonzero((a[:, x0:x1, 3] > 128).any(1))[0]
p = (ys.max() - ys.min() + 1) / TARGET
print('칸', round(p, 2), 'px, 그림', len(figs), '개')

# 2) 격자 시작점 — 경계가 격자선에 가장 많이 붙는 자리(pixelize.py 와 같은 방법)
rgb = a[..., :3].astype(int)
best = []
for axis in (1, 0):
    d = np.abs(np.diff(rgb, axis=axis)).sum(-1) > 60
    prof = d.sum(0) if axis == 1 else d.sum(1)
    pos = np.arange(len(prof)) + 0.5
    sc = [(prof * (np.abs(((pos - o) % p) / p - 0.5) > 0.38)).sum() for o in np.arange(0, p, 0.25)]
    best.append(np.arange(0, p, 0.25)[int(np.argmax(sc))])
ox, oy = best
H, W = a.shape[:2]
nx, ny = int((W - ox) // p), int((H - oy) // p)
g = np.zeros((ny, nx, 4), np.uint8)
P = PAL.astype(float)
for j in range(ny):
    for i in range(nx):
        cx, cy = ox + i * p, oy + j * p
        c = a[int(cy + p * .25):int(cy + p * .75), int(cx + p * .25):int(cx + p * .75)].reshape(-1, 4)
        if len(c) == 0 or (c[:, 3] > 128).mean() < 0.5: continue
        c = c[c[:, 3] > 128][:, :3].astype(float)
        k = ((c[:, None] - P[None]) ** 2).sum(-1).argmin(1)
        g[j, i, :3] = PAL[np.bincount(k, minlength=len(PAL)).argmax()]; g[j, i, 3] = 255

# 3) 그림마다 자르기(빈 세로줄 기준), 첫 칸(크기 맞춤용)은 버린다
fr = [g[:, s:e] for s, e in runs(g[..., 3].any(0)) if e - s > 4][1:]
def bbox(f):
    ys, xs = np.nonzero(f[..., 3]); return ys.min(), ys.max(), xs.min(), xs.max()
CW = max(bbox(f)[3] - bbox(f)[2] + 1 for f in fr) + 2
CH = max(bbox(f)[1] - bbox(f)[0] + 1 for f in fr) + 2
sheet = np.zeros((CH, CW * len(fr), 4), np.uint8)
for n, f in enumerate(fr):
    y0, y1, x0_, x1_ = bbox(f)
    fy, fx = np.nonzero(f[..., 3])
    dx = (CW - (x1_ - x0_ + 1)) // 2 - x0_
    dy = (CH - 1) - y1
    sheet[fy + dy, n * CW + fx + dx] = f[fy, fx]
Image.fromarray(sheet).save(out)
big = Image.fromarray(sheet).resize((sheet.shape[1] * 6, sheet.shape[0] * 6), Image.NEAREST)
bg = Image.new('RGBA', big.size, (104, 150, 86, 255)); bg.alpha_composite(big)
bg.save(out.replace('.png', '-확대6배.png'))
print('칸', CW, 'x', CH, '그림', len(fr), '색', len(np.unique(sheet[sheet[..., 3] > 0][:, :3], axis=0)))
