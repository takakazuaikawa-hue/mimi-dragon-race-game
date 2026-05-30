// Simulation & test harness per spec §12.8 / §12.9.
// Usage from console: simulateRaceManyTimes("race_grandclock_1", 1000)

function simulateRaceManyTimes(raceId, count) {
  const race = RACES.find(r => r.id === raceId);
  if (!race) return { error: "race not found" };
  const N = DRAGONS.length;
  const winCount = new Array(N).fill(0);
  const top3Count = new Array(N).fill(0);
  let totalCollapse = 0;
  let oddsResult = simulateMarket(race);  // market doesn't depend on race calculation
  let favoriteId = oddsResult.oddsData.find(o => o.popularityRank === 1).dragonId;
  let favWin = 0, favTop3 = 0;

  for (let i = 0; i < count; i++) {
    const rr = runRace(race);
    rr.entries.forEach(e => {
      const idx = DRAGONS.findIndex(d => d.id === e.dragon.id);
      if (e.rank === 1) winCount[idx]++;
      if (e.rank <= 3) top3Count[idx]++;
      if (e.collapse) totalCollapse++;
    });
    const favEntry = rr.entries.find(e => e.dragon.id === favoriteId);
    if (favEntry.rank === 1) favWin++;
    if (favEntry.rank <= 3) favTop3++;
  }

  const perDragon = DRAGONS.map((d, i) => ({
    name: d.name,
    winRate: (winCount[i]/count*100).toFixed(1)+"%",
    top3Rate: (top3Count[i]/count*100).toFixed(1)+"%"
  }));

  return {
    race: raceFullName(race),
    count,
    favoriteWinRate: (favWin/count*100).toFixed(1)+"%",
    favoriteTop3Rate: (favTop3/count*100).toFixed(1)+"%",
    staminaCollapseFrequency: (totalCollapse/(count*N)*100).toFixed(1)+"% (per dragon-race)",
    perDragon
  };
}

// Bet strategies — return {type, selections} given a race + odds.
const STRATEGIES = {
  favWin: (race, odds) => ({ type:"win", selections:[odds.oddsData.find(o=>o.popularityRank===1).dragonId] }),
  favPlace: (race, odds) => ({ type:"place", selections:[odds.oddsData.find(o=>o.popularityRank===1).dragonId] }),
  topWideLowOdds: (race, odds) => {
    // pick wide pair with lowest pair odds (most favored)
    let best = null;
    for (const k in odds.wideOdds) {
      if (!best || odds.wideOdds[k].odds < odds.wideOdds[best].odds) best = k;
    }
    const [a,b] = best.split("|");
    return { type:"wide", selections:[a,b] };
  },
  randomWin: (race, odds) => {
    const d = DRAGONS[Math.floor(Math.random()*DRAGONS.length)];
    return { type:"win", selections:[d.id] };
  },
  // Value-aware: pick dragon whose true-fit course score most exceeds market expectation.
  valueWin: (race, odds) => {
    // approximate fit = basePower + coursePower (terrain-only)
    let best = null, bestScore = -Infinity;
    for (const d of DRAGONS) {
      const cp = coursePower(d, race);
      const fit = basePower(d) + cp.total*0.5;
      const od = odds.oddsData.find(o => o.dragonId === d.id);
      const marketScore = od.popularityPower;
      const gap = fit - marketScore;
      if (gap > bestScore) { bestScore = gap; best = d; }
    }
    return { type:"win", selections:[best.id] };
  }
};

function testBetStrategy(strategyName, raceIds, raceCount, wager) {
  const strat = STRATEGIES[strategyName];
  if (!strat) return { error: "unknown strategy" };
  wager = wager || 100;
  let totalProfit = 0, hits = 0, total = 0;
  for (const id of raceIds) {
    const race = RACES.find(r => r.id === id);
    for (let i = 0; i < raceCount; i++) {
      const odds = simulateMarket(race);
      const bet = { ...strat(race, odds), wager };
      const rr = runRace(race);
      const res = resolveBet(bet, rr, odds);
      totalProfit += res.profit;
      if (res.hit) hits++;
      total++;
    }
  }
  return {
    strategy: strategyName,
    races: total,
    wager,
    hitRate: (hits/total*100).toFixed(1)+"%",
    totalProfit,
    avgProfitPerRace: (totalProfit/total).toFixed(1),
    roi: ((totalProfit / (total*wager))*100).toFixed(1)+"%"
  };
}

function compareAllStrategies(raceIds, raceCount, wager) {
  return Object.keys(STRATEGIES).map(name => testBetStrategy(name, raceIds, raceCount, wager));
}

// ---- Phase 3: Odds Engine Validation tests per §12.4 ----

