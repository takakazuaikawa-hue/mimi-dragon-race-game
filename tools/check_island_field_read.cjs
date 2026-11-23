'use strict';
const assert=require('assert/strict'),F=require('../js/island_field_read.js'),E=require('../js/shingan_prototype_engine.js');
const game=E.prepare(E.createState('arrival','coast'),'scout'),v=E.getView(game);
const plan=['p_raiou','p_fugaku','w_fugaku_glaze'].map(id=>v.offers.find(o=>o.id===id));
const ctx={offer:plan[1],dragons:v.dragons,scenario:v.scenario,slot:v.editorSlots[1],slotIndex:1,planOffers:plan};
const before=JSON.stringify(ctx),stateBefore=JSON.stringify(game),pre=E.preview(game,plan.map(p=>p.id));
for(const caseId of ['dragon_trace','legend_ring'])for(const lens of F.options(caseId)){
  const read=F.capture(caseId,lens.id,ctx);assert(read);assert.match(read.claim,/フガク/);assert.equal(read.offerId,'p_fugaku');assert.equal(read.slotIndex,1);assert.equal(read.scenarioId,'coast');assert(Object.isFrozen(read)&&Object.isFrozen(read.facts)&&Object.isFrozen(read.ids));assert(read.facts.some(f=>f.includes(v.scenario.condition)));
  assert.deepEqual(F.capture(caseId,lens.id,{...ctx,hiddenOrder:['glaze','raiou'],raceResult:{rank:99},wallet:1e9}),read,'hidden outcomes and wallets must not enter a pre-race reading');
}
const overlap=F.capture('legend_ring','overlap',ctx);assert.match(overlap.claim,/フガクが4着以下/);assert(overlap.facts.some(f=>f.includes('2頭が両方とも3着以内')));assert(overlap.facts.some(f=>f.includes('2着以内')));
const noOverlap=F.capture('legend_ring','overlap',{...ctx,planOffers:[plan[0],plan[1]]});assert.match(noOverlap.claim,/共通の竜はいない/);
const publicPlan=['p_raiou','w_raiou_fugaku','w_raiou_poro'].map(id=>v.offers.find(o=>o.id===id));
const oracleOnly=F.capture('legend_ring','overlap',{...ctx,offer:publicPlan[1],planOffers:publicPlan});
assert.deepEqual(oracleOnly.sharedIds,[]);assert.deepEqual(oracleOnly.relatedOfferIds,[]);assert.match(oracleOnly.claim,/共通の竜はいない/);
assert(oracleOnly.facts.some(f=>f.includes('ライオウの一着は予言済み')));
const mixed=F.capture('legend_ring','overlap',{...ctx,offer:plan[2],planOffers:[plan[2],plan[1],v.offers.find(o=>o.id==='p_glaze')]});
assert.deepEqual(mixed.sharedIds,['fugaku','glaze']);assert.match(mixed.claim,/「フガクの複勝」は、フガクが4着以下/);
assert.match(mixed.claim,/「グレイズの複勝」は、グレイズが4着以下/);
for(const lens of F.options('legend_ring')) assert.doesNotMatch(F.capture('legend_ring',lens.id,ctx).claim,/承知で|掲載する|構成を選んで/);
const snapshot=F.capture('dragon_trace','conditions',ctx);const changed=structuredClone(ctx);changed.offer.title='後から変えた記事';changed.scenario.condition='後から別の風';assert(!snapshot.claim.includes('後から'));assert(!snapshot.facts.some(f=>f.includes('後から')));
assert.equal(F.capture('unknown','conditions',ctx),null);assert.equal(F.capture('dragon_trace','audience',ctx),null);assert.equal(F.capture('dragon_trace','conditions',{...ctx,dragons:[]}),null);
assert.equal(JSON.stringify(ctx),before);assert.equal(JSON.stringify(game),stateBefore);assert.deepEqual(E.preview(game,plan.map(p=>p.id)),pre);
console.log('PASS four concrete public comparisons, actual overlap/conditions, immutable publication snapshots, no hidden-race reads or engine/economy writes');
