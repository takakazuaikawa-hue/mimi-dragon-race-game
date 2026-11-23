"use strict";
const assert=require("node:assert/strict");
const f=require("../js/shingan_festival.js");
const {settlePool}=require("../js/shingan_economy_lab.js");
const trial=require("../js/shingan_prototype_engine.js");
const discovery=require("../js/island_discovery.js");
const ids=trial.getView(trial.createState()).dragons.map(d=>d.id);
const pair=(a,b)=>[a,b].sort().join("+");
const pairs=ids.flatMap((a,i)=>ids.slice(i+1).map(b=>[a,b]));
const clone=x=>JSON.parse(JSON.stringify(x));
function player(lv={}) {
  return {coins:665,completedRaces:7,flags:{poroFound:true},island:{lv},collection:Object.fromEntries(ids.filter(id=>id!=="poro").map(id=>[id,{scouted:true}]))};
}
function fixture(p,seed) {return f.open(f.restore(p),f.capture(p),seed);}
function put(r,patch) {return f.edit(r,r.active.id,patch);}
function issue(r,patch) {const d=put(r,patch);return f.publish(d,d.active.id,d.revision);}
function figure(r,patch) {return f.preview(put(r,patch));}
function reload(p,r) {return f.restore({...p,shingan:{...p.shingan,festival:clone(r)}});}

const bare=player(), before=JSON.stringify(bare);
const base=fixture(bare,3), known=f.view(base).oracle.id;
assert.equal(JSON.stringify(bare),before);
assert.ok(!("order" in f.view(base)) && !("field" in f.view(base)) && !("drawSeed" in f.view(base)));
assert.ok(!("order" in f.preview(base)));
assert.deepEqual(f.open(base,{invalid:"later island"},919),base);
const scarce=player();scarce.collection.fugaku.scouted=false;
assert.throws(()=>fixture(scarce,5),/八頭/);
scarce.collection.fugaku.scouted=true;
assert.deepEqual(f.capture(scarce),f.capture(bare));
const missingBuddy=player();missingBuddy.flags.poroFound=false;missingBuddy.collection.poro={scouted:true};
assert.throws(()=>fixture(missingBuddy,5),/八頭/);
const seeds={}, observedWinners=new Set();
for(let n=0;n<2500;n++) {
  const r=fixture(bare,n), v=f.view(r);seeds[v.meeting.id]??=n; observedWinners.add(v.oracle.id);
  if(observedWinners.size===8 && Object.keys(seeds).length===2) break;
}
assert.equal(observedWinners.size,8);
assert.equal(Object.keys(seeds).length,2);
const max=player({infra:8,commerce:8,race:8,dragon:8,public:8,industry:8});
for (const [day,seed] of Object.entries(seeds)) {
  const poor=fixture(bare,seed), rich=fixture(max,seed);
  const p=figure(poor,{desk:"place"}), m=figure(poor,{desk:"mixed"}), h=figure(rich,{desk:"mixed"});
  assert.equal(p.net.min,p.net.max);assert.equal(m.net.min,m.net.max);
  if(day==="weekday") {assert.equal(p.net.min,0.8);assert.equal(m.net.max,-2.8);}
  else {assert.equal(p.net.min,-4.8);assert.equal(m.net.max,6.8);}
  assert.ok(h.net.min>m.net.min);
  assert.equal(h.pools.win.minNet,0);
  assert.equal(h.commerce.sales,h.segments.reduce((sum,g)=>sum+g.shopping,0));
  assert.equal(h.facilityEffects.length,6);
  assert.equal(h.baseline.win.sales,h.baseline.win.payout);
  assert.ok(h.beforeOracle.win.houseNet>0);
  for (const g of h.segments) {
    assert.equal(g.potential,g.count+g.away);
    assert.equal(g.budget,g.win+g.place+g.wide+g.shopping+g.unspent);
  }
  const patch={desk:"mixed",place:ids[2],wide:[ids[2],ids[3]]};
  const a=f.outcome(issue(poor,patch)), b=f.outcome(issue(rich,patch));
  assert.deepEqual(a.order,b.order);assert.equal(a.oracleId,a.order[0]);
  for (const r of [a,b]) for(const market of Object.values(r.pools)) {
    assert.equal(Math.round(market.sales*100),Math.round(market.payout*100)+Math.round(market.houseNet*100));
  }
  console.log(day,"unbuilt place / mixed",p.net.min,m.net.min,"upgraded mixed",h.net.min);
}
const fullDay=figure(fixture(max,seeds.festival),{desk:"mixed"});
for(const id of Object.keys(max.island.lv)) {
  const without=player({...max.island.lv,[id]:0});
  const day=figure(fixture(without,seeds.festival),{desk:"mixed"});
  if(id==="commerce" || id==="industry") assert.ok(day.commerce.units<fullDay.commerce.units,id);
  else assert.ok(day.segments.reduce((s,g)=>s+g.count,0)<fullDay.segments.reduce((s,g)=>s+g.count,0),id);
}

