# CAST_ART_BRIEF v3 — 画像生成ハンドオフ指示書（Codex向け・2026-07-17）

> **このドキュメントだけで作業が完結するように書いてある。** 会話の文脈は不要。
> リポジトリ: `C:\Users\takakazu\projects\mimi_dragon_race_game`
> 目的: 縦持ちスマホの竜レース賭けゲーム『聖龍爆走録ミミ』の会話（ビジュアルノベル）演出用に、
> キャラ立ち絵の**表情差分**と**VN背景**を生成して所定のフォルダに置く。
> **コード側は配線済み＝指定ファイル名で置くだけで自動的にゲームに反映される。**

---

## 0. 生成担当（Codex）への契約 — 最重要

1. **納品物は画像ファイルのみ。コードは1行も変更しない。**（配線はすべて済んでいる）
2. **必ず参照画像を開いて確認してから生成する。** 同一人物・同一衣装・同一頭身・同一画風の厳守が最優先。似ていない差分は不採用。
3. **⚠️ `images/dragons/` のレース竜ドット絵には絶対に触れない・生成しない**（別ワークフローの管理下）。
4. 1枚できるごとに配置してよい（全部そろうまで待つ必要なし）。欠けていてもゲームは壊れない（404フォールバック完備）。
5. 迷ったら生成せずスキップして報告（間違った絵の混入がいちばん困る）。

## 0.5 共通仕様

| 項目 | 指定 |
|---|---|
| 立ち絵サイズ | **512×768px（2:3縦）** — 既存全立ち絵と同一 |
| 立ち絵形式 | **透過 webp**（背景の書き込み禁止・四隅が完全透過であること） |
| 構図 | 全身・足元まで・下端接地（既存 `images/cast/stand/*.webp` と同じ） |
| 画風 | 既存立ち絵と同一（厚塗り寄りの繊細なアニメ調・暖かい光源）。**言葉より参照画像が正** |
| 差分の原則 | **表情とポーズだけ**変える。衣装・髪型・小物・配色・等身は参照と完全一致 |
| 背景サイズ | **縦持ち用 3:4 または 9:16**（例: 768×1024 / 720×1280）・不透過 webp |
| 禁止 | 文字入れ／透かし／チビ化／画風変更／参照と違う衣装 |

**英語プロンプト共通尾部（立ち絵）**:
`full body standing pose, feet visible, transparent background, painterly anime style matching reference, same character same outfit same proportions as reference, 512x768`
**共通ネガティブ**: `background scenery, text, watermark, extra fingers, different costume, chibi, style change`

**QAチェック（配置前に毎回）**: ①四隅透過か ②足が切れていないか ③衣装・髪色が参照と同じか ④ファイル名が下表と一字一句同じか。

---

## 1. 顧問5人の表情差分 — 優先度★★★（17枚）

- **参照画像（必ず開く）**: `images/cast/stand/sake.webp` / `mizu.webp` / `sumika.webp` / `makura.webp` / `celestia.webp`
- **配置先**: `images/cast/stand/`（参照と同じフォルダ）
- コードは `default/smile/happy/panic/think/serious/sad` の全キーを登録済み＝置くだけで会話中に表情が切り替わる。

| ファイル名 | 表情・ポーズ（日本語の芯） | ENプロンプト種 |
|---|---|---|
| `sake_smile.webp` | ニカッと豪快な笑み。腕組み。親方の余裕 | confident broad grin, arms crossed |
| `sake_happy.webp` | 声を上げて笑う。頭をのけぞらせ気味 | laughing out loud, head tilted back |
| `sake_panic.webp` | 目を剥いて驚く。茶をこぼしかける | wide-eyed shock, almost spilling a teacup |
| `mizu_smile.webp` | 余裕の微笑。片手で帳簿を閉じる | composed knowing smile, closing a ledger with one hand |
| `mizu_happy.webp` | ウィンク | playful wink, hand on hip |
| `mizu_think.webp` | 顎に手・思案 | hand on chin, calculating gaze |
| `mizu_panic.webp` | メガネがずれる驚愕 | startled, glasses slipping down |
| `sumika_smile.webp` | お辞儀気味の淑やかな微笑 | gentle demure smile with a slight bow |
| `sumika_happy.webp` | 手を合わせて小さく喜ぶ | quietly delighted, hands clasped together |
| `sumika_panic.webp` | 書類を取り落とす | flustered, dropping a stack of documents |
| `sumika_serious.webp` | 眼光鋭く（実は賭けに一番熱い顔） | intense sharp-eyed stare, competitive fire |
| `makura_smile.webp` | ニヤリ | smug grin |
| `makura_happy.webp` | マイクを掲げて絶叫アオリ | shouting excitedly, raising a microphone |
| `makura_panic.webp` | 冷や汗・素が出る | nervous sweat, caught off guard |
| `celestia_smile.webp` | 慈愛の微笑 | serene benevolent smile |
| `celestia_serious.webp` | 目を閉じた神性 | eyes closed, divine solemn expression |
| `celestia_sad.webp` | 憂い（下界を見る目） | melancholic downward gaze |

