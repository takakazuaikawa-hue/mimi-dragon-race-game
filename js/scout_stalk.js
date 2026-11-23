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

// 盤面の草やぶ・岩の絵（ロケごと）。旧＝絵文字🌾🪨で、描き込まれた背景の上で浮いていた。
//   images/scout/props/<ロケ>_{bush,rock}.webp。未知のロケは草むらの絵。
const STALK_PROP_LOCS = ["grass", "jungle", "cliff", "volcano", "sea", "sky"];
function _stalkProp(locId, kind) {
  const L = STALK_PROP_LOCS.indexOf(locId) >= 0 ? locId : "grass";
  return "images/scout/props/" + L + "_" + kind + ".webp";
}
const STALK_COLS = 7, STALK_ROWS = 8;
const STALK_R = 3;                      // 視界の届くマス数
const STALK_TURNS = 24;                 // 👣この手数で竜は飽きて飛び去る
let _stalk = null;

// 見回し（ターン制の「だるまさんがころんだ」）＝周期ごとに全方位を見渡す。⚠で1手前に予告。
// ※気難しいの見回し3手周期は、ソルバ検証で「一度も見られずに成立する手順が存在しない」盤面が
//   出たため4手に緩めた（細長い視界＋聞き耳が既に強い）。詰みの押し付けは理不尽＝射幸でもない。
const STALK_SWEEP = { calm: 5, sunao: 4, kimagure: 6, kimuzukashii: 4 };
const STALK_FIELD = {
  raiou: { start: [2, 1], note: "角に稲妻が集まると、雷雲に沿って横へひと跳びする。着地点の横へ回ろう。",
    signs: ["角の間を通り抜けるちぎれ雲を、目を細めて見送っている。", "雲が割れて青空がのぞくと、角の火花がふっと消えた。"] },
  goka: { start: [4, 2], note: "焼け石を続けて踏む音に、ゴウカの耳が動く。一歩止まると足音が途切れる。",
    signs: ["灰の上に残った旅人の靴跡を、鼻先で辿っている。", "ミミの靴裏の赤い土を嗅ぎ、火口の向こうへ続く峠道を見た。"] },
  glaze: { start: [3, 2], note: "氷甲のそばで一手待つと、グレイズが身を伏せてくれる。顔の前からでも手が届く。",
    signs: ["小竜を翼の陰に入れ、ミミにもそこへ来るよう、そっと顎を引いた。", "翼の陰でだけ、小さな声を漏らす。誰かが通ると、すっと口を閉じた。"] },
  souten: { start: [4, 1], note: "雲越しに動く影を追う。そばで足を止めると、ソウテンは反対の空へ顔を戻す。",
    signs: ["翼の先で、風に鳴る帆綱と同じ拍子を刻んでいる。", "ミミが一節口ずさむと、帆綱の音を離れ、その旋律に翼を合わせた。"] },
  yomi: { start: [2, 2], note: "潜り始めると真上の水面に泡が移る。目を閉じて浮く次の一手が、横へ入る潮時。",
    signs: ["流木の古い船印を見つけ、入り江の外に顔を向けた。", "島々を描いた航路図に鼻先をのせ、次の港を順に辿っている。"] },
  phenix: { start: [4, 2], note: "尾羽が燃えると、同じ列を上下に飛び移る。風下で待って、着地した翼の横へ。",
    signs: ["翼からこぼれた火の粉が上昇気流に乗るのを、いつまでも見ている。", "雲の切れ間を指すと首を伸ばし、空へ続く気流に片翼を差し出した。"] },
  fugaku: { start: [3, 2], note: "フガクは岩棚を動かず、四手に一度だけ辺りを見渡す。岩陰でやり過ごし、背へ回ろう。",
    signs: ["岩の割れ目を前脚で覆い、ミミにだけ指一本ぶん開けてみせた。", "足音が遠のいてから割れ目を開く。中の光る石を、ミミにだけ見せてくれた。"] }
};

// ★全ロケ展開（STALK_TALK_DIRECTIVE §4）。旧フロー（_scoutRenderProbe／scout_game.js の読み合い・
//   ダンス）は**呼ばれなくなるだけ**で残す＝1コミットで戻せる。盤面は3種共用・背景だけロケごと。
function stalkAvailable(locId) { return true; }

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
  // ★ロケの竜リストは SCOUT_LOCATIONS に**無い**（archs から scoutDragonHome で決定的に割り当てる）。
  //   旧実装は存在しない loc.dragons を見ていたため ids が常に空＝**全頭が「白」**になり、
  //   銀/金/虹のリーチ段階が一度も出ていなかった。正本は dragonsAtLocation()。
  const ids = (typeof dragonsAtLocation === "function" ? dragonsAtLocation(locId) : []).map(d => d.id);
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
// The last issue needs particular runners. After chapter five the island's
// press boat takes the reporter to their known habitat; earning friendship
// still uses the ordinary board and conversation, with no race intervention.
function stalkReportTarget(dragonId) {
  if (typeof chapterRead !== "function" || !chapterRead("5") ||
      typeof SHINGAN_ROSTER === "undefined" || !SHINGAN_ROSTER.some(d => d.id === dragonId && d.id !== "poro")) return null;
  const d = dragonById(dragonId), col = state.player.collection || {};
  if (!d || col[dragonId] && col[dragonId].scouted) return null;
  const locId = scoutDragonHome(d);
  return scoutLocationUnlocked(locId) ? { d, locId } : null;
}
function stalkReportDepart(dragonId) {
  const target = stalkReportTarget(dragonId);
  if (!target) { renderScout(); return; }
  const { d, locId } = target, loc = scoutLocation(locId);
  state.ui.screen = "scout";
  const app = beginScreen();
  app.appendChild(el("h2", null, "最後の一面 · 竜の取材便"));
  const hero = el("div", "sc-probe-hero");
  hero.innerHTML = _scBgTag(locId, "sc-stage-bg") + '<div class="sc-stage-vig"></div>' +
    '<div class="sc-probe-t"><b>' + loc.name + 'で、' + d.name + 'を探す</b><small>居場所を知る案内人が、現地まで連れていってくれる。</small></div>';
  app.appendChild(hero);
  app.appendChild(el("p", "stalk-hint", "旅費は島の編集部が手配。近づき方と話題は自分で考える。断られたら、現地からやり直せます。走りや着順は頼みません。"));
  const go = el("button", "navpop-go stalk-report-go", "取材便で会いに行く · 手持ちの支払いなし");
  go.onclick = () => {
    const current = stalkReportTarget(dragonId); if (!current) { renderScout(); return; }
    go.disabled = true;
    _stalkStart(current.locId, current.d, stalkTier(current.locId, dragonId), true);
  };
  app.appendChild(go);
  const back = el("button", "secondary", "取材する竜を選び直す"); back.onclick = () => renderScout(); app.appendChild(back);
}

