# 聖龍爆走録ミミ — コードマップ（CODEMAP）

このファイルは**コードベース全体の単一地図**。新しい画面・機能・engineを足す前に、まずここで「どこに何があるか／どこに足すか」を把握する。
保守と開発速度のための索引なので、**機能を足したらここも1行更新する**（特に画面を足したら `js/nav.js SCREEN_INDEX` と本書の画面表）。

> 🚫 **最重要ルール**：レースの**着順・オッズ・配当・FinalPower計算は不変**（`docs/GAME_DESIGN_NUMBERS.md`）。新機能は原則**表示専用メタ**（cosmetic/collection/progression）。唯一の例外は神眼コンサルト（任意・1レース・着順不変）。詳細 `docs/PARIMUTUEL_ORACLE_VS_HOUSE.md`／終章 `docs/epilogue_extinction_design.md`。

---

## 1. 全体アーキテクチャ（フレームワーク無し・classic script・グローバル共有）

モジュールシステム無し。`index.html` が**読み込み順**で全`<script>`を読む（順序が依存関係）。トップレベルの `const/function` は**全ファイル横断で見える**（`window`には基本載らない＝`typeof X==="function"`でガード可）。状態は単一の `state`（`js/state.js`）。

読み込み順（`index.html`）：
```
utils → data_*（純データ）→ state → *_engine（純ロジック）→ race_canvas
→ event_hooks → event_registry → goals → meals → ui_render（全DOM描画）
→ mall_rpg → dialogue → data_dialogue → poro → poro_gourmet
→ epilogue_engine → data_ending → ending_engine → live2d/* → dragon_live2d
→ sim_tools → nav（画面レジストリ）→ main（起動）
```

---

## 2. ファイル一覧（層別・規模）

| 層 | ファイル | 役割 |
|---|---|---|
| 起動 | `js/main.js` | DOMContentLoaded＝load→init→`?go=`ルート or タイトル。各種リスナ。 |
| **ルーティング** | `js/nav.js` ★新 | **画面レジストリ `SCREEN_INDEX`／`screenMap()`／`goto(name)`／`rerenderCurrent()`／`applyStartupRoute()`（`?go=`直接ジャンプ）**。 |
| 状態 | `js/state.js` (349) | `state`（player/assets/lifeTree/ui/current）＋save/load＋進行ヘルパ。 |
| データ | `js/data_*.js` | dragons / dragons_ext / courses / weather / ranks / assets / races / dialogue / ending。純データ＋拡張コメント。 |
| レースengine | `race_engine`(309) `odds_engine`(146) `betting_engine`(57) `analysis_engine`(138) | 着順・オッズ・配当・期待値。**ここは数値の聖域＝不変**。 |
| レース描画 | `js/race_canvas.js` (3118) | レース実況のcanvas（スプライト走行・カウントダウン・テロップ・ハート）。 |
| 実況 | `broadcast_engine`(274) `commentary_engine`(296) `commentary_data`(173) `race_timeline_engine`(364) `recap_engine`(299) | 放送データ・実況文・タイムライン・ふりかえり。 |
| 暮らし/資産 | `assets_engine`(199) `lifetree_engine`(255) ＋ `data_assets`(599) | 総資産・暮らしステージ・くらしツリー(約200 LIFE_MILESTONES)・衣装(OUTFITS)。 |
| **UI（巨大）** | `js/ui_render.js` (4929) | **全画面のDOM描画＋ポップ＋演出**。`beginScreen()`（共通枠＋戻る`TOP_BACK`）＋`renderX()`群。★最大ファイル＝将来の分割候補(§6)。 |
| モール | `js/mall_rpg.js` (2073) | お買い物ダンジョン（ローグライク・独立通貨／`outfitsWon`・表示メタ）。 |
| VN | `dialogue`(399) `data_dialogue`(98) | 立ち絵セリフ（`Dialogue.play`→Promise・cast自動取込）。 |
| 相棒ポロ | `poro`(416) `poro_gourmet`(285) | 発見/鑑定アーク・龍舎・スカウト・グルメレース（表示メタ）。 |
| ホーム・メタ収集 | `goals`(91) `meals`(185) | 🎯目標(クエスト)／🍽️食事(みみしんぼ)。`done(state)`/`mealUnlocked`で判定する表示専用。 |
| 終章/ED | `epilogue_engine`(274) `data_ending`(140) `ending_engine`(354) | 伏線→絶滅メーター→最終決戦→スタッフロール。全て表示メタ。 |
| 音 | `sfx`(284) `bgm`(135) | 合成SE／レースBGM。`setVolume/setMuted/playFile`。 |
| Live2D | `dragon_live2d`(58) ＋ `live2d/js/*` | リグ竜ランタイム（マスコット）。 |
| イベント | `event_hooks`(173) `event_registry`(409) | 進行イベント（解放・チュートリアル等）。 |
| 開発 | `sim_tools`(234) | 自動レース検証・バランス harness。 |

