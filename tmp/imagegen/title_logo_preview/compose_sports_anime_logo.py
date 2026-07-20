from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def tracking_mask(text, font_path, size, tracking):
    font = ImageFont.truetype(font_path, size)
    boxes = [font.getbbox(ch) for ch in text]
    widths = [b[2] - b[0] for b in boxes]
    h = max(b[3] - b[1] for b in boxes)
    w = sum(widths) + tracking * max(0, len(text) - 1)
    mask = Image.new("L", (w + 30, h + 30), 0)
    d = ImageDraw.Draw(mask)
    x = 15
    for ch, b, cw in zip(text, boxes, widths):
        d.text((x - b[0], 15 - b[1]), ch, font=font, fill=255)
        x += cw + tracking
    box = mask.getbbox()
    return mask.crop(box)


def shear_right(mask, amount):
    w, h = mask.size
    extra = int(amount * h) + 6
    out = mask.transform((w + extra, h), Image.Transform.AFFINE,
                         (1, amount, -amount * h, 0, 1, 0),
                         resample=Image.Resampling.BICUBIC)
    box = out.getbbox()
    return out.crop(box)


def horizontal_gradient(size, stops):
    im = Image.new("RGBA", size)
    d = ImageDraw.Draw(im)
    for x in range(size[0]):
        p = x / max(1, size[0] - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p <= p1:
                t = (p - p0) / max(1e-6, p1 - p0)
                t = max(0, min(1, t))
                c = tuple(round(c0[j] * (1 - t) + c1[j] * t) for j in range(3)) + (255,)
                d.line((x, 0, x, size[1]), fill=c)
                break
    return im


def outlined_gradient(mask, stops, dark_px, light_px, shadow_offset=(5, 7)):
    pad = dark_px + 18
    m = Image.new("L", (mask.width + pad * 2, mask.height + pad * 2), 0)
    m.paste(mask, (pad, pad))
    dark = m.filter(ImageFilter.MaxFilter(dark_px * 2 + 1))
    light = m.filter(ImageFilter.MaxFilter(light_px * 2 + 1))
    art = Image.new("RGBA", m.size, (0, 0, 0, 0))

    shadow_mask = Image.new("L", m.size, 0)
    shadow_mask.paste(dark, shadow_offset)
    shadow = Image.new("RGBA", m.size, (0, 0, 0, 0))
    shadow.paste((37, 11, 46, 205), (0, 0, m.width, m.height), shadow_mask)
    art.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(1.6)))
    art.paste((61, 20, 75, 255), (0, 0, m.width, m.height), dark)
    art.paste((255, 239, 194, 255), (0, 0, m.width, m.height), light)
    art.paste(horizontal_gradient(m.size, stops), (0, 0), m)
    return art


def draw_rabbit_mark(canvas, x, y):
    # Small original Mimi mark: asymmetric ears over a gold race-ring.
    mark = Image.new("RGBA", (112, 94), (0, 0, 0, 0))
    d = ImageDraw.Draw(mark)
    d.ellipse((15, 57, 96, 84), outline=(244, 190, 76, 255), width=7)
    d.ellipse((30, 4, 56, 70), fill=(251, 221, 183, 255), outline=(88, 30, 79, 255), width=5)
    d.ellipse((37, 13, 49, 59), fill=(236, 112, 143, 255))
    d.ellipse((59, 17, 82, 71), fill=(251, 221, 183, 255), outline=(88, 30, 79, 255), width=5)
    d.ellipse((65, 24, 76, 61), fill=(236, 112, 143, 255))
    canvas.alpha_composite(mark.rotate(-7, Image.Resampling.BICUBIC, expand=True), (x, y))


