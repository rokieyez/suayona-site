# 프리텐다드 가변체를 이 사이트가 쓰는 글자만 남기고 자른다.
#
# 왜:
#   지금은 jsDelivr 의 「동적 서브셋」 CSS 를 쓴다. 유니코드 구간마다 조각을 나눠 두고
#   화면에 나온 글자가 든 조각만 받는 방식인데, 첫 화면 한 장에 조각 열여섯 개가 붙어
#   330KB 가 온다. 우리가 쓰는 글자는 정해져 있으니 한 벌로 잘라 두면 왕복도 한 번이다.
#
# 남기는 것:
#   · 아스키 + 라틴 확장 + 자주 쓰는 문장부호
#   · 한글 낱자(ㄱ~ㅣ)
#   · 저장소 파일(html·js·css)에 실제로 박혀 있는 글자
#   · 데이터베이스에 이미 들어 있는 글의 한글
#
# 갈무리와 달리 상용 2350자를 다 넣지 않는다. 갈무리는 없는 글자가 프리텐다드로
# 튀면 모양이 확 달라져서 다 넣어야 했지만, 이쪽은 못 찾은 글자가 같은 프리텐다드
# (CDN 조각)로 가므로 티가 나지 않는다. 재 보니 2792자 439KB vs 1447자 217KB 였다.
#
# 굵기 축도 잘라 둔다. 원본은 45~930 인데 사이트가 쓰는 것은 400~900 뿐이라,
# 400 아래를 버리면 217KB → 158KB 가 된다.
#
# 여기 없는 글자는 어떻게 되나:
#   style.css 의 글꼴 줄이 'Pretendard Subset' → 'Pretendard Variable' 순서라,
#   잘라 낸 벌에 없는 글자만 예전처럼 CDN 조각에서 온다. 그래서 잘라도 안전하다.
#
# 다시 만들려면:
#   python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
#   curl -sL -o /tmp/PV.woff2 https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
#   /tmp/fontenv/bin/python fonts/build-pretendard-subset.py
import pathlib, subprocess, sys

HERE = pathlib.Path(__file__).parent
REPO = HERE.parent
SRC  = pathlib.Path('/tmp/PV.woff2')
OUT  = HERE / 'PretendardVariable.subset.woff2'

# 갈무리 쪽 목록을 그대로 쓴다 — 두 글꼴이 같은 글자를 덮어야 섞였을 때 티가 안 난다
DB_HANGUL = (
 "가각간감갑갔강같개거검것게겠경계고곡골곰곳과관광괜교구국군그근글기길깃까깐꼬꼭꿈"
 "나날남내냠너널넘네녀녁년념노놀누눈뉴느는늘늦니다단담당대더덕던데도돈돌동돼되될됩"
 "두드든들등디따때또띄라락래략량러럽레렐려렴렵로록롭료류르른를름릅리림마막만많말맛"
 "맞먼면명몇모목무문물미밀바발밤밥방밭배백뱃법베변별보본볼봉부분불브비빛빠빨뿌사산"
 "살상새색샌생샤서선설섬세셔셨소속손수숙순술숲쉬슈스슬습시식신실심싶쎄아악안앉않알"
 "았앙애앤야약얀양어언엄없었에여역연영옆오올와왔외왼요우운울움원위유육윤으은을음의"
 "이인일입있자작잔잘잠재저적전점정제조족좀종좋좌주준줄줌중즈지직진질집짜짧쪽차착찮"
 "찾챙처천체쳐촌추춘출충춰층치친침카캐캠커컵콘콩쿠크클탈터테통투튜트티틱파판팔퍼페"
 "편펼평표푸프플피필하학한할합해행험현홍화확황회효후휴희힐"
)

used = set()
for p in list(REPO.rglob('*.html')) + list(REPO.rglob('*.js')) + list(REPO.rglob('*.css')):
    if '.git' in p.parts or p.name.startswith('_'): continue
    used |= set(p.read_text(encoding='utf-8', errors='ignore'))

chars = set()
chars |= {chr(c) for c in range(0x20, 0x7F)}
chars |= {chr(c) for c in range(0xA0, 0x180)}
chars |= {chr(c) for c in range(0x3131, 0x3164)}
chars |= set('　、。「」『』·…—–―‘’“”₩％°※→←↑↓★☆♥♡✓✕±×÷≠≤≥∞')
chars |= set(DB_HANGUL)
chars |= {c for c in used if ord(c) < 0x3000 or 0xAC00 <= ord(c) <= 0xD7A3}
chars = {c for c in chars if c.isprintable() or c == ' '}

keep = HERE / 'pretendard-keep.txt'
keep.write_text(''.join(sorted(chars)), encoding='utf-8')
print('남길 글자 %d자' % len(chars))

if not SRC.exists():
    sys.exit('원본이 없습니다: %s' % SRC)

# 굵기 축을 400~930 으로 좁힌다. 400 아래 정보가 통째로 빠져 60KB 가 준다.
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
narrowed = pathlib.Path('/tmp/PV_narrowed.ttf')
f = instancer.instantiateVariableFont(TTFont(str(SRC)), {'wght': (400, 930)},
                                      updateFontNames=False, inplace=False)
f.flavor = None
f.save(str(narrowed))

subprocess.run([sys.executable, '-m', 'fontTools.subset', str(narrowed),
    '--text-file=' + str(keep),
    '--output-file=' + str(OUT),
    '--flavor=woff2',
    '--layout-features=kern,liga,calt,ccmp,locl',
    '--no-hinting',
    '--desubroutinize',
    '--drop-tables+=DSIG',
    '--name-IDs=*', '--name-legacy', '--notdef-outline',
], check=True)
print('만듦: %s (%.0fKB, 원본 %.0fKB)' % (OUT.name, OUT.stat().st_size/1024, SRC.stat().st_size/1024))
