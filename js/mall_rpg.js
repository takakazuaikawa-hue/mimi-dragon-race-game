// =========================================================================
// 🗝️ モール地下大迷宮 — 一人称ダンジョンRPG（女神転生風・グリッド一人称）
// モール地下に広がる迷宮を1歩ずつ探索。ランダムエンカウントで魔物と戦い、弱点を突いて
// 「もう1回！」を奪い、ボスを倒して衣装を得る。弱点は戦って判明＝魔物図鑑に記録。
// ★完全に表示メタ：着順・オッズ・配当・プレイヤーのコインには一切干渉しない（[[race-math-immutable]]）。
//   報酬は内部通貨ゴールド＋衣装(outfitsWon=着替えに反映)のみ。レース系engineには接続しない。
// 永続: state.player.rpg = {lv,exp,hp,mp,maxhp,maxmp,gold,skills[],items{},cleared,codex{},best{}}
// =========================================================================

let RPG = null;   // 進行中の探索（永続は state.player.rpg）

// ── 永続キャラ（遅延初期化＝state.js非依存・後方互換）
function rpgData() {
  const p = state.player;
  if (!p.rpg) {
    p.rpg = {
      lv: 1, exp: 0, maxhp: 32, maxmp: 18, hp: 32, mp: 18, gold: 0,
      skills: ["atk", "fire", "heal"], items: { potion: 3, ether: 1 },
      cleared: false, codex: {}, best: { lv: 1 }
    };
  }
  const d = p.rpg;
  if (!d.items) d.items = { potion: 0, ether: 0 };
  if (!d.codex) d.codex = {};
  if (!d.skills) d.skills = ["atk"];
  if (!d.best) d.best = { lv: d.lv || 1 };
  return d;
}
function rpgSave() { if (typeof saveGame === "function") saveGame(); }
function rpgRnd(a, b) { return a + Math.random() * (b - a); }
function rpgPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rpgSfx(id) { try { if (window.Sfx) Sfx.play(id); } catch (e) {} }

// ── 属性・スキル（戦闘専用の独立計算。レース数式とは無関係）
const RPG_ELEM = { phys: "物理", fire: "火", ice: "氷", elec: "電", force: "力", heal: "回復" };
const RPG_ELEM_IC = { phys: "⚔️", fire: "🔥", ice: "❄️", elec: "⚡", force: "🌀", heal: "💚" };
const RPG_SKILLS = {
  atk:   { n: "たたかう", el: "phys", mp: 0, pow: 9 },
  fire:  { n: "アギ",     el: "fire", mp: 4, pow: 13 },
  ice:   { n: "ブフ",     el: "ice",  mp: 4, pow: 13 },
  elec:  { n: "ジオ",     el: "elec", mp: 4, pow: 13 },
  force: { n: "ザン",     el: "force",mp: 5, pow: 14 },
  heal:  { n: "ディア",   el: "heal", mp: 6, heal: 30 },
};
// レベルで覚える
const RPG_LEARN = { 3: ["ice"], 5: ["elec"], 7: ["force"] };

// ── 魔物（新規デザイン＝竜ロスターは使わない）
const RPG_MONS = {
  slime: { n: "マヨイスライム", ic: "🟢", hp: 16, atk: 6, exp: 6,  gold: 8,  weak: ["fire"], resist: ["ice"], nul: [], el: "phys" },
  bat:   { n: "ホラアナバット", ic: "🦇", hp: 12, atk: 7, exp: 5,  gold: 6,  weak: ["force"], resist: [], nul: [], el: "phys" },
  mush:  { n: "ドクキノコ",     ic: "🍄", hp: 20, atk: 6, exp: 8,  gold: 10, weak: ["fire"], resist: ["elec"], nul: [], el: "phys" },
  doll:  { n: "さまようマネキン", ic: "🤖", hp: 26, atk: 8, exp: 12, gold: 14, weak: ["elec"], resist: ["phys"], nul: [], el: "phys" },
  ghost: { n: "まよいの霊",     ic: "👻", hp: 18, atk: 7, exp: 10, gold: 12, weak: ["force"], resist: [], nul: ["phys"], el: "ice" },
  wisp:  { n: "おにび",         ic: "🔥", hp: 16, atk: 8, exp: 9,  gold: 10, weak: ["ice"], resist: [], nul: ["fire"], el: "fire" },
  boss1: { n: "ミミック大王",   ic: "🎁", hp: 90, atk: 12, exp: 60, gold: 120, weak: ["elec"], resist: ["fire", "ice"], nul: [], el: "phys", boss: true },
};
const RPG_ENC = ["slime", "bat", "mush", "doll", "ghost", "wisp"];

