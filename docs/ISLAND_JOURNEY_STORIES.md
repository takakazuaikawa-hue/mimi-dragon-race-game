# 竜の痕跡と、日常にある伝説

## 今回の遊び

既存の五つの現地調査に二つを追加する。第3話既読・観光解放後、「探索手帖」の「別の気になる景色を、探す」から、水のみ場と古布屋へ進める。現地で直接手掛かりを見つけてもよい。最初から全解答や発見場面を並べない。

### 風を待つ一頭

水のみ場で、飲み水まで降りず風上へ揃った爪あとを観察する。風見の櫓で羽の裏の青と、風の切れ目に止まる影を観察する。帰りを急ぐ／水の順番を待つ／風を待つという説明を、行先と実際のしぐさから照合する。羽色の一致だけでは完了しない。

岩棚の縄の手前で距離を保ち、風と姿勢の変化を見届けると青翼竜セラムに出会う。既存の風との関係を使うが、スカウト限定の伝承の段階や家族の秘密は開放しない。羽を奪わずスケッチを残す。竜の能力や次の着順を変えず、仲間に迎えた扱いにもしない。スカウト先は `scoutDragonHome` と開放判定から決める。現データでセラムは海のロケであり、見つけた場所の空の印象で固定しない。

### 渡し環を受け継ぐ人

古布屋の「切れた道を渡す輪」の写しと、港で網を繕う人の環を見比べる。飾り／祭具／仕事の道具という用途を、傷・継ぎ目・使い方で確かめる。形と光の似方だけでは、受け継いだ品と写した品を区別しきれない。

新しい島民「網繕いのサヨ」が修理帳を開く。写しと修理記録を照合した後、練習用の環と糸を借り、実際に用途を確かめる。外側に巻くと糸が滑り、内側に通すと離れた網目へ渡る。ドラッグと同等のボタン操作を用意する。つながった網目をサヨに見せてから小さな環を受け取り、そこで発見を確定する。照合だけ・試用だけで記念品や終盤への輸出は発生しない。

原品は仕事場に残す。再訪では新しい品を何度も渡さず、前に渡した環を覚えた挨拶にする。「ナギ」は既存竜の名のため、新島民には使わない。古布の手掛かりから漁村へ向かう推測にも、網を頼んでいる漁師の話を置き、港の仕事台につながる暮らしの根拠を返す。

## 一緒にめぐる

サケ・スミカ・ミズ・ポロから、実際に出会い済みの相手だけを選ぶ。一人で巡ることもできる。`advisorMet` / `poroFound` を門番にし、未登場のキャラの名前や肖像は候補に出さない。選んだ同行相手は既存の到着会話にも反映する。

二つの探索それぞれに、観察・仮説修正・発見・再訪の会話を用意した。同行者は先に答えを言い切らず、ミミと一緒に観察する。ミミは反応と質問、サケは現場を見る姿勢、スミカは記録と暮らし、ミズは見立てと価値、ポロは人語ではなくしぐさで参加する。立ち絵は既存素材をCSSで顔周辺に表示する。

最初の発見時に同行していた相手を保存し、後から別の相手と再訪しても過去を上書きしない。環では最初に糸が通った時の相手（単独/nullも含む）を固定し、受取直前に同行を変えても置き換えない。旧発見に同行相手や未体験の試用を捏造しない。

二地点目の会話は、その場所で得た新しい観察に反応する。現地で見た会話は手帖では閉じて読み返せる形にし、全文の連続反復を避ける。ミズも初期観察で使用価値の結論を言い切らず、本人が比べることを待つ。

## 終盤での使い方

