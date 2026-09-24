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
    "phenix": "Phoenix dragon: large feathered phoenix wings, a peacock crest and a peacock-feather tail, forelegs folded.",
    "stella": "Starlight dragon: feathered wings with gold star tips and a cosmic scale texture with white star points.",
    "raika":  "Thunder dragon: lightning-bolt horns and a bolt tail, cyan electric veins over the body and a thunder crest on the back.",
    "glaze":  "Ice dragon: crystal ice-armor scales, crystal horns and tail, ice wings, and a subtle rainbow refraction on the wing membrane, horns and tail edges.",
    "fugaku": "Black-iron rock armor plates with a faint labradorite/opal iridescence on a few plates only.",
    "chiri":  "Small rookie cloud dragon with small dusty cloud wings and tail and a large sleepy half-closed eye.",
    "yumeji": "Dreamy cloud dragon with big soft cloud wings containing dream-bubble orbs and a large dreamy half-closed eye.",
}
# 固有12頭は master JSON の造形語が HD-2D 確定スプライトとズレている（poro の体色＝紫・gando＝灰岩・phenix＝孔雀冠 等）。
# 「画像1が正」なので、スプライトを目視して書いた語で上書きする（color, horn, wing, tail, build, posture）。
UNIQ_VISUAL = {
    "rubel":  ("crimson red scale color #ed5a52 with a cream belly", "swept-back horns with a small spiked crest", "large bat-like membrane",
               "a long whip tail ending in a spade tip with a few ember flecks", "a sleek, long-bodied build", "slightly forward-leaning flying direction with the head a little lower than the tail"),
    "seram":  ("sky-blue scale color #4f9be8 with a paler belly", "two short swept-back horn fins", "large pale-blue feathered",
               "a long tail ending in a fish-like fin", "a sleek build with a long slender neck", "horizontal gliding direction with the head level or slightly raised"),
    "poro":   ("purple scale color (as in image 1, around #9a6ad0) with a lavender belly", "curled brown ram horns", "small purple membrane",
               "a short pointed tail", "a small chubby child build", "gentle diving posture with the head level and the body tilted slightly forward"),
    "gando":  ("stone-tan gray-brown rock color #b58a5c", "jagged rock horns", "small rocky membrane",
               "a rock club tail ending in a round boulder", "a heavy, low, rock-plated armored build", "forward-leaning flying direction with the head lower than the tail"),
    "miruka": ("pale lavender scale color #b6a8e6 with a whiter belly", "two tall curved pale horns", "lavender membrane",
               "a long tail ending in a forked fin", "a slender smooth build", "horizontal gliding direction with the head level or slightly raised"),
    "baran":  ("orange scale color #f2893f with a paler belly", "swept-back horns", "orange membrane",
               "a tail held high with a burning flame at the tip", "a heavy bruiser build with rugged ridged scales and back spikes", "nearly horizontal direction with a slight forward lean"),
    "rosso":  ("green scale color #5cc25c with a paler belly", "spiky swept-back horns and cheek frills", "large green membrane",
               "a long thin tail with a fin tip", "a lean raptor build with long legs and big hooked claws", "horizontal gliding direction with the head level"),
    "momu":   ("lavender-violet scale color #9d83d4 with a paler belly", "no horns (a fluffy cloud frill on the head and neck instead)", "big white cloud-material",
               "a white cloud-puff tail", "a soft rounded build", "horizontal gliding direction with the head level"),
    "phenix": ("golden yellow scale color #f6b81f", "a peacock-feather crest of teal and gold eyespot feathers on the head", "large golden feathered",
               "a long peacock-feather tail with an eyespot", "a sleek build with the forelegs folded", "slightly forward-leaning flying direction with the head a little lower than the tail"),
    "raika":  ("indigo scale color #6d63ec with a paler belly", "pale yellow-cyan lightning-bolt horns and back crest", "dark indigo membrane",
               "a lightning-bolt tail", "a sleek build covered in glowing cyan electric vein lines", "nearly horizontal direction with the head very slightly lower than the tail"),
    "stella": ("pink scale color #ec7fb9 with a paler belly", "small horns with a star crown and a forehead star", "large pink feathered",
               "a tail ending in one big gold star with small stars", "a sleek build with a fine cosmic crackle-line scale texture", "horizontal gliding direction with the head level"),
    "glaze":  ("icy cyan scale color #73d3ea", "crystal horns", "icy translucent membrane",
               "a long tail with crystal spikes", "a heavy build armored in crystalline ice plates", "forward-leaning flying direction with the head lower than the tail"),
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
    if hue < 40: return "orange"
    if hue < 70: return "golden yellow"
    if hue < 160: return "green"
    if hue < 200: return "teal"
    if hue < 250: return "blue"
    if hue < 290: return "violet"
    return "pink"

# 参照は本人HD-2Dの1枚だけ（2026-09-23 Phase 2 実測：STYLE_BASE を2枚目に渡すと 24案中15案が kogane の骨格・翼・角に収束した。
# 1枚参照＋画風のテキスト指定は 14/14 で本人のシルエットを保ち、画風・光も揃った）。
BODY_TMPL = ("Image 1 is the locked design of this dragon ({name_en}, {role}). Redraw exactly this dragon, keeping its exact silhouette, "
 "pose, body proportions, head shape and size, horn shape, wing shape and placement, leg positions and tail shape from image 1 so the "
 "outline nearly overlaps image 1. Change only the rendering: turn the pixel art into a premium stylized 3D creature render, like the key "
 "art of a AAA monster-collecting RPG (soft subsurface shading, sculpted overlapping scale plates, smooth satin surfaces, clean studio render).\n"
 "IDENTITY LOCK from image 1 (must survive): {color_phrase}, {horn}, the {wing} wings mounted on top of "
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

# 図鑑39頭：アーキタイプ共通の造形語はスプライトとズレる（stamina_tank 6頭は元から翼なし・chiri は角あり・murasame は雨粒角 等）。
# Phase 3（2026-09-24）で実際に使って合格した文面を docs/dragon_v2_kit/dex_overrides.json に置き、ここで上書きする。
DEX = json.load(open(P("docs", "dragon_v2_kit", "dex_overrides.json"), encoding="utf-8"))
IDENT_RE = re.compile(r"(IDENTITY LOCK from image 1 \(must survive\): ).*?(Design notes)", re.S)

def apply_dex(en):
    i = en["id"]
    if i in DEX["identity"]:   # 固有の飾り（tier7 の虹など）は identity 側に書き込み済み
        en["prompt"] = IDENT_RE.sub(lambda m: m.group(1) + DEX["identity"][i] + " " + m.group(2), en["prompt"], count=1)
    wingless = i in DEX["wingless"]
    reps = (DEX["l2"]["_wingless"] if wingless else []) + DEX["l2"].get(i, [])
    if wingless:
        reps = [["wing shape and placement, ", ""]] + reps
    for old, new in reps:
        en["prompt"] = en["prompt"].replace(old, new)
    en["wingless"] = wingless
    if wingless:
        en["prompt_nowing"] = None
    elif i in DEX["keep"]:
        en["prompt_nowing"] = NOWING_TMPL.replace("Output exactly one dragon", DEX["keep"][i] + " Output exactly one dragon")

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
        color_phrase = "%s scale color %s with a paler belly" % (color_desc(en["color"]), en["color"])
        posture = POSTURE[en["style"]]
        if en["id"] in UNIQ_VISUAL:
            color_phrase, en["horn"], en["wing"], en["tail"], en["build"], posture = UNIQ_VISUAL[en["id"]]
        en["prompt"] = BODY_TMPL.format(name_en=en["id"].capitalize(), role="%s / %s racer" % (en["arch"], en["style"]),
                                        color_phrase=color_phrase, horn=en["horn"], wing=en["wing"], tail=en["tail"],
                                        build=en["build"], posture=posture, special=en["special"], design=en["design"],
                                        expr=EXPR.get(en["id"], EXPR_DEFAULT))
        en["prompt_nowing"] = NOWING_TMPL
        apply_dex(en)
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
    L.append("**Higgsfield（本線）**：モデル `nano_banana_pro`（2k・4:3）。medias＝[本人 `images/dragons/<id>.png` を PNG 変換して upload] の**1枚だけ**（STYLE_BASE を2枚目に渡すと kogane に収束する＝§2e）。prompt＝下の「本体」。合格案の job_id 1枚を参照に「翼なし版」。\n")
    L.append("**ChatGPT（クレジット枯渇時のフォールバック・手貼り）**：\n")
    L.append("1. ChatGPT の画像生成で、**添付＝`images/dragons/<id>.png` の1枚だけ**（本人・中身はWebPなので開けない場合は拡張子を .webp に変えて添付）。画風参照の竜は添付しない（別の竜に収束する）。\n")
    L.append("2. 下の「本体」プロンプトを貼り、末尾に **`Output a 2048x1536 PNG with a fully transparent background instead of gray.`** を足す（透過で出れば背景除去が不要）。\n")
    L.append("3. 出来た画像を `images/dragons_v2_staging/<id>_a.png` として保存（透過PNGのまま）。2案目は `<id>_b.png`。\n")
    L.append("4. 採用案を添付して「翼なし版」プロンプトを貼り、`images/dragons_v2_staging/<id>_nowing.png` として保存。\n")
    L.append("5. Claude に「<id> 届いた」と言う → 以降（検収・WebP化・リグ生成・結線）はこちらで実施。\n")
    L.append("\n## 翼なし版（採用案を添付して貼る）\n\n共通文面は下。翼以外の飾り（冠・尾・トゲ・霧など）がある竜は、各頭の欄の「翼なし版」を使う（飾りを残せと明記した版）。"
             "元から翼の無い竜（stamina_tank の6頭）は翼なし版を作らない（`tools/dragon_v2_rig.py rig <id> --wingless`）。\n\n```\n" + NOWING_TMPL + "\n```\n")
    L.append("\n## 52頭\n")
    for i, e in enumerate(entries, 1):
        tier = ("tier%d" % e["tier"]) if e["tier"] else "unique"
        L.append("\n### %d. `%s` — %s（%s / %s / %s / %s）\n" % (i, e["id"], e["name"], e["arch"], e["style"], tier, e["color"]))
        L.append("- 意匠（台帳）：%s\n" % e["design"])
        L.append("- 参照：`images/dragons/%s.png` の1枚だけ\n" % e["id"])
        if e["id"] == "kogane": L.append("- **済**：G1 で N1（job `cfef9354-670c-43f7-ae9b-963a73edef98`）を採用。本体は再生成不要・翼なし版のみ必要。\n")
        L.append("\n```\n" + e["prompt"] + "\n```\n")
        if e.get("wingless"):
            L.append("- 翼なし版：不要（元から翼が無い）\n")
        elif e.get("prompt_nowing") and e["prompt_nowing"] != NOWING_TMPL:
            L.append("- 翼なし版（この竜専用）：\n\n```\n" + e["prompt_nowing"] + "\n```\n")
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
