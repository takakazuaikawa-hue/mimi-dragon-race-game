"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const E = require("../js/island_life_loop.js");
const freeze = x => { if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const base = freeze({ enabled: true, completedRaces: 12, openSpots: ["makemeshi", "backbistro", "mall"],
  ownedOutfits: [{ id: "traveler", name: "旅装", image: "images/cast/mimi/mimi_taipei_default.webp" }, { id: "newspaper", name: "記者服", image: "images/cast/mimi/mimi_newspaper_default.webp" }], currentOutfitId: "traveler",
  meals: [{ id: "t_ramen", name: "一発逆転ラーメン", eaten: false }, { id: "t_yakitori", name: "勝負めし焼き鳥", eaten: false }, { id: "g_pasta", name: "路地裏のシンプル塩パスタ", eaten: false }, { id: "h_tkg", name: "夜食の卵かけごはん", eaten: true }],
  mallProgress: { steps: 100, battles: 4, purchases: 2 }, coins: 0, race: { order: ["rubel", "poro"], odds: [1.2, 3.5] } });
const eaten = mealId => ({ ...base, meals: base.meals.map(m => ({ ...m, eaten: m.eaten || m.id === mealId })) });
const initial = freeze(E.normalize(null));
assert.equal(E.getView(initial, { ...base, enabled: false }).available, false);
assert.deepEqual(E.start(initial, "warm", { ...base, enabled: false }), initial);
assert.equal(E.getView(initial, { ...base, openSpots: ["makemeshi"] }).routes.length, 1);
assert.deepEqual(E.start(initial, "quiet", { ...base, openSpots: ["makemeshi"] }), initial);
assert.deepEqual(E.start(initial, "missing", base), initial);
assert.doesNotMatch(JSON.stringify(E.getView(initial, base)), /ura_bistro|隠し席|images\/cg\//);

let warm = freeze(E.start(initial, "warm", base));
assert.deepEqual(E.start(warm, "warm", base), warm, "opening a recommendation twice reset its baseline");
assert.deepEqual(E.respond(warm, "again", "sns", base), warm, "liking an experience must require the experience");
assert.equal(E.record(warm, { type: "meal", mealId: "t_ramen" }, base).active.experience, null, "a solved or viewed dish was mistaken for eating");
assert.equal(E.record(warm, { type: "meal", mealId: "h_tkg" }, base).active.experience, null, "unrelated home food was attributed to the recommended venue");
const deferred = E.respond(warm, "unsure", "sns", base);
assert.equal(deferred.active, null);
assert.equal(E.exportMemory(deferred), null);
assert.match(deferred.notice.body, /おすすめは宿題じゃない/);
assert.equal(E.setAside(warm).active, null);
assert.equal(E.exportMemory(E.setAside(warm)), null);

warm = freeze(E.record(warm, { type: "meal", mealId: "t_ramen" }, eaten("t_ramen")));
assert.equal(warm.active.visited, false, "eating alone created a visit that did not occur");
const liked = freeze(E.respond(warm, "again", "sns", eaten("t_ramen")));
const memory = E.exportMemory(liked);
assert.equal(memory.visited, false);
assert.equal(memory.visitedAtChoice, false);
assert.match(memory.returnLine, /まだお店で会ってはいない/);
assert.deepEqual(E.normalizeMemory(memory), memory);
assert.equal(E.getView(liked, base).nextSuggestion.id, "warm");
assert.match(E.placeEcho(liked, "makemeshi", base).body, /初めて/);
const arrived = freeze(E.record(liked, { type: "visit", spotId: "makemeshi" }, base));
assert.deepEqual(arrived.history, liked.history, "later arrivals rewrote what was true when the player replied");
assert.deepEqual(arrived.favorite, liked.favorite);
assert.match(E.placeEcho(arrived, "makemeshi", base).body, /おかえり/);
assert.equal(E.exportMemory(arrived).visited, true);
assert.equal(E.exportMemory(arrived).visitedAtChoice, false);
assert.deepEqual(E.normalizeMemory(E.exportMemory(arrived)), E.exportMemory(arrived));
assert.deepEqual(E.record(arrived, { type: "visit", spotId: "makemeshi" }, base), arrived, "repeat rendering created visit progression");
assert.equal(E.placeEcho(liked, "makemeshi", { ...base, openSpots: [] }), null);
assert.deepEqual(E.record(liked, { type: "visit", spotId: "ura_bistro" }, base), liked);

const atStall = { ...base, currentSpotId: "makemeshi" };
const changed = E.respond(warm, "different", "in_person", atStall);
assert.equal(changed.favorite, null);
assert.equal(E.getView(changed, base).nextSuggestion.id, "quiet");
assert.match(changed.notice.body, /合わせなくていい/);
assert.match(E.placeEcho(changed, "makemeshi", base).body, /違う選び方/);
const privateLike = E.respond(warm, "again", "in_person", atStall);
assert.equal(privateLike.favorite.experience.id, liked.favorite.experience.id, "SNS use became mandatory to have a favorite");
assert.equal(privateLike.favorite.channel, "in_person");
assert.equal(E.respond(warm, "again", "like_farming", base).active.id, warm.active.id);
const yakitori = E.respond(E.record(E.start(initial, "warm", base), { type: "meal", mealId: "t_yakitori" }, eaten("t_yakitori")), "again", "sns", base);
assert.match(yakitori.favorite.experience.detail, /別の、勝ち飯横丁/);
assert.match(yakitori.favorite.reply, /おすすめの場所とは別の一皿/);
assert.equal(yakitori.favorite.visited, false);

let quiet = E.start(initial, "quiet", base);
quiet = E.record(quiet, { type: "visit", spotId: "backbistro" }, base);
assert.equal(quiet.active.visited, true);
assert.equal(quiet.active.experience, null);
quiet = E.record(quiet, { type: "meal", mealId: "g_pasta" }, eaten("g_pasta"));
const hiddenContext = { ...eaten("g_pasta"), openSpots: [...base.openSpots, "ura_bistro"], currentSpotId: "ura_bistro" };
quiet = E.record(quiet, { type: "visit", spotId: "ura_bistro" }, hiddenContext);
quiet = E.respond(quiet, "again", "in_person", hiddenContext);
assert.equal(E.exportMemory(quiet).placeId, "ura_bistro");
assert.match(E.finishEcho(E.exportMemory(quiet)).body, /路地裏ビストロの隠し席/);

const style = freeze(E.start(initial, "style", base));
assert.equal(E.record(style, { type: "outfit", outfitId: "traveler" }, base).active.experience, null);
assert.equal(E.record(style, { type: "outfit", outfitId: "locked_reward" }, { ...base, currentOutfitId: "locked_reward" }).active.experience, null);
const dressed = E.record(style, { type: "outfit", outfitId: "newspaper" }, { ...base, currentOutfitId: "newspaper" });
for (const spotId of ["tanada", "makemeshi", null]) {
  const away = { ...base, currentSpotId: spotId, openSpots: [...base.openSpots, "tanada"] };
  const visited = E.record(dressed, { type: "visit", spotId: "mall" }, base);
  assert.deepEqual(E.respond(visited, "unsure", "in_person", away), visited, "previous visits must not supply the current location");
  assert.equal(E.respond(visited, "unsure", "sns", away).history[0].channel, "sns");
}
const outsideMall = { ...base, currentSpotId: "mall", openSpots: ["makemeshi"] };
assert.deepEqual(E.respond(dressed, "again", "in_person", outsideMall), dressed, "locked mall accepted an in-person reply");
assert.equal(E.respond(dressed, "unsure", "in_person", { ...base, currentSpotId: "mall" }).firstLocalStory.visitedSpotId, "mall");
assert.equal(dressed.active.experience.kind, "outfit", "free owned clothing should be a real choice even with no coins");
const dressedBack = E.record(dressed, { type: "outfit", outfitId: "traveler", previousOutfitId: "newspaper" }, base);
assert.equal(dressedBack.active.experience.id, "traveler", "changing back to the original outfit left an obsolete choice in the conversation");
assert.equal(dressedBack.recentExperience, null);
assert.equal(E.record(style, { type: "purchase", outfitId: "newspaper" }, base).active.experience, null, "an existing outfit was relabelled as a new purchase");
const bought = E.record(style, { type: "purchase", outfitId: "new_coat" }, { ...base, ownedOutfits: [...base.ownedOutfits, { id: "new_coat", name: "購入した服", image: "images/cg/locked.webp" }] });
assert.equal(bought.active.experience.kind, "purchase");
assert.equal(bought.active.experience.image, null, "reward CG leaked into the life memory");
for (const steps of [0, 1, 4]) assert.equal(E.record(style, { type: "mall_return" }, { ...base, mallProgress: { ...base.mallProgress, steps: 100 + steps } }).active.experience, null, "entry and immediate exit became an exploration experience");
for (const [key, increment] of [["steps", 5], ["battles", 1], ["purchases", 1]]) {
  const explored = E.record(style, { type: "mall_return" }, { ...base, mallProgress: { ...base.mallProgress, [key]: base.mallProgress[key] + increment } });
  assert.equal(explored.active.experience.kind, "mall");
}
assert.equal(E.record(style, { type: "mall_return" }, { ...base, mallProgress: { steps: 0, battles: 0, purchases: 0 } }).active.experience, null, "reset counters were counted as new exploration");

// Keeping someone else's taste is not a completion score. The latest actual
// opinion changes the next recommendation; every route can be put aside.
let rounds = initial;
for (let i = 0; i < 10; i++) {
  rounds = E.start(rounds, "warm", base);
  rounds = E.record(rounds, { type: "meal", mealId: "t_ramen" }, eaten("t_ramen"));
  rounds = E.respond(rounds, i === 0 ? "again" : "unsure", "sns", base);
}
assert.equal(rounds.history.length, 6);
assert.equal(rounds.favorite.id, "outing-1", "history trimming erased the player's favorite");
assert.equal(E.exportMemory(rounds).experience.id, "t_ramen");
assert.equal(rounds.conversations.warm.id, "outing-10", "a favorite overrode a more recent undecided reply");
assert.match(E.placeEcho(rounds, "makemeshi", base).body, /決めず/);

// Visiting other places must not make this place forget either affection or
// disagreement. Keep one latest conversation per route, not an unbounded log.
function elsewhere(state) {
  for (let i = 0; i < 7; i++) state = E.respond(E.start(state, i % 2 ? "style" : "quiet", base), "unsure", "sns", base);
  return state;
}
const remembered = freeze(elsewhere(liked));
assert.equal(remembered.history.some(e => e.routeId === "warm"), false);
assert.equal(remembered.conversations.warm.id, "outing-1");
assert.match(E.placeEcho(remembered, "makemeshi", base).body, /一発逆転ラーメン/);
assert.equal(Object.keys(remembered.conversations).length, 3);
const rememberedDislike = elsewhere(changed);
assert.equal(rememberedDislike.favorite, null);
assert.match(E.placeEcho(rememberedDislike, "makemeshi", base).body, /合わなかった/);
const replaced = E.respond(E.record(E.start(remembered, "warm", base), { type: "meal", mealId: "t_ramen" }, eaten("t_ramen")), "different", "sns", base);
assert.equal(replaced.favorite, null);
assert.match(E.placeEcho(elsewhere(replaced), "makemeshi", base).body, /合わなかった/);
assert.equal(remembered.conversations.warm.opinion, "again", "updating a conversation mutated the prior state");

const legacy = JSON.parse(JSON.stringify(remembered));
delete legacy.conversations;
assert.match(E.placeEcho(legacy, "makemeshi", base).body, /一発逆転ラーメン/, "legacy favorite was not migrated after diary trimming");
const legacyRecent = JSON.parse(JSON.stringify(rounds));
delete legacyRecent.conversations;
assert.equal(E.normalize(legacyRecent).conversations.warm.id, "outing-10", "legacy favorite hid a newer diary response");
const badMap = E.normalize({ version: 1, conversations: { warm: quiet.history[0], surprise: liked.history[0] } });
assert.deepEqual(badMap.conversations, {}, "unknown or mismatched route keys survived validation");
const conversationOnly = E.normalize({ version: 1, conversations: { warm: replaced.conversations.warm } });
assert.ok(conversationOnly.seq >= Number(replaced.conversations.warm.id.slice(7)));
assert.notEqual(E.start(conversationOnly, "quiet", base).active.id, replaced.conversations.warm.id);
assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(remembered))).conversations, remembered.conversations);

