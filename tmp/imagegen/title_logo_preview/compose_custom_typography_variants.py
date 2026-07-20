from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_SANS = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_SERIF = r"C:\Windows\Fonts\NotoSerifJP-VF.ttf"
FONT_SUB = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
SUBTITLE = "転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件"


def render_tracking(text, font_path, size, tracking=0):
    font = ImageFont.truetype(font_path, size)
    boxes = [font.getbbox(ch) for ch in text]
    widths = [b[2] - b[0] for b in boxes]
    asc = max((b[3] - b[1] for b in boxes), default=size)
    width = max(1, sum(widths) + tracking * max(0, len(text) - 1))
    mask = Image.new("L", (width + 12, asc + 12), 0)
    d = ImageDraw.Draw(mask)
    x = 6
    for ch, b, cw in zip(text, boxes, widths):
        d.text((x - b[0], 6 - b[1]), ch, font=font, fill=255)
        x += cw + tracking
    box = mask.getbbox()
    return mask.crop(box) if box else mask


def shear_right(mask, amount):
    if not amount:
        return mask
    w, h = mask.size
    extra = int(abs(amount) * h) + 4
    out = mask.transform((w + extra, h), Image.Transform.AFFINE,
                         (1, amount, -amount * h, 0, 1, 0),
                         resample=Image.Resampling.BICUBIC)
    box = out.getbbox()
    return out.crop(box) if box else out


def add_padding(mask, pad=34):
    out = Image.new("L", (mask.width + pad * 2, mask.height + pad * 2), 0)
    out.paste(mask, (pad, pad))
    return out


def add_speed_cuts(mask, cuts):
    out = mask.copy()
    d = ImageDraw.Draw(out)
    w, h = out.size
    for frac, yfrac in cuts:
        x = int(w * frac)
        y = int(h * yfrac)
        d.polygon([(x - 18, y - 4), (x + 32, y - 17),
                   (x + 39, y - 7), (x - 12, y + 7)], fill=0)
    return out


def gradient(size, top, bottom):
    im = Image.new("RGBA", size)
    px = im.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        col = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for x in range(size[0]):
            px[x, y] = col
    return im


