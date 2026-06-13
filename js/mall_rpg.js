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
  if (d.tickets == null) d.tickets = 2;              // ガチャチケット
  if (!d.records) d.records = { lv: d.lv || 1, floor: d.best.floor || 0, combo: 0, score: 0, pulls: 0 };
  if (d.daily == null) d.daily = "";                 // 最終ログボ受取日
  return d;
}
function rpgToday() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "x"; } }
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

// ── 状態異常（ミミにかかる・戦闘中のみ。回復薬で全快）
const RPG_STATUS = {
  stun:    { ic: "💫", n: "めまい",   d: "1ターン動けない" },
  defdown: { ic: "😵", n: "ぐったり", d: "受けるダメージ↑" },
  dazzle:  { ic: "✨", n: "チカチカ", d: "たまに攻撃を外す" },
  seal:    { ic: "🍙", n: "まんぷく", d: "MP技が出せない" },
};

// ── 敵キャラ（★浮かれた観光客が多数・モンスターは少数）
const RPG_MONS = {
  // 🎫 浮かれた観光客（メイン）
  baku:     { n: "爆買いツアー客", ic: "🛍️", kind: "tourist", hp: 18, atk: 6, exp: 7, gold: 12, weak: ["elec"], resist: [], nul: [], el: "phys", act: "両手いっぱいの紙袋がぶつかった！", sp: { name: "紙袋ラッシュ", status: "defdown", dur: 3, chance: 0.3, msg: "ぐったりして守りが下がった…" } },
  selfie:   { n: "自撮り女子",     ic: "🤳", kind: "tourist", hp: 14, atk: 6, exp: 6, gold: 9,  weak: ["force"], resist: [], nul: [], el: "phys", act: "自撮り棒がビュンと飛んできた！", sp: { name: "フラッシュ撮影", status: "dazzle", dur: 2, chance: 0.35, msg: "目がチカチカする…！" } },
  gourmet:  { n: "食べ歩き勢",     ic: "🍢", kind: "tourist", hp: 20, atk: 7, exp: 8, gold: 10, weak: ["ice"], resist: [], nul: [], el: "fire", act: "アツアツたこ焼きを口に押し込んできた！", sp: { name: "おすそわけ攻め", status: "seal", dur: 2, chance: 0.3, msg: "おなかいっぱいで技が出せない！" } },
  stroller: { n: "ベビーカー隊",   ic: "👶", kind: "tourist", hp: 24, atk: 7, exp: 9, gold: 11, weak: ["phys"], resist: ["force"], nul: [], el: "phys", act: "ベビーカーで猛突進！" },
  oldies:   { n: "団体のおば様",   ic: "📷", kind: "tourist", hp: 22, atk: 6, exp: 9, gold: 14, weak: ["fire"], resist: [], nul: [], el: "phys", act: "おしゃべりの渦に巻き込んできた！", sp: { name: "質問ぜめ", status: "stun", dur: 1, chance: 0.28, msg: "話につかまって動けない！" } },
  kid:      { n: "はぐれっ子",     ic: "🧒", kind: "tourist", hp: 10, atk: 5, exp: 5, gold: 6,  weak: ["fire", "ice", "elec", "force"], resist: [], nul: [], el: "phys", act: "泣きわめいて気をひいてきた！" },
  // 👾 モンスター（少数）
  slime:    { n: "マヨイスライム", ic: "🟢", kind: "monster", hp: 20, atk: 7, exp: 9, gold: 10, weak: ["fire"], resist: ["ice"], nul: [], el: "phys", act: "ベタベタ体当たり！" },
  mannequin:{ n: "うごくマネキン", ic: "🤖", kind: "monster", hp: 28, atk: 9, exp: 14, gold: 16, weak: ["elec"], resist: ["phys"], nul: [], el: "phys", act: "マネキンチョップ！" },
  // 🎡 ボス（屋上）
  boss1:    { n: "観覧車ゴーレム", ic: "🎡", kind: "monster", hp: 110, atk: 13, exp: 80, gold: 200, weak: ["elec"], resist: ["fire", "ice"], nul: [], el: "phys", boss: true, act: "巨大ゴンドラが回転しながら突撃！", sp: { name: "大回転プレス", status: "defdown", dur: 3, chance: 0.4, msg: "おしつぶされて守りが下がった…", dmg: true } },
};
const RPG_TOURISTS = ["baku", "selfie", "gourmet", "stroller", "oldies", "kid"];
const RPG_MONSTERS_MINOR = ["slime", "mannequin"];

// ── 迷宮マップ（# 壁 / . 床 / S 入口 / T 宝 / F=上り階段 or ボス出口）。
// 連結確認済みの基本形を回転/反転して各フロアに展開（変形は連結性を保つ）。
const RPG_BASE = [
  "#########",
  "#S......#",
  "#.#####.#",
  "#.#.T.#.#",
  "#.#.#.#.#",
  "#.#.#...#",
  "#.#.###.#",
  "#...#..F#",
  "#########",
];
// 島のリゾートモール・1F→屋上。far: U=上り階段 / E=ボス(屋上)。accent=フロアのテーマ色
const RPG_FLOORS = [
  { name: "1F 🏖️ ビーチサイド",    t: "id",        far: "U", accent: [38, 196, 176] },
  { name: "2F 🏊 プールデッキ",    t: "mirrorH",   far: "U", accent: [64, 176, 235] },
  { name: "3F 🍹 南国グルメ横丁",  t: "mirrorV",   far: "U", accent: [255, 140, 90] },
  { name: "4F 🐬 マリンアドベンチャー", t: "rot180", far: "U", accent: [40, 130, 210] },
  { name: "🌅 屋上サンセットテラス", t: "transpose", far: "E", accent: [255, 120, 150], sky: true },
];
function rpgTransform(base, kind) {
  const m = base.map(r => r.split("")), n = m.length;
  let o;
  if (kind === "mirrorH") o = m.map(row => row.slice().reverse());
  else if (kind === "mirrorV") o = m.slice().reverse();
  else if (kind === "rot180") o = m.slice().reverse().map(row => row.slice().reverse());
  else if (kind === "transpose") { o = []; for (let x = 0; x < n; x++) { o[x] = []; for (let y = 0; y < n; y++) o[x][y] = m[y][x]; } }
  else o = m.map(row => row.slice());
  return o.map(row => row.join(""));
}
function rpgBuildFloor(i) {
  const meta = RPG_FLOORS[i];
  return rpgTransform(RPG_BASE, meta.t).map(r => r.replace("F", meta.far));
}
const RPG_DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W
const RPG_DIRNAME = ["北", "東", "南", "西"];

