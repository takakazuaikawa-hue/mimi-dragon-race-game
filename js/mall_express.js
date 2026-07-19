// =========================================================================
// mall_express.js — モール大冒険「エクスプレス」：3ドア択＋ラン内ビルドのローグライト
// =========================================================================
// MALL_ADVENTURE_BRIEF §2 の実装。★既存の探索ラン(rpgStartRun)は一切置換せず、
// 「エレベーターで特別フロアへ」＝別モードとして“足す”（監査の結論どおり）。
//   1ラン=6フロア。各フロアで3つの扉から1つ選ぶ：
//     ⚔バーゲン戦 / 🎁ワゴン / 🛍店 / ☕休憩 / ❓ハプニング（3F・6Fは店長戦で固定）
//   ラン内だけ効く「買い物術」をボスと宝で拾って重ねる＝ビルド（ラン終了で消滅）。
// 戦闘・レベル・報酬は既存エンジン(rpgEncounter/rpgData/rpgGrantOutfit)をそのまま使う。
// ★表示専用メタ＝レースの着順・オッズ・配当には一切干渉しない。
// =========================================================================

const MEX_FLOORS = 6;                      // 1ランの階数
const MEX_BOSS_FLOORS = [3, 6];            // 名物店長戦（3階ごと）

// ── ラン内ビルド「買い物術」：効果はすべて本ファイル内で適用＝戦闘エンジンに非干渉 ──
const MEX_BUILDS = [
  { id: "nego",   ic: "💰", n: "値切り上手",   fl: "店とワゴンの値段が 30% 安くなる" },
  { id: "impulse",ic: "🛍️", n: "衝動買い",     fl: "戦闘でもらえるゴールド +40%" },
  { id: "fukubu", ic: "🧧", n: "福袋体質",     fl: "ワゴンの戦利品が 1つ増える" },
  { id: "regular",ic: "☕", n: "常連さん",     fl: "休憩の回復量 +60%" },
  { id: "eye",    ic: "🎯", n: "目利き",       fl: "扉の中身が最後まで見える" },
  { id: "guts",   ic: "💪", n: "底力",         fl: "最大HP +12（すぐ回復する）" }
];
function mexHas(id) { try { return !!(RPG && RPG.express && RPG.express.build.indexOf(id) >= 0); } catch (e) { return false; } }
function mexBuildDef(id) { return MEX_BUILDS.find(b => b.id === id) || null; }

// ── 扉の種類 ───────────────────────────────────────────────────────────
// hint＝選ぶ前に見えるうっすらした気配（リスク管理の遊び）。目利きがあれば正体まで見える。
const MEX_DOORS = [
  { k: "battle", ic: "⚔️", n: "バーゲン戦",   hint: "人の熱気を感じる…",     fl: "客と魔物がひしめいている" },
  { k: "loot",   ic: "🎁", n: "ワゴンセール", hint: "何かが山積みだ…",       fl: "掘り出し物のワゴン" },
  { k: "shop",   ic: "🛍️", n: "売り場",       fl: "回復アイテムを買える",    hint: "レジの音がする…" },
  { k: "rest",   ic: "☕", n: "休憩スペース", fl: "座って体力を戻す",        hint: "コーヒーの匂い…" },
  { k: "event",  ic: "❓", n: "なにか いる",  fl: "モールのハプニング",      hint: "ざわざわしている…" }
];

// ── ハプニング（コメディ・崑崙島の世界観／声表準拠）──────────────────────
// img＝Codex納品のイベント絵（images/rpg/ev_*.webp・512透過）。無い項目は絵なしでよい。
const MEX_EVENTS = [
  { t: "試食の山", ic: "🍢", img: "ev_1", body: "試食コーナーの店員に囲まれた。気づけば両手いっぱい。",
    mimi: "「た、食べ切れない……いや、食べるけど」", eff: "heal", n: 14 },
  { t: "迷子の子竜", ic: "🐲", img: "ev_2", body: "泣いている子竜。抱っこして案内所まで送り届けた。",
    mimi: "「だいじょうぶ。おねえちゃんも、迷子の先輩だから」", eff: "gold", n: 40 },
  { t: "福引きガラポン", ic: "🎰", img: "ev_3", body: "商店会の福引き。カラカラ……カラン、と音。",
    mimi: "「鳴った！　鳴ったよね今！？」", eff: "gold", n: 90 },
  { t: "閉店セールの群衆", ic: "🏃", img: "ev_4", body: "「閉店5分前」の放送。群衆に飲まれて反対側まで運ばれた。",
    mimi: "「わたし、いま何メートル進んだ？」", eff: "hp", n: -8 },
  { t: "マッサージ椅子", ic: "💺", body: "無料体験の椅子に座ったら、動けなくなった。",
    mimi: "「あと3分……あと3分だけ……」", eff: "heal", n: 20 },
  { t: "屋上の風", ic: "🌇", body: "非常階段から屋上へ。島の灯りが、ぜんぶ見えた。",
    mimi: "「……買い物より、こっちのほうが得した気分」", eff: "buff" }
];

