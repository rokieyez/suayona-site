# 새 48도트 수아·연아 시트(PNG) → 사이트용 문자열 도트. 2026-09-29
#   python3 tools/kid-sheet-to-js.py  → tools/kid-sheet.out.js 에 세 토막을 적는다
#   ① pixel.js PAL 에 넣을 색  ② pixel.js SPRITES 의 sua·yona(정면 서기, 딱 맞게 자름)
#   ③ pages/kid-art.js 의 걷기 틀(다섯 방향 × 서기 1 + 걷기 4, 한 아이 안에서 같은 칸으로 자름 — 발 자리가 흔들리지 않게)
# 시트: 줄 S SW W NW N NE E SE, 열 0=서기 1~4=걷기. 오른쪽 셋은 왼쪽을 뒤집은 것이라 JS 에서 뒤집어 만든다.
import json, os
import numpy as np
from PIL import Image

DL = os.path.expanduser('~/Downloads')
SHEETS = {'sua': (DL + '/수아-8방향-스프라이트/sua-48-8dir-walk.png', 40),
          'yona': (DL + '/연아-8방향-스프라이트/yeona-48-8dir-walk.png', 34)}
CH = 53
DIRS = ['S', 'SW', 'W', 'NW', 'N']
# 기존 PAL 은 ASCII 글자를 다 쓰고 있어서, 새 색은 U+0100 부터 붙인다
CHARS = [chr(0x100 + i) for i in range(128)]

# 앉은 모습(북서 3/4 뒷모습 — 무릎에 손 · 피아노 치는 손) — tools/pixelize-row.py 로 서 있는 시트의 색만 써서 만든 것
SITS = {'sua': DL + '/수아-8방향-스프라이트/sua-48-sit-NW.png', 'yona': DL + '/연아-8방향-스프라이트/yeona-48-sit-NW.png'}
# 공연장 객석 손님 여덟 명(앉은 북서 뒷모습, 머리 모양이 다 다름) — 색은 손님끼리 따로(U+0180~)
GUESTS = [DL + '/공연장-관객-스프라이트/guests-A.png', DL + '/공연장-관객-스프라이트/guests-B.png']
sheets = {k: np.array(Image.open(p).convert('RGBA')) for k, (p, _) in SHEETS.items()}
sits = {k: np.array(Image.open(p).convert('RGBA')) for k, p in SITS.items()}
colors = sorted({tuple(int(v) for v in px[:3]) for a in list(sheets.values()) + list(sits.values()) for px in a[a[..., 3] > 0]})
cmap = {c: CHARS[i] for i, c in enumerate(colors)}

def rows(a):
    return [''.join('.' if p[3] == 0 else cmap[tuple(int(v) for v in p[:3])] for p in r) for r in a]

def bbox(a):
    ys, xs = np.nonzero(a[..., 3])
    return ys.min(), ys.max() + 1, xs.min(), xs.max() + 1

def cell(a, cw, r, c):
    return a[r * CH:(r + 1) * CH, c * cw:(c + 1) * cw]

def near(p, c, d=60):
    return p[3] and abs(int(p[0]) - c[0]) + abs(int(p[1]) - c[1]) + abs(int(p[2]) - c[2]) < d

def light(p):
    return p[3] and int(p[0]) > 200 and int(p[1]) > 150

def mouth(f):
    # 입 = 피부에 둘러싸인(좌우·위아래) 가로 두 칸 — 이걸 기준으로 눈 자리를 잡는다
    H, W = f.shape[:2]
    for y in range(12, 32):
        for x in range(8, W - 8):
            if not light(f[y, x]) and not light(f[y, x + 1]) and light(f[y, x - 1]) and light(f[y, x + 2]) \
               and all(light(f[y + d, x + k]) for d in (-1, 1) for k in (0, 1)):
                return y, x
    raise SystemExit('입을 못 찾음 ' + str(f.shape))

# 입(ym, m) 기준 눈 두 개 [x, y, w, h] — 두 시트의 pixelize.py 가 찍은 자리
EYE_OFF = {'sua': [(-4, -4, 2, 3), (4, -4, 2, 3)], 'yona': [(-4, -3, 2, 3), (4, -3, 2, 3)]}

