# レスポンシブ・ガードレール（PC/スマホ両対応の恒久ルール）

監査(`docs/RESPONSIVE_AUDIT.md`)で見つけた問題を**二度と再発させない**ための規約とチェックリスト。
新しい画面・演出・入力を足す前後に、ここを必ず通す。自動検出は **`js/devcheck.js`** の `responsiveSelfCheck()`（設定デバッグの「🩺自己診断」）。

> 大前提：**縦型ポートレートは王道**（TikTok配信風＋大立ち絵）。横長化はしない。スマホ実機(<540px)が基準、PC/タブレットは中央縦枠。レース数値には触れない（[[race-math-immutable]]）。

## 🥇 標準ブレークポイント（新規はこれに寄せる・乱立させない）
| 区分 | 条件 | 役割 |
|---|---|---|
| 小スマホ | `max-width: 420px` | 余白/フォント微縮小 |
| スマホ基準 | `< 540px` | 全幅・フレーム無し（既定） |
| 縦枠(PC/タブレット) | `min-width: 540px` | 470px中央縦枠＋左右アンビエント（`style.css` の該当`@media`） |
| 横向き/低い高さ | `max-height: 680px` 等 | 縦に詰める・全画面ノースクロール厳禁 |

## ✅ 出荷前チェックリスト（CSS/レイアウトを触ったら）
1. **🩺自己診断を実行**（設定→デバッグ→🩺、または console で `responsiveSelfCheck()` / 全画面は `await responsiveSelfCheckAll()`）。`✅問題なし`を確認。
2. プレビューを **360 / 390（縦スマホ）** で横スクロールが出ない（`scrollWidth==clientWidth`）。
3. **740×360（横スマホ）** で操作部（レースボタン/ナビ/送信）が画面内に収まり、ダメならスクロールできる（＝`position:fixed`で閉じ込めない）。
4. **557 / 1280（PC枠）** で中央470px＋左右アンビエントが成立、列が“端末”として見える。
5. ノッチ端末を想定：上下端の操作は `env(safe-area-inset-*)` を使う。

## 📏 CSS規約
- **高さは `dvh`/`svh` を使う。`100vh` は使わない**（iOSのURLバーでズレる）。やむを得ず使うなら `min-height: calc(100dvh ...)`。`100vh` を足すと🩺が検出する。
- **全画面ノースクロール（`body{position:fixed}`）は“縦持ち・十分な高さ”専用**。低い高さ/横向きでは fixed を解いてスクロールを許す（H1の教訓）。
- 横幅を固定pxで決め打ちしない（`max-width`はOK、`width:◯◯px`で本文を固定しない）。`minmax(◯px,1fr)`の最小は狭幅コンテナ幅を超えない値に。
- `touch-action: manipulation` / `-webkit-tap-highlight-color: transparent` / `overscroll-behavior: none` は土台で維持（既設）。
- ホバーだけで成立するUIを作らない（タッチで出ない）。`:hover` は装飾の上乗せに留める。

## ⌨️ 入力規約（iOS自動ズーム防止）
- テキスト入力（`input[type=text/number]`/`textarea`/`contenteditable`）の **`font-size` は 16px 以上**。小さく見せたい時は `transform: scale()` で。16px未満は🩺が検出。

## 🈳 表示規約（壊れ表示を出さない）
- テンプレの**フォールバックに「？」「undefined」「NaN」を残さない**。値が無い時は文面を変える（例「村レベルが上がりました」）。`が ？ に`/`undefined`/`NaN`/`${`/`[object` は🪧が検出（M2の教訓・[event_registry.js](../js/event_registry.js)）。
- 冗長な説明文はインラインに常駐させず、**「？/ミミに聞く」で必要な時だけ展開**（[[ui-compact-drilldown]]）。

## 🆕 新しい画面を足す時
1. `renderXxx()` を書く → `js/nav.js SCREEN_INDEX` と `screenMap()` に1行 → `docs/CODEMAP.md §3` に1行。
2. ホーム導線（`ui_home.js` の `hl-rail`）に必要なら追加。
3. **🩺自己診断を 360 / 740×360 / 1280 で実行**し `✅`。
4. デプロイは git plumbing＋`index.html` の `?v=` 一括更新（[[deploy-method]]）。

関連：[[responsive-pc-frame]]（方針と既知課題）／[[dev-workflow-fast-preview]]（?go=直接ジャンプ）。
