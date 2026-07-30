/**
 * assets_engine.js — total-asset, lifestyle & rescue ENGINE (spec #30).
 *
 * Reads data_assets.js tables + the live `state` and computes:
 *   - the six asset components (village/facility/living/fame/dragon + coins)
 *   - 資産 (calculateTotalAssets) — いま持っているものの合計。使えば減る。
 *   - 到達最高 (assetsPeak) — 解放判定の正本。減らない。
 *   - the asset level / unlocked story chapter / lifestyle stage
 *   - the bankruptcy rescue amount (calculateRescueCoins)
 *
 * ★二値構成（ここが最重要）:
 *   表示に出る「資産」＝ totalAssets ＝ 現在の純資産。島に投資すればコインが減って
 *   施設の価値が増える＝合計はおおむね保たれ、食事などの消費でだけ本当に減る。
 *   一方、章・スポット・段位などの解放判定は必ず assetsPeak(state) を読む。
 *   この分離がないと「資産を使ったせいで読めた話が閉じる」事故が起きる（§16）。
 *
 * Hard guarantees (spec #30 §15/§16):
 *   - unlockedLifeStages / assetsPeak are monotonic high-water marks → no story
 *     rollback when a bet loses or when the player invests (§16).
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
  // ★BUGFIX（レース数で章/暮らしが進む）：名声は“成功”で伸ばす。純参加項（完走数×120）を撤去
  //   ＝負け続けても総資産（→章/暮らし段位）が勝手に上がらない。参加の実感は村EXP等が担う。
  const payoutFame = Math.floor((p.biggestPayout || 0) * 0.002);
  let highRank = 0;
  if (p.completedByRank) for (let r = 4; r <= 7; r++) highRank += (p.completedByRank[r] || 0) * 2000;
  return rankFame + winFame + payoutFame + highRank;
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

// §13.3 — 資産＝いま持っているものの合計（六成分の素直な足し算）。
// ★設計変更：コイン成分を maxCoinsReached（史上最高額）から coins（現在額）へ。
//   旧仕様では島に何億投資しても資産が1円も減らず、「資産」という語からプレイヤーが
//   期待する挙動と逆だった。現在額にすることで、島に投資する＝コインが減って施設の
//   価値が上がる＝お金が資産に形を変えただけ、という動きが数字の上で見える。
//   進行の巻き戻り（＝一度開いた話が資産を使ったせいで閉じる）は assetsPeak が防ぐ。
// ★2026-07-30 島づくり投資の資産計上（docs/ENDGAME_ECONOMY_REDESIGN.md 柱B・ユーザー決裁）。
//   投資累計＝現在の各分野レベルから決定的に導出（コスト表で評価・保存フィールド不要＝後方互換）。
//   「投資すると総資産が減る」旧仕様を廃し、投資＝コインを島の資産に置き換える行為にする。
//   island.js 未ロード時は 0（recomputeAssets は毎レース呼ばれるので、ロード後に自然に正しくなる）。
function computeIslandValue(state) {
  try {
    if (typeof ISLAND_CATS === "undefined") return 0;
    const lvmap = (state.player.island && state.player.island.lv) || {};
    let total = 0;
    for (const c of ISLAND_CATS) {
      const lv = Math.max(0, Math.min(lvmap[c.id] || 0, c.maxLv));
      for (let l = 0; l < lv; l++) total += Math.round(c.base * Math.pow(c.growth, l) / 10000) * 10000;
    }
    return total;
  } catch (e) { return 0; }
}

// ★総資産の内訳＝ここが唯一の正本。合計・内訳バー・「お金のしくみ」の説明文は全部この表から引く。
//   （以前は 計算式／内訳バーのラベル／説明文 が三重管理になっていて、islandValue を足したとき
//     説明文だけ古いまま残った。同じ事故を繰り返さないための単一化。）
const ASSET_PARTS = [
  { key: "coins",         label: "コイン",       color: "#e6b24a", get: st => (st.player.coins || 0) },
  { key: "villageValue",  label: "村",           color: "#49c89c", get: st => ((st.assets || {}).villageValue  || 0) },
  { key: "facilityValue", label: "施設",         color: "#57b1dd", get: st => ((st.assets || {}).facilityValue || 0) },
  { key: "livingValue",   label: "生活",         color: "#caa44a", get: st => ((st.assets || {}).livingValue   || 0) },
  { key: "fameValue",     label: "名声",         color: "#d6452f", get: st => ((st.assets || {}).fameValue     || 0) },
  { key: "dragonValue",   label: "ドラゴン",     color: "#9a6ad0", get: st => ((st.assets || {}).dragonValue   || 0) },
  { key: "islandValue",   label: "島づくり投資", color: "#ec7fb9", get: st => ((st.assets || {}).islandValue   || 0) }
];
function assetPartsOf(st) { return ASSET_PARTS.map(p => [p.label, p.get(st), p.color]); }
function assetPartsLabel() { return ASSET_PARTS.map(p => p.label).join("＋"); }
function calculateTotalAssets(state) {
  return ASSET_PARTS.reduce((s, p) => s + p.get(state), 0);
}

// ★進行判定の正本＝「これまでに到達した資産の最高額」。
//   表示用の totalAssets は減るので、解放条件にこれを使うと一度開いた話・スポット・
//   段位が閉じてしまう。解放を見るコードは必ずこちらを読むこと（assets_engine の外も同様）。
function assetsPeak(st) {
  const p = (st || state).player || {};
  return Math.max(p.assetsPeak || 0, p.totalAssets || 0);
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
                     dragonValue:0, islandValue:0, lifeItems:[], unlockedLifeStages:0, rescueBonus:0 };
  }
  const a = state.assets;
  a.villageValue  = computeVillageValue(state);
  a.facilityValue = computeFacilityValue(state);
  a.fameValue     = computeFameValue(state);
  a.dragonValue   = computeDragonValue(state);
  a.islandValue   = computeIslandValue(state);   // ★島づくり投資の累計（2026-07-30）

  // 生活資産の解放段位は「到達最高」で決める（＝一度手に入れた暮らしは失わない）。
  // totalAssets そのものは現在値なので、段位の決定権を持たせてはいけない。
  let level = a.unlockedLifeStages || 0;
  let peak  = assetsPeak(state);
  let total = 0;
  for (let i = 0; i < 8; i++) {
    recomputeLiving(state, level);
    total = calculateTotalAssets(state);
    peak  = Math.max(peak, total);
    const lv = assetLevelOf(peak);
    if (lv <= level) break;
    level = lv;                                     // 上がる方向にだけ動く
  }
  // finalize at the settled level
  recomputeLiving(state, level);
  total = calculateTotalAssets(state);
  peak  = Math.max(peak, total);
  level = Math.max(level, assetLevelOf(peak));

  state.player.totalAssets = total;                // 現在の純資産（増えも減りもする）
  state.player.assetsPeak  = peak;                 // 到達最高（進行判定の正本・減らない）
  a.unlockedLifeStages = level;                    // 高水位（暮らしは巻き戻らない）

  return { total, peak, level, unlockedStory: currentStoryChapter(peak) };
}

// §7 — the highest story chapter unlocked at this 総資産 (spec 32 §9 thresholds).
// ★EDは総資産10億（2026-07-30・旧1兆）か、終章クリア（epilogue.edFlag＝絶滅メーターを押し切り最終決戦を完走）で解放。
function epStoryGateOk(ch, total) {
  // ★解放の正本＝chapterAvailable（前章既読＋実績）。従来の総資産しきい値はフォールバックに残す。
  if (typeof chapterAvailable === "function") return chapterAvailable(ch.id);
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
