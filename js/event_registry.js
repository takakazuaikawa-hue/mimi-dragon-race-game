/**
 * event_registry.js — all event registrations.
 *
 * Pure data, no system logic. Add new dialogue / story beats here. Groups
 * are organised by spec phase so the file maps 1:1 to §10 §11 (Story Scope
 * by Development Phase).
 *
 * EXTENSION POINT — adding a new event:
 *   registerEvent({
 *     id: "unique_string",
 *     hook: "<one of eventHooks keys>",
 *     condition: { once?, raceId?, region?, weather?, rankAtLeast?, betType?,
 *                  tag?, requiredFlag?, forbiddenFlag?, test?(ctx) },
 *     priority: <number, default 0; higher fires first>,
 *     actions: [
 *       { type: "dialogue" | "tutorial_message" | "panyu_message" |
 *               "system_message" | "coin_rescue" | "rank_unlock_note",
 *         speaker: "mimi" | "sake_udada" | "announcer" | "system" |
 *                  "dragon_villager",
 *         text: "..." | (ctx) => "..." }
 *     ],
 *     effects: { setFlags: { flagName: true } }    // optional
 *   });
 *
 * Sections below correspond to spec phases. Append within the matching block.
 */

// =========================================================================
// ★ キャラクターの役割と声（追加・編集時も厳守）
//   ミミ(mimi)        … 来訪者(転生者)。世界の競竜/市場/生活の“常識を説明する側”では
//                       ない。反応・驚き・質問・学びを担う（「〜です/ます」「〜っ！」）。
//                       コース/分析/生活の断定・講釈はさせない。
//   サケ・ウダダ(sake_udada) … コースの説明＝馬場/地域/距離/脚質/竜の見方＋賭けのルール
//                       （「〜だ」「〜しろ」。息・気配・現場）。
//   ミズ(mizu)        … 分析情報＝オッズ/人気/期待値/価値/市場の歪み（「〜わ」「あはん」）。
//   スミカ(sumika)    … 生活情報＝住居/食事/施設/総資産/村の立て直し（「ミミ様」「〜です/ください」）。
//   マクラ(makura)=観客/実況/熱狂、セレスティア(celestia)=価値/淘汰/世界の天井。
// =========================================================================

// ===== V1 sample events (§14 §25 + §10 §11 "V1") =====

// ★D1/D2解消＋do-then-explain（NARRATIVE_DESIGN P2）：講義をやめ「まず賭けさせる」。
//   賭式のルール定義はここから撤去し、各賭式の初選択時チュートリアル（beforeBet・下の3本）に分割。
registerEvent({
  id: "first_race_intro_mimi",
  hook: "beforeRaceSelect",
  condition: { once: true },
  priority: 10,
  actions: [
    { type: "tutorial_message", speaker: "mimi", expr: "panic",
      text: "レース場、ひろ……ひろい！　どこ見たらいいの、これ……サケさん、助けて！" },
    { type: "tutorial_message", speaker: "sake_udada",
      text: "講義はしない。まず一回、好きな竜に賭けてこい。……話は、その後だ。" }
  ]
});

// ★ミズのオッズ講釈は上から分離（元は first_race_intro_mimi の3行目）。
//   同居のままだと、ミミ＋サケは初回から登場済み＝イベントが発火して once を消費し、
//   未登場のミズの行だけが落ちて「二度と出ない」。第2話を読んだ後の初レース選択で出す。
registerEvent({
  id: "first_race_intro_mizu",
  hook: "beforeRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_2" },
  priority: 9,
  actions: [
    { type: "tutorial_message", speaker: "mizu",
      text: "そしてオッズは勝率ではないわ、あはん。人気と価値を、分けて見ることね。" }
  ]
});

// （旧 first_race_intro＝afterRaceSelect の二重intro は D1 で削除：上の intro_mimi に一本化）

registerEvent({
  id: "sake_overbet_favorite_warning",
  hook: "afterEntryList",
  condition: { once: true, raceId: "race_grandclock_1" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "前で勝った竜は、買われる。……今日のコースに合うかは、別の話だ。" }
  ]
});

// ★D2：賭式のルールは「その賭式を初めて選んだ瞬間」に1回だけ（分割投与・P8）。
registerEvent({
  id: "first_win_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "win" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "単竜。1着を当てる、いちばん熱い札だ。……信じた一頭に、まっすぐ張れ。" }
  ]
});
registerEvent({
  id: "first_place_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "place" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "複竜は3着以内に入れば当たり。配当は薄いが、飯代は守れる。" }
  ]
});
registerEvent({
  id: "first_wide_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "wide" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "ワイド竜は、選んだ2頭がどっちも3着以内なら当たり。……穴を拾う時に効く。" }
  ]
});

