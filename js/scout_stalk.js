// =========================================================================
// 🐾 しのびあし（竜スカウトの新ミニゲーム・縦切り試作＝草むらのみ）
//   完全ターン制：こちらが1歩うごくと竜も1手。ラグ・反射神経は原理的に無関係。
//
//   ★初見テストの指摘（2026-07-28）を受けた土台直し：
//   ① 竜は**左右にしか向かない**。スプライトが横向きしか無いのに上下を向かせていた＝
//      「視界がランダムに見える」の正体。絵とルールを一致させた。
//   ② 竜の頭上に**次の一手の予告**を常時出す（↩=つぎ振り向く／💤=つぎ居眠り／⚠=つぎ見回し）。
//      さらに「つぎの視界」を薄い縞で盤面に描く＝考えて動ける。
//   ③ 茂み(🌾)の**うしろの影も安全**＝濃緑の陰マスとして描く（安全がちゃんと見える）。
//   ④ ♡は竜の左右2マスだけ（＝顔の横・うしろに回り込む）。正面の♡は薄い。
//      見られたまま♡へ踏み込むと竜は**その場で驚いて跳びのく**（触れたのに無反応、を無くす）。
//   ⑤ 教えは「その瞬間に1行だけ」大きく出す（読まれない説明カード3枚は廃止）。
//
//   射幸性＝「誰が出るか」の抽選と出現演出（白→銀→金→虹）。コイン・レース数値は不変。
//   竜の絵は既存HD-2Dスプライト（_scSpriteInto）を使い回し。表示専用。
// =========================================================================

const STALK_COLS = 7, STALK_ROWS = 8;
const STALK_R = 3;                      // 視界の届くマス数
const STALK_TURNS = 24;                 // 👣この手数で竜は飽きて飛び去る
let _stalk = null;

// 見回し（ターン制の「だるまさんがころんだ」）＝周期ごとに全方位を見渡す。⚠で1手前に予告。
// ※気難しいの見回し3手周期は、ソルバ検証で「一度も見られずに成立する手順が存在しない」盤面が
//   出たため4手に緩めた（細長い視界＋聞き耳が既に強い）。詰みの押し付けは理不尽＝射幸でもない。
const STALK_SWEEP = { calm: 5, sunao: 4, kimagure: 6, kimuzukashii: 4 };
function _stalkIsSweepTurn(t) { const p = STALK_SWEEP[_stalk.temper] || 5; return t > 0 && t % p === 0; }

function stalkAvailable(locId) { return locId === "grass"; }   // 縦切り＝草むらのみ

// ── 盤面。'B'=草やぶ(入れる・隠れる・視線を遮る) 'R'=岩(通れない・視線を遮る)
const STALK_MAPS = [
  ["..R....",
   ".......",
   "..B..B.",
   ".R.....",
   "....B..",
   ".B...R.",
   ".......",
   "...B..."],
  [".......",
   ".B..R..",
   ".......",
   "...B..B",
   ".R.....",
   "....B..",
   "..B...R",
   "......."],
  ["....B..",
   ".R.....",
   "......B",
   ".B..R..",
   ".......",
   "..B....",
   "R....B.",
   "......."],
];

// ── 気性（nerve由来・poroTemperLabelと同じ切り方）→ 左右の振り向きリズムへ
//   おだやか＝3手ごとに振り向く。すなお＝2手ごと（警戒すると逃げ腰）。
//   きまぐれ＝2手見て→1手💤（居眠り＝何も見えない・そのすきに動く）。
//   気難しい＝視界が細長い（遠くまで見る）。2歩つづけて動くと音でこちらの側を向く。
function stalkTemper(d) {
  const n = (d && d.stats && d.stats.nerve) || 50;
  return n >= 78 ? "calm" : n >= 60 ? "sunao" : n >= 45 ? "kimagure" : "kimuzukashii";
}
const STALK_TEMPER_JA = { calm: "おだやか", sunao: "すなお", kimagure: "きまぐれ", kimuzukashii: "気難しい" };

