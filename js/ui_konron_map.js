// =========================================================================
// ui_konron_map.js — 崑崙島 観光マップ統合ハブ（表示専用メタ・レース数値に非干渉）
// =========================================================================
// 土台＝設定の聖典の最終版「崑崙島 地形・道路整理図 V3.3」をnano img2imdで実写級3Dジオラマ化
//   (images/konron/island_map.webp・レイアウトは公式図を保持)。
// ★ピンは“密集して重なる”のを避けるため【エリア単位】に集約（公式図の位置に少数を離して配置）。
//   エリアをタップ→そのエリアのスポット一覧→スポット詳細(写真カード)＋既存機能ポータルへドリルダウン。
//   ＝タップしやすく、地名を詰め込みすぎない（ハンドオフ40の方針）。総資産で各スポット段階解放。
// ★着順・オッズ・配当には一切触れない。poro.js の後に読み込み＝renderScout等はcall-time解決。
// =========================================================================

// 7分類（スポットの色分け・凡例）
const KM_CATS = {
  port:  { name: "港・街歩き",   ic: "⛵", color: "#5aa6d6" },
  food:  { name: "食べ歩き",     ic: "🍢", color: "#e08a3a" },
  shop:  { name: "ショッピング", ic: "🛍️", color: "#d46aa8" },
  race:  { name: "レース観戦",   ic: "🏁", color: "#e2604a" },
  onsen: { name: "温泉",         ic: "♨️", color: "#36a892" },
  view:  { name: "絶景・自然",   ic: "🏞️", color: "#5cb35e" },
  oshi:  { name: "推し活・SNS",  ic: "📣", color: "#b069c8" },
  okuchi:{ name: "奥地・秘境",   ic: "🌫️", color: "#8a7bb0" },
  stay:  { name: "宿泊・余韻",   ic: "🏨", color: "#c98a6a" },
  civic: { name: "行政・施設",   ic: "🏛️", color: "#7d93a8" }
};

// 解放しきい値（総資産＝高水位。序章0／第2話3千／第4話100万／終章1億）。表示専用ゲート。
const KM_TIER_AT = [0, 3000, 1000000, 100000000];

