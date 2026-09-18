// 衣装ミッションの参照先が実在するかを機械的に確かめる。
// 存在しない spot/meal/outfit を書くと「永久に未達成のミッション」になり、
// 画面上は静かに壊れる（誰も気づけない）ので、ここで落とす。
const fs = require("fs");
const R = (p) => fs.readFileSync(p, "utf8");

const cm   = R("js/costume_missions.js");
const map  = R("js/ui_konron_map.js");
const meal = R("js/meals.js");
const asset= R("js/data_assets.js");

// 正解集合
const spots   = new Set([...map.matchAll(/^\s*([a-z_]+):\s*\{ name: "/gm)].map(m => m[1]));
const meals   = new Set([...meal.matchAll(/\{\s*id:\s*"([a-z_0-9]+)",\s*tier:/g)].map(m => m[1]));
const outfits = new Set([...asset.matchAll(/\{\s*id:\s*"([A-Za-z_]+)",\s*name:/g)].map(m => m[1]));

let bad = 0;
const fail = (msg) => { console.error("NG  " + msg); bad++; };

[...cm.matchAll(/_cmSeen\("([^"]+)"\)/g)].forEach(m => {
  if (!spots.has(m[1])) fail('_cmSeen("' + m[1] + '") — そんなスポットidは無い');
});
[...cm.matchAll(/_cmAte\("([^"]+)"\)/g)].forEach(m => {
  if (!meals.has(m[1])) fail('_cmAte("' + m[1] + '") — そんな料理idは無い');
});
[...cm.matchAll(/outfit:\s*"([^"]+)"/g)].forEach(m => {
  if (!outfits.has(m[1])) fail('outfit "' + m[1] + '" — OUTFITS に無い');
});
[...cm.matchAll(/cg:\s*"([^"]+)"/g)].forEach(m => {
  if (!fs.existsSync(m[1])) fail('cg "' + m[1] + '" — 画像ファイルが無い');
});

const n = (cm.match(/outfit:\s*"/g) || []).length;
if (bad) { console.error("\n" + bad + " 件の不整合。ミッション数=" + n); process.exit(1); }
console.log("OK  ミッション " + n + " 件、参照先はすべて実在（spot/meal/outfit/cg画像）");
