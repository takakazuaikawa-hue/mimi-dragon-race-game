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

// ── 探索「けはい探し」＝遭遇の前の1手（SCOUT_REBORN §A）────────────────
// 「場所をタップ＝即遭遇」の無味乾燥を廃し、“どう探すか”の選択とお供の支度を挟む。
let _scoutGiftMeal = null;   // 持参する手土産（MEALSの1品・入場時に確定）
function scoutEnterLocation(locId) {
  const loc = scoutLocation(locId);
  const pool = unscoutedAtLocation(locId);
  if (!pool.length) {
    showInfoPopup(`${loc.ic} ${loc.name}`,
      `<div class="mm-row"><span class="mm-ic">✓</span><div><b>この場の竜とは、もう みんな仲良くなった。</b><small>別の場所をのぞいてみよう。</small></div></div>`);
    return;
  }
  _scoutMeetLoc = locId; _scoutGiftMeal = null;
  _scoutRenderProbe();
}
// 支度画面：探し方3択＋手土産。旅費はここでは引かない（出発を選んだ瞬間に精算）。
function _scoutRenderProbe() {
  const locId = _scoutMeetLoc, loc = scoutLocation(locId);
  const probes = (typeof scoutProbes === "function") ? scoutProbes(locId) : [];
  state.ui.screen = "scout";
  const app = beginScreen();
  const bg = _scBgTag(locId, "sc-stage-bg");
  const head = el("div", "sc-probe-hero");
  head.innerHTML =
    bg +
    `<div class="sc-stage-vig"></div>` +
    `<div class="sc-probe-t"><b>${loc.ic} ${loc.name}</b><small>${loc.mood}</small></div>`;
  app.appendChild(head);

  // 手土産＝実食済みメニューから1品（大好物なら特大効果）。持たずに行ってもよい。
  const eaten = (typeof MEALS !== "undefined" && typeof mealEaten === "function")
    ? MEALS.filter(m => !m.quiz && mealEaten(m.id)) : [];
  if (eaten.length) {
    app.appendChild(el("div", "sc-sec", "🎁 手土産をひとつ持っていく？"));
    const row = el("div", "sc-gift-row");
    const mk = (m) => {
      const price = (m && typeof mealPrice === "function") ? mealPrice(m) : 0;
      const on = _scoutGiftMeal && m && _scoutGiftMeal.id === m.id;
      const b = el("button", "sc-gift" + (on ? " on" : ""),
        m ? `<span class="sg-ic">${m.icon || "🍽"}</span><span class="sg-nm">${m.name}</span><small>−${price.toLocaleString("ja-JP")}</small>`
          : `<span class="sg-ic">🚫</span><span class="sg-nm">持たない</span><small>0</small>`);
      b.onclick = () => { _scoutGiftMeal = (on || !m) ? null : m; _scoutRenderProbe(); };
      return b;
    };
    row.appendChild(mk(null));
    eaten.forEach(m => row.appendChild(mk(m)));
    app.appendChild(row);
  }

  // 探し方3択
  app.appendChild(el("div", "sc-sec", "🔎 どうやって探す？"));
  const cost = loc.cost || 0;
  const giftCost = (_scoutGiftMeal && typeof mealPrice === "function") ? mealPrice(_scoutGiftMeal) : 0;
  const total = cost + giftCost;
  const canPay = (state.player.coins || 0) >= total;
  const list = el("div", "sc-probe-list");
  probes.forEach(p => {
    const b = el("button", "sc-probe" + (canPay ? "" : " poor"),
      `<span class="sp-ic">${p.ic}</span>` +
      `<span class="sp-bd"><b>${p.name}</b><small>${p.fl}</small></span>` +
      `<span class="sp-tag">${p.wary < 0 ? "🕊️ 警戒うすめ" : p.wary > 0 ? "⚡ 警戒つよめ" : "🎯 素直"}</span>`);
    b.onclick = () => { if (canPay) _scoutDoProbe(p.id); };
    list.appendChild(b);
  });
  app.appendChild(list);
  app.appendChild(el("div", "sc-cost",
    `🪙 旅費 <b>${cost.toLocaleString("ja-JP")}</b>` +
    (giftCost ? `　＋ 手土産 <b>${giftCost.toLocaleString("ja-JP")}</b>` : "") +
    `　＝ <b>${total.toLocaleString("ja-JP")}</b>　（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）` +
    (canPay ? "" : `<span class="sc-poor-note">コインが足りません</span>`)));

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 場所をえらび直す"); back.onclick = () => renderScout();
  actions.appendChild(back);
  app.appendChild(actions);
}
// 出発＝精算して遭遇へ。probe が「誰に会うか」「どれだけ警戒されるか」を変える。
function _scoutDoProbe(probeId) {
  const locId = _scoutMeetLoc, loc = scoutLocation(locId);
  const pool = unscoutedAtLocation(locId);
  if (!pool.length) { renderScout(); return; }
  const probe = (typeof scoutProbe === "function") ? scoutProbe(locId, probeId) : null;
  const cost = loc.cost || 0;
  const giftCost = (_scoutGiftMeal && typeof mealPrice === "function") ? mealPrice(_scoutGiftMeal) : 0;
  if ((state.player.coins || 0) < cost + giftCost) return;
  state.player.coins -= (cost + giftCost);
  if (typeof updateHeader === "function") updateHeader();
  state.player._scoutTrips = (state.player._scoutTrips || 0) + 1;   // 遠征回数（表示メタ）
  if (typeof saveGame === "function") saveGame();

  const started = (typeof scoutStartWithProbe === "function")
    ? scoutStartWithProbe(pool, locId, probe)
    : { dragon: pool[0], sess: createScoutSession(pool[0].id, locId) };
  _scoutMeetD = started.dragon; _scoutSess = started.sess;
  _scoutSess.gift = _scoutGiftMeal || null;
  // 小発見＝この地に棲む別の竜の名（次に来る動機）
  const found = (typeof scoutProbeFind === "function") ? scoutProbeFind(_scoutSess, pool, _scoutMeetD.id, probe) : null;
  // 📜 断章I「出会いの噂」＝遭遇で解禁（新規なら演出つき・図鑑に永久収集）
  const loreNew = (typeof dragonLoreUnlock === "function") ? dragonLoreUnlock(_scoutMeetD.id, 1) : null;
  _scoutRenderEncounter(true, null,
    { lore: loreNew, loreLv: 1, probe: probe, probeFind: found });
}

