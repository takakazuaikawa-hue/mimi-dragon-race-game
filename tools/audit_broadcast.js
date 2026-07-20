#!/usr/bin/env node
// =============================================================================
// tools/audit_broadcast.js — 実況エンジンをNodeだけで検証する
// =============================================================================
// ★なぜこれが要るか
//   エンジン化の目的は「実機を触らずデータで確かめられること」。
//   ブラウザを立ち上げてクリックして確認していたのでは、その目的を果たせない。
//   ここは vanilla JS のスクリプト群（module化されていない）を、必要な分だけ
//   読み込んで実行する。ブラウザ固有のもの（document / localStorage / Audio）は
//   薄いスタブで埋める。ゲーム本体には一切手を入れない。
//
// 使い方:
//   node tools/audit_broadcast.js          … 60レースを検査
//   node tools/audit_broadcast.js 200      … 本数を指定
//   node tools/audit_broadcast.js 60 -v    … 違反の中身も出す
//
// EXTENSION POINT: 規則を足すときは RULES に1つ関数を足すだけ。
//   引数は { race, script, A, sec, call, color } の1つのオブジェクト。
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const N = parseInt(process.argv[2], 10) || 60;
const VERBOSE = process.argv.includes("-v");

// ── ブラウザのふりをする最小限の器 ──────────────────────────────
// ★本物のDOMは要らない。エンジンは計算しかしないので、
//   「呼ばれても落ちない」ことだけ保証すればよい。
const noop = () => {};
const fakeEl = () => new Proxy({}, {
  get: (t, k) => (k === "style" || k === "dataset" || k === "classList")
    ? fakeEl() : (typeof k === "string" && k in t ? t[k] : noop),
  set: () => true
});
const sandbox = {
  console,
  window: {},
  document: {
    createElement: fakeEl, querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, addEventListener: noop, body: fakeEl(),
    documentElement: fakeEl()
  },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: "node", maxTouchPoints: 0 },
  location: { search: "", href: "" },
  Image: function () { return fakeEl(); },
  Audio: function () { return { play: () => Promise.resolve(), pause: noop, addEventListener: noop }; },
  requestAnimationFrame: noop, cancelAnimationFrame: noop,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop })
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// ── エンジンに要るファイルだけを読む ────────────────────────────
// ★index.html の順序どおり。UI・音・演出は読まない（要らないし、重い）。
const FILES = [
  "js/utils.js",
  "js/data_dragons.js", "js/data_courses.js", "js/data_weather.js",
  "js/data_ranks.js", "js/data_races.js", "js/data_dragons_ext.js",
  "js/race_engine.js", "js/odds_engine.js",
  "js/broadcast_engine.js",   // phaseScore（タイムラインが使う）
  "js/commentary_data.js",    // commentaryName
  "js/race_timeline_engine.js",
  "js/data_commentators.js",
  "js/race_broadcast.js", "js/data_broadcast_lines.js"
];
// ★全ファイルを「1つのスクリプト」として評価する。
//   ファイルごとに実行すると、トップレベルの const / let が
//   グローバルに乗らず互いに見えない（window.state と同じ罠）。
//   本番の <script> 群と同じく、同一スコープに並べるのが正しい再現。
const loaded = [];
const parts = [
  // state はゲーム本体のものを使わず最小限を自前で用意する
  // （エンジンが読むのは図鑑の解禁状況くらい。無ければ安全側に倒れる作り）
  "var state = { player: { collection: {}, lastCommentator: null } };"
];
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error("見つからない: " + f); continue; }
  parts.push("\n//# " + f + "\n" + fs.readFileSync(p, "utf8"));
  loaded.push(f);
}
// 末尾で必要な記号だけを取り出す（同一スコープなので const も見える）
parts.push(`
;({
  RACES: typeof RACES !== "undefined" ? RACES : undefined,
  runRace: typeof runRace !== "undefined" ? runRace : undefined,
  simulateMarket: typeof simulateMarket !== "undefined" ? simulateMarket : undefined,
  buildRaceTimeline: typeof buildRaceTimeline !== "undefined" ? buildRaceTimeline : undefined,
  buildBroadcast: typeof buildBroadcast !== "undefined" ? buildBroadcast : undefined,
  BC_LINES: typeof BC_LINES !== "undefined" ? BC_LINES : undefined,
  RACE_COMMENTATORS: typeof RACE_COMMENTATORS !== "undefined" ? RACE_COMMENTATORS : undefined,
  commentaryName: typeof commentaryName !== "undefined" ? commentaryName : undefined
})`);