out_pal, out_sp, out_kid = [], {}, {}
for k, (p, cw) in SHEETS.items():
    a = sheets[k]
    # 걷기 틀: 이 아이의 40칸을 모두 덮는 네모 하나로 자른다
    boxes = [bbox(cell(a, cw, r, c)) for r in range(8) for c in range(5)]
    y0 = min(b[0] for b in boxes); y1 = max(b[1] for b in boxes)
    x0 = min(b[2] for b in boxes); x1 = max(b[3] for b in boxes)
    x0 = min(x0, cw - x1); x1 = cw - x0          # 좌우 대칭으로 — JS 에서 뒤집어도 가운데가 같게
    frames = {d: [rows(cell(a, cw, r, c)[y0:y1, x0:x1]) for c in range(5)] for r, d in enumerate(DIRS)}
    eyes = []
    for c in range(5):
        f = cell(a, cw, 0, c)[y0:y1, x0:x1]
        ym, m = mouth(f)
        eyes.append([[m + dx, ym + dy, w, h] for dx, dy, w, h in EYE_OFF[k]])
    s0 = cell(a, cw, 0, 0)
    b = bbox(s0)
    out_sp[k] = rows(s0[b[0]:b[1], b[2]:b[3]])
    out_kid[k] = {'frames': frames, 'eyes': eyes, 'w': int(x1 - x0), 'h': int(y1 - y0)}
    print(k, '걷기 칸', x1 - x0, 'x', y1 - y0, '서기', b[3] - b[2], 'x', b[1] - b[0], '눈', eyes[0])

# 쓰임새별 글자 — 생활 페이지가 신발 색을 바꾸고, 공연장이 손님 머리·옷 색을 바꾸는 데 쓴다
def role_chars(k, pred):
    used = {ch for d in out_kid[k]['frames'].values() for f in d for r in f for ch in r if ch != '.'}
    return sorted(ch for c, ch in cmap.items() if ch in used and pred(c, ch))
def low_share(k, ch):
    # 그 색 화소 가운데 발치(아래 8줄)에 있는 몫 — 빨강 줄무늬·입술과 주황 신발을 가른다
    fs = [f for d in out_kid[k]['frames'].values() for f in d]
    n = sum(r.count(ch) for f in fs for r in f); lo = sum(r.count(ch) for f in fs for r in f[-8:])
    return lo / max(1, n)
def is_shoe(k):
    return lambda c, ch: c[0] > 150 and c[0] - c[1] > 60 and c[2] < 80 and low_share(k, ch) > 0.7
ROLES = {k: {'shoe': role_chars(k, is_shoe(k))} for k in SHEETS}
print('신발 글자', ROLES)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def put(path, tag, body):
    # 「// <tag>」 과 「// </tag>」 사이를 통째로 갈아 끼운다
    fp = os.path.join(ROOT, path); src = open(fp, encoding='utf-8').read()
    i = src.index('// <' + tag + '>'); i = src.index('\n', i) + 1
    j = src.index('// </' + tag + '>'); j = src.rindex('\n', 0, j) + 1
    open(fp, 'w', encoding='utf-8').write(src[:i] + body + src[j:])

pal_lines = ''.join("  '%s': '#%02x%02x%02x',\n" % (ch, *c) for c, ch in cmap.items())
put('pixel.js', 'kid-sheet:pal', pal_lines)
sp = ''
for k in SHEETS:
    sp += '  %s: [\n' % k + ''.join("    '%s',\n" % r for r in out_sp[k]) + '  ],\n'
put('pixel.js', 'kid-sheet:sprites', sp)
newpal = '{' + ','.join("'%s':'#%02x%02x%02x'" % (ch, *c) for c, ch in cmap.items()) + '}'
def cells(a, n):
    # 한 줄에 같은 폭 n 칸 — 칸마다 위아래 빈 줄은 한 그림 안에서 같게 둔다(발 자리가 같게)
    cw = a.shape[1] // n
    return [a[:, i * cw:(i + 1) * cw] for i in range(n)]
def rows_with(a, cm):
    return [''.join('.' if q[3] == 0 else cm[tuple(int(v) for v in q[:3])] for q in r) for r in a]
kid = {k: {'w': v['w'], 'h': v['h'], 'eyes': v['eyes'], 'shoe': ROLES[k]['shoe'], 'frames': v['frames'],
           'sit': [rows_with(c, cmap) for c in cells(sits[k], 2)]} for k, v in out_kid.items()}
gs = [np.array(Image.open(p).convert('RGBA')) for p in GUESTS]
gcolors = sorted({tuple(int(v) for v in px[:3]) for a in gs for px in a[a[..., 3] > 0]})
gmap = {c: chr(0x180 + i) for i, c in enumerate(gcolors)}
guests = [rows_with(c, gmap) for a in gs for c in cells(a, 4)]
gpal = '{' + ','.join("'%s':'#%02x%02x%02x'" % (ch, *c) for c, ch in gmap.items()) + '}'
put('pages/kid-art.js', 'kid-sheet', 'const NEWPAL = ' + newpal + ';\nconst NEW = ' + json.dumps(kid, ensure_ascii=False, separators=(',', ':')) + ';\n'
    + 'const GUESTPAL = ' + gpal + ';\nconst GUESTS = ' + json.dumps(guests, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('손님', len(guests), '명, 색', len(gmap))
print('색', len(cmap))
