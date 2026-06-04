/**
 * state.js — central player state, save/load, progression hooks.
 *
 * Holds the only mutable runtime store (`state`) plus helpers that mutate it:
 * collection records, village exp/level, rank progression, milestone events.
 *
 * Depends on: utils.js (fmtCoins), data_ranks.js (RANK_UNLOCK, VILLAGE_MULT,
 * RESCUE_COINS), event_hooks.js (runEventHooks for level-up / rank-up triggers).
 *
 * EXTENSION POINT: when adding new persistent fields, also extend
 * `resetGame()`, `state.player` initial object, and bump SAVE_VERSION below if
 * the new field changes save layout in a non-backwards-compatible way.
 */
const SAVE_KEY = "mimi_dragon_race_v0_1";
const SAVE_VERSION = "1.1.0";  // #30: + maxCoinsReached/totalAssets + state.assets

const state = {
  player: {
    coins: 1000,
    // §30 §3.1 — progression uses the all-time coin high-water mark, never the
    // current (bettable) balance, so a losing bet never rolls back the story.
    maxCoinsReached: 1000,
    totalAssets: 0,   // recomputed by recomputeAssets(); high-water (never drops)
    rank: 1,
    villageLevel: 1,  // shortcut to village.level (kept for backwards compat)
    completedRaces: 0,
    wins: 0,
    // §08 §17 progression
    completedByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    winsByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    biggestPayout: 0,
    flags: {
      seenFirstRaceTutorial: false,
      seenFirstWideTutorial: false,
      reachedCoins_10000: false,
      reachedCoins_100000000: false,
      firstWideHit: false,
      firstRankUp: false
    },
    // §09 §4 VillageState (V1 minimal — §26 forward compatibility)
    village: {
      level: 1,
      name: "泣き虫ドラゴン村",
      rescueCoinBase: 300,
      facilities: {
        paddock: 0, newspaper: 0, grandstand: 0,
        riderPost: 0, dragonStable: 0, exchange: 0
      },
      unlockedDragonIds: [],
      favoriteDragonIds: [],
      entryEncouragement: { available: false, remainingUses: 0, candidateDragonIds: [] },
      storyFlags: {},
      eventFlags: {}
    },
    // §09 §9 dragon collection — per-dragon records
    collection: {}  // dragonId -> { seen, unlocked, favorite, records: {...}, notesUnlocked: {...} }
  },
  // §30 §13.1 total-asset / lifestyle store (kept separate from player.coins).
  // Values are recomputed by recomputeAssets() (assets_engine.js); the defaults
  // here are inlined (not from data_assets.js) so state.js has no load-order dep.
  assets: {
    villageValue: 0, facilityValue: 0, livingValue: 0,
    fameValue: 0, dragonValue: 0,
    lifeItems: [],            // owned purchasable cosmetics
    unlockedLifeStages: 0,    // high-water asset level (story gate; never drops)
    rescueBonus: 0            // flat rescue add from unlocked life assets
  },
  ui: {
    screen: "home",           // home | race_select | race_detail | bet | race_run | result | analysis
    debug: false,
    // §07 §8 infoDisplayLevel: simple | standard | advanced | expert
    infoLevel: "standard"
  },
  current: null  // { race, entries, oddsData, raceResult, bet, ... }
};