// ── 探索の開始
function rpgStartRun() {
  RPG = {
    fi: 0, map: [], w: 9, h: 9, px: 1, py: 1, dir: 1,
    mode: "explore", steps: 0, grace: 1,
    explored: {}, collected: {},
    log: [], battle: null, flash: null,
  };
  rpgLoadFloor(0);
  rpgLog("🛗 巨大モールの探検へ！ 屋上をめざそう！", "good");
  renderMallRpg();
}
// フロア読み込み（fi=フロア番号）
function rpgLoadFloor(i) {
  RPG.fi = i;
  RPG.map = rpgBuildFloor(i).map(r => r.split(""));
  RPG.w = RPG.map[0].length; RPG.h = RPG.map.length;
  let sx = 1, sy = 1;
  for (let y = 0; y < RPG.h; y++) for (let x = 0; x < RPG.w; x++) if (RPG.map[y][x] === "S") { sx = x; sy = y; }
  RPG.px = sx; RPG.py = sy; RPG.dir = 1;
  RPG.explored = {}; RPG.explored[sx + "," + sy] = 1;
  const d = rpgData();
  if (d.best.floor == null || i > d.best.floor) { d.best.floor = i; rpgSave(); }
}
// 上り階段（エレベーター演出）
function rpgGoUp() {
  if (RPG.fi + 1 >= RPG_FLOORS.length) { renderMallRpg(); return; }
  RPG.busy = true; rpgSfx("nav");
  rpgFx.cover("elev", 760, () => {
    rpgLoadFloor(RPG.fi + 1);
    rpgLog(`🛗 ${RPG_FLOORS[RPG.fi].name} に上ってきた！`, "good");
    RPG.busy = false;
    renderMallRpg();
  });
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
  if (!RPG || RPG.mode !== "explore" || RPG.busy) return;
  RPG.dir = (RPG.dir + d + 4) % 4;
  rpgSfx("tick");
  renderMallRpg();
}
function rpgForward(sign) {
  if (!RPG || RPG.mode !== "explore" || RPG.busy) return;
  const f = RPG_DV[RPG.dir];
  const nx = RPG.px + f[0] * sign, ny = RPG.py + f[1] * sign;
  if (rpgIsWall(rpgCell(nx, ny))) { rpgLog("🧱 壁だ。", ""); renderMallRpg(); return; }
  RPG.px = nx; RPG.py = ny; RPG.steps++;
  RPG.explored[nx + "," + ny] = 1;
  rpgSfx("tick");
  const here = rpgCell(nx, ny);
  if (here === "T") { rpgTreasure(nx, ny); return; }
  if (here === "U") { rpgGoUp(); return; }
  if (here === "E") { rpgReachExit(); return; }
  // ランダムエンカウント
  if (RPG.grace > 0) RPG.grace--;
  else if (Math.random() < 0.22) { rpgEncounter(); return; }
  renderMallRpg();
}
function rpgTreasure(x, y) {
  const key = RPG.fi + ":" + x + "," + y;
  if (RPG.collected[key]) { rpgLog("📦 からっぽの宝箱だ。", ""); renderMallRpg(); return; }
  RPG.collected[key] = 1;
  rpgLog("📦 宝箱を見つけた！ なにが出るかな…", "good");
  rpgChestPull(x, y, RPG.fi * 0.12);     // 上の階ほどレア度UP
}
function rpgReachExit() {
  const d = rpgData();
  if (!d.cleared) { rpgEncounter(true); return; }   // 初回はボス戦
  RPG.mode = "result"; renderMallRpg();
}

// =========================================================================
// 戦闘
// =========================================================================
// ── 演出（FXレイヤーは body 直下＝画面再描画に影響されない）
const rpgFx = {
  layer() { let l = document.getElementById("rpg-fx"); if (!l) { l = document.createElement("div"); l.id = "rpg-fx"; document.body.appendChild(l); } return l; },
  at(elm, text, cls) { if (!elm) return; const r = elm.getBoundingClientRect(); const n = document.createElement("div"); n.className = "rpg-fxnum " + (cls || ""); n.textContent = text; n.style.left = (r.left + r.width / 2) + "px"; n.style.top = (r.top + r.height * 0.4) + "px"; this.layer().appendChild(n); setTimeout(() => n.remove(), 950); },
  banner(text, cls) { const n = document.createElement("div"); n.className = "rpg-fxbanner " + (cls || ""); n.textContent = text; this.layer().appendChild(n); setTimeout(() => n.remove(), 950); },
  hit(elm) { if (!elm) return; elm.classList.remove("rpg-hit"); void elm.offsetWidth; elm.classList.add("rpg-hit"); },
  shakeApp() { const a = document.getElementById("app"); if (!a) return; a.classList.remove("rpg-shake"); void a.offsetWidth; a.classList.add("rpg-shake"); setTimeout(() => a.classList.remove("rpg-shake"), 420); },
  flash(cls) { const n = document.createElement("div"); n.className = "rpg-fxflash " + (cls || ""); this.layer().appendChild(n); setTimeout(() => n.remove(), 520); },
  cover(cls, ms, cb) { const n = document.createElement("div"); n.className = "rpg-fxcover " + (cls || ""); this.layer().appendChild(n); if (cb) setTimeout(cb, ms * 0.45); setTimeout(() => n.remove(), ms); },
};
function rpgEnemyEl(i) { return document.getElementById("rpg-enemy-" + i); }
function rpgPlayerEl() { return document.getElementById("rpg-bhud"); }

function rpgEncounter(boss) {
  let ids;
  if (boss) ids = ["boss1"];
  else {
    const n = Math.random() < 0.45 ? 2 : 1;
    ids = []; for (let i = 0; i < n; i++) ids.push(Math.random() < 0.82 ? rpgPick(RPG_TOURISTS) : rpgPick(RPG_MONSTERS_MINOR));
  }
  const sc = 1 + RPG.fi * 0.22, scR = 1 + RPG.fi * 0.3;   // 上の階ほど手応えUP
  const enemies = ids.map(id => {
    const m = RPG_MONS[id];
    const hp = boss ? m.hp : Math.round(m.hp * sc);
    return { id, ref: m, hp, maxhp: hp, alive: true,
      atk: boss ? m.atk : Math.round(m.atk * sc), exp: Math.round(m.exp * scR), gold: Math.round(m.gold * scR) };
  });
  RPG.battle = { enemies, target: 0, extra: false, acts: 1, combo: 0, log: [], boss: !!boss, phase: "cmd", sub: null,
    pstatus: { stun: 0, defdown: 0, dazzle: 0, seal: 0 } };
  RPG.mode = "battle"; RPG.busy = false;
  rpgBLog(boss ? `🎡 ${enemies[0].ref.n} が立ちはだかった！` : `🎫 ${enemies.map(e => e.ref.n).join("・")} に囲まれた！`);
  rpgSfx("alert");
  rpgFx.cover("enc", 520);            // エンカウント・フラッシュ
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
  if (!RPG || RPG.mode !== "battle" || RPG.busy) return;
  if (RPG.battle.enemies[i] && RPG.battle.enemies[i].alive) { RPG.battle.target = i; renderMallRpg(); }
}
function rpgOpenSkills() { if (RPG && RPG.battle && RPG.battle.phase === "cmd" && !RPG.busy) { RPG.battle.sub = "skills"; renderMallRpg(); } }
function rpgOpenItems() { if (RPG && RPG.battle && RPG.battle.phase === "cmd" && !RPG.busy) { RPG.battle.sub = "items"; renderMallRpg(); } }
function rpgCmdBack() { if (RPG && RPG.battle && !RPG.busy) { RPG.battle.sub = null; renderMallRpg(); } }

