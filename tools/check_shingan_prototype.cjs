/* Run: node tools/check_shingan_prototype.cjs. No browser or game save required. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const enginePath = path.join(__dirname, "../js/shingan_prototype_engine.js");
const E = require(enginePath);
const ReadingJournal = require("../js/reading_journal.js");
const scenarioIds = ["coast", "gorge", "sky"];
const actions = ["harbor", "market", "scout"];
const nearly = (a, b, msg) => assert.ok(Math.abs(a - b) <= 0.025, `${msg}: ${a} / ${b}`);
const freeze = value => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const totals = [];
let checked = 0;

// Preparation is an immutable, idempotent purchase in a separate demo wallet.
const arrival = freeze(E.createState());
assert.equal(arrival.coins, 600);
const harbor = E.prepare(arrival, "harbor");
assert.equal(harbor.coins, 480);
assert.equal(arrival.prepared.harbor, false);
assert.deepEqual(E.prepare(harbor, "harbor"), harbor);
assert.equal(E.createState("prepared").coins, 330);
assert.throws(() => E.prepare({ ...arrival, coins: 0 }, "market"), /Insufficient/);
assert.throws(() => E.prepare(arrival, "change-race"), /Unknown/);
assert.throws(() => E.createState("main-save"), /Unknown/);
assert.throws(() => E.createState("arrival", "missing"), /Unknown/);
assert.equal(E.preview(arrival, []).valid, true);
for (const plan of [null, {}, ["missing"], ["p_raiou", "p_raiou"], ["p_fugaku"], ["a", "b", "c", "d"]]) {
  assert.equal(E.preview(arrival, plan).valid, false);
  assert.equal(E.resolve(arrival, plan).valid, false);
}
assert.equal(E.resolve(arrival, []).valid, false);

// Editorial slots represent different audiences. Empty slots must never shift
// a remaining article to a different reader group or change its buying behavior.
const slotState = freeze(E.createState("prepared", "coast"));
const fullSlots = E.preview(slotState, ["p_raiou", "p_fugaku", "w_fugaku_glaze"]);
const emptyFirst = E.preview(slotState, [null, "p_fugaku", "w_fugaku_glaze"]);
assert.equal(emptyFirst.valid, true);
assert.deepEqual(emptyFirst.features.map(f => f.slot), [1, 2]);
for (const remaining of emptyFirst.features) {
  const original = fullSlots.features.find(f => f.id === remaining.id);
  for (const field of ["slot", "audienceLabel", "stake", "directedStake", "readers", "reaction"]) {
    assert.equal(remaining[field], original[field], "removing another slot changed an article's audience: " + field);
  }
}
const fanOnly = E.preview(slotState, [null, null, "p_poro"]);
assert.equal(fanOnly.valid, true);
assert.equal(fanOnly.features.length, 1);
assert.equal(fanOnly.features[0].slot, 2);
assert.equal(fanOnly.features[0].audienceLabel, E.getView(slotState).editorSlots[2].title);
assert.equal(fanOnly.features[0].directedStake, Math.round(fanOnly.features[0].stake * 0.9));
assert.match(fanOnly.features[0].reaction, /応援/);
for (const plan of [[null, "p_fugaku", null], [null, null, "p_raiou"], [null, null, null], Array(3)]) {
  assert.equal(E.resolve(slotState, plan).valid, false, "an incomplete editorial must not publish");
}
assert.equal(E.preview(arrival, [null, "p_fugaku", null]).valid, false, "a hole must not bypass a scout lock");
assert.equal(E.preview(slotState, ["p_raiou", null, "p_raiou"]).valid, false, "a hole must not bypass duplicate validation");
assert.equal(E.preview(slotState, [null, "missing", null]).valid, false);
assert.equal(E.preview(slotState, [null, undefined, null]).valid, false);
assert.equal(E.preview(slotState, [null, null, null]).valid, true);

// Results and public metadata are defensive copies; callers cannot rewrite a race.
const altered = E.getRace("coast");
altered.order.reverse();
altered.rows[0].time = -1;
const alteredView = E.getView(arrival);
alteredView.dragons[0].name = "changed";
alteredView.preparations[0].cost = 0;
assert.equal(E.getRace("coast").order[0], "raiou");
assert.equal(E.getRace("coast").rows[0].time, 120);
assert.equal(E.getView(arrival).preparations[0].cost, 120);

// Optional island memories: meaningful discovery, repeatable reading, no races
// or wallets from the main game, and no collection of stacking power bonuses.
function collectJourney(scenarioId) {
  let state = E.createState("prepared", scenarioId);
  for (const [place, choice] of [["furununo", "turn_hem"], ["atelier", "keep_traveler"], ["table", "share_table"]]) {
    state = E.visitJourney(state, place);
    state = E.chooseJourney(state, choice);
    if (place === "furununo") state = E.chooseJourney(state, "read_paths");
    state = E.chooseJourney(state, "leave");
  }
  return state;
}
const journeyStart = freeze(E.createState("prepared"));
assert.throws(() => E.chooseJourney(journeyStart, "turn_hem"));
assert.throws(() => E.visitJourney(journeyStart, "missing"));
assert.throws(() => E.selectCoverMemory(journeyStart, "cloth"));
assert.throws(() => E.wearOutfit(journeyStart, "newspaper"));
assert.ok(E.getJourneyView(journeyStart).memories.every(m => !m.owned && !m.quote));
const looking = E.visitJourney(journeyStart, "furununo");
const wrongLook = E.chooseJourney(freeze(looking), "look_gold");
assert.equal(wrongLook.coins, journeyStart.coins);
assert.equal(E.getJourneyView(wrongLook).memories.filter(m => m.owned).length, 0);
assert.equal(E.getJourneyView(wrongLook).notice.kind, "hint");
assert.equal(E.getJourneyView(wrongLook).activeScene.placeId, "furununo");
const turnedCloth = E.chooseJourney(wrongLook, "turn_hem");
assert.equal(turnedCloth.journey.stage, "compare");
assert.equal(turnedCloth.journey.memories.length, 0, "looking alone must not skip the player's interpretation");
const overreadCloth = E.chooseJourney(turnedCloth, "read_champion");
assert.equal(overreadCloth.journey.memories.length, 0, "a physical trace cannot prove a fastest racer");
assert.equal(overreadCloth.coins, turnedCloth.coins);
assert.match(E.getJourneyView(overreadCloth).notice.body, /時計/);
const foundCloth = E.chooseJourney(overreadCloth, "read_paths");
assert.equal(foundCloth.journey.coverMemory, null, "discovery must not silently change the invited readers");
assert.equal(E.getJourneyView(foundCloth).memories.find(m => m.id === "cloth").owned, true);
const broughtCloth = E.chooseJourney(foundCloth, "use_memory");
assert.equal(E.getJourneyView(broughtCloth).coverMemory, "cloth");
assert.equal(E.getJourneyView(broughtCloth).activeScene, null);
assert.deepEqual(journeyStart.journey.memories, [], "an expedition mutated its input");
let table = E.visitJourney(journeyStart, "table");
table = E.chooseJourney(table, "taste_mirin");
assert.equal(table.coins, journeyStart.coins);
assert.equal(table.journey.memories.length, 0);
const guessing = E.chooseJourney(table, "taste_mayo");
const listening = E.chooseJourney(table, "share_table");
assert.deepEqual(guessing.journey.memories, listening.journey.memories, "listening at the table is a valid alternative to answering the food quiz");
assert.deepEqual(guessing.journey.theories, listening.journey.theories);
let tailoring = E.visitJourney(journeyStart, "atelier");
tailoring = E.chooseJourney(tailoring, "tailor_newspaper");
assert.equal(tailoring.coins, 285);
assert.equal(E.getJourneyView(tailoring).currentOutfit.id, "newspaper");
tailoring = E.chooseJourney(E.visitJourney(tailoring, "atelier"), "tailor_newspaper");
assert.equal(tailoring.coins, 285, "a repaired outfit must never be charged twice");
const underfunded = E.visitJourney({ ...journeyStart, coins: 0 }, "atelier");
assert.throws(() => E.chooseJourney(underfunded, "tailor_newspaper"));
assert.equal(E.chooseJourney(underfunded, "keep_traveler").journey.memories.includes("attire"), true, "self-expression and the memory cannot require a purchase");
const journeyPlan = ["p_fugaku", "w_fugaku_glaze", "p_raiou"];
assert.deepEqual(E.resolve(tailoring, journeyPlan).settlement, E.resolve(E.wearOutfit(tailoring, "traveler"), journeyPlan).settlement, "wearing a different outfit changed betting or race economics");
const allMemories = freeze(collectJourney("coast"));
assert.equal(allMemories.journey.memories.length, 3);
assert.equal(allMemories.journey.theories.length, 3);
assert.equal(allMemories.coins, 330);
const selectedCloth = E.selectCoverMemory(allMemories, "cloth");
const coverRoundTrip = E.selectCoverMemory(E.selectCoverMemory(selectedCloth, "supper"), "cloth");
assert.deepEqual(E.preview(selectedCloth, journeyPlan), E.preview(coverRoundTrip, journeyPlan), "cover memories accumulated instead of replacing each other");
assert.deepEqual(E.resolve(E.selectCoverMemory(coverRoundTrip, null), journeyPlan).settlement, E.resolve(journeyStart, journeyPlan).settlement, "collecting all memories must not grant a hidden passive bonus");
for (const entry of [...E.getJourneyView(allMemories).places, ...E.getJourneyView(allMemories).memories, ...E.getJourneyView(allMemories).outfits]) {
  assert.ok(!entry.image.includes("images/cg/"), "locked reward CG cannot be used by the independent prototype");
  assert.ok(fs.existsSync(path.join(__dirname, "..", entry.image)), "missing journey art: " + entry.image);
}
assert.equal(E.preview(journeyStart, journeyPlan, [{ memoryId: "cloth", theoryId: "terrain" }]).valid, false);
assert.equal(E.preview(allMemories, journeyPlan, [{ memoryId: "missing", theoryId: "terrain" }]).valid, false);
assert.equal(E.preview(allMemories, journeyPlan, [{ memoryId: "cloth", theoryId: "missing" }]).valid, false);
assert.equal(E.preview(allMemories, journeyPlan, null).valid, false);
const reflections = [];
for (const memoryId of ["cloth", "attire", "supper"]) {
  for (const theoryId of ["terrain", "market", "sharedRisk"]) {
    const annotations = freeze([{ memoryId, theoryId }, null, null]);
    const annotated = E.resolve(allMemories, journeyPlan, annotations);
    const unannotated = E.resolve(allMemories, journeyPlan);
    assert.deepEqual(annotated.race, unannotated.race);
    assert.deepEqual(annotated.settlement, unannotated.settlement, "a theory became an automatic economic buff");
    assert.equal(annotated.operatingProfit, unannotated.operatingProfit);
    assert.equal(annotated.success, unannotated.success);
    assert.equal(annotated.chronicle.entries[0].memoryId, memoryId);
    assert.equal(annotated.chronicle.entries[0].theoryId, theoryId);
    assert.match(annotated.chronicle.entries[0].observation, /フガク.*登り/);
    assert.match(annotated.chronicle.entries[0].resultLine, /フガク2着/);
    reflections.push(annotated.chronicle.entries[0].reply + "\n" + annotated.chronicle.entries[0].review);
  }
}
assert.equal(new Set(reflections).size, 9, "different people and theories received the same canned reply");
const missedReflection = E.resolve(collectJourney("gorge"), journeyPlan, [{ memoryId: "cloth", theoryId: "terrain" }]).chronicle.entries[0];
assert.match(missedReflection.reply, /フガク5着/);
assert.match(missedReflection.reply, /坂道は消えない/);
assert.match(missedReflection.review, /届かなかった/);

// A real midgame decision is a historical observation, including non-final
// dragons. Carrying it into another dragon's article must never act as a buff.
const pastReading = freeze({ id: "race-12", completedRace: 12, raceId: "race_grandclock_1", raceName: "新人競竜杯", region: "グランドクロック地域", reason: "data", betType: "place", hit: true,
  selections: [{ dragonId: "rubel", name: "ルベル", rank: 3 }],
  trace: { dragonId: "rubel", earlyRank: 1, midRank: 2, section: "終盤の直線", stat: "速さ", pace: "標準", popularity: 1 } });
const withReading = freeze(Object.assign({}, allMemories, { readingNotes: [pastReading] }));
const readingView = E.getReadingNotes(withReading)[0];
assert.equal(readingView.reasonLabel, "能力データ");
assert.match(readingView.observation, /序盤1番手→中盤2番手→3着/);
assert.match(readingView.reviewText, /本編の複勝は3着以内/);
assert.equal(E.getReadingNotes(journeyStart).length, 0);
assert.equal(E.preview(journeyStart, journeyPlan, [{ readingNoteId: "race-12" }]).valid, false);
assert.equal(E.preview(withReading, journeyPlan, [{ readingNoteId: "unknown" }]).valid, false);
const readingEvidence = E.preview(withReading, journeyPlan, [{ readingNoteId: "race-12" }]).features[0].evidence;
assert.equal(readingEvidence.readingNote.sameDragon, false);
assert.match(readingEvidence.connection, /別の竜・別のレース/);
assert.match(readingEvidence.connection, /本編の複勝は3着以内、今回の記事は2着以内/);
assert.match(readingEvidence.connection, /保証しない/);
assert.match(readingEvidence.connection, /前の記録は「終盤の直線」・問われた能力「速さ」/);
assert.ok(readingEvidence.connection.includes(E.getView(withReading).scenario.condition));
assert.match(readingEvidence.connection, /フガク：登りに強く、順位に動じない/);
const readingReview = E.resolve(withReading, journeyPlan, [{ readingNoteId: "race-12" }]).chronicle.entries[0];
assert.match(readingReview.review, /ルベル3着/);
assert.match(readingReview.review, /フガク2着/);
assert.match(readingReview.reply, /新人競竜杯/);
const sameDragonState = Object.assign({}, journeyStart, { readingNotes: [{ ...pastReading, selections: [{ dragonId: "fugaku", name: "フガク", rank: 3 }], trace: null }] });
assert.equal(E.preview(sameDragonState, journeyPlan, [{ readingNoteId: "race-12" }]).features[0].evidence.readingNote.sameDragon, true);
assert.match(E.getReadingNotes(sameDragonState)[0].observation, /途中の順位は記録していない/);
assert.doesNotMatch(E.preview(sameDragonState, journeyPlan, [{ readingNoteId: "race-12" }]).features[0].evidence.connection, /前の記録は|問われた能力/);
const defensiveReading = E.getReadingNotes(withReading);
defensiveReading[0].selections[0].rank = 8;
assert.equal(E.getReadingNotes(withReading)[0].selections[0].rank, 3);
let readingCases = 0;
for (const id of scenarioIds) for (const reason of ["kan", "data", "tell", "value"]) {
  const bare = E.createState("prepared", id);
  const s = freeze(Object.assign({}, bare, { readingNotes: [{ ...pastReading, reason }] }));
  const before = JSON.stringify(s), baseResult = E.resolve(bare, journeyPlan);
  const result = E.resolve(s, journeyPlan, [{ readingNoteId: "race-12" }]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.race, baseResult.race);
  assert.deepEqual(result.settlement, baseResult.settlement);
  assert.equal(result.success, baseResult.success);
  assert.equal(result.operatingProfit, baseResult.operatingProfit);
  assert.equal(JSON.stringify(s), before);
  readingCases++;
}
const mixedEvidence = E.preview(withReading, journeyPlan, [{ readingNoteId: "race-12", memoryId: "cloth", theoryId: "terrain" }]).features[0].evidence;
assert.equal(mixedEvidence.readingNote.id, "race-12");
assert.equal(mixedEvidence.memoryId, "cloth");
assert.equal(mixedEvidence.theoryId, "terrain");

// Changing only hidden finish orders must not affect any pre-publication view,
// forecasts, audience, odds ranges or profit ranges. This detects result leaks.
const source = fs.readFileSync(enginePath, "utf8");
const alternateSource = source.replace(/order: \[([^\]]+)\]/g, (_, body) => {
  const ids = JSON.parse("[" + body + "]");
  return "order: " + JSON.stringify([ids[0], ...ids.slice(1).reverse()]);
});
const sandbox = { module: { exports: {} }, ReadingJournal };
vm.runInNewContext(alternateSource, sandbox, { filename: "hidden-order-test.js" });
const alternate = sandbox.module.exports;
assert.equal(JSON.stringify(E.preview(withReading, journeyPlan, [{ readingNoteId: "race-12" }])), JSON.stringify(alternate.preview(withReading, journeyPlan, [{ readingNoteId: "race-12" }])), "hidden finish leaked into a carried midgame record");
for (const id of scenarioIds) {
  const state = E.createState("prepared", id);
  assert.notEqual(JSON.stringify(E.getRace(id).order), JSON.stringify(alternate.getRace(id).order));
  assert.equal(JSON.stringify(E.getView(state)), JSON.stringify(alternate.getView(state)));
  for (const plan of E.enumeratePlans(state)) {
    assert.equal(JSON.stringify(E.preview(state, plan)), JSON.stringify(alternate.preview(state, plan)), "hidden order leaked into preview");
  }
  const memories = collectJourney(id);
  for (const memoryId of ["cloth", "attire", "supper"]) {
    const selected = E.selectCoverMemory(memories, memoryId);
    assert.equal(JSON.stringify(E.getView(selected)), JSON.stringify(alternate.getView(selected)));
    for (const theoryId of ["terrain", "market", "sharedRisk"]) {
      const annotation = [{ memoryId, theoryId }];
      assert.equal(JSON.stringify(E.preview(selected, journeyPlan, annotation)), JSON.stringify(alternate.preview(selected, journeyPlan, annotation)), "hidden finish leaked into a theory or memory connection");
    }
  }
}

// Explicit tote invariants: independent pools, refunds and conserved accounting.
assert.deepEqual(E.settlePool({ raiou: 1000 }, ["raiou"]), {
  total: 1000, payout: 1000, houseNet: 0,
  distributable: 800, refundSupport: 200,
  payouts: { raiou: 1000 }, odds: { raiou: 1 }
});
const concentrated = E.settlePool({ a: 900, b: 50, c: 50 }, ["a", "b"]);
assert.ok(concentrated.houseNet < 0, "floor exposure should be visible, not silently subsidized");
nearly(concentrated.total, concentrated.payout + concentrated.houseNet, "refund accounting");

const successfulSets = [];
for (const id of scenarioIds) {
  const expectedRace = JSON.stringify(E.getRace(id));
  const preparedSuccess = [];
  let correctButInsolvent = 0;
  let profitableButInaccurate = 0;
  let maskSuccess = [];
  let maskAllCorrectSuccess = [];
  for (let mask = 0; mask < 8; mask++) {
    let state = E.createState("arrival", id);
    actions.forEach((action, index) => { if (mask & (1 << index)) state = E.prepare(state, action); });
    const before = JSON.stringify(state);
    freeze(state);
    const legalPlans = E.enumeratePlans(state);
    let successes = 0;
    let allCorrectSuccesses = 0;
    for (const plan of legalPlans) {
      freeze(plan);
      const result = E.resolve(state, plan);
      assert.equal(result.valid, true);
      assert.equal(JSON.stringify(result.race), expectedRace, "a player action changed the fair race");
      assert.equal(result.oracleCorrect, true);
      assert.equal(result.settlement.win.total, 1000);
      assert.equal(result.settlement.win.payout, 1000);
      assert.equal(result.settlement.win.houseNet, 0, "side pools must not rescue the win pool");
      nearly(Object.values(result.pools).reduce((n, p) => n + p.total, 0), 5340 + result.audience.newStake, "pool inflow");
      nearly(result.audience.newStake, result.features.reduce((n, f) => n + f.stake, 0), "feature inflow");
      for (const type of ["win", "place", "wide"]) {
        const pool = result.settlement[type];
        nearly(pool.total, pool.payout + pool.houseNet, "pool conservation");
        nearly(pool.payout, pool.distributable + pool.refundSupport, "minimum-refund support accounting");
        assert.ok(pool.houseNet >= result.pools[type].estimatedNet.min - 0.02);
        assert.ok(pool.houseNet <= result.pools[type].estimatedNet.max + 0.02);
      }
      nearly(result.operatingProfit, Object.values(result.settlement).reduce((n, p) => n + p.houseNet, 0) + result.commerceIncome - result.operatingCost, "operating balance");
      assert.ok(result.operatingProfit >= result.estimatedProfit.min - 0.02);
      assert.ok(result.operatingProfit <= result.estimatedProfit.max + 0.02);
      for (const prediction of result.predictions) {
        const expectedHit = prediction.type === "place"
          ? result.race.order.slice(0, 2).includes(prediction.ids[0])
          : prediction.ids.every(dragon => result.race.order.slice(0, 3).includes(dragon));
        assert.equal(prediction.hit, expectedHit);
        assert.equal(prediction.payout > 0, expectedHit);
        const feature = result.features.find(f => f.id === prediction.id);
        assert.equal(prediction.stake, feature.directedStake);
        const odds = result.settlement[prediction.type].odds[feature.key];
        nearly(prediction.payout, prediction.stake * odds, "published ticket share");
      }
      assert.equal(result.success, result.operatingProfit >= 0 && result.hits >= 2);
      if (result.success) successes++;
      if (result.success && result.hits === 3) allCorrectSuccesses++;
      if (mask === 7) {
        if (result.success) preparedSuccess.push({ plan, result });
        if (result.hits >= 2 && result.operatingProfit < 0) correctButInsolvent++;
        if (result.hits < 2 && result.operatingProfit >= 0) profitableButInaccurate++;
      }
      checked++;
    }
    assert.equal(JSON.stringify(state), before, "trial charged or changed the demo state");
    maskSuccess.push(successes);
    maskAllCorrectSuccess.push(allCorrectSuccesses);
    assert.ok(!successes || allCorrectSuccesses > 0, "a viable preparation state requires an incorrect prediction to win: " + id + "/" + mask);
  }
  const sets = new Set(preparedSuccess.map(x => x.plan.slice().sort().join(",")));
  assert.ok(sets.size >= 2, "need multiple distinct successful editorials");
  assert.ok(correctButInsolvent > 0, "picking correct answers alone must not erase the economic decision");
  assert.ok(profitableButInaccurate > 0, "earning from losses alone must not satisfy the chronicle objective");
  assert.ok(preparedSuccess.some(x => !x.plan.includes("p_raiou")), "the oracle card must be optional");
  assert.ok(preparedSuccess.some(x => x.result.hits === 3), "an all-correct honest issue must remain viable");
  assert.deepEqual(preparedSuccess[0].plan.filter(card => preparedSuccess.every(x => x.plan.includes(card))), [], "no single card should be mandatory");
  const fullState = E.createState("prepared", id);
  const firstOdds = E.getView(fullState).offers.filter(o => !o.ids.includes("raiou")).map(o => E.preview(fullState, [o.id]).features[0].odds.min);
  assert.ok(firstOdds.every(odds => odds >= 1.5), "uncertain first picks must offer a meaningful potential return");
  assert.equal(E.preview(fullState, ["p_raiou"]).features[0].odds.min, 1, "disclosed certainty must not be given a fabricated bonus");
  const valueFirst = E.preview(fullState, ["p_fugaku", "p_raiou", "w_fugaku_glaze"]);
  const valueSecond = E.preview(fullState, ["p_raiou", "p_fugaku", "w_fugaku_glaze"]);
  const f1 = valueFirst.features.find(f => f.id === "p_fugaku"), f2 = valueSecond.features.find(f => f.id === "p_fugaku");
  assert.notEqual(f1.audienceLabel, f2.audienceLabel);
  assert.notEqual(f1.directedStake / f1.stake, f2.directedStake / f2.stake, "editor slots must change how readers buy, not just their number");
  successfulSets.push(sets);
  assert.ok(maskAllCorrectSuccess[5] > 0, "without the optional market, success must not require a deliberately incorrect prediction");
  const profits = preparedSuccess.map(x => x.result.operatingProfit).sort((a, b) => a - b);
  totals.push({ scenario: id, successfulOrders: preparedSuccess.length, successfulSets: sets.size, correctButInsolvent, maskSuccess, maskAllCorrectSuccess, successProfit: { min: profits[0], median: profits[Math.floor((profits.length - 1) / 2)], max: profits[profits.length - 1] } });
}
assert.equal([...successfulSets[0]].filter(plan => successfulSets.every(set => set.has(plan))).length, 0, "one fixed three-card set succeeds in every scenario");
assert.ok(totals.some(x => x.maskSuccess[5] > 0), "market preparation should help, not be a universal entry gate");
const linkedPlan = ["p_yomi", "p_raiou", "w_raiou_yomi"];
const linked = E.resolve(E.createState("prepared", "gorge"), linkedPlan);
assert.equal(linked.hits, 3);
assert.equal(linked.success, false, "one correct idea repeated three times must not unconditionally solve every editorial audience");
assert.ok(linked.operatingProfit < 0);
// A natural correct reading can be repaired by changing its delivery, without
// forcing the player to discard a correct prediction for a losing popular one.
const repairedLinked = E.resolve(E.createState("prepared", "gorge"), ["p_yomi", "w_raiou_yomi", "p_raiou"]);
assert.equal(repairedLinked.hits, 3);
assert.equal(repairedLinked.success, true);

let journeyFairCases = 0;
const journeySummary = [];
const coverPerformance = { cloth: [], attire: [], supper: [] };
for (const scenarioId of scenarioIds) {
  const collected = freeze(collectJourney(scenarioId));
  const fixedRace = JSON.stringify(E.getRace(scenarioId));
  for (const memoryId of ["cloth", "attire", "supper"]) {
    const selected = E.selectCoverMemory(collected, memoryId);
    const interest = E.getView(selected).scenario.fanInterest.map(x => x.interest).sort();
    assert.deepEqual(interest, [1.15, 1.35, 1.6], "a cover changed the total strength instead of the invited readers");
    const preparationSummary = [];
    for (let mask = 0; mask < 8; mask++) {
      let state = E.createState("arrival", scenarioId);
      state.journey = JSON.parse(JSON.stringify(selected.journey));
      actions.forEach((action, index) => { if (mask & (1 << index)) state = E.prepare(state, action); });
      freeze(state);
      let successes = 0, allCorrectSuccesses = 0;
      for (const plan of E.enumeratePlans(state)) {
        const r = E.resolve(state, plan);
        assert.equal(JSON.stringify(r.race), fixedRace, "an island choice changed the fair competition");
        assert.equal(r.settlement.win.total, 1000);
        assert.equal(r.settlement.win.payout, 1000);
        assert.equal(r.oracleCorrect, true);
        assert.ok(r.operatingProfit >= r.estimatedProfit.min - 0.02 && r.operatingProfit <= r.estimatedProfit.max + 0.02);
        if (r.success) successes++;
        if (r.success && r.hits === 3) allCorrectSuccesses++;
        if (mask === 7) coverPerformance[memoryId].push(r.operatingProfit);
        journeyFairCases++;
      }
      assert.ok(!successes || allCorrectSuccesses > 0, "a viable cover/preparation state requires an incorrect prediction: " + scenarioId + "/" + memoryId + "/" + mask);
      if (mask === 5) assert.ok(allCorrectSuccesses > 0, "a cover without the optional market forces an incorrect prediction to succeed");
      if (mask === 7) assert.ok(successes >= 2, "a remembered route leaves no viable editorial choices");
      preparationSummary.push({ mask, successes, allCorrectSuccesses });
    }
    journeySummary.push({ scenarioId, memoryId, successes: preparationSummary[7].successes, allCorrectWithoutMarket: preparationSummary[5].allCorrectSuccesses, preparationSummary });
  }
}
for (const a of Object.keys(coverPerformance)) for (const b of Object.keys(coverPerformance)) {
  if (a === b) continue;
  assert.ok(coverPerformance[a].some((profit, i) => profit > coverPerformance[b][i] + 0.01), "one cover is universally dominated: " + a + " by " + b);
}
console.log(JSON.stringify({ ok: true, fairRaceCases: checked, hiddenOrderPreviewCases: 3 * 2184, journeyFairCases, journeyPublicPreviewCases: 27, readingCases, readingPublicPreviewCases: 1, scenarios: totals, journey: journeySummary }, null, 2));