- 本編のエンディング後の止まった画面に、確認済みの二つの出会いだけを任意で開く「一緒に見つけた、島の続き」として追加する。誰と見つけたか、スケッチや環、再訪の言葉が残る。
- 任意試遊「最後の一面」には、検証済みの発見・同行IDと企画IDを読み取り専用で渡す。自由文、財布、セーブ全体を渡さない。
- 一面の各予想では、経験を選んだ後、今回の何を照合するかを二択から選ぶ。痕跡は特性×コース条件、または好材料と弱くなる条件。環は別券種の同一対象による連動、または読者の反応と的中条件の区別。実際の竜名・特性・取材メモ・コース・券種・届ける枠を並べ、発行前に本人の具体的な見立てを一文で示す。
- `island_field_read.js` は公開資料だけから発行時の不変スナップショットを作り、結果の実着順・券種の的中と並べる。人気・読者を見る場合のみ、投票量と一日全体の収支も表示する。着順を見てから理由を書き換えず、別コースに変えたら再確認する。現試走にない区間通過の結果は補わず、的中だけで教訓の正しさを採点しない。
- これらの記憶・記念品・根拠の添付で、着順、的中判定、配当、読者数、運営収支、通常スカウトを変更しない。

## 保存と実装

`island_discovery_stories.js` に追加の二ケース・四観察・同行会話を分離。既存 `island_discovery.js` は同じversion 1の保存に追加データを受け入れ、発見時の `companionId` を検証して保存・輸出する。古い保存の省略値はnull。

`player.discoveryCompanion` は今選んでいる相手。実際に利用可能な相手だけをcontextに渡す。再訪時の現在の同行相手と、最初に出会いを共有した相手は別に扱う。

発見の絵は `images/konron/discovery/seram_windwait.webp` と `watashi_ring.webp`。組み込みimage_genで生成し、前者は既存 `images/dragons/seram.png` をキャラクターデザインの参考にした。元画像は上書きしない。現地の手掛かりカードは同じ絵の手元・手すり部分だけをCSSで拡大し、発見時に全景へつながる。

## 検証と未実施の評価

純粋モデルは七筋・十三観察・全四十二調査分岐（発見七、反証二十八、不十分七）、企画十四案、門番、未観察・現地以外からの操作拒否、保存往復、初回の同行者保持を確認。終盤への橋渡しはセラム・環・同行者の同一性と、競走・予算・準備の非干渉を確認した。

既存8770番ポートは別プロジェクトのViteサーバーが使っていたため変更せず、このリポジトリ用に127.0.0.1:8772で静的サーバーを起動した。Browser pluginは未提供のため、既存PlaywrightとEdgeの隔離コンテキストで検証した。実ユーザーの保存は読まず、章の状態を準備して操作した。

375px/360px/1280pxで、二つの現地観察→誤説と不十分な調査→修正→発見→企画、同行別の会話、記念品、再読込、別の相手との再訪、本編EDの記憶、試遊の予想への添付と結果まで操作通過。コンソール例外とHTTPエラーなし。試遊前後の本編localStorage一致。検証中、EDで長い記憶を開いた時の上端が読めるよう配置を修正し、動きを抑える設定ではフェードを省いた。

11月17日の依頼時は上位モデルが利用上限で停止したが、11月18日に再開してGPT-6 Astraが新二筋を実操作した。正解ソースや親のQAは読まず、足跡から自分で風見の櫓へ向かい、誤説を試した後に通常の食事を挟んで再開し、ポロとセラムに会って再訪した。伝説では最初に漁村を選んだが当初は手掛かりがなく、親から港の方向を補助された。この事実を隠さず、ゲーム側に漁師からの自然な話を追加した。ミズと、誤説→照合→外側ドラッグで滑る→内側で通す→サヨへ見せる→受取→再訪まで操作した。

評価は「短い探索として成立」。セラムでは静かな岩棚と距離、サヨでは翌日も網を繕う仕事を守りたい対象として挙げた。一方、易しい推理、同行会話の反復、早すぎる価値の説明、終盤の付箋に近い接続を指摘した。上位の別担当は正規スカウト先の誤り、中盤の門番を探索不足に見せる表示、用途確認が説明だけの構造を指摘した。上記の試用と会話、再開案内、公開資料の比較はその指摘を採用した修正。

上位担当による食事を挟んだ再開・再訪・本編ED・試遊結果の同一性確認も通過。テストrunnerが新ページを誤って待って終了したため、後半の記憶確認には同じUI選択を復元した隔離チェックポイントを使った。新規初見の自然な通しクリアとしては扱わない。初回探索はconsole例外0、後半にURL不明の通信拒否1件があったが、可視画像の欠落は0。親の別コンテキストでは全工程HTTPエラー0を確認した。

