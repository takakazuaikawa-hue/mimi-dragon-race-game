// =========================================================================
// tools/check_meals.mjs — 🍜 食の「出会い」の機械検査（2026-08-02）
// =========================================================================
// 食は「世界で出会う」設計になった（メニューから選ぶのではなく、島を歩いて見つける）。
// その代償として **どこからも出会えない品** が生まれうるので、そこだけを機械で守る。
//
//   ① where を持つ eat 品は、いずれかの kwStall(...) の ids に必ず含まれる（出会えない品ゼロ）
//   ② time の語彙は kwNow の6種（未明/朝/昼/夕暮れ/宵/夜）だけ
//   ③ quiz 品に where を付けない（？？？カードの分岐が !m.quiz 前提のため）
//   ④ MEAL_SPOTS の結線先は KONRON_SPOTS に実在する（撮影後の誘いが空振りしない）
//   ⑤ 屋台は「どの刻に行っても全品が消える」ことがない（＝全滅する時間帯を報告）
//
// 単体実行： node tools/check_meals.mjs
// =========================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const KW_TIMES = ["未明", "朝", "昼", "夕暮れ", "宵", "夜"];
let ng = 0, warn = 0;
const ok = (m) => console.log("  [32m✓[0m " + m);
const bad = (m) => { ng++; console.log("  [31m✗[0m " + m); };
const note = (m) => { warn++; console.log("  [33m![0m " + m); };

// ── MEALS を素朴に読む（classic script なので eval せず、正規表現でエントリ単位に切る）──
const mealsSrc = read("js/meals.js");
const bodyStart = mealsSrc.indexOf("var MEALS = [");
const bodyEnd = mealsSrc.indexOf("\n];", bodyStart);
if (bodyStart < 0 || bodyEnd < 0) { console.error("MEALS 配列が見つからない"); process.exit(1); }
const body = mealsSrc.slice(bodyStart, bodyEnd);

const meals = [];
for (const chunk of body.split(/\n  \{ id: /).slice(1)) {
  const id = (chunk.match(/^"([^"]+)"/) || [])[1];
  if (!id) continue;
  const tier = (chunk.match(/tier:\s*"([^"]+)"/) || [])[1] || "";
  const name = (chunk.match(/name:\s*"([^"]+)"/) || [])[1] || "";
  const where = (chunk.match(/where:\s*"([^"]+)"/) || [])[1] || "";
  const scent = (chunk.match(/scent:\s*"([^"]+)"/) || [])[1] || "";
  const timeRaw = (chunk.match(/time:\s*\[([^\]]*)\]/) || [])[1] || "";
  const time = timeRaw ? [...timeRaw.matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  const quiz = /\n\s*quiz:\s*\{/.test(chunk);
  meals.push({ id, tier, name, where, scent, time, quiz });
}

// ── kwStall(...) の ids を集める ─────────────────────────────────────────
const konron = read("js/scene_konron.js");
const stalls = [...konron.matchAll(/kwStall\(\s*"([^"]+)"\s*,\s*\[([^\]]*)\]\s*\)/g)].map((m) => ({
  title: m[1],
  ids: [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}));
const stalled = new Set(stalls.flatMap((s) => s.ids));

// ── MEAL_SPOTS と KONRON_SPOTS ──────────────────────────────────────────
const spotsRaw = (mealsSrc.match(/const MEAL_SPOTS = \{([\s\S]*?)\};/) || [])[1] || "";
const mealSpots = Object.fromEntries(
  [...spotsRaw.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]])
);
const mapSrc = read("js/ui_konron_map.js");
const spotKeys = new Set(
  [...(mapSrc.match(/const KONRON_SPOTS = \{[\s\S]*?\n\};/) || [""])[0].matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1])
);

console.log(`\n🍜 食の出会い検査 — ${meals.length}品 / 屋台 ${stalls.length}軒 / スポット結線 ${Object.keys(mealSpots).length}件\n`);

