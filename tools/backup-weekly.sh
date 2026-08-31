#!/bin/zsh
# 주마다 알아서 백업을 받는다. 맥의 자동 실행(launchd)이 이 파일을 부른다.
#
# 손으로 돌릴 때와 다른 점이 두 가지 있다.
#   · 물어볼 사람이 없다      -> 이메일과 비밀번호를 키체인에서 꺼내 온다
#   · 볼 사람도 없다          -> 무슨 일이 있었는지 기록으로 남긴다
#
# 처음 한 번만 (직접 하셔야 합니다):
#   security add-generic-password -a "이메일주소" -s suayona-backup -w
#   (비밀번호를 물어봅니다. 화면에 안 보입니다.)
#
# 기록 보기:
#   tail -40 ~/Library/Logs/suayona-backup.log

set -u

LOG=~/Library/Logs/suayona-backup.log
HERE=${0:A:h}                 # 이 파일이 있는 폴더
REPO=${HERE:h}                # 그 위 = 홈페이지 폴더

mkdir -p "${LOG:h}"

# 기록이 한없이 길어지지 않게. 1MB 넘으면 뒤쪽 300줄만 남긴다.
if [[ -f $LOG ]] && (( $(stat -f%z "$LOG") > 1048576 )); then
  tail -n 300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

say() { print -r -- "[$(date '+%Y-%m-%d %H:%M')] $*" >> "$LOG"; }

say "── 백업 시작 ──"

# launchd 는 PATH 를 거의 안 물려준다. node 를 직접 찾는다.
NODE=""
for p in /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node 2>/dev/null)"; do
  [[ -n $p && -x $p ]] && { NODE=$p; break; }
done
if [[ -z $NODE ]]; then
  say "멈춤: node 를 못 찾았습니다. 홈브루로 다시 깔았다면 경로가 바뀌었을 수 있어요."
  exit 1
fi

if [[ ! -f $REPO/tools/backup.mjs ]]; then
  say "멈춤: 백업 도구가 없습니다 ($REPO/tools/backup.mjs)."
  say "      홈페이지 폴더를 옮기셨다면 자동 실행도 다시 걸어야 합니다:"
  say "      launchctl bootout gui/\$UID/com.suayona.backup 뒤에 다시 설치"
  exit 1
fi

# 키체인에서 계정과 비밀번호를 꺼낸다.
# 이메일은 키체인의 '계정' 칸에 들어 있다 — 여기(공개 폴더)에 적어 두지 않으려고.
ITEM=$(security find-generic-password -s suayona-backup 2>/dev/null) || {
  say "멈춤: 키체인에 로그인 정보가 없습니다. 한 번만 아래를 실행해 주세요."
  say "      security add-generic-password -a \"이메일주소\" -s suayona-backup -w"
  exit 1
}
# acct 줄에서 따옴표 안의 마지막 값을 꺼낸다.
# security 는 값에 아스키가 아닌 글자가 섞이면 16진수를 먼저 찍고 그 뒤에 따옴표로 한 번 더 준다:
#     "acct"<blob>="mail@example.com"
#     "acct"<blob>=0xED85... "테스트@example.com"
# 둘 다 "따옴표로 나뉜 마지막 직전 조각" 이 값이라 이렇게 하면 양쪽 다 걸린다.
EMAIL=$(print -r -- "$ITEM" | awk -F'"' '/"acct"<blob>=/ {print $(NF-1)}')
PASSWORD=$(security find-generic-password -s suayona-backup -w 2>/dev/null)

if [[ -z ${EMAIL:-} || -z ${PASSWORD:-} ]]; then
  say "멈춤: 키체인에서 정보를 꺼내지 못했습니다."
  say "      이 파일을 손으로 한 번 돌려서 '항상 허용'을 눌러 주세요: $HERE/backup-weekly.sh"
  exit 1
fi

# 아스키가 아닌 글자가 섞인 계정은 security 가 \355\205\214 같은 꼴로 돌려준다.
# 그대로 로그인하면 "비밀번호가 틀렸다"는 엉뚱한 소리를 듣게 되므로 여기서 잡는다.
# (보통 쓰는 영문 이메일에서는 걸릴 일이 없다.)
if [[ $EMAIL == *'\'* ]]; then
  say "멈춤: 키체인의 계정 이름을 그대로 읽지 못했습니다 ($EMAIL)."
  say "      계정 이름에 한글이 섞여 있으면 이렇게 됩니다. 영문 이메일로 다시 넣어 주세요:"
  say "      security delete-generic-password -s suayona-backup"
  say "      security add-generic-password -a \"영문이메일\" -s suayona-backup -w"
  exit 1
fi

say "받는 중... (계정 $EMAIL)"

# 비밀번호는 명령줄에 안 쓴다 — ps 로 남이 볼 수 있는 자리라서.
SUAYONA_EMAIL="$EMAIL" SUAYONA_PASSWORD="$PASSWORD" \
  "$NODE" "$REPO/tools/backup.mjs" >> "$LOG" 2>&1
CODE=$?

if (( CODE == 0 )); then
  say "── 끝 (잘 받았습니다) ──"
else
  say "── 끝 (실패, 코드 $CODE) — 위 줄을 확인해 주세요 ──"
fi
exit $CODE