// ── 開始 ───────────────────────────────────────────────────────────────
function rpgStartExpress() {
  const d = rpgData();
  RPG = {
    fi: 0, map: [], w: 9, h: 9, px: 1, py: 1, dir: 1,
    mode: "express", steps: 0, grace: 1, explored: {}, collected: {},
    log: [], battle: null, flash: null, auto: false,
    runKills: 0, runMissions: 0, _maxFi: 0,
    express: { floor: 1, build: [], doors: null, gold0: d.gold, loot: [], pending: null }
  };
  RPG.snap = (typeof rpgRunSnap === "function") ? rpgRunSnap() : null;
  d.hp = d.maxhp; d.mp = d.maxmp;   // エクスプレスは満タンで出発（短距離ラン）
  rpgSave();
  mexRollDoors();
  renderMexDoors();
}
// フロアの扉3枚を引く（ボス階は扉なし＝直行）
function mexRollDoors() {
  const ex = RPG.express;
  if (MEX_BOSS_FLOORS.indexOf(ex.floor) >= 0) { ex.doors = null; return; }
  const pool = MEX_DOORS.slice();
  const picked = [];
  // 必ず1枚は戦闘＝報酬の主軸。残り2枚は他種から重複なしで。
  picked.push(pool.find(x => x.k === "battle"));
  const rest = pool.filter(x => x.k !== "battle");
  for (let i = 0; i < 2 && rest.length; i++) picked.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  // 並びをシャッフル＝「左が当たり」を作らない
  ex.doors = picked.sort(() => Math.random() - 0.5);
}

// ── 扉えらび画面 ───────────────────────────────────────────────────────
function renderMexDoors() {
  const ex = RPG.express, d = rpgData();
  state.ui.screen = "mall_rpg";
  const app = beginScreen();
  app.appendChild(mexHeader());

  if (!ex.doors) {   // ボス階＝店長戦へ直行
    const card = el("div", "mex-bosscard");
    card.innerHTML = `<div class="mex-boss-ic">👑</div>` +
      `<div class="mex-boss-t">${ex.floor}F・名物店長があらわれる</div>` +
      `<div class="mex-boss-s">${ex.floor >= MEX_FLOORS ? "最上階。ここを抜ければ、戦利品は全部あなたのもの。" : "フロアの主。倒せば「買い物術」を覚える。"}</div>`;
    app.appendChild(card);
    const go = el("button", "mex-go", "⚔️ 挑む");
    go.onclick = () => mexEnterBoss();
    app.appendChild(go);
    app.appendChild(mexFooter());
    return;
  }

  app.appendChild(el("div", "mex-lead", `${ex.floor}F — どの扉を開ける？`));
  const wrap = el("div", "mex-doors");
  ex.doors.forEach((dr, i) => {
    const seen = mexHas("eye");
    const b = el("button", "mex-door");
    b.innerHTML =
      `<span class="mex-d-ic">${seen ? dr.ic : "🚪"}</span>` +
      `<span class="mex-d-n">${seen ? dr.n : "？？？"}</span>` +
      `<span class="mex-d-h">${seen ? dr.fl : dr.hint}</span>`;
    b.onclick = () => mexOpen(i);
    wrap.appendChild(b);
  });
  app.appendChild(wrap);
  app.appendChild(mexFooter());
}
function mexHeader() {
  const ex = RPG.express, d = rpgData();
  const h = el("div", "mex-head");
  h.innerHTML =
    `<div class="mex-h-top"><b>🛗 エクスプレス</b><span>${ex.floor} / ${MEX_FLOORS} F</span></div>` +
    `<div class="mex-h-stat">` +
      `<span class="mex-hp">❤️ ${Math.max(0, d.hp)}/${d.maxhp}</span>` +
      `<span class="mex-mp">💧 ${d.mp}/${d.maxmp}</span>` +
      `<span class="mex-g">🪙 ${d.gold}</span>` +
    `</div>` +
    (ex.build.length
      ? `<div class="mex-build">${ex.build.map(id => { const b = mexBuildDef(id); return `<i title="${b.fl}">${b.ic} ${b.n}</i>`; }).join("")}</div>`
      : `<div class="mex-build empty">買い物術：まだ無し（店長を倒すと覚える）</div>`);
  return h;
}
function mexFooter() {
  const box = el("div", "actions");
  const out = el("button", "secondary", "🏠 途中でやめる（戦利品は持ち帰る）");
  out.onclick = () => mexFinish("quit");
  box.appendChild(out);
  return box;
}

