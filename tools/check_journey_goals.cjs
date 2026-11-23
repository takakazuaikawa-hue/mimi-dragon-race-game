const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function fresh(){
 const store={},noop=()=>{};
 const ctx=vm.createContext({console,setTimeout:noop,clearTimeout:noop,requestAnimationFrame:noop,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
  document:{querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},classList:{add:noop,remove:noop}})}});
 ctx.window=ctx;ctx.globalThis=ctx;
 for(const f of ['utils','data_dragons','data_dragons_ext','data_ranks','data_races','data_assets','state','assets_engine','event_hooks','lifetree_engine','goals','progression','shingan_race','epilogue_engine','poro','data_chapters'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f});
 vm.runInContext('resetGame()',ctx);return ctx;
}
const run=(c,s)=>vm.runInContext(s,c);
for(const [chapter,expected] of [['2','readCh2'],['3','readCh3'],['4','meetMakura'],['5','meetCelestia']]){
 const c=fresh();c.__chapter=chapter;
 run(c,'chapterApply(__chapter,{read:false});state.player.flags.firstWideHit=false;state.player.kikoFans=0;if(__chapter!=="5")state.player.flags.phoneBought=false');
 const before=run(c,'JSON.stringify(state)');assert.equal(run(c,'nextGoal().id'),expected);assert.equal(run(c,'JSON.stringify(state)'),before);
 run(c,'__opened=null;renderStoryChapter=id=>__opened=id;renderStory=()=>__opened="list";nextGoal().go()');
 assert.equal(c.__opened,chapter);
}
{
 const c=fresh();assert.equal(run(c,'nextGoal().id'),'readCh1');
 run(c,'setStoryFlag("_chapter_intro_1",true)');assert.equal(run(c,'nextGoal().id'),'firstRace');
 run(c,'state.player.completedRaces=1;state.player.coins=1500;state.player.maxCoinsReached=1500;mallUnlocked=()=>true');
 assert.equal(run(c,'nextGoal().id'),'firstOutfit');
 run(c,'setStoryFlag("celestiaStrangerSeen",true)');
 assert.equal(run(c,'goalDone(GOALS.find(g=>g.id==="meetCelestia"))'),false);
}
{
 const c=fresh();
 run(c,'chapterApply("3",{read:true});const route=GOALS.find(g=>g.id==="meetMakura");__opened=null;renderStory=()=>__opened="list"');
 assert.equal(run(c,'chapterAvailable("4")'),false);
 run(c,'route.go()');assert.equal(c.__opened,"list");
 run(c,'renderChapterThreeJourney=()=>__opened="journey";route.go()');assert.equal(c.__opened,"journey");
 assert.equal(run(c,'route.directIf()'),true);
}
// Run the actual grant path: dialogue order changes, reward timing and wallet do not.
(async()=>{
 for(const met of [false,true]){
  const c=fresh(),src=fs.readFileSync(path.join(root,'js/ui_render.js'),'utf8');
  vm.runInContext(src.slice(src.indexOf('function sakeOutfitGiftScript'),src.indexOf('// 🛍️ モール開通のお祝いVN')),c);
  c.__met=met;c.__scripts=[];
  run(c,'setStoryFlag("_chapter_intro_1",__met);state.current={bet:{selections:[DRAGONS[0].id]},raceResult:{entries:[{dragon:DRAGONS[0]}]}};Dialogue={play:s=>{__scripts.push(s);return Promise.resolve()}};wearOutfit=id=>state.player.outfit=id');
  const coins=run(c,'state.player.coins');assert.equal(run(c,'playSakeOutfitGiftVN()'),true);
  assert.equal(run(c,'state.player.outfitsWon.filter(id=>id==="jungle").length'),1);
  await Promise.resolve();await Promise.resolve();
  assert.equal(run(c,'playSakeOutfitGiftVN()'),false);assert.equal(run(c,'state.player.coins'),coins);
  assert.equal(run(c,'state.player.outfit'),'jungle');
  if(met)assert.equal(run(c,'__scripts[0].some(l=>l.t.includes(DRAGONS[0].name))'),true);
  else{assert.equal(run(c,'__scripts.flat().filter(l=>l.s==="sake").every(l=>l.name==="門前の女")'),true);assert.equal(run(c,'__scripts.flat().some(l=>l.t.includes("サケさん"))'),false);assert.equal(run(c,'chapterRead("1")'),false);}
 }
 console.log('PASS canonical chapter priority over side goals, direct chapter entry, anonymous cameo not chapter completion, affordable outfit timing, first-race gift dialogue/provenance, one grant and unchanged wallet');
})().catch(e=>{console.error(e);process.exit(1)});