def draw_speed_ribbon(canvas, y, width):
    d = ImageDraw.Draw(canvas)
    left, right = 110, width - 105
    # Three tapered strands suggest a racecourse without forming a frame.
    d.polygon([(left, y + 18), (right - 90, y - 7), (right, y + 1), (left + 58, y + 34)],
              fill=(72, 24, 82, 230))
    d.polygon([(left + 20, y + 14), (right - 58, y - 2), (right - 16, y + 3), (left + 77, y + 25)],
              fill=(231, 164, 61, 245))
    d.polygon([(left + 42, y + 14), (right - 40, y + 2), (right - 12, y + 6), (left + 94, y + 20)],
              fill=(226, 91, 128, 235))
    # A tiny checker break at the finish end.
    cell = 10
    bx, by = right - 85, y - 6
    for row in range(2):
        for col in range(5):
            if (row + col) % 2 == 0:
                d.rectangle((bx + col * cell, by + row * cell,
                             bx + (col + 1) * cell, by + (row + 1) * cell),
                            fill=(255, 245, 210, 245))


def build_logo():
    canvas = Image.new("RGBA", (1340, 500), (0, 0, 0, 0))

    main_mask = shear_right(tracking_mask("ドラゴンレース", FONT_BOLD, 151, -7), 0.105)
    main = outlined_gradient(
        main_mask,
        [(0.0, (250, 195, 48)), (0.46, (239, 126, 73)), (1.0, (206, 67, 137))],
        dark_px=13,
        light_px=6,
    )
    main = main.rotate(-1.4, Image.Resampling.BICUBIC, expand=True)
    canvas.alpha_composite(main, (round((canvas.width - main.width) / 2 + 18), 120))

    draw_rabbit_mark(canvas, 78, 39)
    d = ImageDraw.Draw(canvas)
    owner_font = ImageFont.truetype(FONT_BOLD, 52)
    d.text((205, 90), "ミミの", font=owner_font, anchor="lm",
           fill=(255, 230, 190, 255), stroke_width=5, stroke_fill=(79, 25, 75, 255))

    draw_speed_ribbon(canvas, 316, canvas.width)

    island_mask = shear_right(tracking_mask("アイランド", FONT_BOLD, 86, 4), 0.08)
    island = outlined_gradient(
        island_mask,
        [(0.0, (255, 244, 214)), (0.55, (235, 195, 123)), (1.0, (213, 139, 179))],
        dark_px=10,
        light_px=4,
        shadow_offset=(4, 6),
    )
    canvas.alpha_composite(island, (round((canvas.width - island.width) / 2), 351))

    # Three small stars support the lively sports-anime rhythm; no dragon illustration.
    for x, y, r, color in [(1108, 76, 9, (245, 112, 151, 245)),
                           (1154, 103, 6, (246, 193, 65, 240)),
                           (1192, 69, 5, (255, 240, 207, 235))]:
        d.polygon([(x, y-r), (x+r//3, y-r//3), (x+r, y), (x+r//3, y+r//3),
                   (x, y+r), (x-r//3, y+r//3), (x-r, y), (x-r//3, y-r//3)], fill=color)

    box = canvas.getbbox()
    logo = canvas.crop((box[0] - 22, box[1] - 16, box[2] + 22, box[3] + 18))
    logo.save(OUT / "title_logo_h_sports_anime.png")
    return logo


def mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    haze = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze)
    hd.ellipse((98, 60, 755, 410), fill=(10, 6, 20, 92))
    haze = haze.filter(ImageFilter.GaussianBlur(48))
    bg = Image.alpha_composite(bg, haze)

    target_w = 625
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 92
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    sf = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    sy = y + target_h + 20
    for i, line in enumerate(lines):
        d.text((bg.width / 2, sy + i * 22), line, font=sf, anchor="mm",
               fill=(246, 231, 208, 255), stroke_width=2, stroke_fill=(20, 11, 25, 235))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SUB, 24)
    d.text((bg.width / 2, btn_y + 36), "島へ向かう", font=bf, anchor="mm",
           fill=(255, 244, 211, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_h_sports_anime.jpg", quality=95)


if __name__ == "__main__":
    mockup(build_logo())