function stalkDepart(locId) {
  const loc = scoutLocation(locId);
  // ★出発画面を開いた時点で、この土地の竜のスプライトを全員ぶん裏で焼き始める。
  //   出現カードの絵が遅れて出る（346ms実測）対策の1段目＝数秒の先行を稼ぐ。焼き済みはキャッシュ。
  try { unscoutedAtLocation(locId).forEach(d => { if (typeof _rcDragonSprite === "function") _rcDragonSprite(d.id); }); } catch (e) {}
  state.ui.screen = "scout";
  const app = beginScreen();
  const head = el("div", "sc-probe-hero");
  head.innerHTML = _scBgTag(locId, "sc-stage-bg") +
    `<div class="sc-stage-vig"></div>` +
    `<div class="sc-probe-t"><b>${loc.ic} ${loc.name}</b><small>${loc.mood}</small></div>`;
  app.appendChild(head);

  const cost = loc.cost || 0;
  const canPay = (state.player.coins || 0) >= cost;
  app.appendChild(el("div", "sc-sec", "🐾 しのびあし"));
  app.appendChild(el("div", "stalk-hint",
    `<span>👣 1歩うごくと、竜も1手</span><span>🟡のマスは「見えている」</span>` +
    `<span>🌾 に入るとかくれられる</span><span>竜のよこの♡に立てたら 🗣️話しかけ</span>`));
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
  // ★当たりが決まった瞬間にスプライトを裏で焼き始める＝茂みが揺れている約2〜3秒が読み込み時間。
  //   これをしないとカードの絵が遅れて出る（ユーザー指摘）。
  try { if (typeof _rcDragonSprite === "function") _rcDragonSprite(pick.d.id); } catch (e) {}
  _stalkReveal(locId, pick.d, pick.t);
}
function _stalkReveal(locId, d, tier) {
  const ov = el("div", "stalk-reveal");
  ov.innerHTML = `<div class="stalk-rv-bush"><img src="${_stalkProp(locId, "bush")}" alt=""></div><div class="stalk-rv-ring"></div>`;
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
function _stalkRevealEnd(ov, locId, d, tier, tries) {
  if (!ov.isConnected) return;
  // ★絵がまだ焼けていなければ、茂みを揺らしたままカードを最大1.2秒待つ＝空のカードを見せない。
  let ready = false;
  try { ready = !!(typeof _ecSpriteURL === "function" && _ecSpriteURL(d.id)); } catch (e) {}
  //   焼き上がりはキュー次第で数秒かかる（実測：待ち1.2秒でも382ms遅れ）。茂みが揺れ続けるのは
  //   演出として自然なので、最大4秒まで待って「絵が空のカード」だけは出さない。
  if (!ready && (tries | 0) < 26) { setTimeout(() => _stalkRevealEnd(ov, locId, d, tier, (tries | 0) + 1), 150); return; }
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
function stalkMapIndex(last, roll) {
  const validLast = Number.isInteger(last) && last >= 0 && last < STALK_MAPS.length;
  const choices = STALK_MAPS.map((_, i) => i).filter(i => !validLast || i !== last);
  const pick = Math.min(choices.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * choices.length)));
  return choices[pick];
}
function _stalkStart(locId, d, tier, report) {
  const mapIndex = stalkMapIndex(state.player._stalkLastMap, Math.random());
  const map = STALK_MAPS[mapIndex];
  const field = STALK_FIELD[d.id];
  const [startC, startR] = field ? field.start : [3, 1];
  _stalk = {
    locId, d, tier, map, report: report === true,
    temper: stalkTemper(d),
    mimi: { c: 3, r: STALK_ROWS - 1 },
    drg: { c: map[startR][startC] === "." ? startC : 3, r: startR, dir: (Math.random() < 0.5 ? 1 : 3) },
    alarm: 0, turn: 0, moveStreak: 0,
    sleeping: false, sweeping: false, over: false,
  };
  state.player._stalkLastMap = mapIndex;
  if (typeof saveGame === "function") saveGame();
  _stalkRender();
}