// ── レア度（白→銀→金→虹）＝その土地の竜リスト内の位置。レアほど出にくい。
function stalkTier(locId, dragonId) {
  const loc = scoutLocation(locId);
  const ids = (loc && loc.dragons) || [];
  const i = ids.indexOf(dragonId);
  if (i < 0 || ids.length < 2) return 0;
  const p = i / (ids.length - 1);
  return p >= 0.99 ? 3 : p >= 0.7 ? 2 : p >= 0.4 ? 1 : 0;
}
const STALK_TIER = [
  { nm: "",   cls: "t0", w: 100 },
  { nm: "銀", cls: "t1", w: 55 },
  { nm: "金", cls: "t2", w: 25 },
  { nm: "虹", cls: "t3", w: 10 },
];

// ── 出発 ─────────────────────────────────────────────────────────────────
function stalkDepart(locId) {
  const loc = scoutLocation(locId);
  state.ui.screen = "scout";
  const app = beginScreen();
  const head = el("div", "sc-probe-hero");
  head.innerHTML = _scBgTag(locId, "sc-stage-bg") +
    `<div class="sc-stage-vig"></div>` +
    `<div class="sc-probe-t"><b>${loc.ic} ${loc.name}</b><small>${loc.mood}</small></div>`;
  app.appendChild(head);

  const cost = loc.cost || 0;
  const canPay = (state.player.coins || 0) >= cost;
  app.appendChild(el("div", "sc-sec", "🐾 しのびあし（試作）"));
  app.appendChild(el("div", "stalk-hint",
    `<span>👣 1歩うごくと、竜も1手</span><span>🟡のマスは「見えている」</span>` +
    `<span>🌾 に入るとかくれられる</span><span>竜のよこ・うしろの♡マスに立てたら成立</span>`));
  const go = el("button", "navpop-go stalk-go" + (canPay ? "" : " is-off"),
    `🌾 そっと近づいてみる <small>🪙${cost.toLocaleString("ja-JP")}</small>`);
  if (canPay) go.onclick = () => {
    state.player.coins -= cost;
    if (typeof updateHeader === "function") updateHeader();
    state.player._scoutTrips = (state.player._scoutTrips || 0) + 1;
    if (typeof saveGame === "function") saveGame();
    _stalkRoll(locId);
  };
  else go.disabled = true;
  app.appendChild(go);
  app.appendChild(el("div", "sc-cost", `🪙 旅費 <b>${cost.toLocaleString("ja-JP")}</b>（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）` + (canPay ? "" : `<span class="sc-poor-note">コインが足りません</span>`)));
  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 場所をえらび直す"); back.onclick = () => renderScout();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ── 抽選と出現演出（射幸の芯・数値に触れない）────────────────────────────
function _stalkRoll(locId) {
  const pool = unscoutedAtLocation(locId);
  if (!pool.length) { renderScout(); return; }
  const weighted = pool.map(d => ({ d, t: stalkTier(locId, d.id) }));
  let total = 0; weighted.forEach(w => total += STALK_TIER[w.t].w);
  let r = Math.random() * total, pick = weighted[0];
  for (const w of weighted) { r -= STALK_TIER[w.t].w; if (r <= 0) { pick = w; break; } }
  _stalkReveal(locId, pick.d, pick.t);
}
function _stalkReveal(locId, d, tier) {
  const ov = el("div", "stalk-reveal");
  ov.innerHTML = `<div class="stalk-rv-bush">🌾</div><div class="stalk-rv-ring"></div>`;
  document.body.appendChild(ov);
  try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
  let stage = 0;
  const step = () => {
    if (!ov.isConnected) return;
    ov.className = "stalk-reveal s" + Math.min(stage, tier);
    try { if (window.Sfx) Sfx.play(stage > 0 ? "coin" : "click"); } catch (e) {}
    if (stage >= tier) { setTimeout(() => _stalkRevealEnd(ov, locId, d, tier), 640); return; }
    stage++;
    setTimeout(step, 620 + stage * 260);
  };
  setTimeout(step, 480);
}
function _stalkRevealEnd(ov, locId, d, tier) {
  if (!ov.isConnected) return;
  ov.classList.add("open");
  const card = el("div", "stalk-rv-card " + STALK_TIER[tier].cls);
  card.innerHTML =
    `<img class="stalk-rv-img" alt="">` +
    `<b>${d.name}</b><small>${STALK_TIER[tier].nm ? "✨" + STALK_TIER[tier].nm + "クラス・" : ""}気性 ${STALK_TEMPER_JA[stalkTemper(d)]}</small>`;
  ov.appendChild(card);
  _scSpriteInto(card.querySelector(".stalk-rv-img"), d.id);
  try { if (window.Sfx) Sfx.play(tier >= 2 ? "legendary" : "coin"); } catch (e) {}
  setTimeout(() => { ov.remove(); _stalkStart(locId, d, tier); }, 1750);
}

// ── 盤面開始 ─────────────────────────────────────────────────────────────
function _stalkStart(locId, d, tier) {
  const map = STALK_MAPS[(Math.random() * STALK_MAPS.length) | 0];
  _stalk = {
    locId, d, tier, map,
    temper: stalkTemper(d),
    mimi: { c: 3, r: STALK_ROWS - 1 },
    drg: { c: 3, r: 1, dir: (Math.random() < 0.5 ? 1 : 3) },   // dir 1=左 3=右（左右のみ＝絵と一致）
    alarm: 0, turn: 0, moveStreak: 0,
    sleeping: false, sweeping: false, over: false,
  };
  _stalkRender();
}

function _stalkCell(c, r) {
  if (c < 0 || r < 0 || c >= STALK_COLS || r >= STALK_ROWS) return "R";
  return _stalk.map[r][c] === "B" ? "B" : _stalk.map[r][c] === "R" ? "R" : ".";
}
// 視線が通るか（岩・草やぶが間にあれば遮られる）
function _stalkLos(c0, r0, c1, r1) {
  const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 6;
  for (let i = 1; i < n; i++) {
    const c = Math.round(c0 + (c1 - c0) * i / n), r = Math.round(r0 + (r1 - r0) * i / n);
    if ((c === c1 && r === r1) || (c === c0 && r === r0)) continue;
    const t = _stalkCell(c, r);
    if (t === "R" || t === "B") return false;
  }
  return true;
}
// 任意の竜状態での視界。戻り値 {vis:[], shade:[]}＝見えるマス／陰（視界内だが遮られて安全）
function _stalkVisionOf(gc, gr, dir, sweeping, sleeping, temper) {
  const vis = [], shade = [];
  if (sleeping) return { vis, shade };
  const narrow = temper === "kimuzukashii";
  const range = sweeping ? STALK_R : (narrow ? 5 : STALK_R);
  const dx = dir === 1 ? -1 : 1;
  for (let r = 0; r < STALK_ROWS; r++) for (let c = 0; c < STALK_COLS; c++) {
    const dc = c - gc, dr = r - gr;
    if (!dc && !dr) continue;
    const dist = Math.max(Math.abs(dc), Math.abs(dr));
    if (dist > range) continue;
    if (!sweeping) {
      if (dc * dx <= 0) continue;                        // 向いている側だけ（左右の半分）
      const cos = (dc * dx) / Math.sqrt(dc * dc + dr * dr);
      if (cos < (narrow ? 0.86 : 0.55)) continue;        // ふつう90°／気難しい＝細長い
    }
    const key = c + "," + r;
    if (_stalkLos(gc, gr, c, r)) vis.push(key);
    else shade.push(key);                                // 陰＝安全がちゃんと見えるように塗る
  }
  return { vis, shade };
}
function _stalkVision() {
  const s = _stalk;
  return _stalkVisionOf(s.drg.c, s.drg.r, s.drg.dir, s.sweeping, s.sleeping, s.temper);
}
function _stalkSeen(v) {
  const s = _stalk;
  if (_stalkCell(s.mimi.c, s.mimi.r) === "B") return false;   // 草やぶの中＝見えない
  return (v || _stalkVision()).vis.indexOf(s.mimi.c + "," + s.mimi.r) >= 0;
}

// ── 竜の「つぎの一手」（＝予告に使う。じっとしていた場合の確定手）─────────
function _stalkNextPlan() {
  const s = _stalk, t = s.turn + 1;
  const plan = { dir: s.drg.dir, sweeping: false, sleeping: false };
  if (_stalkIsSweepTurn(t)) { plan.sweeping = true; return plan; }
  if (s.temper === "calm") { if (t % 3 === 0) plan.dir = 4 - s.drg.dir; }
  else if (s.temper === "sunao") { if (t % 2 === 0) plan.dir = 4 - s.drg.dir; }
  else if (s.temper === "kimagure") {
    if (t % 3 === 0) plan.sleeping = true;
    else plan.dir = (t % 6) < 3 ? 1 : 3;
  } else { if (t % 3 === 0) plan.dir = 4 - s.drg.dir; }   // 気難しい（音を立てなければ）
  return plan;
}

// ── 1ターン：ミミの一手 → 触れる判定 → 竜の一手 → 発見判定 ───────────────
function stalkAct(kind, dc, dr) {
  const s = _stalk; if (!s || s.over) return;
  s.turn++;
  if (kind === "move") {
    const nc = s.mimi.c + dc, nr = s.mimi.r + dr;
    if (_stalkCell(nc, nr) === "R") { s.turn--; return; }
    if (nc === s.drg.c && nr === s.drg.r) { s.turn--; return; }
    s.mimi.c = nc; s.mimi.r = nr;
    s.moveStreak++;
  } else {
    s.moveStreak = 0;                                    // じっと＝音を消す
  }

  // 触れる判定＝竜の左右となり（♡マス）に立った瞬間
  const horizAdj = Math.abs(s.mimi.c - s.drg.c) === 1 && s.mimi.r === s.drg.r;
  if (horizAdj) {
    if (!_stalkSeen()) { _stalkWin(); return; }
    // ★見られたまま正面から触ろうとした＝その場で驚いて跳びのく（無反応をなくす）
    s.alarm++; s.flash = "alarm";
    s.drg.dir = (s.mimi.c < s.drg.c) ? 1 : 3;
    _stalkFleeStep();
    try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
    if (s.alarm >= 3) { _stalkLose(); return; }
    _stalkRender(); return;
  }

  if (s.turn >= STALK_TURNS) { _stalkLose(); return; }   // 👣切れ＝飽きて飛び去る

  _stalkDragonAct();
  if (s.over) return;

  if (_stalkSeen()) {
    s.alarm++; s.flash = "alarm";
    if (s.mimi.c !== s.drg.c) s.drg.dir = (s.mimi.c < s.drg.c) ? 1 : 3;   // 見つけた側を向く
    try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
    if (s.alarm >= 3) { _stalkLose(); return; }
  } else s.flash = null;
  _stalkRender();
}

function _stalkDragonAct() {
  const s = _stalk, g = s.drg;
  s.sleeping = false; s.sweeping = false;
  if (_stalkIsSweepTurn(s.turn)) { s.sweeping = true; return; }
  if (s.temper === "calm") {
    if (s.turn % 3 === 0) g.dir = 4 - g.dir;
  } else if (s.temper === "sunao") {
    if (s.turn % 2 === 0) g.dir = 4 - g.dir;
    if (s.alarm > 0) _stalkFleeStep();
  } else if (s.temper === "kimagure") {
    if (s.turn % 3 === 0) { s.sleeping = true; _stalkWander(); }
    else g.dir = (s.turn % 6) < 3 ? 1 : 3;
  } else {                                               // 気難しい：2歩つづけて動くと音でバレる
    if (s.moveStreak >= 2 && s.mimi.c !== g.c) g.dir = (s.mimi.c < g.c) ? 1 : 3;
    else if (s.turn % 3 === 0) g.dir = 4 - g.dir;
  }
}
function _stalkWander() {
  const s = _stalk, g = s.drg;
  const dirs = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const p = dirs[(s.turn / 3 | 0) % 4];
  const nc = g.c + p[0], nr = g.r + p[1];
  if (_stalkCell(nc, nr) === "." && !(nc === s.mimi.c && nr === s.mimi.r)) { g.c = nc; g.r = nr; }
}
function _stalkFleeStep() {
  const s = _stalk, g = s.drg;
  const dc = Math.sign(g.c - s.mimi.c), dr = Math.sign(g.r - s.mimi.r);
  const tryCells = [[g.c + dc, g.r], [g.c, g.r + dr]];
  for (const [nc, nr] of tryCells) {
    if (_stalkCell(nc, nr) === "." && !(nc === s.mimi.c && nr === s.mimi.r)) { g.c = nc; g.r = nr; return; }
  }
}

// ── 決着 ────────────────────────────────────────────────────────────────
function _stalkWin() {
  const s = _stalk; s.over = true;
  _scoutMeetD = s.d; _scoutSess = null;
  _stalkRender();
  const host = document.querySelector(".stalk-board");
  if (host) host.appendChild(el("div", "stalk-heart", "♡"));
  setTimeout(() => { _stalk = null; _scoutWin(); }, 900);
}
function _stalkLose() {
  const s = _stalk; s.over = true; s.flash = "flee";
  _stalkRender();
  const locId = s.locId, cost = (scoutLocation(locId) || {}).cost || 0;
  setTimeout(() => {
    _stalk = null;
    const canPay = (state.player.coins || 0) >= cost;
    showInfoPopup("🍃 逃げられた……",
      `<div class="mm-row"><span class="mm-ic">💨</span><div><b>竜は飛び去ってしまった。</b><small>気配を消して、もう一度。竜は消えない＝何度でも会いにいける。</small></div></div>`,
      () => renderScout());
    setTimeout(() => {
      const pop = document.querySelector(".mm-pop, .info-pop, .navpop");
      if (!pop || !canPay) return;
      const again = el("button", "navpop-go stalk-again", `🌾 もういちど探す <small>🪙${cost.toLocaleString("ja-JP")}</small>`);
      again.onclick = () => {
        document.querySelectorAll(".mm-ov,.info-ov,.navpop-ov").forEach(o => o.remove());
        state.player.coins -= cost;
        if (typeof updateHeader === "function") updateHeader();
        state.player._scoutTrips = (state.player._scoutTrips || 0) + 1;
        if (typeof saveGame === "function") saveGame();
        _stalkRoll(locId);
      };
      pop.appendChild(again);
    }, 60);
  }, 950);
}

// ── 描画 ────────────────────────────────────────────────────────────────
function _stalkRender() {
  const s = _stalk; if (!s) return;
  state.ui.screen = "scout";
  let app = document.querySelector("#app");
  let wrap = app.querySelector(".stalk-wrap");
  if (!wrap) {
    app = beginScreen();
    wrap = el("div", "stalk-wrap");
    app.appendChild(wrap);
  }
  const v = _stalkVision();
  const plan = s.over ? null : _stalkNextPlan();
  const nv = plan ? _stalkVisionOf(s.drg.c, s.drg.r, plan.dir, plan.sweeping, plan.sleeping, s.temper) : { vis: [] };
  const cw = 100 / STALK_COLS, chh = 100 / STALK_ROWS;
  let cells = "";
  for (let r = 0; r < STALK_ROWS; r++) for (let c = 0; c < STALK_COLS; c++) {
    const t = _stalkCell(c, r);
    const key = c + "," + r;
    const vis = v.vis.indexOf(key) >= 0;
    const shade = !vis && v.shade.indexOf(key) >= 0;
    const nvis = !vis && !plan?.sweeping && nv.vis.indexOf(key) >= 0;   // つぎ見られるマス（薄い縞）
    const canGo = !s.over && Math.abs(c - s.mimi.c) + Math.abs(r - s.mimi.r) === 1 && t !== "R" && !(c === s.drg.c && r === s.drg.r);
    // ♡＝竜の左右2マスだけ（顔の横に回り込む）。いま見えている側は薄い＝正面はダメ、が見える。
    const goal = t !== "R" && Math.abs(c - s.drg.c) === 1 && r === s.drg.r;
    cells += `<div class="stalk-cell${vis ? " vis" : ""}${shade ? " shade" : ""}${nvis ? " nvis" : ""}${canGo ? " go" : ""}${t === "B" ? " bushcell" : ""}${goal ? (vis ? " goal-off" : " goal") : ""}" data-c="${c}" data-r="${r}"` +
      ` style="left:${c * cw}%;top:${r * chh}%;width:${cw}%;height:${chh}%">` +
      (t === "B" ? `<span class="stalk-bush">🌾</span>` : t === "R" ? `<span class="stalk-rock">🪨</span>` : "") +
      (goal ? `<span class="stalk-goal-heart">♡</span>` : "") +
      `</div>`;
  }
  const hidden = _stalkCell(s.mimi.c, s.mimi.r) === "B";
  const willFlip = plan && !plan.sweeping && !plan.sleeping && plan.dir !== s.drg.dir;
  wrap.innerHTML =
    `<div class="stalk-top">` +
      `<button class="stalk-quit">← あきらめる</button>` +
      `<span class="stalk-name">${s.d.name}${STALK_TIER[s.tier].nm ? `<i class="stalk-tier ${STALK_TIER[s.tier].cls}">✨${STALK_TIER[s.tier].nm}</i>` : ""}</span>` +
      `<span class="stalk-pips">${[0, 1, 2].map(i => `<i class="${i < s.alarm ? "on" : ""}">！</i>`).join("")}</span>` +
    `</div>` +
    `<div class="stalk-board${s.flash === "alarm" ? " alarm" : ""}${s.flash === "flee" ? " flee" : ""}">` +
      _scBgTag(s.locId, "stalk-bg") +
      `<div class="stalk-grid">${cells}</div>` +
      `<div class="stalk-drg${s.sweeping ? " sweeping" : ""}" style="left:${(s.drg.c + 0.5) * cw}%;top:${(s.drg.r + 0.62) * chh}%">` +
        // ★HD-2Dスプライトの素材は**右向きが標準**（草むら6頭を並べて実測）。左を向くときだけ反転。
        //   以前は逆（右で反転）だったため、絵の向きと視界が常に食い違っていた（ユーザー指摘2回目）。
        `<img class="stalk-drg-img${s.drg.dir === 1 ? " flip" : ""}" alt="">` +
        (s.sleeping ? `<span class="stalk-zzz">💤</span>` : "") +
        // ★予告（つぎの一手）＝考えて動くための情報。↩=振り向く／💤=居眠り／⚠=見回し
        (!s.over && plan && plan.sweeping ? `<span class="stalk-warn">⚠</span>` : "") +
        (!s.over && plan && plan.sleeping ? `<span class="stalk-next">💤…</span>` : "") +
        (!s.over && willFlip ? `<span class="stalk-next stalk-next-flip${plan.dir === 3 ? " fr" : ""}">↩</span>` : "") +
        (s.sweeping ? `<span class="stalk-eyes">👀</span>` : "") +
        (s.flash === "alarm" ? `<span class="stalk-ex">！</span>` : "") +
      `</div>` +
      `<div class="stalk-mimi${hidden ? " hid" : ""}" style="left:${(s.mimi.c + 0.5) * cw}%;top:${(s.mimi.r + 0.72) * chh}%">` +
        (hidden ? `<i class="stalk-hidegrass">🌾</i>` : "") +
      `</div>` +
    `</div>` +
    `<div class="stalk-foot"><span class="stalk-turn${STALK_TURNS - s.turn <= 5 ? " low" : ""}">👣 ${STALK_TURNS - s.turn}</span>` +
      `<button class="stalk-wait">🐾 じっとする</button></div>` +
    `<div class="stalk-legend"><span><i class="lg lg-vis"></i>みつかる</span><span><i class="lg lg-nvis"></i>つぎ見られる</span>` +
      `<span><i class="lg lg-shade"></i>かげ＝安全</span><span>🌾 かくれる</span><span>♡ ゴール</span></div>`;
  _scSpriteInto(wrap.querySelector(".stalk-drg-img"), s.d.id);
  wrap.querySelector(".stalk-quit").onclick = () => { _stalk = null; renderScout(); };
  wrap.querySelector(".stalk-wait").onclick = () => stalkAct("wait");
  wrap.querySelectorAll(".stalk-cell.go").forEach(cell => {
    cell.onclick = () => stalkAct("move",
      parseInt(cell.getAttribute("data-c")) - s.mimi.c,
      parseInt(cell.getAttribute("data-r")) - s.mimi.r);
  });
  _stalkCoachMaybe(wrap);
}

// ── 教える層＝「その瞬間に1行だけ」大きく（読まれない説明カードは廃止）────
function _stalkBanner(wrap, msg, sticky) {
  const old = wrap.querySelector(".stalk-banner"); if (old) old.remove();
  const b = el("div", "stalk-banner", msg);
  (wrap.querySelector(".stalk-board") || wrap).appendChild(b);
  if (!sticky) setTimeout(() => b.remove(), 2600);
}
function _stalkCoachMaybe(wrap) {
  const s = _stalk, p = state.player;
  if (!s || s.over) return;
  if (!p._stalkCoach) {
    if (s.turn === 0) { _stalkBanner(wrap, "🔵 をタップで いどう", true); return; }
    if (s.turn === 1) { _stalkBanner(wrap, "🟡 は 竜から<b>見えている</b>"); return; }
    if (s.turn === 2) {
      _stalkBanner(wrap, "♡ （竜のよこ）に 立てたら成立");
      p._stalkCoach = 1; if (typeof saveGame === "function") saveGame();
      return;
    }
    return;
  }
  _stalkEventTips(wrap);
}
function _stalkTip(wrap, msg) {
  const t = el("div", "stalk-tipmsg", msg);
  (wrap.querySelector(".stalk-board") || wrap).appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function _stalkEventTips(wrap) {
  const s = _stalk, p = state.player;
  if (!s) return;
  if (s.flash === "alarm" && !p._stalkTipAlarm) {
    p._stalkTipAlarm = 1; if (typeof saveGame === "function") saveGame();
    _stalkTip(wrap, "みつかった！　<b>！が3つ</b>で 逃げられちゃう");
  } else if (!s.sweeping && _stalkIsSweepTurn(s.turn + 1) && !p._stalkTipSweep) {
    p._stalkTipSweep = 1; if (typeof saveGame === "function") saveGame();
    _stalkTip(wrap, "⚠ ＝ つぎの手で <b>ぐるっと見回す</b>。🌾へかくれるか、はなれて！");
  }
}

// キー操作（任意）：矢印＝移動・スペース＝じっと
document.addEventListener("keydown", function (e) {
  if (!_stalk || _stalk.over) return;
  const k = e.key;
  if (k === "ArrowUp") stalkAct("move", 0, -1);
  else if (k === "ArrowDown") stalkAct("move", 0, 1);
  else if (k === "ArrowLeft") stalkAct("move", -1, 0);
  else if (k === "ArrowRight") stalkAct("move", 1, 0);
  else if (k === " ") { e.preventDefault(); stalkAct("wait"); }
});
