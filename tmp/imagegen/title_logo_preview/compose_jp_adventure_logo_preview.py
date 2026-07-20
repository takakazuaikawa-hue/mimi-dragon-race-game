from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def fit(text, max_width, start, path=FONT):
    size = start
    while size > 12:
        font = ImageFont.truetype(path, size)
        box = font.getbbox(text)
        if box[2] - box[0] <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(path, 12)


def centered(draw, pos, text, font, **kwargs):
    draw.text(pos, text, font=font, anchor="mm", **kwargs)


def anime_text(target, text, center, font, fill, inner, outer, stroke=8):
    x, y = center
    shadow = Image.new("RGBA", target.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    centered(sd, (x + 5, y + 8), text, font,
             fill=outer, stroke_width=stroke + 6, stroke_fill=(54, 22, 61, 220))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.5))
    target.alpha_composite(shadow)

    td = ImageDraw.Draw(target)
    centered(td, (x, y), text, font,
             fill=fill, stroke_width=stroke + 3, stroke_fill=outer)
    centered(td, (x, y - 1), text, font,
             fill=fill, stroke_width=max(2, stroke // 2), stroke_fill=inner)


def build_logo():
    base = Image.open(OUT / "logo_base_d.png").convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    mimi_font = fit("MIMI'S", w * 0.24, int(h * 0.055))
    centered(d, (w * 0.38, h * 0.315), "MIMI'S", mimi_font,
             fill=(250, 111, 154, 255), stroke_width=max(2, h // 260),
             stroke_fill=(255, 248, 210, 255))

    dragon_race = fit("DRAGON RACE", w * 0.66, int(h * 0.118))
    island = fit("ISLAND", w * 0.42, int(h * 0.145))
    anime_text(layer, "DRAGON RACE", (w * 0.49, h * 0.420), dragon_race,
               (245, 118, 82, 255), (255, 248, 215, 255), (103, 53, 84, 255), max(5, h // 130))
    anime_text(layer, "ISLAND", (w * 0.49, h * 0.555), island,
               (92, 142, 72, 255), (255, 247, 209, 255), (83, 48, 76, 255), max(5, h // 130))

    # One racing accent only, preserving the DRAGON RACE / ISLAND hierarchy.
    y = int(h * 0.625)
    d.line((w * 0.36, y, w * 0.62, y), fill=(244, 133, 92, 235), width=max(3, h // 220))
    d.polygon([(w * 0.635, y), (w * 0.613, y - 10), (w * 0.613, y + 10)], fill=(248, 103, 151, 245))

    logo = Image.alpha_composite(base, layer)
    logo.save(OUT / "title_logo_d_jp_adventure.png")
    return logo


def mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    shade = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(0, 570):
        alpha = int(95 * (1 - y / 570) + 12)
        sd.line((0, y, bg.width, y), fill=(9, 7, 19, alpha))
    bg = Image.alpha_composite(bg, shade)

    target_w = 540
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 70
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    sf = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    box_w, box_h = 570, 62
    bx = (bg.width - box_w) // 2
    by = y + target_h - 8
    d.rounded_rectangle((bx, by, bx + box_w, by + box_h), radius=15,
                        fill=(25, 16, 29, 180), outline=(238, 176, 95, 190), width=2)
    for i, line in enumerate(lines):
        centered(d, (bg.width / 2, by + 19 + i * 22), line, sf,
                 fill=(255, 241, 214, 255), stroke_width=1,
                 stroke_fill=(45, 22, 40, 255))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SUB, 24)
    centered(d, (bg.width / 2, btn_y + 36), "島へ向かう", bf, fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_d_jp_adventure.jpg", quality=95)


if __name__ == "__main__":
    mockup(build_logo())
