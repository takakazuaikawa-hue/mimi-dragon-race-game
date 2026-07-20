from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONT_BOLD = r"C:\Windows\Fonts\YuGothB.ttc"


def crop_alpha(image):
    return image.crop(image.getchannel("A").getbbox())


def main():
    logo = crop_alpha(Image.open(OUT / "title_logo_l_stable_calligraphy.png").convert("RGBA"))
    bg = Image.open(ROOT / "images" / "title_bg.jpg").convert("RGBA")

    veil = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(veil)
    d.ellipse((52, 18, 801, 448), fill=(13, 7, 21, 84))
    veil = veil.filter(ImageFilter.GaussianBlur(52))
    bg = Image.alpha_composite(bg, veil)

    target_w = 745
    target_h = round(logo.height * target_w / logo.width)
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    bg.alpha_composite(logo, ((bg.width - target_w) // 2, 68))

    d = ImageDraw.Draw(bg)
    font = ImageFont.truetype(FONT_BOLD, 23)
    d.rounded_rectangle((260, 1124, 593, 1180), radius=24,
                        fill=(39, 18, 42, 218), outline=(213, 157, 72, 230), width=3)
    d.text((426, 1152), "\u5cf6\u3078\u5411\u304b\u3046", font=font, anchor="mm",
           fill=(250, 237, 205, 255))
    bg.convert("RGB").save(OUT / "title_screen_mockup_l_stable_calligraphy_typeproof.jpg", quality=96)


if __name__ == "__main__":
    main()
