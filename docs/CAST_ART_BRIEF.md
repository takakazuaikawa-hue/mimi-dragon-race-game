# CAST_ART_BRIEF — 会話演出用アセット生成指示書（2026-07）

> 対象: 会話（VN）演出の強化に必要な立ち絵表情差分・背景。
> 設計正本: docs/NARRATIVE_DESIGN.md §4（演出強化計画）。
> **コード側は404フォールバック完備**＝絵が無くても壊れない。**揃った表情から1枚ずつ投入できる**。
> 生成ツールは Higgsfield（既存キャストと同一トーンを出すため、必ず既存立ち絵を参照画像に添付）。

---

## 0. 全アセット共通仕様

| 項目 | 指定 |
|---|---|
| 形式 | 透過 **webp**（立ち絵）／不透過 webp（背景） |
| 立ち絵の構図 | **全身・足元まで・下端接地**（既存 `images/cast/stand/*.webp` と同じ） |
| 頭身・ライティング | **既存 stand/ の同キャラ画像を参照画像として添付し、同一人物・同一頭身・同一光源**を厳守 |
| 差分の原則 | ポーズ・表情のみ変える。衣装・髪型・小物・配色は既存と完全一致 |
| 命名 | `images/cast/stand/<key>_<expr>.webp`（例: `sake_smile.webp`）。コードは既にこの名前を参照する |
| サイズ | 既存 stand/ と同等（縦1000px級・キャラが画面高の90%） |
| 禁止 | 背景の書き込み（透過必須）／既存と違う画風・等身／文字入れ |

**共通ネガティブ**: background, text, watermark, extra fingers, different costume, chibi

---

## 1. 顧問5人の表情差分（優先度★★★＝紙芝居感の最大要因）

現状は各1枚絵。コードは `img:{default,smile,happy,panic,...}` 形式に対応済み・欠損は default に自動フォールバック。

| ファイル名 | 内容（プロンプトの芯） | 転用候補（背景除去でも可） |
|---|---|---|
| `sake_smile.webp` | サケ：ニカッと豪快な笑み。腕組み。親方の余裕 | — |
| `sake_happy.webp` | サケ：声を上げて笑う。頭をのけぞらせ気味 | `34_char_sake-standing_FINAL` 系 |
| `sake_panic.webp` | サケ：目を剥いて驚く。茶をこぼしかける | — |
| `mizu_smile.webp` | ミズ：余裕の微笑。片手で帳簿を閉じる | — |
| `mizu_happy.webp` | ミズ：ウィンク | ルート `29_char_mizu-standing_v2-wink` を背景除去 |
| `mizu_think.webp` | ミズ：顎に手・思案 | `30_char_mizu-standing_v3-think` を背景除去 |
| `mizu_panic.webp` | ミズ：メガネがずれる驚愕 | — |
| `sumika_smile.webp` | スミカ：お辞儀気味の淑やかな微笑 | — |
| `sumika_happy.webp` | スミカ：手を合わせて小さく喜ぶ | `25_char_sumika-pose_v4` 転用候補 |
| `sumika_panic.webp` | スミカ：書類を取り落とす | — |
| `sumika_serious.webp` | スミカ：眼光鋭く（実は賭けに一番熱い顔） | — |
| `makura_smile.webp` | マクラ：ニヤリ | `v1/v2` 転用候補 |
| `makura_happy.webp` | マクラ：マイクを掲げて絶叫アオリ | — |
| `makura_panic.webp` | マクラ：冷や汗・素が出る | — |
| `celestia_smile.webp` | セレスティア：慈愛の微笑 | `19_char_celestia-standing-galaxy_FINAL` 転用候補 |
| `celestia_serious.webp` | セレスティア：目を閉じた神性 | — |
| `celestia_sad.webp` | セレスティア：憂い（下界を見る目） | — |

## 2. 伏線お姉さん（stranger）

- **暫定はコードで対応済み**（celestia.webp のシルエット加工表示）。本番絵を作るなら:
- `stranger.webp` … フードを目深に被った女性の全身シルエット。**セレスティアと同一人物と分からない**こと（髪色・ドレスを隠す）。夜色。
- `stranger_face.webp` … フードの奥で口元だけ微笑（第5話直前の「チラ見せ」用・任意）

## 3. ポロ（相棒竜）

| ファイル名 | 内容 |
|---|---|
| `poro_happy.webp` | 跳ねて喜ぶ（尻尾ピン） |
| `poro_eat.webp` | ほおばる（`images/cast/ポロ/poro_eat_raw` 系の原石を転用可） |
| `poro_sleepy.webp` | 目をこする |

## 4. ミミの追加表情（主要衣装のみ先行）

対象衣装: buniqro（初期）/ newspaper / dragonrobe の3着から。
`images/cast/mimi/<outfit>_<expr>.webp` 形式（outfitImg の既存規約）。

| expr | 内容 |
|---|---|
| `angry` | ぷんすか（頬ふくらませ） |
| `cry` | 涙目（負けた夜） |
| `shy` | 照れ（褒められた時） |
| `kirin` | キリッと決め顔（勝負宣言） |

※投入時は dialogue.js の `inferExpr` に対応正規表現を1行ずつ追加（例: 「〜っ！／悔し」→angry）。

## 5. モブのバストアップ（絵文字卒業・任意）

| ファイル名 | 内容 |
|---|---|
| `announcer.webp` | 実況のお姉さん（マイク・バストアップ可） |
| `villager.webp` | 村の竜使い（麦わら・人の好い笑顔） |

## 6. 背景（新設 `images/bg/`・優先度★★）

VNの背後にクロスフェード表示（コード実装済み想定・下1/3はセリフ枠で隠れる構図に）。
**16:9でなく縦持ちスマホ用（9:16 or 3:4）**。写実寄りの既存ホーム背景（images/homebg/）とトーンを合わせる。

| ファイル名 | 場面 | 使う会話 |
|---|---|---|
| `stable.webp` | 龍舎の内部（藁・木箱・暖色） | ポロ発見アーク・八竜集結 |
| `paddock.webp` | レース場パドック（ゲート・砂） | レース系イベント・最終決戦 |
| `nightmarket.webp` | 夜市（提灯・屋台の湯気） | 食べ歩き・観光イベント |
| `beach.webp` | 浜辺（夕方） | 観光・セレスティア |
| `office.webp` | 行政の窓口（書類の山） | スミカ回 |
| `studio.webp` | 配信ブース（リングライト） | マクラ回・SNS |
| `shrine.webp` | 山頂の社（雲海） | 終章・神眼 |
| `home_room.webp` | ミミの部屋（既存 myroom_t* 転用可） | 暮らし回 |

---

## 投入手順（1枚ずつでOK）

1. 生成 → 背景透過を確認 → 上記ファイル名で `images/cast/stand/`（背景は `images/bg/`）へ配置
2. `git add` → コミット（キャッシュは新ファイル名なので ?v 不要）
3. 立ち絵表情はコードが自動で拾う（登録済みのオブジェクト形式）。背景は台本の `bg:"nightmarket"` で指定
