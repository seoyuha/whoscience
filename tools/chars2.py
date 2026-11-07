"""캐릭터 시트 만들기: 선생님 캐릭터 10명 × 옷 색 → chars.png(32줄) + looks.json(단서용 특징)"""
import colorsys, sys, glob, json
from PIL import Image
SRC = sys.argv[1]; OUT = sys.argv[2]
files = sorted(f for f in glob.glob(f"{SRC}/characters/*.png") if "_3x" not in f)

# 앞모습에서 분명히 보이는 특징만 씀 (피부색은 단서로 쓰지 않음)
FEAT = [
    dict(accs=["glasses"], hair="black"),   # 01 안경
    dict(accs=[], hair="black"),            # 02 양갈래 머리
    dict(accs=["cap"], hair="brown"),       # 03 야구 모자
    dict(accs=[], hair="brown"),            # 04 땋은 머리
    dict(accs=[], hair="brown"),            # 05 곱슬머리
    dict(accs=[], hair="black"),            # 06 옆머리
    dict(accs=["ribbon"], hair="brown"),    # 07 리본
    dict(accs=[], hair="brown"),            # 08 포니테일
    dict(accs=[], hair="black"),            # 09 물결머리
    dict(accs=["beanie"], hair="brown"),    # 10 비니
    dict(accs=["headband"], hair="black"),  # 11 머리띠
    dict(accs=["hairclip"], hair="brown"),  # 12 머리핀
    dict(accs=["glasses", "scarf"], hair="black"),  # 13 안경+목도리
    dict(accs=["bag"], hair="black"),       # 14 가방
]
HUE = {"red": (0.0, .62), "blue": (0.6, .55), "yellow": (0.13, .62), "green": (0.33, .5), "purple": (0.78, .42), "pink": (0.93, .38), "orange": (0.07, .65)}
COLORS = ["red", "blue", "yellow", "green", "purple", "pink", "orange"]

def frames(im):
    s = Image.new("RGBA", (28 * 16, 32))
    s.paste(im.crop((0, 32, 384, 64)), (0, 0)); s.paste(im.crop((0, 0, 64, 32)), (24 * 16, 0)); return s

def shirt_colors(base):
    ys = {}
    for y in range(32):
        for x in range(base.width):
            p = base.getpixel((x, y))
            if p[3]: ys.setdefault(p[:3], []).append(y)
    return {c for c, v in ys.items() if 21 <= min(v) <= 24 and max(v) <= 29}

def recolor(base, color):
    hue, sat = HUE[color]
    tgt = shirt_colors(base)
    vals = [colorsys.rgb_to_hsv(*[c / 255 for c in t])[2] for t in tgt] or [0.5]
    mv = sum(vals) / len(vals)
    im = base.copy(); px = im.load()
    for y in range(32):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and p[:3] in tgt:
                h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in p[:3]])
                nv = max(0.2, min(1, v - mv + (0.86 if color == "yellow" else 0.72)))
                r, g, b = colorsys.hsv_to_rgb(hue, sat, nv)
                px[x, y] = (int(r * 255), int(g * 255), int(b * 255), 255)
    return im

bases = [frames(Image.open(f).convert("RGBA")) for f in files]
NB = len(bases)
out = Image.new("RGBA", (28 * 16, 32 * 32)); looks = []
for k in range(32):
    b = k % NB; color = COLORS[(k * 3 + k // NB) % 7]
    # 모자 친구(03)·목도리 친구(13)는 옷 색이 모자·목도리와 섞여 옷 색 단서에서 뺌
    out.paste(recolor(bases[b], color), (0, k * 32)); looks.append(dict(base=b, shirt=None if b in (2, 12) else color, **FEAT[b]))
out.save(f"{OUT}/chars.png")
json.dump(looks, open(f"{OUT}/looks.json", "w"), ensure_ascii=False)
print(len(looks))
