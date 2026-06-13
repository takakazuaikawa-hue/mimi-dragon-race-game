# 終章システム設計 ―「絶滅へのカウントダウン」

第5話（セレスティアの神眼）からエンディングまでを埋める**終章コンテンツ**の設計書。
3つの解放要素（密林スカウト／ドラゴン牧場／グルメレース）を1本の物語ループに束ね、
**絶滅に対抗しきること自体をエンディングフラグ**にする。

> ステータス: 設計合意済み（2026-06-12）。実装は未着手。
> 本書は「骨（メタ進行）」と「化粧（演出）」を分けて段階実装する前提で書く。

---

## 0. 絶対ルール順守（最重要）

| ルール | 本システムでの扱い |
|---|---|
| ① レース数値（着順・オッズ・配当・抽選/賭け）変更禁止 | **一切触れない。** doom/sanctuary・保護した竜・なつき度・牧場Lvは race_engine / odds_engine / betting_engine に絶対接続しない。竜は**コスメ・図鑑のみ**（レースには出さない）。 |
| ② mainへのpush＝即デプロイ | 終章は段階実装。壊れない単位でcommit。 |
| ③ CSS/JS変更時は index.html の `?v=` 一括更新 | 新ファイル追加・CSS追記のたびに必ず実施。 |
| ④ classicスクリプト構成 | 新ファイルは自己完結モジュール（`mall_dungeon.js`と同作法）。`<script>`は index.html に列挙。 |

**判定の合言葉**：「これはレースの強さ・オッズ・着順・配当を1ミリでも動かすか？」→ Yesなら設計が間違い。

---

## 1. 物語フック

- 第5話でセレスティア・ブラックメテオの神眼が竜を「生き残る順番」に淘汰し始める＝**絶滅カウントダウン開始**。
- ミミは3つの活動で **聖域メーター** を押し上げ、絶滅が尽きる前に満たせば
  「この賭場、壊れなかったね」＝**ED解放**→既存のスタッフロール（`ending_engine.js`）へ。
- 失敗してもゲームオーバーにしない（**ソフト**：詰まらずやり直せる）。

```
神眼発動（第5話） ── レースを走るたび doom+1 ──▶ 絶滅(=doomMax)
        ▲                                          │
🌴スカウト（竜種を見つけ保護＝図鑑unlock）          │  sanctuary が
🐉牧場（保護した種を繁栄＝なつき/牧場Lv）          │  100% に届けば…
🍡グルメレース（島を沸かせ灯りを絶やさない）  ──────┴──▶ ✨聖龍の加護＝エンディング
```

### 声（既存 STORY_CAST をそのまま使用）
- 淘汰の解説：セレスティア／現場・竜：サケ・ウダダ／繁栄の采配：ミズ／生活・施設：スミカ／祭り・配信：マクラ
- ミミ＝異世界からの来訪者（反応・驚き・質問のみ。「〜です/ます」「〜っ！」）

---

## 2. 確定した設計判断（ユーザー合意）

| 論点 | 決定 |
|---|---|
| 竜の扱い | **コスメ・図鑑のみ**（レースには出さない） |
| 報酬の位置づけ | 第5話→ED間に集める**終章メタ進行**。絶滅対抗そのものがEDフラグ |
| 解放方法 | **物語進行で順次**（第5話到達で終章開幕→スカウト→牧場→グルメ） |
| ミニゲーム品質 | **スーファミ級のガチクオリティ**（canvas演出・専用BGM/SE） |
| 淘汰カウント進行 | **レースを走るたびに doom +1**（リアル時間は使わない） |
| 失敗時 | **ソフト**：詰まらずやり直せる（ゲームオーバーにしない） |
| EDゲート | 現行「総資産1兆」から **聖域メーター達成に差し替え**（総資産は別途“豊かさ”指標として残す） |

---

## 3. 状態（セーブ）スキーマ

`state.player` に追加（`js/state.js` の初期化2か所＋`load`後方互換ガードを忘れず）。

```js
// 終章の進行（表示メタ／レース数値・コインに非干渉）
state.player.epilogue = {
  active: false,        // 第5話到達でtrue（終章開幕）
  doom: 0,              // 淘汰カウント。レース確定ごとに+1
  doomMax: 40,          // 尽きる閾値（=猶予レース数。要バランス）
  sanctuary: 0,         // 聖域メーター 0..100（3活動で上昇）
  savedSpecies: [],     // 保護した竜種id（図鑑と連動・コスメ）
  cycle: 0,             // ソフト失敗で神眼に再挑戦した回数
  edFlag: false         // sanctuary>=100 到達で true → ED解放
};

// 各ミニゲームの永続（mall_dungeon の state.player.dungeon と同列）
state.player.scout   = { runs:0, finds:0, items:[], rep:0 };          // 密林スカウト
state.player.ranch   = { dragons:{}, level:1, buddy:null };           // 牧場（dragons: id→{bond,since}）
state.player.gourmet = { runs:0, best:0, stamps:0, titles:[] };       // グルメレース
```