// ── 迷宮マップ（# 壁 / . 床 / S 入口 / T 宝 / E 出口=ボス）。9x9・連結確認済み。
const RPG_FLOOR1 = [
  "#########",
  "#S......#",
  "#.#####.#",
  "#.#.T.#.#",
  "#.#.#.#.#",
  "#.#.#...#",
  "#.#.###.#",
  "#...#..E#",
  "#########",
];
const RPG_DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W
const RPG_DIRNAME = ["北", "東", "南", "西"];

// ── 探索の開始
function rpgStartRun() {
  const map = RPG_FLOOR1.map(r => r.split(""));
  let sx = 1, sy = 1;
  for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) if (map[y][x] === "S") { sx = x; sy = y; }
  RPG = {
    map, w: map[0].length, h: map.length,
    px: sx, py: sy, dir: 1,            // 入口で東向き
    mode: "explore", steps: 0, grace: 1,
    explored: {}, collected: {},
    log: [], battle: null, flash: null,
  };
  RPG.explored[sx + "," + sy] = 1;
  rpgLog("🗝️ 地下大迷宮にもぐった。気をつけて…", "good");
  renderMallRpg();
}
function rpgLog(t, cls) { if (!RPG) return; RPG.log.unshift({ t, cls: cls || "" }); RPG.log = RPG.log.slice(0, 5); }

// ── マップ参照（範囲外は壁）
function rpgCell(x, y) {
  if (!RPG || y < 0 || y >= RPG.h || x < 0 || x >= RPG.w) return "#";
  return RPG.map[y][x];
}
function rpgIsWall(c) { return c === "#"; }
// 視点からの相対セル（depth=前方距離, lat=横 -1左/+1右）
function rpgAhead(depth, lat) {
  const f = RPG_DV[RPG.dir], r = RPG_DV[(RPG.dir + 1) % 4];
  return rpgCell(RPG.px + f[0] * depth + r[0] * lat, RPG.py + f[1] * depth + r[1] * lat);
}

// ── 移動
function rpgTurn(d) {
  if (!RPG || RPG.mode !== "explore") return;
  RPG.dir = (RPG.dir + d + 4) % 4;
  rpgSfx("tick");
  renderMallRpg();
}
function rpgForward(sign) {
  if (!RPG || RPG.mode !== "explore") return;
  const f = RPG_DV[RPG.dir];
  const nx = RPG.px + f[0] * sign, ny = RPG.py + f[1] * sign;
  if (rpgIsWall(rpgCell(nx, ny))) { rpgLog("🧱 壁だ。", ""); renderMallRpg(); return; }
  RPG.px = nx; RPG.py = ny; RPG.steps++;
  RPG.explored[nx + "," + ny] = 1;
  rpgSfx("tick");
  const here = rpgCell(nx, ny);
  if (here === "T") { rpgTreasure(nx, ny); return; }
  if (here === "E") { rpgReachExit(); return; }
  // ランダムエンカウント
  if (RPG.grace > 0) RPG.grace--;
  else if (Math.random() < 0.22) { rpgEncounter(); return; }
  renderMallRpg();
}
function rpgTreasure(x, y) {
  const key = x + "," + y;
  if (RPG.collected[key]) { rpgLog("📦 からっぽの宝箱だ。", ""); renderMallRpg(); return; }
  RPG.collected[key] = 1;
  const d = rpgData();
  const g = 20 + Math.floor(Math.random() * 30);
  d.gold += g;
  let extra = "";
  if (Math.random() < 0.5) { d.items.potion = (d.items.potion || 0) + 1; extra = "・回復薬×1"; }
  rpgLog(`📦 宝箱！ ゴールド+${g}${extra}`, "good");
  rpgSfx("unlock"); rpgSave();
  renderMallRpg();
}
function rpgReachExit() {
  const d = rpgData();
  if (!d.cleared) { rpgEncounter(true); return; }   // 初回はボス戦
  RPG.mode = "result"; renderMallRpg();
}

// =========================================================================
// 戦闘
// =========================================================================
function rpgEncounter(boss) {
  let list;
  if (boss) list = [{ id: "boss1" }];
  else {
    const n = Math.random() < 0.45 ? 2 : 1;
    list = []; for (let i = 0; i < n; i++) list.push({ id: rpgPick(RPG_ENC) });
  }
  const enemies = list.map(e => {
    const m = RPG_MONS[e.id];
    return { id: e.id, ref: m, hp: m.hp, maxhp: m.hp, alive: true };
  });
  RPG.battle = { enemies, target: 0, extra: false, log: [], boss: !!boss, phase: "cmd", sub: null };
  RPG.mode = "battle";
  rpgBLog(boss ? `👹 ${enemies[0].ref.n} が立ちはだかった！` : `⚔️ ${enemies.map(e => e.ref.n).join("・")} が現れた！`);
  rpgSfx("alert");
  renderMallRpg();
}
function rpgBLog(t, cls) { if (RPG && RPG.battle) { RPG.battle.log.unshift({ t, cls: cls || "" }); RPG.battle.log = RPG.battle.log.slice(0, 6); } }
function rpgAliveEnemies() { return RPG.battle.enemies.filter(e => e.alive); }
function rpgPlayerPow() { return 5 + rpgData().lv * 2; }

