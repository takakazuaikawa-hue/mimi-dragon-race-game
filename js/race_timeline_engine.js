/**
 * race_timeline_engine.js — the continuous "physics" layer the canvas player
 * animates (spec follow-up: smooth, result-faithful race visualisation).
 *
 * WHY THIS EXISTS
 *   race_engine.js decides a FINAL ordering (finalPower) and broadcast_engine.js
 *   samples a believable strength at only 5 phases. Five snapshots cannot show
 *   moment-to-moment overtaking, speeding up / slowing down, stumbles, effort,
 *   or a real finish-line crossing — positions just snap between checkpoints.
 *   This module turns the already-decided result into a CONTINUOUS distance-
 *   over-time curve for every dragon, sampled finely over a shared race clock.
 *
 * HARD INVARIANT (never break — the result is the single source of truth):
 *   Each dragon reaches the goal (progress = 1) at a strictly ordered finish
 *   time `finishTau`, ordered by race_engine's rank. Therefore the crossing
 *   order is EXACTLY raceResult order, and the closing margins come from the
 *   finalPower gaps (a tiny gap → a photo finish). Between gun and goal the
 *   dragons trade places freely (style + per-phase tempo), but nothing here
 *   ever changes who wins, the payouts, the odds, or the player's coins.
 *   Stumbles / surges are injected into the tempo and the cumulative curve is
 *   renormalised so the dragon still finishes at its appointed finishTau — the
 *   wobble is visible, the result is untouched.
 *
 * Depends on (all loaded earlier): utils.js (clamp), broadcast_engine.js
 *   (phaseScore, DISTANCE_TOTAL), data_dragons.js (dragonColor).
 */

// Shared-clock resolution. The renderer interpolates between these samples.
const TL_GRID = 360;

// Control points for each dragon's own-time tempo curve. Progress fractions of
// the dragon's run (u = own-time / finishTau). They line up with the broadcast
// phases (early/mid/development/late/finish) plus a u=0 start anchor.
const TL_CTRL_U = [0.0, 0.16, 0.40, 0.62, 0.82, 1.0];

// Canonical relative-speed shape per running style (mean ≈ 1, renormalised
// later). Escapers burn early then ebb; closers sit then surge late. This is
// what makes the lead change hands on screen.
const TL_STYLE_TEMPO = {
  escape: [1.21, 1.18, 1.07, 0.99, 0.92, 0.95],
  front:  [1.10, 1.12, 1.07, 1.01, 0.97, 0.99],
  late:   [0.90, 0.93, 0.99, 1.05, 1.13, 1.10],
  chase:  [0.82, 0.87, 0.96, 1.07, 1.19, 1.15]
};

// τ thresholds that map the shared clock onto the 5 commentary phases, so the
// telop and HUD stay in sync with what the dragons are doing on screen.
const TL_PHASE_TAU = [0.18, 0.44, 0.66, 0.86, 1.01];

// Wall-clock pacing (seconds at 1× speed). A race is meant to be a single
// ~1-minute beat you actually want to watch; skip / 2× / 3× are the player-
// friendly escape hatches layered on top in the canvas player. Kept in one
// tunable place so race length stays data-driven (raise `base` for longer
// races; this NEVER affects the finishing order, odds, payouts, or coins —
// it is only how fast the fixed result is played back).
const TL_DURATION = {
  base: 46,         // seconds at the reference distance (snappier — was 54)
  refMeters: 1200,  // distance that maps to `base`
  perKm: 7,         // extra seconds per +1000m of distance
  min: 42,          // never shorter than this at 1×
  max: 56           // never longer than this at 1×
};

// Finish-line DRAMA profile (presentation only). The decided finalPower gaps
// still set the WITHIN-group proportions, but we re-cast the crossings so the
// race climaxes the way a broadcast does: the lead trio compresses into a tight
// dead-heat cluster, a clear break opens behind them, and the chasers string out
// — the field visually thins to three by the line. This reshapes only the
// SPACING of crossings; finishTaus remain strictly increasing, so the crossing
// order still equals raceResult order (odds, payouts, and coins never change).
// All knobs live here so the drama stays tunable / data-driven.
const TL_FINISH_DRAMA = {
  leadPack: 3,      // dragons in the climactic dead-heat group
  packSpan: 0.20,   // fraction of the finish window the lead trio occupies (tight)
  breakSpan: 0.20,  // empty gap between the trio and the chasers (visible break)
  spreadMin: 0.07,  // overall leader→last window, lower bound (τ)
  spreadMax: 0.18   // …upper bound — keeps the winner's crossing in the climax zone
};

