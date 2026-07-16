/**
 * commentary_engine.js — Mimi's race commentary engine (spec #28).
 *
 * Generates dense, accurate, fast-paced race commentary from the already
 * calculated broadcast data. This is NOT random flavor text: every line is
 * derived from the real per-phase order, rank movement, course section,
 * weather, pace, stamina and dragon traits. We never invent a fact that would
 * contradict race_engine's result (§28 §12).
 *
 * Style (§28 §3): serious sports-broadcast tone, dragon names WITHOUT
 * honorifics, short sentence bursts, neutral most of the time with a little
 * heat near the finish. Betting terms stay mostly in the UI (§28 §4.1/§10):
 * commentary only touches the bet when it is essential to the drama.
 *
 * Output per phase (§28 §9.2):
 *   { phaseId, tempoMs, lines[], focusDragonIds, tags, visualMode }
 *
 * EXTENSION POINT: new phase rhythm → PHASE_TEMPO / PHASE_LINE_TARGET; new
 * dragon voice → DRAGON_PERSONA in commentary_data.js; new situational beat →
 * add a builder and call it from the per-phase composer below.
 */

// §28 §5.2 telop tempo (ms per line) — later phases are faster.
const PHASE_TEMPO = { early: 1300, mid: 1100, development: 1000, late: 800, finish: 650 };
// §28 §5.3 lines per phase (target; engine caps near these).
const PHASE_LINE_TARGET = { early: 8, mid: 10, development: 12, late: 15, finish: 9 };

function ceRankWord(r) {
  return r === 1 ? "先頭" : `${r}番手`;
}

function cePick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Situational beat builders -------------------------------------------
// Each returns a string or null. The phase composer collects them, the
// finalizer dedupes + caps to the phase target.

// Top-N position read: "ルベル、先頭。" / "ポロが2番手。" / "セラムは3番手。"
function positionBeats(phase, n) {
  const verbs = ["、", "が", "は"];
  return phase.orderedEntries.slice(0, n).map((e, i) => {
    const name = commentaryName(e.dragon.id);
    const r = i + 1;
    if (r === 1) return `${name}、${ceRankWord(1)}。`;
    return `${name}${verbs[i % verbs.length]}${ceRankWord(r)}。`;
  });
}

// Dragons that gained/lost >=2 since last phase. Prefer persona voice.
function moverBeats(phase, prevPhase, maxUp, maxDown) {
  if (!prevPhase) return [];
  const ups = [], downs = [];
  phase.orderedEntries.forEach((e, i) => {
    const r = i + 1;
    const prevR = prevPhase.currRankMap[e.dragon.id] || r;
    const delta = prevR - r;
    if (delta >= 2) ups.push({ id: e.dragon.id, r, delta });
    else if (delta <= -2 && !e.collapse) downs.push({ id: e.dragon.id, r, delta });
  });
  ups.sort((a, b) => b.delta - a.delta);
  downs.sort((a, b) => a.delta - b.delta);
  const out = [];
  ups.slice(0, maxUp).forEach(m => {
    out.push(personaLine(m.id, "rising") || `${commentaryName(m.id)}が上がる、${ceRankWord(m.r)}。`);
  });
  downs.slice(0, maxDown).forEach(m => {
    out.push(personaLine(m.id, "fading") || `${commentaryName(m.id)}、後退。`);
  });
  return out;
}

// Popularity vs position (§28 §6.4/§7.6/§7.7) — leader hype + underdog rising.
function popularityBeats(phase, ctx) {
  if (!ctx.oddsResult) return [];
  const popMap = {};
  ctx.oddsResult.oddsData.forEach(o => { popMap[o.dragonId] = o.popularityRank; });
  const out = [];
  const lead = phase.orderedEntries[0];
  if (lead && popMap[lead.dragon.id] === 1) {
    out.push(`1番人気${commentaryName(lead.dragon.id)}、まだ${ceRankWord(1)}。`);
  }
  // an underdog (>=5 popularity) inside the top 3
  const under = phase.orderedEntries.slice(0, 3).find((e, i) => (popMap[e.dragon.id] || 9) >= 5);
  if (under) {
    const r = phase.currRankMap[under.dragon.id];
    out.push(`人気薄の${commentaryName(under.dragon.id)}が${ceRankWord(r)}。`);
  }
  return out;
}

// Course section meaning (§28 §7.3). sectionKey ∈ early|mid|late.
function sectionBeats(race, phaseLabel, sectionKey) {
  const label = sectionLabelOf(race, sectionKey);
  const why = sectionWhy(race, sectionKey);
  const out = [];
  if (label) out.push(`${phaseLabel}、${label}。`);
  if (why) out.push(why);
  return out;
}

// A focus dragon whose trait fits the moment (§28 §7.5).
function traitBeat(phase) {
  for (const id of (phase.focusDragonIds || [])) {
    const e = phase.orderedEntries.find(x => x.dragon.id === id);
    if (!e) continue;
    const r = phase.currRankMap[id];
    const kind = r === 1 ? "lead" : r <= 3 ? "holding" : r >= 7 ? "back" : "trait";
    const line = personaLine(id, kind) || personaLine(id, "trait");
    if (line) return line;
  }
  return null;
}

