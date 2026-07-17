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
  onMilestone: [],
  // §30 total-asset progression: fired when a new story/lifestyle stage unlocks.
  onStoryUnlock: []
};

// §10 §16 story flags — persisted via player.flags (resides in state.js).
function getStoryFlag(name) { return !!state.player.flags[name]; }
function setStoryFlag(name, val) { state.player.flags[name] = val; saveGame(); }

// ★D9〜D11（NARRATIVE_DESIGN）: 同じ閾値で toast/號外/SNS が同時多重発火しないための時差ヘルパー。
//   条件の初達成時刻（走数/日）を flags に刻み、號外=+1レース後・SNS投稿/手紙=+1日後に true になる。
//   表示解禁のタイミングだけを遅らせる＝進行・経済・レース数値には一切非干渉。
function unlockDelayRace(key, cond) {
  try {
    if (!cond) return false;
    const fl = state.player.flags, k = "_dly_race_" + key;
    if (fl[k] == null) { fl[k] = (state.player.completedRaces || 0); saveGame(); }
    return (state.player.completedRaces || 0) >= fl[k] + 1;
  } catch (e) { return !!cond; }   // 判定不能なら遅延なしで開く（閉じ込めない側に倒す）
}
function unlockDelayDay(key, cond) {
  try {
    if (!cond) return false;
    const fl = state.player.flags, k = "_dly_day_" + key;
    const today = Math.floor(Date.now() / 86400000);
    if (fl[k] == null) { fl[k] = today; saveGame(); }
    return today > fl[k];
  } catch (e) { return !!cond; }
}

function registerEvent(ev) {
  if (!eventHooks[ev.hook]) {
    console.warn("Unknown hook:", ev.hook);
    return;
  }
  eventHooks[ev.hook].push(ev);
}

// ★話者ゲート（正本 R1/R2）──────────────────────────────────────────
//   イベントの発火条件は once/flag/race… しか見ておらず「誰が喋るか」を見ていなかった。
//   そのため registry に speaker:"mizu" と書くだけで、物語で出会う前のミズが立ち絵つきで
//   喋ってしまう（例: 新規プレイヤーの初レース選択で first_race_intro_mimi が発火）。
//   顧問5人（STORY_CAST）の“登場”の唯一の述語は advisorMet() なので、話者IDをその門番に通す。

// dialogue.js の ALIAS と同じ表記ゆれ吸収（registry は sake_udada 等の旧IDで書かれている）。
const EVENT_SPEAKER_ALIAS = {
  sake_udada: "sake",
  dragon_villager: "villager"
};

// 顧問5人（＝ゲート対象）。STORY_CAST 未ロード時に門番が素通しにならないための控え（fail-closed）。
const GATED_CAST_KEYS = ["sake", "mizu", "sumika", "makura", "celestia"];

function eventSpeakerCastKey(id) {
  if (id == null || id === "") return "narrator";   // 話者なしの action（coin_rescue 等）はナレーション扱い
  const s = String(id);
  return EVENT_SPEAKER_ALIAS[s] || s;
}

// STORY_CAST のキーだけがゲート対象。mimi/announcer/system/villager/narrator/モブは常時OK。
function eventSpeakerGated(key) {
  try {
    if (typeof STORY_CAST === "object" && STORY_CAST && STORY_CAST[key]) return true;
  } catch (e) {}
  return GATED_CAST_KEYS.indexOf(key) >= 0;   // STORY_CAST が読めない時も顧問は伏せる側に倒す
}

// 話者を出してよいか。顧問は advisorMet() のみが門番。判定不能なら「出さない」（fail-closed R6）。
function speakerAllowed(id) {
  const key = eventSpeakerCastKey(id);
  if (!eventSpeakerGated(key)) return true;
  if (typeof advisorMet !== "function") return false;   // ネタバレは不可逆・非表示は無害
  try { return !!advisorMet(key); } catch (e) { return false; }
}

// セリフを出す action の型（＝話者ゲートの対象）。coin_rescue 等の副作用 action は話者を持たない。
const SPEECH_ACTION_TYPES = ["dialogue", "tutorial_message", "panyu_message", "system_message"];

// 「セリフしか持たない」イベントか。副作用（救済コイン・フラグ付与）を持つものは持ち越し禁止＝
// 遅らせると経済/進行が止まるので、行単位で落として必ず発火させる。
function eventSpeechOnly(ev) {
  if (ev.effects) return false;
  return (ev.actions || []).every(a => SPEECH_ACTION_TYPES.indexOf(a.type) >= 0);
}

