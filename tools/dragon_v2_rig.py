#!/usr/bin/env python3
"""竜V2：本体版（透過）と翼なし版（透過）から、竜ごとのリグを作る（表示素材のみ・レース数値に非干渉）。

  pip install pillow
  python3 tools/dragon_v2_rig.py stage <src_rgba.png> <id> [--nowing]
      → 透過WebP（幅1000・q82）を images/dragons_v2_staging/<id>.png（翼なし版は <id>_nowing.png）に書く
  python3 tools/dragon_v2_rig.py rig <id> [--tail-cut 0.34] [--eye X,Y,R] [--wingless]   （目の自動検出が外れた時だけ --eye で手指定）
      --wingless＝元から翼の無い竜（stamina_tank の goro/taiga/konron/banju/gozan/fugaku）。翼なし版は作らず、
        本体を tail/body の2パーツに分けるだけ（meta.json に "wingless": true）
      → images/dragons_v2_staging/<id>.png と <id>_nowing.png から
        images/dragons_v2_rigs/<id>/rig.json ＋ parts/{wing,body,tail}.webp ＋ meta.json（目の座標など）を作る
        （その後 node live2d/cli.js validate images/dragons_v2_rigs/<id>/rig.json）

仕様は docs/DRAGON_V2_COOL_RENDER_DIRECTIVE.md §11.2：
  1. 本体と翼なし版を重ね（位置ずれは ±12px で自動合わせ）、差分マスク＝翼（膨張2px・穴埋め・大きい連結成分のみ）
  2. wing＝本体から差分マスクで切り出し。ピボット＝翼根（翼マスクと胴が接する画素の重心）
  3. body＝翼なし版。ピボット＝胸の中心
  4. tail＝翼なし版を x = bbox.x + cut·bbox.w で切った左側。胴は切断線の左 1.2% を残して重ねる（尾が動いても割れ目が出ない）。ピボット＝切断線の中点
  5. 目＝顔領域（bbox 右端30%・上から15〜90%）の白目＋瞳 → meta.json に中心と半径だけ書く（パーツにはしない）
     （切り出した目パーツを縦に潰すと、下の body に元の目が残って二重に見えるため。
      まばたき・漫符はランタイムがこの座標に描く。§11.2 の「上から15〜55%」は翼込み bbox だと範囲外になる）
  検収：翼の周囲30pxを除いた外側で本体と翼なし版の差分が 3% を超えたら「翼なし版を再生成」と警告（exit 3）
     （翼根の肩は翼なし版で塗り直されるのが正常なので、そこは数えない）
"""
import os, sys, json, math
from PIL import Image, ImageChops, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, "images", "dragons_v2_staging")
RIGS = os.path.join(ROOT, "images", "dragons_v2_rigs")
STAGE_W, STAGE_Q = 1000, 82
A_ON = 128  # 不透明とみなすアルファ

def save_webp(im, path, q=STAGE_Q):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)  # 拡張子 .png でも中身は WebP（既存の竜と同じ運用）
    return os.path.getsize(path)

def stage(src, id_, nowing):
    im = Image.open(src).convert("RGBA")
    if im.getpixel((0, 0))[3] > 200:
        sys.exit("四隅が不透明：remove_background 済みの透過画像を渡すこと")
    h = round(im.height * STAGE_W / im.width)
    im = im.resize((STAGE_W, h), Image.LANCZOS)
    out = os.path.join(STAGE, id_ + ("_nowing" if nowing else "") + ".png")
    kb = save_webp(im, out) // 1024
    print("%s  %dx%d  %dKB%s" % (os.path.relpath(out, ROOT), im.width, h, kb, "  ⚠ 110KB超" if kb > 110 else ""))

def alpha_mask(im, thr=A_ON):
    return im.getchannel("A").point(lambda v: 255 if v >= thr else 0)

