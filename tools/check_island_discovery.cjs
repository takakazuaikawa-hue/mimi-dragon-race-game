"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../js/island_discovery.js");
const freeze = x => { if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const spots = ["market", "tanada", "uroko", "mistra", "ryusha", "kazami_yagura", "tsubasa_dana", "ryu_mizunomi", "furununo", "shiranami", "ohzuba", "rondo", "tsubo_roji", "kirimina", "mall"];
const base = freeze({ enabled: true, openSpots: spots, currentSpotId: "market", dragonLevel: 0, coins: 0, race: { time: [1, 2, 3], odds: [2, 3, 4] } });
const at = (id, extra) => ({ ...base, currentSpotId: id, ...extra });
const empty = freeze(E.normalize(null));
assert.equal(E.getView(empty, base).cases.length, 0, "all mysteries were listed before any observation");
assert.equal(E.getView(empty, { ...base, enabled: false }).observations.length, 0);
assert.equal(E.getView(empty, at("rondo")).observations.length, 0, "sacred grounds became an investigation interior");
assert.deepEqual(E.observe(empty, "water_jars", at("tanada")), empty, "remote observation was accepted");
assert.deepEqual(E.observe(empty, "water_jars", at("market", { openSpots: [] })), empty);
assert.deepEqual(E.observe(empty, "water_jars", at("market", { enabled: false })), empty);
assert.deepEqual(E.observe(empty, "made_up", base), empty);
const one = freeze(E.observe(empty, "water_jars", base));
assert.equal(E.getView(one, base).cases.length, 1);
assert.equal(E.getView(one, base).cases[0].canPropose, false);
assert.equal(E.getView(one, base).cases[0].finding, null);
assert.doesNotMatch(JSON.stringify(E.getView(one, base)), /waterworks\.webp|共同配水小屋|"correct"|"built"/);
assert.deepEqual(E.propose(one, "water", "upstream", ["water_jars", "water_fork"], base), one);
assert.deepEqual(E.observe(one, "water_jars", base), one, "rereading farmed observation progression");

// Collect only by visiting each actual source. No wallet, time, or RNG is used.
let all = empty;
for (const spot of spots) for (const o of E.getView(all, at(spot)).observations) all = E.observe(all, o.id, at(spot));
all = freeze(all);
assert.equal(all.evidence.length, 13);
assert.equal(E.getView(all, base).cases.length, 7);
// Display order is reproducible, with both later hypothesis positions and both
// method positions used. Data IDs and the solved findings remain unchanged.
const positions = [], methodPositions = [];
const answerIds = { water: ["upstream", "trace"], nest: ["ledge", "wait"], pasture: ["bank", "paths"], history: ["shore", "compare"], trade: ["roundtrip", "labels"], dragon_trace:['wind_flags','distance'],legend_ring:['workshop','repair'] };
for (const c of E.getView(all, base).cases) {
  const [hypothesisId, methodId] = answerIds[c.id];
  positions.push(c.hypotheses.findIndex(h => h.id === hypothesisId));
  const p = E.propose(all, c.id, hypothesisId, c.evidence.map(e => e.id), base);
  const v = E.getView(p, base).cases.find(v => v.id === c.id);
  methodPositions.push(v.inspection.methods.findIndex(m => m.id === methodId));
  assert.deepEqual(E.getView(p, base), E.getView(JSON.parse(JSON.stringify(p)), base), "reload shuffled the fieldwork choices");
}
assert.deepEqual(positions, [0, 2, 1, 2, 1, 2, 1]);
assert.deepEqual(methodPositions, [0, 1, 0, 1, 0, 2, 0]);
assert.ok(positions.slice(1).every(i => i > 0), "a later chain was still solved by first-button choices");
const water = E.getView(all, base).cases.find(c => c.id === "water");
assert.deepEqual(E.propose(all, "water", "upstream", ["water_jars", "water_jars"], base), all);
assert.deepEqual(E.propose(all, "water", "upstream", ["water_jars", "cloth_marks"], base), all);
assert.deepEqual(E.propose(all, "water", "upstream", water.evidence.map(e => e.id), at("market", { openSpots: ["market"] })), all);
assert.deepEqual(E.plan(all, "water", "care", base), all, "planning granted an undiscovered place");

let complete = all, foundCount = 0, refutedCount = 0, incompleteCount = 0;
for (const c of E.getView(all, base).cases) {
  const ids = c.evidence.map(e => e.id);
  let solution = null;
  for (const h of c.hypotheses) {
    const proposed = freeze(E.propose(all, c.id, h.id, ids, base));
    const panel = E.getView(proposed, base).cases.find(v => v.id === c.id);
    assert.equal(panel.inspection.available, h.spotId === base.currentSpotId);
    assert.deepEqual(E.inspect(proposed, c.id, panel.inspection.methods[0].id, at("not_a_place")), proposed);
    assert.deepEqual(E.inspect(proposed, c.id, panel.inspection.methods[0].id, at(h.spotId, { openSpots: [] })), proposed);
    assert.deepEqual(E.inspect(proposed, c.id, "hack", at(h.spotId)), proposed);
    for (const m of panel.inspection.methods) {
      let tested = E.inspect(proposed, c.id, m.id, at(h.spotId));
      if(c.id==='legend_ring'&&E.getView(tested,at(h.spotId)).cases.find(v=>v.id===c.id).practice){assert.equal(E.exportDiscoveries(tested).length,0,'matching alone granted the keepsake');tested=E.tryTool(tested,c.id,'thread',at(h.spotId));assert.equal(E.exportDiscoveries(tested).length,0,'using the tool alone skipped the handover');tested=E.acceptKeepsake(tested,c.id,at(h.spotId));}
      const result = E.getView(tested, at(h.spotId)).cases.find(v => v.id === c.id);
      if (result.finding) {
        foundCount++;
        assert.equal(solution, null, "unexpected multiple exact observation methods");
        solution = { h, m };
        assert.ok(fs.existsSync(path.join(__dirname, "..", result.finding.image)), result.finding.image);
        assert.equal(result.plans.length, 2);
        assert.ok(result.finding.body.length > 40 && result.finding.reply.length > 20);
      } else {
        assert.equal(result.refutations.length, 1);
        const r = result.refutations[0];
        assert.equal(r.spotId, h.spotId);
        assert.ok(r.body.length > 35, "failure did not explain local evidence");
        if (r.outcome === "refuted") refutedCount++; else { assert.equal(r.outcome, "inconclusive"); incompleteCount++; }
        assert.deepEqual(E.inspect(tested, c.id, m.id, at(h.spotId)), tested, "repeat inspection farmed state");
        assert.deepEqual(E.getView(E.normalize(JSON.parse(JSON.stringify(tested))), at(h.spotId)).cases.find(v => v.id === c.id).refutations, result.refutations);
      }
    }
  }
  assert.ok(solution, "no reachable discovery in " + c.id);
  complete = E.propose(complete, c.id, solution.h.id, ids, base);
  complete = E.inspect(complete, c.id, solution.m.id, at(solution.h.spotId));
  if(c.id==='legend_ring'){complete=E.tryTool(complete,c.id,'thread',at(solution.h.spotId));complete=E.acceptKeepsake(complete,c.id,at(solution.h.spotId));}
  const solved = E.getView(complete, base).cases.find(v => v.id === c.id);
  for (const p of solved.plans) {
    const planned = E.plan(complete, c.id, p.id, base), pv = E.getView(planned, base).cases.find(v => v.id === c.id);
    assert.equal(pv.plan.status, "proposal");
    assert.ok(["infra", "commerce", "public", "industry", "dragon"].includes(pv.plan.investment));
    assert.match(E.getView(planned, base).notice.body, /まだ実行していません/);
    assert.deepEqual(planned.findings, complete.findings);
    complete = planned;
  }
}
assert.equal(foundCount, 7);
assert.equal(refutedCount, 28);
assert.equal(incompleteCount, 8);
assert.equal(E.exportDiscoveries(complete).length, 7);

// The later trade puzzle distinguishes an absolute shortage from goods stuck
// between arrival and receipt; importing more is a plausible but incomplete
// explanation. Preserve this distinction without adding a third clue or cash.
const tradeClues = E.getView(all, base).cases.find(c => c.id === "trade");
assert.equal(tradeClues.evidence.length, 2);
assert.match(tradeClues.evidence.find(e => e.id === "return_cargo").body, /未受領/);
assert.doesNotMatch(tradeClues.evidence.find(e => e.id === "return_cargo").body, /仕分け|回収瓶を使える注文/);
const supplyHypothesis = E.propose(all, "trade", "all_local", tradeClues.evidence.map(e => e.id), base);
const supplyChecked = E.inspect(supplyHypothesis, "trade", "labels", at("tsubo_roji"));
const supplyRefutation = E.getView(supplyChecked, base).cases.find(c => c.id === "trade").refutations[0];
assert.match(supplyRefutation.body, /新しい瓶が必要な注文/);
assert.match(supplyRefutation.body, /回収瓶を使える注文/);
assert.match(supplyRefutation.body, /受取欄が空白/);
assert.match(supplyRefutation.body, /輸入を増やすだけでは/);
assert.match(supplyRefutation.title, /一部は説明できた/,'a partially useful supply hypothesis must not be framed as wholly false');
const tradeFinding = E.getView(complete, base).cases.find(c => c.id === "trade").finding;
assert.match(tradeFinding.body, /器そのものが足りない注文と、器が届かず待つ注文は違う/);
assert.match(tradeFinding.reply, /まだ渡せていない|工房の手に届くまで/);

// A site survey is not a built ranch. Only actual dragon Lv4 changes its kind,
// and the old survey remains an old survey until the player checks again.
const candidate = E.getView(complete, base).cases.find(c => c.id === "pasture").finding;
assert.equal(candidate.kind, "pasture_candidate");
assert.match(candidate.body, /まだ牧場が建ったわけではない/);
assert.equal(E.getView(complete, at("ryu_mizunomi", { dragonLevel: 4 })).cases.find(c => c.id === "pasture").finding.kind, "pasture_candidate");
const built = E.inspect(complete, "pasture", "paths", at("ryu_mizunomi", { dragonLevel: 4 }));
assert.equal(E.getView(built, base).cases.find(c => c.id === "pasture").finding.kind, "pasture_route");
assert.equal(E.exportDiscoveries(built).length, 7, "rechecking after construction duplicated a reward");
assert.match(E.getView(built, base).cases.find(c => c.id === "pasture").finding.body, /新たに建てた記録ではなく/);
assert.equal(E.getView(E.inspect(built, "pasture", "paths", at("ryu_mizunomi")), base).cases.find(c => c.id === "pasture").finding.kind, "pasture_route");

const exported = freeze(E.exportDiscoveries(complete));
assert.deepEqual(E.normalizeExport(exported), exported);
assert.deepEqual(E.normalizeExport([...exported, ...exported]), exported);
assert.doesNotMatch(JSON.stringify(exported), /body|reply|images\/|coins|建設/);
for (const item of exported) {
  const described = E.describeDiscovery(item);
  assert.equal(described.finding.id, item.caseId);
  assert.equal(described.plan.id, item.planId);
  assert.equal(E.describeDiscovery({ ...item, hypothesisId: "fake" }), null);
  assert.equal(E.describeDiscovery({ ...item, planId: "coins" }), null);
  assert.equal(E.describeDiscovery({ ...item, evidenceIds: [] }), null);
  assert.equal(E.describeDiscovery({ ...item, kind: "built_free_ranch" }), null);
  assert.deepEqual(E.describeDiscovery({ ...item, body: "invented", coins: 100000 }), described);
}
assert.deepEqual(E.normalize({ version: 1, evidence: ["fake"], findings: { water: { hypothesisId: "upstream", evidenceIds: ["water_jars", "water_fork"] } } }).findings, {});
const malformed = E.normalize({ version: 1, attempts: { water: [{ hypothesisId: "upstream", methodId: "trace" }] }, notice: { type: "inspection", id: "water", hypothesisId: "upstream", methodId: "trace" } });
assert.equal(E.getView(malformed, base).notice, null, "orphan success notice crashed or revealed a finding");
const noSacred = E.getView(all, at("market", { openSpots: spots.filter(id => id !== "rondo") })).cases.find(c => c.id === "history");
assert.equal(noSacred.hypotheses.some(h => h.spotId === "rondo"), false, "closed sacred destination leaked through a choice");
const mutable = E.getView(complete, base); mutable.cases[0].evidence[0].body = "edited"; mutable.cases[0].finding.title = "edited";
assert.notEqual(E.getView(complete, base).cases[0].evidence[0].body, "edited");
assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(complete))), E.normalize(complete));
assert.equal(base.coins, 0); assert.deepEqual(base.race, { time: [1, 2, 3], odds: [2, 3, 4] });
assert.equal(empty.evidence.length, 0); assert.equal(Object.keys(all.findings).length, 0);
// A companion is recorded only when actually available, and a replay does not
// replace the person who was there for the original discovery.
// The old route can be resumed, including an inconclusive inspection.
const ids = ['trace_toes','trace_quill'];
const journey = E.normalize({...all, selected:{dragon_trace:{hypothesisId:'wind_rest',evidenceIds:ids}}, attempts:{dragon_trace:[{hypothesisId:'wind_rest',methodId:'plume'}]}});
const fresh = E.propose(all,'dragon_trace','wind_flags',ids,base);
const windCase = state => E.getView(state,base).cases.find(c => c.id==='dragon_trace');
assert(!windCase(all).hypotheses.some(h => h.id==='wind_rest'));
assert.deepEqual(E.propose(all,'dragon_trace','wind_rest',ids,base),all);
assert.equal(windCase(journey).inspection.spotId,'tsubasa_dana');
assert.equal(windCase(fresh).inspection.spotId,'kazami_yagura');
assert.deepEqual(E.inspect(fresh,'dragon_trace','distance',at('tsubasa_dana')),fresh);
const gust = E.inspect(fresh,'dragon_trace','gust',at('kazami_yagura'));
const lull = E.inspect(gust,'dragon_trace','lull',at('kazami_yagura'));
assert.equal(windCase(lull).finding,null);
assert.match(windCase(lull).refutations[0].body,/強さ/);
assert.match(windCase(lull).refutations[1].body,/首と爪/);
const forecast = E.inspect(E.normalize(JSON.parse(JSON.stringify(lull))),'dragon_trace','distance',at('kazami_yagura'));
assert.match(E.describeDiscovery(E.exportDiscoveries(forecast)[0]).finding.souvenir.name,/三コマ/);
const unintroduced=E.inspect(journey,'dragon_trace','distance',at('tsubasa_dana',{companionId:'mizu',availableCompanions:[]}));
assert.equal(unintroduced.findings.dragon_trace.companionId,null);
const together=E.inspect(journey,'dragon_trace','distance',at('tsubasa_dana',{companionId:'sake',availableCompanions:['sake']}));
assert.equal(together.findings.dragon_trace.companionId,'sake');
const prior = E.describeDiscovery(E.exportDiscoveries(together)[0]).finding;
assert.equal(prior.spotId,'tsubasa_dana');
assert.match(prior.body,/縄の手前/);
assert.doesNotMatch(prior.souvenir.name,/三コマ/);
const revisited=E.inspect(together,'dragon_trace','distance',at('tsubasa_dana',{companionId:'mizu',availableCompanions:['mizu']}));
assert.equal(revisited.findings.dragon_trace.companionId,'sake');
assert.equal(E.describeDiscovery(E.exportDiscoveries(together)[0]).finding.dragonId,'seram');
assert.deepEqual(E.normalizeExport(E.exportDiscoveries(together)),E.exportDiscoveries(together));
const S=require('../js/island_discovery_stories.js');
const ringReady=E.inspect(E.propose(all,'legend_ring','workshop',['ring_rubbing','ring_mending'],base),'legend_ring','repair',at('kirimina'));
assert.equal(E.getView(ringReady,base).cases.find(c=>c.id==='legend_ring').practice.joined,false);
assert.equal(E.exportDiscoveries(ringReady).length,0);
assert.deepEqual(E.tryTool(ringReady,'legend_ring','thread',at('furununo')),ringReady);
assert.deepEqual(E.tryTool(all,'legend_ring','thread',at('kirimina')),all);
assert.deepEqual(E.acceptKeepsake(ringReady,'legend_ring',at('kirimina')),ringReady);
const slipped=E.tryTool(ringReady,'legend_ring','hang',at('kirimina'));
assert.match(E.getView(slipped,base).cases.find(c=>c.id==='legend_ring').practice.response,/滑/);
assert.equal(E.getView(slipped,base).cases.find(c=>c.id==='legend_ring').practice.joined,false);
const joined=E.tryTool(slipped,'legend_ring','thread',at('kirimina'));
assert.equal(E.getView(joined,base).cases.find(c=>c.id==='legend_ring').practice.joined,true);
assert.equal(E.exportDiscoveries(joined).length,0);
assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(joined))),joined);
const received=E.acceptKeepsake(joined,'legend_ring',at('kirimina',{companionId:'mizu',availableCompanions:['mizu']}));
assert.equal(received.findings.legend_ring.toolConfirmed,true);
assert.equal(received.findings.legend_ring.companionId,null,'joining alone cannot acquire a companion retroactively at handover');
const sakeJoined=E.tryTool(ringReady,'legend_ring','thread',at('kirimina',{companionId:'sake',availableCompanions:['sake']}));
assert.equal(E.acceptKeepsake(sakeJoined,'legend_ring',at('kirimina',{companionId:'mizu',availableCompanions:['mizu']})).findings.legend_ring.companionId,'sake');
assert.equal(E.tryTool(sakeJoined,'legend_ring','thread',at('kirimina',{companionId:'mizu',availableCompanions:['mizu']})).toolUse.legend_ring.successfulCompanionId,'sake');
assert.deepEqual(E.acceptKeepsake(received,'legend_ring',at('kirimina')),received);
assert.equal(E.inspect(received,'legend_ring','repair',at('kirimina')).findings.legend_ring.toolConfirmed,true);
assert.equal(E.describeDiscovery(E.exportDiscoveries(received)[0]).finding.body.includes('私も練習用'),true);
const legacy=JSON.parse(JSON.stringify(received));delete legacy.findings.legend_ring.toolConfirmed;delete legacy.toolUse;
assert(E.normalize(legacy).findings.legend_ring,'legacy keepsakes must be retained');
assert(!E.describeDiscovery(E.exportDiscoveries(legacy)[0]).finding.body.includes('私も練習用'),'do not invent tool use in an old discovery');
const damaged=JSON.parse(JSON.stringify(received));delete damaged.toolUse;
assert.equal(E.normalize(damaged).findings.legend_ring,undefined,'new confirmed tool use needs its saved evidence');
const lowTrace=E.observe(empty,'trace_toes',at('ryu_mizunomi'));
assert.match(E.getView(lowTrace,base).cases.find(c=>c.id==='dragon_trace').question,/風見の櫓/);
assert.doesNotMatch(E.getView(lowTrace,base).cases.find(c=>c.id==='dragon_trace').question,/羽の裏/,'unseen feather is not already known');
const earlyLedge=E.getView(lowTrace,at('tsubasa_dana'));
assert.match(earlyLedge.hints[0].title,/風見の櫓/);
assert.equal(E.exportDiscoveries(lowTrace).length,0,'an early visit hint does not confirm the discovery');
assert.equal(E.getView(all,at('tsubasa_dana')).hints.length,0,'the hint retires once the second clue is known');
assert.deepEqual(E.getView(lowTrace,at('ryu_mizunomi',{openSpots:['ryu_mizunomi'],spotUnlockAt:{kazami_yagura:1000000}})).cases[0].continuationGate,{requiredAssets:1000000});
assert.equal(E.getView(lowTrace,base).cases[0].continuationGate,null);
const village=at('hoshiuo',{openSpots:[...spots,'hoshiuo']});
assert.equal(E.getView(empty,village).hints.length,0);
assert.match(E.getView(E.observe(empty,'ring_rubbing',at('furununo')),village).hints[0].body,/霧港/);
assert.equal(E.getView(complete,village).hints.length,0);
assert.notDeepEqual(S.dialogue('dragon_trace','clue','poro','trace_toes'),S.dialogue('dragon_trace','clue','poro','trace_quill'));
assert.doesNotMatch(JSON.stringify(S.dialogue('legend_ring','clue','mizu','ring_rubbing')),/売れる|価値でしょう/);
for(const id of ['dragon_trace','legend_ring'])for(const stage of ['clue','retry','found','return'])for(const companion of Object.keys(S.companions))assert(S.dialogue(id,stage,companion).length>0);
assert(S.dialogue('legend_ring','found','sumika').some(l=>/ミミ様/.test(l.t)));
assert(S.dialogue('dragon_trace','found','poro').every(l=>l.s!=='poro'),'Poro must not speak human language');
assert.doesNotMatch(JSON.stringify(S.cases),/loreLv|scouted|speed.*:/);
console.log(JSON.stringify({ ok: true, chains: 7, observations: 13, localInspectionBranches: 43, discoveries: foundCount, localRefutations: refutedCount, incompleteMethods: incompleteCount, persistentProposals: 14, guardedCompanions:true,originalCompanyRetained:true,noCurrencyRaceOrConstructionWrites: true, boundedWhitelistExport: true }));
