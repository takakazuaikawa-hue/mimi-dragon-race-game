# 出走ドラゴン 生成プロンプト（全12頭）

ゲームデータ（`data_dragons.js`：識別色・脚質・意匠・性格・`DRAGON_ASSET_BASE`）に完全準拠。
**使い方**：下の【共通スタイル】＋各竜の【個別】を1つにつないで生成。ネガティブも添える。
12頭は**同じ画風・同じ構図・同じ縮尺**で「セット」として揃えるのがコツ（図鑑・賭けカードで横並びになる）。

---
## 【共通スタイル】（各プロンプトの先頭に貼る）
```
high-quality Japanese fantasy key art, painterly anime illustration in a consistent gacha-roster style,
a graceful RACING DRAGON (wyvern: two legs, two wings, long tail, NO rider), full body, dynamic 3/4 side
profile in a mid-run / launching pose that conveys speed, expressive eye, clean cel-painted rendering with
soft rim light and subtle volumetric glow; world = "Seiryu Island" volcanic-jungle race city
(palette accents: jade green, mist white, volcanic stone, gold, lantern red, sea blue);
plain transparent or soft single-color studio background for a clean cutout; consistent framing and scale
across the whole set; 4k, highly detailed, centered.
```
## 【共通ネガティブ】
```
human, rider, saddle, armor on a person, multiple creatures, text, watermark, signature, UI, frame,
lowres, blurry, jpeg artifacts, extra limbs, extra wings, fused wings, deformed anatomy, melted face,
cluttered background, photoreal, 3d render
```
## 一貫性のコツ
- できれば**同じモデル/同じシード系統**で連続生成。最初の1頭を「基準」にして style reference に。
- **透過 or 単色背景**（切り抜き前提）。図鑑の枠に object-fit:cover で収まる。
- 体の向き・カメラ距離・接地ラインを12頭で揃える。色は各 hex を主役に。

---
# 個別プロンプト（共通＋これを連結）

### 1. 赤翼竜ルベル ｜ escape(逃げ) ｜ `dragon_red_wing_lubel`
```
RUBEL, a sleek aerodynamic wyvern in crimson scarlet (#ed5a52), large membrane wings, swept-back horns,
spade-tipped tail, fierce confident face, glowing ember sparks; the flashy famous crowd-favorite
front-runner, short-distance ace. flashy, charismatic, scarlet.
```

### 2. 青翼竜セラム ｜ late(差し) ｜ `dragon_blue_wing_seram`
```
SERAM, a sleek wyvern in clear azure blue (#4f9be8), very large feathered wings, swept horns, finned tail,
calm composed face, flowing wind streamers; a wind-loving late closer with a strong finishing kick.
elegant, serene, azure.
```

### 3. 泣き虫竜ポロ ｜ front(先行) ｜ `dragon_crybaby_poro`
```
PORO, a chubby rounded baby wyvern in teary aqua (#46cbbd), tiny small wings, little nub horns, round soft
tail, big watery teary eyes (oversized), glistening teardrop accents; an adorable crybaby underdog the crowd
adores. cute, endearing, soft.
```

### 4. 岩鱗竜ガンド ｜ front(先行) ｜ `dragon_stone_scale_gando`
```
GANDO, a heavy massive wyvern in earthy stone tan (#b58a5c), small stubby wings, craggy rocky horns, a club
tail, thick stone-plated rocky body, stoic stern face; an earthbound stamina tank, long-distance grinder.
weathered, sturdy, stony.
```

### 5. 霧角竜ミルカ ｜ late(差し) ｜ `dragon_mist_horn_milka`
```
MILKA, a sleek wyvern in misty lavender (#b6a8e6), membrane wings, tall elegant horns, finned tail, smooth
body, serene tranquil face, drifting mist accents; a mysterious calm late closer veiled in fog.
ethereal, quiet, lilac.
```

### 6. 火尾竜バラン ｜ escape(逃げ) ｜ `dragon_fire_tail_baran`
```
BARAN, a sturdy wyvern in burning orange (#f2893f), membrane wings, backward-curving horns, a blazing flame
tail, scaled body, wild ferocious grin, fire and ember accents; a reckless runaway front-runner.
wild, fiery, amber.
```

### 7. 旋爪竜ロッソ ｜ late(差し) ｜ `dragon_turn_claw_rosso`
```
ROSSO, a sleek wyvern in whirlwind green (#5cc25c), membrane wings, swept horns, finned tail, big prominent
claws, sharp keen face, swirling wind accents; an agile cornering specialist and late charger.
sharp, agile, green.
```

### 8. 眠雲竜モム ｜ chase(追込) ｜ `dragon_sleepy_cloud_momu`
```
MOMU, a fluffy round wyvern in sleepy violet (#9d83d4), soft cloud-like fluffy wings, NO horns, a puffy
cloud tail, smooth body, sleepy half-closed small eyes, dreamy haze accents; a laid-back stretch-runner that
flies in from the back. dreamy, cozy, violet.
```

### 9. 鳳凰竜フェニックス ｜ front(先行) ｜ ELITE ｜ `dragon_phoenix_phenix`
```
PHENIX, a majestic wyvern in radiant gold (#f6b81f), huge phoenix-like radiant feathered wings, a crown of
horns, a long flowing plume tail, scaled body, regal noble face, a golden firegold aura (#ffcf52); a
legendary elite champion of overwhelming presence. radiant, regal, golden.
```

### 10. 雷角竜ライカ ｜ escape(逃げ) ｜ ELITE ｜ `dragon_thunder_horn_raika`
```
RAIKA, a sleek wyvern in electric indigo (#6d63ec), membrane wings, jagged thunderbolt horns, a
lightning-bolt tail, scaled body, intense piercing eyes, crackling electric spark accents; an explosive
elite front-runner. electric, intense, indigo.
```

### 11. 星光竜ステラ ｜ late(差し) ｜ ELITE ｜ `dragon_starlight_stella`
```
STELLA, a graceful sleek wyvern in starlight pink (#ec7fb9), large feathered wings, small nub horns, a long
star-trail tail, smooth body, gentle kind face, a sparkling starlight aura (#ffd0ec); an ethereal beloved
elite closer trailing stardust. gentle, radiant, pink.
```

### 12. 氷甲竜グレイズ ｜ front(先行) ｜ ELITE ｜ `dragon_ice_glaze_glaze`
```
GLAZE, a heavy armored wyvern in glacial cyan (#73d3ea), crystalline ice wings, crystal horns, a crystal
tail, frost-plated body, cool composed face, drifting snow accents; an imposing frozen elite tank.
glacial, crystalline, cyan.
```

---
## ファイル名・配置
ゲームの予約規約 `DRAGON_ASSET_BASE`（data_dragons.js）に合わせる。推奨：
```
images/dragons/dragon_red_wing_lubel.png   …（上の各 base 名）.png
```
※ 竜スロットはまだ photoOr 未配線。画像が揃ったら `dragonAssetIds()` の `portrait/icon` を実体化して、図鑑・賭けカード・観戦に配線します（小さめのコード追加）。透過PNG・長辺 768〜1024 目安。

## 生成優先順位
1. **基本8頭**（毎レース登場・露出最大）：ルベル / セラム / ポロ / ガンド / ミルカ / バラン / ロッソ / モム
2. **上位エリート4頭**（高ランク戦の華）：フェニックス / ライカ / ステラ / グレイズ
3. （任意）各頭の **アイコン用バストアップ**（賭けカードの小窓用、512²）