// 弱点・耐性の倍率
function rpgMult(mon, el) {
  if (el === "phys" && mon.nul.indexOf("phys") >= 0) return 0;
  if (mon.nul.indexOf(el) >= 0) return 0;
  if (mon.weak.indexOf(el) >= 0) return 1.9;
  if (mon.resist.indexOf(el) >= 0) return 0.5;
  return 1;
}
function rpgCodexLearn(id, el) {
  const d = rpgData();
  if (!d.codex[id]) d.codex[id] = { weak: [] };
  if (d.codex[id].weak.indexOf(el) < 0) { d.codex[id].weak.push(el); return true; }
  return false;
}

function rpgSelectTarget(i) {
  if (!RPG || RPG.mode !== "battle") return;
  if (RPG.battle.enemies[i] && RPG.battle.enemies[i].alive) { RPG.battle.target = i; renderMallRpg(); }
}
function rpgOpenSkills() { if (RPG && RPG.battle && RPG.battle.phase === "cmd") { RPG.battle.sub = "skills"; renderMallRpg(); } }
function rpgOpenItems() { if (RPG && RPG.battle && RPG.battle.phase === "cmd") { RPG.battle.sub = "items"; renderMallRpg(); } }
function rpgCmdBack() { if (RPG && RPG.battle) { RPG.battle.sub = null; renderMallRpg(); } }

