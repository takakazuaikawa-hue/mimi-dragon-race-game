// Betting: validation, odds lookup, resolution, payout.

function validateBet(bet, race) {
  if (!bet) return "賭けが選択されていません。";
  if (!Number.isInteger(bet.wager) || bet.wager <= 0) return "賭金は正の整数で入力してください。";
  if (bet.wager > state.player.coins) return "所持コインが不足しています。";
  const cap = getAllowedMaxWager(state.player, race);
  if (bet.wager > cap) return `このランクの最大賭金は ${fmtCoins(cap)} です（村Lv${state.player.villageLevel}補正含む）。`;
  if (!["win","place","wide"].includes(bet.type)) return "賭式が不正です。";
  if (bet.type === "wide") {
    if (!bet.selections || bet.selections.length !== 2) return "ワイド竜は2頭選んでください。";
    if (bet.selections[0] === bet.selections[1]) return "ワイド竜は異なる2頭を選んでください。";
  } else {
    if (!bet.selections || bet.selections.length !== 1) return "竜を1頭選んでください。";
  }
  for (const id of bet.selections) {
    if (!DRAGONS.find(d => d.id === id)) return "選択された竜が無効です。";
  }
  return null;
}

function betOdds(bet, oddsResult) {
  if (bet.type === "win") {
    return oddsResult.oddsData.find(o => o.dragonId === bet.selections[0]).winOdds;
  }
  if (bet.type === "place") {
    return oddsResult.oddsData.find(o => o.dragonId === bet.selections[0]).placeOdds;
  }
  if (bet.type === "wide") {
    return getWideOdds(oddsResult.wideOdds, bet.selections[0], bet.selections[1]).odds;
  }
  return 1.0;
}

function resolveBet(bet, raceResult, oddsResult) {
  const odds = betOdds(bet, oddsResult);
  const top3Ids = raceResult.entries.slice(0,3).map(e => e.dragon.id);
  const winnerId = raceResult.entries[0].dragon.id;
  let hit = false;
  if (bet.type === "win")   hit = winnerId === bet.selections[0];
  if (bet.type === "place") hit = top3Ids.includes(bet.selections[0]);
  if (bet.type === "wide")  hit = top3Ids.includes(bet.selections[0]) && top3Ids.includes(bet.selections[1]);
  const payout = hit ? Math.floor(bet.wager * odds) : 0;
  const profit = payout - bet.wager;
  return { hit, odds, payout, profit, wager: bet.wager };
}