// イベント全体の可否。
//  ・once × セリフのみ … 1行でも未登場の顧問が混ざるなら発火させず“持ち越す”。
//    （some で発火させると、その行だけ落ちたまま once が消費され、出会った後も二度と出ない＝空撃ち。）
//  ・それ以外 … 喋れる話者が一人でも居れば発火し、未登場の行だけ落とす（once が無い＝取りこぼさない）。
function eventSpeakersAllowed(ev) {
  const acts = ev.actions || [];
  if (!acts.length) return true;   // セリフを持たない（effects だけの）イベントは対象外
  const once = !!(ev.condition && ev.condition.once);
  if (once && eventSpeechOnly(ev)) return acts.every(a => speakerAllowed(a.speaker));
  return acts.some(a => speakerAllowed(a.speaker));
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
  // ★話者ゲート：喋れる話者が一人もいない（＝未登場の顧問しか喋らない）イベントは発火させない。
  //   発火前に落とすので once が空撃ちで消費されず、出会った後の初回にちゃんと出る。
  if (!eventSpeakersAllowed(ev)) return false;
  return true;
}

// §10 §5 action handlers (V1 subset). action.text may be a string or a
// function(context) → string for dynamic messages.
function runEventActions(ev, context) {
  const _speech = [];   // この event のセリフを集約 → 立ち絵プレイヤーへ一括
  for (const a of (ev.actions || [])) {
    // ★話者ゲート：混在イベント（ミミ＋顧問など）は、未登場の顧問の行だけ落とす。
    if (!speakerAllowed(a.speaker)) continue;
    const text = (typeof a.text === "function") ? a.text(context) : a.text;
    switch (a.type) {
      case "dialogue":
      case "tutorial_message":
      case "panyu_message":
        // 立ち絵つきセリフへ（speaker は ID のまま渡す＝standee/表情解決）。
        // 任意で a.expr を指定すると表情を固定（無ければミミは文面から自動推定）。
        _speech.push({ s: a.speaker, t: text, e: a.expr });
        break;
      case "system_message":
        _speech.push({ s: "system", t: text, e: a.expr });
        break;
      case "coin_rescue": {
        // §30 §10/§13.4 — rescue scales with the life Mimi has rebuilt
        // (living/fame/village bonuses), not just village level.
        const lv = state.player.villageLevel;
        const amt = (a.amount != null) ? a.amount
          : (typeof calculateRescueCoins === "function"
              ? calculateRescueCoins(state, state.player.rank)
              : (RESCUE_COINS[lv] || 300));
        state.player.coins += amt;
        if (typeof bumpMaxCoins === "function") bumpMaxCoins();
        if (typeof recomputeAssets === "function") recomputeAssets(state);
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
  return _speech;
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
// ★1ティック1VN（NARRATIVE_DESIGN W3・P8）：同じフックで“セリフだけ”のイベントが複数条件を
//   満たしても、再生するのは優先度最上位の1本だけ。残りは発火させない＝once が未消費のまま
//   次の機会に自然と持ち越される（同閾値の三重発火で無関係な話が連結される事故を防ぐ）。
//   副作用つきイベント（救済コイン・フラグ）は経済/進行が止まるので予算外＝必ず発火。
function runEventHooks(hookName, context) {
  const list = eventHooks[hookName];
  if (!list || list.length === 0) return;
  const sorted = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  let speech = [];
  let vnBudget = 1;
  for (const ev of sorted) {
    if (eventConditionMet(ev, context)) {
      const speechOnly = eventSpeechOnly(ev);
      if (speechOnly && vnBudget <= 0) continue;   // 持ち越し（once未消費＝空撃ちしない）
      const s = runEventActions(ev, context);
      if (s && s.length) { speech = speech.concat(s); if (speechOnly) vnBudget--; }
    }
  }
  if (speech.length) emitSpeech(speech);
}

// 既存イベントのセリフ群を“立ち絵つき”で再生する一点経路（dialogue.js）。
// 1フック内の全セリフを1つの会話として連続再生。未ロード時は従来モーダルへ。
// → event_registry.js のデータはそのまま、表示だけが立ち絵化される。
function emitSpeech(lines) {
  if (typeof Dialogue !== "undefined" && Dialogue && Dialogue.play) {
    Dialogue.play(lines);
  } else {
    for (let i = 0; i < lines.length; i++) showEvent(speakerLabel(lines[i].s), lines[i].t);
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
