/**
 * broadcast_engine.js — converts already-calculated race results into
 * a 5-phase broadcast structure per spec §27 §4–§10.
 *
 * The race result is read-only here. We never mutate raceResult.entries or
 * change the final order; we only derive per-phase orderings, focus dragons,
 * tags, and betting status from the components race_engine already produced.
 *
 * Phases: early / mid / development / late / finish.
 *
 * EXTENSION POINT:
 *   - New tag → add to tagger functions below and the master list in §27 §11.
 *   - New phase metric → add to phaseScore() and tag pass.
 *   - New visualMode → switch in renderBroadcastScene (ui_render.js).
 */

const BROADCAST_PHASES = [
  { id: "early",       label: "序盤", focusCount: 5, sectionKey: "early" },
  { id: "mid",         label: "中盤", focusCount: 4, sectionKey: "mid" },
  { id: "development", label: "展開", focusCount: 4, sectionKey: "mid" },
  { id: "late",        label: "終盤", focusCount: 4, sectionKey: "late" },
  { id: "finish",      label: "ゴール", focusCount: 3, sectionKey: "late" }
];

// Distance bands (display only — does not influence calculation).
const DISTANCE_TOTAL = { short: 1200, mid: 1800, long: 2400, marathon: 3200 };

function distanceRemainingFor(race, phaseId) {
  const total = DISTANCE_TOTAL[race.distance] || 1800;
  const frac = { early: 0.75, mid: 0.55, development: 0.35, late: 0.15, finish: 0 }[phaseId];
  return Math.round(total * frac);
}

/**
 * Per-phase instantaneous strength estimate. NOT used to alter results —
 * only to interpolate a believable progression between start and finish.
 * The finish phase always returns finalPower so the final order matches
 * race_engine exactly.
 */
function phaseScore(e, phaseId) {
  const bp = e.basePower, wp = e.weatherPower, fp = e.formPower;
  const cp = e.coursePower, pp = e.pacePower, pos = e.positionPower;
  switch (phaseId) {
    case "early":
      return bp * 0.35 + cp.early * 0.45 + wp * 0.08 + fp * 0.08 + pos * 0.04;
    case "mid":
      return bp * 0.30 + (cp.early * 0.20 + cp.mid * 0.45) + wp * 0.10 + fp * 0.10 + pp * 0.05;
    case "development":
      return bp * 0.28 + (cp.mid * 0.40 + cp.late * 0.20) + wp * 0.10 + fp * 0.10
             + pp * 0.10 + pos * 0.05 + e.staminaAdjustment * 0.20;
    case "late":
      return bp * 0.28 + (cp.mid * 0.15 + cp.late * 0.50) + wp * 0.10 + fp * 0.10
             + pp * 0.10 + pos * 0.05 + e.staminaAdjustment * 0.45;
    case "finish":
      return e.finalPower;
  }
}

function sortByPhase(entries, phaseId) {
  return [...entries].sort((a, b) => phaseScore(b, phaseId) - phaseScore(a, phaseId));
}

function rankMapOf(orderedEntries) {
  const m = {};
  orderedEntries.forEach((e, i) => { m[e.dragon.id] = i + 1; });
  return m;
}

// =========================================================================
// Bet status per phase
// =========================================================================

/**
 * Returns { summary, targets[], tags[] } for a given phase.
 */
function buildBettingStatus(bet, rankMap, phaseId) {
  if (!bet || !bet.selections || bet.selections.length === 0) {
    return { summary: "—", targets: [], tags: [] };
  }
  const tags = [];
  const targets = bet.selections.map(id => {
    const rank = rankMap[id] || 99;
    let status;
    if (bet.type === "win") {
      if (rank === 1) status = "leading";
      else if (rank === 2) status = "needs_push";
      else status = rank <= 4 ? "in_range" : "danger";
    } else { // place or wide member
      if (rank <= 2) status = "safe";
      else if (rank === 3) status = "in_range";
      else if (rank === 4) status = "needs_push";
      else status = "danger";
    }
    return { id, rank, status };
  });

  // Compose summary + tags
  if (bet.type === "win") {
    const t = targets[0];
    const dragonName = (DRAGONS.find(d => d.id === t.id) || {}).name || t.id;
    if (t.rank === 1) { tags.push("hit_in_sight"); }
    if (t.rank > 3) { tags.push("bet_target_danger"); }
    if (phaseId === "finish") tags.push(t.rank === 1 ? "hit" : "miss");
    return { summary: `単竜 ${dragonName}：現在${t.rank}番手`, targets, tags };
  }
  if (bet.type === "place") {
    const t = targets[0];
    const dragonName = (DRAGONS.find(d => d.id === t.id) || {}).name || t.id;
    if (t.rank <= 3) tags.push("bet_target_in_range");
    if (t.rank === 4) tags.push("place_on_border");
    if (t.rank > 4) tags.push("bet_target_danger");
    if (phaseId === "finish") tags.push(t.rank <= 3 ? "hit" : "miss");
    return { summary: `複竜 ${dragonName}：${t.rank}番手`, targets, tags };
  }
  // wide
  const inRange = targets.filter(t => t.rank <= 3).length;
  if (inRange === 2) tags.push("wide_both_in_range");
  else if (inRange === 1) tags.push("wide_one_missing", "bet_target_in_range");
  else tags.push("bet_target_danger");
  if (phaseId === "finish") tags.push(inRange === 2 ? "hit" : "miss");
  const names = targets.map(t => {
    const d = DRAGONS.find(d => d.id === t.id);
    return `${d ? d.name : t.id}(${t.rank})`;
  }).join(" / ");
  return { summary: `ワイド竜：${names}`, targets, tags };
}