// スポット（写真スポットカード＋ポータル）。位置は持たない＝エリアに属する。
const KONRON_SPOTS = {
  mistra:    { name: "ミストラ湾",       cat: "port", tier: 1, time: "朝〜夕", photo: "images/konron/spots/mistra.webp", shoot: "湾の全景・港とアレドラウ山・朝霧の船影", line: "島に着いた瞬間、旅が始まる霧と光の玄関口。" },
  kirimina:  { name: "霧港",             cat: "port", tier: 1, time: "夕〜夜", photo: "images/konron/spots/kirimina.webp", gourmet: "images/konron/spots/kirimina_gourmet.webp", shoot: "提灯と漁船・港の屋台・干物と小舟", line: "潮の匂いと提灯の灯りが混ざる、崑崙島の生活の入口。" },
  market:    { name: "霧待ち市場",       cat: "food", tier: 0, portal: "renderMeals", time: "夜", photo: "images/konron/spots/market.webp", gourmet: "images/konron/spots/market_gourmet.webp", shoot: "屋台の湯気・竜まんじゅう・ファイヤマンゴーかき氷・ミストラソーダ", line: "勝っても負けても、まずここへ。崑崙島の夜は市場の湯気から。" },
  ohzuba:    { name: "大翼通り",         cat: "port", tier: 1, time: "昼前", photo: "images/konron/spots/ohzuba.webp", shoot: "レース場へ続く人波・推し竜旗・魔導掲示板", line: "港からレース場へ、島いちばん賑やかな大通り。" },
  mall:      { name: "崑崙ショッピングモール", cat: "shop", tier: 1, portal: "renderMall", time: "昼〜夜", photo: "images/konron/spots/mall.webp", gourmet: "images/konron/spots/mall_gourmet.webp", shoot: "公式推し竜ショップ・土産袋・ぬいぐるみ・フードコート", line: "レースの思い出は、袋いっぱいに持ち帰れる。島いちばんの買い物拠点。" },
  arcade:    { name: "ミストラ・ブランドアーケード", cat: "shop", tier: 2, portal: "renderMall", time: "夕〜夜", photo: "images/konron/spots/arcade.webp", gourmet: "images/konron/spots/arcade_gourmet.webp", shoot: "金色の照明・聖龍アクセサリー・高級土産袋", line: "勝った夜は、少しだけ背伸びしたくなる。" },
  donryu:    { name: "ドン竜キホーテ",   cat: "shop", tier: 2, portal: "renderMall", time: "深夜", photo: "images/konron/spots/donryu.webp", shoot: "謎の推し竜グッズ・安売り衣装・変な土産", line: "なぜ買ったのか、明日の朝にはわからない。それも旅。" },
  kachimeshi:{ name: "勝ち飯横丁",       cat: "food", tier: 1, portal: "renderMeals", time: "レース後", photo: "images/konron/spots/kachimeshi.webp", gourmet: "images/konron/spots/kachimeshi_gourmet.webp", shoot: "的中券と串焼き・祝勝皿・乾杯", line: "大勝ちじゃなくても今日は勝ち。ちょっとだけ豪華に。" },
  makemeshi: { name: "負け飯屋台",       cat: "food", tier: 0, portal: "renderMeals", time: "レース後〜夜", photo: "images/konron/spots/makemeshi.webp", gourmet: "images/konron/spots/makemeshi_gourmet.webp", shoot: "外れ券と大盛り飯・反省茶・負け麺", line: "負けても腹は減る。明日の勝負は、まず一杯の飯から。" },
  racecourse:{ name: "中央聖龍レース場", cat: "race", tier: 0, portal: "renderRaceSelect", time: "昼〜夕", photo: "images/konron/spots/racecourse.webp", shoot: "火山を背にした観戦席・推し竜旗・的中券", line: "火山の風を切って、聖龍が駆ける。崑崙島最大の熱狂。" },
  tanryu:    { name: "単竜ひろば",       cat: "race", tier: 0, portal: "renderRaceSelect", time: "昼前", photo: "images/konron/spots/tanryu.webp", shoot: "初心者掲示板・番号札・はじめてのレース券", line: "まずは一着を選ぶ。旅の勝負はここから。" },
  oshigoods: { name: "推し竜グッズ売り場", cat: "oshi", tier: 1, portal: "renderSns", time: "終日", photo: "images/konron/spots/oshigoods.webp", shoot: "推し竜旗・ぬいぐるみ・タオル・冠名グッズ", line: "レース体験を“自分の旅の記念品”に変える。" },
  ryusha:    { name: "竜舎林・竜スカウト", cat: "oshi", tier: 1, portal: "renderScout", time: "—", photo: "images/konron/spots/ryusha.webp", shoot: "—", line: "レース場の奥、竜たちの棲む森。野の竜と出会いにいく。" },
  dakon:     { name: "ダコン湖外縁",     cat: "view", tier: 3, time: "早朝", photo: "images/konron/spots/dakon.webp", shoot: "霧の湖面・火山影・静かな湖畔（遠景のみ）", line: "見えるけれど、踏み込みすぎてはいけない、島の奥に眠る神秘。" },
  lumina:    { name: "ルミナ瀑布",       cat: "view", tier: 2, time: "午前〜昼", photo: "images/konron/spots/lumina.webp", shoot: "密林の緑と滝・飛沫・谷の奥行き", line: "谷を越えた先で、島の水音に出会う。崑崙島随一の秘境。" },
  uroko:     { name: "ウロコトロ温泉郷", cat: "onsen", tier: 1, time: "夕〜夜", photo: "images/konron/spots/uroko.webp", gourmet: "images/konron/spots/uroko_gourmet.webp", shoot: "湖畔の露天風呂・湯けむり・温泉街の灯り", line: "湯けむりと湖畔の静けさにほどける、火山島のご褒美時間。" },
  kibishis:  { name: "キビシス崖線",     cat: "view", tier: 2, time: "昼〜午後", photo: "images/konron/spots/kibishis.webp", shoot: "海へ落ちる崖・風の展望台・翼竜の遠い影", line: "空が近い。ここは翼のための場所。息を呑むスケール。" },
  sena:      { name: "サナ湾／セナ浜",   cat: "view", tier: 2, time: "昼", photo: "images/konron/spots/sena.webp", gourmet: "images/konron/spots/sena_gourmet.webp", shoot: "白砂とラグーン・ミストラソーダ・ファイヤマンゴーアイス", line: "白砂と青い海、旅気分が一気に高まる開放的ビーチ。" },
  bangara:   { name: "バンガラ溶岩海岸", cat: "view", tier: 2, time: "夕方", photo: "images/konron/spots/bangara.webp", shoot: "黒い溶岩と白波・遊歩道・アニキ岩礁遠景", line: "黒い溶岩と荒波がぶつかる、野性味むき出しの絶景海岸。" },
  hoshiuo:   { name: "エサナ入江／ホシウオ村", cat: "port", tier: 2, time: "朝", photo: "images/konron/spots/hoshiuo.webp", shoot: "小舟・干物・魚箱・竜餌用の魚", line: "観光地の奥に、島の暮らしがある。素朴な漁村。" },
  // ── 奥地・霧の彼方（聖典：簡単に入れない神秘＝終盤解放のteaser・遠景のみ・出しすぎない） ──
  dadake:    { name: "ダダケ村",     cat: "okuchi", tier: 3, time: "—", shoot: "段々畑と古い竜小屋・無口な村人（遠景）", line: "市街と火山のあいだ、霧に隠れた古い村。地図には載るが、道はすぐ霧に消える。" },
  susufuka:  { name: "スス深回廊",   cat: "okuchi", tier: 3, time: "—", shoot: "黒い岩の回廊・苔と燐光（遠景）", line: "火山の体内へ続く黒い回廊。奥から熱と、低い唸りが届く。踏み込む者は少ない。" },
  rondo:     { name: "ロンド元宮",   cat: "okuchi", tier: 3, time: "—", shoot: "沈んだ盆地の祭祀場跡・霧の参道（遠景）", line: "カルデラの底、ダコン湖のほとりに眠る最初の宮。竜と人が契りを交わした場所。" },
  gwaruga:   { name: "グワルガ北岸", cat: "okuchi", tier: 3, time: "—", shoot: "道なき荒岩海岸・砕ける波（遠景）", line: "島の北。道は無い。荒い岩と波だけが、人を寄せつけず在りつづける。" },
  kyokai:    { name: "饗会の影",     cat: "okuchi", tier: 3, time: "—", shoot: "—", line: "島の裏でだけ囁かれる名。表の崑崙からは、その気配が時おり霧に混じるばかり。" },
  // ── 聖典37の追加施設（全施設網羅・順次拡張中／景色＋グルメの2枚体制） ──
  hotel:     { name: "ミストラ・ベイフロント／夕凪ホテル通り", cat: "stay", tier: 1, time: "夕〜夜", photo: "images/konron/spots/hotel.webp", shoot: "湾岸ホテル群・夕日デッキ・海沿いカフェ・観光船", line: "旅の余韻はここで。夕日と湾を望む、崑崙島のリゾートの顔。" },
  admin:     { name: "右翼通り・行政街", cat: "civic", tier: 1, time: "昼", photo: "images/konron/spots/admin.webp", shoot: "崑崙自治庁・公営聖龍レース局・立て直し窓口・救護病院", line: "島を回す“右の翼”。自治庁と公営レース局、そして負けても立ち直れる窓口が並ぶ。" },
  mango:     { name: "ファイヤマンゴー火山果樹園", cat: "food", tier: 2, time: "昼", photo: "images/konron/spots/mango_orchard.webp", gourmet: "images/konron/spots/mango_gourmet.webp", shoot: "火山土の果樹園・真っ赤なファイヤマンゴー・収穫籠", line: "南岸内陸の火山土で育つ、燃えるように甘い島の名産。崑崙グルメの源。" },
  // ── 市街地の新スポット（都会型リゾートの作りこみ・順次拡張／写る人物はシルエットで“場所が主役”） ──
  lounge:    { name: "ドラゴンベル・ラウンジ", cat: "food", tier: 2, time: "夜", photo: "images/konron/spots/lounge.webp", gourmet: "images/konron/spots/lounge_gourmet.webp", shoot: "屋上バー・湾の夜景・火山の灯り・サインドリンク", line: "レース前夜の高揚も、勝った夜の祝杯も。湾を見下ろす、島いちばん洒落た屋上ラウンジ。" },
  yosou:     { name: "予想屋小路", cat: "race", tier: 1, time: "レース前", photo: "images/konron/spots/yosou.webp", shoot: "ネオンのオッズ板・予想屋の屋台・出走表・推し竜ポスター", line: "勝負の前に、ひと相談。ネオンと熱気が渦巻く、予想屋たちの小路。" },
  cafe:      { name: "ミストラ・テラスカフェ", cat: "food", tier: 1, time: "昼", photo: "images/konron/spots/cafe.webp", gourmet: "images/konron/spots/cafe_gourmet.webp", shoot: "海辺のテラス席・デザイナースイーツ・ラテアート・ターコイズの湾", line: "ターコイズの湾を眺めながらの一杯。最新リゾートの洗練が、いちばん香る場所。" },
  patisserie:{ name: "ミストラ・パティスリー", cat: "food", tier: 2, time: "昼〜夕", photo: "images/konron/spots/patisserie.webp", gourmet: "images/konron/spots/patisserie_gourmet.webp", shoot: "宝石みたいなケーキの陳列・大理石とブラス・南国の花", line: "ガラスケースに並ぶ、宝石のようなスイーツ。海を望む、島いちばん上品な甘い時間。" },
  gelato:    { name: "ファイヤマンゴー・ジェラテリア", cat: "food", tier: 1, time: "昼", photo: "images/konron/spots/gelato.webp", gourmet: "images/konron/spots/gelato_gourmet.webp", shoot: "色とりどりのジェラート・ワッフルコーン・テラゾーの床", line: "ファイヤマンゴーにパッションフルーツ。火山島の太陽を、ひとさじの冷たさで。" },
  rooftoppool:{ name: "スカイ・インフィニティプール", cat: "stay", tier: 2, time: "夕", photo: "images/konron/spots/rooftoppool.webp", shoot: "湾と一体化する縁なしプール・カバナ・夕陽・火山", line: "水面の先に、湾と火山。空に溶けるような、最新リゾートの特等席。" },
  // ── 第1波：フレーバー由来の店＋名所（時々“魔法ファンタジー＆亜人文化”を実写で） ──
  lavasteak: { name: "溶岩焼きステーキ・竜窯", cat: "food", tier: 2, time: "夜", photo: "images/konron/spots/lavasteak.webp", gourmet: "images/konron/spots/lavasteak_gourmet.webp", shoot: "真っ赤な溶岩石グリル・竜のかまど・島の岩塩・竜人の親方", line: "火山島の本気。溶岩石で一気に焼くステーキは、竜人の親方の十八番。" },
  kissaten:  { name: "湾岸レトロ喫茶 みすと", cat: "food", tier: 1, time: "昼〜夕", photo: "images/konron/spots/kissaten.webp", gourmet: "images/konron/spots/kissaten_gourmet.webp", shoot: "瓶詰めかためプリン・クリームソーダ・オムライス・海の見える窓", line: "時間がとろりと止まる、海辺の古い喫茶。瓶プリンとクリームソーダで、ひと休み。" },
  backbistro:{ name: "看板のない路地裏ビストロ", cat: "food", tier: 2, time: "夜", photo: "images/konron/spots/backbistro.webp", gourmet: "images/konron/spots/backbistro_gourmet.webp", shoot: "灯りひとつの無銘の扉・蔦と石畳・小さな魔法文字・塩パスタ", line: "看板はない。扉の在処を知るのは、常連だけ。塩パスタが、ここの合言葉。" },
  ryoshimeshi:{ name: "漁師町のまかない食堂", cat: "food", tier: 2, time: "昼", photo: "images/konron/spots/ryoshimeshi.webp", gourmet: "images/konron/spots/ryoshimeshi_gourmet.webp", shoot: "大鍋のパエリア・漁網と浮き玉・獣人の漁師たち", line: "獣人の漁師が、獲れたてを大鍋へ。観光地図にない、いちばん旨い席。" },
  hoshimi:   { name: "星見の展望台", cat: "view", tier: 3, time: "夜", photo: "images/konron/spots/hoshimi.webp", shoot: "満天の星・漂う精霊光・崖上のデッキ・遠い火山の灯り", line: "星と、揺れる精霊の光。崖の上のこの場所には、ときどき“天井”の気配がする。" },
  // ── 第2波：賑わいの店＋名所（場外/縁日/漁港バル/渋茶/夜市） ──
  jogai:     { name: "場外グルメ横丁", cat: "food", tier: 1, time: "夜", photo: "images/konron/spots/jogai.webp", gourmet: "images/konron/spots/jogai_gourmet.webp", shoot: "ドラゴンオッズ板・ラーメン屋台・散った的中券・獣人の客", line: "勝っても負けても、レース帰りはここ。湯気と提灯と、夜の屋台の灯り。" },
  ennichi:   { name: "縁日・屋台広場", cat: "food", tier: 1, time: "夕〜夜", photo: "images/konron/spots/ennichi.webp", gourmet: "images/konron/spots/ennichi_gourmet.webp", shoot: "たこ焼き/綿あめ/イカ焼き・宙に浮かぶ祭り提灯・浴衣の亜人たち", line: "火山を背に、灯りが宙を舞う。獣人も人も浴衣で繰り出す、島の縁日。" },
  quaybar:   { name: "船着き場のバル", cat: "food", tier: 2, time: "夕", photo: "images/konron/spots/quaybar.webp", gourmet: "images/konron/spots/quaybar_gourmet.webp", shoot: "樽テーブル・アヒージョの鉄鍋・夕陽と漁船・逆光の常連", line: "潮風と、逆光のシルエット。獲れたてをつまみに、漁師町の夕暮れで一杯。" },
  oyakata:   { name: "親方の渋茶処", cat: "food", tier: 1, time: "昼", photo: "images/konron/spots/oyakata.webp", gourmet: "images/konron/spots/oyakata_gourmet.webp", shoot: "欠け湯呑みの渋茶・出走メモ・竜の旗・古い親方", line: "ぶっきらぼうな渋茶が一杯。竜を読む老親方の、路地裏の止まり木。" },
  furununo:  { name: "夜市の古布屋", cat: "shop", tier: 2, time: "夜", photo: "images/konron/spots/furununo.webp", shoot: "藍染の古布・竜の祭祀布・お面・狐の店主", line: "灯りに浮かぶ古布の山。ほのかに光る祭祀布は、夜市のいちばん奥に眠る。" },
  // ── 第4波：要設計枠の新スポット（フレーバー/聖典由来・時々ファンタジー＆亜人） ──
  left_wing: { name: "左翼・大学研究街", cat: "civic", tier: 2, time: "昼", photo: "images/konron/spots/left_wing.webp", shoot: "観光経済大学・Mizu研究室・オッズ解析の天文台・椰子並木", line: "大翼通りの“左の翼”。観光経済大学とオッズ解析が、勝負の裏側を支える頭脳街。" },
  yokukatown:{ name: "翼下タウン", cat: "port", tier: 1, time: "夕", photo: "images/konron/spots/yokukatown.webp", shoot: "レース場直下の新興市場街・建設中の櫓・露店", line: "レース場の足下に湧いた、活気あふれる新興の街。今がいちばん面白い。" },
  ushiome_dora:{ name: "潮目ドーラ", cat: "view", tier: 2, time: "早朝", photo: "images/konron/spots/ushiome_dora.webp", shoot: "ミストラ湾口の濃霧・霧の主の気配・入港待ちの舟", line: "湾の入口に居つく霧の主。晴れる一瞬を待って、船は港へ滑り込む。" },
  lodge:     { name: "山小屋のまかない", cat: "food", tier: 2, time: "昼", photo: "images/konron/spots/lodge.webp", gourmet: "images/konron/spots/lodge_gourmet.webp", shoot: "高地の山小屋・干したきのこ・谷と滝の眺め・きのこリゾット", line: "雨の日ほど、きのこは香る。谷を見下ろす山小屋の、滋味深いまかない。" },
  wagashi:   { name: "島の和菓子屋", cat: "food", tier: 2, time: "昼〜夕", photo: "images/konron/spots/wagashi.webp", gourmet: "images/konron/spots/wagashi_gourmet.webp", shoot: "ガラスケースの島和菓子・カステラ・福の暖簾・南国の花", line: "南国の陽に、和の甘み。底にザラメを残す長崎カステラが、ここの看板。" },
  amazake_chaya:{ name: "甘酒だんご茶屋", cat: "food", tier: 1, time: "レース前", photo: "images/konron/spots/amazake_chaya.webp", gourmet: "images/konron/spots/amazake_chaya_gourmet.webp", shoot: "番傘と提灯・三色だんごの炭火・甘酒・“必勝”の絵馬", line: "勝負の前に、甘酒で一服。三色だんごのゲン担ぎは、この島の必勝祈願。" },
  backlot:   { name: "資材置き場・マスコットの隅", cat: "oshi", tier: 2, time: "—", photo: "images/konron/spots/backlot.webp", shoot: "レース場裏の木箱とブルーシート・雨上がりの水たまり・小さな寝床", line: "レース場の裏手、木箱の陰。島のマスコットが、ちいさく震えていた場所。" }
};

