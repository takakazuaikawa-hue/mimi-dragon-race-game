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
  mall:      { name: "崑崙ショッピングモール", cat: "shop", tier: 1, portal: "renderMall", time: "昼〜夜", photo: "images/konron/spots/mall_tropical_atrium.png", gourmet: "images/konron/spots/mall_gourmet.webp", shoot: "熱帯の吹き抜け・生活用品と土産袋・亜人の家族連れ・フードコート", line: "日除けの大屋根の下に、買い物も食事も待ち合わせも集まる。島の暮らしと旅が交わる大型モール。" },
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
  // ── レースの8地域（data_races.js の region と1対1） ──────────────
  // ★レースは8つの地域で行われるのに、島の地図には「中央聖龍レース場」しか
  //   置かれておらず、走った土地を島の上で確かめられなかった。
  //   T0（2026-07-25）：孤児PNGを1枚ずつ検収し、世界観に合う6地域に写真を結線した
  //   （clock/rosso/mist/vento/notte/lapan）。photo を持たない地域は描画側が
  //   (open && s.photo) で分岐してエリア俯瞰図に落ちる＝壊れない。
  //   ★G3-2：rg_lumina と rg_caldera は旧PNGが世界観不一致（明るい光条→暗い霧漁村／
  //     赤い溶岩→寒色地熱農村）で不合格だった。Higgsfieldで撮り直して結線済み
  //     （lumina_course / caldera_course・アートバイブル§0.4準拠＝尖った活火山の峰・山頂湖なし）。
  //   region はレース側の表記そのまま。ここを変えると突き合わせが切れる。
  rg_clock:  { name: "グランドクロック大時計走路", cat: "race", tier: 0, region: "グランドクロック地域", portal: "renderRaceSelect", time: "昼", photo: "images/konron/spots/grandclock.webp",
               shoot: "真鍮の大歯車・時報の鐘・金色に光る直線", line: "島の時を刻む大時計の足元を走る。鐘が鳴ると、観客が一斉に時計を見上げる。" },
  rg_lumina: { name: "ルミナ光条コース", cat: "race", tier: 0, region: "ルミナ地域", portal: "renderRaceSelect", time: "午前", photo: "images/konron/spots/lumina_course.webp",
               shoot: "空色の壁・照り返す白砂・滝から流れる霧", line: "光がよく回る谷あいの走路。影が薄く、竜の翼の色がいちばん綺麗に出る。" },
  rg_rosso:  { name: "リングロッソ闘技走路", cat: "race", tier: 1, region: "リングロッソ地域", portal: "renderRaceSelect", time: "夕", photo: "images/konron/spots/ringrosso.webp",
               shoot: "赤と黒の石壁・すり鉢状の観客席・爪跡の残る柵", line: "声が丸く溜まるすり鉢の底。歓声が倍になって返ってくる、島でいちばん熱い場所。" },
  rg_caldera:{ name: "カルデラ火口周回路", cat: "race", tier: 1, region: "カルデラ地域", portal: "renderRaceSelect", time: "昼", photo: "images/konron/spots/caldera_course.webp",
               shoot: "溶岩の赤い照り返し・黒い砂利・立ちのぼる陽炎", line: "地面が熱を抱えたまま冷めない。下から炙られながら走る、島でもっとも過酷な走路。" },
  rg_mist:   { name: "ミストレイク湖畔走路", cat: "race", tier: 1, region: "ミストレイク地域", portal: "renderRaceSelect", time: "早朝", photo: "images/konron/spots/mistlake.webp",
               shoot: "霧に沈む湖面・縄を引く整備の人・輪郭だけの竜", line: "霧が濃い日は三十歩先も見えない。音だけが先に届く、静かで難しい走路。" },
  rg_vento:  { name: "ヴェント峡谷風洞コース", cat: "race", tier: 2, region: "ヴェント峡谷地域", portal: "renderRaceSelect", time: "午後", photo: "images/konron/spots/vento_gorge.webp",
               shoot: "切り立つ岩壁・吹き上げる風・飛ばされた帽子", line: "上からも下からも風が来る。谷が声を二度返す、翼の扱いを試される走路。" },
  rg_notte:  { name: "ノッテムーンライト夜間走路", cat: "race", tier: 2, region: "ノッテムーンライト地域", portal: "renderRaceSelect", time: "夜", photo: "images/konron/spots/notte_moonlight.webp",
               shoot: "月あかりに浮かぶ白線・落とした照明・青く見える足元", line: "明るくしすぎない決まりがある。月の色に合わせた灯りの下を、影だけが走る。" },
  rg_lapan:  { name: "ラパン祭典特設走路", cat: "race", tier: 2, region: "ラパン祭典地域", portal: "renderRaceSelect", time: "祭りの三日", photo: "images/konron/spots/lapan_festival.webp",
               shoot: "舞う金の紙吹雪・だらんとした旗・掃除の人の背中", line: "年に三日だけ組まれる特設の走路。金の紙が舞い、視界がまるごときらきらする。" },

  // ── 奥地・霧の彼方（聖典：簡単に入れない神秘＝終盤解放のteaser・遠景のみ・出しすぎない） ──
  dadake:    { name: "ダダケ村",     cat: "okuchi", tier: 3, time: "—", photo: "images/konron/spots/dadake.webp", shoot: "段々畑と古い竜小屋・無口な村人（遠景）", line: "市街と火山のあいだ、霧に隠れた古い村。地図には載るが、道はすぐ霧に消える。" },
  susufuka:  { name: "スス深回廊",   cat: "okuchi", tier: 3, time: "—", photo: "images/konron/spots/susufuka.webp", shoot: "黒い岩の回廊・苔と燐光（遠景）", line: "火山の体内へ続く黒い回廊。奥から熱と、低い唸りが届く。踏み込む者は少ない。" },
  rondo:     { name: "ロンド元宮",   cat: "okuchi", tier: 3, time: "—", photo: "images/konron/spots/rondo.webp", shoot: "沈んだ盆地の祭祀場跡・霧の参道（遠景）", line: "カルデラの底、ダコン湖のほとりに眠る最初の宮。竜と人が契りを交わした場所。" },
  gwaruga:   { name: "グワルガ北岸", cat: "okuchi", tier: 3, time: "—", photo: "images/konron/spots/gwaruga.webp", shoot: "道なき荒岩海岸・砕ける波（遠景）", line: "島の北。道は無い。荒い岩と波だけが、人を寄せつけず在りつづける。" },
  kyokai:    { name: "饗会の影",     cat: "okuchi", tier: 3, time: "—", photo: "images/konron/spots/kyokai.webp", shoot: "表の島と霧の奥を分ける石門・古い灯り（遠景）", line: "島の裏でだけ囁かれる名。表の崑崙からは、その気配が時おり霧に混じるばかり。" },
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
  // ★shoot は固有名を持たない中立の文言が正（未登場の顧問名を風景説明で出さないため）。出会っていれば _kmShootOf が名前入りに差し替える。
  left_wing: { name: "左翼・大学研究街", cat: "civic", tier: 2, time: "昼", photo: "images/konron/spots/left_wing.webp", shoot: "観光経済大学・オッズ解析の研究室・天文台・椰子並木", line: "大翼通りの“左の翼”。観光経済大学とオッズ解析が、勝負の裏側を支える頭脳街。" },
  yokukatown:{ name: "翼下タウン", cat: "port", tier: 1, time: "夕", photo: "images/konron/spots/yokukatown.webp", shoot: "レース場直下の新興市場街・建設中の櫓・露店", line: "レース場の足下に湧いた、活気あふれる新興の街。今がいちばん面白い。" },
  ushiome_dora:{ name: "潮目ドーラ", cat: "view", tier: 2, time: "早朝", photo: "images/konron/spots/ushiome_dora.webp", shoot: "ミストラ湾口の濃霧・霧の主の気配・入港待ちの舟", line: "湾の入口に居つく霧の主。晴れる一瞬を待って、船は港へ滑り込む。" },
  lodge:     { name: "山小屋のまかない", cat: "food", tier: 2, time: "昼", photo: "images/konron/spots/lodge.webp", gourmet: "images/konron/spots/lodge_gourmet.webp", shoot: "高地の山小屋・干したきのこ・谷と滝の眺め・きのこリゾット", line: "雨の日ほど、きのこは香る。谷を見下ろす山小屋の、滋味深いまかない。" },
  wagashi:   { name: "島の和菓子屋", cat: "food", tier: 2, time: "昼〜夕", photo: "images/konron/spots/wagashi.webp", gourmet: "images/konron/spots/wagashi_gourmet.webp", shoot: "ガラスケースの島和菓子・カステラ・福の暖簾・南国の花", line: "南国の陽に、和の甘み。底にザラメを残す長崎カステラが、ここの看板。" },
  amazake_chaya:{ name: "甘酒だんご茶屋", cat: "food", tier: 1, time: "レース前", photo: "images/konron/spots/amazake_chaya.webp", gourmet: "images/konron/spots/amazake_chaya_gourmet.webp", shoot: "番傘と提灯・三色だんごの炭火・甘酒・“必勝”の絵馬", line: "勝負の前に、甘酒で一服。三色だんごのゲン担ぎは、この島の必勝祈願。" },
  backlot:   { name: "資材置き場・マスコットの隅", cat: "oshi", tier: 2, time: "—", photo: "images/konron/spots/backlot.webp", shoot: "レース場裏の木箱とブルーシート・雨上がりの水たまり・小さな寝床", line: "レース場の裏手、木箱の陰。島のマスコットが、ちいさく震えていた場所。" },
  // ── ★T3 隠しスポット（写真なし＝奥地と同型でエリア俯瞰にフォールバック・KM_HIDDEN の条件で出現）──
  //    告知しない＝気づいた人だけの発見（GAME_EXPERIENCE_DESIGN §2「余白3割」）。表示専用。
  ura_bistro:{ name: "路地裏ビストロの隠し席", cat: "food", tier: 1, time: "夜", shoot: "厨房の湯気・常連しか知らない木の扉", line: "パスタを食べた客だけが教えてもらえる、扉の奥のもう一席。" },
  neko_tsuji:{ name: "猫の辻",               cat: "view", tier: 1, time: "夕暮れ", shoot: "塀の上の猫たち・夕陽の路地", line: "食べ歩きの匂いをまとった人にだけ、猫たちが集まってくる辻。" },
  hoshikuzu: { name: "星くずの丘",           cat: "view", tier: 2, time: "夜", shoot: "光る砂・島の灯りを見下ろす丘", line: "傑作を三枚撮った写真家だけが、地元の子に教えてもらえる丘。" }
};
// ★各スポットの値オブジェクトに自分のキーを id として持たせる（脆さの解消）。
//   以前、値が自分の id を知らず data-photo="undefined" で写真ビューアが無反応になったバグがあり、
//   呼び出し側で id を明示的に渡し回して対処していた。ここで一度だけ注入しておけば、
//   s.id がいつでも使える＝渡し忘れで壊れる経路が構造的に消える（表示専用・挙動不変）。
Object.keys(KONRON_SPOTS).forEach(id => { KONRON_SPOTS[id].id = id; });

