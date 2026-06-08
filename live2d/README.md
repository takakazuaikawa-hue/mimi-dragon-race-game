# Mimi Live2D ツール — 1枚絵PNG → 分解 → アイドルアニメ

1枚のドラゴンPNGをブラウザ上でパーツに**分解（リギング）**し、Live2Dのように
**アイドルモーション**（呼吸・まばたき・羽/尻尾の揺れ・体の傾き・視線追従）で
動かすスタンドアロンツールです。**依存ゼロ・ビルド不要のバニラJS + Canvas2D**。

ゲーム本体には影響しません（`live2d/` 配下で完全自己完結）。

## 起動

ローカルHTTPサーバ経由で開きます（`file://` だと画像読込がCORSで失敗します）。

```bash
# リポジトリ直下で
python3 -m http.server 8000
# → http://localhost:8000/live2d/        エディタ
# → http://localhost:8000/live2d/#player  デモを即再生
```

## 使い方（エディタ）

1. **画像を開く (PNG)** か、ペインへ**ドラッグ&ドロップ**。`✨ デモドラゴン生成` で
   外部素材なしの動く例も出せます（`🧪 テスト画像` は `images/cast/mimi.png`）。
2. **背景除去** → **🪄ワンド**（許容スライダ）で部位をクリック選択。`＋追加/－削除`、
   **ブラシ/消し/なげなわ/矩形** で手直し。`拡張/収縮/穴埋め/ゴミ取/最大のみ` で精緻化。
   `↶Undo / ↷Redo`（Ctrl+Z / Ctrl+Shift+Z）。
3. **✓パーツ化** でマスクをクロップしてパーツ化。右パネルで:
   - `role`（body/head/eye/wing/tail/hair…）→ 既定モーションを自動付与
   - `▲z/▼z` 重なり順、`◎ピボット` をキャンバスクリックで配置
   - `⇋反転`（左右ミラー＝wing_L→wing_R）/ `⧉複製` / `✎再編集`→`↻再パーツ化` / `🗑`
   - `opacity / scale / rot` 静的トランスフォーム、`呼吸 / 揺れamp / 揺れfreq / まばたき` モーション
4. **⚠取りこぼし確認** で未割当ピクセルをハイライト → パーツ化候補に。
5. **▶アイドル再生** でプレビュー。**⬇書き出し** で `rig.json` を保存。
   - `embed`: パーツ画像をdataURLで内包した単一ファイル（配布/往復向け）
   - `分離`: `rig.json` + `parts/*.png`（`projects/<name>/` 配置・Claude編集向け）

## プレイヤー

`② プレイヤー` タブに `rig.json` をドラッグ&ドロップ → アイドル再生。
カーソルで視線・頭が追従。`ピボット表示` でリグ確認。

## リグ形式

- **embed**: `part.src = "data:image/png;base64,..."`（1ファイルで完結）
- **分離**: `part.file = "parts/<id>.png"`（diffしやすく Claude Code 向き）

スキーマは [`schema/rig.schema.json`](schema/rig.schema.json)。主なフィールド:
`parts[].{id, role, z, parent, rect, pivot, opacity, scale, offset, rot, flip, motion}`。
`motion.{breathing, blinkable, flutter, sway{amp,freq,phase,axis}, bend{amp,freq,axis,strips,rootEdge}, gaze{tx,ty}}`。

## Claude Code 連動（CLI・ブラウザ不要）

`node live2d/cli.js` は標準ライブラリのみで動き、リグを**検証/閲覧/編集**できます。
出力は決定論的（キー順固定・2スペース）なので差分編集と相性良し。

```bash
node live2d/cli.js validate live2d/samples/dragon.rig.json
node live2d/cli.js inspect  live2d/samples/dragon.rig.json
node live2d/cli.js coverage live2d/samples/dragon.rig.json
node live2d/cli.js part   live2d/projects/dragon/rig.json --id wing_L --set role=wing,z=6,opacity=0.85,flip=h
node live2d/cli.js motion live2d/projects/dragon/rig.json --id tail   --set sway.amp=0.18,breathing=0.2
node live2d/cli.js new dragon --source path/to/dragon.png    # projects/dragon/ を雛形生成
```

### Claude への典型指示例
- 「`projects/dragon/rig.json` の `wing_near` を複製して水平反転し `wing_far2` を作り、zを1に」
- 「`tail` の `sway.amp` を 0.2、`bend.strips` を 14 に。validateも通して」
- 「全パーツの `role` と `z` を一覧で出して、重なり順がおかしい所を指摘して」

> 推奨ワークフロー: **ブラウザで切る/直す → Claudeに rig.json を整えさせる/検証させる → ブラウザで確認** の反復。
> 画素の再生成（クロップ）が要る編集（反転の焼き込み等）はブラウザ側で行います。CLIはJSON/ジオメトリ操作と検証に集中します。

## ファイル構成

```
live2d/
  index.html              エディタ + プレイヤー（タブ）
  css/live2d.css
  js/util.js   (L2_UTIL)  共有ヘルパ（color/math/DOM, race_canvas.js から移植）
  js/rig.js    (L2_RIG)   スキーマ・validate・serialize/deserialize・hydrate（Node CLIと共有）
  js/segment.js(L2_SEG)   分解: αしきい値/ワンド/なげなわ/ブラシ/連結成分/morphology/undo
  js/demo.js   (L2_DEMO)  手続き的デモドラゴン（外部素材なしで動かす）
  js/player.js (L2_PLY)   アイドル再生（rAFループ + ソフトベンドstrip）
  js/editor.js (L2_ED)    エディタUI
  js/app.js               エントリ（タブ/ドラッグ&ドロップ/デモ）
  cli.js                  依存ゼロ Node CLI
  schema/rig.schema.json  JSON Schema
  samples/dragon.rig.json スキーマ例（分離形式・8パーツ）
  projects/<name>/        作業プロジェクト（source.png, parts/*.png, rig.json, meta.json）
```

## 技術メモ
- アイドル変形は**パーツ単位のアフィン変換**（pivot中心の rotate/scale/translate）＋
  羽/尻尾/髪の**ソフトベンド**（bitmapをN帯に分割し u² イージングで累進オフセット）。
  WebGLメッシュ不使用＝依存ゼロでアイドル振幅には十分。`motion.bend` はエンジン非依存
  なので将来WebGL backend差し替え可。
- rAFループ・sine駆動・per-id位相desync・transform作法は `js/race_canvas.js` を踏襲。
- 意味的自動分割（ML）は範囲外。手動＋アシスト分割（ワンド/連結成分/morphology）で対応。
