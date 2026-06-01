/**
 * commentary_engine.js — Mimi's race-only race commentator (spec §27 §9).
 *
 * Generates dense, short-line commentary queues per broadcast phase. The
 * commentary is derived purely from broadcast data (which is derived from
 * race_engine output); we never invent facts that would contradict the
 * actual rank / pace / stamina state.
 *
 * Tone: cheerleader-style, fast, peppered with -ちゃん, focused on the
 * player's bet status.
 *
 * EXTENSION POINT: new tag → handle in tagLine() so the dialogue stays in
 * sync with broadcast tags.
 */

// Short-name accessor (drops the prefix kanji + 竜 so commentary stays punchy).
function dragonShortName(id) {
  const d = DRAGONS.find(x => x.id === id);
  if (!d) return id;
  // 赤翼竜ルベル → ルベル / 鳳凰竜フェニックス → フェニックス
  const m = d.name.match(/竜(.+)$/);
  return (m ? m[1] : d.name) + "ちゃん";
}

function rankWord(r) {
  return r === 1 ? "先頭" : `${r}番手`;
}

const PHASE_OPENERS = {
  early:       ["ゲートが開いた！", "スタートです！", "8頭一斉に飛び出しました！"],
  mid:         ["中盤に入ります！", "ここから区間のクセが出ます！"],
  development: ["ペースが動きます！", "ここで人気竜にも疲れが…！"],
  late:        ["残り直線！", "ラストスパート！"],
  finish:      ["ゴール板が見えた！", "決着の瞬間です！"]
};

const PHASE_TARGET_COUNT = {
  early: 7, mid: 9, development: 11, late: 14, finish: 7
};

/**
 * @param {object} phase           broadcast phase object
 * @param {object} prevPhase       previous phase (for delta callouts), nullable
 * @param {object} ctx             { race, bet, oddsResult }
 * @returns {string[]} commentaryQueue
 */
function buildCommentaryQueue(phase, prevPhase, ctx) {
  const q = [];
  const { race, bet, oddsResult } = ctx;
  const targetCount = PHASE_TARGET_COUNT[phase.id] || 8;

  // -- Opener
  q.push(pickOne(PHASE_OPENERS[phase.id]));
  q.push(`${phase.label}・${phase.sectionName}！`);
  if (phase.distanceRemaining > 0) q.push(`残り${phase.distanceRemaining}！`);

  // -- Top 3 callout
  const top3 = phase.orderedEntries.slice(0, 3);
  q.push(`${rankWord(1)}は${dragonShortName(top3[0].dragon.id)}！`);
  q.push(`${rankWord(2)}は${dragonShortName(top3[1].dragon.id)}！`);
  q.push(`${rankWord(3)}は${dragonShortName(top3[2].dragon.id)}！`);

  // -- Rank movers
  if (prevPhase) {
    const movers = phase.orderedEntries.map((e, i) => {
      const prevR = prevPhase.currRankMap[e.dragon.id] || (i + 1);
      return { id: e.dragon.id, delta: prevR - (i + 1), now: i + 1 };
    }).filter(m => Math.abs(m.delta) >= 2);
    movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    movers.slice(0, 3).forEach(m => {
      if (m.delta > 0) q.push(`${dragonShortName(m.id)}、ぐっと上がって${rankWord(m.now)}！`);
      else            q.push(`${dragonShortName(m.id)}、苦しい、${rankWord(m.now)}に下がる！`);
    });
  }

  // -- Tag-driven flavor lines
  phase.tags.forEach(tag => {
    const line = tagLine(tag, phase, ctx);
    if (line) q.push(line);
  });

  // -- Bet status (always — this is what the player cares about)
  appendBetStatusLines(q, phase, ctx);

  // -- Finish: declare the result
  if (phase.id === "finish") {
    const o = phase.orderedEntries;
    q.push(`${dragonShortName(o[0].dragon.id)}が1着！`);
    q.push(`2着${dragonShortName(o[1].dragon.id)}！ 3着${dragonShortName(o[2].dragon.id)}！`);
  }

  // -- Trim or pad toward target density
  return trimToDensity(q, targetCount);
}