function rpgUseSkill(id) {
  const b = RPG.battle, d = rpgData(), sk = RPG_SKILLS[id];
  if (!b || b.phase !== "cmd" || RPG.busy || !sk) return;
  if (sk.mp > 0 && b.pstatus.seal > 0) { rpgBLog("🍙 おなかいっぱいで技が出せない！", ""); renderMallRpg(); return; }
  if (d.mp < sk.mp) { rpgBLog("MPが足りない！", ""); renderMallRpg(); return; }
  b.sub = null;
  // ✨チカチカ：攻撃がたまに外れる（回復はミスしない・MPは消費しない）
  if (sk.el !== "heal" && b.pstatus.dazzle > 0 && Math.random() < 0.3) {
    rpgBLog("✨ 目がチカチカして攻撃を外した！", "");
    rpgFx.banner("MISS", "miss");
    RPG.busy = true; b.phase = "anim"; rpgSave();
    setTimeout(() => rpgAfterAct(false), 380);
    return;
  }
  d.mp -= sk.mp;
  if (sk.el === "heal") {
    const h = sk.heal + d.lv * 2;
    d.hp = Math.min(d.maxhp, d.hp + h);
    rpgBLog(`💚 ${sk.n}！ HPが${h}回復した。`, "good");
    rpgSfx("unlock");
    RPG.busy = true; b.phase = "anim";
    rpgFx.at(rpgPlayerEl(), "+" + h, "heal"); rpgFx.flash("heal");
    rpgSave();
    setTimeout(() => rpgAfterAct(false), 440);
    return;
  }
  // 攻撃
  let tgt = b.enemies[b.target];
  if (!tgt || !tgt.alive) tgt = rpgAliveEnemies()[0];
  if (!tgt) { rpgAfterAct(false); return; }
  const ti = b.enemies.indexOf(tgt);
  const mult = rpgMult(tgt.ref, sk.el);
  let weakHit = false;
  if (mult === 0) {
    rpgBLog(`${RPG_ELEM_IC[sk.el]} ${sk.n}！ …${tgt.ref.n}には効かない！`, "");
    rpgSfx("tick"); rpgFx.at(rpgEnemyEl(ti), "NULL", "nullx");
  } else {
    const dmg = Math.max(1, Math.round((sk.pow + rpgPlayerPow() * 0.6) * mult * rpgRnd(0.9, 1.1)));
    tgt.hp -= dmg;
    let tag = "";
    if (mult >= 1.9) { weakHit = true; tag = " 弱点!"; b.combo = (b.combo || 0) + 1; if (rpgCodexLearn(tgt.id, sk.el)) rpgBLog(`📖 ${tgt.ref.n}の弱点「${RPG_ELEM[sk.el]}」を見つけた！`, "good"); }
    else if (mult === 0.5) tag = " 耐性…";
    rpgBLog(`${RPG_ELEM_IC[sk.el]} ${sk.n}！ ${tgt.ref.n}に${dmg}ダメージ${tag}`, weakHit ? "good" : "");
    rpgSfx(weakHit ? "win" : "tick");
    const eel = rpgEnemyEl(ti);
    rpgFx.hit(eel); rpgFx.at(eel, "-" + dmg, weakHit ? "weak" : (mult === 0.5 ? "resist" : "dmg"));
    if (weakHit) rpgFx.banner("WEAK!", "weak");
    if (tgt.hp <= 0) {
      tgt.alive = false; b.combo = (b.combo || 0) + 1;
      const tourist = tgt.ref.kind === "tourist";
      rpgBLog(`${tourist ? "😌" : "💥"} ${tgt.ref.n}${tourist ? "は満足して帰っていった！" : "を倒した！"}`, "good");
    }
    if ((b.combo || 0) >= 3) rpgFx.banner("COMBO ×" + b.combo, "more");
  }
  RPG.busy = true; b.phase = "anim"; rpgSave();
  setTimeout(() => rpgAfterAct(weakHit), 540);
}
function rpgUseItem(kind) {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy) return;
  let fx = null;
  if (kind === "potion") {
    if ((d.items.potion || 0) <= 0) return;
    d.items.potion--; d.hp = Math.min(d.maxhp, d.hp + 40);
    const had = b.pstatus.stun || b.pstatus.defdown || b.pstatus.dazzle || b.pstatus.seal;
    b.pstatus.stun = b.pstatus.defdown = b.pstatus.dazzle = b.pstatus.seal = 0;
    rpgBLog("🧪 回復薬！ HP+40。" + (had ? "（状態もすっきり！）" : ""), "good"); fx = "+40";
  } else if (kind === "ether") {
    if ((d.items.ether || 0) <= 0) return;
    d.items.ether--; d.mp = Math.min(d.maxmp, d.mp + 20);
    rpgBLog("🔵 マナ水！ MP+20。", "good"); fx = "MP+20";
  } else return;
  b.sub = null; rpgSfx("unlock");
  RPG.busy = true; b.phase = "anim";
  if (fx) { rpgFx.at(rpgPlayerEl(), fx, "heal"); rpgFx.flash("heal"); }
  rpgSave();
  setTimeout(() => rpgAfterAct(false), 440);
}
function rpgFlee() {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy) return;
  if (b.boss) { rpgBLog("ボスからは逃げられない！", ""); rpgFx.banner("逃げられない！", "bad"); renderMallRpg(); return; }
  RPG.busy = true;
  if (Math.random() < 0.5 + d.lv * 0.02) {
    rpgBLog("🏃 うまく逃げ切った！", "good");
    RPG.battle = null; RPG.mode = "explore"; RPG.grace = 2; RPG.busy = false;
    renderMallRpg();
  } else {
    rpgBLog("逃げられなかった…！", "");
    b.phase = "anim"; renderMallRpg();
    setTimeout(() => rpgEnemyTurn(), 360);
  }
}
// プレイヤー1行動の締め（weakHit=弱点ヒットしたか）。弱点で+1行動（最大3）。
function rpgAfterAct(weakHit) {
  if (!RPG || !RPG.battle) return;
  const b = RPG.battle;
  if (rpgAliveEnemies().length === 0) { rpgBattleWin(); return; }
  if (weakHit && (b.acts || 1) < 3) { b.acts = (b.acts || 1) + 1; rpgFx.banner("1 MORE!", "more"); rpgBLog("✨ 弱点を突いた！ もう1回！", "good"); }
  b.acts = (b.acts || 1) - 1;
  if (b.acts > 0) { b.phase = "cmd"; RPG.busy = false; rpgSave(); renderMallRpg(); return; }
  rpgEnemyTurn();
}
// 敵ターン＝1体ずつ順番に演出
function rpgEnemyTurn() {
  if (!RPG || !RPG.battle) return;
  const b = RPG.battle;
  b.phase = "enemy"; RPG.busy = true; b.sub = null;
  rpgSave(); renderMallRpg();                 // 敵HPを反映＆コマンドを隠す
  b._eq = rpgAliveEnemies().slice();
  setTimeout(() => rpgEnemyStep(0), 360);
}
function rpgEnemyStep(idx) {
  if (!RPG || !RPG.battle || RPG.mode !== "battle") return;
  const b = RPG.battle, d = rpgData(), list = b._eq || [];
  if (idx >= list.length) { rpgSave(); rpgToPlayer(); return; }
  const e = list[idx];
  if (!e.alive) { rpgEnemyStep(idx + 1); return; }
  const dmgMult = b.pstatus.defdown > 0 ? 1.5 : 1;   // 😵ぐったり＝被ダメUP
  const sp = e.ref.sp; let dealt = 0, applied = null;
  if (sp && Math.random() < sp.chance) {
    b.pstatus[sp.status] = Math.max(b.pstatus[sp.status] || 0, sp.dur); applied = sp.status;
    let line = `${e.ref.ic} ${sp.name}！ ${RPG_STATUS[sp.status].ic}${sp.msg}`;
    if (sp.dmg) { dealt = Math.max(1, Math.round((e.atk || e.ref.atk) * 0.8 * dmgMult * rpgRnd(0.85, 1.15) - Math.floor(d.lv * 0.6))); d.hp -= dealt; line += ` ${dealt}ダメージ。`; }
    rpgBLog(line, "bad");
  } else {
    dealt = Math.max(1, Math.round((e.atk || e.ref.atk) * dmgMult * rpgRnd(0.85, 1.15) - Math.floor(d.lv * 0.6)));
    d.hp -= dealt;
    rpgBLog(`${e.ref.ic} ${e.ref.act || (e.ref.n + "の攻撃！")} ${dealt}ダメージ。`, "bad");
  }
  if (dealt > 0) { b.combo = 0; rpgFx.at(rpgPlayerEl(), "-" + dealt, "pdmg"); rpgFx.shakeApp(); rpgFx.flash("hurt"); rpgSfx("tick"); }
  if (applied) rpgFx.banner(RPG_STATUS[applied].ic + " " + RPG_STATUS[applied].n + "！", "bad");
  if (d.hp <= 0) { d.hp = 0; setTimeout(() => rpgBattleLose(), 520); return; }
  setTimeout(() => rpgEnemyStep(idx + 1), 540);
}
// 敵ターン後→プレイヤーへ（状態の持続処理＋めまいで行動スキップ）
function rpgToPlayer() {
  const b = RPG.battle;
  ["defdown", "dazzle", "seal"].forEach(k => { if (b.pstatus[k] > 0) b.pstatus[k]--; });
  b.sub = null;
  if (b.pstatus.stun > 0) {
    b.pstatus.stun--; b.phase = "wait"; RPG.busy = true;
    rpgBLog("💫 目がまわって動けない！", "bad"); rpgFx.banner("💫 めまい…", "bad");
    rpgSave(); renderMallRpg();
    setTimeout(() => { if (RPG && RPG.battle && RPG.mode === "battle") rpgEnemyTurn(); }, 900);
    return;
  }
  b.phase = "cmd"; b.acts = 1; RPG.busy = false;
  rpgSave(); renderMallRpg();
}
function rpgBattleWin() {
  const b = RPG.battle, d = rpgData();
  let exp = 0, gold = 0;
  b.enemies.forEach(e => { exp += (e.exp || e.ref.exp); gold += (e.gold || e.ref.gold); });
  const combo = b.combo || 0, cmult = 1 + Math.min(combo, 25) * 0.06;
  exp = Math.round(exp * cmult); gold = Math.round(gold * cmult);
  d.exp += exp; d.gold += gold;
  if (combo > (d.records.combo || 0)) d.records.combo = combo;
  rpgBLog(`🎉 勝利！ EXP+${exp}・ゴールド+${gold}` + (combo >= 2 ? `（COMBO×${combo}・報酬+${Math.round((cmult - 1) * 100)}%）` : ""), "win");
  // ボス：図鑑クリア＋衣装ドロップ
  let outfit = null;
  if (b.boss) {
    d.cleared = true;
    outfit = rpgGrantOutfit("r") || rpgGrantOutfit("c");
    if (outfit) rpgBLog(`👑 屋上制覇！ ごほうびの衣装「${outfit.name}」を手に入れた！`, "win");
  } else if (Math.random() < 0.06) {
    outfit = rpgGrantOutfit("c");
    if (outfit) rpgBLog(`👑 魔物が衣装「${outfit.name}」を落とした！`, "win");
  }
  // レベルアップ判定
  const ups = rpgCheckLevel();
  RPG.mode = "won"; RPG.busy = false;
  RPG.flash = { exp, gold, ups, outfit, boss: b.boss, combo };
  rpgBumpRecords();
  rpgSfx("win"); rpgSave();
  rpgFx.banner(b.boss ? "👑 CLEAR!" : "VICTORY!", "victory");
  if (combo >= 5) setTimeout(() => rpgFx.banner("COMBO ×" + combo + "!", "more"), 360);
  if (ups.length) setTimeout(() => rpgFx.banner("LEVEL UP!", "levelup"), 620);
  renderMallRpg();
}
function rpgBattleLose() {
  const d = rpgData();
  rpgBLog("…目の前が真っ暗になった。", "bad");
  RPG.mode = "lost"; RPG.busy = false;
  rpgSfx("alert"); rpgSave();
  rpgFx.banner("DOWN…", "down");
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
  if (RPG_REVEAL) return rpgRenderReveal(app);          // ガチャ/宝箱の演出は最優先
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
  app.appendChild(el("h2", null, "🏝️ 島のリゾートモール大冒険"));
  // 動くリゾート背景（空・太陽・雲・ヤシ・波）
  const resort = el("div", "rpg-resort");
  resort.innerHTML =
    `<div class="rpg-sun"></div>` +
    `<div class="rpg-cloud c1">☁️</div><div class="rpg-cloud c2">⛅</div><div class="rpg-cloud c3">☁️</div>` +
    `<div class="rpg-bird b1">🕊️</div><div class="rpg-bird b2">🕊️</div>` +
    `<div class="rpg-palm pl">🌴</div><div class="rpg-palm pr">🌴</div>` +
    `<div class="rpg-beach"></div><div class="rpg-sea"></div>` +
    `<div class="rpg-resort-cap">🌊 ビーチサイドから🌅サンセットテラスまで、潜って遊んでおたから集め！</div>`;
  app.appendChild(resort);
  app.appendChild(el("div", "as-hint2", `<span class="as-hint">レース・コインには影響しません（ダンジョン内だけの遊び）</span>`));
  const st = el("div", "rpg-stats");
  st.innerHTML =
    `<span class="rpg-chip">Lv <b>${d.lv}</b></span>` +
    `<span class="rpg-chip">❤️ ${d.hp}/${d.maxhp}</span>` +
    `<span class="rpg-chip">💧 ${d.mp}/${d.maxmp}</span>` +
    `<span class="rpg-chip">🪙 ${d.gold}G</span>` +
    `<span class="rpg-chip gacha">🎟️ ${d.tickets || 0}</span>` +
    `<span class="rpg-chip">🧪${d.items.potion || 0} 🔵${d.items.ether || 0}</span>` +
    (d.cleared ? `<span class="rpg-chip win">🌿 屋上制覇</span>` : "");
  app.appendChild(st);

  // ベスト記録（中毒性＝自己ベスト更新）
  const rec = d.records || {};
  const rc = el("div", "rpg-records");
  rc.innerHTML =
    `<div class="rpg-rec"><small>ベストスコア</small><b>${rec.score || 0}</b></div>` +
    `<div class="rpg-rec"><small>最高Lv</small><b>${rec.lv || d.lv}</b></div>` +
    `<div class="rpg-rec"><small>最高到達</small><b>${rec.floor != null ? RPG_FLOORS[Math.min(rec.floor, RPG_FLOORS.length - 1)].name.replace(/ .*/, "") : "—"}</b></div>` +
    `<div class="rpg-rec"><small>最大コンボ</small><b>×${rec.combo || 0}</b></div>`;
  app.appendChild(rc);

  // デイリー・ログインボーナス
  if (d.daily !== rpgToday()) {
    const dl = el("button", "rpg-daily", "🎁 本日のログインボーナスを受け取る（🎟️＋おまけ）");
    dl.onclick = () => rpgClaimDaily();
    app.appendChild(dl);
  }

  const go = el("button", "rpg-start", d.cleared ? "🏬 1Fから冒険する ▶（再挑戦）" : "🏬 1Fから冒険する ▶");
  go.onclick = () => rpgStartRun();
  app.appendChild(go);

  // 🎰 ガチャ（射幸性）
  const gacha = el("div", "rpg-box gacha-box");
  gacha.innerHTML = `<div class="rpg-box-t">🎰 おたからガチャ <span class="rpg-gacha-rates">伝説0.7% / 激レア2.8% / SR9.5%</span></div>`;
  const gg = el("div", "rpg-gachagrid");
  const g1 = el("button", "rpg-gachabtn" + ((d.tickets || 0) >= 1 ? " ready" : " off"));
  g1.innerHTML = `<b>🎟️ 1回</b><small>チケット×1</small>`;
  g1.disabled = (d.tickets || 0) < 1; g1.onclick = () => rpgGachaPull(1);
  const g10 = el("button", "rpg-gachabtn gold10" + ((d.gold || 0) >= 280 ? " ready" : " off"));
  g10.innerHTML = `<b>💎 10連</b><small>280G・SR以上確定</small>`;
  g10.disabled = (d.gold || 0) < 280; g10.onclick = () => rpgGachaPull(10);
  gg.appendChild(g1); gg.appendChild(g10);
  gacha.appendChild(gg);
  app.appendChild(gacha);

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

  // 図鑑（判明した弱点）
  const codex = el("details", "rpg-codex");
  let rows = "";
  RPG_TOURISTS.concat(RPG_MONSTERS_MINOR, ["boss1"]).forEach(id => {
    const m = RPG_MONS[id], seen = d.codex[id];
    const w = seen && seen.weak.length ? seen.weak.map(e => RPG_ELEM_IC[e]).join("") : "？";
    rows += `<div class="rpg-codexrow"><span>${m.ic} ${seen ? m.n : "？？？"}</span><span>弱点 ${w}</span></div>`;
  });
  codex.innerHTML = `<summary>📖 すれちがい図鑑</summary><div class="rpg-codexlist">${rows}</div>`;
  app.appendChild(codex);

  const how = el("details", "rpg-how");
  how.innerHTML = `<summary>📖 遊び方</summary><div>矢印キー or 画面のパッドでモールを1歩ずつ進み、<b>🛗階段で上の階へ</b>。<b>浮かれた観光客</b>や時々まぎれる👾モンスターと戦い、<b>弱点(${RPG_ELEM_IC.fire}火/${RPG_ELEM_IC.ice}氷/${RPG_ELEM_IC.elec}電/${RPG_ELEM_IC.force}力)を突く</b>と「もう1回！」。<b>🌿屋上のボスを倒すと衣装GET</b>。倒れても入口に戻るだけ（持ち物は無事）。</div>`;
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
    `<span class="rpg-chip win">🏬 ${RPG_FLOORS[RPG.fi].name}</span>` +
    `<span class="rpg-chip">Lv${d.lv}</span>` +
    `<span class="rpg-chip">❤️${d.hp}/${d.maxhp}</span>` +
    `<span class="rpg-chip">💧${d.mp}/${d.maxmp}</span>` +
    `<span class="rpg-chip">🪙${d.gold}G</span>` +
    `<span class="rpg-chip">🧭 ${RPG_DIRNAME[RPG.dir]}向き</span>`;
  app.appendChild(head);

  // 一人称ビュー（低解像＝ドット感、CSSでpixelated拡大）＋アンビエント・アニメ
  const cv = el("canvas", "rpg-view");
  cv.width = 240; cv.height = 150;
  app.appendChild(cv);
  rpgDrawView(cv, (typeof performance !== "undefined" ? performance.now() : 0));
  rpgStartAmbient(cv);

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

// グリッド一人称レンダラ（明るいモール風・店先/ガラス/天窓/つや床）
function rpgMallPalette(fi) {
  const fl = RPG_FLOORS[fi] || {}, A = fl.accent || [200, 120, 160], sky = fl.sky, WH = [255, 255, 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return {
    floor: [208, 202, 192], grout: [176, 168, 156],
    ceil: sky ? [150, 198, 228] : [234, 236, 238], light: [253, 251, 244],
    wall: [233, 231, 225], glass: mix(A, WH, 0.6), sign: A, kick: [160, 154, 146], trim: [120, 114, 106],
  };
}
function rpgDrawView(cv, t) {
  t = t || 0; const ph = t / 1000;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, maxD = 4, p = 0.58;
  const P = rpgMallPalette(RPG.fi);
  const sunset = !!(RPG_FLOORS[RPG.fi] && RPG_FLOORS[RPG.fi].sky);
  const col = (rgb, k) => `rgb(${Math.round(Math.min(255, rgb[0] * k))},${Math.round(Math.min(255, rgb[1] * k))},${Math.round(Math.min(255, rgb[2] * k))})`;
  const sh = d => Math.max(0.6, 1 - d * 0.085);
  const rect = [];
  for (let d = 0; d <= maxD; d++) { const s = Math.pow(p, d); rect[d] = { l: cx - (W / 2) * s, t: cy - (H / 2) * s, r: cx + (W / 2) * s, b: cy + (H / 2) * s }; }
  const yN = (r, f) => r.t + f * (r.b - r.t), xN = (r, f) => r.l + f * (r.r - r.l);
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const line = (x0, y0, x1, y1, c) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke(); };
  const rectXY = (x0, y0, x1, y1, c) => { ctx.fillStyle = c; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); };
  // 明るい背景
  ctx.fillStyle = col(P.ceil, 0.9); ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = col(P.floor, 0.66); ctx.fillRect(0, H / 2, W, H / 2);
  // 🌊 海の見える窓（波が動く）
  const oceanWindow = (x0, y0, x1, y1, k) => {
    const midY = y0 + (y1 - y0) * 0.5;
    ctx.fillStyle = col(sunset ? [255, 184, 122] : [150, 208, 236], k); ctx.fillRect(x0, y0, x1 - x0, midY - y0);
    ctx.fillStyle = col(sunset ? [86, 120, 184] : [46, 152, 202], k); ctx.fillRect(x0, midY, x1 - x0, y1 - midY);
    const scx = x0 + (x1 - x0) * 0.72, scy = y0 + (y1 - y0) * 0.22, sr = Math.max(2, (x1 - x0) * 0.11);
    ctx.fillStyle = col(sunset ? [255, 156, 92] : [255, 246, 206], k); ctx.beginPath(); ctx.arc(scx, scy, sr, 0, 7); ctx.fill();
    ctx.strokeStyle = col([255, 255, 255], k * 0.85); ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const wy = midY + (y1 - midY) * (0.28 + i * 0.26); ctx.beginPath(); for (let xx = x0; xx <= x1; xx += 3) { const yy = wy + Math.sin(xx * 0.35 + ph * 2 + i) * 1.3; xx === x0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
  };
  // 店先（側壁）
  const storefront = (near, far, left, k) => {
    const nx = left ? near.l : near.r, fx = left ? far.l : far.r;
    const band = (f0, f1, c) => poly([[nx, yN(near, f0)], [fx, yN(far, f0)], [fx, yN(far, f1)], [nx, yN(near, f1)]], c);
    band(0, 1, col(P.wall, k));
    band(0.05, 0.24, col(P.sign, k));
    band(0.30, 0.74, col(P.glass, k));
    band(0.86, 1, col(P.kick, k));
    line(nx, near.t, nx, near.b, col(P.trim, k));
    line(fx, far.t, fx, far.b, col(P.trim, k));
  };
  // 正面＝海の見える大きな窓（リゾート）
  const facade = (r, k) => {
    poly([[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]], col(P.wall, k));
    rectXY(r.l, yN(r, 0.06), r.r, yN(r, 0.27), col(P.sign, k));
    oceanWindow(r.l + 2, yN(r, 0.32), r.r - 2, yN(r, 0.84), k);
    line(r.l, yN(r, 0.58), r.r, yN(r, 0.58), col(P.trim, k * 0.7));
    for (let m = 1; m < 3; m++) { const x = xN(r, m / 3); line(x, yN(r, 0.32), x, yN(r, 0.84), col(P.trim, k)); }
    rectXY(r.l, yN(r, 0.84), r.r, yN(r, 0.92), col(P.kick, k));
  };
  for (let c = maxD; c >= 1; c--) {
    const near = rect[c - 1], far = rect[c], k = sh(c);
    if (rpgIsWall(rpgAhead(c, 0))) {
      facade(near, sh(c - 1));
    } else {
      poly([[near.l, near.b], [far.l, far.b], [far.r, far.b], [near.r, near.b]], col(P.floor, k));
      line(far.l, far.b, far.r, far.b, col(P.grout, k));
      [0.33, 0.66].forEach(fr => line(xN(near, fr), near.b, xN(far, fr), far.b, col(P.grout, k * 0.92)));
      poly([[near.l, near.t], [far.l, far.t], [far.r, far.t], [near.r, near.t]], col(P.ceil, k));
      const shimmer = 1 + 0.06 * Math.sin(ph * 2.4 + c);   // 陽光のきらめき
      poly([[xN(near, 0.42), near.t], [xN(far, 0.42), far.t], [xN(far, 0.58), far.t], [xN(near, 0.58), near.t]], col(P.light, k * shimmer));
      line(far.l, far.t, far.r, far.t, col(P.light, shimmer));
      if (rpgIsWall(rpgAhead(c, -1))) storefront(near, far, true, k);
      if (rpgIsWall(rpgAhead(c, 1))) storefront(near, far, false, k);
    }
  }
  // 前方アイコン（宝箱/階段/ボス）— ふわふわ上下
  for (let c = 1; c <= maxD; c++) {
    if (rpgIsWall(rpgAhead(c, 0))) break;
    const ch = rpgAhead(c, 0);
    const tx = RPG.px + RPG_DV[RPG.dir][0] * c, ty = RPG.py + RPG_DV[RPG.dir][1] * c;
    const bob = Math.sin(ph * 2.2) * (rect[c].b - rect[c].t) * 0.03;
    if (ch === "T" && !RPG.collected[RPG.fi + ":" + tx + "," + ty]) { rpgDrawIcon(ctx, "📦", rect[c], cx, cy + bob); break; }
    if (ch === "U") { rpgDrawIcon(ctx, "🛗", rect[c], cx, cy + bob); break; }
    if (ch === "E") { rpgDrawIcon(ctx, rpgData().cleared ? "🚪" : "🎡", rect[c], cx, cy + bob); break; }
  }
  // ✨ 漂う光の粒（リゾートのきらめき）
  for (let i = 0; i < 12; i++) {
    const sx = (i * 47 + ph * 12 * (1 + i % 3)) % W;
    const sy = H - ((ph * 22 * (0.6 + (i % 4) * 0.25) + i * 53) % H);
    const s = (i % 3) ? 1 : 2;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(ph + i));
    ctx.fillStyle = "#fff"; ctx.fillRect(sx, sy, s, s);
  }
  ctx.globalAlpha = 1;
  // ごく軽いビネット
  const g = ctx.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// アンビエント・アニメ（探索中は毎フレーム一人称ビューを再描画＝海・きらめき・ふわふわ）
let _rpgRaf = 0;
function rpgStartAmbient(cv) {
  RPG._viewCv = cv;
  if (_rpgRaf) return;
  const loop = (t) => {
    _rpgRaf = 0;
    if (RPG && RPG.mode === "explore" && state.ui.screen === "mall_rpg" && RPG._viewCv && RPG._viewCv.isConnected) {
      try { rpgDrawView(RPG._viewCv, t); } catch (e) {}
      _rpgRaf = requestAnimationFrame(loop);
    }
  };
  _rpgRaf = requestAnimationFrame(loop);
}
function rpgDrawIcon(ctx, ic, r, cx, cy) {
  const size = Math.max(12, (r.b - r.t) * 0.42);
  ctx.font = size + "px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ic, cx, (r.t + r.b) / 2);
}
// 絵文字を低解像canvasに描いてCSSでpixelated拡大＝ドット絵風スプライト
function rpgMakeSprite(emoji, disp, cls) {
  const cv = el("canvas", "rpg-spr" + (cls ? " " + cls : ""));
  const R = 26;
  cv.width = R; cv.height = R;
  cv.style.width = (disp || 56) + "px"; cv.style.height = (disp || 56) + "px";
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.font = Math.round(R * 0.82) + "px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(emoji, R / 2, R / 2 + 1);
  return cv;
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
  // 戦闘ステージ（敵＝モール内の対決）
  const stage = el("div", "rpg-stage" + (b.boss ? " boss" : ""));
  const ev = el("div", "rpg-enemies");
  b.enemies.forEach((e, i) => {
    const card = el("button", "rpg-enemy" + (e.alive ? "" : " dead") + (b.target === i ? " sel" : ""));
    card.id = "rpg-enemy-" + i;
    const hp = Math.max(0, e.hp), pct = Math.round(hp / e.maxhp * 100);
    const seen = d.codex[e.id];
    const w = seen && seen.weak.length ? "弱点 " + seen.weak.map(x => RPG_ELEM_IC[x]).join("") : "弱点？";
    const gone = e.ref.kind === "tourist" ? "満足して帰った" : "たおした";
    if (b.target === i && e.alive) card.appendChild(el("div", "rpg-reticle", "▼"));
    card.appendChild(rpgMakeSprite(e.ref.ic, b.boss ? 96 : 60, "enemy"));
    card.appendChild(el("div", "rpg-enemy-shadow"));
    const info = el("div", "rpg-enemy-info");
    info.innerHTML = `<b>${e.ref.n}</b>` +
      `<span class="rpg-hpbar"><span style="width:${pct}%"></span></span>` +
      `<small>${e.alive ? w : gone}</small>`;
    card.appendChild(info);
    if (e.alive) card.onclick = () => rpgSelectTarget(i);
    ev.appendChild(card);
  });
  stage.appendChild(ev);
  app.appendChild(stage);

  // ミミの状態異常
  const stk = Object.keys(RPG_STATUS).filter(k => b.pstatus[k] > 0);
  if (stk.length) {
    const sr = el("div", "rpg-status");
    sr.innerHTML = stk.map(k => `<span class="rpg-stchip" title="${RPG_STATUS[k].d}">${RPG_STATUS[k].ic} ${RPG_STATUS[k].n}</span>`).join("");
    app.appendChild(sr);
  }

  // プレイヤーHUD（ミミのステータスパネル）
  const hud = el("div", "rpg-bhud"); hud.id = "rpg-bhud";
  hud.innerHTML =
    `<div class="rpg-bhud-name">🧝 ミミ <b>Lv${d.lv}</b>` +
    ((b.combo || 0) >= 2 ? `<span class="rpg-combo lvl${Math.min(5, Math.floor(b.combo / 3) + 1)}">🔥 COMBO ×${b.combo}</span>` : "") + `</div>` +
    `<div class="rpg-bar-row"><span class="rpg-bar-lb">HP</span><span class="rpg-hpbar big"><span style="width:${Math.round(d.hp / d.maxhp * 100)}%"></span></span><span class="rpg-bar-v">${d.hp}/${d.maxhp}</span></div>` +
    `<div class="rpg-bar-row"><span class="rpg-bar-lb">MP</span><span class="rpg-mpbar"><span style="width:${Math.round(d.mp / d.maxmp * 100)}%"></span></span><span class="rpg-bar-v">${d.mp}/${d.maxmp}</span></div>`;
  app.appendChild(hud);

  // ログ
  const lg = el("div", "rpg-blog");
  b.log.forEach((L, i) => { const ln = el("div", "rpg-logline " + L.cls, L.t); if (i === 0) ln.classList.add("fresh"); lg.appendChild(ln); });
  app.appendChild(lg);

  // コマンド
  const cmd = el("div", "rpg-cmd");
  if (b.phase !== "cmd") {
    cmd.appendChild(el("div", "rpg-wait", "…"));
  } else if (b.sub === "skills") {
    d.skills.forEach(id => {
      const sk = RPG_SKILLS[id];
      const sealed = sk.mp > 0 && b.pstatus.seal > 0;
      const can = d.mp >= sk.mp && !sealed;
      const btn = el("button", "rpg-cmdbtn el-" + sk.el + (can ? "" : " off"));
      btn.innerHTML = `<b>${RPG_ELEM_IC[sk.el]} ${sk.n}</b><small>${sealed ? "🍙封じ中" : (sk.el === "heal" ? "回復" : RPG_ELEM[sk.el]) + (sk.mp ? " MP" + sk.mp : "")}</small>`;
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

// ── 勝利（モダンなリザルト：カウントアップ＋演出）
function rpgRenderWon(app) {
  const f = RPG.flash || {};
  app.appendChild(el("h2", "rpg-won-h", f.boss ? "👑 ボス撃破！" : "🎉 VICTORY"));
  const box = el("div", "rpg-resbox good");
  let rows = `<div class="rpg-res-row"><span>獲得EXP</span><b class="rpg-cu" data-to="${f.exp || 0}">0</b></div>` +
    `<div class="rpg-res-row"><span>獲得ゴールド</span><b class="rpg-cu" data-to="${f.gold || 0}">0</b><span class="rpg-cu-suf">G</span></div>`;
  if ((f.combo || 0) >= 2) rows += `<div class="rpg-res-row combo"><span>🔥 最大コンボ</span><b>×${f.combo}（報酬+${Math.round(Math.min(f.combo, 25) * 6)}%）</b></div>`;
  box.innerHTML = rows;
  app.appendChild(box);
  if (f.ups && f.ups.length) {
    f.ups.forEach(u => app.appendChild(el("div", "rpg-res-lv pop", `⬆️ LEVEL ${u.lv}！${u.learn && u.learn.length ? " 新スキル「" + u.learn.map(s => RPG_SKILLS[s].n).join("・") + "」習得！" : ""}`)));
  }
  if (f.outfit) {
    const o = el("div", "rpg-res-outfit pop"); o.innerHTML = `👑 衣装「${f.outfit.name}」GET！ <small>モールで着られるよ</small>`;
    app.appendChild(o);
  }
  const cont = el("button", "rpg-start", "▶ 探索を続ける");
  cont.onclick = () => rpgAfterWin();
  app.appendChild(cont);
  // カウントアップ
  app.querySelectorAll(".rpg-cu").forEach(elm => {
    const to = parseInt(elm.getAttribute("data-to"), 10) || 0; let cur = 0; const step = Math.max(1, Math.round(to / 24));
    const iv = setInterval(() => { cur += step; if (cur >= to) { cur = to; clearInterval(iv); } elm.textContent = cur; }, 28);
  });
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

// =========================================================================
// 🎰 射幸性レイヤー：レアリティ / ガチャ / ルート演出 / ダブルアップ / デイリー
//   ※すべてダンジョン内の独立通貨（ゴールド/チケット）とコスメ(outfitsWon)で完結。
//     プレイヤーのコイン・総資産・レース数式には一切触れない（[[race-math-immutable]]）。
// =========================================================================
const RPG_RARITY = [
  { id: "c",   n: "ふつう",       w: 60,  col: "#b8b2c4" },
  { id: "r",   n: "レア",         w: 27,  col: "#5ec8ff" },
  { id: "sr",  n: "スーパーレア", w: 9.5, col: "#c08bff" },
  { id: "ssr", n: "激レア",       w: 2.8, col: "#ffd24a" },
  { id: "ur",  n: "伝説",         w: 0.7, col: "#ff7ad0", rainbow: true },
];
const RPG_RIDX = { c: 0, r: 1, sr: 2, ssr: 3, ur: 4 };
function rpgRollRarity(luck) {
  const ws = RPG_RARITY.map((R, i) => R.w * (i >= 2 ? (1 + (luck || 0) * 0.6) : 1));
  let t = ws.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < RPG_RARITY.length; i++) { t -= ws[i]; if (t <= 0) return RPG_RARITY[i]; }
  return RPG_RARITY[0];
}

// レア度→具体ごほうび（即時付与し、演出用データを返す）
function rpgGrantReward(R) {
  const d = rpgData(), ri = RPG_RIDX[R.id];
  // 高レアは衣装（あれば）
  if (ri >= 2) {
    const band = ri >= 3 ? "l" : "r";
    const o = rpgGrantOutfit(band) || rpgGrantOutfit("r") || rpgGrantOutfit("c");
    if (o) return { rarity: R, icon: "👗", label: "衣装「" + o.name + "」", big: true };
  }
  if (R.id === "r" && Math.random() < 0.4) { d.items.ether = (d.items.ether || 0) + 1; return { rarity: R, icon: "🔵", label: "マナ水 ×1" }; }
  if (R.id === "c" && Math.random() < 0.5) { d.items.potion = (d.items.potion || 0) + 1; return { rarity: R, icon: "🧪", label: "回復薬 ×1" }; }
  if (ri >= 2 && Math.random() < 0.3) { d.tickets = (d.tickets || 0) + 1; return { rarity: R, icon: "🎟️", label: "ガチャチケット ×1" }; }
  const base = { c: 25, r: 70, sr: 180, ssr: 600, ur: 2500 }[R.id];
  const g = Math.round(base * (0.8 + Math.random() * 0.6));
  d.gold += g;
  return { rarity: R, icon: "🪙", label: g + " ゴールド", gold: g };
}

// ── 演出（スピン→開封→レア度で光・パーティクル・JACKPOT、必要ならダブルアップ）
let RPG_REVEAL = null;
function rpgReveal(items, opts) {
  RPG_REVEAL = { items, phase: "spin", opts: opts || {} };
  rpgSfx("streak");
  renderMallRpg();
  setTimeout(() => { if (RPG_REVEAL) { RPG_REVEAL.phase = "done"; const top = items.reduce((m, x) => Math.max(m, RPG_RIDX[x.rarity.id]), 0); rpgSfx(top >= 2 ? "win" : "unlock"); if (top >= 3) rpgFx.banner("✨ JACKPOT ✨", "victory"); renderMallRpg(); } }, 1200);
}
function rpgRevealClose() {
  const done = RPG_REVEAL && RPG_REVEAL.opts.onDone;
  RPG_REVEAL = null;
  if (done) done(); else renderMallRpg();
}
// ダブルアップ（50%で倍・失敗で没収、最大3段）
function rpgDoubleUp() {
  const rv = RPG_REVEAL; if (!rv || rv.phase !== "done") return;
  const it = rv.items[0]; if (!it || !it.gold) return;
  const d = rpgData();
  rv.stage = (rv.stage || 1);
  if (Math.random() < 0.5) {
    d.gold += it.gold;                 // もう一段ぶん上乗せ
    it.gold *= 2; it.label = it.gold + " ゴールド";
    rv.stage++; rpgSfx("win"); rpgFx.banner("WIN! ×2", "more");
    if (rv.stage > 3) { rv.maxed = true; }
  } else {
    d.gold -= it.gold; it.gold = 0; it.label = "0 ゴールド…"; it.busted = true;
    rpgSfx("alert"); rpgFx.banner("BUST…", "down");
  }
  rpgSave(); renderMallRpg();
}
function rpgRenderReveal(app) {
  const rv = RPG_REVEAL;
  app.appendChild(el("h2", "rpg-reveal-h", rv.opts.title || "🎁 おたから！"));
  const grid = el("div", "rpg-reveal-grid" + (rv.items.length > 4 ? " many" : ""));
  rv.items.forEach((it, i) => {
    const card = el("div", "rpg-card r-" + it.rarity.id + (it.rarity.rainbow ? " rainbow" : "") + " " + rv.phase + (it.busted ? " busted" : ""));
    card.style.setProperty("--rc", it.rarity.col);
    card.style.animationDelay = (i * 0.08) + "s";
    if (rv.phase === "spin") card.innerHTML = `<div class="rpg-card-spin">🎰</div>`;
    else card.innerHTML = `<div class="rpg-card-ic">${it.icon}</div><div class="rpg-card-rar">${it.rarity.n}</div><div class="rpg-card-lb">${it.label}</div>` + (RPG_RIDX[it.rarity.id] >= 3 ? `<div class="rpg-card-rays"></div>` : "");
    grid.appendChild(card);
  });
  app.appendChild(grid);
  if (rv.phase === "done") {
    const acts = el("div", "rpg-reveal-acts");
    const single = rv.items.length === 1 ? rv.items[0] : null;
    if (single && single.gold && !single.busted && !rv.maxed && (rv.stage || 1) <= 3) {
      const du = el("button", "rpg-cmdbtn main", `<b>🎲 ダブルアップ</b><small>50%で2倍 / 失敗で没収（現在 ${single.gold}G）</small>`);
      du.onclick = () => rpgDoubleUp(); acts.appendChild(du);
    }
    const ok = el("button", "rpg-start", single && single.busted ? "とほほ…受け取る ▶" : "受け取る ▶");
    ok.onclick = () => rpgRevealClose(); acts.appendChild(ok);
    app.appendChild(acts);
  } else {
    app.appendChild(el("div", "rpg-reveal-hint", "✨ 開封中…"));
  }
}

// ── 宝箱＝毎回ガチャ（レア度ロール＋ダブルアップ）
function rpgChestPull(x, y, luck) {
  const R = rpgRollRarity(luck || 0);
  const it = rpgGrantReward(R);
  rpgSave();
  rpgReveal([it], { title: "📦 宝箱を開けた！", onDone: () => { RPG.mode = "explore"; renderMallRpg(); } });
}

// ── ハブのガチャ
function rpgGachaPull(n) {
  const d = rpgData();
  if (n === 1) { if ((d.tickets || 0) < 1) return; d.tickets -= 1; }
  else { const cost = 280; if ((d.gold || 0) < cost) return; d.gold -= cost; }
  d.records.pulls = (d.records.pulls || 0) + n;
  const luck = n >= 10 ? 0.6 : 0;          // 10連は気持ち高レア寄り
  const items = [];
  let guaranteed = n >= 10;                 // 10連はSR以上1枚確定
  for (let i = 0; i < n; i++) {
    let R = rpgRollRarity(luck);
    if (guaranteed && i === n - 1 && RPG_RIDX[R.id] < 2) R = RPG_RARITY[2];
    if (RPG_RIDX[R.id] >= 2) guaranteed = false;
    items.push(rpgGrantReward(R));
  }
  rpgSave();
  rpgReveal(items, { title: n >= 10 ? "🎟️ 10連ガチャ！" : "🎟️ ガチャ！", onDone: () => renderMallRpg() });
}

// ── デイリー・ログインボーナス
function rpgClaimDaily() {
  const d = rpgData();
  if (d.daily === rpgToday()) return;
  d.daily = rpgToday();
  d.tickets = (d.tickets || 0) + 1;
  const R = rpgRollRarity(0.3);
  const it = rpgGrantReward(R);
  rpgSave();
  rpgReveal([{ rarity: RPG_RARITY[1], icon: "🎟️", label: "ログボ：チケット ×1" }, it], { title: "📅 ログインボーナス！", onDone: () => renderMallRpg() });
}

// ── スコア記録の更新（中毒性＝自己ベスト）
function rpgBumpRecords() {
  const d = rpgData(), r = d.records;
  if (d.lv > r.lv) r.lv = d.lv;
  if ((d.best.floor || 0) > (r.floor || 0)) r.floor = d.best.floor || 0;
  const score = (d.lv * 120) + ((d.best.floor || 0) * 300) + (r.combo || 0) * 40 + Math.floor((d.gold || 0) / 10);
  if (score > (r.score || 0)) r.score = score;
  rpgSave();
}
