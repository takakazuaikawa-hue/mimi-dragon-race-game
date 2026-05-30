// Event hook system — implements §10 §3 hook object, §4 event schema,
// §5 action types (dialogue / system_message / tutorial_message + coin_rescue,
// panyu_message), and §25 V1 sample events.

// §3 Required hook points.
const eventHooks = {
  beforeRaceSelect: [],
  afterRaceSelect: [],
  beforeEntryList: [],
  afterEntryList: [],
  beforeDragonPreview: [],
  afterDragonPreview: [],
  beforeBet: [],
  afterBet: [],
  duringRace: [],
  afterRaceResult: [],
  afterRaceAnalysis: [],
  onBankruptcy: [],
  onVillageUpdate: [],
  // extra economy hooks used by Phase 5 milestone events
  onRankUp: [],
  onMilestone: []
};

// §16 story flags — persisted via player.flags (already in state.js).
function getStoryFlag(name) { return !!state.player.flags[name]; }
function setStoryFlag(name, val) { state.player.flags[name] = val; saveGame(); }

function registerEvent(ev) {
  if (!eventHooks[ev.hook]) {
    console.warn("Unknown hook:", ev.hook);
    return;
  }
  eventHooks[ev.hook].push(ev);
}

// §17 condition evaluation.
function eventConditionMet(ev, context) {
  const c = ev.condition || {};
  if (c.once && getStoryFlag("_event_fired_" + ev.id)) return false;
  if (c.requiredFlag && !getStoryFlag(c.requiredFlag)) return false;
  if (c.forbiddenFlag && getStoryFlag(c.forbiddenFlag)) return false;
  if (c.raceId && (!context || !context.race || context.race.id !== c.raceId)) return false;
  if (c.region && (!context || !context.race || context.race.region !== c.region)) return false;
  if (c.weather && (!context || !context.race || context.race.weather !== c.weather)) return false;
  if (c.rankAtLeast && (!context || !context.race || context.race.rank < c.rankAtLeast)) return false;
  if (c.betType && (!context || !context.bet || context.bet.type !== c.betType)) return false;
  if (c.tag && (!context || !context.tags || !context.tags.includes(c.tag))) return false;
  if (typeof c.test === "function" && !c.test(context)) return false;
  return true;
}

// §5 action handlers (V1 subset).
function runEventActions(ev, context) {
  for (const a of (ev.actions || [])) {
    const text = (typeof a.text === "function") ? a.text(context) : a.text;
    switch (a.type) {
      case "dialogue":
      case "tutorial_message":
        showEvent(speakerLabel(a.speaker), text);
        break;
      case "system_message":
        showEvent("システム", text);
        break;
      case "panyu_message":
        showEvent(speakerLabel(a.speaker), text);
        break;
      case "coin_rescue": {
        const lv = state.player.villageLevel;
        const amt = (a.amount != null) ? a.amount : (RESCUE_COINS[lv] || 300);
        state.player.coins += amt;
        // attach amount info so a subsequent dialogue line can reference it
        if (context) context.rescueAmount = amt;
        break;
      }
      case "rank_unlock_note":
        // future expansion
        break;
      default:
        console.warn("Unknown action type:", a.type);
    }
  }
  // §18 effects.setFlags
  if (ev.effects && ev.effects.setFlags) {
    for (const k in ev.effects.setFlags) {
      setStoryFlag(k, ev.effects.setFlags[k]);
    }
  }
  // §17 condition.once handling
  if (ev.condition && ev.condition.once) {
    setStoryFlag("_event_fired_" + ev.id, true);
  }
}

const SPEAKER_LABELS = {
  mimi: "ミミ",
  sake_udada: "サケ・ウダダ",
  announcer: "実況",
  system: "システム",
  dragon_villager: "村の竜使い"
};
function speakerLabel(id) { return SPEAKER_LABELS[id] || id || "—"; }

function runEventHooks(hookName, context) {
  const list = eventHooks[hookName];
  if (!list || list.length === 0) return;
  // §13 priority: descending; default 0
  const sorted = [...list].sort((a,b) => (b.priority||0) - (a.priority||0));
  for (const ev of sorted) {
    if (eventConditionMet(ev, context)) {
      runEventActions(ev, context);
    }
  }
}

// ----- UI dialogue queue (unchanged from previous V1) -----
const EVENT_QUEUE = [];
function showEvent(speaker, text) {
  EVENT_QUEUE.push({ speaker, text });
  flushEventQueue();
}
function flushEventQueue() {
  const overlay = document.getElementById("event-overlay");
  if (!overlay) return;
  if (!overlay.classList.contains("hidden")) return;
  const next = EVENT_QUEUE.shift();
  if (!next) return;
  document.getElementById("event-speaker").textContent = next.speaker;
  document.getElementById("event-text").textContent = next.text;
  overlay.classList.remove("hidden");
}

