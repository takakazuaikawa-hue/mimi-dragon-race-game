// A remembered recommendation, not a currency or a quest completion checklist.
// Adapters report successful native actions; this module never changes them.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.IslandLifeLoop = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ROUTES = [
    { id: "warm", title: "温かい一杯で、ほどけたい", mood: "湯気と、人のいる方へ", placeId: "makemeshi", placeName: "負け飯屋台", image: "images/konron/spots/makemeshi.webp", mealIds: ["t_ramen", "t_yakitori", "t_dote"], detail: "アヤのおすすめは一発逆転ラーメン。屋台の焼き鳥やどて煮でもいい。実際に味わって、自分にはどうだったか話そう。" },
    { id: "quiet", title: "静かなところで、味を確かめたい", mood: "看板のない路地へ", placeId: "backbistro", placeName: "看板のない路地裏ビストロ", image: "images/konron/spots/backbistro.webp", mealIds: ["g_pasta"], detail: "派手な具のない塩パスタ。誰かの絶賛より、自分がもう一口ほしいかを確かめに行く。" },
    { id: "style", title: "今日は、違う自分で歩きたい", mood: "モールの大屋根の下へ", placeId: "mall", placeName: "崑崙ショッピングモール", image: "images/konron/spots/mall_tropical_atrium.png", mealIds: [], detail: "手持ちの服に着替えても、新しい一着を選んでもいい。売場や迷宮を歩いて帰るだけの寄り道もある。" }
  ];
  const PERSON = "常連のアヤ", HANDLE = "@aya_no_hibi";
  const PLACES = ["makemeshi", "backbistro", "ura_bistro", "mall"];
  const MEAL_ORIGINS = { t_ramen: "負け飯屋台", t_yakitori: "勝ち飯横丁", t_dote: "勝ち飯横丁", g_pasta: "看板のない路地裏ビストロ" };
  const copy = x => JSON.parse(JSON.stringify(x));
  const text = (s, n) => typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n || 100) : "";
  const id = s => typeof s === "string" && /^[a-z][a-z0-9_]{0,60}$/.test(s) ? s : null;
  const integer = n => Number.isInteger(n) && n >= 0 && n <= 100000000 ? n : 0;
  const route = key => ROUTES.find(r => r.id === key);
  function atRouteSpot(routeId, spotId) {
    const r = route(routeId);
    return !!r && (spotId === r.placeId || (routeId === "quiet" && spotId === "ura_bistro"));
  }
  const image = s => typeof s === "string" && /^images\/(?:cast\/mimi|meals)\/[a-zA-Z0-9_-]+\.(?:webp|png|jpg)$/.test(s) ? s : null;
  const progress = p => ({ steps: integer(p && p.steps), battles: integer(p && p.battles), purchases: integer(p && p.purchases) });
  function context(raw) {
    const c = raw || {};
    return { enabled: c.enabled === true, completedRaces: integer(c.completedRaces), currentSpotId: id(c.currentSpotId), openSpots: Array.isArray(c.openSpots) ? c.openSpots.filter(id) : [],
      ownedOutfits: (Array.isArray(c.ownedOutfits) ? c.ownedOutfits : []).filter(o => o && id(o.id) && text(o.name)).map(o => ({ id: o.id, name: text(o.name, 80), image: image(o.image) })),
      currentOutfitId: id(c.currentOutfitId), meals: (Array.isArray(c.meals) ? c.meals : []).filter(m => m && id(m.id) && text(m.name)).map(m => ({ id: m.id, name: text(m.name, 80), eaten: m.eaten === true, image: image(m.image) })), mallProgress: progress(c.mallProgress) };
  }
  function outfit(raw) { return raw && id(raw.id) && text(raw.name) ? { id: raw.id, name: text(raw.name, 80), image: image(raw.image) } : null; }
  function experience(raw) {
    if (!raw || !["meal", "outfit", "purchase", "mall"].includes(raw.kind) || !id(raw.id) || !text(raw.name)) return null;
    const e = { kind: raw.kind, id: raw.id, name: text(raw.name, 80), image: image(raw.image), detail: text(raw.detail, 160) };
    if (raw.recalled === true && /^outing-[1-9][0-9]{0,8}$/.test(raw.sourceOutingId || "")) { e.recalled = true; e.sourceOutingId = raw.sourceOutingId; }
    if (raw.beforeRecommendation === true) e.beforeRecommendation = true;
    return e;
  }
  function entry(raw) {
    if (!raw || !route(raw.routeId) || !/^outing-[1-9][0-9]{0,8}$/.test(raw.id || "") || !["again", "different", "unsure"].includes(raw.opinion) || !["sns", "in_person"].includes(raw.channel)) return null;
    const exp = experience(raw.experience);
    if (raw.opinion !== "unsure" && !exp) return null;
    if (exp && (((raw.routeId === "style") === (exp.kind === "meal")) || (exp.kind === "meal" && !route(raw.routeId).mealIds.includes(exp.id)))) return null;
    return { id: raw.id, routeId: raw.routeId, startedAtRace: integer(raw.startedAtRace), completedRace: integer(raw.completedRace), visited: raw.visited === true,
      visitedSpotId: raw.visited === true && [route(raw.routeId).placeId, ...(raw.routeId === "quiet" ? ["ura_bistro"] : [])].includes(raw.visitedSpotId) ? raw.visitedSpotId : null,
      experience: exp, opinion: raw.opinion, channel: raw.channel, outfit: outfit(raw.outfit), reply: text(raw.reply, 500) };
  }
  function normalize(raw) {
    const r = raw && raw.version === 1 ? raw : {}, seen = new Set();
    const history = (Array.isArray(r.history) ? r.history : []).map(entry).filter(e => e && !seen.has(e.id) && seen.add(e.id)).slice(-6);
    let active = null;
    if (r.active && route(r.active.routeId) && /^outing-[1-9][0-9]{0,8}$/.test(r.active.id || "")) {
      const a = r.active;
      active = { id: a.id, routeId: a.routeId, startedAtRace: integer(a.startedAtRace), visited: a.visited === true, visitedSpotId: id(a.visitedSpotId), experience: experience(a.experience),
        initialOutfitId: id(a.initialOutfitId), initialOwnedOutfitIds: Array.isArray(a.initialOwnedOutfitIds) ? a.initialOwnedOutfitIds.filter(id) : [], initialMallProgress: progress(a.initialMallProgress) };
      if (active.experience && ((active.routeId === "style") === (active.experience.kind === "meal"))) active.experience = null;
    }
    const favorite = entry(r.favorite);
    // A short diary may roll over; each place still remembers the latest reply.
    // Existing saves recover that reply from their diary and chosen favorite.
    const conversations = {};
    for (const place of ROUTES) {
      const saved = entry(r.conversations && r.conversations[place.id]);
      const candidates = [saved && saved.routeId === place.id ? saved : null, ...history, favorite && favorite.opinion === "again" ? favorite : null]
        .filter(e => e && e.routeId === place.id);
      for (const e of candidates) if (!conversations[place.id] || Number(e.id.slice(7)) > Number(conversations[place.id].id.slice(7))) conversations[place.id] = copy(e);
    }
    const firstLocalStory = [entry(r.firstLocalStory), ...history, ...Object.values(conversations), favorite].find(isLocalStory) || null;
    const firstLocalMeal = [entry(r.firstLocalMeal), firstLocalStory, ...history, ...Object.values(conversations), favorite].find(isLocalMeal) || null;
    return { version: 1, firstLocalStory, firstLocalMeal, seq: Math.max(integer(r.seq), firstLocalMeal ? Number(firstLocalMeal.id.slice(7)) : 0, firstLocalStory ? Number(firstLocalStory.id.slice(7)) : 0, ...history.map(e => Number(e.id.slice(7))), ...Object.values(conversations).map(e => Number(e.id.slice(7))), active ? Number(active.id.slice(7)) : 0, favorite ? Number(favorite.id.slice(7)) : 0),
      active, history, conversations, recentExperience: r.recentExperience && ["meal", "outfit"].includes(r.recentExperience.kind) ? experience(r.recentExperience) : null,
      arrivals: Array.isArray(r.arrivals) ? PLACES.filter(p => r.arrivals.includes(p)) : [], favorite: favorite && favorite.opinion === "again" ? favorite : null, nextRouteId: route(r.nextRouteId) ? r.nextRouteId : null,
      notice: r.notice && text(r.notice.body) ? { title: text(r.notice.title), body: text(r.notice.body, 500) } : null };
  }
  function isLocalStory(e) { return !!(e && e.channel === "in_person" && e.experience); }
  function isLocalMeal(e) { return !!(isLocalStory(e) && e.experience.kind === "meal" && e.visited && e.visitedSpotId); }
  function openRoutes(c) { return ROUTES.filter(r => c.openSpots.includes(r.placeId)); }
  function start(raw, routeId, ctx) {
    const state = normalize(raw), c = context(ctx), r = route(routeId);
    if (!c.enabled || !r || !c.openSpots.includes(r.placeId)) return state;
    if (state.active && state.active.routeId === routeId) return state;
    state.seq++;
    state.active = { id: "outing-" + state.seq, routeId, startedAtRace: c.completedRaces, visited: false, visitedSpotId: null, experience: null,
      initialOutfitId: c.currentOutfitId, initialOwnedOutfitIds: c.ownedOutfits.map(o => o.id), initialMallProgress: c.mallProgress };
    state.notice = null;
    return state;
  }
  function record(raw, event, ctx) {
    const state = normalize(raw), c = context(ctx), a = state.active, e = event || {};
    // Only successful native events reach this adapter. Keep one actual choice
    // even before Aya is available; never infer an event from the meal album.
    if (e.type === "meal") {
      const m = c.meals.find(m => m.id === e.mealId && m.eaten);
      if (m) state.recentExperience = { kind: "meal", id: m.id, name: m.name, image: m.image, detail: "「" + m.name + "」を、実際に味わった。" };
    } else if (e.type === "outfit" && id(e.previousOutfitId) && e.previousOutfitId !== e.outfitId && c.currentOutfitId === e.outfitId) {
      const o = c.ownedOutfits.find(o => o.id === e.outfitId);
      if (o) state.recentExperience = { kind: "outfit", id: o.id, name: o.name, image: o.image, detail: "手持ちの「" + o.name + "」に、実際に着替えた。" };
    }
    if (!c.enabled) return state;
    if (e.type === "visit") {
      if (!PLACES.includes(e.spotId) || !c.openSpots.includes(e.spotId)) return state;
      if (!state.arrivals.includes(e.spotId)) state.arrivals.push(e.spotId);
      if (a && atRouteSpot(a.routeId, e.spotId)) { a.visited = true; a.visitedSpotId = e.spotId; }
      return state;
    }
    if (!a) return state;
    const r = route(a.routeId);
    if (e.type === "meal" && r.id !== "style") {
      const m = c.meals.find(m => m.id === e.mealId && r.mealIds.includes(m.id) && m.eaten);
      if (m) {
        a.experience = { kind: "meal", id: m.id, name: m.name, image: m.image, detail: "「" + m.name + "」を、実際に味わった。" + (MEAL_ORIGINS[m.id] !== r.placeName ? "おすすめの場所とは別の、" + MEAL_ORIGINS[m.id] + "の一皿を選んだ。" : "") };
        state.recentExperience = null;
      }
    } else if ((e.type === "outfit" || e.type === "purchase") && r.id === "style") {
      const o = c.ownedOutfits.find(o => o.id === e.outfitId);
      if (o && (e.type === "outfit" ? c.currentOutfitId === o.id && (o.id !== a.initialOutfitId || id(e.previousOutfitId) && e.previousOutfitId !== o.id) : !a.initialOwnedOutfitIds.includes(o.id))) {
        a.experience = { kind: e.type, id: o.id, name: o.name, image: o.image, detail: e.type === "outfit" ? "手持ちの「" + o.name + "」に着替えてみた。" : "通常の買い物で「" + o.name + "」を選んだ。" };
        if (e.type === "outfit") state.recentExperience = null;
      }
    } else if (e.type === "mall_return" && r.id === "style") {
      const d = Object.fromEntries(Object.keys(c.mallProgress).map(k => [k, Math.max(0, c.mallProgress[k] - a.initialMallProgress[k])]));
      if (d.steps >= 5 || d.battles >= 1 || d.purchases >= 1) a.experience = { kind: "mall", id: "mall_return", name: "モールを歩いた帰り道", image: null,
        detail: d.purchases ? "探索中の買い物をして、戻ってきた。" : d.battles ? "探索で戦いを経験して、戻ってきた。" : "自分の足で探索を進めて、戻ってきた。" };
    }
    return state;
  }
  function alternate(routeId, c) {
    const order = routeId === "quiet" ? ["warm", "style"] : routeId === "warm" ? ["quiet", "style"] : ["warm", "quiet"];
    return order.map(route).find(r => c.openSpots.includes(r.placeId)) || null;
  }
  function recallSource(state, routeId) {
    return [state.conversations[routeId], ...state.history, state.favorite]
      .filter(e => e && e.routeId === routeId && e.experience)
      .sort((a, b) => Number(b.id.slice(7)) - Number(a.id.slice(7)))[0] || null;
  }
  function recentSource(state, routeId) {
    const e = state.recentExperience, r = route(routeId);
    return e && r && (r.id === "style" ? e.kind === "outfit" : e.kind === "meal" && r.mealIds.includes(e.id)) ? e : null;
  }
  function useRecent(raw, ctx) {
    const state = normalize(raw), c = context(ctx), a = state.active;
    if (!c.enabled || !a || a.experience || !c.openSpots.includes(route(a.routeId).placeId)) return state;
    const source = recentSource(state, a.routeId);
    if (!source) return state;
    a.experience = copy(source);
    a.experience.beforeRecommendation = true;
    a.experience.detail = "このおすすめを選ぶ前に、実際に" + (source.kind === "meal" ? "味わった" : "着替えた") + "「" + source.name + "」について話す。今日は体験し直した記録ではない。";
    return state;
  }
  function recall(raw, ctx) {
    const state = normalize(raw), c = context(ctx), a = state.active;
    if (!c.enabled || !a || a.experience || !c.openSpots.includes(route(a.routeId).placeId)) return state;
    const source = recallSource(state, a.routeId);
    if (!source) return state;
    a.experience = copy(source.experience);
    a.experience.recalled = true;
    a.experience.sourceOutingId = source.experience.sourceOutingId || source.id;
    a.experience.detail = "前の「" + source.experience.name + "」を思い返した。今日は体験し直した記録ではなく、あの時の自分の好みについて返す。";
    return state;
  }
  function responseLine(e, next, arrivals) {
    const r = route(e.routeId), exp = e.experience;
    const visited = e.visited || (arrivals || []).includes(r.placeId);
    if (e.opinion === "unsure") return exp ? "「『" + exp.name + "』、すぐに好き嫌いを決めなくてもいいよ。今度ふと思い出したら、続きを聞かせて」" : "「今日は見送るんだね。お腹や財布と相談していいんだよ。おすすめは宿題じゃないから」";
    if (e.opinion === "different") return "「『" + exp.name + "』は、今日はしっくりこなかったか。わたしに合わせなくていいよ。" + (next ? "次は" + next.placeName + "の方を試してみる？" : "行きたい方が見つかったら、今度はそっちを教えて。") + "」";
    if (exp.kind === "meal") return "「『" + exp.name + "』、また食べたいんだね。" + (MEAL_ORIGINS[exp.id] !== r.placeName ? "おすすめの場所とは別の一皿を、自分で選んだんだ。" : "") + (visited ? r.placeName + "で会ったら、その話の続きをしよう。" : "まだお店で会ってはいないけど、その一皿の話は覚えておく。") + "自分の好きが見つかったなら、よかった」";
    if (exp.kind === "mall") return "「モールで歩いた帰り道、気に入ったんだね。いちばん上まで行けたかより、帰りに何を話してくれるかが楽しみ。次も、ひと息つこう」";
    return "「『" + exp.name + "』を選んだんだね。値段より、その姿で歩きたいって気持ちの方を覚えておく。次に会ったら、すぐわかりそう」";
  }
  function respond(raw, opinion, channel, ctx) {
    const state = normalize(raw), c = context(ctx), a = state.active;
    if (!c.enabled || !a || !["again", "different", "unsure"].includes(opinion) || !["sns", "in_person"].includes(channel) || (opinion !== "unsure" && !a.experience)) return state;
    if (channel === "in_person") {
      if (!c.openSpots.includes(c.currentSpotId) || !atRouteSpot(a.routeId, c.currentSpotId)) return state;
      a.visited = true;
      a.visitedSpotId = c.currentSpotId;
      if (!state.arrivals.includes(c.currentSpotId)) state.arrivals.push(c.currentSpotId);
    }
    const next = opinion === "different" ? alternate(a.routeId, c) : opinion === "again" ? route(a.routeId) : null;
    const e = { id: a.id, routeId: a.routeId, startedAtRace: a.startedAtRace, completedRace: c.completedRaces, visited: a.visited, visitedSpotId: a.visitedSpotId,
      experience: a.experience, opinion, channel, outfit: c.ownedOutfits.find(o => o.id === c.currentOutfitId) || null };
    e.reply = (e.experience && e.experience.recalled ? "「前に体験したことを思い返して、話してくれたんだね」" : e.experience && e.experience.beforeRecommendation ? "「自分で選んだ体験を、教えてくれたんだね」" : "") + responseLine(e, next, state.arrivals);
    if (e.experience && e.experience.beforeRecommendation && state.recentExperience && e.experience.kind === state.recentExperience.kind && e.experience.id === state.recentExperience.id) state.recentExperience = null;
    state.history = state.history.filter(h => h.id !== e.id).concat(e).slice(-6);
    if (!state.firstLocalStory && isLocalStory(e)) state.firstLocalStory = copy(e);
    if (!state.firstLocalMeal && isLocalMeal(e)) state.firstLocalMeal = copy(e);
    state.conversations[a.routeId] = copy(e);
    if (opinion === "again") state.favorite = copy(e);
    else if (opinion === "different" && state.favorite && state.favorite.routeId === a.routeId) state.favorite = null;
    state.nextRouteId = next ? next.id : null;
    state.notice = { title: PERSON + "からの返事", body: e.reply };
    state.active = null;
    return state;
  }
  function setAside(raw) { const state = normalize(raw); state.active = null; state.notice = { title: "寄り道は、また気が向いたときに", body: "誰かへの返事を急がなくていい。今までの好みと会話は、そのまま残っています。" }; return state; }
  function exportMemory(raw) {
    const state = normalize(raw), e = state.favorite;
    if (!e || !e.experience) return null;
    const r = route(e.routeId), placeId = e.visitedSpotId || r.placeId;
    const placeName = placeId === "ura_bistro" ? "路地裏ビストロの隠し席" : r.placeName;
    const picture = placeId === "ura_bistro" ? "images/konron/spots/ura_bistro.webp" : r.image;
    return { version: 1, id: e.id, routeId: e.routeId, placeId, placeName, image: picture, person: PERSON, handle: HANDLE,
      experience: copy(e.experience), opinion: "again", channel: e.channel, visited: e.visited || state.arrivals.includes(placeId), visitedAtChoice: e.visited, completedRace: e.completedRace, outfit: copy(e.outfit),
      quote: "『" + e.experience.name + "』を、また" + (e.experience.kind === "meal" ? "味わいたい" : e.experience.kind === "mall" ? "歩きたい" : "選びたい") + "。",
      returnLine: e.reply };
  }
  function normalizeMemory(raw) {
    if (!raw || raw.version !== 1 || raw.opinion !== "again") return null;
    const e = entry({ ...raw, visitedSpotId: raw.placeId, reply: raw.returnLine });
    const m = e ? exportMemory({ version: 1, favorite: e }) : null;
    if (m && typeof raw.visitedAtChoice === "boolean") m.visitedAtChoice = raw.visitedAtChoice;
    return m;
  }
  function finishEcho(raw) {
    const m = normalizeMemory(raw);
    if (!m) return null;
    return { title: "また、その続きを話そう", image: m.image, body: "アヤは、あなたが『" + m.experience.name + "』をまた選びたいと言ったことを覚えていた。" + (m.visited ? "「" + m.placeName + "で、あの話の続きをしよう。" : "「まだ一緒にお店へ行ってはいないけど、あのおすすめの続きを聞かせて。") + "好きだった理由も、次は違うと思った話も、どっちも聞きたいから」" };
  }
  function placeEcho(raw, spotId, ctx) {
    const state = normalize(raw), c = context(ctx);
    if (!c.enabled || !c.openSpots.includes(spotId)) return null;
    const e = Object.values(state.conversations).find(e => route(e.routeId).placeId === spotId || (e.routeId === "quiet" && spotId === "ura_bistro"));
    if (!e) return null;
    const r = route(e.routeId);
    const visited = state.arrivals.includes(spotId) || (e.visited && (e.visitedSpotId || r.placeId) === spotId);
    const body = e.opinion === "again" ? "「" + (visited ? "おかえり。" : "ここでこの話をするのは、初めてだね。") + "前に話してくれた『" + e.experience.name + "』、覚えてるよ。今日は同じにする？　違う気分でも、聞かせて」"
      : e.opinion === "different" ? "「前は『" + e.experience.name + "』が合わなかったんだよね。今日は違う選び方をしてもいいし、顔だけ見せて帰ってもいいよ」"
      : "「この前は決めずに帰ったね。今日の気分はどう？　まだわからなくても、ここで休んでいって」";
    return { title: PERSON + "が、前の話を覚えていた", body, image: spotId === "ura_bistro" ? "images/konron/spots/ura_bistro.webp" : r.image };
  }
  function getView(raw, ctx) {
    const state = normalize(raw), c = context(ctx), available = c.enabled, routes = available ? openRoutes(c).map(r => Object.assign(copy(r), { available: true })) : [];
    const a = state.active, r = a && route(a.routeId);
    const previous = available && a && !a.experience && c.openSpots.includes(r.placeId) ? recallSource(state, a.routeId) : null;
    const recent = available && a && !a.experience && c.openSpots.includes(r.placeId) ? recentSource(state, a.routeId) : null;
    const active = available && a ? { id: a.id, routeId: r.id, title: r.title, placeId: r.placeId, placeName: r.placeName, image: r.image, visited: a.visited, experience: copy(a.experience), canRespond: !!a.experience,
      recallAvailable: !!previous, recallLabel: previous ? "前の「" + previous.experience.name + "」を思い返して返す" : null,
      recentAvailable: !!recent, recentLabel: recent ? "前に" + (recent.kind === "meal" ? "食べた" : "着替えた") + "「" + recent.name + "」について話す" : null,
      body: a.experience ? a.experience.detail + "　アヤの好みと同じだった？　違った？　自分の言葉で返してみよう。" : r.detail + "　今は見送っても、何も失いません。",
      choices: [{ id: "again", label: "また、これがいい", detail: "自分の好きな日常として、一つ覚えておく。", enabled: !!a.experience }, { id: "different", label: "わたしには、別の方が合いそう", detail: "次は別のおすすめを聞く。相手の好みに合わせなくていい。", enabled: !!a.experience }, { id: "unsure", label: a.experience ? "まだ、決めないでおく" : "今日は見送る、と伝える", detail: "すぐに結論を出さず、今の気分を返す。", enabled: true }] } : null;
    return { available, invitation: available ? { person: PERSON, handle: HANDLE, title: "誰かのおすすめが、わたしの好きになるまで", body: "「今日は、どんな寄り道がしたい？　わたしの好きが、あなたにも合うとは限らないから。行ってみたら、ほんとのところを聞かせて」" } : null,
      routes, active, history: state.history.slice().reverse().map(copy), arrivals: state.arrivals.slice(), favorite: exportMemory(state), nextSuggestion: routes.find(r => r.id === state.nextRouteId) || null, notice: copy(state.notice) };
  }
  return { normalize, getView, start, record, recall, useRecent, respond, setAside, placeEcho, exportMemory, normalizeMemory, finishEcho, atRouteSpot };
});
