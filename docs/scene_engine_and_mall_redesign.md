# 共通シーン基盤 ＆ モール刷新 設計

モールお買い物ミニゲームを「ミニとは言えない」品質へ刷新し、終章3機能
（密林スカウト／ドラゴン牧場／グルメレース）と**同じcanvasシーン基盤**に統一する設計書。

> ステータス: 設計合意済み（2026-06-12）。実装は未着手。
> 関連: `docs/epilogue_extinction_design.md`（終章システム）。

## 確定した設計判断（ユーザー合意）
| 論点 | 決定 |
|---|---|
| アート方向 | **ハイブリッド**（イラスト背景＋ピクセル/リグのチビキャラ） |
| モール刷新の幅 | **canvasでフル再構築**（歩いて回れるモール） |
| 土台 | **共通シーン基盤に統一**（モール＋終章3機能で共有） |
| アセット入手 | **自前生成のみ**（画像=ChatGPT／音楽=Suno／SE=sfx.js合成） |

---

## 0. 絶対ルール順守（最重要）

- ① レース数値（着順・オッズ・配当・賭け）に**一切触れない**。モールは**元々コイン非干渉**
  （店の「🪙n」は**プレイヤーのコインではなく内部“モールメダル” `MD.gain.medals`**）。
- **経済・報酬・セーブキーは温存**：`state.player.dungeon`（medals/shards/passives/bestF/runs/wins）
  と `state.player.outfitsWon` は**そのまま**。刷新するのは**表示と手触りだけ**。
- ③ CSS/JS追加のたび index.html の `?v=` 一括更新。④ classicスクリプト構成を踏襲。

**刷新の鉄則**：`mall_dungeon.js` の「ロジック（MD_SHOPS / MD_ITEMS / 報酬計算 / 抽選）」は
原則そのまま再利用し、**`renderMallDungeon()`（プレゼン層）だけをシーン基盤へ移植**する。
→ ルール順守・セーブ互換・バランス不変を同時に満たす。

---

## 1. 共通シーン基盤（`js/scene_engine.js`）

4ミニゲームが乗る軽量フレームワーク。外部ライブラリ無し・canvas 1枚・自己完結。

### 責務
- **1枚の `<canvas>`** をコンテナにフィット（DPR対応・上限2倍でスマホ負荷を抑制）。
- **固定タイムステップ更新＋描画**（`requestAnimationFrame`）。タブ非表示で停止。
- **レイヤ描画**：`bgFar / bgMid / bgNear`（視差）→ `world`（アクター）→ `fg` → `ui`。
- **アクター(Actor)モデル**：`{x,y,z, sprite|rig|drawFn, anim, hit}`。zでソート。
- **キャラ描画の統合**：
  - ミミ＝**既存 `live2d` リグ（L2_RIG/L2_PLY）** or 立ち絵を流用（新規最小）。
  - 竜＝**`race_canvas.js` のトレース描画パイプライン流用**（参照画像→getImageDataでドット化）。
  - 効果（フィーバー光・キラキラ・紙吹雪）＝**手続き生成**（画像不要）。
- **入力層**：pointer/tap → ワールド座標。スマホ用に**オンスクリーンの十字キー/ボタン**を ui レイヤに。
- **オーディオ橋渡し**：SE=`sfx.js`（合成）、BGM=`bgm.js`流用（後述のシーン別トラック）。
- **フォールバック**：`prefers-reduced-motion` と filter非対応端末で簡易描画へ自動切替
  （`race_canvas` と同じ思想）。

