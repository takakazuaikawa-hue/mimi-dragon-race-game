const assert = require("node:assert/strict");
const F = require("../js/shingan_festival.js");
const R = require("../js/shingan_recovery.js");
const P = require("../js/shingan_prototype_engine.js");
const D = require("../js/island_discovery.js");
const ids = P.getView(P.createState()).dragons.map(d=>d.id);
const barePlayer={coins:450,completedRaces:7,flags:{poroFound:true},island:{lv:{}},
  collection:Object.fromEntries(ids.filter(id=>id!=="poro").map(id=>[id,{scouted:true}]))};
const clone=x=>JSON.parse(JSON.stringify(x));
const bare=F.capture(barePlayer);
function issue(r,plan) {
  let draft=F.edit(r,r.active.id,plan);
  return F.publish(draft,draft.active.id,draft.revision);
}
let seed=0;
function newBook() {return F.open(F.restore(barePlayer),bare,{drawSeed:seed++,nonce:901});}
// Test-only access to the sealed podium, to stage a genuinely earned winning receipt.
let draft=newBook();
while(draft.active.field.meeting.id!=="weekday") draft=newBook();
function win(r) {
  const desk=r.active.field.meeting.id==="weekday"?"place":"mixed";
  return issue(r,{desk,place:r.active.field.order[1],wide:r.active.field.order.slice(1,3)});
}
let start=win(draft);
assert.equal(start.active.receipt.success,true);
assert.equal(F.outcome(start).success,false);
assert.equal(F.recoveryView(start).cash,800);
const step=(r,desk,contract,s=bare)=>F.settleRecovery(r,r.active.id,r.revision,{desk,contract},s);
const ledger=r=>F.recoveryView(r);
const repayChecks=row=>{
  assert.equal(row.opening+row.draw+row.raceNet+row.tradeNet-row.interestPaid-row.standingPaid-row.arrearsPaid-row.repaid,row.cash);
  assert.equal(row.openingDebt+row.draw-row.repaid,row.debt);
  assert.equal(row.openingArrears+row.interest-row.interestPaid+row.standingCost-row.standingPaid-row.arrearsPaid,row.arrears);
  assert.equal(row.deliverable*row.unitPrice,row.revenue);
  assert.equal(row.buyerBudget,row.revenue+row.unspentBuyerBudget);
  assert.equal(row.net,row.tradeNet+row.raceNet-row.interest-row.standingCost);
  assert.equal(row.standingCost,1500*row.serviceDays);
  assert.equal(row.opening-row.openingDebt-row.openingArrears+row.net,row.cash-row.debt-row.arrears);
  assert.ok(row.cash>=0 && row.debt>=0 && row.draw+row.openingDebt<=row.creditLimit);
};
const adapt=[["place","local"],["market","ferry"],["place","local"],["mixed","local"]];
const replay=(r,plans,s=bare)=>plans.reduce((p,[desk,c])=>step(p,desk,c,s),r);
const good=replay(start,adapt);
const constant=replay(start,Array(4).fill(["place","local"]));
const noRace=replay(start,Array(4).fill(["market","local"]));
assert.equal(F.outcome(good).success,true);
assert.equal(F.outcome(constant).success,false);
assert.equal(F.outcome(noRace).success,false);
assert.equal(ledger(good).remaining.length,0);
assert.equal(ledger(good).history.length,4);
assert.equal(ledger(good).cash,24733);
assert.equal(ledger(good).history.reduce((sum,r)=>sum+r.standingCost,0),21000);
assert.equal(ledger(constant).cash,0);
assert.equal(ledger(constant).debt,4111);
assert.equal(ledger(constant).periodNet,-4911);
assert.equal(F.outcome(replay(constant,Array(4).fill(["place","local"]))).success,false);
// A big opening reserve or three profitable recent seasons cannot conceal an annual loss.
const weakYear=ledger(good).history.map((r,i)=>({...r,net:i===0?-4000:1000}));
const open=ledger(good).opening;
assert.equal(R.view(open,weakYear,bare).complete,false);
assert.equal(R.view(open,weakYear.slice(1),bare).complete,false);
// A depot bill can fall due with no cash and all bridge credit already used.
// Goods against firm local orders still reach the market. Unpaid bills survive winter.
const fullCredit={...R.view(open,[],bare),period:3,cash:0,debt:48000};
const localMarket={desk:"market",contract:"local"};
const autumnBills=R.settle(fullCredit,R.quote(fullCredit,localMarket,bare),null);
repayChecks(autumnBills);
assert.equal(autumnBills.standingPaid,0);
assert.equal(autumnBills.arrears,4980);
const winter={...fullCredit,...autumnBills,period:4};
const winterBills=R.settle(winter,R.quote(winter,localMarket,bare),null);
repayChecks(winterBills);
assert.equal(winterBills.arrearsPaid,4020);
assert.equal(winterBills.arrears,960);
for(const row of ledger(good).history) repayChecks(row);
assert.equal(ledger(good).history[2].missed,12);
assert.deepEqual(F.restore({...barePlayer,shingan:{festival:clone(good)}}),good);
const commit=step(start,...adapt[0]);
assert.throws(()=>F.settleRecovery(commit,start.active.id,start.revision,{desk:"mixed",contract:"ferry"},bare));
assert.throws(()=>step(good,"place","local"));
assert.throws(()=>F.quoteRecovery(start,{desk:"mixed",contract:"return"},bare));
const changed=clone(good);changed.active.recoveryPeriods[0].receipt.cash++;
assert.throws(()=>F.outcome(changed));
const was=clone(good);was.active.rules=1;
assert.throws(()=>F.outcome(was));
const old=clone(start);old.active.rules=1;delete old.active.recoveryPeriods;
assert.equal(F.outcome(F.restore({...barePlayer,shingan:{festival:old}})).success,true);
assert.equal(F.recoveryView(old).required,false);
const rich=F.capture({...barePlayer,island:{lv:{infra:4,commerce:4,industry:4,race:4,dragon:4,public:4}}});
const large=replay(start,adapt,rich);
assert.ok(ledger(large).cash>ledger(good).cash);
assert.deepEqual(large.active.receipt,start.active.receipt);
for(const row of ledger(large).history) repayChecks(row);
for(const r of [start,commit]) for(const desk of ["market","place","mixed"]) {
  const plan={desk,contract:"local"},q=F.quoteRecovery(r,plan);
  if(!q.operates) continue;
  const result=ledger(step(r,desk,"local")).last;
  assert.ok(result.raceNet>=q.raceOutlook.min && result.raceNet<=q.raceOutlook.max);
  assert.ok(result.net>=q.netOutlook.min && result.net<=q.netOutlook.max);
  assert.equal(result.tradeNet,q.tradeNet);
  assert.equal(Object.hasOwn(q.raceOutlook,"order"),false);
}
const findings=D.normalizeExport([
  {version:1,caseId:"trade",kind:"trade_route",evidenceIds:["vinegar_crates","return_cargo"],hypothesisId:"roundtrip"},
  {version:1,caseId:"water",kind:"waterworks",evidenceIds:["water_jars","water_fork"],hypothesisId:"upstream"},
  {version:1,caseId:"history",kind:"shore_history",evidenceIds:["cloth_marks","gate_seaward"],hypothesisId:"shore"}
]);
assert.equal(findings.length,3);
const working={...bare,discoveries:findings};
const firstShipment=step(start,"market","ferry");
assert.equal(F.quoteRecovery(firstShipment,{desk:"mixed",contract:"ferry"}).operates,false);
assert.throws(()=>step(firstShipment,"mixed","ferry"));
const summerShipment=step(firstShipment,"market","ferry");
assert.equal(ledger(firstShipment).last.packedStock,0);
assert.equal(ledger(summerShipment).last.returned,18);
const autumnShipment=step(summerShipment,"place","ferry");
assert.ok(ledger(autumnShipment).last.packedStock>0);
const winterQuote=F.quoteRecovery(autumnShipment,{desk:"place",contract:"ferry"});
assert.equal(winterQuote.fromStock,ledger(autumnShipment).last.packedStock);
const stocked={...fullCredit,packedStock:24};
const smallBoat=R.quote(stocked,{desk:"market",contract:"ferry"},bare);
assert.equal(smallBoat.fromStock,smallBoat.deliverable);
assert.equal(smallBoat.packedStock,stocked.packedStock+smallBoat.produced-smallBoat.deliverable);
const localSpring=step(start,"place","local");
const standard=step(localSpring,"market","ferry");
const returned=step(localSpring,"market","return",working);
assert.ok(ledger(returned).last.reused>0);
assert.ok(ledger(returned).cash>ledger(standard).cash);
const handled=step(returned,"place","local",working);
assert.ok(ledger(handled).last.deliverable>ledger(good).history[2].deliverable);
const investigated=step(handled,"mixed","local",working);
assert.ok(ledger(investigated).complete);
const blocked=issue(draft,{desk:"win"});
const next=F.next(blocked,blocked.active.id,bare,922);
const recoveredWin=win(next);
assert.equal(recoveredWin.active.receipt.success,true);
assert.equal(ledger(recoveredWin).opening.arrears,24000-Math.round(recoveredWin.active.receipt.operatingProfit*1000));
// Reproduce the public UI path with two earlier issues. Choose future business
// only from the current timetable and published range, never the next podium.
function nextMeeting(r,type) {
  let next;
  do {next=F.next(r,r.active.id,bare,{drawSeed:seed++,nonce:seed});}
  while(next.active.field.meeting.id!==type);
  return next;
}
let missedRead=nextMeeting(blocked,"weekday");
missedRead=issue(missedRead,{desk:"place",place:missedRead.active.field.order[4]});
assert.equal(missedRead.active.receipt.success,false);
assert.equal(missedRead.active.receipt.operatingProfit,0.8);
let pressured=win(nextMeeting(missedRead,"festival"));
assert.equal(ledger(pressured).opening.arrears,16400);
pressured=step(pressured,"place","local");
assert.equal(ledger(pressured).cash,0); assert.equal(ledger(pressured).debt,9840);
assert.equal(F.quoteRecovery(pressured,{desk:"mixed",contract:"ferry"}).draw,57800);
assert.throws(()=>step(pressured,"mixed","ferry"));
function bestPublicPlanUntilSolvent(record) {
  for(let i=0;i<40 && !ledger(record).complete;i++) {
    const choices=[];
    for(const desk of ["place","mixed","market"]) for(const contract of ["local","ferry"]) {
      const q=F.quoteRecovery(record,{desk,contract});
      if(q.operates) choices.push(q);
    }
    choices.sort((a,b)=>b.netOutlook.min-a.netOutlook.min);
    record=step(record,choices[0].plan.desk,choices[0].plan.contract);
    repayChecks(ledger(record).last);
  }
  return record;
}
pressured=bestPublicPlanUntilSolvent(pressured);
assert.ok(ledger(bestPublicPlanUntilSolvent(recoveredWin)).complete);
assert.ok(ledger(pressured).complete);
assert.equal(ledger(pressured).cash,30192);
assert.equal(ledger(pressured).history.length,6);
console.log("Opening arrears 16400, recovery from the displayed cash-flow ranges:",ledger(pressured).history.map(p=>
  [p.periodLabel,p.plan.desk,p.plan.contract,p.cash,p.debt,p.arrears]));
assert.equal(barePlayer.coins,450);
console.log("Four-season closing cash (island coins): adaptive",ledger(good).cash,"fixed",ledger(constant).cash,"fixed debt",ledger(constant).debt,
  "market only",ledger(noRace).cash,"developed island",ledger(large).cash,"actual trade/water/history findings",ledger(investigated).cash);
console.log("Adaptive: ",ledger(good).history.map(x=>({season:x.periodLabel,race:x.raceNet,trade:x.tradeNet,interest:x.interest,cash:x.cash})));
console.log("Verified funding, finite orders, failed issue arrears, seasonal receipts, old achievements and completion gates.");
