#!/usr/bin/env python3
"""핫도그 패거리 → 셋이 다 보이게 나란히 세운 원본 그림(tools/hotdog-src.png).

사진에서는 셋이 겹쳐 서서 가운데·오른쪽 친구 몸이 가려지고 칸 틀에 잘렸다.
셋은 생김새가 같으니(로키즈 10-04) 친구마다 몸 타원을 보이는 테두리에 맞춰 찾고,
  - 얼굴·케첩은 연아 선 그대로 떼어 오고
  - 가려진 몸 테두리는 맞춘 타원으로 이어 그리고
  - 팔·다리는 다 보이는 맨 앞 친구(쌔빨강) 것을 본떠 붙인다.
케첩(몸 가운데 꼬불꼬불 선)은 빨강으로 칠해 두고, friends-art 의 redink: 로 빨간 선이 된다.
쓰는 법: python3 tools/friends-hotdog.py   (friends-build.py 가 굽기 전에 부른다)
"""
import os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

SRC = os.path.expanduser("~/Desktop/연아 프렌즈 사진/KakaoTalk_Photo_2026-10-04-17-22-06 002.jpeg")
OUT = os.path.join(os.path.dirname(__file__), "hotdog-src.png")
X0, Y0, X1, Y1 = 2190, 1430, 2562, 1790        # 사진에서 떼어 볼 자리
# 친구마다 몸 타원 어림(사진 좌표 cx, cy, rx, ry)과 케첩 자리(x0, y0, x1, y1)
FIG = {
    "red":     dict(e=(2283, 1620, 54, 88), ketchup=(2255, 1625, 2305, 1695)),   # 쌔빨강 — 맨 앞, 다 보임
    "mustard": dict(e=(2380, 1543, 53, 80), ketchup=(2335, 1523, 2415, 1600)),   # 쌔겨자 — 가운데, 아래가 가려짐
    "steel":   dict(e=(2487, 1646, 43, 76), fix=True, ketchup=(2478, 1641, 2518, 1695)),   # 박철탑 — 오른쪽, 칸 틀에 잘림
}
PEN = 3                                           # 이어 그리는 테두리 굵기(사진 픽셀)


def ink_of(img):
    a = np.asarray(img).astype(int)
    hi, lo = a.max(2), a.min(2)
    return (hi < 125) & (hi - lo < 70)


def ell(shape, e, grow=0):
    cx, cy, rx, ry = e
    yy, xx = np.ogrid[:shape[0], :shape[1]]
    return ((xx - cx) / (rx + grow)) ** 2 + ((yy - cy) / (ry + grow)) ** 2 <= 1


def fit(ink, e):
    """어림 타원 둘레 띠 안의 선 점에 축 나란한 타원을 맞춘다: A x² + C y² + D x + E y = 1."""
    band = ell(ink.shape, e, 7) & ~ell(ink.shape, e, -9) & ink
    ys, xs = np.nonzero(band)
    M = np.c_[xs ** 2, ys ** 2, xs, ys].astype(float)
    A, C, D, E = np.linalg.lstsq(M, np.ones(len(xs)), rcond=None)[0]
    cx, cy = -D / (2 * A), -E / (2 * C)
    k = 1 + A * cx * cx + C * cy * cy
    return cx, cy, np.sqrt(k / A), np.sqrt(k / C)


def stamp(canvas, pc, x, y):
    """pc 를 canvas 의 (x, y) 에 겹쳐 찍는다 — 밖으로 나간 데는 버린다."""
    H, W = canvas.shape
    h, w = pc.shape
    sx0, sy0 = max(-x, 0), max(-y, 0)
    ex, ey = min(w, W - x), min(h, H - y)
    if ex > sx0 and ey > sy0:
        canvas[y + sy0:y + ey, x + sx0:x + ex] |= pc[sy0:ey, sx0:ex]


