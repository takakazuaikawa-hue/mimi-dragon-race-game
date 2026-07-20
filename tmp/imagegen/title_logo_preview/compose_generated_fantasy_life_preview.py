from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
FONT_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
SUBTITLE = (
    "\u8ee2\u751f\u3057\u305f\u3089\u30d0\u30cb\u30fc\u30ac\u30fc\u30eb\u3060\u3063\u305f\u79c1\u306e\u6c4e\u7528\u30b9\u30ad\u30eb"
    "\u300a\u3071\u307b\u3071\u307b\u300b\u3060\u3051\u304c\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u306a\u4ef6"
)


def crop_alpha(image):
    box = image.getchannel("A").getbbox()
    return image.crop(box)


def fit_font(text, max_width, start):
    for size in range(start, 9, -1):
        font = ImageFont.truetype(FONT, size)
        if font.getlength(text) <= max_width:
            return font
    return ImageFont.truetype(FONT, 10)


def subtitle_plate(width=1320, height=118):
    plate = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(plate)
    left, right = 62, width - 62
    d.rounded_rectangle((left, 5, right, height - 6), radius=42,
                        fill=(246, 233, 202, 248), outline=(68, 29, 63, 255), width=10)
    d.rounded_rectangle((left + 13, 17, right - 13, height - 18), radius=32,
                        outline=(220, 150, 49, 255), width=4)

    # A single coral leaf at each end echoes Mimi's hair ornament without adding scenery.
    d.polygon([(44, 58), (8, 28), (54, 39), (77, 58), (54, 77), (8, 88)],
              fill=(189, 70, 64, 255), outline=(68, 29, 63, 255))
    d.polygon([(width - 44, 58), (width - 8, 28), (width - 54, 39),
               (width - 77, 58), (width - 54, 77), (width - 8, 88)],
              fill=(189, 70, 64, 255), outline=(68, 29, 63, 255))

    line1 = SUBTITLE[:28]
    line2 = SUBTITLE[28:]
    f1 = fit_font(line1, right - left - 95, 30)
    f2 = fit_font(line2, right - left - 95, 30)
    d.text((width / 2, 39), line1, font=f1, anchor="mm", fill=(63, 34, 56, 255))
    d.text((width / 2, 76), line2, font=f2, anchor="mm", fill=(63, 34, 56, 255))
    return plate


def build_lockup():
    logo = crop_alpha(Image.open(OUT / "title_logo_j_generated_transparent.png").convert("RGBA"))
    target_w = 1320
    target_h = round(logo.height * target_w / logo.width)
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    plate = subtitle_plate(target_w, 118)
    canvas = Image.new("RGBA", (target_w, target_h + 126), (0, 0, 0, 0))
    canvas.alpha_composite(logo, (0, 0))
    canvas.alpha_composite(plate, (0, target_h + 2))
    path = OUT / "title_logo_j_fantasy_life_direction.png"
    canvas.save(path)
    return canvas


def build_mockup(lockup):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")

    veil = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    vd.ellipse((35, 8, 818, 475), fill=(17, 8, 25, 86))
    veil = veil.filter(ImageFilter.GaussianBlur(52))
    bg = Image.alpha_composite(bg, veil)

    target_w = 770
    target_h = round(lockup.height * target_w / lockup.width)
    small = lockup.resize((target_w, target_h), Image.Resampling.LANCZOS)
    bg.alpha_composite(small, ((bg.width - target_w) // 2, 48))

    d = ImageDraw.Draw(bg)
    prompt_font = ImageFont.truetype(FONT_BOLD, 23)
    d.rounded_rectangle((260, 1124, 593, 1180), radius=24,
                        fill=(45, 21, 47, 220), outline=(239, 182, 55, 230), width=3)
    d.text((426, 1152), "\u5cf6\u3078\u5411\u304b\u3046", font=prompt_font, anchor="mm",
           fill=(255, 243, 208, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_j_fantasy_life_direction.jpg", quality=95)


if __name__ == "__main__":
    build_mockup(build_lockup())
