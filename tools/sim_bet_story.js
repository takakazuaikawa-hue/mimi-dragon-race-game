#!/usr/bin/env node
// 結果画面の「理由への返事」（js/bet_story.js）を、画面なしで全パターン点検する（確認専用）。
// 本物のエンジンでレースを作り、全頭×単勝/複勝×4つの理由で文を作って、
//   ①作れなかった回数 ②事実との食い違い ③文の長さ ④どの言い回しが何割出るか ⑤実例 を出す。
// 使い方: node tools/sim_bet_story.js [本数]   （既定200。ゲーム本体には手を入れない・読むだけ）
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
const FILES = ["js/utils.js", "js/data_dragons.js", "js/data_courses.js", "js/data_weather.js", "js/data_ranks.js", "js/data_races.js", "js/data_dragons_ext.js", "js/race_engine.js", "js/odds_engine.js", "js/betting_engine.js", "js/broadcast_engine.js", "js/race_timeline_engine.js", "js/bet_story.js"];
const parts = ["var state = { player: { collection: {} } };"];
for (const f of FILES) parts.push("\n//# " + f + "\n" + fs.readFileSync(path.join(ROOT, f), "utf8"));
parts.push(";({ RACES, runRace, simulateMarket, buildRaceTimeline, resolveBet, betStoryOf, reasonReplyLine, betStoryTraceHtml, missReasonLine })");
const S = vm.runInContext(parts.join("\n"), sandbox, { filename: "bundle.js" });

const REASONS = ["kan", "data", "tell", "value"];
const races = S.RACES.filter(r => r && r.id);
let done = 0, cases = 0, nulls = 0, bad = [], rebuiltDiff = 0, maxLen = 0, maxLine = "", sumLen = 0, lines = 0, over60 = 0;
const shape = {}, samples = {}, missShape = {};
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

for (let n = 0; n < N; n++) {
  const race = races[n % races.length];
  let rr, or_, tl;
  try { rr = S.runRace(race); or_ = S.simulateMarket(race); tl = S.buildRaceTimeline(race, rr, or_, null); }
  catch (e) { if (n < 3) console.error("skip:", e.message); continue; }
  done++;
  const ids = rr.entries.map(e => e.dragon.id), size = ids.length;
  for (const id of ids) for (const type of ["win", "place"]) {
    const bet = { type, selections: [id], wager: 100 };
    const betResult = S.resolveBet(bet, rr, or_);
    const c = { race, raceResult: rr, oddsResult: or_, bet, betResult, timeline: tl };
    const s = S.betStoryOf(c);
    cases++;
    if (!s) { nulls++; continue; }
    // ②事実との食い違い：着順・当たり外れ・順位の範囲・区間と動きの対応。
    const rank = ids.indexOf(id) + 1, need = type === "win" ? 1 : 3;
    const chk = (ok, why) => { if (!ok) bad.push(`${race.id} ${id} ${type}: ${why} ${JSON.stringify({ a: s.a, b: s.b, f: s.f, key: s.key, move: s.move })}`); };
    chk(s.f === rank && s.rank === rank, "着順が違う");
    chk(s.hit === (rank <= need) && s.hit === !!betResult.hit, "当たり外れが違う");
    chk(s.a >= 1 && s.a <= size && s.b >= 1 && s.b <= size, "順位が範囲外");
    if (s.hit) { if (s.key === 2) chk(s.b > s.f, "終盤で上げていない"); if (s.key === 1) chk(s.a > s.b, "中盤で上げていない"); if (s.key === 0) chk(s.a <= s.b && s.b <= s.f, "上げた区間があるのに序盤を名指し"); }
    else {
      if (s.key === 2) chk(s.f > s.b, "終盤で落としていない");
      if (s.key === 1) chk(s.b > s.a, "中盤で落としていない");
      if (s.key === 0) chk(s.a > need && s.b > need && s.b - s.a < 2 && s.f - s.b < 2, "圏内から落ちた／大きく落とした区間があるのに序盤を名指し");
      if (s.key !== 0 && s.a > need && s.b > need) chk((s.key === 2 ? s.f - s.b : s.b - s.a) >= 2, "圏外で1つ下がっただけの区間を敗因にしている");
    }
    chk(!/先頭から先頭|(\d)番手から\1番手|undefined|NaN|null|〈〉/.test(s.move + s.sec + s.shine), "文が壊れている");
    // タイムラインを渡さず作り直しても同じ道のりになるか（画面と同じものを読めているか）。
    //   作り直しは重いので、1戦につき1組だけ確かめる。
    if (id === ids[0] && type === "win") {
      const s2 = S.betStoryOf({ race, raceResult: rr, oddsResult: or_, bet, betResult, timeline: null });
      if (!s2 || s2.a !== s.a || s2.b !== s.b || s2.move !== s.move) rebuiltDiff++;
    }
    bump(shape, (s.hit ? "当たり" : "外れ") + "・" + ["序盤", "中盤", "終盤"][s.key]);
    for (const rk of REASONS) {
      const line = S.reasonReplyLine(c, rk);
      if (!line) { nulls++; continue; }
      chk(!/undefined|NaN|null|。。|、。|の〈〉/.test(line), "返事が壊れている: " + line);
      lines++; sumLen += line.length; if (line.length > 60) over60++;
      if (line.length > maxLen) { maxLen = line.length; maxLine = line; }
      const k = rk + (s.hit ? "・当たり" : "・外れ");
      (samples[k] = samples[k] || []);
      if (samples[k].length < 3 && !samples[k].some(x => x.key === s.key)) samples[k].push({ key: s.key, line, trace: `序盤${s.a} ▸ 中盤${s.b} ▸ ${s.f}着`, miss: s.hit ? "" : S.missReasonLine(c) });
    }
    if (!s.hit) bump(missShape, S.missReasonLine(c).replace(/^.*?着。/, "").replace(/\d+/g, "N"));
    if (!s.hit && !S.missReasonLine(c)) bad.push(`${race.id} ${id} ${type}: 外れなのに「あとどれだけ」の行が空`);
    if (!S.betStoryTraceHtml(c)) bad.push(`${race.id} ${id} ${type}: 道のりの帯が空`);
  }
}

console.log(`レース数=${done}  賭け方の組=${cases}  返事の文=${lines}本`);
console.log(`①作れなかった回数=${nulls}  ②事実との食い違い=${bad.length}  タイムラインを作り直したときの差=${rebuiltDiff}`);
bad.slice(0, 8).forEach(x => console.log("   ✗ " + x));
console.log(`③文の長さ：平均${(sumLen / Math.max(1, lines)).toFixed(1)}字・最長${maxLen}字・60字超=${over60}本（${(over60 / Math.max(1, lines) * 100).toFixed(1)}%）`);
console.log(`   最長の文：${maxLine}`);
console.log("④名指す区間の割合：" + Object.keys(shape).sort().map(k => `${k} ${(shape[k] / cases * 100).toFixed(0)}%`).join(" / "));
console.log("   外れの「あとどれだけ」：" + Object.keys(missShape).map(k => `「${k}」${missShape[k]}`).join(" / "));
console.log("⑤実例");
for (const k of Object.keys(samples).sort()) for (const x of samples[k]) console.log(`  [${k}] ${x.line}\n      ${x.trace}${x.miss ? "　／　" + x.miss : ""}`);
process.exit(bad.length || nulls || rebuiltDiff ? 1 : 0);
