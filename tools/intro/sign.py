# 한글 제목 간판 그리기 (영어 로고 'Who did it? - Banwol Detectives' 를 덮는 판)
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S = 3                      # 3배로 그린 뒤 줄여서 매끈하게
W, H = 470, 182            # 최종 크기 (영어 로고 상자 440~860 x 70~222 를 넉넉히 덮음)
BLK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
def font(px):
    for i in range(10):
        f = ImageFont.truetype(BLK, px * S, index=i)
        if "KR" in f.getname()[0]: return f
    return ImageFont.truetype(BLK, px * S)
INK = (59, 42, 74, 255)
def vgrad(w, h, top, bot):
    g = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / max(1, h - 1); d.line([(0, y), (w, y)], fill=tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3)) + (255,))
    return g
def word_layer(txt, f, top, bot, stroke):
    l, t, r, b = f.getbbox(txt, stroke_width=stroke)
    w, h = r - l + 2, b - t + 2
    m = Image.new("L", (w, h)); ImageDraw.Draw(m).text((-l + 1, -t + 1), txt, font=f, fill=255)
    out = Image.new("RGBA", (w, h))
    od = ImageDraw.Draw(out); od.text((-l + 1, -t + 1), txt, font=f, fill=INK, stroke_width=stroke, stroke_fill=INK)
    out.paste(vgrad(w, h, top, bot), (0, 0), m)
    # 위쪽 반짝 하이라이트
    hl = Image.new("L", (w, h)); ImageDraw.Draw(hl).rectangle([0, 0, w, int(h * 0.42)], fill=70)
    hl = Image.composite(hl, Image.new("L", (w, h)), m)
    out.paste((255, 255, 255, 255), (0, 0), hl)
    return out, (l, t)

def make():
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 그림자 + 종이 판
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([14 * S, 16 * S, (W - 4) * S, (H - 2) * S], 26 * S, fill=(40, 25, 40, 110))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5 * S)))
    d.rounded_rectangle([6 * S, 6 * S, (W - 10) * S, (H - 12) * S], 24 * S, fill=(255, 248, 226, 255), outline=INK, width=5 * S)
    d.rounded_rectangle([16 * S, 16 * S, (W - 20) * S, (H - 22) * S], 16 * S, outline=(232, 205, 160, 255), width=2 * S)
    # 테이프 두 장
    for cx, ang, col in [(70, 18, (255, 214, 102, 210)), (W - 80, -16, (140, 210, 235, 210))]:
        tp = Image.new("RGBA", (78 * S, 26 * S), col)
        tp = tp.rotate(ang, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(tp, (cx * S - tp.width // 2, 0))
    # 제목: 누가 · 그런 · 거지?  (원래 로고처럼 낱말마다 색)
    f = font(62); st = 7 * S
    words = [("누가", (255, 226, 92), (255, 128, 58)), ("그런", (120, 226, 230), (52, 132, 222)), ("거지?", (255, 210, 90), (246, 98, 82))]
    gap = 10 * S
    layers = [word_layer(w, f, a, b, st) for w, a, b in words]
    total = sum(L.width for L, _ in layers) + gap * (len(layers) - 1)
    x = (W * S - total) // 2; base_y = 30 * S
    for L, _ in layers:
        sh = Image.new("RGBA", L.size, (0, 0, 0, 0)); sh.paste((40, 20, 50, 150), (0, 0), L.split()[3])
        im.alpha_composite(sh, (x + 4 * S, base_y + 5 * S)); im.alpha_composite(L, (x, base_y)); x += L.width + gap
    # 부제 띠
    f2 = font(23); sub = "반월 과학 탐정단"
    l, t, r, b = f2.getbbox(sub)
    pw, ph = r - l + 70 * S, 40 * S
    px, py = (W * S - pw) // 2, (H - 66) * S
    d.rounded_rectangle([px, py, px + pw, py + ph], ph // 2, fill=(70, 120, 210, 255), outline=INK, width=4 * S)
    d.text((px + pw // 2, py + ph // 2 + 1 * S), sub, font=f2, fill=(255, 255, 255, 255), anchor="mm", stroke_width=2 * S, stroke_fill=(40, 70, 140, 255))
    for sx in (px + 18 * S, px + pw - 18 * S):  # 양쪽 돋보기 점
        d.ellipse([sx - 6 * S, py + ph // 2 - 6 * S, sx + 6 * S, py + ph // 2 + 6 * S], fill=(255, 226, 92, 255), outline=INK, width=2 * S)
    return im.resize((W, H), Image.LANCZOS)

if __name__ == "__main__":
    make().save(sys.argv[1])
