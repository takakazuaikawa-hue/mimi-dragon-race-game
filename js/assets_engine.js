/**
 * assets_engine.js — total-asset, lifestyle & rescue ENGINE (spec #30).
 *
 * Reads data_assets.js tables + the live `state` and computes:
 *   - the six asset components (village/facility/living/fame/dragon + maxCoins)
 *   - 総資産 (calculateTotalAssets) with a high-water guard so it never drops
 *   - the asset level / unlocked story chapter / lifestyle stage
 *   - the bankruptcy rescue amount (calculateRescueCoins)
 *
 * Hard guarantees (spec #30 §15/§16):
 *   - Never reads current coins for 総資産 — only maxCoinsReached (§3.1).
 *   - 総資産 / unlockedLifeStages are monotonic high-water marks → no story
 *     rollback when a bet loses (§16).
 *   - Nothing here touches race results, payouts, or 《ぱほぱほ》 (§12).
 *   - Lifestyle assets only feed 総資産 + rescue, never race victory (§5.5).
 *
 * EXTENSION POINT: change a component's weighting → edit its compute* fn; add a
 * new component → add a compute* fn and include it in calculateTotalAssets()
 * AND recomputeAssets().
 */

// ---- raise the all-time coin high-water mark (call after any coin gain) ----
function bumpMaxCoins() {
  const p = state.player;
  if ((p.coins || 0) > (p.maxCoinsReached || 0)) p.maxCoinsReached = p.coins;
  return p.maxCoinsReached;
}

// ---- component computations (all derived from existing progression) ----

// §4.3 村資産 — overall richness of the village, by level (not the steep
// RESCUE_COINS curve). Lookup keeps it well under maxCoins at each stage.
const VILLAGE_VALUE_BY_LEVEL = [0, 2000, 8000, 30000, 120000, 500000, 2000000, 8000000, 30000000, 120000000, 500000000];
function computeVillageValue(state) {
  const v = state.player.village || {};
  const lv = v.level || state.player.villageLevel || 1;
  return VILLAGE_VALUE_BY_LEVEL[Math.max(0, Math.min(lv, 10))] || 0;
}

// §4.4 施設価値 — sum of built facility levels (V1 facilities start at 0).
function computeFacilityValue(state) {
  const f = (state.player.village && state.player.village.facilities) || {};
  let sum = 0;
  for (const k in f) sum += (f[k] || 0);
  return sum * 5000;
}

// §4.5 名声価値 — recognition as a 実況予想屋: rank, wins, races run, biggest
// payout, and high-rank participation. Derived from existing stats so it stays
// in sync without new tracking.
function computeFameValue(state) {
  const p = state.player;
  const rankFame   = (p.rank - 1) * 8000;
  const winFame    = (p.wins || 0) * 600;
  const raceFame   = (p.completedRaces || 0) * 120;
  const payoutFame = Math.floor((p.biggestPayout || 0) * 0.002);
  let highRank = 0;
  if (p.completedByRank) for (let r = 4; r <= 7; r++) highRank += (p.completedByRank[r] || 0) * 2000;
  return rankFame + winFame + raceFame + payoutFame + highRank;
}

// §4.7 ドラゴン関連資産 — collection breadth (図鑑/観戦/推し竜). Never affects races.
function computeDragonValue(state) {
  const col = state.player.collection || {};
  let v = 0;
  for (const id in col) {
    const e = col[id];
    if (!e) continue;
    if (e.unlocked) v += 1500;
    if (e.favorite) v += 1000;
    v += ((e.records && e.records.top3Seen) || 0) * 100;
  }
  return v;
}

// §5 生活資産 — sum of unlocked life-asset values + their flat rescue bonuses.
// Auto items unlock at/under `level`; buy items unlock when owned.
function recomputeLiving(state, level) {
  const a = state.assets;
  const owned = a.lifeItems || (a.lifeItems = []);
  let value = 0, rescue = 0;
  for (const item of LIFE_ASSETS) {
    const unlocked = (item.unlockType === "auto")
      ? (level >= item.unlockAssetLevel)
      : owned.includes(item.id);
    if (unlocked) { value += item.value || 0; rescue += item.rescueBonus || 0; }
  }
  a.livingValue = value;
  a.rescueBonus = rescue;
}

function isLifeAssetUnlocked(state, item, level) {
  if (item.unlockType === "buy") return (state.assets.lifeItems || []).includes(item.id);
  return level >= item.unlockAssetLevel;
}

