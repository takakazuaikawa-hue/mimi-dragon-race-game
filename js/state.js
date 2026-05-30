// Player state and current-race transient state.
const SAVE_KEY = "mimi_dragon_race_v0_1";

const state = {
  player: {
    coins: 1000,
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
      version: "0.1.0",
      player: state.player,
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
      return true;
    }
  } catch (e) {
    console.warn("load failed", e);
  }
  return false;
}

function resetGame() {
  state.player = {
    coins: 1000, rank: 1, villageLevel: 1,
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
  raceResult.entries.forEach(e => {
    const entry = ensureCollectionEntry(e.dragon.id);
    entry.seen = true;
    entry.unlocked = true;  // V1: unlock on first race seen
    entry.notesUnlocked.basic = true;
    entry.records.racesSeen += 1;
    if (e.rank === 1) entry.records.winsSeen += 1;
    if (e.rank <= 3) entry.records.top3Seen += 1;
    if (!state.player.village.unlockedDragonIds.includes(e.dragon.id)) {
      state.player.village.unlockedDragonIds.push(e.dragon.id);
    }
  });
  if (bet && bet.selections) {
    bet.selections.forEach(id => {
      const entry = ensureCollectionEntry(id);
      entry.records.playerBetCount += 1;
      if (betResult && betResult.hit) entry.records.playerHitCount += 1;
    });
  }
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

// Helper: format big integer-like numbers per §08 §15.
// Below 10,000 → comma-formatted.
// 10,000+ → use 万/億/兆/京 units with up to 2 decimals.
function fmtCoins(n) {
  if (typeof n !== "number") return String(n);
  const abs = Math.abs(n);
  if (abs < 10000) return n.toLocaleString("ja-JP");
  const sign = n < 0 ? "-" : "";
  const a = abs;
  const units = [
    { v: 1e16, u: "京" },
    { v: 1e12, u: "兆" },
    { v: 1e8,  u: "億" },
    { v: 1e4,  u: "万" }
  ];
  for (const { v, u } of units) {
    if (a >= v) {
      const num = a / v;
      const display = num >= 100 ? Math.floor(num).toLocaleString("ja-JP") : num.toFixed(2).replace(/\.?0+$/, "");
      return `${sign}${display}${u}`;
    }
  }
  return sign + Math.floor(a).toLocaleString("ja-JP");
}
