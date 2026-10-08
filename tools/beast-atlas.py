# 스테이지2 농장 동물 여덟 방향 그림(Higgsfield gpt_image_2_5, 2026-10-09) → pages/beasts.webp 한 장
# 원본 시트: 동물마다 2688x1520 투명 PNG 한 장, 4칸×2줄 — 1줄 S·SW·W·NW, 2줄 N·NE·E·SE.
#   원본은 저장소에 넣지 않는다(장당 4~5 MB). Higgsfield job 번호로 다시 받는다:
#   cow b420cb40 · chicken 5f91c5e5 · duck 79048fe2 · sheep 18eb6beb · pig 2eee0cd5 · rabbit 728a6dac
#   dog b967d23c · cat 59e30355 · gull 3680b467 · goat 0b01e001 · crane b56d162f · reindeer 666d7ce2
# 결과: 줄 = 동물(KINDS 차례), 칸 = 방향(DIRS 차례). 모든 칸이 같은 크기 CW×CH, 발끝이 같은 줄(FOOT), 몸 가운데가 칸 가운데.
# 동물마다 여덟 칸 가운데 가장 큰 키를 TALL 로 맞춘다(한 시트 안에서는 축척이 같아서 방향끼리 크기가 그대로 간다).
# 결과 칸 정보는 마지막 줄 JSON — pages/farm-hd-life.js 의 BEAST_ATLAS 에 옮긴다.
#   /opt/homebrew/bin/python3 tools/beast-atlas.py <원본 시트 폴더>
import json, os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pages', 'beasts.webp')
KINDS = ['cow', 'chicken', 'duck', 'sheep', 'pig', 'rabbit', 'dog', 'cat', 'gull', 'goat', 'crane', 'reindeer']
DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
TALL = 128      # 동물마다 가장 큰 칸의 키(px)
PAD = 4

def cells(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    out = []
    for i in range(8):
        r, c = divmod(i, 4)
        cell = im.crop((c * W // 4, r * H // 2, (c + 1) * W // 4, (r + 1) * H // 2))
        a = np.array(cell)
        a[..., 3] = np.where(a[..., 3] >= 24, a[..., 3], 0)   # 바탕에 남은 옅은 알파 티끌을 걷는다
        cell = Image.fromarray(a)
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

if __name__ == '__main__':
    main(sys.argv[1])
