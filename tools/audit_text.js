#!/usr/bin/env node
// =============================================================================
// tools/audit_text.js — 画面に出る「読み物」の量と質を測る
// =============================================================================
// ★なぜ要るか
//   ユーザー指摘：「読んでも大したことがない文章がありすぎて、読む気が失せる。
//   説明書を読んでいるのではなく、ゲームをプレイしている体験を邪魔しない
//   言葉選びと情報の整理をしてください。ゲームデザインの基本です」
//
//   文章は書いた本人には短く見える。積み上がった総量は数えないと見えない。
//   ここで「どの画面に、どれだけの読まされる文字があるか」を出す。
//
// 使い方: node tools/audit_text.js         … 集計
//         node tools/audit_text.js -v      … 実際の文面も出す
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const VERBOSE = process.argv.includes("-v");

const files = fs.readdirSync(path.join(ROOT, "js")).filter(f => f.endsWith(".js"));

// 日本語を含む文字列リテラルを抜き出す
function literals(src) {
  const out = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src))) {
    const t = m[1] || m[2] || m[3] || "";
    if (/[ぁ-んァ-ヶ一-龠]/.test(t)) out.push(t);
  }
  return out;
}
// タグと差し込み枠を除いた「読む文字」の数
const readable = t => t.replace(/<[^>]*>/g, "").replace(/\$\{[^}]*\}/g, "").replace(/\s+/g, "").length;

// ── ①決まり文句：同じ断り書きが何度も出ていないか ──────────────────
// 一度どこかで説明すれば足りるものを毎画面に置くと、文字だけが増えて
// 誰も読まなくなる（オオカミ少年になる）。
const BOILER = [
  ["表示専用", /表示専用/],
  ["レースの結果には影響しません", /レース(の結果|の着順)?[^。]{0,12}影響しません/],
  ["オッズ・配当は変わりません", /オッズ[・･].{0,4}配当は変わりません/],
  ["※注記の行", /^※/]
];

let total = 0, longTotal = 0;
const perFile = [], boilerHits = {}, longOnes = [];
files.forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
  const lits = literals(src);
  let chars = 0;
  lits.forEach(t => {
    const n = readable(t);
    chars += n;
    if (n >= 45) { longTotal += n; longOnes.push({ f, n, t: t.replace(/<[^>]*>/g, "").slice(0, 110) }); }
    BOILER.forEach(([name, re]) => { if (re.test(t)) boilerHits[name] = (boilerHits[name] || 0) + 1; });
  });
  total += chars;
  if (chars > 0) perFile.push({ f, n: lits.length, chars });
});
perFile.sort((a, b) => b.chars - a.chars);
longOnes.sort((a, b) => b.n - a.n);

console.log("");
console.log("=== 画面に出る文章の量 ===");
console.log("全体: " + total.toLocaleString("ja-JP") + "字 ／ うち45字以上の長文が " +
            longTotal.toLocaleString("ja-JP") + "字（" + Math.round(longTotal / total * 100) + "%）");
console.log("");
console.log("文章の多いファイル:");
perFile.slice(0, 12).forEach(r => console.log("  " + r.f.padEnd(28) + String(r.chars).padStart(6) + "字 / " + r.n + "本"));

console.log("");
console.log("同じ断り書きの繰り返し（毎回読ませる価値があるか）:");
Object.keys(boilerHits).sort((a, b) => boilerHits[b] - boilerHits[a])
  .forEach(k => console.log("  " + k.padEnd(28) + boilerHits[k] + "箇所"));

console.log("");
console.log("いちばん長い文（プレイ中に読ませるには重い）:");
longOnes.slice(0, VERBOSE ? 25 : 8).forEach(r =>
  console.log("  " + String(r.n).padStart(3) + "字 " + r.f.replace(/\.js$/, "").padEnd(20) + " " + r.t));
console.log("");
console.log("※ 減らす対象は「読まなくても遊べる文」。物語と台詞は減らさない。");
