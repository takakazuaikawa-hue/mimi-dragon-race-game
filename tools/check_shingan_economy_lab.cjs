"use strict";
const assert = require("node:assert/strict");
const lab = require("../js/shingan_economy_lab.js");
const original = require("../js/shingan_prototype_engine.js");
const catalog = lab.getView(lab.createState({ seed: 11 })).dragons;
const ids = catalog.map(d => d.id);
const pairs = ids.flatMap((a,i) => ids.slice(i+1).map(b => [a,b]));
const worlds = ids.slice(1).flatMap(b => ids.slice(1).filter(c => c !== b).map(c => [ids[0],b,c]));
const key = (a,b) => [a,b].sort().join("+");
const cents = n => Math.round(n * 100);

// Diagnostic comparison with the earlier three-article experiment. Print its
// current result; an improvement to that experiment must not fail this suite.
const coast = original.createState("prepared","coast");
coast.prepared.market = false;
const oldPlan = ["p_raiou","p_fugaku","w_raiou_fugaku"];
const comparison = [oldPlan,["p_poro",...oldPlan.slice(1)]].map(plan => {
  const r = original.resolve(coast,plan);
  assert.ok(r.valid);
  return { first:plan[0],hits:r.hits,profit:r.operatingProfit,success:r.success };
});
console.log("Earlier coast model, same two later articles:",comparison);
function fixture(investment = "low", seed = 11, scouted = ids) {
  return lab.createState({ seed, investment, scouted });
}
function publish(state, desk, place, wide) {
  return lab.getView(lab.publish(lab.edit(state,{ desk, place, wide }))).lastResult;
}

// Protect the actual pool. A guaranteed return may consume the intended
// commission; calling it a net loss of 20 on a 100/100 pool double counts it.
const all = lab.settlePool({ a:100, b:0 },["a"]);
assert.deepEqual([all.sales, all.payout, all.houseNet, all.refundSupport], [100,100,0,20]);
const before = lab.settlePool({ a:80, b:20 },["a"]);
const after = lab.settlePool({ a:80, b:0 },["a"]);
assert.deepEqual([before.houseNet,after.houseNet],[20,0]);
const side = lab.settlePool({ a:5, b:5, c:10 },["a","b"]);
assert.equal(side.houseNet,4);
assert.equal(after.houseNet + side.houseNet,4); // Moving 20 to a different market did not rescue win.
const lopsided = lab.settlePool({ a:75,b:2,c:23 },["a","b"]);
assert.deepEqual(lopsided.payouts,{a:76.5,b:3.5});
const nobody = lab.settlePool({ a:30,b:0 },["b"]);
assert.deepEqual([nobody.payout,nobody.houseNet,nobody.void],[30,0,true]);
assert.throws(() => lab.settlePool({a:-1},["a"]));

// Every individual wallet balances. Same island and seed supply the same
// visitors/wallets in the before-oracle, after-oracle and operated contexts.
function wallets(rows) {
  for (const g of rows) {
    assert.equal(g.potential, g.count + g.away);
    assert.equal(g.budget, g.count * g.budgetPerPerson);
    assert.equal(g.win + g.place + g.wide + g.shopping + g.unspent, g.budget);
  }
  return rows.map(({id,count,budget}) => ({id,count,budget}));
}
function verifyReceipt(r) {
  for (const [type,p] of Object.entries(r.pools)) {
    assert.equal(cents(p.sales),cents(p.payout) + cents(p.houseNet));
    assert.equal(cents(p.payout),Object.values(p.payouts).reduce((s,n)=>s+cents(n),0));
    assert.equal(p.sales,r.segments.reduce((s,g) => s+g[type],0));
    if (!p.void) for (const [k,v] of Object.entries(p.payouts)) assert.ok(v >= r.stakes[type][k]);
  }
  assert.equal(cents(r.operatingProfit),Object.values(r.pools).reduce((s,p)=>s+cents(p.houseNet),0)+cents(r.commerce.net)-cents(r.cost));
  assert.deepEqual(wallets(r.segments), wallets(r.beforeOracle.segments));
  assert.deepEqual(wallets(r.segments), wallets(r.baseline.segments));
  assert.ok(r.beforeOracle.win.houseNet > 0);
  assert.equal(r.baseline.win.houseNet,0);
  assert.equal(r.pools.win.houseNet,0);
  assert.equal(r.commerce.sales,r.segments.reduce((s,g)=>s+g.shopping,0));
}
const base = fixture();
const unknown = lab.edit(fixture("low",11,[]),{desk:"place",place:"fugaku"});
assert.equal(lab.preview(unknown).ready,false);
assert.throws(() => lab.publish(unknown),/取材/);
const late = lab.scout(unknown,"fugaku"), early = lab.edit(fixture("low",11,["fugaku"]),{desk:"place",place:"fugaku"});
assert.deepEqual(lab.preview(late),lab.preview(early));
assert.deepEqual(lab.getView(lab.publish(late)).lastResult,lab.getView(lab.publish(early)).lastResult);
assert.deepEqual(lab.getView(lab.edit(base,{wide:["poro"]})).plan.wide,["poro",null]);
assert.equal(lab.preview(lab.edit(base,{desk:"mixed",place:"poro",wide:[]})).ready,false);
const draft = lab.edit(base,{desk:"mixed",place:"fugaku",wide:["raiou","glaze"]});
assert.ok(!("order" in lab.getView(draft)) && !("order" in lab.preview(draft)));
assert.throws(() => lab.nextEvent(draft));
const published = lab.publish(draft), receipt = lab.getView(published).lastResult;
for (const p of receipt.predictions) {
  const a = lab.preview(draft).articles.find(x => x.type===p.type);
  assert.equal(a.directedStake,p.directedStake);
  assert.ok(p.directedStake<=p.stake);
  if (p.hit && p.stake) assert.ok(a.winningOdds.min<=p.odds && p.odds<=a.winningOdds.max);
}
assert.throws(() => lab.edit(published,{place:"poro"}),/発行済み/);
assert.throws(() => lab.publish(published),/発行済み/);
assert.throws(() => lab.edit(base,{desk:"place",place:receipt.order[1]}),/発行済み/);
assert.throws(() => lab.publish(draft),/発行済み/);
assert.deepEqual(lab.getView(base).lastResult,receipt);
const next = lab.nextEvent(published), archived = lab.getView(next).history[0];
assert.deepEqual(archived,receipt);
archived.order.reverse();
assert.deepEqual(lab.getView(next).history[0],receipt);
assert.equal(lab.getView(next).lastResult,null);
assert.notEqual(lab.getView(next).eventId,receipt.eventId);
const signatures = new Set();
let cycle = fixture();
for (let i=0;i<24;i++) {
  const issued=lab.publish(cycle);
  signatures.add(lab.getView(issued).lastResult.order.join());
  cycle=lab.nextEvent(issued);
}
assert.ok(signatures.size>12);

