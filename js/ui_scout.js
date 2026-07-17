// =========================================================================
// ui_scout.js — 竜スカウト「発見＆交渉」UI（poro.js の renderScout を上書き）
// =========================================================================
// 設計：docs/SCOUT_NEGOTIATION_DESIGN.md ／ データ：data_scout.js ／ ロジック：scout_engine.js
//   ロケ段階ハブ（マスク）→ 発見 → ラウンド制の読み合い交渉 → 成立／決裂。
// ★成立の払い出し（collection.scouted/seen＋raiseAffection＋epPush）は既存と同一。
// ★poro.js の後に読み込む＝renderScout を後勝ちで上書き（ui_mall_rpg と同じ流儀）。
// =========================================================================

let _scoutSess = null;     // 進行中の交渉セッション（scout_engine.createScoutSession）
let _scoutMeetD = null;    // 交渉中の竜
let _scoutMeetLoc = null;  // 交渉中のロケ

// ── ハブ：ロケ段階開放＋マスク ───────────────────────────────────────────
// C1解消：読み合いの核ルールの恒常ヘルプ（？ボタン＋初回自動表示・docs/GAME_FLOW_REDESIGN.md）
function showScoutHelp() {
  const legend = (typeof SCOUT_CAT_COLOR !== "undefined")
    ? Object.keys(SCOUT_CAT_COLOR).map(k => `<span style="border-left:3px solid ${SCOUT_CAT_COLOR[k]};padding-left:5px;margin-right:8px;white-space:nowrap">${k}</span>`).join("")
    : "";
  showInfoPopup("🔍 スカウトの読み合い（ルール）",
    `<div class="mm-row"><span class="mm-ic">👀</span><div><b>① しぐさ＝気持ちのヒント</b><small>竜は言葉を話さない代わりに、しぐさで「いまの気持ち」（不安・警戒・甘え・遊びたい…）を見せる。まず読む。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🤝</span><div><b>② 気持ちに合う交渉術を選ぶ</b><small>合う技＝<u>信頼が上がり警戒が下がる</u>。合わない技は逆効果（決裂は運ではなく読み違い）。「観察」で気持ちを確かめてから動くのも手。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🎨</span><div><b>③ 色＝技の系統</b><small>${legend}</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🍃</span><div><b>④ 決裂しても失うのは旅費だけ</b><small>竜は逃げない。何度でも会いにいける（レースの結果には影響しません）。</small></div></div>`);
}