// 【エリア】＝公式図の位置に“よく離して”配置（mx,my＝画像%）。重なり/タップ不能を解消。
const KONRON_AREAS = [
  { id: "city",    name: "港町・市街",   ic: "🏙️", color: "#5aa6d6", mx: 15, my: 46, spots: ["mistra", "kirimina", "market", "ohzuba", "hotel", "admin", "mall", "arcade", "donryu", "kachimeshi", "makemeshi", "lounge", "yosou", "cafe", "patisserie", "gelato", "rooftoppool", "lavasteak", "kissaten", "backbistro", "oyakata", "furununo", "left_wing", "ushiome_dora", "wagashi"] },
  { id: "falls",   name: "ルミナ瀑布",   ic: "🏞️", color: "#5cb35e", mx: 30, my: 22, spots: ["lumina", "lodge"] },
  { id: "race",    name: "聖龍レース場", ic: "🏁", color: "#e2604a", mx: 33, my: 60, spots: ["racecourse", "tanryu", "oshigoods", "jogai", "ennichi", "yokukatown", "amazake_chaya", "backlot"] },
  { id: "sanctum", name: "竜舎林・ダコン湖", ic: "🐉", color: "#b069c8", mx: 46, my: 42, spots: ["ryusha", "dakon"] },
  { id: "onsen",   name: "ウロコトロ温泉郷", ic: "♨️", color: "#36a892", mx: 46, my: 63, spots: ["uroko"] },
  { id: "cliff",   name: "キビシス崖線", ic: "🪨", color: "#9aa05a", mx: 77, my: 33, spots: ["kibishis", "hoshimi"] },
  { id: "beach",   name: "南岸ビーチ",   ic: "🏖️", color: "#e0b84a", mx: 27, my: 81, spots: ["sena", "bangara", "mango"] },
  { id: "fishing", name: "ホシウオ村",   ic: "🎣", color: "#e08a3a", mx: 60, my: 72, spots: ["hoshiuo", "ryoshimeshi", "quaybar"] },
  { id: "okuchi",  name: "奥地・霧の彼方", ic: "🌫️", color: "#8a7bb0", mx: 61, my: 27, spots: ["dadake", "susufuka", "rondo", "gwaruga", "kyokai"] }
];

