#!/usr/bin/env node
// 実況の「先頭を言い切る行」が、画面に出る瞬間にまだ本当かを、画面なしで測る（確認専用）。
// 台本（race_broadcast.js）を本物のエンジンで作り、race_canvas.js の滞留キューを同じ規則で再現する。
// 使い方: node tools/sim_telop_stale.js [本数]   （既定200。ゲーム本体には手を入れない・読むだけ）
// ★race_canvas.js の滞留の規則（TELOP_DWELL_MIN/MAX・500字/分・キュー上限・核タグ）を変えたら、ここの写しも合わせること。
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.resolve(__dirname, ".."), N = parseInt(process.argv[2], 10) || 200;
const noop = () => {};
const fakeEl = () => new Proxy({}, { get: (t, k) => (k === "style" || k === "dataset" || k === "classList") ? fakeEl() : (typeof k === "string" && k in t ? t[k] : noop), set: () => true });
const sandbox = { console, window: {}, document: { createElement: fakeEl, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: noop, body: fakeEl(), documentElement: fakeEl() },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, navigator: { userAgent: "node", maxTouchPoints: 0 }, location: { search: "", href: "" },
  Image: function () { return fakeEl(); }, Audio: function () { return { play: () => Promise.resolve(), pause: noop, addEventListener: noop }; },
  requestAnimationFrame: noop, cancelAnimationFrame: noop, setTimeout, clearTimeout, setInterval, clearInterval, performance: { now: () => Date.now() }, matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }) };
sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
const FILES = ["js/utils.js", "js/data_dragons.js", "js/data_courses.js", "js/data_weather.js", "js/data_ranks.js", "js/data_races.js", "js/data_dragons_ext.js", "js/race_engine.js", "js/odds_engine.js", "js/broadcast_engine.js", "js/commentary_data.js", "js/race_timeline_engine.js", "js/data_commentators.js", "js/race_broadcast.js", "js/data_broadcast_lines.js", "js/data_broadcast_rare.js", "js/data_broadcast_chatter.js"];
const parts = ["var state = { player: { collection: {}, lastCommentator: null } };"];
for (const f of FILES) parts.push("\n//# " + f + "\n" + fs.readFileSync(path.join(ROOT, f), "utf8"));
parts.push(";({ RACES, runRace, simulateMarket, buildRaceTimeline, buildBroadcast, RACE_COMMENTATORS, commentaryName })");
const S = vm.runInContext(parts.join("\n"), sandbox, { filename: "bundle.js" });

const CORE = { start: 1, countdown: 1, signature: 1, cutin: 1, lead: 1, final: 1, goal: 1, course: 1 };
function simulate(tl, script, decideTau, dropStale) {
  const sec = tl.durationSecHint, FPS = 60, dt = 1 / FPS;
  const items = script.filter(x => x.tag !== "entry" && x.tag !== "countdown" && x.tag !== "goal").map(x => Object.assign({ fired: false }, x));
  let lastAt = -1e9, lastLen = 20, q = [], getaway = 0;
  const shown = [], stale = []; let drops = 0;
  const dwell = () => Math.max(1500, Math.min(2900, lastLen / 500 * 60 * 1000));
  const isCore = tag => CORE[tag] || (tag === "getaway" && getaway < 1);
  const top = tau => tl.standingsAt(tau)[0];
  const third = tau => { const P = tl.leaderProgressAt(Math.min(1, tau)); return P < 1 / 3 ? 0 : P < 2 / 3 ? 1 : 2; };   // 画面の区間表示と同じ区切り
  const secWrong = (it, tau) => it.sec != null && third(tau) !== it.sec;
  const isStale = (it, tau) => dropStale && ((it.lead != null && top(tau) !== it.lead) || secWrong(it, tau));
  const show = (it, now, tau) => { if (it.tag === "getaway") getaway++; lastAt = now; lastLen = it.line.length; shown.push({ t: now / 1000, tau, it, wrong: it.lead != null && top(tau) !== it.lead, wrongSec: secWrong(it, tau) }); };
  const endT = decideTau * sec;
  for (let t = 0; t <= endT; t += dt) {
    const tau = t / sec, now = t * 1000;
    for (const it of items) {
      if (it.fired || tau < it.tau) continue;
      it.fired = true;
      if (it.tag === "start") { drops += q.length; q = []; show(it, now, tau); continue; }
      if (isStale(it, tau)) { stale.push({ tau, it }); continue; }
      if (now - lastAt >= dwell()) { show(it, now, tau); continue; }
      q.push(it);
      for (;;) { let i = q.findIndex(x => !isCore(x.tag)); const cap = i < 0 ? 4 : 2; if (q.length <= cap) break; if (i < 0) i = 0; q.splice(i, 1); drops++; }
    }
    if (q.length && now - lastAt >= dwell()) {
      while (q.length) { const it = q.shift(); if (isStale(it, tau)) { stale.push({ tau, it }); continue; } show(it, now, tau); break; }
    }
  }
  let maxGap = 0, gaps4 = 0;
  for (let i = 1; i < shown.length; i++) { const g = shown[i].t - shown[i - 1].t; if (g > maxGap) maxGap = g; if (g > 4) gaps4++; }
  const tailGap = endT - (shown.length ? shown[shown.length - 1].t : 0);
  if (tailGap > maxGap) maxGap = tailGap;
  const last8 = shown.filter(x => x.t >= endT - 8).length;
  return { shown, stale, drops, maxGap, gaps4, last8, wrong: shown.filter(x => x.wrong), wrongSec: shown.filter(x => x.wrongSec), secShown: shown.filter(x => x.it.sec != null), secStale: stale.filter(x => x.it.sec != null) };
}