> `state.player.buddyDragon`（既存の `buddyDragonSrc()` 拡張点）は牧場の `buddy` から設定する。

---

## 4. doom / sanctuary の進行（数式・骨）

すべて表示メタ。**関数は新ファイル `js/epilogue_engine.js` に集約**し、レース系engineからは呼ばない。

```js
// レース確定時に1目盛り進める（settleRace から呼ぶ。終章中のみ）
function doomTick() {
  const e = state.player.epilogue;
  if (!e || !e.active || e.edFlag) return;
  e.doom = Math.min(e.doomMax, e.doom + 1);
  if (e.doom >= e.doomMax) onDoomReached();   // ソフト失敗（下記）
}

// 3活動が聖域メーターを上げる共通入口（各ミニゲームの成果ハンドラから呼ぶ）
function sanctuaryGain(points, reason) {
  const e = state.player.epilogue;
  if (!e || !e.active) return;
  e.sanctuary = Math.min(100, e.sanctuary + points);
  if (e.sanctuary >= 100 && !e.edFlag) { e.edFlag = true; onSanctuaryFull(); }
  saveGame();
}

// ソフト失敗：詰まらせない。doomを戻して“もう一度神眼に挑む”だけ。
function onDoomReached() {
  const e = state.player.epilogue;
  e.cycle += 1;
  e.doom = 0;                 // 仕切り直し（sanctuaryは維持＝積み上げは無駄にならない）
  // セレスティア演出「……まだ、淘汰は終わらない」→ 続行
}

function onSanctuaryFull() {
  // ED解放。ホーム/物語に「終章クリア」を出し、エンディング再生導線を点灯。
  // 既存スタッフロールへ：if (window.Ending) Ending.play();
}
```

### 聖域メーターの配点（要バランス・初期値の目安）
- 🌴 スカウト：**新種を初保護＝+大**（図鑑が埋まるほど島の生命が戻る）。既知種の再訪＝+小。
- 🐉 牧場：保護種のなつき度・牧場Lv上昇のマイルストーンで +中。種数が多いほど絶滅耐性の演出。
- 🍡 グルメレース：祭り成功で +中（イベント的ブースト。連続開催で逓減させ作業化を防ぐ）。

> 配点・doomMax は `epilogue_engine.js` 先頭の定数表に置き、後から差し替え可能にする
> （`data_ending.js` と同じ「中身と演出を分離」の思想）。

---

## 5. 3ミニゲームの設計

共通作法：`mall_dungeon.js` の構造（データ表＋一時runオブジェクト＋`state.player.*`永続＋専用`render*`画面＋罰なし）を踏襲。

### 🌴 密林ドラゴンスカウト（`js/scout_jungle.js`）
- 横スクロール探索（浅瀬→樹海→霧の谷→竜の谷）。罰なし・時間/スタミナ内にどれだけ探せるか。
- 成果＝**竜との遭遇→保護**。`data_dragons_ext.js` の竜を母集団に、未発見種を発見→図鑑 `seen/unlocked`＋`savedSpecies` 追加＋`sanctuaryGain`。
- 道具ビルド（双眼鏡／餌／霧よけ…）はモールのアイテム表と同型。
- 永続：`state.player.scout`。

### 🐉 ドラゴン牧場（`js/dragon_ranch.js`）
- スカウトで保護した竜を飼う場所。**世話（餌・なでる・放牧）でなつき度・牧場Lv上昇**。
- ⚠️ なつき度・牧場Lvは**レースの強さ/オッズ/着順に絶対繋がない**（表示専用）。
- 出口の旨味：**相棒に選ぶ→ホームのマスコットが変わる**（`buddyDragonSrc`）、お気に入り、牧場の風景が育つ。
- マイルストーンで `sanctuaryGain`。
- 永続：`state.player.ranch`。

### 🍡 ミミのグルメレース（`js/gourmet_race.js`）
- ミミ（＋相棒の竜）が屋台街を巡る食フェス。早食い/食べ歩きスタンプを集めるテンポ遊び。
- 報酬＝称号・**衣装（既存 `outfitsWon` 方式を流用）**・ホームのデコ。コイン非干渉。
- 祭り成功で `sanctuaryGain`。
- 永続：`state.player.gourmet`。

---

## 6. エンディングゲートの差し替え（具体接続点）

現行：`STORY_UNLOCK_AT.ED = 1e12`（総資産1兆）で `currentStoryChapter()` がED章を返す。
（`js/data_assets.js` の `STORY_UNLOCK_AT` / `js/assets_engine.js:149 currentStoryChapter`）