let S;
try {
  S = vm.runInContext(parts.join("\n"), sandbox, { filename: "audit-bundle.js" });
} catch (e) {
  console.error("読み込みで失敗: " + e.message);
  process.exit(1);
}
const need = ["RACES", "runRace", "simulateMarket", "buildRaceTimeline",
              "buildBroadcast", "BC_LINES", "RACE_COMMENTATORS", "commentaryName"];
const missing = need.filter(k => typeof S[k] === "undefined");
if (missing.length) {
  console.error("必要なものが読めていない: " + missing.join(", "));
  process.exit(1);
}

// ── 規則（これまでユーザーからいただいた指摘を全部ここに置く）────
// ★1つの規則＝1つの関数。増やすときはここに足すだけ。
const RULES = [
  { key: "非日本語の混入", fn: c => {
      const m = c.text.match(/[Ѐ-ӿ가-힣]|[A-Za-z]{3,}/g);
      return m ? [...new Set(m)].join(",") : null; } },
  { key: "台詞の重複", fn: c => {
      const seen = {}, d = [];
      c.script.forEach(x => { const k = x.side + "|" + x.line;
        if (seen[k]) d.push(seen[k] + "→" + x.tag + " " + x.line.slice(0, 20));
        seen[k] = x.tag; });
      return d.length ? d[0] : null; } },
  { key: "序盤の並走描写", fn: c => {
      const t = c.script.filter(x => x.tau < 0.30).map(x => x.line).join("");
      return /並ん|雁行|譲らない/.test(t) ? "序盤に並走を語っている" : null; } },
  { key: "中盤の展開説明なし", fn: c =>
      c.script.some(x => x.tag === "shape" && x.tau >= 0.30 && x.tau <= 0.62)
        ? null : "上位が誰か示されないまま" },
  { key: "下位の入れ替わり", fn: c => {
      const low = c.call.filter(x => /[5-8]番手/.test(x.line) &&
        x.tag !== "cutin" && x.tag !== "goal");
      return low.length ? low[0].line : null; } },
  { key: "着差で締めている", fn: c => {
      const g = c.script.filter(x => x.tag === "goal" && x.side === "call");
      if (!g.length) return null;
      const last = g[g.length - 1].line;
      return /^(鼻先|首差|半身|一体|大差)/.test(last) && !/[！—]$/.test(last) ? last : null; } },
  { key: "決め台詞が遅い", fn: c => {
      const g = c.script.filter(x => x.tag === "goal");
      if (!g.length) return null;
      const late = (Math.max(...g.map(x => x.tau)) - c.A.decideTau) * c.sec;
      return late > 3.0 ? late.toFixed(1) + "秒遅れ" : null; } },
  { key: "無言が長い", fn: c => {
      const ts = c.script.map(x => x.tau).filter(t => t <= c.A.decideTau).sort((a, b) => a - b);
      let mx = 0; for (let i = 1; i < ts.length; i++) mx = Math.max(mx, ts[i] - ts[i - 1]);
      return mx * c.sec > 3.0 ? (mx * c.sec).toFixed(1) + "秒" : null; } },
  { key: "解説が相槌になっている", fn: c =>
      c.color.length > c.call.length * 0.75
        ? "実況" + c.call.length + "／解説" + c.color.length : null },
  { key: "決着で解説が自分語り", fn: c => {
      const gc = c.script.filter(x => x.tag === "goal" && x.side === "color");
      const bad = gc.filter(x => /見立て|読み|予想|わたしの|あたくしの/.test(x.line));
      return bad.length ? bad[0].line : null; } },
  { key: "空の行", fn: c => c.script.some(x => !x.line || !x.line.trim()) ? "空文字" : null },
  { key: "差し込み枠の未展開", fn: c => {
      const m = c.text.match(/\{\w+\}/g);
      return m ? [...new Set(m)].join(",") : null; } },
  { key: "賭け竜への言及", fn: c => {
      // ★エンジンに賭け情報を渡していないので構造上あり得ないが、
      //   将来うっかり戻したときに気づけるよう検査は残す。
      // ★「{n}、あなたは今日の主役よ」は竜への呼びかけ。違反ではない。
      //   プレイヤーの賭けを指す語だけを拾う。
      const m = c.text.match(/あなたの(一票|予想|賭け|竜)|賭け(た|金|竜)|的中|払戻/);
      return m ? m[0] : null; } }
];

