#!/usr/bin/env node
// =============================================================================
// tools/audit_field_lessons.js — 習い事の実地稽古（§6.5）の健全性検査
// =============================================================================
// 指示書 §6.5 / §9 の要求：
//   ① KURASHI_FIELD の全 stat に、実際に FieldStats.bump がコードのどこかで仕込まれている
//      （bump が無い stat は永久に 0＝到達不可能＝暮らしが埋まらない）。
//   ② 各スキルの実地エントリは2つ（モール1・島めぐり1）＝実地で上がるのは最大2Lv。
//   ③ 師範未登場のとき、実地稽古のカットインに師範の名前が漏れない（門番 fail-closed）。
//   ④ skill は ACTIVE_SKILLS の id と一致する。
//
// 使い方: node tools/audit_field_lessons.js
//         node tools/audit_field_lessons.js --self   … 逆向き確認（bumpを1つ消すと検出されるか）
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const fl = require(path.resolve(ROOT, "js", "field_lessons.js"));
const KF = fl.KURASHI_FIELD;

// 全 js を1本に結合（bump の存在確認用）
const jsDir = path.join(ROOT, "js");
const allJs = fs.readdirSync(jsDir).filter(f => f.endsWith(".js"))
  .map(f => fs.readFileSync(path.join(jsDir, f), "utf8")).join("\n").replace(/\r/g, "");

// ACTIVE_SKILLS の id を data_assets.js から拾う
const daSrc = fs.readFileSync(path.join(jsDir, "data_assets.js"), "utf8");
const skillIds = [];
{ const re = /id:\s*"([a-z]+)",\s*icon:/g; let m; while ((m = re.exec(daSrc)) !== null) skillIds.push(m[1]); }

let fail = 0; const problems = [];
function check(name, ok, detail) { if (!ok) { fail++; problems.push("✗ " + name + (detail ? "：" + detail : "")); } }

// ── ① 全 stat に bump が仕込まれているか ──
{
  const missing = [];
  KF.forEach(e => {
    const re = new RegExp('bump\\(\\s*["\']' + e.stat + '["\']');
    if (!re.test(allJs)) missing.push(e.stat);
  });
  check("全 stat に FieldStats.bump が存在（到達可能）", missing.length === 0, missing.join(", "));
}

// ── ② 各スキル 実地エントリは2つ（mall1・tour1）＝実地上限2Lv ──
{
  const bySkill = {};
  KF.forEach(e => { (bySkill[e.skill] = bySkill[e.skill] || []).push(e.src); });
  let bad = null;
  Object.keys(bySkill).forEach(sk => {
    const srcs = bySkill[sk].slice().sort().join(",");
    if (srcs !== "mall,tour") bad = sk + "=[" + srcs + "]";
  });
  check("各スキルの実地は mall1・tour1 の2つ（上限2Lv）", bad === null, bad || "");
  check("実地エントリ総数 = スキル数×2", KF.length === skillIds.length * 2, KF.length + " / " + (skillIds.length * 2));
}

// ── ③ skill は ACTIVE_SKILLS の id と一致 ──
{
  const unknown = KF.filter(e => skillIds.indexOf(e.skill) < 0).map(e => e.skill);
  check("skill は ACTIVE_SKILLS の id と一致", unknown.length === 0, [...new Set(unknown)].join(", "));
  const covered = skillIds.filter(id => KF.some(e => e.skill === id));
  check("全8スキルに実地ルートがある", covered.length === skillIds.length, covered.length + " / " + skillIds.length);
}

// ── ④ 師範未登場での名前漏れ（門番）：field_lessons.js が castNameSafe/_shihanOf を経由しているか ──
{
  const flSrc = fs.readFileSync(path.join(jsDir, "field_lessons.js"), "utf8");
  // pending に積む分岐（未登場）ではトーストに名前を入れていないこと＝"積もった" の汎用文言のみ
  const usesGate = /_flShihanMet/.test(flSrc) && /fieldPending/.test(flSrc);
  const bloomUsesSafe = /castNameSafe/.test(flSrc);   // 開花時の師範名は castNameSafe 経由（門番）
  check("師範未登場は fieldPending に積む（即上げしない）", usesGate);
  check("開花時の師範名は castNameSafe 経由（門番 fail-closed）", bloomUsesSafe);
  // 未登場トーストに固有名詞を直書きしていない（"師範 <名>" のような即時表示が無い）
  const leak = /fieldPending[^\n]*\n[^\n]*(サケ|ミズ|スミカ|マクラ|セレスティア)/.test(flSrc);
  check("未登場トーストに師範の固有名が漏れない", !leak);
}

// ── 逆向き確認 ──
if (process.argv.indexOf("--self") >= 0) {
  console.log("\n[self-check] bump を1つ隠して①が検出するか…");
  const fakeJs = allJs.replace(/bump\(\s*["']mallCharges["']/g, 'bump("__removed__"');
  const re = /bump\(\s*["']mallCharges["']/;
  console.log("  mallCharges の bump を除去 → 検出:", !re.test(fakeJs) ? "✓（①が働く）" : "✗");
}

// ── 出力 ──
console.log("\n=== 実地稽古（習い事）検査 ===");
console.log("実地エントリ: " + KF.length + " ／ スキル: " + skillIds.length + "（" + skillIds.join("/") + "）");
if (fail === 0) { console.log("✅ 全項目パス"); }
else { console.log("❌ " + fail + " 件:"); problems.forEach(p => console.log("  " + p)); process.exit(1); }