function _stalkCell(c, r, s = _stalk) {
  if (c < 0 || r < 0 || c >= STALK_COLS || r >= STALK_ROWS) return "R";
  return s.map[r][c];
}
// 視線が通るか（岩・草やぶが間にあれば遮られる）
function _stalkLos(c0, r0, c1, r1, s) {
  const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 6;
  for (let i = 1; i < n; i++) {
    const c = Math.round(c0 + (c1 - c0) * i / n), r = Math.round(r0 + (r1 - r0) * i / n);
    if ((c === c1 && r === r1) || (c === c0 && r === r0)) continue;
    const t = _stalkCell(c, r, s);
    if (t === "R" || t === "B") return false;
  }
  return true;
}
// 任意の竜状態での視界。戻り値 {vis:[], shade:[]}＝見えるマス／陰（視界内だが遮られて安全）
function _stalkSight(s, c, r) {
  if (s.sleeping || _stalkCell(c, r, s) !== ".") return "";
  const dc = c - s.drg.c, dr = r - s.drg.r;
  if (!dc && !dr) return "";
  const narrow = s.temper === "kimuzukashii";
  if (Math.max(Math.abs(dc), Math.abs(dr)) > (!s.sweeping && narrow ? 5 : STALK_R)) return "";
  if (!s.sweeping) {
    const forward = dc * (s.drg.dir === 1 ? -1 : 1);
    if (forward <= 0 || forward / Math.hypot(dc, dr) < (narrow ? 0.86 : 0.55)) return "";
  }
  return _stalkLos(s.drg.c, s.drg.r, c, r, s) ? "vis" : "shade";
}

// All decisions, including previews, inspect a copy. Each candidate sees the
// dragon after *that* footstep. Entering a heart checks its current gaze first.
function stalkStep(before, dc, dr) {
  const c = before.mimi.c + dc, r = before.mimi.r + dr, moving = !!(dc || dr);
  if (Math.abs(dc) + Math.abs(dr) > 1 || _stalkCell(c, r, before) === "R" ||
      (c === before.drg.c && r === before.drg.r)) return null;
  const s = { ...before, mimi: { c, r }, drg: { ...before.drg }, turn: before.turn + 1,
    moveStreak: moving ? Math.min(2, before.moveStreak + 1) : 0, flash: null, cause: null, reached: false };
  const g = s.drg, id = s.d.id, t = s.turn;
  const side = c < g.c ? 1 : 3;
  const distance = Math.abs(c - g.c) + Math.abs(r - g.r);
  const shift = (dx, dy) => {
    const x = g.c + dx, y = g.r + dy;
    if (_stalkCell(x, y, s) !== "." || (x === c && y === r)) return false;
    g.c = x; g.r = y; return true;
  };
  const retreat = () => {
    const dx = Math.sign(g.c - c), dy = Math.sign(g.r - r);
    if (!(dx && shift(dx, 0)) && dy) shift(0, dy);
  };
  if (Math.abs(c - g.c) === 1 && r === g.r) {
    if (_stalkSight(before, c, r) !== "vis") { s.reached = true; return s; }
    s.cause = "front"; g.dir = side; retreat();
  } else if (t < STALK_TURNS) {
    s.sweeping = false; s.sleeping = false;
    if (id === "raiou") {
      if (t % 3 === 0) {
        const dx = g.dir === 1 ? -1 : 1;
        if (!shift(dx, 0)) shift(-dx, 0);
        g.dir = 4 - g.dir; s.motion = "稲光とともに、雲棚を横へ跳ぶ";
      } else s.motion = t % 3 === 2 ? "角に稲妻が集まり始めた" : "翼を広げ、雲棚の端を見る";
    } else if (id === "goka") {
      if (s.moveStreak >= 2 && c !== g.c) { g.dir = side; s.motion = "焼け石が鳴り、音の方を向く"; }
      else { if (t % 3 === 0) g.dir = 4 - g.dir; s.motion = "耳を伏せて、火口を見ている"; }
    } else if (id === "glaze") {
      if (!moving && distance <= 3) { s.sleeping = true; s.motion = "氷の甲を下げ、傍へ招いた"; }
      else { if (t % 3 === 0) g.dir = 4 - g.dir; s.motion = "近くの足音に耳をすませる"; }
    } else if (id === "souten") {
      if (distance <= 4 && c !== g.c) {
        if (!moving) g.dir = 4 - side;
        else if (before.moveStreak > 0) g.dir = side;
      }
      s.motion = !moving ? "影が止まり、反対の空を見る" : before.moveStreak ? "翼の下を横切る影を追う" : "まだ、遠くの空に見入っている";
    } else if (id === "yomi") {
      if (t % 4 === 2) { shift(0, g.r <= 2 ? 1 : -1); s.sleeping = true; s.motion = "泡の先に、目を閉じて浮かぶ"; }
      else { if (t % 4 === 3) g.dir = 4 - g.dir; s.motion = t % 4 === 1 ? "頭が水に沈み、泡が走る" : "水面から片目をのぞかせる"; }
    } else if (id === "phenix") {
      if (t % 4 === 0) { shift(0, g.r <= 2 ? 1 : -1); g.dir = 4 - g.dir; s.motion = "風を捉え、隣の高さへ舞い降りる"; }
      else { s.sweeping = t % 4 === 3; s.motion = s.sweeping ? "尾羽が燃え、辺りを見渡す" : "翼をたたんで風を待つ"; }
    } else if (id === "fugaku") {
      s.sweeping = t % 4 === 0; s.motion = s.sweeping ? "岩棚から辺りをぐるりと見渡す" : "岩棚に腹を据え、同じ方を向く";
    } else if (t % (STALK_SWEEP[s.temper] || 5) === 0) s.sweeping = true;
    else if (s.temper === "sunao") { if (t % 2 === 0) g.dir = 4 - g.dir; if (s.alarm > 0) retreat(); }
    else if (s.temper === "kimagure") {
      if (t % 3 === 0) { s.sleeping = true; const p = [[0,1],[-1,0],[0,-1],[1,0]][Math.floor(t / 3) % 4]; shift(p[0], p[1]); }
      else g.dir = t % 6 < 3 ? 1 : 3;
    } else if (s.temper === "kimuzukashii" && s.moveStreak >= 2 && c !== g.c) g.dir = side;
    else if (t % 3 === 0) g.dir = 4 - g.dir;
    if (_stalkSight(s, c, r) === "vis") {
      s.cause = s.sweeping ? "sweep" : (s.moveStreak >= 2 && (id === "goka" || (!STALK_FIELD[id] && s.temper === "kimuzukashii"))) ? "sound" : "sight";
      if (c !== g.c) g.dir = side;
    }
  }
  if (s.cause) { s.alarm++; s.flash = "alarm"; }
  if (s.alarm >= 3) s.loss = "alarm";
  else if (t >= STALK_TURNS) s.loss = "time";
  return s;
}