function rpgUseSkill(id) {
  const b = RPG.battle, d = rpgData(), sk = RPG_SKILLS[id];
  if (!b || b.phase !== "cmd" || !sk) return;
  if (d.mp < sk.mp) { rpgBLog("MPが足りない！", ""); renderMallRpg(); return; }
  d.mp -= sk.mp;
  b.sub = null;
  if (sk.el === "heal") {
    const h = sk.heal + d.lv * 2;
    d.hp = Math.min(d.maxhp, d.hp + h);
    rpgBLog(`💚 ${sk.n}！ HPが${h}回復した。`, "good");
    rpgSfx("unlock");
    rpgEndPlayerAction(false);
    return;
  }
  // 攻撃
  let tgt = b.enemies[b.target];
  if (!tgt || !tgt.alive) tgt = rpgAliveEnemies()[0];
  if (!tgt) { rpgEndPlayerAction(false); return; }
  const mult = rpgMult(tgt.ref, sk.el);
  let weakHit = false;
  if (mult === 0) {
    rpgBLog(`${RPG_ELEM_IC[sk.el]} ${sk.n}！ …${tgt.ref.n}には効かない！`, "");
  } else {
    const raw = (sk.pow + rpgPlayerPow() * 0.6) * mult * rpgRnd(0.9, 1.1);
    const dmg = Math.max(1, Math.round(raw));
    tgt.hp -= dmg;
    let tag = "";
    if (mult >= 1.9) { weakHit = true; tag = " 弱点!"; if (rpgCodexLearn(tgt.id, sk.el)) rpgBLog(`📖 ${tgt.ref.n}の弱点「${RPG_ELEM[sk.el]}」を見つけた！`, "good"); }
    else if (mult === 0.5) tag = " 耐性…";
    rpgBLog(`${RPG_ELEM_IC[sk.el]} ${sk.n}！ ${tgt.ref.n}に${dmg}ダメージ${tag}`, weakHit ? "good" : "");
    rpgSfx(weakHit ? "win" : "tick");
    if (tgt.hp <= 0) { tgt.alive = false; rpgBLog(`💥 ${tgt.ref.n}を倒した！`, "good"); }
  }
  if (rpgAliveEnemies().length === 0) { rpgBattleWin(); return; }
  // 弱点ヒットで「もう1回！」（1ターン1回まで）
  if (weakHit && !b.extra) { b.extra = true; rpgBLog("✨ 弱点を突いた！ もう1回！", "good"); renderMallRpg(); return; }
  rpgEndPlayerAction(weakHit);
}
function rpgUseItem(kind) {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd") return;
  if (kind === "potion") {
    if ((d.items.potion || 0) <= 0) return;
    d.items.potion--; d.hp = Math.min(d.maxhp, d.hp + 40);
    rpgBLog("🧪 回復薬！ HP+40。", "good");
  } else if (kind === "ether") {
    if ((d.items.ether || 0) <= 0) return;
    d.items.ether--; d.mp = Math.min(d.maxmp, d.mp + 20);
    rpgBLog("🔵 マナ水！ MP+20。", "good");
  }
  b.sub = null; rpgSfx("unlock");
  rpgEndPlayerAction(false);
}
function rpgFlee() {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd") return;
  if (b.boss) { rpgBLog("ボスからは逃げられない！", ""); renderMallRpg(); return; }
  if (Math.random() < 0.5 + d.lv * 0.02) {
    rpgBLog("🏃 うまく逃げ切った！", "good");
    RPG.battle = null; RPG.mode = "explore"; RPG.grace = 2;
    renderMallRpg();
  } else {
    rpgBLog("逃げられなかった…！", "");
    rpgEnemyTurn();
  }
}
// プレイヤー行動の締め（extra=この行動が弱点だったか）
function rpgEndPlayerAction(weakHit) {
  const b = RPG.battle;
  if (b.extra && !weakHit) { b.extra = false; }   // もう1回ぶんを消化
  if (b.extra && weakHit) { /* すでに上で処理済み */ }
  if (b.extra) { b.extra = false; renderMallRpg(); return; }
  rpgEnemyTurn();
}
function rpgEnemyTurn() {
  const b = RPG.battle, d = rpgData();
  b.phase = "enemy";
  rpgAliveEnemies().forEach(e => {
    if (d.hp <= 0) return;
    const raw = e.ref.atk * rpgRnd(0.85, 1.15) - Math.floor(d.lv * 0.6);
    const dmg = Math.max(1, Math.round(raw));
    d.hp -= dmg;
    rpgBLog(`${e.ref.ic} ${e.ref.n}の攻撃！ ${dmg}ダメージ。`, "bad");
  });
  rpgSfx("tick");
  if (d.hp <= 0) { d.hp = 0; rpgBattleLose(); return; }
  b.phase = "cmd"; b.extra = false; b.sub = null;
  rpgSave();
  renderMallRpg();
}
function rpgBattleWin() {
  const b = RPG.battle, d = rpgData();
  let exp = 0, gold = 0;
  b.enemies.forEach(e => { exp += e.ref.exp; gold += e.ref.gold; });
  d.exp += exp; d.gold += gold;
  rpgBLog(`🎉 勝利！ EXP+${exp}・ゴールド+${gold}`, "win");
  // ボス：図鑑クリア＋衣装ドロップ
  let outfit = null;
  if (b.boss) {
    d.cleared = true;
    outfit = rpgGrantOutfit("c") || rpgGrantOutfit("r");
    if (outfit) rpgBLog(`👑 ミミック大王の宝！ 衣装「${outfit.name}」を手に入れた！`, "win");
  } else if (Math.random() < 0.06) {
    outfit = rpgGrantOutfit("c");
    if (outfit) rpgBLog(`👑 魔物が衣装「${outfit.name}」を落とした！`, "win");
  }
  // レベルアップ判定
  const ups = rpgCheckLevel();
  RPG.mode = "won";
  RPG.flash = { exp, gold, ups, outfit, boss: b.boss };
  rpgSfx("win"); rpgSave();
  renderMallRpg();
}
function rpgBattleLose() {
  const d = rpgData();
  rpgBLog("…目の前が真っ暗になった。", "bad");
  RPG.mode = "lost";
  rpgSfx("alert"); rpgSave();
  renderMallRpg();
}
function rpgExpNext(lv) { return 12 + lv * lv * 6; }
function rpgCheckLevel() {
  const d = rpgData(); const gained = [];
  while (d.exp >= rpgExpNext(d.lv)) {
    d.exp -= rpgExpNext(d.lv);
    d.lv++;
    d.maxhp += 8; d.maxmp += 4;
    d.hp = d.maxhp; d.mp = d.maxmp;          // レベルアップで全回復
    const learn = RPG_LEARN[d.lv] || [];
    learn.forEach(s => { if (d.skills.indexOf(s) < 0) d.skills.push(s); });
    gained.push({ lv: d.lv, learn });
    if (d.lv > (d.best.lv || 1)) d.best.lv = d.lv;
  }
  return gained;
}
function rpgGrantOutfit(band) {
  if (typeof OUTFITS === "undefined") return null;
  const ranges = { c: [0, 8000], r: [8001, 30000], l: [30001, Infinity] };
  const [lo, hi] = ranges[band] || ranges.c;
  const pool = OUTFITS.filter(o => o.acquire && o.acquire.price != null && o.acquire.price >= lo && o.acquire.price <= hi && !outfitOwned(o));
  if (!pool.length) return null;
  const o = rpgPick(pool);
  if (!state.player.outfitsWon) state.player.outfitsWon = [];
  state.player.outfitsWon.push(o.id);
  rpgSave();
  return o;
}

