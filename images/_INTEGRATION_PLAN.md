# 統合プラン — 画像ボード → ゲーム本体

## 1. そのまま使える既存モジュール（変更不要）
`photoOr(src, fallbackHTML)`（ui_render.js:372）と、配線済みのドロップイン枠：
- `images/cast/{key}.png` … 相談画面の顧問ポートレート（renderConsult :525）＋ストーリーの話者（:341）。key= sake/mizu/sumika/makura/celestia。
- `images/story/{id}.png` … ストーリー一枚絵CG（renderStory :338/:473）。id= 1〜5/ED。
- `images/home_vista_day.png` … ホーム上部ビスタ（renderHome :109）。
- `images/home_ambient.png` … ホーム全画面アンビエント背景（renderHome :95）。
→ **正しい名前で置くだけで即表示**。コード変更ゼロで cast 5枠・story 6枠・home 2枠が埋まる。

## 2. 重要なアスペクト整合（ここが肝）
- 背景10〜16・主役39 は **縦長フルスクリーン**（≒9:16）。
- 一方 `home_vista_day` 枠は **横長ショート（高さ170px）バナー**。縦長画像を cover すると水平の細切れになり不向き。
- **結論**：
  - 縦長の街背景（特に夜/夕）は **全画面背景**＝`home_ambient.png` か **タイトル背景**（新規 photoOr 要）に向く。
  - `home_vista_day` 枠には、横長に切り出すか、CSSビスタのまま据え置きが無難。
  - 主役39（縦長キービジュ）は **タイトル背景**が本命。

## 3. 拡張が要るモジュール（コード差分）
### (a) タイトル背景の photoOr 枠を新設（renderTitle）
39（ミミ門前キービジュ）や 10/11（夜/夕背景）をタイトルに敷く。
```js
// renderTitle 内、最背面に：
const tbg = el("div", "title-bg");
tbg.innerHTML = (typeof photoOr === "function"
  ? photoOr("images/title_bg.png", "")   // 無ければ現状の月夜CSSが残る
  : "");
app.appendChild(tbg);
```
```css
.title-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.title-bg .photo-fill{filter:brightness(.7) saturate(1.05);} /* 文字可読性 */
/* #app/.title-* は position:relative;z-index:1 で前面に */
```
採用：`title_bg.png` ← 39_char_mimi-keyvisual-racetrack（または 10/11 背景）。

### (b) ミミのアバター枠（cast/mimi）
ミミは STORY_CAST（顧問5人）に居ないため現状どこにも出ない。ホームのヒーロー枠に追加：
```js
// renderHome のヒーロー：マスコットcanvasの代わり/併設で
photoOr("images/cast/mimi.png", '<canvas class="hb-dragon" ...></canvas>')
```
採用：`cast/mimi.png` ← 39 の**顔クロップ**（正方形・上部）。

### (c) cast ポートレートのトリミング
立ち絵は全身。cast 枠は顔まわり（object-fit:cover）。**顔中心の正方形にクロップ**推奨（未クロップでも表示はされるが胴体寄りになる）。

## 4. 段階ロールアウト
- **α（即・コード変更なし／所要5分）**：home_ambient に夜or夕背景、story/4 にマクラCG を試し置き → 実機確認。
- **β（顔クロップ＋最適化／所要30分）**：cast 5枠＋mimi を顔クロップ。全採用画像を **長辺≦1280px・PNG/WebP圧縮**（後述）して軽量化。
- **γ（コード差分／所要1–2h）**：title_bg 枠と cast/mimi 枠を新設（上記 3a/3b）。
- **δ（生成／別途）**：欠落（story 1/2/3/5/ED、ミミ表情、出走ドラゴン）を Phase6 のプロンプトで生成。

## 5. リスクと対策
| リスク | 対策 |
|---|---|
| **リポジトリ肥大/Pages**：39枚×2–3MB≈100MB。GitHub Pages に全部は重い。 | 採用 finals（約8–10枚）だけを **長辺1080–1280pxへ縮小・圧縮**してコミット。設定シート/旧案/重複は **リポジトリにコミットしない**（ローカル資料として保持、`images/.gitignore` で `*_sheet_*`,`*_v?*` を除外推奨）。 |
| **可読性**：全画面背景の上のUIが読みにくい。 | `.photo-fill` に brightness(.6–.75)＋スクリム（既存 .hw-scrim 相当）を重ねる。 |
| **アスペクト不一致**：縦長画像×横長枠。 | §2 の割り当てに従う（縦長→全画面/タイトル、横長枠はCSS据え置き）。 |
| **顔フレーミング**：cast に全身を入れると胴体寄り。 | 顔正方形クロップを用意（ブラウザcanvasでも可）。 |
| **OneDrive 同期**：追加/改名が同期で競合。 | 連続改名は一括スクリプトで実施済。コミット前に `git status` で確認。 |
| **権利/生成元**：AI生成画像の利用範囲。 | 公開時は生成元の規約に従う（ユーザー判断）。 |

## 6. 次アクション（順番）
1. **採用 finals を決定**（本ドキュメントの★案でOKか確認）。
2. **顔クロップ＋縮小**（cast 5＋mimi、背景は長辺1280へ）。
3. `images/.gitignore` を追加し、採用 finals のみ commit 対象に。
4. α 試し置き → 実機確認（home_ambient＝夜背景、story/4）。
5. γ：title_bg と cast/mimi のコード枠を追加（小さなPR）。
6. 欠落分を Phase6 プロンプトで生成（story CG・ミミ表情・出走ドラゴン）。

> 注：本フェーズでは**実ファイルのスロット配置（コピー）と縮小・コミットは未実行**。フレーミング/容量/見た目はユーザー判断が要るため、上記スクリプト案を用意し、合図で実行します。
