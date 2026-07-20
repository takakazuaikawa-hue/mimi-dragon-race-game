from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(r"C:\Users\takakazu\projects\mimi_dragon_race_game\tmp\imagegen\title_logo_preview")
FONT = r"C:\Windows\Fonts\YuGothB.ttc"
ITEMS = [
    ("01", "DRAGON RACE", "concept_01_dragon_race.png"),
    ("02", "ISLAND TOUR", "concept_02_island_tour.png"),
    ("03", "MIST / JUNGLE", "concept_03_mist_jungle.png"),
    ("04", "ANCIENT RUINS", "concept_04_ancient_ruins.png"),
    ("05", "VOLCANIC FORGE", "concept_05_volcanic_forge.png"),
    ("06", "RACE FESTIVAL", "concept_06_race_festival.png"),
    ("07", "MIMI / LUCK", "concept_07_mimi_luck.png"),
    ("08", "MARITIME TOUR", "concept_08_maritime_tourism.png"),
    ("09", "MODERN DISTRICT", "concept_09_modern_commercial.png"),
    ("10", "PREMIUM SYNTHESIS", "concept_10_premium_synthesis.png"),
    ("11", "ROYAL REGALIA", "concept_11_royal_regalia.png"),
    ("12", "ART NOUVEAU", "concept_12_art_nouveau_jungle.png"),
    ("13", "ASTROLABE RUINS", "concept_13_astrolabe_ruins.png"),
    ("14", "GRAND RACE", "concept_14_grand_race_festival.png"),
    ("15", "JEWELED ISLAND", "concept_15_illuminated_island.png"),
]


def sheet(items, filename):
    thumb_w, thumb_h = 320, 480
    label_h = 62
    gap = 12
    margin = 18
    width = margin * 2 + len(items) * thumb_w + (len(items) - 1) * gap
    height = margin * 2 + label_h + thumb_h
    canvas = Image.new("RGB", (width, height), (25, 18, 29))
    d = ImageDraw.Draw(canvas)
    font_no = ImageFont.truetype(FONT, 29)
    font_name = ImageFont.truetype(FONT, 16)

    x = margin
    for number, name, path in items:
        im = Image.open(OUT / path).convert("RGB")
        im.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        px = x + (thumb_w - im.width) // 2
        py = margin + label_h + (thumb_h - im.height) // 2
        canvas.paste(im, (px, py))
        d.text((x + 4, margin + 1), number, font=font_no, fill=(239, 184, 72))
        d.text((x + 48, margin + 9), name, font=font_name, fill=(245, 232, 208))
        x += thumb_w + gap
    canvas.save(OUT / filename, quality=95)


if __name__ == "__main__":
    sheet(ITEMS[:5], "concepts_01_05_comparison.jpg")
    sheet(ITEMS[5:10], "concepts_06_10_comparison.jpg")
    sheet(ITEMS[10:], "concepts_11_15_comparison.jpg")