function konronMapUnlocked() { return true; }
function _kmTotal() { return (state.player && state.player.totalAssets) || 0; }
function _kmSpotOpen(s) { return _kmTotal() >= (KM_TIER_AT[(s && s.tier) || 0] || 0); }
function _kmTierLabel(t) { return ["序盤", "中盤", "後半", "終盤"][t] || ""; }

// ②「いまの崑崙島」＝時刻(実時計)・天候(日替わり・決定的)・賑わい。表示専用の空気演出。
function _kmIslandNow() {
  var d = new Date(), h = d.getHours();
  var slot = (h < 5)  ? { k: "未明",   ic: "🌌", nigiwai: "奥地の竜だけが目覚める、静かな刻。" }
           : (h < 10) ? { k: "朝",     ic: "🌅", nigiwai: "霧港に船が入り、市場が荷をひらく頃。" }
           : (h < 15) ? { k: "昼",     ic: "☀️", nigiwai: "レース場がいちばん沸く、勝負の時間。" }
           : (h < 18) ? { k: "夕暮れ", ic: "🌇", nigiwai: "勝ち負けの差が、灯りはじめる頃。" }
           : (h < 22) ? { k: "宵",     ic: "🏮", nigiwai: "霧待ち市場の湯気と提灯が主役の刻。" }
           :            { k: "夜",     ic: "🌙", nigiwai: "温泉郷の灯りだけが、湖面に揺れる。" };
  var wx = ["快晴", "晴れときどき霧", "霧ふかし", "通り雨のち晴れ", "薄曇り", "夕焼け雲", "海風つよし"];
  var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return { k: slot.k, ic: slot.ic, weather: wx[doy % wx.length], nigiwai: slot.nigiwai };
}

