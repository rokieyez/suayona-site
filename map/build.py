#!/usr/bin/env python3
# 다녀온 곳 지도의 시·군 자료를 굽는다 → map/korea-sig.js
#
# 경계 자료: 통계청 2018 시군구 경계를 단순화한 TopoJSON (southkorea/southkorea-maps)
#   https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json
# 이 파일을 map/sigungu.topo.json 으로 받아 두고 돌린다. 원본은 540 KB 라 저장소에
# 올리지 않는다(.gitignore). 사이트에 들어가는 것은 여기서 구운 map/korea-sig.js 뿐이다.
#
#   python3 map/build.py                      → map/korea-sig.js 를 새로 쓴다
#   python3 map/build.py --points 좌표.json   → 그 좌표들이 맞게 갈리는지도 본다
#
# 구운 파일에는 두 가지가 들어 있다. 하는 일이 달라서 따로 둔다.
#   1. 그림 격자 — 도트로 그릴 칸마다 어느 시·군인지. 칸이 5 km 라 경계 근처는 거칠다.
#   2. 경계선   — 좌표 한 점이 어느 시·군인지 가리는 데 쓴다. 격자로 가리면
#                 뭍 위 아무 점의 9% 가 옆 시·군으로 가고, 실제 일정에서도 홍천 여행이
#                 춘천으로 칠해졌다(2026-09-11 에 잼). 그래서 가리는 일은 선으로 한다.
#
# 나누는 기준은 「시·군」이다.
#   - 광역시·특별시는 구를 합쳐 한 곳으로 센다. 딸린 군(강화·옹진·기장·달성·울주)은 따로.
#   - 구가 있는 일반시(수원·성남·창원 …)도 구를 합쳐 시 하나로.
#   구를 합치는 덕에 2018 뒤로 생긴 구 개편(부천·화성·인천 …)에도 흔들리지 않는다.
#   2023 년에 경북에서 대구로 옮긴 군위군만 이름표를 손으로 고친다.
import json, math, os, sys, gzip, random

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sigungu.topo.json')
OUT = os.path.join(HERE, 'korea-sig.js')
args = sys.argv[1:]
POINTS = args[args.index('--points') + 1] if '--points' in args else None

KM = 5.0                 # 그림 칸 하나의 크기
SIMPLIFY_M = 150         # 경계선을 이만큼까지 펴서 줄인다
QUANT = 0.001            # 경계선 좌표를 이 단위(약 100 m)로 반올림해 담는다
DROP_ISLAND_KM2 = 3      # 이보다 작은 섬은 가리는 선에서 뺀다(그 시·군의 가장 큰 땅이면 둔다)
NEAR_KM = 8              # 어느 선 안에도 안 드는 점(해변·뺀 섬)은 이 거리 안의 가장 가까운 곳으로

SIDO = {
  '11': '서울', '21': '부산', '22': '대구', '23': '인천', '24': '광주', '25': '대전',
  '26': '울산', '29': '세종', '31': '경기', '32': '강원', '33': '충북', '34': '충남',
  '35': '전북', '36': '전남', '37': '경북', '38': '경남', '39': '제주',
}
METRO = {'11', '21', '22', '23', '24', '25', '26', '29'}
# 이름표를 묶을 도. 광역시는 둘러싼 도에 넣어 「경남 부산·거제」처럼 읽히게 한다.
LEGEND_OF = {'11': '경기', '23': '경기', '21': '경남', '26': '경남',
             '22': '경북', '24': '전남', '25': '충남', '29': '충남'}

def unit_of(code, name):
    """시군구 하나 → (단위 키, 이름, 시도, 이름표 묶음)."""
    sd = code[:2]
    legend = LEGEND_OF.get(sd, SIDO[sd])
    if sd in METRO and (sd == '29' or int(code[2:]) < 310):   # 광역시의 구 → 광역시 하나
        return sd, SIDO[sd], '', legend
    sido = SIDO[sd]
    if code == '37310':                     # 군위군: 2023-07 경북 → 대구
        sido, legend = '대구', '경북'
    if code[4] != '0' and '시' in name[:-1]:                # 수원시장안구 → 수원시
        return code[:4], name[:name.index('시') + 1], sido, legend
    return code, name, sido, legend

