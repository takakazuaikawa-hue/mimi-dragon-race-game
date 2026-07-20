from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_TITLE = r"C:\Windows\Fonts\NotoSerifJP-VF.ttf"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def dilate(mask, px):
    return mask.filter(ImageFilter.MaxFilter(px * 2 + 1))


def text_mask(text, size, tracking=0):
    font = ImageFont.truetype(FONT_TITLE, size)
    widths = []
    boxes = []
    for ch in text:
        box = font.getbbox(ch)
        boxes.append(box)
        widths.append(box[2] - box[0])
    height = max(box[3] - box[1] for box in boxes)
    width = sum(widths) + tracking * max(0, len(text) - 1)
    mask = Image.new("L", (width + 30, height + 30), 0)
    d = ImageDraw.Draw(mask)
    x = 15
    for ch, box, cw in zip(text, boxes, widths):
        d.text((x - box[0], 15 - box[1]), ch, font=font, fill=255)
        x += cw + tracking
    bbox = mask.getbbox()
    return mask.crop(bbox) if bbox else mask


def gradient_image(size, top, bottom):
    im = Image.new("RGBA", size)
    d = ImageDraw.Draw(im)
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        col = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        d.line((0, y, size[0], y), fill=col)
    return im


def glyph_art(ch, size, rotation=0, race_accent=False):
    # First glyph uses ト; its dakuten is redrawn as two rabbit-ear marks later.
    mask = text_mask(ch, size)
    pad = 26
    padded = Image.new("L", (mask.width + pad * 2, mask.height + pad * 2), 0)
    padded.paste(mask, (pad, pad))
    mask = padded
    if rotation:
        mask = mask.rotate(rotation, Image.Resampling.BICUBIC, expand=True)

    outer = dilate(mask, 11)
    gold = dilate(mask, 5)
    art = Image.new("RGBA", mask.size, (0, 0, 0, 0))

    shadow_mask = Image.new("L", mask.size, 0)
    shadow_mask.paste(outer, (3, 7))
    shadow = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    shadow.paste((28, 7, 30, 220), (0, 0, mask.width, mask.height), shadow_mask)
    art.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(1.5)))
    art.paste((64, 19, 61, 255), (0, 0, mask.width, mask.height), outer)
    art.paste((238, 175, 70, 255), (0, 0, mask.width, mask.height), gold)
    if race_accent:
        grad = gradient_image(mask.size, (255, 231, 184), (221, 101, 80))
    else:
        grad = gradient_image(mask.size, (255, 249, 221), (223, 153, 54))
    art.paste(grad, (0, 0), mask)
    return art


def draw_ear_dakuten(layer, x, y):
    # Two tiny ear-shaped marks replace the normal dakuten of the first ド.
    ear = Image.new("RGBA", (28, 54), (0, 0, 0, 0))
    d = ImageDraw.Draw(ear)
    d.ellipse((4, 2, 24, 52), fill=(242, 178, 69, 255), outline=(72, 22, 67, 255), width=4)
    d.ellipse((9, 9, 19, 44), fill=(238, 117, 139, 255))
    layer.alpha_composite(ear.rotate(-24, Image.Resampling.BICUBIC, expand=True), (x, y))
    layer.alpha_composite(ear.rotate(-8, Image.Resampling.BICUBIC, expand=True), (x + 31, y - 8))


def crop_dragon_head():
    source = Image.open(OUT / "logo_base_e.png").convert("RGBA")
    w, h = source.size
    crop = source.crop((int(w * 0.735), int(h * 0.265), int(w * 0.985), int(h * 0.655)))
    box = crop.getbbox()
    if box:
        crop = crop.crop(box)
    target_w = 178
    target_h = round(crop.height * target_w / crop.width)
    return crop.resize((target_w, target_h), Image.Resampling.LANCZOS)


