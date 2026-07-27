# 磨き残し 指示書（Opus 5 向け・2026-07-28）

> 生成×3D×RPG化（`docs/GENERATIVE_3D_RPG_DIRECTIVE.md`）の全フェーズ完了後のユーザー検収で
> 「要所に粗」との指摘。即修正できる分は済ませた（live `ddae842`＝戦闘ミミ立ち絵／図鑑リスナー漏れ／
> TEX_Vバンプ／古コメント）。**本書は残った“重い粗”の直し方**。1タスク=1セッション目安。
>
> **絶対規律は MINIGAME_LEVELUP_DIRECTIVE §0 の8条をそのまま適用**（レース数値不可侵／通貨不増／門番／
> perl+両ブランチデプロイ／検証してから完了と言う／スコープ規律）。編集のたび grep 実体確認、
> コミット後 git log 確認。ツール出力が読めなくなったら**即座に止めてユーザーに報告**。

---

## 0. 検証レシピ（Browserペイン非表示でも回る・実証済み）

1. スクラッチパッドの `devserver.js` を `node` で起動（プロジェクト配信＋ `POST /_shot?n=` でcanvas保存＋
   `GET/POST /_ls` でlocalStorage橋渡し＋ `/_s/` でスクラッチパッド配信）。無ければ
   メモリ [[browser-pane-hidden-shot-server]] の手順で作り直す（8768番）。
2. `?go=<screen>` で直行（`nav.js` SCREEN_INDEX）。歩けるマップ=`konron_walk`／モール=`mall_rpg`。
3. rAFが止まる環境では**描画関数を手で呼んで** `/_shot` に保存し、Readで目視。
4. webp化は スクラッチパッドに `npm i sharp`（PIL/ffmpeg/ImageMagickは無い）。
5. デプロイ＝[[deploy-method]] の git plumbing（fetch→read-tree→add→commit-tree→push main と flying-pixel-dragons）。

---

## 1. 【最重要】歩けるマップ4枚の画風統一

**粗の正体**：4エリアの背景の画風がバラバラ。
- `images/scene/konron/city.webp` ＝ **やわらかいペイント調**（決裁2「SNES風ペイント調」に合致・**これが基準**）
- `race.webp` ＝ ドット絵調（ピクセルがはっきり見える）
- `beach.webp` ＝ ドット絵調（Stardew風）
- `onsen.webp` ＝ 太い輪郭線のカートゥーン調

エリアを歩いて移動するたび画風が変わる＝[[screen-transition-continuity]] に反する。

**やること**：`race` / `onsen` / `beach` の3枚を **city と同じ画風で再生成**して差し替える。

1. `balance` 確認（3枚×4候補=6cr＋2k upscale 3枚=3cr 目安。200切りそうなら停止して報告）。
2. プロンプトは **city 生成時の原文を土台に**（このセッションの実績。要素だけ差し替える）：
   ```
   Top-down three-quarter overhead view of a small JRPG town map, painted SNES 16-bit
   role-playing-game style, soft painterly gouache look with clear readable shapes.
   {エリア固有の内容...}
   Warm golden colours, gentle top-light, no harsh shadows. Paths clearly connect every
   building and every doorway is clearly visible from above. Flat game-map projection,
   no camera perspective distortion, no vignette. No text, no letters, no numbers,
   no icons, no UI, no people.
   ```
   ★鍵は `soft painterly gouache look`。現行3枚の生成時は `crisp outlines` を足したのがドット絵化の原因と推定。
   `pixel` という語を**絶対に入れない**。エリア固有部は現行3枚の生成プロンプト（git log の該当コミット参照）から流用。
3. QA：4候補から「①cityと並べて画風が揃う ②道と戸口が読める ③文字焼き込み無し」で1枚選抜。
   **cityと選抜候補を横に並べた比較画像を作って目視**すること（単体で見ると揃って見える罠）。
4. 2k upscale → 1920×1440 webp（q86）→ 差し替え。
5. **コリジョン再実測（必須）**：構図が変わるので `js/scene_konron.js` の該当エリアの `map` 32×24 を
   実測し直す。手順＝10%グリッド合成→起こす→**赤塗りオーバーレイで突き合わせ**→BFSで
   「開始地点から全入口へ歩いて到達」を機械検証（このセッションで使った検証スクリプトの形はコミット
   `b69dbee` のメッセージと `scene_konron.js` のコメント参照）。door/npc/start のセル座標も画に合わせて調整。
6. `KW_V` バンプ→実機で4エリア一巡スクショ→両ブランチ。

**受け入れ基準**：4エリアの背景を1枚に並べて画風が揃って見える／全エリアBFS ALL GREEN／err0。

---

## 2. 【中】ミニアニメ素材の軽量化（任意）

`images/fx/clip_masterpiece.mp4` が **3.0MB**（他は0.6〜1.2MB）。遅延ロードなので致命ではないが、
モバイル回線だと傑作の瞬間に間に合わない恐れ。
- seedance で **duration 4秒のまま 480p/fast** で再生成してもよい（6cr）。「全面が常に光で満ちている」
  指定は維持（薄いと見えない＝実測済み。生成後は**再生しながら**光る画素率を測る。シーク計測は黒が返る罠）。
- 受け入れ：1.5MB以下・光る画素率40%以上・screen合成の見え方を実機スクショ。

## 3. 【低】GLB残り18体（任意・高コスト）

`image_to_3d` は1体30cr。全部で540cr（残高と相談。**やるなら数体ずつユーザーに確認**）。
手順はメモリ [[generative-3d-rpg-phases]] の「GLBを焼いてビルボード化するときの手順」どおり
（media_upload→image_to_3d texture付き→スクラッチパッドの `bake.html`（`/_s/bake.html`）で16コマ焼き→
`images/rpg/turn/<id>.webp` 納品＝**置くだけで図鑑が回り出す**）。
★bake は「行列を組まずuniformで回す」「保存前に中身%チェック」を崩さないこと。

---

## 4. やらないこと

- レース数値・オッズ・配当・モール報酬・ずかん収集判定に触れる変更
- 竜のHD-2Dドット絵52頭（確定画風・不可侵＝[[dragon-visual-overhaul-hd2d]]）
- ミミ歩行スプライト（横向きの向きは検証済みで正しい）・タワー階のスラグ（fi>=8で正しく"tower"に落ちる）