function saveGame() {
  try {
    const data = {
      version: SAVE_VERSION,
      player: state.player,
      assets: state.assets,   // §30 total-asset / lifestyle store
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("save failed", e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && data.player) {
      Object.assign(state.player, data.player);
      if (data.assets) Object.assign(state.assets, data.assets);
      // §30 migration: pre-1.1 saves lack maxCoinsReached — seed it from coins
      // so an existing player's progression isn't reset to zero.
      if (state.player.maxCoinsReached == null) state.player.maxCoinsReached = state.player.coins || 0;
      // Durability: a race confirmed but abandoned before its 答え合わせ left an owed
      // payout (settleRace never ran). Credit it now so no winning ticket is lost.
      if (state.player.pendingPayout > 0) {
        state.player.coins += state.player.pendingPayout;
        if (state.player.coins > (state.player.maxCoinsReached || 0)) state.player.maxCoinsReached = state.player.coins;
      }
      state.player.pendingPayout = 0;
      return true;
    }
  } catch (e) {
    console.warn("load failed", e);
  }
  return false;
}

function resetGame() {
  state.player = {
    coins: 1000, maxCoinsReached: 1000, totalAssets: 0,
    rank: 1, villageLevel: 1,
    completedRaces: 0, wins: 0,
    completedByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    winsByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    biggestPayout: 0,
    flags: {
      seenFirstRaceTutorial:false, seenFirstWideTutorial:false,
      reachedCoins_10000:false, reachedCoins_100000000:false,
      firstWideHit:false, firstRankUp:false
    },
    village: {
      level: 1, name: "泣き虫ドラゴン村", rescueCoinBase: 300,
      facilities: { paddock:0, newspaper:0, grandstand:0, riderPost:0, dragonStable:0, exchange:0 },
      unlockedDragonIds: [], favoriteDragonIds: [],
      entryEncouragement: { available: false, remainingUses: 0, candidateDragonIds: [] },
      storyFlags: {}, eventFlags: {}
    },
    collection: {}
  };
  state.assets = {
    villageValue: 0, facilityValue: 0, livingValue: 0,
    fameValue: 0, dragonValue: 0,
    lifeItems: [], unlockedLifeStages: 0, rescueBonus: 0
  };
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  saveGame();
  if (typeof updateHeader === "function") updateHeader();
}

// §09 §9 collection record helpers
function ensureCollectionEntry(dragonId) {
  if (!state.player.collection[dragonId]) {
    state.player.collection[dragonId] = {
      dragonId,
      seen: false, unlocked: false, favorite: false,
      records: {
        racesSeen: 0, winsSeen: 0, top3Seen: 0,
        playerBetCount: 0, playerHitCount: 0
      },
      notesUnlocked: {
        basic: false, condition: false, courseFit: false,
        marketBias: false, story: false
      }
    };
  }
  return state.player.collection[dragonId];
}

function updateCollectionFromRace(raceResult, bet, betResult) {
  // Record every dragon that ran (seen + race counter), winner/top3,
  // and the player's bet/hit per selected dragon (§9 records schema).
  let newDragons = 0;
  raceResult.entries.forEach(e => {
    const entry = ensureCollectionEntry(e.dragon.id);
    const wasNew = !entry.seen;
    entry.seen = true;
    entry.unlocked = true;  // V1: unlock on first race seen
    entry.records.racesSeen += 1;
    if (e.rank === 1) entry.records.winsSeen += 1;
    if (e.rank <= 3) entry.records.top3Seen += 1;
    if (!state.player.village.unlockedDragonIds.includes(e.dragon.id)) {
      state.player.village.unlockedDragonIds.push(e.dragon.id);
    }
    if (wasNew) newDragons += 1;
    unlockCollectionNotes(entry);
  });
  raceResult._newDragonsThisRace = newDragons;
  if (bet && bet.selections) {
    bet.selections.forEach(id => {
      const entry = ensureCollectionEntry(id);
      entry.records.playerBetCount += 1;
      if (betResult && betResult.hit) entry.records.playerHitCount += 1;
      unlockCollectionNotes(entry);
    });
  }
}

// §09 §11: Progressive note unlocking by player familiarity.
function unlockCollectionNotes(entry) {
  const seen = entry.records.racesSeen;
  const bet = entry.records.playerBetCount;
  // 1 race seen → basic info known
  if (seen >= 1) entry.notesUnlocked.basic = true;
  // 3 races seen → condition (足取り・気性) shown
  if (seen >= 3) entry.notesUnlocked.condition = true;
  // 5 races seen → course fit (適性) shown
  if (seen >= 5) entry.notesUnlocked.courseFit = true;
  // 2 bets placed → market bias shown
  if (bet >= 2) entry.notesUnlocked.marketBias = true;
  // 8 races seen + top3 history → story flavor
  if (seen >= 8 && entry.records.top3Seen >= 1) entry.notesUnlocked.story = true;
}

// Helper for collection UI: text description for each note.
function getCollectionNoteText(entry, dragon) {
  const n = entry.notesUnlocked || {};
  const lines = [];
  if (n.basic) lines.push(`脚質: ${STYLE_LABEL[dragon.style]} / 特徴: ${dragon.traits.join("・")}`);
  if (n.condition) lines.push(`気性${statRank(dragon.stats.nerve)}・体調印象${(dragon.visualMood||50) >= 70 ? "良好" : "並"}`);
  if (n.courseFit) {
    const rep = dragon.courseReputation || {};
    const top = Object.entries(rep).filter(([k,v]) => v >= 75).map(([k,v]) => k).slice(0,3);
    lines.push(`得意: ${top.length ? top.join("/") : "汎用"}`);
  }
  if (n.marketBias) lines.push(`市場印象: 新聞印${dragon.newspaperMark || "－"} / 見た目人気${(dragon.publicImage||50)>=75?"高":(dragon.publicImage||50)<=45?"低":"中"}`);
  if (n.story) lines.push(`物語: ${dragon.portraitTone || "—"}`);
  return lines;
}

// §09 §18 Village level-up logic.
// VillageExp += raceRank*10 + (hit ? raceRank*5 : 0) + (newDragonSeen ? 20 : 0).
// Threshold for next level: level * 100.
function gainVillageExp(race, hit, newDragonsThisRace) {
  const v = state.player.village;
  if (!v.exp) v.exp = 0;
  let gain = race.rank * 10 + (hit ? race.rank * 5 : 0) + (newDragonsThisRace || 0) * 20;
  v.exp += gain;
  const threshold = v.level * 100;
  if (v.exp >= threshold && v.level < 10) {
    v.exp -= threshold;
    v.level += 1;
    state.player.villageLevel = v.level; // sync shortcut
    runEventHooks("onVillageUpdate", { newLevel: v.level, gain });
    saveGame();
    return v.level;
  }
  saveGame();
  return null;
}

// §08 §11 Check rank unlock after race.
function checkRankProgression() {
  const p = state.player;
  for (let r = p.rank + 1; r <= 7; r++) {
    const cond = RANK_UNLOCK[r];
    if (!cond) break;
    const completedLower = p.completedByRank[r - 1] || 0;
    if (p.coins >= cond.coins || completedLower >= cond.completedAtLowerRank) {
      p.rank = r;
      runEventHooks("onRankUp", { newRank: r });
      saveGame();
      return r;
    } else {
      break;
    }
  }
  return null;
}

// §08 §18 Economy milestone events.
function checkEconomyMilestones(betResult) {
  const p = state.player;
  if (p.coins >= 10000) runEventHooks("onMilestone", { kind: "coins_10000" });
  if (p.coins >= 100000000) runEventHooks("onMilestone", { kind: "coins_100000000" });
  if (betResult && betResult.hit && state.current && state.current.bet.type === "wide") {
    runEventHooks("onMilestone", { kind: "first_wide_hit" });
  }
  if (betResult && betResult.payout > p.biggestPayout) {
    p.biggestPayout = betResult.payout;
  }
  saveGame();
}

// fmtCoins moved to utils.js (used by many modules, kept dependency-free).
