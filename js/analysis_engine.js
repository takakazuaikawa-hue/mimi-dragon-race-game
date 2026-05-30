// Post-race analysis — produces structured explanation per spec 03 §17.

function buildAnalysis(race, raceResult, oddsResult, betResult) {
  const top = raceResult.entries[0];
  const second = raceResult.entries[1];
  const third = raceResult.entries[2];
  const pace = raceResult.pace;

  const popMap = {};
  oddsResult.oddsData.forEach(od => popMap[od.dragonId] = od);

  const winnerOdds = popMap[top.dragon.id];
  const lateLabel = getSection("late", race.late).label;
  const midLabel  = getSection("mid", race.mid).label;
  const earlyLabel = getSection("early", race.early).label;
  const paceLabel = { slow:"スロー", standard:"標準", high:"ハイ", very_high:"超ハイ"}[pace.type];

  // Winner reasons
  const winnerReasons = [];
  winnerReasons.push(`${top.dragon.name}は終盤(${lateLabel})での適性が高く、レース全体で安定した出力を出しました。`);
  if (top.coursePower.late > 70) winnerReasons.push(`特に${lateLabel}の適性スコアが${top.coursePower.late.toFixed(1)}と高く、決め手で他を上回りました。`);
  if (top.staminaRatio > 0.5) winnerReasons.push(`スタミナを温存できており(残量比${(top.staminaRatio*100).toFixed(0)}%)、終い勝負を制しました。`);
  if (winnerOdds.popularityRank >= 4) winnerReasons.push(`市場${winnerOdds.popularityRank}番人気の伏兵が、人気以上の実力を示しました。`);

  // Favorite failure
  const favorite = oddsResult.oddsData.find(o => o.popularityRank === 1);
  const favEntry = raceResult.entries.find(e => e.dragon.id === favorite.dragonId);
  const favoriteFailureReasons = [];
  if (favEntry.rank > 3) {
    favoriteFailureReasons.push(`1番人気${favEntry.dragon.name}は${favEntry.rank}着に敗退。`);
    if (favEntry.collapse) favoriteFailureReasons.push(`スタミナが終盤で枯れ、脚色が鈍りました。`);
    if (favEntry.coursePower.late < 60) favoriteFailureReasons.push(`${lateLabel}の適性が${favEntry.coursePower.late.toFixed(1)}と低く、決め手不足でした。`);
    if (pace.type === "high" || pace.type === "very_high") {
      if (favEntry.dragon.style === "escape" || favEntry.dragon.style === "front") {
        favoriteFailureReasons.push(`${paceLabel}ペースで先行勢が消耗しました。`);
      }
    }
  } else if (favEntry.rank === 1) {
    favoriteFailureReasons.push(`1番人気${favEntry.dragon.name}が順当に勝利。市場の読みは正しかった。`);
  } else {
    favoriteFailureReasons.push(`1番人気${favEntry.dragon.name}は${favEntry.rank}着。複勝圏は確保。`);
  }

  // Pace summary
  let paceSummary = `今回のペースは${paceLabel}でした(逃げ${pace.escapeCount}/先行${pace.frontCount}/追込${pace.chaseCount})。`;
  if (pace.firePressure > 0) paceSummary += ` 火力型先行勢の存在でペース圧力が上昇。`;

  // Stamina notes
  const staminaNotes = [];
  const collapsed = raceResult.entries.filter(e => e.collapse);
  if (collapsed.length > 0) {
    staminaNotes.push(`スタミナ崩壊: ${collapsed.map(e=>e.dragon.name).join("、")}`);
  } else {
    staminaNotes.push(`全体にスタミナの余裕があり、決め手勝負の様相でした。`);
  }

  // Weather notes
  const weatherNotes = [];
  weatherNotes.push(`天候は${WEATHERS[race.weather].label}で、関連能力(${weatherKeyStats(race.weather)})が結果に影響しました。`);

  // Value notes (compare actual rank vs popularity rank)
  const valueNotes = [];
  raceResult.entries.slice(0,3).forEach(e => {
    const od = popMap[e.dragon.id];
    if (od.popularityRank >= e.rank + 2) {
      valueNotes.push(`${e.dragon.name}: ${od.popularityRank}番人気→${e.rank}着。市場が過小評価していた。`);
    }
  });
  if (favEntry.rank >= 4) {
    valueNotes.push(`1番人気の沈没は、複勝・ワイドでの妙味を生みました。`);
  }
  if (valueNotes.length === 0) valueNotes.push(`今回は順当な決着でした。`);

  // Bet evaluation
  const betEval = [];
  if (betResult) {
    if (betResult.hit) {
      betEval.push(`的中！ ${fmtCoins(betResult.payout)}コイン獲得 (収支 +${fmtCoins(betResult.profit)})。`);
    } else {
      betEval.push(`ハズレ。 -${fmtCoins(betResult.wager)}コイン。`);
    }
  }

  // Next hint
  const nextHints = [];
  if (pace.type === "high" || pace.type === "very_high") {
    nextHints.push(`次戦でも逃げ・先行勢が多いとペースが上がりやすい。差し・追込の妙味に注目。`);
  } else if (pace.type === "slow") {
    nextHints.push(`スローペースでは逃げ・先行が残りやすい。差しの届かない可能性に注意。`);
  }
  nextHints.push(`オッズと真の適性のズレを見つけることが、長期的な勝率を支えます。`);

  return {
    winnerReasons, favoriteFailureReasons,
    paceSummary, staminaNotes, weatherNotes, valueNotes,
    betEval, nextHints,
    keySection: lateLabel
  };
}

function weatherKeyStats(w) {
  if (w === "clear") return "スピード・火力";
  if (w === "rain") return "スタミナ・気性";
  if (w === "strong_wind") return "翼・気性";
  if (w === "thunder") return "気性";
  if (w === "fog") return "気性・回転";
  return "";
}
