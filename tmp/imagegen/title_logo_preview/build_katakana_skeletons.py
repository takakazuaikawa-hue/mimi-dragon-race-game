from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game")
OUT = ROOT / "tmp" / "imagegen" / "title_logo_preview"
FONTS = {
    "textbook": r"C:\Windows\Fonts\UDDigiKyokashoN-B.ttc",
    "mincho": r"C:\Windows\Fonts\NotoSerifJP-VF.ttf",
}
OWNER = "\u30df\u30df\u306e"
MAIN = "\u30c9\u30e9\u30b4\u30f3\u30ec\u30fc\u30b9"
SECONDARY = "\u30a2\u30a4\u30e9\u30f3\u30c9"


def fit(text, font_path, start_size, max_width):
    for size in range(start_size, 20, -1):
        font = ImageFont.truetype(font_path, size)
        if font.getlength(text) <= max_width:
            return font
    return ImageFont.truetype(font_path, 20)


def render(key, font_path):
    canvas = Image.new("RGB", (1728, 1024), "white")
    d = ImageDraw.Draw(canvas)
    main = fit(MAIN, font_path, 250, 1510)
    second = fit(SECONDARY, font_path, 205, 1120)
    owner = ImageFont.truetype(font_path, 118)

    # Neutral, stable layout. No per-character rotation, scaling, or decorative distortion.
    d.text((864, 195), OWNER, font=owner, anchor="mm", fill=(18, 18, 18))
    d.text((864, 495), MAIN, font=main, anchor="mm", fill=(18, 18, 18))
    d.text((864, 790), SECONDARY, font=second, anchor="mm", fill=(18, 18, 18))
    canvas.save(OUT / f"katakana_skeleton_{key}.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, path in FONTS.items():
        render(name, path)
