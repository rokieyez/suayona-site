#!/usr/bin/env python3
"""연아 프렌즈 그림 → 색칠한 SVG.

연아가 펜으로 그린 사진에서 캐릭터 하나를 오려
  1) 검은 펜 선만 골라(색 테두리·종이 얼룩은 버림) 4배로 키워 매끈하게 다듬고
  2) 선으로 닫힌 칸을 찾아 색을 채운 뒤
  3) potrace 로 선·색 칸을 모두 벡터로 따서 SVG 한 장으로 만든다.
선 모양은 연아 그림 그대로다 — 굽은 곳을 부드럽게 펴고 빈틈을 메울 뿐 새로 그리지 않는다.

쓰는 법: python3 tools/friends-art.py <사진> <이름> x0 y0 x1 y1 <바탕색> [x,y=색 ...] > 결과.svg
  좌표는 사진 픽셀. x,y=색 은 오린 칸 안의 한 점(0~1 비율)을 찍어 그 칸만 다른 색으로 칠한다.
  바탕색 none 이면 칠하지 않는다.
"""
import subprocess, sys, tempfile, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

UP = 4          # 키우는 배수 — 선이 매끈해지는 만큼 파일도 커진다
INK = "#2b211c"


def ink_mask(img):
    a = np.asarray(img.convert("RGB")).astype(int)
    hi, lo = a.max(2), a.min(2)
    # 검은 펜: 어둡고 색이 거의 없다. 분홍·하늘색 테두리는 채도가 높아 빠진다.
    m = (hi < 125) & (hi - lo < 70)
    lab, n = nd.label(m)
    if not n:
        return m
    size = nd.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = size >= 12                        # 점 같은 얼룩은 버림
    edge = np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    big = size.max()
    for e in edge:                               # 칸 테두리에 닿은 선(옆 칸·네모 틀)은 버림 — 몸통이 닿은 경우는 남김
        if e and size[e - 1] < big * .6:
            keep[e] = False
    return keep[lab]


def smooth(mask):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS).filter(ImageFilter.GaussianBlur(UP * .7))
    return np.asarray(im) > 100


def trace(mask, color):
    with tempfile.TemporaryDirectory() as d:
        pbm = os.path.join(d, "a.pbm")
        Image.fromarray(((~mask) * 255).astype(np.uint8)).convert("1").save(pbm)
        out = subprocess.run(["potrace", pbm, "-s", "-o", "-", "-t", "8", "-a", "1.15", "-O", "0.6", "-C", color],
                             capture_output=True, text=True, check=True).stdout
    g = out[out.index("<g"):out.rindex("</g>") + 4]
    return g


def tone(c, k):
    """k<0 이면 어둡게(같은 색 ×(1+k)), k>0 이면 흰색 쪽으로 섞는다."""
    r, g, b = (int(c[i:i + 2], 16) for i in (1, 3, 5))
    f = (lambda v: v * (1 + k)) if k < 0 else (lambda v: v + (255 - v) * k)
    return "#%02x%02x%02x" % tuple(round(f(v)) for v in (r, g, b))


def shift(m, dx, dy):
    """out[y,x] = m[y+dy, x+dx] — 밖은 False."""
    out = np.zeros_like(m)
    h, w = m.shape
    out[max(-dy, 0):h - max(dy, 0), max(-dx, 0):w - max(dx, 0)] = m[max(dy, 0):h - max(-dy, 0), max(dx, 0):w - max(-dx, 0)]
    return out


