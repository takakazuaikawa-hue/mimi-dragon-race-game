#!/usr/bin/env python3
"""竜V2：52頭ぶんの生成プロンプト台帳を機械生成する（依存ゼロ・標準ライブラリのみ）。

  python3 tools/dragon_v2_prompts.py            → docs/dragon_v2_kit/PROMPTS_52.md を書き出す
  python3 tools/dragon_v2_prompts.py --json     → 同内容を JSON で標準出力（バッチ投入用）

出典（すべてリポジトリ内・手で写さない）:
  - js/data_dragons.js / js/data_dragons_ext.js …… id・名前・色hex・アーキタイプ・脚質・tier
  - docs/codex_dragon_kit/race_dragons_52_master_list_v1_0.json …… 固有12頭の造形フィールド
  - confirmed_dragons.md / docs/CODEX_DRAGON_IMAGES_BRIEF.md …… 各頭の「意匠」（日本語のまま埋める）
雛形は docs/DRAGON_V2_COOL_RENDER_DIRECTIVE.md §4（同一性ロック版）と §11.1（翼なし版）。
Higgsfield（nano_banana_pro）でも ChatGPT の手貼りでも、同じ文面を使う。
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def P(*a): return os.path.join(ROOT, *a)

# ---- 1. id / 名前 / 色 / アーキタイプ / 脚質 を JS 台帳から --------------------------------
ARCH_STYLE = {"speed_escape": "escape", "fire_bruiser": "escape", "stamina_tank": "front", "wing_closer": "late",
              "turn_tech": "late", "fog_mystic": "late", "cloud_chaser": "chase", "allrounder": "front"}
def parse_ext():
    src = open(P("js", "data_dragons_ext.js"), encoding="utf-8").read()
    out = []
    for m in re.finditer(r'\{\s*id:"(\w+)",\s*name:"([^"]+)",\s*color:"(#[0-9a-fA-F]{6})",\s*arch:"(\w+)",\s*tier:(\d)', src):
        out.append({"id": m.group(1), "name": m.group(2), "color": m.group(3), "arch": m.group(4), "tier": int(m.group(5)), "style": ARCH_STYLE.get(m.group(4), "front")})
    return out
def parse_unique():
    src = open(P("js", "data_dragons.js"), encoding="utf-8").read()
    out = []
    for m in re.finditer(r'id:\s*"(\w+)"[^}]*?name:\s*"([^"]+)"[^}]*?color:\s*"(#[0-9a-fA-F]{6})"', src):
        out.append({"id": m.group(1), "name": m.group(2), "color": m.group(3)})
    return out

# ---- 2. 固有12頭の造形フィールド（master JSON）--------------------------------------------
master = json.load(open(P("docs", "codex_dragon_kit", "race_dragons_52_master_list_v1_0.json"), encoding="utf-8"))
UNIQ_BY_NAME = {e["name"]: e for e in master["unique_12"]}
EXT_BY_NAME = {e["name"]: e for e in master["ext_40"]}

# ---- 3. 意匠（日本語）を台帳 md から --------------------------------------------------------
ALIAS = {"shaku": "shakunetsu", "gouka": "goka", "gouzan": "gozan", "kogane(allrounder)": "kogane"}
def parse_designs():
    d = {}
    for path, idcol, notecol in ((P("confirmed_dragons.md"), 2, 5), (P("docs", "CODEX_DRAGON_IMAGES_BRIEF.md"), 1, 5)):
        for line in open(path, encoding="utf-8"):
            if not line.startswith("|"): continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) <= notecol - 1: continue
            cid = ALIAS.get(cells[idcol - 1], cells[idcol - 1])
            if not re.fullmatch(r"[a-z]+", cid): continue
            note = re.sub(r"\*\*", "", cells[notecol - 1])
            if note and cid not in d: d[cid] = note
    return d
DESIGN = parse_designs()

# ---- 4. アーキタイプ既定（英語）と特殊竜 ---------------------------------------------------
ARCH_EN = {
    "fire_bruiser":  ("a heavy bruiser build with rugged thick scales and back spikes", "swept-back horns", "membrane", "a burning flame tail"),
    "speed_escape":  ("a slim, fast build", "swept-back horns", "large membrane", "a blade-finned tail"),
    "wing_closer":   ("a balanced glider build", "swept-back horns", "very large", "a standard tail"),
    "stamina_tank":  ("a heavy rock-armored build", "rock horns", "small membrane", "a club tail"),
    "turn_tech":     ("an agile raptor build with big curved claws", "short swept horns", "membrane", "a fin tail"),
    "fog_mystic":    ("a slender, elegant build with a smooth body", "long white horns", "membrane", "a fin tail"),
    "cloud_chaser":  ("a soft rounded build", "no horns (a cloud frill on the head instead)", "cloud-material", "a cloud tail"),
    "allrounder":    ("a balanced build", "swept-back horns", "membrane", "a standard spade-tipped tail"),
}
BUILD_EN = {"sleek": "a sleek build", "chubby": "a small chubby build", "heavy": "a heavy build", "slim": "a slim build", "fluffy": "a soft rounded build",
            "bulky": "a bulky armored build", "elegant": "a slender elegant build", "agile": "an agile raptor build", "balanced": "a balanced build"}
HORN_EN = {"swept": "swept-back horns", "nub": "small nub horns", "none": "no horns (a soft frill on the head instead)", "crystal": "crystal horns",
           "bolt": "lightning-bolt horns", "tall": "tall white horns", "rock": "rock horns", "crown": "a star crown with a forehead star"}
TAIL_EN = {"spade": "a spade tail", "round": "a short round tail", "cloud": "a cloud tail", "flame": "a burning flame tail", "fin": "a fin tail",
           "club": "a rock club tail", "crystal": "a crystal tail", "bolt": "a lightning-bolt tail", "comet": "a comet star-trail tail", "feather": "a feathered tail"}
WING_EN = {"membrane": "membrane", "feather": "large feathered", "small": "small membrane", "fluffy": "cloud-material", "ice": "ice-crystal", "large": "large membrane"}
SPECIAL = {
    "poro":   "This is the crybaby child dragon: keep it small and chubby with tiny wings, big teary eyes with a tear, and its red bow tie.",
    "momu":   "Sleepy cloud dragon: cloud-material wings and tail, no horns, and a large sleepy half-closed eye.",
    "phenix": "Phoenix dragon: large feathered phoenix wings and a feathered tail, forelegs folded.",
    "stella": "Starlight dragon: feathered wings with gold star tips, a comet star-trail tail with one big star and small stars, a cosmic scale texture with white star points, and a star crown with a forehead star.",
    "raika":  "Thunder dragon: lightning-bolt horns and a bolt tail, cyan electric veins over the body and a thunder crest on the back.",
    "glaze":  "Ice dragon: crystal ice-armor scales, crystal horns and tail, ice wings, and a subtle rainbow refraction on the wing membrane, horns and tail edges.",
    "fugaku": "Black-iron rock armor plates with a faint labradorite/opal iridescence on a few plates only.",
    "chiri":  "Small rookie cloud dragon with small dusty cloud wings and tail and a large sleepy half-closed eye.",
    "yumeji": "Dreamy cloud dragon with big soft cloud wings containing dream-bubble orbs and a large dreamy half-closed eye.",
}
POSTURE = {"escape": "forward-leaning flying direction with the head lower than the tail",
           "front":  "forward-leaning flying direction with the head lower than the tail",
           "late":   "horizontal gliding direction with the head level or slightly above the tail",
           "chase":  "horizontal gliding direction with the head level or slightly above the tail"}

def color_desc(hexs):
    import colorsys
    h = hexs.lstrip("#"); r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    hue, sat, val = colorsys.rgb_to_hsv(r, g, b); hue *= 360
    if sat < 0.12: return "gray"
    if sat < 0.42 and 15 <= hue <= 60: return "earthy brown"
    if sat < 0.35: return "muted gray-" + ("blue" if 190 <= hue <= 270 else "violet" if hue > 270 else "green")
    if hue < 12 or hue >= 345: return "red"
    if hue < 32: return "orange-red"
    if hue < 48: return "orange"
    if hue < 70: return "golden yellow"
    if hue < 160: return "green"
    if hue < 200: return "teal"
    if hue < 250: return "blue"
    if hue < 290: return "violet"
    return "pink"

BODY_TMPL = ("Image 1 is the locked design of this dragon ({name_en}, {role}). Image 2 is only a STYLE REFERENCE (a different dragon): "
 "copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not "
 "include any part, color or feature of the dragon in image 2.\n"
 "IDENTITY LOCK from image 1 (must survive): {color_desc} scale color {hex} with a paler belly, {horn}, the {wing} wings mounted on top of "
 "the back sweeping backward, {tail}, {build}, the large round eye, and its {posture}. {special}"
 "Design notes (Japanese, authoritative): {design}\n"
 "Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and "
 "back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not "
 "glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle "
 "definition, deeper shadows under the wing and along the belly, {expr}. It must still read "
 "instantly as the same dragon as image 1, not as a generic dragon.\n"
 "Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed "
 "lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.")
NOWING_TMPL = ("Edit image 1 with minimal changes: remove BOTH wings completely and fill the exposed back and flank with the dragon's own "
 "scales, matching the existing lighting; keep everything else pixel-identical (pose, head, legs, tail, colors, background). "
 "Output exactly one dragon, no wings, same framing, same flat gray background.")
EXPR_DEFAULT = "a fierce determined brow over the big round eye"
EXPR = {"poro": "a worried, teary expression with big round eyes (no fierce brow)",
        "momu": "the large sleepy half-closed eye kept as is (no fierce brow)", "chiri": "the large sleepy half-closed eye kept as is (no fierce brow)",
        "yumeji": "the large dreamy half-closed eye kept as is (no fierce brow)"}
TIER7 = {"goka": "the flames", "raiou": "the lightning", "souten": "the golden feathers", "fugaku": "the armor plates", "yomi": "the trailing mist"}

def build_entries():
    entries = []
    uniq = parse_unique(); ext = parse_ext()
    for u in uniq:
        m = UNIQ_BY_NAME.get(u["name"], {})
        arch = m.get("archetype", "unique"); style = m.get("style", "front")
        build = BUILD_EN.get(m.get("build", ""), ARCH_EN.get(arch.replace("unique_", ""), ARCH_EN["allrounder"])[0])
        horn = HORN_EN.get(m.get("horn", ""), "swept-back horns"); tail = TAIL_EN.get(m.get("tail", ""), "a spade tail")
        wing = WING_EN.get(m.get("wing", ""), "membrane")
        entries.append(dict(id=u["id"], name=u["name"], color=u["color"], arch=arch, style=style, tier=None,
                            build=build, horn=horn, tail=tail, wing=wing))
    for e in ext:
        a = ARCH_EN.get(e["arch"], ARCH_EN["allrounder"])
        entries.append(dict(id=e["id"], name=e["name"], color=e["color"], arch=e["arch"], style=e["style"], tier=e["tier"],
                            build=a[0], horn=a[1], tail=a[3], wing=a[2]))
    for en in entries:
        sp = SPECIAL.get(en["id"], "")
        if en["id"] in TIER7: sp = (sp + " " if sp else "") + "A subtle rainbow shimmer confined to %s only." % TIER7[en["id"]]
        en["special"] = (sp + " ") if sp else ""
        en["design"] = DESIGN.get(en["id"], "(none)")
        en["prompt"] = BODY_TMPL.format(name_en=en["id"].capitalize(), role="%s / %s racer" % (en["arch"], en["style"]),
                                        color_desc=color_desc(en["color"]), hex=en["color"], horn=en["horn"], wing=en["wing"], tail=en["tail"],
                                        build=en["build"], posture=POSTURE[en["style"]], special=en["special"], design=en["design"],
                                        expr=EXPR.get(en["id"], EXPR_DEFAULT))
        en["prompt_nowing"] = NOWING_TMPL
    # 画像ファイルが実在する id だけ（52頭）
    have = {f[:-4] for f in os.listdir(P("images", "dragons")) if f.endswith(".png")}
    entries = [e for e in entries if e["id"] in have]
    seen = set(); uniq_entries = []
    for e in entries:
        if e["id"] in seen: continue
        seen.add(e["id"]); uniq_entries.append(e)
    return uniq_entries

def write_md(entries):
    out = P("docs", "dragon_v2_kit", "PROMPTS_52.md")
    L = []
    L.append("# 竜V2 生成プロンプト台帳（52頭・機械生成：`python3 tools/dragon_v2_prompts.py`）\n")
    L.append("> 手で編集しない（出典 = js の竜データ・master JSON・confirmed_dragons.md・CODEX_DRAGON_IMAGES_BRIEF.md）。文面を変えるときは "
             "tools/dragon_v2_prompts.py の雛形か docs/DRAGON_V2_COOL_RENDER_DIRECTIVE.md §4/§11.1 を直して再生成する。\n")
    L.append("## 使い方\n")
    L.append("**Higgsfield（本線）**：モデル `nano_banana_pro`（2k・4:3）。medias＝[本人 `images/dragons/<id>.png` を PNG 変換して upload, STYLE_BASE job_id `cfef9354-670c-43f7-ae9b-963a73edef98`]。prompt＝下の「本体」。合格案の job_id 1枚を参照に「翼なし版」。\n")
    L.append("**ChatGPT（クレジット枯渇時のフォールバック・手貼り）**：\n")
    L.append("1. ChatGPT の画像生成で、**添付①＝`images/dragons/<id>.png`**（本人・中身はWebPなので開けない場合は拡張子を .webp に変えて添付）、**添付②＝`images/dragons_v2_staging/_STYLE_BASE_kogane.webp`**。\n")
    L.append("2. 下の「本体」プロンプトを貼り、末尾に **`Output a 2048x1536 PNG with a fully transparent background instead of gray.`** を足す（透過で出れば背景除去が不要）。\n")
    L.append("3. 出来た画像を `images/dragons_v2_staging/<id>_a.png` として保存（透過PNGのまま）。2案目は `<id>_b.png`。\n")
    L.append("4. 採用案を添付して「翼なし版」プロンプトを貼り、`images/dragons_v2_staging/<id>_nowing.png` として保存。\n")
    L.append("5. Claude に「<id> 届いた」と言う → 以降（検収・WebP化・リグ生成・結線）はこちらで実施。\n")
    L.append("\n## 翼なし版（全頭共通・採用案を添付して貼る）\n\n```\n" + NOWING_TMPL + "\n```\n")
    L.append("\n## 52頭\n")
    for i, e in enumerate(entries, 1):
        tier = ("tier%d" % e["tier"]) if e["tier"] else "unique"
        L.append("\n### %d. `%s` — %s（%s / %s / %s / %s）\n" % (i, e["id"], e["name"], e["arch"], e["style"], tier, e["color"]))
        L.append("- 意匠（台帳）：%s\n" % e["design"])
        L.append("- 参照①：`images/dragons/%s.png`　参照②：STYLE_BASE（kogane N1）\n" % e["id"])
        if e["id"] == "kogane": L.append("- **済**：G1 で N1（job `cfef9354-670c-43f7-ae9b-963a73edef98`）を採用。本体は再生成不要・翼なし版のみ必要。\n")
        L.append("\n```\n" + e["prompt"] + "\n```\n")
    open(out, "w", encoding="utf-8").write("".join(L))
    return out

if __name__ == "__main__":
    ents = build_entries()
    if "--json" in sys.argv:
        print(json.dumps(ents, ensure_ascii=False, indent=1)); sys.exit(0)
    out = write_md(ents)
    missing = [e["id"] for e in ents if e["design"] == "(none)"]
    print("entries:", len(ents), "→", os.path.relpath(out, ROOT))
    if missing: print("design notes missing:", missing)