def styled(mask, top, bottom, inner, outer, outer_px=12, shadow=(40, 8, 42, 235)):
    mask = add_padding(mask, max(34, outer_px + 18))
    inner_mask = mask.filter(ImageFilter.MaxFilter(outer_px // 2 * 2 + 1))
    outer_mask = mask.filter(ImageFilter.MaxFilter(outer_px * 2 + 1))
    layer = Image.new("RGBA", mask.size, (0, 0, 0, 0))

    sh = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    shifted = Image.new("L", mask.size, 0)
    shifted.paste(outer_mask, (5, 9))
    sh.paste(shadow, (0, 0, mask.width, mask.height), shifted)
    sh = sh.filter(ImageFilter.GaussianBlur(2.2))
    layer.alpha_composite(sh)
    layer.paste(outer, (0, 0, mask.width, mask.height), outer_mask)
    layer.paste(inner, (0, 0, mask.width, mask.height), inner_mask)
    layer.paste(gradient(mask.size, top, bottom), (0, 0), mask)
    return layer, mask


def paste_center(canvas, art, cx, cy):
    x = round(cx - art.width / 2)
    y = round(cy - art.height / 2)
    canvas.alpha_composite(art, (x, y))
    return x, y


def draw_mimi(layer, cx, y, kind):
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(FONT_SERIF if kind == "b" else FONT_SANS, 54)
    if kind == "a":
        fill, outline = (255, 128, 164, 255), (255, 224, 148, 255)
    elif kind == "b":
        fill, outline = (255, 175, 191, 255), (244, 193, 80, 255)
    else:
        fill, outline = (249, 135, 164, 255), (255, 231, 169, 255)
    d.text((cx, y), "ミミの", font=font, anchor="mm", fill=fill,
           stroke_width=4, stroke_fill=outline)


def build_variant(kind):
    base = Image.open(OUT / "logo_base_e.png").convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    cx = w * 0.485
    draw_mimi(layer, cx, h * 0.352, kind)

    if kind == "a":
        # Racing: italicized glyphs, deliberate speed cuts, warmer race color.
        main_mask = render_tracking("ドラゴンレース", FONT_SANS, 116, -3)
        main_mask = shear_right(main_mask, 0.12)
        main_mask = add_speed_cuts(main_mask, [(0.26, 0.49), (0.63, 0.57), (0.82, 0.42)])
        main, _ = styled(main_mask, (255, 244, 194), (236, 112, 55),
                         (255, 225, 140, 255), (83, 24, 72, 255), 12)
        island_mask = shear_right(render_tracking("アイランド", FONT_SANS, 142, 4), 0.05)
        island, _ = styled(island_mask, (255, 235, 174), (238, 164, 58),
                           (255, 244, 205, 255), (76, 24, 70, 255), 12)
        paste_center(layer, main, cx, h * 0.470)
        paste_center(layer, island, cx, h * 0.612)
        d = ImageDraw.Draw(layer)
        for i, length in enumerate((260, 205, 145)):
            yy = int(h * 0.688 + i * 11)
            d.line((cx - length / 2, yy, cx + length / 2, yy),
                   fill=(236, 111, 97, 210 - i * 40), width=5 - i)

    elif kind == "b":
        # Fantasy: Japanese serif construction and restrained scale glints.
        main_mask = render_tracking("ドラゴンレース", FONT_SERIF, 116, 1)
        main, main_alpha = styled(main_mask, (255, 246, 209), (218, 142, 44),
                                  (255, 223, 135, 255), (69, 19, 63, 255), 13)
        pattern = Image.new("RGBA", main.size, (0, 0, 0, 0))
        md = ImageDraw.Draw(pattern)
        for x in range(110, main.width - 80, 115):
            md.arc((x, main.height * 0.48, x + 52, main.height * 0.82), 205, 335,
                   fill=(255, 246, 203, 115), width=3)
        pattern.putalpha(ImageChops.multiply(pattern.getchannel("A"), main_alpha))
        main.alpha_composite(pattern)
        island_mask = render_tracking("アイランド", FONT_SERIF, 146, 5)
        island, _ = styled(island_mask, (255, 230, 166), (229, 151, 43),
                           (255, 245, 211, 255), (67, 20, 62, 255), 13)
        paste_center(layer, main, cx, h * 0.470)
        paste_center(layer, island, cx, h * 0.612)

    else:
        # Balanced: the sport remains one phrase, with RACE accented but not separated.
        left_mask = shear_right(render_tracking("ドラゴン", FONT_SANS, 116, -1), 0.055)
        right_mask = shear_right(render_tracking("レース", FONT_SANS, 116, -1), 0.055)
        left, _ = styled(left_mask, (255, 244, 196), (226, 151, 43),
                         (255, 228, 154, 255), (75, 24, 69, 255), 11)
        right, _ = styled(right_mask, (255, 212, 176), (229, 102, 76),
                          (255, 235, 194, 255), (75, 24, 69, 255), 11)
        gap = 2
        combined_w = left.width + right.width + gap
        combined = Image.new("RGBA", (combined_w, max(left.height, right.height)), (0, 0, 0, 0))
        combined.alpha_composite(left, (0, combined.height - left.height))
        combined.alpha_composite(right, (left.width + gap, combined.height - right.height))
        island_mask = render_tracking("アイランド", FONT_SANS, 144, 7)
        island, _ = styled(island_mask, (255, 244, 205), (235, 169, 62),
                           (255, 236, 176, 255), (72, 23, 66, 255), 12)
        paste_center(layer, combined, cx, h * 0.470)
        paste_center(layer, island, cx, h * 0.612)
        d = ImageDraw.Draw(layer)
        y = int(h * 0.690)
        d.line((cx - 190, y, cx + 190, y), fill=(222, 159, 65, 220), width=4)
        d.ellipse((cx - 9, y - 9, cx + 9, y + 9), fill=(240, 108, 143, 245),
                  outline=(255, 229, 157, 255), width=3)

    logo = Image.alpha_composite(base, layer)
    logo.save(OUT / f"title_logo_typography_{kind}.png")
    return logo


def mockup(logo, kind):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")
    shade = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(0, 530):
        alpha = int(72 * (1 - y / 530) + 8)
        sd.line((0, y, bg.width, y), fill=(8, 5, 17, alpha))
    bg = Image.alpha_composite(bg, shade)

    target_w = 515
    target_h = round(logo.height * target_w / logo.width)
    small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = (bg.width - target_w) // 2
    y = 78
    bg.alpha_composite(small, (x, y))

    d = ImageDraw.Draw(bg)
    sf = ImageFont.truetype(FONT_SUB, 15)
    lines = [SUBTITLE[:31], SUBTITLE[31:]]
    sy = y + target_h + 5
    d.line((245, sy - 8, 608, sy - 8), fill=(222, 165, 78, 170), width=1)
    for i, line in enumerate(lines):
        d.text((bg.width / 2, sy + i * 22), line, font=sf, anchor="mm",
               fill=(246, 231, 208, 255), stroke_width=2,
               stroke_fill=(20, 11, 25, 235))

    btn_y = 1120
    d.rounded_rectangle((224, btn_y, 629, btn_y + 72), radius=24,
                        fill=(87, 34, 110, 230), outline=(255, 205, 76, 230), width=3)
    bf = ImageFont.truetype(FONT_SUB, 24)
    d.text((bg.width / 2, btn_y + 36), "島へ向かう", font=bf, anchor="mm",
           fill=(255, 244, 211, 255))
    path = OUT / f"title_screen_typography_{kind}.jpg"
    bg.convert("RGB").save(path, quality=95)
    return bg


def comparison(screens):
    thumb_w = 384
    thumb_h = round(1280 * thumb_w / 853)
    margin, gap, top = 28, 22, 66
    canvas = Image.new("RGB", (margin * 2 + thumb_w * 3 + gap * 2, top + thumb_h + 28), (17, 13, 24))
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT_SUB, 23)
    labels = ["A  疾走感", "B  幻想感", "C  均衡（推奨）"]
    for i, (screen, label) in enumerate(zip(screens, labels)):
        x = margin + i * (thumb_w + gap)
        d.text((x + thumb_w / 2, 31), label, font=font, anchor="mm", fill=(255, 225, 162))
        thumb = screen.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS).convert("RGB")
        canvas.paste(thumb, (x, top))
    canvas.save(OUT / "title_typography_comparison.jpg", quality=95)


if __name__ == "__main__":
    screens = []
    for key in ("a", "b", "c"):
        screens.append(mockup(build_variant(key), key))
    comparison(screens)
