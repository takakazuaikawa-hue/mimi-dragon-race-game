# CLAUDE.md — 聖龍爆走録ミミ 開発ガイド

ブラウザ竜レース予想ゲーム（GitHub Pages配信・純Vanilla JS/CSS/HTML・ビルド無し）。
本番: https://takakazuaikawa-hue.github.io/mimi-dragon-race-game/

## 絶対ルール（最重要・違反禁止）
1. **レースの数値は変更禁止**：着順・オッズ・配当・抽選/賭けの計算（race_engine.js / odds_engine.js / betting_engine.js）。新機能は表示専用・コスメ・メタ進行のみ。
2. **mainへのpush＝即デプロイ**（Pagesがmain直配信・Actions自動・約1分）。壊れたコードをpushしない。
3. **CSS/JSを変更したら index.html の `?v=YYYYMMDDx` を全箇所一括更新**してから同時にコミット（スマホキャッシュ対策。例: `?v=20260612a` → `?v=20260613a` に置換）。
4. classicスクリプト構成：トップレベル `const/function` はファイル間で参照可（windowには載らない）。`<script>` の追加は index.html に列挙。

## 数値・報酬・オンボーディングの憲法
**`docs/GAME_DESIGN_NUMBERS.md` を必ず読む**（1通貨1役割／📦今回の獲得への集約／？ボタン・🆕既読の3点セット／PC=470px固定フレーム）。新しい数値や報酬を足すときはそのチェックリストに従う。

## ファイル構成（要点）
- `index.html` / `style.css`（全画面共通・約3700行）
- `js/ui_render.js` … 全画面のUI描画（最大ファイル）。ホーム=TikTokライブ風（`renderHome`・接頭辞 `hl-`）
- `js/race_canvas.js` … レース描画（canvas）。リグ竜の色替え＝`_rcRigPartImg`（filter非対応端末はピクセル処理に自動フォールバック）
- `js/mall_dungeon.js` … ミニゲーム「リゾートモール探検」（完全表示メタ・コイン非干渉）
- `js/dialogue.js`+`js/data_dialogue.js` … 立ち絵会話システム／`js/event_registry.js` … 全セリフ台帳（足す/消すだけで反映）
- `js/data_assets.js` … 衣装19種（OUTFITS）。立ち絵= `images/cast/mimi/mimi_{outfit}_{default|smile|happy|panic}.webp`
- `js/state.js` … セーブ（localStorage）。`js/sfx.js`（合成SE）/`js/bgm.js`（レースBGM・RACE_BGM_TRACKSに手動列挙）
- `live2d/` … 自作Live2D風ツール＋ランタイム（L2_RIG/L2_PLY）。ホームのマスコット/レース竜が使用

## ホーム（TikTokライブ風）の約束
- **ミミの顔（立ち絵の中央上部）をUIで隠さない**。吹き出しは左・顔より下。
- ホームでVN立ち絵（Dialogue.play）を出さない（大立ち絵と二重になる）。
- ホームの演出タイマーは必ず `window._hlTimers` に登録し `state.ui.screen!=="home"` ガードを付ける。
- `body.home-mode` / `body.title-mode` は position:fixed（スクロール禁止の全画面）。safe-area余白は入れない（全画面没入を優先・ユーザー確認済み）。

## キャラクターの声（セリフを書く時）
- **ミミ＝異世界からの来訪者**：世界の仕組みを説明する側にしない（反応・驚き・質問のみ。「〜です/ます」「〜っ！」）
- コース/レースの解説＝サケ・ウダダ（「〜だ/〜しろ」）／オッズ・期待値の分析＝ミズ（「〜わ」「あはん」）／生活・施設＝スミカ（「ミミ様」）

## 検証
- ローカル: `powershell -File serve.ps1`（port 8766）→ http://localhost:8766/
- コンソールエラー0を維持。スマホ実機はPages本番で確認（反映は版数更新が前提）。
- クラウド環境（Claude Code on Web）はプレビュー実行不可でもよい：構文と整合性を保ち、小さく確実な変更を。