// §12.4.1 Market vs True Strength: for each race, compute "true win rate" via
// race-engine simulation and compare with market win odds.
function testMarketVsTrueStrength(raceId, raceCount) {
  raceCount = raceCount || 200;
  const race = RACES.find(r => r.id === raceId);
  const oddsResult = simulateMarket(race);
  // True win rate from race simulation
  const trueWin = new Array(DRAGONS.length).fill(0);
  for (let i = 0; i < raceCount; i++) {
    const rr = runRace(race);
    const widx = DRAGONS.findIndex(d => d.id === rr.entries[0].dragon.id);
    trueWin[widx]++;
  }
  return DRAGONS.map((d, i) => {
    const od = oddsResult.oddsData.find(o => o.dragonId === d.id);
    const trueRate = trueWin[i] / raceCount;
    const marketRate = od.marketWinProb;
    return {
      dragon: d.name,
      popRank: od.popularityRank,
      marketRate: (marketRate*100).toFixed(1)+"%",
      trueRate: (trueRate*100).toFixed(1)+"%",
      winOdds: od.winOdds,
      // expected value: trueRate * odds - 1.  Positive = +EV bet (value)
      ev: ((trueRate * od.winOdds) - 1).toFixed(2)
    };
  }).sort((a,b) => parseFloat(b.ev) - parseFloat(a.ev));
}

// §12.4.2 Rank Bias: same dragon set, race at different ranks. Show how
// PopularityPower components shift between visible/recent/image/newspaper/fan.
function testRankBias(raceId) {
  const race = RACES.find(r => r.id === raceId);
  return [1,3,5,7].map(rk => {
    const fakeRace = { ...race, rank: rk };
    const odds = simulateMarket(fakeRace);
    const sorted = [...odds.oddsData].sort((a,b) => a.popularityRank - b.popularityRank);
    return {
      rank: rk,
      label: RANKS[rk].label,
      top3pop: sorted.slice(0,3).map(o => `${DRAGONS.find(d=>d.id===o.dragonId).name}(${o.winOdds})`).join(", "),
      bottom3pop: sorted.slice(-3).map(o => `${DRAGONS.find(d=>d.id===o.dragonId).name}(${o.winOdds})`).join(", ")
    };
  });
}

// §12.4.3 Previous Result Overreaction: temporarily bump one dragon's
// recentResult to 100 (vs default 50) and see if its odds change.
function testPreviousResultOverreaction(raceId, dragonId) {
  const race = RACES.find(r => r.id === raceId);
  const d = DRAGONS.find(d => d.id === dragonId);
  const origRecent = d.recentResult;
  const before = simulateMarket(race).oddsData.find(o => o.dragonId === dragonId);
  d.recentResult = 95;
  const after = simulateMarket(race).oddsData.find(o => o.dragonId === dragonId);
  d.recentResult = origRecent;
  return {
    dragon: d.name,
    raceRank: race.rank,
    beforeRecent: origRecent,
    beforeOdds: before.winOdds,
    beforeRank: before.popularityRank,
    afterRecent: 95,
    afterOdds: after.winOdds,
    afterRank: after.popularityRank
  };
}

// §12.4.4 PublicImage: ditto for publicImage.
function testPublicImageOverbet(raceId, dragonId) {
  const race = RACES.find(r => r.id === raceId);
  const d = DRAGONS.find(d => d.id === dragonId);
  const orig = d.publicImage;
  const before = simulateMarket(race).oddsData.find(o => o.dragonId === dragonId);
  d.publicImage = 95;
  const after = simulateMarket(race).oddsData.find(o => o.dragonId === dragonId);
  d.publicImage = orig;
  return {
    dragon: d.name, beforeImage: orig, beforeOdds: before.winOdds,
    afterImage: 95, afterOdds: after.winOdds
  };
}

// Phase 3 exit-criteria report.
function phase3Report() {
  console.group("Phase 3 Odds Validation Report");
  RACES.forEach(r => {
    console.log("=== Market vs True Strength:", raceFullName(r));
    console.table(testMarketVsTrueStrength(r.id, 200));
  });
  console.log("=== Rank Bias on Race1");
  console.table(testRankBias(RACES[0].id));
  console.log("=== Previous Result Overreaction (Ruben/Race1 vs Race5):");
  console.log(testPreviousResultOverreaction(RACES[0].id, "rubel"));
  console.log(testPreviousResultOverreaction(RACES[4].id, "rubel"));
  console.log("=== PublicImage Overbet (Momu, Race1 — low image dragon):");
  console.log(testPublicImageOverbet(RACES[0].id, "momu"));
  console.groupEnd();
}

// Quick V1 acceptance check (§12.12).
function v1AcceptanceReport() {
  const allRaceIds = RACES.map(r => r.id);
  const N = 200;
  console.group("V1 Acceptance Report");
  console.log("Single-race favorite rates:");
  for (const id of allRaceIds) {
    console.log(simulateRaceManyTimes(id, N));
  }
  console.log("Strategy comparison (per race x", N, "trials, wager 100):");
  console.table(compareAllStrategies(allRaceIds, N, 100));
  console.groupEnd();
}
