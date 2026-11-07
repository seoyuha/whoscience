# 특별실 4곳(방송실·미술실·음악실·시청각실)을 3학년 4~7반 교실로 바꾸기
# 완성된 map.png에서 기존 교실(위층 1~3반) 그림·통행 정보를 복사해 아래층 방 위에 입힌다.
import json, sys
from collections import deque
from PIL import Image, ImageDraw

A = "/home/claude/whoscience/public/assets"
T = 48
m = json.load(open(f"{A}/map.json"))
img = Image.open(f"{A}/map.png").convert("RGBA")
grid = [list(r) for r in m["grid"]]
area = {a["id"]: a for a in m["areas"]}

# (바꿀 방, 새 이름, en, 그림을 가져올 교실, 교실 변형 v)
CONV = [("bcast", "3학년 4반", "Class 3-4", "c8"),
        ("art",   "3학년 5반", "Class 3-5", "c9"),
        ("music", "3학년 6반", "Class 3-6", "c10"),
        ("av",    "3학년 7반", "Class 3-7", "c9")]

door = {d["area"]: d for d in m["doors"]}
for tgt, name, en, src in CONV:
    xs, xd = area[src]["x0"], area[tgt]["x0"]
    # 1) 그림: 위층 교실 블록(벽면 1~2행 + 방 3~11행)을 아래층(21~31행)에 복사
    dr = door[tgt]; dx = dr["x"]
    block = img.crop((xs * T, 1 * T, (xs + 10) * T, 12 * T))
    floortile = img.crop(((xs + 2) * T, 5 * T, (xs + 3) * T, 6 * T))  # 빈 교실 바닥 한 칸
    hall = [img.crop((c * T, 20 * T, (c + 1) * T, 21 * T)) for c in (dx, dx + 1)]  # 문 통로 바닥
    img.paste(block, (xd * T, 21 * T))
    # 문 통로(21~22행)를 복도 바닥으로 깔고 문틀 기둥을 다시 그리기
    for r in (21, 22):
        for k, c in enumerate((dx, dx + 1)): img.paste(hall[k], (c * T, r * T))
    dd = ImageDraw.Draw(img); OL = (58, 58, 80, 255)
    px, py = dx * T, 20 * T
    dd.rectangle((px - 3, py, px + 1, py + 3 * T - 1), fill=(150, 100, 64, 255), outline=OL)
    dd.rectangle((px + 2 * T - 2, py, px + 2 * T + 2, py + 3 * T - 1), fill=(150, 100, 64, 255), outline=OL)
    # 2) 통행 정보: 방 안쪽 9행 복사 (벽면·문 행은 그대로)
    for r in range(9):
        for c in range(10):
            grid[23 + r][xd + c] = grid[3 + r][xs + c]
    # 3) 아래층은 문이 위(복도 쪽)에 있어서, 문 앞에 복사된 교탁을 지우고 바닥으로
    for r in (23, 24):
        for c in (dx, dx + 1):
            img.paste(floortile, (c * T, r * T)); grid[r][c] = "."
    # 4) 이름 바꾸기
    area[tgt]["name"] = name; area[tgt]["en"] = en
    dr["name"] = name + " 문"

# 5) 심부름·장난 자리: 바뀐 방 것은 지우고, 원본 교실 것을 자리만 옮겨 복사
gone = {c[0] for c in CONV}
tasks = [t for t in m["tasks"] if t["area"] not in gone]
pranks = [p for p in m["pranks"] if p["area"] not in gone]
for tgt, name, en, src in CONV:
    ddx = area[tgt]["x0"] - area[src]["x0"]
    for t in m["tasks"]:
        if t["area"] == src:
            tasks.append(dict(t, area=tgt, x=t["x"] + ddx, y=t["y"] + 20, ax=t["ax"] + ddx, ay=t["ay"] + 20))
    for p in m["pranks"]:
        if p["area"] == src:
            pranks.append(dict(p, area=tgt, x=p["x"] + ddx, y=p["y"] + 20, ax=p["ax"] + ddx, ay=p["ay"] + 20))
# id 다시 매기기
for i, t in enumerate(tasks): t["id"] = f"t{i}"
for i, p in enumerate(pranks): p["id"] = f"p{i}"
m["tasks"], m["pranks"] = tasks, pranks
m["grid"] = ["".join(r) for r in grid]

# ---------- 점검 (build_map.py와 같은 검사) ----------
W, H = m["W"], m["H"]
def area_of(x, y):
    for d in m["doors"]:
        if [x, y] in d["tiles"]: return d["area"]
    for a in m["areas"]:
        if a["x0"] <= x <= a["x1"] and a["y0"] <= y <= a["y1"]: return a["id"]
bad = 0
for t in tasks + pranks:
    if grid[t["ay"]][t["ax"]] != ".": print("!! 막힘", t); bad = 1
    if not t.get("door") and area_of(t["ax"], t["ay"]) != t["area"]: print("!! 구역", t, area_of(t["ax"], t["ay"])); bad = 1
start = (38, 17); seen = {start}; q = deque([start])
while q:
    x, y = q.popleft()
    for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
        if 0 <= nx < W and 0 <= ny < H and grid[ny][nx] == "." and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
for t in tasks + pranks:
    if (t["ax"], t["ay"]) not in seen: print("!! 못 감", t); bad = 1
un = sum(1 for y in range(H) for x in range(W) if grid[y][x] == "." and (x, y) not in seen and (x, y) != (67, 3))  # (67,3)은 원본부터 못 닿는 장식 구석
print("tasks", len(tasks), "pranks", len(pranks), "닿지 못하는 바닥", un)
if bad or un: sys.exit("검사 실패")
img.save(f"{A}/map.png", optimize=True)
img.resize((W * 12, H * 12), Image.BOX).save(f"{A}/map_small.png", optimize=True)
json.dump(m, open(f"{A}/map.json", "w"), ensure_ascii=False)
per_room = {}
for t in tasks: per_room.setdefault(t["area"], []).append(t["name"])
print("저장 완료", {k: v for k, v in per_room.items()})
