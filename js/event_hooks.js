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
    switch (a.type) {
      case "dialogue":
      case "tutorial_message":
        showEvent(speakerLabel(a.speaker), a.text);
        break;
      case "system_message":
        showEvent("システム", a.text);
        break;
      case "panyu_message":
        showEvent(speakerLabel(a.speaker), a.text);
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
