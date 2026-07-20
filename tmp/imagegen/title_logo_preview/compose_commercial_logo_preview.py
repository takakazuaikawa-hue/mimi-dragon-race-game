from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_SERIF = r"C:\Windows\Fonts\NotoSerifJP-VF.ttf"
FONT_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
SUB_LINE_1 = "\u8ee2\u751f\u3057\u305f\u3089\u30d0\u30cb\u30fc\u30ac\u30fc\u30eb\u3060\u3063\u305f\u79c1\u306e\u6c4e\u7528\u30b9\u30ad\u30eb"
SUB_LINE_2 = "\u300a\u3071\u307b\u3071\u307b\u300b\u3060\u3051\u304c\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u306a\u4ef6"


def crop_alpha(image):
    box = image.getchannel("A").getbbox()
    return image.crop(box)


def draw_centered_text(draw, xy, text, font, fill, stroke_width=2):
    draw.text(xy, text, font=font, anchor="mm", fill=fill,
              stroke_width=stroke_width, stroke_fill=(29, 13, 30, 240))


def build_lockup():
    logo = crop_alpha(Image.open(OUT / "title_logo_k_commercial_transparent.png").convert("RGBA"))
    target_w = 1320
    target_h = round(logo.height * target_w / logo.width)
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (target_w, target_h + 146), (0, 0, 0, 0))
    canvas.alpha_composite(logo, (0, 0))
    d = ImageDraw.Draw(canvas)
    y0 = target_h + 15

    # Editorial subtitle treatment: hairline ornament and type, not a UI plaque.
    d.line((132, y0, 572, y0), fill=(211, 154, 72, 220), width=3)
    d.line((748, y0, 1188, y0), fill=(211, 154, 72, 220), width=3)
    cx = target_w // 2
    d.polygon([(cx, y0 - 10), (cx + 10, y0), (cx, y0 + 10), (cx - 10, y0)],
              fill=(181, 73, 62, 255), outline=(245, 205, 119, 255))
    d.ellipse((cx - 25, y0 - 2, cx - 19, y0 + 4), fill=(224, 172, 82, 240))
    d.ellipse((cx + 19, y0 - 2, cx + 25, y0 + 4), fill=(224, 172, 82, 240))

    f1 = ImageFont.truetype(FONT_SERIF, 34)
    f2 = ImageFont.truetype(FONT_SERIF, 40)
    draw_centered_text(d, (cx, y0 + 47), SUB_LINE_1, f1, (255, 244, 216, 255), 2)
    draw_centered_text(d, (cx, y0 + 96), SUB_LINE_2, f2, (239, 196, 106, 255), 2)

    path = OUT / "title_logo_k_commercial_lockup.png"
    canvas.save(path)
    return canvas


def build_mockup(lockup):
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")

    # Quiet local contrast behind the logo only; preserve the actual background art.
    veil = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    vd.ellipse((38, 12, 815, 492), fill=(13, 6, 20, 91))
    veil = veil.filter(ImageFilter.GaussianBlur(56))
    bg = Image.alpha_composite(bg, veil)

    target_w = 790
    target_h = round(lockup.height * target_w / lockup.width)
    small = lockup.resize((target_w, target_h), Image.Resampling.LANCZOS)
    bg.alpha_composite(small, ((bg.width - target_w) // 2, 39))

    d = ImageDraw.Draw(bg)
    prompt_font = ImageFont.truetype(FONT_BOLD, 23)
    d.rounded_rectangle((260, 1124, 593, 1180), radius=24,
                        fill=(39, 18, 42, 218), outline=(213, 157, 72, 230), width=3)
    d.text((426, 1152), "\u5cf6\u3078\u5411\u304b\u3046", font=prompt_font, anchor="mm",
           fill=(250, 237, 205, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_k_commercial.jpg", quality=96)


if __name__ == "__main__":
    build_mockup(build_lockup())
