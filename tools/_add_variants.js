// 局面台詞の変化形を data_broadcast_lines.js の該当スロットへ差し込む道具
// 使い方: node tools/_add_variants.js <行データのファイル>
//
// 入力の1行は { slot: "cutin.toLead", cm: "sake", line: "……" },
// これを BC_LINES[group][use].color[cm] の配列末尾に足す。
const fs = require("fs");
const target = __dirname + "/../js/data_broadcast_lines.js";
const raw = fs.readFileSync(process.argv[2], "utf8");

const rows = [];
raw.split("\n").forEach(l => {
  const m = l.match(/slot:\s*"([^"]+)"\s*,\s*cm:\s*"([^"]+)"\s*,\s*line:\s*"([^"]+)"/);
  if (m) rows.push({ slot: m[1], cm: m[2], line: m[3] });
});
if (!rows.length) { console.error("行が読めない"); process.exit(1); }

let src = fs.readFileSync(target, "utf8");
let ok = 0, ng = [];

// 解説者キーごとにまとめて、既存の配列へ追記する
const byKey = {};
rows.forEach(r => { (byKey[r.slot + "|" + r.cm] = byKey[r.slot + "|" + r.cm] || []).push(r.line); });

Object.keys(byKey).forEach(k => {
  const [slot, cm] = k.split("|");
  const [g, u] = slot.split(".");
  // 対象スロットの範囲を切り出してから、その中の cm 行だけを置き換える
  const gi = src.indexOf("\n  " + g + ": {");
  if (gi < 0) { ng.push("局面が無い: " + g); return; }
  const ui = src.indexOf("\n    " + u + ": {", gi);
  if (ui < 0) { ng.push("枝が無い: " + slot); return; }
  const end = src.indexOf("\n    },", ui);
  const block = src.slice(ui, end);
  const re = new RegExp("(" + cm + ":\\s*\\[)([\\s\\S]*?)(\\])");
  const m = block.match(re);
  if (!m) { ng.push("解説者が無い: " + slot + " " + cm); return; }
  const add = byKey[k].map(l => ',\n' + ' '.repeat(20) + '"' + l + '"').join("");
  const nb = block.replace(re, m[1] + m[2].replace(/\s+$/, "") + add + m[3]);
  src = src.slice(0, ui) + nb + src.slice(end);
  ok += byKey[k].length;
});

fs.writeFileSync(target, src);
console.log("差し込み " + ok + "本" + (ng.length ? " / 失敗 " + ng.length + ": " + ng.slice(0, 5).join(" , ") : ""));
