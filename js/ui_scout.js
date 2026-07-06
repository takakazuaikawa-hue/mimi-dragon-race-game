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
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースを勝ち進み、相棒ポロと出会うと、新しい竜を探しに行けるようになります。</small></div></div>`);
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

// ── 交渉エンカウンター画面 ───────────────────────────────────────────────
function _scoutBar(label, val, max, cls) {
  const pct = Math.max(0, Math.min(100, Math.round((val / max) * 100)));
  return `<div class="sc-meter ${cls}"><span class="sc-meter-l">${label}</span>` +
    `<span class="sc-meter-t"><i style="width:${pct}%"></i></span></div>`;
}
function _scoutRenderEncounter(first, lastReaction) {
  const d = _scoutMeetD, sess = _scoutSess, loc = scoutLocation(_scoutMeetLoc);
  if (!d || !sess) { renderScout(); return; }
  state.ui.screen = "scout";
  const app = beginScreen();

  // 見出し（出会い）
  const head = el("div", "sc-meet-head");
  head.innerHTML =
    `<span class="sc-meet-dot" style="background:${d.color || "#caa24a"}"></span>` +
    `<div class="sc-meet-id"><b>${d.name}</b>` +
    `<small>${loc.ic} ${loc.name}で出会った・気性 ${typeof poroTemperLabel === "function" ? poroTemperLabel(d) : "—"}</small></div>`;
  app.appendChild(head);
  if (first) app.appendChild(el("div", "sc-discover", `🐾 ${loc.mood.replace(/。$/, "")}——足跡をたどると、<b>${d.name}</b>がそっと姿を見せた。`));

  // メーター
  const meters = el("div", "sc-meters");
  meters.innerHTML = _scoutBar("💗 信頼", sess.trust, SCOUT_TRUST_GOAL, "sc-trust") + _scoutBar("⚠️ 警戒", sess.wary, SCOUT_WARY_MAX, "sc-wary");
  app.appendChild(meters);

  // しぐさ（心情は revealed のときだけ明示）
  const mood = SCOUT_MOODS[sess.mood] || {};
  const gbox = el("div", "sc-gesture");
  gbox.innerHTML =
    `<div class="sc-gesture-tx">${sess.gesture}</div>` +
    (sess.revealed ? `<div class="sc-gesture-read">${mood.ic || ""} いまの気持ち：<b>${mood.name || "？"}</b>　${(mood.reads || [""])[0] || ""}</div>`
                   : `<div class="sc-gesture-hint">（このしぐさは、何の気持ち……？）</div>`);
  app.appendChild(gbox);

  // 直前の反応
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
  _scoutRenderEncounter(false, res.reactionText);
}

// ── 成立＝心を開く → 既存の払い出し ──────────────────────────────────────
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
  showInfoPopup(`🤝 ${d.name} と心が通じた！`,
    `<div class="mm-row"><span class="mm-ic">🐲</span><div><b>${d.name}を龍舎に迎えた。</b><small>${d.portraitTone || d.tone || "言葉はなくても、気持ちは通じた。"}</small></div></div>` +
    (isNew ? `<div class="mm-row"><span class="mm-ic">📖</span><div><b>図鑑＆龍舎に登録</b><small>出会いの記録が増えた。</small></div></div>` : "") +
    `<div class="mm-note">※ 表示専用。レースの結果・オッズ・配当は変わりません。</div>`,
    () => renderScout());
}

// ── 決裂＝逃走（再挑戦可） ────────────────────────────────────────────────
function _scoutLose() {
  const d = _scoutMeetD;
  _scoutSess = null;
  showInfoPopup(`💨 ${d.name} は去っていった……`,
    `<div class="mm-row"><span class="mm-ic">🍃</span><div><b>警戒を解けなかった。</b><small>でも、また会いにいける。しぐさをよく読んで、気持ちに合う交渉術を選ぼう。</small></div></div>`,
    () => renderScout());
}