registerEvent({
  id: "mimi_strong_wind_first",
  hook: "afterRaceSelect",
  condition: { once: true, weather: "strong_wind" },
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "panic",
      text: "強風です……耳が横に持っていかれますっ！" },
    { type: "dialogue", speaker: "sake_udada",
      text: "こういう日は翼の強さだけじゃない。風に煽られても、気性で立て直せる竜を見ろ。" }
  ]
});

registerEvent({
  id: "panyu_after_tense_preview",
  hook: "afterDragonPreview",
  condition: { once: false, tag: "tense_race" },
  actions: [
    { type: "panyu_message", speaker: "mimi", text: "ぱほぱほ！ 場が和んだ！" }
  ]
});

// ★D3解消：毎レースの hit/miss VN は削除。リアクションは結果画面のミミ講評（recap_engine の
//   buildMimiRecap＝声表準拠の池）が一手に担う。VNの割り込み（二重リアクション）を根絶。

registerEvent({
  id: "first_bankruptcy_rescue",
  hook: "onBankruptcy",
  condition: { once: false },
  // §38 — 自動支給はやめ、ホームの「無心する」ボタンから受け取る方式に変更。
  // （rescue の額・計算は不変。受け取り方を“無心”の演出にしただけ。）
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ミミ、コインが尽きたな。…まだ終わりじゃない。ホームで『無心する』んだ。村のみんなが、基準額をそっと握らせてくれるさ。" }
  ]
});

registerEvent({
  id: "rank_up_celebration",
  hook: "onRankUp",
  condition: { once: false },
  actions: [
    // ★声表準拠（ミミ＝短文の畳みかけ→一拍→飯に着地。自分に「おめでとう」と言わせない・システム文の読み上げ禁止）
    { type: "dialogue", speaker: "mimi", e: "happy",
      text: "え、うそ、上のクラス……行ける？ 行けちゃう？　……よし、行く前に腹ごしらえ！" }
  ]
});

registerEvent({
  id: "milestone_10k",
  hook: "onMilestone",
  condition: { once: true, test: ctx => ctx && ctx.kind === "coins_10000" },
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "1万コイン……！ わたし、ここまで来られたんだ。よーし、もっと上を目指すぞっ！" }
  ]
});
registerEvent({
  id: "milestone_100m",
  hook: "onMilestone",
  condition: { once: true, test: ctx => ctx && ctx.kind === "coins_100000000" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "1億コインか…ここまで来ると、もう村の主だな。神兎大レースも見えてくる頃合いだ。" }
  ]
});
registerEvent({
  id: "milestone_first_wide_hit",
  hook: "onMilestone",
  condition: { once: true, test: ctx => ctx && ctx.kind === "first_wide_hit" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "初ワイド竜的中、見事だ。本命と穴の組合せで勝つのが、この賭けの妙味だ。" }
  ]
});

// ===== §10 Phase 2: More reactions / Region first-visit / Bet tutorials =====

// 8 region first-visit comments.
registerEvent({
  id: "first_visit_grand_clock",
  hook: "afterRaceSelect",
  condition: { once: true, region: "グランドクロック地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "グランドクロック地域だ。竜レースの基本を学ぶ場所。時計塔の下で、まずは予想を組み立てる癖をつけよう。" }]
});
registerEvent({
  id: "first_visit_lumina",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ルミナ地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ルミナだ。空が広く、風が強い。翼の安定した竜でないと、ここでは流される。" }]
});
registerEvent({
  id: "first_visit_ring_rosso",
  hook: "afterRaceSelect",
  condition: { once: true, region: "リングロッソ地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "リングロッソ。回転と気性の世界だ。スピードだけじゃ勝てん。" }]
});
registerEvent({
  id: "first_visit_caldera",
  hook: "afterRaceSelect",
  condition: { once: true, region: "カルデラ地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "カルデラだ。熱気で火力自慢が人気を集めるが、最後までスタミナが保つかを見極めろ。" }]
});
registerEvent({
  id: "first_visit_mistlake",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ミストレイク地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ミストレイク。視界が悪い時こそ、気性と回転で走れる竜が活きる。" }]
});
registerEvent({
  id: "first_visit_vento",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ヴェント峡谷地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ヴェント峡谷だ。崖から風が吹き上がる。翼性能が、そのまま順位に出る。" }]
});
registerEvent({
  id: "first_visit_notte",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ノッテムーンライト地域" },
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "ノッテムーンライト。夜は観客が興奮し、人気が偏るわ、あはん。市場の熱を冷ましてから、値を読みなさい。" }]
});
registerEvent({
  id: "first_visit_lapan",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ラパン祭典地域" },
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "ラパン祭典地域。祭りの熱気がオッズを大きく歪めるわ、あはん。歪みこそ、価値の在り処よ。" }]
});