## 2. VN背景 — 優先度★★（8枚・フォルダ新設）

- **配置先**: `images/bg/`（**フォルダを新規作成**）
- **トーン参照**: `images/homebg/` の既存ホーム背景（写実寄り）と、`images/konron/spots/` の観光写真。
- 構図: **下1/3はセリフ枠で隠れる**ので、主役は画面の上2/3に。人物を入れない。

| ファイル名 | 場面 | ENプロンプト種 |
|---|---|---|
| `stable.webp` | 龍舎の内部（藁・木箱・暖色ランタン） | dragon stable interior, straw, wooden crates, warm lantern light |
| `paddock.webp` | レース場パドック（ゲート・砂・観客席遠景） | racetrack paddock, starting gates, sand, distant stands |
| `nightmarket.webp` | 夜市（提灯・屋台の湯気） | tropical night market, paper lanterns, food stall steam |
| `beach.webp` | 浜辺（夕方） | tropical beach at dusk, gentle waves |
| `office.webp` | 行政の窓口（書類の山・木のカウンター） | old government office counter, stacks of documents |
| `studio.webp` | 配信ブース（リングライト・機材） | small streaming booth, ring light, cozy equipment |
| `shrine.webp` | 山頂の社（雲海・星） | mountaintop shrine above a sea of clouds, starry sky |
| `home_room.webp` | ミミの部屋（質素・あたたかい） | small cozy rented room, simple furniture, warm light |

共通尾部: `vertical composition 3:4, main subject in upper two thirds, no people, no text, painterly-realistic blend matching a tropical fantasy island`

## 3. 伏線の「知らないお姉さん」（stranger）— 優先度★★（1〜2枚）

- **参照**: `images/cast/stand/celestia.webp`（同一人物だが**正体を隠す**）
- **配置先**: `images/cast/stand/`
- ⚠️ 暫定はコードのシルエット加工で表示中。本番絵の条件＝**セレスティアと同一人物と分からない**こと。

| ファイル名 | 内容 | ENプロンプト種 |
|---|---|---|
| `stranger.webp` | 星空みたいなドレスの女性。フードを目深に、顔は口元だけ。髪色を隠す | hooded woman in a starry night dress, face hidden except a faint smile, hair concealed |
| `stranger_face.webp`（任意） | フードの奥の口元の微笑（チラ見せ用） | close silhouette, subtle smile under a deep hood |

## 4. ポロ（相棒の子竜）— 優先度★（3枚）

- **参照（必ず開く）**: `images/cast/stand/poro.webp` / `poro_cry.webp` / `poro_surprise.webp`
- **配置先**: `images/cast/stand/`。丸くて小さい泣き虫の子竜。

| ファイル名 | 内容 | ENプロンプト種 |
|---|---|---|
| `poro_happy.webp` | 跳ねて喜ぶ（尻尾ピン） | chubby little dragon jumping with joy, tail straight up |
| `poro_eat.webp` | ほおばる | cheeks stuffed with food, blissful |
| `poro_sleepy.webp` | 目をこする | rubbing eyes sleepily |

## 5. ミミの追加表情 — 優先度★（12枚＝3衣装×4表情）

- **参照（必ず開く）**: `images/cast/mimi/mimi_buniqro_default.webp`（＋同衣装の smile/happy/panic）
- **命名**: `images/cast/mimi/mimi_<outfit>_<expr>.webp`
- 対象衣装: `buniqro`（初期服）/ `newspaper`（予想新聞ドレス）/ `dragonrobe`（竜帝の戴冠衣）
- ※各衣装の参照は `mimi_<outfit>_default.webp` を開くこと。