// A full stomach or no money must not require buying a repeat experience just
// to reconsider an honest opinion. Recall is explicit, never another meal.
assert.deepEqual(E.recall(warm, base), warm, "recall replaced a fresh experience");
const untried = E.start(initial, "quiet", base);
assert.equal(E.getView(untried, base).active.recallAvailable, false);
assert.deepEqual(E.recall(untried, base), untried);
assert.deepEqual(E.recall(E.start(liked, "quiet", base), base), E.start(liked, "quiet", base), "another route's experience became recall evidence");
const revisit = freeze(E.start(remembered, "warm", base));
assert.equal(E.getView(revisit, base).active.recallAvailable, true);
assert.match(E.getView(revisit, base).active.recallLabel, /一発逆転ラーメン/);
assert.deepEqual(E.recall(revisit, { ...base, enabled: false }), revisit);
assert.deepEqual(E.recall(revisit, { ...base, openSpots: [] }), revisit);
const recalled = freeze(E.recall(revisit, base));
assert.equal(recalled.active.experience.recalled, true);
assert.equal(recalled.active.experience.sourceOutingId, "outing-1");
assert.match(recalled.active.experience.detail, /今日は体験し直した記録ではなく/);
assert.deepEqual(recalled.arrivals, revisit.arrivals);
assert.deepEqual(recalled.history, revisit.history);
assert.equal(recalled.active.visited, false, "recall invented a physical visit");
assert.equal(E.getView(recalled, base).active.canRespond, true);
const reconsidered = E.respond(recalled, "different", "sns", base);
assert.equal(reconsidered.favorite, null);
assert.equal(reconsidered.conversations.warm.experience.sourceOutingId, "outing-1");
assert.match(reconsidered.notice.body, /前に体験したことを思い返して/);
const recallAgain = E.recall(E.start(reconsidered, "warm", base), base);
assert.equal(recallAgain.active.experience.sourceOutingId, "outing-1", "a chain of reflections lost its actual source");
const recallLiked = E.respond(recallAgain, "again", "sns", base);
assert.deepEqual(E.normalizeMemory(E.exportMemory(recallLiked)), E.exportMemory(recallLiked));
assert.equal(E.exportMemory(recallLiked).experience.recalled, true);
const freshAfterRecall = E.record(recallAgain, { type: "meal", mealId: "t_ramen" }, eaten("t_ramen"));
assert.equal(freshAfterRecall.active.experience.recalled, undefined, "a later actual meal was still labelled a memory");

