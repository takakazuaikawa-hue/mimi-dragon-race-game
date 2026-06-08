# celestia — サンプルプロジェクト（分離形式リグ）

`images/cast/celestia.png` をツールで自動処理して作った分離形式のリグです。
背景除去 → 最大成分＋穴埋め → 頭(上46%)/胴(下) の2パーツに分割 → リグ化。

```
celestia/
  rig.json        分離形式（parts/*.png を参照）
  source.png      元画像（再編集用・celestia.png のコピー）
  parts/
    head.png      頭パーツ（首がピボット）
    body.png      胴パーツ（足元がピボット）
```

## 使い方
- ローカルサーバ経由でプレイヤーに rig.json をドラッグ&ドロップ：
  ```bash
  python3 -m http.server 8000
  # http://localhost:8000/live2d/ →「②プレイヤー」タブに rig.json をD&D
  ```
- CLI で検証/確認：
  ```bash
  node live2d/cli.js validate live2d/projects/celestia/rig.json
  node live2d/cli.js inspect  live2d/projects/celestia/rig.json
  ```

## メモ
- 自動の水平カットのため首付近に継ぎ目が出ます。エディタで `source.png` を開き、
  首のラインに沿って手作業でパーツ境界を引き直すと消えます。
- 胸を `chest` ロールで2つ置くと「ぷるぷる（同時/交互）」を付けられます。
