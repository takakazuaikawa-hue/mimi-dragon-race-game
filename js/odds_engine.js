// Odds engine — spec 04.
// PopularityPower → market simulation → win/place/wide odds.

const SIM_COUNT = 5000;

function visiblePower(d) {
  const s = d.stats;
  return s.speed*0.22 + s.stamina*0.16 + s.turn*0.12 + s.wing*0.14 +
         s.fire*0.12 + s.nerve*0.12 + s.classBonus*0.12;
}

// FormImpression uses surface-level form: BodyCondition,Focus,TrialStart,VisualMood,CrowdReaction.
// We approximate (no per-race trial here for the market — market sees yesterday's mood).
function formImpression(d) {
  // Generate market-visible form per race-call (could vary).
  const bodyCondition = 50 + Math.random() * 25;   // market sees only outer surface
  const focus = 50 + Math.random() * 25;
  const trialStart = 45 + Math.random() * 30 + (d.stats.speed - 60)*0.1;
  return bodyCondition*0.35 + focus*0.20 + trialStart*0.15 + (d.visualMood || 50)*0.20 + (d.crowdReaction || 50)*0.10;
}

// CourseReputation: aggregate based on race's section tags.
function courseReputation(d, race) {
  const rep = d.courseReputation || {};
  let score = 60;
  // Match by section keywords
  const sections = [race.early, race.mid, race.late];
  if (sections.some(s => s.includes("straight"))) score += ((rep.straight||60) - 60) * 0.5;
  if (sections.some(s => s.includes("wind") || s.includes("aerial"))) score += ((rep.wind||60) - 60) * 0.5;
  if (sections.some(s => s.includes("turn"))) score += ((rep.turn||60) - 60) * 0.5;
  if (sections.some(s => s.includes("fire") || s.includes("volcan"))) score += ((rep.fire||60) - 60) * 0.5;
  if (sections.some(s => s.includes("mist") || race.weather === "fog")) score += ((rep.fog||60) - 60) * 0.4;
  if (race.mid === "rolling_terrain") score += ((rep.rolling||60) - 60) * 0.4;
  return clamp(score, 20, 100);
}

function popularityPower(d, race) {
  const w = RANKS[race.rank].popularityWeights;
  const vp = visiblePower(d);
  const rr = d.recentResult || 60;
  const pi = d.publicImage || 50;
  const np = NEWSPAPER_MARK_VALUE[d.newspaperMark || ""];
  const fi = formImpression(d);
  const cr = courseReputation(d, race);
  const fb = d.fanBias || 50;
  const total = vp*w.visible + rr*w.recent + pi*w.image + np*w.newspaper +
                fi*w.form + cr*w.course + fb*w.fan;
  return {
    total,
    components: { visiblePower: vp, recentResult: rr, publicImage: pi,
                  newspaperMark: np, formImpression: fi,
                  courseReputation: cr, fanBias: fb }
  };
}

// Simulate market many times.
function simulateMarket(race) {
  const hypeRange = RANKS[race.rank].hypeNoise;
  const pops = DRAGONS.map(d => ({ d, pp: popularityPower(d, race) }));

  const winCount   = new Array(DRAGONS.length).fill(0);
  const top3Count  = new Array(DRAGONS.length).fill(0);
  // wide pair counts (symmetric matrix)
  const N = DRAGONS.length;
  const wide = Array.from({length: N}, () => new Array(N).fill(0));

  const sims = SIM_COUNT;
  for (let s = 0; s < sims; s++) {
    const scored = pops.map((entry, i) => ({
      idx: i,
      // MarketNoise per §9. Spec says ±5; we widen to ±15 because the
      // PopularityPower spread across 8 dragons is ~20 points, which made
      // markets collapse onto 1-2 dragons (failing §12.3 / strategy parity).
      // §12.10 (Target Feel) authorizes numeric tuning to satisfy the
      // qualitative goal: "reasonable but biased, exploitable but not obvious".
      score: entry.pp.total + randRange(-15, 15) + randRange(-hypeRange, hypeRange)
    }));
    scored.sort((a,b) => b.score - a.score);
    winCount[scored[0].idx]++;
    const top3 = [scored[0].idx, scored[1].idx, scored[2].idx];
    for (const i of top3) top3Count[i]++;
    for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
      const a = top3[i], b = top3[j];
      wide[Math.min(a,b)][Math.max(a,b)]++;
    }
  }

  // Build odds data
  const oddsData = pops.map((entry, i) => {
    const winP = winCount[i] / sims;
    const placeP = top3Count[i] / sims;
    const winOdds = oddsFromProb(winP, FLOOR_WIN, RANKS[race.rank].capsWin);
    const placeOdds = oddsFromProb(placeP, FLOOR_PLACE, RANKS[race.rank].capsPlace);
    return {
      dragonId: entry.d.id,
      popularityPower: entry.pp.total,
      components: entry.pp.components,
      marketWinProb: winP,
      marketPlaceProb: placeP,
      winOdds, placeOdds
    };
  });

  // Pair wide odds map
  const wideOdds = {};
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    const p = wide[i][j] / sims;
    const o = oddsFromProb(p, FLOOR_WIDE, RANKS[race.rank].capsWide);
    wideOdds[wideKey(DRAGONS[i].id, DRAGONS[j].id)] = { prob: p, odds: o };
  }

  // Compute popularity ranking (by winOdds asc / winProb desc)
  const popRank = [...oddsData].sort((a,b) => b.marketWinProb - a.marketWinProb);
  popRank.forEach((od, i) => { od.popularityRank = i + 1; });

  return { oddsData, wideOdds };
}

function oddsFromProb(p, floor, cap) {
  if (p <= 0.0001) return cap;
  let o = PAYOUT_RATE / p;
  o = Math.max(floor, Math.min(cap, o));
  return Math.round(o * 10) / 10;
}

function wideKey(idA, idB) {
  return [idA, idB].sort().join("|");
}

function getWideOdds(wideOddsMap, idA, idB) {
  return wideOddsMap[wideKey(idA, idB)];
}
