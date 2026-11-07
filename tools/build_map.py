"""학교 맵 생성 v2: 15곳 + 체육관.
그림: 선생님 school_pixel_assets / LimeZu Modern Interiors Free(비영리) / NettySvit CoolSchool(CC0) / 나머지는 코드로 그림(임시)
출력: map.png, map_small.png, map.json"""
import json, random, sys, os
from collections import deque
from PIL import Image, ImageDraw

SCR = sys.argv[1]; OUT = sys.argv[2]
T = 48
random.seed(7)
I = Image.open(f"{SCR}/mi/Modern tiles_Free/Interiors_free/48x48/Interiors_free_48x48.png").convert("RGBA")
R = Image.open(f"{SCR}/mi/Modern tiles_Free/Interiors_free/48x48/Room_Builder_free_48x48.png").convert("RGBA")
C = Image.open(f"{SCR}/cs/CoolSchool_tileset_48px/CoolSchool_tileset.png").convert("RGBA")
NEW = f"{SCR}/sp"
# 선생님이 새로 준 그림이 있으면 그걸 우선 사용 (extra/ 폴더: 파일 이름이 같으면 교체)
EXTRA = f"{SCR}/extra"

SLOT = 11
NSLOT = 7
GX0 = SLOT * NSLOT + 1          # 체육관 안쪽 시작 x (78)
GW = 18
W = GX0 + GW + 1                # 97
H = 33
img = Image.new("RGBA", (W * T, H * T), (47, 46, 62, 255))
grid = [["#"] * W for _ in range(H)]

def tile(src, c, r): return src.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))
def crop(src, c, r, w=1, h=1): return src.crop((c * T, r * T, (c + w) * T, (r + h) * T))
def ld(p):
    for base in (EXTRA, NEW):
        f = f"{base}/{p}"
        if os.path.exists(f): return Image.open(f).convert("RGBA")
    return None

