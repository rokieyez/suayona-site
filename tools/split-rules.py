import io, re, sys, gzip, json

SRC = 'farm-rules.js'
# 손님 몫이 부르는 것들 — 재서 나온 목록에 없지만 여기 남겨야 한다.
# fixWorld → hungCol·okPic·wallKey·wallRowsFor, okPic → picSide, MEDALS 표 → cropsInDex,
# 손님 화면의 반딧불이 → fireflyLeft (손님도 M 을 만들어 두므로 여름·가을 밤에 실제로 불린다)
GUEST_EXTRA = ['hungCol', 'okPic', 'picSide', 'wallKey', 'wallRowsFor', 'cropsInDex',
               'fireflyLeft']
HIT = """calendar dayKey dayStartMs daysBetween fireflyNight fixMine fixTune fixWorld furnBox growTime
isNight levelOf newMine newWorld nodeReady occupied parseId parseWall peddlerHere placed plotIds prand
roomArgs roomBox roomStep setSky setSun skyOf spotOf stageOf sunOf thingHere tickPlot wallCols wallLen
weatherOf wetNow""".split() + GUEST_EXTRA

L = io.open(SRC, encoding='utf-8').read().split('\n')

def strip(line):
    out=[]; i=0; q=None
    while i < len(line):
        c=line[i]
        if q:
            if c=='\\': i+=2; continue
            if c==q: q=None
            i+=1; continue
        if c in '"\'`': q=c; i+=1; continue
        if c=='/' and i+1<len(line) and line[i+1]=='/': break
        out.append(c); i+=1
    return ''.join(out)

funcs=[]; i=0
while i < len(L):
    m = re.match(r'^(\s*)(async )?function ([A-Za-z0-9_$]+)\s*\(', L[i])
    if m:
        d=0; j=i; started=False
        while j < len(L):
            s2=strip(L[j]); d += s2.count('{') - s2.count('}')
            if '{' in s2: started=True
            if started and d<=0: break
            j+=1
        funcs.append((i, j, m.group(3))); i=j+1
    else: i+=1

byname = {n:(a,b) for a,b,n in funcs}
missing = [n for n in HIT if n not in byname]
assert not missing, missing
play = [(a,b,n) for a,b,n in funcs if n not in HIT]
playnames = set(n for _,_,n in play)

# 놀이 몫이 쓰는 안쪽 이름 모으기
inner_all = set(byname)
for m in re.finditer(r'^\s{2}(?:const|let|var)\s+([^\n]*)', '\n'.join(L), re.M):
    dep=0; part=''
    for ch in m.group(1):
        if ch in '([{': dep+=1
        elif ch in ')]}': dep-=1
        if ch==',' and dep==0:
            g=re.match(r'^\s*([A-Za-z_$][\w$]*)', part)
            if g: inner_all.add(g.group(1))
            part=''; continue
        part+=ch
    g=re.match(r'^\s*([A-Za-z_$][\w$]*)', part)
    if g: inner_all.add(g.group(1))

need=set()
for a,b,n in play:
    body='\n'.join(L[a:b+1])
    for w in set(re.findall(r'(?<![A-Za-z0-9_$.])([A-Za-z_$][\w$]*)', body)):
        if w in inner_all and w not in playnames: need.add(w)
need = sorted(need)

# 함수 위에 붙은 주석도 같이 옮긴다
def comment_start(a):
    k=a
    while k-1 >= 0:
        t=L[k-1].strip()
        if t.startswith('//') or t.startswith('*') or t.startswith('/*'): k-=1
        else: break
    return k
move=set()
for a,b,n in play: move.update(range(comment_start(a), b+1))

guest_lines = [L[i] for i in range(len(L)) if i not in move]
play_lines  = [L[i] for i in sorted(move)]

# 내보내기 목록에서 놀이 이름 빼기
g = '\n'.join(guest_lines)
mret = re.search(r'(\n  return \{\n)(.*?)(\n  \};\n)', g, re.S)
assert mret, '내보내기 목록을 못 찾음'
body = mret.group(2)
moved_exports=[]
def cut(line):
    parts=[p.strip() for p in line.split(',')]
    keep=[]
    for p in parts:
        if not p: continue
        # `openMail: openMailAll` 처럼 다른 이름으로 내보내는 것은 **오른쪽**을 봐야 한다
        nm = p.split(':')[-1].strip()
        if nm in playnames: moved_exports.append(p)
        else: keep.append(p)
    return keep
newlines=[]
for line in body.split('\n'):
    ind = re.match(r'^(\s*)', line).group(1)
    keep = cut(line)
    if keep: newlines.append(ind + ', '.join(keep) + ',')
g = g[:mret.start(2)] + '\n'.join(newlines) + g[mret.end(2):]

# 안쪽 것을 놀이 파일에 넘기는 다리
bridge = ("\n  /* 놀이 규칙(farm-rules-play.js)이 이 닫힘 안의 것을 쓴다. 손으로 적은 목록이 아니라\n"
          "     tools/split-rules.py 가 두 파일을 읽어 만든 것이다 — 하나라도 빠지면 그 규칙이\n"
          "     돌 때 undefined 로 터진다. 놀이 규칙을 고쳤으면 그 도구를 다시 돌린다. */\n"
          "  const INNER = { " + ', '.join(need) + " };\n")
g = g.replace('\n  return {\n', bridge + '\n  return {\n', 1)
g = g.replace('\n    newWorld, newMine,', '\n    __inner: INNER,\n    newWorld, newMine,', 1)
assert '__inner' in g

head = [
 '// 수아연아 농장의 **놀이 규칙** — 심기·물주기·거두기·사기·팔기·요리·낚시·집 꾸미기.',
 '// farm-rules.js 에서 떼어 냈다. 손님은 농장과 방 그림만 보므로 이 규칙이 한 줄도 안 쓰인다',
 '// (함수 159개 중 손님이 부르는 것은 37개뿐이었다). 로그인한 사람만 늦게 받는다.',
 '//',
 '// farm-rules.js 가 먼저 돌아야 한다. 저 파일의 닫힘 안에 있는 것들은 FARM.__inner 로 받는다.',
 '(() => {',
 "  if (typeof FARM === 'undefined' || !FARM.__inner) throw new Error('farm-rules.js 를 먼저 실어야 해요');",
 '  const { ' + ', '.join(need) + ' } = FARM.__inner;',
 '',
]
tail = [
 '',
 '  // 규칙을 FARM 에 얹는다. 이 뒤부터 R.till · R.buy … 를 부를 수 있다.',
 '  Object.assign(FARM, {',
 '    ' + ',\n    '.join(moved_exports) + ',',
 '  });',
 '})();',
]
p = '\n'.join(head + play_lines + tail) + '\n'

gz=lambda t: len(gzip.compress(t.encode(),9))
print('놀이 함수 %d개 · %d줄 · 넘기는 이름 %d개 · 옮긴 내보내기 %d개' % (len(play), len(move), len(need), len(moved_exports)))
print('원래 %d → 손님 %d · 놀이 %d · 합 %d (%+d)' % (gz('\n'.join(L)), gz(g), gz(p), gz(g)+gz(p), gz(g)+gz(p)-gz('\n'.join(L))))
if len(sys.argv) > 1 and sys.argv[1] == 'write':
    io.open('farm-rules.js','w',encoding='utf-8').write(g)
    io.open('farm-rules-play.js','w',encoding='utf-8').write(p)
    print('썼다')
