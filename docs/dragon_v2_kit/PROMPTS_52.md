# 竜V2 生成プロンプト台帳（52頭・機械生成：`python3 tools/dragon_v2_prompts.py`）
> 手で編集しない（出典 = js の竜データ・master JSON・confirmed_dragons.md・CODEX_DRAGON_IMAGES_BRIEF.md）。文面を変えるときは tools/dragon_v2_prompts.py の雛形か docs/DRAGON_V2_COOL_RENDER_DIRECTIVE.md §4/§11.1 を直して再生成する。
## 使い方
**Higgsfield（本線）**：モデル `nano_banana_pro`（2k・4:3）。medias＝[本人 `images/dragons/<id>.png` を PNG 変換して upload, STYLE_BASE job_id `cfef9354-670c-43f7-ae9b-963a73edef98`]。prompt＝下の「本体」。合格案の job_id 1枚を参照に「翼なし版」。
**ChatGPT（クレジット枯渇時のフォールバック・手貼り）**：
1. ChatGPT の画像生成で、**添付①＝`images/dragons/<id>.png`**（本人・中身はWebPなので開けない場合は拡張子を .webp に変えて添付）、**添付②＝`images/dragons_v2_staging/_STYLE_BASE_kogane.webp`**。
2. 下の「本体」プロンプトを貼り、末尾に **`Output a 2048x1536 PNG with a fully transparent background instead of gray.`** を足す（透過で出れば背景除去が不要）。
3. 出来た画像を `images/dragons_v2_staging/<id>_a.png` として保存（透過PNGのまま）。2案目は `<id>_b.png`。
4. 採用案を添付して「翼なし版」プロンプトを貼り、`images/dragons_v2_staging/<id>_nowing.png` として保存。
5. Claude に「<id> 届いた」と言う → 以降（検収・WebP化・リグ生成・結線）はこちらで実施。

## 翼なし版（全頭共通・採用案を添付して貼る）

```
Edit image 1 with minimal changes: remove BOTH wings completely and fill the exposed back and flank with the dragon's own scales, matching the existing lighting; keep everything else pixel-identical (pose, head, legs, tail, colors, background). Output exactly one dragon, no wings, same framing, same flat gray background.
```

## 52頭