function renderScout() {
  if (typeof poroScoutUnlocked === "function" && !poroScoutUnlocked()) {   // Ⓒ 無反応→🔒案内でフィードバック。
    if (typeof renderHome === "function") renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("🐉 ドラゴンスカウト",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースを勝ち進み、相棒と出会うと、新しい竜を探しに行けるようになります。</small></div></div>`);
    return;
  }
  state.ui.screen = "scout";
  const app = beginScreen();
  const h2 = el("h2", null, "🔍 竜スカウト <button class=\"info-q\" title=\"読み合いのルール\">？</button>");
  h2.querySelector(".info-q").onclick = () => showScoutHelp();
  app.appendChild(h2);
  app.appendChild(el("div", "as-hint2", "野の竜は人の言葉を話さない。<b>しぐさ</b>から気持ちを読み、<b>交渉術</b>で心を開かせて仲間に迎えよう。遠征には<b>旅費</b>がかかる（表示専用＝レースの結果には影響しません）。"));
  // 初回だけルールを自動で1回説明（以後は？ボタン）
  if (typeof getStoryFlag === "function" && !getStoryFlag("_help_scout_seen")) {
    setStoryFlag("_help_scout_seen", true);
    if (typeof saveGame === "function") saveGame();
    setTimeout(() => { try { if (state.ui.screen === "scout") showScoutHelp(); } catch (e) {} }, 450);
  }

  const owned = (typeof poroMetDragonIds === "function" ? poroMetDragonIds().filter(id => id !== "poro").length : 0);
  app.appendChild(el("div", "scout-bar", `🏠 龍舎の竜：<b>${owned}</b>頭　｜　🪙 <b>${(state.player.coins || 0).toLocaleString("ja-JP")}</b>`));

  app.appendChild(el("div", "stable-sec", "📍 旅に出る場所をえらぶ"));
  const grid = el("div", "sc-loc-grid");
  SCOUT_LOCATIONS.forEach(loc => {
    const open = scoutLocationUnlocked(loc.id);
    if (open) {
      const all = dragonsAtLocation(loc.id);
      const col = (state.player && state.player.collection) || {};
      const done = all.filter(d => col[d.id] && col[d.id].scouted).length;
      const allDone = all.length > 0 && done >= all.length;
      const cost = loc.cost || 0;
      const canPay = (state.player.coins || 0) >= cost;
      const card = el("button", "sc-loc" + (allDone ? " sc-loc--done" : (canPay ? "" : " sc-loc--poor")),
        `<span class="sc-loc-ic">${loc.ic}</span>` +
        `<span class="sc-loc-bd"><b>${loc.name}</b><i class="sc-loc-tier">${loc.tier}</i>` +
          (allDone ? "" : `<i class="sc-loc-cost">旅費 🪙${cost.toLocaleString("ja-JP")}</i>`) + `</span>` +
        `<span class="sc-loc-mood">${loc.mood}</span>` +
        `<span class="sc-loc-cnt">${allDone ? "✓ この場の竜とは みんな仲良し" : `棲む竜 <b>${all.length}</b>頭・出会い <b>${done}</b>`}</span>`);
      card.onclick = () => scoutEnterLocation(loc.id);
      grid.appendChild(card);
    } else {
      const card = el("div", "sc-loc sc-loc--locked",
        `<span class="sc-loc-ic">🔒</span>` +
        `<span class="sc-loc-bd"><b>？？？</b><i class="sc-loc-tier">${loc.tier}</i></span>` +
        `<span class="sc-loc-mood">まだ行けない場所。</span>` +
        `<span class="sc-loc-cnt">${loc.unlockLabel}</span>`);
      grid.appendChild(card);
    }
  });
  app.appendChild(grid);

  const actions = el("div", "actions");
  const stBtn = el("button", "secondary", "🏠 龍舎へ"); stBtn.onclick = () => { if (typeof renderStable === "function") renderStable(); };
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(stBtn); actions.appendChild(back);
  app.appendChild(actions);
}

// ── 発見：その場の未スカウト竜から決定的に1頭と遭遇 ─────────────────────
function scoutEnterLocation(locId) {
  const loc = scoutLocation(locId);
  const pool = unscoutedAtLocation(locId);
  if (!pool.length) {
    showInfoPopup(`${loc.ic} ${loc.name}`,
      `<div class="mm-row"><span class="mm-ic">✓</span><div><b>この場の竜とは、もう みんな仲良くなった。</b><small>別の場所をのぞいてみよう。</small></div></div>`);
    return;
  }
  // 旅費（島の経済＝コインの吸い込み口・表示専用メタ／着順・オッズ・配当には非干渉）。
  const cost = loc.cost || 0;
  if ((state.player.coins || 0) < cost) {
    showInfoPopup(`${loc.ic} ${loc.name}`,
      `<div class="mm-row"><span class="mm-ic">🪙</span><div><b>旅費が足りません</b><small>${loc.name}への遠征には ${cost.toLocaleString("ja-JP")} コイン必要です（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）。</small></div></div>`);
    return;
  }
  if (cost > 0) { state.player.coins -= cost; if (typeof updateHeader === "function") updateHeader(); }
  state.player._scoutTrips = (state.player._scoutTrips || 0) + 1;   // 遠征回数（表示メタ・出会う竜の巡回に使う）
  if (typeof saveGame === "function") saveGame();
  // その場の未スカウト竜から決定的に1頭（遠征ごとに巡る・旅費でコインが動くため coins は使わない）。
  const idx = (state.player._scoutTrips + (state.player.completedRaces || 0)) % pool.length;
  const d = pool[idx];
  _scoutMeetD = d; _scoutMeetLoc = locId;
  _scoutSess = createScoutSession(d.id, locId);
  _scoutRenderEncounter(true);
}

// ── 交渉エンカウンター画面（土台再設計）─────────────────────────────────
// 商業の定石＝①相手が主役（ポケモン捕獲：竜のHD-2Dスプライトを舞台中央に）②選択のたび相手が
// 目に見えて反応（ペルソナ交渉：しぐさ吹き出し＋リアクションアニメ）③緊張の可視化（太いデュアル
// ゲージ＋成立/逃走マーカー＋一手ごとのデルタ演出）。数式（scoutResolve）は一切不変＝表示層のみ。
const SCOUT_LOC_BG = {
  grass:   "images/konron/spots/mango_orchard.webp",
  jungle:  "images/konron/spots/susufuka.webp",
  cliff:   "images/konron/spots/kibishis.webp",
  sky:     "images/konron/spots/hoshimi.webp",
  volcano: "images/konron/spots/bangara.webp",
  sea:     "images/konron/spots/sena.webp"
};
// キー抜き済みHD-2Dスプライトを流し込む（race_canvasのキャッシュ＝_ecSpriteURLを再利用）。
function _scSpriteInto(imgEl, id) {
  try { if (typeof _rcDragonSprite === "function") _rcDragonSprite(id); } catch (e) {}
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    let u = null;
    try { u = (typeof _ecSpriteURL === "function") ? _ecSpriteURL(id) : null; } catch (e) {}
    if (u && imgEl.isConnected) { imgEl.src = u; imgEl.classList.add("on"); clearInterval(poll); }
    else if (tries > 25 || !imgEl.isConnected) clearInterval(poll);
  }, 120);
}
function _scoutBar(label, val, max, cls, goalLabel, delta, pulse) {
  const pct = Math.max(0, Math.min(100, Math.round((val / max) * 100)));
  return `<div class="sc-meter ${cls}${pulse ? " sc-meter--pulse" : ""}">` +
    `<span class="sc-meter-l">${label}</span>` +
    `<span class="sc-meter-t"><i style="width:${pct}%"></i><em class="sc-meter-goal">${goalLabel}</em></span>` +
    (delta ? `<span class="sc-meter-delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" + delta : delta}</span>` : "") +
    `</div>`;
}
// 反応の種類→スプライトのリアクション（表示のみ）。
const SCOUT_FX_CLASS = { great: "sc-hit-great", good: "sc-hit-good", soothe: "sc-hit-good", bad: "sc-hit-bad", neutral: "sc-hit-neutral", observe: "sc-hit-neutral" };
function _scoutRenderEncounter(first, lastReaction, fx) {
  const d = _scoutMeetD, sess = _scoutSess, loc = scoutLocation(_scoutMeetLoc);
  if (!d || !sess) { renderScout(); return; }
  state.ui.screen = "scout";
  const app = beginScreen();
  fx = fx || {};

  // ── 舞台：遠征先の景色 × 竜のスプライト × しぐさ吹き出し ──
  const mood = SCOUT_MOODS[sess.mood] || {};
  const bg = SCOUT_LOC_BG[_scoutMeetLoc] || "";
  const nearWin = sess.trust >= SCOUT_TRUST_GOAL * 0.72;
  const stage = el("div", "sc-stage");
  stage.innerHTML =
    (bg ? `<img class="sc-stage-bg" src="${bg}" alt="" decoding="async" onerror="this.remove()">` : "") +
    `<div class="sc-stage-vig"></div>` +
    `<div class="sc-meet-tag"><b>${d.name}</b><small>${loc.ic} ${loc.name}・気性 ${typeof poroTemperLabel === "function" ? poroTemperLabel(d) : "—"}</small></div>` +
    `<div class="sc-drg-wrap${first ? " sc-reveal" : ""}${fx.outcome ? " " + (SCOUT_FX_CLASS[fx.outcome] || "") : ""}" style="--dc:${(typeof dragonColor === "function") ? dragonColor(d) : (d.color || "#caa24a")}">` +
      `<img class="sc-drg" alt="">` +
    `</div>` +
    `<div class="sc-bubble">` +
      `<div class="sc-bubble-tx">${sess.gesture}</div>` +
      (sess.revealed
        ? `<div class="sc-bubble-read">${mood.ic || ""} <b>${mood.name || "？"}</b>${(mood.reads || [""])[0] ? "──" + (mood.reads || [""])[0] : ""}</div>`
        : `<div class="sc-bubble-hint">（このしぐさは、何の気持ち……？）</div>`) +
    `</div>`;
  app.appendChild(stage);
  _scSpriteInto(stage.querySelector(".sc-drg"), d.id);
  if (first) app.appendChild(el("div", "sc-discover", `🐾 ${loc.mood.replace(/。$/, "")}——足跡をたどると、<b>${d.name}</b>がそっと姿を見せた。`));

  // ── 緊張のデュアルゲージ（成立/逃走マーカー＋デルタ演出＋大詰めパルス）──
  const meters = el("div", "sc-meters");
  meters.innerHTML =
    _scoutBar("💗 信頼", sess.trust, SCOUT_TRUST_GOAL, "sc-trust", "成立", fx.dt, nearWin) +
    _scoutBar("⚠️ 警戒", sess.wary, SCOUT_WARY_MAX, "sc-wary", "逃走", fx.dw, false);
  app.appendChild(meters);
  if (nearWin) app.appendChild(el("div", "sc-nearwin", "✨ あと少しで、心が通じそう……！"));

  // 直前の反応（竜の返事）
  if (lastReaction) app.appendChild(el("div", "sc-react", lastReaction));

  // 手札
  const { hand, extras } = scoutHand(sess, 5);
  app.appendChild(el("div", "sc-hand-lbl", "交渉術をえらぶ"));
  const handWrap = el("div", "sc-hand");
  hand.forEach(a => {
    const b = el("button", "sc-app", `<span class="sc-app-ic">${a.ic}</span><b>${a.name}</b><small>${a.fl}</small>`);
    b.style.borderLeftColor = (SCOUT_CAT_COLOR[a.cat] || "#caa24a");
    b.onclick = () => _scoutAct(a.id);
    handWrap.appendChild(b);
  });
  app.appendChild(handWrap);

  const exWrap = el("div", "sc-extras");
  extras.forEach(a => {
    const dis = (a.special === "soothe" && sess.usedPaho);
    const b = el("button", "sc-extra" + (a.id === "pahopaho" ? " sc-extra--paho" : "") + (a.id === "interpret" ? " sc-extra--poro" : ""),
      `<span>${a.ic}</span> ${a.name}`);
    if (dis) b.disabled = true;
    b.onclick = () => _scoutAct(a.id);
    exWrap.appendChild(b);
  });
  app.appendChild(exWrap);

  const actions = el("div", "actions");
  const give = el("button", "secondary", "× 交渉をやめる"); give.onclick = () => { _scoutSess = null; renderScout(); };
  actions.appendChild(give);
  app.appendChild(actions);
}

// ── 1手の実行 ────────────────────────────────────────────────────────────
function _scoutAct(approachId) {
  const sess = _scoutSess; if (!sess) return;
  const t0 = sess.trust, w0 = sess.wary;   // デルタ演出用（表示のみ・数式は scoutResolve のまま）
  const res = scoutResolve(sess, approachId);
  if (res.outcome === "spent") { return; }   // ぱほぱほ使用済み
  // 効果音（存在するものだけ・表示専用）
  if (window.Sfx && Sfx.play) {
    if (res.outcome === "great") Sfx.play("legendary");
    else if (res.outcome === "good" || res.outcome === "soothe") Sfx.play("coin");
    else if (res.outcome === "bad") { (Sfx.play("buzz") || Sfx.play("click")); }
    else Sfx.play("click");
  }
  if (sess.status === "win") { _scoutWin(); return; }
  if (sess.status === "lose") { _scoutLose(); return; }
  _scoutRenderEncounter(false, res.reactionText, { outcome: res.outcome, dt: sess.trust - t0, dw: sess.wary - w0 });
}

// ── 成立＝心を開く → 既存の払い出し ──────────────────────────────────────
// G2: 成立の個別ひとこと。交渉ペルソナ(favCat)由来＝竜ごとに決定的で、口説き方の記憶と一致する。
const _SCOUT_WIN_VOICE = {
  "声": n => `名前を呼んだら、ちゃんとこっちを見たの。${n}、もう家族だ〜。`,
  "間": n => `${n}はね、間合いが大事なの。……今日、その間合いに入れてもらえた。`,
  "贈": n => `${n}、贈り物のときだけ目の色が変わるんだよ。かわいいやつめ〜。`,
  "遊": n => `${n}ってば、遊びだすと止まらないの。龍舎、にぎやかになるぞ〜。`,
  "身": n => `${n}が、そっと身を寄せてくれた。……あったかいんだ、竜って。`
};
function _scoutWin() {
  const d = _scoutMeetD;
  const e = poroColEntry(d.id);
  const isNew = !e.scouted;
  e.scouted = true; e.seen = true;
  if (typeof raiseAffection === "function") raiseAffection(d.id, 12);
  if (isNew && typeof epPush === "function") epPush("scoutNew");   // 終章：新種保護＝絶滅メーター押し戻し
  if (window.Sfx && Sfx.play) Sfx.play("legendary");
  if (typeof saveGame === "function") saveGame();
  _scoutSess = null;
  let mimiLine = "";
  try {
    const cat = (typeof scoutPersona === "function") ? scoutPersona(d).favCat : "身";
    mimiLine = (_SCOUT_WIN_VOICE[cat] || _SCOUT_WIN_VOICE["身"])(d.name);
  } catch (err) { mimiLine = ""; }
  showInfoPopup(`🤝 ${d.name} と心が通じた！`,
    `<div class="mm-row"><span class="mm-ic">🐲</span><div><b>${d.name}を龍舎に迎えた。</b><small>${d.portraitTone || d.tone || "言葉はなくても、気持ちは通じた。"}</small></div></div>` +
    (mimiLine ? `<div class="mm-row"><span class="mm-ic">🐰</span><div><b>ミミ</b><small>「${mimiLine}」</small></div></div>` : "") +
    (isNew ? `<div class="mm-row"><span class="mm-ic">📖</span><div><b>図鑑＆龍舎に登録</b><small>出会いの記録が増えた。</small></div></div>` : "") +
    `<div class="mm-note">※ 表示専用。レースの結果・オッズ・配当は変わりません。</div>`,
    () => { if (!_maybeEightAssembly(isNew)) renderScout(); });
}

// ── G1: 八竜集結（8頭目成立の夜・1回だけ）───────────────────────────────
// 表示専用のVN。終章中なら決意、終章前なら予告のトーン（NARRATIVE_DESIGN §6-2）。
function _maybeEightAssembly(isNew) {
  try {
    if (!isNew) return false;
    if (!(typeof scoutedRoster === "function" && scoutedRoster().length >= 8)) return false;
    if (typeof getStoryFlag === "function" && getStoryFlag("eightDragonsAssembled")) return false;
    if (!(window.Dialogue && Dialogue.play)) return false;
    if (typeof setStoryFlag === "function") setStoryFlag("eightDragonsAssembled", true);
    const inEp = (typeof epilogueOn === "function") && epilogueOn();
    const hasPoro = (typeof poroFound === "function") && poroFound();
    const script = [
      { s: "narrator", t: "龍舎に、八つ目の寝床が埋まった。……その夜。だれに呼ばれたわけでもなく、竜たちが庭に集まってくる。", bg: "images/bg/stable.webp" }
    ];
    if (hasPoro) script.push(["narrator", "輪のまんなかで、ポロがうれしそうにころんと転がった。——ここが真ん中だと言わんばかりに。"]);
    script.push(
      ["mimi", "わ、わ。みんな、どうしたの……？", "happy"],
      ["narrator", "八対の目が、まっすぐミミを見ている。強いからじゃない。速いからでもない。——好きで選んだ、八頭。"],
      ["mimi", "……うん。覚えてるよ。ひとりずつ、心が通じた日のこと。", "default"]
    );
    if (inEp) script.push(["mimi", "淘汰なんかに、この島は渡さない。{w:400}……その時が来たら、いっしょに走ろうね。", "default"]);
    else script.push(["mimi", "なんだろう。……この子たちとなら、どんな“最後”が来ても、だいじょうぶな気がする。", "smile"]);
    script.push(["narrator", "八竜、そろい踏み。——この夜のことを、島はのちに「集結」と呼ぶ。"]);
    Dialogue.play(script, { force: true }).then(() => renderScout());
    return true;
  } catch (err) { return false; }
}

// ── 決裂＝逃走（再挑戦可） ────────────────────────────────────────────────
function _scoutLose() {
  const d = _scoutMeetD;
  _scoutSess = null;
  showInfoPopup(`💨 ${d.name} は去っていった……`,
    `<div class="mm-row"><span class="mm-ic">🍃</span><div><b>警戒を解けなかった。</b><small>でも、また会いにいける。しぐさをよく読んで、気持ちに合う交渉術を選ぼう。</small></div></div>`,
    () => renderScout());
}