// =========================================================================
// Tag derivation (phase-level)
// =========================================================================

function derivePhaseTags(race, ordered, prevRankMap, currRankMap, oddsResult, phaseId) {
  const tags = new Set();
  // Section-based
  const sectionKey = BROADCAST_PHASES.find(p => p.id === phaseId).sectionKey;
  const sectionData = getSection(sectionKey, race[sectionKey]);
  const sectionName = sectionData ? sectionData.label : "";
  if (race.weather === "strong_wind") tags.add("section_boost_wind");
  if (race.weather === "fog") tags.add("section_trouble_fog");
  if (sectionData && /aerial|tailwind/.test(race[sectionKey])) tags.add("section_boost_wind");
  if (sectionData && /turn/.test(race[sectionKey])) tags.add("section_trouble_turn");
  if (sectionData && /fire|volcanic/.test(race[sectionKey])) tags.add("section_boost_fire");

  // Pace inference
  // We can read race-level pace from any entry: same race => same pace.
  // (race_engine attaches pace to raceResult.pace.)

  // Per-dragon dynamics
  const popularityMap = {};
  if (oddsResult) oddsResult.oddsData.forEach(od => { popularityMap[od.dragonId] = od.popularityRank; });

  ordered.forEach((e, i) => {
    const r = i + 1;
    const popRank = popularityMap[e.dragon.id] || 99;
    const prevR = prevRankMap ? (prevRankMap[e.dragon.id] || r) : r;
    if (r === 1 && popRank === 1) tags.add("favorite_leads");
    if (popRank === 1 && r > 3 && phaseId !== "early") tags.add("favorite_fade");
    if (popRank >= 5 && r <= 3 && phaseId !== "early") tags.add("underdog_rising");
    if (prevR - r >= 2) tags.add("rank_up");
    if (r - prevR >= 2) tags.add("rank_down");
    if (e.collapse && (phaseId === "late" || phaseId === "finish")) tags.add("stamina_fade");
    if (phaseId === "early" && r <= 2 && e.dragon.style === "escape") tags.add("good_start");
    if (phaseId === "early" && r >= 7) tags.add("slow_start");
    if ((phaseId === "late" || phaseId === "finish") && (prevR - r) >= 2 && e.dragon.style !== "escape") tags.add("late_surge");
  });

  // Finish-only tags
  if (phaseId === "finish") {
    const top3Diff = Math.abs(phaseScore(ordered[2], "finish") - phaseScore(ordered[3] || ordered[2], "finish"));
    if (top3Diff < 1.5) tags.add("close_finish");
    if (top3Diff < 0.5) tags.add("photo_finish");
  }
  return { tags: Array.from(tags), sectionName };
}

// =========================================================================
// Public: build broadcast data
// =========================================================================

/**
 * Build the broadcast payload from a finished raceResult.
 *
 * @param {object} race        the race definition
 * @param {object} raceResult  output of runRace() — entries are read-only here
 * @param {object} bet         player bet (type/selections)
 * @param {object} oddsResult  output of simulateMarket() for popularity context
 * @returns {{phases: Array}}
 */