### API スケッチ（実装時の指針）
```js
const scene = Scene.create({
  mount: appEl,                  // ここに canvas を生成
  assets: MALL_MANIFEST,         // 宣言的アセット（§2）。entryで遅延ロード
  layers: ["bgFar","bgMid","bgNear","world","fg","ui"],
  onLoad: (a) => { /* スプライト確定 */ },
  onUpdate: (dt) => { /* 移動・アニメ・カメラ */ },
  onDraw: (ctx, cam) => { /* レイヤ描画は基盤が回す。追加描画のみ */ },
  onInput: (ev) => { /* tap/dpad → ミミ移動・店インタラクト */ },
  onExit: () => { /* アセット解放・BGM停止 */ }
});
```
- `Scene.actor(opts)` / `scene.camera` / `scene.play(seId)` / `scene.bgm(track)` などの薄いヘルパ。
- **状態は持たない**：進行・報酬は各ゲームの `state.player.*` が真実。基盤は描画と入力だけ。

---

## 2. アセット基盤（宣言的マニフェスト＋遅延ロード）

```js
// 各シーンが自分の必要素材を宣言。entry時にロードしprogress表示、exitで解放。
const MALL_MANIFEST = {
  images: {
    floor1_far:  "images/scene/mall/floor1_far.webp",
    floor1_near: "images/scene/mall/floor1_near.webp",
    // …5フロア × (far/near)。midは手続きorフロア共通
    props:       "images/scene/mall/props_atlas.webp",   // 什器/商品のスプライトシート
    ui_frame:    "images/scene/ui/frame.webp"
  },
  audio: { /* BGMは bgm/ のファイル名で列挙、SEは合成なので不要 */ }
};
```
- **webp必須**・**スプライトシート(atlas)化**で点数と容量を圧縮（images既に51MB＝総量監視）。
- **遅延読込**：ミニゲーム入場時のみDL、退場で破棄（GitHub Pages配信の初回軽量化）。
- **命名規約**：`images/scene/<game>/<name>.webp`、`bgm/<game>-<name>.mp3`。
- `?v=` キャッシュ更新を更新フローに含める。

---

## 3. モール刷新の具体（歩いて回れるモール）

### 体験
- ミミが**フロアを歩いて回る**（横スクロール or 見下ろし）。1F〜RFはエレベーター/階段で移動。
- 店＝**インタラクト可能ホットスポット**。近づいてタップ→**既存 `mdVisit`/`mdChoices` のUIをウィンドウで表示**。
- **館内放送フィーバー**＝該当店が光る／BGMが盛り上がる（既存 `MD.fever` をビジュアル化）。
- **閉店前抽選**＝ルーレット/ガチャ演出（既存 `mdEnd`/抽選ロジックに化粧）。
- スタンプ帳・メダル・かけらはHUDに常時表示（既存値をそのまま描画）。

### ロジック温存マッピング
| 既存（温存） | 刷新後の見せ方 |
|---|---|
| `MD_SHOPS` / `MD_FLOORS` | フロアのホットスポット配置データに流用 |
| `mdVisit/mdChoices/mdChoice` | 店ウィンドウのコマンド（中身そのまま） |
| `MD.gain.medals/shards` | HUDのアイコン＋数値（コイン非干渉のまま） |
| `mdEnd`＋抽選→`outfitsWon` | 閉店抽選演出（報酬は不変） |
| `state.player.dungeon` | セーブ互換のまま（キー追加のみ可、削除しない） |

> つまり**`mall_dungeon.js` はロジック専用に縮め**、描画は `scene_engine` 上の
> `js/scene_mall.js`（新）に移す。バランス・確率・報酬は1行も変えない。

---

## 4. アセット入手計画（自前生成のみ）

### 画像（ChatGPT生成 → webp化 → atlas）
- **背景**：5フロア内装（1F食・2F装い・3F遊び・4Fフードコート・RF屋上）。
  視差用に far/near を分離生成（midは手続き）。`mall_bg.webp` をトーンの基準に。