def shade(m, c):
    """평평함을 덜게 칸마다 오른쪽 아래 그늘(−12%)·왼쪽 위 밝은 띠를 얹는다."""
    area = m.sum()
    if area < (UP * 10) ** 2:
        return [(m, c)]
    d = int(np.clip(np.sqrt(area) * .1, UP * 2, UP * 12))
    out = [(m, c), (m & ~shift(m, d, d), tone(c, -.12))]
    if area > (UP * 25) ** 2:
        a = max(d // 2, UP)
        out.append((m & shift(m, -a, -a) & ~shift(m, -a - a * 2 // 3, -a - a * 2 // 3) & shift(m, d, d), tone(c, .4)))
    return out


def main():
    path, name, x0, y0, x1, y1, base, *picks = sys.argv[1:]
    img = Image.open(path).crop(tuple(int(v) for v in (x0, y0, x1, y1)))
    raw = ink_mask(img)
    for e in [p for p in picks if p.startswith("erase:")]:  # 그림 안에 쓴 이름 글씨는 지운다(오린 칸 기준 픽셀)
        ex0, ey0, ex1, ey1 = (int(v) for v in e[6:].split(","))
        raw[ey0:ey1, ex0:ex1] = False
    picks = [p for p in picks if not p.startswith("erase:")]
    ink = smooth(raw)
    h, w = ink.shape
    st = nd.generate_binary_structure(2, 1)

    # 몸통 = 바깥 선 안쪽 전부. 아이 그림은 선 끝이 벌어져 있어서, 선을 굵혔다 되돌려(닫기) 틈을 메운 뒤 속을 채운다.
    # 틈이 크면 덜 메워져 몸통이 빈다 — 반지름을 늘려 가며 채워지는 넓이가 확 늘어나는(틈이 닫히는) 곳을 고른다.
    def body(r):
        k = np.ones((2 * r + 1, 2 * r + 1), bool)
        yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
        k = xx * xx + yy * yy <= r * r
        pad = r + 2
        m = np.pad(ink, pad)
        return nd.binary_fill_holes(nd.binary_closing(m, k))[pad:-pad, pad:-pad] | ink
    force = [int(p[6:]) for p in picks if p.startswith("close:")]  # 틈이 아주 크면 반지름을 직접 준다
    picks = [p for p in picks if not p.startswith("close:")]
    tries = [body(UP * k) for k in (force or (2, 4, 7, 11))]
    inside = tries[0]
    for i in range(1, len(tries)):
        if tries[i].sum() > tries[i - 1].sum() * 1.3:
            inside = tries[i]
    # 찍은 칸을 찾을 칸 나누기 — 선을 조금 굵혀 작은 틈은 막는다
    R = UP * 2
    lab, _ = nd.label(~nd.binary_dilation(ink, st, iterations=R) & inside)
    layers = []
    if base != "none":
        layers.append((inside, base))
    holes = np.zeros_like(ink)
    for p in picks:                              # 찍은 칸만 다른 색(none 이면 구멍)
        xy, col = p.split("=")
        fx, fy = (float(v) for v in xy.split(","))
        py, px = int(fy * h), int(fx * w)
        l = lab[py, px]
        if not l:                                # 선 위를 찍었으면 둘레 UP*8 안의 가장 가까운 칸으로 붙인다
            r = UP * 8
            win = lab[max(py - r, 0):py + r, max(px - r, 0):px + r]
            ys, xs = np.nonzero(win)
            if len(ys):
                i = np.argmin((ys + max(py - r, 0) - py) ** 2 + (xs + max(px - r, 0) - px) ** 2)
                l = win[ys[i], xs[i]]
        if not l:
            print(f"! {name}: {xy} 는 선 위라 칸을 못 찾음", file=sys.stderr)
            continue
        reg = nd.binary_dilation(lab == l, st, iterations=R) & inside
        if col == "none":
            holes |= reg & ~ink
        else:
            layers.append((reg, col))
    layers = [l for m, c in layers for l in shade(m & ~holes, c)]
    layers.append((ink, INK))
    # 그린 것만 남게 둘레를 잘라 낸다
    ys, xs = np.where(inside | ink)
    pad = UP * 4
    by0, by1, bx0, bx1 = max(ys.min() - pad, 0), min(ys.max() + pad, h), max(xs.min() - pad, 0), min(xs.max() + pad, w)
    body = "".join(trace(m[by0:by1, bx0:bx1], c) for m, c in layers)
    W, H = bx1 - bx0, by1 - by0
    print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W // UP}" height="{H // UP}"><!-- {name} · 연아 그림 -->{body}</svg>')


if __name__ == "__main__":
    main()
