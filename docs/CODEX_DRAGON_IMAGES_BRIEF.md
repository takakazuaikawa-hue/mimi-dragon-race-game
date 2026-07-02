# 指示書：残りのドラゴン画像 40頭の生成（Codex向け・自己完結）

ゲーム「聖龍爆走録ミミ」（このリポジトリ・vanilla JS・GitHub Pages配信）の**図鑑/龍舎用ドラゴン立ち絵**。
基本12頭は生成済み＝`images/dragons/<id>.png`（rubel/seram/poro/gando/miruka/baran/rosso/momu/phenix/raika/stella/glaze）。
**今回のゴール＝拡張40頭**（`js/data_dragons_ext.js` の SEEDS・tier1〜7）を同じシリーズとして生成し、同じ場所に置く。

## ⛔ やらないこと（厳守）
- **ゲームコード（js/css/html）の変更禁止**。画像の配線（コードへの組み込み）は別途こちらで行う。
- **既存12枚の上書き・削除禁止**。`images/` の他フォルダにも触れない。
- レース数値（race_engine/odds_engine/betting_engine等）は読み書きとも不要＝触らない。
- デプロイ（main への push）はしない。画像ファイルの追加コミットのみ（ブランチ運用は依頼者の指示に従う）。

## ✅ 出力仕様
- パス・命名：`images/dragons/<id>.png`（idは下表の英小文字を**正確に**。誤字は配線不能になる）
- キャンバス：**横長 約600×430px**（既存と同じ。4:3弱の横長なら可）
- 背景：**無地の白**（透過不可・小物や地面や影の主張は最小限・フレームなし）
- 文字・ロゴ・透かし：**一切入れない**
- 1枚に**その竜1頭のみ・全身**・**頭が右向き**（既存12枚と同じ向き）
- ファイルサイズ目安：1枚 100KB以下（PNGが重い場合はWebP圧縮でも可＝既存12枚も実体はWebP。拡張子は .png のまま）

## 🎨 様式ガイド（既存12枚から抽出＝これに合わせる）
**ソフトなスタイライズド3Dトイ調（Pixar/フィギュア風）**。やわらかいスタジオ光・マットで温かい質感・
太めのシルエット・大きめの頭部と表情豊かな目。**性格が造形と素材に出る**のがこのシリーズの核
（例：眠雲竜モム＝翼と尾が「雲そのもの」でまどろんだ半目／赤翼竜ルベル＝きりっと勝気な眉と構え）。
リアル鱗の爬虫類ではなく「愛でられる生き物」。ただし幼児向けすぎない品（高tierは風格を出す）。

### マスタープロンプト（英語・1頭ごとに《》を差し替え）
```
Soft stylized 3D toy render of a single fantasy dragon, Pixar-like figurine style,
full body, facing right, centered on a plain white background, soft studio lighting,
matte friendly materials, big expressive eyes, no text, no watermark, no frame.
Body color: 《基調色HEX》. Design: 《造形メモ英訳》. Personality in the pose: 《性格》.
Landscape 600x430.
```

### 系統（arch）→体型の言語
| arch | 体型・翼・姿勢 |
|---|---|
| allrounder | バランス体型・素直な立ち姿・端正 |
| speed_escape | 細身流線型・長い脚・前傾で今にも駆け出しそう |
| wing_closer | **大きな翼が主役**・翼を広げ気味・胸を張る |
| stamina_tank | 重量級・岩/甲殻の装甲・どっしり四足・首太 |
| fire_bruiser | がっしり・鬣/尾に炎や熱のモチーフ・目に闘気 |
| turn_tech | しなやか・**爪が特徴**・身軽に体を捻ったポーズ |
| fog_mystic | ほっそり神秘的・長い角・体に薄い霧を纏う |
| cloud_chaser | モム系＝**翼や尾が雲素材**・ふわふわ・浮遊感 |

### 格（tier）と気配（hype/mark）の演出
- tier1＝新人：小柄・あどけない ／ tier2-3＝若竜 ／ tier4-5＝成竜・風格 ／ tier6＝祝祭級の華やかさ ／ **tier7＝神格**：一回り堂々＋**指定色の薄いオーラ**を身体の輪郭に（背景は白のまま）
- hype: star＝華やか・自信の表情 ／ solid＝端正・落ち着き ／ dark＝渋い・影のある佇まい（大穴の魅力）
- mark「◎」＝本命の貫禄（堂々と正面胸張り） ／ 「×」＝大穴（ひょうひょうと掴みどころがない）

