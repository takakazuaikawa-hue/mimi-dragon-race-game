#!/usr/bin/env node
// =============================================================================
// tools/audit_kiko_serial.js — 紀行の連載「島ぐらし」（js/kiko_serial.js）の結線検査
// =============================================================================
// ★なぜ要るか
//   連載は「取材先＝島のスポット」を id で指している。スポットを改名・削除しても画面は
//   普通に描画され、写真が島の全景に落ちるだけ＝静かに壊れる。回数が18あるので目では追えない。
//   ここでは「回 → スポット → 写真ファイル」が実在で最後までつながっているかだけを見る。
//
// 見ること：
//   ① 取材先 spot が KONRON_SPOTS にあり、どこかのエリアに属している
//   ② 取材先・寄り道・挿し絵の写真ファイルが実在する
//   ③ 寄り道 detour の id が KONRON_SPOTS にある
//   ④ あしあと地図の位置 at が 0〜100% に収まっている
//   ⑤ 本文5段・リード・引用・予告・読者の声がそろっている／読者の声の出どころが台帳にある
//   ⑥ direct（島へ出る前に書ける回）は、最初から行ける場所（tier0）だけ
//   あわせて、取材先の一覧（解放段つき）とエリア別の回数を出す＝順番と偏りを目で確かめる用
//
// 使い方: node tools/audit_kiko_serial.js   （問題があれば exit 1）
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
  requestAnimationFrame: noop, setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() }, matchMedia: () => ({ matches: false, addEventListener: noop })
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = ["js/utils.js", "js/data_races.js", "js/meals.js", "js/ui_konron_map.js", "js/kiko_serial.js"];
const parts = ["var state = { player: {}, ui: {}, lifeTree: {} };"];
FILES.forEach(f => parts.push("\n//# " + f + "\n" + fs.readFileSync(path.join(ROOT, f), "utf8")));
parts.push("\n;globalThis.__out = { SPOTS: KONRON_SPOTS, AREAS: KONRON_AREAS, SERIAL: KIKO_SERIAL, VOICES: KS_VOICES, RACES: RACES };");
vm.runInContext(parts.join("\n"), sandbox, { filename: "audit_kiko_serial.bundle.js" });
const { SPOTS, AREAS, SERIAL, VOICES, RACES } = sandbox.__out;

let ng = 0;
const bad = (m) => { ng++; console.log("  ✗ " + m); };
const exists = (rel) => fs.existsSync(path.join(ROOT, rel.split("?")[0]));
const areaOf = (id) => AREAS.find(a => a.spots.indexOf(id) >= 0);

console.log("\n=== 紀行・連載「島ぐらし」結線検査 ===");
console.log("全 " + SERIAL.length + " 回");
const seenId = {};
SERIAL.forEach((ep, i) => {
  const tag = "第" + (i + 1) + "回(" + ep.id + ")";
  if (seenId[ep.id]) bad(tag + " id が重複"); seenId[ep.id] = 1;
  const s = SPOTS[ep.spot];
  if (!s) { bad(tag + " 取材先 " + ep.spot + " が KONRON_SPOTS に無い"); return; }
  if (!areaOf(ep.spot)) bad(tag + " 取材先 " + ep.spot + " がどのエリアにも属していない");
  if (!s.photo) bad(tag + " 取材先 " + ep.spot + " に写真が無い（表紙が島の全景に落ちる）");
  else if (!exists(s.photo)) bad(tag + " 取材先の写真が実在しない: " + s.photo);
  if (ep.direct && (s.tier || 0) !== 0) bad(tag + " direct なのに取材先が tier" + s.tier + "（島へ出る前に行けない場所）");
  if (ep.sub) { if (!ep.sub.src || !exists(ep.sub.src)) bad(tag + " 挿し絵が実在しない: " + (ep.sub && ep.sub.src)); if (!ep.sub.cap) bad(tag + " 挿し絵の説明が無い"); }
  (ep.detour || []).forEach(d => {
    const ds = SPOTS[d];
    if (!ds) bad(tag + " 寄り道 " + d + " が KONRON_SPOTS に無い");
    else if (ds.photo && !exists(ds.photo)) bad(tag + " 寄り道の写真が実在しない: " + ds.photo);
  });
  if (ep.region) {
    // コースの回：あしあと地図には載せない（at 無し）。地域名はレース側・スポット側の表記と一致していること
    if (ep.at) bad(tag + " コースの回なのに at を持っている（あしあと地図に二重に出る）");
    if (!RACES.some(r => r.region === ep.region)) bad(tag + " 地域 " + ep.region + " のレースが RACES に無い");
    if (s.region !== ep.region) bad(tag + " 取材先 " + ep.spot + " の region（" + s.region + "）が回の region と違う");
  } else if (!Array.isArray(ep.at) || ep.at.length !== 2 || ep.at.some(v => !(v >= 0 && v <= 100))) bad(tag + " あしあとの位置 at が不正");
  if (!ep.title) bad(tag + " 題が無い");
  if (!ep.memo) bad(tag + " 予告（memo）が無い");
  if (!ep.lead) bad(tag + " リードが無い");
  if (!ep.quote) bad(tag + " 引用が無い");
  if (!Array.isArray(ep.paras) || ep.paras.length !== 5) bad(tag + " 本文は5段（いま " + ((ep.paras || []).length) + "）");
  if (typeof ep.need !== "function") bad(tag + " need() が無い");
  else { let r; try { r = ep.need(); } catch (e) { r = null; } if (!Array.isArray(r)) bad(tag + " need() が配列を返さない"); }
  if (!Array.isArray(ep.cmts) || ep.cmts.length < 2) bad(tag + " 読者の声が2件に満たない");
  (ep.cmts || []).forEach(c => { if (!VOICES[c[0]]) bad(tag + " 読者の声の出どころ " + c[0] + " が KS_VOICES に無い"); if (!c[1]) bad(tag + " 読者の声が空"); });
});

// 取材先の一覧（目で追えるように）
console.log(SERIAL.map((ep, i) => "  " + String(i + 1).padStart(2) + " " + (SPOTS[ep.spot] ? SPOTS[ep.spot].name : "？") + "（" + ((areaOf(ep.spot) || {}).name || "？") + "・tier" + ((SPOTS[ep.spot] || {}).tier || 0) + (ep.direct ? "・その場で書ける" : "") + "）").join("\n"));

// エリアごとの取材回数＝偏りの目安（市街に寄りすぎていないか）
const per = {};
SERIAL.forEach(ep => { const a = areaOf(ep.spot); if (a) per[a.name] = (per[a.name] || 0) + 1; });
console.log("エリア別: " + Object.keys(per).map(k => k + " " + per[k]).join(" ／ "));
// 8つの開催地域が、ぜんぶ連載に入っているか（レースの紀行なのに走らない地域が出ないように）
const allRegions = Array.from(new Set(RACES.map(r => r.region)));
const covered = SERIAL.filter(ep => ep.region).map(ep => ep.region);
allRegions.forEach(rg => { if (covered.indexOf(rg) < 0) bad("開催地域 " + rg + " の回が無い"); });
console.log("コースの回: " + covered.length + " / 開催地域 " + allRegions.length);
const unvisited = AREAS.filter(a => !per[a.name]).map(a => a.name);
if (unvisited.length) console.log("連載がまだ訪ねていないエリア: " + unvisited.join("・"));

if (ng) { console.log("\n❌ " + ng + " 件の問題"); process.exit(1); }
console.log("\n✅ 結線に問題なし");