function appendBetStatusLines(q, phase, ctx) {
  const bs = phase.bettingStatus;
  if (!bs || !bs.targets || bs.targets.length === 0) return;
  if (ctx.bet.type === "win") {
    const t = bs.targets[0];
    if (phase.id === "finish") {
      q.push(t.rank === 1 ? "単竜、的中です！" : `単竜、${rankWord(t.rank)}で届かず…！`);
    } else {
      if (t.rank === 1) q.push("単竜、先頭キープ！");
      else if (t.rank === 2) q.push("単竜、あと一歩！");
      else if (t.rank <= 4) q.push(`単竜、まだ届きます、${rankWord(t.rank)}！`);
      else q.push("単竜、ここから差し切れるか…！");
    }
    return;
  }
  if (ctx.bet.type === "place") {
    const t = bs.targets[0];
    if (phase.id === "finish") {
      q.push(t.rank <= 3 ? "複竜、的中です！" : "複竜、ぎりぎり届かず…！");
    } else {
      if (t.rank <= 2) q.push("複竜、安全圏！");
      else if (t.rank === 3) q.push("複竜、3着ラインを守れ！");
      else if (t.rank === 4) q.push("複竜、あと1枚！");
      else q.push("複竜、ここから巻き返せ！");
    }
    return;
  }
  // wide
  const inRange = bs.targets.filter(t => t.rank <= 3).length;
  if (phase.id === "finish") {
    q.push(inRange === 2 ? "ワイド竜、的中です！"
         : inRange === 1 ? "ワイド竜、片方届かず…！"
         : "ワイド竜、届かず…！");
    return;
  }
  if (inRange === 2) q.push("ワイド竜、2頭とも圏内！");
  else if (inRange === 1) {
    const out = bs.targets.find(t => t.rank > 3);
    q.push(`ワイド竜、あと1頭！ ${dragonShortName(out.id)}！`);
  } else {
    q.push("ワイド竜、苦しい…どちらも圏外！");
  }
}

function tagLine(tag, phase, ctx) {
  const lead = phase.orderedEntries[0].dragon.id;
  switch (tag) {
    case "favorite_leads":    return `${dragonShortName(lead)}、人気馬の貫禄！`;
    case "favorite_fade":     return "人気馬、苦しくなってきました！";
    case "underdog_rising":   return "穴竜、ぐいぐい来ています！";
    case "rank_up":           return null; // already covered by movers
    case "stamina_fade":      return "脚が止まる竜、出てきました！";
    case "good_start":        return "好スタート、前を取りました！";
    case "slow_start":        return "出遅れた竜、追走苦しい！";
    case "section_boost_wind":   return "翼竜にとって追い風です！";
    case "section_trouble_turn": return "カーブで膨らむ竜あり！";
    case "section_boost_fire":   return "火力勝負の区間！";
    case "section_trouble_fog":  return "霧で視界不良、気性勝負！";
    case "late_surge":        return "外から差し脚！来てる！";
    case "close_finish":      return "ゴール前、横一線！";
    case "photo_finish":      return "写真判定、紙一重！";
    default: return null;
  }
}

function trimToDensity(arr, target) {
  if (arr.length <= target + 2) return arr;
  // Keep first 4 (opener) + last 3 (closer) + interleave middle
  const head = arr.slice(0, 4);
  const tail = arr.slice(-3);
  const middle = arr.slice(4, arr.length - 3);
  const want = target - head.length - tail.length;
  if (want <= 0) return [...head, ...tail];
  const step = Math.max(1, Math.floor(middle.length / want));
  const picked = [];
  for (let i = 0; i < middle.length && picked.length < want; i += step) {
    picked.push(middle[i]);
  }
  return [...head, ...picked, ...tail];
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Convenience: build all phase queues at once.
function buildAllCommentary(broadcastData, ctx) {
  const out = [];
  let prev = null;
  for (const phase of broadcastData.phases) {
    out.push(buildCommentaryQueue(phase, prev, ctx));
    prev = phase;
  }
  return out;
}
