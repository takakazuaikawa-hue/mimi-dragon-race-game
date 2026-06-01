/**
 * event_hooks.js — event system core (spec §10).
 *
 * Provides hook slots (§10 §3), event schema evaluator (§10 §4), action
 * dispatcher (§10 §5), priority/once handling (§10 §13/§17), story flag
 * persistence (§10 §16), and the modal dialogue queue.
 *
 * Event REGISTRATIONS live in event_registry.js. Keep this file mechanism-only.
 *
 * Depends on: utils.js (none directly, but loaded order matters), state.js
 * (state.player.flags, saveGame), data_ranks.js (RESCUE_COINS).
 *
 * EXTENSION POINT:
 *   - New hook slot → add to `eventHooks` map, call runEventHooks(name, ctx)
 *     from the relevant code path.
 *   - New action type → add case in runEventActions switch.
 *   - New condition key → add check in eventConditionMet.
 */

// §10 §3 Required hook points (+ Phase 5/6 economy extras).
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
  // Phase 5/6 economy/progression extras
  onRankUp: [],
  onMilestone: []
};

// §10 §16 story flags — persisted via player.flags (resides in state.js).
function getStoryFlag(name) { return !!state.player.flags[name]; }
function setStoryFlag(name, val) { state.player.flags[name] = val; saveGame(); }

function registerEvent(ev) {
  if (!eventHooks[ev.hook]) {
    console.warn("Unknown hook:", ev.hook);
    return;
  }
  eventHooks[ev.hook].push(ev);
}

// §10 §17 condition evaluation. All declared keys must match; `test` may be
// a function for ad-hoc predicates.
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

// §10 §5 action handlers (V1 subset). action.text may be a string or a
// function(context) → string for dynamic messages.
function runEventActions(ev, context) {
  for (const a of (ev.actions || [])) {
    const text = (typeof a.text === "function") ? a.text(context) : a.text;
    switch (a.type) {
      case "dialogue":
      case "tutorial_message":
      case "panyu_message":
        showEvent(speakerLabel(a.speaker), text);
        break;
      case "system_message":
        showEvent("システム", text);
        break;
      case "coin_rescue": {
        const lv = state.player.villageLevel;
        const amt = (a.amount != null) ? a.amount : (RESCUE_COINS[lv] || 300);
        state.player.coins += amt;
        if (context) context.rescueAmount = amt;
        break;
      }
      case "rank_unlock_note":
        // Future expansion: granular race unlock notifications.
        break;
      default:
        console.warn("Unknown action type:", a.type);
    }
  }
  // §10 §18 effects.setFlags
  if (ev.effects && ev.effects.setFlags) {
    for (const k in ev.effects.setFlags) {
      setStoryFlag(k, ev.effects.setFlags[k]);
    }
  }
  // §10 §17 condition.once handling
  if (ev.condition && ev.condition.once) {
    setStoryFlag("_event_fired_" + ev.id, true);
  }
}

// §10 §14 speaker labels.
const SPEAKER_LABELS = {
  mimi: "ミミ",
  sake_udada: "サケ・ウダダ",
  announcer: "実況",
  system: "システム",
  dragon_villager: "村の竜使い"
};
function speakerLabel(id) { return SPEAKER_LABELS[id] || id || "—"; }

// Main dispatcher — priority desc, default 0.
function runEventHooks(hookName, context) {
  const list = eventHooks[hookName];
  if (!list || list.length === 0) return;
  const sorted = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const ev of sorted) {
    if (eventConditionMet(ev, context)) {
      runEventActions(ev, context);
    }
  }
}

// ===== UI dialogue queue =====
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