function buildBroadcastData(race, raceResult, bet, oddsResult, timeline) {
  const entries = raceResult.entries;
  // 実況/HUDの「先頭/N番手」を“画面に映る物理位置”と一致させる。各フェーズの並びは
  // タイムラインの standingsAt(該当τ) から取る（＝キャンバスの位置と同じ source）。
  // ★表示専用：着順・結果・オッズ・配当は不変（finish は常に確定着順 rank で固定）。
  // timeline 省略時は従来どおり phaseScore 順（後方互換）。
  const _byId = {}; entries.forEach(e => { _byId[e.dragon.id] = e; });
  const _PIDS = ["early", "mid", "development", "late", "finish"];
  const _TAU = (typeof TL_PHASE_TAU !== "undefined") ? TL_PHASE_TAU : [0.18, 0.44, 0.66, 0.86, 1.01];
  const _phaseOrder = (meta) => {
    if (meta.id === "finish") return [...entries].sort((a, b) => a.rank - b.rank);   // ゴール＝確定着順で固定
    if (timeline && typeof timeline.standingsAt === "function") {
      const tau = _TAU[_PIDS.indexOf(meta.id)];
      if (tau != null) {
        const ord = timeline.standingsAt(tau).map(id => _byId[id]).filter(Boolean);
        if (ord.length === entries.length) return ord;   // 画面の物理位置順
      }
    }
    return sortByPhase(entries, meta.id);                 // FB：従来の強さ指標順
  };
  // Pre-compute phase orderings for all phases so tags can compare with prev.
  let prevRankMap = null;
  const phases = BROADCAST_PHASES.map(meta => {
    const ordered = _phaseOrder(meta);
    const currRankMap = rankMapOf(ordered);
    const { tags: phaseTags, sectionName } =
      derivePhaseTags(race, ordered, prevRankMap, currRankMap, oddsResult, meta.id);
    const bettingStatus = buildBettingStatus(bet, currRankMap, meta.id);
    const focusDragonIds = selectFocusDragons(
      ordered, currRankMap, prevRankMap, meta.focusCount, bet, oddsResult, meta.id
    );
    const allTags = [...phaseTags, ...bettingStatus.tags];
    prevRankMap = currRankMap;
    return {
      id: meta.id,
      label: meta.label,
      sectionName: sectionName || meta.label,
      distanceRemaining: distanceRemainingFor(race, meta.id),
      order: ordered.map(e => e.dragon.id),
      orderedEntries: ordered,
      focusDragonIds,
      tags: allTags,
      bettingStatus,
      visualMode: visualModeFor(meta.id, race, allTags),
      currRankMap
    };
  });
  return { raceId: race.id, race, bet, phases };
}

// §6.2 focus dragon selection priority.
function selectFocusDragons(ordered, currRankMap, prevRankMap, count, bet, oddsResult, phaseId) {
  const picked = new Set();
  const pushIfRoom = id => { if (id && picked.size < count) picked.add(id); };
  const betIds = (bet && bet.selections) ? bet.selections : [];
  // 1) bet targets
  betIds.forEach(pushIfRoom);
  // 2) top 3
  ordered.slice(0, 3).forEach(e => pushIfRoom(e.dragon.id));
  // 3-5) movers (rank changes), favorite fade, underdog rising
  const movers = [];
  ordered.forEach(e => {
    const r = currRankMap[e.dragon.id];
    const prev = prevRankMap ? (prevRankMap[e.dragon.id] || r) : r;
    movers.push({ id: e.dragon.id, delta: prev - r });
  });
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  movers.forEach(m => pushIfRoom(m.id));
  // Fallback: fill from order
  ordered.forEach(e => pushIfRoom(e.dragon.id));
  return Array.from(picked).slice(0, count);
}

/**
 * §8.2 visual mode hints for the UI. Extended with front/back camera
 * angles (§27 user follow-up):
 *   back_camera  — 前から後ろ視点 (peering forward from behind).
 *                  used when underdog/late-runner is closing in development.
 *   front_camera — 後ろから前視点 (looking back from the leader).
 *                  used in finish phase if it's a close finish (rear-view drama).
 */
function visualModeFor(phaseId, race, tags) {
  if (phaseId === "early")       return "side_start";
  if (phaseId === "mid")         return tags.includes("section_boost_wind") ? "obstacle_wind"
                                  : tags.includes("section_trouble_turn") ? "obstacle_turn"
                                  : tags.includes("section_boost_fire")   ? "obstacle_fire"
                                  : "side_obstacle";
  if (phaseId === "development") {
    // 後方視点: late surge / underdog rising → camera looks forward from the pack
    if (tags.includes("late_surge") || tags.includes("underdog_rising")) return "back_camera";
    return "close_chase";
  }
  if (phaseId === "late") {
    // 前方視点: close finish brewing → camera looks back from the leader
    if (tags.includes("close_finish") || tags.includes("late_surge")) return "front_camera";
    return "diagonal_sprint";
  }
  if (phaseId === "finish") {
    return tags.includes("photo_finish") ? "front_camera" : "side_finish";
  }
  return "side";
}