// Real entries from the article/fieldwork engines only. A proposed works plan
// can coordinate an actual facility; it cannot build a well or print cash.
const ctx=currentSpotId=>({enabled:true,currentSpotId,openSpots:["market","tanada"]});
let water=discovery.observe(null,"water_jars",ctx("market"));
water=discovery.observe(water,"water_fork",ctx("tanada"));
const data=discovery.getView(water,ctx("market")).cases.find(c=>c.id==="water");
water=discovery.propose(water,"water","upstream",data.evidence.map(e=>e.id),ctx("market"));
const withNotes=player();
withNotes.kikoArts=[{id:"ka1",race:4,headline:"田の水路へ",paras:["屋台の人に聞いた。"]},{id:"ka2",race:8,headline:"未来",paras:["未来"]}];
withNotes.kikoHof=[withNotes.kikoArts[0]];
withNotes.kikoEarned=999999;withNotes.kikoFans=1234;
let story=fixture(withNotes,seeds.weekday);
assert.deepEqual(story.active.snapshot.sources.map(s=>s.id),["kiko:ka1"]);
let effect=figure(story,{desk:"place",sourceId:"kiko:ka1"});
assert.equal(effect.segments[2].potential,15);assert.equal(effect.segments[2].count,10);
assert.equal(effect.commerce.net,0);
assert.throws(()=>put(story,{sourceId:"kiko:ka2"}));
const seatsForReaders={...withNotes,island:{lv:{race:8,infra:8}}};
const withReaders=fixture(seatsForReaders,seeds.festival);
assert.equal(figure(withReaders,{desk:"mixed",sourceId:"kiko:ka1"}).segments[2].count,
  figure(withReaders,{desk:"mixed"}).segments[2].count+3);
water=discovery.inspect(water,"water","trace",ctx("tanada"));
assert.ok(discovery.exportDiscoveries(water).length, "water fieldwork fixture must inspect the real destination");
withNotes.islandDiscovery=discovery.plan(water,"water","care",ctx("tanada"));
story=fixture(withNotes,seeds.weekday);
const project=story.active.snapshot.sources.find(s=>s.kind==="project");
assert.equal(project.facilityId,"public");
const emptyPlan=figure(story,{desk:"place"}), filed=figure(story,{desk:"place",sourceId:project.id});
assert.deepEqual(filed.facilityEffects,emptyPlan.facilityEffects);
withNotes.island.lv.public=1;
story=fixture(withNotes,seeds.festival);
const prepared=figure(story,{desk:"place",sourceId:project.id}), unassigned=figure(story,{desk:"place"});
assert.ok(prepared.segments[1].count>unassigned.segments[1].count);

// Legacy issues are reverified only with their original rules, including a
// correctly forecast paper that really did lose. Never trust a stored success bit.
for (const [first,success,expected] of [["p_raiou",false,-61.43],["p_poro",true,293.86]]) {
  const p=player();p.shingan={official:{version:1,draft:[first,null,null],ferry:true,issue:{
    version:1,course:"coast",plan:[first,"p_fugaku","w_raiou_fugaku"],harbor:false,ferry:true,market:false,notes:[],noteId:null,success:!success}}};
  const legacy=f.restore(p), r=f.outcome(legacy);
  assert.equal(r.provenance,"official-v1");assert.equal(r.success,success);assert.equal(r.operatingProfit,expected);
  assert.deepEqual(legacy.legacy.entry,p.shingan.official);
  if(success) assert.deepEqual(f.open(legacy,f.capture(p),88),legacy);
  else assert.ok(f.open(legacy,f.capture(p),88).active);
  const corrupt=clone(legacy);corrupt.legacy.receipt.success=!success;
  assert.throws(()=>reload(p,corrupt),/旧号/);
}
const old=player();old.shingan={cleared:true};old.epilogue={edFlag:true};
assert.ok(f.restore(old).legacy.legacyCleared);assert.equal(f.outcome(f.restore(old)),null);
const unfinished=player();unfinished.shingan={official:{version:1,draft:["p_poro",null,null],ferry:true,issue:null}};
assert.deepEqual(f.restore(unfinished).legacy.entry.draft,unfinished.shingan.official.draft);
assert.equal(f.outcome(f.restore(unfinished)),null);