---

## 3. 画面一覧（`nav.js SCREEN_INDEX` と一致・全25画面）

`state.ui.screen` の値＝画面ID。**`?go=<id>` でURL直接起動／設定デバッグの「🧭画面ジャンプ」で番号ジャンプ／`goto("<id>")` で随時遷移**。

| # | id | 画面 | 描画関数（ファイル） |
|---|---|---|---|
| 1 | title | タイトル | renderTitle (ui_render) |
| 2 | home | ホーム(配信) | renderHome (ui_render) |
| 3 | race_select | レース選択 | renderRaceSelect |
| 4 | race_detail | レース詳細/賭け | renderRaceDetail(race) |
| 5 | race_run | レース実況 | renderRaceRun→race_canvas |
| 6 | result | 結果 | renderResult |
| 7 | analysis | 分析 | renderAnalysis |
| 8 | assets | 暮らしと資産 | renderAssets |
| 9 | life_tree | くらしツリー | renderLifeTree |
| 10 | life_collection | 暮らしコレクション | renderLifeCollection |
| 11 | active_skills | 習い事 | renderActiveSkills |
| 12 | meals | 食事(みみしんぼ) | renderMeals (ui_render+meals) |
| 13 | mall | モール(着替え) | renderMall |
| 14 | mall_rpg | お買い物ダンジョン | renderMallRpg (mall_rpg) |
| 15 | village | 村 | renderVillage |
| 16 | collection | 図鑑 | renderCollection |
| 17 | stable | 龍舎 | renderStable (poro) |
| 18 | scout | 竜スカウト | renderScout (poro) |
| 19 | poro_gourmet | ポロのグルメレース | renderPoroGourmet (poro_gourmet) |
| 20 | story | 物語(一覧) | renderStory |
| 21 | story_read | 物語(各話) | renderStoryChapter(id) |
| 22 | consult | 相談(顧問) | renderConsult |
| 23 | goals | 目標(クエスト) | renderGoals (ui_render+goals) |
| 24 | help | 予想入門 | renderHelp |
| 25 | settings | 設定 | renderSettings |

---

## 4. よくある拡張の「足す場所」

- **新しい画面**：`renderXxx()` を ui_render.js（または専用ファイル）に書く → `nav.js screenMap()` と `SCREEN_INDEX` に1行 → 必要なら `ui_render.js beginScreen() TOP_BACK` に戻り先 → ホーム導線（`renderHome` の `hl-rail`）。
- **ホームのメニュー**：`renderHome` の `hl-rail`（`navItem(...)`）。9項目以上は2行（`cols = n<=8 ? n : Math.ceil(n/2)`）。
- **表示メタの収集要素**：`goals.js`/`meals.js` を雛形に（データ配列＋`done/unlocked`判定＋`state.player.<key>`に記録＋lazy-init＋saveGame）。
- **物語・章**：`STORY_CHAPTERS`(data_assets)／`STORY_UNLOCK_AT`／`_chapter_intro_<id>`。
- **デプロイ**：`docs`参照の git plumbing＋`index.html` の `?v=` 一括前方更新（[[deploy-method]]）。

---

## 5. 主要グローバル（横断で使う）

`state`／`el,$`(utils)／`saveGame,loadGame,recomputeAssets,bumpMaxCoins`／`renderHome` 他 `renderX`／`goto,rerenderCurrent,SCREEN_INDEX`(nav)／`Dialogue`／`Sfx,RaceBgm`／`getStoryFlag,setStoryFlag`／`fmtCoins`／`DRAGONS,OUTFITS,LIFE_MILESTONES,STORY_CAST,STORY_CHAPTERS`／`Ending`。

---

## 6. 最適化の方針（今後）

- ✅**ルーティング集約＝完了**（nav.js）。画面追加が1箇所で済み、`?go=`で検証が速い。
- ✅**分割第1弾＝`ui_meta.js`抽出済**（renderGoals/renderMeals/showMealDetail/_mealTab を ui_render.js から無改変で移動）。参照はグローバル共有で不変、`?go=goals`/`?go=meals`で全機能スモーク→コンソール0で確認済。
- 🔜**ui_render.js(残り約4800行)の分割候補（続き）**：`ui_home.js / ui_race.js(select/detail/run/result/analysis) / ui_assets.js(assets/life_tree/collection/active_skills) / ui_story.js(story/consult/help/settings)` へ同方式で抽出。**ロジック移動のみ＝低リスクだが1ファイルずつ・各段階で`?go=`全画面スモーク→デプロイ**。nav.js が橋渡し。
- 🔜 race_canvas.js / mall_rpg.js も大きいが自己完結度が高い。
- 原則：**抽出はロジックを変えず移すだけ**。1ファイルずつ・プレビュー(`?go=`)で全画面スモーク→デプロイ。数値engineには触れない。
