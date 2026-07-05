# レンダラ抽象化 — 2D→3D 差し替えのための設計

3Dレンダリングへの移行を見据え、描画を **「シーン記述(何を)」** と **「描画手段(どう)」** に分離し、
**実行時に差し替え可能**にするための設計メモ。ビルド無し・純Vanilla・classicスクリプトの制約を守る
（既存 `window.RC_USE_RIG` と同じ「実行時スイッチ」思想）。

## 大原則
- **数値に触れない**：着順・オッズ・配当・戦闘ダメージの計算は不変。レンダラは結果を**読むだけ**。
- **壊さない**：新バックエンド未実装/失敗時は必ず既定の2Dへフォールバック。
- **段階移行**：1系統ずつ。シーン記述は純データ（canvas/ctx/three非依存）に保つ。

## レンダラ契約（インターフェース）
1系統につき2つだけ用意する：

```
// ① シーン記述ビルダー：純データを返す（描画手段に非依存）
function buildScene() -> SceneDesc        // 例：rpgBuildViewScene()

// ② バックエンド：シーン記述を受け取り、与えられた面（canvas等）へ描く
backend(surface, scene, t) -> void        // 例：MallRender.backends["2d"]
```

切替は実行時フラグ（`window.MALL_RENDERER` 等）。レジストリに登録するだけで増やせる：

```js
// 3D実装は別ファイルで登録するだけ（mall_rpg.js は無改変でよい）
window.MallRender.backends["3d"] = function (cv, scene, t) {
  // scene.ahead / scene.accent / scene.dusk / scene.openAir / scene.cell から
  // Three.js などで一人称シーンを描く。cv は <canvas>（WebGLコンテキストを張る）。
};
window.MALL_RENDERER = "3d";   // これで切替。未実装機能で投げれば自動的に2Dへ戻る。
```

---

## 系統別の現状とシーム計画

### ① モール一人称ダンジョン … **実装済み（参照実装）**
- **シーン記述** `rpgBuildViewScene()`（`js/mall_rpg.js`）
  - `floor, dir, accent[3], sunset, dusk, openAir`
  - `ahead[]`：前方に見えるセル列 `{ d:奥行(1..4), kind:"wall|floor|treasure|stairs|boss|exit", closed? }`
  - `cell(d,l)`：相対セル参照（2Dは側壁/店先に使用。3Dは `ahead` か `RPG.map` から幾何を組んでよい）
- **描画手段** `MallRender.backends["2d"]`：現行のHD-2D（`rpgScene` ＋ 前方アイコン ＋ `rpgPostFx`）
- **エントリ** `rpgDrawView(cv,t)` → `MallRender.dungeon(cv, rpgBuildViewScene(), t)`（差し替え点）
- **3D化の容易さ**：高（投影が一点透視・前方4段でグリッド明確）。`ahead` をそのまま奥行きの箱配置にできる。

### ② モール戦闘（アイソメ） … 未着手（要・状態機械化）
- 現状 `rpgDrawBattle()` は `RPG.battle.enemies[].hp` を直接読み、`rpgUseSkill()`/`rpgEnemyStep()` が
  **ダメージ計算とアニメ/FXを時間軸で同期**（`setTimeout` 駆動）させていて密結合。
- **シーム案**：
  - シーン記述 `rpgBuildBattleScene()` を新設：`{ enemies:[{id,ic,x,y,hp,maxhp,alive,state}], mimi:{...}, fx:[...] }`
    （配置は既存 `rpgIsoLayout()` を流用）。
  - 戦闘の進行（who/anim/phase）を**状態として持たせ**、レンダラは状態を読むだけにする
    （現在ハードコードの `setTimeout` タイミングを `battle.anim` のような状態へ移し、描画から分離）。
  - 座標→画面の写像 `rpgScenePt/rpgEnemyPt/rpgPlayerPt` は **FX配置の共通API**として残す（2D/3D共通）。
- **3D化の容易さ**：中〜高（アニメ同期の再設計が前提）。まず状態機械化 → その後バックエンド差し替え。

### ③ レース … 未着手（竜は既に半分分離済み）
- 竜は `rcDrawDragon(ctx, o)` で **キャラ単位のインターフェースが既にある**（`o` に位置/scale/color/mood/動き）。
  さらに `window.RC_USE_RIG=false` でリグ↔ピクセルを切替できる＝**実行時スイッチの前例**。
- **シーム案**：
  - シーン記述 `rcBuildScene()`：`{ camera, track, dragons:[o...], particles, weather }`（`S.tau`駆動の結果）。
  - バックエンド `RaceRender.backends["2d"|"3d"]`：`draw()` を丸ごと委譲。`drawDragon` は `o` を共通入力に。
  - 背景/地形は `RC_THEME` テーブル駆動で差し替えやすい。座標 `laneY/screenX/trackGeom` を**共通座標系API**に集約。
- **3D化の容易さ**：低〜中（竜は容易だが地形/カメラ/パーティクルの統一座標系づくりが要）。

### ④ 立ち絵/マスコット（Live2D風 L2_RIG/L2_PLY） … 当面そのまま
- `live2d/js/rig.js` の `L2_RIG`（parts/role/pivot/z/motion）は**既にデータ駆動**で汎用。
- 3Dでもリグのパーツ＝板ポリ（ビルボード）として流用しやすい。優先度は低。

---

## 推奨ロードマップ
1. **一人称ダンジョンの3Dバックエンド** … **実装済み（PoC）**。`js/mall_view_3d.js`。
2. **レースの竜だけ3D**（`rcDrawDragon` 相当を3D差し替え。背景は2Dのまま混在可）。
3. **戦闘の状態機械化 → 3D**（アニメ同期の再設計が必要なので最後）。

## 一人称3D 実証（PoC）の使い方 — `js/mall_view_3d.js`
- **画風**：ブラックルーム調＝黒い部屋＋ネオンの輪郭線で奥へ伸びる回廊（クラシックな一人称DRPG）。
  一点透視のパース投影で「前方の壁/横壁/行き止まり/床天井の格子」を描き、宝箱/階段/出口は発光ビルボード。
- **無依存**：外部3Dライブラリ無し・純キャンバスで投影（ビルド無し・GitHub Pagesでそのまま動く・オフライン可）。
- **差し替え方式**：`mall_rpg.js` は無改変。本ファイルが `window.MallRender.backends["3d"]` に登録するだけ。
- **切替**：
  - URL に `?mall3d` を付けて開く（起動時ON）。
  - コンソールで `mallView3D(true)` / `mallView3D(false)`。
  - `window.MALL_RENDERER = "3d" | "2d"`。
- **安全**：既定は `"2d"`。3D描画が例外を投げても `MallRender.dungeon` が自動で2Dへフォールバック。
- **入力**：`rpgBuildViewScene()` の純データ（`accent` で各フロアのネオン色／`ahead` で前方の見え方／`cell(d,l)` で側壁判定）。数値計算には非干渉。
- **次の拡張余地**：壁テクスチャ（店先）/天井の照明/歩進アニメ（カメラ前進補間）/Three.js版バックエンドへの差し替え。

各段階とも「2Dをフォールバックに残す」「数値計算に触れない」を厳守。`index.html` にスクリプトを足したら
`?v=` を前方更新する（キャッシュ対策）。3Dライブラリ（例：Three.js）はCDNか `vendor/` 同梱で、ビルド無しのまま導入可能。
