/**
 * recap_engine.js — post-race recap / "答え合わせ" builder (spec #29).
 *
 * The recap NEVER changes the race result or the payout (§29 §12). It reads the
 * already-calculated raceResult, betResult, oddsResult, broadcastData and the
 * Mimi commentary log, and assembles a structured recap that connects the
 * player's prediction → broadcast → result, so a loss feels understandable and
 * a win feels earned (§29 §13).
 *
 * It deliberately reuses analysis_engine.buildAnalysis() for the deep prose so
 * the recap can never contradict the analysis screen.
 *
 * Output (§29 §10.3):
 *   { resultSummary, payoutSummary, broadcastHighlights, winnerReason,
 *     loserReason, betReview, marketGap, paceAnalysis, staminaAnalysis,
 *     courseWeatherAnalysis, nextHints, mimiRecap, commentaryLog, analysis }
 *
 * EXTENSION POINT: new broadcast tag → handle in collectHighlights(); new bet
 * type → add a branch in buildBetReview().
 */

function buildRecap(ctx) {
  const { race, raceResult, oddsResult, bet, betResult, broadcastData, commentary } = ctx;
  const analysis = ctx.analysis
    || buildAnalysis(race, raceResult, oddsResult, betResult, broadcastData);

  const popMap = {};
  oddsResult.oddsData.forEach(o => { popMap[o.dragonId] = o; });

  // ---- 4.1 着順 (all 8) ----
  const resultSummary = raceResult.entries.map(e => {
    const od = popMap[e.dragon.id] || {};
    return {
      rank: e.rank,
      id: e.dragon.id,
      name: e.dragon.name,
      popularityRank: od.popularityRank,
      odds: od.winOdds,
      style: STYLE_LABEL[e.dragon.style] || e.dragon.style,
      isBetTarget: !!(bet && bet.selections && bet.selections.includes(e.dragon.id)),
      blurb: shortBlurb(e, race, od)
    };
  });

  // ---- 4.2 / 7. 払い戻し + 馬券レビュー ----
  const payoutSummary = buildPayoutSummary(bet, betResult, raceResult);
  const betReview = buildBetReview(bet, betResult, raceResult, popMap);

  // ---- 4.3 実況ハイライト (3-5) ----
  const broadcastHighlights = collectHighlights(race, raceResult, broadcastData, popMap);

  // ---- 4.4 / 4.5 勝因・敗因 ----
  const winnerReason = analysis.winnerReasons.slice();
  const loserReason = buildLoserReason(analysis, bet, betResult, raceResult, popMap);

  // ---- 4.6 人気と実力のズレ ----
  const marketGap = buildMarketGap(analysis, raceResult, popMap);

  // ---- 4.7 / 4.8 / 4.9 ----
  const paceAnalysis = [analysis.paceSummary];
  if (raceResult.pace && (raceResult.pace.type === "high" || raceResult.pace.type === "very_high")) {
    paceAnalysis.push("速い流れの分、差し・追込にチャンスが生まれた。");
  } else if (raceResult.pace && raceResult.pace.type === "slow") {
    paceAnalysis.push("流れが落ち着き、前の竜が止まりにくい展開だった。");
  }
  const staminaAnalysis = analysis.staminaNotes.slice();
  const courseWeatherAnalysis = buildCourseWeatherAnalysis(race, analysis);

  // ---- 4.10 次回ヒント ----
  const nextHints = analysis.nextHints.slice();

  // ---- 8. ミミの振り返り (1-2文) ----
  const mimiRecap = buildMimiRecap(bet, betResult, raceResult, popMap);

  return {
    resultSummary, payoutSummary, broadcastHighlights,
    winnerReason, loserReason, betReview, marketGap,
    paceAnalysis, staminaAnalysis, courseWeatherAnalysis,
    nextHints, mimiRecap,
    commentaryLog: commentary || [],
    analysis
  };
}

// One-line 短評 for the ranking table (§29 §4.1).
function shortBlurb(e, race, od) {
  if (e.collapse) return "終盤に脚が止まった";
  const style = e.dragon.style;
  const popRank = od.popularityRank || 9;
  if (e.rank === 1) {
    if (style === "escape" || style === "front") return "前で押し切った";
    if (style === "late") return "末脚で差し切った";
    return "後方から差し切った";
  }
  if (e.rank <= 3) {
    if (popRank >= e.rank + 2) return "人気以上に走った";
    if (style === "late" || style === "chase") return "終いを伸ばした";
    return "前々で粘り込んだ";
  }
  if (popRank <= 2 && e.rank >= 4) return "人気を裏切った";
  if (style === "escape" || style === "front") return "前半の脚が続かず";
  return "見せ場は作れず";
}