function stalkAct(kind, dc, dr) {
  if (!_stalk || _stalk.over || _stalk.talk) return;
  const next = stalkStep(_stalk, kind === "wait" ? 0 : dc, kind === "wait" ? 0 : dr);
  if (!next) return;
  _stalk = next;
  if (next.reached) { _stalkReachHeart(); return; }
  if (next.cause) { try { if (window.Sfx) Sfx.play("click"); } catch (e) {} }
  if (next.loss) { _stalkLose(); return; }
  _stalkRender();
}

const STALK_CAUSES = {
  front: "顔の前の♡に踏み込み、竜が跳びのいた。明るい♡へ回るか、顔がそれるまで待とう。",
  sweep: "辺りを見渡した瞬間、隠れ場所の外にいた。次の手に！が出たら、草や岩陰を探そう。",
  sound: "二歩続いた足音で振り向かれた。次は、音が届く前に足を止めよう。",
  sight: "竜が向き直った先に姿が出た。一歩先に！がつく場所は、次の手で見つかる。"
};

// ═════════════════════════════════════════════════════════════════════════
// 🗣️ 話しかけ（♡のあと・ポケモンのゲット風／STALK_TALK_DIRECTIVE §3）
//   ♡に立てても即成立ではない。竜の「好きな話題」を3択から当てて、はじめて仲よくなれる。
//   ★核＝話題は竜ごとに**固定**（決定的ハッシュ）。外した話題はセッションを跨いで
//     グレーのまま残る＝次に会うときは消去法が効く（＝再挑戦が「上達」になる）。
// ═════════════════════════════════════════════════════════════════════════
const STALK_TOPICS = [
  { ic: "☁️", nm: "そら" }, { ic: "🍖", nm: "ごはん" }, { ic: "🗺️", nm: "たび" },
  { ic: "🌙", nm: "ひみつ" }, { ic: "🏁", nm: "レース" }, { ic: "🎵", nm: "うた" },
];
const STALK_TALK_COST = 4;             // 1回の話しかけ＝👣4消費（最悪3回＝12手）

// 竜IDから決定的に「出る3話題」と「正解の位置」を決める。52頭ぶん手作業の台帳は作らない。
//   i1 は i0 から 1〜3 ずれる／i2 は i1 から 1〜2 ずれる＝合計 2〜5 ずれるので i0 とも必ず異なる。
// ⚠ シフトは必ず **>>>（符号なし）**。h は 32bit いっぱいまで育つので `>>` だと Int32 の
//   負数になり、`% 3` が負を返して picks が重複し answer が −1/−2 になる
//   （機械検証で miruka/phenix/stella が実際に壊れていた）。
function stalkTalkSet(id) {
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const i0 = h % 6;
  const i1 = (i0 + 1 + ((h >>> 4) % 3)) % 6;
  const i2 = (i1 + 1 + ((h >>> 8) % 2)) % 6;
  return { picks: [i0, i1, i2], answer: (h >>> 2) % 3 };
}
// A preference is stable, but no one knows it before meeting the dragon.
// Offer observable behaviour before asking, then a clearer response after a
// failed approach. The existing topics, answers, misses and turn cost stay put.
const STALK_TOPIC_SIGNS = [
  ["雲の影を目で追い、風が来るたび翼の先を少し広げる。", "遠くへ続く道より、頭上で形を変える雲へ何度も顔を上げる。"],
  ["荷袋に鼻先を向け、小さく鼻を鳴らした。", "弁当包みの匂いに鼻をひくひくさせ、口の端を舐める。"],
  ["地面に道のような線を描き、その先へ首を向ける。", "道筋の先を交互に見て、まだ見えない向こう側へ一歩踏み出す。"],
  ["辺りを一周見回してから、こちらだけに鼻先を寄せる。", "人の声が近づくと口を閉じ、静かになると、こちらだけへ小さく喉を鳴らす。"],
  ["遠くの歓声に耳を動かし、前脚で地面を軽く蹴る。", "競走旗が上がると、走り出すように前脚を構え、目を輝かせる。"],
  ["遠くの音に耳を傾け、喉を短く鳴らした。", "屋台の歌が聞こえると、同じ拍子で尾を揺らし、喉を鳴らして合わせる。"]
];
function stalkTalkObservation(id, clarified) {
  const set = stalkTalkSet(id), topic = set.picks[set.answer];
  const signs = STALK_FIELD[id] ? STALK_FIELD[id].signs : STALK_TOPIC_SIGNS[topic];
  return signs[clarified ? 1 : 0];
}
// 外した話題の位置（0〜2）。図鑑エントリに永続＝次の遠征でもグレーのまま。
function stalkTalkMiss(id) {
  try { const e = poroColEntry(id); return (e && e.talkMiss) || []; } catch (err) { return []; }
}

