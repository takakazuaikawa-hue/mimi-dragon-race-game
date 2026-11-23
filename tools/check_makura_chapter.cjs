const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag, css, text) {
    this.tag = tag;
    this.textContent = text || '';
    this.children = [];
    this.style = {};
    this.classList = { add() {}, toggle() {} };
  }
  setAttribute(key, value) { this[key] = value; }
  appendChild(node) { this.children.push(node); node.parent = this; return node; }
  replaceChildren() { this.children = []; }
  remove() { this.parent.children = this.parent.children.filter(n => n !== this); }
  walk() { return [this, ...this.children.flatMap(n => n.walk())]; }
}
function game() {
  const ctx = vm.createContext({
    console, document: { body: new Element('body'), createElement: tag => new Element(tag), createTextNode: s => new Element('#text', null, s), querySelector: () => null, addEventListener() {} },
    setTimeout() {}, requestAnimationFrame() {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  });
  ctx.window = ctx;
  const run = s => vm.runInContext(s, ctx);
  for (const file of ['data_dragons','data_assets','state','event_hooks','assets_engine','meals','sns','data_dialogue','ui_render','ui_sns','ui_meta']) {
    const src = fs.readFileSync(path.resolve(__dirname,'../js',file+'.js'),'utf8');
    vm.runInContext(src,ctx,{ filename:file+'.js' });
  }
  ctx.el = (tag, css, text) => new Element(tag, css, text);
  run(`state.player={coins:10000,flags:{_chapter_intro_4:true,metMakura:true},collection:{},assetsPeak:100000000};
    saveGame=()=>{}; renderHome=()=>{}; renderSns=()=>{}; showInfoPopup=()=>{};`);
  const find = (box, text) => box.walk().find(n => n.textContent.includes(text));
  return { ctx, run, find };
}
test('the double tap stays a single paid purchase throughout the VN, including its old timeout window', async () => {
  const {ctx,run} = game();
  const pending = [];
  ctx.Dialogue = { play: () => new Promise(resolve => pending.push(resolve)) };
  const done = run('buyPhoneAndGoLive()');
  run('buyPhoneAndGoLive()');
  assert.equal(pending.length,1);
  pending[0]();
  await done;
  run('buyPhoneAndGoLive()');
  assert.equal(run('state.player.coins'),7000);
  assert.equal(run('getStoryFlag("phoneBought")'),true);
});
test('interrupted or obsolete quotes cannot charge a different save or a changed wallet', async () => {
  const {ctx,run} = game();
  const pending = [];
  ctx.Dialogue = { play: () => new Promise((resolve,reject) => pending.push({resolve,reject})) };
  const discarded = run('buyPhoneAndGoLive()');
  run('state.player.flags={};state.player.coins=4000');
  const fresh = run('buyPhoneAndGoLive()');
  pending[0].resolve(); await discarded;
  assert.equal(run('state.player.coins'),4000);
  pending[1].reject(new Error('interrupted')); await fresh;
  assert.equal(run('getStoryFlag("phoneBought")'),false);
  const changed = run('buyPhoneAndGoLive()');
  run('state.player.coins=100');
  pending[2].resolve(); await changed;
  assert.equal(run('getStoryFlag("phoneBought")'),false);
  const supported = run('buyPhoneAndGoLive()');
  pending[3].resolve(); await supported;
  assert.equal(run('state.player.coins'),100);
  assert.equal(run('getStoryFlag("phoneBought")'),true);
});
test('an actual photo and its own response are read before the next chapter, and survive the forty-post cutoff', () => {
  const {ctx,run,find} = game();
  run('state.player.flags.phoneBought=true; state.player.collection.rubel={scouted:true}; snsSyncCamera(); _igCompose()');
  const form = ctx.document.body;
  const caption = form.walk().find(n => n.tag === 'textarea');
  const choices = form.walk().filter(n => n.tag === 'button' && n['aria-label']);
  assert(!choices.some(n => n['aria-label'].includes('フガク')));
  const dragon = choices.find(n => n['aria-label'].includes('ルベル'));
  dragon.onclick();
  assert.equal(caption.value,dragon['aria-label']);
  caption.value = '<自分で書いた>坂で立ち止まった子';
  choices[0].onclick(); dragon.onclick();
  assert.equal(caption.value,'<自分で書いた>坂で立ち止まった子');
  find(form,'シェアする').onclick();
  assert.equal(run('myPosts().length'),1);
  assert.equal(run('chapterAvailable("5")'),false);
  const desk = ctx.desk = new Element('main');
  run('appendMakuraPostDesk(desk)');
  const select = desk.walk().find(n => n.tag === 'select');
  select.value = select.children[0].value;
  find(desk,'この投稿に届いた反応を').onclick();
  assert(find(desk,'<自分で書いた>坂で立ち止まった子'));
  assert(find(desk,'この投稿への反応 '+run('myPostReacts(myPosts()[0])')+'件'));
  assert(find(desk,'ルベルの名前'));
  assert(run('chapterAvailable("5")'));
  run('for(let i=0;i<41;i++)addMyPost("別の写真",SNS_CAMERA[1].img)');
  assert(!run('myPosts().some(p=>p.id===state.player.makuraPostMemory.id)'));
  assert(run('chapterAvailable("5")'));
  run('state.player.flags.phoneBought=false');
  assert.equal(run('chapterAvailable("5")'),false);
  run('state.player.flags._chapter_intro_5=true');
  assert(run('chapterAvailable("5")'));
});
test('existing genuine captions work, unknown identifiers, dates, empty text and unrelated feed posts do not', () => {
  const {run} = game();
  run('snsSyncCamera(); const post=addMyPost("以前の島便り",SNS_CAMERA[1].img);');
  assert(run('validMakuraPost(post)'));
  assert(run('validMakuraPost({id:post.id,text:post.text,day:post.day}) && makuraPostSubject({id:post.id,text:post.text,day:post.day}).kind==="text"'));
  for (const patch of ['{id:"other"}','{img:"unknown.png"}','{text:"　 "}','{day:post.day+9,id:"my_"+(post.day+9)+"_1"}','{source:{version:1,spotId:"unknown",kind:"photo"}}']) {
    assert.equal(run('validMakuraPost({...post,...'+patch+'})'),false,patch);
  }
  for(const id of ['3','4','5']) {
    const script = run('DLG.chapterIntro({id:"'+id+'"})');
    const lines = script.map(l=>l.t).join('');
    assert(lines.includes(({3:'雨戸',4:'フガク',5:'灯油'})[id]));
  }
});

test('an eaten dish with no map spot can be published and reviewed; other saves, invented locations and free captions earn no proof', () => {
  const {run} = game();
  run("state.player.meals={eaten:{t_yakitori:true}}; state.player.flags.phoneBought=true;");
  run("var dish = MEALS.find(m=>m.id==='t_yakitori'), picture = addMyPost('別の味も試したい',dish.photo,{kind:'meal',id:dish.id});");
  assert.equal(run('picture.source'),undefined);
  assert.equal(run('picture.subject.id'),'t_yakitori');
  assert.equal(run('makuraPostSubject(picture).kind'),'gourmet');
  assert.equal(run('makuraPostSubject({...picture,subject:{kind:"meal",id:"t_ramen"}})'),null);
  assert.equal(run('picture.text'),'別の味も試したい');
  run("state.player.makuraPostMemory={id:picture.id,day:picture.day,img:picture.img,text:picture.text,reacts:2}");
  assert(run('makuraPostReviewed()'));
  assert(!run('makuraPostReviewed({...state.player, meals:{solved:{t_yakitori:true},eaten:{}}})'));
  run('delete state.player.meals.eaten.t_yakitori');
  assert(!run('validMakuraPost(picture)'));
  assert(!run('makuraPostReviewed()'));
});
test('loading a complete old save replaces the prior island, preserves debt and unlocks, and settles only its pending ticket', () => {
  const store = new Map();
  const c = vm.createContext({console, localStorage: {getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}});
  const run = s => vm.runInContext(s,c);
  for(const file of ['state','assets_engine','event_hooks']) run(fs.readFileSync(path.resolve(__dirname,'../js',file+'.js'),'utf8'));
  run(`const previous=state.player;
    Object.assign(previous,{coins:10000,pendingPayout:9999,shingan:{festival:{version:2}},islandLife:{},islandDiscovery:{},
      makuraPostMemory:{text:"前の人"},sns:{myPosts:[{}]}, flags:{phoneBought:true}});
    state.current={bet:{}}; state.assets.lifeItems.push("旧住居"); state.lifeTree.unlocked.test=true; state.ui.infoLevel="expert";
    localStorage.setItem(SAVE_KEY,JSON.stringify({player:{coins:4200,totalAssets:9000000,pendingPayout:50,
      village:{name:"泣き虫ドラゴン村"},outfitsBought:["jungle"],wins:1,flags:{_chapter_intro_2:true,gameCleared:true}}}));`);
  assert(run('loadGame()'));
  assert.equal(run('previous===state.player'),false);
  for(const key of ['shingan','islandLife','islandDiscovery','makuraPostMemory','sns']) assert.equal(run('state.player.'+key),undefined,key);
  assert.equal(run('state.player.coins'),4250);
  assert.equal(run('state.player.maxCoinsReached'),4250);
  assert.equal(run('state.player.assetsPeak'),9000000);
  assert.equal(run('state.player.village.name'),'竜の村');
  assert(run('state.player.outfitsBought.includes("jungle") && state.player.outfitsBought.includes("buniqro")'));
  assert(run('mimiDebtLeft()===0 && getStoryFlag("gameCleared") && !getStoryFlag("phoneBought")'));
  assert(run('state.current===null && state.assets.lifeItems.length===0 && !state.lifeTree.unlocked.test && state.ui.infoLevel==="standard"'));
  run('saveGame();loadGame()');
  assert.equal(run('state.player.coins'),4250);
  assert.equal(run('state.player.pendingPayout'),0);
});
test('a migrated three-selection success retains its original paper, while a V2 result describes its actual desk', () => {
  const {run}=game();
  run('state.player.shingan={cleared:true,festival:{version:2,legacy:{legacyCleared:false}}};let receipt=null;ShinganOfficial={getOutcome:()=>receipt};');
  assert.equal(run('storyEndingNarrative().kind'),'neutral');
  run('receipt={success:true,provenance:"official-v1"}');
  assert(run('storyEndingNarrative().body.includes("三つの予想")'));
  run('receipt={success:true,provenance:"festival-v2"}');
  assert(run('storyEndingNarrative().body.includes("この窓口") && !storyEndingNarrative().body.includes("三つの予想")'));
  run('receipt={success:false};state.player.shingan.festival.legacy.legacyCleared=true');
  assert.equal(run('storyEndingNarrative().kind'),'legacyTie');
});

test('feed and stories never publish on behalf of the new phone owner, even after milestones; a chosen post appears once', () => {
  const {ctx,run}=game();
  ctx.feed = new Element('main');
  run(`state.player.flags.phoneBought=true; state.player.completedRaces=12;
    const captured=[]; _igPost=po=>{captured.push(po);return el('div');};
    _igFeed(feed); const mine=()=>captured.filter(p=>p.handle==="@mimi_yosou");`);
  assert.equal(run('mine().length'),0);
  assert(!ctx.feed.walk().some(n => (n.innerHTML || '').includes('>mimi<')));
  assert(run('SNS_DAILY.concat(SNS_POSTS).every(p=>!["@mimi_yosou","@poro_naki"].includes(p.handle))'));
  run('state.player.flags.poroFound=true; snsData().readLetters.l_poro=true; snsData().reacts.p_thanks="like"; snsSyncCamera(); const post=addMyPost("この旗の子を応援したい",SNS_CAMERA[0].img); captured.length=0; feed.replaceChildren(); _igFeed(feed);');
  assert.equal(run('mine().length'),1);
  assert(run('mine()[0].id===post.id && mine()[0].text===post.text'));
  assert(!ctx.feed.walk().some(n => /代筆・ミミ|>mimi</.test(n.innerHTML || '')));
  assert(run('postReact("p_thanks")==="like" && letterRead("l_poro")'));
  assert(!run('fanLetters().some(l=>l.id==="l_poro")'));
  run('state.player.flags._dly_day_l_poro--');
  assert(run('fanLetters().some(l=>l.id==="l_poro" && l.from==="鑑定所" && l.body.includes("ムラサキマルチビ竜") && !l.body.includes("グルメレース"))'));
  assert(!run('fanLetters().find(l=>l.id==="l_first").body.includes("毎回")'));
});
test('rival distinguishes an actual published race article from having raced, a shopping column and an impossible record', () => {
  const {run}=game();
  run('state.player.completedRaces=3; const rival=()=>_snsText(SNS_DAILY.find(p=>p.id==="d_rival").text); const art={id:"ka2",cut:"lose",race:2,headline:"坂で追いつけなかった",paras:["次は下りも見よう。"]};');
  for(const list of ['[]','[{...art,cut:"outfit"}]','[{...art,race:4}]','[{...art,paras:[]}]','[{...art,id:"unknown"}]']){
    run('state.player.kikoArts='+list);
    assert(run('!rival().includes("紀行")'));
  }
  run('state.player.kikoArts=[art]');
  assert(run('rival().includes("敗戦記")'));
  run('state.player.kikoArts=[{...art,cut:"bigwin"}]');
  assert(run('rival().includes("当てた一戦")'));
});