const failed=issue(base,{desk:"win",place:known});
assert.equal(failed.active.receipt.success,false);
assert.deepEqual(f.publish(failed,failed.active.id,0),failed);
assert.throws(()=>put(failed,{place:"goka"}),/発行済み/);
assert.throws(()=>f.publish(base,base.active.id,base.revision-1),/下書き/);
const later=f.next(reload(bare,failed),failed.active.id,f.capture(max),{drawSeed:49,nonce:77});
assert.equal(f.view(later).history[0].eventId,base.active.id);
assert.notEqual(later.active.id,failed.active.id);
assert.throws(()=>f.publish(later,base.active.id,base.revision),/開催/);
assert.equal(f.view(later).lastResult,null);
assert.equal(f.view(later).facilities.find(x=>x.id==="public").level,8);
assert.equal(f.view(failed).facilities.find(x=>x.id==="public").level,0);
for (const damage of [r=>{r.active.receipt.success=true;},r=>{r.active.receipt.operatingProfit=999;},
  r=>{r.active.field.order.reverse();},r=>{r.active.plan.place="unknown";}]) {
  const broken=clone(failed);damage(broken);assert.throws(()=>reload(bare,broken));assert.throws(()=>f.outcome(broken));
}
const brokenArchive=clone(later);brokenArchive.history[0].receipt.success=true;
assert.throws(()=>reload(bare,brokenArchive));
const reordered=clone(failed);
reordered.active.receipt=Object.fromEntries(Object.entries(reordered.active.receipt).reverse());
assert.deepEqual(f.outcome(reload(bare,reordered)),f.outcome(failed));

// This control compares every ordered choice in a scoreable opening and a
// loss-making one. A ticket's payout can change but losing on purpose cannot
// improve the operator's margin, nor qualify an otherwise unsuccessful paper.
let plans=0,substitutions=0;
for(const p of [bare,max]) for(const seed of Object.values(seeds)) for(const desk of ["win","place","mixed"]) {
  const b=fixture(p,seed), book=[];
  for(const place of ids) for(const wide of pairs) book.push(issue(b,{desk,place,wide}).active.receipt);
  plans+=book.length;
  const predicted=book[0].oracleId, others=ids.filter(id=>id!==predicted);
  for(const second of others) for(const third of others) {
    if(second===third) continue;
    const podium=[predicted,second,third];
    const answers=book.map(r=>{
      const placeHit=podium.slice(0,2).includes(r.plan.place), wideHit=r.plan.wide.every(id=>podium.includes(id));
      const place=settlePool(r.stakes.place,podium.slice(0,2));
      const wide=settlePool(r.stakes.wide,[pair(predicted,second),pair(predicted,third),pair(second,third)]);
      const net=Math.round((r.pools.win.houseNet+place.houseNet+wide.houseNet+r.commerce.net-r.cost)*100);
      const read=placeHit && r.plan.place!==predicted && r.predictions[0].directedStake>0 || wideHit && r.predictions[1].directedStake>0;
      const success=read && net>=0;
      if(second===r.order[1] && third===r.order[2]) {
        assert.equal(net,Math.round(r.operatingProfit*100)); assert.equal(success,r.success);
      }
      return {placeHit,wideHit,net,success};
    });
    for(let i=0;i<answers.length;i++) {
      const a=answers[i], alternatives=[];
      if(a.placeHit) for(let j=0;j<ids.length;j++) alternatives.push(j*pairs.length+i%pairs.length);
      if(a.wideHit) for(let j=0;j<pairs.length;j++) alternatives.push(Math.floor(i/pairs.length)*pairs.length+j);
      for(const j of alternatives) {
        const c=answers[j];
        if(!(a.placeHit && !c.placeHit || a.wideHit && !c.wideHit)) continue;
        substitutions++;assert.ok(a.net>=c.net);assert.ok(a.success || !c.success);
      }
    }
  }
}
assert.equal(plans,2688);
console.log("Verified",plans,"official papers,",substitutions,"single-slot substitutions, native inputs, eight possible oracle winners, legacy receipts and archive/reload.");
