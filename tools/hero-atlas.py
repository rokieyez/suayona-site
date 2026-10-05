# 수아·연아 히어로 걷기 그림(Eagle 원본, 읽기만) → pages/hero-sua.png · pages/hero-yona.png
# 원본: 「수아 48도트 걷기 원본 앞(S)/앞옆(SW)/옆(W)/뒤옆(NW)/뒤(N).png」 — 2688x1152 한 장에 한 줄 5칸(서기 + 걷기 4칸).
# 시트: 줄 = S·SW·W·NW·N, 칸 = 서기·걷기1~4. 모든 칸이 같은 크기, 발끝이 같은 줄(footY), 윗몸 가운데가 같은 열(cx).
# 방향마다 「서기 칸 키 = TARGET」 으로 맞춘다(원본마다 축척이 조금씩 달라서). 결과 칸 정보는 마지막 줄에 JSON 으로 찍는다 —
# pages/hero-walk.js 의 ATLAS 상수에 그대로 옮긴다.
#   python3 tools/hero-atlas.py
import glob, json, os, sys
import numpy as np
from PIL import Image

LIB = '/Users/mac/Desktop/Library/Library.library/images'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pages')
DIRS = [('S', '앞(S)'), ('SW', '앞옆(SW)'), ('W', '옆(W)'), ('NW', '뒤옆(NW)'), ('N', '뒤(N)')]
KIDS = [('sua', '수아'), ('yona', '연아')]
TARGET = 220        # 서기 칸의 키(px)
PAD = 3             # 칸 둘레 여백

def src(name, tag):
    hits = [p for p in glob.glob(f'{LIB}/*/{name} 48도트 걷기 원본 {tag}.png')]
    assert len(hits) == 1, (name, tag, hits)
    im = Image.open(hits[0])
    return im.convert('RGBA')          # 연아 몇 장은 P(팔레트+투명 색) — RGBA 로 풀어야 투명이 산다

def frames(im):
    a = np.array(im)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)   # 원본 알파는 0 아니면 250 언저리 — 딱 갈라 둔다
    col = (a[..., 3] > 0).any(0)
    runs, i = [], 0
    while i < len(col):
        if col[i]:
            j = i
            while j < len(col) and col[j]: j += 1
            runs.append([i, j]); i = j
        else: i += 1
    merged = []                          # 머리카락 끝 같은 작은 틈은 붙인다
    for r in runs:
        if merged and r[0] - merged[-1][1] < 12: merged[-1][1] = r[1]
        else: merged.append(r)
    merged = [r for r in merged if r[1] - r[0] > 40]
    assert len(merged) == 5, f'칸 {len(merged)}개'
    out = []
    for x0, x1 in merged:
        f = a[:, x0:x1]
        ys = np.nonzero((f[..., 3] > 0).any(1))[0]
        out.append(Image.fromarray(f[ys.min():ys.max() + 1]))
    return out

def place(f):
    """줄인 칸의 발끝(맨 아래 불투명 줄)과 윗몸 가운데(위 55% 의 알파 무게중심)"""
    a = np.array(f)[..., 3].astype(float)
    ys = np.nonzero((a > 0).any(1))[0]
    bot = ys.max()
    top = a[: int(ys.min() + (bot - ys.min()) * 0.55)]
    cx = (top.sum(0) * np.arange(a.shape[1])).sum() / max(1, top.sum())
    return bot, cx

for key, name in KIDS:
    rows = []
    for d, tag in DIRS:
        fs = frames(src(name, tag))
        s = TARGET / fs[0].height
        row = []
        for f in fs:
            w, h = max(1, round(f.width * s)), max(1, round(f.height * s))
            g = f.resize((w, h), Image.LANCZOS)          # RGBA 는 Pillow 가 알파를 곱해 줄인다(가장자리 검은 테 없음)
            a = np.array(g)
            al = a[..., 3].astype(float)
            a[..., 3] = np.clip((al - 30) * 255 / 195, 0, 255).astype(np.uint8)   # 흐린 테는 걷고 안쪽은 꽉 채운다
            row.append(Image.fromarray(a))
        rows.append(row)
    info = [[place(f) for f in row] for row in rows]
    up = int(max(b + 1 for r in info for b, _ in r))                    # 발끝 위로 가장 큰 높이
    left = max(cx for r in info for _, cx in r)
    right = max(f.width - cx for row, r in zip(rows, info) for f, (_, cx) in zip(row, r))
    half = int(np.ceil(max(left, right))) + PAD
    CW, CH = half * 2, up + PAD * 2
    foot = PAD + up
    sheet = Image.new('RGBA', (CW * 5, CH * len(DIRS)), (0, 0, 0, 0))
    for ri, (row, r) in enumerate(zip(rows, info)):
        for ci, (f, (bot, cx)) in enumerate(zip(row, r)):
            sheet.alpha_composite(f, (int(round(ci * CW + half - cx)), int(ri * CH + foot - (bot + 1))))
    path = os.path.join(OUT, f'hero-{key}.png')
    sheet.save(path, optimize=True)
    if os.path.getsize(path) > 400_000:                             # 너무 크면 256색(알파 포함)으로
        sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    print(key, f'{sheet.width}x{sheet.height}', f'{os.path.getsize(path) // 1024}KB', file=sys.stderr)
    print(json.dumps({key: {'w': CW, 'h': CH, 'foot': foot, 'cx': half, 'tall': TARGET}}))
