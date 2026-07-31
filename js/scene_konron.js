// =========================================================================
// 🚶 歩いてまわる崑崙島（G2a 縦切り → G2b エリア拡張）
//   共通シーン基盤 js/scene_engine.js（設計書 §1）の上に乗るシーン。
//
//   ★設計の芯（GENERATIVE_3D_RPG_DIRECTIVE §3）
//   - スーファミRPGの探索＝タイル移動＋「調べる/話す/入る」＋見えない壁のない小さな箱庭。
//   - **新しい駅は作らない**：歩けるマップは「島時間」駅の新しい“入り方”であって、
//     既存機能の置き換えではない。従来のピン式（renderKonronMap）は不変のまま残す。
//   - 建物の入口に着いたら **中身は全部既存機能**へ渡す＝箱庭はただの導線。
//
//   G2b で足したもの：エリア3枚（港町→レース場→温泉郷）／時間帯パレット（_kmIslandNow連動）／
//   すれちがいNPC／ポロ随行（poroFound後）／隠しスポットの「？」（fail-closed）。
//
//   表示専用。レースの着順・オッズ・配当・所持コインには一切触れない。
// =========================================================================

const KW_COLS = 32, KW_ROWS = 24;
const KW_MAPW = 1920, KW_MAPH = 1440;
const KW_CW = KW_MAPW / KW_COLS, KW_CH = KW_MAPH / KW_ROWS;
const KW_V = "20260801j";

