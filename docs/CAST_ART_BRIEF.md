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