let _kmArea = null;   // 選択中のエリアid
let _kmSpot = null;   // 選択中のスポットid

// ====== 観光（トラベル誌風デザイン：australia.com を参照）======================
// 明るい編集デザイン：全景ヒーロー＋明朝の大見出し＋金のアクセント＋角丸の写真カード
//   ＋カテゴリのタブ＋横スクロール。地図は暗いインセットの「地図モジュール」として同居。
//   .kt-* は app(.kt-page) にスコープした明色テーマ。表示専用（着順/オッズ/配当に非干渉）。
let _ktCat = "all";   // スポットのカテゴリタブ
const KT_FEATURED = [ { id: "market", k: "夜市を、食べ歩く" }, { id: "sena", k: "白砂のビーチへ" }, { id: "mall", k: "都会のリゾートで買う" } ];

function _ktImg(s) { return (s && (s.photo || s.gourmet)) || ""; }
function _ktSectionHead(title, sub) { return el("div", "kt-head", `<h2 class="kt-h2">${title}</h2>` + (sub ? `<p class="kt-sub">${sub}</p>` : "")); }

// スポット写真カード（角丸・写真・明朝の名前を下に重ねる）。タップで鑑賞ビューア。未解放は鍵。
function _ktSpotCard(id, label, force) {
  const s = KONRON_SPOTS[id]; if (!s) return null;
  const open = (force || _kmSpotOpen(s)), c = KM_CATS[s.cat] || KM_CATS.port, img = _ktImg(s);
  const card = el("button", "kt-card" + (open && img ? "" : " kt-card--lock"));
  if (open && img) {
    card.style.backgroundImage = `url('${img}')`;
    card.innerHTML = `<span class="kt-card-cat">${c.ic} ${c.name}</span><span class="kt-card-nm">${label || s.name}</span>`;
    card.onclick = () => _kmOpenPhoto(id, s.photo ? "photo" : "gourmet");
  } else {
    card.innerHTML = `<span class="kt-card-q">🔒</span><span class="kt-card-nm">${s.name}</span><span class="kt-card-cat">${_kmTierLabel(s.tier)}で解放</span>`;
  }
  return card;
}

// カテゴリのレール（横スクロール）を描き直す
function _ktRenderRail() {
  const rail = document.getElementById("kt-rail"); if (!rail) return;
  rail.innerHTML = "";
  Object.keys(KONRON_SPOTS).forEach(id => {
    const s = KONRON_SPOTS[id];
    if (!_ktImg(s)) return;                              // 写真のあるスポットだけ
    if (_ktCat !== "all" && s.cat !== _ktCat) return;
    const card = _ktSpotCard(id); if (card) rail.appendChild(card);
  });
  if (!rail.children.length) rail.innerHTML = `<div class="kt-rail-empty">このカテゴリの写真は準備中です。</div>`;
}

