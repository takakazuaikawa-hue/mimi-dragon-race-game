# モール大冒険RPG アート差し込み口

敵の絵は **1つの台帳**＝`js/mall_rpg.js` の `RPG_ENEMY_IMG`（id→ファイル名）で管理します。
ここに1行足すと、HUDの敵カード・canvasの戦場スプライト・ショップ等のDOM描画の**すべて**に反映されます。
ファイルが無ければ自動で絵文字にフォールバック（404は出ません）。

## 敵スプライトの足しかた
1. 画像を **`images/rpg/<ファイル名>.webp`**（この直下・**透過webp**・推奨256〜512px正方形・正面向き1体・
   影は焼き込まない＝ゲーム側で接地シャドウを付ける・光源は左上で統一）に置く。
2. `js/mall_rpg.js` の `RPG_ENEMY_IMG` に1行足す：`<敵id>: "<ファイル名>",`
   （敵id＝`RPG_MONS` のキー。ファイル名は拡張子なし）。
3. `index.html` の `?v=` を更新（キャッシュ対策）。

### 現在結線済み（実在ファイル）
| 敵id | ファイル | キャラ |
|---|---|---|
| `slime`     | `en_bagslime.webp`  | マヨイスライム 🟢 |
| `mannequin` | `en_mannequin.webp` | うごくマネキン 🤖 |
| `escalator` | `en_sale_golem.webp`| 暴走エスカレーター |
| `baku`      | `en_cartrat.webp`   | 爆買いツアー客 🛍️（※観光客はcanvasでは手続き描画・HUDカードで使用） |
| `pricetag`  | `en_pricetag.webp`  | 値札ゴースト |
| `coupon`    | `en_coupon.webp`    | クーポン鳥 |
| `madam` / `maison` | `boss_maison.webp` | デパ地下マダム／マダム・メゾン |
| `boss1`     | `boss_donryu.webp`  | 観覧車ゴーレム 🎡（ボス） |

> 旧仕様（`images/rpg/enemies/<id>.webp` という別フォルダ・別命名・`RPG_ART_ENEMIES` 配列）は廃止しました。
> canvasが納品済み画像を見つけられず絵文字のままだった不具合の原因です（docs/MALL_UX_BACKLOG.md P0-2）。

## 今後追加できる差し込み口
- `images/rpg/mimi.webp` … 戦闘のミミ立ち絵。`js/mall_rpg.js` の `RPG_ART_MIMI = false` を `true` に。
- フロア別背景は現状は手続きHD-2D描画（画像化は指示書 M4/M5）。

## 権利
GitHub Pages公開のため、生成物の規約・ライセンスはクリーンに。CC0等を使う場合は出所を記録してください。