def build_logo():
    canvas = Image.new("RGBA", (1600, 610), (0, 0, 0, 0))
    main_y = 205
    x = 205
    chars = ["ト", "ラ", "ゴ", "ン", "レ", None, "ス"]
    rotations = [-1.5, 0.8, -0.7, 1.0, -0.8, 0, 0.6]
    advances = [143, 145, 147, 143, 145, 154, 143]

    first_x = x
    for i, (ch, rot, advance) in enumerate(zip(chars, rotations, advances)):
        if ch is None:
            # The long vowel mark becomes a race-course stroke and remains part of レース.
            d = ImageDraw.Draw(canvas)
            cy = main_y + 75
            d.line((x + 8, cy + 7, x + 143, cy - 6), fill=(55, 16, 57, 255), width=25)
            d.line((x + 8, cy + 4, x + 143, cy - 9), fill=(239, 178, 70, 255), width=13)
            d.line((x + 15, cy + 1, x + 139, cy - 11), fill=(236, 114, 105, 255), width=5)
            d.polygon([(x + 148, cy - 10), (x + 128, cy - 22), (x + 131, cy + 2)],
                      fill=(245, 200, 90, 255))
        else:
            art = glyph_art(ch, 150, rot, race_accent=(i >= 4))
            canvas.alpha_composite(art, (round(x - 20), main_y - 18))
        x += advance

    draw_ear_dakuten(canvas, first_x + 91, main_y - 49)

    # Small dragon head grows out of the terminal stroke of ス; it is the only illustration.
    head = crop_dragon_head()
    canvas.alpha_composite(head, (1265, main_y + 3))

    # Small owner line, deliberately quiet.
    d = ImageDraw.Draw(canvas)
    mimi_font = ImageFont.truetype(FONT_TITLE, 62)
    d.text((760, 84), "ミミの", font=mimi_font, anchor="mm",
           fill=(247, 139, 165, 255), stroke_width=3, stroke_fill=(244, 190, 83, 255))

    island_mask = text_mask("アイランド", 142, tracking=12)
    pad = 26
    m = Image.new("L", (island_mask.width + pad * 2, island_mask.height + pad * 2), 0)
    m.paste(island_mask, (pad, pad))
    outer = dilate(m, 10)
    gold = dilate(m, 4)
    island = Image.new("RGBA", m.size, (0, 0, 0, 0))
    island.paste((55, 16, 55, 255), (0, 0, m.width, m.height), outer)
    island.paste((235, 174, 73, 255), (0, 0, m.width, m.height), gold)
    island.paste(gradient_image(m.size, (255, 247, 218), (222, 149, 50)), (0, 0), m)
    canvas.alpha_composite(island, (round(760 - island.width / 2), 386))

    # Stable island baseline; no extra scenery symbols.
    d = ImageDraw.Draw(canvas)
    d.line((535, 548, 985, 548), fill=(64, 18, 60, 255), width=12)
    d.line((545, 545, 975, 545), fill=(231, 169, 66, 255), width=5)
    d.ellipse((752, 536, 768, 552), fill=(235, 105, 139, 255), outline=(255, 227, 153, 255), width=2)

    bbox = canvas.getbbox()
    logo = canvas.crop((bbox[0] - 22, bbox[1] - 22, bbox[2] + 22, bbox[3] + 22))
    logo.save(OUT / "title_logo_f_wordmark_first.png")
    return logo


def make_mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    # Local readability haze only; the background remains visible.
    haze = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze)
    hd.ellipse((112, 70, 741, 425), fill=(11, 7, 20, 95))
    haze = haze.filter(ImageFilter.GaussianBlur(48))
    bg = Image.alpha_composite(bg, haze)

    target_w = 620
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 92
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    sf = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    sy = y + target_h + 14
    for i, line in enumerate(lines):
        d.text((bg.width / 2, sy + i * 22), line, font=sf, anchor="mm",
               fill=(246, 231, 208, 255), stroke_width=2, stroke_fill=(20, 11, 25, 235))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SUB, 24)
    d.text((bg.width / 2, btn_y + 36), "島へ向かう", font=bf, anchor="mm",
           fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_f_wordmark_first.jpg", quality=95)


if __name__ == "__main__":
    make_mockup(build_logo())