**変更方針**：ED章だけ総資産ゲートではなく `epilogue.edFlag` を見るようにする。

```js
// js/assets_engine.js — currentStoryChapter() のED判定を差し替え
function currentStoryChapter(total) {
  let cur = STORY_CHAPTERS[0];
  for (const ch of STORY_CHAPTERS) {
    if (ch.id === "ED") {
      // EDは総資産ではなく聖域メーター達成で解放
      if (state.player.epilogue && state.player.epilogue.edFlag) cur = ch;
    } else if (total >= storyUnlockAt(ch.id)) {
      cur = ch;
    }
  }
  return cur;
}
```

- 総資産は引き続き“暮らしの豊かさ/再起度”の指標として残す（救済・暮らしツリー等は不変）。
- `unlockedStoryChapters()` も同じくED分岐を合わせる。
- 表示ゲートの変更のみ＝**レース数値に非干渉**。

---

## 7. レース確定での doom 進行（具体接続点）

レース確定の唯一の集約点は `settleRace()`（`js/ui_render.js:2918`）。
コイン・連勝・図鑑・総資産進行がすべてここで確定する。末尾に1行：

```js
// settleRace() の末尾付近（progression確定後）に追加
if (typeof doomTick === "function") doomTick();   // 終章中のみ内部でガード
```

- `doomTick` 内で `epilogue.active && !edFlag` をガードするので、終章前は無害。
- 既存の払戻・着順・オッズ計算には一切触れない（追記は確定後の表示メタのみ）。

---

## 8. 連携点チェックリスト（実装時）

- [ ] `js/state.js`：`epilogue` / `scout` / `ranch` / `gourmet` を初期化2か所に追加＋`load`後方互換ガード
- [ ] `js/epilogue_engine.js`（新）：doom/sanctuary の定数表＋`doomTick`/`sanctuaryGain`/`onDoomReached`/`onSanctuaryFull`
- [ ] `js/scout_jungle.js` `js/dragon_ranch.js` `js/gourmet_race.js`（新）：各ミニゲーム
- [ ] `js/ui_render.js`：`settleRace()` 末尾に `doomTick()`、`renderHome` の rail に解放後の navItem（🌴🐉🍡）、終章HUD（doom/sanctuary）
- [ ] `js/assets_engine.js`：`currentStoryChapter` / `unlockedStoryChapters` のED分岐差し替え
- [ ] `js/main.js`：`rerenderCurrent` の画面マップに新screen（scout/ranch/gourmet）追加
- [ ] 第5話到達時に `epilogue.active = true`（物語解放のフックに合わせる）
- [ ] `index.html`：新`<script>`追加＋`?v=` 一括更新
- [ ] `style.css`：終章HUD・各ミニゲームのCSS（名前空間 `.ep-` `.scout-` `.ranch-` `.gr-`）

---

## 9. 「スーファミ級」をどう出すか（段階実装）

土台はある：`js/race_canvas.js`（ピクセル竜描画）＋`live2d/`（自作リグ L2_RIG/L2_PLY）。

- **canvasで作る**：スカウト＝横スクロール探索、牧場＝ドット牧場ビュー、グルメ＝屋台街横スクロール。
- **音**：Suno で各ミニゲーム1曲＋神眼（ボス）テーマ。SEは `js/sfx.js` 合成＋追加。
- **絵**：ChatGPT生成→ドット調整（制作体制と一致）。
- **2段ビルド**（先のED演出と同じ思想）：
  1. **骨**：doom/sanctuary/edFlag＋簡易UIで「終章→ED」の流れを通す（壊れない最小）。
  2. **化粧**：canvas演出・スプライト・BGMでSNES品質に引き上げる。
- 骨と演出を分離しておけば、見た目は後からいくらでも盛れて壊れない。

---

## 10. ファイル構成案

```
js/
  epilogue_engine.js   終章の心臓（doom/sanctuary/EDフラグ・定数表）※レース非干渉
  scout_jungle.js      🌴 密林スカウト（mall_dungeon型）
  dragon_ranch.js      🐉 牧場（育成＝表示メタのみ）
  gourmet_race.js      🍡 グルメレース（祭りミニゲーム）
docs/
  epilogue_extinction_design.md   本書
```

---

## 11. 未決・将来拡張

- doomMax・sanctuary配点の具体値は実機の手触りを見て調整（骨実装後に詰める）。
- バッドエンド分岐は現状**作らない**（ソフト失敗で統一）。将来やるなら別途演出量を確保。
- 牧場の繁殖/世代要素、スカウトの地方追加、グルメの対戦相手などは骨が通ってから。
