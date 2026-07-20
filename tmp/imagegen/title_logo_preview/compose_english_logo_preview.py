from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_TITLE = r"C:\Windows\Fonts\georgiab.ttf"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def fit_font(text, path, max_width, size, minimum=12):
    while size >= minimum:
        font = ImageFont.truetype(path, size)
        box = font.getbbox(text)
        if box[2] - box[0] <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(path, minimum)


def draw_centered(draw, xy, text, font, **kwargs):
    draw.text(xy, text, font=font, anchor="mm", **kwargs)


def draw_gold_text(img, text, center, font, stroke):
    x, y = center
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    draw_centered(sd, (x + 5, y + 9), text, font,
                  fill=(34, 8, 43, 255), stroke_width=stroke + 5,
                  stroke_fill=(20, 3, 24, 235))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.2))
    img.alpha_composite(shadow)

    text_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    draw_centered(td, (x, y), text, font,
                  fill=(255, 205, 73, 255), stroke_width=stroke,
                  stroke_fill=(72, 24, 86, 255))
    # A slim ivory highlight gives the flat wordmark a polished logo finish.
    draw_centered(td, (x, y - 2), text, font,
                  fill=(255, 222, 103, 255), stroke_width=max(1, stroke // 3),
                  stroke_fill=(255, 240, 177, 210))
    img.alpha_composite(text_layer)


def build_logo():
    base = Image.open(OUT / "logo_base_c.png").convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    cx = w * 0.435
    mimi = ImageFont.truetype(FONT_TITLE, int(h * 0.060))
    draw_centered(d, (cx, h * 0.285), "MIMI'S", mimi,
                  fill=(255, 133, 173, 255), stroke_width=max(2, h // 260),
                  stroke_fill=(255, 218, 112, 255))

    dragon = fit_font("DRAGON", FONT_TITLE, w * 0.48, int(h * 0.155), 48)
    race = fit_font("RACE ISLAND", FONT_TITLE, w * 0.50, int(h * 0.100), 36)
    draw_gold_text(layer, "DRAGON", (cx, h * 0.405), dragon, max(5, h // 120))
    draw_gold_text(layer, "RACE ISLAND", (cx, h * 0.535), race, max(4, h // 150))

    # Minimal racing underline; no additional scenery or filigree.
    line_y = int(h * 0.600)
    line_w = int(w * 0.30)
    d.line((cx - line_w / 2, line_y, cx + line_w / 2, line_y),
           fill=(255, 199, 63, 235), width=max(3, h // 210))
    d.polygon([(cx + line_w / 2 + 24, line_y),
               (cx + line_w / 2 - 2, line_y - 12),
               (cx + line_w / 2 - 2, line_y + 12)],
              fill=(246, 92, 145, 245))

    out = Image.alpha_composite(base, layer)
    out.save(OUT / "title_logo_c_english.png")
    return out


def make_mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    shade = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(0, 560):
        alpha = int(106 * (1 - y / 560) + 12)
        sd.line((0, y, bg.width, y), fill=(7, 5, 18, alpha))
    bg = Image.alpha_composite(bg, shade)

    target_w = 500
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 92
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    font = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    box_w, box_h = 560, 64
    box_x = (bg.width - box_w) // 2
    box_y = y + target_h - 6
    d.rounded_rectangle((box_x, box_y, box_x + box_w, box_y + box_h), radius=15,
                        fill=(11, 7, 25, 190), outline=(230, 177, 64, 190), width=2)
    for i, line in enumerate(lines):
        draw_centered(d, (bg.width / 2, box_y + 20 + i * 22), line, font,
                      fill=(255, 239, 207, 255), stroke_width=1,
                      stroke_fill=(38, 12, 46, 255))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    btn_font = ImageFont.truetype(FONT_SUB, 24)
    draw_centered(d, (bg.width / 2, btn_y + 36), "島へ向かう", btn_font,
                  fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_c_english.jpg", quality=95)


if __name__ == "__main__":
    make_mockup(build_logo())