// ── 戦闘後の遷移
function rpgAfterWin() {
  if (!RPG) return;
  RPG.battle = null; RPG.flash = null; RPG.grace = 1;
  RPG.mode = "explore";
  renderMallRpg();
}
function rpgAfterLose() {
  const d = rpgData();
  d.hp = Math.max(1, Math.floor(d.maxhp * 0.5));   // ソフト：気絶して入口へ（罰は軽め）
  RPG = null; rpgSave();
  renderMallRpg();
}

// =========================================================================
// 休息・店（ハブ）
// =========================================================================
function rpgRest() { const d = rpgData(); d.hp = d.maxhp; d.mp = d.maxmp; rpgSave(); renderMallRpg(); }
function rpgBuy(kind) {
  const d = rpgData();
  const price = kind === "potion" ? 20 : 30;
  if (d.gold < price) return;
  d.gold -= price;
  if (kind === "potion") d.items.potion = (d.items.potion || 0) + 1;
  else d.items.ether = (d.items.ether || 0) + 1;
  rpgSfx("unlock"); rpgSave();
  renderMallRpg();
}

// =========================================================================
// 描画
// =========================================================================
let _rpgKeyBound = false;
function rpgBindKeys() {
  if (_rpgKeyBound) return; _rpgKeyBound = true;
  document.addEventListener("keydown", (e) => {
    if (state.ui.screen !== "mall_rpg" || !RPG || RPG.mode !== "explore") return;
    if (e.key === "ArrowUp") { rpgForward(1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { rpgForward(-1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { rpgTurn(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { rpgTurn(1); e.preventDefault(); }
  });
}

function renderMallRpg(flash) {
  state.ui.screen = "mall_rpg";
  if (window.Dialogue && Dialogue.dismiss) Dialogue.dismiss();
  rpgBindKeys();
  const app = beginScreen();
  if (RPG && RPG.mode === "explore") return rpgRenderExplore(app);
  if (RPG && RPG.mode === "battle") return rpgRenderBattle(app);
  if (RPG && RPG.mode === "won") return rpgRenderWon(app);
  if (RPG && RPG.mode === "lost") return rpgRenderLost(app);
  if (RPG && RPG.mode === "result") return rpgRenderResult(app);
  return rpgRenderHub(app);
}

// ── ハブ
function rpgRenderHub(app) {
  const d = rpgData();
  app.appendChild(el("h2", null, "🗝️ モール地下大迷宮"));
  app.appendChild(el("div", "as-hint2", `モールの地下にひろがる迷宮を探索　<span class="as-hint">レース・コインには影響しません</span>`));
  const st = el("div", "rpg-stats");
  st.innerHTML =
    `<span class="rpg-chip">Lv <b>${d.lv}</b></span>` +
    `<span class="rpg-chip">❤️ ${d.hp}/${d.maxhp}</span>` +
    `<span class="rpg-chip">💧 ${d.mp}/${d.maxmp}</span>` +
    `<span class="rpg-chip">EXP ${d.exp}/${rpgExpNext(d.lv)}</span>` +
    `<span class="rpg-chip">🪙 ${d.gold}G</span>` +
    `<span class="rpg-chip">🧪${d.items.potion || 0} 🔵${d.items.ether || 0}</span>` +
    (d.cleared ? `<span class="rpg-chip win">👑 ボス撃破済</span>` : "");
  app.appendChild(st);

  const go = el("button", "rpg-start", RPG === null && d.cleared ? "🗝️ 迷宮へ もぐる ▶（再挑戦）" : "🗝️ 迷宮へ もぐる ▶");
  go.onclick = () => rpgStartRun();
  app.appendChild(go);

  const row = el("div", "rpg-hubrow");
  const rest = el("button", "rpg-hubbtn", "🛏️ 休む（HP/MP全回復）");
  rest.onclick = () => rpgRest();
  row.appendChild(rest);
  app.appendChild(row);

  const shop = el("div", "rpg-box");
  shop.innerHTML = `<div class="rpg-box-t">🛒 地下の道具屋（ゴールドで購入）</div>`;
  const sg = el("div", "rpg-shopgrid");
  [["potion", "🧪 回復薬", "HP+40", 20], ["ether", "🔵 マナ水", "MP+20", 30]].forEach(([k, n, ds, price]) => {
    const b = el("button", "rpg-shopbtn" + (d.gold >= price ? "" : " off"));
    b.innerHTML = `<b>${n}</b><small>${ds}</small><span class="cost">${price}G</span>`;
    b.disabled = d.gold < price; b.onclick = () => rpgBuy(k);
    sg.appendChild(b);
  });
  shop.appendChild(sg);
  app.appendChild(shop);

  // 魔物図鑑（判明した弱点）
  const codex = el("details", "rpg-codex");
  let rows = "";
  RPG_ENC.concat(["boss1"]).forEach(id => {
    const m = RPG_MONS[id], seen = d.codex[id];
    const w = seen && seen.weak.length ? seen.weak.map(e => RPG_ELEM_IC[e]).join("") : "？";
    rows += `<div class="rpg-codexrow"><span>${m.ic} ${seen ? m.n : "？？？"}</span><span>弱点 ${w}</span></div>`;
  });
  codex.innerHTML = `<summary>📖 魔物図鑑</summary><div class="rpg-codexlist">${rows}</div>`;
  app.appendChild(codex);

  const how = el("details", "rpg-how");
  how.innerHTML = `<summary>📖 遊び方</summary><div>矢印キー or 画面のパッドで迷宮を1歩ずつ進む。<b>魔物の弱点(${RPG_ELEM_IC.fire}火/${RPG_ELEM_IC.ice}氷/${RPG_ELEM_IC.elec}電/${RPG_ELEM_IC.force}力)を突く</b>と「もう1回！」。奥のボスを倒すと衣装GET。倒れても入口に戻るだけ（持ち物は無事）。</div>`;
  app.appendChild(how);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← モールへ戻る"); back.onclick = () => renderMall();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ── 探索（一人称）
function rpgRenderExplore(app) {
  const d = rpgData();
  const head = el("div", "rpg-runhead");
  head.innerHTML =
    `<span class="rpg-chip">Lv${d.lv}</span>` +
    `<span class="rpg-chip">❤️${d.hp}/${d.maxhp}</span>` +
    `<span class="rpg-chip">💧${d.mp}/${d.maxmp}</span>` +
    `<span class="rpg-chip">🪙${d.gold}G</span>` +
    `<span class="rpg-chip">🧭 ${RPG_DIRNAME[RPG.dir]}向き</span>`;
  app.appendChild(head);

  // 一人称ビュー
  const cv = el("canvas", "rpg-view");
  cv.width = 480; cv.height = 300;
  app.appendChild(cv);
  rpgDrawView(cv);

  // ミニマップ
  app.appendChild(rpgMiniMap());

  // ログ
  const lg = el("div", "rpg-log");
  RPG.log.forEach(L => lg.appendChild(el("div", "rpg-logline " + L.cls, L.t)));
  app.appendChild(lg);

  // 操作パッド
  const pad = el("div", "rpg-pad");
  const mk = (lbl, cls, fn) => { const b = el("button", "rpg-padbtn " + cls, lbl); b.onclick = fn; return b; };
  pad.appendChild(mk("↰", "tl", () => rpgTurn(-1)));
  pad.appendChild(mk("▲", "fw", () => rpgForward(1)));
  pad.appendChild(mk("↱", "tr", () => rpgTurn(1)));
  pad.appendChild(mk("←", "lf", () => rpgTurn(-1)));
  pad.appendChild(mk("▼", "bk", () => rpgForward(-1)));
  pad.appendChild(mk("→", "rt", () => rpgTurn(1)));
  app.appendChild(pad);

  const actions = el("div", "actions");
  const leave = el("button", "secondary", "🏠 迷宮を出る"); leave.onclick = () => { RPG = null; renderMallRpg(); };
  actions.appendChild(leave);
  app.appendChild(actions);
}

// グリッド一人称レンダラ（Wizardry風・far→near）
function rpgDrawView(cv) {
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
  const maxD = 4, p = 0.58;
  // 背景（天井/床）
  ctx.fillStyle = "#1a1426"; ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = "#241c30"; ctx.fillRect(0, H / 2, W, H / 2);
  // 各深度の枠
  const rect = [];
  for (let d = 0; d <= maxD; d++) {
    const s = Math.pow(p, d);
    rect[d] = { l: cx - (W / 2) * s, t: cy - (H / 2) * s, r: cx + (W / 2) * s, b: cy + (H / 2) * s };
  }
  const poly = (pts, fill) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke();
  };
  const shade = (depth, kind) => {
    const k = Math.max(0, 1 - depth * 0.18);
    if (kind === "front") return `rgb(${Math.round(120 * k)},${Math.round(96 * k)},${Math.round(150 * k)})`;
    if (kind === "side") return `rgb(${Math.round(86 * k)},${Math.round(70 * k)},${Math.round(112 * k)})`;
    if (kind === "floor") return `rgb(${Math.round(60 * k)},${Math.round(50 * k)},${Math.round(74 * k)})`;
    return `rgb(${Math.round(40 * k)},${Math.round(34 * k)},${Math.round(54 * k)})`; // ceil
  };
  for (let c = maxD; c >= 1; c--) {
    const near = rect[c - 1], far = rect[c];
    if (rpgIsWall(rpgAhead(c, 0))) {
      // 正面の壁（near境界に面を描く）
      poly([[near.l, near.t], [near.r, near.t], [near.r, near.b], [near.l, near.b]], shade(c - 1, "front"));
    } else {
      // 床・天井
      poly([[near.l, near.b], [far.l, far.b], [far.r, far.b], [near.r, near.b]], shade(c, "floor"));
      poly([[near.l, near.t], [far.l, far.t], [far.r, far.t], [near.r, near.t]], shade(c, "ceil"));
      if (rpgIsWall(rpgAhead(c, -1))) poly([[near.l, near.t], [far.l, far.t], [far.l, far.b], [near.l, near.b]], shade(c, "side"));
      if (rpgIsWall(rpgAhead(c, 1))) poly([[near.r, near.t], [far.r, far.t], [far.r, far.b], [near.r, near.b]], shade(c, "side"));
    }
  }
  // 前方の宝箱/出口アイコン
  for (let c = 1; c <= maxD; c++) {
    if (rpgIsWall(rpgAhead(c, 0))) break;
    const ch = rpgAhead(c, 0);
    if (ch === "T" && !RPG.collected[(RPG.px + RPG_DV[RPG.dir][0] * c) + "," + (RPG.py + RPG_DV[RPG.dir][1] * c)]) { rpgDrawIcon(ctx, "📦", rect[c], cx, cy); break; }
    if (ch === "E") { rpgDrawIcon(ctx, rpgData().cleared ? "🚪" : "👹", rect[c], cx, cy); break; }
  }
}
function rpgDrawIcon(ctx, ic, r, cx, cy) {
  const size = Math.max(14, (r.b - r.t) * 0.4);
  ctx.font = size + "px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ic, cx, (r.t + r.b) / 2);
}
function rpgMiniMap() {
  const wrap = el("div", "rpg-mini");
  const cell = 14;
  const cv = el("canvas");
  cv.width = RPG.w * cell; cv.height = RPG.h * cell;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < RPG.h; y++) for (let x = 0; x < RPG.w; x++) {
    const seen = RPG.explored[x + "," + y];
    const c = rpgCell(x, y);
    ctx.fillStyle = !seen ? "#15101f" : (c === "#" ? "#3a2f4d" : (c === "E" ? "#6a4" : (c === "T" ? "#a86" : "#2a2238")));
    ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
  }
  // プレイヤー
  ctx.fillStyle = "#ff5fa2";
  const px = RPG.px * cell + cell / 2, py = RPG.py * cell + cell / 2, f = RPG_DV[RPG.dir];
  ctx.beginPath();
  ctx.moveTo(px + f[0] * 5, py + f[1] * 5);
  ctx.lineTo(px - f[1] * 4 - f[0] * 3, py + f[0] * 4 - f[1] * 3);
  ctx.lineTo(px + f[1] * 4 - f[0] * 3, py - f[0] * 4 - f[1] * 3);
  ctx.closePath(); ctx.fill();
  wrap.appendChild(cv);
  return wrap;
}

// ── 戦闘画面
function rpgRenderBattle(app) {
  const d = rpgData(), b = RPG.battle;
  app.appendChild(el("h2", null, b.boss ? "👹 ボス戦" : "⚔️ 戦闘"));
  // 敵
  const ev = el("div", "rpg-enemies");
  b.enemies.forEach((e, i) => {
    const card = el("button", "rpg-enemy" + (e.alive ? "" : " dead") + (b.target === i ? " sel" : ""));
    const hp = Math.max(0, e.hp), pct = Math.round(hp / e.maxhp * 100);
    const seen = d.codex[e.id];
    const w = seen && seen.weak.length ? seen.weak.map(x => RPG_ELEM_IC[x]).join("") : "弱点？";
    card.innerHTML = `<span class="rpg-enemy-ic">${e.ref.ic}</span><b>${e.ref.n}</b>` +
      `<span class="rpg-hpbar"><span style="width:${pct}%"></span></span>` +
      `<small>${e.alive ? w : "たおした"}</small>`;
    if (e.alive) card.onclick = () => rpgSelectTarget(i);
    ev.appendChild(card);
  });
  app.appendChild(ev);

  // プレイヤーHUD
  const hud = el("div", "rpg-bhud");
  hud.innerHTML = `<span>🧝 ミミ Lv${d.lv}</span><span class="rpg-hpbar big"><span style="width:${Math.round(d.hp / d.maxhp * 100)}%"></span></span>` +
    `<span>❤️${d.hp}/${d.maxhp}</span><span class="rpg-mpbar"><span style="width:${Math.round(d.mp / d.maxmp * 100)}%"></span></span><span>💧${d.mp}/${d.maxmp}</span>`;
  app.appendChild(hud);

  // ログ
  const lg = el("div", "rpg-blog");
  b.log.forEach(L => lg.appendChild(el("div", "rpg-logline " + L.cls, L.t)));
  app.appendChild(lg);

  // コマンド
  const cmd = el("div", "rpg-cmd");
  if (b.phase !== "cmd") {
    cmd.appendChild(el("div", "rpg-wait", "…"));
  } else if (b.sub === "skills") {
    d.skills.forEach(id => {
      const sk = RPG_SKILLS[id];
      const can = d.mp >= sk.mp;
      const btn = el("button", "rpg-cmdbtn" + (can ? "" : " off"));
      btn.innerHTML = `<b>${RPG_ELEM_IC[sk.el]} ${sk.n}</b><small>${sk.el === "heal" ? "回復" : RPG_ELEM[sk.el]}${sk.mp ? " MP" + sk.mp : ""}</small>`;
      btn.disabled = !can; btn.onclick = () => rpgUseSkill(id);
      cmd.appendChild(btn);
    });
    cmd.appendChild(rpgBackBtn());
  } else if (b.sub === "items") {
    [["potion", "🧪 回復薬", d.items.potion || 0], ["ether", "🔵 マナ水", d.items.ether || 0]].forEach(([k, n, q]) => {
      const btn = el("button", "rpg-cmdbtn" + (q > 0 ? "" : " off"));
      btn.innerHTML = `<b>${n}</b><small>×${q}</small>`;
      btn.disabled = q <= 0; btn.onclick = () => rpgUseItem(k);
      cmd.appendChild(btn);
    });
    cmd.appendChild(rpgBackBtn());
  } else {
    const fight = el("button", "rpg-cmdbtn main", "<b>⚔️ たたかう</b><small>スキル</small>"); fight.onclick = () => rpgOpenSkills();
    const item = el("button", "rpg-cmdbtn", "<b>🎒 どうぐ</b><small>回復</small>"); item.onclick = () => rpgOpenItems();
    const flee = el("button", "rpg-cmdbtn", "<b>🏃 にげる</b><small>" + (b.boss ? "不可" : "離脱") + "</small>"); flee.onclick = () => rpgFlee();
    cmd.appendChild(fight); cmd.appendChild(item); cmd.appendChild(flee);
  }
  app.appendChild(cmd);
}
function rpgBackBtn() { const b = el("button", "rpg-cmdbtn back", "<b>↩ もどる</b>"); b.onclick = () => rpgCmdBack(); return b; }

// ── 勝利
function rpgRenderWon(app) {
  const f = RPG.flash || {};
  app.appendChild(el("h2", null, f.boss ? "👑 ボス撃破！" : "🎉 勝利！"));
  const box = el("div", "rpg-resbox good");
  let html = `<div class="rpg-res-l">EXP +${f.exp}　🪙 +${f.gold}G</div>`;
  if (f.ups && f.ups.length) {
    f.ups.forEach(u => { html += `<div class="rpg-res-lv">⬆️ レベル${u.lv}！${u.learn && u.learn.length ? " 新スキル「" + u.learn.map(s => RPG_SKILLS[s].n).join("・") + "」を覚えた！" : ""}</div>`; });
  }
  if (f.outfit) html += `<div class="rpg-res-outfit">👑 衣装「${f.outfit.name}」を手に入れた！ モールで着られるよ</div>`;
  box.innerHTML = html;
  app.appendChild(box);
  const cont = el("button", "rpg-start", "▶ 探索を続ける");
  cont.onclick = () => rpgAfterWin();
  app.appendChild(cont);
}
// ── 敗北
function rpgRenderLost(app) {
  app.appendChild(el("h2", null, "💫 気絶…"));
  app.appendChild(el("div", "rpg-resbox bad", `目が覚めたら迷宮の入口だった。<br>（持ち物・ゴールドは無事。HPは半分回復）`));
  const cont = el("button", "rpg-start", "▶ 入口にもどる");
  cont.onclick = () => rpgAfterLose();
  app.appendChild(cont);
}
// ── 出口
function rpgRenderResult(app) {
  app.appendChild(el("h2", null, "🚪 迷宮をあとにした"));
  app.appendChild(el("div", "rpg-resbox good", "またいつでももぐれる。お疲れさま！"));
  const cont = el("button", "rpg-start", "← 入口へ");
  cont.onclick = () => { RPG = null; renderMallRpg(); };
  app.appendChild(cont);
}
