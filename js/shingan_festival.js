// The official festival book is a JSON value. The UI owns the save operation.
// Facility capacities, demand and costs below are fictional operating assumptions.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(
    require("./shingan_economy_lab.js"), require("./shingan_prototype_engine.js"),
    require("./shingan_trial_bridge.js"), require("./island_discovery.js"), require("./shingan_recovery.js"), require("./island_life_loop.js"), require("./island_care.js"));
  else root.ShinganFestival = factory(root.ShinganEconomyLab, root.ShinganPrototype, root.ShinganTrialBridge, root.IslandDiscovery, root.ShinganRecovery, root.IslandLifeLoop, root.IslandCare);
})(typeof globalThis === "object" ?globalThis :this, function (settlement, original, bridge, discovery, recovery, life, care) {
  "use strict";
  const copy = x => JSON.parse(JSON.stringify(x));
  const money = n => Math.round(n * 100) / 100;
  const bounded = (n,max) => Number.isSafeInteger(n) ? Math.max(0,Math.min(max,n)) : 0;
  // JSON object member order has no meaning; podium and ticket array order does.
  function sameRecord(a,b) {
    if (a===b) return true;
    if (!a || !b || typeof a!=="object" || typeof b!=="object" || Array.isArray(a)!==Array.isArray(b)) return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length && keys.every(k=>Object.hasOwn(b,k) && sameRecord(a[k],b[k]));
  }
  const catalog = original.getView(original.createState("arrival","coast")).dragons.map(({id,name,trait,note})=>({id,name,trait,note}));
  const ids = catalog.map(d=>d.id), pair = (a,b) => [a,b].sort().join("+");
  const pairs = ids.flatMap((a,i)=>ids.slice(i+1).map(b=>pair(a,b)));
  const categories = [
    ["infra","施設","船の定員",["港の桟橋","谷の橋","石畳の大通り"]],
    ["commerce","商業","注文を受ける売場",["屋台への補助","市場の拡張","百貨店"]],
    ["race","レース","会場の観客席",["増設した観客席","ナイター照明","大競技場"]],
    ["dragon","竜","竜を休ませながら案内できる見学枠",["竜の宿舎","竜の牧場","竜の療養所"]],
    ["public","公共","島民の観戦を支える給水・滞在枠",["井戸","診療所","学校"]],
    ["industry","産業","市場へ供給できる品数",["畑","漁港","工房街"]]
  ];
  const desks = [
    {id:"win",label:"単勝窓口",description:"会場18＋常設窓口6。予言の浸透だけで開催費を払えるか。",cost:24},
    {id:"place",label:"一窓口で単勝・複勝",description:"常設窓口で二着の見立ても紹介する。会場18＋窓口6。",cost:24},
    {id:"mixed",label:"複勝とワイドの二窓口",description:"単勝に加え、二頭を応援する客にも届ける。会場18＋窓口・案内20。",cost:38}
  ];
  const meetings = [
    {id:"weekday",title:"平日・仕事前の朝市",condition:"朝市の客は短い時間で、二着に残る一頭の見立てを聞きたい。"},
    {id:"festival",title:"祭日・連絡船の到着後",condition:"祭日の船には、好きな二頭を一緒に応援したい客が乗っている。"}
  ];
  // Kept separate from the player's scouts, holdings, paper, or desk.
  const courses = [
    {title:"潮風の登り坂",condition:"長い登りから向かい風の短い直線へ。持久力と乱れにくさが生きる。",fit:[7,8,7,5,2,3,2,6]},
    {title:"霧が晴れる峡谷",condition:"前半はゆっくり。長い下りで加速し、先団が入れ替わる。",fit:[4,3,5,6,8,4,3,7]},
    {title:"雲の上の直線",condition:"先行勢が競った後、長い直線が続く。追う側にも届く余地がある。",fit:[6,4,4,2,6,8,7,5]}
  ];
  function capture(player, context) {
    const p = player || {}, cx = context || {}, lv = p.island?.lv || {};
    const taken = bridge.capture(p,{poroFound:cx.poroFound ?? (p.flags?.poroFound === true)});
    const facilities = categories.map(([id,label,role,milestones])=>{
      const level = bounded(lv[id],8);
      return {id,label,role,level,milestone:level ? milestones[level>=8 ? 2 : level>=4 ? 1 : 0] : null};
    });
    const sources = [], known = new Set();
    const arts = [p.kikoArts,p.kikoHof].flatMap(list=>Array.isArray(list) ? list : []);
    for (const a of arts) {
      if (!a || !/^ka\d+$/.test(a.id) || known.has(a.id) || !Number.isSafeInteger(a.race) || a.race<0 ||
        a.race>(p.completedRaces || 0) || typeof a.headline!=="string" || !a.headline.trim() ||
        !Array.isArray(a.paras) || !a.paras.some(t=>typeof t==="string" && t.trim())) continue;
      known.add(a.id);
      sources.push({id:"kiko:"+a.id,label:a.headline,kind:"kiko",detail:"この既刊の読者に当日の開催を知らせる。紀行の印税は開催会計に含めない。"});
    }
    for (const d of taken.discoveries) {
      const description = discovery.describeDiscovery(d), project = description?.plan;
      if (project) sources.push({id:"project:"+d.caseId+":"+project.id,kind:"project",label:project.label,
        facilityId:project.investment,detail:project.detail,caseId:d.caseId});
    }
    // Cosmetic favorites must not erase an honest conversation at a real meal.
    const outings = life && p.islandLife ? life.normalize(p.islandLife) : null;
    const meals = outings ? [outings.firstLocalMeal, outings.firstLocalStory, ...outings.history, ...Object.values(outings.conversations)]
      .filter(e => e?.channel === "in_person" && e.visited && e.visitedSpotId && e.experience?.kind === "meal"
        && p.meals?.eaten?.[e.experience.id] === true && e.completedRace <= (p.completedRaces || 0))
      .sort((a, b) => Number(b.id.slice(7)) - Number(a.id.slice(7))) : [];
    const mealConversation = meals.length ? copy(meals[0]) : null;
    return {facilities,scouted:taken.scouted,notes:taken.readingNotes.filter(n=>n.completedRace<=(p.completedRaces||0)),
      discoveries:taken.discoveries,lifeMemory:taken.lifeMemory,mealConversation,care:care.capture(p),sources};
  }
  function legacyRecord(player) {
    const shingan=player.shingan || {}, entry=shingan.official?.version===1 ? copy(shingan.official) : null;
    const issue=entry?.issue;
    let receipt=null;
    if (issue?.version===1 && issue.course==="coast" && Array.isArray(issue.plan) && issue.plan.length===3 &&
        typeof issue.market==="boolean" && typeof issue.harbor==="boolean" && typeof issue.ferry==="boolean" && issue.harbor!==issue.ferry) {
      const game=original.createState("arrival","coast");
      game.coins=0; game.scouted=ids.slice(); game.prepared={harbor:true,market:issue.market,scout:true};
      game.readingNotes=issue.notes || [];
      const r=original.resolve(game,issue.plan,issue.noteId ? [{readingNoteId:issue.noteId},null,null] : []);
      if (r.valid) receipt=copy({...r,provenance:"official-v1",eventId:"official-v1-coast"});
    }
    return {entry,receipt,legacyCleared:entry ? entry.legacyCleared===true : shingan.cleared===true};
  }
  function restore(player) {
    const p=player || {}, saved=p.shingan?.festival;
    if (!saved) return {version:2,revision:0,sequence:0,active:null,history:[],legacy:legacyRecord(p)};
    if (saved.version!==2 || !Number.isSafeInteger(saved.revision) || saved.revision<0 || !Number.isSafeInteger(saved.sequence) || saved.sequence<0 ||
        !Array.isArray(saved.history) || !saved.legacy) throw Error("開催記録の形式を確認できません。");
    verifySaved(saved);
    return copy(saved);
  }
  function draw(seed, sequence) {
    if (!Number.isInteger(seed) || seed<0 || seed>4294967295) throw Error("開催には新しい抽選値が必要です。");
    let word=(seed ^ Math.imul(sequence,2654435761))>>>0;
    word=Math.imul(word ^ (word>>>16),2246822507)>>>0;
    function roll() { word=(Math.imul(word,1664525)+1013904223)>>>0; return word/4294967296; }
    const course=courses[Math.floor(roll()*courses.length)], meeting=meetings[Math.floor(roll()*2)];
    const field=ids.map((id,i)=>({id,score:course.fit[i]+7*roll()}));
    field.sort((a,b)=>b.score-a.score);
    return {course:copy(course),meeting:{...meeting},oracleId:field[0].id,order:field.map(d=>d.id)};
  }
  function start(record,snapshot,seed) {
    if(ids.some(id=>!snapshot.scouted.includes(id))) throw Error("開催を確定する前に、ポロを含む八頭を取材してください。");
    const sequence=record.sequence+1, drawSeed=typeof seed==="object" && seed ? seed.drawSeed : seed;
    const nonce=typeof seed==="object" && seed ? seed.nonce : Math.imul(drawSeed ^ 0x4ea9bc17,2654435761)>>>0;
    if(!Number.isInteger(nonce) || nonce<0 || nonce>4294967295) throw Error("開催番号を確認してください。");
    return {...record,sequence,revision:record.revision+1,active:{id:"festival-"+sequence+"-"+nonce.toString(36),nonce,rules:2,drawSeed,recoveryPeriods:[],
      field:draw(drawSeed,sequence),snapshot:copy(snapshot),plan:{desk:"win",place:null,wide:[null,null],sourceId:null,readingId:null},
      receipt:null}};
  }
  function open(record,snapshot,seed) {
    if (record.active || record.legacy.receipt?.success || record.legacy.legacyCleared) return record;
    return start(record,snapshot,seed);
  }
  function match(record,eventId) {
    if (!record.active || record.active.id!==eventId) throw Error("開催が切り替わりました。現在の開催を開き直してください。");
    return record.active;
  }
  function edit(record,eventId,patch) {
    const e=match(record,eventId);
    if(e.receipt) throw Error("この開催は発行済みです。");
    const plan={...e.plan}, p=patch || {};
    if ("desk" in p) {
      if (!desks.some(d=>d.id===p.desk)) throw Error("未知の窓口です。");
      plan.desk=p.desk;
    }
    if ("place" in p) {
      if (p.place!==null && !ids.includes(p.place)) throw Error("未知の竜です。");
      plan.place=p.place;
    }
    if ("wide" in p) {
      if (!Array.isArray(p.wide) || p.wide.length>2 || p.wide.some(id=>id!==null && !ids.includes(id))) throw Error("ワイドの入力を確認してください。");
      plan.wide=[p.wide[0] || null,p.wide[1] || null];
    }
    for (const [key,list] of [["sourceId",e.snapshot.sources],["readingId",e.snapshot.notes]]) {
      if (!(key in p)) continue;
      if (p[key]!==null && !list.some(x=>x.id===p[key])) throw Error("この開催には持ち込まれていない記録です。");
      plan[key]=p[key];
    }
    return {...record,revision:record.revision+1,active:{...e,plan}};
  }
  function view(record) {
    const e=record.active;
    const common={version:2,eventId:e?.id || null,revision:record.revision,legacy:record.legacy,history:record.history.map(book=>book.receipt),
      published:!!e?.receipt,lastResult:e?.receipt || null,recoveryRequired:e?.rules===2,desks,oracle:e ? catalog.find(d=>d.id===e.field.oracleId) : null};
    if (!e) return copy({...common,facilities:[],sources:[],notes:[],discoveries:[],lifeMemory:null,dragons:[]});
    const {title,condition,fit}=e.field.course, s=e.snapshot;
    return copy({...common,...s,course:{title,condition},meeting:e.field.meeting,plan:e.plan,
      dragons:catalog.map((d,i)=>({...d,scouted:s.scouted.includes(d.id),
        observation:s.scouted.includes(d.id) ? "当日の区間適性 "+fit[i]+"／8。実走には全頭共通で0以上7未満の揺れがあります。" : null}))});
  }
  function issues(e) {
    const p=e.plan, errors=[];
    if (ids.some(id=>!e.snapshot.scouted.includes(id))) errors.push("ポロを含む八頭の取材が必要です。");
    if (!desks.some(d=>d.id===p.desk) || (p.place!==null && !ids.includes(p.place)) || !Array.isArray(p.wide) ||
      p.wide.length!==2 || p.wide.some(id=>id!==null && !ids.includes(id))) throw Error("不明な予想または窓口が含まれています。");
    if (p.sourceId!==null && !e.snapshot.sources.some(x=>x.id===p.sourceId) ||
      p.readingId!==null && !e.snapshot.notes.some(x=>x.id===p.readingId)) throw Error("当時の取材記録を照合できません。");
    if (p.desk!=="win" && !p.place) errors.push("複勝を一頭選んでください。");
    if (p.desk==="mixed" && !p.wide.every(Boolean)) errors.push("ワイドを二頭選んでください。");
    if (p.wide[0] && p.wide[0]===p.wide[1]) errors.push("ワイドは異なる二頭を選んでください。");
    return errors;
  }
  // The island has a standing ground, a small boat, and local stalls already.
  // A proposed project can coordinate an existing facility for the day. Filing
  // the proposal never constructs it or provides winnings, stock, or a subsidy.
  function operations(e,desk,prophecy) {
    const s=e.snapshot, levels=Object.fromEntries(s.facilities.map(f=>[f.id,f.level]));
    const source=s.sources.find(x=>x.id===e.plan.sourceId);
    const fieldWork=source?.kind==="project" && levels[source.facilityId]>0 ? source.facilityId : null;
    const waterCare=s.care?.waterCarrier?.cost===300;
    const capacity=(id,base,perLevel)=>base+perLevel*levels[id]+(fieldWork===id ? 2 : 0);
    const holiday=e.field.meeting.id==="festival", visitorDemand=(holiday ? 26:12)+(source?.kind==="kiko" ? 3:0);
    const dock=capacity("infra",holiday ? 16:10,2), seats=capacity("race",52,3), water=capacity("public",16,2);
    const tours=Math.min(s.scouted.length,capacity("dragon",0,1));
    const localDemand=(holiday ? 22:18)+tours;
    const locals=Math.min(localDemand,water+tours,seats-20), visitors=Math.min(visitorDemand,dock,seats-20-locals);
    const schedule=desk==="win" ? [[8,0,0],[6,0,0],[4,0,0]] : desk==="place" ?
      [[8,0,0],[3,4,0],holiday?[2,2,0]:[2,6,0]] : [[8,0,0],[2,3,3],holiday?[1,2,6]:[1,4,4]];
    const segments=[[20,20,"faithful","予言を信じる常連"],[locals,localDemand,"locals","推しのいる島の客"],[visitors,visitorDemand,"visitors","船で訪ねる比較客"]]
      .map(([count,potential,id,label],i)=>{
        const [win,place,wide]=schedule[i].map(n=>n*count);
        return {count,potential,away:potential-count,id,label,budgetPerPerson:10,budget:count*10,win,place,wide,shopping:0,unspent:count*10-win-place-wide};
      });
    // Only independently backed, paid orders are revenue. No personal royalty
    // or facility asset value enters this ledger. Additional stock can go unsold.
    const stalls=capacity("commerce",0,6),stock=capacity("industry",8,5);
    let goods=Math.min(stalls,stock,locals+visitors);
    for(const g of segments.slice(1)) {
      g.shopping=Math.min(goods,g.count,g.unspent); g.unspent-=g.shopping; goods-=g.shopping;
    }
    const sold=segments.reduce((sum,g)=>sum+g.shopping,0);
    const commerce={sales:sold,cost:sold/2,net:sold/2,stock,stalls,units:sold};
    const blank=keys=>Object.fromEntries(keys.map(k=>[k,0]));
    const bets={win:blank(ids),place:blank(ids),wide:blank(pairs)},directed={place:0,wide:0};
    function spread(type,list,num,offset) {
      list.forEach((_,i)=>{ bets[type][list[(i+offset)%list.length]]+=Math.floor(num/list.length)+(i<num%list.length ? 1:0); });
    }
    segments.forEach((g,i)=>{
      if (prophecy) bets.win[e.field.oracleId]+=g.win; else spread("win",ids,g.win,i*3);
      for(const [type,list,selection] of [["place",ids,e.plan.place],["wide",pairs,pair(...e.plan.wide)]]) {
        const follow=list.includes(selection) ? Math.floor(g[type]*[0,0.25,0.5][i]) : 0;
        if(follow) bets[type][selection]+=follow;
        directed[type]+=follow; spread(type,list,g[type]-follow,i*3);
      }
    });
    const facts={infra:"船の定員 "+dock+"人。島外の希望者 "+visitorDemand+"人。",
      race:"会場 "+seats+"席。実来場 "+(20+locals+visitors)+"人。",public:"島民の基本滞在枠 "+water+"人。"+(waterCare?"手入れした運び架は、雨の朝市の地元納入に使う。":""),
      dragon:"実取材と竜の施設に基づく見学枠 "+tours+"人。",commerce:"売場は "+stalls+"品まで受付。実売 "+sold+"品。",
      industry:"搬入可能 "+stock+"品。原価は実売1品につき0.5コイン。"};
    return {bets,directed,segments,commerce,cost:desks.find(d=>d.id===desk).cost,
      facilityEffects:s.facilities.map(f=>({id:f.id,label:f.label,detail:facts[f.id]}))};
  }
  function account(b,order) {
    const [a,b2,c]=order;
    const pools={win:settlement.settlePool(b.bets.win,[a]),place:settlement.settlePool(b.bets.place,[a,b2]),
      wide:settlement.settlePool(b.bets.wide,[pair(a,b2),pair(a,c),pair(b2,c)])};
    return {pools,operatingProfit:money(Object.values(pools).reduce((sum,p)=>sum+p.houseNet,0)+b.commerce.net-b.cost)};
  }
  function benchmark(e,prophecy) {
    const b=operations(e,"win",prophecy),win=settlement.settlePool(b.bets.win,[e.field.oracleId]);
    return {segments:b.segments,commerce:b.commerce,cost:b.cost,win,operatingProfit:money(win.houseNet+b.commerce.net-b.cost)};
  }
  function targets(e) {
    const p=e.plan, out=[];
    if(p.place) out.push({type:"place",ids:[p.place],key:p.place});
    if(p.wide.every(Boolean) && p.wide[0]!==p.wide[1]) out.push({type:"wide",ids:p.wide.slice(),key:pair(...p.wide)});
    return out;
  }
  function preview(record) {
    const e=record.active; if(!e) throw Error("開催がありません。");
    const b=operations(e,e.plan.desk,true),errors=issues(e),net={min:Infinity,max:-Infinity},pools={};
    const articles=targets(e).map(t=>({...t,stake:b.bets[t.type][t.key],directedStake:b.directed[t.type],winningOdds:null}));
    const undecided=ids.filter(id=>id!==e.field.oracleId);
    for(const second of undecided) for(const third of undecided) {
      if(second===third) continue;
      const r=account(b,[e.field.oracleId,second,third]);
      net.min=Math.min(net.min,r.operatingProfit); net.max=Math.max(net.max,r.operatingProfit);
      for(const [type,p] of Object.entries(r.pools)) {
        const row=pools[type] || (pools[type]={sales:p.sales,minNet:Infinity,maxNet:-Infinity});
        row.minNet=Math.min(row.minNet,p.houseNet); row.maxNet=Math.max(row.maxNet,p.houseNet);
      }
      for(const a of articles) {
        const odds=r.pools[a.type].odds[a.key];
        if(!odds) continue;
        if(!a.winningOdds) a.winningOdds={min:odds,max:odds};
        else { a.winningOdds.min=Math.min(a.winningOdds.min,odds); a.winningOdds.max=Math.max(a.winningOdds.max,odds); }
      }
    }
    return {ready:!e.receipt && !errors.length,errors,net,pools,articles,segments:b.segments,commerce:b.commerce,cost:b.cost,
      facilityEffects:b.facilityEffects,baseline:benchmark(e,true),beforeOracle:benchmark(e,false)};
  }
  function result(e) {
    const b=operations(e,e.plan.desk,true),order=e.field.order,r=account(b,order);
    const predictions=targets(e).map(t=>({...t,hit:t.ids.every(id=>order.indexOf(id)<(t.type==="place"?2:3)),
      addsInformation:t.type==="wide" || t.key!==e.field.oracleId,stake:b.bets[t.type][t.key],directedStake:b.directed[t.type],
      payout:r.pools[t.type].payouts[t.key] || 0,odds:r.pools[t.type].odds[t.key] || 0}));
    const substantiveHit=predictions.some(p=>p.hit && p.addsInformation && p.directedStake>0);
    const {title,condition}=e.field.course;
    return {...r,provenance:"festival-v2",eventId:e.id,course:{title,condition},meeting:copy(e.field.meeting),oracleId:e.field.oracleId,order:order.slice(),
      plan:copy(e.plan),predictions,substantiveHit,hits:predictions.filter(p=>p.hit).length,success:substantiveHit && r.operatingProfit>=0,
      source:copy(e.snapshot.sources.find(s=>s.id===e.plan.sourceId) || null),
      reading:copy(e.snapshot.notes.find(n=>n.id===e.plan.readingId) || null),
      segments:b.segments,commerce:b.commerce,cost:b.cost,facilityEffects:b.facilityEffects,stakes:b.bets,
      baseline:benchmark(e,true),beforeOracle:benchmark(e,false)};
  }
  function publish(record,eventId,expectedRevision) {
    const e=match(record,eventId);
    if(e.receipt) return record;
    if(expectedRevision!==record.revision) throw Error("下書きが更新されています。読み込み直してください。");
    const errors=issues(e); if(errors.length) throw Error(errors.join(" "));
    return {...record,revision:record.revision+1,active:{...e,receipt:result(e)}};
  }
  function next(record,eventId,snapshot,seed) {
    const e=match(record,eventId);
    if(!e.receipt || e.receipt.success) throw Error("未発行または成功した開催はここから差し替えられません。");
    return start({...record,history:[...record.history,copy(e)]},snapshot,seed);
  }
  // The first festival and all earlier attempts belong to the same books.
  // No dividend, unused visitor budget, or hypothetical baseline is spendable.
  function seasonView(books,e,rows,snapshot) {
    const opening=recovery.opening([...books.map(book=>book.receipt),e.receipt]);
    return recovery.view(opening,rows,snapshot);
  }
  function recoveryView(record,snapshot) {
    const e=record.active;
    if(e?.rules!==2 || !e.receipt?.success) return {required:false,complete:false};
    return copy(seasonView(record.history,e,e.recoveryPeriods.map(p=>p.receipt),snapshot || e.snapshot));
  }
  function quoteRecovery(record,plan,snapshot) {
    const e=record.active, s=snapshot || e?.snapshot;
    const v=recoveryView(record,s);
    if(!v.required || v.complete) throw Error("いま受け付けている再建の期はありません。");
    const q=recovery.quote(v,plan,s);
    // Only the timetable is public. Examine every valid podium; do not use
    // the future draw or reveal its oracle to compute a business forecast.
    let low=Infinity,high=-Infinity,locals=0,visitors=0,away=0;
    if(plan.desk!=="market") {
      const meeting=meetings.find(m=>m.id===v.meeting);
      for(const first of ids) {
        const projected={snapshot:s,field:{meeting,oracleId:first},plan:{desk:plan.desk,place:null,wide:[null,null],sourceId:null}};
        const b=operations(projected,plan.desk,true);
        locals=b.segments[1].count; visitors=b.segments[2].count;
        away=b.segments.reduce((sum,g)=>sum+g.away,0);
        for(const second of ids) for(const third of ids) {
          if(first===second || first===third || second===third) continue;
          const net=Math.round(account(b,[first,second,third]).operatingProfit*1000);
          low=Math.min(low,net); high=Math.max(high,net);
        }
      }
    } else {low=0;high=0;}
    const tradeNet=q.revenue-q.goodsCost-q.freight,interest=Math.ceil((v.debt+q.draw)/100);
    return {...q,tradeNet,raceOutlook:{min:low,max:high,locals,visitors,away},
      netOutlook:{min:low+tradeNet-interest-q.standingCost,max:high+tradeNet-interest-q.standingCost}};
  }
  function runPeriod(e,v,plan,s) {
    const q=recovery.quote(v,plan,s);
    let race=null;
    if(plan.desk!=="market") {
      // The race is a subsequent meeting, with its own field. The committee
      // opens markets to independent buyers; it does not publish new Mimi tips.
      const field=draw((e.drawSeed^0x79b92341)>>>0,v.period);
      field.meeting=meetings.find(m=>m.id===v.meeting);
      const projected={snapshot:s,field,plan:{desk:plan.desk,place:null,wide:[null,null],sourceId:null}};
      const b=operations(projected,plan.desk,true), a=account(b,field.order);
      const coin=x=>Math.round(x*1000);
      const pools=Object.fromEntries(Object.entries(a.pools).map(([id,p])=>[id,
        {sales:coin(p.sales),payout:coin(p.payout),houseNet:coin(p.houseNet)}]));
      race={operatingProfit:coin(a.operatingProfit),order:field.order,oracleId:field.oracleId,meeting:field.meeting.id,
        course:field.course.title,pools,commerceNet:coin(b.commerce.net),cost:coin(b.cost),
        locals:b.segments[1].count,visitors:b.segments[2].count};
    }
    return recovery.settle(v,q,race);
  }
  function settleRecovery(record,eventId,revision,plan,snapshot) {
    const e=match(record,eventId),s=snapshot || e.snapshot,v=recoveryView(record,s);
    if(revision!==record.revision) throw Error("契約の帳簿が更新されています。読み込み直してください。");
    if(!v.required || v.complete) throw Error("現在、新しい期を契約できません。");
    const receipt=runPeriod(e,v,plan,s);
    return {...record,revision:revision+1,active:{...e,recoveryPeriods:[...e.recoveryPeriods,{snapshot:copy(s),receipt}]}};
  }
  // Rules 1 must stay available for already issued books. A future balance
  // change must add a new rules number rather than re-rate these editions.
  function verifySaved(record) {
    if (record.sequence!==record.history.length+(record.active ? 1:0)) throw Error("開催の通し番号が一致しません。");
    const books=record.active ? [...record.history,record.active] : record.history;
    for (const [i,e] of books.entries()) {
      if(![1,2].includes(e.rules) || !Number.isInteger(e.nonce) || e.nonce<0 || e.nonce>4294967295 || e.id!=="festival-"+(i+1)+"-"+e.nonce.toString(36) ||
        !sameRecord(draw(e.drawSeed,i+1),e.field)) throw Error("開催の抽選記録を照合できません。");
      if(i<record.history.length && !e.receipt) throw Error("未発行の過去号です。");
      if(e.receipt && (issues(e).length || !sameRecord(result(e),e.receipt))) throw Error("発行時の予想と開催会計が一致しません。");
      if(e.rules===1) {
        if(Object.hasOwn(e,"recoveryPeriods")) throw Error("旧号と再建の契約記録が混在しています。");
      } else {
        if(!Array.isArray(e.recoveryPeriods) || (e.recoveryPeriods.length && !e.receipt?.success)) throw Error("再建の開始号を照合できません。");
        const rows=[];
        for(const p of e.recoveryPeriods) {
          const v=seasonView(books.slice(0,i),e,rows,p.snapshot);
          if(v.complete || !sameRecord(runPeriod(e,v,p.receipt.plan,p.snapshot),p.receipt)) throw Error("再建の受注・入出金が一致しません。");
          rows.push(p.receipt);
        }
      }
    }
    if(record.legacy.entry?.issue || record.legacy.receipt) {
      const verified=legacyRecord({shingan:{official:record.legacy.entry}}).receipt;
      if(!sameRecord(copy(verified),record.legacy.receipt)) throw Error("旧号の発行記録を照合できません。");
    }
  }
  function outcome(record) {
    verifySaved(record);
    if(record.active?.rules===2 && record.active.receipt?.success) {
      const v=recoveryView(record);
      return copy({...record.active.receipt,daySuccess:true,success:v.complete,
        recovery:{complete:v.complete,periods:v.history.length,cash:v.cash,debt:v.debt,arrears:v.arrears,reserve:v.reserve}});
    }
    return copy(record.active?.receipt || record.legacy.receipt || null);
  }
  return {capture,restore,open,view,edit,preview,publish,next,outcome,recoveryView,quoteRecovery,settleRecovery};
});
