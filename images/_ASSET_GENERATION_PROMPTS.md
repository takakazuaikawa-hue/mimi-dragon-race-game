# アセット生成プロンプト — 欠落分

既存38+1枚と**画風/世界観を揃える**ためのテンプレと、欠落スロットの具体プロンプト。

## 共通スタイルガイド（全生成に前置き）
```
high-quality Japanese anime / gacha key visual, painterly soft lighting, clean lineless rendering,
world = "Seiryu Island" volcanic-jungle tourist race city: erupting volcano, terraced jungle hillside,
red paper lanterns, wet stone streets, dragon-race banners; palette = jade green, mist white,
volcanic basalt grey, warm gold, lantern red, sea blue; cinematic depth, gentle bloom, 4k, very detailed
```
## 共通ネガティブ
```
lowres, blurry, jpeg artifacts, watermark, signature, broken text, extra fingers, extra limbs,
bad anatomy, deformed hands, off-model, inconsistent colors, modern city, cars, photoreal
```
## キャラ設定ロック（崩さない要素／各シート準拠）
- **サケ・ウダダ**：赤橙ロング＋竜角、褐色肌、部族シャーマン衣装（毛皮/ビーズ/金/赤布）、竜笛、野性的で世話焼き。赤系。
- **ミズ・アオラ**：青髪ショートボブ＋**眼鏡**、セーラー風カジュアル＋ID記者証、データ端末（オッズ画面）、缶コーヒー。青系。
- **スミカ・ラグナ**：黒髪、**竜人**（角・膜翼・鱗尾）、白ブラウス＋黒ベストの秘書、鍵束/書類/羽ペン。緑金。
- **マクラ・クラウン・バズーカー**：紫ツインテ、金×紫の派手衣装、バズーカ型マイク/カメラ、配信者ハイテンション。紫金。
- **セレスティア・ブラックメテオ**：黒髪、星空/銀河ドレス、星のコンパス、（任意で目元の淘汰ノイズ）、超然。紫。
- **ミミ（主役）**：バニー耳＋薄茶ロング、緑金の予想家衣装、出走券/予想紙を持つ、明るく負けず嫌い（画像39準拠）。

---
## テンプレ：顧問ポートレート（cast/*.png, 512²）
```
{共通スタイル}, {キャラ設定ロック}, bust-up portrait, face centered, looking at viewer,
soft studio lighting, simple bokeh background of {キャラのテーマ色} ＋ lantern glow, square composition
neg: {共通ネガティブ}
```
## テンプレ：ストーリーCG（story/N.png, 16:9）
```
{共通スタイル}, {対象キャラ設定ロック}, visual-novel event CG, 16:9, character half/three-quarter body,
expressive face, dramatic scene lighting, background = {シーン}, no UI, no dialogue box, no text
neg: {共通ネガティブ}, ui, hud, dialogue box, letters
```
## テンプレ：出走ドラゴン（collection/dragon_*.png）
```
{共通スタイル}, a racing dragon (wyvern) creature, full body side profile, {体色} scales,
sleek aerodynamic build, expressive eye, dynamic running/flying pose, plain background for cutout
neg: {共通ネガティブ}, human, rider
```

---
## 欠落スロットの具体プロンプト
### story/1.png 第1話「竜王女サケに拾われる」
```
{共通}, Sake Udada (red-haired horned dragon-priestess, tribal shaman outfit, dragon flute),
reaching a hand to a fallen bunny-eared girl (Mimi) on a rainy stone street of Seiryu Island at dusk,
warm rescue mood, lanterns, volcano silhouette, 16:9, no UI/text
```
### story/2.png 第2話「ミズの分析予想」
```
{共通}, Mizu Aoira (blue bob, glasses, casual sailor look) showing an odds/graph tablet to Mimi,
cozy island café with race newspapers, daytime, analytical bright mood, 16:9, no UI/text
```
### story/3.png 第3話「スミカと総資産」
```
{共通}, Sumika Ragna (black-haired dragonkin secretary, horns/wings/tail, ledger & keys) guiding Mimi
through a tidy island residence, household/asset theme, warm green-gold interior, 16:9, no UI/text
```
### story/5.png 第5話「セレスティアの神眼」
```
{共通}, Celestia Blackmeteor (galaxy gown, star compass, faint eye-noise) standing above the race city
under a starry sky, vast cosmic "world ceiling" mood, Mimi looking up small in foreground, 16:9, no UI/text
```
### story/ED.png エンディング「次の物語へ」
```
{共通}, group shot: Mimi (bunny ears) center with Sake, Mizu, Sumika, Makura, Celestia, sunrise over
Seiryu Island race stadium, hopeful celebratory mood, confetti & lanterns, 16:9, no UI/text
```
### ミミ表情/ポートレート（cast/mimi.png ＋ 表情差分）
```
{共通}, Mimi the bunny-eared dragon-race predictor (light-brown long hair, green-gold outfit, holding
betting ticket), bust-up, expression sheet: normal / confident grin / excited / focused / dismayed,
square portraits, simple lantern-bokeh background
```
### 出走ドラゴン（例 3体）
```
1) {ドラゴンテンプレ}, crimson-and-gold scales, fierce front-runner build  (赤金=逃げ)
2) {ドラゴンテンプレ}, jade-green scales with long tail, late-charger build (翠=差し)
3) {ドラゴンテンプレ}, deep-blue scales, sturdy stayer build               (青=stayer)
```

---
## 生成優先順位（高インパクト順）
1. **顧問5枠の顔クロップ**（生成不要・即・最大効果＝相談/ストーリーに顔が出る）
2. **タイトル背景**（39 をそのまま／コード枠だけ追加）
3. **ミミ顔＋表情**（主役の常時露出。ホーム/結果に効く）
4. **story 1/2/3/5/ED**（物語の没入。総資産解放と連動）
5. **出走ドラゴン 数体**（図鑑/レースの竜ビジュアル）
6. story4 の UIなし版（任意・03で暫定可）
```
注：1と2は生成ゼロで今日実装可能。3–5は生成が要る。
```
