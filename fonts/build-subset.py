# 갈무리11 을 이 사이트가 쓰는 글자만 남기고 자른다.
#
# 원본은 한 벌에 2만 자가 넘게 들어 있다 — 한자와 가나까지. 우리는 한글과 라틴만 쓴다.
# 남기는 것:
#   · 아스키 + 라틴 확장 + 자주 쓰는 문장부호
#   · 한글 낱자(ㄱ~ㅣ)
#   · KS X 1001 상용 한글 2350자  ← 아이들이 쓸 웬만한 말은 여기 다 있다
#   · 저장소 파일에 실제로 박혀 있는 한글 (874자)
#   · 데이터베이스에 이미 들어 있는 글의 한글 (348자) ← 작품 제목이 말풍선에 뜨므로
import pathlib, subprocess, sys, os

HERE = pathlib.Path(__file__).parent
REPO = pathlib.Path('/Users/mac/Downloads/suayona-site')
OUT  = REPO / 'fonts'
OUT.mkdir(exist_ok=True)

# 데이터베이스에 이미 쓰인 한글 (작품 제목·일기·이벤트 이름·노트에서 뽑음)
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
    if '.git' in p.parts: continue
    used |= set(p.read_text(encoding='utf-8', errors='ignore'))

# KS X 1001 상용 2350자 — euc-kr 로 두 바이트가 모두 0xA1 이상인 것.
# (그냥 인코딩만 되는지 보면 CP949 확장 11172자가 다 통과해 버린다)
ks = set()
for c in range(0xAC00, 0xD7A4):
    ch = chr(c)
    try: b = ch.encode('euc-kr')
    except UnicodeEncodeError: continue
    if len(b) == 2 and b[0] >= 0xA1 and b[1] >= 0xA1: ks.add(ch)

chars = set()
chars |= {chr(c) for c in range(0x20, 0x7F)}          # 아스키
chars |= {chr(c) for c in range(0xA0, 0x180)}         # 라틴 확장
chars |= {chr(c) for c in range(0x3131, 0x3164)}      # ㄱ ~ ㅣ
chars |= set('　、。「」『』·…—–―‘’“”₩％°※→←↑↓★☆♥♡✓✕±×÷≠≤≥∞')
chars |= ks
DB_HANGUL_SET = set(DB_HANGUL)
chars |= DB_HANGUL_SET
chars |= {c for c in used if ord(c) < 0x3000 or 0xAC00 <= ord(c) <= 0xD7A3}
chars = {c for c in chars if c.isprintable() or c == ' '}

txt = HERE / 'keep.txt'
txt.write_text(''.join(sorted(chars)), encoding='utf-8')
print('남길 글자 %d자 (상용 %d + DB %d + 저장소 %d)' % (
    len(chars), len(ks), len(DB_HANGUL_SET),
    len({c for c in used if 0xAC00 <= ord(c) <= 0xD7A3})))

total_before = total_after = 0
for src, dst in [('Galmuri11.woff2', 'Galmuri11.subset.woff2'),
                 ('Galmuri11-Bold.woff2', 'Galmuri11-Bold.subset.woff2')]:
    subprocess.run([sys.executable, '-m', 'fontTools.subset', str(HERE / src),
        f'--text-file={txt}', '--flavor=woff2', f'--output-file={OUT / dst}',
        '--layout-features=*', '--no-hinting', '--desubroutinize',
        '--drop-tables+=DSIG', '--name-IDs=*', '--notdef-outline'],
        check=True, capture_output=True)
    a, b = os.path.getsize(HERE / src), os.path.getsize(OUT / dst)
    total_before += a; total_after += b
    print('  %-22s %7d → %6d B  (%.0f%% 줄어듦)' % (dst, a, b, (1 - b / a) * 100))
print('합계 %.0fKB → %.0fKB' % (total_before / 1024, total_after / 1024))
