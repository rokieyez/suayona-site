// 공부 계획의 셈만 따로 둔 파일 — 화면(study.js)과 점검(tools/check-study.js)이 같이 쓴다.
// 두 가지를 한다.
//  1) 여유(Shovel 의 Time Cushion): 마감까지 남은 빈 시간 − 남은 분량에 드는 시간.
//  2) 자동 배치(Motion): 마감이 이른 것부터, 날마다 남은 빈 시간에 비례해 나눠 넣는다.
//     어제 못 했으면 남은 분량이 그대로라 다음 계산에서 저절로 다시 나뉜다.

// 'YYYY-MM-DD' 끼리는 글자 비교가 곧 날짜 비교다.
function studyIso(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

// 하루 공부 시간대 [시작, 끝](분)에서 그날 일정(학교·학원)과 겹치는 만큼을 뺀 분.
function freeMinutes(win, busy){
  if (!win || win[1] <= win[0]) return 0;
  // 겹치는 일정끼리 먼저 합쳐야 두 번 빼지 않는다
  const cut = busy.map(([s, e]) => [Math.max(s, win[0]), Math.min(e, win[1])])
    .filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let taken = 0, curS = -1, curE = -1;
  cut.forEach(([s, e]) => {
    if (s > curE) { taken += curE - curS; curS = s; curE = e; }
    else curE = Math.max(curE, e);
  });
  taken += curE - curS;
  return win[1] - win[0] - taken;
}

// days: [{ date:'YYYY-MM-DD', free:분 }] 오늘부터 차례로 (마지막 마감까지)
// tasks: [{ id, left:남은 단위(오늘 아침 기준), per:단위당 분, due:'YYYY-MM-DD' }]
// 돌려주는 것: byDay[date] = [{ id, units, min }], perTask[id] = { need, room, cushion, short, late }
function planStudy(days, tasks){
  const rem = days.map(d => d.free);
  const byDay = {}, perTask = {};
  days.forEach(d => { byDay[d.date] = []; });
  const today = days.length ? days[0].date : '';

  [...tasks].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)).forEach(t => {
    const late = t.due < today;                       // 마감이 지났으면 오늘 안에 해야 하는 것으로 본다
    let k = -1;
    days.forEach((d, i) => { if (d.date <= (late ? today : t.due)) k = i; });
    const need = t.left * t.per;
    let room = 0;
    for (let i = 0; i <= k; i++) room += rem[i];

    const fit = t.per > 0 ? Math.min(t.left, Math.floor(room / t.per)) : t.left;
    // 누적 비율로 나눠 반올림 오차가 한 날에 몰리지 않게 한다. 올림이라 앞날에 조금 더 실린다.
    let given = 0, acc = 0;
    for (let i = 0; i <= k && room > 0; i++) {
      acc += rem[i];
      const upto = Math.min(fit, Math.ceil(fit * acc / room));
      const units = upto - given;
      if (units > 0) {
        byDay[days[i].date].push({ id: t.id, units, min: units * t.per });
        rem[i] = Math.max(0, rem[i] - units * t.per);
        given = upto;
      }
    }
    perTask[t.id] = { need, room, cushion: room - need, short: (t.left - fit) * t.per, late };
  });
  return { byDay, perTask };
}

// 여유를 세 칸으로. 남은 일의 절반만큼 더 시간이 있으면 넉넉하다고 본다.
function cushionLevel(p){
  if (p.need <= 0) return 'done';
  if (p.cushion < 0) return 'short';
  return p.cushion >= p.need * 0.5 ? 'easy' : 'tight';
}

if (typeof module !== 'undefined') module.exports = { studyIso, freeMinutes, planStudy, cushionLevel };