# ---------- TopoJSON 풀기 ----------
topo = json.load(open(SRC, encoding='utf-8'))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']
ARCS = []
for a in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    ARCS.append(pts)
KX = math.cos(math.radians(36.0))           # 36도에서 경도 1도 = 위도 1도의 0.809배

def ring_pts(idx):
    out = []
    for i in idx:
        seg = ARCS[i] if i >= 0 else ARCS[~i][::-1]
        out.extend(seg if not out else seg[1:])
    return out

def area_km2(r):
    s = 0
    for i in range(len(r)):
        x1, y1 = r[i]; x2, y2 = r[(i + 1) % len(r)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2 * KX * 111 * 111

geoms = list(topo['objects'].values())[0]['geometries']
order, units = [], {}
for g in geoms:
    p = g['properties']
    key, nm, sido, legend = unit_of(p['code'], p['name'])
    if key not in units:
        units[key] = {'name': nm, 'sido': sido, 'legend': legend, 'rings': [], 'polys': []}
        order.append(key)
    for poly in (g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]):
        units[key]['polys'].append(poly)

# ---------- 정답지: 원본 경계로 정확히 가르기 ----------
def in_ring(x, y, r):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c

for k in order:
    u = units[k]
    u['full'] = [[ring_pts(r) for r in poly] for poly in u['polys']]
    xs = [x for poly in u['full'] for x, _ in poly[0]]
    ys = [y for poly in u['full'] for _, y in poly[0]]
    u['bbox'] = (min(xs), min(ys), max(xs), max(ys))

def truth_at(lng, lat):
    for k in order:
        b = units[k]['bbox']
        if not (b[0] <= lng <= b[2] and b[1] <= lat <= b[3]): continue
        for poly in units[k]['full']:
            if in_ring(lng, lat, poly[0]) and not any(in_ring(lng, lat, h) for h in poly[1:]):
                return k
    return None

# ---------- 1. 그림 격자 ----------
LAT_TOP, LNG_LEFT, LNG_RIGHT = 38.62, 125.95, 129.98
# 제주와 울릉은 해협을 줄여 그린다(예전 지도도 그랬다).
JEJU_BOX = (32.9, 33.6, 126.0, 127.1);   JEJU_DLAT = 0.35   # 제주 본섬은 33.57 까지다
ULLEUNG_BOX = (37.3, 37.7, 130.6, 131.2); ULLEUNG_DLNG = -1.05
LAT_BOTTOM = 33.10 + JEJU_DLAT
CELL_LAT = KM / 111.0
CELL_LNG = CELL_LAT / KX
COLS = int(math.ceil((LNG_RIGHT - LNG_LEFT) / CELL_LNG))
ROWS = int(math.ceil((LAT_TOP - LAT_BOTTOM) / CELL_LAT))

def inbox(lat, lng, b): return b[0] <= lat <= b[1] and b[2] <= lng <= b[3]
def from_draw(lat, lng):
    """그림 위 한 점 → 실제 위경도. 옮겨 그린 섬은 되돌린다."""
    if inbox(lat - JEJU_DLAT, lng, JEJU_BOX): return lat - JEJU_DLAT, lng
    if inbox(lat, lng - ULLEUNG_DLNG, ULLEUNG_BOX): return lat, lng - ULLEUNG_DLNG
    return lat, lng

# 칸의 가운데 한 점만 보면 해안의 절반이 바다로 빠진다. 3x3 으로 찍어 가장 많이 나온 곳을 쓰고,
# 바다가 과반인 칸은 비운다.
SUB = 3
num = {k: i + 1 for i, k in enumerate(order)}
grid = [[0] * COLS for _ in range(ROWS)]
share = {}
for r in range(ROWS):
    for c in range(COLS):
        hits = {}
        for i in range(SUB):
            for j in range(SUB):
                lat, lng = from_draw(LAT_TOP - (r + (i + .5) / SUB) * CELL_LAT,
                                     LNG_LEFT + (c + (j + .5) / SUB) * CELL_LNG)
                k = truth_at(lng, lat)
                if k: hits[k] = hits.get(k, 0) + 1
        if hits:
            share[(r, c)] = hits
            if sum(hits.values()) * 2 >= SUB * SUB:
                grid[r][c] = num[max(hits, key=hits.get)]