// Enumerate all 42 ordered 2nd/3rd pairs, even those not drawn by this seed.
// Reconcile the independent counterfactual scoring with actual published
// receipts for the seed's realised finish. Only the public win forecast is fixed.
function outcome(receipt, world) {
  const [a,b,c] = world, w=receipt.plan.wide;
  const place = lab.settlePool(receipt.stakes.place,[a,b]);
  const wide = lab.settlePool(receipt.stakes.wide,[key(a,b),key(a,c),key(b,c)]);
  const net = cents(receipt.pools.win.houseNet) + cents(place.houseNet) + cents(wide.houseNet)
    + cents(receipt.commerce.net) - cents(receipt.cost);
  const placeHit = receipt.plan.place===a || receipt.plan.place===b;
  const wideHit = w.every(id => world.includes(id));
  const informed = (placeHit && receipt.plan.place!==a && place.sales>0) || (wideHit && wide.sales>0);
  return { placeHit,wideHit, success: informed && net>=0, net };
}
let checkedPlans=0, counterfactuals=0;
const reports=[];
for (const seed of [11,19]) for (const investment of ["low","high"]) for (const desk of ["win","place","mixed"]) {
  const results=[], observed=new Set();
  for (const place of ids) for (const wide of pairs) {
    // Separate lab sessions with the same controlled field for counterfactuals.
    const r=publish(fixture(investment,seed),desk,place,wide);
    verifyReceipt(r);
    const actual=outcome(r,r.order.slice(0,3));
    assert.equal(actual.success,r.success);
    assert.equal(actual.net,cents(r.operatingProfit));
    observed.add(r.order.join());
    results.push(r);
    checkedPlans++;
  }
  assert.equal(observed.size,1);
  const wins=results.filter(r=>r.success).length;
  reports.push({meeting:results[0].meeting.id,investment,desk,profit:results[0].operatingProfit,successfulPapers:wins,possiblePapers:results.length});
  for (const world of worlds) {
    const scores=results.map(r=>outcome(r,world));
    for (let i=0;i<results.length;i++) {
      const p=results[i].plan, a=scores[i];
      const alternatives=[];
      if (a.placeHit) for (let j=0;j<ids.length;j++) alternatives.push(j*pairs.length+(i%pairs.length));
      if (a.wideHit) for (let j=0;j<pairs.length;j++) alternatives.push(Math.floor(i/pairs.length)*pairs.length+j);
      for (const j of alternatives) {
        const q=results[j].plan, b=scores[j];
        const replacedHit = (p.place!==q.place && a.placeHit && !b.placeHit) || (a.wideHit && !b.wideHit);
        if (!replacedHit) continue;
        counterfactuals++;
        assert.ok(a.success || !b.success, JSON.stringify({world,investment,desk,p,q}));
        assert.ok(a.net>=b.net, "A deliberate miss produced more operating income");
      }
    }
  }
}
assert.equal(checkedPlans,2688);
assert.ok(counterfactuals>100000);
assert.ok(reports.some(r=>r.investment==="low"&&r.successfulPapers>0));
assert.ok(reports.some(r=>r.investment==="high"&&r.successfulPapers===0));
assert.ok(reports.some(r=>r.desk==="mixed"&&r.profit<0));
assert.ok(reports.some(r=>r.desk==="mixed"&&r.profit>0&&r.successfulPapers>0&&r.successfulPapers<224));
for (const [meeting,operating,tooCostly] of [["weekday","place","mixed"],["festival","mixed","place"]]) {
  const day = reports.filter(r=>r.investment==="low" && r.meeting===meeting);
  assert.ok(day.some(r=>r.desk===operating && r.successfulPapers>0));
  assert.ok(day.some(r=>r.desk===tooCostly && r.profit<0));
}
console.table(reports);
console.log("Checked "+checkedPlans+" published papers, all 42 uncertain podiums and "+counterfactuals+" one-slot correct-to-wrong substitutions.");