// Free exploration comes before a recommendation too. Only a successful
// event records the one recent experience; legacy albums never invent one.
assert.equal(E.getView(E.start(initial, "quiet", eaten("g_pasta")), eaten("g_pasta")).active.recentAvailable, false);
assert.deepEqual(E.record(initial, { type: "meal", mealId: "g_pasta" }, base), initial);
const freelyEaten = freeze(E.record(initial, { type: "meal", mealId: "g_pasta" }, { ...eaten("g_pasta"), enabled: false }));
assert.equal(freelyEaten.active, null);
assert.equal(freelyEaten.recentExperience.id, "g_pasta");
assert.equal(freelyEaten.history.length, 0);
assert.equal(E.getView(freelyEaten, { ...base, enabled: false }).available, false);
const ownChoice = freeze(E.start(E.normalize(JSON.parse(JSON.stringify(freelyEaten))), "quiet", eaten("g_pasta")));
assert.equal(ownChoice.active.experience, null, "an independent meal was silently attributed to Aya's recommendation");
assert.equal(E.getView(ownChoice, base).active.recentAvailable, true);
assert.equal(E.getView(ownChoice, base).active.recallAvailable, false);
assert.deepEqual(E.useRecent(ownChoice, { ...base, enabled: false }), ownChoice);
assert.deepEqual(E.useRecent(ownChoice, { ...base, openSpots: [] }), ownChoice);
const sharedChoice = freeze(E.useRecent(ownChoice, eaten("g_pasta")));
assert.equal(sharedChoice.active.experience.beforeRecommendation, true);
assert.match(sharedChoice.active.experience.detail, /今日は体験し直した記録ではない/);
assert.equal(sharedChoice.active.visited, false);
assert.equal(sharedChoice.recentExperience.id, "g_pasta", "preparing a reply consumed the experience before the player spoke");
assert.deepEqual(sharedChoice.history, ownChoice.history);
assert.deepEqual(E.useRecent(sharedChoice, base), sharedChoice, "double-click duplicated the native experience");
const reconsiderOwnChoice = E.start(E.setAside(sharedChoice), "quiet", base);
assert.equal(E.getView(reconsiderOwnChoice, base).active.recentAvailable, true, "putting the conversation aside erased the unused experience");
const sharedReply = E.respond(sharedChoice, "again", "sns", base);
assert.equal(sharedReply.history.length, 1);
assert.equal(sharedReply.recentExperience, null);
assert.match(sharedReply.notice.body, /自分で選んだ体験/);
assert.deepEqual(E.respond(sharedReply, "again", "sns", base), sharedReply);
assert.deepEqual(E.normalizeMemory(E.exportMemory(sharedReply)), E.exportMemory(sharedReply));
const ownRevisit = E.start(sharedReply, "quiet", base);
assert.equal(E.getView(ownRevisit, base).active.recentAvailable, false, "the same event was offered again as a new independent choice");
assert.equal(E.getView(ownRevisit, base).active.recallAvailable, true, "the actual conversation could no longer be recalled");
const wrongRoute = E.start(freelyEaten, "warm", base);
assert.equal(E.getView(wrongRoute, base).active.recentAvailable, false);
assert.deepEqual(E.useRecent(wrongRoute, base), wrongRoute);
const newerMeal = E.record(freelyEaten, { type: "meal", mealId: "t_ramen" }, eaten("t_ramen"));
assert.equal(newerMeal.recentExperience.id, "t_ramen");
assert.equal(E.getView(E.start(newerMeal, "quiet", base), base).active.recentAvailable, false);
const ownClothesContext = { ...base, currentOutfitId: "newspaper" };
const ownClothes = E.record(freelyEaten, { type: "outfit", outfitId: "newspaper", previousOutfitId: "traveler" }, ownClothesContext);
assert.equal(ownClothes.recentExperience.kind, "outfit");
assert.equal(ownClothes.recentExperience.id, "newspaper");
assert.equal(E.useRecent(E.start(ownClothes, "style", ownClothesContext), ownClothesContext).active.experience.id, "newspaper");
assert.deepEqual(E.record(freelyEaten, { type: "outfit", outfitId: "traveler", previousOutfitId: "traveler" }, base), freelyEaten);
assert.deepEqual(E.record(freelyEaten, { type: "outfit", outfitId: "unowned", previousOutfitId: "traveler" }, { ...base, currentOutfitId: "unowned" }), freelyEaten);
assert.equal(E.record(E.start(initial, "quiet", base), { type: "meal", mealId: "g_pasta" }, eaten("g_pasta")).recentExperience, null, "a recommended meal was offered a second time as an independent experience");