// ---- small deterministic RNG so a race replays identically every render ----
function tlHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function tlRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smoothstep interpolation between two control values
function tlSmoothLerp(a, b, t) {
  const w = t * t * (3 - 2 * t);
  return a + (b - a) * w;
}

// Sample the piecewise-smooth tempo curve (6 non-uniform control points) at u.
function tlSampleCtrl(ctrl, u) {
  if (u <= TL_CTRL_U[0]) return ctrl[0];
  if (u >= TL_CTRL_U[TL_CTRL_U.length - 1]) return ctrl[ctrl.length - 1];
  for (let k = 0; k < TL_CTRL_U.length - 1; k++) {
    const u0 = TL_CTRL_U[k], u1 = TL_CTRL_U[k + 1];
    if (u >= u0 && u <= u1) {
      const t = (u - u0) / (u1 - u0);
      return tlSmoothLerp(ctrl[k], ctrl[k + 1], t);
    }
  }
  return ctrl[ctrl.length - 1];
}

// linear interpolation into a uniformly-sampled array over [0,1]
function tlInterp(arr, x) {
  if (x <= 0) return arr[0];
  if (x >= 1) return arr[arr.length - 1];
  const f = x * (arr.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  return arr[i] + (arr[i + 1] - arr[i]) * t;
}

/**
 * Per-phase field statistics for phaseScore, so we can nudge each dragon's
 * tempo toward how it actually stands at that phase (keeps the visible order
 * consistent with the broadcast tags & commentary, which read the same signal).
 */
function tlPhaseStats(entries) {
  const phases = ["early", "mid", "development", "late", "finish"];
  const stats = {};
  for (const p of phases) {
    let sum = 0;
    const vals = entries.map(e => { const v = phaseScore(e, p); sum += v; return v; });
    const mean = sum / entries.length;
    let varSum = 0;
    for (const v of vals) varSum += (v - mean) * (v - mean);
    const std = Math.sqrt(varSum / entries.length) || 1;
    stats[p] = { mean, std };
  }
  return stats;
}

/**
 * Build the continuous timeline.
 *
 * @param {object} race       race definition
 * @param {object} raceResult output of runRace() — read only
 * @param {object} oddsResult output of the market sim (popularity context)
 * @param {object} bet        player bet (optional)
 * @returns {object} timeline (see bottom of function)
 */
function buildRaceTimeline(race, raceResult, oddsResult, bet) {
  const entries = raceResult.entries;          // already sorted by rank
  const N = entries.length;
  const distanceMeters = (typeof DISTANCE_TOTAL !== "undefined" && DISTANCE_TOTAL[race.distance]) || 1800;
  const phaseStats = tlPhaseStats(entries);
  const phaseKeys = ["early", "mid", "development", "late", "finish"];

  // ---- 1) finish times: drama profile (tight lead trio + strung-out chasers) --
  // Raw per-place margins from the decided finalPower gaps (closer power → closer
  // at the line). We keep these PROPORTIONS for within-group spacing, then re-cast
  // them so the lead trio clusters into a dead heat and the chasers fan out behind
  // (see TL_FINISH_DRAMA). Order-preserving: finishTaus stays strictly increasing.
  const KGAP = 0.013, MMIN = 0.006, MMAX = 0.060;
  const rawCum = [0];
  for (let k = 0; k < N - 1; k++) {
    const gap = Math.max(0, entries[k].finalPower - entries[k + 1].finalPower);
    const m = clamp(gap * KGAP, MMIN, MMAX);
    rawCum.push(rawCum[k] + m);
  }
  const rawSpread = rawCum[N - 1] || 0.0001;

  // Normalised finishing positions q[i] ∈ [0,1] (q[0]=0 leader … q[N-1]=1 last).
  const K = Math.max(1, Math.min(TL_FINISH_DRAMA.leadPack, N));
  const q = new Array(N).fill(0);
  if (N <= K) {
    // tiny field — just the proportional spacing, all tight
    for (let i = 0; i < N; i++) q[i] = rawCum[i] / rawSpread;
  } else {
    const packSpan = TL_FINISH_DRAMA.packSpan;
    const chaseStart = packSpan + TL_FINISH_DRAMA.breakSpan;
    const packBase = (rawCum[K - 1] - rawCum[0]) || 1e-9;     // lead trio → [0, packSpan]
    for (let i = 0; i < K; i++) q[i] = ((rawCum[i] - rawCum[0]) / packBase) * packSpan;
    const chaseBase = (rawCum[N - 1] - rawCum[K - 1]) || 1e-9; // chasers → [chaseStart, 1]
    for (let i = K; i < N; i++) q[i] = chaseStart + ((rawCum[i] - rawCum[K - 1]) / chaseBase) * (1 - chaseStart);
  }

  // Overall leader→last window as a readable fraction of the race clock.
  const spread = clamp(rawSpread, TL_FINISH_DRAMA.spreadMin, TL_FINISH_DRAMA.spreadMax);
  const leaderTau = 1 - spread;
  const finishTaus = q.map(qi => leaderTau + qi * spread);
  // Win-margin closeness → photo finish; the lead trio is always a close group.
  const photoFinish = N > 1 && (finishTaus[1] - finishTaus[0]) < spread * 0.085;
  const closeFinish = N > 1 && (finishTaus[Math.min(K, N) - 1] - finishTaus[0]) < spread * 0.42;

  // ---- 2) per-dragon tempo curve + cumulative distance + events ----
  const dragons = entries.map((entry, idx) => {
    const d = entry.dragon;
    const style = d.style;
    const rng = tlRng(tlHash(race.id + ":" + d.id + ":" + idx + ":" + Math.round(entry.finalPower * 10)));
    const ctrl = (TL_STYLE_TEMPO[style] || TL_STYLE_TEMPO.front).slice();

    // nudge control points toward this dragon's per-phase standing
    for (let ci = 1; ci < ctrl.length; ci++) {
      const pk = phaseKeys[ci - 1];
      const st = phaseStats[pk];
      const z = clamp((phaseScore(entry, pk) - st.mean) / st.std, -1.6, 1.6);
      ctrl[ci] *= (1 + z * 0.05);
    }
    // stamina collapse → visible late fade for exactly the dragons race_engine
    // flagged (never anyone else).
    if (entry.collapse) { ctrl[4] *= 0.82; ctrl[5] *= 0.68; }

    // ---- discrete drama events (cosmetic; tempo dips/bumps are renormalised) ----
    const events = [];
    const nerve = (d.stats && d.stats.nerve) || 60;
    const turnHeavy = /turn/.test(race.mid || "") || /turn/.test(race.late || "");
    // stumble: shaky-nerved or turn-section dragons may trip mid-race
    let stumbleChance = 0.08 + (turnHeavy ? 0.12 : 0) + clamp((58 - nerve) / 120, 0, 0.28);
    if (idx === 0) stumbleChance *= 0.35;                // the eventual winner rarely trips
    let stumbleU = -1;
    if (rng() < stumbleChance) {
      stumbleU = 0.30 + rng() * 0.34;
      events.push({ type: "stumble", u: stumbleU, depth: 0.34 + rng() * 0.22 });
    }
    // effort surge: closers and the front of the field dig in late (頑張り)
    const isCloser = (style === "late" || style === "chase");
    if (idx < 3 || isCloser) {
      const su = (idx === 0) ? 0.80 + rng() * 0.10 : 0.72 + rng() * 0.16;
      events.push({ type: "surge", u: su, amp: 0.10 + (isCloser ? 0.06 : 0) + rng() * 0.05 });
    }
    // good start: front-running types that broke well
    if ((style === "escape" || style === "front") && phaseScore(entry, "early") >= phaseStats.early.mean) {
      events.push({ type: "good_start", u: 0.05 });
    }
    if (entry.collapse) events.push({ type: "collapse", u: 0.70 });

    // ---- fine tempo over own-time u ∈ [0,1] ----
    const FINE = 256;
    const tempo = new Float32Array(FINE + 1);
    for (let g = 0; g <= FINE; g++) {
      const u = g / FINE;
      let v = tlSampleCtrl(ctrl, u);
      for (const ev of events) {
        if (ev.type === "stumble") {
          const s = 0.045;
          v *= 1 - ev.depth * Math.exp(-((u - ev.u) * (u - ev.u)) / (s * s));
        } else if (ev.type === "surge") {
          const s = 0.06;
          v *= 1 + ev.amp * Math.exp(-((u - ev.u) * (u - ev.u)) / (s * s));
        }
      }
      tempo[g] = clamp(v, 0.45, 1.8);
    }

    // ---- cumulative distance C(u), normalised so C(1) = 1 exactly ----
    const cum = new Float32Array(FINE + 1);
    let acc = 0;
    for (let g = 1; g <= FINE; g++) {
      acc += (tempo[g] + tempo[g - 1]) * 0.5 * (1 / FINE);
      cum[g] = acc;
    }
    const total = cum[FINE] || 1;
    for (let g = 0; g <= FINE; g++) cum[g] /= total;

    return {
      id: d.id, entry, dragon: d, style,
      rank: entry.rank, collapse: !!entry.collapse,
      color: (typeof dragonColor === "function") ? dragonColor(d) : "#888",
      finishTau: finishTaus[idx],
      events, stumbleU,
      _cum: cum, _fine: FINE,
      // filled below on the shared τ grid
      P: new Float32Array(TL_GRID + 1),
      V: new Float32Array(TL_GRID + 1)
    };
  });

  // ---- 3) resample every dragon onto the shared race clock τ ∈ [0,1] ----
  for (const dr of dragons) {
    for (let g = 0; g <= TL_GRID; g++) {
      const tau = g / TL_GRID;
      let P;
      if (tau >= dr.finishTau) {
        P = 1;
      } else {
        const u = tau / dr.finishTau;
        P = tlInterp(dr._cum, u);
      }
      dr.P[g] = P;
    }
    // instantaneous speed = dP/dτ (numeric), for visual intensity
    for (let g = 0; g <= TL_GRID; g++) {
      const a = dr.P[Math.max(0, g - 1)];
      const b = dr.P[Math.min(TL_GRID, g + 1)];
      const dt = (Math.min(TL_GRID, g + 1) - Math.max(0, g - 1)) / TL_GRID;
      dr.V[g] = dt > 0 ? (b - a) / dt : 0;
    }
  }

  // ---- 4) crossings, in guaranteed finish order ----
  const ordered = [...dragons].sort((a, b) => a.finishTau - b.finishTau);
  const crossings = ordered.map((dr, i) => ({ id: dr.id, tau: dr.finishTau, place: i + 1 }));
  // Safety: the on-screen finish order MUST equal raceResult order.
  const want = entries.map(e => e.dragon.id).join(",");
  const got = ordered.map(dr => dr.id).join(",");
  if (want !== got) {
    console.warn("[timeline] crossing order != result order; forcing.", want, got);
    // force strict order by rank if anything drifted (should not happen)
    dragons.sort((a, b) => a.rank - b.rank);
    dragons.forEach((dr, i) => { dr.finishTau = leaderTau + (i / (N - 1 || 1)) * spread; });
  }

  const byId = {};
  dragons.forEach(dr => { byId[dr.id] = dr; });

  // duration hint (wall-clock seconds at 1×) scales gently with distance
  const durationSecHint = clamp(
    TL_DURATION.base + (distanceMeters - TL_DURATION.refMeters) / 1000 * TL_DURATION.perKm,
    TL_DURATION.min, TL_DURATION.max
  );

  return {
    raceId: race.id,
    race,
    distanceMeters,
    grid: TL_GRID,
    dragons,                 // result/rank order
    byId,
    crossings,               // finish order (== raceResult order)
    order: ordered.map(dr => dr.id),
    leadPackSize: K,                              // size of the climactic group
    leadPackIds: ordered.slice(0, K).map(dr => dr.id),  // the dead-heat trio (finish order)
    photoFinish,
    closeFinish,
    durationSecHint,

    // ---- query helpers used by the renderer ----
    progressAt(id, tau) { const dr = byId[id]; return dr ? tlInterp(dr.P, clamp(tau, 0, 1)) : 0; },
    speedAt(id, tau)    { const dr = byId[id]; return dr ? tlInterp(dr.V, clamp(tau, 0, 1)) : 0; },
    leaderProgressAt(tau) {
      let m = 0; for (const dr of dragons) { const p = tlInterp(dr.P, tau); if (p > m) m = p; } return m;
    },
    distanceRemainingAt(tau) {
      return Math.max(0, Math.round((1 - this.leaderProgressAt(tau)) * distanceMeters));
    },
    standingsAt(tau) {
      return dragons
        .map(dr => ({ id: dr.id, p: tlInterp(dr.P, tau), finishTau: dr.finishTau }))
        .sort((a, b) => (b.p - a.p) || (a.finishTau - b.finishTau))
        .map(x => x.id);
    },
    phaseIndexAt(tau) {
      for (let i = 0; i < TL_PHASE_TAU.length; i++) if (tau <= TL_PHASE_TAU[i]) return i;
      return TL_PHASE_TAU.length - 1;
    }
  };
}
