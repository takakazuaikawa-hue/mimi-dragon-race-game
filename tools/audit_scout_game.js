#!/usr/bin/env node
// =============================================================================
// tools/audit_scout_game.js — 竜スカウトの遊びを Node だけで検証する
// =============================================================================
// ★なぜ要るか
//   話しかけの窓・フェイント率・ダンスの譜面と判定は「数字の設計」であって、
//   実機で何十回も遊んで確かめるものではない。ここで筋を通しておけば、
//   実機では手ざわりだけを見ればよくなる。
//
// 使い方: node tools/audit_scout_game.js
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");

const sandbox = { console, window: {}, document: { addEventListener(){}, removeEventListener(){} },
                  setTimeout, clearTimeout, requestAnimationFrame: () => 0,
                  performance: { now: () => Date.now() }, Math, module: undefined };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = ["js/scout_game.js", "js/data_scout_topics.js"];
const parts = ["var SCOUT_TRUST_GOAL = 100, SCOUT_WARY_MAX = 100;"];
FILES.forEach(f => parts.push("\n//# " + f + "\n" + fs.readFileSync(path.join(ROOT, f), "utf8")));
parts.push(`
;({ SG_DIRS, SG_TUNE, sgRollTurn, sgJudgeTalk, sgJudgeStep, sgBuildChart,
    sgDanceResult, sgWindowMs, sgGapMs, sgFavGenre,
    SCOUT_TOPICS, SCOUT_TOPIC_DIRS, scoutTopicPick })`);

let S;
try { S = vm.runInContext(parts.join("\n"), sandbox, { filename: "sg-bundle.js" }); }
catch (e) { console.error("読み込みで失敗: " + e.message); process.exit(1); }

const bad = [];
const mkSess = (fickle, favCat) => ({ trust: 0, wary: 30, rng: 12345,
  persona: { fickle: fickle || 0, favCat: favCat || "身" } });

// ① 窓は進むほど短くなるか（後半ほど難しい＝設計どおりか）
{
  const s = mkSess();
  s.trust = 0;   const w0 = S.sgWindowMs(s), g0 = S.sgGapMs(s);
  s.trust = 100; const w1 = S.sgWindowMs(s), g1 = S.sgGapMs(s);
  if (!(w1 < w0)) bad.push("窓が終盤で短くなっていない: " + w0 + "→" + w1);
  if (!(g1 < g0)) bad.push("竜の動く間隔が終盤で詰まっていない: " + g0 + "→" + g1);
  if (w1 < 400) bad.push("終盤の窓が短すぎて理不尽: " + w1 + "ms");
  console.log("窓 " + w0 + "ms → " + w1 + "ms ／ 間隔 " + g0 + "ms → " + g1 + "ms");
}

// ② フェイント率：気まぐれな竜ほど多いか。多すぎないか。
{
  const rate = (fickle) => {
    const s = mkSess(fickle); let f = 0, n = 3000, prev = null;
    for (let i = 0; i < n; i++) { const t = S.sgRollTurn(s, prev); prev = t.dir; if (t.feint) f++; }
    return f / n;
  };
  const r0 = rate(0), r3 = rate(3);
  if (!(r3 > r0)) bad.push("気まぐれな竜でフェイントが増えていない");
  if (r3 > 0.45) bad.push("フェイントが多すぎる（理不尽）: " + (r3 * 100).toFixed(0) + "%");
  console.log("フェイント率 落ち着いた竜 " + (r0 * 100).toFixed(0) + "% ／ 気まぐれ " + (r3 * 100).toFixed(0) + "%");
}

// ③ 同じ方向が連続しないか（読みが単調にならないか）
{
  const s = mkSess(); let same = 0, prev = null;
  for (let i = 0; i < 2000; i++) { const t = S.sgRollTurn(s, prev); if (t.dir === prev) same++; prev = t.dir; }
  if (same > 0) bad.push("直前と同じ方向が出ている（単調になる）: " + same + "回");
}

// ④ 話しかけの判定：刺さると上がり、外すと下がるか。飽きは効くか。
{
  const s = mkSess(0, "間");                     // 好み＝そら
  const hit = S.sgJudgeTalk(s, "hit", "sora", []);
  const hitOther = S.sgJudgeTalk(s, "hit", "tabi", []);
  const bored = S.sgJudgeTalk(s, "hit", "sora", ["sora", "sora"]);
  const wrong = S.sgJudgeTalk(s, "wrong", null, []);
  if (!(hit.dt > hitOther.dt)) bad.push("好みのジャンルが優遇されていない");
  if (!hit.fav) bad.push("好み判定が立っていない");
  if (!(bored.dt < hit.dt)) bad.push("飽きが効いていない: " + hit.dt + " → " + bored.dt);
  if (!(wrong.dt < 0 && wrong.dw > 0)) bad.push("外したときに罰が無い");
  console.log("刺さる " + hit.dt + " ／ 好みでない " + hitOther.dt +
              " ／ 3回目 " + bored.dt + " ／ 外す " + wrong.dt + "（警戒+" + wrong.dw + "）");
}

