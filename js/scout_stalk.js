// =========================================================================
// 🐾 しのびあし（竜スカウトの新ミニゲーム・縦切り試作＝草むらのみ）
//   旧「読み合い／ダンス」はユーザー評価により撤去方向。本作は**完全ターン制**：
//   こちらが1マス動くと竜も1手動く。それ以外の時間は完全静止＝ラグ・反射神経が
//   原理的に影響しない。説明文なし＝視界の色マス・！・♡・💤の絵で全部語る。
//
//   射幸性（ユーザー要望）＝「誰が出るか」の抽選と出現演出に段階（白→銀→金→虹）。
//   コイン・レースの数値には一切触れない（旅費の精算は従来と同じ場所・同じ額）。
//
//   竜の絵は既存HD-2Dスプライト（_scSpriteInto）を使い回し＝52頭ぶん新規画像ゼロ。
//   個性（気性）は絵ではなくルールで出す：
//     おだやか＝2手に1回だけ時計回りに向きを変える。動かない。
//     すなお　＝毎手時計回り。警戒すると1歩逃げる。
//     きまぐれ＝右→左→💤（居眠り＝見えない）の3拍子。居眠り明けに1歩さまよう。
//     気難しい＝視界が広く浅い。**連続で動くと**音で気づいてこちらを向く（じっと＝リセット）。
//
//   表示専用。レースの着順・オッズ・配当は不変。
// =========================================================================

const STALK_COLS = 7, STALK_ROWS = 8;
const STALK_R = 3;                      // 視界の届くマス数
const STALK_TURNS = 24;                 // 👣この手数で竜は飽きて飛び去る（間延び防止＋「急ぐか隠れるか」の張り）
let _stalk = null;                      // 進行中の盤面

// 見回し（ターン制版の「だるまさんがころんだ」）＝周期ごとに全方位を見渡す。
//   1手前に⚠で予告される＝理不尽なし。茂みの中か、届かない距離だけが安全。
const STALK_SWEEP = { calm: 5, sunao: 4, kimagure: 6, kimuzukashii: 3 };
function _stalkIsSweepTurn(t) { const p = STALK_SWEEP[_stalk.temper] || 5; return t > 0 && t % p === 0; }

function stalkAvailable(locId) { return locId === "grass"; }   // 縦切り＝草むらのみ

// ── 盤面レイアウト（3種からランダム）。'B'=茂み(入れる・隠れる) 'R'=岩(通れない・視線を遮る)
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

// ── 気性：既存の nerve（poroTemperLabel と同じ切り方）→ ルールへ
function stalkTemper(d) {
  const n = (d && d.stats && d.stats.nerve) || 50;
  return n >= 78 ? "calm" : n >= 60 ? "sunao" : n >= 45 ? "kimagure" : "kimuzukashii";
}
const STALK_TEMPER_JA = { calm: "おだやか", sunao: "すなお", kimagure: "きまぐれ", kimuzukashii: "気難しい" };

// ── レア度：その土地の竜リスト内での位置で段階付け（白→銀→金→虹）
function stalkTier(locId, dragonId) {
  const loc = scoutLocation(locId);
  const ids = (loc && loc.dragons) || [];
  const i = ids.indexOf(dragonId);
  if (i < 0 || ids.length < 2) return 0;
  const p = i / (ids.length - 1);
  return p >= 0.99 ? 3 : p >= 0.7 ? 2 : p >= 0.4 ? 1 : 0;
}
const STALK_TIER = [
  { nm: "",     cls: "t0", w: 100 },
  { nm: "銀",   cls: "t1", w: 55 },
  { nm: "金",   cls: "t2", w: 25 },
  { nm: "虹",   cls: "t3", w: 10 },
];

// ── 出発（試作の支度画面＝手土産・探し方は使わない。旅費だけ）─────────────
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
    `<span>🌿 に入るとかくれられる</span><span>うしろか横から、となりに立てたら成立</span>`));
  const go = el("button", "navpop-go stalk-go" + (canPay ? "" : " is-off"),
    `🌿 そっと近づいてみる <small>🪙${cost.toLocaleString("ja-JP")}</small>`);
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

