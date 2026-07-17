# ミミのドラゴンレースアイランド

**転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件**

ファンタジー公営龍レース予想カジノ — V1 プロトタイプ (`v0.1 Core Race Loop Prototype`)。

プレイヤーは「予想家」として、市場のオッズと真の実力のズレを読み、賭けで利益を出します。

## このゲームの心臓

```
レースを選ぶ → 情報を読む → 妙味を見つける → 賭ける →
自動レース観戦 → 払戻 → 分析で学ぶ → 次のレースへ
```

オッズは「市場の人気投票」で決まり、真の勝率とはズレます。そのズレを見抜けるかがすべて。

## 起動

外部ライブラリ不要。HTML+CSS+JSのみ。

### ブラウザで直接開く
`index.html` をダブルクリック。

### ローカルサーバ経由（推奨）
PowerShell で:

```powershell
.\serve.ps1
```

→ `http://localhost:8766` をブラウザで開く。

## 主要機能

- **3賭式**: 単竜（1着）/ 複竜（3着以内）/ ワイド竜（2頭3着以内）
- **8竜 × 5レース**: コース3区間（早中後）× 天候5種 × ランク7段階
- **レースエンジン**: FinalPower 7成分（Base/Course/Weather/Form/Pace/Position/Random）+ スタミナシステム
- **オッズエンジン**: PopularityPower → 5000回市場シミュレーション → 単/複/ワイドオッズ
- **分析画面**: 勝因/人気失敗/ペース/スタミナ/天候/妙味/次戦ヒント、4段階詳細レベル
- **試走サマリー**: 全竜の体調・集中・試走スタート/旋回/終い・騎手呼吸
- **イベントフック**: 15 hook slot + ミミ・サケ・ウダダの対話
- **村 / 図鑑**: 経済支援、コレクション記録
- **救済システム**: 破産時に村の予備コイン（借金ではない）
- **ヘルプ画面**: 予想入門（9セクション）
- **localStorage セーブ**

## ソース構成

```
index.html              ヘッダ + イベントオーバーレイ
style.css               ダーク カジノ UI
serve.ps1               PowerShell ローカル HTTP サーバ
js/
  data_dragons.js       8竜 + 脚質色 + assetIds スキーマ
  data_courses.js       5早中後 × 6stats 重み + terrain cost
  data_weather.js       5天候 × stats 重み
  data_ranks.js         7ランク × オッズキャップ + 村Mult + 救済テーブル
  data_races.js         5レース + region color theme
  state.js              プレイヤー状態 / 村 / 図鑑 / save/load
  race_engine.js        FinalPower + ペース分類 + スタミナ消費
  odds_engine.js        PopularityPower + 市場シミュ + 単/複/ワイド変換
  betting_engine.js     バリデーション + オッズ取得 + 払戻計算
  analysis_engine.js    レース後分析テキスト生成
  event_hooks.js        15 hook + 13 V1 sample events
  ui_render.js          9画面のレンダリング
  sim_tools.js          シミュレーション/メトリクス検証ツール
  main.js               起動 + イベント配線
```

## 設計ドキュメント

このプロトタイプは下記の仕様書 (15本) に厳密に従って実装されています:

- 01 GAME_CONCEPT_AND_PILLARS
- 02 CORE_GAME_LOOP
- 03 RACE_ENGINE_SPEC
- 04 ODDS_AND_BETTING_SPEC
- 05 RACE_COURSE_AND_REGIONS
- 06 DATA_SCHEMA_AND_ARCHITECTURE
- 07 UI_UX_SCREEN_FLOW
- 08 PROGRESSION_AND_ECONOMY
- 09 DRAGON_COLLECTION_AND_VILLAGE
- 10 EVENT_STORY_AND_CHARACTER_HOOKS
- 11 ASSET_AND_VISUAL_GUIDE
- 12 BALANCE_TESTING_GUIDE
- 13 IMPLEMENTATION_ROADMAP
- 14 V1_SCOPE_AND_CLAUDE_CODE_PROMPT

## 実装ロードマップ達成状況

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | Core HTML prototype | ✓ |
| 2 | Race engine validation | ✓ |
| 3 | Odds and betting validation | ✓ |
| 4 | UI info layers and analysis | ✓ |
| 5 | Progression and economy | ✓ |
| 6 | Event hooks and character comments | ✓ |
| 7 | Village and collection | ✓ |
| 8 | Visual assets (V1範囲) | ✓ |
| 9 | Advanced content / high-rank | V1スコープ外 |
| 10 | Polish and release candidate | ✓ (V1範囲) |

## デバッグツール（コンソール）

```javascript
// レース1を300回シミュレートして勝率・崩壊率を計測
simulateRaceManyTimes("race_grandclock_1", 300)

// 5戦略(本命単/本命複/本命ワイド/ランダム/value)のROIを比較
compareAllStrategies(RACES.map(r=>r.id), 100, 100)

// 市場vs真の勝率ギャップ（妙味検出）
testMarketVsTrueStrength("race_grandclock_1", 200)

// Rank別市場の hype 強度
testRankBias("race_grandclock_1")

// V1 受入レポート
v1AcceptanceReport()
```

## ライセンス

私的利用。