// §29 §4.2 payout block (display only — uses betResult verbatim).
function buildPayoutSummary(bet, betResult, raceResult) {
  if (!bet || !betResult) return null;
  const typeLabel = { win: "単竜", place: "複竜", wide: "ワイド竜" }[bet.type];
  const rankOf = id => {
    const e = raceResult.entries.find(x => x.dragon.id === id);
    return e ? e.rank : null;
  };
  const selections = bet.selections.map(id => {
    const d = DRAGONS.find(x => x.id === id);
    return { id, name: d ? d.name : id, rank: rankOf(id) };
  });
  const resultText = selections.map(s => `${s.name}${s.rank}着`).join(" / ");
  return {
    type: bet.type, typeLabel, selections, resultText,
    hit: betResult.hit, wager: betResult.wager, odds: betResult.odds,
    payout: betResult.payout, profit: betResult.profit
  };
}

// §29 §7 — prose review tailored to the bet type.
function buildBetReview(bet, betResult, raceResult, popMap) {
  if (!bet || !betResult) return [];
  const lines = [];
  const rankOf = id => {
    const e = raceResult.entries.find(x => x.dragon.id === id);
    return e ? e.rank : 99;
  };
  const nameOf = id => { const d = DRAGONS.find(x => x.id === id); return d ? d.name : id; };
  const winnerName = raceResult.entries[0].dragon.name;

  if (bet.type === "win") {
    const id = bet.selections[0], r = rankOf(id);
    if (r === 1) lines.push(`${nameOf(id)}が1着。単竜的中。読み切りの一戦になった。`);
    else if (r === 2) lines.push(`${nameOf(id)}は2着。先頭${winnerName}を捕まえるところまでは届かなかった。複竜なら十分に取れた内容。`);
    else if (r <= 3) lines.push(`${nameOf(id)}は${r}着。複勝圏には入ったが、単竜では一歩足りなかった。`);
    else lines.push(`${nameOf(id)}は${r}着。今回は展開が向かず、単竜では苦しい結果だった。`);
    return lines;
  }
  if (bet.type === "place") {
    const id = bet.selections[0], r = rankOf(id);
    if (r <= 3) lines.push(`${nameOf(id)}は${r}着で複竜的中。狙い通り、堅実に圏内へ収まった。`);
    else if (r === 4) lines.push(`${nameOf(id)}は4着。複勝ラインまであと一歩、惜しい敗戦だった。`);
    else lines.push(`${nameOf(id)}は${r}着。今回は圏内に届かなかった。`);
    return lines;
  }
  // wide
  const a = bet.selections[0], b = bet.selections[1];
  const ra = rankOf(a), rb = rankOf(b);
  const inA = ra <= 3, inB = rb <= 3;
  if (inA && inB) {
    lines.push(`${nameOf(a)}は${ra}着、${nameOf(b)}は${rb}着。ワイド竜的中。`);
    lines.push("読みどころの違う2頭がそろって圏内に来た形がはまった。");
  } else if (inA || inB) {
    const inName = inA ? nameOf(a) : nameOf(b);
    const inR = inA ? ra : rb;
    const outName = inA ? nameOf(b) : nameOf(a);
    const outR = inA ? rb : ra;
    lines.push(`${inName}は${inR}着で圏内、しかし${outName}が${outR}着。ワイド竜はあと1頭届かなかった。`);
  } else {
    lines.push(`${nameOf(a)}は${ra}着、${nameOf(b)}は${rb}着。今回は2頭とも圏外だった。`);
  }
  return lines;
}

// §29 §4.3 / §6 — pull 3-5 highlights from broadcast phases + tags, preferring
// dragons that actually moved (so it connects to what the commentary said).
function collectHighlights(race, raceResult, broadcastData, popMap) {
  const hi = [];
  const nameOf = id => commentaryName(id);
  let prev = null;
  for (const phase of broadcastData.phases) {
    const lead = phase.orderedEntries[0];
    const tagset = new Set(phase.tags);
    if (phase.id === "early" && tagset.has("good_start") && lead) {
      hi.push(`序盤、${nameOf(lead.dragon.id)}が好スタートを決めた。`);
    }
    if (phase.id === "mid") {
      const riser = topRiser(phase, prev);
      const secLabel = sectionLabelOf(race, "mid");
      if (riser) hi.push(`中盤、${secLabel}で${nameOf(riser)}が順位を上げた。`);
    }
    if (phase.id === "development") {
      if (tagset.has("favorite_fade")) {
        const fav = Object.values(popMap).find(o => o.popularityRank === 1);
        if (fav) hi.push(`展開で1番人気${nameOf(fav.dragonId)}に苦しさが出た。`);
      } else {
        const riser = topRiser(phase, prev);
        if (riser) hi.push(`展開で${nameOf(riser)}が押し上げてきた。`);
      }
    }
    if (phase.id === "late") {
      const riser = topRiser(phase, prev);
      if ((tagset.has("late_surge") || riser) && riser) {
        const r = phase.currRankMap[riser];
        hi.push(`終盤、${nameOf(riser)}が差して${r}着争いに加わった。`);
      }
    }
    if (phase.id === "finish") {
      if (tagset.has("photo_finish")) hi.push("ゴール前は写真判定級の超接戦になった。");
      else if (tagset.has("close_finish")) hi.push("ゴール前は接戦の決着になった。");
    }
    prev = phase;
  }
  // ensure at least 3: pad with plain facts from the final order
  if (hi.length < 3) {
    const e = raceResult.entries;
    hi.push(`1着は${e[0].dragon.name}。`);
    if (e[1]) hi.push(`2着に${e[1].dragon.name}が入った。`);
    if (e[2]) hi.push(`3着は${e[2].dragon.name}だった。`);
  }
  // dedupe + cap 5
  const seen = new Set();
  return hi.filter(x => (x && !seen.has(x)) ? (seen.add(x), true) : false).slice(0, 5);
}

