# 스테이지2 농장 동물 여덟 방향 그림(Higgsfield gpt_image_2_5, 2026-10-09) → pages/beasts.webp 한 장
# 원본 시트: 동물마다 2688x1520 투명 PNG 한 장, 4칸×2줄 — 1줄 S·SW·W·NW, 2줄 N·NE·E·SE.
#   원본은 저장소에 넣지 않는다(장당 4~5 MB). Higgsfield job 번호로 다시 받는다:
#   cow b420cb40 · chicken 5f91c5e5 · duck 79048fe2 · sheep 18eb6beb · pig 2eee0cd5 · rabbit 728a6dac
#   dog b967d23c · cat 59e30355 · gull 3680b467 · goat 0b01e001 · crane b56d162f · reindeer 666d7ce2
#   camel 575a08ce
#   (2026-10-09 단풍·밀림·사바나) deer 2a068142 · squirrel 1fbbbe68 · monkey 6f8c7ab5 · parrot 679856fc · giraffe 6bd8886c · elephant 80375e46 · zebra 4be289b6
# 결과: 줄 = 동물(KINDS 차례), 칸 = 방향(DIRS 차례). 모든 칸이 같은 크기 CW×CH, 발끝이 같은 줄(FOOT), 몸 가운데가 칸 가운데.
# 동물마다 여덟 칸 가운데 가장 큰 키를 TALL 로 맞춘다(한 시트 안에서는 축척이 같아서 방향끼리 크기가 그대로 간다).
# 결과 칸 정보는 마지막 줄 JSON — pages/farm-hd-life.js 의 BEAST_ATLAS 에 옮긴다.
#   /opt/homebrew/bin/python3 tools/beast-atlas.py <원본 시트 폴더>
# 동물 하나만 맨 아래 줄에 덧붙이기(다른 원본 없이, 칸 크기는 그대로 — 넓으면 줄인다):
#   /opt/homebrew/bin/python3 tools/beast-atlas.py --append <kind> <시트.png>
import json, os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pages', 'beasts.webp')
KINDS = ['cow', 'chicken', 'duck', 'sheep', 'pig', 'rabbit', 'dog', 'cat', 'gull', 'goat', 'crane', 'reindeer', 'camel',
         'deer', 'squirrel', 'monkey', 'parrot', 'giraffe', 'elephant', 'zebra']
DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
TALL = 128      # 동물마다 가장 큰 칸의 키(px)
PAD = 4

def despeck(a):
    # 칸 가장자리에 남은 작은 티끌(옆 칸 그림 조각)을 지운다 — 가장 큰 덩어리의 2% 보다 작은 덩어리는 버린다(2026-10-09)
    k = 4
    m = a[..., 3] > 0
    h, w = m.shape
    small = m[:h - h % k, :w - w % k].reshape(h // k, k, w // k, k).any(axis=(1, 3))
    lab = np.zeros(small.shape, np.int32); n = 0; sizes = [0]
    for y0, x0 in zip(*np.nonzero(small)):
        if lab[y0, x0]: continue
        n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0
        while st:
            y, x = st.pop(); c += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < small.shape[0] and 0 <= xx < small.shape[1] and small[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; st.append((yy, xx))
        sizes.append(c)
    if n <= 1: return a
    keep = np.array([s >= max(sizes) * 0.02 for s in sizes]); keep[0] = False
    big = np.zeros((h, w), bool)
    big[:h - h % k, :w - w % k] = np.repeat(np.repeat(keep[lab], k, 0), k, 1)
    a = a.copy(); a[..., 3] = np.where(big, a[..., 3], 0)
    return a

def cells(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    out = []
    for i in range(8):
        r, c = divmod(i, 4)
        cell = im.crop((c * W // 4, r * H // 2, (c + 1) * W // 4, (r + 1) * H // 2))
        a = np.array(cell)
        a[..., 3] = np.where(a[..., 3] >= 24, a[..., 3], 0)   # 바탕에 남은 옅은 알파 티끌을 걷는다
        cell = Image.fromarray(despeck(a))
        out.append(cell.crop(cell.getbbox()))
    return out

def main(src):
    sheets = {k: cells(os.path.join(src, k + '.png')) for k in KINDS}
    scaled = {}
    for k, cs in sheets.items():
        s = TALL / max(c.height for c in cs)
        scaled[k] = [c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS) for c in cs]
    CW = max(c.width for cs in scaled.values() for c in cs) + PAD * 2
    CH = TALL + PAD * 2
    FOOT = CH - PAD
    atlas = Image.new('RGBA', (CW * 8, CH * len(KINDS)), (0, 0, 0, 0))
    for y, k in enumerate(KINDS):
        for x, c in enumerate(scaled[k]):
            atlas.alpha_composite(c, (x * CW + (CW - c.width) // 2, y * CH + FOOT - c.height))
    atlas.save(OUT, quality=84, method=6)   # webp — PNG 는 2 MB 넘게 나온다
    print(json.dumps({'cw': CW, 'ch': CH, 'foot': FOOT, 'tall': TALL, 'kinds': KINDS, 'dirs': DIRS}))

def append(kind, path):
    old = Image.open(OUT).convert('RGBA')
    # 덧붙일 동물은 KINDS 차례대로 — 지금 그림의 줄 수가 그 동물의 차례와 같아야 한다
    CW, CH = old.width // 8, old.height // KINDS.index(kind)
    FOOT = CH - PAD
    cs = cells(path)
    s = min(TALL / max(c.height for c in cs), (CW - PAD * 2) / max(c.width for c in cs))
    cs = [c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS) for c in cs]
    atlas = Image.new('RGBA', (old.width, old.height + CH), (0, 0, 0, 0))
    atlas.alpha_composite(old, (0, 0))
    y = old.height // CH
    for x, c in enumerate(cs):
        atlas.alpha_composite(c, (x * CW + (CW - c.width) // 2, y * CH + FOOT - c.height))
    atlas.save(OUT, quality=84, method=6)
    print(json.dumps({'cw': CW, 'ch': CH, 'foot': FOOT, 'tall': TALL, 'kinds': KINDS[:y] + [kind], 'dirs': DIRS}))

if __name__ == '__main__':
    if sys.argv[1] == '--append': append(sys.argv[2], sys.argv[3])
    else: main(sys.argv[1])
