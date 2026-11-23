// Seasonal island-festival contracts, settled in whole main-game coins.
// A period covers a seasonal delivery contract and one possible public meeting.
(function(root,factory) {
  if(typeof module==="object" && module.exports) module.exports=factory();
  else root.ShinganRecovery=factory();
})(typeof globalThis==="object"?globalThis:this,function(){
  "use strict";
  const reserve=24000, creditLimit=48000, depotCostPerDay=1500;
  const seasons=[
    {label:"春・朝市",condition:"仕事前の朝市。地元の予約を受けやすく、船荷は少なめ。",meeting:"weekday",days:4,locals:7,visitors:5,boat:5},
    {label:"夏・祭日の連絡船",condition:"連絡船が増え、祭日の客は持ち帰れる瓶詰めを求める。島の朝市の食材予約は少ない。",meeting:"festival",days:4,locals:3,visitors:12,boat:9},
    {label:"秋・雨の朝市",condition:"雨のため朝市へ運べる食材は通常一便四口。飲み水の経路を確かめていれば、迂回して届けられる。",meeting:"weekday",days:3,locals:8,visitors:6,boat:4},
    {label:"冬・寄港市",condition:"祭日の寄港市。冬支度の食材と、島外に持ち帰る瓶の注文が重なる。",meeting:"festival",days:3,locals:7,visitors:9,boat:6}
  ];
  const desks=[
    {id:"place",label:"複勝も扱う一窓口",detail:"単勝・複勝。開催前に24,000コインが必要。",available:true},
    {id:"mixed",label:"ワイドも扱う二窓口",detail:"単勝・複勝・ワイド。開催前に38,000コインが必要。",available:true},
    {id:"market",label:"受注した品の引渡しに専念する",detail:"今季の競走を休み、仕入と納入で運転資金をつなぐ。",available:true}
  ];
  function opening(receipts) {
    const gross=receipts.reduce((sum,r)=>sum+Math.round(r.operatingProfit*1000),0);
    return {days:receipts.length,net:gross,cash:Math.max(0,gross),arrears:Math.max(0,-gross),
      debt:0,bottles:0,salvaged:0,packedStock:0};
  }
  function options(s) {
    const known=new Set(s.discoveries.map(d=>d.caseId));
    return {desks,contracts:[
      {id:"local",label:"市場の屋台へ予約の食材を納める",detail:"顔を合わせて受け取る小口注文。確実に渡す分の前金で仕入れる。",available:true},
      {id:"ferry",label:"工房の果実酢を連絡船へ",detail:"新瓶は島外から仕入れる。瓶代、梱包、船賃を引いて注文を引き受ける。",available:true},
      {id:"return",label:"港の戻り瓶を仕分けて工房へ",detail:"島で確かめた受渡しを実行する。戻り瓶は洗って再利用し、不足分だけ新瓶を輸入する。",available:known.has("trade")}
    ]};
  }
  function view(open,history,s) {
    const previous=history.at(-1), n=history.length, current=seasons[n%seasons.length];
    const balances=previous || open, recent=history.slice(-seasons.length);
    const both=["weekday","festival"].every(type=>recent.some(r=>r.meeting===type && r.plan.desk!=="market"));
    const periodNet=recent.reduce((sum,r)=>sum+r.net,0);
    const complete=n>=seasons.length && both && periodNet>0 && balances.debt===0 && balances.arrears===0 && balances.cash>=reserve;
    return {required:true,complete,period:n+1,periodLabel:current.label,condition:current.condition,meeting:current.meeting,
      cash:balances.cash,debt:balances.debt,arrears:balances.arrears,bottles:balances.bottles,salvaged:balances.salvaged,packedStock:balances.packedStock,
      reserve,creditLimit,periodNet,opening:open,choices:options(s),history,last:previous || null,
      previousPlan:previous?.plan || {desk:"place",contract:"local"},partnerReply:previous?.partnerReply || "",
      remaining:[n<seasons.length?"春から冬まで四季の営業を見届ける":null,!both?"直近四季に平日と祭日の窓口を両方開く":null,
        periodNet<=0?"直近四季の通年収支を黒字にする":null,balances.debt||balances.arrears?"借入と未払を返す":null,
        balances.cash<reserve?"次回一窓口の運転資金24,000コインを残す":null].filter(Boolean)};
  }
  function quote(v,plan,s) {
    const day=seasons[(v.period-1)%seasons.length];
    if(!v.choices.desks.some(x=>x.id===plan.desk) || !v.choices.contracts.some(x=>x.id===plan.contract && x.available)) throw Error("受けられる窓口と受渡し契約を選んでください。");
    const levels=Object.fromEntries(s.facilities.map(f=>[f.id,f.level])), known=new Set(s.discoveries.map(d=>d.caseId));
    const local=plan.contract==="local", returns=plan.contract==="return", wet=day===seasons[2];
    const meal=s.mealConversation?.experience?.kind==="meal" && s.mealConversation.channel==="in_person" && s.mealConversation.visited;
    const waterCare=known.has("water") && s.care?.waterCarrier?.cost===300;
    const notes=[];
    if(local && meal) notes.push({
      again:"店で『また、これがいい』と話した一皿を手がかりに、店が小口の予約を案内する。",
      different:"店で『別の方が合いそう』と話した感想も活かし、味を選んで頼める小口の予約を案内する。",
      unsure:"店で『まだ、決めないでおく』と話したことから、食材を確かめてから頼める小口の予約を案内する。"
    }[s.mealConversation.opinion]);
    if(local && known.has("water") && wet) notes.push("調査で確かめた飲み水の道で、雨の日も二口ずつ受渡しを続ける。");
    if(local && waterCare && wet) notes.push("水番と有料で手入れした運び架で、雨の日の受渡しを営業日ごとにもう一口増やす。");
    if(!local && known.has("history")) notes.push("古布と護岸の潮位の印を確かめた経験で、船積みの時間を合わせる。");
    if(returns) notes.push("工房の受取帳と照合し、港の回収瓶を洗浄してから詰める。");
    const days=day.days;
    const demand=days*(local?day.locals+(meal?2:0)+levels.commerce:day.visitors+Math.min(3,s.sources.filter(x=>x.kind==="kiko").length));
    const supply=days*((local?7:9)+levels.industry+(local?levels.public:0));
    const packing=days*(local?(wet?4:7)+levels.commerce+(known.has("water") && wet?2:0)+(waterCare&&wet?1:0):day.boat+levels.infra+(known.has("history")?2:0));
    // A grower supplies a seasonal lot; undelivered fresh food has no resale
    // value. Sealed vinegar survives and fills subsequent export orders first.
    const ordered=demand,reservedStock=local?0:Math.min(v.packedStock,ordered);
    const produced=Math.min(ordered-reservedStock,supply), deliverable=Math.min(produced+reservedStock,packing);
    const fromStock=Math.min(deliverable,reservedStock);
    const carry=local?v.packedStock:v.packedStock+produced-deliverable;
    if(local) notes.push("屋台の食材は季の注文に合わせて収穫する。荷受けに間に合わなかった食材に売上はつかない。");
    else notes.push("倉庫で待つ封済みの酢から先に納める。船に載り切らない瓶は次の季へ持ち越す。");
    const collected=returns?Math.min(8-v.salvaged,days*2):0;
    const reused=returns?Math.min(produced,v.bottles+collected):0, imported=local?0:produced-reused;
    const unitPrice=local?1000:1500, unitCost=local?500:550;
    const goodsCost=produced*unitCost+imported*400+reused*90;
    const freight=local?days*500:days*900;
    const setup=plan.desk==="market"?0:plan.desk==="mixed"?38000:24000;
    // Only committed, deliverable orders can finance stock. Remaining
    // requests are shown as unmet demand and never treated as sales or cash.
    const shopAdvance=deliverable*(local?unitPrice:500);
    const fundedStock=Math.min(shopAdvance,goodsCost+freight);
    const draw=Math.max(0,setup+goodsCost+freight-fundedStock-v.cash);
    return {plan:{desk:plan.desk,contract:plan.contract},demand,serviceDays:days,ordered,supply,produced,deliverable,unitPrice,unitCost,
      goodsCost,shopAdvance,setup,freight,standingCost:days*depotCostPerDay,draw,creditLimit,operates:v.debt+draw<=creditLimit,notes,fromStock,packedStock:carry,
      opening:v.cash,openingDebt:v.debt,openingArrears:v.arrears,missed:ordered-deliverable,imported,reused,collected,
      buyerBudget:ordered*unitPrice,unspentBuyerBudget:(ordered-deliverable)*unitPrice,revenue:deliverable*unitPrice,
      workingCost:setup+goodsCost+freight,meeting:day.meeting,periodLabel:day.label,condition:day.condition};
  }
  function settle(v,q,race) {
    if(!q.operates) throw Error("必要な前払が信用枠を超えます。予約の前金で動ける小口契約と窓口を選び直してください。");
    const raceNet=race?race.operatingProfit:0;
    const principal=v.debt+q.draw,interest=Math.ceil(principal/100);
    const tradeNet=q.revenue-q.goodsCost-q.freight, net=raceNet+tradeNet-interest-q.standingCost;
    // Event net already includes its opening cost; neither the draw nor
    // the customer's advance is counted as income.
    let cash=v.cash+q.draw+raceNet+tradeNet;
    const interestPaid=Math.min(cash,interest); cash-=interestPaid;
    // The receiving depot invoices rent and its order clerk after delivery.
    // Amounts still due stay on the books even if the race was postponed.
    const standingPaid=Math.min(cash,q.standingCost); cash-=standingPaid;
    let arrears=v.arrears+interest-interestPaid+q.standingCost-standingPaid;
    const arrearsPaid=Math.min(arrears,cash); cash-=arrearsPaid; arrears-=arrearsPaid;
    const repaid=Math.min(principal,cash); cash-=repaid;
    const returned=q.plan.contract==="local"?0:Math.floor(q.deliverable/2);
    const bottles=v.bottles+q.collected-q.reused+returned;
    const words=q.plan.contract==="local"?
      "市場の屋台から「予約の食材、"+q.deliverable+"口を受け取ったよ。"+(q.missed?"今度は受け取れなかった分も頼みたいな」":"また次の朝市で頼むよ」"):
      "果実酢の工房から「"+q.deliverable+"本が船へ渡ったよ。戻ってきた空瓶"+returned+"本を次の受取帳に載せたよ」";
    return {...q,period:v.period,tradeNet,raceNet,race,net,interest,interestPaid,standingPaid,arrearsPaid,repaid,cash,debt:principal-repaid,arrears,
      bottles,salvaged:v.salvaged+q.collected,returned,partnerReply:words,
      nextCondition:seasons[v.period%seasons.length].condition};
  }
  return {opening,view,quote,settle};
});
