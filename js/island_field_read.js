// Public-source comparisons only. No race resolution, votes or payouts here.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IslandFieldRead=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const choices={dragon_trace:[{id:'conditions',label:'この竜の特性と、今回のコース条件を照合する'},{id:'limits',label:'好材料だけでなく、弱くなる条件も探す'}],legend_ring:[{id:'overlap',label:'同じ竜を含む予想が、一緒に外れる範囲を見る'},{id:'audience',label:'読者が集まる理由と、的中の条件を分けて考える'}]};
  const text=v=>typeof v==='string'?v:'';
  function options(caseId){return (choices[caseId]||[]).map(c=>({...c}));}
  function condition(type){return type==='wide'?'選んだ2頭が両方とも3着以内':type==='win'?'選んだ竜が1着':'選んだ竜が2着以内';}
  function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
  function capture(caseId,lensId,ctx){
    const lens=options(caseId).find(x=>x.id===lensId),c=ctx||{},o=c.offer,s=c.scenario,slot=c.slot;
    if(!lens||!o||!text(o.id)||!Array.isArray(o.ids)||!o.ids.length||!s||!text(s.id)||!slot)return null;
    const dragons=o.ids.map(id=>(c.dragons||[]).find(d=>d.id===id));if(dragons.some(d=>!d))return null;
    const names=dragons.map(d=>d.name).join('・');
    const facts=[...dragons.map(d=>d.name+'：'+text(d.trait)+' '+text(d.note)),text(s.title)+'：'+text(s.condition)];
    let claim='', sharedIds=[], relatedOfferIds=[];
    if(lensId==='conditions')claim=s.title+'で「'+o.title+'」が届く条件は、'+condition(o.type)+'。'+names+'が得意な走りと、今回のコースを見比べられる。';
    if(lensId==='limits')claim='「'+o.title+'」に必要なのは、'+condition(o.type)+'。'+names+'に有利な区間があっても、そこでの位置取りやゴールまで同じ走りが続くかはまだ分からない。';
    if(lensId==='overlap'){
      const others=(c.planOffers||[]).filter(p=>p.id!==o.id&&Array.isArray(p.ids));
      sharedIds=o.ids.filter(id=>id!==s.oracleWinner&&others.some(p=>p.ids.includes(id)));
      const peers=others.filter(p=>p.ids.some(id=>sharedIds.includes(id)));
      relatedOfferIds=peers.map(p=>p.id);
      facts.push('この予想の的中条件：'+condition(o.type));
      peers.forEach(p=>facts.push(p.title+'：'+condition(p.type)));
      const oracle=dragons.find(d=>d.id===s.oracleWinner);
      if(oracle&&others.some(p=>p.ids.includes(oracle.id))) facts.push(oracle.name+'の一着は予言済み。この竜の着順で一緒に外れる心配はない。');
      if(peers.length){
        const ranks={win:1,place:2,wide:3};
        claim=peers.map(p=>{
          const shared=dragons.filter(d=>sharedIds.includes(d.id)&&p.ids.includes(d.id)).map(d=>d.name);
          const missesBoth=1+Math.max(ranks[o.type],ranks[p.type]);
          return '「'+o.title+'」と「'+p.title+'」は、'+shared.join('か')+'が'+missesBoth+'着以下だと、ともに外れる。';
        }).join(' ');
      } else claim='「'+o.title+'」とほかの予想には、着順がまだ分からない共通の竜はいない。';
    }
    if(lensId==='audience'){
      facts.push('届ける先：'+text(slot.title)+'。'+text(slot.description));facts.push('この予想の的中条件：'+condition(o.type));
      claim='「'+o.title+'」の届け先は「'+slot.title+'」。そこに集まる票で配当は変わる。的中に必要な条件は「'+condition(o.type)+'」。';
    }
    return freeze({version:1,caseId,sourceTitle:text(c.sourceTitle),lensId,lensLabel:lens.label,offerId:o.id,offerTitle:text(o.title),ids:o.ids.slice(),type:o.type,scenarioId:s.id,courseTitle:text(s.title),condition:text(s.condition),slotIndex:c.slotIndex,slotTitle:text(slot.title),facts,claim,sharedIds,relatedOfferIds});
  }
  return {options,capture,condition};
});