// ① 出会えない品ゼロ
console.log("1) where を持つ品は、どこかの屋台に並んでいるか");
const orphan = meals.filter((m) => m.where && !m.quiz && !stalled.has(m.id));
if (orphan.length) orphan.forEach((m) => bad(`${m.id}（${m.name}）は where があるのに、どの kwStall にも入っていない＝出会えない`));
else ok(`where 付き ${meals.filter((m) => m.where).length}品すべてが、いずれかの屋台に並ぶ`);

// 逆向き：屋台に並んでいるのに where が無い品（？？？カードにならず名前が丸見えになる）
const bare = [...stalled].filter((id) => { const m = meals.find((x) => x.id === id); return m && !m.where; });
if (bare.length) bare.forEach((id) => note(`${id} は屋台に並ぶが where が無い＝はじめから名前が見えている（意図的なら可）`));

// ② time の語彙
console.log("\n2) time の語彙が kwNow の6種だけか");
const badTime = meals.filter((m) => m.time.some((t) => !KW_TIMES.includes(t)));
if (badTime.length) badTime.forEach((m) => bad(`${m.id} の time に未知の刻: ${m.time.filter((t) => !KW_TIMES.includes(t)).join("/")}`));
else ok(`語彙ゆれなし（${KW_TIMES.join("・")}）`);

// ③ quiz 品に where を付けない
console.log("\n3) quiz 品に where が付いていないか（？？？分岐の前提）");
const quizWhere = meals.filter((m) => m.quiz && m.where);
if (quizWhere.length) quizWhere.forEach((m) => bad(`${m.id}（${m.name}）は quiz なのに where がある＝mystery分岐が壊れる`));
else ok("quiz 品に where なし");

// ④ スポット結線の実在
console.log("\n4) スポット結線（ついでに一皿）の行き先が実在するか");
let spotNg = 0;
for (const [mid, sid] of Object.entries(mealSpots)) {
  if (!meals.find((m) => m.id === mid)) { bad(`MEAL_SPOTS の ${mid} は MEALS に無い`); spotNg++; }
  else if (!spotKeys.has(sid)) { bad(`${mid} → ${sid} は KONRON_SPOTS に無い＝誘いが空振りする`); spotNg++; }
}
if (!spotNg) ok(`${Object.keys(mealSpots).length}件すべて実在（${Object.entries(mealSpots).map(([a, b]) => a + "→" + b).join(" / ")}）`);

// ⑤ 屋台の時間帯シミュレーション（全滅する刻が無いか）
console.log("\n5) 屋台の品揃え（刻ごと・0品になる屋台は「店じまい」表示になる）");
for (const s of stalls) {
  const row = KW_TIMES.map((t) => {
    const n = s.ids.filter((id) => { const m = meals.find((x) => x.id === id); return m && (!m.time.length || m.time.includes(t)); }).length;
    return `${t}:${n}`;
  });
  const zero = KW_TIMES.filter((t) => s.ids.filter((id) => { const m = meals.find((x) => x.id === id); return m && (!m.time.length || m.time.includes(t)); }).length === 0);
  console.log(`     ${s.title}  ${row.join(" ")}`);
  if (zero.length === KW_TIMES.length) bad(`${s.title} は全時間帯で0品＝一度も開かない`);
  else if (zero.length) note(`${s.title} は ${zero.join("・")} が店じまい（意図的なら可）`);
}

// ── 気配（scent）の欠け ──────────────────────────────────────────────
console.log("\n6) where を持つ品に気配（scent）があるか＝？？？カードが無言にならない");
const noScent = meals.filter((m) => m.where && !m.scent);
if (noScent.length) noScent.forEach((m) => bad(`${m.id} に scent が無い＝？？？カードが手がかりゼロになる`));
else ok("where 付きの品はすべて気配つき");

console.log(
  ng ? `\n[31m✗ ${ng}件の不備[0m${warn ? `（ほか注意 ${warn}件）` : ""}\n`
     : `\n[32m✅ 出会えない品はありません[0m${warn ? `（注意 ${warn}件）` : ""}\n`
);
process.exit(ng ? 1 : 0);
