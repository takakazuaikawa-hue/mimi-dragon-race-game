'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const J = require('../js/reading_journal.js');
const B = require('../js/shingan_trial_bridge.js');
const P = require('../js/shingan_prototype_engine.js');
const read = file => fs.readFileSync(require.resolve('../js/' + file + '.js'),'utf8');
const cast = [{id:'rosso',name:'ロッソ'},{id:'rubel',name:'ルベル'}];
const published = {id:'old',cut:'meal',headline:'昔の見出し',paras:['その時に出た原文']};
function fixture(type, ids, predicted, hit) {
  const p = {completedRaces:4,rank:1,coins:700,wins:0,flags:{},completedByRank:{},winsByRank:{},
    reasonStats:{value:{w:3,l:1}},kikoSeq:3,kikoArts:[structuredClone(published)]};
  const odds = cast.map(d=>({dragonId:d.id,...(d.id===predicted?{_celestia:true}:{})}));
  const c = {race:{id:'sample',cup:'試走杯',region:'浜',rank:1},betReasonUsed:'value',
    bet:{type,selections:ids,wager:200},betResult:{hit,wager:200,payout:hit?(type==='wide'?2200:220):0},
    raceResult:{entries:[{dragon:cast[0],rank:1},{dragon:cast[1],rank:hit?2:4}]},oddsResult:{oddsData:odds}};
  const ctx = vm.createContext({console,Math,ReadingJournal:J,DRAGONS:cast,state:{player:p,current:c,assets:{}},document:{addEventListener(){}},STREAK_BONUS_FACTOR:{}});
  ctx.window = ctx;
  for (const file of ['kiko_articles','ui_render','ui_kiko']) vm.runInContext(read(file),ctx,{filename:file+'.js'});
  for (const name of ['gainVillageExp','checkEconomyMilestones','checkRankProgression','bumpMaxCoins','updateHeader','saveGame','updateCollectionFromRace']) ctx[name]=()=>{};
  ctx.recomputeAssets=()=>({level:0});
  ctx.betOdds=()=>c.betResult.payout / 200;
  ctx.getStoryFlag=name=>name==='kikoStarted';
  const raceSnapshot=JSON.stringify([c.bet,c.oddsResult,c.raceResult,c.betResult]);
  ctx.settleRace(); ctx.settleRace();
  assert.equal(p.coins,700+c.betResult.payout);
  assert.equal(p.completedRaces,5);
  const n=J.capture(p,c,cast);
  ctx.recordReasonResult('value',hit,c);
  assert.equal(JSON.stringify([c.bet,c.oddsResult,c.raceResult,c.betResult]),raceSnapshot);
  assert.deepEqual(p.kikoArts[0],published);
  return {ctx,p,c,n};
}
for(const type of ['win','place','wide']) {
  for (const hit of type==='wide'?[true,false]:[true]) {
    const ids=type==='wide'?['rubel','rosso']:['rosso'];
    const {ctx,p,n}=fixture(type,ids,'rosso',hit);
    assert.deepEqual(p.reasonStats.value,{w:3+Number(type==='wide'&&hit),l:1+Number(!hit)});
    assert.equal(n.oracleDragonId,'rosso');
    assert.match(J.oracleAccount(n),/神眼.*ロッソ/);
    if(type==='wide') assert.match(J.oracleAccount(n),/自分でルベル/);
    const pinned=J.pin([],n).notes;
    const handoff=B.fromHash('#'+B.toURL(B.capture({...p,readingNotes:pinned},{})).split('#')[1]);
    assert.deepEqual(handoff.readingNotes,pinned);
    const game=B.apply(P.createState('prepared','coast'),handoff);
    const evidence=P.getReadingNotes(game)[0];
    if(type!=='wide') assert.equal(evidence.suggestedTheoryId,null);
    assert.match(evidence.reviewText,/神眼/);
    const plan=['p_raiou','p_fugaku','w_fugaku_glaze'];
    const plain=P.resolve(game,plan),marked=P.resolve(game,plan,[{readingNoteId:n.id},null,null]);
    assert.match(marked.features[0].evidence.connection,/神眼/);
    assert.doesNotMatch(marked.features[0].evidence.connection,/うまみ.*という読み方を使い/);
    assert.deepEqual(plain.settlement,marked.settlement);
    if (hit && type!=='place') {
      const art=ctx.kikoMaybeWrite();
      assert.equal(art.oracleDragonId,'rosso');
      assert.match(art.paras.join(''),/神眼/);
      if(type==='wide')assert.match(art.paras.join(''),/自分でルベル/);
      assert.equal(art.fans,type==='wide'?250:40);
      assert.doesNotMatch(art.paras.join('')+JSON.stringify(ctx.kikoComments(art)),/線がまっすぐ|端っこを見て|ごはんを残して|屋台で一本多く/);
      assert.deepEqual(p.kikoArts[1],published);
    } else assert(!(p.kikoMat||[]).length);
  }
}
const ordinary=fixture('place',['rubel'],'rosso',true);
assert.equal(ordinary.n.oracleDragonId,undefined);
assert.deepEqual(ordinary.p.reasonStats.value,{w:4,l:1});
const unmarked=fixture('win',['rosso'],null,true);
assert.equal(J.normalizeNotes([unmarked.n])[0].oracleDragonId,undefined);
assert.equal(unmarked.ctx.kikoMaybeWrite().oracleDragonId,undefined);
const deferred=fixture('win',['rosso'],'rosso',true);
deferred.p.kikoArts[0].cut='win';
const daily=deferred.ctx.kikoMaybeWrite();
assert.equal(daily.cut,'daily');
assert.equal(daily.oracleDragonId,undefined);
assert.equal(J.normalizeNotes([{...ordinary.n,oracleDragonId:'rosso'}])[0].oracleDragonId,undefined);
const phone=unmarked.ctx.KIKO_STORY_ARTS.phone;
assert.doesNotMatch(phone.h+phone.p.join(''),/買いました|撮って送|一本目/);
assert.doesNotMatch(unmarked.ctx._KIKO_TWEETS.wideHit,/妙味|ワイド当てた/);
console.log('PASS settled oracle tickets preserve old stats and issues; single/place, partial wide hit/miss, unmarked and other picks, paper comments, journal pin/bridge/legacy argument and unchanged accounting');
