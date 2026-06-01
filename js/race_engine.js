/**
 * race_engine.js — Race result engine per spec §03.
 *
 * Calculates FinalPower per dragon with 7 weighted components + StaminaAdjustment.
 * Produces ordered entries, per-phase race log, and component breakdown for analysis.
 *
 * Depends on: utils.js (clamp, randRange, weightedStat), data_courses.js,
 * data_weather.js, data_ranks.js, data_dragons.js, data_races.js.
 *
 * EXTENSION POINT: new running styles → PACE_STYLE_MOD. New section types →
 * data_courses.js + relStatMap below. New formulas → keep §03 §2 weights stable.
 */

// Generate per-race FormPower components (transient).
function generateForm(dragon) {
  // Slightly biased around 50–80, with stat-influenced bias.
  const baseBody  = randRange(40, 85);
  const focus     = clamp(dragon.stats.nerve * 0.7 + randRange(-15, 15), 20, 95);
  const trialS    = clamp(dragon.stats.speed * 0.5 + randRange(10, 40), 25, 95);
  const trialT    = clamp(dragon.stats.turn  * 0.5 + randRange(10, 40), 25, 95);
  const trialF    = clamp((dragon.stats.stamina*0.4 + dragon.stats.wing*0.3) + randRange(10, 40), 25, 95);
  const riderSync = randRange(40, 85);
  return {
    bodyCondition: baseBody,
    focus, trialStart: trialS, trialTurn: trialT, trialFinish: trialF,
    riderSync
  };
}

function formPower(form) {
  return form.bodyCondition*0.20 + form.focus*0.20 + form.trialStart*0.15 +
         form.trialTurn*0.15 + form.trialFinish*0.20 + form.riderSync*0.10;
}

function basePower(d) {
  const s = d.stats;
  return s.speed*0.22 + s.stamina*0.18 + s.turn*0.14 + s.wing*0.14 +
         s.fire*0.10 + s.nerve*0.14 + s.classBonus*0.08;
}

function coursePower(d, race) {
  const e = getSection("early", race.early);
  const m = getSection("mid",   race.mid);
  const l = getSection("late",  race.late);
  const ep = weightedStat(d.stats, e.weights);
  const mp = weightedStat(d.stats, m.weights);
  const lp = weightedStat(d.stats, l.weights);
  return { total: ep*0.30 + mp*0.35 + lp*0.35, early: ep, mid: mp, late: lp };
}

function weatherPower(d, race) {
  const w = WEATHERS[race.weather];
  return weightedStat(d.stats, w.weights);
}

// Pace: classification from style counts and fire pressure.
function paceClassify(entries) {
  let escapeCount = 0, frontCount = 0, chaseCount = 0;
  let fireSum = 0, fireCount = 0;
  for (const e of entries) {
    if (e.dragon.style === "escape") { escapeCount++; if (e.dragon.stats.fire >= 50) { fireSum += e.dragon.stats.fire; fireCount++; } }
    if (e.dragon.style === "front")  { frontCount++;  if (e.dragon.stats.fire >= 50) { fireSum += e.dragon.stats.fire; fireCount++; } }
    if (e.dragon.style === "chase")  { chaseCount++; }
  }
  const avgFire = fireCount > 0 ? fireSum / fireCount : 0;
  const firePressure = Math.max(0, avgFire - 60) * 0.4;
  let idx = escapeCount*25 + frontCount*12 - chaseCount*5 + firePressure;
  let type = "standard";
  if (idx <= 30) type = "slow";
  else if (idx <= 60) type = "standard";
  else if (idx <= 90) type = "high";
  else type = "very_high";
  return { index: idx, type, escapeCount, frontCount, chaseCount, firePressure };
}

const PACE_STYLE_MOD = {
  slow:      { escape: 12, front:  8, late: -4, chase: -8 },
  standard:  { escape:  4, front:  8, late:  4, chase:  0 },
  high:      { escape: -8, front: -2, late: 10, chase:  8 },
  very_high: { escape:-14, front: -8, late:  8, chase: 14 }
};

function pacePower(d, pace) {
  return 50 + (PACE_STYLE_MOD[pace.type][d.style] || 0);
}