// ♡到達＝盤を凍らせて♡を出し、ひと呼吸おいて話しかけへ。
function _stalkReachHeart() {
  const s = _stalk; s.over = true; s.reached = true;
  _stalkRender();
  const host = document.querySelector(".stalk-board");
  if (host) host.appendChild(el("div", "stalk-heart", "♡"));
  try { if (window.Sfx) Sfx.play("coin"); } catch (e) {}
  setTimeout(() => { if (_stalk === s) _stalkTalkStart(); }, 820);
}

function _stalkTalkStart() {
  const s = _stalk; if (!s) return;
  s.over = false;                                   // 話しかけ中は決着していない
  s.talk = { set: stalkTalkSet(s.d.id), miss: stalkTalkMiss(s.d.id), busy: false, say: null, fx: null };
  _stalkTalkRender();
  // 教える層①：初回だけ大バナー（＋？一覧にも恒久で載せる＝1回きりのヒント頼みにしない）
  const p = state.player;
  if (!p._stalkTalkIntro) {
    p._stalkTalkIntro = 1; if (typeof saveGame === "function") saveGame();
    const wrap = document.querySelector(".stalk-wrap");
    if (wrap) _stalkBanner(wrap, "🗣️ はなしかけよう<br><small>はずれても 👣がのこれば もう一度</small>", true);
  }
}

function _stalkTalkRender() {
  const s = _stalk; if (!s || !s.talk) return;
  const wrap = document.querySelector(".stalk-wrap"); if (!wrap) return;
  const t = s.talk, left = Math.max(0, STALK_TURNS - s.turn);
  const say = t.say || `🗣️ なにを 話しかける？`;
  const showBtns = !s.over && !t.busy;
  let btns = "";
  if (showBtns) {
    btns = t.set.picks.map((ti, pos) => {
      const top = STALK_TOPICS[ti], off = t.miss.indexOf(pos) >= 0;
      return `<button class="stk-topic${off ? " off" : ""}" data-pos="${pos}"${off ? " disabled" : ""}>` +
        `<span class="stk-t-ic">${top.ic}</span><b>${top.nm}</b>` +
        (off ? `<i class="stk-t-x">ハズレ</i>` : "") + `</button>`;
    }).join("");
  }
  wrap.innerHTML =
    `<div class="stalk-top">` +
      `<span class="stalk-name">${s.d.name}${STALK_TIER[s.tier].nm ? `<i class="stalk-tier ${STALK_TIER[s.tier].cls}">✨${STALK_TIER[s.tier].nm}</i>` : ""}</span>` +
      `<button class="stalk-help info-q" title="記号のいみ">？</button>` +
    `</div>` +
    `<div class="stalk-talk${t.fx ? " " + t.fx : ""}">` +
      _scBgTag(s.locId, "stalk-bg") +
      `<div class="stk-stage">` +
        `<div class="stk-ring ${STALK_TIER[s.tier].cls}"></div>` +
        `<img class="stk-drg" alt="">` +
      `</div>` +
      `<p class="stk-observation">${stalkTalkObservation(s.d.id, t.miss.length > 0)}</p>` +
      `<div class="stk-say">${say}</div>` +
      `<div class="stk-topics">${btns}</div>` +
    `</div>` +
    `<div class="stalk-foot"><span class="stalk-turn${left <= 5 ? " low" : ""}">👣 ${left}</span>` +
      `<span class="stk-cost">🗣️ 1回 話しかけると 👣${STALK_TALK_COST}</span></div>`;
  _scSpriteInto(wrap.querySelector(".stk-drg"), s.d.id);
  const q = wrap.querySelector(".stalk-help"); if (q) q.onclick = () => stalkShowHelp();
  wrap.querySelectorAll(".stk-topic:not(.off)").forEach(b => {
    b.onclick = () => _stalkTalkPick(parseInt(b.getAttribute("data-pos"), 10));
  });
}

// 射幸の「間」＝ボタンを消す → 3回ゆれる（600ms間隔） → 900msの静寂 → 結果。
function _stalkTalkPick(pos) {
  const s = _stalk; if (!s || !s.talk || s.talk.busy || s.over) return;
  s.talk.busy = true; s.talk.say = "……";
  s.turn += STALK_TALK_COST;
  _stalkTalkRender();
  let n = 0;
  const shake = () => {
    if (_stalk !== s || !s.talk) return;
    const st = document.querySelector(".stk-stage");
    if (st) { st.classList.remove("shake"); void st.offsetWidth; st.classList.add("shake"); }
    try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
    n++;
    if (n < 3) setTimeout(shake, 600);
    else setTimeout(() => _stalkTalkResult(pos), 900);   // ★何も動かないタメ
  };
  setTimeout(shake, 80);
}

