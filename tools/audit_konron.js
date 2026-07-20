#!/usr/bin/env node
// =============================================================================
// tools/audit_konron.js — 崑崙マップ（スポット／エリア／食事導線）の結線検査
// =============================================================================
// ★なぜ要るか
//   スポットと料理は別ファイルの表で結ばれている（KONRON_SPOTS ／ KONRON_AREAS
//   ／ KM_SPOT_MEALS ／ MEALS）。片方の id を書き間違えても画面は普通に描画され、
//   「食べる欄が出ない」という形で静かに消える。目で追うには表が大きすぎる。
//
// 使い方: node tools/audit_konron.js
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");

const noop = () => {};
const fakeEl = () => new Proxy({}, { get: () => noop, set: () => true });
const sandbox = {
  console, window: {},
  document: { createElement: fakeEl, querySelector: () => null, querySelectorAll: () => [],
              getElementById: () => null, addEventListener: noop, body: fakeEl(), documentElement: fakeEl() },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: "node" }, location: { search: "", href: "" },
  Image: function () { return fakeEl(); },
  Audio: function () { return { play: () => Promise.resolve(), pause: noop, addEventListener: noop }; },
  requestAnimationFrame: noop, setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() }, matchMedia: () => ({ matches: false, addEventListener: noop })
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = ["js/utils.js", "js/meals.js", "js/ui_konron_map.js"];
const parts = ["var state = { player: {}, ui: {} };"];
FILES.forEach(f => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error("見つからない: " + f); process.exit(1); }
  parts.push("\n//# " + f + "\n" + fs.readFileSync(p, "utf8"));
});
parts.push(`
;({
  SPOTS: typeof KONRON_SPOTS !== "undefined" ? KONRON_SPOTS : undefined,
  AREAS: typeof KONRON_AREAS !== "undefined" ? KONRON_AREAS : undefined,
  CATS:  typeof KM_CATS !== "undefined" ? KM_CATS : undefined,
  SPOT_MEALS: typeof KM_SPOT_MEALS !== "undefined" ? KM_SPOT_MEALS : undefined,
  MEALS: typeof MEALS !== "undefined" ? MEALS : undefined
})`);

let S;
try { S = vm.runInContext(parts.join("\n"), sandbox, { filename: "konron-bundle.js" }); }
catch (e) { console.error("読み込みで失敗: " + e.message); process.exit(1); }

const bad = [];
const { SPOTS, AREAS, CATS, SPOT_MEALS, MEALS } = S;
["SPOTS", "AREAS", "CATS", "SPOT_MEALS", "MEALS"].forEach(k => { if (!S[k]) bad.push("読めない表: " + k); });
if (bad.length) { bad.forEach(b => console.log("  ❌ " + b)); process.exit(1); }

const mealIds = new Set(MEALS.map(m => m.id));
const spotIds = Object.keys(SPOTS);
const inArea = {};
AREAS.forEach(a => (a.spots || []).forEach(sid => { inArea[sid] = a.id; }));

// ① エリアが並べている id が、スポット表に無い
AREAS.forEach(a => (a.spots || []).forEach(sid => {
  if (!SPOTS[sid]) bad.push("エリア " + a.id + " が知らないスポットを並べている: " + sid);
}));
// ② スポット表にあるのに、どのエリアにも属していない＝画面に出てこない
spotIds.forEach(sid => { if (!inArea[sid]) bad.push("どのエリアにも入っていないスポット（画面に出ない）: " + sid); });
// ③ 食事表の id が、スポット表または料理表に無い
Object.keys(SPOT_MEALS).forEach(sid => {
  if (!SPOTS[sid]) bad.push("食事表が知らないスポットを指している: " + sid);
  (SPOT_MEALS[sid] || []).forEach(mid => {
    if (!mealIds.has(mid)) bad.push("食事表が知らない料理を指している: " + sid + " → " + mid);
  });
});
// ④ 食べ歩きスポットなのに料理が1つも結ばれていない＝「ここで食べる」が出ない
spotIds.forEach(sid => {
  if (SPOTS[sid].cat === "food" && !(SPOT_MEALS[sid] || []).length)
    bad.push("食べ歩きスポットなのに料理が結ばれていない: " + sid + "（" + SPOTS[sid].name + "）");
});
// ⑤ 分類が定義に無い
spotIds.forEach(sid => { if (!CATS[SPOTS[sid].cat]) bad.push("知らない分類: " + sid + " → " + SPOTS[sid].cat); });
// ⑥ レースの地域と、地図のレース地域スポットが food/ズレていないか
//    レース側（data_races.js の region）と地図側（spot.region）は別ファイルなので、
//    片方だけ増やすと静かにずれる。突き合わせておく。
const raceSrc = fs.readFileSync(path.join(ROOT, "js/data_races.js"), "utf8");
const raceRegions = new Set([...raceSrc.matchAll(/"([^"]*地域)"/g)].map(m => m[1]));
const spotRegions = new Set(spotIds.map(id => SPOTS[id].region).filter(Boolean));
spotRegions.forEach(r => { if (!raceRegions.has(r)) bad.push("レース側に無い地域を指すスポットがある: " + r); });
raceRegions.forEach(r => { if (!spotRegions.has(r)) bad.push("この地域のスポットが地図に無い: " + r); });

// ⑦ どのスポットからも食べられない料理（ごはん画面からのみ）
const reachable = new Set();
Object.values(SPOT_MEALS).forEach(a => a.forEach(m => reachable.add(m)));
const orphan = MEALS.filter(m => !reachable.has(m.id));

console.log("");
console.log("=== 崑崙マップ 結線検査 ===");
console.log("エリア " + AREAS.length + " ／ スポット " + spotIds.length +
            " ／ 料理 " + MEALS.length + " ／ 食事の結線 " + Object.keys(SPOT_MEALS).length + "スポット");
console.log("島のどこからも食べられない料理: " + orphan.length + "品" +
            (orphan.length ? "（" + orphan.slice(0, 8).map(m => m.name).join("・") + " ほか）" : ""));
console.log("");
if (!bad.length) { console.log("✅ 結線に問題なし"); process.exit(0); }
bad.forEach(b => console.log("  ❌ " + b));
console.log("");
console.log("計 " + bad.length + "件");