資産3万から100万での再開、閉じた入口を出さないこと、正規の海のスカウト先への案内、漁村の話、試用の中断保存、未受取の輸出拒否、旧成功の保持、初回試用の同行者保持を追加回帰で確認した。公開資料の具体比較は四つの見方について、入力非変更・隠れた着順を参照しないこと・発行後に変わらないこと・競走/経済非干渉を検証する。

### 最終再評価（11月18日、p3 / p4）

GPT-6 Astraが公開資料の比較を実操作し、発行前と同じ見立てが実着順・的中結果に残ること、同配置で票328/90/135と収支+53.9が変わらないこと、別コースへ進むと以前の見立てを再利用しないことを確認した。375px/1280pxで横はみ出しなし、console/pageerrorは0。

「比較して選ぶだけでは結論が残らない」という追加指摘を受け、重複する予想を承知で掲載する意思を明示して保存する形に変更。p4で「掲載を見直すため、紙面に戻る」を実クリックして二枚を保持したまま戻れること、再選択して「今回は重なりを残して掲載する」が保存されることを同担当が再確認し、この重複比較について「付箋止まり」の指摘は解消と評価した。公開資料を読む任意機能であり、当たりを教えたりレース結果を変えたりする機能ではない。

最終の純粋モデル回帰は七筋・十三観察・全四十二分岐、試用と同行者保持、橋渡し、四つの公開比較が通過。144個のJavaScript構文と本編106箇所のキャッシュ版統一も通過した。実操作の詳細は隔離QA領域の `independent-newstories-report.md` に記録する。

自然な最初からの長時間進行による発見間隔、人間の初見分布、長期の愛着は未測定。これは今回の隔離チェックポイントでの上位モデル評価と区別する。

## 生成プロンプト

### 渡し環（built-in image_gen）

Cinematic fantasy island game discovery reward still, landscape 3:2, single scene, no text or UI. In a small inhabited tropical volcanic harbor net repair workshop, an original legendary hand tool is still in everyday use: a palm-sized ancient bronze ring with a small smooth gate for passing cord through, asymmetric worn rim, three old repair seams wrapped with faded indigo cord, tiny wave engraving, resting prominently between the skilled hands of an appealing middle-aged island woman craftsperson wearing a simple blue linen work coat. Her warm face is in the upper right middle distance, not a portrait focus. An old ink rubbing of the same ring motif lies on the bench, with frayed fishing net and a freshly mended strip of woven net, a smaller newly-made brass keepsake ring beside it. Nets and island harbor blue water softly beyond. The reward is realizing a storied treasure has been quietly supporting island life all along, lovingly repaired across generations. Rich tactile bronze, waxed cord, work-worn wood and realistic natural hands. Premium photorealistic cinematic environment, gentle painterly art direction, warm morning light mixed with cool sea reflections, inviting and humane, no jewel treasure chest, no ornate royal crown, no readable writing, no modern machines, no logos.

### セラムの風待ち（built-in image_gen、既存竜画像を参考）

Create a new landscape 3:2 cinematic fantasy island environment discovery illustration using the attached blue dragon only as CHARACTER DESIGN REFERENCE, not as an edit target. Preserve the dragon's recognizable pale blue scaled body, layered feather-shaped wings, two gently swept back horns, long tapering tail and friendly dignified face. Place this single blue dragon peacefully standing on a grassy coastal rock ledge above a turquoise sea, wings half lifted to feel the changing breeze, neck facing into the wind, looking slightly toward the viewer without approaching. In the left foreground a worn wooden observation rail with small overlapping claw scratches and a fallen feather seen pale on its upper side and blue on the turned edge, sunlit grasses all lean together. The viewer stands outside a simple rope boundary well away from the dragon, so the picture gives a calm sense of a respectful encounter at a distance. Misty volcanic tropical island, dark basalt rock, golden afternoon sunlight and cool blue sea, premium cinematic game environment, realistic materials with slightly painterly art direction. The blue dragon is the only dragon, elegant and appealing, not aggressive, no rider, no race, no magical speech, no cages, no UI, no words, no logos.