def main():
    img = Image.open(SRC).convert("RGB").crop((X0, Y0, X1, Y1))
    ink = ink_of(img)
    sh = ink.shape
    loc = lambda e: (e[0] - X0, e[1] - Y0, e[2], e[3])
    for f in FIG.values():
        f["e"] = loc(f["e"]) if f.get("fix") else fit(ink, loc(f["e"]))   # 박철탑은 테두리가 반쯤 가려 맞추기가 빗나간다 — 어림 그대로
        f["k"] = tuple(v - o for v, o in zip(f["ketchup"], (X0, Y0, X0, Y0)))
    red, mus, stl = FIG["red"]["e"], FIG["mustard"]["e"], FIG["steel"]["e"]

    # 쌔빨강의 왼팔·왼다리를 본으로 떼어 둔다(오른쪽은 뒤집어 쓴다)
    body_r = ell(sh, red, 2)
    arm = ink.copy(); arm[:, int(red[0] - red[2]) + 1:] = False; arm &= ~body_r
    ys, xs = np.nonzero(arm[int(red[1] - 20):int(red[1] + 60)]); ay0 = int(red[1] - 20)
    arm_box = (xs.min(), ys.min() + ay0, xs.max() + 1, ys.max() + ay0 + 1)
    arm_pc = arm[arm_box[1]:arm_box[3], arm_box[0]:arm_box[2]]
    legs = ink.copy(); legs[:int(red[1] + red[3] * .8)] = False; legs[1762 - Y0:] = False; legs &= ~body_r   # 1762 아래는 칸 바닥 선
    legs[:, :int(red[0] - red[2] - 10)] = False; legs[:, int(red[0]):] = False   # 오른다리는 가운데 친구 다리와 엉켜 있어 왼다리를 뒤집어 쓴다
    lab, n = nd.label(legs); size = nd.sum(legs, lab, range(1, n + 1))
    sl = nd.find_objects(lab)
    keep = [i + 1 for i, (a, b) in enumerate(sl) if size[i] >= 40 and not (a.stop - a.start < 10 and b.stop - b.start > 40)]
    legs = np.isin(lab, keep)                                     # 바닥 칸 선·부스러기는 버림
    ys, xs = np.nonzero(legs)
    leg_box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    leg_pc = legs[leg_box[1]:leg_box[3], leg_box[0]:leg_box[2]]
    leg_dx = leg_box[0] - red[0]                                  # 몸 가운데에서 다리 왼쪽까지
    leg_dy = leg_box[1] - (red[1] + red[3])                       # 몸 아래 끝에서 다리 위까지
    arm_dy = arm_box[1] - red[1]                                  # 몸 가운데에서 팔 위까지

    # 친구마다 얼굴·몸 선만 떼어 낸다(다른 친구 몸·칸 틀은 빼고)
    parts = {}
    for name, f in FIG.items():
        e = f["e"]
        m = ink & ell(sh, e, 3)
        if name == "mustard":
            m &= ~ell(sh, red, 4)                                 # 앞 친구 몸이 가린 자리
            m[1590 - Y0:1632 - Y0, 2320 - X0:2372 - X0] = False   # 앞 친구 오른손
        if name == "steel":
            m[:, 2524 - X0:] = False                              # 오른쪽 칸 틀
            m &= ~ell(sh, mus, 4)
            m[:int(e[1] - e[3] - 3)] = False                      # 위에 쓴 이름 글씨
            m[1515 - Y0:1600 - Y0, 2436 - X0:2462 - X0] = False   # 가운데 친구 오른팔
            m[1690 - Y0:, :2462 - X0] = False                     # 왼쪽 아래 손 부스러기
        lab, n = nd.label(m); size = nd.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, 1 + np.flatnonzero(size >= 6))
        kx0, ky0, kx1, ky1 = f["k"]
        ket = np.zeros_like(m); ket[ky0:ky1, kx0:kx1] = True
        # 케첩: 케첩 자리 안의 선(몸 테두리는 빼고)
        k = m & ket & ell(sh, e, -6)
        # 가려진 테두리: 맞춘 타원 둘레 중 가까이에 선이 없는 곳만 이어 그린다
        ring = ell(sh, e, PEN / 2) & ~ell(sh, e, -PEN / 2)
        near = nd.binary_dilation(m, iterations=7 if f.get("fix") else 3)   # 맞춘 타원은 선에 딱 붙으니 끊긴 틈까지 메운다
        lab_r, _ = nd.label(ring & ~near)
        m |= ring & ~near & (lab_r > 0)
        parts[name] = (e, m & ~k, k)

    # 나란히 세운다: 친구마다 [왼팔][몸][오른팔], 아래에 다리
    pad, gap = 14, 6
    W = sum(2 * e[2] + 2 * arm_pc.shape[1] for e, _, _ in parts.values()) + gap * 2 + pad * 2
    H = int(max(2 * e[3] for e, _, _ in parts.values()) + leg_pc.shape[0] + leg_dy + pad * 2 + 4)
    W = int(W) + 40
    canvas = np.zeros((H, W), bool); ketch = np.zeros((H, W), bool)
    x = pad
    base = H - pad - leg_pc.shape[0] - leg_dy                     # 몸 아래 끝을 같은 줄에
    for name in ("red", "mustard", "steel"):
        e, m, k = parts[name]
        cx, cy, rx, ry = e
        ox = int(round(x + arm_pc.shape[1] + rx - cx)); oy = int(round(base - (cy + ry)))
        ys, xs = np.nonzero(m); ok = (ys + oy >= 0) & (ys + oy < H) & (xs + ox >= 0) & (xs + ox < W)
        canvas[ys[ok] + oy, xs[ok] + ox] = True
        ys, xs = np.nonzero(k); ok = (ys + oy >= 0) & (ys + oy < H) & (xs + ox >= 0) & (xs + ox < W)
        ketch[ys[ok] + oy, xs[ok] + ox] = True
        ncx, ncy = cx + ox, cy + oy
        # 팔: 팔 높이에서 몸 가장자리에 붙인다(왼팔 그대로, 오른팔은 뒤집어)
        ay = int(round(ncy + arm_dy * ry / red[3]))
        mid = ay + arm_pc.shape[0] / 2
        half = rx * np.sqrt(max(1 - ((mid - ncy) / ry) ** 2, 0))
        lx = int(round(ncx - half - arm_pc.shape[1] + 3)); rx_ = int(round(ncx + half - 3))
        stamp(canvas, arm_pc, lx, ay)
        stamp(canvas, arm_pc[:, ::-1], rx_, ay)
        # 다리
        lx = int(round(ncx + leg_dx * rx / red[2])); ly = int(round(ncy + ry + leg_dy))
        stamp(canvas, leg_pc, lx, ly)
        stamp(canvas, leg_pc[:, ::-1], int(round(2 * ncx - lx - leg_pc.shape[1])), ly)
        x += 2 * rx + 2 * arm_pc.shape[1] + gap

    out = np.full((H, W, 3), 255, np.uint8)
    out[canvas] = (20, 20, 20)
    out[ketch] = (230, 30, 30)
    Image.fromarray(out).save(OUT)
    print(OUT, W, H)


if __name__ == "__main__":
    main()