// The real UI adapter must retain successful events even before chapter 3 or
// the first recommendation, and must not bootstrap from old completion flags.
const vm = require("node:vm");
let chapterAvailable = false, adapterSaves = 0;
const adapterPlayer = { coins: 4321, completedRaces: 10, outfit: "traveler", meals: { eaten: { g_pasta: true } } };
const adapter = { IslandLifeLoop: E, state: { player: adapterPlayer, ui: {} },
  chapterRead: () => chapterAvailable, MEALS: [{ id: "g_pasta", name: "塩パスタ", tier: 1 }], mealTierUnlocked: () => true,
  OUTFITS: base.ownedOutfits, outfitOwned: () => true, outfitImg: () => null, currentOutfitId: () => adapterPlayer.outfit,
  wearOutfit: id => { if (!base.ownedOutfits.some(o => o.id === id)) return { ok: false }; adapterPlayer.outfit = id; return { ok: true }; },
  saveGame: () => { adapterSaves++; } };
adapter.window = adapter;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/island_life_ui.js"), "utf8"), adapter);
assert.equal(adapterPlayer.islandLife, undefined, "loading a legacy eaten flag fabricated an experience");
adapter.recordIslandLifeEvent({ type: "meal", mealId: "g_pasta" });
assert.equal(adapterPlayer.islandLife.recentExperience.id, "g_pasta");
assert.equal(adapterPlayer.islandLife.active, null);
const mealSaves = adapterSaves;
adapter.wearOutfit("traveler");
adapter.wearOutfit("unowned");
assert.equal(adapterSaves, mealSaves, "failed or unchanged clothing replaced the recent experience");
adapter.wearOutfit("newspaper");
assert.equal(adapterPlayer.islandLife.recentExperience.id, "newspaper");
chapterAvailable = true;
adapter.recordIslandLifeEvent({ type: "meal", mealId: "g_pasta" });
assert.equal(adapterPlayer.islandLife.recentExperience.id, "g_pasta");
assert.equal(adapterPlayer.coins, 4321);
assert.equal(adapterPlayer.completedRaces, 10);
assert.equal(adapterPlayer.islandLife.history.length, 0);
// All open map spots call this adapter, including the rice terrace.
// With an outing in progress, an unrelated spot must not create its shop UI.
adapter.KONRON_SPOTS = { tanada: {}, mall: {} };
adapter.konronMapUnlocked = adapter.mallUnlocked = adapter._kmSpotOpen = () => true;
adapter.state.ui.screen = "konron_map";
adapter._kmSpot = "tanada";
adapterPlayer.islandLife = E.start(adapterPlayer.islandLife, "style", adapter.getIslandLifeContext());
assert.equal(adapterPlayer.islandLife.active.routeId, "style");
const wrongPlaceHost = { appendChild() { assert.fail("the terrace displayed the shopping mall conversation"); } };
adapter.appendIslandLifePlace(wrongPlaceHost, "tanada");
assert.equal(adapterPlayer.islandLife.active.visited, false);
assert.equal(base.meals.find(m => m.id === "t_ramen").eaten, false, "reflection wrote a native first-meal flag");
assert.ok(rounds.arrivals.length <= 4);
assert.equal(E.finishEcho(null), null);
assert.equal(E.normalizeMemory({ ...memory, opinion: "different" }), null);
assert.match(E.finishEcho(memory).body, /一発逆転ラーメン/);
assert.doesNotMatch(E.finishEcho(memory).body, /島は救われ|勝利|的中/);