// ===== §25 V1 Sample Events + Phase 5 milestones =====

// First race tutorial (Mimi general intro)
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

// §25 first_race_intro: after selecting Race1
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

// After entry list, Sake warning about overbet favorite (Race1 has Ruben as fav)
registerEvent({
  id: "sake_overbet_favorite_warning",
  hook: "afterEntryList",
  condition: { once: true, raceId: "race_grandclock_1" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "前走勝った竜は買われやすい。だが、今日の区間が合うとは限らない。" }
  ]
});

// §25 first_wide_tutorial
registerEvent({
  id: "first_wide_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "wide" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "ワイド竜は、選んだ2竜がどちらも三着以内なら当たりだ。穴を拾う時に使いやすい。" }
  ]
});

// Weather reaction after race select (strong_wind)
registerEvent({
  id: "mimi_strong_wind_first",
  hook: "afterRaceSelect",
  condition: { once: true, weather: "strong_wind" },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "強風ですね……耳が横に持っていかれます！ 翼の強い子だけじゃなくて、落ち着いて飛べる子も見たいです。" }
  ]
});

// ===== §10 Phase 2: Region first-visit comments =====
registerEvent({
  id: "first_visit_grand_clock",
  hook: "afterRaceSelect",
  condition: { once: true, region: "グランドクロック地域" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "グランドクロック地域だ。竜レースの基本を学ぶ場所。時計塔の下で、まずは予想を組み立てる癖をつけよう。" }
  ]
});
registerEvent({
  id: "first_visit_lumina",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ルミナ地域" },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "ルミナ地域だ……空が広い！ 風が強いから、翼の安定感が大事ね。" }
  ]
});
registerEvent({
  id: "first_visit_ring_rosso",
  hook: "afterRaceSelect",
  condition: { once: true, region: "リングロッソ地域" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "リングロッソ。回転と気性の世界だ。スピードだけじゃ勝てん。" }
  ]
});
registerEvent({
  id: "first_visit_caldera",
  hook: "afterRaceSelect",
  condition: { once: true, region: "カルデラ地域" },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "カルデラ……熱気がすごい！ 火力人気の竜が買われやすいけど、スタミナが残るかをよく見ましょう。" }
  ]
});
registerEvent({
  id: "first_visit_mistlake",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ミストレイク地域" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ミストレイク。視界が悪い時こそ、気性と回転で走れる竜が活きる。" }
  ]
});
registerEvent({
  id: "first_visit_vento",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ヴェント峡谷地域" },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "ヴェント峡谷……崖から風が吹き上がってる！ ここは翼性能の本場ね。" }
  ]
});
registerEvent({
  id: "first_visit_notte",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ノッテムーンライト地域" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ノッテムーンライト。夜のレースは観衆の興奮で人気が偏りやすい。市場を冷静に読め。" }
  ]
});
registerEvent({
  id: "first_visit_lapan",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ラパン祭典地域" },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "ラパン祭典地域……！ ここは祭典級のレースが行われる聖地よ。観衆の熱気がオッズを狂わせるわ。チャンスね。" }
  ]
});

// ===== §10 Phase 2: Bet type tutorials (win and place; wide already exists) =====
registerEvent({
  id: "first_win_bet_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "win" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "単竜は一着を当てる賭けだ。自信がある時は強いが、迷うなら複竜やワイド竜も見ろ。" }
  ]
});
registerEvent({
  id: "first_place_bet_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "place" },
  actions: [
    { type: "tutorial_message", speaker: "mimi",
      text: "複竜は3着以内なら的中だよ！ オッズは低めだけど、安定して当てたい時に便利。" }
  ]
});

// ===== §10 Phase 2: More race result reactions (Sake commentary) =====
registerEvent({
  id: "sake_upset_comment",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank >= 5 },
  priority: 5,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "波乱だな。市場の見落としだ。こういうレースを拾えるのが、いい予想家の証だ。" }
  ]
});
registerEvent({
  id: "sake_favorite_holds",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank === 1 && ctx.hit },
  priority: 5,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "順当だ。人気馬を素直に買うのも、立派な予想だ。" }
  ]
});