// Bet type tutorials (win/place; wide already in V1 block).
registerEvent({
  id: "first_win_bet_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "win" },
  actions: [{ type: "tutorial_message", speaker: "sake_udada",
    text: "単竜は一着を当てる賭けだ。自信がある時は強いが、迷うなら複竜やワイド竜も見ろ。" }]
});
registerEvent({
  id: "first_place_bet_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "place" },
  actions: [{ type: "tutorial_message", speaker: "sake_udada",
    text: "複竜は、選んだ竜が3着以内に入れば的中だ。配当は低いが、堅実に拾いたい時に効く。" }]
});

// Race result reactions (upset / favorite-holds).
registerEvent({
  id: "sake_upset_comment",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank >= 5 },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "波乱ね、あはん。市場が見落とした価値が、いま顕れたのよ。こういう一戦を拾える者が、勝ち残るの。" }]
});
registerEvent({
  id: "sake_favorite_holds",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank === 1 && ctx.hit },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "順当な決着ね。人気を素直に買うのも、立派な投資よ。あはん。" }]
});

// ===== §10 Phase 3: Crybaby dragon (Poro) story + Village reactions =====

// ★ポロの門番＝poroFound()（単勝2勝目の発見アーク）が唯一。話者ゲート（顧問＝advisorMet）では塞げない：
//   下の3イベントは speaker が mimi/sake＝常時OKなのに、本文でポロを名指ししているため。
//   さらに poro は ORIGINAL_8＝全レースの既定出走表に居るので、ゲート無しだと「初レースの出走表」で
//   いきなり「泣き虫竜ポロちゃん」と出て、発見アークの命名オチが潰れる（once も空撃ちで消費）。
//   poro.js は event_registry.js より後に読み込まれるため typeof で確認し、判定不能なら出さない側に倒す。
function poroKnownForEvents() {
  try { return (typeof poroFound === "function") && !!poroFound(); } catch (e) { return false; }
}

registerEvent({
  id: "poro_first_sight",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => poroKnownForEvents() && ctx && ctx.race && getRaceDragonIds(ctx.race).includes("poro")
  },
  actions: [{ type: "dialogue", speaker: "mimi", expr: "default",
    text: "あ……泣き虫竜ポロちゃん。泣いてるのに……足音は、落ち着いてる気がする。気のせい、かなあ。" }]
});

registerEvent({
  id: "poro_condition_unlock",
  hook: "afterRaceAnalysis",
  condition: {
    once: true,
    test: ctx => poroKnownForEvents() &&
      state.player.collection.poro && state.player.collection.poro.records.racesSeen >= 3
  },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ポロを3戦見たな。泣いているように見えるが、気性は安定している。複勝・ワイドで穴を拾うなら、覚えておけ。" },
    { type: "tutorial_message", speaker: "mimi", expr: "default",
      text: "……そっか。見た目じゃなくて、足音と試走を見るんですね。ひとつ、おぼえました。" }
  ]
});

registerEvent({
  id: "poro_first_place",
  hook: "afterRaceResult",
  condition: {
    once: true,
    test: ctx => poroKnownForEvents() && ctx && state.current && state.current.raceResult &&
      state.current.raceResult.entries.slice(0,3).some(e => e.dragon.id === "poro")
  },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "ポロちゃん、3着以内に入った……！ 泣いてても走れる、ちゃんと走れるんだね……ぐすっ。" }]
});

registerEvent({
  id: "village_first_levelup",
  hook: "onVillageUpdate",
  condition: { once: true },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "sumika",
    text: "ミミ様、村が育ってきました。応援が増え、予備コインの蓄えも厚くなっています。生活の土台が、着実に。" }]
});
registerEvent({
  id: "village_levelup_generic",
  hook: "onVillageUpdate",
  condition: { once: false },
  actions: [{ type: "dialogue", speaker: "sumika",
    text: ctx => {
      const lv = (ctx && ctx.newLevel) || (state.player && ((state.player.village && state.player.village.level) || state.player.villageLevel));
      return lv
        ? `ミミ様、村レベルが ${lv} に上がりました。賭金倍率と救済コインの基準が上がります。`
        : `ミミ様、村が一段、育ちました。賭金倍率と救済コインの基準が上がります。`;
    } }]
});