const mutable = E.getView(liked, base);
mutable.favorite.experience.name = "changed";
mutable.routes[0].mealIds.push("h_tkg");
assert.equal(E.exportMemory(liked).experience.name, "一発逆転ラーメン");
assert.equal(E.record(E.start(initial, "warm", base), { type: "meal", mealId: "h_tkg" }, base).active.experience, null);
for (const r of E.getView(initial, base).routes) assert.ok(fs.existsSync(path.join(__dirname, "..", r.image)), "missing route image: " + r.image);
assert.ok(fs.existsSync(path.join(__dirname, "..", E.exportMemory(quiet).image)));
assert.equal(base.coins, 0);
assert.deepEqual(base.race, { order: ["rubel", "poro"], odds: [1.2, 3.5] });
assert.equal(initial.active, null);
assert.equal(E.normalize(JSON.parse(JSON.stringify(rounds))).favorite.id, "outing-1");
console.log(JSON.stringify({ ok: true, routes: 3, responseModes: 3, channels: 2, noCurrencyOrRaceWrites: true, guardedActualActivities: true, firstVisitAndReturn: true, historyLimit: 6, independentFavorite: true, persistentPlaceConversations: 3, legacyConversationMigration: true, explicitRecallWithoutRepurchase: true, spontaneousChoiceBeforeRecommendation: true, successfulEventsBeforeChapter3: true }));