function _stalkTalkResult(pos) {
  const s = _stalk; if (!s || !s.talk) return;
  if (pos === s.talk.set.answer) { s.talk.busy = false; _stalkWin(); return; }
  // 外れ＝首を振るだけ（！は増えない＝警戒には入れない）。その話題は永久にグレーへ。
  try {
    const e = poroColEntry(s.d.id);
    e.talkMiss = e.talkMiss || [];
    if (e.talkMiss.indexOf(pos) < 0) e.talkMiss.push(pos);
    if (typeof saveGame === "function") saveGame();
  } catch (err) {}
  s.talk.miss = stalkTalkMiss(s.d.id);
  s.talk.say = "……ちがうみたい";
  s.talk.fx = "miss";
  _stalkTalkRender();
  try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
  setTimeout(() => {
    if (_stalk !== s || !s.talk) return;
    s.talk.fx = null;
    if (STALK_TURNS - s.turn >= 1) { s.talk.busy = false; s.talk.say = null; _stalkTalkRender(); }
    else _stalkLose();                                   // 👣が尽きた＝飛び去る
  }, 1350);
}

// ── 決着 ────────────────────────────────────────────────────────────────
function _stalkWin() {
  const s = _stalk; if (!s || s.over) return; s.over = true;
  _scoutMeetD = s.d; _scoutMeetLoc = s.locId; _scoutSess = null;
  // The friendship is earned now, before the celebration. Reloading or
  // leaving during that animation must not erase a successful encounter.
  const receipt = _scoutCommitFriendship(s.d);
  if (s.talk) { s.talk.fx = "hit"; s.talk.say = "🤝 心が つうじた！"; _stalkTalkRender(); }
  else {
    _stalkRender();
    const host = document.querySelector(".stalk-board");
    if (host) host.appendChild(el("div", "stalk-heart", "♡"));
  }
  // ★成立の当たり演出（ユーザー要望＝♡のあとにも射幸感を）。レア度の色で全画面が弾ける：
  //   閃光→色付きリング2連→♡の舞い→「なかよし成立！」。そのあと既存の成立ポップへ渡す。
  const tier = s.tier, d = s.d;
  setTimeout(() => {
    if (_stalk !== s || state.ui.screen !== "scout") return;
    const fx = el("div", "stalk-winfx " + STALK_TIER[tier].cls);
    fx.innerHTML =
      `<div class="swf-flash"></div><div class="swf-ring"></div><div class="swf-ring r2"></div>` +
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<i class="swf-h h${i}">♡</i>`).join("") +
      `<div class="swf-t">🤝 なかよし成立！${STALK_TIER[tier].nm ? `<b class="swf-tier">✨${STALK_TIER[tier].nm}クラス</b>` : ""}</div>`;
    document.body.appendChild(fx);
    try { if (window.Sfx) Sfx.play(tier >= 2 ? "legendary" : "coin"); } catch (e) {}
    // ✨ミミのカットイン（js/paho_cutin.js）。既にある成立演出の**中に**入れる＝拍を増やさない。
    //   最後のコマが「目を開いてこちらを見る」なので、仲よくなれた瞬間の顔として収まる。
    //   完全に表示専用＝成立判定・レア度・報酬には一切さわらない。
    //   ★文字は入れない（ユーザー指定）。すぐ横で「🤝 なかよし成立！」が出ているので重なる。
    if (typeof pahoCutin === "function") pahoCutin({ ms: 1400 });
    setTimeout(() => {
      fx.remove();
      if (_stalk !== s || state.ui.screen !== "scout") return;
      _stalk = null; _scoutWin(receipt);
    }, 1550);
  }, 700);
}
function _stalkLose() {
  const s = _stalk; if (!s || s.over) return; s.over = true; s.flash = "flee";
  // 話しかけ中に👣が尽きた場合は、盤へ戻さずその場で飛び去らせる（画面がガタつかない）。
  if (s.talk) { s.talk.fx = "flee"; s.talk.say = "🍃 飛び去っていく……"; _stalkTalkRender(); }
  else _stalkRender();
  const locId = s.locId, cost = (scoutLocation(locId) || {}).cost || 0;
  const failed = s.alarm >= 3 ? "三度見つかり、竜が距離を取った" : s.talk ? "話題が合う前に、竜が飛び去った" : "近づく前に、竜が飛び去った";
  const lesson = s.alarm >= 3 ? STALK_CAUSES[s.cause] : s.talk ? stalkTalkObservation(s.d.id, true) :
    "足跡を数えると24手。次は、待ったときの足印と明るい♡を見て、足場を一つ先に取ろう。";
  const notes = '<p>' + lesson + '</p>' + (STALK_FIELD[s.d.id] ? '<p><b>' + s.d.name + 'の観察</b><br>' + STALK_FIELD[s.d.id].note + '</p>' : '');
  setTimeout(() => {
    if (_stalk !== s || state.ui.screen !== "scout") return;
    _stalk = null;
    if (s.report) {
      showInfoPopup(failed, notes,
        () => renderScout(), { label: "同じ竜に、現地で再挑戦", fn: () => {
          const current = stalkReportTarget(s.d.id);
          if (current) _stalkStart(current.locId, current.d, stalkTier(current.locId, current.d.id), true);
          else renderScout();
        } });
      return;
    }
    const canPay = (state.player.coins || 0) >= cost;
    showInfoPopup(failed, notes,
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
  const plan = s.over ? null : stalkStep(s, 0, 0);
  const cw = 100 / STALK_COLS, chh = 100 / STALK_ROWS;
  let cells = "";
  for (let r = 0; r < STALK_ROWS; r++) for (let c = 0; c < STALK_COLS; c++) {
    const t = _stalkCell(c, r);
    const sight = _stalkSight(s, c, r);
    const vis = sight === "vis", shade = sight === "shade";
    // つぎ見られるマス（赤紫の縞）。⚠（つぎ見回し）のときも描く＝⚠の意味が縞の広がりで自明になる。
    const nvis = !vis && plan && _stalkSight(plan, c, r) === "vis";
    const canGo = !s.over && Math.abs(c - s.mimi.c) + Math.abs(r - s.mimi.r) === 1 && t !== "R" && !(c === s.drg.c && r === s.drg.r);
    // ♡＝竜の左右2マスだけ（顔の横に回り込む）。いま見えている側は薄い＝正面はダメ、が見える。
    const goal = t !== "R" && Math.abs(c - s.drg.c) === 1 && r === s.drg.r;
    const step = canGo && stalkStep(s, c - s.mimi.c, r - s.mimi.r);
    const sign = step && (step.reached ? "♡" : step.cause ? "！" : step.loss ? "⌛" : "·");
    const landing = plan && (plan.drg.c !== s.drg.c || plan.drg.r !== s.drg.r) && c === plan.drg.c && r === plan.drg.r;
    cells += `<div class="stalk-cell${vis ? " vis" : ""}${shade ? " shade" : ""}${nvis ? " nvis" : ""}${canGo ? " go" : ""}${t === "B" ? " bushcell" : ""}${goal ? (vis ? " goal-off" : " goal") : ""}" data-c="${c}" data-r="${r}"` +
      ` style="left:${c * cw}%;top:${r * chh}%;width:${cw}%;height:${chh}%">` +
      (t === "B" ? `<img class="stalk-prop stalk-bush" src="${_stalkProp(s.locId, "bush")}" alt="">` : t === "R" ? `<img class="stalk-prop stalk-rock" src="${_stalkProp(s.locId, "rock")}" alt="">` : "") +
      (goal ? `<span class="stalk-goal-heart">♡</span>` : "") +
      (landing ? '<span class="stalk-landing">🐾</span>' : "") +
      (sign ? '<span class="stalk-step-sign' + (step.cause ? ' danger' : '') + '">' + sign + '</span>' : "") +
      `</div>`;
  }
  const hidden = _stalkCell(s.mimi.c, s.mimi.r) === "B";
  const willFlip = plan && !plan.sweeping && !plan.sleeping && plan.drg.dir !== s.drg.dir;
  // ★状態ラベルは竜に張り付けず、盤の上の**専用の行**に出す。竜が盤の端にいると
  //   盤の overflow:hidden で切れて読めなかった（ユーザー指摘）。行の高さは固定＝ガタつかない。
  let status = "";
  if (s.sleeping) status += `<span class="stalk-badge stalk-zzz">💤<small>いねむり中</small></span>`;
  if (s.sweeping) status += `<span class="stalk-badge stalk-eyes">👀<small>見回し中！</small></span>`;
  if (!s.over && plan && plan.sweeping) status += `<span class="stalk-badge stalk-warn">⚠<small>つぎ 見回し</small></span>`;
  if (!s.over && plan && plan.sleeping) status += `<span class="stalk-badge stalk-next">💤<small>つぎ いねむり</small></span>`;
  if (!s.over && willFlip) status += `<span class="stalk-badge stalk-next">↩<small>つぎ ふりむく</small></span>`;
  if (s.motion) status = '<span class="stalk-status-idle">' + s.motion + '</span>' + (plan && plan.sweeping ? '<span class="stalk-badge stalk-warn">次は見回し</span>' : '');
  if (!status) status = `<span class="stalk-status-idle">🐾 しずか……</span>`;
  wrap.innerHTML =
    `<div class="stalk-top">` +
      `<button class="stalk-quit">← あきらめる</button>` +
      `<span class="stalk-name">${s.d.name}${STALK_TIER[s.tier].nm ? `<i class="stalk-tier ${STALK_TIER[s.tier].cls}">✨${STALK_TIER[s.tier].nm}</i>` : ""}</span>` +
      `<button class="stalk-help info-q" title="記号のいみ">？</button>` +
      `<span class="stalk-pips">${[0, 1, 2].map(i => `<i class="${i < s.alarm ? "on" : ""}">！</i>`).join("")}</span>` +
    `</div>` +
    // ★状態ラベルは盤の中に置かない＝専用の行（高さ固定）。竜が盤の端にいると
    //   盤の overflow:hidden でラベルが切れて読めなかった（ユーザー指摘）。
    `<div class="stalk-status">${status}</div>` +
    `<div class="stalk-board${s.flash === "alarm" ? " alarm" : ""}${s.flash === "flee" ? " flee" : ""}">` +
      _scBgTag(s.locId, "stalk-bg") +
      `<div class="stalk-grid">${cells}</div>` +
      `<div class="stalk-drg${s.sweeping ? " sweeping" : ""}" style="left:${(s.drg.c + 0.5) * cw}%;top:${(s.drg.r + 0.62) * chh}%">` +
        // ★HD-2Dスプライトの素材は**右向きが標準**（草むら6頭を並べて実測）。左を向くときだけ反転。
        `<img class="stalk-drg-img${s.drg.dir === 1 ? " flip" : ""}" alt="">` +
        (s.flash === "alarm" ? `<span class="stalk-ex">！</span>` : "") +
      `</div>` +
      `<div class="stalk-mimi${hidden ? " hid" : ""}" style="left:${(s.mimi.c + 0.5) * cw}%;top:${(s.mimi.r + 0.72) * chh}%">` +
        (hidden ? `<img class="stalk-hidegrass" src="${_stalkProp(s.locId, "bush")}" alt="">` : "") +
      `</div>` +
    `</div>` +
    `<div class="stalk-foot"><span class="stalk-turn${STALK_TURNS - s.turn <= 5 ? " low" : ""}">👣 ${STALK_TURNS - s.turn}</span>` +
      `<button class="stalk-wait">🐾 じっとする${plan && plan.cause ? " · ！見つかる" : ""}</button></div>` +
    `<div class="stalk-legend"><span>一歩先の印　· 安全　！ 見つかる　♡ 話せる</span><span><i class="lg lg-nvis"></i>待つ場合の視界　🐾 竜の着地点</span></div>` +
    (s.cause || STALK_FIELD[s.d.id] ? '<p class="stalk-field-note">' + (s.cause ? STALK_CAUSES[s.cause] : STALK_FIELD[s.d.id].note) + '</p>' : '');
  _scSpriteInto(wrap.querySelector(".stalk-drg-img"), s.d.id);
  wrap.querySelector(".stalk-help").onclick = () => stalkShowHelp();
  wrap.querySelector(".stalk-quit").onclick = () => { _stalk = null; renderScout(); };
  wrap.querySelector(".stalk-wait").onclick = () => stalkAct("wait");
  wrap.querySelectorAll(".stalk-cell.go").forEach(cell => {
    cell.onclick = () => stalkAct("move",
      parseInt(cell.getAttribute("data-c")) - s.mimi.c,
      parseInt(cell.getAttribute("data-r")) - s.mimi.r);
  });
  _stalkCoachMaybe(wrap);
}

// ── 記号の一覧（？ボタン＝いつでも読める恒久の説明。1回きりのヒント頼みをやめる）──
function stalkShowHelp() {
  if (typeof showInfoPopup !== "function") return;
  const row = (ic, nm, tx) => `<div class="stalk-hp-row"><span class="stalk-hp-ic">${ic}</span><div><b>${nm}</b><small>${tx}</small></div></div>`;
  showInfoPopup("🐾 しのびあしの記号",
    row("· ！ ♡", "隣のマスへ移った結果", "·なら見つからない。！なら警戒が一つ増える。♡なら今すぐ話せる。⌛は手数切れ。") +
    row('<i class="lg lg-vis"></i>', "黄色いマス", "竜から<b>いま見えている</b>。♡は今の視線で判定する") +
    row('<i class="lg lg-nvis"></i>', "縞と足印", "<b>じっとした場合</b>に新しく見える場所と竜の着地点。動く場合は隣のマスの印を見よう") +
    row('<i class="lg lg-shade"></i>', "こい緑のマス", "草や岩の<b>かげ＝安全</b>。視界の中でも見えていない") +
    row("🌾", "草やぶ", "入るとかくれられる（いる間は絶対みつからない）") +
    row("🪨", "岩", "通れない。視線もさえぎる") +
    row("♡", "ゴール", "竜のよこ2マス。<b>見られていない側</b>から立てば「話しかけ」へ") +
    row("🗣️", "話しかけ", "♡のあと、話題を3つから選ぶ。<b>好きな話題は竜ごとに決まっている</b>。1回 👣4") +
    row("🚫", "グレーの話題", "この竜には<b>ハズレだった話題</b>。次に会っても消えたまま＝消去法で当てられる") +
    row("👀", "見回し中", "この手は<b>全方位</b>が見えている。かげと🌾だけが安全") +
    row("⚠", "つぎ見回し", "次の手で👀が来る予告。縞がその範囲") +
    row("💤", "いねむり", "何も見えていない。近づくチャンス") +
    row("↩", "つぎ ふりむく", "次の手で反対を向く予告") +
    row("！", "警戒", "みつかった回数。<b>3つで逃げられる</b>") +
    row("👣", "のこり手数", "0になると竜は飽きて飛び去る"));
  // ★記号14項目は 390×700 に収まらない（実測 1216px）。中央寄せの .navpop-ov は
  //   はみ出しても**スクロールできない**＝上下が読めなくなるので、この一覧だけ内部スクロールへ。
  try {
    const ovs = document.querySelectorAll(".navpop-ov");
    const box = ovs.length ? ovs[ovs.length - 1].querySelector(".navpop") : null;
    if (box) box.classList.add("stalk-hp-pop");
  } catch (e) {}
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
      _stalkBanner(wrap, "♡ （竜のよこ）に 立てたら <b>話しかけ</b>");
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
  } else if (!s.sweeping && stalkStep(s, 0, 0).sweeping && (p._stalkTipSweep2 | 0) < 2) {
    // ★⚠の一言は2回まで出す（1回きりだと見逃したら終わり。実際テストが初回を消費して
    //   ユーザーに一度も出ていなかった）。恒久の説明は凡例の「⚠ つぎ見回し」が担う。
    p._stalkTipSweep2 = (p._stalkTipSweep2 | 0) + 1; if (typeof saveGame === "function") saveGame();
    _stalkTip(wrap, "⚠ ＝ つぎの手で <b>ぐるっと見回す</b>。🌾へかくれるか、はなれて！");
  }
}

// キー操作（任意）：矢印＝移動・スペース＝じっと
document.addEventListener("keydown", function (e) {
  if (!_stalk || _stalk.over || _stalk.talk) return;   // 話しかけ中は盤の操作を受けない
  const k = e.key;
  if (k === "ArrowUp") stalkAct("move", 0, -1);
  else if (k === "ArrowDown") stalkAct("move", 0, 1);
  else if (k === "ArrowLeft") stalkAct("move", -1, 0);
  else if (k === "ArrowRight") stalkAct("move", 1, 0);
  else if (k === " ") { e.preventDefault(); stalkAct("wait"); }
});