def wood_tile(seed, base=(197, 141, 85), dark=(150, 98, 58), plank=12):
    rnd = random.Random(seed)
    t = Image.new("RGBA", (T, T), base + (255,)); d = ImageDraw.Draw(t)
    for i in range(T // plank):
        y = i * plank; sh = rnd.randint(-10, 10)
        col = tuple(max(0, min(255, base[k] + sh)) for k in range(3)) + (255,)
        d.rectangle((0, y, T - 1, y + plank - 1), fill=col)
        d.line((0, y + plank - 1, T - 1, y + plank - 1), fill=dark + (255,))
        d.line((0, y, T - 1, y), fill=tuple(min(255, c + 18) for c in col[:3]) + (255,))
        jx = (rnd.randint(8, 40) + i * 17) % T
        d.line((jx, y, jx, y + plank - 1), fill=dark + (255,))
    return t

WOOD = [wood_tile(i) for i in range(3)]
WOOD2 = [wood_tile(i + 9, (176, 116, 74), (128, 80, 50)) for i in range(3)]
GYMW = [wood_tile(i + 20, (222, 178, 118), (178, 130, 80), 16) for i in range(3)]
FLOORS = {
    "cs": lambda x, y: tile(C, 2, 0), "wood": lambda x, y: WOOD[(x * 7 + y * 3) % 3], "wood2": lambda x, y: WOOD2[(x * 5 + y) % 3],
    "gym": (lambda im: (lambda x, y: im))(ld("new/gym_floor.png")) if ld("new/gym_floor.png") else (lambda x, y: GYMW[(x * 5 + y * 2) % 3]),
    "brick": lambda x, y: tile(R, 11 + x % 3, 5 + y % 2), "ytile": lambda x, y: tile(R, 11 + x % 3, 7 + y % 2),
    "btile": lambda x, y: tile(R, 11 + x % 3, 9 + y % 2), "gtile": lambda x, y: tile(R, 11 + x % 3, 11 + y % 2),
    "herring": lambda x, y: tile(R, 11 + x % 3, 13 + y % 2), "carpet": lambda x, y: tile(R, 14 + x % 3, 5 + y % 2),
    "carpet2": lambda x, y: tile(R, 14 + x % 3, 9 + y % 2),
}
WALLS = {
    "cs": lambda x, k: tile(C, x % 2, 3 + k), "pink": lambda x, k: tile(R, x % 3, 5 + k), "yellow": lambda x, k: tile(R, x % 3, 7 + k),
    "mint": lambda x, k: tile(R, x % 3, 9 + k), "wood": lambda x, k: tile(R, x % 3, 11 + k), "dwood": lambda x, k: tile(R, x % 3, 13 + k),
    "red": lambda x, k: tile(R, x % 3, 15 + k), "gray": lambda x, k: tile(R, x % 3, 17 + k), "beige": lambda x, k: tile(R, x % 3, 19 + k),
}
def paste(im, px, py): img.alpha_composite(im, (int(px), int(py)))
def floor(kind, x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            paste(FLOORS[kind](x, y), x * T, y * T); grid[y][x] = "."
def wallface(kind, x0, x1, y):
    for x in range(x0, x1 + 1):
        for k in range(2): paste(WALLS[kind](x, k), x * T, (y + k) * T)
def stamp(im, x, y, block=None, dx=0, dy=0):
    paste(im, x * T + dx, y * T + dy)
    if block is False: return
    tw, th = (im.width + T - 1) // T, (im.height + T - 1) // T
    if block is None: block = (0, 0, tw - 1, th - 1)
    bx0, by0, bx1, by1 = block
    for yy in range(y + by0, y + by1 + 1):
        for xx in range(x + bx0, x + bx1 + 1):
            if 0 <= yy < H and 0 <= xx < W: grid[yy][xx] = "#"

OL = (58, 58, 80, 255)
def canvas(w, h): s = Image.new("RGBA", (w, h), (0, 0, 0, 0)); return s, ImageDraw.Draw(s)
# ---- 임시로 코드로 그린 소품 (선생님 그림이 오면 교체) ----
def sp_toybox():
    s = crop(I, 11, 11).copy(); d = ImageDraw.Draw(s)
    d.ellipse((8, 2, 20, 14), fill=(230, 80, 80, 255), outline=OL); d.rectangle((24, 4, 34, 14), fill=(80, 150, 230, 255), outline=OL)
    return s
def sp_stall():       # 화장실 칸 (48×96)
    s, d = canvas(48, 96)
    d.rectangle((2, 4, 45, 92), fill=(158, 196, 214, 255), outline=OL, width=2)
    d.rectangle((6, 10, 41, 86), fill=(176, 214, 230, 255), outline=(110, 140, 160, 255))
    d.rectangle((33, 46, 37, 52), fill=(230, 200, 80, 255), outline=OL)
    d.rectangle((14, 14, 34, 22), fill=(120, 200, 120, 255))
    return s
def sp_tissue():
    s, d = canvas(48, 48)
    d.rounded_rectangle((10, 12, 38, 34), 4, fill=(200, 200, 214, 255), outline=OL, width=2)
    d.ellipse((16, 14, 32, 30), fill=(255, 255, 255, 255), outline=(170, 170, 190, 255)); d.ellipse((21, 19, 27, 25), fill=(170, 170, 190, 255))
    return s
def sp_hoop():        # 농구 골대 (96×96)
    s, d = canvas(96, 96)
    d.rectangle((44, 50, 52, 92), fill=(110, 110, 130, 255), outline=OL); d.rectangle((30, 86, 66, 93), fill=(90, 90, 110, 255), outline=OL)
    d.rectangle((14, 4, 82, 46), fill=(250, 250, 250, 255), outline=OL, width=3); d.rectangle((36, 18, 60, 36), outline=(220, 60, 50, 255), width=3)
    d.ellipse((34, 38, 62, 50), outline=(240, 120, 40, 255), width=4)
    return s
def sp_mat():
    s, d = canvas(96, 48)
    d.rounded_rectangle((2, 6, 93, 44), 6, fill=(70, 120, 210, 255), outline=OL, width=2)
    for x in (32, 64): d.line((x, 8, x, 42), fill=(50, 90, 170, 255), width=2)
    return s
def sp_ballcart():
    s, d = canvas(48, 48)
    d.rectangle((4, 18, 43, 42), fill=(160, 160, 180, 255), outline=OL, width=2)
    for i, (x, y, col) in enumerate([(8, 6, (240, 130, 50)), (22, 4, (250, 250, 250)), (30, 10, (230, 70, 70)), (14, 14, (80, 150, 230))]):
        d.ellipse((x, y, x + 13, y + 13), fill=col + (255,), outline=OL)
    return s
def sp_screen():      # 시청각실 큰 스크린 (192×96)
    s, d = canvas(192, 96)
    d.rectangle((6, 4, 185, 12), fill=(90, 90, 110, 255), outline=OL)
    d.rectangle((14, 12, 177, 86), fill=(245, 245, 250, 255), outline=OL, width=3)
    d.rectangle((24, 22, 167, 76), fill=(120, 170, 220, 255)); d.polygon([(40, 76), (80, 40), (110, 76)], fill=(90, 160, 90, 255))
    d.ellipse((130, 30, 150, 50), fill=(250, 220, 90, 255))
    return s
def sp_projector():
    s, d = canvas(48, 48)
    d.rounded_rectangle((8, 16, 40, 36), 4, fill=(220, 220, 230, 255), outline=OL, width=2); d.ellipse((12, 20, 24, 32), fill=(80, 80, 100, 255))
    return s
def sp_breaker():     # 차단기 (96×96, 벽)
    s, d = canvas(96, 96)
    d.rectangle((8, 8, 87, 86), fill=(150, 156, 170, 255), outline=OL, width=3); d.rectangle((14, 14, 81, 26), fill=(240, 200, 60, 255), outline=OL)
    for x in (22, 56):
        d.rectangle((x, 38, x + 18, 74), fill=(70, 74, 90, 255), outline=OL); d.rectangle((x + 4, 42, x + 14, 54), fill=(230, 70, 60, 255))
    return s
def sp_console():     # 방송 장비 책상
    s, d = canvas(96, 96)
    d.rectangle((2, 40, 93, 90), fill=(90, 80, 96, 255), outline=OL, width=2)
    d.rectangle((6, 44, 89, 64), fill=(50, 50, 64, 255))
    for i in range(8): d.rectangle((10 + i * 10, 48, 15 + i * 10, 60), fill=[(230, 70, 70), (80, 200, 120), (240, 200, 60)][i % 3] + (255,))
    d.rectangle((24, 8, 72, 40), fill=(40, 44, 60, 255), outline=OL, width=2); d.rectangle((30, 14, 66, 34), fill=(90, 160, 220, 255))
    return s

SP = {
    "cs_desk": crop(C, 0, 5, 1, 2), "cs_chair": crop(C, 0, 9), "cs_chair2": crop(C, 1, 9), "cs_tdesk": crop(C, 1, 5, 2, 2),
    "cs_shelf": crop(C, 5, 0, 1, 3), "cs_shelf2": crop(C, 6, 0, 1, 3), "cs_cab": crop(C, 5, 3, 1, 2), "cs_cab2": crop(C, 7, 5, 1, 2),
    "cs_tall": crop(C, 7, 0, 1, 4), "cs_long": crop(C, 0, 7, 3, 2), "cs_long2": crop(C, 3, 7, 3, 2), "cs_long3": crop(C, 5, 7, 3, 2),
    "cs_pc": crop(C, 0, 10), "cs_pc2": crop(C, 1, 10), "cs_laptop": crop(C, 2, 10), "cs_tv": crop(C, 3, 10), "cs_printer": crop(C, 4, 10),
    "cs_phone": crop(C, 5, 10), "cs_books": crop(C, 0, 11), "cs_book": crop(C, 1, 11), "cs_tablet": crop(C, 2, 11), "cs_open": crop(C, 3, 11),
    "cs_redbook": crop(C, 4, 11), "cs_note": crop(C, 5, 11), "cs_paper": crop(C, 6, 11), "cs_ochair": crop(C, 4, 9), "cs_ochair2": crop(C, 6, 9),
    "cs_board": C.crop((110, 114, 226, 168)), "cs_win": C.crop((144, 18, 240, 72)), "cs_tvboard": C.crop((102, 197, 187, 240)),
    "bboard": crop(I, 13, 40, 2, 2), "gboard": crop(I, 10, 40, 2, 2), "locker": crop(I, 12, 40, 1, 2), "chart": crop(I, 13, 38, 2, 2),
    "globe": crop(I, 13, 36), "globe2": crop(I, 14, 36), "plant": crop(I, 10, 44, 1, 3), "plant2": crop(I, 12, 45, 1, 2), "palm": crop(I, 13, 44, 2, 3),
    "shelfA": crop(I, 10, 68, 2, 3), "shelfB": crop(I, 12, 68, 2, 3), "shelfC": crop(I, 14, 68, 2, 3), "wmap": crop(I, 10, 66, 2, 2),
    "fglobe": crop(I, 12, 66, 1, 2), "table": crop(I, 0, 10, 3, 3), "table2": crop(I, 5, 10, 4, 3), "fridge": crop(I, 2, 18, 4, 2),
    "fridge1": crop(I, 2, 18, 1, 2), "rack": crop(I, 6, 18, 1, 3), "sofa_g": crop(I, 1, 72, 3, 2), "sofa_b": crop(I, 7, 72, 3, 2),
    "box2": crop(I, 12, 11), "win_w": crop(I, 9, 24, 2, 2), "rug_r": crop(I, 7, 15, 4, 3), "rug_g": crop(I, 0, 42, 3, 2), "rug_bl": crop(I, 3, 42, 3, 2),
    "frame1": crop(I, 0, 71), "frame2": crop(I, 1, 71), "frame3": crop(I, 2, 71), "fire_pic": crop(I, 8, 21, 2, 1), "lamp": crop(I, 12, 52, 1, 2),
    "mirror": crop(I, 3, 66, 1, 2), "chair_w": crop(I, 4, 21, 1, 2), "bench": crop(I, 7, 13, 3, 2), "stool": crop(I, 5, 13),
    "easel": crop(I, 9, 62, 1, 2), "keys": crop(I, 1, 16, 3, 2), "wchair1": crop(I, 9, 31, 1, 2), "wchair2": crop(I, 11, 31, 1, 2),
    "toybox": sp_toybox(),
}
for k, f, fb in [("sink", "furniture/sink.png", None), ("bell", "furniture/emergency_bell.png", None), ("trophy", "furniture/trophy_case.png", None),
                 ("bins", "furniture/recycling_bins.png", None), ("piano", "furniture/upright_piano.png", None), ("bed", "furniture/infirmary_bed.png", None),
                 ("medbox", "furniture/first_aid_kit.png", None), ("mic", "furniture/microphone.png", None), ("paint", "furniture/watercolors.png", None),
                 ("board", "school/bulletin_board.png", None), ("cubbies", "school/shoe_cubbies.png", None), ("door_open", "school/classroom_door_open.png", None),
                 ("door_closed", "school/classroom_door_closed.png", None),
                 ("stall", "new/toilet_stall.png", sp_stall), ("tissue", "new/tissue_holder.png", sp_tissue), ("hoop", "new/basketball_hoop.png", sp_hoop),
                 ("mat", "new/gym_mat.png", sp_mat), ("ballcart", "new/ball_cart.png", sp_ballcart), ("screen", "new/av_screen.png", sp_screen),
                 ("projector", "new/projector.png", sp_projector), ("breaker", "new/breaker_panel.png", sp_breaker), ("console", "new/broadcast_desk.png", sp_console)]:
    SP[k] = ld(f) or fb()

# ---------- 구조 ----------
TOP = {"face": 1, "y0": 3, "y1": 11}; BOT = {"face": 21, "y0": 23, "y1": 31}; COR = {"face": 13, "y0": 15, "y1": 19}
RX = [1 + i * SLOT for i in range(NSLOT)]
rooms_top = [("c8", "6학년 8반", "Class 6-8", "cs", "cs"), ("c9", "6학년 9반", "Class 6-9", "cs", "cs"), ("c10", "6학년 10반", "Class 6-10", "cs", "cs"),
             ("lib", "도서실", "the library", "wood", "wood"), ("sci", "과학실", "the science room", "gtile", "mint"),
             ("com", "컴퓨터실", "the computer room", "btile", "gray"), ("wc", "화장실", "the restroom", "ytile", "mint")]
rooms_bot = [("staff", "교무실", "the teachers' office", "carpet", "beige"), ("nurse", "보건실", "the nurse's office", "btile", "mint"),
             ("bcast", "방송실", "the broadcasting room", "carpet2", "gray"), ("cafe", "급식실", "the cafeteria", "brick", "yellow"),
             ("art", "미술실", "the art room", "wood2", "pink"), ("music", "음악실", "the music room", "carpet2", "red"),
             ("av", "시청각실", "the AV room", "carpet", "dwood")]
areas, doors = [], []
for row, rooms in ((TOP, rooms_top), (BOT, rooms_bot)):
    for i, (rid, name, en, fl, wl) in enumerate(rooms):
        x0 = RX[i]; x1 = x0 + 9
        wallface(wl, x0, x1, row["face"]); floor(fl, x0, row["y0"], x1, row["y1"])
        areas.append(dict(id=rid, name=name, en=en, x0=x0, y0=row["y0"], x1=x1, y1=row["y1"], fy=row["face"]))
        dx = x0 + 4; ys = (12, 13, 14) if row is TOP else (20, 21, 22)
        tiles = []
        for y in ys:
            for x in (dx, dx + 1):
                paste(FLOORS["gtile"](x, y), x * T, y * T); grid[y][x] = "."; tiles.append([x, y])
        doors.append(dict(id="d_" + rid, area=rid, name=name + " 문", tiles=tiles, x=dx, y=ys[0], rect=[dx, ys[0], dx + 1, ys[-1]], lock=True))
# 복도
wallface("gray", 1, GX0 - 2, COR["face"]); floor("gtile", 1, COR["y0"], GX0 - 2, COR["y1"])
MID = 39
areas.append(dict(id="hw", name="서관 복도", en="the west hallway", x0=1, y0=COR["y0"], x1=MID - 1, y1=COR["y1"], fy=COR["face"]))
areas.append(dict(id="he", name="동관 복도", en="the east hallway", x0=MID, y0=COR["y0"], x1=GX0 - 2, y1=COR["y1"], fy=COR["face"]))
# 체육관 (세로로 긴 방)
wallface("wood", GX0, GX0 + GW - 1, 1); floor("gym", GX0, 3, GX0 + GW - 1, 31)
areas.append(dict(id="gym", name="체육관", en="the gym", x0=GX0, y0=3, x1=GX0 + GW - 1, y1=31, fy=1))
gt = []
for y in (16, 17, 18):
    x = GX0 - 1; paste(FLOORS["gtile"](x, y), x * T, y * T); grid[y][x] = "."; gt.append([x, y])
doors.append(dict(id="d_gym", area="gym", name="체육관 문", tiles=gt, x=GX0 - 1, y=16, rect=[GX0 - 1, 16, GX0 - 1, 18], lock=False))

# 문틀
d = ImageDraw.Draw(img)
for dr in doors:
    if not dr["lock"]: continue
    px, py = dr["x"] * T, dr["y"] * T
    d.rectangle((px - 3, py, px + 1, py + 3 * T - 1), fill=(150, 100, 64, 255), outline=OL)
    d.rectangle((px + 2 * T - 2, py, px + 2 * T + 2, py + 3 * T - 1), fill=(150, 100, 64, 255), outline=OL)

# 천장(벽 위) 칠하기
face = set()
for i in range(NSLOT):
    for x in range(RX[i], RX[i] + 10):
        for k in range(2): face |= {(x, TOP["face"] + k), (x, BOT["face"] + k)}
for x in range(1, GX0 - 1):
    for k in range(2): face.add((x, COR["face"] + k))
for x in range(GX0, GX0 + GW):
    for k in range(2): face.add((x, 1 + k))
for dr in doors:
    for t in dr["tiles"]: face.discard(tuple(t))
for y in range(H):
    for x in range(W):
        if grid[y][x] == "#" and (x, y) not in face:
            d.rectangle((x * T, y * T, x * T + T - 1, y * T + T - 1), fill=(47, 46, 62, 255))
for y in range(H):
    for x in range(W):
        if grid[y][x] == "#" and (x, y) not in face:
            for nx, ny, e in ((x + 1, y, "r"), (x - 1, y, "l"), (x, y + 1, "b"), (x, y - 1, "t")):
                if 0 <= nx < W and 0 <= ny < H and (grid[ny][nx] == "." or (nx, ny) in face):
                    px, py = x * T, y * T; c = (226, 228, 240, 255)
                    if e == "r": d.rectangle((px + T - 6, py, px + T - 1, py + T - 1), fill=c)
                    if e == "l": d.rectangle((px, py, px + 5, py + T - 1), fill=c)
                    if e == "b": d.rectangle((px, py + T - 6, px + T - 1, py + T - 1), fill=c)
                    if e == "t": d.rectangle((px, py, px + T - 1, py + 5), fill=c)

tasks, pranks = [], []
def task(area, name, x, y, ax, ay): tasks.append(dict(id=f"t{len(tasks)}", area=area, name=name, x=x, y=y, ax=ax, ay=ay))
def prank(area, kind, x, y, ax, ay, **kw): pranks.append(dict(id=f"p{len(pranks)}", area=area, kind=kind, x=x, y=y, ax=ax, ay=ay, **kw))

# ---------- 교실 3개 ----------
def classroom(i, rid, v):
    x0 = RX[i]; fy = 1
    if v == 0: paste(SP["cs_board"], (x0 + 3) * T + 2, fy * T + 30)
    elif v == 1: stamp(SP["bboard"], x0 + 4, fy, block=False, dy=18)
    else: paste(SP["cs_tvboard"], (x0 + 3) * T + 50, fy * T + 40); paste(SP["cs_board"], (x0 + 1) * T - 20, fy * T + 30)
    paste(SP["cs_win"], (x0 + 7) * T + 12, fy * T + 18)
    if v != 2: stamp(SP["board"], x0 + 1, fy, block=False, dx=-6, dy=24)
    stamp(SP["cs_tdesk"], x0 + 4, 3, block=(0, 0, 1, 1)); stamp(SP["cs_ochair"], x0 + 4, 2, block=False, dx=24, dy=10)
    items = ["cs_books", "cs_open", "cs_note", "cs_book", "cs_tablet", "cs_redbook", "cs_paper", "cs_laptop"]; k = 0
    for yy in (6, 9):
        for xx in (x0 + 1, x0 + 3, x0 + 6, x0 + 8):
            stamp(SP["cs_desk"], xx, yy, block=(0, 0, 0, 1)); stamp(SP["cs_chair" if (xx + yy) % 2 else "cs_chair2"], xx, yy + 2, block=False, dy=-14)
            if (k + v) % 3 != 1: paste(SP[items[(k + v * 3) % 8]], xx * T, yy * T - 18)
            k += 1
    stamp(SP["cs_shelf2" if v % 2 else "cs_shelf"], x0 + 9, 1, block=(0, 2, 0, 2)); stamp(SP["cs_cab"], x0, 2, block=(0, 1, 0, 1))
    stamp(SP["toybox"], x0, 11); stamp(SP["plant2"], x0 + 9, 10, block=(0, 1, 0, 1))
    task(rid, "칠판 지우기", x0 + 4, 2, x0 + 3, 3); task(rid, "책상 줄 맞추기", x0 + 6, 9, x0 + 5, 10)
    task(rid, ["교과서 나눠 주기", "화분에 물 주기", "창문 닦기"][v], *[(x0 + 1, 6, x0 + 2, 7), (x0 + 9, 10, x0 + 8, 11), (x0 + 8, 2, x0 + 7, 3)][v])
    prank(rid, "chalk", x0 + 5, 2, x0 + 6, 3); prank(rid, "plane", x0 + 3, 9, x0 + 2, 9); prank(rid, "toy", x0, 11, x0 + 1, 11)
    if v == 1: prank(rid, "shelf", x0 + 9, 3, x0 + 8, 4)
    if v == 2: prank(rid, "books", x0 + 8, 6, x0 + 7, 7)
for i, rid in enumerate(["c8", "c9", "c10"]): classroom(i, rid, i)

# 도서실
x0 = RX[3]
for xx, k in ((x0, "shelfA"), (x0 + 2, "shelfB"), (x0 + 6, "shelfC"), (x0 + 8, "shelfA")): stamp(SP[k], xx, 1, block=(0, 2, 1, 2))
stamp(SP["frame2"], x0 + 4, 1, block=False, dx=24, dy=20)
stamp(SP["shelfB"], x0, 6, block=(0, 1, 1, 2)); stamp(SP["shelfC"], x0, 9, block=(0, 1, 1, 2))
stamp(SP["rug_r"], x0 + 4, 6, block=False); stamp(SP["table"], x0 + 5, 6, block=(0, 1, 2, 2), dx=-24)
stamp(SP["wchair1"], x0 + 4, 8, block=False, dy=-10); stamp(SP["wchair2"], x0 + 7, 8, block=False, dy=-10)
paste(SP["cs_open"], (x0 + 5) * T, 6 * T + 26); paste(SP["cs_books"], (x0 + 6) * T + 10, 6 * T + 30)
stamp(SP["sofa_b"], x0 + 7, 10, block=(0, 1, 2, 1), dy=-20); stamp(SP["plant"], x0 + 9, 7, block=(0, 2, 0, 2), dy=-20); stamp(SP["lamp"], x0 + 3, 10, block=(0, 1, 0, 1), dy=-20)
task("lib", "반납 책 꽂기", x0 + 2, 3, x0 + 2, 4); task("lib", "책상 정리", x0 + 5, 8, x0 + 5, 9)
prank("lib", "shelf", x0 + 7, 3, x0 + 7, 4); prank("lib", "books", x0 + 1, 8, x0 + 2, 8); prank("lib", "shelf", x0 + 1, 11, x0 + 2, 11)

# 과학실
x0 = RX[4]
stamp(SP["chart"], x0 + 1, 1, block=False, dy=10); stamp(SP["wmap"], x0 + 6, 1, block=False, dy=14)
stamp(SP["gboard"], x0 + 3, 2, block=(0, 1, 1, 1), dy=-20); stamp(SP["sink"], x0 + 9, 3); stamp(SP["sink"], x0 + 8, 3)
for yy in (6, 9): stamp(SP["cs_long"], x0 + 1, yy, block=(0, 0, 2, 1)); stamp(SP["cs_long2"], x0 + 6, yy, block=(0, 0, 2, 1))
paste(SP["globe"], (x0 + 1) * T, 6 * T - 22); paste(SP["globe2"], (x0 + 7) * T, 6 * T - 22); paste(SP["cs_laptop"], (x0 + 2) * T + 10, 9 * T - 20)
stamp(SP["cs_tall"], x0, 1, block=(0, 2, 0, 3)); stamp(SP["plant2"], x0 + 9, 10, block=(0, 1, 0, 1))
task("sci", "지구본 닦기", x0 + 1, 6, x0, 6); task("sci", "실험 도구 씻기", x0 + 8, 3, x0 + 8, 4)
prank("sci", "water", x0 + 9, 3, x0 + 9, 4); prank("sci", "chalk", x0 + 4, 2, x0 + 5, 4)

# 컴퓨터실
x0 = RX[5]
stamp(SP["cs_tvboard"], x0 + 3, 1, block=False, dy=30)
for yy in (4, 7, 10):
    stamp(SP["cs_long3"], x0 + 1, yy - 1, block=(0, 0, 2, 1)); stamp(SP["cs_long2"], x0 + 6, yy - 1, block=(0, 0, 2, 1))
    for xx in (x0 + 1, x0 + 2, x0 + 3, x0 + 6, x0 + 7, x0 + 8): paste(SP["cs_pc" if (xx + yy) % 2 else "cs_pc2"], xx * T, (yy - 1) * T - 22)
stamp(SP["cs_printer"], x0 + 9, 3, block=(0, 0, 0, 0)); stamp(SP["cs_cab2"], x0, 1, block=(0, 1, 0, 1), dy=48)
task("com", "컴퓨터 끄기", x0 + 2, 4, x0 + 2, 5); task("com", "마우스 정리", x0 + 7, 10, x0 + 7, 11)
prank("com", "toy", x0 + 9, 11, x0 + 8, 11); prank("com", "plane", x0 + 4, 7, x0 + 4, 8)

# 화장실
x0 = RX[6]
for k in range(4): stamp(SP["stall"], x0 + 1 + k * 2, 2, block=(0, 1, 0, 1), dy=-10)
for yy in (6, 8, 10): stamp(SP["sink"], x0 + 9, yy)
stamp(SP["mirror"], x0 + 9, 4, block=(0, 1, 0, 1), dy=-20); stamp(SP["tissue"], x0, 4, block=(0, 0, 0, 0))
_row = ld("new/urinal_sink_row.png")
if _row: stamp(_row, x0 + 4, 10, block=(0, 0, 1, 0))
stamp(SP["bins"], x0, 10, block=(0, 0, 1, 0), dx=0, dy=24)
task("wc", "세면대 닦기", x0 + 9, 8, x0 + 8, 8); task("wc", "휴지 채우기", x0, 4, x0 + 1, 5)
prank("wc", "water", x0 + 9, 6, x0 + 8, 6); prank("wc", "tissue", x0 + 3, 4, x0 + 3, 5); prank("wc", "water", x0 + 9, 10, x0 + 8, 10)

# 교무실 (비상벨)
x0 = RX[0]
stamp(SP["bell"], x0 + 1, 21, block=False, dy=30); stamp(SP["win_w"], x0 + 7, 21, block=False, dy=6)
stamp(SP["cs_long"], x0 + 1, 25, block=(0, 0, 2, 1)); stamp(SP["cs_long2"], x0 + 6, 25, block=(0, 0, 2, 1))
stamp(SP["cs_long3"], x0 + 1, 28, block=(0, 0, 2, 1)); stamp(SP["cs_long"], x0 + 6, 28, block=(0, 0, 2, 1))
for xx, yy, k in ((x0 + 1, 25, "cs_pc"), (x0 + 3, 25, "cs_phone"), (x0 + 7, 25, "cs_laptop"), (x0 + 2, 28, "cs_books"), (x0 + 6, 28, "cs_pc2"), (x0 + 8, 28, "cs_note")):
    paste(SP[k], xx * T, yy * T - 20)
stamp(SP["cs_printer"], x0 + 9, 23); stamp(SP["cs_shelf"], x0 + 3, 21, block=(0, 2, 0, 2)); stamp(SP["palm"], x0 + 8, 29, block=(0, 2, 1, 2), dy=-10)
stamp(SP["box2"], x0, 23, block=(0, 0, 0, 0))  # 분실물 보관함
for xx in (x0 + 1, x0 + 2, x0 + 3, x0 + 6, x0 + 7, x0 + 8): stamp(SP["cs_ochair2"], xx, 27, block=False, dy=-20)
task("staff", "출석부 갖다 놓기", x0 + 2, 25, x0 + 2, 24); task("staff", "복사지 채우기", x0 + 9, 23, x0 + 9, 24)
prank("staff", "books", x0 + 6, 28, x0 + 5, 29)

# 보건실
x0 = RX[1]
for xx in (x0 + 1, x0 + 2, x0 + 6): stamp(SP["bed"], xx, 23)
stamp(SP["sink"], x0 + 9, 23); stamp(SP["cs_cab2"], x0 + 8, 21, block=(0, 1, 0, 1), dy=48); stamp(SP["medbox"], x0 + 7, 21, block=False, dy=46)
stamp(SP["fridge1"], x0 + 9, 26, block=(0, 0, 0, 1)); stamp(SP["mirror"], x0 + 1, 21, block=False, dy=10)
stamp(SP["chair_w"], x0 + 6, 28, block=(0, 1, 0, 1)); stamp(SP["table2"], x0 + 1, 28, block=(0, 1, 3, 2), dy=-10); stamp(SP["plant"], x0 + 9, 29, block=(0, 2, 0, 2))
task("nurse", "구급상자 채우기", x0 + 7, 22, x0 + 7, 23); task("nurse", "침대 정리", x0 + 2, 24, x0 + 3, 24)
prank("nurse", "water", x0 + 9, 23, x0 + 9, 24)

# 방송실
x0 = RX[2]
stamp(SP["console"], x0 + 1, 22, block=(0, 1, 1, 1)); stamp(SP["mic"], x0 + 3, 23)
stamp(SP["cs_tv"], x0 + 8, 21, block=False, dy=46); stamp(SP["cs_shelf2"], x0 + 9, 21, block=(0, 2, 0, 2))
stamp(SP["cs_long3"], x0 + 6, 27, block=(0, 0, 2, 1)); paste(SP["cs_pc"], (x0 + 6) * T, 27 * T - 20); paste(SP["cs_pc2"], (x0 + 7) * T, 27 * T - 20)
stamp(SP["sofa_g"], x0 + 1, 29, block=(0, 1, 2, 1), dy=-10); stamp(SP["toybox"], x0 + 9, 31)
task("bcast", "방송 장비 끄기", x0 + 1, 23, x0 + 1, 24); task("bcast", "마이크 정리", x0 + 3, 23, x0 + 3, 24)
prank("bcast", "plane", x0 + 7, 27, x0 + 7, 29); prank("bcast", "toy", x0 + 9, 31, x0 + 8, 31)

# 급식실
x0 = RX[3]
stamp(SP["fridge"], x0, 21, block=(0, 2, 3, 2), dy=48); stamp(SP["sink"], x0 + 6, 23); stamp(SP["sink"], x0 + 7, 23); stamp(SP["rack"], x0 + 9, 22, block=(0, 1, 0, 2))
for xx, yy in ((x0 + 1, 26), (x0 + 6, 26), (x0 + 1, 29), (x0 + 6, 29)): stamp(SP["table2"], xx, yy, block=(0, 1, 3, 2), dy=-24)
task("cafe", "수저통 채우기", x0 + 1, 24, x0 + 1, 25); task("cafe", "식탁 닦기", x0 + 7, 28, x0 + 5, 28)
prank("cafe", "water", x0 + 7, 23, x0 + 8, 24)

# 미술실
x0 = RX[4]
stamp(SP["frame1"], x0 + 1, 21, block=False, dy=22); stamp(SP["frame2"], x0 + 3, 21, block=False, dy=22); stamp(SP["frame3"], x0 + 9, 21, block=False, dy=22)
stamp(SP["easel"], x0 + 1, 23, block=(0, 1, 0, 1), dy=-10); stamp(SP["easel"], x0 + 3, 23, block=(0, 1, 0, 1), dy=-10); stamp(SP["sink"], x0 + 9, 23)
stamp(SP["cs_long2"], x0 + 1, 27, block=(0, 0, 2, 1)); stamp(SP["cs_long3"], x0 + 6, 27, block=(0, 0, 2, 1))
paste(SP["paint"], (x0 + 1) * T, 27 * T - 18); paste(SP["paint"], (x0 + 7) * T, 27 * T - 18)
stamp(SP["cs_shelf2"], x0 + 7, 21, block=(0, 2, 0, 2)); stamp(SP["box2"], x0, 31); stamp(SP["plant2"], x0 + 9, 30, block=(0, 1, 0, 1))
task("art", "물감 정리", x0 + 1, 27, x0 + 1, 26); task("art", "그림 걸기", x0 + 9, 22, x0 + 8, 23)
prank("art", "water", x0 + 9, 23, x0 + 9, 24); prank("art", "toy", x0, 31, x0 + 1, 31)

# 음악실
x0 = RX[5]
stamp(SP["piano"], x0 + 1, 23, block=(0, 0, 1, 1)); stamp(SP["stool"], x0 + 1, 25, block=False, dx=24, dy=-6)
stamp(SP["keys"], x0 + 5, 23, block=(0, 0, 2, 1)); stamp(SP["rug_g"], x0 + 3, 27, block=False)
for xx in (x0 + 3, x0 + 4, x0 + 5, x0 + 6): stamp(SP["cs_chair"], xx, 29, block=False, dy=-10)
stamp(SP["cs_shelf"], x0 + 9, 21, block=(0, 2, 0, 2)); stamp(SP["toybox"], x0, 31)
task("music", "악보 나눠 주기", x0 + 1, 23, x0 + 1, 25); task("music", "의자 정리", x0 + 5, 29, x0 + 5, 30)
prank("music", "toy", x0, 31, x0 + 1, 31); prank("music", "plane", x0 + 8, 28, x0 + 8, 29)

# 시청각실
x0 = RX[6]
stamp(SP["screen"], x0 + 3, 21, block=False, dx=-24, dy=14); stamp(SP["projector"], x0 + 4, 26, block=(0, 0, 0, 0), dx=24)
for yy in (24, 27, 30):
    for xx in (x0 + 1, x0 + 2, x0 + 3, x0 + 6, x0 + 7, x0 + 8): stamp(SP["cs_chair2"], xx, yy, block=False, dy=-12)
stamp(SP["cs_cab2"], x0 + 9, 21, block=(0, 1, 0, 1), dy=48)
task("av", "스크린 내리기", x0 + 4, 22, x0 + 4, 23); task("av", "의자 줄 맞추기", x0 + 2, 27, x0 + 2, 28)
prank("av", "plane", x0 + 7, 27, x0 + 7, 28); prank("av", "chalk", x0 + 6, 22, x0 + 6, 23)

# 체육관
x0 = GX0; d = ImageDraw.Draw(img)
lc = (250, 250, 250, 230)
d.rectangle(((x0 + 1) * T, 4 * T, (x0 + GW - 1) * T, 31 * T), outline=lc, width=6)
d.line(((x0 + 1) * T, 17.5 * T, (x0 + GW - 1) * T, 17.5 * T), fill=lc, width=6)
cx, cy = (x0 + GW / 2) * T, 17.5 * T; d.ellipse((cx - 2.2 * T, cy - 2.2 * T, cx + 2.2 * T, cy + 2.2 * T), outline=lc, width=6)
d.arc((cx - 4 * T, 4 * T - 4 * T, cx + 4 * T, 4 * T + 4 * T), 0, 180, fill=lc, width=5)
d.arc((cx - 4 * T, 31 * T - 4 * T, cx + 4 * T, 31 * T + 4 * T), 180, 360, fill=lc, width=5)
stamp(SP["hoop"], x0 + 8, 3, block=(0, 1, 1, 1)); stamp(SP["hoop"].transpose(Image.FLIP_TOP_BOTTOM), x0 + 8, 29, block=(0, 0, 1, 0))
for yy in (6, 8, 10): stamp(SP["mat"], x0, yy, block=(0, 0, 1, 0))
stamp(SP["ballcart"], x0 + 16, 6); stamp(SP["ballcart"], x0 + 17, 6); stamp(SP["rack"], x0 + 17, 26, block=(0, 1, 0, 2))
stamp(SP["mat"], x0 + 15, 29, block=(0, 0, 1, 0)); stamp(SP["trophy"], x0 + 13, 1, block=(0, 1, 1, 1))
stamp(SP["cs_tvboard"], x0 + 2, 1, block=False, dy=30)
task("gym", "공 정리하기", x0 + 16, 6, x0 + 16, 7); task("gym", "매트 정리", x0, 8, x0 + 2, 8); task("gym", "줄넘기 정리", x0 + 17, 27, x0 + 16, 27)
prank("gym", "balls", x0 + 17, 6, x0 + 17, 7); prank("gym", "toy", x0 + 15, 29, x0 + 14, 29); prank("gym", "balls", x0 + 3, 20, x0 + 3, 21)

# 복도 벽: 사물함·열린 문·트로피·게시판·실내화장·차단기
fy = COR["face"]
special = {(1, "r"): "trophy", (2, "r"): "board", (3, "l"): "cubbies", (3, "r"): "breaker", (5, "r"): "board"}
for i in range(NSLOT):
    x0 = RX[i]
    for side, xs in (("l", (x0 + 1, x0 + 2)), ("r", (x0 + 7, x0 + 8))):
        sp = special.get((i, side))
        if sp: stamp(SP[sp], xs[0], fy, block=False, dy=(20 if sp == "board" else 0))
        else:
            for xx in xs: stamp(SP["locker"], xx, fy, block=False)
    stamp(SP["door_open"], x0 + 3, fy, block=False)
for i in range(NSLOT): stamp(SP["door_open"], RX[i] + 6, 21, block=False)
stamp(SP["plant"], 1, 15, block=(0, 2, 0, 2), dy=-48)
stamp(SP["bench"], 20, 18, block=(0, 0, 2, 0), dy=-10); stamp(SP["bench"], 52, 18, block=(0, 0, 2, 0), dy=-10)
stamp(SP["bins"], 64, 19, block=(0, 0, 1, 0)); stamp(SP["sink"], 33, 15); stamp(SP["sink"], 67, 15); stamp(SP["plant2"], 75, 15, block=(0, 1, 0, 1), dy=-48)
task("hw", "트로피 닦기", RX[1] + 7, 14, RX[1] + 7, 15); task("hw", "사물함 정리", RX[0] + 8, 14, RX[0] + 8, 15)
task("he", "분리수거 하기", 64, 19, 64, 18); task("hw", "실내화 정리", RX[3] + 1, 14, RX[3] + 2, 15)
task("hw", "게시판 붙이기", RX[2] + 7, 14, RX[2] + 8, 15)
prank("hw", "locker", RX[0] + 2, 14, RX[0] + 2, 15); prank("hw", "locker", RX[1] + 1, 14, RX[1] + 1, 15)
prank("he", "locker", RX[4] + 8, 14, RX[4] + 8, 15); prank("he", "locker", RX[6] + 7, 14, RX[6] + 7, 15)
prank("hw", "water", 33, 15, 33, 16); prank("he", "water", 67, 15, 67, 16)
for dr in doors:
    if not dr["lock"]: continue
    x = dr["x"]; top = dr["y"] == 12
    prank("hw" if x < MID else "he", "door", x, 14 if top else 20, x, 15 if top else 19, door=dr["id"])
breaker = dict(x=RX[3] + 7, y=fy, spots=[[RX[3] + 7, 15], [RX[3] + 8, 15]])

# ---------- 점검 ----------
def area_of(x, y):
    for dr in doors:
        if [x, y] in dr["tiles"]: return dr["area"]
    for a in areas:
        if a["x0"] <= x <= a["x1"] and a["y0"] <= y <= a["y1"]: return a["id"]
for t in tasks + pranks:
    if grid[t["ay"]][t["ax"]] != ".": print("!! 막힘", t)
    if not t.get("door") and area_of(t["ax"], t["ay"]) != t["area"]: print("!! 구역", t, area_of(t["ax"], t["ay"]))
start = (38, 17); seen = {start}; q = deque([start])
while q:
    x, y = q.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and grid[ny][nx] == "." and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
for t in tasks + pranks:
    if (t["ax"], t["ay"]) not in seen: print("!! 못 감", t)
for sx, sy in breaker["spots"]:
    if (sx, sy) not in seen: print("!! 차단기 못 감")
print([(x, y) for y in range(H) for x in range(W) if grid[y][x] == "." and (x, y) not in seen])
print("tasks", len(tasks), "pranks", len(pranks), "unreached", sum(1 for y in range(H) for x in range(W) if grid[y][x] == "." and (x, y) not in seen))
bell = dict(x=RX[0] + 1, y=22, ax=RX[0] + 1, ay=23)
lostbox = dict(x=RX[0], y=23, ax=RX[0], ay=24)
spawns = [[x, y] for y in (16, 17, 18) for x in range(30, 48)]
os.makedirs(OUT, exist_ok=True)
img.save(f"{OUT}/map.png", optimize=True)
img.resize((W * 12, H * 12), Image.BOX).save(f"{OUT}/map_small.png", optimize=True)
json.dump(dict(W=W, H=H, T=T, grid=["".join(r) for r in grid], areas=areas, doors=doors, tasks=tasks, pranks=pranks, bell=bell,
               breaker=breaker, lostbox=lostbox, spawns=spawns), open(f"{OUT}/map.json", "w"), ensure_ascii=False)
print("saved", img.size)
