# 인트로 영상의 영어 로고를 한글 간판으로 바꿔 그리기 (원래 로고가 나오고 사라지는 박자에 맞춤)
import sys, glob, math, random, os
from PIL import Image, ImageDraw, ImageEnhance
sys.path.insert(0, os.path.dirname(__file__)); import sign
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
SG = sign.make(); FPS = 24
CX, CY = 410 + SG.width // 2, 52 + SG.height // 2
fs = sorted(glob.glob(src + "/*.png"))
rnd = random.Random(7)
burst = [(rnd.uniform(0, 6.283), rnd.uniform(140, 420), rnd.choice([(255, 210, 90), (255, 150, 70), (120, 220, 230), (255, 255, 255)]), rnd.uniform(3, 7), rnd.uniform(-60, 60)) for _ in range(90)]
twinkle = [(-215, -70, 0.0), (225, -78, 0.9), (-232, 40, 1.7), (238, 52, 2.4), (-120, -92, 3.1), (140, 92, 0.5)]
def star(d, x, y, r, a, col=(255, 236, 140)):
    pts = []
    for k in range(8):
        rr = r if k % 2 == 0 else r * 0.28; ang = k * math.pi / 4 - math.pi / 2
        pts.append((x + rr * math.cos(ang), y + rr * math.sin(ang)))
    d.polygon(pts, fill=col + (int(255 * a),))
def place(fr, scale, alpha, bright=1.0):
    s = SG
    if scale != 1: s = SG.resize((max(1, int(SG.width * scale)), max(1, int(SG.height * scale))), Image.LANCZOS)
    if bright != 1: s = Image.merge("RGBA", (*ImageEnhance.Brightness(s.convert("RGB")).enhance(bright).split(), s.split()[3]))
    if alpha < 1: s.putalpha(s.split()[3].point(lambda v: int(v * alpha)))
    fr.alpha_composite(s, (CX - s.width // 2, CY - s.height // 2))
for i, f in enumerate(fs):
    t = i / FPS
    fr = Image.open(f).convert("RGBA")
    ov = Image.new("RGBA", fr.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    shown = False
    if t < 1.92:                         # 처음: 그대로 보이기
        place(fr, 1, 1); shown = True
    elif t < 2.16:                       # 반짝 가루가 되어 사라지기
        k = (t - 1.92) / 0.24
        place(fr, 1 + 0.06 * k, 1 - k, 1 + 0.6 * k)
        for ang, sp, col, r, vy in burst:
            dist = sp * k; x = CX + math.cos(ang) * dist * 1.2; y = CY + math.sin(ang) * dist * 0.55 + vy * k
            star(d, x, y, r * (1 - 0.5 * k), 1 - k, col)
    elif t >= 7.88:                      # 끝: 톡 튀어나오기
        k = (t - 7.88) / 0.30
        if k < 1: sc = 0.42 + 0.68 * k
        else: sc = 1.0 + 0.10 * math.exp(-(t - 8.18) * 9) * math.cos((t - 8.18) * 22)
        a = min(1, (t - 7.88) / 0.05)
        br = 1 + 0.7 * max(0, 1 - abs(t - 8.30) / 0.10)   # 원래 영상의 하얀 번쩍임에 맞춤
        place(fr, sc, a, br); shown = t > 8.05
    if shown:                            # 간판 둘레 반짝이
        for dx, dy, ph in twinkle:
            a = 0.5 + 0.5 * math.sin(t * 5 + ph * 2)
            star(d, CX + dx, CY + dy, 9 + 6 * a, 0.35 + 0.65 * a)
    fr.alpha_composite(ov)
    fr.convert("RGB").save(f"{out}/{i + 1:03d}.png")
print("frames", len(fs))