// ⑤ 何手で成立まで行くか（長すぎ・短すぎを見る）
{
  const sim = (acc) => {                          // acc＝当てられる割合
    const s = mkSess(1, "間"); let turns = 0, recent = [];
    while (s.trust < 100 && s.wary < 100 && turns < 200) {
      turns++;
      const g = ["sora", "tabi", "gohan", "uwasa"][turns % 4];
      const kind = (Math.random() < acc) ? "hit" : "wrong";
      const j = S.sgJudgeTalk(s, kind, kind === "hit" ? g : null, recent);
      if (kind === "hit") { recent.push(g); if (recent.length > 3) recent.shift(); }
      s.trust = Math.max(0, Math.min(100, s.trust + j.dt));
      s.wary = Math.max(0, Math.min(100, s.wary + j.dw));
    }
    return { turns, win: s.trust >= 100, lose: s.wary >= 100 };
  };
  const run = (acc, n) => { let w = 0, tt = 0; for (let i = 0; i < n; i++) { const r = sim(acc); if (r.win) w++; tt += r.turns; }
    return { rate: w / n, turns: Math.round(tt / n) }; };
  const a9 = run(0.9, 300), a6 = run(0.6, 300), a3 = run(0.3, 300);
  console.log("上手い(9割当て) 成立率 " + (a9.rate * 100).toFixed(0) + "% / 平均" + a9.turns + "手");
  console.log("普通(6割当て)   成立率 " + (a6.rate * 100).toFixed(0) + "% / 平均" + a6.turns + "手");
  console.log("下手(3割当て)   成立率 " + (a3.rate * 100).toFixed(0) + "% / 平均" + a3.turns + "手");
  if (a9.rate < 0.9) bad.push("上手く当てても成立しにくい（理不尽）: " + (a9.rate * 100).toFixed(0) + "%");
  if (a3.rate > 0.5) bad.push("下手でも成立しすぎ（腕が意味を持たない）: " + (a3.rate * 100).toFixed(0) + "%");
  if (a9.turns > 22) bad.push("成立まで手数がかかりすぎ: " + a9.turns + "手");
  if (a9.turns < 6) bad.push("成立まで一瞬すぎる: " + a9.turns + "手");
}

// ⑥ ダンスの譜面：同じ方向が連続しないか／全体の尺／終盤で詰まるか
{
  const s = mkSess();
  const c = S.sgBuildChart(s);
  let same = 0;
  for (let i = 1; i < c.length; i++) if (c[i].dir === c[i - 1].dir) same++;
  if (same > 0) bad.push("譜面で同じ方向が連続している: " + same + "回");
  const total = c[c.length - 1].at;
  if (total < 6000 || total > 20000) bad.push("ダンスの尺が不自然: " + Math.round(total / 1000) + "秒");
  const early = c[1].at - c[0].at, late = c[c.length - 1].at - c[c.length - 2].at;
  if (!(late < early)) bad.push("終盤で加速していない: " + early + " → " + late);
  console.log("ダンス " + c.length + "歩 / 全体" + (total / 1000).toFixed(1) + "秒 / 拍 " + early + "ms→" + late + "ms");
}

// ⑦ ダンスの合否：上手ければ成立、雑なら失敗になるか
{
  const all = (v, n) => Array.from({ length: n }, () => v);
  if (!S.sgDanceResult(all(1.0, 12)).ok) bad.push("全部ピッタリでも成立しない");
  if (!S.sgDanceResult(all(0.5, 12)).ok === false) { /* good だけは通っても通らなくてもよい */ }
  if (S.sgDanceResult(all(0, 12)).ok) bad.push("全部ミスでも成立してしまう");
  const half = all(1.0, 6).concat(all(0, 6));
  console.log("ダンス合否 全ピッタリ=" + S.sgDanceResult(all(1.0, 12)).ok +
              " / 全おしい=" + S.sgDanceResult(all(0.5, 12)).ok +
              " / 半分ミス=" + S.sgDanceResult(half).ok +
              " / 全ミス=" + S.sgDanceResult(all(0, 12)).ok);
}

// ⑧ 話題データの作法
{
  const T = S.SCOUT_TOPICS || [];
  const genres = {};
  T.forEach(x => {
    genres[x.g] = (genres[x.g] || 0) + 1;
    const t = String(x.t || "");
    if (!t) bad.push("空の話題がある");
    if (t.length < 14 || t.length > 46) bad.push("話題の長さが範囲外(" + t.length + "字): " + t.slice(0, 18));
    if (/[Ѐ-ӿ가-힣]|[A-Za-z]{3,}/.test(t)) bad.push("非日本語が混じった話題: " + t.slice(0, 20));
    if (/[{}]/.test(t)) bad.push("差し込み枠は使えない: " + t.slice(0, 20));
    if (/オッズ|配当|賭け|儲/.test(t)) bad.push("賭けに触れている話題: " + t.slice(0, 20));
  });
  const need = ["sora", "tabi", "gohan", "uwasa"];
  need.forEach(g => { if ((genres[g] || 0) < 20) bad.push("話題が少ない: " + g + " " + (genres[g] || 0) + "本"); });
  // 重複
  const seen = {};
  T.forEach(x => { if (seen[x.t]) bad.push("同じ話題が二度ある: " + x.t.slice(0, 20)); seen[x.t] = 1; });
  console.log("話題 " + T.length + "本: " + need.map(g => g + " " + (genres[g] || 0)).join(" / "));
  // 4方向すべてにジャンルが割り当たっているか
  S.SG_DIRS.forEach(d => { if (!S.SCOUT_TOPIC_DIRS[d]) bad.push("方向にジャンルが無い: " + d); });
}

console.log("");
if (!bad.length) { console.log("✅ 問題なし"); process.exit(0); }
bad.forEach(b => console.log("  ❌ " + b));
console.log("");
console.log("計 " + bad.length + "件");
process.exit(1);
