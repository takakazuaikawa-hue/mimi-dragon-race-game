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

registerEvent({
  id: "first_race_intro_mimi",
  hook: "beforeRaceSelect",
  condition: { once: true },
  priority: 10,
  actions: [
    { type: "tutorial_message", speaker: "mimi", expr: "panic",
      text: "競竜なんて、わたし来たばかりで右も左も……どこを見たらいいんでしょう？" },
    { type: "tutorial_message", speaker: "sake_udada",
      text: "落ち着け。まずは出走表とコースを見ろ。脚質と気配だ。賭け方は——単竜＝1着、複竜＝3着以内、ワイド竜＝2頭が3着以内。それだけ覚えりゃいい。" },
    { type: "tutorial_message", speaker: "mizu",
      text: "そしてオッズは勝率ではないわ、あはん。人気と価値を、分けて見ることね。" }
  ]
});

registerEvent({
  id: "first_race_intro",
  hook: "afterRaceSelect",
  condition: { once: true, raceId: "race_grandclock_1" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "まずは出走表とオッズを見ろ。人気だけで買うな。コースと脚質も見るんだ。" },
    { type: "dialogue", speaker: "mimi",
      text: "はいっ！ まずは、竜さんたちの様子を見るところからですね！" }
  ]
});

registerEvent({
  id: "sake_overbet_favorite_warning",
  hook: "afterEntryList",
  condition: { once: true, raceId: "race_grandclock_1" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "前走勝った竜は買われやすい。だが、今日の区間が合うとは限らない。" }
  ]
});

registerEvent({
  id: "first_wide_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "wide" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "ワイド竜は、選んだ2竜がどちらも三着以内なら当たりだ。穴を拾う時に使いやすい。" }
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

registerEvent({
  id: "mimi_hit_reaction",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.hit },
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "や、やりました！ 当たってます！ しっぽが勝手に跳ねちゃいます！" }
  ]
});
registerEvent({
  id: "mimi_miss_reaction",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && !ctx.hit },
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "default",
      text: "外れちゃいました……でも、分析画面を見れば、次のヒントが見えてきます！" }
  ]
});

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
    { type: "dialogue", speaker: "mimi",
      text: "おめでとう！ プレイヤーランクが上がりました！ 賭け上限も増えて、新しいレースに挑めるわ！" }
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

registerEvent({
  id: "poro_first_sight",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("poro")
  },
  actions: [{ type: "dialogue", speaker: "mimi", expr: "default",
    text: "あ……泣き虫竜ポロちゃん。泣いてるのに……足音は、落ち着いてる気がする。気のせい、かなあ。" }]
});

registerEvent({
  id: "poro_condition_unlock",
  hook: "afterRaceAnalysis",
  condition: {
    once: true,
    test: ctx => state.player.collection.poro && state.player.collection.poro.records.racesSeen >= 3
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
    test: ctx => ctx && state.current && state.current.raceResult &&
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
    text: ctx => `ミミ様、村レベルが ${ctx && ctx.newLevel ? ctx.newLevel : "?"} に上がりました。賭金倍率と救済コインの基準が上がります。` }]
});

// ===== §10 Phase 4: Rank intros + Major rival intros =====

registerEvent({
  id: "rank4_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 4, test: ctx => ctx && ctx.race && ctx.race.rank === 4 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "大地域杯。ここからは市場が本格的にハイプを乗せ始める。前走の結果や派手さに釣られず、コースと適性を冷静に読め。" }]
});
registerEvent({
  id: "rank5_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 5, test: ctx => ctx && ctx.race && ctx.race.rank === 5 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "竜王杯。賞金の桁が変わると、ブランドや前走勝利が市場を支配するわ、あはん。過剰人気の裏に、妙味が眠るのよ。" }]
});
registerEvent({
  id: "rank6_first_intro_festival",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 6, test: ctx => ctx && ctx.race && ctx.race.rank === 6 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "祝祭級だ。観衆と新聞のハイプが極端になる。看板の竜が過剰人気になりやすい。狙うのは、冷静な実力派だ。" }]
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
      text: "長距離マラソン、最高峰の竜たち、観衆の熱狂だ。ここまで来たなら、胸を張れ。" },
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
      text: "鳳凰竜フェニックス……！ 黄金の翼の、伝説の竜さん。わぁ、観客が大歓声ですっ！" },
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

// ===== EXTENSION POINT — §10 Phase 5+: Full story arcs go here =====
// Append additional dialogue/story beats for future phases below.
