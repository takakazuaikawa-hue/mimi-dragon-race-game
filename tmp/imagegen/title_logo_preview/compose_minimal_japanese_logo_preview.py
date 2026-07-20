from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_TITLE = r"C:\Windows\Fonts\NotoSerifJP-VF.ttf"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def fit(text, path, max_width, start, minimum=14):
    size = start
    while size >= minimum:
        font = ImageFont.truetype(path, size)
        box = font.getbbox(text)
        if box[2] - box[0] <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(path, minimum)


def center_text(draw, pos, text, font, **kwargs):
    draw.text(pos, text, font=font, anchor="mm", **kwargs)


def refined_gold_text(layer, text, pos, font, stroke):
    x, y = pos
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    center_text(sd, (x + 3, y + 7), text, font,
                fill=(30, 9, 31, 245), stroke_width=stroke + 5,
                stroke_fill=(17, 4, 19, 220))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.0))
    layer.alpha_composite(shadow)

    d = ImageDraw.Draw(layer)
    center_text(d, (x, y), text, font,
                fill=(244, 171, 52, 255), stroke_width=stroke + 3,
                stroke_fill=(75, 27, 67, 255))
    center_text(d, (x, y - 2), text, font,
                fill=(255, 220, 126, 255), stroke_width=max(2, stroke // 2),
                stroke_fill=(255, 243, 196, 225))


def build_logo():
    base = Image.open(OUT / "logo_base_e.png").convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = w * 0.485

    mimi_font = fit("ミミの", FONT_TITLE, w * 0.23, int(h * 0.060))
    center_text(d, (cx, h * 0.355), "ミミの", mimi_font,
                fill=(255, 133, 170, 255), stroke_width=max(2, h // 260),
                stroke_fill=(255, 225, 150, 255))

    line1 = fit("ドラゴンレース", FONT_TITLE, w * 0.55, int(h * 0.120), 40)
    line2 = fit("アイランド", FONT_TITLE, w * 0.42, int(h * 0.145), 42)
    refined_gold_text(layer, "ドラゴンレース", (cx, h * 0.465), line1, max(5, h // 130))
    refined_gold_text(layer, "アイランド", (cx, h * 0.600), line2, max(5, h // 130))

    # A single coral racing dash is enough; no additional island/location icons.
    y = int(h * 0.682)
    d.line((w * 0.365, y, w * 0.600, y), fill=(230, 119, 109, 220), width=max(3, h // 220))
    d.polygon([(w * 0.617, y), (w * 0.595, y - 10), (w * 0.595, y + 10)],
              fill=(242, 102, 145, 235))

    logo = Image.alpha_composite(base, layer)
    logo.save(OUT / "title_logo_e_minimal_japanese.png")
    return logo


def mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    shade = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(0, 530):
        alpha = int(72 * (1 - y / 530) + 8)
        sd.line((0, y, bg.width, y), fill=(8, 5, 17, alpha))
    bg = Image.alpha_composite(bg, shade)

    target_w = 505
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 82
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    sf = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    sub_y = y + target_h + 5
    d.line((245, sub_y - 8, 608, sub_y - 8), fill=(222, 165, 78, 170), width=1)
    for i, line in enumerate(lines):
        center_text(d, (bg.width / 2, sub_y + i * 22), line, sf,
                    fill=(246, 231, 208, 255), stroke_width=2,
                    stroke_fill=(20, 11, 25, 235))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SUB, 24)
    center_text(d, (bg.width / 2, btn_y + 36), "島へ向かう", bf,
                fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_e_minimal_japanese.jpg", quality=95)


if __name__ == "__main__":
    mockup(build_logo())
