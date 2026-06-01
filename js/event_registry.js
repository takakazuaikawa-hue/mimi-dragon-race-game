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

// ===== V1 sample events (§14 §25 + §10 §11 "V1") =====

registerEvent({
  id: "first_race_intro_mimi",
  hook: "beforeRaceSelect",
  condition: { once: true },
  priority: 10,
  actions: [
    { type: "tutorial_message", speaker: "mimi",
      text: "ようこそ！ レースを選んだら、出走表とオッズをしっかり見て、市場が見落としてる竜を探してね。単竜は1着的中、複竜は3着以内、ワイド竜は2頭3着以内よ！" }
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
    { type: "dialogue", speaker: "mimi",
      text: "強風ですね……耳が横に持っていかれます！ 翼の強い子だけじゃなくて、落ち着いて飛べる子も見たいです。" }
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
    { type: "dialogue", speaker: "mimi",
      text: "や、やりました！ 当たってます！ しっぽが勝手に跳ねちゃいます！" }
  ]
});
registerEvent({
  id: "mimi_miss_reaction",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && !ctx.hit },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "外れちゃいました……でも、分析画面を見れば、次のヒントが見えてきます！" }
  ]
});

registerEvent({
  id: "first_bankruptcy_rescue",
  hook: "onBankruptcy",
  condition: { once: false },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ミミ、まだ終わりじゃない。レースは外した後に、次をどう読むかで強くなる。村の予備コインだ。もう一度、竜を見てみよう。" },
    { type: "coin_rescue", amountFromVillageLevel: true }
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
    { type: "dialogue", speaker: "mimi",
      text: "1万コイン到達おめでとう！ ここからが本当の予想家ね。もう少しランクの高いレースに挑めるかも。" }
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
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "ルミナ地域だ……空が広い！ 風が強いから、翼の安定感が大事ね。" }]
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
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "カルデラ……熱気がすごい！ 火力人気の竜が買われやすいけど、スタミナが残るかをよく見ましょう。" }]
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
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "ヴェント峡谷……崖から風が吹き上がってる！ ここは翼性能の本場ね。" }]
});
registerEvent({
  id: "first_visit_notte",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ノッテムーンライト地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ノッテムーンライト。夜のレースは観衆の興奮で人気が偏りやすい。市場を冷静に読め。" }]
});
registerEvent({
  id: "first_visit_lapan",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ラパン祭典地域" },
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "ラパン祭典地域……！ ここは祭典級のレースが行われる聖地よ。観衆の熱気がオッズを狂わせるわ。チャンスね。" }]
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
  actions: [{ type: "tutorial_message", speaker: "mimi",
    text: "複竜は3着以内なら的中だよ！ オッズは低めだけど、安定して当てたい時に便利。" }]
});

// Race result reactions (upset / favorite-holds).
registerEvent({
  id: "sake_upset_comment",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank >= 5 },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "波乱だな。市場の見落としだ。こういうレースを拾えるのが、いい予想家の証だ。" }]
});
registerEvent({
  id: "sake_favorite_holds",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank === 1 && ctx.hit },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "順当だ。人気馬を素直に買うのも、立派な予想だ。" }]
});

// ===== §10 Phase 3: Crybaby dragon (Poro) story + Village reactions =====

registerEvent({
  id: "poro_first_sight",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("poro")
  },
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "あ……泣き虫竜ポロちゃん！ 泣いてて市場は弱そうに見ているけど、足音は意外と落ち着いてる。市場の見落としかも。" }]
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
    { type: "tutorial_message", speaker: "mimi",
      text: "見た目が弱そうでも、足音と試走をちゃんと見れば本当の実力が分かる──竜レースの大事な教えね。" }
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
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "村が育ってきたな。応援も増え、予備コインの貯えも厚くなった。これからのレースが楽しみだ。" }]
});
registerEvent({
  id: "village_levelup_generic",
  hook: "onVillageUpdate",
  condition: { once: false },
  actions: [{ type: "dialogue", speaker: "mimi",
    text: ctx => `村レベルが ${ctx && ctx.newLevel ? ctx.newLevel : "?"} に上がったよ！ 賭金倍率と救済コインが上がるわ。` }]
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
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "竜王杯……ここまで来たね。賞金の桁が変わるけど、ブランドや前走勝利が市場を支配するから、妙味も大きいわ。" }]
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
    { type: "dialogue", speaker: "mimi",
      text: "神兎大レース……竜レース界の頂点。長距離マラソン、最高峰の竜たち、そして観衆の熱狂。すべての予想技術が問われるわ。" },
    { type: "dialogue", speaker: "sake_udada",
      text: "ここでの妙味は、巨額の配当だ。市場のハイプを冷静に剥がせる者だけが、真の予想家として残る。" }
  ]
});

registerEvent({
  id: "rival_intro_phenix",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("phenix") },
  priority: 7,
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "鳳凰竜フェニックス……！ 黄金の翼の伝説的な竜。観衆が大歓声を上げるわ。市場は本命視するけど、これだけ買われると本当に+EVなのか？" }]
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
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "星光竜ステラ……差し脚で翼も気性も安定してる。夜や霧でも強い、隠れた本格派ね。" }]
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
