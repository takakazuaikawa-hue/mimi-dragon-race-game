// Local fictional conversation. Native activities remain the source of truth.
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function enabled() { return typeof IslandLifeLoop !== "undefined" && typeof chapterRead === "function" && chapterRead("3"); }
  function context() {
    const p = state.player, rpg = p.rpg || {}, progress = rpg.lifeProgress || {};
    const places = typeof KONRON_SPOTS === "undefined" ? [] : ["makemeshi", "backbistro", "ura_bistro", "mall"].filter(id => {
      const spot = KONRON_SPOTS[id];
      if (!spot || typeof _kmSpotOpen !== "function" || !_kmSpotOpen(spot) || typeof konronMapUnlocked !== "function" || !konronMapUnlocked()) return false;
      if (id === "ura_bistro") return typeof mealEaten === "function" && mealEaten("g_pasta");
      if (id === "mall") return typeof mallUnlocked === "function" && mallUnlocked();
      return true;
    });
    return { enabled: enabled(), completedRaces: p.completedRaces || 0, openSpots: places,
      currentSpotId: state.ui.screen === "mall" ? "mall" : state.ui.screen === "konron_map" && typeof _kmSpot !== "undefined" ? _kmSpot : null,
      ownedOutfits: typeof OUTFITS === "undefined" ? [] : OUTFITS.filter(o => outfitOwned(o)).map(o => ({ id: o.id, name: o.name, image: outfitImg(o.id, "default") })),
      currentOutfitId: typeof currentOutfitId === "function" ? currentOutfitId() : p.outfit,
      meals: typeof MEALS === "undefined" ? [] : MEALS.filter(m => typeof mealTierUnlocked === "function" && mealTierUnlocked(m.tier)).map(m => ({ id: m.id, name: m.name, image: m.photo || null, eaten: !!((p.meals || {}).eaten || {})[m.id] })),
      mallProgress: { steps: (p.fieldStats || {}).mallSteps || 0, battles: progress.battles || 0, purchases: progress.purchases || 0 } };
  }
  function getView() { return IslandLifeLoop.getView(state.player.islandLife, context()); }
  function commit(next) {
    if (JSON.stringify(next) === JSON.stringify(state.player.islandLife)) return;
    state.player.islandLife = next; if (typeof saveGame === "function") saveGame();
  }
  window.recordIslandLifeEvent = function (event) {
    if (typeof IslandLifeLoop === "undefined" || !state.player) return;
    if (!enabled() && (!event || !["meal", "outfit"].includes(event.type))) return;
    commit(IslandLifeLoop.record(state.player.islandLife, event, context()));
  };
  function arrival(spotId, force) {
    if (!enabled()) return;
    const prior = state.ui._lifeArrival;
    if (!force && prior && prior.spotId === spotId && prior.recorded) return;
    if (!prior || prior.spotId !== spotId || force) state.ui._lifeArrival = { spotId, echo: IslandLifeLoop.placeEcho(state.player.islandLife, spotId, context()), recorded: false };
    recordIslandLifeEvent({ type: "visit", spotId });
    state.ui._lifeArrival.recorded = true;
  }
  function help() {
    if (typeof showInfoPopup === "function") showInfoPopup("アヤと、おすすめの続き", '<p>気になる寄り道を一つ選び、いつもの食事や着替え、モールの探索で試せます。「またこれがいい」「自分には別が合う」「まだ決めない」――本音で返すと、次のおすすめや現地の挨拶が変わります。</p><p>全部巡る必要はありません。今の服に戻したいとき、食事代が足りないときは見送って大丈夫。料理の味当てだけでは実食にならず、注文して味わった一皿を会話に残します。</p><p>好きになった日常は終章の試遊にも持ち込めます。会話に正解や好感度報酬はありません。</p>');
  }
  function bindHelp(box) {
    box.querySelector(".il-help").onclick = help;
    if (!state.player.islandLife) {
      const badge = document.createElement("small"); badge.className = "il-new"; badge.textContent = "NEW";
      box.querySelector(".il-person b").appendChild(badge);
    }
  }
  function go(route) {
    state.ui._lifeResponseSpot = null;
    if (route.id === "style") { state.ui._lifeArrival = { spotId: "mall", echo: IslandLifeLoop.placeEcho(state.player.islandLife, "mall", context()), recorded: false }; renderMall(); }
    else if (typeof kmGotoSpot === "function") kmGotoSpot(route.placeId);
  }
  function refresh(host, channel, spotId) {
    const old = host.querySelector(":scope > .island-life"), nextSibling = old && old.nextSibling;
    if (old) old.remove();
    const current = append(host, channel, spotId);
    if (current && nextSibling && nextSibling.parentElement === host) host.insertBefore(current, nextSibling);
    if (current) current.scrollIntoView({ block: "start", behavior: "instant" });
  }
  function append(host, channel, spotId) {
    if (!enabled()) return;
    const v = getView(); if (!v.available || !v.routes.length) return;
    const cache = state.ui._lifeArrival, echo = spotId ? cache && cache.spotId === spotId ? cache.echo : IslandLifeLoop.placeEcho(state.player.islandLife, spotId, context()) : null;
    const a = v.active, local = channel === "in_person";
    if (local && a && !IslandLifeLoop.atRouteSpot(a.routeId, spotId)) return;
    const warmMeals = local && a && a.routeId === "warm" && !a.experience && typeof MEALS !== "undefined"
      ? (v.routes.find(r => r.id === "warm")?.mealIds || []).map(id => MEALS.find(m => m.id === id)).filter(m => m && (typeof mealTierUnlocked !== "function" || mealTierUnlocked(m.tier))) : [];
    const freeMeal = typeof hungerFreeMealOk === "function" && hungerFreeMealOk();
    const mealMenu = warmMeals.length ? '<div class="il-meal-menu"><b>今日は、どの一皿にする？</b><small>所持 ' + ((state.player.coins || 0).toLocaleString("ja-JP")) + 'コイン · 注文は次の画面で</small>' + warmMeals.map(m => {
      const price = typeof mealPrice === "function" ? mealPrice(m) : 0;
      const affordable = freeMeal || (state.player.coins || 0) >= price;
      return '<button data-life-meal="' + esc(m.id) + '" class="' + (affordable ? '' : 'il-meal-short') + '"><b>' + esc(m.name) + '</b><span>' + (freeMeal ? '今日はおごり' : price.toLocaleString("ja-JP") + 'コイン' + (affordable ? ' · 残り ' + ((state.player.coins || 0) - price).toLocaleString("ja-JP") : ' · 手持ち不足')) + '</span></button>';
    }).join('') + '</div>' : '';
    if (local && !a && !echo) {
      const route = v.routes.find(r => r.placeId === spotId || spotId === "ura_bistro" && r.id === "quiet"); if (!route) return;
    }
    const box = document.createElement("section"); box.className = "island-life";
    box._refreshIslandLife = () => refresh(host, channel, spotId);
    if (local && !a) {
      const r = v.routes.find(r => r.placeId === spotId || spotId === "ura_bistro" && r.id === "quiet"); if (!r) return;
      const reply = v.notice && state.ui._lifeResponseSpot === spotId ? v.notice : echo;
      const opening = r.id === "quiet" ? "「塩パスタ、気になった？　わたしの好きが、あなたにも合うかな」" : r.id === "warm" ? "「今日は、一杯どう？　あったかいものが欲しい日ってあるよね」" : "「今日は、どの姿で歩きたい？　手持ちの一着でもいいんだよ」";
      box.classList.add("il-local");
      box.innerHTML = '<div class="il-person"><span>aya_no_hibi</span><b>常連のアヤ</b><button class="il-help" aria-label="おすすめの会話について">？</button></div>' +
        `<div class="${reply === echo ? "il-echo" : "il-reply"}">${reply ? `<small>${esc(reply.title)}</small>` : ""}<p>${esc(reply ? reply.body : opening)}</p></div><button class="il-local-start">${reply ? "この寄り道の、話の続きをする" : "アヤのおすすめを、試してみる"}</button>` +
        `<details class="il-other-routes"${state.ui._lifeChooseRoutes ? " open" : ""}><summary>今日は、ほかの気分かもしれない</summary><div class="il-routes">` + v.routes.filter(x => x.id !== r.id).map(x => `<button class="il-route" data-life-other="${esc(x.id)}"><img src="${esc(x.image)}" alt="" loading="lazy"><span><small>${esc(x.mood)}</small><b>${esc(x.title)}</b></span></button>`).join("") + '</div></details>';
      bindHelp(box);
      box.querySelector(".il-local-start").onclick = () => { state.ui._lifeChooseRoutes = false; commit(IslandLifeLoop.start(state.player.islandLife, r.id, context())); recordIslandLifeEvent({ type: "visit", spotId }); refresh(host, channel, spotId); };
      box.querySelectorAll('[data-life-other]').forEach(b => { b.onclick = () => { state.ui._lifeChooseRoutes = false; commit(IslandLifeLoop.start(state.player.islandLife, b.dataset.lifeOther, context())); const next = getView().routes.find(x => x.id === b.dataset.lifeOther); if (next) go(next); }; });
      if (v.notice && typeof appendNextStoryEncounter === "function") appendNextStoryEncounter(box, ["4"]);
      host.appendChild(box); return box;
    }
    box.innerHTML = '<div class="il-person"><span>aya_no_hibi</span><b>常連のアヤ</b><button class="il-help" aria-label="おすすめの会話について">？</button></div>' +
      (echo ? `<div class="il-echo"><small>${esc(echo.title)}</small><p>${esc(echo.body)}</p></div>` : "") +
      (v.notice && (!local || state.ui._lifeResponseSpot === spotId) ? `<div class="il-reply"><small>${esc(v.notice.title)}</small><p>${esc(v.notice.body)}</p></div>` : "") +
      (a ? `<div class="il-active"><img src="${esc(a.experience && a.experience.image || a.image)}" alt=""><div><small>${a.experience && (a.experience.recalled || a.experience.beforeRecommendation) ? "前の体験を、思い返して" : "いま、気になっている寄り道"}</small><h3>${esc(a.title)}</h3><p>${esc(local && a.experience ? "「『" + a.experience.name + "』、どうだった？」" + (a.experience.recalled || a.experience.beforeRecommendation ? "今日は体験し直した記録ではなく、前の自分を思い返して。" : "") : a.body)}</p></div></div>` +
        `<button class="il-go" data-life-go="${esc(a.routeId)}">${local && (a.placeId === spotId || spotId === "ura_bistro" && a.routeId === "quiet") ? a.routeId === "style" ? "試着室で、今日の服を選ぶ" : "quiet" === a.routeId ? "塩パスタの味を、確かめる" : "この屋台の一杯を、味わう" : esc(a.placeName) + "へ"} ›</button>` +
        mealMenu +
        (local && a.routeId === "style" ? '<button class="il-explore">モールの中を、歩いてみる ›</button>' : "") +
        (a.recentAvailable ? `<button class="il-recall il-recent">${esc(a.recentLabel)}<small>おすすめを選ぶ前の実体験。注文や着替えをし直さず話す</small></button>` : "") +
        (a.recallAvailable ? `<button class="il-recall">${esc(a.recallLabel)}<small>今日は注文や購入をし直さず、前の体験について話す</small></button>` : "") +
        '<div class="il-opinions">' + a.choices.filter(c => c.enabled).map(c => `<button data-life-opinion="${esc(c.id)}"><b>${esc(c.label)}</b>${!local ? `<small>${esc(c.detail)}</small>` : ""}</button>`).join("") + '</div><button class="il-aside">今日は、別の寄り道がしたい</button>' :
        `<p class="il-invitation">${esc(v.invitation.body)}</p>` +
        (v.nextSuggestion ? `<p class="il-next">${v.history[0] && v.history[0].opinion === "again" ? v.favorite && v.favorite.visited ? "また、" + esc(v.nextSuggestion.placeName) + "で話の続きを。" : "次は、" + esc(v.nextSuggestion.placeName) + "にも寄ってみる？" : "今度は、" + esc(v.nextSuggestion.placeName) + "の方はどう？"}</p>` : "") +
        '<div class="il-routes">' + v.routes.map(r => `<button class="il-route${v.nextSuggestion && v.nextSuggestion.id === r.id ? " suggested" : ""}" data-life-start="${esc(r.id)}"><img src="${esc(r.image)}" alt="" loading="lazy"><span><small>${esc(r.mood)}</small><b>${esc(r.title)}</b></span></button>`).join("") + '</div>') +
      (v.favorite ? `<details class="il-favorite"><summary>わたしの好きになった日常</summary><p>${esc(v.favorite.quote)}</p><small>${esc(v.favorite.experience.detail)}</small></details>` : "");
    bindHelp(box);
    box.querySelectorAll('[data-life-start]').forEach(button => { button.onclick = () => {
      commit(IslandLifeLoop.start(state.player.islandLife, button.dataset.lifeStart, context()));
      const r = getView().routes.find(r => r.id === button.dataset.lifeStart); if (r) go(r);
    }; });
    box.querySelectorAll('[data-life-go]').forEach(button => { button.onclick = () => {
      const r = v.routes.find(r => r.id === button.dataset.lifeGo); if (!r) return;
      if (local && (r.placeId === spotId || spotId === "ura_bistro" && r.id === "quiet")) {
        if (r.id === "warm" && warmMeals.length) { box.querySelector('.il-meal-menu').scrollIntoView({ block: "center", behavior: "instant" }); return; }
        if (r.id === "style") { const fit = document.querySelector(".scm-fit"); if (fit) { fit.scrollIntoView({ block: "start", behavior: "smooth" }); return; } }
        else { const m = MEALS.find(m => m.id === (r.id === "quiet" ? "g_pasta" : "t_ramen")); if (m && typeof showMealDetail === "function") { showMealDetail(m); return; } }
      }
      go(r);
    }; });
    box.querySelectorAll('[data-life-meal]').forEach(button => { button.onclick = () => {
      const m = warmMeals.find(m => m.id === button.dataset.lifeMeal);
      if (m && typeof showMealDetail === "function") showMealDetail(m);
    }; });
    const explore = box.querySelector(".il-explore"); if (explore) explore.onclick = () => renderMallRpg();
    const recent = box.querySelector(".il-recent"); if (recent) recent.onclick = () => { commit(IslandLifeLoop.useRecent(state.player.islandLife, context())); refresh(host, channel, spotId); };
    const recall = box.querySelector(".il-recall:not(.il-recent)"); if (recall) recall.onclick = () => { commit(IslandLifeLoop.recall(state.player.islandLife, context())); refresh(host, channel, spotId); };
    box.querySelectorAll('[data-life-opinion]').forEach(button => { button.onclick = () => {
      state.ui._lifeResponseSpot = local ? spotId : null;
      commit(IslandLifeLoop.respond(state.player.islandLife, button.dataset.lifeOpinion, channel, context())); refresh(host, channel, spotId);
    }; });
    const aside = box.querySelector(".il-aside"); if (aside) aside.onclick = () => { state.ui._lifeChooseRoutes = true; commit(IslandLifeLoop.setAside(state.player.islandLife)); refresh(host, channel, spotId); };
    host.appendChild(box); return box;
  }
  window.appendIslandLifeFeed = host => append(host, "sns", null);
  window.refreshIslandLifePanels = function () {
    document.querySelectorAll(".island-life").forEach(box => {
      if (typeof box._refreshIslandLife === "function") box._refreshIslandLife();
    });
  };
  // A player choosing an outing from the chapter route is starting this
  // conversation, not buying anything or completing an experience.
  window.goIslandLifePlace = function (routeId) {
    if (!enabled()) return false;
    const r = getView().routes.find(r => r.id === routeId);
    if (!r) return false;
    commit(IslandLifeLoop.start(state.player.islandLife, r.id, context()));
    go(r);
    requestAnimationFrame(() => {
      const conversation = document.querySelector("#app .island-life");
      if (conversation) conversation.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return true;
  };
  window.appendIslandLifePurpose = function (host) {
    if (!enabled()) return;
    const memory = IslandLifeLoop.exportMemory(state.player.islandLife); if (!memory) return;
    const box = document.createElement("section"); box.className = "island-life il-purpose";
    box.innerHTML = `<img src="${esc(memory.image)}" alt=""><div><small>この島に、残っていてほしいもの</small><h3>${esc(memory.experience.name)}</h3><p>${esc(memory.quote)}</p><details><summary>アヤと話したことを読み返す</summary><p>${esc(memory.returnLine)}</p></details></div>`;
    host.appendChild(box);
  };
  window.appendIslandLifeMealExit = function (host, close) {
    if (!enabled()) return;
    const a = getView().active; if (!a || !a.experience || a.experience.kind !== "meal") return;
    const button = document.createElement("button"); button.className = "navpop-go il-meal-reply"; button.textContent = "アヤに、この味の感想を伝える";
    button.onclick = () => { close(); if (typeof broadcastOn === "function" && broadcastOn()) renderSns(); else { const r = getView().routes.find(r => r.id === a.routeId); if (r) go(r); } };
    host.appendChild(button);
  };
  window.appendIslandLifePlace = function (host, spotId) { if (state.ui._lifeNavigatingTo && state.ui._lifeNavigatingTo !== spotId) return; arrival(spotId, false); append(host, "in_person", spotId); };
  window.getIslandLifeContext = context;
  // Successful native shopping, not preview clicks, supplies the experience.
  if (typeof wearOutfit === "function") { const original = wearOutfit; wearOutfit = function (id) { const previousOutfitId = typeof currentOutfitId === "function" ? currentOutfitId() : state.player.outfit; const result = original(id); if (result && result.ok && previousOutfitId !== id) recordIslandLifeEvent({ type: "outfit", outfitId: id, previousOutfitId }); return result; }; }
  if (typeof buyOutfit === "function") { const original = buyOutfit; buyOutfit = function (id) { const result = original(id); if (result && result.ok) recordIslandLifeEvent({ type: "purchase", outfitId: id }); return result; }; }
  // A same-place navigation is a new arrival; panel redraws keep its first echo.
  if (typeof kmGotoSpot === "function") { const original = kmGotoSpot; kmGotoSpot = function (id) {
    state.ui._lifeResponseSpot = null;
    if (enabled() && context().openSpots.includes(id)) { state.ui._lifeArrival = { spotId: id, echo: IslandLifeLoop.placeEcho(state.player.islandLife, id, context()), recorded: false }; }
    state.ui._lifeNavigatingTo = id;
    try { return original(id); } finally { state.ui._lifeNavigatingTo = null; }
  }; }
})();