// Stamina as 脚色 (§28 §6.5/§7.9) — never a number. Flags a tiring leader.
function staminaBeats(phase) {
  const out = [];
  const tiring = phase.orderedEntries.find(e =>
    e.collapse && phase.currRankMap[e.dragon.id] <= 4);
  if (tiring) {
    out.push(personaLine(tiring.dragon.id, "fading")
      || `${commentaryName(tiring.dragon.id)}、脚色が鈍る。`);
  }
  return out;
}

// Bet beat — only when essential (§28 §4.1). Subtle, no loud 馬券用語.
function essentialBetBeat(phase, ctx) {
  const bs = phase.bettingStatus;
  if (!bs || !bs.targets || !bs.targets.length) return null;
  // Mention only the moment a target steps onto/off the 3rd-place line.
  if (phase.id === "development" || phase.id === "late") {
    const justInRange = bs.targets.find(t => t.rank === 3);
    if (justInRange) return `${commentaryName(justInRange.id)}、3番手。ここで圏内。`;
  }
  return null;
}

// --- Per-phase composers --------------------------------------------------

function composeEarly(phase, prevPhase, ctx) {
  const lines = [];
  lines.push(cePick(["スタートが切られた。", "ゲートが開いた。", "8頭、一斉に飛び出す。"]));
  if (phase.tags.includes("good_start")) {
    const fast = phase.orderedEntries[0];
    lines.push(personaLine(fast.dragon.id, "lead") || `${commentaryName(fast.dragon.id)}が好発進。`);
  }
  if (phase.tags.includes("slow_start")) {
    const slow = phase.orderedEntries.find((e, i) => i + 1 >= 7);
    if (slow) lines.push(`${commentaryName(slow.dragon.id)}は出遅れた。`);
  }
  lines.push(...positionBeats(phase, 3));
  lines.push(...popularityBeats(phase, ctx));
  if (ctx.race.weather !== "clear") lines.push(weatherFlavor(ctx.race.weather));
  lines.push(traitBeat(phase));
  return lines;
}

function composeMid(phase, prevPhase, ctx) {
  const lines = [];
  lines.push(...sectionBeats(ctx.race, phase.label, "mid"));
  if (ctx.race.weather !== "clear") lines.push(weatherFlavor(ctx.race.weather));
  lines.push(...moverBeats(phase, prevPhase, 1, 0));
  lines.push(traitBeat(phase));
  lines.push(...positionBeats(phase, 3));
  lines.push(...popularityBeats(phase, ctx));
  return lines;
}

function composeDevelopment(phase, prevPhase, ctx) {
  const lines = [];
  const pace = ctx.raceResult && ctx.raceResult.pace;
  if (pace) paceFlavor(pace.type).forEach(l => lines.push(l));
  if (phase.tags.includes("favorite_fade")) {
    const fav = favoriteEntry(phase, ctx);
    if (fav) lines.push(`${commentaryName(fav.dragon.id)}、苦しくなってきた。`);
  }
  lines.push(...moverBeats(phase, prevPhase, 2, 1));
  lines.push(...staminaBeats(phase));
  lines.push(traitBeat(phase));
  lines.push(...positionBeats(phase, 2));
  lines.push(essentialBetBeat(phase, ctx));
  lines.push(...popularityBeats(phase, ctx));
  return lines;
}

function composeLate(phase, prevPhase, ctx) {
  const lines = [];
  lines.push(distancePhrase(phase.distanceRemaining));
  lines.push(...positionBeats(phase, 3));
  lines.push(...moverBeats(phase, prevPhase, 2, 0));
  // 粘り — a forward dragon holding on
  const holder = phase.orderedEntries.slice(0, 2).find(e => !e.collapse);
  if (holder) lines.push(personaLine(holder.dragon.id, "holding")
    || `${commentaryName(holder.dragon.id)}、まだ粘る。`);
  lines.push(...staminaBeats(phase));
  lines.push(essentialBetBeat(phase, ctx));
  if (phase.tags.includes("late_surge") || phase.tags.includes("close_finish")) {
    lines.push("後ろから脚が来る。");
  }
  lines.push("残りわずか。");
  return lines;
}

function composeFinish(phase, prevPhase, ctx) {
  const lines = [];
  const o = phase.orderedEntries; // final order
  lines.push(`${commentaryName(o[0].dragon.id)}、抜け出す。`);
  if (o[1]) lines.push(`${commentaryName(o[1].dragon.id)}が追う。`);
  if (o[2]) lines.push(`外から${commentaryName(o[2].dragon.id)}。`);
  if (phase.tags.includes("photo_finish")) lines.push("横一線。");
  else if (phase.tags.includes("close_finish")) lines.push("際どい。");
  lines.push("今、聖龍門へ。");
  lines.push(`1着、${commentaryName(o[0].dragon.id)}。`);
  if (o[1]) lines.push(`2着、${commentaryName(o[1].dragon.id)}。`);
  if (o[2]) lines.push(`3着、${commentaryName(o[2].dragon.id)}。`);
  return lines;
}