### 1. `rubel` — 赤翼竜ルベル（unique_speed_escape / escape / unique / #ed5a52）
- 意匠（台帳）：OK
- 参照①：`images/dragons/rubel.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Rubel, unique_speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): red scale color #ed5a52 with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a spade tail, a sleek build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): OK
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 2. `seram` — 青翼竜セラム（unique_wing_closer / late / unique / #4f9be8）
- 意匠（台帳）：頭大・羽毛蒼翼を背側スイープ・後脚流し/前足小畳み/前傾
- 参照①：`images/dragons/seram.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Seram, unique_wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #4f9be8 with a paler belly, swept-back horns, the large feathered wings mounted on top of the back sweeping backward, a fin tail, a sleek build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 頭大・羽毛蒼翼を背側スイープ・後脚流し/前足小畳み/前傾
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 3. `poro` — 泣き虫竜ポロ（unique_crybaby / front / unique / #46cbbd）
- 意匠（台帳）：頭低く前傾ダイブ・涙目・翼上・赤蝶ネクタイ
- 参照①：`images/dragons/poro.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Poro, unique_crybaby / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): teal scale color #46cbbd with a paler belly, small nub horns, the small membrane wings mounted on top of the back sweeping backward, a short round tail, a small chubby build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. This is the crybaby child dragon: keep it small and chubby with tiny wings, big teary eyes with a tear, and its red bow tie. Design notes (Japanese, authoritative): 頭低く前傾ダイブ・涙目・翼上・赤蝶ネクタイ
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a worried, teary expression with big round eyes (no fierce brow). It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 4. `gando` — 岩鱗竜ガンド（unique_stamina_tank / front / unique / #b58a5c）
- 意匠（台帳）：岩体/岩角/棍棒尾・大きい丸目・頭<尻尾の前傾ダイブ
- 参照①：`images/dragons/gando.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Gando, unique_stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange-red scale color #b58a5c with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a rock club tail, a heavy build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 岩体/岩角/棍棒尾・大きい丸目・頭<尻尾の前傾ダイブ
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 5. `miruka` — 霧角竜ミルカ（unique_fog_mystic / late / unique / #b6a8e6）
- 意匠（台帳）：白い背高角・大丸目・ヒレ尾・滑らか体・水平グライド(優雅・ダイブ不採用)
- 参照①：`images/dragons/miruka.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Miruka, unique_fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #b6a8e6 with a paler belly, tall white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a sleek build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 白い背高角・大丸目・ヒレ尾・滑らか体・水平グライド(優雅・ダイブ不採用)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 6. `baran` — 火尾竜バラン（unique_fire_bruiser / escape / unique / #f2893f）
- 意匠（台帳）：橙・燃える炎尾(高め)・ガッシリ重戦士・ゴツ鱗・後ろ反り角・背棘・membrane翼・キリッと大丸目・水平+少し前傾
- 参照①：`images/dragons/baran.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Baran, unique_fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange-red scale color #f2893f with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 橙・燃える炎尾(高め)・ガッシリ重戦士・ゴツ鱗・後ろ反り角・背棘・membrane翼・キリッと大丸目・水平+少し前傾
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 7. `rosso` — 旋爪竜ロッソ（unique_turn_tech / late / unique / #5cc25c）
- 意匠（台帳）：緑・旋爪(大きな爪)・俊敏ラプター体型・ヒレ尾・membrane翼・大きい頭/丸目・水平
- 参照①：`images/dragons/rosso.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Rosso, unique_turn_tech / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): green scale color #5cc25c with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a sleek build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 緑・旋爪(大きな爪)・俊敏ラプター体型・ヒレ尾・membrane翼・大きい頭/丸目・水平
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 8. `momu` — 眠雲竜モム（unique_cloud_chaser / chase / unique / #9d83d4）
- 意匠（台帳）：確定。旧3Dモム参照→HD-2D化。丸い頭・とろ目・ぷっくり紫#9d83d4・背の雲&雲尾・角なし(雲フリル)
- 参照①：`images/dragons/momu.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Momu, unique_cloud_chaser / chase racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): violet scale color #9d83d4 with a paler belly, no horns (a soft frill on the head instead), the cloud-material wings mounted on top of the back sweeping backward, a cloud tail, a soft rounded build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Sleepy cloud dragon: cloud-material wings and tail, no horns, and a large sleepy half-closed eye. Design notes (Japanese, authoritative): 確定。旧3Dモム参照→HD-2D化。丸い頭・とろ目・ぷっくり紫#9d83d4・背の雲&雲尾・角なし(雲フリル)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, the large sleepy half-closed eye kept as is (no fierce brow). It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 9. `phenix` — 鳳凰竜フェニックス（unique_phoenix / front / unique / #f6b81f）
- 意匠（台帳）：前足畳み版
- 参照①：`images/dragons/phenix.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Phenix, unique_phoenix / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange scale color #f6b81f with a paler belly, a star crown with a forehead star, the membrane wings mounted on top of the back sweeping backward, a spade tail, a sleek build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Phoenix dragon: large feathered phoenix wings and a feathered tail, forelegs folded. Design notes (Japanese, authoritative): 前足畳み版
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 10. `raika` — 雷角竜ライカ（unique_speed_escape / escape / unique / #6d63ec）
- 意匠（台帳）：インディゴ#6d63ec・稲妻ボルト角・雷ボルト尾・全身に電気ヴェイン(シアン)+背の雷クレスト・membrane翼・大丸目・水平基調(案A)
- 参照①：`images/dragons/raika.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Raika, unique_speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #6d63ec with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a lightning-bolt tail, a sleek build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Thunder dragon: lightning-bolt horns and a bolt tail, cyan electric veins over the body and a thunder crest on the back. Design notes (Japanese, authoritative): インディゴ#6d63ec・稲妻ボルト角・雷ボルト尾・全身に電気ヴェイン(シアン)+背の雷クレスト・membrane翼・大丸目・水平基調(案A)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 11. `stella` — 星光竜ステラ（unique_wing_closer / late / unique / #ec7fb9）
- 意匠（台帳）：ピンク#ec7fb9・大羽毛翼に金星チップ(星の翼)・彗星startrail尾(大星+小星)・黒ライン=鱗テクスチャ+白い星光点(宇宙感)・かっこいい竜頭+星冠+額星・元の大丸目・水平グライド(差し・案A)
- 参照①：`images/dragons/stella.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Stella, unique_wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): pink scale color #ec7fb9 with a paler belly, small nub horns, the large feathered wings mounted on top of the back sweeping backward, a spade tail, a sleek build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Starlight dragon: feathered wings with gold star tips, a comet star-trail tail with one big star and small stars, a cosmic scale texture with white star points, and a star crown with a forehead star. Design notes (Japanese, authoritative): ピンク#ec7fb9・大羽毛翼に金星チップ(星の翼)・彗星startrail尾(大星+小星)・黒ライン=鱗テクスチャ+白い星光点(宇宙感)・かっこいい竜頭+星冠+額星・元の大丸目・水平グライド(差し・案A)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 12. `glaze` — 氷甲竜グレイズ（unique_stamina_tank / front / unique / #73d3ea）
- 意匠（台帳）：氷シアン#73d3ea・氷の甲(結晶装甲鱗)・クリスタル角/尾・氷翼・控えめ虹の屈折(翼膜/角/尾/甲エッジ)・冷静顔+大丸目・前傾グライド(先行・案1)
- 参照①：`images/dragons/glaze.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Glaze, unique_stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): teal scale color #73d3ea with a paler belly, crystal horns, the ice-crystal wings mounted on top of the back sweeping backward, a crystal tail, a heavy build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Ice dragon: crystal ice-armor scales, crystal horns and tail, ice wings, and a subtle rainbow refraction on the wing membrane, horns and tail edges. Design notes (Japanese, authoritative): 氷シアン#73d3ea・氷の甲(結晶装甲鱗)・クリスタル角/尾・氷翼・控えめ虹の屈折(翼膜/角/尾/甲エッジ)・冷静顔+大丸目・前傾グライド(先行・案1)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 13. `kogane` — 金鱗竜コガネ（allrounder / front / tier1 / #e0b94a）
- 意匠（台帳）：★allrounder基本形テンプレ。金鱗・バランス体・membrane翼・後反り角・標準尾・元画像の眼を切出し移植・水平
- 参照①：`images/dragons/kogane.png`　参照②：STYLE_BASE（kogane N1）
- **済**：G1 で N1（job `cfef9354-670c-43f7-ae9b-963a73edef98`）を採用。本体は再生成不要・翼なし版のみ必要。