def cell_counts():
    n = {}
    for row in grid:
        for v in row:
            if v: n[v] = n.get(v, 0) + 1
    return n
# 칸을 하나도 못 받은 곳(작은 시·섬)에는 제 몫이 가장 큰 칸 하나를 준다 —
# 다녀왔는데 지도에 한 칸도 안 켜지는 곳이 있으면 안 된다.
n = cell_counts(); rescued = []
for k in order:
    if n.get(num[k]): continue
    cands = [(h[k], rc) for rc, h in share.items() if h.get(k)]
    if not cands: sys.exit('칸을 줄 수가 없다: ' + units[k]['name'])
    rc = max(cands)[1]
    grid[rc[0]][rc[1]] = num[k]; rescued.append(units[k]['name'])
n = cell_counts()
for k in order:
    if not n.get(num[k]): sys.exit('칸을 뺏겨 사라진 곳: ' + units[k]['name'])

# ---------- 2. 가리는 선 ----------
def dp(pts, tol):
    """더글러스-포이커. 거리는 경도를 KX 로 줄여 잰다."""
    if len(pts) < 3: return pts
    def d(p, a, b):
        ax, ay, bx, by, px, py = a[0]*KX, a[1], b[0]*KX, b[1], p[0]*KX, p[1]
        dx, dy = bx - ax, by - ay
        if dx == dy == 0: return math.hypot(px - ax, py - ay)
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - ax - t * dx, py - ay - t * dy)
    keep = {0, len(pts) - 1}; st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop(); m, k = -1, -1
        for q in range(i + 1, j):
            dd = d(pts[q], pts[i], pts[j])
            if dd > m: m, k = dd, q
        if m > tol: keep.add(k); st += [(i, k), (k, j)]
    return [pts[i] for i in sorted(keep)]

# 한 시·군 안의 구 사이 선은 짝수 번 나와 서로 지워진다 — 홀짝으로 가리면 필요 없는 선이다.
unit_arcs = {}
for k in order:
    cnt = {}
    polys = units[k]['polys']
    big = max(area_km2(ring_pts(p[0])) for p in polys)
    for poly in polys:
        if area_km2(ring_pts(poly[0])) < DROP_ISLAND_KM2 and area_km2(ring_pts(poly[0])) < big:
            continue
        for r in poly:
            for i in r:
                a = i if i >= 0 else ~i
                cnt[a] = cnt.get(a, 0) + 1
    unit_arcs[k] = sorted(a for a, c in cnt.items() if c % 2)
used = sorted({a for k in order for a in unit_arcs[k]})
arc_no = {a: i for i, a in enumerate(used)}
SIMPLE = {a: dp(ARCS[a], SIMPLIFY_M / 111000.0) for a in used}

def enc(v):
    """구글 폴리라인 부호화 — 작은 정수 하나를 글자 한두 개로."""
    v = ~(v << 1) if v < 0 else v << 1
    s = ''
    while v >= 0x20:
        s += chr((0x20 | (v & 0x1f)) + 63); v >>= 5
    return s + chr(v + 63)
Q = 1 / QUANT
arc_str, arc_q = [], {}
for a in used:
    s, px, py, q = '', 0, 0, []
    for x, y in SIMPLE[a]:
        ix, iy = round(x * Q), round(y * Q)
        s += enc(ix - px) + enc(iy - py); px, py = ix, iy
        q.append((ix * QUANT, iy * QUANT))
    arc_str.append(s); arc_q[a] = q

# 사이트에서 할 셈과 똑같이 파이썬으로도 — 구운 선이 정답지와 얼마나 맞나 잰다.
segs = {}
for k in order:
    L = []
    for a in unit_arcs[k]:
        p = arc_q[a]
        L += [(p[i], p[i + 1]) for i in range(len(p) - 1)]
    xs = [x for s in L for x, _ in s]; ys = [y for s in L for _, y in s]
    segs[k] = (L, (min(xs), min(ys), max(xs), max(ys)))