| expr | 内容 | ENプロンプト種 |
|---|---|---|
| `angry` | ぷんすか（頬ふくらませ） | puffed cheeks, pouting |
| `cry` | 涙目（負けた夜） | teary eyes, holding back a sob |
| `shy` | 照れ（褒められた時） | blushing, bashful smile |
| `kirin` | キリッと決め顔（勝負宣言） | determined sharp gaze, declaration pose |

※この4表情は投入後にこちら（Claude側）で `inferExpr` へ1行ずつ結線する。**Codexはファイルを置くだけでよい。**

## 6. モブのバストアップ — 優先度☆（任意・2枚）

- **配置先**: `images/cast/stand/`（全身でなくバストアップ可・透過）

| ファイル名 | 内容 |
|---|---|
| `announcer.webp` | 実況のお姉さん（マイク・明るい笑顔） |
| `villager.webp` | 村の竜使い（麦わら・人の好い笑顔） |

---

## 納品手順

1. 生成 → 上のQAチェック4項目 → 指定ファイル名で指定フォルダに配置
2. `git add <ファイル>` してコミット（**コード・index.htmlには触れない**。新規ファイル名なのでキャッシュバスター不要）
3. 完了報告に「配置したファイル一覧」と「スキップした項目と理由」を書く

## 優先順（上から順に）

①顧問の表情17枚 → ②背景8枚 → ③stranger → ④ポロ3枚 → ⑤ミミ12枚 → ⑥モブ2枚

---

## ★セレスティアの意匠は「リュック」が核（2026-08-24 ユーザー明示・不可侵）

> ユーザーの言葉：「**最高のギャンブラーなのに見た目はリュックを背負った大学生バックパッカーのようで
> 不思議な魅力がある**、という設定だったんですが……」

**背負っている旅行リュックは、このキャラのギャップの中心＝魅力そのもの。外してはいけない。**
2026-08-24 のセッションで「世界の天井・神眼の存在なのに登山リュックは噛み合わない」と誤判断して
撤去した案を作り、**改悪**と指摘された（[[scope-discipline-only-change-asked]]＝良い既存部分に
勝手な改善を足さない、の違反）。

作り直すときに守るもの（意匠の不可侵リスト）：
- 茶革の旅行リュック（ストラップ・ぶら下がるチャーム）★最重要
- 銀河の生地のガウン／金の鎖と星のコンパス／手の小さな本／黒のヒールサンダル
- 長い黒髪・尖った耳・落ち着いた含み笑い

直してよいのは**描画の質と顔の可読性だけ**（スマホの縦枠で表情が届かないのが唯一の実害）。
デザインの引き算をしない。

### セレスティア 設定資料の正本＝`images/20_sheet_celestia-galaxy_v5-final.png`（三面図・表情6種・持ち物つき）

2026-08-24、ユーザーから資料が提示され、こちらの生成が仕様と食い違っていたことが判明した。
**作る前に必ずこのシートを開く**（生成時は参照画像として渡す＝media_upload → image_references）。

仕様の要点（シートより）：
- **髪**：黒〜**星藍**のグラデーション／肩下レイヤー／旅で少し乱れた束感／片側だけ耳にかけ／
  **細い三つ編みを一本**混ぜる／毛先は軽く外ハネ／前髪は目にかかるが**瞳は隠さない**
- **瞳**：生命淘汰の**神眼**（紫の星のような瞳）
- **衣装**：星空ドレス（黒〜深紫・金の星刺繍・革ベルト/バックル・金鎖・高スリット）
- **持ち物**：**バックパック**（旅らしい大きめの鞄）／**旅ノート**（古い革の記録帳）／
  **星のコンパス**（生命の流れを示す方位磁石）／流星モチーフ（黒い流星）
- **足元**：**黒の編み上げブーツ**（ヒールサンダルではない）
- **表情差分は6種**：通常／微笑み／観察／神眼発動（淡）／呟き／去る時
- **★消失ノイズ**＝世界の修正力による削除信号。**電磁ノイズ／欠損／表示崩れ**（灰白〜透明の水平ノイズ）。
  **星屑や光粒子ではない**。主人公にだけ見える。通常時は出さない
- パレット：深夜の黒／星藍／深紫／銀鼠／白昼光／薄灰／暗赤紫
- 性格：親切で気さく、**距離感がある**。役割＝ブラックメテオ（絶滅の天災）