// 【エリア】＝公式図の位置に“よく離して”配置（mx,my＝画像%）。重なり/タップ不能を解消。
const KONRON_AREAS = [
  { id: "city",    name: "港町・市街",   ic: "🏙️", color: "#5aa6d6", mx: 15, my: 42, spots: ["mistra", "kirimina", "market", "ohzuba", "hotel", "admin", "mall", "arcade", "donryu", "kachimeshi", "makemeshi", "lounge", "yosou", "cafe", "patisserie", "gelato", "rooftoppool", "lavasteak", "kissaten", "backbistro", "oyakata", "furununo", "left_wing", "ushiome_dora", "wagashi", "ura_bistro", "neko_tsuji"] },
  { id: "falls",   name: "ルミナ瀑布",   ic: "🏞️", color: "#5cb35e", mx: 31, my: 31, spots: ["lumina", "lodge"] },
  { id: "race",    name: "聖龍レース場", ic: "🏁", color: "#e2604a", mx: 36, my: 52, spots: ["racecourse", "tanryu", "rg_clock", "rg_lumina", "rg_rosso", "rg_caldera", "rg_mist", "rg_vento", "rg_notte", "rg_lapan", "oshigoods", "jogai", "ennichi", "yokukatown", "amazake_chaya", "backlot"] },
  { id: "sanctum", name: "竜舎林・ダコン湖", ic: "🐉", color: "#b069c8", mx: 50, my: 39, spots: ["ryusha", "dakon"] },
  { id: "onsen",   name: "ウロコトロ温泉郷", ic: "♨️", color: "#36a892", mx: 57, my: 60, spots: ["uroko"] },
  { id: "cliff",   name: "キビシス崖線", ic: "🪨", color: "#9aa05a", mx: 86, my: 46, spots: ["kibishis", "hoshimi", "hoshikuzu"] },
  { id: "beach",   name: "南岸ビーチ",   ic: "🏖️", color: "#e0b84a", mx: 27, my: 78, spots: ["sena", "bangara", "mango"] },
  { id: "fishing", name: "ホシウオ村",   ic: "🎣", color: "#e08a3a", mx: 82, my: 72, spots: ["hoshiuo", "ryoshimeshi", "quaybar"] },
  { id: "okuchi",  name: "奥地・霧の彼方", ic: "🌫️", color: "#8a7bb0", mx: 72, my: 20, spots: ["dadake", "susufuka", "rondo", "gwaruga", "kyokai"] }
];

// ★観光は「初勝利」で解放（進行組み込み・ユーザー確定 2026-07・docs/GAME_FLOW_REDESIGN.md §1）。
//   序盤3目標（出走→的中→勝利）の締めのご褒美として島が開く。ロックは条件明示（ホームの🔒枠）。
function konronMapUnlocked() { return ((state.player && state.player.wins) || 0) >= 1; }
function _kmTotal() { return assetsPeak(state); }   // ★解放判定＝到達最高
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
  // 旧「このカテゴリの写真は準備中です」は到達不能デッドコードだった（カテゴリタブは
  // 写真ありカテゴリだけ生成される＝下の cats 生成を参照。all も必ず写真ありを含む）ので撤去。
}

