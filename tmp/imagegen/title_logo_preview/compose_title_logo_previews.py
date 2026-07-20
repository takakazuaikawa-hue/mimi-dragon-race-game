from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_BOLD = r"C:\Windows\Fonts\NotoSerifJP-VF.ttf"
FONT_SANS = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
TITLE = ("ドラゴンレース", "アイランド")
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def font_fit(text, path, max_width, start, minimum=12):
    size = start
    while size >= minimum:
        font = ImageFont.truetype(path, size)
        box = font.getbbox(text, stroke_width=0)
        if box[2] - box[0] <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(path, minimum)


def centered_xy(draw, text, font, cx, y, stroke=0):
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    return int(cx - (box[2] - box[0]) / 2), int(y - box[1])


def gradient_text(layer, text, font, cx, y, max_width, top, bottom, stroke_width):
    draw = ImageDraw.Draw(layer)
    font = font_fit(text, FONT_BOLD, max_width, font.size, 24)
    x, yy = centered_xy(draw, text, font, cx, y, stroke_width)
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((x + 3, yy + 8), text, font=font, fill=(42, 12, 48, 255),
            stroke_width=stroke_width + 6, stroke_fill=(24, 5, 28, 235))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.0))
    layer.alpha_composite(shadow)

    outline = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    od.text((x, yy), text, font=font, fill=(64, 23, 79, 255),
            stroke_width=stroke_width, stroke_fill=(255, 203, 77, 255))
    layer.alpha_composite(outline)

    mask = Image.new("L", layer.size, 0)
    md = ImageDraw.Draw(mask)
    md.text((x, yy), text, font=font, fill=255)
    grad = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    gp = grad.load()
    y0 = max(0, yy)
    y1 = min(layer.height, yy + font.size + 12)
    for gy in range(y0, y1):
        t = (gy - y0) / max(1, y1 - y0 - 1)
        col = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for gx in range(max(0, int(x)), min(layer.width, int(x + max_width + 80))):
            gp[gx, gy] = col
    layer.alpha_composite(Image.composite(grad, Image.new("RGBA", layer.size), mask))
    return font