// ── 交渉エンカウンター画面（土台再設計）─────────────────────────────────
// 商業の定石＝①相手が主役（ポケモン捕獲：竜のHD-2Dスプライトを舞台中央に）②選択のたび相手が
// 目に見えて反応（ペルソナ交渉：しぐさ吹き出し＋リアクションアニメ）③緊張の可視化（太いデュアル
// ゲージ＋成立/逃走マーカー＋一手ごとのデルタ演出）。数式（scoutResolve）は一切不変＝表示層のみ。
// 舞台背景：①専用絵(images/scoutbg/・Codex納品=CODEX_ORDER_SCOUT_MALL.md §A)
//   ②未納品なら観光写真へ自動フォールバック ③どちらも無ければ静かに消える（404で崩れない）。
const SCOUT_LOC_BG = {
  grass: "images/scoutbg/grass.webp", jungle: "images/scoutbg/jungle.webp", cliff: "images/scoutbg/cliff.webp",
  sky: "images/scoutbg/sky.webp", volcano: "images/scoutbg/volcano.webp", sea: "images/scoutbg/sea.webp"
};
const SCOUT_LOC_BG_FB = {
  grass:   "images/konron/spots/mango_orchard.webp",
  jungle:  "images/konron/spots/susufuka.webp",
  cliff:   "images/konron/spots/kibishis.webp",
  sky:     "images/konron/spots/hoshimi.webp",
  volcano: "images/konron/spots/bangara.webp",
  sea:     "images/konron/spots/sena.webp"
};
function _scBgTag(locId, cls) {
  const a = SCOUT_LOC_BG[locId], b = SCOUT_LOC_BG_FB[locId];
  if (!a && !b) return "";
  return `<img class="${cls}" src="${a || b}" alt="" decoding="async" data-fb="${b || ""}"` +
    ` onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.remove();}">`;
}
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
  const bg = _scBgTag(_scoutMeetLoc, "sc-stage-bg");
  const nearWin = sess.trust >= SCOUT_TRUST_GOAL * 0.72;
  // ★距離演出3段（SCOUT_REBORN §B）：警戒が解けるほど竜が“近づいて”見える＝ゲージを絵で語る。
  const dist = sess.wary >= 55 ? " sc-far" : (sess.wary >= 28 ? " sc-mid" : " sc-near");
  const stage = el("div", "sc-stage");
  stage.innerHTML =
    bg +
    `<div class="sc-stage-vig"></div>` +
    `<div class="sc-meet-tag"><b>${d.name}</b><small>${loc.ic} ${loc.name}・気性 ${typeof poroTemperLabel === "function" ? poroTemperLabel(d) : "—"}</small></div>` +
    `<div class="sc-drg-wrap${dist}${first ? " sc-reveal" : ""}${fx.outcome ? " " + (SCOUT_FX_CLASS[fx.outcome] || "") : ""}" style="--dc:${(typeof dragonColor === "function") ? dragonColor(d) : (d.color || "#caa24a")}">` +
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
  // 探索の手ごたえ→遭遇の一文（“どう探したか”が物語になる）
  if (first) {
    if (fx.probe) app.appendChild(el("div", "sc-probe-log", `${fx.probe.ic} ${fx.probe.hit}`));
    app.appendChild(el("div", "sc-discover", `🐾 ${loc.mood.replace(/。$/, "")}——<b>${d.name}</b>が、そっと姿を見せた。`));
    if (fx.probeFind) app.appendChild(el("div", "sc-find",
      `👀 <b>小発見</b>：この地にはもう一頭、<b>${fx.probeFind.name}</b> が棲んでいるらしい。`));
  }

  // ── 緊張のデュアルゲージ（成立/逃走マーカー＋デルタ演出＋大詰めパルス）──
  const meters = el("div", "sc-meters");
  meters.innerHTML =
    _scoutBar("💗 信頼", sess.trust, SCOUT_TRUST_GOAL, "sc-trust", "成立", fx.dt, nearWin) +
    _scoutBar("⚠️ 警戒", sess.wary, SCOUT_WARY_MAX, "sc-wary", "逃走", fx.dw, false);
  app.appendChild(meters);
  if (nearWin) app.appendChild(el("div", "sc-nearwin", "✨ あと少しで、心が通じそう……！"));

  // 直前の反応（竜の返事）
  if (lastReaction) app.appendChild(el("div", "sc-react", lastReaction));
  // 📓 新しくメモできた瞬間＝上達の手ざわり
  if (fx.memoNew) app.appendChild(el("div", "sc-memo-new",
    `📓 メモした：<b style="color:${SCOUT_CAT_COLOR[fx.memoNew] || "#caa24a"}">${fx.memoNew}</b> の技が、この子には効く。`));

  // 📜 伝承（スカウト体験の核＝竜ごとの読み物が少しずつ解禁され図鑑に集まる）
  //   新規解禁＝金の演出つき／再訪の初手＝既知の断章Iを静かに再掲（読み返せる）。
  const loreT = (typeof dragonLoreTexts === "function") ? dragonLoreTexts(d.id) : null;
  if (fx.lore) {
    const lp = el("div", "sc-lore new");
    lp.innerHTML = `<div class="sc-lore-t">📜 ${DRAGON_LORE_TITLES[(fx.loreLv || 1) - 1]}——図鑑に刻まれた</div>` +
      `<div class="sc-lore-tx">${fx.lore}</div>`;
    app.appendChild(lp);
  } else if (first && loreT && typeof dragonLoreLv === "function" && dragonLoreLv(d.id) >= 1) {
    const lp = el("div", "sc-lore");
    lp.innerHTML = `<div class="sc-lore-t">📜 島の噂</div><div class="sc-lore-tx">${loreT[0]}</div>`;
    app.appendChild(lp);
  }

  // 手札
  const { hand, extras } = scoutHand(sess, 5);
  // ★交渉メモ（学習）＝この竜に前回効いた技カテゴリ。再訪ほど有利になる＝上達の可視化。
  const memo = (typeof scoutMemoGet === "function") ? scoutMemoGet(d.id) : [];
  app.appendChild(el("div", "sc-hand-lbl",
    "交渉術をえらぶ" + (memo.length ? `<span class="sc-memo">📓 メモ：${memo.map(c => `<i style="color:${SCOUT_CAT_COLOR[c] || "#caa24a"}">${c}</i>`).join("・")} が効いた</span>` : "")));
  const handWrap = el("div", "sc-hand");
  hand.forEach(a => {
    const known = memo.indexOf(a.cat) >= 0;
    // カテゴリSVG（Codex納品 images/nav/cat_*.svg）→無ければ従来の絵文字へ自動フォールバック
    const ck = (typeof SCOUT_CAT_ICON !== "undefined") ? SCOUT_CAT_ICON[a.cat] : null;
    const icHtml = ck
      ? `<img class="sc-cat-ic" src="images/nav/cat_${ck}.svg" alt=""` +
        ` onerror="this.replaceWith(document.createTextNode('${a.ic}'))">`
      : a.ic;
    const b = el("button", "sc-app" + (known ? " known" : ""),
      `<span class="sc-app-ic">${icHtml}</span><b>${a.name}</b><small>${a.fl}</small>` +
      (known ? `<i class="sc-app-memo">前回◎</i>` : ""));
    b.style.borderLeftColor = (SCOUT_CAT_COLOR[a.cat] || "#caa24a");
    b.onclick = () => _scoutAct(a.id);
    handWrap.appendChild(b);
  });
  app.appendChild(handWrap);

  const exWrap = el("div", "sc-extras");
  // 🎁 手土産＝持参していれば1回だけ切れる強カード（大好物なら特大）
  if (sess.gift && !sess.usedGift) {
    const g = el("button", "sc-extra sc-extra--gift", `<span>🎁</span> ${sess.gift.name}を差し出す`);
    g.onclick = () => _scoutGive();
    exWrap.appendChild(g);
  }
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
  // 📓 交渉メモ＝効いた技のカテゴリを竜ごとに学習（次に会う時の攻略情報）
  let memoNew = null;
  if (res.outcome === "great" || res.outcome === "good") {
    const a = (typeof scoutApproach === "function") ? scoutApproach(approachId) : null;
    if (a && a.cat && typeof scoutMemoAdd === "function" && scoutMemoAdd(_scoutMeetD.id, a.cat)) memoNew = a.cat;
  }
  if (sess.status === "win") { _scoutWin(); return; }
  if (sess.status === "lose") { _scoutLose(); return; }
  // 📜 断章II「島の逸話」＝心を開きかけた瞬間（信頼が成立ラインの半分に到達）に解禁
  const goal = (typeof SCOUT_TRUST_GOAL !== "undefined") ? SCOUT_TRUST_GOAL : 100;
  const lore2 = (sess.trust >= goal * 0.5 && typeof dragonLoreUnlock === "function")
    ? dragonLoreUnlock(_scoutMeetD.id, 2) : null;
  _scoutRenderEncounter(false, res.reactionText,
    { outcome: res.outcome, dt: sess.trust - t0, dw: sess.wary - w0, lore: lore2, loreLv: 2, memoNew: memoNew });
}

// 🎁 手土産を差し出す（1回だけ・大好物なら特大）。scoutGift は既存判定式に非干渉。
function _scoutGive() {
  const sess = _scoutSess; if (!sess || !sess.gift) return;
  const t0 = sess.trust, w0 = sess.wary;
  const fav = (typeof dragonFavFood === "function") ? dragonFavFood(_scoutMeetD) : null;
  const isFav = !!(fav && fav.id === sess.gift.id);
  const res = scoutGift(sess, isFav);
  if (res.outcome === "spent" || res.outcome === "end") return;
  try { if (window.Sfx) Sfx.play(isFav ? "legendary" : "coin"); } catch (e) {}
  // 大好物を当てたら図鑑に記録（龍舎のお世話と同じ台帳）
  if (isFav) { try { const e = poroColEntry(_scoutMeetD.id); if (e && !e.favFound) { e.favFound = true; if (typeof saveGame === "function") saveGame(); } } catch (e2) {} }
  const line = isFav
    ? `${_scoutMeetD.name}の鼻がぴくりと動いた——<b>大好物だ！</b> 目つきが、一気にやわらぐ。`
    : `${_scoutMeetD.name}はおずおずと近づき、${sess.gift.name}のにおいを嗅いだ。`;
  if (sess.status === "win") { _scoutWin(); return; }
  _scoutRenderEncounter(false, line,
    { outcome: res.outcome, dt: sess.trust - t0, dw: sess.wary - w0 });
}

// 🎉 成立の祝祭（SCOUT_REBORN §C）：竜が画面いっぱいに駆け寄り、紙吹雪が舞う。
// 純演出＝1.1秒で自動消滅。スプライトは既存のキー抜きキャッシュを再利用。
function _scoutWinFx(d) {
  try {
    if (typeof el !== "function" || typeof document === "undefined") return;
    const ex = document.getElementById("sc-winfx"); if (ex) ex.remove();
    const ov = el("div", "sc-winfx"); ov.id = "sc-winfx";
    ov.innerHTML = `<div class="scw-burst"></div><img class="scw-drg" alt="">` +
      `<div class="scw-conf">${Array.from({ length: 18 }, (_, i) =>
        `<i style="--i:${i};--x:${(i * 37) % 100}%;--c:${["#ffd76a", "#ff8db0", "#7fe0b0", "#8fc4ff"][i % 4]}"></i>`).join("")}</div>`;
    document.body.appendChild(ov);
    const im = ov.querySelector(".scw-drg");
    if (typeof _scSpriteInto === "function") _scSpriteInto(im, d.id);
    setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 1150);
  } catch (e) {}
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
  _scoutWinFx(d);   // 🎉 成立の祝祭（駆け寄り＋紙吹雪）
  let mimiLine = "";
  try {
    const cat = (typeof scoutPersona === "function") ? scoutPersona(d).favCat : "身";
    mimiLine = (_SCOUT_WIN_VOICE[cat] || _SCOUT_WIN_VOICE["身"])(d.name);
  } catch (err) { mimiLine = ""; }
  // 📜 断章III「伝承の真相」＝成立の報酬（読み物のご褒美・図鑑に全断章が揃う）
  const lore3 = (typeof dragonLoreUnlock === "function") ? dragonLoreUnlock(d.id, 3) : null;
  showInfoPopup(`🤝 ${d.name} と心が通じた！`,
    `<div class="mm-row"><span class="mm-ic">🐲</span><div><b>${d.name}を龍舎に迎えた。</b><small>${d.portraitTone || d.tone || "言葉はなくても、気持ちは通じた。"}</small></div></div>` +
    (lore3 ? `<div class="sc-lore new sc-lore--win"><div class="sc-lore-t">📜 断章 III 「伝承の真相」——全断章が図鑑に揃った</div><div class="sc-lore-tx">${lore3}</div></div>` : "") +
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
// ── 決裂＝逃走（再挑戦可）。★挫折を“攻略情報”に変える（SCOUT_REBORN §B）──
function _scoutLose() {
  const d = _scoutMeetD, sess = _scoutSess;
  // 最後まで読めなかった心情を開示＝「今日は何の気分だったのか」が分かって次に活きる
  const m = (sess && SCOUT_MOODS[sess.mood]) || null;
  const memo = (typeof scoutMemoGet === "function") ? scoutMemoGet(d.id) : [];
  _scoutSess = null;
  showInfoPopup(`💨 ${d.name} は去っていった……`,
    `<div class="mm-row"><span class="mm-ic">🍃</span><div><b>警戒を解けなかった。</b><small>竜は逃げただけ。何度でも会いにいける（失うのは旅費だけ）。</small></div></div>` +
    (m ? `<div class="sc-lose-read"><b>${m.ic || "🐲"} 今日は「${m.name}」の気分だったらしい。</b>` +
         `<span>${(m.reads || [""])[0] || ""}</span></div>` : "") +
    (memo.length
      ? `<div class="mm-row"><span class="mm-ic">📓</span><div><b>メモに残った</b><small>この子には <u>${memo.join("・")}</u> の技が効いた。次はそこから。</small></div></div>`
      : `<div class="mm-row"><span class="mm-ic">💡</span><div><b>次の一手</b><small>迷ったら「👀観察」で気持ちを確かめてから動くのも手。</small></div></div>`),
    () => renderScout());
}
