from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_TITLE = r"C:\Windows\Fonts\yumindb.ttf"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def tracking_mask(text, size, tracking):
    font = ImageFont.truetype(FONT_TITLE, size)
    boxes = [font.getbbox(ch) for ch in text]
    widths = [b[2] - b[0] for b in boxes]
    h = max(b[3] - b[1] for b in boxes)
    w = sum(widths) + tracking * (len(text) - 1)
    mask = Image.new("L", (w + 30, h + 30), 0)
    d = ImageDraw.Draw(mask)
    x = 15
    for ch, box, cw in zip(text, boxes, widths):
        d.text((x - box[0], 15 - box[1]), ch, font=font, fill=255)
        x += cw + tracking
    box = mask.getbbox()
    return mask.crop(box)


def shear(mask, amount):
    w, h = mask.size
    extra = int(amount * h) + 4
    out = mask.transform((w + extra, h), Image.Transform.AFFINE,
                         (1, amount, -amount * h, 0, 1, 0),
                         resample=Image.Resampling.BICUBIC)
    box = out.getbbox()
    return out.crop(box)


def gradient(size, top, bottom):
    im = Image.new("RGBA", size)
    d = ImageDraw.Draw(im)
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        d.line((0, y, size[0], y), fill=color)
    return im


def style(mask, outer_px=9):
    pad = 24
    m = Image.new("L", (mask.width + pad * 2, mask.height + pad * 2), 0)
    m.paste(mask, (pad, pad))
    outer = m.filter(ImageFilter.MaxFilter(outer_px * 2 + 1))
    keyline = m.filter(ImageFilter.MaxFilter(5 * 2 + 1))
    art = Image.new("RGBA", m.size, (0, 0, 0, 0))
    # Crisp shadow, no glow and no cartoon extrusion.
    shadow = Image.new("L", m.size, 0)
    shadow.paste(outer, (3, 5))
    art.paste((24, 8, 26, 205), (0, 0, m.width, m.height), shadow)
    art.paste((53, 18, 52, 255), (0, 0, m.width, m.height), outer)
    art.paste((229, 166, 67, 255), (0, 0, m.width, m.height), keyline)
    art.paste(gradient(m.size, (255, 249, 222), (222, 150, 49)), (0, 0), m)
    return art


def build_logo():
    canvas = Image.new("RGBA", (1320, 470), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    cx = canvas.width / 2

    mimi_font = ImageFont.truetype(FONT_TITLE, 55)
    d.text((cx, 48), "ミミの", font=mimi_font, anchor="mm",
           fill=(244, 138, 164, 255), stroke_width=2, stroke_fill=(235, 178, 77, 255))

    main = style(shear(tracking_mask("ドラゴンレース", 126, 0), 0.035), 9)
    canvas.alpha_composite(main, (round(cx - main.width / 2), 86))

    # A quiet separator makes DRAGON RACE and ISLAND distinct without adding an icon.
    y = 245
    d.line((cx - 205, y, cx - 20, y), fill=(213, 151, 60, 210), width=3)
    d.line((cx + 20, y, cx + 205, y), fill=(213, 151, 60, 210), width=3)
    d.polygon([(cx, y - 8), (cx + 8, y), (cx, y + 8), (cx - 8, y)],
              fill=(234, 111, 142, 245), outline=(255, 224, 151, 255))

    island = style(tracking_mask("アイランド", 145, 13), 9)
    canvas.alpha_composite(island, (round(cx - island.width / 2), 264))

    box = canvas.getbbox()
    logo = canvas.crop((box[0] - 20, box[1] - 16, box[2] + 20, box[3] + 18))
    logo.save(OUT / "title_logo_g_clean_typographic.png")
    return logo


def mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    haze = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze)
    hd.ellipse((120, 80, 733, 390), fill=(8, 5, 16, 82))
    haze = haze.filter(ImageFilter.GaussianBlur(45))
    bg = Image.alpha_composite(bg, haze)

    target_w = 560
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 112
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    sf = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    sy = y + target_h + 21
    for i, line in enumerate(lines):
        d.text((bg.width / 2, sy + i * 22), line, font=sf, anchor="mm",
               fill=(246, 231, 208, 255), stroke_width=2, stroke_fill=(20, 11, 25, 235))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SUB, 24)
    d.text((bg.width / 2, btn_y + 36), "島へ向かう", font=bf, anchor="mm",
           fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_g_clean_typographic.jpg", quality=95)


if __name__ == "__main__":
    mockup(build_logo())