def best_shift(body, nowing, r=12):
    """翼の無い下半分のアルファが最も重なる平行移動を探す（縮小して総当たり）。"""
    s = 4
    a = alpha_mask(body).resize((body.width // s, body.height // s))
    b = alpha_mask(nowing).resize((body.width // s, body.height // s))
    bb = a.getbbox() or (0, 0, a.width, a.height)
    lower = (bb[0], (bb[1] + bb[3]) // 2, bb[2], bb[3])
    best, bdx, bdy = None, 0, 0
    for dy in range(-r // s, r // s + 1):
        for dx in range(-r // s, r // s + 1):
            sh = ImageChops.offset(b, dx, dy)
            d = ImageChops.difference(a.crop(lower), sh.crop(lower))
            v = sum(d.histogram()[128:])
            if best is None or v < best:
                best, bdx, bdy = v, dx, dy
    return bdx * s, bdy * s

def components(mask):
    """8近傍の連結成分（面積の大きい順）。mask は L(0/255)。"""
    W, H = mask.size
    px = mask.load()
    seen = bytearray(W * H)
    comps = []
    for y in range(H):
        for x in range(W):
            if px[x, y] and not seen[y * W + x]:
                stack, pts = [(x, y)], []
                seen[y * W + x] = 1
                while stack:
                    cx, cy = stack.pop()
                    pts.append((cx, cy))
                    for nx in (cx - 1, cx, cx + 1):
                        for ny in (cy - 1, cy, cy + 1):
                            if 0 <= nx < W and 0 <= ny < H and px[nx, ny] and not seen[ny * W + nx]:
                                seen[ny * W + nx] = 1
                                stack.append((nx, ny))
                comps.append(pts)
    comps.sort(key=len, reverse=True)
    return comps

def fill_holes(mask):
    """外周から繋がらない黒領域（穴）を白で埋める。"""
    W, H = mask.size
    inv = mask.point(lambda v: 0 if v else 255)
    ext = Image.new("L", (W + 2, H + 2), 255)
    ext.paste(inv, (1, 1))
    from PIL import ImageDraw
    ImageDraw.floodfill(ext, (0, 0), 128)
    ext = ext.crop((1, 1, W + 1, H + 1))
    return ext.point(lambda v: 0 if v == 128 else 255)

def wing_mask(body, nowing):
    ab, an = alpha_mask(body), alpha_mask(nowing)
    only_body = ImageChops.subtract(ab, an)                      # 本体にだけある画素
    col = ImageChops.difference(body.convert("RGB"), nowing.convert("RGB")).convert("L").point(lambda v: 255 if v > 48 else 0)
    changed = ImageChops.multiply(ab, col)                         # 両方にあるが色が大きく変わった画素（翼が胴に重なっていた所）
    m = ImageChops.lighter(only_body, changed)
    m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(9))   # 細かいノイズを消してから膨張（≒2px）
    # 連結成分は縮小して計算（速度）→ 元解像度へ
    s = 4
    small = m.resize((m.width // s, m.height // s)).point(lambda v: 255 if v > 64 else 0)
    comps = components(small)
    if not comps:
        return None
    keep = Image.new("L", small.size, 0)
    kp = keep.load()
    big = len(comps[0])
    for c in comps:
        if len(c) < big * 0.20:  # 奥の翼（別成分）は残し、細かい差分は捨てる
            break
        for x, y in c:
            kp[x, y] = 255
    keep = fill_holes(keep).resize(m.size, Image.NEAREST)
    return ImageChops.multiply(keep, ab)

def wing_root(mask, nowing):
    """翼マスクのうち、翼なし版の胴に接する画素の重心＝翼根。"""
    an = alpha_mask(nowing).filter(ImageFilter.MaxFilter(5))
    touch = ImageChops.multiply(mask, an)
    bb = touch.getbbox()
    src = touch if bb else mask
    px, W, H = src.load(), src.width, src.height
    sx = sy = n = 0
    bb = src.getbbox()
    for y in range(bb[1], bb[3], 2):
        for x in range(bb[0], bb[2], 2):
            if px[x, y]:
                sx += x; sy += y; n += 1
    return (round(sx / n), round(sy / n)) if n else (W // 2, H // 2)

def find_eye(body):
    """白目（明るく彩度の低い小塊）＋そのすぐ周りの暗い瞳 → 目の中心と半径。見つからなければ None。
    3D調の絵は影・角の溝・口の線も暗いので「暗い塊」だけでは誤検出する（2026-09-23 実測）。"""
    import colorsys
    bb = alpha_mask(body).getbbox()
    bx, by, bx1, by1 = bb
    bw, bh = bx1 - bx, by1 - by
    reg = (round(bx1 - bw * 0.30), round(by + bh * 0.15), bx1, round(by + bh * 0.90))
    crop = body.crop(reg)
    W, H = crop.size
    px = crop.load()
    white = Image.new("L", (W, H), 0)
    wp = white.load()
    dark = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            _, sat, val = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if val > 0.72 and sat < 0.20:
                wp[x, y] = 255
            if val < 0.30:
                dark[y * W + x] = 1
    best, maxw = None, bw * 0.08
    for c in components(white)[:20]:
        if len(c) < 12:
            continue
        xs = [p[0] for p in c]; ys = [p[1] for p in c]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        if w > maxw or h > maxw:              # 淡い体色（seram・miruka）の広い面は目ではない
            continue
        pad = max(3, w // 3)
        nd = sum(dark[yy * W + xx] for yy in range(max(0, y0 - pad), min(H, y1 + pad + 1))
                 for xx in range(max(0, x0 - pad), min(W, x1 + pad + 1)))
        if nd < 8:
            continue
        score = len(c) * min(nd, len(c))
        if best is None or score > best[0]:
            best = (score, (x0 + x1) / 2.0 + reg[0], (y0 + y1) / 2.0 + reg[1], max(w, h) / 2.0)
    if not best:
        return None
    _, cx, cy, r = best
    r = min(max(r, bw * 0.010), bw * 0.030)
    return round(cx), round(cy), round(r)

def crop_part(im, rect):
    x, y, w, h = rect
    return im.crop((x, y, x + w, y + h))

def motion(role):
    base = {"breathing": 0, "blinkable": False, "sway": {"amp": 0, "freq": 0.25, "phase": 0, "axis": "rot"},
            "bend": None, "gaze": {"tx": 0, "ty": 0}, "flutter": 0, "jiggle": None}
    if role == "wing":
        base.update(bend={"amp": 0.18, "freq": 1.35, "axis": "x", "strips": 12, "rootEdge": "right"}, flutter=0.6, breathing=0.3)
    elif role == "tail":
        base.update(bend={"amp": 0.11, "freq": 0.55, "axis": "x", "strips": 12, "rootEdge": "right"}, breathing=0.15)
    elif role == "body":
        base.update(breathing=0.15)
    elif role == "eye":
        base.update(blinkable=True, gaze={"tx": 4, "ty": 3})
    return base

def part(id_, role, z, rect, pivot):
    return {"id": id_, "role": role, "z": z, "parent": None,
            "rect": {"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3]},
            "pivot": {"x": pivot[0], "y": pivot[1]},
            "opacity": 1, "scale": {"x": 1, "y": 1}, "offset": {"x": 0, "y": 0}, "rot": 0,
            "flip": {"h": False, "v": False}, "motion": motion(role), "file": "parts/%s.webp" % id_}

def bbox_rect(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return (bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]) if bb else None

def rig(id_, tail_cut, eye_override=None, wingless=False):
    body = Image.open(os.path.join(STAGE, id_ + ".png")).convert("RGBA")
    W, H = body.size
    out = os.path.join(RIGS, id_)
    os.makedirs(os.path.join(out, "parts"), exist_ok=True)
    parts = []
    dx = dy = 0
    drift, wr = 0.0, None
    if wingless:
        nowing = body   # 元から翼が無い：本体をそのまま tail/body に切る
        old_wing = os.path.join(out, "parts", "wing.webp")
        if os.path.exists(old_wing):
            os.remove(old_wing)
    else:
        nowing = Image.open(os.path.join(STAGE, id_ + "_nowing.png")).convert("RGBA")
        if nowing.size != body.size:
            nowing = nowing.resize(body.size, Image.LANCZOS)
        dx, dy = best_shift(body, nowing)
        if dx or dy:
            nowing = ImageChops.offset(nowing, dx, dy)
        m = wing_mask(body, nowing)
        if m is None or not m.getbbox():
            sys.exit("翼の差分が取れない（翼なし版が本体と同じ？ 元から翼が無い竜なら --wingless）")
        # 検収：翼の外側のズレ
        near = m.resize((W // 4, H // 4)).filter(ImageFilter.MaxFilter(15)).resize((W, H))     # 翼の周囲 ≈30px（縮小して膨張＝速い）
        outside = ImageChops.subtract(alpha_mask(body).filter(ImageFilter.MinFilter(3)), near)
        diff = ImageChops.difference(body.convert("RGB"), nowing.convert("RGB")).convert("L").point(lambda v: 255 if v > 48 else 0)
        bad = ImageChops.multiply(outside, diff)
        n_out = max(1, sum(outside.histogram()[128:]))
        drift = sum(bad.histogram()[128:]) / n_out
        # wing
        wing = Image.new("RGBA", body.size, (0, 0, 0, 0))
        wing.paste(body, (0, 0), m)
        wr = bbox_rect(wing)
        save_webp(crop_part(wing, wr), os.path.join(out, "parts", "wing.webp"))
        parts.append(part("wing", "wing", 3, wr, wing_root(m, nowing)))
    # tail / body（翼なし版を縦線で切る）
    nb = bbox_rect(nowing)
    cut = round(nb[0] + tail_cut * nb[2])
    tail = nowing.crop((0, 0, cut + 1, H)); tail_full = Image.new("RGBA", body.size, (0, 0, 0, 0)); tail_full.paste(tail, (0, 0))
    tr = bbox_rect(tail_full)
    lip = max(4, round(nb[2] * 0.012))           # 胴に残す「かぶせしろ」＝尾の付け根が動いても胴(z2)の下に隠れて割れ目が出ない
    rest = nowing.copy(); rest.paste((0, 0, 0, 0), (0, 0, cut - lip, H))
    br = bbox_rect(rest)
    col = [y for y in range(H) if nowing.getpixel((cut, y))[3] >= A_ON]
    tail_pivot = (cut, round(sum(col) / len(col)) if col else nb[1] + nb[3] // 2)
    save_webp(crop_part(tail_full, tr), os.path.join(out, "parts", "tail.webp"))
    save_webp(crop_part(rest, br), os.path.join(out, "parts", "body.webp"))
    parts.append(part("tail", "tail", 1, tr, tail_pivot))
    parts.append(part("body", "body", 2, br, (br[0] + br[2] // 2, br[1] + br[3] // 2)))
    e = eye_override or find_eye(body)
    old_eye = os.path.join(out, "parts", "eye.webp")
    if os.path.exists(old_eye):
        os.remove(old_eye)
    rigj = {"format": "mimi-live2d-rig", "version": 1, "name": id_, "canvas": {"w": W, "h": H}, "embed": False,
            "rootPivot": {"x": nb[0] + nb[2] // 2, "y": nb[1] + round(nb[3] * 0.6)}, "parts": sorted(parts, key=lambda p: p["z"])}
    with open(os.path.join(out, "rig.json"), "w") as fh:
        fh.write(json.dumps(rigj, ensure_ascii=False, indent=2) + "\n")
    meta = {"id": id_, "canvas": {"w": W, "h": H}, "nowingShift": {"x": dx, "y": dy},
            "eye": ({"x": e[0], "y": e[1], "r": e[2]} if e else None),
            "wingOutsideDrift": round(drift, 4), "tailCut": tail_cut}
    if wingless:
        meta["wingless"] = True
    with open(os.path.join(out, "meta.json"), "w") as fh:
        fh.write(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    print("%s  shift=(%d,%d)  wing=%s  eye=%s  翼外ズレ=%.1f%%" % (os.path.relpath(out, ROOT), dx, dy, wr, e, drift * 100))
    if drift > 0.03:
        print("⚠ 翼の外側が 3% 超ズレている → 翼なし版を再生成（§11.1）")
        sys.exit(3)

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == "stage":
        stage(a[1], a[2], "--nowing" in a)
    elif len(a) >= 2 and a[0] == "rig":
        tc = float(a[a.index("--tail-cut") + 1]) if "--tail-cut" in a else 0.34
        eo = tuple(int(v) for v in a[a.index("--eye") + 1].split(",")) if "--eye" in a else None
        rig(a[1], tc, eo, "--wingless" in a)
    else:
        print(__doc__)
