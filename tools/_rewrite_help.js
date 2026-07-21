// スカウトのヘルプ（16〜28行）を、新しい遊びに合わせて短く書き直す
const fs = require("fs");
const p = __dirname + "/../js/ui_scout.js";
const lines = fs.readFileSync(p, "utf8").split("\n");

// 置き換え範囲：function showScoutHelp() の行 〜 その直後の "}" 行
let start = -1;
for (let i = 0; i < lines.length; i++) if (/function showScoutHelp\(\)/.test(lines[i])) { start = i; break; }
if (start < 0) { console.error("showScoutHelp が見つからない"); process.exit(1); }
let end = -1;
for (let i = start + 1; i < lines.length; i++) if (lines[i] === "}") { end = i; break; }
if (end < 0) { console.error("関数の終わりが見つからない"); process.exit(1); }

const neo = [
  "// ★遊びかたは短く。ここは「困ったときに開く」場所であって、遊ぶ前に読ませる",
  "//   説明書ではない（ユーザー指摘：読んでも大したことがない文章が多く、読む気が失せる）。",
  "//   旧版は7項目・約400字あり、しかも廃止した「交渉術」を説明したままの嘘になっていた。",
  "function showScoutHelp() {",
  '  showInfoPopup("🔍 竜と仲よくなる",',
  '    `<div class="mm-row"><span class="mm-ic">👀</span><div><b>向いた方を押す</b>' +
  '<small>ふと向いた先が、いま気になっているもの。同じ向きを押すと、ミミがその話をする。</small></div></div>` +',
  '    `<div class="mm-row"><span class="mm-ic">💃</span><div><b>満ちたら踊る</b>' +
  '<small>竜が揺れはじめたら、流れてくるステップに合わせて押す。踊りきれば仲間に。</small></div></div>` +',
  '    `<div class="mm-row"><span class="mm-ic">🍃</span><div><b>断られても平気</b>' +
  '<small>竜は消えない。何度でも会いにいける。</small></div></div>` +',
  '    `<div class="mm-note">この遊びはレースの着順・オッズ・配当に影響しません。</div>`);',
  "}"
];

lines.splice(start, end - start + 1, ...neo);
fs.writeFileSync(p, lines.join("\n"));
console.log("ヘルプを書き直した（旧 " + (end - start + 1) + "行 → 新 " + neo.length + "行）");
