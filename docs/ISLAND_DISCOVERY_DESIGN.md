# 島の裏側を、自分の予想で見つける

追加実装：竜の痕跡からセラムに出会う探索、渡し環を使い続ける島民に会う探索、同行者別の会話、本編EDと終章の根拠への接続は `docs/ISLAND_JOURNEY_STORIES.md`。以下の五筋はそのまま保持する。追加二筋は11月18日にGPT-6 Astraが実操作し、指摘を反映して再検証した。隔離チェックポイントを用いた範囲と未測定の長時間進行は同文書に記録する。

## 遊びの核

島時間の観光に、第3話既読・地図解放後の任意の探索を加える。現地で違和感を観察し、別の場所で得た二つ目の根拠とつなぐ。行先の仮説を置き、その場へ移動して調べ方を選ぶ。正解の番号を当てるより、目にした風景を説明できるかを判断する遊びにする。

二枚しかない根拠に毎回チェックを付ける操作は省き、仮説へ自動で添える。未発見の全五筋や発見画像を一覧で先出ししない。既存の地図・章・資産の解放条件を通し、聖域や巣へ立ち入る権限を増やさない。現地の観察は実時計の待機を要求しない。

| 気になること | 二つの観察 | 見つけるもの |
| --- | --- | --- |
| 市場の飲み水の出所 | 水甕の手入れ札／棚田前で分かれる覆いの水路 | 共同の浄水・配水小屋と、水番の仕事 |
| 食べずに魚を運ぶ翼竜 | 竜舎の往復／風見の櫓から見る帰着方向 | 縄の外から見つける、巣のある奥棚 |
| 走らない日の居場所 | 竜舎の休養帳／棚田の水と野の竜の取り分 | 水場を塞がない牧場候補地、または既存牧場の水・退避路の記録 |
| 古布に残る不揃いな線 | 繕いの模様／浜の鳥居と護岸の刻み | 観光地になる前の、潮待ちの暮らしの遺構 |
| 名産があるのに出荷できない理由 | 果実酢の空瓶待ち／港の戻り荷と未受領印 | 容器輸入・加工品輸出・島内の瓶回収と受渡しの関係 |

水筋は入口のわかりやすい探索。後続はもっともらしい別の説明から考え直せるようにする。貿易では、瓶の輸入を増やすだけでは解けない回収・仕分け・未引渡しの反例を現地で確認する。間違いと不十分な方法には場所固有の反証を残し、無消費で仮説を修正できる。仮説・調査方法は固定の異なる順で表示し、先頭連打だけでは通らない。

## 報酬と暮らしへの接続

発見の返りは、場所の大きな絵、目の前の仕事がわかる記録、住民の返事、再訪時の短い挨拶、保存して変更できる二案の企画書。場所は元の地図地点の中の寄り道として再度開ける。既存の観光制覇の分母や衣装報酬条件は増やさない。

企画は「人の手入れを支える／運ぶ道を守る」など優先したいものを選ぶ。六つの既存投資分野に対応し、終章の経済画面から関連分野へ進むと、投資カードのそばに本人の企画を表示する。支払い・整備・メーターの計算は元の島づくりだけが扱う。企画保存で個別工事や輸出益が発生したとはしない。建設前の牧場は候補地として記録し、既存の竜分野Lv4以上で改めて調査した時のみ既存牧場のための記録になる。

終章の任意試遊「最後の一面」には、確認済みの発見ID・二つの根拠ID・仮説ID・企画ID・牧場の記録種別だけを渡す。準備中は閉じた記録、結果では島に続いてほしい仕事として表示する。通常レースの着順・オッズ・配当、試遊の着順・成功判定・会計は変えない。

## 実装

- `island_discovery.js`: 純粋UMD。`normalize/observe/propose/inspect/plan/getView/exportDiscoveries/normalizeExport/describeDiscovery`。保存先は `player.islandDiscovery`。
- `island_discovery_ui.js`: 既存地図の現地ボタン、探索手帖、再訪、経済と投資の表示。`nav.js` に画面、`next_suggest.js` に入出口を登録。
- `shingan_trial_bridge.js`: 自由文や画像パスを輸入せず、確認済みIDから定義を復元。本編セーブ全体は渡さない。
- 新画像 `images/konron/discovery/waterworks.webp`（614,912 bytes）と `cargo_exchange.webp`（430,020 bytes）は組み込みimage_genで新規生成。後者は新瓶・戻り瓶の分類・果実酢の出荷を近景で見せる。既存画像は上書きしない。他の発見は対応する島の既存写真を使う。