function renderKonronMap() {
  state.ui.screen = "konron_map";
  _kmArea = null; _kmSpot = null; _ktCat = "all";
  const app = beginScreen();
  app.classList.add("kt-page");

  // ① ヒーロー（全景＋明朝の大見出し＋金のアクセント）
  const hero = el("div", "kt-hero");
  hero.innerHTML =
    `<img class="kt-hero-img" src="images/konron/island_aerial.webp" alt="崑崙島" decoding="async" onerror="this.closest('.kt-hero').classList.add('kt-hero--noimg')">` +
    `<div class="kt-hero-grad"></div>` +
    `<div class="kt-hero-tx"><span class="kt-kicker">📍 KONRON ISLAND ／ 崑崙島</span>` +
      `<h1 class="kt-hero-h">島で、<span class="kt-gold">遊ぶ。</span></h1>` +
      `<p class="kt-hero-sub">霧の火山に抱かれた、竜と亜人のリゾート。<br>あなたの“いちばん”を、写真で見つけよう。</p></div>`;
  app.appendChild(hero);

  // ②「いまの崑崙島」
  const now = _kmIslandNow();
  app.appendChild(el("div", "kt-now", `<span class="kt-now-ic">${now.ic}</span><span class="kt-now-tx"><b>いまの崑崙島 — ${now.k}・${now.weather}</b>${now.nigiwai}</span>`));

  // ③ いちおしの過ごし方（大判カード）
  app.appendChild(_ktSectionHead("いちおしの過ごし方", "まずは、この島の“いちばん”から。"));
  const feat = el("div", "kt-feature");
  KT_FEATURED.forEach(f => { const card = _ktSpotCard(f.id, f.k, true); if (card) feat.appendChild(card); });
  app.appendChild(feat);

  // ④ スポットでさがす（カテゴリのタブ＋横スクロール）
  app.appendChild(_ktSectionHead("スポットでさがす", "カテゴリを選んで、写真でめぐる。"));
  const tabs = el("div", "kt-tabs");
  const cats = ["all"].concat(Object.keys(KM_CATS).filter(k => Object.keys(KONRON_SPOTS).some(id => KONRON_SPOTS[id].cat === k && _ktImg(KONRON_SPOTS[id]))));
  cats.forEach(k => {
    const t = el("button", "kt-tab" + (k === _ktCat ? " kt-tab--on" : ""), (k === "all") ? "✦ すべて" : (KM_CATS[k].ic + " " + KM_CATS[k].name));
    t.onclick = () => { _ktCat = k; tabs.querySelectorAll(".kt-tab").forEach(x => x.classList.remove("kt-tab--on")); t.classList.add("kt-tab--on"); _ktRenderRail(); };
    tabs.appendChild(t);
  });
  app.appendChild(tabs);
  const rail = el("div", "kt-rail"); rail.id = "kt-rail"; app.appendChild(rail);
  _ktRenderRail();

  // ⑤ 地図でさがす（暗いインセットの地図モジュール）
  app.appendChild(_ktSectionHead("地図でさがす", "エリアのピンから、その地区のスポットと施設へ。"));
  const mapmod = el("div", "kt-mapmod");
  const stage = el("div", "km-stage");
  stage.innerHTML = `<img class="km-mapimg" src="images/konron/island_map.webp" alt="崑崙島 観光ジオラマ地図" decoding="async">`;
  KONRON_AREAS.forEach(a => {
    const pin = el("button", "km-areapin", `<span class="km-areapin-dot">${a.ic}</span><span class="km-areapin-lbl">${a.name}</span>`);
    pin.style.left = a.mx + "%"; pin.style.top = a.my + "%"; pin.style.setProperty("--pc", a.color);
    pin.setAttribute("data-area", a.id);
    pin.onclick = () => { _kmArea = a.id; _kmSpot = (a.spots.length === 1) ? a.spots[0] : null; _kmRenderPanel(); _kmMarkSel(stage); };
    stage.appendChild(pin);
  });
  mapmod.appendChild(stage);
  const leg = el("div", "km-legend");
  Object.keys(KM_CATS).forEach(k => { const c = KM_CATS[k]; leg.appendChild(el("span", "km-leg", `<i style="background:${c.color}"></i>${c.ic} ${c.name}`)); });
  mapmod.appendChild(leg);
  const panel = el("div", "km-panel"); panel.id = "km-panel"; mapmod.appendChild(panel);
  app.appendChild(mapmod);
  _kmRenderPanel();

  // ⑥ もっと楽しむ（ガイド／コレクション）＋戻る
  app.appendChild(_ktSectionHead("もっと楽しむ", ""));
  const more = el("div", "kt-more");
  const g = el("button", "kt-more-card", `<span class="kt-more-ic">📖</span><b>崑崙ガイドブック</b><small>島の歴史・文化・食・竜・地理の図鑑</small>`); g.onclick = () => renderKonronGuide();
  const gal = el("button", "kt-more-card", `<span class="kt-more-ic">🖼</span><b>フォトコレクション</b><small>撮った景色＆ご当地グルメを集める</small>`); gal.onclick = () => renderKonronGallery();
  more.appendChild(g); more.appendChild(gal);
  app.appendChild(more);
  app.appendChild(el("div", "kt-note", "※「観光」は表示専用です（レースの着順・オッズ・配当には影響しません）。"));
  const back = el("button", "kt-back", "← ホームへ戻る"); back.onclick = () => renderHome();
  app.appendChild(back);
}