## 🐉 生成台帳（40頭・この順で。1頭生成→白背景/右向き/単体/文字なしを自己チェック→保存→次へ）

| # | id | 名前 | 基調色 | arch | tier/hype/mark | 造形メモ（プロンプトの核） |
|---|---|---|---|---|---|---|
| 1 | kogane | 金鱗竜コガネ | #e0b94a | allrounder | 1/star | 小金色の鱗がきらめく素直な新人。人なつこい笑顔 |
| 2 | susu | 煤煙竜スス | #7a6a5a | fire_bruiser | 1/dark | 煤で燻したような灰茶。鼻先から細い煙、地味だが目は熱い |
| 3 | nagi | 凪翼竜ナギ | #8fd0c0 | wing_closer | 1/solid | 凪いだ海色の若竜。翼を静かに畳み、風を待つ横顔 |
| 4 | goro | 轟岩竜ゴロー | #9a8466 | stamina_tank | 1/solid | ごつごつ岩肌の子亀のような愛嬌。どっしり安定 |
| 5 | chiri | 塵雲竜チリ | #a99bc0 | cloud_chaser | 1/dark/× | 薄紫の塵っぽい雲を纏う。ふらりと視線が定まらない |
| 6 | akane | 茜翼竜アカネ | #e8714a | speed_escape | 2/star | 茜空色の快速竜。翼が夕焼けグラデ、華やかな流し目 |
| 7 | tsumuji | 旋風竜ツムジ | #6cc28a | turn_tech | 2/solid | 若草色。体を旋風のように捻り、鋭い爪を見せる |
| 8 | yoi | 宵霧竜ヨイ | #9aa6c8 | fog_mystic | 2/dark | 宵闇の青紫。細身に薄霧、伏し目がちで物静か |
| 9 | hibana | 火花竜ヒバナ | #f0863a | fire_bruiser | 2/solid | 尾先が火花のように爆ぜる。目つきが荒い（気性難） |
| 10 | shio | 潮翼竜シオ | #4aa8d0 | wing_closer | 2/solid | 潮色の大翼に波紋様。安定感のある穏やかな顔 |
| 11 | kabe | 岩壁竜カベ | #8a7a64 | stamina_tank | 2/dark | 岩壁のような平たい装甲板を背負う。無骨・寡黙 |
| 12 | benio | 紅尾竜ベニオ | #e24a52 | fire_bruiser | 3/star/◎ | 深紅。長い尾が燃えるリボンのようにたなびく。本命の貫禄 |
| 13 | kazemaru | 疾風竜カゼマル | #5ac0e0 | speed_escape | 3/solid | 空色の軽量級。風を切る流線シルエット、涼しい顔 |
| 14 | sazare | 細波竜サザレ | #58c272 | turn_tech | 3/solid | 若緑。鱗が細波模様、小回りの体勢で爪先立ち |
| 15 | murasame | 叢雨竜ムラサメ | #8e9ad6 | fog_mystic | 3/dark | 雨雲色。長角に雨滴、渋く濡れたような艶 |
| 16 | taiga | 大牙竜タイガ | #a07850 | stamina_tank | 3/solid | 琥珀茶の巨躯に立派な二本牙。悠然 |
| 17 | yumeji | 夢路竜ユメジ | #9d88d0 | cloud_chaser | 3/dark/× | 夢見色の雲を薄く曳く。とろんと夢うつつの半目 |
| 18 | shakunetsu | 灼熱竜シャク | #f06028 | fire_bruiser | 4/star | 灼熱オレンジ。鬣が炎、体から陽炎。堂々の風格 |
| 19 | hayate | 颯竜ハヤテ | #48b0e8 | speed_escape | 4/solid | 鋭い閃光の青。研ぎ澄まされた細身、目が鋭い（気性難） |
| 20 | arashi | 嵐翼竜アラシ | #5a8ad8 | wing_closer | 4/star | 嵐色の**特大の翼**。翼開帳が主役、頼れる兄貴顔 |
| 21 | konron | 崑崙竜コンロン | #8e7a5c | stamina_tank | 4/solid | 崑崙の岩そのものの重厚な体。山のような背 |
| 22 | shirahae | 白南風竜シラハエ | #a0b0d0 | fog_mystic | 4/dark | 白みがかった初夏の霧色。ほっそり優美、人気薄の色気 |
| 23 | kirari | 煌竜キラリ | #5cc888 | turn_tech | 4/solid | エメラルド。鱗が宝石のように煌めき、軽やかに旋回 |
| 24 | guren | 紅蓮竜グレン | #e0463e | fire_bruiser | 5/star/◎ | 紅蓮の業火を鬣と尾に。竜王級の圧、燃える瞳 |
| 25 | raijin | 雷迅竜ライジン | #6a64e8 | speed_escape | 5/star | 藍紫。角が稲妻形、体側に電光の筋。ピリつく気性 |
| 26 | sora | 蒼穹竜ソラ | #4a92dc | wing_closer | 5/solid | 抜けるような蒼。大翼の裏が空色グラデ、澄んだ目 |
| 27 | banju | 磐樹竜バンジュ | #7a8a5c | stamina_tank | 5/dark | 巨樹と岩が融合した体。苔むした装甲、不沈の静けさ |
| 28 | gekka | 月華竜ゲッカ | #a088d4 | fog_mystic | 5/solid | 月光の薄紫。三日月形の角、夜靄をまとう気品 |
| 29 | senpu | 穿風竜センプ | #54c096 | turn_tech | 5/solid | 翡翠。錐のように鋭い爪と尾、風を穿つ体勢 |
| 30 | enma | 炎魔竜エンマ | #e84028 | fire_bruiser | 6/star/◎ | 獄火の深紅黒。禍々しくも祝祭の華、角が焔の冠 |
| 31 | hayao | 疾風皇竜ハヤオ | #3aa0e0 | speed_escape | 6/star/◎ | 皇帝の空色。看板スター、白いたてがみ、極まった流線 |
| 32 | tenku | 天空竜テンク | #4a86e0 | wing_closer | 6/star | 天空青の荘厳な大翼。雲の上の王者の眼差し |
| 33 | gozan | 豪山竜ゴウザン | #8a7252 | stamina_tank | 6/solid | 山脈のような背びれの連なり。豪壮・岩の光沢 |
| 34 | yugiri | 夕霧竜ユウギリ | #9888c8 | fog_mystic | 6/dark | 夕暮れの霧紫。帳のような被膜をまとう、妙味の渋さ |
| 35 | reppu | 裂風竜レップウ | #50c884 | turn_tech | 6/solid | 鮮緑。刃のような爪、風が裂ける残像の表現 |
| 36 | goka | 業火神竜ゴウカ | #f03820 | fire_bruiser | 7/star/◎ | **神格**。神焔の緋色、**#ff7a3aの薄いオーラ**、焔の後光 |
| 37 | raiou | 雷王竜ライオウ | #6058f0 | speed_escape | 7/star/◎ | **神格**。雷王の紺紫、**#9a8cffの薄いオーラ**、劫雷の角冠 |
| 38 | souten | 蒼天神竜ソウテン | #3a80ea | wing_closer | 7/star/◎ | **神格**。蒼天の神翼、**#8fb8ffの薄いオーラ**、翼が空そのもの |
| 39 | fugaku | 不岳竜フガク | #8c7858 | stamina_tank | 7/solid | **神格**。動かざる霊峰の体躯、鉄巌の質感、静かな威 |
| 40 | yomi | 黄泉霧竜ヨミ | #9080c0 | fog_mystic | 7/dark | **神格**。黄泉の霧色、**#7a6aa8の薄いオーラ**、幽玄の伏兵 |

## 🔍 1枚ごとの合格チェック（保存前に必ず）
1. 白背景・単体・全身・**頭が右向き**・文字/透かしなし
2. 基調色が表のHEXに合っている（似た竜同士＝紅系4頭・青系5頭などが**並んでも見分けがつく**か）
3. 既存12枚（特に rubel.png と momu.png）と並べて同じシリーズに見える
4. tier7の5頭はオーラ＋格が出ている／tier1の5頭は新人らしい素朴さ
5. ファイル名がidと完全一致（英小文字・拡張子.png）

## 納品
`images/dragons/` に40ファイル追加 → コミットメッセージ例：`assets(dragons): 拡張40頭の図鑑用立ち絵を追加（tier1-7・生成のみ・配線なし）`。
コードは変更しないこと。完了報告には「生成できなかった/自信のない竜のidリスト」を添えること（後で再生成するため）。