// Position power — base 50 with lane/traffic/style/turn modifiers.
function positionPower(d, race, pace) {
  let lane = 0, traffic = 0, stylePos = 0, turnHandle = 0;
  const mid = race.mid, late = race.late;
  // Small-turn heavy?
  const smallTurnish = mid === "repeated_small_turns" || late === "final_grand_turn";
  // Long straight?
  const straightish = late === "long_final_straight" || late === "tailwind_straight";

  // Lane: random inner/outer pick → here use deterministic-ish based on id hash
  // Simple: random per race already in random component; keep lane neutral.
  if (smallTurnish && d.style === "chase") traffic -= 8;
  if (d.style === "escape" && pace.escapeCount === 1) traffic += 5;
  if (d.stats.nerve >= 75) traffic *= 0.5;
  if (straightish && (d.style === "late" || d.style === "chase")) stylePos += 3;
  if (smallTurnish) {
    turnHandle += (d.stats.turn - 60) * 0.10;
  }
  return clamp(50 + lane + traffic + stylePos + turnHandle, 0, 100);
}

function randomPower(d) {
  const range = 5 + Math.max(0, (50 - d.stats.nerve) / 10);
  return randRange(-range, range);
}

// Stamina pool & costs per spec 03 §14.
function staminaPool(d, form) {
  const dist = DISTANCE[race => race] && 0; // placeholder, real dist passed below
  return d.stats.stamina*1.0 + d.stats.nerve*0.20 + formPower(form)*0.20;
}

function sectionStaminaCost(d, phase, race, pace) {
  const base = phase === "early" ? 20 : phase === "mid" ? 30 : 25;
  const distMult = DISTANCE[race.distance].mult;
  let cost = base * distMult;

  // PaceCost per spec §14.4. The pace-base table is read as race-overall pace
  // signal; the per-section cost is delivered through the style×phase modifier
  // below. Per §12.10 (Target Feel) and §12.12 #6 (collapse must be
  // understandable, not universal): pace alone shouldn't crush every dragon.
  // We still scale the pace base lightly to keep slow/high pace distinct.
  const paceBase = { slow:-2, standard:0, high:3, very_high:6 }[pace.type];
  cost += paceBase;
  const stylePaceMod = {
    escape: { early: 8, mid: 4, late: 5 },
    front:  { early: 4, mid: 4, late: 2 },
    late:   { early:-3, mid: 0, late: 8 },
    chase:  { early:-5, mid: 0, late:12 }
  }[d.style][phase];
  cost += stylePaceMod;

  // TerrainCost
  const sect = getSection(phase, race[phase]);
  if (sect.terrain) {
    cost += Math.max(0, 60 - d.stats[sect.terrain.stat]) * sect.terrain.coef;
    if (sect.terrain.also) {
      cost += Math.max(0, 60 - d.stats[sect.terrain.also.stat]) * sect.terrain.also.coef;
    }
  }

  // PositionCost (light approximation)
  if (phase === "mid" && race.mid === "crowded_bridge") cost += 4;
  if (phase === "mid" && d.style === "chase") cost += 2;

  // EfficiencyBonus — relevant stat depending on section
  const relStatMap = {
    long_straight_start: "speed", uphill_start:"stamina", narrow_start:"turn",
    fire_gate_start:"fire", mist_start:"nerve",
    grand_turn:"turn", repeated_small_turns:"turn", aerial_wind_lane:"wing",
    rolling_terrain:"stamina", crowded_bridge:"nerve",
    long_final_straight:"speed", short_final_straight:"speed",
    final_grand_turn:"turn", tailwind_straight:"wing", volcanic_finish:"fire"
  };
  const rel = relStatMap[race[phase]];
  if (rel) {
    const bonus = Math.min(6, Math.max(0, d.stats[rel] - 70) * 0.15);
    cost -= bonus;
  }

  return Math.max(5, cost);
}

function staminaAdjustment(ratio, d) {
  if (ratio >= 0.70) return { adj: 6, collapse:false };
  if (ratio >= 0.50) return { adj: 2, collapse:false };
  if (ratio >= 0.30) return { adj: 0, collapse:false };
  if (ratio >= 0.15) return { adj: -6, collapse:false };
  if (ratio >= 0.00) return { adj: -14, collapse:true };
  // Below zero: collapse
  const deficit = Math.abs(ratio) * 50;
  let penalty = -10 - Math.min(10, deficit * 0.4);
  const nerveRed = Math.max(0, (d.stats.nerve - 60) * 0.10);
  penalty += nerveRed;
  return { adj: -14 + penalty, collapse:true };
}