// §13.3 — pure sum of the six components (uses maxCoinsReached, never coins).
function calculateTotalAssets(state) {
  const p = state.player, a = state.assets;
  return (p.maxCoinsReached || 0)
    + (a.villageValue || 0)
    + (a.facilityValue || 0)
    + (a.livingValue || 0)
    + (a.fameValue || 0)
    + (a.dragonValue || 0);
}

/**
 * Recompute every asset component + 総資産 + asset level, then re-unlock living
 * assets at the new level. Because livingValue feeds 総資産 which feeds the
 * level which feeds livingValue, we iterate to a fixed point (cheap: levels are
 * capped at 5 and thresholds are 10× apart, so this converges in ≤2 passes).
 *
 * 総資産 and unlockedLifeStages are stored as high-water marks → never roll back.
 * Returns { total, level, unlockedStory }.
 */
function recomputeAssets(state) {
  if (!state.assets) {
    state.assets = { villageValue:0, facilityValue:0, livingValue:0, fameValue:0,
                     dragonValue:0, lifeItems:[], unlockedLifeStages:0, rescueBonus:0 };
  }
  const a = state.assets;
  a.villageValue  = computeVillageValue(state);
  a.facilityValue = computeFacilityValue(state);
  a.fameValue     = computeFameValue(state);
  a.dragonValue   = computeDragonValue(state);

  let level = a.unlockedLifeStages || 0;           // start from the high-water level
  let total = state.player.totalAssets || 0;       // high-water total
  for (let i = 0; i < 8; i++) {
    recomputeLiving(state, level);
    total = Math.max(total, calculateTotalAssets(state));
    const lv = assetLevelOf(total);
    if (lv <= level) break;
    level = lv;                                     // monotonic climb only
  }
  // finalize at the settled level
  recomputeLiving(state, level);
  total = Math.max(total, calculateTotalAssets(state));
  level = Math.max(level, assetLevelOf(total));

  state.player.totalAssets = total;                // high-water (never drops)
  a.unlockedLifeStages = level;                    // high-water (no story rollback)

  return { total, level, unlockedStory: currentStoryChapter(total) };
}

// §7 — the highest story chapter unlocked at this 総資産 (spec 32 §9 thresholds).
// ★EDは総資産1兆 か、終章クリア（epilogue.edFlag＝絶滅メーターを押し切り最終決戦を完走）で解放。
function epStoryGateOk(ch, total) {
  if (ch.id === "ED" && state.player && state.player.epilogue && state.player.epilogue.edFlag) return true;
  return total >= storyUnlockAt(ch.id);
}
function currentStoryChapter(total) {
  let cur = STORY_CHAPTERS[0];
  for (const ch of STORY_CHAPTERS) { if (epStoryGateOk(ch, total)) cur = ch; }
  return cur;
}

// All story chapters unlocked so far (for the progress list).
function unlockedStoryChapters(total) {
  return STORY_CHAPTERS.filter(ch => epStoryGateOk(ch, total));
}

// §10 / §13.4 — base rescue from the established village-level curve, so the
// bankruptcy economy keeps its existing feel. (rank kept for forward-compat.)
function getBaseRescueCoins(state, rank) {
  const lv = (state.player.village && state.player.village.level) || state.player.villageLevel || 1;
  return RESCUE_COINS[lv] || 300;
}

// §13.4 — rescue = base + small lifestyle/fame/village bonuses + life-item flat
// rescueBonus. Coefficients are deliberately small so the rescue supports a
// retry without erasing the tension of betting (§10.4 / §16).
function calculateRescueCoins(state, rank) {
  const a = state.assets || {};
  const base = getBaseRescueCoins(state, rank);
  const livingBonus  = Math.floor((a.livingValue  || 0) * 0.02);
  const fameBonus    = Math.floor((a.fameValue    || 0) * 0.01);
  const villageBonus = Math.floor((a.villageValue || 0) * 0.01);
  return base + livingBonus + fameBonus + villageBonus + (a.rescueBonus || 0);
}

// §5.4 — buy a purchasable cosmetic with current coins. Returns a small result
// so the UI can react. Never affects races; only living/total/rescue.
function buyLifeItem(id) {
  const item = LIFE_ASSETS.find(x => x.id === id);
  if (!item || item.unlockType !== "buy") return { ok: false, reason: "not_buyable" };
  const a = state.assets;
  if (!a.lifeItems) a.lifeItems = [];
  if (a.lifeItems.includes(id)) return { ok: false, reason: "owned" };
  if ((state.player.coins || 0) < item.price) return { ok: false, reason: "poor" };
  state.player.coins -= item.price;
  a.lifeItems.push(id);
  recomputeAssets(state);
  saveGame();
  if (typeof updateHeader === "function") updateHeader();
  return { ok: true, item };
}
