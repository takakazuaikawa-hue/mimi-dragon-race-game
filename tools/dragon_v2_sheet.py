#!/usr/bin/env python3
"""竜V2 検収シート＋機械チェック（表示素材のみ・レース数値に非干渉）。

使い方:
  pip install pillow
  python3 tools/dragon_v2_sheet.py images/dragons_v2_staging [--out tmp/dragon_v2_sheets]

各画像について:
  - 透過/グレー無地どちらでも被写体bboxを出す（race_canvas.js の四隅flood-fillと同じ許容34）
  - 翼根ギャップ（背中領域 x=5..62% で不透明画素が最少の行）を検出し、race_canvas の
    flapClean 判定（交差12%未満）を再現 → 羽ばたきが割れないかを事前に知る
  - 原寸 / 96px（馬券カード） / 46px（レース中）の3段コンタクトシートを出力
出力: <out>/sheet_<n>.png と <out>/report.tsv（id, w, h, bbox, flapK, flapClean, kb）
"""
import os, sys, math
from PIL import Image

TOL2 = 34 * 34

def key_out_gray(im):
    """四隅が不透明なら、四隅の色と繋がった背景だけを透過にする（race_canvas.js と同じ）。"""
    im = im.convert("RGBA")
    W, H = im.size
    px = im.load()
    if px[0, 0][3] <= 200:
        return im
    cr, cg, cb, _ = px[0, 0]
    seen = bytearray(W * H)
    stack = [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]
    while stack:
        x, y = stack.pop()
        i = y * W + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2 > TOL2:
            continue
        px[x, y] = (r, g, b, 0)
        if x > 0: stack.append((x - 1, y))
        if x < W - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < H - 1: stack.append((x, y + 1))
    return im

def analyze(im):
    W, H = im.size
    a = im.getchannel("A")
    bbox = a.point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, W, H)
    bx, by, bx1, by1 = bbox
    bw, bh = max(1, bx1 - bx), max(1, by1 - by)
    ap = a.load()
    gx0, gx1 = round(bx + bw * 0.05), round(bx + bw * 0.62)
    best_y, best_c = round(by + bh * 0.40), 10 ** 9
    for yy in range(round(by + bh * 0.20), round(by + bh * 0.58) + 1):
        cnt = sum(1 for xx in range(gx0, gx1 + 1, 2) if ap[xx, yy] > 24)
        if cnt < best_c:
            best_c, best_y = cnt, yy
    flap_k = (best_y - by) / bh
    clean = best_c <= math.ceil(((gx1 - gx0) / 2) * 0.12)
    return bbox, flap_k, clean

def fit_h(im, bbox, h):
    c = im.crop(bbox)
    s = h / c.height
    return c.resize((max(1, round(c.width * s)), h), Image.LANCZOS)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = "tmp/dragon_v2_sheets"
    if "--out" in sys.argv:
        out = sys.argv[sys.argv.index("--out") + 1]
    src = args[0] if args else "images/dragons_v2_staging"
    os.makedirs(out, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if f.lower().endswith((".png", ".webp")) and not f.startswith("_"))
    rows, tiles = [], []
    for f in files:
        p = os.path.join(src, f)
        im = key_out_gray(Image.open(p))
        bbox, fk, clean = analyze(im)
        kb = os.path.getsize(p) // 1024
        rows.append((os.path.splitext(f)[0], im.width, im.height, bbox, round(fk, 3), clean, kb))
        tiles.append((os.path.splitext(f)[0], im, bbox, clean))
    with open(os.path.join(out, "report.tsv"), "w") as fh:
        fh.write("id\tw\th\tbbox\tflapK\tflapClean\tKB\n")
        for r in rows:
            fh.write("\t".join(str(x) for x in r) + "\n")
    # 3段シート：原寸(高さ220) / 96px / 46px  ×  8頭で1枚
    per, cw = 8, 300
    for n in range(0, len(tiles), per):
        chunk = tiles[n:n + per]
        sheet = Image.new("RGBA", (cw * len(chunk), 220 + 110 + 70 + 24), (28, 40, 34, 255))
        for i, (id_, im, bbox, clean) in enumerate(chunk):
            x = i * cw
            for row_y, h in ((0, 200), (230, 96), (340, 46)):
                t = fit_h(im, bbox, h)
                if t.width > cw - 8:
                    t = t.resize((cw - 8, max(1, round(t.height * (cw - 8) / t.width))), Image.LANCZOS)
                sheet.paste(t, (x + (cw - t.width) // 2, row_y + (h - t.height) // 2), t)
            # ラベル代わりに flapClean を色帯で（緑=隙間あり/赤=なし）
            band = (60, 170, 90, 255) if clean else (200, 70, 60, 255)
            sheet.paste(Image.new("RGBA", (cw - 8, 12), band), (x + 4, 220 + 110 + 70 + 6))
        sheet.save(os.path.join(out, "sheet_%d.png" % (n // per)))
    print("files:", len(files), "→", out)
    for r in rows:
        print(r)

if __name__ == "__main__":
    main()