function favoriteEntry(phase, ctx) {
  if (!ctx.oddsResult) return null;
  const fav = ctx.oddsResult.oddsData.find(o => o.popularityRank === 1);
  if (!fav) return null;
  return phase.orderedEntries.find(e => e.dragon.id === fav.dragonId) || null;
}

// --- Finalize: dedupe + cap to target -------------------------------------

function finalizeLines(raw, phaseId) {
  const cleaned = [];
  for (const item of raw) {
    if (!item) continue;
    const s = String(item).trim();
    if (!s) continue;
    if (cleaned.length && cleaned[cleaned.length - 1] === s) continue; // no immediate repeat
    cleaned.push(s);
  }
  // drop exact global repeats (keep first occurrence)
  const seen = new Set();
  const dq = [];
  for (const s of cleaned) {
    if (seen.has(s)) continue;
    seen.add(s);
    dq.push(s);
  }
  const target = PHASE_LINE_TARGET[phaseId] || 10;
  const max = target + 3;
  if (dq.length <= max) return dq;
  // keep the head and the closing tail (finish's 着順 lives at the tail)
  const head = dq.slice(0, Math.ceil(max * 0.55));
  const tail = dq.slice(dq.length - (max - head.length));
  return [...head, ...tail];
}

// --- ★G6: マクラ人格レイヤ（NARRATIVE_DESIGN）------------------------------
// 第4話でマクラと出会って以降、実況に配信者の人格が乗る“文言だけ”のレイヤ。
// 事実（竜名・順位・着順）は一切改変しない＝固有フレーズの挿入と、動きの行の語尾の熱だけ。
// 門番=advisorMet（fail-closed：判定できなければ素の実況のまま）。抽選・結果には不干渉。
const MAKURA_PHRASES = {
  early:       ["さあ始まった始まった、実況はこのマクラ！", "初見さんも常連さんも、いらっしゃい！"],
  mid:         ["同接、伸びてる伸びてる！", "コメントの流速がえらいことに。"],
  development: ["……はい今の、切り抜きポイントね。", "コメント欄、追いつけてるー？"],
  late:        ["声出していこう、ここからだよ！", "推しの名前、叫んでけ！"],
  finish:      ["アーカイブ残留、確定だァ！", "今日も見に来てくれて、あざした〜！"]
};
function makuraLayer(lines, phaseId) {
  try { if (!(typeof advisorMet === "function" && advisorMet("makura"))) return lines; }
  catch (e) { return lines; }
  const out = lines.slice();
  const pool = MAKURA_PHRASES[phaseId] || [];
  if (pool.length) {
    const ph = pool[out.length % pool.length];
    if (phaseId === "early") out.splice(1, 0, ph);              // スタート宣言の直後
    else if (phaseId === "finish") out.push(ph);                // 着順の後ろ＝事実行に触れない
    else out.splice(Math.min(2, out.length), 0, ph);
  }
  if (phaseId === "late" || phaseId === "finish") {
    for (let i = 0; i < out.length; i++) {
      const s = out[i];
      if (/^[123]着、/.test(s)) continue;                        // 着順の事実行は不変
      if (/(抜け出す|が追う|まだ粘る|脚が来る)。$/.test(s)) out[i] = s.slice(0, -1) + "ッ！";
    }
  }
  return out;
}

// --- Public ----------------------------------------------------------------

/**
 * Build one phase's commentary object.
 * @param {object} phase      broadcast phase
 * @param {object} prevPhase  previous broadcast phase (nullable)
 * @param {object} ctx        { race, bet, oddsResult, raceResult }
 */
function buildPhaseCommentary(phase, prevPhase, ctx) {
  let raw;
  switch (phase.id) {
    case "early":       raw = composeEarly(phase, prevPhase, ctx); break;
    case "mid":         raw = composeMid(phase, prevPhase, ctx); break;
    case "development": raw = composeDevelopment(phase, prevPhase, ctx); break;
    case "late":        raw = composeLate(phase, prevPhase, ctx); break;
    case "finish":      raw = composeFinish(phase, prevPhase, ctx); break;
    default:            raw = positionBeats(phase, 3);
  }
  return {
    phaseId: phase.id,
    tempoMs: PHASE_TEMPO[phase.id] || 1000,
    lines: makuraLayer(finalizeLines(raw, phase.id), phase.id),
    focusDragonIds: phase.focusDragonIds || [],
    tags: phase.tags || [],
    visualMode: phase.visualMode
  };
}

/**
 * Build every phase's commentary object in order.
 * @returns {Array<{phaseId,tempoMs,lines,focusDragonIds,tags,visualMode}>}
 */
function buildAllCommentary(broadcastData, ctx) {
  const out = [];
  let prev = null;
  for (const phase of broadcastData.phases) {
    out.push(buildPhaseCommentary(phase, prev, ctx));
    prev = phase;
  }
  return out;
}