// ── 抽選：誰が出るか（レアほど出にくい）→ 出現演出（白→銀→金→虹の段階リーチ）
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
  ov.innerHTML = `<div class="stalk-rv-bush">🌿</div><div class="stalk-rv-ring"></div>`;
  document.body.appendChild(ov);
  try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
  // 段階リーチ：実レア度まで1段ずつ色が上がる（gap は徐々にためる）
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
    drg: { c: 3, r: 1, dir: 0 },       // dir 0=下(こちら向き) 1=左 2=上 3=右
    alarm: 0, turn: 0, phase: 0, moveStreak: 0,
    sleeping: false, over: false,
  };
  _stalkRender();
}

function _stalkCell(c, r) {
  if (c < 0 || r < 0 || c >= STALK_COLS || r >= STALK_ROWS) return "R";
  return _stalk.map[r][c] === "B" ? "B" : _stalk.map[r][c] === "R" ? "R" : ".";
}
// 視線が通るか（岩・茂みが間にあれば遮られる）
function _stalkLos(c0, r0, c1, r1) {
  const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 3;
  for (let i = 1; i < n; i++) {
    const c = Math.round(c0 + (c1 - c0) * i / n), r = Math.round(r0 + (r1 - r0) * i / n);
    if (c === c1 && r === r1) continue;
    if (c === c0 && r === r0) continue;
    const t = _stalkCell(c, r);
    if (t === "R" || t === "B") return false;
  }
  return true;
}
// いま竜から「見えている」マス（＝黄色く塗るマス）。眠り中は空。
function _stalkVision() {
  const s = _stalk, out = [];
  if (s.sleeping) return out;
  const sweeping = !!s.sweeping;                          // 見回し中＝全方位
  const range = sweeping ? STALK_R : (s.temper === "kimuzukashii" ? 2 : STALK_R);
  const wide = s.temper === "kimuzukashii";               // 気難しい＝180°
  const DV = [[0, 1], [-1, 0], [0, -1], [1, 0]][s.drg.dir];
  for (let r = 0; r < STALK_ROWS; r++) for (let c = 0; c < STALK_COLS; c++) {
    const dc = c - s.drg.c, dr = r - s.drg.r;
    if (!dc && !dr) continue;
    const dist = Math.max(Math.abs(dc), Math.abs(dr));
    if (dist > range) continue;
    if (!sweeping) {
      const dot = dc * DV[0] + dr * DV[1];
      const len = Math.sqrt(dc * dc + dr * dr);
      const cos = dot / len;
      if (cos < (wide ? 0.05 : 0.55)) continue;           // 90°（wideは180°）の扇
    }
    if (!_stalkLos(s.drg.c, s.drg.r, c, r)) continue;
    out.push(c + "," + r);
  }
  return out;
}
function _stalkSeen(vision) {
  const s = _stalk;
  if (_stalkCell(s.mimi.c, s.mimi.r) === "B") return false;   // 茂みの中＝見えない
  return (vision || _stalkVision()).indexOf(s.mimi.c + "," + s.mimi.r) >= 0;
}

// ── 1ターン：プレイヤーの一手 → 成立判定 → 竜の一手 → 発見判定 ─────────
function stalkAct(kind, dc, dr) {
  const s = _stalk; if (!s || s.over) return;
  s.turn++;
  if (kind === "move") {
    const nc = s.mimi.c + dc, nr = s.mimi.r + dr;
    if (_stalkCell(nc, nr) === "R") return;                // 岩＝そもそも受け付けない
    if (nc === s.drg.c && nr === s.drg.r) return;
    s.mimi.c = nc; s.mimi.r = nr;
    s.moveStreak++;
    s.lastMove = [dc, dr];
  } else {
    s.moveStreak = 0;                                      // じっと＝音を消す
  }

  // 成立：竜のとなり（4方向）＆ いま見られていない
  const adj = Math.abs(s.mimi.c - s.drg.c) + Math.abs(s.mimi.r - s.drg.r) === 1;
  if (adj && !_stalkSeen()) { _stalkWin(); return; }

  // 👣使い切り＝竜は飽きて飛び去る（間延び防止）
  if (s.turn >= STALK_TURNS) { _stalkLose(); return; }

  _stalkDragonAct();
  if (s.over) return;

  // 発見判定
  if (_stalkSeen()) {
    s.alarm++;
    s.flash = "alarm";
    // 見つかった方を向く（次の手が考えやすい＝理不尽をなくす）
    const dcm = s.mimi.c - s.drg.c, drm = s.mimi.r - s.drg.r;
    s.drg.dir = Math.abs(dcm) > Math.abs(drm) ? (dcm < 0 ? 1 : 3) : (drm < 0 ? 2 : 0);
    try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
    if (s.alarm >= 3) { _stalkLose(); return; }
  } else s.flash = null;
  _stalkRender();
}

