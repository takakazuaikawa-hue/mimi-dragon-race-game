from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game\tmp\imagegen\title_logo_preview")
SOURCE = ROOT / "dragon_race_kiko_logo_transparent.png"
OUTPUT = ROOT / "dragon_race_kiko_logo.png"
OUTPUT_WEBP = ROOT / "dragon_race_kiko_logo.webp"
PREVIEW = ROOT / "dragon_race_kiko_logo_alpha_preview.jpg"


image = Image.open(SOURCE).convert("RGBA")
alpha = image.getchannel("A")
bbox = alpha.getbbox()
if bbox is None:
    raise RuntimeError("The extracted image contains no visible logo pixels")

padding = 28
left = max(0, bbox[0] - padding)
top = max(0, bbox[1] - padding)
right = min(image.width, bbox[2] + padding)
bottom = min(image.height, bbox[3] + padding)
cropped = image.crop((left, top, right, bottom))
cropped.save(OUTPUT, optimize=True)
cropped.save(OUTPUT_WEBP, format="WEBP", lossless=True, quality=100, method=6)

preview_w = 1400
preview_h = round(preview_w * cropped.height / cropped.width)
logo = cropped.resize((preview_w, preview_h), Image.Resampling.LANCZOS)

canvas = Image.new("RGB", (preview_w, preview_h), (8, 11, 17))
draw = ImageDraw.Draw(canvas)
tile = 32
for y in range(0, preview_h // 2, tile):
    for x in range(0, preview_w, tile):
        color = (238, 238, 238) if (x // tile + y // tile) % 2 == 0 else (195, 195, 195)
        draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=color)
canvas.paste(logo, (0, 0), logo)
canvas.save(PREVIEW, quality=94)

corners = [alpha.getpixel((0, 0)), alpha.getpixel((image.width - 1, 0)), alpha.getpixel((0, image.height - 1)), alpha.getpixel((image.width - 1, image.height - 1))]
print(f"source={image.size} cropped={cropped.size} bbox={bbox} corners={corners}")
