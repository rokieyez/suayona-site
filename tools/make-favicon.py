#!/usr/bin/env python3
"""파비콘(브라우저 탭 아이콘) 만들기.

레샤 도트를 pixel.js 에서 그대로 가져와 쓴다. 사진을 눈으로 옮겨 그리면 색과
칸이 조금씩 어긋나는데, 원본이 이미 도트로 있으니 그걸 읽는 편이 정확하다.

    python3 tools/make-favicon.py

만들어지는 것
    favicon.svg           브라우저 탭 (도트라 어느 크기에서도 안 뭉개짐)
    favicon.ico           주소를 몰라도 브라우저가 알아서 찾아가는 자리
    apple-touch-icon.png  아이폰 홈화면
"""

import os, re, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# pixel.js 에서 팔레트와 레샤(fox) 도트를 읽어 온다
# ---------------------------------------------------------------------------
def read_pixel_js():
    src = open(os.path.join(ROOT, 'pixel.js'), encoding='utf-8').read()

    pal = dict(re.findall(r"(\w)\s*:\s*'(#[0-9a-fA-F]{6})'", src))

    m = re.search(r"\bfox:\s*\[(.*?)\]", src, re.S)
    if not m:
        raise SystemExit('pixel.js 에서 fox 도트를 못 찾았습니다')
    rows = re.findall(r"'([^']*)'", m.group(1))
    return pal, rows


# ---------------------------------------------------------------------------
# 꼬리 떼어내기
#
# 원본은 18칸인데 왼쪽 0~3칸이 꼬리다. 얼굴만 쓰기로 했으므로 4칸부터 자른다.
# 자를 자리를 손으로 적어 두는 대신, "왼쪽 네 칸에만 있고 몸통과 안 붙은 덩어리"
# 를 찾는 식으로 하면 도트가 바뀌었을 때 조용히 엉뚱한 데를 자를 수 있다.
# 도트가 바뀌면 이 숫자도 같이 고치는 편이 눈에 보인다.
# ---------------------------------------------------------------------------
TAIL_COLS = 4

def crop(rows):
    body = [r[TAIL_COLS:] for r in rows]
    w = max(len(r) for r in body)
    return [r.ljust(w, '.') for r in body], w, len(body)


# ---------------------------------------------------------------------------
# 그리기
# ---------------------------------------------------------------------------
CANVAS = 16          # 파비콘 한 변 (도트 개수)

def place(rows, w, h):
    """정사각 칸 한가운데에 놓는다. 남는 칸은 투명."""
    ox, oy = (CANVAS - w) // 2, (CANVAS - h) // 2
    grid = [['.'] * CANVAS for _ in range(CANVAS)]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                grid[oy + y][ox + x] = ch
    return grid


def to_svg(grid, pal):
    # 같은 색이 가로로 이어지면 사각형 하나로 묶는다 — 파일이 반으로 준다.
    out = []
    for y, row in enumerate(grid):
        x = 0
        while x < CANVAS:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            run = 1
            while x + run < CANVAS and row[x + run] == ch:
                run += 1
            out.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>'
                       % (x, y, run, pal[ch]))
            x += run
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
        'shape-rendering="crispEdges">\n' % (CANVAS, CANVAS)
        + '<title>레샤</title>\n'
        + '\n'.join(out) + '\n</svg>\n'
    )


def hexrgb(s):
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16))


def to_rgba(grid, pal, scale, bg=None):
    """도트를 scale 배로 키운 RGBA 픽셀 줄들로."""
    size = CANVAS * scale
    base = (hexrgb(bg) + (255,)) if bg else (0, 0, 0, 0)
    rows = []
    for y in range(size):
        line = bytearray()
        for x in range(size):
            ch = grid[y // scale][x // scale]
            line += bytes(base if ch == '.' else hexrgb(pal[ch]) + (255,))
        rows.append(bytes(line))
    return size, rows


def png(size, rows):
    """PNG 로 묶기. 라이브러리 없이 — 이 정도는 규격이 단순하다."""
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    raw = b''.join(b'\x00' + r for r in rows)          # 줄마다 필터 0(안 씀)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))


def ico(png_bytes, size):
    """PNG 를 그대로 품는 ICO. 요즘 브라우저는 전부 읽는다."""
    header = struct.pack('<HHH', 0, 1, 1)
    entry = struct.pack('<BBBBHHII',
                        size if size < 256 else 0, size if size < 256 else 0,
                        0, 0, 1, 32, len(png_bytes), 6 + 16)
    return header + entry + png_bytes


def main():
    pal, rows = read_pixel_js()
    body, w, h = crop(rows)
    grid = place(body, w, h)

    used = sorted({c for r in grid for c in r if c != '.'})
    missing = [c for c in used if c not in pal]
    if missing:
        raise SystemExit('팔레트에 없는 색: ' + ', '.join(missing))

    def write(name, data, mode='wb'):
        path = os.path.join(ROOT, name)
        with open(path, mode) as f:
            f.write(data)
        print('%-22s %6d바이트' % (name, os.path.getsize(path)))

    write('favicon.svg', to_svg(grid, pal).encode('utf-8'))

    size, px = to_rgba(grid, pal, 2)                 # 16 -> 32
    write('favicon.ico', ico(png(size, px), size))

    # 아이폰 홈화면은 투명한 자리를 검게 칠한다 — 여기만 바탕을 깔아 준다.
    size, px = to_rgba(grid, pal, 12, bg='#fffaf2')  # 16 -> 192
    write('apple-touch-icon.png', png(size, px))

    print('\n도트 %d x %d (꼬리 %d칸 뺀 뒤) · 쓴 색: %s'
          % (w, h, TAIL_COLS, ' '.join('%s=%s' % (c, pal[c]) for c in used)))


if __name__ == '__main__':
    main()