// ── 扉を開ける ─────────────────────────────────────────────────────────
function mexOpen(i) {
  const ex = RPG.express, dr = ex.doors[i];
  if (!dr) return;
  try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
  const go = () => {
    if (dr.k === "battle") { mexEnterBattle(false); return; }
    if (dr.k === "loot")   { mexLoot(); return; }
    if (dr.k === "shop")   { mexShop(); return; }
    if (dr.k === "rest")   { mexRest(); return; }
    mexEvent();
  };
  // 🚪P2-8 開扉演出：選んだ扉だけ正体を見せて開く（他は静かに引く）。reduced-motion では即遷移。
  const btns = document.querySelectorAll(".mex-door");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!btns.length || reduce) { go(); return; }
  btns.forEach((b, k) => {
    if (k === i) {
      b.classList.add("opening");
      const ic = b.querySelector(".mex-d-ic"), nm = b.querySelector(".mex-d-n");
      if (ic) ic.textContent = dr.ic;      // 開けた瞬間に正体が分かる
      if (nm) nm.textContent = dr.n;
    } else b.classList.add("fading");
  });
  setTimeout(go, 460);
}
// 戦闘＝既存エンジンをそのまま使う。
// ★難度スケール：6フロアの短距離ランなので、探索ラン(1F=fi0…7F=fi6)と同じ刻みだと
//   Lv1の初回で3Fの主に必ず全滅した（実プレイで確認）。2フロアで1段ずつに緩める。
function mexTier() { return Math.min(5, Math.floor((RPG.express.floor - 1) / 2)); }
function mexEnterBattle(boss) {
  RPG.fi = mexTier();
  RPG.mode = "battle";
  rpgEncounter(boss ? "boss" : false);
}
function mexEnterBoss() {
  const ex = RPG.express, d = rpgData();
  // 店長の前でひと呼吸＝HPを4割戻す（短距離ランで“詰み”を作らない）
  const heal = Math.round(d.maxhp * 0.4);
  if (d.hp < d.maxhp) { d.hp = Math.min(d.maxhp, d.hp + heal); rpgSave(); }
  RPG.fi = mexTier();
  RPG.mode = "battle";
  // ★P1-7：3F＝マダム・メゾン（専用店長）／6F＝観覧車ゴーレム。同じ「主」の使い回しをやめる。
  if (ex.floor >= MEX_FLOORS) { rpgEncounter("boss"); return; }
  mexEncounterNamed("maison");
}
// 指定IDのボスを1体だけ出す（rpgEncounterの"boss"分岐はboss1固定のため、専用店長用に用意）。
// 生成物の形は rpgEncounter と同一＝以降の戦闘処理はすべて既存エンジンのまま。
function mexEncounterNamed(id) {
  const m = RPG_MONS[id]; if (!m) { rpgEncounter("nushi"); return; }
  const e = { id, ref: m, hp: m.hp, maxhp: m.hp, alive: true, atk: m.atk, exp: m.exp, gold: m.gold };
  RPG.battle = { enemies: [e], target: 0, extra: false, acts: 1, combo: 0, gauge: 0, guard: false, log: [],
    boss: true, nushi: false, phase: "cmd", sub: null, rare: false,
    introT0: (typeof performance !== "undefined" ? performance.now() : Date.now()),
    pstatus: { stun: 0, defdown: 0, dazzle: 0, seal: 0 } };
  RPG.mode = "battle"; RPG.busy = false;
  if (typeof rpgComputeIntents === "function") rpgComputeIntents();
  rpgBLog(`👑 ${m.n} が立ちはだかった！`);
  rpgSfx("alert");
  rpgFx.encounter("boss");
  rpgFx.cutins([m], true);
  rpgFx.shakeApp();
  renderMallRpg();
}
// ワゴン＝ゴールドと消耗品（福袋体質で1つ増える）
function mexLoot() {
  const d = rpgData(), ex = RPG.express;
  let n = 2 + (mexHas("fukubu") ? 1 : 0);
  const got = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.5) { const g = 30 + Math.floor(Math.random() * 50); d.gold += g; got.push(`🪙 ${g}G`); }
    else if (r < 0.8) { d.items.pot = (d.items.pot || 0) + 1; got.push("🧪 回復薬 ×1"); }
    else { d.items.eth = (d.items.eth || 0) + 1; got.push("🔵 マナ水 ×1"); }
  }
  ex.loot.push(...got);
  rpgSave();
  mexPopup("🎁 ワゴンセール", `<div class="mex-ev-b">山積みのワゴンを掘る。……掘る。掘る。</div>` +
    `<div class="mex-got">${got.map(g => `<span>${g}</span>`).join("")}</div>` +
    `<div class="mex-mimi">「これ、ぜったい下のほうが本命なんだよね」</div>`, mexNextFloor);
}
// 売り場＝回復アイテムを買う（値切り上手で3割引）
function mexShop() {
  const d = rpgData();
  const off = mexHas("nego") ? 0.7 : 1;
  const items = [
    { k: "pot", ic: "🧪", n: "回復薬", p: Math.round(20 * off) },
    { k: "eth", ic: "🔵", n: "マナ水", p: Math.round(30 * off) },
    { k: "hp",  ic: "💗", n: "その場で全回復", p: Math.round(60 * off) }
  ];
  const body = el("div");
  const draw = () => {
    body.innerHTML = `<div class="mex-ev-b">売り場に着いた。${mexHas("nego") ? "（値切り上手で3割引！）" : ""}</div>` +
      `<div class="mex-shop">` + items.map((it, i) =>
        `<button class="mex-buy" data-i="${i}" ${d.gold < it.p ? "disabled" : ""}>${it.ic} ${it.n}<small>🪙${it.p}</small></button>`).join("") + `</div>` +
      `<div class="mex-mimi">所持 🪙${d.gold}</div>`;
    body.querySelectorAll(".mex-buy").forEach(b => {
      b.onclick = () => {
        const it = items[+b.getAttribute("data-i")];
        if (d.gold < it.p) return;
        d.gold -= it.p;
        if (it.k === "hp") { d.hp = d.maxhp; d.mp = d.maxmp; }
        else d.items[it.k] = (d.items[it.k] || 0) + 1;
        try { if (window.Sfx) Sfx.play("coin"); } catch (e) {}
        rpgSave(); draw();
      };
    });
  };
  draw();
  mexPopupEl("🛍️ 売り場", body, mexNextFloor);
}
// 休憩＝HP/MP回復（常連さんで+60%）
function mexRest() {
  const d = rpgData();
  const mul = mexHas("regular") ? 1.6 : 1;
  const hh = Math.round(d.maxhp * 0.45 * mul), mm = Math.round(d.maxmp * 0.4 * mul);
  d.hp = Math.min(d.maxhp, d.hp + hh); d.mp = Math.min(d.maxmp, d.mp + mm);
  rpgSave();
  mexPopup("☕ 休憩スペース", `<div class="mex-ev-b">ベンチに座って、ひと息。</div>` +
    `<div class="mex-got"><span>❤️ +${hh}</span><span>💧 +${mm}</span></div>` +
    `<div class="mex-mimi">「……このまま寝たら、たぶん閉店まで起きない」</div>`, mexNextFloor);
}
// ハプニング＝コメディ＋小さな効果
function mexEvent() {
  const d = rpgData(), ev = MEX_EVENTS[Math.floor(Math.random() * MEX_EVENTS.length)];
  let line = "";
  if (ev.eff === "heal") { const n = ev.n; d.hp = Math.min(d.maxhp, d.hp + n); line = `<span>❤️ +${n}</span>`; }
  else if (ev.eff === "gold") { d.gold += ev.n; line = `<span>🪙 +${ev.n}G</span>`; RPG.express.loot.push(`🪙 ${ev.n}G`); }
  else if (ev.eff === "hp") { d.hp = Math.max(1, d.hp + ev.n); line = `<span>💔 ${ev.n}</span>`; }
  else if (ev.eff === "buff") { d.mp = d.maxmp; line = `<span>💧 全回復</span>`; }
  rpgSave();
  const art = ev.img
    ? `<img class="mex-ev-art" src="images/rpg/${ev.img}.webp" alt="" decoding="async" onerror="this.remove()">`
    : "";
  mexPopup(`${ev.ic} ${ev.t}`, art + `<div class="mex-ev-b">${ev.body}</div>` +
    (line ? `<div class="mex-got">${line}</div>` : "") +
    `<div class="mex-mimi">${ev.mimi}</div>`, mexNextFloor);
}

