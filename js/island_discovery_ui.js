// The island is explored through the existing, gated map. No race or wallet writes.
(function () {
  "use strict";
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const stories = window.IslandDiscoveryStories;
  function availableParty() { return ['solo','sake','sumika','mizu','poro'].filter(id=>id==='solo'||id==='poro'?(id==='solo'||typeof poroFound==='function'&&poroFound()):typeof advisorMet==='function'&&advisorMet(id)); }
  function companion() { const id=state.player.discoveryCompanion;return availableParty().includes(id)?id:'solo'; }
  window.islandDiscoveryCompanion=()=>state.player.discoveryCompanion&&availableParty().includes(state.player.discoveryCompanion)?state.player.discoveryCompanion:null;
  function context() {
    return { enabled: typeof IslandDiscovery !== "undefined" && typeof chapterRead === "function" && chapterRead("3") && konronMapUnlocked(),
      openSpots: Object.keys(KONRON_SPOTS).filter(id => _kmSpotOpen(KONRON_SPOTS[id]) && _kmHiddenQuiet(id)),
      spotUnlockAt:Object.fromEntries(Object.entries(KONRON_SPOTS).map(([id,s])=>[id,KM_TIER_AT[s.tier]||0])),
      currentSpotId: state.ui.screen === "konron_map" ? _kmSpot : null,
      dragonLevel: ((state.player.island || {}).lv || {}).dragon || 0, companionId:companion(),availableCompanions:availableParty() };
  }
  function view() { return IslandDiscovery.getView(state.player.islandDiscovery, context()); }
  window.islandDiscoveryHasClues = () => context().enabled && view().cases.some(c => !c.finding && !c.continuationGate);
  function commit(next) { if (JSON.stringify(next) !== JSON.stringify(state.player.islandDiscovery)) { state.player.islandDiscovery = next; saveGame(); } }
  function help() {
    showInfoPopup("景色から、島の裏側へ", "<p>現地で気になるものを調べ、二つの手掛かりを結んで、行き先を予想します。地図でそこへ行き、調べ方を選んで確かめてみてください。</p><p>違っていてもお金や手掛かりは失いません。その場所で見えたことが、考え直す根拠になります。発見した場所と住民の言葉は、手帖に残ります。</p><p>企画書は、何を守りたいかを考える記録です。保存だけで施設が建ったり、輸出益が入ったりすることはありません。</p>");
  }
  const noteButton = (label, cls, action) => { const b = document.createElement("button"); b.className = cls; b.textContent = label; b.onclick = action; return b; };
  function party(host,local){
    if(!stories)return;
    const d=document.createElement('details');d.className='id-party';d.innerHTML=`<summary>今日、一緒にめぐる相手：${esc(stories.companions[companion()].short)}<small>同行を選ぶ${!state.player.discoveryCompanion?' · NEW':''}</small></summary>`;
    for(const id of availableParty()){const c=stories.companions[id],b=noteButton('', 'id-party-choice'+(companion()===id?' selected':''),()=>{state.player.discoveryCompanion=id;state.ui._discoveryTalk=null;saveGame();if(local)_kmRenderPanel();else renderIslandDiscovery();});b.dataset.companion=id;b.innerHTML=`<b>${esc(c.name)}</b><span>${esc(c.intro)}</span>`;d.appendChild(b);}host.appendChild(d);
  }
  function talkHTML(caseId,stage,withId,observationId){
    if(!stories)return '';
    const id=withId||companion(),lines=stories.dialogue(caseId,stage,id,observationId);if(!lines.length)return '';
    return '<div class="id-talk" aria-label="一緒にめぐる会話">'+lines.map(l=>{const name=l.s==='mimi'?'ミミ':l.s==='narrator'?'':stories.companions[l.s]?.short||'';const src=l.s==='mimi'?outfitImg(currentOutfitId(),'default'):['sake','mizu','sumika'].includes(l.s)?'images/cast/stand/'+l.s+'.webp':null;return `<div class="id-talk-line">${src?`<span class="id-talk-avatar"><img src="${esc(src)}" alt="${esc(name)}"></span>`:''}<p>${name?`<b>${esc(name)}</b>`:''}<span>${esc(l.t)}</span></p></div>`;}).join('')+'</div>';
  }
  function setTalk(caseId,stage,spotId,observationId){state.ui._discoveryTalk={caseId,stage,spotId,companionId:companion(),observationId};}
  function appendPractice(host,c){
    const p=c.practice,joined=p.lastAction==='thread',box=document.createElement('section');box.className='id-practice';box.dataset.case=c.id;
    box.innerHTML='<small>サヨの仕事台・練習用の環と糸</small><h3>'+esc(p.prompt)+'</h3><p>左の糸を、環のどこへ渡す？ ドラッグか下のボタンで試せます。</p>'+`<div class="id-workbench ${joined?'joined':p.lastAction==='hang'?'slipped':''}"><svg viewBox="0 0 320 180" aria-label="${joined?'環を通った糸が、左右の網目をつないだ':'離れた網目と、中央の環'}" role="img"><path class="id-net" d="M10 26L64 150M10 80L44 158M10 135L80 26M28 26L84 155M2 54L82 54M2 98L84 98M2 142L82 142M244 26L306 158M280 26L320 116M244 153L310 26M242 54L320 54M242 98L320 98M242 142L320 142"/><circle cx="160" cy="90" r="43" class="id-ring"/><path class="id-loose-thread" d="M38 98Q70 57 98 98M224 98Q245 140 279 98"/><path class="id-joined-thread" d="M38 98Q87 68 126 90Q160 112 194 90Q232 64 279 98"/><path class="id-slipped-thread" d="M50 98Q90 22 158 37Q206 37 202 120Q210 152 236 158"/></svg><button class="id-tool-hole" data-tool-target="thread" aria-label="環の内側へ糸を通す">内側</button><button class="id-tool-rim" data-tool-target="hang" aria-label="環の外側へ糸を巻く">外側</button><button class="id-thread" aria-label="試す糸・ドラッグで環へ運べます">糸</button></div>`;
    const act=id=>{commit(IslandDiscovery.tryTool(state.player.islandDiscovery,c.id,id,context()));setTalk(c.id,id==='thread'?'practice_join':'practice_slip',p.spotId);_kmRenderPanel();document.querySelector('.id-practice')?.scrollIntoView({block:'start'});};
    box.querySelectorAll('[data-tool-target]').forEach(b=>b.onclick=()=>act(b.dataset.toolTarget));
    const drag=box.querySelector('.id-thread');let origin=null;
    drag.onpointerdown=e=>{origin={x:e.clientX,y:e.clientY};drag.setPointerCapture(e.pointerId);e.preventDefault();};
    drag.onpointermove=e=>{if(origin)drag.style.transform=`translate(${e.clientX-origin.x}px,${e.clientY-origin.y}px)`;};
    drag.onpointercancel=()=>{origin=null;drag.style.transform='';};
    drag.onpointerup=e=>{if(!origin)return;origin=null;drag.style.transform='';const r=box.querySelector('.id-workbench').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;const x=(e.clientX-r.left)/r.width*320,y=(e.clientY-r.top)/r.height*180;act(Math.hypot(x-160,y-90)<31?'thread':'hang');};
    for(const choice of p.choices){const b=noteButton(choice.label,'id-tool-choice',()=>act(choice.id));b.dataset.toolAction=choice.id;box.appendChild(b);}
    if(p.response){const r=document.createElement('p');r.className='id-tool-response';r.setAttribute('role','status');r.textContent=p.response;box.appendChild(r);}
    const t=state.ui._discoveryTalk;if(t&&t.caseId===c.id&&t.stage.startsWith('practice_'))box.insertAdjacentHTML('beforeend',talkHTML(c.id,t.stage,t.companionId));
    if(joined){const b=noteButton('つながった網目を、サヨに見てもらう ›','id-primary',()=>{commit(IslandDiscovery.acceptKeepsake(state.player.islandDiscovery,c.id,context()));setTalk(c.id,'found',p.spotId);renderIslandDiscovery(c.id);});b.dataset.acceptKeepsake=c.id;box.appendChild(b);}
    host.appendChild(box);
  }
  const returnLines={water:'水番がこちらに気づき、街へ運ぶ甕を指した。「今日は、あの札の見方もわかるね。いつもの一杯が待ってるよ」',nest:'見物道の人が、縄の手前を空けてくれた。「前と同じ所から。帰ってくる先、もう知っているものね」',pasture:'世話係が、あなたの図に残した通り道を指した。「水を飲みに来る野の子の道。ここは、このまま空けておこう」',history:'浜の刻みを、今度は潮を待つ人の目で見られる。古布屋でもらった写しを広げると、前に見つけた線が重なった。',trade:'荷役の人が、空瓶の棚を指して声をかけた。「今日は、戻る荷の分も場所を空けてある。前に見てくれた、あの往復さ」'};
  Object.assign(returnLines,{dragon_trace:'前にセラムを見つけた岩棚。今日も縄のこちらで待つ。前のスケッチを開いても、今の風と向きは、今の目で確かめる。',legend_ring:'サヨは手帖の小さな環を見て笑った。「前に渡した子ね。まだぴかぴか。今日は見に来てくれたの？」。仕事台の原品には、また新しい糸が通っていた。'});
  window.appendIslandDiscoveryEntry = function (host) {
    if (!context().enabled) return;
    const v = view(), n = v.cases.filter(c => c.finding).length;
    const b = noteButton("", "id-entry", () => renderIslandDiscovery());
    b.innerHTML = '<span class="id-entry-icon">⌁</span><span><small>ISLAND FIELD NOTES' + (!state.player.islandDiscovery ? ' · NEW' : '') + '</small><b>景色の向こうを、見つけに。</b><em>' + (n ? "見つけた場所と、まだ気になること" : "湯気も、荷船も。どこかにつながっている。") + '</em></span><i>›</i>';
    host.appendChild(b);
  };
  window.appendIslandDiscoveryPlace = function (host, spotId) {
    if (!context().enabled) return;
    const v = view(), observations = v.observations.filter(o => o.spotId === spotId);
    const checking = v.cases.filter(c => c.inspection && c.inspection.spotId === spotId && !c.finding&&!c.practice);
    const practicing=v.cases.filter(c=>c.practice&&c.practice.spotId===spotId);
    const found = v.cases.filter(c => c.finding && c.finding.spotId === spotId);
    if (!observations.length && !checking.length && !found.length&&!practicing.length&&!v.hints?.length) return;
    const box = document.createElement("section"); box.className = "id-local";
    box.innerHTML = '<header><small>少し、足を止めて</small><button class="id-help" aria-label="探索の遊び方">？</button></header>';
    box.querySelector('.id-help').onclick = help;
    party(box,true);
    for(const hint of v.hints||[]){const d=document.createElement('details');d.className='id-field-hint';d.innerHTML=`<summary>${esc(hint.title)}</summary><p>${esc(hint.body)}</p>`;box.appendChild(d);}
    for (const o of observations) {
      const b = noteButton("", "id-observe" + (o.collected ? " collected" : ""), () => {
        commit(IslandDiscovery.observe(state.player.islandDiscovery, o.id, context()));
        const c=stories&&stories.cases.find(c=>c.evidence.includes(o.id));if(c)setTalk(c.id,'clue',spotId,o.id);
        _kmRenderPanel(); const fresh = document.querySelector('.id-local'); if (fresh) fresh.scrollIntoView({block:"center"});
      });
      b.dataset.observe = o.id;
      b.innerHTML = `<span>${o.collected ? "✓ 手帖に残した" : "気になる"}</span><b>${esc(o.title)}</b>${o.collected ? `<p>${esc(o.body)}</p>` : '<i>よく見てみる ›</i>'}`;
      if(o.closeup){const image=document.createElement('span');image.className='id-clue-closeup';image.setAttribute('role','img');image.setAttribute('aria-label',o.title);image.style.backgroundImage='url("'+o.closeup.image+'")';image.style.backgroundPosition=o.closeup.position;image.style.backgroundSize=o.closeup.size;b.prepend(image);}
      box.appendChild(b);
    }
    const t=state.ui._discoveryTalk;if(t&&t.spotId===spotId&&!t.stage.startsWith('practice_'))box.insertAdjacentHTML('beforeend',talkHTML(t.caseId,t.stage,t.companionId,t.observationId));
    for (const c of checking) {
      const section = document.createElement('div'); section.className = 'id-inspection'; section.dataset.case = c.id;
      section.innerHTML = `<small>手帖に置いた予想を、ここで確かめる</small><h3>${esc(c.inspection.prompt)}</h3>`;
      if (c.inspection.frames) {
        const strip = document.createElement('div');
        strip.className = 'id-wind-frames'; strip.setAttribute('role','group');
        strip.setAttribute('aria-label','見比べるコマ');
        const observation = document.createElement('p');
        observation.setAttribute('aria-live','polite');
        const arrows = ['旗 →','旗 ↓','旗 ←'];
        function showFrame(index) {
          observation.textContent = c.inspection.frames[index][1];
          Array.from(strip.children).forEach((b,i) => {
            b.setAttribute('aria-pressed',String(i === index));
            b.textContent = c.inspection.frames[i][0] + '　' + arrows[i] + (i === index ? '　◉' : '');
          });
        }
        c.inspection.frames.forEach(([heading],index) => {
          const frame = noteButton(heading + '　' + arrows[index], 'id-tool-choice', () => showFrame(index));
          frame.dataset.windFrame = String(index); strip.appendChild(frame);
        });
        const previous = state.player.islandDiscovery?.notice;
        const markedLull = previous?.type === 'inspection' && previous.id === c.id && previous.methodId === 'lull';
        section.appendChild(strip); section.appendChild(observation); showFrame(markedLull ? 1 : 0);
        const mark = document.createElement('b'); mark.textContent = '次の一巡、飛び立つと思うコマに印を付ける'; section.appendChild(mark);
        if (t?.caseId === c.id && t.stage === 'wind_retry' && v.notice) {
          const reply = document.createElement('p');
          reply.className = 'id-refutation'; reply.setAttribute('role', 'status');
          reply.textContent = v.notice.body; section.appendChild(reply);
        }
      }
      for (const m of c.inspection.methods) section.appendChild(noteButton(m.label, "id-method", () => {
        commit(IslandDiscovery.inspect(state.player.islandDiscovery, c.id, m.id, context()));
        if(view().cases.find(x=>x.id===c.id)?.practice){state.ui._discoveryTalk=null;_kmRenderPanel();document.querySelector('.id-practice')?.scrollIntoView({block:'start'});return;}
        const found = view().cases.find(x=>x.id===c.id)?.finding;
        if (c.inspection.frames && !found) {
          setTalk(c.id,'wind_retry',spotId); _kmRenderPanel();
          document.querySelector('.id-inspection[data-case="dragon_trace"]')?.scrollIntoView({block:'center'});
          return;
        }
        setTalk(c.id,c.inspection.frames?'wind_found':found?'found':'retry',spotId);
        renderIslandDiscovery(c.id);
      }));
      section.querySelectorAll('.id-method').forEach((b,i)=>b.dataset.method=c.inspection.methods[i].id);
      box.appendChild(section);
    }
    for(const c of practicing)appendPractice(box,c);
    for (const c of found) { const echo=document.createElement('p');echo.className='id-local-echo';echo.textContent=c.finding.revisit||returnLines[c.id]||c.finding.reply;box.appendChild(echo);box.insertAdjacentHTML('beforeend',(c.finding.revisit?'':talkHTML(c.id,'return')));const d = document.createElement('details'); d.className='id-found-local';d.dataset.finding=c.id;d.innerHTML=`<summary><b>${esc(c.finding.title)}</b><small>見つけた場所の記録を開く</small></summary>`+findingHTML(c.finding);d.ontoggle=()=>{d.querySelector('summary small').textContent=d.open?'記録を閉じる':'見つけた場所の記録を開く';};box.appendChild(d); }
    if(spotId==='tanada'&&typeof appendIslandCareOffer==='function') appendIslandCareOffer(box,'water',true);
    box.appendChild(noteButton("手掛かりを、手帖でつなぐ ›", "id-open-notes", () => renderIslandDiscovery()));
    host.appendChild(box);
  };
  function go(spotId) {
    if (context().openSpots.includes(spotId)) return kmGotoSpot(spotId);
    const spot=KONRON_SPOTS[spotId];
    const when=spot&&!_kmSpotOpen(spot)?_kmTierRequirement(spot.tier)+'で、この行き先を訪ねられます。':'今ある場所を巡り、行き先が広がってから進めます。';
    if(typeof showInfoPopup==='function')showInfoPopup('この寄り道は、もう少し先へ','<p>'+when+'見つけた手掛かりは、手帖に残ります。</p>');
    return false;
  }
  function findingHTML(f) {
    return `<div class="id-finding"><img src="${esc(f.image)}" alt="${esc(f.title)}"><div><small>自分の予想の先に、あった</small><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p><blockquote>${esc(f.reply)}</blockquote>${f.souvenir?`<aside class="id-keepsake"><small>旅の手帖に、残ったもの</small><b>${esc(f.souvenir.name)}</b><p>${esc(f.souvenir.body)}</p></aside>`:''}${f.companionId?`<small class="id-company-memory">${esc(stories.companions[f.companionId].short)}と、一緒に見つけた</small>`:''}</div></div>`;
  }
  window.renderIslandDiscovery = function (focusId) {
    if (!context().enabled) { renderKonronMap(); return; }
    state.ui.screen = "island_discovery";
    const v = view(), app = beginScreen(); app.classList.add("id-page");
    const head = document.createElement('header'); head.className='id-head';
    head.innerHTML='<small>KONRON / FIELD NOTES</small><h2>ここに、あるはず。</h2><p>見たものをつなぐと、島の見え方が変わる。</p><button class="id-help" aria-label="探索の遊び方">？</button>';head.querySelector('button').onclick=help;app.appendChild(head);
    party(app,false);
    const noticeType=(state.player.islandDiscovery||{}).notice?.type;
    const focusedFinding=v.cases.find(c=>c.id===focusId)?.finding;
    const foundMessage = focusedFinding?.spotId === 'kazami_yagura' && focusId === 'dragon_trace'
      ? '旗が返り、翼が開く瞬間を手帖に記録した。' : '手掛かりの先に、新しい場所を見つけた。';
    const noticeHTML=v.notice&&noticeType!=='observation' ? `<div class="id-notice" role="status"><b>${focusedFinding&&noticeType==='inspection'?foundMessage:esc(v.notice.title)}</b>${focusedFinding&&noticeType==='inspection'?'':`<p>${esc(v.notice.body)}</p>`}</div>` : '';
    if (!focusId && noticeHTML) app.insertAdjacentHTML('beforeend',noticeHTML);
    const visible=v.cases;
    const invitations=document.createElement('details');invitations.className='id-invitations';invitations.innerHTML='<summary>別の気になる景色を、探す</summary>';
    for(const [spot,label] of [['ryu_mizunomi','水際に残る、竜の足跡'],['furununo','古布屋に眠る、道具の写し']])if(context().openSpots.includes(spot))invitations.appendChild(noteButton(label+' ›','id-secondary',()=>go(spot)));if(invitations.querySelector('button'))app.appendChild(invitations);
    if (!visible.length) {
      const start=document.createElement('section');start.className='id-first';start.innerHTML='<img src="images/konron/spots/market.webp" alt="湯気の立つ島の市場"><h3>毎日の一杯。その水は、どこから？</h3><p>観光名所の手前にも、よく見ると気になるものがある。</p>';
      start.appendChild(noteButton('市場のそばを、よく見てみる ›','id-primary',()=>go('market')));app.appendChild(start);
      const alternatives=document.createElement('div');alternatives.className='id-starts';alternatives.appendChild(noteButton('港の荷ほどきを眺める','id-secondary',()=>go('kirimina')));alternatives.appendChild(noteButton('竜の水のみ場を訪ねる','id-secondary',()=>go('ryu_mizunomi')));app.appendChild(alternatives);
    }
    let encounterShown = false;
    for (const c of visible) {
      const card=document.createElement('section');card.className='id-case';card.dataset.case=c.id;
      card.innerHTML=`<div class="id-case-title"><small>${c.finding ? '見つけた場所' : 'いま、気になっている'}</small><h3>${esc(c.title)}</h3>${c.finding?'':`<p>${esc(c.question)}</p>`}</div>`;
      if(focusId===c.id&&noticeHTML)card.insertAdjacentHTML('beforeend',noticeHTML);
      const moment=state.ui._discoveryTalk;if(moment&&moment.caseId===c.id){const text=talkHTML(c.id,moment.stage,moment.companionId,moment.observationId);card.insertAdjacentHTML('beforeend',moment.stage==='clue'?'<details class="id-talk-revisit"><summary>'+esc(stories.companions[moment.companionId]?.short||'ミミ')+'と、現地で話したこと</summary>'+text+'</details>':text);}
      if (c.finding) {
        card.insertAdjacentHTML('beforeend',findingHTML(c.finding));
        if(typeof appendIslandCareOffer==='function') appendIslandCareOffer(card,c.id,false);
        if (!encounterShown && (!focusId || focusId === c.id) && typeof appendNextStoryEncounter === 'function') encounterShown = appendNextStoryEncounter(card);
        if(c.finding.dragonId&&typeof poroScoutUnlocked==='function'&&poroScoutUnlocked()&&typeof scoutDragonHome==='function'){
          const d=dragonById(c.finding.dragonId),locId=d&&scoutDragonHome(d),loc=typeof SCOUT_LOCATIONS!=='undefined'&&SCOUT_LOCATIONS.find(x=>x.id===locId);
          if(loc&&scoutLocationUnlocked(locId)){const b=noteButton(loc.name+'で、竜とのスカウトへ ›','id-secondary',()=>{state.ui.scoutFrom=locId;renderScout();});b.dataset.discoveryScout=locId;card.appendChild(b);}
        }
        if (c.plans && c.plans.length) {
          const plans=document.createElement('div');plans.className='id-plans';plans.innerHTML='<h4>この発見から、島に何を残したい？</h4><p>調査を根拠にした企画書。まだ実行前です。</p>';
          for (const p of c.plans) { const b=noteButton('', 'id-plan'+(c.plan&&c.plan.id===p.id?' selected':''),()=>{commit(IslandDiscovery.plan(state.player.islandDiscovery,c.id,p.id,context()));renderIslandDiscovery(c.id);});b.dataset.plan=p.id;b.innerHTML=`<b>${esc(p.label)}</b><span>${esc(p.detail)}</span>`;plans.appendChild(b); }
          if(c.plan){const p=document.createElement('p');p.className='id-saved-plan';p.textContent='企画書に残した：'+c.plan.label;plans.appendChild(p);}
          card.appendChild(plans);
        }
        card.appendChild(noteButton('見つけた場所へ、もう一度 ›','id-secondary',()=>{go(c.finding.spotId);const d=Array.from(document.querySelectorAll('.id-found-local')).find(x=>x.dataset.finding===c.id);if(d){d.open=true;d.scrollIntoView({block:'start'});}}));
      } else {
        const evidence=document.createElement('div');evidence.className='id-evidence';evidence.innerHTML='<h4>自分の目で、確かめたこと</h4>';
        for (const e of c.evidence) {
          const line=document.createElement('div');line.className='id-evidence-row';
          line.innerHTML=`<b>${esc(e.title)}</b><small>${esc(e.body)}</small>`;
          evidence.appendChild(line);
        }
        card.appendChild(evidence);
        if(c.evidence.length<2){
          const p=document.createElement('p');p.className='id-tip';
          const gate=c.continuationGate;
          const tier=gate?KM_TIER_AT.indexOf(gate.requiredAssets):-1;
          const when=tier>0?_kmTierRequirement(tier)+'で':'島めぐりの行き先が広がると';
          p.textContent=gate?'続きの場所は、'+when+'探せます。見つけた手掛かりは、この手帖に残ります。':'もう一つ、根拠がほしい。見たものが示している場所を、島の地図で探してみよう。';
          card.appendChild(p);card.appendChild(noteButton(gate?'今ある行き先を、島の地図で巡る ›':'島の地図で、続きを探す ›','id-secondary',()=>renderKonronMap()));
        }
        if (c.canPropose) {
          const h=document.createElement('div');h.className='id-hypotheses';h.innerHTML='<h4>この先に、あるとしたら。</h4>';
          for (const p of c.hypotheses) {const b=noteButton('', 'id-hypothesis'+(c.selected&&c.selected.hypothesisId===p.id?' selected':''),()=>{commit(IslandDiscovery.propose(state.player.islandDiscovery,c.id,p.id,c.evidence.map(e=>e.id),context()));renderIslandDiscovery(c.id);});b.dataset.hypothesis=p.id;b.disabled=!p.available;b.innerHTML=`<b>${esc(p.label)}</b><span>${esc(p.reason)}</span>`;h.appendChild(b);}card.appendChild(h);
          if (!c.selected) {const tip=document.createElement('p');tip.className='id-tip';tip.textContent='この二つを根拠に、予想を置いてみよう。';card.appendChild(tip);}
        }
        if(c.practice)card.appendChild(noteButton('港で、借りた道具を試す ›','id-primary',()=>go(c.practice.spotId)));
        else if (c.inspection) { const target=KONRON_SPOTS[c.inspection.spotId];card.appendChild(noteButton((target?target.name:'予想した場所')+'で確かめる ›','id-primary',()=>go(c.inspection.spotId))); }
        if (c.refutations) {const lines=Array.isArray(c.refutations)?c.refutations:Object.values(c.refutations);for(const r of lines){const p=document.createElement('p');p.className='id-refutation';p.textContent=typeof r==='string'?r:r.body||r.text||'';card.appendChild(p);}}
      }
      app.appendChild(card);
    }
    const foot=document.createElement('div');foot.className='id-footer';foot.appendChild(noteButton('島の地図に戻る','id-secondary',()=>renderKonronMap()));app.appendChild(foot);
    if (typeof nextSuggestRow === 'function') { const row=nextSuggestRow('island_discovery');if(row)app.appendChild(row); }
    if(focusId) { const target=Array.from(app.querySelectorAll('.id-case')).find(x=>x.dataset.case===focusId);if(target)target.scrollIntoView({block:'start'}); }
  };
  window.appendIslandDiscoveryEconomy=function(host){
    if(!context().enabled)return;
    const plans=view().cases.filter(c=>c.finding&&c.plan);if(!plans.length)return;
    const box=document.createElement('section');box.className='id-economic';box.innerHTML='<small>現地で確かめたことから</small><h3>島に残したい、暮らしのつながり</h3>';
    for(const c of plans){const p=document.createElement('div');p.innerHTML=`<b>${esc(c.plan.label)}</b><p>${esc(c.plan.detail)}</p><small>調査からの提案・未実行</small>`;if(typeof advisorMet==='function'&&advisorMet('celestia')){const cat=ISLAND_CATS.find(x=>x.id===c.plan.investment);if(cat)p.appendChild(noteButton('関連する「'+cat.name+'」分野を見る ›','id-secondary',()=>{renderIslandBuild();const target=Array.from(document.querySelectorAll('[data-island-cat]')).find(x=>x.dataset.islandCat===cat.id);if(target)target.scrollIntoView({block:'start'});}));}box.appendChild(p);}
    const unlocked=typeof advisorMet==='function'&&advisorMet('celestia');
    if(!unlocked){const p=document.createElement('p');p.textContent='終章の島づくりが開いたら、選んだ企画を関連する投資分野のそばで読み返せます。今は再訪して、その仕事が続く風景を見にいこう。';box.appendChild(p);}
    box.appendChild(noteButton(unlocked?'企画を持って、島づくりへ ›':'企画書を読み返す ›','id-primary',()=>unlocked?renderIslandBuild():renderIslandDiscovery()));host.appendChild(box);
  };
  window.appendIslandDiscoveryInvestment=function(host,catId){
    if(!context().enabled)return;
    const plans=view().cases.filter(c=>c.plan&&c.plan.investment===catId);if(!plans.length)return;
    const box=document.createElement('div');box.className='id-invest-context';box.innerHTML='<small>現地調査から、あなたが残した企画</small>'+plans.map(c=>`<p>${esc(c.plan.label)}</p>`).join('')+'<small>下の投資は既存分野の整備です。企画書の個別工事を完了するものではありません。</small>';host.appendChild(box);
  };
})();