function renderKonronMap() {
  if (!konronMapUnlocked()) {   // 解放前は入口で案内（?go=直行や旧導線でも迷子にしない）
    renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("🏝️ おでかけ",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて勝つ</u>と、島のみんなが崑崙島を案内してくれます。</small></div></div>`);
    return;
  }
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

  // H5: 日替わりフォトミッション「今日の一枚」（表示専用・タップで対象スポットへ）
  try {
    const _pmId = _kmPhotoMission();
    if (_pmId && KONRON_SPOTS[_pmId]) {
      const _pmDone2 = _kmPmDone(_pmId);
      const _pmArea = _kmAreaOf(_pmId);
      const strip = el("button", "km-pm" + (_pmDone2 ? " done" : ""));
      strip.innerHTML = `<span class="km-pm-ic">${_pmDone2 ? "✅" : "📸"}</span>` +
        `<span class="km-pm-tx"><b>今日の一枚：${KONRON_SPOTS[_pmId].name}</b>` +
        `<small>${_pmDone2 ? "撮影ずみ！ また明日、別の一枚。" : (_pmArea ? _pmArea.ic + " " + _pmArea.name + "エリア ・ 見に行くと達成" : "見に行くと達成")}</small></span>` +
        `<span class="km-pm-go">${_pmDone2 ? "" : "▸"}</span>`;
      strip.onclick = () => {
        _kmArea = _pmArea ? _pmArea.id : null; _kmSpot = _pmId; _kmRenderPanel();
        const p = document.getElementById("km-panel");
        if (p) { try { p.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }
      };
      app.appendChild(strip);
    }
  } catch (e) {}

  // ★旅ノートのサマリを上へ（ユーザー決裁・2026-07-31）：中身が「あと◯エリアで制覇」「タップで
  //   そのエリアへ跳ぶ」＝**次どこ行くかを決める道具**なので、読み物側（紀行）ではなくここに残す。
  //   ただし「もっと楽しむ」の3枚目では埋もれていたので、地図の直前に1行の進み具合として出す
  //   ＝おでかけタブが『今日どこ行く？』の画面になる。タップで旅ノート本体へ。
  try {
    const _tt = _kmTravelTitle();
    if (_tt.total > 0) {
      const _pc = Math.round(_tt.doneN / _tt.total * 100);
      const tnr = el("button", "km-tnrow" + (_tt.got ? " done" : ""));
      tnr.innerHTML = `<span class="km-tnrow-ic">📔</span>` +
        `<span class="km-tnrow-tx"><b>旅ノート — エリア制覇 ${_tt.doneN} / ${_tt.total}</b>` +
        `<small>${_tt.got ? "🏅 称号「崑崙路の写真家」を獲得ずみ。" : `あと ${_tt.total - _tt.doneN} エリアで称号「崑崙路の写真家」`}</small></span>` +
        `<span class="km-tnrow-bar"><i style="width:${_pc}%"></i></span><span class="km-tnrow-go">▸</span>`;
      tnr.onclick = () => renderKonronTravelNote();
      app.appendChild(tnr);
    }
  } catch (e) {}

  // ⑤ 地図でさがす（暗いインセットの地図モジュール）
  app.appendChild(_ktSectionHead("地図でさがす", "エリアのピンから、その地区のスポットと施設へ。"));
  const mapmod = el("div", "kt-mapmod");
  const stage = el("div", "km-stage");
  stage.innerHTML = `<img class="km-mapimg" src="images/konron/island_map.webp?v=20260727a" alt="崑崙島 観光ジオラマ地図" decoding="async">`;
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
  const gal = el("button", "kt-more-card", `<span class="kt-more-ic">🖼</span><b>フォトコレクション</b><small>撮った景色＆ご当地グルメを集める</small>`); gal.onclick = () => renderKonronGallery();
  // ★T3 旅ノート：エリアごとの記録を1ページに束ねる（スタンプ／傑作／実食／制覇）。上部にサマリ行も出している。
  const tn = el("button", "kt-more-card", `<span class="kt-more-ic">📔</span><b>旅ノート</b><small>エリアごとの記録・制覇度・称号</small>`);
  tn.onclick = () => renderKonronTravelNote();
  more.appendChild(gal); more.appendChild(tn);
  // ★歩けるマップは**移動手段ではなく散歩**（ユーザー決裁）。ピンの上ではなく「もっと楽しむ」に、
  //   急ぐ人が踏まない位置で置く。用が無くても、ただ歩きたい人のためのもの。
  if (typeof renderKonronWalk === "function" && typeof Scene !== "undefined") {
    const walk = el("button", "kt-more-card",
      `<span class="kt-more-ic">🚶</span><b>島を散歩する</b><small>用は無くても。立ち止まると、気づくものがある。</small>`);
    walk.onclick = () => renderKonronWalk();
    more.appendChild(walk);
  }
  app.appendChild(more);
  // ★ガイドブックは紀行へ引っ越した（IA統合）。ここには行き先の1行だけを残す＝読み物は紀行に集約。
  const gline = el("button", "kt-toKiko", `📖 島の読み物（歴史・文化・食・竜・地理）は <b>紀行の #島さんぽ</b> に集めました ▸`);
  gline.onclick = () => { state.ui._kikoBack = true; renderKonronGuide(); };
  app.appendChild(gline);
  app.appendChild(el("div", "kt-note", "※「おでかけ」は表示専用です（レースの着順・オッズ・配当には影響しません）。"));
  // M2：島の一日ループの出口（観光→次のレース／SNS未読）。docs/GAME_EXPERIENCE_DESIGN §3。
  try { const _nx = (typeof nextSuggestRow === "function") && nextSuggestRow("konron"); if (_nx) app.appendChild(_nx); } catch (e) {}
  const back = el("button", "kt-back", "← ホームへ戻る"); back.onclick = () => renderHome();
  app.appendChild(back);
}

// ④ 崑崙ガイドブック（島の図鑑）：KONRON_GUIDE を分類表示。tier＝総資産で段階解放（未解放は？？？）。表示専用。
function renderKonronGuide() {
  if (!konronMapUnlocked()) {   // Ⓑ 親konron_mapと同じ条件でゲート（島がロック中はガイドも閉じる）。
    renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("🏝️ おでかけ",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて勝つ</u>と、崑崙島を巡れるようになります。</small></div></div>`);
    return;
  }
  // ★IA統合（ユーザー決裁・2026-07-31）：「崑崙ガイドブックのページの情報は、紀行と統合した方が
  //   いいのでは？」→ **紀行の記事棚に溶かす**を採用。
  //   理由＝この画面は歴史/文化/食/竜/地理の“読み物”で、性質が完全に📖紀行（＝集めた記録を読む家）側。
  //   実バグも1つあった：下部の戻るが「← おでかけへ戻る」固定だったので、紀行の #島さんぽ から入ると
  //   島マップへ飛ばされて帰り道が壊れていた（[[screen-transition-continuity]]）。
  //   ★screen id は "konron_guide" のまま（nav の ?go=／SCREEN_INDEX を壊さない）。変えたのは体裁と帰り道。
  state.ui.screen = "konron_guide";
  const app = beginScreen();
  app.classList.add("kiko-page");   // 図鑑の体裁(kt-page)をやめ、紀行の明るいWEBメディア面に合わせる
  let total = 0, open = 0;
  (typeof KONRON_GUIDE !== "undefined" ? KONRON_GUIDE : []).forEach(c => c.entries.forEach(e => { total++; if (_kmTotal() >= (KM_TIER_AT[e.tier] || 0)) open++; }));

  // 紀行の連載の一本として名乗る（ロゴ＋著者＋この連載の進み具合）
  const head = el("div", "kiko-head");
  head.innerHTML =
    `<div class="kiko-logo">🏝️ 島さんぽ</div>` +
    `<div class="kiko-byline">『ドラゴンレース紀行』連載 by ミミ🐰 <span class="kiko-badge">${open} / ${total} 本</span></div>` +
    `<div class="kiko-stats"><span>歩いて、聞いて、書きためた崑崙島のはなし。</span></div>`;
  app.appendChild(head);

  (typeof KONRON_GUIDE !== "undefined" ? KONRON_GUIDE : []).forEach(c => {
    app.appendChild(el("div", "kiko-sec", `${c.ic} ${c.cat}`));
    c.entries.forEach(e => {
      const unlocked = _kmTotal() >= (KM_TIER_AT[e.tier] || 0);
      const art = el("div", "kiko-post" + (unlocked ? "" : " locked"));
      art.innerHTML = unlocked
        ? `<div class="kiko-post-k">${c.ic} ${c.cat}</div>` +
          `<div class="kiko-post-t">${e.title}</div>` +
          `<div class="kiko-post-b">${e.body}</div>` +
          `<div class="kiko-post-tags">#島さんぽ #崑崙島 #${c.cat}</div>`
        : `<div class="kiko-post-k">🔒 取材中</div>` +
          `<div class="kiko-post-t">？？？</div>` +
          `<div class="kiko-post-b">${_kmTierLabel(e.tier)}まで暮らしが育つと書ける記事です（総資産 ${(KM_TIER_AT[e.tier] || 0).toLocaleString("ja-JP")}）。</div>`;
      app.appendChild(art);
    });
  });
  const actions = el("div", "actions");
  const back = el("button", "kt-back", "← 📖 紀行へ戻る"); back.onclick = () => renderKiko();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ⑤ 観光フォト・コレクション（図鑑）：全スポットの景色＋グルメ写真をグリッド表示。
// 解放済(=その場所に行ける)＝写真、未解放＝？。タップで鑑賞ビューア→SNS投稿。表示専用。
function renderKonronGallery() {
  if (!konronMapUnlocked()) {   // Ⓑ 親konron_mapと同じ条件でゲート（島がロック中はギャラリーも閉じる）。
    renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("🏝️ おでかけ",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて勝つ</u>と、崑崙島の写真を集められます。</small></div></div>`);
    return;
  }
  state.ui.screen = "konron_gallery";
  const app = beginScreen();
  app.classList.add("kt-page");
  const items = [];
  Object.keys(KONRON_SPOTS).forEach(id => {
    const s = KONRON_SPOTS[id]; const open = _kmSpotOpen(s);
    if (s.photo) items.push({ id: id, kind: "photo", label: s.name, src: s.photo, open: open });
    if (s.gourmet) items.push({ id: id, kind: "gourmet", label: s.name + "・グルメ", src: s.gourmet, open: open });
  });
  const total = items.length, got = items.filter(it => it.open).length;
  app.appendChild(_ktSectionHead("🖼 フォトコレクション", `崑崙島で撮った景色＆ご当地グルメ。行ける場所が増えると集まる（タップで鑑賞${_kmSnsOk() ? "＆SNS投稿" : ""}）。<b>${got} / ${total}</b> 枚 収集。`));
  const grid = el("div", "kgal-grid");
  items.forEach(it => {
    const cell = el("button", "kgal-cell" + (it.open ? "" : " kgal-cell--locked"));
    if (it.open) {
      cell.style.backgroundImage = `url('${it.src}')`;
      if (it.kind === "gourmet") cell.appendChild(el("span", "kgal-badge", "🍽"));
      // ★T1：傑作（☆3）で撮ったスポットは金枠＋★バッジ＝「自分のいちばんの一枚」を誇る。
      if (it.kind === "photo" && _kmPhotoStar(it.id) >= 3) { cell.classList.add("kgal-master"); cell.appendChild(el("span", "kgal-star", "★")); }
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
  const back = el("button", "kt-back", "← おでかけへ戻る"); back.onclick = () => renderKonronMap();
  actions.appendChild(back);
  app.appendChild(actions);
}

// =========================================================================
// ★T3 旅ノート（docs/MINIGAME_LEVELUP_DIRECTIVE §5.4）
// =========================================================================
// 散らばっていた記録（スタンプ／傑作／実食）をエリア単位で1ページに束ねる。
// 「この島のどこを、どれだけ自分のものにしたか」が一目で分かる＝集める動機の受け皿。
// 全エリア制覇で称号＋記念衣装（既存OUTFITSへ付与＝新通貨を作らない）。完全に表示専用メタ。

// エリア1つぶんの記録を数える（写真ありスポットのみが母数＝?のスポットで分母が汚れない）。
function _kmAreaRecord(area) {
  const kz = (state.player || {}).kurashi || {};
  const seen = kz.spotsSeen || {}, stars = kz.photoStars || {};
  const ids = area.spots.filter(id => KONRON_SPOTS[id] && KONRON_SPOTS[id].photo);
  let stamp = 0, master = 0, eats = 0, eatTotal = 0;
  ids.forEach(id => {
    if (seen[id]) stamp++;
    if ((stars[id] || 0) >= 3) master++;
  });
  // そのエリアで食べられる料理（KM_SPOT_MEALS）の実食数
  area.spots.forEach(id => {
    const meals = (typeof KM_SPOT_MEALS !== "undefined" && KM_SPOT_MEALS[id]) || [];
    meals.forEach(mid => { eatTotal++; if (typeof mealEaten === "function" && mealEaten(mid)) eats++; });
  });
  const done = ids.length > 0 && stamp === ids.length;
  return { total: ids.length, stamp, master, eats, eatTotal, done };
}
// 全エリア制覇＝旅の称号。到達した瞬間に記念衣装を1着（重複付与しない）。
function _kmTravelTitle() {
  const areas = KONRON_AREAS.filter(a => a.spots.some(id => KONRON_SPOTS[id] && KONRON_SPOTS[id].photo));
  const doneN = areas.filter(a => _kmAreaRecord(a).done).length;
  return { doneN, total: areas.length, got: doneN >= areas.length && areas.length > 0 };
}
function _kmGrantTravelOutfit() {
  try {
    if (!_kmTravelTitle().got) return null;
    const kz = state.player.kurashi || (state.player.kurashi = {});
    if (kz.travelOutfit) return null;                       // 一度きり
    kz.travelOutfit = 1;
    const id = "konron_photographer";
    if (typeof OUTFITS !== "undefined" && OUTFITS.some(o => o.id === id)) {
      state.player.outfitsWon = state.player.outfitsWon || [];
      if (state.player.outfitsWon.indexOf(id) < 0) state.player.outfitsWon.push(id);
    }
    if (typeof saveGame === "function") saveGame();
    if (typeof _kmToast === "function") _kmToast("🏅 称号「崑崙路の写真家」＆記念衣装を手に入れた！");
    return id;
  } catch (e) { return null; }
}

function renderKonronTravelNote() {
  if (!konronMapUnlocked()) { renderKonronMap(); return; }
  state.ui.screen = "konron_travelnote";
  const app = beginScreen();
  app.classList.add("kt-page");
  _kmGrantTravelOutfit();                                    // 条件を満たしていれば開いた時に授与

  app.appendChild(el("h2", "kt-h2", "📔 旅ノート"));
  const tt = _kmTravelTitle();
  const kz = (state.player || {}).kurashi || {};
  const rares = Object.keys(kz.raresPhoto || {}).length;

  // 総括（島ぜんぶの進み具合）
  const sum = el("div", "tn-sum");
  sum.innerHTML =
    `<div class="tn-sum-row"><span>エリア制覇</span><b>${tt.doneN} / ${tt.total}</b></div>` +
    `<div class="tn-sum-row"><span>★3 傑作</span><b>${kz.masterpieces || 0} 枚</b></div>` +
    (rares ? `<div class="tn-sum-row"><span>幻の一枚</span><b>${rares} 種</b></div>` : "") +
    (tt.got ? `<div class="tn-title">🏅 称号「崑崙路の写真家」</div>`
            : `<div class="tn-next">あと <b>${tt.total - tt.doneN}</b> エリア制覇で称号「崑崙路の写真家」</div>`);
  app.appendChild(sum);

  // エリア別のページ
  KONRON_AREAS.forEach(a => {
    const r = _kmAreaRecord(a);
    if (r.total === 0) return;                               // 写真スポットが無いエリアは載せない
    const card = el("div", "tn-area" + (r.done ? " done" : ""));
    card.style.setProperty("--tnc", a.color || "#888");
    const pct = Math.round(r.stamp / r.total * 100);
    card.innerHTML =
      `<div class="tn-area-h"><span class="tn-area-ic">${a.ic}</span><b>${a.name}</b>` +
        (r.done ? `<span class="tn-badge">制覇</span>` : `<span class="tn-pct">${pct}%</span>`) + `</div>` +
      `<div class="tn-bar"><i style="width:${pct}%"></i></div>` +
      `<div class="tn-stats">` +
        `<span>📷 スタンプ <b>${r.stamp}/${r.total}</b></span>` +
        `<span>★ 傑作 <b>${r.master}</b></span>` +
        (r.eatTotal ? `<span>🍽 実食 <b>${r.eats}/${r.eatTotal}</b></span>` : "") +
      `</div>`;
    card.onclick = () => { _kmArea = a.id; _kmSpot = null; renderKonronMap(); setTimeout(() => { try { _kmRenderPanel(); } catch (e) {} }, 60); };
    app.appendChild(card);
  });

  const actions = el("div", "actions");
  const back = el("button", "kt-back", "← おでかけへ戻る"); back.onclick = () => renderKonronMap();
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
  return `<div class="km-zoom" style="background-image:url('images/konron/island_map.webp?v=20260727a');background-position:${area.mx}% ${area.my}%">` +
    `<img class="km-zoom-img" src="images/konron/area_${area.id}.webp?v=5" alt="" decoding="async" onload="this.classList.add('on')" onerror="this.remove()">` +
    `<span class="km-zoom-tag">🔍 ${area.name}・拡大マップ</span></div>`;
}

// ── 観光フォト・コレクション：専用写真があれば「タップで鑑賞・SNS投稿」できるバナーに ──
function _kmSpotPhotoBanner(id, s) {
  // ※KONRON_SPOTSの値オブジェクトは自身のidを持たない（idはオブジェクトのキー）。s.idは常にundefinedになり
  //   data-photo="undefined" → タップしても_kmOpenPhotoが該当スポットを見つけられず無反応だった（ユーザー指摘）。
  return `<button class="km-photo" data-photo="${id}">` +
    `<img class="km-photo-img" src="${s.photo}" alt="${s.name}" decoding="async">` +
    `<span class="km-photo-tag">📸 タップで鑑賞${_kmSnsOk() ? "・SNS投稿" : ""}</span></button>`;
}
// ★門番（ユーザー指摘・2026-07-31）：SNS(Pyogram)はスマホ購入=broadcastOn()で開く機能なのに、
//   島の写真ビューアの「📣 SNSに投稿」は解放前でも押せて、そのまま投稿できてしまっていた
//   （renderSns 側だけを門番していて、投稿導線が素通しだった）。fail-closed＝未解放なら導線ごと出さない。
function _kmSnsOk() {
  try { return (typeof broadcastOn === "function") && broadcastOn() && (typeof addMyPost === "function"); }
  catch (e) { return false; }
}
// フルスクリーンの写真ビューア（タップで拡大トグル＝じっくり鑑賞／SNS投稿／閉じる）。表示専用。
function _kmPhotoOf(s, kind) { return (kind === "gourmet") ? s.gourmet : s.photo; }
function _kmPhotoCap(s, kind) { return (kind === "gourmet") ? ("🍽 " + s.name + "のご当地グルメ") : (s.line || s.name); }
function _kmOpenPhoto(spotId, kind) {
  const s = KONRON_SPOTS[spotId]; const src = s && _kmPhotoOf(s, kind); if (!src) return;
  document.querySelectorAll(".km-viewer").forEach(v => v.remove());   // 既存ビューアーを先に消す（重ね開き→閉じても前の画像が残る不具合の修正）
  const ov = el("div", "km-viewer");
  ov.innerHTML =
    `<div class="km-viewer-bd"></div>` +
    `<div class="km-viewer-stage"><img class="km-viewer-img" src="${src}" alt="${s.name}"></div>` +
    `<div class="km-viewer-cap"><b>${s.name}</b><span>${_kmPhotoCap(s, kind)}</span></div>` +
    `<div class="km-viewer-bar">` +
      (_kmSnsOk() ? `<button class="km-vbtn km-vbtn--sns" data-act="sns">📣 SNSに投稿</button>` : ``) +
      `<button class="km-vbtn" data-act="x">✕ 閉じる</button></div>`;
  document.body.appendChild(ov);
  const img = ov.querySelector(".km-viewer-img");
  img.onclick = () => img.classList.toggle("km-zoomed");
  const close = () => ov.remove();
  ov.querySelector(".km-viewer-bd").onclick = close;
  ov.querySelector('[data-act="x"]').onclick = close;
  const snsB = ov.querySelector('[data-act="sns"]');
  if (snsB) snsB.onclick = () => _kmSnsCompose(spotId, kind);
}
// SNS（ぴょこったー）へコメント付きで投稿。sns.js の addMyPost(text,img) を使う＝タイムラインに流れる。
function _kmSnsCompose(spotId, kind) {
  const s = KONRON_SPOTS[spotId]; const src = s && _kmPhotoOf(s, kind); if (!src) return;
  if (!_kmSnsOk()) { _kmToast("📱 スマホを手に入れると投稿できます"); return; }   // 二重の守り（呼ばれても通さない）
  document.querySelectorAll(".km-compose").forEach(v => v.remove());   // 既存の投稿モーダルを先に消す（同種の重ね開き対策）
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

// ★門番（表示専用）：スポットの説明文に「まだ出会っていない相手」の固有名を出さないための出し分け。
//   ・撮れるもの＝ミズ研究室は advisorMet("mizu")（総資産しきい値 AND 第2話既読）のときだけ名前が載る。
//   ・章スタンプ＝ポロは poroFound() が唯一の門番。発見前は「ポロ」も「泣き虫」も出さない（命名オチを潰さない）。
//   どちらも typeof/例外は「出さない」側に倒す（fail-closed）。
function _kmShootOf(id, s) {
  const base = (s && s.shoot) || "";
  try {
    if (id === "left_wing" && typeof advisorMet === "function" && advisorMet("mizu")) {
      const nm = ((typeof castNameSafe === "function") ? castNameSafe("mizu") : "").split("・")[0];
      if (nm && nm !== "？？？") return base.replace("オッズ解析の研究室", nm + "研究室");
    }
  } catch (e) {}
  return base;
}
function _kmStampText(id, txt) {
  if (id !== "ryusha") return txt;
  let found = false;
  try { found = (typeof poroFound === "function") && !!poroFound(); } catch (e) { found = false; }
  return found ? txt : "第3話——小さな子竜と目が合った、竜たちの森。";   // 発見前は名前も“泣き虫”も伏せる
}

// K3-A3: 章→舞台スポットの対応（表示のみ）。[章配列, 日報風キャプション]
const KM_STAMP = {
  tanryu:     [[1], "第1話——すべては、はじめての一枚の券から。"],
  makemeshi:  [[1], "第1話——負けた夜の一杯が、再起の出発点だった。"],
  market:     [[2], "第2話——ミズの言う“市場のほんとう”は、この湯気の中に。"],
  mall:       [[2], "第2話——開店祝いはサケから。ミミ、はじめての衣装選び。"],
  kachimeshi: [[3], "第3話——暮らしが根を張りはじめた頃、祝いの串はここで。"],
  ryusha:     [[3], "第3話——泣き虫の子竜と出会った、竜たちの森。"],
  oshigoods:  [[4], "第4話——配信の時代。推しの旗が、観客席を埋めていく。"],
  uroko:      [[4], "第4話——バズった夜は、湯けむりでクールダウン。"],
  kibishis:   [[5], "終章——空がいちばん近い場所で、彼女は“天井”を見上げた。"],
  dakon:      [[5], "終章——島の奥に眠るものが、静かに目を覚ます。"],
  racecourse: [[6], "そして今日も——聖龍が駆け、島は笑う。"]
};

// ===== H5: 観光の遊び化第2弾（表示専用・docs/KURASHI_STORY_WEAVE.md の台帳 spotsSeen を使う）=====
// 日替わりフォトミッション「今日の一枚」＝日付で決定的に1スポット（開放済＆写真あり）。
function _kmDayKey() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function _kmPhotoMission() {
  try {
    const ids = Object.keys(KONRON_SPOTS).filter(id => KONRON_SPOTS[id].photo && _kmSpotOpen(KONRON_SPOTS[id]));
    if (!ids.length) return null;
    let h = (_kmDayKey() * 48271) % 2147483647;
    return ids[h % ids.length];
  } catch (e) { return null; }
}
function _kmPmDone(id) {
  try { const kz = (state.player || {}).kurashi || {}; return kz.pmDay === _kmDayKey() && kz.pmSpot === id; } catch (e) { return false; }
}
// ★T1 撮影ミニゲーム：各スポットのベスト☆（1〜3・未撮影は0）。傑作判定＝3。
function _kmPhotoStar(id) {
  try { return ((state.player || {}).kurashi || {}).photoStars ? (state.player.kurashi.photoStars[id] || 0) : 0; } catch (e) { return 0; }
}
// 撮影を開始し、結果の☆を記録する。失敗状態は無い（☆1でも成立）。
//   ・ベスト☆を更新（表示専用メタ）
//   ・今日の一枚ミッションは「☆2以上」で達成（訪問だけの自動達成をやめ、遊びにする）
//   ・☆3＝傑作は還流（傑作カウント）＋パネル再描画で金の☆に
function _kmStartShoot(id) {
  if (typeof pgOpen !== "function" || !id || !KONRON_SPOTS[id]) return;
  pgOpen(id, function (stars, detail) {
    try {
      if (!stars) return;                          // やめた（撮らなかった）＝何も起きない
      const kz = state.player.kurashi || (state.player.kurashi = {});
      const ps = kz.photoStars || (kz.photoStars = {});
      const prev = ps[id] || 0;
      if (stars > prev) ps[id] = stars;            // ベスト更新
      // 傑作の累計（旅ノート/SNS/日報が後で拾う・表示専用メタ）
      if (stars >= 3 && prev < 3) kz.masterpieces = (kz.masterpieces || 0) + 1;
      // ★K1 撮影連動の実地稽古（スポットのカテゴリ・見頃に応じて習い事が上達）
      if (typeof FieldStats !== "undefined") {
        const s = KONRON_SPOTS[id] || {};
        if (s.cat === "port" && stars >= 2) FieldStats.bump("tourStar2Port");           // 英会話
        if (id === "left_wing" && stars >= 2) FieldStats.bump("tourEconSpot");          // 投資
        if ((s.cat === "onsen" || /茶屋|茶処/.test(s.name || "")) && stars >= 3) FieldStats.bump("tourTeaMaster");   // 茶道
        if (s.cat === "view" && detail && detail.inSeason) FieldStats.bump("tourViewShots");   // ヨガ（見頃の絶景）
      }
      // ★T2 幻の一枚：撮れたら図鑑バッジ（種類ごとに1回・再訪の動機）＋トースト
      if (detail && detail.rare) {
        const rp = kz.raresPhoto || (kz.raresPhoto = {});
        const first = !rp[detail.rare.id];
        rp[detail.rare.id] = 1;
        if (first && typeof _kmToast === "function") _kmToast("✨ 幻の一枚「" + detail.rare.name + "」を撮った！");
      }
      // 今日の一枚：☆2以上で達成
      if (_kmPhotoMission() === id && stars >= 2 && !_kmPmDone(id)) {
        kz.pmDay = _kmDayKey(); kz.pmSpot = id;
        if (typeof _kmToast === "function") _kmToast("📸 今日の一枚、いただき！");
      }
      if (typeof saveGame === "function") saveGame();
    } catch (e) {}
    _kmRenderPanel();                              // ☆表示を更新
  });
}
// エリアの写真スポット進捗（seen/total）。total=0のエリアは対象外。
function _kmAreaProg(area) {
  try {
    const seen = ((state.player || {}).kurashi || {}).spotsSeen || {};
    const ids = area.spots.filter(id => KONRON_SPOTS[id] && KONRON_SPOTS[id].photo);
    return { got: ids.filter(id => seen[id]).length, total: ids.length };
  } catch (e) { return { got: 0, total: 0 }; }
}

// ===== 到着ミニVN（NARRATIVE_DESIGN §5＝観光の旅行体験化）=========================
// 初訪問のスタンプ押印と同時に、カテゴリ担当のガイドと3〜4行の掛け合い。背景はそのスポットの実写真
// （bg:にパス指定＝dialogue.js のクロスフェード背景）。構成はフリ→ボケ（ガイドの職業病）→ミミのツッコミ→
// 写真/グルメへの誘い。★門番: 未登場の顧問はミミ（＋発見済みならポロ）の二人旅にフォールバック（fail-closed）。
// ★T3 観光スポット⇄スカウトロケの対応表（C4解消：ryusha 1点経由だった結線を“面”に広げる）。
//   地形が重なる場所にだけ「🐾この辺りで竜の気配」チップを出し、renderScout へ誘う。表示専用。
//   値＝SCOUT_LOCATIONS の id（grass/jungle/cliff/volcano/sea/sky）。
// ★T3 隠しスポットの発見条件（既読データから引く＝食事・撮影の実績。事前告知はどこにもしない）。
//   fail-closed：条件を満たすまで UI のどこにも並ばない（存在自体が見えない）。
const KM_HIDDEN = {
  ura_bistro: { area: "city", cond: function () { try { return typeof mealEaten === "function" && mealEaten("g_pasta"); } catch (e) { return false; } } },
  neko_tsuji: { area: "city", cond: function () { try { var d = mealData(); return Object.keys(d.eaten || {}).length >= 10; } catch (e) { return false; } } },
  hoshikuzu:  { area: "cliff", cond: function () { try { return (((state.player || {}).kurashi || {}).masterpieces || 0) >= 3; } catch (e) { return false; } } },
  // ★W2（2026-08-01）：隠しが city にしか無く、**探索の報酬が序盤エリアで打ち止め**だった。
  //   浜と漁師町に1つずつ足す。どちらも**既存スポット＋既存写真**で、新しい画は発注していない
  //   （mango_orchard.webp / ryoshimeshi.webp とも実在を確認済み）。
  //   条件は ura_bistro の作法をそのまま踏襲＝「その屋台で食べた人だけが、次の場所を教わる」。
  //   浜のかき氷 → 果物の出どころ（火山果樹園）／波止場のイカ焼き → 漁師のまかない、と
  //   **その場の屋台と隠し先が地続き**になるように選んである。
  mango:      { area: "beach",   cond: function () { try { return typeof mealEaten === "function" && mealEaten("t_kakigori"); } catch (e) { return false; } } },
  ryoshimeshi:{ area: "fishing", cond: function () { try { return typeof mealEaten === "function" && mealEaten("t_ikayaki"); } catch (e) { return false; } } }
};
// 隠しスポットが表示してよい状態か（未定義＝普通のスポット＝常に true）。
function _kmHiddenOk(id) {
  const h = KM_HIDDEN[id]; if (!h) return true;
  if (!h.cond()) return false;
  // 初発見の瞬間だけ、ささやかに祝う（以後は普通のスポットとして振る舞う）
  try {
    const kz = state.player.kurashi || (state.player.kurashi = {});
    const f = kz.hiddenFound || (kz.hiddenFound = {});
    if (!f[id]) { f[id] = 1; if (typeof saveGame === "function") saveGame(); if (typeof _kmToast === "function") _kmToast("❓ 新しい場所を見つけた…！"); }
  } catch (e) {}
  return true;
}
const KM_SCOUT_HINT = {
  ryusha: "grass",       // 竜舎林＝スカウトの起点（草むら）
  lumina: "jungle",      // ルミナ瀑布＝密林の奥
  lodge: "jungle",       // 山小屋＝密林の縁
  kibishis: "cliff",     // キビシス崖線＝崖
  hoshimi: "cliff",      // 星見の展望台＝崖の上
  bangara: "volcano",    // バンガラ溶岩海岸＝火山地帯
  rg_caldera: "volcano", // カルデラ火口周回路＝火山地帯
  sena: "sea",           // セナ浜＝水中の入り口
  hoshiuo: "sea",        // ホシウオ村＝海
  dakon: "sky",          // ダコン湖外縁＝空を舞う竜が見える
  rg_vento: "sky"        // ヴェント峡谷＝風と空
};
const KM_GUIDE = { port: "sake", okuchi: "sake", food: "mizu", shop: "mizu", civic: "sumika", stay: "sumika",
  race: "makura", oshi: "makura", view: "celestia", onsen: "poro" };
function _kmArrivalScript(id, s, cat) {
  const nm = s.name;
  let g = KM_GUIDE[cat] || null;
  const met = k => { try { return typeof advisorMet === "function" && advisorMet(k); } catch (e) { return false; } };
  const hasPoro = (typeof poroFound === "function") && poroFound();
  if (g === "poro" && !hasPoro) g = null;
  if (g && g !== "poro" && !met(g)) g = null;
  const bg = s.photo;   // 実在のスポット写真を場面に（旅行の絵になる）
  const closer = s.gourmet
    ? { s: "mimi", e: "happy", t: "……いい匂いする。写真の前に、一口だけ。ね？", fx: "hop" }
    : { s: "mimi", e: "smile", t: "よし、ここは一枚撮っておこう。旅の証拠！" };
  // ガイド別：職業病ボケ→ミミのツッコミ（声表準拠・各3〜4行）
  const S = {
    sake: [
      { s: "sake", t: "着いたぞ。……いい風だ。", bg: bg },
      { s: "sake", t: nm + "。竜を連れて歩くなら、まずここの匂いを覚えろ。" },
      { s: "mimi", e: "panic", t: "匂い!?　景色じゃなくて!?　……くんくん。……あ、ほんとだ、覚えた。" },
      closer
    ],
    mizu: [
      { s: "mizu", t: "はい到着、" + nm + "。……ちなみにここの土地、坪いくらだと思う？", bg: bg },
      { s: "mimi", e: "panic", t: "旅先で原価の話やめて!?", fx: "shake" },
      { s: "mizu", t: "ふふ。いいものを見る目は、値段を知ってから育つの。……ほら、見てらっしゃい。" },
      closer
    ],
    sumika: [
      { s: "sumika", t: "ミミ様、" + nm + "に到着しました。……並びます。", bg: bg },
      { s: "mimi", t: "え、まだ誰も並んでな……", fx: "shake" },
      { s: "sumika", t: "人気施設は、並んでから考えるのが行政の知恵です。整理券をどうぞ。" },
      closer
    ],
    makura: [
      { s: "makura", t: "はい" + nm + "着いたー！　カメラ回ってる？　回ってないけど回ってる体でよろしく！", bg: bg },
      { s: "mimi", e: "panic", t: "どういう体!?", fx: "shake" },
      { s: "makura", t: "旅はぜんぶ切り抜きどころ。……ここ、いいね。バズる風が吹いてる。" },
      closer
    ],
    celestia: [
      { s: "celestia", t: "……ここ、上から見るといちばん綺麗なのよ。", bg: bg },
      { s: "mimi", t: "上からの感想!?　わたしたち今、下にいるんですけど!?" },
      { s: "celestia", t: "だから来たの。下から見る" + nm + "は、初めて。……いいものね。" },
      closer
    ],
    poro: [
      { s: "narrator", t: "♨️ " + nm + "。ポロが先にとぽんと浸かって、目を細めた。", bg: bg },
      { s: "mimi", e: "happy", t: "あっ、ずるい！　わたしも入る！……ふあぁ……とける……。" },
      { s: "narrator", t: "ポロの尻尾が、お湯の中でゆっくり三回ゆれた。（……ごきげんだ）" },
      closer
    ]
  };
  if (g && S[g]) return S[g];
  // フォールバック＝ミミの一人旅（＋ポロがいれば足元に）
  return [
    { s: "mimi", t: "とうちゃーく！　ここが" + nm + "かぁ……。", bg: bg, fx: "hop" },
    hasPoro ? { s: "narrator", t: "ポロが足元で、ぐるりとあたりを見回している。" }
            : { s: "mimi", e: "smile", t: "……ひとり旅も、わるくない。うん。" },
    closer
  ];
}
// ♨️ ウロコトロ温泉郷＝ミズとの湯けむり回。★終章（三頭同着）の伏線をここで一度だけ渡す。
//   もとは小イベントを「12戦」で開けていたが、きっかけが唐突だった。**初めて温泉に来た日の
//   出来事**にすると、話の入り（平和だね〜 → 平和といえば）が自然につながる。
//   ★ミズ未登場のうちは発火させない（fail-closed）。その場合は通常の到着VNを出し、
//     ミズの話は次に来たときに回す＝初回に会えていなくても取り逃さない。
//   ここで setStoryFlag("onsenDeadheatHeard") を立て、小イベント側（読み返し用）の解放条件にする。
function _kmOnsenMizuScript(s) {
  const bg = s.photo;
  // ★湯上がりの立ち絵（この場面だけ）。行の img で差し替える＝衣装IDや顧問の表情差分を
  //   増やさずに済む。未納品なら Dialogue 側が通常の絵へ自動で落ちる（fail-safe）。
  const MI = "images/cast/mimi/mimi_onsen_smile.webp";
  const MZ = "images/cast/stand/mizu_onsen.webp";
  const mimi = (t, e) => ({ s: "mimi", t: t, e: e || "smile", img: MI });
  const mizu = (t) => ({ s: "mizu", t: t, img: MZ });
  return [
    { s: "narrator", t: "♨️ ウロコトロ温泉郷。湯けむりの向こうで、湖の灯りが揺れている。", bg: bg },
    mimi("ふあぁ……とける……。ミズさん、ここ、さいっこうです……。"),   // ★hopは付けない（浸かってるのに跳ねる）
    mizu("でしょう。あたくし、月に一度は来るのよ。……ほら、肩まで浸かりなさいな。"),
    mimi("はーい。……ん〜〜〜っ、平和だね〜。", "happy"),
    mizu("……ほんと。平和だわ〜。"),
    { s: "narrator", t: "しばらく、湯の音だけがしていた。" },
    // ★この島の掟：当たりが同着なら配当は 1.0倍（元返し）。「同着は竜の名誉にも勝敗にも
    //   ならない」という古い言い伝えから。★頭数には触れさせない——三頭同着が前代未聞である
    //   ことが薄れるため（最終決戦のマクラ「神兎大レース史上、初」を殺さない）。
    mizu("……平和といえば。むかし、一着がならんだ日があってね。"),
    mimi("ならんだ？　……写真判定、ってやつですか。", "panic"),
    mizu("その写真判定でも、分けられなかったの。——同着よ。"),
    mimi("……じゃあ、配当ってどうなるんですか？"),
    mizu("1.0倍。……賭けたぶんが、そのまま返ってくるだけ。"),
    mimi("えっ。当てたのに、増えないんですか。"),
    mizu("ええ。この島の決まりなの。……同着はね、竜の名誉にも、勝敗にもならないから。"),
    { s: "narrator", t: "ミズが湯をすくって、ぱしゃりと落とした。" },
    mizu("勝った竜も、負けた竜も、いない。……だからその日は、だれも勝たないし、だれも負けないの。"),
    mimi("……なんか、やさしいですね。それ。"),
    mizu("そうね。……あたくしも、きらいじゃないわ。"),
    { s: "narrator", t: "湯けむりが、ゆっくりと湖のほうへ流れていった。" }
  ];
}
function _kmMaybeOnsenDeadheat(id, s) {
  try {
    if (id !== "uroko") return false;
    if (!(window.Dialogue && Dialogue.play)) return false;
    if (!(typeof advisorMet === "function" && advisorMet("mizu"))) return false;   // 未登場なら次回へ回す
    const kz = state.player.kurashi || (state.player.kurashi = {});
    if (kz.onsenDeadheatSeen) return false;
    kz.onsenDeadheatSeen = 1;
    if (typeof setStoryFlag === "function") setStoryFlag("onsenDeadheatHeard", true);
    if (typeof saveGame === "function") saveGame();
    Dialogue.play(_kmOnsenMizuScript(s), { force: true });
    return true;
  } catch (e) { return false; }
}
function _kmPlayArrival(id, s, cat) {
  try {
    if (!(window.Dialogue && Dialogue.play)) return;
    const kz = state.player.kurashi || (state.player.kurashi = {});
    const seenVN = kz.arrivalSeen || (kz.arrivalSeen = {});
    if (seenVN[id]) return;   // 到着VNはスポットごとに1回だけ（2回目からは静かに）
    // ♨️温泉の初訪問はミズの湯けむり回を優先（ミズ未登場なら下の通常VNへ落ちる）
    if (_kmMaybeOnsenDeadheat(id, s)) { seenVN[id] = 1; if (typeof saveGame === "function") saveGame(); return; }
    seenVN[id] = 1; if (typeof saveGame === "function") saveGame();
    // ★G7：絶景スポットの初訪問後は「知らないお姉さん」の代替カメオ（破産しない上手い人向け・
    //   第4話既読＋未遭遇のみ発火＝epilogue_engine.maybeStrangerVista が全条件を持つ）。
    Dialogue.play(_kmArrivalScript(id, s, cat)).then(function () {
      try { if (cat === "view" && typeof maybeStrangerVista === "function") maybeStrangerVista(); } catch (e2) {}
    });
  } catch (e) {}
}

// ★N5: スポット↔グルメ直結（NARRATIVE_DESIGN W4）。ここに1行足すだけで「ここで食べる」が増える。
// 実食(eat)品はその場で食べられる（eatMeal＝hunger.jsの課金/満腹ラップ経由＝経済は既存どおり）。
// クイズ品(quiz)はごはん画面の名物あてへ誘導。ティア未解放は🔒＋条件表示。表示メタ＝レース数値不変。
const KM_SPOT_MEALS = {
  ura_bistro:    ["g_pasta"],   // ★T3 隠し席＝パスタの店の奥（発見条件の料理をここでも食べられる）
  market:        ["t_nikuman", "t_kakigori"],
  kachimeshi:    ["t_yakitori", "t_dote"],
  makemeshi:     ["t_ramen"],
  jogai:         ["t_dog", "g_gyoza"],
  ennichi:       ["t_takoyaki", "t_wataame", "t_ikayaki", "s_karaage"],
  amazake_chaya: ["t_amazake", "t_dango"],
  oyakata:       ["s_dashimaki"],
  cafe:          ["s_pound"],
  patisserie:    ["s_chocolate"],
  kissaten:      ["g_pudding", "s_omurice"],
  backbistro:    ["g_pasta"],
  lavasteak:     ["g_steak"],
  ryoshimeshi:   ["g_paella", "g_tempura"],
  lodge:         ["g_risotto"],
  quaybar:       ["g_ajillo", "g_chowder"],
  wagashi:       ["s_castella"],
  mango:         ["t_kakigori"],
  // ★分類が「食べ歩き」なのに料理が結ばれておらず、この2軒だけ
  //   「ここで食べる」欄が出ないままだった（結線検査で発覚）。
  lounge:        ["g_acqua", "s_cheese"],   // 屋上バー＝夜の一皿と締めの甘味
  gelato:        ["t_kakigori", "s_cheese"] // ジェラート店＝冷たい甘味
};
function _kmMealHtml(spotId) {
  try {
    const ids = KM_SPOT_MEALS[spotId];
    if (!ids || !ids.length || typeof MEALS === "undefined") return "";
    let rows = "";
    ids.forEach(function (mid) {
      const m = MEALS.find(function (x) { return x.id === mid; }); if (!m) return;
      const tierOpen = (typeof mealTierUnlocked !== "function") || mealTierUnlocked(m.tier);
      const got = (typeof mealUnlocked === "function") && mealUnlocked(m);
      if (!tierOpen) {
        const hint = m.tier === "shinbo" ? "終章（第5話）で解放" : m.tier === "gourman" ? "総資産100万で解放" : "まだ食べられない";
        rows += `<div class="km-eat locked"><span class="ke-ic">🔒</span><span class="ke-nm">${m.icon || "🍽"} ${m.name}</span><small>${hint}</small></div>`;
      } else if (m.quiz) {
        rows += `<button class="km-eat quiz" data-meal="${m.id}"><span class="ke-ic">${got ? "✅" : "❓"}</span><span class="ke-nm">${m.icon || "🍽"} ${m.name}</span><small>${got ? "攻略済み・ごはん画面で読み返す" : "名物あてに挑戦（ごはん画面へ）"}</small></button>`;
      } else {
        rows += `<button class="km-eat" data-meal="${m.id}"><span class="ke-ic">${got ? "✅" : "🍽"}</span><span class="ke-nm">${m.icon || "🍽"} ${m.name}</span><small>${got ? "おかわりする" : "はじめての実食！"}</small></button>`;
      }
    });
    if (!rows) return "";
    return `<div class="km-eats"><div class="km-eats-t">🍽 ここで食べる</div>${rows}</div>`;
  } catch (e) { return ""; }
}
function _kmRenderPanel() {
  const panel = document.getElementById("km-panel"); if (!panel) return;

  // ① スポット詳細（写真カード＋ポータル）
  if (_kmSpot && KONRON_SPOTS[_kmSpot]) {
    const s = KONRON_SPOTS[_kmSpot];
    const c = KM_CATS[s.cat] || KM_CATS.port;
    const area = _kmAreaOf(_kmSpot);
    const open = _kmSpotOpen(s);
    // K3-A3（docs/KURASHI_STORY_WEAVE.md A3）：「いまの話の舞台」章スタンプ。
    // 現章がそのスポットの舞台なら日報風バッジを出す（表示のみ・KONRON_SPOTS本体は不変）。
    // K2（暮らし還流）：写真を見た記録＝表示専用メタ。還流台帳 k_spots8/k_spots20 と
    // 日報の文化面小イベントがこのカウントに反応する（docs/KURASHI_STORY_WEAVE.md B）。
    let _stampNew = false, _areaComp = null;   // H4/H5: 押印・エリア制覇（今日の一枚は撮影側=_kmStartShootが担当）
    if (open && s.photo) {
      try {
        const kz = state.player.kurashi || (state.player.kurashi = {});
        const seen = kz.spotsSeen || (kz.spotsSeen = {});
        if (!seen[_kmSpot]) {
          seen[_kmSpot] = 1; _stampNew = true;
          const ar = _kmAreaOf(_kmSpot);   // このスタンプでエリアの写真スポットが揃った＝制覇！
          if (ar) { const pr = _kmAreaProg(ar); if (pr.total > 0 && pr.got === pr.total) _areaComp = ar; }
        }
        // ★T1：今日の一枚は「訪問＝自動達成」をやめ、撮影で☆2以上を撮ると達成に変更（_kmStartShoot）。
        //   達成通知は撮影側の toast に一本化（ここではバナーを出さない＝二重告知を避ける）。
        if (_stampNew) { if (typeof saveGame === "function") saveGame(); }
        // ★初訪問＝到着ミニVN（ガイドとの掛け合い・スポット写真を背景に）。パネル描画後に少し遅らせて再生。
        if (_stampNew) { const _aid = _kmSpot, _as = s; setTimeout(() => _kmPlayArrival(_aid, _as, _as.cat), 420); }
        // ♨️ ミズの湯けむり回は「初訪問」に限定しない。初回にミズが未登場だと永久に見られなく
        //   なるため、2回目以降の入湯でも取りこぼしを拾う（内部で一度きりガード済み）。
        else if (_kmSpot === "uroko") { const _us = s; setTimeout(() => _kmMaybeOnsenDeadheat("uroko", _us), 420); }
        // ★K1 初訪問の実地稽古（高所エリア＝ジム／civic＝ボランティア／読み物あり＝読書会）
        if (_stampNew && typeof FieldStats !== "undefined") {
          const _ar = _kmAreaOf(_kmSpot);
          if (_ar && (_ar.id === "cliff" || _ar.id === "falls")) FieldStats.bump("tourHighSpots");
          if (s.cat === "civic") FieldStats.bump("tourCivic");
          if (typeof konronContentOf === "function" && konronContentOf(_kmSpot)) FieldStats.bump("tourGuideRead");   // その土地の読み物に触れた
        }
      } catch (e) {}
    }
    panel.style.setProperty("--kmc", c.color);
    let body = (open && s.photo) ? _kmSpotPhotoBanner(_kmSpot, s) : _kmZoomBanner(area);
    if (area && area.spots.length > 1) body += `<button class="km-areaback" data-back="1">← ${area.name}</button>`;
    body += `<div class="km-card-head"><span class="km-card-ic">${c.ic}</span>` +
      `<div class="km-card-id"><b>${s.name}</b><small>${c.name}${s.time && s.time !== "—" ? "・" + s.time : ""}</small></div></div>`;
    // K3-A3: 「いまの話の舞台」章スタンプ（現章が舞台のスポットだけ・表示のみ）
    try {
      const chNow = Math.min((typeof kurashiChapter === "function") ? kurashiChapter() : 1, 6);
      const stamp = KM_STAMP[_kmSpot];
      if (open && stamp && stamp[0].indexOf(chNow) >= 0) {
        body += `<div class="km-stamp">📰 いまの話の舞台<span>${_kmStampText(_kmSpot, stamp[1])}</span></div>`;   // ★門番経由（未発見のポロを名指ししない）
      }
    } catch (e) {}
    // H4: 観光スタンプラリー（表示専用・spotsSeen＝K2の還流台帳と同じ台帳を使う）。
    // 初訪問はドンと押印演出＋通し番号＝「写真を見る」が「島を集める」遊びになる。
    try {
      if (open && s.photo) {
        const _seen = ((state.player || {}).kurashi || {}).spotsSeen || {};
        const _seenN = Object.keys(_seen).length;
        const _totalN = Object.keys(KONRON_SPOTS).filter(k => KONRON_SPOTS[k].photo).length;
        body += `<div class="km-rally${_stampNew ? " new" : ""}">` +
          `<span class="km-rally-seal">📷</span>` +
          `<span class="km-rally-t">${_stampNew ? "スタンプを押した！" : "スタンプ済み"}</span>` +
          `<b>${_seenN} / ${_totalN}</b></div>`;
        // H5: エリア制覇のバナー（一度きりの瞬間演出）。今日の一枚の達成通知は撮影側 toast に一本化。
        if (_areaComp) body += `<div class="km-areacomp">🏆 ${_areaComp.ic} ${_areaComp.name}エリア、制覇！<span>島の写真帳に「制覇の証」が刻まれた。</span></div>`;
      }
    } catch (e) {}
    if (!open) {
      body += `<div class="km-card-lock">🔒 まだ行けない場所（<b>${_kmTierLabel(s.tier)}</b>で解放）。総資産 ${KM_TIER_AT[s.tier].toLocaleString("ja-JP")} で開放。</div>`;
    } else {
      body += `<div class="km-card-line">${s.line}</div>`;
      const _shoot = _kmShootOf(_kmSpot, s);   // ★門番経由（未登場の顧問名を「撮れるもの」に出さない）
      if (_shoot && _shoot !== "—") body += `<div class="km-card-shoot">📸 撮れるもの：${_shoot}</div>`;
      // ★T1: 撮影ミニゲーム（photo保持スポットのみ）。過去のベスト☆を添えて「もっといい一枚」を誘う。
      if (s.photo && typeof pgOpen === "function") {
        const _bestStar = _kmPhotoStar(_kmSpot);
        const _starTx = _bestStar ? `<span class="km-shoot-best">${"★".repeat(_bestStar)}${"☆".repeat(3 - _bestStar)}</span>` : `<span class="km-shoot-best none">未撮影</span>`;
        body += `<button class="km-shoot-btn${_bestStar >= 3 ? " master" : ""}" data-shoot="${_kmSpot}">📷 撮影する${_starTx}</button>`;
      }
      // ★T3 スカウト結線：地形が重なるスポットにだけ「竜の気配」チップ（スカウト解放後のみ＝fail-closed）。
      if (KM_SCOUT_HINT[_kmSpot] && typeof poroScoutUnlocked === "function" && poroScoutUnlocked()) {
        body += `<button class="km-scout-hint" data-scout="${KM_SCOUT_HINT[_kmSpot]}">🐾 この辺りで竜の気配…<span>竜スカウトへ</span></button>`;
      }
      body += _kmContentHtml(_kmSpot);   // 見どころ／名物／豆知識（作りこみ）
      if (s.gourmet) body += `<button class="km-gourmet" data-gourmet="${_kmSpot}"><img src="${s.gourmet}" alt="" decoding="async"><span>🍽 ご当地グルメ・タップで鑑賞／投稿</span></button>`;   // s.id は常にundefined（同種バグ・上のdata-photoと同じ原因）
      body += _kmMealHtml(_kmSpot);   // ★N5: ここで食べる（スポット↔MEALS直結）
      if (s.portal && typeof window[s.portal] === "function") {
        const labelMap = { renderMeals: "🍢 食べ歩きへ", renderMall: "🛍️ ショッピングへ", renderRaceSelect: "🏁 レースへ", renderSns: "📣 SNSへ", renderScout: "🐉 竜スカウトへ" };
        // ★遷移先が未解放なら「開いてる見た目→跳ね返される」をやめ、鍵つきの案内表示にする（NARRATIVE_DESIGN §7-H）。
        const _portalGate = {
          renderMall: () => (typeof mallUnlocked !== "function") || mallUnlocked(),
          renderSns: () => (typeof broadcastOn !== "function") || broadcastOn(),
          renderScout: () => (typeof poroScoutUnlocked !== "function") || poroScoutUnlocked()
        };
        const _pOpen = !_portalGate[s.portal] || (function () { try { return _portalGate[s.portal](); } catch (e) { return false; } })();
        const _pLockHint = { renderMall: "第2話を読むと開く", renderSns: "配信を始めると開く", renderScout: "相棒と出会うと開く" };
        body += _pOpen
          ? `<button class="km-go" data-portal="${s.portal}">${labelMap[s.portal] || "▶ ひらく"}</button>`
          : `<div class="km-card-lock">🔒 ${labelMap[s.portal] || "この施設"}は、${_pLockHint[s.portal] || "まだ開いていない"}。</div>`;
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
    const sh = panel.querySelector(".km-shoot-btn");
    if (sh) sh.onclick = () => _kmStartShoot(sh.getAttribute("data-shoot"));
    // ★T3 竜の気配→スカウトへ（ロケ事前選択は state 経由＝renderScout側の将来拡張に開けておく）
    const sc = panel.querySelector(".km-scout-hint");
    if (sc) sc.onclick = () => { try { state.ui.scoutFrom = sc.getAttribute("data-scout"); } catch (e) {} if (typeof renderScout === "function") renderScout(); };
    // ★N5: ここで食べる＝その場実食（初実食はミミの実食コメントVN）。クイズ品はごはん画面へ。
    panel.querySelectorAll(".km-eat[data-meal]").forEach(function (b) {
      b.onclick = function () {
        const mid = b.getAttribute("data-meal");
        const m = (typeof MEALS !== "undefined") && MEALS.find(function (x) { return x.id === mid; });
        if (!m) return;
        // ★名物あては、その料理を開いた状態でごはん画面へ。
        //   これまで renderMeals() を呼ぶだけで、押した名物とは無関係の
        //   一覧が出ていた（どれを押しても同じ＝押した意味が無い）。
        //   その料理が属する段のタブに合わせてから、詳細を開く。
        if (m.quiz) {
          if (typeof renderMeals === "function") {
            if (typeof _mealTab !== "undefined" && m.tier) _mealTab = m.tier;
            renderMeals();
          }
          if (typeof showMealDetail === "function") showMealDetail(m);
          return;
        }
        const first = !((typeof mealEaten === "function") && mealEaten(mid));
        if (typeof eatMeal === "function") eatMeal(mid);   // hungerラップ経由（課金/満腹/おごり）
        // 実食が成立した初回だけ、ミミのコメントを一言（満腹/金欠で不成立なら eaten 不変＝出ない）
        if (first && (typeof mealEaten === "function") && mealEaten(mid) && window.Dialogue && Dialogue.play && m.react) {
          Dialogue.play([{ s: "mimi", t: m.react, e: "happy" }]);
        }
        _kmRenderPanel();
      };
    });
    return;
  }

  // ② エリア（複数スポット）＝スポット一覧チップ
  if (_kmArea) {
    const area = KONRON_AREAS.find(a => a.id === _kmArea);
    if (area) {
      panel.style.setProperty("--kmc", area.color);
      // H5: エリア進捗（写真スポットのスタンプ数）＋制覇の証
      const _apr = _kmAreaProg(area);
      const _acomp = _apr.total > 0 && _apr.got === _apr.total;
      let body = _kmZoomBanner(area) + `<div class="km-area-head"><span class="km-card-ic">${area.ic}</span><b>${area.name}</b>` +
        (_apr.total > 0
          ? `<small class="km-area-prog${_acomp ? " comp" : ""}">${_acomp ? "🏆 制覇の証" : "📷 " + _apr.got + "/" + _apr.total}</small>`
          : `<small>タップでスポットへ</small>`) +
        `</div><div class="km-chips">`;
      const _seenMap = ((state.player || {}).kurashi || {}).spotsSeen || {};
      area.spots.forEach(id => {
        const s = KONRON_SPOTS[id]; if (!s) return;
        if (!_kmHiddenOk(id)) return;   // ★T3 隠しスポット＝条件を満たすまで存在ごと見せない
        const c = KM_CATS[s.cat] || KM_CATS.port;
        const open = _kmSpotOpen(s);
        const _stamped = open && s.photo && _seenMap[id];
        body += `<button class="km-chip${open ? "" : " km-chip--locked"}${_stamped ? " km-chip--seen" : ""}" data-spot="${id}" style="--cc:${c.color}">` +
          `<span class="km-chip-ic">${open ? c.ic : "🔒"}</span>${s.name}${_stamped ? `<span class="km-chip-st">📷</span>` : ""}</button>`;
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
