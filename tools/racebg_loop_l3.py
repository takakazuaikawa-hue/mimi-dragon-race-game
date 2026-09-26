#!/usr/bin/env python3
"""レース背景の最近景 L3（images/racebg_v2_time/<時間帯>/<地域>_L3.webp）を「継ぎ目なしのループ」に焼き直す。

  pip install pillow numpy
  python3 tools/racebg_loop_l3.py            → 納品時の 1600px 幅の L3 をすべて処理（処理済み＝幅≠1600 は飛ばす）

なぜ：納品の L3 は
  ・右端 113px に左端の絵を継ぎ足してあり、x=1487 に縦の継ぎ目が焼き込まれていた
  ・左端 0〜約110px が「右端の続き → 左端の絵」のクロスフェードで、高さの違う縁石が二重に透けていた
  ・元の絵は左右の端で縁石の高さが違う（遠近で斜めに走る）ので、ただつなぐと縁石が段になる

処理（地域ごとの構図は 5 時間帯で共通なので、縁石の高さ表は地域単位）：
  1. 継ぎ足しの 113px を切り落とす（幅 1487）
  2. 縁石の高さを揃える：各列を上端・下端固定で縦に少し伸縮し、斜めに走る縁石（2点を通る直線で近似）を一定の高さへ
     （絵の上端・下端は動かないので穴は空かない。スクロール方向と平行な縁石になる）
  3. 納品時のクロスフェード部（左端 0〜110px）を捨て、縁石の帯の絵柄が最もよく一致する列の組 xa／xb を探して
     xa〜xb を1タイルに。先頭 FADE px を「xb の続き」から「xa の続き」へ少しずつ移してつなぐ
描画側（js/race_canvas.js bakePara）は L3 にクロスフェードを掛けずにそのまま並べる。表示素材のみ。
"""
import glob, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_W, CUT_W, H = 1600, 1487, 400
FADE = 120                               # つなぎの重ね幅（px・原寸）
XA = (112, 260)                          # タイル先頭の候補（納品時のクロスフェード部 0〜110 は使わない）
XB_FROM = CUT_W - 280                    # タイル末尾の候補の下限（上限は CUT_W - FADE）
# 縁石の中心の高さ：2点 (x, y)（原寸）を通る直線を「その列の縁石の高さ」とみなす（タイルの切れ目付近で読んだ値）。
# None＝片端に手前の縁石が無い（霧・岩）→ 伸縮しない
KERB = {
    "caldera":    ((300, 140), (1144, 186)),
    "grandclock": ((0, 230), (1486, 150)),
    "lapan":      ((0, 158), (1486, 125)),
    "lumina":     None,
    "mistlake":   None,
    "notte":      ((350, 166), (1240, 266)),
    "ringrosso":  ((0, 245), (1486, 262)),
    "stadium":    ((0, 152), (1486, 205)),
    "vento":      None,
}

def level_kerb(pm, kerb):
    """各列を上端・下端固定で縦に伸縮し、縁石の高さ p(x)（2点を通る直線）を一定の高さ q へ移す。pm は乗算済み RGBA。"""
    if kerb is None:
        return pm, None
    (x1, y1), (x2, y2) = kerb
    h, w = pm.shape[:2]
    line = lambda x: y1 + (y2 - y1) * (x - x1) / (x2 - x1)
    q = (line(0) + line(w - 1)) / 2.0
    out = np.empty_like(pm)
    ys = np.arange(h, dtype=np.float32)
    for x in range(w):
        p = line(x)
        src = np.where(ys <= q, ys * p / q, p + (ys - q) * (h - 1 - p) / (h - 1 - q))
        i0 = np.clip(np.floor(src).astype(int), 0, h - 1); i1 = np.minimum(i0 + 1, h - 1)
        f = (src - i0)[:, None]
        out[:, x] = pm[i0, x] * (1 - f) + pm[i1, x] * f
    return out, q

def find_loop(pm, q):
    """xa（先頭候補）と xb（末尾候補）で、そこから右 FADE 列の絵柄が最も一致する組を探す（1/4 縮小で総当たり）。
    縁石の帯（高さ q の上下 50px）を重く、ほかを軽く見る＝紅白ブロックの位相も揃う。"""
    k = 4
    g = pm[::k, ::k, :3].mean(axis=2)
    wt = np.full(g.shape[0], 0.25, np.float32)
    wt[: int(g.shape[0] * 0.25)] = 0.0                       # 上の靄は比べない
    if q is not None:
        lo, hi = int((q - 50) / k), int((q + 50) / k)
        wt[max(lo, 0):hi] = 1.0
    wt = wt[:, None]
    n = FADE // k
    best = None
    for xa in range(XA[0] // k, XA[1] // k):
        A = g[:, xa:xa + n]
        for xb in range(XB_FROM // k, (CUT_W - FADE) // k + 1):
            v = float((np.abs(A - g[:, xb:xb + n]) * wt).sum() / (wt.sum() * n))
            if best is None or v < best[0]:
                best = (v, xa * k, xb * k)
    return best

def loop_l3(path, region):
    im = Image.open(path).convert("RGBA")
    if im.width != SRC_W:
        return None
    a = np.asarray(im).astype(np.float32)[:, :CUT_W]
    pm = a.copy(); pm[..., :3] *= pm[..., 3:4] / 255.0         # 乗算済みアルファで扱う（重ねた縁が暗くならない）
    pm, q = level_kerb(pm, KERB[region])
    v, xa, xb = find_loop(pm, q)
    out = pm[:, xa:xb].copy()
    # つなぎ：出力の先頭 FADE 列を「xb の続き」から「xa の続き」へ少しずつ移す＝右端→先頭が滑らかにつながる
    for x in range(FADE):
        t = (x + 0.5) / FADE; s = t * t * (3 - 2 * t)
        out[:, x] = pm[:, xb + x] * (1 - s) + pm[:, xa + x] * s
    al = out[..., 3:4]
    out[..., :3] = np.where(al > 0, out[..., :3] * 255.0 / np.maximum(al, 1e-3), 0)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA").save(path, "WEBP", quality=82, method=6, alpha_quality=85)
    return round(v, 1), xa, xb

if __name__ == "__main__":
    files = sorted(glob.glob(os.path.join(ROOT, "images", "racebg_v2_time", "*", "*_L3.webp")))
    for f in files:
        region = os.path.basename(f)[:-len("_L3.webp")]
        r = loop_l3(f, region)
        rel = os.path.relpath(f, ROOT)
        print(rel, "skip（処理済み）" if r is None else "一致度 %.1f  切れ目 x=%d〜%d（幅 %d）" % (r[0], r[1], r[2], r[2] - r[1]))