def baked_at(lng, lat):
    for k in order:
        L, b = segs[k]
        if not (b[0] <= lng <= b[2] and b[1] <= lat <= b[3]): continue
        c = False
        for (x1, y1), (x2, y2) in L:
            if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                c = not c
        if c: return k
    m = NEAR_KM / 111.0; best = None
    for k in order:
        L, b = segs[k]
        if not (b[0] - m / KX <= lng <= b[2] + m / KX and b[1] - m <= lat <= b[3] + m): continue
        for (x1, y1), (x2, y2) in L:
            ax, ay, bx, by, px = x1 * KX, y1, x2 * KX, y2, lng * KX
            dx, dy = bx - ax, by - ay
            t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy)))
            d = math.hypot(px - ax - t * dx, lat - ay - t * dy)
            if d < m and (best is None or d < best[0]): best = (d, k)
    return best and best[1]

# ---------- 파일 쓰기 ----------
def rle(g):
    out = []
    for row in g:
        c = 0
        while c < len(row):
            v = row[c]; run = 1
            while c + run < len(row) and row[c + run] == v: run += 1
            out.append(chr(48 + v) + chr(48 + run)); c += run
    return ''.join(out)

data = {
    'cols': COLS, 'rows': ROWS, 'top': LAT_TOP, 'left': LNG_LEFT,
    'cellLat': round(CELL_LAT, 8), 'cellLng': round(CELL_LNG, 8),
    'names': [units[k]['name'] for k in order],
    'sido': [units[k]['sido'] for k in order],
    'legend': [units[k]['legend'] for k in order],
    'grid': rle(grid),
    'quant': QUANT, 'kx': round(KX, 6), 'nearKm': NEAR_KM,
    'arcs': arc_str,
    'units': [[arc_no[a] for a in unit_arcs[k]] for k in order],
}
body = ('// 자동으로 만든 파일이다. 손으로 고치지 말고 map/build.py 를 다시 돌린다.\n'
        '// 다녀온 곳 지도의 시·군 %d곳 — 그림 격자 %dx%d(칸 %g km)와 좌표를 가릴 경계선.\n'
        '// 경계: 통계청 2018 시군구(southkorea/southkorea-maps), 구는 합치고 군위군은 대구로.\n'
        'var KOREA_SIG = %s;\n') % (len(order), COLS, ROWS, KM,
                                   json.dumps(data, ensure_ascii=False, separators=(',', ':')))

# ---------- 재기 ----------
print('시·군 %d곳, 격자 %d x %d (칸 %g km), 뭍 칸 %d' % (len(order), COLS, ROWS, KM, sum(n.values())))
print('칸을 못 받아 하나 준 곳 %d: %s' % (len(rescued), ' '.join(rescued) or '없음'))
print('칸이 가장 적은 곳:', ', '.join('%s %d' % (nm, c) for c, nm in
      sorted((n[num[k]], units[k]['name']) for k in order)[:6]))
random.seed(7); tot = miss = 0
while tot < 3000:
    lat = random.uniform(33.1, 38.6); lng = random.uniform(126.0, 129.6)
    a = truth_at(lng, lat)
    if not a: continue
    tot += 1
    if baked_at(lng, lat) != a: miss += 1
print('뭍 위 아무 점 %d개 중 경계선이 틀린 것 %d개 (%.2f%%)' % (tot, miss, 100.0 * miss / tot))
if POINTS:
    pts = json.load(open(POINTS))
    bad = 0
    for p in pts:
        a = truth_at(p['lng'], p['lat']); b = baked_at(p['lng'], p['lat'])
        nm = lambda k: k and units[k]['name']
        mark = '' if (a == b or a is None) else '  ← 틀림'
        if mark: bad += 1
        print('   %.4f %.4f  정답 %-6s 구운 선 %-6s%s' % (p['lat'], p['lng'], nm(a) or '(바다)', nm(b), mark))
    print('주어진 좌표 %d개 중 틀린 것 %d개' % (len(pts), bad))
open(OUT, 'w', encoding='utf-8').write(body)
print('썼다: %s — %.1f KB (gzip %.1f KB)' % (os.path.relpath(OUT), len(body.encode()) / 1024,
      len(gzip.compress(body.encode())) / 1024))