// ④ 崑崙ガイドブック（島の図鑑）：KONRON_GUIDE を分類表示。tier＝総資産で段階解放（未解放は？？？）。表示専用。
function renderKonronGuide() {
  state.ui.screen = "konron_guide";
  const app = beginScreen();
  app.appendChild(el("h2", null, "📖 崑崙ガイドブック"));
  let total = 0, open = 0;
  (typeof KONRON_GUIDE !== "undefined" ? KONRON_GUIDE : []).forEach(c => c.entries.forEach(e => { total++; if (_kmTotal() >= (KM_TIER_AT[e.tier] || 0)) open++; }));
  app.appendChild(el("div", "as-hint2", `崑崙島の歴史・文化・食・竜・地理を集める図鑑。総資産が増えると新しい項目が解放されます（表示専用＝レース結果には影響しません）。<b>${open} / ${total}</b> 解放。`));
  (typeof KONRON_GUIDE !== "undefined" ? KONRON_GUIDE : []).forEach(c => {
    const sec = el("div", "kg-sec");
    let h = `<div class="kg-cat"><span class="kg-cat-ic">${c.ic}</span>${c.cat}</div>`;
    c.entries.forEach(e => {
      const unlocked = _kmTotal() >= (KM_TIER_AT[e.tier] || 0);
      if (unlocked) {
        h += `<div class="kg-entry"><b>${e.title}</b><p>${e.body}</p></div>`;
      } else {
        h += `<div class="kg-entry kg-entry--locked"><b>？？？</b><p>🔒 ${_kmTierLabel(e.tier)}で解放（総資産 ${(KM_TIER_AT[e.tier] || 0).toLocaleString("ja-JP")}）</p></div>`;
      }
    });
    sec.innerHTML = h;
    app.appendChild(sec);
  });
  const actions = el("div", "actions");
  const back = el("button", null, "🏝 観光へ戻る"); back.onclick = () => renderKonronMap();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ⑤ 観光フォト・コレクション（図鑑）：全スポットの景色＋グルメ写真をグリッド表示。
// 解放済(=その場所に行ける)＝写真、未解放＝？。タップで鑑賞ビューア→SNS投稿。表示専用。
function renderKonronGallery() {
  state.ui.screen = "konron_gallery";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🖼 観光フォト・コレクション"));
  const items = [];
  Object.keys(KONRON_SPOTS).forEach(id => {
    const s = KONRON_SPOTS[id]; const open = _kmSpotOpen(s);
    if (s.photo) items.push({ id: id, kind: "photo", label: s.name, src: s.photo, open: open });
    if (s.gourmet) items.push({ id: id, kind: "gourmet", label: s.name + "・グルメ", src: s.gourmet, open: open });
  });
  const total = items.length, got = items.filter(it => it.open).length;
  app.appendChild(el("div", "as-hint2", `崑崙島で撮った景色＆ご当地グルメのコレクション。行ける場所が増えると集まります。タップで鑑賞＆SNS投稿（表示専用＝レース結果には影響しません）。<b>${got} / ${total}</b> 枚 収集。`));
  const grid = el("div", "kgal-grid");
  items.forEach(it => {
    const cell = el("button", "kgal-cell" + (it.open ? "" : " kgal-cell--locked"));
    if (it.open) {
      cell.style.backgroundImage = `url('${it.src}')`;
      if (it.kind === "gourmet") cell.appendChild(el("span", "kgal-badge", "🍽"));
      cell.appendChild(el("span", "kgal-name", it.label));
      cell.setAttribute("data-id", it.id); cell.setAttribute("data-kind", it.kind);
      cell.onclick = () => _kmOpenPhoto(cell.getAttribute("data-id"), cell.getAttribute("data-kind"));
    } else {
      cell.innerHTML = `<span class="kgal-q">？</span>`;
    }
    grid.appendChild(cell);
  });
  app.appendChild(grid);
  const actions = el("div", "actions");
  const back = el("button", null, "🏝 観光へ戻る"); back.onclick = () => renderKonronMap();
  actions.appendChild(back);
  app.appendChild(actions);
}

function _kmMarkSel(stage) {
  stage.querySelectorAll(".km-areapin").forEach(p => {
    p.classList.toggle("km-areapin--sel", p.getAttribute("data-area") === _kmArea);
  });
}

function _kmAreaOf(spotId) { return KONRON_AREAS.find(a => a.spots.indexOf(spotId) >= 0); }

// 拡大マップのバナー：エリアへ“進む”と、本マップ(ジオラマ)を該当エリアにズームして表示。
// bespokeな専用絵 images/konron/area_<id>.webp があれば自動で全面に差し替わる（onerrorでズーム版にフォールバック）。
function _kmZoomBanner(area) {
  if (!area) return "";
  return `<div class="km-zoom" style="background-image:url('images/konron/island_map.webp');background-position:${area.mx}% ${area.my}%">` +
    `<img class="km-zoom-img" src="images/konron/area_${area.id}.webp?v=5" alt="" decoding="async" onload="this.classList.add('on')" onerror="this.remove()">` +
    `<span class="km-zoom-tag">🔍 ${area.name}・拡大マップ</span></div>`;
}

// ── 観光フォト・コレクション：専用写真があれば「タップで鑑賞・SNS投稿」できるバナーに ──
function _kmSpotPhotoBanner(s) {
  return `<button class="km-photo" data-photo="${s.id}">` +
    `<img class="km-photo-img" src="${s.photo}" alt="${s.name}" decoding="async">` +
    `<span class="km-photo-tag">📸 タップで鑑賞・SNS投稿</span></button>`;
}
// フルスクリーンの写真ビューア（タップで拡大トグル＝じっくり鑑賞／SNS投稿／閉じる）。表示専用。
function _kmPhotoOf(s, kind) { return (kind === "gourmet") ? s.gourmet : s.photo; }
function _kmPhotoCap(s, kind) { return (kind === "gourmet") ? ("🍽 " + s.name + "のご当地グルメ") : (s.line || s.name); }
function _kmOpenPhoto(spotId, kind) {
  const s = KONRON_SPOTS[spotId]; const src = s && _kmPhotoOf(s, kind); if (!src) return;
  const ov = el("div", "km-viewer");
  ov.innerHTML =
    `<div class="km-viewer-bd"></div>` +
    `<div class="km-viewer-stage"><img class="km-viewer-img" src="${src}" alt="${s.name}"></div>` +
    `<div class="km-viewer-cap"><b>${s.name}</b><span>${_kmPhotoCap(s, kind)}</span></div>` +
    `<div class="km-viewer-bar">` +
      `<button class="km-vbtn km-vbtn--sns" data-act="sns">📣 SNSに投稿</button>` +
      `<button class="km-vbtn" data-act="x">✕ 閉じる</button></div>`;
  document.body.appendChild(ov);
  const img = ov.querySelector(".km-viewer-img");
  img.onclick = () => img.classList.toggle("km-zoomed");
  const close = () => ov.remove();
  ov.querySelector(".km-viewer-bd").onclick = close;
  ov.querySelector('[data-act="x"]').onclick = close;
  ov.querySelector('[data-act="sns"]').onclick = () => _kmSnsCompose(spotId, kind);
}
// SNS（ぴょこったー）へコメント付きで投稿。sns.js の addMyPost(text,img) を使う＝タイムラインに流れる。
function _kmSnsCompose(spotId, kind) {
  const s = KONRON_SPOTS[spotId]; const src = s && _kmPhotoOf(s, kind); if (!src) return;
  if (typeof addMyPost !== "function") { _kmToast("SNS機能が見つかりません"); return; }
  const def = (kind === "gourmet" ? `${s.name}でこれ食べた😋📸` : `${s.name}で一枚📸 ${s.line || ""}`).trim();
  const cm = el("div", "km-compose");
  cm.innerHTML =
    `<div class="km-compose-bd"></div>` +
    `<div class="km-compose-card">` +
      `<div class="km-compose-h">📣 ぴょこったーに投稿</div>` +
      `<img class="km-compose-thumb" src="${src}" alt="">` +
      `<textarea class="km-compose-ta" maxlength="140" rows="3">${def}</textarea>` +
      `<div class="km-compose-bar"><button class="km-vbtn" data-act="cancel">やめる</button>` +
      `<button class="km-vbtn km-vbtn--sns" data-act="send">投稿する</button></div></div>`;
  document.body.appendChild(cm);
  const close = () => cm.remove();
  cm.querySelector(".km-compose-bd").onclick = close;
  cm.querySelector('[data-act="cancel"]').onclick = close;
  cm.querySelector('[data-act="send"]').onclick = () => {
    const txt = (cm.querySelector(".km-compose-ta").value || "").trim() || def;
    addMyPost(txt, src);
    close();
    _kmToast("ぴょこったーに投稿しました！📣");
  };
}
function _kmToast(msg) {
  const t = el("div", "km-toast", msg); document.body.appendChild(t);
  setTimeout(() => { t.classList.add("km-toast--off"); setTimeout(() => t.remove(), 400); }, 1800);
}

// スポットの“中身”（見どころ／名物／豆知識）。konron_content.js が未読込でも安全に空を返す。
function _kmContentHtml(spotId) {
  var c = (typeof konronContentOf === "function") ? konronContentOf(spotId) : null;
  if (!c) return "";
  var h = '<div class="km-content">';
  if (c.midokoro && c.midokoro.length) {
    h += '<div class="km-sec"><div class="km-sec-h">✦ 見どころ</div>';
    c.midokoro.forEach(function (m) { h += '<div class="km-md">' + m + '</div>'; });
    h += '</div>';
  }
  if (c.meibutsu) {
    h += '<div class="km-meibutsu"><span class="km-mei-tag">名物</span><div class="km-mei-b"><b>' + c.meibutsu.name + '</b>' +
      (c.meibutsu.note ? '<small>' + c.meibutsu.note + '</small>' : '') + '</div></div>';
  }
  if (c.trivia) h += '<div class="km-trivia">💡 <span>' + c.trivia + '</span></div>';
  return h + '</div>';
}

function _kmRenderPanel() {
  const panel = document.getElementById("km-panel"); if (!panel) return;

  // ① スポット詳細（写真カード＋ポータル）
  if (_kmSpot && KONRON_SPOTS[_kmSpot]) {
    const s = KONRON_SPOTS[_kmSpot];
    const c = KM_CATS[s.cat] || KM_CATS.port;
    const area = _kmAreaOf(_kmSpot);
    const open = _kmSpotOpen(s);
    panel.style.setProperty("--kmc", c.color);
    let body = (open && s.photo) ? _kmSpotPhotoBanner(s) : _kmZoomBanner(area);
    if (area && area.spots.length > 1) body += `<button class="km-areaback" data-back="1">← ${area.name}</button>`;
    body += `<div class="km-card-head"><span class="km-card-ic">${c.ic}</span>` +
      `<div class="km-card-id"><b>${s.name}</b><small>${c.name}${s.time && s.time !== "—" ? "・" + s.time : ""}</small></div></div>`;
    if (!open) {
      body += `<div class="km-card-lock">🔒 まだ行けない場所（<b>${_kmTierLabel(s.tier)}</b>で解放）。総資産 ${KM_TIER_AT[s.tier].toLocaleString("ja-JP")} で開放。</div>`;
    } else {
      body += `<div class="km-card-line">${s.line}</div>`;
      if (s.shoot && s.shoot !== "—") body += `<div class="km-card-shoot">📸 撮れるもの：${s.shoot}</div>`;
      body += _kmContentHtml(_kmSpot);   // 見どころ／名物／豆知識（作りこみ）
      if (s.gourmet) body += `<button class="km-gourmet" data-gourmet="${s.id}"><img src="${s.gourmet}" alt="" decoding="async"><span>🍽 ご当地グルメ・タップで鑑賞／投稿</span></button>`;
      if (s.portal && typeof window[s.portal] === "function") {
        const labelMap = { renderMeals: "🍢 食べ歩きへ", renderMall: "🛍️ ショッピングへ", renderRaceSelect: "🏁 レースへ", renderSns: "📣 SNSへ", renderScout: "🐉 竜スカウトへ" };
        body += `<button class="km-go" data-portal="${s.portal}">${labelMap[s.portal] || "▶ ひらく"}</button>`;
      } else {
        body += `<div class="km-card-photo">🏞️ 撮影スポット（眺めて楽しむ名所）</div>`;
      }
    }
    panel.innerHTML = body;
    const bk = panel.querySelector(".km-areaback");
    if (bk) bk.onclick = () => { _kmSpot = null; _kmRenderPanel(); };
    const go = panel.querySelector(".km-go");
    if (go) go.onclick = () => { const fn = window[go.getAttribute("data-portal")]; if (typeof fn === "function") fn(); };
    const ph = panel.querySelector(".km-photo");
    if (ph) ph.onclick = () => _kmOpenPhoto(ph.getAttribute("data-photo"), "photo");
    const gm = panel.querySelector(".km-gourmet");
    if (gm) gm.onclick = () => _kmOpenPhoto(gm.getAttribute("data-gourmet"), "gourmet");
    return;
  }

  // ② エリア（複数スポット）＝スポット一覧チップ
  if (_kmArea) {
    const area = KONRON_AREAS.find(a => a.id === _kmArea);
    if (area) {
      panel.style.setProperty("--kmc", area.color);
      let body = _kmZoomBanner(area) + `<div class="km-area-head"><span class="km-card-ic">${area.ic}</span><b>${area.name}</b><small>タップでスポットへ</small></div><div class="km-chips">`;
      area.spots.forEach(id => {
        const s = KONRON_SPOTS[id]; if (!s) return;
        const c = KM_CATS[s.cat] || KM_CATS.port;
        const open = _kmSpotOpen(s);
        body += `<button class="km-chip${open ? "" : " km-chip--locked"}" data-spot="${id}" style="--cc:${c.color}">` +
          `<span class="km-chip-ic">${open ? c.ic : "🔒"}</span>${s.name}</button>`;
      });
      body += `</div>`;
      panel.innerHTML = body;
      panel.querySelectorAll(".km-chip").forEach(ch => {
        ch.onclick = () => { _kmSpot = ch.getAttribute("data-spot"); _kmRenderPanel(); };
      });
      return;
    }
  }

  // ③ 既定
  panel.innerHTML = `<div class="km-hint">📍 エリアのピンをタップすると、その地区のスポットと施設が見られます。</div>`;
}