#### ★セレスティアで外してはいけないもう一つ＝**目力**（2026-08-24 ユーザー指摘）

> 「顔が大きくなって**目力**がなくなったので魅力が減りました」

**生命淘汰の神眼＝強い眼差しが、このキャラの魅力の中心。**
「大人っぽくする」を**目を細める方向で実装すると必ず魅力が落ちる**（2026-08-24 に実際に落ちて撤回）。
大人らしさは**顔の骨格と頭身**（面長・顎のライン・小顔・長い脚）で出し、**瞳は大きいまま**、
むしろ虹彩の星・強いハイライト・濃いまつ毛で**眼力を上げる**。

不可侵リスト（再掲）＝リュック／星空ドレスと小物一式／**大きく強い神眼**／細身で小顔の頭身。

## 生成モデルの作法（2026-08-25 実測）

**立ち絵の本番モデルは `seedream_v5_pro`（Higgsfield）。** これ以外は使わない。
`seedream_v4_5` / `nano_banana_pro` は同じ指示でも「安いアニメ」になる——生地の層・透け・
金彩の質感が出ず、量産テンプレ顔に寄る。カタログ2ページ目はアップスケーラのみなので、
v5_pro が Seedream の最上位で確定。

### 表情差分は i2i で作る（枠が動かない）
確定した1枚を media にアップロードし、それを `medias:[{role:"image_references"}]` に渡して
「**表情だけ変える。構図・スケール・キャンバス上の位置・ポーズ・衣装の皺まで同一**」と書く。
実測：ベース比で被写体bboxの差は最大4px / 2430px（0.16%）＝実質ピクセル一致。
seedream で表情ごとに新規生成すると寄り引きがバラつく（過去の失敗）ので、必ず i2i。

### 落とし穴
- **smile は放っておくと目を閉じる**（＞＜ の笑顔になり目力が消える）。
  「目は参照と同じだけ見開いたまま／閉じるな・弧にするな・細めるな。変わるのは口と頬だけ」
  と明示的に禁止して初めて開いた目の微笑になる。
- 背景抜きは `remove_background` ツール（`image_background_remover`）が最良。
  髪の毛先・シフォンの裾まで白フチ無しで抜け、接地影も落ちる。
  ただし**アップロード済み media を渡すと `_resize.jpg` 経由で解像度が落ちる**（1664→1365）。
  生成 job_id を直接渡せばフル解像度のまま抜ける。
- 出力の設置は「4枚に同一の変換」を掛ける。各画像ごとに bbox 正規化すると裾の差で微妙にズレる。

### 立ち絵の規格
`images/cast/stand/*.webp` ＝ **512x768 / 透過 / 家の標準（38ファイルが同一）**。
CSS は `.dlg-standee img { height:100%; object-fit:contain; object-position:bottom }` なので
**キャンバス寸法と被写体の縦位置が同じなら画面上の見えは一切動かない**。
セレスティアの被写体帯は y=20〜674 で固定すること。

### 格の作法（2026-08-25 決裁）
セレスティアは**最上級の格**。表情は全て「格を落とさない」ことが第一条件。
- **smile ＝ 不敵ではなく泰然**。片口角を上げる smirk・顎を上げる・片眉を上げるは
  「二番手の悪役」の顔で**格が落ちる**。挑発しないのは、相手を試す必要がないから。
  → **左右対称の閉じた微笑／頭は水平／眉は左右同高**。表面は穏やかで底が読めない。
- **serious ＝ 睨みではなく静止**。眉を寄せる・しかめるは「その状況の中にいる人」の顔。
  彼女は状況の**上**にいる。→ 力みゼロの水平な口／正面／揺るぎない視線。
- **sad ＝ 号泣しない**。世界を看取り続けた者の、古びて静かになった哀しみ。
  下瞼がわずかに濡れるだけで、崩れない。
- 4枚すべて**目は見開いたまま**（[[目力]]）。閉じ目・細目・弧目は禁止。

### 足元＝ヒール（不可侵）
**黒の華奢なストラップ・ハイヒールサンダル**（細いヒール／足首ストラップ＋小さな金バックル）。
旅をしながら**ドレスアップしたカジノを巡っている**人物なので、靴はイブニング。
編み上げブーツは旅の実用に寄りすぎて世界観を外す。リュック＋星のドレス＋ヒールの
取り合わせ自体が「不思議な魅力」の正体。