function _stalkDragonAct() {
  const s = _stalk, g = s.drg;
  s.sleeping = false;
  s.sweeping = false;
  // 見回し（予告済みのターン）＝この手は向き替えの代わりに、ぐるりと全方位を見渡す
  if (_stalkIsSweepTurn(s.turn)) { s.sweeping = true; return; }
  if (s.temper === "calm") {
    if (s.turn % 2 === 0) g.dir = (g.dir + 1) % 4;
  } else if (s.temper === "sunao") {
    g.dir = (g.dir + 1) % 4;
    if (s.alarm > 0) _stalkFleeStep();                     // 一度でも警戒したら逃げ腰
  } else if (s.temper === "kimagure") {
    const ph = s.turn % 3;
    if (ph === 1) g.dir = (g.dir + 1) % 4;
    else if (ph === 2) g.dir = (g.dir + 3) % 4;
    else { s.sleeping = true; _stalkWander(); }            // 💤＝見えない。そのすきに
  } else {                                                  // 気難しい：連続で動くと音で気づく
    if (s.moveStreak >= 2) {
      const dc = s.mimi.c - g.c, dr = s.mimi.r - g.r;
      g.dir = Math.abs(dc) > Math.abs(dr) ? (dc < 0 ? 1 : 3) : (dr < 0 ? 2 : 0);
    } else if (s.turn % 3 === 0) g.dir = (g.dir + 1) % 4;
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
  _stalkRender();                                          // ♡の一拍を見せてから
  const host = document.querySelector(".stalk-board");
  if (host) {
    const fx = el("div", "stalk-heart", "♡");
    host.appendChild(fx);
  }
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
    // もう一度ボタン（射幸のループ＝すぐ次を引ける）
    setTimeout(() => {
      const pop = document.querySelector(".mm-pop, .info-pop, .navpop");
      if (!pop || !canPay) return;
      const again = el("button", "navpop-go stalk-again", `🌿 もういちど探す <small>🪙${cost.toLocaleString("ja-JP")}</small>`);
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

// ── 描画（DOMだけ・毎手描き直す＝ターン制なので十分軽い）────────────────
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
  const vision = _stalkVision();
  const cw = 100 / STALK_COLS, chh = 100 / STALK_ROWS;
  let cells = "";
  for (let r = 0; r < STALK_ROWS; r++) for (let c = 0; c < STALK_COLS; c++) {
    const t = _stalkCell(c, r);
    const vis = vision.indexOf(c + "," + r) >= 0;
    const canGo = !s.over && Math.abs(c - s.mimi.c) + Math.abs(r - s.mimi.r) === 1 && t !== "R" && !(c === s.drg.c && r === s.drg.r);
    // ★ゴールを盤面に描く：竜のとなり4マス＝♡。いま見えているマスの♡は薄く（そこからは成立しない）
    //   ＝「どこへ行けばいいの？」を文章でなく盤面が答える（初見で伝わらなかった反省）。
    const goal = t !== "R" && Math.abs(c - s.drg.c) + Math.abs(r - s.drg.r) === 1;
    cells += `<div class="stalk-cell${vis ? " vis" : ""}${canGo ? " go" : ""}${goal ? (vis && t !== "B" ? " goal-off" : " goal") : ""}" data-c="${c}" data-r="${r}"` +
      ` style="left:${c * cw}%;top:${r * chh}%;width:${cw}%;height:${chh}%">` +
      (t === "B" ? `<span class="stalk-bush">🌿</span>` : t === "R" ? `<span class="stalk-rock">🪨</span>` : "") +
      (goal ? `<span class="stalk-goal-heart">♡</span>` : "") +
      `</div>`;
  }
  const hidden = _stalkCell(s.mimi.c, s.mimi.r) === "B";
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
        `<img class="stalk-drg-img${s.drg.dir === 3 ? " flip" : ""}" alt="">` +
        (s.sleeping ? `<span class="stalk-zzz">💤</span>` : "") +
        (!s.over && !s.sweeping && _stalkIsSweepTurn(s.turn + 1) ? `<span class="stalk-warn">⚠</span>` : "") +
        (s.sweeping ? `<span class="stalk-eyes">👀</span>` : "") +
        (s.flash === "alarm" ? `<span class="stalk-ex">！</span>` : "") +
      `</div>` +
      `<div class="stalk-mimi${hidden ? " hid" : ""}" style="left:${(s.mimi.c + 0.5) * cw}%;top:${(s.mimi.r + 0.72) * chh}%"></div>` +
    `</div>` +
    `<div class="stalk-foot"><span class="stalk-turn${STALK_TURNS - s.turn <= 5 ? " low" : ""}">👣 ${STALK_TURNS - s.turn}</span>` +
      `<button class="stalk-wait">🐾 じっとする</button></div>`;
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

// ── はじめてでも分かるように（説明書ではなく、その場で1つずつ）──────────
//   ①初回だけ：3タップの絵解き（青マル→黄マス→♡）②初めて見つかった時・初めて⚠が出た時に一言。
//   「画面が語るから説明不要」は設計者の思い込みだった（ユーザー指摘）ので、教える層を足す。
function _stalkCoachMaybe(wrap) {
  const p = state.player;
  if (p._stalkCoach) { _stalkEventTips(wrap); return; }
  const steps = [
    { ic: "🔵", tx: "青いマル ＝ あるける場所<br>タップで 1歩すすむ" },
    { ic: "🟡", tx: "黄色いマス ＝ 竜から<b>見えている</b><br>🌿に入れば かくれられる" },
    { ic: "♡", tx: "竜のとなりの<b>♡マス</b>にたどりつけたら<br>なかよし成立！（正面からはダメ）" },
  ];
  let i = 0;
  const ov = el("div", "stalk-coach");
  const card = el("div", "stalk-coach-card");
  const draw = () => { card.innerHTML = `<span class="stalk-coach-ic">${steps[i].ic}</span><p>${steps[i].tx}</p><small>タップでつぎへ（${i + 1}/${steps.length}）</small>`; };
  draw();
  ov.appendChild(card);
  ov.onclick = () => {
    i++;
    if (i >= steps.length) { ov.remove(); p._stalkCoach = 1; if (typeof saveGame === "function") saveGame(); return; }
    draw();
  };
  wrap.appendChild(ov);
}
function _stalkTip(wrap, msg) {
  const t = el("div", "stalk-tipmsg", msg);
  (wrap.querySelector(".stalk-board") || wrap).appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
function _stalkEventTips(wrap) {
  const s = _stalk, p = state.player;
  if (!s) return;
  if (s.flash === "alarm" && !p._stalkTipAlarm) {
    p._stalkTipAlarm = 1; if (typeof saveGame === "function") saveGame();
    _stalkTip(wrap, "みつかった！　<b>！が3つ</b>で 逃げられちゃう");
  } else if (!s.sweeping && _stalkIsSweepTurn(s.turn + 1) && !p._stalkTipSweep) {
    p._stalkTipSweep = 1; if (typeof saveGame === "function") saveGame();
    _stalkTip(wrap, "⚠ ＝ つぎの手で <b>ぐるっと見回す</b>。🌿へかくれるか、はなれて！");
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