// ── エリア台帳。map は背景画（1920×1440）に対する当たり判定＝32×24のマス目。
//   '#'=入れない / '.'=歩ける。背景を10%グリッドで実測して起こし、赤塗り合成で突き合わせて是正した。
const KW_AREAS = {
  city: {
    name: "港町・市街", img: "images/scene/konron/city.webp",
    start: { c: 16, r: 11 },
    map: [
      "################################", // r0  上段＝倉庫と建物の屋根（入れない）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "################################", // r4
      "################################", // r5
      "################################", // r6  この帯の中央にモールのアーチ
      "################################", // r7
      "########....##....##############", // r8  広場の上端。アーチの真下まで行ける
      "########.##.###....#############", // r9  市場の露店（左列/右列）と、その間の小径
      "#####....##.###....#############", // r10 上の桟橋
      "#####....##.###....#############", // r11
      "########.##.###........#########", // r12 右手が開けて宿の前へ
      "########.##.###...##############", // r13 宿がはじまる
      "#####....##.###...##############", // r14 下の桟橋
      "#####....##.###...##############", // r15
      "######............##############", // r16 露店が終わって広場が横に広がる
      "######............##############", // r17
      "#########.####.........#########", // r18 見晴らし台／下の家／浜の椰子
      "#########.####.........#########", // r19
      "#########.####.........#########", // r20
      "#########.####.........#########", // r21
      "################################", // r22 下の石塀
      "################################", // r23
    ],
    doors: [
      { c: 14, r: 8, ic: "🏬", n: "崑崙モール", hint: "アーチをくぐる",
        go: function () { if (typeof renderMall === "function") renderMall(); } },
      { c: 11, r: 12, ic: "🍢", n: "霧待ち市場", hint: "屋台をのぞく", stay: true,
        go: function () { kwStall("🍢 霧待ち市場の立ち食い", ["t_nikuman", "t_ikayaki", "t_corn"]); } },
      // 撮影は**オーバーレイ**（pgOpen）＝画面遷移ではない。シーンを壊すと閉じた後に
      // キャンバスの無い抜け殻が残るので、この場に留まったまま上に開く（実機で踏んだ不具合）。
      { c: 9, r: 19, ic: "📷", n: "ミストラ湾の見晴らし台", hint: "写真をとる", stay: true,
        go: function () { kwShoot("mistra"); } },
      { c: 20, r: 18, ic: "🏨", n: "灯りの宿", hint: "声をかける", stay: true,
        go: function () { kwTalkKeeper(); } },
      { c: 5, r: 10, ic: "⛴️", n: "桟橋（島の地図へ）", hint: "船着き場から戻る",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
      { c: 21, r: 12, ic: "🏁", n: "レース場へつづく坂", hint: "坂をのぼる", area: "race" },
      // ★W6（2026-08-01）：大翼通り＝内陸の石造市街へ。林の奥の石段でつながる。
      { c: 22, r: 19, ic: "🏛️", n: "大翼通りへの石段", hint: "石段をのぼる", area: "town" },
      // ★T3 隠しスポット：条件を満たすまで**存在ごと見せない**（fail-closed）。
      { c: 17, r: 16, ic: "❓", n: "路地裏の気配", hint: "路地をのぞく", stay: true, hidden: "ura_bistro",
        go: function () { kwShoot("ura_bistro"); } },
    ],
    npcs: [
      { c: 15, r: 13, s: 0, line: "この広場はね、船が入る朝がいちばん騒がしいんだ。" },
      { c: 12, r: 17, s: 1, line: "市場の湯気、いい匂いでしょう。つい寄っちゃうのよね。" },
      { c: 7, r: 15, s: 2, line: "今日の海は凪だ。桟橋から山がよく見えるよ。" },
    ],
  },

  race: {
    name: "聖龍レース場・前庭", img: "images/scene/konron/race.webp",
    start: { c: 16, r: 17 },
    map: [
      "################################", // r0  客席・観覧席の外壁（走路には入れない）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "################################", // r4
      "################################", // r5
      "################################", // r6
      "################################", // r7
      "################################", // r8
      "################################", // r9
      "################################", // r10
      "################################", // r11
      "################################", // r12
      "################################", // r13 走路の下端＝屋台の列がはじまる
      "###...####################.#####", // r14 屋台と券売所の本体（c3-c5とc26だけ抜ける）
      "###......####...............####", // r15 屋台の前／c9-c12は券売所が一段せり出す
      "###.........................####", // r16 前庭の石畳
      "###.........................####", // r17
      "###############..###############", // r18 柵（c15-c16＝白い門）
      "########................########", // r19 門の外の石畳
      "##########............##########", // r20
      "###########..........###########", // r21 椰子のあいだの下り坂
      "#############......#############", // r22
      "################################", // r23
    ],
    doors: [
      { c: 16, r: 15, ic: "🏟️", n: "中央聖龍レース場", hint: "大門をくぐる",
        go: function () { if (typeof renderRaceSelect === "function") renderRaceSelect(); } },
      { c: 18, r: 19, ic: "📷", n: "大門前の眺め", hint: "写真をとる", stay: true,
        go: function () { kwShoot("racecourse"); } },
      { c: 21, r: 16, ic: "🍢", n: "場外の屋台", hint: "食べていく", stay: true,
        go: function () { kwStall("🍢 場外の屋台", ["t_yakitori", "t_dote", "t_dango"]); } },
      { c: 15, r: 22, ic: "🏙️", n: "港町へもどる坂", hint: "坂をくだる", area: "city" },
      { c: 27, r: 16, ic: "♨️", n: "温泉郷へつづく道", hint: "湯けむりの方へ", area: "onsen" },
      // ★W6：大翼通りの北門とつながる路地（town側の「レース場へつづく人波」と対）。
      { c: 23, r: 19, ic: "🏛️", n: "大翼通りへの路地", hint: "人波にまじる", area: "town" },
    ],
    npcs: [
      { c: 12, r: 16, s: 3, line: "ぼく、いつか自分の竜であそこを走るんだ！" },
      // ★W1（2026-08-01）：s:4 は `folk5.webp` を指すが**そのシートは納品されていない**。
      //   結果この予想屋だけ旧まとめシート(folk.webp)に落ち、①画風が違う ②正面コマしか無いので
      //   横に歩いても正面を向いたまま、という二重の粗になっていた（実測で確認）。
      //   → 既存シートへ付け替え。s:0＝羊角の老人（作務衣）は場慣れた予想屋の見えとして自然で、
      //     このエリアのもう一人（s:3＝キツネの子）とも被らない。
      //   ★村人の使い回しは既存設計と同じ頻度（s:1 と s:2 は既に3エリアで再利用されている）。
      //   ★6人目を本当に作るなら発注仕様は docs/CODEX_ORDER_WALK_SCOUT.md（288×384・3×3）。
      //     置くだけで自動的に読まれる（ここを s:4 に戻すだけ）＝任意の増補として残す。
      { c: 23, r: 16, s: 0, line: "本日の第一。荒れますよ、この風は。" },
    ],
  },

  onsen: {
    name: "ウロコトロ温泉郷", img: "images/scene/konron/onsen.webp",
    start: { c: 16, r: 12 },
    map: [
      "################################", // r0  竹林（外周は入れない）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "############..#####.############", // r4  湯屋のわきの小径（c12-c13）とc19の抜け道
      "############..#####.############", // r5
      "############........############", // r6  湯屋の前の土間
      "############.......#############", // r7
      "############.......#############", // r8
      "#########..........#############", // r9  板の渡り廊下（左から中央へ）
      "#########..........#############", // r10
      "#########........###############", // r11 c17より右は柵
      "#########..................#####", // r12 柵の下＝浜へつづく通り
      "#########.........##############", // r13
      "############.......#############", // r14 下の湯がはじまる
      "###############..###############", // r15 板の道が柵をまたぐ（ここだけ通れる）
      "###########........#############", // r16 下の広い土間
      "###########........#############", // r17
      "###########........#############", // r18 鳥居
      "###########........#############", // r19
      "###########........#############", // r20
      "###########.......##############", // r21
      "################################", // r22
      "################################", // r23
    ],
    doors: [
      { c: 12, r: 7, ic: "♨️", n: "湯けむりの露天", hint: "写真をとる", stay: true,
        go: function () { kwShoot("uroko"); } },
      { c: 17, r: 7, ic: "🍵", n: "休憩処", hint: "ひと息つく", stay: true,
        go: function () { kwStall("🍵 湯上がりの休憩処", ["t_amazake"]); } },
      { c: 19, r: 4, ic: "🏁", n: "レース場へもどる道", hint: "小径をもどる", area: "race" },
      { c: 25, r: 12, ic: "🏖️", n: "浜へくだる道", hint: "潮の匂いのする方へ", area: "beach" },
      { c: 10, r: 12, ic: "🏞️", n: "瀑布へくだる小径", hint: "水の音の方へ", area: "falls" },
      { c: 15, r: 20, ic: "🏝️", n: "鳥居をくぐって島の地図へ", hint: "この日の島時間をとじる",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
    ],
    npcs: [
      { c: 13, r: 9, s: 5, line: "湯にはね、負けた日ほど長く浸かるのがいいのよ。" },
      { c: 17, r: 17, s: 1, line: "ここのお湯、竜の鱗にも効くんですって。" },
    ],
  },

  beach: {
    name: "セナ浜", img: "images/scene/konron/beach.webp",
    start: { c: 13, r: 13 },
    map: [
      "################################", // r0  奥の椰子と流木（画面外扱い）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "################################", // r4
      "#########..#####################", // r5  波打ちぎわの細い砂（屋台の左）
      "#########..#####################", // r6
      "#########..#####################", // r7
      "#########..####....#############", // r8  小屋と小屋のあいだが抜ける
      "##########..###...##############", // r9
      "##########.........#############", // r10 屋台の前
      "##......................########", // r11 桟橋（ここだけ海に出られる）＋東の抜け道
      "##................##############", // r12
      "#########.........##############", // r13 まんなかの砂地
      "#########.........##############", // r14
      "#########.........##############", // r15
      "#########.........##############", // r16
      "#########.........##############", // r17
      "##########..............########", // r18 いちばん下の小屋の前
      "###########.............########", // r19
      "######................##########", // r20
      "###########.........############", // r21
      "###########.........############", // r22 島の地図へ抜ける砂道
      "################################", // r23
    ],
    doors: [
      { c: 3, r: 11, ic: "📷", n: "桟橋の先", hint: "写真をとる", stay: true,
        go: function () { kwShoot("sena"); } },
      { c: 12, r: 10, ic: "🍧", n: "かき氷の屋台", hint: "食べていく", stay: true,
        go: function () { kwStall("🍧 浜のかき氷屋", ["t_kakigori", "t_wataame", "t_takoyaki"]); } },
      { c: 23, r: 11, ic: "♨️", n: "温泉郷へもどる道", hint: "坂をのぼる", area: "onsen" },
      { c: 22, r: 18, ic: "🎣", n: "ホシウオ村への砂道", hint: "波止場の方へ", area: "fishing" },
      // ★W2 隠し：小屋のあいだから内陸へ抜ける道。かき氷を食べた人だけが果物の出どころを教わる。
      //   fail-closed（KM_HIDDEN.mango を満たすまで存在ごと出ない）。撮影はオーバーレイなので stay 必須。
      { c: 17, r: 8, ic: "❓", n: "小屋のあいだの小径", hint: "内陸へ入ってみる", stay: true, hidden: "mango",
        go: function () { kwShoot("mango"); } },
      { c: 14, r: 22, ic: "🏝️", n: "島の地図へ", hint: "この日の島時間をとじる",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
    ],
    npcs: [
      { c: 11, r: 14, s: 2, line: "この浜はな、夕方になると波の音がいちばん静かになる。" },
      { c: 20, r: 18, s: 3, line: "貝がら、いっぱい拾ったよ！　ほら、これ竜のかたち！" },
    ],
  },

  // ★W4-① ホシウオ村（浜から徒歩でつながる漁村）。散歩の行き先として作る＝独白と発見が本体。
  fishing: {
    name: "ホシウオ村", img: "images/scene/konron/fishing.webp",
    start: { c: 14, r: 19 },
    map: [
      "################################", // r0  入り江の水と大屋根（入れない）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "################################", // r4
      "################################", // r5
      "################################", // r6
      "########..........##############", // r7  大屋根の前の砂地
      "########..........##############", // r8
      "#####.............##############", // r9  上の桟橋（ここだけ海に出られる）
      "########.#######..##############", // r10 網ほし場と炭火の屋台
      "########.#######..##############", // r11
      "########.######..###############", // r12
      "########.#######.###############", // r13
      "#####......#####.###############", // r14 下の桟橋
      "########.........###############", // r15
      "########.###.....###############", // r16 かご置き場
      "########.###.....###############", // r17
      "##############.........#########", // r18 家のあいだの通り
      "##############.........#########", // r19
      "##############........##########", // r20
      "##############.......###########", // r21 浜へくだる砂道
      "################################", // r22
      "################################", // r23
    ],
    doors: [
      { c: 5, r: 9, ic: "📷", n: "桟橋の先", hint: "写真をとる", stay: true,
        go: function () { kwShoot("hoshiuo"); } },
      { c: 16, r: 11, ic: "🍢", n: "炭火の魚焼き", hint: "食べていく", stay: true,
        go: function () { kwStall("🍢 波止場の炭火焼き", ["t_ikayaki", "t_takoyaki", "t_corn"]); } },
      // ★W2 隠し：かご置き場の奥。イカ焼きを食べた人だけが「観光地図にない席」を教わる
      //   （スポット定義の line がまさにそう書いてある＝設定と条件が噛み合う）。fail-closed。
      { c: 14, r: 17, ic: "❓", n: "かごの奥の引き戸", hint: "のぞいてみる", stay: true, hidden: "ryoshimeshi",
        go: function () { kwShoot("ryoshimeshi"); } },
      { c: 20, r: 18, ic: "🍶", n: "波止場の一杯", hint: "のぞいてみる", stay: true,
        go: function () { kwToast("🍶 昼から一杯やってる漁師たち。……いい顔してるなあ。"); } },
      { c: 14, r: 21, ic: "🏖️", n: "浜へもどる砂道", hint: "波の音の方へ", area: "beach" },
      { c: 8, r: 7, ic: "🏝️", n: "島の地図へ", hint: "この日の島時間をとじる",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
    ],
    npcs: [
      { c: 12, r: 16, s: 2, line: "今朝はホシウオが跳ねたよ。銀色がいっぺんに、ぱーっとな。" },
      { c: 18, r: 19, s: 5, line: "網はね、繕うのが仕事の半分。座ってるように見えるだろ？" },
    ],
  },

  // ★W4-② ルミナ瀑布（温泉郷から徒歩）。滝つぼ・板の見晴らし台・丸太橋・山小屋。
  falls: {
    name: "ルミナ瀑布", img: "images/scene/konron/falls.webp",
    start: { c: 11, r: 17 },
    map: [
      "################################", // r0  滝と岩壁（入れない）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "################################", // r4
      "################################", // r5
      "################################", // r6
      "################################", // r7
      "################....############", // r8  板の見晴らし台（滝つぼの上に張り出す）
      "################....############", // r9
      "################....############", // r10
      "################............####", // r11 台をおりて山小屋の前へ
      "#############....##........#####", // r12 飛び石で流れをわたる
      "#####......................#####", // r13 丸太橋
      "#####.................##########", // r14
      "#####.............##############", // r15 ひらけた砂地
      "#####.............##############", // r16
      "#####.............##############", // r17
      "#####............###############", // r18
      "######..........################", // r19 温泉郷へのぼる道
      "################################", // r20
      "################################", // r21
      "################################", // r22
      "################################", // r23
    ],
    doors: [
      { c: 17, r: 9, ic: "📷", n: "滝つぼの見晴らし台", hint: "写真をとる", stay: true,
        go: function () { kwShoot("lumina"); } },
      { c: 25, r: 11, ic: "🛖", n: "きこりの山小屋", hint: "のぞいてみる", stay: true,
        go: function () { kwToast("🛖 薪の匂い。留守みたい……鍋だけ、まだあったかい。"); } },
      { c: 6, r: 18, ic: "♨️", n: "温泉郷へのぼる道", hint: "湯けむりの方へ", area: "onsen" },
      { c: 11, r: 19, ic: "🏝️", n: "島の地図へ", hint: "この日の島時間をとじる",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
    ],
    npcs: [
      { c: 9, r: 16, s: 1, line: "しぶきの虹、朝いちばんがいちばん濃いのよ。" },
      { c: 22, r: 12, s: 3, line: "丸太、すべるから気をつけてね。ぼくは三回落ちた。" },
    ],
  },

  // ── 大翼通り（7エリア目・2026-08-01 B案）─────────────────────────────
  // ★港町は27スポットあるのに歩いて触れるのが2つだけ＝「町の中が足りない」（ユーザー指摘）。
  //   島の地図にも描かれている内陸の石造市街を、歩ける2画面目として起こした。
  // ★背景の作り方（重要・再現手順）：文章プロンプト3バッチは全てアイソメ視点になり失敗。
  //   **city.webp を左に置いた21:9キャンバスの右側を nano_banana_pro に埋めさせる**
  //   （継ぎ足し方式）で、投影・縮尺・画風が一発で揃った。以後の増築も同じ手順を使うこと。
  // ★スポット結線＝ohzuba/hotel/admin/yosou（写真4枚とも実在確認済み）。tier2のarcade/loungeは
  //   次段（資産ゲートの見せ方を決めてから）。
  town: {
    name: "大翼通り", img: "images/scene/konron/town.webp",
    start: { c: 12, r: 11 },
    map: [
      "###################...##########", // r0  北門＝レース場へつづく道
      "###################...##########", // r1
      "###################...##########", // r2
      "###################...##########", // r3
      "###################...##########", // r4  石造家屋のならび（左2軒・右1軒）
      "###################...##########", // r5
      "###################...##########", // r6
      "###################...##########", // r7
      "###################...##########", // r8
      "###################...##########", // r9
      "#########..................#####", // r10 家々の前
      "..................####..........", // r11 大通り（西=広場へ・東=ホテル通り）・中央は噴水
      "..................####..........", // r12
      "#########.........####....######", // r13 噴水の南・あずまや前の小広場
      "#################.....##########", // r14 左=自治庁（列柱）・右=予想屋のあずまや
      "#################.....##########", // r15
      "#################.....##########", // r16
      "#################.....##########", // r17
      "#################.....##########", // r18
      "#################.....##########", // r19
      "#########.............##########", // r20 自治庁の前
      "##########............##########", // r21
      "##################....##########", // r22 南門＝島の地図へ
      "##################....##########", // r23
    ],
    doors: [
      { c: 1, r: 11, ic: "🏙️", n: "広場へもどる通り", hint: "市場の方へ", area: "city" },
      { c: 20, r: 1, ic: "🏁", n: "レース場へつづく人波", hint: "北門をぬける", area: "race" },
      { c: 15, r: 11, ic: "📷", n: "大翼通り", hint: "写真をとる", stay: true,
        go: function () { kwShoot("ohzuba"); } },
      { c: 30, r: 11, ic: "📷", n: "夕凪ホテル通りの眺め", hint: "写真をとる", stay: true,
        go: function () { kwShoot("hotel"); } },
      { c: 14, r: 20, ic: "🏛️", n: "崑崙自治庁", hint: "写真をとる", stay: true,
        go: function () { kwShoot("admin"); } },
      { c: 21, r: 17, ic: "📋", n: "予想屋小路", hint: "のぞいてみる", stay: true,
        go: function () { kwShoot("yosou"); } },
      { c: 19, r: 22, ic: "🏝️", n: "島の地図へ", hint: "この日の島時間をとじる",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
    ],
    npcs: [
      { c: 11, r: 12, s: 1, line: "お役所も、レース局も、ぜんぶこの通りの住人よ。かたい街に見えて、なかは下町なの。" },
      { c: 22, r: 12, s: 3, line: "北の門をぬけるとレース場！ 今日はだれが勝つかなあ。" },
    ],
  },
};

// 背景の実測がまだのエリア用の安全な既定枠（外周を壁にした広間＝落ちない・進める）
const KW_FALLBACK_MAP = (function () {
  const rows = [];
  for (let r = 0; r < KW_ROWS; r++) {
    let s = "";
    for (let c = 0; c < KW_COLS; c++) s += (r < 8 || r > 21 || c < 4 || c > 27) ? "#" : ".";
    rows.push(s);
  }
  return rows;
})();

let KW = null;   // 現在のシーン状態（表示専用）

function kwArea() { return (KW && KW.area) || KW_AREAS.city; }
function kwMap() { const a = kwArea(); return a.map || KW_FALLBACK_MAP; }
function kwCell(c, r) {
  if (c < 0 || r < 0 || c >= KW_COLS || r >= KW_ROWS) return "#";
  const row = kwMap()[r];
  return row ? (row[c] || "#") : "#";
}
function kwBlocked(wx, wy) { return kwCell(Math.floor(wx / KW_CW), Math.floor(wy / KW_CH)) === "#"; }

// 隠しスポットは条件を満たすまで**存在ごと出さない**（副作用のある _kmHiddenOk ではなく生の条件を見る）
function kwDoorVisible(d) {
  if (!d.hidden) return true;
  try { const h = (typeof KM_HIDDEN !== "undefined") && KM_HIDDEN[d.hidden]; return !!(h && h.cond()); }
  catch (e) { return false; }
}
function kwDoors() { return (kwArea().doors || []).filter(kwDoorVisible); }
function kwDoorAt(wx, wy) {
  const c = Math.floor(wx / KW_CW), r = Math.floor(wy / KW_CH);
  return kwDoors().find(d => Math.abs(d.c - c) <= 1 && Math.abs(d.r - r) <= 1) || null;
}

// ── 時間帯パレット（_kmIslandNow と連動＝島の一日と歩く景色をそろえる）
const KW_TINT = {
  "未明":   { col: "#1b2b55", a: 0.42, mode: "multiply" },
  "朝":     { col: "#ffe9c2", a: 0.14, mode: "source-over" },
  "昼":     { col: "#fff6e0", a: 0.05, mode: "source-over" },
  "夕暮れ": { col: "#ff9a4d", a: 0.22, mode: "source-over" },
  // ★ブルームが「灯りだけ」を拾うようになったので、夜はもう一段沈められる
  //   （前は全体が光っていたため、暗くしても加算で打ち消されていた）。
  //   夜らしさは暗さそのものではなく、**灯りとの落差**で出る。
  "宵":     { col: "#4a2f6b", a: 0.38, mode: "multiply" },
  "夜":     { col: "#101a3e", a: 0.56, mode: "multiply" },
};
function kwNow() {
  try { return (typeof _kmIslandNow === "function") ? _kmIslandNow() : { k: "昼", ic: "☀️" }; }
  catch (e) { return { k: "昼", ic: "☀️" }; }
}

function kwShoot(id) {
  if (typeof _kmStartShoot === "function") _kmStartShoot(id);
  else kwToast("📷 いまは撮れない。");
}
// 宿の人の一言＝門番を通す（未登場のキャラの名前は出さない）
function kwTalkKeeper() {
  const met = (typeof rpgKeeperMet === "function" && rpgKeeperMet());
  const who = met ? "スミカ" : "宿の人";
  const line = met
    ? "ミミ様。おかえりなさいませ。——港のほうが、今日はにぎやかですわ。"
    : "いらっしゃい。ここらは歩いて回れるからね、ゆっくりしていきな。";
  kwToast("🏨 " + who + "「" + line + "」");
}
function kwToast(msg) {
  if (!KW || !KW.hud) return;
  const n = KW.hud.querySelector(".kw-toast");
  if (!n) return;
  n.textContent = msg;
  n.classList.add("on");
  clearTimeout(KW._toastT);
  KW._toastT = setTimeout(() => n.classList.remove("on"), 3600);
}

function kwExit() {
  if (KW && KW.scene) { try { KW.scene.destroy(); } catch (e) {} }
  KW = null;
}

// ── 散歩のおわり。「きょうの散歩」を一枚だけ見せてから島の地図へ。
//   点数もごほうびも付けない（付けた瞬間に散歩が作業になる）。見たものを並べるだけ。
function kwWalkEnd() {
  const steps = Math.round((KW && KW.steps) || 0);
  const found = (KW && KW.found) || [];
  const met = KW ? Object.keys(KW.met || {}).length : 0;
  const areaNm = (KW && KW.area) ? KW.area.name : "崑崙島";
  const now = kwNow();
  kwExit();
  if (typeof renderKonronMap === "function") renderKonronMap();
  if (steps < 6 && !found.length && !met) return;                 // ほとんど歩いていない＝黙って戻る
  const ov = document.createElement("div"); ov.className = "navpop-ov";
  const box = document.createElement("div"); box.className = "navpop kw-end";
  let h = '<h3 class="navpop-h">' + now.ic + " きょうの散歩</h3>" +
          '<p class="navpop-sub">' + areaNm + "・" + now.k + "／" + steps + " 歩" +
          (met ? "、" + met + " 人と立ち話" : "") + "。</p>";
  if (found.length) {
    h += '<div class="kw-end-list">' + found.map(function (f) { return "<div>" + f + "</div>"; }).join("") + "</div>";
  } else {
    h += '<p class="kw-end-none">とくに何も拾わなかった。……そういう日も、ある。</p>';
  }
  box.innerHTML = h;
  const btns = document.createElement("div"); btns.className = "navpop-btns";
  const ok = document.createElement("button"); ok.className = "navpop-go"; ok.textContent = "ごちそうさま";
  ok.onclick = function () { ov.remove(); };
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box);
  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

// ── 帰り道（★迷子にしない）
//   入口から食事やモールへ渡すと、渡した先には「歩く画面へ戻る」導線が無く、**戻れなくなる**
//   （ユーザー報告：食べ歩きに入ったきり歩く画面に帰れない）。渡す直前に居場所を控えておいて、
//   行った先の画面に小さなボタンを出す。ホーム／タイトルまで下りたら「島を出た」とみなして消す。
let KW_RETURN = null, KW_RETURN_TIMER = 0;
function kwMarkReturn() {
  if (!KW || !KW.mimi) return;
  KW_RETURN = { area: KW.areaId || "city", x: KW.mimi.x, y: KW.mimi.y };
  let b = document.getElementById("kw-return");
  if (!b) {
    b = document.createElement("button");
    b.id = "kw-return"; b.className = "kw-return";
    b.innerHTML = '<span class="kw-return-ic">🚶</span>歩く画面にもどる';
    b.onclick = function () {
      const r = KW_RETURN; kwReturnClear();
      if (r && typeof renderKonronWalk === "function") renderKonronWalk(r.area, r);
    };
    document.body.appendChild(b);
  }
  b.hidden = false;
  clearInterval(KW_RETURN_TIMER);
  KW_RETURN_TIMER = setInterval(function () {
    const s = (typeof state !== "undefined" && state.ui) ? state.ui.screen : "";
    if (s === "home" || s === "title" || s === "konron_walk") kwReturnClear();
  }, 500);
}
function kwReturnClear() {
  KW_RETURN = null;
  clearInterval(KW_RETURN_TIMER); KW_RETURN_TIMER = 0;
  const b = document.getElementById("kw-return"); if (b) b.remove();
}
// エリア移動＝シーンを作り直す（設計書 §2「入場でロード／退場で破棄」に従う）
function kwGo(areaId) { kwExit(); renderKonronWalk(areaId); }

// ── 画面：歩いてまわる（β）
function renderKonronWalk(areaId, at) {
  if (typeof konronMapUnlocked === "function" && !konronMapUnlocked()) { renderKonronMap(); return; }
  if (typeof Scene === "undefined" || !Scene.create) { renderKonronMap(); return; }
  const area = KW_AREAS[areaId] || KW_AREAS.city;
  const areaKey = KW_AREAS[areaId] ? areaId : "city";
  // 戻ってきた時は**出て行った場所に立たせる**（毎回スタート地点に飛ばされると歩き直しになる）
  const resume = (at && at.area === areaKey) ? { x: at.x, y: at.y } : null;
  state.ui.screen = "konron_walk";
  const app = beginScreen();
  app.classList.add("kw-page");

  const now = kwNow();
  const hud = document.createElement("div");
  hud.className = "kw-hud";
  hud.innerHTML =
    '<button class="kw-back">← 島の地図へ</button>' +
    '<div class="kw-title">🚶 ' + area.name + 'を散歩 <span class="kw-beta">β</span></div>' +
    '<div class="kw-when">' + now.ic + " " + now.k + "</div>" +
    '<div class="kw-toast"></div>' +
    '<div class="kw-prompt"></div>';
  app.appendChild(hud);
  hud.querySelector(".kw-back").onclick = () => { kwWalkEnd(); };

  const stage = document.createElement("div");
  stage.className = "kw-stage";
  app.appendChild(stage);

  // ★結線漏れの修正（Q-4・2026-08-01）：`mimi_walk_tarzan.webp` は納品済みなのに
  //   コードから一度も参照されていなかった（tarzan画像7枚すべてが孤児だった）。
  //   買った服が島を歩く自分に出る＝「買ったものが見える」いちばん素直な見返り。
  //   ★シートは 288×384 で既定シートと同一レイアウト＝差し替えるだけでコマ割りは不変（実測確認済み）。
  //   ★衣装が増えたらこの表に1行足すだけ。載っていない衣装は既定シートに落ちる（fail-safe）。
  const KW_WALK_SHEET = { tarzan: "mimi_walk_tarzan.webp" };
  const _kwFit = (typeof currentOutfitId === "function") ? currentOutfitId() : "";
  const imgs = {
    bg: area.img + "?v=" + KW_V,
    mimi: "images/scene/konron/" + (KW_WALK_SHEET[_kwFit] || "mimi_walk.webp") + "?v=" + KW_V
  };
  imgs.folk = "images/scene/konron/folk.webp?v=" + KW_V;                    // 旧・1枚まとめシート（新シートが欠けた時の受け皿）
  // ★このエリアに出る村人ぶんだけ読む（6人ぶん常に読むと無駄が大きい）。欠けたら null＝旧シートへ落ちる。
  (area.npcs || []).forEach(function (n) {
    const k = "folk" + ((n.s | 0) + 1);
    imgs[k] = "images/scene/konron/" + k + ".webp?v=" + KW_V;
  });
  // ★入口の道標も、このエリアで使う絵柄ぶんだけ。欠けたら手続き描画の灯りに落ちる。
  (area.doors || []).forEach(function (d) {
    const s = KW_SIGN[d.hidden ? "❓" : d.ic];
    if (s) imgs["sg_" + s] = "images/scene/konron/props/" + s + ".webp?v=" + KW_V;
  });
  if (typeof poroFound === "function" && poroFound()) imgs.poro = "images/scene/konron/poro_walk.webp?v=" + KW_V;

  const scene = Scene.create({
    mount: stage,
    assets: { images: imgs },
    onLoad: function (a, S) { kwSetup(a, S); },
    onUpdate: function (dt, S) { kwUpdate(dt, S); },
    onDraw: function (ctx, cam, layer, S, t) { kwDraw(ctx, cam, layer, S, t); },
    onAct: function () { kwAct(); },
    // ★自分のシーンのぶんだけ片付ける。前のシーンの掃除係（900ms間隔）は、こちらが新しく開いた
    //   あとから発火することがある。無条件に KW=null すると**新しい方の状態が消されて**
    //   十字キーだけ残った真っ黒な画面になる（歩く→ホーム→すぐ歩く で再現した）。
    onExit: function () { if (KW && KW.scene === scene) KW = null; },
  });

  KW = { scene: scene, hud: hud, area: area, areaId: areaKey, resume: resume,
         mimi: null, near: null, dir: 0, step: 0, moving: false, trail: [], npcs: [] };
}

function kwSetup(a, S) {
  if (!KW) return;
  const ar = KW.area, st = ar.start || { c: 16, r: 11 };
  KW.mimi = (KW.resume && !kwBlocked(KW.resume.x, KW.resume.y))
    ? { x: KW.resume.x, y: KW.resume.y }                  // 用事から帰ってきた＝出て行った場所へ
    : { x: (st.c + 0.5) * KW_CW, y: (st.r + 0.5) * KW_CH };
  if (kwBlocked(KW.mimi.x, KW.mimi.y)) {                 // 万一ふさがっていたら近くの歩ける所へ逃がす
    outer: for (let r = 8; r < KW_ROWS; r++) for (let c = 0; c < KW_COLS; c++) {
      if (kwCell(c, r) === ".") { KW.mimi = { x: (c + 0.5) * KW_CW, y: (r + 0.5) * KW_CH }; break outer; }
    }
  }
  KW.sheet = a.mimi || null;
  KW.bg = a.bg || null;
  kwBakeAir(KW.bg);        // ★HD-2Dの「奥行きの版」と「光の版」をここで1回だけ焼く（毎フレームは重い）
  KW.folk = a.folk || null;
  KW.poroImg = a.poro || null;
  KW.signs = a;                                          // 道標は a.sg_<name> で引く（無ければ灯り）
  KW.trail = [];
  // ★散歩の道具立て：きらめき（寄り道の理由）／ひとりごと（立ち止まる理由）／歩数と見つけたもの
  KW.spark = [];
  const finds = (KW_FINDS[KW.areaId] || []).slice();
  const spots = [];
  for (let r = 0; r < KW_ROWS; r++) for (let c = 0; c < KW_COLS; c++) if (kwCell(c, r) === ".") spots.push([c, r]);
  for (let k = 0; k < 4 && spots.length && finds.length; k++) {
    const p = spots.splice((Math.random() * spots.length) | 0, 1)[0];
    const t = finds.splice((Math.random() * finds.length) | 0, 1)[0];
    if (Math.hypot((p[0] + 0.5) * KW_CW - KW.mimi.x, (p[1] + 0.5) * KW_CH - KW.mimi.y) < 120) { k--; continue; }
    KW.spark.push({ x: (p[0] + 0.5) * KW_CW, y: (p[1] + 0.5) * KW_CH, txt: t });
  }
  KW.found = []; KW.steps = 0; KW.idle = 0; KW.lastMuse = -1; KW.met = {};
  // すれちがいNPC＝歩ける範囲をゆっくり気ままに歩く
  KW.npcs = (ar.npcs || []).map(function (n) {
    const s = n.s | 0;
    return { x: (n.c + 0.5) * KW_CW, y: (n.r + 0.5) * KW_CH, s: s, line: n.line,
             // 専用シート（3列×3行）。未納品なら null＝旧・1枚まとめシートで描く。
             sheet: a["folk" + (s + 1)] || null,
             dir: 0, face: 1,
             vx: 0, vy: 0, wait: Math.random() * 2, step: Math.random() * 4 };
  });
}

// ワールド→画面のスケール：横に約760ワールドpx見える＝キャラと建物の対比がSNESの町らしくなる
function kwScale(S) { return Math.max(0.28, S.vw / 760); }

function kwUpdate(dt, S) {
  if (!KW || !KW.mimi) return;
  // ★歩く速さ＝1マス(60px)を約0.18秒。210だと「移動そのものが待ち時間」になっていた（ユーザー指摘）。
  const sp = 330 * dt;                                    // ワールドpx/秒
  const i = S.input;
  let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
  let dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }           // 斜めが速くならない
  KW.moving = !!(dx || dy);
  if (dy < 0) KW.dir = 1; else if (dy > 0) KW.dir = 0; else if (dx) KW.dir = 2;
  KW.face = dx < 0 ? -1 : (dx > 0 ? 1 : (KW.face || 1));

  // 軸ごとに判定＝壁ぞいに滑れる。さらに**角ずらし**：まっすぐ進めない時、ほんの少し横へ
  //   寄れば通れるなら勝手に寄る。1マス幅の抜け道（門・板の道）に真横から入ろうとして
  //   引っかかり続けるのを無くす＝「道に詰まる」の実体（ユーザー指摘）。
  const m = KW.mimi;
  const A = 17;                                           // 寄せてみる幅（マスの約1/4）
  if (dx) {
    const nx = m.x + dx * sp;
    if (!kwBlocked(nx, m.y)) m.x = nx;
    else if (!kwBlocked(nx, m.y - A) && !kwBlocked(m.x, m.y - A)) m.y -= Math.min(A, sp);
    else if (!kwBlocked(nx, m.y + A) && !kwBlocked(m.x, m.y + A)) m.y += Math.min(A, sp);
  }
  if (dy) {
    const ny = m.y + dy * sp;
    if (!kwBlocked(m.x, ny)) m.y = ny;
    else if (!kwBlocked(m.x - A, ny) && !kwBlocked(m.x - A, m.y)) m.x -= Math.min(A, sp);
    else if (!kwBlocked(m.x + A, ny) && !kwBlocked(m.x + A, m.y)) m.x += Math.min(A, sp);
  }
  m.x = Math.max(4, Math.min(KW_MAPW - 4, m.x));
  m.y = Math.max(4, Math.min(KW_MAPH - 4, m.y));

  KW.step = KW.moving ? (KW.step + dt * 7.5) : 0;

  // ── 散歩①：歩数（あとで「きょうの散歩」に出す）
  if (KW.moving) KW.steps += sp / KW_CW;

  // ── 散歩②：立ち止まると、ミミが目の前のものについてひとりごとを言う。
  //   「早く着く」ことに価値を置かない代わりに、**止まっている時間に中身を持たせる**のが散歩の芯。
  if (KW.moving) { KW.idle = 0; }
  else {
    KW.idle += dt;
    if (KW.idle > 1.3) {
      KW.idle = -6.5;                                    // 次の一言まで少し間を置く（うるさくしない）
      const pool = (KW_MUSE[KW.areaId] || []).concat(KW_MUSE_TIME[kwNow().k] || []);
      if (pool.length) {
        let i = (Math.random() * pool.length) | 0;
        if (i === KW.lastMuse) i = (i + 1) % pool.length; // 同じ文を続けない
        KW.lastMuse = i;
        kwToast("💭 " + pool[i]);
      }
    }
  }

  // ── 散歩③：きらめきに寄ると、役に立たないものが見つかる（コインも進行も動かさない）
  for (let s = KW.spark.length - 1; s >= 0; s--) {
    const sp2 = KW.spark[s];
    if (Math.hypot(sp2.x - m.x, sp2.y - m.y) < 34) {
      KW.spark.splice(s, 1);
      KW.found.push(sp2.txt);
      kwToast(sp2.txt);
      try { if (window.Sfx) Sfx.play("nav"); } catch (e) {}
    }
  }

  // ポロ随行＝足あとを溜めて、少し遅れて同じ道をついてくる（poroFound後のみ）。
  //   ★足あとは「フレーム」ではなく「距離」で刻む。壁に押しつけている間は進んでいないので、
  //     フレームで刻むと同じ座標が溜まってポロがミミに重なってしまう（実機で踏んだ）。
  if (KW.poroImg) {
    const last = KW.trail[KW.trail.length - 1];
    if (!last || Math.hypot(m.x - last.x, m.y - last.y) > 7) {
      KW.trail.push({ x: m.x, y: m.y, d: KW.dir, f: KW.face });
      if (KW.trail.length > 13) KW.trail.shift();          // 13点×7px ≒ 90px ぶん後ろをついてくる
    }
    KW.poro = (KW.trail.length >= 13) ? KW.trail[0] : null;
  }

  // NPC＝気ままに一歩ずつ。壁とマップ外には入らない
  for (let k = 0; k < KW.npcs.length; k++) {
    const n = KW.npcs[k];
    // ★近づいたら**立ち止まってミミの方を向く**。話しかけようとした相手が歩いて逃げるのは
    //   ただのストレスで、追いかけっこをさせたいわけではない（ユーザー指摘）。
    if (Math.abs(n.x - m.x) < KW_CW * 2.0 && Math.abs(n.y - m.y) < KW_CH * 2.0) {
      n.vx = 0; n.vy = 0; n.wait = Math.max(n.wait, 0.5);
      const ax = m.x - n.x, ay = m.y - n.y;
      if (Math.abs(ax) > Math.abs(ay)) { n.dir = 2; n.face = ax < 0 ? -1 : 1; }
      else n.dir = ay < 0 ? 1 : 0;
      continue;
    }
    n.wait -= dt;
    if (n.wait <= 0) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
      const p = dirs[(Math.random() * dirs.length) | 0];
      n.vx = p[0]; n.vy = p[1];
      n.wait = 0.9 + Math.random() * 1.8;
    }
    if (n.vx || n.vy) {
      const s2 = 52 * dt;
      const nx = n.x + n.vx * s2, ny = n.y + n.vy * s2;
      if (!kwBlocked(nx, n.y)) n.x = nx; else n.vx = 0;
      if (!kwBlocked(n.x, ny)) n.y = ny; else n.vy = 0;
      n.step += dt * 5;
      // 進む向きへ体を向ける（ミミと同じ規約＝0正面 1背中 2横・横は左向き素材）
      if (n.vy < 0) n.dir = 1; else if (n.vy > 0) n.dir = 0; else if (n.vx) n.dir = 2;
      if (n.vx) n.face = n.vx < 0 ? -1 : 1;
    }
  }

  // カメラ＝ミミを中心に、地図の外は見せない。★ぴったり張りつかせず少し遅れて追う＝歩きがやわらぐ。
  const sc = kwScale(S), vw = S.vw / sc, vh = S.vh / sc;
  const tx = Math.max(0, Math.min(Math.max(0, KW_MAPW - vw), m.x - vw / 2));
  const ty = Math.max(0, Math.min(Math.max(0, KW_MAPH - vh), m.y - vh / 2));
  const k = S.reduce ? 1 : Math.min(1, dt * 7.5);
  S.camera.x = (S.camera.x || S.camera.x === 0) ? S.camera.x + (tx - S.camera.x) * k : tx;
  S.camera.y = (S.camera.y || S.camera.y === 0) ? S.camera.y + (ty - S.camera.y) * k : ty;
  S.camera.sc = sc; S.camera.vw = vw; S.camera.vh = vh;

  // いちばん近いもの（入口 or NPC）→プロンプト
  let target = kwDoorAt(m.x, m.y), kind = "door";
  if (!target) {
    const n = KW.npcs.find(n2 => Math.abs(n2.x - m.x) < KW_CW * 1.1 && Math.abs(n2.y - m.y) < KW_CH * 1.1);
    if (n) { target = n; kind = "npc"; }
  }
  if (target !== KW.near) {
    KW.near = target; KW.nearKind = kind;
    const p = KW.hud && KW.hud.querySelector(".kw-prompt");
    if (p) {
      if (target && kind === "door") {
        p.innerHTML = '<span class="kw-p-ic">' + target.ic + "</span><b>" + target.n + "</b><small>🔍 で" + target.hint + "</small>";
        p.classList.add("on");
      } else if (target) {
        p.innerHTML = '<span class="kw-p-ic">💬</span><b>島の人</b><small>🔍 で話しかける</small>';
        p.classList.add("on");
      } else p.classList.remove("on");
    }
  }
}

function kwAct() {
  if (!KW || !KW.near) { kwToast("🔍 ……とくに何もない。"); return; }
  const d = KW.near;
  try { if (window.Sfx) Sfx.play("nav"); } catch (e) {}
  if (KW.nearKind === "npc") { KW.met[d.s] = 1; kwToast("💬 「" + d.line + "」"); return; }
  if (d.area) { kwGo(d.area); return; }                  // エリア移動
  if (d.stay) { try { d.go(); } catch (e) {} return; }   // その場に留まる（オーバーレイ／一言）
  // ★ここから先は**歩く画面が終わる**（ユーザー指摘：黙って画面が変わると迷子になる）。
  //   実測すると入口34件のうち、画面が変わるのは7件だけ（17件はその場のオーバーレイ、
  //   10件はエリア間の徒歩移動）。**その7件にだけ**行き先を予告して同意を取る。
  //   stay とエリア移動には出さない＝毎回確認させて歩きのテンポを殺さないため。
  kwConfirmLeave(d);
}

// 島歩きを抜ける入口の予告。「どこへ行くか」を名指しし、やめて歩きに戻る道も残す。
function kwConfirmLeave(d) {
  const goNow = function () {
    // ★別画面へ渡す前に居場所を控える＝行った先に「歩く画面にもどる」が出る（戻れなくならない）。
    //   島の地図へ抜ける入口は「島時間を閉じる」意図なので控えない。
    if (!/島の地図/.test(d.n || "")) kwMarkReturn(); else kwReturnClear();
    kwExit();
    try { d.go(); } catch (e) { if (typeof renderKonronMap === "function") renderKonronMap(); }
  };
  // ★載せ先は `.kw-stage`（position:relative）。HUD の親は app なので、そこに載せると
  //   ページ全体に対して位置が決まってしまう（実測して気づいた）。
  const stage = (typeof document !== "undefined") ? document.querySelector(".kw-stage") : null;
  if (!stage) { goNow(); return; }   // 出せない環境では素通し（fail-open＝移動を止めない）
  const toMap = /島の地図/.test(d.n || "");
  const dest = toMap ? "島の地図" : (d.n || "つぎの場所");
  const ov = document.createElement("div");
  ov.className = "kw-leave-ov";
  ov.innerHTML =
    '<div class="kw-leave">' +
      '<div class="kw-leave-ic">' + (d.ic || "🚪") + '</div>' +
      '<div class="kw-leave-t">島歩きを終わって<br><b>' + dest + '</b>へ移動します</div>' +
      '<div class="kw-leave-s">' + (toMap ? "この日の島時間をとじます。" : "歩く画面には、行った先の「🚶 歩く画面にもどる」から戻れます。") + '</div>' +
      '<div class="kw-leave-btns">' +
        '<button class="kw-leave-no" type="button">まだ歩く</button>' +
        '<button class="kw-leave-go" type="button">移動する ▶</button>' +
      '</div>' +
    '</div>';
  const close = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
  ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
  ov.querySelector(".kw-leave-no").onclick = close;
  ov.querySelector(".kw-leave-go").onclick = function () { close(); goNow(); };
  stage.appendChild(ov);
  // キーでも決められる（Enter=移動 / Esc=やめる）。歩きの操作を奪ったままにしない。
  const onKey = function (e) {
    if (!ov.parentNode) { window.removeEventListener("keydown", onKey, true); return; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); close(); goNow(); }
  };
  window.addEventListener("keydown", onKey, true);
  setTimeout(function () { try { ov.querySelector(".kw-leave-go").focus(); } catch (e) {} }, 30);
}

// ── 屋台＝**その場に在るものだけ**出す（★設計の直し）
//   入口を押すと食べ歩き帳（44品ぜんぶ）が開いていた。目の前の屋台に立っているのに
//   島じゅうの品が何でも食べられるのは、歩いている意味を消す嘘だった（ユーザー指摘）。
//   ここでは「並んでいる品」だけを見せ、実食の中身（値段・おなか・反応）は
//   既存の showMealDetail にそのまま渡す＝経済も判定も一切変えない。
function kwStall(title, ids) {
  if (typeof MEALS === "undefined" || typeof showMealDetail !== "function") {
    if (typeof renderMeals === "function") { kwMarkReturn(); kwExit(); renderMeals(); }
    return;
  }
  const items = ids.map(function (id) { return MEALS.find(function (m) { return m.id === id; }); })
                   .filter(Boolean);
  if (!items.length) { kwToast("🍽️ ……今日はもう店じまいらしい。"); return; }
  const ov = document.createElement("div"); ov.className = "navpop-ov";
  const box = document.createElement("div"); box.className = "navpop kw-stall";
  const close = function () { ov.remove(); };
  let html = '<h3 class="navpop-h">' + title + "</h3>" +
             '<p class="navpop-sub">きょう並んでいるのは、この' + items.length + "品。</p>" +
             '<div class="meal-grid kw-stall-grid">';
  items.forEach(function (m) {
    const got = (typeof mealEaten === "function") && mealEaten(m.id);
    const price = (typeof mealPrice === "function") ? mealPrice(m) : 0;
    html += '<button class="meal-card' + (got ? " got" : "") + '" data-id="' + m.id + '">' +
            '<span class="meal-card-ic">' + m.icon + "</span>" +
            '<span class="meal-card-nm">' + m.name +
            (price ? '<span class="meal-card-price">🪙' + price.toLocaleString("ja-JP") + "</span>" : "") +
            "</span></button>";
  });
  html += "</div>";
  box.innerHTML = html;
  const btns = document.createElement("div"); btns.className = "navpop-btns";
  const bookBtn = document.createElement("button");
  bookBtn.className = "navpop-cancel"; bookBtn.textContent = "📖 食べ歩き帳を開く";
  bookBtn.onclick = function () { close(); kwMarkReturn(); kwExit(); if (typeof renderMeals === "function") renderMeals(); };
  const back = document.createElement("button");
  back.className = "navpop-cancel"; back.textContent = "また今度";
  back.onclick = close;
  btns.appendChild(bookBtn); btns.appendChild(back); box.appendChild(btns);
  box.querySelectorAll(".meal-card").forEach(function (c) {
    c.onclick = function () {
      const m = items.find(function (x) { return x.id === c.getAttribute("data-id"); });
      if (m) showMealDetail(m);                 // ★実食の中身は既存のまま（値段・おなか・反応・満腹）
    };
  });
  ov.appendChild(box);
  ov.onclick = function (e) { if (e.target === ov) close(); };
  document.body.appendChild(ov);
}

// =========================================================================
// 🌿 散歩の芯（ユーザー決裁：歩くモードは主導線から外し、**散歩そのものを目的**にする）
//   移動手段としては要らない（ピンを押せば一瞬で行ける）。だから「早く着く」を competing させず、
//   **立ち止まると気づく／寄り道するとささやかに何か見つかる**だけの時間にする。
//   見つかるのは役に立たないものばかり＝コインも進行も動かさない（数値非干渉）。
// =========================================================================

// ① 立ち止まると出る、ミミのひとりごと。歩き出すと消える。同じ文は続けて出さない。
const KW_MUSE = {
  city: ["潮の匂い。……港って、朝もお昼も、ずっと働いてるなあ。",
         "石畳、ところどころ丸くなってる。何人ぶんの足だろ。",
         "干した網のむこうで、猫がのびをした。",
         "屋台の湯気って、なんであんなに、おいでおいでって感じなんだろ。",
         "遠くで船の鐘。……もう一便、出るのかな。"],
  race: ["風、砂を運んでくる。……走る日の匂いだ。",
         "だれもいない走路。ここ、いつも音でいっぱいなのにな。",
         "旗がぱたぱた鳴ってる。それだけで、ちょっと胸がはやる。",
         "屋台のおじさん、もう仕込みしてる。早いなあ。",
         "柵にもたれて、しばらく見てるだけの時間。……こういうのも、悪くない。"],
  onsen: ["湯けむりが、竹の上をゆっくり越えていく。",
          "石のふち、あったかい。ここに座ってる人、絶対いる。",
          "しゅわ……って音がずっとしてる。お湯って、しゃべってるみたい。",
          "鳥居の赤、湯気ににじんできれい。",
          "肩の力、勝手にぬけてく。……ふう。"],
  beach: ["波の音って、近づくと大きいのに、うるさくない。ふしぎ。",
          "砂、さっきより冷たい。日がかたむいてきたのかも。",
          "桟橋の板、一枚だけ音が違う。……この板、好きかも。",
          "小屋のかげ、風がすずしい。ちょっとだけ、ここにいよう。",
          "足あと、波が消してく。それも、なんかいい。"],
  fishing: ["網のにおい。……しょっぱいのに、なんかあったかい。",
            "船が三つ。どれも名前が彫ってある。だれかの自慢なんだ。",
            "炭のはぜる音。魚が焼けるまで、みんな黙ってる。",
            "干した網ごしに海を見ると、世界が四角くなる。",
            "ここの人たち、歩くのがゆっくり。急ぐ理由がないんだって顔。"],
  falls: ["水の音って、こんなに大きいのに、しずかって感じる。",
          "しぶきが顔にかかる。……つめたっ。でも、もう一歩ちかづきたい。",
          "苔の丸太。踏むと、きゅっと鳴った。",
          "滝の裏、暗くて見えない。なにかいそうで、いなさそう。",
          "水の音しかしない場所。耳が、だんだん静かになってく。"],
};
const KW_MUSE_TIME = {
  朝: ["朝の光、まだやわらかい。", "空気がしゃんとしてる。今日、いい日かも。"],
  昼: ["日ざしがまっすぐ。影がちいさい。", "お腹すいたな……なんて、まだ早いか。"],
  夕: ["ぜんぶ、あめ色になってきた。", "夕方の風は、ちょっとだけ、さみしい匂いがする。"],
  夜: ["灯りがぽつぽつ。夜の島って、こんなに静かなんだ。", "星、見えるかな。……見えた。"],
};
// ② 寄り道で見つかるもの（きらめき）。役に立たないものだけ＝集めても何も強くならない。
const KW_FINDS = {
  city: ["🐚 白い貝がら。港なのに、なんでここに？", "🐈 日なたで寝てる猫。起こさないように、そっと。",
         "🪵 削りかけの木くず。だれかの仕事のとちゅう。", "🌼 石のすきまに、ちいさい花。",
         "🎣 ほどけた釣り糸。結び目のかたちが、きれい。", "🍋 転がってた柑橘。いい匂いだけ、もらった。"],
  race: ["🎫 風に飛ばされた古い馬券……じゃなくて、竜券。", "🪶 柵にひっかかった羽根。だれの？",
         "🌾 走路のはじの、しぶとい草。", "🔔 落ちてた小さな鈴。ちりん。",
         "🧢 忘れ物の帽子。……あとで届けよう。", "🍡 だんごの串。だれか、ここで食べたんだ。"],
  onsen: ["🍃 湯に浮かんだ葉っぱ。ゆっくりまわってる。", "🪨 つるつるの石。ずっと撫でられてきた顔。",
          "🧺 忘れられた桶。ひっくり返して、ひと休み。", "🕯 灯籠の中、ろうそくの燃えかす。",
          "🎋 竹に彫られた古い名前。だれとだれ、だろ。", "♨️ 湯の花。指でつまむと、ふわっと消えた。"],
  beach: ["🪸 桃色のさんごのかけら。", "🍶 中身のないびん。手紙は……入ってない。",
          "🐚 巻き貝。耳にあてたら、ちゃんと海だった。", "🪁 ちぎれた凧の尾。どこから来たの。",
          "🦀 横歩きのカニ。目が合った気がする。", "🌴 落ちてた椰子の実。……重い。"],
  fishing: ["🪝 錆びた釣り針。だれかの取り逃がしたやつ。", "🐟 うろこが一枚。日にかざすと虹になる。",
            "🧵 ほどけた網の糸。指に巻いてみた。", "🪣 ひび割れた桶。底に雨水と、空。",
            "⚓ ちいさな錨の飾り。お守りかな。", "🐚 ふたつで一組の貝。片方だけ落ちてた。"],
  falls: ["💧 葉っぱのくぼみに、まるい水。こぼすのがもったいない。", "🍄 丸太のかげの、赤いきのこ。さわらないでおく。",
          "🪶 濡れた羽根。持ち上げたら、ずっしり。", "🪨 まっ平らな石。だれかが座ってた形。",
          "🌈 しぶきの虹。手を入れると消える。ずるい。", "🍃 流れてきた大きな葉。舟にしたら乗れそう。"],
};

// 入口アイコン → 道標スプライト（images/scene/konron/props/）。載っていないアイコンは灯りのまま。
const KW_SIGN = {
  "🏬": "sign_mall", "🍢": "sign_market", "🍧": "sign_market", "📷": "sign_photo",
  "🏨": "sign_inn", "⛴️": "sign_pier", "🏟️": "sign_race", "🏁": "sign_race",
  "♨️": "sign_onsen", "🏖️": "sign_beach", "🏙️": "sign_back", "🏝️": "sign_back", "❓": "q_smoke",
};

// シートから1コマ描く（96×128セル）。row=0正面 1背中 2横（横は左向き素材＝右向きは反転）
// =========================================================================
// HD-2D の空気（2026-08-01）— **新しい絵は1枚も足していない。全部が後処理。**
// =========================================================================
// ユーザー指摘「HD2Dのような美しさがなく、単調」。実測したら描画は
// 「背景を1枚貼る → 色を1枚乗せる」だけで、奥行き・光・粒・視線誘導が**ゼロ**だった。
// HD-2D（オクトパス系）の記号を、既存の絵のまま手に入れる：
//   ①ティルトシフト（上下だけボケ）＝奥行き   … bgFar で合成（ぼかしは読み込み時に1枚作る）
//   ②ブルーム（光のにじみ）                  … 明るい画素だけ抽出→ぼかし→加算。夜ほど強い
//   ③灯りの呼吸                              … ブルームの強さをゆっくり上下させる
//   ④空気の粒（昼＝埃 / 夜＝蛍火）            … 手続きで生成・画像不要
//   ⑤ビネット                                … 視線を中央へ
//   ⑥色調をキャラの**後**に掛ける            … これが「浮いて見える」の正体だった
//     （従来は背景→色調→キャラの順で、夜に背景だけ44%暗くなりミミだけ明るいままだった）
// ★ぼかし/明るい画素の抽出は**エリア読み込み時に1回だけ**。毎フレームやると確実に落ちる。
// ★表示専用＝当たり判定・進行・レース数値には一切触れない。
// =========================================================================

// 後処理用の作業キャンバス（画面サイズぶん1枚を使い回す。毎フレーム作らない）。
function kwFx(w, h) {
  try {
    if (!KW._fx || KW._fx.width !== w || KW._fx.height !== h) {
      KW._fx = document.createElement("canvas"); KW._fx.width = w; KW._fx.height = h;
    }
    return KW._fx;
  } catch (e) { return null; }
}

// 明るい画素だけを残した「光の版」と、全体をぼかした「奥行きの版」を1回だけ焼く。
function kwBakeAir(img) {
  KW.bgBlur = null; KW.bgBloom = null;
  try {
    if (!img || !img.naturalWidth) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    // ── ①奥行きの版（全体を強めにぼかす）──
    const b = document.createElement("canvas"); b.width = W; b.height = H;
    const bx = b.getContext("2d");
    bx.filter = "blur(" + Math.max(3, Math.round(W / 260)) + "px)";
    bx.drawImage(img, 0, 0);
    bx.filter = "none";
    KW.bgBlur = b;
    // ── ②光の版（明るいところだけ残してぼかす）──
    const l = document.createElement("canvas"); l.width = W; l.height = H;
    const lx = l.getContext("2d");
    lx.drawImage(img, 0, 0);
    const im = lx.getImageData(0, 0, W, H), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      // 明度がしきい値を超えたぶんだけを残す（超えない画素は透明）
      const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      // ★しきい値は高めに取る。低いと**石畳や砂まで光って**画面全体が持ち上がり、
      //   せっかくの夜の色調を打ち消す（実機で踏んだ＝夜なのに昼に見えた）。
      //   拾いたいのは提灯・窓・炎だけ＝少数の画素を、強く光らせる。
      const over = v - 228;
      if (over <= 0) { d[i + 3] = 0; }
      else { d[i + 3] = Math.min(255, Math.round(over * 9)); }
    }
    lx.putImageData(im, 0, 0);
    const l2 = document.createElement("canvas"); l2.width = W; l2.height = H;
    const l2x = l2.getContext("2d");
    l2x.filter = "blur(" + Math.max(4, Math.round(W / 150)) + "px)";
    l2x.drawImage(l, 0, 0);
    l2x.filter = "none";
    KW.bgBloom = l2;
  } catch (e) { KW.bgBlur = null; KW.bgBloom = null; }   // 焼けなくても歩ける（fail-safe）
}

// fg レイヤー＝キャラの上に掛ける「空気」。色調もここ（キャラごと染める）。
// 空気の粒の速さ（px/秒・実測で決めた値。§④のコメント参照）。
//   埃＝ほぼ静止に見える速さ／蛍＝ふわりと動くが視線を奪わない速さ。
const KW_AIR_DUST_V = 4;
const KW_AIR_FIRE_V = 16;

function kwDrawAir(ctx, cam, S, t) {
  const now = kwNow(), tint = KW_TINT[now.k];
  const night = (now.k === "夜" || now.k === "宵" || now.k === "未明");
  const sc0 = cam.sc || kwScale(S);

  // ── ⑥ 色調＝**キャラの後**。これで人も景色と同じ時間に居る ──
  // ★順番が命：**先に暗くして、後から光を足す**。逆にすると、加算で持ち上がった画を
  //   multiply が中途半端に沈めるだけになり、夜なのに昼のような眠い画になる（実機で踏んだ）。
  if (tint && tint.a > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = tint.mode;
    ctx.globalAlpha = tint.a; ctx.fillStyle = tint.col;
    ctx.fillRect(0, 0, S.vw, S.vh);
    ctx.restore();
  }

  // ── ②③ ブルーム：暗くした上に灯りを足す。夜ほど強く、ゆっくり呼吸させる ──
  if (KW.bgBloom) {
    const breathe = 0.86 + Math.sin(t * 0.0011) * 0.14;
    const base = night ? 0.62 : (now.k === "夕暮れ" ? 0.34 : 0.14);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = base * breathe;
    ctx.drawImage(KW.bgBloom, cam.x, cam.y, cam.vw, cam.vh, 0, 0, S.vw, S.vh);
    ctx.restore();
  }

  // ── ④ 空気の粒：昼は埃、夜は蛍火。手続き生成＝画像ゼロ ──
  // ★最初の実装は目分量で書いてしまい、実測したら**画面を約1秒で横断**していた
  //   （180〜420 px/秒＝吹雪かレンズの汚れが流れる速さ）。数字で決め直す：
  //     ・空気中の埃 … ほぼ静止〜数px/秒。「見えるか見えないか」が正解
  //     ・蛍         … ふわりと10〜30px/秒で、向きがゆっくり変わる
  //   → 埃 KW_AIR_DUST_V=4／蛍 KW_AIR_FIRE_V=16 px/秒 を基準にする。
  // ★もう一つの設計ミス：粒を**画面座標**に置いていた＝歩いても粒が付いてこず
  //   「レンズについた汚れ」に見えた。空気は場のものなので**ワールド座標**に置き、
  //   カメラを引いてから描く。歩けば粒の間を通り抜ける。
  // ★数はマジックナンバーではなく**面積あたり**で決める（画面サイズが変わっても密度が一定）。
  const areaK = (S.vw * S.vh) / (390 * 500);              // 基準画面＝390×500
  const N = Math.max(6, Math.round((night ? 14 : 9) * areaK));
  const V = night ? KW_AIR_FIRE_V : KW_AIR_DUST_V;        // px/秒
  const span = 900;                                       // 粒が漂うワールド範囲（カメラ周り）
  ctx.save();
  for (let i = 0; i < N; i++) {
    const seed = i * 137.51;
    // ワールド座標：カメラ中心のまわりに撒き、ゆっくり流す＋左右にゆらぐ
    const wx0 = cam.x + cam.vw * 0.5 + (Math.sin(seed) * 0.5) * span;
    const wy0 = cam.y + cam.vh * 0.5 + (Math.cos(seed * 1.7) * 0.5) * span;
    const drift = (t / 1000) * V * (0.7 + (i % 5) * 0.15);          // 帯が5種＝群れて見えない
    const wx = wx0 + ((drift + seed * 13) % span) - span * 0.5;
    const wy = wy0 + Math.sin(t * 0.00035 + seed) * (night ? 22 : 9);
    const px = (wx - cam.x) * sc0, py = (wy - cam.y) * sc0;
    if (px < -20 || py < -20 || px > S.vw + 20 || py > S.vh + 20) continue;
    if (night) {
      const tw = 0.35 + Math.abs(Math.sin(t * 0.0016 + seed)) * 0.65;
      ctx.globalAlpha = tw * 0.72; ctx.fillStyle = "#ffe6a0";
      ctx.beginPath(); ctx.arc(px, py, 1.6 + tw * 1.5, 0, 6.284); ctx.fill();
      ctx.globalAlpha = tw * 0.18;
      ctx.beginPath(); ctx.arc(px, py, 6 + tw * 5, 0, 6.284); ctx.fill();
    } else {
      // 昼の埃は**ほとんど見えない**のが正しい。存在を主張させない。
      ctx.globalAlpha = 0.13 + (i % 4) * 0.03; ctx.fillStyle = "#fff8e2";
      ctx.beginPath(); ctx.arc(px, py, 0.9 + (i % 3) * 0.35, 0, 6.284); ctx.fill();
    }
  }
  ctx.restore();

  // ── ⑤ ビネット：四隅を落として視線を中央へ ──
  ctx.save();
  const vg = ctx.createRadialGradient(S.vw / 2, S.vh * 0.46, Math.min(S.vw, S.vh) * 0.34,
                                      S.vw / 2, S.vh * 0.46, Math.max(S.vw, S.vh) * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  // ★夜に .58 は掛けすぎだった（実機で景色が沈んだ）。灯りが主役なので四隅だけ軽く落とす。
  vg.addColorStop(1, night ? "rgba(4,6,16,.34)" : "rgba(20,12,4,.22)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, S.vw, S.vh);
  ctx.restore();
}

function kwDrawCell(ctx, sheet, col, row, sx, sy, H, flip) {
  const W = H * (96 / 128);
  ctx.save();
  if (flip) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
  ctx.drawImage(sheet, col * 96, row * 128, 96, 128, sx - W / 2, sy - H, W, H);
  ctx.restore();
}
function kwShadow(ctx, sx, sy, w, h) {
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(sx, sy, w, h, 0, 0, 7); ctx.fill(); ctx.restore();
}

function kwDraw(ctx, cam, layer, S, t) {
  if (!KW || !KW.mimi) return;
  const sc = cam.sc || kwScale(S);

  if (layer === "bgFar") {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (KW.bg) ctx.drawImage(KW.bg, cam.x, cam.y, cam.vw, cam.vh, 0, 0, S.vw, S.vh);
    else { ctx.fillStyle = "#c8b48a"; ctx.fillRect(0, 0, S.vw, S.vh); }   // 画像が無くても歩ける
    ctx.restore();
    // ★HD-2D ①ティルトシフト：上下だけボケさせて“奥行き”を作る。
    //   これがHD-2Dのいちばん分かりやすい記号（真ん中だけピントが合っている）。
    //   ぼかし画像は**エリア読み込み時に1枚だけ**作る（毎フレームの blur は重すぎる）。
    if (KW.bgBlur) {
      // ★必ず**別キャンバスでマスクしてから**重ねる。
      //   本体キャンバスに直接 destination-out を掛けると、下に描いた背景まで消える
      //   （実機で踏んだ＝中央が空っぽの帯になった）。合成先を分けるのが唯一の正解。
      const fx = kwFx(S.vw, S.vh);
      if (fx) {
        const f = fx.getContext("2d");
        f.clearRect(0, 0, S.vw, S.vh);
        f.globalCompositeOperation = "source-over";
        f.drawImage(KW.bgBlur, cam.x, cam.y, cam.vw, cam.vh, 0, 0, S.vw, S.vh);
        f.globalCompositeOperation = "destination-out";
        const g = f.createLinearGradient(0, 0, 0, S.vh);
        g.addColorStop(0.00, "rgba(0,0,0,0)");
        g.addColorStop(0.30, "rgba(0,0,0,1)");
        g.addColorStop(0.72, "rgba(0,0,0,1)");
        g.addColorStop(1.00, "rgba(0,0,0,0)");
        f.fillStyle = g; f.fillRect(0, 0, S.vw, S.vh);
        f.globalCompositeOperation = "source-over";
        ctx.save(); ctx.globalAlpha = 0.8;
        ctx.drawImage(fx, 0, 0);
        ctx.restore();
      }
    }
    return;   // ★色調（tint）は fg へ移した＝キャラも一緒に染まる（下の理由参照）
  }
  if (layer === "fg") { kwDrawAir(ctx, cam, S, t); return; }
  if (layer !== "world") return;

  const m = KW.mimi;
  const H = 118 * sc;

  // ── きらめき（寄り道の理由）＝ふわふわ光るだけ。近づくと「見つけたもの」になる。
  (KW.spark || []).forEach(function (s, i) {
    const px = (s.x - cam.x) * sc, py = (s.y - cam.y) * sc;
    if (px < -30 || py < -30 || px > S.vw + 30 || py > S.vh + 30) return;
    const pu = S.reduce ? 0.7 : (0.55 + 0.45 * Math.abs(Math.sin(t / 620 + i)));
    const R = 9 * sc * pu;
    ctx.save();
    const g = ctx.createRadialGradient(px, py - 12 * sc, 0, px, py - 12 * sc, R * 2.6);
    g.addColorStop(0, "rgba(255,248,205," + (0.85 * pu).toFixed(2) + ")");
    g.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py - 12 * sc, R * 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,252,232,.95)";
    ctx.beginPath(); ctx.arc(px, py - 12 * sc, Math.max(1.2, R * 0.34), 0, 7); ctx.fill();
    ctx.restore();
  });

  // ── すれちがいNPC（ミミより奥の人から順に）
  const folkH = H * 0.94;
  KW.npcs.slice().sort((a, b) => a.y - b.y).forEach(function (n) {
    const px = (n.x - cam.x) * sc, py = (n.y - cam.y) * sc;
    if (px < -60 || py < -80 || px > S.vw + 60 || py > S.vh + 60) return;
    kwShadow(ctx, px, py, folkH * 0.22, folkH * 0.05);
    if (n.sheet) {
      // 専用シート＝ミミと同じ読み方（列=歩行コマ／行=向き）。止まっている間は立ちコマ。
      const moving = !!(n.vx || n.vy);
      const col = moving ? [1, 0, 1, 2][Math.floor(n.step) % 4] : 1;
      kwDrawCell(ctx, n.sheet, col, n.dir, px, py, folkH, n.dir === 2 && n.face > 0);
    } else if (KW.folk) {
      const col = n.s % 3, row = (n.s / 3) | 0;             // 旧・1枚まとめシート（正面のみ）
      ctx.save();
      ctx.drawImage(KW.folk, col * 96, row * 128, 96, 128, px - folkH * (96 / 128) / 2, py - folkH, folkH * (96 / 128), folkH);
      ctx.restore();
    } else {
      ctx.save(); ctx.font = Math.round(folkH * 0.62) + "px serif"; ctx.textAlign = "center";
      ctx.fillText("🧍", px, py); ctx.restore();
    }
  });

  // ── ポロ（ミミの少し後ろを、ちょこちょこ歩いてついてくる）
  //   歩行シート（3列×3行）が来たので、ミミと同じ読み方で足も動く。跳ねは少しだけ残して軽さを出す。
  if (KW.poro && KW.poroImg) {
    const p = KW.poro;
    const ph = H * 0.60, pw = ph * (96 / 128);
    const hop = (KW.moving && !S.reduce) ? Math.abs(Math.sin(KW.step * 1.6)) * ph * 0.06 : 0;
    const px = (p.x - cam.x) * sc, py = (p.y - cam.y) * sc;
    kwShadow(ctx, px, py, pw * 0.34, ph * 0.055);
    const col = KW.moving ? [1, 0, 1, 2][Math.floor(KW.step) % 4] : 1;
    kwDrawCell(ctx, KW.poroImg, col, p.d | 0, px, py - hop, ph, (p.d | 0) === 2 && p.f > 0);
  }

  // ── ミミ
  const sx = (m.x - cam.x) * sc, sy = (m.y - cam.y) * sc;
  kwShadow(ctx, sx, sy, H * (96 / 128) * 0.30, H * 0.055);
  if (KW.sheet) {
    const col = KW.moving ? [1, 0, 1, 2][Math.floor(KW.step) % 4] : 1;
    kwDrawCell(ctx, KW.sheet, col, KW.dir, sx, sy, H, KW.dir === 2 && KW.face > 0);
  } else {
    ctx.fillStyle = "#ffd7e6"; ctx.fillRect(sx - H * 0.28, sy - H, H * 0.56, H);
  }

  // ── 入口の道標＝ドット絵の町に馴染む「灯り＋下向きの矢」。絵文字はHUDのプロンプト側で見せる。
  //   ★着いた入口には描かない（プロンプトが役目を引き継ぐ／ミミに重ならない）。
  kwDoors().forEach(function (d) {
    if (KW.near === d) return;
    const dx = (d.c + 0.5) * KW_CW, dy = (d.r + 0.5) * KW_CH;
    const px = (dx - cam.x) * sc, py = (dy - cam.y) * sc - 26 * sc;
    if (px < -40 || py < -40 || px > S.vw + 40 || py > S.vh + 40) return;
    const bob = S.reduce ? 0 : Math.sin(t / 520 + d.c) * 2.4 * sc;
    const R = Math.max(3, 4.6 * sc);
    const hid = !!d.hidden;                                  // 隠しは白い「？」の煙として立つ
    // ★道標スプライトがあればそれを立てる（看板・のれん・「？」の煙）。無ければ従来の灯り。
    const sg = KW.signs && KW.signs["sg_" + KW_SIGN[hid ? "❓" : d.ic]];
    if (sg) {
      // 128×128の正方をそのままの比で、**足元をマスの中心に置いて立たせる**。
      //   高さはミミ（118）の約2/3＝道しるべとして目に入るが人物より小さい、の関係。
      const sh = 78 * sc, sw = sh, groundY = py + 26 * sc;
      ctx.save();
      ctx.globalAlpha = hid ? 0.92 : 1;
      if (!hid) kwShadow(ctx, px, groundY, sw * 0.20, sh * 0.035);   // 浮いて見えないよう影を1枚
      ctx.drawImage(sg, px - sw / 2, groundY + bob - sh + 4 * sc, sw, sh);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(px, py + bob);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 3.4);
    if (hid) { g.addColorStop(0, "rgba(220,240,255,.9)"); g.addColorStop(1, "rgba(200,225,255,0)"); }
    else { g.addColorStop(0, "rgba(255,214,140,.85)"); g.addColorStop(1, "rgba(255,190,90,0)"); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 3.4, 0, 7); ctx.fill();
    if (hid) {
      ctx.fillStyle = "#f2f8ff"; ctx.strokeStyle = "rgba(30,40,60,.8)"; ctx.lineWidth = Math.max(1, sc * 0.8);
      ctx.font = "bold " + Math.round(R * 3.2) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeText("？", 0, 0); ctx.fillText("？", 0, 0);
    } else {
      ctx.fillStyle = "#ffe8b0"; ctx.strokeStyle = "rgba(60,34,10,.85)"; ctx.lineWidth = Math.max(1, sc);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-R * 0.85, R * 1.7); ctx.lineTo(R * 0.85, R * 1.7); ctx.lineTo(0, R * 3.0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  });
}