def replace_paw_with_compass(img):
    # The generated B draft accidentally produced a paw. Replace only that medallion
    # with a simple island compass gem; the rabbit ears themselves remain the Mimi cue.
    d = ImageDraw.Draw(img)
    cx, cy = round(img.width * 0.50), round(img.height * 0.277)
    r = round(img.height * 0.058)
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(43, 18, 67, 255),
              outline=(255, 205, 76, 255), width=max(5, r // 10))
    outer = [(cx, cy-r+10), (cx+r-10, cy), (cx, cy+r-10), (cx-r+10, cy)]
    inner = [(cx, cy-r//2), (cx+r//2, cy), (cx, cy+r//2), (cx-r//2, cy)]
    d.polygon(outer, fill=(255, 198, 62, 255), outline=(92, 38, 92, 255))
    d.polygon(inner, fill=(245, 91, 145, 255), outline=(255, 241, 194, 255))
    d.ellipse((cx-r//7, cy-r//7, cx+r//7, cy+r//7), fill=(255, 239, 172, 255))


def build_logo(key):
    base = Image.open(OUT / f"logo_base_{key}.png").convert("RGBA")
    if key == "b":
        replace_paw_with_compass(base)
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    if key == "a":
        mimi_y, line1_y, line2_y = h * 0.345, h * 0.405, h * 0.515
        max1, max2 = w * 0.53, w * 0.47
        size1, size2 = int(h * 0.105), int(h * 0.132)
    else:
        mimi_y, line1_y, line2_y = h * 0.355, h * 0.425, h * 0.545
        max1, max2 = w * 0.56, w * 0.45
        size1, size2 = int(h * 0.126), int(h * 0.155)

    mimi = "ミミの"
    mf = font_fit(mimi, FONT_BOLD, w * 0.28, int(h * 0.055), 24)
    mx, my = centered_xy(d, mimi, mf, w / 2, mimi_y, 4)
    d.text((mx + 2, my + 4), mimi, font=mf, fill=(58, 13, 50, 255), stroke_width=7, stroke_fill=(35, 5, 30, 220))
    d.text((mx, my), mimi, font=mf, fill=(255, 135, 176, 255), stroke_width=3, stroke_fill=(255, 219, 125, 255))

    f1 = ImageFont.truetype(FONT_BOLD, size1)
    f2 = ImageFont.truetype(FONT_BOLD, size2)
    gradient_text(layer, TITLE[0], f1, w / 2, line1_y, max1,
                  (255, 255, 226), (239, 148, 28), max(5, h // 110))
    gradient_text(layer, TITLE[1], f2, w / 2, line2_y, max2,
                  (255, 245, 188), (255, 126, 43), max(5, h // 110))

    out = Image.alpha_composite(base, layer)
    out.save(OUT / f"title_logo_{key}.png")
    return out


def wrap_chars(text, max_chars):
    return [text[i:i+max_chars] for i in range(0, len(text), max_chars)]


def mockup(logo, key):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    scrim = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for y in range(0, 620):
        alpha = int(115 * (1 - y / 620) + 18)
        sd.line((0, y, bg.width, y), fill=(8, 5, 20, alpha))
    bg = Image.alpha_composite(bg, scrim)

    target_w = 500 if key == "a" else 515
    target_h = round(logo.height * target_w / logo.width)
    logo_small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 74 if key == "a" else 92
    bg.alpha_composite(logo_small, (x, y))

    d = ImageDraw.Draw(bg)
    # Subtitle stays a designed companion line so it remains readable on the real screen.
    lines = wrap_chars(SUBTITLE, 29)
    sf = ImageFont.truetype(FONT_SANS, 17)
    line_h = 24
    box_w = 590
    box_h = 24 + line_h * len(lines)
    box_x = (bg.width - box_w) // 2
    box_y = y + target_h - 5
    d.rounded_rectangle((box_x, box_y, box_x + box_w, box_y + box_h), radius=18,
                        fill=(13, 8, 28, 205), outline=(240, 186, 71, 210), width=2)
    for i, line in enumerate(lines):
        tx, ty = centered_xy(d, line, sf, bg.width / 2, box_y + 10 + i * line_h, 0)
        d.text((tx, ty), line, font=sf, fill=(255, 239, 204, 255),
               stroke_width=1, stroke_fill=(45, 16, 50, 255))

    # Minimal CTA context, only to judge title-screen balance.
    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SANS, 24)
    bx, by = centered_xy(d, "島へ向かう", bf, bg.width / 2, btn_y + 21, 0)
    d.text((bx, by), "島へ向かう", font=bf, fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / f"title_screen_mockup_{key}.jpg", quality=94)
    return bg


def comparison(a, b):
    # Present at approximate phone-screen scale side by side.
    thumbs = []
    for im in (a, b):
        tw = 426
        th = round(im.height * tw / im.width)
        thumbs.append(im.resize((tw, th), Image.Resampling.LANCZOS))
    canvas = Image.new("RGB", (930, 720), (18, 14, 27))
    d = ImageDraw.Draw(canvas)
    label_font = ImageFont.truetype(FONT_SANS, 26)
    d.text((214, 24), "A：世界観重視", font=label_font, fill=(255, 224, 154), anchor="mm")
    d.text((716, 24), "B：小表示・レース感重視", font=label_font, fill=(255, 224, 154), anchor="mm")
    canvas.paste(thumbs[0].convert("RGB"), (36, 52))
    canvas.paste(thumbs[1].convert("RGB"), (468, 52))
    canvas.save(OUT / "title_logo_comparison.jpg", quality=94)


if __name__ == "__main__":
    logo_a = build_logo("a")
    logo_b = build_logo("b")
    screen_a = mockup(logo_a, "a")
    screen_b = mockup(logo_b, "b")
    comparison(screen_a, screen_b)