// ── 実行 ────────────────────────────────────────────────────────
const fails = [];
const stats = [];
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const race = S.RACES[i % S.RACES.length];
  if (!race) break;
  let bc, tl, cmt;
  try {
    const rr = S.runRace(race);
    const or_ = S.simulateMarket(race);
    tl = S.buildRaceTimeline(race, rr, or_, null);
    cmt = S.RACE_COMMENTATORS[i % S.RACE_COMMENTATORS.length];
    bc = S.buildBroadcast(tl, { race, oddsResult: or_, raceResult: rr },
      { commentator: cmt, nameOf: id => S.commentaryName(id) });
  } catch (e) {
    fails.push({ race: race.id, rule: "組み立てで例外", detail: e.message });
    continue;
  }
  const ctx = {
    race, script: bc.script, A: bc.analysis,
    sec: tl.durationSecHint,
    call: bc.script.filter(x => x.side === "call"),
    color: bc.script.filter(x => x.side === "color"),
    text: bc.script.map(x => x.line).join("\n")
  };
  RULES.forEach(r => {
    let d = null;
    try { d = r.fn(ctx); } catch (e) { d = "検査で例外: " + e.message; }
    if (d) fails.push({ race: race.id, caster: cmt && cmt.name, rule: r.key, detail: d });
  });
  stats.push({ 行: ctx.script.length, 実況: ctx.call.length, 解説: ctx.color.length,
               決着: bc.analysis.drama.headline });
}

const ms = Date.now() - t0;
const byRule = {};
fails.forEach(f => { (byRule[f.rule] = byRule[f.rule] || []).push(f); });
const avg = k => stats.length
  ? +(stats.reduce((a, b) => a + b[k], 0) / stats.length).toFixed(1) : 0;

console.log("");
console.log("=== 実況エンジン 自己監査 ===");
console.log("読み込んだファイル: " + loaded.length + "本");
console.log("検査したレース    : " + stats.length + "本（" + ms + "ms）");
console.log("平均              : 行" + avg("行") + " ／ 実況" + avg("実況") + " ／ 解説" + avg("解説"));
const heads = stats.reduce((m, x) => { m[x.決着] = (m[x.決着] || 0) + 1; return m; }, {});
console.log("決着の内訳        : " + Object.keys(heads).map(k => k + "×" + heads[k]).join(" "));
console.log("");
if (!fails.length) {
  console.log("✅ 違反なし（" + RULES.length + "規則）");
} else {
  console.log("違反 " + fails.length + "件 / " + RULES.length + "規則");
  Object.keys(byRule).forEach(k => {
    console.log("  ❌ " + k + " ×" + byRule[k].length + "  例: " + byRule[k][0].detail);
    if (VERBOSE) byRule[k].slice(0, 5).forEach(f =>
      console.log("       " + f.race + " / " + (f.caster || "-") + " : " + f.detail));
  });
}
console.log("");
process.exit(fails.length ? 1 : 0);
