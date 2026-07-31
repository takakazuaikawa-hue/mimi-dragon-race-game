// 歩ける崑崙島の到達性検証（KONRON_WALK_COMPLETION_DIRECTIVE W3）
// 全6エリアで start → 全 door / 全 npc の往復到達をBFSで機械検証
import fs from "node:fs";
import { createContext, runInContext } from "node:vm";
const ROOT = "C:/Users/takakazu/projects/mimi_dragon_race_game/";
const src = fs.readFileSync(ROOT + "js/scene_konron.js", "utf8");

// KW_AREAS だけを安全に取り出して評価する（関数本体は使わない）
const start = src.indexOf("const KW_AREAS = {");
const end = src.indexOf("\n};", start) + 3;
const ctx = createContext({});
runInContext(`
  function renderMall(){} function renderKonronMap(){} function kwStall(){} function kwShoot(){}
  function kwTalkKeeper(){} function renderRaceSelect(){} function renderScout(){} function renderStable(){}
  function renderMeals(){} function renderKiko(){} function renderCollection(){} function renderLifeTree(){}
  var KW_COLS=32, KW_ROWS=24;
` + src.slice(start, end), ctx);
const AREAS = runInContext("KW_AREAS", ctx);

let fail = 0, total = 0;
for (const [key, a] of Object.entries(AREAS)) {
  const map = a.map;
  const H = map.length, W = map[0].length;
  const walk = (c, r) => r >= 0 && r < H && c >= 0 && c < W && map[r][c] === ".";
  // BFS from start
  const seen = new Set(); const q = [[a.start.c, a.start.r]];
  if (!walk(a.start.c, a.start.r)) { console.log(`  ❌ ${key}: start(${a.start.c},${a.start.r}) が壁の上`); fail++; }
  seen.add(a.start.c + "," + a.start.r);
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr, k = nc + "," + nr;
      if (walk(nc, nr) && !seen.has(k)) { seen.add(k); q.push([nc, nr]); }
    }
  }
  const targets = [];
  (a.doors || []).forEach(d => targets.push({ kind: "入口", n: d.n, c: d.c, r: d.r }));
  (a.npcs || []).forEach((n, i) => targets.push({ kind: "NPC", n: "s" + n.s, c: n.c, r: n.r }));
  const bad = [];
  for (const t of targets) {
    total++;
    // 入口/NPCのセル自身が壁でも、隣接1マスが到達可能なら「行ける」（話しかけ/入るは隣接で成立）
    const ok = seen.has(t.c + "," + t.r) ||
      [[1,0],[-1,0],[0,1],[0,-1]].some(([dc,dr]) => seen.has((t.c+dc) + "," + (t.r+dr)));
    if (!ok) { bad.push(`${t.kind}「${t.n}」(${t.c},${t.r})`); fail++; }
  }
  const walkable = map.join("").split("").filter(ch => ch === ".").length;
  console.log(`  ${bad.length ? "❌" : "✅"} ${key.padEnd(8)} 歩けるマス${String(walkable).padStart(3)} 到達${seen.size}  対象${targets.length}` +
    (bad.length ? `\n       未到達: ${bad.join(" / ")}` : ""));
}
console.log(`\n${fail === 0 ? "✅ 全エリア ALL GREEN" : "❌ " + fail + "件 未到達"}（対象 ${total}）`);

// エリア間の徒歩接続グラフが連結か
const g = {};
for (const [k, a] of Object.entries(AREAS)) g[k] = (a.doors || []).filter(d => d.area).map(d => d.area);
const vis = new Set(["city"]); const q2 = ["city"];
while (q2.length) { const cur = q2.shift(); for (const nx of (g[cur] || [])) if (!vis.has(nx)) { vis.add(nx); q2.push(nx); } }
const all = Object.keys(AREAS);
console.log(`接続グラフ: city から到達 ${vis.size}/${all.length} ${vis.size === all.length ? "✅ 連結" : "❌ 孤島=" + all.filter(x => !vis.has(x))}`);
// 往復（戻り道）があるか
for (const [k, outs] of Object.entries(g)) for (const o of outs) {
  if (!(g[o] || []).includes(k)) console.log(`  ⚠️ 片道: ${k} → ${o} （${o} から ${k} へ戻れない）`);
}
process.exit(fail === 0 ? 0 : 1);