// ===== §10 Phase 4: Rank unlock / High-rank intros / Festival atmosphere =====
// rank_up_celebration (Lv1→Lv2) は既存。ここでは higher rank の specific intros。
registerEvent({
  id: "rank4_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 4, test: ctx => ctx && ctx.race && ctx.race.rank === 4 },
  priority: 8,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "大地域杯。ここからは市場が本格的にハイプを乗せ始める。前走の結果や派手さに釣られず、コースと適性を冷静に読め。" }
  ]
});
registerEvent({
  id: "rank5_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 5, test: ctx => ctx && ctx.race && ctx.race.rank === 5 },
  priority: 8,
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "竜王杯……ここまで来たね。賞金の桁が変わるけど、ブランドや前走勝利が市場を支配するから、妙味も大きいわ。" }
  ]
});
registerEvent({
  id: "rank6_first_intro_festival",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 6, test: ctx => ctx && ctx.race && ctx.race.rank === 6 },
  priority: 8,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "祝祭級だ。観衆と新聞のハイプが極端になる。看板の竜が過剰人気になりやすい。狙うのは、冷静な実力派だ。" }
  ]
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

// Major dragon rival intros — Phase 9 で追加した4竜の初遭遇
registerEvent({
  id: "rival_intro_phenix",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("phenix")
  },
  priority: 7,
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "鳳凰竜フェニックス……！ 黄金の翼の伝説的な竜。観衆が大歓声を上げるわ。市場は本命視するけど、これだけ買われると本当に+EVなのか？" }
  ]
});
registerEvent({
  id: "rival_intro_raika",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("raika")
  },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "雷角竜ライカ。電光石火の逃げ脚だが、気性が荒い。ハイペースを作るが、自分も終盤で苦しくなる。" }
  ]
});
registerEvent({
  id: "rival_intro_stella",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("stella")
  },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "星光竜ステラ……差し脚で翼も気性も安定してる。夜や霧でも強い、隠れた本格派ね。" }
  ]
});
registerEvent({
  id: "rival_intro_glaze",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("glaze")
  },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "氷甲竜グレイズ。地味だが耐久・気性・スタミナが揃ってる。長距離・霧・耐久戦で値段以上を見せるタイプだ。" }
  ]
});

// ===== §10 §8.13 / Phase 3 Village reactions =====
registerEvent({
  id: "village_first_levelup",
  hook: "onVillageUpdate",
  condition: { once: true },
  priority: 5,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "村が育ってきたな。応援も増え、予備コインの貯えも厚くなった。これからのレースが楽しみだ。" }
  ]
});
registerEvent({
  id: "village_levelup_generic",
  hook: "onVillageUpdate",
  condition: { once: false },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: ctx => `村レベルが ${ctx && ctx.newLevel ? ctx.newLevel : "?"} に上がったよ！ 賭金倍率と救済コインが上がるわ。` }
  ]
});

// ===== §10 Phase 3: Crybaby dragon (Poro) story =====
// §09 §20: First emotional dragon, "appearance vs true condition" tutorial.
// Triggers when Poro has been seen in a race the player attended.

// First seeing Poro on entry list
registerEvent({
  id: "poro_first_sight",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("poro")
  },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "あ……泣き虫竜ポロちゃん！ 泣いてて市場は弱そうに見ているけど、足音は意外と落ち着いてる。市場の見落としかも。" }
  ]
});

// After 3 races where Poro ran — unlock condition story
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

// First time Poro finishes top 3 — emotional payoff
registerEvent({
  id: "poro_first_place",
  hook: "afterRaceResult",
  condition: {
    once: true,
    test: ctx => ctx && state.current && state.current.raceResult &&
      state.current.raceResult.entries.slice(0,3).some(e => e.dragon.id === "poro")
  },
  priority: 8,
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "ポロちゃん、3着以内に入った……！ 泣いてても走れる、ちゃんと走れるんだね……ぐすっ。" }
  ]
});

// §25 panyu_after_tense_preview
registerEvent({
  id: "panyu_after_tense_preview",
  hook: "afterDragonPreview",
  condition: { once: false, tag: "tense_race" },
  actions: [
    { type: "panyu_message", speaker: "mimi",
      text: "ぱほぱほ！ 場が和んだ！" }
  ]
});

// After race result — Mimi reaction (hit/miss)
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

// §25 first_bankruptcy_rescue
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

// Rank up — Phase 5 milestone
registerEvent({
  id: "rank_up_celebration",
  hook: "onRankUp",
  condition: { once: false },
  actions: [
    { type: "dialogue", speaker: "mimi",
      text: "おめでとう！ プレイヤーランクが上がりました！ 賭け上限も増えて、新しいレースに挑めるわ！" }
  ]
});

// §08 §18 economy milestones
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
