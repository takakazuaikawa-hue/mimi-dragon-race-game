'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c=vm.createContext({console,document:{addEventListener(){}},state:{player:{coins:1234,collection:{}}}});c.window=c;
for(const f of ['data_dragons','data_dragons_ext','scout_stalk'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+f+'.js'),'utf8'),c,{filename:f});
const run=s=>vm.runInContext(s,c);
const before=run('JSON.stringify(state)');
const rows=JSON.parse(run('JSON.stringify(DRAGONS.map(d=>({id:d.id,set:stalkTalkSet(d.id),first:stalkTalkObservation(d.id,false),again:stalkTalkObservation(d.id,true)})))'));
assert(rows.length>40);
for(const row of rows){
 assert.equal(new Set(row.set.picks).size,3,row.id);
 assert(row.set.answer>=0&&row.set.answer<3,row.id);
 assert(row.first.length>8&&row.again.length>8,row.id);
 assert.notEqual(row.first,row.again,row.id);
 assert.doesNotMatch(row.first+row.again,/正解|ハズレ|勝たせ|負けて|八百長/);
}
assert.equal(run('JSON.stringify(state)'),before);
for(const last of [undefined,null,-1,3,0,1,2]){
 c.__last=last;
 for(const roll of [0,.25,.5,.99999]){
  c.__roll=roll;const next=run('stalkMapIndex(__last,__roll)');
  assert([0,1,2].includes(next));
  if(Number.isInteger(last)&&last>=0&&last<3)assert.notEqual(next,last,'including map zero and a reloaded last-map record');
 }
}
assert.equal(run('JSON.stringify(state)'),before,'selecting a map is pure; only starting a session remembers it');
run(`chapterRead=id=>id==='5'; SHINGAN_ROSTER=[{id:'raiou'},{id:'poro'}];
 dragonById=id=>DRAGONS.find(d=>d.id===id);scoutDragonHome=()=> 'sky';scoutLocationUnlocked=()=>true;`);
assert.equal(run('stalkReportTarget("poro")'),null);
assert.equal(run('stalkReportTarget("unknown")'),null);
assert.equal(run('stalkReportTarget("raiou").locId'),'sky');
assert.equal(run('state.player.coins'),1234);
run('state.player.collection.raiou={scouted:true}');
assert.equal(run('stalkReportTarget("raiou")'),null);
run('state.player.collection={};chapterRead=()=>false');
assert.equal(run('stalkReportTarget("raiou")'),null);
console.log('PASS '+rows.length+' stable topic sets with public behaviour before choice and clearer repeat observation; no state writes; map choice uses existing boards without adjacent repeats; fifth-only report targets reject unknown, companion and already-scouted dragons without charging');