```
Image 1 is the locked design of this dragon (Kogane, allrounder / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange scale color #e0b94a with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a standard spade-tipped tail, a balanced build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): ★allrounder基本形テンプレ。金鱗・バランス体・membrane翼・後反り角・標準尾・元画像の眼を切出し移植・水平
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 14. `susu` — 煤煙竜スス（fire_bruiser / escape / tier1 / #7a6a5a）
- 意匠（台帳）：煤グレー#7a6a5a・燻る煙の尾&鬣
- 参照①：`images/dragons/susu.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Susu, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): earthy brown scale color #7a6a5a with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 煤グレー#7a6a5a・燻る煙の尾&鬣
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 15. `nagi` — 凪翼竜ナギ（wing_closer / late / tier1 / #8fd0c0）
- 意匠（台帳）：翠青#8fd0c0・凪の穏やか大翼
- 参照①：`images/dragons/nagi.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Nagi, wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-green scale color #8fd0c0 with a paler belly, swept-back horns, the very large wings mounted on top of the back sweeping backward, a standard tail, a balanced glider build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 翠青#8fd0c0・凪の穏やか大翼
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 16. `goro` — 轟岩竜ゴロー（stamina_tank / front / tier1 / #9a8466）
- 意匠（台帳）：砂茶#9a8466・丸い巨岩を背負う
- 参照①：`images/dragons/goro.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Goro, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): earthy brown scale color #9a8466 with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 砂茶#9a8466・丸い巨岩を背負う
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 17. `chiri` — 塵雲竜チリ（cloud_chaser / chase / tier1 / #a99bc0）
- 意匠（台帳）：小柄な新人・小さな塵っぽい雲の翼と尾・ふらりと視線が定まらない（大きめ半目）
- 参照①：`images/dragons/chiri.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Chiri, cloud_chaser / chase racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #a99bc0 with a paler belly, no horns (a cloud frill on the head instead), the cloud-material wings mounted on top of the back sweeping backward, a cloud tail, a soft rounded build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Small rookie cloud dragon with small dusty cloud wings and tail and a large sleepy half-closed eye. Design notes (Japanese, authoritative): 小柄な新人・小さな塵っぽい雲の翼と尾・ふらりと視線が定まらない（大きめ半目）
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, the large sleepy half-closed eye kept as is (no fierce brow). It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 18. `akane` — 茜翼竜アカネ（speed_escape / escape / tier2 / #e8714a）
- 意匠（台帳）：茜#e8714a・夕焼け大翼・雌化(まつ毛/しなやか)
- 参照①：`images/dragons/akane.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Akane, speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange-red scale color #e8714a with a paler belly, swept-back horns, the large membrane wings mounted on top of the back sweeping backward, a blade-finned tail, a slim, fast build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 茜#e8714a・夕焼け大翼・雌化(まつ毛/しなやか)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 19. `tsumuji` — 旋風竜ツムジ（turn_tech / late / tier2 / #6cc28a）
- 意匠（台帳）：小柄で若い・爪と尾先が渦（旋風）のカール
- 参照①：`images/dragons/tsumuji.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Tsumuji, turn_tech / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): green scale color #6cc28a with a paler belly, short swept horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, an agile raptor build with big curved claws, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 小柄で若い・爪と尾先が渦（旋風）のカール
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 20. `yoi` — 宵霧竜ヨイ（fog_mystic / late / tier2 / #9aa6c8）
- 意匠（台帳）：宵闇の薄霧を首〜背に沿わせる・白い長角・物静かな伏し目がち（でも大丸目）
- 参照①：`images/dragons/yoi.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Yoi, fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #9aa6c8 with a paler belly, long white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a slender, elegant build with a smooth body, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 宵闇の薄霧を首〜背に沿わせる・白い長角・物静かな伏し目がち（でも大丸目）
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 21. `hibana` — 火花竜ヒバナ（fire_bruiser / escape / tier2 / #f0863a）
- 意匠（台帳）：橙#f0863a・火花の尾
- 参照①：`images/dragons/hibana.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Hibana, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange-red scale color #f0863a with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 橙#f0863a・火花の尾
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 22. `shio` — 潮翼竜シオ（wing_closer / late / tier2 / #4aa8d0）
- 意匠（台帳）：潮青#4aa8d0・波形の翼＆尾
- 参照①：`images/dragons/shio.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Shio, wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): teal scale color #4aa8d0 with a paler belly, swept-back horns, the very large wings mounted on top of the back sweeping backward, a standard tail, a balanced glider build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 潮青#4aa8d0・波形の翼＆尾
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 23. `kabe` — 岩壁竜カベ（stamina_tank / front / tier2 / #8a7a64）
- 意匠（台帳）：灰茶#8a7a64・石壁ブロック装甲(要塞)
- 参照①：`images/dragons/kabe.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Kabe, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): earthy brown scale color #8a7a64 with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 灰茶#8a7a64・石壁ブロック装甲(要塞)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 24. `benio` — 紅尾竜ベニオ（fire_bruiser / escape / tier3 / #e24a52）
- 意匠（台帳）：紅#e24a52・紅蓮の炎尾
- 参照①：`images/dragons/benio.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Benio, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): red scale color #e24a52 with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 紅#e24a52・紅蓮の炎尾
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 25. `kazemaru` — 疾風竜カゼマル（speed_escape / escape / tier3 / #5ac0e0）
- 意匠（台帳）：シアン#5ac0e0・疾風大翼・忍者マフラー
- 参照①：`images/dragons/kazemaru.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Kazemaru, speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): teal scale color #5ac0e0 with a paler belly, swept-back horns, the large membrane wings mounted on top of the back sweeping backward, a blade-finned tail, a slim, fast build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): シアン#5ac0e0・疾風大翼・忍者マフラー
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 26. `sazare` — 細波竜サザレ（turn_tech / late / tier3 / #58c272）
- 意匠（台帳）：鱗が細波模様の列・涼やかな流線
- 参照①：`images/dragons/sazare.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Sazare, turn_tech / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): green scale color #58c272 with a paler belly, short swept horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, an agile raptor build with big curved claws, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 鱗が細波模様の列・涼やかな流線
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 27. `murasame` — 叢雨竜ムラサメ（fog_mystic / late / tier3 / #8e9ad6）
- 意匠（台帳）：雨滴形の角と鱗・濡れたような艶（離散段で）・渋い佇まい
- 参照①：`images/dragons/murasame.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Murasame, fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #8e9ad6 with a paler belly, long white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a slender, elegant build with a smooth body, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 雨滴形の角と鱗・濡れたような艶（離散段で）・渋い佇まい
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 28. `taiga` — 大牙竜タイガ（stamina_tank / front / tier3 / #a07850）
- 意匠（台帳）：黄茶#a07850・突き出す大牙＋岩体
- 参照①：`images/dragons/taiga.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Taiga, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange-red scale color #a07850 with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 黄茶#a07850・突き出す大牙＋岩体
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 29. `yumeji` — 夢路竜ユメジ（cloud_chaser / chase / tier3 / #9d88d0）
- 意匠（台帳）：夢見の雲（ふんわり大きめ・夢の泡のような玉を含む）・とろんと夢うつつの大きめ半目
- 参照①：`images/dragons/yumeji.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Yumeji, cloud_chaser / chase racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #9d88d0 with a paler belly, no horns (a cloud frill on the head instead), the cloud-material wings mounted on top of the back sweeping backward, a cloud tail, a soft rounded build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Dreamy cloud dragon with big soft cloud wings containing dream-bubble orbs and a large dreamy half-closed eye. Design notes (Japanese, authoritative): 夢見の雲（ふんわり大きめ・夢の泡のような玉を含む）・とろんと夢うつつの大きめ半目
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, the large dreamy half-closed eye kept as is (no fierce brow). It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 30. `shakunetsu` — 灼熱竜シャク（fire_bruiser / escape / tier4 / #f06028）
- 意匠（台帳）：灼橙#f06028・燃える鬣
- 参照①：`images/dragons/shakunetsu.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Shakunetsu, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): orange-red scale color #f06028 with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 灼橙#f06028・燃える鬣
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 31. `hayate` — 颯竜ハヤテ（speed_escape / escape / tier4 / #48b0e8）
- 意匠（台帳）：空青#48b0e8・刃ヒレ/尾・忍者覆面
- 参照①：`images/dragons/hayate.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Hayate, speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #48b0e8 with a paler belly, swept-back horns, the large membrane wings mounted on top of the back sweeping backward, a blade-finned tail, a slim, fast build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 空青#48b0e8・刃ヒレ/尾・忍者覆面
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 32. `arashi` — 嵐翼竜アラシ（wing_closer / late / tier4 / #5a8ad8）
- 意匠（台帳）：群青#5a8ad8・嵐雲色の荒々しい翼
- 参照①：`images/dragons/arashi.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Arashi, wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #5a8ad8 with a paler belly, swept-back horns, the very large wings mounted on top of the back sweeping backward, a standard tail, a balanced glider build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 群青#5a8ad8・嵐雲色の荒々しい翼
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 33. `konron` — 崑崙竜コンロン（stamina_tank / front / tier4 / #8e7a5c）
- 意匠（台帳）：灰褐#8e7a5c・背に山嶺の峰(荘厳)
- 参照①：`images/dragons/konron.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Konron, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): earthy brown scale color #8e7a5c with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 灰褐#8e7a5c・背に山嶺の峰(荘厳)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 34. `shirahae` — 白南風竜シラハエ（fog_mystic / late / tier4 / #a0b0d0）
- 意匠（台帳）：白い霧のたてがみが初夏の風になびく・優美・人気薄の色気
- 参照①：`images/dragons/shirahae.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Shirahae, fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #a0b0d0 with a paler belly, long white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a slender, elegant build with a smooth body, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 白い霧のたてがみが初夏の風になびく・優美・人気薄の色気
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 35. `kirari` — 煌竜キラリ（turn_tech / late / tier4 / #5cc888）
- 意匠（台帳）：鱗に宝石のような煌めきの面（離散段のハイライトで・グロー禁止）
- 参照①：`images/dragons/kirari.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Kirari, turn_tech / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): green scale color #5cc888 with a paler belly, short swept horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, an agile raptor build with big curved claws, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 鱗に宝石のような煌めきの面（離散段のハイライトで・グロー禁止）
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 36. `guren` — 紅蓮竜グレン（fire_bruiser / escape / tier5 / #e0463e）
- 意匠（台帳）：深紅#e0463e・荒ぶる業火
- 参照①：`images/dragons/guren.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Guren, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): red scale color #e0463e with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 深紅#e0463e・荒ぶる業火
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 37. `raijin` — 雷迅竜ライジン（speed_escape / escape / tier5 / #6a64e8）
- 意匠（台帳）：藍#6a64e8・稲妻の角
- 参照①：`images/dragons/raijin.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Raijin, speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #6a64e8 with a paler belly, swept-back horns, the large membrane wings mounted on top of the back sweeping backward, a blade-finned tail, a slim, fast build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 藍#6a64e8・稲妻の角
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 38. `sora` — 蒼穹竜ソラ（wing_closer / late / tier5 / #4a92dc）
- 意匠（台帳）：蒼穹#4a92dc・澄んだ大空の翼
- 参照①：`images/dragons/sora.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Sora, wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #4a92dc with a paler belly, swept-back horns, the very large wings mounted on top of the back sweeping backward, a standard tail, a balanced glider build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 蒼穹#4a92dc・澄んだ大空の翼
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 39. `banju` — 磐樹竜バンジュ（stamina_tank / front / tier5 / #7a8a5c）
- 意匠（台帳）：苔緑#7a8a5c・岩＋樹木/苔/枝角
- 参照①：`images/dragons/banju.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Banju, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-green scale color #7a8a5c with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 苔緑#7a8a5c・岩＋樹木/苔/枝角
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 40. `gekka` — 月華竜ゲッカ（fog_mystic / late / tier5 / #a088d4）
- 意匠（台帳）：三日月形の角・夜靄を薄く纏う・月夜の気品
- 参照①：`images/dragons/gekka.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Gekka, fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): violet scale color #a088d4 with a paler belly, long white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a slender, elegant build with a smooth body, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 三日月形の角・夜靄を薄く纏う・月夜の気品
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 41. `senpu` — 穿風竜センプ（turn_tech / late / tier5 / #54c096）
- 意匠（台帳）：錐のように鋭い爪と尾・風を穿つ前掛かりの体勢（※脚質は差し＝水平基調のまま）
- 参照①：`images/dragons/senpu.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Senpu, turn_tech / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): green scale color #54c096 with a paler belly, short swept horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, an agile raptor build with big curved claws, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 錐のように鋭い爪と尾・風を穿つ前掛かりの体勢（※脚質は差し＝水平基調のまま）
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 42. `enma` — 炎魔竜エンマ（fire_bruiser / escape / tier6 / #e84028）
- 意匠（台帳）：朱#e84028・前方槍型の角＋獄火(大丸目維持)
- 参照①：`images/dragons/enma.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Enma, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): red scale color #e84028 with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 朱#e84028・前方槍型の角＋獄火(大丸目維持)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 43. `hayao` — 疾風皇竜ハヤオ（speed_escape / escape / tier6 / #3aa0e0）
- 意匠（台帳）：青#3aa0e0・刃の鬣＋大翼(上位)
- 参照①：`images/dragons/hayao.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Hayao, speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #3aa0e0 with a paler belly, swept-back horns, the large membrane wings mounted on top of the back sweeping backward, a blade-finned tail, a slim, fast build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 青#3aa0e0・刃の鬣＋大翼(上位)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 44. `tenku` — 天空竜テンク（wing_closer / late / tier6 / #4a86e0）
- 意匠（台帳）：王青#4a86e0・最大級の壮麗な翼
- 参照①：`images/dragons/tenku.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Tenku, wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #4a86e0 with a paler belly, swept-back horns, the very large wings mounted on top of the back sweeping backward, a standard tail, a balanced glider build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 王青#4a86e0・最大級の壮麗な翼
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 45. `gozan` — 豪山竜ゴウザン（stamina_tank / front / tier6 / #8a7252）
- 意匠（台帳）：茶#8a7252・巨岩塊の豪山(上位)
- 参照①：`images/dragons/gozan.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Gozan, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): earthy brown scale color #8a7252 with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Design notes (Japanese, authoritative): 茶#8a7252・巨岩塊の豪山(上位)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 46. `yugiri` — 夕霧竜ユウギリ（fog_mystic / late / tier6 / #9888c8）
- 意匠（台帳）：夕霧の帳（薄い被膜）を体側に纏う上位竜・翼縁が夕暮れ色
- 参照①：`images/dragons/yugiri.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Yugiri, fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #9888c8 with a paler belly, long white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a slender, elegant build with a smooth body, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 夕霧の帳（薄い被膜）を体側に纏う上位竜・翼縁が夕暮れ色
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 47. `reppu` — 裂風竜レップウ（turn_tech / late / tier6 / #50c884）
- 意匠（台帳）：刃のような爪・精悍な上位竜・体側に風を裂いた切れ込み模様
- 参照①：`images/dragons/reppu.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Reppu, turn_tech / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): green scale color #50c884 with a paler belly, short swept horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, an agile raptor build with big curved claws, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. Design notes (Japanese, authoritative): 刃のような爪・精悍な上位竜・体側に風を裂いた切れ込み模様
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 48. `goka` — 業火神竜ゴウカ（fire_bruiser / escape / tier7 / #f03820）
- 意匠（台帳）：朱橙#f03820・神焔＋全身うっすら虹スモーク
- 参照①：`images/dragons/goka.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Goka, fire_bruiser / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): red scale color #f03820 with a paler belly, swept-back horns, the membrane wings mounted on top of the back sweeping backward, a burning flame tail, a heavy bruiser build with rugged thick scales and back spikes, the large round eye, and its forward-leaning flying direction with the head lower than the tail. A subtle rainbow shimmer confined to the flames only. Design notes (Japanese, authoritative): 朱橙#f03820・神焔＋全身うっすら虹スモーク
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 49. `raiou` — 雷王竜ライオウ（speed_escape / escape / tier7 / #6058f0）
- 意匠（台帳）：青紫#6058f0・雷の翼＋虹電気＋雷尾(最上位)
- 参照①：`images/dragons/raiou.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Raiou, speed_escape / escape racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #6058f0 with a paler belly, swept-back horns, the large membrane wings mounted on top of the back sweeping backward, a blade-finned tail, a slim, fast build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. A subtle rainbow shimmer confined to the lightning only. Design notes (Japanese, authoritative): 青紫#6058f0・雷の翼＋虹電気＋雷尾(最上位)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 50. `souten` — 蒼天神竜ソウテン（wing_closer / late / tier7 / #3a80ea）
- 意匠（台帳）：深蒼#3a80ea・金の羽毛神翼＋虹シマー＋金の王冠(最上位)
- 参照①：`images/dragons/souten.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Souten, wing_closer / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): blue scale color #3a80ea with a paler belly, swept-back horns, the very large wings mounted on top of the back sweeping backward, a standard tail, a balanced glider build, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. A subtle rainbow shimmer confined to the golden feathers only. Design notes (Japanese, authoritative): 深蒼#3a80ea・金の羽毛神翼＋虹シマー＋金の王冠(最上位)
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 51. `fugaku` — 不岳竜フガク（stamina_tank / front / tier7 / #8c7858）
- 意匠（台帳）：鉄茶#8c7858・黒鉄岩装甲(最上位)。★要望「虹いろの岩石のきらめきを少しだけ」＝鉄岩装甲にラブラドライト/オパール調の虹鉱物光沢を淡く→クレジット復活後に調整
- 参照①：`images/dragons/fugaku.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Fugaku, stamina_tank / front racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): earthy brown scale color #8c7858 with a paler belly, rock horns, the small membrane wings mounted on top of the back sweeping backward, a club tail, a heavy rock-armored build, the large round eye, and its forward-leaning flying direction with the head lower than the tail. Black-iron rock armor plates with a faint labradorite/opal iridescence on a few plates only. A subtle rainbow shimmer confined to the armor plates only. Design notes (Japanese, authoritative): 鉄茶#8c7858・黒鉄岩装甲(最上位)。★要望「虹いろの岩石のきらめきを少しだけ」＝鉄岩装甲にラブラドライト/オパール調の虹鉱物光沢を淡く→クレジット復活後に調整
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```

### 52. `yomi` — 黄泉霧竜ヨミ（fog_mystic / late / tier7 / #9080c0）
- 意匠（台帳）：最上位・幽玄。黄泉の霧を長く曳き、霧の中にうっすら虹の靄（tier7の流儀＝gouka/raiou/soutenと同様、体の一部として控えめに）・伏兵の静けさ
- 参照①：`images/dragons/yomi.png`　参照②：STYLE_BASE（kogane N1）

```
Image 1 is the locked design of this dragon (Yomi, fog_mystic / late racer). Image 2 is only a STYLE REFERENCE (a different dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): muted gray-blue scale color #9080c0 with a paler belly, long white horns, the membrane wings mounted on top of the back sweeping backward, a fin tail, a slender, elegant build with a smooth body, the large round eye, and its horizontal gliding direction with the head level or slightly above the tail. A subtle rainbow shimmer confined to the trailing mist only. Design notes (Japanese, authoritative): 最上位・幽玄。黄泉の霧を長く曳き、霧の中にうっすら虹の靄（tier7の流儀＝gouka/raiou/soutenと同様、体の一部として控えめに）・伏兵の静けさ
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns, tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects, no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```
