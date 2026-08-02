// =========================================================================
// tools/check_ui_tokens.mjs — 🧱 UI土台のラチェット検査（2026-08-02）
// =========================================================================
// 目的＝「直書きの装飾値」が増えて土台が腐るのを防ぐ。数字は一方向にしか動けない：
//   直書きの数が下の天井（前回の実測）を超えたら赤で落ちる。減ったら天井を下げて更新する。
// 正本＝docs/UI_FOUNDATION_PLAN.md。トークンの定義はstyle.css後方の「UI装飾第1波」ブロック。
// ★並行のトークン系を作らないこと（--r-4 が 4px と 22px で衝突した前科がある）。
//
// 単体実行： node tools/check_ui_tokens.mjs
// =========================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(ROOT, "style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// ── ラチェットの天井（2026-08-02 実測。減ったらここを下げる。上げるのは禁止） ──
const CEILING = {
  radiusLiteral: 167,   // border-radius の直書き（11px/13px/99px/3px 等の端数）
};
// まだ統治していない領域（情報表示のみ・将来の工事の物差し）
const INFO_ONLY = true;

let ng = 0;
const ok = (m) => console.log("  [32m✓[0m " + m);
const bad = (m) => { ng++; console.log("  [31m✗[0m " + m); };
const info = (m) => console.log("    " + m);

console.log("\n🧱 UI土台ラチェット検査\n");

// ① 角丸の直書き
const radiusAll = [...css.matchAll(/border-radius:\s*([^;}]+)[;}]/g)].map((m) => m[1].trim());
const radiusLit = radiusAll.filter((v) => !v.startsWith("var("));
console.log("1) 角丸（統治済みの領域）");
if (radiusLit.length > CEILING.radiusLiteral)
  bad(`直書きが増えた: ${radiusLit.length} > 天井 ${CEILING.radiusLiteral}。新しい角丸は var(--r-*) か既存の --rd-* を使うこと`);
else {
  ok(`直書き ${radiusLit.length} ≦ 天井 ${CEILING.radiusLiteral}（var経由 ${radiusAll.length - radiusLit.length}）`);
  if (radiusLit.length < CEILING.radiusLiteral)
    info(`※ ${CEILING.radiusLiteral - radiusLit.length} 件減っている。この検査の CEILING.radiusLiteral を ${radiusLit.length} に下げて更新すること`);
}
const litDist = {};
radiusLit.forEach((v) => { litDist[v] = (litDist[v] || 0) + 1; });
info("残債の内訳: " + Object.entries(litDist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, n]) => `${v}(${n})`).join(" "));

// ② トークン定義の一意性（並行系の検出＝--r-4事故の再発防止）
console.log("\n2) トークン定義の一意性");
const defs = {};
for (const m of css.matchAll(/(--(?:r|rd|e)-[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
  (defs[m[1]] = defs[m[1]] || new Set()).add(m[2].trim());
}
const dup = Object.entries(defs).filter(([, vals]) => vals.size > 1);
if (dup.length) dup.forEach(([k, vals]) => bad(`${k} が複数の値で定義されている: ${[...vals].join(" と ")}（後勝ちで片方が死ぬ）`));
else ok(`--r-* / --rd-* / --e-* の定義はすべて一意（${Object.keys(defs).length} 個）`);

// ③ 未統治の領域（情報のみ・次の工事の規模感）
if (INFO_ONLY) {
  console.log("\n3) 未統治の領域（参考・まだ検査しない）");
  const count = (re) => (css.match(re) || []).length;
  info(`padding直書き: ${count(/padding[^:]*:\s*[^v;}][^;}]*[;}]/g)} 箇所`);
  info(`box-shadow直書き: ${count(/box-shadow:\s*[^v;}][^;}]*[;}]/g)} 箇所`);
  info(`16進色の直書き: ${count(/#[0-9a-fA-F]{3,8}\b/g)} 箇所`);
}

console.log(ng ? `\n[31m✗ ${ng}件の逆行[0m\n` : "\n[32m✅ 土台は腐っていない[0m\n");
process.exit(ng ? 1 : 0);