## 確認できたことと、残す評価

純粋モデルの回帰は五筋・九観察・全三十調査枝（発見五、反証二十、不十分五）、企画十、未開放地点・実地以外からの操作拒否、旧保存、重複、輸出入、候補地と既存牧場の区別を確認する。橋渡しの回帰は未確認仮説を発見として持ち込まず、企画の往復後も競走・予算・準備が変わらないことを確認する。

Browser pluginがないため既存PlaywrightとEdgeを使い、隔離した章の状態で本編を操作した。375px/360px/1280pxで五筋の観察→仮説→現地調査→発見→企画保存、誤説と不十分な調査からの修正、保存後の再読込、現地再訪、中盤の投資ロック、終章の関連分野表示、試遊結果への継承まで通過。コンソール例外・HTTPエラー・横はみ出しなし。試遊前後の本編localStorage一致。

GPT-6 Astraの別担当は正解コードを読まず水筋を実プレイし、市場から自力で棚田を選び、温泉説を具体的反証で修正して発見した。「短い入門探索として成立、写真回収より自分の発見が強い。次は竜の居場所を知りたい」と評価した。一方、明白な対抗説、再訪の開閉表示、企画の次の用途を指摘したため、後続の貿易の対抗説、明示的な開閉文、再訪の挨拶、終章の用途案内を追加した。

同じ独立担当が貿易筋も公開文から実操作し、輸入増説を試して受取帳の未引渡しを確認し、受渡しの経路へ仮説を更新して回収を優先する企画を残した。水より判断が濃いと評価した一方、部分的に有効な説を全否定する見出しと、空瓶の仕事が見えない港の遠景を指摘した。そのため「一部は説明できた。別の待ちもあった」という返しと専用の近景を追加した。親側でその返し→現地での修正→新画像の読み込みを375px/1280pxで操作確認し、財布不変・例外なしを確認した。

自然な通し進行における発見の間隔、全五筋の人間による難度評価、長期の島への愛着は未測定。新しい貿易収支シミュレーションや施設工事一式を完成させたものではない。

## 画像の最終プロンプト（built-in image_gen）

### 貿易の仕事場

Use case: stylized-concept. Asset type: full-bleed discovery reward illustration for a sophisticated Japanese fantasy island game. Single cinematic environment still, landscape 3:2, no text, no UI or panels. Close, tactile view inside the working receiving alcove of a tropical volcanic island harbor at golden hour. Three distinct material flows clearly visible: a clean wooden crate of identical new empty glass bottles delivered from an outside kiln, a sorting bench with mismatched returned empty bottles divided by shape and simple colored cloth ties, and completed amber-red tropical fruit vinegar in glass bottles with wax stoppers packed in woven protective sleeves awaiting outbound shipping. A dockworker's weathered hand seen from the edge places a plain twine tag on a crate, the person is mostly out of frame. Rolled cargo ledger, brass balance scale, fruit basket with cosmetically imperfect red mangoes. Glowing transmitted sunlight through glass, warm basalt port stone, turquoise water and a moored cargo boat softly out of focus beyond the alcove, distant misty volcanic slope. A believable lived-in logistics workplace, an intimate discovery of how people work, not a souvenir shop and no tourists. Photorealistic cinematic game environment, excellent glass and wood material detail, premium restrained color grading. Composition focuses on bottles, crates, sorting and inbound-outbound flow, no modern plastic, no writing, no logos, no readable lettering, no alphanumeric labels.

### 配水小屋

Use case: stylized-concept. Asset type: environment discovery reward background for a polished Japanese fantasy island exploration game. A single cinematic landscape image, no text, no UI, no panels. Discover a small old but carefully maintained water filtration and distribution facility on a misty volcanic tropical island. Three descending basalt basins filter clear spring water over pale gravel, a mossy stone aqueduct feeds from a wooded slope and a small wooden maintenance gate redirects a thin channel toward distant terraced farms and the harbor town. A caretaker in work clothes seen only as a small back silhouette turns a brass valve, everyday human care not magic. Transparent turquoise water with strong caustics, wet black volcanic stone, lush leaves, antique brass fittings, golden early morning shafts in cool mist. Rewarding hidden place, lived in and credible, warm sophisticated art direction. Photorealistic cinematic game environment with painterly restraint, excellent material detail, deep composition. Wide 3:2 framing, no typography, no dragon racing, no logos, no modern industrial towers. Clearly a modest operating facility, not a gigantic new dam.
