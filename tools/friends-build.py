#!/usr/bin/env python3
"""연아 프렌즈 사진 두 장 → friends/<id>.svg 전부.  python3 tools/friends-build.py [id ...]
칸 좌표는 사진 픽셀(가로 2562·2679). 색은 「무엇인지」에 맞춰 내가 고른 것이다."""
import subprocess, sys, os
D = os.path.expanduser("~/Desktop/연아 프렌즈 사진/")
P1, P2 = D + "KakaoTalk_Photo_2026-10-04-17-22-05 001.jpeg", D + "KakaoTalk_Photo_2026-10-04-17-22-06 002.jpeg"
GREEN = "#6cc46a"
RAIN = ["#ff6b6b", "#ffa53d", "#ffd84d", "#7ed67a", "#6cc4ff", "#6c8de0", "#b08cff"]
# id, 사진, 칸, 바탕색, [찍기·지우기 ...]
ART = [
    ("cherry", P2, (95, 40, 400, 245), "#ff4d5e", ["0.5,0.25=" + GREEN, "0.62,0.22=" + GREEN]),
    ("orange", P2, (430, 35, 665, 250), "#ffa53d", []),
    ("peach", P2, (722, 38, 998, 252), "#ffb3a7", []),
    ("watermelon", P2, (1088, 22, 1366, 278), "#6fcf6a", []),
    ("banana", P2, (1428, 18, 1622, 282), "#ffd84d", []),
    ("slice", P2, (1648, 58, 1798, 268), "#ff6b6b", ["0.5,0.9=" + GREEN]),
    ("pirate", P2, (1846, 62, 2110, 268), "#ff5a4e", []),
    ("muscat", P2, (2146, 128, 2320, 282), "#b8e07a", []),
    ("strawberry", P2, (2380, 92, 2536, 272), "#ff6b81", []),
    ("carrot", P2, (18, 268, 262, 482), "#ff9a3c", []),
    ("olive", P2, (308, 306, 502, 462), "#9cb85a", []),
    ("chef", P2, (560, 368, 818, 592), "#c9b6f2", ["erase:0,0,55,80"]),
    ("blueberry", P2, (922, 388, 1302, 528), "#6c8de0", []),
    ("bread", P2, (72, 578, 272, 812), "#f7d99a", []),
    ("donut", P2, (328, 618, 562, 842), "#e8b06a", ["0.5,0.3=#ff9ec7", "0.5,0.48=none"]),
    ("sandwich", P2, (630, 602, 910, 836), "#f5d58f", []),
    ("muffin", P2, (948, 582, 1176, 816), "#e9b47a", []),
    ("croissant", P2, (1217, 618, 1557, 758), "#e8a85a", []),
    ("creambun", P2, (1678, 588, 1945, 778), "#f2c27b", []),
    ("cookies", P2, (2026, 623, 2421, 778), "#d9a066", []),
    ("macaron", P2, (73, 919, 503, 1098), "#ffb3c7", []),
    ("shrimp", P2, (598, 933, 908, 1072), "#ff9a76", []),
    ("slice2", P2, (927, 929, 1072, 1108), "#ff6b6b", ["0.5,0.9=" + GREEN]),
    ("pudding", P2, (1087, 929, 1467, 1043), "#ffd56b", []),
    ("cake", P2, (1618, 858, 1918, 1102), "#ffd3e2", []),
    ("madeleine", P2, (1996, 878, 2226, 1103), "#f2c27b", []),
    ("dessert", P2, (68, 1179, 303, 1423), "#fff1d6", []),
    ("bar", P1, (488, 112, 642, 366), "#ff8fab", ["close:24"]),
    ("soda", P1, (833, 178, 977, 372), "#8fd3ff", []),
    ("icecop", P1, (1125, 135, 1320, 385), "#a9d8f5", ["close:9"]),
    ("chestnut", P2, (458, 1239, 672, 1428), "#c68a4f", []),
    ("almond", P2, (743, 1239, 905, 1428), "#d6965e", []),
    ("peanut", P2, (957, 1219, 1101, 1423), "#eccb8c", []),
    ("walnut", P2, (1142, 1229, 1321, 1403), "#c88d56", []),
    ("pistachio", P2, (1347, 1224, 1496, 1403), "#e8d3a8", ["0.5,0.65=#a8cf6a"]),
    ("cashew", P2, (1542, 1224, 1661, 1373), "#f0d29a", []),
    ("berry", P2, (1690, 1208, 1822, 1377), "#c99b6d", []),
    ("brazil", P2, (1836, 1229, 1955, 1373), "#a0704a", []),
    ("acorns", P2, (2006, 1274, 2270, 1378), "#d99a4e", []),
    ("pinenut", P2, (2371, 1304, 2435, 1378), "#f3e0b5", []),
    ("squirrel", P2, (53, 1570, 247, 1753), "#c98a54", []),
    ("raccoon", P2, (248, 1568, 407, 1748), "#a8a8a8", []),
    ("berry2", P2, (483, 1554, 642, 1713), "#ffb3c7", []),
    ("ddakbbang", P2, (703, 1559, 872, 1713), "#f2d6a0", []),
    ("jjondeugi", P2, (937, 1554, 1106, 1748), "#ff8a65", []),
    ("marshmallow", P2, (1172, 1559, 1301, 1683), "#ffe4ee", []),
    ("choco", P2, (1367, 1539, 1471, 1683), "#b07a52", []),
    ("chip", P2, (1572, 1539, 1701, 1698), "#e8c07a", []),
    ("rainbow", P2, (1771, 1514, 2180, 1663), "#ffd84d",
     [f"{x},{y}={c}" for (x, y), c in zip([(.07, .3), (.24, .3), (.40, .3), (.56, .3), (.72, .3), (.91, .3), (.05, .86)], RAIN)]),
    ("hotdog", P2, (2200, 1440, 2560, 1790), "#e08a4f", ["close:7", "erase:15,0,340,45", "erase:10,45,112,86", "erase:245,80,345,128"]),
]
want = set(sys.argv[1:])
os.makedirs("friends", exist_ok=True)
for id, src, box, base, extra in ART:
    if want and id not in want:
        continue
    out = subprocess.run([sys.executable, "tools/friends-art.py", src, id, *map(str, box), base, *extra], capture_output=True, text=True)
    if out.returncode:
        print(id, "실패", out.stderr[-300:]); continue
    open(f"friends/{id}.svg", "w").write(out.stdout)
    print(id, len(out.stdout) // 1024, "KB", out.stderr.strip())