// ===== §10 Phase 4: Rank intros + Major rival intros =====

registerEvent({
  id: "rank4_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 4, test: ctx => ctx && ctx.race && ctx.race.rank === 4 },
  priority: 8,
  // ★D4：教訓の変奏をやめ「別の転」に書き分け（4=群衆／5=ミズの妙味／6=祭りの空気）。声表準拠。
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "……客の声、聞こえるか。ああいう日は竜より先に、財布のほうが熱くなる。" }]
});
registerEvent({
  id: "rank5_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 5, test: ctx => ctx && ctx.race && ctx.race.rank === 5 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "竜王杯ね。桁が増えると、みんな急に“名前”で買い始めるの。……名前は走らないのに。ほら、妙味の匂いがしてきた。" }]
});
registerEvent({
  id: "rank6_first_intro_festival",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 6, test: ctx => ctx && ctx.race && ctx.race.rank === 6 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "祝祭級だ。……この太鼓の音はな、竜の脚も客の財布も軽くする。浮つくなよ。浮ついた金がいちばん旨いのは、胴元だ。" }]
});
registerEvent({
  id: "rank7_first_intro_shinto",
  hook: "afterRaceSelect",
  condition: { once: true, raceId: "race_lapan_shinto_grand" },
  priority: 10,
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "神兎大レース……竜レース界の、頂点。こんな場所に、わたしが立てるなんて……！" },
    { type: "dialogue", speaker: "sake_udada",
      text: "長距離マラソン、最高峰の竜たち、観衆の熱狂だ。ここまで来たなら、胸を張れ。" }
  ]
});
// ★ミズの行は分離（元は rank7_first_intro_shinto の3行目）。同居のままだと、物語を飛ばして
//   第2話未読のまま神兎大レースへ来た人は「ミミ＋サケだけ出て once 消費」or「イベント全体が持ち越し」に
//   なる。分離すれば、ミミ/サケは頂点の瞬間に喋り、ミズは出会った後の同レースでちゃんと喋る。
registerEvent({
  id: "rank7_first_intro_shinto_mizu",
  hook: "afterRaceSelect",
  condition: { once: true, raceId: "race_lapan_shinto_grand" },
  priority: 9,
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: "妙味は巨額の配当よ、あはん。市場のハイプを冷静に剥がせる者だけが、残るの。" }
  ]
});

registerEvent({
  id: "rival_intro_phenix",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("phenix") },
  priority: 7,
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "鳳凰竜フェニックス……！ 黄金の翼の、伝説の竜さん。わぁ、観客が大歓声ですっ！" }
  ]
});
// ★ミズの行は分離（元は rival_intro_phenix の2行目）。フェニックス初出走はランク4＝総資産は足りるが、
//   _chapter_intro_2 は「物語を実際に読んだ」フラグなので、物語を飛ばした人はミズ未登場のまま到達しうる。
//   同居のままだとミミの行だけ出て once を消費し、ミズの講釈が二度と出なくなる。
registerEvent({
  id: "rival_intro_phenix_mizu",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("phenix") },
  priority: 6,   // ミミの行(7)の直後。同点の raika/stella/glaze より先に登録＝並び順は維持。
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: "ただし市場は本命視しすぎるわ、あはん。これだけ買われて、まだ値ごろ……？ 期待値を疑いなさい。" }
  ]
});
registerEvent({
  id: "rival_intro_raika",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("raika") },
  priority: 6,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "雷角竜ライカ。電光石火の逃げ脚だが、気性が荒い。ハイペースを作るが、自分も終盤で苦しくなる。" }]
});
registerEvent({
  id: "rival_intro_stella",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("stella") },
  priority: 6,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "星光竜ステラ。差し脚で、翼も気性も安定しとる。夜や霧でも崩れん、隠れた本格派だ。" }]
});
registerEvent({
  id: "rival_intro_glaze",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("glaze") },
  priority: 6,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "氷甲竜グレイズ。地味だが耐久・気性・スタミナが揃ってる。長距離・霧・耐久戦で値段以上を見せるタイプだ。" }]
});

// ===== ★G5（NARRATIVE_DESIGN）: 100万→1億グラインド帯の中間イベント =====
// 空白帯に「転」のある掛け合いを置く（4章既読から・once・表示専用＝レース数値不変）。
// 連敗カウンタ p.missRun は checkEconomyMilestones（state.js）が更新する表示メタ。

