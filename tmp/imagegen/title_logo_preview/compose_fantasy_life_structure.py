from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import math


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_LATIN = r"C:\Windows\Fonts\ariblk.ttf"
FONT_JP_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_JP = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"

OWNER = "\u30df\u30df\u306e"
SUBTITLE = (
    "\u8ee2\u751f\u3057\u305f\u3089\u30d0\u30cb\u30fc\u30ac\u30fc\u30eb\u3060\u3063\u305f\u79c1\u306e\u6c4e\u7528\u30b9\u30ad\u30eb"
    "\u300a\u3071\u307b\u3071\u307b\u300b\u3060\u3051\u304c\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u306a\u4ef6"
)


def vertical_gradient(size, top, bottom):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        draw.line((0, y, size[0], y), fill=color)
    return image


def glyph_mask(char, font, pad=30):
    box = font.getbbox(char, stroke_width=0)
    w, h = box[2] - box[0], box[3] - box[1]
    mask = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    draw = ImageDraw.Draw(mask)
    draw.text((pad - box[0], pad - box[1]), char, font=font, fill=255)
    crop = mask.getbbox()
    return mask.crop(crop)


def style_mask(mask, fill_top, fill_bottom, dark=(45, 25, 50), key=(255, 247, 220), outer=12, inner=5):
    pad = outer + 24
    base = Image.new("L", (mask.width + pad * 2, mask.height + pad * 2), 0)
    base.paste(mask, (pad, pad))
    dark_mask = base.filter(ImageFilter.MaxFilter(outer * 2 + 1))
    key_mask = base.filter(ImageFilter.MaxFilter(inner * 2 + 1))

    art = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow = Image.new("L", base.size, 0)
    shadow.paste(dark_mask, (5, 8))
    art.paste((18, 12, 27, 145), (0, 0, base.width, base.height), shadow.filter(ImageFilter.GaussianBlur(3)))
    art.paste(dark + (255,), (0, 0, base.width, base.height), dark_mask)
    art.paste(key + (255,), (0, 0, base.width, base.height), key_mask)
    art.paste(vertical_gradient(base.size, fill_top, fill_bottom), (0, 0), base)

    # A narrow internal highlight keeps the wordmark bright at title-screen scale.
    edge = ImageChops.subtract(base, base.filter(ImageFilter.MinFilter(5)))
    art.paste((255, 255, 238, 130), (0, 0, base.width, base.height), edge)
    return art


def render_word(canvas, text, center_x, y, size, tracking, palette, rotations, offsets, target_width=None):
    font = ImageFont.truetype(FONT_LATIN, size)
    glyphs = []
    widths = []
    for i, ch in enumerate(text):
        if ch == " ":
            glyphs.append(None)
            widths.append(round(size * 0.34))
            continue
        mask = glyph_mask(ch, font)
        top, bottom = palette[i % len(palette)]
        art = style_mask(mask, top, bottom)
        angle = rotations[i % len(rotations)]
        art = art.rotate(angle, Image.Resampling.BICUBIC, expand=True)
        glyphs.append(art)
        widths.append(art.width)

    total = sum(widths) + tracking * (len(text) - 1)
    scale = min(1.0, target_width / total) if target_width else 1.0
    if scale < 1:
        resized = []
        widths = []
        for art in glyphs:
            if art is None:
                resized.append(None)
                widths.append(round(size * 0.34 * scale))
            else:
                art = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
                resized.append(art)
                widths.append(art.width)
        glyphs = resized
        tracking = round(tracking * scale)
        total = sum(widths) + tracking * (len(text) - 1)

    x = round(center_x - total / 2)
    for i, art in enumerate(glyphs):
        if art is not None:
            canvas.alpha_composite(art, (x, y + offsets[i % len(offsets)]))
        x += widths[i] + tracking


def draw_island_emblem(canvas):
    """One quiet backplate: a race loop around an island peak."""
    emblem = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(emblem)
    cx, cy = 750, 310

    # Layered diamond suggests an island map/compass, not a separate illustration.
    outer = [(cx, 72), (cx + 280, cy), (cx, 624), (cx - 280, cy)]
    inner = [(cx, 100), (cx + 246, cy), (cx, 588), (cx - 246, cy)]
    d.polygon(outer, fill=(246, 238, 207, 185))
    d.polygon(inner, fill=(24, 68, 75, 205), outline=(236, 179, 60, 220), width=8)

    # A single mountain/island silhouette with a looped race route.
    d.polygon([(534, 350), (650, 205), (720, 278), (801, 157), (974, 350)], fill=(16, 42, 55, 245))
    d.line([(535, 387), (646, 426), (790, 402), (965, 456)], fill=(246, 196, 66, 240), width=14, joint="curve")
    d.line([(535, 387), (646, 426), (790, 402), (965, 456)], fill=(255, 244, 203, 230), width=5, joint="curve")

    # Two short rabbit-ear strokes quietly identify Mimi.
    d.arc((698, 90, 747, 212), 176, 355, fill=(244, 230, 201, 235), width=12)
    d.arc((754, 99, 807, 212), 184, 359, fill=(244, 230, 201, 235), width=12)
    emblem = emblem.filter(ImageFilter.GaussianBlur(0.35))
    canvas.alpha_composite(emblem)