const races = S.RACES.filter(r => r && r.id);
const agg = { 0: { lines: 0, claims: 0, wrong: 0, racesWrong: 0, stale: 0, drops: 0, maxGap: 0, sumMaxGap: 0, gaps4: 0, last8: 0, wrongByTag: {}, lagWrong: [] },
              1: { lines: 0, claims: 0, wrong: 0, racesWrong: 0, stale: 0, drops: 0, maxGap: 0, sumMaxGap: 0, gaps4: 0, last8: 0, wrongByTag: {}, lagWrong: [] } };
let done = 0, examples = [];
for (let n = 0; n < N; n++) {
  const race = races[n % races.length];
  let tl, bc;
  try {
    const rr = S.runRace(race), or_ = S.simulateMarket(race);
    tl = S.buildRaceTimeline(race, rr, or_, null);
    const cm = S.RACE_COMMENTATORS[n % S.RACE_COMMENTATORS.length];
    bc = S.buildBroadcast(tl, { race, oddsResult: or_, raceResult: rr }, { commentator: cm, nameOf: id => S.commentaryName(id) });
  } catch (e) { if (n < 3) console.error("skip:", e.message); continue; }
  if (!bc || !bc.script) continue;
  done++;
  const D = (bc.analysis && bc.analysis.decideTau) || 1;
  [0, 1].forEach(mode => {
    const r = simulate(tl, bc.script, D, mode === 1), a = agg[mode];
    a.lines += r.shown.length; a.claims += r.shown.filter(x => x.it.lead != null).length; a.wrong += r.wrong.length; if (r.wrong.length) a.racesWrong++;
    a.stale += r.stale.length; a.drops += r.drops; a.sumMaxGap += r.maxGap; if (r.maxGap > a.maxGap) a.maxGap = r.maxGap; a.gaps4 += r.gaps4; a.last8 += r.last8;
    a.sec = a.sec || { shown: [0, 0, 0], wrong: [0, 0, 0], stale: [0, 0, 0] };
    r.secShown.forEach(x => { a.sec.shown[x.it.sec]++; }); r.wrongSec.forEach(x => { a.sec.wrong[x.it.sec]++; }); r.secStale.forEach(x => { a.sec.stale[x.it.sec]++; });
    if (mode === 0 && r.wrongSec.length && (a.secEx = a.secEx || []).length < 4) { const x = r.wrongSec[0]; a.secEx.push(`${race.id} [区間${x.it.sec}の話]「${x.it.line}」が出たのは τ${x.tau.toFixed(3)}（台本τ${x.it.tau.toFixed(3)}）`); }
    r.wrong.forEach(x => { a.wrongByTag[x.it.tag] = (a.wrongByTag[x.it.tag] || 0) + 1; a.lagWrong.push((x.tau - x.it.tau) * tl.durationSecHint); });
    if (mode === 0 && r.wrong.length && examples.length < 6) { const x = r.wrong[0]; examples.push(`${race.id} τ${x.tau.toFixed(3)}（台本の位置τ${x.it.tau.toFixed(3)}・${((x.tau - x.it.tau) * tl.durationSecHint).toFixed(1)}秒遅れ） [${x.it.tag}]「${x.it.line}」 ←そのとき本当の先頭=${S.commentaryName(tl.standingsAt(x.tau)[0])}`); }
  });
}
const pr = (name, a) => {
  const lag = a.lagWrong.slice().sort((x, y) => x - y);
  console.log(`【${name}】 出た行=${(a.lines / done).toFixed(1)}本/戦  先頭を言い切った行=${(a.claims / done).toFixed(1)}本/戦`);
  console.log(`   食い違ったまま出た行=${a.wrong}本（${(a.wrong / done).toFixed(2)}本/戦・1本でも出たレース=${a.racesWrong}/${done}＝${(a.racesWrong / done * 100).toFixed(0)}%） タグ別=${JSON.stringify(a.wrongByTag)}`);
  console.log(`   古くなって出さなかった行=${(a.stale / done).toFixed(2)}本/戦  通常の間引き=${(a.drops / done).toFixed(2)}本/戦`);
  console.log(`   最長の無言：平均${(a.sumMaxGap / done).toFixed(2)}秒・最悪${a.maxGap.toFixed(2)}秒  4秒超の無言=${(a.gaps4 / done).toFixed(2)}回/戦  決着前8秒に出た行=${(a.last8 / done).toFixed(2)}本/戦`);
  if (a.sec) console.log(`   区間を語る行（序盤/中盤/終盤）：出た=${a.sec.shown.map(v => (v / done).toFixed(2)).join("/")}本/戦  うち画面の区間表示と違う=${a.sec.wrong.map(v => (v / done).toFixed(2)).join("/")}  古くて出さなかった=${a.sec.stale.map(v => (v / done).toFixed(2)).join("/")}`);
  (a.secEx || []).forEach(e => console.log("     例: " + e));
  if (lag.length) console.log(`   食い違った行の遅れ（台本の位置から）：中央${lag[Math.floor(lag.length / 2)].toFixed(1)}秒・最大${lag[lag.length - 1].toFixed(1)}秒`);
};
console.log(`レース数=${done}`);
pr("直す前（そのまま出す）", agg[0]);
pr("直した後（古い行は出さない）", agg[1]);
console.log("例（直す前に出ていた食い違い）:"); examples.forEach(e => console.log("  " + e));