function topRiser(phase, prevPhase) {
  if (!prevPhase) return null;
  let best = null, bestDelta = 1;
  phase.orderedEntries.forEach((e, i) => {
    const r = i + 1;
    const prevR = prevPhase.currRankMap[e.dragon.id] || r;
    const delta = prevR - r;
    if (delta > bestDelta) { bestDelta = delta; best = e.dragon.id; }
  });
  return best;
}

function buildLoserReason(analysis, bet, betResult, raceResult, popMap) {
  const lines = analysis.favoriteFailureReasons.slice();
  // If the player's bet target lost, add a focused reason.
  if (bet && betResult && !betResult.hit) {
    const missed = bet.selections
      .map(id => raceResult.entries.find(e => e.dragon.id === id))
      .filter(e => e && e.rank > 3);
    missed.forEach(e => {
      if (e.collapse) lines.push(`${e.dragon.name}は終盤で脚が上がり、圏内に残れなかった。`);
      else if (e.coursePower && e.coursePower.late < 60) lines.push(`${e.dragon.name}は終盤の適性が不足し、差を詰め切れなかった。`);
      else lines.push(`${e.dragon.name}は位置取りや展開がかみ合わず、あと一歩届かなかった。`);
    });
  }
  return lines;
}

function buildMarketGap(analysis, raceResult, popMap) {
  const lines = analysis.valueNotes.slice();
  // headline: did an underdog crack the top 3?
  const underdogIn = raceResult.entries.slice(0, 3)
    .map(e => ({ e, od: popMap[e.dragon.id] }))
    .find(x => x.od && x.od.popularityRank >= 5);
  if (underdogIn) {
    lines.unshift(`${underdogIn.e.dragon.name}は${underdogIn.od.popularityRank}番人気ながら${underdogIn.e.rank}着。市場が見落としていた強さが出た。`);
  }
  return lines;
}

function buildCourseWeatherAnalysis(race, analysis) {
  const lines = [];
  const sec = sectionLabelOf(race, "mid");
  const why = sectionWhy(race, "mid");
  if (sec && why) lines.push(`中盤の${sec}が展開の鍵になった。${why}`);
  analysis.weatherNotes.forEach(l => lines.push(l));
  if (analysis.broadcastNotes && analysis.broadcastNotes.length) {
    analysis.broadcastNotes.forEach(l => lines.push(l));
  }
  return lines;
}

// §29 §8 — 1-2 sentence Mimi sign-off. Branches hit / near-miss / 大穴 / miss.
function buildMimiRecap(bet, betResult, raceResult, popMap) {
  if (!bet || !betResult) {
    return "今日も一戦、しっかり見ていきましょう。";
  }
  const winner = raceResult.entries[0];
  const winnerPop = (popMap[winner.dragon.id] || {}).popularityRank || 9;
  if (betResult.hit) {
    // 大穴: a high-popularity-rank dragon in the winning combo
    const bigPop = bet.selections.some(id => {
      const od = popMap[id]; return od && od.popularityRank >= 5;
    }) || winnerPop >= 5;
    if (bigPop) {
      return "市場が見落としていた強さを拾えました。こういう一戦を取れると、予想は一気に面白くなります。";
    }
    return "読みどころがきれいにつながりました。次も、人気だけでなく条件を見ていきましょう。";
  }
  // miss: was it close?
  const nearMiss = bet.selections.some(id => {
    const e = raceResult.entries.find(x => x.dragon.id === id);
    return e && (e.rank === 4 || (bet.type === "win" && e.rank <= 3));
  });
  if (nearMiss) {
    return "惜しいところまでは見えていました。次は、位置取りと終盤の脚をもう少し重ねて見たいです。";
  }
  return "今回は流れが向きませんでした。負けを次の手がかりに変えて、もう一度読み直しましょう。";
}
