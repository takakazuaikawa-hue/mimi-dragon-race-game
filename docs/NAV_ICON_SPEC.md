# フッター・ナビアイコン仕様（5枚）— NAV_ICON_SPEC

ホーム下部フッターの5タブ用アイコン。**箱方式**：`images/nav/<key>.webp` を置くだけで
`js/ui_home.js` の `tikTab` が絵文字を自動で差し替える（無ければ絵文字のまま＝安全）。
差し替え・更新時は `js/ui_home.js` の `const NAV_ICON_V = "1"` を bump してキャッシュ撃破。

## 置き場所とファイル名（この5つだけ）
| key | ファイル名 | タブ | 意味 | 差し替え前の絵文字 |
|---|---|---|---|---|
| island  | `images/nav/island.webp`  | 島     | 崑崙島の観光ハブ（食べ歩き/買い物） | 🏝️ |
| kurashi | `images/nav/kurashi.webp` | 暮らし | 経済/くらしツリー/習い事/物語/相談 | 🌳 |
| meal    | `images/nav/meal.webp`    | ごはん | 食べ歩きコレクション（勝ち飯/負け飯） | 🍽️ |
| sns     | `images/nav/sns.webp`     | SNS    | タイムライン/ファンレター（配信のみ） | 📱 |
| stable  | `images/nav/stable.webp`  | 龍舎   | 竜のハブ（図鑑/スカウト/ポロを集約）＝5番目の本命 | 🏠 |
| dex     | `images/nav/dex.webp`     | 図鑑   | 龍舎解放前(早期)だけ出る暫定タブ。優先度低・後回し可 | 📖 |

※5番目タブは進行で変化：龍舎解放前は「図鑑(dex)」、解放後は「龍舎(stable)」。配信モード(第4話以降)は
常に龍舎なので、優先して用意すべきは **island / kurashi / meal / sns / stable の5枚**。dex は早期のみで任意。

## 画像の技術仕様（5枚で厳守＝統一感の要）
- **正方形・透過PNG/WebP**（背景は完全透過）。推奨 256×256（表示は26px前後）。
- 被写体は**中央・単一オブジェクト**、余白は上下左右に均等（画面では丸い枠に入る）。
- **小さく潰しても意味が伝わるシルエット**（ディテール過多は禁物）。
- 5枚とも**同じ線幅・同じ光源（上から）・同じ塗り・同じ余白**。バラつきは即NG。

## 画風（マスタールール・全5枚共通）
崑崙島（南国）の世界観に合う、**フラットで可愛いイラストアイコン**。
- 太めの丸い輪郭線、ふっくらしたシェイプ、やわらかい陰影（2〜3階調）。
- パレット：ティール/エメラルド＋ゴールド＋コーラルの暖色島トーン（ゲーム本編と同系）。
- 質感：ほんの少しのハイライトで艶を出す＝「作り込まれた」印象。安っぽいクリップアート感は禁止。
- 文字・記号は入れない（アイコンのみ）。

### 共通ネガティブ
`text, letters, watermark, drop shadow on background, photo, realistic, 3d render, harsh gradient, busy background, multiple objects, frame/border box`

## 個別プロンプト（英語・上のマスタールールに続けて使う）
- **island**：`a small tropical volcanic island: one palm tree, a rounded green isle, a gentle volcano peak with a soft warm glow, calm teal water base`
- **kurashi**：`a cozy little island cottage with a small tree beside it, warm window light — signifies "home & daily life"`
- **meal**：`a steaming rice/ramen bowl with chopsticks, appetizing and cute, small heat swirl`
- **sns**：`a smartphone showing a heart/chat bubble on screen — signifies social feed, playful`
- **stable**：`a cozy dragon stable/roost: a small barn-house with a round window and a tiny curled dragon inside — the dragon hub`
- **dex**（任意・早期のみ）：`an open book with a tiny cute dragon silhouette rising from the page — a monster field guide`

## 確認手順（置いた後）
1. `images/nav/` に5枚を配置 → `NAV_ICON_V` を bump。
2. `?go=home`（配信モード）で 375 / 390 / 430 幅を確認：5枚が同じ大きさ・同じ画風で並ぶか。
3. ロック中（島=初勝利前/図鑑=初的中前）は自動で半透明＋🔒が付く＝そのままでOK。
4. 静かモードは4枚（島/暮らし/ごはん/図鑑）＝均等flexで自動調整。