// ── 次のフロアへ／終了 ─────────────────────────────────────────────────
function mexNextFloor() {
  const ex = RPG.express;
  ex.floor++;
  if (ex.floor > MEX_FLOORS) { mexFinish("clear"); return; }
  mexRollDoors();
  renderMexDoors();
}
// 買い物術を1つ覚える（店長撃破の報酬）
function mexGrantBuild(after) {
  const ex = RPG.express;
  const pool = MEX_BUILDS.filter(b => ex.build.indexOf(b.id) < 0);
  if (!pool.length) { after && after(); return; }
  const offer = pool.sort(() => Math.random() - 0.5).slice(0, 2);
  const body = el("div");
  body.innerHTML = `<div class="mex-ev-b">店長が「見どころがある」と、コツを教えてくれた。<br>どちらか<b>ひとつ</b>を覚える（このラン限り）。</div>`;
  const row = el("div", "mex-picks");
  offer.forEach(b => {
    const btn = el("button", "mex-pick", `<span class="mp-ic">${b.ic}</span><b>${b.n}</b><small>${b.fl}</small>`);
    btn.onclick = () => {
      ex.build.push(b.id);
      if (b.id === "guts") { const d = rpgData(); d.maxhp += 12; d.hp = Math.min(d.maxhp, d.hp + 12); }
      rpgSave();
      document.querySelectorAll(".navpop-ov").forEach(e => e.remove());
      after && after();
    };
    row.appendChild(btn);
  });
  body.appendChild(row);
  mexPopupEl("🛒 買い物術をおぼえた！", body, null, true);
}
// ラン終了＝戦利品リザルト→龍舎/きせかえへの導線
function mexFinish(how) {
  const ex = RPG.express, d = rpgData();
  const earned = d.gold - ex.gold0;
  let outfit = null;
  if (how === "clear" && typeof rpgGrantOutfit === "function") outfit = rpgGrantOutfit(Math.random() < 0.3 ? "r" : "c");
  // 🏅P2-9 記録：クリア回数・最高獲得G・最短クリア手数（＝開けた扉の数）を残す。表示専用。
  const rec = (d.records = d.records || {});
  const best = {};
  if (earned > (rec.mexGold || 0)) { rec.mexGold = earned; best.gold = true; }
  if (how === "clear") {
    rec.mexClears = (rec.mexClears || 0) + 1;
    const steps = ex.floor - 1;   // 通過したフロア数
    if (!rec.mexBestSteps || steps < rec.mexBestSteps) { rec.mexBestSteps = steps; best.steps = true; }
  }
  RPG = null;
  if (typeof rpgSave === "function") rpgSave();
  const body = el("div");
  body.innerHTML =
    `<div class="mex-res-t">${how === "clear" ? "🏆 屋上まで制覇！" : how === "lost" ? "💤 力尽きた……" : "🚪 引き上げた"}</div>` +
    `<div class="mex-got big">` +
      `<span>🪙 ${earned >= 0 ? "+" : ""}${earned}G</span>` +
      (ex.build.length ? `<span>🛒 ${ex.build.length}つの買い物術</span>` : "") +
    `</div>` +
    (outfit ? `<div class="mex-outfit">👗 <b>${outfit.name}</b> を持ち帰った！</div>` : "") +
    (best.gold || best.steps ? `<div class="mex-best">🏅 自己ベスト更新！${best.gold ? " 獲得ゴールド" : ""}${best.steps ? " 最短クリア" : ""}</div>` : "") +
    (ex.loot.length ? `<div class="mex-lootlist">${ex.loot.slice(0, 8).map(l => `<span>${l}</span>`).join("")}</div>` : "") +
    `<div class="mex-mimi">${how === "clear" ? "「ふぅ……戦利品、両手いっぱい！」" : "「……また来よう。ワゴンは逃げない」"}</div>`;
  const row = el("div", "mex-picks");
  const again = el("button", "mex-pick", `<span class="mp-ic">🛗</span><b>もう一度</b><small>エクスプレスに乗る</small>`);
  again.onclick = () => { document.querySelectorAll(".navpop-ov").forEach(e => e.remove()); rpgStartExpress(); };
  const home = el("button", "mex-pick", `<span class="mp-ic">🏬</span><b>モールへ</b><small>きせかえ・龍舎へ</small>`);
  home.onclick = () => { document.querySelectorAll(".navpop-ov").forEach(e => e.remove()); if (typeof renderMallRpg === "function") renderMallRpg(); else renderMall(); };
  row.appendChild(again); row.appendChild(home);
  body.appendChild(row);
  mexPopupEl("📦 今回の戦利品", body, null, true);
}