// 連敗の夜（転＝ミズは負けた夜の数字を「市場が返す借用書」と読む）
registerEvent({
  id: "g5_losing_night",
  hook: "afterRaceResult",
  condition: { once: true, requiredFlag: "_chapter_intro_4",
    test: ctx => ((state.player && state.player.missRun) || 0) >= 4 },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "mizu", text: "4連敗。……ふふ、いい顔になってきたじゃない。" },
    { type: "dialogue", speaker: "mimi", expr: "panic", text: "笑いごとじゃないですよぅ……お財布が、軽い……。" },
    { type: "dialogue", speaker: "mizu", text: "覚えておきなさい。相場はね、痛かった夜の数字だけ、ちゃんと返してくるの。" },
    { type: "dialogue", speaker: "mimi", expr: "default", text: "……返して、くれますかね。" },
    { type: "dialogue", speaker: "mizu", text: "返させるのよ。——荒れた日は、値札が嘘をつく。……拾いに行くわよ、ミミ。" }
  ]
});
// 中間点500万（サケ＝金が増えたときこそ飯の心配をする親方肌）
registerEvent({
  id: "g5_mid_5m",
  hook: "afterRaceResult",
  condition: { once: true, requiredFlag: "_chapter_intro_4",
    test: () => assetsPeak(state) >= 5000000 },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "sake_udada", text: "総資産500万。……ハッ、あの行き倒れがな。" },
    { type: "dialogue", speaker: "mimi", expr: "happy", text: "えへへ、それ、褒めてます？" },
    { type: "dialogue", speaker: "sake_udada", text: "褒めてない。……飯は食ってるか。金が増えると、飯を忘れる奴が出る。" },
    { type: "dialogue", speaker: "mimi", expr: "smile", text: "食べてます！　むしろ、食べる量は増えました！" },
    { type: "dialogue", speaker: "sake_udada", text: "なら、いい。" }
  ]
});
// 行政の横槍＝中間点5000万（転＝スミカ章の事件。聴取の通達が「島に数えられた」証になる）
registerEvent({
  id: "g5_admin_audit",
  hook: "afterRaceResult",
  condition: { once: true, requiredFlag: "_chapter_intro_4",
    test: () => assetsPeak(state) >= 50000000 },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "sumika", text: "ミミ様。行政より通達です。……『個人資産の急拡大について、聴取を行う』と。" },
    { type: "dialogue", speaker: "mimi", expr: "panic", text: "ちょ、聴取!?　わたし、脱税してませんよ!?　領収書、ぜんぶ枕の下です！" },
    { type: "dialogue", speaker: "sumika", text: "保管場所から是正しましょう。……ですがご安心を。書類はわたくしが巻きます。" },
    { type: "dialogue", speaker: "sumika", text: "それに、これは好機です。行政が目をつけた——島の経済で、無視できない大きさになったということですから。" },
    { type: "dialogue", speaker: "mimi", expr: "smile", text: "……そっか。わたし、島に数えられてるんだ。" },
    { type: "dialogue", speaker: "sumika", text: "はい。……次は、数える側に回りましょう、ミミ様。" }
  ]
});

// ===== ★G8（NARRATIVE_DESIGN）: クリア後＝好敵手の再来（ファンレター l_rival の伏線回収）=====
// 終章クリア（edFlag）後の日常レースに、手紙の主が静かに現れる。顔なし（narrator経由）＝
// 新キャスト追加なしで cast/gate 契約を守る。表示専用＝予想対決は雰囲気のみ・数値不変。
registerEvent({
  id: "g8_rival_return",
  hook: "afterRaceSelect",
  condition: { once: true,
    test: () => !!(state.player && state.player.epilogue && state.player.epilogue.edFlag) },
  priority: 7,
  actions: [
    { type: "dialogue", speaker: "narrator", text: "レース場の出口。予想板の前に、旅装の男がひとり。……ミミの顔を見て、ふっと笑った。" },
    { type: "dialogue", speaker: "narrator", text: "「手紙は、読んだか。——次のレース、俺は自分の目で選ぶ。お前もそうしろ」　それだけ言って、男は窓口へ歩いていく。" },
    { type: "dialogue", speaker: "mimi", expr: "panic", text: "え……あの人、まさか、手紙の……！" },
    { type: "dialogue", speaker: "mimi", expr: "default", text: "……受けて立ちます。わたしは、わたしの目で選ぶだけ！" },
    { type: "dialogue", speaker: "narrator", text: "好敵手との静かな再戦が、日常のレースに混ざっていく。——島の賭場は、今日も平常運転。" }
  ]
});

// ===== EXTENSION POINT — §10 Phase 5+: Full story arcs go here =====
// Append additional dialogue/story beats for future phases below.