// Main race simulator.
// trialForms: optional {dragonId: form} map. If supplied, those forms are used
// instead of fresh ones — this links the trial-run summary shown in the UI to
// the actual race result (per §07 §11).
function runRace(race, trialForms) {
  const distBonus = DISTANCE[race.distance].bonus;

  // Build entries with form, base, course, weather pre-calculated.
  // §07 §9: 8 dragons per race (chosen per-race in data_races.js).
  const raceDragons = getRaceDragons(race);
  const entries = raceDragons.map(d => {
    const form = (trialForms && trialForms[d.id]) || generateForm(d);
    return {
      dragon: d,
      form,
      formPower: formPower(form),
      basePower: basePower(d),
      coursePower: coursePower(d, race),
      weatherPower: weatherPower(d, race)
    };
  });

  // Pace requires entry list.
  const pace = paceClassify(entries);

  // Per-dragon calc
  for (const e of entries) {
    const d = e.dragon;
    e.pacePower = pacePower(d, pace);
    e.positionPower = positionPower(d, race, pace);
    e.randomPower = randomPower(d);

    // Stamina pool
    e.staminaPool = d.stats.stamina*1.0 + d.stats.nerve*0.20 + e.formPower*0.20 + distBonus;

    // Section costs
    e.staminaCosts = {
      early: sectionStaminaCost(d, "early", race, pace),
      mid:   sectionStaminaCost(d, "mid",   race, pace),
      late:  sectionStaminaCost(d, "late",  race, pace)
    };
    e.staminaRemaining = e.staminaPool - e.staminaCosts.early - e.staminaCosts.mid - e.staminaCosts.late;
    e.staminaRatio = e.staminaRemaining / e.staminaPool;
    const stAdj = staminaAdjustment(e.staminaRatio, d);
    e.staminaAdjustment = stAdj.adj;
    e.collapse = stAdj.collapse;

    // FinalPower — per spec §2 weights. RandomPower is per §13 already
    // generated in the ±5–±9 range with Nerve modulation; that absolute range
    // is meant to create uncertainty (§19 #5), so it's added directly here
    // rather than scaled by 0.05 (which would crush it to ±0.25–0.45 and
    // make outcomes deterministic — failing §12.12 #2).
    e.finalPower =
      e.basePower * 0.35 +
      e.coursePower.total * 0.20 +
      e.weatherPower * 0.10 +
      e.formPower * 0.15 +
      e.pacePower * 0.10 +
      e.positionPower * 0.05 +
      e.randomPower +
      e.staminaAdjustment;
  }

  // Tie-break sort
  entries.sort((a,b) => {
    if (b.finalPower !== a.finalPower) return b.finalPower - a.finalPower;
    if (b.coursePower.late !== a.coursePower.late) return b.coursePower.late - a.coursePower.late;
    if (b.staminaRemaining !== a.staminaRemaining) return b.staminaRemaining - a.staminaRemaining;
    return b.dragon.stats.nerve - a.dragon.stats.nerve;
  });
  entries.forEach((e,i) => e.rank = i+1);

  const logs = generateRaceLog(race, entries, pace);

  return { race, entries, pace, logs };
}

// Race log: phase-by-phase narrative driven by signals.
function generateRaceLog(race, entries, pace) {
  const logs = [];
  const sortByEarly = [...entries].sort((a,b) => b.coursePower.early - a.coursePower.early);
  const sortByMid   = [...entries].sort((a,b) => b.coursePower.mid   - a.coursePower.mid);
  const sortByLate  = [...entries].sort((a,b) => b.coursePower.late  - a.coursePower.late);

  const e = getSection("early", race.early).label;
  const m = getSection("mid", race.mid).label;
  const l = getSection("late", race.late).label;

  logs.push({ phase: "スタート", lines: [
    `${e}。${sortByEarly[0].dragon.name}が好発進、序盤の主導権を握る。`
  ]});

  const paceLabel = { slow:"スロー", standard:"標準", high:"ハイ", very_high:"超ハイ"}[pace.type];
  logs.push({ phase: "ペース形成", lines: [
    `逃げ${pace.escapeCount}・先行${pace.frontCount}・追込${pace.chaseCount}。ペースは${paceLabel}。`
  ]});

  logs.push({ phase: "中盤", lines: [
    `${m}を抜けたところで${sortByMid[0].dragon.name}が押し上がる。`
  ]});

  // Collapse notes
  const collapsed = entries.filter(en => en.collapse);
  if (collapsed.length > 0) {
    const cn = collapsed.map(en => en.dragon.name).join("、");
    logs.push({ phase: "スタミナ", lines: [
      `脚色が鈍る！ ${cn} は終盤で苦しくなった。`
    ]});
  } else {
    logs.push({ phase: "スタミナ", lines: [
      `各竜まだ脚を残している。決め手勝負へ。`
    ]});
  }

  logs.push({ phase: "終盤", lines: [
    `${l}。${sortByLate[0].dragon.name}が終いで伸びる！`
  ]});

  // Finish
  const top3 = entries.slice(0,3).map((en,i) => `${i+1}着 ${en.dragon.name}`).join("、");
  logs.push({ phase: "決着", lines: [
    `${entries[0].dragon.name}が${entries[0].rank === 1 ? "勝利" : "先頭"}！ ${top3}。`
  ]});

  return logs;
}