// ── ポップアップ（この画面専用の軽量版）────────────────────────────────
function mexPopup(title, html, after) {
  const b = el("div"); b.innerHTML = html;
  mexPopupEl(title, b, after);
}
function mexPopupEl(title, bodyEl, after, noClose) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop mex-pop");
  box.innerHTML = `<div class="navpop-t">${title}</div>`;
  const body = el("div", "infopop-body"); body.appendChild(bodyEl);
  box.appendChild(body);
  if (!noClose) {
    const btns = el("div", "navpop-btns");
    const ok = el("button", "navpop-go", "つぎへ ▶");
    ok.onclick = () => { ov.remove(); after && after(); };
    btns.appendChild(ok); box.appendChild(btns);
  }
  ov.appendChild(box);
  document.body.appendChild(ov);
}

// ── 既存フローへの後勝ちフック（探索ランの挙動は変えない）──────────────
(function hookExpress() {
  if (typeof rpgAfterWin !== "function") return;
  const _win = rpgAfterWin;
  rpgAfterWin = function () {
    if (RPG && RPG.express) {
      const ex = RPG.express;
      RPG.battle = null; RPG.flash = null; RPG.mode = "express";
      // 店長を倒したら買い物術を1つ覚えてから次の階へ
      if (MEX_BOSS_FLOORS.indexOf(ex.floor) >= 0) { mexGrantBuild(mexNextFloor); return; }
      mexNextFloor();
      return;
    }
    return _win.apply(this, arguments);
  };
  if (typeof rpgAfterLose === "function") {
    const _lose = rpgAfterLose;
    rpgAfterLose = function () {
      if (RPG && RPG.express) { const d = rpgData(); d.hp = Math.max(1, Math.floor(d.maxhp * 0.5)); rpgSave(); mexFinish("lost"); return; }
      return _lose.apply(this, arguments);
    };
  }
})();

// 🛍️衝動買い＝戦闘ゴールド+40%（rpgBattleWin の直後に上乗せ／既存式は不変）
(function hookGold() {
  if (typeof rpgBattleWin !== "function") return;
  const _bw = rpgBattleWin;
  rpgBattleWin = function () {
    const d = rpgData(), before = d.gold;
    const r = _bw.apply(this, arguments);
    if (mexHas("impulse")) {
      const gained = d.gold - before;
      if (gained > 0) { const bonus = Math.round(gained * 0.4); d.gold += bonus; if (typeof rpgBLog === "function") rpgBLog(`🛍️ 衝動買いで +${bonus}G！`, "good"); rpgSave(); }
    }
    return r;
  };
})();

if (typeof window !== "undefined") { window.rpgStartExpress = rpgStartExpress; window.renderMexDoors = renderMexDoors; }