def fit_japanese(text, max_width, start_size):
    for size in range(start_size, 9, -1):
        font = ImageFont.truetype(FONT_JP, size)
        if font.getlength(text) <= max_width:
            return font
    return ImageFont.truetype(FONT_JP, 10)


def draw_subtitle_ribbon(canvas, y):
    d = ImageDraw.Draw(canvas)
    cx = canvas.width // 2
    left, right = 235, canvas.width - 235
    top, bottom = y, y + 92

    # Slightly irregular parchment ribbon; compact enough not to become a UI panel.
    d.polygon([(left, top + 16), (left - 58, top + 32), (left - 18, top + 51),
               (left - 52, bottom - 10), (left + 20, bottom - 20)], fill=(64, 29, 65, 245))
    d.polygon([(right, top + 16), (right + 58, top + 32), (right + 18, top + 51),
               (right + 52, bottom - 10), (right - 20, bottom - 20)], fill=(64, 29, 65, 245))
    d.rounded_rectangle((left, top, right, bottom), radius=35,
                        fill=(251, 242, 218, 250), outline=(50, 25, 56, 255), width=8)
    d.rounded_rectangle((left + 11, top + 10, right - 11, bottom - 10), radius=27,
                        outline=(221, 158, 55, 255), width=3)

    line1 = SUBTITLE[:28]
    line2 = SUBTITLE[28:]
    font = fit_japanese(line1, right - left - 70, 30)
    font2 = fit_japanese(line2, right - left - 70, 30)
    d.text((cx, top + 30), line1, font=font, anchor="mm", fill=(55, 30, 55, 255))
    d.text((cx, top + 62), line2, font=font2, anchor="mm", fill=(55, 30, 55, 255))


def build_logo():
    OUT.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (1500, 790), (0, 0, 0, 0))
    draw_island_emblem(canvas)
    d = ImageDraw.Draw(canvas)

    owner_font = ImageFont.truetype(FONT_JP_BOLD, 74)
    d.text((750, 122), OWNER, font=owner_font, anchor="mm",
           fill=(251, 220, 148, 255), stroke_width=8, stroke_fill=(53, 25, 57, 255))
    # Small red ribbon strokes keep Mimi's existing accessory colors in the mark.
    d.line((608, 123, 655, 123), fill=(213, 87, 77, 255), width=9)
    d.line((845, 123, 892, 123), fill=(213, 87, 77, 255), width=9)

    gold = [((255, 241, 116), (236, 148, 22)), ((255, 249, 173), (226, 124, 27))]
    green = [((163, 219, 123), (43, 128, 91)), ((235, 220, 98), (58, 141, 91))]
    render_word(canvas, "DRAGON RACE", 750, 170, 178, -24, gold,
                [-2.5, 1.2, -1.2, 2.0, -1.1, 1.1, 0, -1.5, 1.8, -1.0, 1.2],
                [7, 0, 6, -1, 5, 0, 2, 7, 0, 5, -1], target_width=1290)
    render_word(canvas, "ISLAND", 750, 355, 230, -28, green,
                [1.5, -1.3, 1.0, -1.8, 1.5, -0.8], [2, 9, 0, 8, 1, 6], target_width=1000)

    # Small finish spark: one racing cue, kept subordinate to the title.
    d = ImageDraw.Draw(canvas)
    sx, sy = 1248, 446
    d.polygon([(sx, sy - 24), (sx + 7, sy - 7), (sx + 25, sy), (sx + 7, sy + 7),
               (sx, sy + 25), (sx - 7, sy + 7), (sx - 24, sy), (sx - 7, sy - 7)],
              fill=(255, 236, 143, 255), outline=(56, 27, 57, 255))

    draw_subtitle_ribbon(canvas, 650)
    box = canvas.getbbox()
    logo = canvas.crop((max(0, box[0] - 18), max(0, box[1] - 16),
                        min(canvas.width, box[2] + 18), min(canvas.height, box[3] + 10)))
    logo_path = OUT / "title_logo_i_fantasy_life_structure.png"
    logo.save(logo_path)
    return logo


def build_mockup(logo):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")

    # Local contrast only; keep the painted title background intact.
    veil = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    vd.ellipse((65, 30, 790, 475), fill=(10, 11, 25, 80))
    veil = veil.filter(ImageFilter.GaussianBlur(55))
    bg = Image.alpha_composite(bg, veil)

    target_w = 690
    target_h = round(logo.height * target_w / logo.width)
    logo_small = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    bg.alpha_composite(logo_small, ((bg.width - target_w) // 2, 58))

    # Only a neutral start prompt is mocked; no implementation is changed.
    d = ImageDraw.Draw(bg)
    prompt_font = ImageFont.truetype(FONT_JP_BOLD, 23)
    d.rounded_rectangle((260, 1124, 593, 1180), radius=24,
                        fill=(29, 19, 37, 208), outline=(235, 181, 64, 220), width=3)
    d.text((426, 1152), "\u5cf6\u3078\u5411\u304b\u3046", font=prompt_font, anchor="mm",
           fill=(255, 243, 208, 255))
    mockup_path = OUT / "title_screen_mockup_i_fantasy_life_structure.jpg"
    bg.convert("RGB").save(mockup_path, quality=95)


if __name__ == "__main__":
    build_mockup(build_logo())