- **什器/商品**：14店舗ぶんの看板・棚・ガチャ・屋台・景品を**スプライトシート1枚**に集約。
- **UI**：ウィンドウ枠・スタンプ帳・ルーレット盤・アイコン（12 `MD_ITEMS`）。
- **キャラは原則新規生成しない**：ミミ＝`live2d`リグ／立ち絵、竜＝`race_canvas`トレースを流用。
- **画風統一ルール**（ハイブリッドの肝）：背景＝イラスト、手前キャラ＝ドット/リグ。
  固定パレット・光源・線の太さ・解像度ターゲットを決め、生成プロンプトに毎回明記。

### 音楽（Suno）
- `mall-day.mp3`（明るいお買い物テーマ）／`mall-fever.mp3`（フィーバー時の高揚版）／
  任意 `mall-closing.mp3`（閉店前の落ち着き）。`bgm/` に置き、シーン別トラックとして列挙。

### 効果音（`sfx.js` 合成）
- スタンプGET／かけらGET／フィーバー放送／ルーレット回転・停止／当たり／歩行音。
- 合成で大半まかなえる＝**権利完全クリーン**（公開Pages向き）。

### 権利
- すべて自前生成＝**著作権クリーン**。生成物の利用規約だけ最終確認（ChatGPT/Suno）。

---

## 5. 段階実装（骨→化粧）とファイル構成

1. **基盤の骨**：`scene_engine.js`（canvas/loop/layers/input/loader/audio橋渡し/フォールバック）。
   ダミー矩形で動作確認（アセット待ちでも進む）。
2. **モール移植**：`scene_mall.js` で既存ロジックを呼びつつ、まずプレースホルダ画で歩行＋店UI。
3. **化粧**：ChatGPT背景／atlas／Suno BGM／合成SEを差し込み、SNES級に引き上げ。
4. **終章3機能**：同じ基盤に `scene_scout.js` / `scene_ranch.js` / `scene_gourmet.js` を追加。

```
js/
  scene_engine.js     共通シーン基盤（canvas/loop/loader/input/audio）
  scene_mall.js       🛍️ モール（既存 mall_dungeon ロジックを呼ぶプレゼン層）
  scene_scout.js      🌴 終章：密林スカウト
  scene_ranch.js      🐉 終章：牧場
  scene_gourmet.js    🍡 終章：グルメレース
images/scene/...      シーン用アセット（webp/atlas）
bgm/                  Suno生成のシーンBGM
docs/
  scene_engine_and_mall_redesign.md   本書
```

---

## 6. パフォーマンス／スマホ／注意

- canvas は **DPR上限2**・描画解像度を端末で可変。重い端末は粒子/視差を間引く。
- アセットは**シーン入場でロード／退場で破棄**。atlas＋webpで点数・容量を抑制。
- `prefers-reduced-motion` で自動スクロール/粒子を抑制（既存方針に合わせる）。
- `?v=` 更新を必ず実施（スマホキャッシュ対策）。
- **セーブ後方互換**：`state.player.dungeon` のキーは削除せず追加のみ。`load` にガード追加。

---

## 7. 実装チェックリスト

- [ ] `js/scene_engine.js`：基盤（loop/layers/actor/input/loader/audio/fallback）
- [ ] `js/scene_mall.js`：既存ロジック流用の歩けるモール（`mall_dungeon.js`はロジック専用に整理）
- [ ] `images/scene/mall/`：背景5フロア＋props atlas＋UI（ChatGPT→webp）
- [ ] `bgm/`：`mall-day` / `mall-fever`（Suno）＋ `RACE_BGM_TRACKS` 方式でシーン別に列挙
- [ ] `js/sfx.js`：モール用SEを追加（合成）
- [ ] `index.html`：新`<script>`＋`?v=` 一括更新
- [ ] `style.css`：canvasコンテナ／HUD（名前空間 `.sc-` `.mall-`）
- [ ] セーブ互換確認（既存 `state.player.dungeon` / `outfitsWon` 不変）
- [ ] バランス不変確認（報酬確率・メダル収支・抽選テーブルに変更なし）
